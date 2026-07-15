import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  link,
  lstat,
  mkdir,
  open,
  rename,
  unlink,
} from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { ErrorCodes } from '@shared/types.js';

const MAX_RELATIVE_PATH_LENGTH = 1_024;
const MAX_PATH_SEGMENT_LENGTH = 255;

export type ArtifactOverwritePolicy = 'forbid' | 'replace';

export interface ArtifactWriteOptions {
  overwrite?: ArtifactOverwritePolicy;
}

export interface ArtifactBatchItem extends ArtifactWriteOptions {
  relative_path: string;
  content: string | Uint8Array;
  encoding?: BufferEncoding;
}

export interface ArtifactWriteResult {
  relative_path: string;
  absolute_path: string;
  byte_size: number;
  sha256: string;
  replaced: boolean;
}

export interface ArtifactExternalWriteSession {
  session_id: string;
  relative_path: string;
  staging_absolute_path: string;
  target_absolute_path: string;
}

export interface ArtifactStore {
  exists(relativePath: string): Promise<boolean>;
  writeBinary(
    relativePath: string,
    content: Uint8Array,
    options?: ArtifactWriteOptions,
  ): Promise<ArtifactWriteResult>;
  writeText(
    relativePath: string,
    content: string,
    options?: ArtifactWriteOptions & { encoding?: BufferEncoding },
  ): Promise<ArtifactWriteResult>;
  writeBatch(items: readonly ArtifactBatchItem[]): Promise<ArtifactWriteResult[]>;
  prepareExternalWrite(
    relativePath: string,
    options?: ArtifactWriteOptions,
  ): Promise<ArtifactExternalWriteSession>;
  publishExternalWrite(session: ArtifactExternalWriteSession): Promise<ArtifactWriteResult>;
  abortExternalWrite(session: ArtifactExternalWriteSession): Promise<void>;
}

export class ArtifactStorePathError extends Error {
  readonly code = ErrorCodes.ARTIFACT_PATH_INVALID;

  constructor(message: string) {
    super(message);
    this.name = 'ArtifactStorePathError';
  }
}

export class ArtifactStoreConflictError extends Error {
  readonly code = ErrorCodes.ARTIFACT_WRITE_CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'ArtifactStoreConflictError';
  }
}

export class ArtifactStoreStateError extends Error {
  readonly code = ErrorCodes.ARTIFACT_STORAGE_UNAVAILABLE;

  constructor(message: string) {
    super(message);
    this.name = 'ArtifactStoreStateError';
  }
}

/**
 * Local artifact boundary for generated uploads and exports.
 *
 * A batch validates all paths before starting, but intentionally does not claim
 * cross-file transaction semantics. Each individual file is durably published
 * with a same-directory atomic operation.
 */
export class FileArtifactStore implements ArtifactStore {
  private readonly root: string;
  private readonly externalWrites = new Map<string, {
    session: ArtifactExternalWriteSession;
    overwrite: ArtifactOverwritePolicy;
    replaced: boolean;
  }>();

  constructor(root: string) {
    this.root = resolve(root);
  }

  async exists(relativePath: string): Promise<boolean> {
    const normalizedPath = this.normalizeRelativePath(relativePath);
    const segments = normalizedPath.split('/');
    if (!(await this.safeExistingDirectory(this.root))) return false;
    let directory = this.root;
    for (const segment of segments.slice(0, -1)) {
      directory = resolve(directory, segment);
      if (!(await this.safeExistingDirectory(directory))) return false;
    }
    const targetPath = resolve(directory, segments.at(-1)!);
    try {
      const target = await lstat(targetPath);
      if (target.isSymbolicLink() || !target.isFile()) {
        throw new ArtifactStorePathError(`Artifact target "${targetPath}" is not a regular file`);
      }
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async writeBinary(
    relativePath: string,
    content: Uint8Array,
    options: ArtifactWriteOptions = {},
  ): Promise<ArtifactWriteResult> {
    return this.writeBuffer(relativePath, Buffer.from(content), options.overwrite ?? 'forbid');
  }

  async writeText(
    relativePath: string,
    content: string,
    options: ArtifactWriteOptions & { encoding?: BufferEncoding } = {},
  ): Promise<ArtifactWriteResult> {
    return this.writeBuffer(
      relativePath,
      Buffer.from(content, options.encoding ?? 'utf8'),
      options.overwrite ?? 'forbid',
    );
  }

  async writeBatch(items: readonly ArtifactBatchItem[]): Promise<ArtifactWriteResult[]> {
    const normalizedPaths = items.map(item => this.normalizeRelativePath(item.relative_path));
    const duplicates = normalizedPaths.filter((path, index) => normalizedPaths.indexOf(path) !== index);
    if (duplicates.length) {
      throw new ArtifactStoreConflictError(`Artifact batch contains duplicate path "${duplicates[0]}"`);
    }

    const results: ArtifactWriteResult[] = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const content = typeof item.content === 'string'
        ? Buffer.from(item.content, item.encoding ?? 'utf8')
        : Buffer.from(item.content);
      results.push(await this.writeBuffer(
        normalizedPaths[index],
        content,
        item.overwrite ?? 'forbid',
      ));
    }
    return results;
  }

  async prepareExternalWrite(
    relativePath: string,
    options: ArtifactWriteOptions = {},
  ): Promise<ArtifactExternalWriteSession> {
    const normalizedPath = this.normalizeRelativePath(relativePath);
    const overwrite = options.overwrite ?? 'forbid';
    const segments = normalizedPath.split('/');
    const filename = segments.at(-1)!;
    const directory = await this.ensureSafeDirectory(segments.slice(0, -1));
    const targetPath = resolve(directory, filename);
    const replaced = await this.inspectTarget(targetPath, overwrite);
    const session: ArtifactExternalWriteSession = {
      session_id: randomUUID(),
      relative_path: normalizedPath,
      staging_absolute_path: resolve(directory, `.${filename}.${randomUUID()}.external.tmp`),
      target_absolute_path: targetPath,
    };
    this.externalWrites.set(session.session_id, { session, overwrite, replaced });
    return session;
  }

  async publishExternalWrite(session: ArtifactExternalWriteSession): Promise<ArtifactWriteResult> {
    const prepared = this.externalWrites.get(session.session_id);
    if (!prepared || !sameExternalSession(prepared.session, session)) {
      throw new ArtifactStoreStateError('External artifact write session is unknown or already closed');
    }
    this.externalWrites.delete(session.session_id);
    const directory = resolve(session.target_absolute_path, '..');
    try {
      const staged = await lstat(session.staging_absolute_path);
      if (staged.isSymbolicLink() || !staged.isFile()) {
        throw new ArtifactStoreStateError(
          `External artifact staging output "${session.staging_absolute_path}" is not a regular file`,
        );
      }
      const handle = await open(session.staging_absolute_path, 'r');
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
      const sha256 = await sha256File(session.staging_absolute_path);
      if (prepared.overwrite === 'forbid') {
        try {
          await link(session.staging_absolute_path, session.target_absolute_path);
        } catch (error) {
          if (isNodeError(error) && error.code === 'EEXIST') {
            throw new ArtifactStoreConflictError(`Artifact "${session.relative_path}" already exists`);
          }
          throw error;
        }
        await unlink(session.staging_absolute_path);
      } else {
        await rename(session.staging_absolute_path, session.target_absolute_path);
      }
      await syncDirectory(directory);
      return {
        relative_path: session.relative_path,
        absolute_path: session.target_absolute_path,
        byte_size: staged.size,
        sha256,
        replaced: prepared.replaced,
      };
    } catch (error) {
      await unlink(session.staging_absolute_path).catch(unlinkError => {
        if (!isNodeError(unlinkError) || unlinkError.code !== 'ENOENT') throw unlinkError;
      });
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new ArtifactStoreStateError(
          `External artifact runner did not create output file "${session.relative_path}"`,
        );
      }
      throw error;
    }
  }

  async abortExternalWrite(session: ArtifactExternalWriteSession): Promise<void> {
    const prepared = this.externalWrites.get(session.session_id);
    if (!prepared || !sameExternalSession(prepared.session, session)) return;
    this.externalWrites.delete(session.session_id);
    await unlink(session.staging_absolute_path).catch(error => {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
    });
  }

  private async writeBuffer(
    relativePath: string,
    content: Buffer,
    overwrite: ArtifactOverwritePolicy,
  ): Promise<ArtifactWriteResult> {
    const normalizedPath = this.normalizeRelativePath(relativePath);
    const segments = normalizedPath.split('/');
    const filename = segments.at(-1)!;
    const directory = await this.ensureSafeDirectory(segments.slice(0, -1));
    const targetPath = resolve(directory, filename);
    const replaced = await this.inspectTarget(targetPath, overwrite);
    const temporaryPath = resolve(directory, `.${filename}.${randomUUID()}.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;

    try {
      handle = await open(temporaryPath, 'wx', 0o600);
      await handle.writeFile(content);
      await handle.sync();
      await handle.close();
      handle = undefined;

      if (overwrite === 'forbid') {
        try {
          await link(temporaryPath, targetPath);
        } catch (error) {
          if (isNodeError(error) && error.code === 'EEXIST') {
            throw new ArtifactStoreConflictError(`Artifact "${normalizedPath}" already exists`);
          }
          throw error;
        }
        await unlink(temporaryPath);
      } else {
        await rename(temporaryPath, targetPath);
      }
      await syncDirectory(directory);
    } finally {
      await handle?.close().catch(() => undefined);
      await unlink(temporaryPath).catch(error => {
        if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      });
    }

    return {
      relative_path: normalizedPath,
      absolute_path: targetPath,
      byte_size: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
      replaced,
    };
  }

  private normalizeRelativePath(relativePath: string): string {
    if (
      !relativePath
      || relativePath.length > MAX_RELATIVE_PATH_LENGTH
      || isAbsolute(relativePath)
      || relativePath.includes('\\')
      || /[\u0000-\u001f\u007f]/.test(relativePath)
    ) {
      throw new ArtifactStorePathError(`Invalid artifact path "${relativePath}"`);
    }
    const segments = relativePath.split('/');
    if (segments.some(segment => (
      !segment
      || segment === '.'
      || segment === '..'
      || segment.length > MAX_PATH_SEGMENT_LENGTH
    ))) {
      throw new ArtifactStorePathError(`Invalid artifact path "${relativePath}"`);
    }
    return segments.join('/');
  }

  private async ensureSafeDirectory(segments: readonly string[]): Promise<string> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await assertDirectoryWithoutSymlink(this.root, 'Artifact root');

    let current = this.root;
    for (const segment of segments) {
      current = resolve(current, segment);
      try {
        await assertDirectoryWithoutSymlink(current, 'Artifact parent');
      } catch (error) {
        if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
        await mkdir(current, { mode: 0o700 });
        await assertDirectoryWithoutSymlink(current, 'Artifact parent');
      }
    }
    return current;
  }

  private async safeExistingDirectory(path: string): Promise<boolean> {
    try {
      await assertDirectoryWithoutSymlink(path, 'Artifact path');
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  private async inspectTarget(
    targetPath: string,
    overwrite: ArtifactOverwritePolicy,
  ): Promise<boolean> {
    try {
      const target = await lstat(targetPath);
      if (target.isSymbolicLink() || !target.isFile()) {
        throw new ArtifactStorePathError(`Artifact target "${targetPath}" is not a regular file`);
      }
      if (overwrite === 'forbid') {
        throw new ArtifactStoreConflictError(`Artifact target "${targetPath}" already exists`);
      }
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return false;
      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function sameExternalSession(
  left: ArtifactExternalWriteSession,
  right: ArtifactExternalWriteSession,
): boolean {
  return left.session_id === right.session_id
    && left.relative_path === right.relative_path
    && left.staging_absolute_path === right.staging_absolute_path
    && left.target_absolute_path === right.target_absolute_path;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', rejectPromise);
    stream.on('end', resolvePromise);
  });
  return hash.digest('hex');
}

async function assertDirectoryWithoutSymlink(path: string, label: string): Promise<void> {
  const target = await lstat(path);
  if (target.isSymbolicLink() || !target.isDirectory()) {
    throw new ArtifactStorePathError(`${label} "${path}" is not a regular directory`);
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
