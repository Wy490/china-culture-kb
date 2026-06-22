import { getProductionReadinessPortfolio, type ProductionReadinessPortfolioReport } from './get-production-readiness-portfolio.js';

type PortfolioTransportStatus = 'sent' | 'missing_story_agent_base_url' | 'invalid_story_agent_base_url' | 'request_failed';

type JsonRecord = Record<string, unknown>;

export interface RunProductionReadinessPortfolioAutomationInput {
  dry_run?: boolean;
  include_archived_series?: boolean;
  max_targets?: number;
  per_target_max_steps?: number;
  min_priority_score?: number;
  scopes?: Array<'story_project' | 'ai_comic_series'>;
  project_ids?: string[];
  action_keys?: string[];
  stop_on_error?: boolean;
  story_agent_base_url?: string;
  timeout_ms?: number;
  include_portfolio_fallback?: boolean;
}

export interface RunProductionReadinessPortfolioAutomationResult {
  schema_version: 'mcp-production-readiness-portfolio-automation-bridge/v1';
  dry_run: boolean;
  story_agent_base_url?: string;
  endpoint?: string;
  transport_status: PortfolioTransportStatus;
  http_status?: number;
  ok: boolean;
  run_result?: unknown;
  api_response?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  portfolio_fallback?: ProductionReadinessPortfolioReport | null;
  notes: string[];
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

async function localPortfolioFallback(
  input: RunProductionReadinessPortfolioAutomationInput,
): Promise<ProductionReadinessPortfolioReport | null | undefined> {
  if (input.include_portfolio_fallback === false) return undefined;
  try {
    return await getProductionReadinessPortfolio({ limit: input.max_targets, include_markdown: false });
  } catch {
    return null;
  }
}

function errorFromApiBody(body: unknown, fallbackMessage: string): RunProductionReadinessPortfolioAutomationResult['error'] {
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

export async function runProductionReadinessPortfolioAutomationBridge(
  input: RunProductionReadinessPortfolioAutomationInput,
): Promise<RunProductionReadinessPortfolioAutomationResult> {
  const dryRun = input.dry_run ?? true;
  const timeoutMs = Math.max(1000, Math.min(input.timeout_ms ?? 30000, 120000));
  const baseUrl = normalizeBaseUrl(input.story_agent_base_url);

  if (!baseUrl) {
    return {
      schema_version: 'mcp-production-readiness-portfolio-automation-bridge/v1',
      dry_run: dryRun,
      transport_status: input.story_agent_base_url?.trim()
        ? 'invalid_story_agent_base_url'
        : 'missing_story_agent_base_url',
      ok: false,
      error: {
        code: 'STORY_AGENT_BASE_URL_REQUIRED',
        message: '需要配置 STORY_AGENT_BASE_URL 或传入 story_agent_base_url，才能从 MCP 触发 Web 侧 portfolio 安全自动化 runner。',
      },
      portfolio_fallback: await localPortfolioFallback(input),
      notes: [
        'MCP 不直接批量写项目文件；portfolio 自动化执行统一委托给 Story Agent Web/API runner。',
        '真实图片、视频和后期实产仍必须由 GEARS v2 worker 执行。',
      ],
    };
  }

  const endpoint = '/api/system/production-readiness-portfolio/run-automation';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const requestBody = {
    dry_run: dryRun,
    include_archived_series: input.include_archived_series ?? false,
    max_targets: input.max_targets ?? 5,
    per_target_max_steps: input.per_target_max_steps ?? 4,
    min_priority_score: input.min_priority_score,
    scopes: input.scopes,
    project_ids: input.project_ids,
    action_keys: input.action_keys,
    stop_on_error: input.stop_on_error ?? true,
  };

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
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
      schema_version: 'mcp-production-readiness-portfolio-automation-bridge/v1',
      dry_run: dryRun,
      story_agent_base_url: baseUrl,
      endpoint,
      transport_status: 'sent',
      http_status: response.status,
      ok: apiOk,
      run_result: runResult,
      api_response: apiBody,
      error: apiOk ? undefined : errorFromApiBody(apiBody, `Story Agent API returned HTTP ${response.status}`),
      notes: [
        dryRun
          ? '本次为 dry_run，只验证 portfolio runner 会批量执行或跳过哪些安全步骤。'
          : '本次允许 Web/API portfolio runner 执行 can_auto_execute=true 的 Story Agent 指挥层步骤。',
        'MCP bridge 不会执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。',
      ],
    };
  } catch (err) {
    return {
      schema_version: 'mcp-production-readiness-portfolio-automation-bridge/v1',
      dry_run: dryRun,
      story_agent_base_url: baseUrl,
      endpoint,
      transport_status: 'request_failed',
      ok: false,
      error: {
        code: 'STORY_AGENT_API_REQUEST_FAILED',
        message: err instanceof Error ? err.message : String(err),
      },
      portfolio_fallback: await localPortfolioFallback(input),
      notes: [
        '请求 Story Agent Web/API portfolio runner 失败，已保留本地 portfolio fallback 供诊断。',
        '真实图片、视频和后期实产仍必须由 GEARS v2 worker 执行。',
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}
