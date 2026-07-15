import {
  lstat,
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
import type { AiComicSeriesProjectDetail } from '@shared/types.js';
import {
  FileSeriesProjectRepository,
  SeriesProjectRepositoryConflictError,
  SeriesProjectRepositoryPathError,
  SeriesProjectRepositoryStateError,
} from '../repositories/series-project-repository.js';

function seriesDetail(
  seriesProjectId = '20260715-series-repository',
  updatedAt = '2026-07-15T00:00:00.000Z',
  title = 'Series repository contract',
): AiComicSeriesProjectDetail {
  return {
    project: {
      series_project_id: seriesProjectId,
      title,
      episode_count: 1,
      episode_duration_range_sec: { min: 60, max: 120 },
      pacing_profile: 'balanced_drama',
      logline: 'A repository boundary preserves a long-form series.',
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: updatedAt,
      generated_episode_count: 0,
    },
    plan: { schema_version: 'ai-comic-series-plan/v1' },
    generated_episode_story_ids: {},
    continuity_ledger: { schema_version: 'ai-comic-continuity-ledger/v1' },
  } as unknown as AiComicSeriesProjectDetail;
}

describe('FileSeriesProjectRepository', () => {
  it('keeps every series project.json state mutation behind the repository boundary', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'src/services/ai-comic-series-service.ts'),
      'utf8',
    );
    expect(source).not.toContain('writeJsonFile(seriesProjectPath');
    expect(source).not.toMatch(/writeFile\(\s*seriesProjectPath/);
    expect(source).not.toContain('async function writeJsonFile(');
  });

  it('creates, lists and reads a series without overwriting the existing project', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-series-repository-'));
    try {
      const repository = new FileSeriesProjectRepository(root);
      const detail = seriesDetail();
      expect(await repository.create(detail)).toBe('created');
      expect(await repository.create({ ...detail, project: { ...detail.project, title: 'must not win' } }))
        .toBe('exists');
      expect(await repository.listProjectIds()).toEqual([detail.project.series_project_id]);
      expect(await repository.read(detail.project.series_project_id)).toEqual(detail);
      expect(await readdir(resolve(root, detail.project.series_project_id)))
        .toEqual(['project.json']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses updated_at expectations so a stale writer cannot replace the winner', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-series-conflict-'));
    try {
      const repository = new FileSeriesProjectRepository(root);
      const initial = seriesDetail();
      await repository.create(initial);
      const winner = seriesDetail(
        initial.project.series_project_id,
        '2026-07-15T00:01:00.000Z',
        'optimistic winner',
      );
      const stale = seriesDetail(
        initial.project.series_project_id,
        '2026-07-15T00:01:01.000Z',
        'stale writer',
      );

      await repository.replace(winner, { updated_at: initial.project.updated_at });
      await expect(repository.replace(stale, { updated_at: initial.project.updated_at }))
        .rejects.toBeInstanceOf(SeriesProjectRepositoryConflictError);
      await expect(repository.replace({
        ...winner,
        project: { ...winner.project, title: 'timestamp reuse' },
      }, { updated_at: winner.project.updated_at }))
        .rejects.toBeInstanceOf(SeriesProjectRepositoryConflictError);
      expect((await repository.read(initial.project.series_project_id))?.project.title)
        .toBe(winner.project.title);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reads and replaces a compatibility-root project without forking it into the primary root', async () => {
    const parent = await mkdtemp(resolve(tmpdir(), 'story-agent-series-fallback-'));
    const primaryRoot = resolve(parent, 'primary');
    const fallbackRoot = resolve(parent, 'fallback');
    try {
      const original = seriesDetail('compatibility-series');
      await new FileSeriesProjectRepository(fallbackRoot).create(original);
      const repository = new FileSeriesProjectRepository(primaryRoot, {
        fallback_roots: [fallbackRoot],
      });
      expect(await repository.listProjectIds()).toEqual([original.project.series_project_id]);
      expect(await repository.read(original.project.series_project_id)).toEqual(original);

      const updated = seriesDetail(
        original.project.series_project_id,
        '2026-07-15T00:02:00.000Z',
        'compatibility root winner',
      );
      await repository.replace(updated, { updated_at: original.project.updated_at });
      expect(JSON.parse(await readFile(
        resolve(fallbackRoot, original.project.series_project_id, 'project.json'),
        'utf8',
      ))).toEqual(updated);
      await expect(lstat(primaryRoot)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('rejects traversal and symlink project directories without changing the external target', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-series-path-'));
    const outside = await mkdtemp(resolve(tmpdir(), 'story-agent-series-outside-'));
    try {
      const repository = new FileSeriesProjectRepository(root);
      const marker = resolve(outside, 'marker.txt');
      await writeFile(marker, 'preserve-me');
      expect(await repository.read('../outside')).toBeNull();
      await expect(repository.create(seriesDetail('../outside')))
        .rejects.toBeInstanceOf(SeriesProjectRepositoryPathError);

      const seriesProjectId = 'symlink-series';
      await symlink(outside, resolve(root, seriesProjectId));
      await expect(repository.create(seriesDetail(seriesProjectId)))
        .rejects.toBeInstanceOf(SeriesProjectRepositoryPathError);
      expect(await readFile(marker, 'utf8')).toBe('preserve-me');
      expect(await readdir(outside)).toEqual(['marker.txt']);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('fails closed for malformed JSON and embedded identity mismatches', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-series-state-'));
    try {
      const seriesProjectId = 'malformed-series';
      const directory = resolve(root, seriesProjectId);
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'project.json'), '{broken-json');
      const repository = new FileSeriesProjectRepository(root);
      await expect(repository.read(seriesProjectId))
        .rejects.toBeInstanceOf(SeriesProjectRepositoryStateError);

      await writeFile(
        resolve(directory, 'project.json'),
        JSON.stringify(seriesDetail(seriesProjectId, 'not-a-date')),
      );
      await expect(repository.read(seriesProjectId))
        .rejects.toBeInstanceOf(SeriesProjectRepositoryStateError);

      await writeFile(
        resolve(directory, 'project.json'),
        JSON.stringify(seriesDetail('different-series')),
      );
      await expect(repository.read(seriesProjectId))
        .rejects.toBeInstanceOf(SeriesProjectRepositoryStateError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves the previous project and cleans transient files after an atomic-write fault', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-series-atomic-'));
    try {
      const stableRepository = new FileSeriesProjectRepository(root);
      const initial = seriesDetail();
      await stableRepository.create(initial);
      const failingRepository = new FileSeriesProjectRepository(root, {
        fault_injector(point) {
          if (point === 'after_temp_fsync') throw new Error('injected-after-temp-fsync');
        },
      });
      const target = seriesDetail(
        initial.project.series_project_id,
        '2026-07-15T00:03:00.000Z',
        'must not become visible',
      );

      await expect(failingRepository.replace(target, { updated_at: initial.project.updated_at }))
        .rejects.toThrow('injected-after-temp-fsync');
      expect(await stableRepository.read(initial.project.series_project_id)).toEqual(initial);
      expect(await readdir(resolve(root, initial.project.series_project_id)))
        .toEqual(['project.json']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed on an external writer lock and preserves its evidence', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-series-lock-'));
    try {
      const repository = new FileSeriesProjectRepository(root);
      const initial = seriesDetail();
      await repository.create(initial);
      const directory = resolve(root, initial.project.series_project_id);
      const lockPath = resolve(directory, '.series-project-repository.lock');
      await writeFile(lockPath, 'external-writer');

      const target = seriesDetail(
        initial.project.series_project_id,
        '2026-07-15T00:04:00.000Z',
        'blocked writer',
      );
      await expect(repository.replace(target, { updated_at: initial.project.updated_at }))
        .rejects.toBeInstanceOf(SeriesProjectRepositoryConflictError);
      expect(await readFile(lockPath, 'utf8')).toBe('external-writer');
      expect(await repository.read(initial.project.series_project_id)).toEqual(initial);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('archives a dead same-host lock before completing the next optimistic write', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-series-dead-lock-'));
    try {
      const repository = new FileSeriesProjectRepository(root);
      const initial = seriesDetail();
      await repository.create(initial);
      const directory = resolve(root, initial.project.series_project_id);
      await writeFile(resolve(directory, '.series-project-repository.lock'), JSON.stringify({
        schema_version: 'story-agent-series-project-repository-lock/v1',
        owner_pid: 2_147_483_647,
        owner_host: hostname(),
        acquired_at: '2026-07-15T00:04:30.000Z',
        nonce: 'dead-series-writer',
      }));
      const target = seriesDetail(
        initial.project.series_project_id,
        '2026-07-15T00:05:00.000Z',
        'recovered after dead lock',
      );

      await repository.replace(target, { updated_at: initial.project.updated_at });
      expect(await repository.read(initial.project.series_project_id)).toEqual(target);
      const files = await readdir(directory);
      expect(files.some(file => file.includes('.stale-owner-') && file.endsWith('.archive'))).toBe(true);
      expect(files).not.toContain('.series-project-repository.lock');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
