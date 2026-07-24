import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportStoryAgentPreproduction } from './export-story-agent-preproduction.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;
const originalAccessToken = process.env.STORY_AGENT_MCP_ACCESS_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.STORY_AGENT_BASE_URL;
  else process.env.STORY_AGENT_BASE_URL = originalBaseUrl;
  if (originalAccessToken === undefined) delete process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
  else process.env.STORY_AGENT_MCP_ACCESS_TOKEN = originalAccessToken;
});

describe('exportStoryAgentPreproduction', () => {
  it('bridges the source identifier to the canonical Web export', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-test-token';
    const webEnvelope = {
      ok: true,
      data: {
        schema_version: 'story-agent-seedance-preproduction-package/v1',
        source: {
          kind: 'story_project',
          source_id: '20260724-story-prep1--character_story',
        },
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(webEnvelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const input = { project_id: '20260724-story-prep1--character_story' };
    const result = await exportStoryAgentPreproduction(input);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0])
      .toBe('http://127.0.0.1:3999/api/story-agent/preproduction/export');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer mcp-test-token',
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(input);
    expect(result).toEqual({
      ...webEnvelope,
      mcp_bridge: {
        schema_version: 'mcp-story-agent-preproduction-export/v1',
        canonical_tool: 'kb_export_story_agent_preproduction',
        canonical_service: true,
        application_endpoint: 'http://127.0.0.1:3999/api/story-agent/preproduction/export',
        authoritative_request_schema: 'StoryAgentSeedancePreproductionExportRequestSchema',
        output_schema: 'story-agent-seedance-preproduction-package/v1',
        direct_file_write_performed: false,
        video_generation_performed: false,
      },
    });
  });

  it('rejects ambiguous sources before calling the application service', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(exportStoryAgentPreproduction({
      story_id: '20260724-story-prep1',
      project_id: '20260724-story-prep1--character_story',
    })).rejects.toThrow('exactly one');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed without the canonical application service', async () => {
    delete process.env.STORY_AGENT_BASE_URL;
    await expect(exportStoryAgentPreproduction({
      series_project_id: '20260724-series-prep1',
    })).rejects.toThrow('STORY_AGENT_BASE_URL');
  });
});
