import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { ErrorCodes } from '@shared/types.js';

const JOB_LOG_FILE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,239}\.(?:log|jsonl)$/;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const DEFAULT_LOCK_RETRY_DELAYS_MS = [0, 10, 25, 50, 100];

interface JobRepositoryLockRecord {
  schema_version: 'story-agent-job-repository-lock/v1';
  owner_pid: number;
  owner_host: string;
  acquired_at: string;
  nonce: string;
}

export interface JobRepositorySnapshot<T> {
  revision: string | null;
  byte_size: number;
  items: T[];
}

export interface JobRepositoryAppendResult<T> {
  status: 'appended' | 'duplicate';
  revision: string;
  byte_size: number;
  item: T;
}

export interface JobRepository<T> {
  read(): Promise<JobRepositorySnapshot<T>>;
  append(item: T): Promise<JobRepositoryAppendResult<T>>;
}

type JobRepositoryFaultPoint = 'after_temp_fsync';

export interface FileJobRepositoryOptions<T> {
  normalize_item: (value: unknown) => T | undefined;
  item_id: (item: T) => string;
  max_bytes?: number;
  lock_retry_delays_ms?: readonly number[];
  fault_injector?: (point: JobRepositoryFaultPoint) => void | Promise<void>;
}

export class JobRepositoryConflictError extends Error {
  readonly code = ErrorCodes.JOB_WRITE_CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'JobRepositoryConflictError';
  }
}

export class JobRepositoryPathError extends Error {
  readonly code = ErrorCodes.JOB_REPOSITORY_IDENTIFIER_INVALID;

  constructor(message: string) {
    super(message);
    this.name = 'JobRepositoryPathError';
  }
}

export class JobRepositoryStateError extends Error {
  readonly code = ErrorCodes.JOB_STORAGE_UNAVAILABLE;

  constructor(message: string) {
    super(message);
    this.name = 'JobRepositoryStateError';
  }
}

/**
 * Immutable JSONL event provider. The current file provider rewrites the log
 * atomically under a lock so a crash cannot leave a partial trailing record.
 */
export class FileJobRepository<T> implements JobRepository<T> {
  private readonly root: string;
  private readonly filePath: string;
  private readonly lockPath: string;
  private readonly maxBytes: number;
  private readonly lockRetryDelaysMs: readonly number[];

  constructor(
    root: string,
    fileName: string,
    private readonly options: FileJobRepositoryOptions<T>,
  ) {
    if (!JOB_LOG_FILE_PATTERN.test(fileName) || fileName.includes('..')) {
      throw new JobRepositoryPathError(`Invalid job repository filename "${fileName}"`);
    }
    this.root = resolve(root);
    this.filePath = resolve(this.root, fileName);
    this.lockPath = resolve(this.root, `.${fileName}.job-repository.lock`);
    this.maxBytes = options.max_bytes ?? DEFAULT_MAX_BYTES;
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1_024) {
      throw new JobRepositoryStateError('Job repository max_bytes must be an integer of at least 1024');
    }
    this.lockRetryDelaysMs = options.lock_retry_delays_ms ?? DEFAULT_LOCK_RETRY_DELAYS_MS;
    if (
      this.lockRetryDelaysMs.length === 0
      || this.lockRetryDelaysMs.some(delayMs => !Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 10_000)
    ) {
      throw new JobRepositoryStateError('Job repository lock retry delays are invalid');
    }
  }

  async read(): Promise<JobRepositorySnapshot<T>> {
    if (!(await this.ensureSafeRoot(false))) {
      return { revision: null, byte_size: 0, items: [] };
    }
    return this.readExistingLog();
  }

  async append(item: T): Promise<JobRepositoryAppendResult<T>> {
    const normalized = this.options.normalize_item(item);
    if (!normalized) throw new JobRepositoryStateError('Job repository rejected an invalid item');
    const itemId = this.options.item_id(normalized);
    if (!itemId) throw new JobRepositoryStateError('Job repository item id is empty');

    await this.ensureSafeRoot(true);
    const lock = await this.acquireLock();
    try {
      const current = await this.readExistingLog();
      const existing = current.items.find(candidate => this.options.item_id(candidate) === itemId);
      if (existing) {
        if (stableJson(existing) !== stableJson(normalized)) {
          throw new JobRepositoryConflictError(`Job event "${itemId}" has conflicting content`);
        }
        return {
          status: 'duplicate',
          revision: current.revision!,
          byte_size: current.byte_size,
          item: existing,
        };
      }

      const nextItems = [...current.items, normalized];
      const raw = Buffer.from(nextItems.map(value => JSON.stringify(value)).join('\n') + '\n', 'utf8');
      if (raw.byteLength > this.maxBytes) {
        throw new JobRepositoryStateError(
          `Job repository would exceed max_bytes (${raw.byteLength} > ${this.maxBytes})`,
        );
      }
      await this.writeAtomic(raw);
      return {
        status: 'appended',
        revision: createHash('sha256').update(raw).digest('hex'),
        byte_size: raw.byteLength,
        item: normalized,
      };
    } finally {
      await this.releaseOwnedLock(lock);
    }
  }

  private async readExistingLog(): Promise<JobRepositorySnapshot<T>> {
    let raw: Buffer;
    try {
      const target = await lstat(this.filePath);
      if (target.isSymbolicLink() || !target.isFile()) {
        throw new JobRepositoryPathError(`Job log "${this.filePath}" is not a regular file`);
      }
      raw = await readFile(this.filePath);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return { revision: null, byte_size: 0, items: [] };
      }
      throw error;
    }
    if (raw.byteLength > this.maxBytes) {
      throw new JobRepositoryStateError(`Job repository exceeds max_bytes (${raw.byteLength} > ${this.maxBytes})`);
    }
    const text = raw.toString('utf8');
    if (text && !text.endsWith('\n')) {
      throw new JobRepositoryStateError(`Job log "${this.filePath}" has a partial trailing record`);
    }
    const lines = text ? text.slice(0, -1).split('\n') : [];
    const items: T[] = [];
    const ids = new Set<string>();
    for (const [index, line] of lines.entries()) {
      if (!line) throw new JobRepositoryStateError(`Job log contains an empty line at ${index + 1}`);
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw new JobRepositoryStateError(`Job log contains invalid JSON at line ${index + 1}`);
      }
      const normalized = this.options.normalize_item(value);
      if (!normalized) throw new JobRepositoryStateError(`Job log contains an invalid event at line ${index + 1}`);
      const id = this.options.item_id(normalized);
      if (!id || ids.has(id)) {
        throw new JobRepositoryStateError(`Job log contains an empty or duplicate event id "${id}"`);
      }
      ids.add(id);
      items.push(normalized);
    }
    return {
      revision: createHash('sha256').update(raw).digest('hex'),
      byte_size: raw.byteLength,
      items,
    };
  }

  private async ensureSafeRoot(create: boolean): Promise<boolean> {
    try {
      const target = await lstat(this.root);
      if (target.isSymbolicLink() || !target.isDirectory()) {
        throw new JobRepositoryPathError(`Job repository root "${this.root}" is not a regular directory`);
      }
      return true;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      if (!create) return false;
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      const created = await lstat(this.root);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw new JobRepositoryPathError(`Job repository root "${this.root}" is not a regular directory`);
      }
      return true;
    }
  }

  private async writeAtomic(raw: Buffer): Promise<void> {
    const temporaryPath = resolve(this.root, `.${randomUUID()}.job-log.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporaryPath, 'wx', 0o600);
      await handle.writeFile(raw);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await this.options.fault_injector?.('after_temp_fsync');
      await rename(temporaryPath, this.filePath);
      await syncDirectory(this.root);
    } finally {
      await handle?.close().catch(() => undefined);
      await unlink(temporaryPath).catch(error => {
        if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      });
    }
  }

  private async acquireLock(): Promise<JobRepositoryLockRecord> {
    const record: JobRepositoryLockRecord = {
      schema_version: 'story-agent-job-repository-lock/v1',
      owner_pid: process.pid,
      owner_host: hostname(),
      acquired_at: new Date().toISOString(),
      nonce: randomUUID(),
    };
    for (const [index, delayMs] of this.lockRetryDelaysMs.entries()) {
      if (delayMs > 0) await delay(delayMs);
      try {
        await this.createLock(record);
        return record;
      } catch (error) {
        if (!isNodeError(error) || error.code !== 'EEXIST') {
          const message = error instanceof Error ? error.message : String(error);
          throw new JobRepositoryStateError(`Job writer lock could not be created: ${message}`);
        }
        if (await this.archiveDeadSameHostLock()) {
          try {
            await this.createLock(record);
            return record;
          } catch (recreateError) {
            if (!isNodeError(recreateError) || recreateError.code !== 'EEXIST') {
              const message = recreateError instanceof Error ? recreateError.message : String(recreateError);
              throw new JobRepositoryStateError(`Job writer lock could not be recreated: ${message}`);
            }
          }
        }
        if (index === this.lockRetryDelaysMs.length - 1) break;
      }
    }
    throw new JobRepositoryConflictError(`Job writer lock "${this.lockPath}" is held`);
  }

  private async createLock(record: JobRepositoryLockRecord): Promise<void> {
    const handle = await open(this.lockPath, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await syncDirectory(this.root);
  }

  private async archiveDeadSameHostLock(): Promise<boolean> {
    let record: JobRepositoryLockRecord;
    try {
      const target = await lstat(this.lockPath);
      if (target.isSymbolicLink() || !target.isFile()) return false;
      record = JSON.parse(await readFile(this.lockPath, 'utf8')) as JobRepositoryLockRecord;
    } catch {
      return false;
    }
    if (
      record.schema_version !== 'story-agent-job-repository-lock/v1'
      || record.owner_host !== hostname()
      || !Number.isSafeInteger(record.owner_pid)
      || record.owner_pid <= 0
      || !processDefinitelyMissing(record.owner_pid)
    ) return false;

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const archivePath = `${this.lockPath}.stale-owner-${timestamp}-${randomUUID()}.archive`;
    try {
      await rename(this.lockPath, archivePath);
      await syncDirectory(this.root);
      return true;
    } catch {
      return false;
    }
  }

  private async releaseOwnedLock(record: JobRepositoryLockRecord): Promise<void> {
    try {
      const stored = JSON.parse(await readFile(this.lockPath, 'utf8')) as JobRepositoryLockRecord;
      if (stored.nonce !== record.nonce) return;
      await unlink(this.lockPath);
      await syncDirectory(this.root);
    } catch {
      // Preserve missing, invalid or externally replaced lock evidence.
    }
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
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

function delay(ms: number): Promise<void> {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}
