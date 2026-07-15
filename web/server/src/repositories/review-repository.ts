import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { ErrorCodes } from '@shared/types.js';

const REVIEW_FILE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,239}\.json$/;

interface ReviewRepositoryDocument {
  schema_version?: unknown;
  updated_at?: unknown;
  items?: unknown;
  [key: string]: unknown;
}

interface ReviewRepositoryLockRecord {
  schema_version: 'story-agent-review-repository-lock/v1';
  owner_pid: number;
  owner_host: string;
  acquired_at: string;
  nonce: string;
}

export interface ReviewRepositorySnapshot<T> {
  updated_at?: string;
  revision: string | null;
  items: T[];
}

export interface ReviewRepositoryReplaceOptions {
  expected_revision: string | null;
  updated_at: string;
  static_fields?: Readonly<Record<string, unknown>>;
}

export interface ReviewRepository<T> {
  read(): ReviewRepositorySnapshot<T>;
  replace(items: readonly T[], options: ReviewRepositoryReplaceOptions): ReviewRepositorySnapshot<T>;
}

type ReviewRepositoryFaultPoint = 'after_temp_fsync';

export interface FileReviewRepositoryOptions<T> {
  schema_version: string;
  normalize_item: (value: unknown) => T | undefined;
  item_id: (item: T) => string;
  fault_injector?: (point: ReviewRepositoryFaultPoint) => void;
}

export class ReviewRepositoryConflictError extends Error {
  readonly code = ErrorCodes.REVIEW_WRITE_CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'ReviewRepositoryConflictError';
  }
}

export class ReviewRepositoryPathError extends Error {
  readonly code = ErrorCodes.REVIEW_REPOSITORY_IDENTIFIER_INVALID;

  constructor(message: string) {
    super(message);
    this.name = 'ReviewRepositoryPathError';
  }
}

export class ReviewRepositoryStateError extends Error {
  readonly code = ErrorCodes.REVIEW_STORAGE_UNAVAILABLE;

  constructor(message: string) {
    super(message);
    this.name = 'ReviewRepositoryStateError';
  }
}

/**
 * Synchronous file provider for the existing synchronous review services.
 * A revision is the SHA-256 of the exact persisted document bytes.
 */
export class FileReviewRepository<T> implements ReviewRepository<T> {
  private readonly root: string;
  private readonly filePath: string;
  private readonly lockPath: string;

  constructor(
    root: string,
    fileName: string,
    private readonly options: FileReviewRepositoryOptions<T>,
  ) {
    if (!REVIEW_FILE_PATTERN.test(fileName) || fileName.includes('..')) {
      throw new ReviewRepositoryPathError(`Invalid review repository filename "${fileName}"`);
    }
    this.root = resolve(root);
    this.filePath = resolve(this.root, fileName);
    this.lockPath = resolve(this.root, `.${fileName}.review-repository.lock`);
  }

  read(): ReviewRepositorySnapshot<T> {
    if (!this.ensureSafeRoot(false) || !existsSync(this.filePath)) {
      return { revision: null, items: [] };
    }
    const target = lstatSync(this.filePath);
    if (target.isSymbolicLink() || !target.isFile()) {
      throw new ReviewRepositoryPathError(`Review state "${this.filePath}" is not a regular file`);
    }

    const raw = readFileSync(this.filePath);
    let document: ReviewRepositoryDocument;
    try {
      document = JSON.parse(raw.toString('utf8')) as ReviewRepositoryDocument;
    } catch {
      throw new ReviewRepositoryStateError(`Review state "${this.filePath}" is not valid JSON`);
    }
    if (document.schema_version !== this.options.schema_version || !Array.isArray(document.items)) {
      throw new ReviewRepositoryStateError(`Review state "${this.filePath}" has an invalid schema`);
    }

    const items = document.items.map(value => this.options.normalize_item(value));
    if (items.some(item => item === undefined)) {
      throw new ReviewRepositoryStateError(`Review state "${this.filePath}" contains an invalid item`);
    }
    const normalizedItems = items as T[];
    this.assertUniqueItemIds(normalizedItems);
    return {
      updated_at: typeof document.updated_at === 'string' ? document.updated_at : undefined,
      revision: createHash('sha256').update(raw).digest('hex'),
      items: normalizedItems,
    };
  }

  replace(
    items: readonly T[],
    options: ReviewRepositoryReplaceOptions,
  ): ReviewRepositorySnapshot<T> {
    this.assertStaticFields(options.static_fields);
    this.assertUniqueItemIds(items);
    this.ensureSafeRoot(true);
    const lock = this.acquireLock();
    try {
      const current = this.read();
      if (current.revision !== options.expected_revision) {
        throw new ReviewRepositoryConflictError(
          `Review state changed before write; expected ${options.expected_revision ?? 'missing'}, found ${current.revision ?? 'missing'}`,
        );
      }
      const sortedItems = [...items].sort((left, right) =>
        this.options.item_id(left).localeCompare(this.options.item_id(right)),
      );
      const document = {
        schema_version: this.options.schema_version,
        updated_at: options.updated_at,
        ...(options.static_fields ?? {}),
        items: sortedItems,
      };
      const raw = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
      this.writeAtomic(raw);
      return {
        updated_at: options.updated_at,
        revision: createHash('sha256').update(raw).digest('hex'),
        items: sortedItems,
      };
    } finally {
      this.releaseOwnedLock(lock);
    }
  }

  private ensureSafeRoot(create: boolean): boolean {
    if (!existsSync(this.root)) {
      if (!create) return false;
      mkdirSync(this.root, { recursive: true, mode: 0o700 });
    }
    const target = lstatSync(this.root);
    if (target.isSymbolicLink() || !target.isDirectory()) {
      throw new ReviewRepositoryPathError(`Review repository root "${this.root}" is not a regular directory`);
    }
    return true;
  }

  private assertUniqueItemIds(items: readonly T[]): void {
    const ids = new Set<string>();
    for (const item of items) {
      const id = this.options.item_id(item);
      if (!id || ids.has(id)) {
        throw new ReviewRepositoryStateError(`Review state contains an empty or duplicate item id "${id}"`);
      }
      ids.add(id);
    }
  }

  private assertStaticFields(fields: Readonly<Record<string, unknown>> | undefined): void {
    if (!fields) return;
    const reserved = ['schema_version', 'updated_at', 'items'];
    const conflict = reserved.find(field => Object.hasOwn(fields, field));
    if (conflict) {
      throw new ReviewRepositoryStateError(`Review static field "${conflict}" is reserved`);
    }
  }

  private writeAtomic(raw: Buffer): void {
    if (existsSync(this.filePath)) {
      const target = lstatSync(this.filePath);
      if (target.isSymbolicLink() || !target.isFile()) {
        throw new ReviewRepositoryPathError(`Review state "${this.filePath}" is not a regular file`);
      }
    }
    const temporaryPath = resolve(this.root, `.${randomUUID()}.review-state.tmp`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporaryPath, 'wx', 0o600);
      writeFileSync(descriptor, raw);
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      this.options.fault_injector?.('after_temp_fsync');
      renameSync(temporaryPath, this.filePath);
      syncDirectory(this.root);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    }
  }

  private acquireLock(): ReviewRepositoryLockRecord {
    const record: ReviewRepositoryLockRecord = {
      schema_version: 'story-agent-review-repository-lock/v1',
      owner_pid: process.pid,
      owner_host: hostname(),
      acquired_at: new Date().toISOString(),
      nonce: randomUUID(),
    };
    try {
      this.createLock(record);
      return record;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') {
        const message = error instanceof Error ? error.message : String(error);
        throw new ReviewRepositoryStateError(`Review writer lock could not be created: ${message}`);
      }
      if (!this.archiveDeadSameHostLock()) {
        throw new ReviewRepositoryConflictError(`Review state writer lock "${this.lockPath}" is held`);
      }
      try {
        this.createLock(record);
        return record;
      } catch (retryError) {
        if (isNodeError(retryError) && retryError.code === 'EEXIST') {
          throw new ReviewRepositoryConflictError(`Review state writer lock "${this.lockPath}" is held`);
        }
        const message = retryError instanceof Error ? retryError.message : String(retryError);
        throw new ReviewRepositoryStateError(`Review writer lock could not be recreated: ${message}`);
      }
    }
  }

  private createLock(record: ReviewRepositoryLockRecord): void {
    const descriptor = openSync(this.lockPath, 'wx', 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(record)}\n`, 'utf8');
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    syncDirectory(this.root);
  }

  private archiveDeadSameHostLock(): boolean {
    let record: ReviewRepositoryLockRecord;
    try {
      const target = lstatSync(this.lockPath);
      if (target.isSymbolicLink() || !target.isFile()) return false;
      record = JSON.parse(readFileSync(this.lockPath, 'utf8')) as ReviewRepositoryLockRecord;
    } catch {
      return false;
    }
    if (
      record.schema_version !== 'story-agent-review-repository-lock/v1'
      || record.owner_host !== hostname()
      || !Number.isSafeInteger(record.owner_pid)
      || record.owner_pid <= 0
      || !processDefinitelyMissing(record.owner_pid)
    ) return false;

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const archivePath = `${this.lockPath}.stale-owner-${timestamp}-${randomUUID()}.archive`;
    try {
      renameSync(this.lockPath, archivePath);
      syncDirectory(this.root);
      return true;
    } catch {
      return false;
    }
  }

  private releaseOwnedLock(record: ReviewRepositoryLockRecord): void {
    try {
      const stored = JSON.parse(readFileSync(this.lockPath, 'utf8')) as ReviewRepositoryLockRecord;
      if (stored.nonce !== record.nonce) return;
      unlinkSync(this.lockPath);
      syncDirectory(this.root);
    } catch {
      // Preserve missing, invalid or externally replaced lock evidence.
    }
  }
}

function processDefinitelyMissing(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return isNodeError(error) && error.code === 'ESRCH';
  }
}

function syncDirectory(directory: string): void {
  const descriptor = openSync(directory, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
