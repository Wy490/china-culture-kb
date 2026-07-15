import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { hostname } from 'node:os';
import type {
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import { ErrorCodes } from '@shared/types.js';

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,240}$/;
const VERSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,280}$/;
const TRANSACTION_ID_PATTERN = /^[a-f0-9-]{36}$/;

type ProjectRepositoryTransactionOperation = 'create_initial' | 'commit_version' | 'write_current_state';
type ProjectRepositoryFaultPoint = 'after_intent' | 'after_snapshot' | 'after_meta';

interface ProjectRepositoryTransactionIntent {
  schema_version: 'story-agent-project-repository-transaction/v1';
  transaction_id: string;
  operation: ProjectRepositoryTransactionOperation;
  created_at: string;
  project_id: string;
  expected: ProjectVersionExpectation | ProjectMetaExpectation | null;
  previous_meta_sha256: string | null;
  previous_snapshot_sha256: string | null;
  target_meta_sha256: string;
  target_snapshot_sha256: string;
  meta: StoryProjectMeta;
  snapshot: StoryProjectVersionSnapshot;
  archive_deletion_performed: false;
}

interface ProjectRepositoryLockRecord {
  schema_version: 'story-agent-project-repository-lock/v1';
  owner_pid: number;
  owner_host: string;
  acquired_at: string;
  nonce: string;
}

export interface FileProjectRepositoryOptions {
  faultInjector?: (point: ProjectRepositoryFaultPoint) => void | Promise<void>;
}

export class ProjectRepositoryConflictError extends Error {
  readonly code = ErrorCodes.PROJECT_WRITE_CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'ProjectRepositoryConflictError';
  }
}

export class InvalidProjectRepositoryIdentifierError extends Error {
  readonly code = ErrorCodes.PROJECT_REPOSITORY_IDENTIFIER_INVALID;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidProjectRepositoryIdentifierError';
  }
}

export interface ProjectVersionExpectation {
  current_version_id: string;
  version_count: number;
}

export interface ProjectMetaExpectation extends ProjectVersionExpectation {
  updated_at: string;
}

export interface ProjectRepository {
  listProjectIds(): Promise<string[]>;
  readMeta(projectId: string): Promise<StoryProjectMeta | null>;
  readVersion(projectId: string, versionId: string): Promise<StoryProjectVersionSnapshot | null>;
  readVersionSnapshots(projectId: string): Promise<StoryProjectVersionSnapshot[]>;
  createInitial(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
  ): Promise<'created' | 'exists'>;
  commitVersion(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
    expected: ProjectMetaExpectation,
  ): Promise<void>;
  writeMeta(meta: StoryProjectMeta, expected: ProjectMetaExpectation): Promise<void>;
  writeCurrentState(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
    expected: ProjectMetaExpectation,
  ): Promise<void>;
}

function validProjectId(projectId: string): boolean {
  return PROJECT_ID_PATTERN.test(projectId);
}

function validVersionId(projectId: string, versionId: string): boolean {
  return VERSION_ID_PATTERN.test(versionId) && versionId.startsWith(`${projectId}-v`);
}

function jsonSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isProjectVersionExpectation(value: unknown): value is ProjectVersionExpectation {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  return Boolean(
    record
    && typeof record.current_version_id === 'string'
    && Number.isSafeInteger(record.version_count)
    && Number(record.version_count) >= 1,
  );
}

function isProjectMetaExpectation(value: unknown): value is ProjectMetaExpectation {
  return isProjectVersionExpectation(value)
    && typeof (value as ProjectMetaExpectation).updated_at === 'string'
    && Number.isFinite(Date.parse((value as ProjectMetaExpectation).updated_at));
}

export class FileProjectRepository implements ProjectRepository {
  constructor(
    private readonly root: string,
    private readonly options: FileProjectRepositoryOptions = {},
  ) {}

  async listProjectIds(): Promise<string[]> {
    try {
      const entries = await readdir(this.root, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && validProjectId(entry.name))
        .map(entry => entry.name)
        .sort();
    } catch {
      return [];
    }
  }

  async readMeta(projectId: string): Promise<StoryProjectMeta | null> {
    if (!validProjectId(projectId)) return null;
    await this.recoverPendingTransactions(projectId);
    return this.readJson<StoryProjectMeta>(this.metaPath(projectId));
  }

  async readVersion(projectId: string, versionId: string): Promise<StoryProjectVersionSnapshot | null> {
    if (!validProjectId(projectId) || !validVersionId(projectId, versionId)) return null;
    await this.recoverPendingTransactions(projectId);
    return this.readJson<StoryProjectVersionSnapshot>(this.versionPath(projectId, versionId));
  }

  async readVersionSnapshots(projectId: string): Promise<StoryProjectVersionSnapshot[]> {
    if (!validProjectId(projectId)) return [];
    await this.recoverPendingTransactions(projectId);
    let files: string[];
    try {
      const directory = this.versionsDirectory(projectId);
      const target = await lstat(directory);
      if (!target.isDirectory() || target.isSymbolicLink()) return [];
      files = await readdir(directory);
    } catch {
      return [];
    }
    const snapshots = (
      await Promise.all(files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const versionId = file.slice(0, -'.json'.length);
          return validVersionId(projectId, versionId)
            ? this.readJson<StoryProjectVersionSnapshot>(this.versionPath(projectId, versionId))
            : null;
        }))
    ).filter((snapshot): snapshot is StoryProjectVersionSnapshot => snapshot !== null);
    return snapshots.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async createInitial(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
  ): Promise<'created' | 'exists'> {
    this.assertMetaAndSnapshot(meta, snapshot);
    await this.recoverPendingTransactions(meta.project_id);
    return this.withProjectLock(meta.project_id, async () => {
      const metaPath = this.metaPath(meta.project_id);
      if (await this.pathExists(metaPath)) {
        if (await this.readMeta(meta.project_id)) return 'exists';
        await this.archiveUnreadableFile(metaPath, 'metadata');
        const initialVersionPath = this.versionPath(meta.project_id, snapshot.version_id);
        if (await this.pathExists(initialVersionPath)) {
          await this.archiveUnreadableFile(initialVersionPath, 'initial-version');
        }
      }
      const initialVersionPath = this.versionPath(meta.project_id, snapshot.version_id);
      if (await this.pathExists(initialVersionPath)) {
        await this.archiveUnreadableFile(initialVersionPath, 'orphan-initial-version');
      }
      await this.writePairWithIntent(meta, snapshot, 'create_initial', null);
      return 'created';
    });
  }

  async commitVersion(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
    expected: ProjectMetaExpectation,
  ): Promise<void> {
    this.assertMetaAndSnapshot(meta, snapshot);
    this.assertUpdatedAtAdvance(meta, expected, 'version commit');
    await this.recoverPendingTransactions(meta.project_id);
    await this.withProjectLock(meta.project_id, async () => {
      const current = await this.readJson<StoryProjectMeta>(this.metaPath(meta.project_id));
      if (
        !current
        || current.updated_at !== expected.updated_at
        || current.current_version_id !== expected.current_version_id
        || current.version_count !== expected.version_count
      ) {
        throw new ProjectRepositoryConflictError(
          `Project "${meta.project_id}" changed before version commit`,
        );
      }
      if (await this.pathExists(this.versionPath(meta.project_id, snapshot.version_id))) {
        throw new ProjectRepositoryConflictError(
          `Project version "${snapshot.version_id}" already exists`,
        );
      }
      await this.writePairWithIntent(meta, snapshot, 'commit_version', expected);
    });
  }

  async writeMeta(meta: StoryProjectMeta, expected: ProjectMetaExpectation): Promise<void> {
    this.assertProjectId(meta.project_id);
    this.assertUpdatedAtAdvance(meta, expected, 'metadata write');
    await this.recoverPendingTransactions(meta.project_id);
    await this.withProjectLock(meta.project_id, async () => {
      await this.assertMetaExpectation(meta.project_id, expected);
      await this.writeJsonAtomic(this.metaPath(meta.project_id), meta);
    });
  }

  async writeCurrentState(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
    expected: ProjectMetaExpectation,
  ): Promise<void> {
    this.assertMetaAndSnapshot(meta, snapshot);
    this.assertUpdatedAtAdvance(meta, expected, 'current-state write');
    await this.recoverPendingTransactions(meta.project_id);
    await this.withProjectLock(meta.project_id, async () => {
      await this.assertCurrentStateExpectation(meta.project_id, expected);
      await this.writePairWithIntent(meta, snapshot, 'write_current_state', expected);
    });
  }

  private projectDirectory(projectId: string): string {
    return resolve(this.root, projectId);
  }

  private metaPath(projectId: string): string {
    return resolve(this.projectDirectory(projectId), 'project.json');
  }

  private versionsDirectory(projectId: string): string {
    return resolve(this.projectDirectory(projectId), 'versions');
  }

  private versionPath(projectId: string, versionId: string): string {
    return resolve(this.versionsDirectory(projectId), `${versionId}.json`);
  }

  private lockPath(projectId: string): string {
    return resolve(this.projectDirectory(projectId), '.project-repository.lock');
  }

  private transactionsDirectory(projectId: string): string {
    return resolve(this.projectDirectory(projectId), '.transactions');
  }

  private transactionIntentPath(projectId: string, transactionId: string): string {
    return resolve(this.transactionsDirectory(projectId), `${transactionId}.intent.json`);
  }

  private transactionAppliedPath(projectId: string, transactionId: string): string {
    return resolve(this.transactionsDirectory(projectId), `${transactionId}.applied.json`);
  }

  private assertProjectId(projectId: string): void {
    if (!validProjectId(projectId)) {
      throw new InvalidProjectRepositoryIdentifierError(`Invalid project id "${projectId}"`);
    }
  }

  private assertVersion(projectId: string, versionId: string): void {
    this.assertProjectId(projectId);
    if (!validVersionId(projectId, versionId)) {
      throw new InvalidProjectRepositoryIdentifierError(`Invalid project version id "${versionId}"`);
    }
  }

  private assertMetaAndSnapshot(meta: StoryProjectMeta, snapshot: StoryProjectVersionSnapshot): void {
    this.assertVersion(meta.project_id, snapshot.version_id);
    if (
      snapshot.project_id !== meta.project_id
      || meta.current_version_id !== snapshot.version_id
    ) {
      throw new InvalidProjectRepositoryIdentifierError('Project metadata and snapshot identifiers do not match');
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await lstat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async readJson<T>(path: string): Promise<T | null> {
    try {
      const target = await lstat(path);
      if (!target.isFile() || target.isSymbolicLink()) return null;
      return JSON.parse(await readFile(path, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private async writeJsonAtomic(path: string, value: unknown): Promise<void> {
    const directory = resolve(path, '..');
    await mkdir(directory, { recursive: true });
    const directoryTarget = await lstat(directory);
    if (!directoryTarget.isDirectory() || directoryTarget.isSymbolicLink()) {
      throw new InvalidProjectRepositoryIdentifierError(`Unsafe project repository directory "${directory}"`);
    }
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    let temporaryFile: Awaited<ReturnType<typeof open>> | null = null;
    try {
      temporaryFile = await open(temporaryPath, 'wx', 0o600);
      await temporaryFile.writeFile(JSON.stringify(value, null, 2), 'utf8');
      await temporaryFile.sync();
      await temporaryFile.close();
      temporaryFile = null;
      await rename(temporaryPath, path);
      await this.syncDirectory(directory);
    } finally {
      if (temporaryFile) {
        try {
          await temporaryFile.close();
        } catch {
          // The owned temporary path remains visible if closing fails.
        }
      }
      try {
        await unlink(temporaryPath);
      } catch {
        // Successful rename removes the temporary path; failed cleanup remains operator-visible.
      }
    }
  }

  private async archiveUnreadableFile(path: string, label: string): Promise<void> {
    const target = await lstat(path);
    if (!target.isFile() || target.isSymbolicLink()) {
      throw new InvalidProjectRepositoryIdentifierError(`Unsafe ${label} recovery target "${path}"`);
    }
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    await rename(path, `${path}.${timestamp}.${randomUUID()}.${label}.archive`);
    await this.syncDirectory(resolve(path, '..'));
  }

  private async syncDirectory(directory: string): Promise<void> {
    const handle = await open(directory, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  private async writePairWithIntent(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
    operation: ProjectRepositoryTransactionOperation,
    expected: ProjectVersionExpectation | ProjectMetaExpectation | null,
  ): Promise<void> {
    const metaPath = this.metaPath(meta.project_id);
    const snapshotPath = this.versionPath(meta.project_id, snapshot.version_id);
    const previousMeta = await this.readFileState(metaPath);
    const previousSnapshot = await this.readFileState(snapshotPath);
    if (operation === 'create_initial' && (previousMeta.exists || previousSnapshot.exists)) {
      throw new ProjectRepositoryConflictError(`Project "${meta.project_id}" initial state already exists`);
    }
    if (operation === 'commit_version' && (!previousMeta.exists || previousSnapshot.exists)) {
      throw new ProjectRepositoryConflictError(`Project "${meta.project_id}" version target is not append-only`);
    }
    if (operation === 'write_current_state' && (!previousMeta.exists || !previousSnapshot.exists)) {
      throw new ProjectRepositoryConflictError(`Project "${meta.project_id}" current state is incomplete`);
    }

    const transactionId = randomUUID();
    const intent: ProjectRepositoryTransactionIntent = {
      schema_version: 'story-agent-project-repository-transaction/v1',
      transaction_id: transactionId,
      operation,
      created_at: new Date().toISOString(),
      project_id: meta.project_id,
      expected,
      previous_meta_sha256: previousMeta.sha256,
      previous_snapshot_sha256: previousSnapshot.sha256,
      target_meta_sha256: jsonSha256(meta),
      target_snapshot_sha256: jsonSha256(snapshot),
      meta,
      snapshot,
      archive_deletion_performed: false,
    };
    const intentPath = this.transactionIntentPath(meta.project_id, transactionId);
    await this.writeJsonAtomic(intentPath, intent);
    await this.injectFault('after_intent');
    await this.writeJsonAtomic(snapshotPath, snapshot);
    await this.injectFault('after_snapshot');
    await this.writeJsonAtomic(metaPath, meta);
    await this.injectFault('after_meta');
    await this.markTransactionApplied(intentPath, meta.project_id, transactionId);
  }

  private async recoverPendingTransactions(projectId: string): Promise<void> {
    const transactionDirectory = this.transactionsDirectory(projectId);
    let pendingNames: string[];
    try {
      const target = await lstat(transactionDirectory);
      if (!target.isDirectory() || target.isSymbolicLink()) {
        throw new InvalidProjectRepositoryIdentifierError(
          `Unsafe project transaction directory "${transactionDirectory}"`,
        );
      }
      pendingNames = (await readdir(transactionDirectory))
        .filter(name => name.endsWith('.intent.json'))
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    if (pendingNames.length === 0) return;

    await this.withProjectLock(projectId, async () => {
      const currentPendingNames = (await readdir(transactionDirectory))
        .filter(name => name.endsWith('.intent.json'))
        .sort();
      for (const name of currentPendingNames) {
        const transactionId = name.slice(0, -'.intent.json'.length);
        if (!TRANSACTION_ID_PATTERN.test(transactionId)) {
          throw new ProjectRepositoryConflictError(`Invalid pending project transaction name "${name}"`);
        }
        const intentPath = this.transactionIntentPath(projectId, transactionId);
        const rawIntent = await this.readJson<unknown>(intentPath);
        const intent = this.parseTransactionIntent(rawIntent, projectId, transactionId);
        const metaState = await this.readFileState(this.metaPath(projectId));
        const snapshotState = await this.readFileState(
          this.versionPath(projectId, intent.snapshot.version_id),
        );
        this.assertRecoverableState(
          'metadata',
          metaState.sha256,
          intent.previous_meta_sha256,
          intent.target_meta_sha256,
        );
        this.assertRecoverableState(
          'snapshot',
          snapshotState.sha256,
          intent.previous_snapshot_sha256,
          intent.target_snapshot_sha256,
        );
        await this.writeJsonAtomic(
          this.versionPath(projectId, intent.snapshot.version_id),
          intent.snapshot,
        );
        await this.writeJsonAtomic(this.metaPath(projectId), intent.meta);
        await this.markTransactionApplied(intentPath, projectId, transactionId);
      }
    });
  }

  private parseTransactionIntent(
    value: unknown,
    projectId: string,
    transactionId: string,
  ): ProjectRepositoryTransactionIntent {
    const record = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
    const operation = record?.operation;
    const expected = record?.expected;
    const intent = record as unknown as ProjectRepositoryTransactionIntent;
    const valid = Boolean(
      record
      && record.schema_version === 'story-agent-project-repository-transaction/v1'
      && record.transaction_id === transactionId
      && record.project_id === projectId
      && (operation === 'create_initial' || operation === 'commit_version' || operation === 'write_current_state')
      && typeof record.created_at === 'string'
      && (
        operation === 'create_initial'
          ? expected === null
          : operation === 'write_current_state' || operation === 'commit_version'
            ? isProjectMetaExpectation(expected)
            : isProjectVersionExpectation(expected)
      )
      && (record.previous_meta_sha256 === null || /^[a-f0-9]{64}$/.test(String(record.previous_meta_sha256)))
      && (record.previous_snapshot_sha256 === null || /^[a-f0-9]{64}$/.test(String(record.previous_snapshot_sha256)))
      && typeof record.target_meta_sha256 === 'string'
      && /^[a-f0-9]{64}$/.test(record.target_meta_sha256)
      && typeof record.target_snapshot_sha256 === 'string'
      && /^[a-f0-9]{64}$/.test(record.target_snapshot_sha256)
      && record.archive_deletion_performed === false
      && record.meta && typeof record.meta === 'object' && !Array.isArray(record.meta)
      && record.snapshot && typeof record.snapshot === 'object' && !Array.isArray(record.snapshot)
    );
    if (!valid) {
      throw new ProjectRepositoryConflictError(`Pending project transaction "${transactionId}" is invalid`);
    }
    this.assertMetaAndSnapshot(intent.meta, intent.snapshot);
    if (
      jsonSha256(intent.meta) !== intent.target_meta_sha256
      || jsonSha256(intent.snapshot) !== intent.target_snapshot_sha256
    ) {
      throw new ProjectRepositoryConflictError(`Pending project transaction "${transactionId}" hash mismatch`);
    }
    return intent;
  }

  private assertRecoverableState(
    label: string,
    actual: string | null,
    previous: string | null,
    target: string,
  ): void {
    if (actual !== previous && actual !== target) {
      throw new ProjectRepositoryConflictError(
        `Pending project transaction found unexpected ${label} state`,
      );
    }
  }

  private async readFileState(path: string): Promise<{ exists: boolean; sha256: string | null }> {
    try {
      const target = await lstat(path);
      if (!target.isFile() || target.isSymbolicLink()) {
        throw new InvalidProjectRepositoryIdentifierError(`Unsafe project state file "${path}"`);
      }
      const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
      return { exists: true, sha256: jsonSha256(value) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false, sha256: null };
      if (error instanceof InvalidProjectRepositoryIdentifierError) throw error;
      throw new ProjectRepositoryConflictError(`Project state file "${path}" is unreadable`);
    }
  }

  private async markTransactionApplied(
    intentPath: string,
    projectId: string,
    transactionId: string,
  ): Promise<void> {
    const appliedPath = this.transactionAppliedPath(projectId, transactionId);
    if (await this.pathExists(appliedPath)) {
      throw new ProjectRepositoryConflictError(`Applied project transaction "${transactionId}" already exists`);
    }
    await rename(intentPath, appliedPath);
    await this.syncDirectory(this.transactionsDirectory(projectId));
  }

  private async injectFault(point: ProjectRepositoryFaultPoint): Promise<void> {
    await this.options.faultInjector?.(point);
  }

  private async assertCurrentStateExpectation(
    projectId: string,
    expected: ProjectMetaExpectation,
  ): Promise<void> {
    const current = await this.readJson<StoryProjectMeta>(this.metaPath(projectId));
    if (
      !current
      || current.updated_at !== expected.updated_at
      || current.current_version_id !== expected.current_version_id
      || current.version_count !== expected.version_count
    ) {
      throw new ProjectRepositoryConflictError(`Project "${projectId}" changed before current-state write`);
    }
  }

  private assertUpdatedAtAdvance(
    meta: StoryProjectMeta,
    expected: ProjectMetaExpectation,
    operation: string,
  ): void {
    if (
      !Number.isFinite(Date.parse(expected.updated_at))
      || !Number.isFinite(Date.parse(meta.updated_at))
      || Date.parse(meta.updated_at) <= Date.parse(expected.updated_at)
    ) {
      throw new ProjectRepositoryConflictError(
        `Project "${meta.project_id}" ${operation} timestamp did not advance`,
      );
    }
  }

  private async assertMetaExpectation(
    projectId: string,
    expected: ProjectMetaExpectation,
  ): Promise<void> {
    const current = await this.readJson<StoryProjectMeta>(this.metaPath(projectId));
    if (
      !current
      || current.updated_at !== expected.updated_at
      || current.current_version_id !== expected.current_version_id
      || current.version_count !== expected.version_count
    ) {
      throw new ProjectRepositoryConflictError(`Project "${projectId}" changed before metadata write`);
    }
  }

  private async withProjectLock<T>(
    projectId: string,
    action: () => Promise<T>,
    allowStaleRecovery = true,
  ): Promise<T> {
    this.assertProjectId(projectId);
    const directory = this.projectDirectory(projectId);
    await mkdir(directory, { recursive: true });
    const directoryTarget = await lstat(directory);
    if (!directoryTarget.isDirectory() || directoryTarget.isSymbolicLink()) {
      throw new InvalidProjectRepositoryIdentifierError(`Unsafe project repository directory "${directory}"`);
    }
    const lockPath = this.lockPath(projectId);
    let lock: Awaited<ReturnType<typeof open>> | null = null;
    try {
      lock = await open(lockPath, 'wx', 0o600);
      const lockRecord: ProjectRepositoryLockRecord = {
        schema_version: 'story-agent-project-repository-lock/v1',
        owner_pid: process.pid,
        owner_host: hostname(),
        acquired_at: new Date().toISOString(),
        nonce: randomUUID(),
      };
      await lock.writeFile(JSON.stringify(lockRecord), 'utf8');
      await lock.sync();
      return await action();
    } catch (error) {
      if (lock === null && (error as NodeJS.ErrnoException).code === 'EEXIST') {
        if (allowStaleRecovery && await this.archiveStaleOwnedLock(projectId, lockPath)) {
          return this.withProjectLock(projectId, action, false);
        }
        throw new ProjectRepositoryConflictError(`Project "${projectId}" is locked by another writer`);
      }
      throw error;
    } finally {
      if (lock) {
        let closed = false;
        try {
          await lock.close();
          closed = true;
        } catch {
          // Failure to close leaves the lock path in place and future writes fail closed.
        }
        if (closed) {
          try {
            await unlink(lockPath);
            await this.syncDirectory(directory);
          } catch {
            // A leftover owned lock fails future writes closed for operator recovery.
          }
        }
      }
    }
  }

  private async archiveStaleOwnedLock(projectId: string, lockPath: string): Promise<boolean> {
    const raw = await this.readJson<unknown>(lockPath);
    const record = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : null;
    if (
      !record
      || record.schema_version !== 'story-agent-project-repository-lock/v1'
      || typeof record.owner_pid !== 'number'
      || !Number.isSafeInteger(record.owner_pid)
      || record.owner_pid <= 0
      || record.owner_host !== hostname()
      || typeof record.acquired_at !== 'string'
      || typeof record.nonce !== 'string'
    ) {
      return false;
    }
    try {
      process.kill(record.owner_pid, 0);
      return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false;
    }
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    await rename(
      lockPath,
      `${lockPath}.${timestamp}.${randomUUID()}.stale-owner-${projectId}.archive`,
    );
    await this.syncDirectory(this.projectDirectory(projectId));
    return true;
  }
}
