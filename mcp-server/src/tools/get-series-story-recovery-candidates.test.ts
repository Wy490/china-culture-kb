import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSeriesStoryRecoveryCandidates,
} from './get-series-story-recovery-candidates.js';

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

describe('series story recovery candidates MCP bridge', () => {
  it('reads the canonical report without granting automatic relink credit', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-recovery-token';
    const webEnvelope = {
      ok: true,
      data: {
        schema_version:
          'story-agent-series-story-recovery-candidate-report/v1',
        summary: {
          active_relink_project_count: 99,
          unique_legacy_suffix_candidate_count: 9,
          operator_whitelisted_count: 0,
          auto_relink_eligible_count: 0,
        },
        boundary: {
          automatic_relink_allowed: false,
          project_files_modified: false,
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

    const result = await getSeriesStoryRecoveryCandidates({ limit: 100 });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:3999/api/system/'
      + 'story-agent-series-story-recovery-candidates?limit=100',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: {
        authorization: 'Bearer mcp-recovery-token',
      },
    });
    expect(result.data).toEqual(webEnvelope.data);
    expect(result.mcp_bridge).toEqual({
      schema_version:
        'mcp-story-agent-series-story-recovery-candidates/v1',
      canonical_tool:
        'kb_get_story_agent_series_story_recovery_candidates',
      canonical_service: true,
      application_endpoint:
        'http://127.0.0.1:3999/api/system/'
        + 'story-agent-series-story-recovery-candidates?limit=100',
      read_only: true,
      operator_whitelist_required: true,
      automatic_relink_allowed: false,
      project_files_modified: false,
      story_files_written: false,
      signoff_portfolio_modified: false,
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
          code: 'RECOVERY_REPORT_BLOCKED',
          message: 'recovery inventory unavailable',
        },
      }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await expect(getSeriesStoryRecoveryCandidates()).rejects.toThrow(
      'RECOVERY_REPORT_BLOCKED: recovery inventory unavailable',
    );
  });
});
