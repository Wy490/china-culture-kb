import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { resolve } from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import type { StoryProjectMeta, StoryProjectVersionSnapshot } from '@shared/types.js';
import {
  FileProjectRepository,
  InvalidProjectRepositoryIdentifierError,
  ProjectRepositoryConflictError,
} from '../repositories/project-repository.js';
import { errorHandler } from '../middleware/error-handler.js';

function projectMeta(
  projectId = '20260715-story-repository--ai_comic_drama',
  versionId = `${projectId}-v1`,
  versionCount = 1,
): StoryProjectMeta {
  return {
    project_id: projectId,
    current_story_id: '20260715-story-repository',
    title: 'Repository contract project',
    source_domain: 'china_culture',
    source_entry: 'test-entry',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    status: versionCount > 1 ? 'edited' : 'draft',
    created_at: '2026-07-15T00:00:00.000Z',
    updated_at: `2026-07-15T00:00:0${versionCount}.000Z`,
    current_version_id: versionId,
    version_count: versionCount,
    scene_count: 1,
    has_gears_segments: true,
    credibility_note: 'machine contract only',
    logline: 'A repository boundary preserves project versions.',
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

describe('FileProjectRepository', () => {
  it('creates, lists and reads a project through atomic repository files without overwriting it', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-repository-'));
    try {
      const repository = new FileProjectRepository(root);
      const meta = projectMeta();
      expect(await repository.createInitial(meta, snapshot(meta))).toBe('created');
      expect(await repository.listProjectIds()).toEqual([meta.project_id]);
      expect(await repository.readMeta(meta.project_id)).toEqual(meta);
      expect(await repository.readVersionSnapshots(meta.project_id)).toEqual([snapshot(meta)]);

      const replacement = { ...meta, title: 'must not overwrite' };
      expect(await repository.createInitial(replacement, snapshot(replacement))).toBe('exists');
      expect((await repository.readMeta(meta.project_id))?.title).toBe(meta.title);
      const files = await readdir(resolve(root, meta.project_id));
      expect(files.some(file => file.endsWith('.tmp') || file.endsWith('.lock'))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('inspects the complete logical history without recovery or writeback', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-logical-inspection-'));
    try {
      const repository = new FileProjectRepository(root);
      const initial = projectMeta();
      await repository.createInitial(initial, snapshot(initial));
      const current = projectMeta(initial.project_id, `${initial.project_id}-v2-inspected`, 2);
      await repository.commitVersion(current, snapshot(current), {
        current_version_id: initial.current_version_id,
        version_count: initial.version_count,
        updated_at: initial.updated_at,
      });

      const inspection = await repository.inspectLogicalStateReadOnly();
      expect(inspection).toMatchObject({
        schema_version: 'story-agent-project-repository-logical-state/v1',
        project_count: 1,
        version_count: 2,
        pending_transactions_recovered: false,
        writeback_performed: false,
        state: {
          meta: [current],
        },
      });
      expect(inspection.logical_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(inspection.state.versions.map(version => version.version_id)).toEqual([
        initial.current_version_id,
        current.current_version_id,
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed when persisted version snapshot identifiers or file type are inconsistent', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-read-identity-'));
    try {
      const repository = new FileProjectRepository(root);
      const meta = projectMeta();
      const versionPath = resolve(root, meta.project_id, 'versions', `${meta.current_version_id}.json`);
      await repository.createInitial(meta, snapshot(meta));

      const wrongProject = { ...snapshot(meta), project_id: 'another-project--ai_comic_drama' };
      await writeFile(versionPath, JSON.stringify(wrongProject), 'utf8');
      await expect(repository.readVersion(meta.project_id, meta.current_version_id))
        .rejects.toBeInstanceOf(InvalidProjectRepositoryIdentifierError);
      await expect(repository.readVersionSnapshots(meta.project_id))
        .rejects.toBeInstanceOf(InvalidProjectRepositoryIdentifierError);

      const wrongStoryVersion = snapshot(meta);
      wrongStoryVersion.story.current_version_id = `${meta.project_id}-v2`;
      await writeFile(versionPath, JSON.stringify(wrongStoryVersion), 'utf8');
      await expect(repository.readVersionSnapshots(meta.project_id))
        .rejects.toBeInstanceOf(InvalidProjectRepositoryIdentifierError);

      await rm(versionPath);
      await symlink(resolve(root, 'outside-version.json'), versionPath);
      await expect(repository.readVersionSnapshots(meta.project_id))
        .rejects.toBeInstanceOf(InvalidProjectRepositoryIdentifierError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses optimistic version expectations so a stale writer cannot replace the winner', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-conflict-'));
    try {
      const repository = new FileProjectRepository(root);
      const initial = projectMeta();
      await repository.createInitial(initial, snapshot(initial));
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
      expect((await repository.readMeta(initial.project_id))?.current_version_id).toBe(winner.current_version_id);
      expect(await repository.readVersion(initial.project_id, stale.current_version_id)).toBeNull();

      const callbackMeta = {
        ...winner,
        title: 'Repository current-state winner',
        updated_at: '2026-07-15T00:01:00.000Z',
      };
      const callbackSnapshot = snapshot(callbackMeta);
      await repository.writeCurrentState(callbackMeta, callbackSnapshot, {
        current_version_id: winner.current_version_id,
        version_count: winner.version_count,
        updated_at: winner.updated_at,
      });
      expect((await repository.readMeta(initial.project_id))?.title).toBe(callbackMeta.title);
      expect((await repository.readVersion(initial.project_id, winner.current_version_id))?.story.title)
        .toBe(callbackMeta.title);
      const currentStateStale = {
        ...winner,
        title: 'Current-state stale writer',
        updated_at: '2026-07-15T00:01:01.000Z',
      };
      await expect(repository.writeCurrentState(
        currentStateStale,
        snapshot(currentStateStale),
        {
          current_version_id: winner.current_version_id,
          version_count: winner.version_count,
          updated_at: winner.updated_at,
        },
      )).rejects.toBeInstanceOf(ProjectRepositoryConflictError);
      expect((await repository.readMeta(initial.project_id))?.title).toBe(callbackMeta.title);
      const metadataWinner = {
        ...callbackMeta,
        title: 'Metadata optimistic winner',
        updated_at: '2026-07-15T00:01:30.000Z',
      };
      const metadataStale = {
        ...callbackMeta,
        title: 'Metadata stale writer',
        updated_at: '2026-07-15T00:01:31.000Z',
      };
      const metadataExpectation = {
        current_version_id: callbackMeta.current_version_id,
        version_count: callbackMeta.version_count,
        updated_at: callbackMeta.updated_at,
      };
      await repository.writeMeta(metadataWinner, metadataExpectation);
      await expect(repository.writeMeta(metadataStale, metadataExpectation))
        .rejects.toBeInstanceOf(ProjectRepositoryConflictError);
      expect((await repository.readMeta(initial.project_id))?.title).toBe(metadataWinner.title);
      await expect(repository.writeMeta({
        ...metadataWinner,
        title: 'Metadata timestamp reuse',
      }, {
        current_version_id: metadataWinner.current_version_id,
        version_count: metadataWinner.version_count,
        updated_at: metadataWinner.updated_at,
      })).rejects.toBeInstanceOf(ProjectRepositoryConflictError);
      const nonAdvancingCurrentState = {
        ...metadataWinner,
        title: 'Current-state timestamp reuse',
      };
      await expect(repository.writeCurrentState(
        nonAdvancingCurrentState,
        snapshot(nonAdvancingCurrentState),
        {
          current_version_id: metadataWinner.current_version_id,
          version_count: metadataWinner.version_count,
          updated_at: metadataWinner.updated_at,
        },
      )).rejects.toBeInstanceOf(ProjectRepositoryConflictError);
      await expect(repository.writeCurrentState(winner, snapshot(winner), {
        ...expectation,
        updated_at: initial.updated_at,
      }))
        .rejects.toBeInstanceOf(ProjectRepositoryConflictError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a version commit that was prepared before a same-version metadata update', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-version-meta-conflict-'));
    try {
      const repository = new FileProjectRepository(root);
      const initial = projectMeta();
      await repository.createInitial(initial, snapshot(initial));
      const metadataWinner = {
        ...initial,
        title: 'Metadata winner before version commit',
        updated_at: '2026-07-15T00:04:00.000Z',
      };
      await repository.writeMeta(metadataWinner, {
        current_version_id: initial.current_version_id,
        version_count: initial.version_count,
        updated_at: initial.updated_at,
      });

      const staleVersion = {
        ...initial,
        current_version_id: `${initial.project_id}-v2-stale-metadata`,
        version_count: 2,
        updated_at: '2026-07-15T00:04:01.000Z',
      };
      await expect(repository.commitVersion(staleVersion, snapshot(staleVersion), {
        current_version_id: initial.current_version_id,
        version_count: initial.version_count,
        updated_at: initial.updated_at,
      })).rejects.toBeInstanceOf(ProjectRepositoryConflictError);
      expect(await repository.readVersion(initial.project_id, staleVersion.current_version_id)).toBeNull();

      const nonAdvancingVersion = {
        ...metadataWinner,
        current_version_id: `${initial.project_id}-v2-non-advancing`,
        version_count: 2,
      };
      await expect(repository.commitVersion(nonAdvancingVersion, snapshot(nonAdvancingVersion), {
        current_version_id: metadataWinner.current_version_id,
        version_count: metadataWinner.version_count,
        updated_at: metadataWinner.updated_at,
      })).rejects.toBeInstanceOf(ProjectRepositoryConflictError);

      const freshVersion = {
        ...metadataWinner,
        current_version_id: `${initial.project_id}-v2-fresh`,
        version_count: 2,
        updated_at: '2026-07-15T00:04:02.000Z',
      };
      await repository.commitVersion(freshVersion, snapshot(freshVersion), {
        current_version_id: metadataWinner.current_version_id,
        version_count: metadataWinner.version_count,
        updated_at: metadataWinner.updated_at,
      });
      expect((await repository.readMeta(initial.project_id))?.title).toBe(metadataWinner.title);
      expect((await repository.readMeta(initial.project_id))?.current_version_id)
        .toBe(freshVersion.current_version_id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('recovers a version commit intent with its three-field metadata expectation', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-version-replay-'));
    try {
      const stableRepository = new FileProjectRepository(root);
      const initial = projectMeta();
      await stableRepository.createInitial(initial, snapshot(initial));
      const target = projectMeta(initial.project_id, `${initial.project_id}-v2-recovered`, 2);
      const expectation = {
        current_version_id: initial.current_version_id,
        version_count: initial.version_count,
        updated_at: initial.updated_at,
      };
      const failingRepository = new FileProjectRepository(root, {
        faultInjector(point) {
          if (point === 'after_snapshot') throw new Error('injected-version-after-snapshot');
        },
      });
      await expect(failingRepository.commitVersion(target, snapshot(target), expectation))
        .rejects.toThrow('injected-version-after-snapshot');

      const transactionDirectory = resolve(root, initial.project_id, '.transactions');
      const intentName = (await readdir(transactionDirectory))
        .find(name => name.endsWith('.intent.json'))!;
      const intent = JSON.parse(await readFile(resolve(transactionDirectory, intentName), 'utf8'));
      expect(intent).toMatchObject({ operation: 'commit_version', expected: expectation });

      const recoveredRepository = new FileProjectRepository(root);
      expect((await recoveredRepository.readMeta(initial.project_id))?.current_version_id)
        .toBe(target.current_version_id);
      expect(await recoveredRepository.readVersion(initial.project_id, target.current_version_id))
        .toEqual(snapshot(target));
      expect((await readdir(transactionDirectory)).some(name => name.endsWith('.intent.json')))
        .toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps production code from reintroducing snapshot-only project writes', async () => {
    const repositorySource = await readFile(
      resolve(import.meta.dirname, '..', 'repositories', 'project-repository.ts'),
      'utf8',
    );
    const projectServiceSource = await readFile(
      resolve(import.meta.dirname, '..', 'services', 'project-service.ts'),
      'utf8',
    );
    expect(repositorySource).not.toContain('writeVersion(');
    expect(repositorySource).not.toContain('expected?: ProjectMetaExpectation');
    expect(projectServiceSource).not.toContain('.writeVersion(');
    expect(projectServiceSource).toContain('production_board_export: {');
    expect(projectServiceSource).toContain('await projectRepository().writeCurrentState(');
  });

  it('archives unreadable metadata before rebuilding the initial project', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-recovery-'));
    try {
      const repository = new FileProjectRepository(root);
      const meta = projectMeta();
      const directory = resolve(root, meta.project_id);
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'project.json'), '{broken-json');

      expect(await repository.createInitial(meta, snapshot(meta))).toBe('created');
      expect(await repository.readMeta(meta.project_id)).toEqual(meta);
      const files = await readdir(directory);
      expect(files.filter(file => file.endsWith('.metadata.archive'))).toHaveLength(1);
      expect(files).toContain('project.json');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects traversal and symlink project directories without writing outside the root', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-path-'));
    const outside = await mkdtemp(resolve(tmpdir(), 'story-agent-project-outside-'));
    try {
      const repository = new FileProjectRepository(root);
      const outsideMarker = resolve(outside, 'marker.txt');
      await writeFile(outsideMarker, 'preserve-me');
      expect(await repository.readMeta('../outside')).toBeNull();
      await expect(repository.writeMeta(
        projectMeta('../outside', '../outside-v1'),
        {
          current_version_id: '../outside-v1',
          version_count: 1,
          updated_at: '2026-07-15T00:00:00.000Z',
        },
      ))
        .rejects.toBeInstanceOf(InvalidProjectRepositoryIdentifierError);

      const projectId = 'symlink-project--ai_comic_drama';
      await symlink(outside, resolve(root, projectId));
      const unsafeTarget = {
        ...projectMeta(projectId),
        updated_at: '2026-07-15T00:01:00.000Z',
      };
      await expect(repository.writeMeta(unsafeTarget, {
        current_version_id: unsafeTarget.current_version_id,
        version_count: unsafeTarget.version_count,
        updated_at: '2026-07-15T00:00:00.000Z',
      }))
        .rejects.toBeInstanceOf(InvalidProjectRepositoryIdentifierError);
      expect(await readFile(outsideMarker, 'utf8')).toBe('preserve-me');
      expect(await readdir(outside)).toEqual(['marker.txt']);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('fails closed on an externally held writer lock and preserves the lock owner evidence', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-lock-'));
    try {
      const repository = new FileProjectRepository(root);
      const meta = projectMeta();
      await repository.createInitial(meta, snapshot(meta));
      const lockPath = resolve(root, meta.project_id, '.project-repository.lock');
      await writeFile(lockPath, 'external-writer');

      await expect(repository.writeMeta({
        ...meta,
        title: 'blocked update',
        updated_at: '2026-07-15T00:01:00.000Z',
      }, {
        current_version_id: meta.current_version_id,
        version_count: meta.version_count,
        updated_at: meta.updated_at,
      }))
        .rejects.toBeInstanceOf(ProjectRepositoryConflictError);
      expect(await readFile(lockPath, 'utf8')).toBe('external-writer');
      expect((await repository.readMeta(meta.project_id))?.title).toBe(meta.title);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('replays a durable intent after a snapshot-only failure and archives a dead-process lock', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-replay-'));
    try {
      const stableRepository = new FileProjectRepository(root);
      const initial = projectMeta();
      await stableRepository.createInitial(initial, snapshot(initial));
      const target = {
        ...initial,
        title: 'Recovered paired state',
        updated_at: '2026-07-15T00:02:00.000Z',
      };
      const failingRepository = new FileProjectRepository(root, {
        faultInjector(point) {
          if (point === 'after_snapshot') throw new Error('injected-after-snapshot');
        },
      });
      await expect(failingRepository.writeCurrentState(
        target,
        snapshot(target),
        {
          current_version_id: initial.current_version_id,
          version_count: initial.version_count,
          updated_at: initial.updated_at,
        },
      )).rejects.toThrow('injected-after-snapshot');

      const transactionDirectory = resolve(root, initial.project_id, '.transactions');
      const pendingIntentNames = (await readdir(transactionDirectory))
        .filter(name => name.endsWith('.intent.json'));
      expect(pendingIntentNames).toHaveLength(1);
      const pendingIntent = JSON.parse(await readFile(
        resolve(transactionDirectory, pendingIntentNames[0]),
        'utf8',
      ));
      expect(pendingIntent.expected).toEqual({
        current_version_id: initial.current_version_id,
        version_count: initial.version_count,
        updated_at: initial.updated_at,
      });
      const lockPath = resolve(root, initial.project_id, '.project-repository.lock');
      await writeFile(lockPath, JSON.stringify({
        schema_version: 'story-agent-project-repository-lock/v1',
        owner_pid: 2_147_483_647,
        owner_host: hostname(),
        acquired_at: '2026-07-15T00:01:00.000Z',
        nonce: 'dead-process-lock',
      }));

      const recoveredRepository = new FileProjectRepository(root);
      expect((await recoveredRepository.readMeta(initial.project_id))?.title).toBe(target.title);
      expect((await recoveredRepository.readVersion(initial.project_id, initial.current_version_id))?.story.title)
        .toBe(target.title);
      const transactionFiles = await readdir(transactionDirectory);
      expect(transactionFiles.filter(name => name.endsWith('.intent.json'))).toHaveLength(0);
      expect(transactionFiles.filter(name => name.endsWith('.applied.json'))).toHaveLength(2);
      expect((await readdir(resolve(root, initial.project_id)))
        .some(name => name.includes('.stale-owner-') && name.endsWith('.archive'))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails recovery closed when a pending intent no longer matches its target hash', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-project-intent-tamper-'));
    try {
      const stableRepository = new FileProjectRepository(root);
      const initial = projectMeta();
      await stableRepository.createInitial(initial, snapshot(initial));
      const target = {
        ...initial,
        title: 'Untampered target',
        updated_at: '2026-07-15T00:03:00.000Z',
      };
      const failingRepository = new FileProjectRepository(root, {
        faultInjector(point) {
          if (point === 'after_intent') throw new Error('injected-after-intent');
        },
      });
      await expect(failingRepository.writeCurrentState(
        target,
        snapshot(target),
        {
          current_version_id: initial.current_version_id,
          version_count: initial.version_count,
          updated_at: initial.updated_at,
        },
      )).rejects.toThrow('injected-after-intent');

      const transactionDirectory = resolve(root, initial.project_id, '.transactions');
      const intentName = (await readdir(transactionDirectory)).find(name => name.endsWith('.intent.json'))!;
      const intentPath = resolve(transactionDirectory, intentName);
      const intent = JSON.parse(await readFile(intentPath, 'utf8'));
      intent.meta.title = 'Tampered target';
      await writeFile(intentPath, JSON.stringify(intent));

      const recoveredRepository = new FileProjectRepository(root);
      await expect(recoveredRepository.readMeta(initial.project_id))
        .rejects.toBeInstanceOf(ProjectRepositoryConflictError);
      expect(JSON.parse(await readFile(resolve(root, initial.project_id, 'project.json'), 'utf8')).title)
        .toBe(initial.title);
      expect((await readdir(transactionDirectory))).toContain(intentName);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('maps optimistic repository conflicts to a stable HTTP 409 API envelope', async () => {
    const app = express();
    app.get('/conflict', () => {
      throw new ProjectRepositoryConflictError('stale project metadata');
    });
    app.use(errorHandler);

    const response = await supertest(app).get('/conflict');
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'PROJECT_WRITE_CONFLICT',
        message: 'stale project metadata',
      },
    });
  });
});
