import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type {
  StoryGenerateResult,
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import {
  createProjectReadOnlyRequestProjection,
} from '../services/project-read-only-request-projection-service.js';

function story(storyId: string): StoryGenerateResult {
  return {
    storyId,
    title: storyId,
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '测试条目',
    logline: '测试',
    theme: '测试',
    full_text: '测试',
    scene_breakdown: [],
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: [],
    credibility_note: '测试',
  };
}

describe('project read-only request projection', () => {
  it('deduplicates list/current-state reads and isolates per-project failures', async () => {
    const readableId = '20260824-story-readable--character_story';
    const failedId = '20260824-story-failed--character_story';
    const meta: StoryProjectMeta = {
      project_id: readableId,
      current_story_id: '20260824-story-readable',
      current_version_id: `${readableId}-v1`,
      version_count: 1,
      updated_at: '2026-08-24T13:00:00.000Z',
    } as StoryProjectMeta;
    const snapshot: StoryProjectVersionSnapshot = {
      project_id: readableId,
      version_id: meta.current_version_id,
      created_at: meta.updated_at,
      change_type: 'initial_generation',
      scene_ids_changed: [],
      story: story(meta.current_story_id),
    };
    const repository = {
      listProjectIds: vi.fn(async () => [readableId, failedId]),
      inspectCurrentStateReadOnly: vi.fn(async (projectId: string) => {
        if (projectId === failedId) throw new Error('fixture read failure');
        return { meta, snapshot };
      }),
    };
    const projection = createProjectReadOnlyRequestProjection({ repository });

    const [firstIds, secondIds] = await Promise.all([
      projection.listProjectIds(),
      projection.listProjectIds(),
    ]);
    expect(firstIds).toEqual([readableId, failedId].sort());
    expect(secondIds).toEqual(firstIds);
    expect(projection.seedCurrentState(readableId, { meta, snapshot })).toBe(true);
    expect(projection.seedCurrentState(readableId, { meta, snapshot })).toBe(false);
    expect(projection.seedCurrentState('unlisted-project', { meta, snapshot })).toBe(false);
    const [firstReadable, secondReadable, failed] = await Promise.all([
      projection.inspectCurrentState(readableId),
      projection.inspectCurrentState(readableId),
      projection.inspectCurrentState(failedId),
    ]);
    expect(firstReadable.status).toBe('readable');
    expect(secondReadable).toBe(firstReadable);
    expect(failed).toMatchObject({
      project_id: failedId,
      status: 'inspection_failed',
      meta: null,
      snapshot: null,
    });
    await projection.inspectCurrentState(readableId);
    await projection.inspectCurrentState(failedId);

    expect(repository.listProjectIds).toHaveBeenCalledTimes(1);
    expect(repository.inspectCurrentStateReadOnly).toHaveBeenCalledTimes(1);
    expect(projection.diagnostics()).toEqual({
      schema_version: 'project-read-only-request-projection-diagnostics/v1',
      project_id_list_request_count: 2,
      project_id_list_repository_call_count: 1,
      project_id_list_cache_hit_count: 1,
      current_state_request_count: 5,
      current_state_repository_call_count: 1,
      current_state_cache_hit_count: 4,
      current_state_seed_request_count: 3,
      current_state_seeded_count: 1,
      current_state_seed_rejected_count: 2,
      readable_project_count: 1,
      failed_project_count: 1,
      boundary: {
        request_scoped: true,
        read_only: true,
        repository_write_allowed: false,
        failed_projects_isolated: true,
        cross_request_cache_allowed: false,
        seed_validation_required: true,
        seed_overwrite_allowed: false,
      },
    });
  });

  it('wires one request-scoped projection into supplement and sync-health consumers', async () => {
    const source = await readFile(
      new URL('../services/story-agent-mvp-status-service.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('createProjectReadOnlyRequestProjection()');
    expect(source).toContain('readOnlyProjection: projectReadOnlyProjection');
    expect(source.match(/readOnlyProjection: projectReadOnlyProjection/g)).toHaveLength(3);
  });
});
