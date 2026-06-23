// web/server/src/services/story-generation-prompt.ts
// Build a structured prompt package for full story generation via external model adapter.
// Mirrors scene-regeneration-prompt.ts design but for the full-generation pipeline.

import type {
  EntryDetail,
  StoryGenerateRequest,
  StoryStructureType,
  VideoType,
  PresentationStyle,
  SupportedDuration,
  KnowledgePack,
  KnowledgeAssetUsage,
  KnowledgeAssetSplit,
  KnowledgeDomain,
  KnowledgeEntryRole,
  LocalCreativeRelation,
  LocalizationMode,
  NarrativePatternId,
  MemoryMosaicStorySeed,
  StoryDetectedCharacter,
  StoryBlueprint,
  StoryAdaptationAnalysis,
  WitnessMemory,
} from '@shared/types.js';
import {
  VIDEO_TYPE_CONFIG,
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
} from '@shared/types.js';
import {
  getGenreReturnJsonFields,
  getGenreSampleGuidance,
  getGenreStoryProfile,
} from './genre-story-profiles.js';
import {
  formatNarrativePatternsForPrompt,
  getNarrativePatternRequirementLines,
} from './narrative-pattern-library.js';

// ---------------------------------------------------------------------------
// Prompt package type — what gets sent to the external model via stdin
// ---------------------------------------------------------------------------

export interface StoryGenerationPromptPackage {
  prompt_version: 'story-generation/v1';
  context: {
    entry_name: string;
    entry_type: string;
    entry_region: string;
    entry_keywords: string[];
    video_type: VideoType;
    presentation_style: PresentationStyle;
    story_structure: StoryStructureType;
    target_duration: SupportedDuration;
    tone: string;
    selected_event?: string;
    original_user_query?: string;
    credibility_note?: string;
    cultural_risks?: string[];
    narrative_pattern_ids?: NarrativePatternId[];
    source_material_mode?: StoryGenerationPromptSourceMode;
    localized_target_region?: string;
    localization_mode?: LocalizationMode;
  };
  entry_summary: string;
  entry_story: string;
  entry_cultural_significance: string;
  local_creative_relations?: LocalCreativeRelation[];
  knowledge_context?: {
    primary_entries: PromptKnowledgeEntry[];
    supporting_entries: PromptKnowledgeEntry[];
  };
  character_hints?: StoryDetectedCharacter[];
  adaptation_analysis?: StoryAdaptationAnalysis;
  memory_mosaic_context?: {
    present_day_seeker: string;
    trigger_object: string;
    central_question: string;
    witnesses: WitnessMemory[];
    final_reveal: string;
    ending_image: string;
  };
  story_blueprint?: StoryBlueprint;
  output_contract: {
    must_provide: string[];
    should_respect: string[];
    return_json_fields: string[];
  };
  system_prompt: string;
  user_prompt: string;
}

type StoryGenerationPromptSourceMode = 'generate_from_knowledge' | 'adapt_user_novel';

interface PromptKnowledgeEntry {
  entry_name: string;
  role_in_story: string;
  summary: string;
  knowledge_domain?: KnowledgeDomain;
  entry_role?: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
  asset_split?: KnowledgeAssetSplit;
}

// ---------------------------------------------------------------------------
// Output schema — what the external model should return
// This is a subset of StoryGenerateResult: only the creative-content fields.
// Structural fields (storyId, gears_segments_url, etc.) are built locally.
// ---------------------------------------------------------------------------

export interface StoryGenerationModelOutput {
  title: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: Array<{
    scene_id: number;
    title: string;
    plot: string;
    key_action: string;
    conflict?: string;
    dialogue_or_narration?: string;
    visual_prompt?: string;
    camera_suggestion?: string;
    characters?: string[];
    cultural_note?: string;
  }>;
  cultural_constraints: string[];
  credibility_note: string;
  // Optional type-specific outputs
  characters?: Array<{ name: string; role: string; description: string; arc?: string }>;
  protagonist_arc?: Array<{ starting_state: string; turning_point: string; resolution: string }>;
  // Promo-specific
  visual_symbols?: string[];
  core_message?: string;
  slogan_or_key_sentence?: string;
  craft_or_ritual_process?: string;
  modern_connection?: string;
  // Scene-specific
  spatial_identity?: string;
  visual_route?: string[];
  time_layer?: string;
  atmosphere?: string;
  // Lecture/explainer-specific
  argument_points?: string[];
  knowledge_outline?: string[];
  // Documentary-specific
  source_quotes?: string[];
  field_notes?: string[];
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  videoType: VideoType,
  presentationStyle: PresentationStyle,
  storyStructure: StoryStructureType,
  isMemoryMosaic: boolean,
  narrativePatternIds: NarrativePatternId[] = [],
  sourceMaterialMode: StoryGenerationPromptSourceMode = 'generate_from_knowledge',
): string {
  const vtMeta = VIDEO_TYPE_CONFIG[videoType];
  const psMeta = PRESENTATION_STYLE_CONFIG[presentationStyle];
  const ssMeta = STORY_STRUCTURE_CONFIG[storyStructure];
  const profile = getGenreStoryProfile(videoType);
  const sampleGuidance = getGenreSampleGuidance(videoType);
  const narrativePatternLines = getNarrativePatternRequirementLines(videoType, narrativePatternIds);

  const lines: string[] = [
    '你是一个擅长中文故事创作的编剧。',
    '你使用的是结构化知识库，不是资料仓库；知识条目必须转化为人物、场景、边界、关系和创作决策，不能当作原文素材堆砌。',
    `你要创作一个${vtMeta.label}（${psMeta.label}风格）的完整故事方案。`,
    `叙事结构：${ssMeta.label}——${ssMeta.description}`,
    `类型创作目标：${profile.narrative_promise}`,
    `类型叙事框架：${profile.framework.join(' → ')}`,
    `必须包含：${profile.must_include.join('；')}`,
    `样片参考类型：${sampleGuidance.reference_samples.join('；')}`,
    `样片开场方法：${sampleGuidance.opening_moves.join('；')}`,
    `样片中段推进：${sampleGuidance.middle_moves.join('；')}`,
    `样片结尾策略：${sampleGuidance.ending_moves.join('；')}`,
    `样片画面策略：${sampleGuidance.visual_moves.join('；')}`,
    `样片文案策略：${sampleGuidance.script_moves.join('；')}`,
    `叙事流派机制：${narrativePatternLines.join('；')}`,
    `避免：${profile.avoid.join('；')}`,
  ];

  if (isMemoryMosaic) {
    lines.push(
      '这是回忆拼图式人物故事。现实线围绕追寻者与触发物件推进，回忆线必须像见证人口述。',
      '现实线的场次要写追寻者如何逐步接近真相，回忆线的场次要写见证人如何记住主角的选择。',
    );
  }

  if (sourceMaterialMode === 'adapt_user_novel') {
    lines.push(
      '当前任务是已有小说/故事文本的视频化改编，不是重新生成一篇小说。',
      '必须保留用户原作的主角、主要关系、核心事件、因果顺序、主题和情绪底色；允许压缩、合并、重排场景，但每处删改都要服务成片节奏。',
      '不得新增抢夺主线的核心人物、不得把原作改写成知识库传记、不得用知识包内容替换用户原作情节。',
      '输出应是视频方案：完整改编正文、场景分解、分镜可用对白/旁白、画面提示和 GEARS 供稿所需信息。',
    );
  }

  lines.push(
    '禁止输出百科腔调、传记流水账、纯口号堆砌。',
    '故事要有冲突、选择和情绪变化。',
    '禁止输出解释、分析、Markdown、代码块。',
    '只返回 JSON 对象，并且只能包含指定字段。',
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

function buildUserPrompt(pkg: Omit<StoryGenerationPromptPackage, 'system_prompt' | 'user_prompt'>): string {
  const sampleGuidance = getGenreSampleGuidance(pkg.context.video_type);
  const lines: string[] = [
    `来源条目：${pkg.context.entry_name}`,
    `条目类型：${pkg.context.entry_type}`,
    `地区：${pkg.context.entry_region}`,
    `成片类型：${pkg.context.video_type} / ${pkg.context.presentation_style}`,
    `叙事结构：${pkg.context.story_structure}`,
    `目标时长：${pkg.context.target_duration}`,
  ];

  if (pkg.context.tone) {
    lines.push(`叙事/表达风格：${pkg.context.tone}`);
  }
  if (pkg.context.selected_event) {
    lines.push(`中心事件：${pkg.context.selected_event}`);
  }
  if (pkg.context.original_user_query) {
    lines.push(`${pkg.context.source_material_mode === 'adapt_user_novel' ? '用户原作/改编素材' : '用户原始诉求'}：${pkg.context.original_user_query}`);
  }
  if (pkg.context.source_material_mode === 'adapt_user_novel') {
    lines.push(
      '改编模式规则：用户原作/改编素材是主创作源；知识包只用于时代、地域、服饰、器物、文化边界和 GEARS 资产校准。',
      '不要续写、另写或重写成新小说；要把原作转成视频剧本结构：保留主线，压缩旁枝，补足镜头动作、场景调度和可生成画面。',
      '若原作很长，只抽取最适合目标时长的核心段落，输出中明确体现保留了哪些人物关系、冲突和主题。',
    );
  }
  if (pkg.context.original_user_query || pkg.context.selected_event) {
    lines.push(
      '大纲锁定规则：必须优先遵循用户原始诉求/大纲的主题、阶段顺序、地点、人物年龄段和时间范围；不得把知识包、默认流派或其他历史阶段改写成主线。',
      '偏题拦截：如果大纲写的是少年求学/思想形成，就不要把后期政治运动或革命根据地写成主线；这些内容最多作为结尾远景或历史余响一句带过。',
    );
  }
  if (pkg.context.localized_target_region) {
    const strictDirect = pkg.context.localization_mode === 'strict_direct_events';
    lines.push(
      `甲方指定地域：${pkg.context.localized_target_region}`,
      `地方化模式：${strictDirect ? '只写直接发生/本人亲历事件' : '允许直接事件、相关地点、思想文化影响和当代转化'}`,
      strictDirect
        ? `本地化硬约束：只有知识条目明确支持“直接事件｜${pkg.context.localized_target_region}”或地区字段直接属于该地时，才能写成本人/事件在当地发生；相关地点、思想文化影响、当代转化只能作为背景，不得写成亲历。`
        : `本地化硬约束：故事必须围绕${pkg.context.localized_target_region}的可证直接事件、相关地点、思想文化影响或当代转化展开；如果知识关系标注为“不可写成”，必须作为禁写边界执行。`,
      '本地化表达规则：不得为了满足甲方地域要求而把外地事件搬到当地；没有确证的亲历只能写成后世接受、书院传播、展陈阐释、研学课程或城市文化转化。',
    );
  }
  if (pkg.context.cultural_risks?.length) {
    lines.push(`文化风险提示：${pkg.context.cultural_risks.join('；')}`);
  }

  lines.push('', '=== 条目简介 ===', pkg.entry_summary);
  lines.push('', '=== 条目故事梗概 ===', pkg.entry_story);
  lines.push('', '=== 条目文化意义 ===', pkg.entry_cultural_significance);

  const localRelations = filterLocalCreativeRelations(pkg.local_creative_relations, pkg.context.localized_target_region);
  if (localRelations.length > 0) {
    lines.push('', '=== 地方化创作关系 ===');
    for (const relation of localRelations) {
      lines.push(`- ${localRelationLabel(relation.relation_type)}｜${relation.target}：${relation.description}`);
    }
    lines.push('地方化关系使用规则：直接事件可作为剧情事实；相关地点、思想文化影响和当代转化只能作为地方讲述入口；不可写成必须作为禁写边界。');
  }

  if (pkg.knowledge_context) {
    lines.push('', '=== 知识组合包 ===');
    lines.push('主要条目：');
    for (const entry of pkg.knowledge_context.primary_entries) {
      lines.push(`- ${formatKnowledgeEntryForPrompt(entry)}`);
    }
    if (pkg.knowledge_context.supporting_entries.length > 0) {
      lines.push('支撑条目：');
      for (const entry of pkg.knowledge_context.supporting_entries) {
        lines.push(`- ${formatKnowledgeEntryForPrompt(entry)}`);
      }
    }
    lines.push(
      '知识库不是资料仓库：不要把知识包摘要当作散乱资料粘进正文；必须先读取知识域、条目角色、时代、用途、资产拆分、可信度和风险提示，再决定哪些内容约束事实、哪些内容提供画面、哪些内容只作为创作边界。',
      '知识包使用规则：朝代设定包用于服饰、器物、称谓和时代边界；志异母题包用于叙事结构和可信度提示；GEARS资产包用于人物/场景/道具边界。不要把设定包内容写成主条目的史实。',
      '知识决策规则：每个关键人物、场景、道具和情节转折都要能说明来自主条目、设定包、资产包、可信创作补足或明确虚构，不允许用“资料里有一些说法”替代判断。',
    );
  }

  if (pkg.character_hints?.length) {
    lines.push('', '=== 大纲角色识别 ===');
    for (const character of pkg.character_hints) {
      lines.push(`- ${character.name}（${character.role_position}；${character.character_kind}；${character.asset_stability}${character.age_range ? `；${character.age_range}` : ''}${character.gender ? `；${character.gender}` : ''}）：${character.source_text}`);
    }
    lines.push('角色使用规则：身份型配角、群体角色和志异异类也要进入 characters 或 scene_breakdown.characters；无名角色用稳定身份名，不要随场景改名。');
  }
  if (pkg.adaptation_analysis) {
    lines.push('', '=== 原作改编前置分析 ===');
    lines.push(`原作长度：${pkg.adaptation_analysis.source_length} 字`);
    lines.push(`原作概括：${pkg.adaptation_analysis.source_summary}`);
    if (pkg.adaptation_analysis.core_characters.length > 0) {
      lines.push(`核心人物/称谓：${pkg.adaptation_analysis.core_characters.join('、')}`);
    }
    if (pkg.adaptation_analysis.plot_beats.length > 0) {
      lines.push('原作主线节拍：');
      for (const beat of pkg.adaptation_analysis.plot_beats) lines.push(`- ${beat}`);
    }
    if (pkg.adaptation_analysis.must_keep.length > 0) {
      lines.push('必须保留：');
      for (const item of pkg.adaptation_analysis.must_keep) lines.push(`- ${item}`);
    }
    if (pkg.adaptation_analysis.compressible_parts.length > 0) {
      lines.push('可压缩/合并：');
      for (const item of pkg.adaptation_analysis.compressible_parts) lines.push(`- ${item}`);
    }
    if (pkg.adaptation_analysis.visual_setpieces.length > 0) {
      lines.push('优先转成镜头的场面：');
      for (const item of pkg.adaptation_analysis.visual_setpieces) lines.push(`- ${item}`);
    }
    if (pkg.adaptation_analysis.adaptation_risks.length > 0) {
      lines.push('改编风险：');
      for (const item of pkg.adaptation_analysis.adaptation_risks) lines.push(`- ${item}`);
    }
    lines.push('改编执行规则：上述“必须保留”优先级高于流派库和知识包；“可压缩/合并”只能减少篇幅，不能改变主线因果。');
  }

  if (pkg.memory_mosaic_context) {
    lines.push('', '=== 回忆拼图上下文 ===');
    lines.push(`追寻者：${pkg.memory_mosaic_context.present_day_seeker}`);
    lines.push(`触发物件：${pkg.memory_mosaic_context.trigger_object}`);
    lines.push(`核心问题：${pkg.memory_mosaic_context.central_question}`);
    lines.push('见证人：');
    for (const w of pkg.memory_mosaic_context.witnesses) {
      lines.push(`- ${w.witness_name}（${w.relationship_to_subject}）回忆"${w.remembered_event}"，情绪偏向：${w.emotional_bias}`);
    }
    lines.push(`最终揭示：${pkg.memory_mosaic_context.final_reveal}`);
    lines.push(`结尾画面：${pkg.memory_mosaic_context.ending_image}`);
  }

  if (pkg.story_blueprint) {
    lines.push('', '=== 类型故事蓝图 ===');
    lines.push(`中心问题：${pkg.story_blueprint.central_question}`);
    lines.push(`主角：${pkg.story_blueprint.protagonist ?? '未指定'}`);
    lines.push('类型节拍：');
    for (const beat of pkg.story_blueprint.genre_beats) {
      lines.push(`- ${beat.order}. ${beat.function_label}：${beat.content_requirement}`);
    }
    lines.push('可信度边界：');
    for (const boundary of pkg.story_blueprint.evidence_boundaries) {
      lines.push(`- ${boundary.label}：${boundary.note}`);
    }
    lines.push('生成规则：full_text、scene_breakdown 和 GEARS 分段必须服从上述类型节拍。');
  }

  lines.push('', '=== 样片化类型规则 ===');
  lines.push(`参考样片类型：${sampleGuidance.reference_samples.join('；')}`);
  lines.push(`开场：${sampleGuidance.opening_moves.join('；')}`);
  lines.push(`中段：${sampleGuidance.middle_moves.join('；')}`);
  lines.push(`结尾：${sampleGuidance.ending_moves.join('；')}`);
  lines.push(`画面：${sampleGuidance.visual_moves.join('；')}`);
  lines.push(`文案：${sampleGuidance.script_moves.join('；')}`);
  lines.push(`质量信号：${sampleGuidance.quality_signals.join('；')}`);
  lines.push('质量信号只作为内部检查清单；不得把“主角目标/目标明确/选择有代价/因果链/行动具体/人物不是年表/史实边界/质量信号/生成优先级”等检测词原样写入 full_text、scene_breakdown 或 GEARS script_text。');

  lines.push('', '=== 叙事流派库 ===');
  lines.push(
    '以下是结构机制参考，只能学习叙事引擎、冲突引擎、节奏和质量信号；禁止复刻具体小说情节、人物、设定、台词或作者文风。',
  );
  lines.push(...formatNarrativePatternsForPrompt(pkg.context.video_type, pkg.context.narrative_pattern_ids ?? []));

  lines.push(
    '',
    '请创作完整故事方案，返回 JSON 对象，包含以下字段：',
    getGenreReturnJsonFields(pkg.context.video_type).join(', '),
    '',
    'scene_breakdown 中每场必须包含：scene_id, title, plot, key_action',
    '可选字段：conflict, dialogue_or_narration, visual_prompt, camera_suggestion, characters, cultural_note',
    '',
    'full_text 必须是完整叙事文本（不是摘要），长度与目标时长匹配。',
    'scene_breakdown 场次数量应与目标时长匹配（1分钟约2-4场，3分钟约3-6场，5分钟约5-7场）。',
    'scene_breakdown 每场 plot 要能直接支撑分镜：至少包含地点、人物动作、冲突/发现、情绪变化或一句关键旁白，不能只写问题句或资料短语。',
    'plot、dialogue_or_narration 和 script_text 必须像观众会听到/读到的故事文本，用动作、对白和后果承载质量要求，不要出现内部质量标签或检测词。',
    'visual_prompt 只能写可生成画面的空间、时代、人物、道具、光线、构图和氛围，不能混入剧情分析、质量标签、章节标题或资料摘要。',
    'characters 只列真实出场人物/群体，不要把事件名、章节名、地点名、主题词当人物。',
  );

  // Type-specific output reminders
  const vt = pkg.context.video_type;
  const requiredFields = getGenreStoryProfile(vt).required_fields;
  if (requiredFields.length > 0) {
    lines.push(`该类型必须额外返回：${requiredFields.join(', ')}`);
  }
  if (vt === 'ai_comic_drama') {
    lines.push('AI漫剧的 scene_breakdown 每场必须有 dialogue_or_narration（对白/旁白）');
  }

  return lines.join('\n');
}

function formatKnowledgeEntryForPrompt(entry: PromptKnowledgeEntry): string {
  const tags = [
    `角色：${entry.role_in_story}`,
    entry.knowledge_domain ? `知识域：${entry.knowledge_domain}` : '',
    entry.entry_role ? `条目角色：${entry.entry_role}` : '',
    entry.era ? `时代：${entry.era}` : '',
    entry.asset_usage?.length ? `用途：${entry.asset_usage.join('、')}` : '',
  ].filter(Boolean).join('；');
  const assetSplitText = formatAssetSplitForPrompt(entry.asset_split);
  return `${entry.entry_name}（${tags}）: ${entry.summary}${assetSplitText ? `；资产拆分：${assetSplitText}` : ''}`;
}

function formatAssetSplitForPrompt(assetSplit: KnowledgeAssetSplit | undefined): string {
  if (!assetSplit) return '';
  return [
    assetSplit.characters.length ? `人物=${assetSplit.characters.join('、')}` : '',
    assetSplit.scenes.length ? `场景=${assetSplit.scenes.join('、')}` : '',
    assetSplit.character_props.length ? `人物随身道具=${assetSplit.character_props.join('、')}` : '',
    assetSplit.scene_props.length ? `场景陈设=${assetSplit.scene_props.join('、')}` : '',
  ].filter(Boolean).join('；');
}

// ---------------------------------------------------------------------------
// Build the complete prompt package
// ---------------------------------------------------------------------------

export function buildStoryGenerationPromptPackage(input: {
  entry: EntryDetail;
  request: StoryGenerateRequest;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  storyStructure: StoryStructureType;
  targetDuration: SupportedDuration;
  tone: string;
  selectedEvent?: string;
  knowledgePack?: KnowledgePack;
  memoryMosaicSeed?: MemoryMosaicStorySeed;
  storyBlueprint?: StoryBlueprint;
  adaptationAnalysis?: StoryAdaptationAnalysis;
}): StoryGenerationPromptPackage {
  const isMemoryMosaic = input.storyStructure === 'memory_mosaic_biography';

  const base: Omit<StoryGenerationPromptPackage, 'system_prompt' | 'user_prompt'> = {
    prompt_version: 'story-generation/v1',
    context: {
      entry_name: input.entry.name,
      entry_type: input.entry.type,
      entry_region: input.entry.region,
      entry_keywords: input.entry.keywords,
      video_type: input.videoType,
      presentation_style: input.presentationStyle,
      story_structure: input.storyStructure,
      target_duration: input.targetDuration,
      tone: input.tone,
      selected_event: input.selectedEvent,
      original_user_query: input.request.original_user_query ?? input.request.outline,
      credibility_note: input.entry.verificationMethod,
      cultural_risks: computeCulturalRisks(input.entry),
      narrative_pattern_ids: input.request.narrative_pattern_ids,
      source_material_mode: input.request.source_material_mode ?? 'generate_from_knowledge',
      localized_target_region: input.request.localized_target_region,
      localization_mode: input.request.localization_mode ?? 'allow_related_influence',
    },
    entry_summary: input.entry.summary,
    entry_story: input.entry.story,
    entry_cultural_significance: input.entry.culturalSignificance,
    local_creative_relations: input.entry.localCreativeRelations,
    knowledge_context: input.knowledgePack
      ? {
          primary_entries: input.knowledgePack.primary_entries.map(e => ({
            entry_name: e.entry_name,
            role_in_story: e.role_in_story,
            summary: e.summary,
            knowledge_domain: e.knowledge_domain,
            entry_role: e.entry_role,
            era: e.era,
            asset_usage: e.asset_usage,
            asset_split: e.asset_split,
          })),
          supporting_entries: input.knowledgePack.supporting_entries.map(e => ({
            entry_name: e.entry_name,
            role_in_story: e.role_in_story,
            summary: e.summary,
            knowledge_domain: e.knowledge_domain,
            entry_role: e.entry_role,
            era: e.era,
            asset_usage: e.asset_usage,
            asset_split: e.asset_split,
          })),
        }
      : undefined,
    character_hints: input.request.character_hints,
    adaptation_analysis: input.adaptationAnalysis,
    memory_mosaic_context: input.memoryMosaicSeed
      ? {
          present_day_seeker: input.memoryMosaicSeed.present_day_seeker,
          trigger_object: input.memoryMosaicSeed.trigger_object,
          central_question: input.memoryMosaicSeed.central_question,
          witnesses: input.memoryMosaicSeed.witnesses,
          final_reveal: input.memoryMosaicSeed.final_reveal,
          ending_image: input.memoryMosaicSeed.ending_image,
        }
      : undefined,
    story_blueprint: input.storyBlueprint,
    output_contract: {
      must_provide: ['title', 'logline', 'theme', 'full_text', 'scene_breakdown'],
      should_respect: [
        '保持来源条目的文化语境和可信度标注',
        '按结构化知识库做创作决策，不把知识包当资料仓库堆砌',
        '区分事实依据、画面资产、叙事母题、可信度边界和创作补足',
        '保持当前成片类型的叙事质感',
        '场次数量和时长匹配',
        '故事有冲突、选择和情绪变化',
        ...getGenreStoryProfile(input.videoType).must_include,
        ...getGenreSampleGuidance(input.videoType).quality_signals,
        ...getNarrativePatternRequirementLines(input.videoType, input.request.narrative_pattern_ids ?? []),
        ...(input.request.source_material_mode === 'adapt_user_novel'
          ? [
              '改编用户已有小说：保留原作主线、人物关系、因果顺序和主题，不另写新故事',
              ...(input.adaptationAnalysis?.must_keep ?? []).map(item => `执行原作保留项：${item}`),
              ...(input.adaptationAnalysis?.adaptation_risks ?? []).map(item => `规避改编风险：${item}`),
              '把原作文本转成视频场景、对白/旁白、镜头动作和 GEARS 可用资产',
            ]
          : []),
        ...(input.request.localized_target_region
          ? [
              `围绕甲方指定地域「${input.request.localized_target_region}」创作，不得把外地事件硬搬到当地`,
              input.request.localization_mode === 'strict_direct_events'
                ? '严格本地事件模式：只把明确直接发生/本人亲历的内容写成剧情事实'
                : '地方影响模式：可写相关地点、思想文化影响和当代转化，但必须区分本人亲历与后世阐释',
            ]
          : []),
        ...(input.storyBlueprint?.type_specific_requirements ?? []),
      ],
      return_json_fields: getGenreReturnJsonFields(input.videoType),
    },
  };

  return {
    ...base,
    system_prompt: buildSystemPrompt(
      input.videoType,
      input.presentationStyle,
      input.storyStructure,
      isMemoryMosaic,
      input.request.narrative_pattern_ids ?? [],
      input.request.source_material_mode ?? 'generate_from_knowledge',
    ),
    user_prompt: buildUserPrompt(base),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeCulturalRisks(entry: EntryDetail): string[] {
  const risks: string[] = [];
  if (entry.credibility === '存疑') risks.push('条目整体可信度存疑');
  if (entry.credibility === '待核实') risks.push('条目可信度待核实');
  for (const point of entry.unverifiedPoints) risks.push(`待核实：${point}`);
  return risks;
}

function filterLocalCreativeRelations(
  relations: LocalCreativeRelation[] | undefined,
  targetRegion: string | undefined,
): LocalCreativeRelation[] {
  if (!relations?.length) return [];
  const target = targetRegion?.trim();
  if (!target) return relations.slice(0, 10);
  const exact = relations.filter(relation =>
    relation.target.includes(target) || relation.description.includes(target)
  );
  const boundaries = relations.filter(relation => relation.relation_type === 'do_not_write_as');
  return uniqueRelations([...exact, ...boundaries]).slice(0, 12);
}

function uniqueRelations(relations: LocalCreativeRelation[]): LocalCreativeRelation[] {
  const seen = new Set<string>();
  return relations.filter(relation => {
    const key = `${relation.relation_type}|${relation.target}|${relation.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function localRelationLabel(type: LocalCreativeRelation['relation_type']): string {
  const labels: Record<LocalCreativeRelation['relation_type'], string> = {
    direct_region: '直接事件',
    related_location: '相关地点',
    cultural_influence: '思想文化影响',
    contemporary_adaptation: '当代转化',
    do_not_write_as: '不可写成',
    same_province: '同省背景',
    keyword_context: '关键词语境',
  };
  return labels[type];
}
