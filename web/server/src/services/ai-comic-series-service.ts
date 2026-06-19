// web/server/src/services/ai-comic-series-service.ts — AI comic series planning

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { ErrorCodes, success, fail } from '@shared/types.js';
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
  AiComicSeedanceAssetLibraryItem,
  AiComicSeedanceAssetLibraryUpdateRequest,
  AiComicSeedanceAudioLibrary,
  AiComicSeedanceAudioLibraryUpdateRequest,
  AiComicSeedanceAudioMixLedger,
  AiComicSeedanceAudioMixProfile,
  AiComicSeedanceAudioMixRequest,
  AiComicSeedanceThumbnailCaptureRequest,
  AiComicSeedanceThumbnailCaptureResultShot,
  AiComicSeedanceThumbnailStatus,
  AiComicSeedanceSubtitleExportRequest,
  AiComicSeedanceSubtitleRenderLedger,
  AiComicSeedanceSubtitleRenderMode,
  AiComicSeedanceSubtitleRenderRequest,
  AiComicSeedanceVideoVersion,
  AiComicSeedanceCutPackageEpisode,
  AiComicSeedanceRetryPackageEpisode,
  AiComicSeriesSeedanceCutPackage,
  AiComicSeedanceCutAssemblyLedger,
  AiComicSeedanceCutAssemblyRequest,
  AiComicSeriesSeedanceRetryPackage,
  AiComicSeriesSeedanceAssetReportPackage,
  AiComicSeriesSeedanceEditAssetPackage,
  AiComicSeedanceEditAssetPackageEpisode,
  AiComicSeriesSeedanceThumbnailPlanPackage,
  AiComicSeriesSeedanceThumbnailCaptureResult,
  AiComicSeriesSeedanceCutAssemblyResult,
  AiComicSeriesSeedanceSubtitlePackage,
  AiComicSeriesSeedanceSubtitleRenderResult,
  AiComicSeriesSeedanceAudioMixResult,
  AiComicSeriesSeedanceAudioPlanPackage,
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
  AiComicSeriesSeedanceEpisodePackage,
  AiComicSeriesSeedanceExportPackage,
  AiComicSeriesCharacterArc,
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
  KnowledgeNeed,
  KnowledgePack,
  NarrativePatternId,
  SeedancePromptShotUnit,
  StoryDetectedCharacter,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { analyzeOutline, multiMatchEntries } from './outline-service.js';
import { generateAndStoreStory, getStory } from './story-service.js';
import {
  getNarrativePatternRequirementLines,
  getNarrativePatternsForVideoType,
} from './narrative-pattern-library.js';
import { buildSeedancePromptPackage } from './seedance-prompt-service.js';

const PACING_LABELS: Record<AiComicPacingProfile, string> = {
  fast_hook: '强钩子快节奏',
  balanced_drama: '均衡剧情推进',
  slow_burn: '慢热铺陈',
  mystery_cliffhanger: '悬念钩子',
};

const PHASE_TEMPLATES = [
  { id: 'phase-1', purpose: '建立主角目标、世界规则和核心问题', turning_point: '主角被迫做出第一次选择' },
  { id: 'phase-2', purpose: '扩大人物关系和文化背景，让主线矛盾具体化', turning_point: '主角发现表面目标背后还有更深层原因' },
  { id: 'phase-3', purpose: '连续推进代价、误解和关键线索', turning_point: '长期线索汇合，主角失去原有依靠' },
  { id: 'phase-4', purpose: '集中处理反转、牺牲和价值选择', turning_point: '主角以新的信念重组行动方案' },
  { id: 'phase-5', purpose: '回收主要伏笔，完成主题表达并留下余味', turning_point: '主角完成最终选择，世界关系发生改变' },
];

type StoredAiComicSeriesProject = AiComicSeriesProjectDetail;
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
  outputPath: string;
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
  const detectedCharacters = mergeCharacters(
    request.character_hints ?? [],
    analysis.data?.detected_characters ?? [],
  );
  const knowledgeFocus = extractKnowledgeFocus(request.knowledge_pack, analysis.data?.detected_subjects ?? [], outline);
  const seriesTitle = request.series_title?.trim() || deriveSeriesTitle(outline, storyIntent?.main_character ?? null);
  const pacingProfile = request.pacing_profile ?? 'balanced_drama';
  const generationScope = request.generation_scope ?? 'full_planning';
  const narrativePatternIds = request.narrative_pattern_ids ?? [];
  const phases = buildPhases(request.episode_count);
  const mainCharacters = buildCharacterArcs(detectedCharacters, request.episode_count, storyIntent?.main_character ?? null);
  const plotThreads = buildPlotThreads(request.episode_count, seriesTitle, knowledgeFocus, pacingProfile);
  const seriesSpine = buildSeriesSpine({
    phases,
    plotThreads,
    coreTheme: storyIntent?.core_theme ?? summarizeText(outline, 18),
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
    coreTheme: storyIntent?.core_theme ?? summarizeText(outline, 18),
    pacingProfile,
  });

  return success({
    schema_version: 'ai-comic-series-plan/v1',
    series_title: seriesTitle,
    episode_count: request.episode_count,
    episode_duration_range_sec: request.episode_duration_range_sec,
    pacing_profile: pacingProfile,
    generation_scope: generationScope,
    narrative_pattern_ids: narrativePatternIds.length > 0 ? narrativePatternIds : undefined,
    premise: outline,
    logline: buildLogline(seriesTitle, outline, storyIntent?.core_theme),
    core_theme: storyIntent?.core_theme ?? summarizeText(outline, 24),
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
        description: '知识库明确内容作为事实依据，戏剧化补足内容需要保持可辨识的创作边界；知识库不是资料仓库，必须按条目角色、关系、用途和可信度做生成决策。',
      },
      {
        rule_id: 'rule-episode-memory',
        label: '单集记忆输入',
        description: '生成某一集分镜前，需要带入上一集结尾、当前阶段目标、未回收线索和角色当前状态。',
      },
      {
        rule_id: 'rule-narrative-patterns',
        label: '流派机制一致',
        description: narrativePatternIds.length > 0
          ? `系列全程强化：${narrativePatternLabels(narrativePatternIds).join('、')}。每集需要把流派机制转成冲突、选择、钩子和回收。`
          : '默认按 AI 漫剧流派机制组织强钩子、对白冲突、反转和追看问题。',
      },
    ],
    recurring_motifs: buildMotifs(knowledgeFocus, storyIntent?.target_emotion ?? []),
    production_notes: [
      `单集建议按 ${request.episode_duration_range_sec.min}-${request.episode_duration_range_sec.max} 秒规划，实际成片以分镜、对白密度和配音语速复核。`,
      '先审核系列规划，再逐集生成完整分镜；长系列不建议一次生成全部剧本文本。',
      '每集生成后应更新连续性状态，再进入下一集，保持人物选择、线索和情绪曲线前后相连。',
      '知识条目要被转成角色状态、线索、场景资产、时代边界和风险提示，不要把资料摘要直接堆进对白或旁白。',
      ...getNarrativePatternRequirementLines('ai_comic_drama', narrativePatternIds).map(line => `流派机制：${line}`),
    ],
  });
}

export async function generateAiComicEpisodeFromPlan(
  request: AiComicEpisodeGenerateRequest,
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

  const knowledgePack = request.knowledge_pack ?? await buildKnowledgePackForSeries(plan);
  if (knowledgePack.primary_entries.length === 0) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'No primary knowledge entry was found for this series. Add a knowledge_pack before generating an episode.',
    );
  }

  const narrativePatternIds = resolveAiComicNarrativePatternIds(plan, request.narrative_pattern_ids);
  const memoryRecallControls = mergeMemoryRecallControls(
    existingProject?.memory_recall_preferences,
    request.memory_recall_controls,
    episode.episode_no,
  );
  const episodeOutline = buildEpisodeGenerationOutline(
    plan,
    episode,
    continuityLedger,
    narrativePatternIds,
    memoryRecallControls,
  );
  return generateAndStoreStory({
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
    knowledge_pack: knowledgePack,
    character_hints: buildEpisodeCharacterHints(plan, episode),
    narrative_pattern_ids: narrativePatternIds.length > 0 ? narrativePatternIds : undefined,
    auto_repair: request.auto_repair_episode ?? false,
  }).then(async result => {
    if (!result.ok || !result.data) return result;

    const enrichedStory = request.auto_audit_continuity === false
      ? result.data
      : attachAiComicEpisodeReports({
          story: result.data,
          plan,
          episode,
          ledger: continuityLedger,
        });

    if (request.series_project_id) {
      await recordGeneratedEpisodeStory({
        seriesProjectId: request.series_project_id,
        plan,
        episode,
        story: enrichedStory,
      });
    }

    return success(enrichedStory);
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
    `- 已用知识: ${pkg.continuity_ledger.knowledge_used.join('、') || '暂无'}`,
    '',
    '## 系列记忆引擎',
    `- 结构化记忆: ${pkg.continuity_ledger.series_memory ? '已启用' : '未启用'}`,
    `- 待核冲突: ${pkg.continuity_ledger.series_memory?.conflicts.join('；') || '无'}`,
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
        `- 知识焦点: ${blueprint.knowledge_focus.join('、') || '无'}`,
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
        `- 失败原因: ${shot.failure_reason ?? '未记录'}`,
        `- 重试次数: ${shot.retry_count}`,
        `- 上次 job: ${shot.provider_job_id ?? '未记录'}`,
        `- 建议动作: ${shot.suggested_action}`,
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
    '',
    '## 素材清单',
    ...markdownTable(
      ['类型', '素材', '引用槽位', '状态', '使用镜头数', '说明'],
      pkg.assets.map(asset => [
        seedanceAssetKindText(asset.kind),
        asset.label,
        asset.reference_slot ?? '缺少',
        seedanceAssetStatusText(asset.status),
        String(asset.required_by_shot_count),
        asset.description ?? '未记录',
      ]),
    ),
    '',
    '## 镜头绑定',
    ...markdownTable(
      ['集数', '镜头', '人物', '场景', '引用槽位', '缺口'],
      pkg.shots.map(shot => [
        `第${shot.episode_no}集`,
        shot.shot_id,
        shot.characters.join('、') || '未指定',
        shot.location,
        shot.reference_slots.join('、') || '无',
        shot.missing_reference_asset_ids.length ? shot.missing_reference_asset_ids.join('、') : '无',
      ]),
    ),
  ];
  return lines.join('\n');
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
    usage: episodeNos.size > 0 ? '分集知识焦点' : '连续性账本已用知识',
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
): Promise<ApiResponse<AiComicSeriesProjectDetail>> {
  const now = new Date().toISOString();
  const seriesProjectId = request.series_project_id ?? generateSeriesProjectId();
  const existing = request.series_project_id ? await readSeriesProject(seriesProjectId) : null;
  const generatedEpisodeStoryIds = {
    ...(existing?.generated_episode_story_ids ?? {}),
    ...(request.generated_episode_story_ids ?? {}),
  };
  const continuityLedger = normalizeContinuityLedger(
    request.continuity_ledger ?? existing?.continuity_ledger,
    request.plan,
  );
  const memoryRecallPreferences = normalizeMemoryRecallPreferences(
    request.memory_recall_preferences ?? existing?.memory_recall_preferences,
    now,
  );

  const detail: AiComicSeriesProjectDetail = {
    project: buildSeriesProjectMeta({
      seriesProjectId,
      plan: request.plan,
      createdAt: existing?.project.created_at ?? now,
      updatedAt: now,
      generatedEpisodeStoryIds,
      archivedAt: existing?.project.archived_at,
    }),
    plan: request.plan,
    generated_episode_story_ids: generatedEpisodeStoryIds,
    continuity_ledger: continuityLedger,
    memory_recall_preferences: memoryRecallPreferences,
    seedance_production: normalizeSeedanceProductionLedger(existing?.seedance_production),
    seedance_asset_library: cloneSeedanceAssetLibrary(existing?.seedance_asset_library),
    seedance_cut_assembly: cloneSeedanceCutAssemblyLedger(existing?.seedance_cut_assembly),
    seedance_subtitle_render: cloneSeedanceSubtitleRenderLedger(existing?.seedance_subtitle_render),
    seedance_audio_library: cloneSeedanceAudioLibrary(existing?.seedance_audio_library),
    seedance_audio_mix: cloneSeedanceAudioMixLedger(existing?.seedance_audio_mix),
  };
  detail.series_quality_audit = buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds,
    ledger: continuityLedger,
    previousAudit: existing?.series_quality_audit,
  });

  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
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
    }),
    continuity_ledger: continuityLedger,
  };
  detail.series_quality_audit = buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids,
    ledger: continuityLedger,
    previousAudit: existing.series_quality_audit,
  });

  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
  return success(detail);
}

export async function listAiComicSeriesProjects(
  options: { includeArchived?: boolean } = {},
): Promise<ApiResponse<AiComicSeriesProjectMeta[]>> {
  let projectIds: string[];
  try {
    projectIds = await readdir(seriesProjectsRoot());
  } catch {
    return success([]);
  }

  const projects: AiComicSeriesProjectMeta[] = [];
  for (const projectId of projectIds) {
    const detail = await readSeriesProject(projectId);
    if (detail && (options.includeArchived || !detail.project.archived_at)) projects.push(detail.project);
  }

  projects.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return success(projects);
}

export async function copyAiComicSeriesProject(
  seriesProjectId: string,
  request: AiComicSeriesProjectCopyRequest = {},
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
    seedance_production: cloneSeedanceProductionLedger(existing.seedance_production),
    seedance_asset_library: cloneSeedanceAssetLibrary(existing.seedance_asset_library),
    seedance_cut_assembly: cloneSeedanceCutAssemblyLedger(existing.seedance_cut_assembly),
    seedance_subtitle_render: cloneSeedanceSubtitleRenderLedger(existing.seedance_subtitle_render),
    seedance_audio_library: cloneSeedanceAudioLibrary(existing.seedance_audio_library),
    seedance_audio_mix: cloneSeedanceAudioMixLedger(existing.seedance_audio_mix),
  };
  detail.series_quality_audit = buildAiComicSeriesQualityAudit({
    plan: detail.plan,
    generatedEpisodeStoryIds: detail.generated_episode_story_ids,
    ledger: detail.continuity_ledger,
    previousAudit: detail.series_quality_audit,
  });

  await writeJsonFile(seriesProjectPath(newSeriesProjectId), detail);
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
    }),
  };

  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
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
  const pkg: AiComicSeriesBibleExportPackage = {
    schema_version: 'ai-comic-series-bible-export/v1',
    exported_at: exportedAt,
    project: detail.project,
    plan: detail.plan,
    generated_episode_story_ids: detail.generated_episode_story_ids,
    continuity_ledger: detail.continuity_ledger,
    series_quality_audit: seriesQualityAudit,
    episode_blueprints: episodeBlueprints,
    production_tables: productionTables,
    markdown: '',
  };
  return success({
    ...pkg,
    markdown: buildAiComicSeriesBibleMarkdown(pkg),
  });
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
  await writeJsonFile(seriesProjectPath(seriesProjectId), updatedDetail);
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

export async function updateAiComicSeriesSeedanceProductionStatuses(
  seriesProjectId: string,
  request: AiComicSeedanceProductionBatchUpdateRequest,
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

  const now = new Date().toISOString();
  const ledger = request.updates.reduce((currentLedger, update) => {
    const episode = episodeMap.get(update.episode_no)!;
    return updateSeedanceProductionLedger({
      ledger: currentLedger,
      episodeTitle: episode.title,
      storyId: existing.generated_episode_story_ids[String(update.episode_no)],
      request: update,
      updatedAt: now,
    });
  }, existing.seedance_production);
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: now,
    },
    seedance_production: ledger,
  };
  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
  return success(detail);
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
  return updateAiComicSeriesSeedanceProductionStatus(seriesProjectId, {
    episode_no: episodeNo,
    shot_id: shotId,
    status,
    provider_job_id: providerJobId,
    video_url: videoUrl,
    failure_reason: failureReason,
    note: callbackStringField(request.note)
      ?? callbackMessage
      ?? `Seedance 外部回调：${seedanceProductionStatusText(status)}`,
    quality_score: callbackNumberField(request.quality_score ?? request.qualityScore),
    review_note: callbackStringField(request.review_note ?? request.reviewNote),
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
  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
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
  const detail: AiComicSeriesProjectDetail = {
    ...existing,
    project: {
      ...existing.project,
      updated_at: selectedCount > 0 ? updatedAt : existing.project.updated_at,
    },
    seedance_production: {
      schema_version: 'ai-comic-seedance-production-ledger/v1',
      updated_at: selectedCount > 0 ? updatedAt : ledger.updated_at,
      items: nextItems,
    },
  };
  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
  return success(detail);
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
    byId.set(assetId, {
      asset_id: assetId,
      kind: item.kind,
      label,
      reference_slot: item.reference_slot?.trim() || previous?.reference_slot,
      file_url: item.file_url?.trim() || previous?.file_url,
      file_id: item.file_id?.trim() || previous?.file_id,
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
  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
  return success(detail);
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
  await writeJsonFile(seriesProjectPath(seriesProjectId), detail);
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
  const episodeMap = new Map(detail.plan.episodes.map(episode => [episode.episode_no, episode]));
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
  const absoluteOutputPath = resolveSeedanceProjectOutputPath(projectDir, outputPath);
  const absoluteConcatListPath = resolveSeedanceProjectOutputPath(projectDir, concatListPath);
  const ffmpegCommand = buildFfmpegCutAssemblyCommand(ffmpegPath, concatListPath, outputPath, profile);
  const alreadyReady = !overwrite && await pathExists(absoluteOutputPath);
  let status: AiComicSeriesSeedanceCutAssemblyResult['status'] = dryRun ? 'planned' : 'assembled';
  let failureReason: string | undefined;

  try {
    await mkdir(dirname(absoluteConcatListPath), { recursive: true });
    await writeFile(
      absoluteConcatListPath,
      `${shots.map(shot => ffmpegConcatFileLine(shot.video_url)).join('\n')}\n`,
      'utf-8',
    );
    if (alreadyReady) {
      status = 'skipped';
    } else if (!dryRun) {
      await mkdir(dirname(absoluteOutputPath), { recursive: true });
      await runner({
        ffmpegPath,
        concatListPath: absoluteConcatListPath,
        outputPath: absoluteOutputPath,
        profile,
      });
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
  await writeJsonFile(seriesProjectPath(seriesProjectId), updatedDetail);

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
        if (!shouldRetrySeedanceProductionItem(item)) return null;
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
          suggested_action: seedanceRetrySuggestedAction(item),
          prompt: unit,
        };
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
    .filter(item => shouldRetrySeedanceProductionItem(item))
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
    episodes: retryEpisodes,
    skipped_ready_shot_count: ledger.items.filter(item => item.status === 'ready' && Boolean(item.video_url)).length,
    missing_prompt_shots: missingPromptShots,
  };
  return success({
    ...basePackage,
    markdown: buildAiComicSeriesSeedanceRetryMarkdown(basePackage),
  });
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
        missing_reference_asset_ids: unique(missingReferenceAssetIds),
        reference_slots: unique(requiredAssets.flatMap(asset => asset.reference_slot ? [asset.reference_slot] : [])),
        prompt_preview: summarizeText(unit.seedance_prompt, 120),
      });
    }
  }

  const exportedAt = new Date().toISOString();
  const assetList = [...assets.values()]
    .map(asset => ({
      ...asset,
      source_episode_nos: [...new Set(asset.source_episode_nos)].sort((a, b) => a - b),
      source_shot_ids: unique(asset.source_shot_ids),
      required_by_shot_count: unique(asset.source_shot_ids).length,
    }))
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
    assets: assetList,
    shots: shots.sort((a, b) => {
      if (a.episode_no !== b.episode_no) return a.episode_no - b.episode_no;
      return compareSeedanceShotIds(a.shot_id, b.shot_id);
    }),
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

  const titleCards = buildSeedanceFinishingTitleCards(detail, cutPackage.episodes.map(episode => episode.episode_no));
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
  const selectedCues = finishingPlan.subtitle_cues
    .filter(cue => request.episode_no === undefined || cue.episode_no === request.episode_no)
    .sort((a, b) => a.start_sec - b.start_sec || a.end_sec - b.end_sec || a.cue_id.localeCompare(b.cue_id));
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
  const absoluteBurnInOutputPath = resolveSeedanceProjectOutputPath(projectDir, burnInOutputPath);
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
  const targetPath = mode === 'sidecar' ? absoluteSrtPath : absoluteBurnInOutputPath;
  let status: AiComicSeriesSeedanceSubtitleRenderResult['status'] = dryRun ? 'planned' : 'rendered';
  let failureReason: string | undefined;

  try {
    const alreadyReady = !overwrite && !dryRun && await pathExists(targetPath);
    if (alreadyReady) {
      status = 'skipped';
    } else if (!dryRun) {
      await mkdir(dirname(absoluteSrtPath), { recursive: true });
      await writeFile(absoluteSrtPath, subtitlePackage.srt_content, 'utf-8');
      if (mode === 'burn_in') {
        if (!sourceCutOutputPath || !absoluteInputVideoPath) {
          throw new Error('Burn-in subtitle render requires a Seedance cut output or input_video_path');
        }
        await mkdir(dirname(absoluteBurnInOutputPath), { recursive: true });
        await runner({
          ffmpegPath,
          inputVideoPath: absoluteInputVideoPath,
          subtitlePath: absoluteSrtPath,
          outputPath: absoluteBurnInOutputPath,
        });
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
  await writeJsonFile(seriesProjectPath(seriesProjectId), updatedDetail);

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
  const dryRun = request.dry_run ?? true;
  const overwrite = request.overwrite ?? false;
  const executedAt = new Date().toISOString();
  const sourceVideoPath = request.input_video_path
    ?? seedanceAudioMixDefaultInputPath(detail);
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
  let absoluteInputVideoPath: string;
  let absoluteOutputPath: string;
  try {
    absoluteInputVideoPath = resolveSeedanceProjectOutputPath(projectDir, sourceVideoPath);
    absoluteOutputPath = resolveSeedanceProjectOutputPath(projectDir, outputPath);
  } catch (err) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      err instanceof Error ? err.message : String(err),
    );
  }

  const audioInputs = audioPlanRes.data.audio_cues
    .filter(cue => request.episode_no === undefined || cue.episode_no === request.episode_no)
    .filter(cue => cue.asset_status === 'bound')
    .map(cue => ({
      input_path: cue.file_url ?? cue.file_id!,
      start_sec: cue.start_sec,
      end_sec: cue.end_sec,
      volume_db: seedanceAudioProfileVolume(cue.volume_db, cue.kind, audioProfile),
      fade_in_sec: cue.fade_in_sec,
      fade_out_sec: cue.fade_out_sec,
    }));
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const ffmpegCommand = buildFfmpegAudioMixCommand(ffmpegPath, sourceVideoPath, audioInputs, outputPath);
  const runner = options.runner ?? runFfmpegAudioMix;
  let status: AiComicSeriesSeedanceAudioMixResult['status'] = dryRun ? 'planned' : 'mixed';
  let failureReason: string | undefined;

  try {
    const alreadyReady = !overwrite && !dryRun && await pathExists(absoluteOutputPath);
    if (alreadyReady) {
      status = 'skipped';
    } else if (!dryRun) {
      if (audioInputs.length === 0) {
        throw new Error('No bound audio assets are available for audio mix');
      }
      await mkdir(dirname(absoluteOutputPath), { recursive: true });
      await runner({
        ffmpegPath,
        inputVideoPath: absoluteInputVideoPath,
        audioInputs,
        outputPath: absoluteOutputPath,
      });
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
    output_path: outputPath,
    output_filename: outputFilename,
    input_video_path: sourceVideoPath,
    ffmpeg_command: ffmpegCommand,
    mixed_at: status === 'mixed' ? executedAt : detail.seedance_audio_mix?.mixed_at,
    failure_reason: failureReason,
    dry_run: dryRun,
    audio_profile: audioProfile,
    source_audio_count: audioInputs.length,
    missing_audio_count: audioPlanRes.data.missing_audio_count,
  };
  const updatedDetail: AiComicSeriesProjectDetail = {
    ...detail,
    project: {
      ...detail.project,
      updated_at: executedAt,
    },
    seedance_audio_mix: mixLedger,
  };
  await writeJsonFile(seriesProjectPath(seriesProjectId), updatedDetail);

  return success({
    schema_version: 'ai-comic-series-seedance-audio-mix-result/v1',
    project: updatedDetail.project,
    series_title: updatedDetail.plan.series_title,
    executed_at: executedAt,
    dry_run: dryRun,
    status,
    output_path: outputPath,
    output_filename: outputFilename,
    input_video_path: sourceVideoPath,
    ffmpeg_command: ffmpegCommand,
    audio_profile: audioProfile,
    source_audio_count: audioInputs.length,
    missing_audio_count: audioPlanRes.data.missing_audio_count,
    failure_reason: failureReason,
    seedance_audio_mix: mixLedger,
  });
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
  const plannedShots = planRes.data.episodes
    .flatMap(episode => episode.shots)
    .filter(shot => request.episode_no === undefined || shot.episode_no === request.episode_no)
    .filter(shot => request.shot_id === undefined || shot.shot_id === request.shot_id)
    .slice(0, request.limit);

  const ledger = normalizeSeedanceProductionLedger(detail.seedance_production);
  const ledgerMap = new Map(ledger.items.map(item => [item.production_id, item]));
  const resultShots: AiComicSeedanceThumbnailCaptureResultShot[] = [];

  for (const shot of plannedShots) {
    const outputPath = resolveSeedanceThumbnailOutputPath(projectDir, shot.output_path);
    const existingItem = ledgerMap.get(shot.production_id);
    const existingThumbnail = existingItem?.thumbnail;
    const alreadyReady = existingThumbnail?.status === 'ready'
      && existingThumbnail.output_path === shot.output_path
      && !overwrite
      && await pathExists(outputPath);
    let status: AiComicSeedanceThumbnailCaptureResultShot['status'] = dryRun ? 'planned' : 'captured';
    let failureReason: string | undefined;
    let skippedReason: string | undefined;

    try {
      if (alreadyReady) {
        status = 'skipped';
        skippedReason = '缩略图已存在，未启用覆盖';
      } else if (!dryRun) {
        await mkdir(dirname(outputPath), { recursive: true });
        await runner({
          ffmpegPath,
          videoUrl: shot.video_url,
          outputPath,
          captureTimeSec: shot.capture_time_sec,
        });
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
  await writeJsonFile(seriesProjectPath(seriesProjectId), updatedDetail);

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
  await writeJsonFile(seriesProjectPath(params.seriesProjectId), detail);
}

function buildAiComicSeriesQualityAudit(params: {
  plan: AiComicSeriesPlan;
  generatedEpisodeStoryIds: Record<string, string>;
  ledger: AiComicContinuityLedger;
  previousAudit?: AiComicSeriesQualityAudit;
  latestStory?: StoryGenerateResult;
  latestEpisodeNo?: number;
}): AiComicSeriesQualityAudit {
  const planEpisodeNumbers = new Set(params.plan.episodes.map(episode => episode.episode_no));
  const generatedEntries = Object.entries(params.generatedEpisodeStoryIds)
    .map(([episodeNo, storyId]) => ({ episodeNo: Number(episodeNo), storyId }))
    .filter(entry => Number.isInteger(entry.episodeNo));
  const generatedEpisodeNumbers = new Set(generatedEntries.map(entry => entry.episodeNo));
  const generatedIdsInPlanRange = generatedEntries.every(entry => planEpisodeNumbers.has(entry.episodeNo));
  const ledgerRecordsByEpisode = new Map(params.ledger.episode_records.map(record => [record.episode_no, record]));
  const previousReports = new Map(
    (params.previousAudit?.episode_reports ?? []).map(report => [report.episode_no, report]),
  );
  const latestQuality = params.latestStory?.ai_comic_episode_quality;
  const latestContinuity = params.latestStory?.continuity_audit;

  const episodeReports: AiComicSeriesQualityEpisodeReport[] = params.plan.episodes.map(episode => {
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
    const issues = latestMatches
      ? unique([
          ...latestQuality.issues,
          ...(latestContinuity?.issues ?? []),
      ])
      : previousStillMatches
        ? previous.issues.filter(issue => !issue.includes('分集卡片已在生成后变更'))
        : ['本集缺少可追溯质量报告，建议重新生成或重新保存后复核'];
    if (planChangedAfterGeneration) {
      issues.push('本集分集卡片已在生成后变更，建议重新生成本集并重建后续账本');
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
            previous.needs_episode_regeneration === true
            && !planChangedAfterGeneration
            && issues.length === 0
            && (previous.score ?? 0) >= 80
          )
        : false;

    return {
      episode_no: episode.episode_no,
      story_id: storyId,
      status: planChangedAfterGeneration
        ? 'needs_attention'
        : latestMatches || previousStillMatches
          ? passed ? 'passed' : 'needs_attention'
        : 'unknown',
      score,
      issues,
      plan_changed_after_generation: planChangedAfterGeneration,
      needs_episode_regeneration: planChangedAfterGeneration,
      needs_ledger_rebuild: planChangedAfterGeneration,
    };
  });

  const allEpisodesGenerated = params.plan.episodes.every(episode =>
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
    && threadClosureReport.duplicate_thread_count === 0
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
  if (threadClosureReport.duplicate_thread_count > 0) {
    issues.push(`${threadClosureReport.duplicate_thread_count} 组伏笔重复出现但缺少推进变化`);
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

function buildAiComicThreadClosureReport(params: {
  plan: AiComicSeriesPlan;
  generatedEpisodeNumbers: Set<number>;
  ledger: AiComicContinuityLedger;
}): AiComicThreadClosureReport {
  const ledgerRecordsByEpisode = new Map(params.ledger.episode_records.map(record => [record.episode_no, record]));
  const lastGeneratedEpisodeNo = Math.max(
    params.ledger.last_generated_episode_no ?? 0,
    ...[...params.generatedEpisodeNumbers, 0],
  );
  const items: AiComicThreadClosureItem[] = params.plan.plot_threads.map(thread => {
    const openedInEpisodes = params.plan.episodes
      .filter(episode => params.generatedEpisodeNumbers.has(episode.episode_no))
      .filter(episode => episodeMentionsThread(episode, ledgerRecordsByEpisode.get(episode.episode_no), thread, 'open'))
      .map(episode => episode.episode_no);
    const paidOffInEpisodes = params.plan.episodes
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
    if (item.category === 'knowledge_boundary' && /待核|未核|创作补足|传说|推测/.test(text) && /确证|史实|真实|一定|明确/.test(text)) {
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
    ? [...episode.payoff, episode.thread_action ?? '']
    : [...episode.foreshadowing, ...episode.new_information, episode.thread_action ?? ''];
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
  for (const episode of plan.episodes) {
    if (!generatedEpisodeNumbers.has(episode.episode_no)) continue;
    for (const [index, text] of episode.foreshadowing.entries()) {
      if (plan.plot_threads.some(thread => textReferencesThread(text, thread))) continue;
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
  for (const episode of plan.episodes) {
    if (!generatedEpisodeNumbers.has(episode.episode_no)) continue;
    for (const text of episode.foreshadowing) {
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
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || resolve(kbRoot(), '..', 'web', 'generated');
}

function seriesProjectsRoot(): string {
  return resolve(generatedRoot(), 'ai-comic-series-projects');
}

function seriesProjectPath(seriesProjectId: string): string {
  return resolve(seriesProjectsRoot(), seriesProjectId, 'project.json');
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

async function readSeriesProject(seriesProjectId: string): Promise<StoredAiComicSeriesProject | null> {
  const filePath = seriesProjectPath(seriesProjectId);
  if (!(await pathExists(filePath))) return null;
  const detail = await readJsonFile<StoredAiComicSeriesProject>(filePath);
  const continuityLedger = normalizeContinuityLedger(detail.continuity_ledger, detail.plan);
  return {
    ...detail,
    continuity_ledger: continuityLedger,
    memory_recall_preferences: normalizeMemoryRecallPreferences(detail.memory_recall_preferences),
    seedance_production: normalizeSeedanceProductionLedger(detail.seedance_production),
    seedance_asset_library: cloneSeedanceAssetLibrary(detail.seedance_asset_library),
    seedance_cut_assembly: cloneSeedanceCutAssemblyLedger(detail.seedance_cut_assembly),
    seedance_subtitle_render: cloneSeedanceSubtitleRenderLedger(detail.seedance_subtitle_render),
    seedance_audio_library: cloneSeedanceAudioLibrary(detail.seedance_audio_library),
    seedance_audio_mix: cloneSeedanceAudioMixLedger(detail.seedance_audio_mix),
    series_quality_audit: detail.series_quality_audit ?? buildAiComicSeriesQualityAudit({
      plan: detail.plan,
      generatedEpisodeStoryIds: detail.generated_episode_story_ids ?? {},
      ledger: continuityLedger,
    }),
  };
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
  };
  if (params.archivedAt) meta.archived_at = params.archivedAt;
  return meta;
}

function buildInitialContinuityLedger(plan: AiComicSeriesPlan): AiComicContinuityLedger {
  return {
    schema_version: 'ai-comic-continuity-ledger/v1',
    character_state_current: plan.main_characters.map(character =>
      `${character.name}：${character.starting_state}`,
    ),
    open_threads: plan.plot_threads
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
  return {
    schema_version: 'ai-comic-seedance-production-ledger/v1',
    updated_at: ledger?.updated_at,
    items: (ledger?.items ?? []).map(item => ({
      ...item,
      retry_count: item.retry_count ?? 0,
      notes: [...(item.notes ?? [])],
      versions: normalizeSeedanceVideoVersions(item),
      selected_version_id: item.selected_version_id,
    })),
  };
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
    items: normalized.items.map(item => ({ ...item })),
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
    output_path: ledger.output_path,
    output_filename: ledger.output_filename,
    input_video_path: ledger.input_video_path,
    ffmpeg_command: ledger.ffmpeg_command,
    mixed_at: ledger.mixed_at,
    failure_reason: ledger.failure_reason,
    dry_run: ledger.dry_run,
    audio_profile: ledger.audio_profile ?? 'balanced_dialogue',
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

function updateSeedanceProductionLedger(params: {
  ledger?: AiComicSeedanceProductionLedger;
  episodeTitle: string;
  storyId?: string;
  request: AiComicSeedanceProductionStatusUpdateRequest;
  updatedAt: string;
}): AiComicSeedanceProductionLedger {
  const ledger = normalizeSeedanceProductionLedger(params.ledger);
  const productionId = seedanceProductionId(params.request.episode_no, params.request.shot_id);
  const existing = ledger.items.find(item => item.production_id === productionId);
  const versions = appendSeedanceVideoVersion({
    existing,
    request: params.request,
    updatedAt: params.updatedAt,
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
  return {
    schema_version: 'ai-comic-seedance-production-ledger/v1',
    updated_at: params.updatedAt,
    items,
  };
}

function normalizeSeedanceVideoVersions(
  item?: Partial<AiComicSeedanceShotProductionItem>,
): AiComicSeedanceVideoVersion[] {
  return (item?.versions ?? []).map(version => ({
    ...version,
    version_id: version.version_id,
    status: version.status,
    created_at: version.created_at,
  }));
}

function appendSeedanceVideoVersion(params: {
  existing?: AiComicSeedanceShotProductionItem;
  request: AiComicSeedanceProductionStatusUpdateRequest;
  updatedAt: string;
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

function seedanceAudioMixDefaultInputPath(detail: AiComicSeriesProjectDetail): string | undefined {
  if (
    detail.seedance_subtitle_render?.status === 'ready'
    && detail.seedance_subtitle_render.mode === 'burn_in'
    && detail.seedance_subtitle_render.output_path
  ) {
    return detail.seedance_subtitle_render.output_path;
  }
  return detail.seedance_cut_assembly?.output_path;
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
): string {
  const executable = ffmpegPath === 'ffmpeg' ? 'ffmpeg' : shellDoubleQuote(ffmpegPath);
  return [
    executable,
    ...ffmpegAudioMixArgs(inputVideoPath, audioInputs, outputPath).map(shellDoubleQuoteIfNeeded),
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
): string[] {
  const inputs = ['-y', '-i', inputVideoPath, ...audioInputs.flatMap(input => ['-i', input.input_path])];
  if (audioInputs.length === 0) return [...inputs, '-c', 'copy', outputPath];
  const filters = audioInputs.map((input, index) => {
    const inputIndex = index + 1;
    const durationSec = Math.max(0.1, input.end_sec - input.start_sec);
    const fadeOutStart = Math.max(0, durationSec - input.fade_out_sec);
    const delayMs = Math.max(0, Math.round(input.start_sec * 1000));
    return `[${inputIndex}:a]${[
      `volume=${input.volume_db}dB`,
      `atrim=0:${durationSec}`,
      'asetpts=PTS-STARTPTS',
      `afade=t=in:st=0:d=${input.fade_in_sec}`,
      `afade=t=out:st=${fadeOutStart}:d=${input.fade_out_sec}`,
      `adelay=${delayMs}|${delayMs}`,
      `[a${index}]`,
    ].join(',')}`;
  });
  const mixLabels = audioInputs.map((_, index) => `[a${index}]`).join('');
  const filterComplex = `${filters.join(';')};${mixLabels}amix=inputs=${audioInputs.length}:duration=longest:dropout_transition=2[aout]`;
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
  outputPath: string;
}): Promise<void> {
  await execFileAsync(
    params.ffmpegPath,
    ffmpegAudioMixArgs(params.inputVideoPath, params.audioInputs, params.outputPath),
    { timeout: 600_000 },
  );
}

function resolveSeedanceThumbnailOutputPath(projectDir: string, outputPath: string): string {
  return resolveSeedanceProjectOutputPath(projectDir, outputPath);
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
  if (kind === 'location') return '场景';
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

function seedanceRetrySuggestedAction(
  item?: AiComicSeedanceShotProductionItem,
): string {
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
  const continuityRuleItems = plan.continuity_rules.map(rule => makeProductionConstraintItem({
    category: 'continuity',
    label: rule.label,
    description: rule.description,
    source: 'series_plan',
    severity: 'must',
    status: 'active',
    notes: ['系列连续性规则，后续单集分镜和视频提示词必须遵守。'],
    stableKey: rule.rule_id,
  }));
  const productionNoteItems = plan.production_notes.map((note, index) => makeProductionConstraintItem({
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
        notes: ['镜头连续性说明不得改写为超出知识库的确证史实。'],
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
  const characters = plan.main_characters.map(character => makeMemoryItem({
    category: 'character',
    label: character.name,
    status: character.starting_state,
    relatedEpisodeNos: uniqueNumbers([
      1,
      ...character.turning_points.map(point => point.episode_no),
    ]),
    continuityNotes: [
      `定位：${character.role}`,
      `欲望：${character.desire}`,
      `长弧：${character.long_arc}`,
    ],
    visualAnchor: character.visual_signature,
    firstEpisodeNo: 1,
  }));

  const visualAssets = plan.main_characters.map(character => makeMemoryItem({
    category: 'visual_asset',
    label: `${character.name}视觉识别`,
    status: character.visual_signature,
    relatedEpisodeNos: uniqueNumbers([
      1,
      ...character.turning_points.map(point => point.episode_no),
    ]),
    continuityNotes: [`角色视觉资产需跨集保持：${character.visual_signature}`],
    visualAnchor: character.visual_signature,
    firstEpisodeNo: 1,
  }));

  const locations = plan.episodes.map(episode => makeMemoryItem({
    category: 'location',
    label: episode.knowledge_focus[0] || episode.story_phase,
    status: episode.main_conflict,
    relatedEpisodeNos: [episode.episode_no],
    continuityNotes: [
      episode.opening_hook ?? '承接上一集',
      episode.midpoint_turn ?? episode.ending_hook,
    ],
    firstEpisodeNo: episode.episode_no,
  }));

  const knowledgeBoundaries = unique(plan.episodes.flatMap(episode => episode.knowledge_focus))
    .filter(label => label.trim().length > 0)
    .map(label => makeMemoryItem({
      category: 'knowledge_boundary',
      label,
      status: '计划知识焦点',
      relatedEpisodeNos: plan.episodes
        .filter(episode => episode.knowledge_focus.includes(label))
        .map(episode => episode.episode_no),
      continuityNotes: ['知识库内容作为文化、人物、地点或事件边界；未核实内容不得写成确证史实。'],
      knowledgeBoundary: '知识库不是资料仓库，生成时只作为事实边界和创作约束。',
    }));

  const storyEvents = plan.episodes.map(episode => makeMemoryItem({
    category: 'story_event',
    label: `第${episode.episode_no}集：${episode.title}`,
    status: episode.main_conflict,
    relatedEpisodeNos: [episode.episode_no],
    continuityNotes: [
      `承接：${episode.continuity_from_previous.join('；') || '无'}`,
      `后续状态：${episode.continuity_state_after.join('；') || '待生成确认'}`,
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
  const candidates = plan.episodes.flatMap(episode => [
    ...episode.foreshadowing,
    ...episode.payoff,
  ]);
  return candidates
    .filter(text => /信物|玉|剑|书|卷|图|灯|碑|印|符|钥|帛|器|物|道具/.test(text))
    .slice(0, 20)
    .map(text => makeMemoryItem({
      category: 'prop',
      label: summarizeText(text, 18),
      status: text,
      relatedEpisodeNos: plan.episodes
        .filter(episode => [...episode.foreshadowing, ...episode.payoff].includes(text))
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
        knowledgeBoundary: 'Seedance 镜头提示词中的连续性说明不得改写为超出知识库的确证史实。',
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
    reasons.push('知识焦点');
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
    '连续性账本：后续分镜必须以账本为准，不得推翻已生成集数的人物状态、线索开合和知识使用记录。',
    `账本最近生成集：${ledger.last_generated_episode_no ? `第${ledger.last_generated_episode_no}集` : '尚未生成'}`,
    `账本当前角色状态：${ledger.character_state_current.join('；') || '暂无'}`,
    `账本未回收线索：${ledger.open_threads.join('；') || '暂无'}`,
    `账本已回收线索：${ledger.paid_off_threads.join('；') || '暂无'}`,
    `账本已用知识：${ledger.knowledge_used.join('、') || '暂无'}`,
    ...buildSeriesMemoryPromptLines(ledger.series_memory, plan, episode, memoryRecallControls),
    ...buildEpisodicMemoryPromptLines(ledger.episodic_memory, plan, episode),
    ...buildProductionConstraintPromptLines(ledger.production_constraints, episode),
    previousLedgerRecord
      ? `上一条生成记忆：第${previousLedgerRecord.episode_no}集《${previousLedgerRecord.title}》；故事ID：${previousLedgerRecord.story_id}；${previousLedgerRecord.next_episode_memory.join('；')}`
      : '',
  ] : [];
  const narrativePatternLines = getNarrativePatternRequirementLines('ai_comic_drama', narrativePatternIds);

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
    `本集目标场景功能：${blueprint.target_scene_functions.join('；')}`,
    `本集主冲突：${episode.main_conflict}`,
    `关键角色：${episode.key_characters.join('、') || plan.main_characters.map(character => character.name).join('、')}`,
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
    '知识库使用规则：知识库不是资料仓库。本集生成必须把知识焦点转化为人物选择、场景资产、时代边界、线索开合和可信度提示；不要把知识摘要直接铺成旁白资料。',
    `长期线索：${plan.plot_threads.map(thread => `${thread.title}，第${thread.setup_episode}集开启，第${thread.payoff_episode}集回收：${thread.description}`).join('；')}`,
    `角色弧线：${plan.main_characters.map(character => `${character.name}：${character.long_arc}`).join('；')}`,
    `连续性规则：${plan.continuity_rules.map(rule => `${rule.label}：${rule.description}`).join('；')}`,
    `知识焦点：${episode.knowledge_focus.join('、') || plan.recurring_motifs.join('、')}`,
    '输出要求：按 AI 漫剧分镜生成完整故事文本、场景分解、对白、画面提示和 GEARS 分段；必须回应上一集钩子，并让本集结尾钩子可被下一集承接。',
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
): AiComicSeriesCharacterArc[] {
  const baseNames = detectedCharacters.map(character => character.name);
  const names = unique([
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
): AiComicPlotThread[] {
  const late = Math.max(1, episodeCount);
  const mid = Math.max(1, Math.ceil(episodeCount * 0.55));
  const earlyPayoff = Math.max(1, Math.ceil(episodeCount * 0.28));
  return [
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
}): AiComicEpisodePlan[] {
  const episodes: AiComicEpisodePlan[] = [];
  for (let episodeNo = 1; episodeNo <= params.episodeCount; episodeNo += 1) {
    const phase = findPhase(params.phases, episodeNo);
    const previous = episodes[episodes.length - 1];
    const duration = chooseDuration(episodeNo, params.episodeCount, params.durationMin, params.durationMax, params.pacingProfile);
    const threadPayoffs = params.plotThreads.filter(thread => thread.payoff_episode === episodeNo);
    const threadSetups = params.plotThreads.filter(thread => thread.setup_episode === episodeNo);
    const focus = chooseKnowledgeFocus(params.knowledgeFocus, episodeNo);
    const keyCharacters = chooseKeyCharacters(params.characters, episodeNo);
    const mainConflict = buildConflict(episodeNo, params.episodeCount, params.coreTheme, focus);
    const endingHookType = inferEndingHookTypeFromPlan(episodeNo, params.episodeCount, params.pacingProfile);
    const endingHook = buildEndingHook(episodeNo, params.episodeCount, params.pacingProfile, focus);
    const continuityStateAfter = [
      `第${episodeNo}集后，${keyCharacters[0] ?? '主角'}对“${params.coreTheme}”的理解推进一层`,
      episodeNo === params.episodeCount ? '主要长期线索完成回收' : `保留第${episodeNo + 1}集需要回应的选择或疑问`,
    ];

    episodes.push({
      episode_no: episodeNo,
      title: buildEpisodeTitle(episodeNo, params.episodeCount, phase, params.coreTheme),
      target_duration_sec: duration,
      target_panel_count: Math.max(4, Math.min(60, Math.round(duration / 6))),
      story_phase: `${phase.phase_id}：${phase.purpose}`,
      opening_hook: buildOpeningHook(episodeNo, previous, params.coreTheme, focus, params.pacingProfile),
      main_conflict: mainConflict,
      midpoint_turn: buildMidpointTurn(episodeNo, params.episodeCount, phase, focus, params.coreTheme),
      key_characters: keyCharacters,
      continuity_from_previous: episodeNo === 1
        ? ['建立主角初始状态、核心问题和第一条长期线索']
        : [
            `承接第${episodeNo - 1}集结尾：${previous?.ending_hook ?? '上一集留下的选择'}`,
            `延续第${episodeNo - 1}集后的状态：${previous?.continuity_state_after[0] ?? '人物关系继续变化'}`,
          ],
      new_information: [
        focus ? `新增知识焦点：${focus}` : `新增剧情信息：${summarizeText(params.outline, 16)}`,
        threadSetups.length > 0 ? `开启线索：${threadSetups.map(thread => thread.title).join('、')}` : `推进${phase.phase_id}的阶段目标`,
      ],
      foreshadowing: buildForeshadowing(episodeNo, params.episodeCount, params.plotThreads, focus),
      payoff: threadPayoffs.length > 0
        ? threadPayoffs.map(thread => `回收${thread.title}：${thread.description}`)
        : episodeNo % 5 === 0
          ? [`阶段性回应第${Math.max(1, episodeNo - 3)}集留下的疑问`]
          : [],
      ending_hook: endingHook,
      ending_hook_type: endingHookType,
      character_state_change: continuityStateAfter[0],
      thread_action: buildThreadAction(episodeNo, params.plotThreads, threadSetups, threadPayoffs, phase),
      knowledge_focus: focus ? [focus] : params.knowledgeFocus.slice(0, 2),
      continuity_state_after: continuityStateAfter,
    });
  }
  return episodes;
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

function chooseKeyCharacters(characters: AiComicSeriesCharacterArc[], episodeNo: number): string[] {
  const lead = characters[0]?.name;
  const rotating = characters.length > 1 ? characters[((episodeNo - 1) % (characters.length - 1)) + 1]?.name : undefined;
  return unique([lead, rotating].filter(Boolean) as string[]);
}

function buildEpisodeTitle(episodeNo: number, episodeCount: number, phase: AiComicSeriesPhase, coreTheme: string): string {
  if (episodeNo === 1) return `第1集：问题出现`;
  if (episodeNo === episodeCount) return `第${episodeNo}集：最终选择`;
  if (episodeNo === phase.episode_range[1]) return `第${episodeNo}集：${phase.turning_point}`;
  return `第${episodeNo}集：${summarizeText(coreTheme, 8)}的新变化`;
}

function buildConflict(episodeNo: number, episodeCount: number, coreTheme: string, focus: string): string {
  if (episodeNo === 1) return `主角第一次面对“${coreTheme}”带来的选择。`;
  if (episodeNo === episodeCount) return `主角必须用最终行动回答“${coreTheme}”。`;
  return focus
    ? `围绕${focus}的新信息，让主角原有判断出现偏差。`
    : `新的阻力让主角对“${coreTheme}”产生更具体的判断。`;
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
    return '主角刚做出选择，立刻迎来更高代价。';
  }
  if (pacingProfile === 'slow_burn') {
    return '一个细小变化被保留下来，下一集继续发酵。';
  }
  return '主角得到新信息，也失去一种原本确定的判断。';
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
  const fromOutline = detectedSubjects.length > 0 ? detectedSubjects : outline.split(/[，。；：！？\s]+/).filter(Boolean);
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
