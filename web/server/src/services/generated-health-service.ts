import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  StoryAgentGeneratedHealthItem,
  StoryAgentGeneratedHealthReport,
  StoryAgentGeneratedHealthScope,
  StoryAgentGeneratedHealthStatus,
} from '@shared/types.js';

interface GeneratedHealthOptions {
  limit?: number;
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
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || resolve(kbRoot(), '..', 'web', 'generated');
}

function repoWebGeneratedRoot(): string {
  return resolve(import.meta.dirname, '..', '..', '..', '..', 'web', 'generated');
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.filter(item => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function generatedRoots(): string[] {
  if (process.env.WEB_GENERATED_ROOT) return [generatedRoot()];
  return uniquePaths([generatedRoot(), repoWebGeneratedRoot()]);
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
  if (missingContracts.includes('cut_assembly') || missingContracts.includes('subtitles') || missingContracts.includes('final_delivery')) {
    actions.push('导出后期生产指令包，由 GEARS v2 完成剪辑、字幕和最终装配。');
  }
  if (!actions.length) actions.push('当前系列指挥层合同完整，可进入 portfolio readiness 或 GEARS v2 smoke。');
  return actions;
}

function buildSeriesHealthItem(input: GeneratedProjectRecord, availableStoryIds: Set<string>): StoryAgentGeneratedHealthItem {
  const record = input.record;
  const project = seriesProjectRecord(record);
  const plan = seriesPlanRecord(record);
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
  const finalDeliveryReady = ledgerUsable(finalDeliveryLedger) && hasPathLikeOutput(finalDeliveryLedger, ['output_path', 'manifest_path']);
  const contractEvidence = [
    productionItems.length > 0 ? 'seedance_production' : '',
    hasGearsJobLedger ? 'gears_job_ledger' : '',
    thumbnailReadyCount > 0 ? 'thumbnails' : '',
    cutReady ? 'cut_assembly' : '',
    subtitleReady ? 'subtitle_render' : '',
    finalDeliveryReady ? 'final_delivery' : '',
  ].filter(Boolean);
  const relinkCandidate = missingEpisodeStoryIdCount > 0 && contractEvidence.length > 0;
  const missingContracts: string[] = [];
  const evidence: string[] = [
    `episodes=${generatedEpisodeCount}/${episodeCount}`,
    `generated_episode_story_ids=${storyIds.length}`,
    `production_items=${productionItems.length}`,
    `contract_evidence=${contractEvidence.join(',') || 'none'}`,
  ];

  if (missingEpisodeStoryIdCount > 0) missingContracts.push('generated_episode_story_refs');
  if (generatedEpisodeCount > 0 && generatedEpisodeCount < episodeCount) missingContracts.push('remaining_episodes');
  if (generatedEpisodeCount > 0 && productionItems.length === 0) missingContracts.push('shot_production_ledger');
  if (productionItems.length > 0 && readyProductionItems.length === 0) missingContracts.push('shot_returns');
  if (readyProductionItems.length > 0 && thumbnailReadyCount < readyProductionItems.length) missingContracts.push('thumbnails');
  if (readyProductionItems.length > 0 && !cutReady) missingContracts.push('cut_assembly');
  if (cutReady && !subtitleReady) missingContracts.push('subtitles');
  if (cutReady && !finalDeliveryReady) missingContracts.push('final_delivery');
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
  evidence.push(`cut_ready=${cutReady}, subtitle_ready=${subtitleReady}, final_delivery_ready=${finalDeliveryReady}`);

  return {
    scope: 'ai_comic_series_project',
    project_id: seriesProjectId(record, input.dir_name),
    title: seriesProjectTitle(record),
    status,
    risk_score: riskScore(status, uniqueMissingContracts.length),
    updated_at: stringField(project.updated_at ?? record.updated_at ?? project.created_at),
    issue_count: uniqueMissingContracts.length,
    missing_contracts: uniqueMissingContracts,
    evidence,
    recommended_actions: buildSeriesRecommendations(status, uniqueMissingContracts),
    episode_count: episodeCount,
    generated_episode_count: generatedEpisodeCount,
    generated_episode_story_id_count: storyIds.length,
    missing_episode_story_id_count: missingEpisodeStoryIdCount,
    production_item_count: productionItems.length,
    ready_production_item_count: readyProductionItems.length,
    contract_evidence_count: contractEvidence.length,
    relink_candidate: relinkCandidate,
    cut_ready: cutReady,
    subtitle_ready: subtitleReady,
    thumbnail_ready_count: thumbnailReadyCount,
    final_delivery_ready: finalDeliveryReady,
  };
}

function boundedLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isFinite(limit)) return undefined;
  return Math.max(1, Math.min(Math.floor(limit), 200));
}

function renderMarkdown(report: Omit<StoryAgentGeneratedHealthReport, 'markdown'>): string {
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
    `- missing_episode_story_refs: ${report.summary.missing_episode_story_id_count}`,
    `- series_missing_delivery: ${report.summary.series_missing_delivery_count}`,
    `- series_missing_postproduction: ${report.summary.series_missing_postproduction_count}`,
    `- series_ready: ${report.summary.series_ready_count ?? 0}`,
    `- series_planned_only: ${report.summary.series_planned_only_count ?? 0}`,
    `- series_production_gap: ${report.summary.series_production_gap_count ?? 0}`,
    `- series_interrupted: ${report.summary.series_interrupted_count ?? 0}`,
    `- series_governance_attention: ${report.summary.series_governance_attention_count ?? 0}`,
    `- series_missing_story_ref_projects: ${report.summary.series_missing_story_ref_project_count ?? 0}`,
    `- series_contract_evidence: ${report.summary.series_contract_evidence_count ?? 0}`,
    `- series_relink_candidates: ${report.summary.series_relink_candidate_count ?? 0}`,
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

export async function getStoryAgentGeneratedHealth(
  options: GeneratedHealthOptions = {},
): Promise<StoryAgentGeneratedHealthReport> {
  const [storyRecords, seriesRecords, availableStoryIds] = await Promise.all([
    readGeneratedProjectRecords(generatedRoots().map(root => resolve(root, 'projects'))),
    readGeneratedProjectRecords(generatedRoots().map(root => resolve(root, 'ai-comic-series-projects'))),
    readGeneratedStoryIds(),
  ]);
  const storyItems = await Promise.all(storyRecords.map(buildStoryHealthItem));
  const seriesItems = seriesRecords.map(record => buildSeriesHealthItem(record, availableStoryIds));
  const allItems = [...storyItems, ...seriesItems].sort((a, b) => {
    const rankDiff = statusRank(a.status) - statusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    const riskDiff = b.risk_score - a.risk_score;
    if (riskDiff !== 0) return riskDiff;
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });
  const limit = boundedLimit(options.limit);
  const reportItems = limit ? allItems.slice(0, limit) : allItems;
  const seriesReadyCount = countByStatusAndScope(allItems, 'ready', 'ai_comic_series_project');
  const seriesPlannedOnlyCount = countByStatusAndScope(allItems, 'planned', 'ai_comic_series_project');
  const seriesProductionGapCount = countByStatusAndScope(allItems, 'production_gap', 'ai_comic_series_project');
  const seriesInterruptedCount = countByStatusAndScope(allItems, 'interrupted', 'ai_comic_series_project');
  const seriesGovernanceAttentionCount = seriesPlannedOnlyCount + seriesProductionGapCount + seriesInterruptedCount;
  const seriesMissingStoryRefProjectCount = seriesItems.filter(item => (item.missing_episode_story_id_count ?? 0) > 0).length;
  const seriesContractEvidenceCount = seriesItems.filter(item => (item.contract_evidence_count ?? 0) > 0).length;
  const seriesRelinkCandidateCount = seriesItems.filter(item => item.relink_candidate).length;
  const report: Omit<StoryAgentGeneratedHealthReport, 'markdown'> = {
    schema_version: 'story-agent-generated-health/v1',
    generated_at: new Date().toISOString(),
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
      missing_episode_story_id_count: seriesItems.reduce((sum, item) => sum + (item.missing_episode_story_id_count ?? 0), 0),
      series_missing_delivery_count: countMissing(allItems, 'series_delivery', 'ai_comic_series_project')
        + countMissing(allItems, 'shot_production_ledger', 'ai_comic_series_project'),
      series_missing_postproduction_count: ['cut_assembly', 'subtitles', 'thumbnails', 'final_delivery']
        .reduce((sum, contract) => sum + countMissing(allItems, contract, 'ai_comic_series_project'), 0),
      series_ready_count: seriesReadyCount,
      series_planned_only_count: seriesPlannedOnlyCount,
      series_production_gap_count: seriesProductionGapCount,
      series_interrupted_count: seriesInterruptedCount,
      series_governance_attention_count: seriesGovernanceAttentionCount,
      series_missing_story_ref_project_count: seriesMissingStoryRefProjectCount,
      series_contract_evidence_count: seriesContractEvidenceCount,
      series_relink_candidate_count: seriesRelinkCandidateCount,
    },
    items: reportItems,
    notes: [
      'Read-only audit: scans web/generated project.json, versions/*.json and generated stories without creating or repairing artifacts.',
      'china-culture-kb remains the content and production command layer; image/video/subtitle/final assembly execution stays in GEARS v2.',
      seriesGovernanceAttentionCount > 0
        ? `Series governance: ${seriesGovernanceAttentionCount} AI comic series targets are planned-only, production-gap, or interrupted; archive fixtures or repair contracts before using portfolio readiness for GEARS sign-off.`
        : 'Series governance: all scanned AI comic series targets are command-layer ready.',
      seriesRelinkCandidateCount > 0
        ? `Series relink candidates: ${seriesRelinkCandidateCount} interrupted series already have production or postproduction contract evidence; restore missing episode story JSON or update refs before judging GEARS readiness.`
        : '',
      limit && reportItems.length < allItems.length ? `items limited to ${reportItems.length} of ${allItems.length}; summary covers all scanned targets.` : '',
    ].filter(Boolean),
  };
  return {
    ...report,
    markdown: renderMarkdown(report),
  };
}
