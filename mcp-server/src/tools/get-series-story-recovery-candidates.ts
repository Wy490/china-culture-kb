interface StoryAgentApiError {
  code?: string;
  message?: string;
}

interface StoryAgentApiEnvelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: StoryAgentApiError | null;
}

export interface GetSeriesStoryRecoveryCandidatesInput {
  limit?: number;
}

export type SeriesStoryRecoveryCandidateToolResult =
  StoryAgentApiEnvelope & {
    mcp_bridge: {
      schema_version:
        'mcp-story-agent-series-story-recovery-candidates/v1';
      canonical_tool:
        'kb_get_story_agent_series_story_recovery_candidates';
      canonical_service: true;
      application_endpoint: string;
      read_only: true;
      operator_whitelist_required: true;
      automatic_relink_allowed: false;
      project_files_modified: false;
      story_files_written: false;
      signoff_portfolio_modified: false;
      publishable_delivery_credit_granted: false;
    };
  };

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；series story recovery candidate '
      + 'MCP 工具必须调用 canonical Web application service。',
    );
  }
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('STORY_AGENT_BASE_URL 仅支持 http/https');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'STORY_AGENT_BASE_URL 不得包含凭据、query 或 hash',
    );
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

export async function getSeriesStoryRecoveryCandidates(
  input: GetSeriesStoryRecoveryCandidatesInput = {},
): Promise<SeriesStoryRecoveryCandidateToolResult> {
  const endpoint = new URL(
    `${storyAgentBaseUrl()}/api/system/`
    + 'story-agent-series-story-recovery-candidates',
  );
  if (input.limit !== undefined) {
    endpoint.searchParams.set('limit', String(input.limit));
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
      || 'STORY_AGENT_SERIES_STORY_RECOVERY_CANDIDATES_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent 系列故事恢复候选查询失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return {
    ...envelope,
    mcp_bridge: {
      schema_version:
        'mcp-story-agent-series-story-recovery-candidates/v1',
      canonical_tool:
        'kb_get_story_agent_series_story_recovery_candidates',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      read_only: true,
      operator_whitelist_required: true,
      automatic_relink_allowed: false,
      project_files_modified: false,
      story_files_written: false,
      signoff_portfolio_modified: false,
      publishable_delivery_credit_granted: false,
    },
  };
}
