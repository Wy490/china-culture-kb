import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProductAccessActor } from '@shared/product-access.js';
import type {
  StoryProjectFileToSqliteMigrationRequest,
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import { FileProjectRepository } from '../repositories/project-repository.js';
import {
  isNodeSqliteRuntimeAvailable,
  SqliteProjectRepository,
} from '../repositories/sqlite-project-repository.js';
import {
  getStoryProjectFileToSqliteMigrationPreflight,
  migrateStoryProjectFileToSqlite,
} from '../services/story-project-file-to-sqlite-migration-service.js';

const ENV_NAMES = [
  'WEB_GENERATED_ROOT',
  'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_TARGET_PATH',
  'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_WRITE_ENABLED',
  'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_AUDIT_JSONL',
] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_NAMES.map(name => [name, process.env[name]]));
const sqliteIt = isNodeSqliteRuntimeAvailable() ? it : it.skip;

const ADMIN: ProductAccessActor = {
  actor_id: 'repository-migration-admin',
  display_name: 'Repository Migration Admin',
  organization_id: 'migration-test',
  role: 'administrator',
  enabled_feature_flags: ['internal_story_tools'],
};

function meta(
  projectId: string,
  versionId = `${projectId}-v1`,
  versionCount = 1,
): StoryProjectMeta {
  return {
    project_id: projectId,
    current_story_id: `${projectId}-story`,
    title: `Project ${projectId}`,
    source_domain: 'china_culture',
    source_entry: 'migration fixture',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    status: versionCount > 1 ? 'edited' : 'draft',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: `2026-07-16T00:00:0${versionCount}.000Z`,
    current_version_id: versionId,
    version_count: versionCount,
    scene_count: 1,
    has_gears_segments: true,
    credibility_note: 'fixture only',
    logline: 'A file repository is migrated without changing its source.',
  };
}

function snapshot(project: StoryProjectMeta): StoryProjectVersionSnapshot {
  return {
    project_id: project.project_id,
    version_id: project.current_version_id,
    created_at: project.updated_at,
    change_type: project.version_count === 1 ? 'initial_generation' : 'quality_repair',
    scene_ids_changed: project.version_count === 1 ? [] : [1],
    story: {
      storyId: project.current_story_id,
      project_id: project.project_id,
      current_version_id: project.current_version_id,
      title: project.title,
      source_entry: project.source_entry,
      video_type: project.video_type,
      presentation_style: project.presentation_style,
      credibility_note: project.credibility_note,
      logline: project.logline,
      scene_breakdown: [],
      gears_segments: [],
    } as unknown as StoryProjectVersionSnapshot['story'],
  };
}

async function createSource(root: string): Promise<FileProjectRepository> {
  process.env.WEB_GENERATED_ROOT = resolve(root, 'generated');
  const repository = new FileProjectRepository(resolve(root, 'generated', 'projects'));
  const first = meta('20260716-file-migration-a--ai_comic_drama');
  await repository.createInitial(first, snapshot(first));
  const firstV2 = meta(first.project_id, `${first.project_id}-v2`, 2);
  await repository.commitVersion(firstV2, snapshot(firstV2), {
    current_version_id: first.current_version_id,
    version_count: first.version_count,
    updated_at: first.updated_at,
  });
  const second = meta('20260716-file-migration-b--ai_comic_drama');
  await repository.createInitial(second, snapshot(second));
  return repository;
}

async function sourceBytes(root: string): Promise<Record<string, string>> {
  const projectsRoot = resolve(root, 'generated', 'projects');
  const output: Record<string, string> = {};
  for (const projectId of await readdir(projectsRoot)) {
    output[`${projectId}/project.json`] = await readFile(
      resolve(projectsRoot, projectId, 'project.json'),
      'utf8',
    );
    for (const versionName of await readdir(resolve(projectsRoot, projectId, 'versions'))) {
      output[`${projectId}/versions/${versionName}`] = await readFile(
        resolve(projectsRoot, projectId, 'versions', versionName),
        'utf8',
      );
    }
  }
  return output;
}

function requestFor(logicalSha256: string, dryRun = true): StoryProjectFileToSqliteMigrationRequest {
  return {
    schema_version: 'story-project-file-to-sqlite-migration-request/v1',
    migration_id: 'file-to-sqlite-migration-0001',
    expected_source_logical_sha256: logicalSha256,
    review_reference: 'OPS-FILE-SQLITE-MIGRATION-0001',
    operator_confirmation: 'file_repository_snapshot_reviewed',
    dry_run: dryRun,
  };
}

afterEach(() => {
  for (const name of ENV_NAMES) {
    const value = ORIGINAL_ENV[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('Story project file-to-SQLite migration service', () => {
  sqliteIt('preflights, dry-runs, migrates all versions, and replays without touching source bytes', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-project-file-sqlite-migration-'));
    try {
      const sourceRepository = await createSource(root);
      const sourceInspection = await sourceRepository.inspectLogicalStateReadOnly();
      const before = await sourceBytes(root);
      const targetPath = resolve(root, 'target.sqlite3');
      process.env.STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_TARGET_PATH = targetPath;

      const preflight = await getStoryProjectFileToSqliteMigrationPreflight();
      expect(preflight).toMatchObject({
        source_provider: 'file',
        target_provider: 'sqlite',
        target_exists: false,
        source_project_count: 2,
        source_version_count: 3,
        source_logical_sha256: sourceInspection.logical_sha256,
        blockers: [],
        preflight_ready: true,
        source_pending_transactions_recovered: false,
        source_writeback_performed: false,
        target_write_performed: false,
        production_persistence_ready: false,
        real_credit_granted: false,
      });

      const request = requestFor(sourceInspection.logical_sha256);
      const dryRun = await migrateStoryProjectFileToSqlite({ request, actor: ADMIN });
      expect(dryRun).toMatchObject({
        dry_run: true,
        blockers: [],
        preflight_ready: true,
        applied: false,
        idempotent_replay: false,
        source_unchanged: true,
        destination_was_empty: true,
        history_overwrite_performed: false,
        active_provider_changed: false,
        real_credit_granted: false,
      });
      await expect(readFile(targetPath)).rejects.toMatchObject({ code: 'ENOENT' });

      const writeDisabled = await migrateStoryProjectFileToSqlite({
        request: { ...request, dry_run: false },
        actor: ADMIN,
      });
      expect(writeDisabled.blockers).toEqual(expect.arrayContaining([
        'sqlite_migration_write_disabled',
        'sqlite_migration_audit_missing',
      ]));
      expect(writeDisabled.applied).toBe(false);

      const auditDirectory = resolve(root, 'audit');
      await mkdir(auditDirectory);
      const auditPath = resolve(auditDirectory, 'file-to-sqlite.jsonl');
      process.env.STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_WRITE_ENABLED = 'true';
      process.env.STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_AUDIT_JSONL = auditPath;
      const applied = await migrateStoryProjectFileToSqlite({
        request: { ...request, dry_run: false },
        actor: ADMIN,
      });
      expect(applied).toMatchObject({
        blockers: [],
        preflight_ready: true,
        applied: true,
        idempotent_replay: false,
        target_logical_sha256: sourceInspection.logical_sha256,
        durable_intent_written: true,
        durable_completion_written: true,
        manifest: {
          schema_version: 'story-project-file-to-sqlite-migration-manifest/v1',
          source_project_count: 2,
          source_version_count: 3,
          source_logical_sha256: sourceInspection.logical_sha256,
          target_logical_sha256: sourceInspection.logical_sha256,
          destination_was_empty: true,
          history_overwrite_performed: false,
          active_provider_changed: false,
          production_persistence_ready: false,
          real_credit_granted: false,
        },
      });
      const targetRepository = new SqliteProjectRepository(targetPath);
      const targetInspection = await targetRepository.inspect();
      expect(targetInspection).toMatchObject({
        project_count: 2,
        version_count: 3,
        logical_sha256: sourceInspection.logical_sha256,
      });
      expect(await targetRepository.readVersionSnapshots(sourceInspection.state.meta[0]!.project_id))
        .toHaveLength(sourceInspection.state.meta[0]!.version_count);
      expect(await sourceBytes(root)).toEqual(before);
      expect(createHash('sha256').update(await readFile(targetPath)).digest('hex'))
        .toBe(applied.target_database_sha256);
      const events = (await readFile(auditPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      expect(events.map(event => event.phase)).toEqual(['intent', 'applied']);
      expect(events.every(event => event.real_credit_granted === false)).toBe(true);

      const replay = await migrateStoryProjectFileToSqlite({
        request: { ...request, dry_run: false },
        actor: ADMIN,
      });
      expect(replay).toMatchObject({
        blockers: [],
        applied: false,
        idempotent_replay: true,
        target_logical_sha256: sourceInspection.logical_sha256,
      });
      expect((await readFile(auditPath, 'utf8')).trim().split('\n')).toHaveLength(2);
      expect(await sourceBytes(root)).toEqual(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  sqliteIt('blocks an existing target and does not recover a pending source transaction', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-project-file-sqlite-blocked-'));
    try {
      const sourceRepository = await createSource(root);
      const sourceInspection = await sourceRepository.inspectLogicalStateReadOnly();
      const targetPath = resolve(root, 'target.sqlite3');
      process.env.STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_TARGET_PATH = targetPath;
      await writeFile(targetPath, 'pre-existing-user-data', 'utf8');
      const existing = await migrateStoryProjectFileToSqlite({
        request: requestFor(sourceInspection.logical_sha256),
        actor: ADMIN,
      });
      expect(existing.blockers).toContain('sqlite_migration_target_already_exists');
      expect(existing.applied).toBe(false);
      expect(await readFile(targetPath, 'utf8')).toBe('pre-existing-user-data');

      await rm(targetPath);
      const projectId = sourceInspection.state.meta[0]!.project_id;
      const transactionDirectory = resolve(root, 'generated', 'projects', projectId, '.transactions');
      await writeFile(resolve(transactionDirectory, 'pending.intent.json'), '{"pending":true}\n', 'utf8');
      const projectPath = resolve(root, 'generated', 'projects', projectId, 'project.json');
      const before = await readFile(projectPath, 'utf8');
      const preflight = await getStoryProjectFileToSqliteMigrationPreflight();
      expect(preflight.blockers).toContain('file_repository_pending_transactions_present');
      expect(preflight.source_pending_transactions_recovered).toBe(false);
      expect(preflight.source_writeback_performed).toBe(false);
      expect(await readFile(projectPath, 'utf8')).toBe(before);
      expect(await readFile(resolve(transactionDirectory, 'pending.intent.json'), 'utf8'))
        .toBe('{"pending":true}\n');
      await expect(readFile(targetPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
