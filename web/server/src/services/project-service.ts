import { dirname, resolve } from 'node:path';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { storyGeneratedRoot, storyKbRoot } from '../platform/story-storage-root.js';
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
  AssetIngestReport,
  MediaAssetReviewUpdateRequest,
  MediaAssetReviewUpdateResult,
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
  GearsExternalCallbackHandoffPackage,
  GearsExternalCallbackImportResult,
  GearsExternalCallbackPreflightIssue,
  GearsExternalCallbackPreflightItem,
  GearsExternalCallbackPreflightResult,
  GearsJobCallbackRequest,
  GearsJobCallbackResult,
  GearsJobLedger,
  GearsJobLedgerItem,
  GearsJobLocalAcceptanceRequest,
  GearsJobLocalAcceptanceResult,
  GearsJobStatusSyncRequest,
  GearsJobStatusSyncResult,
  GearsJobSubmitFailure,
  GearsJobSubmitRequest,
  GearsJobSubmitResult,
  ProjectKnowledgeCandidateExportPackage,
  ProjectKnowledgeWritebackPatchPackage,
  ProjectSupplementCandidateExportPackage,
  ProjectDraftProductionMaterialFieldsResult,
  ProjectSupplementTaskListItem,
  ProjectSeedanceAssetPlaceholderResult,
  SeedanceAssetBatchImportRequest,
  SeedanceAssetBatchImportResult,
  SeedanceAssetBindingItem,
  SeedanceAssetFileUploadResult,
  SeedanceAssetReuseRequest,
  SeedanceAssetReuseResult,
  SeedanceGlobalAssetLibrary,
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
  SeedanceShotProviderRetryPlanRequest,
  SeedanceShotProviderRetryPlanResult,
  SeedanceShotProviderRetrySubmitRequest,
  SeedanceShotProviderRetrySubmitResult,
  SeedanceShotRetryPackage,
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
  KnowledgeSupplementTask,
  KnowledgeSupplementTaskUpdateRequest,
  KnowledgeSupplementTaskStatus,
  KnowledgeWritebackStatus,
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
  GearsWebhookStatus,
  GearsVideoResult,
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
import { inspectMediaAssetUpload } from './asset-ingest-service.js';
import { ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { enrichStoryQualityReport } from './quality-workflow-service.js';
import {
  rebuildDerivedStoryState,
  StoryDerivedStateValidationError,
} from './derived-story-state-service.js';
import { buildProductionMaterialReadinessReport } from './production-material-readiness-service.js';
import { repairStoryWithQualityWorkflow } from './quality-repair-service.js';
import { validateGenreStoryQuality } from './genre-quality-service.js';
import { getStoryFamilyRepairGuidance, validateStoryFamilyBaseQuality } from './story-family-quality-service.js';
import {
  buildStoryProductionBoard,
  seedanceShotProductionId,
  syncSeedanceShotLedgerWithShots,
} from './production-board-service.js';
import { buildProductionReadinessAutomationPlan } from './production-readiness-automation.js';
import { resolveStoryProjectWorkflow } from '@shared/project-workflow.js';
import type { ProductResourceOwnership } from '@shared/product-access.js';
import { FileArtifactStore } from '../repositories/artifact-store.js';
import { revalidateStoryDomainRevision } from '../platform/story-domain-revision-safety.js';
import {
  formatStoryDomainEditPersistenceBoundary,
  getStoryDomainRevisionEditBoundary,
  getStoryDomainSupplementEditBoundary,
  isStoryDomainEditPersistenceBoundarySafe,
  type StoryDomainSupplementEditBoundary,
} from '../platform/story-domain-edit-boundary.js';
import { resolveStorySourceDomain } from '../platform/story-source-domain.js';
import { planStoryDomainKnowledgeWriteback } from '../platform/story-domain-knowledge-writeback.js';
import { getStoryDomainProductionMaterialGuidance } from '../platform/story-domain-production-material-guidance.js';
import type { DomainProductionMaterialGuidance } from '../platform/domain-pack.js';
import { repairStoryWithProductionBoard } from './production-board-repair-service.js';
import {
  buildGearsLedgerItem,
  buildGearsExecutionOperationalMetrics,
  buildGearsExecutionRecoveryPlan,
  buildLocalGearsJobId,
  buildRejectedGearsLedgerItem,
  gearsProjectCallbackPath,
  gearsProjectCallbackUrl,
  gearsCallbackEventIsDuplicate,
  gearsCallbackBatchPath,
  extractGearsJobCallbackRequests,
  markGearsLedgerPollFailures,
  mergeGearsLedgerItems,
  normalizeGearsJobCallback,
  normalizeGearsJobLedger,
  pollGearsExecutionJobStatuses,
  reconcileGearsLedgerExecutionCosts,
  submitGearsExecutionJobs,
  summarizeGearsExecutionCostGovernance,
  type GearsExecutionSubmitUnit,
} from './gears-execution-service.js';
import {
  attachGearsProviderAssetHandoffs,
  type GearsProviderAssetSource,
} from './gears-provider-asset-handoff-service.js';
import {
  STORY_PROJECT_VIDEO_TYPES as ALL_VIDEO_TYPES,
  buildProjectId,
  buildVersionId,
  nextProjectUpdatedAt,
  parseProjectId,
  projectDir,
  projectMetaExpectation,
  projectRepository,
} from './project-core-service.js';
import {
  appendSeedanceProviderQueueBatch,
  seedanceProviderPollTargets,
  seedanceShotWaitingMinutes,
} from './seedance-provider-queue-service.js';
import {
  classifySeedanceProviderFailure,
  normalizeProviderFailureCategory,
  normalizeSeedanceShotCallbackStatus,
  seedanceShotStatusText,
} from './seedance-provider-callback-policy-service.js';
import {
  activeLocalGearsJobCount,
  buildProductionReadinessSummary,
  buildStoryProjectProductionReadinessMarkdown,
  productionReadinessDeliveryScore,
  productionReadinessGearsScore,
  productionReadinessGearsStatus,
  productionReadinessShotScore,
  productionReadinessShotStatus,
  seedanceShotProductionStatusCounts,
  summarizeProductionReadinessGears,
} from './project-production-readiness-policy-service.js';
import {
  LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL,
  artifactMetadataString,
  artifactUrlFilename,
  isExternalProductionArtifactUrl,
  isHttpArtifactUrl,
  isLocalAcceptanceArtifactUrl,
  isPlaceholderExternalArtifactUrl,
  isPrivateOrLocalArtifactUrl,
} from './gears-external-artifact-policy-service.js';
import {
  buildGearsExternalCallbackPreflightMarkdown,
  findGearsLedgerMatch,
  preflightIssue,
} from './gears-external-callback-policy-service.js';
import {
  buildGearsExternalCallbackHandoffPackage,
} from './gears-external-callback-handoff-service.js';
import {
  buildSeedanceRetryPackage,
} from './seedance-retry-package-service.js';
import { buildSeedanceProviderRetryPlan } from './seedance-provider-retry-plan-service.js';
import { buildSeedanceProviderQueueOverview } from './seedance-provider-queue-overview-service.js';
import {
  appendSeedanceAssetHistory,
  seedanceAssetHistoryEvent,
  seedanceAssetHistoryEventId,
} from './seedance-asset-history-service.js';
import {
  buildSeedanceAssetBatchImport,
  buildSeedanceAssetLibraryUpdate,
  defaultSeedanceAssetRole,
  normalizeSeedanceAssetLibrary,
} from './seedance-asset-library-service.js';
import {
  buildSeedanceAssetPlaceholderMaterialization,
  buildSeedanceAssetPlaceholderPlan,
  isSeedanceAssetPlaceholderCandidate,
  seedanceAssetPlaceholderHistoryEventId,
} from './seedance-asset-placeholder-service.js';
import {
  buildSeedanceAssetReuseMaterialization,
  buildSeedanceGlobalAssetItems,
  isReusableSeedanceAsset,
  slugifySeedanceAssetLabel,
} from './seedance-asset-reuse-service.js';
import {
  buildSeedanceAssetUploadFilePlan,
  buildSeedanceAssetUploadMaterialization,
  resolveSeedanceAssetUploadTarget,
} from './seedance-asset-upload-service.js';
import {
  buildSeedanceAssetReviewMaterialization,
  buildSeedanceAssetReviewResult,
  getSeedanceAssetReviewValidationError,
} from './seedance-asset-review-service.js';
import {
  buildProductionBoardDeliveryManifestDefinition,
  buildProductionBoardExportFileDefinitions,
} from './production-board-export-service.js';
import {
  localGearsAcceptanceArtifactUrl,
  projectGearsLocalAcceptanceItems,
  projectGearsSyncItems,
  updateGearsLedgerItemFromCallback,
} from './project-gears-ledger-application-service.js';

export { buildProjectId };

const DELIVERY_PAYLOAD_SUMMARY_INTERNAL_PATTERN =
  /(质量信号|主角目标|目标明确|行动具体|因果链|史实边界|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|知识库|用户大纲|生成优先级|资料显示|摘要|核心画面是|为什么必须面对|具体细节请核实来源|不可写成|确证史实|确证史源|创作边界|治理痕迹|分析|应该|注意|TODO|待补)/;

type StoredStoryFile = StoryGenerateResult & {
  _request_meta?: Record<string, unknown>;
};

function kbRoot(): string {
  return storyKbRoot();
}

function generatedRoot(): string {
  return storyGeneratedRoot();
}

function storiesRoot(generatedRootOverride?: string): string {
  return resolve(generatedRootOverride ?? generatedRoot(), 'stories');
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
  story_publishable?: boolean;
  production_ready?: boolean;
  quality_passed?: boolean;
  genre_score?: number;
  quality_issue_count?: number;
} {
  if (!story.quality_report) return {};
  return {
    story_publishable: story.quality_report.quality_gates?.story_publishable
      ?? story.quality_report.passed,
    production_ready: story.quality_report.quality_gates?.production_ready,
    quality_passed: story.quality_report.passed,
    genre_score: story.quality_report.genre_score,
    quality_issue_count: story.quality_report.issues.length,
  };
}

function storySourcePath(
  story: Pick<StoryGenerateResult, 'storyId' | 'video_type'>,
  generatedRootOverride?: string,
): string {
  return resolve(storiesRoot(generatedRootOverride), story.video_type, `${story.storyId}.json`);
}

function storySourcePathsForId(storyId: string): string[] {
  return ALL_VIDEO_TYPES.map(videoType => resolve(storiesRoot(), videoType, `${storyId}.json`));
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
  accessControl?: ProductResourceOwnership,
): StoryProjectMeta {
  return {
    project_id: story.project_id ?? buildProjectId(story.storyId, story.video_type),
    current_story_id: story.storyId,
    title: story.title,
    source_domain: resolveStorySourceDomain(story),
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
    ...(accessControl ? { access_control: accessControl } : {}),
  };
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
  accessControl?: ProductResourceOwnership,
): { meta: StoryProjectMeta; snapshot: StoryProjectVersionSnapshot } {
  const projectId = story.project_id ?? buildProjectId(story.storyId, story.video_type);
  const versionId = story.current_version_id ?? buildVersionId(projectId, 1);
  const storyWithProject = {
    ...story,
    sourceDomain: resolveStorySourceDomain(story),
    project_id: projectId,
    current_version_id: versionId,
    professional_text_package: story.professional_text_package
      ? {
          ...story.professional_text_package,
          story_id: story.storyId,
          project_id: projectId,
        }
      : undefined,
  };

  return {
    meta: buildProjectMeta(storyWithProject, createdAt, versionId, 1, accessControl),
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

async function ensureProjectFromStory(
  story: StoryGenerateResult,
  createdAt: string,
  accessControl?: ProductResourceOwnership,
): Promise<StoryProjectMeta> {
  const { meta, snapshot } = buildInitialProjectSnapshot(story, createdAt, accessControl);
  const existingMeta = await readProjectMeta(meta.project_id);
  if (existingMeta) return existingMeta;

  const outcome = await projectRepository().createInitial(meta, snapshot);
  if (outcome === 'created') return meta;
  const concurrentMeta = await projectRepository().readMeta(meta.project_id);
  if (concurrentMeta) return concurrentMeta;
  throw new Error(`Project "${meta.project_id}" exists but its metadata is unreadable`);
}

async function ensureProjectsFromStories(): Promise<void> {
  const stories = await readAllStoriesForMigration();
  for (const item of stories) {
    await ensureProjectFromStory(item.story, item.createdAt);
  }
}

async function readProjectMeta(projectId: string): Promise<StoryProjectMeta | null> {
  return projectRepository().readMeta(projectId);
}

async function readVersionSnapshots(projectId: string): Promise<StoryProjectVersionSnapshot[]> {
  return projectRepository().readVersionSnapshots(projectId);
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
  const createdAt = nextProjectUpdatedAt(project);
  const versionId = buildVersionId(project.project_id, nextVersionNumber);
  const storyWithVersionIdentity: StoryGenerateResult = {
    ...story,
    project_id: project.project_id,
    current_version_id: versionId,
  };
  const updatedStory = await rebuildDerivedStoryState(storyWithVersionIdentity, {
    professionalTextNow: createdAt,
  });

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
    source_domain: resolveStorySourceDomain(updatedStory),
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

  await projectRepository().commitVersion(updatedMeta, snapshot, {
    current_version_id: project.current_version_id,
    version_count: project.version_count,
    updated_at: project.updated_at,
  });
  return updatedMeta;
}

function derivedStateValidationFailure<T>(error: unknown): ApiResponse<T> | null {
  if (!(error instanceof StoryDerivedStateValidationError)) return null;
  return fail(
    ErrorCodes.DOMAIN_SAFETY_VALIDATION_FAILED,
    error.message,
    error.story.domain_safety,
  );
}

export async function createProjectFromGeneratedStory(
  story: StoryGenerateResult,
  createdAt: string,
  accessControl?: ProductResourceOwnership,
): Promise<StoryGenerateResult> {
  const meta = await ensureProjectFromStory(story, createdAt, accessControl);
  return {
    ...story,
    sourceDomain: meta.source_domain,
    project_id: meta.project_id,
    current_version_id: meta.current_version_id,
    professional_text_package: story.professional_text_package
      ? {
          ...story.professional_text_package,
          story_id: story.storyId,
          project_id: meta.project_id,
        }
      : undefined,
  };
}

export async function listProjects(sourceDomain?: string): Promise<ApiResponse<StoryProjectListItem[]>> {
  await ensureProjectsFromStories();

  let projectIds: string[];
  try {
    projectIds = await projectRepository().listProjectIds();
  } catch {
    return success([]);
  }

  const projects: StoryProjectListItem[] = [];
  for (const projectId of projectIds) {
    const meta = await readProjectMeta(projectId);
    if (!meta) continue;
    if (sourceDomain && meta.source_domain !== sourceDomain) continue;
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
    projectIds = await projectRepository().listProjectIds();
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
  if (!versions.length) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" has no version snapshots`);
  }
  const currentVersion = versions.find(version => version.version_id === project.current_version_id);
  if (!currentVersion) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" current version "${project.current_version_id}" is unavailable`);
  }
  if (!currentVersion.story) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" current version has no story snapshot`);
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
  const updatedAt = nextProjectUpdatedAt(project);
  const library = buildSeedanceAssetLibraryUpdate({
    library: project.seedance_asset_library,
    request,
    updatedAt,
    historyEventIds: request.items.map(() => (
      seedanceAssetHistoryEventId(updatedAt, randomUUID().slice(0, 8))
    )),
  });
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_asset_library: library,
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
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
  const updatedAt = nextProjectUpdatedAt(project);
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const batch = buildSeedanceAssetBatchImport({
    library: project.seedance_asset_library,
    request,
    reportAssets: board.seedance_asset_report.assets,
    updatedAt,
    historyEventIds: request.items.map(() => (
      seedanceAssetHistoryEventId(updatedAt, randomUUID().slice(0, 8))
    )),
  });

  if (!batch.importedCount) {
    return success({
      detail: detail.data,
      imported_count: 0,
      matched_existing_count: 0,
      skipped_count: batch.skippedItems.length,
      updated_asset_ids: [],
      skipped_items: batch.skippedItems,
      source_note: request.source_note,
    });
  }

  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_asset_library: batch.library,
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
  const nextDetail = await getProject(project.project_id);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      nextDetail.error?.message ?? `Project "${projectId}" not found after Seedance asset import`,
    );
  }
  return success({
    detail: nextDetail.data,
    imported_count: batch.importedCount,
    matched_existing_count: batch.matchedExistingCount,
    skipped_count: batch.skippedItems.length,
    updated_asset_ids: batch.updatedAssetIds,
    skipped_items: batch.skippedItems,
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
  const updatedAt = nextProjectUpdatedAt(project);
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const target = resolveSeedanceAssetUploadTarget({
    library: project.seedance_asset_library,
    reportAssets: board.seedance_asset_report.assets,
    request,
  });
  if (!target) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'asset_id or label+kind is required for Seedance asset upload');
  }

  let ingest: AssetIngestReport;
  try {
    ingest = inspectMediaAssetUpload({
      original_filename: request.file.original_filename,
      declared_mime_type: request.file.mime_type,
      expected_modality: target.modality,
      buffer: request.file.buffer,
    });
  } catch (error) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      error instanceof Error ? error.message : 'Uploaded Seedance asset failed media inspection',
    );
  }
  const plan = buildSeedanceAssetUploadFilePlan({
    projectId: project.project_id,
    ingest,
  });
  const originalDir = resolve(projectDir(project.project_id), 'media', 'originals');
  const originalStore = new FileArtifactStore(originalDir);
  if (!(await originalStore.exists(plan.filename))) {
    await originalStore.writeBinary(plan.filename, request.file.buffer, { overwrite: 'forbid' });
  }
  const materialization = buildSeedanceAssetUploadMaterialization({
    library: project.seedance_asset_library,
    target,
    request: {
      ...request,
      originalFilename: request.file.original_filename,
    },
    ingest,
    plan,
    updatedAt,
    historyEventId: seedanceAssetHistoryEventId(updatedAt, randomUUID().slice(0, 8)),
  });
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_asset_library: materialization.library,
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
  const nextDetail = await getProject(project.project_id);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      nextDetail.error?.message ?? `Project "${projectId}" not found after Seedance asset upload`,
    );
  }
  return success({
    detail: nextDetail.data,
    asset: materialization.asset,
    file_id: plan.fileId,
    local_path: plan.localPath,
    original_filename: request.file.original_filename,
    mime_type: ingest.detected_mime_type,
    size_bytes: ingest.byte_size,
    content_sha256: ingest.content_sha256,
    preview_url: plan.previewUrl,
    ingest,
  });
}

export async function updateProjectMediaAssetReview(
  projectId: string,
  request: MediaAssetReviewUpdateRequest,
  reviewer: {
    actor_id: string;
    authentication_method: 'static_registry_token' | 'signed_session';
  },
): Promise<ApiResponse<MediaAssetReviewUpdateResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }
  const { project, current_story } = detail.data;
  const current = normalizeSeedanceAssetLibrary(project.seedance_asset_library);
  const existing = current.items.find(item => item.asset_id === request.asset_id);
  if (!existing) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Media asset "${request.asset_id}" is not in the project asset library`);
  }
  let hasVerifiedImmutableArtifact = false;
  if (request.human_review_status && request.human_review_status !== 'pending') {
    const currentBoard = buildStoryProductionBoard(current_story, {
      seedanceAssetLibrary: project.seedance_asset_library,
      seedanceShotLedger: project.seedance_shot_ledger,
      sourceVersionId: project.current_version_id,
    });
    const binding = currentBoard.media_asset_library.bindings.find(item => item.asset_id === existing.asset_id);
    const artifact = binding?.artifact_id
      ? currentBoard.media_asset_library.artifacts.find(item => item.artifact_id === binding.artifact_id)
      : undefined;
    hasVerifiedImmutableArtifact = artifact?.integrity_status === 'verified'
      && artifact.storage.kind === 'local_immutable';
  }
  const validationError = getSeedanceAssetReviewValidationError({
    existing,
    request,
    hasVerifiedImmutableArtifact,
  });
  if (validationError) {
    return fail(ErrorCodes.VALIDATION_ERROR, validationError);
  }

  const reviewedAt = nextProjectUpdatedAt(project);
  const materialization = buildSeedanceAssetReviewMaterialization({
    library: project.seedance_asset_library,
    existing,
    request,
    reviewerId: reviewer.actor_id,
    reviewedAt,
    rightsHistoryEventId: request.rights_status
      ? seedanceAssetHistoryEventId(reviewedAt, randomUUID().slice(0, 8))
      : undefined,
    humanReviewHistoryEventId: request.human_review_status
      ? seedanceAssetHistoryEventId(reviewedAt, randomUUID().slice(0, 8))
      : undefined,
  });
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: reviewedAt,
    seedance_asset_library: materialization.library,
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
  const nextDetail = await getProject(project.project_id);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found after media review update`);
  }
  const board = buildStoryProductionBoard(nextDetail.data.current_story, {
    seedanceAssetLibrary: nextDetail.data.project.seedance_asset_library,
    seedanceShotLedger: nextDetail.data.project.seedance_shot_ledger,
    sourceVersionId: nextDetail.data.project.current_version_id,
  });
  const binding = board.media_asset_library.bindings.find(item => item.asset_id === request.asset_id);
  const artifact = binding?.artifact_id
    ? board.media_asset_library.artifacts.find(item => item.artifact_id === binding.artifact_id)
    : undefined;
  if (!binding || !artifact) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `Media asset "${request.asset_id}" is not bound to the current production board`,
    );
  }
  return success(buildSeedanceAssetReviewResult({
    detail: nextDetail.data,
    asset: materialization.asset,
    artifact,
    binding,
    reviewerId: reviewer.actor_id,
    reviewedAt,
  }));
}

export async function draftProjectSeedanceAssetPlaceholders(
  projectId: string,
): Promise<ApiResponse<ProjectSeedanceAssetPlaceholderResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project, current_story } = detail.data;
  const generatedAt = nextProjectUpdatedAt(project);
  const beforeBoard = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const current = normalizeSeedanceAssetLibrary(project.seedance_asset_library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const placeholderDir = resolve(projectDir(project.project_id), 'production-board', 'seedance-assets');
  const placeholderStore = new FileArtifactStore(placeholderDir);

  const items: ProjectSeedanceAssetPlaceholderResult['items'] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const asset of beforeBoard.seedance_asset_report.assets) {
    if (!isSeedanceAssetPlaceholderCandidate(asset)) {
      skippedCount += 1;
      continue;
    }

    const plan = buildSeedanceAssetPlaceholderPlan({
      asset,
      projectId: project.project_id,
      projectTitle: project.title,
    });
    const artifact = await placeholderStore.writeText(plan.filename, plan.svg, { overwrite: 'replace' });
    const materialization = buildSeedanceAssetPlaceholderMaterialization({
      asset,
      plan,
      generatedAt,
      previousAsset: byId.get(asset.asset_id),
      historyEventId: seedanceAssetPlaceholderHistoryEventId(
        generatedAt,
        randomUUID().slice(0, 8),
      ),
      artifact: {
        absolutePath: artifact.absolute_path,
        byteSize: artifact.byte_size,
        replaced: artifact.replaced,
      },
    });
    byId.set(asset.asset_id, materialization.libraryAsset);
    if (materialization.item.status === 'updated') {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
    items.push(materialization.item);
  }

  if (!items.length) {
    return success({
      schema_version: 'project-seedance-asset-placeholders/v1',
      project_id: project.project_id,
      storyId: current_story.storyId,
      title: current_story.title,
      generated_at: generatedAt,
      placeholder_dir: placeholderDir,
      created_count: 0,
      updated_count: 0,
      skipped_count: skippedCount,
      before_upload_required_count: beforeBoard.seedance_asset_report.upload_required_count,
      after_upload_required_count: beforeBoard.seedance_asset_report.upload_required_count,
      before_unbound_shot_count: beforeBoard.seedance_asset_report.unbound_shot_count,
      after_unbound_shot_count: beforeBoard.seedance_asset_report.unbound_shot_count,
      items: [],
      detail: detail.data,
      board: beforeBoard,
    });
  }

  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: generatedAt,
    seedance_asset_library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: generatedAt,
      items: [...byId.values()].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.label.localeCompare(b.label, 'zh-CN');
      }),
    },
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));

  const exportResult = await exportProjectProductionBoard(project.project_id);
  if (!exportResult.ok || !exportResult.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      exportResult.error?.message ?? `Project "${projectId}" not found after Seedance placeholder draft`,
    );
  }
  const nextDetail = await getProject(project.project_id);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      nextDetail.error?.message ?? `Project "${projectId}" not found after Seedance placeholder draft`,
    );
  }

  return success({
    schema_version: 'project-seedance-asset-placeholders/v1',
    project_id: project.project_id,
    storyId: current_story.storyId,
    title: current_story.title,
    generated_at: generatedAt,
    placeholder_dir: placeholderDir,
    created_count: createdCount,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    before_upload_required_count: beforeBoard.seedance_asset_report.upload_required_count,
    after_upload_required_count: exportResult.data.board.seedance_asset_report.upload_required_count,
    before_unbound_shot_count: beforeBoard.seedance_asset_report.unbound_shot_count,
    after_unbound_shot_count: exportResult.data.board.seedance_asset_report.unbound_shot_count,
    items,
    detail: nextDetail.data,
    board: exportResult.data.board,
  });
}

export async function listProjectSeedanceGlobalAssetLibrary(
  projectId: string,
): Promise<ApiResponse<SeedanceGlobalAssetLibrary>> {
  const project = await ensureProjectExists(projectId);
  if (!project) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found`);
  }
  const projects = await readAllProjectMetas();
  const items = buildSeedanceGlobalAssetItems({
    currentProjectId: projectId,
    projects: projects.map(meta => ({
      project: meta,
      items: normalizeSeedanceAssetLibrary(meta.seedance_asset_library).items,
    })),
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
  const updatedAt = nextProjectUpdatedAt(project);
  const current = normalizeSeedanceAssetLibrary(project.seedance_asset_library);
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const materialization = buildSeedanceAssetReuseMaterialization({
    request,
    sourceProject,
    sourceItem,
    targetItems: current.items,
    reportAssets: board.seedance_asset_report.assets,
    updatedAt,
    historyEventId: seedanceAssetHistoryEventId(updatedAt, randomUUID().slice(0, 8)),
  });
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    seedance_asset_library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: updatedAt,
      items: materialization.libraryItems,
    },
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
  const nextDetail = await getProject(project.project_id);
  if (!nextDetail.ok || !nextDetail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      nextDetail.error?.message ?? `Project "${projectId}" not found after Seedance asset reuse`,
    );
  }
  return success({
    detail: nextDetail.data,
    reused_asset: materialization.reusedAsset,
    source_asset: materialization.sourceAsset,
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

  const updatedAt = nextProjectUpdatedAt(project);
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
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
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

  const updatedAt = nextProjectUpdatedAt(project);
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
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
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
  const updatedAt = nextProjectUpdatedAt(project);
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
    await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
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
  const updatedAt = nextProjectUpdatedAt(project);
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
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
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
  const updatedAt = nextProjectUpdatedAt(project);
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
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
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
  const generatedAt = new Date().toISOString();
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const currentLedger = syncSeedanceShotLedgerWithShots({
    ledger: project.seedance_shot_ledger,
    shotUnits: board.shot_units,
    generatedAt: board.generated_at,
  });
  return success(buildSeedanceProviderQueueOverview({
    project,
    ledger: currentLedger,
    request,
    generatedAt,
  }));
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
  const generatedAt = new Date().toISOString();
  const board = buildStoryProductionBoard(current_story, {
    seedanceAssetLibrary: project.seedance_asset_library,
    seedanceShotLedger: project.seedance_shot_ledger,
  });
  const currentLedger = syncSeedanceShotLedgerWithShots({
    ledger: project.seedance_shot_ledger,
    shotUnits: board.shot_units,
    generatedAt: board.generated_at,
  });
  return success(buildSeedanceProviderRetryPlan({
    project,
    ledger: currentLedger,
    request,
    generatedAt,
  }));
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
  } else if (input.jobType === 'prop_image') {
    input.board.image_asset_job_plan.requirements
      .filter(requirement => requirement.asset_kind === 'prop')
      .forEach(requirement => addUnit({
        source_unit_id: requirement.source_unit_id,
        source_unit_label: requirement.label,
        source_scene_id: requirement.source_scene_ids[0],
        payload_summary: compactDeliveryPayloadSummary(`${requirement.label} ${requirement.prompt}`),
        payload: { requirement },
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
  const submittedAt = nextProjectUpdatedAt(project);
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

  let submitUnits = filtered.units;
  if (
    request.use_gears_api
    && request.external_call_authorization?.authorized === true
    && jobType === 'seedance_video'
  ) {
    const bindingByAssetId = new Map(board.media_asset_library.bindings.map(binding => [binding.asset_id, binding]));
    const assets: GearsProviderAssetSource[] = normalizeSeedanceAssetLibrary(project.seedance_asset_library).items
      .map(item => ({
        asset_id: item.asset_id,
        label: item.label,
        modality: item.modality,
        file_url: item.file_url,
        provider: item.provider,
        provider_asset_id: item.provider_asset_id,
        content_sha256: item.content_sha256,
        rights_status: item.rights_status,
        authorization_reference: item.authorization_reference,
        human_review_status: item.human_review_status,
        reviewer_id: item.reviewer_id,
        reviewed_at: item.reviewed_at,
        production_credit_granted: Boolean(bindingByAssetId.get(item.asset_id)?.production_credit_granted),
      }));
    const handoff = attachGearsProviderAssetHandoffs({ units: submitUnits, assets, verified_at: submittedAt });
    if (!handoff.ok) return fail(ErrorCodes.VALIDATION_ERROR, handoff.message, handoff.details);
    submitUnits = handoff.units;
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
    externalCallAuthorization: request.external_call_authorization,
    payload: request.payload,
    units: submitUnits,
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
  const externalCallAuthorization = adapterRes.data.summary.external_call_authorization;
  const unitById = new Map(submitUnits.map(unit => [unit.source_unit_id, unit]));
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
        externalCallAuthorization,
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
        externalCallAuthorization,
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
  if (ledgerJobs.length > 0) {
    await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
  }
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

export async function preflightProjectGearsExternalCallbacks(
  projectId: string,
  request: GearsJobCallbackRequest,
): Promise<ApiResponse<GearsExternalCallbackPreflightResult>> {
  const callbacks = extractGearsJobCallbackRequests(request);
  if (callbacks.length > GEARS_CALLBACK_BATCH_ITEM_LIMIT) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `GEARS callback batch item count must be <= ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}`,
    );
  }

  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
      detail.error?.details,
    );
  }

  const { project, current_story } = detail.data;
  const ledger = normalizeGearsJobLedger(project.gears_job_ledger);
  const issues: GearsExternalCallbackPreflightIssue[] = [];
  const firstBatchEventIndex = new Map<string, number>();
  const items: GearsExternalCallbackPreflightItem[] = callbacks.map((callbackRequest, index) => {
    const callback = normalizeGearsJobCallback(callbackRequest);
    const match = findGearsLedgerMatch({ ledger, callback });
    const matchedItem = typeof match === 'string' ? undefined : match;
    const itemIssues: GearsExternalCallbackPreflightIssue[] = [];
    const artifactUrls = callback.artifact_urls;
    const hasInvalidArtifactUrl = artifactUrls.some(url => !isHttpArtifactUrl(url));
    const hasPlaceholderArtifactUrl = artifactUrls.some(isPlaceholderExternalArtifactUrl);
    const hasLocalAcceptanceArtifactUrl = artifactUrls.some(isLocalAcceptanceArtifactUrl);
    const hasPrivateOrLocalArtifactUrl = artifactUrls.some(isPrivateOrLocalArtifactUrl);
    const hasExternalArtifactUrl = artifactUrls.some(url =>
      isHttpArtifactUrl(url)
      && !isPlaceholderExternalArtifactUrl(url)
      && !isLocalAcceptanceArtifactUrl(url)
      && !isPrivateOrLocalArtifactUrl(url)
    );
    const sourceUnitId = callback.source_unit_id ?? matchedItem?.source_unit_id;
    const gearsJobId = callback.gears_job_id ?? matchedItem?.gears_job_id;
    const path = gearsCallbackBatchPath(callbackRequest);
    const eventId = callback.event_id?.trim();
    const previousBatchEventIndex = eventId ? firstBatchEventIndex.get(eventId) : undefined;
    const duplicateInBatch = previousBatchEventIndex !== undefined;
    if (eventId && previousBatchEventIndex === undefined) {
      firstBatchEventIndex.set(eventId, index);
    }
    const duplicateInLedger = matchedItem
      ? gearsCallbackEventIsDuplicate({
          existing: matchedItem.callback_events,
          callback,
        })
      : false;
    const duplicateEventSource = duplicateInLedger && duplicateInBatch
      ? 'ledger_and_batch'
      : duplicateInLedger
        ? 'ledger'
        : duplicateInBatch
          ? 'batch'
          : undefined;

    if (!matchedItem) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'blocking',
        code: 'ledger_match_failed',
        message: typeof match === 'string' ? match : 'Callback did not match a GEARS ledger item.',
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (callback.source_project_id && callback.source_project_id !== project.project_id) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'blocking',
        code: 'source_project_mismatch',
        message: `Callback sourceProjectId "${callback.source_project_id}" does not match project "${project.project_id}".`,
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (callback.source_story_id && callback.source_story_id !== current_story.storyId) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'warning',
        code: 'source_story_mismatch',
        message: `Callback sourceStoryId "${callback.source_story_id}" does not match story "${current_story.storyId}".`,
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (matchedItem && callback.job_type && callback.job_type !== matchedItem.job_type) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'blocking',
        code: 'job_type_mismatch',
        message: `Callback jobType "${callback.job_type}" does not match ledger jobType "${matchedItem.job_type}".`,
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (callback.status !== 'ready') {
      itemIssues.push(preflightIssue({
        index,
        severity: 'warning',
        code: 'callback_not_ready',
        message: `Callback normalized status is "${callback.status}", not ready.`,
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (callback.status === 'ready' && hasExternalArtifactUrl && !eventId) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'warning',
        code: 'missing_event_id',
        message: 'Callback is ready and has a real external artifact URL, but eventId is missing; add a unique eventId to improve replay auditability.',
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (!hasExternalArtifactUrl) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'blocking',
        code: 'missing_external_artifact_url',
        message: 'Callback does not contain a real external artifact URL.',
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (hasPlaceholderArtifactUrl) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'blocking',
        code: 'placeholder_artifact_url',
        message: 'Callback still contains example/gears.example placeholder artifact URLs.',
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (hasLocalAcceptanceArtifactUrl) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'blocking',
        code: 'local_acceptance_artifact_url',
        message: 'Callback contains a local_acceptance artifact URL; this is not a real external provider output.',
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (hasPrivateOrLocalArtifactUrl) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'blocking',
        code: 'private_or_local_artifact_url',
        message: 'Callback contains a localhost, private network, or local-only artifact URL; use a real external provider URL.',
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (hasInvalidArtifactUrl) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'blocking',
        code: 'invalid_artifact_url',
        message: 'Callback artifact URL must be an absolute http(s) URL that Story Agent can hand off to production.',
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (duplicateInLedger) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'warning',
        code: 'duplicate_callback_event',
        message: eventId
          ? `Callback eventId "${eventId}" already exists in the GEARS ledger; safe import will treat it as a replay.`
          : 'Callback event already exists in the GEARS ledger; safe import will treat it as a replay.',
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }
    if (duplicateInBatch) {
      itemIssues.push(preflightIssue({
        index,
        severity: 'warning',
        code: 'duplicate_event_id_in_batch',
        message: `Callback eventId "${eventId}" duplicates item #${(previousBatchEventIndex ?? 0) + 1} in this batch.`,
        path,
        sourceUnitId,
        gearsJobId,
      }));
    }

    issues.push(...itemIssues);
    const blockingCount = itemIssues.filter(issue => issue.severity === 'blocking').length;
    const isDuplicateEvent = duplicateInLedger || duplicateInBatch;
    return {
      index,
      source_unit_id: sourceUnitId,
      gears_job_id: gearsJobId,
      job_type: callback.job_type ?? matchedItem?.job_type,
      event_id: eventId,
      has_event_id: Boolean(eventId),
      callback_status: callback.status,
      ledger_status: matchedItem?.status,
      artifact_urls: artifactUrls,
      matched_ledger: Boolean(matchedItem),
      has_external_artifact_url: hasExternalArtifactUrl,
      has_placeholder_artifact_url: hasPlaceholderArtifactUrl,
      has_local_acceptance_artifact_url: hasLocalAcceptanceArtifactUrl,
      has_private_or_local_artifact_url: hasPrivateOrLocalArtifactUrl,
      has_invalid_artifact_url: hasInvalidArtifactUrl,
      is_duplicate_event: isDuplicateEvent,
      duplicate_event_source: duplicateEventSource,
      duplicate_of_index: previousBatchEventIndex,
      would_update: Boolean(matchedItem)
        && callback.status === 'ready'
        && hasExternalArtifactUrl
        && blockingCount === 0
        && !isDuplicateEvent,
      issue_count: itemIssues.length,
    };
  });

  const base: Omit<GearsExternalCallbackPreflightResult, 'markdown'> = {
    schema_version: 'project-gears-external-callback-preflight/v1',
    project,
    received_count: callbacks.length,
    ready_to_import_count: items.filter(item => item.would_update).length,
    duplicate_event_count: items.filter(item => item.is_duplicate_event).length,
    blocking_count: issues.filter(issue => issue.severity === 'blocking').length,
    warning_count: issues.filter(issue => issue.severity === 'warning').length,
    info_count: issues.filter(issue => issue.severity === 'info').length,
    items,
    issues,
  };
  return success({
    ...base,
    markdown: buildGearsExternalCallbackPreflightMarkdown(base),
  });
}

function archiveGearsImageArtifact(input: {
  project: StoryProjectMeta;
  board: StoryProductionBoard;
  item: GearsJobLedgerItem;
  callbackStatus: GearsJobLedgerItem['status'];
  receivedAt: string;
  duplicate: boolean;
}): SeedanceAssetLibrary | undefined {
  if (
    input.duplicate
    || input.callbackStatus !== 'ready'
    || input.item.status !== 'ready'
    || !['character_image', 'scene_image', 'prop_image'].includes(input.item.job_type)
  ) {
    return input.project.seedance_asset_library;
  }
  const requirement = input.board.image_asset_job_plan.requirements.find(item => (
    item.job_type === input.item.job_type && item.source_unit_id === input.item.source_unit_id
  ));
  if (!requirement) return input.project.seedance_asset_library;
  const artifact = input.item.artifacts?.find(item => isExternalProductionArtifactUrl(item.url));
  const artifactUrl = artifact?.url
    ?? input.item.artifact_urls.find(isExternalProductionArtifactUrl);
  if (!artifactUrl) return input.project.seedance_asset_library;

  const current = normalizeSeedanceAssetLibrary(input.project.seedance_asset_library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const existing = byId.get(requirement.asset_id);
  const model = artifactMetadataString(artifact?.metadata, 'model');
  const originalFilename = artifactUrlFilename(artifactUrl);
  const asset: SeedanceAssetLibraryItem = {
    asset_id: requirement.asset_id,
    kind: requirement.asset_kind,
    label: requirement.label,
    modality: 'image',
    role: existing?.role ?? defaultSeedanceAssetRole(requirement.asset_kind),
    reference_slot: requirement.reference_slot ?? existing?.reference_slot,
    file_url: artifactUrl,
    original_filename: originalFilename,
    mime_type: artifact?.mime_type,
    provider: 'gears',
    provider_asset_id: artifact?.artifact_id ?? input.item.gears_job_id,
    upload_status: 'external',
    content_sha256: undefined,
    prompt_sha256: createHash('sha256').update(requirement.prompt, 'utf8').digest('hex'),
    model,
    rights_status: 'pending',
    authorization_reference: undefined,
    person_consent_reference: undefined,
    human_review_status: 'pending',
    reviewer_id: undefined,
    reviewed_at: undefined,
    review_note: undefined,
    description: requirement.prompt,
    updated_at: input.receivedAt,
  };
  byId.set(requirement.asset_id, {
    ...asset,
    history: appendSeedanceAssetHistory(existing, seedanceAssetHistoryEvent({
      asset,
      eventType: 'provider_callback',
      createdAt: input.receivedAt,
      note: `GEARS ${input.item.job_type} callback: ${input.item.gears_job_id}`,
    })),
  });
  return {
    schema_version: 'seedance-asset-library/v1',
    updated_at: input.receivedAt,
    items: [...byId.values()].sort((a, b) => (
      a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, 'zh-CN')
    )),
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

  const receivedAt = nextProjectUpdatedAt(project);
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
    items: reconcileGearsLedgerExecutionCosts(ledger.items.map(item =>
      item.ledger_id === match.ledger_id ? updatedItem : item
    )),
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
  const seedanceAssetLibrary = archiveGearsImageArtifact({
    project,
    board,
    item: updatedItem,
    callbackStatus: callback.status,
    receivedAt,
    duplicate: duplicateCount > 0,
  });
  const updatedProject: StoryProjectMeta = {
    ...project,
    updated_at: receivedAt,
    gears_job_ledger: gearsJobLedger,
    seedance_shot_ledger: seedanceShotLedger,
    seedance_asset_library: seedanceAssetLibrary,
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
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

export async function importProjectGearsExternalCallbacks(
  projectId: string,
  request: GearsJobCallbackRequest,
): Promise<ApiResponse<GearsExternalCallbackImportResult>> {
  const preflightRes = await preflightProjectGearsExternalCallbacks(projectId, request);
  if (!preflightRes.ok || !preflightRes.data) {
    return fail(
      preflightRes.error?.code === ErrorCodes.STORY_NOT_FOUND
        ? ErrorCodes.STORY_NOT_FOUND
        : preflightRes.error?.code === ErrorCodes.VALIDATION_ERROR
          ? ErrorCodes.VALIDATION_ERROR
          : ErrorCodes.INTERNAL_ERROR,
      preflightRes.error?.message ?? 'GEARS external callback preflight failed',
      preflightRes.error?.details,
    );
  }

  if (preflightRes.data.blocking_count > 0) {
    const blockedItemCount = new Set(
      preflightRes.data.issues
        .filter(issue => issue.severity === 'blocking')
        .map(issue => issue.index),
    ).size;
    return success({
      schema_version: 'project-gears-external-callback-import/v1',
      project: preflightRes.data.project,
      preflight: preflightRes.data,
      blocked: true,
      received_count: preflightRes.data.received_count,
      updated_count: 0,
      failed_count: blockedItemCount,
      duplicate_count: preflightRes.data.duplicate_event_count,
    });
  }

  const importRes = await importProjectGearsCallbacks(projectId, request);
  if (!importRes.ok || !importRes.data) {
    return fail(
      importRes.error?.code === ErrorCodes.VALIDATION_ERROR
        ? ErrorCodes.VALIDATION_ERROR
        : importRes.error?.code === ErrorCodes.STORY_NOT_FOUND
          ? ErrorCodes.STORY_NOT_FOUND
          : ErrorCodes.INTERNAL_ERROR,
      importRes.error?.message ?? 'GEARS external callback import failed',
      importRes.error?.details,
    );
  }

  return success({
    schema_version: 'project-gears-external-callback-import/v1',
    project: importRes.data.project,
    preflight: preflightRes.data,
    blocked: false,
    received_count: importRes.data.received_count,
    updated_count: importRes.data.updated_count,
    failed_count: importRes.data.failed_count,
    duplicate_count: importRes.data.duplicate_count,
    import_result: importRes.data,
  });
}

export async function acceptProjectLocalGearsArtifacts(
  projectId: string,
  request: GearsJobLocalAcceptanceRequest = {},
): Promise<ApiResponse<GearsJobLocalAcceptanceResult>> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detail.error?.message ?? `Project "${projectId}" not found`,
    );
  }

  const { project } = detail.data;
  const ledger = normalizeGearsJobLedger(project.gears_job_ledger);
  const selection = projectGearsLocalAcceptanceItems({ ledger, request });
  if (!selection.items.length) {
    return success({
      project,
      gears_job_ledger: ledger,
      seedance_shot_ledger: project.seedance_shot_ledger,
      accepted_count: 0,
      failed_count: 0,
      duplicate_count: 0,
      skipped_count: selection.skippedCount,
      accepted_jobs: [],
      callbacks: [],
      failures: [],
    });
  }

  const note = request.note ?? 'Local GEARS acceptance artifact; not an external provider output.';
  const callbacks: GearsJobCallbackRequest[] = selection.items.map(item => {
    const artifactUrl = localGearsAcceptanceArtifactUrl({ projectId, item, request });
    return {
      gears_job_id: item.gears_job_id,
      source_unit_id: item.source_unit_id,
      job_type: item.job_type,
      status: 'COMPLETED',
      progress_percent: 100,
      output_url: artifactUrl,
      event_id: `local-acceptance:${item.ledger_id}`,
      note,
      artifacts: [{
        artifact_id: `local-acceptance-${item.source_unit_id}`,
        kind: request.artifact_kind ?? (item.job_type === 'seedance_video' ? 'video' : 'local_acceptance_artifact'),
        url: artifactUrl,
        role: 'local_acceptance',
        mime_type: item.job_type === 'seedance_video' ? 'video/mp4' : undefined,
        source_unit_id: item.source_unit_id,
        metadata: {
          acceptance_scope: 'local',
          source: 'story_agent_local_acceptance',
          not_external_provider_output: true,
        },
      }],
    };
  });

  const importRes = await importProjectGearsCallbacks(projectId, { callbacks });
  if (!importRes.ok || !importRes.data) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      importRes.error?.message ?? 'Local GEARS acceptance import failed',
      importRes.error?.details,
    );
  }

  const acceptedIds = new Set(selection.items.map(item => item.ledger_id));
  const updatedLedger = normalizeGearsJobLedger(importRes.data.gears_job_ledger);
  const acceptedJobs = updatedLedger.items.filter(item =>
    acceptedIds.has(item.ledger_id)
    && item.status === 'ready'
    && (item.artifact_urls.length > 0 || (item.artifacts?.length ?? 0) > 0)
  );

  return success({
    project: importRes.data.project,
    gears_job_ledger: updatedLedger,
    seedance_shot_ledger: importRes.data.seedance_shot_ledger,
    accepted_count: acceptedJobs.length,
    failed_count: importRes.data.failed_count,
    duplicate_count: importRes.data.duplicate_count,
    skipped_count: selection.skippedCount,
    accepted_jobs: acceptedJobs,
    callbacks,
    failures: importRes.data.failures,
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
    const previousProject = currentProject;
    const updatedAt = nextProjectUpdatedAt(previousProject);
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
    await projectRepository().writeMeta(currentProject, projectMetaExpectation(previousProject));
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
  return success(buildSeedanceRetryPackage({
    project,
    storyId: board.storyId,
    title: board.title,
    exportedAt: new Date().toISOString(),
    shotUnits: board.shot_units,
    ledger: board.seedance_shot_ledger,
  }));
}

export async function exportProjectGearsExternalCallbackHandoff(
  projectId: string,
): Promise<ApiResponse<GearsExternalCallbackHandoffPackage>> {
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
  const ledger = normalizeGearsJobLedger(project.gears_job_ledger);
  const callbackPath = gearsProjectCallbackPath(project.project_id);
  const callbackUrl = gearsProjectCallbackUrl(project.project_id) ?? callbackPath;
  return success(buildGearsExternalCallbackHandoffPackage({
    project,
    storyId: current_story.storyId,
    title: current_story.title,
    exportedAt: new Date().toISOString(),
    ledger,
    shotUnits: board.shot_units,
    callbackPath,
    callbackUrl,
  }));
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
    sourceVersionId: detail.data.project.current_version_id,
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
  const gearsCostGovernance = summarizeGearsExecutionCostGovernance(detail.project.gears_job_ledger);
  const gearsOperationalMetrics = buildGearsExecutionOperationalMetrics(detail.project.gears_job_ledger);
  const gearsRecoveryPlan = buildGearsExecutionRecoveryPlan(detail.project.gears_job_ledger);
  const localActiveGearsCount = activeLocalGearsJobCount(detail.project.gears_job_ledger);
  const localGearsAcceptanceAvailable = localActiveGearsCount > 0 && localActiveGearsCount === gearsSummary.active;
  const activeGearsActionKey = localGearsAcceptanceAvailable ? 'accept_local_gears_artifacts' : 'sync_gears_jobs';
  const shotStatusCounts = seedanceShotProductionStatusCounts(board.seedance_shot_ledger.items);
  const activeShotCount = shotStatusCounts.submitted + shotStatusCounts.processing;
  const shotCount = board.seedance_shot_ledger.items.length || board.shot_units.length;
  const seedancePlaceholderAssetCount = board.seedance_asset_report.placeholder_asset_count ?? 0;
  const mediaBindingCount = board.media_asset_library.summary.binding_count;
  const mediaProductionCreditCount = board.media_asset_library.summary.production_credit_binding_count;
  const mediaProductionGapCount = Math.max(0, mediaBindingCount - mediaProductionCreditCount);
  const currentVersion = detail.versions.find(
      version => version.version_id === detail.project.current_version_id,
    );
  if (!currentVersion) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      `Project "${projectId}" current version "${detail.project.current_version_id}" summary is unavailable`,
    );
  }
  const issues: ProductionReadinessIssue[] = [];
  const nextActions: ProductionReadinessNextAction[] = [];

  const addIssue = (issue: ProductionReadinessIssue) => issues.push(issue);
  const addAction = (action: ProductionReadinessNextAction) => {
    if (nextActions.some(item => item.action_key === action.action_key)) return;
    nextActions.push(action);
  };
  const draftableProductionMaterialTasks = projectProductionMaterialDraftableTasks(detail.current_story);

  if (
    detail.current_story.production_material_readiness
    && detail.current_story.production_material_readiness.status !== 'ready'
    && draftableProductionMaterialTasks.length > 0
  ) {
    addIssue({
      issue_id: 'production-material-drafts-available',
      severity: detail.current_story.production_material_readiness.status === 'blocked' ? 'blocking' : 'warning',
      lane_key: 'story_quality',
      label: `${draftableProductionMaterialTasks.length} 个生产素材字段可草拟`,
      detail: '当前项目存在可由 scene_breakdown 与 GEARS segments 草拟的生产素材缺口。',
      action_key: 'draft_production_material_fields',
      action_label: '草拟生产素材字段',
    });
    addAction({
      action_key: 'draft_production_material_fields',
      label: '草拟生产素材字段',
      detail: '从现有场景、镜头提示和 GEARS segment 中整理关键帧、一致性、单镜头测试、连续性和转场计划。',
      priority: 8,
      lane_key: 'story_quality',
    });
  }

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

  if (board.seedance_asset_report.upload_required_count > 0 || board.seedance_asset_report.unbound_shot_count > 0) {
    addIssue({
      issue_id: 'seedance-assets-unbound',
      severity: board.seedance_asset_report.missing_reference_slot_count > 0 ? 'blocking' : 'warning',
      lane_key: 'delivery_contract',
      label: `${board.seedance_asset_report.upload_required_count} 个 Seedance 参考素材缺文件`,
      detail: `当前有 ${board.seedance_asset_report.unbound_shot_count}/${board.seedance_asset_report.shot_binding_count} 个镜头缺少可交付的 @ 参考素材绑定。`,
      action_key: board.seedance_asset_report.upload_required_count > 0 ? 'draft_seedance_asset_placeholders' : 'export_production_board',
      action_label: board.seedance_asset_report.upload_required_count > 0 ? '生成占位参考图' : '刷新 Production Board',
    });
  }
  if (seedancePlaceholderAssetCount > 0) {
    addIssue({
      issue_id: 'seedance-assets-placeholder-only',
      severity: 'warning',
      lane_key: 'delivery_contract',
      label: `${seedancePlaceholderAssetCount} 个 Seedance 占位参考图待替换`,
      detail: '占位参考图只说明 @ 槽位已结构化绑定，可用于链路验收；正式投产前仍需批量导入或上传真实视觉素材。',
      action_label: '批量导入正式素材',
    });
  }
  if (mediaProductionGapCount > 0) {
    addIssue({
      issue_id: 'media-assets-production-credit-missing',
      severity: 'warning',
      lane_key: 'delivery_contract',
      label: `${mediaProductionGapCount} 个媒体绑定未取得生产资格`,
      detail: `当前只有 ${mediaProductionCreditCount}/${mediaBindingCount} 个绑定同时通过字节完整性、版权授权和真人视觉审核；结构已绑定或供应商回传不计正式投产信用。`,
      action_label: '完成媒体授权与真人审核',
    });
  }
  if (board.seedance_asset_report.upload_required_count > 0) {
    addAction({
      action_key: 'draft_seedance_asset_placeholders',
      label: '生成 Seedance 占位参考图',
      detail: '为缺文件的 @ 参考槽位生成本地 SVG 参考卡，写入 seedance_asset_library 并刷新交付包。',
      priority: 28,
      lane_key: 'delivery_contract',
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
      action_key: activeGearsActionKey,
      label: localGearsAcceptanceAvailable ? '验收本地 GEARS 占位回片' : '同步 GEARS 状态或导入回传',
      detail: localGearsAcceptanceAvailable
        ? `${localActiveGearsCount} 个本地 mocked GEARS job 等待验收占位 artifact。`
        : `${activeShotCount + shotStatusCounts.prompt_exported} 个镜头仍在生产链路中。`,
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
    if (gearsCostGovernance.boundary_violation_count > 0) {
      addIssue({
        issue_id: 'gears-execution-cost-boundary-violated',
        severity: 'blocking',
        lane_key: 'gears_execution',
        label: `${gearsCostGovernance.boundary_violation_count} 个 GEARS job 费用越界`,
        detail: `实际费用账本存在超授权 ${gearsCostGovernance.exceeded_authorization_count}、币种不一致 ${gearsCostGovernance.currency_mismatch_count}、缺失授权 ${gearsCostGovernance.authorization_missing_count}；完成财务复核与重新授权前不得交付。`,
        action_label: '复核并重新授权外部费用',
      });
    }
    if (gearsCostGovernance.pending_terminal_cost_report_count > 0) {
      addIssue({
        issue_id: 'gears-execution-cost-settlement-pending',
        severity: 'blocking',
        lane_key: 'gears_execution',
        label: `${gearsCostGovernance.pending_terminal_cost_report_count} 个终态 GEARS job 待费用结算`,
        detail: '已授权的外部 job 已进入终态，但 Provider 尚未通过 callback/status poll 回传实际费用与币种；结算完成前不得最终交付。',
        action_label: '同步 Provider 实际费用',
      });
    }
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
        action_key: activeGearsActionKey,
        label: localGearsAcceptanceAvailable ? '验收本地 GEARS job' : '同步活跃 GEARS job',
        detail: localGearsAcceptanceAvailable
          ? `${localActiveGearsCount} 个本地 mocked GEARS job 可写入 local acceptance artifact；不代表外部平台真实回片。`
          : `${gearsSummary.active} 个 GEARS job 仍在 submitted/queued/processing。`,
        priority: 55,
        lane_key: 'gears_execution',
      });
    }
    if (gearsSummary.local_acceptance_ready > 0 && gearsSummary.ready_without_external_artifact > 0) {
      addIssue({
        issue_id: 'gears-local-acceptance-only',
        severity: 'info',
        lane_key: 'gears_execution',
        label: `${gearsSummary.local_acceptance_ready} 个 GEARS job 为本地验收产物`,
        detail: '这些 ready job 使用 local_acceptance artifact 完成本地链路验收，不代表外部 GEARS/Seedance 已真实回片。',
      });
      addAction({
        action_key: 'export_gears_external_callback_handoff',
        label: '导出 GEARS 外部回片交接包',
        detail: `${gearsSummary.ready_without_external_artifact} 个 ready GEARS job 仍缺真实外部 artifact，需要交给外部 worker 回片并导入 callback。`,
        priority: 58,
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
        ? currentVersion?.production_board_export && seedancePlaceholderAssetCount === 0 && mediaProductionGapCount === 0 ? 'ready' : 'needs_action'
        : board.delivery_manifest.stage === 'blocked' ? 'blocked' : 'needs_action',
      score: Math.max(
        0,
        productionReadinessDeliveryScore(board.delivery_manifest.stage, Boolean(currentVersion?.production_board_export))
          - (seedancePlaceholderAssetCount > 0 ? 10 : 0)
          - (mediaProductionGapCount > 0 ? Math.min(25, mediaProductionGapCount * 3) : 0),
      ),
      detail: currentVersion?.production_board_export
        ? seedancePlaceholderAssetCount > 0
          ? `最近交付包已落盘：${currentVersion.production_board_export.file_count} 个文件；仍有 ${seedancePlaceholderAssetCount} 个占位参考图需替换。`
          : mediaProductionGapCount > 0
            ? `最近交付包已落盘：${currentVersion.production_board_export.file_count} 个文件；仍有 ${mediaProductionGapCount} 个媒体绑定未完成完整性、版权与真人审核。`
            : `最近交付包已落盘：${currentVersion.production_board_export.file_count} 个文件。`
        : board.delivery_manifest.next_action,
      count_text: `${board.delivery_manifest.ready_artifact_count}/${board.delivery_manifest.artifacts.length} artifacts`,
      evidence: [
        `stage ${board.delivery_manifest.stage}`,
        `placeholder_assets ${seedancePlaceholderAssetCount}`,
        `media_production_credit ${mediaProductionCreditCount}/${mediaBindingCount}`,
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
        ? `GEARS jobs external ready ${gearsSummary.external_ready}，local acceptance ${gearsSummary.local_acceptance_ready}，active ${gearsSummary.active}，failed ${gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled}。`
        : '尚未提交 GEARS job；等待从交付包建账本。',
      count_text: `jobs ${gearsSummary.total}`,
      evidence: [
        `external_ready ${gearsSummary.external_ready}`,
        `local_acceptance_ready ${gearsSummary.local_acceptance_ready}`,
        `missing_artifact ${gearsSummary.missing_artifact}`,
        `poll_failure ${gearsSummary.poll_failure}`,
      ],
      action_key: gearsSummary.total === 0 || gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled > 0
        ? 'submit_gears_jobs'
        : gearsSummary.active > 0
          ? activeGearsActionKey
          : gearsSummary.ready_without_external_artifact > 0
            ? 'export_gears_external_callback_handoff'
            : undefined,
      action_label: gearsSummary.total === 0
        ? '提交 GEARS'
        : gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled > 0
          ? '重提 GEARS'
          : gearsSummary.active > 0
            ? localGearsAcceptanceAvailable ? '本地验收' : '同步 GEARS'
            : gearsSummary.ready_without_external_artifact > 0
              ? '导出真实回片交接包'
              : undefined,
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
      status: currentVersion?.production_board_export
        && gearsSummary.total > 0
        && gearsSummary.ready_without_external_artifact === 0
        ? 'ready'
        : 'needs_action',
      score: Math.round(
        (currentVersion?.production_board_export ? 50 : 20)
        + (gearsSummary.total > 0 ? (gearsSummary.external_ready / gearsSummary.total) * 50 : 20),
      ),
      detail: currentVersion?.production_board_export && gearsSummary.total > 0
        ? gearsSummary.ready_without_external_artifact > 0
          ? `交付包和 GEARS 账本已具备，但仍有 ${gearsSummary.ready_without_external_artifact} 个 job 缺真实外部 artifact。`
          : '交付包、GEARS 账本和真实外部 artifact 已具备，可进入制作运营跟踪。'
        : '商业制作中台还缺交付包落盘或 GEARS job 账本。',
      count_text: `export ${currentVersion?.production_board_export ? 1 : 0} / gears ${gearsSummary.total}`,
      evidence: [
        `project_status ${detail.project.status}`,
        `version ${detail.project.current_version_id}`,
      ],
      action_key: !currentVersion?.production_board_export
        ? 'export_production_board'
        : gearsSummary.total === 0
          ? 'submit_gears_jobs'
          : gearsSummary.ready_without_external_artifact > 0
            ? 'export_gears_external_callback_handoff'
            : undefined,
      action_label: !currentVersion?.production_board_export
        ? '导出交付包'
        : gearsSummary.total === 0
          ? '提交 GEARS'
          : gearsSummary.ready_without_external_artifact > 0
            ? '导出真实回片交接包'
            : undefined,
    },
  ];

  const sortedNextActions = nextActions.sort((a, b) => a.priority - b.priority);
  const summary = buildProductionReadinessSummary(lanes, issues, sortedNextActions, {
    qualityScore,
    deliveryStage: board.delivery_manifest.stage,
    totalShotCount: shotCount,
    readyShotCount: shotStatusCounts.ready,
    failedShotCount: shotStatusCounts.failed,
    seedancePlaceholderAssetCount,
    seedanceProductionAssetReadyCount: mediaProductionCreditCount,
    gearsSummary,
  });
  const base: Omit<StoryProjectProductionReadinessReport, 'markdown'> = {
    schema_version: 'story-project-production-readiness/v1',
    scope: 'story_project',
    project: detail.project,
    title: detail.current_story.title,
    generated_at: new Date().toISOString(),
    summary,
    gears_operational_metrics: gearsOperationalMetrics,
    gears_recovery_plan: gearsRecoveryPlan,
    lanes,
    issues,
    next_actions: sortedNextActions,
    workflow: resolveStoryProjectWorkflow({
      project_id: detail.project.project_id,
      project_status: detail.project.status,
      readiness_status: summary.status,
      open_supplement_task_count: detail.project.open_supplement_task_count ?? 0,
      gears_job_count: summary.gears_job_count,
      external_ready_gears_job_count: summary.external_ready_gears_job_count,
      ready_without_external_gears_artifact_count: summary.ready_without_external_gears_artifact_count,
      next_actions: sortedNextActions,
      issues,
    }),
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
    updated_at: nextProjectUpdatedAt(project),
    production_readiness_automation_ledger: buildProductionReadinessAutomationRunLedger(
      project.production_readiness_automation_ledger,
      run,
    ),
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));
}

async function executeProjectReadinessAutomationStep(
  projectId: string,
  actionKey: string,
): Promise<ApiResponse<unknown>> {
  if (actionKey === 'repair_quality') return repairProjectQuality(projectId, {});
  if (actionKey === 'draft_production_material_fields') return draftProjectProductionMaterialFields(projectId);
  if (actionKey === 'repair_production_board') return repairAndExportProjectProductionBoard(projectId, { apply_all: true });
  if (actionKey === 'draft_seedance_asset_placeholders') return draftProjectSeedanceAssetPlaceholders(projectId);
  if (actionKey === 'export_production_board') return exportProjectProductionBoard(projectId);
  if (actionKey === 'export_retry_package') return exportProjectSeedanceRetryPackage(projectId);
  return fail(ErrorCodes.VALIDATION_ERROR, `Automation action "${actionKey}" is not executable for story projects`);
}

function productionAutomationSchemaVersion(data: unknown): string | undefined {
  return typeof data === 'object' && data !== null && 'schema_version' in data
    ? String((data as { schema_version?: unknown }).schema_version)
    : undefined;
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
  const exportedAt = nextProjectUpdatedAt(project);
  const sanitizedGearsJobLedger = sanitizeGearsJobLedgerPayloadSummaries(project.gears_job_ledger, exportedAt);
  const exportDir = resolve(projectDir(project.project_id), 'production-board');
  const exportStore = new FileArtifactStore(exportDir);

  const files: StoryProductionBoardExportFile[] = [];
  const writeExportFile = async (
    fileId: string,
    kind: StoryProductionBoardExportFile['kind'],
    label: string,
    filename: string,
    content: string,
    mimeType: string,
  ) => {
    const artifact = await exportStore.writeText(filename, content, { overwrite: 'replace' });
    files.push({
      file_id: fileId,
      kind,
      label,
      relative_path: `production-board/${filename}`,
      file_path: artifact.absolute_path,
      mime_type: mimeType,
      byte_size: artifact.byte_size,
    });
  };

  for (const definition of buildProductionBoardExportFileDefinitions(board)) {
    await writeExportFile(
      definition.fileId,
      definition.kind,
      definition.label,
      definition.filename,
      definition.content,
      definition.mimeType,
    );
  }
  const manifestDefinition = buildProductionBoardDeliveryManifestDefinition({
    projectId: project.project_id,
    board,
    exportedAt,
    files,
  });
  await writeExportFile(
    manifestDefinition.fileId,
    manifestDefinition.kind,
    manifestDefinition.label,
    manifestDefinition.filename,
    manifestDefinition.content,
    manifestDefinition.mimeType,
  );

  const updatedProject: StoryProjectMeta = {
    ...project,
    status: project.status === 'finalized' ? 'finalized' : 'exported',
    updated_at: exportedAt,
    gears_job_ledger: sanitizedGearsJobLedger.ledger,
  };
  const currentSnapshot = await projectRepository().readVersion(
    project.project_id,
    project.current_version_id,
  );
  if (!currentSnapshot) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      `Project "${project.project_id}" current version is unavailable`,
    );
  }
  await projectRepository().writeCurrentState(
    updatedProject,
    {
      ...currentSnapshot,
      production_board_export: {
        exported_at: exportedAt,
        export_dir: exportDir,
        file_count: files.length,
        delivery_stage: board.delivery_manifest.stage,
        delivery_stage_label: board.delivery_manifest.stage_label,
      },
    },
    projectMetaExpectation(project),
  );

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
  if (!versions.length) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" has no version snapshots`);
  }
  const currentVersion = versions.find(version => version.version_id === project.current_version_id);
  if (!currentVersion) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" current version "${project.current_version_id}" is unavailable`);
  }

  const exportedAt = nextProjectUpdatedAt(project);
  const updatedProject: StoryProjectMeta = {
    ...project,
    status: project.status === 'finalized' ? 'finalized' : 'exported',
    updated_at: exportedAt,
  };
  await projectRepository().writeMeta(updatedProject, projectMetaExpectation(project));

  const story = normalizeStoryGenerationFields(currentVersion.story);
  return success(buildProjectExportPackage({
    project: updatedProject,
    story,
    exportedAt,
  }));
}

export async function exportProjectKnowledgeCandidates(
  projectId: string,
): Promise<ApiResponse<ProjectKnowledgeCandidateExportPackage>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return fail(ErrorCodes.STORY_NOT_FOUND, detailResult.error?.message ?? `Project "${projectId}" not found`);
  }

  const { project, current_story } = detailResult.data;
  const supplementBoundary = await getStoryDomainSupplementEditBoundary(current_story);
  if (supplementBoundary.guidance.candidate_kind !== 'domain_knowledge_candidate') {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `Domain pack \"${supplementBoundary.persistence.domain_id}\" exposes project-only supplement candidates, not formal knowledge candidates.`,
      {
        supplement_guidance: supplementBoundary.guidance,
        persistence: supplementBoundary.persistence,
      },
    );
  }
  const exportedAt = new Date().toISOString();
  const items = (current_story.supplement_tasks ?? [])
    .filter(task => Boolean(task.knowledge_candidate_markdown))
    .map(task => ({
      task_id: task.task_id,
      label: task.label,
      source: task.source,
      stage: task.stage,
      blocking_level: task.blocking_level,
      recommended_fields: task.recommended_fields,
      updated_at: task.updated_at ?? task.resolved_at,
      review_status: task.knowledge_candidate_review_status,
      review_note: task.knowledge_candidate_review_note,
      markdown: task.knowledge_candidate_markdown!,
      writeback_draft_markdown: task.knowledge_writeback_draft_markdown,
      writeback_status: task.knowledge_writeback_status,
      writeback_note: task.knowledge_writeback_note,
    }));
  const markdown = [
    `# ${project.title} ${supplementBoundary.guidance.candidate_heading}`,
    '',
    `- 项目 ID：${project.project_id}`,
    `- 来源条目：${project.source_entry}`,
    `- 成片类型：${project.video_type}`,
    `- 导出时间：${exportedAt}`,
    `- 候选稿数量：${items.length}`,
    '',
    `> ${supplementBoundary.guidance.human_review_requirement}`,
    '',
    ...items.flatMap((item, index) => [
      `---`,
      '',
      `## ${index + 1}. ${item.label}`,
      '',
      item.markdown,
      '',
      ...(item.writeback_draft_markdown
        ? ['### 已通过审稿的正式写入草案', '', item.writeback_draft_markdown, '']
        : []),
    ]),
  ].join('\n');

  return success({
    schema_version: 'project-knowledge-candidates/v1',
    exported_at: exportedAt,
    project_id: project.project_id,
    project_title: project.title,
    source_entry: project.source_entry,
    video_type: project.video_type,
    candidate_count: items.length,
    markdown,
    items,
  });
}

export async function exportProjectKnowledgeWritebackPatch(
  projectId: string,
): Promise<ApiResponse<ProjectKnowledgeWritebackPatchPackage>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return fail(ErrorCodes.STORY_NOT_FOUND, detailResult.error?.message ?? `Project "${projectId}" not found`);
  }

  const { project, current_story } = detailResult.data;
  const exportedAt = new Date().toISOString();
  const target = await planStoryDomainKnowledgeWriteback(current_story);
  if (!target.eligible || !target.suggested_file_path || !target.suggested_section_heading) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `Domain pack "${target.domain_id}" does not expose an eligible knowledge writeback target for this story.`,
      target,
    );
  }
  const items = (current_story.supplement_tasks ?? [])
    .filter(task => (
      task.knowledge_candidate_review_status === 'approved'
      && Boolean(task.knowledge_writeback_draft_markdown)
    ))
    .map(task => {
      const appendMarkdown = buildKnowledgeWritebackAppendMarkdown(current_story, task, exportedAt);
      return {
        task_id: task.task_id,
        label: task.label,
        source_entry: current_story.source_entry,
        suggested_file_path: target.suggested_file_path!,
        suggested_section_heading: target.suggested_section_heading!,
        review_note: task.knowledge_candidate_review_note,
        writeback_status: task.knowledge_writeback_status,
        writeback_note: task.knowledge_writeback_note,
        append_markdown: appendMarkdown,
        writeback_draft_markdown: task.knowledge_writeback_draft_markdown!,
      };
    });
  const targetFiles = [...new Set(items.map(item => item.suggested_file_path))];
  const prTitle = `补充 ${project.title} 生产素材候选稿`;
  const prBody = [
    `## 变更目的`,
    '',
    `将项目「${project.title}」中已通过审稿的生产素材候选稿整理为知识库写入草案。`,
    '',
    `## 待写入文件`,
    '',
    ...(targetFiles.length ? targetFiles.map(file => `- ${file}`) : ['- 暂无可写入草案']),
    '',
    `## 人工核实要求`,
    '',
    '- 补齐正式来源、地点、核实方法和待核点。',
    '- 确认内容适用于原始文化条目，而不只是当前项目。',
    '- 只在人工审稿且 Domain Pack 目标复核通过后复制 append_markdown。',
  ].join('\n');
  const markdown = [
    `# ${project.title} 领域知识库写入 Patch 草案`,
    '',
    `- 项目 ID：${project.project_id}`,
    `- 来源条目：${project.source_entry}`,
    `- 导出时间：${exportedAt}`,
    `- 已通过候选稿：${items.length}`,
    '',
    '## PR 草案',
    '',
    `### Title`,
    '',
    prTitle,
    '',
    `### Body`,
    '',
    prBody,
    '',
    '## 文件 Patch 草案',
    '',
    ...items.flatMap((item, index) => [
      `### ${index + 1}. ${item.label}`,
      '',
      `- 建议文件：${item.suggested_file_path}`,
      `- 建议位置：${item.suggested_section_heading}`,
      `- 审稿备注：${item.review_note || '未填写'}`,
      `- 入库状态：${item.writeback_status || 'draft_ready'}`,
      `- 入库备注：${item.writeback_note || '未填写'}`,
      '',
      '```markdown',
      item.append_markdown,
      '```',
      '',
    ]),
  ].join('\n');

  return success({
    schema_version: 'project-knowledge-writeback-patch/v1',
    exported_at: exportedAt,
    project_id: project.project_id,
    project_title: project.title,
    source_entry: project.source_entry,
    approved_count: items.length,
    target_files: targetFiles,
    pr_title: prTitle,
    pr_body: prBody,
    markdown,
    items,
  });
}

export async function exportProjectSupplementCandidatePackage(
  filters: Pick<ProjectSupplementTaskListFilters, 'project_id' | 'video_type' | 'province' | 'status' | 'stage' | 'blocking_level' | 'source' | 'knowledge_writeback_status' | 'task_keys' | 'search_query'> = {},
): Promise<ApiResponse<ProjectSupplementCandidateExportPackage>> {
  const exportedAt = new Date().toISOString();
  const taskKeySet = new Set((filters.task_keys ?? []).map(item => item.trim()).filter(Boolean));
  const searchQuery = filters.search_query?.trim();
  const tasksResult = await listProjectSupplementTasks({
    project_id: filters.project_id,
    video_type: filters.video_type,
    province: filters.province,
    status: filters.status,
    stage: filters.stage,
    blocking_level: filters.blocking_level,
    source: filters.source,
    knowledge_writeback_status: filters.knowledge_writeback_status,
  });
  if (!tasksResult.ok || !tasksResult.data) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      tasksResult.error?.message ?? 'Failed to list supplement candidate tasks',
    );
  }

  const items: ProjectSupplementCandidateExportPackage['items'] = tasksResult.data
    .map(item => ({
      ...item,
      task_key: knowledgeWritebackTaskKey(item.project_id, item.task.task_id),
    }))
    .filter(item => taskKeySet.size === 0 || taskKeySet.has(item.task_key))
    .filter(item => !searchQuery || supplementCandidateSearchText(item).includes(searchQuery.toLowerCase()));
  const targetFiles = [...new Set(items.map(item => item.suggested_file_path).filter((item): item is string => Boolean(item)))];
  const projectCount = new Set(items.map(item => item.project_id)).size;
  const openItems = items.filter(item => item.task.status === 'open');
  const blockingOpenCount = openItems.filter(item => item.task.blocking_level === 'blocking').length;
  const riskOpenCount = openItems.filter(item => item.task.blocking_level === 'risk').length;
  const optionalOpenCount = openItems.filter(item => item.task.blocking_level === 'optional').length;
  const exportFilters: ProjectSupplementCandidateExportPackage['filters'] = {
    ...(filters.project_id ? { project_id: filters.project_id } : {}),
    ...(filters.video_type ? { video_type: filters.video_type } : {}),
    ...(filters.province ? { province: filters.province } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.blocking_level ? { blocking_level: filters.blocking_level } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.knowledge_writeback_status ? { knowledge_writeback_status: filters.knowledge_writeback_status } : {}),
    ...(searchQuery ? { search_query: searchQuery } : {}),
    ...(taskKeySet.size > 0 ? { task_key_count: taskKeySet.size } : {}),
  };
  const markdown = [
    '# Story Agent 素材补库候选包',
    '',
    `- 导出时间：${exportedAt}`,
    `- 当前筛选任务：${items.length}`,
    `- 待补任务：${openItems.length}`,
    `- 分级：当前阻断 ${blockingOpenCount} / 需核验 ${riskOpenCount} / 生产前补充 ${optionalOpenCount}`,
    `- 涉及项目：${projectCount}`,
    `- 涉及目标文件：${targetFiles.length > 0 ? targetFiles.join('、') : '待人工判定'}`,
    '- 写回策略：只生成候选稿、审稿材料和人工写回草案；不直接修改 Domain Pack 目标文件。',
    '',
    ...items.flatMap((item, index) => supplementCandidateMarkdownSection(item, index)),
  ].join('\n');

  return success({
    schema_version: 'project-supplement-candidate-package/v1',
    exported_at: exportedAt,
    filters: exportFilters,
    task_count: items.length,
    open_task_count: openItems.length,
    blocking_open_count: blockingOpenCount,
    risk_open_count: riskOpenCount,
    optional_open_count: optionalOpenCount,
    project_count: projectCount,
    target_files: targetFiles,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    markdown,
    items,
  });
}

export async function exportProjectKnowledgeWritebackQueuePatch(
  filters: Pick<ProjectSupplementTaskListFilters, 'project_id' | 'video_type' | 'province' | 'knowledge_writeback_status' | 'task_keys' | 'search_query'> = {},
): Promise<ApiResponse<ProjectKnowledgeWritebackPatchPackage>> {
  const exportedAt = new Date().toISOString();
  const taskKeySet = new Set((filters.task_keys ?? []).map(item => item.trim()).filter(Boolean));
  const searchQuery = filters.search_query?.trim();
  const tasksResult = await listProjectSupplementTasks({
    project_id: filters.project_id,
    video_type: filters.video_type,
    province: filters.province,
    knowledge_writeback_status: filters.knowledge_writeback_status,
  });
  if (!tasksResult.ok || !tasksResult.data) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      tasksResult.error?.message ?? 'Failed to list writeback queue tasks',
    );
  }

  const detailCache = new Map<string, NonNullable<Awaited<ReturnType<typeof getProject>>['data']>>();
  const items: ProjectKnowledgeWritebackPatchPackage['items'] = [];
  const explicitlyBlockedTask = filters.project_id
    ? tasksResult.data.find(item => (
        isKnowledgeWritebackReadyTask(item.task)
        && !item.knowledge_writeback_eligible
      ))
    : undefined;
  if (explicitlyBlockedTask) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `Domain pack "${explicitlyBlockedTask.source_domain}" does not expose an eligible knowledge writeback target for project "${explicitlyBlockedTask.project_id}".`,
      {
        project_id: explicitlyBlockedTask.project_id,
        source_domain: explicitlyBlockedTask.source_domain,
        blockers: explicitlyBlockedTask.knowledge_writeback_blockers,
        direct_writeback_allowed: false,
        writeback_performed: false,
        real_credit_granted: false,
      },
    );
  }
  for (const item of tasksResult.data) {
    const task = item.task;
    const taskKey = knowledgeWritebackTaskKey(item.project_id, task.task_id);
    if (taskKeySet.size > 0 && !taskKeySet.has(taskKey)) continue;
    if (
      task.knowledge_candidate_review_status !== 'approved'
      || !task.knowledge_writeback_draft_markdown
      || !item.knowledge_writeback_eligible
      || !item.suggested_file_path
      || !item.suggested_section_heading
    ) {
      continue;
    }

    let detail = detailCache.get(item.project_id);
    if (!detail) {
      const detailResult = await getProject(item.project_id);
      if (!detailResult.ok || !detailResult.data) continue;
      detail = detailResult.data;
      detailCache.set(item.project_id, detail);
    }

    const appendMarkdown = buildKnowledgeWritebackAppendMarkdown(detail.current_story, task, exportedAt);
    items.push({
      task_key: taskKey,
      project_id: item.project_id,
      project_title: item.project_title,
      video_type: item.video_type,
      target_province: item.target_province,
      task_id: task.task_id,
      label: task.label,
      source_entry: detail.current_story.source_entry,
      suggested_file_path: item.suggested_file_path,
      suggested_section_heading: item.suggested_section_heading,
      review_note: task.knowledge_candidate_review_note,
      writeback_status: task.knowledge_writeback_status,
      writeback_note: task.knowledge_writeback_note,
      append_markdown: appendMarkdown,
      writeback_draft_markdown: task.knowledge_writeback_draft_markdown,
    });
  }

  const targetFiles = [...new Set(items.map(item => item.suggested_file_path))];
  const projectTitles = [...new Set(items.map(item => item.project_title).filter((item): item is string => Boolean(item)))];
  const projectCount = new Set(items.map(item => item.project_id).filter(Boolean)).size;
  const statusCounts = countKnowledgeWritebackStatuses(items);
  const statusCountText = formatKnowledgeWritebackStatusCounts(statusCounts);
  const statusText = filters.knowledge_writeback_status ?? 'all';
  const videoTypeText = filters.video_type ?? 'all';
  const provinceText = filters.province ?? 'all';
  const exportFilters: ProjectKnowledgeWritebackPatchPackage['filters'] = {
    ...(filters.project_id ? { project_id: filters.project_id } : {}),
    ...(filters.video_type ? { video_type: filters.video_type } : {}),
    ...(filters.province ? { province: filters.province } : {}),
    ...(filters.knowledge_writeback_status ? { knowledge_writeback_status: filters.knowledge_writeback_status } : {}),
    ...(searchQuery ? { search_query: searchQuery } : {}),
    ...(taskKeySet.size > 0 ? { task_key_count: taskKeySet.size } : {}),
  };
  const prTitle = filters.project_id
    ? `补充 ${projectTitles[0] ?? filters.project_id} 写回队列候选稿`
    : `批量补充 Story Agent 写回队列候选稿`;
  const prBody = [
    `## 变更目的`,
    '',
    '将 Story Agent 写回队列中已通过审稿且通过 Domain Pack 目标计划的生产素材候选稿整理为知识库写入草案。',
    '',
    `## 导出范围`,
    '',
    `- 项目筛选：${filters.project_id ?? '全部项目'}`,
    `- 片型筛选：${videoTypeText}`,
    `- 省份筛选：${provinceText}`,
    `- 写回状态：${statusText}`,
    `- 搜索条件：${searchQuery || '无'}`,
    `- 可见任务键：${taskKeySet.size ? `${taskKeySet.size} 条` : '未指定'}`,
    `- 涉及项目：${projectCount}`,
    `- 状态汇总：${statusCountText}`,
    '',
    `## 待写入文件`,
    '',
    ...(targetFiles.length ? targetFiles.map(file => `- ${file}`) : ['- 暂无可写入草案']),
    '',
    `## 人工核实要求`,
    '',
    '- 补齐正式来源、地点、核实方法和待核点。',
    '- 确认内容适用于原始文化条目，而不只是当前项目。',
    '- 只在人工审稿且 Domain Pack 目标复核通过后复制 append_markdown。',
  ].join('\n');
  const markdown = [
    `# Story Agent 写回队列 Patch 草案`,
    '',
    `- 导出时间：${exportedAt}`,
    `- 项目筛选：${filters.project_id ?? '全部项目'}`,
    `- 片型筛选：${videoTypeText}`,
    `- 省份筛选：${provinceText}`,
    `- 写回状态：${statusText}`,
    `- 搜索条件：${searchQuery || '无'}`,
    `- 可见任务键：${taskKeySet.size ? `${taskKeySet.size} 条` : '未指定'}`,
    `- 涉及项目：${projectCount}`,
    `- 状态汇总：${statusCountText}`,
    `- 已通过候选稿：${items.length}`,
    `- 目标文件数：${targetFiles.length}`,
    '',
    '## PR 草案',
    '',
    `### Title`,
    '',
    prTitle,
    '',
    `### Body`,
    '',
    prBody,
    '',
    '## 文件 Patch 草案',
    '',
    ...items.flatMap((item, index) => [
      `### ${index + 1}. ${item.label}`,
      '',
      `- 项目：${item.project_title || item.project_id || '未记录'}`,
      `- 成片类型：${item.video_type || '未记录'}`,
      `- 来源条目：${item.source_entry}`,
      `- 目标省份：${item.target_province || '待确认'}`,
      `- 建议文件：${item.suggested_file_path}`,
      `- 建议位置：${item.suggested_section_heading}`,
      `- 审稿备注：${item.review_note || '未填写'}`,
      `- 入库状态：${item.writeback_status || 'draft_ready'}`,
      `- 入库备注：${item.writeback_note || '未填写'}`,
      '',
      '```markdown',
      item.append_markdown,
      '```',
      '',
    ]),
  ].join('\n');

  return success({
    schema_version: 'project-knowledge-writeback-patch/v1',
    exported_at: exportedAt,
    project_id: filters.project_id ?? 'multiple-projects',
    project_title: filters.project_id ? projectTitles[0] ?? filters.project_id : 'Story Agent 写回队列',
    source_entry: filters.project_id ? '项目写回队列' : '多个项目',
    filters: exportFilters,
    approved_count: items.length,
    project_count: projectCount,
    status_counts: statusCounts,
    target_files: targetFiles,
    pr_title: prTitle,
    pr_body: prBody,
    markdown,
    items,
  });
}

const KNOWLEDGE_WRITEBACK_STATUSES: KnowledgeWritebackStatus[] = [
  'draft_ready',
  'queued',
  'written_back',
  'needs_revision',
];

function supplementCandidateSearchText(
  item: ProjectSupplementCandidateExportPackage['items'][number],
): string {
  const task = item.task;
  return [
    item.task_key,
    item.project_id,
    item.project_title,
    item.source_domain,
    item.source_entry,
    item.video_type,
    item.knowledge_writeback_eligible ? 'writeback eligible' : 'writeback blocked',
    ...item.knowledge_writeback_blockers,
    item.target_province ?? '',
    item.suggested_file_path ?? '',
    item.suggested_section_heading ?? '',
    task.label,
    task.description,
    task.category ?? '',
    task.stage ?? '',
    task.blocking_level ?? '',
    task.source,
    task.recommended_question ?? '',
    task.intake_prompt ?? '',
    task.supplement_note ?? '',
    task.knowledge_candidate_markdown ?? '',
    task.knowledge_writeback_draft_markdown ?? '',
    task.knowledge_candidate_review_note ?? '',
    task.knowledge_writeback_note ?? '',
    ...(task.affects ?? []),
    ...(task.recommended_fields ?? []),
    ...Object.values(task.supplement_field_values ?? {}),
  ].join(' ').toLowerCase();
}

function supplementCandidateMarkdownSection(
  item: ProjectSupplementCandidateExportPackage['items'][number],
  index: number,
): string[] {
  const task = item.task;
  return [
    `## ${index + 1}. ${task.label}`,
    '',
    `- task_key：${item.task_key}`,
    `- project_id：${item.project_id}`,
    `- 项目：${item.project_title}`,
    `- Domain Pack：${item.source_domain}`,
    `- 来源条目：${item.source_entry}`,
    `- 类型：${item.video_type}`,
    `- 正式知识写回：${item.knowledge_writeback_eligible ? '可进入人工复核' : '已阻断'}`,
    `- 写回阻断：${item.knowledge_writeback_blockers.join('；') || '无'}`,
    `- 目标省份：${item.target_province ?? '待人工判定'}`,
    `- 建议目标文件：${item.suggested_file_path ?? '待人工判定'}`,
    `- 建议目标位置：${item.suggested_section_heading ?? '待人工判定'}`,
    `- 来源类型：${task.source}`,
    `- 阶段：${task.stage ?? '未标注'}`,
    `- 分级：${task.blocking_level ?? '未标注'}`,
    `- 类别：${task.category ?? 'general'}`,
    `- 更新时间：${task.updated_at ?? task.resolved_at ?? item.updated_at}`,
    '',
    '### 缺口说明',
    '',
    task.description,
    '',
    ...(task.recommended_fields?.length
      ? ['### 建议补充字段', '', ...task.recommended_fields.map(field => `- ${field}`), '']
      : []),
    ...(task.affects?.length
      ? ['### 影响范围', '', ...task.affects.map(affect => `- ${affect}`), '']
      : []),
    ...(task.intake_prompt
      ? ['### 采集提示', '', task.intake_prompt, '']
      : []),
    ...(task.supplement_note
      ? ['### 已记录补充说明', '', task.supplement_note, '']
      : []),
    ...(task.supplement_field_values && Object.keys(task.supplement_field_values).length > 0
      ? [
          '### 已填写字段',
          '',
          ...Object.entries(task.supplement_field_values).map(([field, value]) => `- ${field}：${value}`),
          '',
        ]
      : []),
    ...(task.knowledge_candidate_markdown
      ? ['### 现有补素材候选稿', '', task.knowledge_candidate_markdown, '']
      : []),
    ...(task.knowledge_writeback_draft_markdown
      ? ['### 现有正式写入草案', '', task.knowledge_writeback_draft_markdown, '']
      : []),
  ];
}

function knowledgeWritebackTaskKey(projectId: string, taskId: string): string {
  return `${projectId}::${taskId}`;
}

function countKnowledgeWritebackStatuses(
  items: ProjectKnowledgeWritebackPatchPackage['items'],
): Record<KnowledgeWritebackStatus, number> {
  const counts = Object.fromEntries(KNOWLEDGE_WRITEBACK_STATUSES.map(status => [status, 0])) as Record<KnowledgeWritebackStatus, number>;
  items.forEach(item => {
    counts[item.writeback_status ?? 'draft_ready'] += 1;
  });
  return counts;
}

function formatKnowledgeWritebackStatusCounts(counts: Record<KnowledgeWritebackStatus, number>): string {
  return KNOWLEDGE_WRITEBACK_STATUSES.map(status => `${status}=${counts[status] ?? 0}`).join(', ');
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
    story_publishable: params.story.quality_report?.quality_gates?.story_publishable
      ?? params.story.quality_report?.passed,
    production_ready: params.story.quality_report?.quality_gates?.production_ready,
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
    if (filters.project_id && project.project_id !== filters.project_id) continue;
    if (filters.video_type && project.video_type !== filters.video_type) continue;
    const detailResult = await getProject(project.project_id);
    if (!detailResult.ok || !detailResult.data) continue;
    const writebackTarget = await planStoryDomainKnowledgeWriteback(detailResult.data.current_story);
    if (filters.province && writebackTarget.target_region !== filters.province) continue;
    for (const task of detailResult.data.current_story.supplement_tasks ?? []) {
      if (filters.status && task.status !== filters.status) continue;
      if (filters.stage && task.stage !== filters.stage) continue;
      if (filters.blocking_level && task.blocking_level !== filters.blocking_level) continue;
      if (filters.source && task.source !== filters.source) continue;
      if (
        filters.knowledge_writeback_ready
        && (!writebackTarget.eligible || !isKnowledgeWritebackReadyTask(task))
      ) continue;
      if (filters.knowledge_writeback_status) {
        if (!writebackTarget.eligible || !isKnowledgeWritebackReadyTask(task)) continue;
        const writebackStatus = task.knowledge_writeback_status
          ?? (task.knowledge_writeback_draft_markdown ? 'draft_ready' : undefined);
        if (writebackStatus !== filters.knowledge_writeback_status) continue;
      }
      items.push({
        project_id: project.project_id,
        current_story_id: project.current_story_id,
        project_title: project.title,
        source_domain: writebackTarget.domain_id,
        source_entry: project.source_entry,
        video_type: project.video_type,
        knowledge_writeback_eligible: writebackTarget.eligible,
        knowledge_writeback_blockers: [...writebackTarget.blockers],
        target_province: writebackTarget.target_region,
        suggested_file_path: writebackTarget.suggested_file_path,
        suggested_section_heading: writebackTarget.suggested_section_heading,
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

function isKnowledgeWritebackReadyTask(task: KnowledgeSupplementTask): boolean {
  return Boolean(
    task.knowledge_candidate_review_status === 'approved'
    && task.knowledge_writeback_draft_markdown,
  );
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
  if (
    project.creation_use_case
    && project.truth_mode
    && project.material_sufficiency
    && project.creation_contract
    && project.story_publishable !== undefined
    && project.production_ready !== undefined
  ) {
    return project;
  }
  const versions = await readVersionSnapshots(project.project_id);
  const currentVersion = versions.find(version => version.version_id === project.current_version_id);
  if (!currentVersion) return project;
  if (!currentVersion.story) return project;
  return hydrateProjectMetaForStory(project, normalizeStoryGenerationFields(currentVersion.story));
}

function hydrateProjectMetaForStory(project: StoryProjectMeta, story: StoryGenerateResult): StoryProjectMeta {
  const hydratedQuality = qualitySummary(story);
  return {
    ...project,
    source_domain: resolveStorySourceDomain(story),
    story_structure: project.story_structure ?? story.story_structure,
    creation_use_case: project.creation_use_case ?? story.creation_use_case,
    truth_mode: project.truth_mode ?? story.truth_mode,
    material_sufficiency: project.material_sufficiency ?? story.material_sufficiency,
    creation_contract: project.creation_contract ?? story.creation_contract,
    // Preserve the historical aggregate fields stored in project.json. Read-time
    // enrichment may apply newer workflow checks; it should only backfill the new
    // dual-status contract, not silently rewrite legacy summary semantics.
    story_publishable: hydratedQuality.story_publishable ?? project.story_publishable,
    production_ready: hydratedQuality.production_ready ?? project.production_ready,
  };
}

async function updateSourceStory(
  story: Pick<StoryGenerateResult, 'storyId' | 'video_type'>,
  updater: (raw: StoredStoryFile) => StoredStoryFile,
  generatedRootOverride?: string,
): Promise<void> {
  const sourcePath = storySourcePath(story, generatedRootOverride);
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

  try {
    await persistProjectVersion(
      project,
      updatedStory,
      'scene_regeneration',
      [request.scene_id],
      buildRegenerationNote(request),
    );
  } catch (error) {
    const validationFailure = derivedStateValidationFailure<StoryProjectDetail>(error);
    if (validationFailure) return validationFailure;
    throw error;
  }

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

  if (!trace.applied) {
    return getProject(projectId);
  }

  try {
    await persistProjectVersion(
      project,
      updatedStory,
      'quality_repair',
      changedSceneIds,
      buildQualityRepairNote(trace),
    );
  } catch (error) {
    const validationFailure = derivedStateValidationFailure<StoryProjectDetail>(error);
    if (validationFailure) return validationFailure;
    throw error;
  }

  return getProject(projectId);
}

const QUALITY_REPAIR_PROMPT_PROTECTED_FIELDS = [
  'storyId',
  'project_id',
  'sourceDomain',
  'source_entry',
  'original_user_query',
  'video_type',
  'presentation_style',
  'story_structure',
  'story_blueprint.evidence_boundaries',
  'creation_contract',
  'material_sufficiency',
  'material_pack',
  'credibility_note',
  'domain_safety',
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

async function buildQualityRepairPromptText(input: {
  story: StoryGenerateResult;
  actions: QualityRepairAction[];
  targetSceneIds: number[];
  request: StoryQualityRepairPromptRequest;
}): Promise<string> {
  const { story, actions, targetSceneIds, request } = input;
  const revisionBoundary = await getStoryDomainRevisionEditBoundary(story);
  const revisionGuidance = revisionBoundary.guidance;
  const quality = story.quality_report;
  const familyGuidance = getStoryFamilyRepairGuidance(story.video_type);
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
    `你是${revisionGuidance.writer_role}，本次以${familyGuidance.writer_role}职责修订。请输出一个完整 repaired_story_json。`,
    '',
    '硬性输出规则：',
    '1. 只输出一个 JSON 对象，不要 Markdown、解释、代码围栏或额外文本。',
    '2. JSON 根对象必须是完整 StoryGenerateResult；不要只输出 patch/diff。',
    '3. 保留 storyId、project_id、source_entry、video_type、presentation_style、story_structure、story_blueprint.evidence_boundaries、creation_contract、material_sufficiency、material_pack 和 credibility_note，除非修复动作明确要求调整。',
    '4. 同步修复 full_text、scene_breakdown、gears_segments 和 quality_report，避免正文、分场和 GEARS 单元互相矛盾。',
    '5. script_text 只写观众可听/可见的剧本内容；visual_prompt 只写可见画面元素；camera_suggestion 只写镜头语言；validation_notes 不得混入提示词字段。',
    ...revisionGuidance.source_boundary_rules.map((rule, index) => `${index + 6}. ${rule}`),
    `${revisionGuidance.source_boundary_rules.length + 6}. ${revisionGuidance.human_review_requirement}`,
    '',
    '持久化禁写合同：',
    ...formatStoryDomainEditPersistenceBoundary(revisionBoundary.persistence).map(line => `- ${line}`),
    '- 只输出修订 JSON；实际保存只能由 Story Agent 项目版本接口在合同允许范围内执行。',
    '',
    `${familyGuidance.family_label}家族修复合同：`,
    ...familyGuidance.instructions.map(instruction => `- ${instruction}`),
    `- 优先修改字段：${familyGuidance.focus_fields.join('、')}`,
    ...(quality?.family_quality_report?.checks
      .filter(check => check.status === 'failed')
      .map(check => `- 待修门禁 [${check.check_id}] ${check.label}：${check.summary}`) ?? []),
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
      family_quality_report: quality?.family_quality_report,
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
  const prompt = await buildQualityRepairPromptText({
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
  'sourceDomain',
  'source_entry',
  'original_user_query',
  'video_type',
  'presentation_style',
  'story_structure',
  'knowledge_pack',
  'material_pack',
  'creation_contract',
  'material_sufficiency',
  'domain_safety',
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
    sourceDomain: current.sourceDomain,
    source_entry: current.source_entry,
    original_user_query: current.original_user_query,
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
    domain_safety: current.domain_safety,
    generation_source: current.generation_source,
    generation_mode: current.generation_mode,
    generation_used_fallback: current.generation_used_fallback,
  };
}

function revalidateRepairedStory(story: StoryGenerateResult): StoryGenerateResult {
  const normalized = normalizeStoryGenerationFields(story);
  const baseQualityReport = validateStoryFamilyBaseQuality(normalized, {
    selectedEvent: normalized.story_blueprint?.central_event ?? normalized.title,
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
  const revisionBoundary = await getStoryDomainRevisionEditBoundary(current_story);
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
  const domainSafety = await revalidateStoryDomainRevision(candidate);
  if (domainSafety) candidate.domain_safety = domainSafety;
  if (domainSafety && !domainSafety.passed) {
    return fail(
      ErrorCodes.DOMAIN_SAFETY_VALIDATION_FAILED,
      `Repaired story failed the ${domainSafety.domain} safety boundary`,
      domainSafety,
    );
  }
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

  if (!isStoryDomainEditPersistenceBoundarySafe(revisionBoundary.persistence)) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      `Domain pack \"${revisionBoundary.persistence.domain_id}\" exposed an unsafe story revision persistence boundary.`,
      revisionBoundary.persistence,
    );
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
  try {
    await persistProjectVersion(
      project,
      storyToPersist,
      'quality_repair',
      sceneIdsChanged.length > 0 ? sceneIdsChanged : current_story.scene_breakdown.map(scene => scene.scene_id),
      request.user_instruction?.trim() || '应用模型修复 JSON',
    );
  } catch (error) {
    const validationFailure = derivedStateValidationFailure<StoryQualityRepairApplyResult>(error);
    if (validationFailure) return validationFailure;
    throw error;
  }
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

  let updatedMeta: StoryProjectMeta;
  try {
    updatedMeta = await persistProjectVersion(
      project,
      repair.story,
      'production_board_repair',
      repair.trace.changed_scene_ids,
      repair.trace.note,
    );
  } catch (error) {
    const validationFailure = derivedStateValidationFailure<StoryProductionBoardRepairResult>(error);
    if (validationFailure) return validationFailure;
    throw error;
  }
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

export async function draftProjectProductionMaterialFields(
  projectId: string,
): Promise<ApiResponse<ProjectDraftProductionMaterialFieldsResult>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      detailResult.error?.message ?? `Project "${projectId}" not found`,
      detailResult.error?.details,
    );
  }

  const story = detailResult.data.current_story;
  const productionMaterialGuidance = await getStoryDomainProductionMaterialGuidance(story);
  const generatedAt = new Date().toISOString();
  const tasks = projectProductionMaterialDraftableTasks(story);
  const draftedTasks: ProjectDraftProductionMaterialFieldsResult['drafted_tasks'] = [];
  const skippedTasks: ProjectDraftProductionMaterialFieldsResult['skipped_tasks'] = [];

  for (const task of tasks) {
    const fieldValues = await productionMaterialDraftFieldValues(story, task, productionMaterialGuidance);
    const fieldIds = Object.keys(fieldValues);
    if (fieldIds.length === 0) {
      skippedTasks.push({
        task_id: task.task_id,
        label: task.label,
        reason: 'No supported production material field could be drafted from the current story.',
      });
      continue;
    }

    const updateResult = await updateProjectSupplementTask(projectId, task.task_id, {
      status: 'resolved',
      supplement_field_values: fieldValues,
    });
    if (!updateResult.ok) {
      skippedTasks.push({
        task_id: task.task_id,
        label: task.label,
        reason: updateResult.error?.message ?? 'Failed to update supplement task.',
      });
      continue;
    }

    draftedTasks.push({
      task_id: task.task_id,
      label: task.label,
      field_ids: fieldIds,
      field_values: fieldValues,
    });
  }

  const afterDetail = await getProject(projectId);
  const afterStory = afterDetail.ok && afterDetail.data ? afterDetail.data.current_story : story;

  return success({
    schema_version: 'project-production-material-draft/v1',
    project_id: projectId,
    story_id: story.storyId,
    generated_at: generatedAt,
    before_status: story.production_material_readiness?.status,
    after_status: afterStory.production_material_readiness?.status,
    before_score: story.production_material_readiness?.score,
    after_score: afterStory.production_material_readiness?.score,
    drafted_task_count: draftedTasks.length,
    drafted_field_count: draftedTasks.reduce((sum, task) => sum + task.field_ids.length, 0),
    skipped_task_count: skippedTasks.length,
    drafted_tasks: draftedTasks,
    skipped_tasks: skippedTasks,
    detail: afterDetail.ok && afterDetail.data ? afterDetail.data : undefined,
  });
}

const PRODUCTION_MATERIAL_AUTO_DRAFT_FIELDS = new Set([
  'reference_images_or_keyframes',
  'identity_motion_consistency_plan',
  'single_shot_test',
  'multi_shot_continuity',
  'transition_plan',
  'shot_prompt_layers',
  'character_stability_tags',
  'dialogue_bubbles',
  'emotion_beats',
  'project_name',
  'heritage_or_craft_type',
  'materials',
  'tools',
  'process_steps',
  'hand_actions',
  'documentation_assets',
  'visual_symbols',
  'sound_or_texture_details',
  'modern_connection',
  'production_risks',
  'documentary_question',
  'real_world_site_or_object',
  'source_quotes_or_source_cues',
  'timeline',
  'witness_or_expert_roles',
  'interview_clip_selection',
  'field_notes',
  'b_roll_plan',
  'reconstruction_boundary',
  'present_day_trace',
  'ambient_sound',
  'what_must_not_be_claimed',
  'audience_age_band',
  'child_safe_conflict',
  'protagonist_choice',
  'concrete_examples',
  'emotional_resolution',
  'parent_teacher_note',
  'core_question',
  'audience_level',
  'argument_points',
  'knowledge_outline',
  'concept_definitions',
  'knowledge_steps',
  'opening_hook',
  'share_trigger',
  'beat_interval',
  'vertical_shot_plan',
  'diagram_or_caption_plan',
  'comment_prompt',
  'fact_boundary_card',
  'speaker_position',
  'communication_goal',
  'case_examples',
  'slide_or_board_assets',
  'audience_takeaway',
  'learning_objective',
  'learner_profile',
  'step_sequence',
  'practice_task',
  'assessment_check',
  'source_cues',
  'misconception_or_boundary',
  'forbidden_claims',
  'analogy_or_visual_metaphor',
  'recap_sentence',
]);

function projectProductionMaterialDraftableTasks(
  story: StoryGenerateResult,
): NonNullable<StoryGenerateResult['supplement_tasks']> {
  return (story.supplement_tasks ?? []).filter(task => {
    if (task.status !== 'open') return false;
    if (task.source !== 'production_material_missing_field') return false;
    const fields = task.recommended_fields ?? [];
    return fields.some(fieldId => PRODUCTION_MATERIAL_AUTO_DRAFT_FIELDS.has(fieldId));
  });
}

async function productionMaterialDraftFieldValues(
  story: StoryGenerateResult,
  task: NonNullable<StoryGenerateResult['supplement_tasks']>[number],
  guidance: DomainProductionMaterialGuidance,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const fieldId of task.recommended_fields ?? []) {
    if (!PRODUCTION_MATERIAL_AUTO_DRAFT_FIELDS.has(fieldId)) continue;
    const value = draftProductionMaterialFieldValue(story, fieldId, guidance);
    if (value) values[fieldId] = value;
  }
  return values;
}

function draftProductionMaterialFieldValue(
  story: StoryGenerateResult,
  fieldId: string,
  guidance: DomainProductionMaterialGuidance,
): string {
  if (fieldId === 'reference_images_or_keyframes') return draftReferenceImagesOrKeyframes(story);
  if (fieldId === 'identity_motion_consistency_plan') return draftIdentityMotionConsistencyPlan(story);
  if (fieldId === 'single_shot_test') return draftSingleShotTest(story, guidance);
  if (fieldId === 'multi_shot_continuity') return draftMultiShotContinuity(story);
  if (fieldId === 'transition_plan') return draftTransitionPlan(story);
  if (fieldId === 'shot_prompt_layers') return draftShotPromptLayers(story, guidance);
  if (fieldId === 'character_stability_tags') return draftCharacterStabilityTags(story);
  if (fieldId === 'dialogue_bubbles') return draftDialogueBubbles(story);
  if (fieldId === 'emotion_beats') return draftEmotionBeats(story);
  if (fieldId === 'project_name') return draftProjectName(story, guidance);
  if (fieldId === 'heritage_or_craft_type') return draftHeritageOrCraftType(story, guidance);
  if (fieldId === 'materials') return draftHeritageMaterials(story);
  if (fieldId === 'tools') return draftHeritageTools(story);
  if (fieldId === 'process_steps') return draftProcessSteps(story);
  if (fieldId === 'hand_actions') return draftHandActions(story);
  if (fieldId === 'documentation_assets') return draftDocumentationAssets(story, guidance);
  if (fieldId === 'visual_symbols') return draftVisualSymbols(story);
  if (fieldId === 'sound_or_texture_details') return draftSoundOrTextureDetails(story);
  if (fieldId === 'modern_connection') return draftModernConnection(story);
  if (fieldId === 'production_risks') return draftProductionRisks(story);
  if (fieldId === 'documentary_question') return draftDocumentaryQuestion(story);
  if (fieldId === 'real_world_site_or_object') return draftRealWorldSiteOrObject(story);
  if (fieldId === 'source_quotes_or_source_cues') return draftSourceQuotesOrSourceCues(story, guidance);
  if (fieldId === 'timeline') return draftTimeline(story);
  if (fieldId === 'witness_or_expert_roles') return draftWitnessOrExpertRoles(story, guidance);
  if (fieldId === 'interview_clip_selection') return draftInterviewClipSelection(story);
  if (fieldId === 'field_notes') return draftFieldNotes(story);
  if (fieldId === 'b_roll_plan') return draftBRollPlan(story);
  if (fieldId === 'reconstruction_boundary') return draftReconstructionBoundary(story);
  if (fieldId === 'present_day_trace') return draftPresentDayTrace(story);
  if (fieldId === 'ambient_sound') return draftAmbientSound(story);
  if (fieldId === 'what_must_not_be_claimed') return draftWhatMustNotBeClaimed(story, guidance);
  if (fieldId === 'audience_age_band') return draftAudienceAgeBand(story);
  if (fieldId === 'child_safe_conflict') return draftChildSafeConflict(story);
  if (fieldId === 'protagonist_choice') return draftProtagonistChoice(story);
  if (fieldId === 'concrete_examples') return draftConcreteExamples(story);
  if (fieldId === 'emotional_resolution') return draftEmotionalResolution(story);
  if (fieldId === 'parent_teacher_note') return draftParentTeacherNote(story, guidance);
  if (fieldId === 'core_question') return draftCoreQuestion(story);
  if (fieldId === 'audience_level') return draftAudienceLevel(story, guidance);
  if (fieldId === 'argument_points') return draftArgumentPoints(story);
  if (fieldId === 'knowledge_outline') return draftKnowledgeOutline(story, guidance);
  if (fieldId === 'concept_definitions') return draftConceptDefinitions(story);
  if (fieldId === 'knowledge_steps') return draftKnowledgeSteps(story);
  if (fieldId === 'opening_hook') return draftOpeningHook(story);
  if (fieldId === 'share_trigger') return draftShareTrigger(story, guidance);
  if (fieldId === 'beat_interval') return draftBeatInterval(story);
  if (fieldId === 'vertical_shot_plan') return draftVerticalShotPlan(story);
  if (fieldId === 'diagram_or_caption_plan') return draftDiagramOrCaptionPlan(story, guidance);
  if (fieldId === 'comment_prompt') return draftCommentPrompt(story, guidance);
  if (fieldId === 'fact_boundary_card') return draftFactBoundaryCard(story, guidance);
  if (fieldId === 'speaker_position') return draftSpeakerPosition(story, guidance);
  if (fieldId === 'communication_goal') return draftCommunicationGoal(story);
  if (fieldId === 'case_examples') return draftCaseExamples(story);
  if (fieldId === 'slide_or_board_assets') return draftSlideOrBoardAssets(story);
  if (fieldId === 'audience_takeaway') return draftAudienceTakeaway(story);
  if (fieldId === 'learning_objective') return draftLearningObjective(story);
  if (fieldId === 'learner_profile') return draftLearnerProfile(story, guidance);
  if (fieldId === 'step_sequence') return draftStepSequence(story);
  if (fieldId === 'practice_task') return draftPracticeTask(story);
  if (fieldId === 'assessment_check') return draftAssessmentCheck(story);
  if (fieldId === 'source_cues') return draftSourceCues(story, guidance);
  if (fieldId === 'misconception_or_boundary') return draftMisconceptionOrBoundary(story, guidance);
  if (fieldId === 'forbidden_claims') return draftForbiddenClaims(story, guidance);
  if (fieldId === 'analogy_or_visual_metaphor') return draftAnalogyOrVisualMetaphor(story);
  if (fieldId === 'recap_sentence') return draftRecapSentence(story);
  return '';
}

function draftReferenceImagesOrKeyframes(story: StoryGenerateResult): string {
  const sceneLines = story.scene_breakdown.slice(0, 4).map(scene => (
    `关键帧 S${scene.scene_id}「${scene.title}」：${scene.location}；画面内容=${shortText(scene.visual_prompt || scene.plot, 160)}；动作=${shortText(scene.key_action, 90)}`
  ));
  return compactDraftLines([
    `参考图或关键帧：以项目「${story.title}」现有分镜作为临时参考图说明，正式出图前仍需人工确认角色设定图。`,
    ...sceneLines,
    `参考图统一基准：漫画短剧风格、角色轮廓和服饰色块保持一致，关键道具与场景锚点沿用 source_entry=${story.source_entry}。`,
  ]);
}

function draftIdentityMotionConsistencyPlan(story: StoryGenerateResult): string {
  const characters = storyPrimaryCharacters(story);
  const propHints = story.scene_breakdown
    .map(scene => scene.key_action)
    .filter(Boolean)
    .slice(0, 4)
    .map((action, index) => `动作方向 ${index + 1}：${shortText(action, 80)}`);
  return compactDraftLines([
    `身份动作一致性计划：主角身份锁定为 ${characters.join('、') || story.source_entry}；每镜保持同一发型、服饰色块、随身物和眼神方向。`,
    `视线与站位：开场建立主角正面或三分之二侧脸，后续镜头只改变表情强度，不改变身份特征。`,
    ...propHints,
    `道具位置：关键道具在同一场景内保持左右手和画面方位一致；跨场景转移时用动作或对白交代。`,
  ]);
}

function draftSingleShotTest(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  const scene = story.scene_breakdown[0];
  const segment = story.gears_segments.find(item => item.source_scene_id === scene?.scene_id) ?? story.gears_segments[0];
  return compactDraftLines([
    `单镜头测试：优先用 S${scene?.scene_id ?? 1}「${scene?.title ?? story.title}」做 3-5 秒单镜头测试。`,
    `单镜头测试画面：${shortText(scene?.visual_prompt || segment?.segment_prompt_hint || segment?.visual_focus.join('，') || story.logline, 220)}`,
    `单镜头测试运镜：${shortText(scene?.camera_suggestion || '轻微推进，人物表情和关键道具清晰可见。', 120)}`,
    `验收标准：角色脸型、服饰、动作方向、字幕安全区和${guidance.single_shot_acceptance_boundary}后，再批量生成多分镜。`,
  ]);
}

function draftMultiShotContinuity(story: StoryGenerateResult): string {
  const sceneLines = story.scene_breakdown.slice(0, 6).map(scene => (
    `多分镜连续性 S${scene.scene_id}：${scene.location} -> ${shortText(scene.key_action || scene.plot, 100)}`
  ));
  return compactDraftLines([
    `多分镜连续性：按 scene_id 顺序推进，上一镜动作结果必须成为下一镜的画面前提。`,
    ...sceneLines,
    `连续性检查：角色服饰、道具手位、场景光线、情绪节拍和对白气泡阅读方向逐镜核对。`,
  ]);
}

function draftTransitionPlan(story: StoryGenerateResult): string {
  const scenes = story.scene_breakdown;
  const transitions = scenes.slice(0, -1).map((scene, index) => {
    const next = scenes[index + 1];
    const relation = scene.location === next.location ? '同场景动作承接' : `${scene.location} 到 ${next.location} 的空间转场`;
    return `转场 S${scene.scene_id}->S${next.scene_id}：${relation}；用 ${shortText(scene.key_action || scene.dramatic_function, 70)} 作为出点，接 ${shortText(next.key_action || next.dramatic_function, 70)}。`;
  });
  return compactDraftLines([
    `转场计划：优先使用动作承接、表情反应和道具特写，不使用会破坏漫画连续性的突兀跳切。`,
    ...transitions,
    `结尾转场：最后一镜保留追看钩子，画面停在未解问题或角色反应上。`,
  ]);
}

function draftShotPromptLayers(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  const focus = story.gears_segments.flatMap(segment => segment.visual_focus).slice(0, 8);
  return compactDraftLines([
    `镜头提示词分层：基础设定=${story.title}；人物=${storyPrimaryCharacters(story).join('、') || story.source_entry}；场景=${story.scene_breakdown.map(scene => scene.location).filter(Boolean).slice(0, 4).join('、') || story.source_entry}。`,
    `画面内容层：${shortText(focus.join('；') || story.logline, 220)}`,
    `风格层：AI 漫剧漫画分镜、清晰线条、表情夸张但${guidance.shot_prompt_style_boundary}；负面约束沿用项目 cultural_constraints。`,
  ]);
}

function draftCharacterStabilityTags(story: StoryGenerateResult): string {
  return compactDraftLines([
    `角色稳定标签：${storyPrimaryCharacters(story).join('、') || story.source_entry}。`,
    `服饰/发式：从首场 visual_prompt 提取并锁定，不随镜头随意变化；随身物和主色块在全片保持一致。`,
    `表情：按情绪节拍逐步变化，身份标签不变。`,
  ]);
}

function draftDialogueBubbles(story: StoryGenerateResult): string {
  const lines = (story.dialogue ?? [])
    .flatMap(item => item.lines.map(line => `${line.character}（${line.emotion}）：${line.text}`))
    .slice(0, 8);
  return compactDraftLines([
    `对白气泡：保持短句、强情绪、可被单格阅读。`,
    ...(lines.length ? lines : story.scene_breakdown.slice(0, 4).map(scene => `S${scene.scene_id}：${shortText(scene.dialogue_or_narration || scene.plot, 90)}`)),
    `排版：每格 1-2 个气泡，避免遮挡人物脸和关键道具。`,
  ]);
}

function draftEmotionBeats(story: StoryGenerateResult): string {
  return compactDraftLines([
    `情绪节拍：${story.scene_breakdown.slice(0, 6).map(scene => `S${scene.scene_id} ${shortText(scene.dramatic_function || scene.conflict || scene.key_action, 60)}`).join(' -> ')}`,
    `表情动作：每次情绪转折都用眼神、手部动作或身体朝向体现，避免只靠旁白解释。`,
  ]);
}

function draftProjectName(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `项目名称：草拟为「${story.source_entry || story.title}」。`,
    `核实提醒：${guidance.project_name_review_note}`,
  ]);
}

function draftHeritageOrCraftType(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `${guidance.heritage_or_craft_type_label}：根据当前成片类型与来源素材，暂按「${story.source_entry}」${guidance.heritage_or_craft_type_category}处理。`,
    `分类边界：${guidance.heritage_or_craft_type_review_note}`,
  ]);
}

function draftHeritageMaterials(story: StoryGenerateResult): string {
  const anchors = productionVisualAnchors(story).slice(0, 6);
  return compactDraftLines([
    `材料线索：从现有分镜和视觉焦点提取可拍材料/对象，需人工确认其真实名称与来源。`,
    ...anchors.map((anchor, index) => `材料候选 ${index + 1}：${shortText(anchor, 100)}`),
  ]);
}

function draftHeritageTools(story: StoryGenerateResult): string {
  const anchors = productionVisualAnchors(story).slice(0, 6);
  return compactDraftLines([
    `工具线索：从镜头中的手持物、场景器物和操作对象提取工具候选。`,
    ...anchors.map((anchor, index) => `工具/器物候选 ${index + 1}：${shortText(anchor, 100)}`),
    `核实提醒：工具名称、用法和危险步骤不能凭分镜推断为事实。`,
  ]);
}

function draftProcessSteps(story: StoryGenerateResult): string {
  const steps = story.scene_breakdown.slice(0, 6).map((scene, index) => (
    `流程 ${index + 1}：${shortText(scene.key_action || scene.dramatic_function || scene.plot, 130)}`
  ));
  return compactDraftLines([
    `流程步骤：按现有分镜顺序草拟为可拍流程，正式工序顺序需再查来源。`,
    ...steps,
  ]);
}

function draftHandActions(story: StoryGenerateResult): string {
  const actions = story.scene_breakdown.slice(0, 6).map(scene => (
    `手部/身体动作 S${scene.scene_id}：${shortText(scene.key_action || scene.visual_prompt || scene.plot, 120)}`
  ));
  return compactDraftLines([
    `手部动作：优先提取能被微距或中近景拍清的动作。`,
    ...actions,
  ]);
}

function draftDocumentationAssets(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  const facts = story.material_pack?.verified_facts.slice(0, 4) ?? [];
  return compactDraftLines([
    guidance.documentation_assets_intro,
    ...(facts.length ? facts.map(item => `已有关联线索：${shortText(item, 110)}`) : [`来源入口：${story.source_entry}，${guidance.documentation_assets_missing_source_note}`]),
    `资产边界：${guidance.documentation_assets_rights_note}`,
  ]);
}

function draftVisualSymbols(story: StoryGenerateResult): string {
  const symbols = productionVisualAnchors(story).slice(0, 8);
  return compactDraftLines([
    `视觉符号：从场景、道具、字幕关键词和视觉焦点中抽取。`,
    ...symbols.map((symbol, index) => `符号 ${index + 1}：${shortText(symbol, 90)}`),
  ]);
}

function draftSoundOrTextureDetails(story: StoryGenerateResult): string {
  const cues = story.scene_breakdown.slice(0, 5).map(scene => (
    `声音/质感 S${scene.scene_id}：${shortText(scene.time_of_day || scene.location || scene.visual_prompt || scene.key_action, 110)}`
  ));
  return compactDraftLines([
    `声音与质感：草拟可用于现场声、拟音、材料纹理和字幕关键词的感官线索。`,
    ...cues,
  ]);
}

function draftModernConnection(story: StoryGenerateResult): string {
  return compactDraftLines([
    `当代连接：${story.communication_goal || `把「${shortText(story.theme || story.logline, 130)}」连接到今天的观看、学习、传承或使用场景。`}`,
    `现实入口：可从现存空间、展陈、课堂、工坊、社区活动或观众行动切入，具体对象需人工核实。`,
  ]);
}

function draftProductionRisks(story: StoryGenerateResult): string {
  return compactDraftLines([
    `生产风险：不得把级别、传承谱系、官方身份、年代、工序顺序、授权状态写成未经核实的事实。`,
    `画面风险：危险工艺、仪式禁忌、未授权人物影像和商业宣传语需单独审稿。`,
    `项目边界：${shortText(story.cultural_constraints.join('；') || story.credibility_note || '待补来源和核实方法。', 220)}`,
  ]);
}

function draftDocumentaryQuestion(story: StoryGenerateResult): string {
  const question = story.logline.endsWith('？') || story.logline.endsWith('?')
    ? story.logline
    : `${story.source_entry}今天还能通过什么现场、实物或声音被看见？`;
  return compactDraftLines([
    `纪录片核心问题：${question}`,
    `追问方向：用现实入口、来源线索和当代痕迹回答，不用无来源再现替代事实。`,
  ]);
}

function draftRealWorldSiteOrObject(story: StoryGenerateResult): string {
  const sites = uniqueStrings([
    ...story.scene_breakdown.map(scene => scene.location),
    ...story.gears_segments.flatMap(segment => segment.visual_focus ?? []),
  ].filter((item): item is string => Boolean(item)))
    .slice(0, 8);
  return compactDraftLines([
    `现实地点/实物入口：从分镜和 GEARS visual focus 提取可拍对象，正式拍摄前需确认是否今天可见。`,
    ...sites.map((site, index) => `入口 ${index + 1}：${shortText(site, 100)}`),
  ]);
}

function draftSourceQuotesOrSourceCues(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  const quotes = story.source_quotes?.slice(0, 4) ?? [];
  const facts = story.material_pack?.verified_facts.slice(0, 4) ?? [];
  return compactDraftLines([
    `来源引文/线索：${guidance.source_cues_review_note}`,
    ...(quotes.length ? quotes.map(item => `引文候选：${shortText(item, 120)}`) : []),
    ...(facts.length ? facts.map(item => `来源线索：${shortText(item, 120)}`) : [`来源线索：${story.source_entry}，${guidance.source_cues_missing_source_note}`]),
  ]);
}

function draftTimeline(story: StoryGenerateResult): string {
  const scenes = story.scene_breakdown.slice(0, 6).map((scene, index) => (
    `时间线 ${index + 1}：${shortText(scene.title || scene.dramatic_function || scene.plot, 120)}`
  ));
  return compactDraftLines([
    `时间线：先按叙事顺序草拟，历史年代和事件先后必须另行核实。`,
    ...scenes,
  ]);
}

function draftWitnessOrExpertRoles(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `讲述人角色：可考虑${guidance.witness_or_expert_roles}，但具体身份必须人工确认。`,
    `角色分工：${guidance.witness_or_expert_role_note}`,
  ]);
}

function draftInterviewClipSelection(story: StoryGenerateResult): string {
  const clips = story.scene_breakdown.slice(0, 5).map(scene => (
    `采访/旁白片段 S${scene.scene_id}：${shortText(scene.dialogue_or_narration || scene.plot || scene.key_action, 130)}`
  ));
  return compactDraftLines([
    `采访片段选择：从现有旁白/对白中抽取需要真人讲述或主持串联的段落。`,
    ...clips,
  ]);
}

function draftFieldNotes(story: StoryGenerateResult): string {
  const existing = story.field_notes?.slice(0, 5) ?? [];
  const notes = existing.length
    ? existing.map(item => `已有田野/现场笔记：${shortText(item, 130)}`)
    : story.scene_breakdown.slice(0, 5).map(scene => `现场观察 S${scene.scene_id}：${scene.location}；${shortText(scene.visual_prompt || scene.key_action || scene.plot, 120)}`);
  return compactDraftLines([
    `现场笔记：草拟为拍摄/采风前的问题清单，不替代真实田野记录。`,
    ...notes,
  ]);
}

function draftBRollPlan(story: StoryGenerateResult): string {
  const shots = story.scene_breakdown.slice(0, 6).map(scene => (
    `B-roll S${scene.scene_id}：${shortText(scene.location || story.source_entry, 50)}；${shortText(scene.visual_prompt || scene.key_action || scene.plot, 140)}`
  ));
  return compactDraftLines([
    `B-roll 计划：每段旁白或采访都配现场、物件、档案、地图、空镜或手部动作，不让画面只停在口播。`,
    ...shots,
  ]);
}

function draftReconstructionBoundary(story: StoryGenerateResult): string {
  return compactDraftLines([
    `再现边界：复原、示意、动画、演员补拍和类比画面必须明确标注，不能伪装成真实历史影像。`,
    `边界说明：${shortText(story.cultural_constraints.join('；') || story.credibility_note || '待核事实只作线索。', 220)}`,
  ]);
}

function draftPresentDayTrace(story: StoryGenerateResult): string {
  const traces = uniqueStrings(story.scene_breakdown.map(scene => scene.location).filter(Boolean)).slice(0, 6);
  return compactDraftLines([
    `当代痕迹：结尾可回到今天仍可看见的地点、展陈、活动、声音或物件。`,
    ...(traces.length ? traces.map((trace, index) => `痕迹 ${index + 1}：${shortText(trace, 100)}`) : [`痕迹候选：${story.source_entry} 的现存空间或展陈，待人工确认。`]),
  ]);
}

function draftAmbientSound(story: StoryGenerateResult): string {
  const sounds = story.scene_breakdown.slice(0, 5).map(scene => (
    `环境声 S${scene.scene_id}：${shortText(scene.time_of_day || scene.location || scene.visual_prompt || '现场自然声', 100)}`
  ));
  return compactDraftLines([
    `环境声：为开场、转场和结尾草拟可采集声音，正式拍摄需现场确认。`,
    ...sounds,
  ]);
}

function draftWhatMustNotBeClaimed(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `不可声称：${guidance.what_must_not_be_claimed_rule}`,
    `待核边界：${shortText(story.material_pack?.uncertain_claims.join('；') || story.credibility_note || story.cultural_constraints.join('；') || '需要补正式来源。', 240)}`,
  ]);
}

function draftAudienceAgeBand(story: StoryGenerateResult): string {
  const target = story.target_audience || '7-9岁儿童';
  return compactDraftLines([
    `儿童受众年龄段：草拟为 ${target}；若项目未明确年龄，先按 7-9岁儿童理解力处理，待人工确认。`,
    `语言尺度：短句、具体动作、低恐惧强度，不使用复杂政治/死亡/暴力细节作为直接画面。`,
  ]);
}

function draftChildSafeConflict(story: StoryGenerateResult): string {
  const conflict = story.scene_breakdown.find(scene => scene.conflict)?.conflict
    ?? story.scene_breakdown.find(scene => scene.dramatic_function)?.dramatic_function
    ?? story.logline;
  return compactDraftLines([
    `儿童安全冲突：把「${shortText(conflict, 140)}」处理为温和阻力或善意张力。`,
    `安全边界：冲突通过误会、选择、尝试、帮助或道歉推进；不制造恐怖惊吓和不可逆伤害画面。`,
  ]);
}

function draftProtagonistChoice(story: StoryGenerateResult): string {
  const character = storyPrimaryCharacters(story)[0] ?? story.source_entry;
  const action = story.scene_breakdown.find(scene => scene.key_action)?.key_action ?? story.theme;
  return compactDraftLines([
    `主角选择：${character} 在关键场景中选择「${shortText(action, 120)}」。`,
    `选择结果：用帮助、勇敢尝试、承认误会或继续追问表现成长，避免把胜负写成唯一奖励。`,
  ]);
}

function draftConcreteExamples(story: StoryGenerateResult): string {
  const examples = story.scene_breakdown.slice(0, 4).map(scene => (
    `具体例子 S${scene.scene_id}：${scene.location || story.source_entry}；${shortText(scene.key_action || scene.plot, 110)}`
  ));
  return compactDraftLines([
    `具体例子：从现有分镜抽取可讲、可画、可举例的动作。`,
    ...examples,
  ]);
}

function draftEmotionalResolution(story: StoryGenerateResult): string {
  const lastScene = story.scene_breakdown.at(-1);
  return compactDraftLines([
    `情绪安放：结尾从「${shortText(lastScene?.conflict || story.theme, 120)}」收束到安心、理解或继续好奇。`,
    `收束方式：用角色表情放松、道具归位、同伴回应或一句复盘完成情绪释放。`,
  ]);
}

function draftParentTeacherNote(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `家长/教师提示：可引导孩子复述「${shortText(story.theme || story.logline, 120)}」，${guidance.parent_teacher_review_boundary}`,
    `延伸问题：${guidance.parent_teacher_extension_question}`,
  ]);
}

function draftCoreQuestion(story: StoryGenerateResult): string {
  const question = story.logline.endsWith('？') || story.logline.endsWith('?')
    ? story.logline
    : `${story.title}最值得观众带走的问题是什么？`;
  return compactDraftLines([
    `核心问题：${question}`,
    `回答路径：围绕 ${shortText(story.theme || story.source_entry, 140)} 展开，避免把待核实内容写成确定结论。`,
  ]);
}

function draftAudienceLevel(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  const audience = story.target_audience || guidance.audience_level_default;
  return compactDraftLines([
    `受众层级：草拟为 ${audience}；默认先给背景、定义和可视化例子，再进入延伸信息。`,
    `理解门槛：${guidance.audience_level_comprehension_note}`,
  ]);
}

function draftArgumentPoints(story: StoryGenerateResult): string {
  const points = story.argument_points?.length
    ? story.argument_points
    : story.scene_breakdown
      .map(scene => scene.dramatic_function || scene.key_action || scene.title)
      .filter(Boolean)
      .slice(0, 5);
  return compactDraftLines([
    `讲解论点：围绕核心问题拆成 3-5 个递进观点，每个观点只回答一个小问题。`,
    ...points.map((point, index) => `论点 ${index + 1}：${shortText(point, 120)}`),
    `论点边界：需要来源支持的结论单独标注，不用类比或分镜效果替代事实依据。`,
  ]);
}

function draftKnowledgeOutline(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  const outline = story.knowledge_outline?.length
    ? story.knowledge_outline
    : story.scene_breakdown
      .map(scene => scene.title || scene.dramatic_function || scene.location)
      .filter(Boolean)
      .slice(0, 5);
  return compactDraftLines([
    guidance.knowledge_outline_progression,
    ...outline.map((item, index) => `层级 ${index + 1}：${shortText(item, 120)}`),
  ]);
}

function draftConceptDefinitions(story: StoryGenerateResult): string {
  const terms = uniqueStrings([
    story.source_entry,
    story.theme,
    ...story.scene_breakdown.map(scene => scene.location),
    ...story.gears_segments.flatMap(segment => segment.visual_focus ?? []),
  ].filter((item): item is string => Boolean(item)))
    .slice(0, 5);
  return compactDraftLines([
    `概念定义：先解释「${story.source_entry}」在本片中的含义，再区分事实、传说/类比和生产示意。`,
    ...terms.map(term => `术语/对象：${shortText(term, 90)} - 正式口播前需确认定义和来源口径。`),
  ]);
}

function draftKnowledgeSteps(story: StoryGenerateResult): string {
  const steps = story.scene_breakdown.slice(0, 5).map((scene, index) => (
    `知识步骤 ${index + 1}：${shortText(scene.dialogue_or_narration || scene.key_action || scene.dramatic_function || scene.plot, 120)}`
  ));
  return compactDraftLines([
    `知识步骤：先抛问题，再给定义，再用例子/图示解释，最后回到来源边界和复盘句。`,
    ...steps,
  ]);
}

function draftOpeningHook(story: StoryGenerateResult): string {
  const firstScene = story.scene_breakdown[0];
  return compactDraftLines([
    `前三秒开场钩子：${shortText(firstScene?.dialogue_or_narration || firstScene?.key_action || story.logline, 100)}`,
    `钩子形式：先给反差问题、异常动作或冷知识画面，再在 3秒 内落到 ${story.source_entry}。`,
  ]);
}

function draftShareTrigger(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `分享触发点：把「${shortText(story.theme || story.logline, 120)}」包装成${guidance.share_trigger_frame}。`,
    `转发理由：${guidance.share_trigger_reason}`,
  ]);
}

function draftBeatInterval(story: StoryGenerateResult): string {
  const beats = story.scene_breakdown.slice(0, 5).map((scene, index) => (
    `${index * 5}-${(index + 1) * 5}秒：${shortText(scene.key_action || scene.dramatic_function || scene.plot, 70)}`
  ));
  return compactDraftLines([
    `短视频节奏点：每 5-10秒 有一次信息揭示、动作转折或字幕关键词变化。`,
    ...beats,
  ]);
}

function draftVerticalShotPlan(story: StoryGenerateResult): string {
  const shots = story.scene_breakdown.slice(0, 4).map(scene => (
    `竖屏镜头 S${scene.scene_id}：9:16 近景/中近景；${shortText(scene.camera_suggestion || scene.visual_prompt, 110)}`
  ));
  return compactDraftLines([
    `竖屏镜头计划：优先人物表情、手部动作、道具特写和字幕安全区，避免横向信息过密。`,
    ...shots,
  ]);
}

function draftDiagramOrCaptionPlan(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  const captions = story.scene_breakdown.slice(0, 4).map(scene => (
    `字幕/图示 S${scene.scene_id}：关键词=${shortText(scene.title || scene.location || story.source_entry, 40)}；说明=${shortText(scene.dramatic_function || scene.plot, 80)}`
  ));
  return compactDraftLines([
    `图示/字幕计划：每段只上 1 个关键词和 1 句解释，${guidance.diagram_or_caption_boundary}`,
    ...captions,
  ]);
}

function draftCommentPrompt(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `评论互动提示：你还想讨论 ${story.source_entry} 的哪些${guidance.comment_prompt_focus}？`,
    `评论边界：${guidance.comment_prompt_boundary}`,
  ]);
}

function draftFactBoundaryCard(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    guidance.fact_boundary_card_rule,
    `边界提示：${shortText(story.credibility_note || story.cultural_constraints.join('；') || guidance.fact_boundary_card_fallback, 220)}`,
  ]);
}

function draftSpeakerPosition(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `主讲人定位：以“${guidance.speaker_position_role}”口吻解释 ${story.source_entry}，${guidance.speaker_position_boundary_note}`,
    `表达方式：${guidance.speaker_position_expression_note}`,
  ]);
}

function draftCommunicationGoal(story: StoryGenerateResult): string {
  return compactDraftLines([
    `传播目标：${story.communication_goal || `让观众理解「${shortText(story.theme || story.logline, 140)}」并知道哪些内容仍需核实。`}`,
    `行动转化：看完能复述核心观点，愿意查看来源或进入项目对应地点/展陈继续了解。`,
  ]);
}

function draftCaseExamples(story: StoryGenerateResult): string {
  const cases = story.scene_breakdown.slice(0, 4).map(scene => (
    `案例 ${scene.scene_id}：${scene.location || story.source_entry} - ${shortText(scene.plot || scene.key_action, 120)}`
  ));
  return compactDraftLines([
    `案例例子：从当前分镜抽取可讲述案例，正式使用前需补来源。`,
    ...cases,
  ]);
}

function draftSlideOrBoardAssets(story: StoryGenerateResult): string {
  const assets = story.scene_breakdown.slice(0, 5).map(scene => (
    `板书/课件资产 S${scene.scene_id}：标题「${shortText(scene.title, 36)}」；图示=${shortText(scene.location || scene.visual_prompt, 90)}`
  ));
  return compactDraftLines([
    `板书/课件资产：标题卡、时间/地点卡、关键词字幕、事实边界卡。`,
    ...assets,
  ]);
}

function draftAudienceTakeaway(story: StoryGenerateResult): string {
  return compactDraftLines([
    `受众带走点：用一句话记住 ${shortText(story.theme || story.logline, 140)}。`,
    `复盘句：我知道了 ${story.source_entry} 的核心问题、一个具体例子，以及哪些信息需要看来源。`,
  ]);
}

function draftLearningObjective(story: StoryGenerateResult): string {
  return compactDraftLines([
    `学习目标：学会说出 ${story.source_entry} 的核心问题、一个具体例子和一条事实边界。`,
    `掌握标准：能用自己的话复述 ${shortText(story.theme || story.logline, 120)}，并区分事实、传说和改写。`,
  ]);
}

function draftLearnerProfile(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `学习者画像：${story.target_audience || guidance.learner_profile_default}，默认需要先给背景，再给例子和练习。`,
    `基础假设：${guidance.learner_profile_foundation_note}`,
  ]);
}

function draftStepSequence(story: StoryGenerateResult): string {
  const steps = story.scene_breakdown.slice(0, 5).map((scene, index) => (
    `步骤 ${index + 1}：${shortText(scene.title || scene.dramatic_function || scene.key_action, 90)}`
  ));
  return compactDraftLines([
    `步骤序列：先提出问题，再解释背景，再给案例，最后复盘边界。`,
    ...steps,
  ]);
}

function draftPracticeTask(story: StoryGenerateResult): string {
  return compactDraftLines([
    `练习任务：请用 60 秒复述 ${story.source_entry} 的核心问题，并指出一个需要继续核实的点。`,
    `互动题：从分镜中选一个道具/地点，说明它如何帮助理解主题。`,
  ]);
}

function draftAssessmentCheck(story: StoryGenerateResult): string {
  return compactDraftLines([
    `掌握检查：能否回答“核心问题是什么、例子是什么、边界是什么”。`,
    `测验建议：1 道判断题检查事实边界，1 道简答题检查具体例子，1 道开放题收集新来源线索。`,
  ]);
}

function draftSourceCues(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  const facts = story.material_pack?.verified_facts.slice(0, 4) ?? [];
  const claims = story.material_pack?.uncertain_claims.slice(0, 4) ?? [];
  return compactDraftLines([
    `${guidance.source_cues_entry_label}：${story.source_entry}；复核提示：${shortText(story.credibility_note, 160) || guidance.source_cues_missing_source_note}。`,
    ...(facts.length ? facts.map(item => `${guidance.source_cues_confirmed_label}：${shortText(item, 100)}`) : []),
    ...(claims.length
      ? claims.map(item => `${guidance.source_cues_unverified_label}：${shortText(item, 100)}`)
      : [`${guidance.source_cues_unverified_label}：${guidance.source_cues_default_review_scope}`]),
  ]);
}

function draftMisconceptionOrBoundary(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `误区或边界：${guidance.misconception_boundary_rule}`,
    `边界说明：${shortText(story.cultural_constraints.join('；') || story.credibility_note || guidance.misconception_boundary_fallback, 220)}`,
  ]);
}

function draftForbiddenClaims(
  story: StoryGenerateResult,
  guidance: DomainProductionMaterialGuidance,
): string {
  return compactDraftLines([
    `禁用/不可声称内容：${guidance.forbidden_claims_rule}`,
    `待核实边界：${shortText(story.material_pack?.uncertain_claims.join('；') || story.credibility_note || guidance.forbidden_claims_default_boundary, 220)}`,
  ]);
}

function draftAnalogyOrVisualMetaphor(story: StoryGenerateResult): string {
  const visualAnchors = story.scene_breakdown
    .map(scene => scene.visual_prompt || scene.location || scene.key_action)
    .filter(Boolean)
    .slice(0, 4);
  return compactDraftLines([
    `类比/视觉隐喻：把抽象关系画成“问题 -> 定义 -> 例子 -> 边界”的流程图或分层卡。`,
    ...visualAnchors.map((anchor, index) => `可视化 ${index + 1}：${shortText(anchor, 120)}`),
    `使用边界：类比只帮助理解，不替代史实、工艺参数或官方称号。`,
  ]);
}

function draftRecapSentence(story: StoryGenerateResult): string {
  return compactDraftLines([
    `复盘句：看懂 ${story.source_entry}，先问清核心问题，再分清概念、例子和来源边界。`,
    `收束提醒：${shortText(story.communication_goal || story.theme || story.logline, 140)}`,
  ]);
}

function productionVisualAnchors(story: StoryGenerateResult): string[] {
  return uniqueStrings([
    ...story.scene_breakdown.flatMap(scene => [
      scene.location,
      scene.visual_prompt,
      scene.key_action,
      scene.title,
    ]),
    ...story.gears_segments.flatMap(segment => segment.visual_focus ?? []),
  ].filter((item): item is string => Boolean(item)));
}

function storyPrimaryCharacters(story: StoryGenerateResult): string[] {
  const counts = new Map<string, number>();
  for (const character of story.characters ?? []) {
    counts.set(character.name, (counts.get(character.name) ?? 0) + 3);
  }
  for (const scene of story.scene_breakdown) {
    for (const character of scene.characters ?? []) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([name]) => Boolean(name.trim()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);
}

function compactDraftLines(lines: string[]): string {
  return shortText(lines.filter(line => line.trim().length > 0).join('\n'), 1800);
}

function shortText(value: string | undefined, maxLength: number): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
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
  const supplementBoundary = await getStoryDomainSupplementEditBoundary(current_story);
  if (!isStoryDomainEditPersistenceBoundarySafe(supplementBoundary.persistence)) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      `Domain pack \"${supplementBoundary.persistence.domain_id}\" exposed an unsafe story supplement persistence boundary.`,
      supplementBoundary.persistence,
    );
  }
  const writebackPlan = await planStoryDomainKnowledgeWriteback(current_story);
  if (
    writebackPlan.eligible
    && (
      supplementBoundary.guidance.candidate_kind !== 'domain_knowledge_candidate'
      || !supplementBoundary.guidance.writeback_draft_heading
    )
  ) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      `Domain pack \"${writebackPlan.domain_id}\" returned an eligible writeback plan without domain knowledge supplement guidance.`,
      {
        writeback_plan: writebackPlan,
        supplement_guidance: supplementBoundary.guidance,
        persistence: supplementBoundary.persistence,
      },
    );
  }
  const tasks = current_story.supplement_tasks ?? [];
  const taskIndex = tasks.findIndex(task => task.task_id === taskId);
  if (taskIndex === -1) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Supplement task "${taskId}" not found in project "${projectId}"`);
  }

  const updatedAt = nextProjectUpdatedAt(project);
  const requestFieldValues = normalizeSupplementFieldValues(request.supplement_field_values);
  const updatedTasks = tasks.map((task, index) => {
    if (index !== taskIndex) return task;
    const supplementFieldValues = mergeSupplementFieldValues(task.supplement_field_values, requestFieldValues);
    const incomingSupplementNote = request.supplement_note?.trim()
      || supplementNoteFromFieldValues(supplementFieldValues);
    const supplementNote = incomingSupplementNote || task.supplement_note;
    const knowledgeCandidateMarkdown = request.status === 'resolved' && supplementNote
      ? buildSupplementCandidateMarkdown(
          current_story,
          task,
          supplementNote,
          supplementFieldValues,
          updatedAt,
          supplementBoundary,
        )
      : undefined;
    const reviewStatus = request.knowledge_candidate_review_status
      ?? task.knowledge_candidate_review_status
      ?? (knowledgeCandidateMarkdown ? 'pending_review' : undefined);
    const reviewNote = request.knowledge_candidate_review_note?.trim()
      || task.knowledge_candidate_review_note;
    const reviewTouched = Boolean(request.knowledge_candidate_review_status);
    const writebackDraft = writebackPlan.eligible
      && reviewStatus === 'approved'
      && knowledgeCandidateMarkdown
      && supplementNote
      ? buildKnowledgeWritebackDraftMarkdown(
          current_story,
          task,
          supplementNote,
          supplementFieldValues,
          updatedAt,
          reviewNote,
          supplementBoundary.guidance.writeback_draft_heading!,
        )
      : undefined;
    const writebackStatus = request.status === 'resolved' && writebackDraft
      ? request.knowledge_writeback_status ?? task.knowledge_writeback_status ?? 'draft_ready'
      : undefined;
    const writebackNote = request.knowledge_writeback_note?.trim()
      || task.knowledge_writeback_note;
    const writebackTouched = Boolean(request.knowledge_writeback_status || request.knowledge_writeback_note);
    return {
      ...task,
      status: request.status,
      updated_at: updatedAt,
      resolved_at: request.status === 'resolved' ? updatedAt : undefined,
      supplement_note: supplementNote,
      supplement_field_values: supplementFieldValues,
      knowledge_candidate_markdown: knowledgeCandidateMarkdown,
      knowledge_candidate_review_status: request.status === 'resolved' ? reviewStatus : undefined,
      knowledge_candidate_review_note: request.status === 'resolved' ? reviewNote : undefined,
      knowledge_candidate_reviewed_at: request.status === 'resolved'
        ? (reviewTouched ? updatedAt : task.knowledge_candidate_reviewed_at)
        : undefined,
      knowledge_writeback_draft_markdown: request.status === 'resolved' ? writebackDraft : undefined,
      knowledge_writeback_status: writebackStatus,
      knowledge_writeback_note: writebackStatus ? writebackNote : undefined,
      knowledge_writeback_updated_at: writebackStatus
        ? (writebackTouched || !task.knowledge_writeback_updated_at ? updatedAt : task.knowledge_writeback_updated_at)
        : undefined,
    };
  });
  const updatedTask = updatedTasks[taskIndex];
  const writebackTouched = Boolean(request.knowledge_writeback_status || request.knowledge_writeback_note);
  if (
    writebackTouched
    && (
      updatedTask.knowledge_candidate_review_status !== 'approved'
      || !updatedTask.knowledge_writeback_draft_markdown
    )
  ) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      writebackPlan.eligible
        ? 'Knowledge writeback status can only be changed after a candidate is approved and a writeback draft exists.'
        : `Domain pack "${writebackPlan.domain_id}" blocked knowledge writeback: ${writebackPlan.blockers.join(', ')}.`,
      writebackPlan.eligible ? undefined : writebackPlan,
    );
  }
  const materialRefresh = applySupplementTaskMaterialUpdate(
    current_story,
    updatedTask,
    updatedTask.supplement_note,
    updatedAt,
  );
  const updatedStoryCandidate: StoryGenerateResult = {
    ...current_story,
    supplement_tasks: updatedTasks,
    ...materialRefresh,
  };
  const updatedStory = await rebuildDerivedStoryState(updatedStoryCandidate, {
    revalidateDomainSafety: false,
  });
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
    material_sufficiency: updatedStory.material_sufficiency ?? project.material_sufficiency,
    creation_contract: updatedStory.creation_contract ?? project.creation_contract,
    ...qualitySummary(updatedStory),
  };
  const snapshot = await projectRepository().readVersion(projectId, project.current_version_id);
  if (!snapshot) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" current version is unavailable`);
  }
  await projectRepository().writeCurrentState(updatedMeta, {
    ...snapshot,
    quality_report: updatedStory.quality_report ?? snapshot.quality_report,
    story: updatedStory,
  }, projectMetaExpectation(project));

  await updateSourceStory(updatedStory, raw => ({
    ...raw,
    supplement_tasks: updatedTasks,
    ...materialRefresh,
    gears_segments: updatedStory.gears_segments,
    gears_delivery: updatedStory.gears_delivery,
    quality_report: updatedStory.quality_report,
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
  const updatedAt = nextProjectUpdatedAt(project);
  const materialPack = buildMaterialPackWithManualMaterial(current_story, request, updatedAt);
  const materialRefresh = refreshStoryMaterialContract(current_story, materialPack);
  const updatedStoryCandidate: StoryGenerateResult = {
    ...current_story,
    ...materialRefresh,
  };
  const updatedStory = await rebuildDerivedStoryState(updatedStoryCandidate, {
    revalidateDomainSafety: false,
  });
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
    material_sufficiency: updatedStory.material_sufficiency ?? project.material_sufficiency,
    creation_contract: updatedStory.creation_contract ?? project.creation_contract,
    ...qualitySummary(updatedStory),
  };
  const snapshot = await projectRepository().readVersion(projectId, project.current_version_id);
  if (!snapshot) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" current version is unavailable`);
  }
  await projectRepository().writeCurrentState(updatedMeta, {
    ...snapshot,
    quality_report: updatedStory.quality_report ?? snapshot.quality_report,
    story: updatedStory,
  }, projectMetaExpectation(project));

  await updateSourceStory(updatedStory, raw => ({
    ...raw,
    ...materialRefresh,
    gears_segments: updatedStory.gears_segments,
    gears_delivery: updatedStory.gears_delivery,
    quality_report: updatedStory.quality_report,
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
  const materialKnowledgePack = knowledgePackFromMaterialPack(materialPack);
  const knowledgePack = hasConcreteKnowledgePackProvince(materialKnowledgePack)
    ? materialKnowledgePack
    : story.knowledge_pack ?? materialKnowledgePack;
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
  const productionMaterialReadiness = buildProductionMaterialReadinessReport({
    productionMaterialPack: story.production_material_pack,
    materialPack,
    contextText: productionMaterialContextText(story),
    sourceDomain: resolveStorySourceDomain(story),
  }) ?? story.production_material_readiness;
  const storyForQuality: StoryGenerateResult = {
    ...story,
    material_pack: materialPack,
    knowledge_pack: knowledgePack,
    creation_use_case: creationUseCase,
    truth_mode: truthMode,
    material_sufficiency: materialSufficiency,
    creation_contract: creationContract,
    production_material_readiness: productionMaterialReadiness,
  };
  const gearsDelivery = story.gears_delivery
    ? ensureGearsDeliveryPackage(storyForQuality)
    : story.gears_delivery;
  const qualityReport = story.quality_report
    ? enrichStoryQualityReport({
      story: {
        ...storyForQuality,
        gears_delivery: gearsDelivery,
      },
      qualityReport: {
        ...story.quality_report,
        truth_mode: truthMode,
        material_sufficiency_report: materialSufficiency,
      },
      narrativePatternIds: creationContract.narrative_pattern_ids,
      gearsDelivery,
    })
    : story.quality_report;
  return {
    material_pack: materialPack,
    knowledge_pack: knowledgePack,
    creation_use_case: creationUseCase,
    truth_mode: truthMode,
    material_sufficiency: materialSufficiency,
    creation_contract: creationContract,
    production_material_readiness: productionMaterialReadiness,
    gears_delivery: gearsDelivery,
    quality_report: qualityReport
      ? {
        ...qualityReport,
        truth_mode: truthMode,
        material_sufficiency_report: materialSufficiency,
      }
      : qualityReport,
  };
}

function hasConcreteKnowledgePackProvince(pack: StoryGenerateResult['knowledge_pack']): boolean {
  if (!pack) return false;
  const virtualProvinces = new Set(['项目素材', '待确认']);
  return [
    ...pack.primary_entries,
    ...pack.supporting_entries,
  ].some(entry => entry.province.trim() && !virtualProvinces.has(entry.province.trim()));
}

function productionMaterialContextText(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    story.credibility_note,
    ...story.scene_breakdown.flatMap(scene => [
      scene.title,
      scene.location,
      scene.plot,
      scene.key_action,
      scene.visual_prompt,
      scene.dialogue_or_narration,
      scene.cultural_note,
    ]),
    ...story.gears_segments.flatMap(segment => [
      segment.script_text,
      segment.purpose,
      ...(segment.visual_focus ?? []),
      ...(segment.cultural_constraints ?? []),
    ]),
  ].filter((item): item is string => Boolean(item)).join('\n');
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
    tags: uniqueStrings(([
      task.stage,
      task.blocking_level,
      task.source,
      task.category,
      ...(task.recommended_fields ?? []),
    ].filter(Boolean) as string[])),
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

function normalizeSupplementFieldValues(values: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!values) return undefined;
  const normalized = Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key.trim(), value.trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0),
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function mergeSupplementFieldValues(
  existing: Record<string, string> | undefined,
  incoming: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const merged = {
    ...(existing ?? {}),
    ...(incoming ?? {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function supplementNoteFromFieldValues(fieldValues: Record<string, string> | undefined): string | undefined {
  if (!fieldValues) return undefined;
  const lines = Object.entries(fieldValues).map(([field, value]) => `${humanizeSupplementField(field)}：${value}`);
  return lines.length > 0 ? lines.join('\n') : undefined;
}

function buildSupplementCandidateMarkdown(
  story: StoryGenerateResult,
  task: NonNullable<StoryGenerateResult['supplement_tasks']>[number],
  supplementNote: string,
  fieldValues: Record<string, string> | undefined,
  updatedAt: string,
  boundary: StoryDomainSupplementEditBoundary,
): string {
  const { guidance, persistence } = boundary;
  const lines = [
    `## ${guidance.candidate_heading}：${task.label}`,
    '',
    `- Domain Pack：${persistence.domain_id}`,
    `- 候选类型：${guidance.candidate_kind}`,
    `- 来源项目：${story.title}`,
    `- 来源条目：${story.source_entry}`,
    `- 成片类型：${story.video_type}`,
    `- 补充任务：${task.task_id}`,
    `- 生成时间：${updatedAt}`,
    `- 审稿状态：${guidance.human_review_requirement}`,
    `- 持久化合同：${persistence.schema_version}`,
    `- domain_source_write_allowed=${persistence.domain_source_write_allowed}`,
    `- knowledge_writeback_performed=${persistence.knowledge_writeback_performed}`,
    `- external_delivery_triggered=${persistence.external_delivery_triggered}`,
    `- migration_action_performed=${persistence.migration_action_performed}`,
    `- real_credit_granted=${persistence.real_credit_granted}`,
    '',
    '### 补充内容',
    supplementNote,
  ];
  if (task.recommended_fields?.length || fieldValues) {
    lines.push('', '### 字段映射');
    for (const field of task.recommended_fields ?? []) {
      lines.push(`- ${humanizeSupplementField(field)}：${fieldValues?.[field] ?? '待审稿补齐'}`);
    }
    for (const [field, value] of Object.entries(fieldValues ?? {})) {
      if (task.recommended_fields?.includes(field)) continue;
      lines.push(`- ${humanizeSupplementField(field)}：${value}`);
    }
  }
  lines.push(
    '',
    '### 审稿提示',
    ...guidance.review_rules.map(rule => `- ${rule}`),
  );
  return lines.join('\n');
}

function buildKnowledgeWritebackDraftMarkdown(
  story: StoryGenerateResult,
  task: NonNullable<StoryGenerateResult['supplement_tasks']>[number],
  supplementNote: string,
  fieldValues: Record<string, string> | undefined,
  updatedAt: string,
  reviewNote: string | undefined,
  writebackDraftHeading: string,
): string {
  const lines = [
    `## ${writebackDraftHeading}：${story.source_entry}｜${task.label}`,
    '',
    `- 来源项目：${story.title}`,
    `- 来源条目：${story.source_entry}`,
    `- 成片类型：${story.video_type}`,
    `- 补充任务：${task.task_id}`,
    `- 审稿时间：${updatedAt}`,
    `- 审稿备注：${reviewNote || '待补人工审稿备注'}`,
    '',
    '### 拟写入字段',
    '',
    '- 已确认事实：',
    ...supplementNote.split('\n').map(line => `  - ${line}`),
    '- 待核事实：待补外部来源核验。',
    '- 可戏剧化空间：仅限当前项目创作使用；写入知识库前需确认是否具备普适性。',
    '- 禁用表达：不得把项目补录内容直接表述为已核史实，除非来源补齐。',
    '',
    '### 来源与核实方法',
    '',
    '- 来源：项目补充任务与人工补录说明。',
    '- 核实方法：补充正式来源链接、实地/馆藏/官方资料或可引用出版物后再入库。',
    '- 待核实点：补录内容是否适用于原始文化条目，而不只是当前成片项目。',
  ];
  if (fieldValues && Object.keys(fieldValues).length > 0) {
    lines.push('', '### 生产字段映射', '');
    for (const [field, value] of Object.entries(fieldValues)) {
      lines.push(`- ${humanizeSupplementField(field)}：${value}`);
    }
  }
  lines.push(
    '',
    '### asset_split 建议',
    '',
    '- 主体资产：按补录内容提取人物、地点、道具或画面基准。',
    '- 生产用途：先作为项目级素材；通过来源核验后再升级为知识库生产卡片字段。',
    '- 审稿边界：本草案不能自动写入任何 Domain Pack 目标文件。',
  );
  return lines.join('\n');
}

function buildKnowledgeWritebackAppendMarkdown(
  story: StoryGenerateResult,
  task: NonNullable<StoryGenerateResult['supplement_tasks']>[number],
  exportedAt: string,
): string {
  const fieldValues = task.supplement_field_values ?? {};
  const lines = [
    `### 补录候选：${task.label}`,
    '',
    `- 来源项目：${story.title}`,
    `- 来源条目：${story.source_entry}`,
    `- 补充任务：${task.task_id}`,
    `- 审稿状态：${task.knowledge_candidate_review_status === 'approved' ? '已通过' : '待审'}`,
    `- 审稿备注：${task.knowledge_candidate_review_note || '待补'}`,
    `- 草案导出时间：${exportedAt}`,
    '',
    '#### 已确认事实',
    '',
    task.supplement_note || '待补',
    '',
    '#### 生产字段映射',
    '',
  ];
  if (Object.keys(fieldValues).length > 0) {
    for (const [field, value] of Object.entries(fieldValues)) {
      lines.push(`- ${humanizeSupplementField(field)}：${value}`);
    }
  } else {
    lines.push('- 待补字段映射。');
  }
  lines.push(
    '',
    '#### 核实方法',
    '',
    '- 需补正式来源链接、馆藏/官方资料、出版物或实地核验记录。',
    '- 核实后再将本块拆分进正式条目的来源、核实方法、待核实点与 asset_split。',
    '',
    '#### 待核实点',
    '',
    '- 该补录内容是否适用于原始知识条目，而非仅适用于当前项目。',
    '- 是否需要新增地点、人物、视觉资产或禁用表达边界。',
  );
  return lines.join('\n');
}

function humanizeSupplementField(field: string): string {
  return field
    .split('_')
    .filter(Boolean)
    .join(' ');
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
  generatedRootOverride?: string,
): Promise<void> {
  if (!projectId) return;
  const repository = projectRepository(generatedRootOverride);
  const project = await repository.readMeta(projectId);
  if (!project) return;
  const snapshot = await repository.readVersion(projectId, project.current_version_id);
  if (!snapshot) return;
  if (snapshot.story.storyId !== storyId) return;

  const rebuiltStory = await rebuildDerivedStoryState({
    ...snapshot.story,
    gears_delivery: gearsDelivery,
  }, {
    revalidateDomainSafety: false,
  });
  const storyWithEditedMarkdown: StoryGenerateResult = {
    ...rebuiltStory,
    gears_delivery: rebuiltStory.gears_delivery
      ? { ...rebuiltStory.gears_delivery, markdown: gearsDelivery.markdown }
      : gearsDelivery,
  };
  const updatedSnapshot: StoryProjectVersionSnapshot = {
    ...snapshot,
    quality_report: storyWithEditedMarkdown.quality_report,
    story: storyWithEditedMarkdown,
  };
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: nextProjectUpdatedAt(project),
    ...qualitySummary(storyWithEditedMarkdown),
  };

  await repository.writeCurrentState(
    updatedMeta,
    updatedSnapshot,
    projectMetaExpectation(project),
  );
  await updateSourceStory(storyWithEditedMarkdown, raw => ({
    ...raw,
    gears_segments: storyWithEditedMarkdown.gears_segments,
    gears_delivery: storyWithEditedMarkdown.gears_delivery,
    quality_report: storyWithEditedMarkdown.quality_report,
    project_id: storyWithEditedMarkdown.project_id,
    current_version_id: storyWithEditedMarkdown.current_version_id,
  }), generatedRootOverride);
}

export async function updateProjectCurrentGearsWebhookStatus(
  projectId: string | undefined,
  storyId: string,
  gearsWebhook: GearsWebhookStatus,
  generatedRootOverride?: string,
): Promise<void> {
  if (!projectId) return;
  const repository = projectRepository(generatedRootOverride);
  const project = await repository.readMeta(projectId);
  if (!project) return;
  const snapshot = await repository.readVersion(projectId, project.current_version_id);
  if (!snapshot) return;
  if (snapshot.story.storyId !== storyId) return;

  const updatedSnapshot: StoryProjectVersionSnapshot = {
    ...snapshot,
    story: {
      ...snapshot.story,
      gears_webhook: gearsWebhook,
    },
  };
  const updatedAt = nextProjectUpdatedAt(project);
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
  };

  await repository.writeCurrentState(
    updatedMeta,
    updatedSnapshot,
    projectMetaExpectation(project),
  );
  await updateSourceStory(snapshot.story, raw => ({
    ...raw,
    gears_webhook: gearsWebhook,
    project_id: snapshot.story.project_id,
    current_version_id: snapshot.story.current_version_id,
  }), generatedRootOverride);
}

export async function updateProjectCurrentGearsVideo(
  projectId: string | undefined,
  storyId: string,
  gearsVideo: GearsVideoResult,
  generatedRootOverride?: string,
): Promise<void> {
  if (!projectId) return;
  const repository = projectRepository(generatedRootOverride);
  const project = await repository.readMeta(projectId);
  if (!project) return;
  const snapshot = await repository.readVersion(projectId, project.current_version_id);
  if (!snapshot) return;
  if (snapshot.story.storyId !== storyId) return;

  const updatedSnapshot: StoryProjectVersionSnapshot = {
    ...snapshot,
    story: {
      ...snapshot.story,
      gears_video: gearsVideo,
    },
  };
  const updatedAt = nextProjectUpdatedAt(project);
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    gears_video_status: gearsVideo.status,
    gears_video_url: gearsVideo.video_url,
    gears_video_thumbnail_url: gearsVideo.thumbnail_url,
  };

  await repository.writeCurrentState(
    updatedMeta,
    updatedSnapshot,
    projectMetaExpectation(project),
  );
  await updateSourceStory(snapshot.story, raw => ({
    ...raw,
    gears_video: gearsVideo,
    project_id: snapshot.story.project_id,
    current_version_id: snapshot.story.current_version_id,
  }), generatedRootOverride);
}
