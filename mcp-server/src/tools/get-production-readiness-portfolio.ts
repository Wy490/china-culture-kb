import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import { getProductionReadiness, type ProductionReadinessReport } from './get-production-readiness.js';

type ProductionReadinessScope = 'story_project' | 'ai_comic_series';

interface PortfolioItem {
  scope: ProductionReadinessScope;
  project_id: string;
  title: string;
  status: string;
  score: number;
  priority_score: number;
  blocker_count: number;
  warning_count: number;
  next_action_count: number;
  ready_automation_step_count: number;
  external_automation_step_count: number;
  manual_automation_step_count: number;
  seedance_placeholder_asset_count: number;
  seedance_production_asset_ready_count: number;
  primary_action_key?: string;
  primary_action_label?: string;
  latest_automation_run_id?: string;
}

interface ActionBucket {
  action_key: string;
  label: string;
  count: number;
  blocked_count: number;
  scopes: ProductionReadinessScope[];
}

interface PortfolioAutomationLedgerTarget {
  scope: ProductionReadinessScope;
  project_id: string;
  title: string;
  priority_score: number;
  status: string;
  executed_step_count: number;
  planned_step_count: number;
  skipped_step_count: number;
  failed_step_count: number;
  error_message?: string;
}

interface PortfolioAutomationLedgerItem {
  run_id: string;
  dry_run: boolean;
  started_at: string;
  completed_at: string;
  selected_target_count: number;
  executed_target_count: number;
  planned_target_count: number;
  skipped_target_count: number;
  failed_target_count: number;
  targets: PortfolioAutomationLedgerTarget[];
  notes: string[];
}

interface PortfolioAutomationLedger {
  schema_version: 'production-readiness-portfolio-run-ledger/v1';
  updated_at: string;
  total_run_count: number;
  persisted_run_count: number;
  latest_run?: PortfolioAutomationLedgerItem;
  items: PortfolioAutomationLedgerItem[];
}

export interface GetProductionReadinessPortfolioInput {
  limit?: number;
  include_markdown?: boolean;
}

export interface ProductionReadinessPortfolioReport {
  schema_version: 'mcp-production-readiness-portfolio/v1';
  generated_at: string;
  summary: {
    total_target_count: number;
    story_project_count: number;
    ai_comic_series_count: number;
    ready_count: number;
    needs_action_count: number;
    blocked_count: number;
    blocker_count: number;
    warning_count: number;
    ready_automation_step_count: number;
    external_automation_step_count: number;
    manual_automation_step_count: number;
    seedance_placeholder_asset_count: number;
    seedance_production_asset_ready_count: number;
    latest_automation_run_count: number;
    portfolio_automation_run_count: number;
  };
  items: PortfolioItem[];
  action_buckets: ActionBucket[];
  portfolio_automation_ledger?: PortfolioAutomationLedger;
  latest_portfolio_automation_run?: PortfolioAutomationLedgerItem;
  errors: Array<{
    scope: ProductionReadinessScope;
    project_id: string;
    message: string;
  }>;
  notes: string[];
  markdown?: string;
}

function generatedRoot(): string {
  return path.resolve(getKbRoot(), '..', 'web', 'generated');
}

async function readPortfolioAutomationLedger(): Promise<PortfolioAutomationLedger | undefined> {
  try {
    const filePath = path.resolve(generatedRoot(), 'system', 'production-readiness-portfolio-automation-ledger.json');
    const ledger = JSON.parse(await fs.readFile(filePath, 'utf-8')) as PortfolioAutomationLedger;
    if (ledger.schema_version !== 'production-readiness-portfolio-run-ledger/v1') return undefined;
    const items = Array.isArray(ledger.items) ? ledger.items : [];
    return {
      ...ledger,
      items,
      persisted_run_count: items.length,
      latest_run: ledger.latest_run ?? items[0],
    };
  } catch {
    return undefined;
  }
}

async function listProjectIds(folder: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.resolve(generatedRoot(), folder), { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function boundedLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 30;
  return Math.max(1, Math.min(Math.floor(limit ?? 30), 100));
}

function priorityScore(report: ProductionReadinessReport): number {
  return Math.round(
    report.summary.blocker_count * 45
    + report.summary.warning_count * 10
    + Math.max(0, 100 - report.summary.score)
    + (report.automation_plan.ready_step_count > 0 ? 16 : 0)
    + report.automation_plan.manual_step_count * 5
    + (report.summary.status === 'blocked' ? 18 : report.summary.status === 'needs_action' ? 10 : 0),
  );
}

function toItem(report: ProductionReadinessReport): PortfolioItem {
  const primaryAction = report.next_actions[0];
  return {
    scope: report.scope,
    project_id: report.project_id,
    title: report.title,
    status: report.summary.status,
    score: report.summary.score,
    priority_score: priorityScore(report),
    blocker_count: report.summary.blocker_count,
    warning_count: report.summary.warning_count,
    next_action_count: report.summary.next_action_count,
    ready_automation_step_count: report.automation_plan.ready_step_count,
    external_automation_step_count: report.automation_plan.steps.filter(step => step.runner === 'gears_worker').length,
    manual_automation_step_count: report.automation_plan.manual_step_count,
    seedance_placeholder_asset_count: report.summary.seedance_placeholder_asset_count,
    seedance_production_asset_ready_count: report.summary.seedance_production_asset_ready_count,
    primary_action_key: primaryAction?.action_key,
    primary_action_label: primaryAction?.label,
    latest_automation_run_id: report.latest_automation_run?.run_id,
  };
}

function buildActionBuckets(reports: ProductionReadinessReport[]): ActionBucket[] {
  const buckets = new Map<string, ActionBucket>();
  for (const report of reports) {
    const seen = new Set<string>();
    for (const action of report.next_actions) {
      if (seen.has(action.action_key)) continue;
      seen.add(action.action_key);
      const bucket = buckets.get(action.action_key) ?? {
        action_key: action.action_key,
        label: action.label,
        count: 0,
        blocked_count: 0,
        scopes: [],
      };
      bucket.count += 1;
      if (report.summary.status === 'blocked') bucket.blocked_count += 1;
      if (!bucket.scopes.includes(report.scope)) bucket.scopes.push(report.scope);
      buckets.set(action.action_key, bucket);
    }
  }
  return [...buckets.values()].sort((a, b) => {
    if (a.blocked_count !== b.blocked_count) return b.blocked_count - a.blocked_count;
    if (a.count !== b.count) return b.count - a.count;
    return a.action_key.localeCompare(b.action_key);
  });
}

function buildMarkdown(report: Omit<ProductionReadinessPortfolioReport, 'markdown'>): string {
  return [
    '# MCP Production Readiness Portfolio',
    '',
    `> generatedAt: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- total targets: ${report.summary.total_target_count}`,
    `- blocked: ${report.summary.blocked_count}`,
    `- needs action: ${report.summary.needs_action_count}`,
    `- ready automation steps: ${report.summary.ready_automation_step_count}`,
    `- Seedance placeholder assets: ${report.summary.seedance_placeholder_asset_count}`,
    `- Seedance production assets ready: ${report.summary.seedance_production_asset_ready_count}`,
    `- portfolio automation runs: ${report.summary.portfolio_automation_run_count}`,
    ...(report.latest_portfolio_automation_run
      ? [`- latest portfolio run: ${report.latest_portfolio_automation_run.completed_at} · executed ${report.latest_portfolio_automation_run.executed_target_count} · failed ${report.latest_portfolio_automation_run.failed_target_count}`]
      : []),
    '',
    '## Priority Queue',
    '',
    ...(report.items.length
      ? report.items.map(item =>
        `- P${item.priority_score} · ${item.scope} · ${item.status} · ${item.score}/100 · ${item.title} · ${item.primary_action_label ?? 'no action'}`,
      )
      : ['- none']),
    '',
    '## Action Buckets',
    '',
    ...(report.action_buckets.length
      ? report.action_buckets.map(bucket => `- ${bucket.action_key} · ${bucket.count} targets · blocked ${bucket.blocked_count}`)
      : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n');
}

export async function getProductionReadinessPortfolio(
  input: GetProductionReadinessPortfolioInput = {},
): Promise<ProductionReadinessPortfolioReport> {
  const limit = boundedLimit(input.limit);
  const reports: ProductionReadinessReport[] = [];
  const errors: ProductionReadinessPortfolioReport['errors'] = [];
  const [projectIds, seriesProjectIds] = await Promise.all([
    listProjectIds('projects'),
    listProjectIds('ai-comic-series-projects'),
  ]);
  const portfolioAutomationLedger = await readPortfolioAutomationLedger();

  for (const projectId of projectIds) {
    try {
      const report = await getProductionReadiness({ project_id: projectId, include_markdown: false });
      if (report) reports.push(report);
    } catch (err) {
      errors.push({
        scope: 'story_project',
        project_id: projectId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const seriesProjectId of seriesProjectIds) {
    try {
      const report = await getProductionReadiness({ series_project_id: seriesProjectId, include_markdown: false });
      if (report) reports.push(report);
    } catch (err) {
      errors.push({
        scope: 'ai_comic_series',
        project_id: seriesProjectId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const allItems = reports
    .map(toItem)
    .sort((a, b) => b.priority_score - a.priority_score || a.title.localeCompare(b.title, 'zh-CN'));
  const items = allItems.slice(0, limit);
  const base: Omit<ProductionReadinessPortfolioReport, 'markdown'> = {
    schema_version: 'mcp-production-readiness-portfolio/v1',
    generated_at: new Date().toISOString(),
    summary: {
      total_target_count: reports.length,
      story_project_count: reports.filter(report => report.scope === 'story_project').length,
      ai_comic_series_count: reports.filter(report => report.scope === 'ai_comic_series').length,
      ready_count: reports.filter(report => report.summary.status === 'ready').length,
      needs_action_count: reports.filter(report => report.summary.status === 'needs_action').length,
      blocked_count: reports.filter(report => report.summary.status === 'blocked').length,
      blocker_count: reports.reduce((sum, report) => sum + report.summary.blocker_count, 0),
      warning_count: reports.reduce((sum, report) => sum + report.summary.warning_count, 0),
      ready_automation_step_count: reports.reduce((sum, report) => sum + report.automation_plan.ready_step_count, 0),
      external_automation_step_count: reports.reduce((sum, report) => (
        sum + report.automation_plan.steps.filter(step => step.runner === 'gears_worker').length
      ), 0),
      manual_automation_step_count: reports.reduce((sum, report) => sum + report.automation_plan.manual_step_count, 0),
      seedance_placeholder_asset_count: reports.reduce((sum, report) => sum + report.summary.seedance_placeholder_asset_count, 0),
      seedance_production_asset_ready_count: reports.reduce((sum, report) => sum + report.summary.seedance_production_asset_ready_count, 0),
      latest_automation_run_count: reports.filter(report => Boolean(report.latest_automation_run)).length,
      portfolio_automation_run_count: portfolioAutomationLedger?.total_run_count ?? 0,
    },
    items,
    action_buckets: buildActionBuckets(reports),
    portfolio_automation_ledger: portfolioAutomationLedger,
    latest_portfolio_automation_run: portfolioAutomationLedger?.latest_run,
    errors,
    notes: [
      'MCP portfolio is read-only and built from local web/generated project files.',
      'Use kb_run_production_readiness_automation for safe Story Agent API automation; GEARS worker execution stays external.',
      portfolioAutomationLedger?.latest_run
        ? `Latest portfolio automation run completed at ${portfolioAutomationLedger.latest_run.completed_at}.`
        : 'No persisted portfolio automation run yet; dry-run does not write this ledger.',
      `Returned top ${items.length} of ${allItems.length} targets by priority.`,
    ],
  };
  return input.include_markdown === false ? base : { ...base, markdown: buildMarkdown(base) };
}
