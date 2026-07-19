import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateProjectVersion } from './update-project-version.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.STORY_AGENT_BASE_URL;
  else process.env.STORY_AGENT_BASE_URL = originalBaseUrl;
});

describe('updateProjectVersion', () => {
  it('routes quality repair snapshots through the canonical Story Agent application service', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        schema_version: 'story-quality-repair-apply/v1',
        project_id: 'story-1--character_story',
        story_id: 'story-1',
        applied: true,
        can_apply: true,
        changed_scene_ids: [2],
        before_quality: { passed: false, genre_score: 72, issue_count: 2 },
        after_quality: { passed: true, genre_score: 81, issue_count: 0 },
        change_summary: {
          protected_fields_preserved: ['storyId', 'source_entry'],
        },
        operator_hints: [],
        validation_summary_markdown: 'ok',
        repair_trace: { trace_id: 'trace-1', attempted: true, applied: true, reason: 'quality_repair_json_applied', actions: [] },
        detail: {
          project: {
            project_id: 'story-1--character_story',
            current_version_id: 'story-1--character_story-v2',
            version_count: 2,
            updated_at: '2026-07-19T12:00:00.000Z',
          },
          current_story: {},
          versions: [
            { version_id: 'story-1--character_story-v2' },
            { version_id: 'story-1--character_story-v1' },
          ],
        },
      },
      error: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateProjectVersion({
      project_id: 'story-1--character_story',
      change_type: 'quality_repair',
      snapshot_json: JSON.stringify({ storyId: 'story-1', full_text: '修复后的正文' }),
      user_instruction: 'MCP 修复',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:3999/api/projects/story-1--character_story/repair-quality/apply',
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      repaired_story_json: JSON.stringify({ storyId: 'story-1', full_text: '修复后的正文' }),
      user_instruction: 'MCP 修复',
      apply: true,
      allow_no_improvement: false,
    });
    expect(result).toMatchObject({
      project_id: 'story-1--character_story',
      previous_version_id: 'story-1--character_story-v1',
      current_version_id: 'story-1--character_story-v2',
      version_count: 2,
      canonical_service: true,
      quality_summary: {
        quality_passed: true,
        genre_score: 81,
        quality_issue_count: 0,
      },
    });
  });

  it('fails closed for snapshot change types without a canonical application endpoint', async () => {
    await expect(updateProjectVersion({
      project_id: 'story-1--character_story',
      change_type: 'scene_regeneration',
      snapshot_json: '{}',
    })).rejects.toThrow('仅支持 quality_repair');
  });
});
