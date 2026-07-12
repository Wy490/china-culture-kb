import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import { getProjectContext } from './get-project-context.js';

type ProductionReadinessStatus = 'ready' | 'needs_action' | 'blocked';
type ProductionReadinessScope = 'story_project' | 'ai_comic_series';
type IssueSeverity = 'blocking' | 'warning' | 'info';
type GearsJobStatus = 'submitted' | 'queued' | 'processing' | 'ready' | 'failed' | 'canceled' | 'rejected';

type JsonRecord = Record<string, unknown>;

interface ProductionReadinessLane {
  key: string;
  label: string;
  status: ProductionReadinessStatus;
  score: number;
  detail: string;
  count_text?: string;
  evidence: string[];
  action_key?: string;
  action_label?: string;
}

interface ProductionReadinessIssue {
  issue_id: string;
  severity: IssueSeverity;
  lane_key: string;
  label: string;
  detail: string;
  action_key?: string;
  action_label?: string;
}

interface ProductionReadinessNextAction {
  action_key: string;
  label: string;
  detail: string;
  priority: number;
  lane_key?: string;
}

type AutomationRunner = 'mcp_tool' | 'story_agent_api' | 'gears_worker' | 'operator_review';
type AutomationMode = 'read_only' | 'writes_project' | 'external_execution' | 'manual';
type AutomationStepStatus = 'ready' | 'blocked' | 'manual';

interface ProductionReadinessAutomationStep {
  step_id: string;
  order: number;
  action_key: string;
  label: string;
  runner: AutomationRunner;
  mode: AutomationMode;
  status: AutomationStepStatus;
  can_auto_execute: boolean;
  mcp_tool?: string;
  api?: {
    method: 'GET' | 'POST';
    path: string;
  };
  payload_hint?: JsonRecord;
  prerequisites: string[];
  blocked_by_issue_ids: string[];
  expected_result: string;
  safety_note: string;
}

interface ProductionReadinessAutomationPlan {
  schema_version: 'mcp-production-readiness-automation-plan/v1';
  status: 'ready' | 'needs_operator' | 'blocked';
  ready_step_count: number;
  blocked_step_count: number;
  manual_step_count: number;
  steps: ProductionReadinessAutomationStep[];
  notes: string[];
}

interface ProductionReadinessAutomationRunLedgerStep {
  step_id: string;
  action_key: string;
  label: string;
  status: string;
  runner?: string;
  mode?: string;
  reason?: string;
  error_message?: string;
}

interface ProductionReadinessAutomationRunLedgerItem {
  run_id: string;
  dry_run: boolean;
  started_at: string;
  completed_at: string;
  requested_action_keys?: string[];
  executed_step_count: number;
  planned_step_count: number;
  skipped_step_count: number;
  failed_step_count: number;
  before_status?: string;
  before_score?: number;
  after_status?: string;
  after_score?: number;
  steps: ProductionReadinessAutomationRunLedgerStep[];
  notes: string[];
}

interface ProductionReadinessAutomationRunLedger {
  schema_version: 'production-readiness-automation-run-ledger/v1';
  updated_at: string;
  total_run_count: number;
  persisted_run_count: number;
  latest_run?: ProductionReadinessAutomationRunLedgerItem;
  items: ProductionReadinessAutomationRunLedgerItem[];
}

interface GearsSummary {
  total: number;
  active: number;
  ready: number;
  external_ready: number;
  local_acceptance_ready: number;
  ready_without_external_artifact: number;
  failed: number;
  rejected: number;
  canceled: number;
  missing_artifact: number;
  poll_failure: number;
  status_counts: Record<GearsJobStatus, number>;
}

export interface GetProductionReadinessInput {
  project_id?: string;
  series_project_id?: string;
  include_markdown?: boolean;
}

export interface ProductionReadinessReport {
  schema_version: 'mcp-production-readiness/v1';
  scope: ProductionReadinessScope;
  project_id: string;
  title: string;
  generated_at: string;
  summary: {
    status: ProductionReadinessStatus;
    score: number;
    ready_lane_count: number;
    total_lane_count: number;
    blocker_count: number;
    warning_count: number;
    next_action_count: number;
    quality_score?: number;
    generated_episode_count?: number;
    total_episode_count?: number;
    total_shot_count?: number;
    ready_shot_count?: number;
    failed_shot_count?: number;
    gears_job_count: number;
    active_gears_job_count: number;
    external_ready_gears_job_count?: number;
    local_acceptance_ready_gears_job_count?: number;
    ready_without_external_gears_artifact_count?: number;
    seedance_placeholder_asset_count: number;
    seedance_production_asset_ready_count: number;
  };
  lanes: ProductionReadinessLane[];
  issues: ProductionReadinessIssue[];
  next_actions: ProductionReadinessNextAction[];
  automation_plan: ProductionReadinessAutomationPlan;
  automation_ledger?: ProductionReadinessAutomationRunLedger;
  latest_automation_run?: ProductionReadinessAutomationRunLedgerItem;
  markdown?: string;
}

const GEARS_STATUSES: GearsJobStatus[] = [
  'submitted',
  'queued',
  'processing',
  'ready',
  'failed',
  'canceled',
  'rejected',
];

const LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL = 'https://local.story-agent.invalid/gears-acceptance';

function generatedRoot(): string {
  return path.resolve(getKbRoot(), '..', 'web', 'generated');
}

function seriesProjectPath(seriesProjectId: string): string {
  return path.resolve(generatedRoot(), 'ai-comic-series-projects', seriesProjectId, 'project.json');
}

function assertSafeId(id: string, label: string): void {
  if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
    throw new Error(`非法${label}：${id}`);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => asString(item)).filter(Boolean) : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)) : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeAutomationRunStep(value: JsonRecord): ProductionReadinessAutomationRunLedgerStep {
  return {
    step_id: asString(value.step_id),
    action_key: asString(value.action_key),
    label: asString(value.label),
    status: asString(value.status),
    runner: asString(value.runner) || undefined,
    mode: asString(value.mode) || undefined,
    reason: asString(value.reason) || undefined,
    error_message: asString(value.error_message) || undefined,
  };
}

function normalizeAutomationRunItem(value: unknown): ProductionReadinessAutomationRunLedgerItem | undefined {
  const record = asRecord(value);
  const runId = asString(record.run_id);
  if (!runId) return undefined;
  return {
    run_id: runId,
    dry_run: asBoolean(record.dry_run) ?? false,
    started_at: asString(record.started_at),
    completed_at: asString(record.completed_at),
    requested_action_keys: asStringArray(record.requested_action_keys),
    executed_step_count: asNumber(record.executed_step_count),
    planned_step_count: asNumber(record.planned_step_count),
    skipped_step_count: asNumber(record.skipped_step_count),
    failed_step_count: asNumber(record.failed_step_count),
    before_status: asString(record.before_status) || undefined,
    before_score: typeof record.before_score === 'number' ? record.before_score : undefined,
    after_status: asString(record.after_status) || undefined,
    after_score: typeof record.after_score === 'number' ? record.after_score : undefined,
    steps: asArray(record.steps).map(normalizeAutomationRunStep),
    notes: asStringArray(record.notes),
  };
}

function normalizeAutomationRunLedger(value: unknown): ProductionReadinessAutomationRunLedger | undefined {
  const record = asRecord(value);
  const items = asArray(record.items)
    .map(item => normalizeAutomationRunItem(item))
    .filter((item): item is ProductionReadinessAutomationRunLedgerItem => Boolean(item));
  const latestRun = normalizeAutomationRunItem(record.latest_run) ?? items[0];
  if (!latestRun && items.length === 0) return undefined;
  return {
    schema_version: 'production-readiness-automation-run-ledger/v1',
    updated_at: asString(record.updated_at, latestRun?.completed_at ?? ''),
    total_run_count: asNumber(record.total_run_count, items.length),
    persisted_run_count: asNumber(record.persisted_run_count, items.length),
    latest_run: latestRun,
    items,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isSeedancePlaceholderAsset(asset: JsonRecord): boolean {
  const provider = asString(asset.provider);
  const providerAssetId = asString(asset.provider_asset_id);
  const localPath = asString(asset.local_path);
  const originalFilename = asString(asset.original_filename);
  const mimeType = asString(asset.mime_type);
  return provider === 'story_agent_placeholder'
    || providerAssetId.startsWith('story-agent-placeholder:')
    || localPath.includes('/seedance-assets/placeholder-')
    || originalFilename.startsWith('placeholder-')
    || (mimeType === 'image/svg+xml' && localPath.includes('/seedance-assets/'));
}

function isSeedanceBoundAsset(asset: JsonRecord): boolean {
  const uploadStatus = asString(asset.upload_status);
  return asBoolean(asset.is_bound) === true
    || Boolean(
      asString(asset.file_url)
      || asString(asset.file_id)
      || asString(asset.local_path)
      || asString(asset.provider_asset_id)
      || uploadStatus === 'uploaded'
      || uploadStatus === 'external'
    );
}

function seedanceAssetCountsFromRecords(records: JsonRecord[]): {
  placeholder: number;
  productionReady: number;
} {
  let placeholder = 0;
  let productionReady = 0;
  for (const record of records) {
    if (!isSeedanceBoundAsset(record)) continue;
    if (asBoolean(record.is_placeholder) === true || isSeedancePlaceholderAsset(record)) placeholder += 1;
    else productionReady += 1;
  }
  return { placeholder, productionReady };
}

async function readStorySeedanceAssetCounts(
  projectId: string,
  project: JsonRecord,
): Promise<{ placeholder: number; productionReady: number }> {
  try {
    const report = asRecord(await readJsonFile<unknown>(
      path.resolve(generatedRoot(), 'projects', projectId, 'production-board', 'seedance-asset-report.json'),
    ));
    const placeholder = asOptionalNumber(report.placeholder_asset_count);
    const productionReady = asOptionalNumber(report.production_asset_ready_count);
    if (placeholder !== undefined && productionReady !== undefined) {
      return { placeholder, productionReady };
    }
    const assets = asArray(report.assets);
    if (assets.length > 0) return seedanceAssetCountsFromRecords(assets);
  } catch {
    // Older projects may not have exported seedance-asset-report.json yet.
  }
  return seedanceAssetCountsFromRecords(asArray(asRecord(project.seedance_asset_library).items));
}

function statusScore(status: ProductionReadinessStatus): number {
  if (status === 'ready') return 100;
  if (status === 'needs_action') return 65;
  return 30;
}

function artifactIsLocalAcceptance(artifact: JsonRecord): boolean {
  const url = asString(artifact.url);
  const metadata = asRecord(artifact.metadata);
  return artifact.role === 'local_acceptance'
    || metadata.not_external_provider_output === true
    || url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL);
}

function gearsItemHasLocalAcceptanceArtifact(item: JsonRecord): boolean {
  return asArray(item.artifacts).some(artifactIsLocalAcceptance)
    || asStringArray(item.artifact_urls).some(url => url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL));
}

function gearsItemHasExternalArtifact(item: JsonRecord): boolean {
  return asArray(item.artifacts).some(artifact => {
    const url = asString(artifact.url);
    return Boolean(url) && !artifactIsLocalAcceptance(artifact);
  }) || asStringArray(item.artifact_urls).some(url => !url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL));
}

function normalizeGearsSummary(ledger: unknown): GearsSummary {
  const statusCounts = Object.fromEntries(GEARS_STATUSES.map(status => [status, 0])) as Record<GearsJobStatus, number>;
  let missingArtifact = 0;
  let pollFailure = 0;
  let externalReady = 0;
  let localAcceptanceReady = 0;
  for (const item of asArray(asRecord(ledger).items)) {
    const status = GEARS_STATUSES.includes(item.status as GearsJobStatus)
      ? item.status as GearsJobStatus
      : 'submitted';
    statusCounts[status] += 1;
    const artifacts = asArray(item.artifacts);
    const artifactUrls = asStringArray(item.artifact_urls);
    if (status === 'ready' && artifacts.length === 0 && artifactUrls.length === 0) missingArtifact += 1;
    if (status === 'ready' && gearsItemHasExternalArtifact(item)) externalReady += 1;
    if (status === 'ready' && gearsItemHasLocalAcceptanceArtifact(item)) localAcceptanceReady += 1;
    if (item.last_poll_error) pollFailure += 1;
  }
  return {
    total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
    active: statusCounts.submitted + statusCounts.queued + statusCounts.processing,
    ready: statusCounts.ready,
    external_ready: externalReady,
    local_acceptance_ready: localAcceptanceReady,
    ready_without_external_artifact: Math.max(0, statusCounts.ready - externalReady),
    failed: statusCounts.failed,
    rejected: statusCounts.rejected,
    canceled: statusCounts.canceled,
    missing_artifact: missingArtifact,
    poll_failure: pollFailure,
    status_counts: statusCounts,
  };
}

function pushAction(actions: ProductionReadinessNextAction[], action: ProductionReadinessNextAction): void {
  if (actions.some(item => item.action_key === action.action_key)) return;
  actions.push(action);
}

function shotCounts(items: JsonRecord[]): { total: number; ready: number; failed: number; active: number } {
  let ready = 0;
  let failed = 0;
  let active = 0;
  for (const item of items) {
    const status = asString(item.status);
    if (status === 'ready') ready += 1;
    else if (status === 'failed') failed += 1;
    else if (status === 'submitted' || status === 'processing' || status === 'prompt_exported') active += 1;
  }
  return { total: items.length, ready, failed, active };
}

function buildSummary(params: {
  lanes: ProductionReadinessLane[];
  issues: ProductionReadinessIssue[];
  actions: ProductionReadinessNextAction[];
  qualityScore?: number;
  generatedEpisodeCount?: number;
  totalEpisodeCount?: number;
  totalShotCount?: number;
  readyShotCount?: number;
  failedShotCount?: number;
  seedancePlaceholderAssetCount?: number;
  seedanceProductionAssetReadyCount?: number;
  gearsSummary: GearsSummary;
}): ProductionReadinessReport['summary'] {
  const blockerCount = params.issues.filter(issue => issue.severity === 'blocking').length;
  const warningCount = params.issues.filter(issue => issue.severity === 'warning').length;
  const status: ProductionReadinessStatus = blockerCount > 0 || params.lanes.some(lane => lane.status === 'blocked')
    ? 'blocked'
    : warningCount > 0 || params.lanes.some(lane => lane.status === 'needs_action')
      ? 'needs_action'
      : 'ready';
  const laneAverage = params.lanes.length
    ? params.lanes.reduce((sum, lane) => sum + lane.score, 0) / params.lanes.length
    : 0;
  return {
    status,
    score: clampScore(laneAverage - blockerCount * 8 - warningCount * 3),
    ready_lane_count: params.lanes.filter(lane => lane.status === 'ready').length,
    total_lane_count: params.lanes.length,
    blocker_count: blockerCount,
    warning_count: warningCount,
    next_action_count: params.actions.length,
    quality_score: params.qualityScore,
    generated_episode_count: params.generatedEpisodeCount,
    total_episode_count: params.totalEpisodeCount,
    total_shot_count: params.totalShotCount,
    ready_shot_count: params.readyShotCount,
    failed_shot_count: params.failedShotCount,
    gears_job_count: params.gearsSummary.total,
    active_gears_job_count: params.gearsSummary.active,
    external_ready_gears_job_count: params.gearsSummary.external_ready,
    local_acceptance_ready_gears_job_count: params.gearsSummary.local_acceptance_ready,
    ready_without_external_gears_artifact_count: params.gearsSummary.ready_without_external_artifact,
    seedance_placeholder_asset_count: params.seedancePlaceholderAssetCount ?? 0,
    seedance_production_asset_ready_count: params.seedanceProductionAssetReadyCount ?? 0,
  };
}

function apiPath(scope: ProductionReadinessScope, projectId: string, actionKey: string): { method: 'GET' | 'POST'; path: string } | undefined {
  if (scope === 'story_project') {
    const storyPaths: Record<string, string> = {
      export_production_board: `/api/projects/${projectId}/production-board/export`,
      repair_production_board: `/api/projects/${projectId}/production-board/repair-export`,
      export_retry_package: `/api/projects/${projectId}/production-board/export-seedance-retry-package`,
      export_gears_external_callback_handoff: `/api/projects/${projectId}/production-board/gears-jobs/export-external-callback-handoff`,
      submit_gears_jobs: `/api/projects/${projectId}/production-board/gears-jobs/submit`,
      sync_gears_jobs: `/api/projects/${projectId}/production-board/gears-jobs/sync`,
    };
    const pathValue = storyPaths[actionKey];
    return pathValue ? { method: 'POST', path: pathValue } : undefined;
  }

  const seriesPaths: Record<string, string> = {
    generate_next_episode: `/api/story-outline/ai-comic-episode`,
    rebuild_series_ledger: `/api/story-outline/ai-comic-series-projects/${projectId}/rebuild-ledger`,
    export_seedance_prompts: `/api/story-outline/ai-comic-series-projects/${projectId}/export-seedance-prompts`,
    export_retry_package: `/api/story-outline/ai-comic-series-projects/${projectId}/export-seedance-retry-package`,
    export_review_repair_package: `/api/story-outline/ai-comic-series-projects/${projectId}/export-seedance-review-repair-package`,
    export_editing_platform_package: `/api/story-outline/ai-comic-series-projects/${projectId}/export-seedance-editing-platform-package`,
    submit_gears_jobs: `/api/story-outline/ai-comic-series-projects/${projectId}/gears-jobs/submit`,
    sync_gears_jobs: `/api/story-outline/ai-comic-series-projects/${projectId}/gears-jobs/sync`,
  };
  const pathValue = seriesPaths[actionKey];
  return pathValue ? { method: 'POST', path: pathValue } : undefined;
}

function payloadHint(scope: ProductionReadinessScope, projectId: string, actionKey: string): JsonRecord | undefined {
  if (actionKey === 'kb_validate_genre_story') return { project_id: projectId, include_repair_actions: true };
  if (actionKey === 'kb_repair_story') return { project_id: projectId, auto_apply: false, include_markdown: true };
  if (actionKey === 'repair_production_board') return { apply_all: true };
  if (actionKey === 'submit_gears_jobs') return scope === 'story_project'
    ? { job_type: 'seedance_video', use_gears_api: true }
    : { job_type: 'seedance_video', use_gears_api: true, submit_intent: 'retry_or_review_repair' };
  if (actionKey === 'sync_gears_jobs') return { use_gears_api: true };
  if (actionKey === 'generate_next_episode') return { series_project_id: projectId, episode_no: '<next_episode_no>' };
  return {};
}

function automationRunner(actionKey: string): AutomationRunner {
  if (actionKey === 'kb_validate_genre_story' || actionKey === 'kb_repair_story') return 'mcp_tool';
  if (actionKey === 'submit_gears_jobs' || actionKey === 'sync_gears_jobs') return 'gears_worker';
  if (actionKey === 'export_review_repair_package' || actionKey === 'export_gears_external_callback_handoff') return 'operator_review';
  return 'story_agent_api';
}

function automationMode(actionKey: string): AutomationMode {
  if (actionKey === 'kb_validate_genre_story' || actionKey === 'kb_repair_story') return 'read_only';
  if (actionKey === 'submit_gears_jobs' || actionKey === 'sync_gears_jobs') return 'external_execution';
  if (actionKey === 'export_review_repair_package' || actionKey === 'export_gears_external_callback_handoff') return 'manual';
  return 'writes_project';
}

function automationPrerequisites(actionKey: string): string[] {
  if (actionKey === 'submit_gears_jobs') {
    return ['GEARS_API_BASE_URL configured', 'GEARS_CALLBACK_BASE_URL configured', 'GEARS_CALLBACK_SECRET configured'];
  }
  if (actionKey === 'sync_gears_jobs') return ['GEARS_API_BASE_URL configured', 'existing GEARS Job Ledger'];
  if (actionKey === 'generate_next_episode') return ['series plan loaded', 'previous episode context reviewed'];
  if (actionKey === 'export_review_repair_package') return ['open review ledger items reviewed'];
  if (actionKey === 'export_gears_external_callback_handoff') return ['existing GEARS Job Ledger', 'operator confirms local acceptance is not final media'];
  return [];
}

function expectedAutomationResult(actionKey: string): string {
  const map: Record<string, string> = {
    kb_validate_genre_story: '返回类型片质量报告和修复建议，不写项目文件。',
    kb_repair_story: '返回 dry-run 修复动作；auto_apply 仍需 repaired_story_json。',
    repair_production_board: '新增 production_board_repair 版本并导出最新交付包。',
    export_production_board: '生成 Production Board 交付包并记录当前版本 export 信息。',
    export_retry_package: '生成失败镜头/返修镜头重试包。',
    export_review_repair_package: '生成审片返修包，供人工或 GEARS 重试链路使用。',
    export_gears_external_callback_handoff: '导出待真实外部回片的 callback 样例、preflight 和 safe import 交接包。',
    export_editing_platform_package: '生成外部剪辑平台交付包。',
    generate_next_episode: '生成下一集故事并更新系列项目生成进度。',
    rebuild_series_ledger: '重建连续性账本并刷新系列质量审计。',
    submit_gears_jobs: '提交 GEARS job 并写入 GEARS Job Ledger。',
    sync_gears_jobs: '轮询 GEARS status 并写回项目/系列生产账本。',
  };
  return map[actionKey] ?? '执行对应生产指挥动作并刷新 readiness。';
}

function safetyNote(actionKey: string): string {
  if (actionKey === 'submit_gears_jobs') return '会调用外部 GEARS v2 worker；当前仓库只建账本和接回调，不执行真实媒体生产。';
  if (actionKey === 'sync_gears_jobs') return '只同步 GEARS 状态，不应把临时 poll 失败误写成终态 failed。';
  if (actionKey === 'repair_production_board' || actionKey === 'export_production_board') return '会写项目版本或导出目录；执行前应确认当前项目 ID 正确。';
  if (actionKey === 'generate_next_episode') return '会产生新故事/系列状态；需要确保承接上一集连续性。';
  if (actionKey === 'export_review_repair_package') return '涉及审片意见取舍，建议保留人工复核。';
  if (actionKey === 'export_gears_external_callback_handoff') return '只导出交接材料；不得把 local_acceptance URL 当成真实外部媒体。';
  return '只读或低风险动作。';
}

function blockedIssueIdsForAction(actionKey: string, issues: ProductionReadinessIssue[]): string[] {
  if (actionKey === 'submit_gears_jobs') {
    return issues
      .filter(issue => issue.severity === 'blocking' && issue.lane_key !== 'gears_execution')
      .map(issue => issue.issue_id);
  }
  if (actionKey === 'sync_gears_jobs') return [];
  if (actionKey === 'export_editing_platform_package') {
    return issues
      .filter(issue => issue.severity === 'blocking' && issue.lane_key !== 'delivery_contract')
      .map(issue => issue.issue_id);
  }
  return [];
}

function buildAutomationPlan(params: {
  scope: ProductionReadinessScope;
  projectId: string;
  actions: ProductionReadinessNextAction[];
  issues: ProductionReadinessIssue[];
}): ProductionReadinessAutomationPlan {
  const steps = params.actions
    .sort((a, b) => a.priority - b.priority)
    .map((action, index) => {
      const runner = automationRunner(action.action_key);
      const mode = automationMode(action.action_key);
      const blockedByIssueIds = blockedIssueIdsForAction(action.action_key, params.issues);
      const status: AutomationStepStatus = blockedByIssueIds.length > 0
        ? 'blocked'
        : mode === 'manual'
          ? 'manual'
          : 'ready';
      const canAutoExecute = status === 'ready' && mode !== 'manual' && runner !== 'gears_worker';
      const step: ProductionReadinessAutomationStep = {
        step_id: `step-${String(index + 1).padStart(2, '0')}-${action.action_key}`,
        order: index + 1,
        action_key: action.action_key,
        label: action.label,
        runner,
        mode,
        status,
        can_auto_execute: canAutoExecute,
        api: apiPath(params.scope, params.projectId, action.action_key),
        payload_hint: payloadHint(params.scope, params.projectId, action.action_key),
        prerequisites: automationPrerequisites(action.action_key),
        blocked_by_issue_ids: blockedByIssueIds,
        expected_result: expectedAutomationResult(action.action_key),
        safety_note: safetyNote(action.action_key),
      };
      if (runner === 'mcp_tool') step.mcp_tool = action.action_key;
      return step;
    });
  const readyStepCount = steps.filter(step => step.status === 'ready').length;
  const blockedStepCount = steps.filter(step => step.status === 'blocked').length;
  const manualStepCount = steps.filter(step => step.status === 'manual').length;
  return {
    schema_version: 'mcp-production-readiness-automation-plan/v1',
    status: blockedStepCount > 0 ? 'blocked' : manualStepCount > 0 ? 'needs_operator' : 'ready',
    ready_step_count: readyStepCount,
    blocked_step_count: blockedStepCount,
    manual_step_count: manualStepCount,
    steps,
    notes: [
      'MCP read-only steps can run directly from Codex/MCP.',
      'Story Agent API steps require an API client/session and may write generated project state.',
      'GEARS worker steps require real GEARS v2 endpoint env; media execution remains outside china-culture-kb.',
    ],
  };
}

function buildMarkdown(report: Omit<ProductionReadinessReport, 'markdown'>): string {
  return [
    `# ${report.title} — MCP Production Readiness`,
    '',
    `> scope: ${report.scope}`,
    `> projectId: ${report.project_id}`,
    `> generatedAt: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- status: ${report.summary.status}`,
    `- score: ${report.summary.score}/100`,
    `- lanes: ${report.summary.ready_lane_count}/${report.summary.total_lane_count}`,
    `- blockers: ${report.summary.blocker_count}`,
    `- warnings: ${report.summary.warning_count}`,
    `- next actions: ${report.summary.next_action_count}`,
    `- GEARS external ready: ${report.summary.external_ready_gears_job_count ?? 0}`,
    `- GEARS local acceptance ready: ${report.summary.local_acceptance_ready_gears_job_count ?? 0}`,
    `- GEARS ready without external artifact: ${report.summary.ready_without_external_gears_artifact_count ?? 0}`,
    `- Seedance placeholder assets: ${report.summary.seedance_placeholder_asset_count}`,
    `- Seedance production assets ready: ${report.summary.seedance_production_asset_ready_count}`,
    '',
    '## Lanes',
    '',
    '| lane | status | score | detail |',
    '|---|---:|---:|---|',
    ...report.lanes.map(lane => `| ${lane.label} | ${lane.status} | ${lane.score}/100 | ${lane.detail} |`),
    '',
    '## Issues',
    '',
    ...(report.issues.length
      ? report.issues.map(issue => `- ${issue.severity} · ${issue.label}: ${issue.detail}`)
      : ['- none']),
    '',
    '## Next Actions',
    '',
    ...(report.next_actions.length
      ? report.next_actions.map(action => `- P${action.priority} · ${action.label}: ${action.detail}`)
      : ['- none']),
    '',
    '## Automation Plan',
    '',
    ...(report.automation_plan.steps.length
      ? report.automation_plan.steps.map(step =>
        `- ${step.step_id} · ${step.status} · ${step.runner} · ${step.label}: ${step.expected_result}`,
      )
      : ['- none']),
    '',
    '## Latest Automation Run',
    '',
    ...(report.latest_automation_run
      ? [
        `- ${report.latest_automation_run.completed_at} · executed ${report.latest_automation_run.executed_step_count} · failed ${report.latest_automation_run.failed_step_count} · score ${report.latest_automation_run.before_score ?? '?'}->${report.latest_automation_run.after_score ?? '?'}`,
        ...report.latest_automation_run.steps.map(step =>
          `  - ${step.status} · ${step.action_key}: ${step.label}`,
        ),
      ]
      : ['- none']),
  ].join('\n');
}

async function buildStoryProjectReadiness(
  projectId: string,
  includeMarkdown: boolean,
): Promise<ProductionReadinessReport | null> {
  assertSafeId(projectId, '项目 ID');
  const context = await getProjectContext({ project_id: projectId, include_versions: true });
  if (!context) return null;

  const project = context.project as unknown as JsonRecord;
  const story = context.current_story as JsonRecord;
  const currentVersion = asArray(context.version_snapshots)
    .find(version => version.version_id === project.current_version_id)
    ?? asRecord(context.version_snapshots?.[0]);
  const quality = asRecord(story.quality_report ?? currentVersion.quality_report);
  const qualityPassed = asBoolean(quality.passed) ?? asBoolean(project.quality_passed);
  const qualityScore = asNumber(quality.genre_score, asNumber(project.genre_score, qualityPassed ? 100 : 0));
  const qualityIssueCount = asStringArray(quality.issues).length || asNumber(project.quality_issue_count, 0);
  const scenes = asArray(story.scene_breakdown);
  const gearsSegments = asArray(story.gears_segments);
  const shotItems = asArray(asRecord(project.seedance_shot_ledger).items);
  const shots = shotCounts(shotItems);
  const totalShotCount = shots.total || gearsSegments.length || scenes.length;
  const gearsSummary = normalizeGearsSummary(project.gears_job_ledger);
  const exportRecord = asRecord(currentVersion.production_board_export);
  const exportStage = asString(exportRecord.delivery_stage);
  const hasExport = Boolean(exportRecord.exported_at);
  const seedanceAssetCounts = await readStorySeedanceAssetCounts(projectId, project);

  const issues: ProductionReadinessIssue[] = [];
  const actions: ProductionReadinessNextAction[] = [];

  if (qualityPassed !== true) {
    issues.push({
      issue_id: 'story-quality-not-ready',
      severity: qualityPassed === false ? 'warning' : 'blocking',
      lane_key: 'story_quality',
      label: '故事质量未确认通过',
      detail: qualityPassed === false ? '质量报告未通过，需要修复后再交付。' : '缺少质量报告，MCP 无法确认类型片质量。',
      action_key: 'kb_validate_genre_story',
      action_label: '运行质量校验',
    });
    pushAction(actions, {
      action_key: 'kb_validate_genre_story',
      label: '运行 MCP 质量校验',
      detail: '调用 kb_validate_genre_story，并按结果进入 kb_repair_story。',
      priority: 10,
      lane_key: 'story_quality',
    });
  }
  if (scenes.length === 0 || gearsSegments.length === 0) {
    issues.push({
      issue_id: 'production-board-source-missing',
      severity: scenes.length === 0 ? 'blocking' : 'warning',
      lane_key: 'production_board',
      label: 'Production Board 输入不足',
      detail: '当前故事缺少 scene_breakdown 或 gears_segments，生产板和 GEARS 交付会不完整。',
      action_key: 'kb_repair_story',
      action_label: '修复故事结构',
    });
    pushAction(actions, {
      action_key: 'kb_repair_story',
      label: '修复分镜/GEARS 段落',
      detail: '补齐 scene_breakdown 与 gears_segments 后再导出生产板。',
      priority: 20,
      lane_key: 'production_board',
    });
  }
  if (!hasExport || exportStage !== 'ready') {
    issues.push({
      issue_id: 'delivery-export-not-ready',
      severity: hasExport ? 'warning' : 'blocking',
      lane_key: 'delivery_contract',
      label: '交付包未 ready',
      detail: hasExport ? `最近导出阶段为 ${exportStage || 'unknown'}。` : '当前版本没有 Production Board 交付包落盘记录。',
      action_key: 'export_production_board',
      action_label: '导出交付包',
    });
    pushAction(actions, {
      action_key: 'export_production_board',
      label: '导出 Production Board 交付包',
      detail: '通过 Web/API 导出 Production Board JSON/Markdown/Seedance prompt/shot ledger。',
      priority: 30,
      lane_key: 'delivery_contract',
    });
  }
  if (seedanceAssetCounts.placeholder > 0) {
    issues.push({
      issue_id: 'seedance-assets-placeholder-only',
      severity: 'warning',
      lane_key: 'delivery_contract',
      label: `${seedanceAssetCounts.placeholder} 个 Seedance 占位参考图待替换`,
      detail: 'MCP 检测到 story_agent_placeholder 或 placeholder SVG；它们只表示结构化绑定，正式投产前仍需替换为真实视觉素材。',
      action_label: '批量导入正式素材',
    });
  }
  if (shots.failed > 0) {
    issues.push({
      issue_id: 'shot-production-failed',
      severity: 'blocking',
      lane_key: 'shot_production',
      label: `${shots.failed} 个镜头生产失败`,
      detail: '失败镜头需要重试、跳过或人工替换。',
      action_key: 'export_retry_package',
      action_label: '导出重试包',
    });
    pushAction(actions, {
      action_key: 'export_retry_package',
      label: '导出失败镜头重试包',
      detail: `${shots.failed} 个镜头失败，需要生成重试包进入 GEARS 重提或人工替换。`,
      priority: 45,
      lane_key: 'shot_production',
    });
  }
  if (gearsSummary.total === 0) {
    issues.push({
      issue_id: 'gears-ledger-empty',
      severity: 'warning',
      lane_key: 'gears_execution',
      label: '尚未建立 GEARS job',
      detail: 'MCP 能看到交付结构，但还没有 GEARS Job Ledger。',
      action_key: 'submit_gears_jobs',
      action_label: '提交 GEARS',
    });
    pushAction(actions, {
      action_key: 'submit_gears_jobs',
      label: '提交 GEARS job',
      detail: '从 Production Board 或 GEARS delivery 建立 GEARS Job Ledger。',
      priority: 50,
      lane_key: 'gears_execution',
    });
  }
  if (gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled > 0 || gearsSummary.missing_artifact > 0) {
    issues.push({
      issue_id: 'gears-terminal-risk',
      severity: 'blocking',
      lane_key: 'gears_execution',
      label: 'GEARS 终态风险',
      detail: `failed/rejected/canceled=${gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled}，ready 缺 artifact=${gearsSummary.missing_artifact}。`,
      action_key: 'sync_gears_jobs',
      action_label: '同步/排查 GEARS',
    });
    pushAction(actions, {
      action_key: 'sync_gears_jobs',
      label: '同步并排查 GEARS 终态风险',
      detail: '复核 GEARS failed/rejected/canceled 或 ready 缺 artifact 的 job，必要时转重试包。',
      priority: 55,
      lane_key: 'gears_execution',
    });
  }
  if (gearsSummary.active > 0 || gearsSummary.poll_failure > 0) {
    pushAction(actions, {
      action_key: 'sync_gears_jobs',
      label: '同步 GEARS 状态',
      detail: `${gearsSummary.active} 个 GEARS job 活跃，${gearsSummary.poll_failure} 个最近轮询失败。`,
      priority: 55,
      lane_key: 'gears_execution',
    });
  }
  if (gearsSummary.local_acceptance_ready > 0 && gearsSummary.ready_without_external_artifact > 0) {
    issues.push({
      issue_id: 'gears-local-acceptance-only',
      severity: 'info',
      lane_key: 'gears_execution',
      label: `${gearsSummary.local_acceptance_ready} 个 GEARS job 仅有本地验收产物`,
      detail: 'local.story-agent.invalid 只验证本地账本链路，不代表 GEARS/Seedance 真实回片。',
      action_key: 'export_gears_external_callback_handoff',
      action_label: '导出真实回片交接包',
    });
    pushAction(actions, {
      action_key: 'export_gears_external_callback_handoff',
      label: '导出 GEARS 外部回片交接包',
      detail: `${gearsSummary.ready_without_external_artifact} 个 ready job 仍缺真实外部 artifact。`,
      priority: 58,
      lane_key: 'gears_execution',
    });
  }

  const lanes: ProductionReadinessLane[] = [
    {
      key: 'story_quality',
      label: 'Story Agent MVP',
      status: qualityPassed === true ? 'ready' : qualityPassed === false ? 'needs_action' : 'blocked',
      score: clampScore(qualityScore),
      detail: qualityPassed === true ? '故事质量已通过。' : '故事质量需要校验或修复。',
      count_text: `issues ${qualityIssueCount}`,
      evidence: [`version ${asString(project.current_version_id)}`, `story ${asString(project.current_story_id)}`],
      action_key: qualityPassed === true ? undefined : 'kb_validate_genre_story',
      action_label: qualityPassed === true ? undefined : '质量校验',
    },
    {
      key: 'production_board',
      label: 'Production Board',
      status: scenes.length > 0 && gearsSegments.length > 0 ? 'ready' : scenes.length > 0 ? 'needs_action' : 'blocked',
      score: clampScore((scenes.length > 0 ? 45 : 0) + (gearsSegments.length > 0 ? 45 : 0) + (totalShotCount > 0 ? 10 : 0)),
      detail: `scenes ${scenes.length}，gears_segments ${gearsSegments.length}，shots ${totalShotCount}。`,
      count_text: `shots ${totalShotCount}`,
      evidence: [`scene_count ${asNumber(project.scene_count, scenes.length)}`, `has_gears_segments ${String(project.has_gears_segments)}`],
      action_key: scenes.length > 0 && gearsSegments.length > 0 ? undefined : 'kb_repair_story',
      action_label: scenes.length > 0 && gearsSegments.length > 0 ? undefined : '补齐分镜',
    },
    {
      key: 'delivery_contract',
      label: 'Delivery Contract',
      status: hasExport && exportStage === 'ready'
        ? seedanceAssetCounts.placeholder > 0 ? 'needs_action' : 'ready'
        : hasExport ? 'needs_action' : 'blocked',
      score: clampScore((hasExport && exportStage === 'ready' ? 100 : hasExport ? 70 : 25) - (seedanceAssetCounts.placeholder > 0 ? 10 : 0)),
      detail: hasExport
        ? seedanceAssetCounts.placeholder > 0
          ? `最近交付包阶段：${exportStage || 'unknown'}；仍有 ${seedanceAssetCounts.placeholder} 个占位参考图需替换。`
          : `最近交付包阶段：${exportStage || 'unknown'}。`
        : '当前版本尚未记录交付包导出。',
      count_text: hasExport ? `files ${asNumber(exportRecord.file_count, 0)}` : 'not exported',
      evidence: [
        hasExport ? `exported ${asString(exportRecord.exported_at)}` : 'no export record',
        `seedance_placeholder_assets ${seedanceAssetCounts.placeholder}`,
        `seedance_production_assets_ready ${seedanceAssetCounts.productionReady}`,
      ],
      action_key: hasExport && exportStage === 'ready' ? undefined : 'export_production_board',
      action_label: hasExport && exportStage === 'ready' ? undefined : '导出交付包',
    },
    {
      key: 'shot_production',
      label: 'Shot Ledger',
      status: totalShotCount === 0 ? 'blocked' : shots.failed > 0 ? 'blocked' : shots.active > 0 ? 'needs_action' : shots.ready >= totalShotCount && totalShotCount > 0 ? 'ready' : 'needs_action',
      score: totalShotCount > 0 ? clampScore((shots.ready / totalShotCount) * 100 - shots.failed * 15) : 0,
      detail: `ready ${shots.ready}，active ${shots.active}，failed ${shots.failed}。`,
      count_text: `ready ${shots.ready}/${totalShotCount}`,
      evidence: [`ledger_items ${shots.total}`],
      action_key: shots.failed > 0 ? 'export_retry_package' : shots.active > 0 ? 'sync_gears_jobs' : undefined,
      action_label: shots.failed > 0 ? '导出重试包' : shots.active > 0 ? '同步状态' : undefined,
    },
    {
      key: 'gears_execution',
      label: 'GEARS Execution',
      status: gearsSummary.total === 0
        ? 'needs_action'
        : gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled + gearsSummary.missing_artifact > 0
          ? 'blocked'
          : gearsSummary.active > 0 || gearsSummary.poll_failure > 0 || gearsSummary.ready_without_external_artifact > 0
            ? 'needs_action'
            : 'ready',
      score: gearsSummary.total === 0 ? 40 : clampScore(
        (gearsSummary.external_ready / gearsSummary.total) * 100
        + (gearsSummary.local_acceptance_ready / gearsSummary.total) * 65
        - (gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled) * 20
        - gearsSummary.missing_artifact * 20,
      ),
      detail: `jobs ${gearsSummary.total}，external ready ${gearsSummary.external_ready}，local acceptance ${gearsSummary.local_acceptance_ready}，active ${gearsSummary.active}。`,
      count_text: `jobs ${gearsSummary.total}`,
      evidence: [
        `external_ready ${gearsSummary.external_ready}`,
        `local_acceptance_ready ${gearsSummary.local_acceptance_ready}`,
        `ready_without_external ${gearsSummary.ready_without_external_artifact}`,
        `missing_artifact ${gearsSummary.missing_artifact}`,
        `poll_failure ${gearsSummary.poll_failure}`,
      ],
      action_key: gearsSummary.total === 0
        ? 'submit_gears_jobs'
        : gearsSummary.active > 0
          ? 'sync_gears_jobs'
          : gearsSummary.ready_without_external_artifact > 0
            ? 'export_gears_external_callback_handoff'
            : undefined,
      action_label: gearsSummary.total === 0
        ? '提交 GEARS'
        : gearsSummary.active > 0
          ? '同步 GEARS'
          : gearsSummary.ready_without_external_artifact > 0
            ? '导出真实回片交接包'
            : undefined,
    },
    {
      key: 'commercial_ops',
      label: 'Commercial Workbench',
      status: hasExport
        && gearsSummary.total > 0
        && gearsSummary.ready_without_external_artifact === 0
        && issues.every(issue => issue.severity !== 'blocking')
        ? 'ready'
        : 'needs_action',
      score: clampScore(
        (hasExport ? 40 : 10)
        + (gearsSummary.total > 0 ? (gearsSummary.external_ready / gearsSummary.total) * 40 : 10)
        + (qualityPassed ? 20 : 0),
      ),
      detail: hasExport && gearsSummary.total > 0
        ? gearsSummary.ready_without_external_artifact > 0
          ? `${gearsSummary.ready_without_external_artifact} 个 GEARS job 仍缺真实外部 artifact。`
          : '交付包、GEARS 账本和真实外部 artifact 已具备。'
        : '商业中台还缺交付包或 GEARS 账本。',
      count_text: `export ${hasExport ? 1 : 0} / gears ${gearsSummary.total}`,
      evidence: [`project_status ${asString(project.status)}`],
      action_key: !hasExport
        ? 'export_production_board'
        : gearsSummary.total === 0
          ? 'submit_gears_jobs'
          : gearsSummary.ready_without_external_artifact > 0
            ? 'export_gears_external_callback_handoff'
            : undefined,
      action_label: !hasExport
        ? '导出交付包'
        : gearsSummary.total === 0
          ? '提交 GEARS'
          : gearsSummary.ready_without_external_artifact > 0
            ? '导出真实回片交接包'
            : undefined,
    },
  ];
  const automationLedger = normalizeAutomationRunLedger(project.production_readiness_automation_ledger);

  const base: Omit<ProductionReadinessReport, 'markdown'> = {
    schema_version: 'mcp-production-readiness/v1',
    scope: 'story_project',
    project_id: projectId,
    title: asString(story.title, asString(project.title, projectId)),
    generated_at: new Date().toISOString(),
    summary: buildSummary({
      lanes,
      issues,
      actions,
      qualityScore,
      totalShotCount,
      readyShotCount: shots.ready,
      failedShotCount: shots.failed,
      seedancePlaceholderAssetCount: seedanceAssetCounts.placeholder,
      seedanceProductionAssetReadyCount: seedanceAssetCounts.productionReady,
      gearsSummary,
    }),
    lanes,
    issues,
    next_actions: actions.sort((a, b) => a.priority - b.priority),
    automation_plan: buildAutomationPlan({
      scope: 'story_project',
      projectId,
      actions,
      issues,
    }),
    automation_ledger: automationLedger,
    latest_automation_run: automationLedger?.latest_run,
  };
  return includeMarkdown ? { ...base, markdown: buildMarkdown(base) } : base;
}

async function buildSeriesReadiness(
  seriesProjectId: string,
  includeMarkdown: boolean,
): Promise<ProductionReadinessReport | null> {
  assertSafeId(seriesProjectId, '系列项目 ID');
  let detail: JsonRecord;
  try {
    detail = await readJsonFile<JsonRecord>(seriesProjectPath(seriesProjectId));
  } catch {
    return null;
  }

  const project = asRecord(detail.project);
  const plan = asRecord(detail.plan);
  const audit = asRecord(detail.series_quality_audit);
  const generatedEpisodeIds = asRecord(detail.generated_episode_story_ids);
  const generatedEpisodeCount = Object.keys(generatedEpisodeIds).length;
  const totalEpisodeCount = asNumber(plan.episode_count, asArray(plan.episodes).length);
  const auditPassed = asBoolean(audit.passed);
  const auditScore = asNumber(audit.score, auditPassed ? 100 : 0);
  const productionItems = asArray(asRecord(detail.seedance_production).items);
  const shots = shotCounts(productionItems);
  const reviewLedger = asRecord(detail.seedance_review_ledger);
  const openReviewCount = asNumber(reviewLedger.open_count, asArray(reviewLedger.items).filter(item => asString(item.status, 'open') === 'open').length);
  const blockingReviewCount = asNumber(reviewLedger.blocking_count, 0);
  const finalDelivery = asRecord(detail.seedance_final_delivery);
  const finalReady = Boolean(finalDelivery.output_path || finalDelivery.manifest_path || asString(finalDelivery.status) === 'ready');
  const gearsSummary = normalizeGearsSummary(detail.gears_job_ledger);

  const issues: ProductionReadinessIssue[] = [];
  const actions: ProductionReadinessNextAction[] = [];

  if (auditPassed !== true) {
    issues.push({
      issue_id: 'series-quality-needs-attention',
      severity: auditScore < 70 ? 'blocking' : 'warning',
      lane_key: 'series_quality',
      label: '系列质量审计需处理',
      detail: asStringArray(audit.issues)[0] ?? '系列质量审计未通过或缺失。',
      action_key: 'rebuild_series_ledger',
      action_label: '重建连续性账本',
    });
    pushAction(actions, {
      action_key: 'rebuild_series_ledger',
      label: '修复系列质量审计',
      detail: '重建连续性账本，并处理长期线索、记忆冲突和分集缺口。',
      priority: 10,
      lane_key: 'series_quality',
    });
  }
  if (generatedEpisodeCount < totalEpisodeCount) {
    issues.push({
      issue_id: 'episodes-not-complete',
      severity: generatedEpisodeCount === 0 ? 'blocking' : 'warning',
      lane_key: 'episode_generation',
      label: `分集生成 ${generatedEpisodeCount}/${totalEpisodeCount}`,
      detail: '系列分集尚未完整生成，无法进入完整商业生产排期。',
      action_key: 'generate_next_episode',
      action_label: '生成下一集',
    });
    pushAction(actions, {
      action_key: 'generate_next_episode',
      label: '继续生成分集',
      detail: `还剩 ${Math.max(0, totalEpisodeCount - generatedEpisodeCount)} 集未生成。`,
      priority: 20,
      lane_key: 'episode_generation',
    });
  }
  if (shots.failed > 0) {
    issues.push({
      issue_id: 'series-shot-production-failed',
      severity: 'blocking',
      lane_key: 'shot_production',
      label: `${shots.failed} 个系列镜头失败`,
      detail: '失败镜头需要导出重试包或重新提交 GEARS。',
      action_key: 'export_retry_package',
      action_label: '导出重试包',
    });
    pushAction(actions, {
      action_key: 'export_retry_package',
      label: '导出系列镜头重试包',
      detail: `${shots.failed} 个系列镜头失败，需要生成 GEARS 重试执行计划。`,
      priority: 40,
      lane_key: 'shot_production',
    });
  }
  if (openReviewCount > 0) {
    issues.push({
      issue_id: 'open-review-items',
      severity: blockingReviewCount > 0 ? 'blocking' : 'warning',
      lane_key: 'review_repair',
      label: `${openReviewCount} 条审片意见未关闭`,
      detail: `其中阻断级 ${blockingReviewCount} 条。`,
      action_key: 'export_review_repair_package',
      action_label: '导出返修包',
    });
    pushAction(actions, {
      action_key: 'export_review_repair_package',
      label: '导出审片返修包',
      detail: '把 open review 转为返修/重试执行计划。',
      priority: 45,
      lane_key: 'review_repair',
    });
  }
  if (gearsSummary.total === 0) {
    issues.push({
      issue_id: 'series-gears-ledger-empty',
      severity: 'warning',
      lane_key: 'gears_execution',
      label: '系列尚未建立 GEARS job',
      detail: '系列仍停留在指挥账本层，尚未提交 GEARS v2 执行任务。',
      action_key: 'submit_gears_jobs',
      action_label: '提交 GEARS',
    });
    pushAction(actions, {
      action_key: 'submit_gears_jobs',
      label: '批量提交 GEARS job',
      detail: '按当前 job type 提交视频返修、图片或后期任务。',
      priority: 60,
      lane_key: 'gears_execution',
    });
  }
  if (gearsSummary.active > 0 || gearsSummary.poll_failure > 0) {
    pushAction(actions, {
      action_key: 'sync_gears_jobs',
      label: '同步系列 GEARS 状态',
      detail: `${gearsSummary.active} 个 GEARS job 活跃，${gearsSummary.poll_failure} 个最近轮询失败。`,
      priority: 65,
      lane_key: 'gears_execution',
    });
  }

  const lanes: ProductionReadinessLane[] = [
    {
      key: 'series_quality',
      label: 'MCP Story Agent 闭环',
      status: auditPassed === true ? 'ready' : auditScore < 70 ? 'blocked' : 'needs_action',
      score: clampScore(auditScore),
      detail: auditPassed === true ? '系列质量审计通过。' : '系列质量审计需要处理。',
      count_text: `issues ${asStringArray(audit.issues).length}`,
      evidence: [`episodes_attention ${asNumberArray(audit.episodes_need_attention).join(',') || 'none'}`],
      action_key: auditPassed === true ? undefined : 'rebuild_series_ledger',
      action_label: auditPassed === true ? undefined : '修复质量审计',
    },
    {
      key: 'episode_generation',
      label: 'AI 漫剧系列指挥层',
      status: generatedEpisodeCount === 0 ? 'blocked' : generatedEpisodeCount >= totalEpisodeCount ? 'ready' : 'needs_action',
      score: totalEpisodeCount > 0 ? clampScore((generatedEpisodeCount / totalEpisodeCount) * 100) : 0,
      detail: `已生成 ${generatedEpisodeCount}/${totalEpisodeCount} 集。`,
      count_text: `${generatedEpisodeCount}/${totalEpisodeCount}`,
      evidence: [`series ${seriesProjectId}`],
      action_key: generatedEpisodeCount >= totalEpisodeCount ? undefined : 'generate_next_episode',
      action_label: generatedEpisodeCount >= totalEpisodeCount ? undefined : '生成分集',
    },
    {
      key: 'shot_production',
      label: 'Shot Production',
      status: productionItems.length === 0 ? 'needs_action' : shots.failed > 0 ? 'blocked' : shots.active > 0 ? 'needs_action' : shots.ready >= shots.total ? 'ready' : 'needs_action',
      score: productionItems.length > 0 ? clampScore((shots.ready / shots.total) * 100 - shots.failed * 15) : 35,
      detail: `ready ${shots.ready}，active ${shots.active}，failed ${shots.failed}。`,
      count_text: `ready ${shots.ready}/${shots.total}`,
      evidence: [`production_items ${productionItems.length}`],
      action_key: shots.failed > 0 ? 'export_retry_package' : shots.active > 0 ? 'sync_gears_jobs' : undefined,
      action_label: shots.failed > 0 ? '导出重试包' : shots.active > 0 ? '同步状态' : undefined,
    },
    {
      key: 'delivery_contract',
      label: 'Delivery Contract',
      status: finalReady ? 'ready' : 'needs_action',
      score: finalReady ? 100 : 45,
      detail: finalReady ? '最终交付 manifest/输出已记录。' : '最终交付仍处于计划/账本阶段。',
      count_text: finalReady ? 'final ready' : 'final pending',
      evidence: [finalReady ? 'final_delivery ready' : 'no final output'],
      action_key: finalReady ? undefined : 'export_editing_platform_package',
      action_label: finalReady ? undefined : '导出剪辑交付包',
    },
    {
      key: 'review_repair',
      label: '审片返修',
      status: blockingReviewCount > 0 ? 'blocked' : openReviewCount > 0 ? 'needs_action' : 'ready',
      score: clampScore(100 - openReviewCount * 8 - blockingReviewCount * 15),
      detail: `open ${openReviewCount}，blocking ${blockingReviewCount}。`,
      count_text: `open ${openReviewCount}`,
      evidence: [`final_reassemble ${String(reviewLedger.final_reassemble_required ?? false)}`],
      action_key: openReviewCount > 0 ? 'export_review_repair_package' : undefined,
      action_label: openReviewCount > 0 ? '导出返修包' : undefined,
    },
    {
      key: 'gears_execution',
      label: 'GEARS Execution',
      status: gearsSummary.total === 0
        ? 'needs_action'
        : gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled + gearsSummary.missing_artifact > 0
          ? 'blocked'
          : gearsSummary.active > 0 || gearsSummary.ready_without_external_artifact > 0
            ? 'needs_action'
            : 'ready',
      score: gearsSummary.total === 0 ? 40 : clampScore(
        (gearsSummary.external_ready / gearsSummary.total) * 100
        + (gearsSummary.local_acceptance_ready / gearsSummary.total) * 65
        - (gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled) * 20,
      ),
      detail: `jobs ${gearsSummary.total}，external ready ${gearsSummary.external_ready}，local acceptance ${gearsSummary.local_acceptance_ready}，active ${gearsSummary.active}。`,
      count_text: `jobs ${gearsSummary.total}`,
      evidence: [
        `external_ready ${gearsSummary.external_ready}`,
        `local_acceptance_ready ${gearsSummary.local_acceptance_ready}`,
        `ready_without_external ${gearsSummary.ready_without_external_artifact}`,
        `missing_artifact ${gearsSummary.missing_artifact}`,
        `poll_failure ${gearsSummary.poll_failure}`,
      ],
      action_key: gearsSummary.total === 0
        ? 'submit_gears_jobs'
        : gearsSummary.active > 0 || gearsSummary.ready_without_external_artifact > 0
          ? 'sync_gears_jobs'
          : undefined,
      action_label: gearsSummary.total === 0
        ? '提交 GEARS'
        : gearsSummary.active > 0 || gearsSummary.ready_without_external_artifact > 0
          ? '同步 GEARS'
          : undefined,
    },
    {
      key: 'commercial_ops',
      label: '可商用制作中台',
      status: generatedEpisodeCount >= totalEpisodeCount
        && gearsSummary.total > 0
        && gearsSummary.ready_without_external_artifact === 0
        && issues.every(issue => issue.severity !== 'blocking')
        ? 'ready'
        : 'needs_action',
      score: clampScore(
        (generatedEpisodeCount >= totalEpisodeCount ? 30 : 10)
        + (gearsSummary.total > 0 ? (gearsSummary.external_ready / gearsSummary.total) * 30 : 10)
        + (finalReady ? 25 : 5)
        + (openReviewCount === 0 ? 15 : 0),
      ),
      detail: generatedEpisodeCount >= totalEpisodeCount && gearsSummary.total > 0
        ? gearsSummary.ready_without_external_artifact > 0
          ? '系列 GEARS 账本仍缺真实外部 artifact。'
          : '系列已具备商业运营跟踪基础。'
        : '仍缺完整分集、GEARS 账本或最终交付。',
      count_text: `episodes ${generatedEpisodeCount}/${totalEpisodeCount} / gears ${gearsSummary.total}`,
      evidence: [`project_status ${asString(project.status)}`],
      action_key: generatedEpisodeCount < totalEpisodeCount ? 'generate_next_episode' : gearsSummary.total === 0 ? 'submit_gears_jobs' : undefined,
      action_label: generatedEpisodeCount < totalEpisodeCount ? '生成分集' : gearsSummary.total === 0 ? '提交 GEARS' : undefined,
    },
  ];
  const automationLedger = normalizeAutomationRunLedger(detail.production_readiness_automation_ledger);

  const base: Omit<ProductionReadinessReport, 'markdown'> = {
    schema_version: 'mcp-production-readiness/v1',
    scope: 'ai_comic_series',
    project_id: seriesProjectId,
    title: asString(plan.series_title, asString(project.title, seriesProjectId)),
    generated_at: new Date().toISOString(),
    summary: buildSummary({
      lanes,
      issues,
      actions,
      qualityScore: auditScore,
      generatedEpisodeCount,
      totalEpisodeCount,
      totalShotCount: shots.total,
      readyShotCount: shots.ready,
      failedShotCount: shots.failed,
      seedancePlaceholderAssetCount: 0,
      seedanceProductionAssetReadyCount: 0,
      gearsSummary,
    }),
    lanes,
    issues,
    next_actions: actions.sort((a, b) => a.priority - b.priority),
    automation_plan: buildAutomationPlan({
      scope: 'ai_comic_series',
      projectId: seriesProjectId,
      actions,
      issues,
    }),
    automation_ledger: automationLedger,
    latest_automation_run: automationLedger?.latest_run,
  };
  return includeMarkdown ? { ...base, markdown: buildMarkdown(base) } : base;
}

export async function getProductionReadiness(
  input: GetProductionReadinessInput,
): Promise<ProductionReadinessReport | null> {
  const includeMarkdown = input.include_markdown ?? true;
  if (input.project_id?.trim()) return buildStoryProjectReadiness(input.project_id.trim(), includeMarkdown);
  if (input.series_project_id?.trim()) return buildSeriesReadiness(input.series_project_id.trim(), includeMarkdown);
  throw new Error('必须提供 project_id 或 series_project_id');
}
