import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateProjectVersion } from '../src/tools/update-project-version.js';

const projectId = '20260618-story-version--ai_comic_drama';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.STORY_AGENT_BASE_URL;
});

describe('kb_update_project_version canonical application boundary', () => {
  it('routes quality repair to the Story Agent application service and maps its committed version', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      data: {
        project_id: projectId,
        applied: true,
        changed_scene_ids: [1],
        after_quality: { passed: true, genre_score: 84, issue_count: 0 },
        change_summary: { protected_fields_preserved: ['storyId', 'story_blueprint'] },
        operator_hints: [],
        detail: {
          project: {
            current_version_id: `${projectId}-v2`,
            version_count: 2,
            updated_at: '2026-07-19T12:00:00.000Z',
          },
          versions: [
            { version_id: `${projectId}-v2` },
            { version_id: `${projectId}-v1` },
          ],
        },
      },
      error: null,
    }));
    const snapshotJson = JSON.stringify({
      storyId: '20260618-story-version',
      full_text: '修复后的故事正文。',
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateProjectVersion({
      project_id: projectId,
      change_type: 'quality_repair',
      change_target: { scene_ids: [1] },
      snapshot_json: snapshotJson,
      user_instruction: '增强第 1 场钩子',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://127.0.0.1:3999/api/projects/${projectId}/repair-quality/apply`,
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      repaired_story_json: snapshotJson,
      user_instruction: '增强第 1 场钩子',
      apply: true,
      allow_no_improvement: false,
    });
    expect(result).toMatchObject({
      project_id: projectId,
      previous_version_id: `${projectId}-v1`,
      version_id: `${projectId}-v2`,
      current_version_id: `${projectId}-v2`,
      version_count: 2,
      scene_ids_changed: [1],
      preserved_fields: ['storyId', 'story_blueprint'],
      canonical_service: true,
      quality_summary: {
        quality_passed: true,
        genre_score: 84,
        quality_issue_count: 0,
      },
    });
    expect(result?.snapshot_path).toBe('managed-by-story-agent-application-service');
  });

  it('fails closed for change types that do not have this canonical endpoint', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateProjectVersion({
      project_id: projectId,
      change_type: 'scene_regeneration',
      snapshot_json: '{}',
    })).rejects.toThrow('仅支持 quality_repair');
    await expect(updateProjectVersion({
      project_id: projectId,
      change_type: 'production_board_repair',
      snapshot_json: '{}',
    })).rejects.toThrow('仅支持 quality_repair');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null only when the canonical application service reports a missing project', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      ok: false,
      data: null,
      error: { code: 'STORY_NOT_FOUND', message: '项目不存在' },
    }, 404)));

    await expect(updateProjectVersion({
      project_id: projectId,
      change_type: 'quality_repair',
      snapshot_json: '{}',
    })).resolves.toBeNull();
  });

  it('rejects unsafe ids, invalid snapshots, and rejected/no-op repairs without writing directly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      data: {
        project_id: projectId,
        applied: false,
        rejected_reason: '修复没有形成实质质量提升',
        changed_scene_ids: [],
        after_quality: { passed: false, genre_score: 62, issue_count: 1 },
        change_summary: {},
      },
      error: null,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateProjectVersion({
      project_id: '../bad',
      change_type: 'quality_repair',
      snapshot_json: '{}',
    })).rejects.toThrow('非法项目 ID');
    await expect(updateProjectVersion({
      project_id: projectId,
      change_type: 'quality_repair',
      snapshot_json: 'not-json',
    })).rejects.toThrow('snapshot_json 不是有效 JSON');
    await expect(updateProjectVersion({
      project_id: projectId,
      change_type: 'quality_repair',
      snapshot_json: '{}',
    })).rejects.toThrow('没有形成实质质量提升');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
