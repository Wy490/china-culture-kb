import { dirname, extname, resolve } from 'node:path';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  fail,
  success,
  ErrorCodes,
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
  VIDEO_TYPE_CONFIG,
} from '@shared/types.js';
import type {
  ApiResponse,
  StoryGenerateResult,
  StoryProjectDetail,
  StoryProjectExportPackage,
  StoryProjectListItem,
  StoryProjectMeta,
  StoryProjectStatus,
  StoryProjectVersionSnapshot,
  StoryProjectVersionSummary,
  StoryProjectBatchDeleteResult,
  StoryProjectDeleteResult,
  StoryProjectRetainRecentResult,
  ProjectSupplementTaskListItem,
  SeedanceAssetBatchImportRequest,
  SeedanceAssetBatchImportResult,
  SeedanceAssetFileUploadResult,
  SeedanceAssetHistoryEvent,
  SeedanceAssetHistoryEventType,
  SeedanceAssetReuseRequest,
  SeedanceAssetReuseResult,
  SeedanceGlobalAssetLibrary,
  SeedanceGlobalAssetLibraryItem,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
  SeedanceAssetLibraryUpdateRequest,
  SeedanceShotCallbackImportRequest,
  SeedanceShotCallbackImportResult,
  SeedanceShotCallbackRequest,
  SeedanceShotLedgerItem,
  SeedanceShotProductionStatus,
  SeedanceShotProviderCallbackRequest,
  SeedanceShotProviderCallbackResult,
  SeedanceShotRetryPackage,
  SeedanceShotRetryPackageShot,
  SeedanceShotAutoSelectRequest,
  SeedanceShotProviderQueue,
  SeedanceShotProviderQueueBatch,
  SeedanceShotProviderRecoveryItem,
  SeedanceShotProviderRecoveryRequest,
  SeedanceShotProviderRecoveryResult,
  SeedanceShotProviderRecoverableStatus,
  SeedanceShotProviderSubmitRequest,
  SeedanceShotProviderSubmitResult,
  SeedanceShotStatusBatchUpdateRequest,
  SeedanceShotStatusBatchUpdateResult,
  SeedanceShotStatusUpdateRequest,
  SeedanceShotVersionSelectRequest,
  KnowledgeSupplementTaskUpdateRequest,
  KnowledgeSupplementTaskStatus,
  StorySceneRegenerateRequest,
  StoryQualityRepairRequest,
  StoryRepairTrace,
  VideoType,
  GearsDeliveryPackage,
  GearsWebhookStatus,
  GearsVideoResult,
  StoryProductionBoard,
  StoryProductionBoardExportFile,
  StoryProductionBoardExportPackage,
  StoryProductionBoardExportRecord,
  StoryProductionBoardRepairExportResult,
  StoryProductionBoardRepairRequest,
  StoryProductionBoardRepairResult,
} from '@shared/types.js';
import { buildRegenerationNote, regenerateSceneInStory } from './story-regenerate-service.js';
import { ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { enrichStoryQualityReport } from './quality-workflow-service.js';
import { repairStoryWithQualityWorkflow } from './quality-repair-service.js';
import {
  buildStoryProductionBoard,
  seedanceShotProductionId,
  syncSeedanceShotLedgerWithShots,
} from './production-board-service.js';
import { repairStoryWithProductionBoard } from './production-board-repair-service.js';

const ALL_VIDEO_TYPES: VideoType[] = [
  'character_story', 'historical_drama', 'legend_story',
  'culture_promo', 'heritage_promo', 'city_brand_promo',
  'scene_short', 'landscape_mood',
  'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
  'children_story', 'social_short', 'ai_comic_drama',
];

type StoredStoryFile = StoryGenerateResult & {
  _request_meta?: Record<string, unknown>;
};

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || resolve(kbRoot(), '..', 'web', 'generated');
}

function storiesRoot(): string {
  return resolve(generatedRoot(), 'stories');
}

function projectsRoot(): string {
  return resolve(generatedRoot(), 'projects');
}

function projectDir(projectId: string): string {
  return resolve(projectsRoot(), projectId);
}

function projectMetaPath(projectId: string): string {
  return resolve(projectDir(projectId), 'project.json');
}

function projectVersionsDir(projectId: string): string {
  return resolve(projectDir(projectId), 'versions');
}

function projectVersionPath(projectId: string, versionId: string): string {
  return resolve(projectVersionsDir(projectId), `${versionId}.json`);
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

function cleanStory(data: StoredStoryFile): StoryGenerateResult {
  const cleaned = { ...data } as Record<string, unknown>;
  delete cleaned._request_meta;
  return cleaned as unknown as StoryGenerateResult;
}

function storyCreatedAt(story: StoredStoryFile): string {
  return typeof story._request_meta?.created_at === 'string'
    ? story._request_meta.created_at
    : new Date().toISOString();
}

function inferProjectStatus(story: StoryGenerateResult, versionCount: number): StoryProjectStatus {
  if (versionCount > 1) return 'edited';
  if (!story.gears_segments || story.gears_segments.length === 0) return 'draft';
  return 'draft';
}

function countOpenSupplementTasks(story: StoryGenerateResult): number {
  return story.supplement_tasks?.filter(task => task.status === 'open').length ?? 0;
}

function qualitySummary(story: Pick<StoryGenerateResult, 'quality_report'>): {
  quality_passed?: boolean;
  genre_score?: number;
  quality_issue_count?: number;
} {
  if (!story.quality_report) return {};
  return {
    quality_passed: story.quality_report.passed,
    genre_score: story.quality_report.genre_score,
    quality_issue_count: story.quality_report.issues.length,
  };
}

function storySourcePath(story: Pick<StoryGenerateResult, 'storyId' | 'video_type'>): string {
  return resolve(storiesRoot(), story.video_type, `${story.storyId}.json`);
}

function storySourcePathsForId(storyId: string): string[] {
  return ALL_VIDEO_TYPES.map(videoType => resolve(storiesRoot(), videoType, `${storyId}.json`));
}

export function buildProjectId(storyId: string, videoType: string): string {
  return `${storyId}--${videoType}`;
}

function buildVersionId(projectId: string, versionNumber: number): string {
  return `${projectId}-v${versionNumber}`;
}

function parseProjectId(projectId: string): { storyId: string; videoType: VideoType } | null {
  const marker = '--';
  const markerIndex = projectId.indexOf(marker);
  if (markerIndex === -1) return null;

  const storyId = projectId.slice(0, markerIndex);
  const videoType = projectId.slice(markerIndex + marker.length) as VideoType;
  if (!ALL_VIDEO_TYPES.includes(videoType)) return null;
  return { storyId, videoType };
}

function toVersionSummary(snapshot: StoryProjectVersionSnapshot): StoryProjectVersionSummary {
  const qualitySource = snapshot.quality_report
    ? { quality_report: snapshot.quality_report }
    : snapshot.story;
  const productionBoardRepairTrace = snapshot.change_type === 'production_board_repair'
    ? snapshot.story.production_board_repair_trace?.[snapshot.story.production_board_repair_trace.length - 1]
    : undefined;
  return {
    version_id: snapshot.version_id,
    created_at: snapshot.created_at,
    change_type: snapshot.change_type,
    scene_ids_changed: snapshot.scene_ids_changed,
    note: snapshot.note,
    production_board_repair_trace: productionBoardRepairTrace,
    production_board_export: snapshot.production_board_export,
    ...qualitySummary(qualitySource),
  };
}

function buildProjectMeta(
  story: StoryGenerateResult,
  createdAt: string,
  currentVersionId: string,
  versionCount: number,
): StoryProjectMeta {
  return {
    project_id: story.project_id ?? buildProjectId(story.storyId, story.video_type),
    current_story_id: story.storyId,
    title: story.title,
    source_domain: 'china_culture',
    source_entry: story.source_entry,
    video_type: story.video_type,
    presentation_style: story.presentation_style,
    story_structure: story.story_structure,
    status: inferProjectStatus(story, versionCount),
    created_at: createdAt,
    updated_at: createdAt,
    current_version_id: currentVersionId,
    version_count: versionCount,
    scene_count: story.scene_breakdown?.length ?? 0,
    has_gears_segments: (story.gears_segments?.length ?? 0) > 0,
    credibility_note: story.credibility_note,
    logline: story.logline,
    model_profile_id: story.model_profile_id,
    generation_source: story.generation_source,
    generation_mode: story.generation_mode ?? 'local_only',
    generation_used_fallback: story.generation_used_fallback ?? false,
    ...qualitySummary(story),
    open_supplement_task_count: countOpenSupplementTasks(story),
    gears_video_status: story.gears_video?.status,
    gears_video_url: story.gears_video?.video_url,
    gears_video_thumbnail_url: story.gears_video?.thumbnail_url,
  };
}

const SEEDANCE_ASSET_HISTORY_LIMIT = 25;

function normalizeSeedanceAssetHistory(history?: SeedanceAssetHistoryEvent[]): SeedanceAssetHistoryEvent[] | undefined {
  const events = (history ?? [])
    .filter(event => event.event_id?.trim() && event.event_type && event.created_at)
    .map(event => ({
      event_id: event.event_id.trim(),
      event_type: event.event_type,
      created_at: event.created_at,
      upload_status: event.upload_status,
      provider: event.provider,
      provider_asset_id: event.provider_asset_id,
      file_url: event.file_url,
      file_id: event.file_id,
      local_path: event.local_path,
      original_filename: event.original_filename,
      mime_type: event.mime_type,
      size_bytes: event.size_bytes,
      source_project_id: event.source_project_id,
      source_project_title: event.source_project_title,
      source_asset_id: event.source_asset_id,
      note: event.note,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-SEEDANCE_ASSET_HISTORY_LIMIT);
  return events.length ? events : undefined;
}

function seedanceAssetHistoryEvent(params: {
  asset: SeedanceAssetLibraryItem;
  eventType: SeedanceAssetHistoryEventType;
  createdAt: string;
  note?: string;
  sourceProject?: StoryProjectMeta;
  sourceAssetId?: string;
}): SeedanceAssetHistoryEvent {
  return {
    event_id: `seedance-asset-event-${params.createdAt.replace(/[^0-9]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`,
    event_type: params.eventType,
    created_at: params.createdAt,
    upload_status: params.asset.upload_status,
    provider: params.asset.provider,
    provider_asset_id: params.asset.provider_asset_id,
    file_url: params.asset.file_url,
    file_id: params.asset.file_id,
    local_path: params.asset.local_path,
    original_filename: params.asset.original_filename,
    mime_type: params.asset.mime_type,
    size_bytes: params.asset.size_bytes,
    source_project_id: params.sourceProject?.project_id,
    source_project_title: params.sourceProject?.title,
    source_asset_id: params.sourceAssetId,
    note: params.note,
  };
}

function appendSeedanceAssetHistory(
  previous: SeedanceAssetLibraryItem | undefined,
  event: SeedanceAssetHistoryEvent,
): SeedanceAssetHistoryEvent[] {
  return [...(normalizeSeedanceAssetHistory(previous?.history) ?? []), event]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-SEEDANCE_ASSET_HISTORY_LIMIT);
}

function normalizeSeedanceAssetLibrary(library?: SeedanceAssetLibrary): SeedanceAssetLibrary {
  return {
    schema_version: 'seedance-asset-library/v1',
    updated_at: library?.updated_at,
    items: (library?.items ?? [])
      .filter(item => item.label?.trim())
      .map(item => ({
        asset_id: item.asset_id || seedanceAssetId(item.kind, item.label),
        kind: item.kind,
        label: item.label.trim(),
        modality: item.modality ?? defaultSeedanceAssetModality(item.kind),
        role: item.role ?? defaultSeedanceAssetRole(item.kind),
        reference_slot: item.reference_slot,
        file_url: item.file_url,
        file_id: item.file_id,
        local_path: item.local_path,
        original_filename: item.original_filename,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        provider: item.provider,
        provider_asset_id: item.provider_asset_id,
        upload_status: item.upload_status,
        upload_error: item.upload_error,
        history: normalizeSeedanceAssetHistory(item.history),
        description: item.description,
        updated_at: item.updated_at ?? library?.updated_at ?? new Date(0).toISOString(),
      })),
  };
}

function defaultSeedanceAssetModality(kind: SeedanceAssetLibraryItem['kind']): SeedanceAssetLibraryItem['modality'] {
  if (kind === 'audio') return 'audio';
  if (kind === 'camera') return 'video';
  return 'image';
}

function defaultSeedanceAssetRole(kind: SeedanceAssetLibraryItem['kind']): SeedanceAssetLibraryItem['role'] {
  if (kind === 'character') return 'character_reference';
  if (kind === 'location') return 'location_reference';
  if (kind === 'prop') return 'prop_reference';
  if (kind === 'camera') return 'camera_reference';
  return 'sound_reference';
}

function seedanceAssetId(kind: SeedanceAssetLibraryItem['kind'], label: string): string {
  return `seedance-asset-${kind}-${slugifySeedanceAssetLabel(label)}`;
}

function seedanceAssetLookupKey(kind: SeedanceAssetLibraryItem['kind'], label: string): string {
  return `${kind}:${label.trim().toLowerCase()}`;
}

function slugifySeedanceAssetLabel(value: string): string {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii.slice(0, 80);
  return encodeURIComponent(value.trim()).replace(/%/g, '').slice(0, 80) || 'asset';
}

function appendSeedanceShotVideoVersion(params: {
  existing?: SeedanceShotLedgerItem;
  request: SeedanceShotStatusUpdateRequest;
  updatedAt: string;
}): SeedanceShotLedgerItem['versions'] {
  const versions = params.existing?.versions ?? [];
  const shouldAppend = Boolean(
    params.request.video_url
    || params.request.provider_job_id
    || params.request.failure_reason
    || params.request.status === 'ready'
    || params.request.status === 'failed'
  );
  if (!shouldAppend) return versions;

  const nextVersion = {
    version_id: `${seedanceShotProductionId(params.request.shot_id)}-v${versions.length + 1}`,
    status: params.request.status,
    created_at: params.updatedAt,
    provider_job_id: params.request.provider_job_id ?? params.existing?.provider_job_id,
    video_url: params.request.video_url ?? params.existing?.video_url,
    failure_reason: params.request.failure_reason,
    note: params.request.note,
    quality_score: params.request.quality_score,
    review_note: params.request.review_note,
  };
  const last = versions[versions.length - 1];
  if (
    last
    && last.status === nextVersion.status
    && last.provider_job_id === nextVersion.provider_job_id
    && last.video_url === nextVersion.video_url
    && last.failure_reason === nextVersion.failure_reason
  ) {
    return versions;
  }
  return [...versions, nextVersion].slice(-12);
}

function selectedSeedanceShotVersionId(
  versions: SeedanceShotLedgerItem['versions'],
  currentVersionId?: string,
): string | undefined {
  if (currentVersionId && versions.some(version => version.version_id === currentVersionId)) {
    return currentVersionId;
  }
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    const version = versions[index];
    if (version.status === 'ready' && version.video_url) return version.version_id;
  }
  return undefined;
}

function bestReadySeedanceShotVersion(
  item: SeedanceShotLedgerItem,
  minQualityScore?: number,
): SeedanceShotLedgerItem['versions'][number] | undefined {
  return item.versions
    .filter(version => version.status === 'ready' && Boolean(version.video_url))
    .filter(version =>
      minQualityScore === undefined
      || (typeof version.quality_score === 'number' && version.quality_score >= minQualityScore)
    )
    .sort((a, b) => {
      const aScore = typeof a.quality_score === 'number' ? a.quality_score : -1;
      const bScore = typeof b.quality_score === 'number' ? b.quality_score : -1;
      if (aScore !== bScore) return bScore - aScore;
      return b.created_at.localeCompare(a.created_at);
    })[0];
}

function normalizeSeedanceShotCallbackStatus(
  status: string | undefined,
  hasVideoUrl: boolean,
  hasFailureReason: boolean,
): SeedanceShotProductionStatus {
  const normalized = (status ?? '').trim().toLowerCase();
  if (['ready', 'completed', 'complete', 'succeeded', 'success', 'done', 'finished'].includes(normalized)) {
    return 'ready';
  }
  if (['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled'].includes(normalized)) {
    return 'failed';
  }
  if (['processing', 'running', 'generating', 'in_progress', 'in-progress'].includes(normalized)) {
    return 'processing';
  }
  if (['submitted', 'queued', 'pending', 'accepted'].includes(normalized)) {
    return 'submitted';
  }
  if (['skipped', 'skip'].includes(normalized)) {
    return 'skipped';
  }
  if (hasFailureReason) return 'failed';
  if (hasVideoUrl) return 'ready';
  return 'processing';
}

function seedanceShotStatusText(status: SeedanceShotProductionStatus): string {
  const map: Record<SeedanceShotProductionStatus, string> = {
    not_started: '未开始',
    prompt_exported: '待提交',
    submitted: '已提交',
    processing: '处理中',
    ready: '已完成',
    failed: '失败',
    skipped: '跳过',
  };
  return map[status];
}

function seedanceProviderJobId(provider: string, shotId: string, index: number): string {
  const providerSlug = slugifySeedanceAssetLabel(provider).slice(0, 40) || 'provider';
  const shotSlug = slugifySeedanceAssetLabel(shotId).slice(0, 40) || `shot-${index + 1}`;
  return `${providerSlug}-${shotSlug}-${randomUUID().slice(0, 8)}`;
}

function seedanceProviderQueueId(provider: string, updatedAt: string): string {
  const providerSlug = slugifySeedanceAssetLabel(provider).slice(0, 40) || 'provider';
  const timestamp = updatedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${providerSlug}-queue-${timestamp}-${randomUUID().slice(0, 6)}`;
}

function appendSeedanceProviderQueueBatch(
  existing: SeedanceShotProviderQueue | undefined,
  batch: SeedanceShotProviderQueueBatch,
): SeedanceShotProviderQueue {
  const batches = [
    ...(existing?.batches ?? []).filter(item => item.queue_id !== batch.queue_id),
    batch,
  ].slice(-12);
  return {
    schema_version: 'seedance-provider-queue/v1',
    updated_at: batch.updated_at,
    latest_queue_id: batch.queue_id,
    batches,
  };
}

function seedanceShotWaitingMinutes(item: SeedanceShotLedgerItem, nowMs: number): number {
  const timestamp = Date.parse(item.submitted_at ?? item.updated_at);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((nowMs - timestamp) / 60000));
}

function callbackStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function callbackNumberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function resolveSeedanceShotCallbackUpdate(
  detail: StoryProjectDetail,
  callback: SeedanceShotCallbackRequest,
): SeedanceShotStatusUpdateRequest | string {
  const provider = callbackStringField(callback.provider);
  const providerJobId = callbackStringField(
    callback.provider_job_id ?? callback.providerJobId ?? callback.job_id ?? callback.jobId,
  );
  const providerQueueId = callbackStringField(
    callback.provider_queue_id ?? callback.providerQueueId ?? callback.queue_id ?? callback.queueId,
  );
  const providerQueuePosition = callbackNumberField(
    callback.provider_queue_position
      ?? callback.providerQueuePosition
      ?? callback.queue_position
      ?? callback.queuePosition,
  );
  const board = buildStoryProductionBoard(detail.current_story, {
    seedanceAssetLibrary: detail.project.seedance_asset_library,
    seedanceShotLedger: detail.project.seedance_shot_ledger,
  });
  const ledger = board.seedance_shot_ledger;
  const queueMatches = providerQueueId
    ? ledger.items.filter(item => item.provider_queue_id === providerQueueId)
    : [];
  let matchedItem = providerJobId
    ? ledger.items.find(item =>
      item.provider_job_id === providerJobId
      || item.versions.some(version => version.provider_job_id === providerJobId)
    )
    : undefined;
  if (!matchedItem && providerQueueId && providerQueuePosition !== undefined) {
    matchedItem = queueMatches.find(item => item.provider_queue_position === providerQueuePosition);
  }
  if (!matchedItem && providerQueueId && providerQueuePosition === undefined && queueMatches.length === 1) {
    [matchedItem] = queueMatches;
  }
  const shotId = callbackStringField(callback.shot_id ?? callback.shotId) ?? matchedItem?.shot_id;
  if (!shotId) {
    if (providerQueueId && queueMatches.length > 1 && providerQueuePosition === undefined) {
      return `Seedance callback queue "${providerQueueId}" matched multiple shots; provide provider_queue_position/queue_position or shot_id`;
    }
    if (providerQueueId && !queueMatches.length) {
      return `Seedance callback queue "${providerQueueId}" was not found in shot ledger`;
    }
    return providerJobId
      ? `Seedance callback job "${providerJobId}" was not found in shot ledger`
      : 'Seedance callback requires shot_id, a known provider_job_id/job_id, or a known provider_queue_id/queue_id';
  }

  const videoUrl = callbackStringField(callback.video_url ?? callback.videoUrl ?? callback.url);
  const explicitFailureReason = callbackStringField(
    callback.failure_reason ?? callback.failureReason ?? callback.error,
  );
  const callbackMessage = callbackStringField(callback.message);
  const status = normalizeSeedanceShotCallbackStatus(callback.status, Boolean(videoUrl), Boolean(explicitFailureReason));
  const failureReason = status === 'failed'
    ? explicitFailureReason ?? callbackMessage
    : undefined;
  return {
    shot_id: shotId,
    status,
    provider: provider ?? matchedItem?.provider,
    provider_job_id: providerJobId,
    provider_queue_id: providerQueueId ?? matchedItem?.provider_queue_id,
    provider_queue_position: providerQueuePosition ?? matchedItem?.provider_queue_position,
    video_url: videoUrl,
    failure_reason: failureReason,
    note: callbackStringField(callback.note)
      ?? callbackMessage
      ?? `Seedance 回传导入：${seedanceShotStatusText(status)}`,
    increment_retry: Boolean(callback.increment_retry ?? callback.incrementRetry),
    quality_score: callbackNumberField(callback.quality_score ?? callback.qualityScore),
    review_note: callbackStringField(callback.review_note ?? callback.reviewNote),
  };
}

function shouldRetrySeedanceShot(item?: SeedanceShotLedgerItem): boolean {
  if (!item) return true;
  if (item.status === 'skipped') return false;
  if (item.status === 'ready' && item.video_url) return false;
  return true;
}

function seedanceShotRetrySuggestedAction(item?: SeedanceShotLedgerItem): string {
  if (!item) return '尚未提交，按原提示词提交生成。';
  if (item.status === 'failed') {
    return item.retry_count > 0 ? '检查失败原因后再次提交，必要时微调负向约束。' : '按原提示词重新提交一次。';
  }
  if (item.status === 'ready' && !item.video_url) return '状态已完成但缺少视频 URL，优先向平台补拉结果。';
  if (item.status === 'processing' || item.status === 'submitted') return '确认平台任务是否超时；如无结果则重新提交。';
  if (item.status === 'prompt_exported' || item.status === 'not_started') return '按提示词提交生成。';
  return '人工复核后决定是否重试。';
}

function uniqueSeedanceNotes(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].slice(-12);
}

async function readStoryFromSource(projectId: string): Promise<{ story: StoryGenerateResult; createdAt: string } | null> {
  const parsed = parseProjectId(projectId);
  if (!parsed) return null;

  const filePath = storySourcePath({ storyId: parsed.storyId, video_type: parsed.videoType });
  if (!(await pathExists(filePath))) return null;

  const raw = await readJsonFile<StoredStoryFile>(filePath);
  return { story: cleanStory(raw), createdAt: storyCreatedAt(raw) };
}

async function readAllStoriesForMigration(): Promise<Array<{ story: StoryGenerateResult; createdAt: string }>> {
  const results: Array<{ story: StoryGenerateResult; createdAt: string }> = [];

  for (const videoType of ALL_VIDEO_TYPES) {
    const dirPath = resolve(storiesRoot(), videoType);
    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readJsonFile<StoredStoryFile>(resolve(dirPath, file));
        results.push({ story: cleanStory(raw), createdAt: storyCreatedAt(raw) });
      } catch {
        continue;
      }
    }
  }

  return results;
}

function buildInitialProjectSnapshot(
  story: StoryGenerateResult,
  createdAt: string,
): { meta: StoryProjectMeta; snapshot: StoryProjectVersionSnapshot } {
  const projectId = story.project_id ?? buildProjectId(story.storyId, story.video_type);
  const versionId = story.current_version_id ?? buildVersionId(projectId, 1);
  const storyWithProject = {
    ...story,
    project_id: projectId,
    current_version_id: versionId,
  };

  return {
    meta: buildProjectMeta(storyWithProject, createdAt, versionId, 1),
    snapshot: {
      project_id: projectId,
      version_id: versionId,
      created_at: createdAt,
      change_type: 'initial_generation',
      scene_ids_changed: [],
      quality_report: storyWithProject.quality_report,
      story: storyWithProject,
    },
  };
}

async function ensureProjectFromStory(story: StoryGenerateResult, createdAt: string): Promise<StoryProjectMeta> {
  const { meta, snapshot } = buildInitialProjectSnapshot(story, createdAt);
  const existingMeta = await readProjectMeta(meta.project_id);
  if (existingMeta) return existingMeta;

  await writeJsonFile(projectVersionPath(meta.project_id, snapshot.version_id), snapshot);
  await writeJsonFile(projectMetaPath(meta.project_id), meta);
  return meta;
}

async function ensureProjectsFromStories(): Promise<void> {
  const stories = await readAllStoriesForMigration();
  for (const item of stories) {
    await ensureProjectFromStory(item.story, item.createdAt);
  }
}

async function readProjectMeta(projectId: string): Promise<StoryProjectMeta | null> {
  const metaFile = projectMetaPath(projectId);
  if (!(await pathExists(metaFile))) return null;
  try {
    return await readJsonFile<StoryProjectMeta>(metaFile);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[project-service] Skipping unreadable project metadata: ${metaFile} (${message})`);
    return null;
  }
}

async function readVersionSnapshots(projectId: string): Promise<StoryProjectVersionSnapshot[]> {
  const versionsDir = projectVersionsDir(projectId);
  let files: string[];
  try {
    files = await readdir(versionsDir);
  } catch {
    return [];
  }

  const snapshots: StoryProjectVersionSnapshot[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(resolve(versionsDir, file));
      snapshots.push(snapshot);
    } catch {
      continue;
    }
  }

  snapshots.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return snapshots;
}

async function ensureProjectExists(projectId: string): Promise<StoryProjectMeta | null> {
  const existing = await readProjectMeta(projectId);
  if (existing) return existing;

  const sourceStory = await readStoryFromSource(projectId);
  if (!sourceStory) return null;
  return ensureProjectFromStory(sourceStory.story, sourceStory.createdAt);
}

async function persistProjectVersion(
  project: StoryProjectMeta,
  story: StoryGenerateResult,
  changeType: StoryProjectVersionSnapshot['change_type'],
  sceneIdsChanged: number[],
  note?: string,
): Promise<StoryProjectMeta> {
  const nextVersionNumber = project.version_count + 1;
  const createdAt = new Date().toISOString();
  const versionId = buildVersionId(project.project_id, nextVersionNumber);
  const updatedStory: StoryGenerateResult = {
    ...story,
    project_id: project.project_id,
    current_version_id: versionId,
  };

  const snapshot: StoryProjectVersionSnapshot = {
    project_id: project.project_id,
    version_id: versionId,
    created_at: createdAt,
    change_type: changeType,
    scene_ids_changed: sceneIdsChanged,
    note,
    quality_report: updatedStory.quality_report,
    story: updatedStory,
  };

  const updatedMeta: StoryProjectMeta = {
    ...project,
    current_story_id: updatedStory.storyId,
    current_version_id: versionId,
    version_count: nextVersionNumber,
    updated_at: createdAt,
    status: inferProjectStatus(updatedStory, nextVersionNumber),
    scene_count: updatedStory.scene_breakdown.length,
    has_gears_segments: updatedStory.gears_segments.length > 0,
    title: updatedStory.title,
    logline: updatedStory.logline,
    credibility_note: updatedStory.credibility_note,
    model_profile_id: updatedStory.model_profile_id,
    generation_source: updatedStory.generation_source,
    generation_mode: updatedStory.generation_mode ?? 'local_only',
    generation_used_fallback: updatedStory.generation_used_fallback ?? false,
    ...qualitySummary(updatedStory),
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
    gears_video_status: updatedStory.gears_video?.status,
    gears_video_url: updatedStory.gears_video?.video_url,
    gears_video_thumbnail_url: updatedStory.gears_video?.thumbnail_url,
  };

  await writeJsonFile(projectVersionPath(project.project_id, versionId), snapshot);
  await writeJsonFile(projectMetaPath(project.project_id), updatedMeta);
  return updatedMeta;
}

async function updateProjectVersionProductionBoardExport(
  projectId: string,
  versionId: string,
  productionBoardExport: StoryProductionBoardExportRecord,
): Promise<void> {
  const versionPath = projectVersionPath(projectId, versionId);
  if (!(await pathExists(versionPath))) return;

  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(versionPath);
  await writeJsonFile(versionPath, {
    ...snapshot,
    production_board_export: productionBoardExport,
  });
}

export async function createProjectFromGeneratedStory(
  story: StoryGenerateResult,
  createdAt: string,
): Promise<StoryGenerateResult> {
  const meta = await ensureProjectFromStory(story, createdAt);
  return {
    ...story,
    project_id: meta.project_id,
    current_version_id: meta.current_version_id,
  };
}

export async function listProjects(): Promise<ApiResponse<StoryProjectListItem[]>> {
  await ensureProjectsFromStories();

  let projectIds: string[];
  try {
    projectIds = await readdir(projectsRoot());
  } catch {
    return success([]);
  }

  const projects: StoryProjectListItem[] = [];
  for (const projectId of projectIds) {
    const meta = await readProjectMeta(projectId);
    if (!meta) continue;
    projects.push(meta);
  }

  projects.sort((a, b) => {
    if (!a.updated_at && !b.updated_at) return a.title.localeCompare(b.title, 'zh-CN');
    if (!a.updated_at) return 1;
    if (!b.updated_at) return -1;
    return b.updated_at.localeCompare(a.updated_at);
  });

  return success(projects);
}

async function readAllProjectMetas(): Promise<StoryProjectMeta[]> {
  await ensureProjectsFromStories();
  let projectIds: string[];
  try {
    projectIds = await readdir(projectsRoot());
  } catch {
    return [];
  }
  const projects: StoryProjectMeta[] = [];
  for (const projectId of projectIds) {
    const meta = await readProjectMeta(projectId);
    if (meta) projects.push(meta);
  }
  return projects;
}

export async function getProject(projectId: string): Promise<ApiResponse<StoryProjectDetail>> {
  const project = await ensureProjectExists(projectId);
  if (!project) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found`);
  }

  const versions = await readVersionSnapshots(projectId);
  const currentVersion = versions.find(version => version.version_id === project.current_version_id) ?? versions[0];
  if (!currentVersion) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" has no version snapshots`);
  }

  return success({
    project,
    current_story: normalizeStoryGenerationFields(currentVersion.story),
    versions: versions.map(toVersionSummary),
  });
}

export async function updateProjectSeedanceAssetLibrary(
  projectId: string,
  request: SeedanceAssetLibraryUpdateRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const project = await ensureProjectExists(projectId);
  if (!project) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found`);
  }
  const updatedAt = new Date().toISOString();
  const current = normalizeSeedanceAssetLibrary(project.seedance_asset_library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  for (const item of request.items) {
    const label = item.label.trim();
    const kind = item.kind;
    const assetId = item.asset_id?.trim() || seedanceAssetId(kind, label);
    const previous = byId.get(assetId);
    const asset: SeedanceAssetLibraryItem = {
      asset_id: assetId,
      kind,
      label,
      modality: item.modality ?? previous?.modality ?? defaultSeedanceAssetModality(kind),
      role: item.role ?? previous?.role ?? defaultSeedanceAssetRole(kind),
      reference_slot: item.reference_slot?.trim() || previous?.reference_slot,
      file_url: item.file_url?.trim() || previous?.file_url,
      file_id: item.file_id?.trim() || previous?.file_id,
      local_path: item.local_path?.trim() || previous?.local_path,
      original_filename: item.original_filename?.trim() || previous?.original_filename,
      mime_type: item.mime_type?.trim() || previous?.mime_type,
      size_bytes: item.size_bytes ?? previous?.size_bytes,
      provider: item.provider?.trim() || previous?.provider,
      provider_asset_id: item.provider_asset_id?.trim() || previous?.provider_asset_id,
      upload_status: item.upload_status ?? previous?.upload_status,
      upload_error: item.upload_error?.trim() || previous?.upload_error,
      description: item.description?.trim() || previous?.description,
      updated_at: updatedAt,
    };
    byId.set(assetId, {
      ...asset,
      history: appendSeedanceAssetHistory(previous, seedanceAssetHistoryEvent({
        asset,
        eventType: 'manual_bind',
        createdAt: updatedAt,
        note: item.description?.trim() || '前端手动绑定素材',
      })),
    });
  }
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_asset_library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: updatedAt,
      items: [...byId.values()].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.label.localeCompare(b.label, 'zh-CN');
      }),
    },
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  return getProject(project.project_id);
}

export async function importProjectSeedanceAssetBatch(
  projectId: string,
  request: SeedanceAssetBatchImportRequest,
): Promise<ApiResponse<SeedanceAssetBatchImportResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const updatedAt = new Date().toISOString();
  const current = normalizeSeedanceAssetLibrary(project.seedance_asset_library);
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const reportAssets = board.seedance_asset_report.assets;
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const reportById = new Map(reportAssets.map(item => [item.asset_id, item]));
  const reportByKey = new Map(reportAssets.map(item => [seedanceAssetLookupKey(item.kind, item.label), item]));
  const skippedItems: SeedanceAssetBatchImportResult['skipped_items'] = [];
  const updatedAssetIds: string[] = [];
  let matchedExistingCount = 0;

  request.items.forEach((item, index) => {
    const label = item.label?.trim();
    const kind = item.kind;
    const directAssetId = item.asset_id?.trim();
    const reportMatch = directAssetId
      ? reportById.get(directAssetId)
      : kind && label
        ? reportByKey.get(seedanceAssetLookupKey(kind, label))
        : undefined;
    const previous = directAssetId ? byId.get(directAssetId) : undefined;
    const resolvedKind = kind ?? reportMatch?.kind ?? previous?.kind;
    const resolvedLabel = label || reportMatch?.label || previous?.label;
    const assetId = directAssetId || reportMatch?.asset_id || (
      resolvedKind && resolvedLabel ? seedanceAssetId(resolvedKind, resolvedLabel) : undefined
    );
    if (!assetId || !resolvedKind || !resolvedLabel) {
      skippedItems.push({
        index,
        reason: '缺少 asset_id，或缺少可推断的 label+kind',
        asset_id: directAssetId,
        label,
      });
      return;
    }
    const hasImportValue = Boolean(
      item.file_url?.trim()
      || item.file_id?.trim()
      || item.local_path?.trim()
      || item.provider_asset_id?.trim()
      || item.upload_status
    );
    if (!hasImportValue) {
      skippedItems.push({
        index,
        reason: '缺少 file_url、file_id、local_path、provider_asset_id 或 upload_status',
        asset_id: assetId,
        label: resolvedLabel,
      });
      return;
    }

    const existing = byId.get(assetId);
    if (existing || reportMatch) matchedExistingCount += 1;
    const asset: SeedanceAssetLibraryItem = {
      asset_id: assetId,
      kind: resolvedKind,
      label: resolvedLabel,
      modality: item.modality ?? existing?.modality ?? reportMatch?.modality ?? defaultSeedanceAssetModality(resolvedKind),
      role: item.role ?? existing?.role ?? reportMatch?.role ?? defaultSeedanceAssetRole(resolvedKind),
      reference_slot: item.reference_slot?.trim() || existing?.reference_slot || reportMatch?.reference_slot,
      file_url: item.file_url?.trim() || existing?.file_url,
      file_id: item.file_id?.trim() || existing?.file_id,
      local_path: item.local_path?.trim() || existing?.local_path,
      original_filename: item.original_filename?.trim() || existing?.original_filename,
      mime_type: item.mime_type?.trim() || existing?.mime_type,
      size_bytes: item.size_bytes ?? existing?.size_bytes,
      provider: item.provider?.trim() || existing?.provider,
      provider_asset_id: item.provider_asset_id?.trim() || existing?.provider_asset_id,
      upload_status: item.upload_status ?? existing?.upload_status,
      upload_error: item.upload_error?.trim() || existing?.upload_error,
      description: item.description?.trim() || existing?.description || reportMatch?.prompt_usage,
      updated_at: updatedAt,
    };
    byId.set(assetId, {
      ...asset,
      history: appendSeedanceAssetHistory(existing, seedanceAssetHistoryEvent({
        asset,
        eventType: 'batch_import',
        createdAt: updatedAt,
        note: request.source_note ?? item.description?.trim() ?? '批量导入素材清单',
      })),
    });
    updatedAssetIds.push(assetId);
  });

  if (!updatedAssetIds.length) {
    return success({
      detail: detail.data,
      imported_count: 0,
      matched_existing_count: 0,
      skipped_count: skippedItems.length,
      updated_asset_ids: [],
      skipped_items: skippedItems,
      source_note: request.source_note,
    });
  }

  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_asset_library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: updatedAt,
      items: [...byId.values()].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.label.localeCompare(b.label, 'zh-CN');
      }),
    },
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  const nextDetail = await getProject(project.project_id);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      nextDetail.error?.message ?? `Project "${projectId}" not found after Seedance asset import`,
    );
  }
  return success({
    detail: nextDetail.data,
    imported_count: updatedAssetIds.length,
    matched_existing_count: matchedExistingCount,
    skipped_count: skippedItems.length,
    updated_asset_ids: [...new Set(updatedAssetIds)],
    skipped_items: skippedItems,
    source_note: request.source_note,
  });
}

export async function uploadProjectSeedanceAssetFile(
  projectId: string,
  request: {
    asset_id?: string;
    label?: string;
    kind?: SeedanceAssetLibraryItem['kind'];
    modality?: SeedanceAssetLibraryItem['modality'];
    role?: SeedanceAssetLibraryItem['role'];
    reference_slot?: string;
    description?: string;
    file: {
      original_filename: string;
      mime_type: string;
      buffer: Buffer;
    };
  },
): Promise<ApiResponse<SeedanceAssetFileUploadResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }
  if (!request.file.buffer.length) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'Uploaded Seedance asset file is empty');
  }

  const { project, current_story } = detail.data;
  const updatedAt = new Date().toISOString();
  const current = normalizeSeedanceAssetLibrary(project.seedance_asset_library);
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const reportAssets = board.seedance_asset_report.assets;
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const reportById = new Map(reportAssets.map(item => [item.asset_id, item]));
  const reportByKey = new Map(reportAssets.map(item => [seedanceAssetLookupKey(item.kind, item.label), item]));
  const label = request.label?.trim();
  const kind = request.kind;
  const directAssetId = request.asset_id?.trim();
  const reportMatch = directAssetId
    ? reportById.get(directAssetId)
    : kind && label
      ? reportByKey.get(seedanceAssetLookupKey(kind, label))
      : undefined;
  const previous = directAssetId ? byId.get(directAssetId) : undefined;
  const resolvedKind = kind ?? reportMatch?.kind ?? previous?.kind;
  const resolvedLabel = label || reportMatch?.label || previous?.label;
  const assetId = directAssetId || reportMatch?.asset_id || (
    resolvedKind && resolvedLabel ? seedanceAssetId(resolvedKind, resolvedLabel) : undefined
  );
  if (!assetId || !resolvedKind || !resolvedLabel) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'asset_id or label+kind is required for Seedance asset upload');
  }

  const extension = seedanceAssetUploadExtension(request.file.original_filename, request.file.mime_type);
  const fileId = `seedance-upload-${slugifySeedanceAssetLabel(assetId)}-${randomUUID().slice(0, 8)}`;
  const filename = `${fileId}${extension}`;
  const uploadDir = resolve(projectDir(project.project_id), 'seedance-assets', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  await writeFile(resolve(uploadDir, filename), request.file.buffer);
  const localPath = `projects/${project.project_id}/seedance-assets/uploads/${filename}`;
  const existing = byId.get(assetId);
  const asset: SeedanceAssetLibraryItem = {
    asset_id: assetId,
    kind: resolvedKind,
    label: resolvedLabel,
    modality: request.modality ?? existing?.modality ?? reportMatch?.modality ?? defaultSeedanceAssetModality(resolvedKind),
    role: request.role ?? existing?.role ?? reportMatch?.role ?? defaultSeedanceAssetRole(resolvedKind),
    reference_slot: request.reference_slot?.trim() || existing?.reference_slot || reportMatch?.reference_slot,
    file_id: fileId,
    local_path: localPath,
    original_filename: request.file.original_filename,
    mime_type: request.file.mime_type,
    size_bytes: request.file.buffer.length,
    provider: 'local_upload',
    provider_asset_id: fileId,
    upload_status: 'uploaded',
    upload_error: undefined,
    description: request.description?.trim() || existing?.description || reportMatch?.prompt_usage,
    updated_at: updatedAt,
  };
  const assetWithHistory: SeedanceAssetLibraryItem = {
    ...asset,
    history: appendSeedanceAssetHistory(existing, seedanceAssetHistoryEvent({
      asset,
      eventType: 'file_upload',
      createdAt: updatedAt,
      note: request.file.original_filename,
    })),
  };
  byId.set(assetId, assetWithHistory);
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_asset_library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: updatedAt,
      items: [...byId.values()].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.label.localeCompare(b.label, 'zh-CN');
      }),
    },
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  const nextDetail = await getProject(project.project_id);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      nextDetail.error?.message ?? `Project "${projectId}" not found after Seedance asset upload`,
    );
  }
  return success({
    detail: nextDetail.data,
    asset: assetWithHistory,
    file_id: fileId,
    local_path: localPath,
    original_filename: request.file.original_filename,
    mime_type: request.file.mime_type,
    size_bytes: request.file.buffer.length,
  });
}

function seedanceAssetUploadExtension(filename: string, mimeType: string): string {
  const ext = extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (ext && ext.length <= 12) return ext;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'audio/mpeg') return '.mp3';
  if (mimeType === 'audio/wav') return '.wav';
  return '.bin';
}

function isReusableSeedanceAsset(item: SeedanceAssetLibraryItem): boolean {
  return Boolean(
    item.file_url
    || item.file_id
    || item.local_path
    || item.provider_asset_id
    || item.upload_status === 'uploaded'
    || item.upload_status === 'external'
  );
}

function toGlobalSeedanceAssetItem(project: StoryProjectMeta, item: SeedanceAssetLibraryItem): SeedanceGlobalAssetLibraryItem {
  return {
    global_asset_id: `${project.project_id}:${item.asset_id}`,
    source_project_id: project.project_id,
    source_project_title: project.title,
    source_asset_id: item.asset_id,
    label: item.label,
    kind: item.kind,
    modality: item.modality,
    role: item.role,
    reference_slot: item.reference_slot,
    file_url: item.file_url,
    file_id: item.file_id,
    local_path: item.local_path,
    original_filename: item.original_filename,
    mime_type: item.mime_type,
    size_bytes: item.size_bytes,
    provider: item.provider,
    provider_asset_id: item.provider_asset_id,
    upload_status: item.upload_status,
    upload_error: item.upload_error,
    description: item.description,
    updated_at: item.updated_at,
  };
}

export async function listProjectSeedanceGlobalAssetLibrary(
  projectId: string,
): Promise<ApiResponse<SeedanceGlobalAssetLibrary>> {
  const project = await ensureProjectExists(projectId);
  if (!project) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found`);
  }
  const projects = await readAllProjectMetas();
  const items = projects
    .filter(meta => meta.project_id !== projectId)
    .flatMap(meta => normalizeSeedanceAssetLibrary(meta.seedance_asset_library).items
      .filter(isReusableSeedanceAsset)
      .map(item => toGlobalSeedanceAssetItem(meta, item)));
  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    const labelCmp = a.label.localeCompare(b.label, 'zh-CN');
    if (labelCmp !== 0) return labelCmp;
    return b.updated_at.localeCompare(a.updated_at);
  });
  return success({
    schema_version: 'seedance-global-asset-library/v1',
    generated_at: new Date().toISOString(),
    current_project_id: projectId,
    total_asset_count: items.length,
    reusable_asset_count: items.length,
    items,
  });
}

export async function reuseProjectSeedanceAsset(
  projectId: string,
  request: SeedanceAssetReuseRequest,
): Promise<ApiResponse<SeedanceAssetReuseResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }
  const sourceProject = await ensureProjectExists(request.source_project_id);
  if (!sourceProject) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Source project "${request.source_project_id}" not found`);
  }
  const sourceItem = normalizeSeedanceAssetLibrary(sourceProject.seedance_asset_library)
    .items.find(item => item.asset_id === request.source_asset_id);
  if (!sourceItem || !isReusableSeedanceAsset(sourceItem)) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Source asset "${request.source_asset_id}" is not reusable`);
  }

  const { project, current_story } = detail.data;
  const updatedAt = new Date().toISOString();
  const current = normalizeSeedanceAssetLibrary(project.seedance_asset_library);
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const reportAssets = board.seedance_asset_report.assets;
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const reportById = new Map(reportAssets.map(item => [item.asset_id, item]));
  const reportByKey = new Map(reportAssets.map(item => [seedanceAssetLookupKey(item.kind, item.label), item]));
  const targetKind = request.target_kind ?? sourceItem.kind;
  const targetLabel = request.target_label?.trim() || sourceItem.label;
  const reportMatch = request.target_asset_id
    ? reportById.get(request.target_asset_id)
    : reportByKey.get(seedanceAssetLookupKey(targetKind, targetLabel));
  const targetAssetId = request.target_asset_id?.trim()
    || reportMatch?.asset_id
    || seedanceAssetId(targetKind, targetLabel);
  const existing = byId.get(targetAssetId);
  const reusedAsset: SeedanceAssetLibraryItem = {
    asset_id: targetAssetId,
    kind: targetKind,
    label: targetLabel,
    modality: existing?.modality ?? reportMatch?.modality ?? sourceItem.modality,
    role: existing?.role ?? reportMatch?.role ?? sourceItem.role,
    reference_slot: request.reference_slot?.trim() || existing?.reference_slot || reportMatch?.reference_slot || sourceItem.reference_slot,
    file_url: sourceItem.file_url,
    file_id: sourceItem.file_id,
    local_path: sourceItem.local_path,
    original_filename: sourceItem.original_filename,
    mime_type: sourceItem.mime_type,
    size_bytes: sourceItem.size_bytes,
    provider: sourceItem.provider,
    provider_asset_id: sourceItem.provider_asset_id,
    upload_status: sourceItem.upload_status ?? 'external',
    upload_error: undefined,
    description: request.description?.trim() || existing?.description || reportMatch?.prompt_usage || sourceItem.description,
    updated_at: updatedAt,
  };
  const reusedAssetWithHistory: SeedanceAssetLibraryItem = {
    ...reusedAsset,
    history: appendSeedanceAssetHistory(existing, seedanceAssetHistoryEvent({
      asset: reusedAsset,
      eventType: 'cross_project_reuse',
      createdAt: updatedAt,
      sourceProject,
      sourceAssetId: sourceItem.asset_id,
      note: `复用自 ${sourceProject.title}`,
    })),
  };
  byId.set(targetAssetId, reusedAssetWithHistory);
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_asset_library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: updatedAt,
      items: [...byId.values()].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.label.localeCompare(b.label, 'zh-CN');
      }),
    },
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  const nextDetail = await getProject(project.project_id);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      nextDetail.error?.message ?? `Project "${projectId}" not found after Seedance asset reuse`,
    );
  }
  return success({
    detail: nextDetail.data,
    reused_asset: reusedAssetWithHistory,
    source_asset: toGlobalSeedanceAssetItem(sourceProject, sourceItem),
  });
}

export async function updateProjectSeedanceShotStatus(
  projectId: string,
  request: SeedanceShotStatusUpdateRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const shot = board.shot_units.find(unit => unit.shot_id === request.shot_id);
  if (!shot) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Seedance shot "${request.shot_id}" not found in project "${projectId}"`);
  }

  const updatedAt = new Date().toISOString();
  const currentLedger = syncSeedanceShotLedgerWithShots({
    ledger: project.seedance_shot_ledger,
    shotUnits: board.shot_units,
    generatedAt: board.generated_at,
  });
  const productionId = seedanceShotProductionId(request.shot_id);
  const existing = currentLedger.items.find(item => item.production_id === productionId);
  const versions = appendSeedanceShotVideoVersion({
    existing,
    request,
    updatedAt,
  });
  const nextItem: SeedanceShotLedgerItem = {
    production_id: productionId,
    shot_id: request.shot_id,
    source_scene_id: shot.source_scene_id,
    status: request.status,
    prompt_exported_at: existing?.prompt_exported_at ?? board.generated_at,
    submitted_at: request.status === 'submitted' || request.status === 'processing'
      ? existing?.submitted_at ?? updatedAt
      : existing?.submitted_at,
    completed_at: request.status === 'ready' || request.status === 'failed'
      ? updatedAt
      : existing?.completed_at,
    updated_at: updatedAt,
    provider: request.provider ?? existing?.provider,
    provider_job_id: request.provider_job_id ?? existing?.provider_job_id,
    provider_queue_id: request.provider_queue_id ?? existing?.provider_queue_id,
    provider_queue_position: request.provider_queue_position ?? existing?.provider_queue_position,
    video_url: request.video_url ?? existing?.video_url,
    failure_reason: request.failure_reason ?? (request.status === 'failed' ? existing?.failure_reason : undefined),
    retry_count: (existing?.retry_count ?? 0) + (request.increment_retry ? 1 : 0),
    notes: uniqueSeedanceNotes([
      ...(existing?.notes ?? []),
      request.note ?? `状态更新：${request.status}`,
    ]),
    versions,
    selected_version_id: selectedSeedanceShotVersionId(versions, existing?.selected_version_id),
  };
  const items = [
    ...currentLedger.items.filter(item => item.production_id !== productionId),
    nextItem,
  ].sort((a, b) =>
    (a.source_scene_id ?? 0) - (b.source_scene_id ?? 0)
    || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN')
  );
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_shot_ledger: {
      schema_version: 'seedance-shot-ledger/v1',
      updated_at: updatedAt,
      items,
    },
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  return getProject(project.project_id);
}

export async function updateProjectSeedanceShotStatuses(
  projectId: string,
  request: SeedanceShotStatusBatchUpdateRequest,
): Promise<ApiResponse<SeedanceShotStatusBatchUpdateResult>> {
  const firstDetail = await getProject(projectId);
  if (!firstDetail.ok || !firstDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      firstDetail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  let currentDetail = firstDetail.data;
  const failures: SeedanceShotStatusBatchUpdateResult['failures'] = [];
  let updatedCount = 0;
  for (const [index, update] of request.updates.entries()) {
    const updateRes = await updateProjectSeedanceShotStatus(projectId, update);
    if (updateRes.ok && updateRes.data) {
      currentDetail = updateRes.data;
      updatedCount += 1;
    } else {
      failures.push({
        index,
        shot_id: update.shot_id,
        message: updateRes.error?.message ?? 'Seedance shot status update failed',
      });
    }
  }

  return success({
    project: currentDetail.project,
    seedance_shot_ledger: currentDetail.project.seedance_shot_ledger,
    updated_count: updatedCount,
    failed_count: failures.length,
    failures,
  });
}

export async function selectProjectSeedanceShotVersion(
  projectId: string,
  request: SeedanceShotVersionSelectRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const productionId = seedanceShotProductionId(request.shot_id);
  const item = board.seedance_shot_ledger.items.find(candidate => candidate.production_id === productionId);
  if (!item) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Seedance shot "${request.shot_id}" not found in project "${projectId}"`);
  }
  const version = item.versions.find(candidate => candidate.version_id === request.version_id);
  if (!version) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Seedance video version "${request.version_id}" was not found`);
  }
  if (version.status !== 'ready' || !version.video_url) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Seedance video version "${request.version_id}" is not ready for cutting`);
  }

  const updatedAt = new Date().toISOString();
  const items = board.seedance_shot_ledger.items.map(candidate => {
    if (candidate.production_id !== productionId) return candidate;
    return {
      ...candidate,
      status: 'ready' as const,
      updated_at: updatedAt,
      completed_at: version.created_at,
      provider_job_id: version.provider_job_id ?? candidate.provider_job_id,
      video_url: version.video_url,
      failure_reason: undefined,
      selected_version_id: version.version_id,
      notes: uniqueSeedanceNotes([
        ...candidate.notes,
        request.note ?? `已选择剪辑版本：${version.version_id}`,
      ]),
    };
  });
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_shot_ledger: {
      schema_version: 'seedance-shot-ledger/v1',
      updated_at: updatedAt,
      items,
    },
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  return getProject(project.project_id);
}

export async function autoSelectProjectSeedanceShotVersions(
  projectId: string,
  request: SeedanceShotAutoSelectRequest = {},
): Promise<ApiResponse<StoryProjectDetail>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const updatedAt = new Date().toISOString();
  let selectedCount = 0;
  const items = board.seedance_shot_ledger.items.map(item => {
    if (item.selected_version_id && !request.overwrite_manual) return item;
    const bestVersion = bestReadySeedanceShotVersion(item, request.min_quality_score);
    if (!bestVersion) return item;
    selectedCount += 1;
    return {
      ...item,
      status: 'ready' as const,
      updated_at: updatedAt,
      completed_at: bestVersion.created_at,
      provider_job_id: bestVersion.provider_job_id ?? item.provider_job_id,
      video_url: bestVersion.video_url,
      failure_reason: undefined,
      selected_version_id: bestVersion.version_id,
      notes: uniqueSeedanceNotes([
        ...item.notes,
        request.note ?? `自动择优剪辑版本：${bestVersion.version_id}`,
      ]),
    };
  });
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: selectedCount > 0 ? updatedAt : project.updated_at,
    seedance_shot_ledger: {
      schema_version: 'seedance-shot-ledger/v1',
      updated_at: selectedCount > 0 ? updatedAt : board.seedance_shot_ledger.updated_at,
      items,
    },
  };
  if (selectedCount > 0) {
    await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  }
  return selectedCount > 0 ? getProject(project.project_id) : success(detail.data);
}

export async function submitProjectSeedanceShotsToProvider(
  projectId: string,
  request: SeedanceShotProviderSubmitRequest = {},
): Promise<ApiResponse<SeedanceShotProviderSubmitResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const updatedAt = new Date().toISOString();
  const provider = request.provider?.trim() || 'seedance';
  const queueId = request.queue_id?.trim() || seedanceProviderQueueId(provider, updatedAt);
  const queuePriority = request.queue_priority ?? 'normal';
  const queueNote = request.note?.trim();
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const currentLedger = syncSeedanceShotLedgerWithShots({
    ledger: project.seedance_shot_ledger,
    shotUnits: board.shot_units,
    generatedAt: board.generated_at,
  });
  const requestedShotIds = request.shot_ids?.length ? new Set(request.shot_ids) : undefined;
  const failures: SeedanceShotProviderSubmitResult['failures'] = [];
  const submittedShots: SeedanceShotProviderSubmitResult['submitted_shots'] = [];
  const queueItems: SeedanceShotProviderQueueBatch['items'] = [];
  const submitStatuses = new Set<SeedanceShotProductionStatus>(['not_started', 'prompt_exported', 'failed']);
  const shotUnitById = new Map(board.shot_units.map(unit => [unit.shot_id, unit]));
  let skippedCount = 0;

  if (requestedShotIds) {
    [...requestedShotIds].forEach((shotId, index) => {
      if (!shotUnitById.has(shotId)) {
        failures.push({
          index,
          shot_id: shotId,
          message: `Seedance shot "${shotId}" not found in project "${projectId}"`,
        });
      }
    });
  }

  const items = currentLedger.items.map((item, index) => {
    const shot = shotUnitById.get(item.shot_id);
    if (!shot) return item;
    if (requestedShotIds && !requestedShotIds.has(item.shot_id)) return item;
    if (failures.some(failure => failure.shot_id === item.shot_id)) return item;
    if (item.provider_job_id && item.status !== 'failed' && !request.overwrite_existing) {
      skippedCount += 1;
      return item;
    }
    if (!submitStatuses.has(item.status) && !request.overwrite_existing) {
      skippedCount += 1;
      return item;
    }

    const providerJobId = request.job_prefix?.trim()
      ? `${request.job_prefix.trim()}-${item.shot_id}`
      : seedanceProviderJobId(provider, item.shot_id, index);
    const queuePosition = queueItems.length + 1;
    submittedShots.push({
      shot_id: item.shot_id,
      provider_job_id: providerJobId,
      provider_queue_id: queueId,
      provider_queue_position: queuePosition,
      status: 'submitted',
    });
    queueItems.push({
      shot_id: item.shot_id,
      source_scene_id: shot.source_scene_id,
      provider_job_id: providerJobId,
      status: 'submitted',
      queue_position: queuePosition,
      queued_at: updatedAt,
    });
    return {
      ...item,
      source_scene_id: shot.source_scene_id,
      status: 'submitted' as const,
      submitted_at: updatedAt,
      updated_at: updatedAt,
      provider,
      provider_job_id: providerJobId,
      provider_queue_id: queueId,
      provider_queue_position: queuePosition,
      failure_reason: undefined,
      retry_count: item.status === 'failed' ? item.retry_count + 1 : item.retry_count,
      notes: uniqueSeedanceNotes([
        ...item.notes,
        queueNote || `提交到 ${provider}：${providerJobId}`,
      ]),
      versions: appendSeedanceShotVideoVersion({
        existing: item,
        request: {
          shot_id: item.shot_id,
          status: 'submitted',
          provider_job_id: providerJobId,
          note: queueNote || `提交到 ${provider}`,
        },
        updatedAt,
      }),
    };
  }).sort((a, b) =>
    (a.source_scene_id ?? 0) - (b.source_scene_id ?? 0)
    || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN')
  );

  if (!submittedShots.length) {
    return success({
      project,
      seedance_shot_ledger: currentLedger,
      seedance_provider_queue: project.seedance_provider_queue,
      submitted_count: 0,
      skipped_count: skippedCount,
      failed_count: failures.length,
      submitted_shots: [],
      failures,
    });
  }

  const providerQueueBatch: SeedanceShotProviderQueueBatch = {
    queue_id: queueId,
    provider,
    priority: queuePriority,
    created_at: updatedAt,
    updated_at: updatedAt,
    submitted_count: submittedShots.length,
    skipped_count: skippedCount,
    failed_count: failures.length,
    note: queueNote,
    items: queueItems,
  };
  const providerQueue = appendSeedanceProviderQueueBatch(project.seedance_provider_queue, providerQueueBatch);
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_shot_ledger: {
      schema_version: 'seedance-shot-ledger/v1',
      updated_at: updatedAt,
      items,
    },
    seedance_provider_queue: providerQueue,
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  return success({
    project: updatedProject,
    seedance_shot_ledger: updatedProject.seedance_shot_ledger,
    seedance_provider_queue: updatedProject.seedance_provider_queue,
    provider_queue_batch: providerQueueBatch,
    submitted_count: submittedShots.length,
    skipped_count: skippedCount,
    failed_count: failures.length,
    submitted_shots: submittedShots,
    failures,
  });
}

export async function recoverProjectSeedanceProviderQueue(
  projectId: string,
  request: SeedanceShotProviderRecoveryRequest = {},
): Promise<ApiResponse<SeedanceShotProviderRecoveryResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const timeoutMinutes = request.timeout_minutes ?? 120;
  const recoverableStatuses = new Set<SeedanceShotProviderRecoverableStatus>(
    request.statuses?.length ? request.statuses : ['submitted', 'processing'],
  );
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const currentLedger = syncSeedanceShotLedgerWithShots({
    ledger: project.seedance_shot_ledger,
    shotUnits: board.shot_units,
    generatedAt: board.generated_at,
  });
  const updatedAt = new Date().toISOString();
  const nowMs = Date.parse(updatedAt);
  const checkedItems = currentLedger.items.filter((item): item is SeedanceShotLedgerItem & {
    status: SeedanceShotProviderRecoverableStatus;
  } => recoverableStatuses.has(item.status as SeedanceShotProviderRecoverableStatus));
  const timedOutShots: SeedanceShotProviderRecoveryItem[] = checkedItems
    .map(item => {
      const minutesWaiting = seedanceShotWaitingMinutes(item, nowMs);
      const failureReason = `Provider task timed out after ${timeoutMinutes} minutes`;
      return {
        shot_id: item.shot_id,
        source_scene_id: item.source_scene_id,
        status: item.status,
        provider: item.provider,
        provider_job_id: item.provider_job_id,
        provider_queue_id: item.provider_queue_id,
        provider_queue_position: item.provider_queue_position,
        submitted_at: item.submitted_at,
        updated_at: item.updated_at,
        minutes_waiting: minutesWaiting,
        failure_reason: failureReason,
      };
    })
    .filter(item => item.minutes_waiting >= timeoutMinutes);

  if (!request.mark_timed_out_failed || !timedOutShots.length) {
    return success({
      project,
      seedance_shot_ledger: currentLedger,
      dry_run: !request.mark_timed_out_failed,
      timeout_minutes: timeoutMinutes,
      checked_count: checkedItems.length,
      timed_out_count: timedOutShots.length,
      updated_count: 0,
      timed_out_shots: timedOutShots,
    });
  }

  const timedOutByShotId = new Map(timedOutShots.map(item => [item.shot_id, item]));
  const note = request.note?.trim();
  const items = currentLedger.items.map(item => {
    const timedOut = timedOutByShotId.get(item.shot_id);
    if (!timedOut) return item;
    const failureReason = timedOut.failure_reason ?? `Provider task timed out after ${timeoutMinutes} minutes`;
    return {
      ...item,
      status: 'failed' as const,
      completed_at: updatedAt,
      updated_at: updatedAt,
      failure_reason: failureReason,
      notes: uniqueSeedanceNotes([
        ...item.notes,
        note ?? `Provider 超时恢复：等待 ${timedOut.minutes_waiting} 分钟`,
      ]),
      versions: appendSeedanceShotVideoVersion({
        existing: item,
        request: {
          shot_id: item.shot_id,
          status: 'failed',
          provider_job_id: item.provider_job_id,
          failure_reason: failureReason,
          note: note ?? `Provider 超时恢复：等待 ${timedOut.minutes_waiting} 分钟`,
        },
        updatedAt,
      }),
    };
  });
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_shot_ledger: {
      schema_version: 'seedance-shot-ledger/v1',
      updated_at: updatedAt,
      items,
    },
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  return success({
    project: updatedProject,
    seedance_shot_ledger: updatedProject.seedance_shot_ledger,
    dry_run: false,
    timeout_minutes: timeoutMinutes,
    checked_count: checkedItems.length,
    timed_out_count: timedOutShots.length,
    updated_count: timedOutShots.length,
    timed_out_shots: timedOutShots,
  });
}

export async function importProjectSeedanceShotCallbacks(
  projectId: string,
  request: SeedanceShotCallbackImportRequest,
): Promise<ApiResponse<SeedanceShotCallbackImportResult>> {
  const firstDetail = await getProject(projectId);
  if (!firstDetail.ok || !firstDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      firstDetail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  let currentDetail = firstDetail.data;
  const failures: SeedanceShotCallbackImportResult['failures'] = [];
  let updatedCount = 0;
  for (const [index, callback] of request.callbacks.entries()) {
    const update = resolveSeedanceShotCallbackUpdate(currentDetail, callback);
    const providerJobId = callbackStringField(
      callback.provider_job_id ?? callback.providerJobId ?? callback.job_id ?? callback.jobId,
    );
    const shotId = callbackStringField(callback.shot_id ?? callback.shotId);
    if (typeof update === 'string') {
      failures.push({
        index,
        shot_id: shotId,
        provider_job_id: providerJobId,
        message: update,
      });
      continue;
    }

    const updateRes = await updateProjectSeedanceShotStatus(projectId, update);
    if (updateRes.ok && updateRes.data) {
      currentDetail = updateRes.data;
      updatedCount += 1;
    } else {
      failures.push({
        index,
        shot_id: update.shot_id,
        provider_job_id: providerJobId,
        message: updateRes.error?.message ?? 'Seedance shot callback import failed',
      });
    }
  }

  return success({
    project: currentDetail.project,
    seedance_shot_ledger: currentDetail.project.seedance_shot_ledger,
    updated_count: updatedCount,
    failed_count: failures.length,
    failures,
  });
}

export async function importProjectSeedanceProviderCallback(
  projectId: string,
  request: SeedanceShotProviderCallbackRequest,
): Promise<ApiResponse<SeedanceShotProviderCallbackResult>> {
  const importRes = await importProjectSeedanceShotCallbacks(projectId, { callbacks: [request] });
  if (!importRes.ok || !importRes.data) {
    return importRes as ApiResponse<SeedanceShotProviderCallbackResult>;
  }
  return success({
    ...importRes.data,
    provider: callbackStringField(request.provider),
    provider_job_id: callbackStringField(
      request.provider_job_id ?? request.providerJobId ?? request.job_id ?? request.jobId,
    ),
    provider_queue_id: callbackStringField(
      request.provider_queue_id ?? request.providerQueueId ?? request.queue_id ?? request.queueId,
    ),
    provider_queue_position: callbackNumberField(
      request.provider_queue_position
        ?? request.providerQueuePosition
        ?? request.queue_position
        ?? request.queuePosition,
    ),
    event_id: callbackStringField(
      request.event_id ?? request.eventId ?? request.callback_id ?? request.callbackId,
    ),
  });
}

export async function exportProjectSeedanceRetryPackage(
  projectId: string,
): Promise<ApiResponse<SeedanceShotRetryPackage>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const ledgerMap = new Map(board.seedance_shot_ledger.items.map(item => [item.production_id, item]));
  const promptKeys = new Set<string>();
  const shots = board.shot_units
    .reduce<SeedanceShotRetryPackageShot[]>((items, unit) => {
      const productionId = seedanceShotProductionId(unit.shot_id);
      promptKeys.add(productionId);
      const item = ledgerMap.get(productionId);
      if (!shouldRetrySeedanceShot(item)) return items;
      items.push({
        production_id: productionId,
        shot_id: unit.shot_id,
        source_scene_id: unit.source_scene_id,
        status: item?.status ?? 'prompt_exported',
        retry_count: item?.retry_count ?? 0,
        failure_reason: item?.failure_reason,
        provider_job_id: item?.provider_job_id,
        last_video_url: item?.video_url,
        suggested_action: seedanceShotRetrySuggestedAction(item),
        prompt: {
          duration_sec: unit.seedance_duration_sec,
          characters: unit.characters,
          location: unit.location,
          script_text: unit.script_text,
          visual_prompt: unit.visual_prompt,
          camera_suggestion: unit.camera_suggestion,
          seedance_prompt: unit.seedance_prompt,
          seedance_asset_slots: unit.seedance_asset_slots,
          seedance_validation_notes: unit.seedance_validation_notes,
          negative_constraints: unit.negative_constraints,
        },
      });
      return items;
    }, []);
  const missingPromptShots = board.seedance_shot_ledger.items
    .filter(item => shouldRetrySeedanceShot(item))
    .filter(item => !promptKeys.has(item.production_id))
    .map(item => ({
      production_id: item.production_id,
      shot_id: item.shot_id,
      source_scene_id: item.source_scene_id,
      reason: '账本中存在待处理镜头，但当前 Production Board 找不到对应镜头',
    }));
  const basePackage: Omit<SeedanceShotRetryPackage, 'markdown'> = {
    schema_version: 'story-seedance-retry-package/v1',
    project,
    storyId: board.storyId,
    title: board.title,
    exported_at: new Date().toISOString(),
    total_retry_shot_count: shots.length,
    skipped_ready_shot_count: board.seedance_shot_ledger.items.filter(item =>
      item.status === 'ready' && Boolean(item.video_url)
    ).length,
    shots,
    missing_prompt_shots: missingPromptShots,
  };
  return success({
    ...basePackage,
    markdown: buildSeedanceRetryPackageMarkdown(basePackage),
  });
}

export async function getProjectProductionBoard(projectId: string): Promise<ApiResponse<StoryProductionBoard>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }
  return success(buildStoryProductionBoard(detail.data.current_story, {
    seedanceAssetLibrary: detail.data.project.seedance_asset_library,
    seedanceShotLedger: detail.data.project.seedance_shot_ledger,
  }));
}

export async function exportProjectProductionBoard(projectId: string): Promise<ApiResponse<StoryProductionBoardExportPackage>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const exportedAt = new Date().toISOString();
  const exportDir = resolve(projectDir(project.project_id), 'production-board');
  await mkdir(exportDir, { recursive: true });

  const files: StoryProductionBoardExportFile[] = [];
  const writeExportFile = async (
    fileId: string,
    kind: StoryProductionBoardExportFile['kind'],
    label: string,
    filename: string,
    content: string,
    mimeType: string,
  ) => {
    const filePath = resolve(exportDir, filename);
    await writeFile(filePath, content, 'utf-8');
    files.push({
      file_id: fileId,
      kind,
      label,
      relative_path: `production-board/${filename}`,
      file_path: filePath,
      mime_type: mimeType,
      byte_size: Buffer.byteLength(content, 'utf-8'),
    });
  };

  await writeExportFile(
    'production-board-json',
    'board_json',
    'Production Board JSON',
    'production-board.json',
    JSON.stringify(board, null, 2),
    'application/json',
  );
  await writeExportFile(
    'production-board-markdown',
    'board_markdown',
    'Production Board Markdown',
    'production-board.md',
    board.markdown,
    'text/markdown',
  );
  await writeExportFile(
    'supervision-report',
    'supervision_report',
    'Supervision Report',
    'supervision-report.json',
    JSON.stringify(board.supervision_report, null, 2),
    'application/json',
  );
  await writeExportFile(
    'repair-plan',
    'repair_plan',
    'Production Repair Plan',
    'repair-plan.json',
    JSON.stringify(board.repair_plan, null, 2),
    'application/json',
  );
  await writeExportFile(
    'seedance-prompts-json',
    'seedance_prompts',
    'Seedance 2.0 Shot Prompts JSON',
    'seedance-prompts.json',
    JSON.stringify(buildProductionBoardSeedanceExport(board), null, 2),
    'application/json',
  );
  await writeExportFile(
    'seedance-prompts-markdown',
    'seedance_prompts',
    'Seedance 2.0 Shot Prompts Markdown',
    'seedance-prompts.md',
    buildProductionBoardSeedanceMarkdown(board),
    'text/markdown',
  );
  await writeExportFile(
    'seedance-asset-report-json',
    'seedance_asset_report',
    'Seedance Asset Report JSON',
    'seedance-asset-report.json',
    JSON.stringify(board.seedance_asset_report, null, 2),
    'application/json',
  );
  await writeExportFile(
    'seedance-asset-report-markdown',
    'seedance_asset_report',
    'Seedance Asset Report Markdown',
    'seedance-asset-report.md',
    board.seedance_asset_report.markdown,
    'text/markdown',
  );
  await writeExportFile(
    'seedance-shot-ledger-json',
    'seedance_shot_ledger',
    'Seedance Shot Ledger JSON',
    'seedance-shot-ledger.json',
    JSON.stringify(board.seedance_shot_ledger, null, 2),
    'application/json',
  );
  await writeExportFile(
    'seedance-shot-ledger-markdown',
    'seedance_shot_ledger',
    'Seedance Shot Ledger Markdown',
    'seedance-shot-ledger.md',
    buildSeedanceShotLedgerMarkdown(board),
    'text/markdown',
  );
  await writeExportFile(
    'delivery-manifest',
    'delivery_manifest',
    'Delivery Manifest',
    'manifest.json',
    JSON.stringify({
      schema_version: 'story-production-board-manifest/v1',
      project_id: project.project_id,
      storyId: board.storyId,
      title: board.title,
      exported_at: exportedAt,
      delivery_manifest: board.delivery_manifest,
      files,
    }, null, 2),
    'application/json',
  );

  const updatedProject: StoryProjectMeta = {
    ...project,
    status: project.status === 'finalized' ? 'finalized' : 'exported',
    updated_at: exportedAt,
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  await updateProjectVersionProductionBoardExport(project.project_id, project.current_version_id, {
    exported_at: exportedAt,
    export_dir: exportDir,
    file_count: files.length,
    delivery_stage: board.delivery_manifest.stage,
    delivery_stage_label: board.delivery_manifest.stage_label,
  });

  return success({
    schema_version: 'story-production-board-export/v1',
    project_id: project.project_id,
    storyId: board.storyId,
    title: board.title,
    exported_at: exportedAt,
    export_dir: exportDir,
    files,
    board,
  });
}

export async function exportProjectCurrentVersion(projectId: string): Promise<ApiResponse<StoryProjectExportPackage>> {
  const project = await ensureProjectExists(projectId);
  if (!project) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found`);
  }

  const versions = await readVersionSnapshots(projectId);
  const currentVersion = versions.find(version => version.version_id === project.current_version_id) ?? versions[0];
  if (!currentVersion) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" has no version snapshots`);
  }

  const exportedAt = new Date().toISOString();
  const updatedProject: StoryProjectMeta = {
    ...project,
    status: project.status === 'finalized' ? 'finalized' : 'exported',
    updated_at: exportedAt,
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);

  const story = normalizeStoryGenerationFields(currentVersion.story);
  return success(buildProjectExportPackage({
    project: updatedProject,
    story,
    exportedAt,
  }));
}

function buildProjectExportPackage(params: {
  project: StoryProjectMeta;
  story: StoryGenerateResult;
  exportedAt: string;
}): StoryProjectExportPackage {
  const summary = {
    title: params.story.title,
    source_entry: params.story.source_entry,
    video_type: params.story.video_type,
    video_type_label: VIDEO_TYPE_CONFIG[params.story.video_type]?.label ?? params.story.video_type,
    presentation_style: params.story.presentation_style,
    presentation_style_label: PRESENTATION_STYLE_CONFIG[params.story.presentation_style]?.label ?? params.story.presentation_style,
    story_structure: params.story.story_structure,
    story_structure_label: params.story.story_structure
      ? STORY_STRUCTURE_CONFIG[params.story.story_structure]?.label ?? params.story.story_structure
      : undefined,
    logline: params.story.logline,
    quality_passed: params.story.quality_report?.passed,
    genre_score: params.story.quality_report?.genre_score,
    outline_coverage_score: params.story.quality_report?.outline_coverage_report?.coverage_score,
    pattern_quality_score: params.story.quality_report?.pattern_quality_report?.pattern_score,
    gears_readiness_score: params.story.quality_report?.gears_readiness_report?.readiness_score,
    repair_action_count: params.story.quality_report?.repair_action_items?.length ?? 0,
    quality_issues: params.story.quality_report?.issues ?? [],
    credibility_note: params.story.credibility_note,
    evidence_boundary_count: params.story.story_blueprint?.evidence_boundaries.length ?? 0,
    gears_segment_count: params.story.gears_segments.length,
  };

  const basePackage = {
    schema_version: 'story-project-export/v1' as const,
    exported_at: params.exportedAt,
    project: params.project,
    summary,
    markdown: '',
    story: params.story,
  };

  return {
    ...basePackage,
    markdown: buildProjectExportMarkdown(basePackage),
  };
}

function buildProductionBoardSeedanceExport(board: StoryProductionBoard) {
  return {
    schema_version: 'story-production-board-seedance-prompts/v1',
    project_id: board.project_id,
    storyId: board.storyId,
    title: board.title,
    generated_at: board.generated_at,
    delivery_stage: board.delivery_manifest.stage,
    shot_count: board.shot_units.length,
    shot_units: board.shot_units.map(unit => ({
      shot_id: unit.shot_id,
      source_scene_id: unit.source_scene_id,
      duration_sec: unit.seedance_duration_sec,
      characters: unit.characters,
      location: unit.location,
      prompt: unit.seedance_prompt,
      asset_slots: unit.seedance_asset_slots,
      material_validation: unit.seedance_material_validation,
      validation_notes: unit.seedance_validation_notes,
    })),
  };
}

function buildProductionBoardSeedanceMarkdown(board: StoryProductionBoard): string {
  const lines = [
    `# ${board.title} Seedance 2.0 镜头提示词`,
    '',
    `- 项目 ID: ${board.project_id ?? '未记录'}`,
    `- 故事 ID: ${board.storyId}`,
    `- 交付阶段: ${board.delivery_manifest.stage_label}`,
    `- 镜头数: ${board.shot_units.length}`,
    '',
    ...board.shot_units.flatMap(unit => [
      `## ${unit.shot_id} / 场景 ${unit.source_scene_id}`,
      `- 时长: ${unit.seedance_duration_sec} 秒`,
      `- 场景: ${unit.location}`,
      `- 角色: ${unit.characters.join('、') || '未指定'}`,
      unit.seedance_asset_slots.length
        ? `- 素材 slot: ${unit.seedance_asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；')}`
        : '- 素材 slot: 无',
      `- 素材校验: 文件 ${unit.seedance_material_validation.total_file_count}/${unit.seedance_material_validation.max_total_files}；复杂度 ${unit.seedance_material_validation.prompt_complexity_score}/100；风险 ${unit.seedance_material_validation.duration_risk}`,
      unit.seedance_validation_notes.length
        ? `- 校验: ${unit.seedance_validation_notes.join('；')}`
        : '- 校验: 无',
      '',
      unit.seedance_prompt,
      '',
    ]),
  ];
  return lines.join('\n');
}

function buildSeedanceShotLedgerMarkdown(board: StoryProductionBoard): string {
  const lines = [
    `# ${board.title} Seedance Shot Ledger`,
    '',
    `- 项目 ID: ${board.project_id ?? '未记录'}`,
    `- 故事 ID: ${board.storyId}`,
    `- 镜头数: ${board.seedance_shot_ledger.items.length}`,
    `- 已完成: ${board.seedance_shot_ledger.items.filter(item => item.status === 'ready').length}`,
    `- 处理中: ${board.seedance_shot_ledger.items.filter(item => item.status === 'processing').length}`,
    `- 失败: ${board.seedance_shot_ledger.items.filter(item => item.status === 'failed').length}`,
    '',
    ...board.seedance_shot_ledger.items.flatMap(item => [
      `## ${item.shot_id}`,
      `- 状态: ${item.status}`,
      `- 场景: ${item.source_scene_id ?? '未记录'}`,
      `- 更新时间: ${item.updated_at}`,
      item.provider_job_id ? `- Provider Job: ${item.provider_job_id}` : '- Provider Job: 未记录',
      item.video_url ? `- 视频 URL: ${item.video_url}` : '- 视频 URL: 未记录',
      item.selected_version_id ? `- 剪辑版: ${item.selected_version_id}` : '- 剪辑版: 未选择',
      `- 重试次数: ${item.retry_count}`,
      item.notes.length ? `- 备注: ${item.notes.join('；')}` : '- 备注: 无',
      item.versions.length
        ? `- 版本: ${item.versions.map(version => `${version.version_id}/${version.status}`).join('；')}`
        : '- 版本: 无',
      '',
    ]),
  ];
  return lines.join('\n');
}

function buildSeedanceRetryPackageMarkdown(
  pkg: Omit<SeedanceShotRetryPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.title} — Seedance 重试提交包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> projectId: ${pkg.project.project_id}`,
    `> storyId: ${pkg.storyId}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> 待重试镜头: ${pkg.total_retry_shot_count}`,
    `> 已跳过可用镜头: ${pkg.skipped_ready_shot_count}`,
    '',
    '## 重试镜头',
  ];
  for (const shot of pkg.shots) {
    lines.push(
      '',
      `### ${shot.shot_id} / 场景 ${shot.source_scene_id ?? '未记录'}`,
      '',
      `- 状态: ${seedanceShotStatusText(shot.status)}`,
      `- 失败原因: ${shot.failure_reason ?? '未记录'}`,
      `- 重试次数: ${shot.retry_count}`,
      `- 上次 job: ${shot.provider_job_id ?? '未记录'}`,
      `- 上次视频: ${shot.last_video_url ?? '未记录'}`,
      `- 建议动作: ${shot.suggested_action}`,
      `- 人物: ${shot.prompt.characters.join('、') || '未指定'}`,
      `- 场景: ${shot.prompt.location}`,
      `- 镜头: ${shot.prompt.camera_suggestion}`,
      shot.prompt.seedance_asset_slots.length
        ? `- 素材: ${shot.prompt.seedance_asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；')}`
        : '- 素材: 未记录',
      shot.prompt.negative_constraints.length ? `- 禁止: ${shot.prompt.negative_constraints.join('；')}` : '- 禁止: 无',
      '',
      '```text',
      shot.prompt.seedance_prompt,
      '```',
    );
  }
  if (pkg.missing_prompt_shots.length) {
    lines.push(
      '',
      '## 缺少提示词的待处理镜头',
      '',
      ...pkg.missing_prompt_shots.map(item =>
        `- ${item.shot_id} / 场景 ${item.source_scene_id ?? '未记录'}：${item.reason}`
      ),
    );
  }
  return lines.join('\n');
}

function buildProjectExportMarkdown(pkg: Omit<StoryProjectExportPackage, 'markdown'> & { markdown: string }): string {
  const { story, project, summary } = pkg;
  const quality = story.quality_report;
  const blueprint = story.story_blueprint;
  const lines: string[] = [
    `# ${story.title}`,
    '',
    '## 项目信息',
    `- 项目 ID: ${project.project_id}`,
    `- 当前版本: ${project.current_version_id}`,
    `- 导出时间: ${pkg.exported_at}`,
    `- 来源条目: ${story.source_entry}`,
    `- 类型片: ${summary.video_type_label} (${story.video_type})`,
    `- 表现形式: ${summary.presentation_style_label} (${story.presentation_style})`,
    `- 叙事结构: ${summary.story_structure_label ?? story.story_structure ?? '未记录'}`,
    `- 生成模型: ${story.model_profile_id ?? '未记录'}`,
    '',
    '## 故事摘要',
    `- 一句话: ${story.logline}`,
    `- 主题: ${story.theme}`,
    '',
    story.full_text,
    '',
    '## 质量报告摘要',
    `- 状态: ${quality ? quality.passed ? '通过' : '需调整' : '未记录'}`,
    `- 类型分: ${typeof quality?.genre_score === 'number' ? quality.genre_score : '未记录'}`,
    `- 大纲覆盖: ${typeof quality?.outline_coverage_report?.coverage_score === 'number' ? `${quality.outline_coverage_report.coverage_score}/100` : '未记录'}`,
    `- 流派信号: ${typeof quality?.pattern_quality_report?.pattern_score === 'number' ? `${quality.pattern_quality_report.pattern_score}/100` : '未记录'}`,
    `- GEARS 就绪: ${typeof quality?.gears_readiness_report?.readiness_score === 'number' ? `${quality.gears_readiness_report.readiness_score}/100` : '未记录'}`,
    `- 问题: ${quality?.issues.length ? quality.issues.join('；') : '无'}`,
    `- 修复建议: ${quality?.repair_actions?.length ? quality.repair_actions.join('；') : '无'}`,
    '',
    '## P0 可修复质量报告',
    ...(quality?.outline_coverage_report ? [
      '### Outline Coverage Report',
      `- 覆盖率: ${quality.outline_coverage_report.coverage_score}/100`,
      `- 节点: 已覆盖 ${quality.outline_coverage_report.covered_nodes}/${quality.outline_coverage_report.total_nodes}；部分 ${quality.outline_coverage_report.partial_nodes}；缺失 ${quality.outline_coverage_report.missing_nodes}`,
      `- 预览: ${quality.outline_coverage_report.preview}`,
      ...(quality.outline_coverage_report.nodes
        .filter(node => node.status !== 'covered')
        .slice(0, 8)
        .map(node => `- ${node.order}. [${node.status}] ${node.text} -> ${node.repair_hint}`)),
      ...(quality.outline_coverage_report.unauthorized_events.length
        ? [`- 可能偏移: ${quality.outline_coverage_report.unauthorized_events.join('；')}`]
        : []),
      '',
    ] : ['### Outline Coverage Report', '- 未记录', '']),
    ...(quality?.pattern_quality_report ? [
      '### Pattern Quality Report',
      `- 分数: ${quality.pattern_quality_report.pattern_score}/100`,
      `- 已满足: ${quality.pattern_quality_report.satisfied_signals.length}`,
      `- 偏弱/缺失: ${quality.pattern_quality_report.weak_signals.length}`,
      `- 预览: ${quality.pattern_quality_report.preview}`,
      ...quality.pattern_quality_report.weak_signals
        .slice(0, 8)
        .map(signal => `- ${signal.label}: ${signal.gap}；修复：${signal.repair_hint}`),
      '',
    ] : ['### Pattern Quality Report', '- 未记录', '']),
    ...(quality?.gears_readiness_report ? [
      '### GEARS Readiness Report',
      `- 分数: ${quality.gears_readiness_report.readiness_score}/100`,
      `- 状态: ${quality.gears_readiness_report.ready ? '就绪' : '需修复'}`,
      `- 预览: ${quality.gears_readiness_report.preview}`,
      ...(quality.gears_readiness_report.asset_gaps.length ? [`- 资产缺口: ${quality.gears_readiness_report.asset_gaps.join('；')}`] : []),
      ...(quality.gears_readiness_report.unit_gaps.length ? [`- 单元缺口: ${quality.gears_readiness_report.unit_gaps.join('；')}`] : []),
      ...(quality.gears_readiness_report.prompt_gaps.length ? [`- 提示词缺口: ${quality.gears_readiness_report.prompt_gaps.join('；')}`] : []),
      '',
    ] : ['### GEARS Readiness Report', '- 未记录', '']),
    ...(quality?.repair_action_items?.length ? [
      '### 一键修复动作',
      ...quality.repair_action_items.map(action =>
        `- ${action.label} [${action.target_report}/${action.severity}] 场景: ${action.scene_ids.join('、') || '全局'}；预期: ${action.expected_effect}`
      ),
      '',
    ] : ['### 一键修复动作', '- 无', '']),
    '',
    '## 可信度边界',
    `- 总体说明: ${story.credibility_note}`,
    ...(blueprint?.evidence_boundaries.length
      ? blueprint.evidence_boundaries.map(item => `- ${item.label} [${item.type}]: ${item.note}`)
      : ['- 未记录结构化边界']),
    '',
    '## 类型节拍',
    ...(blueprint?.genre_beats.length
      ? blueprint.genre_beats.map(beat =>
          `- ${beat.order}. ${beat.function_label}: ${beat.function_description}；场景 ${beat.scene_id ?? '未绑定'}；要求：${beat.content_requirement}；边界：${beat.evidence_boundary_ids.join('、') || '未绑定'}`
        )
      : ['- 未记录类型节拍']),
    '',
    '## 场景分解',
    ...story.scene_breakdown.flatMap(scene => [
      `### 场景 ${scene.scene_id}: ${scene.title}`,
      `- 时长: ${scene.duration_sec} 秒`,
      `- 地点: ${scene.location}`,
      `- 功能: ${scene.dramatic_function}`,
      `- 冲突: ${scene.conflict ?? '未记录'}`,
      `- 行动: ${scene.key_action}`,
      `- 画面: ${scene.visual_prompt}`,
      `- 旁白/对白: ${scene.dialogue_or_narration ?? '未记录'}`,
      '',
    ]),
    '## GEARS 分段',
    ...story.gears_segments.flatMap(segment => [
      `### Segment ${segment.segment_id} / 场景 ${segment.source_scene_id}`,
      `- 时长: ${segment.duration_sec} 秒`,
      `- 格数: ${segment.panel_count}`,
      `- 目的: ${segment.purpose}`,
      `- 视觉重点: ${segment.visual_focus.join('、') || '未记录'}`,
      `- 文化约束: ${segment.cultural_constraints.join('；') || '未记录'}`,
      '',
      segment.script_text,
      '',
    ]),
  ];
  return lines.join('\n');
}

export async function listProjectSupplementTasks(
  status?: KnowledgeSupplementTaskStatus,
): Promise<ApiResponse<ProjectSupplementTaskListItem[]>> {
  const projectsResult = await listProjects();
  if (!projectsResult.ok || !projectsResult.data) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      projectsResult.error?.message ?? 'Failed to list projects',
    );
  }

  const items: ProjectSupplementTaskListItem[] = [];
  for (const project of projectsResult.data) {
    const detailResult = await getProject(project.project_id);
    if (!detailResult.ok || !detailResult.data) continue;
    for (const task of detailResult.data.current_story.supplement_tasks ?? []) {
      if (status && task.status !== status) continue;
      items.push({
        project_id: project.project_id,
        current_story_id: project.current_story_id,
        project_title: project.title,
        source_entry: project.source_entry,
        video_type: project.video_type,
        updated_at: project.updated_at,
        task,
      });
    }
  }

  items.sort((a, b) => {
    if (a.task.status !== b.task.status) return a.task.status === 'open' ? -1 : 1;
    const aTime = a.task.updated_at ?? a.task.resolved_at ?? a.updated_at;
    const bTime = b.task.updated_at ?? b.task.resolved_at ?? b.updated_at;
    return bTime.localeCompare(aTime);
  });
  return success(items);
}

export async function deleteProject(projectId: string): Promise<ApiResponse<StoryProjectDeleteResult>> {
  const project = await ensureProjectExists(projectId);
  if (!project) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found`);
  }

  const versionSnapshots = await readVersionSnapshots(projectId);
  const storyIds = new Set<string>([project.current_story_id]);
  const parsed = parseProjectId(projectId);
  if (parsed) storyIds.add(parsed.storyId);
  for (const snapshot of versionSnapshots) {
    if (snapshot.story?.storyId) storyIds.add(snapshot.story.storyId);
  }

  let removedStoryFileCount = 0;
  for (const storyId of storyIds) {
    for (const storyFile of storySourcePathsForId(storyId)) {
      if (await pathExists(storyFile)) {
        await rm(storyFile, { force: true });
        removedStoryFileCount += 1;
      }
    }
  }
  await rm(projectDir(projectId), { recursive: true, force: true });

  return success({
    project_id: projectId,
    story_id: project.current_story_id,
    story_ids: [...storyIds],
    removed_story_file_count: removedStoryFileCount,
    deleted: true,
  });
}

export async function deleteProjects(projectIds: string[]): Promise<ApiResponse<StoryProjectBatchDeleteResult>> {
  const deleted: StoryProjectDeleteResult[] = [];
  const failed: StoryProjectBatchDeleteResult['failed'] = [];

  for (const projectId of [...new Set(projectIds)]) {
    const result = await deleteProject(projectId);
    if (result.ok && result.data) {
      deleted.push(result.data);
    } else {
      failed.push({
        project_id: projectId,
        error: result.error?.message ?? '删除故事项目失败',
      });
    }
  }

  return success({ deleted, failed });
}

export async function retainRecentProjects(keepRecent: number): Promise<ApiResponse<StoryProjectRetainRecentResult>> {
  const normalizedKeepRecent = Math.max(0, Math.floor(keepRecent));
  const stories = await readAllStoriesForMigration();
  stories.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return a.story.title.localeCompare(b.story.title, 'zh-CN');
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const keptProjectIds = new Set<string>();
  for (const item of stories.slice(0, normalizedKeepRecent)) {
    const meta = await ensureProjectFromStory(item.story, item.createdAt);
    keptProjectIds.add(meta.project_id);
  }

  const projectsResult = await listProjects();
  if (!projectsResult.ok || !projectsResult.data) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      projectsResult.error?.message ?? 'Failed to list projects',
    );
  }

  const kept = projectsResult.data.filter(project => keptProjectIds.has(project.project_id));
  const deleteIds = projectsResult.data
    .filter(project => !keptProjectIds.has(project.project_id))
    .map(project => project.project_id);
  const deletedResult = await deleteProjects(deleteIds);

  return success({
    keep_recent: normalizedKeepRecent,
    kept,
    deleted: deletedResult.data?.deleted ?? [],
    failed: deletedResult.data?.failed ?? deleteIds.map(projectId => ({
      project_id: projectId,
      error: deletedResult.error?.message ?? '批量删除故事项目失败',
    })),
  });
}

/** 旧故事 JSON 缺 generation_mode/generation_used_fallback → 填充默认值 */
function normalizeStoryGenerationFields(story: StoryGenerateResult): StoryGenerateResult {
  const normalized = {
    ...story,
    generation_mode: story.generation_mode ?? 'local_only',
    generation_used_fallback: story.generation_used_fallback ?? false,
  };
  normalized.gears_delivery = ensureGearsDeliveryPackage(normalized);
  if (normalized.quality_report) {
    normalized.quality_report = enrichStoryQualityReport({
      story: normalized,
      qualityReport: normalized.quality_report,
      gearsDelivery: normalized.gears_delivery,
    });
  }
  return normalized;
}

async function updateSourceStory(
  story: Pick<StoryGenerateResult, 'storyId' | 'video_type'>,
  updater: (raw: StoredStoryFile) => StoredStoryFile,
): Promise<void> {
  const sourcePath = storySourcePath(story);
  if (!(await pathExists(sourcePath))) return;
  const raw = await readJsonFile<StoredStoryFile>(sourcePath);
  await writeJsonFile(sourcePath, updater(raw));
}

export async function regenerateProjectScene(
  projectId: string,
  request: StorySceneRegenerateRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return detailResult;
  }

  const { project, current_story } = detailResult.data;
  const sceneIndex = current_story.scene_breakdown.findIndex(scene => scene.scene_id === request.scene_id);
  if (sceneIndex === -1) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Scene ${request.scene_id} not found in project "${projectId}"`);
  }

  const updatedStory = await regenerateSceneInStory(current_story, request);

  await persistProjectVersion(
    project,
    updatedStory,
    'scene_regeneration',
    [request.scene_id],
    buildRegenerationNote(request),
  );

  return getProject(projectId);
}

export async function repairProjectQuality(
  projectId: string,
  request: StoryQualityRepairRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return detailResult;
  }

  const { project, current_story } = detailResult.data;
  const { story: updatedStory, trace } = await repairStoryWithQualityWorkflow(current_story, request);
  const actionSceneIds = selectRequestedRepairActions(current_story.quality_report?.repair_action_items ?? [], request)
    ?.flatMap(action => action.scene_ids)
    .filter((sceneId, index, arr) => Number.isFinite(sceneId) && arr.indexOf(sceneId) === index) ?? [];
  const changedSceneIds = trace.applied
    ? (actionSceneIds.length > 0 ? actionSceneIds : current_story.scene_breakdown.map(scene => scene.scene_id))
    : [];

  await persistProjectVersion(
    project,
    updatedStory,
    'quality_repair',
    changedSceneIds,
    buildQualityRepairNote(trace),
  );

  return getProject(projectId);
}

export async function repairProjectProductionBoard(
  projectId: string,
  request: StoryProductionBoardRepairRequest,
): Promise<ApiResponse<StoryProductionBoardRepairResult>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detailResult.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detailResult.data;
  const repair = repairStoryWithProductionBoard(current_story, request);
  if (!repair.trace.applied) {
    return success({
      schema_version: 'story-production-board-repair/v1',
      project,
      detail: detailResult.data,
      before_board: repair.beforeBoard,
      after_board: repair.afterBoard,
      trace: repair.trace,
    });
  }

  const updatedMeta = await persistProjectVersion(
    project,
    repair.story,
    'production_board_repair',
    repair.trace.changed_scene_ids,
    repair.trace.note,
  );
  const nextDetail = await getProject(projectId);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      nextDetail.error?.message ?? `Project "${projectId}" not found after production repair`,
    );
  }

  return success({
    schema_version: 'story-production-board-repair/v1',
    project: updatedMeta,
    detail: nextDetail.data,
    before_board: repair.beforeBoard,
    after_board: repair.afterBoard,
    trace: repair.trace,
  });
}

export async function repairAndExportProjectProductionBoard(
  projectId: string,
  request: StoryProductionBoardRepairRequest,
): Promise<ApiResponse<StoryProductionBoardRepairExportResult>> {
  const repairResult = await repairProjectProductionBoard(projectId, request);
  if (!repairResult.ok || !repairResult.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      repairResult.error?.message ?? `Project "${projectId}" not found`,
      repairResult.error?.details,
    );
  }

  const exportResult = await exportProjectProductionBoard(projectId);
  if (!exportResult.ok || !exportResult.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      exportResult.error?.message ?? `Project "${projectId}" production board export failed`,
      exportResult.error?.details,
    );
  }

  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detailResult.error?.message ?? `Project "${projectId}" not found after production board export`,
      detailResult.error?.details,
    );
  }

  const repair: StoryProductionBoardRepairResult = {
    ...repairResult.data,
    project: detailResult.data.project,
    detail: detailResult.data,
  };

  return success({
    schema_version: 'story-production-board-repair-export/v1',
    project: detailResult.data.project,
    detail: detailResult.data,
    repair,
    export_package: exportResult.data,
  });
}

function selectRequestedRepairActions(
  actions: NonNullable<StoryGenerateResult['quality_report']>['repair_action_items'],
  request: StoryQualityRepairRequest,
) {
  const structured = actions ?? [];
  const byId = request.repair_action_id
    ? structured.filter(action => action.action_id === request.repair_action_id)
    : structured;
  if (request.repair_action_id && byId.length === 0) return [];
  return request.target_report
    ? byId.filter(action => action.target_report === request.target_report)
    : byId;
}

function buildQualityRepairNote(trace: StoryRepairTrace): string {
  const scoreText = typeof trace.before_genre_score === 'number' || typeof trace.after_genre_score === 'number'
    ? `（${trace.before_genre_score ?? '-'} -> ${trace.after_genre_score ?? '-'}）`
    : '';
  return trace.applied
    ? `一键质量修复已应用${scoreText}`
    : `一键质量修复未应用：${trace.reason}${scoreText}`;
}

export async function updateProjectSupplementTask(
  projectId: string,
  taskId: string,
  request: KnowledgeSupplementTaskUpdateRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return detailResult;
  }

  const { project, current_story } = detailResult.data;
  const tasks = current_story.supplement_tasks ?? [];
  const taskIndex = tasks.findIndex(task => task.task_id === taskId);
  if (taskIndex === -1) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Supplement task "${taskId}" not found in project "${projectId}"`);
  }

  const updatedAt = new Date().toISOString();
  const updatedTasks = tasks.map((task, index) => {
    if (index !== taskIndex) return task;
    const supplementNote = request.supplement_note?.trim();
    return {
      ...task,
      status: request.status,
      updated_at: updatedAt,
      resolved_at: request.status === 'resolved' ? updatedAt : undefined,
      supplement_note: supplementNote || task.supplement_note,
    };
  });
  const updatedStory: StoryGenerateResult = {
    ...current_story,
    supplement_tasks: updatedTasks,
  };
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
  };
  const currentPath = projectVersionPath(projectId, project.current_version_id);

  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(currentPath);
  await writeJsonFile(currentPath, {
    ...snapshot,
    story: updatedStory,
  });
  await writeJsonFile(projectMetaPath(projectId), updatedMeta);

  await updateSourceStory(updatedStory, raw => ({
    ...raw,
    supplement_tasks: updatedTasks,
    project_id: updatedStory.project_id,
    current_version_id: updatedStory.current_version_id,
  }));

  return getProject(projectId);
}

export async function updateProjectCurrentGearsDelivery(
  projectId: string | undefined,
  storyId: string,
  gearsDelivery: GearsDeliveryPackage,
): Promise<void> {
  if (!projectId) return;
  const metaPath = projectMetaPath(projectId);
  if (!(await pathExists(metaPath))) return;

  const project = await readJsonFile<StoryProjectMeta>(metaPath);
  const currentPath = resolve(dirname(metaPath), 'versions', `${project.current_version_id}.json`);
  if (!(await pathExists(currentPath))) return;

  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(currentPath);
  if (snapshot.story.storyId !== storyId) return;

  const updatedSnapshot: StoryProjectVersionSnapshot = {
    ...snapshot,
    story: {
      ...snapshot.story,
      gears_delivery: gearsDelivery,
    },
  };
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: new Date().toISOString(),
  };

  await writeJsonFile(currentPath, updatedSnapshot);
  await writeJsonFile(metaPath, updatedMeta);
}

export async function updateProjectCurrentGearsWebhookStatus(
  projectId: string | undefined,
  storyId: string,
  gearsWebhook: GearsWebhookStatus,
): Promise<void> {
  if (!projectId) return;
  const metaPath = projectMetaPath(projectId);
  if (!(await pathExists(metaPath))) return;

  const project = await readJsonFile<StoryProjectMeta>(metaPath);
  const currentPath = resolve(dirname(metaPath), 'versions', `${project.current_version_id}.json`);
  if (!(await pathExists(currentPath))) return;

  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(currentPath);
  if (snapshot.story.storyId !== storyId) return;

  const updatedSnapshot: StoryProjectVersionSnapshot = {
    ...snapshot,
    story: {
      ...snapshot.story,
      gears_webhook: gearsWebhook,
    },
  };
  const updatedAt = new Date().toISOString();
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
  };

  await writeJsonFile(currentPath, updatedSnapshot);
  await writeJsonFile(metaPath, updatedMeta);
  await updateSourceStory(snapshot.story, raw => ({
    ...raw,
    gears_webhook: gearsWebhook,
    project_id: snapshot.story.project_id,
    current_version_id: snapshot.story.current_version_id,
  }));
}

export async function updateProjectCurrentGearsVideo(
  projectId: string | undefined,
  storyId: string,
  gearsVideo: GearsVideoResult,
): Promise<void> {
  if (!projectId) return;
  const metaPath = projectMetaPath(projectId);
  if (!(await pathExists(metaPath))) return;

  const project = await readJsonFile<StoryProjectMeta>(metaPath);
  const currentPath = resolve(dirname(metaPath), 'versions', `${project.current_version_id}.json`);
  if (!(await pathExists(currentPath))) return;

  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(currentPath);
  if (snapshot.story.storyId !== storyId) return;

  const updatedSnapshot: StoryProjectVersionSnapshot = {
    ...snapshot,
    story: {
      ...snapshot.story,
      gears_video: gearsVideo,
    },
  };
  const updatedAt = new Date().toISOString();
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    gears_video_status: gearsVideo.status,
    gears_video_url: gearsVideo.video_url,
    gears_video_thumbnail_url: gearsVideo.thumbnail_url,
  };

  await writeJsonFile(currentPath, updatedSnapshot);
  await writeJsonFile(metaPath, updatedMeta);
  await updateSourceStory(snapshot.story, raw => ({
    ...raw,
    gears_video: gearsVideo,
    project_id: snapshot.story.project_id,
    current_version_id: snapshot.story.current_version_id,
  }));
}
