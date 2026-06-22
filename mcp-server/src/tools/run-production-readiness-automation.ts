import { getProductionReadiness, type ProductionReadinessReport } from './get-production-readiness.js';

type ProductionReadinessScope = 'story_project' | 'ai_comic_series';
type TransportStatus = 'sent' | 'missing_story_agent_base_url' | 'invalid_story_agent_base_url' | 'request_failed';

type JsonRecord = Record<string, unknown>;

export interface RunProductionReadinessAutomationInput {
  project_id?: string;
  series_project_id?: string;
  dry_run?: boolean;
  max_steps?: number;
  action_keys?: string[];
  stop_on_error?: boolean;
  story_agent_base_url?: string;
  timeout_ms?: number;
  include_readiness_fallback?: boolean;
}

export interface RunProductionReadinessAutomationResult {
  schema_version: 'mcp-production-readiness-automation-bridge/v1';
  scope: ProductionReadinessScope;
  project_id: string;
  dry_run: boolean;
  story_agent_base_url?: string;
  endpoint?: string;
  transport_status: TransportStatus;
  http_status?: number;
  ok: boolean;
  run_result?: unknown;
  api_response?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  readiness_fallback?: ProductionReadinessReport | null;
  notes: string[];
}

function assertSafeId(id: string, label: string): void {
  if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
    throw new Error(`非法${label}：${id}`);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeBaseUrl(input?: string): string | null {
  const raw = input?.trim()
    || process.env.STORY_AGENT_BASE_URL?.trim()
    || process.env.CHINA_CULTURE_STORY_AGENT_BASE_URL?.trim()
    || '';
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function selectedTarget(input: RunProductionReadinessAutomationInput): {
  scope: ProductionReadinessScope;
  id: string;
  endpointPath: string;
} {
  const projectId = input.project_id?.trim();
  const seriesProjectId = input.series_project_id?.trim();
  if (projectId && seriesProjectId) {
    throw new Error('project_id 与 series_project_id 只能提供一个');
  }
  if (projectId) {
    assertSafeId(projectId, '项目 ID');
    return {
      scope: 'story_project',
      id: projectId,
      endpointPath: `/api/projects/${encodeURIComponent(projectId)}/production-readiness/run-automation`,
    };
  }
  if (seriesProjectId) {
    assertSafeId(seriesProjectId, '系列项目 ID');
    return {
      scope: 'ai_comic_series',
      id: seriesProjectId,
      endpointPath: `/api/story-outline/ai-comic-series-projects/${encodeURIComponent(seriesProjectId)}/production-readiness/run-automation`,
    };
  }
  throw new Error('必须提供 project_id 或 series_project_id');
}

async function localReadinessFallback(
  input: RunProductionReadinessAutomationInput,
): Promise<ProductionReadinessReport | null | undefined> {
  if (input.include_readiness_fallback === false) return undefined;
  try {
    return await getProductionReadiness({
      project_id: input.project_id,
      series_project_id: input.series_project_id,
      include_markdown: false,
    });
  } catch {
    return null;
  }
}

function errorFromApiBody(body: unknown, fallbackMessage: string): RunProductionReadinessAutomationResult['error'] {
  if (isRecord(body) && isRecord(body.error)) {
    return {
      code: asString(body.error.code, 'STORY_AGENT_API_ERROR'),
      message: asString(body.error.message, fallbackMessage),
      details: body.error.details,
    };
  }
  return {
    code: 'STORY_AGENT_API_ERROR',
    message: fallbackMessage,
    details: body,
  };
}

export async function runProductionReadinessAutomation(
  input: RunProductionReadinessAutomationInput,
): Promise<RunProductionReadinessAutomationResult> {
  const target = selectedTarget(input);
  const dryRun = input.dry_run ?? true;
  const timeoutMs = Math.max(1000, Math.min(input.timeout_ms ?? 30000, 120000));
  const baseUrl = normalizeBaseUrl(input.story_agent_base_url);

  if (!baseUrl) {
    return {
      schema_version: 'mcp-production-readiness-automation-bridge/v1',
      scope: target.scope,
      project_id: target.id,
      dry_run: dryRun,
      transport_status: input.story_agent_base_url?.trim()
        ? 'invalid_story_agent_base_url'
        : 'missing_story_agent_base_url',
      ok: false,
      error: {
        code: 'STORY_AGENT_BASE_URL_REQUIRED',
        message: '需要配置 STORY_AGENT_BASE_URL 或传入 story_agent_base_url，才能从 MCP 触发 Web 侧安全自动化 runner。',
      },
      readiness_fallback: await localReadinessFallback(input),
      notes: [
        'MCP 不直接写项目文件；自动化执行统一委托给 Story Agent Web/API runner。',
        '真实图片、视频和后期实产仍必须由 GEARS v2 worker 执行。',
      ],
    };
  }

  const endpoint = `${baseUrl}${target.endpointPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const requestBody = {
    dry_run: dryRun,
    max_steps: input.max_steps ?? 6,
    action_keys: input.action_keys,
    stop_on_error: input.stop_on_error ?? true,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const text = await response.text();
    const apiBody = text ? JSON.parse(text) as unknown : null;
    const apiOk = response.ok && (!isRecord(apiBody) || apiBody.ok !== false);
    const runResult = isRecord(apiBody) && 'data' in apiBody ? apiBody.data : apiBody;

    return {
      schema_version: 'mcp-production-readiness-automation-bridge/v1',
      scope: target.scope,
      project_id: target.id,
      dry_run: dryRun,
      story_agent_base_url: baseUrl,
      endpoint: target.endpointPath,
      transport_status: 'sent',
      http_status: response.status,
      ok: apiOk,
      run_result: runResult,
      api_response: apiBody,
      error: apiOk ? undefined : errorFromApiBody(apiBody, `Story Agent API returned HTTP ${response.status}`),
      notes: [
        dryRun
          ? '本次为 dry_run，只验证 Web/API runner 会执行或跳过哪些安全步骤。'
          : '本次允许 Web/API runner 执行 can_auto_execute=true 的 Story Agent 指挥层步骤。',
        'MCP bridge 不会执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。',
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      schema_version: 'mcp-production-readiness-automation-bridge/v1',
      scope: target.scope,
      project_id: target.id,
      dry_run: dryRun,
      story_agent_base_url: baseUrl,
      endpoint: target.endpointPath,
      transport_status: 'request_failed',
      ok: false,
      error: {
        code: 'STORY_AGENT_API_REQUEST_FAILED',
        message,
      },
      readiness_fallback: await localReadinessFallback(input),
      notes: [
        '请求 Story Agent Web/API runner 失败，已保留本地 readiness fallback 供诊断。',
        '真实图片、视频和后期实产仍必须由 GEARS v2 worker 执行。',
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}
