import type {
  AiComicSeriesProductionReadinessReport,
  GearsExternalCallbackBatchImportMode,
  GearsExternalCallbackBatchImportResult,
  GearsExternalCallbackBatchProjectResult,
  GearsExternalCallbackBatchUnresolvedItem,
  GearsExternalCallbackHandoffQueuePackage,
  GearsJobCallbackRequest,
  GearsJobLedgerItem,
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
  exportProjectGearsExternalCallbackHandoff,
  getProject,
  getProjectProductionReadiness,
  importProjectGearsExternalCallbacks,
  listProjects,
  preflightProjectGearsExternalCallbacks,
  runProjectProductionReadinessAutomation,
} from './project-service.js';
import {
  extractGearsJobCallbackRequests,
  gearsCallbackBatchPath,
  normalizeGearsJobCallback,
  normalizeGearsJobLedger,
} from './gears-execution-service.js';
import {
  getAiComicSeriesProductionReadiness,
  listAiComicSeriesProjects,
  runAiComicSeriesProductionReadinessAutomation,
} from './ai-comic-series-service.js';

export interface ProductionReadinessPortfolioOptions {
  includeArchivedSeries?: boolean;
  limit?: number;
}

export interface GearsExternalCallbackHandoffQueueOptions {
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

const systemGearsExternalCallbackPreflightPath = '/api/system/gears-external-callbacks/preflight';
const systemGearsExternalCallbackImportPath = '/api/system/gears-external-callbacks/import';

function gearsSystemExternalCallbackCurlCommand(targetPath: string): string {
  return [
    `curl -sS -X POST "$STORY_AGENT_BASE_URL${targetPath}"`,
    '-H "content-type: application/json"',
    '-H "x-gears-callback-secret: $GEARS_CALLBACK_SECRET"',
    '--data-binary @gears-system-external-callbacks.json',
  ].join(' ');
}

function callbackArtifactUrlIsHttp(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function callbackArtifactUrlIsPlaceholder(value: string): boolean {
  if (value.includes('<') || value.includes('>')) return true;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'gears.example'
      || host === 'story-agent.example'
      || host === 'local.story-agent.invalid';
  } catch {
    return true;
  }
}

function callbackArtifactUrlIsLocalOrPrivate(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'localhost'
      || host === '0.0.0.0'
      || host === '::1'
      || host.endsWith('.local')
      || host.startsWith('127.')
      || host.startsWith('10.')
      || host.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  } catch {
    return false;
  }
}

function summarizeCallbackSampleSafety(
  callbacks: GearsJobCallbackRequest[],
): Pick<
  GearsExternalCallbackHandoffQueuePackage,
  | 'callback_sample_count'
  | 'callback_sample_ready_for_import_count'
  | 'callback_sample_placeholder_output_url_count'
  | 'callback_sample_local_or_private_output_url_count'
  | 'callback_sample_invalid_output_url_count'
  | 'sample_payload_ready_for_import'
> {
  let readyForImport = 0;
  let placeholder = 0;
  let localOrPrivate = 0;
  let invalid = 0;

  for (const callback of callbacks) {
    const normalized = normalizeGearsJobCallback(callback);
    const urls = normalized.artifact_urls;
    const hasInvalid = urls.length === 0 || urls.some(url => !callbackArtifactUrlIsHttp(url));
    const hasPlaceholder = urls.some(callbackArtifactUrlIsPlaceholder);
    const hasLocalOrPrivate = urls.some(callbackArtifactUrlIsLocalOrPrivate);
    if (hasInvalid) invalid += 1;
    if (hasPlaceholder) placeholder += 1;
    if (hasLocalOrPrivate) localOrPrivate += 1;
    if (urls.length > 0 && !hasInvalid && !hasPlaceholder && !hasLocalOrPrivate) readyForImport += 1;
  }

  return {
    callback_sample_count: callbacks.length,
    callback_sample_ready_for_import_count: readyForImport,
    callback_sample_placeholder_output_url_count: placeholder,
    callback_sample_local_or_private_output_url_count: localOrPrivate,
    callback_sample_invalid_output_url_count: invalid,
    sample_payload_ready_for_import: callbacks.length > 0 && readyForImport === callbacks.length,
  };
}

function callbackSourceProjectId(callback: GearsJobCallbackRequest): string | undefined {
  const value = callback.source_project_id ?? callback.sourceProjectId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function callbackMatchSummary(callback: GearsJobCallbackRequest): Pick<
  GearsExternalCallbackBatchUnresolvedItem,
  'source_project_id' | 'source_unit_id' | 'gears_job_id' | 'event_id'
> {
  const normalized = normalizeGearsJobCallback(callback);
  return {
    source_project_id: normalized.source_project_id,
    source_unit_id: normalized.source_unit_id,
    gears_job_id: normalized.gears_job_id,
    event_id: normalized.event_id,
  };
}

function callbackMatchesLedgerItem(callback: GearsJobCallbackRequest, item: GearsJobLedgerItem): boolean {
  const normalized = normalizeGearsJobCallback(callback);
  if (normalized.gears_job_id && normalized.gears_job_id === item.gears_job_id) return true;
  if (normalized.idempotency_key && normalized.idempotency_key === item.idempotency_key) return true;
  return Boolean(normalized.source_unit_id && normalized.source_unit_id === item.source_unit_id);
}

async function resolveCallbackProjectFromLedgers(callback: GearsJobCallbackRequest): Promise<string[] | undefined> {
  const projectsRes = await listProjects();
  const projectIds = projectsRes.data?.map(project => project.project_id) ?? [];
  const matches = new Set<string>();
  for (const projectId of projectIds) {
    const detail = await getProject(projectId);
    if (!detail.ok || !detail.data) continue;
    const ledger = normalizeGearsJobLedger(detail.data.project.gears_job_ledger);
    if (ledger.items.some(item => callbackMatchesLedgerItem(callback, item))) {
      matches.add(projectId);
    }
  }
  return matches.size ? [...matches] : undefined;
}

function blockedPreflightItemCount(projectResults: GearsExternalCallbackBatchProjectResult[]): number {
  return projectResults.reduce((sum, result) => {
    const blockingIndexes = new Set(
      result.preflight?.issues
        .filter(issue => issue.severity === 'blocking')
        .map(issue => issue.index) ?? [],
    );
    return sum + blockingIndexes.size;
  }, 0);
}

function buildGearsExternalCallbackBatchMarkdown(
  report: Omit<GearsExternalCallbackBatchImportResult, 'markdown'>,
): string {
  return [
    '# GEARS External Callback Batch Import',
    '',
    `> mode: ${report.mode}`,
    `> blocked: ${report.blocked}`,
    '',
    '## Summary',
    '',
    `- received callbacks: ${report.received_count}`,
    `- resolved callbacks: ${report.resolved_count}`,
    `- unresolved callbacks: ${report.unresolved_count}`,
    `- projects: ${report.project_count}`,
    `- ready to import: ${report.ready_to_import_count}`,
    `- updated: ${report.updated_count}`,
    `- failed: ${report.failed_count}`,
    `- duplicates: ${report.duplicate_count}`,
    `- blocking: ${report.blocking_count}`,
    `- warnings: ${report.warning_count}`,
    '',
    '## Operator Checklist',
    '',
    ...report.operator_checklist.map(item => `- ${item}`),
    '',
    '## Project Results',
    '',
    ...(report.project_results.length
      ? report.project_results.map(project =>
        `- ${project.project_id}: received=${project.received_count} blocked=${project.blocked} ready=${project.preflight?.ready_to_import_count ?? 0} updated=${project.import_result?.updated_count ?? 0}`
      )
      : ['- none']),
    '',
    '## Unresolved Callbacks',
    '',
    ...(report.unresolved_callbacks.length
      ? report.unresolved_callbacks.map(item =>
        `- #${item.index + 1} ${item.reason}: ${item.message}`
      )
      : ['- none']),
  ].join('\n');
}

async function groupGearsExternalCallbacksByProject(callbacks: GearsJobCallbackRequest[]): Promise<{
  groups: Map<string, { callbacks: GearsJobCallbackRequest[]; indexes: number[] }>;
  unresolved: GearsExternalCallbackBatchUnresolvedItem[];
}> {
  const groups = new Map<string, { callbacks: GearsJobCallbackRequest[]; indexes: number[] }>();
  const unresolved: GearsExternalCallbackBatchUnresolvedItem[] = [];

  for (const [index, callback] of callbacks.entries()) {
    const explicitProjectId = callbackSourceProjectId(callback);
    const projectMatches = explicitProjectId ? [explicitProjectId] : await resolveCallbackProjectFromLedgers(callback);
    if (!projectMatches?.length) {
      unresolved.push({
        index,
        ...callbackMatchSummary(callback),
        reason: 'missing_project',
        message: 'Callback does not include sourceProjectId and did not uniquely match any project GEARS ledger item.',
      });
      continue;
    }
    if (projectMatches.length > 1) {
      unresolved.push({
        index,
        ...callbackMatchSummary(callback),
        reason: 'ambiguous_project',
        candidate_project_ids: projectMatches,
        message: `Callback matched multiple project GEARS ledgers: ${projectMatches.join(', ')}`,
      });
      continue;
    }
    const [projectId] = projectMatches;
    const group = groups.get(projectId) ?? { callbacks: [], indexes: [] };
    group.callbacks.push(callback);
    group.indexes.push(index);
    groups.set(projectId, group);
  }

  return { groups, unresolved };
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

function buildGearsExternalCallbackHandoffQueueMarkdown(
  pkg: Omit<GearsExternalCallbackHandoffQueuePackage, 'markdown'>,
): string {
  return [
    '# GEARS External Callback Handoff Queue',
    '',
    `> exportedAt: ${pkg.exported_at}`,
    '',
    '## Summary',
    '',
    `- system preflight: ${pkg.system_preflight_path}`,
    `- system safe import: ${pkg.system_safe_import_path}`,
    `- projects: ${pkg.project_count}`,
    `- total GEARS jobs: ${pkg.total_job_count}`,
    `- external ready: ${pkg.external_ready_count}`,
    `- local acceptance ready: ${pkg.local_acceptance_ready_count}`,
    `- pending external artifacts: ${pkg.pending_external_artifact_count}`,
    `- callback sample ready for import: ${pkg.sample_payload_ready_for_import}`,
    `- callback sample ready/total: ${pkg.callback_sample_ready_for_import_count}/${pkg.callback_sample_count}`,
    `- callback sample placeholders: ${pkg.callback_sample_placeholder_output_url_count}`,
    `- callback sample local/private: ${pkg.callback_sample_local_or_private_output_url_count}`,
    `- callback sample invalid/missing URL: ${pkg.callback_sample_invalid_output_url_count}`,
    '',
    '## Operator Checklist',
    '',
    ...pkg.operator_checklist.map(item => `- ${item}`),
    '',
    '## System Commands',
    '',
    'Write the JSON payload below to `gears-system-external-callbacks.json`, replace placeholder `outputUrl` values with real public artifact URLs, run preflight first, then import only when preflight is not blocked.',
    '',
    '```bash',
    pkg.system_preflight_curl,
    '',
    '# Import only after preflight passes with blocked=false and blocking_count=0.',
    pkg.system_safe_import_curl,
    '```',
    '',
    '## Project Queue',
    '',
    ...(pkg.projects.length
      ? pkg.projects.flatMap((project, index) => [
        `### ${index + 1}. ${project.title}`,
        '',
        `- projectId: ${project.project_id}`,
        `- storyId: ${project.storyId}`,
        `- pendingExternalArtifacts: ${project.pending_external_artifact_count}`,
        `- externalReady: ${project.external_ready_count}`,
        `- localAcceptanceReady: ${project.local_acceptance_ready_count}`,
        `- callbackPath: ${project.callback_path}`,
        `- preflightPath: ${project.preflight_path}`,
        `- safeImportPath: ${project.safe_import_path}`,
        '',
        '```json',
        JSON.stringify(project.callback_batch_sample, null, 2),
        '```',
        '',
      ])
      : ['- none']),
    '## Combined Callback Sample',
    '',
    '```json',
    JSON.stringify(pkg.callback_batch_sample, null, 2),
    '```',
    '',
    '## Notes',
    '',
    ...pkg.notes.map(note => `- ${note}`),
  ].join('\n');
}

export async function getGearsExternalCallbackHandoffQueue(
  options: GearsExternalCallbackHandoffQueueOptions = {},
): Promise<GearsExternalCallbackHandoffQueuePackage> {
  const exportedAt = new Date().toISOString();
  const limit = boundedLimit(options.limit);
  const projects = await listProjects();
  const queueProjects: GearsExternalCallbackHandoffQueuePackage['projects'] = [];

  for (const project of projects.data ?? []) {
    if (queueProjects.length >= limit) break;
    const readiness = await getProjectProductionReadiness(project.project_id);
    if (!readiness.ok || !readiness.data) continue;
    if (readiness.data.summary.ready_without_external_gears_artifact_count <= 0) continue;
    const handoff = await exportProjectGearsExternalCallbackHandoff(project.project_id);
    if (!handoff.ok || !handoff.data || handoff.data.pending_external_artifact_count <= 0) continue;
    queueProjects.push({
      project_id: handoff.data.project.project_id,
      title: handoff.data.title,
      storyId: handoff.data.storyId,
      updated_at: handoff.data.project.updated_at,
      total_job_count: handoff.data.total_job_count,
      external_ready_count: handoff.data.external_ready_count,
      local_acceptance_ready_count: handoff.data.local_acceptance_ready_count,
      pending_external_artifact_count: handoff.data.pending_external_artifact_count,
      callback_path: handoff.data.callback_path,
      callback_url: handoff.data.callback_url,
      preflight_path: handoff.data.preflight_path,
      preflight_url: handoff.data.preflight_url,
      safe_import_path: handoff.data.safe_import_path,
      safe_import_url: handoff.data.safe_import_url,
      callback_batch_sample: handoff.data.callback_batch_sample,
      items: handoff.data.items,
    });
  }

  queueProjects.sort((a, b) => {
    if (a.pending_external_artifact_count !== b.pending_external_artifact_count) {
      return b.pending_external_artifact_count - a.pending_external_artifact_count;
    }
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });

  const callbackBatchSample = {
    callbacks: queueProjects.flatMap(project => project.callback_batch_sample.callbacks),
    replace_before_import: [
      'Replace every placeholder outputUrl with an absolute public http(s) external provider artifact URL.',
      'Use each project safeImportPath/safeImportUrl for import; combined callbacks are grouped for operator planning only.',
      `For cross-project batches, POST to ${systemGearsExternalCallbackPreflightPath} first, then ${systemGearsExternalCallbackImportPath} only after preflight passes.`,
      'Never import local_acceptance URLs, localhost/private-network URLs, or gears.example placeholder URLs as real external output.',
    ],
    import_note: 'This queue is a cross-project operator handoff. Import callbacks through the system safe import endpoint or each project safe import endpoint after preflight passes.',
  };
  const sampleSafety = summarizeCallbackSampleSafety(callbackBatchSample.callbacks);

  const base: Omit<GearsExternalCallbackHandoffQueuePackage, 'markdown'> = {
    schema_version: 'gears-external-callback-handoff-queue/v1',
    exported_at: exportedAt,
    system_preflight_path: systemGearsExternalCallbackPreflightPath,
    system_safe_import_path: systemGearsExternalCallbackImportPath,
    system_preflight_curl: gearsSystemExternalCallbackCurlCommand(systemGearsExternalCallbackPreflightPath),
    system_safe_import_curl: gearsSystemExternalCallbackCurlCommand(systemGearsExternalCallbackImportPath),
    project_count: queueProjects.length,
    total_job_count: queueProjects.reduce((sum, project) => sum + project.total_job_count, 0),
    external_ready_count: queueProjects.reduce((sum, project) => sum + project.external_ready_count, 0),
    local_acceptance_ready_count: queueProjects.reduce((sum, project) => sum + project.local_acceptance_ready_count, 0),
    pending_external_artifact_count: queueProjects.reduce((sum, project) => sum + project.pending_external_artifact_count, 0),
    ...sampleSafety,
    projects: queueProjects,
    callback_batch_sample: callbackBatchSample,
    operator_checklist: [
      `Run ${systemGearsExternalCallbackPreflightPath} or each project preflight endpoint before safe import.`,
      'Replace sample outputUrl values with real external GEARS/Seedance artifact URLs.',
      'Confirm external_ready increases and ready_without_external decreases after import.',
      'Do not treat local_acceptance artifacts as final external media.',
    ],
    notes: [
      `Returned top ${queueProjects.length} projects with ready GEARS jobs still missing external artifacts.`,
      'The combined callback sample may be sent to the system preflight/import endpoints; each callback still belongs to its project ledger.',
      'This endpoint is read-only and does not modify project ledgers or generated artifacts.',
    ],
  };

  return {
    ...base,
    markdown: buildGearsExternalCallbackHandoffQueueMarkdown(base),
  };
}

export async function processGearsExternalCallbackBatch(
  request: GearsJobCallbackRequest,
  mode: GearsExternalCallbackBatchImportMode,
): Promise<GearsExternalCallbackBatchImportResult> {
  const callbacks = extractGearsJobCallbackRequests(request);
  const { groups, unresolved } = await groupGearsExternalCallbacksByProject(callbacks);
  const projectResults: GearsExternalCallbackBatchProjectResult[] = [];

  for (const [projectId, group] of groups.entries()) {
    const preflightRes = await preflightProjectGearsExternalCallbacks(projectId, { callbacks: group.callbacks });
    if (!preflightRes.ok || !preflightRes.data) {
      projectResults.push({
        project_id: projectId,
        received_count: group.callbacks.length,
        blocked: true,
        error: preflightRes.error?.message ?? 'GEARS external callback project preflight failed.',
      });
      continue;
    }
    projectResults.push({
      project_id: projectId,
      received_count: group.callbacks.length,
      blocked: preflightRes.data.blocking_count > 0,
      preflight: preflightRes.data,
    });
  }

  const hasBlockingProject = projectResults.some(result => result.blocked);
  const blocked = unresolved.length > 0 || hasBlockingProject;
  if (mode === 'import' && !blocked) {
    for (const result of projectResults) {
      const group = groups.get(result.project_id);
      if (!group) continue;
      const importRes = await importProjectGearsExternalCallbacks(result.project_id, { callbacks: group.callbacks });
      if (!importRes.ok || !importRes.data) {
        result.blocked = true;
        result.error = importRes.error?.message ?? 'GEARS external callback project import failed.';
        continue;
      }
      result.import_result = importRes.data;
      result.blocked = importRes.data.blocked;
    }
  }

  const finalBlocked = blocked || projectResults.some(result => result.blocked);
  const readyToImportCount = projectResults.reduce(
    (sum, result) => sum + (result.preflight?.ready_to_import_count ?? 0),
    0,
  );
  const updatedCount = projectResults.reduce(
    (sum, result) => sum + (result.import_result?.updated_count ?? 0),
    0,
  );
  const importFailedCount = projectResults.reduce(
    (sum, result) => sum + (result.import_result?.failed_count ?? 0),
    0,
  );
  const failedCount = mode === 'import' && !finalBlocked
    ? importFailedCount
    : unresolved.length + blockedPreflightItemCount(projectResults) + projectResults.filter(result => result.error).length;
  const duplicateCount = projectResults.reduce(
    (sum, result) => sum + (result.import_result?.duplicate_count ?? result.preflight?.duplicate_event_count ?? 0),
    0,
  );
  const blockingCount = unresolved.length
    + projectResults.reduce((sum, result) =>
      sum + (result.preflight?.blocking_count ?? (result.error ? 1 : 0)), 0);
  const warningCount = projectResults.reduce(
    (sum, result) => sum + (result.preflight?.warning_count ?? 0),
    0,
  );

  const base: Omit<GearsExternalCallbackBatchImportResult, 'markdown'> = {
    schema_version: 'system-gears-external-callback-batch-import/v1',
    mode,
    blocked: finalBlocked,
    received_count: callbacks.length,
    resolved_count: callbacks.length - unresolved.length,
    unresolved_count: unresolved.length,
    project_count: projectResults.length,
    ready_to_import_count: readyToImportCount,
    updated_count: updatedCount,
    failed_count: failedCount,
    duplicate_count: duplicateCount,
    blocking_count: blockingCount,
    warning_count: warningCount,
    project_results: projectResults,
    unresolved_callbacks: unresolved,
    operator_checklist: [
      'Run system preflight before import and confirm blocking_count is 0.',
      'Replace every gears.example placeholder outputUrl with a real public external GEARS/Seedance artifact URL.',
      'Do not submit local_acceptance URLs, localhost/private network URLs, or local file paths as external output.',
      'After import, verify project readiness external_ready increased and ready_without_external decreased.',
    ],
  };
  return {
    ...base,
    markdown: buildGearsExternalCallbackBatchMarkdown(base),
  };
}

export function preflightGearsExternalCallbackBatch(
  request: GearsJobCallbackRequest,
): Promise<GearsExternalCallbackBatchImportResult> {
  return processGearsExternalCallbackBatch(request, 'preflight');
}

export function importGearsExternalCallbackBatch(
  request: GearsJobCallbackRequest,
): Promise<GearsExternalCallbackBatchImportResult> {
  return processGearsExternalCallbackBatch(request, 'import');
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
