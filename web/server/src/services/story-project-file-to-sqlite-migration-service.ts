import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, constants } from 'node:fs';
import {
  access,
  link,
  lstat,
  open,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { ProductAccessActor } from '@shared/product-access.js';
import type {
  StoryProjectFileToSqliteMigrationManifest,
  StoryProjectFileToSqliteMigrationPreflight,
  StoryProjectFileToSqliteMigrationRequest,
  StoryProjectFileToSqliteMigrationResult,
} from '@shared/types.js';
import {
  FileProjectRepository,
  type ProjectRepositoryLogicalStateInspection,
} from '../repositories/project-repository.js';
import {
  isNodeSqliteRuntimeAvailable,
  SqliteProjectRepository,
} from '../repositories/sqlite-project-repository.js';
import { storyGeneratedRoot } from '../platform/story-storage.js';
import { inspectDurableAuditPath } from './product-access-service.js';

const TARGET_PATH_ENV = 'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_TARGET_PATH';
const WRITE_ENABLED_ENV = 'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_WRITE_ENABLED';
const AUDIT_JSONL_ENV = 'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_AUDIT_JSONL';

interface SourceInspection {
  inspection: ProjectRepositoryLogicalStateInspection | null;
  blockers: string[];
}

interface TargetInspection {
  configured: boolean;
  path: string | null;
  manifestPath: string | null;
  exists: boolean;
  manifestExists: boolean;
  blockers: string[];
}

function sourceRoot(): string {
  return resolve(storyGeneratedRoot(), 'projects');
}

function booleanEnvironment(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function pathState(path: string): Promise<'missing' | 'file' | 'directory' | 'symlink' | 'other'> {
  try {
    const state = await lstat(path);
    if (state.isSymbolicLink()) return 'symlink';
    if (state.isFile()) return 'file';
    if (state.isDirectory()) return 'directory';
    return 'other';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    return 'other';
  }
}

async function inspectSource(): Promise<SourceInspection> {
  try {
    const inspection = await new FileProjectRepository(sourceRoot()).inspectLogicalStateReadOnly();
    return {
      inspection,
      blockers: inspection.project_count > 0 && inspection.version_count > 0
        ? []
        : ['file_repository_source_empty'],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return {
      inspection: null,
      blockers: [message.includes('pending transactions')
        ? 'file_repository_pending_transactions_present'
        : 'file_repository_logical_state_invalid'],
    };
  }
}

async function inspectTarget(): Promise<TargetInspection> {
  const configuredValue = process.env[TARGET_PATH_ENV]?.trim() ?? '';
  if (!configuredValue) {
    return {
      configured: false,
      path: null,
      manifestPath: null,
      exists: false,
      manifestExists: false,
      blockers: ['sqlite_migration_target_path_missing'],
    };
  }
  if (!isAbsolute(configuredValue)) {
    return {
      configured: true,
      path: null,
      manifestPath: null,
      exists: false,
      manifestExists: false,
      blockers: ['sqlite_migration_target_path_not_absolute'],
    };
  }
  const path = resolve(configuredValue);
  const manifestPath = `${path}.migration.json`;
  const [targetState, manifestState, parentState] = await Promise.all([
    pathState(path),
    pathState(manifestPath),
    pathState(dirname(path)),
  ]);
  const blockers: string[] = [];
  if (targetState !== 'missing' && targetState !== 'file') {
    blockers.push(targetState === 'symlink'
      ? 'sqlite_migration_target_symlink_forbidden'
      : 'sqlite_migration_target_not_regular_file');
  }
  if (manifestState !== 'missing' && manifestState !== 'file') {
    blockers.push(manifestState === 'symlink'
      ? 'sqlite_migration_manifest_symlink_forbidden'
      : 'sqlite_migration_manifest_not_regular_file');
  }
  if (parentState !== 'directory') {
    blockers.push(parentState === 'symlink'
      ? 'sqlite_migration_target_parent_symlink_forbidden'
      : 'sqlite_migration_target_parent_missing');
  } else {
    try {
      await access(dirname(path), constants.W_OK);
    } catch {
      blockers.push('sqlite_migration_target_parent_not_writable');
    }
  }
  const exists = targetState === 'file';
  const manifestExists = manifestState === 'file';
  if (manifestExists && !exists) blockers.push('sqlite_migration_orphan_manifest_present');
  return {
    configured: true,
    path,
    manifestPath,
    exists,
    manifestExists,
    blockers,
  };
}

export async function getStoryProjectFileToSqliteMigrationPreflight(
): Promise<StoryProjectFileToSqliteMigrationPreflight> {
  const [source, target] = await Promise.all([inspectSource(), inspectTarget()]);
  const blockers = [
    ...source.blockers,
    ...target.blockers,
    ...(!isNodeSqliteRuntimeAvailable() ? ['sqlite_runtime_unavailable'] : []),
    ...(target.exists ? ['sqlite_migration_target_already_exists'] : []),
  ];
  const uniqueBlockers = [...new Set(blockers)];
  return {
    schema_version: 'story-project-file-to-sqlite-migration-preflight/v1',
    evaluated_at: new Date().toISOString(),
    source_provider: 'file',
    target_provider: 'sqlite',
    target_path_env: TARGET_PATH_ENV,
    target_path_configured: target.configured,
    target_path: target.path,
    target_exists: target.exists,
    source_project_count: source.inspection?.project_count ?? 0,
    source_version_count: source.inspection?.version_count ?? 0,
    source_logical_sha256: source.inspection?.logical_sha256 ?? null,
    blockers: uniqueBlockers,
    preflight_ready: uniqueBlockers.length === 0,
    source_pending_transactions_recovered: false,
    source_writeback_performed: false,
    target_write_performed: false,
    external_database: false,
    object_storage: false,
    production_recovery_drill_completed: false,
    production_persistence_ready: false,
    real_credit_granted: false,
  };
}

function isMigrationManifest(value: unknown): value is StoryProjectFileToSqliteMigrationManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.schema_version === 'story-project-file-to-sqlite-migration-manifest/v1'
    && typeof record.migration_id === 'string'
    && typeof record.created_at === 'string'
    && typeof record.requested_by_actor_id === 'string'
    && typeof record.requested_by_organization_id === 'string'
    && typeof record.review_reference === 'string'
    && Number.isSafeInteger(record.source_project_count)
    && Number.isSafeInteger(record.source_version_count)
    && typeof record.source_logical_sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(record.source_logical_sha256)
    && typeof record.target_logical_sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(record.target_logical_sha256)
    && typeof record.target_database_sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(record.target_database_sha256)
    && record.source_unchanged === true
    && record.destination_was_empty === true
    && record.history_overwrite_performed === false
    && record.active_provider_changed === false
    && record.external_database === false
    && record.object_storage === false
    && record.production_recovery_drill_completed === false
    && record.production_persistence_ready === false
    && record.real_credit_granted === false;
}

async function inspectReplay(input: {
  target: TargetInspection;
  source: ProjectRepositoryLogicalStateInspection;
  request: StoryProjectFileToSqliteMigrationRequest;
}): Promise<{ manifest: StoryProjectFileToSqliteMigrationManifest | null; blockers: string[] }> {
  const { target, source, request } = input;
  if (!target.path || !target.manifestPath || !target.exists || !target.manifestExists) {
    return { manifest: null, blockers: ['sqlite_migration_target_already_exists'] };
  }
  let manifest: StoryProjectFileToSqliteMigrationManifest;
  try {
    const parsed = JSON.parse(await readFile(target.manifestPath, 'utf8')) as unknown;
    if (!isMigrationManifest(parsed)) throw new Error('invalid manifest');
    manifest = parsed;
  } catch {
    return { manifest: null, blockers: ['sqlite_migration_existing_manifest_invalid'] };
  }
  if (
    manifest.migration_id !== request.migration_id
    || manifest.review_reference !== request.review_reference
    || manifest.source_logical_sha256 !== request.expected_source_logical_sha256
    || manifest.source_logical_sha256 !== source.logical_sha256
    || manifest.source_project_count !== source.project_count
    || manifest.source_version_count !== source.version_count
  ) {
    return { manifest: null, blockers: ['sqlite_migration_existing_target_request_mismatch'] };
  }
  try {
    const targetRepository = new SqliteProjectRepository(target.path);
    const inspection = await targetRepository.inspect();
    const databaseSha256 = sha256(await readFile(target.path));
    if (
      inspection.project_count !== source.project_count
      || inspection.version_count !== source.version_count
      || inspection.logical_sha256 !== source.logical_sha256
      || manifest.target_logical_sha256 !== inspection.logical_sha256
      || manifest.target_database_sha256 !== databaseSha256
    ) {
      return { manifest: null, blockers: ['sqlite_migration_existing_target_integrity_mismatch'] };
    }
  } catch {
    return { manifest: null, blockers: ['sqlite_migration_existing_target_invalid'] };
  }
  return { manifest, blockers: [] };
}

function appendAuditEvent(input: {
  path: string;
  phase: 'intent' | 'applied';
  request: StoryProjectFileToSqliteMigrationRequest;
  actor: ProductAccessActor;
  source: ProjectRepositoryLogicalStateInspection;
  targetPath: string;
  targetLogicalSha256: string | null;
  targetDatabaseSha256: string | null;
}): boolean {
  try {
    appendFileSync(input.path, `${JSON.stringify({
      schema_version: 'story-project-file-to-sqlite-migration-audit-event/v1',
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      phase: input.phase,
      migration_id: input.request.migration_id,
      requested_by_actor_id: input.actor.actor_id,
      requested_by_organization_id: input.actor.organization_id,
      review_reference: input.request.review_reference,
      source_provider: 'file',
      target_provider: 'sqlite',
      source_project_count: input.source.project_count,
      source_version_count: input.source.version_count,
      source_logical_sha256: input.source.logical_sha256,
      target_path: input.targetPath,
      target_logical_sha256: input.targetLogicalSha256,
      target_database_sha256: input.targetDatabaseSha256,
      source_unchanged: true,
      destination_was_empty: true,
      history_overwrite_performed: false,
      active_provider_changed: false,
      machine_validation_only: true,
      production_recovery_drill_completed: false,
      production_persistence_ready: false,
      real_credit_granted: false,
    })}\n`, { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

async function syncFile(path: string): Promise<void> {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function cleanupOwnedPaths(paths: string[]): Promise<void> {
  for (const path of paths) {
    await unlink(path).catch(() => undefined);
  }
}

function resultBase(input: {
  request: StoryProjectFileToSqliteMigrationRequest;
  actor: ProductAccessActor;
  writeEnabled: boolean;
  source: SourceInspection;
  target: TargetInspection;
}): Omit<StoryProjectFileToSqliteMigrationResult,
  | 'blockers'
  | 'preflight_ready'
  | 'applied'
  | 'idempotent_replay'
  | 'target_logical_sha256'
  | 'target_database_sha256'
  | 'manifest'
  | 'durable_intent_written'
  | 'durable_completion_written'> {
  return {
    schema_version: 'story-project-file-to-sqlite-migration-result/v1',
    evaluated_at: new Date().toISOString(),
    migration_id: input.request.migration_id,
    requested_by_actor_id: input.actor.actor_id,
    dry_run: input.request.dry_run,
    write_enabled: input.writeEnabled,
    expected_source_logical_sha256: input.request.expected_source_logical_sha256,
    actual_source_logical_sha256: input.source.inspection?.logical_sha256 ?? null,
    source_project_count: input.source.inspection?.project_count ?? 0,
    source_version_count: input.source.inspection?.version_count ?? 0,
    target_path_configured: input.target.configured,
    target_path: input.target.path,
    target_existed_before: input.target.exists,
    manifest_path: input.target.manifestPath,
    source_pending_transactions_recovered: false,
    source_writeback_performed: false,
    source_unchanged: true,
    destination_was_empty: !input.target.exists,
    history_overwrite_performed: false,
    active_provider_changed: false,
    external_database: false,
    object_storage: false,
    production_recovery_drill_completed: false,
    production_persistence_ready: false,
    real_credit_granted: false,
  };
}

export async function migrateStoryProjectFileToSqlite(input: {
  request: StoryProjectFileToSqliteMigrationRequest;
  actor: ProductAccessActor;
}): Promise<StoryProjectFileToSqliteMigrationResult> {
  const { request, actor } = input;
  const writeEnabled = booleanEnvironment(WRITE_ENABLED_ENV);
  const [source, target] = await Promise.all([inspectSource(), inspectTarget()]);
  const base = resultBase({ request, actor, writeEnabled, source, target });
  const sourceInspection = source.inspection;
  const initialBlockers = [
    ...source.blockers,
    ...target.blockers,
    ...(!isNodeSqliteRuntimeAvailable() ? ['sqlite_runtime_unavailable'] : []),
    ...(actor.role !== 'administrator' ? ['sqlite_migration_administrator_required'] : []),
    ...(sourceInspection?.logical_sha256 !== request.expected_source_logical_sha256
      ? ['file_repository_logical_sha256_conflict']
      : []),
  ];

  if (sourceInspection && target.exists && initialBlockers.length === 0) {
    const replay = await inspectReplay({ target, source: sourceInspection, request });
    if (replay.manifest) {
      return {
        ...base,
        blockers: [],
        preflight_ready: true,
        applied: false,
        idempotent_replay: true,
        target_logical_sha256: replay.manifest.target_logical_sha256,
        target_database_sha256: replay.manifest.target_database_sha256,
        manifest: replay.manifest,
        durable_intent_written: false,
        durable_completion_written: false,
      };
    }
    initialBlockers.push(...replay.blockers);
  } else if (target.exists) {
    initialBlockers.push('sqlite_migration_target_already_exists');
  }

  const auditPath = process.env[AUDIT_JSONL_ENV]?.trim() ?? '';
  const audit = inspectDurableAuditPath(auditPath);
  if (!request.dry_run) {
    if (!writeEnabled) initialBlockers.push('sqlite_migration_write_disabled');
    if (!audit.configured) initialBlockers.push('sqlite_migration_audit_missing');
    else if (!audit.writable) {
      initialBlockers.push(...audit.issues.map(issue => `sqlite_migration_${issue}`));
    }
  }
  const blockers = [...new Set(initialBlockers)];
  if (request.dry_run || blockers.length > 0 || !sourceInspection || !target.path || !target.manifestPath) {
    return {
      ...base,
      blockers,
      preflight_ready: blockers.length === 0,
      applied: false,
      idempotent_replay: false,
      target_logical_sha256: null,
      target_database_sha256: null,
      manifest: null,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }

  const lockPath = `${target.path}.migration.lock`;
  const stagingPath = `${target.path}.migration-${process.pid}-${randomUUID()}.staging.sqlite3`;
  const candidatePath = `${target.path}.migration-${process.pid}-${randomUUID()}.candidate.sqlite3`;
  const manifestTemporaryPath = `${target.manifestPath}.${process.pid}-${randomUUID()}.tmp`;
  const ownedPaths = [
    stagingPath,
    `${stagingPath}-wal`,
    `${stagingPath}-shm`,
    candidatePath,
    `${candidatePath}-wal`,
    `${candidatePath}-shm`,
    manifestTemporaryPath,
  ];
  let lockHandle: Awaited<ReturnType<typeof open>> | null = null;
  let durableIntentWritten = false;
  let durableCompletionWritten = false;
  let targetPublished = false;
  let manifestPublished = false;
  let manifest: StoryProjectFileToSqliteMigrationManifest | null = null;
  let targetLogicalSha256: string | null = null;
  let targetDatabaseSha256: string | null = null;
  let failureBlocker: string | null = null;
  try {
    try {
      lockHandle = await open(lockPath, 'wx', 0o600);
    } catch {
      failureBlocker = 'sqlite_migration_concurrent_operation';
      return {
        ...base,
        blockers: [failureBlocker],
        preflight_ready: false,
        applied: false,
        idempotent_replay: false,
        target_logical_sha256: null,
        target_database_sha256: null,
        manifest: null,
        durable_intent_written: false,
        durable_completion_written: false,
      };
    }
    const lockedTarget = await inspectTarget();
    if (lockedTarget.exists || lockedTarget.manifestExists || lockedTarget.blockers.length > 0) {
      failureBlocker = 'sqlite_migration_destination_changed_before_write';
      throw new Error(failureBlocker);
    }
    const lockedSource = await inspectSource();
    if (
      !lockedSource.inspection
      || lockedSource.blockers.length > 0
      || lockedSource.inspection.logical_sha256 !== sourceInspection.logical_sha256
    ) {
      failureBlocker = 'file_repository_changed_before_write';
      throw new Error(failureBlocker);
    }
    durableIntentWritten = appendAuditEvent({
      path: auditPath,
      phase: 'intent',
      request,
      actor,
      source: lockedSource.inspection,
      targetPath: target.path,
      targetLogicalSha256: null,
      targetDatabaseSha256: null,
    });
    if (!durableIntentWritten) {
      failureBlocker = 'sqlite_migration_intent_audit_write_failed';
      throw new Error(failureBlocker);
    }

    const stagingRepository = new SqliteProjectRepository(stagingPath);
    const stagingInspection = await stagingRepository.importLogicalStateIntoEmpty(
      lockedSource.inspection.state,
    );
    const backup = await stagingRepository.createVerifiedBackup(candidatePath);
    targetLogicalSha256 = backup.logical_sha256;
    targetDatabaseSha256 = backup.backup_sha256;
    if (
      stagingInspection.logical_sha256 !== lockedSource.inspection.logical_sha256
      || backup.logical_sha256 !== lockedSource.inspection.logical_sha256
      || backup.project_count !== lockedSource.inspection.project_count
      || backup.version_count !== lockedSource.inspection.version_count
    ) {
      failureBlocker = 'sqlite_migration_logical_equivalence_failed';
      throw new Error(failureBlocker);
    }
    const finalSource = await inspectSource();
    if (
      !finalSource.inspection
      || finalSource.blockers.length > 0
      || finalSource.inspection.logical_sha256 !== lockedSource.inspection.logical_sha256
    ) {
      failureBlocker = 'file_repository_changed_during_migration';
      throw new Error(failureBlocker);
    }

    manifest = {
      schema_version: 'story-project-file-to-sqlite-migration-manifest/v1',
      migration_id: request.migration_id,
      created_at: new Date().toISOString(),
      requested_by_actor_id: actor.actor_id,
      requested_by_organization_id: actor.organization_id,
      review_reference: request.review_reference,
      source_project_count: finalSource.inspection.project_count,
      source_version_count: finalSource.inspection.version_count,
      source_logical_sha256: finalSource.inspection.logical_sha256,
      target_logical_sha256: backup.logical_sha256,
      target_database_sha256: backup.backup_sha256,
      source_unchanged: true,
      destination_was_empty: true,
      history_overwrite_performed: false,
      active_provider_changed: false,
      external_database: false,
      object_storage: false,
      production_recovery_drill_completed: false,
      production_persistence_ready: false,
      real_credit_granted: false,
    };
    await writeFile(manifestTemporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await Promise.all([syncFile(candidatePath), syncFile(manifestTemporaryPath)]);
    await link(candidatePath, target.path);
    targetPublished = true;
    await link(manifestTemporaryPath, target.manifestPath);
    manifestPublished = true;
    await Promise.all([syncFile(target.path), syncFile(target.manifestPath)]);
    const directoryHandle = await open(dirname(target.path), 'r');
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
    durableCompletionWritten = appendAuditEvent({
      path: auditPath,
      phase: 'applied',
      request,
      actor,
      source: finalSource.inspection,
      targetPath: target.path,
      targetLogicalSha256,
      targetDatabaseSha256,
    });
    if (!durableCompletionWritten) failureBlocker = 'sqlite_migration_completion_audit_write_failed';
  } catch {
    if (!failureBlocker) failureBlocker = 'sqlite_migration_write_failed';
  } finally {
    await cleanupOwnedPaths(ownedPaths);
    if (lockHandle) await lockHandle.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
  }
  const applied = targetPublished && manifestPublished;
  return {
    ...base,
    blockers: failureBlocker ? [failureBlocker] : [],
    preflight_ready: true,
    applied,
    idempotent_replay: false,
    target_logical_sha256: targetLogicalSha256,
    target_database_sha256: targetDatabaseSha256,
    manifest: manifestPublished ? manifest : null,
    durable_intent_written: durableIntentWritten,
    durable_completion_written: durableCompletionWritten,
  };
}
