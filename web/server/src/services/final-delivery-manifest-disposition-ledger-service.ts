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
import {
  StoryAgentFinalDeliveryManifestDispositionSubmitRequestSchema,
} from '@shared/schemas.js';
import {
  ErrorCodes,
  type ErrorCode,
  type StoryAgentFinalDeliveryManifestDisposition,
  type StoryAgentFinalDeliveryManifestDispositionEvent,
  type StoryAgentFinalDeliveryManifestDispositionLedger,
  type StoryAgentFinalDeliveryManifestDispositionLedgerFilters,
  type StoryAgentFinalDeliveryManifestDispositionSubmitRequest,
  type StoryAgentFinalDeliveryManifestDispositionSubmitResult,
} from '@shared/types.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import { preflightStoryAgentFinalDeliveryManifest } from './final-delivery-manifest-preflight-service.js';

const LEDGER_RELATIVE_PATH = [
  'system',
  'final-delivery-manifest-dispositions.json',
] as const;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 10;
const LOCK_STALE_MS = 30_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const writeQueues = new Map<string, Promise<unknown>>();

interface StoredDispositionLedger {
  schema_version: 'story-agent-final-delivery-manifest-disposition-storage/v1';
  entries: StoryAgentFinalDeliveryManifestDispositionEvent[];
}

export interface FinalDeliveryManifestDispositionLedgerOptions {
  generatedRoot?: string;
  now?: () => Date;
}

export class FinalDeliveryManifestDispositionLedgerError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FinalDeliveryManifestDispositionLedgerError';
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

function failStorage(message: string): never {
  throw new FinalDeliveryManifestDispositionLedgerError(
    ErrorCodes.REVIEW_STORAGE_UNAVAILABLE,
    message,
  );
}

function failValidation(message: string): never {
  throw new FinalDeliveryManifestDispositionLedgerError(
    ErrorCodes.VALIDATION_ERROR,
    message,
  );
}

export function finalDeliveryManifestDispositionLedgerPath(
  generatedRoot = storyGeneratedRoot(),
): string {
  return resolve(generatedRoot, ...LEDGER_RELATIVE_PATH);
}

function emptyStorage(): StoredDispositionLedger {
  return {
    schema_version:
      'story-agent-final-delivery-manifest-disposition-storage/v1',
    entries: [],
  };
}

function isDispositionEvent(
  value: unknown,
): value is StoryAgentFinalDeliveryManifestDispositionEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<StoryAgentFinalDeliveryManifestDispositionEvent>;
  return event.schema_version
      === 'story-agent-final-delivery-manifest-disposition-event/v1'
    && typeof event.event_id === 'string'
    && /^final-delivery-disposition-[a-f0-9]{24}$/.test(event.event_id)
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
    && typeof event.series_project_id === 'string'
    && (event.disposition ===
      'preserve_fixture_exclude_from_publishable_delivery'
      || event.disposition === 'reexport_after_authorized_dependencies')
    && (event.disposition_status === 'decision_recorded'
      || event.disposition_status ===
        'decision_recorded_pending_dependencies')
    && Boolean(event.operator)
    && Boolean(event.decision)
    && event.attestation?.human_operator === true
    && event.attestation?.reviewed_current_preflight === true
    && event.attestation?.accepts_no_publishable_delivery_credit === true
    && event.preflight?.schema_version
      === 'story-agent-final-delivery-manifest-preflight/v1'
    && typeof event.preflight.checks_sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(event.preflight.checks_sha256)
    && event.boundary?.operator_decision_recorded === true
    && event.boundary?.operator_identity_independently_verified === false
    && event.boundary?.disposition_applied_to_project === false
    && event.boundary?.project_files_modified === false
    && event.boundary?.manifest_written === false
    && event.boundary?.final_assemble_invoked === false
    && event.boundary?.publishable_delivery_credit_granted === false;
}

function assertValidChain(
  entries: unknown[],
): StoryAgentFinalDeliveryManifestDispositionEvent[] {
  const eventIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  let previousHash: string | null = null;
  return entries.map((candidate, index) => {
    if (!isDispositionEvent(candidate)) {
      failStorage(`Manifest disposition event ${index + 1} is invalid`);
    }
    const event = candidate as StoryAgentFinalDeliveryManifestDispositionEvent;
    if (
      event.sequence !== index + 1
      || event.previous_event_sha256 !== previousHash
    ) {
      failStorage(`Manifest disposition chain breaks at sequence ${index + 1}`);
    }
    const { event_sha256: storedHash, ...unsigned } = event;
    const expectedHash = sha256(canonicalJson(unsigned));
    if (storedHash !== expectedHash) {
      failStorage(`Manifest disposition hash mismatch at sequence ${index + 1}`);
    }
    if (
      eventIds.has(event.event_id)
      || idempotencyKeys.has(event.idempotency_key)
    ) {
      failStorage(`Manifest disposition ledger has duplicate event ${index + 1}`);
    }
    eventIds.add(event.event_id);
    idempotencyKeys.add(event.idempotency_key);
    previousHash = event.event_sha256;
    return event;
  });
}

async function readStorage(filePath: string): Promise<StoredDispositionLedger> {
  try {
    const target = await lstat(filePath);
    if (!target.isFile() || target.isSymbolicLink()) {
      failStorage('Manifest disposition ledger target is unsafe');
    }
    const parsed = JSON.parse(
      await readFile(filePath, 'utf8'),
    ) as Partial<StoredDispositionLedger>;
    if (
      parsed.schema_version
        !== 'story-agent-final-delivery-manifest-disposition-storage/v1'
      || !Array.isArray(parsed.entries)
    ) {
      failStorage('Manifest disposition storage envelope is invalid');
    }
    return {
      schema_version:
        'story-agent-final-delivery-manifest-disposition-storage/v1',
      entries: assertValidChain(parsed.entries),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyStorage();
    }
    if (error instanceof FinalDeliveryManifestDispositionLedgerError) {
      throw error;
    }
    return failStorage('Manifest disposition ledger cannot be read or verified');
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
        failStorage('Manifest disposition ledger lock is unsafe');
      }
      if (Date.now() - target.mtimeMs >= LOCK_STALE_MS) {
        await removeIfPresent(lockPath);
        continue;
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        failStorage('Manifest disposition ledger lock timed out');
      }
      await wait(LOCK_RETRY_MS);
    }
  }
}

async function atomicWriteStorage(
  filePath: string,
  storage: StoredDispositionLedger,
): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryTarget = await lstat(directory);
  if (!directoryTarget.isDirectory() || directoryTarget.isSymbolicLink()) {
    failStorage('Manifest disposition ledger directory is unsafe');
  }
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  const descriptor = await open(
    temporaryPath,
    constants.O_WRONLY
      | constants.O_CREAT
      | constants.O_EXCL
      | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await descriptor.writeFile(
      `${JSON.stringify(storage, null, 2)}\n`,
      'utf8',
    );
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

function normalizedFilters(
  requested: StoryAgentFinalDeliveryManifestDispositionLedgerFilters,
): StoryAgentFinalDeliveryManifestDispositionLedger['filters'] {
  const requestedLimit = Number.isFinite(requested.limit)
    ? Math.trunc(requested.limit!)
    : DEFAULT_LIMIT;
  return {
    series_project_id: requested.series_project_id ?? null,
    operator_id: requested.operator_id ?? null,
    disposition: requested.disposition ?? null,
    limit: Math.min(MAX_LIMIT, Math.max(1, requestedLimit)),
  };
}

function dispositionCounts(
  entries: StoryAgentFinalDeliveryManifestDispositionEvent[],
): Record<StoryAgentFinalDeliveryManifestDisposition, number> {
  return {
    preserve_fixture_exclude_from_publishable_delivery: entries.filter(
      item => item.disposition
        === 'preserve_fixture_exclude_from_publishable_delivery',
    ).length,
    reexport_after_authorized_dependencies: entries.filter(
      item => item.disposition === 'reexport_after_authorized_dependencies',
    ).length,
  };
}

export function buildFinalDeliveryManifestDispositionLedger(
  sourceEntries: StoryAgentFinalDeliveryManifestDispositionEvent[],
  requestedFilters: StoryAgentFinalDeliveryManifestDispositionLedgerFilters = {},
  ledgerHeadSha256: string | null =
    sourceEntries.at(-1)?.event_sha256 ?? null,
): StoryAgentFinalDeliveryManifestDispositionLedger {
  const filters = normalizedFilters(requestedFilters);
  const matched = sourceEntries
    .filter(entry => (
      (!filters.series_project_id
        || entry.series_project_id === filters.series_project_id)
      && (!filters.operator_id
        || entry.operator.operator_id === filters.operator_id)
      && (!filters.disposition
        || entry.disposition === filters.disposition)
    ))
    .sort((left, right) => right.sequence - left.sequence);
  const entries = matched.slice(0, filters.limit);
  return {
    schema_version:
      'story-agent-final-delivery-manifest-disposition-ledger/v1',
    filters,
    summary: {
      recorded_decision_count: matched.length,
      returned_decision_count: entries.length,
      operator_decisions_recorded: matched.length > 0,
      ready_preflight_count: matched.filter(
        item => item.preflight.status === 'ready',
      ).length,
      blocked_preflight_count: matched.filter(
        item => item.preflight.status === 'blocked',
      ).length,
      disposition_counts: dispositionCounts(matched),
    },
    entries,
    integrity: {
      chain_valid: true,
      invalid_event_count: 0,
      ledger_head_sha256: ledgerHeadSha256,
    },
    boundary: {
      source: 'operator_submitted_final_delivery_manifest_dispositions',
      operator_identity_independently_verified: false,
      disposition_applied_to_project: false,
      project_files_modified: false,
      manifest_written: false,
      final_assemble_invoked: false,
      publishable_delivery_credit_granted: false,
    },
  };
}

export async function collectFinalDeliveryManifestDispositionEvents(
  options: FinalDeliveryManifestDispositionLedgerOptions = {},
): Promise<StoryAgentFinalDeliveryManifestDispositionEvent[]> {
  const storage = await readStorage(
    finalDeliveryManifestDispositionLedgerPath(options.generatedRoot),
  );
  return storage.entries;
}

export async function readFinalDeliveryManifestDispositionLedger(
  options: FinalDeliveryManifestDispositionLedgerOptions = {},
  filters: StoryAgentFinalDeliveryManifestDispositionLedgerFilters = {},
): Promise<StoryAgentFinalDeliveryManifestDispositionLedger> {
  const entries = await collectFinalDeliveryManifestDispositionEvents(options);
  return buildFinalDeliveryManifestDispositionLedger(entries, filters);
}

export async function submitFinalDeliveryManifestDisposition(
  rawRequest: StoryAgentFinalDeliveryManifestDispositionSubmitRequest,
  options: FinalDeliveryManifestDispositionLedgerOptions = {},
): Promise<StoryAgentFinalDeliveryManifestDispositionSubmitResult> {
  const request =
    StoryAgentFinalDeliveryManifestDispositionSubmitRequestSchema.parse(
      rawRequest,
    ) as StoryAgentFinalDeliveryManifestDispositionSubmitRequest;
  const preflight = await preflightStoryAgentFinalDeliveryManifest({
    series_project_id: request.series_project_id,
    disposition: request.disposition,
    authorized_media_inputs_attested:
      request.authorized_media_inputs_attested,
  }, {
    generatedRoot: options.generatedRoot,
    now: options.now,
  });
  const targetExists = preflight.checks.find(
    check => check.key === 'target_exists',
  )?.status === 'passed';
  const gapConfirmed = preflight.checks.find(
    check => check.key === 'manifest_gap_confirmed',
  )?.status === 'passed';
  if (!targetExists || !gapConfirmed) {
    failValidation(
      'Disposition target is not a current final-delivery manifest gap',
    );
  }

  const requestHash = sha256(canonicalJson(request));
  const filePath =
    finalDeliveryManifestDispositionLedgerPath(options.generatedRoot);
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
          throw new FinalDeliveryManifestDispositionLedgerError(
            ErrorCodes.REVIEW_WRITE_CONFLICT,
            'Manifest disposition idempotency key has different content',
          );
        }
        return {
          schema_version:
            'story-agent-final-delivery-manifest-disposition-submit-result/v1',
          event: existing,
          idempotent_replay: true,
        };
      }

      const sequence = storage.entries.length + 1;
      const previousEventSha256 =
        storage.entries.at(-1)?.event_sha256 ?? null;
      const recordedAt = (options.now?.() ?? new Date()).toISOString();
      const eventId = `final-delivery-disposition-${sha256(canonicalJson({
        request_hash: requestHash,
        sequence,
        recorded_at: recordedAt,
      })).slice(0, 24)}`;
      const unsigned: Omit<
        StoryAgentFinalDeliveryManifestDispositionEvent,
        'event_sha256'
      > = {
        schema_version:
          'story-agent-final-delivery-manifest-disposition-event/v1',
        event_id: eventId,
        sequence,
        previous_event_sha256: previousEventSha256,
        request_sha256: requestHash,
        idempotency_key: request.idempotency_key,
        recorded_at: recordedAt,
        series_project_id: request.series_project_id,
        disposition: request.disposition,
        disposition_status: preflight.eligible_for_selected_disposition
          ? 'decision_recorded'
          : 'decision_recorded_pending_dependencies',
        authorized_media_inputs_attested:
          request.authorized_media_inputs_attested ?? false,
        operator: request.operator,
        decision: request.decision,
        attestation: request.attestation,
        preflight: {
          schema_version: preflight.schema_version,
          generated_at: preflight.generated_at,
          status: preflight.status,
          eligible_for_selected_disposition:
            preflight.eligible_for_selected_disposition,
          checks_sha256: sha256(canonicalJson(preflight.checks)),
          missing_dependencies: preflight.missing_dependencies,
          unsafe_paths: preflight.unsafe_paths,
        },
        boundary: {
          operator_decision_recorded: true,
          operator_identity_independently_verified: false,
          disposition_applied_to_project: false,
          project_files_modified: false,
          manifest_written: false,
          final_assemble_invoked: false,
          publishable_delivery_credit_granted: false,
        },
      };
      const event: StoryAgentFinalDeliveryManifestDispositionEvent = {
        ...unsigned,
        event_sha256: sha256(canonicalJson(unsigned)),
      };
      await atomicWriteStorage(filePath, {
        ...storage,
        entries: [...storage.entries, event],
      });
      return {
        schema_version:
          'story-agent-final-delivery-manifest-disposition-submit-result/v1',
        event,
        idempotent_replay: false,
      };
    } catch (error) {
      if (error instanceof FinalDeliveryManifestDispositionLedgerError) {
        throw error;
      }
      return failStorage('Manifest disposition ledger write failed');
    } finally {
      await removeIfPresent(lockPath).catch(() => undefined);
    }
  });
}
