import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { StoryRecipeEffectHumanReviewSubmitRequestSchema } from '@shared/schemas.js';
import {
  ErrorCodes,
  type ErrorCode,
  type StoryRecipeEffectHumanReviewDecision,
  type StoryRecipeEffectHumanReviewEvent,
  type StoryRecipeEffectHumanReviewLedger,
  type StoryRecipeEffectHumanReviewLedgerFilters,
  type StoryRecipeEffectHumanReviewSubmitRequest,
  type StoryRecipeEffectHumanReviewSubmitResult,
} from '@shared/types.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import {
  buildStoryRecipeEffectMachineReport,
  collectStoryRecipeEffectComparisonHistoryRecords,
  type StoryRecipeEffectComparisonHistoryRecord,
} from './reference-recipe-effect-history-service.js';

const LEDGER_RELATIVE_PATH = ['system', 'story-recipe-effect-human-reviews.json'] as const;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 10;
const LOCK_STALE_MS = 30_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const writeQueues = new Map<string, Promise<unknown>>();

interface StoredHumanReviewLedger {
  schema_version: 'story-recipe-effect-human-review-storage/v1';
  entries: StoryRecipeEffectHumanReviewEvent[];
}

export interface StoryRecipeEffectHumanReviewLedgerOptions {
  generatedRoot?: string;
  comparisonRecords?: StoryRecipeEffectComparisonHistoryRecord[];
  now?: () => Date;
}

export class StoryRecipeEffectHumanReviewLedgerError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StoryRecipeEffectHumanReviewLedgerError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => (
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function eventHashMaterial(
  event: Omit<StoryRecipeEffectHumanReviewEvent, 'event_sha256'>,
): string {
  return canonicalJson(event);
}

function failStorage(message: string): never {
  throw new StoryRecipeEffectHumanReviewLedgerError(
    ErrorCodes.REVIEW_STORAGE_UNAVAILABLE,
    message,
  );
}

function failValidation(message: string): never {
  throw new StoryRecipeEffectHumanReviewLedgerError(
    ErrorCodes.VALIDATION_ERROR,
    message,
  );
}

export function storyRecipeEffectHumanReviewLedgerPath(
  generatedRoot = storyGeneratedRoot(),
): string {
  return resolve(generatedRoot, ...LEDGER_RELATIVE_PATH);
}

function emptyStorage(): StoredHumanReviewLedger {
  return {
    schema_version: 'story-recipe-effect-human-review-storage/v1',
    entries: [],
  };
}

function isReviewEvent(value: unknown): value is StoryRecipeEffectHumanReviewEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<StoryRecipeEffectHumanReviewEvent>;
  return event.schema_version === 'story-recipe-effect-human-review-event/v1'
    && typeof event.event_id === 'string'
    && /^recipe-human-review-[a-f0-9]{24}$/.test(event.event_id)
    && Number.isSafeInteger(event.sequence)
    && (event.sequence ?? 0) >= 1
    && (event.previous_event_sha256 === null
      || (typeof event.previous_event_sha256 === 'string'
        && /^[a-f0-9]{64}$/.test(event.previous_event_sha256)))
    && typeof event.event_sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(event.event_sha256)
    && typeof event.request_sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(event.request_sha256)
    && typeof event.idempotency_key === 'string'
    && typeof event.recorded_at === 'string'
    && Number.isFinite(Date.parse(event.recorded_at))
    && typeof event.project_id === 'string'
    && typeof event.project_title === 'string'
    && typeof event.story_id === 'string'
    && Boolean(event.comparison)
    && Boolean(event.cohort)
    && Boolean(event.reviewer)
    && Boolean(event.review)
    && event.attestation?.human_reviewer === true
    && event.attestation?.compared_both_outputs === true
    && event.attestation?.independent_judgment === true
    && event.boundary?.human_review_recorded === true
    && event.boundary?.aggregate_human_preference_claimed === false
    && event.boundary?.causal_effect_proven === false
    && event.boundary?.legal_conclusion_reached === false
    && event.boundary?.production_credit_granted === false;
}

function assertValidChain(entries: unknown[]): StoryRecipeEffectHumanReviewEvent[] {
  const seenEventIds = new Set<string>();
  const seenIdempotencyKeys = new Set<string>();
  let previousHash: string | null = null;
  return entries.map((candidate, index) => {
    if (!isReviewEvent(candidate)) {
      failStorage(`Human review ledger event ${index + 1} is invalid`);
    }
    const event = candidate as StoryRecipeEffectHumanReviewEvent;
    if (event.sequence !== index + 1 || event.previous_event_sha256 !== previousHash) {
      failStorage(`Human review ledger chain breaks at sequence ${index + 1}`);
    }
    const { event_sha256: storedHash, ...unsigned } = event;
    const expectedHash = sha256(eventHashMaterial(unsigned));
    if (storedHash !== expectedHash) {
      failStorage(`Human review ledger hash mismatch at sequence ${index + 1}`);
    }
    if (seenEventIds.has(event.event_id) || seenIdempotencyKeys.has(event.idempotency_key)) {
      failStorage(`Human review ledger contains a duplicate event at sequence ${index + 1}`);
    }
    seenEventIds.add(event.event_id);
    seenIdempotencyKeys.add(event.idempotency_key);
    previousHash = event.event_sha256;
    return event;
  });
}

async function readStorage(filePath: string): Promise<StoredHumanReviewLedger> {
  try {
    const target = await lstat(filePath);
    if (!target.isFile() || target.isSymbolicLink()) {
      failStorage('Human review ledger target is not a safe regular file');
    }
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as Partial<StoredHumanReviewLedger>;
    if (
      parsed.schema_version !== 'story-recipe-effect-human-review-storage/v1'
      || !Array.isArray(parsed.entries)
    ) {
      failStorage('Human review ledger storage envelope is invalid');
    }
    return {
      schema_version: 'story-recipe-effect-human-review-storage/v1',
      entries: assertValidChain(parsed.entries),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStorage();
    if (error instanceof StoryRecipeEffectHumanReviewLedgerError) throw error;
    return failStorage('Human review ledger cannot be read or verified');
  }
}

async function removeIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}

async function acquireLock(filePath: string): Promise<string> {
  const lockPath = `${filePath}.lock`;
  const startedAt = Date.now();
  while (true) {
    try {
      const descriptor = await open(lockPath, 'wx', 0o600);
      await descriptor.writeFile(`${randomUUID()}\n`, 'utf8');
      await descriptor.sync();
      await descriptor.close();
      return lockPath;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const target = await lstat(lockPath);
      if (!target.isFile() || target.isSymbolicLink()) {
        failStorage('Human review ledger lock target is unsafe');
      }
      if (Date.now() - target.mtimeMs >= LOCK_STALE_MS) {
        await removeIfPresent(lockPath);
        continue;
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        failStorage('Human review ledger lock acquisition timed out');
      }
      await wait(LOCK_RETRY_MS);
    }
  }
}

async function atomicWriteStorage(
  filePath: string,
  storage: StoredHumanReviewLedger,
): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryTarget = await lstat(directory);
  if (!directoryTarget.isDirectory() || directoryTarget.isSymbolicLink()) {
    failStorage('Human review ledger directory is unsafe');
  }
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  const descriptor = await open(
    temporaryPath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await descriptor.writeFile(`${JSON.stringify(storage, null, 2)}\n`, 'utf8');
    await descriptor.sync();
  } finally {
    await descriptor.close();
  }
  await rename(temporaryPath, filePath);
  const directoryDescriptor = await open(directory, constants.O_RDONLY);
  try {
    await directoryDescriptor.sync();
  } finally {
    await directoryDescriptor.close();
  }
}

async function serializeWrite<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  let resolveResult!: (value: T) => void;
  let rejectResult!: (reason: unknown) => void;
  const result = new Promise<T>((resolvePromise, rejectPromise) => {
    resolveResult = resolvePromise;
    rejectResult = rejectPromise;
  });
  const next = previous.catch(() => undefined).then(async () => {
    try {
      resolveResult(await operation());
    } catch (error) {
      rejectResult(error);
    }
  });
  writeQueues.set(filePath, next);
  void next.finally(() => {
    if (writeQueues.get(filePath) === next) writeQueues.delete(filePath);
  });
  return result;
}

function normalizedLedgerFilters(
  filters: StoryRecipeEffectHumanReviewLedgerFilters,
): StoryRecipeEffectHumanReviewLedger['filters'] {
  const requestedLimit = Number.isFinite(filters.limit)
    ? Math.trunc(filters.limit!)
    : DEFAULT_LIMIT;
  return {
    project_id: filters.project_id ?? null,
    story_id: filters.story_id ?? null,
    reviewer_id: filters.reviewer_id ?? null,
    decision: filters.decision ?? null,
    limit: Math.min(MAX_LIMIT, Math.max(1, requestedLimit)),
  };
}

function decisionCounts(
  entries: StoryRecipeEffectHumanReviewEvent[],
): Record<StoryRecipeEffectHumanReviewDecision, number> {
  return {
    baseline_preferred: entries.filter(
      item => item.review.decision === 'baseline_preferred',
    ).length,
    recipe_preferred: entries.filter(
      item => item.review.decision === 'recipe_preferred',
    ).length,
    no_preference: entries.filter(
      item => item.review.decision === 'no_preference',
    ).length,
    insufficient_evidence: entries.filter(
      item => item.review.decision === 'insufficient_evidence',
    ).length,
  };
}

export function buildStoryRecipeEffectHumanReviewLedger(
  sourceEntries: StoryRecipeEffectHumanReviewEvent[],
  requestedFilters: StoryRecipeEffectHumanReviewLedgerFilters = {},
  ledgerHeadSha256: string | null = sourceEntries.at(-1)?.event_sha256 ?? null,
): StoryRecipeEffectHumanReviewLedger {
  const filters = normalizedLedgerFilters(requestedFilters);
  const matched = sourceEntries
    .filter(entry => (
      (!filters.project_id || entry.project_id === filters.project_id)
      && (!filters.story_id || entry.story_id === filters.story_id)
      && (!filters.reviewer_id || entry.reviewer.reviewer_id === filters.reviewer_id)
      && (!filters.decision || entry.review.decision === filters.decision)
    ))
    .sort((left, right) => (
      right.sequence - left.sequence
      || right.recorded_at.localeCompare(left.recorded_at)
    ));
  const entries = matched.slice(0, filters.limit);
  return {
    schema_version: 'story-recipe-effect-human-review-ledger/v1',
    filters,
    summary: {
      recorded_review_count: matched.length,
      returned_review_count: entries.length,
      human_reviews_recorded: matched.length > 0,
      decision_counts: decisionCounts(matched),
    },
    entries,
    integrity: {
      chain_valid: true,
      invalid_event_count: 0,
      ledger_head_sha256: ledgerHeadSha256,
    },
    boundary: {
      source: 'operator_submitted_human_reviews',
      machine_scores_inferred_as_human_judgment: false,
      aggregate_human_preference_claimed: false,
      causal_effect_proven: false,
      legal_conclusion_reached: false,
      production_credit_granted: false,
    },
  };
}

export async function collectStoryRecipeEffectHumanReviewEvents(
  options: StoryRecipeEffectHumanReviewLedgerOptions = {},
): Promise<StoryRecipeEffectHumanReviewEvent[]> {
  const storage = await readStorage(
    storyRecipeEffectHumanReviewLedgerPath(options.generatedRoot),
  );
  return storage.entries;
}

export async function readStoryRecipeEffectHumanReviewLedger(
  options: StoryRecipeEffectHumanReviewLedgerOptions = {},
  requestedFilters: StoryRecipeEffectHumanReviewLedgerFilters = {},
): Promise<StoryRecipeEffectHumanReviewLedger> {
  const entries = await collectStoryRecipeEffectHumanReviewEvents(options);
  return buildStoryRecipeEffectHumanReviewLedger(entries, requestedFilters);
}

async function comparisonRecords(
  options: StoryRecipeEffectHumanReviewLedgerOptions,
): Promise<StoryRecipeEffectComparisonHistoryRecord[]> {
  return options.comparisonRecords
    ?? collectStoryRecipeEffectComparisonHistoryRecords();
}

export async function submitStoryRecipeEffectHumanReview(
  rawRequest: StoryRecipeEffectHumanReviewSubmitRequest,
  options: StoryRecipeEffectHumanReviewLedgerOptions = {},
): Promise<StoryRecipeEffectHumanReviewSubmitResult> {
  const request = StoryRecipeEffectHumanReviewSubmitRequestSchema.parse(
    rawRequest,
  ) as StoryRecipeEffectHumanReviewSubmitRequest;
  const records = await comparisonRecords(options);
  const report = buildStoryRecipeEffectMachineReport(
    records,
    request.cohort.report_filters,
  );
  if (
    report.cohort.cohort_id !== request.cohort.cohort_id
    || report.cohort.membership_sha256 !== request.cohort.membership_sha256
  ) {
    failValidation('Human review cohort reference is stale or does not match the canonical report');
  }
  const historyItem = report.history.items.find(item => (
    item.project_id === request.project_id
    && item.story_id === request.story_id
  ));
  if (!historyItem) {
    failValidation('The reviewed project/story is not a member of the referenced canonical cohort');
  }

  const requestHash = sha256(canonicalJson(request));
  const comparison = historyItem.comparison;
  const filePath = storyRecipeEffectHumanReviewLedgerPath(options.generatedRoot);
  return serializeWrite(filePath, async () => {
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    const lockPath = await acquireLock(filePath);
    try {
      const storage = await readStorage(filePath);
      const existing = storage.entries.find(
        entry => entry.idempotency_key === request.idempotency_key,
      );
      if (existing) {
        if (existing.request_sha256 !== requestHash) {
          throw new StoryRecipeEffectHumanReviewLedgerError(
            ErrorCodes.REVIEW_WRITE_CONFLICT,
            'Human review idempotency key was already used with different content',
          );
        }
        return {
          schema_version: 'story-recipe-effect-human-review-submit-result/v1',
          event: existing,
          idempotent_replay: true,
        };
      }

      const sequence = storage.entries.length + 1;
      const previousEventSha256 = storage.entries.at(-1)?.event_sha256 ?? null;
      const recordedAt = (options.now?.() ?? new Date()).toISOString();
      const comparisonPayloadSha256 = sha256(canonicalJson(comparison));
      const eventId = `recipe-human-review-${sha256(canonicalJson({
        request_hash: requestHash,
        sequence,
        recorded_at: recordedAt,
      })).slice(0, 24)}`;
      const unsigned: Omit<StoryRecipeEffectHumanReviewEvent, 'event_sha256'> = {
        schema_version: 'story-recipe-effect-human-review-event/v1',
        event_id: eventId,
        sequence,
        previous_event_sha256: previousEventSha256,
        request_sha256: requestHash,
        idempotency_key: request.idempotency_key,
        recorded_at: recordedAt,
        project_id: historyItem.project_id,
        project_title: historyItem.project_title,
        story_id: historyItem.story_id,
        comparison: {
          comparison_payload_sha256: comparisonPayloadSha256,
          baseline_story_id: comparison.baseline_story_id,
          recipe_assisted_story_id: comparison.recipe_assisted_story_id,
          recipe_id: comparison.recipe.recipe_id,
          recipe_version: comparison.recipe.recipe_version,
          recipe_payload_sha256: comparison.recipe.payload_sha256,
        },
        cohort: request.cohort,
        reviewer: request.reviewer,
        review: request.review,
        attestation: request.attestation,
        boundary: {
          human_review_recorded: true,
          aggregate_human_preference_claimed: false,
          causal_effect_proven: false,
          legal_conclusion_reached: false,
          production_credit_granted: false,
        },
      };
      const event: StoryRecipeEffectHumanReviewEvent = {
        ...unsigned,
        event_sha256: sha256(eventHashMaterial(unsigned)),
      };
      await atomicWriteStorage(filePath, {
        ...storage,
        entries: [...storage.entries, event],
      });
      return {
        schema_version: 'story-recipe-effect-human-review-submit-result/v1',
        event,
        idempotent_replay: false,
      };
    } catch (error) {
      if (error instanceof StoryRecipeEffectHumanReviewLedgerError) throw error;
      return failStorage('Human review ledger write failed');
    } finally {
      await removeIfPresent(lockPath).catch(() => undefined);
    }
  });
}
