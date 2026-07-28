import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  finalizeReferenceTextAnalysisExecution,
  getReferenceAnalysisTask,
  getReferenceTextAnalysisDraftTask,
  getReferenceTextAnalysisExecution,
  getReferenceTextAnalysisNextChunk,
  getReferenceTextAnalysisSupplement,
  requestReferenceTextAnalysisSupplement,
  startReferenceTextAnalysisDraftTask,
  startReferenceTextAnalysisExecution,
  submitReferenceTextAnalysisChunk,
  submitReferenceTextAnalysisDraft,
  submitReferenceTextAnalysisSupplement,
} from './reference-text-analysis.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;
const originalAccessToken = process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
const taskId = 'reference-analysis-task-12345678-abcd-4abc-9def-1234567890ab';

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.STORY_AGENT_BASE_URL;
  else process.env.STORY_AGENT_BASE_URL = originalBaseUrl;
  if (originalAccessToken === undefined) delete process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
  else process.env.STORY_AGENT_MCP_ACCESS_TOKEN = originalAccessToken;
});

function okEnvelope(data: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: true, data, error: null }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Reference text analysis MCP bridge', () => {
  it('reads canonical task, execution, next chunk, draft task, and supplement endpoints', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'reference-reviewer-token';
    const fetchMock = vi.fn().mockImplementation(async () => okEnvelope({
      schema_version: 'reference-text-analysis-execution/v1',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([
      getReferenceAnalysisTask({ task_id: taskId }),
      getReferenceTextAnalysisExecution({ task_id: taskId }),
      getReferenceTextAnalysisNextChunk({ task_id: taskId }),
      getReferenceTextAnalysisDraftTask({ task_id: taskId }),
      getReferenceTextAnalysisSupplement({ task_id: taskId }),
    ]);

    const base = `http://127.0.0.1:3999/api/reference-library/analysis-tasks/${taskId}`;
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      base,
      `${base}/text-execution`,
      `${base}/text-execution/next-chunk`,
      `${base}/text-analysis-draft-task`,
      `${base}/text-analysis-draft-task/supplement`,
    ]);
    expect(fetchMock.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      authorization: 'Bearer reference-reviewer-token',
    });
    expect(results.map(result => result.mcp_bridge)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema_version: 'mcp-reference-text-analysis-bridge/v1',
          canonical_service: true,
          source_text_instruction_authority: 'none',
          automatic_approval_performed: false,
          knowledge_writeback_performed: false,
          production_credit_granted: false,
        }),
      ]),
    );
  });

  it('starts, checkpoints, and finalizes the execution through canonical application requests', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn().mockImplementation(async () => okEnvelope({
      schema_version: 'reference-text-analysis-execution/v1',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await startReferenceTextAnalysisExecution({
      task_id: taskId,
      executor_kind: 'codex',
      executor_id: 'material-reviewer-01',
    });
    await submitReferenceTextAnalysisChunk({
      task_id: taskId,
      chunk_id: 'chunk-0001',
      submission_key: 'reference-chunk-submission-0001',
      submitted_by: 'material-reviewer-01',
      chunk_content_sha256: 'a'.repeat(64),
      observations: {
        excerpts: [],
        character_profiles: [],
        plot_beats: [],
        shot_sequence: [],
      },
    });
    await finalizeReferenceTextAnalysisExecution({
      task_id: taskId,
      finalized_by: 'material-reviewer-01',
    });

    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      `http://127.0.0.1:3999/api/reference-library/analysis-tasks/${taskId}/text-execution`,
      `http://127.0.0.1:3999/api/reference-library/analysis-tasks/${taskId}/text-execution/chunks/chunk-0001/submissions`,
      `http://127.0.0.1:3999/api/reference-library/analysis-tasks/${taskId}/text-execution/finalize`,
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      executor: { kind: 'codex', executor_id: 'material-reviewer-01' },
      confirmation: 'source_text_treated_as_untrusted_data',
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toEqual({
      finalized_by: 'material-reviewer-01',
      confirmation: 'aggregate_completed_chunks_to_operator_evidence',
    });
  });

  it('advances the evidence-bound draft and bounded supplement lifecycle without approval', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn().mockImplementation(async () => okEnvelope({
      schema_version: 'reference-text-analysis-draft-task/v2',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await startReferenceTextAnalysisDraftTask({
      task_id: taskId,
      executor_kind: 'operator',
      executor_id: 'material-reviewer-02',
    });
    await requestReferenceTextAnalysisSupplement({
      task_id: taskId,
      submission_key: 'supplement-request-0001',
      requested_by: 'material-reviewer-02',
      needs: [{
        field: 'scene_patterns',
        reason: 'insufficient_source_coverage',
        evidence_id: 'reference-similarity-evidence-01',
        evidence_observation_ids: ['plot-beat-01'],
        required_input: 'bounded_source_observations',
      }],
    });
    await submitReferenceTextAnalysisSupplement({
      task_id: taskId,
      submission_key: 'supplement-submission-0001',
      submitted_by: 'material-reviewer-02',
      items: [{
        field: 'scene_patterns',
        source_locators: ['lines 12-18'],
        observation_summary: 'The opposition becomes visible through a failed negotiation.',
        limitations: ['Only one source unit supports this observation.'],
      }],
    });
    const submitted = await submitReferenceTextAnalysisDraft({
      task_id: taskId,
      submission_key: 'analysis-draft-submission-0001',
      submitted_by: 'material-reviewer-02',
      analysis: {
        source_units: [],
        character_wants: [],
        scene_patterns: [],
        must_keep: [],
        compression_options: [],
        adaptation_risks: [],
        reusable_principles: [],
        avoid_copying: [],
      },
    });

    const requests = fetchMock.mock.calls.map(call => JSON.parse(call[1].body as string));
    expect(requests[0].confirmation)
      .toBe('draft_complete_text_analysis_from_verified_evidence');
    expect(requests[1].confirmation)
      .toBe('declare_text_analysis_evidence_insufficient');
    expect(requests[2].confirmation)
      .toBe('submit_bounded_supplement_without_source_excerpts');
    expect(requests[3].confirmation)
      .toBe('submit_pending_text_reference_analysis');
    expect(submitted.mcp_bridge).toMatchObject({
      canonical_tool: 'kb_submit_reference_text_analysis_draft',
      automatic_approval_performed: false,
      knowledge_writeback_performed: false,
      production_credit_granted: false,
    });
  });

  it('rejects malformed ids and canonical API failures before returning bridge success', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getReferenceAnalysisTask({ task_id: '../outside' }))
      .rejects.toThrow('task_id');
    await expect(submitReferenceTextAnalysisChunk({
      task_id: taskId,
      chunk_id: '../chunk',
      submission_key: 'reference-chunk-submission-0002',
      submitted_by: 'material-reviewer-01',
      chunk_content_sha256: 'a'.repeat(64),
      observations: {},
    })).rejects.toThrow('chunk_id');
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      data: null,
      error: {
        code: 'REFERENCE_TEXT_ANALYSIS_FINAL_OBSERVATIONS_INVALID',
        message: 'requested dimensions are incomplete',
      },
    }), { status: 400, headers: { 'content-type': 'application/json' } }));

    await expect(finalizeReferenceTextAnalysisExecution({
      task_id: taskId,
      finalized_by: 'material-reviewer-01',
    })).rejects.toThrow(
      'REFERENCE_TEXT_ANALYSIS_FINAL_OBSERVATIONS_INVALID: requested dimensions are incomplete',
    );
  });
});
