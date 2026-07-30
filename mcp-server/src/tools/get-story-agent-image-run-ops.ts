interface StoryAgentApiError {
  code?: string;
  message?: string;
}

interface StoryAgentApiEnvelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: StoryAgentApiError | null;
}

export interface GetStoryAgentImageRunOpsInput {
  limit?: number;
  stale_after_ms?: number;
}

export type StoryAgentImageRunOpsToolResult =
  StoryAgentApiEnvelope & {
    mcp_bridge: {
      schema_version: 'mcp-story-agent-image-run-ops/v1';
      canonical_tool: 'kb_get_story_agent_image_run_ops';
      canonical_service: true;
      application_endpoint: string;
      read_only: true;
      provider_invoked: false;
      image_run_files_modified: false;
      story_agent_run_files_modified: false;
      automatic_close_allowed: false;
      publishable_delivery_credit_granted: false;
    };
  };

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；image run ops MCP 工具必须调用 '
      + 'canonical Web application service。',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

async function readApiEnvelope(
  response: Response,
): Promise<StoryAgentApiEnvelope> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(
      `Story Agent application service 返回了非 JSON 响应（HTTP ${response.status}）`,
    );
  }
  if (!isRecord(parsed) || typeof parsed.ok !== 'boolean') {
    throw new Error(
      `Story Agent application service 返回了无效 API envelope（HTTP ${response.status}）`,
    );
  }
  return parsed as StoryAgentApiEnvelope;
}

export async function getStoryAgentImageRunOps(
  input: GetStoryAgentImageRunOpsInput = {},
): Promise<StoryAgentImageRunOpsToolResult> {
  const endpoint = new URL(
    `${storyAgentBaseUrl()}/api/system/story-agent-image-run-ops`,
  );
  if (input.limit !== undefined) {
    endpoint.searchParams.set('limit', String(input.limit));
  }
  if (input.stale_after_ms !== undefined) {
    endpoint.searchParams.set(
      'stale_after_ms',
      String(input.stale_after_ms),
    );
  }
  const applicationEndpoint = endpoint.toString();
  const response = await fetch(applicationEndpoint, {
    method: 'GET',
    headers: accessTokenHeader(),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim()
      || 'STORY_AGENT_IMAGE_RUN_OPS_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent Image Run 运维审计失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-image-run-ops/v1',
      canonical_tool: 'kb_get_story_agent_image_run_ops',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      read_only: true,
      provider_invoked: false,
      image_run_files_modified: false,
      story_agent_run_files_modified: false,
      automatic_close_allowed: false,
      publishable_delivery_credit_granted: false,
    },
  };
}
