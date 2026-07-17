import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  StoryGenerateResult,
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import {
  createProjectFromGeneratedStory,
  getProject,
  listProjects,
} from '../services/project-service.js';
import {
  InvalidProjectRepositoryIdentifierError,
  projectRepositoryLogicalSha256,
  ProjectRepositoryConflictError,
} from '../repositories/project-repository.js';
import {
  isNodeSqliteRuntimeAvailable,
  SqliteProjectRepository,
} from '../repositories/sqlite-project-repository.js';

const roots: string[] = [];
const require = createRequire(import.meta.url);
const sqliteIt = isNodeSqliteRuntimeAvailable() ? it : it.skip;
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;
const previousProvider = process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
const previousSqlitePath = process.env.STORY_PROJECT_SQLITE_PATH;

function projectMeta(
  projectId = '20260716-sqlite-repository--ai_comic_drama',
  versionId = `${projectId}-v1`,
  versionCount = 1,
): StoryProjectMeta {
  return {
    project_id: projectId,
    current_story_id: '20260716-sqlite-repository',
    title: 'SQLite repository contract project',
    source_domain: 'china_culture',
    source_entry: 'test-entry',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    status: versionCount > 1 ? 'edited' : 'draft',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: `2026-07-16T00:00:0${versionCount}.000Z`,
    current_version_id: versionId,
    version_count: versionCount,
    scene_count: 1,
    has_gears_segments: true,
    credibility_note: 'machine contract only',
    logline: 'A transactional repository preserves project versions.',
  };
}

function snapshot(meta: StoryProjectMeta): StoryProjectVersionSnapshot {
  return {
    project_id: meta.project_id,
    version_id: meta.current_version_id,
    created_at: meta.updated_at,
    change_type: meta.version_count === 1 ? 'initial_generation' : 'quality_repair',
    scene_ids_changed: meta.version_count === 1 ? [] : [1],
    story: {
      storyId: meta.current_story_id,
      sourceDomain: meta.source_domain,
      project_id: meta.project_id,
      current_version_id: meta.current_version_id,
      title: meta.title,
      source_entry: meta.source_entry,
      video_type: meta.video_type,
      presentation_style: meta.presentation_style,
      credibility_note: meta.credibility_note,
      logline: meta.logline,
      scene_breakdown: [],
      gears_segments: [],
    } as unknown as StoryProjectVersionSnapshot['story'],
  };
}

function serviceStory(storyId: string): StoryGenerateResult {
  return {
    storyId,
    sourceDomain: 'china_culture',
    title: 'SQLite service boundary',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: 'SQLite service fixture',
    logline: 'The project service works through a selected repository provider.',
    credibility_note: 'Machine fixture only.',
    scene_breakdown: [],
    gears_segments: [],
  } as unknown as StoryGenerateResult;
}

afterEach(async () => {
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  if (previousProvider === undefined) delete process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
  else process.env.STORY_PROJECT_REPOSITORY_PROVIDER = previousProvider;
  if (previousSqlitePath === undefined) delete process.env.STORY_PROJECT_SQLITE_PATH;
  else process.env.STORY_PROJECT_SQLITE_PATH = previousSqlitePath;
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('SqliteProjectRepository', () => {
  sqliteIt('implements version CRUD and three-field optimistic concurrency in transactions', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-sqlite-repository-'));
    roots.push(root);
    const repository = new SqliteProjectRepository(resolve(root, 'projects.sqlite3'));
    const initial = projectMeta();

    expect(await repository.createInitial(initial, snapshot(initial))).toBe('created');
    expect(await repository.createInitial({ ...initial, title: 'must not overwrite' }, snapshot(initial)))
      .toBe('exists');
    expect(await repository.listProjectIds()).toEqual([initial.project_id]);
    expect(await repository.readMeta(initial.project_id)).toEqual(initial);

    const winner = projectMeta(initial.project_id, `${initial.project_id}-v2-winner`, 2);
    const stale = projectMeta(initial.project_id, `${initial.project_id}-v2-stale`, 2);
    const expectation = {
      current_version_id: initial.current_version_id,
      version_count: initial.version_count,
      updated_at: initial.updated_at,
    };
    await repository.commitVersion(winner, snapshot(winner), expectation);
    await expect(repository.commitVersion(stale, snapshot(stale), expectation))
      .rejects.toBeInstanceOf(ProjectRepositoryConflictError);
    expect(await repository.readVersion(initial.project_id, stale.current_version_id)).toBeNull();

    const currentState = {
      ...winner,
      title: 'SQLite current-state winner',
      updated_at: '2026-07-16T00:01:00.000Z',
    };
    await repository.writeCurrentState(currentState, snapshot(currentState), {
      current_version_id: winner.current_version_id,
      version_count: winner.version_count,
      updated_at: winner.updated_at,
    });
    expect((await repository.readMeta(initial.project_id))?.title).toBe(currentState.title);
    expect((await repository.readVersionSnapshots(initial.project_id)).map(item => item.version_id))
      .toEqual([winner.current_version_id, initial.current_version_id]);
    expect(await repository.inspect()).toMatchObject({
      integrity_check: 'ok',
      foreign_key_violation_count: 0,
      project_count: 1,
      version_count: 2,
    });
  });

  sqliteIt('fails closed when indexed JSON is tampered without updating its integrity hash', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-sqlite-integrity-'));
    roots.push(root);
    const databasePath = resolve(root, 'projects.sqlite3');
    const repository = new SqliteProjectRepository(databasePath);
    const initial = projectMeta();
    await repository.createInitial(initial, snapshot(initial));

    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
    const database = new DatabaseSync(databasePath);
    database.prepare('UPDATE project_meta SET body = ? WHERE project_id = ?')
      .run(JSON.stringify({ ...initial, title: 'tampered' }), initial.project_id);
    database.close();

    await expect(repository.readMeta(initial.project_id))
      .rejects.toBeInstanceOf(ProjectRepositoryConflictError);
  });

  sqliteIt('creates a non-overwriting verified backup and reproduces the logical repository state', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-sqlite-backup-'));
    roots.push(root);
    const databasePath = resolve(root, 'projects.sqlite3');
    const backupPath = resolve(root, 'recovery', 'projects.backup.sqlite3');
    const repository = new SqliteProjectRepository(databasePath);
    const initial = projectMeta();
    await repository.createInitial(initial, snapshot(initial));
    const next = projectMeta(initial.project_id, `${initial.project_id}-v2-backup`, 2);
    await repository.commitVersion(next, snapshot(next), {
      current_version_id: initial.current_version_id,
      version_count: initial.version_count,
      updated_at: initial.updated_at,
    });

    const sourceBefore = await repository.inspect();
    const manifest = await repository.createVerifiedBackup(backupPath);
    const recovered = new SqliteProjectRepository(backupPath);

    expect(manifest).toMatchObject({
      schema_version: 'story-agent-sqlite-project-repository-backup/v1',
      project_count: 1,
      version_count: 2,
      logical_sha256: sourceBefore.logical_sha256,
      integrity_check: 'ok',
      foreign_key_violation_count: 0,
      source_unchanged: true,
      production_recovery_credit: false,
    });
    expect(manifest.backup_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await recovered.readMeta(initial.project_id)).toEqual(next);
    expect(await recovered.readVersionSnapshots(initial.project_id))
      .toEqual(await repository.readVersionSnapshots(initial.project_id));
    expect((await repository.inspect()).logical_sha256).toBe(sourceBefore.logical_sha256);
    await expect(repository.createVerifiedBackup(backupPath))
      .rejects.toBeInstanceOf(ProjectRepositoryConflictError);
  });

  sqliteIt('imports an exact multi-version logical state only into an empty transaction', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-sqlite-logical-import-'));
    roots.push(root);
    const repository = new SqliteProjectRepository(resolve(root, 'projects.sqlite3'));
    const initial = projectMeta();
    const current = projectMeta(initial.project_id, `${initial.project_id}-v2-imported`, 2);
    const second = projectMeta(
      '20260716-sqlite-repository-second--ai_comic_drama',
      '20260716-sqlite-repository-second--ai_comic_drama-v1',
      1,
    );
    const logicalState = {
      meta: [current, second],
      versions: [snapshot(initial), snapshot(current), snapshot(second)],
    };

    const inspection = await repository.importLogicalStateIntoEmpty(logicalState);
    expect(inspection).toMatchObject({
      project_count: 2,
      version_count: 3,
      logical_sha256: projectRepositoryLogicalSha256(logicalState),
      integrity_check: 'ok',
      foreign_key_violation_count: 0,
    });
    expect(await repository.readMeta(initial.project_id)).toEqual(current);
    expect(await repository.readVersion(initial.project_id, initial.current_version_id))
      .toEqual(snapshot(initial));
    expect(await repository.readVersionSnapshots(initial.project_id)).toEqual([
      snapshot(current),
      snapshot(initial),
    ]);
    await expect(repository.importLogicalStateIntoEmpty(logicalState))
      .rejects.toThrow('destination must be empty');
    expect((await repository.inspect()).logical_sha256).toBe(inspection.logical_sha256);

    const invalidRepository = new SqliteProjectRepository(resolve(root, 'invalid.sqlite3'));
    await expect(invalidRepository.importLogicalStateIntoEmpty({
      meta: [initial],
      versions: [snapshot({
        ...initial,
        project_id: second.project_id,
        current_version_id: second.current_version_id,
      })],
    })).rejects.toThrow('has no project metadata');
    expect(await invalidRepository.inspect()).toMatchObject({ project_count: 0, version_count: 0 });
  });

  sqliteIt('rejects snapshot identities that do not match the project and version keys', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-sqlite-identity-'));
    roots.push(root);
    const repository = new SqliteProjectRepository(resolve(root, 'projects.sqlite3'));
    const initial = projectMeta();
    const invalid = snapshot(initial);
    invalid.story.current_version_id = `${initial.project_id}-v99`;

    await expect(repository.createInitial(initial, invalid))
      .rejects.toBeInstanceOf(InvalidProjectRepositoryIdentifierError);
  });

  sqliteIt('runs create/list/detail through project-service with the selected SQLite provider', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-sqlite-service-'));
    roots.push(root);
    process.env.WEB_GENERATED_ROOT = resolve(root, 'generated');
    process.env.STORY_PROJECT_REPOSITORY_PROVIDER = 'sqlite';
    process.env.STORY_PROJECT_SQLITE_PATH = resolve(root, 'service-projects.sqlite3');
    const story = serviceStory('20260716-sqlite-service');

    const enriched = await createProjectFromGeneratedStory(story, '2026-07-16T02:00:00.000Z');
    const list = await listProjects('china_culture');
    const detail = await getProject(enriched.project_id!);

    expect(list.ok).toBe(true);
    expect(list.data?.map(item => item.project_id)).toEqual([enriched.project_id]);
    expect(detail.ok).toBe(true);
    expect(detail.data?.project).toMatchObject({
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      source_domain: 'china_culture',
    });
    expect(detail.data?.current_story.storyId).toBe(story.storyId);
  });
});
