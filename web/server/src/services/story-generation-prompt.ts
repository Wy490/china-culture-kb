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
  MemoryMosaicStorySeed,
  WitnessMemory,
} from '@shared/types.js';
import {
  VIDEO_TYPE_CONFIG,
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
} from '@shared/types.js';

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
    primary_entries: Array<{ entry_name: string; role_in_story: string; summary: string }>;
    supporting_entries: Array<{ entry_name: string; role_in_story: string; summary: string }>;
  };
  memory_mosaic_context?: {
    present_day_seeker: string;
    trigger_object: string;
    central_question: string;
    witnesses: WitnessMemory[];
    final_reveal: string;
    ending_image: string;
  };
  output_contract: {
    must_provide: string[];
    should_respect: string[];
    return_json_fields: string[];
  };
  system_prompt: string;
  user_prompt: string;
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
  // Scene-specific
  atmosphere?: string;
  // Lecture/explainer-specific
  argument_points?: string[];
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

  const lines: string[] = [
    '你是一个擅长中文故事创作的编剧。',
    `你要创作一个${vtMeta.label}（${psMeta.label}风格）的完整故事方案。`,
    `叙事结构：${ssMeta.label}——${ssMeta.description}`,
  ];

  if (isMemoryMosaic) {
    lines.push(
      '这是回忆拼图式人物故事。现实线围绕追寻者与触发物件推进，回忆线必须像见证人口述。',
      '现实线的场次要写追寻者如何逐步接近真相，回忆线的场次要写见证人如何记住主角的选择。',
    );
  }

  // Type-specific guidance
  if (['culture_promo', 'heritage_promo', 'city_brand_promo', 'social_short'].includes(videoType)) {
    lines.push('这是宣传推广类成片。必须有核心视觉符号、核心信息和一句有力的口号/关键句。');
  }
  if (['scene_short', 'landscape_mood'].includes(videoType)) {
    lines.push('这是场景空间类成片。必须有明确的视觉路线和氛围描述。');
  }
  if (videoType === 'ai_comic_drama') {
    lines.push('这是AI漫剧。每个场次必须有对白和情绪标注。');
  }
  if (['explainer_video', 'lecture_video', 'education_training'].includes(videoType)) {
    lines.push('这是讲解教育类成片。必须有论证要点和知识大纲。');
  }
  if (videoType === 'documentary_short') {
    lines.push('这是微纪录片。必须有史料引用和实地素材标注。');
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
      lines.push(`- ${entry.entry_name}（角色：${entry.role_in_story}）: ${entry.summary}`);
    }
    if (pkg.knowledge_context.supporting_entries.length > 0) {
      lines.push('支撑条目：');
      for (const entry of pkg.knowledge_context.supporting_entries) {
        lines.push(`- ${entry.entry_name}（角色：${entry.role_in_story}）: ${entry.summary}`);
      }
    }
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

  lines.push(
    '',
    '请创作完整故事方案，返回 JSON 对象，包含以下字段：',
    'title, logline, theme, full_text, scene_breakdown, cultural_constraints, credibility_note',
    '',
    'scene_breakdown 中每场必须包含：scene_id, title, plot, key_action',
    '可选字段：conflict, dialogue_or_narration, visual_prompt, camera_suggestion, characters, cultural_note',
    '',
    'full_text 必须是完整叙事文本（不是摘要），长度与目标时长匹配。',
    'scene_breakdown 场次数量应与目标时长匹配（1分钟约2-4场，3分钟约3-6场，5分钟约5-7场）。',
  );

  // Type-specific output reminders
  const vt = pkg.context.video_type;
  if (['culture_promo', 'heritage_promo', 'city_brand_promo', 'social_short'].includes(vt)) {
    lines.push('宣传推广类必须额外返回：visual_symbols, core_message, slogan_or_key_sentence');
  }
  if (['scene_short', 'landscape_mood'].includes(vt)) {
    lines.push('场景空间类必须额外返回：atmosphere（在 scene_breakdown 的 cultural_note 或单独字段中体现视觉路线）');
  }
  if (vt === 'ai_comic_drama') {
    lines.push('AI漫剧的 scene_breakdown 每场必须有 dialogue_or_narration（对白/旁白）');
  }
  if (['explainer_video', 'lecture_video', 'education_training'].includes(vt)) {
    lines.push('讲解教育类必须额外返回：argument_points');
  }

  return lines.join('\n');
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
          })),
          supporting_entries: input.knowledgePack.supporting_entries.map(e => ({
            entry_name: e.entry_name,
            role_in_story: e.role_in_story,
            summary: e.summary,
          })),
        }
      : undefined,
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
    output_contract: {
      must_provide: ['title', 'logline', 'theme', 'full_text', 'scene_breakdown'],
      should_respect: [
        '保持来源条目的文化语境和可信度标注',
        '保持当前成片类型的叙事质感',
        '场次数量和时长匹配',
        '故事有冲突、选择和情绪变化',
      ],
      return_json_fields: [
        'title', 'logline', 'theme', 'full_text', 'scene_breakdown',
        'cultural_constraints', 'credibility_note',
      ],
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