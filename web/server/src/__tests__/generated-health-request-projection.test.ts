import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import { getStoryAgentGeneratedHealth } from '../services/generated-health-service.js';
import {
  createProjectReadOnlyRequestProjection,
} from '../services/project-read-only-request-projection-service.js';

const previousKbRoot = process.env.KB_ROOT;
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;
let temporaryRoot: string | undefined;

afterEach(async () => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = undefined;
});

describe('generated health request projection', () => {
  it('seeds validated current state without changing full-version health evidence', async () => {
    temporaryRoot = await mkdtemp(resolve(tmpdir(), 'story-generated-health-projection-'));
    const generatedRoot = resolve(temporaryRoot, 'generated');
    const kbRoot = resolve(temporaryRoot, 'kb');
    const projectId = 'health-projection-story';
    const storyId = '20260824-story-health-projection';
    const projectDir = resolve(generatedRoot, 'projects', projectId);
    await mkdir(resolve(projectDir, 'versions'), { recursive: true });
    await mkdir(resolve(generatedRoot, 'ai-comic-series-projects'), { recursive: true });
    await mkdir(resolve(generatedRoot, 'stories'), { recursive: true });
    await mkdir(kbRoot, { recursive: true });
    process.env.KB_ROOT = kbRoot;
    process.env.WEB_GENERATED_ROOT = generatedRoot;

    const meta = {
      project_id: projectId,
      current_story_id: storyId,
      current_version_id: `${projectId}-v2`,
      title: '投影健康等价性',
      source_domain: 'china_culture',
      source_entry: '测试条目',
      status: 'draft',
      created_at: '2026-08-24T13:00:00.000Z',
      updated_at: '2026-08-24T13:02:00.000Z',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      version_count: 2,
      quality_passed: true,
      quality_issue_count: 0,
      open_supplement_task_count: 0,
    } as unknown as StoryProjectMeta;
    const story = {
      storyId,
      title: '投影健康等价性',
      scene_breakdown: [{ scene_id: 1 }],
      gears_segments: [{ segment_id: 'segment-1' }],
      gears_delivery: { schema_version: 'gears-delivery-package/v1' },
      supplement_tasks: [],
      material_sufficiency: { blocked: false },
      quality_report: { passed: true, issues: [], score: 100 },
    };
    const currentSnapshot = {
      project_id: projectId,
      version_id: meta.current_version_id,
      created_at: meta.updated_at,
      change_type: 'story_repair',
      scene_ids_changed: [1],
      story,
    } as unknown as StoryProjectVersionSnapshot;
    await writeFile(resolve(projectDir, 'project.json'), JSON.stringify(meta));
    await writeFile(resolve(projectDir, 'versions', `${projectId}-v1.json`), JSON.stringify({
      ...currentSnapshot,
      version_id: `${projectId}-v1`,
      created_at: '2026-08-24T13:01:00.000Z',
    }));
    await writeFile(
      resolve(projectDir, 'versions', `${projectId}-v2.json`),
      JSON.stringify(currentSnapshot),
    );

    const baseline = await getStoryAgentGeneratedHealth({ limit: 200 });
    const repository = {
      listProjectIds: vi.fn(async () => [projectId]),
      inspectCurrentStateReadOnly: vi.fn(async () => ({ meta, snapshot: currentSnapshot })),
    };
    const projection = createProjectReadOnlyRequestProjection({ repository });
    const projected = await getStoryAgentGeneratedHealth({
      limit: 200,
      readOnlyProjection: projection,
    });

    expect(projected.summary).toEqual(baseline.summary);
    expect(projected.items).toEqual(baseline.items);
    expect(projected.items[0].evidence).toContain('versions=2');
    await projection.inspectCurrentState(projectId);
    await projection.inspectCurrentState(projectId);
    expect(repository.listProjectIds).toHaveBeenCalledTimes(1);
    expect(repository.inspectCurrentStateReadOnly).not.toHaveBeenCalled();
    expect(projection.diagnostics()).toMatchObject({
      project_id_list_repository_call_count: 1,
      current_state_repository_call_count: 0,
      current_state_cache_hit_count: 2,
      current_state_seed_request_count: 1,
      current_state_seeded_count: 1,
      current_state_seed_rejected_count: 0,
      readable_project_count: 1,
      failed_project_count: 0,
    });
  });
});
