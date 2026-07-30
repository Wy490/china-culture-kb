import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getFinalDeliveryManifestDispositions,
  submitFinalDeliveryManifestDisposition,
} from './final-delivery-manifest-dispositions.js';

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

describe('final delivery manifest disposition MCP bridge', () => {
  it('reads only canonical operator-submitted disposition events', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-manifest-token';
    const webEnvelope = {
      ok: true,
      data: {
        schema_version:
          'story-agent-final-delivery-manifest-disposition-ledger/v1',
        summary: {
          recorded_decision_count: 0,
          operator_decisions_recorded: false,
        },
        entries: [],
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

    const result = await getFinalDeliveryManifestDispositions({
      series_project_id: 'manifest-gap-series',
      operator_id: 'operator-manifest-001',
      disposition: 'preserve_fixture_exclude_from_publishable_delivery',
      limit: 20,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:3999/api/system/'
      + 'story-agent-final-delivery-manifest-dispositions'
      + '?series_project_id=manifest-gap-series'
      + '&operator_id=operator-manifest-001'
      + '&disposition=preserve_fixture_exclude_from_publishable_delivery'
      + '&limit=20',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: {
        authorization: 'Bearer mcp-manifest-token',
      },
    });
    expect(result.mcp_bridge).toMatchObject({
      schema_version:
        'mcp-story-agent-final-delivery-manifest-disposition-ledger/v1',
      canonical_tool:
        'kb_get_story_agent_final_delivery_manifest_dispositions',
      canonical_service: true,
      operator_submitted_dispositions_only: true,
      machine_generated_disposition_allowed: false,
      project_files_modified: false,
      publishable_delivery_credit_granted: false,
    });
  });

  it('forwards explicit operator evidence and attestations unchanged', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    const webEnvelope = {
      ok: true,
      data: {
        schema_version:
          'story-agent-final-delivery-manifest-disposition-submit-result/v1',
        idempotent_replay: false,
        event: {
          event_id: 'final-delivery-disposition-aabbccddeeff001122334455',
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
    const input = {
      series_project_id: 'manifest-gap-series',
      disposition:
        'reexport_after_authorized_dependencies' as const,
      authorized_media_inputs_attested: true,
      operator: {
        operator_id: 'operator-manifest-001',
        display_name: 'Manifest Operator',
        identity_reference: 'operator-roster/manifest-001',
      },
      decision: {
        rationale:
          '仅在全部授权媒体依赖通过预检后重导出，当前不授予交付信用。',
        evidence_references: [
          'project.json#seedance_final_delivery',
          'preflight#manifest-gap-series',
        ],
      },
      attestation: {
        human_operator: true as const,
        reviewed_current_preflight: true as const,
        accepts_no_publishable_delivery_credit: true as const,
      },
      idempotency_key: 'manifest-mcp-disposition-20260730-0001',
    };

    const result = await submitFinalDeliveryManifestDisposition(input);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:3999/api/system/'
      + 'story-agent-final-delivery-manifest-dispositions',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(input);
    expect(result.mcp_bridge).toMatchObject({
      schema_version:
        'mcp-story-agent-final-delivery-manifest-disposition-submit/v1',
      canonical_tool:
        'kb_submit_story_agent_final_delivery_manifest_disposition',
      canonical_service: true,
      explicit_human_operator_attestation_required: true,
      machine_generated_disposition_allowed: false,
      final_assemble_invoked: false,
      manifest_written: false,
      project_files_modified: false,
      publishable_delivery_credit_granted: false,
    });
  });

  it('preserves canonical validation failures', async () => {
    process.env.STORY_AGENT_BASE_URL = 'https://story-agent.example.com';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'target is not a current manifest gap',
        },
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await expect(submitFinalDeliveryManifestDisposition({
      series_project_id: 'stale-series',
      disposition: 'preserve_fixture_exclude_from_publishable_delivery',
      authorized_media_inputs_attested: false,
      operator: {
        operator_id: 'operator-manifest-001',
        display_name: 'Manifest Operator',
        identity_reference: 'operator-roster/manifest-001',
      },
      decision: {
        rationale: '目标已经不是 manifest 缺口，应由 canonical 服务拒绝。',
        evidence_references: ['project.json#seedance_final_delivery'],
      },
      attestation: {
        human_operator: true,
        reviewed_current_preflight: true,
        accepts_no_publishable_delivery_credit: true,
      },
      idempotency_key: 'manifest-mcp-disposition-stale-0001',
    })).rejects.toThrow(
      'VALIDATION_ERROR: target is not a current manifest gap',
    );
  });
});
