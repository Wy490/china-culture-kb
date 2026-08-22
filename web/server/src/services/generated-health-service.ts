import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  ProjectSupplementCandidateExportItem,
  ProjectSupplementCandidateExportPackage,
  StoryAgentBacklogHandoffActionType,
  StoryAgentBacklogHandoffItem,
  StoryAgentBacklogHandoffPackage,
  StoryAgentBacklogHandoffPriority,
  StoryAgentGeneratedHealthItem,
  StoryAgentGeneratedHealthReport,
  StoryAgentGeneratedHealthScope,
  StoryAgentGeneratedHealthStatus,
} from '@shared/types.js';
import { exportProjectSupplementCandidatePackage } from './project-service.js';
import { storyGeneratedRoot, storyKbRoot } from '../platform/story-storage-root.js';
import { inspectStoryGenerationActivity } from './story-generation-activity-service.js';

interface GeneratedHealthOptions {
  limit?: number;
}

interface StoryAgentBacklogHandoffOptions {
  limit?: number;
  health?: StoryAgentGeneratedHealthReport;
  supplementPackage?: ProjectSupplementCandidateExportPackage;
}

interface GeneratedProjectRecord {
  project_dir: string;
  dir_name: string;
  record: Record<string, unknown>;
}

interface StoryVersionRecord {
  version_id?: string;
  record: Record<string, unknown>;
}

function kbRoot(): string {
  return storyKbRoot();
}

function generatedRoot(): string {
  return storyGeneratedRoot();
}

function generatedRoots(): string[] {
  return [generatedRoot()];
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberField(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readJsonRecord(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf-8')) as unknown;
    return isObjectRecord(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

async function readSignoffExcludedSeriesIds(): Promise<Set<string>> {
  const manifestPath = process.env.STORY_AGENT_SOFT_ARCHIVE_MANIFEST_PATH
    || resolve(kbRoot(), 'reports', 'story-agent-soft-archive-manifest-20260710.json');
  const manifest = await readJsonRecord(manifestPath);
  const policy = isObjectRecord(manifest?.policy) ? manifest.policy : undefined;
  if (stringField(manifest?.mode) !== 'active_signoff_exclusion'
    || booleanField(policy?.signoff_exclusion_applied) !== true) {
    return new Set();
  }
  return new Set(asArray(manifest?.entries)
    .filter(isObjectRecord)
    .filter(item => stringField(item.execution_status) === 'signoff_exclusion_active')
    .map(item => stringField(item.project_id))
    .filter((item): item is string => Boolean(item)));
}

async function readGeneratedProjectRecords(rootPaths: string[]): Promise<GeneratedProjectRecord[]> {
  const records: GeneratedProjectRecord[] = [];
  const seen = new Set<string>();
  for (const rootPath of rootPaths) {
    let entries: Dirent[];
    try {
      entries = await readdir(rootPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projectDir = resolve(rootPath, entry.name);
      const record = await readJsonRecord(resolve(projectDir, 'project.json'));
      if (!record) continue;
      const key = `${rootPath}:${entry.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({ project_dir: projectDir, dir_name: entry.name, record });
    }
  }
  return records;
}

async function readStoryVersionRecords(projectDir: string): Promise<StoryVersionRecord[]> {
  const versionsDir = resolve(projectDir, 'versions');
  let entries: Dirent[];
  try {
    entries = await readdir(versionsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const records: StoryVersionRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const record = await readJsonRecord(resolve(versionsDir, entry.name));
    if (!record) continue;
    records.push({
      version_id: stringField(record.version_id) ?? entry.name.replace(/\.json$/, ''),
      record,
    });
  }
  return records.sort((a, b) => (b.record.created_at as string ?? '').localeCompare(a.record.created_at as string ?? ''));
}

async function readGeneratedStoryIds(): Promise<Set<string>> {
  const storyIds = new Set<string>();
  for (const rootPath of generatedRoots().map(root => resolve(root, 'stories'))) {
    let entries: Dirent[];
    try {
      entries = await readdir(rootPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        storyIds.add(entry.name.replace(/\.json$/, ''));
        continue;
      }
      if (!entry.isDirectory()) continue;
      let storyEntries: Dirent[];
      try {
        storyEntries = await readdir(resolve(rootPath, entry.name), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const storyEntry of storyEntries) {
        if (!storyEntry.isFile() || !storyEntry.name.endsWith('.json')) continue;
        storyIds.add(storyEntry.name.replace(/\.json$/, ''));
      }
    }
  }
  return storyIds;
}

function storyProjectId(record: Record<string, unknown>, fallback: string): string {
  return stringField(record.project_id ?? record.story_project_id ?? record.id) ?? fallback;
}

function storyProjectTitle(record: Record<string, unknown>, story?: Record<string, unknown>): string | undefined {
  return stringField(record.title ?? record.project_title ?? story?.title ?? record.name);
}

function seriesProjectRecord(record: Record<string, unknown>): Record<string, unknown> {
  return isObjectRecord(record.project) ? record.project : record;
}

function seriesPlanRecord(record: Record<string, unknown>): Record<string, unknown> {
  return isObjectRecord(record.plan) ? record.plan : {};
}

function seriesProjectId(record: Record<string, unknown>, fallback: string): string {
  const project = seriesProjectRecord(record);
  return stringField(record.series_project_id ?? record.project_id ?? project.series_project_id ?? project.project_id ?? project.id) ?? fallback;
}

function seriesProjectTitle(record: Record<string, unknown>): string | undefined {
  const project = seriesProjectRecord(record);
  const plan = seriesPlanRecord(record);
  return stringField(record.title ?? project.title ?? plan.series_title ?? project.name);
}

function statusRank(status: StoryAgentGeneratedHealthStatus): number {
  if (status === 'interrupted') return 0;
  if (status === 'production_gap') return 1;
  if (status === 'planned') return 2;
  return 3;
}

function riskScore(status: StoryAgentGeneratedHealthStatus, issueCount: number): number {
  if (status === 'interrupted') return Math.min(100, 88 + issueCount * 3);
  if (status === 'production_gap') return Math.min(87, 55 + issueCount * 5);
  if (status === 'planned') return Math.min(45, 18 + issueCount * 4);
  return Math.max(0, 8 - issueCount);
}

function qualityScore(qualityReport: Record<string, unknown> | undefined): number | undefined {
  if (!qualityReport) return undefined;
  return numberField(
    qualityReport.genre_score
      ?? qualityReport.score
      ?? (isObjectRecord(qualityReport.gears_readiness_report) ? qualityReport.gears_readiness_report.readiness_score : undefined)
      ?? (isObjectRecord(qualityReport.outline_coverage_report) ? qualityReport.outline_coverage_report.coverage_score : undefined),
  );
}

function buildStoryRecommendations(status: StoryAgentGeneratedHealthStatus, missingContracts: string[]): string[] {
  if (status === 'interrupted') {
    return [
      '修复 project.json 的 current_version_id/current_story_id，或用现有版本快照重建当前故事。',
      '缺失版本无法自动推给 GEARS；先恢复 Story Agent 项目闭环，再进入 production readiness。',
    ];
  }
  const actions: string[] = [];
  if (missingContracts.includes('scene_breakdown') || missingContracts.includes('quality_report')) {
    actions.push('运行 Story Agent 修复/校验，补齐 scene_breakdown、质量报告和返修动作。');
  }
  if (missingContracts.includes('gears_segments') || missingContracts.includes('delivery_contract')) {
    actions.push('重新导出 GEARS delivery/production board 合同，只输出指挥层交付包。');
  }
  if (!actions.length) actions.push('当前故事项目合同完整，可进入 GEARS v2 worker smoke 或生产就绪队列。');
  return actions;
}

async function buildStoryHealthItem(input: GeneratedProjectRecord): Promise<StoryAgentGeneratedHealthItem> {
  const project = input.record;
  const versions = await readStoryVersionRecords(input.project_dir);
  const currentVersionId = stringField(project.current_version_id);
  const currentStoryId = stringField(project.current_story_id ?? project.story_id);
  const currentVersion = currentVersionId
    ? versions.find(item => item.version_id === currentVersionId)
    : undefined;
  const story = isObjectRecord(currentVersion?.record.story) ? currentVersion?.record.story : undefined;
  const qualityReport = isObjectRecord(currentVersion?.record.quality_report)
    ? currentVersion?.record.quality_report
    : isObjectRecord(story?.quality_report)
      ? story?.quality_report
      : undefined;
  const sceneCount = asArray(story?.scene_breakdown).length;
  const gearsSegmentCount = asArray(story?.gears_segments).length;
  const hasDeliveryContract = Boolean(isObjectRecord(story?.gears_delivery) || isObjectRecord(currentVersion?.record.production_board_export));
  const qualityPassed = booleanField(project.quality_passed) ?? booleanField(qualityReport?.passed);
  const qualityIssueCount = numberField(project.quality_issue_count)
    ?? (qualityReport ? asArray(qualityReport.issues).length : undefined);
  const openSupplementTaskCount = numberField(project.open_supplement_task_count)
    ?? asArray(story?.supplement_tasks).filter(item =>
      isObjectRecord(item) && stringField(item.status) !== 'resolved',
    ).length;
  const materialSufficiency = isObjectRecord(project.material_sufficiency)
    ? project.material_sufficiency
    : isObjectRecord(story?.material_sufficiency)
      ? story.material_sufficiency
      : undefined;
  const materialSufficiencyBlocked = booleanField(materialSufficiency?.blocked);
  const missingContracts: string[] = [];
  const evidence: string[] = [];

  if (!currentVersionId || !currentVersion) missingContracts.push('current_version');
  if (!currentStoryId || !story) missingContracts.push('current_story');
  if (story && currentStoryId && stringField(story.storyId) && stringField(story.storyId) !== currentStoryId) {
    missingContracts.push('current_story');
    evidence.push(`current_story_id=${currentStoryId} but version storyId=${stringField(story.storyId)}`);
  }
  if (story && sceneCount === 0) missingContracts.push('scene_breakdown');
  if (story && gearsSegmentCount === 0) missingContracts.push('gears_segments');
  if (story && !qualityReport) missingContracts.push('quality_report');
  if (story && !hasDeliveryContract) missingContracts.push('delivery_contract');

  evidence.push(`versions=${versions.length}`);
  if (currentVersionId) evidence.push(`current_version_id=${currentVersionId}`);
  if (currentStoryId) evidence.push(`current_story_id=${currentStoryId}`);
  if (story) evidence.push(`scenes=${sceneCount}, gears_segments=${gearsSegmentCount}`);
  if (qualityPassed !== undefined) evidence.push(`quality_passed=${qualityPassed}`);
  if (qualityIssueCount !== undefined) evidence.push(`quality_issues=${qualityIssueCount}`);
  evidence.push(`open_supplement_tasks=${openSupplementTaskCount}`);
  if (materialSufficiencyBlocked !== undefined) evidence.push(`material_sufficiency_blocked=${materialSufficiencyBlocked}`);

  const status: StoryAgentGeneratedHealthStatus = missingContracts.includes('current_version') || missingContracts.includes('current_story')
    ? 'interrupted'
    : missingContracts.length
      ? 'production_gap'
      : 'ready';
  const issueCount = missingContracts.length;

  return {
    scope: 'story_project',
    project_id: storyProjectId(project, input.dir_name),
    title: storyProjectTitle(project, story),
    status,
    risk_score: riskScore(status, issueCount),
    updated_at: stringField(project.updated_at ?? story?.generated_at ?? project.created_at),
    issue_count: issueCount,
    missing_contracts: [...new Set(missingContracts)],
    evidence,
    recommended_actions: buildStoryRecommendations(status, missingContracts),
    current_story_id: currentStoryId,
    current_version_id: currentVersionId,
    version_count: numberField(project.version_count) ?? versions.length,
    scene_count: story ? sceneCount : undefined,
    gears_segment_count: story ? gearsSegmentCount : undefined,
    quality_score: qualityScore(qualityReport),
    quality_passed: qualityPassed,
    quality_issue_count: qualityIssueCount,
    open_supplement_task_count: openSupplementTaskCount,
    material_sufficiency_blocked: materialSufficiencyBlocked,
  };
}

function generatedEpisodeStoryIds(record: Record<string, unknown>): string[] {
  const value = record.generated_episode_story_ids;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  if (isObjectRecord(value)) {
    return Object.values(value).filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  }
  return [];
}

function ledgerUsable(ledger: Record<string, unknown> | undefined): boolean {
  const status = stringField(ledger?.status);
  return status === 'ready' || status === 'planned';
}

function hasPathLikeOutput(ledger: Record<string, unknown> | undefined, fields: string[]): boolean {
  if (!ledger) return false;
  return fields.some(field => Boolean(stringField(ledger[field])));
}

function productionFailureIsMarkedTestFixture(item: Record<string, unknown>): boolean {
  const failureReason = stringField(item.failure_reason) ?? '';
  const noteText = asArray(item.notes)
    .map(note => stringField(note))
    .filter((note): note is string => Boolean(note))
    .join(' ');
  return failureReason.includes('测试标记')
    || noteText.includes('测试标记')
    || (stringField(item.provider_job_id) === 'seedance-job-failed' && noteText.includes('测试'));
}

function buildSeriesRecommendations(status: StoryAgentGeneratedHealthStatus, missingContracts: string[]): string[] {
  if (status === 'planned') {
    return ['生成第一集分集故事，再导出 GEARS delivery 与系列生产指挥包。'];
  }
  if (status === 'interrupted') {
    return [
      '修复 generated_episode_story_ids 指向的故事文件，或回滚到仍存在的分集故事。',
      '引用断裂前不要提交 GEARS worker，避免 source_unit 与故事上下文错位。',
    ];
  }
  const actions: string[] = [];
  if (missingContracts.includes('remaining_episodes')) actions.push('继续生成剩余分集，保持连续性 ledger 与 series bible 同步。');
  if (missingContracts.includes('series_delivery') || missingContracts.includes('shot_production_ledger')) {
    actions.push('导出系列 GEARS delivery/镜头生产账本，交给 GEARS v2 执行实产。');
  }
  if (missingContracts.includes('shot_returns')) actions.push('同步 GEARS v2 回片/失败类型，生成 retry 或人工替换清单。');
  if (missingContracts.includes('thumbnails')) actions.push('由 GEARS v2 或外部后期补齐缩略图/审片素材，不在本仓库做真实抽帧。');
  if (missingContracts.includes('final_delivery_manifest')) {
    actions.push('重跑 final delivery dry-run/导出以生成 manifest；concat.txt 只是装配计划，不得作为可发布交付。');
  }
  if (missingContracts.includes('cut_assembly') || missingContracts.includes('subtitles') || missingContracts.includes('final_delivery')) {
    actions.push('导出后期生产指令包，由 GEARS v2 完成剪辑、字幕和最终装配。');
  }
  if (!actions.length) actions.push('当前系列指挥层合同完整，可进入 portfolio readiness 或 GEARS v2 smoke。');
  return actions;
}

function buildSeriesHealthItem(
  input: GeneratedProjectRecord,
  availableStoryIds: Set<string>,
  signoffExcludedSeriesIds: Set<string>,
): StoryAgentGeneratedHealthItem {
  const record = input.record;
  const project = seriesProjectRecord(record);
  const plan = seriesPlanRecord(record);
  const projectId = seriesProjectId(record, input.dir_name);
  const signoffExcluded = signoffExcludedSeriesIds.has(projectId);
  const episodeCount = numberField(project.episode_count ?? plan.episode_count)
    ?? asArray(plan.episodes).length;
  const storyIds = generatedEpisodeStoryIds(record);
  const generatedEpisodeCount = numberField(project.generated_episode_count) ?? storyIds.length;
  const missingEpisodeStoryIdCount = storyIds.filter(storyId => !availableStoryIds.has(storyId)).length;
  const productionLedger = isObjectRecord(record.seedance_production) ? record.seedance_production : undefined;
  const productionItems = asArray(productionLedger?.items).filter(isObjectRecord);
  const readyProductionItems = productionItems.filter(item => {
    if (stringField(item.status) !== 'ready') return false;
    if (stringField(item.video_url)) return true;
    return asArray(item.versions).filter(isObjectRecord).some(version =>
      stringField(version.status) === 'ready' && Boolean(stringField(version.video_url)),
    );
  });
  const failedProductionItems = productionItems.filter(item => stringField(item.status) === 'failed');
  const testFixtureFailureItems = failedProductionItems.filter(productionFailureIsMarkedTestFixture);
  const thumbnailReadyCount = productionItems.filter(item => {
    const thumbnail = isObjectRecord(item.thumbnail) ? item.thumbnail : undefined;
    return stringField(thumbnail?.status) === 'ready' && Boolean(stringField(thumbnail?.output_path));
  }).length;
  const cutLedger = isObjectRecord(record.seedance_cut_assembly) ? record.seedance_cut_assembly : undefined;
  const subtitleLedger = isObjectRecord(record.seedance_subtitle_render) ? record.seedance_subtitle_render : undefined;
  const finalDeliveryLedger = isObjectRecord(record.seedance_final_delivery) ? record.seedance_final_delivery : undefined;
  const hasGearsJobLedger = isObjectRecord(record.gears_job_ledger);
  const cutReady = ledgerUsable(cutLedger) && hasPathLikeOutput(cutLedger, ['output_path', 'concat_list_path']);
  const subtitleReady = ledgerUsable(subtitleLedger) && hasPathLikeOutput(subtitleLedger, ['output_path', 'srt_path']);
  const finalDeliveryOutputDeclared = ledgerUsable(finalDeliveryLedger)
    && hasPathLikeOutput(finalDeliveryLedger, ['output_path']);
  const finalDeliveryManifestReady = ledgerUsable(finalDeliveryLedger)
    && hasPathLikeOutput(finalDeliveryLedger, ['manifest_path']);
  const finalDeliveryReady = finalDeliveryOutputDeclared && finalDeliveryManifestReady;
  const finalDeliveryManifestMissing = finalDeliveryOutputDeclared && !finalDeliveryManifestReady;
  const finalDeliveryDryRun = booleanField(finalDeliveryLedger?.dry_run) === true;
  const contractEvidence = [
    productionItems.length > 0 ? 'seedance_production' : '',
    hasGearsJobLedger ? 'gears_job_ledger' : '',
    thumbnailReadyCount > 0 ? 'thumbnails' : '',
    cutReady ? 'cut_assembly' : '',
    subtitleReady ? 'subtitle_render' : '',
    finalDeliveryReady ? 'final_delivery' : finalDeliveryOutputDeclared ? 'final_delivery_plan' : '',
  ].filter(Boolean);
  const relinkCandidate = missingEpisodeStoryIdCount > 0 && contractEvidence.length > 0;
  const missingContracts: string[] = [];
  const evidence: string[] = [
    `episodes=${generatedEpisodeCount}/${episodeCount}`,
    `generated_episode_story_ids=${storyIds.length}`,
    `production_items=${productionItems.length}`,
    `failed_production_items=${failedProductionItems.length}, test_fixture_failures=${testFixtureFailureItems.length}`,
    `contract_evidence=${contractEvidence.join(',') || 'none'}`,
  ];

  if (missingEpisodeStoryIdCount > 0) missingContracts.push('generated_episode_story_refs');
  if (generatedEpisodeCount > 0 && generatedEpisodeCount < episodeCount) missingContracts.push('remaining_episodes');
  if (generatedEpisodeCount > 0 && productionItems.length === 0) missingContracts.push('shot_production_ledger');
  if (productionItems.length > 0 && readyProductionItems.length === 0) missingContracts.push('shot_returns');
  if (readyProductionItems.length > 0 && thumbnailReadyCount < readyProductionItems.length) missingContracts.push('thumbnails');
  if (readyProductionItems.length > 0 && !cutReady) missingContracts.push('cut_assembly');
  if (cutReady && !subtitleReady) missingContracts.push('subtitles');
  if (cutReady && finalDeliveryManifestMissing) missingContracts.push('final_delivery_manifest');
  else if (cutReady && !finalDeliveryReady) missingContracts.push('final_delivery');
  if (generatedEpisodeCount > 0 && !hasGearsJobLedger && productionItems.length === 0) {
    missingContracts.push('series_delivery');
  }

  const uniqueMissingContracts = [...new Set(missingContracts)];
  const status: StoryAgentGeneratedHealthStatus = generatedEpisodeCount === 0 && storyIds.length === 0
    ? 'planned'
    : missingEpisodeStoryIdCount > 0
      ? 'interrupted'
      : uniqueMissingContracts.length
        ? 'production_gap'
        : 'ready';
  evidence.push(`ready_production_items=${readyProductionItems.length}`);
  evidence.push(
    `cut_ready=${cutReady}, subtitle_ready=${subtitleReady}, final_delivery_ready=${finalDeliveryReady}, final_delivery_manifest_ready=${finalDeliveryManifestReady}, final_delivery_dry_run=${finalDeliveryDryRun}`,
  );
  evidence.push(`signoff_eligible=${!signoffExcluded}`);

  return {
    scope: 'ai_comic_series_project',
    project_id: projectId,
    title: seriesProjectTitle(record),
    status,
    risk_score: riskScore(status, uniqueMissingContracts.length),
    updated_at: stringField(project.updated_at ?? record.updated_at ?? project.created_at),
    issue_count: uniqueMissingContracts.length,
    missing_contracts: uniqueMissingContracts,
    evidence,
    recommended_actions: signoffExcluded
      ? [
          '该历史样本已通过可逆 manifest 排除出 GEARS signoff portfolio；原项目文件保持不变。',
          '如需恢复，先进入人工重建白名单并按当前 Story Agent 合同生成新版本。',
        ]
      : buildSeriesRecommendations(status, uniqueMissingContracts),
    episode_count: episodeCount,
    generated_episode_count: generatedEpisodeCount,
    generated_episode_story_id_count: storyIds.length,
    missing_episode_story_id_count: missingEpisodeStoryIdCount,
    production_item_count: productionItems.length,
    ready_production_item_count: readyProductionItems.length,
    failed_production_item_count: failedProductionItems.length,
    test_fixture_failure_item_count: testFixtureFailureItems.length,
    seedance_failure_marker_present: JSON.stringify(record).includes('seedance-job-failed'),
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

function boundedLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isFinite(limit)) return undefined;
  return Math.max(1, Math.min(Math.floor(limit), 200));
}

function renderMarkdown(report: Omit<StoryAgentGeneratedHealthReport, 'markdown'>): string {
  const activity = report.generation_activity;
  return [
    '# Story Agent Generated Health',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- total_target_count: ${report.summary.total_target_count}`,
    `- story_projects: ${report.summary.scanned_story_project_count}`,
    `- ai_comic_series_projects: ${report.summary.scanned_series_project_count}`,
    `- ready: ${report.summary.ready_count}`,
    `- planned: ${report.summary.planned_count}`,
    `- production_gap: ${report.summary.production_gap_count}`,
    `- interrupted: ${report.summary.interrupted_count}`,
    `- missing_current_story: ${report.summary.missing_current_story_count}`,
    `- missing_scene_breakdown: ${report.summary.missing_scene_breakdown_count}`,
    `- missing_gears_segments: ${report.summary.missing_gears_segments_count}`,
    `- missing_quality: ${report.summary.missing_quality_count}`,
    `- story_quality_passed: ${report.summary.story_quality_passed_count ?? 0}`,
    `- story_quality_failed: ${report.summary.story_quality_failed_count ?? 0}`,
    `- story_open_supplement_tasks: ${report.summary.story_open_supplement_task_count ?? 0}`,
    `- story_quality_passed_with_issues: ${report.summary.story_quality_passed_with_issue_count ?? 0}`,
    `- story_quality_passed_with_open_supplement: ${report.summary.story_quality_passed_with_open_supplement_count ?? 0}`,
    `- story_quality_passed_with_issues_and_open_supplement: ${report.summary.story_quality_passed_with_issue_and_open_supplement_count ?? 0}`,
    `- story_material_sufficiency_blocked: ${report.summary.story_material_sufficiency_blocked_count ?? 0}`,
    `- missing_episode_story_refs: ${report.summary.missing_episode_story_id_count}`,
    `- series_missing_delivery: ${report.summary.series_missing_delivery_count}`,
    `- series_missing_postproduction: ${report.summary.series_missing_postproduction_count}`,
    `- series_missing_final_delivery_manifest: ${report.summary.series_missing_final_delivery_manifest_count ?? 0}`,
    `- series_ready: ${report.summary.series_ready_count ?? 0}`,
    `- series_planned_only: ${report.summary.series_planned_only_count ?? 0}`,
    `- series_production_gap: ${report.summary.series_production_gap_count ?? 0}`,
    `- series_interrupted: ${report.summary.series_interrupted_count ?? 0}`,
    `- series_governance_attention: ${report.summary.series_governance_attention_count ?? 0}`,
    `- series_missing_story_ref_projects: ${report.summary.series_missing_story_ref_project_count ?? 0}`,
    `- series_contract_evidence: ${report.summary.series_contract_evidence_count ?? 0}`,
    `- series_relink_candidates: ${report.summary.series_relink_candidate_count ?? 0}`,
    `- series_signoff_portfolio: ${report.summary.series_signoff_portfolio_count ?? 0}`,
    `- series_soft_archive_excluded: ${report.summary.series_soft_archive_excluded_count ?? 0}`,
    `- signoff_portfolio_targets: ${report.summary.signoff_portfolio_target_count ?? report.summary.total_target_count}`,
    `- signoff_portfolio_ready: ${report.summary.signoff_portfolio_ready_count ?? report.summary.ready_count}`,
    `- signoff_portfolio_planned: ${report.summary.signoff_portfolio_planned_count ?? report.summary.planned_count}`,
    `- signoff_portfolio_production_gap: ${report.summary.signoff_portfolio_production_gap_count ?? report.summary.production_gap_count}`,
    `- signoff_portfolio_interrupted: ${report.summary.signoff_portfolio_interrupted_count ?? report.summary.interrupted_count}`,
    `- soft_archive_excluded_targets: ${report.summary.soft_archive_excluded_target_count ?? 0}`,
    `- series_seedance_failed_projects: ${report.summary.series_seedance_failed_project_count ?? 0}`,
    `- series_seedance_failed_items: ${report.summary.series_seedance_failed_item_count ?? 0}`,
    `- series_seedance_failure_marker_projects: ${report.summary.series_seedance_failure_marker_project_count ?? 0}`,
    `- series_seedance_test_fixture_failure_projects: ${report.summary.series_seedance_test_fixture_failure_project_count ?? 0}`,
    `- series_seedance_test_fixture_failure_items: ${report.summary.series_seedance_test_fixture_failure_item_count ?? 0}`,
    '',
    '## Generation Activity',
    '',
    `- diagnosis: ${activity?.diagnosis ?? 'unavailable'}`,
    `- latest_persisted_activity_kind: ${activity?.latest_persisted_activity_kind ?? 'none'}`,
    `- latest_story_id: ${activity?.latest_story?.story_id ?? 'none'}`,
    `- latest_story_created_at: ${activity?.latest_story?.created_at ?? 'none'}`,
    `- latest_project_version: ${activity?.latest_project_version?.version_id ?? 'none'}`,
    `- latest_project_version_created_at: ${activity?.latest_project_version?.created_at ?? 'none'}`,
    `- project_revisions_after_latest_story: ${activity?.summary.project_revision_after_latest_story_count ?? 0}`,
    `- reports_after_latest_story: ${activity?.summary.report_after_latest_story_count ?? 0}`,
    `- pending_transactions: ${activity?.summary.pending_transaction_count ?? 0}`,
    `- legacy_stories: ${activity?.summary.legacy_story_count ?? 0}`,
    `- durable_attempt_history: ${activity?.signals.durable_generation_attempt_history_available ?? false}`,
    `- latest_generation_attempt_id: ${activity?.latest_generation_attempt?.attempt_id ?? 'none'}`,
    `- latest_generation_attempt_status: ${activity?.latest_generation_attempt?.status ?? 'none'}`,
    `- generation_attempts: ${activity?.summary.generation_attempt_count ?? 0}`,
    `- generation_attempt_failures: ${activity?.summary.generation_attempt_failed_count ?? 0}`,
    `- generation_attempts_incomplete: ${activity?.summary.generation_attempt_incomplete_count ?? 0}`,
    `- attempt_audit_readiness: ${activity?.attempt_audit_readiness.status ?? 'unavailable'}`,
    `- attempt_audit_history_integrity: ${activity?.attempt_audit_readiness.history_integrity ?? 'unavailable'}`,
    `- attempt_audit_lock_status: ${activity?.attempt_audit_readiness.lock_status ?? 'absent'}`,
    `- attempt_audit_current_file_bytes: ${activity?.attempt_audit_readiness.current_file_bytes ?? 0}`,
    `- attempt_audit_archive_count: ${activity?.attempt_audit_readiness.archive_count ?? 0}`,
    `- attempt_audit_lock_timeout_ms: ${activity?.attempt_audit_readiness.configured_lock_timeout_ms ?? 0}`,
    `- attempt_audit_lock_retry_ms: ${activity?.attempt_audit_readiness.configured_lock_retry_ms ?? 0}`,
    `- attempt_audit_lock_stale_ms: ${activity?.attempt_audit_readiness.configured_lock_stale_ms ?? 0}`,
    `- attempt_audit_configuration_valid: ${activity?.attempt_audit_readiness.configuration_valid ?? false}`,
    `- attempt_audit_configuration_warnings: ${activity?.attempt_audit_readiness.configuration_warnings.join(', ') || 'none'}`,
    `- attempt_audit_permission_policy: ${activity?.attempt_audit_readiness.permission_policy ?? 'owner_only'}`,
    `- attempt_audit_permission_policy_satisfied: ${activity?.attempt_audit_readiness.permission_policy_satisfied ?? false}`,
    `- attempt_audit_event_file_sync_required: ${activity?.attempt_audit_readiness.event_file_sync_required ?? true}`,
    `- attempt_audit_no_follow_open_required: ${activity?.attempt_audit_readiness.no_follow_open_required ?? true}`,
    `- attempt_audit_directory_entry_sync_guaranteed: ${activity?.attempt_audit_readiness.directory_entry_sync_guaranteed ?? true}`,
    `- attempt_audit_blockers: ${activity?.attempt_audit_readiness.blockers.join(', ') || 'none'}`,
    `- attempt_audit_operator_actions: ${activity?.attempt_audit_readiness.operator_actions.join(', ') || 'none'}`,
    `- attempt_audit_automatic_repair_allowed: ${activity?.attempt_audit_readiness.automatic_repair_allowed ?? false}`,
    `- attempt_audit_destructive_action_performed: ${activity?.attempt_audit_readiness.destructive_action_performed ?? false}`,
    `- no_generation_request_confirmed: ${activity?.signals.no_generation_request_confirmed ?? false}`,
    `- generation_pipeline_failure_confirmed: ${activity?.signals.generation_pipeline_failure_confirmed ?? false}`,
    `- generation_attempt_incomplete_detected: ${activity?.signals.generation_attempt_incomplete_detected ?? false}`,
    `- generated_files_modified: ${activity?.safety.generated_files_modified ?? false}`,
    `- model_invoked: ${activity?.safety.model_invoked ?? false}`,
    '',
    '## Priority Items',
    '',
    ...(report.items.length
      ? report.items.slice(0, 30).map(item => [
        `- P${item.risk_score} · ${item.scope} · ${item.status} · ${item.project_id}`,
        `  - title: ${item.title ?? 'untitled'}`,
        `  - missing: ${item.missing_contracts.join(', ') || 'none'}`,
        `  - next: ${item.recommended_actions[0] ?? 'no immediate action'}`,
      ].join('\n'))
      : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n').trim() + '\n';
}

function countByStatus(items: StoryAgentGeneratedHealthItem[], status: StoryAgentGeneratedHealthStatus): number {
  return items.filter(item => item.status === status).length;
}

function countByStatusAndScope(
  items: StoryAgentGeneratedHealthItem[],
  status: StoryAgentGeneratedHealthStatus,
  scope: StoryAgentGeneratedHealthScope,
): number {
  return items.filter(item => item.scope === scope && item.status === status).length;
}

function countMissing(items: StoryAgentGeneratedHealthItem[], contract: string, scope?: StoryAgentGeneratedHealthScope): number {
  return items.filter(item =>
    (!scope || item.scope === scope) && item.missing_contracts.includes(contract),
  ).length;
}

function backlogPriorityRank(priority: StoryAgentBacklogHandoffPriority): number {
  if (priority === 'P0') return 0;
  if (priority === 'P1') return 1;
  if (priority === 'P2') return 2;
  return 3;
}

function backlogActionTypeForHealthItem(item: StoryAgentGeneratedHealthItem): StoryAgentBacklogHandoffActionType {
  if (item.scope === 'ai_comic_series_project') {
    if (item.missing_contracts.includes('generated_episode_story_refs')) return 'restore_series_story_refs';
    if (item.status === 'planned' || item.missing_contracts.includes('remaining_episodes')) return 'continue_series_generation';
    return 'repair_series_delivery';
  }
  if (item.missing_contracts.includes('current_story') || item.missing_contracts.includes('current_version')) {
    return 'repair_story_project_refs';
  }
  if (item.quality_passed === false) return 'repair_quality';
  if (item.material_sufficiency_blocked) return 'resolve_material_gate';
  if ((item.open_supplement_task_count ?? 0) > 0) return 'complete_supplement_task';
  return 'repair_delivery_contract';
}

function backlogPriorityForHealthItem(item: StoryAgentGeneratedHealthItem): StoryAgentBacklogHandoffPriority {
  if (
    item.status === 'interrupted'
    || item.missing_contracts.includes('current_story')
    || item.missing_contracts.includes('current_version')
  ) {
    return 'P0';
  }
  if (item.quality_passed === false || item.material_sufficiency_blocked) return 'P1';
  if (item.status === 'production_gap') return 'P1';
  if ((item.open_supplement_task_count ?? 0) > 0) return 'P2';
  return 'P3';
}

function backlogReasonForHealthItem(item: StoryAgentGeneratedHealthItem): string {
  if (item.status === 'interrupted') return 'Generated project current refs or linked story artifacts are interrupted.';
  if (item.quality_passed === false) return 'Latest story version has failed quality validation.';
  if (item.material_sufficiency_blocked) return 'Material sufficiency gate is blocking production readiness.';
  if (item.quality_passed === true && (item.open_supplement_task_count ?? 0) > 0) {
    return 'Main quality gate passed; open supplement tasks are operator follow-up backlog, not hidden quality failures.';
  }
  if ((item.open_supplement_task_count ?? 0) > 0) return 'Open supplement tasks still need candidate drafting or human review.';
  if (item.status === 'production_gap') return 'Generated artifact is missing command-layer delivery contracts.';
  if (item.status === 'planned') return 'Series target is planned but has not generated episode story artifacts.';
  return 'Generated target needs follow-up before final sign-off.';
}

function healthItemNeedsBacklog(item: StoryAgentGeneratedHealthItem): boolean {
  return item.status !== 'ready'
    || item.quality_passed === false
    || (item.open_supplement_task_count ?? 0) > 0
    || item.material_sufficiency_blocked === true;
}

function backlogPriorityForSupplementItem(item: ProjectSupplementCandidateExportItem): StoryAgentBacklogHandoffPriority {
  if (item.task.blocking_level === 'blocking') return 'P0';
  if (item.task.blocking_level === 'risk') return 'P1';
  return 'P2';
}

function supplementRiskScore(priority: StoryAgentBacklogHandoffPriority): number {
  if (priority === 'P0') return 95;
  if (priority === 'P1') return 72;
  if (priority === 'P2') return 45;
  return 18;
}

function healthBacklogItem(item: StoryAgentGeneratedHealthItem): StoryAgentBacklogHandoffItem {
  const priority = backlogPriorityForHealthItem(item);
  return {
    backlog_id: `generated-health::${item.scope}::${item.project_id}`,
    source_kind: 'generated_health',
    priority,
    action_type: backlogActionTypeForHealthItem(item),
    project_id: item.project_id,
    title: item.title,
    scope: item.scope,
    status: item.status,
    risk_score: item.risk_score,
    reason: backlogReasonForHealthItem(item),
    recommended_action: item.recommended_actions[0] ?? 'Review generated health evidence and repair the command-layer contract.',
    missing_contracts: item.missing_contracts,
    evidence: [
      ...item.evidence,
      `direct_writeback_to_province_markdown=false`,
      `province_markdown_written=false`,
    ],
  };
}

function supplementBacklogItem(item: ProjectSupplementCandidateExportItem): StoryAgentBacklogHandoffItem {
  const priority = backlogPriorityForSupplementItem(item);
  const blockingLevel = item.task.blocking_level ?? 'optional';
  return {
    backlog_id: `supplement-candidate::${item.task_key}`,
    source_kind: 'supplement_candidate',
    priority,
    action_type: 'complete_supplement_task',
    project_id: item.project_id,
    title: item.task.label || item.project_title,
    status: item.task.status,
    risk_score: supplementRiskScore(priority),
    reason: `${blockingLevel} supplement gap from ${item.task.source}.`,
    recommended_action: item.task.intake_prompt
      ?? item.task.recommended_question
      ?? '补齐素材缺口并重新导出候选包。',
    target_file: item.suggested_file_path,
    task_key: item.task_key,
    task_id: item.task.task_id,
    video_type: item.video_type,
    source_entry: item.source_entry,
    missing_contracts: [],
    evidence: [
      `project_title=${item.project_title}`,
      `stage=${item.task.stage ?? 'unknown'}`,
      `blocking_level=${blockingLevel}`,
      `source=${item.task.source}`,
      `recommended_fields=${item.task.recommended_fields?.join(',') || 'none'}`,
      `direct_writeback_to_province_markdown=false`,
      `province_markdown_written=false`,
    ],
  };
}

function summarizeBacklogHandoff(
  items: StoryAgentBacklogHandoffItem[],
  health: StoryAgentGeneratedHealthReport,
  supplementPackage: ProjectSupplementCandidateExportPackage | undefined,
): StoryAgentBacklogHandoffPackage['summary'] {
  return {
    total_item_count: items.length,
    generated_health_item_count: items.filter(item => item.source_kind === 'generated_health').length,
    supplement_candidate_item_count: items.filter(item => item.source_kind === 'supplement_candidate').length,
    interrupted_count: health.summary.interrupted_count,
    production_gap_count: health.summary.production_gap_count,
    quality_failed_count: health.summary.story_quality_failed_count ?? 0,
    material_blocked_count: health.summary.story_material_sufficiency_blocked_count ?? 0,
    open_supplement_candidate_count: supplementPackage?.open_task_count ?? 0,
    supplement_blocking_open_count: supplementPackage?.blocking_open_count ?? 0,
    supplement_risk_open_count: supplementPackage?.risk_open_count ?? 0,
    supplement_optional_open_count: supplementPackage?.optional_open_count ?? 0,
    p0_count: items.filter(item => item.priority === 'P0').length,
    p1_count: items.filter(item => item.priority === 'P1').length,
    p2_count: items.filter(item => item.priority === 'P2').length,
    p3_count: items.filter(item => item.priority === 'P3').length,
  };
}

function renderStoryAgentBacklogHandoffMarkdown(
  handoff: Omit<StoryAgentBacklogHandoffPackage, 'markdown'>,
): string {
  return [
    '# Story Agent Backlog Handoff',
    '',
    `> schema_version: ${handoff.schema_version}`,
    `> generated_at: ${handoff.generated_at}`,
    `> source_health_schema: ${handoff.source_health_schema}`,
    `> source_supplement_candidate_schema: ${handoff.source_supplement_candidate_schema || 'unavailable'}`,
    `> direct_writeback_to_province_markdown: ${handoff.direct_writeback_to_province_markdown}`,
    `> province_markdown_written: ${handoff.province_markdown_written}`,
    '',
    '## Summary',
    '',
    `- total_item_count: ${handoff.summary.total_item_count}`,
    `- generated_health_item_count: ${handoff.summary.generated_health_item_count}`,
    `- supplement_candidate_item_count: ${handoff.summary.supplement_candidate_item_count}`,
    `- interrupted_count: ${handoff.summary.interrupted_count}`,
    `- production_gap_count: ${handoff.summary.production_gap_count}`,
    `- quality_failed_count: ${handoff.summary.quality_failed_count}`,
    `- material_blocked_count: ${handoff.summary.material_blocked_count}`,
    `- open_supplement_candidate_count: ${handoff.summary.open_supplement_candidate_count}`,
    `- supplement_open_by_level: blocking ${handoff.summary.supplement_blocking_open_count} / risk ${handoff.summary.supplement_risk_open_count} / optional ${handoff.summary.supplement_optional_open_count}`,
    `- priority: P0 ${handoff.summary.p0_count} / P1 ${handoff.summary.p1_count} / P2 ${handoff.summary.p2_count} / P3 ${handoff.summary.p3_count}`,
    '',
    '## Handoff Items',
    '',
    ...(handoff.items.length
      ? handoff.items.slice(0, 50).map(item => [
        `- ${item.priority} · ${item.source_kind} · ${item.action_type} · ${item.project_id}`,
        `  - title: ${item.title ?? 'untitled'}`,
        `  - reason: ${item.reason}`,
        `  - next: ${item.recommended_action}`,
        `  - target: ${item.target_file ?? item.scope ?? 'generated artifact'}`,
      ].join('\n'))
      : ['- none']),
  ].join('\n').trim() + '\n';
}

export async function getStoryAgentGeneratedHealth(
  options: GeneratedHealthOptions = {},
): Promise<StoryAgentGeneratedHealthReport> {
  const [storyRecords, seriesRecords, availableStoryIds, signoffExcludedSeriesIds, generationActivity] = await Promise.all([
    readGeneratedProjectRecords(generatedRoots().map(root => resolve(root, 'projects'))),
    readGeneratedProjectRecords(generatedRoots().map(root => resolve(root, 'ai-comic-series-projects'))),
    readGeneratedStoryIds(),
    readSignoffExcludedSeriesIds(),
    inspectStoryGenerationActivity(),
  ]);
  const storyItems = await Promise.all(storyRecords.map(buildStoryHealthItem));
  const seriesItems = seriesRecords.map(record => buildSeriesHealthItem(
    record,
    availableStoryIds,
    signoffExcludedSeriesIds,
  ));
  const allItems = [...storyItems, ...seriesItems].sort((a, b) => {
    const signoffDiff = Number(a.signoff_eligible === false) - Number(b.signoff_eligible === false);
    if (signoffDiff !== 0) return signoffDiff;
    const manifestGapDiff = Number(b.final_delivery_manifest_missing === true)
      - Number(a.final_delivery_manifest_missing === true);
    if (manifestGapDiff !== 0) return manifestGapDiff;
    const rankDiff = statusRank(a.status) - statusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    const riskDiff = b.risk_score - a.risk_score;
    if (riskDiff !== 0) return riskDiff;
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });
  const limit = boundedLimit(options.limit);
  const reportItems = limit ? allItems.slice(0, limit) : allItems;
  const signoffPortfolioItems = allItems.filter(item => item.signoff_eligible !== false);
  const softArchiveExcludedTargetCount = allItems.length - signoffPortfolioItems.length;
  const seriesReadyCount = countByStatusAndScope(allItems, 'ready', 'ai_comic_series_project');
  const seriesPlannedOnlyCount = countByStatusAndScope(allItems, 'planned', 'ai_comic_series_project');
  const seriesProductionGapCount = countByStatusAndScope(allItems, 'production_gap', 'ai_comic_series_project');
  const seriesInterruptedCount = countByStatusAndScope(allItems, 'interrupted', 'ai_comic_series_project');
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
  const storyQualityPassedCount = storyItems.filter(item => item.quality_passed === true).length;
  const storyQualityFailedCount = storyItems.filter(item => item.quality_passed === false).length;
  const storyOpenSupplementTaskCount = storyItems.reduce((sum, item) => sum + (item.open_supplement_task_count ?? 0), 0);
  const storyQualityPassedWithIssueCount = storyItems.filter(item =>
    item.quality_passed === true && (item.quality_issue_count ?? 0) > 0,
  ).length;
  const storyQualityPassedWithOpenSupplementCount = storyItems.filter(item =>
    item.quality_passed === true && (item.open_supplement_task_count ?? 0) > 0,
  ).length;
  const storyQualityPassedWithIssueAndOpenSupplementCount = storyItems.filter(item =>
    item.quality_passed === true
    && (item.quality_issue_count ?? 0) > 0
    && (item.open_supplement_task_count ?? 0) > 0,
  ).length;
  const storyMaterialSufficiencyBlockedCount = storyItems.filter(item => item.material_sufficiency_blocked === true).length;
  const report: Omit<StoryAgentGeneratedHealthReport, 'markdown'> = {
    schema_version: 'story-agent-generated-health/v1',
    generated_at: new Date().toISOString(),
    generation_activity: generationActivity,
    summary: {
      scanned_story_project_count: storyRecords.length,
      scanned_series_project_count: seriesRecords.length,
      total_target_count: allItems.length,
      ready_count: countByStatus(allItems, 'ready'),
      planned_count: countByStatus(allItems, 'planned'),
      production_gap_count: countByStatus(allItems, 'production_gap'),
      interrupted_count: countByStatus(allItems, 'interrupted'),
      missing_current_story_count: countMissing(allItems, 'current_story', 'story_project'),
      missing_scene_breakdown_count: countMissing(allItems, 'scene_breakdown', 'story_project'),
      missing_gears_segments_count: countMissing(allItems, 'gears_segments', 'story_project'),
      missing_quality_count: countMissing(allItems, 'quality_report', 'story_project'),
      story_quality_passed_count: storyQualityPassedCount,
      story_quality_failed_count: storyQualityFailedCount,
      story_open_supplement_task_count: storyOpenSupplementTaskCount,
      story_quality_passed_with_issue_count: storyQualityPassedWithIssueCount,
      story_quality_passed_with_open_supplement_count: storyQualityPassedWithOpenSupplementCount,
      story_quality_passed_with_issue_and_open_supplement_count: storyQualityPassedWithIssueAndOpenSupplementCount,
      story_material_sufficiency_blocked_count: storyMaterialSufficiencyBlockedCount,
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
      series_ready_count: seriesReadyCount,
      series_planned_only_count: seriesPlannedOnlyCount,
      series_production_gap_count: seriesProductionGapCount,
      series_interrupted_count: seriesInterruptedCount,
      series_governance_attention_count: seriesGovernanceAttentionCount,
      series_missing_story_ref_project_count: seriesMissingStoryRefProjectCount,
      series_contract_evidence_count: seriesContractEvidenceCount,
      series_relink_candidate_count: seriesRelinkCandidateCount,
      series_signoff_portfolio_count: seriesSignoffPortfolioCount,
      series_soft_archive_excluded_count: seriesSoftArchiveExcludedCount,
      signoff_portfolio_target_count: signoffPortfolioItems.length,
      signoff_portfolio_ready_count: countByStatus(signoffPortfolioItems, 'ready'),
      signoff_portfolio_planned_count: countByStatus(signoffPortfolioItems, 'planned'),
      signoff_portfolio_production_gap_count: countByStatus(signoffPortfolioItems, 'production_gap'),
      signoff_portfolio_interrupted_count: countByStatus(signoffPortfolioItems, 'interrupted'),
      soft_archive_excluded_target_count: softArchiveExcludedTargetCount,
      series_seedance_failed_project_count: seriesSeedanceFailedProjectCount,
      series_seedance_failed_item_count: seriesSeedanceFailedItemCount,
      series_seedance_failure_marker_project_count: seriesSeedanceFailureMarkerProjectCount,
      series_seedance_test_fixture_failure_project_count: seriesSeedanceTestFixtureFailureProjectCount,
      series_seedance_test_fixture_failure_item_count: seriesSeedanceTestFixtureFailureItemCount,
    },
    items: reportItems,
    notes: [
      'Read-only audit: scans web/generated project.json, versions/*.json and generated stories without creating or repairing artifacts.',
      'china-culture-kb remains the content and production command layer; image/video/subtitle/final assembly execution stays in GEARS v2.',
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
      storyQualityPassedWithIssueAndOpenSupplementCount > 0
        ? `Quality follow-up semantics: ${storyQualityPassedWithIssueAndOpenSupplementCount} story projects pass the main quality gate while retaining advisory issues and open supplement tasks; treat these as operator follow-up backlog, not hidden quality failures.`
        : '',
      limit && reportItems.length < allItems.length ? `items limited to ${reportItems.length} of ${allItems.length}; summary covers all scanned targets.` : '',
    ].filter(Boolean),
  };
  return {
    ...report,
    markdown: renderMarkdown(report),
  };
}

export async function getStoryAgentBacklogHandoffPackage(
  options: StoryAgentBacklogHandoffOptions = {},
): Promise<StoryAgentBacklogHandoffPackage> {
  const health = options.health ?? await getStoryAgentGeneratedHealth();
  const supplementPackage = options.supplementPackage ?? await exportProjectSupplementCandidatePackage({
    status: 'open',
  }).then(result => result.ok && result.data ? result.data : undefined);
  const healthItems = health.items
    .filter(item => item.signoff_eligible !== false)
    .filter(healthItemNeedsBacklog)
    .map(healthBacklogItem);
  const supplementItems = (supplementPackage?.items ?? []).map(supplementBacklogItem);
  const allItems = [...healthItems, ...supplementItems].sort((a, b) => {
    const priorityDiff = backlogPriorityRank(a.priority) - backlogPriorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    const riskDiff = b.risk_score - a.risk_score;
    if (riskDiff !== 0) return riskDiff;
    return a.project_id.localeCompare(b.project_id);
  });
  const limit = boundedLimit(options.limit);
  const visibleItems = limit ? allItems.slice(0, limit) : allItems;
  const handoff: Omit<StoryAgentBacklogHandoffPackage, 'markdown'> = {
    schema_version: 'story-agent-backlog-handoff/v1',
    generated_at: new Date().toISOString(),
    source_health_schema: health.schema_version,
    source_supplement_candidate_schema: supplementPackage?.schema_version ?? '',
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    summary: summarizeBacklogHandoff(allItems, health, supplementPackage),
    items: visibleItems,
  };
  return {
    ...handoff,
    markdown: renderStoryAgentBacklogHandoffMarkdown(handoff),
  };
}
