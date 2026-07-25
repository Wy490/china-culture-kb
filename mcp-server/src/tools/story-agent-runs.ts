export interface StartStoryAgentRunInput {
  project_id?: string;
  series_project_id?: string;
}

export interface StoryAgentRunIdInput {
  run_id: string;
}

export interface ImportStoryAgentRunImagesInput extends StoryAgentRunIdInput {
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

type StoryAgentRunCanonicalTool =
  | 'kb_start_story_agent_run'
  | 'kb_get_story_agent_run'
  | 'kb_resume_story_agent_run'
  | 'kb_import_story_agent_images'
  | 'kb_export_story_agent_run';

interface StoryAgentRunBridgeMetadata {
  schema_version: 'mcp-story-agent-run-bridge/v1';
  canonical_tool: StoryAgentRunCanonicalTool;
  canonical_service: true;
  application_endpoint: string;
  authoritative_request_schema:
    | 'StoryAgentRunStartRequestSchema'
    | 'StoryAgentRunIdParamSchema'
    | 'StoryAgentImageGenerationResultSchema';
  output_schema:
    | 'story-agent-run/v1'
    | 'story-agent-run-image-import/v1'
    | 'story-agent-run-export/v1';
  provider_invoked_by_mcp: false;
  direct_project_write_performed: false;
  video_generation_performed: false;
}

export type StoryAgentRunBridgeResult = StoryAgentApiEnvelope & {
  mcp_bridge: StoryAgentRunBridgeMetadata;
};

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；Story Agent run 工具必须调用 canonical Web application service。',
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

function validateSource(input: StartStoryAgentRunInput): void {
  if ([input.project_id, input.series_project_id].filter(value => Boolean(value?.trim())).length !== 1) {
    throw new Error('exactly one of project_id or series_project_id is required');
  }
}

function validateRunId(runId: string): void {
  if (!/^story-agent-run-[a-f0-9]{24}$/.test(runId)) {
    throw new Error('run_id must be a stable top-level Story Agent run id');
  }
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
    const code = envelope.error?.code?.trim() || 'STORY_AGENT_RUN_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent application service run 请求失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return envelope;
}

function withBridge(
  envelope: StoryAgentApiEnvelope,
  input: {
    canonicalTool: StoryAgentRunCanonicalTool;
    endpoint: string;
    requestSchema: StoryAgentRunBridgeMetadata['authoritative_request_schema'];
    outputSchema: StoryAgentRunBridgeMetadata['output_schema'];
  },
): StoryAgentRunBridgeResult {
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-run-bridge/v1',
      canonical_tool: input.canonicalTool,
      canonical_service: true,
      application_endpoint: input.endpoint,
      authoritative_request_schema: input.requestSchema,
      output_schema: input.outputSchema,
      provider_invoked_by_mcp: false,
      direct_project_write_performed: false,
      video_generation_performed: false,
    },
  };
}

export async function startStoryAgentRun(
  input: StartStoryAgentRunInput,
): Promise<StoryAgentRunBridgeResult> {
  validateSource(input);
  const endpoint = `${storyAgentBaseUrl()}/api/story-agent/runs`;
  return withBridge(
    await requestApplication({ endpoint, method: 'POST', body: input }),
    {
      canonicalTool: 'kb_start_story_agent_run',
      endpoint,
      requestSchema: 'StoryAgentRunStartRequestSchema',
      outputSchema: 'story-agent-run/v1',
    },
  );
}

export async function getStoryAgentRun(
  input: StoryAgentRunIdInput,
): Promise<StoryAgentRunBridgeResult> {
  validateRunId(input.run_id);
  const endpoint = `${storyAgentBaseUrl()}/api/story-agent/runs/${input.run_id}`;
  return withBridge(
    await requestApplication({ endpoint, method: 'GET' }),
    {
      canonicalTool: 'kb_get_story_agent_run',
      endpoint,
      requestSchema: 'StoryAgentRunIdParamSchema',
      outputSchema: 'story-agent-run/v1',
    },
  );
}

export async function resumeStoryAgentRun(
  input: StoryAgentRunIdInput,
): Promise<StoryAgentRunBridgeResult> {
  validateRunId(input.run_id);
  const endpoint = `${storyAgentBaseUrl()}/api/story-agent/runs/${input.run_id}/resume`;
  return withBridge(
    await requestApplication({ endpoint, method: 'POST', body: {} }),
    {
      canonicalTool: 'kb_resume_story_agent_run',
      endpoint,
      requestSchema: 'StoryAgentRunIdParamSchema',
      outputSchema: 'story-agent-run/v1',
    },
  );
}

export async function importStoryAgentRunImages(
  input: ImportStoryAgentRunImagesInput,
): Promise<StoryAgentRunBridgeResult> {
  validateRunId(input.run_id);
  const endpoint = `${storyAgentBaseUrl()}/api/story-agent/runs/${input.run_id}/import-images`;
  return withBridge(
    await requestApplication({ endpoint, method: 'POST', body: input.result }),
    {
      canonicalTool: 'kb_import_story_agent_images',
      endpoint,
      requestSchema: 'StoryAgentImageGenerationResultSchema',
      outputSchema: 'story-agent-run-image-import/v1',
    },
  );
}

export async function exportStoryAgentRun(
  input: StoryAgentRunIdInput,
): Promise<StoryAgentRunBridgeResult> {
  validateRunId(input.run_id);
  const endpoint = `${storyAgentBaseUrl()}/api/story-agent/runs/${input.run_id}/export`;
  return withBridge(
    await requestApplication({ endpoint, method: 'GET' }),
    {
      canonicalTool: 'kb_export_story_agent_run',
      endpoint,
      requestSchema: 'StoryAgentRunIdParamSchema',
      outputSchema: 'story-agent-run-export/v1',
    },
  );
}
