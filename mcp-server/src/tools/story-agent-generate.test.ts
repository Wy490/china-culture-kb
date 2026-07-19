import { afterEach, describe, expect, it, vi } from 'vitest';
import { storyAgentGenerate } from './story-agent-generate.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;
const originalAccessToken = process.env.STORY_AGENT_MCP_ACCESS_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.STORY_AGENT_BASE_URL;
  else process.env.STORY_AGENT_BASE_URL = originalBaseUrl;
  if (originalAccessToken === undefined) delete process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
  else process.env.STORY_AGENT_MCP_ACCESS_TOKEN = originalAccessToken;
});

describe('storyAgentGenerate', () => {
  it('routes the unchanged request through the canonical Web application service', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-test-token';
    const webEnvelope = {
      ok: true,
      data: {
        storyId: 'story-canonical-1',
        project_id: 'story-canonical-1--historical_drama',
        video_type: 'historical_drama',
        generation_mode: 'local_only',
        quality_gates: { story_publishable: true, production_ready: false },
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(webEnvelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const request = {
      domain: 'china_culture',
      entry_name: '屈原投江汨罗——端午节起源',
      original_user_query: '生成一部历史剧情短片',
      video_type: 'historical_drama',
      target_video_duration: '3分钟',
      output_gears_segments: true,
      auto_repair: true,
    } as const;
    const result = await storyAgentGenerate(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:3999/api/stories/generate');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer mcp-test-token',
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(request);
    expect(result).toEqual({
      ...webEnvelope,
      mcp_bridge: {
        schema_version: 'mcp-story-agent-generate/v1',
        canonical_tool: 'kb_story_agent_generate',
        canonical_service: true,
        application_endpoint: 'http://127.0.0.1:3999/api/stories/generate',
        capability_endpoint: 'http://127.0.0.1:3999/api/system/story-generation-capabilities',
        authoritative_request_schema: 'StoryGenerateRequestSchema',
        shares_web_generation_pipeline: true,
        direct_file_write_performed: false,
      },
    });
  });

  it('fails closed without an explicitly configured application service', async () => {
    delete process.env.STORY_AGENT_BASE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(storyAgentGenerate({
      entry_name: '屈原投江汨罗——端午节起源',
      video_type: 'historical_drama',
    })).rejects.toThrow('STORY_AGENT_BASE_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves canonical validation failures instead of falling back to a local writer', async () => {
    process.env.STORY_AGENT_BASE_URL = 'https://story-agent.example.com';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'video_type is invalid' },
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(storyAgentGenerate({
      entry_name: '屈原投江汨罗——端午节起源',
      video_type: 'historical_drama',
    })).rejects.toThrow('VALIDATION_ERROR: video_type is invalid');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
