// web/server/src/services/story-service.ts — Story business logic
// plan, generate+store (with dramatic narrative from KB entry), list, get, gears-segments
// Updated: VideoType/PresentationStyle dual-layer system + Dramatic story generation engine

import { resolve } from 'node:path';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { mcpGetFullEntryDetail, convertFullEntryDetail } from './mcp-proxy.js';
import { success, fail, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  EntryDetail,
  StoryPlanResult,
  RecommendedType,
  RecommendedVideoType,
  RecommendedPresentationStyle,
  RecommendedStoryStructure,
  AvailableEvent,
  GenerationType,
  VideoType,
  PresentationStyle,
  SupportedDuration,
  StoryStructureType,
  PanelCount,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryDetectedCharacter,
  StoryScene,
  StoryCharacter,
  ActBeat,
  ProtagonistArc,
  GearsSegment,
  GearsCharacterRolePosition,
  GearsSegmentsResponse,
  GearsDeliveryPackage,
  StoryListItem,
  KnowledgePack,
  KnowledgeSupplementTask,
  KnowledgeSupplementTaskCategory,
  StoryQualityReport,
  StoryBlueprint,
  StoryRepairTrace,
  ReferenceTrace,
  MemoryMosaicStorySeed,
  GearsWebhookStatus,
  GearsVideoReadyCallbackRequest,
  GearsVideoReadyCallbackResult,
  GearsVideoResult,
} from '@shared/types.js';
import {
  GENERATION_TO_VIDEO_TYPE,
  VIDEO_TYPE_CONFIG,
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
} from '@shared/types.js';
import {
  selectCentralEvent,
  conflictScore,
  generateDramaticContent,
  validateDramaticStory,
  extractQuotes,
} from './dramatic-story.js';
import {
  buildMemoryMosaicSeed,
  generateMemoryMosaicContent,
  validateMemoryMosaicStory,
} from './memory-mosaic-service.js';
import { validateReferenceSafety, combineQualityReports } from './reference-quality-service.js';
import {
  createProjectFromGeneratedStory,
  updateProjectCurrentGearsDelivery,
  updateProjectCurrentGearsWebhookStatus,
  updateProjectCurrentGearsVideo,
} from './project-service.js';
import { resolveModelProfile } from './model-catalog.js';
import { buildStoryGenerationPromptPackage } from './story-generation-prompt.js';
import { generateStoryWithAdapter } from './story-generation-model.js';
import type { StoryGenerationModelOutput } from './story-generation-prompt.js';
import { buildStoryBlueprint, attachBlueprintScenes } from './story-blueprint-service.js';
import { validateGenreStoryQuality } from './genre-quality-service.js';
import { buildStoryRepairPromptPackage, shouldAttemptStoryRepair } from './story-repair-service.js';
import { buildGearsDeliveryPackage, ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { buildEntryKnowledgeSummary, extractKeywords } from './entry-service.js';
import { notifyGearsStoryReady } from './gears-webhook-service.js';
import type { GearsWebhookResult } from './gears-webhook-service.js';
import { appendDomainPackEntries } from './domain-pack-service.js';

// ---------------------------------------------------------------------------
// Entry type → VideoType routing (entry Chinese type name → recommended VideoType list)
// ---------------------------------------------------------------------------

const TYPE_VIDEO_TYPE_ROUTING: Record<string, VideoType[]> = {
  '历史人物': ['character_story', 'historical_drama', 'ai_comic_drama', 'documentary_short', 'lecture_video'],
  '神话传说': ['legend_story', 'ai_comic_drama', 'scene_short', 'culture_promo', 'children_story'],
  '民间故事': ['character_story', 'legend_story', 'ai_comic_drama', 'children_story'],
  '非遗': ['heritage_promo', 'culture_promo', 'explainer_video', 'ai_comic_drama', 'social_short'],
  '地方戏曲': ['culture_promo', 'ai_comic_drama', 'heritage_promo'],
  '节庆习俗': ['culture_promo', 'scene_short', 'social_short', 'children_story'],
  '饮食文化': ['culture_promo', 'explainer_video', 'social_short', 'documentary_short'],
  '传统工艺': ['heritage_promo', 'culture_promo', 'explainer_video', 'documentary_short'],
  '名胜古迹': ['scene_short', 'landscape_mood', 'culture_promo', 'city_brand_promo', 'documentary_short'],
  '地方掌故': ['character_story', 'scene_short', 'lecture_video', 'documentary_short'],
  '宗教信仰': ['scene_short', 'culture_promo', 'explainer_video'],
  '民俗活动': ['culture_promo', 'social_short', 'children_story'],
};

// Keep old routing for backward compat (recommended_types field)
const TYPE_GENERATION_ROUTING: Record<string, GenerationType[]> = {
  '历史人物': ['character_story'],
  '神话传说': ['character_story', 'scene_short'],
  '民间故事': ['character_story'],
  '非遗': ['culture_promo'],
  '地方戏曲': ['culture_promo'],
  '节庆习俗': ['culture_promo'],
  '饮食文化': ['culture_promo'],
  '传统工艺': ['culture_promo'],
  '名胜古迹': ['scene_short', 'culture_promo'],
  '地方掌故': ['character_story', 'scene_short'],
  '宗教信仰': ['scene_short', 'culture_promo'],
  '民俗活动': ['culture_promo'],
};

// ---------------------------------------------------------------------------
// Entry type → StoryStructureType routing (Phase 5)
// ---------------------------------------------------------------------------

const TYPE_STORY_STRUCTURE_ROUTING: Record<string, StoryStructureType[]> = {
  '历史人物': ['single_event_drama', 'memory_mosaic_biography', 'witness_testimony', 'three_act_drama'],
  '神话传说': ['single_event_drama', 'object_clue_journey', 'three_act_drama'],
  '民间故事': ['single_event_drama', 'three_act_drama'],
  '非遗': ['object_clue_journey', 'memory_mosaic_biography', 'before_after_transformation'],
  '地方戏曲': ['single_event_drama', 'three_act_drama'],
  '节庆习俗': ['single_event_drama', 'object_clue_journey'],
  '饮食文化': ['object_clue_journey', 'single_event_drama'],
  '传统工艺': ['object_clue_journey', 'before_after_transformation'],
  '名胜古迹': ['object_clue_journey', 'witness_testimony', 'single_event_drama'],
  '地方掌故': ['case_reconstruction', 'witness_testimony', 'single_event_drama'],
  '宗教信仰': ['object_clue_journey', 'single_event_drama'],
  '民俗活动': ['single_event_drama', 'before_after_transformation'],
};
// ---------------------------------------------------------------------------

const DRAMATIC_FUNCTIONS = ['开场', '铺垫', '冲突升级', '高潮', '尾声'] as const;

const CAMERA_BY_FUNCTION: Record<string, string> = {
  '开场': '远景缓缓推进，建立空间感',
  '铺垫': '中景固定镜头，人物动作清晰',
  '冲突升级': '近景快速切换，节奏紧凑',
  '高潮': '特写+缓推交替，情绪聚焦',
  '尾声': '远景拉远，留白收束',
};

const TIME_OF_DAY_OPTIONS = ['清晨', '白天', '黄昏', '夜晚', '雨夜'] as const;

const DURATION_BY_SCENE_COUNT: Record<number, number> = {
  2: 30,   // 2 scenes → 30s each (1min total)
  3: 20,   // 3 scenes → 20s each (1min total)
  4: 15,   // 4 scenes → 15s each (1min total)
  5: 12,   // 5 scenes → 12s each (1min total)
};

const DURATION_3MIN: Record<number, number> = {
  3: 60,   // 3 scenes → 60s each
  4: 45,   // 4 scenes → 45s each
  5: 36,   // 5 scenes → 36s each
  6: 30,   // 6 scenes → 30s each
};

const DURATION_5MIN: Record<number, number> = {
  4: 75,   // 4 scenes → 75s each
  5: 60,   // 5 scenes → 60s each
  6: 50,   // 6 scenes → 50s each
  7: 43,   // 7 scenes → ~43s each
};

const DURATION_8MIN: Record<number, number> = {
  5: 96,   // 5 scenes → 96s each
  6: 80,   // 6 scenes → 80s each
  7: 69,   // 7 scenes → ~69s each
  8: 60,   // 8 scenes → 60s each
};

const DURATION_10MIN: Record<number, number> = {
  6: 100,  // 6 scenes → 100s each
  7: 86,   // 7 scenes → ~86s each
  8: 75,   // 8 scenes → 75s each
  9: 67,   // 9 scenes → ~67s each
};

const DURATION_15MIN: Record<number, number> = {
  8: 113,  // 8 scenes → ~113s each
  9: 100,  // 9 scenes → 100s each
  10: 90,  // 10 scenes → 90s each
  11: 82,  // 11 scenes → ~82s each
};

const DURATION_20MIN: Record<number, number> = {
  10: 120, // 10 scenes → 120s each
  11: 109, // 11 scenes → ~109s each
  12: 100, // 12 scenes → 100s each
};

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

// ---------------------------------------------------------------------------
// All VideoType values for directory scanning
// ---------------------------------------------------------------------------

const ALL_VIDEO_TYPES: VideoType[] = [
  'character_story', 'historical_drama', 'legend_story',
  'culture_promo', 'heritage_promo', 'city_brand_promo',
  'scene_short', 'landscape_mood',
  'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
  'children_story', 'social_short', 'ai_comic_drama',
];

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function generatedRoot(): string {
  return resolve(kbRoot(), '..', 'web', 'generated', 'stories');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  let sum = 0;
  for (const ch of text) sum += ch.charCodeAt(0);
  return sum.toString(36);
}

function generateStoryId(entryName: string): string {
  const now = new Date();
  const datePart = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
  const hashInput = entryName + String(Date.now());
  let sum = 0;
  for (const ch of hashInput) sum += ch.charCodeAt(0);
  const hash36 = (sum + Math.floor(Math.random() * 100)).toString(36);
  return `${datePart}-story-${hash36}`;
}

function extractBoldEvents(storyText: string): string[] {
  const events: string[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  const skipFields = ['省份', '地区', '类型', '简介', '故事梗概', '文化意义', '相关地点', '关键词', '来源', '可信度', '核实方法', '待核实点'];
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(storyText)) !== null) {
    const name = match[1].trim();
    if (!skipFields.includes(name)) events.push(name);
  }
  return events;
}

function computeCulturalRisks(entry: EntryDetail): string[] {
  const risks: string[] = [];
  if (entry.credibility === '存疑') risks.push('条目整体可信度存疑，需大量核实方可用于创作');
  if (entry.credibility === '待核实') risks.push('条目可信度待核实，核心情节可能缺乏佐证');
  for (const point of entry.unverifiedPoints) risks.push(`待核实：${point}`);
  return risks;
}

function buildSingleEntryKnowledgePack(
  entry: EntryDetail,
  context: { selectedEvent?: string; originalUserQuery?: string; outline?: string },
): KnowledgePack {
  const queryText = [
    context.originalUserQuery,
    context.outline,
    context.selectedEvent,
    entry.name,
  ].filter(Boolean).join(' ');
  const extractedKeywords = extractKeywords(queryText);
  const queryKeywords = context.selectedEvent
    ? [context.selectedEvent, ...extractedKeywords.filter(keyword => keyword !== context.selectedEvent)]
    : [...extractedKeywords, ...entry.keywords.slice(0, 5)];
  const summary = buildEntryKnowledgeSummary({
    name: entry.name,
    province: entry.province,
    region: entry.region,
    type: entry.type,
    summary: entry.summary,
    keywords: entry.keywords,
    credibility: entry.credibility,
    story: entry.story,
    culturalSignificance: entry.culturalSignificance,
    relatedLocationText: entry.relatedLocations.map(location => `${location.name} ${location.description}`).join(' '),
    sourcesText: entry.sources.join(' '),
    verificationText: entry.verificationMethod ?? '',
    unverifiedText: entry.unverifiedPoints.join(' '),
  }, queryKeywords);
  const primaryEntry = {
    entry_name: entry.name,
    province: entry.province,
    region: entry.region,
    type: entry.type,
    summary,
    score: 1,
    role_in_story: 'primary_entry',
    match_reason: '用户指定词条，自动注入全文知识包',
    keywords: entry.keywords,
    knowledge_domain: entry.knowledge_domain,
    entry_role: entry.entry_role,
    era: entry.era,
    asset_usage: entry.asset_usage,
    asset_split: entry.asset_split,
  };

  return {
    primary_entries: [primaryEntry],
    supporting_entries: appendDomainPackEntries([], {
      query: queryText,
      entry,
      primaryEntries: [primaryEntry],
      limit: 4,
    }),
    missing_needs: [],
    overall_confidence: 1,
  };
}

function buildKnowledgeSupplementTasks(
  knowledgePack: KnowledgePack | undefined,
  context: { storyId: string; createdAt: string },
): KnowledgeSupplementTask[] {
  if (!knowledgePack?.missing_needs.length) return [];
  return knowledgePack.missing_needs.map((missing) => {
    const guidance = buildSupplementTaskGuidance(missing);
    return {
      task_id: `${context.storyId}--supplement--${missing.need_id}`,
      need_id: missing.need_id,
      label: missing.label,
      description: `补充「${missing.label}」相关资料：${missing.message}`,
      category: guidance.category,
      recommended_fields: guidance.recommendedFields,
      intake_prompt: guidance.intakePrompt,
      status: 'open',
      source: 'knowledge_pack_missing_need',
      created_at: context.createdAt,
    };
  });
}

function buildSupplementTaskGuidance(missing: { need_id: string; label: string; message: string }): {
  category: KnowledgeSupplementTaskCategory;
  recommendedFields: string[];
  intakePrompt: string;
} {
  const text = `${missing.need_id} ${missing.label} ${missing.message}`;
  if (missing.need_id === 'supporting_characters' || /配角|见证人|对手|上官|亲友/.test(text)) {
    return {
      category: 'supporting_character',
      recommendedFields: ['人物姓名或身份', '与主角关系', '在事件中的作用', '可用对白/行动线索'],
      intakePrompt: `补录${missing.label}时，优先写清人物关系和他们推动冲突的具体行动。`,
    };
  }
  if (missing.need_id === 'main_character' || /人物|主角|生平|经历/.test(text)) {
    return {
      category: 'person_experience',
      recommendedFields: ['人物身份与时代背景', '关键经历时间线', '核心选择或冲突', '与故事主线的关系'],
      intakePrompt: `补录${missing.label}时，优先写清人物经历、关键选择和可验证来源。`,
    };
  }
  if (/建筑|古迹|祠|庙|寺|楼|桥|塔|院|空间|场景|地点/.test(text)) {
    return {
      category: 'architecture_detail',
      recommendedFields: ['建筑或地点名称', '空间结构与方位', '材质/构件/纹样', '历史用途与现场可拍细节'],
      intakePrompt: `补录${missing.label}时，优先写清建筑细节、空间关系和可视化特征。`,
    };
  }
  if (missing.need_id === 'historical_events' || /事件|过程|冲突|案件|战役|变故|始末/.test(text)) {
    return {
      category: 'event_process',
      recommendedFields: ['事件起因', '关键参与者', '发展过程', '结果影响与争议点'],
      intakePrompt: `补录${missing.label}时，优先写清事件过程、因果链和史实边界。`,
    };
  }
  if (missing.need_id === 'regional_context' || /地域|地方|城市|省|县|乡|村/.test(text)) {
    return {
      category: 'regional_context',
      recommendedFields: ['地理位置', '时代背景', '地方风俗', '与故事主题的关系'],
      intakePrompt: `补录${missing.label}时，优先写清地方背景和它如何影响人物选择。`,
    };
  }
  if (missing.need_id === 'cultural_background' || /文化|民俗|宗教|礼制|工艺|仪式|非遗/.test(text)) {
    return {
      category: 'cultural_background',
      recommendedFields: ['文化概念', '实践流程', '象征意义', '当代传承或禁忌'],
      intakePrompt: `补录${missing.label}时，优先写清文化背景、流程和不可虚构的边界。`,
    };
  }
  return {
    category: 'general',
    recommendedFields: ['资料主题', '关键事实', '来源依据', '可用于画面的细节'],
    intakePrompt: `补录${missing.label}时，优先写清事实、来源和可转化为故事/画面的细节。`,
  };
}

function recommendDuration(entryType: string, eventCount: number): SupportedDuration {
  if (entryType === '历史人物' && eventCount >= 5) return '5分钟';
  if (entryType === '历史人物' && eventCount >= 3) return '3分钟';
  if (entryType === '历史人物') return '1分钟';
  if (['非遗', '传统工艺', '饮食文化'].includes(entryType)) return '1分钟';
  if (['名胜古迹', '地方掌故'].includes(entryType)) return '1分钟';
  return '1分钟';
}

function recommendEventType(entryType: string): GenerationType {
  const types = TYPE_GENERATION_ROUTING[entryType];
  if (!types || types.length === 0) return 'character_story';
  return types[0];
}

// ---------------------------------------------------------------------------
// Extract characters from story text (simple heuristic)
// ---------------------------------------------------------------------------

function extractCharactersFromStory(storyText: string, entryName: string): StoryCharacter[] {
  const cleanName = entryName.replace(/——.*/, '').trim();
  const chars: StoryCharacter[] = [
    { name: cleanName, role: 'protagonist', description: `主角，${entryName}`, arc: '' },
  ];

  const nameRegex = /[^\x00-\x7F]{2,3}(?:公|君|卿|帅|将|帝|王|侯|臣|官|郎|翁|生|师|僧|仙|道|妇|女|郎)/g;
  const nameCounts = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = nameRegex.exec(storyText)) !== null) {
    const name = m[0];
    if (name === cleanName) continue;
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  for (const [name, count] of nameCounts) {
    if (count >= 2) {
      chars.push({ name, role: count >= 4 ? 'antagonist' : 'supporting', description: `出场${count}次的角色` });
    }
  }

  return chars.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Build scene_breakdown from entry data + selected event
// ---------------------------------------------------------------------------

function buildSceneBreakdown(
  entry: EntryDetail,
  selectedEvent: string | undefined,
  boldEvents: string[],
  targetDuration: SupportedDuration,
): StoryScene[] {
  const events: string[] = [];
  if (selectedEvent && selectedEvent !== '整体故事') {
    events.push(selectedEvent);
    const others = boldEvents.filter(e => e !== selectedEvent).slice(0, 2);
    events.push(...others);
  } else {
    events.push(...boldEvents.slice(0, 5));
  }

  if (events.length === 0) {
    events.push('整体故事');
  }

  // Determine scene count and per-scene duration based on target duration
  const durationSecMap: Record<string, number> = {
    '30秒': 30, '1分钟': 60, '3分钟': 180, '5分钟': 300,
    '8分钟': 480, '10分钟': 600, '15分钟': 900, '20分钟': 1200,
  };
  const totalSeconds = durationSecMap[targetDuration] ?? 60;
  const targetSceneCount = Math.max(2, Math.min(12, Math.round(totalSeconds / 60)));

  // Fill events up to target scene count
  while (events.length < targetSceneCount && boldEvents.length > events.length) {
    events.push(boldEvents[events.length]);
  }
  while (events.length < targetSceneCount) {
    events.push(`场景${events.length + 1}——${entry.type}延伸叙事`);
  }

  // Per-scene duration
  const perSceneDuration = Math.round(totalSeconds / events.length);

  const scenes: StoryScene[] = events.map((eventName, idx) => {
    const funcIndex = idx === 0 ? 0
      : idx === events.length - 1 ? 4
      : idx === events.length - 2 ? 3
      : Math.min(idx, 2);
    const func = DRAMATIC_FUNCTIONS[funcIndex];
    const timeOfDay = TIME_OF_DAY_OPTIONS[Math.min(idx, TIME_OF_DAY_OPTIONS.length - 1)];

    const keyVisuals = entry.keywords.slice(0, 3).join('、');
    const visualPrompt = `${entry.region}，${eventName}。${keyVisuals}构成核心画面`;

    const plot = `${eventName}——基于${entry.name}的故事梗概中该事件的叙述`;

    const relatedNotes = entry.unverifiedPoints.filter(p =>
      eventName.includes(p.substring(0, 4)) || p.includes(eventName.substring(0, 4))
    );
    const culturalNote = relatedNotes.length > 0
      ? relatedNotes[0]
      : '本场景基于知识库条目，具体细节请核实来源';

    return {
      scene_id: idx + 1,
      title: eventName,
      duration_sec: perSceneDuration,
      location: entry.region,
      time_of_day: timeOfDay,
      dramatic_function: func,
      plot,
      key_action: `${func === '高潮' ? '关键抉择时刻' : func === '开场' ? '建立情境与角色' : '推进叙事冲突'}`,
      characters: extractCharactersFromStory(entry.story, entry.name)
        .filter(c => entry.story.includes(c.name))
        .map(c => c.name)
        .slice(0, 3),
      visual_prompt: visualPrompt,
      camera_suggestion: CAMERA_BY_FUNCTION[func] ?? '中景固定镜头',
      cultural_note: culturalNote,
    };
  });

  return scenes;
}

// ---------------------------------------------------------------------------
// Build gears_segments from scene_breakdown (with video_type/presentation_style)
// ---------------------------------------------------------------------------

function buildGearsSegments(
  scenes: StoryScene[],
  storyId: string,
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): GearsSegment[] {
  return scenes.map((scene) => {
    const panelCount = PANEL_COUNT_BY_DURATION[scene.duration_sec] ?? 6;
    const scriptText = `【${scene.dramatic_function}】${scene.location}，${scene.time_of_day}。${scene.visual_prompt}。${scene.key_action}——${scene.title}。${scene.camera_suggestion}。`;
    const visualFocus = [
      scene.location,
      ...scene.visual_prompt.split(/[，、。]/).filter(s => s.length > 1 && s.length < 8).slice(0, 2),
    ];

    const vtMeta = VIDEO_TYPE_CONFIG[videoType];
    const psMeta = PRESENTATION_STYLE_CONFIG[presentationStyle];
    const segmentPromptHint = `${vtMeta.label}/${psMeta.label}风格提示: ${psMeta.description}，场景${scene.scene_id}聚焦${scene.key_action}`;

    return {
      segment_id: scene.scene_id,
      source_scene_id: scene.scene_id,
      duration_sec: scene.duration_sec,
      panel_count: panelCount,
      script_text: scriptText,
      purpose: scene.dramatic_function,
      visual_focus: visualFocus.slice(0, 3),
      cultural_constraints: scene.cultural_note ? [scene.cultural_note] : [],
      video_type: videoType,
      presentation_style: presentationStyle,
      segment_prompt_hint: segmentPromptHint,
    };
  });
}

// ---------------------------------------------------------------------------
// Build act_structure for character_story
// ---------------------------------------------------------------------------

function buildActStructure(scenes: StoryScene[]): ActBeat[] {
  if (scenes.length === 0) return [];
  const acts: ActBeat[] = [];

  const actMap: Record<string, number[]> = {};
  for (const s of scenes) {
    if (!actMap[s.dramatic_function]) actMap[s.dramatic_function] = [];
    actMap[s.dramatic_function].push(s.scene_id);
  }

  let actNum = 1;
  for (const func of DRAMATIC_FUNCTIONS) {
    const ids = actMap[func];
    if (ids && ids.length > 0) {
      acts.push({ act: actNum, beat: func, scene_ids: ids, purpose: func });
      actNum++;
    }
  }

  return acts;
}

// ---------------------------------------------------------------------------
// Strip internal _request_meta from story data before returning to API
// ---------------------------------------------------------------------------

function stripInternalFields(data: StoryGenerateResult): StoryGenerateResult {
  const cleaned = { ...data } as Record<string, unknown>;
  delete cleaned._request_meta;
  return cleaned as unknown as StoryGenerateResult;
}

function buildInitialGearsWebhookStatus(): GearsWebhookStatus {
  const webhookUrl = process.env.GEARS_WEBHOOK_URL;
  if (!webhookUrl) return { status: 'not_configured' };
  return {
    status: 'pending',
    webhook_target: safeWebhookTarget(webhookUrl),
  };
}

function gearsWebhookStatusFromResult(result: GearsWebhookResult): GearsWebhookStatus {
  if (result.status === 'skipped') {
    return {
      status: 'not_configured',
      last_attempt_at: result.attemptedAt,
    };
  }

  if (result.status === 'sent') {
    return {
      status: 'sent',
      webhook_target: safeWebhookTarget(result.webhookUrl),
      attempts: result.attempts,
      last_attempt_at: result.attemptedAt,
      last_success_at: result.attemptedAt,
    };
  }

  return {
    status: 'failed',
    webhook_target: safeWebhookTarget(result.webhookUrl),
    attempts: result.attempts,
    last_attempt_at: result.attemptedAt,
    last_error_at: result.attemptedAt,
    last_error: result.error,
  };
}

function safeWebhookTarget(webhookUrl: string): string {
  try {
    const url = new URL(webhookUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'configured endpoint';
  }
}

// ---------------------------------------------------------------------------
// Resolve VideoType from request — prefer video_type, fall back to generation_type
// ---------------------------------------------------------------------------

function resolveVideoType(request: StoryGenerateRequest): VideoType {
  return request.video_type
    ?? (request.generation_type ? GENERATION_TO_VIDEO_TYPE[request.generation_type] : undefined)
    ?? 'character_story';
}

function resolveGenerationType(videoType: VideoType): GenerationType {
  // Map video_type back to one of the 3 legacy generation_types
  if (videoType === 'character_story' || videoType === 'historical_drama'
    || videoType === 'legend_story' || videoType === 'ai_comic_drama'
    || videoType === 'children_story') return 'character_story';
  if (videoType === 'culture_promo' || videoType === 'heritage_promo'
    || videoType === 'city_brand_promo' || videoType === 'social_short'
    || videoType === 'documentary_short' || videoType === 'explainer_video'
    || videoType === 'lecture_video' || videoType === 'education_training') return 'culture_promo';
  return 'scene_short';
}

// ---------------------------------------------------------------------------
// Resolve StoryStructureType from request (Phase 5)
// ---------------------------------------------------------------------------

function resolveStoryStructure(request: StoryGenerateRequest, videoType: VideoType, entryType?: string): StoryStructureType {
  // 1. User explicitly specified → use it (after compatibility check)
  if (request.story_structure) {
    const config = STORY_STRUCTURE_CONFIG[request.story_structure];
    if (config && config.compatible_video_types.includes(videoType)) {
      return request.story_structure;
    }
    // Incompatible → fall back to default
  }

  // 2. Derive from video_type default
  const vtConfig = VIDEO_TYPE_CONFIG[videoType];
  // Character-driven video types default to single_event_drama
  if (['character_story', 'historical_drama', 'ai_comic_drama', 'children_story'].includes(videoType)) {
    return 'single_event_drama';
  }
  // Promo/explainer types default to lecture_argument or object_clue_journey
  if (['explainer_video', 'lecture_video', 'education_training'].includes(videoType)) {
    return 'lecture_argument';
  }
  // Documentary defaults to witness_testimony for人物条目, single_event_drama otherwise
  if (videoType === 'documentary_short' && entryType === '历史人物') {
    return 'witness_testimony';
  }
  // Scene/landscape defaults to object_clue_journey for名胜古迹, single_event_drama otherwise
  if (['scene_short', 'landscape_mood'].includes(videoType)) {
    return 'object_clue_journey';
  }
  // Promo types default to object_clue_journey
  if (['culture_promo', 'heritage_promo', 'city_brand_promo', 'social_short'].includes(videoType)) {
    return 'object_clue_journey';
  }

  // 3. Fallback
  return 'single_event_drama';
}

// ---------------------------------------------------------------------------
// planStory — preview recommendation for an entry
// ---------------------------------------------------------------------------

export async function planStory(entryName: string, originalUserQuery?: string): Promise<ApiResponse<StoryPlanResult>> {
  const mcpDetail = await mcpGetFullEntryDetail(entryName);
  if (!mcpDetail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${entryName}" not found`);
  }

  const entry = convertFullEntryDetail(mcpDetail);
  const entryType = entry.type;

  // Backward compat: old recommended_types
  const routedTypes = TYPE_GENERATION_ROUTING[entryType] || ['character_story'];
  const recommendedTypes: RecommendedType[] = routedTypes.map((genType, index) => {
    const reasonMap: Record<string, string> = {
      character_story: `该条目类型"${entryType}"适合以人物/故事为核心的叙事`,
      culture_promo: `该条目类型"${entryType}"适合文化推广展示`,
      scene_short: `该条目类型"${entryType}"适合场景演绎短片`,
    };
    return { generation_type: genType, reason: reasonMap[genType] || `适合${genType}模式`, priority: index + 1 };
  });

  // New: recommended_video_types
  const routedVideoTypes = TYPE_VIDEO_TYPE_ROUTING[entryType] || ['character_story'];
  const recommendedVideoTypes: RecommendedVideoType[] = routedVideoTypes.map((vt, index) => {
    const meta = VIDEO_TYPE_CONFIG[vt];
    const compatible = meta.compatible_entry_types.includes(entryType);
    return {
      video_type: vt,
      reason: compatible
        ? `"${entryType}"条目适合${meta.label}——${meta.description}`
        : `${meta.label}——${meta.description}（可选）`,
      priority: index + 1,
    };
  });

  // New: recommended_presentation_styles (derived from top video types)
  const topVideoTypes = routedVideoTypes.slice(0, 3);
  const recommendedPresentationStyles: RecommendedPresentationStyle[] = topVideoTypes.map(vt => {
    const meta = VIDEO_TYPE_CONFIG[vt];
    const styleMeta = PRESENTATION_STYLE_CONFIG[meta.default_presentation_style];
    return {
      presentation_style: meta.default_presentation_style,
      reason: `${meta.label}默认表现形式: ${styleMeta.label}——${styleMeta.description}`,
    };
  });

  const boldEvents = extractBoldEvents(entry.story);
  const availableEvents: AvailableEvent[] = boldEvents.length > 0
    ? boldEvents.map((eventName) => ({
        event: eventName,
        conflict_score: Math.max(1, Math.min(10, Math.round(conflictScore(eventName, entry.story) / 2))),
        recommended_duration: recommendDuration(entryType, boldEvents.length),
        recommended_type: recommendEventType(entryType),
        recommended_video_type: routedVideoTypes[0],
      }))
    : [{
        event: '整体故事',
        conflict_score: 1,
        recommended_duration: recommendDuration(entryType, 0),
        recommended_type: recommendEventType(entryType),
        recommended_video_type: routedVideoTypes[0],
      }];

  const culturalRisks = computeCulturalRisks(entry);
  const recommendedDuration = recommendDuration(entryType, boldEvents.length);

  // New (Phase 5): recommended_story_structures based on entry type
  const routedStoryStructures = TYPE_STORY_STRUCTURE_ROUTING[entryType] || ['single_event_drama'];
  const recommendedStoryStructures: RecommendedStoryStructure[] = routedStoryStructures.map((ss, index) => {
    const meta = STORY_STRUCTURE_CONFIG[ss];
    return {
      story_structure: ss,
      reason: `"${entryType}"条目适合${meta.label}——${meta.description}`,
      priority: index + 1,
    };
  });

  return success({
    entry_name: entryName,
    entry_type: entryType,
    original_user_query: originalUserQuery ?? undefined,
    recommended_types: recommendedTypes,
    recommended_video_types: recommendedVideoTypes,
    recommended_presentation_styles: recommendedPresentationStyles,
    recommended_story_structures: recommendedStoryStructures,
    available_events: availableEvents,
    recommended_duration: recommendedDuration,
    cultural_risks: culturalRisks,
  });
}

// ---------------------------------------------------------------------------
// Helper: extract process descriptions from story text
// ---------------------------------------------------------------------------

function extractProcessFromStory(storyText: string): string | null {
  const processKeywords = ['制作', '制造', '工序', '步骤', '流程', '工艺', '技法', '手法', '过程', '编制', '织造', '雕刻', '酿造', '烧制', '铸造'];
  const paragraphs = storyText.split(/\n\n+/).filter(p => p.trim());
  const processParagraphs = paragraphs.filter(p =>
    processKeywords.some(kw => p.includes(kw))
  );
  if (processParagraphs.length > 0) {
    const text = processParagraphs[0].replace(/\*\*/g, '').substring(0, 80);
    return `核心技艺流程：${text}`;
  }
  return null;
}

function deriveTypeSpecificStoryFields(input: {
  videoType: VideoType;
  storyResult: StoryAssembly;
  modelOutput?: StoryGenerationModelOutput | null;
  entry: EntryDetail;
}): Partial<StoryGenerateResult> {
  const { videoType, storyResult, modelOutput, entry } = input;
  if (videoType === 'culture_promo' || videoType === 'heritage_promo' || videoType === 'city_brand_promo' || videoType === 'social_short') {
    return {
      visual_symbols: modelOutput?.visual_symbols ?? [
        ...entry.relatedLocations.map(l => typeof l === 'string' ? l : (l as any).name ?? '').filter(Boolean).slice(0, 2),
        ...entry.keywords.filter(k => !['人物', '故事', '历史'].includes(k)).slice(0, 3),
      ],
      craft_or_ritual_process: modelOutput?.craft_or_ritual_process
        ?? extractProcessFromStory(entry.story)
        ?? (videoType === 'heritage_promo' ? `核心技艺流程：${entry.keywords.slice(0, 3).join('→')}` : undefined),
      modern_connection: modelOutput?.modern_connection
        ?? entry.culturalSignificance?.substring(0, 80)
        ?? `${entry.name}在现代的文化传承与创新`,
      core_message: modelOutput?.core_message ?? storyResult.logline,
      slogan_or_key_sentence: modelOutput?.slogan_or_key_sentence ?? (extractQuotes(entry.story).length > 0
        ? extractQuotes(entry.story)[0]
        : `${entry.type}之光——${entry.name.split('——')[0]}`),
    };
  }

  if (videoType === 'scene_short' || videoType === 'landscape_mood') {
    return {
      spatial_identity: modelOutput?.spatial_identity
        ?? `${entry.region}·${entry.relatedLocations.map(l => typeof l === 'string' ? l : (l as any).name ?? '').filter(Boolean).slice(0, 2).join('、')}`,
      visual_route: modelOutput?.visual_route
        ?? storyResult.scene_breakdown.map(s => `${s.title}：${s.visual_prompt}`),
      time_layer: modelOutput?.time_layer
        ?? entry.culturalSignificance?.substring(0, 60)
        ?? `${entry.name}的古今变迁与时空叠加`,
      atmosphere: modelOutput?.atmosphere ?? (videoType === 'landscape_mood'
        ? entry.keywords.filter(k => ['山', '水', '云', '雾', '日', '月', '风', '雨', '春', '夏', '秋', '冬'].some(w => k.includes(w))).join('、') || `${entry.region}的自然意境`
        : `${entry.region}的场景氛围`),
    };
  }

  if (videoType === 'ai_comic_drama') {
    return {
      dialogue: storyResult.scene_breakdown.map(s => ({
        scene_id: s.scene_id,
        lines: s.characters.map(ch => ({
          character: ch,
          text: s.dialogue_or_narration ?? s.key_action,
          emotion: s.dramatic_function === '高潮' ? '激烈' : s.dramatic_function === '钩子开场' ? '紧张' : '克制',
        })),
      })),
    };
  }

  if (videoType === 'explainer_video' || videoType === 'lecture_video' || videoType === 'education_training') {
    return {
      argument_points: modelOutput?.argument_points ?? storyResult.scene_breakdown.slice(0, 4).map(s => s.key_action),
      knowledge_outline: modelOutput?.knowledge_outline
        ?? storyResult.scene_breakdown.map(s => `${s.scene_id}. ${s.title}：${s.plot.substring(0, 40)}`),
    };
  }

  if (videoType === 'documentary_short') {
    return {
      source_quotes: modelOutput?.source_quotes ?? extractQuotes(entry.story).slice(0, 3),
      field_notes: modelOutput?.field_notes ?? [
        ...entry.relatedLocations.map(l => {
          const name = typeof l === 'string' ? l : (l as any).name ?? '';
          return name ? `${name}实地考察记录要点` : '';
        }).filter(Boolean).slice(0, 2),
        ...entry.unverifiedPoints.filter(p => p.includes('实地') || p.includes('考察') || p.includes('遗迹')).slice(0, 1),
      ],
    };
  }

  return {};
}

function applyStoryAssemblyToStoryData(input: {
  storyData: StoryGenerateResult;
  storyResult: StoryAssembly;
  modelOutput?: StoryGenerationModelOutput | null;
  entry: EntryDetail;
  videoType: VideoType;
  outputGearsSegments: boolean;
}): void {
  Object.assign(input.storyData, {
    title: input.storyResult.title,
    logline: input.storyResult.logline,
    theme: input.storyResult.theme,
    full_text: input.storyResult.full_text,
    scene_breakdown: input.storyResult.scene_breakdown,
    gears_segments: input.outputGearsSegments ? input.storyResult.gears_segments : [],
    cultural_constraints: input.storyResult.cultural_constraints,
    credibility_note: input.storyResult.credibility_note,
    characters: input.storyResult.characters,
    act_structure: input.storyResult.act_structure,
    protagonist_arc: input.storyResult.protagonist_arc,
    ...deriveTypeSpecificStoryFields({
      videoType: input.videoType,
      storyResult: input.storyResult,
      modelOutput: input.modelOutput,
      entry: input.entry,
    }),
  });
}

// ---------------------------------------------------------------------------
// Compatibility check: model scene_breakdown must structurally match local skeleton.
// If scene count or scene_ids don't align, the merge would produce inconsistent results
// (full_text from model + scene_breakdown hybrid that tells a different story).
// Incompatible → whole fallback to local result.
// Exported for focused testing (story-generation-model.test.ts).
// ---------------------------------------------------------------------------

export function isModelSceneBreakdownCompatible(
  localScenes: StoryScene[],
  modelScenes: Array<{ scene_id: number }>,
): boolean {
  // Must have same number of scenes
  if (modelScenes.length !== localScenes.length) return false;

  // Scene IDs must match exactly and be unique — ensures merge-by-ID works.
  const localIds = new Set(localScenes.map(s => s.scene_id));
  const modelIds = new Set(modelScenes.map(s => s.scene_id));

  if (localIds.size !== localScenes.length) return false;
  if (modelIds.size !== modelScenes.length) return false;
  if (modelIds.size !== localIds.size) return false;

  for (const id of localIds) {
    if (!modelIds.has(id)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Merge external model output onto local structural skeleton
// Strategy: keep local structural fields (scene_id, duration, panel_count),
//           replace creative content fields with model output,
//           rebuild gears_segments from merged scene data.
// ONLY called when isModelSceneBreakdownCompatible passes — guarantees
// full_text and scene_breakdown are structurally aligned.
// Exported for focused testing (story-generation-model.test.ts).
// ---------------------------------------------------------------------------

export function mergeModelOutputOntoLocalSkeleton(
  local: {
    title: string;
    logline: string;
    theme: string;
    full_text: string;
    scene_breakdown: StoryScene[];
    gears_segments: GearsSegment[];
    cultural_constraints: string[];
    credibility_note: string;
    characters: StoryCharacter[];
    act_structure: ActBeat[];
    protagonist_arc: ProtagonistArc[];
  },
  modelOutput: StoryGenerationModelOutput,
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): typeof local {
  // Merge scene_breakdown: keep local structural metadata, inject model creative content
  // Since compatibility check passed, every model scene matches a local scene by ID.
  const mergedSceneBreakdown: StoryScene[] = local.scene_breakdown.map((localScene) => {
    // Find matching model scene by scene_id (guaranteed to exist after compat check)
    const modelScene = modelOutput.scene_breakdown.find(ms => ms.scene_id === localScene.scene_id)!;

    return {
      ...localScene,                          // Keep structural fields: scene_id, duration_sec, location, time_of_day, dramatic_function
      title: modelScene.title || localScene.title,
      plot: modelScene.plot || localScene.plot,
      key_action: modelScene.key_action || localScene.key_action,
      conflict: modelScene.conflict || localScene.conflict,
      dialogue_or_narration: modelScene.dialogue_or_narration || localScene.dialogue_or_narration,
      visual_prompt: modelScene.visual_prompt || localScene.visual_prompt,
      camera_suggestion: modelScene.camera_suggestion || localScene.camera_suggestion,
      characters: modelScene.characters?.length ? modelScene.characters : localScene.characters,
      cultural_note: modelScene.cultural_note || localScene.cultural_note,
    };
  });

  // Rebuild gears_segments from merged scene data
  const mergedGearsSegments = buildGearsSegments(mergedSceneBreakdown, '', videoType, presentationStyle);

  // Merge top-level creative fields from model output
  const mergedCharacters: StoryCharacter[] = modelOutput.characters?.length
    ? modelOutput.characters.map(c => ({
        name: c.name,
        role: c.role,
        description: c.description,
        arc: c.arc,
      }))
    : local.characters;

  const mergedProtagonistArc: ProtagonistArc[] = modelOutput.protagonist_arc?.length
    ? modelOutput.protagonist_arc
    : local.protagonist_arc;

  return {
    title: modelOutput.title || local.title,
    logline: modelOutput.logline || local.logline,
    theme: modelOutput.theme || local.theme,
    full_text: modelOutput.full_text || local.full_text,
    scene_breakdown: mergedSceneBreakdown,
    gears_segments: mergedGearsSegments,
    cultural_constraints: modelOutput.cultural_constraints?.length ? modelOutput.cultural_constraints : local.cultural_constraints,
    credibility_note: modelOutput.credibility_note || local.credibility_note,
    characters: mergedCharacters,
    act_structure: local.act_structure, // Keep local act_structure (structural)
    protagonist_arc: mergedProtagonistArc,
  };
}

type StoryAssembly = {
  title: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: StoryScene[];
  gears_segments: GearsSegment[];
  cultural_constraints: string[];
  credibility_note: string;
  characters: StoryCharacter[];
  act_structure: ActBeat[];
  protagonist_arc: ProtagonistArc[];
};

const ROLE_POSITION_TO_STORY_ROLE: Record<GearsCharacterRolePosition, string> = {
  '主角': 'protagonist',
  '反派': 'antagonist',
  '配角': 'supporting',
  '路人': 'passerby',
  '群演': 'crowd',
};

function normalizeHintCharacterName(name: string): string {
  return name.replace(/[「」『』"'“”‘’（）()【】\[\]\s]/g, '').trim();
}

function buildHintCharacterDescription(hint: StoryDetectedCharacter): string {
  const parts = [
    hint.role_position,
    hint.character_kind === 'named_person' ? '具名人物' : hint.character_kind,
    hint.age_range,
    hint.gender,
    hint.source_text ? `来自大纲：“${hint.source_text}”` : undefined,
  ].filter(Boolean);
  return parts.join('；');
}

function extractSceneMatchTokens(hint: StoryDetectedCharacter): string[] {
  const rawText = `${hint.name} ${hint.source_text}`;
  const cleaned = rawText
    .replace(/[，。！？；：、“”‘’"'（）()【】\[\]\s]/g, ' ')
    .replace(/[一个某位这位那位正在走过来说听她讲的了和与在把将]/g, ' ');
  const tokens = new Set<string>();
  const directName = normalizeHintCharacterName(hint.name);
  if (directName) tokens.add(directName);

  for (const token of cleaned.split(/\s+/)) {
    const normalized = normalizeHintCharacterName(token);
    if (normalized.length >= 2 && normalized.length <= 10) tokens.add(normalized);
    for (let size = 2; size <= 4; size += 1) {
      for (let i = 0; i <= normalized.length - size; i += 1) {
        const gram = normalized.slice(i, i + size);
        if (gram.length >= 2) tokens.add(gram);
      }
    }
  }

  return [...tokens].filter(token => token.length >= 2);
}

function sceneSearchText(scene: StoryScene): string {
  return [
    scene.title,
    scene.location,
    scene.time_of_day,
    scene.dramatic_function,
    scene.plot,
    scene.key_action,
    scene.dialogue_or_narration,
    scene.visual_prompt,
    scene.camera_suggestion,
    scene.cultural_note,
    ...(scene.characters ?? []),
  ].filter(Boolean).join(' ');
}

function findHintSceneIds(hint: StoryDetectedCharacter, scenes: StoryScene[]): Set<number> {
  const matched = new Set<number>();
  const name = normalizeHintCharacterName(hint.name);
  const sourceText = hint.source_text.trim();
  const tokens = extractSceneMatchTokens(hint);
  let bestSceneId: number | undefined;
  let bestScore = 0;

  for (const scene of scenes) {
    const text = sceneSearchText(scene);
    if ((name && text.includes(name)) || (sourceText && text.includes(sourceText))) {
      matched.add(scene.scene_id);
      continue;
    }

    const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestSceneId = scene.scene_id;
    }
  }

  if (matched.size > 0) return matched;
  if (bestSceneId !== undefined && bestScore >= 2) return new Set([bestSceneId]);
  if (scenes.length === 0) return matched;

  if (hint.asset_stability === 'recurring') {
    return new Set(scenes.map(scene => scene.scene_id));
  }
  return new Set([scenes[0].scene_id]);
}

// Exported for focused tests and to keep role-hint behavior independent from
// the external model adapter. It normalizes outline-detected roles into the
// final story object so GEARS receives stable character assets.
export function mergeCharacterHintsIntoStoryResult(
  story: StoryAssembly,
  characterHints: StoryDetectedCharacter[] | undefined,
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): StoryAssembly {
  if (!characterHints?.length) return story;

  const existingNames = new Set((story.characters ?? []).map(character => normalizeHintCharacterName(character.name)));
  const sceneBreakdown = story.scene_breakdown.map(scene => ({
    ...scene,
    characters: [...(scene.characters ?? [])],
  }));
  const characters = [...(story.characters ?? [])];

  for (const hint of characterHints) {
    const name = normalizeHintCharacterName(hint.name);
    if (!name) continue;

    if (!existingNames.has(name)) {
      characters.push({
        name,
        role: ROLE_POSITION_TO_STORY_ROLE[hint.role_position] ?? 'supporting',
        description: buildHintCharacterDescription(hint),
        arc: hint.asset_stability === 'recurring'
          ? `${name}作为${hint.role_position}贯穿多个单元，推动或见证主要行动。`
          : `${name}作为${hint.role_position}在对应单元提供行动、对白或氛围支撑。`,
      });
      existingNames.add(name);
    }

    const matchedSceneIds = findHintSceneIds(hint, sceneBreakdown);
    for (const scene of sceneBreakdown) {
      if (!matchedSceneIds.has(scene.scene_id)) continue;
      if (!scene.characters.includes(name)) {
        scene.characters = [...scene.characters, name];
      }
    }
  }

  return {
    ...story,
    characters,
    scene_breakdown: sceneBreakdown,
    gears_segments: buildGearsSegments(sceneBreakdown, '', videoType, presentationStyle),
  };
}

// ---------------------------------------------------------------------------
// generateAndStoreStory — create story with dramatic narrative from KB entry
// REFACTORED: uses dramatic-story engine instead of template concatenation
// ---------------------------------------------------------------------------

export async function generateAndStoreStory(
  request: StoryGenerateRequest,
): Promise<ApiResponse<StoryGenerateResult>> {
  const { entry_name, original_user_query, selected_event, target_video_duration, tone, output_gears_segments, outline, knowledge_pack } = request;

  // Resolve video_type and generation_type
  const videoType = resolveVideoType(request);
  const generationType = request.generation_type ?? resolveGenerationType(videoType);
  const presentationStyle = request.presentation_style ?? VIDEO_TYPE_CONFIG[videoType].default_presentation_style;
  const targetDuration = target_video_duration ?? VIDEO_TYPE_CONFIG[videoType].default_duration;

  // --- Determine the primary entry to use ---
  let primaryEntryName: string;
  let entry: EntryDetail;
  let knowledgePackToUse: KnowledgePack | undefined = knowledge_pack;

  if (knowledge_pack && knowledge_pack.primary_entries.length > 0) {
    // Use the highest-scoring primary entry from knowledge_pack
    primaryEntryName = knowledge_pack.primary_entries[0].entry_name;
    const mcpDetail = await mcpGetFullEntryDetail(primaryEntryName);
    if (!mcpDetail) {
      return fail(ErrorCodes.ENTRY_NOT_FOUND, `Primary entry "${primaryEntryName}" not found`);
    }
    entry = convertFullEntryDetail(mcpDetail);
  } else if (entry_name) {
    // Use explicit entry_name (backward compat)
    primaryEntryName = entry_name;
    const mcpDetail = await mcpGetFullEntryDetail(primaryEntryName);
    if (!mcpDetail) {
      return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${primaryEntryName}" not found`);
    }
    entry = convertFullEntryDetail(mcpDetail);
  } else {
    return fail(ErrorCodes.VALIDATION_ERROR, 'Either entry_name or knowledge_pack with primary_entries must be provided');
  }
  if (!knowledgePackToUse || knowledgePackToUse.primary_entries.length === 0) {
    knowledgePackToUse = buildSingleEntryKnowledgePack(entry, {
      selectedEvent: selected_event,
      originalUserQuery: original_user_query,
      outline,
    });
  }
  const storyStructure = resolveStoryStructure(request, videoType, entry.type);

  const selectedModelProfile = resolveModelProfile(request.model_profile_id);

  // --- Select central event ---
  const boldEvents = extractBoldEvents(entry.story);
  const centralEvent = selectCentralEvent(entry, boldEvents, videoType, selected_event);
  const preliminaryStoryBlueprint = buildStoryBlueprint({
    entry,
    videoType,
    presentationStyle,
    storyStructure,
    targetDuration,
    centralEvent,
    knowledgePack: knowledgePackToUse,
  });

  // --- Generate story content ---
  // Strategy: always run local engine as fallback, then try external model adapter.
  // If adapter succeeds, merge its creative content onto the local structural skeleton.
  // If adapter fails or is not configured, use the full local result unchanged.

  let localResult: {
    title: string;
    logline: string;
    theme: string;
    full_text: string;
    scene_breakdown: StoryScene[];
    gears_segments: GearsSegment[];
    cultural_constraints: string[];
    credibility_note: string;
    characters: StoryCharacter[];
    act_structure: ActBeat[];
    protagonist_arc: ProtagonistArc[];
  };

  let memoryMosaicSeed: MemoryMosaicStorySeed | undefined;
  let referenceTrace: ReferenceTrace[] | undefined;

  // --- Step 1: Always generate local content as structural skeleton + fallback ---
  if (storyStructure === 'memory_mosaic_biography') {
    const seed = buildMemoryMosaicSeed(entry, centralEvent, knowledgePackToUse);
    memoryMosaicSeed = seed;

    localResult = generateMemoryMosaicContent({
      entry,
      centralEvent,
      videoType,
      presentationStyle,
      targetDuration,
      tone: tone ?? '',
      memorySeed: seed,
      knowledgePack: knowledgePackToUse,
      originalUserQuery: original_user_query ?? outline,
    });

    if (request.style_pack_ids && request.style_pack_ids.length > 0) {
      referenceTrace = request.style_pack_ids.map(spId => ({
        style_pack_id: spId,
        applied_rules: ['用物件开场', '用见证人回忆推进', '结尾呼应物件', `${storyStructure}结构规则`],
        source_story_structure: storyStructure,
      }));
    } else {
      referenceTrace = [{
        applied_rules: ['用物件开场', '用见证人回忆推进', '结尾呼应物件', `${storyStructure}结构规则`],
        source_story_structure: storyStructure,
      }];
    }
  } else {
    localResult = generateDramaticContent({
      entry,
      centralEvent,
      videoType,
      presentationStyle,
      targetDuration,
      tone: tone ?? '',
      knowledgePack: knowledgePackToUse,
      originalUserQuery: original_user_query ?? outline,
    });

    if (request.style_pack_ids && request.style_pack_ids.length > 0) {
      referenceTrace = request.style_pack_ids.map(spId => ({
        style_pack_id: spId,
        applied_rules: [`Using ${storyStructure} structure with ${videoType}/${presentationStyle}`],
        source_story_structure: storyStructure,
      }));
    }
  }

  // --- Step 2: Try external model adapter ---
  const promptPackage = buildStoryGenerationPromptPackage({
    entry,
    request,
    videoType,
    presentationStyle,
    storyStructure,
    targetDuration,
    tone: tone ?? '',
    selectedEvent: centralEvent,
    knowledgePack: knowledgePackToUse,
    memoryMosaicSeed,
    storyBlueprint: preliminaryStoryBlueprint,
  });

  const adapterResult = await generateStoryWithAdapter({
    pkg: promptPackage,
    modelProfileId: selectedModelProfile.id,
  });

  // --- Step 3: Determine final result — merge or fallback ---
  let storyResult: typeof localResult;
  let adapterTrace: string | undefined;
  let generationMode: 'external_model' | 'local_fallback' | 'local_only';
  let generationUsedFallback: boolean;

  if (adapterResult.output) {
    // Adapter produced output — check structural compatibility before merging.
    // If model scene_breakdown is incompatible with local skeleton (different count
    // or scene_ids), fall back entirely to local result to avoid inconsistent
    // full_text vs scene_breakdown.
    const compatible = isModelSceneBreakdownCompatible(
      localResult.scene_breakdown,
      adapterResult.output.scene_breakdown,
    );

    if (compatible) {
      // Compatible — merge creative content onto local structural skeleton
      storyResult = mergeModelOutputOntoLocalSkeleton(localResult, adapterResult.output, videoType, presentationStyle);
      adapterTrace = `provider:${adapterResult.provider}`;
      generationMode = 'external_model';
      generationUsedFallback = false;
    } else {
      // Incompatible — whole fallback to local result
      storyResult = localResult;
      adapterTrace = `fallback:scene_breakdown_incompatible_with_local_skeleton`;
      generationMode = 'local_fallback';
      generationUsedFallback = true;
    }
  } else {
    // Adapter failed or not configured — use full local result unchanged
    storyResult = localResult;
    adapterTrace = adapterResult.used_fallback
      ? `fallback:${adapterResult.reason || 'model unavailable'}`
      : undefined;
    generationMode = adapterResult.used_fallback ? 'local_fallback' : 'local_only';
    generationUsedFallback = adapterResult.used_fallback;
  }

  // Add adapter trace to reference_trace
  if (adapterTrace) {
    referenceTrace = [
      ...(referenceTrace ?? []),
      {
        applied_rules: [adapterTrace],
        source_story_structure: storyStructure,
      },
    ];
  }

  storyResult = mergeCharacterHintsIntoStoryResult(
    storyResult,
    request.character_hints,
    videoType,
    presentationStyle,
  );

  // --- Build story data ---
  const storyId = generateStoryId(primaryEntryName);
  const finalStoryBlueprint: StoryBlueprint = attachBlueprintScenes(
    preliminaryStoryBlueprint,
    storyResult.scene_breakdown,
    storyId,
  );

  // --- Validate story quality (unified for both paths) ---
  let baseQualityReport: StoryQualityReport;
  if (storyStructure === 'memory_mosaic_biography' && memoryMosaicSeed) {
    baseQualityReport = validateMemoryMosaicStory({
      full_text: storyResult.full_text,
      scene_breakdown: storyResult.scene_breakdown,
      memory_seed: memoryMosaicSeed,
    });
  } else {
    baseQualityReport = validateDramaticStory({
      full_text: storyResult.full_text,
      scene_breakdown: storyResult.scene_breakdown,
      title: storyResult.title,
      selectedEvent: centralEvent,
    });
  }
  const gearsSegmentsUrl = `/api/stories/${storyId}/gears-segments`;

  // Determine gears_segments
  const gearsSegments = output_gears_segments !== false
    ? storyResult.gears_segments
    : [];

  const createdAt = new Date().toISOString();
  const supplementTasks = buildKnowledgeSupplementTasks(knowledgePackToUse, { storyId, createdAt });

  const storyData: StoryGenerateResult & { _request_meta: Record<string, unknown> } = {
    storyId,
    title: storyResult.title,
    model_profile_id: selectedModelProfile.id,
    generation_source: generationMode === 'external_model'
      ? selectedModelProfile.label
      : generationMode === 'local_fallback'
        ? `本地引擎 (未使用所选模型)`
        : '本地引擎',
    generation_mode: generationMode,
    generation_used_fallback: generationUsedFallback,
    generation_type: generationType,
    video_type: videoType,
    presentation_style: presentationStyle,
    source_entry: primaryEntryName,
    original_user_query: original_user_query ?? outline ?? undefined,
    logline: storyResult.logline,
    theme: storyResult.theme,
    full_text: storyResult.full_text,
    scene_breakdown: storyResult.scene_breakdown,
    gears_segments: gearsSegments,
    gears_segments_url: gearsSegmentsUrl,
    cultural_constraints: storyResult.cultural_constraints,
    credibility_note: storyResult.credibility_note,
    // Phase 5: story_structure + reference trace + memory_mosaic_seed
    story_structure: storyStructure,
    story_blueprint: finalStoryBlueprint,
    reference_trace: referenceTrace,
    memory_mosaic_seed: memoryMosaicSeed,
    // Knowledge pack for multi-entry traceability
    knowledge_pack: knowledgePackToUse,
    supplement_tasks: supplementTasks,
    // Quality report
    quality_report: baseQualityReport,
    gears_webhook: buildInitialGearsWebhookStatus(),
    // Characters, act structure, protagonist arc — from engine
    characters: storyResult.characters,
    act_structure: storyResult.act_structure,
    protagonist_arc: storyResult.protagonist_arc,
    // Type-specific fields — prefer model output if adapter succeeded, else derive from entry + result
    ...deriveTypeSpecificStoryFields({
      videoType,
      storyResult,
      modelOutput: adapterResult.output,
      entry,
    }),
    // Internal metadata
    _request_meta: {
      selected_event: centralEvent,
      target_video_duration: targetDuration,
      tone: tone || null,
      output_gears_segments: output_gears_segments ?? true,
      entry_type: entry.type,
      video_type: videoType,
      presentation_style: presentationStyle,
      created_at: createdAt,
      model_provider: adapterResult.provider,
      model_used_fallback: adapterResult.used_fallback,
      model_fallback_reason: adapterResult.reason,
      genre_strictness: request.genre_strictness ?? 'balanced',
      auto_repair: request.auto_repair ?? false,
    },
  };
  storyData.quality_report = validateGenreStoryQuality({
    story: storyData,
    baseReport: baseQualityReport,
    blueprint: finalStoryBlueprint,
  });
  const repairTrace: StoryRepairTrace[] = [];
  if (shouldAttemptStoryRepair({
    autoRepair: request.auto_repair,
    qualityReport: storyData.quality_report,
    strictness: request.genre_strictness,
  })) {
    const beforeScore = storyData.quality_report.genre_score;
    const repairPromptPackage = buildStoryRepairPromptPackage({
      basePackage: promptPackage,
      story: storyData,
      qualityReport: storyData.quality_report,
      blueprint: finalStoryBlueprint,
      strictness: request.genre_strictness,
    });
    const repairAdapterResult = await generateStoryWithAdapter({
      pkg: repairPromptPackage,
      modelProfileId: selectedModelProfile.id,
    });
    const trace: StoryRepairTrace = {
      trace_id: `${storyId}--repair-1`,
      attempted: true,
      applied: false,
      reason: repairAdapterResult.reason ?? `provider:${repairAdapterResult.provider}`,
      model_profile_id: selectedModelProfile.id,
      before_genre_score: beforeScore,
      actions: storyData.quality_report.repair_actions ?? [],
    };

    if (repairAdapterResult.output) {
      const compatible = isModelSceneBreakdownCompatible(
        storyResult.scene_breakdown,
        repairAdapterResult.output.scene_breakdown,
      );
      if (compatible) {
        const repairedResult = mergeModelOutputOntoLocalSkeleton(
          storyResult,
          repairAdapterResult.output,
          videoType,
          presentationStyle,
        );
        applyStoryAssemblyToStoryData({
          storyData,
          storyResult: repairedResult,
          modelOutput: repairAdapterResult.output,
          entry,
          videoType,
          outputGearsSegments: output_gears_segments !== false,
        });
        const repairedBaseQualityReport = storyStructure === 'memory_mosaic_biography' && memoryMosaicSeed
          ? validateMemoryMosaicStory({
              full_text: repairedResult.full_text,
              scene_breakdown: repairedResult.scene_breakdown,
              memory_seed: memoryMosaicSeed,
            })
          : validateDramaticStory({
              full_text: repairedResult.full_text,
              scene_breakdown: repairedResult.scene_breakdown,
              title: repairedResult.title,
              selectedEvent: centralEvent,
            });
        storyData.quality_report = validateGenreStoryQuality({
          story: storyData,
          baseReport: repairedBaseQualityReport,
          blueprint: finalStoryBlueprint,
        });
        trace.after_genre_score = storyData.quality_report.genre_score;
        if ((trace.after_genre_score ?? 0) >= (beforeScore ?? 0)) {
          storyResult = repairedResult;
          trace.applied = true;
          trace.reason = 'repair_applied';
        } else {
          applyStoryAssemblyToStoryData({
            storyData,
            storyResult,
            modelOutput: adapterResult.output,
            entry,
            videoType,
            outputGearsSegments: output_gears_segments !== false,
          });
          storyData.quality_report = validateGenreStoryQuality({
            story: storyData,
            baseReport: baseQualityReport,
            blueprint: finalStoryBlueprint,
          });
          trace.reason = 'repair_score_not_improved';
        }
      } else {
        trace.reason = 'repair_scene_breakdown_incompatible';
      }
    }
    repairTrace.push(trace);
  }
  if (repairTrace.length > 0) {
    storyData.repair_trace = repairTrace;
  }
  storyData.gears_delivery = buildGearsDeliveryPackage(storyData);

  const storyWithProject = await createProjectFromGeneratedStory(storyData, createdAt);

  // Ensure directory and write file — use video_type as directory name
  const dirPath = resolve(generatedRoot(), videoType);
  await mkdir(dirPath, { recursive: true });
  const filePath = resolve(dirPath, `${storyId}.json`);
  await writeFile(filePath, JSON.stringify(storyWithProject, null, 2), 'utf-8');

  // Return to API without internal _request_meta
  const apiStory = stripInternalFields(storyWithProject);
  void notifyGearsStoryReady(apiStory)
    .then(result => updateProjectCurrentGearsWebhookStatus(
      apiStory.project_id,
      apiStory.storyId,
      gearsWebhookStatusFromResult(result),
    ))
    .catch(() => undefined);
  return success(apiStory);
}

// ---------------------------------------------------------------------------
// listStories — return enriched story list (scans all video_type dirs)
// ---------------------------------------------------------------------------

export async function listStories(
  generationType?: string,
  videoType?: string,
): Promise<ApiResponse<StoryListItem[]>> {
  const root = generatedRoot();
  const results: StoryListItem[] = [];

  // Determine which directories to scan
  const typesToScan: string[] = videoType
    ? [videoType]
    : generationType
      ? [generationType]
      : ALL_VIDEO_TYPES;

  for (const typeDir of typesToScan) {
    const dirPath = resolve(root, typeDir);
    let files: string[];
    try { files = await readdir(dirPath); } catch { continue; }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = resolve(dirPath, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        const meta = data._request_meta as Record<string, unknown> | undefined;
        results.push({
          storyId: data.storyId || file.replace('.json', ''),
          title: data.title || '',
          generation_type: data.generation_type || typeDir,
          video_type: data.video_type || data.generation_type || typeDir,
          presentation_style: data.presentation_style || '',
          source_entry: data.source_entry || '',
          logline: data.logline || '',
          created_at: meta?.created_at as string ?? '',
          has_gears_segments: (data.gears_segments?.length ?? 0) > 0,
          scene_count: data.scene_breakdown?.length ?? 0,
          credibility_note: data.credibility_note || '',
          model_profile_id: data.model_profile_id || undefined,
          generation_source: data.generation_source || undefined,
          generation_mode: data.generation_mode ?? 'local_only',
          generation_used_fallback: data.generation_used_fallback ?? false,
        });
      } catch { continue; }
    }
  }

  results.sort((a, b) => {
    if (!a.created_at && !b.created_at) return a.title.localeCompare(b.title, 'zh-CN');
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    return b.created_at.localeCompare(a.created_at);
  });

  return success(results);
}

// ---------------------------------------------------------------------------
// getStory — find and read a story JSON file (strip _request_meta)
// ---------------------------------------------------------------------------

export async function getStory(storyId: string): Promise<ApiResponse<StoryGenerateResult>> {
  const root = generatedRoot();

  for (const typeDir of ALL_VIDEO_TYPES) {
    const filePath = resolve(root, typeDir, `${storyId}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as StoryGenerateResult & { _request_meta?: unknown };
      const cleaned = stripInternalFields(data);
      // 旧故事 JSON 缺 generation_mode/generation_used_fallback → 填充默认值
      cleaned.generation_mode = cleaned.generation_mode ?? 'local_only';
      cleaned.generation_used_fallback = cleaned.generation_used_fallback ?? false;
      cleaned.gears_delivery = ensureGearsDeliveryPackage(cleaned);
      return success(cleaned);
    } catch { continue; }
  }

  return fail(ErrorCodes.STORY_NOT_FOUND, `Story "${storyId}" not found`);
}

// ---------------------------------------------------------------------------
// getGearsSegments — extract gears_segments from story, add schema_version
// ---------------------------------------------------------------------------

export async function getGearsSegments(storyId: string): Promise<ApiResponse<GearsSegmentsResponse>> {
  const storyResult = await getStory(storyId);
  if (!storyResult.ok || !storyResult.data) {
    return fail(ErrorCodes.GEARS_SEGMENTS_NOT_FOUND, `Gears segments for story "${storyId}" not found`);
  }

  const story = storyResult.data;
  const segments = story.gears_segments || [];
  const totalDurationSec = segments.reduce((sum, seg) => sum + seg.duration_sec, 0);

  const response: GearsSegmentsResponse = {
    schema_version: 'gears-segments/v2',
    storyId: story.storyId,
    title: story.title,
    total_duration_sec: totalDurationSec,
    segments,
  };

  return success(response);
}

// ---------------------------------------------------------------------------
// getGearsDeliveryPackage — GEARS script delivery package (assets + units)
// ---------------------------------------------------------------------------

export async function getGearsDeliveryPackage(storyId: string): Promise<ApiResponse<GearsDeliveryPackage>> {
  const storyResult = await getStory(storyId);
  if (!storyResult.ok || !storyResult.data) {
    return fail(ErrorCodes.GEARS_SEGMENTS_NOT_FOUND, `Gears delivery package for story "${storyId}" not found`);
  }

  return success(ensureGearsDeliveryPackage(storyResult.data));
}

export async function updateGearsDeliveryMarkdown(
  storyId: string,
  markdown: string,
): Promise<ApiResponse<GearsDeliveryPackage>> {
  const root = generatedRoot();

  for (const typeDir of ALL_VIDEO_TYPES) {
    const filePath = resolve(root, typeDir, `${storyId}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as StoryGenerateResult & { _request_meta?: unknown };
      const baseDelivery = ensureGearsDeliveryPackage(data);
      const updatedDelivery: GearsDeliveryPackage = {
        ...baseDelivery,
        markdown,
      };
      const updatedStory = {
        ...data,
        gears_delivery: updatedDelivery,
      };

      await writeFile(filePath, JSON.stringify(updatedStory, null, 2), 'utf-8');
      await updateProjectCurrentGearsDelivery(data.project_id, data.storyId, updatedDelivery);
      return success(updatedDelivery);
    } catch {
      continue;
    }
  }

  return fail(ErrorCodes.STORY_NOT_FOUND, `Story "${storyId}" not found`);
}

export async function updateGearsVideoReady(
  request: GearsVideoReadyCallbackRequest,
): Promise<ApiResponse<GearsVideoReadyCallbackResult>> {
  const root = generatedRoot();
  const now = new Date().toISOString();

  for (const typeDir of ALL_VIDEO_TYPES) {
    const filePath = resolve(root, typeDir, `${request.storyId}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as StoryGenerateResult & { _request_meta?: unknown };
      const previous = data.gears_video;
      const gearsVideo: GearsVideoResult = {
        status: request.status,
        video_url: request.video_url ?? previous?.video_url,
        thumbnail_url: request.thumbnail_url ?? previous?.thumbnail_url,
        received_at: previous?.received_at ?? now,
        updated_at: now,
      };
      const updatedStory = {
        ...data,
        gears_video: gearsVideo,
      };

      await writeFile(filePath, JSON.stringify(updatedStory, null, 2), 'utf-8');
      await updateProjectCurrentGearsVideo(data.project_id, data.storyId, gearsVideo);
      return success({
        storyId: data.storyId,
        project_id: data.project_id,
        gears_video: gearsVideo,
      });
    } catch {
      continue;
    }
  }

  return fail(ErrorCodes.STORY_NOT_FOUND, `Story "${request.storyId}" not found`);
}
