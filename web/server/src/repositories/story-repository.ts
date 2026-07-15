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
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import type { StoryGenerateResult, VideoType } from '@shared/types.js';
import { ErrorCodes, VIDEO_TYPE_CONFIG } from '@shared/types.js';

const STORY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,240}$/;
const MAX_STORY_BYTES = 64 * 1024 * 1024;
const DEFAULT_VIDEO_TYPES = Object.keys(VIDEO_TYPE_CONFIG) as VideoType[];

type StoredStory = StoryGenerateResult & { _request_meta?: unknown };

interface StoryRepositoryLockRecord {
  schema_version: 'story-agent-story-repository-lock/v1';
  owner_pid: number;
  owner_host: string;
  acquired_at: string;
  nonce: string;
}

export interface StoryRepositoryDocument {
  story: StoredStory;
  revision: string;
  video_type: VideoType;
}

export interface StoryRepository {
  list(videoTypes?: readonly VideoType[]): Promise<StoryRepositoryDocument[]>;
  read(storyId: string, videoTypes?: readonly VideoType[]): Promise<StoryRepositoryDocument | null>;
  create(story: StoredStory): Promise<'created' | 'exists'>;
  replace(story: StoredStory, expectedRevision: string): Promise<void>;
}

type StoryRepositoryFaultPoint = 'after_temp_fsync';

export interface FileStoryRepositoryOptions {
  video_types?: readonly VideoType[];
  fault_injector?: (point: StoryRepositoryFaultPoint) => void | Promise<void>;
}

export class StoryRepositoryConflictError extends Error {
  readonly code = ErrorCodes.STORY_WRITE_CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'StoryRepositoryConflictError';
  }
}

export class StoryRepositoryPathError extends Error {
  readonly code = ErrorCodes.STORY_REPOSITORY_IDENTIFIER_INVALID;

  constructor(message: string) {
    super(message);
    this.name = 'StoryRepositoryPathError';
  }
}

export class StoryRepositoryStateError extends Error {
  readonly code = ErrorCodes.STORY_STORAGE_UNAVAILABLE;

  constructor(message: string) {
    super(message);
    this.name = 'StoryRepositoryStateError';
  }
}

export class FileStoryRepository implements StoryRepository {
  private readonly root: string;
  private readonly videoTypes: VideoType[];

  constructor(
    root: string,
    private readonly options: FileStoryRepositoryOptions = {},
  ) {
    this.root = resolve(root);
    this.videoTypes = [...new Set(options.video_types ?? DEFAULT_VIDEO_TYPES)];
  }

  async list(videoTypes: readonly VideoType[] = this.videoTypes): Promise<StoryRepositoryDocument[]> {
    if (!(await this.ensureSafeDirectory(this.root, false))) return [];
    const documents: StoryRepositoryDocument[] = [];
    const ids = new Set<string>();
    for (const videoType of this.normalizeVideoTypes(videoTypes)) {
      const directory = this.typeDirectory(videoType);
      if (!(await this.ensureSafeDirectory(directory, false))) continue;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (!entry.name.endsWith('.json')) continue;
        if (entry.isSymbolicLink() || !entry.isFile()) {
          throw new StoryRepositoryPathError(`Story entry "${entry.name}" is not a regular file`);
        }
        const storyId = entry.name.slice(0, -'.json'.length);
        if (!validStoryId(storyId)) {
          throw new StoryRepositoryPathError(`Invalid story filename "${entry.name}"`);
        }
        if (ids.has(storyId)) {
          throw new StoryRepositoryStateError(`Story "${storyId}" exists in more than one video type`);
        }
        ids.add(storyId);
        documents.push(await this.readAt(this.storyPath(videoType, storyId), storyId, videoType));
      }
    }
    return documents.sort((left, right) => (
      left.video_type.localeCompare(right.video_type)
      || left.story.storyId.localeCompare(right.story.storyId)
    ));
  }

  async read(
    storyId: string,
    videoTypes: readonly VideoType[] = this.videoTypes,
  ): Promise<StoryRepositoryDocument | null> {
    if (!validStoryId(storyId)) return null;
    if (!(await this.ensureSafeDirectory(this.root, false))) return null;
    let document: StoryRepositoryDocument | null = null;
    for (const videoType of this.normalizeVideoTypes(videoTypes)) {
      const filePath = this.storyPath(videoType, storyId);
      try {
        const typeDirectory = this.typeDirectory(videoType);
        const directoryStat = await lstat(typeDirectory);
        if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
          throw new StoryRepositoryPathError(`Story directory "${typeDirectory}" is not a regular directory`);
        }
        const fileStat = await lstat(filePath);
        if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
          throw new StoryRepositoryPathError(`Story file "${filePath}" is not a regular file`);
        }
        if (document) {
          throw new StoryRepositoryStateError(`Story "${storyId}" exists in more than one video type`);
        }
        document = await this.readAt(filePath, storyId, videoType);
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') continue;
        throw error;
      }
    }
    return document;
  }

  async create(story: StoredStory): Promise<'created' | 'exists'> {
    const { storyId, videoType } = this.assertStory(story);
    await this.ensureSafeDirectory(this.root, true);
    const lock = await this.acquireLock(storyId);
    try {
      if (await this.read(storyId)) return 'exists';
      await this.ensureSafeDirectory(this.typeDirectory(videoType), true);
      await this.writeAtomic(this.storyPath(videoType, storyId), story);
      return 'created';
    } finally {
      await this.releaseOwnedLock(storyId, lock);
    }
  }

  async replace(story: StoredStory, expectedRevision: string): Promise<void> {
    const { storyId, videoType } = this.assertStory(story);
    await this.ensureSafeDirectory(this.root, true);
    const lock = await this.acquireLock(storyId);
    try {
      const current = await this.read(storyId);
      if (!current || current.video_type !== videoType || current.revision !== expectedRevision) {
        throw new StoryRepositoryConflictError(`Story "${storyId}" changed before write`);
      }
      await this.writeAtomic(this.storyPath(videoType, storyId), story);
    } finally {
      await this.releaseOwnedLock(storyId, lock);
    }
  }

  private assertStory(story: StoredStory): { storyId: string; videoType: VideoType } {
    if (!validStoryId(story?.storyId)) {
      throw new StoryRepositoryPathError(`Invalid story id "${story?.storyId}"`);
    }
    if (!this.videoTypes.includes(story.video_type)) {
      throw new StoryRepositoryPathError(`Invalid story video type "${story.video_type}"`);
    }
    return { storyId: story.storyId, videoType: story.video_type };
  }

  private normalizeVideoTypes(videoTypes: readonly VideoType[]): VideoType[] {
    const values = [...new Set(videoTypes)];
    for (const videoType of values) {
      if (!this.videoTypes.includes(videoType)) {
        throw new StoryRepositoryPathError(`Invalid story video type "${videoType}"`);
      }
    }
    return values;
  }

  private async readAt(
    filePath: string,
    expectedStoryId: string,
    expectedVideoType: VideoType,
  ): Promise<StoryRepositoryDocument> {
    let bytes: Buffer;
    try {
      const target = await lstat(filePath);
      if (target.isSymbolicLink() || !target.isFile() || target.size > MAX_STORY_BYTES) {
        throw new StoryRepositoryStateError(`Story "${filePath}" is not a supported regular file`);
      }
      bytes = await readFile(filePath);
    } catch (error) {
      if (error instanceof StoryRepositoryStateError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new StoryRepositoryStateError(`Story "${filePath}" is unreadable: ${message}`);
    }
    let story: StoredStory;
    try {
      story = JSON.parse(bytes.toString('utf8')) as StoredStory;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new StoryRepositoryStateError(`Story "${filePath}" contains invalid JSON: ${message}`);
    }
    if (story?.storyId !== expectedStoryId || story.video_type !== expectedVideoType) {
      throw new StoryRepositoryStateError(`Story "${filePath}" has invalid identity metadata`);
    }
    return {
      story,
      revision: createHash('sha256').update(bytes).digest('hex'),
      video_type: expectedVideoType,
    };
  }

  private async writeAtomic(filePath: string, story: StoredStory): Promise<void> {
    const directory = resolve(filePath, '..');
    const temporaryPath = resolve(directory, `.${randomUUID()}.story.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporaryPath, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(story, null, 2), 'utf8');
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

  private async ensureSafeDirectory(path: string, create: boolean): Promise<boolean> {
    try {
      const target = await lstat(path);
      if (target.isSymbolicLink() || !target.isDirectory()) {
        throw new StoryRepositoryPathError(`Story repository path "${path}" is not a regular directory`);
      }
      return true;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      if (!create) return false;
      await mkdir(path, { recursive: true, mode: 0o700 });
      const created = await lstat(path);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw new StoryRepositoryPathError(`Story repository path "${path}" is not a regular directory`);
      }
      return true;
    }
  }

  private async acquireLock(storyId: string): Promise<StoryRepositoryLockRecord> {
    const lockPath = this.lockPath(storyId);
    const record: StoryRepositoryLockRecord = {
      schema_version: 'story-agent-story-repository-lock/v1',
      owner_pid: process.pid,
      owner_host: hostname(),
      acquired_at: new Date().toISOString(),
      nonce: randomUUID(),
    };
    try {
      await this.createLock(lockPath, record);
      return record;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') {
        const message = error instanceof Error ? error.message : String(error);
        throw new StoryRepositoryStateError(`Story writer lock could not be created: ${message}`);
      }
      if (!(await this.archiveDeadSameHostLock(lockPath))) {
        throw new StoryRepositoryConflictError(`Story writer lock "${lockPath}" is held`);
      }
      try {
        await this.createLock(lockPath, record);
        return record;
      } catch (retryError) {
        if (isNodeError(retryError) && retryError.code === 'EEXIST') {
          throw new StoryRepositoryConflictError(`Story writer lock "${lockPath}" is held`);
        }
        const message = retryError instanceof Error ? retryError.message : String(retryError);
        throw new StoryRepositoryStateError(`Story writer lock could not be recreated: ${message}`);
      }
    }
  }

  private async createLock(lockPath: string, record: StoryRepositoryLockRecord): Promise<void> {
    const handle = await open(lockPath, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await syncDirectory(this.root);
  }

  private async archiveDeadSameHostLock(lockPath: string): Promise<boolean> {
    let record: StoryRepositoryLockRecord;
    try {
      const target = await lstat(lockPath);
      if (target.isSymbolicLink() || !target.isFile()) return false;
      record = JSON.parse(await readFile(lockPath, 'utf8')) as StoryRepositoryLockRecord;
    } catch {
      return false;
    }
    if (
      record.schema_version !== 'story-agent-story-repository-lock/v1'
      || record.owner_host !== hostname()
      || !Number.isSafeInteger(record.owner_pid)
      || record.owner_pid <= 0
      || !processDefinitelyMissing(record.owner_pid)
    ) return false;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    try {
      await rename(lockPath, `${lockPath}.stale-owner-${timestamp}-${randomUUID()}.archive`);
      await syncDirectory(this.root);
      return true;
    } catch {
      return false;
    }
  }

  private async releaseOwnedLock(storyId: string, record: StoryRepositoryLockRecord): Promise<void> {
    const lockPath = this.lockPath(storyId);
    try {
      const stored = JSON.parse(await readFile(lockPath, 'utf8')) as StoryRepositoryLockRecord;
      if (stored.nonce !== record.nonce) return;
      await unlink(lockPath);
      await syncDirectory(this.root);
    } catch {
      // Preserve missing, malformed or externally replaced lock evidence.
    }
  }

  private typeDirectory(videoType: VideoType): string {
    return resolve(this.root, videoType);
  }

  private storyPath(videoType: VideoType, storyId: string): string {
    return resolve(this.typeDirectory(videoType), `${storyId}.json`);
  }

  private lockPath(storyId: string): string {
    return resolve(this.root, `.story-repository.${storyId}.lock`);
  }
}

function validStoryId(value: unknown): value is string {
  return typeof value === 'string' && STORY_ID_PATTERN.test(value);
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
