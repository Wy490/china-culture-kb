export interface IngestReferencePrivateVideoSampleInput {
  title: string;
  media_type: 'film' | 'episode' | 'promo' | 'tutorial';
  local_video_path: string;
  rights_status: 'user_owned' | 'licensed' | 'public_domain';
  access_scope: 'excerpt' | 'full_user_supplied';
  user_reason: string;
  authorization_reference: string;
  attested_by: string;
  attested_at: string;
  thumbnail_time_seconds?: number;
  extract_thumbnail?: boolean;
  extract_audio_wav?: boolean;
}

export interface ReferencePrivateVideoSampleInput {
  sample_id: string;
}

export interface SubmitReferencePrivateVideoTranscriptInput
  extends ReferencePrivateVideoSampleInput {
  transcript_text: string;
  transcript_format: 'text/plain' | 'text/srt' | 'text/vtt';
  transcribed_by: string;
  transcribed_at: string;
  method: 'local_manual' | 'local_model';
  tool_name?: string;
  tool_version?: string;
}

interface StoryAgentApiEnvelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}

export type ReferencePrivateVideoSampleCanonicalTool =
  | 'kb_ingest_reference_private_video_sample'
  | 'kb_get_reference_private_video_sample'
  | 'kb_submit_reference_private_video_transcript';

export interface ReferencePrivateVideoSampleBridgeMetadata {
  schema_version: 'mcp-reference-private-video-sample-bridge/v1';
  canonical_tool: ReferencePrivateVideoSampleCanonicalTool;
  canonical_service: true;
  application_endpoint: string;
  application_method: 'GET' | 'POST';
  authoritative_request_schema: string;
  output_schema: string;
  local_private_mode: true;
  source_video_path_treated_as_local_private_reference: true;
  source_video_path_returned_by_mcp: false;
  transcript_text_returned_by_mcp: false;
  source_video_in_git: false;
  third_party_upload_performed: false;
  server_model_call_performed: false;
  ffmpeg_invoked_by_mcp: false;
  direct_repository_write_performed_by_mcp: false;
  automatic_approval_performed: false;
  knowledge_writeback_performed: false;
  production_credit_granted: false;
}

export type ReferencePrivateVideoSampleBridgeResult = StoryAgentApiEnvelope & {
  mcp_bridge: ReferencePrivateVideoSampleBridgeMetadata;
};

const SAMPLE_ID_PATTERN = /^reference-private-video-[a-f0-9]{24}$/;

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；private video sample MCP 工具必须调用 canonical Web application service。',
    );
  }
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('STORY_AGENT_BASE_URL 仅支持 http/https');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('STORY_AGENT_BASE_URL 不得包含凭据、query 或 hash');
  }
  return url.toString().replace(/\/$/, '');
}

function accessTokenHeader(): Record<string, string> {
  const token = process.env.STORY_AGENT_MCP_ACCESS_TOKEN?.trim();
  if (!token) return {};
  if (/\s/.test(token)) {
    throw new Error('STORY_AGENT_MCP_ACCESS_TOKEN 格式无效');
  }
  return { authorization: `Bearer ${token}` };
}

function validateActor(actor: string, field: string): void {
  if (!actor.trim() || actor.length > 160) {
    throw new Error(`${field} must be a non-empty bounded actor id`);
  }
}

function validateSampleId(sampleId: string): void {
  if (!SAMPLE_ID_PATTERN.test(sampleId)) {
    throw new Error('sample_id must be a canonical reference private video sample id');
  }
}

function validateLocalVideoPath(localVideoPath: string): void {
  if (!localVideoPath.trim() || localVideoPath.length > 2_000) {
    throw new Error('local_video_path must be a non-empty bounded local path');
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(localVideoPath)) {
    throw new Error('local_video_path must be a local filesystem path, not a URL or URI');
  }
  if (!localVideoPath.startsWith('/')) {
    throw new Error('local_video_path must be an absolute local filesystem path');
  }
}

function validateTranscriptText(transcriptText: string): void {
  if (!transcriptText.trim() || transcriptText.length > 500_000) {
    throw new Error('transcript_text must be non-empty and at most 500000 characters');
  }
}

function privateVideoSamplesEndpoint(sampleId?: string): string {
  const base = `${storyAgentBaseUrl()}/api/reference-library/private-video-samples`;
  if (!sampleId) return base;
  validateSampleId(sampleId);
  return `${base}/${encodeURIComponent(sampleId)}`;
}

async function requestApplication(input: {
  endpoint: string;
  method: 'GET' | 'POST';
  body?: unknown;
}): Promise<StoryAgentApiEnvelope> {
  const response = await fetch(input.endpoint, {
    method: input.method,
    headers: input.body === undefined
      ? accessTokenHeader()
      : {
          'content-type': 'application/json',
          ...accessTokenHeader(),
        },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: AbortSignal.timeout(120_000),
  });
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(
      `Story Agent application service 返回了非 JSON 响应（HTTP ${response.status}）`,
    );
  }
  if (
    typeof parsed !== 'object'
    || parsed === null
    || Array.isArray(parsed)
    || typeof (parsed as { ok?: unknown }).ok !== 'boolean'
  ) {
    throw new Error(
      `Story Agent application service 返回了无效 API envelope（HTTP ${response.status}）`,
    );
  }
  const envelope = parsed as StoryAgentApiEnvelope;
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim()
      || 'REFERENCE_PRIVATE_VIDEO_SAMPLE_MCP_BRIDGE_FAILED';
    const message = envelope.error?.message?.trim()
      || `Reference private video sample 请求失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return envelope;
}

async function bridge(input: {
  canonicalTool: ReferencePrivateVideoSampleCanonicalTool;
  endpoint: string;
  method: 'GET' | 'POST';
  requestSchema: string;
  outputSchema: string;
  body?: unknown;
}): Promise<ReferencePrivateVideoSampleBridgeResult> {
  const envelope = await requestApplication({
    endpoint: input.endpoint,
    method: input.method,
    body: input.body,
  });
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-reference-private-video-sample-bridge/v1',
      canonical_tool: input.canonicalTool,
      canonical_service: true,
      application_endpoint: input.endpoint,
      application_method: input.method,
      authoritative_request_schema: input.requestSchema,
      output_schema: input.outputSchema,
      local_private_mode: true,
      source_video_path_treated_as_local_private_reference: true,
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
    },
  };
}

export async function ingestReferencePrivateVideoSample(
  input: IngestReferencePrivateVideoSampleInput,
): Promise<ReferencePrivateVideoSampleBridgeResult> {
  validateLocalVideoPath(input.local_video_path);
  validateActor(input.attested_by, 'attested_by');
  const endpoint = privateVideoSamplesEndpoint();
  return bridge({
    canonicalTool: 'kb_ingest_reference_private_video_sample',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferencePrivateVideoSampleIngestRequestSchema',
    outputSchema: 'reference-private-video-sample/v1',
    body: {
      title: input.title,
      media_type: input.media_type,
      local_video_path: input.local_video_path,
      rights_status: input.rights_status,
      access_scope: input.access_scope,
      user_reason: input.user_reason,
      authorization: {
        basis: input.rights_status,
        authorization_reference: input.authorization_reference,
        attested_by: input.attested_by,
        attested_at: input.attested_at,
        confirmation: 'authorized_private_video_ingest',
      },
      thumbnail_time_seconds: input.thumbnail_time_seconds,
      extract_thumbnail: input.extract_thumbnail,
      extract_audio_wav: input.extract_audio_wav,
    },
  });
}

export async function getReferencePrivateVideoSample(
  input: ReferencePrivateVideoSampleInput,
): Promise<ReferencePrivateVideoSampleBridgeResult> {
  const endpoint = privateVideoSamplesEndpoint(input.sample_id);
  return bridge({
    canonicalTool: 'kb_get_reference_private_video_sample',
    endpoint,
    method: 'GET',
    requestSchema: 'ReferencePrivateVideoSampleIdParamSchema',
    outputSchema: 'reference-private-video-sample/v1',
  });
}

export async function submitReferencePrivateVideoTranscript(
  input: SubmitReferencePrivateVideoTranscriptInput,
): Promise<ReferencePrivateVideoSampleBridgeResult> {
  validateTranscriptText(input.transcript_text);
  validateActor(input.transcribed_by, 'transcribed_by');
  const endpoint = `${privateVideoSamplesEndpoint(input.sample_id)}/transcript`;
  return bridge({
    canonicalTool: 'kb_submit_reference_private_video_transcript',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferencePrivateVideoTranscriptSubmitRequestSchema',
    outputSchema: 'reference-private-video-sample/v1',
    body: {
      transcript_text: input.transcript_text,
      transcript_format: input.transcript_format,
      transcribed_by: input.transcribed_by,
      transcribed_at: input.transcribed_at,
      method: input.method,
      tool_name: input.tool_name,
      tool_version: input.tool_version,
      confirmation: 'local_private_transcription_only',
    },
  });
}
