import fs from 'node:fs/promises';
import { constants, type Dirent } from 'node:fs';
import path from 'node:path';

type Diagnosis =
  | 'attempt_history_unavailable'
  | 'no_generation_request_since_latest_success'
  | 'generation_pipeline_failure_detected'
  | 'generation_attempt_incomplete'
  | 'storage_root_mismatch_detected'
  | 'pending_transaction_detected';
type ActivityKind = 'story_generation' | 'project_revision' | 'report_only' | 'none';
type AttemptStatus = 'started' | 'succeeded' | 'failed';

const ATTEMPT_SCHEMA = 'story-generation-attempt-event/v1';
const ATTEMPT_ENTRYPOINT = 'web_api_stories_generate';
const ATTEMPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOMAIN_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const VIDEO_TYPES = new Set([
  'character_story', 'historical_drama', 'legend_story', 'culture_promo', 'heritage_promo',
  'city_brand_promo', 'scene_short', 'landscape_mood', 'documentary_short', 'explainer_video',
  'lecture_video', 'education_training', 'children_story', 'social_short', 'ai_comic_drama',
]);
const STABLE_ERROR_CODES = new Set([
  'ACCESS_UNAUTHENTICATED', 'ACCESS_FORBIDDEN', 'ACCESS_AUDIT_UNAVAILABLE', 'ACCESS_RESOURCE_UNBOUND',
  'ACCESS_RESOURCE_FORBIDDEN', 'ACCESS_RESOURCE_MIGRATION_BLOCKED', 'CALLBACK_UNAUTHENTICATED',
  'CALLBACK_AUTH_UNAVAILABLE', 'PROJECT_WRITE_CONFLICT', 'PROJECT_REPOSITORY_IDENTIFIER_INVALID',
  'PROJECT_REPOSITORY_MIGRATION_BLOCKED', 'ARTIFACT_WRITE_CONFLICT', 'ARTIFACT_PATH_INVALID',
  'ARTIFACT_STORAGE_UNAVAILABLE', 'REVIEW_WRITE_CONFLICT', 'REVIEW_REPOSITORY_IDENTIFIER_INVALID',
  'REVIEW_STORAGE_UNAVAILABLE', 'JOB_WRITE_CONFLICT', 'JOB_REPOSITORY_IDENTIFIER_INVALID',
  'JOB_STORAGE_UNAVAILABLE', 'SERIES_PROJECT_WRITE_CONFLICT', 'SERIES_PROJECT_IDENTIFIER_INVALID',
  'SERIES_PROJECT_STORAGE_UNAVAILABLE', 'STORY_WRITE_CONFLICT', 'STORY_REPOSITORY_IDENTIFIER_INVALID',
  'STORY_STORAGE_UNAVAILABLE', 'DOMAIN_PACK_NOT_FOUND', 'DOMAIN_PACK_REGISTRY_INVALID',
  'DOMAIN_SAFETY_VALIDATION_FAILED', 'DOMAIN_SAFETY_MIGRATION_BLOCKED', 'ENTRY_NOT_FOUND',
  'INVALID_GENERATION_TYPE', 'INVALID_VIDEO_TYPE', 'INVALID_PRESENTATION_STYLE', 'INVALID_STORY_STRUCTURE',
  'INVALID_DURATION', 'STORY_GENERATION_FAILED', 'STORY_GENERATION_AUDIT_UNAVAILABLE', 'STORY_NOT_FOUND',
  'GEARS_SEGMENTS_NOT_FOUND', 'VALIDATION_ERROR', 'INTERNAL_ERROR', 'UNHANDLED_GENERATION_ERROR',
]);

interface StoryEvidence {
  story_id: string;
  created_at: string;
}

interface VersionEvidence {
  project_id: string;
  version_id: string;
  created_at: string;
  change_type?: string;
}

interface ReportEvidence {
  report_file: string;
  generated_at: string;
}

interface AttemptEvent {
  schema_version: typeof ATTEMPT_SCHEMA;
  attempt_id: string;
  occurred_at: string;
  entrypoint: typeof ATTEMPT_ENTRYPOINT;
  source_domain: string;
  video_type: string;
  status: AttemptStatus;
  error_code?: string;
}

interface AttemptEvidence {
  attempt_id: string;
  entrypoint: typeof ATTEMPT_ENTRYPOINT;
  source_domain: string;
  video_type: string;
  status: AttemptStatus;
  started_at: string;
  terminal_at?: string;
  error_code?: string;
}

type AttemptAuditReadinessBlocker =
  | 'audit_parent_not_writable'
  | 'audit_directory_unsafe'
  | 'audit_directory_not_writable'
  | 'audit_directory_permissions_unsafe'
  | 'ledger_target_unsafe'
  | 'ledger_permissions_unsafe'
  | 'archive_target_unsafe'
  | 'archive_permissions_unsafe'
  | 'archive_retention_exceeded'
  | 'ledger_history_invalid'
  | 'ledger_lock_active'
  | 'ledger_lock_permissions_unsafe'
  | 'ledger_lock_invalid';

type AttemptAuditOperatorAction =
  | 'no_action_required'
  | 'review_audit_parent_permissions_after_backup'
  | 'review_audit_directory_safety_after_backup'
  | 'review_audit_directory_permissions_after_backup'
  | 'review_ledger_target_safety_after_backup'
  | 'review_ledger_permissions_after_backup'
  | 'review_archive_target_safety_after_backup'
  | 'review_archive_permissions_after_backup'
  | 'review_archive_retention_after_backup'
  | 'review_invalid_history_after_backup'
  | 'wait_for_active_writer_and_reinspect'
  | 'reinspect_expired_lock_on_next_canonical_request'
  | 'review_lock_permissions_after_backup'
  | 'review_invalid_lock_after_backup';

type AttemptAuditConfigurationWarning =
  | 'invalid_max_bytes_configuration_fell_back_to_default'
  | 'invalid_max_archives_configuration_fell_back_to_default'
  | 'invalid_lock_timeout_configuration_fell_back_to_default'
  | 'invalid_lock_retry_configuration_fell_back_to_default'
  | 'invalid_lock_stale_configuration_fell_back_to_default';

interface AttemptAuditReadiness {
  schema_version: 'story-generation-attempt-audit-readiness/v1';
  status: 'uninitialized' | 'ready' | 'blocked';
  storage_initialized: boolean;
  ledger_present: boolean;
  archive_count: number;
  current_file_bytes: number;
  configured_max_bytes: number;
  configured_max_archives: number;
  configured_lock_timeout_ms: number;
  configured_lock_retry_ms: number;
  configured_lock_stale_ms: number;
  configuration_valid: boolean;
  configuration_warnings: AttemptAuditConfigurationWarning[];
  permission_policy: 'owner_only';
  permission_policy_satisfied: boolean;
  event_file_sync_required: true;
  no_follow_open_required: true;
  directory_entry_sync_guaranteed: true;
  lock_status: 'absent' | 'active' | 'expired_recoverable' | 'invalid';
  history_integrity: 'unavailable' | 'valid' | 'invalid';
  valid_event_count: number;
  invalid_event_count: number;
  ready_for_next_attempt: boolean;
  blockers: AttemptAuditReadinessBlocker[];
  warnings: string[];
  operator_actions: AttemptAuditOperatorAction[];
  automatic_repair_allowed: false;
  destructive_action_performed: false;
  request_content_recorded: false;
  model_output_recorded: false;
  raw_exception_recorded: false;
  absolute_path_exposed: false;
}

export interface StoryGenerationActivityEvidence {
  schema_version: 'story-agent-generation-activity/v1';
  generated_at: string;
  diagnosis: Diagnosis;
  latest_persisted_activity_kind: ActivityKind;
  latest_story?: StoryEvidence;
  latest_project_version?: VersionEvidence;
  latest_report?: ReportEvidence;
  legacy_latest_story?: StoryEvidence;
  latest_generation_attempt?: AttemptEvidence;
  attempt_audit_readiness: AttemptAuditReadiness;
  summary: {
    story_count: number;
    project_count: number;
    version_count: number;
    report_count: number;
    project_revision_after_latest_story_count: number;
    report_after_latest_story_count: number;
    pending_transaction_count: number;
    legacy_story_count: number;
    legacy_project_count: number;
    generation_attempt_count: number;
    generation_attempt_succeeded_count: number;
    generation_attempt_failed_count: number;
    generation_attempt_incomplete_count: number;
    generation_attempt_invalid_event_count: number;
  };
  signals: {
    durable_generation_attempt_history_available: boolean;
    generation_attempt_audit_ready_for_next_request: boolean;
    no_generation_request_confirmed: boolean;
    generation_pipeline_failure_confirmed: boolean;
    generation_attempt_incomplete_detected: boolean;
    storage_root_switch_detected: boolean;
    report_only_activity_detected: boolean;
    project_revision_only_activity_detected: boolean;
  };
  unresolved_possibilities: Array<
    | 'no_generation_request_submitted'
    | 'generation_request_failed_before_persistence'
    | 'generation_request_in_progress_or_interrupted'
  >;
  safety: {
    read_only: true;
    generated_files_modified: false;
    model_invoked: false;
  };
  notes: string[];
}

interface InventoryOptions {
  generatedRoot: string;
  kbRoot: string;
  legacyGeneratedRoot?: string;
  now?: Date;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function timestamp(value: unknown): string | undefined {
  const candidate = text(value);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : undefined;
}

async function entries(directory: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readJson(filePath: string): Promise<JsonRecord | undefined> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
    return record(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function latest<T>(items: T[], at: (item: T) => string): T | undefined {
  return [...items].sort((left, right) => at(right).localeCompare(at(left)))[0];
}

async function stories(root: string): Promise<StoryEvidence[]> {
  const storyRoot = path.resolve(root, 'stories');
  const output: StoryEvidence[] = [];
  for (const item of await entries(storyRoot)) {
    const files = item.isDirectory()
      ? (await entries(path.resolve(storyRoot, item.name)))
        .filter(candidate => candidate.isFile() && candidate.name.endsWith('.json'))
        .map(candidate => path.resolve(storyRoot, item.name, candidate.name))
      : item.isFile() && item.name.endsWith('.json')
        ? [path.resolve(storyRoot, item.name)]
        : [];
    for (const filePath of files) {
      const value = await readJson(filePath);
      if (!value) continue;
      const requestMeta = record(value._request_meta) ? value._request_meta : {};
      const createdAt = timestamp(requestMeta.created_at ?? value.created_at);
      if (!createdAt) continue;
      output.push({
        story_id: text(value.storyId ?? value.story_id) ?? path.basename(filePath, '.json'),
        created_at: createdAt,
      });
    }
  }
  return output;
}

async function projects(root: string): Promise<{
  projectCount: number;
  versions: VersionEvidence[];
  pendingTransactionCount: number;
}> {
  let projectCount = 0;
  let pendingTransactionCount = 0;
  const versions: VersionEvidence[] = [];
  for (const projectEntry of await entries(path.resolve(root, 'projects'))) {
    if (!projectEntry.isDirectory()) continue;
    const projectDirectory = path.resolve(root, 'projects', projectEntry.name);
    const project = await readJson(path.resolve(projectDirectory, 'project.json'));
    if (project) projectCount += 1;
    for (const transaction of await entries(path.resolve(projectDirectory, '.transactions'))) {
      if (transaction.isFile() && transaction.name.endsWith('.intent.json')) pendingTransactionCount += 1;
    }
    for (const versionEntry of await entries(path.resolve(projectDirectory, 'versions'))) {
      if (!versionEntry.isFile() || !versionEntry.name.endsWith('.json')) continue;
      const version = await readJson(path.resolve(projectDirectory, 'versions', versionEntry.name));
      const createdAt = timestamp(version?.created_at);
      if (!version || !createdAt) continue;
      versions.push({
        project_id: text(version.project_id ?? project?.project_id) ?? projectEntry.name,
        version_id: text(version.version_id) ?? path.basename(versionEntry.name, '.json'),
        created_at: createdAt,
        change_type: text(version.change_type),
      });
    }
  }
  return { projectCount, versions, pendingTransactionCount };
}

async function reports(kbRoot: string): Promise<ReportEvidence[]> {
  const output: ReportEvidence[] = [];
  for (const item of await entries(path.resolve(kbRoot, 'reports'))) {
    if (!item.isFile() || !item.name.endsWith('.json')) continue;
    const value = await readJson(path.resolve(kbRoot, 'reports', item.name));
    const generatedAt = timestamp(value?.generated_at ?? value?.updated_at);
    if (generatedAt) output.push({ report_file: item.name, generated_at: generatedAt });
  }
  return output;
}

function isAttemptEvent(value: unknown): value is AttemptEvent {
  if (!record(value)) return false;
  return value.schema_version === ATTEMPT_SCHEMA
    && typeof value.attempt_id === 'string'
    && ATTEMPT_ID_PATTERN.test(value.attempt_id)
    && typeof value.occurred_at === 'string'
    && Number.isFinite(Date.parse(value.occurred_at))
    && value.entrypoint === ATTEMPT_ENTRYPOINT
    && typeof value.source_domain === 'string'
    && DOMAIN_ID_PATTERN.test(value.source_domain)
    && typeof value.video_type === 'string'
    && VIDEO_TYPES.has(value.video_type)
    && (value.status === 'started' || value.status === 'succeeded' || value.status === 'failed')
    && (value.status === 'failed'
      ? typeof value.error_code === 'string' && STABLE_ERROR_CODES.has(value.error_code)
      : value.error_code === undefined);
}

async function readAttemptEvents(filePath: string): Promise<{
  events: AttemptEvent[];
  invalidLineCount: number;
  exists: boolean;
}> {
  let raw: string;
  try {
    const target = await fs.lstat(filePath);
    if (!target.isFile() || target.isSymbolicLink() || !ownerOnlyPermissions(target.mode)) {
      return { events: [], invalidLineCount: 1, exists: true };
    }
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? { events: [], invalidLineCount: 0, exists: false }
      : { events: [], invalidLineCount: 1, exists: true };
  }
  const events: AttemptEvent[] = [];
  let invalidLineCount = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as unknown;
      if (isAttemptEvent(value)) events.push(value);
      else invalidLineCount += 1;
    } catch {
      invalidLineCount += 1;
    }
  }
  return { events, invalidLineCount, exists: true };
}

async function attempts(generatedRoot: string): Promise<{
  available: boolean;
  records: AttemptEvidence[];
  validEventCount: number;
  invalidLineCount: number;
}> {
  const ledgerPath = path.resolve(generatedRoot, 'system', 'story-generation-attempts.jsonl');
  const archiveLimit = configuredArchiveLimit();
  const paths = Array.from({ length: archiveLimit }, (_, index) => `${ledgerPath}.${archiveLimit - index}`)
    .concat(ledgerPath);
  const files = await Promise.all(paths.map(readAttemptEvents));
  const events = files.flatMap(file => file.events);
  const records = new Map<string, AttemptEvidence>();
  for (const event of events) {
    const existing = records.get(event.attempt_id);
    if (event.status === 'started') {
      if (!existing) {
        records.set(event.attempt_id, {
          attempt_id: event.attempt_id,
          entrypoint: event.entrypoint,
          source_domain: event.source_domain,
          video_type: event.video_type,
          status: 'started',
          started_at: event.occurred_at,
        });
      }
      continue;
    }
    if (!existing || existing.status !== 'started' || event.occurred_at < existing.started_at) continue;
    existing.status = event.status;
    existing.terminal_at = event.occurred_at;
    if (event.status === 'failed') existing.error_code = event.error_code;
  }
  const invalidLineCount = files.reduce((sum, file) => sum + file.invalidLineCount, 0);
  return {
    available: events.length > 0 && invalidLineCount === 0,
    records: [...records.values()].sort((left, right) => left.started_at.localeCompare(right.started_at)),
    validEventCount: events.length,
    invalidLineCount,
  };
}

function integerEnvironment(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name]?.trim());
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function integerEnvironmentInvalid(name: string, minimum: number, maximum: number): boolean {
  const raw = process.env[name];
  if (raw === undefined) return false;
  const value = Number(raw.trim());
  return !Number.isSafeInteger(value) || value < minimum || value > maximum;
}

function ownerOnlyPermissions(mode: number): boolean {
  return (mode & 0o077) === 0;
}

function configuredArchiveLimit(): number {
  return integerEnvironment('STORY_GENERATION_ATTEMPT_AUDIT_MAX_ARCHIVES', 4, 1, 32);
}

async function nearestWritableAncestor(targetPath: string): Promise<boolean> {
  let candidate = targetPath;
  while (true) {
    try {
      const target = await fs.lstat(candidate);
      if (!target.isDirectory() || target.isSymbolicLink()) return false;
      await fs.access(candidate, constants.W_OK);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false;
      const parent = path.dirname(candidate);
      if (parent === candidate) return false;
      candidate = parent;
    }
  }
}

async function archiveIndexes(auditDirectory: string): Promise<number[]> {
  try {
    return (await fs.readdir(auditDirectory))
      .map(name => name.match(/^story-generation-attempts\.jsonl\.(\d+)$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number)
      .filter(value => Number.isSafeInteger(value) && value >= 1)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((left, right) => left - right);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function validLockRecord(lockPath: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(await fs.readFile(lockPath, 'utf8')) as unknown;
    if (!record(parsed)) return false;
    return parsed.schema_version === 'story-generation-attempt-lock/v1'
      && typeof parsed.owner_id === 'string'
      && ATTEMPT_ID_PATTERN.test(parsed.owner_id)
      && typeof parsed.created_at === 'string'
      && Number.isFinite(Date.parse(parsed.created_at));
  } catch {
    return false;
  }
}

async function attemptReadiness(
  generatedRoot: string,
  audit: Awaited<ReturnType<typeof attempts>>,
): Promise<AttemptAuditReadiness> {
  const auditDirectory = path.resolve(generatedRoot, 'system');
  const ledgerPath = path.resolve(auditDirectory, 'story-generation-attempts.jsonl');
  const archiveLimit = configuredArchiveLimit();
  const blockers: AttemptAuditReadinessBlocker[] = [];
  const warnings: string[] = [];
  const configurationWarnings: AttemptAuditConfigurationWarning[] = [];
  if (integerEnvironmentInvalid('STORY_GENERATION_ATTEMPT_AUDIT_MAX_BYTES', 256, 1_073_741_824)) {
    configurationWarnings.push('invalid_max_bytes_configuration_fell_back_to_default');
  }
  if (integerEnvironmentInvalid('STORY_GENERATION_ATTEMPT_AUDIT_MAX_ARCHIVES', 1, 32)) {
    configurationWarnings.push('invalid_max_archives_configuration_fell_back_to_default');
  }
  if (integerEnvironmentInvalid('STORY_GENERATION_ATTEMPT_AUDIT_LOCK_TIMEOUT_MS', 10, 60_000)) {
    configurationWarnings.push('invalid_lock_timeout_configuration_fell_back_to_default');
  }
  if (integerEnvironmentInvalid('STORY_GENERATION_ATTEMPT_AUDIT_LOCK_RETRY_MS', 1, 1_000)) {
    configurationWarnings.push('invalid_lock_retry_configuration_fell_back_to_default');
  }
  if (integerEnvironmentInvalid('STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS', 10, 3_600_000)) {
    configurationWarnings.push('invalid_lock_stale_configuration_fell_back_to_default');
  }
  let storageInitialized = false;
  let directorySafe = true;
  let permissionPolicySatisfied = true;
  try {
    const target = await fs.lstat(auditDirectory);
    storageInitialized = true;
    if (!target.isDirectory() || target.isSymbolicLink()) {
      directorySafe = false;
      blockers.push('audit_directory_unsafe');
    } else {
      if (!ownerOnlyPermissions(target.mode)) {
        permissionPolicySatisfied = false;
        blockers.push('audit_directory_permissions_unsafe');
      }
      try {
        await fs.access(auditDirectory, constants.W_OK);
      } catch {
        blockers.push('audit_directory_not_writable');
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      directorySafe = false;
      blockers.push('audit_directory_unsafe');
    } else if (!await nearestWritableAncestor(auditDirectory)) {
      blockers.push('audit_parent_not_writable');
    }
  }

  let ledgerPresent = false;
  let currentFileBytes = 0;
  let archiveCount = 0;
  let unsafeLedgerTarget = false;
  if (directorySafe) {
    try {
      const target = await fs.lstat(ledgerPath);
      ledgerPresent = true;
      if (!target.isFile() || target.isSymbolicLink()) {
        unsafeLedgerTarget = true;
        blockers.push('ledger_target_unsafe');
      } else {
        currentFileBytes = target.size;
        if (!ownerOnlyPermissions(target.mode)) {
          permissionPolicySatisfied = false;
          blockers.push('ledger_permissions_unsafe');
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        unsafeLedgerTarget = true;
        blockers.push('ledger_target_unsafe');
      }
    }
    const retainedArchiveIndexes = await archiveIndexes(auditDirectory);
    archiveCount = retainedArchiveIndexes.length;
    if (retainedArchiveIndexes.some(index => index > archiveLimit)) {
      blockers.push('archive_retention_exceeded');
    }
    for (const index of retainedArchiveIndexes) {
      try {
        const target = await fs.lstat(`${ledgerPath}.${index}`);
        if (!target.isFile() || target.isSymbolicLink()) {
          unsafeLedgerTarget = true;
          if (!blockers.includes('archive_target_unsafe')) blockers.push('archive_target_unsafe');
        } else if (!ownerOnlyPermissions(target.mode)) {
          permissionPolicySatisfied = false;
          if (!blockers.includes('archive_permissions_unsafe')) blockers.push('archive_permissions_unsafe');
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          unsafeLedgerTarget = true;
          if (!blockers.includes('archive_target_unsafe')) blockers.push('archive_target_unsafe');
        }
      }
    }
  }

  let lockStatus: AttemptAuditReadiness['lock_status'] = 'absent';
  if (directorySafe && storageInitialized) {
    const lockPath = `${ledgerPath}.lock`;
    try {
      const target = await fs.lstat(lockPath);
      if (!target.isFile() || target.isSymbolicLink() || !await validLockRecord(lockPath)) {
        lockStatus = 'invalid';
        blockers.push('ledger_lock_invalid');
      } else if (!ownerOnlyPermissions(target.mode)) {
        permissionPolicySatisfied = false;
        lockStatus = 'invalid';
        blockers.push('ledger_lock_permissions_unsafe');
      } else if (Date.now() - target.mtimeMs >= integerEnvironment(
        'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS',
        30_000,
        10,
        3_600_000,
      )) {
        lockStatus = 'expired_recoverable';
        warnings.push('expired_lock_will_be_recovered_on_next_attempt');
      } else {
        lockStatus = 'active';
        blockers.push('ledger_lock_active');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        lockStatus = 'invalid';
        blockers.push('ledger_lock_invalid');
      }
    }
  }

  const permissionTargetUnsafe = blockers.includes('ledger_permissions_unsafe')
    || blockers.includes('archive_permissions_unsafe');
  if (audit.invalidLineCount > 0 && !unsafeLedgerTarget && !permissionTargetUnsafe) {
    blockers.push('ledger_history_invalid');
  }
  const historyIntegrity: AttemptAuditReadiness['history_integrity'] = unsafeLedgerTarget
    || blockers.includes('archive_retention_exceeded')
    || audit.invalidLineCount > 0
    ? 'invalid'
    : ledgerPresent || archiveCount > 0
      ? 'valid'
      : 'unavailable';
  if (historyIntegrity === 'unavailable') warnings.push('history_starts_with_first_valid_canonical_request');
  const readyForNextAttempt = blockers.length === 0;
  const actionByBlocker: Record<AttemptAuditReadinessBlocker, AttemptAuditOperatorAction> = {
    audit_parent_not_writable: 'review_audit_parent_permissions_after_backup',
    audit_directory_unsafe: 'review_audit_directory_safety_after_backup',
    audit_directory_not_writable: 'review_audit_directory_permissions_after_backup',
    audit_directory_permissions_unsafe: 'review_audit_directory_permissions_after_backup',
    ledger_target_unsafe: 'review_ledger_target_safety_after_backup',
    ledger_permissions_unsafe: 'review_ledger_permissions_after_backup',
    archive_target_unsafe: 'review_archive_target_safety_after_backup',
    archive_permissions_unsafe: 'review_archive_permissions_after_backup',
    archive_retention_exceeded: 'review_archive_retention_after_backup',
    ledger_history_invalid: 'review_invalid_history_after_backup',
    ledger_lock_active: 'wait_for_active_writer_and_reinspect',
    ledger_lock_permissions_unsafe: 'review_lock_permissions_after_backup',
    ledger_lock_invalid: 'review_invalid_lock_after_backup',
  };
  const operatorActions = [...new Set(blockers.map(blocker => actionByBlocker[blocker]))];
  if (lockStatus === 'expired_recoverable') {
    operatorActions.push('reinspect_expired_lock_on_next_canonical_request');
  }
  return {
    schema_version: 'story-generation-attempt-audit-readiness/v1',
    status: readyForNextAttempt
      ? storageInitialized || ledgerPresent || archiveCount > 0 ? 'ready' : 'uninitialized'
      : 'blocked',
    storage_initialized: storageInitialized,
    ledger_present: ledgerPresent,
    archive_count: archiveCount,
    current_file_bytes: currentFileBytes,
    configured_max_bytes: integerEnvironment(
      'STORY_GENERATION_ATTEMPT_AUDIT_MAX_BYTES',
      1_048_576,
      256,
      1_073_741_824,
    ),
    configured_max_archives: archiveLimit,
    configured_lock_timeout_ms: integerEnvironment(
      'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_TIMEOUT_MS',
      5_000,
      10,
      60_000,
    ),
    configured_lock_retry_ms: integerEnvironment(
      'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_RETRY_MS',
      10,
      1,
      1_000,
    ),
    configured_lock_stale_ms: integerEnvironment(
      'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS',
      30_000,
      10,
      3_600_000,
    ),
    configuration_valid: configurationWarnings.length === 0,
    configuration_warnings: configurationWarnings,
    permission_policy: 'owner_only',
    permission_policy_satisfied: permissionPolicySatisfied,
    event_file_sync_required: true,
    no_follow_open_required: true,
    directory_entry_sync_guaranteed: true,
    lock_status: lockStatus,
    history_integrity: historyIntegrity,
    valid_event_count: audit.validEventCount,
    invalid_event_count: audit.invalidLineCount,
    ready_for_next_attempt: readyForNextAttempt,
    blockers,
    warnings,
    operator_actions: operatorActions.length > 0 ? operatorActions : ['no_action_required'],
    automatic_repair_allowed: false,
    destructive_action_performed: false,
    request_content_recorded: false,
    model_output_recorded: false,
    raw_exception_recorded: false,
    absolute_path_exposed: false,
  };
}

export async function inspectStoryGenerationActivity(
  options: InventoryOptions,
): Promise<StoryGenerationActivityEvidence> {
  const legacyRoot = options.legacyGeneratedRoot
    ?? path.resolve(options.generatedRoot, '..', 'web', 'generated');
  const [activeStories, activeProjects, reportRecords, legacyStories, legacyProjects, attemptAudit] = await Promise.all([
    stories(options.generatedRoot),
    projects(options.generatedRoot),
    reports(options.kbRoot),
    stories(legacyRoot),
    projects(legacyRoot),
    attempts(options.generatedRoot),
  ]);
  const latestStory = latest(activeStories, item => item.created_at);
  const latestProjectVersion = latest(activeProjects.versions, item => item.created_at);
  const latestReport = latest(reportRecords, item => item.generated_at);
  const legacyLatestStory = latest(legacyStories, item => item.created_at);
  const latestGenerationAttempt = latest(attemptAudit.records, item => item.started_at);
  const attemptAuditReadiness = await attemptReadiness(options.generatedRoot, attemptAudit);
  const revisionsAfterLatestStory = latestStory
    ? activeProjects.versions.filter(item => item.change_type !== 'initial_generation' && item.created_at > latestStory.created_at)
    : [];
  const reportsAfterLatestStory = latestStory
    ? reportRecords.filter(item => item.generated_at > latestStory.created_at)
    : [];
  const storageRootSwitchDetected = Boolean(legacyLatestStory
    && (!latestStory || legacyLatestStory.created_at > latestStory.created_at));
  const projectRevisionOnlyActivityDetected = revisionsAfterLatestStory.length > 0;
  const reportOnlyActivityDetected = reportsAfterLatestStory.length > 0 && !projectRevisionOnlyActivityDetected;
  const activityKind: ActivityKind = projectRevisionOnlyActivityDetected
    ? 'project_revision'
    : reportOnlyActivityDetected
      ? 'report_only'
      : latestStory
        ? 'story_generation'
        : 'none';
  const successfulAttemptMatchesLatestStory = Boolean(
    latestGenerationAttempt?.status === 'succeeded'
      && latestGenerationAttempt.terminal_at
      && latestStory
      && latestGenerationAttempt.started_at <= latestStory.created_at
      && latestStory.created_at <= latestGenerationAttempt.terminal_at,
  );
  const durableAttemptHistoryAvailable = attemptAudit.available
    && attemptAuditReadiness.history_integrity === 'valid'
    && attemptAuditReadiness.lock_status !== 'active'
    && attemptAuditReadiness.lock_status !== 'invalid';
  const noGenerationRequestConfirmed = durableAttemptHistoryAvailable && successfulAttemptMatchesLatestStory;
  const generationPipelineFailureConfirmed = durableAttemptHistoryAvailable
    && latestGenerationAttempt?.status === 'failed';
  const generationAttemptIncompleteDetected = durableAttemptHistoryAvailable
    && latestGenerationAttempt?.status === 'started';
  const diagnosis: Diagnosis = activeProjects.pendingTransactionCount > 0
    ? 'pending_transaction_detected'
    : storageRootSwitchDetected
      ? 'storage_root_mismatch_detected'
      : !durableAttemptHistoryAvailable
        ? 'attempt_history_unavailable'
        : generationAttemptIncompleteDetected
          ? 'generation_attempt_incomplete'
          : generationPipelineFailureConfirmed
            ? 'generation_pipeline_failure_detected'
            : noGenerationRequestConfirmed
              ? 'no_generation_request_since_latest_success'
              : 'attempt_history_unavailable';
  const unresolvedPossibilities: StoryGenerationActivityEvidence['unresolved_possibilities'] = generationAttemptIncompleteDetected
    ? ['generation_request_in_progress_or_interrupted']
    : durableAttemptHistoryAvailable && (generationPipelineFailureConfirmed || noGenerationRequestConfirmed)
      ? []
      : ['no_generation_request_submitted', 'generation_request_failed_before_persistence'];

  return {
    schema_version: 'story-agent-generation-activity/v1',
    generated_at: (options.now ?? new Date()).toISOString(),
    diagnosis,
    latest_persisted_activity_kind: activityKind,
    latest_story: latestStory,
    latest_project_version: latestProjectVersion,
    latest_report: latestReport,
    legacy_latest_story: legacyLatestStory,
    latest_generation_attempt: latestGenerationAttempt,
    attempt_audit_readiness: attemptAuditReadiness,
    summary: {
      story_count: activeStories.length,
      project_count: activeProjects.projectCount,
      version_count: activeProjects.versions.length,
      report_count: reportRecords.length,
      project_revision_after_latest_story_count: revisionsAfterLatestStory.length,
      report_after_latest_story_count: reportsAfterLatestStory.length,
      pending_transaction_count: activeProjects.pendingTransactionCount,
      legacy_story_count: legacyStories.length,
      legacy_project_count: legacyProjects.projectCount,
      generation_attempt_count: attemptAudit.records.length,
      generation_attempt_succeeded_count: attemptAudit.records.filter(attempt => attempt.status === 'succeeded').length,
      generation_attempt_failed_count: attemptAudit.records.filter(attempt => attempt.status === 'failed').length,
      generation_attempt_incomplete_count: attemptAudit.records.filter(attempt => attempt.status === 'started').length,
      generation_attempt_invalid_event_count: attemptAudit.invalidLineCount,
    },
    signals: {
      durable_generation_attempt_history_available: durableAttemptHistoryAvailable,
      generation_attempt_audit_ready_for_next_request: attemptAuditReadiness.ready_for_next_attempt,
      no_generation_request_confirmed: noGenerationRequestConfirmed,
      generation_pipeline_failure_confirmed: generationPipelineFailureConfirmed,
      generation_attempt_incomplete_detected: generationAttemptIncompleteDetected,
      storage_root_switch_detected: storageRootSwitchDetected,
      report_only_activity_detected: reportOnlyActivityDetected,
      project_revision_only_activity_detected: projectRevisionOnlyActivityDetected,
    },
    unresolved_possibilities: unresolvedPossibilities,
    safety: { read_only: true, generated_files_modified: false, model_invoked: false },
    notes: [
      'Successful generation, project revision and report activity are separated by semantic timestamps.',
      durableAttemptHistoryAvailable
        ? 'The durable Web generation-attempt ledger distinguishes the latest successful, failed, or incomplete canonical request without storing request or output content.'
        : 'No valid durable generation-attempt history exists; no request and pre-persistence failure remain unresolved.',
      'Legacy storage is inspection-only and is never merged or selected by this diagnostic.',
      'No model invocation or generated write is performed.',
    ],
  };
}
