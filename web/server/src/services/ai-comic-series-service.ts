// web/server/src/services/ai-comic-series-service.ts — AI comic series planning

import { execFile } from 'node:child_process';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { link, lstat, readFile, rm, stat } from 'node:fs/promises';
import { ErrorCodes, GEARS_CALLBACK_BATCH_ITEM_LIMIT, success, fail } from '@shared/types.js';
import type { ProductResourceOwnership } from '@shared/product-access.js';
import {
  FileSeriesProjectRepository,
  SeriesProjectRepositoryConflictError,
} from '../repositories/series-project-repository.js';
import { FileArtifactStore, type ArtifactWriteResult } from '../repositories/artifact-store.js';
import { storyGeneratedRoot, storyKbRoot } from '../platform/story-storage-root.js';
import type {
  AiComicContinuityLedger,
  AiComicContinuityLedgerEpisode,
  AiComicEpisodicMemoryIndex,
  AiComicEpisodicMemoryItem,
  AiComicEpisodicMemoryRecall,
  AiComicEpisodicMemoryRecallItem,
  AiComicEpisodicMemorySource,
  AiComicEpisodeContextPreview,
  AiComicEpisodeContextPreviewRequest,
  AiComicEpisodeQualityReport,
  AiComicEpisodePlan,
  AiComicEpisodeBlueprint,
  AiComicEndingHookType,
  AiComicEpisodeGenerateRequest,
  AiComicPacingProfile,
  AiComicProductionConstraintCategory,
  AiComicProductionConstraintItem,
  AiComicProductionConstraints,
  AiComicSeedanceProductionBatchUpdateRequest,
  AiComicSeedanceProductionCallbackRequest,
  AiComicSeedanceProductionLedger,
  AiComicSeedanceProductionAutoSelectRequest,
  AiComicSeedanceProductionStatus,
  AiComicSeedanceProductionStatusUpdateRequest,
  AiComicSeedanceProductionVersionSelectRequest,
  AiComicSeedanceAssetLibrary,
  AiComicSeedanceAssetIdentityBinding,
  AiComicSeedanceAssetFileUploadResult,
  AiComicSeedanceAssetLibraryItem,
  AiComicSeedanceAssetLibraryUpdateRequest,
  AiComicSeriesMediaAssetReviewUpdateResult,
  AiComicSeedanceAudioLibrary,
  AiComicSeedanceAudioLibraryUpdateRequest,
  AiComicSeedanceAudioMixLedger,
  AiComicSeedanceAudioMixProfile,
  AiComicSeedanceAudioMixRequest,
  AiComicSeedanceFinalDependencyStatus,
  AiComicSeedanceFinalDeliveryLedger,
  AiComicSeedanceFinalDeliveryReleaseRecord,
  AiComicSeedanceFinalDeliveryRollbackRequest,
  AiComicSeedanceFinalDeliveryRollbackResult,
  AiComicSeedanceFinalDeliveryManifest,
  AiComicSeedanceFinalDeliveryManifestDeliverable,
  AiComicSeedanceFinalDeliveryManifestDeliverableStatus,
  AiComicSeedanceFinalDeliveryManifestInput,
  AiComicSeedanceFinalDeliveryOutputProfile,
  AiComicSeedanceFinalDeliveryRequest,
  AiComicSeedanceFinalDeliveryStatus,
  AiComicSeedanceReviewAddRequest,
  AiComicSeedanceReviewItem,
  AiComicSeedanceReviewLedger,
  AiComicSeedanceReviewRepairAction,
  AiComicSeedanceReviewResolveRequest,
  AiComicSeriesSeedanceReviewRepairPackage,
  AiComicSeriesSeedanceReviewRepairPackageItem,
  AiComicSeriesSeedanceReviewUpdateResult,
  AiComicSeedanceEditingPlatformAsset,
  AiComicSeedanceEditingPlatformMissingAsset,
  AiComicSeedanceEditingPlatformSubtitleCue,
  AiComicSeedanceEditingPlatformTimelineItem,
  AiComicSeedanceExecutionCostRecord,
  AiComicSeedanceExecutionCostGovernanceSummary,
  AiComicSeedanceDashboardBlocker,
  AiComicSeedanceDashboardEpisode,
  AiComicSeedanceDashboardItemStatus,
  AiComicSeedanceDashboardNextAction,
  AiComicSeedanceDashboardStatusKey,
  AiComicSeedanceDashboardStatusItem,
  AiComicSeedanceDashboardSummary,
  AiComicSeedanceThumbnailCaptureRequest,
  AiComicSeedanceThumbnailCaptureResultShot,
  AiComicSeedanceThumbnailStatus,
  AiComicSeedanceSubtitleExportRequest,
  AiComicSeedanceSubtitleRenderLedger,
  AiComicSeedanceSubtitleRenderMode,
  AiComicSeedanceSubtitleRenderRequest,
  AiComicSeedanceTitleCardOutputProfile,
  AiComicSeedanceTitleCardPlanCard,
  AiComicSeedanceTitleCardRenderLedger,
  AiComicSeedanceTitleCardRenderRequest,
  AiComicSeedanceVideoVersion,
  AiComicSeedanceCutPackageEpisode,
  AiComicSeedanceRetryPackageEpisode,
  AiComicSeedanceRetryPackageShot,
  AiComicSeedanceRetryExecutionCandidate,
  AiComicSeedanceRetryExecutionEpisode,
  AiComicSeedanceRetryReason,
  AiComicSeedanceRetrySubmitRequest,
  AiComicSeedanceRetrySubmitShot,
  AiComicSeedanceProviderRecoveryItem,
  AiComicSeedanceProviderRecoveryRequest,
  AiComicSeedanceRecoverableProductionStatus,
  AiComicSeriesSeedanceCutPackage,
  AiComicSeedanceCutAssemblyLedger,
  AiComicSeedanceCutAssemblyRequest,
  AiComicSeriesSeedanceRetryPackage,
  AiComicSeriesSeedanceRetryExecutionPlan,
  AiComicSeriesSeedanceRetrySubmitResult,
  AiComicSeriesGearsJobCallbackResult,
  AiComicSeriesGearsJobStatusSyncResult,
  AiComicSeriesGearsJobSubmitResult,
  AiComicSeriesProductionReadinessReport,
  AiComicSeriesSeedanceProviderRecoveryResult,
  AiComicSeriesSeedanceAssetReportPackage,
  AiComicSeriesVisualProductionCompletionPlan,
  AiComicSeriesSeedanceEditAssetPackage,
  AiComicSeedanceEditAssetPackageEpisode,
  AiComicSeriesSeedanceThumbnailPlanPackage,
  AiComicSeriesSeedanceThumbnailCaptureResult,
  AiComicSeriesSeedanceCutAssemblyResult,
  AiComicSeriesSeedanceSubtitlePackage,
  AiComicSeriesSeedanceSubtitleRenderResult,
  AiComicSeriesSeedanceAudioMixResult,
  AiComicSeriesSeedanceAudioPlanPackage,
  AiComicSeriesSeedanceDashboard,
  AiComicSeriesSeedanceEditingPlatformPackage,
  AiComicSeriesSeedanceFinalDeliveryResult,
  AiComicSeriesSeedanceTitleCardPlanPackage,
  AiComicSeriesSeedanceTitleCardRenderResult,
  AiComicSeedanceThumbnailPlanEpisode,
  AiComicSeriesSeedanceFinishingPlanPackage,
  AiComicSeedanceAudioPlanCue,
  AiComicSeedanceFinishingAudioCue,
  AiComicSeedanceFinishingShot,
  AiComicSeedanceFinishingSubtitleCue,
  AiComicSeriesSeedanceVersionComparisonPackage,
  AiComicSeedanceShotProductionItem,
  AiComicSeedanceAssetReferenceItem,
  AiComicSeedanceShotAssetBinding,
  AiComicSeedanceVersionComparisonRow,
  AiComicSeedanceVersionComparisonShot,
  AiComicMemoryConflictCategory,
  AiComicMemoryConflictItem,
  AiComicMemoryConflictReport,
  AiComicSeriesLedgerRebuildRequest,
  AiComicSeriesContinuityAudit,
  AiComicSeriesBibleExportPackage,
  AiComicSeriesBlindReviewPackage,
  AiComicSeriesBibleMemoryRow,
  AiComicSeriesBibleProductionTables,
  AiComicSeriesQualityAudit,
  AiComicSeriesQualityEpisodeReport,
  AiComicThreadClosureItem,
  AiComicThreadClosureReport,
  AiComicSeriesProjectArchiveRequest,
  AiComicSeriesProjectCopyRequest,
  AiComicSeriesProjectDeleteResult,
  AiComicSeriesProjectDetail,
  AiComicSeriesProjectMeta,
  AiComicSeriesProjectSaveRequest,
  AiComicSeriesHumanReviewSubmitRequest,
  AiComicSeriesVisualIdentityDefinitionUpdateRequest,
  AiComicSeriesVisualIdentity,
  AiComicSeriesVisualBible,
  AiComicSeriesVisualSuggestionDraft,
  AiComicSeriesVisualWorldRuleDefinitionUpdateRequest,
  AiComicSeriesSeedanceEpisodePackage,
  AiComicSeriesSeedanceExportPackage,
  AiComicSeriesCharacterArc,
  AiComicSeriesCommercialRepairResult,
  AiComicSeriesPhase,
  AiComicSeriesPlan,
  AiComicSeriesPlanRequest,
  AiComicSeriesSpineBeat,
  AiComicSeriesMemory,
  AiComicSeriesMemoryCategory,
  AiComicSeriesMemoryItem,
  AiComicSeriesMemoryRecall,
  AiComicSeriesMemoryRecallItem,
  AiComicSeriesMemoryRecallControls,
  AiComicSeriesMemoryRecallPreferences,
  AiComicPlotThread,
  ApiResponse,
  ErrorCode,
  EntryDetail,
  ExternalProviderCallAuthorizationRecord,
  ExternalProviderCallAuthorizationRequest,
  GearsExecutionJobStatus,
  GearsExecutionJobType,
  GearsJobCallbackRequest,
  GearsJobLedger,
  GearsJobLedgerItem,
  GearsJobStatusSyncRequest,
  GearsJobSubmitRequest,
  GearsJobSubmitFailure,
  SeedanceAssetHistoryEvent,
  KnowledgeNeed,
  KnowledgePack,
  MediaAssetReviewUpdateRequest,
  NarrativePatternId,
  ProductionReadinessGearsSummary,
  ProductionReadinessAutomationRunLedger,
  ProductionReadinessAutomationRunRequest,
  ProductionReadinessAutomationRunResult,
  ProductionReadinessIssue,
  ProductionReadinessLane,
  ProductionReadinessNextAction,
  ProductionReadinessStatus,
  SeedanceProviderSubmitRequestMode,
  SeedancePromptShotUnit,
  SeedanceShotProviderSubmitAdapterSummary,
  SeedanceShotProviderSubmitFailure,
  StoryCharacter,
  StoryDetectedCharacter,
  StoryGenerateResult,
  StoryScene,
  SupportedDuration,
  SeriesPremiseContract,
} from '@shared/types.js';
import { analyzeOutline, multiMatchEntries } from './outline-service.js';
import { getStory } from './story-service.js';
import { generateAndStoreChinaCultureStory } from '../domains/china-culture/story-generation-service.js';
import { validateDramaticStory } from './dramatic-story.js';
import { buildProductionReadinessAutomationPlan } from './production-readiness-automation.js';
import {
  getNarrativePatternRequirementLines,
  getNarrativePatternsForVideoType,
} from './narrative-pattern-library.js';
import { recommendNarrativePatternsForEntry } from './genre-story-profiles.js';
import { buildSeedancePromptPackage } from './seedance-prompt-service.js';
import { buildGearsDeliveryPackage, ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { buildStoryProductionBoard } from './production-board-service.js';
import { inspectMediaAssetUpload } from './asset-ingest-service.js';
import {
  buildSeriesPremiseContract,
  isRuleMysteryPremise,
  normalizeSeriesPremiseContract,
  requiredSeriesPremiseAnchorIds,
  seriesPremiseAnchorLines,
} from './ai-comic-series-premise-contract-service.js';
import { auditAiComicSeriesPremiseFidelity } from './ai-comic-series-fidelity-service.js';
import {
  auditAiComicSeriesCommercialQuality,
  buildAiComicEpisodeCommercialBeats,
  buildAiComicSeriesHumanReview,
  repairAiComicSeriesCommercialQuality,
} from './ai-comic-series-commercial-quality-service.js';
import { buildAiComicSeriesBlindReviewPackage } from './ai-comic-series-blind-review-service.js';
import {
  aiComicSeriesVisualIdentityId,
  buildAiComicSeriesVisualBible,
} from './ai-comic-series-visual-bible-service.js';
import {
  buildAiComicSeriesVisualIdentitySuggestionDraft,
  buildAiComicSeriesVisualWorldRuleSuggestionDraft,
} from './ai-comic-series-visual-suggestion-service.js';
import {
  buildGearsLedgerItem,
  buildGearsExecutionOperationalMetrics,
  buildGearsExecutionRecoveryPlan,
  buildLocalGearsJobId,
  buildRejectedGearsLedgerItem,
  gearsSeriesCallbackPath,
  gearsSeriesCallbackUrl,
  gearsJobStatusIsTerminal,
  gearsCallbackEventIsDuplicate,
  gearsCallbackBatchPath,
  extractGearsJobCallbackRequests,
  markGearsLedgerPollFailures,
  mergeGearsCallbackEvents,
  mergeGearsExecutionCostFromCallback,
  mergeGearsLedgerItems,
  normalizeGearsJobCallback,
  normalizeGearsJobLedger,
  pollGearsExecutionJobStatuses,
  reconcileGearsLedgerExecutionCosts,
  resolveGearsLedgerStatusAfterCallback,
  submitGearsExecutionJobs,
  summarizeGearsExecutionCostGovernance,
  type GearsExecutionSubmitUnit,
} from './gears-execution-service.js';
import {
  attachGearsProviderAssetHandoffs,
  type GearsProviderAssetSource,
} from './gears-provider-asset-handoff-service.js';

const PACING_LABELS: Record<AiComicPacingProfile, string> = {
  fast_hook: '强钩子快节奏',
  balanced_drama: '均衡剧情推进',
  slow_burn: '慢热铺陈',
  mystery_cliffhanger: '悬念钩子',
};

const GEARS_EXECUTION_JOB_STATUSES: GearsExecutionJobStatus[] = [
  'submitted',
  'queued',
  'processing',
  'ready',
  'failed',
  'canceled',
  'rejected',
];

const LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL = 'https://local.story-agent.invalid/gears-acceptance';

const PHASE_TEMPLATES = [
  { id: 'phase-1', purpose: '建立主角目标、世界规则和核心问题', turning_point: '主角被迫做出第一次选择' },
  { id: 'phase-2', purpose: '扩大人物关系和文化背景，让主线矛盾具体化', turning_point: '主角发现表面目标背后还有更深层原因' },
  { id: 'phase-3', purpose: '连续推进代价、误解和关键线索', turning_point: '长期线索汇合，主角失去原有依靠' },
  { id: 'phase-4', purpose: '集中处理反转、牺牲和价值选择', turning_point: '主角以新的信念重组行动方案' },
  { id: 'phase-5', purpose: '回收主要伏笔，完成主题表达并留下余味', turning_point: '主角完成最终选择，世界关系发生改变' },
];

type StoredAiComicSeriesProject = AiComicSeriesProjectDetail;
type AiComicSeriesRetrySubmitCandidate = {
  candidate: AiComicSeedanceRetryExecutionCandidate;
  local_provider_job_id: string;
  queue_position: number;
};
type AiComicSeriesRetrySubmitAcceptedItem = {
  candidate: AiComicSeedanceRetryExecutionCandidate;
  provider_job_id: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  status: Extract<AiComicSeedanceProductionStatus, 'submitted' | 'processing'>;
};
type FfmpegThumbnailRunner = (params: {
  ffmpegPath: string;
  videoUrl: string;
  outputPath: string;
  captureTimeSec: number;
}) => Promise<void>;
type FfmpegCutAssemblyRunner = (params: {
  ffmpegPath: string;
  concatListPath: string;
  outputPath: string;
  profile: SeedanceCutAssemblyProfile;
}) => Promise<void>;
type FfmpegSubtitleBurnInRunner = (params: {
  ffmpegPath: string;
  inputVideoPath: string;
  subtitlePath: string;
  outputPath: string;
}) => Promise<void>;
type FfmpegAudioMixRunner = (params: {
  ffmpegPath: string;
  inputVideoPath: string;
  audioInputs: SeedanceAudioMixInput[];
  includeOriginalAudio: boolean;
  originalAudioVolumeDb: number;
  outputPath: string;
}) => Promise<void>;
type FfmpegTitleCardRenderRunner = (params: {
  ffmpegPath: string;
  card: AiComicSeedanceTitleCardPlanCard;
  outputPath: string;
  profile: AiComicSeedanceTitleCardOutputProfile;
  fontPath: string;
}) => Promise<void>;
type FfmpegFinalDeliveryRunner = (params: {
  ffmpegPath: string;
  concatListPath?: string;
  inputVideoPath: string;
  outputPath: string;
  outputProfile: AiComicSeedanceFinalDeliveryOutputProfile;
  useConcat: boolean;
}) => Promise<void>;

interface SeedanceCutAssemblyProfile {
  assemblyMode: 'copy' | 'transcode';
  outputProfile: 'source_copy' | 'mp4_h264_1080p' | 'mp4_h264_720p';
  fps?: number;
  crf: number;
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
  width?: number;
  height?: number;
}

interface SeedanceAudioMixInput {
  input_path: string;
  start_sec: number;
  end_sec: number;
  volume_db: number;
  fade_in_sec: number;
  fade_out_sec: number;
}

const execFileAsync = promisify(execFile);

export async function generateAiComicSeriesPlan(
  request: AiComicSeriesPlanRequest,
): Promise<ApiResponse<AiComicSeriesPlan>> {
  const outline = request.outline.trim();
  if (!outline) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'outline cannot be empty');
  }
  if (request.episode_duration_range_sec.min > request.episode_duration_range_sec.max) {
    return fail(ErrorCodes.INVALID_DURATION, 'episode_duration_range_sec.min cannot be greater than max');
  }

  const analysis = await analyzeOutline({
    outline,
    preferred_video_types: ['ai_comic_drama'],
  });
  const storyIntent = analysis.data?.story_intent;
  const outlineCharacters = extractAiComicOutlineCharacters(outline);
  const initiallyDetectedCharacters = mergeCharacters(
    [...(request.character_hints ?? []), ...outlineCharacters],
    analysis.data?.detected_characters ?? [],
  );
  const premiseContract = buildSeriesPremiseContract({
    outline,
    detectedCharacters: initiallyDetectedCharacters,
    explicitContract: request.premise_contract,
  });
  const detectedCharacters = mergeCharacters(
    premiseContract.locked_characters.map(character => ({
      name: character.name,
      role_position: character.role === '主角' ? '主角' as const : '配角' as const,
      character_kind: 'named_person',
      source_text: character.evidence_span,
      asset_stability: 'recurring',
    })),
    initiallyDetectedCharacters,
  );
  const knowledgeFocus = extractKnowledgeFocus(request.knowledge_pack, analysis.data?.detected_subjects ?? [], outline);
  const seriesTitle = request.series_title?.trim() || deriveSeriesTitle(outline, storyIntent?.main_character ?? null);
  const pacingProfile = request.pacing_profile ?? 'balanced_drama';
  const generationScope = request.generation_scope ?? 'full_planning';
  const narrativePatternIds = request.narrative_pattern_ids ?? [];
  const coreTheme = deriveAiComicSeriesCoreTheme(
    outline,
    storyIntent?.core_theme ?? summarizeText(outline, 18),
  );
  const recommendedNarrativePatterns = recommendNarrativePatternsForEntry({
    entry: buildAiComicNarrativeRecommendationEntry({
      outline,
      seriesTitle,
      knowledgePack: request.knowledge_pack,
      knowledgeFocus,
      detectedCharacters,
      coreTheme,
      pacingProfile,
    }),
    videoTypes: ['ai_comic_drama'],
    originalUserQuery: outline,
  });
  const resolvedNarrativePatternIds = narrativePatternIds.length > 0
    ? unique(narrativePatternIds).slice(0, 6)
    : recommendedNarrativePatterns.map(item => item.pattern_id).slice(0, 3);
  const phases = buildPhases(request.episode_count);
  const mainCharacters = buildCharacterArcs(
    detectedCharacters,
    request.episode_count,
    premiseContract.locked_characters.find(character => character.required)?.name
      ?? outlineCharacters[0]?.name
      ?? storyIntent?.main_character
      ?? null,
    premiseContract,
  );
  const plotThreads = buildPlotThreads(
    request.episode_count,
    seriesTitle,
    knowledgeFocus,
    pacingProfile,
    premiseContract,
  );
  const seriesSpine = buildSeriesSpine({
    phases,
    plotThreads,
    coreTheme,
    seriesTitle,
  });
  const episodes = buildEpisodes({
    episodeCount: request.episode_count,
    durationMin: request.episode_duration_range_sec.min,
    durationMax: request.episode_duration_range_sec.max,
    phases,
    characters: mainCharacters,
    plotThreads,
    knowledgeFocus,
    outline,
    coreTheme,
    pacingProfile,
    premiseContract,
  });

  return success({
    schema_version: 'ai-comic-series-plan/v1',
    series_title: seriesTitle,
    episode_count: request.episode_count,
    episode_duration_range_sec: request.episode_duration_range_sec,
    pacing_profile: pacingProfile,
    generation_scope: generationScope,
    narrative_pattern_ids: resolvedNarrativePatternIds.length > 0 ? resolvedNarrativePatternIds : undefined,
    recommended_narrative_patterns: recommendedNarrativePatterns,
    premise: outline,
    premise_contract: premiseContract,
    logline: buildLogline(seriesTitle, outline, coreTheme),
    core_theme: coreTheme,
    main_characters: mainCharacters,
    plot_threads: plotThreads,
    phases,
    series_spine: seriesSpine,
    episodes,
    continuity_rules: [
      {
        rule_id: 'rule-character-state',
        label: '角色状态递进',
        description: '每集只能在上一集状态上推进，不能让人物关系和动机回到未发生前。',
      },
      {
        rule_id: 'rule-open-threads',
        label: '线索开合记录',
        description: '新增线索必须在后续集数被延展、转向或回收，避免只提出不处理。',
      },
      {
        rule_id: 'rule-knowledge-boundary',
        label: '知识依据边界',
        description: '项目素材包明确内容作为事实依据，戏剧化补足内容需要保持可辨识的创作边界；素材库不是简单资料堆叠，必须按条目角色、关系、用途和可信度做生成决策。',
      },
      {
        rule_id: 'rule-episode-memory',
        label: '单集记忆输入',
        description: '生成某一集分镜前，需要带入上一集结尾、当前阶段目标、未回收线索和角色当前状态。',
      },
      {
        rule_id: 'rule-narrative-patterns',
        label: '流派机制一致',
        description: resolvedNarrativePatternIds.length > 0
          ? `系列全程强化：${narrativePatternLabels(resolvedNarrativePatternIds).join('、')}。每集需要把流派机制转成冲突、选择、钩子和回收。`
          : '默认按 AI 漫剧流派机制组织强钩子、对白冲突、反转和追看问题。',
      },
      {
        rule_id: 'rule-premise-contract',
        label: '用户设定硬门禁',
        description: '锁定人物、世界规则、核心代价和对抗力量必须进入每集规划；缺失或被通用模板替换时，设定忠实度审计必须失败。',
      },
    ],
    recurring_motifs: buildMotifs(knowledgeFocus, storyIntent?.target_emotion ?? []),
    production_notes: [
      `单集建议按 ${request.episode_duration_range_sec.min}-${request.episode_duration_range_sec.max} 秒规划，实际成片以分镜、对白密度和配音语速复核。`,
      '先审核系列规划，再逐集生成完整分镜；长系列不建议一次生成全部剧本文本。',
      '每集生成后应更新连续性状态，再进入下一集，保持人物选择、线索和情绪曲线前后相连。',
      '来源条目要被转成角色状态、线索、场景资产、时代边界和风险提示，不要把素材摘要直接堆进对白或旁白。',
      ...getNarrativePatternRequirementLines('ai_comic_drama', resolvedNarrativePatternIds).map(line => `流派机制：${line}`),
    ],
  });
}

function buildAiComicNarrativeRecommendationEntry(input: {
  outline: string;
  seriesTitle: string;
  knowledgePack?: KnowledgePack;
  knowledgeFocus: string[];
  detectedCharacters: StoryDetectedCharacter[];
  coreTheme: string;
  pacingProfile: AiComicPacingProfile;
}): EntryDetail {
  const primaryEntry = input.knowledgePack?.primary_entries?.[0];
  const supportingEntries = input.knowledgePack?.supporting_entries ?? [];
  const entryText = [
    input.outline,
    input.seriesTitle,
    input.coreTheme,
    ...(input.knowledgePack?.primary_entries ?? []).map(entry => `${entry.type} ${entry.summary} ${entry.keywords.join(' ')}`),
    ...supportingEntries.map(entry => `${entry.type} ${entry.summary} ${entry.keywords.join(' ')}`),
    ...input.detectedCharacters.map(character => `${character.name} ${character.role_position} ${character.character_kind} ${character.source_text}`),
    ...input.knowledgeFocus,
  ].join('\n');
  const pacingKeywords = input.pacingProfile === 'mystery_cliffhanger'
    ? ['悬疑', '钩子', '追更']
    : input.pacingProfile === 'fast_hook'
      ? ['短剧', '钩子', '反转']
      : [];
  const keywords = unique([
    ...(primaryEntry?.keywords ?? []),
    ...supportingEntries.flatMap(entry => entry.keywords),
    ...input.knowledgeFocus,
    ...input.detectedCharacters.map(character => character.name),
    ...pacingKeywords,
  ].filter(Boolean));

  return {
    name: primaryEntry?.entry_name ?? input.seriesTitle,
    province: primaryEntry?.province ?? '创作素材',
    region: primaryEntry?.region ?? 'AI 漫剧',
    type: primaryEntry?.type ?? inferAiComicRecommendationEntryType(entryText),
    summary: primaryEntry?.summary ?? summarizeText(input.outline, 90),
    story: [
      input.outline,
      input.coreTheme,
      ...supportingEntries.slice(0, 3).map(entry => entry.summary),
    ].join('\n'),
    culturalSignificance: input.coreTheme,
    relatedLocations: [],
    keywords,
    sources: ['ai-comic-series-outline'],
    credibility: primaryEntry ? 'medium' : 'creative_brief',
    unverifiedPoints: [],
    knowledge_domain: primaryEntry?.knowledge_domain,
    entry_role: primaryEntry?.entry_role,
    era: primaryEntry?.era,
    asset_usage: primaryEntry?.asset_usage,
    asset_split: primaryEntry?.asset_split,
  };
}

function inferAiComicRecommendationEntryType(text: string): string {
  if (/历史人物|名臣|诗人|将军|思想家|周敦颐|北宋|南宋|唐代|宋代|明代|清代/.test(text)) return '历史人物';
  if (/武侠|江湖|侠客|门派|武林/.test(text)) return '武侠题材';
  if (/悬疑|谜案|追查|探案|真凶/.test(text)) return '悬疑题材';
  if (/改编|原作|小说|章节|原著/.test(text)) return '改编素材';
  return 'AI 漫剧题材';
}

export async function generateAiComicEpisodeFromPlan(
  request: AiComicEpisodeGenerateRequest,
  options: { access_control?: ProductResourceOwnership } = {},
): Promise<ApiResponse<StoryGenerateResult>> {
  const existingProject = request.series_project_id
    ? await readSeriesProject(request.series_project_id)
    : null;
  if (request.series_project_id && !existingProject) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${request.series_project_id}" not found`);
  }
  const continuityLedger = existingProject?.continuity_ledger;
  const plan = request.series_plan;
  const episode = plan.episodes.find(item => item.episode_no === request.episode_no);
  if (!episode) {
    return fail(ErrorCodes.VALIDATION_ERROR, `episode_no ${request.episode_no} does not exist in series_plan`);
  }

  const matchedKnowledgePack = request.knowledge_pack ?? await buildKnowledgePackForSeries(plan);
  // A series created from an original user brief may legitimately have no
  // registered knowledge entry. In that case, let the normal story source
  // resolver materialize the outline as user-owned fictional source material
  // instead of making every episode permanently un-generatable.
  const knowledgePack = matchedKnowledgePack.primary_entries.length > 0
    ? matchedKnowledgePack
    : undefined;

  const narrativePatternIds = resolveAiComicNarrativePatternIds(plan, request.narrative_pattern_ids);
  const memoryRecallControls = mergeMemoryRecallControls(
    existingProject?.memory_recall_preferences,
    request.memory_recall_controls,
    episode.episode_no,
  );
  const episodeOutline = buildEpisodeAudienceGenerationOutline(
    plan,
    episode,
    continuityLedger,
  );
  return generateAndStoreChinaCultureStory({
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    story_structure: 'single_event_drama',
    selected_event: episode.title,
    target_video_duration: closestSupportedDuration(episode.target_duration_sec),
    original_user_query: episodeOutline,
    outline: episodeOutline,
    tone: `连续漫剧第${episode.episode_no}集，保持人物状态、线索开合和结尾钩子前后一致。`,
    output_gears_segments: request.output_gears_segments ?? true,
    model_profile_id: request.model_profile_id,
    creation_use_case: knowledgePack ? 'adapted_ai_comic' : 'original_ai_comic',
    truth_mode: knowledgePack ? 'source_adaptation' : 'fictional_original',
    knowledge_pack: knowledgePack,
    character_hints: buildEpisodeCharacterHints(plan, episode),
    narrative_pattern_ids: narrativePatternIds.length > 0 ? narrativePatternIds : undefined,
    auto_repair: request.auto_repair_episode ?? false,
  }, {
    access_control: existingProject?.project.access_control ?? options.access_control,
    transform_story_before_validation_and_persistence: story => {
      const episodeStory = ensureAiComicEpisodeAudienceStory({
        story,
        plan,
        episode,
        ledger: continuityLedger,
        outputGearsSegments: request.output_gears_segments ?? true,
      });
      return request.auto_audit_continuity === false
        ? episodeStory
        : attachAiComicEpisodeReports({
            story: episodeStory,
            plan,
            episode,
            ledger: continuityLedger,
          });
    },
  }).then(async result => {
    if (!result.ok || !result.data) return result;

    if (request.series_project_id) {
      await recordGeneratedEpisodeStory({
        seriesProjectId: request.series_project_id,
        plan,
        episode,
        story: result.data,
      });
    }

    return result;
  });
}

export async function previewAiComicEpisodeContext(
  request: AiComicEpisodeContextPreviewRequest,
): Promise<ApiResponse<AiComicEpisodeContextPreview>> {
  const existingProject = request.series_project_id
    ? await readSeriesProject(request.series_project_id)
    : null;
  if (request.series_project_id && !existingProject) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${request.series_project_id}" not found`);
  }

  const plan = request.series_plan;
  const episode = plan.episodes.find(item => item.episode_no === request.episode_no);
  if (!episode) {
    return fail(ErrorCodes.VALIDATION_ERROR, `episode_no ${request.episode_no} does not exist in series_plan`);
  }

  const ledger = existingProject?.continuity_ledger;
  const previousRecord = ledger?.episode_records
    .filter(record => record.episode_no < episode.episode_no)
    .sort((a, b) => b.episode_no - a.episode_no)[0];
  const next = plan.episodes.find(item => item.episode_no === episode.episode_no + 1);
  const fallbackLedger = normalizeContinuityLedger(ledger, plan);
  const narrativePatternIds = resolveAiComicNarrativePatternIds(plan, request.narrative_pattern_ids);
  const memoryRecallControls = mergeMemoryRecallControls(
    existingProject?.memory_recall_preferences,
    request.memory_recall_controls,
    episode.episode_no,
  );
  const focusedMemoryRecall = buildEpisodeMemoryRecall(
    plan,
    episode,
    fallbackLedger.series_memory,
    memoryRecallControls,
  );
  const focusedEpisodicMemoryRecall = buildEpisodeEpisodicMemoryRecall(
    plan,
    episode,
    fallbackLedger.episodic_memory,
  );
  const memoryConflictReport = buildAiComicMemoryConflictReport({ ledger: fallbackLedger });

  return success({
    schema_version: 'ai-comic-episode-context-preview/v1',
    series_project_id: request.series_project_id,
    episode_no: episode.episode_no,
    title: episode.title,
    used_saved_ledger: Boolean(ledger),
    blueprint: buildAiComicEpisodeBlueprint(plan, episode),
    narrative_patterns: narrativePatternLabels(narrativePatternIds),
    generation_outline: buildEpisodeGenerationOutline(
      plan,
      episode,
      fallbackLedger,
      narrativePatternIds,
      memoryRecallControls,
    ),
    focused_memory_recall: focusedMemoryRecall,
    focused_episodic_memory_recall: focusedEpisodicMemoryRecall,
    ledger_summary: {
      last_generated_episode_no: fallbackLedger.last_generated_episode_no,
      character_state_current: fallbackLedger.character_state_current,
      open_threads: fallbackLedger.open_threads,
      paid_off_threads: fallbackLedger.paid_off_threads,
      knowledge_used: fallbackLedger.knowledge_used,
      series_memory: buildSeriesMemorySummary(fallbackLedger.series_memory),
      production_constraints: buildProductionConstraintSummary(fallbackLedger.production_constraints),
      memory_conflicts: buildMemoryConflictSummary(memoryConflictReport),
      episodic_memory: buildEpisodicMemorySummary(fallbackLedger.episodic_memory),
    },
    previous_episode_memory: previousRecord?.next_episode_memory ?? episode.continuity_from_previous,
    next_episode_requirement: next
      ? `第${next.episode_no}集需要承接：${next.main_conflict}；${next.continuity_from_previous.join('；')}`
      : undefined,
  });
}

function attachAiComicEpisodeReports(params: {
  story: StoryGenerateResult;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  ledger?: AiComicContinuityLedger;
}): StoryGenerateResult {
  const blueprint = buildAiComicEpisodeBlueprint(params.plan, params.episode);
  const quality = buildAiComicEpisodeQualityReport(params);
  const continuityAudit = buildAiComicContinuityAudit({
    ...params,
    episodeQuality: quality,
  });
  return {
    ...params.story,
    ai_comic_episode_blueprint: blueprint,
    ai_comic_episode_quality: quality,
    continuity_audit: continuityAudit,
  };
}

function ensureAiComicEpisodeAudienceStory(params: {
  story: StoryGenerateResult;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  ledger?: AiComicContinuityLedger;
  outputGearsSegments: boolean;
}): StoryGenerateResult {
  if (!shouldRewriteAiComicEpisodeStory(params.story, params.episode)) {
    return params.story;
  }

  return buildAiComicEpisodeAudienceStory(params);
}

function shouldRewriteAiComicEpisodeStory(story: StoryGenerateResult, episode: AiComicEpisodePlan): boolean {
  const text = [
    story.full_text,
    story.credibility_note,
    ...(story.scene_breakdown ?? []).flatMap(scene => [
      scene.plot,
      scene.visual_prompt,
      scene.dialogue_or_narration ?? '',
      scene.key_action,
    ]),
    ...(story.gears_segments ?? []).map(segment => segment.script_text),
  ].join('\n');
  if (story.generation_used_fallback || story.generation_mode !== 'external_model') return true;
  if (/(生成优先级|核心画面是|知识库使用规则|素材使用规则|连续性账本|叙事流派机制|目标场景功能|新增知识焦点|新增素材焦点|新增剧情信息|建立主角初始状态|阶段转折落地|打开线索|知识线|素材线|推进phase|指向第\d+集)/.test(text)) return true;
  if (/\*\*[^*]+?\*\*/.test(text)) return true;
  const paragraphs = story.full_text
    .split(/\n{2,}/)
    .map(item => item.replace(/\s+/g, '').replace(/第\d+集/g, '第N集'))
    .filter(Boolean);
  const repeatedParagraphCount = paragraphs.length - new Set(paragraphs).size;
  if (paragraphs.length >= 4 && repeatedParagraphCount >= 2) return true;
  const episodeSignals = [
    episode.main_conflict,
    episode.midpoint_turn ?? '',
    episode.ending_hook,
    ...episode.new_information,
  ].filter(Boolean);
  return !matchesAny(text, episodeSignals);
}

function buildAiComicEpisodeAudienceStory(params: {
  story: StoryGenerateResult;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  ledger?: AiComicContinuityLedger;
  outputGearsSegments: boolean;
}): StoryGenerateResult {
  const blueprint = buildAiComicEpisodeBlueprint(params.plan, params.episode);
  const scenes = buildAiComicEpisodeAudienceScenes(params.plan, params.episode, blueprint, params.story.source_entry);
  const gearsSegments = params.outputGearsSegments ? buildAiComicEpisodeAudienceGearsSegments(scenes, params.story.source_entry) : [];
  const protagonist = scenes[0]?.characters[0] ?? params.episode.key_characters[0] ?? params.plan.main_characters[0]?.name ?? '主角';
  const fullText = scenes.map(scene => scene.plot).join('\n\n');
  const episodeStoryTitle = formatAiComicEpisodeTitle(params.episode);
  const baseQualityReport = validateDramaticStory({
    title: episodeStoryTitle,
    selectedEvent: params.episode.title,
    full_text: fullText,
    scene_breakdown: scenes,
    videoType: 'ai_comic_drama',
  });
  const qualityReport = {
    ...baseQualityReport,
    video_type: 'ai_comic_drama' as const,
    story_structure: params.story.story_structure,
    truth_mode: params.story.truth_mode,
    material_sufficiency_report: params.story.material_sufficiency,
    genre_score: baseQualityReport.passed ? 88 : 76,
    repair_actions: baseQualityReport.issues.length > 0
      ? baseQualityReport.issues.map(issue => `继续强化：${issue}`)
      : [],
  };
  const characters = buildAiComicEpisodeAudienceCharacters(params.plan, params.episode, protagonist, scenes);

  const audienceStory: StoryGenerateResult = {
    ...params.story,
    title: episodeStoryTitle,
    logline: `${protagonist}在《${params.plan.series_title}》第${params.episode.episode_no}集中面对“${params.episode.main_conflict}”，因${blueprint.midpoint_turn}改变判断，并把选择留给下一集继续承接。`,
    theme: params.plan.core_theme || '选择与良知',
    full_text: fullText,
    scene_breakdown: scenes,
    gears_segments: gearsSegments,
    quality_report: qualityReport,
    credibility_note: buildAiComicEpisodeCredibilityNote(params.story, params.plan, params.episode),
    characters,
    act_structure: [
      { act: 1, beat: '承接上集与建立压力', scene_ids: [1, 2], purpose: blueprint.opening_hook },
      { act: 2, beat: '新信息推翻判断', scene_ids: [3, 4], purpose: blueprint.midpoint_turn },
      { act: 3, beat: '选择落点与追看钩子', scene_ids: [5], purpose: blueprint.ending_hook },
    ],
    protagonist_arc: [{
      starting_state: params.episode.continuity_from_previous[0] ?? `${protagonist}带着未解问题进入本集。`,
      turning_point: blueprint.midpoint_turn,
      resolution: blueprint.character_state_change,
    }],
    dialogue: scenes.map(scene => ({
      scene_id: scene.scene_id,
      lines: splitEpisodeDialogue(scene.dialogue_or_narration ?? '', scene.characters),
    })),
  };
  audienceStory.gears_delivery = buildGearsDeliveryPackage(audienceStory);
  return audienceStory;
}

function formatAiComicEpisodeTitle(episode: AiComicEpisodePlan): string {
  const title = episode.title.trim();
  const prefix = `第${episode.episode_no}集：`;
  return title.startsWith(prefix) ? title : `${prefix}${title}`;
}

interface AiComicEpisodeSceneDraft {
  title: string;
  duration: number;
  location: string;
  time: string;
  functionLabel: string;
  plot: string;
  keyAction: string;
  conflict: string;
  dialogue: string;
  visual: string;
  camera: string;
  chars: string[];
}

function buildAiComicEpisodeAudienceScenes(
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
  blueprint: AiComicEpisodeBlueprint,
  sourceEntry: string,
): StoryScene[] {
  const characters = unique([
    ...episode.key_characters,
    ...plan.main_characters.map(character => character.name),
  ].filter(Boolean));
  const protagonist = characters[0] ?? '主角';
  const isRuleMystery = isRuleMysteryPremise([
    plan.premise,
    ...seriesPremiseAnchorLines(plan.premise_contract),
  ].join('\n'));
  const isHeritageStageRescue = isAiComicHeritageStageRescueText([
    plan.premise,
    plan.core_theme,
    episode.title,
    episode.main_conflict,
  ].join('\n'));
  const lockedCharacterNames = plan.premise_contract?.locked_characters
    .filter(character => character.required)
    .map(character => character.name) ?? [];
  const witnessCandidate = isRuleMystery
    ? lockedCharacterNames.find(name => name !== protagonist) ?? characters[1]
    : characters.find(name => name !== protagonist && /见证|少年|同伴|关键/.test(name))
      ?? characters[1];
  const witness = isHeritageStageRescue && /^(少年|关键见证者|对照角色|配角)$/.test(witnessCandidate ?? '')
    ? '戏班同伴'
    : naturalizeAiComicCharacterLabel(witnessCandidate, isHeritageStageRescue ? '戏班同伴' : '见证人');
  const premisePressureRoles = plan.premise_contract?.antagonistic_forces
    .filter(force => force.required)
    .map(force => force.label) ?? [];
  const pressureRole = isRuleMystery
    ? premisePressureRoles[(episode.episode_no - 1) % Math.max(1, premisePressureRoles.length)] ?? '盗谱者'
    : isHeritageStageRescue
    ? chooseAiComicHeritagePressureRole(characters, protagonist, witness)
    : chooseAiComicPressureRole(characters, protagonist, witness);
  const locations = inferAiComicEpisodeLocations(plan, episode);
  const newInfo = isRuleMystery
    ? episode.new_information.find(item => /规则|记忆|灯谱|开发商|盗谱者/.test(item))
      ?? episode.new_information[0]
      ?? '一条新的规则痕迹'
    : episode.new_information[0] ?? episode.knowledge_focus[0] ?? '一条新的证词';
  const visibleNewInfo = naturalizeAiComicNewInformationForScene(newInfo);
  const foreshadowing = episode.foreshadowing[0] ?? '案卷边角的旧墨痕';
  const visibleForeshadowing = isHeritageStageRescue
    ? foreshadowing
        .replace(/^.+?主线推进[:：]\s*/, '')
        .replace(/[。！？!?]+$/, '')
    : naturalizeAiComicForeshadowing(foreshadowing);
  const payoff = episode.payoff[0] ?? blueprint.thread_action;
  const visiblePayoff = naturalizeAiComicPlanningSubject(
    isHeritageStageRescue && /(打开线索|推进|后续必须承接|回收线索)/.test(payoff)
      ? `本集${episode.knowledge_focus[0] ?? '守艺任务'}的可复演成果`
      : isHeritageStageRescue
        ? payoff.replace(/[。！？!?]+$/, '')
        : naturalizeAiComicPayoff(payoff),
    protagonist,
  );
  const visibleMidpoint = naturalizeAiComicMidpointTurn(blueprint.midpoint_turn, plan.core_theme, protagonist);
  const visibleMainConflict = naturalizeAiComicPlanningSubject(episode.main_conflict, protagonist);
  const visibleEndingHook = naturalizeAiComicPlanningSubject(blueprint.ending_hook, protagonist);
  const previousState = isRuleMystery
    ? `${protagonist}与${witness}带着双人灯票和上一集留下的记忆记录进入本集。`
    : isHeritageStageRescue
    ? naturalizeAiComicHeritageContinuityState(episode.continuity_from_previous[0], protagonist)
    : naturalizeAiComicContinuityState(episode.continuity_from_previous[0], protagonist);

  const baseSceneDrafts: AiComicEpisodeSceneDraft[] = [
    {
      title: '未签的案卷',
      duration: 12,
      location: locations.office,
      time: '雨夜',
      functionLabel: '钩子开场',
      plot: `${previousState}雨声压过更鼓，${protagonist}在${locations.office}看见案卷上已经蘸好的朱笔；“签”字只差一笔，${witness}却把一枚带泥的证物放到灯下，逼他重新看向判词。`,
      keyAction: `${protagonist}停笔，先看证物再看判词。`,
      conflict: `${visibleMainConflict}；快签结案的压力撞上新的疑点。`,
      dialogue: `${witness}：“若这证物是真的，文书就不能这样落笔。”\n${protagonist}：“笔可以慢一刻，人命不能错一生。”`,
      visual: `${locations.office}，雨夜，木案、烛火、案卷、朱笔、带泥证物，${protagonist}停笔特写，竖屏近景构图`,
      camera: '案卷特写推到人物眼神，前3秒锁住“签或不签”的压力',
      chars: [protagonist, witness],
    },
    {
      title: '少年带来的新口供',
      duration: 18,
      location: locations.threshold,
      time: '夜',
      functionLabel: '人物登场',
      plot: `${witness}把${visibleNewInfo}摆到灯下，但话未说完，门外的差役已经催促文书归档。${protagonist}没有立刻相信任何一方，只让${witness}把看到的时间、地点和物件一一摆出来。`,
      keyAction: `${protagonist}追问细节，把新信息变成可核对的线索。`,
      conflict: `证词是否可信；${protagonist}必须在同情和证据之间保持清醒。`,
      dialogue: `${protagonist}：“你说新证，不说哭声；说你看见了什么。”\n${witness}：“我看见封泥未干，押印却在雨前。”`,
      visual: `${locations.threshold}，夜色，门槛水迹、封泥、押印、布衣少年，三人形成三角构图`,
      camera: '中景交代人物位置，切少年手中证物和周敦颐表情',
      chars: [protagonist, witness, pressureRole],
    },
    {
      title: '催签与反问',
      duration: 20,
      location: locations.office,
      time: '深夜',
      functionLabel: '冲突爆发',
      plot: `${pressureRole}把文书推回案前，提醒${protagonist}拖延会得罪上意。${protagonist}把证物压在判词旁，反问若案卷有错，谁替死者和活人承担后果。屋内一瞬安静，只有烛泪落在纸边。`,
      keyAction: `${protagonist}公开拒绝仓促签字，要求复核案卷。`,
      conflict: `权势要求马上签；${protagonist}坚持疑案先查。`,
      dialogue: `${pressureRole}：“一纸文书，签了便过。”\n${protagonist}：“若一纸能夺命，一笔就不能偷懒。”`,
      visual: `${locations.office}，深夜，案卷、判词、证物并排，施压者半身入画，${protagonist}手按文书`,
      camera: '快切对白，压低机位突出案卷重量',
      chars: [protagonist, pressureRole, witness],
    },
    {
      title: '新信息推翻判断',
      duration: 20,
      location: locations.archive,
      time: '拂晓前',
      functionLabel: '反转/觉醒',
      plot: `${visibleMidpoint}。${protagonist}翻出旧录，发现${visibleForeshadowing}与${witness}所说相互扣合；他意识到“拒签”不是逞强，而是先把疑点查到底。`,
      keyAction: `${protagonist}把旧录与新证并排核对，改变原先判断。`,
      conflict: `原本可以用程序结案；新证迫使${protagonist}承担复查代价。`,
      dialogue: `${witness}：“先生信我了？”\n${protagonist}：“我信证据。也信这案子还没说完。”`,
      visual: `${locations.archive}，拂晓前，旧录、封泥、墨痕、竹简或纸卷平铺，烛火将尽，人物俯身核对`,
      camera: '手部特写连到眼神特写，完成认知转折',
      chars: [protagonist, witness],
    },
    {
      title: '留给下一集的问题',
      duration: 20,
      location: locations.courtyard,
      time: '清晨',
      functionLabel: '高燃收束',
      plot: `${protagonist}收起未签的文书，命人暂缓行刑并追查${visiblePayoff}。他知道这一笔守住的不是面子，而是一条人命前的良知。天光照进院中，${witness}终于松一口气，却在门边看见另一个被遮住姓名的案号；${visibleEndingHook}`,
      keyAction: `${protagonist}为良知承担拒签后果，并留下下一集必须回应的新问题。`,
      conflict: `守住良知暂时赢得时间，但更深的案卷被打开。`,
      dialogue: `${protagonist}：“不是每一次拒签都能救人，但每一次草签都可能害人。”\n${witness}：“那下一卷呢？”`,
      visual: `${locations.courtyard}，清晨，未签文书、封存案卷、院门晨光、人物背影，最后露出被遮住姓名的新案号`,
      camera: '金句定格后推向新案号，形成集末钩子',
      chars: [protagonist, witness],
    },
  ];
  const sceneDrafts = isRuleMystery
    ? buildAiComicRuleMysteryEpisodeSceneDrafts({
        episode,
        protagonist,
        witness,
        pressureRole,
        requiredRules: plan.premise_contract?.world_rules
          .filter(rule => rule.required)
          .map(rule => rule.statement) ?? [],
        antagonisticForces: premisePressureRoles,
        coreStakes: plan.premise_contract?.core_stakes ?? [],
        visibleNewInfo,
        visibleMidpoint,
        visibleMainConflict,
        visibleEndingHook,
        previousState,
      })
    : isHeritageStageRescue
    ? buildAiComicHeritageStageEpisodeSceneDrafts({
        episode,
        blueprint,
        protagonist,
        witness,
        pressureRole,
        visibleNewInfo,
        visibleForeshadowing,
        visiblePayoff,
        visibleMidpoint,
        visibleMainConflict,
        visibleEndingHook,
        previousState,
      })
    : episode.episode_no === 1
      ? baseSceneDrafts
      : buildAiComicFollowupEpisodeSceneDrafts({
        episode,
        blueprint,
        protagonist,
        witness,
        pressureRole,
        locations,
        visibleNewInfo,
        visibleForeshadowing,
        visiblePayoff,
        visibleMidpoint,
        visibleMainConflict,
        visibleEndingHook,
        previousState,
        });

  return sceneDrafts.map((draft, index) => ({
    scene_id: index + 1,
    title: draft.title,
    duration_sec: draft.duration,
    location: draft.location,
    time_of_day: draft.time,
    dramatic_function: draft.functionLabel,
    plot: draft.plot,
    key_action: draft.keyAction,
    characters: draft.chars,
    visual_prompt: draft.visual,
    camera_suggestion: draft.camera,
    cultural_note: isRuleMystery
      ? `本场以${sourceEntry}为用户原创悬疑故事依据；皮影制作、灯幕和操偶细节按非遗事实复核，午夜规则与记忆抹除只作为虚构机制。`
      : isHeritageStageRescue
      ? `本场以${sourceEntry}为原创故事依据；皮影制作、灯幕、戏台与戏班协作细节需要后续由非遗从业者复核。`
      : `本场以${sourceEntry}和宋代士人/衙署器物边界为依据，案件细节属于影视化虚构。`,
    conflict: draft.conflict,
    dialogue_or_narration: draft.dialogue,
    source_entries: [sourceEntry],
    factual_basis: isRuleMystery
      ? `皮影器物与表演流程需要依据${sourceEntry}复核；角色、午夜规则、记忆代价和盗谱调查均为原创剧情。`
      : isHeritageStageRescue
      ? `人物、拆迁倒计时和祖父机关谱来自${sourceEntry}；具体修复动作、商谈与演出调度为原创剧情。`
      : `人物与文化背景参考${sourceEntry}；本集案情和见证细节为系列创作。`,
    fictionalized_elements: isRuleMystery
      ? ['午夜皮影规则、记忆抹除、失传灯谱、开发商与盗谱者对抗为原创悬疑机制']
      : isHeritageStageRescue
      ? ['角色对白、机关谱线索、修复难题和分场节奏为原创影视化处理']
      : ['案卷调度、对白、证物和分场节奏为影视化创作处理'],
  }));
}

function buildAiComicRuleMysteryEpisodeSceneDrafts(input: {
  episode: AiComicEpisodePlan;
  protagonist: string;
  witness: string;
  pressureRole: string;
  requiredRules: string[];
  antagonisticForces: string[];
  coreStakes: string[];
  visibleNewInfo: string;
  visibleMidpoint: string;
  visibleMainConflict: string;
  visibleEndingHook: string;
  previousState: string;
}): AiComicEpisodeSceneDraft[] {
  const commercial = input.episode.commercial_beats;
  const sceneFunctions = commercial?.scene_function_sequence ?? [];
  const rule = input.requiredRules[input.episode.episode_no % Math.max(1, input.requiredRules.length)]
    ?? '午夜皮影戏必须遵守二十条规则';
  const ruleSet = input.requiredRules.join('；') || rule;
  const forces = input.antagonisticForces.join('与') || input.pressureRole;
  const stake = input.coreStakes[0] ?? '违反规则会被抹去记忆';
  const episodeMark = String(input.episode.episode_no).padStart(2, '0');
  return [
    {
      title: `午夜第${episodeMark}次开演`,
      duration: 12,
      location: '午夜皮影戏台前场',
      time: '午夜前一分钟',
      functionLabel: sceneFunctions[0] ?? '规则钩子',
      plot: `${input.previousState}${commercial?.hook_3s ?? `${input.protagonist}与${input.witness}赶到白幕前，灯票背面刚浮出第${episodeMark}道墨痕。`} ${ruleSet}。两人还没对完字，戏台里的影偶已经自己转头。`,
      keyAction: `${input.protagonist}用灯票记录新规则，${input.witness}核对两人的共同记忆。`,
      conflict: input.visibleMainConflict,
      dialogue: commercial?.opening_dialogue
        ?? `${input.witness}：“先报名字。${input.protagonist}、${input.witness}，一个都不能少。”\n${input.protagonist}：“若我又忘了，就按灯票把我带回来。”`,
      visual: `午夜皮影戏台，旧白幕、暖黄油灯、皮影影偶、写有二十条规则的灯票，${input.protagonist}与${input.witness}并肩核对，9:16竖屏近景`,
      camera: '灯票极近特写切到影偶自行转头，前三秒建立规则异常',
      chars: [input.protagonist, input.witness],
    },
    {
      title: '灯票上的记忆缺口',
      duration: 18,
      location: '戏台灯幕后',
      time: '午夜',
      functionLabel: sceneFunctions[1] ?? '证据核对',
      plot: `${commercial?.episode_goal ?? `${input.protagonist}和${input.witness}把${input.visibleNewInfo}与旧灯票并排。`} ${commercial?.failure_cost ?? stake}。票根上的双人手印还在，${input.protagonist}却说不出上一次开演后发生了什么。`,
      keyAction: `${input.witness}用灯票、手印和影偶位置为${input.protagonist}重建被抹去的一段记忆。`,
      conflict: '两人必须相信可核对的证据，不能把残缺记忆当作事实。',
      dialogue: `${input.protagonist}：“我记得这盏灯，不记得你为什么替我守着它。”\n${input.witness}：“那就别信感觉，先信我们一起留下的证据。”`,
      visual: `灯幕后，灯票、双人手印、旧影偶与操纵杆排成证据链，暖灯与冷月光交界，人物手部特写`,
      camera: '横移扫过证据链，停在两人相互确认的眼神上',
      chars: [input.protagonist, input.witness],
    },
    {
      title: `${forces}同时施压`,
      duration: 20,
      location: '戏台侧门与档案柜',
      time: '午夜过后',
      functionLabel: sceneFunctions[2] ?? '对抗升级',
      plot: `${forces}在同一刻逼近：${input.pressureRole}试图拿走失传灯谱，另一股力量则切断戏台外的退路。${input.protagonist}守住档案柜，${input.witness}把真假灯谱分开，迫使对手先暴露目标。`,
      keyAction: `${input.protagonist}与${input.witness}分工保护灯谱并追认对抗力量。`,
      conflict: commercial?.external_pressure ?? `${forces}构成双重压力；两人若分开，就可能再次失去共同记忆。`,
      dialogue: `${input.pressureRole}：“交出灯谱，这场戏就与你们无关。”\n${input.protagonist}：“你越想删掉它，我越要知道谁怕我们记起来。”`,
      visual: `戏台侧门，半开的档案柜、真假灯谱、皮影雕刀与操纵杆，门外冷光压入，人物形成对峙三角`,
      camera: '手持跟拍抢谱动作，切回两人背靠背守住证据',
      chars: [input.protagonist, input.witness, input.pressureRole],
    },
    {
      title: '规则背后的操控者',
      duration: 20,
      location: '白幕与灯箱之间',
      time: '午夜深处',
      functionLabel: sceneFunctions[3] ?? '信息反转',
      plot: `${commercial?.midpoint_turn ?? input.visibleMidpoint}${input.protagonist}把本集触发痕迹投上白幕，影子却指向观众席而不是后台。${input.witness}意识到，有人正借规则制造可控的遗忘，把${forces}的行动藏进空白记忆。`,
      keyAction: commercial?.character_choice ?? '两人改变调查方向，从追查异常影偶转向寻找人为触发规则的证据。',
      conflict: '世界规则真实生效，但触发时机可能被人操控。',
      dialogue: `${input.witness}：“规则没有撒谎，撒谎的是决定谁先触犯它的人。”\n${input.protagonist}：“那就去找那个一直替我们安排错误位置的人。”`,
      visual: `白幕与灯箱夹层，影子反向指向空观众席，规则字迹投在人物脸上，强明暗反差`,
      camera: '从后台越过白幕反打观众席，完成空间反转',
      chars: [input.protagonist, input.witness],
    },
    {
      title: '下一条规则亮起',
      duration: 20,
      location: '熄灯后的戏台中央',
      time: '凌晨',
      functionLabel: sceneFunctions[4] ?? '结尾追问',
      plot: `${input.protagonist}与${input.witness}把本集证据封进双人灯票，约定任何一方失忆都由另一方复述。油灯熄灭后，白幕上仍亮着一行没人写过的规则；${commercial?.cliffhanger_question ?? input.visibleEndingHook}`,
      keyAction: '两人用双重记录守住身份和证据，并把新规则留给下一集验证。',
      conflict: `${stake}；新规则开始直接针对两人的互信。`,
      dialogue: `${input.protagonist}：“若下一次我连你的名字也忘了呢？”\n${input.witness}：“那我就让你重新选择一次，要不要和${input.witness}并肩。”`,
      visual: `熄灯戏台，白幕残留幽蓝规则字迹，双人灯票封入木盒，${input.protagonist}与${input.witness}剪影并肩，结尾定格`,
      camera: '从木盒慢推到白幕新规则，再切两人剪影定格',
      chars: [input.protagonist, input.witness],
    },
  ];
}

function buildAiComicHeritageStageEpisodeSceneDrafts(input: {
  episode: AiComicEpisodePlan;
  blueprint: AiComicEpisodeBlueprint;
  protagonist: string;
  witness: string;
  pressureRole: string;
  visibleNewInfo: string;
  visibleForeshadowing: string;
  visiblePayoff: string;
  visibleMidpoint: string;
  visibleMainConflict: string;
  visibleEndingHook: string;
  previousState: string;
}): AiComicEpisodeSceneDraft[] {
  const {
    episode,
    protagonist,
    witness,
    pressureRole,
    visibleNewInfo,
    visibleForeshadowing,
    visiblePayoff,
    visibleMidpoint,
    visibleMainConflict,
    visibleEndingHook,
    previousState,
  } = input;
  const episodeLabel = episode.title.replace(/^第\d+集[:：]\s*/, '');
  const craftFocus = episode.knowledge_focus[0] || '皮影守艺任务';
  return [
    {
      title: episodeLabel.endsWith('倒计时') ? episodeLabel : `${episodeLabel}的倒计时`,
      duration: 12,
      location: '长沙老街旧戏台前场',
      time: '清晨',
      functionLabel: '钩子开场',
      plot: `${previousState}清晨，新的拆除时限贴上旧戏台。${protagonist}刚把灯幕拉起，${visibleMainConflict}他没有撕告示，而是把本集必须完成的守艺任务写在告示背面。`,
      keyAction: `${protagonist}翻过拆除告示，写下本集可验收的守艺目标。`,
      conflict: visibleMainConflict,
      dialogue: `${pressureRole}：“时间到了，戏台就得清场。”\n${protagonist}：“给我这一集的时间，我让你看见它为什么不能只当旧木头。”`,
      visual: `长沙老街旧戏台，拆除告示、破白幕、晨光、${protagonist}写下任务，9:16竖屏近景`,
      camera: '拆除日期特写切到主角落笔，前3秒建立倒计时',
      chars: [protagonist, pressureRole, witness],
    },
    {
      title: `${craftFocus}上手`,
      duration: 18,
      location: '旧戏台后台与皮影工作台',
      time: '上午',
      functionLabel: '任务拆解',
      plot: `${protagonist}和${witness}把${visibleNewInfo}摊到工作台上，从灯位、影偶关节和幕布透光逐项验证。第一次试装失败后，${protagonist}停下蛮干，先记录损伤再改动作。`,
      keyAction: `${protagonist}完成一次可见的拆解、试装和失败复盘。`,
      conflict: `守艺任务需要慢工复核，拆除倒计时却不断缩短。`,
      dialogue: `${witness}：“再用力一点，也许就卡进去了。”\n${protagonist}：“老东西最怕硬来。先看它为什么不肯动。”`,
      visual: `皮影工作台，机关谱、影偶、针线、灯幕样片，手部操作特写，所有工具位置连续`,
      camera: '俯拍工作台后推近手部，失败瞬间用近景停住',
      chars: [protagonist, witness],
    },
    {
      title: '台前台后分歧',
      duration: 20,
      location: '旧戏台前后台交界',
      time: '午后',
      functionLabel: '冲突爆发',
      plot: `${pressureRole}要求立刻拿成品，${witness}也质疑继续修旧物是否来得及。${protagonist}把失败的部件、修复记录和可用方案并排摆开，拒绝用一次漂亮但不可重复的假演出蒙混过关。`,
      keyAction: `${protagonist}公开修复边界，选择可重复的演出方案。`,
      conflict: `外部只要即时效果，${protagonist}坚持让${craftFocus}真正能被戏班继续使用。`,
      dialogue: `${pressureRole}：“观众只看幕上的影，谁会问你怎么修？”\n${protagonist}：“幕后的手若接不下去，今晚再亮也只是最后一次。”`,
      visual: `戏台前后台交界，一侧是亮幕，一侧是工作台和修复记录，三人站位形成对峙`,
      camera: '从台前亮幕横移到后台双手，完成价值冲突',
      chars: [protagonist, witness, pressureRole],
    },
    {
      title: `${episodeLabel}的反转`,
      duration: 20,
      location: '旧戏台灯幕后',
      time: '傍晚',
      functionLabel: '反转/觉醒',
      plot: `${visibleMidpoint}。${protagonist}让灯重新亮起，把新发现放进同一套操偶动作验证；幕上的影子不再卡顿，${witness}也终于看懂祖父留下的线索不是纪念品，而是一套等待接续的方法。`,
      keyAction: `${protagonist}用灯幕后的一次完整动作验证中段新发现。`,
      conflict: `新发现能解眼前难题，却会把祖父秘密和戏班旧怨继续带出来。`,
      dialogue: `${witness}：“原来他留下的不是答案。”\n${protagonist}：“是让后来的人还能亲手试出答案。”`,
      visual: `灯幕后，暖色灯源、白幕、影偶轮廓、机关谱投影关系清楚，人物手势连续`,
      camera: '手部特写跟到幕上完整影子，再回到人物反应',
      chars: [protagonist, witness],
    },
    {
      title: '下一束灯光',
      duration: 20,
      location: '长沙老街旧戏台前场',
      time: '入夜',
      functionLabel: '高燃收束',
      plot: `${protagonist}完成${visiblePayoff || craftFocus}，把本集成果交给戏班成员复验。灯幕刚稳定，${visibleEndingHook || visibleForeshadowing}`,
      keyAction: `${protagonist}把成果交给他人复演，并主动接下下一集难题。`,
      conflict: `本集守艺任务得到可见结果，拆除与演出长线仍继续加压。`,
      dialogue: `${protagonist}：“这一道影不是我一个人的，换你来。”\n${witness}：“灯亮了，可下一关已经到门口。”`,
      visual: `长沙老街入夜，稳定白幕、完成修复的影偶、成员接手操偶，最后定格下一项难题`,
      camera: '先让接手动作完整发生，再推向新难题形成集末钩子',
      chars: [protagonist, witness, pressureRole],
    },
  ];
}

function buildAiComicFollowupEpisodeSceneDrafts(input: {
  episode: AiComicEpisodePlan;
  blueprint: AiComicEpisodeBlueprint;
  protagonist: string;
  witness: string;
  pressureRole: string;
  locations: ReturnType<typeof inferAiComicEpisodeLocations>;
  visibleNewInfo: string;
  visibleForeshadowing: string;
  visiblePayoff: string;
  visibleMidpoint: string;
  visibleMainConflict: string;
  visibleEndingHook: string;
  previousState: string;
}): AiComicEpisodeSceneDraft[] {
  const {
    episode,
    blueprint,
    protagonist,
    witness,
    pressureRole,
    locations,
    visibleNewInfo,
    visibleForeshadowing,
    visiblePayoff,
    visibleMidpoint,
    visibleMainConflict,
    visibleEndingHook,
    previousState,
  } = input;
  if (episode.episode_no === 2 && isAiComicRefusalCaseText([
    episode.title,
    episode.main_conflict,
    blueprint.midpoint_turn,
    blueprint.ending_hook,
    previousState,
  ].join('\n'))) {
    return buildAiComicSecondRefusalEpisodeSceneDrafts(input);
  }
  return [
    {
      title: '廊下截证',
      duration: 12,
      location: locations.threshold,
      time: '雨停前',
      functionLabel: '钩子开场',
      plot: `${previousState}${protagonist}刚走出案房，${witness}就在廊下拦住他，把${visibleNewInfo}按在湿木栏上。远处更鼓未停，催签的人已经沿廊而来。`,
      keyAction: `${protagonist}没有回到案桌，而是把新证带到廊下当场核问。`,
      conflict: `${visibleMainConflict}；新证不在案卷里，却可能改写案卷。`,
      dialogue: `${witness}：“若进了案房，这话就说不完了。”\n${protagonist}：“那就在廊下说，先让证物开口。”`,
      visual: `${locations.threshold}，雨停前，湿木栏、灯笼、带泥证物、催签差役远影，人物被廊柱分隔`,
      camera: '横移穿过廊柱，先见证物再见追来的差役',
      chars: [protagonist, witness],
    },
    {
      title: '验印桌前',
      duration: 18,
      location: locations.archive,
      time: '深夜',
      functionLabel: '人物登场',
      plot: `${protagonist}把新证移到验印桌前，命人取来旧封泥和押印底册。${pressureRole}提醒他越过常规会惹祸，${protagonist}只把灯挪近一寸，让印痕的缺口显出来。`,
      keyAction: `${protagonist}把口供变成印痕、封泥和时间的复核。`,
      conflict: `复核会拖慢结案；不复核就可能让错案盖棺。`,
      dialogue: `${pressureRole}：“先生这是要把一卷案拖成三卷。”\n${protagonist}：“若一卷写错，三卷也嫌少。”`,
      visual: `${locations.archive}，深夜，验印桌、旧封泥、押印底册、油灯近光，人物手指停在印痕缺口`,
      camera: `俯拍证物排列，切到${pressureRole}与${protagonist}对视`,
      chars: [protagonist, pressureRole, witness],
    },
    {
      title: '证词对质',
      duration: 20,
      location: locations.courtyard,
      time: '夜尽',
      functionLabel: '冲突爆发',
      plot: `${witness}说出的时间与底册互相咬合，${pressureRole}却抓住一句含糊处逼问。${protagonist}没有替任何人辩解，只让两份证词并排重说，直到${visibleForeshadowing}露出破绽。`,
      keyAction: `${protagonist}主持当场对质，让矛盾从情绪变成证据。`,
      conflict: `见证者可能记错；${pressureRole}借一个错字逼${protagonist}放弃复核。`,
      dialogue: `${witness}：“我记得雨声，不记得更鼓几下。”\n${protagonist}：“不怕记不全，怕有人要你闭口。”`,
      visual: `${locations.courtyard}，夜尽，院中水痕、两份证词、对质人影，${protagonist}站在证词之间`,
      camera: `快速切换两张证词，停在${protagonist}抬眼的瞬间`,
      chars: [protagonist, witness, pressureRole],
    },
    {
      title: '旧录翻案',
      duration: 20,
      location: locations.archive,
      time: '天将亮',
      functionLabel: '反转/觉醒',
      plot: `${visibleMidpoint}。${protagonist}在旧录角落发现同样的印痕缺口，才明白这不是一名少年求情，而是一套文书流程里藏着漏洞。`,
      keyAction: `${protagonist}把本集新证与旧录并排，确认判断必须改向。`,
      conflict: `复查不再只是救一案，而是触碰更深的文书链条。`,
      dialogue: `${pressureRole}：“查到这里，已经不是本案了。”\n${protagonist}：“正因如此，才不能签。”`,
      visual: `${locations.archive}，天将亮，旧录角落、印痕缺口、封泥碎屑、${protagonist}翻卷的手，窗外微光`,
      camera: `从旧录角落推近到${protagonist}眼神，完成反转`,
      chars: [protagonist, pressureRole],
    },
    {
      title: '传唤入门',
      duration: 20,
      location: locations.threshold,
      time: '清晨',
      functionLabel: '高燃收束',
      plot: `${protagonist}把未签文书重新封起，命人追查${visiblePayoff}。他知道拒签已经从一念良知变成公开承担。清晨第一道传唤送到门前，封套上写着新的案号；${visibleEndingHook}`,
      keyAction: `${protagonist}把复查升级为正式行动，并承接下一集压力。`,
      conflict: `良知让他多争来一夜，也把更大的阻力引到门前。`,
      dialogue: `${protagonist}：“今日不签，是为明日能问。”\n${witness}：“问到最后，若无人肯答呢？”`,
      visual: `${locations.threshold}，清晨，封起文书、新传唤封套、院门晨光、${protagonist}接过文书的背影`,
      camera: '金句后切到新传唤封套，定格案号',
      chars: [protagonist, witness],
    },
  ];
}

function buildAiComicSecondRefusalEpisodeSceneDrafts(input: {
  episode: AiComicEpisodePlan;
  blueprint: AiComicEpisodeBlueprint;
  protagonist: string;
  witness: string;
  pressureRole: string;
  locations: ReturnType<typeof inferAiComicEpisodeLocations>;
  visibleNewInfo: string;
  visibleForeshadowing: string;
  visiblePayoff: string;
  visibleMidpoint: string;
  visibleMainConflict: string;
  visibleEndingHook: string;
  previousState: string;
}): AiComicEpisodeSceneDraft[] {
  const {
    protagonist,
    witness,
    pressureRole,
    locations,
    visibleNewInfo,
    visibleForeshadowing,
    visiblePayoff,
    visibleMidpoint,
    visibleMainConflict,
    visibleEndingHook,
    previousState,
  } = input;
  const seniorOfficial = /上官|知府|官|使/.test(pressureRole) && !/差役/.test(pressureRole)
    ? pressureRole
    : '上官';

  return [
    {
      title: '上官召帖',
      duration: 12,
      location: locations.threshold,
      time: '清晨',
      functionLabel: '钩子开场',
      plot: `${previousState}${protagonist}还未合眼，${pressureRole}便送来上官召帖，帖上只写四个字：即刻到堂。未签文书被重新封起，拒签的后果第一次从案桌走到他面前。`,
      keyAction: `${protagonist}收起未签文书，决定先保住暂缓行刑的命令。`,
      conflict: `${visibleMainConflict}；上官召见逼他撤回拒签。`,
      dialogue: `${pressureRole}：“上官问你，一夜够不够想明白？”\n${protagonist}：“想明白了，才不能补这一笔。”`,
      visual: `${locations.threshold}，清晨，召帖、封起的文书、潮湿门廊、差役递帖，${protagonist}手按案卷`,
      camera: '召帖特写切到未签文书，前3秒明确“拒签后的代价”',
      chars: [protagonist, pressureRole],
    },
    {
      title: '暂缓行刑',
      duration: 18,
      location: locations.courtyard,
      time: '清晨',
      functionLabel: '承接结果',
      plot: `${protagonist}先到庭院传下暂缓行刑的口令，让${witness}把囚犯家属和旧案号分开登记。${visiblePayoff}，但每多写一个名字，都像在他官袍上添一道风险。`,
      keyAction: `${protagonist}把上一集的拒签落成正式暂缓命令。`,
      conflict: `救人不能只靠一句不签；${protagonist}必须把口头拒绝变成可追踪的复核。`,
      dialogue: `${witness}：“人暂时保住了，可先生呢？”\n${protagonist}：“人命在前，官位在后。”`,
      visual: `${locations.courtyard}，清晨，暂缓牌、名册、囚犯家属远影、官袍袖口压住文书`,
      camera: '低机位跟随文书递出，停在囚犯家属抬头一瞬',
      chars: [protagonist, witness],
    },
    {
      title: '堂前问责',
      duration: 20,
      location: locations.office,
      time: '上午',
      functionLabel: '冲突爆发',
      plot: `${seniorOfficial}在案前问他为何越过成例，桌上摆着${visibleNewInfo}。${protagonist}没有再争证物真假，只把暂缓、复核、追问经手人的三条写成文书，逼对方也留下态度。`,
      keyAction: `${protagonist}把拒签后的压力转成正式复核流程。`,
      conflict: `${seniorOfficial}要他撤回拒签；${protagonist}要求所有催签者留下签押。`,
      dialogue: `${seniorOfficial}：“你是在护一个死囚，还是在疑本官？”\n${protagonist}：“我疑的是一条命被草草写完。”`,
      visual: `${locations.office}，上午，上官座前、复核文书、签押空格、未签死刑文书并排`,
      camera: `正反打压低${protagonist}视线，切签押空格形成对峙`,
      chars: [protagonist, seniorOfficial, witness],
    },
    {
      title: '旧案号一角',
      duration: 20,
      location: locations.archive,
      time: '午后',
      functionLabel: '反转/觉醒',
      plot: `${visibleMidpoint}。${protagonist}在档房找到被折去一角的旧案号，发现同一个经手人曾在另一卷文书里催过同样的签押；${visibleForeshadowing}，拒签不再只是一案一人的迟疑。`,
      keyAction: `${protagonist}把旧案号、经手人和催签文书连成一条线。`,
      conflict: `继续查下去会得罪更高的人；停在此处就只能救一时。`,
      dialogue: `${witness}：“原来他们急的不是这一卷。”\n${protagonist}：“急着封口的人，最怕文书开口。”`,
      visual: `${locations.archive}，午后，折角旧案号、经手人签押、落灰档册、窗缝斜光`,
      camera: '手指沿旧案号移动，推到被遮住姓名的一角',
      chars: [protagonist, witness],
    },
    {
      title: '递出复核文书',
      duration: 20,
      location: locations.threshold,
      time: '傍晚',
      functionLabel: '高燃收束',
      plot: `${protagonist}把复核文书递出门槛，承认自己可能因此丢官，却不撤回暂缓命令。院外有人低声报来新的处置：明日堂审之前，他必须交出全部案卷；${visibleEndingHook}`,
      keyAction: `${protagonist}公开承担得罪上官的代价，把下一集压力推出。`,
      conflict: `良知已经救下一刻，也把他推向失去官位的危险。`,
      dialogue: `${seniorOfficial}：“你可知这一纸递出去，官帽未必还在？”\n${protagonist}：“官帽可摘，人命不可补。”`,
      visual: `${locations.threshold}，傍晚，门槛、复核文书、夕光、官帽阴影、旧案号露出姓名一角`,
      camera: '文书递出后不跟手，镜头留在门槛内外的分界',
      chars: [protagonist, seniorOfficial, witness],
    },
  ];
}

function naturalizeAiComicContinuityState(raw: string | undefined, protagonist: string): string {
  const text = raw?.trim();
  if (!text || /建立主角初始状态|核心问题|第一条长期线索/.test(text)) {
    return `${protagonist}带着尚未回答的问题走进案房。`;
  }
  const previousHook = text.match(/^承接第\d+集结尾[:：](.+)$/);
  if (previousHook?.[1]) {
    const hook = naturalizeAiComicPlanningSubject(previousHook[1], protagonist).replace(/[。！？!?]+$/, '');
    return `上一集的余波还压在案头：${hook}。`;
  }
  const previousState = text.match(/^延续第\d+集后的状态[:：](.+)$/);
  if (previousState?.[1]) {
    const state = naturalizeAiComicPlanningSubject(previousState[1], protagonist).replace(/[。！？!?]+$/, '');
    return `${state}。`;
  }
  const personalized = naturalizeAiComicPlanningSubject(text, protagonist);
  return personalized.endsWith('。') ? personalized : `${personalized}。`;
}

function naturalizeAiComicHeritageContinuityState(raw: string | undefined, protagonist: string): string {
  const text = raw?.trim();
  if (!text || /建立主角初始状态|核心问题|第一条长期线索/.test(text)) {
    return `${protagonist}带着祖父留下的机关谱走进即将拆除的旧戏台。`;
  }
  const previousHook = text.match(/^承接第\d+集结尾[:：](.+)$/);
  if (previousHook?.[1]) {
    return `上一集的难题还没有落幕：${naturalizeAiComicPlanningSubject(previousHook[1], protagonist).replace(/[。！？!?]+$/, '')}。`;
  }
  const personalized = naturalizeAiComicPlanningSubject(text, protagonist);
  return personalized.endsWith('。') ? personalized : `${personalized}。`;
}

function naturalizeAiComicPlanningSubject(raw: string, protagonist: string): string {
  return raw.trim().replace(/主角/g, protagonist);
}

function chooseAiComicPressureRole(characters: string[], protagonist: string, witness: string): string {
  const explicit = characters.find(name =>
    name !== protagonist
    && name !== witness
    && /差役|官|吏|施压|上司|权/.test(name)
  );
  return naturalizeAiComicCharacterLabel(explicit, '催签差役');
}

function chooseAiComicHeritagePressureRole(characters: string[], protagonist: string, witness: string): string {
  const explicit = characters.find(name =>
    name !== protagonist
    && name !== witness
    && /拆迁|负责人|赞助|经理|对手|馆长/.test(name)
  );
  return naturalizeAiComicCharacterLabel(explicit, '拆迁负责人');
}

function naturalizeAiComicCharacterLabel(name: string | undefined, fallback: string): string {
  const value = name?.trim();
  if (!value || /^(关键见证者|对照角色|配角|反派|主角)$/.test(value)) return fallback;
  return value;
}

function naturalizeAiComicNewInformationForScene(raw: string): string {
  const text = raw.trim()
    .replace(/[。！？!?]+$/, '')
    .replace(/^(?:新增知识焦点|新增素材焦点|新增剧情信息|本集新增信息|新增信息|知识焦点|素材焦点|计划知识焦点|计划素材焦点)[:：]\s*/, '')
    .trim();
  const firstVisible = text.match(/^(.+?)相关的第一条可见线索进入案卷$/);
  if (firstVisible?.[1]) return `与${firstVisible[1].trim()}有关的带泥证物`;
  const testimony = text.match(/^(.+?)相关的新证词让主角重新判断/);
  if (testimony?.[1]) return `与${testimony[1].trim()}有关的新证词`;
  if (/死刑文书里的证词前后不合/.test(text)) return '证词前后不合的死刑文书和封泥';
  if (/上官催签背后还有旧案号/.test(text)) return '旧案号和文书链漏洞';
  const fallbackVisible = text.match(/^第一条可见线索进入案卷[:：](.+)$/);
  if (fallbackVisible?.[1]) return fallbackVisible[1].trim();
  if (/新的证词让主角重新判断/.test(text)) return '新的证词';
  if (!text || /^(周敦颐|主角)$/.test(text)) return '一件能推翻判词的带泥证物';
  if (/^少年$/.test(text)) return '少年带来的带泥证物';
  if (/^(拒签|坚持良知|良知)$/.test(text)) return `围绕“${text}”的新证词`;
  if (/^案卷$/.test(text)) return '案卷边角的带泥证物';
  if (/^[\u4e00-\u9fff]{1,8}$/.test(text)) return `与${text}有关的新证词`;
  return text;
}

function naturalizeAiComicMidpointTurn(raw: string, coreTheme: string, protagonist: string): string {
  const text = raw.trim().replace(/[。！？!?]+$/, '');
  const phaseTurn = text.match(/^阶段转折落地[:：](.+)$/);
  if (phaseTurn?.[1]) return naturalizeAiComicMidpointTurn(phaseTurn[1], coreTheme, protagonist);
  if (/被迫做出第一次选择/.test(text)) {
    return `${protagonist}把朱笔搁下，决定先查证物与旧录，再承担拒签带来的后果`;
  }
  if (/表面目标背后还有更深层原因/.test(text)) {
    return `新证和旧录对上，${protagonist}发现这不是一纸判词的错，而是整条文书链都可能被人动过`;
  }
  if (/不是旁观问题/.test(text)) {
    return `${protagonist}终于明白，“${coreTheme}”不是旁观者能绕开的题`;
  }
  const personalized = text.replace(/主角/g, protagonist);
  return personalized || `新证推翻原先判断，${protagonist}不得不改变行动方向`;
}

function naturalizeAiComicForeshadowing(raw: string): string {
  const text = raw.trim().replace(/[。！？!?]+$/, '');
  if (/未解释细节/.test(text)) return '旧录边角同样残缺的印痕';
  if (/旧案号|遮住|名字|上官|施压/.test(text)) return text;
  if (/案卷|墨痕|封泥|印/.test(text)) return text;
  return '案卷边角的旧墨痕';
}

function naturalizeAiComicPayoff(raw: string): string {
  const text = raw.trim().replace(/[。！？!?]+$/, '');
  const previousUnsigned = text.match(/^回收上集未签文书[:：](.+)$/);
  if (previousUnsigned?.[1]) return previousUnsigned[1].trim();
  const thread = text.match(/(?:打开线索|回收.+?线|开启线索)[:：](.+)$/);
  if (thread?.[1]) return naturalizeAiComicPayoff(thread[1]);
  if (/知识依据|可视化线索|剧情推进|后续承接|长期线索|主线/.test(text)) {
    return '旧录、封泥和被遮住姓名的案号';
  }
  if (/阶段|phase/i.test(text)) return '下一份必须复核的文书';
  return text || '旧录、封泥和被遮住姓名的案号';
}

function inferAiComicEpisodeLocations(plan: AiComicSeriesPlan, episode: AiComicEpisodePlan): {
  office: string;
  threshold: string;
  archive: string;
  courtyard: string;
} {
  const text = [
    plan.premise,
    plan.core_theme,
    episode.title,
    episode.main_conflict,
    ...episode.knowledge_focus,
  ].join(' ');
  if (/南安|军衙|冤案|判词|案卷|拒签/.test(text)) {
    return {
      office: '南安军衙署案房',
      threshold: '南安军衙署门廊',
      archive: '南安军衙署档房',
      courtyard: '南安军衙署庭院',
    };
  }
  if (/濂溪|书院|读书|少年/.test(text)) {
    return {
      office: '濂溪书斋',
      threshold: '濂溪书斋门廊',
      archive: '书斋藏卷处',
      courtyard: '濂溪溪畔庭院',
    };
  }
  return {
    office: '宋代衙署案房',
    threshold: '衙署门廊',
    archive: '衙署档房',
    courtyard: '衙署庭院',
  };
}

function buildAiComicEpisodeAudienceGearsSegments(scenes: StoryScene[], sourceEntry: string): StoryGenerateResult['gears_segments'] {
  const isRuleMystery = scenes.some(scene => /午夜|规则|记忆抹除|灯票|盗谱/.test([
    scene.title,
    scene.plot,
    scene.cultural_note,
  ].join(' ')));
  const isHeritageStageRescue = scenes.some(scene => /皮影|戏台|影偶|灯幕|戏班/.test([
    scene.title,
    scene.location,
    scene.plot,
    scene.visual_prompt,
  ].join(' ')));
  return scenes.map(scene => ({
    segment_id: scene.scene_id,
    source_scene_id: scene.scene_id,
    duration_sec: scene.duration_sec,
    panel_count: 6,
    script_text: [
      `${scene.location}，${scene.time_of_day}。`,
      scene.plot,
      scene.dialogue_or_narration ?? '',
      `[${scene.camera_suggestion}]`,
    ].filter(Boolean).join(''),
    purpose: scene.dramatic_function,
    visual_focus: [
      scene.location,
      ...scene.visual_prompt.split(/[，、。]/).filter(item => item.length > 1 && item.length < 12).slice(0, 2),
    ].slice(0, 3),
    cultural_constraints: isRuleMystery
      ? [
          '当代非遗悬疑语境；皮影、影偶、白幕、灯架、操纵杆与灯票的空间关系必须前后连续。',
          '皮影技艺按可核实事实呈现；午夜规则、记忆抹除和失传灯谱只作为原创机制，不得写成真实传承史。',
        ]
      : isHeritageStageRescue
      ? [
          '当代长沙老街语境；皮影、影偶、白幕、灯架、锣鼓和木构戏台的结构关系必须前后连续。',
          '非遗技艺动作需要从业者复核；不得把原创机关谱、戏班人物和拆迁情节写成真实传承史实。',
        ]
      : [
          '宋代语境，素色交领长衫、圆领袍、布履、束发；不得出现现代器物。',
          '案卷、判词、印章、毛笔只用于衙署案件场景；不要混入月岩悟道等传说场景。',
        ],
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    segment_prompt_hint: `AI漫剧分镜：${scene.camera_suggestion}；主体=${scene.characters.join('、')}；道具和空间关系必须服务本镜头。`,
    source_entries: [sourceEntry],
  }));
}

function buildAiComicEpisodeAudienceCharacters(
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
  protagonist: string,
  scenes: StoryScene[],
): StoryCharacter[] {
  const isRuleMystery = isRuleMysteryPremise(plan.premise);
  const isHeritageStageRescue = isAiComicHeritageStageRescueText(plan.premise);
  const names = unique((isRuleMystery || isHeritageStageRescue
    ? [protagonist, ...scenes.flatMap(scene => scene.characters)]
    : [
        protagonist,
        ...episode.key_characters,
        ...plan.main_characters.map(character => character.name),
      ]
  ).filter(Boolean)).slice(0, 5);
  return names.map((name, index) => {
    const planned = plan.main_characters.find(character => character.name === name);
    if (isHeritageStageRescue) {
      const descriptions: Record<string, string> = {
        [protagonist]: `当代长沙少年，负责修复皮影、灯幕与旧戏台并组织公开演出。`,
        戏班同伴: '当代长沙青年戏班成员，负责操偶、排练与现场协作。',
        拆迁负责人: '当代老街更新项目负责人，掌握清场时限并对演出方案施加现实压力。',
      };
      return {
        name,
        role: index === 0 ? 'protagonist' : name === '拆迁负责人' ? 'antagonist' : 'supporting',
        description: descriptions[name] ?? `${name}参与第${episode.episode_no}集的皮影守艺任务。`,
        arc: name === protagonist
          ? planned?.long_arc ?? '从独自守台到让戏班和下一代共同接续技艺。'
          : `${name}通过协作、质疑或现实压力推动本集守艺选择。`,
      };
    }
    return {
      name,
      role: index === 0 ? 'protagonist' : index === 1 ? 'supporting' : 'antagonist',
      description: planned?.role ?? `${name}在第${episode.episode_no}集推动或见证“${episode.main_conflict}”。`,
      arc: planned?.long_arc ?? `${name}通过本集冲突推进对“${plan.core_theme}”的理解。`,
    };
  });
}

function splitEpisodeDialogue(text: string, fallbackCharacters: string[]): Array<{ character: string; text: string; emotion: string }> {
  const lines = text.split(/\n+/).map(item => item.trim()).filter(Boolean);
  const parsed = lines.map((line, index) => {
    const match = line.match(/^([^：:]{1,12})[：:][“"]?(.+?)[”"]?$/);
    return {
      character: match?.[1]?.trim() || fallbackCharacters[index % Math.max(1, fallbackCharacters.length)] || '旁白',
      text: match?.[2]?.trim() || line,
      emotion: index === 0 ? '紧张' : '克制',
    };
  });
  return parsed.length > 0 ? parsed : [{
    character: fallbackCharacters[0] ?? '旁白',
    text: text || '人物沉默看向案卷，选择的代价已经出现。',
    emotion: '克制',
  }];
}

function buildAiComicEpisodeCredibilityNote(
  story: StoryGenerateResult,
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
): string {
  const primaryEntry = story.knowledge_pack?.primary_entries[0];
  const primary = primaryEntry?.entry_name ?? story.source_entry;
  const sourceBoundary = story.credibility_note.trim()
    || `混合；来源条目：${primary}。`;
  const supports = story.knowledge_pack?.supporting_entries
    .map(entry => entry.entry_name)
    .slice(0, 4)
    .join('、');
  if (isRuleMysteryPremise(plan.premise)) {
    const lockedNames = plan.premise_contract?.locked_characters.map(character => character.name).join('、')
      || plan.main_characters.slice(0, 2).map(character => character.name).join('、');
    const forceNames = plan.premise_contract?.antagonistic_forces.map(force => force.label).join('、') || '对抗力量';
    return [
      `用户原创；来源条目：${primary}；可信度等级：用户提供。`,
      `本集《${episode.title}》是《${plan.series_title}》第${episode.episode_no}集的原创非遗悬疑分集。`,
      `${lockedNames}等人物，午夜皮影规则、记忆抹除、失传灯谱与${forceNames}对抗均属于原创剧情机制。`,
      '皮影制作、影偶、灯幕、操偶和戏班协作细节需要依据可信资料或由非遗从业者复核；原创规则不得冒充真实传承史。',
    ].join('');
  }
  if (story.truth_mode === 'fictional_original' || isAiComicHeritageStageRescueText(plan.premise)) {
    return [
      `用户原创；来源条目：${primary}；可信度等级：用户提供。本项目不主张虚构人物、事件或机关谱属于真实非遗传承史。`,
      `本集《${episode.title}》是《${plan.series_title}》第${episode.episode_no}集的用户原创影视化创作。`,
      `人物、祖父机关谱、拆迁倒计时和戏班关系来自：${primary}。`,
      '皮影制作、影偶修复、灯幕和演出调度需要非遗从业者复核；虚构角色与剧情不得冒充真实传承史。',
    ].filter(Boolean).join('');
  }
  return [
    sourceBoundary,
    `本集《${episode.title}》是《${plan.series_title}》第${episode.episode_no}集的影视化分集创作。`,
    `事实和文化边界主要参考：${primary}。`,
    supports ? `辅助素材用于服饰、器物、地域氛围和创作边界：${supports}。` : '',
    '案情推进、证物、对白和分场节奏为虚构补足，不写成已验证史实。',
  ].filter(Boolean).join('');
}

function buildAiComicEpisodeBlueprint(
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
): AiComicEpisodeBlueprint {
  const previous = plan.episodes.find(item => item.episode_no === episode.episode_no - 1);
  const next = plan.episodes.find(item => item.episode_no === episode.episode_no + 1);
  const openingHook = episode.opening_hook
    ?? (previous
      ? `开场回应上一集结尾“${previous.ending_hook}”，立刻给出新的行动压力。`
      : `开场用主角的日常缺口引出“${plan.core_theme}”的核心问题。`);
  const midpointTurn = episode.midpoint_turn
    ?? `中段让${episode.key_characters[0] ?? '主角'}发现信息并不完整，原计划必须改向。`;
  const endingHookType = episode.ending_hook_type ?? inferEndingHookType(episode, plan.pacing_profile);
  const characterStateChange = episode.character_state_change
    ?? episode.continuity_state_after[0]
    ?? `第${episode.episode_no}集后，主角状态出现可追踪变化。`;
  const threadAction = episode.thread_action
    ?? summarizeEpisodeThreadAction(plan, episode);
  const premiseAnchors = seriesPremiseAnchorLines(plan.premise_contract);

  return {
    schema_version: 'ai-comic-episode-blueprint/v1',
    series_title: plan.series_title,
    episode_no: episode.episode_no,
    title: episode.title,
    opening_hook: openingHook,
    main_conflict: episode.main_conflict,
    midpoint_turn: midpointTurn,
    ending_hook: episode.ending_hook,
    ending_hook_type: endingHookType,
    character_state_change: characterStateChange,
    thread_action: threadAction,
    continuity_from_previous: episode.continuity_from_previous,
    continuity_state_after: episode.continuity_state_after,
    knowledge_focus: episode.knowledge_focus,
    target_scene_functions: [
      `开场钩子：${openingHook}`,
      `冲突升级：${episode.main_conflict}`,
      `中段转折：${midpointTurn}`,
      `状态变化：${characterStateChange}`,
      `线索动作：${threadAction}`,
      next ? `下一集承接：${next.main_conflict}` : '终局余韵：完成主题表达并保留情绪回声',
    ],
    premise_anchor_ids: episode.premise_anchor_ids ?? requiredSeriesPremiseAnchorIds(plan.premise_contract),
    premise_anchors: premiseAnchors,
    commercial_beats: episode.commercial_beats ?? buildAiComicEpisodeCommercialBeats({
      episode,
      outline: plan.premise,
      coreTheme: plan.core_theme,
      premiseContract: plan.premise_contract,
    }),
  };
}

function buildAiComicEpisodeQualityReport(params: {
  story: StoryGenerateResult;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  ledger?: AiComicContinuityLedger;
}): AiComicEpisodeQualityReport {
  const text = episodeQualityText(params.story);
  const checks = {
    responds_to_previous: params.episode.episode_no === 1
      || matchesAny(text, params.episode.continuity_from_previous)
      || Boolean(params.ledger?.episode_records.some(record => text.includes(record.ending_hook.slice(0, 8)))),
    advances_phase_goal: matchesAny(text, [
      params.episode.story_phase,
      params.episode.main_conflict,
      params.episode.midpoint_turn ?? '',
    ]),
    updates_character_state: params.episode.continuity_state_after.length > 0
      && matchesAny(text, [
        ...params.episode.continuity_state_after,
        params.episode.character_state_change ?? '',
      ]),
    handles_threads: (
      params.episode.foreshadowing.length === 0
      && params.episode.payoff.length === 0
      && !params.episode.thread_action
    ) || matchesAny(text, [
      ...params.episode.foreshadowing,
      ...params.episode.payoff,
      params.episode.thread_action ?? '',
    ]),
    leaves_next_hook: text.includes(params.episode.ending_hook.slice(0, 10))
      || Boolean(params.episode.ending_hook_type && text.includes(hookTypeLabel(params.episode.ending_hook_type)))
      || params.story.scene_breakdown.some(scene => (scene.dialogue_or_narration ?? scene.key_action).includes('钩子')),
  };
  const issues: string[] = [];
  if (!checks.responds_to_previous) issues.push('本集没有清楚承接上一集记忆或计划承接点');
  if (!checks.advances_phase_goal) issues.push('本集对阶段目标或主冲突推进不足');
  if (!checks.updates_character_state) issues.push('本集缺少角色状态变化');
  if (!checks.handles_threads) issues.push('本集线索开合不清');
  if (!checks.leaves_next_hook) issues.push('本集结尾缺少下一集承接钩子');

  const passedCount = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passedCount / Object.keys(checks).length) * 100);
  return {
    schema_version: 'ai-comic-episode-quality/v1',
    episode_no: params.episode.episode_no,
    score,
    passed: score >= 80,
    issues,
    checks,
  };
}

function buildAiComicSeriesBibleMarkdown(pkg: AiComicSeriesBibleExportPackage): string {
  const plan = pkg.plan;
  const lines = [
    `# ${plan.series_title} 系列 Bible`,
    '',
    '## 导出信息',
    `- 导出时间: ${pkg.exported_at}`,
    `- 系列项目: ${pkg.project.series_project_id}`,
    `- 总集数: ${plan.episode_count}`,
    `- 单集时长: ${plan.episode_duration_range_sec.min}-${plan.episode_duration_range_sec.max} 秒`,
    `- 节奏: ${PACING_LABELS[plan.pacing_profile]}`,
    `- 已生成分镜: ${pkg.project.generated_episode_count}`,
    '',
    '## 系列总览',
    `- 一句话: ${plan.logline}`,
    `- 核心主题: ${plan.core_theme}`,
    `- 故事梗概: ${plan.premise}`,
    '',
    '## 主线剧情骨架',
    ...(plan.series_spine?.length
      ? plan.series_spine.map(beat =>
          `- 第${beat.episode_range[0]}-${beat.episode_range[1]}集：${beat.story_function}；${beat.central_question}；转折：${beat.required_turn}；目标：${beat.payoff_target}`
        )
      : ['- 未记录']),
    '',
    '## 角色弧线',
    ...plan.main_characters.map(character => [
      `### ${character.name}`,
      `- 定位: ${character.role}`,
      `- 初始状态: ${character.starting_state}`,
      `- 欲望: ${character.desire}`,
      `- 长弧: ${character.long_arc}`,
      `- 视觉识别: ${character.visual_signature}`,
      `- 转折: ${character.turning_points.map(point => `第${point.episode_no}集 ${point.change}`).join('；') || '未记录'}`,
      '',
    ]).flat(),
    '## 长期线索',
    ...plan.plot_threads.map(thread => [
      `### ${thread.title}`,
      `- 开启/回收: 第${thread.setup_episode}集 → 第${thread.payoff_episode}集`,
      `- 描述: ${thread.description}`,
      `- 连续性备注: ${thread.continuity_notes.join('；') || '无'}`,
      '',
    ]).flat(),
    '## 连续性账本',
    `- 最近生成集: ${pkg.continuity_ledger.last_generated_episode_no ? `第${pkg.continuity_ledger.last_generated_episode_no}集` : '尚未生成'}`,
    `- 当前角色状态: ${pkg.continuity_ledger.character_state_current.join('；') || '暂无'}`,
    `- 未回收线索: ${pkg.continuity_ledger.open_threads.join('；') || '暂无'}`,
    `- 已回收线索: ${pkg.continuity_ledger.paid_off_threads.join('；') || '暂无'}`,
    `- 已用素材: ${pkg.continuity_ledger.knowledge_used.join('、') || '暂无'}`,
    '',
    '## 系列记忆引擎',
    `- 结构化记忆: ${pkg.continuity_ledger.series_memory ? '已启用' : '未启用'}`,
    `- 待核冲突: ${pkg.continuity_ledger.series_memory?.conflicts.join('；') || '无'}`,
    '',
    '## 系列视觉圣经与稳定身份图谱',
    `- 稳定身份: ${pkg.visual_bible.identities.length}`,
    `- 定义完整: ${pkg.visual_bible.ready_identity_count}`,
    `- 待补定义: ${pkg.visual_bible.needs_definition_identity_count}`,
    `- 真实生产信用: ${pkg.visual_bible.production_credit_identity_count}`,
    `- 世界规则映射: ${pkg.visual_bible.ready_world_rule_count}/${pkg.visual_bible.world_rules.length}`,
    `- 世界规则审批: ${pkg.visual_bible.approved_world_rule_count}/${pkg.visual_bible.world_rules.length}`,
    `- Pilot 集数: ${pkg.visual_bible.pilot_episode_nos.map(no => `E${no}`).join(' / ')}`,
    `- 时代: ${pkg.visual_bible.world.period}`,
    `- 地域: ${pkg.visual_bible.world.region}`,
    `- 问题: ${pkg.visual_bible.issues.join('；') || '无'}`,
    '',
    '### 稳定视觉身份',
    ...markdownTable(
      ['稳定 ID', '类型', '名称', 'Pilot', '定义状态', '缺失字段', 'Production credit'],
      pkg.visual_bible.identities.map(identity => [
        identity.identity_id,
        identity.kind,
        identity.label,
        identity.pilot_episode_nos.map(no => `E${no}`).join('、') || '非 Pilot',
        identity.definition_status === 'ready' ? '完整' : '待补',
        identity.missing_definition_fields.join('、') || '无',
        identity.production_credit ? '1' : '0',
      ]),
    ),
    '',
    '### 世界规则视觉映射',
    ...markdownTable(
      ['规则 ID', '视觉符号', '触发条件', '代表绑定', '定义状态', '审批状态'],
      pkg.visual_bible.world_rules.map(rule => [
        rule.rule_id,
        rule.visual_symbol ?? '待补',
        rule.trigger_condition ?? '待补',
        rule.pilot_bindings.map(binding => (
          `E${binding.episode_no}:${binding.target_type === 'seedance_shot' ? '镜头' : 'GEARS'} ${binding.target_id}`
        )).join('；') || `待绑定 ${rule.missing_pilot_episode_nos.map(no => `E${no}`).join('、')}`,
        rule.definition_status === 'ready' ? '完整' : '待补',
        rule.approval.status,
      ]),
    ),
    '',
    '### Pilot 绑定',
    ...markdownTable(
      ['集数', '故事快照', '身份覆盖', '世界规则覆盖', '生产信用覆盖', '缺失类型/规则'],
      pkg.visual_bible.pilot_episode_bindings.map(binding => [
        `E${binding.episode_no}`,
        binding.generated_story_id ?? '缺失',
        `${binding.identity_coverage_percent}%`,
        `${binding.world_rule_coverage_percent}%`,
        `${binding.production_credit_coverage_percent}%`,
        [
          binding.missing_identity_kinds.join('、'),
          binding.missing_world_rule_ids.join('、'),
        ].filter(Boolean).join('；') || '无',
      ]),
    ),
    '',
    '## 制作表',
    '',
    '### 角色表',
    ...markdownTable(
      ['角色', '定位', '当前状态', '欲望', '视觉识别', '转折点'],
      pkg.production_tables.characters.map(character => [
        character.name,
        character.role,
        character.current_state || character.starting_state,
        character.desire,
        character.visual_signature,
        character.turning_points.join('；') || '未记录',
      ]),
    ),
    '',
    '### 场景表',
    ...markdownTable(
      ['场景', '出现集数', '戏剧用途', '连续性约束'],
      pkg.production_tables.locations.map(location => [
        location.label,
        location.episode_nos.map(no => `第${no}集`).join('、'),
        location.dramatic_use.join('；') || '未记录',
        location.continuity_constraints.join('；') || '未记录',
      ]),
    ),
    '',
    '### 线索表',
    ...markdownTable(
      ['线索', '开启', '回收', '状态', '关联集数', '处理建议'],
      pkg.production_tables.threads.map(thread => [
        thread.title,
        `第${thread.setup_episode}集`,
        `第${thread.payoff_episode}集`,
        threadClosureStatusLabel(thread.status),
        thread.related_episodes.map(no => `第${no}集`).join('、') || '未记录',
        [...thread.issues, ...thread.repair_suggestions].join('；') || '按计划推进',
      ]),
    ),
    '',
    '### 知识边界表',
    ...markdownTable(
      ['知识点', '使用集数', '用途', '边界'],
      pkg.production_tables.knowledge_boundaries.map(item => [
        item.label,
        item.episode_nos.map(no => `第${no}集`).join('、'),
        item.usage,
        item.boundary_note,
      ]),
    ),
    '',
    '### 系列记忆表',
    ...markdownTable(
      ['类型', '记忆项', '当前状态', '关联集数', '连续性备注'],
      pkg.production_tables.series_memory.map(item => [
        memoryCategoryLabel(item.category),
        item.label,
        item.status,
        item.episode_nos.map(no => `第${no}集`).join('、') || '全系列',
        item.continuity_notes.join('；') || '未记录',
      ]),
    ),
    '',
    '### 情景记忆表',
    ...markdownTable(
      ['来源', '集数', '标题', '人物', '地点', '情绪/运镜', '关键词'],
      pkg.production_tables.episodic_memory.map(item => [
        episodicMemorySourceLabel(item.source),
        `第${item.episode_no}集`,
        item.title,
        item.characters.join('、') || '未记录',
        item.location ?? '未记录',
        item.emotional_tone ?? '未记录',
        item.keywords.slice(0, 8).join('、') || '未记录',
      ]),
    ),
    '',
    '### 制作约束表',
    ...markdownTable(
      ['类型', '约束', '来源', '级别', '状态', '集数/镜头', '说明'],
      pkg.production_tables.production_constraints.map(item => [
        productionConstraintCategoryLabel(item.category),
        item.label,
        productionConstraintSourceLabel(item.source),
        productionConstraintSeverityLabel(item.severity),
        productionConstraintStatusLabel(item.status),
        [
          item.episode_no ? `第${item.episode_no}集` : '',
          item.shot_id ? `镜头${item.shot_id}` : '',
        ].filter(Boolean).join(' / ') || '全系列',
        [item.description, ...item.notes].join('；'),
      ]),
    ),
    '',
    '### 流派机制表',
    ...markdownTable(
      ['机制', '核心承诺', '质量信号'],
      pkg.production_tables.narrative_patterns.map(pattern => [
        pattern.label,
        pattern.core_promise,
        pattern.required_signals.join('；') || '未记录',
      ]),
    ),
    '',
    '### 分集状态表',
    ...markdownTable(
      ['集数', '标题', '状态', '故事 ID', '质量', '注意事项'],
      pkg.production_tables.episode_status.map(episode => [
        `第${episode.episode_no}集`,
        episode.title,
        episode.status === 'generated' ? '已生成' : '规划中',
        episode.story_id ?? '尚未生成',
        episode.quality_status ? episodeQualityStatusLabel(episode.quality_status) : '未评估',
        [
          episode.needs_episode_regeneration ? '需重生成本集' : '',
          episode.needs_ledger_rebuild ? '需重建账本' : '',
          ...episode.attention_reasons,
        ].filter(Boolean).join('；') || '无',
      ]),
    ),
    '',
    '## 系列质量审计',
    ...(pkg.series_quality_audit ? [
      `- 状态: ${pkg.series_quality_audit.passed ? '通过' : '需处理'}`,
      `- 分数: ${pkg.series_quality_audit.score}/100`,
      `- 待处理集数: ${pkg.series_quality_audit.episodes_need_attention.join('、') || '无'}`,
      `- 问题: ${pkg.series_quality_audit.issues.join('；') || '无'}`,
      pkg.series_quality_audit.thread_closure_report
        ? `- 线索闭环: 已回收 ${pkg.series_quality_audit.thread_closure_report.paid_off_thread_count}/${pkg.series_quality_audit.thread_closure_report.total_thread_count}；超期 ${pkg.series_quality_audit.thread_closure_report.overdue_thread_count}；未绑定 ${pkg.series_quality_audit.thread_closure_report.orphaned_thread_count}；重复 ${pkg.series_quality_audit.thread_closure_report.duplicate_thread_count}`
        : '- 线索闭环: 未记录',
      pkg.series_quality_audit.memory_conflict_report
        ? `- 记忆冲突: 总计 ${pkg.series_quality_audit.memory_conflict_report.total_conflict_count}；阻断 ${pkg.series_quality_audit.memory_conflict_report.blocking_count}；警告 ${pkg.series_quality_audit.memory_conflict_report.warning_count}；观察 ${pkg.series_quality_audit.memory_conflict_report.watch_count}`
        : '- 记忆冲突: 未记录',
      ...(pkg.series_quality_audit.thread_closure_report?.items
        .filter(item => item.issues.length > 0 || item.status !== 'paid_off')
        .slice(0, 5)
        .map(item => `  - ${item.title}: ${item.issues[0] ?? item.repair_suggestions[0] ?? '按计划推进'}`) ?? []),
      ...(pkg.series_quality_audit.memory_conflict_report?.items
        .slice(0, 5)
        .map(item => `  - ${item.title}: ${item.repair_suggestions[0] ?? item.description}`) ?? []),
    ] : ['- 未记录']),
    '',
    '## 分集蓝图',
    ...pkg.episode_blueprints.map(blueprint => {
      const episode = plan.episodes.find(item => item.episode_no === blueprint.episode_no);
      const storyId = pkg.generated_episode_story_ids[String(blueprint.episode_no)];
      return [
        `### 第${blueprint.episode_no}集：${blueprint.title}`,
        `- 生成故事: ${storyId || '尚未生成'}`,
        `- 阶段: ${episode?.story_phase ?? '未记录'}`,
        `- 开场钩子: ${blueprint.opening_hook}`,
        `- 主冲突: ${blueprint.main_conflict}`,
        `- 中段转折: ${blueprint.midpoint_turn}`,
        `- 结尾钩子: ${blueprint.ending_hook}`,
        `- 结尾类型: ${hookTypeLabel(blueprint.ending_hook_type)}`,
        `- 角色变化: ${blueprint.character_state_change}`,
        `- 线索动作: ${blueprint.thread_action}`,
        `- 素材焦点: ${blueprint.knowledge_focus.join('、') || '无'}`,
        `- 目标场景功能: ${blueprint.target_scene_functions.join('；')}`,
        '',
      ];
    }).flat(),
    '## 生产备注',
    ...plan.production_notes.map(note => `- ${note}`),
    '',
  ];
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceMarkdown(
  pkg: Omit<AiComicSeriesSeedanceExportPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — 系列 Seedance 2.0 镜头提示词包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> 已生成分集: ${pkg.generated_episode_count}/${pkg.total_episode_count}`,
    `> 总镜头: ${pkg.total_shot_count}`,
    `> 估算总时长: ${pkg.total_duration_sec} 秒`,
    '',
    '## 系列参考素材分配',
    ...(pkg.asset_reference_plan.length
      ? pkg.asset_reference_plan.map(item => `- ${item}`)
      : ['- 未配置参考素材；可直接使用文本提示生成。']),
    '',
    '## 分集镜头提示词',
  ];

  for (const episode of pkg.episodes) {
    lines.push(
      '',
      `### 第${episode.episode_no}集：${episode.episode_title}`,
      '',
      `- storyId: ${episode.story_id}`,
      `- 镜头数: ${episode.shot_count}`,
      `- 估算时长: ${episode.total_duration_sec} 秒`,
    );
    for (const unit of episode.package.shot_units) {
      lines.push(
        '',
        `#### 第${episode.episode_no}集 / ${unit.shot_id} / 场景 ${unit.source_scene_id}`,
        '',
        `- 时长: ${unit.duration_sec} 秒`,
        `- 人物: ${unit.characters.join('、') || '未指定'}`,
        `- 场景: ${unit.location}`,
        `- 镜头: ${unit.camera_suggestion}`,
        unit.continuity_notes.length ? `- 连续性: ${unit.continuity_notes.join('；')}` : '- 连续性: 无',
        unit.negative_constraints.length ? `- 禁止: ${unit.negative_constraints.join('；')}` : '- 禁止: 无',
        '',
        '```text',
        unit.seedance_prompt,
        '```',
      );
    }
  }

  if (pkg.missing_episodes.length > 0) {
    lines.push(
      '',
      '## 未导出分集',
      ...pkg.missing_episodes.map(item => `- 第${item.episode_no}集《${item.title}》：${item.reason}`),
    );
  }
  if (pkg.validation_notes.length > 0) {
    lines.push(
      '',
      '## 校验提醒',
      ...pkg.validation_notes.map(note => `- ${note}`),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceCutMarkdown(
  pkg: Omit<AiComicSeriesSeedanceCutPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — Seedance 剪辑交付包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> 可剪辑镜头: ${pkg.total_ready_shot_count}`,
    `> 待补镜头: ${pkg.total_missing_shot_count}`,
    '',
    '## 剪辑镜头清单',
  ];
  for (const episode of pkg.episodes) {
    lines.push(
      '',
      `### 第${episode.episode_no}集：${episode.episode_title}`,
      '',
      `- storyId: ${episode.story_id ?? '未记录'}`,
      `- 可用镜头: ${episode.ready_shot_count}`,
      '',
      ...markdownTable(
        ['顺序', '镜头', '场景', '视频 URL', 'Job', '版本', '质量分', '评审', '完成时间'],
        episode.shots.map(shot => [
          String(shot.order_index),
          shot.shot_id,
          shot.source_scene_id ? `场景 ${shot.source_scene_id}` : '未记录',
          shot.video_url,
          shot.provider_job_id ?? '未记录',
          shot.version_id ?? '未记录',
          typeof shot.quality_score === 'number' ? String(shot.quality_score) : '未记录',
          shot.review_note ?? '未记录',
          shot.completed_at ?? '未记录',
        ]),
      ),
    );
  }
  if (pkg.missing_shots.length > 0) {
    lines.push(
      '',
      '## 待补镜头',
      ...markdownTable(
        ['集数', '镜头', '状态', '原因'],
        pkg.missing_shots.map(item => [
          `第${item.episode_no}集`,
          item.shot_id,
          seedanceProductionStatusText(item.status),
          item.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceRetryMarkdown(
  pkg: Omit<AiComicSeriesSeedanceRetryPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — Seedance 重试提交包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> 待重试镜头: ${pkg.total_retry_shot_count}`,
    `> 审片要求重做: ${pkg.review_required_shot_count}`,
    `> 已跳过可用镜头: ${pkg.skipped_ready_shot_count}`,
    '',
    '## 重试镜头',
  ];
  for (const episode of pkg.episodes) {
    lines.push(
      '',
      `### 第${episode.episode_no}集：${episode.episode_title}`,
      '',
      `- storyId: ${episode.story_id ?? '未记录'}`,
      `- 待重试镜头: ${episode.retry_shot_count}`,
    );
    for (const shot of episode.shots) {
      lines.push(
        '',
        `#### ${shot.shot_id} / 场景 ${shot.source_scene_id ?? '未记录'}`,
        '',
        `- 状态: ${seedanceProductionStatusText(shot.status)}`,
        `- 重试原因: ${shot.retry_reason === 'review_required' ? '审片返修' : '生产状态'}`,
        `- 失败原因: ${shot.failure_reason ?? '未记录'}`,
        `- 重试次数: ${shot.retry_count}`,
        `- 上次 job: ${shot.provider_job_id ?? '未记录'}`,
        `- 建议动作: ${shot.suggested_action}`,
        ...(shot.review_issues?.length
          ? [
              `- 审片意见: ${shot.review_issues
                .map(issue => `${seedanceReviewSeverityText(issue.severity)} / ${seedanceReviewIssueTypeText(issue.issue_type)} / ${seedanceReviewRepairActionText(issue.repair_action)}：${issue.note}`)
                .join('；')}`,
            ]
          : []),
        `- 人物: ${shot.prompt.characters.join('、') || '未指定'}`,
        `- 场景: ${shot.prompt.location}`,
        `- 镜头: ${shot.prompt.camera_suggestion}`,
        shot.prompt.negative_constraints.length ? `- 禁止: ${shot.prompt.negative_constraints.join('；')}` : '- 禁止: 无',
        '',
        '```text',
        shot.prompt.seedance_prompt,
        '```',
      );
    }
  }
  if (pkg.missing_prompt_shots.length > 0) {
    lines.push(
      '',
      '## 缺失提示词镜头',
      ...markdownTable(
        ['集数', '镜头', '原因'],
        pkg.missing_prompt_shots.map(item => [
          `第${item.episode_no}集：${item.episode_title}`,
          item.shot_id,
          item.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceRetryExecutionMarkdown(
  plan: Omit<AiComicSeriesSeedanceRetryExecutionPlan, 'markdown'>,
): string {
  const lines = [
    `# ${plan.series_title} — Seedance 重试执行计划`,
    '',
    `> schema: ${plan.schema_version}`,
    `> seriesProjectId: ${plan.project.series_project_id}`,
    `> exportedAt: ${plan.exported_at}`,
    `> retryPackageExportedAt: ${plan.source_retry_package_exported_at}`,
    `> 待处理镜头: ${plan.total_retry_shot_count}`,
    `> 可直接提交: ${plan.ready_to_submit_count}`,
    `> 需人工处理: ${plan.blocked_count}`,
    `> 审片返修: ${plan.review_required_shot_count}`,
    `> 缺提示词: ${plan.missing_prompt_shot_count}`,
    '',
    '## 执行候选',
  ];
  for (const episode of plan.episodes) {
    lines.push(
      '',
      `### 第${episode.episode_no}集：${episode.episode_title}`,
      '',
      `- storyId: ${episode.story_id ?? '未记录'}`,
      `- 候选镜头: ${episode.candidate_count}`,
      `- 可直接提交: ${episode.ready_to_submit_count}`,
      `- 需人工处理: ${episode.blocked_count}`,
    );
    lines.push(
      ...markdownTable(
        ['镜头', '优先级', '状态', '原因', '可提交', '建议动作'],
        episode.candidates.map(candidate => [
          candidate.shot_id,
          candidate.priority,
          seedanceProductionStatusText(candidate.status),
          candidate.retry_reason === 'review_required' ? '审片返修' : '生产状态',
          candidate.can_submit ? '是' : `否：${candidate.block_reason ?? '需人工复核'}`,
          candidate.suggested_action,
        ]),
      ),
    );
  }
  if (plan.missing_prompt_shots.length > 0) {
    lines.push(
      '',
      '## 缺失提示词镜头',
      ...markdownTable(
        ['集数', '镜头', '原因'],
        plan.missing_prompt_shots.map(item => [
          `第${item.episode_no}集：${item.episode_title}`,
          item.shot_id,
          item.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceRetrySubmitMarkdown(
  result: Omit<AiComicSeriesSeedanceRetrySubmitResult, 'markdown'>,
): string {
  const lines = [
    `# ${result.series_title} — Seedance 重试提交结果`,
    '',
    `> schema: ${result.schema_version}`,
    `> seriesProjectId: ${result.project.series_project_id}`,
    `> submittedAt: ${result.submitted_at}`,
    `> submittedCount: ${result.submitted_count}`,
    `> failedCount: ${result.failed_count ?? 0}`,
    `> skippedBlocked: ${result.skipped_blocked_count}`,
    `> skippedDueToLimit: ${result.skipped_due_to_limit_count}`,
    `> externalAuthorization: ${result.external_call_authorization?.authorization_reference ?? 'none'}`,
  ];
  if (result.provider_adapter) {
    lines.push(
      '',
      '## Provider Adapter',
      ...markdownTable(
        ['模式', '请求数', '接受数', '失败数'],
        [[
          result.provider_adapter.request_mode,
          String(result.provider_adapter.requested_count),
          String(result.provider_adapter.accepted_count),
          String(result.provider_adapter.failed_count),
        ]],
      ),
    );
  }
  lines.push(
    '',
    '## 已提交镜头',
    ...markdownTable(
      ['集数', '镜头', 'job', '状态', '重试次数', '原因'],
      result.submitted_shots.map(shot => [
        `第${shot.episode_no}集`,
        shot.shot_id,
        shot.provider_job_id,
        shot.status ?? 'submitted',
        String(shot.retry_count),
        shot.retry_reason === 'review_required' ? '审片返修' : '生产状态',
      ]),
    ),
  );
  if (result.provider_failures?.length) {
    lines.push(
      '',
      '## Provider 失败项',
      ...markdownTable(
        ['序号', '镜头', '原因'],
        result.provider_failures.map(failure => [
          String(failure.index + 1),
          failure.shot_id ?? '-',
          failure.message,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceProviderRecoveryMarkdown(
  result: Omit<AiComicSeriesSeedanceProviderRecoveryResult, 'markdown'>,
): string {
  return [
    `# ${result.series_title} — Seedance 超时恢复`,
    '',
    `> schema: ${result.schema_version}`,
    `> seriesProjectId: ${result.project.series_project_id}`,
    `> checkedAt: ${result.checked_at}`,
    `> timeoutMinutes: ${result.timeout_minutes}`,
    `> markTimedOutFailed: ${result.mark_timed_out_failed ? 'yes' : 'no'}`,
    `> timedOutCount: ${result.timed_out_count}`,
    `> updatedCount: ${result.updated_count}`,
    '',
    '## 超时镜头',
    ...markdownTable(
      ['集数', '镜头', '状态', '等待分钟', 'job', '重试次数'],
      result.timed_out_shots.map(item => [
        `第${item.episode_no}集`,
        item.shot_id,
        seedanceProductionStatusText(item.status),
        String(item.minutes_waiting),
        item.provider_job_id ?? '未记录',
        String(item.retry_count),
      ]),
    ),
  ].join('\n');
}

function buildAiComicSeriesSeedanceVersionComparisonMarkdown(
  pkg: Omit<AiComicSeriesSeedanceVersionComparisonPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — Seedance 版本对比报告`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> 总镜头: ${pkg.total_shot_count}`,
    `> 有多版本镜头: ${pkg.comparable_shot_count}`,
    `> 已选剪辑版: ${pkg.selected_shot_count}`,
    `> 未选剪辑版: ${pkg.unselected_shot_count}`,
    '',
    '## 总览',
    ...markdownTable(
      ['集数', '镜头', '当前剪辑版', '自动推荐', '可用版本', '失败版本'],
      pkg.shots.map(shot => [
        `第${shot.episode_no}集`,
        shot.shot_id,
        shot.selected_version_id ?? '未选择',
        shot.auto_best_version_id ?? '无可用版本',
        String(shot.ready_version_count),
        String(shot.failed_version_count),
      ]),
    ),
  ];
  for (const shot of pkg.shots) {
    lines.push(
      '',
      `## 第${shot.episode_no}集：${shot.episode_title} / ${shot.shot_id}`,
      '',
      `- productionId: ${shot.production_id}`,
      `- storyId: ${shot.story_id ?? '未记录'}`,
      `- 场景: ${shot.source_scene_id ?? '未记录'}`,
      `- 当前剪辑版: ${shot.selected_version_id ?? '未选择'}`,
      `- 自动推荐: ${shot.auto_best_version_id ?? '无可用版本'}`,
      '',
      ...markdownTable(
        ['排序', '版本', '状态', '质量分', 'Job', '视频 URL', '评审', '说明'],
        shot.versions.map(version => [
          String(version.rank),
          version.version_id,
          seedanceProductionStatusText(version.status),
          typeof version.quality_score === 'number' ? String(version.quality_score) : '未记录',
          version.provider_job_id ?? '未记录',
          version.video_url ?? '未记录',
          version.review_note ?? version.note ?? version.failure_reason ?? '未记录',
          version.decision_reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceAssetReportMarkdown(
  pkg: Omit<AiComicSeriesSeedanceAssetReportPackage, 'markdown'>,
): string {
  const plan = pkg.completion_plan;
  const lines = [
    `# ${pkg.series_title} — Seedance 素材引用完整性报告`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> 素材项: ${pkg.total_asset_count}`,
    `> 缺少引用槽位: ${pkg.missing_reference_slot_count}`,
    `> 需要上传素材: ${pkg.upload_required_count}`,
    `> 镜头绑定: ${pkg.shot_binding_count}`,
    `> 存在缺口镜头: ${pkg.unbound_shot_count}`,
    `> 稳定视觉身份: ${pkg.visual_bible.identities.length}`,
    `> 待补视觉定义: ${pkg.visual_bible.needs_definition_identity_count}`,
    `> 真实生产信用身份: ${pkg.visual_bible.production_credit_identity_count}`,
    '',
    '## 正式生产完成计划',
    '',
    `> 当前状态: ${plan.overall_status}`,
    `> 真实完成边界: ${plan.real_completion_boundary}`,
    '',
    ...markdownTable(
      ['阶段', '状态', '进度', '下一动作', '完成判据'],
      plan.stages.map(stage => [
        stage.label,
        stage.status,
        `${stage.current_count}/${stage.required_count}`,
        stage.next_action,
        stage.completion_rule,
      ]),
    ),
    '',
    '### 逐身份缺口',
    '',
    ...markdownTable(
      ['稳定身份 ID', '类型', '名称', '缺定义字段', '真实文件', '授权', '媒体审核', '当前映射', 'Production credit', '下一动作'],
      plan.identities.map(identity => [
        identity.identity_id,
        seedanceAssetKindText(identity.kind),
        identity.label,
        identity.missing_definition_fields.join('、') || '无',
        identity.immutable_local_file_ready ? '通过' : '缺失',
        identity.rights_authorized ? '通过' : '待补',
        identity.human_media_review_approved ? '通过' : '待审',
        identity.current_identity_mapping_approved ? '通过' : '待审',
        identity.production_credit ? '1' : '0',
        identity.next_action,
      ]),
    ),
    '',
    '## 素材清单',
    ...markdownTable(
      ['稳定身份 ID', '映射审核', '类型', '素材', '文件 / SHA-256', '来源 / 权利 / 真人审核', '引用槽位', '状态', '使用镜头数', '说明'],
      pkg.assets.map(asset => [
        asset.series_identity_id ?? '未映射',
        asset.identity_binding_status ?? '未提交',
        seedanceAssetKindText(asset.kind),
        asset.label,
        asset.content_sha256 ?? asset.file_id ?? asset.file_url ?? '未上传',
        [
          asset.provider ?? '未记录来源',
          asset.rights_status ?? 'pending',
          asset.human_review_status ?? 'pending',
          asset.authorization_reference ?? '未提供授权依据',
          asset.reviewer_id ?? '未记录审核员',
        ].join(' · '),
        asset.reference_slot ?? '缺少',
        seedanceAssetStatusText(asset.status),
        String(asset.required_by_shot_count),
        asset.description ?? '未记录',
      ]),
    ),
    '',
    '## 镜头绑定',
    ...markdownTable(
      ['集数', '镜头', '人物', '场景', '稳定身份', '引用槽位', '缺口'],
      pkg.shots.map(shot => [
        `第${shot.episode_no}集`,
        shot.shot_id,
        shot.characters.join('、') || '未指定',
        shot.location,
        shot.required_series_identity_ids.join('、') || '未映射',
        shot.reference_slots.join('、') || '无',
        shot.missing_reference_asset_ids.length ? shot.missing_reference_asset_ids.join('、') : '无',
      ]),
    ),
  ];
  return lines.join('\n');
}

function buildAiComicSeriesVisualProductionCompletionPlan(input: {
  visualBible: AiComicSeriesVisualBible;
  assetLibrary: AiComicSeedanceAssetLibrary;
  productionLedger?: AiComicSeedanceProductionLedger;
  shots: AiComicSeedanceShotAssetBinding[];
}): AiComicSeriesVisualProductionCompletionPlan {
  const { visualBible } = input;
  const identityTotal = visualBible.identities.length;
  const worldRuleTotal = visualBible.world_rules.length;
  const pilotBindingBlockerCount = visualBible.pilot_episode_bindings.filter(binding => (
    !binding.generated_story_id
    || binding.missing_identity_kinds.length > 0
    || binding.missing_world_rule_ids.length > 0
  )).length + visualBible.world_rules.filter(rule => rule.missing_pilot_episode_nos.length > 0).length;
  const identities = visualBible.identities.map(identity => {
    const asset = input.assetLibrary.items.find(item => (
      item.identity_binding?.series_identity_id === identity.identity_id
    )) ?? input.assetLibrary.items.find(item => (
      seedanceAssetLookupKey(item.kind, item.label) === seedanceAssetLookupKey(identity.kind, identity.label)
    ));
    const immutableLocalFileReady = Boolean(
      asset?.provider === 'local_upload'
      && asset.local_path
      && asset.content_sha256
      && /^[a-f0-9]{64}$/i.test(asset.content_sha256),
    );
    const rightsAuthorized = asset?.rights_status === 'authorized';
    const humanMediaReviewApproved = asset?.human_review_status === 'approved'
      && Boolean(asset.reviewer_id?.trim());
    const currentIdentityMappingApproved = Boolean(
      asset
      && aiComicSeriesAssetIdentityBindingIsCurrent(asset.identity_binding, identity)
      && asset.identity_binding?.status === 'approved'
      && asset.identity_binding.human_confirmed
      && asset.identity_binding.reviewer_id?.trim(),
    );
    const productionCredit = Boolean(asset && aiComicSeriesAssetProductionCreditGranted(asset, identity));
    let nextAction = '该身份已具备 production credit，可进入 Provider 镜头生产。';
    if (identity.definition_status !== 'ready') {
      nextAction = `填写视觉定义：${identity.missing_definition_fields.join('、') || '补齐全部必填字段'}。`;
    } else if (identity.approval.status !== 'approved') {
      nextAction = '由具备审核权限的真人逐项核对当前定义并批准。';
    } else if (!asset || !immutableLocalFileReady) {
      nextAction = '上传该身份的真实本地图片，系统需生成并校验 SHA-256；URL 或 placeholder 不计入。';
    } else if (!rightsAuthorized) {
      nextAction = '登记 authorized 权利状态并填写可追溯的授权依据。';
    } else if (!humanMediaReviewApproved) {
      nextAction = '真人查看当前不可变文件后，使用其 SHA-256 提交媒体审核结论。';
    } else if (!currentIdentityMappingApproved) {
      nextAction = '真人批准该文件与当前视觉定义指纹的精确身份映射。';
    } else if (!productionCredit) {
      nextAction = '重新核对定义批准、文件字节、授权、媒体审核与身份映射是否仍为当前版本。';
    }
    return {
      identity_id: identity.identity_id,
      kind: identity.kind,
      label: identity.label,
      missing_definition_fields: [...identity.missing_definition_fields],
      definition_ready: identity.definition_status === 'ready',
      definition_approved: identity.approval.status === 'approved',
      asset_id: asset?.asset_id,
      immutable_local_file_ready: immutableLocalFileReady,
      rights_authorized: rightsAuthorized,
      human_media_review_approved: humanMediaReviewApproved,
      current_identity_mapping_approved: currentIdentityMappingApproved,
      production_credit: productionCredit,
      next_action: nextAction,
    };
  });
  const immutableLocalFileCount = identities.filter(item => item.immutable_local_file_ready).length;
  const rightsAuthorizedCount = identities.filter(item => item.rights_authorized).length;
  const humanMediaReviewApprovedCount = identities.filter(item => item.human_media_review_approved).length;
  const currentIdentityMappingApprovedCount = identities.filter(item => item.current_identity_mapping_approved).length;
  const productionCreditCount = identities.filter(item => item.production_credit).length;
  const providerRequiredShotIds = new Set(input.shots.map(shot => shot.production_id));
  const providerReadyShotCount = normalizeSeedanceProductionLedger(input.productionLedger).items.filter(item => (
    providerRequiredShotIds.has(item.production_id)
    && item.status === 'ready'
    && Boolean(item.video_url)
    && Boolean(item.provider_job_id)
    && item.external_call_authorization?.authorized === true
  )).length;
  const providerRequiredShotCount = providerRequiredShotIds.size;
  const definitionsComplete = identityTotal > 0
    && visualBible.ready_identity_count === identityTotal
    && visualBible.ready_world_rule_count === worldRuleTotal
    && pilotBindingBlockerCount === 0;
  const approvalsComplete = definitionsComplete
    && visualBible.approved_identity_count === identityTotal
    && visualBible.approved_world_rule_count === worldRuleTotal;
  const realAssetFilesComplete = approvalsComplete
    && identityTotal > 0
    && immutableLocalFileCount === identityTotal;
  const productionCreditComplete = realAssetFilesComplete
    && productionCreditCount === identityTotal;
  const providerComplete = productionCreditComplete
    && providerRequiredShotCount > 0
    && providerReadyShotCount === providerRequiredShotCount;
  const stageDefinitions = [
    {
      key: 'visual_definitions' as const,
      label: '1. 视觉定义与试拍绑定',
      complete: definitionsComplete,
      current_count: visualBible.ready_identity_count + visualBible.ready_world_rule_count,
      required_count: identityTotal + worldRuleTotal,
      next_action: pilotBindingBlockerCount > 0
        ? `补齐身份/规则定义，并解除 ${pilotBindingBlockerCount} 个试拍集绑定缺口。`
        : '补齐每个身份和世界规则的必填视觉字段。',
      completion_rule: '14 个稳定身份和全部世界规则定义完整，且 E1/中段/终局有真实代表镜头或 GEARS 段绑定。',
    },
    {
      key: 'human_approvals' as const,
      label: '2. 真人批准定义与规则',
      complete: approvalsComplete,
      current_count: visualBible.approved_identity_count + visualBible.approved_world_rule_count,
      required_count: identityTotal + worldRuleTotal,
      next_action: '审核员逐项查看当前定义与来源指纹，勾选真人确认并批准；源内容变化后必须重审。',
      completion_rule: '所有身份和世界规则均由具备权限的真人批准，且批准未 stale。',
    },
    {
      key: 'real_asset_files' as const,
      label: '3. 真实资产文件',
      complete: realAssetFilesComplete,
      current_count: immutableLocalFileCount,
      required_count: identityTotal,
      next_action: '为每个稳定身份上传一份真实本地图片，保留原文件并由系统生成 SHA-256。',
      completion_rule: '每个身份都有 provider=local_upload、local_path 和合法 SHA-256；远程 URL、fixture、dry-run、placeholder 不计入。',
    },
    {
      key: 'production_credit' as const,
      label: '4. 授权、媒体审核与 production credit',
      complete: productionCreditComplete,
      current_count: productionCreditCount,
      required_count: identityTotal,
      next_action: `逐文件完成授权、真人媒体审核和当前身份映射；当前授权 ${rightsAuthorizedCount}/${identityTotal}、媒体审核 ${humanMediaReviewApprovedCount}/${identityTotal}、映射 ${currentIdentityMappingApprovedCount}/${identityTotal}。`,
      completion_rule: '真实文件、SHA-256、authorized 授权、真人媒体审核、当前定义批准和当前身份映射同时成立。',
    },
    {
      key: 'provider_shot_films' as const,
      label: '5. Provider 镜头成片',
      complete: providerComplete,
      current_count: providerReadyShotCount,
      required_count: providerRequiredShotCount,
      next_action: productionCreditComplete
        ? '以明确的外部调用授权提交真实 Provider；轮询/回调到 ready，并保留 provider job ID、视频 URL 与实际费用证据。'
        : '先完成 production credit，系统才会开放真实 Provider 提交。',
      completion_rule: '每个所需镜头均保留显式外呼授权、真实 provider job ID，状态 ready 且存在视频 URL；模拟结果不计入正式完成。',
    },
  ];
  let priorComplete = true;
  const stages = stageDefinitions.map(stage => {
    const status = stage.complete ? 'complete' as const : priorComplete ? 'current' as const : 'blocked' as const;
    priorComplete = priorComplete && stage.complete;
    return {
      key: stage.key,
      label: stage.label,
      status,
      current_count: stage.current_count,
      required_count: stage.required_count,
      next_action: stage.next_action,
      completion_rule: stage.completion_rule,
      operator_required: true,
    };
  });
  const overallStatus: AiComicSeriesVisualProductionCompletionPlan['overall_status'] = !definitionsComplete
    ? 'needs_visual_definitions'
    : !approvalsComplete
      ? 'needs_human_approvals'
      : !realAssetFilesComplete
        ? 'needs_real_asset_files'
        : !productionCreditComplete
          ? 'needs_production_credit'
          : providerComplete
            ? 'complete'
            : providerReadyShotCount > 0
              ? 'provider_in_progress'
              : 'ready_for_provider';
  const blockingIssues = [...visualBible.issues];
  if (providerRequiredShotCount === 0) blockingIssues.push('尚无可提交 Provider 的真实镜头单元；先生成并导出正式集镜头。');
  if (providerReadyShotCount < providerRequiredShotCount && providerRequiredShotCount > 0) {
    blockingIssues.push(`Provider 真实成片 ${providerReadyShotCount}/${providerRequiredShotCount}。`);
  }
  return {
    overall_status: overallStatus,
    summary: {
      identity_total: identityTotal,
      identity_definition_ready_count: visualBible.ready_identity_count,
      identity_approved_count: visualBible.approved_identity_count,
      world_rule_total: worldRuleTotal,
      world_rule_definition_ready_count: visualBible.ready_world_rule_count,
      world_rule_approved_count: visualBible.approved_world_rule_count,
      pilot_binding_blocker_count: pilotBindingBlockerCount,
      immutable_local_file_count: immutableLocalFileCount,
      rights_authorized_count: rightsAuthorizedCount,
      human_media_review_approved_count: humanMediaReviewApprovedCount,
      current_identity_mapping_approved_count: currentIdentityMappingApprovedCount,
      production_credit_count: productionCreditCount,
      provider_required_shot_count: providerRequiredShotCount,
      provider_ready_shot_count: providerReadyShotCount,
    },
    stages,
    identities,
    blocking_issues: unique(blockingIssues),
    real_completion_boundary: '只有正式项目中的真人批准、不可变真实文件、可追溯授权、真人媒体审核、当前身份映射和真实 Provider 回执计入；fixture、dry-run、placeholder 与手填模拟结果均不计入。',
  };
}

function buildAiComicSeriesSeedanceEditAssetMarkdown(
  pkg: Omit<AiComicSeriesSeedanceEditAssetPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — Seedance 剪辑台资产包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> 可剪镜头: ${pkg.total_ready_shot_count}`,
    `> 已绑定素材: ${pkg.total_bound_asset_count}`,
    `> 缺失素材: ${pkg.total_missing_asset_count}`,
    `> 有素材缺口镜头: ${pkg.unbound_shot_count}`,
    '',
    '## 剪辑镜头',
  ];
  for (const episode of pkg.episodes) {
    lines.push(
      '',
      `### 第${episode.episode_no}集：${episode.episode_title}`,
      '',
      `- storyId: ${episode.story_id ?? '未记录'}`,
      `- 可剪镜头: ${episode.ready_shot_count}`,
      `- 有素材缺口镜头: ${episode.unbound_shot_count}`,
      '',
      ...markdownTable(
        ['顺序', '镜头', '视频 URL', '版本', '素材槽位', '缺失素材'],
        episode.shots.map(shot => [
          String(shot.order_index),
          shot.shot_id,
          shot.video_url,
          shot.version_id ?? shot.selected_version_id ?? '未记录',
          shot.reference_slots.join('、') || '无',
          shot.missing_asset_ids.join('、') || '无',
        ]),
      ),
    );
  }
  if (pkg.assets.length > 0) {
    lines.push(
      '',
      '## 素材文件',
      ...markdownTable(
        ['类型', '素材', '槽位', '文件', '状态'],
        pkg.assets.map(asset => [
          seedanceAssetKindText(asset.kind),
          asset.label,
          asset.reference_slot ?? '缺少',
          asset.file_url ?? asset.file_id ?? '缺少',
          seedanceAssetStatusText(asset.status),
        ]),
      ),
    );
  }
  if (pkg.missing_shots.length > 0) {
    lines.push(
      '',
      '## 未进入剪辑包镜头',
      ...markdownTable(
        ['集数', '镜头', '状态', '原因'],
        pkg.missing_shots.map(shot => [
          `第${shot.episode_no}集`,
          shot.shot_id,
          seedanceProductionStatusText(shot.status),
          shot.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceThumbnailPlanMarkdown(
  pkg: Omit<AiComicSeriesSeedanceThumbnailPlanPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — Seedance 缩略图抽帧计划`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> thumbnailRoot: ${pkg.thumbnail_root}`,
    `> 待抽帧镜头: ${pkg.total_ready_shot_count}`,
    `> 缺失视频镜头: ${pkg.total_missing_shot_count}`,
    '',
    '## 抽帧清单',
  ];
  for (const episode of pkg.episodes) {
    lines.push(
      '',
      `### 第${episode.episode_no}集：${episode.episode_title}`,
      '',
      `- storyId: ${episode.story_id ?? '未记录'}`,
      `- 待抽帧镜头: ${episode.ready_shot_count}`,
      '',
      ...markdownTable(
        ['顺序', '镜头', '视频 URL', '抽帧秒', '输出文件', 'ffmpeg'],
        episode.shots.map(shot => [
          String(shot.order_index),
          shot.shot_id,
          shot.video_url,
          String(shot.capture_time_sec),
          shot.output_path,
          shot.ffmpeg_command,
        ]),
      ),
    );
  }
  if (pkg.missing_shots.length > 0) {
    lines.push(
      '',
      '## 未进入抽帧计划镜头',
      ...markdownTable(
        ['集数', '镜头', '状态', '原因'],
        pkg.missing_shots.map(shot => [
          `第${shot.episode_no}集`,
          shot.shot_id,
          seedanceProductionStatusText(shot.status),
          shot.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceFinishingPlanMarkdown(
  pkg: Omit<AiComicSeriesSeedanceFinishingPlanPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — Seedance 成片精修计划`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> sourceCut: ${pkg.source_cut_output_path ?? '尚未装配'}`,
    `> sourceCutStatus: ${pkg.source_cut_status ?? '未记录'}`,
    `> 可用镜头: ${pkg.total_ready_shot_count}`,
    `> 缺失镜头: ${pkg.total_missing_shot_count}`,
    `> 估算成片时长: ${pkg.total_duration_sec} 秒`,
    `> 字幕格式: ${pkg.subtitle_format}`,
    `> 推荐输出: ${pkg.recommended_output_profile}`,
    '',
    '## 镜头时间轴',
    ...markdownTable(
      ['入点', '出点', '集数', '镜头', '视频', '缩略图', '字幕', '音频'],
      pkg.shots.map(shot => [
        formatSeconds(shot.start_sec),
        formatSeconds(shot.end_sec),
        `第${shot.episode_no}集`,
        shot.shot_id,
        shot.video_url,
        shot.thumbnail_path ?? '未生成',
        shot.subtitle_cue_ids.join('、') || '无',
        shot.audio_cue_ids.join('、') || '无',
      ]),
    ),
    '',
    '## 片头片尾卡',
    ...markdownTable(
      ['位置', '集数', '时长', '文案', '视觉备注'],
      pkg.title_cards.map(card => [
        seedanceTitleCardPlacementText(card.placement),
        card.episode_no ? `第${card.episode_no}集` : '系列',
        `${card.duration_sec}秒`,
        card.text,
        card.visual_note,
      ]),
    ),
    '',
    '## 字幕 Cue',
    ...markdownTable(
      ['Cue', '时间', '集数', '镜头', '文本', '来源'],
      pkg.subtitle_cues.map(cue => [
        cue.cue_id,
        `${formatSeconds(cue.start_sec)}-${formatSeconds(cue.end_sec)}`,
        `第${cue.episode_no}集`,
        cue.shot_id,
        cue.text,
        seedanceSubtitleSourceText(cue.source),
      ]),
    ),
    '',
    '## 音频 Cue',
    ...markdownTable(
      ['Cue', '时间', '类型', '优先级', '镜头', '说明'],
      pkg.audio_cues.map(cue => [
        cue.cue_id,
        `${formatSeconds(cue.start_sec)}-${formatSeconds(cue.end_sec)}`,
        seedanceAudioKindText(cue.kind),
        seedanceCuePriorityText(cue.priority),
        cue.shot_id ?? '全片',
        cue.text,
      ]),
    ),
    '',
    '## 质检清单',
    ...pkg.quality_checklist.map(item => `- ${item}`),
  ];
  if (pkg.missing_shots.length > 0) {
    lines.push(
      '',
      '## 缺失镜头',
      ...markdownTable(
        ['集数', '镜头', '状态', '原因'],
        pkg.missing_shots.map(shot => [
          `第${shot.episode_no}集`,
          shot.shot_id,
          seedanceProductionStatusText(shot.status),
          shot.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceSubtitleMarkdown(
  pkg: Omit<AiComicSeriesSeedanceSubtitlePackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — Seedance SRT 字幕包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> subtitleRoot: ${pkg.subtitle_root}`,
    `> subtitlePath: ${pkg.srt_path}`,
    `> scope: ${pkg.episode_no ? `第${pkg.episode_no}集` : '全系列'}`,
    `> cueCount: ${pkg.cue_count}`,
    `> duration: ${pkg.total_duration_sec} 秒`,
    '',
    '## 字幕 Cue',
    ...markdownTable(
      ['序号', '时间码', '集数', '镜头', '文本', '来源'],
      pkg.cues.map(cue => [
        String(cue.srt_index),
        `${cue.start_timecode} --> ${cue.end_timecode}`,
        `第${cue.episode_no}集`,
        cue.shot_id,
        cue.text,
        seedanceSubtitleSourceText(cue.source),
      ]),
    ),
    '',
    '## SRT',
    '',
    '```srt',
    pkg.srt_content.trim(),
    '```',
  ];
  if (pkg.missing_shots.length > 0) {
    lines.push(
      '',
      '## 未进入字幕包镜头',
      ...markdownTable(
        ['集数', '镜头', '状态', '原因'],
        pkg.missing_shots.map(shot => [
          `第${shot.episode_no}集`,
          shot.shot_id,
          seedanceProductionStatusText(shot.status),
          shot.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceAudioPlanMarkdown(
  pkg: Omit<AiComicSeriesSeedanceAudioPlanPackage, 'markdown'>,
): string {
  const lines = [
    `# ${pkg.series_title} — Seedance 音频计划`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> sourceCut: ${pkg.source_cut_output_path ?? '尚未装配'}`,
    `> audioRoot: ${pkg.audio_root}`,
    `> cueCount: ${pkg.total_audio_cue_count}`,
    `> boundCueCount: ${pkg.bound_cue_count}`,
    `> missingAudioCount: ${pkg.missing_audio_count}`,
    `> duration: ${pkg.total_duration_sec} 秒`,
    '',
    '## 音频 Cue',
    ...markdownTable(
      ['Cue', '时间', '类型', '优先级', '素材', '状态', '音量', '淡入/淡出', '说明'],
      pkg.audio_cues.map(cue => [
        cue.cue_id,
        `${formatSeconds(cue.start_sec)}-${formatSeconds(cue.end_sec)}`,
        seedanceAudioKindText(cue.kind),
        seedanceCuePriorityText(cue.priority),
        cue.asset_label,
        seedanceAudioAssetStatusText(cue.asset_status),
        `${cue.volume_db}dB`,
        `${cue.fade_in_sec}s/${cue.fade_out_sec}s`,
        cue.generated_prompt,
      ]),
    ),
    '',
    '## 建议素材',
    ...markdownTable(
      ['素材 ID', '类型', '标签', 'Cue 数', '提示'],
      pkg.suggested_assets.map(asset => [
        asset.asset_id,
        seedanceAudioKindText(asset.kind),
        asset.label,
        String(asset.cue_count),
        asset.prompt,
      ]),
    ),
  ];
  if (pkg.missing_audio.length > 0) {
    lines.push(
      '',
      '## 缺失音频',
      ...markdownTable(
        ['Cue', '集数', '镜头', '类型', '素材', '优先级', '原因'],
        pkg.missing_audio.map(item => [
          item.cue_id,
          `第${item.episode_no}集`,
          item.shot_id ?? '全片',
          seedanceAudioKindText(item.kind),
          item.asset_label,
          seedanceCuePriorityText(item.priority),
          item.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceTitleCardPlanMarkdown(
  pkg: Omit<AiComicSeriesSeedanceTitleCardPlanPackage, 'markdown'>,
): string {
  return [
    `# ${pkg.series_title} — Seedance 片头片尾卡计划`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> titleCardRoot: ${pkg.title_card_root}`,
    `> cardCount: ${pkg.total_card_count}`,
    `> duration: ${pkg.total_duration_sec} 秒`,
    '',
    '## 卡片',
    ...markdownTable(
      ['卡片', '位置', '集数', '时长', '文案', '输出', '安全区', '转场', '视觉备注'],
      pkg.cards.map(card => [
        card.card_id,
        seedanceTitleCardPlacementText(card.placement),
        card.episode_no ? `第${card.episode_no}集` : '系列',
        `${card.duration_sec}秒`,
        card.text,
        card.output_path,
        card.safe_area,
        `${card.transition_in}/${card.transition_out}`,
        card.visual_note,
      ]),
    ),
  ].join('\n');
}

function buildAiComicSeriesSeedanceFinalDeliveryMarkdown(
  pkg: Pick<AiComicSeriesSeedanceFinalDeliveryResult, 'series_title' | 'executed_at' | 'output_path' | 'manifest_path' | 'output_profile' | 'dependency_status' | 'ffmpeg_command'> & {
    project: AiComicSeriesProjectMeta;
    schema_version: string;
  },
): string {
  return [
    `# ${pkg.series_title} — Seedance 最终交付计划`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> executedAt: ${pkg.executed_at}`,
    `> output: ${pkg.output_path}`,
    `> manifest: ${pkg.manifest_path}`,
    `> profile: ${pkg.output_profile}`,
    '',
    '## 依赖状态',
    ...markdownTable(
      ['依赖', '状态', '路径'],
      [
        ['剪辑成片', pkg.dependency_status.cut_ready ? '可用' : '缺失', pkg.dependency_status.source_cut_path ?? '未记录'],
        ['字幕', pkg.dependency_status.subtitle_ready ? '可用' : '缺失/跳过', pkg.dependency_status.subtitle_path ?? '未记录'],
        ['混音', pkg.dependency_status.audio_mix_ready ? '可用' : '缺失/跳过', pkg.dependency_status.audio_mix_path ?? '未记录'],
        ['片头片尾', pkg.dependency_status.title_cards_ready ? '可用' : '缺失/跳过', pkg.dependency_status.title_card_paths.join('、') || '未记录'],
      ],
    ),
    '',
    '## 缺失与警告',
    ...(pkg.dependency_status.missing_dependencies.length > 0
      ? pkg.dependency_status.missing_dependencies.map(item => `- ${item}`)
      : ['- 无阻断依赖']),
    ...(pkg.dependency_status.warnings.length > 0
      ? ['', ...pkg.dependency_status.warnings.map(item => `- ${item}`)]
      : []),
    '',
    '## ffmpeg',
    '',
    '```bash',
    pkg.ffmpeg_command,
    '```',
  ].join('\n');
}

function buildAiComicSeriesSeedanceEditingPlatformMarkdown(
  pkg: Omit<AiComicSeriesSeedanceEditingPlatformPackage, 'markdown'>,
): string {
  const visibleAssets = pkg.assets.slice(0, 40);
  const lines = [
    `# ${pkg.series_title} — Seedance 外部剪辑平台交付包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> formats: ${pkg.formats.join(', ')}`,
    `> sourceCut: ${pkg.source_cut_output_path ?? '尚未装配'}`,
    `> finalDelivery: ${pkg.final_delivery_output_path ?? '尚未装配'}`,
    `> timelineDuration: ${pkg.timeline_total_duration_sec} 秒`,
    '',
    '## 导入备注',
    ...pkg.import_notes.map(note => `- ${note}`),
    '',
    '## 时间线',
    ...markdownTable(
      ['入点', '出点', '轨道', '类型', '集数', '标签', '来源'],
      pkg.timeline.map(item => [
        formatSeconds(item.start_sec),
        formatSeconds(item.end_sec),
        item.track,
        item.item_type === 'title_card' ? '片头片尾' : '镜头',
        item.episode_no ? `第${item.episode_no}集` : '系列',
        item.label,
        item.source_path,
      ]),
    ),
    '',
    '## 素材清单',
    ...markdownTable(
      ['素材', '类型', '状态', '集数', '镜头', '路径/URL', '备注'],
      visibleAssets.map(asset => [
        asset.label,
        seedanceEditingAssetTypeText(asset.asset_type),
        seedanceEditingAssetStatusText(asset.status),
        asset.episode_no ? `第${asset.episode_no}集` : '全片',
        asset.shot_id ?? '无',
        asset.path_or_url ?? '未绑定',
        asset.notes.join('；') || '无',
      ]),
    ),
  ];
  if (pkg.assets.length > visibleAssets.length) {
    lines.push('', `> 其余 ${pkg.assets.length - visibleAssets.length} 项请查看 asset_manifest_csv 或 JSON。`);
  }
  if (pkg.missing_assets.length > 0) {
    lines.push(
      '',
      '## 缺失素材',
      ...markdownTable(
        ['素材', '类型', '集数', '镜头', '来源', '原因'],
        pkg.missing_assets.map(asset => [
          asset.label,
          seedanceEditingAssetTypeText(asset.asset_type),
          asset.episode_no ? `第${asset.episode_no}集` : '全片',
          asset.shot_id ?? '无',
          asset.source,
          asset.reason,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

function buildAiComicSeriesSeedanceDashboardMarkdown(
  dashboard: Omit<AiComicSeriesSeedanceDashboard, 'markdown'>,
): string {
  return [
    `# ${dashboard.series_title} — Seedance 生产总览`,
    '',
    `> schema: ${dashboard.schema_version}`,
    `> seriesProjectId: ${dashboard.project.series_project_id}`,
    `> generatedAt: ${dashboard.generated_at}`,
    `> episodes: ${dashboard.summary.generated_episode_count}/${dashboard.summary.total_episode_count}`,
    `> shots: ${dashboard.summary.total_shot_count}`,
    `> ready: ${dashboard.summary.ready_count}`,
    `> failed: ${dashboard.summary.failed_count}`,
    `> blockers: ${dashboard.summary.blocker_count}`,
    '',
    '## 状态',
    ...markdownTable(
      ['环节', '状态', '数量/路径', '备注'],
      dashboard.status_items.map(item => [
        item.label,
        item.status_text,
        item.output_path ?? item.count_text ?? '未记录',
        item.notes.join('；') || '无',
      ]),
    ),
    '',
    '## 阻断项',
    ...markdownTable(
      ['级别', '问题', '详情', '动作'],
      dashboard.blockers.map(blocker => [
        seedanceDashboardSeverityText(blocker.severity),
        blocker.label,
        blocker.detail,
        blocker.action_label ?? '人工判断',
      ]),
    ),
    '',
    '## 下一步动作',
    ...markdownTable(
      ['优先级', '动作', '说明'],
      dashboard.next_actions.map(action => [
        String(action.priority),
        action.label,
        action.disabled_reason ? `${action.detail}；${action.disabled_reason}` : action.detail,
      ]),
    ),
    '',
    '## 分集',
    ...markdownTable(
      ['集数', '标题', '镜头', 'Ready', '失败', '已选版本', '缩略图', '阻断'],
      dashboard.episodes.map(episode => [
        `第${episode.episode_no}集`,
        episode.episode_title,
        String(episode.total_shot_count),
        String(episode.ready_shot_count),
        String(episode.failed_shot_count),
        String(episode.selected_version_count),
        String(episode.thumbnail_ready_count),
        String(episode.blocker_count),
      ]),
    ),
  ].join('\n');
}

function markdownTable(headers: string[], rows: string[][]): string[] {
  if (rows.length === 0) return ['- 未记录'];
  const cleanCell = (value: string): string => value.replace(/\|/g, '｜').replace(/\n/g, ' ').trim() || '未记录';
  return [
    `| ${headers.map(cleanCell).join(' |')} |`,
    `| ${headers.map(() => '---').join(' |')} |`,
    ...rows.map(row => `| ${row.map(cleanCell).join(' |')} |`),
  ];
}

function normalizeErrorCode(code?: string): ErrorCode {
  const values = Object.values(ErrorCodes) as ErrorCode[];
  return code && values.includes(code as ErrorCode) ? code as ErrorCode : ErrorCodes.INTERNAL_ERROR;
}

async function buildSeedancePromptLookup(
  detail: AiComicSeriesProjectDetail,
): Promise<Map<string, SeedancePromptShotUnit>> {
  const lookup = new Map<string, SeedancePromptShotUnit>();
  for (const episode of detail.plan.episodes) {
    const storyId = detail.generated_episode_story_ids[String(episode.episode_no)];
    if (!storyId) continue;
    const storyResult = await getStory(storyId);
    if (!storyResult.ok || !storyResult.data) continue;
    const seedancePackage = buildSeedancePromptPackage(storyResult.data);
    for (const unit of seedancePackage.shot_units) {
      lookup.set(seedanceProductionId(episode.episode_no, unit.shot_id), unit);
    }
  }
  return lookup;
}

function seedanceFinishingSubtitleText(
  scriptText: string | undefined,
  shot: { episode_no: number; episode_title: string; shot_id: string },
): string {
  const cleaned = scriptText
    ? summarizeText(scriptText.replace(/\s+/g, ' '), 54)
    : '';
  return cleaned || `第${shot.episode_no}集《${shot.episode_title}》${shot.shot_id} 字幕待校。`;
}

function seedanceFinishingAudioText(
  seedancePrompt: string | undefined,
  cameraSuggestion: string | undefined,
  shot: { episode_no: number; shot_id: string },
): string {
  const source = seedancePrompt || cameraSuggestion || '';
  const soundHints = source
    .split(/[。；;\n]/)
    .map(item => item.trim())
    .filter(item => /音|声|乐|风|雨|脚步|鼓|铃|呼吸|环境/.test(item))
    .slice(0, 2);
  if (soundHints.length > 0) return soundHints.join('；');
  return `第${shot.episode_no}集 ${shot.shot_id}：补环境底噪和动作音效，避免盖过字幕节奏。`;
}

function seedanceAudioKindForPrompt(seedancePrompt: string | undefined): AiComicSeedanceFinishingAudioCue['kind'] {
  if (!seedancePrompt) return 'ambient';
  if (/音乐|配乐|旋律|鼓点/.test(seedancePrompt)) return 'music';
  if (/旁白|解说/.test(seedancePrompt)) return 'narration';
  if (/对白|台词|说/.test(seedancePrompt)) return 'dialogue';
  if (/音效|脚步|碰撞|风声|雨声|铃声/.test(seedancePrompt)) return 'sound_effect';
  return 'ambient';
}

function buildSeedanceFinishingTitleCards(
  detail: AiComicSeriesProjectDetail,
  exportedEpisodeNos: number[],
): AiComicSeriesSeedanceFinishingPlanPackage['title_cards'] {
  const episodeMap = new Map(detail.plan.episodes.map(episode => [episode.episode_no, episode]));
  const cards: AiComicSeriesSeedanceFinishingPlanPackage['title_cards'] = [{
    card_id: 'card-series-opening',
    placement: 'series_opening',
    duration_sec: 3,
    text: detail.plan.series_title,
    visual_note: `保留系列主视觉，呼应主题：${summarizeText(detail.plan.core_theme, 42)}`,
  }];
  for (const episodeNo of exportedEpisodeNos) {
    const episode = episodeMap.get(episodeNo);
    if (!episode) continue;
    cards.push({
      card_id: `card-e${episodeNo}-opening`,
      placement: 'episode_opening',
      episode_no: episodeNo,
      duration_sec: 2,
      text: `第${episodeNo}集 ${episode.title}`,
      visual_note: `承接开场钩子：${summarizeText(episode.opening_hook ?? episode.main_conflict, 42)}`,
    });
    cards.push({
      card_id: `card-e${episodeNo}-ending`,
      placement: 'episode_ending',
      episode_no: episodeNo,
      duration_sec: 2,
      text: summarizeText(episode.ending_hook, 48),
      visual_note: '用定格或淡出保留下一集钩子，不额外剧透未生成情节。',
    });
  }
  cards.push({
    card_id: 'card-series-ending',
    placement: 'series_ending',
    duration_sec: 3,
    text: '未完待续',
    visual_note: '收束到系列核心意象，留出字幕和平台尾标安全区。',
  });
  return cards;
}

function buildSeedanceFinishingQualityChecklist(missingShotCount: number): string[] {
  return [
    missingShotCount > 0
      ? `仍有 ${missingShotCount} 个镜头缺失，正式成片前需要补齐或明确跳过。`
      : '所有进入剪辑包的镜头均有 ready 视频 URL。',
    '字幕 cue 需要人工校对口语、专名和文化名词，避免把视觉动作误当对白。',
    '配乐底需要在对白、旁白、关键音效处自动降低音量。',
    '片头片尾卡需保留平台安全区，标题不遮挡人物面部和关键道具。',
    '导出前检查缩略图、选中版本、质量分和评审备注是否与剪辑版一致。',
  ];
}

function formatSeconds(value: number): string {
  const safeValue = Math.max(0, Math.round(value));
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function threadClosureStatusLabel(status: AiComicThreadClosureItem['status']): string {
  const map: Record<AiComicThreadClosureItem['status'], string> = {
    planned: '已规划',
    opened: '已开启',
    in_progress: '推进中',
    paid_off: '已回收',
    overdue: '超期',
    orphaned: '未绑定',
    duplicate: '重复',
  };
  return map[status];
}

function episodeQualityStatusLabel(status: AiComicSeriesQualityEpisodeReport['status']): string {
  const map: Record<AiComicSeriesQualityEpisodeReport['status'], string> = {
    passed: '通过',
    needs_attention: '需关注',
    not_generated: '未生成',
    unknown: '未知',
  };
  return map[status];
}

function memoryCategoryLabel(category: AiComicSeriesMemoryCategory): string {
  const map: Record<AiComicSeriesMemoryCategory, string> = {
    character: '角色',
    relationship: '关系',
    prop: '道具',
    location: '地点',
    visual_asset: '视觉资产',
    knowledge_boundary: '知识边界',
    story_event: '关键事件',
  };
  return map[category];
}

function productionConstraintCategoryLabel(category: AiComicProductionConstraintCategory): string {
  const map: Record<AiComicProductionConstraintCategory, string> = {
    continuity: '连续性',
    negative: '禁用元素',
    camera: '运镜',
    asset: '资产',
    cultural_boundary: '文化边界',
  };
  return map[category];
}

function productionConstraintSourceLabel(source: AiComicProductionConstraintItem['source']): string {
  const map: Record<AiComicProductionConstraintItem['source'], string> = {
    series_plan: '系列规划',
    gears_segment: 'GEARS分段',
    seedance_shot: 'Seedance镜头',
    manual: '人工',
  };
  return map[source];
}

function productionConstraintSeverityLabel(severity: AiComicProductionConstraintItem['severity']): string {
  const map: Record<AiComicProductionConstraintItem['severity'], string> = {
    must: '必须',
    should: '建议',
    watch: '观察',
  };
  return map[severity];
}

function productionConstraintStatusLabel(status: AiComicProductionConstraintItem['status']): string {
  const map: Record<AiComicProductionConstraintItem['status'], string> = {
    active: '生效',
    resolved: '已解决',
    needs_review: '待复核',
  };
  return map[status];
}

function memoryConflictCategoryLabel(category: AiComicMemoryConflictCategory): string {
  const map: Record<AiComicMemoryConflictCategory, string> = {
    character_state: '角色状态',
    location_state: '地点状态',
    relationship_state: '关系状态',
    knowledge_boundary: '知识边界',
    production_constraint: '制作约束',
  };
  return map[category];
}

function memoryConflictSeverityLabel(severity: AiComicMemoryConflictItem['severity']): string {
  const map: Record<AiComicMemoryConflictItem['severity'], string> = {
    blocking: '阻断',
    warning: '警告',
    watch: '观察',
  };
  return map[severity];
}

function seedanceProductionStatusText(status: AiComicSeedanceProductionStatusUpdateRequest['status']): string {
  const map: Record<AiComicSeedanceProductionStatusUpdateRequest['status'], string> = {
    not_started: '未开始',
    prompt_exported: '已导出提示词',
    submitted: '已提交',
    processing: '处理中',
    ready: '已完成',
    failed: '失败',
    skipped: '跳过',
  };
  return map[status];
}

function seedanceTitleCardPlacementText(
  placement: AiComicSeriesSeedanceFinishingPlanPackage['title_cards'][number]['placement'],
): string {
  const map: Record<AiComicSeriesSeedanceFinishingPlanPackage['title_cards'][number]['placement'], string> = {
    series_opening: '系列片头',
    episode_opening: '分集片头',
    episode_ending: '分集片尾',
    series_ending: '系列片尾',
  };
  return map[placement];
}

function seedanceSubtitleSourceText(source: AiComicSeedanceFinishingSubtitleCue['source']): string {
  const map: Record<AiComicSeedanceFinishingSubtitleCue['source'], string> = {
    script_text: '脚本文本',
    continuity: '连续性账本',
    manual_placeholder: '人工占位',
  };
  return map[source];
}

function seedanceAudioKindText(kind: AiComicSeedanceFinishingAudioCue['kind']): string {
  const map: Record<AiComicSeedanceFinishingAudioCue['kind'], string> = {
    dialogue: '对白',
    narration: '旁白',
    music: '音乐',
    sound_effect: '音效',
    ambient: '环境声',
  };
  return map[kind];
}

function seedanceAudioAssetStatusText(status: AiComicSeedanceAudioPlanCue['asset_status']): string {
  const map: Record<AiComicSeedanceAudioPlanCue['asset_status'], string> = {
    bound: '已绑定',
    missing_asset: '缺素材',
    optional_missing: '可选缺失',
  };
  return map[status];
}

function seedanceCuePriorityText(priority: AiComicSeedanceFinishingAudioCue['priority']): string {
  const map: Record<AiComicSeedanceFinishingAudioCue['priority'], string> = {
    must: '必须',
    should: '建议',
    optional: '可选',
  };
  return map[priority];
}

function buildAiComicSeriesBibleProductionTables(input: {
  plan: AiComicSeriesPlan;
  generatedEpisodeStoryIds: Record<string, string>;
  ledger: AiComicContinuityLedger;
  seriesQualityAudit?: AiComicSeriesQualityAudit;
}): AiComicSeriesBibleProductionTables {
  const episodeReports = new Map(
    (input.seriesQualityAudit?.episode_reports ?? []).map(report => [report.episode_no, report]),
  );
  const threadItems = new Map(
    (input.seriesQualityAudit?.thread_closure_report?.items ?? []).map(item => [item.thread_id, item]),
  );
  const lastGeneratedEpisodeNo = input.ledger.last_generated_episode_no ?? 0;

  const characters = input.plan.main_characters.map(character => {
    const currentState = input.ledger.character_state_current.find(state => state.includes(character.name))
      ?? character.turning_points
        .filter(point => point.episode_no <= lastGeneratedEpisodeNo)
        .sort((a, b) => b.episode_no - a.episode_no)[0]?.change
      ?? character.starting_state;
    return {
      name: character.name,
      role: character.role,
      starting_state: character.starting_state,
      current_state: currentState,
      desire: character.desire,
      long_arc: character.long_arc,
      visual_signature: character.visual_signature,
      turning_points: character.turning_points.map(point => `第${point.episode_no}集：${point.change}`),
    };
  });

  const locations = input.plan.episodes.map(episode => ({
    location_id: `episode-${episode.episode_no}-production-space`,
    label: episode.knowledge_focus[0] ?? episode.story_phase,
    episode_nos: [episode.episode_no],
    dramatic_use: [
      episode.opening_hook ?? '承接上一集',
      episode.main_conflict,
      episode.midpoint_turn ?? episode.ending_hook,
    ].filter(Boolean),
    continuity_constraints: [
      ...episode.continuity_from_previous,
      ...episode.continuity_state_after,
    ],
  }));

  const threads = input.plan.plot_threads.map(thread => {
    const item = threadItems.get(thread.thread_id);
    return {
      thread_id: thread.thread_id,
      title: thread.title,
      setup_episode: item?.setup_episode ?? thread.setup_episode,
      payoff_episode: item?.payoff_episode ?? thread.payoff_episode,
      status: item?.status ?? 'planned',
      related_episodes: item?.related_episodes.length
        ? item.related_episodes
        : [thread.setup_episode, thread.payoff_episode],
      issues: item?.issues ?? [],
      repair_suggestions: item?.repair_suggestions ?? [],
    };
  });

  const knowledgeMap = new Map<string, Set<number>>();
  for (const episode of input.plan.episodes) {
    for (const label of episode.knowledge_focus) {
      const normalized = label.trim();
      if (!normalized) continue;
      if (!knowledgeMap.has(normalized)) knowledgeMap.set(normalized, new Set());
      knowledgeMap.get(normalized)?.add(episode.episode_no);
    }
  }
  for (const label of input.ledger.knowledge_used) {
    const normalized = label.trim();
    if (!normalized) continue;
    if (!knowledgeMap.has(normalized)) knowledgeMap.set(normalized, new Set());
  }
  const knowledgeBoundaries = [...knowledgeMap.entries()].map(([label, episodeNos]) => ({
    label,
    episode_nos: [...episodeNos].sort((a, b) => a - b),
    usage: episodeNos.size > 0 ? '分集素材焦点' : '连续性账本已用素材',
    boundary_note: '仅作为文化、人物、地点或事件边界使用；未核实内容不得写成确证史实。',
  }));

  const narrativePatterns = getNarrativePatternsForVideoType('ai_comic_drama', input.plan.narrative_pattern_ids ?? [])
    .map(pattern => ({
      pattern_id: pattern.pattern_id,
      label: pattern.label,
      core_promise: pattern.narrative_engine,
      required_signals: pattern.quality_signals,
    }));

  const episodeStatus = input.plan.episodes.map(episode => {
    const storyId = input.generatedEpisodeStoryIds[String(episode.episode_no)];
    const report = episodeReports.get(episode.episode_no);
    return {
      episode_no: episode.episode_no,
      title: episode.title,
      status: storyId ? 'generated' as const : 'planned' as const,
      story_id: storyId,
      quality_status: report?.status,
      needs_episode_regeneration: report?.needs_episode_regeneration,
      needs_ledger_rebuild: report?.needs_ledger_rebuild,
      attention_reasons: report?.issues ?? [],
    };
  });

  return {
    characters,
    locations,
    threads,
    knowledge_boundaries: knowledgeBoundaries,
    series_memory: buildAiComicSeriesMemoryRows(input.ledger.series_memory),
    production_constraints: buildAiComicProductionConstraintRows(input.ledger.production_constraints),
    episodic_memory: buildAiComicSeriesEpisodicMemoryRows(input.ledger.episodic_memory),
    narrative_patterns: narrativePatterns,
    episode_status: episodeStatus,
  };
}

function buildAiComicSeriesMemoryRows(memory?: AiComicSeriesMemory): AiComicSeriesBibleMemoryRow[] {
  if (!memory) return [];
  return [
    ...memory.characters,
    ...memory.relationships,
    ...memory.props,
    ...memory.locations,
    ...memory.visual_assets,
    ...memory.knowledge_boundaries,
    ...memory.story_events.slice(-20),
  ].map(item => ({
    category: item.category,
    label: item.label,
    status: item.status,
    episode_nos: item.related_episode_nos,
    continuity_notes: item.continuity_notes,
  }));
}

function buildAiComicProductionConstraintRows(
  constraints?: AiComicProductionConstraints,
): AiComicSeriesBibleProductionTables['production_constraints'] {
  if (!constraints) return [];
  return constraints.items
    .filter(item => item.status !== 'resolved')
    .slice(-80)
    .map(item => ({
      category: item.category,
      label: item.label,
      description: item.description,
      source: item.source,
      severity: item.severity,
      status: item.status,
      episode_no: item.episode_no,
      shot_id: item.shot_id,
      notes: [...item.notes],
    }));
}

function buildAiComicSeriesEpisodicMemoryRows(
  index?: AiComicEpisodicMemoryIndex,
): AiComicSeriesBibleProductionTables['episodic_memory'] {
  if (!index) return [];
  return index.items.slice(-80).map(item => ({
    source: item.source,
    episode_no: item.episode_no,
    title: item.title,
    text: item.text,
    characters: [...item.characters],
    location: item.location,
    emotional_tone: item.emotional_tone,
    keywords: [...item.keywords],
  }));
}

function buildAiComicContinuityAudit(params: {
  story: StoryGenerateResult;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  ledger?: AiComicContinuityLedger;
  episodeQuality: AiComicEpisodeQualityReport;
}): AiComicSeriesContinuityAudit {
  const projectedLedger = updateContinuityLedger({
    ledger: params.ledger ?? buildInitialContinuityLedger(params.plan),
    plan: params.plan,
    episode: params.episode,
    story: params.story,
  });
  const issues = params.episodeQuality.issues.filter(issue =>
    issue.includes('承接') || issue.includes('角色状态') || issue.includes('线索'),
  );
  return {
    schema_version: 'ai-comic-continuity-audit/v1',
    checked_episode_no: params.episode.episode_no,
    passed: issues.length === 0,
    issues,
    open_threads_after: projectedLedger.open_threads,
    character_state_after: projectedLedger.character_state_current,
  };
}

function episodeQualityText(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.original_user_query ?? '',
    story.full_text,
    ...story.scene_breakdown.flatMap(scene => [
      scene.title,
      scene.dramatic_function,
      scene.plot,
      scene.key_action,
      scene.dialogue_or_narration ?? '',
    ]),
  ].join('\n');
}

function matchesAny(text: string, needles: string[]): boolean {
  return needles
    .filter(needle => needle.trim().length > 0)
    .some(needle => {
      const normalized = needle.trim();
      return text.includes(normalized) || text.includes(normalized.slice(0, Math.min(10, normalized.length)));
    });
}

export async function saveAiComicSeriesProject(
  request: AiComicSeriesProjectSaveRequest,
  options: { access_control?: ProductResourceOwnership } = {},
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const now = new Date().toISOString();
  const seriesProjectId = request.series_project_id ?? generateSeriesProjectId();
  const existing = request.series_project_id ? await readSeriesProject(seriesProjectId) : null;
  const normalizedPlan = normalizeAiComicSeriesPlan(request.plan);
  const generatedEpisodeStoryIds = {
    ...(existing?.generated_episode_story_ids ?? {}),
    ...(request.generated_episode_story_ids ?? {}),
  };
  const continuityLedger = normalizeContinuityLedger(
    request.continuity_ledger ?? existing?.continuity_ledger,
    normalizedPlan,
  );
  const memoryRecallPreferences = normalizeMemoryRecallPreferences(
    request.memory_recall_preferences ?? existing?.memory_recall_preferences,
    now,
  );

  const detail: AiComicSeriesProjectDetail = {
    project: buildSeriesProjectMeta({
      seriesProjectId,
      plan: normalizedPlan,
      createdAt: existing?.project.created_at ?? now,
      updatedAt: now,
      generatedEpisodeStoryIds,
      archivedAt: existing?.project.archived_at,
      accessControl: existing?.project.access_control ?? options.access_control,
    }),
    plan: normalizedPlan,
    generated_episode_story_ids: generatedEpisodeStoryIds,
    continuity_ledger: continuityLedger,
    memory_recall_preferences: memoryRecallPreferences,
    seedance_production: normalizeSeedanceProductionLedger(existing?.seedance_production),
    seedance_asset_library: cloneSeedanceAssetLibrary(existing?.seedance_asset_library),
    seedance_cut_assembly: cloneSeedanceCutAssemblyLedger(existing?.seedance_cut_assembly),
    seedance_subtitle_render: cloneSeedanceSubtitleRenderLedger(existing?.seedance_subtitle_render),
    seedance_audio_library: cloneSeedanceAudioLibrary(existing?.seedance_audio_library),
    seedance_audio_mix: cloneSeedanceAudioMixLedger(existing?.seedance_audio_mix),
    seedance_title_card_render: cloneSeedanceTitleCardRenderLedger(existing?.seedance_title_card_render),
    seedance_final_delivery: cloneSeedanceFinalDeliveryLedger(existing?.seedance_final_delivery),
    seedance_review_ledger: cloneSeedanceReviewLedger(existing?.seedance_review_ledger),
    gears_job_ledger: normalizeGearsJobLedger(existing?.gears_job_ledger),
  };
  detail.series_quality_audit = buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds,
    ledger: continuityLedger,
    previousAudit: existing?.series_quality_audit,
  });
  detail.premise_fidelity_audit = auditAiComicSeriesPremiseFidelity(detail.plan);
  detail.commercial_quality_audit = auditAiComicSeriesCommercialQuality(
    detail.plan,
    existing?.commercial_quality_audit?.human_review,
    detail.generated_episode_story_ids,
  );
  detail.visual_bible = buildAiComicSeriesVisualBible({
    plan: detail.plan,
    ledger: detail.continuity_ledger,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids,
    assetLibrary: detail.seedance_asset_library,
    previousVisualBible: existing?.visual_bible,
    generatedAt: now,
  });

  if (existing) {
    await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  } else if (await seriesProjectRepository().create(detail) === 'exists') {
    throw new SeriesProjectRepositoryConflictError(`Series project "${seriesProjectId}" already exists`);
  }
  return success(detail);
}

export async function getAiComicSeriesProject(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  return success(detail);
}

export async function rebuildAiComicSeriesContinuityLedger(
  seriesProjectId: string,
  request: AiComicSeriesLedgerRebuildRequest = {},
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const fromEpisodeNo = request.from_episode_no ?? 1;
  if (fromEpisodeNo < 1 || fromEpisodeNo > existing.plan.episode_count) {
    return fail(ErrorCodes.VALIDATION_ERROR, `from_episode_no ${fromEpisodeNo} is outside the series episode range`);
  }

  const continuityLedger = rebuildContinuityLedgerFromEpisode({
    plan: existing.plan,
    generatedEpisodeStoryIds: existing.generated_episode_story_ids,
    ledger: existing.continuity_ledger,
    fromEpisodeNo,
  });
  const now = new Date().toISOString();
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: buildSeriesProjectMeta({
      seriesProjectId,
      plan: existing.plan,
      createdAt: existing.project.created_at,
      updatedAt: now,
      generatedEpisodeStoryIds: existing.generated_episode_story_ids,
      archivedAt: existing.project.archived_at,
      accessControl: existing.project.access_control,
    }),
    continuity_ledger: continuityLedger,
  };
  detail.series_quality_audit = buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids,
    ledger: continuityLedger,
    previousAudit: existing.series_quality_audit,
  });
  detail.premise_fidelity_audit = auditAiComicSeriesPremiseFidelity(detail.plan);
  detail.commercial_quality_audit = auditAiComicSeriesCommercialQuality(
    detail.plan,
    existing.commercial_quality_audit?.human_review,
    detail.generated_episode_story_ids,
  );

  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function repairAiComicSeriesCommercialQualityProject(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesCommercialRepairResult>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const repair = repairAiComicSeriesCommercialQuality({
    plan: existing.plan,
    audit: existing.commercial_quality_audit,
  });
  const generatedEpisodesNeedRegeneration = repair.changed_episode_nos.filter(episodeNo => (
    Boolean(existing.generated_episode_story_ids[String(episodeNo)])
  ));
  if (!repair.success) {
    return success({
      schema_version: 'ai-comic-series-commercial-repair-result/v1',
      project: existing.project,
      success: false,
      improved: repair.improved,
      changed_episode_nos: repair.changed_episode_nos,
      changed_fields: repair.changed_fields,
      before_score: repair.before_score,
      after_score: repair.after_score,
      issues: repair.issues.length > 0 ? repair.issues : ['当前没有可安全自动修复的商业质量问题'],
      plan: existing.plan,
      commercial_quality_audit: existing.commercial_quality_audit
        ?? auditAiComicSeriesCommercialQuality(
          existing.plan,
          undefined,
          existing.generated_episode_story_ids,
        ),
      generated_episodes_need_regeneration: [],
    });
  }

  const now = new Date().toISOString();
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: buildSeriesProjectMeta({
      seriesProjectId,
      plan: repair.plan,
      createdAt: existing.project.created_at,
      updatedAt: now,
      generatedEpisodeStoryIds: existing.generated_episode_story_ids,
      archivedAt: existing.project.archived_at,
      accessControl: existing.project.access_control,
    }),
    plan: repair.plan,
    commercial_quality_audit: auditAiComicSeriesCommercialQuality(
      repair.plan,
      repair.audit.human_review,
      existing.generated_episode_story_ids,
    ),
  };
  detail.premise_fidelity_audit = auditAiComicSeriesPremiseFidelity(detail.plan);
  detail.series_quality_audit = buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids,
    ledger: detail.continuity_ledger,
    previousAudit: existing.series_quality_audit,
  });
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success({
    schema_version: 'ai-comic-series-commercial-repair-result/v1',
    project: detail.project,
    success: true,
    improved: repair.improved,
    changed_episode_nos: repair.changed_episode_nos,
    changed_fields: repair.changed_fields,
    before_score: repair.before_score,
    after_score: repair.after_score,
    issues: generatedEpisodesNeedRegeneration.length > 0
      ? [`第${generatedEpisodesNeedRegeneration.join('、')}集已有分镜，商业节拍修复后需要重新生成`]
      : [],
    plan: detail.plan,
    commercial_quality_audit: detail.commercial_quality_audit!,
    generated_episodes_need_regeneration: generatedEpisodesNeedRegeneration,
  });
}

export async function submitAiComicSeriesCommercialHumanReview(
  seriesProjectId: string,
  request: AiComicSeriesHumanReviewSubmitRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const blindReviewPackage = await buildAiComicSeriesCommercialBlindReviewPackage(existing);
  if (!blindReviewPackage.ok || !blindReviewPackage.data) {
    return fail(
      normalizeErrorCode(blindReviewPackage.error?.code),
      blindReviewPackage.error?.message ?? '真人盲评包尚未就绪',
      blindReviewPackage.error?.details,
    );
  }
  if (
    request.candidate_label !== blindReviewPackage.data.candidate_label
    || request.reviewer_packet_sha256 !== blindReviewPackage.data.reviewer_packet_sha256
  ) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      '真人盲评分数与当前匿名评审包不匹配；请重新导出评审包并核对候选编号和 SHA256',
      {
        expected_candidate_label: blindReviewPackage.data.candidate_label,
        expected_reviewer_packet_sha256: blindReviewPackage.data.reviewer_packet_sha256,
      },
    );
  }

  const currentAudit = auditAiComicSeriesCommercialQuality(
    existing.plan,
    existing.commercial_quality_audit?.human_review,
    existing.generated_episode_story_ids,
  );
  const reviewedAt = new Date().toISOString();
  const reviewerId = request.reviewer_id.trim();
  const retainedScores = currentAudit.human_review.status === 'stale'
    ? []
    : currentAudit.human_review.scores.filter(score => score.reviewer_id !== reviewerId);
  const reviewerScores = request.scores.map(score => ({
    ...score,
    reviewer_id: reviewerId,
    blind: true as const,
    reviewed_at: reviewedAt,
  }));
  const humanReview = {
    ...buildAiComicSeriesHumanReview([
      ...retainedScores,
      ...reviewerScores,
    ]),
    content_fingerprint: currentAudit.review_content_fingerprint,
    reviewed_episode_story_ids: {
      ...blindReviewPackage.data.operator_manifest.reviewed_episode_story_ids,
    },
    candidate_label: blindReviewPackage.data.candidate_label,
    reviewer_packet_sha256: blindReviewPackage.data.reviewer_packet_sha256,
  };
  const commercialQualityAudit = auditAiComicSeriesCommercialQuality(
    existing.plan,
    humanReview,
    existing.generated_episode_story_ids,
  );
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: buildSeriesProjectMeta({
      seriesProjectId,
      plan: existing.plan,
      createdAt: existing.project.created_at,
      updatedAt: reviewedAt,
      generatedEpisodeStoryIds: existing.generated_episode_story_ids,
      archivedAt: existing.project.archived_at,
      accessControl: existing.project.access_control,
    }),
    commercial_quality_audit: commercialQualityAudit,
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function exportAiComicSeriesCommercialBlindReviewPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesBlindReviewPackage>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  return buildAiComicSeriesCommercialBlindReviewPackage(existing);
}

async function buildAiComicSeriesCommercialBlindReviewPackage(
  existing: AiComicSeriesProjectDetail,
): Promise<ApiResponse<AiComicSeriesBlindReviewPackage>> {
  const currentAudit = auditAiComicSeriesCommercialQuality(
    existing.plan,
    existing.commercial_quality_audit?.human_review,
    existing.generated_episode_story_ids,
  );
  if (!currentAudit.machine_gate_passed) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      '商业文本机器门禁尚未通过，不能导出真人盲评包',
      currentAudit.issues,
    );
  }
  const premiseFidelityAudit = auditAiComicSeriesPremiseFidelity(existing.plan);
  if (!premiseFidelityAudit.hard_gate_passed) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      '设定忠实度硬门禁尚未通过，不能导出真人盲评包',
      premiseFidelityAudit.issues,
    );
  }
  if (currentAudit.missing_human_review_episode_nos.length > 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `真人盲评材料未就绪：请先生成第${currentAudit.missing_human_review_episode_nos.join('、')}集完整分镜`,
      { missing_episode_nos: currentAudit.missing_human_review_episode_nos },
    );
  }

  const episodeStories: Array<{ episode_no: number; story: StoryGenerateResult }> = [];
  const unreadableEpisodeNos: number[] = [];
  for (const episodeNo of currentAudit.required_human_review_episode_nos) {
    const storyId = existing.generated_episode_story_ids[String(episodeNo)];
    const story = storyId ? await getStory(storyId) : null;
    if (
      !story?.ok
      || !story.data
      || story.data.ai_comic_episode_blueprint?.episode_no !== episodeNo
      || !story.data.full_text.trim()
      || story.data.scene_breakdown.length === 0
    ) {
      unreadableEpisodeNos.push(episodeNo);
      continue;
    }
    episodeStories.push({ episode_no: episodeNo, story: story.data });
  }
  if (unreadableEpisodeNos.length > 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `真人盲评材料不可复核：第${unreadableEpisodeNos.join('、')}集故事文件缺失、为空或与分集不匹配`,
      { unreadable_episode_nos: unreadableEpisodeNos },
    );
  }

  const reviewedEpisodeStoryIds = Object.fromEntries(
    currentAudit.required_human_review_episode_nos.map(episodeNo => [
      String(episodeNo),
      existing.generated_episode_story_ids[String(episodeNo)],
    ]),
  );
  return success(buildAiComicSeriesBlindReviewPackage({
    exportedAt: new Date().toISOString(),
    seriesProjectId: existing.project.series_project_id,
    plan: existing.plan,
    reviewContentFingerprint: currentAudit.review_content_fingerprint,
    reviewedEpisodeStoryIds,
    episodeStories,
  }));
}

export async function listAiComicSeriesProjects(
  options: { includeArchived?: boolean } = {},
): Promise<ApiResponse<AiComicSeriesProjectMeta[]>> {
  const projectIds = await seriesProjectRepository().listProjectIds();
  if (!projectIds.length) {
    return success([]);
  }

  const projects: AiComicSeriesProjectMeta[] = [];
  for (const projectId of projectIds) {
    const detail = await readSeriesProject(projectId);
    if (detail && (options.includeArchived || !detail.project.archived_at)) {
      projects.push(await buildAiComicSeriesProjectListMeta(detail));
    }
  }

  projects.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return success(projects);
}

async function buildAiComicSeriesProjectListMeta(
  detail: AiComicSeriesProjectDetail,
): Promise<AiComicSeriesProjectMeta> {
  const contentIssueMap = await buildAiComicGeneratedEpisodeContentIssueMap(detail);
  const audit = detail.series_quality_audit;
  const regenerationEpisodeNos = unique([
    ...Array.from(contentIssueMap.keys()),
    ...(audit?.episode_reports ?? [])
      .filter(report => report.needs_episode_regeneration === true)
      .map(report => report.episode_no),
  ]).sort((a, b) => a - b);
  const attentionEpisodeNos = unique([
    ...(audit?.episodes_need_attention ?? []),
    ...(detail.commercial_quality_audit?.episodes_need_attention ?? []),
    ...(detail.commercial_quality_audit?.diversity_report.adjacent_pair_reports
      .filter(report => !report.passed)
      .map(report => report.right_episode_no) ?? []),
    ...Array.from(contentIssueMap.keys()),
  ]).sort((a, b) => a - b);

  return {
    ...detail.project,
    quality_attention_episode_count: attentionEpisodeNos.length,
    regeneration_episode_count: regenerationEpisodeNos.length,
    next_attention_episode_no: attentionEpisodeNos[0],
    next_regeneration_episode_no: regenerationEpisodeNos[0],
    generated_episode_content_issue_count: contentIssueMap.size,
  };
}

export async function copyAiComicSeriesProject(
  seriesProjectId: string,
  request: AiComicSeriesProjectCopyRequest = {},
  options: { access_control?: ProductResourceOwnership } = {},
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const now = new Date().toISOString();
  const newSeriesProjectId = generateSeriesProjectId();
  const title = request.title?.trim() || `${existing.plan.series_title} 副本`;
  const plan: AiComicSeriesPlan = {
    ...existing.plan,
    series_title: title,
  };
  const detail: AiComicSeriesProjectDetail = {
    project: buildSeriesProjectMeta({
      seriesProjectId: newSeriesProjectId,
      plan,
      createdAt: now,
      updatedAt: now,
      generatedEpisodeStoryIds: existing.generated_episode_story_ids,
      accessControl: options.access_control ?? existing.project.access_control,
    }),
    plan,
    generated_episode_story_ids: { ...existing.generated_episode_story_ids },
    continuity_ledger: {
      ...existing.continuity_ledger,
      character_state_current: [...existing.continuity_ledger.character_state_current],
      open_threads: [...existing.continuity_ledger.open_threads],
      paid_off_threads: [...existing.continuity_ledger.paid_off_threads],
      knowledge_used: [...existing.continuity_ledger.knowledge_used],
      episode_records: existing.continuity_ledger.episode_records.map(record => ({
        ...record,
        character_state: [...record.character_state],
        opened_threads: [...record.opened_threads],
        paid_off_threads: [...record.paid_off_threads],
        pending_threads_after: [...record.pending_threads_after],
        knowledge_used: [...record.knowledge_used],
        next_episode_memory: [...record.next_episode_memory],
        memory_events: record.memory_events?.map(cloneMemoryItem) ?? [],
      })),
      series_memory: cloneSeriesMemory(existing.continuity_ledger.series_memory ?? buildInitialSeriesMemory(existing.plan)),
      production_constraints: cloneProductionConstraints(
        existing.continuity_ledger.production_constraints ?? buildInitialProductionConstraints(existing.plan),
      ),
      episodic_memory: cloneEpisodicMemoryIndex(
        existing.continuity_ledger.episodic_memory ?? buildInitialEpisodicMemoryIndex(),
      ),
    },
    memory_recall_preferences: cloneMemoryRecallPreferences(existing.memory_recall_preferences),
    series_quality_audit: existing.series_quality_audit,
    premise_fidelity_audit: existing.premise_fidelity_audit,
    commercial_quality_audit: existing.commercial_quality_audit,
    visual_bible: buildAiComicSeriesVisualBible({
      plan,
      ledger: existing.continuity_ledger,
      generatedEpisodeStoryIds: existing.generated_episode_story_ids,
      assetLibrary: existing.seedance_asset_library,
      previousVisualBible: existing.visual_bible,
      generatedAt: now,
    }),
    seedance_production: cloneSeedanceProductionLedger(existing.seedance_production),
    seedance_asset_library: cloneSeedanceAssetLibrary(existing.seedance_asset_library),
    seedance_cut_assembly: cloneSeedanceCutAssemblyLedger(existing.seedance_cut_assembly),
    seedance_subtitle_render: cloneSeedanceSubtitleRenderLedger(existing.seedance_subtitle_render),
    seedance_audio_library: cloneSeedanceAudioLibrary(existing.seedance_audio_library),
    seedance_audio_mix: cloneSeedanceAudioMixLedger(existing.seedance_audio_mix),
    seedance_title_card_render: cloneSeedanceTitleCardRenderLedger(existing.seedance_title_card_render),
    seedance_final_delivery: cloneSeedanceFinalDeliveryLedger(existing.seedance_final_delivery),
    seedance_review_ledger: cloneSeedanceReviewLedger(existing.seedance_review_ledger),
    gears_job_ledger: normalizeGearsJobLedger(existing.gears_job_ledger),
  };
  detail.series_quality_audit = buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids,
    ledger: detail.continuity_ledger,
    previousAudit: detail.series_quality_audit,
  });
  detail.premise_fidelity_audit = auditAiComicSeriesPremiseFidelity(detail.plan);
  detail.commercial_quality_audit = auditAiComicSeriesCommercialQuality(
    detail.plan,
    existing.commercial_quality_audit?.human_review,
    detail.generated_episode_story_ids,
  );

  if (await seriesProjectRepository().create(detail) === 'exists') {
    throw new SeriesProjectRepositoryConflictError(`Series project "${newSeriesProjectId}" already exists`);
  }
  return success(detail);
}

export async function archiveAiComicSeriesProject(
  seriesProjectId: string,
  request: AiComicSeriesProjectArchiveRequest = {},
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const now = new Date().toISOString();
  const archivedAt = request.archived === false ? undefined : now;
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: buildSeriesProjectMeta({
      seriesProjectId,
      plan: existing.plan,
      createdAt: existing.project.created_at,
      updatedAt: now,
      generatedEpisodeStoryIds: existing.generated_episode_story_ids,
      archivedAt,
      accessControl: existing.project.access_control,
    }),
  };

  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function deleteAiComicSeriesProject(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesProjectDeleteResult>> {
  const filePath = seriesProjectPath(seriesProjectId);
  if (!(await pathExists(filePath))) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  await rm(dirname(filePath), { recursive: true, force: true });
  return success({
    series_project_id: seriesProjectId,
    deleted: true,
  });
}

export async function exportAiComicSeriesBible(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesBibleExportPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const exportedAt = new Date().toISOString();
  const seriesQualityAudit = detail.series_quality_audit ?? buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids ?? {},
    ledger: detail.continuity_ledger,
  });
  const episodeBlueprints = detail.plan.episodes.map(episode =>
    buildAiComicEpisodeBlueprint(detail.plan, episode)
  );
  const productionTables = buildAiComicSeriesBibleProductionTables({
    plan: detail.plan,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids ?? {},
    ledger: detail.continuity_ledger,
    seriesQualityAudit,
  });
  const visualBible = buildAiComicSeriesVisualBible({
    plan: detail.plan,
    ledger: detail.continuity_ledger,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids,
    assetLibrary: detail.seedance_asset_library,
    previousVisualBible: detail.visual_bible,
    generatedAt: exportedAt,
  });
  const pkg: AiComicSeriesBibleExportPackage = {
    schema_version: 'ai-comic-series-bible-export/v1',
    exported_at: exportedAt,
    project: detail.project,
    plan: detail.plan,
    generated_episode_story_ids: detail.generated_episode_story_ids,
    continuity_ledger: detail.continuity_ledger,
    series_quality_audit: seriesQualityAudit,
    visual_bible: visualBible,
    episode_blueprints: episodeBlueprints,
    production_tables: productionTables,
    markdown: '',
  };
  return success({
    ...pkg,
    markdown: buildAiComicSeriesBibleMarkdown(pkg),
  });
}

export async function rebuildAiComicSeriesVisualBible(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const updatedAt = nextSeriesProjectUpdatedAt(existing.project.updated_at);
  const visualBible = buildAiComicSeriesVisualBible({
    plan: existing.plan,
    ledger: existing.continuity_ledger,
    generatedEpisodeStoryIds: existing.generated_episode_story_ids,
    assetLibrary: existing.seedance_asset_library,
    previousVisualBible: existing.visual_bible,
    generatedAt: updatedAt,
  });
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: updatedAt,
    },
    visual_bible: visualBible,
    seedance_asset_library: reconcileAiComicSeriesAssetIdentityBindingStaleness(
      existing.seedance_asset_library,
      visualBible,
    ),
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function updateAiComicSeriesVisualIdentityDefinition(
  seriesProjectId: string,
  visualIdentityId: string,
  request: AiComicSeriesVisualIdentityDefinitionUpdateRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const currentVisualBible = existing.visual_bible;
  const currentIdentity = currentVisualBible?.identities.find(identity => identity.identity_id === visualIdentityId);
  if (!currentVisualBible || !currentIdentity) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Visual identity "${visualIdentityId}" is not in the series visual bible`);
  }
  if (request.expected_source_fingerprint !== currentIdentity.source_fingerprint) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      '视觉身份源设定已经变化，请刷新页面后重新核对，旧审批不能继续沿用',
    );
  }
  const allowedFieldIds = new Set(currentIdentity.definition_fields.map(field => field.field_id));
  const unknownFieldIds = Object.keys(request.fields).filter(fieldId => !allowedFieldIds.has(fieldId));
  if (unknownFieldIds.length > 0) {
    return fail(ErrorCodes.VALIDATION_ERROR, `视觉定义包含未知字段：${unknownFieldIds.join('、')}`);
  }
  const definitionFields = currentIdentity.definition_fields.map(field => ({
    ...field,
    value: Object.hasOwn(request.fields, field.field_id)
      ? request.fields[field.field_id].trim()
      : field.value,
  }));
  const missingFields = definitionFields
    .filter(field => field.required && !field.value)
    .map(field => field.label);
  if (request.action === 'approve' && missingFields.length > 0) {
    return fail(ErrorCodes.VALIDATION_ERROR, `视觉定义尚未完整，不能审批：${missingFields.join('、')}`);
  }
  if (request.action !== 'save_draft' && (
    !request.reviewer_id?.trim()
    || request.human_confirmed !== true
    || !request.review_note?.trim()
  )) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      '真人视觉审批必须填写 Reviewer ID、复核说明并确认已逐项复核',
    );
  }

  const updatedAt = nextSeriesProjectUpdatedAt(existing.project.updated_at);
  const approval = request.action === 'save_draft'
    ? {
        status: 'pending' as const,
        human_confirmed: false,
      }
    : {
        status: request.action === 'approve' ? 'approved' as const : 'changes_requested' as const,
        reviewer_id: request.reviewer_id!.trim(),
        reviewed_at: updatedAt,
        review_note: request.review_note!.trim(),
        source_fingerprint: currentIdentity.source_fingerprint,
        human_confirmed: true,
      };
  const previousVisualBible = {
    ...currentVisualBible,
    identities: currentVisualBible.identities.map(identity => identity.identity_id === visualIdentityId
      ? {
          ...identity,
          definition_fields: definitionFields,
          definition_notes: request.definition_notes?.trim() ?? identity.definition_notes,
          approval,
        }
      : identity),
  };
  const visualBible = buildAiComicSeriesVisualBible({
    plan: existing.plan,
    ledger: existing.continuity_ledger,
    generatedEpisodeStoryIds: existing.generated_episode_story_ids,
    assetLibrary: existing.seedance_asset_library,
    previousVisualBible,
    generatedAt: updatedAt,
  });
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: updatedAt,
    },
    visual_bible: visualBible,
    seedance_asset_library: reconcileAiComicSeriesAssetIdentityBindingStaleness(
      existing.seedance_asset_library,
      visualBible,
    ),
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function generateAiComicSeriesVisualIdentitySuggestionDraft(
  seriesProjectId: string,
  visualIdentityId: string,
): Promise<ApiResponse<AiComicSeriesVisualSuggestionDraft>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const identity = existing.visual_bible?.identities.find(item => item.identity_id === visualIdentityId);
  if (!identity) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Visual identity "${visualIdentityId}" is not in the series visual bible`);
  }
  return success(buildAiComicSeriesVisualIdentitySuggestionDraft({ identity }));
}

export async function updateAiComicSeriesVisualWorldRuleDefinition(
  seriesProjectId: string,
  worldRuleId: string,
  request: AiComicSeriesVisualWorldRuleDefinitionUpdateRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const currentVisualBible = existing.visual_bible;
  const currentRule = currentVisualBible?.world_rules.find(rule => rule.rule_id === worldRuleId);
  if (!currentVisualBible || !currentRule) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Visual world rule "${worldRuleId}" is not in the series visual bible`);
  }
  if (request.expected_source_fingerprint !== currentRule.source_fingerprint) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      '世界规则来源或代表内容已经变化，请刷新页面后重新核对，旧审批不能继续沿用',
    );
  }
  const allowedFieldIds = new Set(currentRule.definition_fields.map(field => field.field_id));
  const unknownFieldIds = Object.keys(request.fields).filter(fieldId => !allowedFieldIds.has(fieldId));
  if (unknownFieldIds.length > 0) {
    return fail(ErrorCodes.VALIDATION_ERROR, `世界规则视觉定义包含未知字段：${unknownFieldIds.join('、')}`);
  }
  const duplicateBindingEpisodeNos = request.pilot_bindings
    .map(binding => binding.episode_no)
    .filter((episodeNo, index, values) => values.indexOf(episodeNo) !== index);
  if (duplicateBindingEpisodeNos.length > 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `同一世界规则每个代表集只能绑定一个目标：E${[...new Set(duplicateBindingEpisodeNos)].join('、E')}`,
    );
  }
  const expectedPilotEpisodeNos = currentVisualBible.pilot_episode_nos;
  const invalidBindingEpisodeNos = request.pilot_bindings
    .map(binding => binding.episode_no)
    .filter(episodeNo => !expectedPilotEpisodeNos.includes(episodeNo));
  if (invalidBindingEpisodeNos.length > 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `世界规则只能绑定当前代表集：E${expectedPilotEpisodeNos.join('、E')}`,
    );
  }
  const resolvedBindings = await resolveAiComicSeriesVisualWorldRulePilotBindings(existing, request.pilot_bindings);
  const verifiedBindings = resolvedBindings.data;
  if (!resolvedBindings.ok || !verifiedBindings) {
    return fail(
      normalizeErrorCode(resolvedBindings.error?.code),
      resolvedBindings.error?.message ?? '世界规则视觉绑定验证失败',
    );
  }
  const definitionFields = currentRule.definition_fields.map(field => ({
    ...field,
    value: Object.hasOwn(request.fields, field.field_id)
      ? request.fields[field.field_id].trim()
      : field.value,
  }));
  const missingFields = definitionFields
    .filter(field => field.required && !field.value)
    .map(field => field.label);
  const missingBindingEpisodeNos = expectedPilotEpisodeNos.filter(episodeNo => (
    !verifiedBindings.some(binding => binding.episode_no === episodeNo)
  ));
  if (request.action === 'approve' && (missingFields.length > 0 || missingBindingEpisodeNos.length > 0)) {
    const missing = [
      ...missingFields,
      ...missingBindingEpisodeNos.map(episodeNo => `E${episodeNo} 代表镜头或 GEARS 段绑定`),
    ];
    return fail(ErrorCodes.VALIDATION_ERROR, `世界规则视觉映射尚未完整，不能审批：${missing.join('、')}`);
  }
  if (request.action !== 'save_draft' && (
    !request.reviewer_id?.trim()
    || request.human_confirmed !== true
    || !request.review_note?.trim()
  )) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      '真人世界规则审批必须填写 Reviewer ID、复核说明并确认已逐项复核',
    );
  }

  const updatedAt = nextSeriesProjectUpdatedAt(existing.project.updated_at);
  const approval = request.action === 'save_draft'
    ? {
        status: 'pending' as const,
        human_confirmed: false,
      }
    : {
        status: request.action === 'approve' ? 'approved' as const : 'changes_requested' as const,
        reviewer_id: request.reviewer_id!.trim(),
        reviewed_at: updatedAt,
        review_note: request.review_note!.trim(),
        source_fingerprint: currentRule.source_fingerprint,
        human_confirmed: true,
      };
  const previousVisualBible = {
    ...currentVisualBible,
    world_rules: currentVisualBible.world_rules.map(rule => rule.rule_id === worldRuleId
      ? {
          ...rule,
          definition_fields: definitionFields,
          definition_notes: request.definition_notes?.trim() ?? rule.definition_notes,
          pilot_bindings: verifiedBindings,
          approval,
        }
      : rule),
  };
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: updatedAt,
    },
    visual_bible: buildAiComicSeriesVisualBible({
      plan: existing.plan,
      ledger: existing.continuity_ledger,
      generatedEpisodeStoryIds: existing.generated_episode_story_ids,
      assetLibrary: existing.seedance_asset_library,
      previousVisualBible,
      generatedAt: updatedAt,
    }),
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function generateAiComicSeriesVisualWorldRuleSuggestionDraft(
  seriesProjectId: string,
  worldRuleId: string,
): Promise<ApiResponse<AiComicSeriesVisualSuggestionDraft>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const rule = existing.visual_bible?.world_rules.find(item => item.rule_id === worldRuleId);
  if (!rule) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Visual world rule "${worldRuleId}" is not in the series visual bible`);
  }
  return success(buildAiComicSeriesVisualWorldRuleSuggestionDraft({ rule }));
}

async function resolveAiComicSeriesVisualWorldRulePilotBindings(
  detail: AiComicSeriesProjectDetail,
  requestedBindings: AiComicSeriesVisualWorldRuleDefinitionUpdateRequest['pilot_bindings'],
): Promise<ApiResponse<Array<
  AiComicSeriesVisualWorldRuleDefinitionUpdateRequest['pilot_bindings'][number] & { story_id: string }
>>> {
  const resolved: Array<
    AiComicSeriesVisualWorldRuleDefinitionUpdateRequest['pilot_bindings'][number] & { story_id: string }
  > = [];
  for (const binding of requestedBindings) {
    const storyId = detail.generated_episode_story_ids[String(binding.episode_no)];
    if (!storyId) {
      return fail(ErrorCodes.VALIDATION_ERROR, `E${binding.episode_no} 尚无故事快照，不能作为世界规则视觉绑定`);
    }
    const storyResult = await getStory(storyId);
    if (!storyResult.ok || !storyResult.data) {
      return fail(ErrorCodes.VALIDATION_ERROR, `E${binding.episode_no} 的故事快照不可读取，不能验证世界规则视觉绑定`);
    }
    const targetId = binding.target_id.trim();
    const targetExists = binding.target_type === 'seedance_shot'
      ? buildSeedancePromptPackage(storyResult.data).shot_units.some(unit => unit.shot_id === targetId)
      : storyResult.data.gears_segments.some(segment => String(segment.segment_id) === targetId);
    if (!targetExists) {
      const targetLabel = binding.target_type === 'seedance_shot' ? 'Seedance 镜头' : 'GEARS 段';
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `E${binding.episode_no} 不存在 ${targetLabel}“${targetId}”，不能把未验证目标写入世界规则视觉映射`,
      );
    }
    resolved.push({
      episode_no: binding.episode_no,
      target_type: binding.target_type,
      target_id: targetId,
      story_id: storyId,
    });
  }
  return success(resolved);
}

export async function exportAiComicSeriesSeedancePrompts(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceExportPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const generatedEpisodeStoryIds = detail.generated_episode_story_ids ?? {};
  const episodes: AiComicSeriesSeedanceEpisodePackage[] = [];
  const missingEpisodes: AiComicSeriesSeedanceExportPackage['missing_episodes'] = [];
  const validationNotes: string[] = [];

  for (const episode of detail.plan.episodes) {
    const storyId = generatedEpisodeStoryIds[String(episode.episode_no)];
    if (!storyId) {
      missingEpisodes.push({
        episode_no: episode.episode_no,
        title: episode.title,
        reason: '尚未生成分集故事',
      });
      continue;
    }
    const storyResult = await getStory(storyId);
    if (!storyResult.ok || !storyResult.data) {
      missingEpisodes.push({
        episode_no: episode.episode_no,
        title: episode.title,
        reason: storyResult.error?.message ?? `故事 ${storyId} 不存在`,
      });
      continue;
    }
    const seedancePackage = buildSeedancePromptPackage(storyResult.data);
    episodes.push({
      episode_no: episode.episode_no,
      episode_title: episode.title,
      story_id: storyId,
      total_duration_sec: seedancePackage.total_duration_sec,
      shot_count: seedancePackage.shot_units.length,
      package: seedancePackage,
    });
    validationNotes.push(
      ...seedancePackage.validation_notes.map(note => `第${episode.episode_no}集：${note}`),
    );
  }

  const exportedAt = new Date().toISOString();
  const assetReferencePlan = unique(episodes.flatMap(episode =>
    episode.package.asset_reference_plan.map(item => `第${episode.episode_no}集：${item}`)
  )).slice(0, 80);
  const basePackage: Omit<AiComicSeriesSeedanceExportPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-export/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    target_platform: 'seedance_2_0',
    prompt_language: 'zh',
    total_episode_count: detail.plan.episode_count,
    generated_episode_count: episodes.length,
    total_shot_count: episodes.reduce((sum, episode) => sum + episode.shot_count, 0),
    total_duration_sec: episodes.reduce((sum, episode) => sum + episode.total_duration_sec, 0),
    asset_reference_plan: assetReferencePlan,
    episodes,
    missing_episodes: missingEpisodes,
    validation_notes: unique(validationNotes),
  };
  const seedanceProduction = syncSeedanceProductionLedgerWithExport({
    ledger: detail.seedance_production,
    episodes,
    exportedAt,
  });
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: exportedAt,
    },
    seedance_production: seedanceProduction,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });
  const renderPackage = {
    ...basePackage,
    project: updatedDetail.project,
    seedance_production: seedanceProduction,
  };
  return success({
    ...renderPackage,
    markdown: buildAiComicSeriesSeedanceMarkdown(renderPackage),
  });
}

export async function updateAiComicSeriesSeedanceProductionStatus(
  seriesProjectId: string,
  request: AiComicSeedanceProductionStatusUpdateRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  return updateAiComicSeriesSeedanceProductionStatuses(seriesProjectId, { updates: [request] });
}

interface AiComicSeedanceProductionUpdateContext {
  externalCallAuthorization?: ExternalProviderCallAuthorizationRecord;
  executionCost?: AiComicSeedanceExecutionCostRecord;
}

export async function updateAiComicSeriesSeedanceProductionStatuses(
  seriesProjectId: string,
  request: AiComicSeedanceProductionBatchUpdateRequest,
  context: AiComicSeedanceProductionUpdateContext = {},
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const episodeMap = new Map(existing.plan.episodes.map(episode => [episode.episode_no, episode]));
  for (const update of request.updates) {
    if (!episodeMap.has(update.episode_no)) {
      return fail(ErrorCodes.VALIDATION_ERROR, `episode_no ${update.episode_no} is outside the series episode range`);
    }
  }

  const detail = buildAiComicSeriesSeedanceProductionUpdate(
    existing,
    request.updates,
    new Date().toISOString(),
    context,
  );
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

function buildAiComicSeriesSeedanceProductionUpdate(
  existing: StoredAiComicSeriesProject,
  updates: readonly AiComicSeedanceProductionStatusUpdateRequest[],
  updatedAt: string,
  context: AiComicSeedanceProductionUpdateContext = {},
): AiComicSeriesProjectDetail {
  const episodeMap = new Map(existing.plan.episodes.map(episode => [episode.episode_no, episode]));
  const ledger = updates.reduce((currentLedger, update) => {
    const episode = episodeMap.get(update.episode_no)!;
    return updateSeedanceProductionLedger({
      ledger: currentLedger,
      episodeTitle: episode.title,
      storyId: existing.generated_episode_story_ids[String(update.episode_no)],
      request: update,
      updatedAt,
      externalCallAuthorization: context.externalCallAuthorization,
      executionCost: context.executionCost,
    });
  }, existing.seedance_production);
  return {
    ...existing,
    project: {
      ...existing.project,
      updated_at: updatedAt,
    },
    seedance_production: ledger,
  };
}

export async function applyAiComicSeriesSeedanceProductionCallback(
  seriesProjectId: string,
  request: AiComicSeedanceProductionCallbackRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const ledger = normalizeSeedanceProductionLedger(existing.seedance_production);
  const providerJobId = callbackStringField(
    request.provider_job_id ?? request.providerJobId ?? request.job_id ?? request.jobId,
  );
  const explicitEpisodeNo = Number(request.episode_no ?? request.episodeNo);
  const explicitShotId = callbackStringField(request.shot_id ?? request.shotId);
  const matchedItem = providerJobId
    ? ledger.items.find(item =>
      item.provider_job_id === providerJobId
      || item.versions.some(version => version.provider_job_id === providerJobId)
    )
    : undefined;
  const matchedVersion = providerJobId && matchedItem
    ? [...matchedItem.versions].reverse().find(version => version.provider_job_id === providerJobId)
    : undefined;
  const episodeNo = Number.isInteger(explicitEpisodeNo) && explicitEpisodeNo > 0
    ? explicitEpisodeNo
    : matchedItem?.episode_no;
  const shotId = explicitShotId ?? matchedItem?.shot_id;
  if (!episodeNo || !shotId) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      providerJobId
        ? `Seedance callback job "${providerJobId}" was not found in production ledger`
        : 'Seedance callback requires episode_no + shot_id or a known provider_job_id/job_id',
    );
  }

  const episode = existing.plan.episodes.find(item => item.episode_no === episodeNo);
  if (!episode) {
    return fail(ErrorCodes.VALIDATION_ERROR, `episode_no ${episodeNo} is outside the series episode range`);
  }

  const videoUrl = callbackStringField(request.video_url ?? request.videoUrl ?? request.url);
  const explicitFailureReason = callbackStringField(request.failure_reason ?? request.failureReason ?? request.error);
  const callbackMessage = callbackStringField(request.message);
  const status = normalizeSeedanceCallbackStatus(request.status, Boolean(videoUrl), Boolean(explicitFailureReason));
  const failureReason = status === 'failed'
    ? explicitFailureReason ?? callbackMessage
    : undefined;
  const callbackNote = callbackStringField(request.note)
    ?? callbackMessage
    ?? `Seedance 外部回调：${seedanceProductionStatusText(status)}`;
  const rawActualCost = request.actual_cost_amount ?? request.actualCostAmount;
  const actualCostAmount = callbackCostNumberField(rawActualCost);
  const costCurrency = callbackStringField(request.cost_currency ?? request.costCurrency)?.toUpperCase();
  if ((rawActualCost !== undefined || costCurrency !== undefined) && (
    actualCostAmount === undefined
    || actualCostAmount < 0
    || !costCurrency
    || !/^[A-Z]{3}$/.test(costCurrency)
  )) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Seedance callback actual cost requires a non-negative amount and 3-letter currency together',
    );
  }
  const targetItem = matchedItem ?? ledger.items.find(item => (
    item.episode_no === episodeNo && item.shot_id === shotId
  ));
  const callbackReceivedAt = new Date().toISOString();
  const costAuthorization = providerJobId
    && matchedVersion
    && targetItem?.provider_job_id !== providerJobId
    ? matchedVersion.external_call_authorization
    : targetItem?.external_call_authorization;
  const executionCost = actualCostAmount !== undefined && costCurrency
    ? buildAiComicSeedanceExecutionCostRecord({
      actualCostAmount,
      costCurrency,
      authorization: costAuthorization,
      providerReportedAt: callbackReceivedAt,
    })
    : undefined;
  if (
    providerJobId
    && matchedItem
    && matchedVersion
    && matchedItem.provider_job_id !== providerJobId
  ) {
    const updatedLedger = reconcileSeedanceProductionExecutionCosts({
      ...ledger,
      updated_at: callbackReceivedAt,
      items: ledger.items.map(item => item.production_id !== matchedItem.production_id
        ? item
        : {
          ...item,
          updated_at: callbackReceivedAt,
          notes: unique([...item.notes, callbackNote]).slice(-12),
          versions: item.versions.map(version => version.version_id !== matchedVersion.version_id
            ? version
            : {
              ...version,
              status,
              video_url: videoUrl ?? version.video_url,
              failure_reason: status === 'failed' ? failureReason ?? version.failure_reason : undefined,
              note: callbackNote,
              quality_score: callbackNumberField(request.quality_score ?? request.qualityScore)
                ?? version.quality_score,
              review_note: callbackStringField(request.review_note ?? request.reviewNote)
                ?? version.review_note,
              execution_cost: executionCost ?? version.execution_cost,
            }),
        }),
    });
    const updatedDetail: AiComicSeriesProjectDetail = {
      ...existing,
      project: {
        ...existing.project,
        updated_at: callbackReceivedAt,
      },
      seedance_production: updatedLedger,
    };
    await seriesProjectRepository().replace(updatedDetail, { updated_at: existing.project.updated_at });
    return success(updatedDetail);
  }
  return updateAiComicSeriesSeedanceProductionStatuses(seriesProjectId, {
    updates: [{
      episode_no: episodeNo,
      shot_id: shotId,
      status,
      provider_job_id: providerJobId,
      video_url: videoUrl,
      failure_reason: failureReason,
      note: callbackNote,
      quality_score: callbackNumberField(request.quality_score ?? request.qualityScore),
      review_note: callbackStringField(request.review_note ?? request.reviewNote),
    }],
  }, { executionCost });
}

export async function recoverAiComicSeriesSeedanceProviderTimeouts(
  seriesProjectId: string,
  request: AiComicSeedanceProviderRecoveryRequest = {},
): Promise<ApiResponse<AiComicSeriesSeedanceProviderRecoveryResult>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const checkedAt = new Date().toISOString();
  const timeoutMinutes = request.timeout_minutes ?? 120;
  const statuses = request.statuses?.length
    ? request.statuses
    : ['submitted', 'processing'] satisfies AiComicSeedanceRecoverableProductionStatus[];
  const statusSet = new Set<AiComicSeedanceRecoverableProductionStatus>(statuses);
  const ledger = normalizeSeedanceProductionLedger(existing.seedance_production);
  const timedOutShots = ledger.items
    .filter((item): item is AiComicSeedanceShotProductionItem & { status: AiComicSeedanceRecoverableProductionStatus } =>
      statusSet.has(item.status as AiComicSeedanceRecoverableProductionStatus)
    )
    .map(item => seedanceProviderRecoveryItem(item, checkedAt))
    .filter(item => item.minutes_waiting >= timeoutMinutes)
    .sort((a, b) => b.minutes_waiting - a.minutes_waiting || compareSeedanceShotIds(a.shot_id, b.shot_id));

  let project = existing.project;
  let seedanceProduction = existing.seedance_production;
  let updatedCount = 0;
  if (request.mark_timed_out_failed && timedOutShots.length > 0) {
    const updateRes = await updateAiComicSeriesSeedanceProductionStatuses(seriesProjectId, {
      updates: timedOutShots.map(item => ({
        episode_no: item.episode_no,
        shot_id: item.shot_id,
        status: 'failed',
        provider_job_id: item.provider_job_id,
        failure_reason: request.failure_reason ?? `Seedance provider timeout after ${timeoutMinutes} minutes`,
        note: `Seedance 超时恢复：${item.status} 等待 ${item.minutes_waiting} 分钟`,
      })),
    });
    if (!updateRes.ok || !updateRes.data) {
      return fail(
        normalizeErrorCode(updateRes.error?.code),
        updateRes.error?.message ?? 'Recover Seedance provider timeouts failed',
        updateRes.error?.details,
      );
    }
    project = updateRes.data.project;
    seedanceProduction = updateRes.data.seedance_production;
    updatedCount = timedOutShots.length;
  }

  const result: Omit<AiComicSeriesSeedanceProviderRecoveryResult, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-provider-recovery-result/v1',
    project,
    series_title: existing.plan.series_title,
    checked_at: checkedAt,
    timeout_minutes: timeoutMinutes,
    statuses,
    mark_timed_out_failed: Boolean(request.mark_timed_out_failed),
    timed_out_count: timedOutShots.length,
    updated_count: updatedCount,
    timed_out_shots: timedOutShots,
    seedance_production: seedanceProduction,
  };
  return success({
    ...result,
    markdown: buildAiComicSeriesSeedanceProviderRecoveryMarkdown(result),
  });
}

export async function selectAiComicSeriesSeedanceProductionVersion(
  seriesProjectId: string,
  request: AiComicSeedanceProductionVersionSelectRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const ledger = normalizeSeedanceProductionLedger(existing.seedance_production);
  const productionId = seedanceProductionId(request.episode_no, request.shot_id);
  const item = ledger.items.find(candidate => candidate.production_id === productionId);
  if (!item) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Seedance production item ${productionId} was not found`);
  }
  const version = item.versions.find(candidate => candidate.version_id === request.version_id);
  if (!version) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Seedance video version "${request.version_id}" was not found`);
  }
  if (version.status !== 'ready' || !version.video_url) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Seedance video version "${request.version_id}" is not ready for cutting`);
  }

  const updatedAt = new Date().toISOString();
  const nextItems = ledger.items.map(candidate => {
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
      notes: unique([
        ...candidate.notes,
        request.note ?? `已选择剪辑版本：${version.version_id}`,
      ]).slice(-12),
    };
  });
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: updatedAt,
    },
    seedance_production: {
      schema_version: 'ai-comic-seedance-production-ledger/v1',
      updated_at: updatedAt,
      items: nextItems,
    },
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function autoSelectAiComicSeriesSeedanceProductionVersions(
  seriesProjectId: string,
  request: AiComicSeedanceProductionAutoSelectRequest = {},
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const ledger = normalizeSeedanceProductionLedger(existing.seedance_production);
  const updatedAt = new Date().toISOString();
  let selectedCount = 0;
  const nextItems = ledger.items.map(item => {
    if (item.selected_version_id && !request.overwrite_manual) return item;
    const bestVersion = bestReadySeedanceVersion(item, request.min_quality_score);
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
      notes: unique([
        ...item.notes,
        request.note ?? `自动择优剪辑版本：${bestVersion.version_id}`,
      ]).slice(-12),
    };
  });
  if (selectedCount === 0) return success(existing);
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: updatedAt,
    },
    seedance_production: {
      schema_version: 'ai-comic-seedance-production-ledger/v1',
      updated_at: updatedAt,
      items: nextItems,
    },
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

function resolveAiComicSeriesAssetIdentityBinding(input: {
  detail: AiComicSeriesProjectDetail;
  identityId: string;
  kind: AiComicSeedanceAssetLibraryItem['kind'];
  label: string;
}): { identity?: AiComicSeriesVisualIdentity; error?: string } {
  if (input.kind === 'unknown') {
    return { error: '未知类型素材不能映射到稳定视觉身份' };
  }
  const visualBible = buildAiComicSeriesVisualBible({
    plan: input.detail.plan,
    ledger: input.detail.continuity_ledger,
    generatedEpisodeStoryIds: input.detail.generated_episode_story_ids,
    assetLibrary: input.detail.seedance_asset_library,
    previousVisualBible: input.detail.visual_bible,
  });
  const identity = visualBible.identities.find(item => item.identity_id === input.identityId);
  if (!identity) {
    return { error: `稳定视觉身份“${input.identityId}”不存在或已过期` };
  }
  if (identity.kind !== input.kind) {
    return { error: `素材类型“${input.kind}”不能映射到 ${identity.kind} 身份“${identity.label}”` };
  }
  if (seedanceAssetLookupKey(input.kind, input.label) !== seedanceAssetLookupKey(identity.kind, identity.label)) {
    return { error: `素材标签“${input.label}”必须与稳定身份“${identity.label}”一致，不能静默复用` };
  }
  return { identity };
}

function pendingAiComicSeriesAssetIdentityBinding(input: {
  identity: AiComicSeriesVisualIdentity;
  previous?: AiComicSeedanceAssetIdentityBinding;
  stale?: boolean;
}): AiComicSeedanceAssetIdentityBinding {
  const stillCurrent = input.previous
    && input.previous.series_identity_id === input.identity.identity_id
    && input.previous.source_fingerprint === input.identity.source_fingerprint
    && input.previous.visual_definition_fingerprint === input.identity.definition_fingerprint;
  if (stillCurrent && !input.stale) return { ...input.previous! };
  return {
    series_identity_id: input.identity.identity_id,
    source_fingerprint: input.identity.source_fingerprint,
    visual_definition_fingerprint: input.identity.definition_fingerprint,
    status: input.stale ? 'stale' : 'pending',
    reviewer_id: undefined,
    reviewed_at: undefined,
    review_note: undefined,
    human_confirmed: false,
  };
}

function aiComicSeriesAssetIdentityBindingIsCurrent(
  binding: AiComicSeedanceAssetIdentityBinding | undefined,
  identity: AiComicSeriesVisualIdentity | undefined,
): boolean {
  return Boolean(
    binding
    && identity
    && binding.series_identity_id === identity.identity_id
    && binding.source_fingerprint === identity.source_fingerprint
    && binding.visual_definition_fingerprint === identity.definition_fingerprint,
  );
}

function effectiveAiComicSeriesAssetIdentityBindingStatus(
  binding: AiComicSeedanceAssetIdentityBinding | undefined,
  identity: AiComicSeriesVisualIdentity | undefined,
): AiComicSeedanceAssetIdentityBinding['status'] | undefined {
  if (!binding) return undefined;
  return aiComicSeriesAssetIdentityBindingIsCurrent(binding, identity)
    ? binding.status
    : 'stale';
}

function reconcileAiComicSeriesAssetIdentityBindingStaleness(
  library: AiComicSeedanceAssetLibrary | undefined,
  visualBible: NonNullable<AiComicSeriesProjectDetail['visual_bible']>,
): AiComicSeedanceAssetLibrary {
  const identities = new Map(visualBible.identities.map(identity => [identity.identity_id, identity]));
  const normalized = normalizeSeedanceAssetLibrary(library);
  return {
    ...normalized,
    items: normalized.items.map(item => {
      const binding = item.identity_binding;
      if (!binding || aiComicSeriesAssetIdentityBindingIsCurrent(binding, identities.get(binding.series_identity_id))) {
        return item;
      }
      return {
        ...item,
        identity_binding: {
          ...binding,
          status: 'stale',
          reviewer_id: undefined,
          reviewed_at: undefined,
          review_note: undefined,
          human_confirmed: false,
        },
      };
    }),
  };
}

export async function updateAiComicSeriesSeedanceAssetLibrary(
  seriesProjectId: string,
  request: AiComicSeedanceAssetLibraryUpdateRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const updatedAt = new Date().toISOString();
  const current = normalizeSeedanceAssetLibrary(existing.seedance_asset_library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  for (const item of request.items) {
    const label = item.label.trim();
    const assetId = item.asset_id?.trim() || seedanceAssetId(item.kind, label);
    const previous = byId.get(assetId);
    const requestedIdentityId = item.series_identity_id?.trim() ?? previous?.identity_binding?.series_identity_id;
    let identityBinding = previous?.identity_binding;
    if (requestedIdentityId) {
      const bindingResult = resolveAiComicSeriesAssetIdentityBinding({
        detail: existing,
        identityId: requestedIdentityId,
        kind: item.kind,
        label,
      });
      if (!bindingResult.identity) {
        return fail(ErrorCodes.VALIDATION_ERROR, bindingResult.error ?? '无法解析稳定视觉身份映射');
      }
      const mappingChanged = previous?.identity_binding?.series_identity_id !== bindingResult.identity.identity_id;
      const definitionChanged = !aiComicSeriesAssetIdentityBindingIsCurrent(
        previous?.identity_binding,
        bindingResult.identity,
      );
      identityBinding = pendingAiComicSeriesAssetIdentityBinding({
        identity: bindingResult.identity,
        previous: previous?.identity_binding,
        stale: Boolean(previous && (mappingChanged || definitionChanged || (
          previous.kind !== item.kind
          || seedanceAssetLookupKey(previous.kind, previous.label) !== seedanceAssetLookupKey(item.kind, label)
        ))),
      });
    }
    byId.set(assetId, {
      asset_id: assetId,
      kind: item.kind,
      label,
      reference_slot: item.reference_slot?.trim() || previous?.reference_slot,
      file_url: item.file_url?.trim() || previous?.file_url,
      file_id: item.file_id?.trim() || previous?.file_id,
      local_path: previous?.local_path,
      original_filename: previous?.original_filename,
      mime_type: previous?.mime_type,
      size_bytes: previous?.size_bytes,
      provider: previous?.provider,
      provider_asset_id: previous?.provider_asset_id,
      content_sha256: previous?.content_sha256,
      prompt_sha256: previous?.prompt_sha256,
      model: previous?.model,
      rights_status: previous?.rights_status,
      authorization_reference: previous?.authorization_reference,
      person_consent_reference: previous?.person_consent_reference,
      human_review_status: previous?.human_review_status,
      reviewer_id: previous?.reviewer_id,
      reviewed_at: previous?.reviewed_at,
      review_note: previous?.review_note,
      identity_binding: identityBinding,
      history: previous?.history?.map(event => ({ ...event })),
      description: item.description?.trim() || previous?.description,
      updated_at: updatedAt,
    });
  }
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: updatedAt,
    },
    seedance_asset_library: {
      schema_version: 'ai-comic-seedance-asset-library/v1',
      updated_at: updatedAt,
      items: [...byId.values()].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.label.localeCompare(b.label, 'zh-CN');
      }),
    },
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function uploadAiComicSeriesSeedanceAssetFile(
  seriesProjectId: string,
  request: {
    asset_id?: string;
    label?: string;
    kind?: AiComicSeedanceAssetLibraryItem['kind'];
    reference_slot?: string;
    description?: string;
    series_identity_id?: string;
    file: {
      original_filename: string;
      mime_type: string;
      buffer: Buffer;
    };
  },
): Promise<ApiResponse<AiComicSeedanceAssetFileUploadResult>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const current = normalizeSeedanceAssetLibrary(existing.seedance_asset_library);
  const directAssetId = request.asset_id?.trim();
  const previous = directAssetId
    ? current.items.find(item => item.asset_id === directAssetId)
    : undefined;
  const kind = request.kind ?? previous?.kind;
  const label = request.label?.trim() || previous?.label;
  const assetId = directAssetId || (kind && label ? seedanceAssetId(kind, label) : undefined);
  if (!assetId || !kind || !label) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'asset_id must identify an existing series asset, or label+kind must be provided',
    );
  }
  const requestedIdentityId = request.series_identity_id?.trim() ?? previous?.identity_binding?.series_identity_id;
  let identityBinding = previous?.identity_binding;
  if (requestedIdentityId) {
    const bindingResult = resolveAiComicSeriesAssetIdentityBinding({
      detail: existing,
      identityId: requestedIdentityId,
      kind,
      label,
    });
    if (!bindingResult.identity) {
      return fail(ErrorCodes.VALIDATION_ERROR, bindingResult.error ?? '无法解析稳定视觉身份映射');
    }
    identityBinding = pendingAiComicSeriesAssetIdentityBinding({
      identity: bindingResult.identity,
      previous: previous?.identity_binding,
      stale: Boolean(previous),
    });
  }
  let ingest;
  try {
    ingest = inspectMediaAssetUpload({
      original_filename: request.file.original_filename,
      declared_mime_type: request.file.mime_type,
      expected_modality: 'image',
      buffer: request.file.buffer,
    });
  } catch (error) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      error instanceof Error ? error.message : 'Uploaded series asset failed media inspection',
    );
  }

  const fileId = `media-${ingest.content_sha256}`;
  const filename = `${ingest.content_sha256}${ingest.canonical_extension}`;
  const projectDirectory = dirname(seriesProjectPath(seriesProjectId));
  const originalStore = new FileArtifactStore(resolve(projectDirectory, 'media', 'originals'));
  if (!(await originalStore.exists(filename))) {
    await originalStore.writeBinary(filename, request.file.buffer, { overwrite: 'forbid' });
  }
  const localPath = `ai-comic-series-projects/${seriesProjectId}/media/originals/${filename}`;
  const updatedAt = nextSeriesProjectUpdatedAt(existing.project.updated_at);
  const asset: AiComicSeedanceAssetLibraryItem = {
    asset_id: assetId,
    kind,
    label,
    reference_slot: request.reference_slot?.trim() || previous?.reference_slot,
    file_url: undefined,
    file_id: fileId,
    local_path: localPath,
    original_filename: request.file.original_filename,
    mime_type: ingest.detected_mime_type,
    size_bytes: ingest.byte_size,
    provider: 'local_upload',
    provider_asset_id: fileId,
    content_sha256: ingest.content_sha256,
    prompt_sha256: previous?.prompt_sha256,
    model: previous?.model,
    rights_status: 'pending',
    authorization_reference: undefined,
    person_consent_reference: undefined,
    human_review_status: 'pending',
    reviewer_id: undefined,
    reviewed_at: undefined,
    review_note: undefined,
    identity_binding: identityBinding,
    description: request.description?.trim() || previous?.description,
    updated_at: updatedAt,
    history: appendAiComicSeriesAssetHistory(previous, {
      event_id: `series-media-upload-${randomUUID()}`,
      event_type: 'file_upload',
      created_at: updatedAt,
      provider: 'local_upload',
      provider_asset_id: fileId,
      file_id: fileId,
      local_path: localPath,
      original_filename: request.file.original_filename,
      mime_type: ingest.detected_mime_type,
      size_bytes: ingest.byte_size,
      content_sha256: ingest.content_sha256,
      rights_status: 'pending',
      human_review_status: 'pending',
      note: request.file.original_filename,
    }),
  };
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  byId.set(assetId, asset);
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: { ...existing.project, updated_at: updatedAt },
    seedance_asset_library: {
      schema_version: 'ai-comic-seedance-asset-library/v1',
      updated_at: updatedAt,
      items: [...byId.values()].sort((a, b) => (
        a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, 'zh-CN')
      )),
    },
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  const previewUrl = `/api/story-outline/ai-comic-series-projects/${seriesProjectId}/media-assets/media-sha256-${ingest.content_sha256}/preview`;
  return success({
    detail,
    asset,
    file_id: fileId,
    local_path: localPath,
    original_filename: request.file.original_filename,
    mime_type: ingest.detected_mime_type,
    size_bytes: ingest.byte_size,
    content_sha256: ingest.content_sha256,
    preview_url: previewUrl,
    ingest,
  });
}

export interface AiComicSeriesMediaAssetPreviewFile {
  buffer: Buffer;
  mime_type: string;
  byte_size: number;
  content_sha256: string;
  filename: string;
}

export type AiComicSeriesMediaAssetPreviewResult =
  | { ok: true; data: AiComicSeriesMediaAssetPreviewFile }
  | { ok: false; status: 400 | 404 | 409; message: string };

export async function readAiComicSeriesMediaAssetPreview(
  seriesProjectId: string,
  artifactId: string,
): Promise<AiComicSeriesMediaAssetPreviewResult> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) return { ok: false, status: 404, message: 'series project not found' };
  const contentSha256 = /^media-sha256-([a-f0-9]{64})$/.exec(artifactId)?.[1];
  if (!contentSha256) return { ok: false, status: 404, message: 'verified media artifact not found' };
  const asset = normalizeSeedanceAssetLibrary(detail.seedance_asset_library).items.find(item => (
    item.content_sha256?.toLowerCase() === contentSha256
  ));
  if (!asset) return { ok: false, status: 404, message: 'verified media artifact not found' };
  if (!asset.local_path || asset.provider !== 'local_upload') {
    return { ok: false, status: 409, message: 'media artifact is not available from authenticated local preview' };
  }
  if (!asset.mime_type || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime_type)) {
    return { ok: false, status: 409, message: 'media artifact MIME is not previewable' };
  }
  const generatedDirectory = resolve(generatedRoot());
  const target = resolve(generatedDirectory, asset.local_path);
  const relation = relative(generatedDirectory, target);
  const expectedPrefix = `ai-comic-series-projects/${seriesProjectId}/media/originals/`;
  if (isAbsolute(relation) || relation.startsWith('..') || !asset.local_path.startsWith(expectedPrefix)) {
    return { ok: false, status: 400, message: 'media artifact path is outside the series immutable store' };
  }
  let fileStat;
  try {
    fileStat = await lstat(target);
  } catch {
    return { ok: false, status: 404, message: 'media artifact file not found' };
  }
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    return { ok: false, status: 400, message: 'media artifact target is not a regular file' };
  }
  const buffer = await readFile(target);
  const digest = createHash('sha256').update(buffer).digest('hex');
  if (digest !== contentSha256 || buffer.length !== asset.size_bytes) {
    return { ok: false, status: 409, message: 'media artifact integrity changed after ingest' };
  }
  return {
    ok: true,
    data: {
      buffer,
      mime_type: asset.mime_type,
      byte_size: buffer.length,
      content_sha256: digest,
      filename: basename(target),
    },
  };
}

export async function updateAiComicSeriesMediaAssetReview(
  seriesProjectId: string,
  request: MediaAssetReviewUpdateRequest,
  reviewer: {
    actor_id: string;
    authentication_method: 'static_registry_token' | 'signed_session';
  },
): Promise<ApiResponse<AiComicSeriesMediaAssetReviewUpdateResult>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const current = normalizeSeedanceAssetLibrary(existing.seedance_asset_library);
  const asset = current.items.find(item => item.asset_id === request.asset_id);
  if (!asset) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Media asset "${request.asset_id}" is not in the series asset library`);
  }
  const bindingResult = asset.identity_binding
    ? resolveAiComicSeriesAssetIdentityBinding({
        detail: existing,
        identityId: asset.identity_binding.series_identity_id,
        kind: asset.kind,
        label: asset.label,
      })
    : undefined;
  const boundIdentity = bindingResult?.identity;
  if (!request.rights_status && !request.human_review_status) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'rights_status or human_review_status is required');
  }
  if (request.expected_content_sha256) {
    const expected = request.expected_content_sha256.toLowerCase();
    if (!asset.content_sha256 || asset.content_sha256.toLowerCase() !== expected) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        'Media asset content changed or does not match expected_content_sha256; review the current immutable file',
      );
    }
  }
  if (request.rights_status === 'authorized' && !request.authorization_reference?.trim()) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'authorization_reference is required for authorized media rights');
  }
  if (request.human_review_status && request.human_review_status !== 'pending') {
    if (!request.expected_content_sha256 || !request.review_note?.trim()) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        'expected_content_sha256 and review_note are required for a human visual review decision',
      );
    }
    const preview = await readAiComicSeriesMediaAssetPreview(
      seriesProjectId,
      `media-sha256-${request.expected_content_sha256.toLowerCase()}`,
    );
    if (!preview.ok) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        'Human visual review requires a locally ingested immutable artifact with verified bytes',
      );
    }
  }

  const reviewedAt = nextSeriesProjectUpdatedAt(existing.project.updated_at);
  const humanReviewStatus = request.human_review_status ?? asset.human_review_status ?? 'pending';
  const rightsStatus = request.rights_status ?? asset.rights_status ?? 'pending';
  let identityBinding = asset.identity_binding;
  if (identityBinding) {
    if (!boundIdentity || !aiComicSeriesAssetIdentityBindingIsCurrent(identityBinding, boundIdentity)) {
      identityBinding = {
        ...identityBinding,
        status: 'stale',
        reviewer_id: undefined,
        reviewed_at: undefined,
        review_note: undefined,
        human_confirmed: false,
      };
    } else if (request.human_review_status === 'approved' && rightsStatus === 'authorized') {
      identityBinding = {
        series_identity_id: boundIdentity.identity_id,
        source_fingerprint: boundIdentity.source_fingerprint,
        visual_definition_fingerprint: boundIdentity.definition_fingerprint,
        status: 'approved',
        reviewer_id: reviewer.actor_id,
        reviewed_at: reviewedAt,
        review_note: request.review_note!.trim(),
        human_confirmed: true,
      };
    } else if (request.human_review_status === 'rejected') {
      identityBinding = {
        ...identityBinding,
        status: 'changes_requested',
        reviewer_id: reviewer.actor_id,
        reviewed_at: reviewedAt,
        review_note: request.review_note!.trim(),
        human_confirmed: true,
      };
    }
  }
  let reviewedAsset: AiComicSeedanceAssetLibraryItem = {
    ...asset,
    rights_status: rightsStatus,
    authorization_reference: request.authorization_reference?.trim() ?? asset.authorization_reference,
    person_consent_reference: request.person_consent_reference?.trim() ?? asset.person_consent_reference,
    human_review_status: humanReviewStatus,
    reviewer_id: request.human_review_status && request.human_review_status !== 'pending'
      ? reviewer.actor_id
      : request.human_review_status === 'pending' ? undefined : asset.reviewer_id,
    reviewed_at: request.human_review_status && request.human_review_status !== 'pending'
      ? reviewedAt
      : request.human_review_status === 'pending' ? undefined : asset.reviewed_at,
    review_note: request.human_review_status && request.human_review_status !== 'pending'
      ? request.review_note?.trim()
      : request.human_review_status === 'pending' ? undefined : asset.review_note,
    identity_binding: identityBinding,
    updated_at: reviewedAt,
  };
  if (request.rights_status) {
    reviewedAsset = {
      ...reviewedAsset,
      history: appendAiComicSeriesAssetHistory(reviewedAsset, {
        event_id: `series-media-rights-${randomUUID()}`,
        event_type: 'rights_review',
        created_at: reviewedAt,
        content_sha256: reviewedAsset.content_sha256,
        rights_status: reviewedAsset.rights_status,
        authorization_reference: reviewedAsset.authorization_reference,
        person_consent_reference: reviewedAsset.person_consent_reference,
        reviewer_id: reviewer.actor_id,
        note: request.authorization_reference?.trim() ?? `rights_status=${request.rights_status}`,
      }),
    };
  }
  if (request.human_review_status) {
    reviewedAsset = {
      ...reviewedAsset,
      history: appendAiComicSeriesAssetHistory(reviewedAsset, {
        event_id: `series-media-review-${randomUUID()}`,
        event_type: 'human_visual_review',
        created_at: reviewedAt,
        content_sha256: reviewedAsset.content_sha256,
        human_review_status: reviewedAsset.human_review_status,
        reviewer_id: request.human_review_status === 'pending' ? undefined : reviewer.actor_id,
        reviewed_at: request.human_review_status === 'pending' ? undefined : reviewedAt,
        note: request.review_note?.trim() ?? `human_review_status=${request.human_review_status}`,
      }),
    };
  }
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: { ...existing.project, updated_at: reviewedAt },
    seedance_asset_library: {
      schema_version: 'ai-comic-seedance-asset-library/v1',
      updated_at: reviewedAt,
      items: current.items
        .map(item => item.asset_id === reviewedAsset.asset_id ? reviewedAsset : item)
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, 'zh-CN')),
    },
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success({
    detail,
    asset: reviewedAsset,
    reviewer_id: reviewer.actor_id,
    reviewed_at: reviewedAt,
    production_credit_granted: aiComicSeriesAssetProductionCreditGranted(reviewedAsset, boundIdentity),
  });
}

function appendAiComicSeriesAssetHistory(
  existing: Pick<AiComicSeedanceAssetLibraryItem, 'history'> | undefined,
  event: SeedanceAssetHistoryEvent,
): SeedanceAssetHistoryEvent[] {
  return [...(existing?.history ?? []).map(item => ({ ...item })), event].slice(-25);
}

function aiComicSeriesAssetProductionCreditGranted(
  item: AiComicSeedanceAssetLibraryItem,
  identity?: AiComicSeriesVisualIdentity,
): boolean {
  return Boolean(
    item.kind === identity?.kind
    && item.provider === 'local_upload'
    && item.local_path
    && item.content_sha256
    && /^[a-f0-9]{64}$/i.test(item.content_sha256)
    && item.rights_status === 'authorized'
    && item.human_review_status === 'approved'
    && aiComicSeriesAssetIdentityBindingIsCurrent(item.identity_binding, identity)
    && identity?.approval.status === 'approved'
    && item.identity_binding?.status === 'approved'
    && item.identity_binding.human_confirmed === true
    && Boolean(item.identity_binding.reviewer_id?.trim())
  );
}

function nextSeriesProjectUpdatedAt(previous: string): string {
  const previousTime = Date.parse(previous);
  return new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();
}

export async function updateAiComicSeriesSeedanceAudioLibrary(
  seriesProjectId: string,
  request: AiComicSeedanceAudioLibraryUpdateRequest,
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const updatedAt = new Date().toISOString();
  const current = normalizeSeedanceAudioLibrary(existing.seedance_audio_library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  for (const item of request.items) {
    const label = item.label.trim();
    const assetId = item.asset_id?.trim() || seedanceAudioAssetId(item.kind, label);
    const previous = byId.get(assetId);
    byId.set(assetId, {
      asset_id: assetId,
      kind: item.kind,
      label,
      file_url: item.file_url?.trim() || previous?.file_url,
      file_id: item.file_id?.trim() || previous?.file_id,
      duration_sec: item.duration_sec ?? previous?.duration_sec,
      license_note: item.license_note?.trim() || previous?.license_note,
      loopable: item.loopable ?? previous?.loopable,
      bpm: item.bpm ?? previous?.bpm,
      mood_tags: unique([...(item.mood_tags ?? previous?.mood_tags ?? [])].map(tag => tag.trim()).filter(Boolean)),
      updated_at: updatedAt,
    });
  }
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: updatedAt,
    },
    seedance_audio_library: {
      schema_version: 'ai-comic-seedance-audio-library/v1',
      updated_at: updatedAt,
      items: [...byId.values()].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.label.localeCompare(b.label, 'zh-CN');
      }),
    },
  };
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
  return success(detail);
}

export async function exportAiComicSeriesSeedanceCutPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceCutPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const ledger = normalizeSeedanceProductionLedger(detail.seedance_production);
  const exportedAt = new Date().toISOString();
  const planEpisodes = Array.isArray(detail.plan?.episodes) ? detail.plan.episodes : [];
  const episodeMap = new Map(planEpisodes.map(episode => [episode.episode_no, episode]));
  const readyItems = ledger.items.filter(item => item.status === 'ready' && Boolean(item.video_url));
  const missingShots = ledger.items
    .filter(item => !(item.status === 'ready' && item.video_url))
    .map(item => ({
      episode_no: item.episode_no,
      episode_title: item.episode_title,
      shot_id: item.shot_id,
      status: item.status,
      reason: item.failure_reason ?? (item.video_url ? '状态尚未完成' : '缺少视频 URL'),
    }));
  const episodes: AiComicSeedanceCutPackageEpisode[] = [...new Set(readyItems.map(item => item.episode_no))]
    .sort((a, b) => a - b)
    .map(episodeNo => {
      const episode = episodeMap.get(episodeNo);
      const shots = readyItems
        .filter(item => item.episode_no === episodeNo)
        .sort((a, b) => compareSeedanceShotIds(a.shot_id, b.shot_id))
        .map((item, index) => {
          const selectedVersion = selectedReadySeedanceVersion(item);
          return {
            production_id: item.production_id,
            episode_no: item.episode_no,
            episode_title: item.episode_title,
            story_id: item.story_id,
            shot_id: item.shot_id,
            source_scene_id: item.source_scene_id,
            video_url: selectedVersion?.video_url ?? item.video_url!,
            provider_job_id: selectedVersion?.provider_job_id ?? item.provider_job_id,
            version_id: selectedVersion?.version_id,
            selected_version_id: item.selected_version_id,
            quality_score: selectedVersion?.quality_score,
            review_note: selectedVersion?.review_note,
            completed_at: selectedVersion?.created_at ?? item.completed_at,
            order_index: index + 1,
            notes: [...item.notes],
          };
        });
      return {
        episode_no: episodeNo,
        episode_title: episode?.title ?? shots[0]?.episode_title ?? `第${episodeNo}集`,
        story_id: detail.generated_episode_story_ids[String(episodeNo)],
        ready_shot_count: shots.length,
        shots,
      };
    });
  const basePackage: Omit<AiComicSeriesSeedanceCutPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-cut-package/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    total_ready_shot_count: readyItems.length,
    total_missing_shot_count: missingShots.length,
    episodes,
    missing_shots: missingShots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceCutMarkdown(basePackage),
  });
}

export async function assembleAiComicSeriesSeedanceCut(
  seriesProjectId: string,
  request: AiComicSeedanceCutAssemblyRequest = {},
  options: { runner?: FfmpegCutAssemblyRunner } = {},
): Promise<ApiResponse<AiComicSeriesSeedanceCutAssemblyResult>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const cutPackageRes = await exportAiComicSeriesSeedanceCutPackage(seriesProjectId);
  if (!cutPackageRes.ok || !cutPackageRes.data) {
    return fail(
      normalizeErrorCode(cutPackageRes.error?.code),
      cutPackageRes.error?.message ?? 'Export Seedance cut package failed',
    );
  }

  const cutPackage = cutPackageRes.data;
  const episodes = request.episode_no === undefined
    ? cutPackage.episodes
    : cutPackage.episodes.filter(episode => episode.episode_no === request.episode_no);
  const shots = episodes
    .flatMap(episode => episode.shots)
    .sort((a, b) => a.episode_no - b.episode_no || a.order_index - b.order_index || compareSeedanceShotIds(a.shot_id, b.shot_id));
  if (shots.length === 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      request.episode_no
        ? `No ready Seedance videos found for episode ${request.episode_no}`
        : 'No ready Seedance videos found for cut assembly',
    );
  }

  const dryRun = request.dry_run ?? false;
  const overwrite = request.overwrite ?? false;
  const executedAt = new Date().toISOString();
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const runner = options.runner ?? runFfmpegCutAssembly;
  const profile = resolveSeedanceCutAssemblyProfile(request);
  const outputFilename = request.output_filename?.trim()
    || seedanceCutAssemblyFilename(seriesProjectId, request.episode_no);
  const outputPath = `cuts/${seriesProjectId}/${outputFilename}`;
  const concatListPath = `cuts/${seriesProjectId}/${outputFilename.replace(/\.mp4$/i, '.concat.txt')}`;
  const projectDir = dirname(seriesProjectPath(seriesProjectId));
  const artifactStore = new FileArtifactStore(projectDir);
  const absoluteConcatListPath = resolveSeedanceProjectOutputPath(projectDir, concatListPath);
  const ffmpegCommand = buildFfmpegCutAssemblyCommand(ffmpegPath, concatListPath, outputPath, profile);
  const alreadyReady = !overwrite && await artifactStore.exists(outputPath);
  let status: AiComicSeriesSeedanceCutAssemblyResult['status'] = dryRun ? 'planned' : 'assembled';
  let failureReason: string | undefined;

  try {
    await artifactStore.writeText(
      concatListPath,
      `${shots.map(shot => ffmpegConcatFileLine(shot.video_url)).join('\n')}\n`,
      { overwrite: 'replace' },
    );
    if (alreadyReady) {
      status = 'skipped';
    } else if (!dryRun) {
      const outputSession = await artifactStore.prepareExternalWrite(outputPath, {
        overwrite: overwrite ? 'replace' : 'forbid',
      });
      try {
        await runner({
          ffmpegPath,
          concatListPath: absoluteConcatListPath,
          outputPath: outputSession.staging_absolute_path,
          profile,
        });
        await artifactStore.publishExternalWrite(outputSession);
      } finally {
        await artifactStore.abortExternalWrite(outputSession);
      }
    }
  } catch (err) {
    status = 'failed';
    failureReason = err instanceof Error ? err.message : String(err);
  }

  const assemblyLedger: AiComicSeedanceCutAssemblyLedger = {
    schema_version: 'ai-comic-seedance-cut-assembly-ledger/v1',
    updated_at: executedAt,
    status: status === 'assembled'
      ? 'ready'
      : status === 'planned'
        ? 'planned'
        : status,
    output_path: outputPath,
    output_filename: outputFilename,
    concat_list_path: concatListPath,
    ffmpeg_command: ffmpegCommand,
    assembly_mode: profile.assemblyMode,
    output_profile: profile.outputProfile,
    assembled_at: status === 'assembled' ? executedAt : detail.seedance_cut_assembly?.assembled_at,
    failure_reason: failureReason,
    dry_run: dryRun,
    source_episode_no: request.episode_no,
    source_shot_count: shots.length,
    missing_shot_count: cutPackage.total_missing_shot_count,
  };
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: executedAt,
    },
    seedance_cut_assembly: assemblyLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });

  return success({
    schema_version: 'ai-comic-series-seedance-cut-assembly-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    executed_at: executedAt,
    dry_run: dryRun,
    status,
    output_path: outputPath,
    output_filename: outputFilename,
    concat_list_path: concatListPath,
    ffmpeg_command: ffmpegCommand,
    assembly_mode: profile.assemblyMode,
    output_profile: profile.outputProfile,
    source_episode_no: request.episode_no,
    source_shot_count: shots.length,
    missing_shot_count: cutPackage.total_missing_shot_count,
    failure_reason: failureReason,
    seedance_cut_assembly: assemblyLedger,
  });
}

export async function exportAiComicSeriesSeedanceRetryPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceRetryPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const ledger = normalizeSeedanceProductionLedger(detail.seedance_production);
  const ledgerMap = new Map(ledger.items.map(item => [item.production_id, item]));
  const reviewIssuesByProductionId = seedanceRetryReviewIssuesByProductionId(detail);
  const exportedAt = new Date().toISOString();
  const retryEpisodes: AiComicSeedanceRetryPackageEpisode[] = [];
  const promptKeys = new Set<string>();

  for (const episode of detail.plan.episodes) {
    const storyId = detail.generated_episode_story_ids[String(episode.episode_no)];
    if (!storyId) continue;
    const storyResult = await getStory(storyId);
    if (!storyResult.ok || !storyResult.data) continue;
    const promptPackage = buildSeedancePromptPackage(storyResult.data);
    const shots = promptPackage.shot_units
      .map(unit => {
        const productionId = seedanceProductionId(episode.episode_no, unit.shot_id);
        promptKeys.add(productionId);
        const item = ledgerMap.get(productionId);
        const reviewIssues = reviewIssuesByProductionId.get(productionId) ?? [];
        if (!shouldRetrySeedanceProductionItem(item) && reviewIssues.length === 0) return null;
        return {
          production_id: productionId,
          episode_no: episode.episode_no,
          episode_title: episode.title,
          story_id: storyId,
          shot_id: unit.shot_id,
          source_scene_id: unit.source_scene_id,
          status: item?.status ?? 'not_started',
          retry_count: item?.retry_count ?? 0,
          failure_reason: item?.failure_reason,
          provider_job_id: item?.provider_job_id,
          last_video_url: item?.video_url,
          retry_reason: reviewIssues.length > 0 ? 'review_required' : 'production_status',
          review_issues: reviewIssues.length > 0 ? reviewIssues : undefined,
          suggested_action: seedanceRetrySuggestedAction(item, reviewIssues),
          prompt: unit,
        } satisfies AiComicSeedanceRetryPackageShot;
      })
      .filter((shot): shot is NonNullable<typeof shot> => Boolean(shot));
    if (shots.length > 0) {
      retryEpisodes.push({
        episode_no: episode.episode_no,
        episode_title: episode.title,
        story_id: storyId,
        retry_shot_count: shots.length,
        shots,
      });
    }
  }

  const missingPromptShots = ledger.items
    .filter(item => shouldRetrySeedanceProductionItem(item) || (reviewIssuesByProductionId.get(item.production_id)?.length ?? 0) > 0)
    .filter(item => !promptKeys.has(item.production_id))
    .map(item => ({
      episode_no: item.episode_no,
      episode_title: item.episode_title,
      shot_id: item.shot_id,
      reason: '账本中存在待处理镜头，但当前已生成 Seedance 提示词包中找不到对应镜头',
    }));
  const basePackage: Omit<AiComicSeriesSeedanceRetryPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-retry-package/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    total_retry_shot_count: retryEpisodes.reduce((sum, episode) => sum + episode.retry_shot_count, 0),
    review_required_shot_count: retryEpisodes.reduce((sum, episode) =>
      sum + episode.shots.filter(shot => shot.retry_reason === 'review_required').length,
    0),
    episodes: retryEpisodes,
    skipped_ready_shot_count: ledger.items.filter(item =>
      item.status === 'ready'
      && Boolean(item.video_url)
      && (reviewIssuesByProductionId.get(item.production_id)?.length ?? 0) === 0
    ).length,
    missing_prompt_shots: missingPromptShots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceRetryMarkdown(basePackage),
  });
}

export async function exportAiComicSeriesSeedanceRetryExecutionPlan(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceRetryExecutionPlan>> {
  const retryPackageRes = await exportAiComicSeriesSeedanceRetryPackage(seriesProjectId);
  if (!retryPackageRes.ok || !retryPackageRes.data) {
    return fail(
      normalizeErrorCode(retryPackageRes.error?.code),
      retryPackageRes.error?.message ?? 'Export Seedance retry package failed',
      retryPackageRes.error?.details,
    );
  }

  const retryPackage = retryPackageRes.data;
  const exportedAt = new Date().toISOString();
  const episodes: AiComicSeedanceRetryExecutionEpisode[] = retryPackage.episodes.map(episode => {
    const candidates = episode.shots
      .map(shot => buildSeedanceRetryExecutionCandidate(shot))
      .sort(seedanceRetryExecutionCandidateSort);
    return {
      episode_no: episode.episode_no,
      episode_title: episode.episode_title,
      story_id: episode.story_id,
      candidate_count: candidates.length,
      ready_to_submit_count: candidates.filter(candidate => candidate.can_submit).length,
      blocked_count: candidates.filter(candidate => !candidate.can_submit).length,
      candidates,
    };
  });
  const allCandidates = episodes.flatMap(episode => episode.candidates);
  const reasonCounts = seedanceRetryExecutionReasonCounts(allCandidates);
  const basePlan: Omit<AiComicSeriesSeedanceRetryExecutionPlan, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-retry-execution-plan/v1',
    project: retryPackage.project,
    series_title: retryPackage.series_title,
    exported_at: exportedAt,
    source_retry_package_exported_at: retryPackage.exported_at,
    total_retry_shot_count: retryPackage.total_retry_shot_count,
    ready_to_submit_count: allCandidates.filter(candidate => candidate.can_submit).length,
    blocked_count: allCandidates.filter(candidate => !candidate.can_submit).length,
    high_priority_count: allCandidates.filter(candidate => candidate.priority === 'high').length,
    review_required_shot_count: retryPackage.review_required_shot_count,
    missing_prompt_shot_count: retryPackage.missing_prompt_shots.length,
    reason_counts: reasonCounts,
    episodes,
    missing_prompt_shots: retryPackage.missing_prompt_shots,
  };
  return success({
    ...basePlan,
    markdown: buildAiComicSeriesSeedanceRetryExecutionMarkdown(basePlan),
  });
}

function normalizeAiComicSeriesSeedanceExternalCallAuthorization(
  input: ExternalProviderCallAuthorizationRequest | undefined,
  confirmedAt: string,
): ApiResponse<ExternalProviderCallAuthorizationRecord> {
  if (!input || input.authorized !== true) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'external_call_authorization.authorized=true is required before Seedance provider submission',
    );
  }
  const authorizationReference = input.authorization_reference?.trim();
  if (!authorizationReference) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'external_call_authorization.authorization_reference is required before Seedance provider submission',
    );
  }
  if (!Number.isFinite(input.max_cost_amount) || input.max_cost_amount < 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'external_call_authorization.max_cost_amount must be a non-negative finite number',
    );
  }
  const currency = input.cost_currency?.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'external_call_authorization.cost_currency must be a 3-letter currency code',
    );
  }
  if (input.data_transfer_acknowledged !== true) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'external_call_authorization.data_transfer_acknowledged=true is required before Seedance provider submission',
    );
  }
  return success({
    authorized: true,
    authorization_reference: authorizationReference,
    max_cost_amount: input.max_cost_amount,
    cost_currency: currency,
    data_transfer_acknowledged: true,
    confirmed_at: confirmedAt,
  });
}

export async function submitAiComicSeriesSeedanceRetryExecutionPlan(
  seriesProjectId: string,
  request: AiComicSeedanceRetrySubmitRequest = {},
): Promise<ApiResponse<AiComicSeriesSeedanceRetrySubmitResult>> {
  const executionPlanRes = await exportAiComicSeriesSeedanceRetryExecutionPlan(seriesProjectId);
  if (!executionPlanRes.ok || !executionPlanRes.data) {
    return fail(
      normalizeErrorCode(executionPlanRes.error?.code),
      executionPlanRes.error?.message ?? 'Export Seedance retry execution plan failed',
      executionPlanRes.error?.details,
    );
  }

  const executionPlan = executionPlanRes.data;
  const allSubmitCandidates = executionPlan.episodes
    .flatMap(episode => episode.candidates)
    .filter(candidate => candidate.can_submit);
  const selectedCandidates = allSubmitCandidates.slice(0, request.limit);
  const submittedAt = new Date().toISOString();
  if (selectedCandidates.length === 0) {
    const emptyResult: Omit<AiComicSeriesSeedanceRetrySubmitResult, 'markdown'> = {
      schema_version: 'ai-comic-series-seedance-retry-submit-result/v1',
      project: executionPlan.project,
      series_title: executionPlan.series_title,
      submitted_at: submittedAt,
      retry_execution_plan: executionPlan,
      selected_shot_ids: [],
      submitted_count: 0,
      skipped_blocked_count: executionPlan.blocked_count,
      skipped_due_to_limit_count: 0,
      failed_count: 0,
      submitted_shots: [],
    };
    return success({
      ...emptyResult,
      markdown: buildAiComicSeriesSeedanceRetrySubmitMarkdown(emptyResult),
    });
  }

  const jobPrefix = slugifyConstraintKey(request.job_prefix?.trim() || `series-retry-${seriesProjectId}`).slice(0, 60);
  const retrySubmitCandidates: AiComicSeriesRetrySubmitCandidate[] = selectedCandidates.map((candidate, index) => ({
    candidate,
    local_provider_job_id: seedanceRetrySubmitProviderJobId(jobPrefix, candidate, index, submittedAt),
    queue_position: index + 1,
  }));
  let providerAdapterSummary: SeedanceShotProviderSubmitAdapterSummary | undefined;
  let providerFailures: SeedanceShotProviderSubmitFailure[] = [];
  let externalCallAuthorization: ExternalProviderCallAuthorizationRecord | undefined;
  let acceptedSubmissions: AiComicSeriesRetrySubmitAcceptedItem[] = retrySubmitCandidates.map(item => ({
    candidate: item.candidate,
    provider_job_id: item.local_provider_job_id,
    provider_queue_position: item.queue_position,
    status: 'submitted',
  }));

  if (request.use_provider_adapter) {
    const authorization = normalizeAiComicSeriesSeedanceExternalCallAuthorization(
      request.external_call_authorization,
      submittedAt,
    );
    if (!authorization.ok || !authorization.data) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        authorization.error?.message ?? 'external_call_authorization is required before Seedance provider submission',
        authorization.error?.details,
      );
    }
    externalCallAuthorization = authorization.data;
    const detail = await readSeriesProject(seriesProjectId);
    if (!detail) {
      return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
    }
    const visualProductionGate = aiComicSeriesVisualProductionGate(detail);
    if (!visualProductionGate.assetsReady) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `视觉资产生产门禁未通过，禁止向外部 Seedance 提交：${visualProductionGate.detail}`,
        {
          visual_bible: visualProductionGate.visualBible,
          identity_total: visualProductionGate.identityTotal,
          world_rule_total: visualProductionGate.worldRuleTotal,
          pilot_bindings_ready: visualProductionGate.pilotBindingsReady,
        },
      );
    }
    const adapterRes = await queryAiComicSeriesSeedanceRetrySubmitAdapter({
      seriesProjectId,
      executionPlan,
      submittedAt,
      note: request.note,
      externalCallAuthorization,
      candidates: retrySubmitCandidates,
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
    providerFailures = adapterRes.data.failures;
    providerAdapterSummary = adapterRes.data.summary;
  }

  let resultProject = executionPlan.project;
  let resultSeriesTitle = executionPlan.series_title;
  let seedanceProduction: AiComicSeedanceProductionLedger | undefined;
  const updatedItemsByProductionId = new Map<string, AiComicSeedanceShotProductionItem>();
  if (acceptedSubmissions.length > 0) {
    const updateRes = await updateAiComicSeriesSeedanceProductionStatuses(seriesProjectId, {
      updates: acceptedSubmissions.map(accepted => ({
        episode_no: accepted.candidate.episode_no,
        shot_id: accepted.candidate.shot_id,
        status: accepted.status,
        provider_job_id: accepted.provider_job_id,
        increment_retry: accepted.candidate.status !== 'not_started' && accepted.candidate.status !== 'prompt_exported',
        note: request.note ?? `Seedance 重试执行计划提交：${accepted.candidate.suggested_action}`,
      })),
    }, {
      externalCallAuthorization,
    });
    if (!updateRes.ok || !updateRes.data) {
      return fail(
        normalizeErrorCode(updateRes.error?.code),
        updateRes.error?.message ?? 'Submit Seedance retry execution plan failed',
        updateRes.error?.details,
      );
    }
    resultProject = updateRes.data.project;
    resultSeriesTitle = updateRes.data.plan.series_title;
    seedanceProduction = updateRes.data.seedance_production;
    for (const item of updateRes.data.seedance_production?.items ?? []) {
      updatedItemsByProductionId.set(item.production_id, item);
    }
  }

  const submittedShots: AiComicSeedanceRetrySubmitShot[] = acceptedSubmissions.map(accepted => {
    const updated = updatedItemsByProductionId.get(accepted.candidate.production_id);
    return {
      production_id: accepted.candidate.production_id,
      episode_no: accepted.candidate.episode_no,
      shot_id: accepted.candidate.shot_id,
      provider_job_id: accepted.provider_job_id,
      provider_queue_id: accepted.provider_queue_id,
      provider_queue_position: accepted.provider_queue_position,
      status: accepted.status,
      retry_count: updated?.retry_count ?? accepted.candidate.retry_count,
      retry_reason: accepted.candidate.retry_reason,
    };
  });
  const result: Omit<AiComicSeriesSeedanceRetrySubmitResult, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-retry-submit-result/v1',
    project: resultProject,
    series_title: resultSeriesTitle,
    submitted_at: submittedAt,
    retry_execution_plan: executionPlan,
    selected_shot_ids: selectedCandidates.map(candidate => candidate.shot_id),
    submitted_count: submittedShots.length,
    skipped_blocked_count: executionPlan.blocked_count,
    skipped_due_to_limit_count: Math.max(0, allSubmitCandidates.length - selectedCandidates.length),
    failed_count: providerFailures.length,
    provider_adapter: providerAdapterSummary,
    external_call_authorization: externalCallAuthorization,
    provider_failures: providerFailures.length > 0 ? providerFailures : undefined,
    submitted_shots: submittedShots,
    seedance_production: seedanceProduction,
  };
  return success({
    ...result,
    markdown: buildAiComicSeriesSeedanceRetrySubmitMarkdown(result),
  });
}

function aiComicGearsSeedanceStatus(status: GearsJobLedgerItem['status']): AiComicSeedanceProductionStatus {
  if (status === 'ready') return 'ready';
  if (status === 'failed' || status === 'rejected' || status === 'canceled') return 'failed';
  if (status === 'processing') return 'processing';
  return 'submitted';
}

function aiComicSeriesGearsPostProductionLedgers(detail: AiComicSeriesProjectDetail): Pick<
  AiComicSeriesGearsJobCallbackResult,
  'seedance_subtitle_render' | 'seedance_audio_mix' | 'seedance_title_card_render' | 'seedance_final_delivery'
> {
  return {
    seedance_subtitle_render: detail.seedance_subtitle_render,
    seedance_audio_mix: detail.seedance_audio_mix,
    seedance_title_card_render: detail.seedance_title_card_render,
    seedance_final_delivery: detail.seedance_final_delivery,
  };
}

function aiComicGearsExistingJob(
  ledger: GearsJobLedger | undefined,
  jobType: GearsExecutionJobType,
  sourceUnitId: string,
): GearsJobLedgerItem | undefined {
  return normalizeGearsJobLedger(ledger).items.find(item =>
    item.job_type === jobType && item.source_unit_id === sourceUnitId
  );
}

function aiComicGearsJobIsActive(item: GearsJobLedgerItem | undefined): boolean {
  if (!item) return false;
  return !['failed', 'rejected', 'canceled'].includes(item.status);
}

function aiComicSeriesGearsJobTypeLabel(jobType: GearsExecutionJobType): string {
  const labels: Record<GearsExecutionJobType, string> = {
    storyboard_image: '故事板图',
    character_image: '人物图',
    scene_image: '场景图',
    prop_image: '道具图',
    seedance_video: '视频返修/重试',
    subtitle_render: '字幕渲染',
    audio_mix: '混音',
    title_card_render: '片头片尾',
    final_assemble: '最终装配',
  };
  return labels[jobType];
}

function aiComicSeriesGearsSubmitIntent(jobType: GearsExecutionJobType): string {
  const intents: Record<GearsExecutionJobType, string> = {
    storyboard_image: '从分集 GEARS delivery 提交 GEARS v2 故事板图片任务',
    character_image: '从分集 GEARS delivery 人物资产提交 GEARS v2 人物图片任务',
    scene_image: '从分集 GEARS delivery 场景资产提交 GEARS v2 场景图片任务',
    prop_image: '从分集制作资产提交 GEARS v2 道具参考图片任务',
    seedance_video: '从 AI 漫剧 Seedance 重试执行计划提交 GEARS v2 视频返修/重试任务',
    subtitle_render: '从字幕包提交 GEARS v2 字幕渲染任务',
    audio_mix: '从音频计划提交 GEARS v2 混音任务',
    title_card_render: '从片头片尾计划提交 GEARS v2 片头片尾渲染任务',
    final_assemble: '从最终交付依赖合同提交 GEARS v2 最终装配任务',
  };
  return intents[jobType];
}

function aiComicSeriesGearsFailureLabel(failure: GearsJobSubmitFailure): string {
  return [
    failure.path,
    failure.source_unit_id ?? `#${failure.index + 1}`,
    failure.gears_job_id,
  ].filter(Boolean).join(' / ');
}

function buildAiComicSeriesGearsSubmitMarkdown(input: Omit<AiComicSeriesGearsJobSubmitResult, 'markdown'>): string {
  return [
    `# ${input.series_title} - GEARS job submit`,
    '',
    `- job_type: ${input.job_type}`,
    `- job_type_label: ${input.job_type_label}`,
    `- submit_intent: ${input.submit_intent}`,
    `- submitted_at: ${input.submitted_at}`,
    `- submitted_count: ${input.submitted_count}`,
    `- skipped_count: ${input.skipped_count}`,
    `- failed_count: ${input.failed_count}`,
    '',
    ...(input.provider_adapter ? [
      '## GEARS Adapter',
      '',
      `- status: ${input.provider_adapter.status}`,
      `- endpoint_configured: ${input.provider_adapter.endpoint_configured}`,
      `- requested_count: ${input.provider_adapter.requested_count}`,
      `- accepted_count: ${input.provider_adapter.accepted_count}`,
      `- rejected_count: ${input.provider_adapter.rejected_count}`,
      '',
    ] : []),
    '## Submitted Jobs',
    '',
    ...(input.submitted_jobs.length
      ? input.submitted_jobs.map(job =>
        `- ${job.source_unit_id}: ${job.job_type} / ${job.status} / ${job.gears_job_id}`
      )
      : ['- none']),
    ...(input.failures.length ? [
      '',
      '## Failures',
      '',
      ...input.failures.map(failure =>
        `- ${aiComicSeriesGearsFailureLabel(failure)}: ${failure.message}`
      ),
    ] : []),
  ].join('\n');
}

function buildAiComicSeriesGearsSyncMarkdown(input: Omit<AiComicSeriesGearsJobStatusSyncResult, 'markdown'>): string {
  return [
    `# ${input.series_title} - GEARS job sync`,
    '',
    `- pollable_count: ${input.pollable_count}`,
    `- synced_count: ${input.synced_count}`,
    `- failed_count: ${input.failed_count}`,
    `- duplicate_count: ${input.duplicate_count}`,
    `- skipped_count: ${input.skipped_count}`,
    '',
    ...input.synced_jobs.map(job =>
      `- ${job.source_unit_id}: ${job.job_type} / ${job.status} / ${job.gears_job_id}`
    ),
  ].join('\n');
}

function aiComicSeriesGearsSyncItems(input: {
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

type AiComicSeriesGearsUnitBuildResult = {
  units: GearsExecutionSubmitUnit[];
  skippedCount: number;
  failures: GearsJobSubmitFailure[];
  candidatesByProductionId: Map<string, AiComicSeedanceRetryExecutionCandidate>;
};

async function aiComicSeriesGeneratedStoryDeliveries(
  detail: AiComicSeriesProjectDetail,
): Promise<Array<{
  episode: AiComicEpisodePlan;
  story: StoryGenerateResult;
  delivery: ReturnType<typeof ensureGearsDeliveryPackage>;
}>> {
  const entries: Array<{
    episode: AiComicEpisodePlan;
    story: StoryGenerateResult;
    delivery: ReturnType<typeof ensureGearsDeliveryPackage>;
  }> = [];
  for (const episode of [...detail.plan.episodes].sort((a, b) => a.episode_no - b.episode_no)) {
    const storyId = detail.generated_episode_story_ids[String(episode.episode_no)];
    if (!storyId) continue;
    const storyRes = await getStory(storyId);
    if (!storyRes.ok || !storyRes.data) continue;
    entries.push({
      episode,
      story: storyRes.data,
      delivery: ensureGearsDeliveryPackage(storyRes.data),
    });
  }
  return entries;
}

function aiComicSeriesGearsUnitsFromRetryPlan(input: {
  executionPlan: AiComicSeriesSeedanceRetryExecutionPlan;
  jobType: GearsExecutionJobType;
  request: GearsJobSubmitRequest;
}): AiComicSeriesGearsUnitBuildResult {
  const requestedIds = new Set([
    ...(input.request.source_unit_ids ?? []),
    ...(input.request.source_unit_id ? [input.request.source_unit_id] : []),
  ].filter(Boolean));
  const candidates = input.executionPlan.episodes
    .flatMap(episode => episode.candidates)
    .filter(candidate => candidate.can_submit);
  const candidatesByProductionId = new Map(candidates.map(candidate => [candidate.production_id, candidate]));
  const failures: GearsJobSubmitFailure[] = [];
  if (input.jobType !== 'seedance_video') {
    const sourceUnitIds = requestedIds.size
      ? [...requestedIds]
      : [`${input.executionPlan.project.series_project_id}:${input.jobType}`];
    return {
      units: sourceUnitIds.map((sourceUnitId, index) => ({
        source_unit_id: sourceUnitId,
        source_unit_label: input.jobType,
        payload: input.request.payload ?? {},
        payload_summary: input.request.note ?? input.jobType,
        local_gears_job_id: buildLocalGearsJobId(input.jobType, sourceUnitId, index),
      })),
      skippedCount: 0,
      failures,
      candidatesByProductionId,
    };
  }

  const selectedCandidates = candidates.filter(candidate =>
    !requestedIds.size
    || requestedIds.has(candidate.production_id)
    || requestedIds.has(candidate.shot_id)
  );
  if (requestedIds.size) {
    [...requestedIds].forEach((sourceUnitId, index) => {
      const found = selectedCandidates.some(candidate =>
        candidate.production_id === sourceUnitId || candidate.shot_id === sourceUnitId
      );
      if (found) return;
      failures.push({
        index,
        source_unit_id: sourceUnitId,
        message: `GEARS series source unit "${sourceUnitId}" was not found in retry execution plan`,
      });
    });
  }
  return {
    units: selectedCandidates.map((candidate, index) => ({
      source_unit_id: candidate.production_id,
      source_unit_label: `E${candidate.episode_no} ${candidate.shot_id}`,
      source_scene_id: candidate.source_scene_id,
      payload_summary: `${candidate.episode_title} ${candidate.shot_id}`,
      payload: {
        schema_version: 'gears-series-seedance-video-retry-payload/v1',
        series_project_id: input.executionPlan.project.series_project_id,
        series_title: input.executionPlan.series_title,
        source_retry_execution_plan_exported_at: input.executionPlan.exported_at,
        source_retry_package_exported_at: input.executionPlan.source_retry_package_exported_at,
        production_id: candidate.production_id,
        episode_no: candidate.episode_no,
        episode_title: candidate.episode_title,
        story_id: candidate.story_id,
        shot_id: candidate.shot_id,
        source_scene_id: candidate.source_scene_id,
        status: candidate.status,
        retry_count: candidate.retry_count,
        retry_reason: candidate.retry_reason,
        priority: candidate.priority,
        suggested_action: candidate.suggested_action,
        failure_reason: candidate.failure_reason,
        previous_provider_job_id: candidate.provider_job_id,
        last_video_url: candidate.last_video_url,
        review_issues: candidate.review_issues,
        duration_sec: candidate.prompt.duration_sec,
        characters: candidate.prompt.characters,
        location: candidate.prompt.location,
        script_text: candidate.prompt.script_text,
        visual_prompt: candidate.prompt.visual_prompt,
        camera_suggestion: candidate.prompt.camera_suggestion,
        continuity_notes: candidate.prompt.continuity_notes,
        negative_constraints: candidate.prompt.negative_constraints,
        asset_slots: candidate.prompt.asset_slots,
        material_validation: candidate.prompt.material_validation,
        seedance_prompt: candidate.prompt.seedance_prompt,
        request_payload: input.request.payload ?? {},
      },
      local_gears_job_id: buildLocalGearsJobId(input.jobType, candidate.production_id, index),
    })),
    skippedCount: 0,
    failures,
    candidatesByProductionId,
  };
}

async function aiComicSeriesGearsUnitsFromPostProduction(input: {
  detail: AiComicSeriesProjectDetail;
  jobType: GearsExecutionJobType;
  request: GearsJobSubmitRequest;
}): Promise<ApiResponse<AiComicSeriesGearsUnitBuildResult>> {
  const requestedIds = new Set([
    ...(input.request.source_unit_ids ?? []),
    ...(input.request.source_unit_id ? [input.request.source_unit_id] : []),
  ].filter(Boolean));
  const failures: GearsJobSubmitFailure[] = [];
  const units: GearsExecutionSubmitUnit[] = [];
  const availableIds = new Set<string>();
  const addUnit = (
    unit: Omit<GearsExecutionSubmitUnit, 'local_gears_job_id'>,
    aliases: string[] = [],
  ): void => {
    const ids = [unit.source_unit_id, ...aliases].filter(Boolean);
    ids.forEach(id => availableIds.add(id));
    if (requestedIds.size && !ids.some(id => requestedIds.has(id))) return;
    units.push({
      ...unit,
      local_gears_job_id: buildLocalGearsJobId(input.jobType, unit.source_unit_id, units.length),
    });
  };
  const seriesProjectId = input.detail.project.series_project_id;
  const requestPayload = input.request.payload ?? {};

  if (input.jobType === 'storyboard_image') {
    const entries = await aiComicSeriesGeneratedStoryDeliveries(input.detail);
    entries.forEach(({ episode, story, delivery }) => {
      delivery.units.forEach(unit => addUnit({
        source_unit_id: `episode:${episode.episode_no}:storyboard:${unit.unit_id}`,
        source_unit_label: `E${episode.episode_no} ${unit.scene_name}`,
        source_scene_id: unit.source_scene_id,
        payload_summary: summarizeText(`${story.title} ${unit.scene_name} ${unit.script_text}`, 160),
        payload: {
          schema_version: 'gears-series-storyboard-image-payload/v1',
          episode_no: episode.episode_no,
          episode_title: episode.title,
          story_id: story.storyId,
          unit,
          character_assets: delivery.character_assets.filter(character => unit.character_names.includes(character.name)),
          scene_assets: delivery.scene_assets,
          validation_notes: delivery.validation_notes,
          request_payload: requestPayload,
        },
      }, [
        unit.unit_id,
        `${episode.episode_no}:${unit.unit_id}`,
        `storyboard:${unit.unit_id}`,
      ]));
    });
    if (!entries.length && !requestedIds.size) {
      failures.push({ index: 0, message: 'No generated episode stories found for GEARS storyboard image jobs' });
    }
  } else if (input.jobType === 'character_image') {
    const entries = await aiComicSeriesGeneratedStoryDeliveries(input.detail);
    entries.forEach(({ episode, story, delivery }) => {
      delivery.character_assets.forEach(character => addUnit({
        source_unit_id: `episode:${episode.episode_no}:character:${character.name}`,
        source_unit_label: `E${episode.episode_no} ${character.name}`,
        payload_summary: summarizeText(`${character.name} ${character.appearance_features} ${character.clothing}`, 160),
        payload: {
          schema_version: 'gears-series-character-image-payload/v1',
          episode_no: episode.episode_no,
          episode_title: episode.title,
          story_id: story.storyId,
          story_title: story.title,
          character,
          character_gender_summary: delivery.character_gender_summary,
          request_payload: requestPayload,
        },
      }, [
        character.name,
        `character:${character.name}`,
        `${episode.episode_no}:${character.name}`,
      ]));
    });
    if (!entries.length && !requestedIds.size) {
      failures.push({ index: 0, message: 'No generated episode stories found for GEARS character image jobs' });
    }
  } else if (input.jobType === 'scene_image') {
    const entries = await aiComicSeriesGeneratedStoryDeliveries(input.detail);
    entries.forEach(({ episode, story, delivery }) => {
      const seedancePackage = buildSeedancePromptPackage(story);
      const scenesByName = new Map(delivery.scene_assets.map(scene => [scene.name, scene]));
      delivery.units.forEach(unit => {
        if (scenesByName.has(unit.scene_name)) return;
        const sourceScene = story.scene_breakdown.find(scene => scene.scene_id === unit.source_scene_id);
        scenesByName.set(unit.scene_name, {
          name: unit.scene_name,
          scene_type: '不限',
          description: unit.visual_prompt
            ?? sourceScene?.visual_prompt
            ?? sourceScene?.plot
            ?? unit.script_text,
          environment_props: sourceScene?.key_action,
          atmosphere: '中性',
        });
      });
      seedancePackage.shot_units.forEach(unit => {
        if (!unit.location || unit.location === '未指定场景' || scenesByName.has(unit.location)) return;
        const sourceScene = story.scene_breakdown.find(scene => scene.scene_id === unit.source_scene_id);
        scenesByName.set(unit.location, {
          name: unit.location,
          scene_type: '不限',
          description: unit.visual_prompt
            || sourceScene?.visual_prompt
            || sourceScene?.plot
            || unit.script_text,
          environment_props: sourceScene?.key_action,
          atmosphere: '中性',
        });
      });
      [...scenesByName.values()].forEach(scene => addUnit({
        source_unit_id: `episode:${episode.episode_no}:scene:${scene.name}`,
        source_unit_label: `E${episode.episode_no} ${scene.name}`,
        payload_summary: summarizeText(`${scene.name} ${scene.description}`, 160),
        payload: {
          schema_version: 'gears-series-scene-image-payload/v1',
          episode_no: episode.episode_no,
          episode_title: episode.title,
          story_id: story.storyId,
          story_title: story.title,
          scene,
          related_delivery_units: delivery.units.filter(unit => (
            unit.scene_name === scene.name
            || seedancePackage.shot_units.some(shot => (
              shot.location === scene.name && shot.source_scene_id === unit.source_scene_id
            ))
          )),
          request_payload: requestPayload,
        },
      }, [
        scene.name,
        `scene:${scene.name}`,
        `${episode.episode_no}:${scene.name}`,
      ]));
    });
    if (!entries.length && !requestedIds.size) {
      failures.push({ index: 0, message: 'No generated episode stories found for GEARS scene image jobs' });
    }
  } else if (input.jobType === 'prop_image') {
    const entries = await aiComicSeriesGeneratedStoryDeliveries(input.detail);
    entries.forEach(({ episode, story }) => {
      const board = buildStoryProductionBoard(story);
      board.image_asset_job_plan.requirements
        .filter(requirement => requirement.asset_kind === 'prop')
        .forEach(requirement => addUnit({
          source_unit_id: `episode:${episode.episode_no}:${requirement.source_unit_id}`,
          source_unit_label: `E${episode.episode_no} ${requirement.label}`,
          source_scene_id: requirement.source_scene_ids[0],
          payload_summary: summarizeText(`${requirement.label} ${requirement.prompt}`, 160),
          payload: {
            schema_version: 'gears-series-prop-image-payload/v1',
            episode_no: episode.episode_no,
            episode_title: episode.title,
            story_id: story.storyId,
            story_title: story.title,
            requirement,
            request_payload: requestPayload,
          },
        }, [
          requirement.source_unit_id,
          `${episode.episode_no}:${requirement.source_unit_id}`,
          `prop:${requirement.label}`,
        ]));
    });
    if (!entries.length && !requestedIds.size) {
      failures.push({ index: 0, message: 'No generated episode stories found for GEARS prop image jobs' });
    }
  } else if (input.jobType === 'subtitle_render') {
    const packageRes = await exportAiComicSeriesSeedanceSubtitlePackage(seriesProjectId);
    if (!packageRes.ok || !packageRes.data) {
      return fail(
        normalizeErrorCode(packageRes.error?.code),
        packageRes.error?.message ?? 'Export Seedance subtitle package failed',
        packageRes.error?.details,
      );
    }
    const pkg = packageRes.data;
    addUnit({
      source_unit_id: 'subtitle:series',
      source_unit_label: '全系列字幕渲染',
      payload_summary: `${pkg.cue_count} cues / ${pkg.srt_path}`,
      payload: {
        schema_version: 'gears-subtitle-render-payload/v1',
        subtitle_package: {
          ...pkg,
          markdown: undefined,
        },
        render_intent: {
          mode: 'sidecar',
          output_path: pkg.srt_path,
          source_cut_output_path: input.detail.seedance_cut_assembly?.output_path,
        },
        request_payload: requestPayload,
      },
    }, ['subtitle_render', pkg.srt_path]);
  } else if (input.jobType === 'audio_mix') {
    const packageRes = await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId);
    if (!packageRes.ok || !packageRes.data) {
      return fail(
        normalizeErrorCode(packageRes.error?.code),
        packageRes.error?.message ?? 'Export Seedance audio plan failed',
        packageRes.error?.details,
      );
    }
    const pkg = packageRes.data;
    addUnit({
      source_unit_id: 'audio_mix:series',
      source_unit_label: '全系列混音',
      payload_summary: `${pkg.total_audio_cue_count} cues / missing ${pkg.missing_audio_count}`,
      payload: {
        schema_version: 'gears-audio-mix-payload/v1',
        audio_plan: {
          ...pkg,
          markdown: undefined,
        },
        mix_intent: {
          audio_profile: input.detail.seedance_audio_mix?.audio_profile ?? 'balanced_dialogue',
          input_video_path: input.detail.seedance_cut_assembly?.output_path,
          include_original_audio: input.detail.seedance_audio_mix?.include_original_audio ?? true,
          original_audio_volume_db: input.detail.seedance_audio_mix?.original_audio_volume_db ?? -8,
        },
        request_payload: requestPayload,
      },
    }, ['audio_mix', pkg.audio_root]);
  } else if (input.jobType === 'title_card_render') {
    const packageRes = await exportAiComicSeriesSeedanceTitleCardPlanPackage(seriesProjectId);
    if (!packageRes.ok || !packageRes.data) {
      return fail(
        normalizeErrorCode(packageRes.error?.code),
        packageRes.error?.message ?? 'Export Seedance title card plan failed',
        packageRes.error?.details,
      );
    }
    const pkg = packageRes.data;
    pkg.cards.forEach(card => addUnit({
      source_unit_id: `title_card:${card.card_id}`,
      source_unit_label: `${card.placement}${card.episode_no ? ` E${card.episode_no}` : ''}`,
      payload_summary: `${card.card_id} / ${card.output_path}`,
      payload: {
        schema_version: 'gears-title-card-render-payload/v1',
        title_card_root: pkg.title_card_root,
        output_profile: input.detail.seedance_title_card_render?.output_profile ?? 'mp4_h264_1080p',
        card,
        request_payload: requestPayload,
      },
    }, [
      card.card_id,
      card.output_path,
      `${card.placement}${card.episode_no ? `:e${card.episode_no}` : ''}`,
    ]));
  } else if (input.jobType === 'final_assemble') {
    const outputProfile: AiComicSeedanceFinalDeliveryOutputProfile =
      input.detail.seedance_final_delivery?.output_profile ?? 'mp4_h264_1080p';
    const outputFilename = input.detail.seedance_final_delivery?.output_filename
      ?? seedanceFinalDeliveryFilename(seriesProjectId);
    const outputPath = input.detail.seedance_final_delivery?.output_path
      ?? `delivery/${seriesProjectId}/${outputFilename}`;
    const manifestPath = input.detail.seedance_final_delivery?.manifest_path
      ?? `delivery/${seriesProjectId}/${seedanceFinalDeliveryManifestFilename(outputFilename)}`;
    const concatListPath = `delivery/${seriesProjectId}/${outputFilename.replace(/\.mp4$/i, '.concat.txt')}`;
    const dependencyStatus = resolveSeedanceFinalDependencyStatus(input.detail, {
      dryRun: true,
      includeSubtitles: true,
      includeAudioMix: true,
      includeTitleCards: true,
    });
    const concatInputs = [
      ...dependencyStatus.title_card_paths,
      dependencyStatus.source_cut_path,
    ].filter((item): item is string => Boolean(item));
    const useConcat = concatInputs.length > 1;
    const ffmpegCommand = dependencyStatus.source_cut_path
      ? buildFfmpegFinalDeliveryCommand(
        process.env.FFMPEG_PATH?.trim() || 'ffmpeg',
        useConcat ? concatListPath : dependencyStatus.source_cut_path,
        outputPath,
        outputProfile,
        useConcat,
      )
      : '';
    addUnit({
      source_unit_id: 'final_assemble:series',
      source_unit_label: '全系列最终装配',
      payload_summary: `${outputFilename} / missing ${dependencyStatus.missing_dependencies.length}`,
      payload: {
        schema_version: 'gears-final-assemble-payload/v1',
        output_profile: outputProfile,
        output_path: outputPath,
        output_filename: outputFilename,
        manifest_path: manifestPath,
        concat_list_path: useConcat ? concatListPath : undefined,
        ffmpeg_command_hint: ffmpegCommand,
        dependency_status: dependencyStatus,
        request_payload: requestPayload,
      },
    }, ['final_assemble', outputPath, manifestPath]);
  } else {
    const sourceUnitIds = requestedIds.size ? [...requestedIds] : [`${seriesProjectId}:${input.jobType}`];
    sourceUnitIds.forEach(sourceUnitId => addUnit({
      source_unit_id: sourceUnitId,
      source_unit_label: input.jobType,
      payload: requestPayload,
      payload_summary: input.request.note ?? input.jobType,
    }));
  }

  if (requestedIds.size) {
    [...requestedIds].forEach((sourceUnitId, index) => {
      if (availableIds.has(sourceUnitId)) return;
      failures.push({
        index,
        source_unit_id: sourceUnitId,
        message: `GEARS series source unit "${sourceUnitId}" was not found for job_type "${input.jobType}"`,
      });
    });
  }

  return success({
    units,
    skippedCount: 0,
    failures,
    candidatesByProductionId: new Map<string, AiComicSeedanceRetryExecutionCandidate>(),
  });
}

function aiComicSeriesVisualProductionGate(detail: AiComicSeriesProjectDetail) {
  const visualBible = buildAiComicSeriesVisualBible({
    plan: detail.plan,
    ledger: detail.continuity_ledger,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids,
    assetLibrary: detail.seedance_asset_library,
    previousVisualBible: detail.visual_bible,
  });
  const identityTotal = visualBible.identities.length;
  const worldRuleTotal = visualBible.world_rules.length;
  const pilotBindingsReady = visualBible.blocker_count === 0;
  const definitionsReady = (
    identityTotal > 0
    && visualBible.ready_identity_count === identityTotal
    && visualBible.ready_world_rule_count === worldRuleTotal
    && pilotBindingsReady
  );
  const approvalsReady = (
    definitionsReady
    && visualBible.approved_identity_count === identityTotal
    && visualBible.approved_world_rule_count === worldRuleTotal
  );
  const assetsReady = (
    approvalsReady
    && visualBible.production_credit_identity_count === identityTotal
  );
  const issues: string[] = [];
  if (identityTotal === 0) issues.push('尚未建立任何稳定视觉身份');
  if (visualBible.ready_identity_count < identityTotal) {
    issues.push(`视觉身份定义完整 ${visualBible.ready_identity_count}/${identityTotal}`);
  }
  if (visualBible.ready_world_rule_count < worldRuleTotal) {
    issues.push(`世界规则视觉映射完整 ${visualBible.ready_world_rule_count}/${worldRuleTotal}`);
  }
  if (!pilotBindingsReady) {
    issues.push(`试拍集的身份或世界规则视觉绑定仍有 ${visualBible.blocker_count} 项阻断`);
  }
  if (visualBible.approved_identity_count < identityTotal) {
    issues.push(`视觉身份真人批准 ${visualBible.approved_identity_count}/${identityTotal}`);
  }
  if (visualBible.approved_world_rule_count < worldRuleTotal) {
    issues.push(`世界规则真人批准 ${visualBible.approved_world_rule_count}/${worldRuleTotal}`);
  }
  if (visualBible.production_credit_identity_count < identityTotal) {
    issues.push(`具备真实文件、授权、真人审核和当前映射的身份 ${visualBible.production_credit_identity_count}/${identityTotal}`);
  }
  return {
    visualBible,
    identityTotal,
    worldRuleTotal,
    pilotBindingsReady,
    definitionsReady,
    approvalsReady,
    assetsReady,
    issues,
    detail: issues.length ? issues.join('；') : '四类稳定身份、世界规则和真实资产链均已通过。',
  };
}

export async function submitAiComicSeriesGearsJobs(
  seriesProjectId: string,
  request: GearsJobSubmitRequest = {},
): Promise<ApiResponse<AiComicSeriesGearsJobSubmitResult>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const jobType = request.job_type ?? 'seedance_video';
  const submittedAt = new Date().toISOString();
  const visualProductionGate = request.use_gears_api
    ? aiComicSeriesVisualProductionGate(existing)
    : undefined;
  if (request.use_gears_api && !visualProductionGate?.assetsReady) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `视觉资产生产门禁未通过，禁止向外部 GEARS 提交：${visualProductionGate?.detail ?? '未能读取视觉资产状态。'}`,
      {
        visual_bible: visualProductionGate?.visualBible,
        identity_total: visualProductionGate?.identityTotal ?? 0,
        world_rule_total: visualProductionGate?.worldRuleTotal ?? 0,
        pilot_bindings_ready: visualProductionGate?.pilotBindingsReady ?? false,
      },
    );
  }
  let built: AiComicSeriesGearsUnitBuildResult;
  if (jobType === 'seedance_video') {
    const executionPlanRes = await exportAiComicSeriesSeedanceRetryExecutionPlan(seriesProjectId);
    if (!executionPlanRes.ok || !executionPlanRes.data) {
      return fail(
        normalizeErrorCode(executionPlanRes.error?.code),
        executionPlanRes.error?.message ?? 'Export Seedance retry execution plan failed',
        executionPlanRes.error?.details,
      );
    }
    built = aiComicSeriesGearsUnitsFromRetryPlan({ executionPlan: executionPlanRes.data, jobType, request });
  } else {
    const builtRes = await aiComicSeriesGearsUnitsFromPostProduction({ detail: existing, jobType, request });
    if (!builtRes.ok || !builtRes.data) {
      return fail(
        normalizeErrorCode(builtRes.error?.code),
        builtRes.error?.message ?? 'Build GEARS post-production units failed',
        builtRes.error?.details,
      );
    }
    built = builtRes.data;
  }
  let skippedCount = built.skippedCount;
  const units = built.units.filter(unit => {
    const existingJob = aiComicGearsExistingJob(existing.gears_job_ledger, jobType, unit.source_unit_id);
    if (!aiComicGearsJobIsActive(existingJob) || request.overwrite_existing) return true;
    skippedCount += 1;
    return false;
  });
  const failures = [...built.failures];
  if (!units.length) {
    const result: Omit<AiComicSeriesGearsJobSubmitResult, 'markdown'> = {
      schema_version: 'ai-comic-series-gears-job-submit-result/v1',
      project: existing.project,
      series_title: existing.plan.series_title,
      job_type: jobType,
      job_type_label: aiComicSeriesGearsJobTypeLabel(jobType),
      submit_intent: aiComicSeriesGearsSubmitIntent(jobType),
      submitted_at: submittedAt,
      gears_job_ledger: normalizeGearsJobLedger(existing.gears_job_ledger),
      seedance_production: existing.seedance_production,
      provider_adapter: {
        endpoint_configured: false,
        requested_count: 0,
        accepted_count: 0,
        rejected_count: failures.length,
        status: request.use_gears_api ? 'submitted' : 'mocked',
      },
      submitted_count: 0,
      skipped_count: skippedCount,
      failed_count: failures.length,
      submitted_jobs: [],
      failures,
    };
    return success({ ...result, markdown: buildAiComicSeriesGearsSubmitMarkdown(result) });
  }

  let submitUnits = units;
  if (
    request.use_gears_api
    && request.external_call_authorization?.authorized === true
    && jobType === 'seedance_video'
  ) {
    const identitiesById = new Map(
      visualProductionGate?.visualBible.identities.map(identity => [identity.identity_id, identity]) ?? [],
    );
    const assets: GearsProviderAssetSource[] = normalizeSeedanceAssetLibrary(existing.seedance_asset_library).items
      .map(item => {
        const identity = item.identity_binding
          ? identitiesById.get(item.identity_binding.series_identity_id)
          : undefined;
        return {
        asset_id: item.asset_id,
        label: item.label,
        modality: 'image',
        file_url: item.file_url,
        provider: item.provider,
        provider_asset_id: item.provider_asset_id,
        content_sha256: item.content_sha256,
        rights_status: item.rights_status,
        authorization_reference: item.authorization_reference,
        human_review_status: item.human_review_status,
        reviewer_id: item.reviewer_id,
        reviewed_at: item.reviewed_at,
        production_credit_granted: aiComicSeriesAssetProductionCreditGranted(item, identity),
        };
      });
    const handoff = attachGearsProviderAssetHandoffs({ units: submitUnits, assets, verified_at: submittedAt });
    if (!handoff.ok) return fail(ErrorCodes.VALIDATION_ERROR, handoff.message, handoff.details);
    submitUnits = handoff.units;
  }

  const adapterRes = await submitGearsExecutionJobs({
    seriesProjectId,
    title: existing.plan.series_title,
    jobType,
    callbackPath: gearsSeriesCallbackPath(seriesProjectId),
    callbackUrl: request.callback_url ?? gearsSeriesCallbackUrl(seriesProjectId),
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
        seriesProjectId,
        sourceStoryId: built.candidatesByProductionId.get(unit.source_unit_id)?.story_id,
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
        seriesProjectId,
        sourceStoryId: built.candidatesByProductionId.get(unit.source_unit_id)?.story_id,
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

  let updatedDetail = existing;
  if (jobType === 'seedance_video' && ledgerJobs.length) {
    const jobsByProductionId = new Map(ledgerJobs.map(item => [item.source_unit_id, item]));
    const productionUpdates = [...jobsByProductionId.values()]
      .map(item => built.candidatesByProductionId.get(item.source_unit_id))
      .filter((candidate): candidate is AiComicSeedanceRetryExecutionCandidate => Boolean(candidate))
      .map(candidate => {
        const item = jobsByProductionId.get(candidate.production_id)!;
        return {
          episode_no: candidate.episode_no,
          shot_id: candidate.shot_id,
          status: aiComicGearsSeedanceStatus(item.status),
          provider_job_id: item.gears_job_id,
          video_url: item.status === 'ready' ? item.artifact_urls[0] : undefined,
          failure_reason: item.failure_reason,
          note: request.note ?? `GEARS job ${item.status}: ${item.gears_job_id}`,
          increment_retry: candidate.status !== 'not_started' && candidate.status !== 'prompt_exported',
        } satisfies AiComicSeedanceProductionStatusUpdateRequest;
      });
    updatedDetail = buildAiComicSeriesSeedanceProductionUpdate(
      existing,
      productionUpdates,
      submittedAt,
      { externalCallAuthorization },
    );
  }

  const gearsJobLedger = mergeGearsLedgerItems({
    existing: updatedDetail.gears_job_ledger,
    items: ledgerJobs,
    updatedAt: submittedAt,
  });
  updatedDetail = {
    ...updatedDetail,
    project: {
      ...updatedDetail.project,
      updated_at: submittedAt,
    },
    gears_job_ledger: gearsJobLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: existing.project.updated_at });
  const result: Omit<AiComicSeriesGearsJobSubmitResult, 'markdown'> = {
    schema_version: 'ai-comic-series-gears-job-submit-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    job_type: jobType,
    job_type_label: aiComicSeriesGearsJobTypeLabel(jobType),
    submit_intent: aiComicSeriesGearsSubmitIntent(jobType),
    submitted_at: submittedAt,
    gears_job_ledger: gearsJobLedger,
    seedance_production: updatedDetail.seedance_production,
    provider_adapter: adapterRes.data.summary,
    submitted_count: submittedJobs.length,
    skipped_count: skippedCount,
    failed_count: failures.length,
    submitted_jobs: submittedJobs,
    failures,
  };
  return success({ ...result, markdown: buildAiComicSeriesGearsSubmitMarkdown(result) });
}

function findAiComicSeriesGearsLedgerMatch(input: {
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
      ? `GEARS job "${input.callback.gears_job_id}" was not found in series ledger`
      : idempotencyKey
        ? `GEARS idempotency_key "${idempotencyKey}" was not found in series ledger`
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
  return `GEARS source_unit_id "${sourceUnitId}" was not found in series ledger`;
}

function updateAiComicGearsLedgerItemFromCallback(input: {
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
    series_project_id: input.callback.series_project_id ?? input.item.series_project_id,
    source_story_id: input.callback.source_story_id ?? input.item.source_story_id,
    status,
    progress_percent: progressPercent,
    artifact_urls: !ignoredNonTerminalAfterTerminal && input.callback.artifact_urls.length
      ? input.callback.artifact_urls
      : input.item.artifact_urls,
    artifacts: ignoredNonTerminalAfterTerminal ? input.item.artifacts : input.callback.artifacts ?? input.item.artifacts,
    failure_category: ignoredNonTerminalAfterTerminal ? input.item.failure_category : input.callback.failure_category,
    error_code: ignoredNonTerminalAfterTerminal ? input.item.error_code : input.callback.error_code,
    failure_reason: ignoredNonTerminalAfterTerminal ? input.item.failure_reason : input.callback.failure_reason,
    last_poll_at: undefined,
    last_poll_error: undefined,
    last_poll_failure_category: undefined,
    last_poll_error_code: undefined,
    updated_at: input.receivedAt,
    completed_at: completedAt,
    execution_cost: mergeGearsExecutionCostFromCallback(input),
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

function gearsArtifactUrlFor(
  item: GearsJobLedgerItem,
  matchers: string[],
): string | undefined {
  const normalizedMatchers = matchers.map(value => value.toLowerCase());
  const matched = item.artifacts?.find(artifact => {
    const haystack = [
      artifact.kind,
      artifact.role,
      artifact.mime_type,
      artifact.url,
    ].filter(Boolean).join(' ').toLowerCase();
    return normalizedMatchers.some(matcher => haystack.includes(matcher));
  });
  return matched?.url ?? item.artifact_urls[0];
}

function filenameFromArtifactUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const clean = url.split(/[?#]/)[0] ?? url;
  const filename = clean.split('/').filter(Boolean).pop();
  return filename || undefined;
}

function gearsCallbackIsFailedStatus(status: GearsJobLedgerItem['status']): boolean {
  return status === 'failed' || status === 'rejected' || status === 'canceled';
}

function applyAiComicSeriesGearsPostProductionCallback(input: {
  detail: AiComicSeriesProjectDetail;
  item: GearsJobLedgerItem;
  receivedAt: string;
}): AiComicSeriesProjectDetail {
  const status = input.item.status;
  const failed = gearsCallbackIsFailedStatus(status);
  const ready = status === 'ready';
  const artifactUrl = input.item.artifact_urls[0];
  const failureReason = input.item.failure_reason;
  const detailBase: AiComicSeriesProjectDetail = {
    ...input.detail,
    project: {
      ...input.detail.project,
      updated_at: input.receivedAt,
    },
  };

  if (input.item.job_type === 'subtitle_render') {
    const existing = normalizeSeedanceSubtitleRenderLedger(input.detail.seedance_subtitle_render);
    const outputPath = gearsArtifactUrlFor(input.item, ['subtitle', 'srt', 'vtt', 'burn_in', 'video']);
    return {
      ...detailBase,
      seedance_subtitle_render: {
        schema_version: 'ai-comic-seedance-subtitle-render-ledger/v1',
        updated_at: input.receivedAt,
        status: ready ? 'ready' : failed ? 'failed' : status === 'processing' ? 'rendering' : 'planned',
        mode: existing?.mode ?? (outputPath?.match(/\.(mp4|mov|m4v)$/i) ? 'burn_in' : 'sidecar'),
        episode_no: existing?.episode_no,
        srt_path: outputPath?.match(/\.(srt|vtt)$/i) ? outputPath : existing?.srt_path,
        srt_filename: filenameFromArtifactUrl(outputPath?.match(/\.(srt|vtt)$/i) ? outputPath : existing?.srt_path),
        output_path: outputPath?.match(/\.(mp4|mov|m4v)$/i) ? outputPath : existing?.output_path,
        output_filename: filenameFromArtifactUrl(outputPath?.match(/\.(mp4|mov|m4v)$/i) ? outputPath : existing?.output_path),
        ffmpeg_command: existing?.ffmpeg_command,
        rendered_at: ready ? input.receivedAt : existing?.rendered_at,
        failure_reason: failed ? failureReason ?? `GEARS ${status}` : undefined,
        dry_run: false,
        cue_count: existing?.cue_count ?? 0,
        source_cut_output_path: existing?.source_cut_output_path ?? input.detail.seedance_cut_assembly?.output_path,
      },
    };
  }

  if (input.item.job_type === 'audio_mix') {
    const existing = normalizeSeedanceAudioMixLedger(input.detail.seedance_audio_mix);
    const outputPath = gearsArtifactUrlFor(input.item, ['audio_mix', 'mixed', 'video', 'mp4']);
    return {
      ...detailBase,
      seedance_audio_mix: {
        schema_version: 'ai-comic-seedance-audio-mix-ledger/v1',
        updated_at: input.receivedAt,
        status: ready ? 'ready' : failed ? 'failed' : status === 'processing' ? 'mixing' : 'planned',
        episode_no: existing?.episode_no,
        output_path: ready ? outputPath ?? existing?.output_path : existing?.output_path,
        output_filename: filenameFromArtifactUrl(ready ? outputPath ?? existing?.output_path : existing?.output_path),
        input_video_path: existing?.input_video_path ?? input.detail.seedance_cut_assembly?.output_path,
        ffmpeg_command: existing?.ffmpeg_command,
        mixed_at: ready ? input.receivedAt : existing?.mixed_at,
        failure_reason: failed ? failureReason ?? `GEARS ${status}` : undefined,
        dry_run: false,
        audio_profile: existing?.audio_profile ?? 'balanced_dialogue',
        include_original_audio: existing?.include_original_audio,
        original_audio_volume_db: existing?.original_audio_volume_db,
        source_audio_count: existing?.source_audio_count ?? 0,
        missing_audio_count: existing?.missing_audio_count ?? 0,
      },
    };
  }

  if (input.item.job_type === 'title_card_render') {
    const existing = normalizeSeedanceTitleCardRenderLedger(input.detail.seedance_title_card_render);
    const outputPaths = ready && input.item.artifact_urls.length
      ? [...new Set([...(existing?.output_paths ?? []), ...input.item.artifact_urls])]
      : [...(existing?.output_paths ?? [])];
    return {
      ...detailBase,
      seedance_title_card_render: {
        schema_version: 'ai-comic-seedance-title-card-render-ledger/v1',
        updated_at: input.receivedAt,
        status: ready ? 'ready' : failed ? 'failed' : status === 'processing' ? 'rendering' : 'planned',
        output_profile: existing?.output_profile ?? 'mp4_h264_1080p',
        card_count: Math.max(existing?.card_count ?? 0, outputPaths.length),
        rendered_count: ready ? outputPaths.length : existing?.rendered_count ?? 0,
        output_paths: outputPaths,
        ffmpeg_commands: [...(existing?.ffmpeg_commands ?? [])],
        rendered_at: ready ? input.receivedAt : existing?.rendered_at,
        failure_reason: failed ? failureReason ?? `GEARS ${status}` : undefined,
        dry_run: false,
        font_path: existing?.font_path,
      },
    };
  }

  if (input.item.job_type === 'final_assemble') {
    const existing = normalizeSeedanceFinalDeliveryLedger(input.detail.seedance_final_delivery);
    const outputPath = gearsArtifactUrlFor(input.item, ['final_video', 'final', 'video', 'mp4']);
    const manifestPath = gearsArtifactUrlFor(input.item, ['manifest', 'json']);
    const dependencyStatus = existing?.dependency_status ?? resolveSeedanceFinalDependencyStatus(input.detail, {
      dryRun: true,
      includeSubtitles: true,
      includeAudioMix: true,
      includeTitleCards: true,
    });
    return {
      ...detailBase,
      seedance_final_delivery: {
        schema_version: 'ai-comic-seedance-final-delivery-ledger/v1',
        updated_at: input.receivedAt,
        status: ready ? 'ready' : failed ? 'failed' : status === 'processing' ? 'assembling' : 'planned',
        output_path: ready ? outputPath ?? existing?.output_path : existing?.output_path,
        output_filename: filenameFromArtifactUrl(ready ? outputPath ?? existing?.output_path : existing?.output_path),
        manifest_path: ready ? manifestPath ?? existing?.manifest_path : existing?.manifest_path,
        ffmpeg_command: existing?.ffmpeg_command,
        source_cut_path: dependencyStatus.source_cut_path,
        subtitle_path: dependencyStatus.subtitle_path,
        audio_mix_path: dependencyStatus.audio_mix_path,
        title_card_paths: [...dependencyStatus.title_card_paths],
        delivered_at: ready ? input.receivedAt : existing?.delivered_at,
        failure_reason: failed ? failureReason ?? `GEARS ${status}` : undefined,
        dry_run: false,
        output_profile: existing?.output_profile ?? 'mp4_h264_1080p',
        dependency_status: dependencyStatus,
        current_release: existing?.current_release,
        release_history: existing?.release_history ?? [],
        rollback_events: existing?.rollback_events ?? [],
      },
    };
  }

  return input.detail;
}

function archiveAiComicSeriesImageCallback(input: {
  detail: AiComicSeriesProjectDetail;
  item: GearsJobLedgerItem;
  callbackStatus: GearsJobLedgerItem['status'];
  receivedAt: string;
  duplicate: boolean;
}): AiComicSeriesProjectDetail {
  if (
    input.duplicate
    || input.callbackStatus !== 'ready'
    || input.item.status !== 'ready'
    || !['storyboard_image', 'character_image', 'scene_image'].includes(input.item.job_type)
  ) {
    return input.detail;
  }
  const target = aiComicSeriesImageAssetTarget(input.item);
  if (!target) return input.detail;
  const artifact = input.item.artifacts?.find(item => aiComicSeriesExternalArtifactUrl(item.url));
  const artifactUrl = artifact?.url ?? input.item.artifact_urls.find(aiComicSeriesExternalArtifactUrl);
  if (!artifactUrl) return input.detail;

  const current = normalizeSeedanceAssetLibrary(input.detail.seedance_asset_library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const existing = byId.get(target.asset_id);
  const providerAssetId = artifact?.artifact_id ?? input.item.gears_job_id;
  const model = aiComicArtifactMetadataString(artifact?.metadata, 'model');
  const asset: AiComicSeedanceAssetLibraryItem = {
    asset_id: target.asset_id,
    kind: target.kind,
    label: target.label,
    reference_slot: existing?.reference_slot,
    file_url: artifactUrl,
    mime_type: artifact?.mime_type,
    provider: 'gears',
    provider_asset_id: providerAssetId,
    content_sha256: undefined,
    prompt_sha256: input.item.payload_summary
      ? createHash('sha256').update(input.item.payload_summary, 'utf8').digest('hex')
      : undefined,
    model,
    rights_status: 'pending',
    human_review_status: 'pending',
    identity_binding: existing?.identity_binding
      ? {
          ...existing.identity_binding,
          status: 'stale',
          reviewer_id: undefined,
          reviewed_at: undefined,
          review_note: undefined,
          human_confirmed: false,
        }
      : undefined,
    description: existing?.description ?? input.item.payload_summary,
    updated_at: input.receivedAt,
  };
  const historyEvent: SeedanceAssetHistoryEvent = {
    event_id: `series-media-callback-${randomUUID()}`,
    event_type: 'provider_callback',
    created_at: input.receivedAt,
    provider: 'gears',
    provider_asset_id: providerAssetId,
    file_url: artifactUrl,
    mime_type: artifact?.mime_type,
    rights_status: 'pending',
    human_review_status: 'pending',
    note: `GEARS ${input.item.job_type} callback: ${input.item.gears_job_id}`,
  };
  byId.set(target.asset_id, {
    ...asset,
    history: [...(existing?.history ?? []), historyEvent].slice(-25),
  });
  return {
    ...input.detail,
    project: {
      ...input.detail.project,
      updated_at: input.receivedAt,
    },
    seedance_asset_library: {
      schema_version: 'ai-comic-seedance-asset-library/v1',
      updated_at: input.receivedAt,
      items: [...byId.values()].sort((a, b) => (
        a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, 'zh-CN')
      )),
    },
  };
}

function aiComicSeriesImageAssetTarget(item: GearsJobLedgerItem): {
  asset_id: string;
  kind: AiComicSeedanceAssetLibraryItem['kind'];
  label: string;
} | undefined {
  const match = /^episode:(\d+):(character|scene|storyboard):(.+)$/.exec(item.source_unit_id);
  if (!match) return undefined;
  const episodeNo = Number(match[1]);
  const sourceKind = match[2];
  const value = match[3]?.trim();
  if (!value) return undefined;
  if (sourceKind === 'character') {
    return { asset_id: seedanceAssetId('character', value), kind: 'character', label: value };
  }
  if (sourceKind === 'scene') {
    return { asset_id: seedanceAssetId('location', value), kind: 'location', label: value };
  }
  return {
    asset_id: `gears-storyboard-${episodeNo}-${slugifyConstraintKey(value)}`,
    kind: 'unknown',
    label: item.source_unit_label ?? `E${episodeNo} storyboard ${value}`,
  };
}

function aiComicSeriesExternalArtifactUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      host === 'localhost'
      || host.endsWith('.localhost')
      || host.endsWith('.local')
      || host === 'host.docker.internal'
      || host === '0.0.0.0'
      || host === '::1'
      || host === 'example.com'
      || host === 'example.test'
      || host.endsWith('.example')
      || host.endsWith('.example.com')
      || host.endsWith('.example.test')
      || value.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL)
    ) return false;
    const ipv4 = host.split('.').map(part => Number.parseInt(part, 10));
    if (ipv4.length === 4 && ipv4.every(part => Number.isFinite(part))) {
      const [first, second] = ipv4;
      if (
        first === 10
        || first === 127
        || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && second === 168)
      ) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function aiComicArtifactMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : undefined;
}

export async function importAiComicSeriesGearsCallback(
  seriesProjectId: string,
  request: GearsJobCallbackRequest,
): Promise<ApiResponse<AiComicSeriesGearsJobCallbackResult>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const ledger = normalizeGearsJobLedger(existing.gears_job_ledger);
  const callback = normalizeGearsJobCallback(request);
  const match = findAiComicSeriesGearsLedgerMatch({ ledger, callback });
  if (typeof match === 'string') {
    return success({
      schema_version: 'ai-comic-series-gears-job-callback-result/v1',
      project: existing.project,
      series_title: existing.plan.series_title,
      gears_job_ledger: ledger,
      seedance_production: existing.seedance_production,
      ...aiComicSeriesGearsPostProductionLedgers(existing),
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
  const updatedItem = updateAiComicGearsLedgerItemFromCallback({ item: match, callback, receivedAt });
  let updatedDetail = existing;
  if (updatedItem.job_type === 'seedance_video') {
    const productionItem = normalizeSeedanceProductionLedger(existing.seedance_production)
      .items.find(item => item.production_id === updatedItem.source_unit_id || item.provider_job_id === updatedItem.gears_job_id);
    if (productionItem) {
      updatedDetail = buildAiComicSeriesSeedanceProductionUpdate(existing, [{
        episode_no: productionItem.episode_no,
        shot_id: productionItem.shot_id,
        status: aiComicGearsSeedanceStatus(updatedItem.status),
        provider_job_id: updatedItem.gears_job_id,
        video_url: updatedItem.status === 'ready' ? updatedItem.artifact_urls[0] : undefined,
        failure_reason: updatedItem.failure_reason,
        note: callback.note ?? callback.message ?? `GEARS callback: ${updatedItem.status}`,
      }], receivedAt, {
        executionCost: updatedItem.execution_cost
          ? { ...updatedItem.execution_cost }
          : undefined,
      });
    }
  } else {
    updatedDetail = applyAiComicSeriesGearsPostProductionCallback({
      detail: updatedDetail,
      item: updatedItem,
      receivedAt,
    });
  }
  updatedDetail = archiveAiComicSeriesImageCallback({
    detail: updatedDetail,
    item: updatedItem,
    callbackStatus: callback.status,
    receivedAt,
    duplicate: duplicateCount > 0,
  });
  const nextLedger: GearsJobLedger = {
    schema_version: 'gears-job-ledger/v1',
    updated_at: receivedAt,
    items: reconcileGearsLedgerExecutionCosts(
      ledger.items.map(item => item.ledger_id === match.ledger_id ? updatedItem : item),
    ),
  };
  updatedDetail = {
    ...updatedDetail,
    project: {
      ...updatedDetail.project,
      updated_at: receivedAt,
    },
    gears_job_ledger: nextLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: existing.project.updated_at });
  return success({
    schema_version: 'ai-comic-series-gears-job-callback-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    gears_job_ledger: nextLedger,
    seedance_production: updatedDetail.seedance_production,
    ...aiComicSeriesGearsPostProductionLedgers(updatedDetail),
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

export async function importAiComicSeriesGearsCallbacks(
  seriesProjectId: string,
  request: GearsJobCallbackRequest,
): Promise<ApiResponse<AiComicSeriesGearsJobCallbackResult>> {
  const callbacks = extractGearsJobCallbackRequests(request);
  if (callbacks.length > GEARS_CALLBACK_BATCH_ITEM_LIMIT) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `GEARS callback batch item count must be <= ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}`,
    );
  }
  if (callbacks.length <= 1) return importAiComicSeriesGearsCallback(seriesProjectId, callbacks[0] ?? request);

  let latest: AiComicSeriesGearsJobCallbackResult | undefined;
  const failures: GearsJobSubmitFailure[] = [];
  let receivedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  for (const [index, callback] of callbacks.entries()) {
    const result = await importAiComicSeriesGearsCallback(seriesProjectId, callback);
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
  if (!latest) return importAiComicSeriesGearsCallback(seriesProjectId, request);
  return success({
    ...latest,
    received_count: receivedCount,
    updated_count: updatedCount,
    failed_count: failedCount,
    duplicate_count: duplicateCount,
    failures,
  });
}

export async function syncAiComicSeriesGearsJobStatuses(
  seriesProjectId: string,
  request: GearsJobStatusSyncRequest = {},
): Promise<ApiResponse<AiComicSeriesGearsJobStatusSyncResult>> {
  const existing = await readSeriesProject(seriesProjectId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const ledger = normalizeGearsJobLedger(existing.gears_job_ledger);
  const selection = aiComicSeriesGearsSyncItems({ ledger, request });
  if (!selection.items.length) {
    const result: Omit<AiComicSeriesGearsJobStatusSyncResult, 'markdown'> = {
      schema_version: 'ai-comic-series-gears-job-sync-result/v1',
      project: existing.project,
      series_title: existing.plan.series_title,
      gears_job_ledger: ledger,
      seedance_production: existing.seedance_production,
      ...aiComicSeriesGearsPostProductionLedgers(existing),
      pollable_count: 0,
      synced_count: 0,
      failed_count: 0,
      duplicate_count: 0,
      skipped_count: selection.skippedCount,
      synced_jobs: [],
      failures: [],
    };
    return success({ ...result, markdown: buildAiComicSeriesGearsSyncMarkdown(result) });
  }

  const pollRes = await pollGearsExecutionJobStatuses({
    items: selection.items,
    note: request.note ?? 'GEARS series status sync',
  });
  if (!pollRes.ok || !pollRes.data) {
    return fail(
      pollRes.error?.code === ErrorCodes.VALIDATION_ERROR
        ? ErrorCodes.VALIDATION_ERROR
        : ErrorCodes.INTERNAL_ERROR,
      pollRes.error?.message ?? 'GEARS series status sync failed',
      pollRes.error?.details,
    );
  }

  const failures = [...pollRes.data.failures];
  let currentDetail = existing;
  let currentLedger = ledger;
  const syncedJobs: GearsJobLedgerItem[] = [];
  let duplicateCount = 0;
  for (const [index, polled] of pollRes.data.callbacks.entries()) {
    const importRes = await importAiComicSeriesGearsCallback(seriesProjectId, polled.callback);
    if (!importRes.ok || !importRes.data) {
      failures.push({
        index,
        source_unit_id: polled.item.source_unit_id,
        gears_job_id: polled.item.gears_job_id,
        message: importRes.error?.message ?? 'GEARS series status callback import failed',
      });
      continue;
    }
    const refreshed = await readSeriesProject(seriesProjectId);
    if (refreshed) currentDetail = refreshed;
    currentLedger = normalizeGearsJobLedger(importRes.data.gears_job_ledger);
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
    const expectedUpdatedAt = currentDetail.project.updated_at;
    currentLedger = markGearsLedgerPollFailures({
      ledger: currentLedger,
      failures: pollRes.data.failures,
      updatedAt,
    });
    currentDetail = {
      ...currentDetail,
      project: {
        ...currentDetail.project,
        updated_at: updatedAt,
      },
      gears_job_ledger: currentLedger,
    };
    await seriesProjectRepository().replace(currentDetail, { updated_at: expectedUpdatedAt });
  }

  const result: Omit<AiComicSeriesGearsJobStatusSyncResult, 'markdown'> = {
    schema_version: 'ai-comic-series-gears-job-sync-result/v1',
    project: currentDetail.project,
    series_title: currentDetail.plan.series_title,
    gears_job_ledger: currentLedger,
    seedance_production: currentDetail.seedance_production,
    ...aiComicSeriesGearsPostProductionLedgers(currentDetail),
    provider_adapter: pollRes.data.summary,
    pollable_count: selection.items.length,
    synced_count: syncedJobs.length,
    failed_count: failures.length,
    duplicate_count: duplicateCount,
    skipped_count: selection.skippedCount,
    synced_jobs: syncedJobs,
    failures,
  };
  return success({ ...result, markdown: buildAiComicSeriesGearsSyncMarkdown(result) });
}

export async function exportAiComicSeriesSeedanceVersionComparisonPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceVersionComparisonPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const ledger = normalizeSeedanceProductionLedger(detail.seedance_production);
  const exportedAt = new Date().toISOString();
  const shots: AiComicSeedanceVersionComparisonShot[] = ledger.items
    .map(item => buildSeedanceVersionComparisonShot(item))
    .sort((a, b) => {
      if (a.episode_no !== b.episode_no) return a.episode_no - b.episode_no;
      return compareSeedanceShotIds(a.shot_id, b.shot_id);
    });
  const selectedShotCount = shots.filter(shot => Boolean(shot.selected_version_id)).length;
  const basePackage: Omit<AiComicSeriesSeedanceVersionComparisonPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-version-comparison/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    total_shot_count: shots.length,
    comparable_shot_count: shots.filter(shot => shot.versions.length > 1).length,
    selected_shot_count: selectedShotCount,
    unselected_shot_count: shots.length - selectedShotCount,
    shots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceVersionComparisonMarkdown(basePackage),
  });
}

export async function exportAiComicSeriesSeedanceAssetReportPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceAssetReportPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const generatedEpisodeStoryIds = detail.generated_episode_story_ids ?? {};
  const assetLibrary = normalizeSeedanceAssetLibrary(detail.seedance_asset_library);
  const libraryByAssetId = new Map(assetLibrary.items.map(item => [item.asset_id, item]));
  const libraryByKey = new Map(assetLibrary.items.map(item => [seedanceAssetLookupKey(item.kind, item.label), item]));
  const assets = new Map<string, AiComicSeedanceAssetReferenceItem>();
  const shots: AiComicSeedanceShotAssetBinding[] = [];
  const visualBible = buildAiComicSeriesVisualBible({
    plan: detail.plan,
    ledger: detail.continuity_ledger,
    generatedEpisodeStoryIds,
    assetLibrary,
    previousVisualBible: detail.visual_bible,
  });
  const visualIdentityByKindAndLabel = new Map(visualBible.identities.map(identity => [
    seedanceAssetLookupKey(identity.kind, identity.label),
    identity.identity_id,
  ]));
  const visualIdentityById = new Map(visualBible.identities.map(identity => [identity.identity_id, identity]));

  for (const episode of detail.plan.episodes) {
    const storyId = generatedEpisodeStoryIds[String(episode.episode_no)];
    if (!storyId) continue;
    const storyResult = await getStory(storyId);
    if (!storyResult.ok || !storyResult.data) continue;
    const seedancePackage = buildSeedancePromptPackage(storyResult.data);
    const episodeAssets = new Map<string, AiComicSeedanceAssetReferenceItem>();
    for (const planItem of seedancePackage.asset_reference_plan) {
      const parsed = parseSeedanceAssetReferencePlanItem(planItem, episode.episode_no, libraryByAssetId, libraryByKey);
      if (!parsed) continue;
      episodeAssets.set(seedanceAssetLookupKey(parsed.kind, parsed.label), parsed);
      upsertSeedanceAssetReference(assets, parsed);
    }
    for (const unit of seedancePackage.shot_units) {
      const requiredAssets = [
        ...unit.characters.map(character => resolveSeedanceShotAsset({
          kind: 'character',
          label: character,
          episodeNo: episode.episode_no,
          shotId: unit.shot_id,
          episodeAssets,
          assets,
          libraryByAssetId,
          libraryByKey,
        })),
        resolveSeedanceShotAsset({
          kind: 'location',
          label: unit.location,
          episodeNo: episode.episode_no,
          shotId: unit.shot_id,
          episodeAssets,
          assets,
          libraryByAssetId,
          libraryByKey,
        }),
      ].filter((asset): asset is AiComicSeedanceAssetReferenceItem => Boolean(asset));
      const requiredAssetIds = unique(requiredAssets.map(asset => asset.asset_id));
      const missingReferenceAssetIds = requiredAssets
        .filter(asset => asset.status !== 'bound')
        .map(asset => asset.asset_id);
      const requiredSeriesIdentityIds = unique(requiredAssets.flatMap(asset => {
        const identityId = visualIdentityByKindAndLabel.get(seedanceAssetLookupKey(asset.kind, asset.label));
        return identityId ? [identityId] : [];
      }));
      shots.push({
        production_id: seedanceProductionId(episode.episode_no, unit.shot_id),
        episode_no: episode.episode_no,
        episode_title: episode.title,
        story_id: storyId,
        shot_id: unit.shot_id,
        source_scene_id: unit.source_scene_id,
        characters: [...unit.characters],
        location: unit.location,
        required_asset_ids: requiredAssetIds,
        required_series_identity_ids: requiredSeriesIdentityIds,
        missing_reference_asset_ids: unique(missingReferenceAssetIds),
        reference_slots: unique(requiredAssets.flatMap(asset => asset.reference_slot ? [asset.reference_slot] : [])),
        prompt_preview: summarizeText(unit.seedance_prompt, 120),
      });
    }
  }

  for (const identity of visualBible.identities.filter(item => item.kind === 'costume' || item.kind === 'prop')) {
    const libraryItem = assetLibrary.items.find(item => (
      item.identity_binding?.series_identity_id === identity.identity_id
      || seedanceAssetLookupKey(item.kind, item.label) === seedanceAssetLookupKey(identity.kind, identity.label)
    ));
    const isBound = Boolean(libraryItem?.file_url || libraryItem?.file_id);
    assets.set(libraryItem?.asset_id ?? seedanceAssetId(identity.kind, identity.label), {
      asset_id: libraryItem?.asset_id ?? seedanceAssetId(identity.kind, identity.label),
      series_identity_id: identity.identity_id,
      identity_binding_status: effectiveAiComicSeriesAssetIdentityBindingStatus(
        libraryItem?.identity_binding,
        identity,
      ),
      kind: identity.kind,
      label: identity.label,
      reference_slot: '视觉身份资料库（非 @ 引用槽）',
      file_url: libraryItem?.file_url,
      file_id: libraryItem?.file_id,
      local_path: libraryItem?.local_path,
      original_filename: libraryItem?.original_filename,
      provider: libraryItem?.provider,
      content_sha256: libraryItem?.content_sha256,
      rights_status: libraryItem?.rights_status,
      authorization_reference: libraryItem?.authorization_reference,
      person_consent_reference: libraryItem?.person_consent_reference,
      human_review_status: libraryItem?.human_review_status,
      reviewer_id: libraryItem?.reviewer_id,
      reviewed_at: libraryItem?.reviewed_at,
      review_note: libraryItem?.review_note,
      description: libraryItem?.description ?? identity.canonical_description,
      source_episode_nos: [...identity.source_episode_nos],
      source_shot_ids: [],
      required_by_shot_count: 0,
      has_reference_slot: true,
      is_bound: isBound,
      needs_upload: !isBound,
      status: isBound ? 'bound' : 'missing_file',
    });
  }

  const exportedAt = new Date().toISOString();
  const assetList = [...assets.values()]
    .map(asset => {
      const libraryItem = libraryByAssetId.get(asset.asset_id)
        ?? libraryByKey.get(seedanceAssetLookupKey(asset.kind, asset.label));
      const identityId = libraryItem?.identity_binding?.series_identity_id
        ?? asset.series_identity_id
        ?? visualIdentityByKindAndLabel.get(seedanceAssetLookupKey(asset.kind, asset.label));
      return {
      ...asset,
      series_identity_id: identityId,
      identity_binding_status: effectiveAiComicSeriesAssetIdentityBindingStatus(
        libraryItem?.identity_binding,
        identityId ? visualIdentityById.get(identityId) : undefined,
      ),
      source_episode_nos: [...new Set(asset.source_episode_nos)].sort((a, b) => a - b),
      source_shot_ids: unique(asset.source_shot_ids),
      required_by_shot_count: unique(asset.source_shot_ids).length,
      };
    })
    .sort((a, b) => {
      const statusWeight: Record<AiComicSeedanceAssetReferenceItem['status'], number> = {
        missing_reference_slot: 0,
        missing_file: 1,
        bound: 2,
      };
      if (a.status !== b.status) return statusWeight[a.status] - statusWeight[b.status];
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.label.localeCompare(b.label, 'zh-CN');
    });
  const sortedShots = shots.sort((a, b) => {
    if (a.episode_no !== b.episode_no) return a.episode_no - b.episode_no;
    return compareSeedanceShotIds(a.shot_id, b.shot_id);
  });
  const completionPlan = buildAiComicSeriesVisualProductionCompletionPlan({
    visualBible,
    assetLibrary,
    productionLedger: detail.seedance_production,
    shots: sortedShots,
  });
  const basePackage: Omit<AiComicSeriesSeedanceAssetReportPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-asset-report/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    total_asset_count: assetList.length,
    missing_reference_slot_count: assetList.filter(asset => !asset.has_reference_slot).length,
    upload_required_count: assetList.filter(asset => asset.needs_upload).length,
    shot_binding_count: shots.length,
    unbound_shot_count: shots.filter(shot => shot.missing_reference_asset_ids.length > 0).length,
    visual_bible: visualBible,
    completion_plan: completionPlan,
    assets: assetList,
    shots: sortedShots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceAssetReportMarkdown(basePackage),
  });
}

export async function exportAiComicSeriesSeedanceEditAssetPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceEditAssetPackage>> {
  const cutPackageRes = await exportAiComicSeriesSeedanceCutPackage(seriesProjectId);
  if (!cutPackageRes.ok || !cutPackageRes.data) {
    return fail(
      normalizeErrorCode(cutPackageRes.error?.code),
      cutPackageRes.error?.message ?? 'Export Seedance cut package failed',
    );
  }
  const assetReportRes = await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId);
  if (!assetReportRes.ok || !assetReportRes.data) {
    return fail(
      normalizeErrorCode(assetReportRes.error?.code),
      assetReportRes.error?.message ?? 'Export Seedance asset report failed',
    );
  }

  const cutPackage = cutPackageRes.data;
  const assetReport = assetReportRes.data;
  const assetById = new Map(assetReport.assets.map(asset => [asset.asset_id, asset]));
  const bindingByProductionId = new Map(assetReport.shots.map(shot => [shot.production_id, shot]));
  const episodes: AiComicSeedanceEditAssetPackageEpisode[] = cutPackage.episodes.map(episode => {
    const shots = episode.shots.map(shot => {
      const binding = bindingByProductionId.get(shot.production_id);
      const assets = (binding?.required_asset_ids ?? [])
        .map(assetId => assetById.get(assetId))
        .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
      return {
        production_id: shot.production_id,
        episode_no: shot.episode_no,
        episode_title: shot.episode_title,
        story_id: shot.story_id,
        shot_id: shot.shot_id,
        source_scene_id: shot.source_scene_id,
        order_index: shot.order_index,
        video_url: shot.video_url,
        provider_job_id: shot.provider_job_id,
        version_id: shot.version_id,
        selected_version_id: shot.selected_version_id,
        quality_score: shot.quality_score,
        review_note: shot.review_note,
        reference_slots: binding?.reference_slots ?? [],
        assets,
        missing_asset_ids: binding?.missing_reference_asset_ids ?? [],
        prompt_preview: binding?.prompt_preview,
      };
    });
    return {
      episode_no: episode.episode_no,
      episode_title: episode.episode_title,
      story_id: episode.story_id,
      ready_shot_count: shots.length,
      unbound_shot_count: shots.filter(shot => shot.missing_asset_ids.length > 0).length,
      shots,
    };
  });
  const usedAssetIds = new Set(episodes.flatMap(episode =>
    episode.shots.flatMap(shot => shot.assets.map(asset => asset.asset_id))
  ));
  const usedAssets = assetReport.assets.filter(asset => usedAssetIds.has(asset.asset_id));
  const missingAssetIds = unique(episodes.flatMap(episode =>
    episode.shots.flatMap(shot => shot.missing_asset_ids)
  ));
  const exportedAt = new Date().toISOString();
  const basePackage: Omit<AiComicSeriesSeedanceEditAssetPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-edit-asset-package/v1',
    project: cutPackage.project,
    series_title: cutPackage.series_title,
    exported_at: exportedAt,
    total_ready_shot_count: cutPackage.total_ready_shot_count,
    total_bound_asset_count: usedAssets.filter(asset => asset.is_bound).length,
    total_missing_asset_count: missingAssetIds.length,
    unbound_shot_count: episodes.reduce((sum, episode) => sum + episode.unbound_shot_count, 0),
    episodes,
    assets: usedAssets,
    missing_shots: cutPackage.missing_shots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceEditAssetMarkdown(basePackage),
  });
}

export async function exportAiComicSeriesSeedanceThumbnailPlanPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceThumbnailPlanPackage>> {
  const cutPackageRes = await exportAiComicSeriesSeedanceCutPackage(seriesProjectId);
  if (!cutPackageRes.ok || !cutPackageRes.data) {
    return fail(
      normalizeErrorCode(cutPackageRes.error?.code),
      cutPackageRes.error?.message ?? 'Export Seedance cut package failed',
    );
  }

  const cutPackage = cutPackageRes.data;
  const exportedAt = new Date().toISOString();
  const thumbnailRoot = `thumbnails/${cutPackage.project.series_project_id}`;
  const captureTimeSec = 1;
  const episodes: AiComicSeedanceThumbnailPlanEpisode[] = cutPackage.episodes.map(episode => {
    const shots = episode.shots.map(shot => {
      const outputFilename = seedanceThumbnailFilename(shot.episode_no, shot.shot_id);
      const outputPath = `${thumbnailRoot}/${outputFilename}`;
      return {
        production_id: shot.production_id,
        episode_no: shot.episode_no,
        episode_title: shot.episode_title,
        story_id: shot.story_id,
        shot_id: shot.shot_id,
        source_scene_id: shot.source_scene_id,
        order_index: shot.order_index,
        video_url: shot.video_url,
        version_id: shot.version_id,
        selected_version_id: shot.selected_version_id,
        capture_time_sec: captureTimeSec,
        output_filename: outputFilename,
        output_path: outputPath,
        ffmpeg_command: `ffmpeg -y -ss ${captureTimeSec} -i ${shellDoubleQuote(shot.video_url)} -frames:v 1 -q:v 2 ${shellDoubleQuote(outputPath)}`,
        status: 'pending_capture' as const,
      };
    });
    return {
      episode_no: episode.episode_no,
      episode_title: episode.episode_title,
      story_id: episode.story_id,
      ready_shot_count: shots.length,
      shots,
    };
  });
  const basePackage: Omit<AiComicSeriesSeedanceThumbnailPlanPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-thumbnail-plan/v1',
    project: cutPackage.project,
    series_title: cutPackage.series_title,
    exported_at: exportedAt,
    thumbnail_root: thumbnailRoot,
    total_ready_shot_count: cutPackage.total_ready_shot_count,
    total_missing_shot_count: cutPackage.total_missing_shot_count,
    episodes,
    missing_shots: cutPackage.missing_shots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceThumbnailPlanMarkdown(basePackage),
  });
}

export async function exportAiComicSeriesSeedanceFinishingPlanPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceFinishingPlanPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const cutPackageRes = await exportAiComicSeriesSeedanceCutPackage(seriesProjectId);
  if (!cutPackageRes.ok || !cutPackageRes.data) {
    return fail(
      normalizeErrorCode(cutPackageRes.error?.code),
      cutPackageRes.error?.message ?? 'Export Seedance cut package failed',
    );
  }
  const thumbnailPlanRes = await exportAiComicSeriesSeedanceThumbnailPlanPackage(seriesProjectId);
  if (!thumbnailPlanRes.ok || !thumbnailPlanRes.data) {
    return fail(
      normalizeErrorCode(thumbnailPlanRes.error?.code),
      thumbnailPlanRes.error?.message ?? 'Export Seedance thumbnail plan failed',
    );
  }

  const cutPackage = cutPackageRes.data;
  const thumbnailByProductionId = new Map(
    thumbnailPlanRes.data.episodes.flatMap(episode => episode.shots).map(shot => [shot.production_id, shot]),
  );
  const promptByProductionId = await buildSeedancePromptLookup(detail);
  const shots: AiComicSeedanceFinishingShot[] = [];
  const subtitleCues: AiComicSeedanceFinishingSubtitleCue[] = [];
  const audioCues: AiComicSeedanceFinishingAudioCue[] = [];
  let cursorSec = 0;

  for (const episode of cutPackage.episodes) {
    for (const shot of episode.shots) {
      const prompt = promptByProductionId.get(shot.production_id);
      const durationSec = Math.max(1, Math.round(prompt?.duration_sec ?? 6));
      const startSec = cursorSec;
      const endSec = cursorSec + durationSec;
      const subtitleCueId = `sub-e${shot.episode_no}-${slugifyConstraintKey(shot.shot_id)}`;
      const audioCueId = `aud-e${shot.episode_no}-${slugifyConstraintKey(shot.shot_id)}`;
      const subtitleText = seedanceFinishingSubtitleText(prompt?.script_text, shot);
      const audioText = seedanceFinishingAudioText(prompt?.seedance_prompt, prompt?.camera_suggestion, shot);

      subtitleCues.push({
        cue_id: subtitleCueId,
        episode_no: shot.episode_no,
        shot_id: shot.shot_id,
        start_sec: startSec,
        end_sec: endSec,
        text: subtitleText,
        source: prompt?.script_text ? 'script_text' : 'manual_placeholder',
      });
      audioCues.push({
        cue_id: audioCueId,
        episode_no: shot.episode_no,
        shot_id: shot.shot_id,
        start_sec: startSec,
        end_sec: endSec,
        kind: seedanceAudioKindForPrompt(prompt?.seedance_prompt),
        text: audioText,
        priority: 'should',
      });
      shots.push({
        production_id: shot.production_id,
        episode_no: shot.episode_no,
        episode_title: shot.episode_title,
        story_id: shot.story_id,
        shot_id: shot.shot_id,
        order_index: shots.length + 1,
        start_sec: startSec,
        end_sec: endSec,
        duration_sec: durationSec,
        video_url: shot.video_url,
        selected_version_id: shot.selected_version_id ?? shot.version_id,
        thumbnail_path: thumbnailByProductionId.get(shot.production_id)?.output_path,
        subtitle_cue_ids: [subtitleCueId],
        audio_cue_ids: [audioCueId],
      });
      cursorSec = endSec;
    }
  }

  const readyEpisodeNos = cutPackage.episodes.map(episode => episode.episode_no);
  const generatedEpisodeNos = detail.plan.episodes
    .filter(episode => Boolean(detail.generated_episode_story_ids[String(episode.episode_no)]))
    .map(episode => episode.episode_no);
  const titleCards = buildSeedanceFinishingTitleCards(
    detail,
    readyEpisodeNos.length > 0 ? readyEpisodeNos : generatedEpisodeNos,
  );
  const openingDuration = titleCards
    .filter(card => card.placement === 'series_opening' || card.placement === 'episode_opening')
    .reduce((sum, card) => sum + card.duration_sec, 0);
  const endingDuration = titleCards
    .filter(card => card.placement === 'series_ending' || card.placement === 'episode_ending')
    .reduce((sum, card) => sum + card.duration_sec, 0);
  if (shots.length > 0) {
    audioCues.unshift({
      cue_id: 'aud-series-bed',
      episode_no: shots[0].episode_no,
      start_sec: 0,
      end_sec: cursorSec,
      kind: 'music',
      text: `低侵入配乐底，服务《${detail.plan.series_title}》的${detail.plan.pacing_profile}节奏；对白或旁白出现时自动降噪降音量。`,
      priority: 'should',
    });
  }

  const exportedAt = new Date().toISOString();
  const basePackage: Omit<AiComicSeriesSeedanceFinishingPlanPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-finishing-plan/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    source_cut_output_path: detail.seedance_cut_assembly?.output_path,
    source_cut_status: detail.seedance_cut_assembly?.status,
    total_ready_shot_count: cutPackage.total_ready_shot_count,
    total_missing_shot_count: cutPackage.total_missing_shot_count,
    total_duration_sec: cursorSec + openingDuration + endingDuration,
    subtitle_format: 'srt',
    recommended_output_profile: 'mp4_h264_1080p',
    shots,
    subtitle_cues: subtitleCues,
    audio_cues: audioCues,
    title_cards: titleCards,
    quality_checklist: buildSeedanceFinishingQualityChecklist(cutPackage.total_missing_shot_count),
    missing_shots: cutPackage.missing_shots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceFinishingPlanMarkdown(basePackage),
  });
}

export async function exportAiComicSeriesSeedanceSubtitlePackage(
  seriesProjectId: string,
  request: AiComicSeedanceSubtitleExportRequest = {},
): Promise<ApiResponse<AiComicSeriesSeedanceSubtitlePackage>> {
  const finishingPlanRes = await exportAiComicSeriesSeedanceFinishingPlanPackage(seriesProjectId);
  if (!finishingPlanRes.ok || !finishingPlanRes.data) {
    return fail(
      normalizeErrorCode(finishingPlanRes.error?.code),
      finishingPlanRes.error?.message ?? 'Export Seedance finishing plan failed',
    );
  }

  const finishingPlan = finishingPlanRes.data;
  let selectedCues = finishingPlan.subtitle_cues
    .filter(cue => request.episode_no === undefined || cue.episode_no === request.episode_no)
    .sort((a, b) => a.start_sec - b.start_sec || a.end_sec - b.end_sec || a.cue_id.localeCompare(b.cue_id));
  if (selectedCues.length === 0) {
    const detail = await readSeriesProject(seriesProjectId);
    if (detail) {
      let cursorSec = 0;
      const plannedCues: AiComicSeedanceFinishingSubtitleCue[] = [];
      for (const episode of detail.plan.episodes) {
        if (request.episode_no !== undefined && episode.episode_no !== request.episode_no) continue;
        const storyId = detail.generated_episode_story_ids[String(episode.episode_no)];
        if (!storyId) continue;
        const storyResult = await getStory(storyId);
        if (!storyResult.ok || !storyResult.data) continue;
        const promptPackage = buildSeedancePromptPackage(storyResult.data);
        for (const prompt of promptPackage.shot_units) {
          const durationSec = Math.max(1, Math.round(prompt.duration_sec ?? 6));
          const startSec = cursorSec;
          const endSec = startSec + durationSec;
          cursorSec = endSec;
          plannedCues.push({
            cue_id: `sub-e${episode.episode_no}-${slugifyConstraintKey(prompt.shot_id)}`,
            episode_no: episode.episode_no,
            shot_id: prompt.shot_id,
            start_sec: startSec,
            end_sec: endSec,
            text: seedanceFinishingSubtitleText(prompt.script_text, {
              episode_no: episode.episode_no,
              episode_title: episode.title,
              shot_id: prompt.shot_id,
            }),
            source: prompt.script_text ? 'script_text' : 'manual_placeholder',
          });
        }
      }
      selectedCues = plannedCues;
    }
  }
  if (selectedCues.length === 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      request.episode_no
        ? `No subtitle cues found for episode ${request.episode_no}`
        : 'No subtitle cues found for Seedance SRT export',
    );
  }

  const baseStartSec = request.episode_no === undefined
    ? 0
    : Math.min(...selectedCues.map(cue => cue.start_sec));
  const cues = selectedCues.map((cue, index) => {
    const startSec = Math.max(0, cue.start_sec - baseStartSec);
    const endSec = Math.max(startSec + 0.5, cue.end_sec - baseStartSec);
    return {
      ...cue,
      start_sec: startSec,
      end_sec: endSec,
      srt_index: index + 1,
      start_timecode: formatSrtTimecode(startSec),
      end_timecode: formatSrtTimecode(endSec),
    };
  });
  const srtContent = buildSrtContent(cues);
  const exportedAt = new Date().toISOString();
  const subtitleRoot = `subtitles/${finishingPlan.project.series_project_id}`;
  const srtFilename = seedanceSubtitleFilename(
    finishingPlan.project.series_project_id,
    request.episode_no,
    request.output_filename,
  );
  const basePackage: Omit<AiComicSeriesSeedanceSubtitlePackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-subtitle-package/v1',
    project: finishingPlan.project,
    series_title: finishingPlan.series_title,
    exported_at: exportedAt,
    subtitle_root: subtitleRoot,
    episode_no: request.episode_no,
    subtitle_format: 'srt',
    srt_filename: srtFilename,
    srt_path: `${subtitleRoot}/${srtFilename}`,
    cue_count: cues.length,
    total_duration_sec: Math.max(...cues.map(cue => cue.end_sec)),
    cues,
    srt_content: srtContent,
    missing_shots: finishingPlan.missing_shots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceSubtitleMarkdown(basePackage),
  });
}

export async function renderAiComicSeriesSeedanceSubtitles(
  seriesProjectId: string,
  request: AiComicSeedanceSubtitleRenderRequest = {},
  options: { runner?: FfmpegSubtitleBurnInRunner } = {},
): Promise<ApiResponse<AiComicSeriesSeedanceSubtitleRenderResult>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const mode: AiComicSeedanceSubtitleRenderMode = request.mode ?? 'sidecar';
  const srtOutputFilename = request.output_filename?.toLowerCase().endsWith('.srt')
    ? request.output_filename
    : undefined;
  const subtitlePackageRes = await exportAiComicSeriesSeedanceSubtitlePackage(seriesProjectId, {
    episode_no: request.episode_no,
    output_filename: srtOutputFilename,
  });
  if (!subtitlePackageRes.ok || !subtitlePackageRes.data) {
    return fail(
      normalizeErrorCode(subtitlePackageRes.error?.code),
      subtitlePackageRes.error?.message ?? 'Export Seedance subtitle package failed',
    );
  }

  const subtitlePackage = subtitlePackageRes.data;
  const dryRun = request.dry_run ?? false;
  const overwrite = request.overwrite ?? false;
  const executedAt = new Date().toISOString();
  const projectDir = dirname(seriesProjectPath(seriesProjectId));
  const artifactStore = new FileArtifactStore(projectDir);
  const absoluteSrtPath = resolveSeedanceProjectOutputPath(projectDir, subtitlePackage.srt_path);
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const sourceCutOutputPath = request.input_video_path ?? detail.seedance_cut_assembly?.output_path;
  const burnInOutputFilename = seedanceSubtitleBurnInFilename(
    seriesProjectId,
    request.episode_no,
    request.output_filename,
  );
  const burnInOutputPath = `cuts/${seriesProjectId}/${burnInOutputFilename}`;
  const renderOutputPath = mode === 'sidecar' ? subtitlePackage.srt_path : burnInOutputPath;
  const renderOutputFilename = mode === 'sidecar' ? subtitlePackage.srt_filename : burnInOutputFilename;
  let absoluteInputVideoPath: string | undefined;
  try {
    absoluteInputVideoPath = sourceCutOutputPath
      ? resolveSeedanceProjectOutputPath(projectDir, sourceCutOutputPath)
      : undefined;
  } catch (err) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      err instanceof Error ? err.message : String(err),
    );
  }
  const ffmpegCommand = mode === 'burn_in' && sourceCutOutputPath
    ? buildFfmpegSubtitleBurnInCommand(ffmpegPath, sourceCutOutputPath, subtitlePackage.srt_path, burnInOutputPath)
    : undefined;
  const runner = options.runner ?? runFfmpegSubtitleBurnIn;
  let status: AiComicSeriesSeedanceSubtitleRenderResult['status'] = dryRun ? 'planned' : 'rendered';
  let failureReason: string | undefined;

  try {
    const alreadyReady = !overwrite && !dryRun && await artifactStore.exists(renderOutputPath);
    if (alreadyReady) {
      status = 'skipped';
    } else if (!dryRun) {
      await artifactStore.writeText(
        subtitlePackage.srt_path,
        subtitlePackage.srt_content,
        { overwrite: 'replace' },
      );
      if (mode === 'burn_in') {
        if (!sourceCutOutputPath || !absoluteInputVideoPath) {
          throw new Error('Burn-in subtitle render requires a Seedance cut output or input_video_path');
        }
        const outputSession = await artifactStore.prepareExternalWrite(burnInOutputPath, {
          overwrite: overwrite ? 'replace' : 'forbid',
        });
        try {
          await runner({
            ffmpegPath,
            inputVideoPath: absoluteInputVideoPath,
            subtitlePath: absoluteSrtPath,
            outputPath: outputSession.staging_absolute_path,
          });
          await artifactStore.publishExternalWrite(outputSession);
        } finally {
          await artifactStore.abortExternalWrite(outputSession);
        }
      }
    }
  } catch (err) {
    status = 'failed';
    failureReason = err instanceof Error ? err.message : String(err);
  }

  const renderLedger: AiComicSeedanceSubtitleRenderLedger = {
    schema_version: 'ai-comic-seedance-subtitle-render-ledger/v1',
    updated_at: executedAt,
    status: status === 'rendered'
      ? 'ready'
      : status === 'planned'
        ? 'planned'
        : status,
    mode,
    episode_no: request.episode_no,
    srt_path: subtitlePackage.srt_path,
    srt_filename: subtitlePackage.srt_filename,
    output_path: renderOutputPath,
    output_filename: renderOutputFilename,
    ffmpeg_command: ffmpegCommand,
    rendered_at: status === 'rendered' ? executedAt : detail.seedance_subtitle_render?.rendered_at,
    failure_reason: failureReason,
    dry_run: dryRun,
    cue_count: subtitlePackage.cue_count,
    source_cut_output_path: sourceCutOutputPath,
  };
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: executedAt,
    },
    seedance_subtitle_render: renderLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });

  return success({
    schema_version: 'ai-comic-series-seedance-subtitle-render-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    executed_at: executedAt,
    dry_run: dryRun,
    mode,
    status,
    srt_path: subtitlePackage.srt_path,
    srt_filename: subtitlePackage.srt_filename,
    output_path: renderOutputPath,
    output_filename: renderOutputFilename,
    ffmpeg_command: ffmpegCommand,
    cue_count: subtitlePackage.cue_count,
    failure_reason: failureReason,
    seedance_subtitle_render: renderLedger,
  });
}

export async function exportAiComicSeriesSeedanceAudioPlanPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceAudioPlanPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const finishingPlanRes = await exportAiComicSeriesSeedanceFinishingPlanPackage(seriesProjectId);
  if (!finishingPlanRes.ok || !finishingPlanRes.data) {
    return fail(
      normalizeErrorCode(finishingPlanRes.error?.code),
      finishingPlanRes.error?.message ?? 'Export Seedance finishing plan failed',
    );
  }

  const finishingPlan = finishingPlanRes.data;
  const audioLibrary = normalizeSeedanceAudioLibrary(detail.seedance_audio_library);
  const libraryById = new Map(audioLibrary.items.map(item => [item.asset_id, item]));
  const audioCues = finishingPlan.audio_cues.map(cue => buildSeedanceAudioPlanCue(cue, libraryById));
  const missingAudio = audioCues
    .filter(cue => cue.asset_status === 'missing_asset')
    .map(cue => ({
      cue_id: cue.cue_id,
      episode_no: cue.episode_no,
      shot_id: cue.shot_id,
      kind: cue.kind,
      asset_id: cue.asset_id,
      asset_label: cue.asset_label,
      priority: cue.priority,
      reason: '音频素材库中缺少 file_url 或 file_id',
    }));
  const suggestedAssetMap = new Map<string, {
    asset_id: string;
    kind: AiComicSeedanceFinishingAudioCue['kind'];
    label: string;
    prompts: string[];
    cue_count: number;
  }>();
  for (const cue of audioCues) {
    const current = suggestedAssetMap.get(cue.asset_id) ?? {
      asset_id: cue.asset_id,
      kind: cue.kind,
      label: cue.asset_label,
      prompts: [],
      cue_count: 0,
    };
    current.cue_count += 1;
    current.prompts.push(cue.generated_prompt);
    suggestedAssetMap.set(cue.asset_id, current);
  }
  const suggestedAssets = [...suggestedAssetMap.values()]
    .map(item => ({
      asset_id: item.asset_id,
      kind: item.kind,
      label: item.label,
      cue_count: item.cue_count,
      prompt: summarizeText(unique(item.prompts).join('；'), 120),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.label.localeCompare(b.label, 'zh-CN');
    });
  const exportedAt = new Date().toISOString();
  const basePackage: Omit<AiComicSeriesSeedanceAudioPlanPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-audio-plan/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    source_cut_output_path: finishingPlan.source_cut_output_path,
    audio_root: `audio/${seriesProjectId}`,
    total_duration_sec: finishingPlan.total_duration_sec,
    total_audio_cue_count: audioCues.length,
    bound_cue_count: audioCues.filter(cue => cue.asset_status === 'bound').length,
    missing_audio_count: missingAudio.length,
    audio_cues: audioCues,
    missing_audio: missingAudio,
    suggested_assets: suggestedAssets,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceAudioPlanMarkdown(basePackage),
  });
}

export async function mixAiComicSeriesSeedanceAudio(
  seriesProjectId: string,
  request: AiComicSeedanceAudioMixRequest = {},
  options: { runner?: FfmpegAudioMixRunner } = {},
): Promise<ApiResponse<AiComicSeriesSeedanceAudioMixResult>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const audioPlanRes = await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId);
  if (!audioPlanRes.ok || !audioPlanRes.data) {
    return fail(
      normalizeErrorCode(audioPlanRes.error?.code),
      audioPlanRes.error?.message ?? 'Export Seedance audio plan failed',
    );
  }

  const audioProfile: AiComicSeedanceAudioMixProfile = request.audio_profile ?? 'balanced_dialogue';
  const includeOriginalAudio = request.include_original_audio ?? false;
  const originalAudioVolumeDb = request.original_audio_volume_db ?? 0;
  const dryRun = request.dry_run ?? true;
  const overwrite = request.overwrite ?? false;
  const executedAt = new Date().toISOString();
  const sourceVideoPath = request.input_video_path
    ?? seedanceAudioMixDefaultInputPath(detail, request.episode_no);
  if (!sourceVideoPath) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Seedance audio mix requires a cut assembly output, burn-in subtitle output, or input_video_path',
    );
  }

  const outputFilename = request.output_filename?.trim()
    || seedanceAudioMixFilename(seriesProjectId, request.episode_no);
  const outputPath = `cuts/${seriesProjectId}/${outputFilename}`;
  const projectDir = dirname(seriesProjectPath(seriesProjectId));
  const artifactStore = new FileArtifactStore(projectDir);
  let absoluteInputVideoPath: string;
  try {
    absoluteInputVideoPath = resolveSeedanceProjectOutputPath(projectDir, sourceVideoPath);
  } catch (err) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      err instanceof Error ? err.message : String(err),
    );
  }

  const audioMixScope = seedanceAudioMixScope(audioPlanRes.data, request.episode_no);
  if (audioMixScope.selectedCueCount === 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      request.episode_no
        ? `No audio cues found for episode ${request.episode_no}`
        : 'No audio cues found for Seedance audio mix',
    );
  }
  const audioInputs = audioMixScope.boundCues.map(cue => ({
    input_path: cue.file_url ?? cue.file_id!,
    start_sec: cue.start_sec,
    end_sec: cue.end_sec,
    volume_db: seedanceAudioProfileVolume(cue.volume_db, cue.kind, audioProfile),
    fade_in_sec: cue.fade_in_sec,
    fade_out_sec: cue.fade_out_sec,
  }));
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const ffmpegCommand = buildFfmpegAudioMixCommand(
    ffmpegPath,
    sourceVideoPath,
    audioInputs,
    outputPath,
    { includeOriginalAudio, originalAudioVolumeDb },
  );
  const runner = options.runner ?? runFfmpegAudioMix;
  let status: AiComicSeriesSeedanceAudioMixResult['status'] = dryRun ? 'planned' : 'mixed';
  let failureReason: string | undefined;

  try {
    const alreadyReady = !overwrite && !dryRun && await artifactStore.exists(outputPath);
    if (alreadyReady) {
      status = 'skipped';
    } else if (!dryRun) {
      if (audioInputs.length === 0) {
        throw new Error('No bound audio assets are available for audio mix');
      }
      if (!(await pathExists(absoluteInputVideoPath))) {
        throw new Error(`Seedance audio mix input video not found: ${sourceVideoPath}`);
      }
      const runnerAudioInputs = await resolveSeedanceAudioMixRunnerInputs(projectDir, audioInputs);
      const outputSession = await artifactStore.prepareExternalWrite(outputPath, {
        overwrite: overwrite ? 'replace' : 'forbid',
      });
      try {
        await runner({
          ffmpegPath,
          inputVideoPath: absoluteInputVideoPath,
          audioInputs: runnerAudioInputs,
          includeOriginalAudio,
          originalAudioVolumeDb,
          outputPath: outputSession.staging_absolute_path,
        });
        await artifactStore.publishExternalWrite(outputSession);
      } finally {
        await artifactStore.abortExternalWrite(outputSession);
      }
    }
  } catch (err) {
    status = 'failed';
    failureReason = err instanceof Error ? err.message : String(err);
  }

  const mixLedger: AiComicSeedanceAudioMixLedger = {
    schema_version: 'ai-comic-seedance-audio-mix-ledger/v1',
    updated_at: executedAt,
    status: status === 'mixed'
      ? 'ready'
      : status === 'planned'
        ? 'planned'
        : status,
    episode_no: request.episode_no,
    output_path: outputPath,
    output_filename: outputFilename,
    input_video_path: sourceVideoPath,
    ffmpeg_command: ffmpegCommand,
    mixed_at: status === 'mixed' ? executedAt : detail.seedance_audio_mix?.mixed_at,
    failure_reason: failureReason,
    dry_run: dryRun,
    audio_profile: audioProfile,
    include_original_audio: includeOriginalAudio,
    original_audio_volume_db: originalAudioVolumeDb,
    source_audio_count: audioInputs.length,
    missing_audio_count: audioMixScope.missingAudioCount,
  };
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: executedAt,
    },
    seedance_audio_mix: mixLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });

  return success({
    schema_version: 'ai-comic-series-seedance-audio-mix-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    executed_at: executedAt,
    dry_run: dryRun,
    status,
    episode_no: request.episode_no,
    output_path: outputPath,
    output_filename: outputFilename,
    input_video_path: sourceVideoPath,
    ffmpeg_command: ffmpegCommand,
    audio_profile: audioProfile,
    include_original_audio: includeOriginalAudio,
    original_audio_volume_db: originalAudioVolumeDb,
    source_audio_count: audioInputs.length,
    missing_audio_count: audioMixScope.missingAudioCount,
    failure_reason: failureReason,
    seedance_audio_mix: mixLedger,
  });
}

export async function exportAiComicSeriesSeedanceTitleCardPlanPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceTitleCardPlanPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const finishingPlanRes = await exportAiComicSeriesSeedanceFinishingPlanPackage(seriesProjectId);
  if (!finishingPlanRes.ok || !finishingPlanRes.data) {
    return fail(
      normalizeErrorCode(finishingPlanRes.error?.code),
      finishingPlanRes.error?.message ?? 'Export Seedance finishing plan failed',
    );
  }

  const exportedAt = new Date().toISOString();
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const cards = finishingPlanRes.data.title_cards.map(card =>
    buildSeedanceTitleCardPlanCard(seriesProjectId, card, ffmpegPath),
  );
  const basePackage: Omit<AiComicSeriesSeedanceTitleCardPlanPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-title-card-plan/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    title_card_root: `title-cards/${seriesProjectId}`,
    total_card_count: cards.length,
    total_duration_sec: cards.reduce((sum, card) => sum + card.duration_sec, 0),
    cards,
  };

  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceTitleCardPlanMarkdown(basePackage),
  });
}

export async function renderAiComicSeriesSeedanceTitleCards(
  seriesProjectId: string,
  request: AiComicSeedanceTitleCardRenderRequest = {},
  options: { runner?: FfmpegTitleCardRenderRunner } = {},
): Promise<ApiResponse<AiComicSeriesSeedanceTitleCardRenderResult>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const planRes = await exportAiComicSeriesSeedanceTitleCardPlanPackage(seriesProjectId);
  if (!planRes.ok || !planRes.data) {
    return fail(
      normalizeErrorCode(planRes.error?.code),
      planRes.error?.message ?? 'Export Seedance title card plan failed',
    );
  }

  const dryRun = request.dry_run ?? true;
  const overwrite = request.overwrite ?? false;
  const outputProfile: AiComicSeedanceTitleCardOutputProfile = request.output_profile ?? 'mp4_h264_1080p';
  const cards = planRes.data.cards.filter(card =>
    request.episode_no === undefined
    || card.episode_no === request.episode_no
    || card.placement === 'series_opening'
    || card.placement === 'series_ending',
  );
  if (cards.length === 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      request.episode_no
        ? `No title cards found for episode ${request.episode_no}`
        : 'No title cards found for render',
    );
  }

  const fontPath = request.font_path?.trim() || process.env.FFMPEG_FONT_PATH?.trim();
  if (!dryRun) {
    if (!fontPath) {
      return fail(ErrorCodes.VALIDATION_ERROR, 'FFMPEG_FONT_PATH or font_path is required to render title cards');
    }
    if (!(await pathExists(fontPath))) {
      return fail(ErrorCodes.VALIDATION_ERROR, `Title card font not found: ${fontPath}`);
    }
  }

  const executedAt = new Date().toISOString();
  const projectDir = dirname(seriesProjectPath(seriesProjectId));
  const artifactStore = new FileArtifactStore(projectDir);
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const runner = options.runner ?? runFfmpegTitleCardRender;
  const renderFontPath = fontPath ?? '<FFMPEG_FONT_PATH>';
  const outputPaths: string[] = [];
  const ffmpegCommands: string[] = [];
  let renderedCount = 0;
  let status: AiComicSeriesSeedanceTitleCardRenderResult['status'] = dryRun ? 'planned' : 'rendered';
  let failureReason: string | undefined;

  try {
    for (const card of cards) {
      const alreadyReady = !overwrite && !dryRun && await artifactStore.exists(card.output_path);
      outputPaths.push(card.output_path);
      ffmpegCommands.push(buildFfmpegTitleCardCommand(ffmpegPath, card, outputProfile, renderFontPath, card.output_path));
      if (alreadyReady) {
        renderedCount += 1;
        continue;
      }
      if (!dryRun) {
        const outputSession = await artifactStore.prepareExternalWrite(card.output_path, {
          overwrite: overwrite ? 'replace' : 'forbid',
        });
        try {
          await runner({
            ffmpegPath,
            card,
            outputPath: outputSession.staging_absolute_path,
            profile: outputProfile,
            fontPath: renderFontPath,
          });
          await artifactStore.publishExternalWrite(outputSession);
        } finally {
          await artifactStore.abortExternalWrite(outputSession);
        }
        renderedCount += 1;
      }
    }
    if (!dryRun && renderedCount === 0) status = 'skipped';
  } catch (err) {
    status = 'failed';
    failureReason = err instanceof Error ? err.message : String(err);
  }

  const renderLedger: AiComicSeedanceTitleCardRenderLedger = {
    schema_version: 'ai-comic-seedance-title-card-render-ledger/v1',
    updated_at: executedAt,
    status: status === 'rendered'
      ? 'ready'
      : status === 'planned'
        ? 'planned'
        : status,
    output_profile: outputProfile,
    card_count: cards.length,
    rendered_count: dryRun ? 0 : renderedCount,
    output_paths: outputPaths,
    ffmpeg_commands: ffmpegCommands,
    rendered_at: status === 'rendered' ? executedAt : detail.seedance_title_card_render?.rendered_at,
    failure_reason: failureReason,
    dry_run: dryRun,
    font_path: fontPath,
  };
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: executedAt,
    },
    seedance_title_card_render: renderLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });

  return success({
    schema_version: 'ai-comic-series-seedance-title-card-render-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    executed_at: executedAt,
    dry_run: dryRun,
    status,
    output_profile: outputProfile,
    card_count: cards.length,
    rendered_count: dryRun ? 0 : renderedCount,
    output_paths: outputPaths,
    ffmpeg_commands: ffmpegCommands,
    failure_reason: failureReason,
    seedance_title_card_render: renderLedger,
  });
}

const SEEDANCE_FINAL_DELIVERY_RELEASE_HISTORY_LIMIT = 20;

function seedanceFinalDeliveryReleaseId(createdAt: string): string {
  const timestamp = createdAt.replace(/[^0-9]/g, '').slice(0, 17);
  return `release-${timestamp}-${randomUUID().slice(0, 8)}`;
}

async function archiveSeedanceFinalDeliveryArtifact(input: {
  artifactStore: FileArtifactStore;
  sourceAbsolutePath: string;
  archivedPath: string;
}): Promise<ArtifactWriteResult> {
  const source = await lstat(input.sourceAbsolutePath);
  if (source.isSymbolicLink() || !source.isFile()) {
    throw new Error(`Final delivery release source is not a regular file: ${input.sourceAbsolutePath}`);
  }
  const session = await input.artifactStore.prepareExternalWrite(input.archivedPath, { overwrite: 'forbid' });
  try {
    await link(input.sourceAbsolutePath, session.staging_absolute_path);
    return await input.artifactStore.publishExternalWrite(session);
  } finally {
    await input.artifactStore.abortExternalWrite(session);
  }
}

function mergeSeedanceFinalDeliveryReleaseHistory(
  existing: AiComicSeedanceFinalDeliveryReleaseRecord[] | undefined,
  release: AiComicSeedanceFinalDeliveryReleaseRecord | undefined,
): AiComicSeedanceFinalDeliveryReleaseRecord[] {
  const history = [...(existing ?? [])];
  if (release && !history.some(item => item.release_id === release.release_id)) history.push(release);
  return history.slice(-SEEDANCE_FINAL_DELIVERY_RELEASE_HISTORY_LIMIT);
}

export async function assembleAiComicSeriesSeedanceFinalDelivery(
  seriesProjectId: string,
  request: AiComicSeedanceFinalDeliveryRequest = {},
  options: { runner?: FfmpegFinalDeliveryRunner } = {},
): Promise<ApiResponse<AiComicSeriesSeedanceFinalDeliveryResult>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const dryRun = request.dry_run ?? true;
  const overwrite = request.overwrite ?? false;
  const includeSubtitles = request.include_subtitles ?? true;
  const includeAudioMix = request.include_audio_mix ?? true;
  const includeTitleCards = request.include_title_cards ?? true;
  const missingDependencyMode = request.missing_dependency_mode ?? 'strict';
  const allowOpenFinalReviews = request.allow_open_final_reviews ?? false;
  const resolveReassembleReviews = request.resolve_reassemble_reviews ?? false;
  const outputProfile: AiComicSeedanceFinalDeliveryOutputProfile = request.output_profile ?? 'mp4_h264_1080p';
  const executedAt = new Date().toISOString();
  const dependencyStatus = resolveSeedanceFinalDependencyStatus(detail, {
    dryRun,
    includeSubtitles,
    includeAudioMix,
    includeTitleCards,
  });
  const seedanceCostGovernance = summarizeSeedanceExecutionCostGovernance(detail.seedance_production);
  if (!dryRun && seedanceCostGovernance.pending_terminal_cost_report_count > 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `Seedance final delivery blocked: ${seedanceCostGovernance.pending_terminal_cost_report_count} authorized terminal shots are pending actual cost settlement`,
    );
  }
  if (!dryRun && seedanceCostGovernance.boundary_violation_count > 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `Seedance final delivery blocked: ${seedanceCostGovernance.boundary_violation_count} actual cost records violate their external authorization boundary`,
    );
  }
  if (!dependencyStatus.source_cut_path) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'Seedance final delivery requires a cut assembly output');
  }
  if (missingDependencyMode === 'strict' && dependencyStatus.missing_dependencies.length > 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `Seedance final delivery missing dependencies: ${dependencyStatus.missing_dependencies.join('；')}`,
    );
  }
  const reviewLedger = normalizeSeedanceReviewLedger(detail.seedance_review_ledger);
  if (missingDependencyMode === 'strict' && reviewLedger?.final_reassemble_required && !allowOpenFinalReviews) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Seedance final delivery has unresolved review issues requiring final reassembly',
    );
  }

  const outputFilename = request.output_filename?.trim() || seedanceFinalDeliveryFilename(seriesProjectId);
  const outputPath = `delivery/${seriesProjectId}/${outputFilename}`;
  const manifestPath = `delivery/${seriesProjectId}/${seedanceFinalDeliveryManifestFilename(outputFilename)}`;
  const concatListPath = `delivery/${seriesProjectId}/${outputFilename.replace(/\.mp4$/i, '.concat.txt')}`;
  const projectDir = dirname(seriesProjectPath(seriesProjectId));
  const artifactStore = new FileArtifactStore(projectDir);
  const absoluteConcatListPath = resolveSeedanceProjectOutputPath(projectDir, concatListPath);
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const titleCardPaths = includeTitleCards && dependencyStatus.title_cards_ready
    ? dependencyStatus.title_card_paths
    : [];
  const concatInputs = [...titleCardPaths, dependencyStatus.source_cut_path];
  const useConcat = concatInputs.length > 1;
  const ffmpegCommand = buildFfmpegFinalDeliveryCommand(
    ffmpegPath,
    useConcat ? concatListPath : dependencyStatus.source_cut_path,
    outputPath,
    outputProfile,
    useConcat,
  );
  const runner = options.runner ?? runFfmpegFinalDelivery;
  let status: AiComicSeriesSeedanceFinalDeliveryResult['status'] = dryRun ? 'planned' : 'assembled';
  let failureReason: string | undefined;
  let outputWriteResult: ArtifactWriteResult | undefined;

  try {
    if (useConcat) {
      await artifactStore.writeText(
        concatListPath,
        `${concatInputs
          .map(item => ffmpegConcatFileLine(resolveSeedanceProjectOutputPath(projectDir, item)))
          .join('\n')}\n`,
        { overwrite: 'replace' },
      );
    }
    const alreadyReady = !overwrite && !dryRun && await artifactStore.exists(outputPath);
    if (alreadyReady) {
      status = 'skipped';
    } else if (!dryRun) {
      await assertSeedanceFinalDeliveryInputsExist(projectDir, dependencyStatus, {
        includeSubtitles,
        includeAudioMix,
        includeTitleCards,
      });
      const outputSession = await artifactStore.prepareExternalWrite(outputPath, {
        overwrite: overwrite ? 'replace' : 'forbid',
      });
      try {
        await runner({
          ffmpegPath,
          concatListPath: useConcat ? absoluteConcatListPath : undefined,
          inputVideoPath: resolveSeedanceProjectOutputPath(projectDir, dependencyStatus.source_cut_path),
          outputPath: outputSession.staging_absolute_path,
          outputProfile,
          useConcat,
        });
        outputWriteResult = await artifactStore.publishExternalWrite(outputSession);
      } finally {
        await artifactStore.abortExternalWrite(outputSession);
      }
    }
  } catch (err) {
    status = 'failed';
    failureReason = err instanceof Error ? err.message : String(err);
  }

  let manifest = buildSeedanceFinalDeliveryManifest({
    project: detail.project,
    seriesTitle: detail.plan.series_title,
    generatedAt: executedAt,
    dryRun,
    status,
    outputProfile,
    outputPath,
    outputFilename,
    manifestPath,
    concatListPath: useConcat ? concatListPath : undefined,
    ffmpegCommand,
    dependencyStatus,
    costGovernance: seedanceCostGovernance,
    includeSubtitles,
    includeAudioMix,
    includeTitleCards,
    failureReason,
    manifestDeliverableStatus: 'ready',
  });
  let manifestWriteResult: ArtifactWriteResult | undefined;
  try {
    manifestWriteResult = await artifactStore.writeText(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      { overwrite: 'replace' },
    );
  } catch (err) {
    status = 'failed';
    failureReason = err instanceof Error ? err.message : String(err);
    manifest = buildSeedanceFinalDeliveryManifest({
      project: detail.project,
      seriesTitle: detail.plan.series_title,
      generatedAt: executedAt,
      dryRun,
      status,
      outputProfile,
      outputPath,
      outputFilename,
      manifestPath,
      concatListPath: useConcat ? concatListPath : undefined,
      ffmpegCommand,
      dependencyStatus,
      costGovernance: seedanceCostGovernance,
      includeSubtitles,
      includeAudioMix,
      includeTitleCards,
      failureReason,
      manifestDeliverableStatus: 'failed',
    });
  }

  const existingDelivery = normalizeSeedanceFinalDeliveryLedger(detail.seedance_final_delivery);
  let releaseRecord = status === 'skipped' ? existingDelivery?.current_release : undefined;
  if (!dryRun && (status === 'assembled' || status === 'skipped') && !releaseRecord) {
    const releaseId = seedanceFinalDeliveryReleaseId(executedAt);
    const releaseRoot = `delivery/${seriesProjectId}/releases/${releaseId}`;
    const archivedOutputPath = `${releaseRoot}/${outputFilename}`;
    const archivedManifestPath = `${releaseRoot}/${basename(manifestPath)}`;
    try {
      const archivedOutput = await archiveSeedanceFinalDeliveryArtifact({
        artifactStore,
        sourceAbsolutePath: resolveSeedanceProjectOutputPath(projectDir, outputPath),
        archivedPath: archivedOutputPath,
      });
      const archivedManifest = await artifactStore.writeText(
        archivedManifestPath,
        JSON.stringify(manifest, null, 2),
        { overwrite: 'forbid' },
      );
      if (outputWriteResult && archivedOutput.sha256 !== outputWriteResult.sha256) {
        throw new Error('Final delivery archive output SHA-256 does not match the published output');
      }
      if (manifestWriteResult && archivedManifest.sha256 !== manifestWriteResult.sha256) {
        throw new Error('Final delivery archive manifest SHA-256 does not match the published manifest');
      }
      releaseRecord = {
        schema_version: 'ai-comic-seedance-final-delivery-release/v1',
        release_id: releaseId,
        created_at: executedAt,
        source: 'local_assembly',
        immutable: true,
        canonical_output_path: outputPath,
        canonical_manifest_path: manifestPath,
        archived_output_path: archivedOutput.relative_path,
        archived_manifest_path: archivedManifest.relative_path,
        output_sha256: archivedOutput.sha256,
        manifest_sha256: archivedManifest.sha256,
        output_byte_size: archivedOutput.byte_size,
        manifest_byte_size: archivedManifest.byte_size,
        output_profile: outputProfile,
      };
    } catch (err) {
      status = 'failed';
      failureReason = `Final delivery immutable release archive failed: ${err instanceof Error ? err.message : String(err)}`;
      releaseRecord = undefined;
      manifest = buildSeedanceFinalDeliveryManifest({
        project: detail.project,
        seriesTitle: detail.plan.series_title,
        generatedAt: executedAt,
        dryRun,
        status,
        outputProfile,
        outputPath,
        outputFilename,
        manifestPath,
        concatListPath: useConcat ? concatListPath : undefined,
        ffmpegCommand,
        dependencyStatus,
        costGovernance: seedanceCostGovernance,
        includeSubtitles,
        includeAudioMix,
        includeTitleCards,
        failureReason,
        manifestDeliverableStatus: 'failed',
      });
      manifestWriteResult = await artifactStore.writeText(
        manifestPath,
        JSON.stringify(manifest, null, 2),
        { overwrite: 'replace' },
      ).catch(() => manifestWriteResult);
    }
  }

  const resolvedReviewLedger = status === 'assembled' && resolveReassembleReviews
    ? resolveSeedanceFinalReassembleReviews(
      reviewLedger,
      executedAt,
      request.resolved_note?.trim() || '最终重装配已执行，final delivery 已重新写出。',
    )
    : reviewLedger;

  const deliveryLedger: AiComicSeedanceFinalDeliveryLedger = {
    schema_version: 'ai-comic-seedance-final-delivery-ledger/v1',
    updated_at: executedAt,
    status: status === 'assembled'
      ? 'ready'
      : status === 'planned'
        ? 'planned'
        : status,
    output_path: outputPath,
    output_filename: outputFilename,
    manifest_path: manifestPath,
    ffmpeg_command: ffmpegCommand,
    source_cut_path: dependencyStatus.source_cut_path,
    subtitle_path: dependencyStatus.subtitle_path,
    audio_mix_path: dependencyStatus.audio_mix_path,
    title_card_paths: titleCardPaths,
    delivered_at: status === 'assembled' ? executedAt : detail.seedance_final_delivery?.delivered_at,
    failure_reason: failureReason,
    dry_run: dryRun,
    output_profile: outputProfile,
    dependency_status: dependencyStatus,
    current_release: releaseRecord ?? existingDelivery?.current_release,
    release_history: mergeSeedanceFinalDeliveryReleaseHistory(
      existingDelivery?.release_history,
      releaseRecord,
    ),
    rollback_events: [...(existingDelivery?.rollback_events ?? [])],
  };
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: executedAt,
    },
    seedance_final_delivery: deliveryLedger,
    seedance_review_ledger: resolvedReviewLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });

  return success({
    schema_version: 'ai-comic-series-seedance-final-delivery-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    executed_at: executedAt,
    dry_run: dryRun,
    status,
    output_path: outputPath,
    output_filename: outputFilename,
    manifest_path: manifestPath,
    ffmpeg_command: ffmpegCommand,
    output_profile: outputProfile,
    dependency_status: dependencyStatus,
    failure_reason: failureReason,
    seedance_final_delivery: deliveryLedger,
    manifest,
    markdown: buildAiComicSeriesSeedanceFinalDeliveryMarkdown({
      schema_version: 'ai-comic-series-seedance-final-delivery-result/v1',
      project: updatedDetail.project,
      series_title: updatedDetail.plan.series_title,
      executed_at: executedAt,
      output_path: outputPath,
      manifest_path: manifestPath,
      output_profile: outputProfile,
      dependency_status: dependencyStatus,
      ffmpeg_command: ffmpegCommand,
    }),
  });
}

async function sha256RegularFile(path: string): Promise<{ sha256: string; byte_size: number }> {
  const file = await lstat(path);
  if (file.isSymbolicLink() || !file.isFile()) {
    throw new Error(`Release rollback source is not a regular file: ${path}`);
  }
  const hash = createHash('sha256');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', rejectPromise);
    stream.on('end', resolvePromise);
  });
  return { sha256: hash.digest('hex'), byte_size: file.size };
}

async function restoreSeedanceFinalDeliveryArtifact(input: {
  artifactStore: FileArtifactStore;
  sourceAbsolutePath: string;
  canonicalPath: string;
}): Promise<ArtifactWriteResult> {
  const session = await input.artifactStore.prepareExternalWrite(input.canonicalPath, { overwrite: 'replace' });
  try {
    await link(input.sourceAbsolutePath, session.staging_absolute_path);
    return await input.artifactStore.publishExternalWrite(session);
  } finally {
    await input.artifactStore.abortExternalWrite(session);
  }
}

export async function rollbackAiComicSeriesSeedanceFinalDelivery(
  seriesProjectId: string,
  request: AiComicSeedanceFinalDeliveryRollbackRequest,
  actor: { actor_id: string; authentication_method: string },
): Promise<ApiResponse<AiComicSeedanceFinalDeliveryRollbackResult>> {
  if (request.confirmed !== true) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'Final delivery rollback requires confirmed=true');
  }
  if (!request.reason?.trim() || request.reason.trim().length < 8) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'Final delivery rollback requires an operator reason');
  }
  if (!actor.actor_id?.trim() || actor.authentication_method === 'local_bypass') {
    return fail(ErrorCodes.ACCESS_FORBIDDEN, 'Final delivery rollback requires a verified operator session');
  }
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const existing = normalizeSeedanceFinalDeliveryLedger(detail.seedance_final_delivery);
  const target = existing?.release_history?.find(item => item.release_id === request.release_id.trim());
  if (!existing || !target) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Immutable final delivery release "${request.release_id}" was not found`);
  }
  if (existing.current_release?.release_id === target.release_id) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Final delivery release "${target.release_id}" is already current`);
  }

  const projectDir = dirname(seriesProjectPath(seriesProjectId));
  const archivedOutputAbsolutePath = resolveSeedanceProjectOutputPath(projectDir, target.archived_output_path);
  const archivedManifestAbsolutePath = resolveSeedanceProjectOutputPath(projectDir, target.archived_manifest_path);
  let outputInspection: { sha256: string; byte_size: number };
  let manifestInspection: { sha256: string; byte_size: number };
  try {
    [outputInspection, manifestInspection] = await Promise.all([
      sha256RegularFile(archivedOutputAbsolutePath),
      sha256RegularFile(archivedManifestAbsolutePath),
    ]);
  } catch (err) {
    return fail(
      ErrorCodes.ARTIFACT_STORAGE_UNAVAILABLE,
      `Final delivery rollback archive inspection failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (
    outputInspection.sha256 !== target.output_sha256
    || outputInspection.byte_size !== target.output_byte_size
    || manifestInspection.sha256 !== target.manifest_sha256
    || manifestInspection.byte_size !== target.manifest_byte_size
  ) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Final delivery rollback archive hash or byte size no longer matches the immutable release record',
    );
  }

  const artifactStore = new FileArtifactStore(projectDir);
  let restoredOutput: ArtifactWriteResult;
  let restoredManifest: ArtifactWriteResult;
  try {
    restoredManifest = await restoreSeedanceFinalDeliveryArtifact({
      artifactStore,
      sourceAbsolutePath: archivedManifestAbsolutePath,
      canonicalPath: target.canonical_manifest_path,
    });
    restoredOutput = await restoreSeedanceFinalDeliveryArtifact({
      artifactStore,
      sourceAbsolutePath: archivedOutputAbsolutePath,
      canonicalPath: target.canonical_output_path,
    });
  } catch (err) {
    return fail(
      ErrorCodes.ARTIFACT_STORAGE_UNAVAILABLE,
      `Final delivery rollback publish failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (restoredOutput.sha256 !== target.output_sha256 || restoredManifest.sha256 !== target.manifest_sha256) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'Final delivery rollback publish SHA-256 verification failed');
  }

  const rolledBackAt = new Date().toISOString();
  const rollbackEvent = {
    event_id: `final-delivery-rollback-${randomUUID()}`,
    rolled_back_at: rolledBackAt,
    target_release_id: target.release_id,
    previous_release_id: existing.current_release?.release_id,
    actor_id: actor.actor_id.trim(),
    authentication_method: actor.authentication_method,
    reason: request.reason.trim(),
    output_sha256_verified: true as const,
    manifest_sha256_verified: true as const,
  };
  const nextLedger: AiComicSeedanceFinalDeliveryLedger = {
    ...existing,
    updated_at: rolledBackAt,
    status: 'ready',
    output_path: target.canonical_output_path,
    output_filename: basename(target.canonical_output_path),
    manifest_path: target.canonical_manifest_path,
    output_profile: target.output_profile,
    delivered_at: rolledBackAt,
    failure_reason: undefined,
    dry_run: false,
    current_release: { ...target },
    release_history: existing.release_history?.map(item => ({ ...item })) ?? [],
    rollback_events: [...(existing.rollback_events ?? []), rollbackEvent].slice(-50),
  };
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: { ...detail.project, updated_at: rolledBackAt },
    seedance_final_delivery: nextLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });
  return success({
    schema_version: 'ai-comic-series-seedance-final-delivery-rollback-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    rolled_back_at: rolledBackAt,
    previous_release_id: rollbackEvent.previous_release_id,
    target_release: target,
    seedance_final_delivery: nextLedger,
  });
}

export async function addAiComicSeriesSeedanceReview(
  seriesProjectId: string,
  request: AiComicSeedanceReviewAddRequest,
): Promise<ApiResponse<AiComicSeriesSeedanceReviewUpdateResult>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const now = new Date().toISOString();
  const targetId = request.target_id?.trim()
    || request.shot_id?.trim()
    || seedanceReviewDefaultTargetId(detail, request.target_type);
  const reviewItem: AiComicSeedanceReviewItem = {
    review_id: generateSeedanceReviewId(),
    target_type: request.target_type,
    target_id: targetId,
    episode_no: request.episode_no,
    shot_id: request.shot_id?.trim() || (request.target_type === 'shot' ? targetId : undefined),
    status: 'open',
    severity: request.severity,
    issue_type: request.issue_type,
    note: request.note.trim(),
    repair_action: request.repair_action ?? seedanceReviewDefaultRepairAction(request.issue_type, request.target_type),
    created_at: now,
    created_by: request.created_by?.trim(),
  };
  const existingLedger = normalizeSeedanceReviewLedger(detail.seedance_review_ledger);
  const seedanceReviewLedger = summarizeSeedanceReviewLedger(
    [...(existingLedger?.items ?? []), reviewItem],
    now,
  );
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: now,
    },
    seedance_review_ledger: seedanceReviewLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });

  return success({
    schema_version: 'ai-comic-series-seedance-review-update-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    updated_at: now,
    review_item: reviewItem,
    seedance_review_ledger: seedanceReviewLedger,
  });
}

export async function resolveAiComicSeriesSeedanceReview(
  seriesProjectId: string,
  request: AiComicSeedanceReviewResolveRequest,
): Promise<ApiResponse<AiComicSeriesSeedanceReviewUpdateResult>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const existingLedger = normalizeSeedanceReviewLedger(detail.seedance_review_ledger);
  const reviewItem = existingLedger?.items.find(item => item.review_id === request.review_id);
  if (!reviewItem) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Seedance review "${request.review_id}" not found`);
  }

  const now = new Date().toISOString();
  const updatedReviewItem: AiComicSeedanceReviewItem = {
    ...reviewItem,
    status: request.status ?? 'resolved',
    resolved_at: now,
    resolved_note: request.resolved_note?.trim(),
  };
  const seedanceReviewLedger = summarizeSeedanceReviewLedger(
    (existingLedger?.items ?? []).map(item => item.review_id === request.review_id ? updatedReviewItem : item),
    now,
  );
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: now,
    },
    seedance_review_ledger: seedanceReviewLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });

  return success({
    schema_version: 'ai-comic-series-seedance-review-update-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    updated_at: now,
    review_item: updatedReviewItem,
    seedance_review_ledger: seedanceReviewLedger,
  });
}

export async function exportAiComicSeriesSeedanceReviewRepairPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceReviewRepairPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const exportedAt = new Date().toISOString();
  const ledger = normalizeSeedanceReviewLedger(detail.seedance_review_ledger)
    ?? summarizeSeedanceReviewLedger([], exportedAt);
  const items = ledger.items
    .filter(seedanceReviewItemOpen)
    .map(item => buildSeedanceReviewRepairPackageItem(item));
  const retryCandidateCount = items.filter(item =>
    item.target_type === 'shot'
    && (item.repair_action === 'redo_shot' || item.repair_action === 'reselect_version')
  ).length;
  const pkg: Omit<AiComicSeriesSeedanceReviewRepairPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-seedance-review-repair-package/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    open_count: items.length,
    blocking_count: items.filter(item => item.severity === 'blocking').length,
    retry_candidate_count: retryCandidateCount,
    final_reassemble_required: items.some(item => item.repair_action === 'reassemble_final'),
    items,
  };
  return success({
    ...pkg,
    markdown: buildAiComicSeriesSeedanceReviewRepairMarkdown(pkg),
  });
}

export async function exportAiComicSeriesSeedanceEditingPlatformPackage(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceEditingPlatformPackage>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const finishingPlanRes = await exportAiComicSeriesSeedanceFinishingPlanPackage(seriesProjectId);
  if (!finishingPlanRes.ok || !finishingPlanRes.data) {
    return fail(
      normalizeErrorCode(finishingPlanRes.error?.code),
      finishingPlanRes.error?.message ?? 'Export Seedance finishing plan failed',
    );
  }

  const subtitlePackageRes = await exportAiComicSeriesSeedanceSubtitlePackage(seriesProjectId);
  if (!subtitlePackageRes.ok || !subtitlePackageRes.data) {
    return fail(
      normalizeErrorCode(subtitlePackageRes.error?.code),
      subtitlePackageRes.error?.message ?? 'Export Seedance subtitle package failed',
    );
  }

  const audioPlanRes = await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId);
  if (!audioPlanRes.ok || !audioPlanRes.data) {
    return fail(
      normalizeErrorCode(audioPlanRes.error?.code),
      audioPlanRes.error?.message ?? 'Export Seedance audio plan failed',
    );
  }

  const titleCardPlanRes = await exportAiComicSeriesSeedanceTitleCardPlanPackage(seriesProjectId);
  if (!titleCardPlanRes.ok || !titleCardPlanRes.data) {
    return fail(
      normalizeErrorCode(titleCardPlanRes.error?.code),
      titleCardPlanRes.error?.message ?? 'Export Seedance title card plan failed',
    );
  }

  const finishingPlan = finishingPlanRes.data;
  const subtitlePackage = subtitlePackageRes.data;
  const audioPlan = audioPlanRes.data;
  const titleCardPlan = titleCardPlanRes.data;
  const exportedAt = new Date().toISOString();
  const timelineBuild = buildSeedanceEditingPlatformTimeline(finishingPlan, titleCardPlan);
  const subtitleCues = buildSeedanceEditingPlatformSubtitleCues(
    finishingPlan,
    timelineBuild.shotTimelineStartByKey,
  );
  const srtContent = buildSrtContent(subtitleCues.map((cue, index) => ({
    ...cue,
    shot_id: cue.shot_id ?? 'unknown',
    srt_index: index + 1,
  })));
  const assets = buildSeedanceEditingPlatformAssets({
    detail,
    finishingPlan,
    subtitlePackage,
    audioPlan,
    titleCardPlan,
  });
  const missingAssets = buildSeedanceEditingPlatformMissingAssets({
    finishingPlan,
    audioPlan,
    finalDependencyStatus: detail.seedance_final_delivery?.dependency_status,
  });
  const importNotes = buildSeedanceEditingPlatformImportNotes({
    detail,
    finishingPlan,
    titleCardPlan,
    missingAssets,
  });
  const basePackage: Omit<AiComicSeriesSeedanceEditingPlatformPackage, 'markdown'> = {
    schema_version: 'ai-comic-series-editing-platform-package/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    exported_at: exportedAt,
    formats: ['generic_json', 'csv_timeline', 'srt', 'asset_manifest'],
    source_cut_output_path: finishingPlan.source_cut_output_path,
    final_delivery_output_path: detail.seedance_final_delivery?.output_path,
    timeline_total_duration_sec: timelineBuild.totalDurationSec,
    timeline: timelineBuild.timeline,
    assets,
    subtitle_cues: subtitleCues,
    missing_assets: missingAssets,
    import_notes: importNotes,
    csv_timeline: buildSeedanceEditingPlatformTimelineCsv(timelineBuild.timeline),
    asset_manifest_csv: buildSeedanceEditingPlatformAssetManifestCsv(assets),
    srt_content: srtContent,
  };

  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceEditingPlatformMarkdown(basePackage),
  });
}

export async function getAiComicSeriesSeedanceProductionDashboard(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesSeedanceDashboard>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const cutPackageRes = await exportAiComicSeriesSeedanceCutPackage(seriesProjectId);
  if (!cutPackageRes.ok || !cutPackageRes.data) {
    return fail(
      normalizeErrorCode(cutPackageRes.error?.code),
      cutPackageRes.error?.message ?? 'Export Seedance cut package failed',
    );
  }

  const dashboard = buildSeedanceProductionDashboard(detail, cutPackageRes.data);
  return success({
    ...dashboard,
    markdown: buildAiComicSeriesSeedanceDashboardMarkdown(dashboard),
  });
}

export async function getAiComicSeriesProductionReadiness(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesProductionReadinessReport>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }

  const dashboardRes = await getAiComicSeriesSeedanceProductionDashboard(seriesProjectId);
  if (!dashboardRes.ok || !dashboardRes.data) {
    return fail(
      normalizeErrorCode(dashboardRes.error?.code),
      dashboardRes.error?.message ?? 'Build series production dashboard failed',
    );
  }

  const dashboard = dashboardRes.data;
  const audit = detail.series_quality_audit;
  const gearsSummary = summarizeAiComicProductionReadinessGears(detail.gears_job_ledger);
  const gearsCostGovernance = summarizeGearsExecutionCostGovernance(detail.gears_job_ledger);
  const seedanceCostGovernance = summarizeSeedanceExecutionCostGovernance(detail.seedance_production);
  const seedanceCostBlocked = seedanceCostGovernance.status === 'blocked';
  const gearsOperationalMetrics = buildGearsExecutionOperationalMetrics(detail.gears_job_ledger);
  const gearsRecoveryPlan = buildGearsExecutionRecoveryPlan(detail.gears_job_ledger);
  const visualProductionGate = aiComicSeriesVisualProductionGate(detail);
  const issues: ProductionReadinessIssue[] = [];
  const nextActions: ProductionReadinessNextAction[] = [];
  const generatedEpisodeCount = Object.keys(detail.generated_episode_story_ids ?? {}).length;
  const generatedEpisodeContentIssues = await buildAiComicGeneratedEpisodeContentIssueMap(detail);
  const episodesNeedRegeneration = aiComicEpisodesNeedingRegeneration(detail, generatedEpisodeContentIssues);

  const addIssue = (issue: ProductionReadinessIssue) => issues.push(issue);
  const addAction = (action: ProductionReadinessNextAction) => {
    if (nextActions.some(item => item.action_key === action.action_key)) return;
    nextActions.push(action);
  };

  if (!visualProductionGate.assetsReady) {
    addIssue({
      issue_id: 'series-visual-production-gate',
      severity: 'blocking',
      lane_key: 'visual_asset_readiness',
      label: '视觉资产生产门禁未通过',
      detail: visualProductionGate.detail,
      action_key: 'complete_visual_asset_chain',
      action_label: '完成视觉定义与真实资产链',
    });
    addAction({
      action_key: 'complete_visual_asset_chain',
      label: '完成视觉定义与真实资产链',
      detail: '依次补齐稳定身份与世界规则定义、真人批准、带 SHA-256 的本地真实文件、版权授权、真人媒体审核和当前身份映射。',
      priority: 5,
      lane_key: 'visual_asset_readiness',
    });
  }

  if (!audit?.passed) {
    addIssue({
      issue_id: 'series-quality-needs-attention',
      severity: (audit?.score ?? 0) < 70 ? 'blocking' : 'warning',
      lane_key: 'series_quality',
      label: `${audit?.issues.length ?? 1} 个系列质量问题`,
      detail: audit?.issues[0] ?? '系列质量审计未通过。',
      action_key: 'rebuild_ledger',
      action_label: '重建/修复连续性账本',
    });
    addAction({
      action_key: 'rebuild_ledger',
      label: '修复系列质量审计',
      detail: '先处理连续性、分集生成和长期线索问题，再推进批量生产。',
      priority: 10,
      lane_key: 'series_quality',
    });
  }

  if (episodesNeedRegeneration.length > 0) {
    const first = episodesNeedRegeneration[0]!;
    const firstContentIssues = generatedEpisodeContentIssues.get(first.episode_no) ?? [];
    addIssue({
      issue_id: 'episodes-need-regeneration',
      severity: 'warning',
      lane_key: 'episode_generation',
      label: `${episodesNeedRegeneration.length} 集需要重新生成`,
      detail: `第${first.episode_no}集「${first.title}」已有故事但质量或计划状态不可用，需要先替换后再继续生成后续集。${firstContentIssues[0] ? `原因：${firstContentIssues[0]}` : ''}`,
      action_key: 'generate_next_episode',
      action_label: '重生成问题分集',
    });
    addAction({
      action_key: 'generate_next_episode',
      label: '重生成最早问题分集',
      detail: `优先替换第${first.episode_no}集「${first.title}」，再继续生成后续集。`,
      priority: 15,
      lane_key: 'episode_generation',
    });
  }

  if (generatedEpisodeCount < detail.plan.episode_count) {
    addIssue({
      issue_id: 'episodes-not-complete',
      severity: generatedEpisodeCount === 0 ? 'blocking' : 'warning',
      lane_key: 'episode_generation',
      label: `分集生成 ${generatedEpisodeCount}/${detail.plan.episode_count}`,
      detail: '系列还没有完整分集故事，无法进入完整商业生产排期。',
      action_key: 'generate_next_episode',
      action_label: '生成下一集',
    });
    addAction({
      action_key: 'generate_next_episode',
      label: '继续生成分集',
      detail: `还剩 ${Math.max(0, detail.plan.episode_count - generatedEpisodeCount)} 集未生成。`,
      priority: 20,
      lane_key: 'episode_generation',
    });
  }

  for (const blocker of dashboard.blockers) {
    addIssue({
      issue_id: `seedance-dashboard-${blocker.blocker_id}`,
      severity: blocker.severity === 'blocking' ? 'blocking' : 'warning',
      lane_key: blocker.related_status_key === 'review_ledger' ? 'review_repair' : 'shot_production',
      label: blocker.label,
      detail: blocker.detail,
      action_key: blocker.action_key,
      action_label: blocker.action_label,
    });
  }
  for (const action of dashboard.next_actions) {
    addAction({
      action_key: action.action_key,
      label: action.label,
      detail: action.detail,
      priority: action.priority + 30,
      lane_key: action.related_status_key === 'review_ledger' ? 'review_repair' : 'shot_production',
      disabled_reason: action.disabled_reason,
    });
  }

  if (seedanceCostGovernance.boundary_violation_count > 0) {
    addIssue({
      issue_id: 'series-seedance-execution-cost-boundary-violated',
      severity: 'blocking',
      lane_key: 'shot_production',
      label: `${seedanceCostGovernance.boundary_violation_count} 次 Seedance 执行费用越界`,
      detail: `实际费用回执存在超授权 ${seedanceCostGovernance.exceeded_authorization_count}、币种不一致 ${seedanceCostGovernance.currency_mismatch_count}、缺失授权 ${seedanceCostGovernance.authorization_missing_count}；完成财务复核与重新授权前不得交付。`,
      action_label: '复核并重新授权 Seedance 费用',
    });
  }
  if (seedanceCostGovernance.pending_terminal_cost_report_count > 0) {
    addIssue({
      issue_id: 'series-seedance-execution-cost-settlement-pending',
      severity: 'blocking',
      lane_key: 'shot_production',
      label: `${seedanceCostGovernance.pending_terminal_cost_report_count} 个终态 Seedance 镜头待费用结算`,
      detail: '已授权的外部 Seedance 镜头已进入终态，但 Provider 尚未回传实际费用与币种；结算完成前不得最终交付。',
      action_label: '同步 Seedance Provider 实际费用',
    });
  }

  if (gearsSummary.total === 0) {
    addIssue({
      issue_id: 'series-gears-ledger-empty',
      severity: 'warning',
      lane_key: 'gears_execution',
      label: '系列尚未建立 GEARS job',
      detail: '系列生产仍停留在计划/账本层，尚未形成 GEARS v2 执行任务。',
      action_key: 'submit_gears_jobs',
      action_label: '提交 GEARS',
    });
    addAction({
      action_key: 'submit_gears_jobs',
      label: '批量提交 GEARS job',
      detail: '按当前 job type 将镜头、图片或后期任务提交给 GEARS v2。',
      priority: 70,
      lane_key: 'gears_execution',
    });
  } else {
    if (gearsCostGovernance.boundary_violation_count > 0) {
      addIssue({
        issue_id: 'series-gears-execution-cost-boundary-violated',
        severity: 'blocking',
        lane_key: 'gears_execution',
        label: `${gearsCostGovernance.boundary_violation_count} 个系列 GEARS job 费用越界`,
        detail: `实际费用账本存在超授权 ${gearsCostGovernance.exceeded_authorization_count}、币种不一致 ${gearsCostGovernance.currency_mismatch_count}、缺失授权 ${gearsCostGovernance.authorization_missing_count}；完成财务复核与重新授权前不得交付。`,
        action_label: '复核并重新授权外部费用',
      });
    }
    if (gearsCostGovernance.pending_terminal_cost_report_count > 0) {
      addIssue({
        issue_id: 'series-gears-execution-cost-settlement-pending',
        severity: 'blocking',
        lane_key: 'gears_execution',
        label: `${gearsCostGovernance.pending_terminal_cost_report_count} 个终态系列 GEARS job 待费用结算`,
        detail: '已授权的外部 job 已进入终态，但 Provider 尚未通过 callback/status poll 回传实际费用与币种；结算完成前不得最终交付。',
        action_label: '同步 Provider 实际费用',
      });
    }
    if (gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled > 0) {
      addIssue({
        issue_id: 'series-gears-terminal-failures',
        severity: 'blocking',
        lane_key: 'gears_execution',
        label: `${gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled} 个 GEARS job 失败`,
        detail: '系列 GEARS 账本存在终态失败，需要重试或人工处理。',
        action_key: 'submit_gears_jobs',
        action_label: '重提 GEARS',
      });
    }
    if (gearsSummary.missing_artifact > 0) {
      addIssue({
        issue_id: 'series-gears-ready-missing-artifact',
        severity: 'blocking',
        lane_key: 'gears_execution',
        label: `${gearsSummary.missing_artifact} 个 ready job 缺 artifact`,
        detail: 'GEARS 已返回 ready，但没有交付 URL，无法进入审片或最终装配。',
        action_key: 'sync_gears_jobs',
        action_label: '同步 GEARS',
      });
    }
    if (gearsSummary.active > 0 || gearsSummary.poll_failure > 0) {
      addAction({
        action_key: 'sync_gears_jobs',
        label: '同步系列 GEARS 状态',
        detail: `${gearsSummary.active} 个 GEARS job 仍在活跃状态，${gearsSummary.poll_failure} 个最近轮询失败。`,
        priority: 75,
        lane_key: 'gears_execution',
      });
    }
  }

  const finalDeliveryItem = dashboard.status_items.find(item => item.key === 'final_delivery');
  const editingPackageItem = dashboard.status_items.find(item => item.key === 'editing_platform_package');
  const lanes: ProductionReadinessLane[] = [
    {
      key: 'series_quality',
      label: 'MCP Story Agent 闭环',
      status: audit?.passed ? 'ready' : (audit?.score ?? 0) < 70 ? 'blocked' : 'needs_action',
      score: audit?.score ?? 0,
      detail: audit?.passed ? '系列质量审计通过。' : '系列质量审计仍需修复。',
      count_text: `episodes ${audit?.generated_episode_count ?? generatedEpisodeCount}/${audit?.total_episode_count ?? detail.plan.episode_count}`,
      evidence: [
        `issues ${audit?.issues.length ?? 0}`,
        `attention ${audit?.episodes_need_attention.join(',') || 'none'}`,
      ],
      action_key: audit?.passed ? undefined : 'rebuild_ledger',
      action_label: audit?.passed ? undefined : '修复质量审计',
    },
    {
      key: 'episode_generation',
      label: 'AI 漫剧系列指挥层',
      status: episodesNeedRegeneration.length > 0
        ? 'needs_action'
        : generatedEpisodeCount === 0
        ? 'blocked'
        : generatedEpisodeCount >= detail.plan.episode_count
          ? 'ready'
          : 'needs_action',
      score: detail.plan.episode_count > 0
        ? Math.max(0, Math.round((generatedEpisodeCount / detail.plan.episode_count) * 100) - episodesNeedRegeneration.length * 10)
        : 0,
      detail: episodesNeedRegeneration.length > 0
        ? `已生成 ${generatedEpisodeCount} / ${detail.plan.episode_count} 集，其中 ${episodesNeedRegeneration.length} 集需要重生成。`
        : `已生成 ${generatedEpisodeCount} / ${detail.plan.episode_count} 集。`,
      count_text: `${generatedEpisodeCount}/${detail.plan.episode_count}`,
      evidence: [
        `series ${detail.project.series_project_id}`,
        `updated ${detail.project.updated_at}`,
      ],
      action_key: generatedEpisodeCount >= detail.plan.episode_count && episodesNeedRegeneration.length === 0
        ? undefined
        : 'generate_next_episode',
      action_label: episodesNeedRegeneration.length > 0
        ? '重生成问题分集'
        : generatedEpisodeCount >= detail.plan.episode_count
          ? undefined
          : '生成分集',
    },
    {
      key: 'visual_asset_readiness',
      label: '视觉定义与真实资产',
      status: visualProductionGate.assetsReady ? 'ready' : 'blocked',
      score: visualProductionGate.identityTotal > 0
        ? Math.max(0, Math.min(100, Math.round(
          (visualProductionGate.visualBible.ready_identity_count / visualProductionGate.identityTotal) * 25
          + (visualProductionGate.visualBible.approved_identity_count / visualProductionGate.identityTotal) * 25
          + (visualProductionGate.visualBible.production_credit_identity_count / visualProductionGate.identityTotal) * 40
          + (visualProductionGate.worldRuleTotal === 0
            ? 10
            : ((visualProductionGate.visualBible.ready_world_rule_count + visualProductionGate.visualBible.approved_world_rule_count)
              / (visualProductionGate.worldRuleTotal * 2)) * 10
          )
          - (visualProductionGate.pilotBindingsReady ? 0 : 10),
        )))
        : 0,
      detail: visualProductionGate.detail,
      count_text: `production credit ${visualProductionGate.visualBible.production_credit_identity_count}/${visualProductionGate.identityTotal}`,
      evidence: [
        `definitions ${visualProductionGate.visualBible.ready_identity_count}/${visualProductionGate.identityTotal}`,
        `approvals ${visualProductionGate.visualBible.approved_identity_count}/${visualProductionGate.identityTotal}`,
        `world_rules ${visualProductionGate.visualBible.approved_world_rule_count}/${visualProductionGate.worldRuleTotal}`,
        `pilot_bindings ${visualProductionGate.pilotBindingsReady ? 'ready' : `blocked:${visualProductionGate.visualBible.blocker_count}`}`,
      ],
      action_key: visualProductionGate.assetsReady ? undefined : 'complete_visual_asset_chain',
      action_label: visualProductionGate.assetsReady ? undefined : '完成视觉定义与真实资产链',
    },
    {
      key: 'shot_production',
      label: 'Production Board / Shot Production',
      status: seedanceCostGovernance.boundary_violation_count > 0
        || seedanceCostGovernance.pending_terminal_cost_report_count > 0
        ? 'blocked'
        : dashboard.summary.failed_count > 0 || dashboard.summary.missing_shot_count > 0
        ? dashboard.summary.ready_count === 0 ? 'blocked' : 'needs_action'
        : dashboard.summary.total_shot_count > 0 && dashboard.summary.ready_count >= dashboard.summary.total_shot_count
          ? 'ready'
          : 'needs_action',
      score: Math.max(0, aiComicProductionReadinessShotScore(
        dashboard.summary.total_shot_count,
        dashboard.summary.ready_count,
        dashboard.summary.processing_count + dashboard.summary.submitted_count,
        dashboard.summary.failed_count,
      ) - seedanceCostGovernance.boundary_violation_count * 20
        - seedanceCostGovernance.pending_terminal_cost_report_count * 10),
      detail: `ready ${dashboard.summary.ready_count}，active ${dashboard.summary.processing_count + dashboard.summary.submitted_count}，failed ${dashboard.summary.failed_count}；费用已回执 ${seedanceCostGovernance.reported_cost_count}，待结算 ${seedanceCostGovernance.pending_terminal_cost_report_count}，越界 ${seedanceCostGovernance.boundary_violation_count}。`,
      count_text: `ready ${dashboard.summary.ready_count}/${dashboard.summary.total_shot_count}`,
      evidence: [
        `selected ${dashboard.summary.selected_version_count}`,
        `missing ${dashboard.summary.missing_shot_count}`,
        `cost_reported ${seedanceCostGovernance.reported_cost_count}`,
        `cost_pending ${seedanceCostGovernance.pending_terminal_cost_report_count}`,
        `cost_violation ${seedanceCostGovernance.boundary_violation_count}`,
      ],
      action_key: dashboard.summary.failed_count > 0 ? 'export_retry_package' : dashboard.summary.ready_count < dashboard.summary.total_shot_count ? 'import_seedance_returns' : undefined,
      action_label: dashboard.summary.failed_count > 0 ? '导出重试包' : dashboard.summary.ready_count < dashboard.summary.total_shot_count ? '导入回片' : undefined,
    },
    {
      key: 'delivery_contract',
      label: 'Delivery Contract',
      status: seedanceCostBlocked
        ? 'blocked'
        : aiComicReadinessFromDashboardStatus(finalDeliveryItem?.status ?? 'not_started'),
      score: seedanceCostBlocked
        ? Math.max(0, aiComicDashboardStatusScore(finalDeliveryItem?.status ?? 'not_started') - 40)
        : aiComicDashboardStatusScore(finalDeliveryItem?.status ?? 'not_started'),
      detail: seedanceCostBlocked
        ? `Seedance 费用治理阻断：待结算 ${seedanceCostGovernance.pending_terminal_cost_report_count}，越界 ${seedanceCostGovernance.boundary_violation_count}；最终交付不可执行。`
        : finalDeliveryItem?.status_text ?? '最终交付尚未启动。',
      count_text: finalDeliveryItem?.count_text,
      evidence: [
        finalDeliveryItem?.output_path ? `output ${finalDeliveryItem.output_path}` : 'no final output',
        editingPackageItem?.status_text ? `editing ${editingPackageItem.status_text}` : 'editing package unknown',
        `seedance_cost_governance ${seedanceCostGovernance.status}`,
      ],
      action_key: seedanceCostBlocked || finalDeliveryItem?.status === 'ready'
        ? undefined
        : 'assemble_final_delivery',
      action_label: seedanceCostBlocked
        ? '处理 Seedance 费用阻断'
        : finalDeliveryItem?.status === 'ready' ? undefined : '刷新最终交付',
    },
    {
      key: 'review_repair',
      label: '审片返修',
      status: dashboard.summary.open_review_count > 0
        ? dashboard.summary.blocking_review_count > 0 || dashboard.summary.final_reassemble_required ? 'blocked' : 'needs_action'
        : 'ready',
      score: Math.max(0, Math.min(100, 100 - dashboard.summary.open_review_count * 8 - dashboard.summary.blocking_review_count * 15)),
      detail: dashboard.summary.open_review_count > 0
        ? `还有 ${dashboard.summary.open_review_count} 条审片意见待处理。`
        : '审片返修账本无 open 项。',
      count_text: `open ${dashboard.summary.open_review_count}`,
      evidence: [
        `blocking ${dashboard.summary.blocking_review_count}`,
        `final_reassemble ${dashboard.summary.final_reassemble_required ? 'yes' : 'no'}`,
      ],
      action_key: dashboard.summary.open_review_count > 0 ? 'export_review_repair_package' : undefined,
      action_label: dashboard.summary.open_review_count > 0 ? '导出返修包' : undefined,
    },
    {
      key: 'gears_execution',
      label: 'GEARS Execution',
      status: aiComicProductionReadinessGearsStatus(gearsSummary),
      score: aiComicProductionReadinessGearsScore(gearsSummary),
      detail: gearsSummary.total > 0
        ? `GEARS jobs ready ${gearsSummary.ready}，active ${gearsSummary.active}，failed ${gearsSummary.failed + gearsSummary.rejected + gearsSummary.canceled}。`
        : '尚未提交系列 GEARS job。',
      count_text: `jobs ${gearsSummary.total}`,
      evidence: [
        `missing_artifact ${gearsSummary.missing_artifact}`,
        `poll_failure ${gearsSummary.poll_failure}`,
      ],
      action_key: gearsSummary.total === 0 || gearsSummary.active > 0 || gearsSummary.failed > 0 ? 'submit_gears_jobs' : undefined,
      action_label: gearsSummary.total === 0 ? '提交 GEARS' : gearsSummary.active > 0 ? '同步 GEARS' : undefined,
    },
    {
      key: 'commercial_ops',
      label: '可商用制作中台',
      status: seedanceCostBlocked
        ? 'blocked'
        : dashboard.summary.blocker_count === 0 && gearsSummary.total > 0 ? 'ready' : 'needs_action',
      score: Math.max(0, Math.min(
        100,
        70 + (gearsSummary.total > 0 ? 20 : -20) - dashboard.summary.blocker_count * 8
          - (seedanceCostBlocked ? 40 : 0),
      )),
      detail: seedanceCostBlocked
        ? `Seedance 费用治理为 blocked：待结算 ${seedanceCostGovernance.pending_terminal_cost_report_count}，越界 ${seedanceCostGovernance.boundary_violation_count}；不可进入商业交付。`
        : dashboard.summary.blocker_count === 0 && gearsSummary.total > 0
        ? '系列生产状态可进入商业运营跟踪。'
        : '商业制作中台仍缺 GEARS 任务或存在制作阻断。',
      count_text: `blockers ${dashboard.summary.blocker_count} / gears ${gearsSummary.total}`,
      evidence: [
        `dashboard_actions ${dashboard.summary.next_action_count}`,
        `project ${detail.project.series_project_id}`,
        `seedance_cost_governance ${seedanceCostGovernance.status}`,
      ],
      action_key: seedanceCostBlocked
        ? undefined
        : gearsSummary.total === 0 ? 'submit_gears_jobs' : dashboard.summary.blocker_count > 0 ? 'export_retry_package' : undefined,
      action_label: seedanceCostBlocked
        ? '处理 Seedance 费用阻断'
        : gearsSummary.total === 0 ? '提交 GEARS' : dashboard.summary.blocker_count > 0 ? '处理阻断' : undefined,
    },
  ];

  const episodes = dashboard.episodes.map((episode) => {
    const qualityReport = audit?.episode_reports.find(report => report.episode_no === episode.episode_no);
    const contentIssues = generatedEpisodeContentIssues.get(episode.episode_no) ?? [];
    const qualityNeedsAttention = qualityReport ? qualityReport.status !== 'passed' || contentIssues.length > 0 : contentIssues.length > 0;
    const blockerCount = episode.blocker_count + (qualityNeedsAttention ? 1 : 0);
    const status: ProductionReadinessStatus = blockerCount > 0 || episode.failed_shot_count > 0
      ? 'blocked'
      : episode.ready_shot_count >= episode.total_shot_count && !qualityNeedsAttention
        ? 'ready'
        : 'needs_action';
    return {
      episode_no: episode.episode_no,
      episode_title: episode.episode_title,
      story_id: episode.story_id,
      status,
      quality_score: qualityReport?.score,
      issue_count: (qualityReport?.issues.length ?? 0) + contentIssues.length,
      total_shot_count: episode.total_shot_count,
      ready_shot_count: episode.ready_shot_count,
      failed_shot_count: episode.failed_shot_count,
      blocker_count: blockerCount,
    };
  });

  const sortedNextActions = nextActions.sort((a, b) => a.priority - b.priority);
  const base: Omit<AiComicSeriesProductionReadinessReport, 'markdown'> = {
    schema_version: 'ai-comic-series-production-readiness/v1',
    scope: 'ai_comic_series',
    project: detail.project,
    series_title: detail.plan.series_title,
    generated_at: new Date().toISOString(),
    summary: buildAiComicProductionReadinessSummary(lanes, issues, sortedNextActions, {
      qualityScore: audit?.score,
      generatedEpisodeCount,
      totalEpisodeCount: detail.plan.episode_count,
      totalShotCount: dashboard.summary.total_shot_count,
      readyShotCount: dashboard.summary.ready_count,
      failedShotCount: dashboard.summary.failed_count,
      openReviewCount: dashboard.summary.open_review_count,
      gearsSummary,
    }),
    seedance_cost_governance: seedanceCostGovernance,
    gears_operational_metrics: gearsOperationalMetrics,
    gears_recovery_plan: gearsRecoveryPlan,
    lanes,
    issues,
    next_actions: sortedNextActions,
    automation_plan: buildProductionReadinessAutomationPlan({
      scope: 'ai_comic_series',
      projectId: detail.project.series_project_id,
      actions: sortedNextActions,
      issues,
    }),
    automation_ledger: detail.production_readiness_automation_ledger,
    latest_automation_run: detail.production_readiness_automation_ledger?.latest_run,
    episodes,
  };

  return success({
    ...base,
    markdown: buildAiComicSeriesProductionReadinessMarkdown(base),
  });
}

export async function runAiComicSeriesProductionReadinessAutomation(
  seriesProjectId: string,
  request: ProductionReadinessAutomationRunRequest = {},
): Promise<ApiResponse<ProductionReadinessAutomationRunResult<AiComicSeriesProductionReadinessReport>>> {
  const dryRun = request.dry_run ?? true;
  const maxSteps = request.max_steps ?? 6;
  const stopOnError = request.stop_on_error ?? true;
  const requestedActionKeys = request.action_keys?.length ? new Set(request.action_keys) : undefined;
  const startedAt = new Date().toISOString();
  const beforeRes = await getAiComicSeriesProductionReadiness(seriesProjectId);
  if (!beforeRes.ok || !beforeRes.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      beforeRes.error?.message ?? `AI comic series project "${seriesProjectId}" not found`,
      beforeRes.error?.details,
    );
  }

  const steps: ProductionReadinessAutomationRunResult<AiComicSeriesProductionReadinessReport>['steps'] = [];
  const completedActionKeys = new Set<string>();
  let failed = false;

  for (let iteration = 0; iteration < maxSteps; iteration += 1) {
    const readinessRes = iteration === 0 ? beforeRes : await getAiComicSeriesProductionReadiness(seriesProjectId);
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

    const execRes = await executeAiComicSeriesReadinessAutomationStep(seriesProjectId, step.action_key);
    steps.push({
      step_id: step.step_id,
      action_key: step.action_key,
      label: step.label,
      status: execRes.ok ? 'executed' : 'failed',
      runner: step.runner,
      mode: step.mode,
      can_auto_execute: true,
      api_path: step.api?.path,
      response_schema_version: aiComicProductionAutomationSchemaVersion(execRes.data),
      error_message: execRes.error?.message,
    });
    if (!execRes.ok) {
      failed = true;
      if (stopOnError) break;
    }
  }

  const afterRes = await getAiComicSeriesProductionReadiness(seriesProjectId);
  if (!afterRes.ok || !afterRes.data) {
    return fail(
      ErrorCodes.STORY_NOT_FOUND,
      afterRes.error?.message ?? `AI comic series project "${seriesProjectId}" not found after automation run`,
      afterRes.error?.details,
    );
  }
  const completedAt = new Date().toISOString();
  const runResult: ProductionReadinessAutomationRunResult<AiComicSeriesProductionReadinessReport> = {
    schema_version: 'production-readiness-automation-run/v1',
    scope: 'ai_comic_series',
    project_id: seriesProjectId,
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
      dryRun ? 'dry_run=true: no series project files were changed.' : 'Executed only Story Agent API steps marked can_auto_execute.',
      'GEARS worker and manual review steps are never executed by this runner.',
      'Final delivery automation runs dry-run contract/manifest mode only; real media assembly remains in GEARS v2.',
      dryRun ? 'Automation run ledger was not persisted for dry_run.' : 'Automation run ledger was persisted on the AI comic series project.',
      failed ? 'At least one step failed; inspect failed step error_message.' : 'Automation runner completed without failed internal steps.',
    ],
  };

  if (!dryRun) {
    await appendAiComicSeriesProductionReadinessAutomationRun(seriesProjectId, runResult);
    const finalAfterRes = await getAiComicSeriesProductionReadiness(seriesProjectId);
    if (finalAfterRes.ok && finalAfterRes.data) {
      runResult.after_readiness = finalAfterRes.data;
    }
  }

  return success(runResult);
}

const aiComicProductionReadinessAutomationLedgerLimit = 20;

function buildAiComicProductionReadinessAutomationRunLedger(
  existing: ProductionReadinessAutomationRunLedger | undefined,
  run: ProductionReadinessAutomationRunResult<AiComicSeriesProductionReadinessReport>,
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
  ].slice(0, aiComicProductionReadinessAutomationLedgerLimit);
  return {
    schema_version: 'production-readiness-automation-run-ledger/v1',
    updated_at: run.completed_at,
    total_run_count: (existing?.total_run_count ?? previousItems.length) + 1,
    persisted_run_count: items.length,
    latest_run: item,
    items,
  };
}

async function appendAiComicSeriesProductionReadinessAutomationRun(
  seriesProjectId: string,
  run: ProductionReadinessAutomationRunResult<AiComicSeriesProductionReadinessReport>,
): Promise<void> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) return;
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: run.completed_at,
    },
    production_readiness_automation_ledger: buildAiComicProductionReadinessAutomationRunLedger(
      detail.production_readiness_automation_ledger,
      run,
    ),
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });
}

async function executeAiComicSeriesReadinessAutomationStep(
  seriesProjectId: string,
  actionKey: string,
): Promise<ApiResponse<unknown>> {
  if (actionKey === 'rebuild_ledger') return rebuildAiComicSeriesContinuityLedger(seriesProjectId, {});
  if (actionKey === 'generate_next_episode') {
    const detail = await readSeriesProject(seriesProjectId);
    if (!detail) return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
    const generatedEpisodeContentIssues = await buildAiComicGeneratedEpisodeContentIssueMap(detail);
    const nextEpisode = aiComicEpisodesNeedingRegeneration(detail, generatedEpisodeContentIssues)[0]
      ?? getPlanEpisodes(detail.plan).find(episode =>
        !detail.generated_episode_story_ids[episode.episode_no]
      );
    if (!nextEpisode) return fail(ErrorCodes.VALIDATION_ERROR, 'All episodes have already been generated and no generated episode needs regeneration');
    return generateAiComicEpisodeFromPlan({
      series_project_id: seriesProjectId,
      series_plan: detail.plan,
      episode_no: nextEpisode.episode_no,
      output_gears_segments: true,
      auto_audit_continuity: true,
      auto_repair_episode: true,
    });
  }
  if (actionKey === 'export_seedance_prompts') return exportAiComicSeriesSeedancePrompts(seriesProjectId);
  if (actionKey === 'mark_submitted') {
    const detail = await readSeriesProject(seriesProjectId);
    if (!detail) return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
    const ledger = normalizeSeedanceProductionLedger(detail.seedance_production);
    const updates = ledger.items
      .filter(item => item.status === 'prompt_exported' || (item.status === 'not_started' && Boolean(item.prompt_exported_at)))
      .map(item => ({
        episode_no: item.episode_no,
        shot_id: item.shot_id,
        status: 'submitted' as const,
        provider_job_id: `local-submit-${randomUUID().slice(0, 8)}`,
        note: 'Production readiness automation marked exported Seedance prompt as submitted.',
      }));
    if (updates.length === 0) return success(detail);
    return updateAiComicSeriesSeedanceProductionStatuses(seriesProjectId, { updates });
  }
  if (actionKey === 'export_retry_package') return exportAiComicSeriesSeedanceRetryPackage(seriesProjectId);
  if (actionKey === 'export_editing_platform_package') return exportAiComicSeriesSeedanceEditingPlatformPackage(seriesProjectId);
  if (actionKey === 'assemble_final_delivery') {
    return assembleAiComicSeriesSeedanceFinalDelivery(seriesProjectId, {
      dry_run: true,
      missing_dependency_mode: 'tolerant',
      allow_open_final_reviews: true,
    });
  }
  return fail(ErrorCodes.VALIDATION_ERROR, `Automation action "${actionKey}" is not executable for AI comic series`);
}

function aiComicProductionAutomationSchemaVersion(data: unknown): string | undefined {
  return typeof data === 'object' && data !== null && 'schema_version' in data
    ? String((data as { schema_version?: unknown }).schema_version)
    : undefined;
}

function aiComicGearsArtifactIsLocalAcceptance(
  artifact: { role?: string; url?: string; metadata?: Record<string, unknown> },
): boolean {
  return artifact.role === 'local_acceptance'
    || artifact.metadata?.not_external_provider_output === true
    || artifact.url?.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL) === true;
}

function aiComicGearsJobHasLocalAcceptanceArtifact(item: GearsJobLedgerItem): boolean {
  return (item.artifacts ?? []).some(artifact => aiComicGearsArtifactIsLocalAcceptance(artifact))
    || item.artifact_urls.some(url => url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL));
}

function aiComicGearsJobHasExternalArtifact(item: GearsJobLedgerItem): boolean {
  return (item.artifacts ?? []).some(artifact => !aiComicGearsArtifactIsLocalAcceptance(artifact))
    || item.artifact_urls.some(url => !url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL));
}

function summarizeAiComicProductionReadinessGears(ledger?: GearsJobLedger): ProductionReadinessGearsSummary {
  const normalized = normalizeGearsJobLedger(ledger);
  const statusCounts = Object.fromEntries(
    GEARS_EXECUTION_JOB_STATUSES.map(status => [status, 0]),
  ) as Record<GearsExecutionJobStatus, number>;
  let missingArtifact = 0;
  let pollFailure = 0;
  let externalReady = 0;
  let localAcceptanceReady = 0;
  let localAcceptanceActive = 0;
  for (const item of normalized.items) {
    statusCounts[item.status] += 1;
    if (['submitted', 'queued', 'processing'].includes(item.status) && item.gears_job_id.startsWith('local-gears-')) {
      localAcceptanceActive += 1;
    }
    if (item.status === 'ready' && aiComicGearsJobHasLocalAcceptanceArtifact(item)) {
      localAcceptanceReady += 1;
    }
    if (item.status === 'ready' && aiComicGearsJobHasExternalArtifact(item)) {
      externalReady += 1;
    }
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
    external_ready: externalReady,
    local_acceptance_ready: localAcceptanceReady,
    local_acceptance_active: localAcceptanceActive,
    ready_without_external_artifact: Math.max(0, statusCounts.ready - externalReady),
    failed: statusCounts.failed,
    rejected: statusCounts.rejected,
    canceled: statusCounts.canceled,
    missing_artifact: missingArtifact,
    poll_failure: pollFailure,
    status_counts: statusCounts,
  };
}

function aiComicProductionReadinessShotScore(
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

function aiComicProductionReadinessGearsStatus(summary: ProductionReadinessGearsSummary): ProductionReadinessStatus {
  if (summary.total === 0) return 'needs_action';
  if (summary.failed + summary.rejected + summary.canceled + summary.missing_artifact > 0) return 'blocked';
  if (summary.active > 0 || summary.poll_failure > 0 || summary.ready < summary.total) return 'needs_action';
  return 'ready';
}

function aiComicProductionReadinessGearsScore(summary: ProductionReadinessGearsSummary): number {
  if (summary.total === 0) return 45;
  const readyScore = (summary.ready / summary.total) * 100;
  const activeCredit = (summary.active / summary.total) * 50;
  const failurePenalty = ((summary.failed + summary.rejected + summary.canceled) / summary.total) * 70;
  const artifactPenalty = (summary.missing_artifact / summary.total) * 80;
  const pollPenalty = (summary.poll_failure / summary.total) * 20;
  return Math.max(0, Math.min(100, Math.round(readyScore + activeCredit - failurePenalty - artifactPenalty - pollPenalty)));
}

function aiComicReadinessFromDashboardStatus(
  status: AiComicSeedanceDashboardItemStatus,
): ProductionReadinessStatus {
  if (status === 'ready' || status === 'skipped') return 'ready';
  if (status === 'failed' || status === 'blocked') return 'blocked';
  return 'needs_action';
}

function aiComicDashboardStatusScore(status: AiComicSeedanceDashboardItemStatus): number {
  if (status === 'ready') return 100;
  if (status === 'skipped') return 85;
  if (status === 'in_progress' || status === 'planned') return 65;
  if (status === 'needs_action') return 55;
  if (status === 'failed' || status === 'blocked') return 25;
  return 35;
}

function buildAiComicProductionReadinessSummary(
  lanes: ProductionReadinessLane[],
  issues: ProductionReadinessIssue[],
  nextActions: ProductionReadinessNextAction[],
  extras: {
    qualityScore?: number;
    generatedEpisodeCount?: number;
    totalEpisodeCount?: number;
    totalShotCount?: number;
    readyShotCount?: number;
    failedShotCount?: number;
    openReviewCount?: number;
    gearsSummary: ProductionReadinessGearsSummary;
  },
): AiComicSeriesProductionReadinessReport['summary'] {
  const blockerCount = issues.filter(issue => issue.severity === 'blocking').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;
  const averageLaneScore = lanes.length
    ? lanes.reduce((sum, lane) => sum + lane.score, 0) / lanes.length
    : 0;
  return {
    status: aiComicProductionReadinessOverallStatus(lanes, blockerCount, warningCount),
    score: Math.max(0, Math.min(100, Math.round(averageLaneScore - blockerCount * 6 - warningCount * 2))),
    ready_lane_count: lanes.filter(lane => lane.status === 'ready').length,
    total_lane_count: lanes.length,
    blocker_count: blockerCount,
    warning_count: warningCount,
    next_action_count: nextActions.length,
    quality_score: extras.qualityScore,
    generated_episode_count: extras.generatedEpisodeCount,
    total_episode_count: extras.totalEpisodeCount,
    total_shot_count: extras.totalShotCount,
    ready_shot_count: extras.readyShotCount,
    failed_shot_count: extras.failedShotCount,
    open_review_count: extras.openReviewCount,
    gears_job_count: extras.gearsSummary.total,
    active_gears_job_count: extras.gearsSummary.active,
    external_ready_gears_job_count: extras.gearsSummary.external_ready,
    local_acceptance_ready_gears_job_count: extras.gearsSummary.local_acceptance_ready,
    ready_without_external_gears_artifact_count: extras.gearsSummary.ready_without_external_artifact,
    seedance_placeholder_asset_count: 0,
    seedance_production_asset_ready_count: 0,
  };
}

function aiComicProductionReadinessOverallStatus(
  lanes: ProductionReadinessLane[],
  blockerCount: number,
  warningCount: number,
): ProductionReadinessStatus {
  if (blockerCount > 0 || lanes.some(lane => lane.status === 'blocked')) return 'blocked';
  if (warningCount > 0 || lanes.some(lane => lane.status === 'needs_action')) return 'needs_action';
  return 'ready';
}

function buildAiComicSeriesProductionReadinessMarkdown(
  report: Omit<AiComicSeriesProductionReadinessReport, 'markdown'>,
): string {
  return [
    `# ${report.series_title} — 系列制作 readiness`,
    '',
    `> schema: ${report.schema_version}`,
    `> seriesProjectId: ${report.project.series_project_id}`,
    `> generatedAt: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- 状态: ${aiComicProductionReadinessStatusText(report.summary.status)}`,
    `- 分数: ${report.summary.score}/100`,
    `- episodes: ${report.summary.generated_episode_count}/${report.summary.total_episode_count}`,
    `- shots: ready ${report.summary.ready_shot_count}/${report.summary.total_shot_count}`,
    `- GEARS jobs: ${report.summary.gears_job_count}`,
    `- blockers: ${report.summary.blocker_count}`,
    '',
    '## Seedance Cost Governance',
    '',
    `- status: ${report.seedance_cost_governance.status}`,
    `- authorized shots: ${report.seedance_cost_governance.authorized_shot_count}`,
    `- reported costs: ${report.seedance_cost_governance.reported_cost_count}`,
    `- pending terminal settlement: ${report.seedance_cost_governance.pending_terminal_cost_report_count}`,
    `- boundary violations: ${report.seedance_cost_governance.boundary_violation_count}`,
    `- exceeded authorization: ${report.seedance_cost_governance.exceeded_authorization_count}`,
    `- currency mismatch: ${report.seedance_cost_governance.currency_mismatch_count}`,
    `- authorization missing: ${report.seedance_cost_governance.authorization_missing_count}`,
    '',
    '## GEARS Operational Metrics',
    '',
    `- scope: ${report.gears_operational_metrics.scope}`,
    `- authorized external jobs: ${report.gears_operational_metrics.authorized_external_job_count}`,
    `- actual output rate: ${report.gears_operational_metrics.actual_output_rate_percent}%`,
    `- failure rate: ${report.gears_operational_metrics.failure_rate_percent}%`,
    `- execution p50/p95: ${report.gears_operational_metrics.execution_duration_ms.p50}/${report.gears_operational_metrics.execution_duration_ms.p95} ms`,
    `- callback latency p50/p95: ${report.gears_operational_metrics.callback_delivery_latency_ms.p50}/${report.gears_operational_metrics.callback_delivery_latency_ms.p95} ms`,
    `- actual cost: ${Object.entries(report.gears_operational_metrics.actual_cost_by_currency).map(([currency, amount]) => `${amount} ${currency}`).join(' + ') || 'none'}`,
    `- local acceptance excluded: ${report.gears_operational_metrics.local_acceptance_excluded}`,
    '',
    '## GEARS Recovery Plan',
    '',
    `- recovery items: ${report.gears_recovery_plan.item_count}`,
    `- retry eligible: ${report.gears_recovery_plan.retry_eligible_count}`,
    `- status resync: ${report.gears_recovery_plan.status_resync_count}`,
    `- operator intervention: ${report.gears_recovery_plan.operator_intervention_count}`,
    ...report.gears_recovery_plan.items.map(item => `- ${item.source_unit_id} · ${item.failure_category} · ${item.strategy} · auto=${item.can_auto_execute}: ${item.reason}`),
    '',
    '## Lanes',
    '',
    '| 模块 | 状态 | 分数 | 说明 |',
    '|---|---:|---:|---|',
    ...report.lanes.map(lane =>
      `| ${lane.label} | ${aiComicProductionReadinessStatusText(lane.status)} | ${lane.score}/100 | ${lane.detail} |`,
    ),
    '',
    '## Episodes',
    '',
    ...(report.episodes.length
      ? report.episodes.map(episode =>
        `- E${episode.episode_no} ${episode.episode_title}: ${aiComicProductionReadinessStatusText(episode.status)} · ready ${episode.ready_shot_count ?? 0}/${episode.total_shot_count ?? 0} · blockers ${episode.blocker_count}`,
      )
      : ['- 暂无分集生产记录。']),
    '',
    '## Issues',
    '',
    ...(report.issues.length
      ? report.issues.map(issue =>
        `- ${aiComicIssueSeverityText(issue.severity)} · ${issue.label}: ${issue.detail}`,
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

function aiComicProductionReadinessStatusText(status: ProductionReadinessStatus): string {
  if (status === 'ready') return 'ready';
  if (status === 'blocked') return 'blocked';
  return 'needs_action';
}

function aiComicIssueSeverityText(severity: ProductionReadinessIssue['severity']): string {
  if (severity === 'blocking') return '阻断';
  if (severity === 'warning') return '提醒';
  return '信息';
}

export async function captureAiComicSeriesSeedanceThumbnails(
  seriesProjectId: string,
  request: AiComicSeedanceThumbnailCaptureRequest = {},
  options: { runner?: FfmpegThumbnailRunner } = {},
): Promise<ApiResponse<AiComicSeriesSeedanceThumbnailCaptureResult>> {
  const detail = await readSeriesProject(seriesProjectId);
  if (!detail) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `AI comic series project "${seriesProjectId}" not found`);
  }
  const planRes = await exportAiComicSeriesSeedanceThumbnailPlanPackage(seriesProjectId);
  if (!planRes.ok || !planRes.data) {
    return fail(
      normalizeErrorCode(planRes.error?.code),
      planRes.error?.message ?? 'Export Seedance thumbnail plan failed',
    );
  }

  const dryRun = request.dry_run ?? false;
  const overwrite = request.overwrite ?? false;
  const executedAt = new Date().toISOString();
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const runner = options.runner ?? runFfmpegThumbnailCapture;
  const projectDir = dirname(seriesProjectPath(seriesProjectId));
  const artifactStore = new FileArtifactStore(projectDir);
  const plannedShots = planRes.data.episodes
    .flatMap(episode => episode.shots)
    .filter(shot => request.episode_no === undefined || shot.episode_no === request.episode_no)
    .filter(shot => request.shot_id === undefined || shot.shot_id === request.shot_id)
    .slice(0, request.limit);

  const ledger = normalizeSeedanceProductionLedger(detail.seedance_production);
  const ledgerMap = new Map(ledger.items.map(item => [item.production_id, item]));
  const resultShots: AiComicSeedanceThumbnailCaptureResultShot[] = [];

  for (const shot of plannedShots) {
    const existingItem = ledgerMap.get(shot.production_id);
    const existingThumbnail = existingItem?.thumbnail;
    const alreadyReady = existingThumbnail?.status === 'ready'
      && existingThumbnail.output_path === shot.output_path
      && !overwrite
      && await artifactStore.exists(shot.output_path);
    let status: AiComicSeedanceThumbnailCaptureResultShot['status'] = dryRun ? 'planned' : 'captured';
    let failureReason: string | undefined;
    let skippedReason: string | undefined;

    try {
      if (alreadyReady) {
        status = 'skipped';
        skippedReason = '缩略图已存在，未启用覆盖';
      } else if (!dryRun) {
        const outputSession = await artifactStore.prepareExternalWrite(shot.output_path, {
          overwrite: overwrite ? 'replace' : 'forbid',
        });
        try {
          await runner({
            ffmpegPath,
            videoUrl: shot.video_url,
            outputPath: outputSession.staging_absolute_path,
            captureTimeSec: shot.capture_time_sec,
          });
          await artifactStore.publishExternalWrite(outputSession);
        } finally {
          await artifactStore.abortExternalWrite(outputSession);
        }
      }
    } catch (err) {
      status = 'failed';
      failureReason = err instanceof Error ? err.message : String(err);
    }

    const thumbnailStatus: AiComicSeedanceThumbnailStatus = status === 'captured'
      ? 'ready'
      : status === 'planned'
        ? 'planned'
        : status;
    const thumbnail = {
      status: thumbnailStatus,
      output_path: shot.output_path,
      output_filename: shot.output_filename,
      capture_time_sec: shot.capture_time_sec,
      version_id: shot.version_id,
      captured_at: status === 'captured' ? executedAt : existingThumbnail?.captured_at,
      updated_at: executedAt,
      failure_reason: failureReason,
      ffmpeg_command: buildFfmpegThumbnailCommand(ffmpegPath, shot.capture_time_sec, shot.video_url, shot.output_path),
    };
    if (existingItem) {
      ledgerMap.set(shot.production_id, {
        ...existingItem,
        updated_at: executedAt,
        notes: unique([
          ...existingItem.notes,
          seedanceThumbnailLedgerNote(thumbnailStatus, executedAt, failureReason ?? skippedReason),
        ]).slice(-12),
        thumbnail,
      });
    }

    resultShots.push({
      production_id: shot.production_id,
      episode_no: shot.episode_no,
      episode_title: shot.episode_title,
      story_id: shot.story_id,
      shot_id: shot.shot_id,
      video_url: shot.video_url,
      version_id: shot.version_id,
      selected_version_id: shot.selected_version_id,
      capture_time_sec: shot.capture_time_sec,
      output_filename: shot.output_filename,
      output_path: shot.output_path,
      ffmpeg_command: thumbnail.ffmpeg_command,
      status,
      failure_reason: failureReason,
      skipped_reason: skippedReason,
    });
  }

  const nextLedger: AiComicSeedanceProductionLedger = {
    schema_version: 'ai-comic-seedance-production-ledger/v1',
    updated_at: executedAt,
    items: [...ledgerMap.values()].sort((a, b) =>
      a.episode_no - b.episode_no || compareSeedanceShotIds(a.shot_id, b.shot_id)
    ),
  };
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: executedAt,
    },
    seedance_production: nextLedger,
  };
  await seriesProjectRepository().replace(updatedDetail, { updated_at: detail.project.updated_at });

  return success({
    schema_version: 'ai-comic-series-seedance-thumbnail-capture-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    executed_at: executedAt,
    dry_run: dryRun,
    thumbnail_root: planRes.data.thumbnail_root,
    total_plan_shot_count: plannedShots.length,
    captured_count: resultShots.filter(shot => shot.status === 'captured').length,
    planned_count: resultShots.filter(shot => shot.status === 'planned').length,
    failed_count: resultShots.filter(shot => shot.status === 'failed').length,
    skipped_count: resultShots.filter(shot => shot.status === 'skipped').length,
    shots: resultShots,
    seedance_production: nextLedger,
  });
}

async function recordGeneratedEpisodeStory(
  params: {
    seriesProjectId: string;
    plan: AiComicSeriesPlan;
    episode: AiComicEpisodePlan;
    story: StoryGenerateResult;
  },
): Promise<void> {
  const existing = await readSeriesProject(params.seriesProjectId);
  if (!existing) return;
  const generatedEpisodeStoryIds = {
    ...existing.generated_episode_story_ids,
    [String(params.episode.episode_no)]: params.story.storyId,
  };
  const continuityLedger = updateContinuityLedger({
    ledger: existing.continuity_ledger ?? buildInitialContinuityLedger(params.plan),
    plan: params.plan,
    episode: params.episode,
    story: params.story,
  });
  const now = new Date().toISOString();
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: buildSeriesProjectMeta({
      seriesProjectId: params.seriesProjectId,
      plan: existing.plan,
      createdAt: existing.project.created_at,
      updatedAt: now,
      generatedEpisodeStoryIds,
      archivedAt: existing.project.archived_at,
      accessControl: existing.project.access_control,
    }),
    generated_episode_story_ids: generatedEpisodeStoryIds,
    continuity_ledger: continuityLedger,
  };
  detail.series_quality_audit = buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds,
    ledger: continuityLedger,
    previousAudit: existing.series_quality_audit,
    latestStory: params.story,
    latestEpisodeNo: params.episode.episode_no,
  });
  detail.premise_fidelity_audit = auditAiComicSeriesPremiseFidelity(detail.plan);
  detail.commercial_quality_audit = auditAiComicSeriesCommercialQuality(
    detail.plan,
    existing.commercial_quality_audit?.human_review,
    detail.generated_episode_story_ids,
  );
  await seriesProjectRepository().replace(detail, { updated_at: existing.project.updated_at });
}

function getPlanEpisodes(plan: AiComicSeriesPlan): AiComicSeriesPlan['episodes'] {
  const episodes = (plan as Partial<AiComicSeriesPlan>).episodes;
  return Array.isArray(episodes) ? episodes : [];
}

function normalizeAiComicSeriesPlan(plan: AiComicSeriesPlan): AiComicSeriesPlan {
  const episodes = getPlanEpisodes(plan);
  const premiseContract = plan.premise_contract
    ? normalizeSeriesPremiseContract(plan.premise_contract)
    : buildSeriesPremiseContract({
        outline: plan.premise ?? '',
        detectedCharacters: getPlanMainCharacters(plan).map(character => ({
          name: character.name,
          role_position: character.role === '主角' ? '主角' as const : '配角' as const,
          character_kind: 'named_person',
          source_text: plan.premise ?? '',
          asset_stability: 'recurring',
        })),
      });
  if (episodes.length === 0) {
    return plan.premise_contract ? plan : { ...plan, premise_contract: premiseContract };
  }

  const phases = Array.isArray(plan.phases) && plan.phases.length > 0
    ? plan.phases
    : buildPhases(plan.episode_count);
  const focusPool = unique(episodes.flatMap(episode =>
    Array.isArray(episode.knowledge_focus) ? episode.knowledge_focus : []
  ));
  let changed = !plan.premise_contract;
  const normalizedEpisodes = episodes.map(episode => {
    let normalizedEpisode = episode;
    if (aiComicEpisodeTitleNeedsNormalization(episode.title)) {
      changed = true;
      const episodeFocus = Array.isArray(episode.knowledge_focus)
        ? episode.knowledge_focus.find(item => item.trim().length > 0)
        : undefined;
      normalizedEpisode = {
        ...episode,
        title: buildEpisodeTitle(
          episode.episode_no,
          plan.episode_count,
          findPhase(phases, episode.episode_no),
          plan.core_theme,
          episodeFocus ?? chooseKnowledgeFocus(focusPool, episode.episode_no),
        ),
      };
    }
    if (!normalizedEpisode.commercial_beats) changed = true;
    return {
      ...normalizedEpisode,
      commercial_beats: buildAiComicEpisodeCommercialBeats({
        episode: normalizedEpisode,
        outline: plan.premise ?? '',
        coreTheme: plan.core_theme ?? '',
        premiseContract,
        existing: normalizedEpisode.commercial_beats,
      }),
    };
  });

  return changed ? { ...plan, premise_contract: premiseContract, episodes: normalizedEpisodes } : plan;
}

function aiComicEpisodeTitleNeedsNormalization(title: string): boolean {
  return /问题出现|最终选择|新变化|主角|第\d+集：第\d+集/.test(title);
}

function getPlanMainCharacters(plan: AiComicSeriesPlan): AiComicSeriesPlan['main_characters'] {
  const characters = (plan as Partial<AiComicSeriesPlan>).main_characters;
  return Array.isArray(characters) ? characters : [];
}

function getPlanPlotThreads(plan: AiComicSeriesPlan): AiComicSeriesPlan['plot_threads'] {
  const threads = (plan as Partial<AiComicSeriesPlan>).plot_threads;
  return Array.isArray(threads) ? threads : [];
}

function getPlanContinuityRules(plan: AiComicSeriesPlan): AiComicSeriesPlan['continuity_rules'] {
  const rules = (plan as Partial<AiComicSeriesPlan>).continuity_rules;
  return Array.isArray(rules) ? rules : [];
}

function getPlanProductionNotes(plan: AiComicSeriesPlan): AiComicSeriesPlan['production_notes'] {
  const notes = (plan as Partial<AiComicSeriesPlan>).production_notes;
  return Array.isArray(notes) ? notes : [];
}

function buildAiComicSeriesQualityAudit(params: {
  plan: AiComicSeriesPlan;
  generatedEpisodeStoryIds: Record<string, string>;
  ledger: AiComicContinuityLedger;
  previousAudit?: AiComicSeriesQualityAudit;
  latestStory?: StoryGenerateResult;
  latestEpisodeNo?: number;
}): AiComicSeriesQualityAudit {
  const planEpisodes = getPlanEpisodes(params.plan);
  const planEpisodeNumbers = new Set(planEpisodes.map(episode => episode.episode_no));
  const generatedEntries = Object.entries(params.generatedEpisodeStoryIds)
    .map(([episodeNo, storyId]) => ({ episodeNo: Number(episodeNo), storyId }))
    .filter(entry => Number.isInteger(entry.episodeNo));
  const generatedEpisodeNumbers = new Set(generatedEntries.map(entry => entry.episodeNo));
  const generatedIdsInPlanRange = generatedEntries.every(entry => planEpisodeNumbers.has(entry.episodeNo));
  const generatedStoryIdFirstEpisode = new Map<string, number>();
  const duplicateGeneratedStoryEpisodes = new Set<number>();
  for (const entry of [...generatedEntries].sort((a, b) => a.episodeNo - b.episodeNo)) {
    if (!entry.storyId) continue;
    const firstEpisodeNo = generatedStoryIdFirstEpisode.get(entry.storyId);
    if (firstEpisodeNo !== undefined) {
      duplicateGeneratedStoryEpisodes.add(entry.episodeNo);
    } else {
      generatedStoryIdFirstEpisode.set(entry.storyId, entry.episodeNo);
    }
  }
  const ledgerRecordsByEpisode = new Map(params.ledger.episode_records.map(record => [record.episode_no, record]));
  const previousReports = new Map(
    (params.previousAudit?.episode_reports ?? []).map(report => [report.episode_no, report]),
  );
  const latestQuality = params.latestStory?.ai_comic_episode_quality;
  const latestContinuity = params.latestStory?.continuity_audit;

  const episodeReports: AiComicSeriesQualityEpisodeReport[] = planEpisodes.map(episode => {
    const storyId = params.generatedEpisodeStoryIds[String(episode.episode_no)];
    const ledgerRecord = ledgerRecordsByEpisode.get(episode.episode_no);
    const planChangedAfterGeneration = Boolean(storyId && ledgerRecord && hasEpisodePlanChangedAfterGeneration({
      episode,
      ledgerRecord,
    }));
    if (!storyId) {
      return {
        episode_no: episode.episode_no,
        status: 'not_generated',
        issues: ['本集尚未生成完整分镜'],
      };
    }

    const latestMatches = params.latestEpisodeNo === episode.episode_no
      && latestQuality
      && latestQuality.episode_no === episode.episode_no;
    const previous = previousReports.get(episode.episode_no);
    const previousStillMatches = previous?.story_id === storyId;
    const duplicateStoryId = duplicateGeneratedStoryEpisodes.has(episode.episode_no);
    const issues = latestMatches
      ? unique([
          ...latestQuality.issues,
          ...(latestContinuity?.issues ?? []),
      ])
      : previousStillMatches
        ? previous.issues.filter(issue =>
            !issue.includes('分集卡片已在生成后变更')
            && !issue.includes('共用同一个故事 ID')
          )
        : ['本集缺少可追溯质量报告，建议重新生成或重新保存后复核'];
    if (planChangedAfterGeneration) {
      issues.push('本集分集卡片已在生成后变更，建议重新生成本集并重建后续账本');
    }
    if (duplicateStoryId) {
      issues.push('本集与其他分集共用同一个故事 ID，需要重新生成以恢复分集独立性');
    }
    const score = latestMatches
      ? latestQuality.score
      : previousStillMatches
        ? previous.score
        : undefined;
    const passed = latestMatches
      ? latestQuality.passed && (latestContinuity?.passed ?? true)
      : previousStillMatches
        ? previous.status === 'passed'
          || (
            !planChangedAfterGeneration
            && !duplicateStoryId
            && issues.length === 0
            && (previous.score ?? 0) >= 80
          )
        : false;

    return {
      episode_no: episode.episode_no,
      story_id: storyId,
      status: planChangedAfterGeneration || duplicateStoryId
        ? 'needs_attention'
        : latestMatches || previousStillMatches
          ? passed ? 'passed' : 'needs_attention'
        : 'unknown',
      score,
      issues,
      plan_changed_after_generation: planChangedAfterGeneration,
      needs_episode_regeneration: planChangedAfterGeneration || duplicateStoryId,
      needs_ledger_rebuild: planChangedAfterGeneration || duplicateStoryId,
    };
  });

  const allEpisodesGenerated = planEpisodes.every(episode =>
    generatedEpisodeNumbers.has(episode.episode_no),
  );
  const generatedEpisodesMissingLedger = generatedEntries.filter(entry => {
    const record = ledgerRecordsByEpisode.get(entry.episodeNo);
    return !record || record.story_id !== entry.storyId;
  });
  const ledgerCoversGeneratedEpisodes = generatedEpisodesMissingLedger.length === 0;
  const threadClosureReport = buildAiComicThreadClosureReport({
    plan: params.plan,
    generatedEpisodeNumbers,
    ledger: params.ledger,
  });
  const memoryConflictReport = buildAiComicMemoryConflictReport({
    ledger: params.ledger,
  });
  const completedSeriesThreadsResolved = threadClosureReport.overdue_thread_count === 0
    && threadClosureReport.orphaned_thread_count === 0
    && memoryConflictReport.blocking_count === 0
    && (!allEpisodesGenerated || threadClosureReport.items.every(item =>
      item.status === 'paid_off'
      || item.status === 'orphaned'
      || item.status === 'duplicate'
      || (item.payoff_episode && item.payoff_episode > params.plan.episode_count)
    ));
  const knownReports = episodeReports.filter(report => typeof report.score === 'number');
  const knownPassed = knownReports.filter(report => report.status === 'passed').length;
  const knownEpisodeQualityPassRate = knownReports.length > 0
    ? Number((knownPassed / knownReports.length).toFixed(2))
    : 0;
  const episodesNeedAttention = episodeReports
    .filter(report => report.status !== 'passed')
    .map(report => report.episode_no);
  const issues: string[] = [];
  const notGeneratedCount = episodeReports.filter(report => report.status === 'not_generated').length;
  if (notGeneratedCount > 0) issues.push(`还有 ${notGeneratedCount} 集尚未生成完整分镜`);
  if (!generatedIdsInPlanRange) issues.push('存在不在当前分集规划范围内的已生成故事记录');
  if (duplicateGeneratedStoryEpisodes.size > 0) {
    issues.push(`有 ${duplicateGeneratedStoryEpisodes.size} 集与其他分集共用故事 ID，需要重新生成`);
  }
  if (!ledgerCoversGeneratedEpisodes) {
    issues.push(`连续性账本缺少 ${generatedEpisodesMissingLedger.length} 个已生成分集记录`);
  }
  if (!completedSeriesThreadsResolved) issues.push('系列线索开合存在断点，需要按线索闭环报告处理');
  if (threadClosureReport.overdue_thread_count > 0) {
    issues.push(`${threadClosureReport.overdue_thread_count} 条线索已到计划回收集但未形成明确回收`);
  }
  if (threadClosureReport.orphaned_thread_count > 0) {
    issues.push(`${threadClosureReport.orphaned_thread_count} 条临时伏笔未绑定长期线索`);
  }
  if (memoryConflictReport.blocking_count > 0) {
    issues.push(`${memoryConflictReport.blocking_count} 个记忆冲突会阻断连续性，需要先修复`);
  }
  if (memoryConflictReport.warning_count > 0) {
    issues.push(`${memoryConflictReport.warning_count} 个记忆冲突需要复核`);
  }
  for (const report of episodeReports) {
    if (report.status === 'needs_attention' || report.status === 'unknown') {
      issues.push(`第${report.episode_no}集：${report.issues[0] ?? '需要复核'}`);
    }
  }

  const score = clampScore(Math.round(
    (allEpisodesGenerated ? 25 : Math.max(0, 25 - notGeneratedCount * 3))
    + (generatedIdsInPlanRange ? 15 : 0)
    + (ledgerCoversGeneratedEpisodes ? 20 : 0)
    + (completedSeriesThreadsResolved ? 15 : 0)
    + (knownReports.length > 0 ? knownEpisodeQualityPassRate * 25 : 8)
    - threadClosureReport.overdue_thread_count * 6
    - threadClosureReport.orphaned_thread_count * 4
    - threadClosureReport.duplicate_thread_count * 3
    - memoryConflictReport.blocking_count * 8
    - memoryConflictReport.warning_count * 4
    - memoryConflictReport.watch_count * 2
  ));

  return {
    schema_version: 'ai-comic-series-quality-audit/v1',
    passed: issues.length === 0 && score >= 80,
    score,
    generated_episode_count: generatedEntries.length,
    total_episode_count: params.plan.episode_count,
    episodes_need_attention: unique([
      ...episodesNeedAttention,
      ...threadClosureReport.episodes_need_attention,
      ...memoryConflictReport.episodes_need_attention,
    ]).sort((a, b) => a - b),
    issues: unique(issues),
    checks: {
      all_episodes_generated: allEpisodesGenerated,
      generated_ids_in_plan_range: generatedIdsInPlanRange,
      ledger_covers_generated_episodes: ledgerCoversGeneratedEpisodes,
      completed_series_threads_resolved: completedSeriesThreadsResolved,
      known_episode_quality_pass_rate: knownEpisodeQualityPassRate,
    },
    episode_reports: episodeReports,
    thread_closure_report: threadClosureReport,
    memory_conflict_report: memoryConflictReport,
  };
}

function aiComicSeriesEpisodeReportNeedsRegeneration(report: AiComicSeriesQualityEpisodeReport): boolean {
  return Boolean(report.story_id)
    && report.needs_episode_regeneration === true;
}

function aiComicEpisodesNeedingRegeneration(
  detail: Pick<AiComicSeriesProjectDetail, 'plan' | 'series_quality_audit'>,
  generatedEpisodeContentIssues: Map<number, string[]> = new Map(),
): AiComicEpisodePlan[] {
  const episodes = getPlanEpisodes(detail.plan);
  const reports = detail.series_quality_audit?.episode_reports ?? [];
  const episodeNos = new Set([
    ...generatedEpisodeContentIssues.keys(),
    ...reports
      .filter(aiComicSeriesEpisodeReportNeedsRegeneration)
      .map(report => report.episode_no),
  ]);
  return episodes
    .filter(episode => episodeNos.has(episode.episode_no))
    .sort((a, b) => a.episode_no - b.episode_no);
}

async function buildAiComicGeneratedEpisodeContentIssueMap(
  detail: Pick<AiComicSeriesProjectDetail, 'plan' | 'generated_episode_story_ids'>,
): Promise<Map<number, string[]>> {
  const issuesByEpisode = new Map<number, string[]>();
  for (const episode of getPlanEpisodes(detail.plan)) {
    const storyId = detail.generated_episode_story_ids[String(episode.episode_no)];
    if (!storyId) continue;
    const storyRes = await getStory(storyId);
    if (!storyRes.ok || !storyRes.data) {
      issuesByEpisode.set(episode.episode_no, ['故事文件缺失或无法读取']);
      continue;
    }
    const issues = buildAiComicGeneratedStoryContentIssues(storyRes.data, episode);
    if (issues.length > 0) {
      issuesByEpisode.set(episode.episode_no, issues);
    }
  }
  return issuesByEpisode;
}

function buildAiComicGeneratedStoryContentIssues(
  story: StoryGenerateResult,
  episode: AiComicEpisodePlan,
): string[] {
  const sceneTitles = (story.scene_breakdown ?? []).map(scene => scene.title);
  const text = [
    story.title,
    story.full_text,
    JSON.stringify(story.dialogue ?? []),
    ...(story.scene_breakdown ?? []).flatMap(scene => [
      scene.title,
      scene.plot,
      scene.visual_prompt,
      scene.dialogue_or_narration ?? '',
      scene.key_action,
    ]),
    ...(story.gears_segments ?? []).map(segment => segment.script_text),
  ].filter(Boolean).join('\n');
  const issues: string[] = [];
  const hasInternalTerms = /(生成优先级|核心画面是|知识库使用规则|素材使用规则|连续性账本|叙事流派机制|目标场景功能|新增知识焦点|新增素材焦点|新增剧情信息|推进phase)/.test(text);
  const hasOldPlaceholderTitle = /(问题出现|最终选择|拒签的新变化|主角被迫|第\d+集：第\d+集)/.test(story.title);
  const genericSceneTitleCount = sceneTitles.filter(title =>
    /^(雨夜第\d+集|角色入场|对白交锋|选择时刻|精神定格)$/.test(title)
  ).length;
  const hasGenericSceneTitles = genericSceneTitleCount >= Math.min(3, sceneTitles.length);
  const hasTemplateText = /(周敦颐面对第\d+集|这是他人生的关键时刻|人物登场。周敦颐|冲突爆发。周敦颐|反转\/觉醒。周敦颐|高燃收束。周敦颐|\*\*少年与家庭\*\*)/.test(text);

  if (
    story.ai_comic_episode_quality?.passed === false
    && (hasInternalTerms || hasOldPlaceholderTitle || hasGenericSceneTitles || hasTemplateText)
  ) {
    issues.push('分集质量报告未通过');
  }
  if (
    (story.quality_report?.passed === false || (story.quality_report?.genre_score ?? 100) < 80)
    && (hasInternalTerms || hasOldPlaceholderTitle || hasGenericSceneTitles || hasTemplateText)
  ) {
    issues.push('故事质量报告未通过');
  }
  if (hasInternalTerms) {
    issues.push('正文或分镜仍含内部检测词');
  }
  if (hasOldPlaceholderTitle) {
    issues.push('故事标题仍是旧占位标题');
  }
  if (hasGenericSceneTitles) {
    issues.push('场景标题仍是模板占位');
  }
  if (hasTemplateText) {
    issues.push('正文仍是素材拼贴或模板话术');
  }
  if (episode.title && story.title !== episode.title) {
    issues.push('故事标题未同步当前分集计划');
  }

  return unique(issues);
}

function buildAiComicThreadClosureReport(params: {
  plan: AiComicSeriesPlan;
  generatedEpisodeNumbers: Set<number>;
  ledger: AiComicContinuityLedger;
}): AiComicThreadClosureReport {
  const ledgerRecordsByEpisode = new Map(params.ledger.episode_records.map(record => [record.episode_no, record]));
  const planEpisodes = getPlanEpisodes(params.plan);
  const planThreads = getPlanPlotThreads(params.plan);
  const lastGeneratedEpisodeNo = Math.max(
    params.ledger.last_generated_episode_no ?? 0,
    ...[...params.generatedEpisodeNumbers, 0],
  );
  const items: AiComicThreadClosureItem[] = planThreads.map(thread => {
    const openedInEpisodes = planEpisodes
      .filter(episode => params.generatedEpisodeNumbers.has(episode.episode_no))
      .filter(episode => episodeMentionsThread(episode, ledgerRecordsByEpisode.get(episode.episode_no), thread, 'open'))
      .map(episode => episode.episode_no);
    const paidOffInEpisodes = planEpisodes
      .filter(episode => params.generatedEpisodeNumbers.has(episode.episode_no))
      .filter(episode => episodeMentionsThread(episode, ledgerRecordsByEpisode.get(episode.episode_no), thread, 'payoff'))
      .map(episode => episode.episode_no);
    const relatedEpisodes = unique([
      thread.setup_episode,
      thread.payoff_episode,
      ...openedInEpisodes,
      ...paidOffInEpisodes,
    ]).sort((a, b) => a - b);
    const issues: string[] = [];
    const repairSuggestions: string[] = [];
    const setupAlreadyGenerated = params.generatedEpisodeNumbers.has(thread.setup_episode);
    const payoffAlreadyGenerated = params.generatedEpisodeNumbers.has(thread.payoff_episode);
    const opened = openedInEpisodes.length > 0;
    const paidOff = paidOffInEpisodes.length > 0;

    if (setupAlreadyGenerated && !opened) {
      issues.push(`第${thread.setup_episode}集应打开“${thread.title}”，但账本或卡片中没有明确开启动作`);
      repairSuggestions.push(`在第${thread.setup_episode}集新增“打开：${thread.title}”的场景动作或伏笔描述`);
    }
    if (payoffAlreadyGenerated && !paidOff) {
      issues.push(`第${thread.payoff_episode}集应回收“${thread.title}”，但未形成明确回收`);
      repairSuggestions.push(`在第${thread.payoff_episode}集补充回收场景，并让角色选择因此改变`);
    }
    if (lastGeneratedEpisodeNo > thread.payoff_episode && !paidOff) {
      issues.push(`已生成到第${lastGeneratedEpisodeNo}集，超过计划回收点第${thread.payoff_episode}集`);
      repairSuggestions.push(`优先改第${thread.payoff_episode}集；如要延期，修改线索回收集并重建后续账本`);
    }
    if (opened && !paidOff && lastGeneratedEpisodeNo >= thread.setup_episode) {
      repairSuggestions.push(`后续生成到第${thread.payoff_episode}集前，持续让“${thread.title}”产生新信息或新代价`);
    }

    const status = paidOff
      ? 'paid_off'
      : lastGeneratedEpisodeNo > thread.payoff_episode
        ? 'overdue'
        : opened
          ? lastGeneratedEpisodeNo <= thread.setup_episode ? 'opened' : 'in_progress'
          : 'planned';

    return {
      thread_id: thread.thread_id,
      title: thread.title,
      setup_episode: thread.setup_episode,
      payoff_episode: thread.payoff_episode,
      status,
      opened_in_episodes: openedInEpisodes,
      paid_off_in_episodes: paidOffInEpisodes,
      related_episodes: relatedEpisodes,
      issues,
      repair_suggestions: unique(repairSuggestions),
    };
  });

  const orphanItems = buildOrphanThreadClosureItems(params.plan, params.generatedEpisodeNumbers);
  const duplicateItems = buildDuplicateThreadClosureItems(params.plan, params.generatedEpisodeNumbers);
  const allItems = [...items, ...orphanItems, ...duplicateItems];
  const episodesNeedAttention = unique(allItems
    .filter(item => item.issues.length > 0 || item.status === 'overdue' || item.status === 'orphaned' || item.status === 'duplicate')
    .flatMap(item => item.related_episodes))
    .sort((a, b) => a - b);

  return {
    schema_version: 'ai-comic-thread-closure-report/v1',
    total_thread_count: allItems.length,
    opened_thread_count: allItems.filter(item => ['opened', 'in_progress', 'paid_off', 'overdue'].includes(item.status)).length,
    paid_off_thread_count: allItems.filter(item => item.status === 'paid_off').length,
    overdue_thread_count: allItems.filter(item => item.status === 'overdue').length,
    orphaned_thread_count: allItems.filter(item => item.status === 'orphaned').length,
    duplicate_thread_count: allItems.filter(item => item.status === 'duplicate').length,
    episodes_need_attention: episodesNeedAttention,
    items: allItems,
  };
}

function buildAiComicMemoryConflictReport(params: {
  ledger: AiComicContinuityLedger;
}): AiComicMemoryConflictReport {
  const memory = params.ledger.series_memory;
  const items: AiComicMemoryConflictItem[] = [];

  for (const conflict of memory?.conflicts ?? []) {
    items.push(makeMemoryConflictItem({
      category: inferMemoryConflictCategory(conflict),
      severity: /知识边界|确证|史实|待核/.test(conflict) ? 'blocking' : 'warning',
      title: summarizeText(conflict, 28),
      description: conflict,
      relatedEpisodeNos: extractEpisodeNumbers(conflict),
      relatedMemoryIds: [],
      evidence: [conflict],
      repairSuggestions: [suggestMemoryConflictRepair(conflict)],
    }));
  }

  for (const item of memory ? allSeriesMemoryItems(memory) : []) {
    const text = [item.status, ...item.continuity_notes, item.knowledge_boundary ?? ''].join('；');
    const relatedEpisodeNos = item.related_episode_nos;
    if (item.category === 'character' && /死亡|牺牲|失踪|离开|不能行动/.test(text) && /出现|行动|带领|再次|恢复/.test(text)) {
      items.push(makeMemoryConflictItem({
        category: 'character_state',
        severity: 'blocking',
        title: `${item.label} 状态可能倒退`,
        description: `${item.label} 同时包含“不可行动/离场”和“再次行动/恢复”语义，需要确认是否有明确转折。`,
        relatedEpisodeNos,
        relatedMemoryIds: [item.memory_id],
        evidence: [summarizeText(text, 96)],
        repairSuggestions: [`补写${item.label}恢复/回归的转折，或把后续出场改为回忆、替身、传闻等明确形式。`],
      }));
    }
    if (item.category === 'location' && /损毁|焚毁|封闭|废弃|坍塌|不可进入/.test(text) && /使用|重返|进入|开门|恢复|重新/.test(text)) {
      items.push(makeMemoryConflictItem({
        category: 'location_state',
        severity: 'warning',
        title: `${item.label} 空间状态不一致`,
        description: `${item.label} 同时出现封闭/损毁与继续使用语义，需要解释修复、替代空间或时间跳转。`,
        relatedEpisodeNos,
        relatedMemoryIds: [item.memory_id],
        evidence: [summarizeText(text, 96)],
        repairSuggestions: [`在相关集数中说明${item.label}是否已修复、是否为另一处同名空间，或调整场景地点。`],
      }));
    }
    if (item.category === 'relationship' && /决裂|敌对|疏离|背叛|不信任/.test(text) && /和解|信任|并肩|亲近|托付/.test(text)) {
      items.push(makeMemoryConflictItem({
        category: 'relationship_state',
        severity: 'warning',
        title: `${item.label} 关系状态反复`,
        description: `${item.label} 同时包含破裂与和解/信任语义，需要明确中间转折或阶段。`,
        relatedEpisodeNos,
        relatedMemoryIds: [item.memory_id],
        evidence: [summarizeText(text, 96)],
        repairSuggestions: [`给${item.label}增加关系转折场景，或把当前关系标注为“表面合作/暂时和解”。`],
      }));
    }
    const isKnowledgeBoundaryCaution = /不得写成确证史实|不可把.+写成已核实史实|事实边界和可信度口径/.test(text);
    if (
      item.category === 'knowledge_boundary'
      && !isKnowledgeBoundaryCaution
      && /待核|未核|创作补足|传说|推测/.test(text)
      && /确证|史实|真实|一定|明确/.test(text)
    ) {
      items.push(makeMemoryConflictItem({
        category: 'knowledge_boundary',
        severity: 'blocking',
        title: `${item.label} 知识边界混写`,
        description: `${item.label} 同时出现待核/创作补足与确证史实表述，需要拆分事实与演绎。`,
        relatedEpisodeNos,
        relatedMemoryIds: [item.memory_id],
        evidence: [summarizeText(text, 96)],
        repairSuggestions: [`把${item.label}拆成“可确证事实”和“戏剧化创作”两句，并在提示词中禁止把后者写成史实。`],
      }));
    }
  }

  for (const conflict of params.ledger.production_constraints?.conflicts ?? []) {
    items.push(makeMemoryConflictItem({
      category: 'production_constraint',
      severity: 'watch',
      title: summarizeText(conflict, 28),
      description: conflict,
      relatedEpisodeNos: extractEpisodeNumbers(conflict),
      relatedMemoryIds: [],
      evidence: [conflict],
      repairSuggestions: ['复核对应镜头的运镜、负向约束和连续性说明，避免视频提示词自相矛盾。'],
    }));
  }

  const merged = mergeMemoryConflictItems(items);
  return {
    schema_version: 'ai-comic-memory-conflict-report/v1',
    total_conflict_count: merged.length,
    blocking_count: merged.filter(item => item.severity === 'blocking').length,
    warning_count: merged.filter(item => item.severity === 'warning').length,
    watch_count: merged.filter(item => item.severity === 'watch').length,
    episodes_need_attention: uniqueNumbers(merged.flatMap(item => item.related_episode_nos)),
    items: merged,
  };
}

function makeMemoryConflictItem(params: {
  category: AiComicMemoryConflictCategory;
  severity: AiComicMemoryConflictItem['severity'];
  title: string;
  description: string;
  relatedEpisodeNos: number[];
  relatedMemoryIds: string[];
  evidence: string[];
  repairSuggestions: string[];
}): AiComicMemoryConflictItem {
  const stableKey = [
    params.category,
    params.title,
    params.relatedEpisodeNos.join('-'),
    params.relatedMemoryIds.join('-'),
  ].filter(Boolean).join(':');
  return {
    conflict_id: `memory-conflict-${slugifyConstraintKey(stableKey)}`,
    category: params.category,
    severity: params.severity,
    title: params.title,
    description: params.description,
    related_episode_nos: uniqueNumbers(params.relatedEpisodeNos),
    related_memory_ids: unique(params.relatedMemoryIds),
    evidence: unique(params.evidence.filter(Boolean)).slice(0, 5),
    repair_suggestions: unique(params.repairSuggestions.filter(Boolean)).slice(0, 5),
  };
}

function mergeMemoryConflictItems(items: AiComicMemoryConflictItem[]): AiComicMemoryConflictItem[] {
  const severityRank: Record<AiComicMemoryConflictItem['severity'], number> = {
    watch: 1,
    warning: 2,
    blocking: 3,
  };
  const map = new Map<string, AiComicMemoryConflictItem>();
  for (const item of items) {
    const existing = map.get(item.conflict_id);
    if (!existing) {
      map.set(item.conflict_id, item);
      continue;
    }
    map.set(item.conflict_id, {
      ...existing,
      severity: severityRank[item.severity] > severityRank[existing.severity] ? item.severity : existing.severity,
      related_episode_nos: uniqueNumbers([...existing.related_episode_nos, ...item.related_episode_nos]),
      related_memory_ids: unique([...existing.related_memory_ids, ...item.related_memory_ids]),
      evidence: unique([...existing.evidence, ...item.evidence]).slice(0, 5),
      repair_suggestions: unique([...existing.repair_suggestions, ...item.repair_suggestions]).slice(0, 5),
    });
  }
  return [...map.values()].sort((a, b) =>
    severityRank[b.severity] - severityRank[a.severity]
    || (a.related_episode_nos[0] ?? 999) - (b.related_episode_nos[0] ?? 999)
    || a.title.localeCompare(b.title, 'zh-Hans-CN')
  );
}

function inferMemoryConflictCategory(text: string): AiComicMemoryConflictCategory {
  if (/知识|史实|确证|待核|文化/.test(text)) return 'knowledge_boundary';
  if (/地点|场景|空间|损毁|遗失/.test(text)) return 'location_state';
  if (/关系|对白|信任|决裂/.test(text)) return 'relationship_state';
  if (/镜头|运镜|禁用|约束/.test(text)) return 'production_constraint';
  return 'character_state';
}

function suggestMemoryConflictRepair(text: string): string {
  if (/知识|史实|确证|待核|文化/.test(text)) return '拆分可确证事实与戏剧化补足，避免把待核内容写成史实。';
  if (/损毁|遗失|地点|场景/.test(text)) return '说明修复、替代、找回或时间跳转；否则调整后续场景/道具使用。';
  if (/关系|信任|决裂/.test(text)) return '补充关系转折，或明确当前只是暂时合作、伪装和解。';
  return '回到相关分集卡片和账本，明确状态变化的因果转折。';
}

function extractEpisodeNumbers(text: string): number[] {
  const matches = [...text.matchAll(/第(\d{1,3})集/g)].map(match => Number(match[1]));
  return uniqueNumbers(matches.filter(value => value >= 1 && value <= 120));
}

function episodeMentionsThread(
  episode: AiComicEpisodePlan,
  ledgerRecord: AiComicContinuityLedgerEpisode | undefined,
  thread: AiComicPlotThread,
  mode: 'open' | 'payoff',
): boolean {
  const episodeTexts = mode === 'payoff'
    ? [...(episode.payoff ?? []), episode.thread_action ?? '']
    : [...(episode.foreshadowing ?? []), ...(episode.new_information ?? []), episode.thread_action ?? ''];
  const ledgerTexts = mode === 'payoff'
    ? ledgerRecord?.paid_off_threads ?? []
    : ledgerRecord?.opened_threads ?? [];
  const texts = [...episodeTexts, ...ledgerTexts];
  if (mode === 'open' && episode.episode_no === thread.setup_episode && texts.length === 0) return false;
  if (mode === 'payoff' && episode.episode_no === thread.payoff_episode && texts.length === 0) return false;
  return texts.some(text => textReferencesThread(text, thread));
}

function buildOrphanThreadClosureItems(
  plan: AiComicSeriesPlan,
  generatedEpisodeNumbers: Set<number>,
): AiComicThreadClosureItem[] {
  const items: AiComicThreadClosureItem[] = [];
  const planThreads = getPlanPlotThreads(plan);
  for (const episode of getPlanEpisodes(plan)) {
    if (!generatedEpisodeNumbers.has(episode.episode_no)) continue;
    for (const [index, text] of (episode.foreshadowing ?? []).entries()) {
      if (planThreads.some(thread => textReferencesThread(text, thread))) continue;
      const title = summarizeText(text, 22);
      items.push({
        thread_id: `orphan-${episode.episode_no}-${index + 1}`,
        title,
        setup_episode: episode.episode_no,
        status: 'orphaned',
        opened_in_episodes: [episode.episode_no],
        paid_off_in_episodes: [],
        related_episodes: [episode.episode_no],
        issues: [`第${episode.episode_no}集出现未绑定长期线索的伏笔：${title}`],
        repair_suggestions: [
          `把第${episode.episode_no}集伏笔并入现有长期线索，或新增一条带回收集的长期线索`,
        ],
      });
    }
  }
  return items;
}

function buildDuplicateThreadClosureItems(
  plan: AiComicSeriesPlan,
  generatedEpisodeNumbers: Set<number>,
): AiComicThreadClosureItem[] {
  const groups = new Map<string, Array<{ episode_no: number; text: string }>>();
  for (const episode of getPlanEpisodes(plan)) {
    if (!generatedEpisodeNumbers.has(episode.episode_no)) continue;
    for (const text of episode.foreshadowing ?? []) {
      const key = normalizeThreadText(text);
      if (key.length < 6) continue;
      groups.set(key, [...(groups.get(key) ?? []), { episode_no: episode.episode_no, text }]);
    }
  }

  return [...groups.entries()]
    .filter(([, entries]) => unique(entries.map(entry => entry.episode_no)).length > 1)
    .map(([key, entries], index) => {
      const episodes = unique(entries.map(entry => entry.episode_no)).sort((a, b) => a - b);
      const title = summarizeText(entries[0]?.text ?? key, 22);
      return {
        thread_id: `duplicate-${index + 1}`,
        title,
        status: 'duplicate',
        opened_in_episodes: episodes,
        paid_off_in_episodes: [],
        related_episodes: episodes,
        issues: [`第${episodes.join('、')}集重复出现相同伏笔，但缺少清晰递进变化`],
        repair_suggestions: [
          `保留第${episodes[0]}集开伏笔，后续重复集改成新证据、新代价或明确回收`,
        ],
      };
    });
}

function textReferencesThread(text: string, thread: AiComicPlotThread): boolean {
  const normalizedText = normalizeThreadText(text);
  const candidates = [
    thread.title,
    thread.description,
    ...thread.continuity_notes,
  ].map(normalizeThreadText).filter(Boolean);
  return candidates.some(candidate =>
    normalizedText.includes(candidate)
    || candidate.includes(normalizedText)
    || sameThread(text, thread.title)
  );
}

function normalizeThreadText(text: string): string {
  return text
    .replace(/[第\d一二三四五六七八九十百千万集]/g, '')
    .replace(/[，。；：！？、,.!?:;\s"'“”‘’（）()【】\[\]-]/g, '')
    .trim();
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function rebuildContinuityLedgerFromEpisode(params: {
  plan: AiComicSeriesPlan;
  generatedEpisodeStoryIds: Record<string, string>;
  ledger: AiComicContinuityLedger;
  fromEpisodeNo: number;
}): AiComicContinuityLedger {
  const existingRecordsByEpisode = new Map(params.ledger.episode_records.map(record => [record.episode_no, record]));
  const beforeRecords = params.ledger.episode_records
    .filter(record => record.episode_no < params.fromEpisodeNo)
    .sort((a, b) => a.episode_no - b.episode_no);
  let ledger: AiComicContinuityLedger = buildInitialContinuityLedger(params.plan);

  for (const record of beforeRecords) {
    const episode = params.plan.episodes.find(item => item.episode_no === record.episode_no);
    if (!episode) continue;
    ledger = updateContinuityLedgerFromEpisodePlan({
      ledger,
      plan: params.plan,
      episode,
      storyId: record.story_id,
      generatedAt: record.generated_at,
      knowledgeUsed: record.knowledge_used,
    });
  }

  const generatedEpisodes = params.plan.episodes
    .filter(episode => episode.episode_no >= params.fromEpisodeNo)
    .filter(episode => Boolean(params.generatedEpisodeStoryIds[String(episode.episode_no)]))
    .sort((a, b) => a.episode_no - b.episode_no);

  for (const episode of generatedEpisodes) {
    const storyId = params.generatedEpisodeStoryIds[String(episode.episode_no)];
    if (!storyId) continue;
    const existingRecord = existingRecordsByEpisode.get(episode.episode_no);
    ledger = updateContinuityLedgerFromEpisodePlan({
      ledger,
      plan: params.plan,
      episode,
      storyId,
      generatedAt: existingRecord?.generated_at,
      knowledgeUsed: existingRecord?.knowledge_used,
    });
  }

  return ledger;
}

function hasEpisodePlanChangedAfterGeneration(params: {
  episode: AiComicEpisodePlan;
  ledgerRecord: AiComicContinuityLedgerEpisode;
}): boolean {
  return params.episode.title !== params.ledgerRecord.title
    || params.episode.ending_hook !== params.ledgerRecord.ending_hook
    || !sameStringList(params.episode.continuity_state_after, params.ledgerRecord.character_state)
    || !sameStringList(params.episode.knowledge_focus, params.ledgerRecord.knowledge_used);
}

function sameStringList(left: string[], right: string[]): boolean {
  const normalize = (items: string[]) => items
    .map(item => item.trim())
    .filter(Boolean)
    .sort();
  const leftNormalized = normalize(left);
  const rightNormalized = normalize(right);
  if (leftNormalized.length !== rightNormalized.length) return false;
  return leftNormalized.every((item, index) => item === rightNormalized[index]);
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

function seriesProjectsRoot(): string {
  return resolve(generatedRoot(), 'ai-comic-series-projects');
}

function seriesProjectsRoots(): string[] {
  return generatedRoots().map(root => resolve(root, 'ai-comic-series-projects'));
}

function seriesProjectPath(seriesProjectId: string): string {
  const primaryPath = resolve(seriesProjectsRoot(), seriesProjectId, 'project.json');
  return primaryPath;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readSeriesProject(seriesProjectId: string): Promise<StoredAiComicSeriesProject | null> {
  const detail = await seriesProjectRepository().read(seriesProjectId);
  if (!detail) return null;
  const plan = normalizeAiComicSeriesPlan(detail.plan);
  const continuityLedger = normalizeContinuityLedger(detail.continuity_ledger, plan);
  const visualBible = buildAiComicSeriesVisualBible({
    plan,
    ledger: continuityLedger,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids ?? {},
    assetLibrary: detail.seedance_asset_library,
    previousVisualBible: detail.visual_bible,
    generatedAt: detail.visual_bible?.generated_at,
  });
  return {
    ...detail,
    plan,
    continuity_ledger: continuityLedger,
    memory_recall_preferences: normalizeMemoryRecallPreferences(detail.memory_recall_preferences),
    seedance_production: normalizeSeedanceProductionLedger(detail.seedance_production),
    seedance_asset_library: cloneSeedanceAssetLibrary(detail.seedance_asset_library),
    seedance_cut_assembly: cloneSeedanceCutAssemblyLedger(detail.seedance_cut_assembly),
    seedance_subtitle_render: cloneSeedanceSubtitleRenderLedger(detail.seedance_subtitle_render),
    seedance_audio_library: cloneSeedanceAudioLibrary(detail.seedance_audio_library),
    seedance_audio_mix: cloneSeedanceAudioMixLedger(detail.seedance_audio_mix),
    seedance_title_card_render: cloneSeedanceTitleCardRenderLedger(detail.seedance_title_card_render),
    seedance_final_delivery: cloneSeedanceFinalDeliveryLedger(detail.seedance_final_delivery),
    seedance_review_ledger: cloneSeedanceReviewLedger(detail.seedance_review_ledger),
    gears_job_ledger: normalizeGearsJobLedger(detail.gears_job_ledger),
    series_quality_audit: detail.series_quality_audit ?? buildAiComicSeriesQualityAudit({
      plan,
      generatedEpisodeStoryIds: detail.generated_episode_story_ids ?? {},
      ledger: continuityLedger,
    }),
    premise_fidelity_audit: auditAiComicSeriesPremiseFidelity(plan),
    commercial_quality_audit: auditAiComicSeriesCommercialQuality(
      plan,
      detail.commercial_quality_audit?.human_review,
      detail.generated_episode_story_ids ?? {},
    ),
    visual_bible: visualBible,
  };
}

function seriesProjectRepository(): FileSeriesProjectRepository {
  const primaryRoot = seriesProjectsRoot();
  return new FileSeriesProjectRepository(primaryRoot, {
    fallback_roots: seriesProjectsRoots().filter(root => root !== primaryRoot),
  });
}

function generateSeriesProjectId(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const hash = Math.random().toString(36).slice(2, 10);
  return `${ymd}-series-${hash}`;
}

function buildSeriesProjectMeta(params: {
  seriesProjectId: string;
  plan: AiComicSeriesPlan;
  createdAt: string;
  updatedAt: string;
  generatedEpisodeStoryIds: Record<string, string>;
  archivedAt?: string;
  accessControl?: ProductResourceOwnership;
}): AiComicSeriesProjectMeta {
  const meta: AiComicSeriesProjectMeta = {
    series_project_id: params.seriesProjectId,
    title: params.plan.series_title,
    episode_count: params.plan.episode_count,
    episode_duration_range_sec: params.plan.episode_duration_range_sec,
    pacing_profile: params.plan.pacing_profile,
    logline: params.plan.logline,
    created_at: params.createdAt,
    updated_at: params.updatedAt,
    generated_episode_count: Object.keys(params.generatedEpisodeStoryIds).length,
    ...(params.accessControl ? { access_control: params.accessControl } : {}),
  };
  if (params.archivedAt) meta.archived_at = params.archivedAt;
  return meta;
}

function buildInitialContinuityLedger(plan: AiComicSeriesPlan): AiComicContinuityLedger {
  const characters = getPlanMainCharacters(plan);
  const plotThreads = getPlanPlotThreads(plan);
  return {
    schema_version: 'ai-comic-continuity-ledger/v1',
    character_state_current: characters.map(character =>
      `${character.name}：${character.starting_state}`,
    ),
    open_threads: plotThreads
      .filter(thread => thread.setup_episode === 1)
      .map(thread => `${thread.title}：${thread.description}`),
    paid_off_threads: [],
    knowledge_used: [],
    episode_records: [],
    series_memory: buildInitialSeriesMemory(plan),
    production_constraints: buildInitialProductionConstraints(plan),
    episodic_memory: buildInitialEpisodicMemoryIndex(),
  };
}

function normalizeContinuityLedger(
  ledger: AiComicContinuityLedger | undefined,
  plan: AiComicSeriesPlan,
): AiComicContinuityLedger {
  const base = ledger ?? buildInitialContinuityLedger(plan);
  return {
    ...base,
    character_state_current: base.character_state_current ?? [],
    open_threads: base.open_threads ?? [],
    paid_off_threads: base.paid_off_threads ?? [],
    knowledge_used: base.knowledge_used ?? [],
    episode_records: (base.episode_records ?? []).map(record => ({
      ...record,
      memory_events: record.memory_events ?? [],
    })),
    series_memory: base.series_memory ?? buildInitialSeriesMemory(plan),
    production_constraints: normalizeProductionConstraints(base.production_constraints, plan),
    episodic_memory: base.episodic_memory ?? buildInitialEpisodicMemoryIndex(),
  };
}

function normalizeMemoryRecallPreferences(
  preferences?: AiComicSeriesMemoryRecallPreferences,
  updatedAt?: string,
): AiComicSeriesMemoryRecallPreferences {
  const globalLocked = unique(preferences?.locked_memory_ids ?? []);
  const perEpisode = Object.fromEntries(
    Object.entries(preferences?.per_episode ?? {}).map(([episodeNo, controls]) => {
      const locked = unique(controls.locked_memory_ids ?? []);
      return [episodeNo, {
        locked_memory_ids: locked,
        excluded_memory_ids: unique(controls.excluded_memory_ids ?? []).filter(id => !locked.includes(id)),
      }];
    }),
  );
  return {
    locked_memory_ids: globalLocked,
    excluded_memory_ids: unique(preferences?.excluded_memory_ids ?? [])
      .filter(id => !globalLocked.includes(id)),
    per_episode: perEpisode,
    updated_at: preferences?.updated_at ?? updatedAt,
  };
}

function cloneMemoryRecallPreferences(
  preferences?: AiComicSeriesMemoryRecallPreferences,
): AiComicSeriesMemoryRecallPreferences {
  return {
    locked_memory_ids: [...(preferences?.locked_memory_ids ?? [])],
    excluded_memory_ids: [...(preferences?.excluded_memory_ids ?? [])],
    per_episode: Object.fromEntries(
      Object.entries(preferences?.per_episode ?? {}).map(([episodeNo, controls]) => [episodeNo, {
        locked_memory_ids: [...(controls.locked_memory_ids ?? [])],
        excluded_memory_ids: [...(controls.excluded_memory_ids ?? [])],
      }]),
    ),
    updated_at: preferences?.updated_at,
  };
}

function normalizeSeedanceProductionLedger(
  ledger?: AiComicSeedanceProductionLedger,
): AiComicSeedanceProductionLedger {
  return reconcileSeedanceProductionExecutionCosts({
    schema_version: 'ai-comic-seedance-production-ledger/v1',
    updated_at: ledger?.updated_at,
    items: (ledger?.items ?? []).map(item => ({
      ...item,
      external_call_authorization: item.external_call_authorization
        ? { ...item.external_call_authorization }
        : undefined,
      execution_cost: item.execution_cost
        ? { ...item.execution_cost }
        : undefined,
      retry_count: item.retry_count ?? 0,
      notes: [...(item.notes ?? [])],
      versions: normalizeSeedanceVideoVersions(item),
      selected_version_id: item.selected_version_id,
    })),
  });
}

function cloneSeedanceProductionLedger(
  ledger?: AiComicSeedanceProductionLedger,
): AiComicSeedanceProductionLedger {
  const normalized = normalizeSeedanceProductionLedger(ledger);
  return {
    ...normalized,
    items: normalized.items.map(item => ({
      ...item,
      notes: [...item.notes],
    })),
  };
}

function normalizeSeedanceAssetLibrary(
  library?: AiComicSeedanceAssetLibrary,
): AiComicSeedanceAssetLibrary {
  return {
    schema_version: 'ai-comic-seedance-asset-library/v1',
    updated_at: library?.updated_at,
    items: (library?.items ?? [])
      .filter(item => item.label?.trim())
      .map(item => ({
        asset_id: item.asset_id || seedanceAssetId(item.kind, item.label),
        kind: item.kind,
        label: item.label.trim(),
        reference_slot: item.reference_slot,
        file_url: item.file_url,
        file_id: item.file_id,
        local_path: item.local_path,
        original_filename: item.original_filename,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        provider: item.provider,
        provider_asset_id: item.provider_asset_id,
        content_sha256: item.content_sha256,
        prompt_sha256: item.prompt_sha256,
        model: item.model,
        rights_status: item.rights_status,
        authorization_reference: item.authorization_reference,
        person_consent_reference: item.person_consent_reference,
        human_review_status: item.human_review_status,
        reviewer_id: item.reviewer_id,
        reviewed_at: item.reviewed_at,
        review_note: item.review_note,
        identity_binding: item.identity_binding
          ? { ...item.identity_binding }
          : undefined,
        history: item.history?.map(event => ({ ...event })),
        description: item.description,
        updated_at: item.updated_at ?? library?.updated_at ?? new Date(0).toISOString(),
      })),
  };
}

function cloneSeedanceAssetLibrary(
  library?: AiComicSeedanceAssetLibrary,
): AiComicSeedanceAssetLibrary {
  const normalized = normalizeSeedanceAssetLibrary(library);
  return {
    ...normalized,
    items: normalized.items.map(item => ({
      ...item,
      identity_binding: item.identity_binding
        ? { ...item.identity_binding }
        : undefined,
      history: item.history?.map(event => ({ ...event })),
    })),
  };
}

function normalizeSeedanceAudioLibrary(
  library?: AiComicSeedanceAudioLibrary,
): AiComicSeedanceAudioLibrary {
  return {
    schema_version: 'ai-comic-seedance-audio-library/v1',
    updated_at: library?.updated_at,
    items: (library?.items ?? [])
      .filter(item => item.label?.trim())
      .map(item => ({
        asset_id: item.asset_id || seedanceAudioAssetId(item.kind, item.label),
        kind: item.kind,
        label: item.label.trim(),
        file_url: item.file_url,
        file_id: item.file_id,
        duration_sec: item.duration_sec,
        license_note: item.license_note,
        loopable: item.loopable,
        bpm: item.bpm,
        mood_tags: [...(item.mood_tags ?? [])],
        updated_at: item.updated_at ?? library?.updated_at ?? new Date(0).toISOString(),
      })),
  };
}

function cloneSeedanceAudioLibrary(
  library?: AiComicSeedanceAudioLibrary,
): AiComicSeedanceAudioLibrary {
  const normalized = normalizeSeedanceAudioLibrary(library);
  return {
    ...normalized,
    items: normalized.items.map(item => ({
      ...item,
      mood_tags: [...item.mood_tags],
    })),
  };
}

function normalizeSeedanceCutAssemblyLedger(
  ledger?: AiComicSeedanceCutAssemblyLedger,
): AiComicSeedanceCutAssemblyLedger | undefined {
  if (!ledger) return undefined;
  return {
    schema_version: 'ai-comic-seedance-cut-assembly-ledger/v1',
    updated_at: ledger.updated_at,
    status: ledger.status ?? 'not_started',
    output_path: ledger.output_path,
    output_filename: ledger.output_filename,
    concat_list_path: ledger.concat_list_path,
    ffmpeg_command: ledger.ffmpeg_command,
    assembly_mode: ledger.assembly_mode,
    output_profile: ledger.output_profile,
    assembled_at: ledger.assembled_at,
    failure_reason: ledger.failure_reason,
    dry_run: ledger.dry_run,
    source_episode_no: ledger.source_episode_no,
    source_shot_count: ledger.source_shot_count ?? 0,
    missing_shot_count: ledger.missing_shot_count ?? 0,
  };
}

function cloneSeedanceCutAssemblyLedger(
  ledger?: AiComicSeedanceCutAssemblyLedger,
): AiComicSeedanceCutAssemblyLedger | undefined {
  const normalized = normalizeSeedanceCutAssemblyLedger(ledger);
  return normalized ? { ...normalized } : undefined;
}

function normalizeSeedanceSubtitleRenderLedger(
  ledger?: AiComicSeedanceSubtitleRenderLedger,
): AiComicSeedanceSubtitleRenderLedger | undefined {
  if (!ledger) return undefined;
  return {
    schema_version: 'ai-comic-seedance-subtitle-render-ledger/v1',
    updated_at: ledger.updated_at,
    status: ledger.status ?? 'not_started',
    mode: ledger.mode ?? 'sidecar',
    episode_no: ledger.episode_no,
    srt_path: ledger.srt_path,
    srt_filename: ledger.srt_filename,
    output_path: ledger.output_path,
    output_filename: ledger.output_filename,
    ffmpeg_command: ledger.ffmpeg_command,
    rendered_at: ledger.rendered_at,
    failure_reason: ledger.failure_reason,
    dry_run: ledger.dry_run,
    cue_count: ledger.cue_count ?? 0,
    source_cut_output_path: ledger.source_cut_output_path,
  };
}

function cloneSeedanceSubtitleRenderLedger(
  ledger?: AiComicSeedanceSubtitleRenderLedger,
): AiComicSeedanceSubtitleRenderLedger | undefined {
  const normalized = normalizeSeedanceSubtitleRenderLedger(ledger);
  return normalized ? { ...normalized } : undefined;
}

function normalizeSeedanceAudioMixLedger(
  ledger?: AiComicSeedanceAudioMixLedger,
): AiComicSeedanceAudioMixLedger | undefined {
  if (!ledger) return undefined;
  return {
    schema_version: 'ai-comic-seedance-audio-mix-ledger/v1',
    updated_at: ledger.updated_at,
    status: ledger.status ?? 'not_started',
    episode_no: ledger.episode_no,
    output_path: ledger.output_path,
    output_filename: ledger.output_filename,
    input_video_path: ledger.input_video_path,
    ffmpeg_command: ledger.ffmpeg_command,
    mixed_at: ledger.mixed_at,
    failure_reason: ledger.failure_reason,
    dry_run: ledger.dry_run,
    audio_profile: ledger.audio_profile ?? 'balanced_dialogue',
    include_original_audio: ledger.include_original_audio,
    original_audio_volume_db: ledger.original_audio_volume_db,
    source_audio_count: ledger.source_audio_count ?? 0,
    missing_audio_count: ledger.missing_audio_count ?? 0,
  };
}

function cloneSeedanceAudioMixLedger(
  ledger?: AiComicSeedanceAudioMixLedger,
): AiComicSeedanceAudioMixLedger | undefined {
  const normalized = normalizeSeedanceAudioMixLedger(ledger);
  return normalized ? { ...normalized } : undefined;
}

function normalizeSeedanceTitleCardRenderLedger(
  ledger?: AiComicSeedanceTitleCardRenderLedger,
): AiComicSeedanceTitleCardRenderLedger | undefined {
  if (!ledger) return undefined;
  return {
    schema_version: 'ai-comic-seedance-title-card-render-ledger/v1',
    updated_at: ledger.updated_at,
    status: ledger.status ?? 'not_started',
    output_profile: ledger.output_profile ?? 'mp4_h264_1080p',
    card_count: ledger.card_count ?? 0,
    rendered_count: ledger.rendered_count ?? 0,
    output_paths: [...(ledger.output_paths ?? [])],
    ffmpeg_commands: [...(ledger.ffmpeg_commands ?? [])],
    rendered_at: ledger.rendered_at,
    failure_reason: ledger.failure_reason,
    dry_run: ledger.dry_run,
    font_path: ledger.font_path,
  };
}

function cloneSeedanceTitleCardRenderLedger(
  ledger?: AiComicSeedanceTitleCardRenderLedger,
): AiComicSeedanceTitleCardRenderLedger | undefined {
  const normalized = normalizeSeedanceTitleCardRenderLedger(ledger);
  return normalized
    ? {
        ...normalized,
        output_paths: [...normalized.output_paths],
        ffmpeg_commands: [...normalized.ffmpeg_commands],
      }
    : undefined;
}

function normalizeSeedanceFinalDeliveryLedger(
  ledger?: AiComicSeedanceFinalDeliveryLedger,
): AiComicSeedanceFinalDeliveryLedger | undefined {
  if (!ledger) return undefined;
  return {
    schema_version: 'ai-comic-seedance-final-delivery-ledger/v1',
    updated_at: ledger.updated_at,
    status: ledger.status ?? 'not_started',
    output_path: ledger.output_path,
    output_filename: ledger.output_filename,
    manifest_path: ledger.manifest_path,
    ffmpeg_command: ledger.ffmpeg_command,
    source_cut_path: ledger.source_cut_path,
    subtitle_path: ledger.subtitle_path,
    audio_mix_path: ledger.audio_mix_path,
    title_card_paths: [...(ledger.title_card_paths ?? [])],
    delivered_at: ledger.delivered_at,
    failure_reason: ledger.failure_reason,
    dry_run: ledger.dry_run,
    output_profile: ledger.output_profile ?? 'mp4_h264_1080p',
    dependency_status: ledger.dependency_status ?? {
      cut_ready: false,
      subtitle_ready: false,
      audio_mix_ready: false,
      title_cards_ready: false,
      title_card_paths: [],
      missing_dependencies: [],
      warnings: [],
    },
    current_release: ledger.current_release ? { ...ledger.current_release } : undefined,
    release_history: ledger.release_history?.map(item => ({ ...item })) ?? [],
    rollback_events: ledger.rollback_events?.map(item => ({ ...item })) ?? [],
  };
}

function cloneSeedanceFinalDeliveryLedger(
  ledger?: AiComicSeedanceFinalDeliveryLedger,
): AiComicSeedanceFinalDeliveryLedger | undefined {
  const normalized = normalizeSeedanceFinalDeliveryLedger(ledger);
  return normalized
    ? {
        ...normalized,
        title_card_paths: [...normalized.title_card_paths],
        dependency_status: {
          ...normalized.dependency_status,
          title_card_paths: [...normalized.dependency_status.title_card_paths],
          missing_dependencies: [...normalized.dependency_status.missing_dependencies],
          warnings: [...normalized.dependency_status.warnings],
        },
        current_release: normalized.current_release ? { ...normalized.current_release } : undefined,
        release_history: normalized.release_history?.map(item => ({ ...item })) ?? [],
        rollback_events: normalized.rollback_events?.map(item => ({ ...item })) ?? [],
      }
    : undefined;
}

function normalizeSeedanceReviewLedger(
  ledger?: AiComicSeedanceReviewLedger,
): AiComicSeedanceReviewLedger | undefined {
  if (!ledger) return undefined;
  const items = (ledger.items ?? []).map(normalizeSeedanceReviewItem);
  return summarizeSeedanceReviewLedger(items, ledger.updated_at);
}

function normalizeSeedanceReviewItem(item: AiComicSeedanceReviewItem): AiComicSeedanceReviewItem {
  return {
    review_id: item.review_id,
    target_type: item.target_type ?? 'final',
    target_id: item.target_id,
    episode_no: item.episode_no,
    shot_id: item.shot_id,
    status: item.status ?? 'open',
    severity: item.severity ?? 'major',
    issue_type: item.issue_type ?? 'other',
    note: item.note ?? '',
    repair_action: item.repair_action ?? seedanceReviewDefaultRepairAction(item.issue_type ?? 'other', item.target_type ?? 'final'),
    created_at: item.created_at,
    created_by: item.created_by,
    resolved_at: item.resolved_at,
    resolved_note: item.resolved_note,
  };
}

function cloneSeedanceReviewLedger(
  ledger?: AiComicSeedanceReviewLedger,
): AiComicSeedanceReviewLedger | undefined {
  const normalized = normalizeSeedanceReviewLedger(ledger);
  return normalized
    ? {
        ...normalized,
        items: normalized.items.map(item => ({ ...item })),
      }
    : undefined;
}

function summarizeSeedanceReviewLedger(
  items: AiComicSeedanceReviewItem[],
  updatedAt?: string,
): AiComicSeedanceReviewLedger {
  const openItems = items.filter(item => seedanceReviewItemOpen(item));
  return {
    schema_version: 'ai-comic-seedance-review-ledger/v1',
    updated_at: updatedAt,
    open_count: openItems.length,
    resolved_count: items.length - openItems.length,
    blocking_count: openItems.filter(item => item.severity === 'blocking').length,
    final_reassemble_required: openItems.some(item => item.repair_action === 'reassemble_final'),
    items,
  };
}

function resolveSeedanceFinalReassembleReviews(
  ledger: AiComicSeedanceReviewLedger | undefined,
  resolvedAt: string,
  resolvedNote: string,
): AiComicSeedanceReviewLedger | undefined {
  if (!ledger) return ledger;
  const updatedItems = ledger.items.map(item =>
    seedanceReviewItemOpen(item) && item.repair_action === 'reassemble_final'
      ? {
          ...item,
          status: 'resolved' as const,
          resolved_at: resolvedAt,
          resolved_note: resolvedNote,
        }
      : item
  );
  return summarizeSeedanceReviewLedger(updatedItems, resolvedAt);
}

function seedanceReviewItemOpen(item: AiComicSeedanceReviewItem): boolean {
  return item.status === 'open' || item.status === 'in_progress';
}

function generateSeedanceReviewId(): string {
  return `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedanceReviewDefaultTargetId(
  detail: AiComicSeriesProjectDetail,
  targetType: AiComicSeedanceReviewAddRequest['target_type'],
): string {
  if (targetType === 'final') return detail.seedance_final_delivery?.output_path ?? 'final_delivery';
  if (targetType === 'cut') return detail.seedance_cut_assembly?.output_path ?? 'cut_assembly';
  if (targetType === 'subtitle') return detail.seedance_subtitle_render?.output_path ?? detail.seedance_subtitle_render?.srt_path ?? 'subtitle_render';
  if (targetType === 'audio') return detail.seedance_audio_mix?.output_path ?? 'audio_mix';
  if (targetType === 'title_card') return detail.seedance_title_card_render?.output_paths[0] ?? 'title_card_render';
  return 'shot';
}

function seedanceReviewDefaultRepairAction(
  issueType: AiComicSeedanceReviewItem['issue_type'],
  targetType: AiComicSeedanceReviewItem['target_type'],
): AiComicSeedanceReviewRepairAction {
  if (targetType === 'shot') {
    return issueType === 'technical' ? 'reselect_version' : 'redo_shot';
  }
  if (targetType === 'subtitle' || issueType === 'subtitle') return 'revise_subtitle';
  if (targetType === 'audio' || issueType === 'audio') return 'adjust_audio';
  if (targetType === 'title_card' || issueType === 'title_card') return 'revise_title_card';
  if (targetType === 'final' || targetType === 'cut') return 'reassemble_final';
  return 'manual_review';
}

function buildSeedanceReviewRepairPackageItem(
  item: AiComicSeedanceReviewItem,
): AiComicSeriesSeedanceReviewRepairPackageItem {
  return {
    review_id: item.review_id,
    target_type: item.target_type,
    target_id: item.target_id,
    episode_no: item.episode_no,
    shot_id: item.shot_id,
    severity: item.severity,
    issue_type: item.issue_type,
    note: item.note,
    repair_action: item.repair_action,
    suggested_next_step: seedanceReviewSuggestedNextStep(item),
  };
}

function seedanceReviewSuggestedNextStep(item: AiComicSeedanceReviewItem): string {
  const map: Record<AiComicSeedanceReviewRepairAction, string> = {
    redo_shot: '加入 Seedance 重试包，重做该镜头并保留旧版本用于对比。',
    reselect_version: '回到版本对比，重新选择可用剪辑版或标记人工替换。',
    revise_subtitle: '修订字幕 cue 或重新渲染字幕，再刷新最终交付。',
    adjust_audio: '调整音频素材或混音参数，再重新生成混音。',
    revise_title_card: '修改片头片尾卡文本或视觉，再重新渲染卡片。',
    reassemble_final: '刷新最终交付装配，必要时重新写出 final manifest。',
    manual_review: '进入人工复核，明确返修归属后再分派到镜头、字幕、音频或最终装配。',
  };
  return map[item.repair_action];
}

function buildAiComicSeriesSeedanceReviewRepairMarkdown(
  pkg: Omit<AiComicSeriesSeedanceReviewRepairPackage, 'markdown'>,
): string {
  return [
    `# ${pkg.series_title} — Seedance 审片返修包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> seriesProjectId: ${pkg.project.series_project_id}`,
    `> exportedAt: ${pkg.exported_at}`,
    `> openReviews: ${pkg.open_count}`,
    `> blockingReviews: ${pkg.blocking_count}`,
    `> retryCandidates: ${pkg.retry_candidate_count}`,
    `> finalReassembleRequired: ${pkg.final_reassemble_required ? 'yes' : 'no'}`,
    '',
    '## 返修项',
    ...markdownTable(
      ['ID', '目标', '严重度', '问题', '返修动作', '备注', '建议'],
      pkg.items.map(item => [
        item.review_id,
        [
          seedanceReviewTargetTypeText(item.target_type),
          item.episode_no ? `第${item.episode_no}集` : '',
          item.shot_id ?? item.target_id ?? '',
        ].filter(Boolean).join(' · '),
        seedanceReviewSeverityText(item.severity),
        seedanceReviewIssueTypeText(item.issue_type),
        seedanceReviewRepairActionText(item.repair_action),
        item.note,
        item.suggested_next_step,
      ]),
    ),
  ].join('\n');
}

function seedanceReviewTargetTypeText(targetType: AiComicSeedanceReviewItem['target_type']): string {
  const map: Record<AiComicSeedanceReviewItem['target_type'], string> = {
    shot: '镜头',
    cut: '剪辑版',
    final: '最终成片',
    subtitle: '字幕',
    audio: '音频',
    title_card: '片头片尾',
  };
  return map[targetType];
}

function seedanceReviewSeverityText(severity: AiComicSeedanceReviewItem['severity']): string {
  const map: Record<AiComicSeedanceReviewItem['severity'], string> = {
    blocking: '阻断',
    major: '主要',
    minor: '轻微',
    note: '备注',
  };
  return map[severity];
}

function seedanceReviewIssueTypeText(issueType: AiComicSeedanceReviewItem['issue_type']): string {
  const map: Record<AiComicSeedanceReviewItem['issue_type'], string> = {
    visual: '画面',
    continuity: '连续性',
    subtitle: '字幕',
    audio: '音频',
    pacing: '节奏',
    title_card: '片头片尾',
    technical: '技术',
    compliance: '合规',
    other: '其它',
  };
  return map[issueType];
}

function seedanceReviewRepairActionText(action: AiComicSeedanceReviewRepairAction): string {
  const map: Record<AiComicSeedanceReviewRepairAction, string> = {
    redo_shot: '镜头重做',
    reselect_version: '版本重选',
    revise_subtitle: '字幕修订',
    adjust_audio: '音频调整',
    revise_title_card: '片头片尾修改',
    reassemble_final: '最终重装配',
    manual_review: '人工复核',
  };
  return map[action];
}

function syncSeedanceProductionLedgerWithExport(params: {
  ledger?: AiComicSeedanceProductionLedger;
  episodes: AiComicSeriesSeedanceEpisodePackage[];
  exportedAt: string;
}): AiComicSeedanceProductionLedger {
  const map = new Map(normalizeSeedanceProductionLedger(params.ledger).items.map(item => [item.production_id, item]));
  for (const episode of params.episodes) {
    for (const unit of episode.package.shot_units) {
      const productionId = seedanceProductionId(episode.episode_no, unit.shot_id);
      const existing = map.get(productionId);
      const status = existing && existing.status !== 'not_started'
        ? existing.status
        : 'prompt_exported';
      map.set(productionId, {
        production_id: productionId,
        episode_no: episode.episode_no,
        episode_title: episode.episode_title,
        story_id: episode.story_id,
        shot_id: unit.shot_id,
        source_scene_id: unit.source_scene_id,
        status,
        prompt_exported_at: existing?.prompt_exported_at ?? params.exportedAt,
        submitted_at: existing?.submitted_at,
        completed_at: existing?.completed_at,
        updated_at: existing?.updated_at ?? params.exportedAt,
        provider_job_id: existing?.provider_job_id,
        external_call_authorization: existing?.external_call_authorization
          ? { ...existing.external_call_authorization }
          : undefined,
        execution_cost: existing?.execution_cost
          ? { ...existing.execution_cost }
          : undefined,
        video_url: existing?.video_url,
      failure_reason: existing?.failure_reason,
      retry_count: existing?.retry_count ?? 0,
      notes: unique([
        ...(existing?.notes ?? []),
        `提示词已导出：${params.exportedAt}`,
      ]).slice(-12),
      versions: normalizeSeedanceVideoVersions(existing),
      selected_version_id: existing?.selected_version_id,
    });
    }
  }
  return {
    schema_version: 'ai-comic-seedance-production-ledger/v1',
    updated_at: params.exportedAt,
    items: [...map.values()].sort((a, b) =>
      a.episode_no - b.episode_no || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN')
    ),
  };
}

function buildAiComicSeedanceExecutionCostRecord(input: {
  actualCostAmount: number;
  costCurrency: string;
  authorization?: ExternalProviderCallAuthorizationRecord;
  providerReportedAt: string;
}): AiComicSeedanceExecutionCostRecord {
  const boundaryStatus = !input.authorization
    ? 'authorization_missing'
    : input.authorization.cost_currency !== input.costCurrency
      ? 'currency_mismatch'
      : input.actualCostAmount > input.authorization.max_cost_amount
        ? 'exceeded_authorization'
        : 'within_authorization';
  return {
    actual_cost_amount: input.actualCostAmount,
    cost_currency: input.costCurrency,
    provider_reported_at: input.providerReportedAt,
    reporting_channel: 'callback_or_poll',
    boundary_status: boundaryStatus,
    authorization_reference: input.authorization?.authorization_reference,
    authorized_max_cost_amount: input.authorization?.max_cost_amount,
    authorization_total_actual_cost_amount: input.actualCostAmount,
  };
}

interface AiComicSeedanceExecutionCostEvidence {
  executionKey: string;
  authorization?: ExternalProviderCallAuthorizationRecord;
  executionCost: AiComicSeedanceExecutionCostRecord;
}

function collectSeedanceExecutionCostEvidence(
  ledger: AiComicSeedanceProductionLedger,
): AiComicSeedanceExecutionCostEvidence[] {
  const evidenceByExecutionKey = new Map<string, AiComicSeedanceExecutionCostEvidence>();
  for (const item of ledger.items) {
    for (const version of item.versions) {
      if (!version.execution_cost) continue;
      const authorization = version.external_call_authorization;
      const authorizationKey = authorization?.authorization_reference ?? 'authorization-missing';
      const executionKey = `${authorizationKey}::${item.production_id}::${version.provider_job_id ?? version.version_id}`;
      evidenceByExecutionKey.set(executionKey, {
        executionKey,
        authorization,
        executionCost: version.execution_cost,
      });
    }
    if (item.execution_cost) {
      const authorization = item.external_call_authorization;
      const authorizationKey = authorization?.authorization_reference ?? 'authorization-missing';
      const executionKey = `${authorizationKey}::${item.production_id}::${item.provider_job_id ?? 'current'}`;
      evidenceByExecutionKey.set(executionKey, {
        executionKey,
        authorization,
        executionCost: item.execution_cost,
      });
    }
  }
  return [...evidenceByExecutionKey.values()];
}

function reconcileSeedanceExecutionCostRecord(input: {
  executionCost: AiComicSeedanceExecutionCostRecord;
  authorization?: ExternalProviderCallAuthorizationRecord;
  evidenceByAuthorization: Map<string, AiComicSeedanceExecutionCostEvidence[]>;
}): AiComicSeedanceExecutionCostRecord {
  if (!input.authorization) {
    return {
      ...input.executionCost,
      boundary_status: 'authorization_missing',
      authorization_reference: undefined,
      authorized_max_cost_amount: undefined,
      authorization_total_actual_cost_amount: input.executionCost.actual_cost_amount,
    };
  }
  const group = input.evidenceByAuthorization.get(input.authorization.authorization_reference) ?? [];
  const currencyMismatch = group.some(evidence => (
    evidence.executionCost.cost_currency !== input.authorization!.cost_currency
    || evidence.authorization?.cost_currency !== input.authorization!.cost_currency
  ));
  const aggregateAmount = Math.round(group.reduce(
    (total, evidence) => total + evidence.executionCost.actual_cost_amount,
    0,
  ) * 1_000_000) / 1_000_000;
  return {
    ...input.executionCost,
    boundary_status: currencyMismatch
      ? 'currency_mismatch'
      : aggregateAmount > input.authorization.max_cost_amount
        ? 'exceeded_authorization'
        : 'within_authorization',
    authorization_reference: input.authorization.authorization_reference,
    authorized_max_cost_amount: input.authorization.max_cost_amount,
    authorization_total_actual_cost_amount: aggregateAmount,
  };
}

function reconcileSeedanceProductionExecutionCosts(
  ledger: AiComicSeedanceProductionLedger,
): AiComicSeedanceProductionLedger {
  const evidenceByAuthorization = new Map<string, AiComicSeedanceExecutionCostEvidence[]>();
  for (const evidence of collectSeedanceExecutionCostEvidence(ledger)) {
    const reference = evidence.authorization?.authorization_reference;
    if (!reference) continue;
    const group = evidenceByAuthorization.get(reference) ?? [];
    group.push(evidence);
    evidenceByAuthorization.set(reference, group);
  }
  return {
    ...ledger,
    items: ledger.items.map(item => ({
      ...item,
      execution_cost: item.execution_cost
        ? reconcileSeedanceExecutionCostRecord({
          executionCost: item.execution_cost,
          authorization: item.external_call_authorization,
          evidenceByAuthorization,
        })
        : undefined,
      versions: item.versions.map(version => ({
        ...version,
        execution_cost: version.execution_cost
          ? reconcileSeedanceExecutionCostRecord({
            executionCost: version.execution_cost,
            authorization: version.external_call_authorization,
            evidenceByAuthorization,
          })
          : undefined,
      })),
    })),
  };
}

function summarizeSeedanceExecutionCostGovernance(
  ledger?: AiComicSeedanceProductionLedger,
): AiComicSeedanceExecutionCostGovernanceSummary {
  const normalized = normalizeSeedanceProductionLedger(ledger);
  const evidence = collectSeedanceExecutionCostEvidence(normalized);
  const boundaryViolations = evidence.filter(item => (
    item.executionCost.boundary_status !== 'within_authorization'
  ));
  const authorizedShotCount = normalized.items.filter(item => item.external_call_authorization).length;
  const summary = {
    authorized_shot_count: authorizedShotCount,
    reported_cost_count: evidence.length,
    pending_terminal_cost_report_count: normalized.items.filter(item => (
      item.external_call_authorization
      && (item.status === 'ready' || item.status === 'failed' || item.status === 'skipped')
      && !item.execution_cost
    )).length,
    boundary_violation_count: boundaryViolations.length,
    exceeded_authorization_count: boundaryViolations.filter(item => (
      item.executionCost.boundary_status === 'exceeded_authorization'
    )).length,
    currency_mismatch_count: boundaryViolations.filter(item => (
      item.executionCost.boundary_status === 'currency_mismatch'
    )).length,
    authorization_missing_count: boundaryViolations.filter(item => (
      item.executionCost.boundary_status === 'authorization_missing'
    )).length,
  };
  return {
    status: summary.boundary_violation_count > 0 || summary.pending_terminal_cost_report_count > 0
      ? 'blocked'
      : authorizedShotCount === 0 && evidence.length === 0
        ? 'not_applicable'
        : 'clear',
    ...summary,
  };
}

function updateSeedanceProductionLedger(params: {
  ledger?: AiComicSeedanceProductionLedger;
  episodeTitle: string;
  storyId?: string;
  request: AiComicSeedanceProductionStatusUpdateRequest;
  updatedAt: string;
  externalCallAuthorization?: ExternalProviderCallAuthorizationRecord;
  executionCost?: AiComicSeedanceExecutionCostRecord;
}): AiComicSeedanceProductionLedger {
  const ledger = normalizeSeedanceProductionLedger(params.ledger);
  const productionId = seedanceProductionId(params.request.episode_no, params.request.shot_id);
  const existing = ledger.items.find(item => item.production_id === productionId);
  const versions = appendSeedanceVideoVersion({
    existing,
    request: params.request,
    updatedAt: params.updatedAt,
    externalCallAuthorization: params.externalCallAuthorization,
    executionCost: params.executionCost,
  });
  const next: AiComicSeedanceShotProductionItem = {
    production_id: productionId,
    episode_no: params.request.episode_no,
    episode_title: existing?.episode_title ?? params.episodeTitle,
    story_id: existing?.story_id ?? params.storyId,
    shot_id: params.request.shot_id,
    source_scene_id: existing?.source_scene_id,
    status: params.request.status,
    prompt_exported_at: existing?.prompt_exported_at,
    submitted_at: params.request.status === 'submitted' || params.request.status === 'processing'
      ? existing?.submitted_at ?? params.updatedAt
      : existing?.submitted_at,
    completed_at: params.request.status === 'ready' || params.request.status === 'failed'
      ? params.updatedAt
      : existing?.completed_at,
    updated_at: params.updatedAt,
    provider_job_id: params.request.provider_job_id ?? existing?.provider_job_id,
    external_call_authorization: params.externalCallAuthorization
      ? { ...params.externalCallAuthorization }
      : existing?.external_call_authorization
        ? { ...existing.external_call_authorization }
        : undefined,
    execution_cost: params.executionCost
      ? { ...params.executionCost }
      : params.externalCallAuthorization
        ? undefined
        : existing?.execution_cost
          ? { ...existing.execution_cost }
          : undefined,
    video_url: params.request.video_url ?? existing?.video_url,
    failure_reason: params.request.failure_reason ?? (params.request.status === 'failed' ? existing?.failure_reason : undefined),
    retry_count: (existing?.retry_count ?? 0) + (params.request.increment_retry ? 1 : 0),
    notes: unique([
      ...(existing?.notes ?? []),
      params.request.note ?? '',
    ].filter(Boolean)).slice(-12),
    versions,
    selected_version_id: versions.some(version => version.version_id === existing?.selected_version_id)
      ? existing?.selected_version_id
      : undefined,
  };
  const items = [
    ...ledger.items.filter(item => item.production_id !== productionId),
    next,
  ].sort((a, b) => a.episode_no - b.episode_no || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN'));
  return reconcileSeedanceProductionExecutionCosts({
    schema_version: 'ai-comic-seedance-production-ledger/v1',
    updated_at: params.updatedAt,
    items,
  });
}

function normalizeSeedanceVideoVersions(
  item?: Partial<AiComicSeedanceShotProductionItem>,
): AiComicSeedanceVideoVersion[] {
  return (item?.versions ?? []).map(version => ({
    ...version,
    version_id: version.version_id,
    status: version.status,
    created_at: version.created_at,
    external_call_authorization: version.external_call_authorization
      ? { ...version.external_call_authorization }
      : undefined,
    execution_cost: version.execution_cost
      ? { ...version.execution_cost }
      : undefined,
  }));
}

function appendSeedanceVideoVersion(params: {
  existing?: AiComicSeedanceShotProductionItem;
  request: AiComicSeedanceProductionStatusUpdateRequest;
  updatedAt: string;
  externalCallAuthorization?: ExternalProviderCallAuthorizationRecord;
  executionCost?: AiComicSeedanceExecutionCostRecord;
}): AiComicSeedanceVideoVersion[] {
  const versions = normalizeSeedanceVideoVersions(params.existing);
  const shouldAppend = Boolean(
    params.request.video_url
    || params.request.provider_job_id
    || params.request.failure_reason
    || params.request.status === 'ready'
    || params.request.status === 'failed'
  );
  if (!shouldAppend) return versions;
  const nextVersion: AiComicSeedanceVideoVersion = {
    version_id: `${seedanceProductionId(params.request.episode_no, params.request.shot_id)}-v${versions.length + 1}`,
    status: params.request.status,
    created_at: params.updatedAt,
    provider_job_id: params.request.provider_job_id ?? params.existing?.provider_job_id,
    video_url: params.request.video_url ?? params.existing?.video_url,
    failure_reason: params.request.failure_reason,
    note: params.request.note,
    quality_score: params.request.quality_score,
    review_note: params.request.review_note,
    external_call_authorization: params.externalCallAuthorization
      ? { ...params.externalCallAuthorization }
      : params.existing?.external_call_authorization
        ? { ...params.existing.external_call_authorization }
        : undefined,
    execution_cost: params.executionCost
      ? { ...params.executionCost }
      : undefined,
  };
  const last = versions[versions.length - 1];
  if (
    last
    && last.status === nextVersion.status
    && last.provider_job_id === nextVersion.provider_job_id
    && last.video_url === nextVersion.video_url
    && last.failure_reason === nextVersion.failure_reason
  ) {
    if (!params.executionCost) return versions;
    return versions.map((version, index) => index === versions.length - 1
      ? { ...version, execution_cost: { ...params.executionCost! } }
      : version);
  }
  return [...versions, nextVersion].slice(-12);
}

function seedanceProductionId(episodeNo: number, shotId: string): string {
  return `seedance-e${episodeNo}-${slugifyConstraintKey(shotId)}`;
}

function seedanceAudioAssetId(kind: AiComicSeedanceFinishingAudioCue['kind'], label: string): string {
  return `audio-${kind}-${slugifyConstraintKey(label)}`;
}

function seedanceThumbnailFilename(episodeNo: number, shotId: string): string {
  return `e${String(episodeNo).padStart(2, '0')}-${slugifyConstraintKey(shotId)}.jpg`;
}

function seedanceCutAssemblyFilename(seriesProjectId: string, episodeNo?: number): string {
  const scope = episodeNo ? `e${String(episodeNo).padStart(2, '0')}` : 'full-series';
  return `${seriesProjectId}-${scope}-seedance-cut.mp4`;
}

function seedanceSubtitleFilename(seriesProjectId: string, episodeNo?: number, requested?: string): string {
  if (requested?.trim()) return requested.trim();
  const scope = episodeNo ? `e${String(episodeNo).padStart(2, '0')}` : 'full-series';
  return `${seriesProjectId}-${scope}-seedance-subtitles.srt`;
}

function seedanceSubtitleBurnInFilename(seriesProjectId: string, episodeNo?: number, requested?: string): string {
  const trimmed = requested?.trim();
  if (trimmed?.toLowerCase().endsWith('.mp4')) return trimmed;
  if (trimmed?.toLowerCase().endsWith('.srt')) return trimmed.replace(/\.srt$/i, '.subtitled.mp4');
  const scope = episodeNo ? `e${String(episodeNo).padStart(2, '0')}` : 'full-series';
  return `${seriesProjectId}-${scope}-seedance-subtitled.mp4`;
}

function seedanceAudioMixFilename(seriesProjectId: string, episodeNo?: number): string {
  const scope = episodeNo ? `e${String(episodeNo).padStart(2, '0')}` : 'full-series';
  return `${seriesProjectId}-${scope}-seedance-audio-mix.mp4`;
}

function buildSeedanceAudioPlanCue(
  cue: AiComicSeedanceFinishingAudioCue,
  libraryById: Map<string, AiComicSeedanceAudioLibrary['items'][number]>,
): AiComicSeedanceAudioPlanCue {
  const assetLabel = seedanceAudioCueAssetLabel(cue);
  const assetId = seedanceAudioAssetId(cue.kind, assetLabel);
  const asset = libraryById.get(assetId);
  const isBound = Boolean(asset?.file_url || asset?.file_id);
  const assetStatus: AiComicSeedanceAudioPlanCue['asset_status'] = isBound
    ? 'bound'
    : cue.priority === 'optional'
      ? 'optional_missing'
      : 'missing_asset';
  return {
    ...cue,
    asset_id: assetId,
    asset_label: assetLabel,
    asset_status: assetStatus,
    file_url: asset?.file_url,
    file_id: asset?.file_id,
    asset_duration_sec: asset?.duration_sec,
    loopable: asset?.loopable,
    volume_db: seedanceAudioDefaultVolume(cue.kind),
    ducking: cue.kind === 'music' || cue.kind === 'ambient',
    fade_in_sec: cue.kind === 'music' || cue.kind === 'ambient' ? 1.5 : 0.1,
    fade_out_sec: cue.kind === 'music' || cue.kind === 'ambient' ? 1.5 : 0.1,
    mix_track: cue.kind,
    generated_prompt: cue.text,
    needs_manual_review: assetStatus === 'missing_asset',
  };
}

function seedanceAudioCueAssetLabel(cue: AiComicSeedanceFinishingAudioCue): string {
  if (cue.kind === 'music' && cue.cue_id === 'aud-series-bed') return '系列配乐底';
  if (cue.kind === 'ambient' && cue.shot_id) return `环境声-${cue.shot_id}`;
  if (cue.kind === 'sound_effect' && cue.shot_id) return `音效-${cue.shot_id}`;
  if (cue.kind === 'dialogue' && cue.shot_id) return `对白处理-${cue.shot_id}`;
  if (cue.kind === 'narration' && cue.shot_id) return `旁白处理-${cue.shot_id}`;
  return `${seedanceAudioKindText(cue.kind)}-第${cue.episode_no}集`;
}

function seedanceAudioDefaultVolume(kind: AiComicSeedanceFinishingAudioCue['kind']): number {
  const map: Record<AiComicSeedanceFinishingAudioCue['kind'], number> = {
    dialogue: -6,
    narration: -7,
    music: -18,
    sound_effect: -12,
    ambient: -24,
  };
  return map[kind];
}

function seedanceAudioProfileVolume(
  baseVolumeDb: number,
  kind: AiComicSeedanceFinishingAudioCue['kind'],
  profile: AiComicSeedanceAudioMixProfile,
): number {
  if (profile === 'music_forward' && kind === 'music') return baseVolumeDb + 4;
  if (profile === 'music_forward' && (kind === 'dialogue' || kind === 'narration')) return baseVolumeDb - 1;
  if (profile === 'ambient_soft' && kind === 'ambient') return baseVolumeDb - 4;
  if (profile === 'ambient_soft' && kind === 'sound_effect') return baseVolumeDb - 2;
  return baseVolumeDb;
}

function seedanceAudioMixScope(
  audioPlan: AiComicSeriesSeedanceAudioPlanPackage,
  episodeNo?: number,
): {
  selectedCueCount: number;
  boundCues: AiComicSeedanceAudioPlanCue[];
  missingAudioCount: number;
} {
  if (episodeNo === undefined) {
    return {
      selectedCueCount: audioPlan.audio_cues.length,
      boundCues: audioPlan.audio_cues.filter(cue => cue.asset_status === 'bound'),
      missingAudioCount: audioPlan.missing_audio_count,
    };
  }

  const episodeCues = audioPlan.audio_cues.filter(cue =>
    cue.episode_no === episodeNo && cue.cue_id !== 'aud-series-bed'
  );
  if (episodeCues.length === 0) {
    return { selectedCueCount: 0, boundCues: [], missingAudioCount: 0 };
  }
  const baseStartSec = Math.min(...episodeCues.map(cue => cue.start_sec));
  const episodeEndSec = Math.max(...episodeCues.map(cue => cue.end_sec));
  const episodeDurationSec = Math.max(0.5, episodeEndSec - baseStartSec);
  const selectedCues = audioPlan.audio_cues
    .filter(cue => cue.episode_no === episodeNo || cue.cue_id === 'aud-series-bed')
    .map(cue => {
      if (cue.cue_id === 'aud-series-bed') {
        return {
          ...cue,
          episode_no: episodeNo,
          start_sec: 0,
          end_sec: episodeDurationSec,
        };
      }
      const startSec = Math.max(0, cue.start_sec - baseStartSec);
      return {
        ...cue,
        start_sec: startSec,
        end_sec: Math.max(startSec + 0.1, cue.end_sec - baseStartSec),
      };
    });
  const missingAudioCount = audioPlan.missing_audio.filter(item =>
    item.episode_no === episodeNo || item.cue_id === 'aud-series-bed'
  ).length;
  return {
    selectedCueCount: selectedCues.length,
    boundCues: selectedCues.filter(cue => cue.asset_status === 'bound'),
    missingAudioCount,
  };
}

function seedanceMixSourceMatches(sourceEpisodeNo: number | undefined, requestedEpisodeNo: number | undefined): boolean {
  if (requestedEpisodeNo === undefined) return true;
  return sourceEpisodeNo === requestedEpisodeNo;
}

function seedanceAudioMixDefaultInputPath(
  detail: AiComicSeriesProjectDetail,
  episodeNo?: number,
): string | undefined {
  if (
    detail.seedance_subtitle_render?.status === 'ready'
    && detail.seedance_subtitle_render.mode === 'burn_in'
    && detail.seedance_subtitle_render.output_path
    && seedanceMixSourceMatches(detail.seedance_subtitle_render.episode_no, episodeNo)
  ) {
    return detail.seedance_subtitle_render.output_path;
  }
  if (
    detail.seedance_cut_assembly?.output_path
    && seedanceMixSourceMatches(detail.seedance_cut_assembly.source_episode_no, episodeNo)
  ) {
    return detail.seedance_cut_assembly.output_path;
  }
  return undefined;
}

async function resolveSeedanceAudioMixRunnerInputs(
  projectDir: string,
  audioInputs: SeedanceAudioMixInput[],
): Promise<SeedanceAudioMixInput[]> {
  const resolvedInputs: SeedanceAudioMixInput[] = [];
  for (const input of audioInputs) {
    const inputPath = input.input_path.trim();
    if (isProtocolPath(inputPath)) {
      throw new Error(
        `Seedance audio mix real runner requires local audio files; remote or protocol path is not supported: ${input.input_path}`,
      );
    }
    const resolvedPath = resolveSeedanceProjectOutputPath(projectDir, inputPath);
    if (!(await pathExists(resolvedPath))) {
      throw new Error(`Seedance audio mix input audio not found: ${input.input_path}`);
    }
    resolvedInputs.push({
      ...input,
      input_path: resolvedPath,
    });
  }
  return resolvedInputs;
}

function isProtocolPath(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function seedanceTitleCardFilename(cardId: string): string {
  return `${slugifyConstraintKey(cardId)}.mp4`;
}

function seedanceFinalDeliveryFilename(seriesProjectId: string): string {
  return `${seriesProjectId}-seedance-final.mp4`;
}

function seedanceFinalDeliveryManifestFilename(outputFilename: string): string {
  const stem = outputFilename.replace(/\.[^/.]+$/, '');
  return `${stem || 'seedance-final'}.manifest.json`;
}

function seedanceFinalManifestDeliverableStatus(
  status: AiComicSeriesSeedanceFinalDeliveryResult['status'],
): AiComicSeedanceFinalDeliveryManifestDeliverableStatus {
  if (status === 'assembled') return 'ready';
  return status;
}

function buildSeedanceFinalDeliveryManifest(params: {
  project: AiComicSeriesProjectMeta;
  seriesTitle: string;
  generatedAt: string;
  dryRun: boolean;
  status: AiComicSeriesSeedanceFinalDeliveryResult['status'];
  outputProfile: AiComicSeedanceFinalDeliveryOutputProfile;
  outputPath: string;
  outputFilename: string;
  manifestPath: string;
  concatListPath?: string;
  ffmpegCommand: string;
  dependencyStatus: AiComicSeedanceFinalDependencyStatus;
  costGovernance: AiComicSeedanceExecutionCostGovernanceSummary;
  includeSubtitles: boolean;
  includeAudioMix: boolean;
  includeTitleCards: boolean;
  failureReason?: string;
  manifestDeliverableStatus: AiComicSeedanceFinalDeliveryManifestDeliverableStatus;
}): AiComicSeedanceFinalDeliveryManifest {
  const inputs: AiComicSeedanceFinalDeliveryManifestInput[] = [
    {
      input_id: 'source-cut',
      input_type: 'source_cut',
      path: params.dependencyStatus.source_cut_path ?? '',
      ready: params.dependencyStatus.cut_ready,
      role: 'final delivery source video',
      notes: params.dependencyStatus.source_cut_path ? [] : ['剪辑装配输出缺失'],
    },
  ];
  if (params.includeSubtitles || params.dependencyStatus.subtitle_path) {
    inputs.push({
      input_id: 'subtitle-render',
      input_type: 'subtitle',
      path: params.dependencyStatus.subtitle_path ?? '',
      ready: params.dependencyStatus.subtitle_ready,
      role: 'subtitle sidecar or burn-in source',
      notes: params.dependencyStatus.subtitle_path ? [] : ['字幕文件或烧录字幕输出缺失'],
    });
  }
  if (params.includeAudioMix || params.dependencyStatus.audio_mix_path) {
    inputs.push({
      input_id: 'audio-mix',
      input_type: 'audio_mix',
      path: params.dependencyStatus.audio_mix_path ?? '',
      ready: params.dependencyStatus.audio_mix_ready,
      role: 'mixed audio source',
      notes: params.dependencyStatus.audio_mix_path ? [] : ['混音输出缺失'],
    });
  }
  if (params.includeTitleCards && params.dependencyStatus.title_card_paths.length === 0) {
    inputs.push({
      input_id: 'title-card-missing',
      input_type: 'title_card',
      path: '',
      ready: false,
      role: 'opening or closing card source',
      notes: ['片头片尾卡输出缺失'],
    });
  } else {
    params.dependencyStatus.title_card_paths.forEach((path, index) => {
      inputs.push({
        input_id: `title-card-${index + 1}`,
        input_type: 'title_card',
        path,
        ready: params.dependencyStatus.title_cards_ready,
        role: 'opening or closing card source',
        notes: [],
      });
    });
  }
  if (params.concatListPath) {
    inputs.push({
      input_id: 'concat-list',
      input_type: 'concat_list',
      path: params.concatListPath,
      ready: params.status !== 'failed',
      role: 'ffmpeg concat list',
      notes: params.dryRun ? ['dry-run 也会写入 concat list 以便复核'] : [],
    });
  }

  const deliverables: AiComicSeedanceFinalDeliveryManifestDeliverable[] = [
    {
      deliverable_id: 'final-video',
      deliverable_type: 'final_video',
      path: params.outputPath,
      status: seedanceFinalManifestDeliverableStatus(params.status),
      notes: [
        params.dryRun ? 'dry-run 仅规划最终视频输出' : '',
        params.failureReason ? `失败：${params.failureReason}` : '',
      ].filter(Boolean),
    },
    {
      deliverable_id: 'delivery-manifest',
      deliverable_type: 'manifest',
      path: params.manifestPath,
      status: params.manifestDeliverableStatus,
      notes: ['最终交付清单 JSON'],
    },
  ];
  if (params.concatListPath) {
    deliverables.push({
      deliverable_id: 'concat-list',
      deliverable_type: 'concat_list',
      path: params.concatListPath,
      status: params.status === 'failed' ? 'failed' : 'ready',
      notes: ['ffmpeg concat 输入列表'],
    });
  }

  const validationNotes = [
    params.dryRun ? 'dry-run：未执行最终 ffmpeg 输出' : '已请求执行最终 ffmpeg 输出',
    params.dependencyStatus.missing_dependencies.length > 0
      ? `缺失依赖：${params.dependencyStatus.missing_dependencies.join('；')}`
      : '依赖已满足',
    ...params.dependencyStatus.warnings,
    seedanceFinalDeliveryCostGovernanceNote(params.costGovernance),
    params.failureReason ? `失败：${params.failureReason}` : '',
  ].filter(Boolean);

  return {
    schema_version: 'ai-comic-seedance-final-delivery-manifest/v1',
    project: params.project,
    series_title: params.seriesTitle,
    generated_at: params.generatedAt,
    dry_run: params.dryRun,
    status: params.status,
    output_profile: params.outputProfile,
    output_path: params.outputPath,
    output_filename: params.outputFilename,
    manifest_path: params.manifestPath,
    concat_list_path: params.concatListPath,
    ffmpeg_command: params.ffmpegCommand,
    dependency_status: params.dependencyStatus,
    cost_governance: { ...params.costGovernance },
    inputs,
    deliverables,
    validation_notes: validationNotes,
  };
}

function seedanceFinalDeliveryCostGovernanceNote(
  summary: AiComicSeedanceExecutionCostGovernanceSummary,
): string {
  if (summary.status === 'not_applicable') {
    return 'Seedance 费用治理：无外部授权镜头或费用回执';
  }
  if (summary.status === 'blocked') {
    return `Seedance 费用治理：阻断（待结算 ${summary.pending_terminal_cost_report_count}，越界 ${summary.boundary_violation_count}）`;
  }
  return `Seedance 费用治理：通过（已授权镜头 ${summary.authorized_shot_count}，费用回执 ${summary.reported_cost_count}）`;
}

function buildSeedanceTitleCardPlanCard(
  seriesProjectId: string,
  card: AiComicSeriesSeedanceFinishingPlanPackage['title_cards'][number],
  ffmpegPath: string,
): AiComicSeedanceTitleCardPlanCard {
  const outputFilename = seedanceTitleCardFilename(card.card_id);
  const outputPath = `title-cards/${seriesProjectId}/${outputFilename}`;
  const planCard: AiComicSeedanceTitleCardPlanCard = {
    card_id: card.card_id,
    placement: card.placement,
    episode_no: card.episode_no,
    duration_sec: card.duration_sec,
    text: card.text,
    visual_note: card.visual_note,
    safe_area: '上下左右 8% 文字安全区',
    font_style: '高对比白字，半透明深色底，不遮挡主体',
    background_source: card.episode_no ? `episode-${card.episode_no}-theme-frame` : 'series-key-visual',
    transition_in: card.placement.endsWith('opening') ? 'fade_in' : 'cut',
    transition_out: card.placement.endsWith('ending') ? 'fade_out' : 'cut',
    output_filename: outputFilename,
    output_path: outputPath,
    ffmpeg_command_hint: '',
  };
  return {
    ...planCard,
    ffmpeg_command_hint: buildFfmpegTitleCardCommand(
      ffmpegPath,
      planCard,
      'mp4_h264_1080p',
      '<FFMPEG_FONT_PATH>',
      outputPath,
    ),
  };
}

function buildSeedanceEditingPlatformTimeline(
  finishingPlan: AiComicSeriesSeedanceFinishingPlanPackage,
  titleCardPlan: AiComicSeriesSeedanceTitleCardPlanPackage,
): {
  timeline: AiComicSeedanceEditingPlatformTimelineItem[];
  shotTimelineStartByKey: Map<string, number>;
  totalDurationSec: number;
} {
  const timeline: AiComicSeedanceEditingPlatformTimelineItem[] = [];
  const shotTimelineStartByKey = new Map<string, number>();
  const titleCards = titleCardPlan.cards;
  const shotsByEpisode = new Map<number, AiComicSeedanceFinishingShot[]>();
  for (const shot of finishingPlan.shots) {
    shotsByEpisode.set(shot.episode_no, [...(shotsByEpisode.get(shot.episode_no) ?? []), shot]);
  }
  const episodeNos = [...shotsByEpisode.keys()].sort((a, b) => a - b);
  let cursorSec = 0;

  const addTitleCard = (card: AiComicSeedanceTitleCardPlanCard | undefined) => {
    if (!card) return;
    const startSec = roundSeedanceTimelineSecond(cursorSec);
    const endSec = roundSeedanceTimelineSecond(startSec + card.duration_sec);
    timeline.push({
      item_id: `timeline-title-${slugifyConstraintKey(card.card_id)}`,
      item_type: 'title_card',
      track: 'title',
      episode_no: card.episode_no,
      source_id: card.card_id,
      source_path: card.output_path,
      label: seedanceTitleCardPlacementText(card.placement),
      start_sec: startSec,
      end_sec: endSec,
      duration_sec: roundSeedanceTimelineSecond(endSec - startSec),
      source_start_sec: 0,
      source_end_sec: card.duration_sec,
      transition_in: card.transition_in,
      transition_out: card.transition_out,
      notes: [
        card.text,
        card.visual_note,
      ].filter(Boolean),
    });
    cursorSec = endSec;
  };

  addTitleCard(titleCards.find(card => card.placement === 'series_opening'));
  for (const episodeNo of episodeNos) {
    addTitleCard(titleCards.find(card => card.placement === 'episode_opening' && card.episode_no === episodeNo));
    const shots = (shotsByEpisode.get(episodeNo) ?? [])
      .sort((a, b) => a.order_index - b.order_index || compareSeedanceShotIds(a.shot_id, b.shot_id));
    for (const shot of shots) {
      const startSec = roundSeedanceTimelineSecond(cursorSec);
      const endSec = roundSeedanceTimelineSecond(startSec + shot.duration_sec);
      shotTimelineStartByKey.set(seedanceEditingShotKey(shot.episode_no, shot.shot_id), startSec);
      timeline.push({
        item_id: `timeline-shot-e${shot.episode_no}-${slugifyConstraintKey(shot.shot_id)}`,
        item_type: 'video_shot',
        track: 'video',
        episode_no: shot.episode_no,
        source_id: shot.production_id,
        source_path: shot.video_url,
        label: `第${shot.episode_no}集 ${shot.shot_id}`,
        start_sec: startSec,
        end_sec: endSec,
        duration_sec: roundSeedanceTimelineSecond(endSec - startSec),
        source_start_sec: 0,
        source_end_sec: shot.duration_sec,
        notes: [
          `原始剪辑时间 ${formatSeconds(shot.start_sec)}-${formatSeconds(shot.end_sec)}`,
          shot.selected_version_id ? `选中版本 ${shot.selected_version_id}` : '',
          shot.subtitle_cue_ids.length > 0 ? `字幕 ${shot.subtitle_cue_ids.join('、')}` : '',
          shot.audio_cue_ids.length > 0 ? `音频 ${shot.audio_cue_ids.join('、')}` : '',
        ].filter(Boolean),
      });
      cursorSec = endSec;
    }
    addTitleCard(titleCards.find(card => card.placement === 'episode_ending' && card.episode_no === episodeNo));
  }
  addTitleCard(titleCards.find(card => card.placement === 'series_ending'));

  return {
    timeline,
    shotTimelineStartByKey,
    totalDurationSec: roundSeedanceTimelineSecond(cursorSec),
  };
}

function buildSeedanceEditingPlatformSubtitleCues(
  finishingPlan: AiComicSeriesSeedanceFinishingPlanPackage,
  shotTimelineStartByKey: Map<string, number>,
): AiComicSeedanceEditingPlatformSubtitleCue[] {
  const shotByKey = new Map(finishingPlan.shots.map(shot => [
    seedanceEditingShotKey(shot.episode_no, shot.shot_id),
    shot,
  ]));
  return finishingPlan.subtitle_cues
    .map(cue => {
      const key = seedanceEditingShotKey(cue.episode_no, cue.shot_id);
      const shot = shotByKey.get(key);
      const timelineShotStartSec = shotTimelineStartByKey.get(key);
      const offsetSec = shot && timelineShotStartSec !== undefined
        ? timelineShotStartSec - shot.start_sec
        : 0;
      const startSec = roundSeedanceTimelineSecond(Math.max(0, cue.start_sec + offsetSec));
      const endSec = roundSeedanceTimelineSecond(Math.max(startSec + 0.5, cue.end_sec + offsetSec));
      return {
        cue_id: cue.cue_id,
        episode_no: cue.episode_no,
        shot_id: cue.shot_id,
        start_sec: startSec,
        end_sec: endSec,
        start_timecode: formatSrtTimecode(startSec),
        end_timecode: formatSrtTimecode(endSec),
        text: cue.text,
        source: cue.source,
      };
    })
    .sort((a, b) => a.start_sec - b.start_sec || a.end_sec - b.end_sec || a.cue_id.localeCompare(b.cue_id));
}

function buildSeedanceEditingPlatformAssets(params: {
  detail: AiComicSeriesProjectDetail;
  finishingPlan: AiComicSeriesSeedanceFinishingPlanPackage;
  subtitlePackage: AiComicSeriesSeedanceSubtitlePackage;
  audioPlan: AiComicSeriesSeedanceAudioPlanPackage;
  titleCardPlan: AiComicSeriesSeedanceTitleCardPlanPackage;
}): AiComicSeedanceEditingPlatformAsset[] {
  const assetMap = new Map<string, AiComicSeedanceEditingPlatformAsset>();
  const pushAsset = (asset: AiComicSeedanceEditingPlatformAsset) => {
    const existing = assetMap.get(asset.asset_id);
    if (!existing) {
      assetMap.set(asset.asset_id, {
        ...asset,
        notes: unique(asset.notes),
      });
      return;
    }
    assetMap.set(asset.asset_id, {
      ...existing,
      path_or_url: existing.path_or_url ?? asset.path_or_url,
      status: mergeSeedanceEditingAssetStatus(existing.status, asset.status),
      missing: existing.missing && asset.missing,
      notes: unique([...existing.notes, ...asset.notes]),
    });
  };

  for (const shot of params.finishingPlan.shots) {
    pushAsset({
      asset_id: `video-${shot.production_id}`,
      asset_type: 'video',
      label: `第${shot.episode_no}集 ${shot.shot_id}`,
      path_or_url: shot.video_url,
      episode_no: shot.episode_no,
      shot_id: shot.shot_id,
      status: 'ready',
      source: 'seedance_finishing_plan.shots',
      missing: false,
      notes: [
        shot.selected_version_id ? `选中版本 ${shot.selected_version_id}` : '',
        `时长 ${shot.duration_sec} 秒`,
      ].filter(Boolean),
    });
    if (shot.thumbnail_path) {
      pushAsset({
        asset_id: `thumbnail-${shot.production_id}`,
        asset_type: 'thumbnail',
        label: `第${shot.episode_no}集 ${shot.shot_id} 缩略图`,
        path_or_url: shot.thumbnail_path,
        episode_no: shot.episode_no,
        shot_id: shot.shot_id,
        status: 'ready',
        source: 'seedance_finishing_plan.shots.thumbnail_path',
        missing: false,
        notes: ['可作为剪辑软件海报帧或项目素材封面'],
      });
    }
  }

  for (const card of params.titleCardPlan.cards) {
    pushAsset({
      asset_id: `title-card-${card.card_id}`,
      asset_type: 'title_card',
      label: seedanceTitleCardPlacementText(card.placement),
      path_or_url: card.output_path,
      episode_no: card.episode_no,
      status: seedanceEditingTitleCardStatus(params.detail, card.output_path),
      source: 'seedance_title_card_plan.cards',
      missing: false,
      notes: [
        card.text,
        `${card.transition_in}/${card.transition_out}`,
      ],
    });
  }

  pushAsset({
    asset_id: 'subtitle-srt-full-series',
    asset_type: 'subtitle',
    label: '全系列 SRT 字幕',
    path_or_url: params.subtitlePackage.srt_path,
    status: 'planned',
    source: 'seedance_subtitle_package.srt_path',
    missing: false,
    notes: [`${params.subtitlePackage.cue_count} 条 cue；剪辑平台包内 srt_content 已按片头片尾时间线重新偏移`],
  });

  for (const cue of params.audioPlan.audio_cues) {
    pushAsset({
      asset_id: `audio-${cue.asset_id}`,
      asset_type: 'audio',
      label: cue.asset_label,
      path_or_url: cue.file_url ?? cue.file_id,
      episode_no: cue.episode_no,
      shot_id: cue.shot_id,
      status: seedanceEditingAudioAssetStatus(cue.asset_status),
      source: 'seedance_audio_plan.audio_cues',
      missing: cue.asset_status !== 'bound',
      notes: [
        seedanceAudioKindText(cue.kind),
        `音量 ${cue.volume_db}dB`,
        cue.generated_prompt,
      ],
    });
  }

  if (params.detail.seedance_final_delivery?.output_path) {
    pushAsset({
      asset_id: 'final-delivery',
      asset_type: 'final_delivery',
      label: 'Seedance 最终交付视频',
      path_or_url: params.detail.seedance_final_delivery.output_path,
      status: seedanceEditingLedgerAssetStatus(params.detail.seedance_final_delivery.status),
      source: 'seedance_final_delivery.output_path',
      missing: params.detail.seedance_final_delivery.status === 'failed',
      notes: [
        `profile ${params.detail.seedance_final_delivery.output_profile}`,
        params.detail.seedance_final_delivery.ffmpeg_command ?? '',
      ].filter(Boolean),
    });
  }

  return [...assetMap.values()].sort((a, b) =>
    seedanceEditingAssetTypeRank(a.asset_type) - seedanceEditingAssetTypeRank(b.asset_type)
    || (a.episode_no ?? 0) - (b.episode_no ?? 0)
    || (a.shot_id ?? '').localeCompare(b.shot_id ?? '', 'zh-Hans-CN')
    || a.label.localeCompare(b.label, 'zh-Hans-CN')
  );
}

function buildSeedanceEditingPlatformMissingAssets(params: {
  finishingPlan: AiComicSeriesSeedanceFinishingPlanPackage;
  audioPlan: AiComicSeriesSeedanceAudioPlanPackage;
  finalDependencyStatus?: AiComicSeedanceFinalDependencyStatus;
}): AiComicSeedanceEditingPlatformMissingAsset[] {
  const missingAssets: AiComicSeedanceEditingPlatformMissingAsset[] = [];
  for (const shot of params.finishingPlan.missing_shots) {
    missingAssets.push({
      asset_id: `missing-shot-e${shot.episode_no}-${slugifyConstraintKey(shot.shot_id)}`,
      asset_type: 'video',
      label: `第${shot.episode_no}集 ${shot.shot_id}`,
      episode_no: shot.episode_no,
      shot_id: shot.shot_id,
      reason: shot.reason,
      source: 'seedance_finishing_plan.missing_shots',
    });
  }
  for (const audio of params.audioPlan.missing_audio) {
    missingAssets.push({
      asset_id: `missing-audio-${audio.asset_id}`,
      asset_type: 'audio',
      label: audio.asset_label,
      episode_no: audio.episode_no,
      shot_id: audio.shot_id,
      reason: audio.reason,
      source: 'seedance_audio_plan.missing_audio',
    });
  }
  for (const dependency of params.finalDependencyStatus?.missing_dependencies ?? []) {
    missingAssets.push({
      asset_id: `missing-final-dependency-${slugifyConstraintKey(dependency)}`,
      asset_type: 'final_delivery',
      label: dependency,
      reason: dependency,
      source: 'seedance_final_delivery.dependency_status',
    });
  }
  const seen = new Set<string>();
  return missingAssets.filter(asset => {
    const key = `${asset.asset_type}:${asset.asset_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSeedanceEditingPlatformImportNotes(params: {
  detail: AiComicSeriesProjectDetail;
  finishingPlan: AiComicSeriesSeedanceFinishingPlanPackage;
  titleCardPlan: AiComicSeriesSeedanceTitleCardPlanPackage;
  missingAssets: AiComicSeedanceEditingPlatformMissingAsset[];
}): string[] {
  return [
    'CSV 时间线以秒为单位，导入剪辑软件后请按项目帧率重新贴齐帧边界。',
    'SRT cue 已按外部剪辑时间线重新偏移，包含片头片尾卡产生的时间差。',
    `片头片尾卡共 ${params.titleCardPlan.total_card_count} 张；若 render 账本仍为 planned，请先执行 seedance-title-cards/render。`,
    params.finishingPlan.source_cut_output_path
      ? `已记录源剪辑成片：${params.finishingPlan.source_cut_output_path}`
      : '尚未记录源剪辑成片，外部剪辑需直接使用镜头级视频素材重建时间线。',
    params.detail.seedance_final_delivery?.output_path
      ? `已记录最终交付输出：${params.detail.seedance_final_delivery.output_path}`
      : '尚未记录最终交付输出；可先用本包导入外部剪辑平台做 conform。',
    params.missingAssets.length > 0
      ? `仍有 ${params.missingAssets.length} 项缺失素材或依赖，请先补齐再做正式交付。`
      : '未发现阻断性缺失素材。',
    ...(params.detail.seedance_final_delivery?.dependency_status.warnings ?? []),
  ];
}

function buildSeedanceEditingPlatformTimelineCsv(
  timeline: AiComicSeedanceEditingPlatformTimelineItem[],
): string {
  return csvRows(
    ['item_id', 'item_type', 'track', 'episode_no', 'label', 'start_sec', 'end_sec', 'duration_sec', 'source_path', 'notes'],
    timeline.map(item => [
      item.item_id,
      item.item_type,
      item.track,
      item.episode_no ?? '',
      item.label,
      item.start_sec,
      item.end_sec,
      item.duration_sec,
      item.source_path,
      item.notes.join('；'),
    ]),
  );
}

function buildSeedanceEditingPlatformAssetManifestCsv(
  assets: AiComicSeedanceEditingPlatformAsset[],
): string {
  return csvRows(
    ['asset_id', 'asset_type', 'label', 'path_or_url', 'episode_no', 'shot_id', 'status', 'missing', 'source', 'notes'],
    assets.map(asset => [
      asset.asset_id,
      asset.asset_type,
      asset.label,
      asset.path_or_url ?? '',
      asset.episode_no ?? '',
      asset.shot_id ?? '',
      asset.status,
      asset.missing ? 'true' : 'false',
      asset.source,
      asset.notes.join('；'),
    ]),
  );
}

function seedanceEditingShotKey(episodeNo: number, shotId: string): string {
  return `${episodeNo}:${shotId}`;
}

function roundSeedanceTimelineSecond(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function csvRows(headers: string[], rows: Array<Array<string | number | boolean>>): string {
  return `${[headers, ...rows]
    .map(row => row.map(csvEscape).join(','))
    .join('\n')}\n`;
}

function csvEscape(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function seedanceEditingAudioAssetStatus(
  status: AiComicSeedanceAudioPlanCue['asset_status'],
): AiComicSeedanceEditingPlatformAsset['status'] {
  if (status === 'bound') return 'ready';
  if (status === 'optional_missing') return 'optional_missing';
  return 'missing';
}

function seedanceEditingTitleCardStatus(
  detail: AiComicSeriesProjectDetail,
  outputPath: string,
): AiComicSeedanceEditingPlatformAsset['status'] {
  const ledger = detail.seedance_title_card_render;
  if (!ledger) return 'planned';
  if (ledger.output_paths.includes(outputPath)) {
    return seedanceEditingLedgerAssetStatus(ledger.status);
  }
  return 'planned';
}

function seedanceEditingLedgerAssetStatus(
  status?: string,
): AiComicSeedanceEditingPlatformAsset['status'] {
  if (status === 'ready') return 'ready';
  if (status === 'planned' || status === 'rendering' || status === 'assembling' || status === 'mixing') return 'planned';
  if (status === 'failed') return 'missing';
  if (status === 'skipped') return 'unknown';
  return 'unknown';
}

function mergeSeedanceEditingAssetStatus(
  left: AiComicSeedanceEditingPlatformAsset['status'],
  right: AiComicSeedanceEditingPlatformAsset['status'],
): AiComicSeedanceEditingPlatformAsset['status'] {
  const statuses = [left, right];
  if (statuses.includes('ready')) return 'ready';
  if (statuses.includes('missing')) return 'missing';
  if (statuses.includes('optional_missing')) return 'optional_missing';
  if (statuses.includes('planned')) return 'planned';
  return 'unknown';
}

function seedanceEditingAssetTypeRank(type: AiComicSeedanceEditingPlatformAsset['asset_type']): number {
  const rank: Record<AiComicSeedanceEditingPlatformAsset['asset_type'], number> = {
    video: 1,
    title_card: 2,
    audio: 3,
    subtitle: 4,
    thumbnail: 5,
    final_delivery: 6,
  };
  return rank[type];
}

function seedanceEditingAssetTypeText(type: AiComicSeedanceEditingPlatformAsset['asset_type']): string {
  const map: Record<AiComicSeedanceEditingPlatformAsset['asset_type'], string> = {
    video: '视频',
    audio: '音频',
    subtitle: '字幕',
    title_card: '片头片尾',
    thumbnail: '缩略图',
    final_delivery: '最终交付',
  };
  return map[type];
}

function seedanceEditingAssetStatusText(status: AiComicSeedanceEditingPlatformAsset['status']): string {
  const map: Record<AiComicSeedanceEditingPlatformAsset['status'], string> = {
    ready: '可用',
    planned: '计划中',
    missing: '缺失',
    optional_missing: '可选缺失',
    unknown: '未知',
  };
  return map[status];
}

function buildSeedanceProductionDashboard(
  detail: AiComicSeriesProjectDetail,
  cutPackage: AiComicSeriesSeedanceCutPackage,
): Omit<AiComicSeriesSeedanceDashboard, 'markdown'> {
  const ledger = normalizeSeedanceProductionLedger(detail.seedance_production);
  const statusCounts = seedanceDashboardProductionStatusCounts(ledger);
  const readyVersionCount = ledger.items.reduce((sum, item) =>
    sum + item.versions.filter(version => version.status === 'ready' && Boolean(version.video_url)).length,
  0);
  const thumbnailReadyCount = ledger.items.filter(item => item.thumbnail?.status === 'ready').length;
  const thumbnailFailedCount = ledger.items.filter(item => item.thumbnail?.status === 'failed').length;
  const reviewLedger = normalizeSeedanceReviewLedger(detail.seedance_review_ledger);
  const summary: AiComicSeedanceDashboardSummary = {
    generated_episode_count: Object.keys(detail.generated_episode_story_ids ?? {}).length,
    total_episode_count: detail.plan.episode_count,
    total_shot_count: ledger.items.length,
    prompt_exported_count: ledger.items.filter(item => item.status !== 'not_started' || Boolean(item.prompt_exported_at)).length,
    submitted_count: statusCounts.submitted,
    processing_count: statusCounts.processing,
    ready_count: statusCounts.ready,
    failed_count: statusCounts.failed,
    skipped_count: statusCounts.skipped,
    selected_version_count: ledger.items.filter(item => Boolean(item.selected_version_id)).length,
    ready_version_count: readyVersionCount,
    thumbnail_ready_count: thumbnailReadyCount,
    thumbnail_failed_count: thumbnailFailedCount,
    missing_shot_count: cutPackage.total_missing_shot_count,
    open_review_count: reviewLedger?.open_count ?? 0,
    blocking_review_count: reviewLedger?.blocking_count ?? 0,
    final_reassemble_required: reviewLedger?.final_reassemble_required ?? false,
    blocker_count: 0,
    next_action_count: 0,
    production_status_counts: statusCounts,
  };
  const finalDependencyStatus = resolveSeedanceFinalDependencyStatus(detail, {
    dryRun: true,
    includeSubtitles: true,
    includeAudioMix: true,
    includeTitleCards: true,
  });
  const statusItems = buildSeedanceDashboardStatusItems(detail, summary, finalDependencyStatus);
  const blockers = buildSeedanceDashboardBlockers(detail, summary, finalDependencyStatus);
  const nextActions = buildSeedanceDashboardNextActions(detail, summary, finalDependencyStatus);
  summary.blocker_count = blockers.length;
  summary.next_action_count = nextActions.length;

  return {
    schema_version: 'ai-comic-series-seedance-dashboard/v1',
    project: detail.project,
    series_title: detail.plan.series_title,
    generated_at: new Date().toISOString(),
    summary,
    status_items: statusItems,
    blockers,
    next_actions: nextActions,
    episodes: buildSeedanceDashboardEpisodes(detail, ledger),
  };
}

function seedanceDashboardProductionStatusCounts(
  ledger: AiComicSeedanceProductionLedger,
): Record<AiComicSeedanceProductionStatus, number> {
  const counts: Record<AiComicSeedanceProductionStatus, number> = {
    not_started: 0,
    prompt_exported: 0,
    submitted: 0,
    processing: 0,
    ready: 0,
    failed: 0,
    skipped: 0,
  };
  for (const item of ledger.items) {
    counts[item.status] += 1;
  }
  return counts;
}

function buildSeedanceDashboardStatusItems(
  detail: AiComicSeriesProjectDetail,
  summary: AiComicSeedanceDashboardSummary,
  finalDependencyStatus: AiComicSeedanceFinalDependencyStatus,
): AiComicSeedanceDashboardStatusItem[] {
  return [
    {
      key: 'prompt_export',
      label: '提示词导出',
      status: summary.total_shot_count > 0 ? 'ready' : summary.generated_episode_count > 0 ? 'needs_action' : 'not_started',
      status_text: summary.total_shot_count > 0 ? '已导出' : '未导出',
      updated_at: detail.seedance_production?.updated_at,
      count_text: `${summary.prompt_exported_count}/${summary.total_shot_count || summary.generated_episode_count}`,
      notes: summary.total_shot_count > 0
        ? [`${summary.total_shot_count} 个镜头进入生产账本`]
        : ['需要先导出系列 Seedance 镜头提示词包'],
    },
    {
      key: 'shot_production',
      label: '镜头生产',
      status: seedanceDashboardProductionStatus(summary),
      status_text: seedanceDashboardItemStatusText(seedanceDashboardProductionStatus(summary)),
      updated_at: detail.seedance_production?.updated_at,
      count_text: `ready ${summary.ready_count} / failed ${summary.failed_count} / active ${summary.submitted_count + summary.processing_count}`,
      notes: [`已选剪辑版本 ${summary.selected_version_count} 个；ready 版本 ${summary.ready_version_count} 个`],
    },
    {
      key: 'thumbnail_capture',
      label: '缩略图',
      status: seedanceDashboardThumbnailStatus(summary),
      status_text: seedanceDashboardItemStatusText(seedanceDashboardThumbnailStatus(summary)),
      count_text: `${summary.thumbnail_ready_count}/${summary.ready_count}`,
      notes: summary.thumbnail_failed_count > 0 ? [`失败 ${summary.thumbnail_failed_count} 个`] : [],
    },
    seedanceDashboardLedgerStatusItem({
      key: 'cut_assembly',
      label: '剪辑装配',
      status: detail.seedance_cut_assembly?.status,
      updatedAt: detail.seedance_cut_assembly?.updated_at,
      outputPath: detail.seedance_cut_assembly?.output_path,
      fallbackNeedsAction: summary.ready_count > 0,
      countText: detail.seedance_cut_assembly
        ? `${detail.seedance_cut_assembly.source_shot_count} 个镜头`
        : undefined,
      notes: [
        detail.seedance_cut_assembly?.failure_reason ?? '',
        detail.seedance_cut_assembly?.dry_run ? 'dry-run 账本' : '',
      ].filter(Boolean),
    }),
    seedanceDashboardLedgerStatusItem({
      key: 'subtitle_render',
      label: '字幕',
      status: detail.seedance_subtitle_render?.status,
      updatedAt: detail.seedance_subtitle_render?.updated_at,
      outputPath: detail.seedance_subtitle_render?.output_path ?? detail.seedance_subtitle_render?.srt_path,
      fallbackNeedsAction: seedanceLedgerUsable(detail.seedance_cut_assembly?.status, true),
      countText: detail.seedance_subtitle_render
        ? `${detail.seedance_subtitle_render.cue_count} 条 cue`
        : undefined,
      notes: [
        detail.seedance_subtitle_render?.mode === 'burn_in' ? '烧录字幕' : detail.seedance_subtitle_render ? '侧挂 SRT' : '',
        detail.seedance_subtitle_render?.failure_reason ?? '',
      ].filter(Boolean),
    }),
    seedanceDashboardLedgerStatusItem({
      key: 'audio_mix',
      label: '音频混音',
      status: detail.seedance_audio_mix?.status,
      updatedAt: detail.seedance_audio_mix?.updated_at,
      outputPath: detail.seedance_audio_mix?.output_path,
      fallbackNeedsAction: seedanceLedgerUsable(detail.seedance_cut_assembly?.status, true),
      countText: detail.seedance_audio_mix
        ? `音频 ${detail.seedance_audio_mix.source_audio_count} / 缺 ${detail.seedance_audio_mix.missing_audio_count}`
        : undefined,
      notes: [
        detail.seedance_audio_mix?.audio_profile ?? '',
        detail.seedance_audio_mix?.failure_reason ?? '',
      ].filter(Boolean),
    }),
    seedanceDashboardLedgerStatusItem({
      key: 'title_card_render',
      label: '片头片尾',
      status: detail.seedance_title_card_render?.status,
      updatedAt: detail.seedance_title_card_render?.updated_at,
      outputPath: detail.seedance_title_card_render?.output_paths[0],
      fallbackNeedsAction: summary.ready_count > 0,
      countText: detail.seedance_title_card_render
        ? `${detail.seedance_title_card_render.rendered_count}/${detail.seedance_title_card_render.card_count} 张卡`
        : undefined,
      notes: [
        detail.seedance_title_card_render?.output_profile ?? '',
        detail.seedance_title_card_render?.failure_reason ?? '',
      ].filter(Boolean),
    }),
    {
      key: 'final_delivery',
      label: '最终交付',
      status: seedanceDashboardFinalStatus(detail.seedance_final_delivery?.status, finalDependencyStatus),
      status_text: seedanceDashboardItemStatusText(
        seedanceDashboardFinalStatus(detail.seedance_final_delivery?.status, finalDependencyStatus),
      ),
      updated_at: detail.seedance_final_delivery?.updated_at,
      output_path: detail.seedance_final_delivery?.output_path,
      count_text: `${finalDependencyStatus.missing_dependencies.length} 个依赖缺失`,
      notes: [
        detail.seedance_final_delivery?.output_profile ?? '',
        ...finalDependencyStatus.warnings,
        detail.seedance_final_delivery?.failure_reason ?? '',
      ].filter(Boolean),
    },
    {
      key: 'review_ledger',
      label: '审片返修',
      status: summary.open_review_count > 0
        ? summary.blocking_review_count > 0 || summary.final_reassemble_required ? 'blocked' : 'needs_action'
        : detail.seedance_review_ledger ? 'ready' : 'not_started',
      status_text: summary.open_review_count > 0
        ? `${summary.open_review_count} 条待处理`
        : detail.seedance_review_ledger ? '已清零' : '未开始',
      updated_at: detail.seedance_review_ledger?.updated_at,
      count_text: summary.open_review_count > 0
        ? `阻断 ${summary.blocking_review_count} / open ${summary.open_review_count}`
        : undefined,
      notes: [
        summary.final_reassemble_required ? '需要最终重装配' : '',
        summary.open_review_count > 0 ? '可导出审片返修包' : '',
      ].filter(Boolean),
    },
    {
      key: 'editing_platform_package',
      label: '外部剪辑包',
      status: summary.ready_count > 0 ? 'ready' : 'not_started',
      status_text: summary.ready_count > 0 ? '可导出' : '未就绪',
      count_text: summary.ready_count > 0 ? 'JSON / CSV / SRT / manifest' : undefined,
      notes: summary.ready_count > 0
        ? ['可导出通用剪辑平台交付包']
        : ['需要至少一个 ready 镜头'],
    },
  ];
}

function buildSeedanceDashboardBlockers(
  detail: AiComicSeriesProjectDetail,
  summary: AiComicSeedanceDashboardSummary,
  finalDependencyStatus: AiComicSeedanceFinalDependencyStatus,
): AiComicSeedanceDashboardBlocker[] {
  const blockers: AiComicSeedanceDashboardBlocker[] = [];
  const add = (blocker: AiComicSeedanceDashboardBlocker) => blockers.push(blocker);
  if (summary.generated_episode_count === 0) {
    add({
      blocker_id: 'no-generated-episodes',
      severity: 'blocking',
      label: '尚未生成分集',
      detail: '系列规划还没有可生产的分集故事。',
      action_key: 'generate_next_episode',
      action_label: '生成分集',
    });
  }
  if (summary.generated_episode_count > 0 && summary.total_shot_count === 0) {
    add({
      blocker_id: 'no-seedance-prompts',
      severity: 'blocking',
      label: '尚未导出 Seedance 提示词',
      detail: '生产账本为空，无法提交镜头或装配成片。',
      related_status_key: 'prompt_export',
      action_key: 'export_seedance_prompts',
      action_label: '导出提示词包',
    });
  }
  if (summary.failed_count > 0) {
    add({
      blocker_id: 'failed-shots',
      severity: 'blocking',
      label: `${summary.failed_count} 个镜头失败`,
      detail: '失败镜头需要重试、跳过或人工替换，正式成片前不可忽略。',
      related_status_key: 'shot_production',
      action_key: 'export_retry_package',
      action_label: '导出重试包',
    });
  }
  if (summary.missing_shot_count > 0) {
    add({
      blocker_id: 'missing-ready-shots',
      severity: summary.ready_count === 0 ? 'blocking' : 'warning',
      label: `${summary.missing_shot_count} 个镜头未 ready`,
      detail: '剪辑包只会纳入 ready 且有视频 URL 的镜头。',
      related_status_key: 'shot_production',
      action_key: 'import_seedance_returns',
      action_label: '导入回片',
    });
  }
  if (summary.ready_count > 0 && summary.selected_version_count < summary.ready_count) {
    add({
      blocker_id: 'unselected-ready-versions',
      severity: 'warning',
      label: 'ready 镜头未全部选中剪辑版',
      detail: `ready ${summary.ready_count} 个，已选 ${summary.selected_version_count} 个。`,
      related_status_key: 'shot_production',
      action_key: 'auto_select_versions',
      action_label: '自动择优剪辑版',
    });
  }
  if (summary.thumbnail_failed_count > 0) {
    add({
      blocker_id: 'thumbnail-failed',
      severity: 'warning',
      label: `${summary.thumbnail_failed_count} 个缩略图抽帧失败`,
      detail: '缩略图不阻断成片，但会影响审片和外部素材交接。',
      related_status_key: 'thumbnail_capture',
      action_key: 'capture_thumbnails',
      action_label: '重新抽帧',
    });
  }
  addSeedanceLedgerBlocker(blockers, 'cut_assembly', '剪辑装配', detail.seedance_cut_assembly?.status, detail.seedance_cut_assembly?.failure_reason);
  addSeedanceLedgerBlocker(blockers, 'subtitle_render', '字幕', detail.seedance_subtitle_render?.status, detail.seedance_subtitle_render?.failure_reason);
  addSeedanceLedgerBlocker(blockers, 'audio_mix', '音频混音', detail.seedance_audio_mix?.status, detail.seedance_audio_mix?.failure_reason);
  addSeedanceLedgerBlocker(blockers, 'title_card_render', '片头片尾', detail.seedance_title_card_render?.status, detail.seedance_title_card_render?.failure_reason);
  addSeedanceLedgerBlocker(blockers, 'final_delivery', '最终交付', detail.seedance_final_delivery?.status, detail.seedance_final_delivery?.failure_reason);
  const reviewLedger = normalizeSeedanceReviewLedger(detail.seedance_review_ledger);
  if ((reviewLedger?.open_count ?? 0) > 0) {
    add({
      blocker_id: 'open-seedance-reviews',
      severity: (reviewLedger?.blocking_count ?? 0) > 0 ? 'blocking' : 'warning',
      label: `${reviewLedger?.open_count ?? 0} 条审片意见待处理`,
      detail: reviewLedger?.final_reassemble_required
        ? '审片意见要求最终重装配，处理后需要刷新 final delivery。'
        : '审片意见需要分派到镜头、字幕、音频或人工复核。',
      related_status_key: 'review_ledger',
      action_key: 'export_review_repair_package',
      action_label: '导出返修包',
    });
  }
  for (const dependency of finalDependencyStatus.missing_dependencies) {
    add({
      blocker_id: `final-dependency-${slugifyConstraintKey(dependency)}`,
      severity: 'warning',
      label: dependency,
      detail: '最终交付 dry-run 仍缺少该依赖。',
      related_status_key: 'final_delivery',
      action_key: 'assemble_final_delivery',
      action_label: '刷新最终交付计划',
    });
  }
  return blockers;
}

function addSeedanceLedgerBlocker(
  blockers: AiComicSeedanceDashboardBlocker[],
  key: AiComicSeedanceDashboardStatusItem['key'],
  label: string,
  status?: string,
  failureReason?: string,
): void {
  if (status !== 'failed') return;
  blockers.push({
    blocker_id: `${key}-failed`,
    severity: 'blocking',
    label: `${label}失败`,
    detail: failureReason ?? `${label}账本状态为 failed。`,
    related_status_key: key,
  });
}

function buildSeedanceDashboardNextActions(
  detail: AiComicSeriesProjectDetail,
  summary: AiComicSeedanceDashboardSummary,
  finalDependencyStatus: AiComicSeedanceFinalDependencyStatus,
): AiComicSeedanceDashboardNextAction[] {
  const actions: AiComicSeedanceDashboardNextAction[] = [];
  const add = (action: AiComicSeedanceDashboardNextAction) => actions.push(action);
  if (summary.generated_episode_count === 0) {
    add({
      action_key: 'generate_next_episode',
      label: '生成第一集',
      detail: '先生成至少一集，再导出 Seedance 镜头提示词。',
      priority: 10,
    });
  }
  if (summary.generated_episode_count > 0 && summary.total_shot_count === 0) {
    add({
      action_key: 'export_seedance_prompts',
      label: '导出 Seedance 提示词包',
      detail: '创建生产账本并进入镜头提交/回片流程。',
      priority: 20,
      related_status_key: 'prompt_export',
    });
  }
  if (summary.production_status_counts.prompt_exported > 0) {
    add({
      action_key: 'mark_submitted',
      label: '批量标记已提交',
      detail: `${summary.production_status_counts.prompt_exported} 个镜头仍停留在提示词已导出。`,
      priority: 30,
      related_status_key: 'shot_production',
    });
  }
  if (summary.submitted_count + summary.processing_count > 0) {
    add({
      action_key: 'import_seedance_returns',
      label: '导入或轮询回片',
      detail: `${summary.submitted_count + summary.processing_count} 个镜头仍在制作链路中。`,
      priority: 40,
      related_status_key: 'shot_production',
    });
  }
  if (summary.failed_count > 0) {
    add({
      action_key: 'export_retry_package',
      label: '导出失败重试包',
      detail: `${summary.failed_count} 个镜头失败，需要重试或人工处理。`,
      priority: 45,
      related_status_key: 'shot_production',
    });
  }
  if (summary.ready_count > 0 && summary.selected_version_count < summary.ready_count) {
    add({
      action_key: 'auto_select_versions',
      label: '自动择优剪辑版',
      detail: `ready ${summary.ready_count} 个，已选 ${summary.selected_version_count} 个。`,
      priority: 50,
      related_status_key: 'shot_production',
    });
  }
  if (summary.ready_count > 0 && summary.thumbnail_ready_count < summary.ready_count) {
    add({
      action_key: 'capture_thumbnails',
      label: '生成缩略图',
      detail: `ready 镜头 ${summary.ready_count} 个，缩略图 ${summary.thumbnail_ready_count} 个。`,
      priority: 60,
      related_status_key: 'thumbnail_capture',
    });
  }
  if (summary.ready_count > 0 && !seedanceLedgerUsable(detail.seedance_cut_assembly?.status, true)) {
    add({
      action_key: 'assemble_cut',
      label: '装配剪辑成片',
      detail: '已有 ready 镜头，可以生成初版剪辑成片。',
      priority: 70,
      related_status_key: 'cut_assembly',
    });
  }
  if (seedanceLedgerUsable(detail.seedance_cut_assembly?.status, true)) {
    if (!seedanceLedgerUsable(detail.seedance_subtitle_render?.status, true)) {
      add({
        action_key: 'render_subtitles',
        label: '生成字幕文件',
        detail: '剪辑成片已可用，可以生成侧挂 SRT 或烧录字幕。',
        priority: 80,
        related_status_key: 'subtitle_render',
      });
    }
    if (!seedanceLedgerUsable(detail.seedance_audio_mix?.status, true)) {
      add({
        action_key: 'mix_audio',
        label: '生成混音计划',
        detail: '剪辑成片已可用，可以规划或执行音频混音。',
        priority: 90,
        related_status_key: 'audio_mix',
      });
    }
  }
  if (summary.ready_count > 0 && !seedanceLedgerUsable(detail.seedance_title_card_render?.status, true)) {
    add({
      action_key: 'render_title_cards',
      label: '生成片头片尾计划',
      detail: '补齐系列片头、分集片头片尾和系列片尾。',
      priority: 100,
      related_status_key: 'title_card_render',
    });
  }
  if (
    finalDependencyStatus.missing_dependencies.length === 0
    && !seedanceLedgerUsable(detail.seedance_final_delivery?.status, true)
  ) {
    add({
      action_key: 'assemble_final_delivery',
      label: '生成最终交付 dry-run',
      detail: '剪辑、字幕、混音和片头片尾依赖已可用。',
      priority: 110,
      related_status_key: 'final_delivery',
    });
  }
  const reviewLedger = normalizeSeedanceReviewLedger(detail.seedance_review_ledger);
  if ((reviewLedger?.open_count ?? 0) > 0) {
    add({
      action_key: 'export_review_repair_package',
      label: '导出审片返修包',
      detail: reviewLedger?.final_reassemble_required
        ? '审片意见包含最终重装配，先分派返修再刷新最终交付。'
        : `${reviewLedger?.open_count ?? 0} 条审片意见待处理。`,
      priority: 115,
      related_status_key: 'review_ledger',
    });
  }
  if (summary.ready_count > 0) {
    add({
      action_key: 'export_editing_platform_package',
      label: '导出外部剪辑平台包',
      detail: '输出 JSON、CSV 时间线、SRT 和素材清单。',
      priority: 120,
      related_status_key: 'editing_platform_package',
    });
  }
  return actions.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

function buildSeedanceDashboardEpisodes(
  detail: AiComicSeriesProjectDetail,
  ledger: AiComicSeedanceProductionLedger,
): AiComicSeedanceDashboardEpisode[] {
  const itemsByEpisode = new Map<number, AiComicSeedanceShotProductionItem[]>();
  for (const item of ledger.items) {
    itemsByEpisode.set(item.episode_no, [...(itemsByEpisode.get(item.episode_no) ?? []), item]);
  }
  const planEpisodes = Array.isArray(detail.plan?.episodes) ? detail.plan.episodes : [];
  return planEpisodes
    .filter(episode => Boolean(detail.generated_episode_story_ids[String(episode.episode_no)]) || itemsByEpisode.has(episode.episode_no))
    .map(episode => {
      const items = itemsByEpisode.get(episode.episode_no) ?? [];
      const ready = items.filter(item => item.status === 'ready' && Boolean(item.video_url)).length;
      const failed = items.filter(item => item.status === 'failed').length;
      const selected = items.filter(item => Boolean(item.selected_version_id)).length;
      const thumbnailReady = items.filter(item => item.thumbnail?.status === 'ready').length;
      return {
        episode_no: episode.episode_no,
        episode_title: episode.title,
        story_id: detail.generated_episode_story_ids[String(episode.episode_no)],
        total_shot_count: items.length,
        ready_shot_count: ready,
        failed_shot_count: failed,
        selected_version_count: selected,
        thumbnail_ready_count: thumbnailReady,
        blocker_count: failed + Math.max(0, items.length - ready),
      };
    })
    .sort((a, b) => a.episode_no - b.episode_no);
}

function seedanceDashboardProductionStatus(
  summary: AiComicSeedanceDashboardSummary,
): AiComicSeedanceDashboardItemStatus {
  if (summary.total_shot_count === 0) return 'not_started';
  if (summary.failed_count > 0) return 'failed';
  if (summary.processing_count > 0 || summary.submitted_count > 0) return 'in_progress';
  if (summary.ready_count > 0 && summary.ready_count + summary.skipped_count >= summary.total_shot_count) return 'ready';
  if (summary.production_status_counts.prompt_exported > 0) return 'needs_action';
  return 'not_started';
}

function seedanceDashboardThumbnailStatus(
  summary: AiComicSeedanceDashboardSummary,
): AiComicSeedanceDashboardItemStatus {
  if (summary.thumbnail_failed_count > 0) return 'failed';
  if (summary.ready_count === 0) return 'not_started';
  if (summary.thumbnail_ready_count >= summary.ready_count) return 'ready';
  if (summary.thumbnail_ready_count > 0) return 'in_progress';
  return 'needs_action';
}

function seedanceDashboardFinalStatus(
  status: AiComicSeedanceFinalDeliveryStatus | undefined,
  dependencyStatus: AiComicSeedanceFinalDependencyStatus,
): AiComicSeedanceDashboardItemStatus {
  if (status === 'ready') return 'ready';
  if (status === 'failed') return 'failed';
  if (status === 'assembling') return 'in_progress';
  if (status === 'planned') {
    return dependencyStatus.missing_dependencies.length > 0 ? 'blocked' : 'planned';
  }
  if (status === 'skipped') return 'skipped';
  return dependencyStatus.missing_dependencies.length > 0 ? 'blocked' : 'not_started';
}

function seedanceDashboardLedgerStatusItem(params: {
  key: AiComicSeedanceDashboardStatusKey;
  label: string;
  status?: string;
  updatedAt?: string;
  outputPath?: string;
  fallbackNeedsAction?: boolean;
  countText?: string;
  notes: string[];
}): AiComicSeedanceDashboardStatusItem {
  const status = seedanceDashboardLedgerStatus(params.status, params.fallbackNeedsAction);
  return {
    key: params.key,
    label: params.label,
    status,
    status_text: seedanceDashboardItemStatusText(status),
    updated_at: params.updatedAt,
    output_path: params.outputPath,
    count_text: params.countText,
    notes: params.notes,
  };
}

function seedanceDashboardLedgerStatus(
  status?: string,
  fallbackNeedsAction = false,
): AiComicSeedanceDashboardItemStatus {
  if (status === 'ready') return 'ready';
  if (status === 'failed') return 'failed';
  if (status === 'assembling' || status === 'rendering' || status === 'mixing') return 'in_progress';
  if (status === 'planned') return 'planned';
  if (status === 'skipped') return 'skipped';
  return fallbackNeedsAction ? 'needs_action' : 'not_started';
}

function seedanceDashboardItemStatusText(status: AiComicSeedanceDashboardItemStatus): string {
  const map: Record<AiComicSeedanceDashboardItemStatus, string> = {
    not_started: '未开始',
    needs_action: '待处理',
    in_progress: '进行中',
    planned: '已规划',
    ready: '已就绪',
    failed: '失败',
    skipped: '已跳过',
    blocked: '受阻',
  };
  return map[status];
}

function seedanceDashboardSeverityText(severity: AiComicSeedanceDashboardBlocker['severity']): string {
  const map: Record<AiComicSeedanceDashboardBlocker['severity'], string> = {
    blocking: '阻断',
    warning: '提醒',
    info: '信息',
  };
  return map[severity];
}

function resolveSeedanceFinalDependencyStatus(
  detail: AiComicSeriesProjectDetail,
  options: {
    dryRun: boolean;
    includeSubtitles: boolean;
    includeAudioMix: boolean;
    includeTitleCards: boolean;
  },
): AiComicSeedanceFinalDependencyStatus {
  const warnings: string[] = [];
  const missingDependencies: string[] = [];
  const cutReady = seedanceLedgerUsable(detail.seedance_cut_assembly?.status, options.dryRun)
    && Boolean(detail.seedance_cut_assembly?.output_path);
  const subtitleReady = !options.includeSubtitles
    || (seedanceLedgerUsable(detail.seedance_subtitle_render?.status, options.dryRun)
      && Boolean(detail.seedance_subtitle_render?.output_path || detail.seedance_subtitle_render?.srt_path));
  const audioMixReady = !options.includeAudioMix
    || (seedanceLedgerUsable(detail.seedance_audio_mix?.status, options.dryRun)
      && Boolean(detail.seedance_audio_mix?.output_path));
  const titleCardsReady = !options.includeTitleCards
    || (seedanceLedgerUsable(detail.seedance_title_card_render?.status, options.dryRun)
      && (detail.seedance_title_card_render?.output_paths.length ?? 0) > 0);

  if (!cutReady) missingDependencies.push('剪辑装配输出缺失');
  if (options.includeSubtitles && !subtitleReady) missingDependencies.push('字幕文件或烧录字幕输出缺失');
  if (options.includeAudioMix && !audioMixReady) missingDependencies.push('混音输出缺失');
  if (options.includeTitleCards && !titleCardsReady) missingDependencies.push('片头片尾卡输出缺失');
  if (!options.includeSubtitles) warnings.push('已按请求跳过字幕依赖');
  if (!options.includeAudioMix) warnings.push('已按请求跳过混音依赖');
  if (!options.includeTitleCards) warnings.push('已按请求跳过片头片尾依赖');

  const subtitlePath = detail.seedance_subtitle_render?.output_path
    ?? detail.seedance_subtitle_render?.srt_path;
  const audioMixPath = detail.seedance_audio_mix?.output_path;
  const sourceCutPath = options.includeAudioMix && audioMixReady && audioMixPath
    ? audioMixPath
    : options.includeSubtitles
      && detail.seedance_subtitle_render?.mode === 'burn_in'
      && subtitleReady
      && detail.seedance_subtitle_render.output_path
      ? detail.seedance_subtitle_render.output_path
      : detail.seedance_cut_assembly?.output_path;

  return {
    cut_ready: cutReady,
    subtitle_ready: subtitleReady,
    audio_mix_ready: audioMixReady,
    title_cards_ready: titleCardsReady,
    source_cut_path: sourceCutPath,
    subtitle_path: options.includeSubtitles && subtitleReady ? subtitlePath : undefined,
    audio_mix_path: options.includeAudioMix && audioMixReady ? audioMixPath : undefined,
    title_card_paths: options.includeTitleCards && titleCardsReady
      ? [...(detail.seedance_title_card_render?.output_paths ?? [])]
      : [],
    missing_dependencies: missingDependencies,
    warnings,
  };
}

async function assertSeedanceFinalDeliveryInputsExist(
  projectDir: string,
  dependencyStatus: AiComicSeedanceFinalDependencyStatus,
  options: {
    includeSubtitles: boolean;
    includeAudioMix: boolean;
    includeTitleCards: boolean;
  },
): Promise<void> {
  const requiredInputs: Array<{ label: string; path?: string }> = [
    { label: 'source cut', path: dependencyStatus.source_cut_path },
  ];
  if (options.includeSubtitles && dependencyStatus.subtitle_path) {
    requiredInputs.push({ label: 'subtitle', path: dependencyStatus.subtitle_path });
  }
  if (options.includeAudioMix && dependencyStatus.audio_mix_path) {
    requiredInputs.push({ label: 'audio mix', path: dependencyStatus.audio_mix_path });
  }
  if (options.includeTitleCards) {
    dependencyStatus.title_card_paths.forEach((path, index) => {
      requiredInputs.push({ label: `title card ${index + 1}`, path });
    });
  }

  for (const input of requiredInputs) {
    if (!input.path) {
      throw new Error(`Seedance final delivery missing input path: ${input.label}`);
    }
    const absolutePath = resolveSeedanceProjectOutputPath(projectDir, input.path);
    if (!(await pathExists(absolutePath))) {
      throw new Error(`Seedance final delivery input not found: ${input.label} (${input.path})`);
    }
  }
}

function seedanceLedgerUsable(status: string | undefined, dryRun: boolean): boolean {
  return status === 'ready' || (dryRun && status === 'planned');
}

function buildFfmpegThumbnailCommand(
  ffmpegPath: string,
  captureTimeSec: number,
  videoUrl: string,
  outputPath: string,
): string {
  const executable = ffmpegPath === 'ffmpeg' ? 'ffmpeg' : shellDoubleQuote(ffmpegPath);
  return `${executable} -y -ss ${captureTimeSec} -i ${shellDoubleQuote(videoUrl)} -frames:v 1 -q:v 2 ${shellDoubleQuote(outputPath)}`;
}

function buildFfmpegCutAssemblyCommand(
  ffmpegPath: string,
  concatListPath: string,
  outputPath: string,
  profile: SeedanceCutAssemblyProfile,
): string {
  const executable = ffmpegPath === 'ffmpeg' ? 'ffmpeg' : shellDoubleQuote(ffmpegPath);
  return [
    executable,
    ...ffmpegCutAssemblyArgs(concatListPath, outputPath, profile).map(shellDoubleQuoteIfNeeded),
  ].join(' ');
}

function buildFfmpegSubtitleBurnInCommand(
  ffmpegPath: string,
  inputVideoPath: string,
  subtitlePath: string,
  outputPath: string,
): string {
  const executable = ffmpegPath === 'ffmpeg' ? 'ffmpeg' : shellDoubleQuote(ffmpegPath);
  return [
    executable,
    ...ffmpegSubtitleBurnInArgs(inputVideoPath, subtitlePath, outputPath).map(shellDoubleQuoteIfNeeded),
  ].join(' ');
}

function buildFfmpegAudioMixCommand(
  ffmpegPath: string,
  inputVideoPath: string,
  audioInputs: SeedanceAudioMixInput[],
  outputPath: string,
  options: {
    includeOriginalAudio: boolean;
    originalAudioVolumeDb: number;
  } = { includeOriginalAudio: false, originalAudioVolumeDb: 0 },
): string {
  const executable = ffmpegPath === 'ffmpeg' ? 'ffmpeg' : shellDoubleQuote(ffmpegPath);
  return [
    executable,
    ...ffmpegAudioMixArgs(inputVideoPath, audioInputs, outputPath, options).map(shellDoubleQuoteIfNeeded),
  ].join(' ');
}

function buildFfmpegTitleCardCommand(
  ffmpegPath: string,
  card: AiComicSeedanceTitleCardPlanCard,
  profile: AiComicSeedanceTitleCardOutputProfile,
  fontPath: string,
  outputPath: string,
): string {
  const executable = ffmpegPath === 'ffmpeg' ? 'ffmpeg' : shellDoubleQuote(ffmpegPath);
  return [
    executable,
    ...ffmpegTitleCardArgs(card, profile, fontPath, outputPath).map(shellDoubleQuoteIfNeeded),
  ].join(' ');
}

function buildFfmpegFinalDeliveryCommand(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  outputProfile: AiComicSeedanceFinalDeliveryOutputProfile,
  useConcat: boolean,
): string {
  const executable = ffmpegPath === 'ffmpeg' ? 'ffmpeg' : shellDoubleQuote(ffmpegPath);
  return [
    executable,
    ...ffmpegFinalDeliveryArgs(inputPath, outputPath, outputProfile, useConcat).map(shellDoubleQuoteIfNeeded),
  ].join(' ');
}

function resolveSeedanceCutAssemblyProfile(
  request: AiComicSeedanceCutAssemblyRequest,
): SeedanceCutAssemblyProfile {
  const requestedProfile = request.output_profile;
  const assemblyMode = request.assembly_mode ?? (requestedProfile === 'mp4_h264_1080p' || requestedProfile === 'mp4_h264_720p'
    ? 'transcode'
    : 'copy');
  const outputProfile = assemblyMode === 'copy'
    ? 'source_copy'
    : requestedProfile === 'mp4_h264_720p'
      ? 'mp4_h264_720p'
      : 'mp4_h264_1080p';
  const size = outputProfile === 'mp4_h264_720p'
    ? { width: 1280, height: 720 }
    : outputProfile === 'mp4_h264_1080p'
      ? { width: 1920, height: 1080 }
      : {};
  return {
    assemblyMode,
    outputProfile,
    fps: request.fps,
    crf: request.crf ?? 20,
    preset: request.preset ?? 'medium',
    ...size,
  };
}

function ffmpegCutAssemblyArgs(
  concatListPath: string,
  outputPath: string,
  profile: SeedanceCutAssemblyProfile,
): string[] {
  const base = [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-protocol_whitelist',
    'file,http,https,tcp,tls,crypto',
    '-i',
    concatListPath,
  ];
  if (profile.assemblyMode === 'copy') {
    return [...base, '-c', 'copy', outputPath];
  }
  const filters = [
    profile.width && profile.height
      ? `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`
      : '',
    profile.fps ? `fps=${profile.fps}` : '',
  ].filter(Boolean).join(',');
  return [
    ...base,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    ...(filters ? ['-vf', filters] : []),
    '-c:v',
    'libx264',
    '-preset',
    profile.preset,
    '-crf',
    String(profile.crf),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

function ffmpegSubtitleBurnInArgs(
  inputVideoPath: string,
  subtitlePath: string,
  outputPath: string,
): string[] {
  return [
    '-y',
    '-i',
    inputVideoPath,
    '-vf',
    `subtitles=${escapeFfmpegSubtitleFilterPath(subtitlePath)}`,
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

function ffmpegAudioMixArgs(
  inputVideoPath: string,
  audioInputs: SeedanceAudioMixInput[],
  outputPath: string,
  options: {
    includeOriginalAudio: boolean;
    originalAudioVolumeDb: number;
  } = { includeOriginalAudio: false, originalAudioVolumeDb: 0 },
): string[] {
  const inputs = ['-y', '-i', inputVideoPath, ...audioInputs.flatMap(input => ['-i', input.input_path])];
  if (audioInputs.length === 0 && !options.includeOriginalAudio) return [...inputs, '-c', 'copy', outputPath];
  if (audioInputs.length === 0 && options.includeOriginalAudio) {
    return [
      ...inputs,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outputPath,
    ];
  }
  const filters: string[] = [];
  const mixLabels: string[] = [];
  if (options.includeOriginalAudio) {
    filters.push(`[0:a]volume=${options.originalAudioVolumeDb}dB[a0]`);
    mixLabels.push('[a0]');
  }
  audioInputs.forEach((input, index) => {
    const inputIndex = index + 1;
    const labelIndex = options.includeOriginalAudio ? index + 1 : index;
    const durationSec = Math.max(0.1, input.end_sec - input.start_sec);
    const fadeOutStart = Math.max(0, durationSec - input.fade_out_sec);
    const delayMs = Math.max(0, Math.round(input.start_sec * 1000));
    filters.push(`[${inputIndex}:a]${[
      `volume=${input.volume_db}dB`,
      `atrim=0:${durationSec}`,
      'asetpts=PTS-STARTPTS',
      `afade=t=in:st=0:d=${input.fade_in_sec}`,
      `afade=t=out:st=${fadeOutStart}:d=${input.fade_out_sec}`,
      `adelay=${delayMs}|${delayMs}`,
      `[a${labelIndex}]`,
    ].join(',')}`);
    mixLabels.push(`[a${labelIndex}]`);
  });
  const filterComplex = `${filters.join(';')};${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=2[aout]`;
  return [
    ...inputs,
    '-filter_complex',
    filterComplex,
    '-map',
    '0:v:0',
    '-map',
    '[aout]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

function ffmpegTitleCardArgs(
  card: AiComicSeedanceTitleCardPlanCard,
  profile: AiComicSeedanceTitleCardOutputProfile,
  fontPath: string,
  outputPath: string,
): string[] {
  const size = profile === 'mp4_h264_720p'
    ? { width: 1280, height: 720, fontSize: 54 }
    : { width: 1920, height: 1080, fontSize: 78 };
  const backgroundColor = card.placement === 'series_opening' || card.placement === 'series_ending'
    ? '0x111827'
    : '0x1f2937';
  const drawtext = [
    `fontfile=${escapeFfmpegDrawtextValue(fontPath)}`,
    `text=${escapeFfmpegDrawtextValue(card.text)}`,
    'fontcolor=white',
    `fontsize=${size.fontSize}`,
    'x=(w-text_w)/2',
    'y=(h-text_h)/2',
    'box=1',
    'boxcolor=black@0.42',
    'boxborderw=28',
  ].join(':');
  return [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${backgroundColor}:s=${size.width}x${size.height}:d=${card.duration_sec}`,
    '-vf',
    `drawtext=${drawtext}`,
    '-r',
    '25',
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

function ffmpegFinalDeliveryArgs(
  inputPath: string,
  outputPath: string,
  outputProfile: AiComicSeedanceFinalDeliveryOutputProfile,
  useConcat: boolean,
): string[] {
  const base = useConcat
    ? ['-y', '-f', 'concat', '-safe', '0', '-i', inputPath]
    : ['-y', '-i', inputPath];
  if (outputProfile === 'source_copy') {
    return [...base, '-c', 'copy', '-movflags', '+faststart', outputPath];
  }
  const size = outputProfile === 'mp4_h264_720p'
    ? { width: 1280, height: 720 }
    : { width: 1920, height: 1080 };
  return [
    ...base,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

function shellDoubleQuoteIfNeeded(value: string): string {
  return /^[A-Za-z0-9_./:=,+?-]+$/.test(value) ? value : shellDoubleQuote(value);
}

async function runFfmpegThumbnailCapture(params: {
  ffmpegPath: string;
  videoUrl: string;
  outputPath: string;
  captureTimeSec: number;
}): Promise<void> {
  await execFileAsync(params.ffmpegPath, [
    '-y',
    '-ss',
    String(params.captureTimeSec),
    '-i',
    params.videoUrl,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    params.outputPath,
  ], { timeout: 120_000 });
}

async function runFfmpegCutAssembly(params: {
  ffmpegPath: string;
  concatListPath: string;
  outputPath: string;
  profile: SeedanceCutAssemblyProfile;
}): Promise<void> {
  await execFileAsync(
    params.ffmpegPath,
    ffmpegCutAssemblyArgs(params.concatListPath, params.outputPath, params.profile),
    { timeout: 600_000 },
  );
}

async function runFfmpegSubtitleBurnIn(params: {
  ffmpegPath: string;
  inputVideoPath: string;
  subtitlePath: string;
  outputPath: string;
}): Promise<void> {
  await execFileAsync(
    params.ffmpegPath,
    ffmpegSubtitleBurnInArgs(params.inputVideoPath, params.subtitlePath, params.outputPath),
    { timeout: 600_000 },
  );
}

async function runFfmpegAudioMix(params: {
  ffmpegPath: string;
  inputVideoPath: string;
  audioInputs: SeedanceAudioMixInput[];
  includeOriginalAudio: boolean;
  originalAudioVolumeDb: number;
  outputPath: string;
}): Promise<void> {
  await execFileAsync(
    params.ffmpegPath,
    ffmpegAudioMixArgs(params.inputVideoPath, params.audioInputs, params.outputPath, {
      includeOriginalAudio: params.includeOriginalAudio,
      originalAudioVolumeDb: params.originalAudioVolumeDb,
    }),
    { timeout: 600_000 },
  );
}

async function runFfmpegTitleCardRender(params: {
  ffmpegPath: string;
  card: AiComicSeedanceTitleCardPlanCard;
  outputPath: string;
  profile: AiComicSeedanceTitleCardOutputProfile;
  fontPath: string;
}): Promise<void> {
  await execFileAsync(
    params.ffmpegPath,
    ffmpegTitleCardArgs(params.card, params.profile, params.fontPath, params.outputPath),
    { timeout: 180_000 },
  );
}

async function runFfmpegFinalDelivery(params: {
  ffmpegPath: string;
  concatListPath?: string;
  inputVideoPath: string;
  outputPath: string;
  outputProfile: AiComicSeedanceFinalDeliveryOutputProfile;
  useConcat: boolean;
}): Promise<void> {
  await execFileAsync(
    params.ffmpegPath,
    ffmpegFinalDeliveryArgs(
      params.useConcat ? params.concatListPath! : params.inputVideoPath,
      params.outputPath,
      params.outputProfile,
      params.useConcat,
    ),
    { timeout: 900_000 },
  );
}

function resolveSeedanceProjectOutputPath(projectDir: string, outputPath: string): string {
  const absolute = resolve(projectDir, outputPath);
  const root = resolve(projectDir);
  if (absolute !== root && !absolute.startsWith(`${root}/`)) {
    throw new Error(`Seedance output path escapes project directory: ${outputPath}`);
  }
  return absolute;
}

function ffmpegConcatFileLine(value: string): string {
  return `file '${value.replace(/'/g, `'\\''`)}'`;
}

function escapeFfmpegDrawtextValue(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '\\%')}'`;
}

function formatSrtTimecode(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const sec = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const min = totalMinutes % 60;
  const hour = Math.floor(totalMinutes / 60);
  return [
    String(hour).padStart(2, '0'),
    String(min).padStart(2, '0'),
    String(sec).padStart(2, '0'),
  ].join(':') + `,${String(ms).padStart(3, '0')}`;
}

function buildSrtContent(
  cues: Array<AiComicSeedanceFinishingSubtitleCue & {
    srt_index: number;
    start_timecode: string;
    end_timecode: string;
  }>,
): string {
  return `${cues.map(cue => [
    String(cue.srt_index),
    `${cue.start_timecode} --> ${cue.end_timecode}`,
    sanitizeSrtText(cue.text),
  ].join('\n')).join('\n\n')}\n`;
}

function sanitizeSrtText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/-->/g, '->')
    .trim();
}

function escapeFfmpegSubtitleFilterPath(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function seedanceThumbnailLedgerNote(
  status: AiComicSeedanceThumbnailStatus,
  updatedAt: string,
  detail?: string,
): string {
  const map: Record<AiComicSeedanceThumbnailStatus, string> = {
    not_started: '缩略图未开始',
    planned: '缩略图抽帧已规划',
    capturing: '缩略图抽帧中',
    ready: '缩略图已生成',
    failed: '缩略图生成失败',
    skipped: '缩略图已跳过',
  };
  return `${map[status]}：${updatedAt}${detail ? `（${detail}` : ''}${detail ? '）' : ''}`;
}

function shellDoubleQuote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function latestReadySeedanceVersion(
  item: AiComicSeedanceShotProductionItem,
): AiComicSeedanceVideoVersion | undefined {
  return [...item.versions]
    .filter(version => version.status === 'ready' && Boolean(version.video_url))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

function selectedReadySeedanceVersion(
  item: AiComicSeedanceShotProductionItem,
): AiComicSeedanceVideoVersion | undefined {
  const selected = item.selected_version_id
    ? item.versions.find(version =>
      version.version_id === item.selected_version_id
      && version.status === 'ready'
      && Boolean(version.video_url)
    )
    : undefined;
  return selected ?? latestReadySeedanceVersion(item);
}

function bestReadySeedanceVersion(
  item: AiComicSeedanceShotProductionItem,
  minQualityScore?: number,
): AiComicSeedanceVideoVersion | undefined {
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

function seedanceAssetKindText(kind: AiComicSeedanceAssetReferenceItem['kind']): string {
  if (kind === 'character') return '人物';
  if (kind === 'costume') return '服装';
  if (kind === 'location') return '场景';
  if (kind === 'prop') return '道具';
  return '未知';
}

function seedanceAssetStatusText(status: AiComicSeedanceAssetReferenceItem['status']): string {
  if (status === 'bound') return '已绑定文件';
  if (status === 'missing_file') return '缺文件';
  return '缺引用槽位';
}

function seedanceAssetLookupKey(kind: AiComicSeedanceAssetReferenceItem['kind'], label: string): string {
  return `${kind}:${label.trim().toLowerCase()}`;
}

function seedanceAssetId(kind: AiComicSeedanceAssetReferenceItem['kind'], label: string): string {
  return `seedance-asset-${kind}-${slugifyConstraintKey(label)}`;
}

function parseSeedanceAssetReferencePlanItem(
  item: string,
  episodeNo: number,
  libraryByAssetId: Map<string, AiComicSeedanceAssetLibraryItem>,
  libraryByKey: Map<string, AiComicSeedanceAssetLibraryItem>,
): AiComicSeedanceAssetReferenceItem | null {
  const slot = item.match(/@图片\d+/)?.[0];
  const characterMatch = item.match(/人物「([^」]+)」形象参考[:：](.+)$/);
  if (characterMatch) {
    const label = characterMatch[1].trim();
    return applySeedanceAssetLibraryBinding({
      asset_id: seedanceAssetId('character', label),
      kind: 'character',
      label,
      reference_slot: slot,
      description: characterMatch[2].trim(),
      source_episode_nos: [episodeNo],
      source_shot_ids: [],
      required_by_shot_count: 0,
      has_reference_slot: Boolean(slot),
      is_bound: false,
      needs_upload: true,
      status: slot ? 'missing_file' : 'missing_reference_slot',
    }, libraryByAssetId, libraryByKey);
  }
  const locationMatch = item.match(/场景「([^」]+)」氛围参考[:：](.+)$/);
  if (locationMatch) {
    const label = locationMatch[1].trim();
    return applySeedanceAssetLibraryBinding({
      asset_id: seedanceAssetId('location', label),
      kind: 'location',
      label,
      reference_slot: slot,
      description: locationMatch[2].trim(),
      source_episode_nos: [episodeNo],
      source_shot_ids: [],
      required_by_shot_count: 0,
      has_reference_slot: Boolean(slot),
      is_bound: false,
      needs_upload: true,
      status: slot ? 'missing_file' : 'missing_reference_slot',
    }, libraryByAssetId, libraryByKey);
  }
  return null;
}

function resolveSeedanceShotAsset(input: {
  kind: AiComicSeedanceAssetReferenceItem['kind'];
  label: string;
  episodeNo: number;
  shotId: string;
  episodeAssets: Map<string, AiComicSeedanceAssetReferenceItem>;
  assets: Map<string, AiComicSeedanceAssetReferenceItem>;
  libraryByAssetId: Map<string, AiComicSeedanceAssetLibraryItem>;
  libraryByKey: Map<string, AiComicSeedanceAssetLibraryItem>;
}): AiComicSeedanceAssetReferenceItem | null {
  const label = input.label.trim();
  if (!label || label === '未指定场景') return null;
  const planned = input.episodeAssets.get(seedanceAssetLookupKey(input.kind, label));
  const asset: AiComicSeedanceAssetReferenceItem = planned
    ? {
      ...planned,
      source_episode_nos: [...planned.source_episode_nos, input.episodeNo],
      source_shot_ids: [...planned.source_shot_ids, input.shotId],
    }
    : {
      asset_id: seedanceAssetId(input.kind, label),
      kind: input.kind,
      label,
      source_episode_nos: [input.episodeNo],
      source_shot_ids: [input.shotId],
      required_by_shot_count: 1,
      has_reference_slot: false,
      is_bound: false,
      needs_upload: true,
      status: 'missing_reference_slot',
    };
  upsertSeedanceAssetReference(input.assets, applySeedanceAssetLibraryBinding(
    asset,
    input.libraryByAssetId,
    input.libraryByKey,
  ));
  return input.assets.get(asset.asset_id) ?? asset;
}

function applySeedanceAssetLibraryBinding(
  asset: AiComicSeedanceAssetReferenceItem,
  libraryByAssetId: Map<string, AiComicSeedanceAssetLibraryItem>,
  libraryByKey: Map<string, AiComicSeedanceAssetLibraryItem>,
): AiComicSeedanceAssetReferenceItem {
  const libraryItem = libraryByAssetId.get(asset.asset_id)
    ?? libraryByKey.get(seedanceAssetLookupKey(asset.kind, asset.label));
  const referenceSlot = asset.reference_slot ?? libraryItem?.reference_slot;
  const fileUrl = libraryItem?.file_url;
  const fileId = libraryItem?.file_id;
  const hasReferenceSlot = Boolean(referenceSlot);
  const isBound = hasReferenceSlot && Boolean(fileUrl || fileId);
  return {
    ...asset,
    reference_slot: referenceSlot,
    file_url: fileUrl,
    file_id: fileId,
    local_path: libraryItem?.local_path,
    original_filename: libraryItem?.original_filename,
    provider: libraryItem?.provider,
    content_sha256: libraryItem?.content_sha256,
    rights_status: libraryItem?.rights_status,
    authorization_reference: libraryItem?.authorization_reference,
    person_consent_reference: libraryItem?.person_consent_reference,
    human_review_status: libraryItem?.human_review_status,
    reviewer_id: libraryItem?.reviewer_id,
    reviewed_at: libraryItem?.reviewed_at,
    review_note: libraryItem?.review_note,
    description: asset.description ?? libraryItem?.description,
    has_reference_slot: hasReferenceSlot,
    is_bound: isBound,
    needs_upload: !isBound,
    status: isBound ? 'bound' : hasReferenceSlot ? 'missing_file' : 'missing_reference_slot',
  };
}

function upsertSeedanceAssetReference(
  assets: Map<string, AiComicSeedanceAssetReferenceItem>,
  next: AiComicSeedanceAssetReferenceItem,
): void {
  const existing = assets.get(next.asset_id);
  if (!existing) {
    assets.set(next.asset_id, {
      ...next,
      source_episode_nos: uniqueNumbers(next.source_episode_nos),
      source_shot_ids: unique(next.source_shot_ids),
      required_by_shot_count: unique(next.source_shot_ids).length,
    });
    return;
  }
  const referenceSlot = existing.reference_slot ?? next.reference_slot;
  const hasReferenceSlot = existing.has_reference_slot || next.has_reference_slot;
  const fileUrl = existing.file_url ?? next.file_url;
  const fileId = existing.file_id ?? next.file_id;
  const isBound = hasReferenceSlot && Boolean(fileUrl || fileId);
  assets.set(next.asset_id, {
    ...existing,
    reference_slot: referenceSlot,
    file_url: fileUrl,
    file_id: fileId,
    description: existing.description ?? next.description,
    source_episode_nos: uniqueNumbers([...existing.source_episode_nos, ...next.source_episode_nos]),
    source_shot_ids: unique([...existing.source_shot_ids, ...next.source_shot_ids]),
    required_by_shot_count: unique([...existing.source_shot_ids, ...next.source_shot_ids]).length,
    has_reference_slot: hasReferenceSlot,
    is_bound: isBound,
    needs_upload: !isBound,
    status: isBound ? 'bound' : hasReferenceSlot ? 'missing_file' : 'missing_reference_slot',
  });
}

function sortedSeedanceVersionsForComparison(
  item: AiComicSeedanceShotProductionItem,
): AiComicSeedanceVideoVersion[] {
  return [...item.versions].sort((a, b) => {
    const aReady = a.status === 'ready' && Boolean(a.video_url);
    const bReady = b.status === 'ready' && Boolean(b.video_url);
    if (aReady !== bReady) return aReady ? -1 : 1;
    const aScore = typeof a.quality_score === 'number' ? a.quality_score : -1;
    const bScore = typeof b.quality_score === 'number' ? b.quality_score : -1;
    if (aScore !== bScore) return bScore - aScore;
    return b.created_at.localeCompare(a.created_at);
  });
}

function buildSeedanceVersionComparisonShot(
  item: AiComicSeedanceShotProductionItem,
): AiComicSeedanceVersionComparisonShot {
  const autoBestVersion = bestReadySeedanceVersion(item);
  const versions: AiComicSeedanceVersionComparisonRow[] = sortedSeedanceVersionsForComparison(item)
    .map((version, index) => ({
      version_id: version.version_id,
      status: version.status,
      created_at: version.created_at,
      provider_job_id: version.provider_job_id,
      video_url: version.video_url,
      failure_reason: version.failure_reason,
      note: version.note,
      quality_score: version.quality_score,
      review_note: version.review_note,
      rank: index + 1,
      is_selected: version.version_id === item.selected_version_id,
      is_auto_best: version.version_id === autoBestVersion?.version_id,
      decision_reason: seedanceVersionDecisionReason(item, version, autoBestVersion),
    }));
  return {
    production_id: item.production_id,
    episode_no: item.episode_no,
    episode_title: item.episode_title,
    story_id: item.story_id,
    shot_id: item.shot_id,
    source_scene_id: item.source_scene_id,
    selected_version_id: item.selected_version_id,
    auto_best_version_id: autoBestVersion?.version_id,
    ready_version_count: item.versions.filter(version => version.status === 'ready' && Boolean(version.video_url)).length,
    failed_version_count: item.versions.filter(version => version.status === 'failed').length,
    versions,
  };
}

function seedanceVersionDecisionReason(
  item: AiComicSeedanceShotProductionItem,
  version: AiComicSeedanceVideoVersion,
  autoBestVersion?: AiComicSeedanceVideoVersion,
): string {
  if (version.version_id === item.selected_version_id && version.version_id === autoBestVersion?.version_id) {
    return '当前剪辑版；也是自动择优推荐。';
  }
  if (version.version_id === item.selected_version_id) {
    return '当前剪辑版；建议人工确认是否仍优于自动推荐。';
  }
  if (version.version_id === autoBestVersion?.version_id) {
    return '自动择优推荐：可用版本中质量分最高；同分时选择更新版本。';
  }
  if (version.status === 'failed') {
    return version.failure_reason ? `失败版本：${version.failure_reason}` : '失败版本：需要查看平台错误。';
  }
  if (version.status === 'ready' && !version.video_url) {
    return '状态已完成但缺少视频 URL，剪辑前需补拉结果。';
  }
  if (version.status === 'ready') {
    return '可用备选版本，可在画面观感更佳时手动设为剪辑版。';
  }
  if (version.status === 'processing' || version.status === 'submitted') {
    return '仍在生成流程中，等待平台回传后再比较。';
  }
  return '非可剪辑版本，仅作生产流水记录。';
}

function shouldRetrySeedanceProductionItem(
  item?: AiComicSeedanceShotProductionItem,
): boolean {
  if (!item) return true;
  if (item.status === 'skipped') return false;
  if (item.status === 'ready' && item.video_url) return false;
  return true;
}

function seedanceRetryReviewIssuesByProductionId(
  detail: AiComicSeriesProjectDetail,
): Map<string, NonNullable<AiComicSeedanceRetryPackageShot['review_issues']>> {
  const productionLedger = normalizeSeedanceProductionLedger(detail.seedance_production);
  const reviewLedger = normalizeSeedanceReviewLedger(detail.seedance_review_ledger);
  const reviewIssuesByProductionId = new Map<string, NonNullable<AiComicSeedanceRetryPackageShot['review_issues']>>();
  const reviewItems = (reviewLedger?.items ?? []).filter(item =>
    seedanceReviewItemOpen(item)
    && item.target_type === 'shot'
    && (item.repair_action === 'redo_shot' || item.repair_action === 'reselect_version')
  );
  for (const review of reviewItems) {
    for (const productionItem of productionLedger.items) {
      if (!seedanceReviewTargetsProductionItem(review, productionItem)) continue;
      const issues = reviewIssuesByProductionId.get(productionItem.production_id) ?? [];
      issues.push({
        review_id: review.review_id,
        severity: review.severity,
        issue_type: review.issue_type,
        note: review.note,
        repair_action: review.repair_action,
      });
      reviewIssuesByProductionId.set(productionItem.production_id, issues);
    }
  }
  return reviewIssuesByProductionId;
}

function seedanceReviewTargetsProductionItem(
  review: AiComicSeedanceReviewItem,
  item: AiComicSeedanceShotProductionItem,
): boolean {
  if (review.episode_no && review.episode_no !== item.episode_no) return false;
  const reviewTargets = new Set([
    review.target_id,
    review.shot_id,
  ].filter(Boolean));
  return reviewTargets.has(item.shot_id) || reviewTargets.has(item.production_id);
}

function buildSeedanceRetryExecutionCandidate(
  shot: AiComicSeedanceRetryPackageShot,
): AiComicSeedanceRetryExecutionCandidate {
  const blockReason = seedanceRetryExecutionBlockReason(shot);
  return {
    production_id: shot.production_id,
    episode_no: shot.episode_no,
    episode_title: shot.episode_title,
    story_id: shot.story_id,
    shot_id: shot.shot_id,
    source_scene_id: shot.source_scene_id,
    status: shot.status,
    retry_count: shot.retry_count,
    retry_reason: shot.retry_reason,
    priority: seedanceRetryExecutionPriority(shot, blockReason),
    can_submit: !blockReason,
    block_reason: blockReason,
    suggested_action: blockReason ?? shot.suggested_action,
    failure_reason: shot.failure_reason,
    provider_job_id: shot.provider_job_id,
    last_video_url: shot.last_video_url,
    review_issues: shot.review_issues,
    prompt: shot.prompt,
  };
}

function seedanceRetryExecutionBlockReason(
  shot: AiComicSeedanceRetryPackageShot,
): string | undefined {
  if (!shot.prompt.seedance_prompt.trim()) return '缺少 Seedance 提示词，需先重新导出提示词包。';
  if (shot.review_issues?.some(issue => issue.repair_action === 'reselect_version')) {
    return '审片要求重选剪辑版，需先进入版本对比选择可用版本。';
  }
  if (shot.status === 'submitted' || shot.status === 'processing') {
    return '镜头仍在提交或处理中，需确认超时或失败后再重提。';
  }
  if (shot.status === 'ready' && !shot.last_video_url) {
    return '镜头已 ready 但缺少视频 URL，优先补拉平台结果。';
  }
  if (shot.status === 'skipped') return '镜头已跳过，需人工确认是否恢复生产。';
  return undefined;
}

function seedanceRetryExecutionPriority(
  shot: AiComicSeedanceRetryPackageShot,
  blockReason?: string,
): AiComicSeedanceRetryExecutionCandidate['priority'] {
  if (shot.review_issues?.some(issue => issue.severity === 'blocking' || issue.severity === 'major')) {
    return 'high';
  }
  if (shot.status === 'failed') return 'high';
  if (shot.status === 'submitted' || shot.status === 'processing') return 'normal';
  if (blockReason) return 'normal';
  if (shot.status === 'not_started' || shot.status === 'prompt_exported') return 'low';
  return 'normal';
}

function seedanceRetryExecutionCandidateSort(
  left: AiComicSeedanceRetryExecutionCandidate,
  right: AiComicSeedanceRetryExecutionCandidate,
): number {
  const priorityRank: Record<AiComicSeedanceRetryExecutionCandidate['priority'], number> = {
    high: 0,
    normal: 1,
    low: 2,
  };
  if (priorityRank[left.priority] !== priorityRank[right.priority]) {
    return priorityRank[left.priority] - priorityRank[right.priority];
  }
  if (left.can_submit !== right.can_submit) return left.can_submit ? -1 : 1;
  return compareSeedanceShotIds(left.shot_id, right.shot_id);
}

function seedanceRetryExecutionReasonCounts(
  candidates: AiComicSeedanceRetryExecutionCandidate[],
): Record<AiComicSeedanceRetryReason, number> {
  const counts: Record<AiComicSeedanceRetryReason, number> = {
    production_status: 0,
    review_required: 0,
  };
  for (const candidate of candidates) {
    counts[candidate.retry_reason] += 1;
  }
  return counts;
}

function seedanceRetrySubmitProviderJobId(
  jobPrefix: string,
  candidate: AiComicSeedanceRetryExecutionCandidate,
  index: number,
  submittedAt: string,
): string {
  const timestamp = submittedAt.replace(/\D/g, '').slice(0, 14);
  return `${jobPrefix}-${candidate.production_id}-${index + 1}-${timestamp}`.slice(0, 120);
}

function configuredAiComicSeriesSeedanceProviderSubmitEndpoint(): string | undefined {
  const endpoint = process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT?.trim();
  return endpoint || undefined;
}

function aiComicSeriesSeedanceProviderSubmitRequestMode(): SeedanceProviderSubmitRequestMode {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE?.trim().toLowerCase() === 'per_shot'
    ? 'per_shot'
    : 'batch';
}

function aiComicSeriesSeedanceProviderSubmitTimeoutMs(): number {
  const parsed = Number(process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30000;
  return Math.min(parsed, 60000);
}

function aiComicSeriesSeedanceProviderAdapterAuthHeader(): string {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER?.trim()
    || process.env.SEEDANCE_PROVIDER_AUTH_HEADER?.trim()
    || 'authorization';
}

function aiComicSeriesSeedanceProviderAdapterAuthScheme(): string {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME?.trim()
    || process.env.SEEDANCE_PROVIDER_AUTH_SCHEME?.trim()
    || 'Bearer';
}

function aiComicSeriesSeedanceProviderAdapterToken(): string | undefined {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN?.trim()
    || process.env.SEEDANCE_PROVIDER_API_TOKEN?.trim()
    || undefined;
}

function aiComicSeriesSeedanceProviderAdapterAuthValue(token: string, scheme: string): string {
  const normalized = scheme.trim();
  if (!normalized || ['raw', 'none', 'no_scheme'].includes(normalized.toLowerCase())) return token;
  return `${normalized} ${token}`;
}

function applyAiComicSeriesSeedanceProviderAdapterAuthHeader(headers: Record<string, string>): void {
  const token = aiComicSeriesSeedanceProviderAdapterToken();
  if (!token) return;
  headers[aiComicSeriesSeedanceProviderAdapterAuthHeader()] = aiComicSeriesSeedanceProviderAdapterAuthValue(
    token,
    aiComicSeriesSeedanceProviderAdapterAuthScheme(),
  );
}

function aiComicSeriesSeedanceProviderAdapterSignatureSecret(): string | undefined {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET?.trim()
    || undefined;
}

function aiComicSeriesSeedanceProviderAdapterSignatureHeader(): string {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER?.trim()
    || 'X-Seedance-Signature';
}

function aiComicSeriesSeedanceProviderAdapterTimestampHeader(): string {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER?.trim()
    || process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER?.trim()
    || 'X-Seedance-Timestamp';
}

function aiComicSeriesSeedanceProviderAdapterSignatureAlgorithm(): string {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_ALGORITHM?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_ALGORITHM?.trim()
    || 'sha256';
}

function aiComicSeriesSeedanceProviderAdapterSignaturePrefix(): string {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_PREFIX?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_PREFIX?.trim()
    || 'sha256=';
}

function applyAiComicSeriesSeedanceProviderAdapterSignatureHeaders(input: {
  headers: Record<string, string>;
  endpoint: string;
  bodyText: string;
}): void {
  const secret = aiComicSeriesSeedanceProviderAdapterSignatureSecret();
  if (!secret) return;
  const timestamp = new Date().toISOString();
  const signatureBase = ['POST', input.endpoint, timestamp, input.bodyText].join('\n');
  const digest = createHmac(aiComicSeriesSeedanceProviderAdapterSignatureAlgorithm(), secret)
    .update(signatureBase)
    .digest('hex');
  input.headers[aiComicSeriesSeedanceProviderAdapterTimestampHeader()] = timestamp;
  input.headers[aiComicSeriesSeedanceProviderAdapterSignatureHeader()] =
    `${aiComicSeriesSeedanceProviderAdapterSignaturePrefix()}${digest}`;
}

function aiComicSeriesSeedanceProviderAdapterRequestInit(input: {
  endpoint: string;
  signal: AbortSignal;
  body: unknown;
}): RequestInit {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const bodyText = JSON.stringify(input.body);
  applyAiComicSeriesSeedanceProviderAdapterAuthHeader(headers);
  applyAiComicSeriesSeedanceProviderAdapterSignatureHeaders({
    headers,
    endpoint: input.endpoint,
    bodyText,
  });
  return {
    method: 'POST',
    headers,
    signal: input.signal,
    body: bodyText,
  };
}

const AI_COMIC_SERIES_SEEDANCE_PROVIDER_RESULT_ARRAY_KEYS = [
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

const AI_COMIC_SERIES_SEEDANCE_PROVIDER_RESULT_CONTAINER_KEYS = [
  'data',
  'result',
  'response',
  'payload',
  'output',
];

function aiComicSeriesSeedanceProviderArrayField(
  record: Record<string, unknown>,
  keys: string[],
): unknown[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function aiComicSeriesSeedanceProviderLooksLikeResultRecord(record: Record<string, unknown>): boolean {
  const error = record.error;
  return [
    'production_id',
    'productionId',
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
    'code',
    'error_code',
    'errorCode',
  ].some(key => record[key] !== undefined)
    || typeof error === 'string'
    || isObjectRecord(error);
}

function aiComicSeriesSeedanceProviderResultArray(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  if (!isObjectRecord(payload)) return undefined;
  const direct = aiComicSeriesSeedanceProviderArrayField(
    payload,
    AI_COMIC_SERIES_SEEDANCE_PROVIDER_RESULT_ARRAY_KEYS,
  );
  if (direct) return direct;
  for (const key of AI_COMIC_SERIES_SEEDANCE_PROVIDER_RESULT_CONTAINER_KEYS) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested;
    if (isObjectRecord(nested)) {
      const nestedArray = aiComicSeriesSeedanceProviderArrayField(
        nested,
        AI_COMIC_SERIES_SEEDANCE_PROVIDER_RESULT_ARRAY_KEYS,
      );
      if (nestedArray) return nestedArray;
      if (aiComicSeriesSeedanceProviderLooksLikeResultRecord(nested)) return [nested];
    }
  }
  if (aiComicSeriesSeedanceProviderLooksLikeResultRecord(payload)) return [payload];
  return undefined;
}

function aiComicSeriesSeedanceProviderStringField(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return callbackStringField(value);
}

function aiComicSeriesSeedanceProviderNumberField(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function aiComicSeriesSeedanceProviderResultProductionId(item: Record<string, unknown>): string | undefined {
  return callbackStringField(item.production_id ?? item.productionId);
}

function aiComicSeriesSeedanceProviderResultShotId(item: Record<string, unknown>): string | undefined {
  return callbackStringField(
    item.shot_id
      ?? item.shotId
      ?? item.external_id
      ?? item.externalId
      ?? item.custom_id
      ?? item.customId,
  );
}

function aiComicSeriesSeedanceProviderResultStatus(item: Record<string, unknown>): string | undefined {
  return aiComicSeriesSeedanceProviderStringField(
    item.status ?? item.task_status ?? item.taskStatus ?? item.state ?? item.phase,
  );
}

function aiComicSeriesSeedanceProviderResultJobId(item: Record<string, unknown>): string | undefined {
  return aiComicSeriesSeedanceProviderStringField(
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

function aiComicSeriesSeedanceProviderResultQueueId(item: Record<string, unknown>): string | undefined {
  return aiComicSeriesSeedanceProviderStringField(
    item.provider_queue_id
      ?? item.providerQueueId
      ?? item.queue_id
      ?? item.queueId
      ?? item.batch_id
      ?? item.batchId,
  );
}

function aiComicSeriesSeedanceProviderResultQueuePosition(item: Record<string, unknown>): number | undefined {
  return aiComicSeriesSeedanceProviderNumberField(
    item.provider_queue_position
      ?? item.providerQueuePosition
      ?? item.queue_position
      ?? item.queuePosition
      ?? item.position,
  );
}

function aiComicSeriesSeedanceProviderResultMessage(item: Record<string, unknown>): string | undefined {
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

function normalizeAiComicSeriesSeedanceProviderSubmitAdapterStatus(
  value: unknown,
): Extract<AiComicSeedanceProductionStatus, 'submitted' | 'processing'> | 'failed' {
  if (typeof value !== 'string') return 'submitted';
  const normalized = value.trim().toLowerCase();
  if (['processing', 'running', 'in_progress', 'in-progress', 'generating'].includes(normalized)) return 'processing';
  if (['failed', 'failure', 'error', 'rejected', 'blocked', 'cancelled', 'canceled'].includes(normalized)) {
    return 'failed';
  }
  return 'submitted';
}

function aiComicSeriesRetrySubmitCandidateByShotId(
  candidates: AiComicSeriesRetrySubmitCandidate[],
  shotId: string,
): AiComicSeriesRetrySubmitCandidate | 'ambiguous' | undefined {
  const matches = candidates.filter(item => item.candidate.shot_id === shotId);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return 'ambiguous';
  return undefined;
}

function normalizeAiComicSeriesSeedanceProviderSubmitAdapterResults(input: {
  payload: unknown;
  candidates: AiComicSeriesRetrySubmitCandidate[];
  requestMode: SeedanceProviderSubmitRequestMode;
}): {
  accepted: AiComicSeriesRetrySubmitAcceptedItem[];
  failures: SeedanceShotProviderSubmitFailure[];
  summary: SeedanceShotProviderSubmitAdapterSummary;
} | string {
  if (isObjectRecord(input.payload) && input.payload.ok === false) {
    const error = isObjectRecord(input.payload.error) ? input.payload.error.message : undefined;
    return typeof error === 'string' && error.trim()
      ? `Seedance provider submit adapter failed: ${error.trim()}`
      : 'Seedance provider submit adapter returned ok=false';
  }
  const rawResults = aiComicSeriesSeedanceProviderResultArray(input.payload);
  if (!rawResults) {
    return 'Seedance provider submit adapter response must be an array or include submitted_shots/provider_results/results/items/tasks/data.tasks';
  }

  const candidatesByProductionId = new Map(input.candidates.map(item => [item.candidate.production_id, item]));
  const accepted: AiComicSeriesRetrySubmitAcceptedItem[] = [];
  const failures: SeedanceShotProviderSubmitFailure[] = [];
  const seenProductionIds = new Set<string>();
  for (const [index, item] of rawResults.entries()) {
    if (!isObjectRecord(item)) {
      return `Seedance provider submit adapter result #${index + 1} must be an object`;
    }
    const productionId = aiComicSeriesSeedanceProviderResultProductionId(item)
      ?? (rawResults.length === 1 && input.candidates.length === 1
        ? input.candidates[0].candidate.production_id
        : undefined);
    const shotId = aiComicSeriesSeedanceProviderResultShotId(item);
    let candidateRef = productionId ? candidatesByProductionId.get(productionId) : undefined;
    if (!candidateRef && shotId) {
      const byShotId = aiComicSeriesRetrySubmitCandidateByShotId(input.candidates, shotId);
      if (byShotId === 'ambiguous') {
        failures.push({
          index,
          shot_id: shotId,
          message: `Seedance provider submit adapter returned ambiguous shot_id "${shotId}"; include production_id`,
        });
        continue;
      }
      candidateRef = byShotId;
    }
    if (!candidateRef) {
      failures.push({
        index,
        shot_id: shotId ?? productionId,
        message: `Seedance provider submit adapter returned unknown shot "${shotId ?? productionId ?? 'unknown'}"`,
      });
      continue;
    }
    seenProductionIds.add(candidateRef.candidate.production_id);
    const status = normalizeAiComicSeriesSeedanceProviderSubmitAdapterStatus(
      aiComicSeriesSeedanceProviderResultStatus(item),
    );
    const message = aiComicSeriesSeedanceProviderResultMessage(item);
    if (status === 'failed') {
      failures.push({
        index: candidateRef.queue_position - 1,
        shot_id: candidateRef.candidate.shot_id,
        message: message ?? 'Seedance provider submit adapter rejected this shot',
      });
      continue;
    }
    const providerJobId = aiComicSeriesSeedanceProviderResultJobId(item);
    if (!providerJobId) {
      failures.push({
        index: candidateRef.queue_position - 1,
        shot_id: candidateRef.candidate.shot_id,
        message: 'Seedance provider submit adapter accepted shot without provider_job_id/job_id',
      });
      continue;
    }
    accepted.push({
      candidate: candidateRef.candidate,
      provider_job_id: providerJobId,
      provider_queue_id: aiComicSeriesSeedanceProviderResultQueueId(item),
      provider_queue_position: aiComicSeriesSeedanceProviderResultQueuePosition(item),
      status,
    });
  }

  input.candidates.forEach(candidateRef => {
    if (seenProductionIds.has(candidateRef.candidate.production_id)) return;
    failures.push({
      index: candidateRef.queue_position - 1,
      shot_id: candidateRef.candidate.shot_id,
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

function aiComicSeriesRetrySubmitAdapterShotPayload(
  item: AiComicSeriesRetrySubmitCandidate,
): Record<string, unknown> {
  const prompt = item.candidate.prompt;
  return {
    production_id: item.candidate.production_id,
    episode_no: item.candidate.episode_no,
    episode_title: item.candidate.episode_title,
    story_id: item.candidate.story_id,
    shot_id: item.candidate.shot_id,
    source_scene_id: item.candidate.source_scene_id,
    status: item.candidate.status,
    retry_count: item.candidate.retry_count,
    retry_reason: item.candidate.retry_reason,
    priority: item.candidate.priority,
    suggested_action: item.candidate.suggested_action,
    failure_reason: item.candidate.failure_reason,
    previous_provider_job_id: item.candidate.provider_job_id,
    local_provider_job_id: item.local_provider_job_id,
    provider_queue_position: item.queue_position,
    review_issues: item.candidate.review_issues,
    duration_sec: prompt.duration_sec,
    characters: prompt.characters,
    location: prompt.location,
    script_text: prompt.script_text,
    visual_prompt: prompt.visual_prompt,
    camera_suggestion: prompt.camera_suggestion,
    continuity_notes: prompt.continuity_notes,
    negative_constraints: prompt.negative_constraints,
    asset_slots: prompt.asset_slots,
    material_validation: prompt.material_validation,
    seedance_prompt: prompt.seedance_prompt,
  };
}

function aiComicSeriesRetrySubmitAdapterBasePayload(input: {
  seriesProjectId: string;
  executionPlan: AiComicSeriesSeedanceRetryExecutionPlan;
  requestMode: SeedanceProviderSubmitRequestMode;
  submittedAt: string;
  note?: string;
  externalCallAuthorization?: ExternalProviderCallAuthorizationRecord;
  candidates: AiComicSeriesRetrySubmitCandidate[];
}): Record<string, unknown> {
  return {
    schema_version: 'ai-comic-series-seedance-retry-submit/v1',
    request_mode: input.requestMode,
    series_project_id: input.seriesProjectId,
    series_title: input.executionPlan.series_title,
    source_retry_execution_plan_exported_at: input.executionPlan.exported_at,
    submitted_at: input.submittedAt,
    note: input.note,
    external_call_authorization: input.externalCallAuthorization
      ? {
          authorization_reference: input.externalCallAuthorization.authorization_reference,
          max_cost_amount: input.externalCallAuthorization.max_cost_amount,
          cost_currency: input.externalCallAuthorization.cost_currency,
          data_transfer_acknowledged: true,
          confirmed_at: input.externalCallAuthorization.confirmed_at,
        }
      : undefined,
    shots: input.candidates.map(aiComicSeriesRetrySubmitAdapterShotPayload),
  };
}

async function queryAiComicSeriesSeedanceRetrySubmitAdapter(input: {
  seriesProjectId: string;
  executionPlan: AiComicSeriesSeedanceRetryExecutionPlan;
  submittedAt: string;
  note?: string;
  externalCallAuthorization?: ExternalProviderCallAuthorizationRecord;
  candidates: AiComicSeriesRetrySubmitCandidate[];
}): Promise<ApiResponse<{
  accepted: AiComicSeriesRetrySubmitAcceptedItem[];
  failures: SeedanceShotProviderSubmitFailure[];
  summary: SeedanceShotProviderSubmitAdapterSummary;
}>> {
  const endpoint = configuredAiComicSeriesSeedanceProviderSubmitEndpoint();
  if (!endpoint) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'SEEDANCE_PROVIDER_SUBMIT_ENDPOINT is required when use_provider_adapter=true',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiComicSeriesSeedanceProviderSubmitTimeoutMs());
  try {
    const requestMode = aiComicSeriesSeedanceProviderSubmitRequestMode();
    const basePayload = aiComicSeriesRetrySubmitAdapterBasePayload({
      seriesProjectId: input.seriesProjectId,
      executionPlan: input.executionPlan,
      requestMode,
      submittedAt: input.submittedAt,
      note: input.note,
      externalCallAuthorization: input.externalCallAuthorization,
      candidates: input.candidates,
    });

    if (requestMode === 'per_shot') {
      const accepted: AiComicSeriesRetrySubmitAcceptedItem[] = [];
      const failures: SeedanceShotProviderSubmitFailure[] = [];
      for (const candidate of input.candidates) {
        const shot = aiComicSeriesRetrySubmitAdapterShotPayload(candidate);
        const body = {
          ...basePayload,
          shot,
          shots: [shot],
        };
        const response = await fetch(endpoint, aiComicSeriesSeedanceProviderAdapterRequestInit({
          endpoint,
          signal: controller.signal,
          body,
        }));
        const text = await response.text();
        if (!response.ok) {
          failures.push({
            index: candidate.queue_position - 1,
            shot_id: candidate.candidate.shot_id,
            message: `Seedance provider submit adapter returned HTTP ${response.status}: ${text.slice(0, 200)}`,
          });
          continue;
        }
        const payload = text.trim() ? JSON.parse(text) as unknown : [];
        const normalized = normalizeAiComicSeriesSeedanceProviderSubmitAdapterResults({
          payload,
          candidates: [candidate],
          requestMode,
        });
        if (typeof normalized === 'string') {
          failures.push({
            index: candidate.queue_position - 1,
            shot_id: candidate.candidate.shot_id,
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

    const response = await fetch(endpoint, aiComicSeriesSeedanceProviderAdapterRequestInit({
      endpoint,
      signal: controller.signal,
      body: basePayload,
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
    const normalized = normalizeAiComicSeriesSeedanceProviderSubmitAdapterResults({
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

function seedanceProviderRecoveryItem(
  item: AiComicSeedanceShotProductionItem & { status: AiComicSeedanceRecoverableProductionStatus },
  checkedAt: string,
): AiComicSeedanceProviderRecoveryItem {
  const waitingSince = item.submitted_at ?? item.updated_at;
  return {
    production_id: item.production_id,
    episode_no: item.episode_no,
    episode_title: item.episode_title,
    shot_id: item.shot_id,
    status: item.status,
    provider_job_id: item.provider_job_id,
    submitted_at: item.submitted_at,
    updated_at: item.updated_at,
    minutes_waiting: seedanceWaitingMinutes(waitingSince, checkedAt),
    retry_count: item.retry_count,
  };
}

function seedanceWaitingMinutes(since: string | undefined, until: string): number {
  const sinceMs = Date.parse(since ?? until);
  const untilMs = Date.parse(until);
  if (!Number.isFinite(sinceMs) || !Number.isFinite(untilMs)) return 0;
  return Math.max(0, Math.floor((untilMs - sinceMs) / 60_000));
}

function seedanceRetrySuggestedAction(
  item?: AiComicSeedanceShotProductionItem,
  reviewIssues: NonNullable<AiComicSeedanceRetryPackageShot['review_issues']> = [],
): string {
  if (reviewIssues.some(issue => issue.repair_action === 'reselect_version')) {
    return '审片意见要求重选剪辑版；先回到版本对比，必要时再重新提交。';
  }
  if (reviewIssues.length > 0) {
    return '审片意见要求重做该镜头；按原提示词或微调后重新提交。';
  }
  if (!item) return '尚未提交，按原提示词提交生成。';
  if (item.status === 'failed') return item.retry_count > 0 ? '检查失败原因后再次提交，必要时微调负向约束。' : '按原提示词重新提交一次。';
  if (item.status === 'ready' && !item.video_url) return '状态已完成但缺少视频 URL，优先向平台补拉结果。';
  if (item.status === 'processing' || item.status === 'submitted') return '确认平台任务是否超时；如无结果则重新提交。';
  if (item.status === 'prompt_exported' || item.status === 'not_started') return '按提示词提交生成。';
  return '人工复核后决定是否重试。';
}

function normalizeSeedanceCallbackStatus(
  status: string | undefined,
  hasVideoUrl: boolean,
  hasFailureReason: boolean,
): AiComicSeedanceProductionStatus {
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

function callbackStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function callbackNumberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function callbackCostNumberField(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compareSeedanceShotIds(a: string, b: string): number {
  const aNumber = Number(a.match(/\d+/)?.[0] ?? Number.NaN);
  const bNumber = Number(b.match(/\d+/)?.[0] ?? Number.NaN);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
    return aNumber - bNumber;
  }
  return a.localeCompare(b, 'zh-Hans-CN');
}

function mergeMemoryRecallControls(
  preferences?: AiComicSeriesMemoryRecallPreferences,
  controls?: AiComicSeriesMemoryRecallControls,
  episodeNo?: number,
): AiComicSeriesMemoryRecallControls {
  const episodeControls = episodeNo ? preferences?.per_episode?.[String(episodeNo)] : undefined;
  const locked = unique([
    ...(preferences?.locked_memory_ids ?? []),
    ...(episodeControls?.locked_memory_ids ?? []),
    ...(controls?.locked_memory_ids ?? []),
  ]);
  const excluded = unique([
    ...(preferences?.excluded_memory_ids ?? []),
    ...(episodeControls?.excluded_memory_ids ?? []),
    ...(controls?.excluded_memory_ids ?? []),
  ]);
  return {
    locked_memory_ids: locked,
    excluded_memory_ids: excluded.filter(id => !locked.includes(id)),
  };
}

function buildInitialEpisodicMemoryIndex(): AiComicEpisodicMemoryIndex {
  return {
    schema_version: 'ai-comic-episodic-memory/v1',
    embedding_strategy: 'lexical-token-signature/v1',
    items: [],
  };
}

function cloneEpisodicMemoryIndex(index: AiComicEpisodicMemoryIndex): AiComicEpisodicMemoryIndex {
  return {
    schema_version: 'ai-comic-episodic-memory/v1',
    embedding_strategy: 'lexical-token-signature/v1',
    items: index.items.map(item => ({
      ...item,
      characters: [...item.characters],
      keywords: [...item.keywords],
      token_signature: [...item.token_signature],
      recall_notes: [...item.recall_notes],
    })),
    updated_at: index.updated_at,
  };
}

function updateEpisodicMemoryIndex(params: {
  index: AiComicEpisodicMemoryIndex;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  story?: StoryGenerateResult;
  generatedAt?: string;
}): AiComicEpisodicMemoryIndex {
  const nextItems = params.story
    ? buildEpisodeEpisodicMemoryItems({
        plan: params.plan,
        episode: params.episode,
        story: params.story,
      })
    : [];
  const existing = params.index.items.filter(item => item.episode_no !== params.episode.episode_no);
  return {
    schema_version: 'ai-comic-episodic-memory/v1',
    embedding_strategy: 'lexical-token-signature/v1',
    items: [...existing, ...nextItems]
      .sort((a, b) => a.episode_no - b.episode_no || a.title.localeCompare(b.title, 'zh-Hans-CN'))
      .slice(-420),
    updated_at: params.generatedAt ?? new Date().toISOString(),
  };
}

function buildEpisodeEpisodicMemoryItems(params: {
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  story: StoryGenerateResult;
}): AiComicEpisodicMemoryItem[] {
  const items: AiComicEpisodicMemoryItem[] = [];
  for (const scene of params.story.scene_breakdown.slice(0, 18)) {
    const text = [
      scene.key_action,
      scene.dialogue_or_narration ?? '',
      scene.visual_prompt,
      scene.conflict ?? scene.dramatic_function,
    ].join('；');
    items.push(makeEpisodicMemoryItem({
      source: 'scene',
      episodeNo: params.episode.episode_no,
      sceneId: String(scene.scene_id),
      title: `第${params.episode.episode_no}集场景${scene.scene_id}`,
      text,
      characters: scene.characters ?? params.episode.key_characters,
      location: scene.location,
      emotionalTone: scene.conflict ?? scene.dramatic_function,
      recallNotes: [
        `场景功能：${scene.key_action}`,
        scene.dialogue_or_narration ? `对白/旁白：${summarizeText(scene.dialogue_or_narration, 56)}` : '',
      ],
    }));
  }

  for (const block of (params.story.dialogue ?? []).slice(0, 12)) {
    const text = block.lines.map(line => `${line.character}：${line.text}`).join(' / ');
    if (!text.trim()) continue;
    items.push(makeEpisodicMemoryItem({
      source: 'dialogue',
      episodeNo: params.episode.episode_no,
      sceneId: String(block.scene_id),
      title: `第${params.episode.episode_no}集对白${block.scene_id}`,
      text,
      characters: unique(block.lines.map(line => line.character).filter(Boolean)),
      emotionalTone: unique(block.lines.map(line => line.emotion).filter(Boolean)).join('、') || undefined,
      recallNotes: [`对白关系：${summarizeText(text, 72)}`],
    }));
  }

  for (const segment of params.story.gears_segments.slice(0, 16)) {
    const text = [
      segment.script_text,
      segment.purpose,
      ...segment.visual_focus,
      segment.segment_prompt_hint ?? '',
    ].join('；');
    items.push(makeEpisodicMemoryItem({
      source: 'gears_segment',
      episodeNo: params.episode.episode_no,
      sceneId: String(segment.source_scene_id),
      title: `第${params.episode.episode_no}集GEARS${segment.segment_id}`,
      text,
      characters: extractKnownCharacters(text, params.plan),
      emotionalTone: segment.purpose,
      recallNotes: [
        `分段目的：${segment.purpose}`,
        `视觉焦点：${segment.visual_focus.join('；') || '未记录'}`,
      ],
    }));
  }

  const seedancePackage = buildSeedancePromptPackage(params.story);
  for (const unit of seedancePackage.shot_units.slice(0, 16)) {
    const text = [
      unit.script_text,
      unit.visual_prompt,
      unit.camera_suggestion,
      unit.seedance_prompt,
      ...unit.continuity_notes,
    ].join('；');
    items.push(makeEpisodicMemoryItem({
      source: 'seedance_shot',
      episodeNo: params.episode.episode_no,
      sceneId: String(unit.source_scene_id),
      shotId: String(unit.shot_id),
      title: `第${params.episode.episode_no}集镜头${unit.shot_id}`,
      text,
      characters: extractKnownCharacters(text, params.plan),
      location: unit.location,
      emotionalTone: unit.camera_suggestion,
      recallNotes: [
        `运镜：${unit.camera_suggestion}`,
        unit.continuity_notes.length ? `连续性：${unit.continuity_notes.join('；')}` : '',
      ],
    }));
  }

  return mergeEpisodicMemoryItems(items).slice(0, 56);
}

function makeEpisodicMemoryItem(params: {
  source: AiComicEpisodicMemorySource;
  episodeNo: number;
  sceneId?: string;
  shotId?: string;
  title: string;
  text: string;
  characters: string[];
  location?: string;
  emotionalTone?: string;
  recallNotes: string[];
}): AiComicEpisodicMemoryItem {
  const keywords = buildEpisodicKeywords([
    params.title,
    params.text,
    ...params.characters,
    params.location ?? '',
    params.emotionalTone ?? '',
  ].join('；'));
  const stableKey = [
    params.source,
    params.episodeNo,
    params.sceneId,
    params.shotId,
    params.title,
  ].filter(Boolean).join(':');
  return {
    episodic_memory_id: `episodic-${slugifyConstraintKey(stableKey)}`,
    source: params.source,
    episode_no: params.episodeNo,
    scene_id: params.sceneId,
    shot_id: params.shotId,
    title: params.title,
    text: summarizeText(params.text, 180),
    characters: unique(params.characters).slice(0, 8),
    location: params.location,
    emotional_tone: params.emotionalTone,
    keywords,
    token_signature: keywords.slice(0, 18),
    recall_notes: params.recallNotes.filter(Boolean).map(note => summarizeText(note, 90)).slice(0, 4),
  };
}

function mergeEpisodicMemoryItems(items: AiComicEpisodicMemoryItem[]): AiComicEpisodicMemoryItem[] {
  const map = new Map<string, AiComicEpisodicMemoryItem>();
  for (const item of items) {
    const existing = map.get(item.episodic_memory_id);
    if (!existing) {
      map.set(item.episodic_memory_id, item);
      continue;
    }
    map.set(item.episodic_memory_id, {
      ...existing,
      text: item.text || existing.text,
      characters: unique([...existing.characters, ...item.characters]),
      keywords: unique([...existing.keywords, ...item.keywords]).slice(0, 24),
      token_signature: unique([...existing.token_signature, ...item.token_signature]).slice(0, 24),
      recall_notes: unique([...existing.recall_notes, ...item.recall_notes]).slice(0, 6),
    });
  }
  return [...map.values()];
}

function buildEpisodicKeywords(text: string): string[] {
  return significantTextTokens(text).filter(token => token.length >= 2).slice(0, 28);
}

function buildInitialProductionConstraints(plan: AiComicSeriesPlan): AiComicProductionConstraints {
  const continuityRuleItems = getPlanContinuityRules(plan).map(rule => makeProductionConstraintItem({
    category: 'continuity',
    label: rule.label,
    description: rule.description,
    source: 'series_plan',
    severity: 'must',
    status: 'active',
    notes: ['系列连续性规则，后续单集分镜和视频提示词必须遵守。'],
    stableKey: rule.rule_id,
  }));
  const productionNoteItems = getPlanProductionNotes(plan).map((note, index) => makeProductionConstraintItem({
    category: /史实|文化|知识|来源|边界/.test(note) ? 'cultural_boundary' : 'asset',
    label: summarizeText(note, 24),
    description: note,
    source: 'series_plan',
    severity: /必须|不得|禁止|边界/.test(note) ? 'must' : 'should',
    status: 'active',
    notes: ['系列生产备注，生成分镜和镜头提示词时作为制作约束。'],
    stableKey: `production-note-${index + 1}`,
  }));
  return {
    schema_version: 'ai-comic-production-constraints/v1',
    items: mergeProductionConstraintItems([...continuityRuleItems, ...productionNoteItems]),
    conflicts: [],
  };
}

function normalizeProductionConstraints(
  constraints: AiComicProductionConstraints | undefined,
  plan: AiComicSeriesPlan,
): AiComicProductionConstraints {
  const initial = buildInitialProductionConstraints(plan);
  if (!constraints) return initial;
  return {
    schema_version: 'ai-comic-production-constraints/v1',
    items: mergeProductionConstraintItems([
      ...initial.items,
      ...(constraints.items ?? []).map(cloneProductionConstraintItem),
    ]),
    conflicts: unique([...(constraints.conflicts ?? []), ...detectProductionConstraintConflicts(constraints.items ?? [])]),
  };
}

function updateProductionConstraints(params: {
  constraints: AiComicProductionConstraints;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  story?: StoryGenerateResult;
}): AiComicProductionConstraints {
  const base = normalizeProductionConstraints(params.constraints, params.plan);
  const episodeConstraints = buildEpisodeProductionConstraints({
    episodeNo: params.episode.episode_no,
    story: params.story,
  });
  const items = mergeProductionConstraintItems([
    ...base.items,
    ...episodeConstraints,
  ]);
  return {
    schema_version: 'ai-comic-production-constraints/v1',
    items,
    conflicts: unique([
      ...base.conflicts,
      ...detectProductionConstraintConflicts(items),
    ]),
  };
}

function buildEpisodeProductionConstraints(params: {
  episodeNo: number;
  story?: StoryGenerateResult;
}): AiComicProductionConstraintItem[] {
  if (!params.story) return [];
  const pkg = buildSeedancePromptPackage(params.story);
  return pkg.shot_units.slice(0, 40).flatMap(unit => {
    const items: AiComicProductionConstraintItem[] = [];
    const sourceNote = `来源场景${unit.source_scene_id}`;
    const sceneId = String(unit.source_scene_id);
    const shotId = String(unit.shot_id);
    if (unit.continuity_notes.length) {
      items.push(makeProductionConstraintItem({
        category: 'continuity',
        label: `Seedance镜头${unit.shot_id}连续性`,
        description: unit.continuity_notes.join('；'),
        source: 'seedance_shot',
        severity: 'must',
        status: 'active',
        episodeNo: params.episodeNo,
        sceneId,
        shotId,
        notes: [sourceNote, `运镜：${unit.camera_suggestion}`],
      }));
    }
    if (unit.negative_constraints.length) {
      items.push(makeProductionConstraintItem({
        category: 'negative',
        label: `Seedance镜头${unit.shot_id}禁用元素`,
        description: unit.negative_constraints.join('；'),
        source: 'seedance_shot',
        severity: 'must',
        status: 'active',
        episodeNo: params.episodeNo,
        sceneId,
        shotId,
        notes: [sourceNote, '进入视频模型前必须保留为负向约束。'],
      }));
    }
    if (unit.camera_suggestion.trim()) {
      items.push(makeProductionConstraintItem({
        category: 'camera',
        label: `Seedance镜头${unit.shot_id}运镜`,
        description: unit.camera_suggestion,
        source: 'seedance_shot',
        severity: hasContradictoryCameraCue(unit.camera_suggestion) ? 'watch' : 'should',
        status: hasContradictoryCameraCue(unit.camera_suggestion) ? 'needs_review' : 'active',
        episodeNo: params.episodeNo,
        sceneId,
        shotId,
        notes: [sourceNote, `提示词片段：${summarizeText(unit.seedance_prompt, 72)}`],
      }));
    }
    const assetAnchor = extractVisualAssetAnchor(unit.visual_prompt);
    if (assetAnchor) {
      items.push(makeProductionConstraintItem({
        category: 'asset',
        label: assetAnchor.label,
        description: assetAnchor.status,
        source: 'seedance_shot',
        severity: 'should',
        status: 'active',
        episodeNo: params.episodeNo,
        sceneId,
        shotId,
        notes: [sourceNote, `视觉提示：${summarizeText(unit.visual_prompt, 72)}`],
      }));
    }
    const culturalNotes = unit.continuity_notes.filter(note => /史实|来源|文化|创作|知识/.test(note));
    if (culturalNotes.length) {
      items.push(makeProductionConstraintItem({
        category: 'cultural_boundary',
        label: `Seedance镜头${unit.shot_id}文化边界`,
        description: culturalNotes.join('；'),
        source: 'seedance_shot',
        severity: 'must',
        status: 'active',
        episodeNo: params.episodeNo,
        sceneId,
        shotId,
        notes: ['镜头连续性说明不得改写为超出项目素材的确证史实。'],
      }));
    }
    return items;
  });
}

function makeProductionConstraintItem(params: {
  category: AiComicProductionConstraintCategory;
  label: string;
  description: string;
  source: AiComicProductionConstraintItem['source'];
  severity: AiComicProductionConstraintItem['severity'];
  status: AiComicProductionConstraintItem['status'];
  episodeNo?: number;
  sceneId?: string;
  shotId?: string;
  notes: string[];
  stableKey?: string;
}): AiComicProductionConstraintItem {
  const stableKey = params.stableKey
    ?? [
      params.source,
      params.category,
      params.episodeNo ?? 'series',
      params.sceneId,
      params.shotId,
      params.label,
    ].filter(Boolean).join('-');
  return {
    constraint_id: `constraint-${slugifyConstraintKey(stableKey)}`,
    category: params.category,
    label: params.label,
    description: params.description,
    source: params.source,
    severity: params.severity,
    status: params.status,
    episode_no: params.episodeNo,
    scene_id: params.sceneId,
    shot_id: params.shotId,
    notes: params.notes.filter(Boolean),
  };
}

function mergeProductionConstraintItems(items: AiComicProductionConstraintItem[]): AiComicProductionConstraintItem[] {
  const severityRank: Record<AiComicProductionConstraintItem['severity'], number> = {
    watch: 1,
    should: 2,
    must: 3,
  };
  const statusRank: Record<AiComicProductionConstraintItem['status'], number> = {
    resolved: 1,
    active: 2,
    needs_review: 3,
  };
  const map = new Map<string, AiComicProductionConstraintItem>();
  for (const item of items) {
    const existing = map.get(item.constraint_id);
    if (!existing) {
      map.set(item.constraint_id, cloneProductionConstraintItem(item));
      continue;
    }
    map.set(item.constraint_id, {
      ...existing,
      description: item.description || existing.description,
      severity: severityRank[item.severity] > severityRank[existing.severity] ? item.severity : existing.severity,
      status: statusRank[item.status] > statusRank[existing.status] ? item.status : existing.status,
      episode_no: item.episode_no ?? existing.episode_no,
      scene_id: item.scene_id ?? existing.scene_id,
      shot_id: item.shot_id ?? existing.shot_id,
      related_memory_ids: unique([
        ...(existing.related_memory_ids ?? []),
        ...(item.related_memory_ids ?? []),
      ]),
      notes: unique([...existing.notes, ...item.notes]).slice(-8),
    });
  }
  return [...map.values()].sort((a, b) =>
    (a.episode_no ?? 0) - (b.episode_no ?? 0)
    || a.category.localeCompare(b.category)
    || a.label.localeCompare(b.label)
  );
}

function detectProductionConstraintConflicts(items: AiComicProductionConstraintItem[]): string[] {
  return items
    .filter(item => item.category === 'camera' && item.status === 'needs_review')
    .map(item => `${item.label} 同时包含固定/静止与运动运镜语义，需要人工复核。`);
}

function hasContradictoryCameraCue(text: string): boolean {
  return /固定|静止|定机位/.test(text) && /推|拉|摇|移|跟随|环绕|俯冲/.test(text);
}

function cloneProductionConstraintItem(item: AiComicProductionConstraintItem): AiComicProductionConstraintItem {
  return {
    ...item,
    related_memory_ids: item.related_memory_ids ? [...item.related_memory_ids] : undefined,
    notes: [...item.notes],
  };
}

function cloneProductionConstraints(constraints: AiComicProductionConstraints): AiComicProductionConstraints {
  return {
    schema_version: 'ai-comic-production-constraints/v1',
    items: constraints.items.map(cloneProductionConstraintItem),
    conflicts: [...constraints.conflicts],
  };
}

function buildInitialSeriesMemory(plan: AiComicSeriesPlan): AiComicSeriesMemory {
  const planCharacters = getPlanMainCharacters(plan);
  const planEpisodes = getPlanEpisodes(plan);
  const characters = planCharacters.map(character => makeMemoryItem({
    category: 'character',
    label: character.name,
    status: character.starting_state,
    relatedEpisodeNos: uniqueNumbers([
      1,
      ...(character.turning_points ?? []).map(point => point.episode_no),
    ]),
    continuityNotes: [
      `定位：${character.role}`,
      `欲望：${character.desire}`,
      `长弧：${character.long_arc}`,
    ],
    visualAnchor: character.visual_signature,
    firstEpisodeNo: 1,
  }));

  const visualAssets = planCharacters.map(character => makeMemoryItem({
    category: 'visual_asset',
    label: `${character.name}视觉识别`,
    status: character.visual_signature,
    relatedEpisodeNos: uniqueNumbers([
      1,
      ...(character.turning_points ?? []).map(point => point.episode_no),
    ]),
    continuityNotes: [`角色视觉资产需跨集保持：${character.visual_signature}`],
    visualAnchor: character.visual_signature,
    firstEpisodeNo: 1,
  }));

  const locations = planEpisodes.map(episode => makeMemoryItem({
    category: 'location',
    label: (episode.knowledge_focus ?? [])[0] || episode.story_phase,
    status: episode.main_conflict,
    relatedEpisodeNos: [episode.episode_no],
    continuityNotes: [
      episode.opening_hook ?? '承接上一集',
      episode.midpoint_turn ?? episode.ending_hook,
    ],
    firstEpisodeNo: episode.episode_no,
  }));

  const knowledgeBoundaries = unique(planEpisodes.flatMap(episode => episode.knowledge_focus ?? []))
    .filter(label => label.trim().length > 0)
    .map(label => makeMemoryItem({
      category: 'knowledge_boundary',
      label,
      status: '计划素材焦点',
      relatedEpisodeNos: planEpisodes
        .filter(episode => (episode.knowledge_focus ?? []).includes(label))
        .map(episode => episode.episode_no),
      continuityNotes: ['项目素材作为文化、人物、地点或事件边界；未核实内容不得写成确证史实。'],
      knowledgeBoundary: '项目素材不是资料仓库，生成时只作为事实边界和创作约束。',
    }));

  const storyEvents = planEpisodes.map(episode => makeMemoryItem({
    category: 'story_event',
    label: `第${episode.episode_no}集：${episode.title}`,
    status: episode.main_conflict,
    relatedEpisodeNos: [episode.episode_no],
    continuityNotes: [
      `承接：${(episode.continuity_from_previous ?? []).join('；') || '无'}`,
      `后续状态：${(episode.continuity_state_after ?? []).join('；') || '待生成确认'}`,
    ],
    firstEpisodeNo: episode.episode_no,
  }));

  return {
    schema_version: 'ai-comic-series-memory/v1',
    characters,
    relationships: [],
    props: extractPropMemoryFromPlan(plan),
    locations: mergeMemoryItems(locations),
    visual_assets: visualAssets,
    knowledge_boundaries: knowledgeBoundaries,
    story_events: storyEvents,
    conflicts: [],
  };
}

function extractPropMemoryFromPlan(plan: AiComicSeriesPlan): AiComicSeriesMemoryItem[] {
  const planEpisodes = getPlanEpisodes(plan);
  const candidates = planEpisodes.flatMap(episode => [
    ...(episode.foreshadowing ?? []),
    ...(episode.payoff ?? []),
  ]);
  return candidates
    .filter(text => /信物|玉|剑|书|卷|图|灯|碑|印|符|钥|帛|器|物|道具/.test(text))
    .slice(0, 20)
    .map(text => makeMemoryItem({
      category: 'prop',
      label: summarizeText(text, 18),
      status: text,
      relatedEpisodeNos: planEpisodes
        .filter(episode => [...(episode.foreshadowing ?? []), ...(episode.payoff ?? [])].includes(text))
        .map(episode => episode.episode_no),
      continuityNotes: ['道具状态和归属在后续分镜中必须保持一致。'],
    }));
}

function makeMemoryItem(params: {
  category: AiComicSeriesMemoryCategory;
  label: string;
  status: string;
  relatedEpisodeNos: number[];
  continuityNotes: string[];
  firstEpisodeNo?: number;
  lastEpisodeNo?: number;
  visualAnchor?: string;
  knowledgeBoundary?: string;
}): AiComicSeriesMemoryItem {
  const episodeNos = uniqueNumbers(params.relatedEpisodeNos);
  return {
    memory_id: `${params.category}-${slugifyMemoryLabel(params.label)}-${episodeNos[0] ?? 'series'}`,
    category: params.category,
    label: params.label,
    status: params.status,
    first_episode_no: params.firstEpisodeNo ?? episodeNos[0],
    last_episode_no: params.lastEpisodeNo ?? episodeNos[episodeNos.length - 1],
    related_episode_nos: episodeNos,
    continuity_notes: params.continuityNotes.filter(Boolean),
    visual_anchor: params.visualAnchor,
    knowledge_boundary: params.knowledgeBoundary,
  };
}

function slugifyMemoryLabel(label: string): string {
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (ascii) return ascii.slice(0, 24);
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function slugifyConstraintKey(key: string): string {
  const ascii = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${ascii || 'item'}-${hash.toString(36)}`;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter(value => Number.isFinite(value)))].sort((a, b) => a - b);
}

function updateContinuityLedger(params: {
  ledger: AiComicContinuityLedger;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  story: StoryGenerateResult;
}): AiComicContinuityLedger {
  const storyKnowledgeEntries = [
    ...(params.story.knowledge_pack?.primary_entries ?? []).map(entry => entry.entry_name),
    ...(params.story.knowledge_pack?.supporting_entries ?? []).map(entry => entry.entry_name),
  ];
  return updateContinuityLedgerFromEpisodePlan({
    ledger: params.ledger,
    plan: params.plan,
    episode: params.episode,
    storyId: params.story.storyId,
    knowledgeUsed: storyKnowledgeEntries,
    story: params.story,
  });
}

function updateContinuityLedgerFromEpisodePlan(params: {
  ledger: AiComicContinuityLedger;
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  storyId: string;
  generatedAt?: string;
  knowledgeUsed?: string[];
  story?: StoryGenerateResult;
}): AiComicContinuityLedger {
  const openedThreads = params.plan.plot_threads
    .filter(thread => thread.setup_episode === params.episode.episode_no)
    .map(thread => `${thread.title}：${thread.description}`);
  const paidOffThreads = [
    ...params.plan.plot_threads
      .filter(thread => thread.payoff_episode === params.episode.episode_no)
      .map(thread => `${thread.title}：${thread.description}`),
    ...params.episode.payoff,
  ];
  const pendingThreadsAfter = unique([
    ...params.ledger.open_threads,
    ...openedThreads,
    ...params.episode.foreshadowing,
  ]).filter(thread => !paidOffThreads.some(paid => sameThread(thread, paid)));
  const knowledgeUsed = unique([
    ...params.ledger.knowledge_used,
    ...params.episode.knowledge_focus,
    ...(params.knowledgeUsed ?? []),
  ]);
  const memoryEvents = buildEpisodeMemoryEvents({
    plan: params.plan,
    episode: params.episode,
    knowledgeUsed: params.knowledgeUsed ?? [],
    story: params.story,
  });
  const seriesMemory = updateSeriesMemory({
    memory: params.ledger.series_memory ?? buildInitialSeriesMemory(params.plan),
    episode: params.episode,
    knowledgeUsed: params.knowledgeUsed ?? [],
    memoryEvents,
  });
  const productionConstraints = updateProductionConstraints({
    constraints: params.ledger.production_constraints ?? buildInitialProductionConstraints(params.plan),
    plan: params.plan,
    episode: params.episode,
    story: params.story,
  });
  const episodicMemory = updateEpisodicMemoryIndex({
    index: params.ledger.episodic_memory ?? buildInitialEpisodicMemoryIndex(),
    plan: params.plan,
    episode: params.episode,
    story: params.story,
    generatedAt: params.generatedAt,
  });
  const record: AiComicContinuityLedgerEpisode = {
    episode_no: params.episode.episode_no,
    story_id: params.storyId,
    title: params.episode.title,
    generated_at: params.generatedAt ?? new Date().toISOString(),
    character_state: params.episode.continuity_state_after,
    opened_threads: openedThreads,
    paid_off_threads: paidOffThreads,
    pending_threads_after: pendingThreadsAfter,
    knowledge_used: params.episode.knowledge_focus,
    ending_hook: params.episode.ending_hook,
    next_episode_memory: [
      `第${params.episode.episode_no}集结尾：${params.episode.ending_hook}`,
      ...params.episode.continuity_state_after,
      ...pendingThreadsAfter.slice(0, 4).map(thread => `未回收：${thread}`),
      ...memoryEvents.slice(0, 4).map(item => `记忆：${item.label}=${item.status}`),
    ],
    memory_events: memoryEvents,
  };
  const records = [
    ...params.ledger.episode_records.filter(item => item.episode_no !== params.episode.episode_no),
    record,
  ].sort((a, b) => a.episode_no - b.episode_no);

  return {
    schema_version: 'ai-comic-continuity-ledger/v1',
    last_generated_episode_no: Math.max(
      params.episode.episode_no,
      params.ledger.last_generated_episode_no ?? 0,
    ),
    character_state_current: params.episode.continuity_state_after,
    open_threads: pendingThreadsAfter,
    paid_off_threads: unique([...params.ledger.paid_off_threads, ...paidOffThreads]),
    knowledge_used: knowledgeUsed,
    episode_records: records,
    series_memory: seriesMemory,
    production_constraints: productionConstraints,
    episodic_memory: episodicMemory,
  };
}

function buildEpisodeMemoryEvents(params: {
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  knowledgeUsed: string[];
  story?: StoryGenerateResult;
}): AiComicSeriesMemoryItem[] {
  const characterEvents = params.plan.main_characters
    .filter(character =>
      params.episode.key_characters.includes(character.name)
      || params.episode.continuity_state_after.some(state => state.includes(character.name))
    )
    .map(character => {
      const state = params.episode.continuity_state_after.find(item => item.includes(character.name))
        ?? params.episode.character_state_change
        ?? `${character.name}参与第${params.episode.episode_no}集冲突`;
      return makeMemoryItem({
        category: 'character',
        label: character.name,
        status: state,
        relatedEpisodeNos: [params.episode.episode_no],
        continuityNotes: [
          params.episode.main_conflict,
          params.episode.thread_action ?? '',
        ],
        visualAnchor: character.visual_signature,
        firstEpisodeNo: params.episode.episode_no,
        lastEpisodeNo: params.episode.episode_no,
      });
    });

  const locationEvent = makeMemoryItem({
    category: 'location',
    label: params.episode.knowledge_focus[0] || params.episode.story_phase,
    status: params.episode.main_conflict,
    relatedEpisodeNos: [params.episode.episode_no],
    continuityNotes: [
      params.episode.opening_hook ?? '',
      params.episode.midpoint_turn ?? '',
      params.episode.ending_hook,
    ],
    firstEpisodeNo: params.episode.episode_no,
    lastEpisodeNo: params.episode.episode_no,
  });

  const propEvents = extractPropMemoryFromPlan({
    ...params.plan,
    episodes: [params.episode],
  });

  const knowledgeEvents = unique([
    ...params.episode.knowledge_focus,
    ...params.knowledgeUsed,
  ]).map(label => makeMemoryItem({
    category: 'knowledge_boundary',
    label,
    status: '已进入生成账本',
    relatedEpisodeNos: [params.episode.episode_no],
    continuityNotes: ['后续使用同一知识点时需保持事实边界和可信度口径一致。'],
    knowledgeBoundary: '不可把戏剧化补足写成已核实史实。',
    firstEpisodeNo: params.episode.episode_no,
    lastEpisodeNo: params.episode.episode_no,
  }));

  const storyEvent = makeMemoryItem({
    category: 'story_event',
    label: `第${params.episode.episode_no}集：${params.episode.title}`,
    status: params.episode.ending_hook,
    relatedEpisodeNos: [params.episode.episode_no],
    continuityNotes: [
      `主冲突：${params.episode.main_conflict}`,
      `中段转折：${params.episode.midpoint_turn ?? '未记录'}`,
      `后续状态：${params.episode.continuity_state_after.join('；') || '待补'}`,
    ],
    firstEpisodeNo: params.episode.episode_no,
    lastEpisodeNo: params.episode.episode_no,
  });

  return mergeMemoryItems([
    ...characterEvents,
    locationEvent,
    ...propEvents,
    ...knowledgeEvents,
    storyEvent,
    ...buildStoryDraftMemoryEvents(params),
  ]);
}

function buildStoryDraftMemoryEvents(params: {
  plan: AiComicSeriesPlan;
  episode: AiComicEpisodePlan;
  knowledgeUsed: string[];
  story?: StoryGenerateResult;
}): AiComicSeriesMemoryItem[] {
  const story = params.story;
  if (!story) return [];

  const sceneEvents = story.scene_breakdown.slice(0, 12).flatMap(scene => {
    const events: AiComicSeriesMemoryItem[] = [];
    if (scene.location.trim()) {
      events.push(makeMemoryItem({
        category: 'location',
        label: scene.location.trim(),
        status: scene.plot || scene.key_action || scene.dramatic_function,
        relatedEpisodeNos: [params.episode.episode_no],
        continuityNotes: [
          `成稿场景${scene.scene_id}：${scene.title}`,
          scene.time_of_day ? `时间：${scene.time_of_day}` : '',
          scene.cultural_note ? `文化提示：${scene.cultural_note}` : '',
        ],
        firstEpisodeNo: params.episode.episode_no,
        lastEpisodeNo: params.episode.episode_no,
      }));
    }

    for (const characterName of scene.characters.slice(0, 8)) {
      const character = params.plan.main_characters.find(item => item.name === characterName);
      events.push(makeMemoryItem({
        category: 'character',
        label: characterName,
        status: scene.conflict || scene.key_action || `${characterName}出现在成稿场景${scene.scene_id}`,
        relatedEpisodeNos: [params.episode.episode_no],
        continuityNotes: [
          `成稿场景${scene.scene_id}：${scene.title}`,
          scene.dialogue_or_narration ? `对白/旁白：${summarizeText(scene.dialogue_or_narration, 34)}` : '',
        ],
        visualAnchor: character?.visual_signature,
        firstEpisodeNo: params.episode.episode_no,
        lastEpisodeNo: params.episode.episode_no,
      }));
    }

    const visualAnchor = extractVisualAssetAnchor(scene.visual_prompt);
    if (visualAnchor) {
      events.push(makeMemoryItem({
        category: 'visual_asset',
        label: visualAnchor.label,
        status: visualAnchor.status,
        relatedEpisodeNos: [params.episode.episode_no],
        continuityNotes: [
          `成稿场景${scene.scene_id}视觉提示：${summarizeText(scene.visual_prompt, 48)}`,
        ],
        visualAnchor: visualAnchor.status,
        firstEpisodeNo: params.episode.episode_no,
        lastEpisodeNo: params.episode.episode_no,
      }));
    }

    const propAnchor = extractPropAnchor([
      scene.plot,
      scene.key_action,
      scene.visual_prompt,
      scene.dialogue_or_narration ?? '',
    ].join('；'));
    if (propAnchor) {
      events.push(makeMemoryItem({
        category: 'prop',
        label: propAnchor,
        status: `成稿场景${scene.scene_id}出现：${propAnchor}`,
        relatedEpisodeNos: [params.episode.episode_no],
        continuityNotes: [
          scene.key_action,
          '道具状态和归属需在后续分镜中保持一致。',
        ],
        firstEpisodeNo: params.episode.episode_no,
        lastEpisodeNo: params.episode.episode_no,
      }));
    }

    for (const sourceEntry of scene.source_entries ?? []) {
      events.push(makeMemoryItem({
        category: 'knowledge_boundary',
        label: sourceEntry,
        status: '成稿场景引用知识来源',
        relatedEpisodeNos: [params.episode.episode_no],
        continuityNotes: [
          scene.factual_basis ? `事实依据：${scene.factual_basis}` : '',
          scene.fictionalized_elements?.length
            ? `戏剧化补足：${scene.fictionalized_elements.join('；')}`
            : '',
        ],
        knowledgeBoundary: 'source_entries 和 factual_basis 作为事实边界；fictionalized_elements 不得写成确证史实。',
        firstEpisodeNo: params.episode.episode_no,
        lastEpisodeNo: params.episode.episode_no,
      }));
    }

    return events;
  });

  const dialogueRelationshipEvents = extractDialogueRelationshipEvents({
    episodeNo: params.episode.episode_no,
    story,
  });

  const knowledgePackEvents = [
    ...(story.knowledge_pack?.primary_entries ?? []),
    ...(story.knowledge_pack?.supporting_entries ?? []),
  ].map(entry => makeMemoryItem({
    category: 'knowledge_boundary',
    label: entry.entry_name,
    status: entry.role_in_story || '成稿知识包条目',
    relatedEpisodeNos: [params.episode.episode_no],
    continuityNotes: [
      `地区：${entry.province}${entry.region ? `/${entry.region}` : ''}`,
      `类型：${entry.type}`,
      entry.match_reason,
    ],
    knowledgeBoundary: entry.summary,
    firstEpisodeNo: params.episode.episode_no,
    lastEpisodeNo: params.episode.episode_no,
  }));

  return mergeMemoryItems([
    ...sceneEvents,
    ...dialogueRelationshipEvents,
    ...knowledgePackEvents,
    ...buildGearsSegmentMemoryEvents({
      episodeNo: params.episode.episode_no,
      story,
    }),
    ...buildSeedanceShotMemoryEvents({
      episodeNo: params.episode.episode_no,
      story,
    }),
  ]);
}

function buildSeedanceShotMemoryEvents(params: {
  episodeNo: number;
  story: StoryGenerateResult;
}): AiComicSeriesMemoryItem[] {
  const pkg = buildSeedancePromptPackage(params.story);
  return pkg.shot_units.slice(0, 30).flatMap(unit => {
    const events: AiComicSeriesMemoryItem[] = [];
    if (unit.location.trim()) {
      events.push(makeMemoryItem({
        category: 'location',
        label: unit.location,
        status: `Seedance镜头${unit.shot_id}场景`,
        relatedEpisodeNos: [params.episodeNo],
        continuityNotes: [
          `来源场景${unit.source_scene_id}`,
          `镜头：${unit.camera_suggestion}`,
          unit.negative_constraints.length ? `禁用元素：${unit.negative_constraints.join('；')}` : '',
        ],
        firstEpisodeNo: params.episodeNo,
        lastEpisodeNo: params.episodeNo,
      }));
    }

    const visualAnchor = extractVisualAssetAnchor(unit.visual_prompt);
    if (visualAnchor) {
      events.push(makeMemoryItem({
        category: 'visual_asset',
        label: visualAnchor.label,
        status: visualAnchor.status,
        relatedEpisodeNos: [params.episodeNo],
        continuityNotes: [
          `Seedance镜头${unit.shot_id}视觉提示：${summarizeText(unit.visual_prompt, 56)}`,
          `运镜：${unit.camera_suggestion}`,
        ],
        visualAnchor: visualAnchor.status,
        firstEpisodeNo: params.episodeNo,
        lastEpisodeNo: params.episodeNo,
      }));
    }

    const propAnchor = extractPropAnchor([unit.script_text, unit.visual_prompt, unit.seedance_prompt].join('；'));
    if (propAnchor) {
      events.push(makeMemoryItem({
        category: 'prop',
        label: propAnchor,
        status: `Seedance镜头${unit.shot_id}出现：${propAnchor}`,
        relatedEpisodeNos: [params.episodeNo],
        continuityNotes: [
          `来源场景${unit.source_scene_id}`,
          `脚本：${summarizeText(unit.script_text, 48)}`,
          unit.negative_constraints.length ? `禁用元素：${unit.negative_constraints.join('；')}` : '',
        ],
        firstEpisodeNo: params.episodeNo,
        lastEpisodeNo: params.episodeNo,
      }));
    }

    if (unit.continuity_notes.length || unit.negative_constraints.length) {
      events.push(makeMemoryItem({
        category: 'story_event',
        label: `Seedance镜头${unit.shot_id}`,
        status: unit.camera_suggestion,
        relatedEpisodeNos: [params.episodeNo],
        continuityNotes: [
          `连续性：${unit.continuity_notes.join('；') || '无'}`,
          `禁用元素：${unit.negative_constraints.join('；') || '无'}`,
        ],
        firstEpisodeNo: params.episodeNo,
        lastEpisodeNo: params.episodeNo,
      }));
    }

    for (const note of unit.continuity_notes) {
      if (!/史实|来源|文化|创作/.test(note)) continue;
      events.push(makeMemoryItem({
        category: 'knowledge_boundary',
        label: summarizeText(note, 20),
        status: `Seedance镜头${unit.shot_id}连续性边界`,
        relatedEpisodeNos: [params.episodeNo],
        continuityNotes: [note],
        knowledgeBoundary: 'Seedance 镜头提示词中的连续性说明不得改写为超出项目素材的确证史实。',
        firstEpisodeNo: params.episodeNo,
        lastEpisodeNo: params.episodeNo,
      }));
    }

    return events;
  });
}

function buildGearsSegmentMemoryEvents(params: {
  episodeNo: number;
  story: StoryGenerateResult;
}): AiComicSeriesMemoryItem[] {
  return params.story.gears_segments.slice(0, 24).flatMap(segment => {
    const events: AiComicSeriesMemoryItem[] = [];
    const visualText = [
      ...segment.visual_focus,
      segment.segment_prompt_hint ?? '',
    ].join('；');
    const propAnchor = extractPropAnchor([segment.script_text, visualText].join('；'));
    if (propAnchor) {
      events.push(makeMemoryItem({
        category: 'prop',
        label: propAnchor,
        status: `GEARS分段${segment.segment_id}出现：${propAnchor}`,
        relatedEpisodeNos: [params.episodeNo],
        continuityNotes: [
          `来源场景${segment.source_scene_id}`,
          summarizeText(segment.script_text, 48),
        ],
        firstEpisodeNo: params.episodeNo,
        lastEpisodeNo: params.episodeNo,
      }));
    }

    const visualAnchor = extractVisualAssetAnchor(visualText);
    if (visualAnchor) {
      events.push(makeMemoryItem({
        category: 'visual_asset',
        label: visualAnchor.label,
        status: visualAnchor.status,
        relatedEpisodeNos: [params.episodeNo],
        continuityNotes: [
          `GEARS分段${segment.segment_id}视觉焦点：${summarizeText(visualText, 56)}`,
          `镜头用途：${segment.purpose}`,
        ],
        visualAnchor: visualAnchor.status,
        firstEpisodeNo: params.episodeNo,
        lastEpisodeNo: params.episodeNo,
      }));
    }

    if (segment.source_entries?.length) {
      for (const sourceEntry of segment.source_entries) {
        events.push(makeMemoryItem({
          category: 'knowledge_boundary',
          label: sourceEntry,
          status: 'GEARS分段引用知识来源',
          relatedEpisodeNos: [params.episodeNo],
          continuityNotes: [
            `GEARS分段${segment.segment_id}`,
            `文化约束：${segment.cultural_constraints.join('；') || '未记录'}`,
          ],
          knowledgeBoundary: 'GEARS 分段来源条目作为镜头级事实和文化边界。',
          firstEpisodeNo: params.episodeNo,
          lastEpisodeNo: params.episodeNo,
        }));
      }
    }

    if (segment.segment_prompt_hint || segment.visual_focus.length > 0) {
      events.push(makeMemoryItem({
        category: 'story_event',
        label: `GEARS分段${segment.segment_id}`,
        status: segment.purpose,
        relatedEpisodeNos: [params.episodeNo],
        continuityNotes: [
          `来源场景${segment.source_scene_id}`,
          `画面焦点：${segment.visual_focus.join('；') || '未记录'}`,
          segment.segment_prompt_hint ? `提示词：${summarizeText(segment.segment_prompt_hint, 56)}` : '',
        ],
        firstEpisodeNo: params.episodeNo,
        lastEpisodeNo: params.episodeNo,
      }));
    }

    return events;
  });
}

function updateSeriesMemory(params: {
  memory: AiComicSeriesMemory;
  episode: AiComicEpisodePlan;
  knowledgeUsed: string[];
  memoryEvents: AiComicSeriesMemoryItem[];
}): AiComicSeriesMemory {
  const merged: AiComicSeriesMemory = {
    schema_version: 'ai-comic-series-memory/v1',
    characters: params.memory.characters,
    relationships: params.memory.relationships,
    props: params.memory.props,
    locations: params.memory.locations,
    visual_assets: params.memory.visual_assets,
    knowledge_boundaries: params.memory.knowledge_boundaries,
    story_events: params.memory.story_events,
    conflicts: [...params.memory.conflicts],
  };

  for (const event of params.memoryEvents) {
    const bucket = memoryBucket(merged, event.category);
    const existingIndex = bucket.findIndex(item => item.label === event.label);
    if (existingIndex >= 0) {
      bucket[existingIndex] = mergeMemoryItem(bucket[existingIndex], event);
    } else {
      bucket.push(event);
    }
  }

  merged.conflicts = unique([
    ...merged.conflicts,
    ...detectSeriesMemoryConflicts(merged, params.episode, params.memoryEvents),
  ]);

  return {
    ...merged,
    characters: mergeMemoryItems(merged.characters),
    relationships: mergeMemoryItems(merged.relationships),
    props: mergeMemoryItems(merged.props),
    locations: mergeMemoryItems(merged.locations),
    visual_assets: mergeMemoryItems(merged.visual_assets),
    knowledge_boundaries: mergeMemoryItems(merged.knowledge_boundaries),
    story_events: mergeMemoryItems(merged.story_events).slice(-120),
  };
}

function extractVisualAssetAnchor(visualPrompt: string): { label: string; status: string } | null {
  const normalized = visualPrompt.trim();
  if (!normalized) return null;
  const patterns = [
    /(?:身穿|穿着|披着|戴着|手持|腰挂|背着|发髻|发型|服饰|衣袍|长衫|斗笠|玉佩|佩剑|书箱|竹简)[^，。；,.]{0,24}/,
    /(?:固定陈设|牌匾|门楼|祠堂|书院|桥|渡口|老宅|庭院|案桌|灯笼)[^，。；,.]{0,24}/,
  ];
  const match = patterns.map(pattern => normalized.match(pattern)?.[0]).find(Boolean);
  if (!match) return null;
  return {
    label: summarizeText(match, 18),
    status: match,
  };
}

function extractPropAnchor(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const match = normalized.match(/(?:信物|玉佩|玉扣|佩剑|剑|书卷|竹简|卷宗|图卷|灯笼|石碑|印章|符牌|钥匙|帛书|器物|道具)[^，。；,.]{0,18}/);
  return match?.[0] ? summarizeText(match[0], 18) : null;
}

function extractDialogueRelationshipEvents(params: {
  episodeNo: number;
  story: StoryGenerateResult;
}): AiComicSeriesMemoryItem[] {
  const events: AiComicSeriesMemoryItem[] = [];
  for (const block of params.story.dialogue ?? []) {
    const speakers = unique(block.lines.map(line => line.character).filter(Boolean));
    if (speakers.length < 2) continue;
    const emotionText = unique(block.lines.map(line => line.emotion).filter(Boolean)).join('、');
    const text = block.lines.map(line => `${line.character}：${line.text}`).join(' / ');
    events.push(makeMemoryItem({
      category: 'relationship',
      label: speakers.slice(0, 3).join(' / '),
      status: emotionText || summarizeText(text, 28),
      relatedEpisodeNos: [params.episodeNo],
      continuityNotes: [
        `成稿对白场景${block.scene_id}：${summarizeText(text, 60)}`,
      ],
      firstEpisodeNo: params.episodeNo,
      lastEpisodeNo: params.episodeNo,
    }));
  }
  return events;
}

function memoryBucket(
  memory: AiComicSeriesMemory,
  category: AiComicSeriesMemoryCategory,
): AiComicSeriesMemoryItem[] {
  switch (category) {
    case 'character':
      return memory.characters;
    case 'relationship':
      return memory.relationships;
    case 'prop':
      return memory.props;
    case 'location':
      return memory.locations;
    case 'visual_asset':
      return memory.visual_assets;
    case 'knowledge_boundary':
      return memory.knowledge_boundaries;
    case 'story_event':
      return memory.story_events;
  }
}

function mergeMemoryItems(items: AiComicSeriesMemoryItem[]): AiComicSeriesMemoryItem[] {
  const map = new Map<string, AiComicSeriesMemoryItem>();
  for (const item of items) {
    const key = `${item.category}:${item.label}`;
    const existing = map.get(key);
    map.set(key, existing ? mergeMemoryItem(existing, item) : item);
  }
  return [...map.values()].sort((a, b) =>
    (a.first_episode_no ?? 999) - (b.first_episode_no ?? 999)
    || a.label.localeCompare(b.label, 'zh-Hans-CN')
  );
}

function mergeMemoryItem(
  current: AiComicSeriesMemoryItem,
  next: AiComicSeriesMemoryItem,
): AiComicSeriesMemoryItem {
  const relatedEpisodeNos = uniqueNumbers([
    ...current.related_episode_nos,
    ...next.related_episode_nos,
  ]);
  return {
    ...current,
    status: next.status || current.status,
    first_episode_no: Math.min(
      current.first_episode_no ?? relatedEpisodeNos[0] ?? 1,
      next.first_episode_no ?? relatedEpisodeNos[0] ?? 1,
    ),
    last_episode_no: Math.max(
      current.last_episode_no ?? relatedEpisodeNos[relatedEpisodeNos.length - 1] ?? 1,
      next.last_episode_no ?? relatedEpisodeNos[relatedEpisodeNos.length - 1] ?? 1,
    ),
    related_episode_nos: relatedEpisodeNos,
    continuity_notes: unique([
      ...current.continuity_notes,
      ...next.continuity_notes,
    ]).slice(-8),
    visual_anchor: next.visual_anchor ?? current.visual_anchor,
    knowledge_boundary: next.knowledge_boundary ?? current.knowledge_boundary,
  };
}

function cloneMemoryItem(item: AiComicSeriesMemoryItem): AiComicSeriesMemoryItem {
  return {
    ...item,
    related_episode_nos: [...item.related_episode_nos],
    continuity_notes: [...item.continuity_notes],
  };
}

function cloneSeriesMemory(memory: AiComicSeriesMemory): AiComicSeriesMemory {
  return {
    schema_version: 'ai-comic-series-memory/v1',
    characters: memory.characters.map(cloneMemoryItem),
    relationships: memory.relationships.map(cloneMemoryItem),
    props: memory.props.map(cloneMemoryItem),
    locations: memory.locations.map(cloneMemoryItem),
    visual_assets: memory.visual_assets.map(cloneMemoryItem),
    knowledge_boundaries: memory.knowledge_boundaries.map(cloneMemoryItem),
    story_events: memory.story_events.map(cloneMemoryItem),
    conflicts: [...memory.conflicts],
  };
}

function buildSeriesMemorySummary(memory?: AiComicSeriesMemory): {
  characters: string[];
  relationships: string[];
  props: string[];
  locations: string[];
  visual_assets: string[];
  knowledge_boundaries: string[];
  story_events: string[];
  conflicts: string[];
} | undefined {
  if (!memory) return undefined;
  return {
    characters: summarizeMemoryItems(memory.characters, 8),
    relationships: summarizeMemoryItems(memory.relationships, 6),
    props: summarizeMemoryItems(memory.props, 6),
    locations: summarizeMemoryItems(memory.locations, 8),
    visual_assets: summarizeMemoryItems(memory.visual_assets, 6),
    knowledge_boundaries: summarizeMemoryItems(memory.knowledge_boundaries, 8),
    story_events: summarizeMemoryItems(memory.story_events.slice(-8), 8),
    conflicts: memory.conflicts.slice(-8),
  };
}

function buildProductionConstraintSummary(constraints?: AiComicProductionConstraints): {
  active_count: number;
  must_count: number;
  needs_review_count: number;
  recent: string[];
  conflicts: string[];
} | undefined {
  if (!constraints) return undefined;
  const activeItems = constraints.items.filter(item => item.status !== 'resolved');
  return {
    active_count: activeItems.length,
    must_count: activeItems.filter(item => item.severity === 'must').length,
    needs_review_count: activeItems.filter(item => item.status === 'needs_review').length,
    recent: activeItems.slice(-8).map(item => [
      item.episode_no ? `第${item.episode_no}集` : '全系列',
      productionConstraintCategoryLabel(item.category),
      item.label,
    ].join(' · ')),
    conflicts: constraints.conflicts.slice(-8),
  };
}

function buildMemoryConflictSummary(report: AiComicMemoryConflictReport): {
  total_conflict_count: number;
  blocking_count: number;
  warning_count: number;
  watch_count: number;
  recent: string[];
} {
  return {
    total_conflict_count: report.total_conflict_count,
    blocking_count: report.blocking_count,
    warning_count: report.warning_count,
    watch_count: report.watch_count,
    recent: report.items.slice(0, 6).map(item => [
      memoryConflictCategoryLabel(item.category),
      memoryConflictSeverityLabel(item.severity),
      item.title,
    ].join(' · ')),
  };
}

function buildEpisodicMemorySummary(index?: AiComicEpisodicMemoryIndex): {
  total_count: number;
  recent: string[];
} | undefined {
  if (!index) return undefined;
  return {
    total_count: index.items.length,
    recent: index.items.slice(-8).map(item => [
      `第${item.episode_no}集`,
      episodicMemorySourceLabel(item.source),
      item.title,
    ].join(' · ')),
  };
}

function summarizeMemoryItems(items: AiComicSeriesMemoryItem[], limit: number): string[] {
  return items.slice(0, limit).map(item => {
    const episodeText = item.related_episode_nos.length > 0
      ? `第${item.related_episode_nos.join('、')}集`
      : '全系列';
    return `${item.label}（${episodeText}）：${item.status}`;
  });
}

function buildSeriesMemoryPromptLines(
  memory?: AiComicSeriesMemory,
  plan?: AiComicSeriesPlan,
  episode?: AiComicEpisodePlan,
  controls?: AiComicSeriesMemoryRecallControls,
): string[] {
  const recall = plan && episode ? buildEpisodeMemoryRecall(plan, episode, memory, controls) : undefined;
  if (recall && recall.items.length > 0) {
    const grouped = groupRecallItemsByCategory(recall.items);
    return [
      '系列记忆精准召回：以下为本集相关的跨集结构化记忆，优先用于保持角色、关系、道具、地点、视觉资产和知识边界连续。',
      ...(['character', 'relationship', 'prop', 'location', 'visual_asset', 'knowledge_boundary', 'story_event'] as AiComicSeriesMemoryCategory[])
        .map(category => {
          const items = grouped.get(category) ?? [];
          if (items.length === 0) return '';
          return `召回-${memoryCategoryLabel(category)}：${items.map(item =>
            `${item.label}(${item.score}分，${item.reasons.join('、')})=${item.status}`
          ).join('；')}`;
        }),
      recall.conflicts.length > 0 ? `召回-待核冲突：${recall.conflicts.join('；')}` : '',
    ].filter(Boolean);
  }

  const summary = buildSeriesMemorySummary(memory);
  if (!summary) return [];
  return [
    '系列记忆引擎：以下为跨集结构化记忆，优先用于保持角色、关系、道具、地点、视觉资产和知识边界连续。',
    `记忆-角色：${summary.characters.join('；') || '暂无'}`,
    `记忆-关系：${summary.relationships.join('；') || '暂无'}`,
    `记忆-道具：${summary.props.join('；') || '暂无'}`,
    `记忆-地点：${summary.locations.join('；') || '暂无'}`,
    `记忆-视觉资产：${summary.visual_assets.join('；') || '暂无'}`,
    `记忆-知识边界：${summary.knowledge_boundaries.join('；') || '暂无'}`,
    `记忆-关键事件：${summary.story_events.join('；') || '暂无'}`,
    summary.conflicts.length > 0
      ? `记忆-待核冲突：${summary.conflicts.join('；')}`
      : '',
  ].filter(Boolean);
}

function buildEpisodicMemoryPromptLines(
  index: AiComicEpisodicMemoryIndex | undefined,
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
): string[] {
  const recall = buildEpisodeEpisodicMemoryRecall(plan, episode, index);
  if (!recall || recall.items.length === 0) return [];
  return [
    '长期情景记忆模糊召回：以下片段来自已生成场景/对白/镜头，用于延续情绪回声、对白呼应、场景氛围和人物选择，不得机械复述。',
    ...recall.items.map(item => [
      `情景-${episodicMemorySourceLabel(item.source)}`,
      `第${item.episode_no}集`,
      `${item.score}分`,
      item.title,
      item.text,
      item.reasons.join('、'),
    ].join('：')),
  ];
}

function buildEpisodeEpisodicMemoryRecall(
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
  index?: AiComicEpisodicMemoryIndex,
): AiComicEpisodicMemoryRecall | undefined {
  if (!index || index.items.length === 0) return undefined;
  const context = buildEpisodeRecallContext(plan, episode);
  const contextTokens = new Set(significantTextTokens(context.episodeTexts.join('；')));
  const activeThreadTokens = new Set(significantTextTokens(context.activeThreadTexts.join('；')));
  const items = index.items
    .filter(item => item.episode_no < episode.episode_no)
    .map(item => scoreEpisodicMemoryItem(item, context, contextTokens, activeThreadTokens))
    .filter((item): item is AiComicEpisodicMemoryRecallItem => Boolean(item))
    .sort((a, b) => b.score - a.score || b.episode_no - a.episode_no)
    .slice(0, 8);
  return {
    schema_version: 'ai-comic-episodic-memory-recall/v1',
    episode_no: episode.episode_no,
    items,
  };
}

function scoreEpisodicMemoryItem(
  item: AiComicEpisodicMemoryItem,
  context: ReturnType<typeof buildEpisodeRecallContext>,
  contextTokens: Set<string>,
  activeThreadTokens: Set<string>,
): AiComicEpisodicMemoryRecallItem | null {
  const reasons: string[] = [];
  let score = 0;
  if (item.episode_no === context.episodeNo - 1) {
    score += 28;
    reasons.push('上一集情绪承接');
  } else if (context.episodeNo - item.episode_no <= 3) {
    score += 12;
    reasons.push('近期场景回声');
  }
  const characterMatches = item.characters.filter(character => context.keyCharacters.includes(character));
  if (characterMatches.length > 0) {
    score += 24;
    reasons.push(`角色呼应：${characterMatches.join('、')}`);
  }
  const keywordOverlap = item.token_signature.filter(token => contextTokens.has(token));
  if (keywordOverlap.length > 0) {
    score += Math.min(24, keywordOverlap.length * 4);
    reasons.push(`语义重叠：${keywordOverlap.slice(0, 3).join('、')}`);
  }
  const threadOverlap = item.token_signature.filter(token => activeThreadTokens.has(token));
  if (threadOverlap.length > 0) {
    score += Math.min(18, threadOverlap.length * 3);
    reasons.push('长期线索相关');
  }
  if (item.location && context.episodeTexts.some(text => textOverlaps(item.location ?? '', text))) {
    score += 12;
    reasons.push('地点氛围呼应');
  }
  if (score < 24) return null;
  return {
    episodic_memory_id: item.episodic_memory_id,
    source: item.source,
    episode_no: item.episode_no,
    title: item.title,
    text: item.text,
    score: Math.min(score, 100),
    reasons: unique(reasons).slice(0, 4),
    characters: item.characters,
    location: item.location,
    emotional_tone: item.emotional_tone,
    keywords: item.keywords.slice(0, 8),
  };
}

function episodicMemorySourceLabel(source: AiComicEpisodicMemorySource): string {
  const map: Record<AiComicEpisodicMemorySource, string> = {
    scene: '场景',
    dialogue: '对白',
    gears_segment: 'GEARS',
    seedance_shot: 'Seedance镜头',
  };
  return map[source];
}

function extractKnownCharacters(text: string, plan: AiComicSeriesPlan): string[] {
  return plan.main_characters
    .map(character => character.name)
    .filter(name => text.includes(name));
}

function buildEpisodeMemoryRecall(
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
  memory?: AiComicSeriesMemory,
  controls: AiComicSeriesMemoryRecallControls = {},
): AiComicSeriesMemoryRecall | undefined {
  if (!memory) return undefined;
  const context = buildEpisodeRecallContext(plan, episode);
  const allItems = allSeriesMemoryItems(memory);
  const lockedIds = new Set(controls.locked_memory_ids ?? []);
  const excludedIds = new Set(controls.excluded_memory_ids ?? []);
  const scoredItems = allItems
    .map(item => scoreMemoryItemForEpisode(item, context))
    .filter((item): item is AiComicSeriesMemoryRecallItem => Boolean(item))
    .filter(item => !excludedIds.has(item.memory_id) || lockedIds.has(item.memory_id))
    .map(item => lockedIds.has(item.memory_id)
      ? {
          ...item,
          score: Math.max(item.score, 100),
          reasons: unique(['人工锁定', ...item.reasons]).slice(0, 4),
        }
      : item
    );
  const existingIds = new Set(scoredItems.map(item => item.memory_id));
  const lockedItems = allItems
    .filter(item => lockedIds.has(item.memory_id) && !existingIds.has(item.memory_id))
    .map(item => makeLockedRecallItem(item));
  const items = [...scoredItems, ...lockedItems]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'zh-Hans-CN'))
    .slice(0, 20);

  const conflicts = memory.conflicts
    .filter(conflict => context.episodeTexts.some(text => textOverlaps(conflict, text)))
    .slice(0, 8);

  return {
    schema_version: 'ai-comic-series-memory-recall/v1',
    episode_no: episode.episode_no,
    items,
    conflicts,
  };
}

function buildEpisodeRecallContext(plan: AiComicSeriesPlan, episode: AiComicEpisodePlan): {
  episodeNo: number;
  keyCharacters: string[];
  knowledgeFocus: string[];
  episodeTexts: string[];
  activeThreadTexts: string[];
} {
  const previous = plan.episodes.find(item => item.episode_no === episode.episode_no - 1);
  const next = plan.episodes.find(item => item.episode_no === episode.episode_no + 1);
  const activeThreadTexts = plan.plot_threads
    .filter(thread => thread.setup_episode <= episode.episode_no && thread.payoff_episode >= episode.episode_no)
    .flatMap(thread => [thread.title, thread.description, ...thread.continuity_notes]);
  return {
    episodeNo: episode.episode_no,
    keyCharacters: episode.key_characters,
    knowledgeFocus: episode.knowledge_focus,
    activeThreadTexts,
    episodeTexts: [
      episode.title,
      episode.story_phase,
      episode.main_conflict,
      episode.opening_hook ?? '',
      episode.midpoint_turn ?? '',
      episode.character_state_change ?? '',
      episode.thread_action ?? '',
      ...episode.key_characters,
      ...episode.continuity_from_previous,
      ...episode.new_information,
      ...episode.foreshadowing,
      ...episode.payoff,
      episode.ending_hook,
      ...episode.knowledge_focus,
      ...episode.continuity_state_after,
      previous?.ending_hook ?? '',
      next?.main_conflict ?? '',
      ...activeThreadTexts,
    ].filter(Boolean),
  };
}

function scoreMemoryItemForEpisode(
  item: AiComicSeriesMemoryItem,
  context: ReturnType<typeof buildEpisodeRecallContext>,
): AiComicSeriesMemoryRecallItem | null {
  const reasons: string[] = [];
  let score = 0;

  if (item.related_episode_nos.includes(context.episodeNo)) {
    score += 28;
    reasons.push('本集直接关联');
  }
  if (item.related_episode_nos.includes(context.episodeNo - 1)) {
    score += 22;
    reasons.push('上一集承接');
  }
  if (item.related_episode_nos.some(no => no < context.episodeNo && context.episodeNo - no <= 3)) {
    score += 12;
    reasons.push('近期记忆');
  }
  if (item.category === 'character' && context.keyCharacters.some(name => item.label.includes(name) || name.includes(item.label))) {
    score += 36;
    reasons.push('关键角色');
  }
  if (item.category === 'knowledge_boundary' && context.knowledgeFocus.some(label => textOverlaps(item.label, label))) {
    score += 34;
    reasons.push('素材焦点');
  }
  if (item.category === 'story_event' && item.first_episode_no && item.first_episode_no < context.episodeNo) {
    score += 8;
    reasons.push('历史事件');
  }
  if (context.activeThreadTexts.some(text => textOverlaps(item.label, text) || textOverlaps(item.status, text))) {
    score += 18;
    reasons.push('长期线索相关');
  }
  if (context.episodeTexts.some(text =>
    textOverlaps(item.label, text)
    || textOverlaps(item.status, text)
    || item.continuity_notes.some(note => textOverlaps(note, text))
  )) {
    score += 20;
    reasons.push('文本匹配');
  }
  if (item.category === 'prop' || item.category === 'visual_asset') {
    score += 6;
    reasons.push(item.category === 'prop' ? '道具连续性' : '视觉连续性');
  }

  if (score < 20) return null;
  return {
    memory_id: item.memory_id,
    category: item.category,
    label: item.label,
    status: item.status,
    score: Math.min(score, 100),
    reasons: unique(reasons).slice(0, 4),
    related_episode_nos: item.related_episode_nos,
    continuity_notes: item.continuity_notes.slice(-4),
  };
}

function makeLockedRecallItem(item: AiComicSeriesMemoryItem): AiComicSeriesMemoryRecallItem {
  return {
    memory_id: item.memory_id,
    category: item.category,
    label: item.label,
    status: item.status,
    score: 100,
    reasons: ['人工锁定'],
    related_episode_nos: item.related_episode_nos,
    continuity_notes: item.continuity_notes.slice(-4),
  };
}

function allSeriesMemoryItems(memory: AiComicSeriesMemory): AiComicSeriesMemoryItem[] {
  return [
    ...memory.characters,
    ...memory.relationships,
    ...memory.props,
    ...memory.locations,
    ...memory.visual_assets,
    ...memory.knowledge_boundaries,
    ...memory.story_events,
  ];
}

function groupRecallItemsByCategory(
  items: AiComicSeriesMemoryRecallItem[],
): Map<AiComicSeriesMemoryCategory, AiComicSeriesMemoryRecallItem[]> {
  const map = new Map<AiComicSeriesMemoryCategory, AiComicSeriesMemoryRecallItem[]>();
  for (const item of items) {
    map.set(item.category, [...(map.get(item.category) ?? []), item]);
  }
  return map;
}

function textOverlaps(left: string, right: string): boolean {
  const a = left.trim();
  const b = right.trim();
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const leftTokens = significantTextTokens(a);
  const rightTokens = new Set(significantTextTokens(b));
  return leftTokens.some(token => rightTokens.has(token));
}

function significantTextTokens(text: string): string[] {
  const asciiTokens = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const zhTokens = Array.from(text.matchAll(/[\u4e00-\u9fff]{2,}/g))
    .flatMap(match => {
      const value = match[0];
      const tokens: string[] = [];
      for (let index = 0; index < value.length - 1; index += 1) tokens.push(value.slice(index, index + 2));
      return tokens;
    });
  return unique([...asciiTokens, ...zhTokens])
    .filter(token => !['本集', '上一', '下一', '角色', '状态', '线索', '知识', '场景'].includes(token));
}

function detectSeriesMemoryConflicts(
  memory: AiComicSeriesMemory,
  episode: AiComicEpisodePlan,
  memoryEvents: AiComicSeriesMemoryItem[] = [],
): string[] {
  const conflicts: string[] = [];
  for (const paid of episode.payoff) {
    const title = paid.split(/[：:]/)[0] ?? paid;
    if (!title.trim()) continue;
    const stillOpen = memory.story_events.some(item =>
      item.label.includes(title) && item.last_episode_no && item.last_episode_no < episode.episode_no
    );
    if (stillOpen && episode.foreshadowing.some(item => item.includes(title))) {
      conflicts.push(`第${episode.episode_no}集同时回收又重新埋设“${title}”，需要确认是反转还是冲突。`);
    }
  }
  for (const event of memoryEvents) {
    if (event.category !== 'prop' && event.category !== 'visual_asset') continue;
    const previous = memoryBucket(memory, event.category)
      .filter(item => item.label === event.label)
      .filter(item => (item.last_episode_no ?? 0) < episode.episode_no);
    if (previous.length === 0) continue;
    const previousStatus = previous[previous.length - 1]?.status ?? '';
    if (isDestroyedOrLost(previousStatus) && !isDestroyedOrLost(event.status)) {
      conflicts.push(`第${episode.episode_no}集“${event.label}”再次出现，但旧记忆显示它已损毁或遗失，需要确认是否修复、替代或误写。`);
    }
  }
  for (const event of memoryEvents.filter(item => item.category === 'knowledge_boundary')) {
    const text = [...event.continuity_notes, event.status].join('；');
    if (/虚构|戏剧化|补足|待核|未核实/.test(text) && /确证|史实|真实发生|明确记载/.test(text)) {
      conflicts.push(`第${episode.episode_no}集知识边界“${event.label}”同时出现待核与确证表述，需要人工复核。`);
    }
  }
  return conflicts;
}

function isDestroyedOrLost(text: string): boolean {
  return /碎|毁|烧|断|遗失|丢失|失落|沉入|被夺|消失|不见/.test(text);
}

function sameThread(left: string, right: string): boolean {
  const leftTitle = left.split(/[：:]/)[0] ?? left;
  const rightTitle = right.split(/[：:]/)[0] ?? right;
  return leftTitle === rightTitle || left.includes(rightTitle) || right.includes(leftTitle);
}

async function buildKnowledgePackForSeries(plan: AiComicSeriesPlan): Promise<KnowledgePack> {
  const analysis = await analyzeOutline({
    outline: plan.premise,
    preferred_video_types: ['ai_comic_drama'],
  });
  if (!analysis.ok || !analysis.data) {
    return {
      primary_entries: [],
      supporting_entries: [],
      missing_needs: [{
        need_id: 'series_knowledge',
        label: '系列知识依据',
        message: analysis.error?.message ?? '系列梗概未能分析出知识依据',
      }],
      overall_confidence: 0,
    };
  }

  const needs = analysis.data.knowledge_needs.length > 0
    ? analysis.data.knowledge_needs
    : buildFallbackKnowledgeNeeds(plan, analysis.data.detected_subjects);
  const match = await multiMatchEntries({
    outline: plan.premise,
    knowledge_needs: needs,
    limit_per_need: 5,
  });
  if (!match.ok || !match.data) {
    return {
      primary_entries: [],
      supporting_entries: [],
      missing_needs: [{
        need_id: 'series_knowledge',
        label: '系列知识依据',
        message: match.error?.message ?? '系列知识依据匹配失败',
      }],
      overall_confidence: 0,
    };
  }
  return match.data.matched_knowledge_pack;
}

function buildFallbackKnowledgeNeeds(plan: AiComicSeriesPlan, detectedSubjects: string[]): KnowledgeNeed[] {
  const keywords = unique([
    ...detectedSubjects,
    ...plan.main_characters.map(character => character.name),
    ...plan.episodes.flatMap(episode => episode.knowledge_focus),
  ].filter(Boolean)).slice(0, 8);
  return [{
    need_id: 'series_knowledge',
    label: '系列知识依据',
    keywords: keywords.length > 0 ? keywords : [plan.series_title],
    required: true,
  }];
}

function buildEpisodeAudienceGenerationOutline(
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
  ledger?: AiComicContinuityLedger,
): string {
  const previousRecord = ledger?.episode_records
    .filter(record => record.episode_no < episode.episode_no)
    .sort((a, b) => b.episode_no - a.episode_no)[0];
  const previous = plan.episodes.find(item => item.episode_no === episode.episode_no - 1);
  const next = plan.episodes.find(item => item.episode_no === episode.episode_no + 1);
  const blueprint = buildAiComicEpisodeBlueprint(plan, episode);
  const premiseLines = seriesPremiseAnchorLines(plan.premise_contract);
  return [
    `系列《${plan.series_title}》第${episode.episode_no}集《${episode.title}》。`,
    `本集只写第${episode.episode_no}集，不展开其他集。`,
    `系列梗概：${plan.premise}`,
    `本集开场：${blueprint.opening_hook}`,
    `本集主冲突：${episode.main_conflict}`,
    `中段反转：${blueprint.midpoint_turn}`,
    `人物变化：${blueprint.character_state_change}`,
    `结尾钩子：${episode.ending_hook}`,
    blueprint.commercial_beats
      ? `商业节拍硬合同：前三秒=${blueprint.commercial_beats.hook_3s}；本集目标=${blueprint.commercial_beats.episode_goal}；外部压力=${blueprint.commercial_beats.external_pressure}；失败代价=${blueprint.commercial_beats.failure_cost}；人物选择=${blueprint.commercial_beats.character_choice}；结尾追问=${blueprint.commercial_beats.cliffhanger_question}`
      : '',
    blueprint.commercial_beats
      ? `开场对白必须承载本集独有冲突：${blueprint.commercial_beats.opening_dialogue}`
      : '',
    `关键角色：${episode.key_characters.join('、') || plan.main_characters.map(character => character.name).join('、')}`,
    premiseLines.length > 0 ? `设定硬锚点：${premiseLines.join('；')}` : '',
    episode.continuity_from_previous.length > 0
      ? `承接：${episode.continuity_from_previous.join('；')}`
      : previous
        ? `承接上一集结尾：${previous.ending_hook}`
        : '承接：建立主角第一次面对核心问题的处境。',
    previousRecord
      ? `上一集已生成状态：${previousRecord.next_episode_memory.join('；')}`
      : '',
    episode.new_information.length > 0 ? `本集新信息：${episode.new_information.join('；')}` : '',
    episode.foreshadowing.length > 0 ? `伏笔：${episode.foreshadowing.join('；')}` : '',
    episode.payoff.length > 0 ? `回收：${episode.payoff.join('；')}` : '',
    next ? `下一集应承接：${next.main_conflict}` : '',
    isRuleMysteryPremise(plan.premise)
      ? '成稿方向：用午夜灯火、白幕、影偶、规则痕迹、灯票和记忆缺口等可见动作推进；皮影文化事实与原创规则机制必须分开表述。'
      : isAiComicHeritageStageRescueText(plan.premise)
      ? '成稿方向：用可见动作、短对白、表情变化和皮影/影偶/灯幕/戏台等具体物件推进；不要写成知识摘要或制作说明。'
      : '成稿方向：用可见动作、短对白、表情变化和案卷/书卷/证物等道具推进；不要写成知识摘要或制作说明。',
  ].filter(Boolean).join('\n');
}

function buildEpisodeGenerationOutline(
  plan: AiComicSeriesPlan,
  episode: AiComicEpisodePlan,
  ledger?: AiComicContinuityLedger,
  narrativePatternIds: NarrativePatternId[] = [],
  memoryRecallControls?: AiComicSeriesMemoryRecallControls,
): string {
  const previous = plan.episodes.find(item => item.episode_no === episode.episode_no - 1);
  const next = plan.episodes.find(item => item.episode_no === episode.episode_no + 1);
  const phase = plan.phases.find(item =>
    episode.episode_no >= item.episode_range[0] && episode.episode_no <= item.episode_range[1]
  );
  const previousLedgerRecord = ledger?.episode_records
    .filter(record => record.episode_no < episode.episode_no)
    .sort((a, b) => b.episode_no - a.episode_no)[0];
  const blueprint = buildAiComicEpisodeBlueprint(plan, episode);
  const spineLines = plan.series_spine?.map(beat =>
    `${beat.beat_id} 第${beat.episode_range[0]}-${beat.episode_range[1]}集：${beat.story_function}；关键问题：${beat.central_question}；必须转向：${beat.required_turn}；目标：${beat.payoff_target}`
  ) ?? [];
  const ledgerLines = ledger ? [
    '连续性账本：后续分镜必须以账本为准，不得推翻已生成集数的人物状态、线索开合和素材使用记录。',
    `账本最近生成集：${ledger.last_generated_episode_no ? `第${ledger.last_generated_episode_no}集` : '尚未生成'}`,
    `账本当前角色状态：${ledger.character_state_current.join('；') || '暂无'}`,
    `账本未回收线索：${ledger.open_threads.join('；') || '暂无'}`,
    `账本已回收线索：${ledger.paid_off_threads.join('；') || '暂无'}`,
    `账本已用素材：${ledger.knowledge_used.join('、') || '暂无'}`,
    ...buildSeriesMemoryPromptLines(ledger.series_memory, plan, episode, memoryRecallControls),
    ...buildEpisodicMemoryPromptLines(ledger.episodic_memory, plan, episode),
    ...buildProductionConstraintPromptLines(ledger.production_constraints, episode),
    previousLedgerRecord
      ? `上一条生成记忆：第${previousLedgerRecord.episode_no}集《${previousLedgerRecord.title}》；故事ID：${previousLedgerRecord.story_id}；${previousLedgerRecord.next_episode_memory.join('；')}`
      : '',
  ] : [];
  const narrativePatternLines = getNarrativePatternRequirementLines('ai_comic_drama', narrativePatternIds);
  const premiseLines = seriesPremiseAnchorLines(plan.premise_contract);

  return [
    `系列名：${plan.series_title}`,
    `只生成第${episode.episode_no}集完整分镜，不生成其他集。`,
    `系列梗概：${plan.premise}`,
    `系列主题：${plan.core_theme}`,
    spineLines.length > 0 ? `系列主线骨架：${spineLines.join('；')}` : '',
    `本集标题：${episode.title}`,
    `本集目标：${episode.target_duration_sec}秒左右，约${episode.target_panel_count}格。该时长是生成前目标，不代表最终成片真实时长。`,
    `本集阶段：${episode.story_phase}`,
    phase ? `阶段目标：${phase.purpose}；阶段转折：${phase.turning_point}` : '',
    `本集蓝图：开场钩子=${blueprint.opening_hook}；中段转折=${blueprint.midpoint_turn}；结尾类型=${hookTypeLabel(blueprint.ending_hook_type)}；角色变化=${blueprint.character_state_change}；线索动作=${blueprint.thread_action}`,
    blueprint.commercial_beats
      ? `商业节拍：前三秒=${blueprint.commercial_beats.hook_3s}；目标=${blueprint.commercial_beats.episode_goal}；压力=${blueprint.commercial_beats.external_pressure}；失败代价=${blueprint.commercial_beats.failure_cost}；选择=${blueprint.commercial_beats.character_choice}；状态变化=${blueprint.commercial_beats.state_change}；具体追问=${blueprint.commercial_beats.cliffhanger_question}`
      : '',
    blueprint.commercial_beats
      ? `差异化约束：开场类型=${blueprint.commercial_beats.opening_hook_type}；开场对白=${blueprint.commercial_beats.opening_dialogue}；场景功能序列=${blueprint.commercial_beats.scene_function_sequence.join('→')}；地点/人物/动作组合=${blueprint.commercial_beats.signature_combo}`
      : '',
    `本集目标场景功能：${blueprint.target_scene_functions.join('；')}`,
    `本集主冲突：${episode.main_conflict}`,
    `关键角色：${episode.key_characters.join('、') || plan.main_characters.map(character => character.name).join('、')}`,
    premiseLines.length > 0 ? `设定硬锚点：${premiseLines.join('；')}` : '',
    `承接上一集：${episode.continuity_from_previous.join('；')}`,
    previous ? `上一集结尾钩子：${previous.ending_hook}` : '',
    `本集新增信息：${episode.new_information.join('；')}`,
    `本集伏笔：${episode.foreshadowing.join('；') || '无'}`,
    `本集回收：${episode.payoff.join('；') || '无'}`,
    `本集结尾钩子：${episode.ending_hook}`,
    `本集后连续性状态：${episode.continuity_state_after.join('；')}`,
    next ? `下一集需要承接：${next.main_conflict}；${next.continuity_from_previous.join('；')}` : '',
    ...ledgerLines,
    narrativePatternLines.length > 0
      ? `叙事流派机制：${narrativePatternLines.join('；')}`
      : '',
    '素材使用规则：项目素材不是资料仓库。本集生成必须把素材焦点转化为人物选择、场景资产、时代边界、线索开合和可信度提示；不要把素材摘要直接铺成旁白资料。',
    `长期线索：${plan.plot_threads.map(thread => `${thread.title}，第${thread.setup_episode}集开启，第${thread.payoff_episode}集回收：${thread.description}`).join('；')}`,
    `角色弧线：${plan.main_characters.map(character => `${character.name}：${character.long_arc}`).join('；')}`,
    `连续性规则：${plan.continuity_rules.map(rule => `${rule.label}：${rule.description}`).join('；')}`,
    `素材焦点：${episode.knowledge_focus.join('、') || plan.recurring_motifs.join('、')}`,
    '输出要求：按 AI 漫剧分镜生成完整故事文本、场景分解、对白、画面提示和 GEARS 分段；必须把商业节拍写成可见行动和对白，回应上一集钩子，并让本集结尾钩子可被下一集承接。',
  ].filter(Boolean).join('\n');
}

function buildProductionConstraintPromptLines(
  constraints: AiComicProductionConstraints | undefined,
  episode: AiComicEpisodePlan,
): string[] {
  if (!constraints) return [];
  const related = constraints.items
    .filter(item => item.status !== 'resolved')
    .filter(item => !item.episode_no || Math.abs(item.episode_no - episode.episode_no) <= 1)
    .filter(item =>
      item.episode_no === episode.episode_no
      || item.severity === 'must'
      || episode.key_characters.some(character => item.description.includes(character) || item.label.includes(character))
      || episode.knowledge_focus.some(focus => item.description.includes(focus) || item.label.includes(focus))
    )
    .slice(-12);
  if (related.length === 0) return [];
  return [
    '制作约束审计：以下约束来自系列规划、已生成镜头和 Seedance 提示词，必须在本集画面提示、运镜和负向约束中保持一致。',
    ...related.map(item => [
      productionConstraintCategoryLabel(item.category),
      item.episode_no ? `第${item.episode_no}集` : '全系列',
      item.shot_id ? `镜头${item.shot_id}` : '',
      productionConstraintSeverityLabel(item.severity),
      item.label,
      item.description,
    ].filter(Boolean).join('：')),
    constraints.conflicts.length > 0 ? `制作约束待复核：${constraints.conflicts.slice(-5).join('；')}` : '',
  ].filter(Boolean);
}

function closestSupportedDuration(seconds: number): SupportedDuration {
  const options: Array<{ value: SupportedDuration; seconds: number }> = [
    { value: '30秒', seconds: 30 },
    { value: '1分钟', seconds: 60 },
    { value: '3分钟', seconds: 180 },
    { value: '5分钟', seconds: 300 },
    { value: '8分钟', seconds: 480 },
    { value: '10分钟', seconds: 600 },
    { value: '15分钟', seconds: 900 },
    { value: '20分钟', seconds: 1200 },
  ];
  return options.reduce((best, option) =>
    Math.abs(option.seconds - seconds) < Math.abs(best.seconds - seconds) ? option : best
  ).value;
}

function buildEpisodeCharacterHints(plan: AiComicSeriesPlan, episode: AiComicEpisodePlan): StoryDetectedCharacter[] {
  const names = unique([
    ...episode.key_characters,
    ...plan.main_characters.slice(0, 3).map(character => character.name),
  ].filter(Boolean));

  return names.map((name, index) => ({
    name,
    role_position: index === 0 ? '主角' : '配角',
    character_kind: 'named_person',
    source_text: `漫剧系列《${plan.series_title}》第${episode.episode_no}集角色`,
    asset_stability: 'recurring',
  }));
}

function mergeCharacters(primary: StoryDetectedCharacter[], secondary: StoryDetectedCharacter[]): StoryDetectedCharacter[] {
  const map = new Map<string, StoryDetectedCharacter>();
  for (const character of [...primary, ...secondary]) {
    if (!map.has(character.name)) {
      map.set(character.name, character);
    }
  }
  return [...map.values()];
}

function deriveSeriesTitle(outline: string, mainCharacter: string | null): string {
  if (mainCharacter) return `${mainCharacter}漫剧系列`;
  const titleSeed = summarizeText(outline, 12).replace(/[，。；：！？\s]/g, '');
  return `${titleSeed || 'AI漫剧'}系列`;
}

function deriveAiComicSeriesCoreTheme(outline: string, fallbackTheme: string): string {
  const text = `${outline}\n${fallbackTheme}`;
  if (isAiComicRefusalCaseText(text)) return '拒签冤案中的良知选择';
  if (isRuleMysteryPremise(text)) return '守住记忆并揭开午夜皮影规则的选择';
  if (isAiComicHeritageStageRescueText(text)) return '非遗传承中的守艺选择';
  if (/冤案|错案|案卷|证词|判词/.test(text) && /良知|公正|正义|人命/.test(text)) {
    return '疑案中的公正选择';
  }
  if (/少年|成长|求学|立志/.test(text) && /选择|良知|信念|担当/.test(text)) {
    return '少年成长中的信念选择';
  }
  return fallbackTheme || summarizeText(outline, 24);
}

function isAiComicRefusalCaseText(text: string): boolean {
  return /拒签|未签|不签|死刑|行刑|冤案|判词|案卷/.test(text)
    && /周敦颐|濂溪|南安|良知|公正|人命|上官/.test(text);
}

function isAiComicHeritageStageRescueText(text: string): boolean {
  return !isRuleMysteryPremise(text)
    && /皮影|影偶|灯幕|戏班/.test(text)
    && /戏台|拆迁|拆除|守艺|传承|演出/.test(text);
}

function extractAiComicOutlineCharacters(outline: string): StoryDetectedCharacter[] {
  const patterns = [
    /(?:少年|少女|青年|主角|修复师)([阿\u4e00-\u9fff][\u4e00-\u9fff]{1,2})(?=为|在|从|要|与|，|。|；|：|$)/g,
  ];
  const names: string[] = [];
  for (const pattern of patterns) {
    for (const match of outline.matchAll(pattern)) {
      const name = match[1]?.trim();
      if (name && !/^(主角|少年|少女|青年|修复师)$/.test(name)) names.push(name);
    }
  }
  return unique(names).slice(0, 4).map((name, index) => ({
    name,
    role_position: index === 0 ? '主角' : '配角',
    character_kind: 'named_person',
    source_text: `用户原创大纲明确角色：${name}`,
    asset_stability: 'recurring',
  }));
}

function buildLogline(seriesTitle: string, outline: string, coreTheme?: string): string {
  const theme = coreTheme || summarizeText(outline, 18);
  return `${seriesTitle}围绕“${theme}”展开，用连续短集推进人物选择、文化线索和情绪回收。`;
}

function buildPhases(episodeCount: number): AiComicSeriesPhase[] {
  const phaseCount = episodeCount <= 1 ? 1 : episodeCount <= 6 ? 3 : episodeCount <= 20 ? 4 : 5;
  const phases: AiComicSeriesPhase[] = [];
  let start = 1;
  for (let index = 0; index < phaseCount; index += 1) {
    const remainingEpisodes = episodeCount - start + 1;
    const remainingPhases = phaseCount - index;
    const length = Math.ceil(remainingEpisodes / remainingPhases);
    const end = Math.min(episodeCount, start + length - 1);
    const template = PHASE_TEMPLATES[index];
    phases.push({
      phase_id: template.id,
      episode_range: [start, end],
      purpose: template.purpose,
      turning_point: template.turning_point,
    });
    start = end + 1;
  }
  return phases;
}

function buildCharacterArcs(
  detectedCharacters: StoryDetectedCharacter[],
  episodeCount: number,
  mainCharacter: string | null,
  premiseContract?: SeriesPremiseContract,
): AiComicSeriesCharacterArc[] {
  const baseNames = detectedCharacters.map(character => character.name);
  const lockedNames = premiseContract?.locked_characters
    .filter(character => character.required)
    .map(character => character.name) ?? [];
  const names = unique([
    ...lockedNames,
    mainCharacter,
    ...baseNames,
    baseNames.length === 0 ? '主角' : null,
    '关键见证者',
    '对照角色',
  ].filter(Boolean) as string[]).slice(0, 5);

  return names.map((name, index) => {
    const isLead = index === 0;
    const role = isLead ? '主角' : index === 1 ? '重要配角' : index === 2 ? '关系推动者' : '功能角色';
    return {
      name,
      role,
      starting_state: isLead ? '带着未完成目标进入故事' : '掌握一部分信息或情绪立场',
      desire: isLead ? '找到能回应核心主题的行动答案' : '推动主角面对新的选择',
      long_arc: isLead ? '从被问题推着走，到主动承担选择后果' : '从单一立场变成主线变化的见证与推动力量',
      turning_points: buildTurningPoints(episodeCount, isLead),
      visual_signature: isLead ? `${name}的固定服饰、随身物或动作习惯` : `${name}的识别道具和表情基调`,
    };
  });
}

function buildTurningPoints(episodeCount: number, isLead: boolean): Array<{ episode_no: number; change: string }> {
  const points = unique([
    1,
    Math.max(1, Math.ceil(episodeCount * 0.34)),
    Math.max(1, Math.ceil(episodeCount * 0.68)),
    episodeCount,
  ]);
  return points.map((episodeNo, index) => ({
    episode_no: episodeNo,
    change: isLead
      ? ['目标被点燃', '第一次付出代价', '重建信念', '完成最终选择'][index] ?? '状态推进'
      : ['进入主线', '立场变化', '提供关键推动', '关系落点'][index] ?? '关系推进',
  }));
}

function buildPlotThreads(
  episodeCount: number,
  seriesTitle: string,
  knowledgeFocus: string[],
  pacingProfile: AiComicPacingProfile,
  premiseContract?: SeriesPremiseContract,
): AiComicPlotThread[] {
  const late = Math.max(1, episodeCount);
  const mid = Math.max(1, Math.ceil(episodeCount * 0.55));
  const earlyPayoff = Math.max(1, Math.ceil(episodeCount * 0.28));
  const baseThreads: AiComicPlotThread[] = [
    {
      thread_id: 'thread-main',
      title: `${seriesTitle}主线`,
      setup_episode: 1,
      payoff_episode: late,
      description: '主角围绕核心问题持续做选择，并在终局完成主题表达。',
      continuity_notes: ['每集必须推动主线状态', '主角选择带来的代价要进入后续集'],
    },
    {
      thread_id: 'thread-knowledge',
      title: knowledgeFocus[0] ? `${knowledgeFocus[0]}知识线` : '文化知识线',
      setup_episode: 1,
      payoff_episode: mid,
      description: '把知识依据拆成可视化线索，在剧情推进中逐步揭示。',
      continuity_notes: ['知识信息要服务人物行动', '新信息出现后需要改变角色判断'],
    },
    {
      thread_id: 'thread-emotion',
      title: `${PACING_LABELS[pacingProfile]}情绪线`,
      setup_episode: Math.min(2, late),
      payoff_episode: Math.max(earlyPayoff, Math.min(late, earlyPayoff + 1)),
      description: '通过短集结尾钩子和情绪反差保持追看动力。',
      continuity_notes: ['结尾钩子应在下一集开头回应', '情绪强点需要阶段性降落'],
    },
  ];
  const worldRule = premiseContract?.world_rules.find(rule => rule.required);
  const antagonisticForces = premiseContract?.antagonistic_forces.filter(force => force.required) ?? [];
  if (worldRule) {
    baseThreads.push({
      thread_id: 'thread-premise-world-rules',
      title: '午夜规则与记忆代价线',
      setup_episode: 1,
      payoff_episode: late,
      description: `${worldRule.statement}${worldRule.consequence ? `；${worldRule.consequence}` : ''}，每次触发都必须改变人物记忆或关系状态。`,
      continuity_notes: premiseContract?.world_rules.map(rule => `${rule.statement}${rule.consequence ? `；${rule.consequence}` : ''}`) ?? [],
    });
  }
  if (antagonisticForces.length > 0) {
    baseThreads.push({
      thread_id: 'thread-premise-antagonists',
      title: `${antagonisticForces.map(force => force.label).join('与')}对抗线`,
      setup_episode: 1,
      payoff_episode: Math.max(1, Math.ceil(episodeCount * 0.9)),
      description: antagonisticForces.map(force => `${force.label}：${force.function}`).join('；'),
      continuity_notes: ['每集至少让一股对抗力量造成可见阻力、信息误导或时间代价。'],
    });
  }
  return baseThreads;
}

function buildSeriesSpine(params: {
  phases: AiComicSeriesPhase[];
  plotThreads: AiComicPlotThread[];
  coreTheme: string;
  seriesTitle: string;
}): AiComicSeriesSpineBeat[] {
  const mainThread = params.plotThreads.find(thread => thread.thread_id === 'thread-main') ?? params.plotThreads[0];
  return params.phases.map((phase, index) => {
    const activeThreads = params.plotThreads
      .filter(thread => thread.setup_episode <= phase.episode_range[1] && thread.payoff_episode >= phase.episode_range[0])
      .map(thread => thread.title);
    const storyFunction = [
      '点燃主问题并建立行动方向',
      '扩大关系阻力并让文化线索进入选择',
      '持续加压，使长期线索汇合',
      '把代价、误解和信念推到临界点',
      '回收主线并完成主题表达',
    ][index] ?? phase.purpose;

    return {
      beat_id: `spine-${index + 1}`,
      episode_range: phase.episode_range,
      story_function: storyFunction,
      central_question: `在《${params.seriesTitle}》第${phase.episode_range[0]}-${phase.episode_range[1]}集，主角如何回答“${params.coreTheme}”？`,
      required_turn: phase.turning_point,
      payoff_target: activeThreads.length > 0
        ? `重点处理：${activeThreads.join('、')}`
        : `推进${mainThread?.title ?? '系列主线'}`,
    };
  });
}

type AiComicSerialCaseKind = 'refusal_case' | 'heritage_stage_rescue' | 'generic';

interface AiComicSerialEpisodeOverride {
  title: string;
  openingHook: string;
  mainConflict: string;
  midpointTurn: string;
  newInformation: string[];
  foreshadowing: string[];
  payoff: string[];
  endingHook: string;
  endingHookType: AiComicEndingHookType;
  threadAction: string;
  continuityStateAfter: string[];
  knowledgeFocus?: string[];
}

function buildEpisodes(params: {
  episodeCount: number;
  durationMin: number;
  durationMax: number;
  phases: AiComicSeriesPhase[];
  characters: AiComicSeriesCharacterArc[];
  plotThreads: AiComicPlotThread[];
  knowledgeFocus: string[];
  outline: string;
  coreTheme: string;
  pacingProfile: AiComicPacingProfile;
  premiseContract?: SeriesPremiseContract;
}): AiComicEpisodePlan[] {
  const episodes: AiComicEpisodePlan[] = [];
  const serialCase = inferAiComicSerialCase(params.outline, params.coreTheme, params.knowledgeFocus);
  for (let episodeNo = 1; episodeNo <= params.episodeCount; episodeNo += 1) {
    const phase = findPhase(params.phases, episodeNo);
    const previous = episodes[episodes.length - 1];
    const duration = chooseDuration(episodeNo, params.episodeCount, params.durationMin, params.durationMax, params.pacingProfile);
    const threadPayoffs = params.plotThreads.filter(thread => thread.payoff_episode === episodeNo);
    const threadSetups = params.plotThreads.filter(thread => thread.setup_episode === episodeNo);
    const focus = chooseKnowledgeFocus(params.knowledgeFocus, episodeNo);
    const keyCharacters = chooseKeyCharacters(params.characters, episodeNo, params.premiseContract);
    const serialEpisode = buildAiComicSerialEpisodeOverride({
      serialCase,
      episodeNo,
      episodeCount: params.episodeCount,
      phase,
      previous,
      coreTheme: params.coreTheme,
      focus,
      keyCharacters,
      pacingProfile: params.pacingProfile,
      plotThreads: params.plotThreads,
      threadSetups,
      threadPayoffs,
    });
    const mainConflict = serialEpisode?.mainConflict
      ?? buildConflict(episodeNo, params.episodeCount, params.coreTheme, focus);
    const endingHookType = serialEpisode?.endingHookType
      ?? inferEndingHookTypeFromPlan(episodeNo, params.episodeCount, params.pacingProfile);
    const endingHook = serialEpisode?.endingHook
      ?? buildEndingHook(episodeNo, params.episodeCount, params.pacingProfile, focus);
    const continuityStateAfter = serialEpisode?.continuityStateAfter ?? [
      `第${episodeNo}集后，${keyCharacters[0] ?? '主角'}对“${params.coreTheme}”的理解推进一层`,
      episodeNo === params.episodeCount ? '主要长期线索完成回收' : `保留第${episodeNo + 1}集需要回应的选择或疑问`,
    ];

    const episodePlan: AiComicEpisodePlan = {
      episode_no: episodeNo,
      title: serialEpisode?.title ?? buildEpisodeTitle(episodeNo, params.episodeCount, phase, params.coreTheme, focus),
      target_duration_sec: duration,
      target_panel_count: Math.max(4, Math.min(60, Math.round(duration / 6))),
      story_phase: `${phase.phase_id}：${phase.purpose}`,
      opening_hook: serialEpisode?.openingHook
        ?? buildOpeningHook(episodeNo, previous, params.coreTheme, focus, params.pacingProfile),
      main_conflict: mainConflict,
      midpoint_turn: serialEpisode?.midpointTurn
        ?? buildMidpointTurn(episodeNo, params.episodeCount, phase, focus, params.coreTheme),
      key_characters: keyCharacters,
      continuity_from_previous: episodeNo === 1
        ? ['建立主角初始状态、核心问题和第一条长期线索']
        : [
            `承接第${episodeNo - 1}集结尾：${previous?.ending_hook ?? '上一集留下的选择'}`,
            `延续第${episodeNo - 1}集后的状态：${previous?.continuity_state_after[0] ?? '人物关系继续变化'}`,
          ],
      new_information: serialEpisode?.newInformation ?? [
        buildEpisodeNewInformation(episodeNo, focus, params.coreTheme, params.outline),
        threadSetups.length > 0 ? `开启线索：${threadSetups.map(thread => thread.title).join('、')}` : `推进${phase.phase_id}的阶段目标`,
      ],
      foreshadowing: serialEpisode?.foreshadowing
        ?? buildForeshadowing(episodeNo, params.episodeCount, params.plotThreads, focus),
      payoff: serialEpisode?.payoff ?? (threadPayoffs.length > 0
        ? threadPayoffs.map(thread => `回收${thread.title}：${thread.description}`)
        : episodeNo % 5 === 0
          ? [`阶段性回应第${Math.max(1, episodeNo - 3)}集留下的疑问`]
          : []),
      ending_hook: endingHook,
      ending_hook_type: endingHookType,
      character_state_change: continuityStateAfter[0],
      thread_action: serialEpisode?.threadAction
        ?? buildThreadAction(episodeNo, params.plotThreads, threadSetups, threadPayoffs, phase),
      knowledge_focus: serialEpisode?.knowledgeFocus ?? (focus ? [focus] : params.knowledgeFocus.slice(0, 2)),
      continuity_state_after: continuityStateAfter,
    };
    const premiseLockedEpisode = applyPremiseContractToEpisodePlan({
      episode: episodePlan,
      contract: params.premiseContract,
      previous,
    });
    episodes.push({
      ...premiseLockedEpisode,
      commercial_beats: buildAiComicEpisodeCommercialBeats({
        episode: premiseLockedEpisode,
        outline: params.outline,
        coreTheme: params.coreTheme,
        premiseContract: params.premiseContract,
      }),
    });
  }
  return episodes;
}

function applyPremiseContractToEpisodePlan(input: {
  episode: AiComicEpisodePlan;
  contract?: SeriesPremiseContract;
  previous?: AiComicEpisodePlan;
}): AiComicEpisodePlan {
  const contract = input.contract;
  if (!contract) return input.episode;
  const lockedCharacters = contract.locked_characters
    .filter(character => character.required)
    .map(character => character.name);
  const requiredRules = contract.world_rules
    .filter(rule => rule.required)
    .flatMap(rule => unique([rule.statement, rule.consequence].filter((item): item is string => Boolean(item))));
  const requiredForces = contract.antagonistic_forces
    .filter(force => force.required)
    .map(force => force.label);
  const stakes = contract.core_stakes;
  const premiseAnchorIds = requiredSeriesPremiseAnchorIds(contract);
  if (premiseAnchorIds.length === 0) return input.episode;

  const characterSubject = lockedCharacters.join('与') || input.episode.key_characters[0] || '主角';
  const ruleSubject = requiredRules[0];
  const forceSubject = requiredForces.join('与');
  const stakeSubject = stakes[0];
  const isRuleMystery = isRuleMysteryPremise([
    ...requiredRules,
    ...stakes,
    ...contract.must_cover_beats,
  ].join('\n'));
  const openingHook = isRuleMystery && ruleSubject
    ? `第${input.episode.episode_no}次午夜开演前，${characterSubject}发现“${ruleSubject}”出现新的触发痕迹；${input.episode.opening_hook ?? '两人必须立刻决定是否入场。'}`
    : input.episode.opening_hook;
  const mainConflict = [
    input.episode.main_conflict,
    forceSubject ? `${forceSubject}在本集制造直接阻力` : '',
    stakeSubject ? `失败代价：${stakeSubject}` : '',
  ].filter(Boolean).join('；');
  const midpointTurn = [
    input.episode.midpoint_turn,
    requiredRules.length > 1
      ? `新证据证明${requiredRules[(input.episode.episode_no - 1) % requiredRules.length]}并非传闻，而是本集必须处理的机制。`
      : '',
  ].filter(Boolean).join('；');
  const endingHook = isRuleMystery && stakeSubject
    ? `白幕亮出第${input.episode.episode_no + 1}条未记录规则；${stakeSubject}，下一集谁会先失去关于同伴的记忆？`
    : input.episode.ending_hook;
  return {
    ...input.episode,
    opening_hook: openingHook,
    main_conflict: mainConflict,
    midpoint_turn: midpointTurn,
    key_characters: unique([...lockedCharacters, ...input.episode.key_characters]).slice(0, 4),
    new_information: unique([
      ...input.episode.new_information,
      ...requiredRules,
      ...requiredForces,
      ...stakes,
    ]),
    ending_hook: endingHook,
    knowledge_focus: unique([
      ...input.episode.knowledge_focus,
      ...requiredRules,
      ...requiredForces,
    ]).slice(0, 12),
    continuity_state_after: unique([
      ...input.episode.continuity_state_after,
      ...lockedCharacters.map(name => `${name}继续保留为锁定核心人物，不得被通用角色替换。`),
      ...(input.previous ? [`本集必须承接上一集结尾：${input.previous.ending_hook}`] : []),
    ]),
    premise_anchor_ids: premiseAnchorIds,
  };
}

function inferAiComicSerialCase(
  outline: string,
  coreTheme: string,
  knowledgeFocus: string[],
): AiComicSerialCaseKind {
  const text = [outline, coreTheme, ...knowledgeFocus].join('\n');
  if (isAiComicRefusalCaseText(text)) return 'refusal_case';
  if (isRuleMysteryPremise(text)) return 'generic';
  if (isAiComicHeritageStageRescueText(text)) return 'heritage_stage_rescue';
  return 'generic';
}

function buildAiComicSerialEpisodeOverride(input: {
  serialCase: AiComicSerialCaseKind;
  episodeNo: number;
  episodeCount: number;
  phase: AiComicSeriesPhase;
  previous?: AiComicEpisodePlan;
  coreTheme: string;
  focus: string;
  keyCharacters: string[];
  pacingProfile: AiComicPacingProfile;
  plotThreads: AiComicPlotThread[];
  threadSetups: AiComicPlotThread[];
  threadPayoffs: AiComicPlotThread[];
}): AiComicSerialEpisodeOverride | null {
  if (input.serialCase === 'refusal_case') return buildRefusalCaseEpisodeOverride(input);
  if (input.serialCase === 'heritage_stage_rescue') return buildHeritageStageEpisodeOverride(input);
  return null;
}

interface HeritageStageEpisodeBeat {
  title: string;
  action: string;
  obstacle: string;
  reveal: string;
  nextPressure: string;
  craftFocus: string;
}

const HERITAGE_STAGE_EPISODE_BEATS: HeritageStageEpisodeBeat[] = [
  { title: '戏台拆除倒计时', action: '在拆除告示生效前证明旧戏台仍能演出', obstacle: '戏台断电、幕布破损，失散戏班也无人应声', reveal: '祖父的机关谱藏在后台横梁里，却缺了最关键的一页', nextPressure: '拆迁方只给他三天拿出演出方案', craftFocus: '旧戏台结构与皮影灯位' },
  { title: '机关谱缺页', action: '按残页复原祖父留下的灯幕机关', obstacle: '机关尺寸与现存戏台完全对不上', reveal: '图纸画的不是一座戏台，而是两套可以拼合的灯架', nextPressure: '另一套灯架落在早已离队的老灯师手中', craftFocus: '机关谱与灯架比例' },
  { title: '第一只影偶', action: '修好能证明戏班身份的老影偶', obstacle: '影偶关节脆裂，旧牛皮一碰就掉色', reveal: '影偶背面刻着失散成员的联络暗号', nextPressure: '暗号指向一个拒绝再提戏班的人', craftFocus: '影偶雕镂与关节修复' },
  { title: '老灯师闭门', action: '说服老灯师交出另一套灯架', obstacle: '老灯师认定祖父当年背弃了所有人', reveal: '他保存的灯架上留有一场未完成演出的走位刻痕', nextPressure: '刻痕缺少操偶人的最后三步', craftFocus: '灯架、光距与走位刻痕' },
  { title: '断线的白幕', action: '在不更换原幕的前提下补好裂口', obstacle: '商业赞助方要求直接换成电子屏', reveal: '旧幕上的针脚正好标出祖父隐藏的第二条线索', nextPressure: '赞助方撤走了临时供电设备', craftFocus: '白幕补缀与透光测试' },
  { title: '失传的锣鼓点', action: '找回能驱动机关走位的旧锣鼓点', obstacle: '仅存录音被街声盖住，没人记得完整节拍', reveal: '阿湘从机关谱孔距里还原出节拍顺序', nextPressure: '节拍最后一段需要失散鼓师亲自确认', craftFocus: '锣鼓点与操偶节奏' },
  { title: '唱腔只剩半句', action: '补全祖父留下的半句唱腔', obstacle: '两位老成员对当年的版本各执一词', reveal: '两种唱法原本就是台前台后的对答', nextPressure: '其中一人提出必须先公开祖父散班的真相', craftFocus: '地方唱腔与双声部对答' },
  { title: '赞助人的条件', action: '保住演出经费又不把皮影改成空洞噱头', obstacle: '赞助人要求删除慢工修偶和老唱腔', reveal: '街坊最想看的恰恰是修偶过程和旧腔', nextPressure: '阿湘必须在第二天做一场无设备试演', craftFocus: '传统技艺展示与当代表达边界' },
  { title: '同伴分道', action: '让戏班接受数字投影只作辅助', obstacle: '同伴认为阿湘既固执又没有胜算', reveal: '祖父笔记明确写着“新光不能遮住手上的影”', nextPressure: '核心同伴带走了已经做好的数字场景', craftFocus: '手工皮影与数字投影协同' },
  { title: '第一次试演', action: '用残缺阵容完成面向街坊的试演', obstacle: '开场即断线，影偶卡在幕中央', reveal: '观众自发用手机灯补光，老灯师也在台下打出第一记锣', nextPressure: '拆迁负责人宣布正式验收提前', craftFocus: '试演调度与现场应变' },
  { title: '祖父散班真相', action: '查清祖父为何主动解散戏班', obstacle: '老成员都只记得自己被辜负的一面', reveal: '祖父为阻止戏班被一次性买断，独自承担违约责任', nextPressure: '当年的买断合同仍在现赞助方手中', craftFocus: '戏班口述与权利记录' },
  { title: '被卖掉的老箱', action: '追回装有全套影偶谱的老戏箱', obstacle: '收藏商只肯按商业高价转让', reveal: '箱底夹层留着祖父逐件登记的修复记录', nextPressure: '收藏商给阿湘一夜证明这些影偶会重新登台', craftFocus: '老戏箱与影偶谱系' },
  { title: '修复失败', action: '抢救因错误上油而卷曲的主角影偶', obstacle: '阿湘照着网传方法操作，反而加重损伤', reveal: '他承认错误后，老成员第一次愿意把真正手法教给他', nextPressure: '修复必须慢下来，验收时间却不再延后', craftFocus: '皮料回软与可逆修复' },
  { title: '雨夜护台', action: '在暴雨中护住刚修好的灯幕和木台', obstacle: '屋顶漏水，拆迁方以安全为由要求立即封场', reveal: '戏台旧排水机关仍能启动，但需要全员配合', nextPressure: '封场令将在天亮后正式张贴', craftFocus: '木构戏台与排水机关' },
  { title: '老成员归队', action: '让各怀旧怨的老成员重新排一次完整走位', obstacle: '每个人都要求先说清当年谁该负责', reveal: '走位刻痕证明祖父为每个人保留了不可替代的位置', nextPressure: '归队后的第一场合练暴露出新旧节奏冲突', craftFocus: '戏班分工与合练走位' },
  { title: '街坊拒演', action: '赢回已对戏台失去信任的街坊观众', obstacle: '大家认为演一晚也改变不了拆除结果', reveal: '一位老人拿出当年散班演出的最后一张票根', nextPressure: '票根背面写着祖父从未公开的道歉', craftFocus: '社区记忆与演出见证' },
  { title: '买断合同', action: '拆解旧合同对戏班影偶和唱腔的权利限制', obstacle: '赞助方声称公开演出构成违约', reveal: '合同只买断旧录制品，没有买断活态技艺和新创作', nextPressure: '对方转而抢占正式演出时段', craftFocus: '作品权利与活态传承边界' },
  { title: '少年接棒', action: '让新学员独立操控最难的一组影偶', obstacle: '老成员不相信短时间训练能守住手艺', reveal: '新学员用阿湘设计的分步记号完成了连贯动作', nextPressure: '老灯师要求阿湘自己退到幕后接受检验', craftFocus: '操偶训练与动作记谱' },
  { title: '档期被抢', action: '在主舞台被占后重新找到能聚拢观众的演出空间', obstacle: '备用场地没有吊点、灯位和隔音', reveal: '老街骑楼可以让灯幕、观众和街巷形成天然剧场', nextPressure: '使用街巷必须在一天内通过安全核验', craftFocus: '街巷空间与移动戏台' },
  { title: '公开彩排', action: '用完整阵容通过第一次公开彩排', obstacle: '唱腔、锣鼓和数字投影同时失步', reveal: '阿湘删掉炫技段落后，手、影、声第一次真正合在一起', nextPressure: '彩排录像泄露，商业方开始舆论施压', craftFocus: '声画同步与整场调度' },
  { title: '拆除提前', action: '在拆除机械进场前保住戏台核心构件', obstacle: '正式演出尚未获批，现场只剩几个小时', reveal: '机关谱标明戏台可以拆装迁移，但必须先留下原址演出证据', nextPressure: '阿湘要在封锁线外组织一场证明性演出', craftFocus: '可拆装木构与原址记录' },
  { title: '缺角影偶', action: '找到祖父始终没有补上的影偶缺角', obstacle: '所有修复记录都刻意跳过这一处', reveal: '缺角投出的影子正是机关启动标记', nextPressure: '标记指向戏台地板下的最后一封信', craftFocus: '影偶缺角与投影机关' },
  { title: '祖父的道歉信', action: '决定是否把祖父的道歉和散班责任公开', obstacle: '公开会伤害仍在场的老成员，不公开又无法真正和解', reveal: '信中没有替自己辩解，只把重组戏班的选择交给后来人', nextPressure: '阿湘必须在全体成员面前读完这封信', craftFocus: '口述边界与私人文书' },
  { title: '戏班再起', action: '让所有成员以新的规则重新签下合作约定', obstacle: '老成员害怕再次被商业买断，新成员担心没有未来', reveal: '新约定把技艺署名、收入和教学责任逐项写清', nextPressure: '重组后的第一项任务就是应对演出停电预案', craftFocus: '戏班协作与传承约定' },
  { title: '全场停电', action: '在正式预演突然停电后继续讲完故事', obstacle: '数字设备全部失效，观众开始离场', reveal: '手摇灯架和传统锣鼓让影偶重新出现在白幕上', nextPressure: '备用灯只能支撑最后一段，必须重新取舍结尾', craftFocus: '手摇灯架与无电演出' },
  { title: '新光之争', action: '解决手工光影与数字影像谁该站在中心的争执', obstacle: '两边都把退让看成否定自己的价值', reveal: '阿湘让数字画面只延展幕外空间，核心人物仍由影偶完成', nextPressure: '最终方案只剩一次整体彩排机会', craftFocus: '传统主体与数字延展' },
  { title: '最后排练', action: '在一次机会内跑通完整演出和撤场流程', obstacle: '老灯师体力不支，关键换景无人接手', reveal: '新学员已经记住老灯师所有手势，并能稳稳接位', nextPressure: '排练结束时戏台入口被正式封住', craftFocus: '代际接位与换景流程' },
  { title: '戏台封门', action: '在不破坏封条和安全边界的情况下保住演出', obstacle: '所有人都无法再进入旧戏台', reveal: '机关谱最初设计的就是可移动灯幕，整套戏可以走到街上', nextPressure: '街头演出没有舞台，也没有第二次开场机会', craftFocus: '移动灯幕与安全撤装' },
  { title: '街头救场', action: '在拆迁机械前完成决定戏台命运的公开演出', obstacle: '风吹动白幕，锣鼓声又被机器盖过', reveal: '失散成员、街坊和新学员接力稳住灯幕，观众围成了新的戏台', nextPressure: '最后一幕必须由阿湘回答是否只守一座旧台', craftFocus: '户外演出与群体协作' },
  { title: '灯亮之后', action: '完成演出并为皮影戏班建立可持续的新去处', obstacle: '保住一晚不等于技艺有了明天', reveal: '旧戏台核心构件被纳入街区更新，新戏班同时启动常态演出和教学', nextPressure: '阿湘把祖父的机关谱交给下一位学员，新的影子刚刚上场', craftFocus: '活态传承与长期运营' },
];

function buildHeritageStageEpisodeOverride(input: {
  episodeNo: number;
  episodeCount: number;
  phase: AiComicSeriesPhase;
  previous?: AiComicEpisodePlan;
  coreTheme: string;
  focus: string;
  keyCharacters: string[];
  pacingProfile: AiComicPacingProfile;
  plotThreads: AiComicPlotThread[];
  threadSetups: AiComicPlotThread[];
  threadPayoffs: AiComicPlotThread[];
}): AiComicSerialEpisodeOverride {
  const protagonist = input.keyCharacters[0] ?? '阿湘';
  const beatIndex = input.episodeCount <= 1
    ? HERITAGE_STAGE_EPISODE_BEATS.length - 1
    : Math.round(
        ((input.episodeNo - 1) * (HERITAGE_STAGE_EPISODE_BEATS.length - 1))
        / (input.episodeCount - 1),
      );
  const beat = HERITAGE_STAGE_EPISODE_BEATS[beatIndex] ?? HERITAGE_STAGE_EPISODE_BEATS[0];
  const isFirst = input.episodeNo === 1;
  const isFinal = input.episodeNo === input.episodeCount;
  const setupThreads = input.threadSetups.map(thread => thread.title).join('、');
  const payoffThreads = input.threadPayoffs.map(thread => thread.title).join('、');
  const mainThreadTitle = input.plotThreads.find(thread => thread.thread_id === 'thread-main')?.title
    ?? input.plotThreads[0]?.title
    ?? '系列主线';
  return {
    title: `第${input.episodeNo}集：${beat.title}`,
    openingHook: isFirst
      ? `拆除告示贴上长沙老街戏台，${protagonist}在后台找到祖父留下的残缺机关谱。`
      : `承接上一集“${input.previous?.ending_hook ?? '守艺难题尚未解决'}”，${beat.obstacle}。`,
    mainConflict: `${protagonist}必须${beat.action}，但${beat.obstacle}。`,
    midpointTurn: beat.reveal,
    newInformation: [
      beat.reveal,
      `本集守艺任务聚焦${beat.craftFocus}。`,
    ],
    foreshadowing: isFinal ? [] : [`${mainThreadTitle}推进：${beat.nextPressure}`],
    payoff: isFinal
      ? [`回收${payoffThreads || '公开演出、祖父秘密和戏班重组'}，让旧戏台与新戏班都获得可持续去处。`]
      : input.threadPayoffs.map(thread => `回收${thread.title}：${thread.description}`),
    endingHook: isFinal
      ? `${protagonist}把机关谱交给新学员，灯幕后升起下一代操偶人的第一道影子。`
      : `${beat.nextPressure}。`,
    endingHookType: isFinal ? 'final_echo' : input.pacingProfile === 'slow_burn' ? 'emotional_question' : 'danger',
    threadAction: isFinal
      ? `回收线索：${payoffThreads || '公开演出、祖父秘密和戏班重组'}。`
      : setupThreads
        ? `打开线索：${setupThreads}；后续必须承接${beat.nextPressure}。`
        : `推进${input.phase.phase_id}：完成${beat.craftFocus}的可见任务，并把${beat.nextPressure}交给下一集。`,
    continuityStateAfter: [
      `第${input.episodeNo}集后，${protagonist}完成“${beat.action}”并理解${beat.reveal}。`,
      isFinal ? '公开演出、祖父秘密和戏班关系完成回收。' : `下一集必须回应：${beat.nextPressure}。`,
    ],
    knowledgeFocus: [beat.craftFocus],
  };
}

function buildRefusalCaseEpisodeOverride(input: {
  episodeNo: number;
  episodeCount: number;
  phase: AiComicSeriesPhase;
  previous?: AiComicEpisodePlan;
  coreTheme: string;
  focus: string;
  keyCharacters: string[];
  pacingProfile: AiComicPacingProfile;
  plotThreads: AiComicPlotThread[];
  threadSetups: AiComicPlotThread[];
  threadPayoffs: AiComicPlotThread[];
}): AiComicSerialEpisodeOverride {
  const protagonist = input.keyCharacters[0] ?? '周敦颐';
  const setupThreads = input.threadSetups.map(thread => thread.title).join('、');
  const payoffThreads = input.threadPayoffs.map(thread => thread.title).join('、');
  const activeThread = input.plotThreads.find(thread =>
    thread.setup_episode < input.episodeNo && thread.payoff_episode > input.episodeNo
  );

  if (input.episodeNo === 1) {
    return {
      title: '第1集：未签的案卷',
      openingHook: '朱笔悬在死刑文书上，案卷证词却露出第一处破绽。',
      mainConflict: `${protagonist}发现死刑文书疑点，必须在催签压力下决定是否落笔。`,
      midpointTurn: '证词时间、封泥和押印对不上，拒签从迟疑变成必须承担的选择。',
      newInformation: [
        '死刑文书里的证词前后不合，封泥时间也对不上。',
        setupThreads ? `开启线索：${setupThreads}` : '开启线索：死刑文书疑点和催签压力',
      ],
      foreshadowing: ['被遮住姓名的旧案号指向下一集的上官召见。'],
      payoff: [],
      endingHook: `${protagonist}暂缓行刑并拒绝签字，门外却传来上官连夜召见。`,
      endingHookType: 'danger',
      threadAction: '打开线索：死刑文书疑点、催签压力和上官召见，写入后续承接。',
      continuityStateAfter: [
        `第1集后，${protagonist}从发现疑点走到公开拒签。`,
        '上官召见和旧案号成为第2集必须回应的压力。',
      ],
    };
  }

  if (input.episodeNo === input.episodeCount && input.episodeCount > 2) {
    return {
      title: `第${input.episodeNo}集：良知落笔`,
      openingHook: `最终复核送到案前，所有压力都逼${protagonist}撤回拒签。`,
      mainConflict: `${protagonist}必须用最终行动证明拒签不是任性，而是对人命负责。`,
      midpointTurn: '最后一处证据让错案链条闭合，代价也真正落到主角身上。',
      newInformation: [
        '旧案号、封泥和口供终于互相扣合，错案来源浮出水面。',
        payoffThreads ? `回收线索：${payoffThreads}` : `推进终局复核和${protagonist}代价`,
      ],
      foreshadowing: [],
      payoff: payoffThreads
        ? [`回收线索：${payoffThreads}，让拒签选择产生结果。`]
        : [`回收上官召见和旧案号：囚犯免死，${protagonist}承担仕途风险。`],
      endingHook: `${protagonist}守住这一笔，案卷合上，良知的余波留给更多人。`,
      endingHookType: 'final_echo',
      threadAction: payoffThreads
        ? `回收线索：${payoffThreads}，完成主题表达。`
        : '回收主线：拒签、复核和囚犯免死形成闭环。',
      continuityStateAfter: [
        `第${input.episodeNo}集后，${protagonist}完成拒签冤案的良知选择。`,
        '主要长期线索完成回收。',
      ],
    };
  }

  if (input.episodeNo === 2) {
    return {
      title: '第2集：召见之前',
      openingHook: `开场回应上一集“${input.previous?.ending_hook ?? '上官连夜召见'}”，让拒签后的代价立刻压到门前。`,
      mainConflict: `拒签后的上官压力逼近，${protagonist}必须把疑点变成能保护囚犯的复核行动。`,
      midpointTurn: '上官的话暴露出文书链条里有人急着掩住旧案，拒签从救一人变成追一条线。',
      newInformation: [
        '上官催签背后还有旧案号和文书链漏洞。',
        `拒签带来的官场代价落到${protagonist}身上，囚犯暂缓处决但仍未脱险。`,
      ],
      foreshadowing: ['旧案号上的名字被遮住，只露出能指向更高层施压者的一角。'],
      payoff: ['回收上集未签文书：囚犯暂缓处决，复核正式开始。'],
      endingHook: `${protagonist}可能因此丢官，仍把复核文书递出；旧案号上的名字露出一角。`,
      endingHookType: 'danger',
      threadAction: activeThread
        ? `推进线索：${activeThread.title}从拒签现场转入上官压力和正式复核。`
        : '推进线索：拒签现场转入上官压力和正式复核。',
      continuityStateAfter: [
        `第2集后，${protagonist}从拒签转入公开复核，并开始承担得罪上官的代价。`,
        `旧案号上的遮名成为第${Math.min(input.episodeNo + 1, input.episodeCount)}集必须回应的新问题。`,
      ],
    };
  }

  return {
    title: `第${input.episodeNo}集：旧案号追问`,
    openingHook: `承接上一集“${input.previous?.ending_hook ?? '旧案号露出一角'}”，把压力转入更深的文书链。`,
    mainConflict: `${protagonist}继续追问旧案号，却发现每追一步都会扩大拒签代价。`,
    midpointTurn: '新旧案卷在关键处互相咬合，说明问题不止一份判词。',
    newInformation: [
      `${input.focus || '旧案号'}牵出新的文书关联，${protagonist}原有判断必须升级。`,
      `推进${input.phase.phase_id}的阶段目标`,
    ],
    foreshadowing: [`${input.focus || '旧案号'}中留下未解释细节，指向下一集的选择。`],
    payoff: input.threadPayoffs.length > 0
      ? input.threadPayoffs.map(thread => `回收${thread.title}：${thread.description}`)
      : [],
    endingHook: `${protagonist}暂时守住复核方向，但新的传唤把更大压力推到门前。`,
    endingHookType: input.pacingProfile === 'slow_burn' ? 'emotional_question' : 'danger',
    threadAction: activeThread
      ? `推进线索：${activeThread.title}继续升温，但不提前回收。`
      : `维持${input.phase.phase_id}阶段线索清晰，避免新增无承接疑问。`,
    continuityStateAfter: [
      `第${input.episodeNo}集后，${protagonist}对“${input.coreTheme}”的理解推进到持续承担。`,
      input.episodeNo === input.episodeCount ? '主要长期线索完成回收' : `保留第${input.episodeNo + 1}集需要回应的旧案号压力。`,
    ],
  };
}

function findPhase(phases: AiComicSeriesPhase[], episodeNo: number): AiComicSeriesPhase {
  return phases.find(phase => episodeNo >= phase.episode_range[0] && episodeNo <= phase.episode_range[1]) ?? phases[0];
}

function chooseDuration(
  episodeNo: number,
  episodeCount: number,
  min: number,
  max: number,
  pacingProfile: AiComicPacingProfile,
): number {
  if (min === max) return min;
  const range = max - min;
  const progress = episodeCount <= 1 ? 1 : (episodeNo - 1) / (episodeCount - 1);
  const curve = pacingProfile === 'fast_hook'
    ? (episodeNo <= 3 ? 0.35 : 0.58)
    : pacingProfile === 'slow_burn'
      ? 0.35 + progress * 0.45
      : pacingProfile === 'mystery_cliffhanger'
        ? (episodeNo % 3 === 0 ? 0.82 : 0.52)
        : 0.5 + Math.sin(progress * Math.PI) * 0.25;
  return Math.round(min + range * Math.min(1, Math.max(0, curve)));
}

function chooseKnowledgeFocus(focus: string[], episodeNo: number): string {
  if (focus.length === 0) return '';
  return focus[(episodeNo - 1) % focus.length];
}

function chooseKeyCharacters(
  characters: AiComicSeriesCharacterArc[],
  episodeNo: number,
  premiseContract?: SeriesPremiseContract,
): string[] {
  const locked = premiseContract?.locked_characters
    .filter(character => character.required)
    .map(character => character.name) ?? [];
  const lead = characters[0]?.name;
  const rotating = characters.length > 1 ? characters[((episodeNo - 1) % (characters.length - 1)) + 1]?.name : undefined;
  return unique([...locked, lead, rotating].filter(Boolean) as string[]).slice(0, 4);
}

function buildEpisodeTitle(
  episodeNo: number,
  episodeCount: number,
  phase: AiComicSeriesPhase,
  coreTheme: string,
  focus: string,
): string {
  if (episodeNo === 1) return `第1集：${openingEpisodeTitle(coreTheme, focus)}`;
  if (episodeNo === episodeCount) return `第${episodeNo}集：${finalEpisodeTitle(coreTheme)}`;
  if (episodeNo === phase.episode_range[1]) {
    return `第${episodeNo}集：${episodeTitleFromPhaseTurn(phase.turning_point, coreTheme)}`;
  }
  return `第${episodeNo}集：${middleEpisodeTitle(coreTheme, focus)}`;
}

function openingEpisodeTitle(coreTheme: string, focus: string): string {
  if (/拒签|签/.test(coreTheme)) return '未签的案卷';
  const subject = summarizeText(focus || coreTheme, 6);
  return subject ? `${subject}入局` : '第一道疑问';
}

function finalEpisodeTitle(coreTheme: string): string {
  if (/拒签|签/.test(coreTheme)) return '良知落笔';
  const subject = summarizeText(coreTheme, 6);
  return subject ? `${subject}的答案` : '最后的回答';
}

function middleEpisodeTitle(coreTheme: string, focus: string): string {
  if (/拒签|签/.test(coreTheme)) {
    const subject = summarizeText(focus, 6);
    return subject ? `${subject}的证词` : '新证入卷';
  }
  const subject = summarizeText(focus || coreTheme, 6);
  return subject ? `${subject}转向` : '证据转向';
}

function episodeTitleFromPhaseTurn(turningPoint: string, coreTheme: string): string {
  if (/被迫做出第一次选择/.test(turningPoint)) return `${summarizeText(coreTheme, 6)}的第一次选择`;
  if (/表面目标背后还有更深层原因/.test(turningPoint)) return '文书背后的深因';
  if (/长期线索汇合/.test(turningPoint)) return '线索汇合';
  if (/重组行动方案/.test(turningPoint)) return '信念重组';
  return summarizeText(turningPoint.replace(/主角/g, '').replace(/[，。；;]+/g, ' '), 10) || `${summarizeText(coreTheme, 6)}转折`;
}

function buildConflict(episodeNo: number, episodeCount: number, coreTheme: string, focus: string): string {
  if (episodeNo === 1) return `主角第一次面对“${coreTheme}”带来的选择。`;
  if (episodeNo === episodeCount) return `主角必须用最终行动回答“${coreTheme}”。`;
  return focus
    ? `围绕${focus}的新信息，让主角原有判断出现偏差。`
    : `新的阻力让主角对“${coreTheme}”产生更具体的判断。`;
}

function buildEpisodeNewInformation(
  episodeNo: number,
  focus: string,
  coreTheme: string,
  outline: string,
): string {
  if (focus) {
    if (episodeNo === 1) return `${focus}相关的第一条可见线索进入案卷。`;
    return `${focus}相关的新证词让主角重新判断“${coreTheme}”。`;
  }
  if (episodeNo === 1) return `第一条可见线索进入案卷：${summarizeText(outline, 14)}。`;
  return `新的证词让主角重新判断“${coreTheme}”。`;
}

function buildOpeningHook(
  episodeNo: number,
  previous: AiComicEpisodePlan | undefined,
  coreTheme: string,
  focus: string,
  pacingProfile: AiComicPacingProfile,
): string {
  if (episodeNo === 1) {
    return focus
      ? `用${focus}的视觉细节开场，让主角第一次碰到“${coreTheme}”的问题。`
      : `用一个反常日常开场，让主角第一次碰到“${coreTheme}”的问题。`;
  }
  if (pacingProfile === 'fast_hook') {
    return `开场直接回应上一集结尾“${previous?.ending_hook ?? '上一集留下的选择'}”，并立刻给出新代价。`;
  }
  if (pacingProfile === 'mystery_cliffhanger') {
    return `开场先展示上一集钩子的结果，再保留一个尚未解释的关键细节。`;
  }
  return `开场承接上一集状态，让人物带着未完成的问题进入新场景。`;
}

function buildMidpointTurn(
  episodeNo: number,
  episodeCount: number,
  phase: AiComicSeriesPhase,
  focus: string,
  coreTheme: string,
): string {
  if (episodeNo === 1) return `主角发现“${coreTheme}”不是旁观问题，而是必须亲自选择。`;
  if (episodeNo === episodeCount) return `终局中段让主角看见最终代价，仍选择完成主题答案。`;
  if (episodeNo === phase.episode_range[1]) return `阶段转折落地：${phase.turning_point}`;
  return focus
    ? `${focus}带来的新信息推翻主角前半集判断，行动方向发生变化。`
    : `一个新证据让主角前半集判断改变，行动方向发生变化。`;
}

function buildForeshadowing(
  episodeNo: number,
  episodeCount: number,
  plotThreads: AiComicPlotThread[],
  focus: string,
): string[] {
  if (episodeNo >= episodeCount) return [];
  const futureThread = plotThreads.find(thread => thread.setup_episode <= episodeNo && thread.payoff_episode > episodeNo);
  const target = futureThread ? `第${futureThread.payoff_episode}集的${futureThread.title}` : `第${episodeNo + 1}集的选择`;
  return [focus ? `${focus}中出现一个未解释细节，指向${target}` : `留出一个未解释细节，指向${target}`];
}

function buildEndingHook(
  episodeNo: number,
  episodeCount: number,
  pacingProfile: AiComicPacingProfile,
  focus: string,
): string {
  if (episodeNo === episodeCount) return '主角完成选择，但留下可延展的情绪余波。';
  if (pacingProfile === 'mystery_cliffhanger') {
    return focus ? `${focus}出现反常细节，下一集必须解释。` : '关键细节突然改变，下一集必须解释。';
  }
  if (pacingProfile === 'fast_hook') {
    const focusLabel = naturalizeAiComicHookSubject(focus);
    const hooks = [
      `刚暂缓一纸死刑文书，${focusLabel}又牵出另一份被封存的案卷。`,
      `${focusLabel}改变了他的判断，却把下一道传唤推到门前。`,
      '主角守住这一笔，门外却传来下一卷案号被连夜送到。',
      '证物暂时保住一条命，但真正施压的人第一次露出名字。',
    ];
    return hooks[(episodeNo - 1) % hooks.length] ?? hooks[0];
  }
  if (pacingProfile === 'slow_burn') {
    return '一个细小变化被保留下来，下一集继续发酵。';
  }
  return '主角得到新信息，也失去一种原本确定的判断。';
}

function naturalizeAiComicHookSubject(focus: string): string {
  const text = focus.trim();
  if (!text) return '关键线索';
  if (/线索|证物|证词|案卷|封泥/.test(text)) return text;
  return `${text}相关线索`;
}

function inferEndingHookTypeFromPlan(
  episodeNo: number,
  episodeCount: number,
  pacingProfile: AiComicPacingProfile,
): AiComicEndingHookType {
  if (episodeNo === episodeCount) return 'final_echo';
  if (pacingProfile === 'mystery_cliffhanger') return 'reveal';
  if (pacingProfile === 'fast_hook') return 'danger';
  if (pacingProfile === 'slow_burn') return episodeNo % 2 === 0 ? 'emotional_question' : 'quiet_aftertaste';
  return episodeNo % 3 === 0 ? 'choice' : 'reveal';
}

function inferEndingHookType(
  episode: AiComicEpisodePlan,
  pacingProfile: AiComicPacingProfile,
): AiComicEndingHookType {
  if (episode.ending_hook_type) return episode.ending_hook_type;
  if (episode.ending_hook.includes('选择')) return 'choice';
  if (episode.ending_hook.includes('反常') || episode.ending_hook.includes('解释') || episode.ending_hook.includes('新信息')) return 'reveal';
  if (episode.ending_hook.includes('代价')) return 'danger';
  if (episode.ending_hook.includes('余波')) return 'final_echo';
  return pacingProfile === 'slow_burn' ? 'quiet_aftertaste' : 'emotional_question';
}

function hookTypeLabel(type: AiComicEndingHookType): string {
  const labels: Record<AiComicEndingHookType, string> = {
    choice: '选择钩子',
    reveal: '揭示钩子',
    danger: '代价钩子',
    emotional_question: '情绪疑问钩子',
    quiet_aftertaste: '余味钩子',
    final_echo: '终局回声',
  };
  return labels[type];
}

function buildThreadAction(
  episodeNo: number,
  plotThreads: AiComicPlotThread[],
  threadSetups: AiComicPlotThread[],
  threadPayoffs: AiComicPlotThread[],
  phase: AiComicSeriesPhase,
): string {
  if (threadSetups.length > 0) {
    return `打开线索：${threadSetups.map(thread => thread.title).join('、')}，并写入后续承接。`;
  }
  if (threadPayoffs.length > 0) {
    return `回收线索：${threadPayoffs.map(thread => thread.title).join('、')}，让阶段选择产生结果。`;
  }
  const active = plotThreads.find(thread => thread.setup_episode < episodeNo && thread.payoff_episode > episodeNo);
  return active
    ? `推进线索：${active.title}在${phase.phase_id}继续升温，但不提前回收。`
    : `维持${phase.phase_id}阶段线索清晰，避免新增无承接疑问。`;
}

function summarizeEpisodeThreadAction(plan: AiComicSeriesPlan, episode: AiComicEpisodePlan): string {
  const opened = plan.plot_threads.filter(thread => thread.setup_episode === episode.episode_no);
  const paid = plan.plot_threads.filter(thread => thread.payoff_episode === episode.episode_no);
  if (opened.length > 0 || paid.length > 0) {
    return [
      opened.length > 0 ? `打开：${opened.map(thread => thread.title).join('、')}` : '',
      paid.length > 0 ? `回收：${paid.map(thread => thread.title).join('、')}` : '',
    ].filter(Boolean).join('；');
  }
  if (episode.thread_action) return episode.thread_action;
  const active = plan.plot_threads.find(thread =>
    thread.setup_episode < episode.episode_no && thread.payoff_episode > episode.episode_no
  );
  return active ? `推进：${active.title}` : '保持既有线索状态，不额外增加未承接疑问';
}

function extractKnowledgeFocus(knowledgePack: KnowledgePack | undefined, detectedSubjects: string[], outline: string): string[] {
  const entries = [
    ...(knowledgePack?.primary_entries ?? []),
    ...(knowledgePack?.supporting_entries ?? []),
  ];
  const fromEntries = entries.flatMap(entry => [
    entry.entry_name.split('——')[0],
    entry.era,
    ...entry.keywords.slice(0, 2),
  ]);
  const outlineAnchors = [
    '皮影', '戏台', '机关谱', '影偶', '灯幕', '戏班', '公开演出', '拆迁',
    '唱腔', '锣鼓', '老街', '祖父', '修复', '非遗',
  ].filter(anchor => outline.includes(anchor));
  const fromOutline = [
    ...detectedSubjects,
    ...outlineAnchors,
    ...(detectedSubjects.length === 0 ? outline.split(/[，。；：！？\s]+/).filter(Boolean) : []),
  ];
  return unique([...fromEntries, ...fromOutline].filter((item): item is string => Boolean(item && item.length >= 2))).slice(0, 12);
}

function buildMotifs(knowledgeFocus: string[], emotions: string[]): string[] {
  return unique([
    ...knowledgeFocus.slice(0, 3).map(item => `${item}的可视化符号`),
    ...emotions.slice(0, 2).map(item => `${item}的色彩和表情节奏`),
    '每阶段重复出现但含义变化的关键物件',
  ]);
}

function summarizeText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, '').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function resolveAiComicNarrativePatternIds(
  plan: AiComicSeriesPlan,
  overridePatternIds?: NarrativePatternId[],
): NarrativePatternId[] {
  return overridePatternIds ?? plan.narrative_pattern_ids ?? [];
}

function narrativePatternLabels(patternIds: NarrativePatternId[]): string[] {
  return getNarrativePatternsForVideoType('ai_comic_drama', patternIds)
    .map(pattern => pattern.label);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
