import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult, VideoType } from '@shared/types.js';
import {
  FileStoryRepository,
  StoryRepositoryConflictError,
  StoryRepositoryPathError,
  StoryRepositoryStateError,
} from '../repositories/story-repository.js';

function story(
  storyId = '20260715-story-repository',
  videoType: VideoType = 'ai_comic_drama',
  title = 'Story repository contract',
): StoryGenerateResult {
  return {
    storyId,
    title,
    video_type: videoType,
    generation_type: videoType,
    presentation_style: 'ai_comic',
    source_entry: 'repository-test-entry',
    logline: 'A story repository preserves one canonical document.',
    credibility_note: 'Machine fixture only.',
    scene_breakdown: [],
    gears_segments: [],
  } as unknown as StoryGenerateResult;
}

describe('FileStoryRepository', () => {
  it('keeps canonical story and project state writes behind repository boundaries', async () => {
    const storyServiceSource = await readFile(
      resolve(process.cwd(), 'src/services/story-service.ts'),
      'utf8',
    );
    const seriesServiceSource = await readFile(
      resolve(process.cwd(), 'src/services/ai-comic-series-service.ts'),
      'utf8',
    );
    expect(storyServiceSource).not.toMatch(/\bwriteFile\s*\(/);
    expect(storyServiceSource).not.toMatch(/\bmkdir\s*\(/);
    expect(seriesServiceSource).not.toContain('writeFile(storyPath');
    expect(seriesServiceSource).not.toContain('projectVersionPath');
    expect(seriesServiceSource).not.toContain('projectMetaPath');
  });

  it('creates, lists and reads a story without overwriting an existing id', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-repository-'));
    try {
      const repository = new FileStoryRepository(root);
      const initial = story();
      expect(await repository.create(initial)).toBe('created');
      expect(await repository.create({ ...initial, title: 'must not win' })).toBe('exists');
      const documents = await repository.list(['ai_comic_drama']);
      expect(documents).toHaveLength(1);
      expect(documents[0].story).toEqual(initial);
      expect(documents[0].revision).toMatch(/^[a-f0-9]{64}$/);
      expect((await repository.read(initial.storyId))?.story.title).toBe(initial.title);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses exact-byte revisions so a stale writer cannot replace the winner', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-conflict-'));
    try {
      const repository = new FileStoryRepository(root);
      const initial = story();
      await repository.create(initial);
      const revision = (await repository.read(initial.storyId))!.revision;
      await repository.replace({ ...initial, title: 'winner' }, revision);
      await expect(repository.replace({ ...initial, title: 'stale' }, revision))
        .rejects.toBeInstanceOf(StoryRepositoryConflictError);
      expect((await repository.read(initial.storyId))?.story.title).toBe('winner');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the same story id exists in more than one video type', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-duplicate-'));
    try {
      const storyId = 'duplicate-story';
      for (const videoType of ['ai_comic_drama', 'historical_drama'] as const) {
        const directory = resolve(root, videoType);
        await mkdir(directory, { recursive: true });
        await writeFile(resolve(directory, `${storyId}.json`), JSON.stringify(story(storyId, videoType)));
      }
      const repository = new FileStoryRepository(root);
      await expect(repository.read(storyId)).rejects.toBeInstanceOf(StoryRepositoryStateError);
      await expect(repository.list()).rejects.toBeInstanceOf(StoryRepositoryStateError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects traversal and symlink type directories without changing the external target', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-path-'));
    const outside = await mkdtemp(resolve(tmpdir(), 'story-agent-story-outside-'));
    try {
      const repository = new FileStoryRepository(root);
      const marker = resolve(outside, 'marker.txt');
      await writeFile(marker, 'preserve-me');
      expect(await repository.read('../outside')).toBeNull();
      await expect(repository.create(story('../outside')))
        .rejects.toBeInstanceOf(StoryRepositoryPathError);

      await symlink(outside, resolve(root, 'historical_drama'));
      await expect(repository.create(story('symlink-story', 'historical_drama')))
        .rejects.toBeInstanceOf(StoryRepositoryPathError);
      const storyDirectory = resolve(root, 'ai_comic_drama');
      await mkdir(storyDirectory);
      await symlink(marker, resolve(storyDirectory, 'linked-story.json'));
      await expect(repository.read('linked-story'))
        .rejects.toBeInstanceOf(StoryRepositoryPathError);
      await expect(repository.list(['ai_comic_drama']))
        .rejects.toBeInstanceOf(StoryRepositoryPathError);
      expect(await readFile(marker, 'utf8')).toBe('preserve-me');
      expect(await readdir(outside)).toEqual(['marker.txt']);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('fails closed for malformed JSON and embedded identity mismatches', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-state-'));
    try {
      const storyId = 'malformed-story';
      const directory = resolve(root, 'ai_comic_drama');
      const filePath = resolve(directory, `${storyId}.json`);
      await mkdir(directory, { recursive: true });
      await writeFile(filePath, '{broken-json');
      const repository = new FileStoryRepository(root);
      await expect(repository.read(storyId)).rejects.toBeInstanceOf(StoryRepositoryStateError);

      await writeFile(filePath, JSON.stringify(story('different-story')));
      await expect(repository.read(storyId)).rejects.toBeInstanceOf(StoryRepositoryStateError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves the winner and cleans transient files after an atomic-write fault', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-atomic-'));
    try {
      const stableRepository = new FileStoryRepository(root);
      const initial = story();
      await stableRepository.create(initial);
      const revision = (await stableRepository.read(initial.storyId))!.revision;
      const failingRepository = new FileStoryRepository(root, {
        fault_injector(point) {
          if (point === 'after_temp_fsync') throw new Error('injected-after-temp-fsync');
        },
      });
      await expect(failingRepository.replace({ ...initial, title: 'must not win' }, revision))
        .rejects.toThrow('injected-after-temp-fsync');
      expect((await stableRepository.read(initial.storyId))?.story).toEqual(initial);
      expect(await readdir(resolve(root, 'ai_comic_drama'))).toEqual([`${initial.storyId}.json`]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed on an external writer lock and preserves its evidence', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-lock-'));
    try {
      const repository = new FileStoryRepository(root);
      const initial = story();
      await repository.create(initial);
      const revision = (await repository.read(initial.storyId))!.revision;
      const lockPath = resolve(root, `.story-repository.${initial.storyId}.lock`);
      await writeFile(lockPath, 'external-writer');
      await expect(repository.replace({ ...initial, title: 'blocked' }, revision))
        .rejects.toBeInstanceOf(StoryRepositoryConflictError);
      expect(await readFile(lockPath, 'utf8')).toBe('external-writer');
      expect((await repository.read(initial.storyId))?.story).toEqual(initial);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('archives a dead same-host lock before completing the next write', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-dead-lock-'));
    try {
      const repository = new FileStoryRepository(root);
      const initial = story();
      await repository.create(initial);
      const revision = (await repository.read(initial.storyId))!.revision;
      await writeFile(resolve(root, `.story-repository.${initial.storyId}.lock`), JSON.stringify({
        schema_version: 'story-agent-story-repository-lock/v1',
        owner_pid: 2_147_483_647,
        owner_host: hostname(),
        acquired_at: '2026-07-15T00:00:00.000Z',
        nonce: 'dead-story-writer',
      }));

      await repository.replace({ ...initial, title: 'recovered' }, revision);
      expect((await repository.read(initial.storyId))?.story.title).toBe('recovered');
      const files = await readdir(root);
      expect(files.some(file => file.includes('.stale-owner-') && file.endsWith('.archive'))).toBe(true);
      expect(files).not.toContain(`.story-repository.${initial.storyId}.lock`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
