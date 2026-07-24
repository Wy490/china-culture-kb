export interface ExportStoryAgentPreproductionInput {
  story_id?: string;
  project_id?: string;
  series_project_id?: string;
}

interface StoryAgentApiEnvelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}

export interface StoryAgentPreproductionBridgeMetadata {
  schema_version: 'mcp-story-agent-preproduction-export/v1';
  canonical_tool: 'kb_export_story_agent_preproduction';
  canonical_service: true;
  application_endpoint: string;
  authoritative_request_schema: 'StoryAgentSeedancePreproductionExportRequestSchema';
  output_schema: 'story-agent-seedance-preproduction-package/v1';
  direct_file_write_performed: false;
  video_generation_performed: false;
}

export type ExportStoryAgentPreproductionResult = StoryAgentApiEnvelope & {
  mcp_bridge: StoryAgentPreproductionBridgeMetadata;
};

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；kb_export_story_agent_preproduction 必须调用 canonical Web application service。',
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

function validateSource(input: ExportStoryAgentPreproductionInput): void {
  const count = [input.story_id, input.project_id, input.series_project_id]
    .filter(value => Boolean(value?.trim())).length;
  if (count !== 1) {
    throw new Error('exactly one of story_id, project_id, or series_project_id is required');
  }
}

async function readApiEnvelope(response: Response): Promise<StoryAgentApiEnvelope> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(`Story Agent application service 返回了非 JSON 响应（HTTP ${response.status}）`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
    || typeof (parsed as { ok?: unknown }).ok !== 'boolean') {
    throw new Error(`Story Agent application service 返回了无效 API envelope（HTTP ${response.status}）`);
  }
  return parsed as StoryAgentApiEnvelope;
}

export async function exportStoryAgentPreproduction(
  input: ExportStoryAgentPreproductionInput,
): Promise<ExportStoryAgentPreproductionResult> {
  validateSource(input);
  const applicationEndpoint = `${storyAgentBaseUrl()}/api/story-agent/preproduction/export`;
  const response = await fetch(applicationEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...accessTokenHeader(),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim() || 'STORY_AGENT_PREPRODUCTION_EXPORT_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent application service 导出失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-preproduction-export/v1',
      canonical_tool: 'kb_export_story_agent_preproduction',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_request_schema: 'StoryAgentSeedancePreproductionExportRequestSchema',
      output_schema: 'story-agent-seedance-preproduction-package/v1',
      direct_file_write_performed: false,
      video_generation_performed: false,
    },
  };
}
