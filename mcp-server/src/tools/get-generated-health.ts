import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import {
  inspectStoryGenerationActivity,
  type StoryGenerationActivityEvidence,
} from '../lib/story-generation-activity.js';

type HealthStatus = 'ready' | 'planned' | 'production_gap' | 'interrupted';
type HealthScope = 'story_project' | 'ai_comic_series_project';
type JsonRecord = Record<string, unknown>;

export interface GetStoryAgentGeneratedHealthInput {
  limit?: number;
  include_markdown?: boolean;
}

export interface StoryAgentGeneratedHealthItem {
  scope: HealthScope;
  project_id: string;
  title?: string;
  status: HealthStatus;
  risk_score: number;
  updated_at?: string;
  issue_count: number;
  missing_contracts: string[];
  evidence: string[];
  recommended_actions: string[];
  current_story_id?: string;
  current_version_id?: string;
  version_count?: number;
  scene_count?: number;
  gears_segment_count?: number;
  quality_score?: number;
  episode_count?: number;
  generated_episode_count?: number;
  generated_episode_story_id_count?: number;
  missing_episode_story_id_count?: number;
  production_item_count?: number;
  ready_production_item_count?: number;
  failed_production_item_count?: number;
  test_fixture_failure_item_count?: number;
  seedance_failure_marker_present?: boolean;
  contract_evidence_count?: number;
  relink_candidate?: boolean;
  signoff_eligible?: boolean;
  governance_disposition?: 'soft_archived_signoff_excluded';
  cut_ready?: boolean;
  subtitle_ready?: boolean;
  thumbnail_ready_count?: number;
  final_delivery_ready?: boolean;
  final_delivery_manifest_ready?: boolean;
  final_delivery_manifest_missing?: boolean;
  final_delivery_dry_run?: boolean;
}

export interface StoryAgentGeneratedHealthReport {
  schema_version: 'mcp-story-agent-generated-health/v1';
  generated_at: string;
  generation_activity: StoryGenerationActivityEvidence;
  summary: {
    scanned_story_project_count: number;
    scanned_series_project_count: number;
    total_target_count: number;
    ready_count: number;
    planned_count: number;
    production_gap_count: number;
    interrupted_count: number;
    missing_current_story_count: number;
    missing_scene_breakdown_count: number;
    missing_gears_segments_count: number;
    missing_quality_count: number;
    missing_episode_story_id_count: number;
    series_missing_delivery_count: number;
    series_missing_postproduction_count: number;
    series_missing_final_delivery_manifest_count: number;
    series_ready_count?: number;
    series_planned_only_count?: number;
    series_production_gap_count?: number;
    series_interrupted_count?: number;
    series_governance_attention_count?: number;
    series_missing_story_ref_project_count?: number;
    series_contract_evidence_count?: number;
    series_relink_candidate_count?: number;
    series_signoff_portfolio_count?: number;
    series_soft_archive_excluded_count?: number;
    series_seedance_failed_project_count?: number;
    series_seedance_failed_item_count?: number;
    series_seedance_failure_marker_project_count?: number;
    series_seedance_test_fixture_failure_project_count?: number;
    series_seedance_test_fixture_failure_item_count?: number;
  };
  items: StoryAgentGeneratedHealthItem[];
  notes: string[];
  markdown?: string;
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || path.resolve(getKbRoot(), '..', 'web', 'generated');
}

async function readSignoffExcludedSeriesIds(): Promise<Set<string>> {
  try {
    const manifestPath = process.env.STORY_AGENT_SOFT_ARCHIVE_MANIFEST_PATH
      || path.resolve(getKbRoot(), 'reports', 'story-agent-soft-archive-manifest-20260710.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as JsonRecord;
    const policy = asRecord(manifest.policy);
    if (asString(manifest.mode) !== 'active_signoff_exclusion'
      || policy.signoff_exclusion_applied !== true) {
      return new Set();
    }
    return new Set(asArray(manifest.entries)
      .map(asRecord)
      .filter(item => asString(item.execution_status) === 'signoff_exclusion_active')
      .map(item => asString(item.project_id))
      .filter((item): item is string => Boolean(item)));
  } catch {
    return new Set();
  }
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readJson(filePath: string): Promise<JsonRecord | undefined> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function listProjectRecords(folder: string): Promise<Array<{ dir: string; id: string; record: JsonRecord }>> {
  try {
    const root = path.resolve(generatedRoot(), folder);
    const entries = await fs.readdir(root, { withFileTypes: true });
    const records: Array<{ dir: string; id: string; record: JsonRecord }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.resolve(root, entry.name);
      const record = await readJson(path.resolve(dir, 'project.json'));
      if (!record) continue;
      records.push({ dir, id: entry.name, record });
    }
    return records;
  } catch {
    return [];
  }
}

async function listStoryIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const root = path.resolve(generatedRoot(), 'stories');
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        ids.add(entry.name.replace(/\.json$/, ''));
        continue;
      }
      if (!entry.isDirectory()) continue;
      const files = await fs.readdir(path.resolve(root, entry.name), { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.json')) ids.add(file.name.replace(/\.json$/, ''));
      }
    }
  } catch {
    // no stories directory yet
  }
  return ids;
}

async function readVersions(projectDir: string): Promise<JsonRecord[]> {
  try {
    const versionsDir = path.resolve(projectDir, 'versions');
    const files = await fs.readdir(versionsDir, { withFileTypes: true });
    const records: JsonRecord[] = [];
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;
      const record = await readJson(path.resolve(versionsDir, file.name));
      if (record) records.push(record);
    }
    return records;
  } catch {
    return [];
  }
}

function riskScore(status: HealthStatus, issueCount: number): number {
  if (status === 'interrupted') return Math.min(100, 88 + issueCount * 3);
  if (status === 'production_gap') return Math.min(87, 55 + issueCount * 5);
  if (status === 'planned') return Math.min(45, 18 + issueCount * 4);
  return Math.max(0, 8 - issueCount);
}

function statusRank(status: HealthStatus): number {
  if (status === 'interrupted') return 0;
  if (status === 'production_gap') return 1;
  if (status === 'planned') return 2;
  return 3;
}

function qualityScore(report: JsonRecord): number | undefined {
  return asNumber(
    report.genre_score
      ?? report.score
      ?? asRecord(report.gears_readiness_report).readiness_score
      ?? asRecord(report.outline_coverage_report).coverage_score,
  );
}

async function storyHealth(input: { dir: string; id: string; record: JsonRecord }): Promise<StoryAgentGeneratedHealthItem> {
  const versions = await readVersions(input.dir);
  const currentVersionId = asString(input.record.current_version_id);
  const currentStoryId = asString(input.record.current_story_id ?? input.record.story_id);
  const currentVersion = versions.find(version => asString(version.version_id) === currentVersionId);
  const story = asRecord(currentVersion?.story);
  const quality = isRecord(currentVersion?.quality_report) ? asRecord(currentVersion?.quality_report) : asRecord(story.quality_report);
  const sceneCount = asArray(story.scene_breakdown).length;
  const gearsSegmentCount = asArray(story.gears_segments).length;
  const missing = new Set<string>();
  if (!currentVersionId || !currentVersion) missing.add('current_version');
  if (!currentStoryId || !Object.keys(story).length) missing.add('current_story');
  const versionStoryId = asString(story.storyId);
  if (currentStoryId && versionStoryId && versionStoryId !== currentStoryId) {
    missing.add('current_story');
  }
  if (Object.keys(story).length && sceneCount === 0) missing.add('scene_breakdown');
  if (Object.keys(story).length && gearsSegmentCount === 0) missing.add('gears_segments');
  if (Object.keys(story).length && !Object.keys(quality).length) missing.add('quality_report');
  if (Object.keys(story).length && !isRecord(story.gears_delivery) && !isRecord(currentVersion?.production_board_export)) {
    missing.add('delivery_contract');
  }
  const status: HealthStatus = missing.has('current_version') || missing.has('current_story')
    ? 'interrupted'
    : missing.size > 0
      ? 'production_gap'
      : 'ready';
  return {
    scope: 'story_project',
    project_id: asString(input.record.project_id ?? input.record.story_project_id) ?? input.id,
    title: asString(input.record.title ?? story.title),
    status,
    risk_score: riskScore(status, missing.size),
    updated_at: asString(input.record.updated_at ?? input.record.created_at),
    issue_count: missing.size,
    missing_contracts: [...missing],
    evidence: [
      `versions=${versions.length}`,
      currentVersionId ? `current_version_id=${currentVersionId}` : 'current_version_id=missing',
      currentStoryId ? `current_story_id=${currentStoryId}` : 'current_story_id=missing',
      currentStoryId && versionStoryId && versionStoryId !== currentStoryId
        ? `current_story_id=${currentStoryId} but version storyId=${versionStoryId}`
        : '',
      Object.keys(story).length ? `scenes=${sceneCount}, gears_segments=${gearsSegmentCount}` : 'story=missing',
    ].filter(Boolean),
    recommended_actions: status === 'interrupted'
      ? ['修复 current_version/current_story 引用，或重建当前版本快照。']
      : ['补齐 Story Agent 质量、GEARS delivery 或 Production Board 合同。'],
    current_story_id: currentStoryId,
    current_version_id: currentVersionId,
    version_count: asNumber(input.record.version_count) ?? versions.length,
    scene_count: Object.keys(story).length ? sceneCount : undefined,
    gears_segment_count: Object.keys(story).length ? gearsSegmentCount : undefined,
    quality_score: qualityScore(quality),
  };
}

function generatedStoryIds(record: JsonRecord): string[] {
  if (Array.isArray(record.generated_episode_story_ids)) {
    return record.generated_episode_story_ids.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  }
  const ids = asRecord(record.generated_episode_story_ids);
  return Object.values(ids).filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function ledgerUsable(record: JsonRecord): boolean {
  const status = asString(record.status);
  return status === 'ready' || status === 'planned';
}

function hasOutput(record: JsonRecord, fields: string[]): boolean {
  return fields.some(field => Boolean(asString(record[field])));
}

function productionFailureIsMarkedTestFixture(item: JsonRecord): boolean {
  const failureReason = asString(item.failure_reason) ?? '';
  const noteText = asArray(item.notes).filter(value => typeof value === 'string').join(' ');
  return failureReason.includes('测试标记')
    || noteText.includes('测试标记')
    || (asString(item.provider_job_id) === 'seedance-job-failed' && noteText.includes('测试'));
}

function seriesHealth(
  input: { id: string; record: JsonRecord },
  availableStoryIds: Set<string>,
  signoffExcludedSeriesIds: Set<string>,
): StoryAgentGeneratedHealthItem {
  const project = Object.keys(asRecord(input.record.project)).length ? asRecord(input.record.project) : input.record;
  const plan = asRecord(input.record.plan);
  const projectId = asString(project.series_project_id ?? input.record.series_project_id) ?? input.id;
  const signoffExcluded = signoffExcludedSeriesIds.has(projectId);
  const storyIds = generatedStoryIds(input.record);
  const episodeCount = asNumber(project.episode_count ?? plan.episode_count) ?? asArray(plan.episodes).length;
  const generatedEpisodeCount = asNumber(project.generated_episode_count) ?? storyIds.length;
  const missingEpisodeStoryIdCount = storyIds.filter(id => !availableStoryIds.has(id)).length;
  const productionItems = asArray(asRecord(input.record.seedance_production).items).filter(isRecord);
  const readyProductionItems = productionItems.filter(item => asString(item.status) === 'ready' && Boolean(asString(item.video_url)));
  const failedProductionItems = productionItems.filter(item => asString(item.status) === 'failed');
  const testFixtureFailureItems = failedProductionItems.filter(productionFailureIsMarkedTestFixture);
  const thumbnailReadyCount = productionItems.filter(item => asString(asRecord(item.thumbnail).status) === 'ready').length;
  const cut = asRecord(input.record.seedance_cut_assembly);
  const subtitle = asRecord(input.record.seedance_subtitle_render);
  const finalDelivery = asRecord(input.record.seedance_final_delivery);
  const hasGearsJobLedger = isRecord(input.record.gears_job_ledger);
  const cutReady = ledgerUsable(cut) && hasOutput(cut, ['output_path', 'concat_list_path']);
  const subtitleReady = ledgerUsable(subtitle) && hasOutput(subtitle, ['output_path', 'srt_path']);
  const finalDeliveryOutputDeclared = ledgerUsable(finalDelivery) && hasOutput(finalDelivery, ['output_path']);
  const finalDeliveryManifestReady = ledgerUsable(finalDelivery) && hasOutput(finalDelivery, ['manifest_path']);
  const finalDeliveryReady = finalDeliveryOutputDeclared && finalDeliveryManifestReady;
  const finalDeliveryManifestMissing = finalDeliveryOutputDeclared && !finalDeliveryManifestReady;
  const finalDeliveryDryRun = finalDelivery.dry_run === true;
  const contractEvidence = [
    productionItems.length > 0 ? 'seedance_production' : '',
    hasGearsJobLedger ? 'gears_job_ledger' : '',
    thumbnailReadyCount > 0 ? 'thumbnails' : '',
    cutReady ? 'cut_assembly' : '',
    subtitleReady ? 'subtitle_render' : '',
    finalDeliveryReady ? 'final_delivery' : finalDeliveryOutputDeclared ? 'final_delivery_plan' : '',
  ].filter(Boolean);
  const relinkCandidate = missingEpisodeStoryIdCount > 0 && contractEvidence.length > 0;
  const missing = new Set<string>();
  if (missingEpisodeStoryIdCount > 0) missing.add('generated_episode_story_refs');
  if (generatedEpisodeCount > 0 && generatedEpisodeCount < episodeCount) missing.add('remaining_episodes');
  if (generatedEpisodeCount > 0 && productionItems.length === 0) missing.add('shot_production_ledger');
  if (productionItems.length > 0 && readyProductionItems.length === 0) missing.add('shot_returns');
  if (readyProductionItems.length > 0 && thumbnailReadyCount < readyProductionItems.length) missing.add('thumbnails');
  if (readyProductionItems.length > 0 && !cutReady) missing.add('cut_assembly');
  if (cutReady && !subtitleReady) missing.add('subtitles');
  if (cutReady && finalDeliveryManifestMissing) missing.add('final_delivery_manifest');
  else if (cutReady && !finalDeliveryReady) missing.add('final_delivery');
  if (generatedEpisodeCount > 0 && !hasGearsJobLedger && productionItems.length === 0) missing.add('series_delivery');
  const status: HealthStatus = generatedEpisodeCount === 0 && storyIds.length === 0
    ? 'planned'
    : missingEpisodeStoryIdCount > 0
      ? 'interrupted'
      : missing.size > 0
        ? 'production_gap'
        : 'ready';
  return {
    scope: 'ai_comic_series_project',
    project_id: projectId,
    title: asString(project.title ?? plan.series_title),
    status,
    risk_score: riskScore(status, missing.size),
    updated_at: asString(project.updated_at ?? input.record.updated_at),
    issue_count: missing.size,
    missing_contracts: [...missing],
    evidence: [
      `episodes=${generatedEpisodeCount}/${episodeCount}`,
      `generated_episode_story_ids=${storyIds.length}`,
      `production_items=${productionItems.length}`,
      `failed_production_items=${failedProductionItems.length}, test_fixture_failures=${testFixtureFailureItems.length}`,
      `contract_evidence=${contractEvidence.join(',') || 'none'}`,
      `cut_ready=${cutReady}, subtitle_ready=${subtitleReady}, final_delivery_ready=${finalDeliveryReady}, final_delivery_manifest_ready=${finalDeliveryManifestReady}, final_delivery_dry_run=${finalDeliveryDryRun}`,
      `signoff_eligible=${!signoffExcluded}`,
    ],
    recommended_actions: signoffExcluded
      ? [
          '该历史样本已通过可逆 manifest 排除出 GEARS signoff portfolio；原项目文件保持不变。',
          '如需恢复，先进入人工重建白名单并按当前 Story Agent 合同生成新版本。',
        ]
      : status === 'planned'
        ? ['生成第一集分集故事，再导出 GEARS delivery 与系列生产指挥包。']
        : missing.has('final_delivery_manifest')
          ? ['重跑 final delivery dry-run/导出以生成 manifest；concat.txt 只是装配计划，不得作为可发布交付。']
          : ['补齐系列 GEARS delivery、镜头生产账本或后期生产指令包。'],
    episode_count: episodeCount,
    generated_episode_count: generatedEpisodeCount,
    generated_episode_story_id_count: storyIds.length,
    missing_episode_story_id_count: missingEpisodeStoryIdCount,
    production_item_count: productionItems.length,
    ready_production_item_count: readyProductionItems.length,
    failed_production_item_count: failedProductionItems.length,
    test_fixture_failure_item_count: testFixtureFailureItems.length,
    seedance_failure_marker_present: JSON.stringify(input.record).includes('seedance-job-failed'),
    contract_evidence_count: contractEvidence.length,
    relink_candidate: relinkCandidate,
    signoff_eligible: !signoffExcluded,
    governance_disposition: signoffExcluded ? 'soft_archived_signoff_excluded' : undefined,
    cut_ready: cutReady,
    subtitle_ready: subtitleReady,
    thumbnail_ready_count: thumbnailReadyCount,
    final_delivery_ready: finalDeliveryReady,
    final_delivery_manifest_ready: finalDeliveryManifestReady,
    final_delivery_manifest_missing: finalDeliveryManifestMissing,
    final_delivery_dry_run: finalDeliveryDryRun,
  };
}

function count(items: StoryAgentGeneratedHealthItem[], status: HealthStatus): number {
  return items.filter(item => item.status === status).length;
}

function countMissing(items: StoryAgentGeneratedHealthItem[], contract: string, scope?: HealthScope): number {
  return items.filter(item => (!scope || item.scope === scope) && item.missing_contracts.includes(contract)).length;
}

function buildMarkdown(report: Omit<StoryAgentGeneratedHealthReport, 'markdown'>): string {
  const activity = report.generation_activity;
  return [
    '# MCP Story Agent Generated Health',
    '',
    `> generatedAt: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- total targets: ${report.summary.total_target_count}`,
    `- ready: ${report.summary.ready_count}`,
    `- planned: ${report.summary.planned_count}`,
    `- production_gap: ${report.summary.production_gap_count}`,
    `- interrupted: ${report.summary.interrupted_count}`,
    `- series_governance_attention: ${report.summary.series_governance_attention_count ?? 0}`,
    `- series_missing_story_ref_projects: ${report.summary.series_missing_story_ref_project_count ?? 0}`,
    `- series_contract_evidence: ${report.summary.series_contract_evidence_count ?? 0}`,
    `- series_relink_candidates: ${report.summary.series_relink_candidate_count ?? 0}`,
    `- series_signoff_portfolio: ${report.summary.series_signoff_portfolio_count ?? 0}`,
    `- series_soft_archive_excluded: ${report.summary.series_soft_archive_excluded_count ?? 0}`,
    `- series_seedance_failed_projects: ${report.summary.series_seedance_failed_project_count ?? 0}`,
    `- series_seedance_failed_items: ${report.summary.series_seedance_failed_item_count ?? 0}`,
    `- series_seedance_failure_marker_projects: ${report.summary.series_seedance_failure_marker_project_count ?? 0}`,
    `- series_seedance_test_fixture_failure_projects: ${report.summary.series_seedance_test_fixture_failure_project_count ?? 0}`,
    `- series_seedance_test_fixture_failure_items: ${report.summary.series_seedance_test_fixture_failure_item_count ?? 0}`,
    `- series_missing_final_delivery_manifest: ${report.summary.series_missing_final_delivery_manifest_count}`,
    '',
    '## Generation Activity',
    '',
    `- diagnosis: ${activity.diagnosis}`,
    `- latest_persisted_activity_kind: ${activity.latest_persisted_activity_kind}`,
    `- latest_story_id: ${activity.latest_story?.story_id ?? 'none'}`,
    `- latest_story_created_at: ${activity.latest_story?.created_at ?? 'none'}`,
    `- latest_project_version: ${activity.latest_project_version?.version_id ?? 'none'}`,
    `- project_revisions_after_latest_story: ${activity.summary.project_revision_after_latest_story_count}`,
    `- reports_after_latest_story: ${activity.summary.report_after_latest_story_count}`,
    `- pending_transactions: ${activity.summary.pending_transaction_count}`,
    `- legacy_stories: ${activity.summary.legacy_story_count}`,
    `- durable_attempt_history: ${activity.signals.durable_generation_attempt_history_available}`,
    `- latest_generation_attempt_id: ${activity.latest_generation_attempt?.attempt_id ?? 'none'}`,
    `- latest_generation_attempt_status: ${activity.latest_generation_attempt?.status ?? 'none'}`,
    `- generation_attempts: ${activity.summary.generation_attempt_count}`,
    `- generation_attempt_failures: ${activity.summary.generation_attempt_failed_count}`,
    `- generation_attempts_incomplete: ${activity.summary.generation_attempt_incomplete_count}`,
    `- attempt_audit_readiness: ${activity.attempt_audit_readiness.status}`,
    `- attempt_audit_history_integrity: ${activity.attempt_audit_readiness.history_integrity}`,
    `- attempt_audit_lock_status: ${activity.attempt_audit_readiness.lock_status}`,
    `- attempt_audit_current_file_bytes: ${activity.attempt_audit_readiness.current_file_bytes}`,
    `- attempt_audit_archive_count: ${activity.attempt_audit_readiness.archive_count}`,
    `- attempt_audit_lock_timeout_ms: ${activity.attempt_audit_readiness.configured_lock_timeout_ms}`,
    `- attempt_audit_lock_retry_ms: ${activity.attempt_audit_readiness.configured_lock_retry_ms}`,
    `- attempt_audit_lock_stale_ms: ${activity.attempt_audit_readiness.configured_lock_stale_ms}`,
    `- attempt_audit_configuration_valid: ${activity.attempt_audit_readiness.configuration_valid}`,
    `- attempt_audit_configuration_warnings: ${activity.attempt_audit_readiness.configuration_warnings.join(', ') || 'none'}`,
    `- attempt_audit_permission_policy: ${activity.attempt_audit_readiness.permission_policy}`,
    `- attempt_audit_permission_policy_satisfied: ${activity.attempt_audit_readiness.permission_policy_satisfied}`,
    `- attempt_audit_event_file_sync_required: ${activity.attempt_audit_readiness.event_file_sync_required}`,
    `- attempt_audit_no_follow_open_required: ${activity.attempt_audit_readiness.no_follow_open_required}`,
    `- attempt_audit_directory_entry_sync_guaranteed: ${activity.attempt_audit_readiness.directory_entry_sync_guaranteed}`,
    `- attempt_audit_blockers: ${activity.attempt_audit_readiness.blockers.join(', ') || 'none'}`,
    `- attempt_audit_operator_actions: ${activity.attempt_audit_readiness.operator_actions.join(', ') || 'none'}`,
    `- attempt_audit_automatic_repair_allowed: ${activity.attempt_audit_readiness.automatic_repair_allowed}`,
    `- attempt_audit_destructive_action_performed: ${activity.attempt_audit_readiness.destructive_action_performed}`,
    `- no_generation_request_confirmed: ${activity.signals.no_generation_request_confirmed}`,
    `- generation_pipeline_failure_confirmed: ${activity.signals.generation_pipeline_failure_confirmed}`,
    `- generation_attempt_incomplete_detected: ${activity.signals.generation_attempt_incomplete_detected}`,
    `- generated_files_modified: ${activity.safety.generated_files_modified}`,
    `- model_invoked: ${activity.safety.model_invoked}`,
    '',
    '## Priority Items',
    '',
    ...(report.items.length
      ? report.items.map(item => `- P${item.risk_score} · ${item.scope} · ${item.status} · ${item.project_id} · ${item.missing_contracts.join(', ') || 'none'}`)
      : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n');
}

export async function getStoryAgentGeneratedHealth(
  input: GetStoryAgentGeneratedHealthInput = {},
): Promise<StoryAgentGeneratedHealthReport> {
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(Math.floor(input.limit ?? 30), 100)) : 30;
  const [storyRecords, seriesRecords, storyIds, signoffExcludedSeriesIds, generationActivity] = await Promise.all([
    listProjectRecords('projects'),
    listProjectRecords('ai-comic-series-projects'),
    listStoryIds(),
    readSignoffExcludedSeriesIds(),
    inspectStoryGenerationActivity({ generatedRoot: generatedRoot(), kbRoot: getKbRoot() }),
  ]);
  const storyItems = await Promise.all(storyRecords.map(storyHealth));
  const seriesItems = seriesRecords.map(record => seriesHealth(record, storyIds, signoffExcludedSeriesIds));
  const countSeriesStatus = (status: HealthStatus) => seriesItems.filter(item => item.status === status).length;
  const seriesPlannedOnlyCount = countSeriesStatus('planned');
  const seriesProductionGapCount = countSeriesStatus('production_gap');
  const seriesInterruptedCount = countSeriesStatus('interrupted');
  const seriesGovernanceAttentionCount = seriesItems.filter(item =>
    item.signoff_eligible !== false && item.status !== 'ready'
  ).length;
  const seriesSoftArchiveExcludedCount = seriesItems.filter(item => item.signoff_eligible === false).length;
  const seriesSignoffPortfolioCount = seriesItems.length - seriesSoftArchiveExcludedCount;
  const seriesMissingStoryRefProjectCount = seriesItems.filter(item => (item.missing_episode_story_id_count ?? 0) > 0).length;
  const seriesContractEvidenceCount = seriesItems.filter(item => (item.contract_evidence_count ?? 0) > 0).length;
  const seriesRelinkCandidateCount = seriesItems.filter(item => item.relink_candidate).length;
  const seriesSeedanceFailedProjectCount = seriesItems.filter(item => (item.failed_production_item_count ?? 0) > 0).length;
  const seriesSeedanceFailedItemCount = seriesItems.reduce((sum, item) => sum + (item.failed_production_item_count ?? 0), 0);
  const seriesSeedanceFailureMarkerProjectCount = seriesItems.filter(item => item.seedance_failure_marker_present).length;
  const seriesSeedanceTestFixtureFailureProjectCount = seriesItems.filter(
    item => (item.test_fixture_failure_item_count ?? 0) > 0,
  ).length;
  const seriesSeedanceTestFixtureFailureItemCount = seriesItems.reduce(
    (sum, item) => sum + (item.test_fixture_failure_item_count ?? 0),
    0,
  );
  const allItems = [...storyItems, ...seriesItems].sort((a, b) => (
    Number(a.signoff_eligible === false) - Number(b.signoff_eligible === false)
    || Number(b.final_delivery_manifest_missing === true) - Number(a.final_delivery_manifest_missing === true)
    || statusRank(a.status) - statusRank(b.status)
    || b.risk_score - a.risk_score
    || (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
  ));
  const items = allItems.slice(0, limit);
  const base: Omit<StoryAgentGeneratedHealthReport, 'markdown'> = {
    schema_version: 'mcp-story-agent-generated-health/v1',
    generated_at: new Date().toISOString(),
    generation_activity: generationActivity,
    summary: {
      scanned_story_project_count: storyRecords.length,
      scanned_series_project_count: seriesRecords.length,
      total_target_count: allItems.length,
      ready_count: count(allItems, 'ready'),
      planned_count: count(allItems, 'planned'),
      production_gap_count: count(allItems, 'production_gap'),
      interrupted_count: count(allItems, 'interrupted'),
      missing_current_story_count: countMissing(allItems, 'current_story', 'story_project'),
      missing_scene_breakdown_count: countMissing(allItems, 'scene_breakdown', 'story_project'),
      missing_gears_segments_count: countMissing(allItems, 'gears_segments', 'story_project'),
      missing_quality_count: countMissing(allItems, 'quality_report', 'story_project'),
      missing_episode_story_id_count: seriesItems.reduce((sum, item) => sum + (item.missing_episode_story_id_count ?? 0), 0),
      series_missing_delivery_count: countMissing(allItems, 'series_delivery', 'ai_comic_series_project')
        + countMissing(allItems, 'shot_production_ledger', 'ai_comic_series_project'),
      series_missing_postproduction_count: ['cut_assembly', 'subtitles', 'thumbnails', 'final_delivery', 'final_delivery_manifest']
        .reduce((sum, contract) => sum + countMissing(allItems, contract, 'ai_comic_series_project'), 0),
      series_missing_final_delivery_manifest_count: countMissing(
        allItems,
        'final_delivery_manifest',
        'ai_comic_series_project',
      ),
      series_ready_count: countSeriesStatus('ready'),
      series_planned_only_count: seriesPlannedOnlyCount,
      series_production_gap_count: seriesProductionGapCount,
      series_interrupted_count: seriesInterruptedCount,
      series_governance_attention_count: seriesGovernanceAttentionCount,
      series_missing_story_ref_project_count: seriesMissingStoryRefProjectCount,
      series_contract_evidence_count: seriesContractEvidenceCount,
      series_relink_candidate_count: seriesRelinkCandidateCount,
      series_signoff_portfolio_count: seriesSignoffPortfolioCount,
      series_soft_archive_excluded_count: seriesSoftArchiveExcludedCount,
      series_seedance_failed_project_count: seriesSeedanceFailedProjectCount,
      series_seedance_failed_item_count: seriesSeedanceFailedItemCount,
      series_seedance_failure_marker_project_count: seriesSeedanceFailureMarkerProjectCount,
      series_seedance_test_fixture_failure_project_count: seriesSeedanceTestFixtureFailureProjectCount,
      series_seedance_test_fixture_failure_item_count: seriesSeedanceTestFixtureFailureItemCount,
    },
    items,
    notes: [
      'MCP generated health is read-only and built from local web/generated files.',
      'Use this before GEARS v2 smoke to avoid selecting planned-only or interrupted generated targets.',
      seriesGovernanceAttentionCount > 0
        ? `Series governance: ${seriesGovernanceAttentionCount} AI comic series targets are planned-only, production-gap, or interrupted; archive fixtures or repair contracts before using portfolio readiness for GEARS sign-off.`
        : 'Series governance: all scanned AI comic series targets are command-layer ready.',
      seriesSoftArchiveExcludedCount > 0
        ? `Soft archive: ${seriesSoftArchiveExcludedCount} historical series are reversibly excluded from the GEARS signoff portfolio by manifest; project JSON files are unchanged.`
        : '',
      seriesRelinkCandidateCount > 0
        ? `Series relink candidates: ${seriesRelinkCandidateCount} interrupted series already have production or postproduction contract evidence; restore missing episode story JSON or update refs before judging GEARS readiness.`
        : '',
      countMissing(allItems, 'final_delivery_manifest', 'ai_comic_series_project') > 0
        ? `Final delivery manifest integrity: ${countMissing(allItems, 'final_delivery_manifest', 'ai_comic_series_project')} series have an output/concat plan but no manifest; concat.txt alone is not publishable delivery evidence.`
        : '',
      seriesSeedanceFailedItemCount > 0 && seriesSeedanceFailedItemCount === seriesSeedanceTestFixtureFailureItemCount
        ? `Seedance failures: all ${seriesSeedanceFailedItemCount} failed production items are explicitly test-marked fixtures; exclude them from real delivery failure counts.`
        : seriesSeedanceFailedItemCount > 0
          ? `Seedance failures: ${seriesSeedanceFailedItemCount - seriesSeedanceTestFixtureFailureItemCount} failed production items are not explicitly test-marked and require operator review.`
          : '',
      'china-culture-kb remains the content and production command layer; media execution stays in GEARS v2.',
    ].filter(Boolean),
  };
  return input.include_markdown === false ? base : { ...base, markdown: buildMarkdown(base) };
}
