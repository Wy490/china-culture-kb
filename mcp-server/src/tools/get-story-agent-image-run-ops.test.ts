import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getStoryAgentImageRunOps,
} from './get-story-agent-image-run-ops.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;
const originalAccessToken = process.env.STORY_AGENT_MCP_ACCESS_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.STORY_AGENT_BASE_URL;
  else process.env.STORY_AGENT_BASE_URL = originalBaseUrl;
  if (originalAccessToken === undefined) {
    delete process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
  } else {
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = originalAccessToken;
  }
});

describe('story agent image run ops MCP bridge', () => {
  it('reads canonical stale-run inventory without mutating or closing runs', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-image-ops-token';
    const webEnvelope = {
      ok: true,
      data: {
        schema_version: 'story-agent-image-run-ops-report/v1',
        summary: {
          scanned_run_count: 6,
          awaiting_task_count: 20,
          automatic_close_eligible_count: 0,
        },
        boundary: {
          read_only: true,
          automatic_close_allowed: false,
        },
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(webEnvelope), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getStoryAgentImageRunOps({
      limit: 50,
      stale_after_ms: 86_400_000,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:3999/api/system/story-agent-image-run-ops'
      + '?limit=50&stale_after_ms=86400000',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: {
        authorization: 'Bearer mcp-image-ops-token',
      },
    });
    expect(result.data).toEqual(webEnvelope.data);
    expect(result.mcp_bridge).toEqual({
      schema_version: 'mcp-story-agent-image-run-ops/v1',
      canonical_tool: 'kb_get_story_agent_image_run_ops',
      canonical_service: true,
      application_endpoint:
        'http://127.0.0.1:3999/api/system/story-agent-image-run-ops'
        + '?limit=50&stale_after_ms=86400000',
      read_only: true,
      provider_invoked: false,
      image_run_files_modified: false,
      story_agent_run_files_modified: false,
      automatic_close_allowed: false,
      publishable_delivery_credit_granted: false,
    });
  });

  it('fails closed when the canonical service rejects the request', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: 'IMAGE_RUN_OPS_BLOCKED',
          message: 'image run inventory unavailable',
        },
      }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await expect(getStoryAgentImageRunOps()).rejects.toThrow(
      'IMAGE_RUN_OPS_BLOCKED: image run inventory unavailable',
    );
  });
});
