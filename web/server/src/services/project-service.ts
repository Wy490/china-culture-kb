import { dirname, extname, resolve } from 'node:path';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
import {
  fail,
  success,
  ErrorCodes,
  GEARS_CALLBACK_BATCH_ITEM_LIMIT,
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
  GearsExecutionJobType,
  GearsJobCallbackRequest,
  GearsJobCallbackResult,
  GearsJobLedger,
  GearsJobLedgerItem,
  GearsJobStatusSyncRequest,
  GearsJobStatusSyncResult,
  GearsJobSubmitFailure,
  GearsJobSubmitRequest,
  GearsJobSubmitResult,
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
  SeedanceProviderPollHttpMethod,
  SeedanceProviderPollRequestMode,
  SeedanceProviderSubmitRequestMode,
  SeedanceShotCallbackImportRequest,
  SeedanceShotCallbackImportResult,
  SeedanceShotCallbackRequest,
  SeedanceShotLedgerItem,
  SeedanceShotProductionStatus,
  SeedanceProviderFailureCategory,
  SeedanceProviderAdapterPayloadMode,
  SeedanceShotProviderCallbackRequest,
  SeedanceShotProviderCallbackResult,
  SeedanceShotProviderPollRequest,
  SeedanceShotProviderPollAdapterSummary,
  SeedanceShotProviderPollResult,
  SeedanceShotProviderPollTarget,
  SeedanceShotProviderQueueAttentionItem,
  SeedanceShotProviderQueueBatchOverview,
  SeedanceShotProviderQueueOverviewRequest,
  SeedanceShotProviderQueueOverviewResult,
  SeedanceShotProviderRetryPlanCandidate,
  SeedanceShotProviderRetryPlanPriority,
  SeedanceShotProviderRetryPlanReason,
  SeedanceShotProviderRetryPlanRequest,
  SeedanceShotProviderRetryPlanResult,
  SeedanceShotProviderRetrySubmitRequest,
  SeedanceShotProviderRetrySubmitResult,
  SeedanceShotRetryPackage,
  SeedanceShotRetryPackageShot,
  SeedanceShotAutoSelectRequest,
  SeedanceShotProviderQueue,
  SeedanceShotProviderQueueBatch,
  SeedanceShotProviderQueuePriority,
  SeedanceShotProviderRecoveryItem,
  SeedanceShotProviderRecoveryRequest,
  SeedanceShotProviderRecoveryResult,
  SeedanceShotProviderRecoverableStatus,
  SeedanceShotProviderSubmitRequest,
  SeedanceShotProviderSubmitAdapterSummary,
  SeedanceShotProviderSubmitFailure,
  SeedanceShotProviderSubmitResult,
  SeedanceShotStatusBatchUpdateRequest,
  SeedanceShotStatusBatchUpdateResult,
  SeedanceShotStatusUpdateRequest,
  SeedanceShotVersionSelectRequest,
  KnowledgeSupplementTaskUpdateRequest,
  KnowledgeSupplementTaskStatus,
  ProjectSupplementTaskListFilters,
  ProjectMaterialPackAddMaterialRequest,
  QualityRepairAction,
  CreationContract,
  MaterialPack,
  MaterialPackEntry,
  MaterialPurpose,
  MaterialSufficiencyReport,
  CreationUseCase,
  TruthMode,
  StoryStructureType,
  StorySceneRegenerateRequest,
  StoryQualityRepairRequest,
  StoryQualityRepairPromptRequest,
  StoryQualityRepairPromptResult,
  StoryQualityRepairApplyRequest,
  StoryQualityRepairChangeSummary,
  StoryQualityRepairApplyResult,
  StoryQualityReport,
  StoryRepairTrace,
  VideoType,
  GearsDeliveryPackage,
  GearsExecutionJobStatus,
  GearsWebhookStatus,
  GearsVideoResult,
  ProductionReadinessGearsSummary,
  ProductionReadinessAutomationRunLedger,
  ProductionReadinessAutomationRunRequest,
  ProductionReadinessAutomationRunResult,
  ProductionReadinessIssue,
  ProductionReadinessLane,
  ProductionReadinessNextAction,
  ProductionReadinessStatus,
  StoryProductionBoard,
  StoryProductionBoardExportFile,
  StoryProductionBoardExportPackage,
  StoryProductionBoardExportRecord,
  StoryProductionBoardRepairExportResult,
  StoryProductionBoardRepairRequest,
  StoryProductionBoardRepairResult,
  StoryProjectProductionReadinessReport,
} from '@shared/types.js';
import {
  buildCreationContract,
  buildMaterialSufficiencyReport,
  knowledgePackFromMaterialPack,
  materialPackFromKnowledgePack,
} from './creation-contract-service.js';
import { buildRegenerationNote, regenerateSceneInStory } from './story-regenerate-service.js';
import { ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { enrichStoryQualityReport } from './quality-workflow-service.js';
import { repairStoryWithQualityWorkflow } from './quality-repair-service.js';
import { validateDramaticStory } from './dramatic-story.js';
import { validateMemoryMosaicStory } from './memory-mosaic-service.js';
import { validateGenreStoryQuality } from './genre-quality-service.js';
import {
  buildStoryProductionBoard,
  seedanceShotProductionId,
  syncSeedanceShotLedgerWithShots,
} from './production-board-service.js';
import { buildProductionReadinessAutomationPlan } from './production-readiness-automation.js';
import { repairStoryWithProductionBoard } from './production-board-repair-service.js';
import {
  buildGearsLedgerItem,
  buildLocalGearsJobId,
  buildRejectedGearsLedgerItem,
  gearsProjectCallbackPath,
  gearsProjectCallbackUrl,
  gearsJobStatusIsTerminal,
  gearsCallbackEventIsDuplicate,
  gearsCallbackBatchPath,
  extractGearsJobCallbackRequests,
  markGearsLedgerPollFailures,
  mergeGearsCallbackEvents,
  mergeGearsLedgerItems,
  normalizeGearsJobCallback,
  normalizeGearsJobLedger,
  pollGearsExecutionJobStatuses,
  resolveGearsLedgerStatusAfterCallback,
  submitGearsExecutionJobs,
  type GearsExecutionSubmitUnit,
} from './gears-execution-service.js';

const ALL_VIDEO_TYPES: VideoType[] = [
  'character_story', 'historical_drama', 'legend_story',
  'culture_promo', 'heritage_promo', 'city_brand_promo',
  'scene_short', 'landscape_mood',
  'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
  'children_story', 'social_short', 'ai_comic_drama',
];

const SEEDANCE_SHOT_PRODUCTION_STATUSES: SeedanceShotProductionStatus[] = [
  'not_started',
  'prompt_exported',
  'submitted',
  'processing',
  'ready',
  'failed',
  'skipped',
];

const GEARS_EXECUTION_JOB_STATUSES: GearsExecutionJobStatus[] = [
  'submitted',
  'queued',
  'processing',
  'ready',
  'failed',
  'canceled',
  'rejected',
];

const DELIVERY_PAYLOAD_SUMMARY_INTERNAL_PATTERN =
  /(质量信号|主角目标|目标明确|行动具体|因果链|史实边界|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|知识库|用户大纲|生成优先级|资料显示|摘要|核心画面是|为什么必须面对|具体细节请核实来源|不可写成|确证史实|确证史源|创作边界|治理痕迹|分析|应该|注意|TODO|待补)/;

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

function projectSeedanceProviderApiPath(projectId: string, action: 'provider-callback' | 'poll-provider'): string {
  return `/api/projects/${projectId}/production-board/seedance-shots/${action}`;
}

function configuredSeedanceProviderCallbackBaseUrl(): string | undefined {
  const baseUrl = process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL?.trim()
    || process.env.GEARS_CALLBACK_BASE_URL?.trim()
    || process.env.PUBLIC_API_BASE_URL?.trim()
    || process.env.APP_BASE_URL?.trim();
  return baseUrl || undefined;
}

function joinPublicUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function projectSeedanceProviderApiUrl(
  projectId: string,
  action: 'provider-callback' | 'poll-provider',
): string | undefined {
  const baseUrl = configuredSeedanceProviderCallbackBaseUrl();
  if (!baseUrl) return undefined;
  return joinPublicUrl(baseUrl, projectSeedanceProviderApiPath(projectId, action));
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
    creation_use_case: story.creation_use_case,
    truth_mode: story.truth_mode,
    material_sufficiency: story.material_sufficiency,
    status: inferProjectStatus(story, versionCount),
    created_at: createdAt,
    updated_at: createdAt,
    current_version_id: currentVersionId,
    version_count: versionCount,
    creation_contract: story.creation_contract,
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
    failure_category: params.request.failure_category,
    provider_error_code: params.request.provider_error_code,
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
    && last.failure_category === nextVersion.failure_category
    && last.provider_error_code === nextVersion.provider_error_code
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
  if (['ready', 'completed', 'complete', 'succeeded', 'succeed', 'successed', 'success', 'done', 'finished'].includes(normalized)) {
    return 'ready';
  }
  if (['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled'].includes(normalized)) {
    return 'failed';
  }
  if (['processing', 'running', 'generating', 'in_progress', 'in-progress'].includes(normalized)) {
    return 'processing';
  }
  if (['submitted', 'queued', 'queueing', 'pending', 'waiting', 'accepted', 'created', 'started'].includes(normalized)) {
    return 'submitted';
  }
  if (['skipped', 'skip'].includes(normalized)) {
    return 'skipped';
  }
  if (hasFailureReason) return 'failed';
  if (hasVideoUrl) return 'ready';
  return 'processing';
}

function normalizeProviderFailureCategory(value: unknown): SeedanceProviderFailureCategory | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  const categories: SeedanceProviderFailureCategory[] = [
    'asset_missing',
    'prompt_invalid',
    'content_policy',
    'provider_timeout',
    'provider_quota',
    'provider_auth',
    'provider_rate_limit',
    'provider_server_error',
    'network_error',
    'unknown',
  ];
  return categories.includes(normalized as SeedanceProviderFailureCategory)
    ? normalized as SeedanceProviderFailureCategory
    : undefined;
}

const PROVIDER_ERROR_CODE_CATEGORY_PATTERNS: Array<{
  pattern: RegExp;
  category: SeedanceProviderFailureCategory;
}> = [
  {
    pattern: /(?:ASSET|MATERIAL|REFERENCE|RESOURCE|FILE|UPLOAD).*(?:MISSING|NOT_FOUND|NOTFOUND|FAILED|EXPIRED|INVALID)/,
    category: 'asset_missing',
  },
  {
    pattern: /(?:PROMPT|PARAM|PARAMETER|ARGUMENT|REQUEST|INPUT).*(?:INVALID|TOO_LONG|TOOLONG|BAD|ERROR)|BAD_REQUEST|INVALID_ARGUMENT|PARAMS_ERROR|INVALID_REQUEST/,
    category: 'prompt_invalid',
  },
  {
    pattern: /(?:POLICY|SAFETY|MODERATION|CONTENT|COPYRIGHT|CENSOR|AUDIT|RISK|NSFW).*(?:BLOCKED|REJECTED|FAILED|VIOLATION|DENIED)|SENSITIVE_CONTENT|RISK_CONTROL/,
    category: 'content_policy',
  },
  {
    pattern: /(?:TASK|JOB|PROVIDER|GENERATION).*(?:TIMEOUT|TIMED_OUT)|DEADLINE_EXCEEDED/,
    category: 'provider_timeout',
  },
  {
    pattern: /(?:QUOTA|BALANCE|BILLING|PAYMENT|CREDIT).*(?:EXCEEDED|INSUFFICIENT|REQUIRED|LOW|EMPTY)|INSUFFICIENT_BALANCE|NO_CREDIT|ACCOUNT_ARREARS/,
    category: 'provider_quota',
  },
  {
    pattern: /(?:AUTH|TOKEN|SIGNATURE|PERMISSION|CREDENTIAL|ACCESS).*(?:FAILED|INVALID|EXPIRED|DENIED|MISSING)|UNAUTHORIZED|FORBIDDEN|ACCESS_DENIED|INVALID_SIGNATURE/,
    category: 'provider_auth',
  },
  {
    pattern: /(?:RATE_LIMIT|RATELIMIT|TOO_MANY_REQUESTS|THROTTLED|THROTTLE|QPS|TPS|CONCURRENCY|429)/,
    category: 'provider_rate_limit',
  },
  {
    pattern: /(?:INTERNAL|SERVER|SERVICE|GATEWAY|SYSTEM|MODEL).*(?:ERROR|UNAVAILABLE|TIMEOUT|FAILED|BUSY)|HTTP_5\d\d|(?:^|_)5\d\d(?:_|$)/,
    category: 'provider_server_error',
  },
  {
    pattern: /(?:NETWORK|SOCKET|DNS|CONNECTION|ECONN|ETIMEDOUT).*(?:ERROR|FAILED|RESET|REFUSED|TIMEOUT)?/,
    category: 'network_error',
  },
];

function classifySeedanceProviderErrorCode(value?: string): SeedanceProviderFailureCategory | undefined {
  const normalized = value?.trim().toUpperCase().replace(/[\s.-]+/g, '_');
  if (!normalized) return undefined;
  return PROVIDER_ERROR_CODE_CATEGORY_PATTERNS.find(item => item.pattern.test(normalized))?.category;
}

function classifySeedanceProviderFailure(input: {
  explicitCategory?: unknown;
  providerErrorCode?: string;
  failureReason?: string;
  message?: string;
}): SeedanceProviderFailureCategory | undefined {
  const explicit = normalizeProviderFailureCategory(input.explicitCategory);
  if (explicit) return explicit;
  const codeCategory = classifySeedanceProviderErrorCode(input.providerErrorCode);
  if (codeCategory) return codeCategory;
  const text = [input.providerErrorCode, input.failureReason, input.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!text.trim()) return undefined;
  if (/(asset|material|file|upload|reference|missing|not_found|not found|素材|文件|上传|缺失|缺少)/.test(text)) {
    return 'asset_missing';
  }
  if (/(prompt|parameter|invalid|bad_request|400|提示词|参数|格式|无效|过长|超长)/.test(text)) {
    return 'prompt_invalid';
  }
  if (/(policy|safety|moderation|copyright|sensitive|violation|违规|审核|安全|敏感|版权)/.test(text)) {
    return 'content_policy';
  }
  if (/(timeout|timed out|deadline|超时|等待过久)/.test(text)) {
    return 'provider_timeout';
  }
  if (/(quota|insufficient|balance|billing|payment|余额|额度|配额|欠费)/.test(text)) {
    return 'provider_quota';
  }
  if (/(auth|unauthorized|forbidden|401|403|token|permission|鉴权|认证|权限|令牌)/.test(text)) {
    return 'provider_auth';
  }
  if (/(rate|too_many|429|throttle|限流|频率|过多请求)/.test(text)) {
    return 'provider_rate_limit';
  }
  if (/(5\d\d|server|internal|unavailable|gateway|平台异常|服务异常|服务器|不可用)/.test(text)) {
    return 'provider_server_error';
  }
  if (/(network|socket|dns|connection|econn|网络|连接)/.test(text)) {
    return 'network_error';
  }
  return 'unknown';
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

function seedanceProviderPollTargets(input: {
  board: StoryProductionBoard;
  statuses: Set<SeedanceShotProviderRecoverableStatus>;
  provider?: string;
  queueId?: string;
  shotIds?: Set<string>;
  limit: number;
  includePrompt: boolean;
  nowMs: number;
}): { checkedCount: number; targets: SeedanceShotProviderPollTarget[] } {
  const shotById = new Map(input.board.shot_units.map(shot => [shot.shot_id, shot]));
  const checkedItems = input.board.seedance_shot_ledger.items.filter(item => {
    if (!input.statuses.has(item.status as SeedanceShotProviderRecoverableStatus)) return false;
    if (input.provider && item.provider !== input.provider) return false;
    if (input.queueId && item.provider_queue_id !== input.queueId) return false;
    if (input.shotIds && !input.shotIds.has(item.shot_id)) return false;
    return true;
  });
  const targets = checkedItems
    .filter(item => Boolean(item.provider_job_id))
    .slice(0, input.limit)
    .map(item => {
      const shot = shotById.get(item.shot_id);
      return {
        shot_id: item.shot_id,
        source_scene_id: item.source_scene_id,
        status: item.status as SeedanceShotProviderRecoverableStatus,
        provider: item.provider,
        provider_job_id: item.provider_job_id,
        provider_queue_id: item.provider_queue_id,
        provider_queue_position: item.provider_queue_position,
        submitted_at: item.submitted_at,
        updated_at: item.updated_at,
        minutes_waiting: seedanceShotWaitingMinutes(item, input.nowMs),
        retry_count: item.retry_count,
        seedance_prompt: input.includePrompt ? shot?.seedance_prompt : undefined,
      };
    });
  return { checkedCount: checkedItems.length, targets };
}

function seedanceProviderEmptyStatusCounts(): Record<SeedanceShotProductionStatus, number> {
  return Object.fromEntries(
    SEEDANCE_SHOT_PRODUCTION_STATUSES.map(status => [status, 0]),
  ) as Record<SeedanceShotProductionStatus, number>;
}

function seedanceProviderIsActiveStatus(status: SeedanceShotProductionStatus): boolean {
  return status === 'submitted' || status === 'processing';
}

function seedanceProviderMatchesOverviewFilter(input: {
  item: SeedanceShotLedgerItem;
  provider?: string;
  queueId?: string;
}): boolean {
  if (input.provider && input.item.provider !== input.provider) return false;
  if (input.queueId && input.item.provider_queue_id !== input.queueId) return false;
  return true;
}

function seedanceProviderBatchOverview(input: {
  batch: SeedanceShotProviderQueueBatch;
  ledgerByShotId: Map<string, SeedanceShotLedgerItem>;
  timeoutMinutes: number;
  nowMs: number;
}): SeedanceShotProviderQueueBatchOverview {
  let activeCount = 0;
  let readyCount = 0;
  let failedItemCount = 0;
  let timedOutCount = 0;
  for (const batchItem of input.batch.items) {
    const ledgerItem = input.ledgerByShotId.get(batchItem.shot_id);
    const status = ledgerItem?.status ?? batchItem.status;
    if (seedanceProviderIsActiveStatus(status)) {
      activeCount += 1;
      const minutesWaiting = ledgerItem
        ? seedanceShotWaitingMinutes(ledgerItem, input.nowMs)
        : Math.max(0, Math.floor((input.nowMs - Date.parse(batchItem.queued_at)) / 60000));
      if (minutesWaiting >= input.timeoutMinutes) {
        timedOutCount += 1;
      }
    }
    if (status === 'ready') readyCount += 1;
    if (status === 'failed') failedItemCount += 1;
  }
  return {
    queue_id: input.batch.queue_id,
    provider: input.batch.provider,
    priority: input.batch.priority,
    created_at: input.batch.created_at,
    updated_at: input.batch.updated_at,
    note: input.batch.note,
    item_count: input.batch.items.length,
    submitted_count: input.batch.submitted_count,
    skipped_count: input.batch.skipped_count,
    failed_count: input.batch.failed_count,
    active_count: activeCount,
    ready_count: readyCount,
    failed_item_count: failedItemCount,
    timed_out_count: timedOutCount,
  };
}

function seedanceProviderAttentionItem(input: {
  item: SeedanceShotLedgerItem;
  timeoutMinutes: number;
  nowMs: number;
}): SeedanceShotProviderQueueAttentionItem {
  const minutesWaiting = seedanceShotWaitingMinutes(input.item, input.nowMs);
  const timedOut = seedanceProviderIsActiveStatus(input.item.status)
    && minutesWaiting >= input.timeoutMinutes;
  return {
    shot_id: input.item.shot_id,
    source_scene_id: input.item.source_scene_id,
    status: input.item.status,
    provider: input.item.provider,
    provider_job_id: input.item.provider_job_id,
    provider_queue_id: input.item.provider_queue_id,
    provider_queue_position: input.item.provider_queue_position,
    submitted_at: input.item.submitted_at,
    updated_at: input.item.updated_at,
    minutes_waiting: minutesWaiting,
    timed_out: timedOut,
    retry_count: input.item.retry_count,
    video_url: input.item.video_url,
    failure_reason: input.item.failure_reason,
    failure_category: input.item.failure_category,
    provider_error_code: input.item.provider_error_code,
    suggested_action: seedanceShotRetrySuggestedAction(input.item),
  };
}

function seedanceProviderNeedsAttention(item: SeedanceShotProviderQueueAttentionItem): boolean {
  if (item.timed_out) return true;
  if (item.status === 'submitted' || item.status === 'processing' || item.status === 'failed') return true;
  if (item.status === 'ready' && !item.video_url) return true;
  return false;
}

function seedanceProviderAttentionSort(
  a: SeedanceShotProviderQueueAttentionItem,
  b: SeedanceShotProviderQueueAttentionItem,
): number {
  const rank = (item: SeedanceShotProviderQueueAttentionItem) => {
    if (item.timed_out) return 0;
    if (item.status === 'failed') return 1;
    if (item.status === 'processing') return 2;
    if (item.status === 'submitted') return 3;
    if (item.status === 'ready') return 4;
    return 5;
  };
  return rank(a) - rank(b)
    || b.minutes_waiting - a.minutes_waiting
    || (a.provider_queue_position ?? 0) - (b.provider_queue_position ?? 0)
    || (a.source_scene_id ?? 0) - (b.source_scene_id ?? 0)
    || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN');
}

function seedanceProviderEmptyRetryReasonCounts(): Record<SeedanceShotProviderRetryPlanReason, number> {
  return {
    failed: 0,
    timed_out: 0,
    ready_missing_video: 0,
    unsubmitted: 0,
  };
}

function seedanceProviderRetryBlockReason(item: SeedanceShotLedgerItem): string | undefined {
  if (item.status === 'ready' && !item.video_url) return '状态已完成但缺少视频 URL，建议先向平台补拉结果。';
  if (item.failure_category === 'asset_missing') return '素材缺失，补齐或重新绑定素材后再提交。';
  if (item.failure_category === 'prompt_invalid') return '提示词或参数非法，修正 Seedance 提示词后再提交。';
  if (item.failure_category === 'content_policy') return '内容审核未通过，调整敏感或版权相关表达后再提交。';
  if (item.failure_category === 'provider_quota') return 'provider 额度或余额不足，恢复额度后再提交。';
  if (item.failure_category === 'provider_auth') return 'provider 鉴权或权限失败，修复凭证后再提交。';
  return undefined;
}

function seedanceProviderRetryReason(input: {
  item: SeedanceShotLedgerItem;
  timeoutMinutes: number;
  nowMs: number;
  includeUnsubmitted: boolean;
}): SeedanceShotProviderRetryPlanReason | undefined {
  if (input.item.status === 'failed') return 'failed';
  if (
    seedanceProviderIsActiveStatus(input.item.status)
    && seedanceShotWaitingMinutes(input.item, input.nowMs) >= input.timeoutMinutes
  ) {
    return 'timed_out';
  }
  if (input.item.status === 'ready' && !input.item.video_url) return 'ready_missing_video';
  if (
    input.includeUnsubmitted
    && (input.item.status === 'not_started' || input.item.status === 'prompt_exported')
  ) {
    return 'unsubmitted';
  }
  return undefined;
}

function seedanceProviderRetryPriority(
  reason: SeedanceShotProviderRetryPlanReason,
  item: SeedanceShotLedgerItem,
): SeedanceShotProviderRetryPlanPriority {
  if (reason === 'timed_out') return 'high';
  if (reason === 'failed') {
    if (
      item.failure_category === 'provider_timeout'
      || item.failure_category === 'provider_rate_limit'
      || item.failure_category === 'provider_server_error'
      || item.failure_category === 'network_error'
    ) {
      return 'high';
    }
    return 'normal';
  }
  if (reason === 'ready_missing_video') return 'normal';
  return 'low';
}

function seedanceProviderRetryCandidate(input: {
  item: SeedanceShotLedgerItem;
  reason: SeedanceShotProviderRetryPlanReason;
  timeoutMinutes: number;
  nowMs: number;
  maxRetryCount?: number;
}): SeedanceShotProviderRetryPlanCandidate {
  const blockReason = seedanceProviderRetryBlockReason(input.item);
  const maxRetryBlocked = typeof input.maxRetryCount === 'number'
    && input.item.retry_count >= input.maxRetryCount;
  const canResubmit = !blockReason && !maxRetryBlocked && input.reason !== 'ready_missing_video';
  return {
    shot_id: input.item.shot_id,
    source_scene_id: input.item.source_scene_id,
    status: input.item.status,
    retry_reason: input.reason,
    priority: seedanceProviderRetryPriority(input.reason, input.item),
    provider: input.item.provider,
    provider_job_id: input.item.provider_job_id,
    provider_queue_id: input.item.provider_queue_id,
    provider_queue_position: input.item.provider_queue_position,
    submitted_at: input.item.submitted_at,
    updated_at: input.item.updated_at,
    minutes_waiting: seedanceShotWaitingMinutes(input.item, input.nowMs),
    retry_count: input.item.retry_count,
    failure_reason: input.item.failure_reason,
    failure_category: input.item.failure_category,
    provider_error_code: input.item.provider_error_code,
    suggested_action: seedanceShotRetrySuggestedAction(input.item),
    can_resubmit: canResubmit,
    block_reason: maxRetryBlocked
      ? `已达到最大重试次数 ${input.maxRetryCount}`
      : blockReason,
  };
}

function seedanceProviderRetryCandidateSort(
  a: SeedanceShotProviderRetryPlanCandidate,
  b: SeedanceShotProviderRetryPlanCandidate,
): number {
  const priorityRank: Record<SeedanceShotProviderRetryPlanPriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
  };
  return priorityRank[a.priority] - priorityRank[b.priority]
    || Number(b.can_resubmit) - Number(a.can_resubmit)
    || b.minutes_waiting - a.minutes_waiting
    || (a.provider_queue_position ?? 0) - (b.provider_queue_position ?? 0)
    || (a.source_scene_id ?? 0) - (b.source_scene_id ?? 0)
    || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN');
}

type SeedanceProviderSubmitCandidate = {
  item: SeedanceShotLedgerItem;
  shot: StoryProductionBoard['shot_units'][number];
  providerJobId: string;
  queuePosition: number;
};

type SeedanceProviderSubmitAdapterAcceptedItem = {
  shot_id: string;
  provider_job_id: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  status: 'submitted' | 'processing';
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SEEDANCE_PROVIDER_RESULT_ARRAY_KEYS = [
  'submitted_shots',
  'submittedShots',
  'provider_results',
  'providerResults',
  'results',
  'items',
  'tasks',
  'task_list',
  'taskList',
  'jobs',
  'job_list',
  'jobList',
  'records',
  'list',
];

const SEEDANCE_PROVIDER_RESULT_CONTAINER_KEYS = [
  'data',
  'result',
  'response',
  'payload',
  'output',
];

function seedanceProviderArrayField(record: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return undefined;
}

function seedanceProviderLooksLikeResultRecord(record: Record<string, unknown>): boolean {
  const error = record.error;
  return [
    'shot_id',
    'shotId',
    'external_id',
    'externalId',
    'custom_id',
    'customId',
    'provider_job_id',
    'providerJobId',
    'job_id',
    'jobId',
    'task_id',
    'taskId',
    'request_id',
    'requestId',
    'id',
    'status',
    'task_status',
    'taskStatus',
    'state',
    'phase',
    'video_url',
    'videoUrl',
    'output_url',
    'outputUrl',
    'file_url',
    'fileUrl',
    'download_url',
    'downloadUrl',
    'result_url',
    'resultUrl',
    'url',
    'code',
    'error_code',
    'errorCode',
  ].some(key => record[key] !== undefined)
    || typeof error === 'string'
    || isObjectRecord(error);
}

function seedanceProviderResultArray(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  if (!isObjectRecord(payload)) return undefined;
  const direct = seedanceProviderArrayField(payload, SEEDANCE_PROVIDER_RESULT_ARRAY_KEYS);
  if (direct) return direct;
  for (const key of SEEDANCE_PROVIDER_RESULT_CONTAINER_KEYS) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested;
    if (isObjectRecord(nested)) {
      const nestedArray = seedanceProviderArrayField(nested, SEEDANCE_PROVIDER_RESULT_ARRAY_KEYS);
      if (nestedArray) return nestedArray;
      if (seedanceProviderLooksLikeResultRecord(nested)) return [nested];
    }
  }
  if (seedanceProviderLooksLikeResultRecord(payload)) return [payload];
  return undefined;
}

function seedanceProviderStringField(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return callbackStringField(value);
}

function seedanceProviderResultStatus(item: Record<string, unknown>): string | undefined {
  return seedanceProviderStringField(
    item.status ?? item.task_status ?? item.taskStatus ?? item.state ?? item.phase,
  );
}

function seedanceProviderResultShotId(item: Record<string, unknown>): string | undefined {
  return callbackStringField(
    item.shot_id
      ?? item.shotId
      ?? item.external_id
      ?? item.externalId
      ?? item.custom_id
      ?? item.customId,
  );
}

function seedanceProviderResultJobId(item: Record<string, unknown>): string | undefined {
  return seedanceProviderStringField(
    item.provider_job_id
      ?? item.providerJobId
      ?? item.job_id
      ?? item.jobId
      ?? item.task_id
      ?? item.taskId
      ?? item.request_id
      ?? item.requestId
      ?? item.id,
  );
}

function seedanceProviderResultQueueId(item: Record<string, unknown>): string | undefined {
  return seedanceProviderStringField(
    item.provider_queue_id
      ?? item.providerQueueId
      ?? item.queue_id
      ?? item.queueId
      ?? item.batch_id
      ?? item.batchId,
  );
}

function seedanceProviderResultQueuePosition(item: Record<string, unknown>): number | undefined {
  return callbackNumberField(
    item.provider_queue_position
      ?? item.providerQueuePosition
      ?? item.queue_position
      ?? item.queuePosition
      ?? item.position,
  );
}

function seedanceProviderResultVideoUrl(item: Record<string, unknown>): string | undefined {
  return callbackStringField(
    item.video_url
      ?? item.videoUrl
      ?? item.output_url
      ?? item.outputUrl
      ?? item.file_url
      ?? item.fileUrl
      ?? item.download_url
      ?? item.downloadUrl
      ?? item.result_url
      ?? item.resultUrl
      ?? item.url,
  );
}

function seedanceProviderResultErrorCode(item: Record<string, unknown>): string | undefined {
  const error = item.error;
  return seedanceProviderStringField(
    item.provider_error_code
      ?? item.providerErrorCode
      ?? item.error_code
      ?? item.errorCode
      ?? item.status_code
      ?? item.statusCode
      ?? item.code
      ?? (isObjectRecord(error) ? error.code ?? error.error_code ?? error.errorCode : undefined),
  );
}

function seedanceProviderResultMessage(item: Record<string, unknown>): string | undefined {
  const error = item.error;
  return callbackStringField(
    item.failure_reason
      ?? item.failureReason
      ?? item.error_message
      ?? item.errorMessage
      ?? item.reason
      ?? item.message
      ?? item.msg
      ?? (typeof error === 'string' ? error : undefined)
      ?? (isObjectRecord(error) ? error.message ?? error.msg ?? error.reason ?? error.detail : undefined),
  );
}

function seedanceProviderResultQualityScore(item: Record<string, unknown>): number | undefined {
  return callbackNumberField(item.quality_score ?? item.qualityScore ?? item.score ?? item.quality);
}

function seedanceProviderCallbackRequestFromAdapterItem(item: Record<string, unknown>): SeedanceShotProviderCallbackRequest {
  return {
    provider: callbackStringField(item.provider),
    shot_id: seedanceProviderResultShotId(item),
    job_id: seedanceProviderResultJobId(item),
    queue_id: seedanceProviderResultQueueId(item),
    queue_position: seedanceProviderResultQueuePosition(item),
    status: seedanceProviderResultStatus(item),
    url: seedanceProviderResultVideoUrl(item),
    failure_reason: seedanceProviderResultMessage(item),
    failure_category: normalizeProviderFailureCategory(item.failure_category ?? item.failureCategory),
    provider_error_code: seedanceProviderResultErrorCode(item),
    quality_score: seedanceProviderResultQualityScore(item),
    review_note: callbackStringField(item.review_note ?? item.reviewNote),
    message: callbackStringField(item.message ?? item.msg),
    note: callbackStringField(item.note),
    payload: item,
  };
}

function configuredSeedanceProviderSubmitEndpoint(): string | undefined {
  const endpoint = process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT?.trim();
  return endpoint || undefined;
}

function configuredSeedanceProviderPollEndpoint(): string | undefined {
  const endpoint = process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT?.trim();
  return endpoint || undefined;
}

function seedanceProviderSubmitRequestMode(): SeedanceProviderSubmitRequestMode {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE?.trim().toLowerCase() === 'per_shot'
    ? 'per_shot'
    : 'batch';
}

function seedanceProviderPollRequestMode(): SeedanceProviderPollRequestMode {
  return process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE?.trim().toLowerCase() === 'per_target'
    ? 'per_target'
    : 'batch';
}

function seedanceProviderPollHttpMethod(): SeedanceProviderPollHttpMethod {
  return process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD?.trim().toUpperCase() === 'GET'
    ? 'GET'
    : 'POST';
}

function seedanceProviderAdapterPayloadMode(kind: 'submit' | 'poll'): SeedanceProviderAdapterPayloadMode {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE
    : process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE;
  const value = specific?.trim() || process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE?.trim();
  return value?.toLowerCase() === 'platform' ? 'platform' : 'story_agent';
}

function seedanceProviderPlatformField(envName: string, fallback: string): string {
  const value = process.env[envName]?.trim();
  return value || fallback;
}

function setSeedanceProviderPlatformField(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (!path.trim() || value === undefined || value === null) return;
  if (typeof value === 'string' && !value.trim()) return;
  if (Array.isArray(value) && value.length === 0) return;
  const parts = path.split('.').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!isObjectRecord(existing)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function seedanceProviderModelValue(): string | undefined {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_MODEL?.trim()
    || process.env.SEEDANCE_PROVIDER_MODEL?.trim()
    || undefined;
}

function seedanceProviderPlatformSubmitMetadata(input: {
  projectId: string;
  story: StoryGenerateResult;
  provider: string;
  queueId: string;
  queuePriority: SeedanceShotProviderQueuePriority;
  note?: string;
  candidate?: SeedanceProviderSubmitCandidate;
}): Record<string, unknown> {
  return {
    schema_version: 'seedance-provider-platform-submit/v1',
    project_id: input.projectId,
    story_id: input.story.storyId,
    title: input.story.title,
    provider: input.provider,
    queue_id: input.queueId,
    queue_priority: input.queuePriority,
    note: input.note,
    shot_id: input.candidate?.item.shot_id,
    source_scene_id: input.candidate?.shot.source_scene_id,
    local_provider_job_id: input.candidate?.providerJobId,
    provider_queue_position: input.candidate?.queuePosition,
  };
}

function seedanceProviderPlatformSubmitShotPayload(input: {
  projectId: string;
  story: StoryGenerateResult;
  provider: string;
  queueId: string;
  queuePriority: SeedanceShotProviderQueuePriority;
  providerCallbackUrl?: string;
  providerPollUrl?: string;
  note?: string;
  candidate: SeedanceProviderSubmitCandidate;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const shot = input.candidate.shot;
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_PROMPT_FIELD', 'prompt'),
    shot.seedance_prompt,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_DURATION_FIELD', 'duration'),
    shot.seedance_duration_sec,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_EXTERNAL_ID_FIELD', 'external_id'),
    input.candidate.item.shot_id,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_CALLBACK_URL_FIELD', 'callback_url'),
    input.providerCallbackUrl,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_POLL_URL_FIELD', 'poll_url'),
    input.providerPollUrl,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_MODEL_FIELD', 'model'),
    seedanceProviderModelValue(),
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_ASSETS_FIELD', 'assets'),
    shot.seedance_asset_slots,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_NEGATIVE_PROMPT_FIELD', 'negative_prompt'),
    shot.negative_constraints?.join('；'),
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_METADATA_FIELD', 'metadata'),
    seedanceProviderPlatformSubmitMetadata(input),
  );
  return payload;
}

function seedanceProviderPlatformSubmitBatchPayload(input: {
  projectId: string;
  story: StoryGenerateResult;
  provider: string;
  queueId: string;
  queuePriority: SeedanceShotProviderQueuePriority;
  providerCallbackUrl?: string;
  providerPollUrl?: string;
  note?: string;
  candidates: SeedanceProviderSubmitCandidate[];
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_TASKS_FIELD', 'tasks'),
    input.candidates.map(candidate => seedanceProviderPlatformSubmitShotPayload({ ...input, candidate })),
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_CALLBACK_URL_FIELD', 'callback_url'),
    input.providerCallbackUrl,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_SUBMIT_METADATA_FIELD', 'metadata'),
    seedanceProviderPlatformSubmitMetadata(input),
  );
  return payload;
}

function seedanceProviderPlatformPollMetadata(input: {
  projectId: string;
  provider?: string;
  queueId?: string;
  note?: string;
  target?: SeedanceShotProviderPollTarget;
}): Record<string, unknown> {
  return {
    schema_version: 'seedance-provider-platform-poll/v1',
    project_id: input.projectId,
    provider: input.provider,
    queue_id: input.queueId,
    note: input.note,
    shot_id: input.target?.shot_id,
    source_scene_id: input.target?.source_scene_id,
    provider_job_id: input.target?.provider_job_id,
    provider_queue_id: input.target?.provider_queue_id,
    provider_queue_position: input.target?.provider_queue_position,
    retry_count: input.target?.retry_count,
  };
}

function seedanceProviderPlatformPollTargetPayload(input: {
  projectId: string;
  provider?: string;
  queueId?: string;
  note?: string;
  target: SeedanceShotProviderPollTarget;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_POLL_TASK_ID_FIELD', 'task_id'),
    input.target.provider_job_id,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_POLL_EXTERNAL_ID_FIELD', 'external_id'),
    input.target.shot_id,
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_POLL_METADATA_FIELD', 'metadata'),
    seedanceProviderPlatformPollMetadata(input),
  );
  return payload;
}

function seedanceProviderPlatformPollBatchPayload(input: {
  projectId: string;
  provider?: string;
  queueId?: string;
  note?: string;
  targets: SeedanceShotProviderPollTarget[];
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_POLL_TASK_IDS_FIELD', 'task_ids'),
    input.targets.map(target => target.provider_job_id).filter(Boolean),
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_POLL_TARGETS_FIELD', 'targets'),
    input.targets.map(target => seedanceProviderPlatformPollTargetPayload({ ...input, target })),
  );
  setSeedanceProviderPlatformField(
    payload,
    seedanceProviderPlatformField('SEEDANCE_PROVIDER_POLL_METADATA_FIELD', 'metadata'),
    seedanceProviderPlatformPollMetadata(input),
  );
  return payload;
}

function seedanceProviderEndpointValue(value: unknown): string {
  return value === undefined || value === null ? '' : encodeURIComponent(String(value));
}

function seedanceProviderPollEndpointForTarget(input: {
  endpoint: string;
  projectId: string;
  provider?: string;
  queueId?: string;
  target?: SeedanceShotProviderPollTarget;
}): string {
  const values: Record<string, unknown> = {
    project_id: input.projectId,
    projectId: input.projectId,
    provider: input.provider,
    queue_id: input.queueId,
    queueId: input.queueId,
    shot_id: input.target?.shot_id,
    shotId: input.target?.shot_id,
    provider_job_id: input.target?.provider_job_id,
    providerJobId: input.target?.provider_job_id,
    job_id: input.target?.provider_job_id,
    jobId: input.target?.provider_job_id,
    provider_queue_id: input.target?.provider_queue_id,
    providerQueueId: input.target?.provider_queue_id,
  };
  return input.endpoint.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) =>
    seedanceProviderEndpointValue(values[key])
  );
}

function seedanceProviderSubmitTimeoutMs(): number {
  const parsed = Number(process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30000;
  return Math.min(parsed, 60000);
}

function seedanceProviderPollTimeoutMs(): number {
  const parsed = Number(process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10000;
  return Math.min(parsed, 30000);
}

function seedanceProviderAdapterAuthHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_AUTH_HEADER?.trim()
    || 'authorization';
}

function seedanceProviderAdapterAuthScheme(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME
    : process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_AUTH_SCHEME?.trim()
    || 'Bearer';
}

function seedanceProviderAdapterToken(kind: 'submit' | 'poll'): string | undefined {
  if (kind === 'submit') {
    return process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN?.trim()
      || process.env.SEEDANCE_PROVIDER_API_TOKEN?.trim()
      || undefined;
  }
  return process.env.SEEDANCE_PROVIDER_API_TOKEN?.trim() || undefined;
}

function seedanceProviderAdapterAuthValue(token: string, scheme: string): string {
  const normalized = scheme.trim();
  if (!normalized || ['raw', 'none', 'no_scheme'].includes(normalized.toLowerCase())) return token;
  return `${normalized} ${token}`;
}

function applySeedanceProviderAdapterAuthHeader(
  headers: Record<string, string>,
  kind: 'submit' | 'poll',
): void {
  const token = seedanceProviderAdapterToken(kind);
  if (!token) return;
  headers[seedanceProviderAdapterAuthHeader(kind)] = seedanceProviderAdapterAuthValue(
    token,
    seedanceProviderAdapterAuthScheme(kind),
  );
}

function seedanceProviderAdapterSignatureSecret(kind: 'submit' | 'poll'): string | undefined {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET
    : process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET?.trim()
    || undefined;
}

function seedanceProviderAdapterSignatureHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER?.trim()
    || 'X-Seedance-Signature';
}

function seedanceProviderAdapterTimestampHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER?.trim()
    || 'X-Seedance-Timestamp';
}

function seedanceProviderAdapterSignatureAlgorithm(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_ALGORITHM
    : process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_ALGORITHM;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_ALGORITHM?.trim()
    || 'sha256';
}

function seedanceProviderAdapterSignaturePrefix(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_PREFIX
    : process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_PREFIX;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_PREFIX?.trim()
    || 'sha256=';
}

function applySeedanceProviderAdapterSignatureHeaders(input: {
  headers: Record<string, string>;
  kind: 'submit' | 'poll';
  method: 'POST' | 'GET';
  endpoint: string;
  bodyText: string;
}): void {
  const secret = seedanceProviderAdapterSignatureSecret(input.kind);
  if (!secret) return;
  const timestamp = new Date().toISOString();
  const signatureBase = [
    input.method,
    input.endpoint,
    timestamp,
    input.bodyText,
  ].join('\n');
  const digest = createHmac(seedanceProviderAdapterSignatureAlgorithm(input.kind), secret)
    .update(signatureBase)
    .digest('hex');
  input.headers[seedanceProviderAdapterTimestampHeader(input.kind)] = timestamp;
  input.headers[seedanceProviderAdapterSignatureHeader(input.kind)] =
    `${seedanceProviderAdapterSignaturePrefix(input.kind)}${digest}`;
}

function seedanceProviderAdapterRequestInit(input: {
  kind: 'submit' | 'poll';
  method: 'POST' | 'GET';
  endpoint: string;
  signal: AbortSignal;
  body?: unknown;
}): RequestInit {
  const headers: Record<string, string> = {};
  const bodyText = input.body === undefined ? '' : JSON.stringify(input.body);
  if (input.body !== undefined) headers['content-type'] = 'application/json';
  applySeedanceProviderAdapterAuthHeader(headers, input.kind);
  applySeedanceProviderAdapterSignatureHeaders({
    headers,
    kind: input.kind,
    method: input.method,
    endpoint: input.endpoint,
    bodyText,
  });
  return {
    method: input.method,
    headers,
    signal: input.signal,
    ...(input.body === undefined ? {} : { body: bodyText }),
  };
}

function seedanceProviderSubmitResultArray(payload: unknown): unknown[] | undefined {
  return seedanceProviderResultArray(payload);
}

function normalizeSeedanceProviderSubmitAdapterStatus(value: unknown): 'submitted' | 'processing' | 'failed' {
  if (typeof value !== 'string') return 'submitted';
  const normalized = value.trim().toLowerCase();
  if (['processing', 'running', 'in_progress'].includes(normalized)) return 'processing';
  if (['failed', 'failure', 'error', 'rejected', 'blocked'].includes(normalized)) return 'failed';
  return 'submitted';
}

function normalizeSeedanceProviderSubmitAdapterResults(input: {
  payload: unknown;
  candidates: SeedanceProviderSubmitCandidate[];
  requestMode: SeedanceProviderSubmitRequestMode;
}): {
  accepted: SeedanceProviderSubmitAdapterAcceptedItem[];
  failures: SeedanceShotProviderSubmitFailure[];
  summary: SeedanceShotProviderSubmitAdapterSummary;
} | string {
  if (isObjectRecord(input.payload) && input.payload.ok === false) {
    const error = isObjectRecord(input.payload.error) ? input.payload.error.message : undefined;
    return typeof error === 'string' && error.trim()
      ? `Seedance provider submit adapter failed: ${error.trim()}`
      : 'Seedance provider submit adapter returned ok=false';
  }
  const rawResults = seedanceProviderSubmitResultArray(input.payload);
  if (!rawResults) {
    return 'Seedance provider submit adapter response must be an array or include submitted_shots/provider_results/results/items/tasks/data.tasks';
  }

  const candidatesByShotId = new Map(input.candidates.map(candidate => [candidate.item.shot_id, candidate]));
  const accepted: SeedanceProviderSubmitAdapterAcceptedItem[] = [];
  const failures: SeedanceShotProviderSubmitFailure[] = [];
  const seenShotIds = new Set<string>();
  for (const [index, item] of rawResults.entries()) {
    if (!isObjectRecord(item)) {
      return `Seedance provider submit adapter result #${index + 1} must be an object`;
    }
    const shotId = seedanceProviderResultShotId(item)
      ?? (rawResults.length === 1 && input.candidates.length === 1 ? input.candidates[0].item.shot_id : undefined);
    if (!shotId) {
      return `Seedance provider submit adapter result #${index + 1} requires shot_id`;
    }
    const candidate = candidatesByShotId.get(shotId);
    if (!candidate) {
      failures.push({
        index,
        shot_id: shotId,
        message: `Seedance provider submit adapter returned unknown shot "${shotId}"`,
      });
      continue;
    }
    seenShotIds.add(shotId);
    const status = normalizeSeedanceProviderSubmitAdapterStatus(seedanceProviderResultStatus(item));
    const message = seedanceProviderResultMessage(item);
    if (status === 'failed') {
      failures.push({
        index: candidate.queuePosition - 1,
        shot_id: shotId,
        message: message ?? 'Seedance provider submit adapter rejected this shot',
      });
      continue;
    }
    const providerJobId = seedanceProviderResultJobId(item);
    if (!providerJobId) {
      failures.push({
        index: candidate.queuePosition - 1,
        shot_id: shotId,
        message: 'Seedance provider submit adapter accepted shot without provider_job_id/job_id',
      });
      continue;
    }
    accepted.push({
      shot_id: shotId,
      provider_job_id: providerJobId,
      provider_queue_id: seedanceProviderResultQueueId(item),
      provider_queue_position: seedanceProviderResultQueuePosition(item),
      status,
    });
  }

  input.candidates.forEach(candidate => {
    if (seenShotIds.has(candidate.item.shot_id)) return;
    failures.push({
      index: candidate.queuePosition - 1,
      shot_id: candidate.item.shot_id,
      message: 'Seedance provider submit adapter did not return this shot',
    });
  });

  return {
    accepted,
    failures,
    summary: {
      endpoint_configured: true,
      request_mode: input.requestMode,
      requested_count: input.candidates.length,
      accepted_count: accepted.length,
      failed_count: failures.length,
    },
  };
}

async function querySeedanceProviderSubmitAdapter(input: {
  projectId: string;
  story: StoryGenerateResult;
  provider: string;
  queueId: string;
  queuePriority: SeedanceShotProviderQueuePriority;
  note?: string;
  assetLibrary?: SeedanceAssetLibrary;
  candidates: SeedanceProviderSubmitCandidate[];
}): Promise<ApiResponse<{
  accepted: SeedanceProviderSubmitAdapterAcceptedItem[];
  failures: SeedanceShotProviderSubmitFailure[];
  summary: SeedanceShotProviderSubmitAdapterSummary;
}>> {
  const endpoint = configuredSeedanceProviderSubmitEndpoint();
  if (!endpoint) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'SEEDANCE_PROVIDER_SUBMIT_ENDPOINT is required when use_provider_adapter=true',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), seedanceProviderSubmitTimeoutMs());
  try {
    const requestMode = seedanceProviderSubmitRequestMode();
    const payloadMode = seedanceProviderAdapterPayloadMode('submit');
    const providerCallbackPath = projectSeedanceProviderApiPath(input.projectId, 'provider-callback');
    const providerPollPath = projectSeedanceProviderApiPath(input.projectId, 'poll-provider');
    const providerCallbackUrl = projectSeedanceProviderApiUrl(input.projectId, 'provider-callback');
    const providerPollUrl = projectSeedanceProviderApiUrl(input.projectId, 'poll-provider');
    const basePayload = {
      schema_version: 'seedance-provider-submit/v1',
      request_mode: requestMode,
      project_id: input.projectId,
      storyId: input.story.storyId,
      title: input.story.title,
      provider: input.provider,
      queue_id: input.queueId,
      queue_priority: input.queuePriority,
      provider_callback_path: providerCallbackPath,
      provider_poll_path: providerPollPath,
      provider_callback_url: providerCallbackUrl,
      provider_poll_url: providerPollUrl,
      note: input.note,
      seedance_asset_library: input.assetLibrary,
    };
    const shotPayloads = input.candidates.map(candidate => ({
      candidate,
      shot: {
        shot_id: candidate.item.shot_id,
        source_scene_id: candidate.shot.source_scene_id,
        provider_job_id: candidate.providerJobId,
        provider_queue_position: candidate.queuePosition,
        duration_sec: candidate.shot.seedance_duration_sec,
        seedance_prompt: candidate.shot.seedance_prompt,
        seedance_asset_slots: candidate.shot.seedance_asset_slots,
        seedance_material_validation: candidate.shot.seedance_material_validation,
        seedance_validation_notes: candidate.shot.seedance_validation_notes,
        negative_constraints: candidate.shot.negative_constraints,
      },
    }));

    if (requestMode === 'per_shot') {
      const accepted: SeedanceProviderSubmitAdapterAcceptedItem[] = [];
      const failures: SeedanceShotProviderSubmitFailure[] = [];
      for (const item of shotPayloads) {
        const body = payloadMode === 'platform'
          ? seedanceProviderPlatformSubmitShotPayload({
              projectId: input.projectId,
              story: input.story,
              provider: input.provider,
              queueId: input.queueId,
              queuePriority: input.queuePriority,
              providerCallbackUrl,
              providerPollUrl,
              note: input.note,
              candidate: item.candidate,
            })
          : {
              ...basePayload,
              shot: item.shot,
              shots: [item.shot],
            };
        const response = await fetch(endpoint, seedanceProviderAdapterRequestInit({
          kind: 'submit',
          method: 'POST',
          endpoint,
          signal: controller.signal,
          body,
        }));
        const text = await response.text();
        if (!response.ok) {
          failures.push({
            index: item.candidate.queuePosition - 1,
            shot_id: item.candidate.item.shot_id,
            message: `Seedance provider submit adapter returned HTTP ${response.status}: ${text.slice(0, 200)}`,
          });
          continue;
        }
        const payload = text.trim() ? JSON.parse(text) as unknown : [];
        const normalized = normalizeSeedanceProviderSubmitAdapterResults({
          payload,
          candidates: [item.candidate],
          requestMode,
        });
        if (typeof normalized === 'string') {
          failures.push({
            index: item.candidate.queuePosition - 1,
            shot_id: item.candidate.item.shot_id,
            message: normalized,
          });
          continue;
        }
        accepted.push(...normalized.accepted);
        failures.push(...normalized.failures);
      }
      return success({
        accepted,
        failures,
        summary: {
          endpoint_configured: true,
          request_mode: requestMode,
          requested_count: input.candidates.length,
          accepted_count: accepted.length,
          failed_count: failures.length,
        },
      });
    }

    const body = payloadMode === 'platform'
      ? seedanceProviderPlatformSubmitBatchPayload({
          projectId: input.projectId,
          story: input.story,
          provider: input.provider,
          queueId: input.queueId,
          queuePriority: input.queuePriority,
          providerCallbackUrl,
          providerPollUrl,
          note: input.note,
          candidates: input.candidates,
        })
      : {
          ...basePayload,
          shots: shotPayloads.map(item => item.shot),
        };
    const response = await fetch(endpoint, seedanceProviderAdapterRequestInit({
      kind: 'submit',
      method: 'POST',
      endpoint,
      signal: controller.signal,
      body,
    }));
    const text = await response.text();
    if (!response.ok) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        `Seedance provider submit adapter returned HTTP ${response.status}`,
        { status: response.status, body: text.slice(0, 500) },
      );
    }
    const payload = text.trim() ? JSON.parse(text) as unknown : [];
    const normalized = normalizeSeedanceProviderSubmitAdapterResults({
      payload,
      candidates: input.candidates,
      requestMode,
    });
    if (typeof normalized === 'string') {
      return fail(ErrorCodes.VALIDATION_ERROR, normalized);
    }
    return success(normalized);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return fail(ErrorCodes.INTERNAL_ERROR, `Seedance provider submit adapter request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

function seedanceProviderPollResultArray(payload: unknown): unknown[] | undefined {
  return seedanceProviderResultArray(payload);
}

function normalizeSeedanceProviderPollAdapterResults(
  payload: unknown,
): SeedanceShotProviderCallbackRequest[] | string {
  if (isObjectRecord(payload) && payload.ok === false) {
    const error = isObjectRecord(payload.error) ? payload.error.message : undefined;
    return typeof error === 'string' && error.trim()
      ? `Seedance provider adapter failed: ${error.trim()}`
      : 'Seedance provider adapter returned ok=false';
  }
  const rawResults = seedanceProviderPollResultArray(payload);
  if (!rawResults) {
    return 'Seedance provider adapter response must be an array or include provider_results/results/items/tasks/data.tasks';
  }
  const results: SeedanceShotProviderCallbackRequest[] = [];
  for (const [index, item] of rawResults.entries()) {
    if (!isObjectRecord(item)) {
      return `Seedance provider adapter result #${index + 1} must be an object`;
    }
    const normalizedItem = seedanceProviderCallbackRequestFromAdapterItem(item);
    const shotId = callbackStringField(normalizedItem.shot_id ?? normalizedItem.shotId);
    const providerJobId = callbackStringField(
      normalizedItem.provider_job_id
        ?? normalizedItem.providerJobId
        ?? normalizedItem.job_id
        ?? normalizedItem.jobId,
    );
    const providerQueueId = callbackStringField(
      normalizedItem.provider_queue_id
        ?? normalizedItem.providerQueueId
        ?? normalizedItem.queue_id
        ?? normalizedItem.queueId,
    );
    if (!shotId && !providerJobId && !providerQueueId) {
      return `Seedance provider adapter result #${index + 1} requires shot_id, provider_job_id/job_id, or provider_queue_id/queue_id`;
    }
    results.push(normalizedItem);
  }
  return results;
}

async function querySeedanceProviderPollAdapter(input: {
  projectId: string;
  provider?: string;
  queueId?: string;
  note?: string;
  targets: SeedanceShotProviderPollTarget[];
}): Promise<ApiResponse<{
  providerResults: SeedanceShotProviderCallbackRequest[];
  summary: SeedanceShotProviderPollAdapterSummary;
}>> {
  const endpoint = configuredSeedanceProviderPollEndpoint();
  if (!endpoint) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'SEEDANCE_PROVIDER_POLL_ENDPOINT is required when use_provider_adapter=true',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), seedanceProviderPollTimeoutMs());
  try {
    const requestMode = seedanceProviderPollRequestMode();
    const httpMethod = seedanceProviderPollHttpMethod();
    const payloadMode = seedanceProviderAdapterPayloadMode('poll');
    const basePayload = {
      schema_version: 'seedance-provider-poll/v1',
      request_mode: requestMode,
      project_id: input.projectId,
      provider: input.provider,
      queue_id: input.queueId,
      note: input.note,
    };

    if (requestMode === 'per_target') {
      const providerResults: SeedanceShotProviderCallbackRequest[] = [];
      for (const target of input.targets) {
        const requestPayload = {
          ...basePayload,
          target,
          targets: [target],
        };
        const requestEndpoint = seedanceProviderPollEndpointForTarget({
          endpoint,
          projectId: input.projectId,
          provider: input.provider,
          queueId: input.queueId,
          target,
        });
        const body = httpMethod === 'POST'
          ? (payloadMode === 'platform'
              ? seedanceProviderPlatformPollTargetPayload({
                  projectId: input.projectId,
                  provider: input.provider,
                  queueId: input.queueId,
                  note: input.note,
                  target,
                })
              : requestPayload)
          : undefined;
        const response = await fetch(requestEndpoint, seedanceProviderAdapterRequestInit({
          kind: 'poll',
          method: httpMethod,
          endpoint: requestEndpoint,
          signal: controller.signal,
          body,
        }));
        const text = await response.text();
        if (!response.ok) {
          return fail(
            ErrorCodes.INTERNAL_ERROR,
            `Seedance provider adapter returned HTTP ${response.status}`,
            { status: response.status, body: text.slice(0, 500), shot_id: target.shot_id },
          );
        }
        const payload = text.trim() ? JSON.parse(text) as unknown : [];
        const normalized = normalizeSeedanceProviderPollAdapterResults(payload);
        if (typeof normalized === 'string') {
          return fail(ErrorCodes.VALIDATION_ERROR, normalized);
        }
        providerResults.push(...normalized);
      }
      return success({
        providerResults,
        summary: {
          endpoint_configured: true,
          request_mode: requestMode,
          http_method: httpMethod,
          queried_count: input.targets.length,
          returned_count: providerResults.length,
        },
      });
    }

    const requestPayload = {
      ...basePayload,
      targets: input.targets,
    };
    const requestEndpoint = seedanceProviderPollEndpointForTarget({
      endpoint,
      projectId: input.projectId,
      provider: input.provider,
      queueId: input.queueId,
    });
    const body = httpMethod === 'POST'
      ? (payloadMode === 'platform'
          ? seedanceProviderPlatformPollBatchPayload({
              projectId: input.projectId,
              provider: input.provider,
              queueId: input.queueId,
              note: input.note,
              targets: input.targets,
            })
          : requestPayload)
      : undefined;
    const response = await fetch(requestEndpoint, seedanceProviderAdapterRequestInit({
      kind: 'poll',
      method: httpMethod,
      endpoint: requestEndpoint,
      signal: controller.signal,
      body,
    }));
    const text = await response.text();
    if (!response.ok) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        `Seedance provider adapter returned HTTP ${response.status}`,
        { status: response.status, body: text.slice(0, 500) },
      );
    }
    const payload = text.trim() ? JSON.parse(text) as unknown : [];
    const providerResults = normalizeSeedanceProviderPollAdapterResults(payload);
    if (typeof providerResults === 'string') {
      return fail(ErrorCodes.VALIDATION_ERROR, providerResults);
    }
    return success({
      providerResults,
      summary: {
        endpoint_configured: true,
        request_mode: requestMode,
        http_method: httpMethod,
        queried_count: input.targets.length,
        returned_count: providerResults.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return fail(ErrorCodes.INTERNAL_ERROR, `Seedance provider adapter request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
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
  const providerJobId = seedanceProviderStringField(
    callback.provider_job_id
      ?? callback.providerJobId
      ?? callback.job_id
      ?? callback.jobId
      ?? callback.task_id
      ?? callback.taskId
      ?? callback.request_id
      ?? callback.requestId
      ?? callback.id,
  );
  const providerQueueId = seedanceProviderStringField(
    callback.provider_queue_id
      ?? callback.providerQueueId
      ?? callback.queue_id
      ?? callback.queueId
      ?? callback.batch_id
      ?? callback.batchId,
  );
  const providerQueuePosition = callbackNumberField(
    callback.provider_queue_position
      ?? callback.providerQueuePosition
      ?? callback.queue_position
      ?? callback.queuePosition
      ?? callback.position,
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
  const shotId = callbackStringField(
    callback.shot_id
      ?? callback.shotId
      ?? callback.external_id
      ?? callback.externalId
      ?? callback.custom_id
      ?? callback.customId,
  ) ?? matchedItem?.shot_id;
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

  const videoUrl = callbackStringField(
    callback.video_url
      ?? callback.videoUrl
      ?? callback.output_url
      ?? callback.outputUrl
      ?? callback.file_url
      ?? callback.fileUrl
      ?? callback.download_url
      ?? callback.downloadUrl
      ?? callback.result_url
      ?? callback.resultUrl
      ?? callback.url,
  );
  const explicitFailureReason = callbackStringField(
    callback.failure_reason
      ?? callback.failureReason
      ?? callback.error_message
      ?? callback.errorMessage
      ?? callback.reason
      ?? callback.error,
  );
  const providerErrorCode = seedanceProviderStringField(
    callback.provider_error_code
      ?? callback.providerErrorCode
      ?? callback.error_code
      ?? callback.errorCode
      ?? callback.status_code
      ?? callback.statusCode
      ?? callback.code,
  );
  const callbackMessage = callbackStringField(callback.message ?? callback.msg);
  const callbackStatus = callbackStringField(
    callback.status ?? callback.task_status ?? callback.taskStatus ?? callback.state ?? callback.phase,
  );
  const status = normalizeSeedanceShotCallbackStatus(callbackStatus, Boolean(videoUrl), Boolean(explicitFailureReason));
  const failureReason = status === 'failed'
    ? explicitFailureReason ?? callbackMessage
    : undefined;
  const failureCategory = status === 'failed'
    ? classifySeedanceProviderFailure({
        explicitCategory: callback.failure_category ?? callback.failureCategory,
        providerErrorCode,
        failureReason,
        message: callbackMessage,
      })
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
    failure_category: failureCategory,
    provider_error_code: status === 'failed' ? providerErrorCode : undefined,
    note: callbackStringField(callback.note)
      ?? callbackMessage
      ?? `Seedance 回传导入：${seedanceShotStatusText(status)}`,
    increment_retry: Boolean(callback.increment_retry ?? callback.incrementRetry),
    quality_score: callbackNumberField(callback.quality_score ?? callback.qualityScore ?? callback.score ?? callback.quality),
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
    if (item.failure_category === 'asset_missing') return '先补齐或重新绑定缺失素材，再重新提交。';
    if (item.failure_category === 'prompt_invalid') return '先精简或修正 Seedance 提示词，再重新提交。';
    if (item.failure_category === 'content_policy') return '先调整敏感画面、人物或版权相关表达，再重新提交。';
    if (item.failure_category === 'provider_timeout') return '先确认平台任务是否仍在处理；超时无结果时重新提交。';
    if (item.failure_category === 'provider_quota') return '先确认 provider 额度或余额，再重新提交。';
    if (item.failure_category === 'provider_auth') return '先检查 provider 凭证和权限配置，再重新提交。';
    if (item.failure_category === 'provider_rate_limit') return '等待限流窗口恢复后再重新提交。';
    if (item.failure_category === 'provider_server_error' || item.failure_category === 'network_error') {
      return '稍后重试；若连续失败，保留错误码并切换 provider 或人工检查。';
    }
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
    creation_use_case: updatedStory.creation_use_case ?? project.creation_use_case,
    truth_mode: updatedStory.truth_mode ?? project.truth_mode,
    material_sufficiency: updatedStory.material_sufficiency ?? project.material_sufficiency,
    creation_contract: updatedStory.creation_contract ?? project.creation_contract,
    ...qualitySummary(updatedStory),
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
    gears_video_status: updatedStory.gears_video?.status,
    gears_video_url: updatedStory.gears_video?.video_url,
    gears_video_thumbnail_url: updatedStory.gears_video?.thumbnail_url,
    seedance_asset_library: project.seedance_asset_library,
    seedance_shot_ledger: project.seedance_shot_ledger,
    seedance_provider_queue: project.seedance_provider_queue,
    gears_job_ledger: project.gears_job_ledger,
    production_readiness_automation_ledger: project.production_readiness_automation_ledger,
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
    projects.push(await hydrateProjectMetaForCurrentStory(meta));
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
    if (meta) projects.push(await hydrateProjectMetaForCurrentStory(meta));
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

  const currentStory = normalizeStoryGenerationFields(currentVersion.story);
  return success({
    project: hydrateProjectMetaForStory(project, currentStory),
    current_story: currentStory,
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
    failure_category: request.failure_category ?? (request.status === 'failed' ? existing?.failure_category : undefined),
    provider_error_code: request.provider_error_code ?? (request.status === 'failed' ? existing?.provider_error_code : undefined),
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
      failure_category: undefined,
      provider_error_code: undefined,
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
      failure_category: undefined,
      provider_error_code: undefined,
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
  let queueId = request.queue_id?.trim() || seedanceProviderQueueId(provider, updatedAt);
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

  const candidates: SeedanceProviderSubmitCandidate[] = [];
  currentLedger.items.forEach((item, index) => {
    const shot = shotUnitById.get(item.shot_id);
    if (!shot) return;
    if (requestedShotIds && !requestedShotIds.has(item.shot_id)) return;
    if (failures.some(failure => failure.shot_id === item.shot_id)) return;
    if (item.provider_job_id && item.status !== 'failed' && !request.overwrite_existing) {
      skippedCount += 1;
      return;
    }
    if (!submitStatuses.has(item.status) && !request.overwrite_existing) {
      skippedCount += 1;
      return;
    }

    const providerJobId = request.job_prefix?.trim()
      ? `${request.job_prefix.trim()}-${item.shot_id}`
      : seedanceProviderJobId(provider, item.shot_id, index);
    const queuePosition = candidates.length + 1;
    candidates.push({
      item,
      shot,
      providerJobId,
      queuePosition,
    });
  });

  let providerAdapterSummary: SeedanceShotProviderSubmitAdapterSummary | undefined;
  let acceptedSubmissions: SeedanceProviderSubmitAdapterAcceptedItem[] = candidates.map(candidate => ({
    shot_id: candidate.item.shot_id,
    provider_job_id: candidate.providerJobId,
    provider_queue_position: candidate.queuePosition,
    status: 'submitted',
  }));

  if (request.use_provider_adapter && candidates.length) {
    const adapterRes = await querySeedanceProviderSubmitAdapter({
      projectId,
      story: current_story,
      provider,
      queueId,
      queuePriority,
      note: queueNote,
      assetLibrary: project.seedance_asset_library,
      candidates,
    });
    if (!adapterRes.ok || !adapterRes.data) {
      return fail(
        adapterRes.error?.code === ErrorCodes.VALIDATION_ERROR
          ? ErrorCodes.VALIDATION_ERROR
          : ErrorCodes.INTERNAL_ERROR,
        adapterRes.error?.message ?? 'Seedance provider submit adapter failed',
        adapterRes.error?.details,
      );
    }
    acceptedSubmissions = adapterRes.data.accepted;
    failures.push(...adapterRes.data.failures);
    providerAdapterSummary = adapterRes.data.summary;
    const acceptedQueueIds = [
      ...new Set(acceptedSubmissions.map(item => item.provider_queue_id).filter(Boolean) as string[]),
    ];
    if (acceptedQueueIds.length === 1) {
      [queueId] = acceptedQueueIds;
    }
  }

  const acceptedByShotId = new Map(acceptedSubmissions.map(item => [item.shot_id, item]));
  const candidatesByShotId = new Map(candidates.map(candidate => [candidate.item.shot_id, candidate]));
  const items = currentLedger.items.map(item => {
    const candidate = candidatesByShotId.get(item.shot_id);
    if (!candidate) return item;
    const accepted = acceptedByShotId.get(item.shot_id);
    if (!accepted) return item;
    const shot = candidate.shot;
    const providerJobId = accepted.provider_job_id;
    const providerQueueId = accepted.provider_queue_id ?? queueId;
    const queuePosition = accepted.provider_queue_position ?? candidate.queuePosition;
    const status = accepted.status;
    submittedShots.push({
      shot_id: item.shot_id,
      provider_job_id: providerJobId,
      provider_queue_id: providerQueueId,
      provider_queue_position: queuePosition,
      status,
    });
    queueItems.push({
      shot_id: item.shot_id,
      source_scene_id: shot.source_scene_id,
      provider_job_id: providerJobId,
      status,
      queue_position: queuePosition,
      queued_at: updatedAt,
    });
    return {
      ...item,
      source_scene_id: shot.source_scene_id,
      status,
      submitted_at: updatedAt,
      updated_at: updatedAt,
      provider,
      provider_job_id: providerJobId,
      provider_queue_id: providerQueueId,
      provider_queue_position: queuePosition,
      failure_reason: undefined,
      failure_category: undefined,
      provider_error_code: undefined,
      retry_count: item.status === 'failed' || (request.increment_retry && Boolean(item.provider_job_id))
        ? item.retry_count + 1
        : item.retry_count,
      notes: uniqueSeedanceNotes([
        ...item.notes,
        queueNote || `提交到 ${provider}：${providerJobId}`,
      ]),
      versions: appendSeedanceShotVideoVersion({
        existing: item,
        request: {
          shot_id: item.shot_id,
          status,
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
      provider_adapter: providerAdapterSummary,
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
    provider_adapter: providerAdapterSummary,
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
        failure_category: 'provider_timeout' as const,
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
      failure_category: 'provider_timeout' as const,
      provider_error_code: 'PROVIDER_TIMEOUT',
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
          failure_category: 'provider_timeout',
          provider_error_code: 'PROVIDER_TIMEOUT',
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
    const shotId = callbackStringField(
      callback.shot_id
        ?? callback.shotId
        ?? callback.external_id
        ?? callback.externalId
        ?? callback.custom_id
        ?? callback.customId,
    );
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
      request.provider_job_id
        ?? request.providerJobId
        ?? request.job_id
        ?? request.jobId
        ?? request.task_id
        ?? request.taskId
        ?? request.request_id
        ?? request.requestId
        ?? request.id,
    ),
    provider_queue_id: callbackStringField(
      request.provider_queue_id
        ?? request.providerQueueId
        ?? request.queue_id
        ?? request.queueId
        ?? request.batch_id
        ?? request.batchId,
    ),
    provider_queue_position: callbackNumberField(
      request.provider_queue_position
        ?? request.providerQueuePosition
        ?? request.queue_position
        ?? request.queuePosition
        ?? request.position,
    ),
    event_id: callbackStringField(
      request.event_id ?? request.eventId ?? request.callback_id ?? request.callbackId,
    ),
  });
}

export async function pollProjectSeedanceProviderQueue(
  projectId: string,
  request: SeedanceShotProviderPollRequest = {},
): Promise<ApiResponse<SeedanceShotProviderPollResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const statuses = new Set<SeedanceShotProviderRecoverableStatus>(
    request.statuses?.length ? request.statuses : ['submitted', 'processing'],
  );
  const provider = request.provider?.trim();
  const queueId = request.queue_id?.trim();
  const shotIds = request.shot_ids?.length ? new Set(request.shot_ids) : undefined;
  const limit = request.limit ?? 100;
  const nowMs = Date.now();
  const buildTargets = (projectDetail: StoryProjectDetail) => {
    const board = buildStoryProductionBoard(projectDetail.current_story, {
      seedanceAssetLibrary: projectDetail.project.seedance_asset_library,
      seedanceShotLedger: projectDetail.project.seedance_shot_ledger,
    });
    return seedanceProviderPollTargets({
      board,
      statuses,
      provider,
      queueId,
      shotIds,
      limit,
      includePrompt: Boolean(request.include_prompt),
      nowMs,
    });
  };
  const beforeTargets = buildTargets(detail.data);

  if (request.use_provider_adapter && request.provider_results?.length) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'use_provider_adapter cannot be combined with provider_results',
    );
  }

  let providerResults = request.provider_results?.map(result => ({
    ...result,
    provider: result.provider ?? provider,
    note: result.note ?? request.note,
  }));
  let providerAdapterSummary: SeedanceShotProviderPollAdapterSummary | undefined;

  if (request.use_provider_adapter) {
    if (!beforeTargets.targets.length) {
      return success({
        project: detail.data.project,
        seedance_shot_ledger: detail.data.project.seedance_shot_ledger,
        dry_run: false,
        provider,
        queue_id: queueId,
        checked_count: beforeTargets.checkedCount,
        pollable_count: 0,
        updated_count: 0,
        failed_count: 0,
        poll_targets: [],
        provider_adapter: {
          endpoint_configured: Boolean(configuredSeedanceProviderPollEndpoint()),
          request_mode: seedanceProviderPollRequestMode(),
          http_method: seedanceProviderPollHttpMethod(),
          queried_count: 0,
          returned_count: 0,
        },
        failures: [],
      });
    }
    const adapterRes = await querySeedanceProviderPollAdapter({
      projectId,
      provider,
      queueId,
      note: request.note,
      targets: beforeTargets.targets,
    });
    if (!adapterRes.ok || !adapterRes.data) {
      return fail(
        adapterRes.error?.code === ErrorCodes.VALIDATION_ERROR
          ? ErrorCodes.VALIDATION_ERROR
          : ErrorCodes.INTERNAL_ERROR,
        adapterRes.error?.message ?? 'Seedance provider adapter failed',
        adapterRes.error?.details,
      );
    }
    providerResults = adapterRes.data.providerResults.map(result => ({
      ...result,
      provider: result.provider ?? provider,
      note: result.note ?? request.note,
    }));
    providerAdapterSummary = adapterRes.data.summary;
  }

  if (!providerResults?.length) {
    return success({
      project: detail.data.project,
      seedance_shot_ledger: detail.data.project.seedance_shot_ledger,
      dry_run: !request.use_provider_adapter,
      provider,
      queue_id: queueId,
      checked_count: beforeTargets.checkedCount,
      pollable_count: beforeTargets.targets.length,
      updated_count: 0,
      failed_count: 0,
      poll_targets: beforeTargets.targets,
      provider_adapter: providerAdapterSummary,
      failures: [],
    });
  }

  const importRes = await importProjectSeedanceShotCallbacks(projectId, { callbacks: providerResults });
  if (!importRes.ok || !importRes.data) {
    return importRes as ApiResponse<SeedanceShotProviderPollResult>;
  }

  const refreshedDetail = await getProject(projectId);
  const afterTargets = refreshedDetail.ok && refreshedDetail.data
    ? buildTargets(refreshedDetail.data)
    : { checkedCount: 0, targets: [] };

  return success({
    project: importRes.data.project,
    seedance_shot_ledger: importRes.data.seedance_shot_ledger,
    dry_run: false,
    provider,
    queue_id: queueId,
    checked_count: beforeTargets.checkedCount,
    pollable_count: afterTargets.targets.length,
    updated_count: importRes.data.updated_count,
    failed_count: importRes.data.failed_count,
    poll_targets: afterTargets.targets,
    provider_adapter: providerAdapterSummary,
    failures: importRes.data.failures,
  });
}

export async function getProjectSeedanceProviderQueueOverview(
  projectId: string,
  request: SeedanceShotProviderQueueOverviewRequest = {},
): Promise<ApiResponse<SeedanceShotProviderQueueOverviewResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const provider = request.provider?.trim();
  const queueId = request.queue_id?.trim();
  const timeoutMinutes = request.timeout_minutes ?? 120;
  const generatedAt = new Date().toISOString();
  const nowMs = Date.parse(generatedAt);
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const currentLedger = syncSeedanceShotLedgerWithShots({
    ledger: project.seedance_shot_ledger,
    shotUnits: board.shot_units,
    generatedAt: board.generated_at,
  });
  const ledgerItems = currentLedger.items.filter(item =>
    seedanceProviderMatchesOverviewFilter({ item, provider, queueId })
  );
  const ledgerByShotId = new Map(currentLedger.items.map(item => [item.shot_id, item]));
  const statusCounts = seedanceProviderEmptyStatusCounts();
  ledgerItems.forEach(item => {
    statusCounts[item.status] += 1;
  });

  const queueBatches = (project.seedance_provider_queue?.batches ?? [])
    .filter(batch => (!provider || batch.provider === provider) && (!queueId || batch.queue_id === queueId))
    .map(batch => seedanceProviderBatchOverview({
      batch,
      ledgerByShotId,
      timeoutMinutes,
      nowMs,
    }))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const latestQueueId = project.seedance_provider_queue?.latest_queue_id;
  const latestQueueBatch = queueBatches.find(batch => batch.queue_id === latestQueueId)
    ?? [...queueBatches].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];

  const allAttentionItems = ledgerItems
    .map(item => seedanceProviderAttentionItem({ item, timeoutMinutes, nowMs }))
    .filter(item => (
      request.include_completed
        ? seedanceProviderNeedsAttention(item) || Boolean(item.provider_job_id || item.provider_queue_id)
        : seedanceProviderNeedsAttention(item)
    ))
    .sort(seedanceProviderAttentionSort);
  const timedOutCount = ledgerItems.filter(item =>
    seedanceProviderIsActiveStatus(item.status)
    && seedanceShotWaitingMinutes(item, nowMs) >= timeoutMinutes
  ).length;
  const missingVideoCount = ledgerItems.filter(item => item.status === 'ready' && !item.video_url).length;

  return success({
    project,
    seedance_shot_ledger: currentLedger,
    seedance_provider_queue: project.seedance_provider_queue,
    provider,
    queue_id: queueId,
    generated_at: generatedAt,
    timeout_minutes: timeoutMinutes,
    total_shot_count: ledgerItems.length,
    status_counts: statusCounts,
    active_count: statusCounts.submitted + statusCounts.processing,
    ready_count: statusCounts.ready,
    failed_count: statusCounts.failed,
    retryable_count: ledgerItems.filter(item => shouldRetrySeedanceShot(item)).length,
    timed_out_count: timedOutCount,
    missing_video_count: missingVideoCount,
    attention_count: allAttentionItems.length,
    batch_count: queueBatches.length,
    latest_queue_batch: latestQueueBatch,
    queue_batches: queueBatches,
    attention_items: allAttentionItems,
  });
}

export async function getProjectSeedanceProviderRetryPlan(
  projectId: string,
  request: SeedanceShotProviderRetryPlanRequest = {},
): Promise<ApiResponse<SeedanceShotProviderRetryPlanResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const provider = request.provider?.trim();
  const queueId = request.queue_id?.trim();
  const timeoutMinutes = request.timeout_minutes ?? 120;
  const generatedAt = new Date().toISOString();
  const nowMs = Date.parse(generatedAt);
  const failureCategories = request.failure_categories?.length
    ? new Set(request.failure_categories)
    : undefined;
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const currentLedger = syncSeedanceShotLedgerWithShots({
    ledger: project.seedance_shot_ledger,
    shotUnits: board.shot_units,
    generatedAt: board.generated_at,
  });
  const candidates = currentLedger.items
    .filter(item => seedanceProviderMatchesOverviewFilter({ item, provider, queueId }))
    .filter(item => !failureCategories || (item.failure_category && failureCategories.has(item.failure_category)))
    .reduce<SeedanceShotProviderRetryPlanCandidate[]>((items, item) => {
      const reason = seedanceProviderRetryReason({
        item,
        timeoutMinutes,
        nowMs,
        includeUnsubmitted: Boolean(request.include_unsubmitted),
      });
      if (!reason) return items;
      items.push(seedanceProviderRetryCandidate({
        item,
        reason,
        timeoutMinutes,
        nowMs,
        maxRetryCount: request.max_retry_count,
      }));
      return items;
    }, [])
    .sort(seedanceProviderRetryCandidateSort);
  const reasonCounts = seedanceProviderEmptyRetryReasonCounts();
  candidates.forEach(candidate => {
    reasonCounts[candidate.retry_reason] += 1;
  });
  const basePlan: Omit<SeedanceShotProviderRetryPlanResult, 'markdown'> = {
    project,
    seedance_shot_ledger: currentLedger,
    provider,
    queue_id: queueId,
    generated_at: generatedAt,
    timeout_minutes: timeoutMinutes,
    max_retry_count: request.max_retry_count,
    candidate_count: candidates.length,
    resubmittable_count: candidates.filter(candidate => candidate.can_resubmit).length,
    blocked_count: candidates.filter(candidate => !candidate.can_resubmit).length,
    high_priority_count: candidates.filter(candidate => candidate.priority === 'high').length,
    reason_counts: reasonCounts,
    candidates,
  };
  return success({
    ...basePlan,
    markdown: buildSeedanceProviderRetryPlanMarkdown(basePlan),
  });
}

export async function submitProjectSeedanceProviderRetryPlan(
  projectId: string,
  request: SeedanceShotProviderRetrySubmitRequest = {},
): Promise<ApiResponse<SeedanceShotProviderRetrySubmitResult>> {
  const retryPlanRes = await getProjectSeedanceProviderRetryPlan(projectId, request);
  if (!retryPlanRes.ok || !retryPlanRes.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      retryPlanRes.error?.message ?? `Project "${projectId}" not found`,
      retryPlanRes.error?.details,
    );
  }

  const retryPlan = retryPlanRes.data;
  const selectedShotIds = retryPlan.candidates
    .filter(candidate => candidate.can_resubmit)
    .slice(0, request.limit)
    .map(candidate => candidate.shot_id);
  if (!selectedShotIds.length) {
    return success({
      project: retryPlan.project,
      seedance_shot_ledger: retryPlan.seedance_shot_ledger,
      retry_plan: retryPlan,
      selected_shot_ids: [],
      skipped_blocked_count: retryPlan.blocked_count,
      submitted_count: 0,
      skipped_count: 0,
      failed_count: 0,
      submitted_shots: [],
      failures: [],
    });
  }

  const submitRes = await submitProjectSeedanceShotsToProvider(projectId, {
    shot_ids: selectedShotIds,
    provider: request.provider,
    job_prefix: request.job_prefix,
    queue_id: request.target_queue_id,
    queue_priority: request.queue_priority,
    use_provider_adapter: request.use_provider_adapter,
    overwrite_existing: true,
    increment_retry: true,
    note: request.note ?? 'Seedance provider 人工重试策略执行',
  });
  if (!submitRes.ok || !submitRes.data) {
    return submitRes as ApiResponse<SeedanceShotProviderRetrySubmitResult>;
  }

  return success({
    project: submitRes.data.project,
    seedance_shot_ledger: submitRes.data.seedance_shot_ledger,
    seedance_provider_queue: submitRes.data.seedance_provider_queue,
    retry_plan: retryPlan,
    selected_shot_ids: selectedShotIds,
    skipped_blocked_count: retryPlan.blocked_count,
    provider_queue_batch: submitRes.data.provider_queue_batch,
    provider_adapter: submitRes.data.provider_adapter,
    submitted_count: submitRes.data.submitted_count,
    skipped_count: submitRes.data.skipped_count,
    failed_count: submitRes.data.failed_count,
    submitted_shots: submitRes.data.submitted_shots,
    failures: submitRes.data.failures,
  });
}

function gearsSeedanceStatus(status: GearsJobLedgerItem['status']): SeedanceShotProductionStatus {
  if (status === 'ready') return 'ready';
  if (status === 'failed' || status === 'rejected' || status === 'canceled') return 'failed';
  if (status === 'processing') return 'processing';
  return 'submitted';
}

function gearsFailureToSeedanceCategory(
  category: GearsJobLedgerItem['failure_category'],
): SeedanceProviderFailureCategory | undefined {
  if (!category) return undefined;
  if (category === 'payload_invalid') return 'prompt_invalid';
  if (category === 'artifact_invalid' || category === 'asset_missing') return 'asset_missing';
  if (
    category === 'artifact_upload_failed'
    || category === 'callback_delivery_failed'
    || category === 'output_missing'
    || category === 'render_failed'
    || category === 'worker_unavailable'
  ) {
    return 'provider_server_error';
  }
  return category;
}

function projectGearsExistingJob(
  ledger: GearsJobLedger | undefined,
  jobType: GearsExecutionJobType,
  sourceUnitId: string,
): GearsJobLedgerItem | undefined {
  return normalizeGearsJobLedger(ledger).items.find(item =>
    item.job_type === jobType && item.source_unit_id === sourceUnitId
  );
}

function projectGearsJobIsActive(item: GearsJobLedgerItem | undefined): boolean {
  if (!item) return false;
  return !['failed', 'rejected', 'canceled'].includes(item.status);
}

function compactPayloadSummary(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function cleanDeliveryPayloadSummary(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split(/[\n。；;]/)
    .map(cleanDeliveryPayloadSummaryPart)
    .filter(Boolean)
    .join('；')
    .replace(/；{2,}/g, '；')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanDeliveryPayloadSummaryPart(value: string): string {
  return value
    .trim()
    .replace(/^(视觉提示|画面提示|镜头建议|分析|注意)[:：]\s*/g, '')
    .replace(/(?:^|[，,；;。]\s*)生成优先级[:：]\s*(?:高|中|低|normal|high|medium|low)\s*/gi, ' ')
    .replace(/生成优先级[:：].*$/g, '')
    .replace(/(?:^|[，,；;。]\s*)(?:来源显示|来源条目|来源说明|史实依据|影视化创作|创作边界|质量信号|建议调整|类型匹配|资料显示|摘要)[:：][^，,。；\n]*(?:[，,。；])?/g, ' ')
    .replace(/本场景基于[^，,。；\n]*(?:，具体细节请核实来源)?/g, '')
    .replace(/基于(?:知识库|用户大纲|资料|来源)[^，,。；\n]*/g, '')
    .replace(/按(?:知识库|资料|来源)[^，,。；\n]*/g, '')
    .replace(/(?:质量信号|主角目标|目标明确|行动具体|因果链|史实边界|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|知识库|用户大纲|生成优先级|资料显示|摘要|核心画面是|为什么必须面对|具体细节请核实来源|不可写成|确证史实|确证史源|创作边界|治理痕迹|分析|应该|注意|TODO|待补)[:：]?/g, '')
    .replace(/[，,]\s*([。；])/g, '$1')
    .replace(/^[，,；;：:\s]+|[，,；;：:\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function compactDeliveryPayloadSummary(value: string): string {
  const cleaned = cleanDeliveryPayloadSummary(value);
  return compactPayloadSummary(
    cleaned && !DELIVERY_PAYLOAD_SUMMARY_INTERNAL_PATTERN.test(cleaned)
      ? cleaned
      : value.replace(new RegExp(DELIVERY_PAYLOAD_SUMMARY_INTERNAL_PATTERN.source, 'g'), ''),
  );
}

function sanitizeGearsJobLedgerPayloadSummaries(
  ledger: GearsJobLedger | undefined,
  updatedAt: string,
): { ledger?: GearsJobLedger; changed: boolean } {
  if (!ledger) return { ledger, changed: false };
  let changed = false;
  const items = normalizeGearsJobLedger(ledger).items.map(item => {
    if (!item.payload_summary) return item;
    const payloadSummary = compactDeliveryPayloadSummary(item.payload_summary);
    if (payloadSummary === item.payload_summary) return item;
    changed = true;
    return {
      ...item,
      payload_summary: payloadSummary,
      updated_at: updatedAt,
    };
  });
  return {
    ledger: changed
      ? {
          ...ledger,
          schema_version: 'gears-job-ledger/v1',
          updated_at: updatedAt,
          items,
        }
      : ledger,
    changed,
  };
}

function buildProjectGearsUnits(input: {
  projectId: string;
  story: StoryGenerateResult;
  board: StoryProductionBoard;
  jobType: GearsExecutionJobType;
  request: GearsJobSubmitRequest;
}): {
  units: GearsExecutionSubmitUnit[];
  skippedCount: number;
  failures: GearsJobSubmitFailure[];
} {
  const requestedIds = new Set([
    ...(input.request.source_unit_ids ?? []),
    ...(input.request.source_unit_id ? [input.request.source_unit_id] : []),
  ].filter(Boolean));
  const shouldInclude = (sourceUnitId: string) => !requestedIds.size || requestedIds.has(sourceUnitId);
  const failures: GearsJobSubmitFailure[] = [];
  const units: GearsExecutionSubmitUnit[] = [];
  let skippedCount = 0;
  const addUnit = (unit: Omit<GearsExecutionSubmitUnit, 'local_gears_job_id'>) => {
    if (!shouldInclude(unit.source_unit_id)) return;
    const local_gears_job_id = buildLocalGearsJobId(input.jobType, unit.source_unit_id, units.length);
    units.push({ ...unit, local_gears_job_id });
  };

  if (input.jobType === 'seedance_video') {
    input.board.shot_units.forEach(shot => addUnit({
      source_unit_id: shot.shot_id,
      source_unit_label: `Scene ${shot.source_scene_id} Seedance shot`,
      source_scene_id: shot.source_scene_id,
      payload_summary: compactDeliveryPayloadSummary(`${shot.location} ${shot.script_text}`),
      payload: {
        shot_id: shot.shot_id,
        source_scene_id: shot.source_scene_id,
        duration_sec: shot.seedance_duration_sec,
        characters: shot.characters,
        location: shot.location,
        script_text: shot.script_text,
        visual_prompt: shot.visual_prompt,
        camera_suggestion: shot.camera_suggestion,
        continuity_notes: shot.continuity_notes,
        cultural_boundary: shot.cultural_boundary,
        seedance_prompt: shot.seedance_prompt,
        asset_slots: shot.seedance_asset_slots,
        material_validation: shot.seedance_material_validation,
        negative_constraints: shot.negative_constraints,
      },
    }));
  } else if (input.jobType === 'storyboard_image') {
    const delivery = ensureGearsDeliveryPackage(input.story);
    delivery.units.forEach(unit => addUnit({
      source_unit_id: unit.unit_id,
      source_unit_label: unit.scene_name,
      source_scene_id: unit.source_scene_id,
      payload_summary: compactDeliveryPayloadSummary(`${unit.scene_name} ${unit.script_text}`),
      payload: {
        unit,
        character_assets: delivery.character_assets.filter(character => unit.character_names.includes(character.name)),
        scene_assets: delivery.scene_assets,
      },
    }));
  } else if (input.jobType === 'character_image') {
    const delivery = ensureGearsDeliveryPackage(input.story);
    delivery.character_assets.forEach(character => addUnit({
      source_unit_id: `character:${character.name}`,
      source_unit_label: character.name,
      payload_summary: compactDeliveryPayloadSummary(`${character.name} ${character.appearance_features} ${character.clothing}`),
      payload: { character },
    }));
  } else if (input.jobType === 'scene_image') {
    const delivery = ensureGearsDeliveryPackage(input.story);
    delivery.scene_assets.forEach(scene => addUnit({
      source_unit_id: `scene:${scene.name}`,
      source_unit_label: scene.name,
      payload_summary: compactDeliveryPayloadSummary(`${scene.name} ${scene.description}`),
      payload: { scene },
    }));
  } else {
    const sourceUnitIds = requestedIds.size ? [...requestedIds] : [`${input.projectId}:${input.jobType}`];
    sourceUnitIds.forEach(sourceUnitId => addUnit({
      source_unit_id: sourceUnitId,
      source_unit_label: input.jobType,
      payload_summary: compactDeliveryPayloadSummary(input.request.note ?? input.jobType),
      payload: input.request.payload ?? {},
    }));
  }

  if (requestedIds.size) {
    const availableIds = new Set(units.map(unit => unit.source_unit_id));
    [...requestedIds].forEach((sourceUnitId, index) => {
      if (availableIds.has(sourceUnitId)) return;
      failures.push({
        index,
        source_unit_id: sourceUnitId,
        message: `GEARS source unit "${sourceUnitId}" not found for job_type "${input.jobType}"`,
      });
    });
  }

  return { units, skippedCount, failures };
}

function filterProjectGearsSubmitUnits(input: {
  ledger?: GearsJobLedger;
  jobType: GearsExecutionJobType;
  units: GearsExecutionSubmitUnit[];
  overwriteExisting: boolean;
}): { units: GearsExecutionSubmitUnit[]; skippedCount: number } {
  let skippedCount = 0;
  const units = input.units.filter(unit => {
    const existing = projectGearsExistingJob(input.ledger, input.jobType, unit.source_unit_id);
    if (!projectGearsJobIsActive(existing) || input.overwriteExisting) return true;
    skippedCount += 1;
    return false;
  });
  return { units, skippedCount };
}

function applyGearsJobsToSeedanceLedger(input: {
  project: StoryProjectMeta;
  board: StoryProductionBoard;
  jobItems: GearsJobLedgerItem[];
  updatedAt: string;
  note?: string;
}): StoryProjectMeta['seedance_shot_ledger'] {
  const currentLedger = syncSeedanceShotLedgerWithShots({
    ledger: input.project.seedance_shot_ledger,
    shotUnits: input.board.shot_units,
    generatedAt: input.board.generated_at,
  });
  const jobsByShotId = new Map(input.jobItems
    .filter(item => item.job_type === 'seedance_video')
    .map(item => [item.source_unit_id, item]));
  if (!jobsByShotId.size) return input.project.seedance_shot_ledger;
  const shotById = new Map(input.board.shot_units.map(shot => [shot.shot_id, shot]));
  const items = currentLedger.items.map(item => {
    const gearsJob = jobsByShotId.get(item.shot_id);
    const shot = shotById.get(item.shot_id);
    if (!gearsJob || !shot) return item;
    const status = gearsSeedanceStatus(gearsJob.status);
    const videoUrl = gearsJob.artifact_urls[0] ?? item.video_url;
    const request: SeedanceShotStatusUpdateRequest = {
      shot_id: item.shot_id,
      status,
      provider: 'gears',
      provider_job_id: gearsJob.gears_job_id,
      video_url: status === 'ready' ? videoUrl : undefined,
      failure_reason: gearsJob.failure_reason,
      failure_category: gearsFailureToSeedanceCategory(gearsJob.failure_category),
      provider_error_code: gearsJob.error_code,
      note: input.note ?? `GEARS job ${gearsJob.status}: ${gearsJob.gears_job_id}`,
    };
    const versions = appendSeedanceShotVideoVersion({
      existing: item,
      request,
      updatedAt: input.updatedAt,
    });
    return {
      ...item,
      source_scene_id: shot.source_scene_id,
      status,
      submitted_at: status === 'submitted' || status === 'processing'
        ? item.submitted_at ?? input.updatedAt
        : item.submitted_at,
      completed_at: status === 'ready' || status === 'failed' ? input.updatedAt : item.completed_at,
      updated_at: input.updatedAt,
      provider: 'gears',
      provider_job_id: gearsJob.gears_job_id,
      video_url: status === 'ready' ? videoUrl : item.video_url,
      failure_reason: status === 'failed' ? gearsJob.failure_reason : undefined,
      failure_category: status === 'failed' ? gearsFailureToSeedanceCategory(gearsJob.failure_category) : undefined,
      provider_error_code: status === 'failed' ? gearsJob.error_code : undefined,
      notes: uniqueSeedanceNotes([
        ...item.notes,
        input.note ?? `GEARS job ${gearsJob.status}: ${gearsJob.gears_job_id}`,
      ]),
      versions,
      selected_version_id: selectedSeedanceShotVersionId(versions, item.selected_version_id),
    };
  });
  return {
    schema_version: 'seedance-shot-ledger/v1',
    updated_at: input.updatedAt,
    items,
  };
}

export async function submitProjectGearsJobs(
  projectId: string,
  request: GearsJobSubmitRequest = {},
): Promise<ApiResponse<GearsJobSubmitResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const jobType = request.job_type ?? 'seedance_video';
  const submittedAt = new Date().toISOString();
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const built = buildProjectGearsUnits({
    projectId,
    story: current_story,
    board,
    jobType,
    request,
  });
  const filtered = filterProjectGearsSubmitUnits({
    ledger: project.gears_job_ledger,
    jobType,
    units: built.units,
    overwriteExisting: Boolean(request.overwrite_existing),
  });
  const failures = [...built.failures];
  if (!filtered.units.length) {
    return success({
      project,
      gears_job_ledger: normalizeGearsJobLedger(project.gears_job_ledger),
      seedance_shot_ledger: project.seedance_shot_ledger,
      provider_adapter: {
        endpoint_configured: false,
        requested_count: 0,
        accepted_count: 0,
        rejected_count: 0,
        status: request.use_gears_api ? 'submitted' : 'mocked',
      },
      submitted_count: 0,
      skipped_count: built.skippedCount + filtered.skippedCount,
      failed_count: failures.length,
      submitted_jobs: [],
      failures,
    });
  }

  const adapterRes = await submitGearsExecutionJobs({
    sourceProjectId: project.project_id,
    sourceStoryId: current_story.storyId,
    title: current_story.title,
    jobType,
    callbackPath: gearsProjectCallbackPath(project.project_id),
    callbackUrl: request.callback_url ?? gearsProjectCallbackUrl(project.project_id),
    note: request.note,
    useGearsApi: Boolean(request.use_gears_api),
    payload: request.payload,
    units: filtered.units,
  });
  if (!adapterRes.ok || !adapterRes.data) {
    return fail(
      adapterRes.error?.code === ErrorCodes.VALIDATION_ERROR
        ? ErrorCodes.VALIDATION_ERROR
        : ErrorCodes.INTERNAL_ERROR,
      adapterRes.error?.message ?? 'GEARS submit failed',
      adapterRes.error?.details,
    );
  }

  failures.push(...adapterRes.data.failures);
  const unitById = new Map(filtered.units.map(unit => [unit.source_unit_id, unit]));
  const submittedJobs = adapterRes.data.accepted
    .map(accepted => {
      const unit = unitById.get(accepted.source_unit_id);
      if (!unit) return undefined;
      return buildGearsLedgerItem({
        sourceProjectId: project.project_id,
        sourceStoryId: current_story.storyId,
        jobType,
        unit,
        accepted,
        submittedAt,
        note: request.note,
      });
    })
    .filter((item): item is GearsJobLedgerItem => Boolean(item));
  const rejectedJobs = adapterRes.data.failures
    .map(failure => {
      if (!failure.source_unit_id) return undefined;
      const unit = unitById.get(failure.source_unit_id);
      if (!unit) return undefined;
      return buildRejectedGearsLedgerItem({
        sourceProjectId: project.project_id,
        sourceStoryId: current_story.storyId,
        jobType,
        unit,
        failure,
        submittedAt,
        note: request.note,
      });
    })
    .filter((item): item is GearsJobLedgerItem => Boolean(item));
  const ledgerJobs = [...submittedJobs, ...rejectedJobs];
  const gearsJobLedger = mergeGearsLedgerItems({
    existing: project.gears_job_ledger,
    items: ledgerJobs,
    updatedAt: submittedAt,
  });
  const seedanceShotLedger = jobType === 'seedance_video'
    ? applyGearsJobsToSeedanceLedger({
        project,
        board,
        jobItems: ledgerJobs,
        updatedAt: submittedAt,
        note: request.note,
      })
    : project.seedance_shot_ledger;
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: ledgerJobs.length ? submittedAt : project.updated_at,
    gears_job_ledger: gearsJobLedger,
    seedance_shot_ledger: seedanceShotLedger,
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  return success({
    project: updatedProject,
    gears_job_ledger: updatedProject.gears_job_ledger,
    seedance_shot_ledger: updatedProject.seedance_shot_ledger,
    provider_adapter: adapterRes.data.summary,
    submitted_count: submittedJobs.length,
    skipped_count: built.skippedCount + filtered.skippedCount,
    failed_count: failures.length,
    submitted_jobs: submittedJobs,
    failures,
  });
}

function findGearsLedgerMatch(input: {
  ledger: GearsJobLedger;
  callback: ReturnType<typeof normalizeGearsJobCallback>;
}): GearsJobLedgerItem | string {
  const byJobId = input.callback.gears_job_id
    ? input.ledger.items.find(item => item.gears_job_id === input.callback.gears_job_id)
    : undefined;
  if (byJobId) return byJobId;
  const idempotencyKey = input.callback.idempotency_key;
  if (idempotencyKey) {
    const matches = input.ledger.items.filter(item =>
      item.idempotency_key === idempotencyKey
      && (!input.callback.job_type || item.job_type === input.callback.job_type)
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      return `GEARS callback idempotency_key "${idempotencyKey}" matched multiple jobs; include job_type or gears_job_id`;
    }
  }
  const sourceUnitId = input.callback.source_unit_id;
  if (!sourceUnitId) {
    return input.callback.gears_job_id
      ? `GEARS job "${input.callback.gears_job_id}" was not found in project ledger`
      : idempotencyKey
        ? `GEARS idempotency_key "${idempotencyKey}" was not found in project ledger`
        : 'GEARS callback requires a known gears_job_id, source_unit_id, or idempotency_key';
  }
  const matches = input.ledger.items.filter(item =>
    item.source_unit_id === sourceUnitId
    && (!input.callback.job_type || item.job_type === input.callback.job_type)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return `GEARS callback source_unit_id "${sourceUnitId}" matched multiple jobs; include job_type or gears_job_id`;
  }
  return `GEARS source_unit_id "${sourceUnitId}" was not found in project ledger`;
}

function projectGearsSyncItems(input: {
  ledger: GearsJobLedger;
  request: GearsJobStatusSyncRequest;
}): {
  items: GearsJobLedgerItem[];
  skippedCount: number;
} {
  const requestedIds = new Set([
    ...(input.request.source_unit_ids ?? []),
    ...(input.request.source_unit_id ? [input.request.source_unit_id] : []),
  ].filter(Boolean));
  const limit = input.request.limit ?? 50;
  const matched = input.ledger.items.filter(item => {
    if (input.request.job_type && item.job_type !== input.request.job_type) return false;
    if (requestedIds.size && !requestedIds.has(item.source_unit_id) && !requestedIds.has(item.gears_job_id)) {
      return false;
    }
    if (!input.request.include_completed && gearsJobStatusIsTerminal(item.status)) return false;
    return true;
  });
  return {
    items: matched.slice(0, limit),
    skippedCount: Math.max(0, matched.length - limit),
  };
}

function updateGearsLedgerItemFromCallback(input: {
  item: GearsJobLedgerItem;
  callback: ReturnType<typeof normalizeGearsJobCallback>;
  receivedAt: string;
}): GearsJobLedgerItem {
  const status = resolveGearsLedgerStatusAfterCallback({
    currentStatus: input.item.status,
    callbackStatus: input.callback.status,
  });
  const ignoredNonTerminalAfterTerminal = status !== input.callback.status;
  const terminalStatusChanged = gearsJobStatusIsTerminal(input.item.status)
    && gearsJobStatusIsTerminal(input.callback.status)
    && input.item.status !== input.callback.status
    && status === input.callback.status;
  const artifacts = ignoredNonTerminalAfterTerminal
    ? input.item.artifacts
    : input.callback.artifacts ?? input.item.artifacts;
  const artifactUrls = !ignoredNonTerminalAfterTerminal && input.callback.artifact_urls.length
    ? input.callback.artifact_urls
    : input.item.artifact_urls;
  const completed = gearsJobStatusIsTerminal(status);
  const progressPercent = ignoredNonTerminalAfterTerminal
    ? input.item.progress_percent
    : input.callback.progress_percent ?? (status === 'ready' ? 100 : input.item.progress_percent);
  const completedAt = completed
    ? (input.item.status === status && input.item.completed_at
      ? input.item.completed_at
      : input.callback.completed_at ?? input.callback.provider_event_at ?? input.receivedAt)
    : input.item.completed_at;
  return {
    ...input.item,
    gears_job_id: input.callback.gears_job_id ?? input.item.gears_job_id,
    job_type: input.callback.job_type ?? input.item.job_type,
    source_project_id: input.callback.source_project_id ?? input.item.source_project_id,
    source_story_id: input.callback.source_story_id ?? input.item.source_story_id,
    series_project_id: input.callback.series_project_id ?? input.item.series_project_id,
    status,
    progress_percent: progressPercent,
    artifact_urls: artifactUrls,
    artifacts,
    failure_category: ignoredNonTerminalAfterTerminal ? input.item.failure_category : input.callback.failure_category,
    error_code: ignoredNonTerminalAfterTerminal ? input.item.error_code : input.callback.error_code,
    failure_reason: ignoredNonTerminalAfterTerminal ? input.item.failure_reason : input.callback.failure_reason,
    last_poll_at: undefined,
    last_poll_error: undefined,
    last_poll_failure_category: undefined,
    last_poll_error_code: undefined,
    updated_at: input.receivedAt,
    completed_at: completedAt,
    callback_events: mergeGearsCallbackEvents({
      existing: input.item.callback_events,
      callback: input.callback,
      receivedAt: input.receivedAt,
      previousStatus: input.item.status,
      appliedStatus: status,
      statusRegressionIgnored: ignoredNonTerminalAfterTerminal,
      terminalStatusChanged,
    }),
  };
}

export async function importProjectGearsCallback(
  projectId: string,
  request: GearsJobCallbackRequest,
): Promise<ApiResponse<GearsJobCallbackResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }
  const { project, current_story } = detail.data;
  const ledger = normalizeGearsJobLedger(project.gears_job_ledger);
  const callback = normalizeGearsJobCallback(request);
  const match = findGearsLedgerMatch({ ledger, callback });
  if (typeof match === 'string') {
    return success({
      project,
      gears_job_ledger: ledger,
      seedance_shot_ledger: project.seedance_shot_ledger,
      received_count: 1,
      updated_count: 0,
      failed_count: 1,
      duplicate_count: 0,
      failures: [{
        index: 0,
        path: gearsCallbackBatchPath(request),
        source_unit_id: callback.source_unit_id,
        gears_job_id: callback.gears_job_id,
        message: match,
      }],
      gears_job_id: callback.gears_job_id,
      source_unit_id: callback.source_unit_id,
      status: callback.status,
    });
  }

  const receivedAt = new Date().toISOString();
  const duplicateCount = gearsCallbackEventIsDuplicate({
    existing: match.callback_events,
    callback,
  }) ? 1 : 0;
  const updatedItem = updateGearsLedgerItemFromCallback({
    item: match,
    callback,
    receivedAt,
  });
  const gearsJobLedger: GearsJobLedger = {
    schema_version: 'gears-job-ledger/v1',
    updated_at: receivedAt,
    items: ledger.items.map(item =>
      item.ledger_id === match.ledger_id ? updatedItem : item
    ),
  };
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const seedanceShotLedger = updatedItem.job_type === 'seedance_video'
    ? applyGearsJobsToSeedanceLedger({
        project,
        board,
        jobItems: [updatedItem],
        updatedAt: receivedAt,
        note: callback.note ?? callback.message ?? `GEARS callback: ${updatedItem.status}`,
      })
    : project.seedance_shot_ledger;
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: receivedAt,
    gears_job_ledger: gearsJobLedger,
    seedance_shot_ledger: seedanceShotLedger,
  };
  await writeJsonFile(projectMetaPath(project.project_id), updatedProject);
  return success({
    project: updatedProject,
    gears_job_ledger: gearsJobLedger,
    seedance_shot_ledger: seedanceShotLedger,
    received_count: 1,
    updated_count: 1,
    failed_count: 0,
    duplicate_count: duplicateCount,
    failures: [],
    gears_job_id: updatedItem.gears_job_id,
    source_unit_id: updatedItem.source_unit_id,
    status: updatedItem.status,
  });
}

export async function importProjectGearsCallbacks(
  projectId: string,
  request: GearsJobCallbackRequest,
): Promise<ApiResponse<GearsJobCallbackResult>> {
  const callbacks = extractGearsJobCallbackRequests(request);
  if (callbacks.length > GEARS_CALLBACK_BATCH_ITEM_LIMIT) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `GEARS callback batch item count must be <= ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}`,
    );
  }
  if (callbacks.length <= 1) return importProjectGearsCallback(projectId, callbacks[0] ?? request);

  let latest: GearsJobCallbackResult | undefined;
  const failures: GearsJobSubmitFailure[] = [];
  let receivedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  for (const [index, callback] of callbacks.entries()) {
    const result = await importProjectGearsCallback(projectId, callback);
    if (!result.ok || !result.data) return result;
    latest = result.data;
    receivedCount += result.data.received_count;
    updatedCount += result.data.updated_count;
    failedCount += result.data.failed_count;
    duplicateCount += result.data.duplicate_count;
    failures.push(...result.data.failures.map(failure => ({
      ...failure,
      index,
      path: failure.path ?? gearsCallbackBatchPath(callback),
    })));
  }
  if (!latest) return importProjectGearsCallback(projectId, request);
  return success({
    ...latest,
    received_count: receivedCount,
    updated_count: updatedCount,
    failed_count: failedCount,
    duplicate_count: duplicateCount,
    failures,
  });
}

export async function syncProjectGearsJobStatuses(
  projectId: string,
  request: GearsJobStatusSyncRequest = {},
): Promise<ApiResponse<GearsJobStatusSyncResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }
  const { project } = detail.data;
  const ledger = normalizeGearsJobLedger(project.gears_job_ledger);
  const selection = projectGearsSyncItems({ ledger, request });
  if (!selection.items.length) {
    return success({
      project,
      gears_job_ledger: ledger,
      seedance_shot_ledger: project.seedance_shot_ledger,
      pollable_count: 0,
      synced_count: 0,
      failed_count: 0,
      duplicate_count: 0,
      skipped_count: selection.skippedCount,
      synced_jobs: [],
      failures: [],
    });
  }

  const pollRes = await pollGearsExecutionJobStatuses({
    items: selection.items,
    note: request.note ?? 'GEARS status sync',
  });
  if (!pollRes.ok || !pollRes.data) {
    return fail(
      pollRes.error?.code === ErrorCodes.VALIDATION_ERROR
        ? ErrorCodes.VALIDATION_ERROR
        : ErrorCodes.INTERNAL_ERROR,
      pollRes.error?.message ?? 'GEARS status sync failed',
      pollRes.error?.details,
    );
  }

  const failures = [...pollRes.data.failures];
  let currentProject = project;
  let currentLedger = ledger;
  let currentSeedanceLedger = project.seedance_shot_ledger;
  const syncedJobs: GearsJobLedgerItem[] = [];
  let duplicateCount = 0;
  for (const [index, polled] of pollRes.data.callbacks.entries()) {
    const importRes = await importProjectGearsCallback(projectId, polled.callback);
    if (!importRes.ok || !importRes.data) {
      failures.push({
        index,
        source_unit_id: polled.item.source_unit_id,
        gears_job_id: polled.item.gears_job_id,
        message: importRes.error?.message ?? 'GEARS status callback import failed',
      });
      continue;
    }
    currentProject = importRes.data.project;
    currentLedger = normalizeGearsJobLedger(importRes.data.gears_job_ledger);
    currentSeedanceLedger = importRes.data.seedance_shot_ledger;
    const synced = currentLedger.items.find(item =>
      item.gears_job_id === polled.item.gears_job_id
      || item.source_unit_id === polled.item.source_unit_id
    );
    if (synced) syncedJobs.push(synced);
    failures.push(...importRes.data.failures);
    duplicateCount += importRes.data.duplicate_count;
  }

  if (pollRes.data.failures.length) {
    const updatedAt = new Date().toISOString();
    currentLedger = markGearsLedgerPollFailures({
      ledger: currentLedger,
      failures: pollRes.data.failures,
      updatedAt,
    });
    currentProject = {
      ...currentProject,
      updated_at: updatedAt,
      gears_job_ledger: currentLedger,
    };
    await writeJsonFile(projectMetaPath(projectId), currentProject);
  }

  return success({
    project: currentProject,
    gears_job_ledger: currentLedger,
    seedance_shot_ledger: currentSeedanceLedger,
    provider_adapter: pollRes.data.summary,
    pollable_count: selection.items.length,
    synced_count: syncedJobs.length,
    failed_count: failures.length,
    duplicate_count: duplicateCount,
    skipped_count: selection.skippedCount,
    synced_jobs: syncedJobs,
    failures,
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
        failure_category: item?.failure_category,
        provider_error_code: item?.provider_error_code,
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

export async function getProjectProductionReadiness(
  projectId: string,
): Promise<ApiResponse<StoryProjectProductionReadinessReport>> {
  const detailRes = await getProject(projectId);
  if (!detailRes.ok || !detailRes.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detailRes.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const detail = detailRes.data;
  const board = buildStoryProductionBoard(detail.current_story, {
    seedanceAssetLibrary: detail.project.seedance_asset_library,
    seedanceShotLedger: detail.project.seedance_shot_ledger,
  });
  const quality = detail.current_story.quality_report;
  const qualityScore = typeof quality?.genre_score === 'number'
    ? quality.genre_score
    : quality?.passed
      ? 100
      : 0;
  const gearsSummary = summarizeProductionReadinessGears(detail.project.gears_job_ledger);
  const shotStatusCounts = seedanceShotProductionStatusCounts(board.seedance_shot_ledger.items);
  const activeShotCount = shotStatusCounts.submitted + shotStatusCounts.processing;
  const shotCount = board.seedance_shot_ledger.items.length || board.shot_units.length;
  const currentVersion = detail.versions.find(version => version.version_id === detail.project.current_version_id)
    ?? detail.versions[0];
  const issues: ProductionReadinessIssue[] = [];
  const nextActions: ProductionReadinessNextAction[] = [];

  const addIssue = (issue: ProductionReadinessIssue) => issues.push(issue);
  const addAction = (action: ProductionReadinessNextAction) => {
    if (nextActions.some(item => item.action_key === action.action_key)) return;
    nextActions.push(action);
  };

  const qualityLaneStatus: ProductionReadinessStatus = quality?.passed
    ? 'ready'
    : quality
      ? 'needs_action'
      : 'blocked';
  if (!quality) {
    addIssue({
      issue_id: 'quality-report-missing',
      severity: 'blocking',
      lane_key: 'story_quality',
      label: '缺少质量报告',
      detail: '当前故事没有可用于修复闭环的质量报告。',
      action_key: 'repair_quality',
      action_label: '运行质量修复',
    });
  } else if (!quality.passed || quality.issues.length > 0) {
    addIssue({
      issue_id: 'quality-report-needs-repair',
      severity: 'warning',
      lane_key: 'story_quality',
      label: `${quality.issues.length || 1} 个质量问题`,
      detail: quality.issues[0] ?? '质量报告未通过，需要先完成故事修复。',
      action_key: 'repair_quality',
      action_label: '运行质量修复',
    });
  }
  if (qualityLaneStatus !== 'ready') {
    addAction({
      action_key: 'repair_quality',
      label: '运行故事质量修复',
      detail: '先修复类型片质量问题，再刷新 Production Board 和交付包。',
      priority: 10,
      lane_key: 'story_quality',
    });
  }

  if (board.supervision_report.blockers > 0) {
    addIssue({
      issue_id: 'production-board-blockers',
      severity: 'blocking',
      lane_key: 'production_board',
      label: `${board.supervision_report.blockers} 个生产阻断`,
      detail: board.supervision_report.issues.find(item => item.severity === 'blocker')?.detail
        ?? 'Production Board 存在阻断级问题。',
      action_key: 'repair_production_board',
      action_label: '生产修复',
    });
  } else if (board.supervision_report.warnings > 0) {
    addIssue({
      issue_id: 'production-board-warnings',
      severity: 'warning',
      lane_key: 'production_board',
      label: `${board.supervision_report.warnings} 个生产提醒`,
      detail: board.supervision_report.issues.find(item => item.severity === 'warn')?.detail
        ?? 'Production Board 存在可修复提醒。',
      action_key: 'repair_production_board',
      action_label: '生产修复',
    });
  }
  if (!board.supervision_report.passed || board.repair_plan.task_count > 0) {
    addAction({
      action_key: 'repair_production_board',
      label: '执行 Production Board 修复',
      detail: `修复 ${board.repair_plan.task_count} 个制作任务，并重新导出交付包。`,
      priority: 20,
      lane_key: 'production_board',
    });
  }

  if (board.delivery_manifest.stage !== 'ready') {
    addIssue({
      issue_id: 'delivery-contract-not-ready',
      severity: board.delivery_manifest.stage === 'blocked' ? 'blocking' : 'warning',
      lane_key: 'delivery_contract',
      label: board.delivery_manifest.stage_label,
      detail: board.delivery_manifest.next_action,
      action_key: 'export_production_board',
      action_label: '导出交付包',
    });
    addAction({
      action_key: 'export_production_board',
      label: '导出 Production Board 交付包',
      detail: '生成 JSON/Markdown/监督报告/修复计划/Seedance prompt/素材缺口等可交付文件。',
      priority: 30,
      lane_key: 'delivery_contract',
    });
  } else if (!currentVersion?.production_board_export) {
    addAction({
      action_key: 'export_production_board',
      label: '落盘 Production Board 交付包',
      detail: '当前版本可交付，但尚未记录最近一次交付包导出。',
      priority: 35,
      lane_key: 'delivery_contract',
    });
  }

  if (shotCount === 0) {
    addIssue({
      issue_id: 'shot-ledger-empty',
      severity: 'blocking',
      lane_key: 'shot_production',
      label: '缺少镜头生产账本',
      detail: '没有可提交给 GEARS 的镜头单元。',
      action_key: 'export_production_board',
      action_label: '刷新 Production Board',
    });
  } else if (shotStatusCounts.failed > 0) {
    addIssue({
      issue_id: 'shot-production-failed',
      severity: 'blocking',
      lane_key: 'shot_production',
      label: `${shotStatusCounts.failed} 个镜头失败`,
      detail: '失败镜头需要重试、跳过或人工替换。',
      action_key: 'export_retry_package',
      action_label: '导出重试包',
    });
    addAction({
      action_key: 'export_retry_package',
      label: '导出失败镜头重试包',
      detail: `${shotStatusCounts.failed} 个镜头失败，需要进入审片返修或 GEARS 重试。`,
      priority: 45,
      lane_key: 'shot_production',
    });
  } else if (activeShotCount > 0 || shotStatusCounts.prompt_exported > 0) {
    addAction({
      action_key: 'sync_gears_jobs',
      label: '同步 GEARS 状态或导入回传',
      detail: `${activeShotCount + shotStatusCounts.prompt_exported} 个镜头仍在生产链路中。`,
      priority: 40,
      lane_key: 'shot_production',
    });
  }

  if (gearsSummary.total === 0) {
    addIssue({
      issue_id: 'gears-ledger-empty',
      severity: 'warning',
      lane_key: 'gears_execution',
      label: '尚未建立 GEARS job',
      detail: '当前交付包还没有提交到 GEARS Job Ledger。',
      action_key: 'submit_gears_jobs',
      action_label: '提交 GEARS',
    });
    addAction({
      action_key: 'submit_gears_jobs',
      label: '提交 GEARS 生产 job',
      detail: '从 Production Board 镜头单元创建 GEARS job ledger，等待 GEARS v2 实产回调。',
      priority: 50,
      lane_key: 'gears_execution',
    });
  } else {
    if (gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled > 0) {
      addIssue({
        issue_id: 'gears-terminal-failures',
        severity: 'blocking',
        lane_key: 'gears_execution',
        label: `${gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled} 个 GEARS job 失败`,
        detail: 'GEARS 返回 failed/rejected/canceled，需要按 failure_category 重试或人工处理。',
        action_key: 'submit_gears_jobs',
        action_label: '重提 GEARS',
      });
    }
    if (gearsSummary.missing_artifact > 0) {
      addIssue({
        issue_id: 'gears-ready-missing-artifact',
        severity: 'blocking',
        lane_key: 'gears_execution',
        label: `${gearsSummary.missing_artifact} 个 ready job 缺 artifact`,
        detail: 'GEARS job 已 ready 但没有回传 artifact URL，无法进入审片/装配。',
        action_key: 'sync_gears_jobs',
        action_label: '同步 GEARS',
      });
    }
    if (gearsSummary.poll_failure > 0) {
      addIssue({
        issue_id: 'gears-poll-failures',
        severity: 'warning',
        lane_key: 'gears_execution',
        label: `${gearsSummary.poll_failure} 个 GEARS job 轮询失败`,
        detail: '最近一次 status poll 失败，需要检查 GEARS endpoint 或鉴权。',
        action_key: 'sync_gears_jobs',
        action_label: '同步 GEARS',
      });
    }
    if (gearsSummary.active > 0) {
      addAction({
        action_key: 'sync_gears_jobs',
        label: '同步活跃 GEARS job',
        detail: `${gearsSummary.active} 个 GEARS job 仍在 submitted/queued/processing。`,
        priority: 55,
        lane_key: 'gears_execution',
      });
    }
  }

  const lanes: ProductionReadinessLane[] = [
    {
      key: 'story_quality',
      label: 'Story Agent MVP',
      status: qualityLaneStatus,
      score: qualityScore,
      detail: quality?.passed ? '当前故事质量报告通过。' : '当前故事需要质量修复。',
      count_text: quality ? `issues ${quality.issues.length}` : 'missing report',
      evidence: [
        `genre_score ${qualityScore}/100`,
        `versions ${detail.project.version_count}`,
      ],
      action_key: qualityLaneStatus === 'ready' ? undefined : 'repair_quality',
      action_label: qualityLaneStatus === 'ready' ? undefined : '质量修复',
    },
    {
      key: 'production_board',
      label: 'Production Board',
      status: board.supervision_report.blockers > 0
        ? 'blocked'
        : board.supervision_report.passed
          ? 'ready'
          : 'needs_action',
      score: board.supervision_report.score,
      detail: board.supervision_report.passed
        ? '生产监督通过。'
        : '生产监督仍有问题需要修复。',
      count_text: `blockers ${board.supervision_report.blockers} / warnings ${board.supervision_report.warnings}`,
      evidence: [
        `shot_units ${board.shot_units.length}`,
        `repair_tasks ${board.repair_plan.task_count}`,
      ],
      action_key: board.supervision_report.passed ? undefined : 'repair_production_board',
      action_label: board.supervision_report.passed ? undefined : '生产修复',
    },
    {
      key: 'delivery_contract',
      label: 'Delivery Contract',
      status: board.delivery_manifest.stage === 'ready'
        ? currentVersion?.production_board_export ? 'ready' : 'needs_action'
        : board.delivery_manifest.stage === 'blocked' ? 'blocked' : 'needs_action',
      score: productionReadinessDeliveryScore(board.delivery_manifest.stage, Boolean(currentVersion?.production_board_export)),
      detail: currentVersion?.production_board_export
        ? `最近交付包已落盘：${currentVersion.production_board_export.file_count} 个文件。`
        : board.delivery_manifest.next_action,
      count_text: `${board.delivery_manifest.ready_artifact_count}/${board.delivery_manifest.artifacts.length} artifacts`,
      evidence: [
        `stage ${board.delivery_manifest.stage}`,
        currentVersion?.production_board_export ? `exported ${currentVersion.production_board_export.exported_at}` : 'not exported',
      ],
      action_key: currentVersion?.production_board_export ? undefined : 'export_production_board',
      action_label: currentVersion?.production_board_export ? undefined : '导出交付包',
    },
    {
      key: 'shot_production',
      label: 'Shot Ledger',
      status: productionReadinessShotStatus(shotCount, shotStatusCounts.failed, activeShotCount, shotStatusCounts.ready),
      score: productionReadinessShotScore(shotCount, shotStatusCounts.ready, activeShotCount, shotStatusCounts.failed),
      detail: shotCount > 0
        ? `镜头账本 ready ${shotStatusCounts.ready}，active ${activeShotCount}，failed ${shotStatusCounts.failed}。`
        : '尚未形成镜头账本。',
      count_text: `ready ${shotStatusCounts.ready}/${shotCount}`,
      evidence: [
        `prompt_exported ${shotStatusCounts.prompt_exported}`,
        `skipped ${shotStatusCounts.skipped}`,
      ],
      action_key: shotStatusCounts.failed > 0 ? 'export_retry_package' : activeShotCount > 0 ? 'sync_gears_jobs' : undefined,
      action_label: shotStatusCounts.failed > 0 ? '导出重试包' : activeShotCount > 0 ? '同步状态' : undefined,
    },
    {
      key: 'gears_execution',
      label: 'GEARS Execution',
      status: productionReadinessGearsStatus(gearsSummary),
      score: productionReadinessGearsScore(gearsSummary),
      detail: gearsSummary.total > 0
        ? `GEARS jobs ready ${gearsSummary.ready}，active ${gearsSummary.active}，failed ${gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled}。`
        : '尚未提交 GEARS job；等待从交付包建账本。',
      count_text: `jobs ${gearsSummary.total}`,
      evidence: [
        `missing_artifact ${gearsSummary.missing_artifact}`,
        `poll_failure ${gearsSummary.poll_failure}`,
      ],
      action_key: gearsSummary.total === 0 || gearsSummary.failed > 0 || gearsSummary.active > 0 ? 'submit_gears_jobs' : undefined,
      action_label: gearsSummary.total === 0 ? '提交 GEARS' : gearsSummary.active > 0 ? '同步 GEARS' : undefined,
    },
    {
      key: 'review_repair',
      label: 'MCP / Repair Loop',
      status: !quality || !quality.passed || board.repair_plan.task_count > 0
        ? board.repair_plan.blocker_task_count > 0 ? 'blocked' : 'needs_action'
        : 'ready',
      score: Math.max(0, Math.min(100, 100 - board.repair_plan.task_count * 10 - (quality?.issues.length ?? 1) * 8)),
      detail: board.repair_plan.task_count > 0
        ? `还有 ${board.repair_plan.task_count} 个可执行修复任务。`
        : '修复闭环当前无待办。',
      count_text: `repair ${board.repair_plan.task_count}`,
      evidence: [
        `quality_issues ${quality?.issues.length ?? 0}`,
        `blocker_tasks ${board.repair_plan.blocker_task_count}`,
      ],
      action_key: board.repair_plan.task_count > 0 ? 'repair_production_board' : undefined,
      action_label: board.repair_plan.task_count > 0 ? '生产修复' : undefined,
    },
    {
      key: 'commercial_ops',
      label: 'Commercial Workbench',
      status: currentVersion?.production_board_export && gearsSummary.total > 0 ? 'ready' : 'needs_action',
      score: (currentVersion?.production_board_export ? 50 : 20) + (gearsSummary.total > 0 ? 50 : 20),
      detail: currentVersion?.production_board_export && gearsSummary.total > 0
        ? '交付包和 GEARS 账本都已具备，可进入制作运营跟踪。'
        : '商业制作中台还缺交付包落盘或 GEARS job 账本。',
      count_text: `export ${currentVersion?.production_board_export ? 1 : 0} / gears ${gearsSummary.total}`,
      evidence: [
        `project_status ${detail.project.status}`,
        `version ${detail.project.current_version_id}`,
      ],
      action_key: !currentVersion?.production_board_export ? 'export_production_board' : gearsSummary.total === 0 ? 'submit_gears_jobs' : undefined,
      action_label: !currentVersion?.production_board_export ? '导出交付包' : gearsSummary.total === 0 ? '提交 GEARS' : undefined,
    },
  ];

  const sortedNextActions = nextActions.sort((a, b) => a.priority - b.priority);
  const base: Omit<StoryProjectProductionReadinessReport, 'markdown'> = {
    schema_version: 'story-project-production-readiness/v1',
    scope: 'story_project',
    project: detail.project,
    title: detail.current_story.title,
    generated_at: new Date().toISOString(),
    summary: buildProductionReadinessSummary(lanes, issues, sortedNextActions, {
      qualityScore,
      deliveryStage: board.delivery_manifest.stage,
      totalShotCount: shotCount,
      readyShotCount: shotStatusCounts.ready,
      failedShotCount: shotStatusCounts.failed,
      gearsSummary,
    }),
    lanes,
    issues,
    next_actions: sortedNextActions,
    automation_plan: buildProductionReadinessAutomationPlan({
      scope: 'story_project',
      projectId: detail.project.project_id,
      actions: sortedNextActions,
      issues,
    }),
    automation_ledger: detail.project.production_readiness_automation_ledger,
    latest_automation_run: detail.project.production_readiness_automation_ledger?.latest_run,
  };

  return success({
    ...base,
    markdown: buildStoryProjectProductionReadinessMarkdown(base),
  });
}

export async function runProjectProductionReadinessAutomation(
  projectId: string,
  request: ProductionReadinessAutomationRunRequest = {},
): Promise<ApiResponse<ProductionReadinessAutomationRunResult<StoryProjectProductionReadinessReport>>> {
  const dryRun = request.dry_run ?? true;
  const maxSteps = request.max_steps ?? 6;
  const stopOnError = request.stop_on_error ?? true;
  const requestedActionKeys = request.action_keys?.length ? new Set(request.action_keys) : undefined;
  const startedAt = new Date().toISOString();
  const beforeRes = await getProjectProductionReadiness(projectId);
  if (!beforeRes.ok || !beforeRes.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      beforeRes.error?.message ?? `Project "${projectId}" not found`,
      beforeRes.error?.details,
    );
  }

  const steps: ProductionReadinessAutomationRunResult<StoryProjectProductionReadinessReport>['steps'] = [];
  const completedActionKeys = new Set<string>();
  let failed = false;

  for (let iteration = 0; iteration < maxSteps; iteration += 1) {
    const readinessRes = iteration === 0 ? beforeRes : await getProjectProductionReadiness(projectId);
    if (!readinessRes.ok || !readinessRes.data) break;
    const step = readinessRes.data.automation_plan.steps.find(candidate => {
      if (completedActionKeys.has(candidate.action_key)) return false;
      if (requestedActionKeys && !requestedActionKeys.has(candidate.action_key)) return false;
      return true;
    });
    if (!step) break;
    completedActionKeys.add(step.action_key);

    if (!step.can_auto_execute) {
      steps.push({
        step_id: step.step_id,
        action_key: step.action_key,
        label: step.label,
        status: 'skipped',
        runner: step.runner,
        mode: step.mode,
        can_auto_execute: step.can_auto_execute,
        reason: step.status === 'blocked'
          ? `blocked by ${step.blocked_by_issue_ids.join(', ') || 'readiness gate'}`
          : step.mode === 'manual'
            ? 'manual review required'
            : 'external execution is not run inside china-culture-kb',
        api_path: step.api?.path,
      });
      continue;
    }

    if (dryRun) {
      steps.push({
        step_id: step.step_id,
        action_key: step.action_key,
        label: step.label,
        status: 'planned',
        runner: step.runner,
        mode: step.mode,
        can_auto_execute: true,
        reason: 'dry_run',
        api_path: step.api?.path,
      });
      continue;
    }

    const execRes = await executeProjectReadinessAutomationStep(projectId, step.action_key);
    steps.push({
      step_id: step.step_id,
      action_key: step.action_key,
      label: step.label,
      status: execRes.ok ? 'executed' : 'failed',
      runner: step.runner,
      mode: step.mode,
      can_auto_execute: true,
      api_path: step.api?.path,
      response_schema_version: productionAutomationSchemaVersion(execRes.data),
      error_message: execRes.error?.message,
    });
    if (!execRes.ok) {
      failed = true;
      if (stopOnError) break;
    }
  }

  const afterRes = await getProjectProductionReadiness(projectId);
  if (!afterRes.ok || !afterRes.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      afterRes.error?.message ?? `Project "${projectId}" not found after automation run`,
      afterRes.error?.details,
    );
  }
  const completedAt = new Date().toISOString();
  const runResult: ProductionReadinessAutomationRunResult<StoryProjectProductionReadinessReport> = {
    schema_version: 'production-readiness-automation-run/v1',
    scope: 'story_project',
    project_id: projectId,
    dry_run: dryRun,
    started_at: startedAt,
    completed_at: completedAt,
    requested_action_keys: request.action_keys,
    executed_step_count: steps.filter(step => step.status === 'executed').length,
    planned_step_count: steps.filter(step => step.status === 'planned').length,
    skipped_step_count: steps.filter(step => step.status === 'skipped').length,
    failed_step_count: steps.filter(step => step.status === 'failed').length,
    steps,
    before_readiness: beforeRes.data,
    after_readiness: afterRes.data,
    notes: [
      dryRun ? 'dry_run=true: no project files were changed.' : 'Executed only Story Agent API steps marked can_auto_execute.',
      'GEARS worker and manual review steps are never executed by this runner.',
      dryRun ? 'Automation run ledger was not persisted for dry_run.' : 'Automation run ledger was persisted on the story project metadata.',
      failed ? 'At least one step failed; inspect failed step error_message.' : 'Automation runner completed without failed internal steps.',
    ],
  };

  if (!dryRun) {
    await appendProjectProductionReadinessAutomationRun(projectId, runResult);
    const finalAfterRes = await getProjectProductionReadiness(projectId);
    if (finalAfterRes.ok && finalAfterRes.data) {
      runResult.after_readiness = finalAfterRes.data;
    }
  }

  return success(runResult);
}

const productionReadinessAutomationLedgerLimit = 20;

function buildProductionReadinessAutomationRunLedger(
  existing: ProductionReadinessAutomationRunLedger | undefined,
  run: ProductionReadinessAutomationRunResult<StoryProjectProductionReadinessReport>,
): ProductionReadinessAutomationRunLedger {
  const item = {
    run_id: `production-readiness-run-${randomUUID()}`,
    scope: run.scope,
    project_id: run.project_id,
    dry_run: run.dry_run,
    started_at: run.started_at,
    completed_at: run.completed_at,
    requested_action_keys: run.requested_action_keys,
    executed_step_count: run.executed_step_count,
    planned_step_count: run.planned_step_count,
    skipped_step_count: run.skipped_step_count,
    failed_step_count: run.failed_step_count,
    before_status: run.before_readiness.summary.status,
    before_score: run.before_readiness.summary.score,
    after_status: run.after_readiness.summary.status,
    after_score: run.after_readiness.summary.score,
    steps: run.steps,
    notes: run.notes,
  };
  const previousItems = existing?.items ?? [];
  const items = [
    item,
    ...previousItems.filter(previous => previous.run_id !== item.run_id),
  ].slice(0, productionReadinessAutomationLedgerLimit);
  return {
    schema_version: 'production-readiness-automation-run-ledger/v1',
    updated_at: run.completed_at,
    total_run_count: (existing?.total_run_count ?? previousItems.length) + 1,
    persisted_run_count: items.length,
    latest_run: item,
    items,
  };
}

async function appendProjectProductionReadinessAutomationRun(
  projectId: string,
  run: ProductionReadinessAutomationRunResult<StoryProjectProductionReadinessReport>,
): Promise<void> {
  const project = await readProjectMeta(projectId);
  if (!project) return;
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: run.completed_at,
    production_readiness_automation_ledger: buildProductionReadinessAutomationRunLedger(
      project.production_readiness_automation_ledger,
      run,
    ),
  };
  await writeJsonFile(projectMetaPath(projectId), updatedProject);
}

async function executeProjectReadinessAutomationStep(
  projectId: string,
  actionKey: string,
): Promise<ApiResponse<unknown>> {
  if (actionKey === 'repair_quality') return repairProjectQuality(projectId, {});
  if (actionKey === 'repair_production_board') return repairAndExportProjectProductionBoard(projectId, { apply_all: true });
  if (actionKey === 'export_production_board') return exportProjectProductionBoard(projectId);
  if (actionKey === 'export_retry_package') return exportProjectSeedanceRetryPackage(projectId);
  return fail(ErrorCodes.VALIDATION_ERROR, `Automation action "${actionKey}" is not executable for story projects`);
}

function productionAutomationSchemaVersion(data: unknown): string | undefined {
  return typeof data === 'object' && data !== null && 'schema_version' in data
    ? String((data as { schema_version?: unknown }).schema_version)
    : undefined;
}

function seedanceShotProductionStatusCounts(
  items: SeedanceShotLedgerItem[],
): Record<SeedanceShotProductionStatus, number> {
  const counts = Object.fromEntries(
    SEEDANCE_SHOT_PRODUCTION_STATUSES.map(status => [status, 0]),
  ) as Record<SeedanceShotProductionStatus, number>;
  for (const item of items) {
    counts[item.status] += 1;
  }
  return counts;
}

function summarizeProductionReadinessGears(ledger?: GearsJobLedger): ProductionReadinessGearsSummary {
  const normalized = normalizeGearsJobLedger(ledger);
  const statusCounts = Object.fromEntries(
    GEARS_EXECUTION_JOB_STATUSES.map(status => [status, 0]),
  ) as Record<GearsExecutionJobStatus, number>;
  let missingArtifact = 0;
  let pollFailure = 0;
  for (const item of normalized.items) {
    statusCounts[item.status] += 1;
    if (item.status === 'ready' && item.artifact_urls.length === 0 && (item.artifacts?.length ?? 0) === 0) {
      missingArtifact += 1;
    }
    if (item.last_poll_error) {
      pollFailure += 1;
    }
  }
  return {
    total: normalized.items.length,
    active: statusCounts.submitted + statusCounts.queued + statusCounts.processing,
    ready: statusCounts.ready,
    failed: statusCounts.failed,
    rejected: statusCounts.rejected,
    canceled: statusCounts.canceled,
    missing_artifact: missingArtifact,
    poll_failure: pollFailure,
    status_counts: statusCounts,
  };
}

function productionReadinessDeliveryScore(
  stage: StoryProductionBoard['delivery_manifest']['stage'],
  exported: boolean,
): number {
  if (stage === 'ready') return exported ? 100 : 85;
  if (stage === 'needs_repair') return 65;
  return 30;
}

function productionReadinessShotStatus(
  total: number,
  failed: number,
  active: number,
  ready: number,
): ProductionReadinessStatus {
  if (total <= 0 || failed > 0) return 'blocked';
  if (ready >= total) return 'ready';
  if (active > 0 || ready > 0) return 'needs_action';
  return 'needs_action';
}

function productionReadinessShotScore(
  total: number,
  ready: number,
  active: number,
  failed: number,
): number {
  if (total <= 0) return 20;
  const readyScore = (ready / total) * 100;
  const activeCredit = (active / total) * 45;
  const failurePenalty = (failed / total) * 60;
  return Math.max(0, Math.min(100, Math.round(readyScore + activeCredit - failurePenalty)));
}

function productionReadinessGearsStatus(summary: ProductionReadinessGearsSummary): ProductionReadinessStatus {
  if (summary.total === 0) return 'needs_action';
  if (summary.failed + summary.rejected + summary.canceled + summary.missing_artifact > 0) return 'blocked';
  if (summary.active > 0 || summary.poll_failure > 0 || summary.ready < summary.total) return 'needs_action';
  return 'ready';
}

function productionReadinessGearsScore(summary: ProductionReadinessGearsSummary): number {
  if (summary.total === 0) return 45;
  const readyScore = (summary.ready / summary.total) * 100;
  const activeCredit = (summary.active / summary.total) * 50;
  const failurePenalty = ((summary.failed + summary.rejected + summary.canceled) / summary.total) * 70;
  const artifactPenalty = (summary.missing_artifact / summary.total) * 80;
  const pollPenalty = (summary.poll_failure / summary.total) * 20;
  return Math.max(0, Math.min(100, Math.round(readyScore + activeCredit - failurePenalty - artifactPenalty - pollPenalty)));
}

function buildProductionReadinessSummary(
  lanes: ProductionReadinessLane[],
  issues: ProductionReadinessIssue[],
  nextActions: ProductionReadinessNextAction[],
  extras: {
    qualityScore?: number;
    deliveryStage?: StoryProductionBoard['delivery_manifest']['stage'];
    generatedEpisodeCount?: number;
    totalEpisodeCount?: number;
    totalShotCount?: number;
    readyShotCount?: number;
    failedShotCount?: number;
    openReviewCount?: number;
    gearsSummary: ProductionReadinessGearsSummary;
  },
): StoryProjectProductionReadinessReport['summary'] {
  const blockerCount = issues.filter(issue => issue.severity === 'blocking').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;
  const averageLaneScore = lanes.length
    ? lanes.reduce((sum, lane) => sum + lane.score, 0) / lanes.length
    : 0;
  return {
    status: productionReadinessOverallStatus(lanes, blockerCount, warningCount),
    score: Math.max(0, Math.min(100, Math.round(averageLaneScore - blockerCount * 6 - warningCount * 2))),
    ready_lane_count: lanes.filter(lane => lane.status === 'ready').length,
    total_lane_count: lanes.length,
    blocker_count: blockerCount,
    warning_count: warningCount,
    next_action_count: nextActions.length,
    quality_score: extras.qualityScore,
    delivery_stage: extras.deliveryStage,
    generated_episode_count: extras.generatedEpisodeCount,
    total_episode_count: extras.totalEpisodeCount,
    total_shot_count: extras.totalShotCount,
    ready_shot_count: extras.readyShotCount,
    failed_shot_count: extras.failedShotCount,
    open_review_count: extras.openReviewCount,
    gears_job_count: extras.gearsSummary.total,
    active_gears_job_count: extras.gearsSummary.active,
  };
}

function productionReadinessOverallStatus(
  lanes: ProductionReadinessLane[],
  blockerCount: number,
  warningCount: number,
): ProductionReadinessStatus {
  if (blockerCount > 0 || lanes.some(lane => lane.status === 'blocked')) return 'blocked';
  if (warningCount > 0 || lanes.some(lane => lane.status === 'needs_action')) return 'needs_action';
  return 'ready';
}

function buildStoryProjectProductionReadinessMarkdown(
  report: Omit<StoryProjectProductionReadinessReport, 'markdown'>,
): string {
  return [
    `# ${report.title} — 制作 readiness`,
    '',
    `> schema: ${report.schema_version}`,
    `> projectId: ${report.project.project_id}`,
    `> generatedAt: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- 状态: ${productionReadinessStatusText(report.summary.status)}`,
    `- 分数: ${report.summary.score}/100`,
    `- lanes: ${report.summary.ready_lane_count}/${report.summary.total_lane_count}`,
    `- blockers: ${report.summary.blocker_count}`,
    `- warnings: ${report.summary.warning_count}`,
    `- next actions: ${report.summary.next_action_count}`,
    '',
    '## Lanes',
    '',
    '| 模块 | 状态 | 分数 | 说明 |',
    '|---|---:|---:|---|',
    ...report.lanes.map(lane =>
      `| ${lane.label} | ${productionReadinessStatusText(lane.status)} | ${lane.score}/100 | ${lane.detail} |`,
    ),
    '',
    '## Issues',
    '',
    ...(report.issues.length
      ? report.issues.map(issue =>
        `- ${issueSeverityText(issue.severity)} · ${issue.label}: ${issue.detail}`,
      )
      : ['- 暂无阻断项。']),
    '',
    '## Next Actions',
    '',
    ...(report.next_actions.length
      ? report.next_actions.map(action => `- P${action.priority} · ${action.label}: ${action.detail}`)
      : ['- 暂无下一步动作。']),
    '',
    '## Automation Plan',
    '',
    ...(report.automation_plan.steps.length
      ? report.automation_plan.steps.map(step =>
        `- ${step.step_id} · ${step.status} · ${step.runner}: ${step.label} -> ${step.expected_result}`,
      )
      : ['- 暂无自动化步骤。']),
    '',
    '## Latest Automation Run',
    '',
    ...(report.latest_automation_run
      ? [
        `- ${report.latest_automation_run.completed_at} · ${report.latest_automation_run.executed_step_count} executed · ${report.latest_automation_run.failed_step_count} failed · ${report.latest_automation_run.before_score}->${report.latest_automation_run.after_score}`,
        ...report.latest_automation_run.steps.map(step =>
          `  - ${step.status} · ${step.action_key}: ${step.label}`,
        ),
      ]
      : ['- 暂无已持久化的自动化运行记录。']),
  ].join('\n');
}

function productionReadinessStatusText(status: ProductionReadinessStatus): string {
  if (status === 'ready') return 'ready';
  if (status === 'blocked') return 'blocked';
  return 'needs_action';
}

function issueSeverityText(severity: ProductionReadinessIssue['severity']): string {
  if (severity === 'blocking') return '阻断';
  if (severity === 'warning') return '提醒';
  return '信息';
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
  const sanitizedGearsJobLedger = sanitizeGearsJobLedgerPayloadSummaries(project.gears_job_ledger, exportedAt);
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
    gears_job_ledger: sanitizedGearsJobLedger.ledger,
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

function seedanceProviderRetryReasonText(reason: SeedanceShotProviderRetryPlanReason): string {
  const map: Record<SeedanceShotProviderRetryPlanReason, string> = {
    failed: '失败回片',
    timed_out: '等待超时',
    ready_missing_video: '完成但缺视频',
    unsubmitted: '尚未提交',
  };
  return map[reason];
}

function buildSeedanceProviderRetryPlanMarkdown(
  plan: Omit<SeedanceShotProviderRetryPlanResult, 'markdown'>,
): string {
  const lines = [
    `# ${plan.project.title} — Seedance provider 人工重试策略`,
    '',
    `> projectId: ${plan.project.project_id}`,
    `> generatedAt: ${plan.generated_at}`,
    `> provider: ${plan.provider ?? '全部'}`,
    `> queueId: ${plan.queue_id ?? '全部'}`,
    `> timeoutMinutes: ${plan.timeout_minutes}`,
    typeof plan.max_retry_count === 'number' ? `> maxRetryCount: ${plan.max_retry_count}` : '> maxRetryCount: 未限制',
    '',
    '## 摘要',
    '',
    `- 候选镜头: ${plan.candidate_count}`,
    `- 可直接重提: ${plan.resubmittable_count}`,
    `- 需先处理: ${plan.blocked_count}`,
    `- 高优先级: ${plan.high_priority_count}`,
    `- 原因分布: 失败 ${plan.reason_counts.failed}；超时 ${plan.reason_counts.timed_out}；缺视频 ${plan.reason_counts.ready_missing_video}；未提交 ${plan.reason_counts.unsubmitted}`,
    '',
    '## 候选镜头',
  ];
  if (!plan.candidates.length) {
    lines.push('', '- 暂无需要人工重试的镜头。');
    return lines.join('\n');
  }
  for (const item of plan.candidates) {
    lines.push(
      '',
      `### ${item.shot_id} / 场景 ${item.source_scene_id ?? '未记录'}`,
      '',
      `- 优先级: ${item.priority}`,
      `- 原因: ${seedanceProviderRetryReasonText(item.retry_reason)}`,
      `- 状态: ${seedanceShotStatusText(item.status)}`,
      `- 可直接重提: ${item.can_resubmit ? '是' : '否'}`,
      item.block_reason ? `- 阻断原因: ${item.block_reason}` : '- 阻断原因: 无',
      `- 等待时间: ${item.minutes_waiting} 分钟`,
      `- 重试次数: ${item.retry_count}`,
      `- provider job: ${item.provider_job_id ?? '未记录'}`,
      `- queue: ${item.provider_queue_id ?? '未记录'}${item.provider_queue_position ? ` #${item.provider_queue_position}` : ''}`,
      `- 失败分类: ${item.failure_category ?? '未分类'}`,
      `- Provider 错误码: ${item.provider_error_code ?? '未记录'}`,
      `- 失败原因: ${item.failure_reason ?? '未记录'}`,
      `- 建议动作: ${item.suggested_action}`,
    );
  }
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
      `- 失败分类: ${shot.failure_category ?? '未分类'}`,
      `- Provider 错误码: ${shot.provider_error_code ?? '未记录'}`,
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
  filtersOrStatus: ProjectSupplementTaskListFilters | KnowledgeSupplementTaskStatus = {},
): Promise<ApiResponse<ProjectSupplementTaskListItem[]>> {
  const filters: ProjectSupplementTaskListFilters = typeof filtersOrStatus === 'string'
    ? { status: filtersOrStatus }
    : filtersOrStatus;
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
      if (filters.status && task.status !== filters.status) continue;
      if (filters.stage && task.stage !== filters.stage) continue;
      if (filters.blocking_level && task.blocking_level !== filters.blocking_level) continue;
      if (filters.source && task.source !== filters.source) continue;
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
    const blockingDelta = supplementBlockingPriority(a.task.blocking_level) - supplementBlockingPriority(b.task.blocking_level);
    if (blockingDelta !== 0) return blockingDelta;
    const stageDelta = supplementStagePriority(a.task.stage) - supplementStagePriority(b.task.stage);
    if (stageDelta !== 0) return stageDelta;
    const aTime = a.task.updated_at ?? a.task.resolved_at ?? a.updated_at;
    const bTime = b.task.updated_at ?? b.task.resolved_at ?? b.updated_at;
    return bTime.localeCompare(aTime);
  });
  return success(items);
}

function supplementBlockingPriority(level: ProjectSupplementTaskListItem['task']['blocking_level']): number {
  if (level === 'blocking') return 0;
  if (level === 'risk') return 1;
  if (level === 'optional') return 2;
  return 3;
}

function supplementStagePriority(stage: ProjectSupplementTaskListItem['task']['stage']): number {
  if (stage === 'script_ready') return 0;
  if (stage === 'minimum_viable_story') return 1;
  if (stage === 'production_ready') return 2;
  return 3;
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
  if (
    !normalized.material_pack
    || !normalized.creation_use_case
    || !normalized.truth_mode
    || !normalized.material_sufficiency
    || !normalized.creation_contract
  ) {
    Object.assign(normalized, refreshStoryMaterialContract(normalized, materialPackForStory(normalized)));
  }
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

async function hydrateProjectMetaForCurrentStory(project: StoryProjectMeta): Promise<StoryProjectMeta> {
  if (project.creation_use_case && project.truth_mode && project.material_sufficiency && project.creation_contract) {
    return project;
  }
  const versions = await readVersionSnapshots(project.project_id);
  const currentVersion = versions.find(version => version.version_id === project.current_version_id) ?? versions[0];
  if (!currentVersion) return project;
  return hydrateProjectMetaForStory(project, normalizeStoryGenerationFields(currentVersion.story));
}

function hydrateProjectMetaForStory(project: StoryProjectMeta, story: StoryGenerateResult): StoryProjectMeta {
  return {
    ...project,
    story_structure: project.story_structure ?? story.story_structure,
    creation_use_case: project.creation_use_case ?? story.creation_use_case,
    truth_mode: project.truth_mode ?? story.truth_mode,
    material_sufficiency: project.material_sufficiency ?? story.material_sufficiency,
    creation_contract: project.creation_contract ?? story.creation_contract,
  };
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

const QUALITY_REPAIR_PROMPT_PROTECTED_FIELDS = [
  'storyId',
  'project_id',
  'source_entry',
  'video_type',
  'presentation_style',
  'story_structure',
  'story_blueprint.evidence_boundaries',
  'creation_contract',
  'material_sufficiency',
  'material_pack',
  'credibility_note',
];

const QUALITY_REPAIR_PROMPT_REQUIRED_FIELDS = [
  'storyId',
  'title',
  'logline',
  'theme',
  'full_text',
  'video_type',
  'presentation_style',
  'scene_breakdown',
  'gears_segments',
  'quality_report',
  'creation_contract',
  'material_sufficiency',
  'material_pack',
];

function clampQualityRepairPromptMaxActions(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 12;
  return Math.max(1, Math.min(50, Math.floor(value)));
}

function fallbackQualityRepairActions(story: StoryGenerateResult, maxActions: number): QualityRepairAction[] {
  const quality = story.quality_report;
  const source = [
    ...(quality?.repair_actions ?? []),
    ...(quality?.issues ?? []),
  ].map(item => item.trim()).filter(Boolean);
  return [...new Set(source)]
    .slice(0, maxActions)
    .map((item, index) => ({
      action_id: `repair-prompt-${String(index + 1).padStart(3, '0')}`,
      label: item.length > 40 ? `${item.slice(0, 40)}...` : item,
      target_report: 'combined',
      severity: index < 2 ? 'high' : 'medium',
      scene_ids: story.scene_breakdown.slice(0, 3).map(scene => scene.scene_id),
      prompt: item,
      expected_effect: '重新校验后相关质量问题减少，且不突破创作合同和素材边界。',
    }));
}

function selectQualityRepairPromptActions(
  story: StoryGenerateResult,
  request: StoryQualityRepairPromptRequest,
): QualityRepairAction[] {
  const selected = selectRequestedRepairActions(story.quality_report?.repair_action_items ?? [], request)
    ?.slice(0, clampQualityRepairPromptMaxActions(request.max_actions)) ?? [];
  if (selected.length > 0) return selected;
  return fallbackQualityRepairActions(story, clampQualityRepairPromptMaxActions(request.max_actions));
}

function qualityRepairPromptTargetSceneIds(actions: QualityRepairAction[], story: StoryGenerateResult): number[] {
  const ids = actions.flatMap(action => action.scene_ids);
  const unique = [...new Set(ids.filter(sceneId => Number.isFinite(sceneId)))].sort((a, b) => a - b);
  return unique.length > 0 ? unique : story.scene_breakdown.slice(0, 3).map(scene => scene.scene_id);
}

function buildQualityRepairPromptText(input: {
  story: StoryGenerateResult;
  actions: QualityRepairAction[];
  targetSceneIds: number[];
  request: StoryQualityRepairPromptRequest;
}): string {
  const { story, actions, targetSceneIds, request } = input;
  const quality = story.quality_report;
  const targetScenes = story.scene_breakdown
    .filter(scene => targetSceneIds.includes(scene.scene_id))
    .map(scene => ({
      scene_id: scene.scene_id,
      title: scene.title,
      dramatic_function: scene.dramatic_function,
      plot: scene.plot,
      key_action: scene.key_action,
      conflict: scene.conflict,
      dialogue_or_narration: scene.dialogue_or_narration,
    }));
  return [
    '你是 china-culture-kb Story Agent 的故事修复写手。请输出一个完整 repaired_story_json。',
    '',
    '硬性输出规则：',
    '1. 只输出一个 JSON 对象，不要 Markdown、解释、代码围栏或额外文本。',
    '2. JSON 根对象必须是完整 StoryGenerateResult；不要只输出 patch/diff。',
    '3. 保留 storyId、project_id、source_entry、video_type、presentation_style、story_structure、story_blueprint.evidence_boundaries、creation_contract、material_sufficiency、material_pack 和 credibility_note，除非修复动作明确要求调整。',
    '4. 同步修复 full_text、scene_breakdown、gears_segments 和 quality_report，避免正文、分场和 GEARS 单元互相矛盾。',
    '5. script_text 只写观众可听/可见的剧本内容；visual_prompt 只写可见画面元素；camera_suggestion 只写镜头语言；validation_notes 不得混入提示词字段。',
    '6. 不新增未经来源支持的硬事实；戏剧化内容要放在 fictionalized_elements、cultural_note 或 credibility_note 的边界中。',
    '7. 不写入 data/provinces，也不要声称已经保存文件；保存只能由 Story Agent 项目版本接口完成。',
    '',
    '创作合同边界：',
    JSON.stringify({
      creation_contract: story.creation_contract,
      material_sufficiency: story.material_sufficiency,
      material_pack_summary: story.material_pack
        ? {
            primary_count: story.material_pack.primary_materials.length,
            supporting_count: story.material_pack.supporting_materials.length,
            reference_count: story.material_pack.reference_materials.length,
            missing_needs: story.material_pack.missing_needs.map(item => item.label),
            verified_facts: story.material_pack.verified_facts.slice(0, 8),
            uncertain_claims: story.material_pack.uncertain_claims.slice(0, 8),
          }
        : undefined,
    }, null, 2),
    '',
    '质量快照：',
    JSON.stringify({
      video_type: story.video_type,
      story_structure: story.story_structure,
      passed: quality?.passed ?? false,
      genre_score: quality?.genre_score,
      issues: quality?.issues ?? [],
      missing_required_elements: quality?.missing_required_elements ?? [],
      weak_beats: quality?.weak_beats ?? [],
      forbidden_patterns_found: quality?.forbidden_patterns_found ?? [],
    }, null, 2),
    '',
    ...(request.user_instruction?.trim()
      ? ['调用方补充要求：', request.user_instruction.trim(), '']
      : []),
    '必须处理的修复动作：',
    JSON.stringify(actions, null, 2),
    '',
    '重点场景：',
    JSON.stringify(targetScenes, null, 2),
    '',
    '原始 StoryGenerateResult：',
    request.include_story_json === true
      ? JSON.stringify(story, null, 2)
      : '<当前 Web 请求未内嵌完整原始故事 JSON；请基于项目当前版本 JSON 做最小必要修改>',
    '',
    '请输出修复后的完整 StoryGenerateResult JSON。',
  ].join('\n');
}

function buildQualityRepairPromptMarkdown(result: Omit<StoryQualityRepairPromptResult, 'markdown'>): string {
  return [
    '# Story Quality Repair Prompt',
    '',
    `- schema: ${result.schema_version}`,
    `- project: ${result.project_id}`,
    `- story: ${result.story_id}`,
    `- title: ${result.title}`,
    `- score: ${result.quality_snapshot.genre_score ?? 'n/a'}`,
    `- issue_count: ${result.quality_snapshot.issue_count}`,
    `- repair_actions: ${result.repair_actions.length}`,
    `- target_scenes: ${result.target_scene_ids.join(', ') || 'none'}`,
    '',
    '## Protected Fields',
    '',
    ...result.protected_fields.map(field => `- ${field}`),
    '',
    '## Prompt',
    '',
    result.prompt,
  ].join('\n');
}

export async function generateProjectQualityRepairPrompt(
  projectId: string,
  request: StoryQualityRepairPromptRequest,
): Promise<ApiResponse<StoryQualityRepairPromptResult>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detailResult.error?.message ?? `Project "${projectId}" not found`,
      detailResult.error?.details,
    );
  }

  const { project, current_story } = detailResult.data;
  if (!current_story.quality_report) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Project "${projectId}" current story has no quality report`);
  }

  const actions = selectQualityRepairPromptActions(current_story, request);
  const targetSceneIds = qualityRepairPromptTargetSceneIds(actions, current_story);
  const prompt = buildQualityRepairPromptText({
    story: current_story,
    actions,
    targetSceneIds,
    request,
  });
  const result: Omit<StoryQualityRepairPromptResult, 'markdown'> = {
    schema_version: 'story-quality-repair-prompt/v1',
    project_id: project.project_id,
    story_id: current_story.storyId,
    title: current_story.title,
    generated_at: new Date().toISOString(),
    quality_snapshot: {
      video_type: current_story.video_type,
      story_structure: current_story.story_structure,
      passed: current_story.quality_report.passed,
      genre_score: current_story.quality_report.genre_score,
      issue_count: current_story.quality_report.issues.length,
    },
    repair_actions: actions,
    source_issues: current_story.quality_report.issues,
    target_scene_ids: targetSceneIds,
    protected_fields: QUALITY_REPAIR_PROMPT_PROTECTED_FIELDS,
    output_contract: {
      format: 'json',
      root_type: 'StoryGenerateResult',
      required_top_level_fields: QUALITY_REPAIR_PROMPT_REQUIRED_FIELDS,
      validation_hint: '先用 Story Agent 质量校验或 MCP kb_validate_genre_story 校验 repaired_story_json。',
      apply_hint: '确认改善后，再通过项目质量修复/版本写入接口新增版本；不要覆盖旧版本。',
    },
    creation_contract: current_story.creation_contract,
    material_sufficiency: current_story.material_sufficiency,
    prompt,
    original_story_json: request.include_story_json ? JSON.stringify(current_story, null, 2) : undefined,
  };

  return success(request.include_markdown === false
    ? result
    : {
        ...result,
        markdown: buildQualityRepairPromptMarkdown(result),
    });
}

function stripJsonCodeFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function unwrapRepairedStoryJson(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return parsed;
  if (!('repaired_story_json' in parsed)) return parsed;
  const wrapped = parsed as { repaired_story_json?: unknown };
  if (typeof wrapped.repaired_story_json === 'string') {
    return JSON.parse(stripJsonCodeFence(wrapped.repaired_story_json)) as unknown;
  }
  return wrapped.repaired_story_json;
}

function parseRepairedStoryJson(value: string): StoryGenerateResult {
  const parsed = unwrapRepairedStoryJson(JSON.parse(stripJsonCodeFence(value)) as unknown);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('repaired_story_json must be a JSON object');
  }
  const story = parsed as Partial<StoryGenerateResult>;
  if (typeof story.title !== 'string' || typeof story.full_text !== 'string') {
    throw new Error('repaired_story_json must include title and full_text');
  }
  if (!Array.isArray(story.scene_breakdown) || story.scene_breakdown.length === 0) {
    throw new Error('repaired_story_json must include a non-empty scene_breakdown');
  }
  return parsed as StoryGenerateResult;
}

function sameSceneIdSet(left: StoryGenerateResult['scene_breakdown'], right: StoryGenerateResult['scene_breakdown']): boolean {
  if (left.length !== right.length) return false;
  return left.every((scene, index) => scene.scene_id === right[index]?.scene_id);
}

function changedSceneIds(before: StoryGenerateResult, after: StoryGenerateResult): number[] {
  return after.scene_breakdown
    .filter((scene, index) => JSON.stringify(scene) !== JSON.stringify(before.scene_breakdown[index]))
    .map(scene => scene.scene_id);
}

function qualitySnapshotForApply(report: StoryQualityReport | undefined): StoryQualityRepairApplyResult['before_quality'] {
  return {
    passed: report?.passed ?? false,
    genre_score: report?.genre_score,
    issue_count: report?.issues.length ?? 0,
  };
}

function qualityImproved(before: StoryQualityRepairApplyResult['before_quality'], after: StoryQualityRepairApplyResult['after_quality']): boolean {
  if (after.passed && !before.passed) return true;
  if ((after.issue_count ?? 0) < (before.issue_count ?? 0)) return true;
  return (after.genre_score ?? 0) > (before.genre_score ?? 0);
}

const QUALITY_REPAIR_TOP_LEVEL_DIFF_FIELDS = [
  'title',
  'logline',
  'theme',
  'full_text',
  'scene_breakdown',
  'gears_segments',
  'quality_report',
] as const satisfies readonly (keyof StoryGenerateResult)[];

const QUALITY_REPAIR_SCENE_DIFF_FIELDS = [
  'title',
  'duration_sec',
  'location',
  'time_of_day',
  'dramatic_function',
  'plot',
  'key_action',
  'characters',
  'visual_prompt',
  'camera_suggestion',
  'cultural_note',
  'conflict',
  'dialogue_or_narration',
  'factual_basis',
  'fictionalized_elements',
] as const satisfies readonly (keyof StoryGenerateResult['scene_breakdown'][number])[];

const QUALITY_REPAIR_PROTECTED_SUMMARY_FIELDS = [
  'storyId',
  'project_id',
  'source_entry',
  'video_type',
  'presentation_style',
  'story_structure',
  'knowledge_pack',
  'material_pack',
  'creation_contract',
  'material_sufficiency',
] as const satisfies readonly (keyof StoryGenerateResult)[];

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedObjectFields<T extends object, K extends keyof T>(
  before: T,
  after: T,
  fields: readonly K[],
): string[] {
  return fields
    .filter(field => !sameJsonValue(before[field], after[field]))
    .map(field => String(field));
}

function sceneRepairPreview(scene: StoryGenerateResult['scene_breakdown'][number] | undefined): string {
  if (!scene) return '';
  return compactPayloadSummary([
    scene.title,
    scene.plot,
    scene.conflict,
    scene.dialogue_or_narration,
  ].filter(Boolean).join(' / '));
}

function hasOwnField<T extends object, K extends PropertyKey>(value: T, field: K): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function ignoredProtectedFieldChanges(before: StoryGenerateResult, attempted: StoryGenerateResult | undefined): string[] {
  if (!attempted || typeof attempted !== 'object') return [];
  const ignored = QUALITY_REPAIR_PROTECTED_SUMMARY_FIELDS
    .filter(field => hasOwnField(attempted, field) && !sameJsonValue(before[field], attempted[field]))
    .map(field => String(field));
  if (
    attempted.story_blueprint?.evidence_boundaries
    && before.story_blueprint?.evidence_boundaries
    && !sameJsonValue(before.story_blueprint.evidence_boundaries, attempted.story_blueprint.evidence_boundaries)
  ) {
    ignored.push('story_blueprint.evidence_boundaries');
  }
  return ignored;
}

function issueCompareKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function compactIssueList(items: string[], limit = 12): string[] {
  return items
    .map(item => compactPayloadSummary(item))
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, limit);
}

function buildQualityIssueDelta(before: StoryGenerateResult, after: StoryGenerateResult): StoryQualityRepairChangeSummary['quality_issue_delta'] {
  const beforeIssues = before.quality_report?.issues ?? [];
  const afterIssues = after.quality_report?.issues ?? [];
  const beforeKeys = new Set(beforeIssues.map(issueCompareKey));
  const afterKeys = new Set(afterIssues.map(issueCompareKey));
  return {
    resolved_issues: compactIssueList(beforeIssues.filter(issue => !afterKeys.has(issueCompareKey(issue)))),
    new_issues: compactIssueList(afterIssues.filter(issue => !beforeKeys.has(issueCompareKey(issue)))),
    remaining_issues: compactIssueList(afterIssues.filter(issue => beforeKeys.has(issueCompareKey(issue)))),
  };
}

function creationUseCaseLabel(useCase: CreationUseCase): string {
  const map: Record<CreationUseCase, string> = {
    original_ai_comic: '原创 AI 漫剧',
    adapted_ai_comic: '原作/资料改编',
    institutional_promo: '机构宣传片',
    documentary_short: '纪录短片',
    brand_commercial: '品牌商业片',
    education_training: '教育/培训片',
    public_service: '公益宣传片',
  };
  return map[useCase] ?? useCase;
}

function truthModeLabel(truthMode: TruthMode): string {
  const map: Record<TruthMode, string> = {
    fictional_original: '原创虚构',
    inspired_by_material: '素材启发',
    source_adaptation: '原作改编',
    factual_reconstruction: '事实重构',
    institutional_verified: '机构审定',
  };
  return map[truthMode] ?? truthMode;
}

function materialSufficiencyStageLabel(stage: MaterialSufficiencyReport['stage']): string {
  const map: Record<MaterialSufficiencyReport['stage'], string> = {
    minimum_viable_story: '最小可行故事',
    script_ready: '剧本可用',
    production_ready: '生产可用',
  };
  return map[stage] ?? stage;
}

function materialGenerationPostureLabel(posture?: MaterialSufficiencyReport['generation_posture']): string {
  if (!posture) return '未记录生成姿态';
  const map: Record<NonNullable<MaterialSufficiencyReport['generation_posture']>, string> = {
    ready: '可进入生产',
    draft_needs_verification: '草案待核验',
    script_ready_production_pending: '剧本可写，生产待补',
    blocked_until_input: '补材后再生成',
  };
  return map[posture] ?? posture;
}

function compactBoundaryItems(items: string[], limit = 2): string {
  const compacted = compactIssueList(items, limit);
  if (compacted.length === 0) return '';
  return `${compacted.join('；')}${items.length > limit ? ` 等 ${items.length} 项` : ''}`;
}

function buildQualityRepairChangeSummary(input: {
  before: StoryGenerateResult;
  attempted?: StoryGenerateResult;
  after: StoryGenerateResult;
  beforeQuality: StoryQualityRepairApplyResult['before_quality'];
  afterQuality: StoryQualityRepairApplyResult['after_quality'];
}): StoryQualityRepairChangeSummary {
  const { before, attempted, after, beforeQuality, afterQuality } = input;
  const changedTopLevelFields = changedObjectFields(before, after, QUALITY_REPAIR_TOP_LEVEL_DIFF_FIELDS);
  const sceneChanges = after.scene_breakdown.reduce<StoryQualityRepairChangeSummary['scene_changes']>((items, scene, index) => {
    const beforeScene = before.scene_breakdown[index];
    if (!beforeScene) return items;
    const changedFields = changedObjectFields(beforeScene, scene, QUALITY_REPAIR_SCENE_DIFF_FIELDS);
    if (changedFields.length === 0) return items;
    items.push({
      scene_id: scene.scene_id,
      title: scene.title || beforeScene.title,
      changed_fields: changedFields,
      before_preview: sceneRepairPreview(beforeScene),
      after_preview: sceneRepairPreview(scene),
    });
    return items;
  }, []);
  const beforeSegments = before.gears_segments ?? [];
  const changedGearsSegmentIds = (after.gears_segments ?? [])
    .filter((segment, index) => !sameJsonValue(segment, beforeSegments[index]))
    .map(segment => segment.segment_id);
  const protectedFieldsPreserved = QUALITY_REPAIR_PROTECTED_SUMMARY_FIELDS
    .filter(field => sameJsonValue(before[field], after[field]))
    .map(field => String(field));
  const ignoredProtectedChanges = ignoredProtectedFieldChanges(before, attempted);
  const genreScoreDelta = typeof beforeQuality.genre_score === 'number' && typeof afterQuality.genre_score === 'number'
    ? afterQuality.genre_score - beforeQuality.genre_score
    : undefined;
  const issueCountDelta = afterQuality.issue_count - beforeQuality.issue_count;
  const qualityIssueDelta = buildQualityIssueDelta(before, after);
  const hasContentChanges = changedTopLevelFields.some(field => field !== 'quality_report')
    || sceneChanges.length > 0
    || changedGearsSegmentIds.length > 0;
  const summaryLines = [
    `实质内容变化：${hasContentChanges ? '有' : '无'}`,
    changedTopLevelFields.length > 0
      ? `顶层字段变更：${changedTopLevelFields.join('、')}`
      : '未检测到顶层故事字段变更。',
    sceneChanges.length > 0
      ? `场景变更：${sceneChanges.map(scene => `${scene.scene_id}(${scene.changed_fields.join('/')})`).join('、')}`
      : '未检测到场景字段变更。',
    changedGearsSegmentIds.length > 0
      ? `GEARS 段变更：${changedGearsSegmentIds.join('、')}`
      : '未检测到 GEARS 段变更。',
    typeof genreScoreDelta === 'number'
      ? `类型分变化：${genreScoreDelta >= 0 ? '+' : ''}${genreScoreDelta}`
      : '类型分变化：n/a',
    `问题数变化：${issueCountDelta >= 0 ? '+' : ''}${issueCountDelta}`,
    `问题差异：解决 ${qualityIssueDelta.resolved_issues.length}，新增 ${qualityIssueDelta.new_issues.length}，仍存在 ${qualityIssueDelta.remaining_issues.length}`,
    ignoredProtectedChanges.length > 0
      ? `已忽略保护字段改动：${ignoredProtectedChanges.join('、')}`
      : '未检测到保护字段被模型改动。',
  ];

  return {
    has_content_changes: hasContentChanges,
    changed_top_level_fields: changedTopLevelFields,
    scene_changes: sceneChanges,
    changed_gears_segment_ids: changedGearsSegmentIds,
    protected_fields_preserved: protectedFieldsPreserved,
    ignored_protected_field_changes: ignoredProtectedChanges,
    quality_issue_delta: qualityIssueDelta,
    quality_delta: {
      passed_changed: beforeQuality.passed !== afterQuality.passed,
      genre_score_delta: genreScoreDelta,
      issue_count_delta: issueCountDelta,
    },
    summary_lines: summaryLines,
  };
}

function buildQualityRepairOperatorHints(input: {
  applied: boolean;
  canApply: boolean;
  rejectedReason?: string;
  changeSummary: StoryQualityRepairChangeSummary;
  beforeQuality: StoryQualityRepairApplyResult['before_quality'];
  afterQuality: StoryQualityRepairApplyResult['after_quality'];
  creationContract?: CreationContract;
  materialSufficiency?: MaterialSufficiencyReport;
}): string[] {
  const hints: string[] = [];
  if (input.applied) {
    hints.push('已写入 quality_repair 新版本；如需继续调整，请基于最新版本重新生成修复提示包。');
  } else if (input.canApply) {
    hints.push('校验通过，可在确认字段/场景差异后执行“安全写入新版本”。');
  } else {
    hints.push(input.rejectedReason ?? '未达到默认写入门槛；请让模型继续减少问题、提升类型分或说明为何需要 allow_no_improvement。');
  }
  if (
    input.changeSummary.changed_top_level_fields.length === 0
    && input.changeSummary.scene_changes.length === 0
    && input.changeSummary.changed_gears_segment_ids.length === 0
  ) {
    hints.push('未检测到实质内容差异；不建议写入新版本。');
  }
  if (input.changeSummary.scene_changes.length > 0 && input.changeSummary.changed_gears_segment_ids.length === 0) {
    hints.push('场景已有改动但 GEARS 段未同步变化；写入后请复核分镜/交付字段是否仍与场景一致。');
  }
  if (input.changeSummary.ignored_protected_field_changes.length > 0) {
    hints.push(`模型尝试修改保护字段，已忽略：${input.changeSummary.ignored_protected_field_changes.join('、')}。`);
  }
  if (input.changeSummary.quality_issue_delta.resolved_issues.length > 0) {
    hints.push(`已解决 ${input.changeSummary.quality_issue_delta.resolved_issues.length} 个旧问题；请确认改动没有突破创作合同。`);
  }
  if (input.changeSummary.quality_issue_delta.new_issues.length > 0) {
    hints.push(`重校验新增 ${input.changeSummary.quality_issue_delta.new_issues.length} 个诊断；写入前请优先查看新增问题。`);
  }
  if (input.changeSummary.quality_delta.issue_count_delta > 0) {
    hints.push('重校验后问题数量增加；可能是质量检查发现了更细的风险，写入前请阅读新增问题。');
  }
  if (!input.afterQuality.passed) {
    hints.push('修复后质量仍未通过；建议继续让模型针对剩余 repair actions 迭代。');
  }
  if (input.creationContract) {
    const contract = input.creationContract;
    hints.push(`创作合同边界：${creationUseCaseLabel(contract.creation_use_case)} / ${truthModeLabel(contract.truth_mode)}；修复不得改写创作用途、真实度模式、客户目标或成片类型。`);
    if (contract.must_verify.length > 0) {
      hints.push(`真实度边界：仍有 ${contract.must_verify.length} 项待核验（${compactBoundaryItems(contract.must_verify)}）；修复不得把待核验内容写成确定事实。`);
    }
    if (contract.forbidden_moves.length > 0) {
      hints.push(`禁止表达边界：${compactBoundaryItems(contract.forbidden_moves)}；写入前确认模型没有引入这些表达。`);
    }
  }
  if (input.materialSufficiency) {
    const material = input.materialSufficiency;
    const stage = material.active_stage ?? material.stage;
    hints.push(`素材 Gate：当前可推进到${materialSufficiencyStageLabel(stage)}，评分 ${material.score}/100，生成姿态为“${materialGenerationPostureLabel(material.generation_posture)}”。`);
    if (material.blocked) {
      hints.push('素材 Gate 当前阻断；质量修复只能整理现有内容，不应新增未提供的关键事实、机构数据或原作情节。');
    } else if (material.needs_verification || material.can_generate_with_risks) {
      hints.push('素材 Gate 标记为需核验；写入前请检查模型没有把草案、推测或影视化补足改成确定事实。');
    }
    const blockingMissing = material.missing_items.filter(item => item.blocking_level === 'blocking');
    if (blockingMissing.length > 0) {
      hints.push(`阻断素材缺口：${blockingMissing.slice(0, 2).map(item => item.label).join('、')}${blockingMissing.length > 2 ? ` 等 ${blockingMissing.length} 项` : ''}。`);
    }
  }
  return [...new Set(hints)];
}

function buildQualityRepairValidationMarkdown(input: {
  projectId: string;
  storyId: string;
  applied: boolean;
  canApply: boolean;
  rejectedReason?: string;
  beforeQuality: StoryQualityRepairApplyResult['before_quality'];
  afterQuality: StoryQualityRepairApplyResult['after_quality'];
  changeSummary: StoryQualityRepairChangeSummary;
  operatorHints: string[];
  creationContract?: CreationContract;
  materialSufficiency?: MaterialSufficiencyReport;
}): string {
  const contractBoundary = input.creationContract
    ? [
        `- use_case: ${input.creationContract.creation_use_case} (${creationUseCaseLabel(input.creationContract.creation_use_case)})`,
        `- truth_mode: ${input.creationContract.truth_mode} (${truthModeLabel(input.creationContract.truth_mode)})`,
        `- must_verify: ${input.creationContract.must_verify.length}`,
        ...input.creationContract.must_verify.slice(0, 5).map(item => `  - ${item}`),
        `- forbidden_moves: ${input.creationContract.forbidden_moves.length}`,
        ...input.creationContract.forbidden_moves.slice(0, 5).map(item => `  - ${item}`),
      ]
    : ['- creation_contract: none'];
  const materialBoundary = input.materialSufficiency
    ? [
        `- material_stage: ${input.materialSufficiency.stage}`,
        `- active_stage: ${input.materialSufficiency.active_stage ?? 'none'}`,
        `- material_score: ${input.materialSufficiency.score}`,
        `- generation_posture: ${input.materialSufficiency.generation_posture ?? 'none'}`,
        `- blocked: ${input.materialSufficiency.blocked}`,
        `- needs_verification: ${input.materialSufficiency.needs_verification === true}`,
        `- missing_items: ${input.materialSufficiency.missing_items.length}`,
        ...input.materialSufficiency.missing_items.slice(0, 5).map(item => `  - ${item.label}: ${item.reason}`),
      ]
    : ['- material_sufficiency: none'];
  return [
    '# Story Quality Repair Validation',
    '',
    `- project: ${input.projectId}`,
    `- story: ${input.storyId}`,
    `- applied: ${input.applied}`,
    `- can_apply: ${input.canApply}`,
    `- before_score: ${input.beforeQuality.genre_score ?? 'n/a'}`,
    `- after_score: ${input.afterQuality.genre_score ?? 'n/a'}`,
    `- before_issue_count: ${input.beforeQuality.issue_count}`,
    `- after_issue_count: ${input.afterQuality.issue_count}`,
    ...(input.rejectedReason ? [`- rejected_reason: ${input.rejectedReason}`] : []),
    '',
    '## Operator Hints',
    '',
    ...input.operatorHints.map(item => `- ${item}`),
    '',
    '## Change Summary',
    '',
    ...input.changeSummary.summary_lines.map(item => `- ${item}`),
    '',
    '## Contract And Material Boundaries',
    '',
    ...contractBoundary,
    '',
    ...materialBoundary,
    '',
    '## Quality Issues',
    '',
    `- resolved: ${input.changeSummary.quality_issue_delta.resolved_issues.length}`,
    ...input.changeSummary.quality_issue_delta.resolved_issues.map(item => `  - ${item}`),
    `- new: ${input.changeSummary.quality_issue_delta.new_issues.length}`,
    ...input.changeSummary.quality_issue_delta.new_issues.map(item => `  - ${item}`),
    `- remaining: ${input.changeSummary.quality_issue_delta.remaining_issues.length}`,
    ...input.changeSummary.quality_issue_delta.remaining_issues.map(item => `  - ${item}`),
    '',
    '## Scene Changes',
    '',
    ...(input.changeSummary.scene_changes.length > 0
      ? input.changeSummary.scene_changes.flatMap(scene => [
          `### Scene ${scene.scene_id}${scene.title ? ` - ${scene.title}` : ''}`,
          '',
          `- fields: ${scene.changed_fields.join(', ')}`,
          `- before: ${scene.before_preview}`,
          `- after: ${scene.after_preview}`,
          '',
        ])
      : ['- none', '']),
    '## Protected Fields',
    '',
    `- preserved: ${input.changeSummary.protected_fields_preserved.join(', ') || 'none'}`,
    `- ignored_changes: ${input.changeSummary.ignored_protected_field_changes.join(', ') || 'none'}`,
  ].join('\n');
}

function buildQualityRepairApplyResponse(input: Omit<
  StoryQualityRepairApplyResult,
  'schema_version' | 'operator_hints' | 'validation_summary_markdown'
> & {
  creationContract?: CreationContract;
  materialSufficiency?: MaterialSufficiencyReport;
}): StoryQualityRepairApplyResult {
  const {
    creationContract,
    materialSufficiency,
    ...resultInput
  } = input;
  const operatorHints = buildQualityRepairOperatorHints({
    applied: resultInput.applied,
    canApply: resultInput.can_apply,
    rejectedReason: resultInput.rejected_reason,
    changeSummary: resultInput.change_summary,
    beforeQuality: resultInput.before_quality,
    afterQuality: resultInput.after_quality,
    creationContract,
    materialSufficiency,
  });
  return {
    schema_version: 'story-quality-repair-apply/v1',
    ...resultInput,
    operator_hints: operatorHints,
    validation_summary_markdown: buildQualityRepairValidationMarkdown({
      projectId: resultInput.project_id,
      storyId: resultInput.story_id,
      applied: resultInput.applied,
      canApply: resultInput.can_apply,
      rejectedReason: resultInput.rejected_reason,
      beforeQuality: resultInput.before_quality,
      afterQuality: resultInput.after_quality,
      changeSummary: resultInput.change_summary,
      operatorHints,
      creationContract,
      materialSufficiency,
    }),
  };
}

function normalizeRepairedStoryCandidate(
  current: StoryGenerateResult,
  repaired: StoryGenerateResult,
  projectId: string,
): StoryGenerateResult {
  const storyBlueprint = repaired.story_blueprint
    ? {
        ...repaired.story_blueprint,
        evidence_boundaries: current.story_blueprint?.evidence_boundaries ?? repaired.story_blueprint.evidence_boundaries,
      }
    : current.story_blueprint;
  return {
    ...current,
    ...repaired,
    storyId: current.storyId,
    project_id: projectId,
    current_version_id: current.current_version_id,
    source_entry: current.source_entry,
    video_type: current.video_type,
    presentation_style: current.presentation_style,
    story_structure: current.story_structure,
    story_blueprint: storyBlueprint,
    knowledge_pack: current.knowledge_pack,
    material_pack: current.material_pack,
    creation_use_case: current.creation_use_case,
    truth_mode: current.truth_mode,
    client_type: current.client_type,
    target_audience: current.target_audience,
    communication_goal: current.communication_goal,
    creation_contract: current.creation_contract,
    material_sufficiency: current.material_sufficiency,
    credibility_note: current.credibility_note,
    generation_source: current.generation_source,
    generation_mode: current.generation_mode,
    generation_used_fallback: current.generation_used_fallback,
  };
}

function revalidateRepairedStory(story: StoryGenerateResult): StoryGenerateResult {
  const normalized = normalizeStoryGenerationFields(story);
  const baseQualityReport = normalized.story_structure === 'memory_mosaic_biography'
    ? validateMemoryMosaicStory({
        full_text: normalized.full_text,
        scene_breakdown: normalized.scene_breakdown,
        memory_seed: normalized.memory_mosaic_seed,
      })
    : validateDramaticStory({
        full_text: normalized.full_text,
        scene_breakdown: normalized.scene_breakdown,
        title: normalized.title,
        selectedEvent: normalized.story_blueprint?.central_event ?? normalized.title,
        videoType: normalized.video_type,
      });
  const narrativePatternIds = normalized.creation_contract?.narrative_pattern_ids ?? [];
  let qualityReport: StoryQualityReport = validateGenreStoryQuality({
    story: normalized,
    baseReport: baseQualityReport,
    blueprint: normalized.story_blueprint,
    narrativePatternIds,
  });
  normalized.gears_delivery = ensureGearsDeliveryPackage(normalized);
  qualityReport = enrichStoryQualityReport({
    story: normalized,
    qualityReport,
    narrativePatternIds,
    gearsDelivery: normalized.gears_delivery,
  });
  normalized.quality_report = {
    ...qualityReport,
    truth_mode: normalized.truth_mode,
    material_sufficiency_report: normalized.material_sufficiency,
  };
  return normalized;
}

export async function applyProjectQualityRepairJson(
  projectId: string,
  request: StoryQualityRepairApplyRequest,
): Promise<ApiResponse<StoryQualityRepairApplyResult>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detailResult.error?.message ?? `Project "${projectId}" not found`,
      detailResult.error?.details,
    );
  }

  const { project, current_story } = detailResult.data;
  let parsed: StoryGenerateResult;
  try {
    parsed = parseRepairedStoryJson(request.repaired_story_json);
  } catch (error) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      error instanceof Error ? error.message : 'repaired_story_json is not valid JSON',
    );
  }

  if (parsed.storyId && parsed.storyId !== current_story.storyId) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'repaired_story_json storyId does not match current project story');
  }
  if (parsed.video_type && parsed.video_type !== current_story.video_type) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'repaired_story_json video_type does not match current project story');
  }
  if (!sameSceneIdSet(current_story.scene_breakdown, parsed.scene_breakdown)) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'repaired_story_json must keep the same scene_id order and count');
  }

  const candidate = revalidateRepairedStory(normalizeRepairedStoryCandidate(current_story, parsed, project.project_id));
  const beforeQuality = qualitySnapshotForApply(current_story.quality_report as StoryQualityReport | undefined);
  const afterQuality = qualitySnapshotForApply(candidate.quality_report as StoryQualityReport | undefined);
  const sceneIdsChanged = changedSceneIds(current_story, candidate);
  const changeSummary = buildQualityRepairChangeSummary({
    before: current_story,
    attempted: parsed,
    after: candidate,
    beforeQuality,
    afterQuality,
  });
  const repairBoundaryContext = {
    creationContract: current_story.creation_contract,
    materialSufficiency: current_story.material_sufficiency ?? current_story.creation_contract?.material_sufficiency,
  };
  const qualityGatePassed = request.allow_no_improvement === true || qualityImproved(beforeQuality, afterQuality);
  const canApply = changeSummary.has_content_changes && qualityGatePassed;
  const rejectedReason = !changeSummary.has_content_changes
    ? '修复 JSON 未产生实质内容变化，不建议写入。'
    : '修复 JSON 未改善质量分或问题数量，默认不建议写入。';
  const trace: StoryRepairTrace = {
    trace_id: `${current_story.storyId}--quality-repair-json-${Date.now()}`,
    attempted: true,
    applied: false,
    reason: canApply
      ? 'quality_repair_json_validated'
      : changeSummary.has_content_changes
        ? 'quality_repair_json_not_improved'
        : 'quality_repair_json_no_content_changes',
    before_genre_score: beforeQuality.genre_score,
    after_genre_score: afterQuality.genre_score,
    actions: [request.user_instruction?.trim() || 'apply repaired_story_json from Web quality prompt'],
  };
  if (!request.apply) {
    return success(buildQualityRepairApplyResponse({
      project_id: project.project_id,
      story_id: current_story.storyId,
      applied: false,
      can_apply: canApply,
      rejected_reason: canApply ? undefined : rejectedReason,
      changed_scene_ids: sceneIdsChanged,
      before_quality: beforeQuality,
      after_quality: afterQuality,
      change_summary: changeSummary,
      repair_trace: trace,
      ...repairBoundaryContext,
    }));
  }

  if (!canApply) {
    return success(buildQualityRepairApplyResponse({
      project_id: project.project_id,
      story_id: current_story.storyId,
      applied: false,
      can_apply: false,
      rejected_reason: !changeSummary.has_content_changes
        ? '修复 JSON 未产生实质内容变化，未写入新版本。'
        : '修复 JSON 未改善质量分或问题数量，未写入新版本。',
      changed_scene_ids: sceneIdsChanged,
      before_quality: beforeQuality,
      after_quality: afterQuality,
      change_summary: changeSummary,
      repair_trace: trace,
      ...repairBoundaryContext,
    }));
  }

  const appliedTrace: StoryRepairTrace = {
    ...trace,
    applied: true,
    reason: 'quality_repair_json_applied',
  };
  const storyToPersist: StoryGenerateResult = {
    ...candidate,
    repair_trace: [...(candidate.repair_trace ?? []), appliedTrace],
  };
  await persistProjectVersion(
    project,
    storyToPersist,
    'quality_repair',
    sceneIdsChanged.length > 0 ? sceneIdsChanged : current_story.scene_breakdown.map(scene => scene.scene_id),
    request.user_instruction?.trim() || '应用模型修复 JSON',
  );
  const nextDetail = await getProject(projectId);
  return success(buildQualityRepairApplyResponse({
    project_id: project.project_id,
    story_id: current_story.storyId,
    applied: true,
    can_apply: true,
    changed_scene_ids: sceneIdsChanged,
    before_quality: beforeQuality,
    after_quality: afterQuality,
    change_summary: changeSummary,
    repair_trace: appliedTrace,
    detail: nextDetail.ok && nextDetail.data ? nextDetail.data : undefined,
    ...repairBoundaryContext,
  }));
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
  const materialRefresh = applySupplementTaskMaterialUpdate(
    current_story,
    updatedTasks[taskIndex],
    request.supplement_note?.trim(),
    updatedAt,
  );
  const updatedStory: StoryGenerateResult = {
    ...current_story,
    supplement_tasks: updatedTasks,
    ...materialRefresh,
  };
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
    material_sufficiency: updatedStory.material_sufficiency ?? project.material_sufficiency,
    creation_contract: updatedStory.creation_contract ?? project.creation_contract,
  };
  const currentPath = projectVersionPath(projectId, project.current_version_id);

  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(currentPath);
  await writeJsonFile(currentPath, {
    ...snapshot,
    quality_report: updatedStory.quality_report ?? snapshot.quality_report,
    story: updatedStory,
  });
  await writeJsonFile(projectMetaPath(projectId), updatedMeta);

  await updateSourceStory(updatedStory, raw => ({
    ...raw,
    supplement_tasks: updatedTasks,
    ...materialRefresh,
    project_id: updatedStory.project_id,
    current_version_id: updatedStory.current_version_id,
  }));

  return getProject(projectId);
}

export async function addProjectMaterialPackMaterial(
  projectId: string,
  request: ProjectMaterialPackAddMaterialRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return detailResult;
  }

  const { project, current_story } = detailResult.data;
  const updatedAt = new Date().toISOString();
  const materialPack = buildMaterialPackWithManualMaterial(current_story, request, updatedAt);
  const materialRefresh = refreshStoryMaterialContract(current_story, materialPack);
  const updatedStory: StoryGenerateResult = {
    ...current_story,
    ...materialRefresh,
  };
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
    material_sufficiency: updatedStory.material_sufficiency ?? project.material_sufficiency,
    creation_contract: updatedStory.creation_contract ?? project.creation_contract,
  };
  const currentPath = projectVersionPath(projectId, project.current_version_id);
  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(currentPath);

  await writeJsonFile(currentPath, {
    ...snapshot,
    quality_report: updatedStory.quality_report ?? snapshot.quality_report,
    story: updatedStory,
  });
  await writeJsonFile(projectMetaPath(projectId), updatedMeta);

  await updateSourceStory(updatedStory, raw => ({
    ...raw,
    ...materialRefresh,
    project_id: updatedStory.project_id,
    current_version_id: updatedStory.current_version_id,
  }));

  return getProject(projectId);
}

function applySupplementTaskMaterialUpdate(
  story: StoryGenerateResult,
  task: NonNullable<StoryGenerateResult['supplement_tasks']>[number],
  supplementNote: string | undefined,
  updatedAt: string,
): Partial<StoryGenerateResult> {
  if (task.status !== 'resolved' || !supplementNote) return {};
  const materialPack = buildMaterialPackWithSupplement(story, task, supplementNote, updatedAt);
  return refreshStoryMaterialContract(story, materialPack);
}

function refreshStoryMaterialContract(
  story: StoryGenerateResult,
  materialPack: MaterialPack,
): Partial<StoryGenerateResult> {
  const creationUseCase = story.creation_use_case
    ?? story.creation_contract?.creation_use_case
    ?? inferCreationUseCaseFromStory(story);
  const truthMode = story.truth_mode
    ?? story.creation_contract?.truth_mode
    ?? inferTruthModeFromStory(story, creationUseCase);
  const materialSufficiency = buildMaterialSufficiencyReport({
    materialPack,
    creationUseCase,
    truthMode,
  });
  const storyStructure = story.story_structure
    ?? story.creation_contract?.story_structure
    ?? inferStoryStructureFromStory(story);
  const knowledgePack = knowledgePackFromMaterialPack(materialPack) ?? story.knowledge_pack;
  const creationContract = buildCreationContract({
    request: {
      entry_name: story.source_entry,
      creation_use_case: creationUseCase,
      truth_mode: truthMode,
      client_type: story.client_type,
      target_audience: story.target_audience,
      communication_goal: story.communication_goal,
      material_pack: materialPack,
      knowledge_pack: knowledgePack,
      story_structure: storyStructure,
    },
    materialSufficiency,
    creationUseCase,
    truthMode,
    videoType: story.video_type,
    presentationStyle: story.presentation_style,
    storyStructure,
    narrativePatternIds: story.creation_contract?.narrative_pattern_ids ?? [],
  });
  return {
    material_pack: materialPack,
    knowledge_pack: knowledgePack,
    creation_use_case: creationUseCase,
    truth_mode: truthMode,
    material_sufficiency: materialSufficiency,
    creation_contract: creationContract,
    quality_report: story.quality_report
      ? {
        ...story.quality_report,
        truth_mode: truthMode,
        material_sufficiency_report: materialSufficiency,
      }
      : story.quality_report,
  };
}

function buildMaterialPackWithManualMaterial(
  story: StoryGenerateResult,
  request: ProjectMaterialPackAddMaterialRequest,
  updatedAt: string,
): MaterialPack {
  const base = materialPackForStory(story);
  const target = request.target ?? 'supporting_materials';
  const title = request.title.trim();
  const summary = request.summary.trim();
  const materialId = nextMaterialId(base, `manual-${safeMaterialIdPart(title)}`);
  const confidence = request.confidence ?? (request.mark_as_verified_fact ? 0.78 : 0.66);
  const entry: MaterialPackEntry = {
    material_id: materialId,
    title,
    summary,
    source_type: request.source_type ?? 'manual_note',
    purpose: uniqueMaterialPurposes(request.purpose),
    confidence,
    role_in_story: request.role_in_story?.trim() || undefined,
    provenance: request.provenance?.trim() || `项目素材包手动新增于 ${updatedAt}`,
    linked_entry_name: request.linked_entry_name?.trim() || story.source_entry,
    tags: uniqueStrings([
      ...(request.tags ?? []),
      targetMaterialPackLabel(target),
      'manual_material',
    ]),
  };
  const missingNeedId = request.remove_missing_need_id?.trim();
  const factLine = `${title}：${summary}`;
  return {
    ...base,
    [target]: [
      ...base[target].filter(item => item.material_id !== materialId),
      entry,
    ],
    verified_facts: request.mark_as_verified_fact
      ? uniqueStrings([...base.verified_facts, factLine])
      : base.verified_facts,
    uncertain_claims: missingNeedId
      ? base.uncertain_claims.filter(claim => !claim.includes(missingNeedId) && !claim.includes(title))
      : base.uncertain_claims,
    creative_space: uniqueStrings([
      ...base.creative_space,
      `新增项目素材「${title}」已纳入${targetMaterialPackLabel(target)}，后续蓝图与剧本可按用途标签调用。`,
    ]),
    missing_needs: missingNeedId
      ? base.missing_needs.filter(need => need.need_id !== missingNeedId && !need.need_id.includes(missingNeedId))
      : base.missing_needs,
    overall_confidence: Math.min(1, Math.max(base.overall_confidence, confidence)),
  };
}

function buildMaterialPackWithSupplement(
  story: StoryGenerateResult,
  task: NonNullable<StoryGenerateResult['supplement_tasks']>[number],
  supplementNote: string,
  updatedAt: string,
): MaterialPack {
  const base = materialPackForStory(story);
  const materialId = `supplement-${safeMaterialIdPart(task.need_id || task.task_id)}`;
  const entry: MaterialPackEntry = {
    material_id: materialId,
    title: task.label,
    summary: supplementNote,
    source_type: 'manual_note',
    purpose: materialPurposesForSupplementTask(task),
    confidence: task.blocking_level === 'optional' ? 0.65 : 0.75,
    role_in_story: task.description,
    provenance: `素材补充任务 ${task.task_id} resolved at ${updatedAt}`,
    linked_entry_name: story.source_entry,
    tags: ([
      task.stage,
      task.blocking_level,
      task.source,
      task.category,
    ].filter(Boolean) as string[]),
  };
  const supporting = [
    ...base.supporting_materials.filter(item => item.material_id !== materialId),
    entry,
  ];
  const missingNeeds = base.missing_needs.filter(need => !supplementTaskMatchesNeed(task, need));
  const uncertainClaims = base.uncertain_claims.filter(claim => !claim.includes(task.label) && !claim.includes(task.need_id));
  const factLine = `${task.label}：${supplementNote}`;
  return {
    ...base,
    supporting_materials: supporting,
    missing_needs: missingNeeds,
    verified_facts: uniqueStrings([
      ...base.verified_facts,
      factLine,
    ]),
    uncertain_claims: uncertainClaims,
    creative_space: uniqueStrings([
      ...base.creative_space,
      `补充素材「${task.label}」可用于${task.affects?.join('、') || '故事和剧本'}，仍需按真实度模式标注来源边界。`,
    ]),
    overall_confidence: Math.min(1, Math.max(base.overall_confidence, (base.overall_confidence + 0.1))),
  };
}

function materialPackForStory(story: StoryGenerateResult): MaterialPack {
  return story.material_pack
    ?? (story.knowledge_pack ? materialPackFromKnowledgePack(story.knowledge_pack, {
      original_user_query: story.original_user_query,
      client_type: story.client_type,
    }) : emptyMaterialPack(story));
}

function emptyMaterialPack(story: StoryGenerateResult): MaterialPack {
  return {
    schema_version: 'material-pack/v1',
    primary_materials: [],
    supporting_materials: [],
    reference_materials: [],
    visual_assets: [],
    verified_facts: story.credibility_note ? [story.credibility_note] : [],
    uncertain_claims: [],
    creative_space: ['由项目补充任务逐步沉淀素材，不把未核实补充直接写成确定事实。'],
    missing_needs: [],
    overall_confidence: 0.55,
    token_budget_summary: {
      strategy: '补充任务写回 material_pack.supporting_materials，后续生成优先读取结构化素材。',
    },
  };
}

function materialPurposesForSupplementTask(
  task: NonNullable<StoryGenerateResult['supplement_tasks']>[number],
): MaterialPurpose[] {
  const purposes = new Set<MaterialPurpose>();
  const signal = `${task.need_id} ${task.label} ${task.description}`;
  if (task.category === 'supporting_character' || task.category === 'person_experience' || /人物|主角|配角|角色|见证人/.test(signal)) purposes.add('character_source');
  if (task.category === 'regional_context' || /地域|地方|区域|地点|场景/.test(signal)) purposes.add('regional_context');
  if (task.category === 'cultural_background' || /文化|习俗|背景/.test(signal)) purposes.add('cultural_background');
  if (task.category === 'event_process' || /事件|过程|事实|史实|数据/.test(signal)) purposes.add('fact_basis');
  if (task.category === 'architecture_detail' || /建筑|古迹|空间|画面|视觉/.test(signal)) {
    purposes.add('visual_asset');
    purposes.add('regional_context');
  }
  for (const affect of task.affects ?? []) {
    if (/asset|visual|production|prompt|handoff|画面|视觉/.test(affect)) purposes.add('visual_asset');
    if (/credibility|quality|fact|script|full_text|blueprint/.test(affect)) purposes.add('fact_basis');
  }
  if (task.stage === 'production_ready') purposes.add('visual_asset');
  if (task.source === 'material_sufficiency_missing_item') purposes.add('creative_boundary');
  if (task.source === 'production_material_missing_field') {
    purposes.add('visual_asset');
    purposes.add('creative_boundary');
  }
  if (purposes.size === 0) purposes.add('fact_basis');
  return [...purposes];
}

function uniqueMaterialPurposes(purposes: MaterialPurpose[]): MaterialPurpose[] {
  const unique = [...new Set(purposes)];
  return unique.length > 0 ? unique : ['fact_basis'];
}

function nextMaterialId(materialPack: MaterialPack, baseId: string): string {
  const existingIds = new Set([
    ...materialPack.primary_materials,
    ...materialPack.supporting_materials,
    ...materialPack.reference_materials,
  ].map(material => material.material_id));
  if (!existingIds.has(baseId)) return baseId;
  let index = 2;
  while (existingIds.has(`${baseId}-${index}`)) {
    index += 1;
  }
  return `${baseId}-${index}`;
}

function targetMaterialPackLabel(target: ProjectMaterialPackAddMaterialRequest['target']): string {
  if (target === 'primary_materials') return '主素材';
  if (target === 'reference_materials') return '参考素材';
  return '支撑素材';
}

function supplementTaskMatchesNeed(
  task: NonNullable<StoryGenerateResult['supplement_tasks']>[number],
  need: { need_id: string; label: string },
): boolean {
  return task.need_id === need.need_id
    || task.need_id.includes(need.need_id)
    || task.label === need.label;
}

function safeMaterialIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}

function uniqueStrings(items: string[]): string[] {
  return items.filter((item, index, array) => item.trim() && array.indexOf(item) === index);
}

function inferCreationUseCaseFromStory(story: StoryGenerateResult): CreationUseCase {
  if (story.video_type === 'ai_comic_drama') return 'original_ai_comic';
  if (story.video_type === 'documentary_short') return 'documentary_short';
  if (story.video_type === 'education_training') return 'education_training';
  if (story.video_type === 'city_brand_promo' || story.video_type === 'social_short') return 'brand_commercial';
  return 'institutional_promo';
}

function inferTruthModeFromStory(story: StoryGenerateResult, creationUseCase: CreationUseCase): TruthMode {
  if (creationUseCase === 'original_ai_comic') return 'fictional_original';
  if (creationUseCase === 'documentary_short' || story.video_type === 'documentary_short') return 'factual_reconstruction';
  if (['institutional_promo', 'education_training', 'public_service'].includes(creationUseCase)) return 'institutional_verified';
  return 'inspired_by_material';
}

function inferStoryStructureFromStory(story: StoryGenerateResult): StoryStructureType {
  if (story.video_type === 'documentary_short') return 'case_reconstruction';
  if (story.video_type === 'heritage_promo') return 'object_clue_journey';
  if (story.video_type === 'explainer_video' || story.video_type === 'lecture_video') return 'lecture_argument';
  return 'single_event_drama';
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
