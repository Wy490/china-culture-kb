import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { runProductionReadinessAutomation } from '../src/tools/run-production-readiness-automation.js';
import { runProductionReadinessPortfolioAutomationBridge } from '../src/tools/run-production-readiness-portfolio-automation.js';

let activeServer: Server | undefined;

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => { body += String(chunk); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        resolve(body);
      }
    });
  });
}

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
): Promise<string> {
  activeServer = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>(resolve => {
    activeServer!.listen(0, '127.0.0.1', resolve);
  });
  const address = activeServer.address();
  if (!address || typeof address === 'string') throw new Error('failed to allocate test server port');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  if (!activeServer) return;
  await new Promise<void>(resolve => activeServer!.close(() => resolve()));
  activeServer = undefined;
});

describe('kb_run_production_readiness_automation bridge', () => {
  it('posts single-story automation runs to the Story Agent API endpoint', async () => {
    let capturedPath = '';
    let capturedBody: unknown = null;
    const baseUrl = await startServer(async (req, res) => {
      capturedPath = req.url ?? '';
      capturedBody = await readJson(req);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        data: {
          schema_version: 'production-readiness-automation-run/v1',
          scope: 'story_project',
          project_id: 'story-project-1',
          dry_run: false,
          executed_count: 1,
          planned_count: 0,
          skipped_count: 0,
          failed_count: 0,
          steps: [{ action_key: 'export_production_board', status: 'executed' }],
        },
        error: null,
      }));
    });

    const result = await runProductionReadinessAutomation({
      project_id: 'story-project-1',
      story_agent_base_url: baseUrl,
      dry_run: false,
      max_steps: 2,
      action_keys: ['export_production_board'],
    });

    expect(capturedPath).toBe('/api/projects/story-project-1/production-readiness/run-automation');
    expect(capturedBody).toEqual({
      dry_run: false,
      max_steps: 2,
      action_keys: ['export_production_board'],
      stop_on_error: true,
    });
    expect(result.schema_version).toBe('mcp-production-readiness-automation-bridge/v1');
    expect(result.scope).toBe('story_project');
    expect(result.transport_status).toBe('sent');
    expect(result.ok).toBe(true);
    expect(result.run_result).toMatchObject({
      schema_version: 'production-readiness-automation-run/v1',
      executed_count: 1,
    });
  });

  it('posts AI comic series automation runs to the series endpoint with dry-run defaults', async () => {
    let capturedPath = '';
    let capturedBody: unknown = null;
    const baseUrl = await startServer(async (req, res) => {
      capturedPath = req.url ?? '';
      capturedBody = await readJson(req);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        data: {
          schema_version: 'production-readiness-automation-run/v1',
          scope: 'ai_comic_series',
          project_id: 'series-project-1',
          dry_run: true,
          executed_count: 0,
          planned_count: 1,
          skipped_count: 0,
          failed_count: 0,
          steps: [{ action_key: 'generate_next_episode', status: 'planned' }],
        },
        error: null,
      }));
    });

    const result = await runProductionReadinessAutomation({
      series_project_id: 'series-project-1',
      story_agent_base_url: baseUrl,
      action_keys: ['generate_next_episode'],
    });

    expect(capturedPath).toBe('/api/story-outline/ai-comic-series-projects/series-project-1/production-readiness/run-automation');
    expect(capturedBody).toEqual({
      dry_run: true,
      max_steps: 6,
      action_keys: ['generate_next_episode'],
      stop_on_error: true,
    });
    expect(result.scope).toBe('ai_comic_series');
    expect(result.dry_run).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.run_result).toMatchObject({
      scope: 'ai_comic_series',
      planned_count: 1,
    });
  });

  it('returns a blocked diagnostic result when no Story Agent base URL is configured', async () => {
    const previous = process.env.STORY_AGENT_BASE_URL;
    delete process.env.STORY_AGENT_BASE_URL;
    try {
      const result = await runProductionReadinessAutomation({
        project_id: 'story-project-1',
        include_readiness_fallback: false,
      });

      expect(result.ok).toBe(false);
      expect(result.transport_status).toBe('missing_story_agent_base_url');
      expect(result.error?.code).toBe('STORY_AGENT_BASE_URL_REQUIRED');
      expect(result.dry_run).toBe(true);
      expect(result.notes.join('\n')).toContain('GEARS v2 worker');
    } finally {
      if (previous === undefined) delete process.env.STORY_AGENT_BASE_URL;
      else process.env.STORY_AGENT_BASE_URL = previous;
    }
  });
});

describe('kb_run_production_readiness_portfolio_automation bridge', () => {
  it('posts portfolio automation runs to the Story Agent API endpoint', async () => {
    let capturedPath = '';
    let capturedBody: unknown = null;
    const baseUrl = await startServer(async (req, res) => {
      capturedPath = req.url ?? '';
      capturedBody = await readJson(req);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        data: {
          schema_version: 'production-readiness-portfolio-run/v1',
          dry_run: false,
          selected_target_count: 2,
          executed_target_count: 1,
          planned_target_count: 0,
          skipped_target_count: 1,
          failed_target_count: 0,
          targets: [],
        },
        error: null,
      }));
    });

    const result = await runProductionReadinessPortfolioAutomationBridge({
      story_agent_base_url: baseUrl,
      dry_run: false,
      max_targets: 2,
      per_target_max_steps: 3,
      scopes: ['story_project'],
      stop_on_error: false,
    });

    expect(capturedPath).toBe('/api/system/production-readiness-portfolio/run-automation');
    expect(capturedBody).toEqual({
      dry_run: false,
      include_archived_series: false,
      max_targets: 2,
      per_target_max_steps: 3,
      scopes: ['story_project'],
      stop_on_error: false,
    });
    expect(result.schema_version).toBe('mcp-production-readiness-portfolio-automation-bridge/v1');
    expect(result.transport_status).toBe('sent');
    expect(result.ok).toBe(true);
    expect(result.run_result).toMatchObject({
      schema_version: 'production-readiness-portfolio-run/v1',
      selected_target_count: 2,
    });
  });

  it('returns a blocked diagnostic result when portfolio bridge has no Story Agent base URL', async () => {
    const previous = process.env.STORY_AGENT_BASE_URL;
    delete process.env.STORY_AGENT_BASE_URL;
    try {
      const result = await runProductionReadinessPortfolioAutomationBridge({
        include_portfolio_fallback: false,
      });

      expect(result.ok).toBe(false);
      expect(result.transport_status).toBe('missing_story_agent_base_url');
      expect(result.error?.code).toBe('STORY_AGENT_BASE_URL_REQUIRED');
      expect(result.notes.join('\n')).toContain('GEARS v2 worker');
    } finally {
      if (previous === undefined) delete process.env.STORY_AGENT_BASE_URL;
      else process.env.STORY_AGENT_BASE_URL = previous;
    }
  });
});
