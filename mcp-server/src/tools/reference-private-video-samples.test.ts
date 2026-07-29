import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getReferencePrivateVideoSample,
  ingestReferencePrivateVideoSample,
  submitReferencePrivateVideoTranscript,
} from './reference-private-video-samples.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;
const originalAccessToken = process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
const sampleId = 'reference-private-video-1234567890abcdef12345678';

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

describe('Reference private video sample MCP bridge', () => {
  it('ingests private video samples through the canonical application service only', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'private-video-token';
    const fetchMock = vi.fn().mockImplementation(async () => okEnvelope({
      schema_version: 'reference-private-video-sample/v1',
      sample_id: sampleId,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await ingestReferencePrivateVideoSample({
      title: '授权私有样片',
      media_type: 'episode',
      local_video_path: '/private/tmp/authorized-sample.mp4',
      rights_status: 'user_owned',
      access_scope: 'full_user_supplied',
      user_reason: '本地私有样片分析',
      authorization_reference: 'private-video-attestation-20260729',
      attested_by: 'material-reviewer-01',
      attested_at: '2026-07-29T10:00:00.000Z',
      thumbnail_time_seconds: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:3999/api/reference-library/private-video-samples',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer private-video-token',
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      title: '授权私有样片',
      media_type: 'episode',
      local_video_path: '/private/tmp/authorized-sample.mp4',
      rights_status: 'user_owned',
      access_scope: 'full_user_supplied',
      user_reason: '本地私有样片分析',
      authorization: {
        basis: 'user_owned',
        authorization_reference: 'private-video-attestation-20260729',
        attested_by: 'material-reviewer-01',
        attested_at: '2026-07-29T10:00:00.000Z',
        confirmation: 'authorized_private_video_ingest',
      },
      thumbnail_time_seconds: 1,
    });
    expect(result.mcp_bridge).toMatchObject({
      schema_version: 'mcp-reference-private-video-sample-bridge/v1',
      canonical_tool: 'kb_ingest_reference_private_video_sample',
      canonical_service: true,
      local_private_mode: true,
      source_video_path_returned_by_mcp: false,
      transcript_text_returned_by_mcp: false,
      source_video_in_git: false,
      third_party_upload_performed: false,
      server_model_call_performed: false,
      ffmpeg_invoked_by_mcp: false,
      direct_repository_write_performed_by_mcp: false,
      automatic_approval_performed: false,
      knowledge_writeback_performed: false,
      production_credit_granted: false,
    });
  });

  it('reads sample status and submits local transcript without returning transcript text', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn().mockImplementation(async () => okEnvelope({
      schema_version: 'reference-private-video-sample/v1',
      sample_id: sampleId,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await getReferencePrivateVideoSample({ sample_id: sampleId });
    const submitted = await submitReferencePrivateVideoTranscript({
      sample_id: sampleId,
      transcript_text: '00:00:00 本地转写片段。',
      transcript_format: 'text/plain',
      transcribed_by: 'material-reviewer-01',
      transcribed_at: '2026-07-29T10:05:00.000Z',
      method: 'local_model',
      tool_name: 'local-whisper',
      tool_version: 'offline',
    });

    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      `http://127.0.0.1:3999/api/reference-library/private-video-samples/${sampleId}`,
      `http://127.0.0.1:3999/api/reference-library/private-video-samples/${sampleId}/transcript`,
    ]);
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      transcript_text: '00:00:00 本地转写片段。',
      transcript_format: 'text/plain',
      transcribed_by: 'material-reviewer-01',
      transcribed_at: '2026-07-29T10:05:00.000Z',
      method: 'local_model',
      tool_name: 'local-whisper',
      tool_version: 'offline',
      confirmation: 'local_private_transcription_only',
    });
    expect(submitted.mcp_bridge).toMatchObject({
      canonical_tool: 'kb_submit_reference_private_video_transcript',
      transcript_text_returned_by_mcp: false,
      third_party_upload_performed: false,
      production_credit_granted: false,
    });
  });

  it('rejects unsafe inputs and canonical API failures before returning success', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(ingestReferencePrivateVideoSample({
      title: '远程视频',
      media_type: 'film',
      local_video_path: 'https://example.com/video.mp4',
      rights_status: 'licensed',
      access_scope: 'excerpt',
      user_reason: '不得由 MCP 接收 URL',
      authorization_reference: 'license-20260729',
      attested_by: 'material-reviewer-01',
      attested_at: '2026-07-29T10:00:00.000Z',
    })).rejects.toThrow('local_video_path');
    await expect(getReferencePrivateVideoSample({ sample_id: '../outside' }))
      .rejects.toThrow('sample_id');
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/?token=bad';
    await expect(getReferencePrivateVideoSample({ sample_id: sampleId }))
      .rejects.toThrow('STORY_AGENT_BASE_URL 不得包含凭据');

    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      data: null,
      error: {
        code: 'REFERENCE_PRIVATE_VIDEO_SOURCE_PATH_INVALID',
        message: 'Private video originals must be supplied from outside the Git worktree',
      },
    }), { status: 400, headers: { 'content-type': 'application/json' } }));
    await expect(ingestReferencePrivateVideoSample({
      title: '仓库内视频',
      media_type: 'film',
      local_video_path: '/Users/wuyu/Desktop/china-culture-kb/raw.mp4',
      rights_status: 'licensed',
      access_scope: 'excerpt',
      user_reason: 'canonical Web service should reject worktree source',
      authorization_reference: 'license-20260729',
      attested_by: 'material-reviewer-01',
      attested_at: '2026-07-29T10:00:00.000Z',
    })).rejects.toThrow(
      'REFERENCE_PRIVATE_VIDEO_SOURCE_PATH_INVALID: Private video originals must be supplied from outside the Git worktree',
    );
  });
});
