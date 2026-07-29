import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  exportStoryAgentRun,
  generateStoryAgentRun,
  getStoryAgentRun,
  importStoryAgentRunImages,
  resumeStoryAgentRun,
  startStoryAgentRun,
} from './story-agent-runs.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;
const originalAccessToken = process.env.STORY_AGENT_MCP_ACCESS_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.STORY_AGENT_BASE_URL;
  else process.env.STORY_AGENT_BASE_URL = originalBaseUrl;
  if (originalAccessToken === undefined) delete process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
  else process.env.STORY_AGENT_MCP_ACCESS_TOKEN = originalAccessToken;
});

describe('Story Agent top-level run MCP bridge', () => {
  it('delegates fresh generation runs to the canonical v2 application endpoint', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    const envelope = {
      ok: true,
      data: {
        schema_version: 'story-agent-run/v2',
        run_id: 'story-agent-run-1234567890abcdef12345678',
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      idempotency_key: 'mcp-fresh-generation-001',
      generation_request: {
        domain: 'china_culture',
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: 'character_story',
        model_profile_id: 'local_story_engine',
        reference_generation_recipe: {
          schema_version: 'reference-generation-recipe/v1',
          recipe_id: 'feature_long_goal_payoff',
          recipe_version: '1.0.0',
          reusable_mechanisms: [
            '给主角一个长期可执行目标，并让每次小行动同时承担生存与推进功能',
            '让道具、习惯或空间细节在后段获得新含义',
            '把人物价值放进不可撤回的选择与后果中完成',
          ],
          avoid_copying: [
            '不得复刻具体越狱、监禁或救赎情节',
            '不得复刻识别性人物关系、台词或道具组合',
            '不得用相同结局揭示替代原创因果',
          ],
          payload_sha256: 'd259b451b425835b869b8472548edadba5534415c1dd0cf6302980e54613ea64',
        },
      },
    };

    const result = await generateStoryAgentRun(input);

    expect(fetchMock.mock.calls[0][0])
      .toBe('http://127.0.0.1:3999/api/story-agent/runs/generate');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(input);
    expect(result.mcp_bridge).toMatchObject({
      canonical_tool: 'kb_generate_story_agent_run',
      authoritative_request_schema: 'StoryAgentRunGenerateRequestSchema',
      output_schema: 'story-agent-run/v2',
      canonical_service: true,
      provider_invoked_by_mcp: false,
      direct_project_write_performed: false,
      video_generation_performed: false,
    });
  });

  it('delegates start, get, resume, and export to the canonical application service', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-run-token';
    const envelope = {
      ok: true,
      data: {
        schema_version: 'story-agent-run/v1',
        run_id: 'story-agent-run-1234567890abcdef12345678',
      },
      error: null,
    };
    const fetchMock = vi.fn().mockImplementation(async () => new Response(
      JSON.stringify(envelope),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const source = { project_id: '20260725-story-run001--character_story' };
    const started = await startStoryAgentRun(source);
    const runId = 'story-agent-run-1234567890abcdef12345678';
    await getStoryAgentRun({ run_id: runId });
    await resumeStoryAgentRun({ run_id: runId });
    await exportStoryAgentRun({ run_id: runId });

    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://127.0.0.1:3999/api/story-agent/runs',
      `http://127.0.0.1:3999/api/story-agent/runs/${runId}`,
      `http://127.0.0.1:3999/api/story-agent/runs/${runId}/resume`,
      `http://127.0.0.1:3999/api/story-agent/runs/${runId}/export`,
    ]);
    expect(fetchMock.mock.calls.map(call => call[1]?.method ?? 'GET'))
      .toEqual(['POST', 'GET', 'POST', 'GET']);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: {
        authorization: 'Bearer mcp-run-token',
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(source);
    expect(started.mcp_bridge).toMatchObject({
      canonical_tool: 'kb_start_story_agent_run',
      canonical_service: true,
      output_schema: 'story-agent-run/v1',
      provider_invoked_by_mcp: false,
      video_generation_performed: false,
    });
  });

  it('rejects an ambiguous source before calling the application service', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(startStoryAgentRun({
      project_id: '20260725-story-run001--character_story',
      series_project_id: '20260725-series-run001',
    })).rejects.toThrow('exactly one');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('imports an image result through the top-level run endpoint', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const envelope = {
      ok: true,
      data: { schema_version: 'story-agent-run-image-import/v1' },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const runId = 'story-agent-run-1234567890abcdef12345678';
    const result = {
      schema_version: 'image-generation-result/v1' as const,
      run_id: 'image-run-1234567890abcdef12345678',
      request_sha256: 'a'.repeat(64),
      completed_at: '2026-07-25T07:05:00.000Z',
      items: [{
        task_id: 'image-task-1234567890abcdef12345678',
        status: 'generated' as const,
        output_path: 'outputs/task.png',
        mime_type: 'image/png',
        content_sha256: 'b'.repeat(64),
        prompt_sha256: 'c'.repeat(64),
        provider: 'openai_imagegen',
        model: 'gpt-image-2',
      }],
    };

    const imported = await importStoryAgentRunImages({ run_id: runId, result });

    expect(fetchMock.mock.calls[0][0])
      .toBe(`http://127.0.0.1:3999/api/story-agent/runs/${runId}/import-images`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(result);
    expect(imported.mcp_bridge).toMatchObject({
      canonical_tool: 'kb_import_story_agent_images',
      output_schema: 'story-agent-run-image-import/v1',
      direct_project_write_performed: false,
      video_generation_performed: false,
    });
  });
});
