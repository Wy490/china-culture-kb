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
  MemoryMosaicStorySeed,
  StoryDetectedCharacter,
  StoryBlueprint,
  WitnessMemory,
} from '@shared/types.js';
import {
  VIDEO_TYPE_CONFIG,
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
} from '@shared/types.js';
import {
  getGenreReturnJsonFields,
  getGenreStoryProfile,
} from './genre-story-profiles.js';

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
  };
  entry_summary: string;
  entry_story: string;
  entry_cultural_significance: string;
  knowledge_context?: {
    primary_entries: PromptKnowledgeEntry[];
    supporting_entries: PromptKnowledgeEntry[];
  };
  character_hints?: StoryDetectedCharacter[];
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
): string {
  const vtMeta = VIDEO_TYPE_CONFIG[videoType];
  const psMeta = PRESENTATION_STYLE_CONFIG[presentationStyle];
  const ssMeta = STORY_STRUCTURE_CONFIG[storyStructure];
  const profile = getGenreStoryProfile(videoType);

  const lines: string[] = [
    '你是一个擅长中文故事创作的编剧。',
    `你要创作一个${vtMeta.label}（${psMeta.label}风格）的完整故事方案。`,
    `叙事结构：${ssMeta.label}——${ssMeta.description}`,
    `类型创作目标：${profile.narrative_promise}`,
    `类型叙事框架：${profile.framework.join(' → ')}`,
    `必须包含：${profile.must_include.join('；')}`,
    `避免：${profile.avoid.join('；')}`,
  ];

  if (isMemoryMosaic) {
    lines.push(
      '这是回忆拼图式人物故事。现实线围绕追寻者与触发物件推进，回忆线必须像见证人口述。',
      '现实线的场次要写追寻者如何逐步接近真相，回忆线的场次要写见证人如何记住主角的选择。',
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
    lines.push(`用户原始诉求：${pkg.context.original_user_query}`);
  }
  if (pkg.context.cultural_risks?.length) {
    lines.push(`文化风险提示：${pkg.context.cultural_risks.join('；')}`);
  }

  lines.push('', '=== 条目简介 ===', pkg.entry_summary);
  lines.push('', '=== 条目故事梗概 ===', pkg.entry_story);
  lines.push('', '=== 条目文化意义 ===', pkg.entry_cultural_significance);

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
      lines.push('知识包使用规则：朝代设定包用于服饰、器物、称谓和时代边界；志异母题包用于叙事结构和可信度提示；GEARS资产包用于人物/场景/道具边界。不要把设定包内容写成主条目的史实。');
    }
  }

  if (pkg.character_hints?.length) {
    lines.push('', '=== 大纲角色识别 ===');
    for (const character of pkg.character_hints) {
      lines.push(`- ${character.name}（${character.role_position}；${character.character_kind}；${character.asset_stability}${character.age_range ? `；${character.age_range}` : ''}${character.gender ? `；${character.gender}` : ''}）：${character.source_text}`);
    }
    lines.push('角色使用规则：身份型配角、群体角色和志异异类也要进入 characters 或 scene_breakdown.characters；无名角色用稳定身份名，不要随场景改名。');
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
    },
    entry_summary: input.entry.summary,
    entry_story: input.entry.story,
    entry_cultural_significance: input.entry.culturalSignificance,
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
        '保持当前成片类型的叙事质感',
        '场次数量和时长匹配',
        '故事有冲突、选择和情绪变化',
        ...getGenreStoryProfile(input.videoType).must_include,
        ...(input.storyBlueprint?.type_specific_requirements ?? []),
      ],
      return_json_fields: getGenreReturnJsonFields(input.videoType),
    },
  };

  return {
    ...base,
    system_prompt: buildSystemPrompt(input.videoType, input.presentationStyle, input.storyStructure, isMemoryMosaic),
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
