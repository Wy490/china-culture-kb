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
  AvailableEvent,
  GenerationType,
  VideoType,
  PresentationStyle,
  SupportedDuration,
  PanelCount,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryScene,
  StoryCharacter,
  ActBeat,
  ProtagonistArc,
  GearsSegment,
  GearsSegmentsResponse,
  StoryListItem,
  KnowledgePack,
  StoryQualityReport,
} from '@shared/types.js';
import {
  GENERATION_TO_VIDEO_TYPE,
  VIDEO_TYPE_CONFIG,
  PRESENTATION_STYLE_CONFIG,
} from '@shared/types.js';
import {
  selectCentralEvent,
  generateDramaticContent,
  validateDramaticStory,
} from './dramatic-story.js';

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
// Dramatic function mapping (for scene_breakdown generation)
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
  return cleaned as StoryGenerateResult;
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
        conflict_score: 7,
        recommended_duration: recommendDuration(entryType, boldEvents.length),
        recommended_type: recommendEventType(entryType),
        recommended_video_type: routedVideoTypes[0],
      }))
    : [{
        event: '整体故事',
        conflict_score: 5,
        recommended_duration: recommendDuration(entryType, 0),
        recommended_type: recommendEventType(entryType),
        recommended_video_type: routedVideoTypes[0],
      }];

  const culturalRisks = computeCulturalRisks(entry);
  const recommendedDuration = recommendDuration(entryType, boldEvents.length);

  return success({
    entry_name: entryName,
    entry_type: entryType,
    original_user_query: originalUserQuery ?? undefined,
    recommended_types: recommendedTypes,
    recommended_video_types: recommendedVideoTypes,
    recommended_presentation_styles: recommendedPresentationStyles,
    available_events: availableEvents,
    recommended_duration: recommendedDuration,
    cultural_risks: culturalRisks,
  });
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

  // --- Select central event ---
  const boldEvents = extractBoldEvents(entry.story);
  const centralEvent = selectCentralEvent(entry, boldEvents, videoType, selected_event);

  // --- Generate dramatic story content ---
  const dramaticResult = generateDramaticContent({
    entry,
    centralEvent,
    videoType,
    presentationStyle,
    targetDuration,
    tone: tone ?? '',
    knowledgePack: knowledgePackToUse,
    originalUserQuery: original_user_query ?? outline,
  });

  // --- Validate story quality ---
  const qualityReport = validateDramaticStory({
    full_text: dramaticResult.full_text,
    scene_breakdown: dramaticResult.scene_breakdown,
    title: dramaticResult.title,
    selectedEvent: centralEvent,
  });

  if (!qualityReport.passed) {
    // Still return the result, but include the quality issues
    // Don't block generation entirely — the user can see the issues and refine
  }

  // --- Build story data ---
  const storyId = generateStoryId(primaryEntryName);
  const gearsSegmentsUrl = `/api/stories/${storyId}/gears-segments`;

  // Determine gears_segments
  const gearsSegments = output_gears_segments !== false
    ? dramaticResult.gears_segments
    : [];

  const storyData: StoryGenerateResult & { _request_meta: Record<string, unknown> } = {
    storyId,
    title: dramaticResult.title,
    generation_type: generationType,
    video_type: videoType,
    presentation_style: presentationStyle,
    source_entry: primaryEntryName,
    original_user_query: original_user_query ?? outline ?? undefined,
    logline: dramaticResult.logline,
    theme: dramaticResult.theme,
    full_text: dramaticResult.full_text,  // DRAMATIC story text, NOT entry.story
    scene_breakdown: dramaticResult.scene_breakdown,  // REAL scenes, NOT template concatenation
    gears_segments: gearsSegments,  // CINEMATIC scripts, NOT template concatenation
    gears_segments_url: gearsSegmentsUrl,
    cultural_constraints: dramaticResult.cultural_constraints,
    credibility_note: dramaticResult.credibility_note,
    // Knowledge pack for multi-entry traceability
    knowledge_pack: knowledgePackToUse,
    // Quality report
    quality_report: qualityReport,
    // Characters, act structure, protagonist arc — from dramatic engine
    characters: dramaticResult.characters,
    act_structure: dramaticResult.act_structure,
    protagonist_arc: dramaticResult.protagonist_arc,
    // Type-specific fields for promo/scene/explainer types (not dramatic)
    ...(videoType === 'culture_promo' || videoType === 'heritage_promo' || videoType === 'city_brand_promo' ? {
      visual_symbols: entry.keywords.slice(0, 5),
      craft_or_ritual_process: `核心技艺：${entry.keywords.slice(0, 3).join('、')}`,
      modern_connection: `${entry.name}在现代的文化传承与创新`,
      core_message: dramaticResult.logline,
      slogan_or_key_sentence: `${entry.type}之光——${entry.name}`,
    } : {}),
    ...(videoType === 'scene_short' || videoType === 'landscape_mood' ? {
      spatial_identity: entry.region,
      visual_route: dramaticResult.scene_breakdown.map(s => `${s.title}：${s.visual_prompt}`),
      time_layer: `${entry.name}的古今变迁与时空叠加`,
      atmosphere: videoType === 'landscape_mood' ? `${entry.region}的自然意境与山水灵韵` : `${entry.region}的场景氛围`,
    } : {}),
    ...(videoType === 'ai_comic_drama' ? {
      dialogue: dramaticResult.scene_breakdown.map(s => ({
        scene_id: s.scene_id,
        lines: s.characters.map(ch => ({
          character: ch,
          text: s.dialogue_or_narration ?? s.key_action,
          emotion: s.dramatic_function === '高潮' ? '激烈' : s.dramatic_function === '钩子开场' ? '紧张' : '克制',
        })),
      })),
    } : {}),
    ...(videoType === 'explainer_video' || videoType === 'lecture_video' ? {
      argument_points: entry.keywords.slice(0, 4).map(k => `${k}的核心解释`),
      knowledge_outline: dramaticResult.scene_breakdown.map(s => `${s.scene_id}. ${s.title}：${s.plot.substring(0, 40)}`),
    } : {}),
    ...(videoType === 'documentary_short' ? {
      source_quotes: [`据${entry.credibility}来源记载`],
      field_notes: [`${entry.region}实地考察记录要点`],
    } : {}),
    // Internal metadata
    _request_meta: {
      selected_event: centralEvent,
      target_video_duration: targetDuration,
      tone: tone || null,
      output_gears_segments: output_gears_segments ?? true,
      entry_type: entry.type,
      video_type: videoType,
      presentation_style: presentationStyle,
      created_at: new Date().toISOString(),
    },
  };

  // Ensure directory and write file — use video_type as directory name
  const dirPath = resolve(generatedRoot(), videoType);
  await mkdir(dirPath, { recursive: true });
  const filePath = resolve(dirPath, `${storyId}.json`);
  await writeFile(filePath, JSON.stringify(storyData, null, 2), 'utf-8');

  // Return to API without internal _request_meta
  return success(stripInternalFields(storyData));
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
        });
      } catch { continue; }
    }
  }

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
      return success(stripInternalFields(data));
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