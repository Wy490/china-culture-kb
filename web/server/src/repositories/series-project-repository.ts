import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from 'node:fs/promises';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import type { AiComicSeriesProjectDetail } from '@shared/types.js';
import { ErrorCodes } from '@shared/types.js';

const SERIES_PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,240}$/;

interface SeriesProjectRepositoryLockRecord {
  schema_version: 'story-agent-series-project-repository-lock/v1';
  owner_pid: number;
  owner_host: string;
  acquired_at: string;
  nonce: string;
}

export interface SeriesProjectExpectation {
  updated_at: string;
}

export interface SeriesProjectRepository {
  listProjectIds(): Promise<string[]>;
  read(seriesProjectId: string): Promise<AiComicSeriesProjectDetail | null>;
  create(detail: AiComicSeriesProjectDetail): Promise<'created' | 'exists'>;
  replace(detail: AiComicSeriesProjectDetail, expected: SeriesProjectExpectation): Promise<void>;
}

type SeriesProjectRepositoryFaultPoint = 'after_temp_fsync';

export interface FileSeriesProjectRepositoryOptions {
  fallback_roots?: readonly string[];
  fault_injector?: (point: SeriesProjectRepositoryFaultPoint) => void | Promise<void>;
}

export class SeriesProjectRepositoryConflictError extends Error {
  readonly code = ErrorCodes.SERIES_PROJECT_WRITE_CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'SeriesProjectRepositoryConflictError';
  }
}

export class SeriesProjectRepositoryPathError extends Error {
  readonly code = ErrorCodes.SERIES_PROJECT_IDENTIFIER_INVALID;

  constructor(message: string) {
    super(message);
    this.name = 'SeriesProjectRepositoryPathError';
  }
}

export class SeriesProjectRepositoryStateError extends Error {
  readonly code = ErrorCodes.SERIES_PROJECT_STORAGE_UNAVAILABLE;

  constructor(message: string) {
    super(message);
    this.name = 'SeriesProjectRepositoryStateError';
  }
}

export class FileSeriesProjectRepository implements SeriesProjectRepository {
  private readonly primaryRoot: string;
  private readonly roots: string[];

  constructor(
    primaryRoot: string,
    private readonly options: FileSeriesProjectRepositoryOptions = {},
  ) {
    this.primaryRoot = resolve(primaryRoot);
    this.roots = [...new Set([
      this.primaryRoot,
      ...(options.fallback_roots ?? []).map(root => resolve(root)),
    ])];
  }

  async listProjectIds(): Promise<string[]> {
    const ids = new Set<string>();
    for (const root of this.roots) {
      if (!(await this.ensureSafeDirectory(root, false))) continue;
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.isSymbolicLink() && validSeriesProjectId(entry.name)) {
          ids.add(entry.name);
        }
      }
    }
    return [...ids].sort();
  }

  async read(seriesProjectId: string): Promise<AiComicSeriesProjectDetail | null> {
    if (!validSeriesProjectId(seriesProjectId)) return null;
    const location = await this.findExistingLocation(seriesProjectId);
    return location ? this.readAt(location.filePath, seriesProjectId) : null;
  }

  async create(detail: AiComicSeriesProjectDetail): Promise<'created' | 'exists'> {
    const seriesProjectId = this.assertDetail(detail);
    if (await this.findExistingLocation(seriesProjectId)) return 'exists';
    await this.ensureSafeDirectory(this.primaryRoot, true);
    const directory = this.projectDirectory(this.primaryRoot, seriesProjectId);
    await this.ensureSafeDirectory(directory, true);
    const lock = await this.acquireLock(directory);
    try {
      if (await this.findExistingLocation(seriesProjectId)) return 'exists';
      await this.writeAtomic(this.projectFile(directory), detail);
      return 'created';
    } finally {
      await this.releaseOwnedLock(directory, lock);
    }
  }

  async replace(
    detail: AiComicSeriesProjectDetail,
    expected: SeriesProjectExpectation,
  ): Promise<void> {
    const seriesProjectId = this.assertDetail(detail);
    if (
      !Number.isFinite(Date.parse(expected.updated_at))
      || Date.parse(detail.project.updated_at) <= Date.parse(expected.updated_at)
    ) {
      throw new SeriesProjectRepositoryConflictError(
        `Series project "${seriesProjectId}" updated_at did not advance`,
      );
    }
    const location = await this.findExistingLocation(seriesProjectId);
    if (!location) {
      throw new SeriesProjectRepositoryConflictError(`Series project "${seriesProjectId}" no longer exists`);
    }
    const lock = await this.acquireLock(location.directory);
    try {
      const current = await this.readAt(location.filePath, seriesProjectId);
      if (!current || current.project.updated_at !== expected.updated_at) {
        throw new SeriesProjectRepositoryConflictError(
          `Series project "${seriesProjectId}" changed before write`,
        );
      }
      await this.writeAtomic(location.filePath, detail);
    } finally {
      await this.releaseOwnedLock(location.directory, lock);
    }
  }

  private assertDetail(detail: AiComicSeriesProjectDetail): string {
    const seriesProjectId = detail?.project?.series_project_id;
    if (!validSeriesProjectId(seriesProjectId)) {
      throw new SeriesProjectRepositoryPathError(`Invalid series project id "${seriesProjectId}"`);
    }
    if (
      typeof detail.project.updated_at !== 'string'
      || !Number.isFinite(Date.parse(detail.project.updated_at))
    ) {
      throw new SeriesProjectRepositoryStateError(
        `Series project "${seriesProjectId}" has an invalid updated_at`,
      );
    }
    return seriesProjectId;
  }

  private async findExistingLocation(seriesProjectId: string): Promise<{
    directory: string;
    filePath: string;
  } | null> {
    for (const root of this.roots) {
      if (!(await this.ensureSafeDirectory(root, false))) continue;
      const directory = this.projectDirectory(root, seriesProjectId);
      try {
        const directoryStat = await lstat(directory);
        if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
          throw new SeriesProjectRepositoryPathError(
            `Series project directory "${directory}" is not a regular directory`,
          );
        }
        const filePath = this.projectFile(directory);
        const fileStat = await lstat(filePath);
        if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
          throw new SeriesProjectRepositoryPathError(`Series project file "${filePath}" is not a regular file`);
        }
        return { directory, filePath };
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') continue;
        throw error;
      }
    }
    return null;
  }

  private async readAt(
    filePath: string,
    expectedSeriesProjectId: string,
  ): Promise<AiComicSeriesProjectDetail> {
    let detail: AiComicSeriesProjectDetail;
    try {
      detail = JSON.parse(await readFile(filePath, 'utf8')) as AiComicSeriesProjectDetail;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SeriesProjectRepositoryStateError(`Series project "${filePath}" is unreadable: ${message}`);
    }
    if (
      detail?.project?.series_project_id !== expectedSeriesProjectId
      || typeof detail.project.updated_at !== 'string'
      || !Number.isFinite(Date.parse(detail.project.updated_at))
    ) {
      throw new SeriesProjectRepositoryStateError(
        `Series project "${filePath}" has invalid identity metadata`,
      );
    }
    return detail;
  }

  private async ensureSafeDirectory(path: string, create: boolean): Promise<boolean> {
    try {
      const target = await lstat(path);
      if (target.isSymbolicLink() || !target.isDirectory()) {
        throw new SeriesProjectRepositoryPathError(`Series repository path "${path}" is not a regular directory`);
      }
      return true;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      if (!create) return false;
      await mkdir(path, { recursive: true, mode: 0o700 });
      const created = await lstat(path);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw new SeriesProjectRepositoryPathError(`Series repository path "${path}" is not a regular directory`);
      }
      return true;
    }
  }

  private async writeAtomic(filePath: string, detail: AiComicSeriesProjectDetail): Promise<void> {
    const directory = resolve(filePath, '..');
    const temporaryPath = resolve(directory, `.${randomUUID()}.series-project.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporaryPath, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(detail, null, 2), 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await this.options.fault_injector?.('after_temp_fsync');
      await rename(temporaryPath, filePath);
      await syncDirectory(directory);
    } finally {
      await handle?.close().catch(() => undefined);
      await unlink(temporaryPath).catch(error => {
        if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      });
    }
  }

  private async acquireLock(directory: string): Promise<SeriesProjectRepositoryLockRecord> {
    const lockPath = this.lockPath(directory);
    const record: SeriesProjectRepositoryLockRecord = {
      schema_version: 'story-agent-series-project-repository-lock/v1',
      owner_pid: process.pid,
      owner_host: hostname(),
      acquired_at: new Date().toISOString(),
      nonce: randomUUID(),
    };
    try {
      await this.createLock(lockPath, directory, record);
      return record;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') {
        const message = error instanceof Error ? error.message : String(error);
        throw new SeriesProjectRepositoryStateError(`Series writer lock could not be created: ${message}`);
      }
      if (!(await this.archiveDeadSameHostLock(lockPath, directory))) {
        throw new SeriesProjectRepositoryConflictError(`Series writer lock "${lockPath}" is held`);
      }
      try {
        await this.createLock(lockPath, directory, record);
        return record;
      } catch (retryError) {
        if (isNodeError(retryError) && retryError.code === 'EEXIST') {
          throw new SeriesProjectRepositoryConflictError(`Series writer lock "${lockPath}" is held`);
        }
        const message = retryError instanceof Error ? retryError.message : String(retryError);
        throw new SeriesProjectRepositoryStateError(`Series writer lock could not be recreated: ${message}`);
      }
    }
  }

  private async createLock(
    lockPath: string,
    directory: string,
    record: SeriesProjectRepositoryLockRecord,
  ): Promise<void> {
    const handle = await open(lockPath, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await syncDirectory(directory);
  }

  private async archiveDeadSameHostLock(lockPath: string, directory: string): Promise<boolean> {
    let record: SeriesProjectRepositoryLockRecord;
    try {
      const target = await lstat(lockPath);
      if (target.isSymbolicLink() || !target.isFile()) return false;
      record = JSON.parse(await readFile(lockPath, 'utf8')) as SeriesProjectRepositoryLockRecord;
    } catch {
      return false;
    }
    if (
      record.schema_version !== 'story-agent-series-project-repository-lock/v1'
      || record.owner_host !== hostname()
      || !Number.isSafeInteger(record.owner_pid)
      || record.owner_pid <= 0
      || !processDefinitelyMissing(record.owner_pid)
    ) return false;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    try {
      await rename(lockPath, `${lockPath}.stale-owner-${timestamp}-${randomUUID()}.archive`);
      await syncDirectory(directory);
      return true;
    } catch {
      return false;
    }
  }

  private async releaseOwnedLock(
    directory: string,
    record: SeriesProjectRepositoryLockRecord,
  ): Promise<void> {
    const lockPath = this.lockPath(directory);
    try {
      const stored = JSON.parse(await readFile(lockPath, 'utf8')) as SeriesProjectRepositoryLockRecord;
      if (stored.nonce !== record.nonce) return;
      await unlink(lockPath);
      await syncDirectory(directory);
    } catch {
      // Preserve missing, malformed or externally replaced lock evidence.
    }
  }

  private projectDirectory(root: string, seriesProjectId: string): string {
    return resolve(root, seriesProjectId);
  }

  private projectFile(directory: string): string {
    return resolve(directory, 'project.json');
  }

  private lockPath(directory: string): string {
    return resolve(directory, '.series-project-repository.lock');
  }
}

function validSeriesProjectId(value: unknown): value is string {
  return typeof value === 'string' && SERIES_PROJECT_ID_PATTERN.test(value);
}

function processDefinitelyMissing(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return isNodeError(error) && error.code === 'ESRCH';
  }
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
