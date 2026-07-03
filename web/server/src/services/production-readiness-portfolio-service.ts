import type {
  AiComicSeriesProductionReadinessReport,
  ProductionReadinessPortfolioActionBucket,
  ProductionReadinessPortfolioItem,
  ProductionReadinessPortfolioReport,
  ProductionReadinessPortfolioRunLedger,
  ProductionReadinessPortfolioRunLedgerTarget,
  ProductionReadinessPortfolioRunRequest,
  ProductionReadinessPortfolioRunResult,
  ProductionReadinessPortfolioRunTargetResult,
  ProductionReadinessScope,
  ProductionReadinessStatus,
  StoryProjectProductionReadinessReport,
} from '@shared/types.js';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import {
  getProjectProductionReadiness,
  listProjects,
  runProjectProductionReadinessAutomation,
} from './project-service.js';
import {
  getAiComicSeriesProductionReadiness,
  listAiComicSeriesProjects,
  runAiComicSeriesProductionReadinessAutomation,
} from './ai-comic-series-service.js';

export interface ProductionReadinessPortfolioOptions {
  includeArchivedSeries?: boolean;
  limit?: number;
}

type ReadinessReport = StoryProjectProductionReadinessReport | AiComicSeriesProductionReadinessReport;

const portfolioAutomationLedgerLimit = 20;

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || resolve(kbRoot(), '..', 'web', 'generated');
}

function portfolioAutomationLedgerPath(): string {
  return resolve(generatedRoot(), 'system', 'production-readiness-portfolio-automation-ledger.json');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf-8')) as T;
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function readPortfolioAutomationLedger(): Promise<ProductionReadinessPortfolioRunLedger | undefined> {
  const filePath = portfolioAutomationLedgerPath();
  if (!(await pathExists(filePath))) return undefined;
  const ledger = await readJsonFile<ProductionReadinessPortfolioRunLedger>(filePath);
  if (ledger.schema_version !== 'production-readiness-portfolio-run-ledger/v1') return undefined;
  const items = Array.isArray(ledger.items) ? ledger.items : [];
  return {
    ...ledger,
    items,
    persisted_run_count: items.length,
    latest_run: ledger.latest_run ?? items[0],
  };
}

function boundedLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 30;
  return Math.max(1, Math.min(Math.floor(limit ?? 30), 100));
}

function statusRank(status: ProductionReadinessStatus): number {
  if (status === 'blocked') return 3;
  if (status === 'needs_action') return 2;
  return 1;
}

function reportUpdatedAt(report: ReadinessReport): string | undefined {
  return report.scope === 'story_project'
    ? report.project.updated_at
    : report.project.updated_at;
}

function reportTitle(report: ReadinessReport): string {
  return report.scope === 'story_project' ? report.title : report.series_title;
}

function portfolioPriority(report: ReadinessReport): number {
  const blockerWeight = report.summary.blocker_count * 45;
  const warningWeight = report.summary.warning_count * 10;
  const scoreDebt = Math.max(0, 100 - report.summary.score);
  const autoReadyWeight = report.automation_plan.ready_step_count > 0 ? 16 : 0;
  const externalWeight = report.automation_plan.external_step_count > 0 ? 8 : 0;
  const manualWeight = report.automation_plan.manual_step_count > 0 ? 5 : 0;
  return Math.round(
    blockerWeight
    + warningWeight
    + scoreDebt
    + autoReadyWeight
    + externalWeight
    + manualWeight
    + statusRank(report.summary.status) * 6,
  );
}

function portfolioItem(report: ReadinessReport): ProductionReadinessPortfolioItem {
  const primaryAction = report.next_actions[0];
  const primaryIssue = report.issues.find(issue => issue.severity === 'blocking') ?? report.issues[0];
  return {
    scope: report.scope,
    project_id: report.scope === 'story_project'
      ? report.project.project_id
      : report.project.series_project_id,
    title: reportTitle(report),
    updated_at: reportUpdatedAt(report),
    status: report.summary.status,
    score: report.summary.score,
    priority_score: portfolioPriority(report),
    blocker_count: report.summary.blocker_count,
    warning_count: report.summary.warning_count,
    next_action_count: report.summary.next_action_count,
    gears_job_count: report.summary.gears_job_count,
    active_gears_job_count: report.summary.active_gears_job_count,
    external_ready_gears_job_count: report.summary.external_ready_gears_job_count,
    local_acceptance_ready_gears_job_count: report.summary.local_acceptance_ready_gears_job_count,
    ready_without_external_gears_artifact_count: report.summary.ready_without_external_gears_artifact_count,
    ready_automation_step_count: report.automation_plan.ready_step_count,
    blocked_automation_step_count: report.automation_plan.blocked_step_count,
    manual_automation_step_count: report.automation_plan.manual_step_count,
    external_automation_step_count: report.automation_plan.external_step_count,
    primary_action_key: primaryAction?.action_key,
    primary_action_label: primaryAction?.label,
    primary_issue_label: primaryIssue?.label,
    latest_automation_run: report.latest_automation_run,
  };
}

function actionBuckets(reports: ReadinessReport[]): ProductionReadinessPortfolioActionBucket[] {
  const buckets = new Map<string, ProductionReadinessPortfolioActionBucket>();
  for (const report of reports) {
    const seenInReport = new Set<string>();
    for (const action of report.next_actions) {
      const existing = buckets.get(action.action_key) ?? {
        action_key: action.action_key,
        label: action.label,
        count: 0,
        blocked_count: 0,
        scopes: [],
      };
      if (!seenInReport.has(action.action_key)) {
        existing.count += 1;
        if (report.summary.status === 'blocked') existing.blocked_count += 1;
        if (!existing.scopes.includes(report.scope)) existing.scopes.push(report.scope);
        seenInReport.add(action.action_key);
      }
      buckets.set(action.action_key, existing);
    }
  }
  return [...buckets.values()].sort((a, b) => {
    if (a.blocked_count !== b.blocked_count) return b.blocked_count - a.blocked_count;
    if (a.count !== b.count) return b.count - a.count;
    return a.action_key.localeCompare(b.action_key);
  });
}

function buildMarkdown(report: Omit<ProductionReadinessPortfolioReport, 'markdown'>): string {
  const latestRun = report.latest_portfolio_automation_run;
  return [
    '# Production Readiness Portfolio',
    '',
    `> generatedAt: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- total targets: ${report.summary.total_target_count}`,
    `- blocked: ${report.summary.blocked_count}`,
    `- needs action: ${report.summary.needs_action_count}`,
    `- ready: ${report.summary.ready_count}`,
    `- ready automation steps: ${report.summary.ready_automation_step_count}`,
    `- external GEARS/operator steps: ${report.summary.external_automation_step_count + report.summary.manual_automation_step_count}`,
    `- GEARS jobs: ${report.summary.gears_job_count} · active ${report.summary.active_gears_job_count}`,
    `- GEARS external ready: ${report.summary.external_ready_gears_job_count}`,
    `- GEARS local acceptance ready: ${report.summary.local_acceptance_ready_gears_job_count}`,
    `- GEARS ready without external artifact: ${report.summary.ready_without_external_gears_artifact_count}`,
    `- portfolio automation runs: ${report.summary.portfolio_automation_run_count}`,
    ...(latestRun
      ? [`- latest portfolio run: ${latestRun.completed_at} · executed ${latestRun.executed_target_count} · failed ${latestRun.failed_target_count}`]
      : []),
    '',
    '## Priority Queue',
    '',
    ...(report.items.length
      ? report.items.slice(0, 20).map(item =>
        `- P${item.priority_score} · ${item.scope} · ${item.status} · ${item.score}/100 · ${item.title} · ${item.primary_action_label ?? 'no action'}`,
      )
      : ['- none']),
    '',
    '## Action Buckets',
    '',
    ...(report.action_buckets.length
      ? report.action_buckets.map(bucket =>
        `- ${bucket.action_key} · ${bucket.count} targets · blocked ${bucket.blocked_count}`,
      )
      : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n');
}

export async function getProductionReadinessPortfolio(
  options: ProductionReadinessPortfolioOptions = {},
): Promise<ProductionReadinessPortfolioReport> {
  const generatedAt = new Date().toISOString();
  const limit = boundedLimit(options.limit);
  const reports: ReadinessReport[] = [];
  const errors: ProductionReadinessPortfolioReport['errors'] = [];

  const [storyListRes, seriesListRes] = await Promise.all([
    listProjects(),
    listAiComicSeriesProjects({ includeArchived: options.includeArchivedSeries }),
  ]);

  for (const project of storyListRes.data ?? []) {
    const readiness = await getProjectProductionReadiness(project.project_id);
    if (readiness.ok && readiness.data) {
      reports.push(readiness.data);
    } else {
      errors.push({
        scope: 'story_project',
        project_id: project.project_id,
        message: readiness.error?.message ?? 'Failed to read story project readiness',
      });
    }
  }

  for (const project of seriesListRes.data ?? []) {
    const readiness = await getAiComicSeriesProductionReadiness(project.series_project_id);
    if (readiness.ok && readiness.data) {
      reports.push(readiness.data);
    } else {
      errors.push({
        scope: 'ai_comic_series',
        project_id: project.series_project_id,
        message: readiness.error?.message ?? 'Failed to read AI comic series readiness',
      });
    }
  }

  const allItems = reports
    .map(portfolioItem)
    .sort((a, b) => {
      if (a.priority_score !== b.priority_score) return b.priority_score - a.priority_score;
      return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
    });
  const items = allItems.slice(0, limit);
  const summary = {
    total_target_count: reports.length,
    story_project_count: reports.filter(report => report.scope === 'story_project').length,
    ai_comic_series_count: reports.filter(report => report.scope === 'ai_comic_series').length,
    ready_count: reports.filter(report => report.summary.status === 'ready').length,
    needs_action_count: reports.filter(report => report.summary.status === 'needs_action').length,
    blocked_count: reports.filter(report => report.summary.status === 'blocked').length,
    blocker_count: reports.reduce((sum, report) => sum + report.summary.blocker_count, 0),
    warning_count: reports.reduce((sum, report) => sum + report.summary.warning_count, 0),
    ready_automation_step_count: reports.reduce((sum, report) => sum + report.automation_plan.ready_step_count, 0),
    external_automation_step_count: reports.reduce((sum, report) => sum + report.automation_plan.external_step_count, 0),
    manual_automation_step_count: reports.reduce((sum, report) => sum + report.automation_plan.manual_step_count, 0),
    gears_job_count: reports.reduce((sum, report) => sum + report.summary.gears_job_count, 0),
    active_gears_job_count: reports.reduce((sum, report) => sum + report.summary.active_gears_job_count, 0),
    external_ready_gears_job_count: reports.reduce((sum, report) => sum + report.summary.external_ready_gears_job_count, 0),
    local_acceptance_ready_gears_job_count: reports.reduce((sum, report) => sum + report.summary.local_acceptance_ready_gears_job_count, 0),
    ready_without_external_gears_artifact_count: reports.reduce((sum, report) => sum + report.summary.ready_without_external_gears_artifact_count, 0),
    latest_automation_run_count: reports.filter(report => Boolean(report.latest_automation_run)).length,
    portfolio_automation_run_count: 0,
  };
  const portfolioAutomationLedger = await readPortfolioAutomationLedger();
  summary.portfolio_automation_run_count = portfolioAutomationLedger?.total_run_count ?? 0;

  const base: Omit<ProductionReadinessPortfolioReport, 'markdown'> = {
    schema_version: 'production-readiness-portfolio/v1',
    generated_at: generatedAt,
    summary,
    items,
    action_buckets: actionBuckets(reports),
    portfolio_automation_ledger: portfolioAutomationLedger,
    latest_portfolio_automation_run: portfolioAutomationLedger?.latest_run,
    errors,
    notes: [
      'Portfolio is read-only and aggregates existing single-story and AI comic series readiness reports.',
      'Safe automation still runs through per-project run-automation endpoints; real media execution remains in GEARS v2.',
      portfolioAutomationLedger?.latest_run
        ? `Latest portfolio automation run completed at ${portfolioAutomationLedger.latest_run.completed_at}.`
        : 'No persisted portfolio automation run yet; dry-run does not write this ledger.',
      `Returned top ${items.length} of ${allItems.length} targets by production priority.`,
    ],
  };
  return {
    ...base,
    markdown: buildMarkdown(base),
  };
}

function selectedPortfolioTargets(
  portfolio: ProductionReadinessPortfolioReport,
  request: ProductionReadinessPortfolioRunRequest,
): ProductionReadinessPortfolioItem[] {
  const maxTargets = Math.max(1, Math.min(request.max_targets ?? 5, 20));
  const scopes = request.scopes?.length ? new Set(request.scopes) : undefined;
  const projectIds = request.project_ids?.length ? new Set(request.project_ids) : undefined;
  return portfolio.items
    .filter(item => !scopes || scopes.has(item.scope))
    .filter(item => !projectIds || projectIds.has(item.project_id))
    .filter(item => typeof request.min_priority_score !== 'number' || item.priority_score >= request.min_priority_score)
    .slice(0, maxTargets);
}

function targetStatusFromRun(
  dryRun: boolean,
  runResult: { executed_step_count: number; planned_step_count: number; skipped_step_count: number; failed_step_count: number },
): ProductionReadinessPortfolioRunTargetResult['status'] {
  if (runResult.failed_step_count > 0) return 'failed';
  if (dryRun) return runResult.planned_step_count > 0 ? 'planned' : 'skipped';
  if (runResult.executed_step_count > 0) return 'executed';
  if (runResult.planned_step_count > 0) return 'planned';
  return runResult.skipped_step_count > 0 ? 'skipped' : 'skipped';
}

function compactPortfolioRunTarget(
  target: ProductionReadinessPortfolioRunTargetResult,
): ProductionReadinessPortfolioRunLedgerTarget {
  return {
    scope: target.scope,
    project_id: target.project_id,
    title: target.title,
    priority_score: target.priority_score,
    status: target.status,
    executed_step_count: target.run_result?.executed_step_count ?? 0,
    planned_step_count: target.run_result?.planned_step_count ?? 0,
    skipped_step_count: target.run_result?.skipped_step_count ?? (target.status === 'skipped' ? 1 : 0),
    failed_step_count: target.run_result?.failed_step_count ?? (target.status === 'failed' ? 1 : 0),
    error_message: target.error_message,
  };
}

function uniqueStrings(values: Array<string | undefined>): string[] | undefined {
  const items = values.filter((value): value is string => Boolean(value));
  const unique = items.filter((value, index) => items.indexOf(value) === index);
  return unique.length ? unique : undefined;
}

function buildPortfolioAutomationRunLedger(
  existing: ProductionReadinessPortfolioRunLedger | undefined,
  run: ProductionReadinessPortfolioRunResult,
  request: ProductionReadinessPortfolioRunRequest,
): ProductionReadinessPortfolioRunLedger {
  const item = {
    run_id: `production-readiness-portfolio-run-${randomUUID()}`,
    dry_run: run.dry_run,
    started_at: run.started_at,
    completed_at: run.completed_at,
    requested_scope_count: run.requested_scope_count,
    requested_project_id_count: run.requested_project_id_count,
    requested_action_keys: uniqueStrings(request.action_keys ?? []),
    min_priority_score: request.min_priority_score,
    selected_target_count: run.selected_target_count,
    executed_target_count: run.executed_target_count,
    planned_target_count: run.planned_target_count,
    skipped_target_count: run.skipped_target_count,
    failed_target_count: run.failed_target_count,
    targets: run.targets.map(compactPortfolioRunTarget),
    notes: run.notes,
  };
  const previousItems = existing?.items ?? [];
  const items = [
    item,
    ...previousItems.filter(previous => previous.run_id !== item.run_id),
  ].slice(0, portfolioAutomationLedgerLimit);
  return {
    schema_version: 'production-readiness-portfolio-run-ledger/v1',
    updated_at: run.completed_at,
    total_run_count: (existing?.total_run_count ?? previousItems.length) + 1,
    persisted_run_count: items.length,
    latest_run: item,
    items,
  };
}

async function appendPortfolioAutomationRun(
  run: ProductionReadinessPortfolioRunResult,
  request: ProductionReadinessPortfolioRunRequest,
): Promise<ProductionReadinessPortfolioRunLedger> {
  const existing = await readPortfolioAutomationLedger();
  const ledger = buildPortfolioAutomationRunLedger(existing, run, request);
  await writeJsonFile(portfolioAutomationLedgerPath(), ledger);
  return ledger;
}

export async function runProductionReadinessPortfolioAutomation(
  request: ProductionReadinessPortfolioRunRequest = {},
): Promise<ProductionReadinessPortfolioRunResult> {
  const dryRun = request.dry_run ?? true;
  const startedAt = new Date().toISOString();
  const beforePortfolio = await getProductionReadinessPortfolio({
    includeArchivedSeries: request.include_archived_series,
    limit: 100,
  });
  const targets = selectedPortfolioTargets(beforePortfolio, request);
  const results: ProductionReadinessPortfolioRunTargetResult[] = [];
  let stoppedOnError = false;

  for (const target of targets) {
    if (target.ready_automation_step_count === 0) {
      results.push({
        scope: target.scope,
        project_id: target.project_id,
        title: target.title,
        priority_score: target.priority_score,
        status: 'skipped',
        reason: 'No ready Story Agent automation steps for this target.',
      });
      continue;
    }

    const automationRequest = {
      dry_run: dryRun,
      max_steps: request.per_target_max_steps ?? 4,
      action_keys: request.action_keys,
      stop_on_error: request.stop_on_error ?? true,
    };
    const runRes = target.scope === 'story_project'
      ? await runProjectProductionReadinessAutomation(target.project_id, automationRequest)
      : await runAiComicSeriesProductionReadinessAutomation(target.project_id, automationRequest);

    if (runRes.ok && runRes.data) {
      results.push({
        scope: target.scope,
        project_id: target.project_id,
        title: target.title,
        priority_score: target.priority_score,
        status: targetStatusFromRun(dryRun, runRes.data),
        run_result: runRes.data,
      });
    } else {
      results.push({
        scope: target.scope,
        project_id: target.project_id,
        title: target.title,
        priority_score: target.priority_score,
        status: 'failed',
        error_message: runRes.error?.message ?? 'Portfolio target automation failed.',
      });
      if (request.stop_on_error ?? true) {
        stoppedOnError = true;
        break;
      }
    }
  }

  const afterPortfolio = await getProductionReadinessPortfolio({
    includeArchivedSeries: request.include_archived_series,
    limit: 100,
  });
  const completedAt = new Date().toISOString();
  const runResult: ProductionReadinessPortfolioRunResult = {
    schema_version: 'production-readiness-portfolio-run/v1',
    dry_run: dryRun,
    started_at: startedAt,
    completed_at: completedAt,
    requested_scope_count: request.scopes?.length ?? 0,
    requested_project_id_count: request.project_ids?.length ?? 0,
    selected_target_count: targets.length,
    executed_target_count: results.filter(item => item.status === 'executed').length,
    planned_target_count: results.filter(item => item.status === 'planned').length,
    skipped_target_count: results.filter(item => item.status === 'skipped').length,
    failed_target_count: results.filter(item => item.status === 'failed').length,
    before_portfolio: beforePortfolio,
    after_portfolio: afterPortfolio,
    targets: results,
    notes: [
      dryRun ? 'dry_run=true: portfolio runner only planned safe per-target automation.' : 'Executed only per-target Story Agent steps marked can_auto_execute.',
      'Portfolio runner never executes GEARS worker, Seedance SDK, ffmpeg, final assembly, or operator-review steps.',
      stoppedOnError ? 'Stopped after first failed target because stop_on_error=true.' : 'Processed selected targets without stop-on-error interruption.',
    ],
  };

  if (!dryRun) {
    const ledger = await appendPortfolioAutomationRun(runResult, request);
    runResult.portfolio_automation_ledger = ledger;
    runResult.latest_portfolio_automation_run = ledger.latest_run;
    runResult.after_portfolio = await getProductionReadinessPortfolio({
      includeArchivedSeries: request.include_archived_series,
      limit: 100,
    });
  }

  return runResult;
}
