// web/server/src/services/ai-comic-series-service.ts — AI comic series planning

import { dirname, resolve } from 'node:path';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { ErrorCodes, success, fail } from '@shared/types.js';
import type {
  AiComicContinuityLedger,
  AiComicContinuityLedgerEpisode,
  AiComicEpisodeContextPreview,
  AiComicEpisodeContextPreviewRequest,
  AiComicEpisodeQualityReport,
  AiComicEpisodePlan,
  AiComicEpisodeBlueprint,
  AiComicEndingHookType,
  AiComicEpisodeGenerateRequest,
  AiComicPacingProfile,
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
  KnowledgeNeed,
  KnowledgePack,
  NarrativePatternId,
  StoryDetectedCharacter,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { analyzeOutline, multiMatchEntries } from './outline-service.js';
import { generateAndStoreStory } from './story-service.js';
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
    ledger_summary: {
      last_generated_episode_no: fallbackLedger.last_generated_episode_no,
      character_state_current: fallbackLedger.character_state_current,
      open_threads: fallbackLedger.open_threads,
      paid_off_threads: fallbackLedger.paid_off_threads,
      knowledge_used: fallbackLedger.knowledge_used,
      series_memory: buildSeriesMemorySummary(fallbackLedger.series_memory),
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
      ...(pkg.series_quality_audit.thread_closure_report?.items
        .filter(item => item.issues.length > 0 || item.status !== 'paid_off')
        .slice(0, 5)
        .map(item => `  - ${item.title}: ${item.issues[0] ?? item.repair_suggestions[0] ?? '按计划推进'}`) ?? []),
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

function markdownTable(headers: string[], rows: string[][]): string[] {
  if (rows.length === 0) return ['- 未记录'];
  const cleanCell = (value: string): string => value.replace(/\|/g, '｜').replace(/\n/g, ' ').trim() || '未记录';
  return [
    `| ${headers.map(cleanCell).join(' |')} |`,
    `| ${headers.map(() => '---').join(' |')} |`,
    ...rows.map(row => `| ${row.map(cleanCell).join(' |')} |`),
  ];
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
    },
    memory_recall_preferences: cloneMemoryRecallPreferences(existing.memory_recall_preferences),
    series_quality_audit: existing.series_quality_audit,
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
  const completedSeriesThreadsResolved = threadClosureReport.overdue_thread_count === 0
    && threadClosureReport.orphaned_thread_count === 0
    && threadClosureReport.duplicate_thread_count === 0
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

function seriesProjectsRoot(): string {
  return resolve(kbRoot(), '..', 'web', 'generated', 'ai-comic-series-projects');
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
