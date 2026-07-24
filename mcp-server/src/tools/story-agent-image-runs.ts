export interface ExportStoryAgentImageRequestInput {
  project_id?: string;
  series_project_id?: string;
}

export interface ImportStoryAgentImageResultInput {
  run_id: string;
  result: {
    schema_version: 'image-generation-result/v1';
    run_id: string;
    request_sha256: string;
    completed_at: string;
    items: Array<{
      task_id: string;
      covers_task_ids?: string[];
      status: 'generated' | 'failed_retryable' | 'blocked';
      output_path?: string;
      mime_type?: string;
      content_sha256?: string;
      prompt_sha256: string;
      provider?: string;
      provider_asset_id?: string;
      model?: string;
      failure_reason?: string;
      retryable?: boolean;
    }>;
  };
}

interface StoryAgentApiEnvelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}

interface StoryAgentImageRunBridgeMetadata {
  schema_version: 'mcp-story-agent-image-run-bridge/v1';
  canonical_tool:
    | 'kb_export_story_agent_image_request'
    | 'kb_import_story_agent_image_result';
  canonical_service: true;
  application_endpoint: string;
  authoritative_request_schema:
    | 'StoryAgentImageRunExportRequestSchema'
    | 'StoryAgentImageGenerationResultSchema';
  output_schema:
    | 'story-agent-image-run/v1'
    | 'story-agent-image-result-import/v1';
  provider_invoked_by_mcp: false;
  direct_asset_library_write_performed: false;
  video_generation_performed: false;
}

export type StoryAgentImageRunBridgeResult = StoryAgentApiEnvelope & {
  mcp_bridge: StoryAgentImageRunBridgeMetadata;
};

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；Story Agent 图片运行工具必须调用 canonical Web application service。',
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
  if (/\s/.test(token)) throw new Error('STORY_AGENT_MCP_ACCESS_TOKEN 格式无效');
  return { authorization: `Bearer ${token}` };
}

async function postApplication(
  endpoint: string,
  body: unknown,
): Promise<StoryAgentApiEnvelope> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...accessTokenHeader(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(`Story Agent application service 返回了非 JSON 响应（HTTP ${response.status}）`);
  }
  if (
    typeof parsed !== 'object'
    || parsed === null
    || Array.isArray(parsed)
    || typeof (parsed as { ok?: unknown }).ok !== 'boolean'
  ) {
    throw new Error(`Story Agent application service 返回了无效 API envelope（HTTP ${response.status}）`);
  }
  const envelope = parsed as StoryAgentApiEnvelope;
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim() || 'STORY_AGENT_IMAGE_RUN_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent application service 图片运行请求失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return envelope;
}

export async function exportStoryAgentImageRequest(
  input: ExportStoryAgentImageRequestInput,
): Promise<StoryAgentImageRunBridgeResult> {
  if ([input.project_id, input.series_project_id].filter(value => Boolean(value?.trim())).length !== 1) {
    throw new Error('exactly one of project_id or series_project_id is required');
  }
  const applicationEndpoint = `${storyAgentBaseUrl()}/api/story-agent/image-runs/export-request`;
  const envelope = await postApplication(applicationEndpoint, input);
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-image-run-bridge/v1',
      canonical_tool: 'kb_export_story_agent_image_request',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_request_schema: 'StoryAgentImageRunExportRequestSchema',
      output_schema: 'story-agent-image-run/v1',
      provider_invoked_by_mcp: false,
      direct_asset_library_write_performed: false,
      video_generation_performed: false,
    },
  };
}

export async function importStoryAgentImageResult(
  input: ImportStoryAgentImageResultInput,
): Promise<StoryAgentImageRunBridgeResult> {
  if (input.result.run_id !== input.run_id) {
    throw new Error('Path run_id must match result.run_id');
  }
  const applicationEndpoint = `${storyAgentBaseUrl()}/api/story-agent/image-runs/${input.run_id}/import-result`;
  const envelope = await postApplication(applicationEndpoint, input.result);
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-image-run-bridge/v1',
      canonical_tool: 'kb_import_story_agent_image_result',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_request_schema: 'StoryAgentImageGenerationResultSchema',
      output_schema: 'story-agent-image-result-import/v1',
      provider_invoked_by_mcp: false,
      direct_asset_library_write_performed: false,
      video_generation_performed: false,
    },
  };
}
