import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  exportStoryAgentImageRequest,
  importStoryAgentImageResult,
} from './story-agent-image-runs.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;
const originalAccessToken = process.env.STORY_AGENT_MCP_ACCESS_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.STORY_AGENT_BASE_URL;
  else process.env.STORY_AGENT_BASE_URL = originalBaseUrl;
  if (originalAccessToken === undefined) delete process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
  else process.env.STORY_AGENT_MCP_ACCESS_TOKEN = originalAccessToken;
});

describe('Story Agent image run MCP bridge', () => {
  it('exports the canonical request without invoking an image provider', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-image-token';
    const envelope = {
      ok: true,
      data: {
        schema_version: 'story-agent-image-run/v1',
        run_id: 'image-run-1234567890abcdef12345678',
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const input = { project_id: '20260724-story-img01--character_story' };
    const result = await exportStoryAgentImageRequest(input);

    expect(fetchMock.mock.calls[0][0])
      .toBe('http://127.0.0.1:3999/api/story-agent/image-runs/export-request');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer mcp-image-token',
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(input);
    expect(result.mcp_bridge).toMatchObject({
      canonical_tool: 'kb_export_story_agent_image_request',
      provider_invoked_by_mcp: false,
      output_schema: 'story-agent-image-run/v1',
    });
  });

  it('imports a canonical result manifest through the persisted run endpoint', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const envelope = {
      ok: true,
      data: { schema_version: 'story-agent-image-result-import/v1' },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const runId = 'image-run-1234567890abcdef12345678';
    const resultManifest = {
      schema_version: 'image-generation-result/v1' as const,
      run_id: runId,
      request_sha256: 'a'.repeat(64),
      completed_at: '2026-07-24T10:30:00.000Z',
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

    const result = await importStoryAgentImageResult({
      run_id: runId,
      result: resultManifest,
    });

    expect(fetchMock.mock.calls[0][0])
      .toBe(`http://127.0.0.1:3999/api/story-agent/image-runs/${runId}/import-result`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(resultManifest);
    expect(result.mcp_bridge).toMatchObject({
      canonical_tool: 'kb_import_story_agent_image_result',
      direct_asset_library_write_performed: false,
      output_schema: 'story-agent-image-result-import/v1',
    });
  });

  it('rejects mismatched run identifiers before calling the application service', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(importStoryAgentImageResult({
      run_id: 'image-run-1234567890abcdef12345678',
      result: {
        schema_version: 'image-generation-result/v1',
        run_id: 'image-run-abcdef1234567890abcdef12',
        request_sha256: 'a'.repeat(64),
        completed_at: '2026-07-24T10:30:00.000Z',
        items: [],
      },
    })).rejects.toThrow('must match');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
