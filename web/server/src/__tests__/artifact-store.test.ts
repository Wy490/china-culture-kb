import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ArtifactStoreConflictError,
  ArtifactStorePathError,
  ArtifactStoreStateError,
  FileArtifactStore,
} from '../repositories/artifact-store.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('FileArtifactStore', () => {
  it('keeps application-generated AI comic series sidecars behind ArtifactStore', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'src/services/ai-comic-series-service.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/\bwriteFile\s*\(/);
    expect(source).not.toMatch(/\bmkdir\s*\(/);
    expect(source).toContain('new FileArtifactStore(projectDir)');
    expect(source).toContain('prepareExternalWrite');
  });

  it('durably writes nested text and binary artifacts with stable metadata', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-store-'));
    try {
      const store = new FileArtifactStore(root);
      const text = await store.writeText('exports/board.md', '# Production Board');
      const binary = await store.writeBinary('uploads/frame.bin', Uint8Array.from([0, 1, 2, 255]));

      expect(text).toEqual({
        relative_path: 'exports/board.md',
        absolute_path: resolve(root, 'exports', 'board.md'),
        byte_size: Buffer.byteLength('# Production Board'),
        sha256: createHash('sha256').update('# Production Board').digest('hex'),
        replaced: false,
      });
      expect(await readFile(text.absolute_path, 'utf8')).toBe('# Production Board');
      expect([...await readFile(binary.absolute_path)]).toEqual([0, 1, 2, 255]);
      expect(await store.exists('exports/board.md')).toBe(true);
      expect(await store.exists('exports/missing.md')).toBe(false);
      expect((await readdir(resolve(root, 'exports'))).some(name => name.endsWith('.tmp'))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('publishes external runner output atomically without buffering the media file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-external-'));
    try {
      const store = new FileArtifactStore(root);
      const session = await store.prepareExternalWrite('media/cut.mp4');
      const bytes = Buffer.from('fake-runner-media-bytes');
      await writeFile(session.staging_absolute_path, bytes);

      const result = await store.publishExternalWrite(session);
      expect(result).toMatchObject({
        relative_path: 'media/cut.mp4',
        absolute_path: resolve(root, 'media', 'cut.mp4'),
        byte_size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        replaced: false,
      });
      expect(await readFile(result.absolute_path)).toEqual(bytes);
      await expect(store.publishExternalWrite(session))
        .rejects.toBeInstanceOf(ArtifactStoreStateError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('aborts external output and fails closed when a runner creates no regular file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-external-failure-'));
    const outside = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-external-outside-'));
    try {
      const store = new FileArtifactStore(root);
      const aborted = await store.prepareExternalWrite('media/aborted.mp4');
      await writeFile(aborted.staging_absolute_path, 'partial-output');
      await store.abortExternalWrite(aborted);
      expect(await store.exists('media/aborted.mp4')).toBe(false);
      await expect(store.publishExternalWrite(aborted))
        .rejects.toBeInstanceOf(ArtifactStoreStateError);

      const missing = await store.prepareExternalWrite('media/missing.mp4');
      await expect(store.publishExternalWrite(missing))
        .rejects.toBeInstanceOf(ArtifactStoreStateError);

      const marker = resolve(outside, 'marker.mp4');
      await writeFile(marker, 'outside-preserved');
      const linked = await store.prepareExternalWrite('media/linked.mp4');
      await symlink(marker, linked.staging_absolute_path);
      await expect(store.publishExternalWrite(linked))
        .rejects.toBeInstanceOf(ArtifactStoreStateError);
      expect(await readFile(marker, 'utf8')).toBe('outside-preserved');
      expect(await store.exists('media/linked.mp4')).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('forbids accidental overwrite and permits only an explicit atomic replacement', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-overwrite-'));
    try {
      const store = new FileArtifactStore(root);
      await store.writeText('manifest.json', '{"version":1}');
      await expect(store.writeText('manifest.json', '{"version":2}'))
        .rejects.toBeInstanceOf(ArtifactStoreConflictError);
      expect(await readFile(resolve(root, 'manifest.json'), 'utf8')).toBe('{"version":1}');

      const replacement = await store.writeText(
        'manifest.json',
        '{"version":2}',
        { overwrite: 'replace' },
      );
      expect(replacement.replaced).toBe(true);
      expect(await readFile(resolve(root, 'manifest.json'), 'utf8')).toBe('{"version":2}');
      expect((await readdir(root)).some(name => name.endsWith('.tmp'))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('validates every batch path before writing and rejects duplicate targets', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-batch-'));
    try {
      const store = new FileArtifactStore(root);
      await expect(store.writeBatch([
        { relative_path: 'safe/first.txt', content: 'first' },
        { relative_path: '../outside.txt', content: 'outside' },
      ])).rejects.toBeInstanceOf(ArtifactStorePathError);
      expect(await readdir(root)).toEqual([]);

      await expect(store.writeBatch([
        { relative_path: 'same.json', content: '{}' },
        { relative_path: 'same.json', content: '[]' },
      ])).rejects.toBeInstanceOf(ArtifactStoreConflictError);

      const results = await store.writeBatch([
        { relative_path: 'board.json', content: '{"ok":true}' },
        { relative_path: 'board.md', content: '# Board' },
      ]);
      expect(results.map(item => item.relative_path)).toEqual(['board.json', 'board.md']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects absolute, traversal, backslash and control-character paths', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-path-'));
    try {
      const store = new FileArtifactStore(root);
      for (const path of ['/tmp/escape', '../escape', 'nested/../../escape', 'nested\\escape', 'bad\nname']) {
        await expect(store.writeText(path, 'blocked')).rejects.toBeInstanceOf(ArtifactStorePathError);
      }
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed on symlink parents and symlink targets without changing outside files', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-symlink-'));
    const outside = await mkdtemp(resolve(tmpdir(), 'story-agent-artifact-outside-'));
    try {
      const store = new FileArtifactStore(root);
      const outsideFile = resolve(outside, 'preserve.txt');
      await writeFile(outsideFile, 'preserve-me');
      await symlink(outside, resolve(root, 'linked-parent'));
      await expect(store.writeText('linked-parent/new.txt', 'blocked', { overwrite: 'replace' }))
        .rejects.toBeInstanceOf(ArtifactStorePathError);

      await symlink(outsideFile, resolve(root, 'linked-target.txt'));
      await expect(store.writeText('linked-target.txt', 'blocked', { overwrite: 'replace' }))
        .rejects.toBeInstanceOf(ArtifactStorePathError);
      expect(await readFile(outsideFile, 'utf8')).toBe('preserve-me');
      expect(await readdir(outside)).toEqual(['preserve.txt']);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('maps path and overwrite failures to the unified 400/409 API envelope', async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status } as never;
    const next = vi.fn();

    errorHandler(
      new ArtifactStorePathError('invalid artifact path'),
      {} as never,
      response,
      next,
    );
    expect(status).toHaveBeenLastCalledWith(400);
    expect(json.mock.lastCall?.[0]?.error?.code).toBe('ARTIFACT_PATH_INVALID');

    errorHandler(
      new ArtifactStoreConflictError('artifact already exists'),
      {} as never,
      response,
      next,
    );
    expect(status).toHaveBeenLastCalledWith(409);
    expect(json.mock.lastCall?.[0]?.error?.code).toBe('ARTIFACT_WRITE_CONFLICT');
  });
});
