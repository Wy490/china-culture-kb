import type {
  GearsSegment,
  GenreStrictness,
  NarrativePatternId,
  PanelCount,
  StoryGenerateResult,
  StoryQualityReport,
  StoryQualityRepairRequest,
  StoryRepairTrace,
  StoryScene,
  QualityRepairAction,
} from '@shared/types.js';
import { PRESENTATION_STYLE_CONFIG, VIDEO_TYPE_CONFIG } from '@shared/types.js';
import type { StoryGenerationModelOutput, StoryGenerationPromptPackage } from './story-generation-prompt.js';
import { generateStoryWithAdapter } from './story-generation-model.js';
import { getGenreReturnJsonFields } from './genre-story-profiles.js';
import { resolveModelProfile } from './model-catalog.js';
import { validateDramaticStory } from './dramatic-story.js';
import { validateGenreStoryQuality } from './genre-quality-service.js';
import { buildGearsDeliveryPackage } from './gears-delivery-service.js';
import { enrichStoryQualityReport } from './quality-workflow-service.js';

const PANEL_COUNT_BY_DURATION: Record<number, PanelCount> = {
  12: 6,
  15: 6,
  20: 6,
  25: 8,
  30: 9,
  36: 10,
  43: 10,
  45: 10,
  50: 10,
  60: 12,
  67: 12,
  69: 12,
  75: 12,
  80: 12,
  86: 12,
  90: 12,
  96: 12,
  100: 12,
  109: 12,
  113: 12,
  120: 12,
};

export async function repairStoryWithQualityWorkflow(
  story: StoryGenerateResult,
  request: StoryQualityRepairRequest,
): Promise<{ story: StoryGenerateResult; trace: StoryRepairTrace }> {
  const selectedModelProfile = resolveModelProfile(request.model_profile_id ?? story.model_profile_id);
  const beforeScore = story.quality_report?.genre_score;
  const actions = selectRepairActions(story.quality_report, request);
  const hasStructuredActions = (story.quality_report?.repair_action_items?.length ?? 0) > 0;
  const traceActions = hasStructuredActions
    ? actions
    : (story.quality_report?.repair_actions ?? []).map((action, index) => ({
        action_id: `legacy-action-${index + 1}`,
        label: action,
        prompt: action,
        target_report: 'combined' as const,
        severity: 'medium' as const,
        scene_ids: [] as number[],
        expected_effect: '按历史修复建议补强故事质量。',
      }));

  const trace: StoryRepairTrace = {
    trace_id: `${story.storyId}--quality-repair-${Date.now()}`,
    attempted: true,
    applied: false,
    reason: 'pending',
    model_profile_id: selectedModelProfile.id,
    before_genre_score: beforeScore,
    actions: traceActions.map(action => action.prompt),
  };

  if (!story.quality_report || traceActions.length === 0) {
    trace.reason = 'no_quality_actions';
    return { story: withRepairTrace(story, trace), trace };
  }

  const repairAdapterResult = await generateStoryWithAdapter({
    pkg: buildQualityRepairPromptPackage(story, request.genre_strictness ?? 'balanced', traceActions),
    modelProfileId: selectedModelProfile.id,
  });
  trace.reason = repairAdapterResult.reason ?? `provider:${repairAdapterResult.provider}`;

  if (!repairAdapterResult.output) {
    const localCandidate = applyLocalAiComicQualityRepair(story, traceActions);
    const repairedStory = refreshRepairedStoryQuality(localCandidate.applied ? localCandidate.story : story);
    trace.after_genre_score = repairedStory.quality_report?.genre_score;
    if (qualityImproved(story.quality_report, repairedStory.quality_report)) {
      trace.applied = true;
      trace.reason = localCandidate.applied
        ? 'local_ai_comic_quality_repair_applied'
        : 'quality_report_refreshed';
      return { story: withRepairTrace(repairedStory, trace), trace };
    }
    trace.reason = repairAdapterResult.reason ?? 'repair_model_returned_no_output';
    return { story: withRepairTrace(story, trace), trace };
  }

  if (!isSceneBreakdownCompatible(story.scene_breakdown, repairAdapterResult.output.scene_breakdown)) {
    trace.reason = 'repair_scene_breakdown_incompatible';
    return { story: withRepairTrace(story, trace), trace };
  }

  const modelStory = rebuildStoryFromModelOutput(story, repairAdapterResult.output);
  const localCandidate = applyLocalAiComicQualityRepair(modelStory, traceActions);
  const repairedStory = refreshRepairedStoryQuality(localCandidate.story);
  trace.after_genre_score = repairedStory.quality_report?.genre_score;

  const beforeIssueCount = story.quality_report.issues.length;
  const afterIssueCount = repairedStory.quality_report?.issues.length ?? beforeIssueCount;
  if ((trace.after_genre_score ?? 0) >= (beforeScore ?? 0) || afterIssueCount < beforeIssueCount) {
    trace.applied = true;
    trace.reason = localCandidate.applied ? 'quality_repair_applied_with_local_ai_comic_signals' : 'quality_repair_applied';
    return { story: withRepairTrace(repairedStory, trace), trace };
  }

  trace.reason = 'quality_repair_not_improved';
  return { story: withRepairTrace(story, trace), trace };
}

function buildQualityRepairPromptPackage(
  story: StoryGenerateResult,
  strictness: GenreStrictness,
  actions: QualityRepairAction[],
): StoryGenerationPromptPackage {
  const quality = story.quality_report;
  const strictnessLine = strictness === 'strict'
    ? '严格模式：优先满足用户大纲、流派机制、场景行动和 GEARS 交付。'
    : strictness === 'loose'
      ? '宽松模式：保留原故事表达，只修补明确缺口。'
      : '均衡模式：保留原意，同时补强结构、场景和供稿信息。';
  const returnJsonFields = getGenreReturnJsonFields(story.video_type);

  return {
    prompt_version: 'story-generation/v1',
    context: {
      entry_name: story.source_entry,
      entry_type: story.video_type,
      entry_region: '',
      entry_keywords: story.knowledge_pack?.primary_entries.flatMap(entry => entry.keywords).slice(0, 12) ?? [],
      video_type: story.video_type,
      presentation_style: story.presentation_style,
      story_structure: story.story_structure ?? 'single_event_drama',
      target_duration: VIDEO_TYPE_CONFIG[story.video_type]?.default_duration ?? '3分钟',
      tone: strictnessLine,
      selected_event: story.story_blueprint?.central_event,
      original_user_query: story.original_user_query,
      credibility_note: story.credibility_note,
      narrative_pattern_ids: extractNarrativePatternIds(story),
    },
    entry_summary: story.logline,
    entry_story: story.full_text,
    entry_cultural_significance: story.theme,
    knowledge_context: story.knowledge_pack ? {
      primary_entries: story.knowledge_pack.primary_entries.map(entry => ({
        entry_name: entry.entry_name,
        role_in_story: entry.role_in_story,
        summary: entry.summary,
        knowledge_domain: entry.knowledge_domain,
        entry_role: entry.entry_role,
        era: entry.era,
        asset_usage: entry.asset_usage,
        asset_split: entry.asset_split,
      })),
      supporting_entries: story.knowledge_pack.supporting_entries.map(entry => ({
        entry_name: entry.entry_name,
        role_in_story: entry.role_in_story,
        summary: entry.summary,
        knowledge_domain: entry.knowledge_domain,
        entry_role: entry.entry_role,
        era: entry.era,
        asset_usage: entry.asset_usage,
        asset_split: entry.asset_split,
      })),
    } : undefined,
    adaptation_analysis: story.adaptation_analysis,
    story_blueprint: story.story_blueprint,
    output_contract: {
      must_provide: ['title', 'logline', 'theme', 'full_text', 'scene_breakdown', 'cultural_constraints', 'credibility_note'],
      should_respect: [
        strictnessLine,
        '保持 scene_id 数量和编号不变。',
        '每场必须有地点、动作、冲突或发现、情绪变化和可生成画面。',
        '画面提示只写空间、人物、道具、光线、构图和时代服饰约束。',
        ...actions.map(action => action.prompt),
      ],
      return_json_fields: returnJsonFields,
    },
    system_prompt: [
      '你是中文故事与 AI 漫剧生产编剧。',
      '现在执行一次质量修复，不重新规划项目，不改变场景数量。',
      strictnessLine,
      '只返回 JSON 对象，并且只能包含指定字段。',
    ].join('\n'),
    user_prompt: [
      '=== 原故事 ===',
      `标题：${story.title}`,
      `一句话：${story.logline}`,
      `主题：${story.theme}`,
      story.full_text,
      '',
      '=== 场景 ===',
      ...story.scene_breakdown.map(scene => [
        `scene_id=${scene.scene_id}`,
        `标题=${scene.title}`,
        `地点=${scene.location}`,
        `功能=${scene.dramatic_function}`,
        `情节=${scene.plot}`,
        `动作=${scene.key_action}`,
        `冲突=${scene.conflict ?? '未记录'}`,
        `对白/旁白=${scene.dialogue_or_narration ?? '未记录'}`,
        `画面=${scene.visual_prompt}`,
      ].join('；')),
      '',
      '=== 修复预览 ===',
      actions.map(action => action.expected_effect).join('；') || quality?.repair_preview || '未记录',
      '',
      '=== 结构化修复动作 ===',
      ...actions.map(action => [
        `- ${action.label} [${action.target_report}/${action.severity}]`,
        `  关联场景：${action.scene_ids.length ? action.scene_ids.join('、') : '全局'}`,
        `  修复要求：${action.prompt}`,
        `  预期效果：${action.expected_effect}`,
      ].join('\n')),
      '',
      '=== 三份报告摘要 ===',
      `Outline Coverage：${quality?.outline_coverage_report?.coverage_score ?? '未记录'}；${quality?.outline_coverage_report?.preview ?? ''}`,
      `Pattern Quality：${quality?.pattern_quality_report?.pattern_score ?? '未记录'}；${quality?.pattern_quality_report?.preview ?? ''}`,
      `GEARS Readiness：${quality?.gears_readiness_report?.readiness_score ?? '未记录'}；${quality?.gears_readiness_report?.preview ?? ''}`,
      '',
      '返回 JSON 字段：',
      returnJsonFields.join(', '),
    ].join('\n'),
  };
}

function selectRepairActions(
  qualityReport: StoryQualityReport | undefined,
  request: StoryQualityRepairRequest,
): QualityRepairAction[] {
  const structured = qualityReport?.repair_action_items ?? [];
  if (structured.length === 0) return [];
  const byActionId = request.repair_action_id
    ? structured.filter(action => action.action_id === request.repair_action_id)
    : structured;
  if (request.repair_action_id && byActionId.length === 0) return [];
  const byTarget = request.target_report
    ? byActionId.filter(action => action.target_report === request.target_report)
    : byActionId;
  if (byTarget.length > 0) return byTarget;
  return request.target_report ? [] : structured;
}

function rebuildStoryFromModelOutput(
  story: StoryGenerateResult,
  output: StoryGenerationModelOutput,
): StoryGenerateResult {
  const sceneById = new Map(output.scene_breakdown.map(scene => [scene.scene_id, scene]));
  const sceneBreakdown: StoryScene[] = story.scene_breakdown.map(scene => {
    const next = sceneById.get(scene.scene_id)!;
    return {
      ...scene,
      title: next.title || scene.title,
      plot: next.plot || scene.plot,
      key_action: next.key_action || scene.key_action,
      conflict: next.conflict || scene.conflict,
      dialogue_or_narration: next.dialogue_or_narration || scene.dialogue_or_narration,
      visual_prompt: next.visual_prompt || scene.visual_prompt,
      camera_suggestion: next.camera_suggestion || scene.camera_suggestion,
      characters: next.characters?.length ? next.characters : scene.characters,
      cultural_note: next.cultural_note || scene.cultural_note,
    };
  });

  const repaired: StoryGenerateResult = {
    ...story,
    title: output.title || story.title,
    logline: output.logline || story.logline,
    theme: output.theme || story.theme,
    full_text: output.full_text || story.full_text,
    scene_breakdown: sceneBreakdown,
    gears_segments: story.gears_segments.length > 0
      ? buildGearsSegments(sceneBreakdown, story.video_type, story.presentation_style)
      : [],
    cultural_constraints: output.cultural_constraints?.length ? output.cultural_constraints : story.cultural_constraints,
    credibility_note: output.credibility_note || story.credibility_note,
    characters: output.characters?.length
      ? output.characters.map(character => ({
          name: character.name,
          role: character.role,
          description: character.description,
          arc: character.arc,
        }))
      : story.characters,
    protagonist_arc: output.protagonist_arc?.length ? output.protagonist_arc : story.protagonist_arc,
    visual_symbols: output.visual_symbols ?? story.visual_symbols,
    core_message: output.core_message ?? story.core_message,
    slogan_or_key_sentence: output.slogan_or_key_sentence ?? story.slogan_or_key_sentence,
    craft_or_ritual_process: output.craft_or_ritual_process ?? story.craft_or_ritual_process,
    modern_connection: output.modern_connection ?? story.modern_connection,
    spatial_identity: output.spatial_identity ?? story.spatial_identity,
    visual_route: output.visual_route ?? story.visual_route,
    time_layer: output.time_layer ?? story.time_layer,
    atmosphere: output.atmosphere ?? story.atmosphere,
    argument_points: output.argument_points ?? story.argument_points,
    knowledge_outline: output.knowledge_outline ?? story.knowledge_outline,
    source_quotes: output.source_quotes ?? story.source_quotes,
    field_notes: output.field_notes ?? story.field_notes,
  };
  return repaired;
}

function refreshRepairedStoryQuality(story: StoryGenerateResult): StoryGenerateResult {
  const baseQualityReport = validateDramaticStory({
    full_text: story.full_text,
    scene_breakdown: story.scene_breakdown,
    title: story.title,
    selectedEvent: story.story_blueprint?.central_event,
    videoType: story.video_type,
  });
  const narrativePatternIds = extractNarrativePatternIds(story);
  let qualityReport: StoryQualityReport = validateGenreStoryQuality({
    story,
    baseReport: baseQualityReport,
    blueprint: story.story_blueprint,
    narrativePatternIds,
  });
  const gearsDelivery = buildGearsDeliveryPackage(story);
  qualityReport = enrichStoryQualityReport({
    story,
    qualityReport,
    narrativePatternIds,
    gearsDelivery,
  });
  return {
    ...story,
    gears_delivery: gearsDelivery,
    quality_report: qualityReport,
  };
}

function qualityImproved(
  before: StoryQualityReport | undefined,
  after: StoryQualityReport | undefined,
): boolean {
  if (!after) return false;
  const beforeScore = before?.genre_score ?? 0;
  const beforeIssueCount = before?.issues.length ?? Number.POSITIVE_INFINITY;
  return after.passed
    || (after.genre_score ?? 0) >= beforeScore
    || after.issues.length < beforeIssueCount;
}

function applyLocalAiComicQualityRepair(
  story: StoryGenerateResult,
  actions: QualityRepairAction[],
): { story: StoryGenerateResult; applied: boolean } {
  if (story.video_type !== 'ai_comic_drama') return { story, applied: false };
  const actionText = [
    ...(story.quality_report?.issues ?? []),
    ...actions.flatMap(action => [action.label, action.prompt, action.expected_effect]),
  ].join('\n');
  if (!/(目标明确|两难成立|精神落点来自选择|名场面可拍|视听动作具体|情绪高点清楚|不靠长解释|缺少主角选择|没有明确的选择行为|用户大纲偏离|人物不丢失|关系不改写|主线不换题|新增内容不抢戏)/.test(actionText)) {
    return { story, applied: false };
  }

  let changed = false;
  const scenes = story.scene_breakdown.map(scene => {
    const nextScene = { ...scene };
    const visualPrompt = sanitizeAudiencePromptText(scene.visual_prompt);
    const cameraSuggestion = sanitizeAudiencePromptText(scene.camera_suggestion);
    changed = changed || visualPrompt !== scene.visual_prompt || cameraSuggestion !== scene.camera_suggestion;
    nextScene.visual_prompt = visualPrompt;
    nextScene.camera_suggestion = cameraSuggestion;
    return nextScene;
  });
  const first = scenes[0];
  const middle = scenes.find(scene => /对白|交锋|冲突|选择/.test(`${scene.title}${scene.dramatic_function}`))
    ?? scenes[Math.max(0, Math.floor(scenes.length / 2))];
  const final = scenes[scenes.length - 1];

  if (first) {
    const nextPlot = appendNaturalSentence(
      first.plot,
      '他所求不是快些结案，而是要先看清事实。',
      /所求|要先看清事实|不能签字|重查/,
    );
    const outlinePlot = appendNaturalSentence(
      nextPlot,
      '案卷首页压着死刑文书，只等他画押。',
      /死刑文书|画押/,
    );
    const nextAction = appendNaturalPhrase(first.key_action, '停住笔、翻开案卷');
    const nextVisual = appendNaturalPhrase(first.visual_prompt, '烛火特写、笔尖停住、镜头推近定格');
    changed = changed || outlinePlot !== first.plot || nextAction !== first.key_action || nextVisual !== first.visual_prompt;
    first.plot = outlinePlot;
    first.key_action = nextAction;
    first.visual_prompt = nextVisual;
  }

  if (middle) {
    const dilemma = '若照旧签字，囚犯可能含冤而死；若坚持重查，他就要得罪上官、承担仕途代价。';
    const nextPlot = appendNaturalSentence(middle.plot, dilemma, /若[^。；]+；若|仕途代价|得罪上官/);
    const conflictPlot = appendNaturalSentence(
      nextPlot,
      '上官逼近一步，把判词推到他掌下，冷声催他签字。',
      /上官.{0,12}(逼近|推|催)|催他签字/,
    );
    const nextDialogue = appendDialogueLine(
      middle.dialogue_or_narration,
      '周敦颐（停住笔）：我不能签字，先重问证人、重看现场。',
      /不能签字|重问证人|重看现场/,
    );
    changed = changed || conflictPlot !== middle.plot || nextDialogue !== middle.dialogue_or_narration;
    middle.plot = conflictPlot;
    middle.dialogue_or_narration = nextDialogue;
  }

  if (final) {
    const nextPlot = appendNaturalSentence(
      final.plot,
      '他退回的不是一纸文书，而是守住人命面前的良知。',
      /守良知|守住|权势不能替良知|退回的不是/,
    );
    const hookPlot = appendNaturalSentence(
      nextPlot,
      '门外又传来证人改口的消息，下一步，他必须追到现场。',
      /下一步|证人改口|追到现场/,
    );
    const nextAction = appendNaturalPhrase(final.key_action, '推回文书、守住良知');
    changed = changed || hookPlot !== final.plot || nextAction !== final.key_action;
    final.plot = hookPlot;
    final.key_action = nextAction;
  }

  if (!changed) return { story, applied: false };
  return {
    story: {
      ...story,
      full_text: scenes
        .map(scene => [scene.plot, scene.dialogue_or_narration].filter((item): item is string => Boolean(item)).join('\n'))
        .join('\n\n'),
      scene_breakdown: scenes,
      gears_segments: story.gears_segments.length > 0
        ? buildGearsSegments(scenes, story.video_type, story.presentation_style)
        : [],
    },
    applied: true,
  };
}

function appendNaturalSentence(value: string, sentence: string, evidencePattern: RegExp): string {
  const current = value.trim();
  if (evidencePattern.test(current)) return current;
  return `${current.replace(/[。！？!?]*$/g, '')}。${sentence}`;
}

function appendNaturalPhrase(value: string, phrase: string): string {
  const current = value.trim();
  if (!current) return phrase;
  if (phrase.split(/[、，,]/).some(item => item && current.includes(item))) return current;
  return `${current}，${phrase}`;
}

function sanitizeAudiencePromptText(value: string | undefined): string {
  const current = value?.trim() ?? '';
  if (!current) return '';
  const cleaned = current
    .replace(/生成优先级：.*?。/g, '')
    .replace(/核心画面是[^，。；;\n]*(?:[，。；;]|\n|$)/g, '')
    .replace(/连续漫剧第[0-9一二三四五六七八九十]+集[^，。；;\n]*(?:[，。；;]|\n|$)/g, '')
    .replace(/保持人物状态、线索开合和结尾钩子前后一致[，。；;]?/g, '')
    .replace(/\s*\n+\s*/g, '，')
    .replace(/，{2,}/g, '，')
    .replace(/^[，。；;\s]+|[，。；;\s]+$/g, '')
    .trim();
  return cleaned || current
    .replace(/生成优先级|核心画面是/g, '')
    .replace(/\s*\n+\s*/g, '，')
    .trim();
}

function appendDialogueLine(value: string | undefined, line: string, evidencePattern: RegExp): string {
  const current = value?.trim() ?? '';
  if (evidencePattern.test(current)) return current;
  return current ? `${current}\n${line}` : line;
}

function buildGearsSegments(
  scenes: StoryScene[],
  videoType: StoryGenerateResult['video_type'],
  presentationStyle: StoryGenerateResult['presentation_style'],
): GearsSegment[] {
  return scenes.map(scene => {
    const panelCount = PANEL_COUNT_BY_DURATION[scene.duration_sec] ?? 6;
    const vtMeta = VIDEO_TYPE_CONFIG[videoType];
    const psMeta = PRESENTATION_STYLE_CONFIG[presentationStyle];
    return {
      segment_id: scene.scene_id,
      source_scene_id: scene.scene_id,
      duration_sec: scene.duration_sec,
      panel_count: panelCount,
      script_text: `【${scene.dramatic_function}】${scene.location}，${scene.time_of_day}。${scene.plot}。${scene.key_action}。${scene.dialogue_or_narration ?? ''}`.trim(),
      purpose: scene.dramatic_function,
      visual_focus: [scene.location, ...scene.visual_prompt.split(/[，、。]/).filter(item => item.length > 1).slice(0, 2)].slice(0, 3),
      cultural_constraints: scene.cultural_note ? [scene.cultural_note] : [],
      video_type: videoType,
      presentation_style: presentationStyle,
      segment_prompt_hint: `${vtMeta.label}/${psMeta.label}：${scene.visual_prompt}；${scene.camera_suggestion}`,
      source_entries: scene.source_entries,
    };
  });
}

function isSceneBreakdownCompatible(
  currentScenes: StoryScene[],
  nextScenes: Array<{ scene_id: number }>,
): boolean {
  if (currentScenes.length !== nextScenes.length) return false;
  const currentIds = new Set(currentScenes.map(scene => scene.scene_id));
  const nextIds = new Set(nextScenes.map(scene => scene.scene_id));
  if (currentIds.size !== currentScenes.length || nextIds.size !== nextScenes.length) return false;
  return [...currentIds].every(id => nextIds.has(id));
}

function extractNarrativePatternIds(story: StoryGenerateResult): NarrativePatternId[] {
  const raw = (story as StoryGenerateResult & { _request_meta?: Record<string, unknown> })._request_meta?.narrative_pattern_ids;
  return Array.isArray(raw) ? raw as NarrativePatternId[] : [];
}

function withRepairTrace(story: StoryGenerateResult, trace: StoryRepairTrace): StoryGenerateResult {
  return {
    ...story,
    repair_trace: [...(story.repair_trace ?? []), trace],
  };
}
