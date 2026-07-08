// web/shared/types.ts — Web API type definitions (independent, NOT reusing MCP types)

// ---------------------------------------------------------------------------
// Generation type (3 modes) — backward compat, superseded by VideoType
// ---------------------------------------------------------------------------

export type GenerationType = 'character_story' | 'culture_promo' | 'scene_short';

// ---------------------------------------------------------------------------
// Video type (15 成片类型) — supersedes GenerationType
// ---------------------------------------------------------------------------

export type VideoType =
  | 'character_story'
  | 'historical_drama'
  | 'legend_story'
  | 'culture_promo'
  | 'heritage_promo'
  | 'city_brand_promo'
  | 'scene_short'
  | 'landscape_mood'
  | 'documentary_short'
  | 'explainer_video'
  | 'lecture_video'
  | 'education_training'
  | 'children_story'
  | 'social_short'
  | 'ai_comic_drama';

export type NarrativePatternId =
  | 'mortal_growth'
  | 'infinite_mission'
  | 'historical_causal_story'
  | 'power_strategy'
  | 'hero_choice'
  | 'folk_legend_trial'
  | 'mystery_reveal'
  | 'ensemble_threads'
  | 'object_clue_journey'
  | 'craft_mastery'
  | 'ritual_process'
  | 'brand_symbol'
  | 'city_day_journey'
  | 'social_hook_contrast'
  | 'documentary_investigation'
  | 'knowledge_gap_explainer'
  | 'lecture_case_argument'
  | 'training_loop'
  | 'space_walkthrough'
  | 'poetic_landscape'
  | 'children_fable'
  | 'novel_scene_compression'
  | 'character_arc_adaptation'
  | 'serial_hook_adaptation'
  | 'cinematic_setpiece_adaptation'
  | 'theme_preserving_adaptation'
  | 'source_fidelity_adaptation'
  | 'chapter_slice_adaptation'
  | 'dialogue_scene_adaptation'
  | 'worldbuilding_grounding'
  | 'platform_short_drama_hook'
  | 'wuxia_chivalric_epic'
  | 'wuxia_lone_blade_mystery'
  | 'wuxia_sect_growth'
  | 'wuxia_revenge_journey'
  | 'wuxia_court_jianghu'
  | 'wuxia_romance_honor';

export type NarrativeSubjectFamily =
  | 'general'
  | 'adaptation'
  | 'wuxia'
  | 'history'
  | 'folklore'
  | 'promo'
  | 'education'
  | 'documentary'
  | 'space'
  | 'children';

export type NarrativeStyleAxisId =
  | 'world_scale'
  | 'dialogue_density'
  | 'action_density'
  | 'mystery_density'
  | 'romance_density'
  | 'hook_intensity'
  | 'ensemble_degree'
  | 'blank_space'
  | 'historical_weight'
  | 'fidelity';

export type NarrativeStyleAxisValue = 'low' | 'medium' | 'high';

export interface NarrativeStyleAxis {
  axis_id: NarrativeStyleAxisId;
  label: string;
  value: NarrativeStyleAxisValue;
  note: string;
}

export interface NarrativePattern {
  pattern_id: NarrativePatternId;
  label: string;
  subject_family?: NarrativeSubjectFamily;
  subgenre_tags?: string[];
  user_facing_summary?: string;
  style_axes?: NarrativeStyleAxis[];
  reference_archetypes: string[];
  narrative_engine: string;
  protagonist_engine: string;
  conflict_engine: string;
  pacing_pattern: string[];
  scene_recipes: string[];
  quality_signals: string[];
  avoid: string[];
}

export interface NarrativePatternCatalog {
  patterns: NarrativePattern[];
  video_type_map: Record<VideoType, NarrativePatternId[]>;
}

// ---------------------------------------------------------------------------
// Presentation style (11 表现形式)
// ---------------------------------------------------------------------------

export type PresentationStyle =
  | 'cinematic'
  | 'documentary'
  | 'host_narration'
  | 'voiceover_montage'
  | 'vertical_drama'
  | 'ai_comic'
  | 'animation_2d'
  | 'ink_style'
  | 'children_animation'
  | 'museum_exhibit'
  | 'social_media_fastcut';

// ---------------------------------------------------------------------------
// Backward compatibility: generation_type → video_type mapping
// ---------------------------------------------------------------------------

export const GENERATION_TO_VIDEO_TYPE: Record<GenerationType, VideoType> = {
  character_story: 'character_story',
  culture_promo: 'culture_promo',
  scene_short: 'scene_short',
};

// ---------------------------------------------------------------------------
// Video type metadata — group, label, description, default style, duration hint
// ---------------------------------------------------------------------------

export type VideoTypeGroup = '剧情故事类' | '宣传推广类' | '讲解教育类' | '场景空间类';

export interface VideoTypeMeta {
  id: VideoType;
  group: VideoTypeGroup;
  label: string;
  description: string;
  default_presentation_style: PresentationStyle;
  default_duration: SupportedDuration;
  compatible_entry_types: string[];
}

export const VIDEO_TYPE_CONFIG: Record<VideoType, VideoTypeMeta> = {
  character_story: {
    id: 'character_story', group: '剧情故事类', label: '人物故事',
    description: '以人物为核心、叙事驱动的短剧故事', default_presentation_style: 'cinematic',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '神话传说', '民间故事', '地方掌故'],
  },
  historical_drama: {
    id: 'historical_drama', group: '剧情故事类', label: '历史剧情短片',
    description: '基于历史事件，戏剧化还原关键冲突时刻', default_presentation_style: 'cinematic',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '名胜古迹', '地方掌故'],
  },
  legend_story: {
    id: 'legend_story', group: '剧情故事类', label: '神话/传说故事',
    description: '民间传说和神话故事的影视化叙事', default_presentation_style: 'ink_style',
    default_duration: '1分钟', compatible_entry_types: ['神话传说', '民间故事', '宗教信仰'],
  },
  ai_comic_drama: {
    id: 'ai_comic_drama', group: '剧情故事类', label: 'AI 漫剧单片',
    description: '一次性单片/单集漫画风格分镜叙事，含对白和表情标注', default_presentation_style: 'ai_comic',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '神话传说', '民间故事', '非遗', '传统工艺'],
  },
  children_story: {
    id: 'children_story', group: '剧情故事类', label: '儿童故事片',
    description: '面向儿童的简化叙事，含动画风格标注', default_presentation_style: 'children_animation',
    default_duration: '3分钟', compatible_entry_types: ['神话传说', '民间故事', '节庆习俗'],
  },
  culture_promo: {
    id: 'culture_promo', group: '宣传推广类', label: '文化宣传片',
    description: '传统文化主题推广视频，视觉符号+核心信息', default_presentation_style: 'voiceover_montage',
    default_duration: '1分钟', compatible_entry_types: ['非遗', '传统工艺', '饮食文化', '地方戏曲', '节庆习俗', '民俗活动'],
  },
  heritage_promo: {
    id: 'heritage_promo', group: '宣传推广类', label: '非遗/工艺宣传片',
    description: '聚焦非遗技艺和传统工艺的流程展示', default_presentation_style: 'documentary',
    default_duration: '3分钟', compatible_entry_types: ['非遗', '传统工艺'],
  },
  city_brand_promo: {
    id: 'city_brand_promo', group: '宣传推广类', label: '城市/文旅宣传片',
    description: '城市或地方文旅品牌形象片', default_presentation_style: 'voiceover_montage',
    default_duration: '1分钟', compatible_entry_types: ['名胜古迹', '地方掌故', '饮食文化'],
  },
  social_short: {
    id: 'social_short', group: '宣传推广类', label: '竖屏短视频',
    description: '适合社交平台竖屏播放的快节奏短内容', default_presentation_style: 'social_media_fastcut',
    default_duration: '30秒', compatible_entry_types: ['非遗', '饮食文化', '节庆习俗', '民俗活动'],
  },
  documentary_short: {
    id: 'documentary_short', group: '讲解教育类', label: '微纪录片',
    description: '纪实风格短纪录片，含史料和实地素材', default_presentation_style: 'documentary',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '名胜古迹', '地方掌故'],
  },
  explainer_video: {
    id: 'explainer_video', group: '讲解教育类', label: '知识讲解视频',
    description: '知识型内容讲解，含图文示意和逻辑脉络', default_presentation_style: 'host_narration',
    default_duration: '3分钟', compatible_entry_types: ['非遗', '传统工艺', '饮食文化', '节庆习俗', '宗教信仰'],
  },
  lecture_video: {
    id: 'lecture_video', group: '讲解教育类', label: '宣讲片',
    description: '观点阐释和论理宣讲，含论点标注', default_presentation_style: 'host_narration',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '地方掌故'],
  },
  education_training: {
    id: 'education_training', group: '讲解教育类', label: '教育/培训片',
    description: '面向教学场景的培训内容', default_presentation_style: 'host_narration',
    default_duration: '10分钟', compatible_entry_types: ['非遗', '传统工艺', '节庆习俗'],
  },
  scene_short: {
    id: 'scene_short', group: '场景空间类', label: '场景短片',
    description: '以空间/地点为核心的演绎短片，含视觉路线', default_presentation_style: 'cinematic',
    default_duration: '1分钟', compatible_entry_types: ['名胜古迹', '地方掌故', '宗教信仰'],
  },
  landscape_mood: {
    id: 'landscape_mood', group: '场景空间类', label: '山水意境片',
    description: '山水自然意境表达，含氛围标注', default_presentation_style: 'ink_style',
    default_duration: '1分钟', compatible_entry_types: ['名胜古迹'],
  },
};

// ---------------------------------------------------------------------------
// Presentation style metadata
// ---------------------------------------------------------------------------

export interface PresentationStyleMeta {
  id: PresentationStyle;
  label: string;
  description: string;
}

export const PRESENTATION_STYLE_CONFIG: Record<PresentationStyle, PresentationStyleMeta> = {
  cinematic: { id: 'cinematic', label: '影视叙事', description: '电影化叙事风格，含镜头语言' },
  documentary: { id: 'documentary', label: '纪实风格', description: '纪录片风格，含史料引用和实景' },
  host_narration: { id: 'host_narration', label: '主持讲述', description: '主讲人面对镜头讲解' },
  voiceover_montage: { id: 'voiceover_montage', label: '旁白+蒙太奇', description: '旁白驱动+画面蒙太奇剪辑' },
  vertical_drama: { id: 'vertical_drama', label: '竖屏短剧', description: '竖屏格式剧情内容' },
  ai_comic: { id: 'ai_comic', label: 'AI 漫剧', description: '漫画分镜+对白+表情标注' },
  animation_2d: { id: 'animation_2d', label: '2D 动画', description: '二维动画风格' },
  ink_style: { id: 'ink_style', label: '水墨风格', description: '中国水墨画视觉风格' },
  children_animation: { id: 'children_animation', label: '儿童动画', description: '面向儿童的动画风格' },
  museum_exhibit: { id: 'museum_exhibit', label: '展陈风格', description: '博物馆展陈叙事风格' },
  social_media_fastcut: { id: 'social_media_fastcut', label: '社媒快切', description: '快节奏剪辑，适合短视频平台' },
};

// ---------------------------------------------------------------------------
// Story structure type (8 叙事结构) — third dimension alongside video_type + presentation_style
// ---------------------------------------------------------------------------

export type StoryStructureType =
  | 'single_event_drama'
  | 'three_act_drama'
  | 'memory_mosaic_biography'
  | 'witness_testimony'
  | 'object_clue_journey'
  | 'before_after_transformation'
  | 'case_reconstruction'
  | 'lecture_argument';

export type ReferenceStrength = 'light' | 'medium' | 'strong';
export type GenreStrictness = 'loose' | 'balanced' | 'strict';
export type StoryGenerationPriority = 'balanced' | 'plot_first' | 'knowledge_first';
export type SourceMaterialMode = 'generate_from_knowledge' | 'adapt_user_novel';
export type LocalizationMode = 'allow_related_influence' | 'strict_direct_events';

export interface StoryStructureMeta {
  id: StoryStructureType;
  label: string;
  description: string;
  compatible_video_types: VideoType[];
  compatible_entry_types: string[];
}

export const STORY_STRUCTURE_CONFIG: Record<StoryStructureType, StoryStructureMeta> = {
  single_event_drama: {
    id: 'single_event_drama',
    label: '单事件戏剧',
    description: '围绕一个核心事件展开目标、阻力、选择和结果',
    compatible_video_types: ['character_story', 'historical_drama', 'ai_comic_drama', 'children_story'],
    compatible_entry_types: ['历史人物', '神话传说', '民间故事', '地方掌故'],
  },
  three_act_drama: {
    id: 'three_act_drama',
    label: '三幕式戏剧',
    description: '经典三幕结构：建立→冲突→解决',
    compatible_video_types: ['character_story', 'historical_drama', 'ai_comic_drama'],
    compatible_entry_types: ['历史人物', '地方掌故'],
  },
  memory_mosaic_biography: {
    id: 'memory_mosaic_biography',
    label: '回忆拼图式人物故事',
    description: '通过后人追寻、关键物件和多位见证人的回忆拼出主角生平',
    compatible_video_types: ['character_story', 'historical_drama', 'documentary_short', 'ai_comic_drama'],
    compatible_entry_types: ['历史人物', '非遗', '名胜古迹', '地方掌故'],
  },
  witness_testimony: {
    id: 'witness_testimony',
    label: '见证人叙述',
    description: '以多个见证人的口述推动故事',
    compatible_video_types: ['documentary_short', 'lecture_video', 'historical_drama'],
    compatible_entry_types: ['历史人物', '地方掌故', '名胜古迹'],
  },
  object_clue_journey: {
    id: 'object_clue_journey',
    label: '物件线索追寻',
    description: '由一件物品串联地点、人物和历史片段',
    compatible_video_types: ['documentary_short', 'scene_short', 'culture_promo'],
    compatible_entry_types: ['名胜古迹', '非遗', '传统工艺', '地方掌故'],
  },
  before_after_transformation: {
    id: 'before_after_transformation',
    label: '前后转变',
    description: '对比主角前后状态，突出转变的力量',
    compatible_video_types: ['character_story', 'culture_promo', 'documentary_short'],
    compatible_entry_types: ['历史人物', '非遗', '传统工艺'],
  },
  case_reconstruction: {
    id: 'case_reconstruction',
    label: '案例重构',
    description: '重构一个事件或案例的完整经过',
    compatible_video_types: ['documentary_short', 'explainer_video', 'lecture_video'],
    compatible_entry_types: ['地方掌故', '历史人物'],
  },
  lecture_argument: {
    id: 'lecture_argument',
    label: '讲述论证',
    description: '逻辑论证式讲述，提出观点并用事实支撑',
    compatible_video_types: ['explainer_video', 'lecture_video', 'education_training'],
    compatible_entry_types: ['非遗', '传统工艺', '节庆习俗', '饮食文化'],
  },
};

// ---------------------------------------------------------------------------
// Memory mosaic biography — witness memory structure
// ---------------------------------------------------------------------------

export type WitnessEmotionalBias = 'admiration' | 'regret' | 'misunderstanding' | 'gratitude' | 'conflict' | 'nostalgia';

export interface WitnessMemory {
  witness_name: string;
  relationship_to_subject: string;
  remembered_event: string;
  subject_choice: string;
  emotional_bias: WitnessEmotionalBias;
  object_or_phrase: string;
  scene_location: string;
  scene_time: string;
  present_day_effect: string;
  factual_basis: string;
  fictionalized_elements: string[];
}

export interface MemoryMosaicStorySeed {
  subject: string;
  present_day_seeker: string;
  seeker_goal: string;
  trigger_object: string;
  central_question: string;
  witnesses: WitnessMemory[];
  final_reveal: string;
  ending_image: string;
}

// ---------------------------------------------------------------------------
// Creative Reference — user-recognized excellent story samples (Phase 5)
// ---------------------------------------------------------------------------

export type CreativeReferenceMediaType =
  | 'text'
  | 'video'
  | 'script'
  | 'article'
  | 'user_sample';

export type CreativeReferenceRights =
  | 'public_domain'
  | 'user_owned'
  | 'licensed'
  | 'summary_only'
  | 'unknown';

export interface CreativeReference {
  id: string;
  title: string;
  media_type: CreativeReferenceMediaType;
  source_url?: string;
  local_path?: string;
  rights: CreativeReferenceRights;
  domain_tags: string[];
  video_type_tags: VideoType[];
  presentation_style_tags: PresentationStyle[];
  story_structure_tags: StoryStructureType[];
  user_reason: string;
  summary: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Reference Analysis — structural breakdown of a reference sample
// ---------------------------------------------------------------------------

export interface ReferenceAnalysis {
  reference_id: string;
  narrative_device: string;
  opening_hook: string;
  central_question: string;
  protagonist_mode: string;
  conflict_pattern: string;
  emotional_curve: string[];
  scene_pattern: string[];
  dialogue_density: 'low' | 'medium' | 'high';
  narration_mode: 'first_person' | 'third_person' | 'witness_voice' | 'host_voice' | 'mixed';
  visual_motifs: string[];
  ending_strategy: string;
  reusable_principles: string[];
  avoid_copying: string[];
}

// ---------------------------------------------------------------------------
// Style Pack — reusable creative rules derived from multiple references
// ---------------------------------------------------------------------------

export interface StylePack {
  id: string;
  name: string;
  description: string;
  source_reference_ids: string[];
  compatible_video_types: VideoType[];
  compatible_presentation_styles: PresentationStyle[];
  compatible_story_structures: StoryStructureType[];
  structure_rules: string[];
  rhythm_rules: string[];
  scene_rules: string[];
  narration_rules: string[];
  dialogue_rules: string[];
  visual_rules: string[];
  ending_rules: string[];
  forbidden_patterns: string[];
}

// ---------------------------------------------------------------------------
// Generation mode — structured status for model adapter results
// ---------------------------------------------------------------------------

export type GenerationMode = 'external_model' | 'local_fallback' | 'local_only';

// ---------------------------------------------------------------------------
// Duration & panel count
// ---------------------------------------------------------------------------

export type SupportedDuration = '30秒' | '1分钟' | '3分钟' | '5分钟' | '8分钟' | '10分钟' | '15分钟' | '20分钟';

export type PanelCount = 4 | 6 | 8 | 9 | 10 | 12;

// ---------------------------------------------------------------------------
// Unified API response
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export const ErrorCodes = {
  ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
  INVALID_GENERATION_TYPE: 'INVALID_GENERATION_TYPE',
  INVALID_VIDEO_TYPE: 'INVALID_VIDEO_TYPE',
  INVALID_PRESENTATION_STYLE: 'INVALID_PRESENTATION_STYLE',
  INVALID_STORY_STRUCTURE: 'INVALID_STORY_STRUCTURE',
  INVALID_DURATION: 'INVALID_DURATION',
  STORY_GENERATION_FAILED: 'STORY_GENERATION_FAILED',
  STORY_NOT_FOUND: 'STORY_NOT_FOUND',
  GEARS_SEGMENTS_NOT_FOUND: 'GEARS_SEGMENTS_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function success<T>(data: T): ApiResponse<T> {
  return { ok: true, data, error: null };
}

export function fail<T = never>(
  code: ErrorCode,
  message: string,
  details?: unknown,
): ApiResponse<T> {
  return { ok: false, data: null, error: { code, message, details } };
}

// ---------------------------------------------------------------------------
// Story plan (preview recommendation)
// ---------------------------------------------------------------------------

export interface StoryPlanRequest {
  entry_name: string;
}

export interface RecommendedType {
  generation_type: GenerationType;
  reason: string;
  priority: number;
}

export interface RecommendedVideoType {
  video_type: VideoType;
  reason: string;
  priority: number;
}

export interface RecommendedPresentationStyle {
  presentation_style: PresentationStyle;
  reason: string;
}

export interface RecommendedStoryStructure {
  story_structure: StoryStructureType;
  reason: string;
  priority: number;
}

export interface RecommendedNarrativePattern {
  video_type: VideoType;
  pattern_id: NarrativePatternId;
  reason: string;
  priority: number;
  confidence: number;
  match_signals: string[];
}

export interface AvailableEvent {
  event: string;
  conflict_score: number;
  recommended_duration: SupportedDuration;
  recommended_type: GenerationType;
  recommended_video_type: VideoType;
}

export interface StoryPlanResult {
  entry_name: string;
  entry_type: string;
  original_user_query?: string;
  recommended_types: RecommendedType[];
  recommended_video_types: RecommendedVideoType[];
  recommended_presentation_styles: RecommendedPresentationStyle[];
  recommended_story_structures?: RecommendedStoryStructure[];
  recommended_narrative_patterns?: RecommendedNarrativePattern[];
  recommended_supplement_needs: KnowledgePackMissing[];
  available_events: AvailableEvent[];
  recommended_duration: SupportedDuration;
  cultural_risks: string[];
}

export type StoryDetectedCharacterKind =
  | 'named_person'
  | 'identity_role'
  | 'group_role'
  | 'supernatural_role';

export type StoryDetectedCharacterStability = 'recurring' | 'single_scene';

export interface StoryDetectedCharacter {
  name: string;
  role_position: GearsCharacterRolePosition;
  character_kind: StoryDetectedCharacterKind;
  source_text: string;
  asset_stability: StoryDetectedCharacterStability;
  age_range?: GearsAgeRange;
  gender?: GearsGender;
}

// ---------------------------------------------------------------------------
// Story generate
// ---------------------------------------------------------------------------

export interface StoryGenerateRequest {
  entry_name?: string;
  original_user_query?: string;
  generation_type?: GenerationType;
  video_type?: VideoType;
  model_profile_id?: string;
  selected_event?: string;
  target_video_duration?: SupportedDuration;
  tone?: string;
  presentation_style?: PresentationStyle;
  output_gears_segments?: boolean;
  // New fields for outline-driven multi-knowledge matching
  outline?: string;
  knowledge_pack?: KnowledgePack;
  material_pack?: MaterialPack;
  creation_use_case?: CreationUseCase;
  truth_mode?: TruthMode;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
  character_hints?: StoryDetectedCharacter[];
  // New fields for story structure and creative reference (Phase 5)
  story_structure?: StoryStructureType;
  creative_reference_ids?: string[];
  style_pack_ids?: string[];
  narrative_pattern_ids?: NarrativePatternId[];
  reference_strength?: ReferenceStrength;
  genre_strictness?: GenreStrictness;
  auto_repair?: boolean;
  story_priority?: StoryGenerationPriority;
  source_material_mode?: SourceMaterialMode;
  localized_target_region?: string;
  localization_mode?: LocalizationMode;
}

export interface StoryAdaptationAnalysis {
  source_mode: 'user_novel';
  source_length: number;
  source_summary: string;
  core_characters: string[];
  plot_beats: string[];
  must_keep: string[];
  compressible_parts: string[];
  visual_setpieces: string[];
  adaptation_risks: string[];
}

// ---------------------------------------------------------------------------
// Story sub-structures
// ---------------------------------------------------------------------------

export interface StoryCharacter {
  name: string;
  role: string;
  description: string;
  arc?: string;
}

export interface ActBeat {
  act: number;
  beat: string;
  scene_ids: number[];
  purpose: string;
}

export interface ProtagonistArc {
  starting_state: string;
  turning_point: string;
  resolution: string;
}

export interface StoryScene {
  scene_id: number;
  title: string;
  duration_sec: number;
  location: string;
  time_of_day: string;
  dramatic_function: string;
  plot: string;
  key_action: string;
  characters: string[];
  visual_prompt: string;
  camera_suggestion: string;
  cultural_note: string;
  // New dramatic narrative fields
  conflict?: string;
  dialogue_or_narration?: string;
  source_entries?: string[];
  factual_basis?: string;
  fictionalized_elements?: string[];
}

export interface StoryListItem {
  storyId: string;
  title: string;
  generation_type: string;
  video_type: string;
  presentation_style: string;
  source_entry: string;
  logline: string;
  created_at: string;
  has_gears_segments: boolean;
  scene_count: number;
  credibility_note: string;
  model_profile_id?: string;
  generation_source?: string;
  generation_mode?: GenerationMode;
  generation_used_fallback?: boolean;
}

export type GearsWebhookDeliveryStatus = 'not_configured' | 'pending' | 'sent' | 'failed';

export interface GearsWebhookStatus {
  status: GearsWebhookDeliveryStatus;
  webhook_target?: string;
  attempts?: number;
  last_attempt_at?: string;
  last_success_at?: string;
  last_error_at?: string;
  last_error?: string;
}

export type GearsVideoStatus = 'processing' | 'ready' | 'failed';

export interface GearsVideoResult {
  status: GearsVideoStatus;
  video_url?: string;
  thumbnail_url?: string;
  received_at: string;
  updated_at: string;
}

export interface GearsVideoReadyCallbackRequest {
  storyId: string;
  video_url?: string;
  status: GearsVideoStatus;
  thumbnail_url?: string;
}

export interface GearsVideoReadyCallbackResult {
  storyId: string;
  project_id?: string;
  gears_video: GearsVideoResult;
}

export type StoryProjectStatus = 'draft' | 'edited' | 'exported' | 'finalized';

export interface StoryProjectListItem {
  project_id: string;
  current_story_id: string;
  title: string;
  source_domain: 'china_culture';
  source_entry: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure?: StoryStructureType;
  creation_use_case?: CreationUseCase;
  truth_mode?: TruthMode;
  material_sufficiency?: MaterialSufficiencyReport;
  status: StoryProjectStatus;
  updated_at: string;
  scene_count: number;
  has_gears_segments: boolean;
  credibility_note: string;
  logline: string;
  model_profile_id?: string;
  generation_source?: string;
  generation_mode?: GenerationMode;
  generation_used_fallback?: boolean;
  quality_passed?: boolean;
  genre_score?: number;
  quality_issue_count?: number;
  open_supplement_task_count?: number;
  gears_video_status?: GearsVideoStatus;
  gears_video_url?: string;
  gears_video_thumbnail_url?: string;
}

export type StoryProjectVersionChangeType =
  | 'initial_generation'
  | 'scene_regeneration'
  | 'quality_repair'
  | 'production_board_repair';

export interface StoryProjectVersionSummary {
  version_id: string;
  created_at: string;
  change_type: StoryProjectVersionChangeType;
  scene_ids_changed: number[];
  note?: string;
  quality_passed?: boolean;
  genre_score?: number;
  quality_issue_count?: number;
  production_board_repair_trace?: StoryProductionBoardRepairTrace;
  production_board_export?: StoryProductionBoardExportRecord;
}

export interface StoryProjectMeta extends StoryProjectListItem {
  created_at: string;
  current_version_id: string;
  version_count: number;
  creation_contract?: CreationContract;
  seedance_asset_library?: SeedanceAssetLibrary;
  seedance_shot_ledger?: SeedanceShotLedger;
  seedance_provider_queue?: SeedanceShotProviderQueue;
  gears_job_ledger?: GearsJobLedger;
  production_readiness_automation_ledger?: ProductionReadinessAutomationRunLedger;
}

export interface StoryProjectVersionSnapshot {
  project_id: string;
  version_id: string;
  created_at: string;
  change_type: StoryProjectVersionChangeType;
  scene_ids_changed: number[];
  note?: string;
  quality_report?: StoryQualityReport | GenreQualityReport;
  production_board_export?: StoryProductionBoardExportRecord;
  story: StoryGenerateResult;
}

export interface StoryProjectDetail {
  project: StoryProjectMeta;
  current_story: StoryGenerateResult;
  versions: StoryProjectVersionSummary[];
}

export interface StoryProductionBoardExportRecord {
  exported_at: string;
  export_dir: string;
  file_count: number;
  delivery_stage: StoryProductionBoardDeliveryStage;
  delivery_stage_label: string;
}

export interface StoryProjectExportSummary {
  title: string;
  source_entry: string;
  video_type: VideoType;
  video_type_label: string;
  presentation_style: PresentationStyle;
  presentation_style_label: string;
  story_structure?: StoryStructureType;
  story_structure_label?: string;
  logline: string;
  quality_passed?: boolean;
  genre_score?: number;
  outline_coverage_score?: number;
  pattern_quality_score?: number;
  gears_readiness_score?: number;
  repair_action_count?: number;
  quality_issues: string[];
  credibility_note: string;
  evidence_boundary_count: number;
  gears_segment_count: number;
}

export interface StoryProjectExportPackage {
  schema_version: 'story-project-export/v1';
  exported_at: string;
  project: StoryProjectMeta;
  summary: StoryProjectExportSummary;
  markdown: string;
  story: StoryGenerateResult;
}

export interface ProjectKnowledgeCandidateExportItem {
  task_id: string;
  label: string;
  source: KnowledgeSupplementTaskSource;
  stage?: MaterialSufficiencyStage;
  blocking_level?: MaterialBlockingLevel;
  recommended_fields?: string[];
  updated_at?: string;
  review_status?: KnowledgeCandidateReviewStatus;
  review_note?: string;
  markdown: string;
  writeback_draft_markdown?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
}

export interface ProjectKnowledgeCandidateExportPackage {
  schema_version: 'project-knowledge-candidates/v1';
  exported_at: string;
  project_id: string;
  project_title: string;
  source_entry: string;
  video_type: VideoType;
  candidate_count: number;
  markdown: string;
  items: ProjectKnowledgeCandidateExportItem[];
}

export interface ProjectKnowledgeWritebackPatchItem {
  task_key?: string;
  project_id?: string;
  project_title?: string;
  video_type?: VideoType;
  target_province?: string;
  task_id: string;
  label: string;
  source_entry: string;
  suggested_file_path: string;
  suggested_section_heading: string;
  review_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  append_markdown: string;
  writeback_draft_markdown: string;
}

export interface ProjectKnowledgeWritebackPatchFilters {
  project_id?: string;
  video_type?: VideoType;
  province?: string;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  search_query?: string;
  task_key_count?: number;
}

export interface ProjectKnowledgeWritebackPatchPackage {
  schema_version: 'project-knowledge-writeback-patch/v1';
  exported_at: string;
  project_id: string;
  project_title: string;
  source_entry: string;
  filters?: ProjectKnowledgeWritebackPatchFilters;
  approved_count: number;
  project_count?: number;
  status_counts?: Record<KnowledgeWritebackStatus, number>;
  target_files: string[];
  pr_title: string;
  pr_body: string;
  markdown: string;
  items: ProjectKnowledgeWritebackPatchItem[];
}

export interface ProjectSupplementTaskListItem {
  project_id: string;
  current_story_id: string;
  project_title: string;
  source_entry: string;
  video_type: VideoType;
  target_province?: string;
  suggested_file_path?: string;
  updated_at: string;
  task: KnowledgeSupplementTask;
}

export interface ProjectSupplementTaskListFilters {
  project_id?: string;
  video_type?: VideoType;
  province?: string;
  status?: KnowledgeSupplementTaskStatus;
  stage?: MaterialSufficiencyStage;
  blocking_level?: MaterialBlockingLevel;
  source?: KnowledgeSupplementTaskSource;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  knowledge_writeback_ready?: boolean;
  task_keys?: string[];
  search_query?: string;
}

export interface ProjectDraftProductionMaterialTaskResult {
  task_id: string;
  label: string;
  field_ids: string[];
  field_values: Record<string, string>;
}

export interface ProjectDraftProductionMaterialSkippedTask {
  task_id: string;
  label: string;
  reason: string;
}

export interface ProjectDraftProductionMaterialFieldsResult {
  schema_version: 'project-production-material-draft/v1';
  project_id: string;
  story_id: string;
  generated_at: string;
  before_status?: ProductionMaterialReadinessStatus;
  after_status?: ProductionMaterialReadinessStatus;
  before_score?: number;
  after_score?: number;
  drafted_task_count: number;
  drafted_field_count: number;
  skipped_task_count: number;
  drafted_tasks: ProjectDraftProductionMaterialTaskResult[];
  skipped_tasks: ProjectDraftProductionMaterialSkippedTask[];
  detail?: StoryProjectDetail;
}

export type ProjectMaterialPackTarget =
  | 'primary_materials'
  | 'supporting_materials'
  | 'reference_materials';

export interface ProjectMaterialPackAddMaterialRequest {
  target?: ProjectMaterialPackTarget;
  title: string;
  summary: string;
  source_type?: MaterialSourceType;
  purpose: MaterialPurpose[];
  confidence?: number;
  role_in_story?: string;
  provenance?: string;
  linked_entry_name?: string;
  tags?: string[];
  mark_as_verified_fact?: boolean;
  remove_missing_need_id?: string;
}

export interface StoryProjectDeleteResult {
  project_id: string;
  story_id: string;
  story_ids?: string[];
  removed_story_file_count?: number;
  deleted: true;
}

export interface StoryProjectBatchDeleteRequest {
  project_ids: string[];
}

export interface StoryProjectBatchDeleteResult {
  deleted: StoryProjectDeleteResult[];
  failed: Array<{
    project_id: string;
    error: string;
  }>;
}

export interface StoryProjectRetainRecentRequest {
  keep_recent: number;
}

export interface StoryProjectRetainRecentResult extends StoryProjectBatchDeleteResult {
  keep_recent: number;
  kept: StoryProjectListItem[];
}

export type StorySceneRegenerateIntent =
  | 'tighten_conflict'
  | 'rewrite_narration'
  | 'shift_emotion'
  | 'clarify_visuals'
  | 'custom';

export interface StorySceneRegenerateRequest {
  scene_id: number;
  intent: StorySceneRegenerateIntent;
  user_note?: string;
  model_profile_id?: string;
}

// ---------------------------------------------------------------------------
// GEARS segment
// ---------------------------------------------------------------------------

export interface GearsSegment {
  segment_id: number;
  source_scene_id: number;
  duration_sec: number;
  panel_count: PanelCount;
  script_text: string;
  purpose: string;
  visual_focus: string[];
  cultural_constraints: string[];
  video_type: VideoType;
  presentation_style: PresentationStyle;
  segment_prompt_hint?: string;
  source_entries?: string[];
}

export interface GearsSegmentsResponse {
  schema_version: string;
  storyId: string;
  title: string;
  total_duration_sec: number;
  segments: GearsSegment[];
}

export type GearsCharacterRolePosition = '主角' | '反派' | '配角' | '路人' | '群演';
export type GearsSpeciesType = '人类' | '拟人动物' | '拟人机器人' | '怪物·异形' | '卡通角色' | '其他';
export type GearsEthnicity = '东亚' | '东南亚' | '南亚' | '西亚·阿拉伯' | '欧洲白人' | '非洲黑人' | '拉美裔' | '其他';
export type GearsGender = '男' | '女' | '其他' | '未指定' | '不适用';
export type GearsAgeRange = '儿童' | '少年' | '青年' | '中年' | '老年' | '不适用';
export type GearsSceneType = '室内' | '室外' | '虚构空间' | '不限';
export type GearsSceneAtmosphere = '明亮' | '压抑' | '温馨' | '紧张' | '神秘' | '中性';
export type GearsTimeOfDay = '早' | '午' | '夕' | '夜';

export interface GearsCharacterAsset {
  name: string;
  role_position: GearsCharacterRolePosition;
  species_type: GearsSpeciesType;
  ethnicity: GearsEthnicity[];
  gender: GearsGender;
  age_range: GearsAgeRange;
  appearance_features: string;
  clothing: string;
  carried_props?: string;
  signature_objects?: string;
  background_oneliner?: string;
}

export interface GearsCharacterGenderSummary {
  total: number;
  male: number;
  female: number;
  other: number;
  unspecified: number;
  not_applicable: number;
}

export interface GearsSceneAsset {
  name: string;
  scene_type: GearsSceneType;
  description: string;
  environment_props?: string;
  atmosphere: GearsSceneAtmosphere;
}

export interface GearsDeliveryUnit {
  unit_id: string;
  source_scene_id: number;
  scene_name: string;
  character_names: string[];
  suggested_duration_sec: number;
  suggested_panel_count: PanelCount;
  time_of_day?: GearsTimeOfDay;
  beat_count: number;
  script_text: string;
}

export type GearsDeliveryStatus = 'ready' | 'needs_input';

export interface GearsDeliveryPackage {
  schema_version: string;
  storyId: string;
  title: string;
  delivery_status?: GearsDeliveryStatus;
  character_assets: GearsCharacterAsset[];
  character_gender_summary: GearsCharacterGenderSummary;
  scene_assets: GearsSceneAsset[];
  units: GearsDeliveryUnit[];
  markdown: string;
  validation_notes: string[];
}

export type GearsExecutionJobType =
  | 'storyboard_image'
  | 'character_image'
  | 'scene_image'
  | 'seedance_video'
  | 'subtitle_render'
  | 'audio_mix'
  | 'title_card_render'
  | 'final_assemble';

export const GEARS_CALLBACK_EVENT_RETENTION_LIMIT = 20;
export const GEARS_CALLBACK_BATCH_ITEM_LIMIT = 200;

export type GearsExecutionJobStatus =
  | 'submitted'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'canceled'
  | 'rejected';

export type GearsExecutionFailureCategory =
  | 'asset_missing'
  | 'artifact_invalid'
  | 'artifact_upload_failed'
  | 'callback_delivery_failed'
  | 'output_missing'
  | 'payload_invalid'
  | 'content_policy'
  | 'provider_timeout'
  | 'provider_quota'
  | 'provider_auth'
  | 'provider_rate_limit'
  | 'provider_server_error'
  | 'render_failed'
  | 'worker_unavailable'
  | 'network_error'
  | 'unknown';

export interface GearsExecutionArtifact {
  artifact_id?: string;
  kind?: string;
  url: string;
  role?: string;
  mime_type?: string;
  source_unit_id?: string;
  metadata?: Record<string, unknown>;
}

export interface GearsJobLedgerEvent {
  event_id?: string;
  event_id_source?: 'event' | 'callback' | 'idempotency_key';
  received_at: string;
  provider_event_at?: string;
  previous_status?: GearsExecutionJobStatus;
  status: GearsExecutionJobStatus;
  applied_status?: GearsExecutionJobStatus;
  status_regression_ignored?: boolean;
  terminal_status_changed?: boolean;
  progress_percent?: number;
  message?: string;
}

export interface GearsJobLedgerItem {
  ledger_id: string;
  gears_job_id: string;
  job_type: GearsExecutionJobType;
  source_unit_id: string;
  source_unit_label?: string;
  source_scene_id?: number;
  source_project_id?: string;
  source_story_id?: string;
  series_project_id?: string;
  idempotency_key?: string;
  status: GearsExecutionJobStatus;
  progress_percent?: number;
  artifact_urls: string[];
  artifacts?: GearsExecutionArtifact[];
  failure_category?: GearsExecutionFailureCategory;
  error_code?: string;
  failure_reason?: string;
  last_poll_at?: string;
  last_poll_error?: string;
  last_poll_failure_category?: GearsExecutionFailureCategory;
  last_poll_error_code?: string;
  submitted_at: string;
  updated_at: string;
  completed_at?: string;
  payload_summary?: string;
  callback_events?: GearsJobLedgerEvent[];
}

export interface GearsJobLedger {
  schema_version: 'gears-job-ledger/v1';
  updated_at?: string;
  items: GearsJobLedgerItem[];
}

export type ProductionReadinessStatus = 'ready' | 'needs_action' | 'blocked';

export type ProductionReadinessScope = 'story_project' | 'ai_comic_series';

export type ProductionReadinessLaneKey =
  | 'story_quality'
  | 'series_quality'
  | 'episode_generation'
  | 'production_board'
  | 'delivery_contract'
  | 'shot_production'
  | 'gears_execution'
  | 'review_repair'
  | 'commercial_ops';

export type ProductionReadinessIssueSeverity = 'blocking' | 'warning' | 'info';

export interface ProductionReadinessGearsSummary {
  total: number;
  active: number;
  ready: number;
  external_ready: number;
  local_acceptance_ready: number;
  local_acceptance_active: number;
  ready_without_external_artifact: number;
  failed: number;
  rejected: number;
  canceled: number;
  missing_artifact: number;
  poll_failure: number;
  status_counts: Record<GearsExecutionJobStatus, number>;
}

export interface ProductionReadinessSummary {
  status: ProductionReadinessStatus;
  score: number;
  ready_lane_count: number;
  total_lane_count: number;
  blocker_count: number;
  warning_count: number;
  next_action_count: number;
  quality_score?: number;
  delivery_stage?: StoryProductionBoardDeliveryStage;
  generated_episode_count?: number;
  total_episode_count?: number;
  total_shot_count?: number;
  ready_shot_count?: number;
  failed_shot_count?: number;
  open_review_count?: number;
  gears_job_count: number;
  active_gears_job_count: number;
  external_ready_gears_job_count: number;
  local_acceptance_ready_gears_job_count: number;
  ready_without_external_gears_artifact_count: number;
  seedance_placeholder_asset_count: number;
  seedance_production_asset_ready_count: number;
}

export interface ProductionReadinessLane {
  key: ProductionReadinessLaneKey;
  label: string;
  status: ProductionReadinessStatus;
  score: number;
  detail: string;
  count_text?: string;
  evidence: string[];
  action_key?: string;
  action_label?: string;
}

export interface ProductionReadinessIssue {
  issue_id: string;
  severity: ProductionReadinessIssueSeverity;
  lane_key: ProductionReadinessLaneKey;
  label: string;
  detail: string;
  action_key?: string;
  action_label?: string;
}

export interface ProductionReadinessNextAction {
  action_key: string;
  label: string;
  detail: string;
  priority: number;
  lane_key?: ProductionReadinessLaneKey;
  disabled_reason?: string;
}

export type ProductionReadinessAutomationRunner =
  | 'story_agent_api'
  | 'mcp_tool'
  | 'gears_worker'
  | 'operator_review';

export type ProductionReadinessAutomationMode =
  | 'read_only'
  | 'writes_project'
  | 'external_execution'
  | 'manual';

export type ProductionReadinessAutomationStepStatus = 'ready' | 'blocked' | 'manual';

export interface ProductionReadinessAutomationStep {
  step_id: string;
  order: number;
  action_key: string;
  label: string;
  detail: string;
  runner: ProductionReadinessAutomationRunner;
  mode: ProductionReadinessAutomationMode;
  status: ProductionReadinessAutomationStepStatus;
  can_auto_execute: boolean;
  api?: {
    method: 'GET' | 'POST';
    path: string;
  };
  mcp_tool?: string;
  payload_hint?: Record<string, unknown>;
  prerequisites: string[];
  blocked_by_issue_ids: string[];
  expected_result: string;
  safety_note: string;
}

export interface ProductionReadinessAutomationPlan {
  schema_version: 'production-readiness-automation-plan/v1';
  status: 'ready' | 'needs_operator' | 'blocked';
  ready_step_count: number;
  blocked_step_count: number;
  manual_step_count: number;
  external_step_count: number;
  steps: ProductionReadinessAutomationStep[];
  notes: string[];
}

export interface ProductionReadinessAutomationRunRequest {
  dry_run?: boolean;
  max_steps?: number;
  action_keys?: string[];
  stop_on_error?: boolean;
}

export interface ProductionReadinessAutomationRunStepResult {
  step_id: string;
  action_key: string;
  label: string;
  status: 'planned' | 'executed' | 'skipped' | 'failed';
  runner: ProductionReadinessAutomationRunner;
  mode: ProductionReadinessAutomationMode;
  can_auto_execute: boolean;
  reason?: string;
  api_path?: string;
  response_schema_version?: string;
  error_message?: string;
}

export interface ProductionReadinessAutomationRunResult<TReport = unknown> {
  schema_version: 'production-readiness-automation-run/v1';
  scope: ProductionReadinessScope;
  project_id: string;
  dry_run: boolean;
  started_at: string;
  completed_at: string;
  requested_action_keys?: string[];
  executed_step_count: number;
  planned_step_count: number;
  skipped_step_count: number;
  failed_step_count: number;
  steps: ProductionReadinessAutomationRunStepResult[];
  before_readiness: TReport;
  after_readiness: TReport;
  notes: string[];
}

export interface ProductionReadinessAutomationRunLedgerItem {
  run_id: string;
  scope: ProductionReadinessScope;
  project_id: string;
  dry_run: boolean;
  started_at: string;
  completed_at: string;
  requested_action_keys?: string[];
  executed_step_count: number;
  planned_step_count: number;
  skipped_step_count: number;
  failed_step_count: number;
  before_status: ProductionReadinessStatus;
  before_score: number;
  after_status: ProductionReadinessStatus;
  after_score: number;
  steps: ProductionReadinessAutomationRunStepResult[];
  notes: string[];
}

export interface ProductionReadinessAutomationRunLedger {
  schema_version: 'production-readiness-automation-run-ledger/v1';
  updated_at: string;
  total_run_count: number;
  persisted_run_count: number;
  latest_run?: ProductionReadinessAutomationRunLedgerItem;
  items: ProductionReadinessAutomationRunLedgerItem[];
}

export interface ProductionReadinessEpisode {
  episode_no: number;
  episode_title: string;
  story_id?: string;
  status: ProductionReadinessStatus;
  quality_score?: number;
  issue_count?: number;
  total_shot_count?: number;
  ready_shot_count?: number;
  failed_shot_count?: number;
  blocker_count: number;
}

export interface StoryProjectProductionReadinessReport {
  schema_version: 'story-project-production-readiness/v1';
  scope: 'story_project';
  project: StoryProjectMeta;
  title: string;
  generated_at: string;
  summary: ProductionReadinessSummary;
  lanes: ProductionReadinessLane[];
  issues: ProductionReadinessIssue[];
  next_actions: ProductionReadinessNextAction[];
  automation_plan: ProductionReadinessAutomationPlan;
  automation_ledger?: ProductionReadinessAutomationRunLedger;
  latest_automation_run?: ProductionReadinessAutomationRunLedgerItem;
  markdown: string;
}

export interface AiComicSeriesProductionReadinessReport {
  schema_version: 'ai-comic-series-production-readiness/v1';
  scope: 'ai_comic_series';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  generated_at: string;
  summary: ProductionReadinessSummary;
  lanes: ProductionReadinessLane[];
  issues: ProductionReadinessIssue[];
  next_actions: ProductionReadinessNextAction[];
  automation_plan: ProductionReadinessAutomationPlan;
  automation_ledger?: ProductionReadinessAutomationRunLedger;
  latest_automation_run?: ProductionReadinessAutomationRunLedgerItem;
  episodes: ProductionReadinessEpisode[];
  markdown: string;
}

export interface ProductionReadinessPortfolioItem {
  scope: ProductionReadinessScope;
  project_id: string;
  title: string;
  updated_at?: string;
  status: ProductionReadinessStatus;
  score: number;
  priority_score: number;
  blocker_count: number;
  warning_count: number;
  next_action_count: number;
  gears_job_count: number;
  active_gears_job_count: number;
  external_ready_gears_job_count: number;
  local_acceptance_ready_gears_job_count: number;
  ready_without_external_gears_artifact_count: number;
  seedance_placeholder_asset_count: number;
  seedance_production_asset_ready_count: number;
  ready_automation_step_count: number;
  blocked_automation_step_count: number;
  manual_automation_step_count: number;
  external_automation_step_count: number;
  primary_action_key?: string;
  primary_action_label?: string;
  primary_issue_label?: string;
  latest_automation_run?: ProductionReadinessAutomationRunLedgerItem;
}

export interface ProductionReadinessPortfolioActionBucket {
  action_key: string;
  label: string;
  count: number;
  blocked_count: number;
  scopes: ProductionReadinessScope[];
}

export interface ProductionReadinessPortfolioReport {
  schema_version: 'production-readiness-portfolio/v1';
  generated_at: string;
  summary: {
    total_target_count: number;
    story_project_count: number;
    ai_comic_series_count: number;
    ready_count: number;
    needs_action_count: number;
    blocked_count: number;
    blocker_count: number;
    warning_count: number;
    ready_automation_step_count: number;
    external_automation_step_count: number;
    manual_automation_step_count: number;
    gears_job_count: number;
    active_gears_job_count: number;
    external_ready_gears_job_count: number;
    local_acceptance_ready_gears_job_count: number;
    ready_without_external_gears_artifact_count: number;
    seedance_placeholder_asset_count: number;
    seedance_production_asset_ready_count: number;
    latest_automation_run_count: number;
    portfolio_automation_run_count: number;
  };
  items: ProductionReadinessPortfolioItem[];
  action_buckets: ProductionReadinessPortfolioActionBucket[];
  portfolio_automation_ledger?: ProductionReadinessPortfolioRunLedger;
  latest_portfolio_automation_run?: ProductionReadinessPortfolioRunLedgerItem;
  errors: Array<{
    scope: ProductionReadinessScope;
    project_id: string;
    message: string;
  }>;
  notes: string[];
  markdown: string;
}

export interface ProductionReadinessPortfolioRunRequest {
  dry_run?: boolean;
  include_archived_series?: boolean;
  max_targets?: number;
  per_target_max_steps?: number;
  min_priority_score?: number;
  scopes?: ProductionReadinessScope[];
  project_ids?: string[];
  action_keys?: string[];
  stop_on_error?: boolean;
}

export interface ProductionReadinessPortfolioRunTargetResult {
  scope: ProductionReadinessScope;
  project_id: string;
  title: string;
  priority_score: number;
  status: 'planned' | 'executed' | 'skipped' | 'failed';
  reason?: string;
  run_result?: ProductionReadinessAutomationRunResult<unknown>;
  error_message?: string;
}

export interface ProductionReadinessPortfolioRunLedgerTarget {
  scope: ProductionReadinessScope;
  project_id: string;
  title: string;
  priority_score: number;
  status: ProductionReadinessPortfolioRunTargetResult['status'];
  executed_step_count: number;
  planned_step_count: number;
  skipped_step_count: number;
  failed_step_count: number;
  error_message?: string;
}

export interface ProductionReadinessPortfolioRunLedgerItem {
  run_id: string;
  dry_run: boolean;
  started_at: string;
  completed_at: string;
  requested_scope_count: number;
  requested_project_id_count: number;
  requested_action_keys?: string[];
  min_priority_score?: number;
  selected_target_count: number;
  executed_target_count: number;
  planned_target_count: number;
  skipped_target_count: number;
  failed_target_count: number;
  targets: ProductionReadinessPortfolioRunLedgerTarget[];
  notes: string[];
}

export interface ProductionReadinessPortfolioRunLedger {
  schema_version: 'production-readiness-portfolio-run-ledger/v1';
  updated_at: string;
  total_run_count: number;
  persisted_run_count: number;
  latest_run?: ProductionReadinessPortfolioRunLedgerItem;
  items: ProductionReadinessPortfolioRunLedgerItem[];
}

export interface ProductionReadinessPortfolioRunResult {
  schema_version: 'production-readiness-portfolio-run/v1';
  dry_run: boolean;
  started_at: string;
  completed_at: string;
  requested_scope_count: number;
  requested_project_id_count: number;
  selected_target_count: number;
  executed_target_count: number;
  planned_target_count: number;
  skipped_target_count: number;
  failed_target_count: number;
  before_portfolio: ProductionReadinessPortfolioReport;
  after_portfolio: ProductionReadinessPortfolioReport;
  targets: ProductionReadinessPortfolioRunTargetResult[];
  portfolio_automation_ledger?: ProductionReadinessPortfolioRunLedger;
  latest_portfolio_automation_run?: ProductionReadinessPortfolioRunLedgerItem;
  notes: string[];
}

export type StoryAgentGeneratedHealthStatus = 'ready' | 'planned' | 'production_gap' | 'interrupted';
export type StoryAgentGeneratedHealthScope = 'story_project' | 'ai_comic_series_project';

export interface StoryAgentGeneratedHealthItem {
  scope: StoryAgentGeneratedHealthScope;
  project_id: string;
  title?: string;
  status: StoryAgentGeneratedHealthStatus;
  risk_score: number;
  updated_at?: string;
  issue_count: number;
  missing_contracts: string[];
  evidence: string[];
  recommended_actions: string[];
  current_story_id?: string;
  current_version_id?: string;
  version_count?: number;
  scene_count?: number;
  gears_segment_count?: number;
  quality_score?: number;
  episode_count?: number;
  generated_episode_count?: number;
  generated_episode_story_id_count?: number;
  missing_episode_story_id_count?: number;
  production_item_count?: number;
  ready_production_item_count?: number;
  contract_evidence_count?: number;
  relink_candidate?: boolean;
  cut_ready?: boolean;
  subtitle_ready?: boolean;
  thumbnail_ready_count?: number;
  final_delivery_ready?: boolean;
}

export interface StoryAgentGeneratedHealthReport {
  schema_version: 'story-agent-generated-health/v1';
  generated_at: string;
  summary: {
    scanned_story_project_count: number;
    scanned_series_project_count: number;
    total_target_count: number;
    ready_count: number;
    planned_count: number;
    production_gap_count: number;
    interrupted_count: number;
    missing_current_story_count: number;
    missing_scene_breakdown_count: number;
    missing_gears_segments_count: number;
    missing_quality_count: number;
    missing_episode_story_id_count: number;
    series_missing_delivery_count: number;
    series_missing_postproduction_count: number;
    series_ready_count?: number;
    series_planned_only_count?: number;
    series_production_gap_count?: number;
    series_interrupted_count?: number;
    series_governance_attention_count?: number;
    series_missing_story_ref_project_count?: number;
    series_contract_evidence_count?: number;
    series_relink_candidate_count?: number;
  };
  items: StoryAgentGeneratedHealthItem[];
  notes: string[];
  markdown: string;
}

export type StoryAgentGeneratedGovernanceActionKey =
  | 'restore_or_relink_series_story_refs'
  | 'archive_or_rebuild_series_fixtures'
  | 'generate_first_series_episode'
  | 'repair_series_command_contracts'
  | 'repair_story_project_refs'
  | 'promote_ready_targets_for_gears_signoff';

export interface StoryAgentGeneratedGovernanceTarget {
  scope: StoryAgentGeneratedHealthScope;
  project_id: string;
  title?: string;
  status: StoryAgentGeneratedHealthStatus;
  risk_score: number;
  missing_contracts: string[];
  missing_episode_story_id_count?: number;
  contract_evidence_count?: number;
  relink_candidate?: boolean;
  evidence: string[];
}

export interface StoryAgentGeneratedGovernanceAction {
  action_key: StoryAgentGeneratedGovernanceActionKey;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  label: string;
  target_count: number;
  sample_targets: StoryAgentGeneratedGovernanceTarget[];
  can_auto_apply: boolean;
  runner: 'operator' | 'story_agent_api' | 'gears_worker';
  detail: string;
  next_step: string;
}

export interface StoryAgentGeneratedGovernancePlan {
  schema_version: 'story-agent-generated-governance-plan/v1';
  generated_at: string;
  status: ProductionReadinessStatus;
  summary: {
    source_total_target_count: number;
    ready_target_count: number;
    series_governance_attention_count: number;
    series_missing_story_ref_project_count: number;
    series_relink_candidate_count: number;
    series_archive_or_rebuild_candidate_count: number;
    series_planned_only_count: number;
    series_contract_repair_candidate_count: number;
    story_ref_repair_candidate_count: number;
    ready_gears_signoff_candidate_count: number;
  };
  actions: StoryAgentGeneratedGovernanceAction[];
  notes: string[];
  source_health_summary: StoryAgentGeneratedHealthReport['summary'];
  markdown: string;
}

export interface StoryAgentGeneratedGovernanceRunRequest {
  dry_run?: boolean;
  action_keys?: StoryAgentGeneratedGovernanceActionKey[];
  project_ids?: string[];
  max_targets?: number;
}

export type StoryAgentGeneratedGovernanceRunTargetStatus = 'planned' | 'blocked' | 'skipped';

export interface StoryAgentGeneratedGovernanceRunTarget {
  action_key: StoryAgentGeneratedGovernanceActionKey;
  scope: StoryAgentGeneratedHealthScope;
  project_id: string;
  title?: string;
  status: StoryAgentGeneratedGovernanceRunTargetStatus;
  planned_operation: string;
  expected_file_changes: string[];
  requires_operator_review: boolean;
  evidence: string[];
  reason?: string;
}

export interface StoryAgentGeneratedGovernanceRunManifest {
  schema_version: 'story-agent-generated-governance-run-manifest/v1';
  manifest_id: string;
  generated_at: string;
  dry_run: boolean;
  items: StoryAgentGeneratedGovernanceRunTarget[];
}

export interface StoryAgentGeneratedGovernanceRunResult {
  schema_version: 'story-agent-generated-governance-run/v1';
  generated_at: string;
  status: ProductionReadinessStatus;
  dry_run: boolean;
  selected_action_count: number;
  selected_target_count: number;
  planned_target_count: number;
  blocked_target_count: number;
  skipped_target_count: number;
  requested_action_keys: StoryAgentGeneratedGovernanceActionKey[];
  manifest: StoryAgentGeneratedGovernanceRunManifest;
  before_plan_summary: StoryAgentGeneratedGovernancePlan['summary'];
  notes: string[];
  markdown: string;
}

export type StoryAgentMvpStatus = ProductionReadinessStatus;

export type StoryAgentMvpLaneKey =
  | 'generated_artifacts'
  | 'generated_governance'
  | 'production_material_packs'
  | 'domain_packs'
  | 'domain_pack_expansion'
  | 'knowledge_writeback'
  | 'story_quality'
  | 'repair_loop'
  | 'delivery_contract'
  | 'production_command';

export type StoryAgentMvpProgressKey =
  | 'generated_governance'
  | 'mcp_story_agent_loop'
  | 'content_command_layer'
  | 'production_delivery_contract'
  | 'gears_end_to_end_acceptance';

export interface StoryAgentMvpLane {
  key: StoryAgentMvpLaneKey;
  label: string;
  status: StoryAgentMvpStatus;
  score: number;
  detail: string;
  evidence: string[];
  next_action?: string;
}

export interface StoryAgentMvpPriorityTarget {
  scope: ProductionReadinessScope | StoryAgentGeneratedHealthScope;
  project_id: string;
  title?: string;
  status: StoryAgentMvpStatus | StoryAgentGeneratedHealthStatus;
  priority_score: number;
  primary_action?: string;
  evidence: string[];
}

export interface StoryAgentMvpProgressSlice {
  key: StoryAgentMvpProgressKey;
  label: string;
  status: StoryAgentMvpStatus;
  percent: number;
  detail: string;
  blocker?: string;
  evidence: string[];
}

export interface StoryAgentMvpStatusReport {
  schema_version: 'story-agent-mvp-status/v1';
  generated_at: string;
  status: StoryAgentMvpStatus;
  score: number;
  summary: {
    generated_target_count: number;
    generated_ready_count: number;
    generated_planned_count: number;
    generated_production_gap_count: number;
    generated_interrupted_count: number;
    readiness_target_count: number;
    readiness_ready_count: number;
    readiness_needs_action_count: number;
    readiness_blocked_count: number;
    ready_automation_step_count: number;
    external_or_manual_step_count: number;
    real_gears_endpoint_configured: boolean;
    real_gears_callback_secret_configured: boolean;
    real_gears_callback_base_configured: boolean;
    real_gears_callback_base_public: boolean;
    real_gears_acceptance_ready_to_run: boolean;
    real_gears_acceptance_blocker: string;
    local_acceptance_counts_as_real_external_callback: false;
    seedance_provider_submit_adapter_configured: boolean;
    seedance_provider_poll_adapter_configured: boolean;
    seedance_provider_callback_base_configured: boolean;
    seedance_provider_external_loop_ready: boolean;
    seedance_placeholder_asset_count: number;
    seedance_production_asset_ready_count: number;
    knowledge_writeback_ready_count: number;
    knowledge_writeback_project_ready_count: number;
    knowledge_writeback_expansion_ready_count: number;
    knowledge_writeback_total_ready_count: number;
    knowledge_writeback_project_count: number;
    knowledge_writeback_draft_ready_count: number;
    knowledge_writeback_queued_count: number;
    knowledge_writeback_written_back_count: number;
    knowledge_writeback_needs_revision_count: number;
    knowledge_writeback_expansion_draft_ready_count: number;
    knowledge_writeback_expansion_queued_count: number;
    knowledge_writeback_expansion_written_back_count: number;
    knowledge_writeback_expansion_needs_revision_count: number;
    knowledge_writeback_total_draft_ready_count: number;
    knowledge_writeback_total_queued_count: number;
    knowledge_writeback_total_written_back_count: number;
    knowledge_writeback_total_needs_revision_count: number;
    knowledge_writeback_unified_export_schema: 'knowledge-writeback-queue-export/v1';
    knowledge_writeback_unified_export_ready: boolean;
    knowledge_writeback_unified_export_approved_count: number;
    knowledge_writeback_unified_export_project_approved_count: number;
    knowledge_writeback_unified_export_expansion_approved_count: number;
    knowledge_writeback_unified_export_target_file_count: number;
    knowledge_writeback_unified_export_direct_writeback_to_province_markdown: false;
    knowledge_writeback_unified_export_province_markdown_written: false;
    knowledge_writeback_review_handoff_count: number;
    knowledge_writeback_review_handoff_requires_signoff_count: number;
    knowledge_writeback_review_handoff_runtime_override_count: number;
    knowledge_writeback_review_handoff_missing_review_note_count: number;
    knowledge_writeback_review_handoff_source_ref_count: number;
    knowledge_writeback_review_handoff_signoff_manifest_id: string;
    knowledge_writeback_review_handoff_signoff_manifest_sha256: string;
    knowledge_writeback_signoff_package_schema: 'knowledge-writeback-queue-signoff-package/v1' | '';
    knowledge_writeback_signoff_package_item_count: number;
    blocker_count: number;
    warning_count: number;
    generated_governance_action_count: number;
    generated_governance_p0_p1_action_count: number;
    generated_governance_ready_signoff_candidate_count: number;
    production_material_pack_status: ProductionMaterialPackHealthStatus;
    production_material_pack_count: number;
    production_material_pack_issue_count: number;
    production_material_pack_core_ready_count: number;
    production_material_pack_core_total_count: number;
    domain_pack_status: DomainPackProductionHealthStatus;
    domain_pack_count: number;
    domain_pack_issue_count: number;
    production_domain_pack_ready_count: number;
    production_domain_pack_required_count: number;
    domain_pack_expansion_status: DomainPackProductionHealthStatus;
    domain_pack_expansion_batch_count: number;
    domain_pack_expansion_seed_target_count: number;
    domain_pack_expansion_candidate_field_count: number;
    domain_pack_expansion_field_workbench_item_count: number;
    domain_pack_expansion_field_supplement_candidate_count: number;
    domain_pack_expansion_field_missing_candidate_count: number;
    domain_pack_expansion_field_candidate_completion_percent: number;
    domain_pack_expansion_field_review_ready_count: number;
    domain_pack_expansion_field_review_blocker_count: number;
    domain_pack_expansion_field_review_ready_percent: number;
    domain_pack_expansion_field_supplement_priority_target_count: number;
    domain_pack_expansion_review_ready_priority_target_count: number;
    domain_pack_expansion_pipeline_progress_percent: number;
    domain_pack_expansion_pipeline_stage: DomainPackExpansionPipelineStage;
    domain_pack_expansion_issue_count: number;
    domain_pack_expansion_review_ready_item_count: number;
    domain_pack_expansion_review_blocked_item_count: number;
    domain_pack_expansion_review_candidate_count: number;
    domain_pack_expansion_review_approved_count: number;
    domain_pack_expansion_review_rejected_count: number;
    domain_pack_expansion_review_needs_revision_count: number;
    domain_pack_expansion_approved_writeback_draft_count: number;
    domain_pack_expansion_writeback_draft_ready_count: number;
    domain_pack_expansion_writeback_queued_count: number;
    domain_pack_expansion_writeback_written_back_count: number;
    domain_pack_expansion_writeback_needs_revision_count: number;
    domain_pack_expansion_development_progress_average_percent: number;
    domain_pack_expansion_field_workbench_controls_percent: number;
    domain_pack_expansion_manual_review_closure_percent: number;
    domain_pack_expansion_writeback_safety_export_percent: number;
    domain_pack_expansion_second_batch_real_candidates_percent: number;
    domain_pack_expansion_mvp_completion_surface_percent: number;
    story_agent_command_surface_status: StoryAgentMvpStatus;
    story_agent_command_surface_percent: number;
    mcp_story_agent_tool_count: number;
    mcp_story_agent_loop_percent: number;
    content_command_layer_percent: number;
    production_delivery_contract_percent: number;
    production_delivery_contract_surface_count: number;
  };
  lanes: StoryAgentMvpLane[];
  progress: StoryAgentMvpProgressSlice[];
  priority_targets: StoryAgentMvpPriorityTarget[];
  next_actions: string[];
  notes: string[];
  generated_health: StoryAgentGeneratedHealthReport;
  generated_governance_plan: StoryAgentGeneratedGovernancePlan;
  production_material_pack_health: ProductionMaterialPackHealthReport;
  domain_pack_health: DomainPackProductionHealthReport;
  domain_pack_expansion_candidates: DomainPackExpansionCandidateReport;
  production_portfolio: ProductionReadinessPortfolioReport;
  markdown: string;
}

export interface GearsJobSubmitRequest {
  job_type?: GearsExecutionJobType;
  source_unit_ids?: string[];
  source_unit_id?: string;
  use_gears_api?: boolean;
  overwrite_existing?: boolean;
  payload?: Record<string, unknown>;
  callback_url?: string;
  note?: string;
}

export interface GearsJobSubmitFailure {
  index: number;
  path?: string;
  source_unit_id?: string;
  gears_job_id?: string;
  idempotency_key?: string;
  failure_category?: GearsExecutionFailureCategory;
  error_code?: string;
  message: string;
}

export interface GearsJobSubmitAdapterSummary {
  endpoint_configured: boolean;
  requested_count: number;
  accepted_count: number;
  rejected_count: number;
  status: 'mocked' | 'submitted';
}

export interface GearsJobStatusSyncRequest {
  job_type?: GearsExecutionJobType;
  source_unit_ids?: string[];
  source_unit_id?: string;
  include_completed?: boolean;
  limit?: number;
  note?: string;
}

export interface GearsJobLocalAcceptanceRequest {
  job_type?: GearsExecutionJobType;
  source_unit_ids?: string[];
  source_unit_id?: string;
  include_completed?: boolean;
  include_external_jobs?: boolean;
  limit?: number;
  artifact_base_url?: string;
  artifact_url_map?: Record<string, string>;
  artifact_kind?: string;
  note?: string;
}

export interface GearsJobStatusSyncAdapterSummary {
  endpoint_configured: boolean;
  requested_count: number;
  returned_count: number;
  failed_count: number;
  status: 'submitted';
}

export interface GearsJobSubmitResult {
  project: StoryProjectMeta;
  gears_job_ledger?: GearsJobLedger;
  seedance_shot_ledger?: SeedanceShotLedger;
  provider_adapter?: GearsJobSubmitAdapterSummary;
  submitted_count: number;
  skipped_count: number;
  failed_count: number;
  submitted_jobs: GearsJobLedgerItem[];
  failures: GearsJobSubmitFailure[];
}

export interface GearsJobStatusSyncResult {
  project: StoryProjectMeta;
  gears_job_ledger?: GearsJobLedger;
  seedance_shot_ledger?: SeedanceShotLedger;
  provider_adapter?: GearsJobStatusSyncAdapterSummary;
  pollable_count: number;
  synced_count: number;
  failed_count: number;
  duplicate_count: number;
  skipped_count: number;
  synced_jobs: GearsJobLedgerItem[];
  failures: GearsJobSubmitFailure[];
}

export interface GearsJobLocalAcceptanceResult {
  project: StoryProjectMeta;
  gears_job_ledger?: GearsJobLedger;
  seedance_shot_ledger?: SeedanceShotLedger;
  accepted_count: number;
  failed_count: number;
  duplicate_count: number;
  skipped_count: number;
  accepted_jobs: GearsJobLedgerItem[];
  callbacks: GearsJobCallbackRequest[];
  failures: GearsJobSubmitFailure[];
}

export interface GearsExternalCallbackHandoffItem {
  source_unit_id: string;
  gears_job_id: string;
  job_type: GearsExecutionJobType;
  status: GearsExecutionJobStatus;
  source_scene_id?: number;
  source_unit_label?: string;
  local_acceptance_artifact_urls: string[];
  external_artifact_urls: string[];
  requires_external_artifact: boolean;
  callback_path: string;
  callback_url: string;
  callback_sample: GearsJobCallbackRequest;
  prompt?: SeedanceShotRetryPrompt;
}

export interface GearsExternalCallbackBatchSample {
  callbacks: GearsJobCallbackRequest[];
  replace_before_import: string[];
  import_note: string;
}

export interface GearsExternalCallbackHandoffPackage {
  schema_version: 'project-gears-external-callback-handoff/v1';
  project: StoryProjectMeta;
  storyId: string;
  title: string;
  exported_at: string;
  callback_path: string;
  callback_url: string;
  preflight_path: string;
  preflight_url: string;
  safe_import_path: string;
  safe_import_url: string;
  total_job_count: number;
  external_ready_count: number;
  local_acceptance_ready_count: number;
  pending_external_artifact_count: number;
  callback_batch_sample: GearsExternalCallbackBatchSample;
  callback_batch_preflight_curl: string;
  callback_batch_curl: string;
  operator_checklist: string[];
  items: GearsExternalCallbackHandoffItem[];
  markdown: string;
}

export interface GearsExternalCallbackHandoffQueueProject {
  project_id: string;
  title: string;
  storyId: string;
  updated_at?: string;
  total_job_count: number;
  external_ready_count: number;
  local_acceptance_ready_count: number;
  pending_external_artifact_count: number;
  callback_path: string;
  callback_url: string;
  preflight_path: string;
  preflight_url: string;
  safe_import_path: string;
  safe_import_url: string;
  callback_batch_sample: GearsExternalCallbackBatchSample;
  items: GearsExternalCallbackHandoffItem[];
}

export interface GearsExternalCallbackHandoffQueuePackage {
  schema_version: 'gears-external-callback-handoff-queue/v1';
  exported_at: string;
  system_preflight_path: string;
  system_safe_import_path: string;
  system_preflight_curl: string;
  system_safe_import_curl: string;
  project_count: number;
  total_job_count: number;
  external_ready_count: number;
  local_acceptance_ready_count: number;
  pending_external_artifact_count: number;
  callback_sample_count: number;
  callback_sample_ready_for_import_count: number;
  callback_sample_placeholder_output_url_count: number;
  callback_sample_local_or_private_output_url_count: number;
  callback_sample_invalid_output_url_count: number;
  sample_payload_ready_for_import: boolean;
  projects: GearsExternalCallbackHandoffQueueProject[];
  callback_batch_sample: GearsExternalCallbackBatchSample;
  operator_checklist: string[];
  notes: string[];
  markdown: string;
}

export type GearsExternalCallbackBatchImportMode = 'preflight' | 'import';

export interface GearsExternalCallbackBatchUnresolvedItem {
  index: number;
  source_project_id?: string;
  source_unit_id?: string;
  gears_job_id?: string;
  event_id?: string;
  reason: 'missing_project' | 'ambiguous_project';
  candidate_project_ids?: string[];
  message: string;
}

export interface GearsExternalCallbackBatchProjectResult {
  project_id: string;
  received_count: number;
  blocked: boolean;
  preflight?: GearsExternalCallbackPreflightResult;
  import_result?: GearsExternalCallbackImportResult;
  error?: string;
}

export interface GearsExternalCallbackBatchImportResult {
  schema_version: 'system-gears-external-callback-batch-import/v1';
  mode: GearsExternalCallbackBatchImportMode;
  blocked: boolean;
  received_count: number;
  resolved_count: number;
  unresolved_count: number;
  project_count: number;
  ready_to_import_count: number;
  updated_count: number;
  failed_count: number;
  duplicate_count: number;
  blocking_count: number;
  warning_count: number;
  project_results: GearsExternalCallbackBatchProjectResult[];
  unresolved_callbacks: GearsExternalCallbackBatchUnresolvedItem[];
  operator_checklist: string[];
  markdown: string;
}

export type GearsExternalCallbackPreflightSeverity = 'blocking' | 'warning' | 'info';

export interface GearsExternalCallbackPreflightIssue {
  index: number;
  severity: GearsExternalCallbackPreflightSeverity;
  code: string;
  message: string;
  path?: string;
  source_unit_id?: string;
  gears_job_id?: string;
}

export interface GearsExternalCallbackPreflightItem {
  index: number;
  source_unit_id?: string;
  gears_job_id?: string;
  job_type?: GearsExecutionJobType;
  event_id?: string;
  has_event_id: boolean;
  callback_status: GearsExecutionJobStatus;
  ledger_status?: GearsExecutionJobStatus;
  artifact_urls: string[];
  matched_ledger: boolean;
  has_external_artifact_url: boolean;
  has_placeholder_artifact_url: boolean;
  has_local_acceptance_artifact_url: boolean;
  has_private_or_local_artifact_url: boolean;
  has_invalid_artifact_url: boolean;
  is_duplicate_event: boolean;
  duplicate_event_source?: 'ledger' | 'batch' | 'ledger_and_batch';
  duplicate_of_index?: number;
  would_update: boolean;
  issue_count: number;
}

export interface GearsExternalCallbackPreflightResult {
  schema_version: 'project-gears-external-callback-preflight/v1';
  project: StoryProjectMeta;
  received_count: number;
  ready_to_import_count: number;
  duplicate_event_count: number;
  blocking_count: number;
  warning_count: number;
  info_count: number;
  items: GearsExternalCallbackPreflightItem[];
  issues: GearsExternalCallbackPreflightIssue[];
  markdown: string;
}

export interface GearsJobCallbackRequest {
  gears_job_id?: string;
  gearsJobId?: string;
  job_id?: string;
  jobId?: string;
  task_id?: string;
  taskId?: string;
  id?: string;
  job_type?: GearsExecutionJobType;
  jobType?: GearsExecutionJobType;
  source_project_id?: string;
  sourceProjectId?: string;
  source_story_id?: string;
  sourceStoryId?: string;
  series_project_id?: string;
  seriesProjectId?: string;
  source_unit_id?: string;
  sourceUnitId?: string;
  external_id?: string;
  externalId?: string;
  custom_id?: string;
  customId?: string;
  shot_id?: string;
  shotId?: string;
  production_id?: string;
  productionId?: string;
  status?: string;
  task_status?: string;
  taskStatus?: string;
  state?: string;
  phase?: string;
  progress?: number | string;
  progress_percent?: number | string;
  progressPercent?: number | string;
  percent?: number | string;
  percentage?: number | string;
  progress_ratio?: number | string;
  progressRatio?: number | string;
  provider_event_at?: string | number;
  providerEventAt?: string | number;
  event_time?: string | number;
  eventTime?: string | number;
  event_at?: string | number;
  eventAt?: string | number;
  timestamp?: string | number;
  created_at?: string | number;
  createdAt?: string | number;
  updated_at?: string | number;
  updatedAt?: string | number;
  completed_at?: string | number;
  completedAt?: string | number;
  finished_at?: string | number;
  finishedAt?: string | number;
  artifacts?: GearsExecutionArtifact[];
  artifact_urls?: string[];
  artifactUrls?: string[];
  artifact_url?: string;
  artifactUrl?: string;
  video_url?: string;
  videoUrl?: string;
  output_url?: string;
  outputUrl?: string;
  file_url?: string;
  fileUrl?: string;
  manifest_url?: string;
  manifestUrl?: string;
  subtitle_url?: string;
  subtitleUrl?: string;
  srt_url?: string;
  srtUrl?: string;
  vtt_url?: string;
  vttUrl?: string;
  audio_url?: string;
  audioUrl?: string;
  image_url?: string;
  imageUrl?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  poster_url?: string;
  posterUrl?: string;
  url?: string;
  failure_category?: GearsExecutionFailureCategory;
  failureCategory?: GearsExecutionFailureCategory;
  failure_reason?: string;
  failureReason?: string;
  error_code?: string | number;
  errorCode?: string | number;
  provider_error_code?: string | number;
  providerErrorCode?: string | number;
  code?: string | number;
  error?: string;
  message?: string;
  note?: string;
  event_id?: string;
  eventId?: string;
  callback_id?: string;
  callbackId?: string;
  idempotency_key?: string;
  idempotencyKey?: string;
  quality_score?: number;
  qualityScore?: number;
  review_note?: string;
  reviewNote?: string;
  data?: unknown;
  result?: unknown;
  response?: unknown;
  job?: unknown;
  task?: unknown;
  item?: unknown;
  record?: unknown;
  callbacks?: unknown;
  events?: unknown;
  jobs?: unknown;
  tasks?: unknown;
  items?: unknown;
  results?: unknown;
  output?: unknown;
  outputs?: unknown;
  files?: unknown;
  media?: unknown;
  assets?: unknown;
  payload?: unknown;
}

export interface GearsJobCallbackResult {
  project: StoryProjectMeta;
  gears_job_ledger?: GearsJobLedger;
  seedance_shot_ledger?: SeedanceShotLedger;
  received_count: number;
  updated_count: number;
  failed_count: number;
  duplicate_count: number;
  failures: GearsJobSubmitFailure[];
  gears_job_id?: string;
  source_unit_id?: string;
  status?: GearsExecutionJobStatus;
}

export interface GearsExternalCallbackImportResult {
  schema_version: 'project-gears-external-callback-import/v1';
  project: StoryProjectMeta;
  preflight: GearsExternalCallbackPreflightResult;
  blocked: boolean;
  received_count: number;
  updated_count: number;
  failed_count: number;
  duplicate_count: number;
  import_result?: GearsJobCallbackResult;
}

export interface GearsExecutionConfigInfo {
  provider: 'gears';
  api_base_url_configured: boolean;
  api_token_configured: boolean;
  callback_secret_configured: boolean;
  callback_base_configured: boolean;
  callback_base_envs: string[];
  submit_endpoint_path: string;
  job_status_endpoint_path: string;
  project_callback_path_template: string;
  series_callback_path_template: string;
  supported_job_types: GearsExecutionJobType[];
  callback_batch_item_limit: number;
  callback_event_retention_limit: number;
  legacy_seedance_provider_envs: string[];
  ready_for_submit: boolean;
  missing_submit_requirements: string[];
  configuration_warnings: string[];
  next_actions: string[];
  generated_at: string;
}

export interface GearsExecutionContractInfo {
  provider: 'gears';
  schema_version: 'gears-execution-contract/v1';
  env: {
    api_base_url: 'GEARS_API_BASE_URL';
    api_token: 'GEARS_API_TOKEN';
    callback_secret: 'GEARS_CALLBACK_SECRET';
    callback_base_url: 'GEARS_CALLBACK_BASE_URL';
  };
  supported_job_types: GearsExecutionJobType[];
  submit: {
    method: 'POST';
    path: '/gears/jobs';
    request_fields: string[];
    accepted_response_shapes: string[];
    request_example: Record<string, unknown>;
    response_example: Record<string, unknown>;
  };
  poll: {
    method: 'GET';
    path: '/gears/jobs/{gears_job_id}';
    response_fields: string[];
    accepted_status_fields: string[];
    accepted_response_shapes: string[];
    accepted_artifact_fields: string[];
    accepted_progress_fields: string[];
  };
  callback: {
    project_path: '/api/projects/:projectId/gears-callback';
    series_path: '/api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-callback';
    auth_env: 'GEARS_CALLBACK_SECRET';
    auth_headers: string[];
    auth_optional_when_unset: boolean;
    accepted_envelope_shapes: string[];
    request_fields: string[];
    accepted_status_fields: string[];
    accepted_artifact_fields: string[];
    accepted_progress_fields: string[];
    accepted_time_fields: string[];
    idempotency_fields: string[];
    max_batch_items: number;
    response_fields: string[];
    request_examples: Record<string, unknown>[];
  };
  notes: string[];
}

export type GearsExecutionReadinessCheckStatus = 'pass' | 'warn' | 'fail';

export interface GearsExecutionReadinessCheck {
  id: string;
  label: string;
  status: GearsExecutionReadinessCheckStatus;
  message: string;
  next_action?: string;
}

export interface GearsExecutionReadinessSmoke {
  id: string;
  label: string;
  status: GearsExecutionReadinessCheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface GearsExecutionLiveE2EStep {
  id: string;
  label: string;
  status: 'ready' | 'blocked';
  method: 'GET' | 'POST';
  path: string;
  blocked_by: string[];
  expected_result: string;
}

export interface GearsExecutionLiveE2EPlan {
  ready: boolean;
  ready_step_count: number;
  total_step_count: number;
  blocked_by: string[];
  steps: GearsExecutionLiveE2EStep[];
}

export interface GearsExecutionSmokePackageStep {
  id: string;
  label: string;
  method: 'GET' | 'POST';
  path: string;
  headers: Record<string, string>;
  request_body?: Record<string, unknown>;
  accepted_response_shapes?: string[];
  expected_story_agent_result: string[];
}

export interface GearsExecutionSmokePackage {
  provider: 'gears';
  schema_version: 'gears-execution-smoke-package/v1';
  readiness_status: GearsExecutionReadinessReport['status'];
  readiness_score: number;
  local_smoke_passed_count: number;
  local_smoke_total_count: number;
  live_ready_step_count: number;
  live_total_step_count: number;
  prerequisites: string[];
  execution_order: string[];
  steps: GearsExecutionSmokePackageStep[];
  markdown: string;
  generated_at: string;
}

export interface GearsExecutionLiveSmokeRunRequest {
  execute?: boolean;
  poll_after_submit?: boolean;
  note?: string;
}

export type GearsExecutionLiveSmokeRunStatus = 'dry_run' | 'blocked' | 'passed' | 'partial' | 'failed';
export type GearsExecutionLiveSmokeRunStepStatus = 'blocked' | 'skipped' | 'passed' | 'failed';

export interface GearsExecutionLiveSmokeRunStepResult {
  id: string;
  label: string;
  method: 'GET' | 'POST';
  path: string;
  status: GearsExecutionLiveSmokeRunStepStatus;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  blocked_by?: string[];
  message: string;
  requested_count?: number;
  accepted_count?: number;
  rejected_count?: number;
  returned_count?: number;
  failed_count?: number;
  submitted_job_ids?: string[];
  failures?: GearsJobSubmitFailure[];
}

export interface GearsExecutionLiveSmokeRunReport {
  provider: 'gears';
  schema_version: 'gears-execution-live-smoke-run/v1';
  status: GearsExecutionLiveSmokeRunStatus;
  execute: boolean;
  poll_after_submit: boolean;
  readiness_status: GearsExecutionReadinessReport['status'];
  readiness_score: number;
  blocked_by: string[];
  submitted_job_ids: string[];
  accepted_count: number;
  rejected_count: number;
  failed_count: number;
  steps: GearsExecutionLiveSmokeRunStepResult[];
  markdown: string;
  generated_at: string;
}

export interface GearsExecutionPressureCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

export interface GearsExecutionPressureReport {
  provider: 'gears';
  schema_version: 'gears-execution-pressure-report/v1';
  status: 'pass' | 'fail';
  callback_batch_item_limit: number;
  callback_event_retention_limit: number;
  batch_at_limit_count: number;
  batch_over_limit_count: number;
  extracted_at_limit_count: number;
  overflow_rejected: boolean;
  retained_event_count: number;
  dropped_event_count: number;
  first_retained_event_id?: string;
  last_retained_event_id?: string;
  checks: GearsExecutionPressureCheck[];
  markdown: string;
  generated_at: string;
}

export type GearsExecutionGeneratedProjectPressureRisk = 'ok' | 'watch' | 'blocked';
export type GearsExecutionGeneratedProjectKind = 'story_project' | 'ai_comic_series_project';

export interface GearsExecutionGeneratedProjectPressureItem {
  project_id: string;
  project_kind: GearsExecutionGeneratedProjectKind;
  title?: string;
  job_count: number;
  active_count: number;
  terminal_count: number;
  failed_count: number;
  callback_event_count: number;
  max_callback_events_per_job: number;
  near_event_retention_limit_count: number;
  artifact_count: number;
  failure_categories: Partial<Record<GearsExecutionFailureCategory, number>>;
  latest_updated_at?: string;
  risk_level: GearsExecutionGeneratedProjectPressureRisk;
  recommendations: string[];
}

export interface GearsExecutionGeneratedProjectPressureReport {
  provider: 'gears';
  schema_version: 'gears-execution-generated-project-pressure/v1';
  scanned_story_project_count: number;
  scanned_series_project_count: number;
  project_with_gears_ledger_count: number;
  total_job_count: number;
  total_active_count: number;
  total_terminal_count: number;
  total_failed_count: number;
  total_callback_event_count: number;
  max_project_job_count: number;
  max_job_callback_event_count: number;
  callback_batch_item_limit: number;
  callback_event_retention_limit: number;
  pressure_status: GearsExecutionGeneratedProjectPressureRisk;
  items: GearsExecutionGeneratedProjectPressureItem[];
  recommendations: string[];
  markdown: string;
  generated_at: string;
}

export type GearsExecutionAcceptanceStatus = 'ready' | 'attention' | 'blocked';
export type GearsExecutionAcceptanceCheckStatus = 'pass' | 'warn' | 'blocked';

export interface GearsExecutionAcceptanceCheck {
  id: string;
  label: string;
  status: GearsExecutionAcceptanceCheckStatus;
  message: string;
  evidence?: Record<string, unknown>;
  next_action?: string;
}

export interface GearsExecutionAcceptanceArtifact {
  id: string;
  label: string;
  method: 'GET' | 'POST';
  path: string;
  purpose: string;
}

export interface GearsExecutionAcceptanceReport {
  provider: 'gears';
  schema_version: 'gears-execution-acceptance/v1';
  status: GearsExecutionAcceptanceStatus;
  readiness_status: GearsExecutionReadinessReport['status'];
  readiness_score: number;
  local_smoke_passed_count: number;
  local_smoke_total_count: number;
  live_e2e_ready: boolean;
  live_ready_step_count: number;
  live_total_step_count: number;
  pressure_status: GearsExecutionPressureReport['status'];
  generated_project_pressure_status: GearsExecutionGeneratedProjectPressureRisk;
  generated_project_with_ledger_count: number;
  generated_project_total_job_count: number;
  generated_health_status: GearsExecutionAcceptanceStatus;
  generated_health_ready_count: number;
  generated_health_planned_count: number;
  generated_health_production_gap_count: number;
  generated_health_interrupted_count: number;
  acceptance_passed_count: number;
  acceptance_total_count: number;
  blocking_check_ids: string[];
  warning_check_ids: string[];
  required_envs: string[];
  handoff_artifacts: GearsExecutionAcceptanceArtifact[];
  checks: GearsExecutionAcceptanceCheck[];
  recommended_next_actions: string[];
  markdown: string;
  generated_at: string;
}

export type GearsExecutionWorkerAcceptanceCommandPhase =
  | 'preflight'
  | 'worker_submit'
  | 'worker_poll'
  | 'worker_pressure'
  | 'story_agent_callback'
  | 'story_agent_live_smoke';

export interface GearsExecutionWorkerAcceptanceEnvVar {
  name: string;
  required: boolean;
  value_placeholder: string;
  description: string;
}

export interface GearsExecutionWorkerAcceptancePayload {
  id: string;
  label: string;
  filename: string;
  content: Record<string, unknown>;
}

export interface GearsExecutionWorkerAcceptanceCommand {
  id: string;
  label: string;
  phase: GearsExecutionWorkerAcceptanceCommandPhase;
  command: string;
  payload_id?: string;
  expected_assertions: string[];
}

export interface GearsExecutionWorkerAcceptanceSmokeTarget {
  id: string;
  kind: 'story_project' | 'ai_comic_series_project';
  title?: string;
  updated_at?: string;
  current_story_id?: string;
  video_type?: VideoType;
  episode_count?: number;
  generated_episode_count?: number;
  generated_episode_story_id_count?: number;
  existing_generated_episode_story_id_count?: number;
  seedance_production_item_count?: number;
  seedance_video_retry_candidate_count?: number;
  open_review_item_count?: number;
  postproduction_seed_job_count?: number;
  ledger_seed_ready?: boolean;
  ledger_seed_score?: number;
  recommended_ledger_seed_job_type?: GearsExecutionJobType;
  ledger_seed_reason?: string;
}

export interface GearsExecutionWorkerAcceptanceSmokeTargets {
  schema_version: 'gears-worker-acceptance-smoke-targets/v1';
  story_project?: GearsExecutionWorkerAcceptanceSmokeTarget;
  series_project?: GearsExecutionWorkerAcceptanceSmokeTarget;
  story_project_candidates: GearsExecutionWorkerAcceptanceSmokeTarget[];
  series_project_candidates: GearsExecutionWorkerAcceptanceSmokeTarget[];
  recommended_env: Record<string, string>;
  warning_count: number;
  warnings: string[];
}

export interface GearsExecutionWorkerRealEndpointReadiness {
  status: 'ready' | 'needs_env' | 'needs_smoke_target';
  ready_to_run_acceptance: boolean;
  missing_envs: string[];
  configured_envs: string[];
  smoke_target_ready: boolean;
  story_project_id?: string;
  series_project_id?: string;
  recommended_command: string;
  next_actions: string[];
}

export interface GearsExecutionWorkerAcceptanceKit {
  provider: 'gears';
  schema_version: 'gears-execution-worker-acceptance-kit/v1';
  acceptance_status: GearsExecutionAcceptanceStatus;
  readiness_score: number;
  local_smoke_passed_count: number;
  local_smoke_total_count: number;
  required_envs: string[];
  env_vars: GearsExecutionWorkerAcceptanceEnvVar[];
  env_template: string;
  smoke_targets: GearsExecutionWorkerAcceptanceSmokeTargets;
  real_endpoint_readiness: GearsExecutionWorkerRealEndpointReadiness;
  payloads: GearsExecutionWorkerAcceptancePayload[];
  commands: GearsExecutionWorkerAcceptanceCommand[];
  shell_script_filename: string;
  shell_script: string;
  verification_checklist: string[];
  markdown: string;
  generated_at: string;
}

export type GearsExecutionWorkerEvidenceDocumentKind =
  | 'acceptance_report'
  | 'worker_acceptance_kit'
  | 'smoke_handoff_package'
  | 'pressure_report'
  | 'generated_project_pressure_report'
  | 'generated_health_report'
  | 'story_agent_mvp_status_report'
  | 'production_material_pack_health_report'
  | 'domain_pack_production_health_report';

export interface GearsExecutionWorkerEvidenceDocument {
  id: GearsExecutionWorkerEvidenceDocumentKind;
  label: string;
  filename: string;
  source_endpoint: string;
  format: 'markdown';
  content: string;
  content_length: number;
  summary: string;
}

export interface GearsExecutionWorkerEvidenceBundle {
  provider: 'gears';
  schema_version: 'gears-execution-worker-evidence-bundle/v1';
  status: GearsExecutionAcceptanceStatus;
  readiness_status: GearsExecutionReadinessReport['status'];
  readiness_score: number;
  local_smoke_passed_count: number;
  local_smoke_total_count: number;
  live_e2e_ready: boolean;
  live_ready_step_count: number;
  live_total_step_count: number;
  pressure_status: GearsExecutionPressureReport['status'];
  generated_project_pressure_status: GearsExecutionGeneratedProjectPressureRisk;
  generated_project_with_ledger_count: number;
  generated_project_total_job_count: number;
  generated_health_status: GearsExecutionAcceptanceStatus;
  generated_health_ready_count: number;
  generated_health_planned_count: number;
  generated_health_production_gap_count: number;
  generated_health_interrupted_count: number;
  story_agent_mvp_status: StoryAgentMvpStatus;
  story_agent_mvp_score: number;
  real_gears_callback_base_public: boolean;
  real_gears_acceptance_ready_to_run: boolean;
  real_gears_acceptance_blocker: string;
  local_acceptance_counts_as_real_external_callback: false;
  seedance_provider_external_loop_ready: boolean;
  production_material_pack_status: ProductionMaterialPackHealthStatus;
  production_material_pack_issue_count: number;
  production_material_pack_core_ready_count: number;
  production_material_pack_core_total_count: number;
  domain_pack_status: DomainPackProductionHealthStatus;
  domain_pack_issue_count: number;
  domain_pack_ready_count: number;
  domain_pack_required_count: number;
  acceptance_passed_count: number;
  acceptance_total_count: number;
  command_count: number;
  payload_count: number;
  required_envs: string[];
  blocking_check_ids: string[];
  warning_check_ids: string[];
  documents: GearsExecutionWorkerEvidenceDocument[];
  operator_checklist: string[];
  recommended_next_actions: string[];
  markdown: string;
  generated_at: string;
}

export interface GearsExecutionWorkerEvidenceSignoffAction {
  priority?: string;
  owner?: string;
  action: string;
  evidence?: string;
  gate_id?: string;
  sample_files?: string[];
  sample_paths?: string[];
}

export interface GearsExecutionWorkerEvidenceSignoffGate {
  id: string;
  label?: string;
  status: string;
  summary?: string;
}

export interface GearsExecutionWorkerEvidenceSignoffReport {
  provider: 'gears';
  schema_version: 'gears-execution-worker-evidence-signoff/v1';
  status: GearsExecutionAcceptanceStatus;
  evidence_dir?: string;
  evidence_dir_source?: 'input' | 'env' | 'latest' | 'missing';
  evidence_dir_allowed: boolean;
  evidence_dir_error?: string;
  acceptance_passed: boolean;
  signoff_ready: boolean;
  integrity_passed: boolean;
  health_audit_passed: boolean;
  production_material_pack_health_audit_passed: boolean;
  domain_pack_production_health_audit_passed: boolean;
  mvp_status_audit_passed: boolean;
  mvp_governance_counts_consistent: boolean;
  mvp_governance_counts_verdict_embedded: boolean;
  mvp_governance_counts_archive_embedded: boolean;
  mvp_governance_count_mismatch_ids: string[];
  mvp_real_external_callback_readiness_consistent: boolean;
  mvp_real_external_callback_readiness_verdict_embedded: boolean;
  mvp_real_external_callback_readiness_archive_embedded: boolean;
  mvp_real_external_callback_readiness_mismatch_ids: string[];
  mvp_real_gears_acceptance_ready_before: boolean;
  mvp_real_gears_acceptance_ready_after: boolean;
  mvp_real_gears_callback_base_public_before: boolean;
  mvp_real_gears_callback_base_public_after: boolean;
  mvp_local_acceptance_counts_as_real_external_callback_before: boolean;
  mvp_local_acceptance_counts_as_real_external_callback_after: boolean;
  mvp_real_gears_acceptance_blocker_before: string;
  mvp_real_gears_acceptance_blocker_after: string;
  system_external_callback_passed: boolean;
  system_external_callback_ready_to_import_count: number;
  system_external_callback_updated_count: number;
  system_external_callback_blocking_count: number;
  system_external_callback_failed_count: number;
  system_external_callback_unresolved_count: number;
  system_external_callback_project_count: number;
  system_external_output_url_source_ready: boolean;
  system_external_output_url_imported: boolean;
  system_external_output_url_import_match_count: number;
  system_external_output_url_verdict_embedded: boolean;
  system_external_output_url_verdict_consistent: boolean;
  system_external_output_url_archive_embedded: boolean;
  system_external_output_url_archive_consistent: boolean;
  system_external_output_url_configured_from_env: boolean;
  system_external_output_url_source: string;
  pressure_submitted: boolean;
  gate_counts: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  failed_gate_ids: string[];
  skipped_gate_ids: string[];
  missing_required_attachment_count: number;
  required_attachment_count: number;
  required_checksum_count: number;
  evidence_file_count: number;
  worker_record_count: number;
  worker_transport_error_count: number;
  worker_http_error_count: number;
  worker_unknown_count: number;
  worker_missing_worker_id_count: number;
  worker_missing_source_id_count: number;
  worker_missing_ready_artifact_count: number;
  worker_failure_category_counts: Record<string, number>;
  callback_transport_error_count: number;
  callback_http_error_count: number;
  callback_ledger_match_missing_count: number;
  callback_failed_count: number;
  health_ready_count_before: number;
  health_ready_count_after: number;
  health_ready_count_delta: number;
  health_interrupted_count_delta: number;
  health_production_gap_count_delta: number;
  production_material_pack_status_before?: ProductionMaterialPackHealthStatus;
  production_material_pack_status_after?: ProductionMaterialPackHealthStatus;
  production_material_pack_issue_count_before: number;
  production_material_pack_issue_count_after: number;
  production_material_pack_issue_count_delta: number;
  production_material_pack_core_ready_count_before: number;
  production_material_pack_core_ready_count_after: number;
  domain_pack_status_before?: DomainPackProductionHealthStatus;
  domain_pack_status_after?: DomainPackProductionHealthStatus;
  domain_pack_issue_count_before: number;
  domain_pack_issue_count_after: number;
  domain_pack_issue_count_delta: number;
  domain_pack_ready_count_before: number;
  domain_pack_ready_count_after: number;
  mvp_status_before?: StoryAgentMvpStatus;
  mvp_status_after?: StoryAgentMvpStatus;
  mvp_score_before: number;
  mvp_score_after: number;
  mvp_score_delta: number;
  mvp_seedance_placeholder_asset_count_before: number;
  mvp_seedance_placeholder_asset_count_after: number;
  mvp_seedance_placeholder_asset_count_delta: number;
  mvp_seedance_production_asset_ready_count_before: number;
  mvp_seedance_production_asset_ready_count_after: number;
  mvp_seedance_production_asset_ready_count_delta: number;
  mvp_knowledge_writeback_ready_count_before: number;
  mvp_knowledge_writeback_ready_count_after: number;
  mvp_knowledge_writeback_ready_count_delta: number;
  mvp_knowledge_writeback_queued_count_before: number;
  mvp_knowledge_writeback_queued_count_after: number;
  mvp_knowledge_writeback_queued_count_delta: number;
  mvp_knowledge_writeback_needs_revision_count_before: number;
  mvp_knowledge_writeback_needs_revision_count_after: number;
  mvp_knowledge_writeback_needs_revision_count_delta: number;
  large_project_request_unit_count: number;
  large_project_response_record_count: number;
  large_project_accepted_count: number;
  large_project_rejected_count: number;
  large_project_failed_count: number;
  large_project_source_echo_count: number;
  large_project_missing_requested_source_count: number;
  large_project_duplicate_source_id_count: number;
  large_project_unexpected_source_count: number;
  required_files: string[];
  missing_required_files: string[];
  gates: GearsExecutionWorkerEvidenceSignoffGate[];
  recommended_actions: GearsExecutionWorkerEvidenceSignoffAction[];
  markdown: string;
  generated_at: string;
}

export interface GearsExecutionReadinessReport {
  provider: 'gears';
  schema_version: 'gears-execution-readiness/v1';
  status: 'ready' | 'attention' | 'blocked';
  score: number;
  local_smoke_passed_count: number;
  local_smoke_total_count: number;
  blocking_check_ids: string[];
  live_e2e: GearsExecutionLiveE2EPlan;
  checks: GearsExecutionReadinessCheck[];
  smoke: GearsExecutionReadinessSmoke[];
  next_actions: string[];
  generated_at: string;
}

export type SeedanceAssetModality = 'image' | 'video' | 'audio';

export type SeedanceAssetReferenceKind = 'character' | 'location' | 'prop' | 'camera' | 'audio';

export type SeedanceAssetUploadStatus = 'pending_upload' | 'uploaded' | 'failed' | 'external';

export type SeedanceAssetSlotRole =
  | 'character_reference'
  | 'location_reference'
  | 'prop_reference'
  | 'camera_reference'
  | 'music_reference'
  | 'sound_reference';

export interface SeedanceAssetReference {
  asset_id: string;
  kind: SeedanceAssetReferenceKind;
  label: string;
  modality: SeedanceAssetModality;
  reference_slot: string;
  role: SeedanceAssetSlotRole;
  description: string;
  source_scene_ids: number[];
  source_shot_ids: string[];
  required: boolean;
}

export interface SeedanceShotAssetSlot {
  asset_id: string;
  label: string;
  kind: SeedanceAssetReferenceKind;
  modality: SeedanceAssetModality;
  reference_slot: string;
  role: SeedanceAssetSlotRole;
  required: boolean;
  prompt_usage: string;
}

export type SeedanceAssetBindingStatus = 'bound' | 'missing_file' | 'missing_reference_slot';

export type SeedanceAssetHistoryEventType =
  | 'manual_bind'
  | 'batch_import'
  | 'file_upload'
  | 'placeholder_draft'
  | 'cross_project_reuse';

export interface SeedanceAssetHistoryEvent {
  event_id: string;
  event_type: SeedanceAssetHistoryEventType;
  created_at: string;
  upload_status?: SeedanceAssetUploadStatus;
  provider?: string;
  provider_asset_id?: string;
  file_url?: string;
  file_id?: string;
  local_path?: string;
  original_filename?: string;
  mime_type?: string;
  size_bytes?: number;
  source_project_id?: string;
  source_project_title?: string;
  source_asset_id?: string;
  note?: string;
}

export interface SeedanceAssetBindingItem {
  asset_id: string;
  label: string;
  kind: SeedanceAssetReferenceKind;
  modality: SeedanceAssetModality;
  role: SeedanceAssetSlotRole;
  reference_slot?: string;
  file_url?: string;
  file_id?: string;
  local_path?: string;
  original_filename?: string;
  mime_type?: string;
  size_bytes?: number;
  provider?: string;
  provider_asset_id?: string;
  upload_status?: SeedanceAssetUploadStatus;
  upload_error?: string;
  prompt_usage?: string;
  source_scene_ids: number[];
  source_shot_ids: string[];
  required_by_shot_count: number;
  has_reference_slot: boolean;
  is_bound: boolean;
  is_placeholder?: boolean;
  needs_upload: boolean;
  status: SeedanceAssetBindingStatus;
}

export interface SeedanceAssetLibraryItem {
  asset_id: string;
  label: string;
  kind: SeedanceAssetReferenceKind;
  modality: SeedanceAssetModality;
  role: SeedanceAssetSlotRole;
  reference_slot?: string;
  file_url?: string;
  file_id?: string;
  local_path?: string;
  original_filename?: string;
  mime_type?: string;
  size_bytes?: number;
  provider?: string;
  provider_asset_id?: string;
  upload_status?: SeedanceAssetUploadStatus;
  upload_error?: string;
  history?: SeedanceAssetHistoryEvent[];
  description?: string;
  updated_at: string;
}

export interface SeedanceAssetLibrary {
  schema_version: 'seedance-asset-library/v1';
  updated_at?: string;
  items: SeedanceAssetLibraryItem[];
}

export interface SeedanceAssetLibraryUpdateRequest {
  items: Array<{
    asset_id?: string;
    label: string;
    kind: SeedanceAssetReferenceKind;
    modality?: SeedanceAssetModality;
    role?: SeedanceAssetSlotRole;
    reference_slot?: string;
    file_url?: string;
    file_id?: string;
    local_path?: string;
    original_filename?: string;
    mime_type?: string;
    size_bytes?: number;
    provider?: string;
    provider_asset_id?: string;
    upload_status?: SeedanceAssetUploadStatus;
    upload_error?: string;
    description?: string;
  }>;
}

export interface SeedanceAssetBatchImportRequest {
  source_note?: string;
  items: Array<{
    asset_id?: string;
    label?: string;
    kind?: SeedanceAssetReferenceKind;
    modality?: SeedanceAssetModality;
    role?: SeedanceAssetSlotRole;
    reference_slot?: string;
    file_url?: string;
    file_id?: string;
    local_path?: string;
    original_filename?: string;
    mime_type?: string;
    size_bytes?: number;
    provider?: string;
    provider_asset_id?: string;
    upload_status?: SeedanceAssetUploadStatus;
    upload_error?: string;
    description?: string;
  }>;
}

export interface SeedanceAssetBatchImportSkippedItem {
  index: number;
  reason: string;
  asset_id?: string;
  label?: string;
}

export interface SeedanceAssetBatchImportResult {
  detail: StoryProjectDetail;
  imported_count: number;
  matched_existing_count: number;
  skipped_count: number;
  updated_asset_ids: string[];
  skipped_items: SeedanceAssetBatchImportSkippedItem[];
  source_note?: string;
}

export interface SeedanceAssetFileUploadResult {
  detail: StoryProjectDetail;
  asset: SeedanceAssetLibraryItem;
  file_id: string;
  local_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface ProjectSeedanceAssetPlaceholderItem {
  asset_id: string;
  label: string;
  kind: SeedanceAssetReferenceKind;
  modality: SeedanceAssetModality;
  role: SeedanceAssetSlotRole;
  reference_slot?: string;
  local_path: string;
  relative_path: string;
  file_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: 'created' | 'updated' | 'skipped';
  source_shot_ids: string[];
  source_scene_ids: number[];
}

export interface ProjectSeedanceAssetPlaceholderResult {
  schema_version: 'project-seedance-asset-placeholders/v1';
  project_id: string;
  storyId: string;
  title: string;
  generated_at: string;
  placeholder_dir: string;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  before_upload_required_count: number;
  after_upload_required_count: number;
  before_unbound_shot_count: number;
  after_unbound_shot_count: number;
  items: ProjectSeedanceAssetPlaceholderItem[];
  detail: StoryProjectDetail;
  board: StoryProductionBoard;
}

export interface SeedanceGlobalAssetLibraryItem {
  global_asset_id: string;
  source_project_id: string;
  source_project_title: string;
  source_asset_id: string;
  label: string;
  kind: SeedanceAssetReferenceKind;
  modality: SeedanceAssetModality;
  role: SeedanceAssetSlotRole;
  reference_slot?: string;
  file_url?: string;
  file_id?: string;
  local_path?: string;
  original_filename?: string;
  mime_type?: string;
  size_bytes?: number;
  provider?: string;
  provider_asset_id?: string;
  upload_status?: SeedanceAssetUploadStatus;
  upload_error?: string;
  description?: string;
  updated_at: string;
}

export interface SeedanceGlobalAssetLibrary {
  schema_version: 'seedance-global-asset-library/v1';
  generated_at: string;
  current_project_id?: string;
  total_asset_count: number;
  reusable_asset_count: number;
  items: SeedanceGlobalAssetLibraryItem[];
}

export interface SeedanceAssetReuseRequest {
  source_project_id: string;
  source_asset_id: string;
  target_asset_id?: string;
  target_label?: string;
  target_kind?: SeedanceAssetReferenceKind;
  reference_slot?: string;
  description?: string;
}

export interface SeedanceAssetReuseResult {
  detail: StoryProjectDetail;
  reused_asset: SeedanceAssetLibraryItem;
  source_asset: SeedanceGlobalAssetLibraryItem;
}

export type SeedanceShotProductionStatus =
  | 'not_started'
  | 'prompt_exported'
  | 'submitted'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'skipped';

export type SeedanceProviderFailureCategory =
  | 'asset_missing'
  | 'prompt_invalid'
  | 'content_policy'
  | 'provider_timeout'
  | 'provider_quota'
  | 'provider_auth'
  | 'provider_rate_limit'
  | 'provider_server_error'
  | 'network_error'
  | 'unknown';

export interface SeedanceShotVideoVersion {
  version_id: string;
  status: SeedanceShotProductionStatus;
  created_at: string;
  provider_job_id?: string;
  video_url?: string;
  failure_reason?: string;
  failure_category?: SeedanceProviderFailureCategory;
  provider_error_code?: string;
  note?: string;
  quality_score?: number;
  review_note?: string;
}

export interface SeedanceShotLedgerItem {
  production_id: string;
  shot_id: string;
  source_scene_id?: number;
  status: SeedanceShotProductionStatus;
  prompt_exported_at?: string;
  submitted_at?: string;
  completed_at?: string;
  updated_at: string;
  provider?: string;
  provider_job_id?: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  video_url?: string;
  failure_reason?: string;
  failure_category?: SeedanceProviderFailureCategory;
  provider_error_code?: string;
  retry_count: number;
  notes: string[];
  versions: SeedanceShotVideoVersion[];
  selected_version_id?: string;
}

export interface SeedanceShotLedger {
  schema_version: 'seedance-shot-ledger/v1';
  updated_at?: string;
  items: SeedanceShotLedgerItem[];
}

export type SeedanceShotProviderQueuePriority = 'low' | 'normal' | 'high';

export interface SeedanceShotProviderQueueItem {
  shot_id: string;
  source_scene_id?: number;
  provider_job_id: string;
  status: SeedanceShotProductionStatus;
  queue_position: number;
  queued_at: string;
}

export interface SeedanceShotProviderQueueBatch {
  queue_id: string;
  provider: string;
  priority: SeedanceShotProviderQueuePriority;
  created_at: string;
  updated_at: string;
  submitted_count: number;
  skipped_count: number;
  failed_count: number;
  note?: string;
  items: SeedanceShotProviderQueueItem[];
}

export interface SeedanceShotProviderQueue {
  schema_version: 'seedance-provider-queue/v1';
  updated_at: string;
  latest_queue_id?: string;
  batches: SeedanceShotProviderQueueBatch[];
}

export interface SeedanceShotStatusUpdateRequest {
  shot_id: string;
  status: SeedanceShotProductionStatus;
  provider?: string;
  provider_job_id?: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  video_url?: string;
  failure_reason?: string;
  failure_category?: SeedanceProviderFailureCategory;
  provider_error_code?: string;
  note?: string;
  increment_retry?: boolean;
  quality_score?: number;
  review_note?: string;
}

export interface SeedanceShotStatusBatchUpdateRequest {
  updates: SeedanceShotStatusUpdateRequest[];
}

export interface SeedanceShotStatusBatchUpdateFailure {
  index: number;
  shot_id?: string;
  message: string;
}

export interface SeedanceShotStatusBatchUpdateResult {
  project: StoryProjectMeta;
  seedance_shot_ledger?: SeedanceShotLedger;
  updated_count: number;
  failed_count: number;
  failures: SeedanceShotStatusBatchUpdateFailure[];
}

export interface SeedanceShotVersionSelectRequest {
  shot_id: string;
  version_id: string;
  note?: string;
}

export interface SeedanceShotAutoSelectRequest {
  min_quality_score?: number;
  overwrite_manual?: boolean;
  note?: string;
}

export interface SeedanceShotProviderSubmitRequest {
  shot_ids?: string[];
  provider?: string;
  job_prefix?: string;
  queue_id?: string;
  queue_priority?: SeedanceShotProviderQueuePriority;
  use_provider_adapter?: boolean;
  overwrite_existing?: boolean;
  increment_retry?: boolean;
  note?: string;
}

export interface SeedanceShotProviderSubmitFailure {
  index: number;
  shot_id?: string;
  message: string;
}

export interface SeedanceShotProviderSubmitResult {
  project: StoryProjectMeta;
  seedance_shot_ledger?: SeedanceShotLedger;
  seedance_provider_queue?: SeedanceShotProviderQueue;
  provider_queue_batch?: SeedanceShotProviderQueueBatch;
  provider_adapter?: SeedanceShotProviderSubmitAdapterSummary;
  submitted_count: number;
  skipped_count: number;
  failed_count: number;
  submitted_shots: Array<{
    shot_id: string;
    provider_job_id: string;
    provider_queue_id: string;
    provider_queue_position: number;
    status: SeedanceShotProductionStatus;
  }>;
  failures: SeedanceShotProviderSubmitFailure[];
}

export type SeedanceProviderSubmitRequestMode = 'batch' | 'per_shot';
export type SeedanceProviderPollRequestMode = 'batch' | 'per_target';
export type SeedanceProviderPollHttpMethod = 'POST' | 'GET';
export type SeedanceProviderAdapterPayloadMode = 'story_agent' | 'platform';

export interface SeedanceShotProviderSubmitAdapterSummary {
  endpoint_configured: boolean;
  request_mode: SeedanceProviderSubmitRequestMode;
  requested_count: number;
  accepted_count: number;
  failed_count: number;
}

export type SeedanceShotProviderRecoverableStatus = 'submitted' | 'processing';

export interface SeedanceShotProviderRecoveryRequest {
  timeout_minutes?: number;
  statuses?: SeedanceShotProviderRecoverableStatus[];
  mark_timed_out_failed?: boolean;
  note?: string;
}

export interface SeedanceShotProviderRecoveryItem {
  shot_id: string;
  source_scene_id?: number;
  status: SeedanceShotProviderRecoverableStatus;
  provider?: string;
  provider_job_id?: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  submitted_at?: string;
  updated_at: string;
  minutes_waiting: number;
  failure_reason?: string;
  failure_category?: SeedanceProviderFailureCategory;
  provider_error_code?: string;
}

export interface SeedanceShotProviderRecoveryResult {
  project: StoryProjectMeta;
  seedance_shot_ledger?: SeedanceShotLedger;
  dry_run: boolean;
  timeout_minutes: number;
  checked_count: number;
  timed_out_count: number;
  updated_count: number;
  timed_out_shots: SeedanceShotProviderRecoveryItem[];
}

export interface SeedanceShotProviderPollTarget {
  shot_id: string;
  source_scene_id?: number;
  status: SeedanceShotProviderRecoverableStatus;
  provider?: string;
  provider_job_id?: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  submitted_at?: string;
  updated_at: string;
  minutes_waiting: number;
  retry_count: number;
  seedance_prompt?: string;
}

export interface SeedanceShotCallbackRequest {
  shot_id?: string;
  shotId?: string;
  external_id?: string;
  externalId?: string;
  custom_id?: string;
  customId?: string;
  provider?: string;
  provider_job_id?: string;
  providerJobId?: string;
  job_id?: string;
  jobId?: string;
  task_id?: string;
  taskId?: string;
  request_id?: string;
  requestId?: string;
  id?: string;
  provider_queue_id?: string;
  providerQueueId?: string;
  queue_id?: string;
  queueId?: string;
  batch_id?: string;
  batchId?: string;
  provider_queue_position?: number;
  providerQueuePosition?: number;
  queue_position?: number;
  queuePosition?: number;
  position?: number;
  status?: string;
  task_status?: string;
  taskStatus?: string;
  state?: string;
  phase?: string;
  video_url?: string;
  videoUrl?: string;
  output_url?: string;
  outputUrl?: string;
  file_url?: string;
  fileUrl?: string;
  download_url?: string;
  downloadUrl?: string;
  result_url?: string;
  resultUrl?: string;
  url?: string;
  failure_reason?: string;
  failureReason?: string;
  error_message?: string;
  errorMessage?: string;
  reason?: string;
  failure_category?: SeedanceProviderFailureCategory;
  failureCategory?: SeedanceProviderFailureCategory;
  provider_error_code?: string | number;
  providerErrorCode?: string | number;
  error_code?: string | number;
  errorCode?: string | number;
  status_code?: string | number;
  statusCode?: string | number;
  code?: string | number;
  error?: string;
  message?: string;
  msg?: string;
  note?: string;
  increment_retry?: boolean;
  incrementRetry?: boolean;
  quality_score?: number;
  qualityScore?: number;
  score?: number;
  quality?: number;
  review_note?: string;
  reviewNote?: string;
}

export interface SeedanceShotProviderCallbackRequest extends SeedanceShotCallbackRequest {
  event_id?: string;
  eventId?: string;
  callback_id?: string;
  callbackId?: string;
  payload?: unknown;
}

export interface SeedanceShotCallbackImportRequest {
  callbacks: SeedanceShotCallbackRequest[];
}

export interface SeedanceShotCallbackImportFailure {
  index: number;
  shot_id?: string;
  provider_job_id?: string;
  message: string;
}

export interface SeedanceShotCallbackImportResult {
  project: StoryProjectMeta;
  seedance_shot_ledger?: SeedanceShotLedger;
  updated_count: number;
  failed_count: number;
  failures: SeedanceShotCallbackImportFailure[];
}

export interface SeedanceShotProviderCallbackResult extends SeedanceShotCallbackImportResult {
  provider?: string;
  provider_job_id?: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  event_id?: string;
}

export interface SeedanceShotProviderPollRequest {
  provider?: string;
  queue_id?: string;
  shot_ids?: string[];
  statuses?: SeedanceShotProviderRecoverableStatus[];
  limit?: number;
  include_prompt?: boolean;
  use_provider_adapter?: boolean;
  provider_results?: SeedanceShotProviderCallbackRequest[];
  note?: string;
}

export interface SeedanceShotProviderPollAdapterSummary {
  endpoint_configured: boolean;
  request_mode: SeedanceProviderPollRequestMode;
  http_method: SeedanceProviderPollHttpMethod;
  queried_count: number;
  returned_count: number;
}

export interface SeedanceShotProviderPollResult {
  project: StoryProjectMeta;
  seedance_shot_ledger?: SeedanceShotLedger;
  dry_run: boolean;
  provider?: string;
  queue_id?: string;
  checked_count: number;
  pollable_count: number;
  updated_count: number;
  failed_count: number;
  poll_targets: SeedanceShotProviderPollTarget[];
  provider_adapter?: SeedanceShotProviderPollAdapterSummary;
  failures: SeedanceShotCallbackImportFailure[];
}

export interface SeedanceShotProviderQueueOverviewRequest {
  provider?: string;
  queue_id?: string;
  timeout_minutes?: number;
  include_completed?: boolean;
}

export interface SeedanceShotProviderQueueBatchOverview {
  queue_id: string;
  provider: string;
  priority: SeedanceShotProviderQueuePriority;
  created_at: string;
  updated_at: string;
  note?: string;
  item_count: number;
  submitted_count: number;
  skipped_count: number;
  failed_count: number;
  active_count: number;
  ready_count: number;
  failed_item_count: number;
  timed_out_count: number;
}

export interface SeedanceShotProviderQueueAttentionItem {
  shot_id: string;
  source_scene_id?: number;
  status: SeedanceShotProductionStatus;
  provider?: string;
  provider_job_id?: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  submitted_at?: string;
  updated_at: string;
  minutes_waiting: number;
  timed_out: boolean;
  retry_count: number;
  video_url?: string;
  failure_reason?: string;
  failure_category?: SeedanceProviderFailureCategory;
  provider_error_code?: string;
  suggested_action: string;
}

export interface SeedanceShotProviderQueueOverviewResult {
  project: StoryProjectMeta;
  seedance_shot_ledger?: SeedanceShotLedger;
  seedance_provider_queue?: SeedanceShotProviderQueue;
  provider?: string;
  queue_id?: string;
  generated_at: string;
  timeout_minutes: number;
  total_shot_count: number;
  status_counts: Record<SeedanceShotProductionStatus, number>;
  active_count: number;
  ready_count: number;
  failed_count: number;
  retryable_count: number;
  timed_out_count: number;
  missing_video_count: number;
  attention_count: number;
  batch_count: number;
  latest_queue_batch?: SeedanceShotProviderQueueBatchOverview;
  queue_batches: SeedanceShotProviderQueueBatchOverview[];
  attention_items: SeedanceShotProviderQueueAttentionItem[];
}

export type SeedanceShotProviderRetryPlanReason =
  | 'failed'
  | 'timed_out'
  | 'ready_missing_video'
  | 'unsubmitted';

export type SeedanceShotProviderRetryPlanPriority = 'high' | 'normal' | 'low';

export interface SeedanceShotProviderRetryPlanRequest {
  provider?: string;
  queue_id?: string;
  timeout_minutes?: number;
  max_retry_count?: number;
  include_unsubmitted?: boolean;
  failure_categories?: SeedanceProviderFailureCategory[];
}

export interface SeedanceShotProviderRetryPlanCandidate {
  shot_id: string;
  source_scene_id?: number;
  status: SeedanceShotProductionStatus;
  retry_reason: SeedanceShotProviderRetryPlanReason;
  priority: SeedanceShotProviderRetryPlanPriority;
  provider?: string;
  provider_job_id?: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  submitted_at?: string;
  updated_at: string;
  minutes_waiting: number;
  retry_count: number;
  failure_reason?: string;
  failure_category?: SeedanceProviderFailureCategory;
  provider_error_code?: string;
  suggested_action: string;
  can_resubmit: boolean;
  block_reason?: string;
}

export interface SeedanceShotProviderRetryPlanResult {
  project: StoryProjectMeta;
  seedance_shot_ledger?: SeedanceShotLedger;
  provider?: string;
  queue_id?: string;
  generated_at: string;
  timeout_minutes: number;
  max_retry_count?: number;
  candidate_count: number;
  resubmittable_count: number;
  blocked_count: number;
  high_priority_count: number;
  reason_counts: Record<SeedanceShotProviderRetryPlanReason, number>;
  candidates: SeedanceShotProviderRetryPlanCandidate[];
  markdown: string;
}

export interface SeedanceShotProviderRetrySubmitRequest extends SeedanceShotProviderRetryPlanRequest {
  target_queue_id?: string;
  queue_priority?: SeedanceShotProviderQueuePriority;
  job_prefix?: string;
  use_provider_adapter?: boolean;
  limit?: number;
  note?: string;
}

export interface SeedanceShotProviderRetrySubmitResult {
  project: StoryProjectMeta;
  seedance_shot_ledger?: SeedanceShotLedger;
  seedance_provider_queue?: SeedanceShotProviderQueue;
  retry_plan: SeedanceShotProviderRetryPlanResult;
  selected_shot_ids: string[];
  skipped_blocked_count: number;
  provider_queue_batch?: SeedanceShotProviderQueueBatch;
  provider_adapter?: SeedanceShotProviderSubmitAdapterSummary;
  submitted_count: number;
  skipped_count: number;
  failed_count: number;
  submitted_shots: SeedanceShotProviderSubmitResult['submitted_shots'];
  failures: SeedanceShotProviderSubmitFailure[];
}

export interface SeedanceShotRetryPrompt {
  duration_sec: number;
  characters: string[];
  location: string;
  script_text: string;
  visual_prompt: string;
  camera_suggestion: string;
  seedance_prompt: string;
  seedance_asset_slots: SeedanceShotAssetSlot[];
  seedance_validation_notes: string[];
  negative_constraints: string[];
}

export interface SeedanceShotRetryPackageShot {
  production_id: string;
  shot_id: string;
  source_scene_id?: number;
  status: SeedanceShotProductionStatus;
  retry_count: number;
  failure_reason?: string;
  failure_category?: SeedanceProviderFailureCategory;
  provider_error_code?: string;
  provider_job_id?: string;
  last_video_url?: string;
  suggested_action: string;
  prompt: SeedanceShotRetryPrompt;
}

export interface SeedanceShotRetryPackage {
  schema_version: 'story-seedance-retry-package/v1';
  project: StoryProjectMeta;
  storyId: string;
  title: string;
  exported_at: string;
  total_retry_shot_count: number;
  skipped_ready_shot_count: number;
  shots: SeedanceShotRetryPackageShot[];
  missing_prompt_shots: Array<{
    production_id: string;
    shot_id: string;
    source_scene_id?: number;
    reason: string;
  }>;
  markdown: string;
}

export interface SeedanceShotAssetBinding {
  shot_id: string;
  source_scene_id: number;
  required_asset_ids: string[];
  missing_asset_ids: string[];
  reference_slots: string[];
  prompt_preview: string;
}

export interface SeedanceAssetUploadChecklistItem {
  asset_id: string;
  reference_slot?: string;
  label: string;
  kind: SeedanceAssetReferenceKind;
  modality: SeedanceAssetModality;
  role: SeedanceAssetSlotRole;
  status: SeedanceAssetBindingStatus;
  needs_upload: boolean;
  affected_shot_ids: string[];
  affected_scene_ids: number[];
  suggested_filename: string;
  checklist_note: string;
  acceptance_criteria: string[];
}

export interface SeedanceAssetReportPackage {
  schema_version: 'seedance-asset-report/v1';
  project_id?: string;
  storyId: string;
  title: string;
  generated_at: string;
  total_asset_count: number;
  missing_reference_slot_count: number;
  upload_required_count: number;
  placeholder_asset_count: number;
  production_asset_ready_count: number;
  shot_binding_count: number;
  unbound_shot_count: number;
  upload_checklist: SeedanceAssetUploadChecklistItem[];
  assets: SeedanceAssetBindingItem[];
  shots: SeedanceShotAssetBinding[];
  markdown: string;
}

export type SeedanceDurationRisk = 'ok' | 'dense' | 'overloaded';

export interface SeedanceShotMaterialValidation {
  total_file_count: number;
  image_count: number;
  video_count: number;
  audio_count: number;
  max_total_files: number;
  max_image_files: number;
  max_video_files: number;
  max_audio_files: number;
  missing_required_slots: string[];
  prompt_complexity_score: number;
  duration_sec: number;
  duration_risk: SeedanceDurationRisk;
  warnings: string[];
}

export interface SeedancePackageMaterialValidation {
  total_file_count: number;
  image_count: number;
  video_count: number;
  audio_count: number;
  max_total_files: number;
  max_image_files: number;
  max_video_files: number;
  max_audio_files: number;
  over_limit: boolean;
  warnings: string[];
}

export interface SeedancePromptShotUnit {
  shot_id: string;
  source_scene_id: number;
  source_unit_id?: string;
  duration_sec: number;
  characters: string[];
  location: string;
  script_text: string;
  visual_prompt: string;
  camera_suggestion: string;
  continuity_notes: string[];
  negative_constraints: string[];
  asset_slots: SeedanceShotAssetSlot[];
  material_validation: SeedanceShotMaterialValidation;
  seedance_prompt: string;
}

export interface SeedancePromptPackage {
  schema_version: 'seedance-prompt-package/v1';
  storyId: string;
  title: string;
  target_platform: 'seedance_2_0';
  prompt_language: 'zh';
  total_duration_sec: number;
  asset_reference_plan: string[];
  asset_references: SeedanceAssetReference[];
  material_validation: SeedancePackageMaterialValidation;
  shot_units: SeedancePromptShotUnit[];
  validation_notes: string[];
  markdown: string;
}

export interface AiComicSeriesSeedanceEpisodePackage {
  episode_no: number;
  episode_title: string;
  story_id: string;
  total_duration_sec: number;
  shot_count: number;
  package: SeedancePromptPackage;
}

export interface AiComicSeriesSeedanceExportPackage {
  schema_version: 'ai-comic-series-seedance-export/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  target_platform: 'seedance_2_0';
  prompt_language: 'zh';
  total_episode_count: number;
  generated_episode_count: number;
  total_shot_count: number;
  total_duration_sec: number;
  asset_reference_plan: string[];
  episodes: AiComicSeriesSeedanceEpisodePackage[];
  missing_episodes: Array<{ episode_no: number; title: string; reason: string }>;
  validation_notes: string[];
  seedance_production?: AiComicSeedanceProductionLedger;
  markdown: string;
}

export type AiComicSeedanceProductionStatus =
  | 'not_started'
  | 'prompt_exported'
  | 'submitted'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'skipped';

export interface AiComicSeedanceVideoVersion {
  version_id: string;
  status: AiComicSeedanceProductionStatus;
  created_at: string;
  provider_job_id?: string;
  video_url?: string;
  failure_reason?: string;
  note?: string;
  quality_score?: number;
  review_note?: string;
}

export type AiComicSeedanceThumbnailStatus =
  | 'not_started'
  | 'planned'
  | 'capturing'
  | 'ready'
  | 'failed'
  | 'skipped';

export interface AiComicSeedanceThumbnailCapture {
  status: AiComicSeedanceThumbnailStatus;
  output_path?: string;
  output_filename?: string;
  capture_time_sec?: number;
  version_id?: string;
  captured_at?: string;
  updated_at: string;
  failure_reason?: string;
  ffmpeg_command?: string;
}

export interface AiComicSeedanceShotProductionItem {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  source_scene_id?: number;
  status: AiComicSeedanceProductionStatus;
  prompt_exported_at?: string;
  submitted_at?: string;
  completed_at?: string;
  updated_at: string;
  provider_job_id?: string;
  video_url?: string;
  failure_reason?: string;
  retry_count: number;
  notes: string[];
  versions: AiComicSeedanceVideoVersion[];
  selected_version_id?: string;
  thumbnail?: AiComicSeedanceThumbnailCapture;
}

export interface AiComicSeedanceProductionLedger {
  schema_version: 'ai-comic-seedance-production-ledger/v1';
  updated_at?: string;
  items: AiComicSeedanceShotProductionItem[];
}

export interface AiComicSeedanceProductionStatusUpdateRequest {
  episode_no: number;
  shot_id: string;
  status: AiComicSeedanceProductionStatus;
  provider_job_id?: string;
  video_url?: string;
  failure_reason?: string;
  note?: string;
  increment_retry?: boolean;
  quality_score?: number;
  review_note?: string;
}

export interface AiComicSeedanceProductionBatchUpdateRequest {
  updates: AiComicSeedanceProductionStatusUpdateRequest[];
}

export interface AiComicSeedanceProductionCallbackRequest {
  episode_no?: number;
  episodeNo?: number;
  shot_id?: string;
  shotId?: string;
  provider_job_id?: string;
  providerJobId?: string;
  job_id?: string;
  jobId?: string;
  status?: string;
  video_url?: string;
  videoUrl?: string;
  url?: string;
  failure_reason?: string;
  failureReason?: string;
  error?: string;
  message?: string;
  note?: string;
  quality_score?: number;
  qualityScore?: number;
  review_note?: string;
  reviewNote?: string;
}

export interface AiComicSeedanceProductionVersionSelectRequest {
  episode_no: number;
  shot_id: string;
  version_id: string;
  note?: string;
}

export interface AiComicSeedanceProductionAutoSelectRequest {
  min_quality_score?: number;
  overwrite_manual?: boolean;
  note?: string;
}

export interface AiComicSeedanceCutPackageShot {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  source_scene_id?: number;
  video_url: string;
  provider_job_id?: string;
  version_id?: string;
  selected_version_id?: string;
  quality_score?: number;
  review_note?: string;
  completed_at?: string;
  order_index: number;
  notes: string[];
}

export interface AiComicSeedanceCutPackageEpisode {
  episode_no: number;
  episode_title: string;
  story_id?: string;
  ready_shot_count: number;
  shots: AiComicSeedanceCutPackageShot[];
}

export interface AiComicSeriesSeedanceCutPackage {
  schema_version: 'ai-comic-series-seedance-cut-package/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  total_ready_shot_count: number;
  total_missing_shot_count: number;
  episodes: AiComicSeedanceCutPackageEpisode[];
  missing_shots: Array<{
    episode_no: number;
    episode_title: string;
    shot_id: string;
    status: AiComicSeedanceProductionStatus;
    reason: string;
  }>;
  markdown: string;
}

export type AiComicSeedanceCutAssemblyStatus =
  | 'not_started'
  | 'planned'
  | 'assembling'
  | 'ready'
  | 'failed'
  | 'skipped';

export interface AiComicSeedanceCutAssemblyLedger {
  schema_version: 'ai-comic-seedance-cut-assembly-ledger/v1';
  updated_at?: string;
  status: AiComicSeedanceCutAssemblyStatus;
  output_path?: string;
  output_filename?: string;
  concat_list_path?: string;
  ffmpeg_command?: string;
  assembly_mode?: AiComicSeedanceCutAssemblyMode;
  output_profile?: string;
  assembled_at?: string;
  failure_reason?: string;
  dry_run?: boolean;
  source_episode_no?: number;
  source_shot_count: number;
  missing_shot_count: number;
}

export type AiComicSeedanceCutAssemblyMode = 'copy' | 'transcode';

export interface AiComicSeedanceCutAssemblyRequest {
  dry_run?: boolean;
  overwrite?: boolean;
  episode_no?: number;
  output_filename?: string;
  assembly_mode?: AiComicSeedanceCutAssemblyMode;
  output_profile?: 'source_copy' | 'mp4_h264_1080p' | 'mp4_h264_720p';
  fps?: number;
  crf?: number;
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
}

export interface AiComicSeriesSeedanceCutAssemblyResult {
  schema_version: 'ai-comic-series-seedance-cut-assembly-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  executed_at: string;
  dry_run: boolean;
  status: 'planned' | 'assembled' | 'failed' | 'skipped';
  output_path: string;
  output_filename: string;
  concat_list_path: string;
  ffmpeg_command: string;
  assembly_mode: AiComicSeedanceCutAssemblyMode;
  output_profile: string;
  source_episode_no?: number;
  source_shot_count: number;
  missing_shot_count: number;
  failure_reason?: string;
  seedance_cut_assembly: AiComicSeedanceCutAssemblyLedger;
}

export type AiComicSeedanceSubtitleRenderMode = 'sidecar' | 'burn_in';
export type AiComicSeedanceSubtitleRenderStatus =
  | 'not_started'
  | 'planned'
  | 'rendering'
  | 'ready'
  | 'failed'
  | 'skipped';

export interface AiComicSeedanceSubtitleExportRequest {
  episode_no?: number;
  output_filename?: string;
}

export interface AiComicSeriesSeedanceSubtitlePackage {
  schema_version: 'ai-comic-series-seedance-subtitle-package/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  subtitle_root: string;
  episode_no?: number;
  subtitle_format: 'srt';
  srt_filename: string;
  srt_path: string;
  cue_count: number;
  total_duration_sec: number;
  cues: Array<AiComicSeedanceFinishingSubtitleCue & {
    srt_index: number;
    start_timecode: string;
    end_timecode: string;
  }>;
  srt_content: string;
  missing_shots: AiComicSeriesSeedanceCutPackage['missing_shots'];
  markdown: string;
}

export interface AiComicSeedanceSubtitleRenderRequest {
  dry_run?: boolean;
  overwrite?: boolean;
  mode?: AiComicSeedanceSubtitleRenderMode;
  episode_no?: number;
  output_filename?: string;
  input_video_path?: string;
}

export interface AiComicSeedanceSubtitleRenderLedger {
  schema_version: 'ai-comic-seedance-subtitle-render-ledger/v1';
  updated_at?: string;
  status: AiComicSeedanceSubtitleRenderStatus;
  mode: AiComicSeedanceSubtitleRenderMode;
  episode_no?: number;
  srt_path?: string;
  srt_filename?: string;
  output_path?: string;
  output_filename?: string;
  ffmpeg_command?: string;
  rendered_at?: string;
  failure_reason?: string;
  dry_run?: boolean;
  cue_count: number;
  source_cut_output_path?: string;
}

export interface AiComicSeriesSeedanceSubtitleRenderResult {
  schema_version: 'ai-comic-series-seedance-subtitle-render-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  executed_at: string;
  dry_run: boolean;
  mode: AiComicSeedanceSubtitleRenderMode;
  status: 'planned' | 'rendered' | 'failed' | 'skipped';
  srt_path: string;
  srt_filename: string;
  output_path?: string;
  output_filename?: string;
  ffmpeg_command?: string;
  cue_count: number;
  failure_reason?: string;
  seedance_subtitle_render: AiComicSeedanceSubtitleRenderLedger;
}

export interface AiComicSeedanceAudioLibraryItem {
  asset_id: string;
  kind: AiComicSeedanceFinishingTrackKind;
  label: string;
  file_url?: string;
  file_id?: string;
  duration_sec?: number;
  license_note?: string;
  loopable?: boolean;
  bpm?: number;
  mood_tags: string[];
  updated_at: string;
}

export interface AiComicSeedanceAudioLibrary {
  schema_version: 'ai-comic-seedance-audio-library/v1';
  updated_at?: string;
  items: AiComicSeedanceAudioLibraryItem[];
}

export interface AiComicSeedanceAudioLibraryUpdateRequest {
  items: Array<{
    asset_id?: string;
    kind: AiComicSeedanceFinishingTrackKind;
    label: string;
    file_url?: string;
    file_id?: string;
    duration_sec?: number;
    license_note?: string;
    loopable?: boolean;
    bpm?: number;
    mood_tags?: string[];
  }>;
}

export type AiComicSeedanceAudioAssetStatus = 'bound' | 'missing_asset' | 'optional_missing';

export interface AiComicSeedanceAudioPlanCue extends AiComicSeedanceFinishingAudioCue {
  asset_id: string;
  asset_label: string;
  asset_status: AiComicSeedanceAudioAssetStatus;
  file_url?: string;
  file_id?: string;
  asset_duration_sec?: number;
  loopable?: boolean;
  volume_db: number;
  ducking: boolean;
  fade_in_sec: number;
  fade_out_sec: number;
  mix_track: AiComicSeedanceFinishingTrackKind;
  generated_prompt: string;
  needs_manual_review: boolean;
}

export interface AiComicSeriesSeedanceAudioPlanPackage {
  schema_version: 'ai-comic-series-seedance-audio-plan/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  source_cut_output_path?: string;
  audio_root: string;
  total_duration_sec: number;
  total_audio_cue_count: number;
  bound_cue_count: number;
  missing_audio_count: number;
  audio_cues: AiComicSeedanceAudioPlanCue[];
  missing_audio: Array<{
    cue_id: string;
    episode_no: number;
    shot_id?: string;
    kind: AiComicSeedanceFinishingTrackKind;
    asset_id: string;
    asset_label: string;
    priority: AiComicSeedanceFinishingAudioCue['priority'];
    reason: string;
  }>;
  suggested_assets: Array<{
    asset_id: string;
    kind: AiComicSeedanceFinishingTrackKind;
    label: string;
    cue_count: number;
    prompt: string;
  }>;
  markdown: string;
}

export type AiComicSeedanceAudioMixStatus =
  | 'not_started'
  | 'planned'
  | 'mixing'
  | 'ready'
  | 'failed'
  | 'skipped';

export type AiComicSeedanceAudioMixProfile = 'balanced_dialogue' | 'music_forward' | 'ambient_soft';

export interface AiComicSeedanceAudioMixRequest {
  dry_run?: boolean;
  overwrite?: boolean;
  episode_no?: number;
  input_video_path?: string;
  output_filename?: string;
  audio_profile?: AiComicSeedanceAudioMixProfile;
  include_original_audio?: boolean;
  original_audio_volume_db?: number;
}

export interface AiComicSeedanceAudioMixLedger {
  schema_version: 'ai-comic-seedance-audio-mix-ledger/v1';
  updated_at?: string;
  status: AiComicSeedanceAudioMixStatus;
  episode_no?: number;
  output_path?: string;
  output_filename?: string;
  input_video_path?: string;
  ffmpeg_command?: string;
  mixed_at?: string;
  failure_reason?: string;
  dry_run?: boolean;
  audio_profile: AiComicSeedanceAudioMixProfile;
  include_original_audio?: boolean;
  original_audio_volume_db?: number;
  source_audio_count: number;
  missing_audio_count: number;
}

export interface AiComicSeriesSeedanceAudioMixResult {
  schema_version: 'ai-comic-series-seedance-audio-mix-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  executed_at: string;
  dry_run: boolean;
  status: 'planned' | 'mixed' | 'failed' | 'skipped';
  episode_no?: number;
  output_path: string;
  output_filename: string;
  input_video_path?: string;
  ffmpeg_command: string;
  audio_profile: AiComicSeedanceAudioMixProfile;
  include_original_audio: boolean;
  original_audio_volume_db: number;
  source_audio_count: number;
  missing_audio_count: number;
  failure_reason?: string;
  seedance_audio_mix: AiComicSeedanceAudioMixLedger;
}

export type AiComicSeedanceTitleCardPlacement =
  | 'series_opening'
  | 'episode_opening'
  | 'episode_ending'
  | 'series_ending';

export interface AiComicSeedanceTitleCardPlanCard {
  card_id: string;
  placement: AiComicSeedanceTitleCardPlacement;
  episode_no?: number;
  duration_sec: number;
  text: string;
  visual_note: string;
  safe_area: string;
  font_style: string;
  background_source: string;
  transition_in: string;
  transition_out: string;
  output_filename: string;
  output_path: string;
  ffmpeg_command_hint: string;
}

export interface AiComicSeriesSeedanceTitleCardPlanPackage {
  schema_version: 'ai-comic-series-seedance-title-card-plan/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  title_card_root: string;
  total_card_count: number;
  total_duration_sec: number;
  cards: AiComicSeedanceTitleCardPlanCard[];
  markdown: string;
}

export type AiComicSeedanceTitleCardRenderStatus =
  | 'not_started'
  | 'planned'
  | 'rendering'
  | 'ready'
  | 'failed'
  | 'skipped';

export type AiComicSeedanceTitleCardOutputProfile = 'mp4_h264_1080p' | 'mp4_h264_720p';

export interface AiComicSeedanceTitleCardRenderRequest {
  dry_run?: boolean;
  overwrite?: boolean;
  episode_no?: number;
  output_profile?: AiComicSeedanceTitleCardOutputProfile;
  font_path?: string;
}

export interface AiComicSeedanceTitleCardRenderLedger {
  schema_version: 'ai-comic-seedance-title-card-render-ledger/v1';
  updated_at?: string;
  status: AiComicSeedanceTitleCardRenderStatus;
  output_profile: AiComicSeedanceTitleCardOutputProfile;
  card_count: number;
  rendered_count: number;
  output_paths: string[];
  ffmpeg_commands: string[];
  rendered_at?: string;
  failure_reason?: string;
  dry_run?: boolean;
  font_path?: string;
}

export interface AiComicSeriesSeedanceTitleCardRenderResult {
  schema_version: 'ai-comic-series-seedance-title-card-render-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  executed_at: string;
  dry_run: boolean;
  status: 'planned' | 'rendered' | 'failed' | 'skipped';
  output_profile: AiComicSeedanceTitleCardOutputProfile;
  card_count: number;
  rendered_count: number;
  output_paths: string[];
  ffmpeg_commands: string[];
  failure_reason?: string;
  seedance_title_card_render: AiComicSeedanceTitleCardRenderLedger;
}

export type AiComicSeedanceFinalDeliveryStatus =
  | 'not_started'
  | 'planned'
  | 'assembling'
  | 'ready'
  | 'failed'
  | 'skipped';

export type AiComicSeedanceFinalDeliveryOutputProfile = 'mp4_h264_1080p' | 'mp4_h264_720p' | 'source_copy';
export type AiComicSeedanceMissingDependencyMode = 'strict' | 'tolerant';

export interface AiComicSeedanceFinalDeliveryRequest {
  dry_run?: boolean;
  overwrite?: boolean;
  include_subtitles?: boolean;
  include_audio_mix?: boolean;
  include_title_cards?: boolean;
  missing_dependency_mode?: AiComicSeedanceMissingDependencyMode;
  allow_open_final_reviews?: boolean;
  resolve_reassemble_reviews?: boolean;
  resolved_note?: string;
  output_profile?: AiComicSeedanceFinalDeliveryOutputProfile;
  output_filename?: string;
}

export interface AiComicSeedanceFinalDependencyStatus {
  cut_ready: boolean;
  subtitle_ready: boolean;
  audio_mix_ready: boolean;
  title_cards_ready: boolean;
  source_cut_path?: string;
  subtitle_path?: string;
  audio_mix_path?: string;
  title_card_paths: string[];
  missing_dependencies: string[];
  warnings: string[];
}

export type AiComicSeedanceFinalDeliveryExecutionStatus = 'planned' | 'assembled' | 'failed' | 'skipped';
export type AiComicSeedanceFinalDeliveryManifestInputType =
  | 'source_cut'
  | 'subtitle'
  | 'audio_mix'
  | 'title_card'
  | 'concat_list';
export type AiComicSeedanceFinalDeliveryManifestDeliverableType =
  | 'final_video'
  | 'manifest'
  | 'concat_list';
export type AiComicSeedanceFinalDeliveryManifestDeliverableStatus =
  | 'planned'
  | 'ready'
  | 'failed'
  | 'skipped';

export interface AiComicSeedanceFinalDeliveryManifestInput {
  input_id: string;
  input_type: AiComicSeedanceFinalDeliveryManifestInputType;
  path: string;
  ready: boolean;
  role: string;
  notes: string[];
}

export interface AiComicSeedanceFinalDeliveryManifestDeliverable {
  deliverable_id: string;
  deliverable_type: AiComicSeedanceFinalDeliveryManifestDeliverableType;
  path: string;
  status: AiComicSeedanceFinalDeliveryManifestDeliverableStatus;
  notes: string[];
}

export interface AiComicSeedanceFinalDeliveryManifest {
  schema_version: 'ai-comic-seedance-final-delivery-manifest/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  generated_at: string;
  dry_run: boolean;
  status: AiComicSeedanceFinalDeliveryExecutionStatus;
  output_profile: AiComicSeedanceFinalDeliveryOutputProfile;
  output_path: string;
  output_filename: string;
  manifest_path: string;
  concat_list_path?: string;
  ffmpeg_command: string;
  dependency_status: AiComicSeedanceFinalDependencyStatus;
  inputs: AiComicSeedanceFinalDeliveryManifestInput[];
  deliverables: AiComicSeedanceFinalDeliveryManifestDeliverable[];
  validation_notes: string[];
}

export interface AiComicSeedanceFinalDeliveryLedger {
  schema_version: 'ai-comic-seedance-final-delivery-ledger/v1';
  updated_at?: string;
  status: AiComicSeedanceFinalDeliveryStatus;
  output_path?: string;
  output_filename?: string;
  manifest_path?: string;
  ffmpeg_command?: string;
  source_cut_path?: string;
  subtitle_path?: string;
  audio_mix_path?: string;
  title_card_paths: string[];
  delivered_at?: string;
  failure_reason?: string;
  dry_run?: boolean;
  output_profile: AiComicSeedanceFinalDeliveryOutputProfile;
  dependency_status: AiComicSeedanceFinalDependencyStatus;
}

export interface AiComicSeriesSeedanceFinalDeliveryResult {
  schema_version: 'ai-comic-series-seedance-final-delivery-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  executed_at: string;
  dry_run: boolean;
  status: AiComicSeedanceFinalDeliveryExecutionStatus;
  output_path: string;
  output_filename: string;
  manifest_path: string;
  ffmpeg_command: string;
  output_profile: AiComicSeedanceFinalDeliveryOutputProfile;
  dependency_status: AiComicSeedanceFinalDependencyStatus;
  failure_reason?: string;
  seedance_final_delivery: AiComicSeedanceFinalDeliveryLedger;
  manifest: AiComicSeedanceFinalDeliveryManifest;
  markdown: string;
}

export type AiComicSeedanceReviewTargetType =
  | 'shot'
  | 'cut'
  | 'final'
  | 'subtitle'
  | 'audio'
  | 'title_card';
export type AiComicSeedanceReviewStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix';
export type AiComicSeedanceReviewSeverity = 'blocking' | 'major' | 'minor' | 'note';
export type AiComicSeedanceReviewIssueType =
  | 'visual'
  | 'continuity'
  | 'subtitle'
  | 'audio'
  | 'pacing'
  | 'title_card'
  | 'technical'
  | 'compliance'
  | 'other';
export type AiComicSeedanceReviewRepairAction =
  | 'redo_shot'
  | 'reselect_version'
  | 'revise_subtitle'
  | 'adjust_audio'
  | 'revise_title_card'
  | 'reassemble_final'
  | 'manual_review';

export interface AiComicSeedanceReviewItem {
  review_id: string;
  target_type: AiComicSeedanceReviewTargetType;
  target_id?: string;
  episode_no?: number;
  shot_id?: string;
  status: AiComicSeedanceReviewStatus;
  severity: AiComicSeedanceReviewSeverity;
  issue_type: AiComicSeedanceReviewIssueType;
  note: string;
  repair_action: AiComicSeedanceReviewRepairAction;
  created_at: string;
  created_by?: string;
  resolved_at?: string;
  resolved_note?: string;
}

export interface AiComicSeedanceReviewLedger {
  schema_version: 'ai-comic-seedance-review-ledger/v1';
  updated_at?: string;
  open_count: number;
  resolved_count: number;
  blocking_count: number;
  final_reassemble_required: boolean;
  items: AiComicSeedanceReviewItem[];
}

export interface AiComicSeedanceReviewAddRequest {
  target_type: AiComicSeedanceReviewTargetType;
  target_id?: string;
  episode_no?: number;
  shot_id?: string;
  severity: AiComicSeedanceReviewSeverity;
  issue_type: AiComicSeedanceReviewIssueType;
  note: string;
  repair_action?: AiComicSeedanceReviewRepairAction;
  created_by?: string;
}

export interface AiComicSeedanceReviewResolveRequest {
  review_id: string;
  status?: Extract<AiComicSeedanceReviewStatus, 'resolved' | 'wont_fix'>;
  resolved_note?: string;
}

export interface AiComicSeriesSeedanceReviewUpdateResult {
  schema_version: 'ai-comic-series-seedance-review-update-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  updated_at: string;
  review_item: AiComicSeedanceReviewItem;
  seedance_review_ledger: AiComicSeedanceReviewLedger;
}

export interface AiComicSeriesSeedanceReviewRepairPackageItem {
  review_id: string;
  target_type: AiComicSeedanceReviewTargetType;
  target_id?: string;
  episode_no?: number;
  shot_id?: string;
  severity: AiComicSeedanceReviewSeverity;
  issue_type: AiComicSeedanceReviewIssueType;
  note: string;
  repair_action: AiComicSeedanceReviewRepairAction;
  suggested_next_step: string;
}

export interface AiComicSeriesSeedanceReviewRepairPackage {
  schema_version: 'ai-comic-series-seedance-review-repair-package/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  open_count: number;
  blocking_count: number;
  retry_candidate_count: number;
  final_reassemble_required: boolean;
  items: AiComicSeriesSeedanceReviewRepairPackageItem[];
  markdown: string;
}

export type AiComicSeedanceEditingPlatformFormat =
  | 'generic_json'
  | 'csv_timeline'
  | 'srt'
  | 'asset_manifest';

export type AiComicSeedanceEditingPlatformTimelineItemType = 'video_shot' | 'title_card';
export type AiComicSeedanceEditingPlatformTrack = 'video' | 'title';

export interface AiComicSeedanceEditingPlatformTimelineItem {
  item_id: string;
  item_type: AiComicSeedanceEditingPlatformTimelineItemType;
  track: AiComicSeedanceEditingPlatformTrack;
  episode_no?: number;
  source_id: string;
  source_path: string;
  label: string;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  source_start_sec?: number;
  source_end_sec?: number;
  transition_in?: string;
  transition_out?: string;
  notes: string[];
}

export type AiComicSeedanceEditingPlatformAssetType =
  | 'video'
  | 'audio'
  | 'subtitle'
  | 'title_card'
  | 'thumbnail'
  | 'final_delivery';

export type AiComicSeedanceEditingPlatformAssetStatus =
  | 'ready'
  | 'planned'
  | 'missing'
  | 'optional_missing'
  | 'unknown';

export interface AiComicSeedanceEditingPlatformAsset {
  asset_id: string;
  asset_type: AiComicSeedanceEditingPlatformAssetType;
  label: string;
  path_or_url?: string;
  episode_no?: number;
  shot_id?: string;
  status: AiComicSeedanceEditingPlatformAssetStatus;
  source: string;
  missing: boolean;
  notes: string[];
}

export interface AiComicSeedanceEditingPlatformSubtitleCue {
  cue_id: string;
  episode_no: number;
  shot_id?: string;
  start_sec: number;
  end_sec: number;
  start_timecode: string;
  end_timecode: string;
  text: string;
  source: AiComicSeedanceFinishingSubtitleCue['source'];
}

export interface AiComicSeedanceEditingPlatformMissingAsset {
  asset_id: string;
  asset_type: AiComicSeedanceEditingPlatformAssetType;
  label: string;
  episode_no?: number;
  shot_id?: string;
  reason: string;
  source: string;
}

export interface AiComicSeriesSeedanceEditingPlatformPackage {
  schema_version: 'ai-comic-series-editing-platform-package/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  formats: AiComicSeedanceEditingPlatformFormat[];
  source_cut_output_path?: string;
  final_delivery_output_path?: string;
  timeline_total_duration_sec: number;
  timeline: AiComicSeedanceEditingPlatformTimelineItem[];
  assets: AiComicSeedanceEditingPlatformAsset[];
  subtitle_cues: AiComicSeedanceEditingPlatformSubtitleCue[];
  missing_assets: AiComicSeedanceEditingPlatformMissingAsset[];
  import_notes: string[];
  csv_timeline: string;
  asset_manifest_csv: string;
  srt_content: string;
  markdown: string;
}

export type AiComicSeedanceDashboardStatusKey =
  | 'prompt_export'
  | 'shot_production'
  | 'thumbnail_capture'
  | 'cut_assembly'
  | 'subtitle_render'
  | 'audio_mix'
  | 'title_card_render'
  | 'final_delivery'
  | 'review_ledger'
  | 'editing_platform_package';

export type AiComicSeedanceDashboardItemStatus =
  | 'not_started'
  | 'needs_action'
  | 'in_progress'
  | 'planned'
  | 'ready'
  | 'failed'
  | 'skipped'
  | 'blocked';

export type AiComicSeedanceDashboardBlockerSeverity = 'blocking' | 'warning' | 'info';

export interface AiComicSeedanceDashboardSummary {
  generated_episode_count: number;
  total_episode_count: number;
  total_shot_count: number;
  prompt_exported_count: number;
  submitted_count: number;
  processing_count: number;
  ready_count: number;
  failed_count: number;
  skipped_count: number;
  selected_version_count: number;
  ready_version_count: number;
  thumbnail_ready_count: number;
  thumbnail_failed_count: number;
  missing_shot_count: number;
  open_review_count: number;
  blocking_review_count: number;
  final_reassemble_required: boolean;
  blocker_count: number;
  next_action_count: number;
  production_status_counts: Record<AiComicSeedanceProductionStatus, number>;
}

export interface AiComicSeedanceDashboardStatusItem {
  key: AiComicSeedanceDashboardStatusKey;
  label: string;
  status: AiComicSeedanceDashboardItemStatus;
  status_text: string;
  updated_at?: string;
  output_path?: string;
  count_text?: string;
  notes: string[];
}

export interface AiComicSeedanceDashboardBlocker {
  blocker_id: string;
  severity: AiComicSeedanceDashboardBlockerSeverity;
  label: string;
  detail: string;
  related_status_key?: AiComicSeedanceDashboardStatusKey;
  action_key?: string;
  action_label?: string;
}

export interface AiComicSeedanceDashboardNextAction {
  action_key: string;
  label: string;
  detail: string;
  priority: number;
  related_status_key?: AiComicSeedanceDashboardStatusKey;
  disabled_reason?: string;
}

export interface AiComicSeedanceDashboardEpisode {
  episode_no: number;
  episode_title: string;
  story_id?: string;
  total_shot_count: number;
  ready_shot_count: number;
  failed_shot_count: number;
  selected_version_count: number;
  thumbnail_ready_count: number;
  blocker_count: number;
}

export interface AiComicSeriesSeedanceDashboard {
  schema_version: 'ai-comic-series-seedance-dashboard/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  generated_at: string;
  summary: AiComicSeedanceDashboardSummary;
  status_items: AiComicSeedanceDashboardStatusItem[];
  blockers: AiComicSeedanceDashboardBlocker[];
  next_actions: AiComicSeedanceDashboardNextAction[];
  episodes: AiComicSeedanceDashboardEpisode[];
  markdown: string;
}

export type AiComicSeedanceRetryReason = 'production_status' | 'review_required';
export type AiComicSeedanceRetryExecutionPriority = 'high' | 'normal' | 'low';

export interface AiComicSeedanceRetryReviewIssue {
  review_id: string;
  severity: AiComicSeedanceReviewSeverity;
  issue_type: AiComicSeedanceReviewIssueType;
  note: string;
  repair_action: AiComicSeedanceReviewRepairAction;
}

export interface AiComicSeedanceRetryPackageShot {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  source_scene_id?: number;
  status: AiComicSeedanceProductionStatus;
  retry_count: number;
  failure_reason?: string;
  provider_job_id?: string;
  last_video_url?: string;
  retry_reason: AiComicSeedanceRetryReason;
  review_issues?: AiComicSeedanceRetryReviewIssue[];
  suggested_action: string;
  prompt: SeedancePromptShotUnit;
}

export interface AiComicSeedanceRetryPackageEpisode {
  episode_no: number;
  episode_title: string;
  story_id?: string;
  retry_shot_count: number;
  shots: AiComicSeedanceRetryPackageShot[];
}

export interface AiComicSeriesSeedanceRetryPackage {
  schema_version: 'ai-comic-series-seedance-retry-package/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  total_retry_shot_count: number;
  review_required_shot_count: number;
  episodes: AiComicSeedanceRetryPackageEpisode[];
  skipped_ready_shot_count: number;
  missing_prompt_shots: Array<{
    episode_no: number;
    episode_title: string;
    shot_id: string;
    reason: string;
  }>;
  markdown: string;
}

export interface AiComicSeedanceRetryExecutionCandidate {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  source_scene_id?: number;
  status: AiComicSeedanceProductionStatus;
  retry_count: number;
  retry_reason: AiComicSeedanceRetryReason;
  priority: AiComicSeedanceRetryExecutionPriority;
  can_submit: boolean;
  block_reason?: string;
  suggested_action: string;
  failure_reason?: string;
  provider_job_id?: string;
  last_video_url?: string;
  review_issues?: AiComicSeedanceRetryReviewIssue[];
  prompt: SeedancePromptShotUnit;
}

export interface AiComicSeedanceRetryExecutionEpisode {
  episode_no: number;
  episode_title: string;
  story_id?: string;
  candidate_count: number;
  ready_to_submit_count: number;
  blocked_count: number;
  candidates: AiComicSeedanceRetryExecutionCandidate[];
}

export interface AiComicSeriesSeedanceRetryExecutionPlan {
  schema_version: 'ai-comic-series-seedance-retry-execution-plan/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  source_retry_package_exported_at: string;
  total_retry_shot_count: number;
  ready_to_submit_count: number;
  blocked_count: number;
  high_priority_count: number;
  review_required_shot_count: number;
  missing_prompt_shot_count: number;
  reason_counts: Record<AiComicSeedanceRetryReason, number>;
  episodes: AiComicSeedanceRetryExecutionEpisode[];
  missing_prompt_shots: AiComicSeriesSeedanceRetryPackage['missing_prompt_shots'];
  markdown: string;
}

export interface AiComicSeedanceRetrySubmitRequest {
  limit?: number;
  job_prefix?: string;
  use_provider_adapter?: boolean;
  note?: string;
}

export interface AiComicSeedanceRetrySubmitShot {
  production_id: string;
  episode_no: number;
  shot_id: string;
  provider_job_id: string;
  provider_queue_id?: string;
  provider_queue_position?: number;
  status?: Extract<AiComicSeedanceProductionStatus, 'submitted' | 'processing'>;
  retry_count: number;
  retry_reason: AiComicSeedanceRetryReason;
}

export interface AiComicSeriesSeedanceRetrySubmitResult {
  schema_version: 'ai-comic-series-seedance-retry-submit-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  submitted_at: string;
  retry_execution_plan: AiComicSeriesSeedanceRetryExecutionPlan;
  selected_shot_ids: string[];
  submitted_count: number;
  skipped_blocked_count: number;
  skipped_due_to_limit_count: number;
  failed_count?: number;
  provider_adapter?: SeedanceShotProviderSubmitAdapterSummary;
  provider_failures?: SeedanceShotProviderSubmitFailure[];
  submitted_shots: AiComicSeedanceRetrySubmitShot[];
  seedance_production?: AiComicSeedanceProductionLedger;
  markdown: string;
}

export interface AiComicSeriesGearsJobSubmitResult {
  schema_version: 'ai-comic-series-gears-job-submit-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  job_type: GearsExecutionJobType;
  job_type_label: string;
  submit_intent: string;
  submitted_at: string;
  gears_job_ledger?: GearsJobLedger;
  seedance_production?: AiComicSeedanceProductionLedger;
  provider_adapter?: GearsJobSubmitAdapterSummary;
  submitted_count: number;
  skipped_count: number;
  failed_count: number;
  submitted_jobs: GearsJobLedgerItem[];
  failures: GearsJobSubmitFailure[];
  markdown: string;
}

export interface AiComicSeriesGearsJobStatusSyncResult {
  schema_version: 'ai-comic-series-gears-job-sync-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  gears_job_ledger?: GearsJobLedger;
  seedance_production?: AiComicSeedanceProductionLedger;
  seedance_subtitle_render?: AiComicSeedanceSubtitleRenderLedger;
  seedance_audio_mix?: AiComicSeedanceAudioMixLedger;
  seedance_title_card_render?: AiComicSeedanceTitleCardRenderLedger;
  seedance_final_delivery?: AiComicSeedanceFinalDeliveryLedger;
  provider_adapter?: GearsJobStatusSyncAdapterSummary;
  pollable_count: number;
  synced_count: number;
  failed_count: number;
  duplicate_count: number;
  skipped_count: number;
  synced_jobs: GearsJobLedgerItem[];
  failures: GearsJobSubmitFailure[];
  markdown: string;
}

export interface AiComicSeriesGearsJobCallbackResult {
  schema_version: 'ai-comic-series-gears-job-callback-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  gears_job_ledger?: GearsJobLedger;
  seedance_production?: AiComicSeedanceProductionLedger;
  seedance_subtitle_render?: AiComicSeedanceSubtitleRenderLedger;
  seedance_audio_mix?: AiComicSeedanceAudioMixLedger;
  seedance_title_card_render?: AiComicSeedanceTitleCardRenderLedger;
  seedance_final_delivery?: AiComicSeedanceFinalDeliveryLedger;
  received_count: number;
  updated_count: number;
  failed_count: number;
  duplicate_count: number;
  failures: GearsJobSubmitFailure[];
  gears_job_id?: string;
  source_unit_id?: string;
  status?: GearsExecutionJobStatus;
}

export type AiComicSeedanceRecoverableProductionStatus = Extract<
  AiComicSeedanceProductionStatus,
  'submitted' | 'processing'
>;

export interface AiComicSeedanceProviderRecoveryRequest {
  timeout_minutes?: number;
  statuses?: AiComicSeedanceRecoverableProductionStatus[];
  mark_timed_out_failed?: boolean;
  failure_reason?: string;
}

export interface AiComicSeedanceProviderRecoveryItem {
  production_id: string;
  episode_no: number;
  episode_title: string;
  shot_id: string;
  status: AiComicSeedanceRecoverableProductionStatus;
  provider_job_id?: string;
  submitted_at?: string;
  updated_at: string;
  minutes_waiting: number;
  retry_count: number;
}

export interface AiComicSeriesSeedanceProviderRecoveryResult {
  schema_version: 'ai-comic-series-seedance-provider-recovery-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  checked_at: string;
  timeout_minutes: number;
  statuses: AiComicSeedanceRecoverableProductionStatus[];
  mark_timed_out_failed: boolean;
  timed_out_count: number;
  updated_count: number;
  timed_out_shots: AiComicSeedanceProviderRecoveryItem[];
  seedance_production?: AiComicSeedanceProductionLedger;
  markdown: string;
}

export interface AiComicSeedanceVersionComparisonRow {
  version_id: string;
  status: AiComicSeedanceProductionStatus;
  created_at: string;
  provider_job_id?: string;
  video_url?: string;
  failure_reason?: string;
  note?: string;
  quality_score?: number;
  review_note?: string;
  rank: number;
  is_selected: boolean;
  is_auto_best: boolean;
  decision_reason: string;
}

export interface AiComicSeedanceVersionComparisonShot {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  source_scene_id?: number;
  selected_version_id?: string;
  auto_best_version_id?: string;
  ready_version_count: number;
  failed_version_count: number;
  versions: AiComicSeedanceVersionComparisonRow[];
}

export interface AiComicSeriesSeedanceVersionComparisonPackage {
  schema_version: 'ai-comic-series-seedance-version-comparison/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  total_shot_count: number;
  comparable_shot_count: number;
  selected_shot_count: number;
  unselected_shot_count: number;
  shots: AiComicSeedanceVersionComparisonShot[];
  markdown: string;
}

export type AiComicSeedanceAssetReferenceKind = 'character' | 'location' | 'unknown';

export interface AiComicSeedanceAssetReferenceItem {
  asset_id: string;
  kind: AiComicSeedanceAssetReferenceKind;
  label: string;
  reference_slot?: string;
  file_url?: string;
  file_id?: string;
  description?: string;
  source_episode_nos: number[];
  source_shot_ids: string[];
  required_by_shot_count: number;
  has_reference_slot: boolean;
  is_bound: boolean;
  needs_upload: boolean;
  status: 'bound' | 'missing_file' | 'missing_reference_slot';
}

export interface AiComicSeedanceAssetLibraryItem {
  asset_id: string;
  kind: AiComicSeedanceAssetReferenceKind;
  label: string;
  reference_slot?: string;
  file_url?: string;
  file_id?: string;
  description?: string;
  updated_at: string;
}

export interface AiComicSeedanceAssetLibrary {
  schema_version: 'ai-comic-seedance-asset-library/v1';
  updated_at?: string;
  items: AiComicSeedanceAssetLibraryItem[];
}

export interface AiComicSeedanceAssetLibraryUpdateRequest {
  items: Array<{
    asset_id?: string;
    kind: AiComicSeedanceAssetReferenceKind;
    label: string;
    reference_slot?: string;
    file_url?: string;
    file_id?: string;
    description?: string;
  }>;
}

export interface AiComicSeedanceShotAssetBinding {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  source_scene_id?: number;
  characters: string[];
  location: string;
  required_asset_ids: string[];
  missing_reference_asset_ids: string[];
  reference_slots: string[];
  prompt_preview: string;
}

export interface AiComicSeriesSeedanceAssetReportPackage {
  schema_version: 'ai-comic-series-seedance-asset-report/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  total_asset_count: number;
  missing_reference_slot_count: number;
  upload_required_count: number;
  shot_binding_count: number;
  unbound_shot_count: number;
  assets: AiComicSeedanceAssetReferenceItem[];
  shots: AiComicSeedanceShotAssetBinding[];
  markdown: string;
}

export interface AiComicSeedanceEditAssetPackageShot {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  source_scene_id?: number;
  order_index: number;
  video_url: string;
  provider_job_id?: string;
  version_id?: string;
  selected_version_id?: string;
  quality_score?: number;
  review_note?: string;
  reference_slots: string[];
  assets: AiComicSeedanceAssetReferenceItem[];
  missing_asset_ids: string[];
  prompt_preview?: string;
}

export interface AiComicSeedanceEditAssetPackageEpisode {
  episode_no: number;
  episode_title: string;
  story_id?: string;
  ready_shot_count: number;
  unbound_shot_count: number;
  shots: AiComicSeedanceEditAssetPackageShot[];
}

export interface AiComicSeriesSeedanceEditAssetPackage {
  schema_version: 'ai-comic-series-seedance-edit-asset-package/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  total_ready_shot_count: number;
  total_bound_asset_count: number;
  total_missing_asset_count: number;
  unbound_shot_count: number;
  episodes: AiComicSeedanceEditAssetPackageEpisode[];
  assets: AiComicSeedanceAssetReferenceItem[];
  missing_shots: AiComicSeriesSeedanceCutPackage['missing_shots'];
  markdown: string;
}

export interface AiComicSeedanceThumbnailPlanShot {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  source_scene_id?: number;
  order_index: number;
  video_url: string;
  version_id?: string;
  selected_version_id?: string;
  capture_time_sec: number;
  output_filename: string;
  output_path: string;
  ffmpeg_command: string;
  status: 'pending_capture' | 'missing_video';
}

export interface AiComicSeedanceThumbnailPlanEpisode {
  episode_no: number;
  episode_title: string;
  story_id?: string;
  ready_shot_count: number;
  shots: AiComicSeedanceThumbnailPlanShot[];
}

export interface AiComicSeriesSeedanceThumbnailPlanPackage {
  schema_version: 'ai-comic-series-seedance-thumbnail-plan/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  thumbnail_root: string;
  total_ready_shot_count: number;
  total_missing_shot_count: number;
  episodes: AiComicSeedanceThumbnailPlanEpisode[];
  missing_shots: AiComicSeriesSeedanceCutPackage['missing_shots'];
  markdown: string;
}

export interface AiComicSeedanceThumbnailCaptureRequest {
  dry_run?: boolean;
  overwrite?: boolean;
  episode_no?: number;
  shot_id?: string;
  limit?: number;
}

export interface AiComicSeedanceThumbnailCaptureResultShot {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  video_url: string;
  version_id?: string;
  selected_version_id?: string;
  capture_time_sec: number;
  output_filename: string;
  output_path: string;
  ffmpeg_command: string;
  status: 'planned' | 'captured' | 'failed' | 'skipped';
  failure_reason?: string;
  skipped_reason?: string;
}

export interface AiComicSeriesSeedanceThumbnailCaptureResult {
  schema_version: 'ai-comic-series-seedance-thumbnail-capture-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  executed_at: string;
  dry_run: boolean;
  thumbnail_root: string;
  total_plan_shot_count: number;
  captured_count: number;
  planned_count: number;
  failed_count: number;
  skipped_count: number;
  shots: AiComicSeedanceThumbnailCaptureResultShot[];
  seedance_production: AiComicSeedanceProductionLedger;
}

export type AiComicSeedanceFinishingTrackKind =
  | 'dialogue'
  | 'narration'
  | 'music'
  | 'sound_effect'
  | 'ambient';

export interface AiComicSeedanceFinishingSubtitleCue {
  cue_id: string;
  episode_no: number;
  shot_id: string;
  start_sec: number;
  end_sec: number;
  text: string;
  source: 'script_text' | 'continuity' | 'manual_placeholder';
}

export interface AiComicSeedanceFinishingAudioCue {
  cue_id: string;
  episode_no: number;
  shot_id?: string;
  start_sec: number;
  end_sec: number;
  kind: AiComicSeedanceFinishingTrackKind;
  text: string;
  priority: 'must' | 'should' | 'optional';
}

export interface AiComicSeedanceFinishingShot {
  production_id: string;
  episode_no: number;
  episode_title: string;
  story_id?: string;
  shot_id: string;
  order_index: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  video_url: string;
  selected_version_id?: string;
  thumbnail_path?: string;
  subtitle_cue_ids: string[];
  audio_cue_ids: string[];
}

export interface AiComicSeriesSeedanceFinishingPlanPackage {
  schema_version: 'ai-comic-series-seedance-finishing-plan/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  source_cut_output_path?: string;
  source_cut_status?: AiComicSeedanceCutAssemblyStatus;
  total_ready_shot_count: number;
  total_missing_shot_count: number;
  total_duration_sec: number;
  subtitle_format: 'srt';
  recommended_output_profile: 'mp4_h264_1080p';
  shots: AiComicSeedanceFinishingShot[];
  subtitle_cues: AiComicSeedanceFinishingSubtitleCue[];
  audio_cues: AiComicSeedanceFinishingAudioCue[];
  title_cards: Array<{
    card_id: string;
    placement: 'series_opening' | 'episode_opening' | 'episode_ending' | 'series_ending';
    episode_no?: number;
    duration_sec: number;
    text: string;
    visual_note: string;
  }>;
  quality_checklist: string[];
  missing_shots: AiComicSeriesSeedanceCutPackage['missing_shots'];
  markdown: string;
}

export interface StoryProductionBoardCostumeAsset {
  asset_id: string;
  character_name: string;
  clothing: string;
  continuity_note: string;
}

export interface StoryProductionBoardPropAsset {
  asset_id: string;
  label: string;
  source_scene_ids: number[];
  usage_note: string;
}

export interface StoryProductionBoardShotUnit {
  shot_id: string;
  source_scene_id: number;
  source_segment_id?: number;
  duration_sec: number;
  panel_count: number;
  characters: string[];
  location: string;
  script_text: string;
  visual_prompt: string;
  camera_suggestion: string;
  production_prompt: string;
  seedance_prompt: string;
  seedance_duration_sec: number;
  seedance_validation_notes: string[];
  seedance_asset_slots: SeedanceShotAssetSlot[];
  seedance_material_validation: SeedanceShotMaterialValidation;
  continuity_notes: string[];
  cultural_boundary: string;
  negative_constraints: string[];
  qa_flags: string[];
}

export interface StoryProductionBoardDirectorPlan {
  scene_id: number;
  dramatic_purpose: string;
  emotion_turn: string;
  camera_logic: string;
  transition_hint: string;
}

export type StoryProductionBoardSupervisionCategory =
  | 'asset'
  | 'prompt'
  | 'filmability'
  | 'continuity'
  | 'period'
  | 'duration';

export type StoryProductionBoardSupervisionSeverity = 'info' | 'warn' | 'blocker';

export interface StoryProductionBoardSupervisionIssue {
  issue_id: string;
  category: StoryProductionBoardSupervisionCategory;
  severity: StoryProductionBoardSupervisionSeverity;
  source_shot_id?: string;
  source_scene_id?: number;
  title: string;
  detail: string;
  fix_hint: string;
}

export interface StoryProductionBoardSupervisionReport {
  passed: boolean;
  score: number;
  blockers: number;
  warnings: number;
  issue_count: number;
  issues: StoryProductionBoardSupervisionIssue[];
  priority_fixes: string[];
}

export type StoryProductionBoardRepairAction =
  | 'normalize_period_costumes'
  | 'register_asset'
  | 'clean_prompt'
  | 'strengthen_filmability'
  | 'add_continuity'
  | 'split_duration';

export type StoryProductionBoardRepairPriority = 'P0' | 'P1' | 'P2';

export interface StoryProductionBoardRepairTask {
  task_id: string;
  action: StoryProductionBoardRepairAction;
  priority: StoryProductionBoardRepairPriority;
  target_issue_ids: string[];
  target_shot_ids: string[];
  target_scene_ids: number[];
  title: string;
  instruction: string;
  expected_output: string;
  acceptance_criteria: string[];
}

export interface StoryProductionBoardRepairPlan {
  task_count: number;
  blocker_task_count: number;
  tasks: StoryProductionBoardRepairTask[];
}

export type StoryProductionBoardDeliveryStage =
  | 'blocked'
  | 'needs_repair'
  | 'ready';

export type StoryProductionBoardDeliveryArtifactKind =
  | 'board_json'
  | 'board_markdown'
  | 'supervision_report'
  | 'repair_plan'
  | 'seedance_prompts'
  | 'seedance_asset_report'
  | 'seedance_shot_ledger';

export interface StoryProductionBoardDeliveryArtifact {
  artifact_id: string;
  kind: StoryProductionBoardDeliveryArtifactKind;
  label: string;
  status: StoryProductionBoardDeliveryStage;
  description: string;
}

export interface StoryProductionBoardDeliveryManifest {
  stage: StoryProductionBoardDeliveryStage;
  stage_label: string;
  next_action: string;
  blockers: string[];
  ready_artifact_count: number;
  artifacts: StoryProductionBoardDeliveryArtifact[];
}

export interface StoryProductionBoardQaReport {
  passed: boolean;
  score: number;
  issues: string[];
  missing_asset_refs: string[];
  prompt_pollution_flags: string[];
  continuity_risks: string[];
}

export interface StoryProductionBoard {
  schema_version: 'story-production-board/v1';
  project_id?: string;
  storyId: string;
  title: string;
  generated_at: string;
  character_assets: GearsCharacterAsset[];
  location_assets: GearsSceneAsset[];
  costume_assets: StoryProductionBoardCostumeAsset[];
  prop_assets: StoryProductionBoardPropAsset[];
  director_plan: StoryProductionBoardDirectorPlan[];
  shot_units: StoryProductionBoardShotUnit[];
  seedance_asset_report: SeedanceAssetReportPackage;
  seedance_shot_ledger: SeedanceShotLedger;
  continuity_constraints: string[];
  negative_constraints: string[];
  supervision_report: StoryProductionBoardSupervisionReport;
  repair_plan: StoryProductionBoardRepairPlan;
  delivery_manifest: StoryProductionBoardDeliveryManifest;
  qa_report: StoryProductionBoardQaReport;
  markdown: string;
}

export type StoryProductionBoardExportFileKind =
  | StoryProductionBoardDeliveryArtifactKind
  | 'delivery_manifest';

export interface StoryProductionBoardExportFile {
  file_id: string;
  kind: StoryProductionBoardExportFileKind;
  label: string;
  relative_path: string;
  file_path: string;
  mime_type: string;
  byte_size: number;
}

export interface StoryProductionBoardExportPackage {
  schema_version: 'story-production-board-export/v1';
  project_id: string;
  storyId: string;
  title: string;
  exported_at: string;
  export_dir: string;
  files: StoryProductionBoardExportFile[];
  board: StoryProductionBoard;
}

export interface StoryProductionBoardRepairRequest {
  task_ids?: string[];
  actions?: StoryProductionBoardRepairAction[];
  categories?: StoryProductionBoardSupervisionCategory[];
  shot_ids?: string[];
  scene_ids?: number[];
  priorities?: StoryProductionBoardRepairPriority[];
  apply_all?: boolean;
}

export interface StoryProductionBoardRepairSceneFieldDiff {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface StoryProductionBoardRepairSceneDiff {
  scene_id: number;
  title: string;
  changed_fields: StoryProductionBoardRepairSceneFieldDiff[];
}

export interface StoryProductionBoardRepairTrace {
  trace_id: string;
  attempted: true;
  applied: boolean;
  reason: string;
  before_stage: StoryProductionBoardDeliveryStage;
  after_stage: StoryProductionBoardDeliveryStage;
  before_blockers: number;
  after_blockers: number;
  applied_task_ids: string[];
  skipped_task_ids: string[];
  applied_actions: StoryProductionBoardRepairAction[];
  changed_scene_ids: number[];
  scene_diffs: StoryProductionBoardRepairSceneDiff[];
  note: string;
}

export interface StoryProductionBoardRepairResult {
  schema_version: 'story-production-board-repair/v1';
  project: StoryProjectMeta;
  detail: StoryProjectDetail;
  before_board: StoryProductionBoard;
  after_board: StoryProductionBoard;
  trace: StoryProductionBoardRepairTrace;
}

export interface StoryProductionBoardRepairExportResult {
  schema_version: 'story-production-board-repair-export/v1';
  project: StoryProjectMeta;
  detail: StoryProjectDetail;
  repair: StoryProductionBoardRepairResult;
  export_package: StoryProductionBoardExportPackage;
}

// ---------------------------------------------------------------------------
// Story outline analysis — multi-knowledge matching
// ---------------------------------------------------------------------------

export interface KnowledgeNeed {
  need_id: string;
  label: string;
  keywords: string[];
  required: boolean;
}

export interface StoryOutlineAnalyzeRequest {
  outline: string;
  preferred_video_types?: VideoType[];
  target_video_duration?: SupportedDuration;
  localized_target_region?: string;
}

export interface StoryOutlineAnalysis {
  outline: string;
  detected_subjects: string[];
  detected_domain: 'china_culture_or_history' | 'modern' | 'other';
  story_intent: {
    main_character: string | null;
    time_range: string | null;
    core_theme: string;
    conflict_keywords: string[];
    target_emotion: string[];
  };
  detected_characters: StoryDetectedCharacter[];
  knowledge_needs: KnowledgeNeed[];
}

export interface KnowledgePackEntry {
  entry_name: string;
  province: string;
  region: string;
  type: string;
  summary: string;
  score: number;
  role_in_story: string;
  match_reason: string;
  keywords: string[];
  knowledge_domain?: KnowledgeDomain;
  entry_role?: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
  asset_split?: KnowledgeAssetSplit;
  production_prompts?: string[];
  review_boundaries?: string[];
}

export interface KnowledgePackMissing {
  need_id: string;
  label: string;
  message: string;
}

export interface KnowledgePack {
  primary_entries: KnowledgePackEntry[];
  supporting_entries: KnowledgePackEntry[];
  missing_needs: KnowledgePackMissing[];
  overall_confidence: number;
}

export type DomainPackProductionHealthStatus = 'passed' | 'warning' | 'failed';
export type DomainPackProductionHealthIssueSeverity = 'warning' | 'error';

export interface DomainPackProductionHealthIssue {
  severity: DomainPackProductionHealthIssueSeverity;
  issue_type:
    | 'missing_required_pack'
    | 'duplicate_entry_name'
    | 'underfilled_trigger_words'
    | 'underfilled_production_prompts'
    | 'underfilled_review_boundaries'
    | 'missing_expected_asset_usage';
  pack_id?: string;
  entry_name?: string;
  message: string;
  details?: string[];
}

export interface DomainPackProductionHealthSummary {
  pack_id: string;
  entry_name: string;
  domain: KnowledgeDomain;
  role: KnowledgeEntryRole;
  trigger_word_count: number;
  production_prompt_count: number;
  review_boundary_count: number;
  asset_usage: KnowledgeAssetUsage[];
  status: DomainPackProductionHealthStatus;
}

export interface DomainPackProductionHealthReport {
  schema_version: 'domain-pack-production-health/v1';
  generated_at: string;
  domain_id: string;
  version: string;
  status: DomainPackProductionHealthStatus;
  pack_count: number;
  production_pack_count: number;
  required_pack_ids: string[];
  covered_required_pack_ids: string[];
  missing_required_pack_ids: string[];
  production_ready_pack_ids: string[];
  packs: DomainPackProductionHealthSummary[];
  issues: DomainPackProductionHealthIssue[];
}

export interface DomainPackExpansionCandidateIssue {
  severity: DomainPackProductionHealthIssueSeverity;
  issue_type:
    | 'missing_candidate_file'
    | 'invalid_schema_version'
    | 'direct_writeback_enabled'
    | 'missing_required_pack'
    | 'duplicate_batch_id'
    | 'invalid_batch_status'
    | 'underfilled_field_group'
    | 'underfilled_seed_target';
  batch_id?: string;
  pack_id?: string;
  message: string;
  details?: string[];
}

export interface DomainPackExpansionBatchSummary {
  batch_id: string;
  pack_id: string;
  entry_name: string;
  priority: string;
  status: string;
  target_video_types: string[];
  field_group_count: number;
  candidate_field_count: number;
  field_supplement_candidate_count?: number;
  seed_target_count: number;
  provinces: string[];
}

export interface DomainPackExpansionVideoTypeCoverageSummary {
  video_type: string;
  batch_count: number;
  seed_target_count: number;
  candidate_field_count: number;
  pack_ids: string[];
  batch_ids: string[];
  provinces: string[];
  field_workbench_item_count?: number;
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_status_counts: Record<DomainPackExpansionReviewStatus, number>;
  approved_writeback_draft_count: number;
  writeback_status_counts: Record<KnowledgeWritebackStatus, number>;
}

export interface DomainPackExpansionFieldSupplementTarget {
  review_item_id: string;
  batch_id: string;
  pack_id: string;
  entry_name: string;
  province: string;
  priority: string;
  target_video_types: string[];
  review_status: DomainPackExpansionReviewStatus;
  writeback_status?: KnowledgeWritebackStatus;
  field_id: string;
  priority_score: number;
  priority_video_types: string[];
  priority_video_type_count: number;
  reason: string;
  review_questions: string[];
  forbidden_direct_claims: string[];
  recommended_action: string;
}

export interface DomainPackExpansionReviewReadyTarget {
  review_item_id: string;
  batch_id: string;
  pack_id: string;
  entry_name: string;
  province: string;
  priority: string;
  target_video_types: string[];
  review_status: DomainPackExpansionReviewStatus;
  writeback_status?: KnowledgeWritebackStatus;
  recommended_fields: string[];
  priority_score: number;
  priority_video_types: string[];
  priority_video_type_count: number;
  field_workbench_item_count: number;
  field_review_ready_count: number;
  field_review_blocker_count: number;
  field_review_ready_percent: number;
  review_questions: string[];
  forbidden_direct_claims: string[];
  reason: string;
  recommended_action: string;
}

export interface DomainPackExpansionReviewFieldGroup {
  group_id: string;
  candidate_fields: string[];
  review_questions: string[];
}

export type DomainPackExpansionFieldSupplementStatus =
  | 'needs_candidate'
  | 'candidate_draft';

export interface DomainPackExpansionFieldWorkbenchItem {
  field_id: string;
  supplement_status: DomainPackExpansionFieldSupplementStatus;
  candidate_value?: string;
  evidence_level?: string;
  source_refs: string[];
  review_questions: string[];
  writeback_hint?: string;
  verification_note?: string;
  review_ready: boolean;
  review_ready_missing: string[];
}

export interface DomainPackExpansionReviewItem {
  review_item_id: string;
  batch_id: string;
  pack_id: string;
  entry_name: string;
  province: string;
  priority: string;
  target_video_types: string[];
  candidate_status: string;
  recommended_fields: string[];
  forbidden_direct_claims: string[];
  field_workbench: DomainPackExpansionFieldWorkbenchItem[];
  field_supplement_candidate_count: number;
  field_missing_candidate_count: number;
  field_candidate_completion_percent: number;
  field_review_ready_count: number;
  field_review_blocker_count: number;
  field_review_ready_percent: number;
  review_ready: boolean;
  candidate_markdown: string;
  review_status?: DomainPackExpansionReviewStatus;
  review_note?: string;
  reviewed_at?: string;
  review_state_source: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed: boolean;
  review_state_seed_status?: DomainPackExpansionReviewStatus;
  review_state_seed_writeback_status?: KnowledgeWritebackStatus;
  review_state_runtime_status?: DomainPackExpansionReviewStatus;
  review_state_runtime_writeback_status?: KnowledgeWritebackStatus;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  writeback_updated_at?: string;
  writeback_draft_markdown?: string;
}

export interface DomainPackExpansionReviewBatch {
  batch_id: string;
  pack_id: string;
  entry_name: string;
  priority: string;
  status: string;
  target_video_types: string[];
  field_groups: DomainPackExpansionReviewFieldGroup[];
  review_item_count: number;
  review_items: DomainPackExpansionReviewItem[];
}

export interface DomainPackExpansionReviewPacket {
  schema_version: 'domain-pack-expansion-review-packet/v1';
  generated_at: string;
  source_schema_version: string;
  domain_id: string;
  status: DomainPackProductionHealthStatus;
  review_policy: {
    direct_writeback_to_province_markdown: boolean;
    requires_candidate_markdown: boolean;
    requires_human_review: boolean;
    requires_source_level: boolean;
  };
  batch_count: number;
  review_item_count: number;
  candidate_field_count: number;
  field_workbench_item_count?: number;
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_ready_item_count?: number;
  review_blocked_item_count?: number;
  batches: DomainPackExpansionReviewBatch[];
  review_status_counts?: Record<DomainPackExpansionReviewStatus, number>;
  approved_writeback_draft_count?: number;
  markdown?: string;
}

export type DomainPackExpansionReviewStatus =
  | 'candidate_review'
  | 'approved'
  | 'rejected'
  | 'needs_revision';

export type DomainPackExpansionReviewStateSource =
  | 'none'
  | 'seed'
  | 'runtime';

export type DomainPackExpansionPipelineStage =
  | 'candidate_setup'
  | 'field_supplement'
  | 'review_readiness'
  | 'human_review'
  | 'writeback_queue'
  | 'complete';

export interface DomainPackExpansionReviewStateItem {
  review_item_id: string;
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  reviewed_at?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  writeback_updated_at?: string;
}

export interface DomainPackExpansionReviewStateUpdateRequest {
  review_item_id: string;
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
}

export interface DomainPackExpansionReviewStateBulkUpdateRequest {
  review_item_ids: string[];
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
}

export interface DomainPackExpansionReviewStateBulkUpdateResult {
  schema_version: 'domain-pack-expansion-review-state-bulk-update/v1';
  updated_at: string;
  updated_count: number;
  missing_review_item_ids: string[];
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  report: DomainPackExpansionCandidateReport;
}

export interface DomainPackExpansionWritebackDraftItem {
  review_item_id: string;
  batch_id: string;
  pack_id: string;
  entry_name: string;
  province: string;
  target_video_types: string[];
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  review_state_source: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed: boolean;
  review_state_seed_status?: DomainPackExpansionReviewStatus;
  review_state_seed_writeback_status?: KnowledgeWritebackStatus;
  review_state_runtime_status?: DomainPackExpansionReviewStatus;
  review_state_runtime_writeback_status?: KnowledgeWritebackStatus;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  suggested_file_path: string;
  suggested_section_heading: string;
  field_workbench?: DomainPackExpansionFieldWorkbenchItem[];
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_ready?: boolean;
  append_markdown: string;
  writeback_draft_markdown: string;
}

export interface DomainPackExpansionWritebackDraftFilter {
  review_item_ids?: string[];
  pack_ids?: string[];
  video_types?: string[];
  provinces?: string[];
  writeback_statuses?: KnowledgeWritebackStatus[];
}

export interface DomainPackExpansionWritebackDraftPackage {
  schema_version: 'domain-pack-expansion-writeback-draft/v1';
  exported_at: string;
  domain_id: string;
  direct_writeback_to_province_markdown: false;
  filters: DomainPackExpansionWritebackDraftFilter;
  approved_count: number;
  target_files: string[];
  status_counts: Record<KnowledgeWritebackStatus, number>;
  markdown: string;
  items: DomainPackExpansionWritebackDraftItem[];
}

export type DomainPackExpansionDevelopmentTaskStatus =
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'complete';

export interface DomainPackExpansionNextDevelopmentTask {
  task_id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  status: DomainPackExpansionDevelopmentTaskStatus;
  progress_percent: number;
  progress_note: string;
  related_plan_items: number[];
  target_video_types: string[];
  description: string;
  acceptance_checks: string[];
  direct_writeback_to_province_markdown: false;
}

export interface DomainPackExpansionWritebackPreflightSummary {
  schema_version: 'domain-pack-expansion-writeback-preflight/v1';
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  approved_draft_count: number;
  draft_ready_count: number;
  queued_count: number;
  written_back_count: number;
  needs_revision_count: number;
  target_file_count: number;
  target_files: string[];
  manual_review_required_count: number;
  blocked_direct_writeback_count: number;
  ready_for_unified_export: boolean;
  safety_checks: string[];
}

export interface KnowledgeWritebackQueueExportFilters {
  project_id?: string;
  video_type?: VideoType;
  province?: string;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  search_query?: string;
  project_task_key_count?: number;
  expansion_review_item_count?: number;
}

export interface KnowledgeWritebackQueueExportStatusCounts {
  project: Record<KnowledgeWritebackStatus, number>;
  expansion: Record<KnowledgeWritebackStatus, number>;
  total: Record<KnowledgeWritebackStatus, number>;
}

export interface KnowledgeWritebackQueueExportTargetFilePreflight {
  target_file: string;
  project_draft_count: number;
  expansion_draft_count: number;
  total_draft_count: number;
  expansion_candidate_field_count: number;
  expansion_field_missing_count: number;
  expansion_source_ref_count: number;
  writeback_status_counts: Record<KnowledgeWritebackStatus, number>;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  safety_note: string;
}

export interface KnowledgeWritebackQueueReviewHandoffItem {
  handoff_id: string;
  source_kind: 'project' | 'domain_pack_expansion';
  title: string;
  target_file: string;
  writeback_status: KnowledgeWritebackStatus;
  province?: string;
  project_id?: string;
  task_id?: string;
  review_item_id?: string;
  pack_id?: string;
  target_video_types: string[];
  review_state_source?: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed?: boolean;
  review_note?: string;
  writeback_note?: string;
  candidate_field_count: number;
  source_ref_count: number;
  required_action: string;
}

export interface KnowledgeWritebackQueueReviewSignoffManifest {
  schema_version: 'knowledge-writeback-queue-signoff-manifest/v1';
  manifest_id: string;
  generated_at: string;
  sha256: string;
  item_count: number;
  target_file_count: number;
  source_ref_count: number;
  requires_manual_signoff_count: number;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
}

export interface KnowledgeWritebackQueueReviewHandoff {
  schema_version: 'knowledge-writeback-queue-review-handoff/v1';
  signoff_manifest: KnowledgeWritebackQueueReviewSignoffManifest;
  total_handoff_count: number;
  project_handoff_count: number;
  expansion_handoff_count: number;
  runtime_override_count: number;
  seed_sourced_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  requires_manual_signoff_count: number;
  status_counts: Record<KnowledgeWritebackStatus, number>;
  operator_checklist: string[];
  items: KnowledgeWritebackQueueReviewHandoffItem[];
}

export interface KnowledgeWritebackQueueSignoffPackage {
  schema_version: 'knowledge-writeback-queue-signoff-package/v1';
  exported_at: string;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  filters: KnowledgeWritebackQueueExportFilters;
  signoff_manifest: KnowledgeWritebackQueueReviewSignoffManifest;
  status_counts: Record<KnowledgeWritebackStatus, number>;
  operator_checklist: string[];
  handoff_item_count: number;
  handoff_items: KnowledgeWritebackQueueReviewHandoffItem[];
}

export interface KnowledgeWritebackQueueExportPreflight {
  schema_version: 'knowledge-writeback-queue-export-preflight/v1';
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  target_file_count: number;
  target_files: string[];
  total_draft_count: number;
  project_draft_count: number;
  expansion_draft_count: number;
  expansion_candidate_field_count: number;
  expansion_field_missing_count: number;
  expansion_source_ref_count: number;
  manual_review_required_count: number;
  blocked_direct_writeback_count: number;
  ready_for_manual_export: boolean;
  target_file_preflight: KnowledgeWritebackQueueExportTargetFilePreflight[];
  review_handoff: KnowledgeWritebackQueueReviewHandoff;
  safety_checks: string[];
}

export interface KnowledgeWritebackQueueExportPackage {
  schema_version: 'knowledge-writeback-queue-export/v1';
  exported_at: string;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  filters: KnowledgeWritebackQueueExportFilters;
  approved_count: number;
  project_approved_count: number;
  expansion_approved_count: number;
  project_count: number;
  target_files: string[];
  status_counts: KnowledgeWritebackQueueExportStatusCounts;
  preflight: KnowledgeWritebackQueueExportPreflight;
  signoff_package: KnowledgeWritebackQueueSignoffPackage;
  project_patch: ProjectKnowledgeWritebackPatchPackage;
  expansion_draft: DomainPackExpansionWritebackDraftPackage;
  markdown: string;
}

export interface DomainPackExpansionCandidateReport {
  schema_version: 'domain-pack-expansion-candidates-report/v1';
  generated_at: string;
  source_schema_version: string;
  updated_at: string;
  domain_id: string;
  status: DomainPackProductionHealthStatus;
  required_pack_ids: string[];
  covered_required_pack_ids: string[];
  missing_required_pack_ids: string[];
  review_policy: {
    direct_writeback_to_province_markdown: boolean;
    requires_candidate_markdown: boolean;
    requires_human_review: boolean;
    requires_source_level: boolean;
  };
  batch_count: number;
  seed_target_count: number;
  candidate_field_count: number;
  pipeline_progress_percent: number;
  pipeline_stage: DomainPackExpansionPipelineStage;
  field_workbench_item_count?: number;
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_ready_item_count?: number;
  review_blocked_item_count?: number;
  field_supplement_priority_target_count: number;
  field_supplement_priority_targets: DomainPackExpansionFieldSupplementTarget[];
  review_ready_priority_target_count: number;
  review_ready_priority_targets: DomainPackExpansionReviewReadyTarget[];
  video_type_coverage_count: number;
  coverage_by_video_type: DomainPackExpansionVideoTypeCoverageSummary[];
  writeback_preflight: DomainPackExpansionWritebackPreflightSummary;
  next_development_tasks: DomainPackExpansionNextDevelopmentTask[];
  batches: DomainPackExpansionBatchSummary[];
  issues: DomainPackExpansionCandidateIssue[];
  review_packet: DomainPackExpansionReviewPacket;
  markdown?: string;
}

export type CreationUseCase =
  | 'original_ai_comic'
  | 'adapted_ai_comic'
  | 'institutional_promo'
  | 'documentary_short'
  | 'brand_commercial'
  | 'education_training'
  | 'public_service';

export type TruthMode =
  | 'fictional_original'
  | 'inspired_by_material'
  | 'source_adaptation'
  | 'factual_reconstruction'
  | 'institutional_verified';

export type MaterialSourceType =
  | 'knowledge_entry'
  | 'user_outline'
  | 'user_source_text'
  | 'brand_profile'
  | 'institution_profile'
  | 'visual_asset'
  | 'reference_style'
  | 'manual_note';

export type MaterialPurpose =
  | 'fact_basis'
  | 'character_source'
  | 'visual_asset'
  | 'era_context'
  | 'regional_context'
  | 'cultural_background'
  | 'brand_info'
  | 'institutional_position'
  | 'source_work'
  | 'reference_style'
  | 'creative_boundary';

export interface MaterialPackEntry {
  material_id: string;
  title: string;
  summary: string;
  source_type: MaterialSourceType;
  purpose: MaterialPurpose[];
  confidence?: number;
  role_in_story?: string;
  provenance?: string;
  linked_entry_name?: string;
  tags?: string[];
}

export interface MaterialVisualAsset {
  asset_id: string;
  label: string;
  kind: 'character' | 'scene' | 'prop' | 'document' | 'brand' | 'other';
  description: string;
  source_material_id?: string;
  file_url?: string;
}

export interface MaterialBrandOrInstitutionProfile {
  name?: string;
  client_type?: string;
  voice?: string;
  verified_claims?: string[];
  forbidden_claims?: string[];
}

export interface MaterialSourceWorkProfile {
  title?: string;
  author?: string;
  rights_note?: string;
  adaptation_boundary?: string;
  core_characters?: string[];
  must_keep?: string[];
}

export interface MaterialPack {
  schema_version: 'material-pack/v1';
  primary_materials: MaterialPackEntry[];
  supporting_materials: MaterialPackEntry[];
  reference_materials: MaterialPackEntry[];
  brand_or_institution_profile?: MaterialBrandOrInstitutionProfile;
  source_work_profile?: MaterialSourceWorkProfile;
  visual_assets: MaterialVisualAsset[];
  verified_facts: string[];
  uncertain_claims: string[];
  creative_space: string[];
  missing_needs: KnowledgePackMissing[];
  overall_confidence: number;
  token_budget_summary?: {
    estimated_input_tokens?: number;
    strategy?: string;
    notes?: string[];
  };
}

export interface ProductionMaterialTemplate {
  required_fields: string[];
  prompt_layers?: string[];
  minimum_viable_story_gate: string[];
  script_ready_gate: string[];
  production_ready_gate: string[];
  supplement_questions: string[];
}

export interface ProductionMaterialSampleEntry {
  sample_id: string;
  entry_name: string;
  source_status?: string;
  core_story_engine?: string;
  must_collect?: string[];
  visual_assets?: string[];
  risk_boundary?: string;
  episode_hook?: string;
  core_conflict?: string;
  character_stability?: string[];
  shot_prompt_focus?: string[];
  ending_hook?: string;
}

export interface ProductionMaterialPack {
  video_type: VideoType;
  label: string;
  goal: string;
  material_template: ProductionMaterialTemplate;
  sample_entries: ProductionMaterialSampleEntry[];
}

export type ProductionMaterialPackHealthStatus = 'passed' | 'warning' | 'failed';
export type ProductionMaterialPackIssueSeverity = 'warning' | 'error';

export interface ProductionMaterialPackHealthIssue {
  severity: ProductionMaterialPackIssueSeverity;
  issue_type:
    | 'missing_required_video_type'
    | 'unknown_required_field'
    | 'duplicate_required_field'
    | 'underfilled_prompt_layers'
    | 'underfilled_sample_entries'
    | 'underfilled_supplement_questions'
    | 'underfilled_gate_items';
  video_type?: VideoType;
  message: string;
  details?: string[];
}

export interface ProductionMaterialPackHealthSummary {
  video_type: VideoType;
  label: string;
  required_field_count: number;
  prompt_layer_count: number;
  sample_entry_count: number;
  supplement_question_count: number;
  gate_item_counts: Record<MaterialSufficiencyStage, number>;
  unknown_required_fields: string[];
  duplicate_required_fields: string[];
  status: ProductionMaterialPackHealthStatus;
}

export interface ProductionMaterialPackHealthReport {
  schema_version: 'production-material-pack-health/v1';
  generated_at: string;
  status: ProductionMaterialPackHealthStatus;
  pack_count: number;
  required_video_types: VideoType[];
  covered_required_video_types: VideoType[];
  missing_required_video_types: VideoType[];
  core_video_types: VideoType[];
  production_ready_core_video_types: VideoType[];
  high_frequency_video_types: VideoType[];
  packs: ProductionMaterialPackHealthSummary[];
  issues: ProductionMaterialPackHealthIssue[];
}

export type ProductionMaterialReadinessStatus = 'ready' | 'needs_input' | 'blocked';

export interface ProductionMaterialMissingField {
  field_id: string;
  label: string;
  stage: MaterialSufficiencyStage;
  blocking_level: MaterialBlockingLevel;
  reason: string;
  recommended_question: string;
}

export interface ProductionMaterialGateReport {
  stage: MaterialSufficiencyStage;
  status: ProductionMaterialReadinessStatus;
  required_items: string[];
  available_fields: string[];
  missing_fields: ProductionMaterialMissingField[];
  notes: string[];
}

export interface ProductionMaterialReadinessReport {
  schema_version: 'production-material-readiness/v1';
  video_type: VideoType;
  pack_label: string;
  score: number;
  status: ProductionMaterialReadinessStatus;
  available_fields: string[];
  missing_fields: ProductionMaterialMissingField[];
  gate_reports: ProductionMaterialGateReport[];
  recommended_next_questions: string[];
}

export type MaterialSufficiencyStage =
  | 'minimum_viable_story'
  | 'script_ready'
  | 'production_ready';

export type MaterialBlockingLevel = 'blocking' | 'risk' | 'optional';
export type MaterialTokenRisk = 'low' | 'medium' | 'high';
export type MaterialSufficiencyStageStatus = 'ready' | 'needs_input' | 'blocked';
export type MaterialGenerationPosture =
  | 'ready'
  | 'draft_needs_verification'
  | 'script_ready_production_pending'
  | 'blocked_until_input';

export interface MaterialSufficiencyMissingItem {
  item_id: string;
  label: string;
  reason: string;
  blocking_level: MaterialBlockingLevel;
  affects: string[];
  recommended_question: string;
}

export interface MaterialSufficiencyStageReport {
  stage: MaterialSufficiencyStage;
  status: MaterialSufficiencyStageStatus;
  score: number;
  can_proceed: boolean;
  required_items: string[];
  available_outputs: string[];
  missing_items: MaterialSufficiencyMissingItem[];
  optional_items: MaterialSufficiencyMissingItem[];
  notes: string[];
}

export interface MaterialSufficiencyReport {
  schema_version: 'material-sufficiency/v1';
  stage: MaterialSufficiencyStage;
  active_stage?: MaterialSufficiencyStage;
  score: number;
  can_generate: boolean;
  can_generate_with_risks: boolean;
  blocked: boolean;
  needs_verification?: boolean;
  generation_posture?: MaterialGenerationPosture;
  next_stage?: MaterialSufficiencyStage;
  downgrade_reason?: string;
  stage_reports?: MaterialSufficiencyStageReport[];
  missing_items: MaterialSufficiencyMissingItem[];
  optional_items: MaterialSufficiencyMissingItem[];
  token_risk: MaterialTokenRisk;
  recommended_next_questions: string[];
}

export interface CreationContract {
  schema_version: 'creation-contract/v1';
  creation_use_case: CreationUseCase;
  truth_mode: TruthMode;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure: StoryStructureType;
  narrative_pattern_ids: NarrativePatternId[];
  allowed_fiction: string[];
  must_verify: string[];
  forbidden_moves: string[];
  required_disclaimers: string[];
  material_sufficiency: MaterialSufficiencyReport;
  delivery_expectation: string[];
}

export type KnowledgeSupplementTaskStatus = 'open' | 'resolved';
export type KnowledgeCandidateReviewStatus = 'pending_review' | 'approved' | 'rejected';
export type KnowledgeWritebackStatus = 'draft_ready' | 'queued' | 'written_back' | 'needs_revision';
export type KnowledgeSupplementTaskSource =
  | 'knowledge_pack_missing_need'
  | 'material_sufficiency_missing_item'
  | 'production_material_missing_field';
export type KnowledgeSupplementTaskCategory =
  | 'person_experience'
  | 'architecture_detail'
  | 'event_process'
  | 'regional_context'
  | 'cultural_background'
  | 'supporting_character'
  | 'general';

export interface KnowledgeSupplementTask {
  task_id: string;
  need_id: string;
  label: string;
  description: string;
  category?: KnowledgeSupplementTaskCategory;
  stage?: MaterialSufficiencyStage;
  blocking_level?: MaterialBlockingLevel;
  affects?: string[];
  recommended_question?: string;
  recommended_fields?: string[];
  intake_prompt?: string;
  status: KnowledgeSupplementTaskStatus;
  source: KnowledgeSupplementTaskSource;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  supplement_note?: string;
  supplement_field_values?: Record<string, string>;
  knowledge_candidate_markdown?: string;
  knowledge_candidate_review_status?: KnowledgeCandidateReviewStatus;
  knowledge_candidate_review_note?: string;
  knowledge_candidate_reviewed_at?: string;
  knowledge_writeback_draft_markdown?: string;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  knowledge_writeback_note?: string;
  knowledge_writeback_updated_at?: string;
}

export interface KnowledgeSupplementTaskUpdateRequest {
  status: KnowledgeSupplementTaskStatus;
  supplement_note?: string;
  supplement_field_values?: Record<string, string>;
  knowledge_candidate_review_status?: KnowledgeCandidateReviewStatus;
  knowledge_candidate_review_note?: string;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  knowledge_writeback_note?: string;
}

export interface MultiMatchResult {
  outline: string;
  matched_knowledge_pack: KnowledgePack;
}

// ---------------------------------------------------------------------------
// AI comic series planning
// ---------------------------------------------------------------------------

export type AiComicPacingProfile =
  | 'fast_hook'
  | 'balanced_drama'
  | 'slow_burn'
  | 'mystery_cliffhanger';

export type AiComicGenerationScope =
  | 'series_bible'
  | 'episode_cards'
  | 'full_planning';

export interface AiComicDurationRange {
  min: number;
  max: number;
}

export interface AiComicSeriesPlanRequest {
  outline: string;
  series_title?: string;
  episode_count: number;
  episode_duration_range_sec: AiComicDurationRange;
  pacing_profile?: AiComicPacingProfile;
  generation_scope?: AiComicGenerationScope;
  narrative_pattern_ids?: NarrativePatternId[];
  knowledge_pack?: KnowledgePack;
  character_hints?: StoryDetectedCharacter[];
}

export interface AiComicSeriesCharacterArc {
  name: string;
  role: string;
  starting_state: string;
  desire: string;
  long_arc: string;
  turning_points: Array<{
    episode_no: number;
    change: string;
  }>;
  visual_signature: string;
}

export interface AiComicPlotThread {
  thread_id: string;
  title: string;
  setup_episode: number;
  payoff_episode: number;
  description: string;
  continuity_notes: string[];
}

export interface AiComicContinuityRule {
  rule_id: string;
  label: string;
  description: string;
}

export interface AiComicSeriesPhase {
  phase_id: string;
  episode_range: [number, number];
  purpose: string;
  turning_point: string;
}

export interface AiComicSeriesSpineBeat {
  beat_id: string;
  episode_range: [number, number];
  story_function: string;
  central_question: string;
  required_turn: string;
  payoff_target: string;
}

export type AiComicEndingHookType =
  | 'choice'
  | 'reveal'
  | 'danger'
  | 'emotional_question'
  | 'quiet_aftertaste'
  | 'final_echo';

export interface AiComicEpisodePlan {
  episode_no: number;
  title: string;
  target_duration_sec: number;
  target_panel_count: number;
  story_phase: string;
  opening_hook?: string;
  main_conflict: string;
  midpoint_turn?: string;
  key_characters: string[];
  continuity_from_previous: string[];
  new_information: string[];
  foreshadowing: string[];
  payoff: string[];
  ending_hook: string;
  ending_hook_type?: AiComicEndingHookType;
  character_state_change?: string;
  thread_action?: string;
  knowledge_focus: string[];
  continuity_state_after: string[];
}

export interface AiComicEpisodeBlueprint {
  schema_version: 'ai-comic-episode-blueprint/v1';
  series_title: string;
  episode_no: number;
  title: string;
  opening_hook: string;
  main_conflict: string;
  midpoint_turn: string;
  ending_hook: string;
  ending_hook_type: AiComicEndingHookType;
  character_state_change: string;
  thread_action: string;
  continuity_from_previous: string[];
  continuity_state_after: string[];
  knowledge_focus: string[];
  target_scene_functions: string[];
}

export interface AiComicSeriesPlan {
  schema_version: 'ai-comic-series-plan/v1';
  series_title: string;
  episode_count: number;
  episode_duration_range_sec: AiComicDurationRange;
  pacing_profile: AiComicPacingProfile;
  generation_scope: AiComicGenerationScope;
  narrative_pattern_ids?: NarrativePatternId[];
  recommended_narrative_patterns?: RecommendedNarrativePattern[];
  premise: string;
  logline: string;
  core_theme: string;
  main_characters: AiComicSeriesCharacterArc[];
  plot_threads: AiComicPlotThread[];
  phases: AiComicSeriesPhase[];
  series_spine?: AiComicSeriesSpineBeat[];
  episodes: AiComicEpisodePlan[];
  continuity_rules: AiComicContinuityRule[];
  recurring_motifs: string[];
  production_notes: string[];
}

export interface AiComicSeriesProjectMeta {
  series_project_id: string;
  title: string;
  episode_count: number;
  episode_duration_range_sec: AiComicDurationRange;
  pacing_profile: AiComicPacingProfile;
  logline: string;
  created_at: string;
  updated_at: string;
  generated_episode_count: number;
  archived_at?: string;
  quality_attention_episode_count?: number;
  regeneration_episode_count?: number;
  next_attention_episode_no?: number;
  next_regeneration_episode_no?: number;
  generated_episode_content_issue_count?: number;
}

export interface AiComicContinuityLedgerEpisode {
  episode_no: number;
  story_id: string;
  title: string;
  generated_at: string;
  character_state: string[];
  opened_threads: string[];
  paid_off_threads: string[];
  pending_threads_after: string[];
  knowledge_used: string[];
  ending_hook: string;
  next_episode_memory: string[];
  memory_events?: AiComicSeriesMemoryItem[];
}

export type AiComicSeriesMemoryCategory =
  | 'character'
  | 'relationship'
  | 'prop'
  | 'location'
  | 'visual_asset'
  | 'knowledge_boundary'
  | 'story_event';

export interface AiComicSeriesMemoryItem {
  memory_id: string;
  category: AiComicSeriesMemoryCategory;
  label: string;
  status: string;
  first_episode_no?: number;
  last_episode_no?: number;
  related_episode_nos: number[];
  continuity_notes: string[];
  visual_anchor?: string;
  knowledge_boundary?: string;
}

export interface AiComicSeriesMemory {
  schema_version: 'ai-comic-series-memory/v1';
  characters: AiComicSeriesMemoryItem[];
  relationships: AiComicSeriesMemoryItem[];
  props: AiComicSeriesMemoryItem[];
  locations: AiComicSeriesMemoryItem[];
  visual_assets: AiComicSeriesMemoryItem[];
  knowledge_boundaries: AiComicSeriesMemoryItem[];
  story_events: AiComicSeriesMemoryItem[];
  conflicts: string[];
}

export interface AiComicSeriesMemoryRecallItem {
  memory_id: string;
  category: AiComicSeriesMemoryCategory;
  label: string;
  status: string;
  score: number;
  reasons: string[];
  related_episode_nos: number[];
  continuity_notes: string[];
}

export interface AiComicSeriesMemoryRecall {
  schema_version: 'ai-comic-series-memory-recall/v1';
  episode_no: number;
  items: AiComicSeriesMemoryRecallItem[];
  conflicts: string[];
}

export type AiComicEpisodicMemorySource =
  | 'scene'
  | 'dialogue'
  | 'gears_segment'
  | 'seedance_shot';

export interface AiComicEpisodicMemoryItem {
  episodic_memory_id: string;
  source: AiComicEpisodicMemorySource;
  episode_no: number;
  scene_id?: string;
  shot_id?: string;
  title: string;
  text: string;
  characters: string[];
  location?: string;
  emotional_tone?: string;
  keywords: string[];
  token_signature: string[];
  recall_notes: string[];
}

export interface AiComicEpisodicMemoryIndex {
  schema_version: 'ai-comic-episodic-memory/v1';
  embedding_strategy: 'lexical-token-signature/v1';
  items: AiComicEpisodicMemoryItem[];
  updated_at?: string;
}

export interface AiComicEpisodicMemoryRecallItem {
  episodic_memory_id: string;
  source: AiComicEpisodicMemorySource;
  episode_no: number;
  title: string;
  text: string;
  score: number;
  reasons: string[];
  characters: string[];
  location?: string;
  emotional_tone?: string;
  keywords: string[];
}

export interface AiComicEpisodicMemoryRecall {
  schema_version: 'ai-comic-episodic-memory-recall/v1';
  episode_no: number;
  items: AiComicEpisodicMemoryRecallItem[];
}

export interface AiComicSeriesMemoryRecallControls {
  locked_memory_ids?: string[];
  excluded_memory_ids?: string[];
}

export interface AiComicSeriesMemoryRecallPreferences extends AiComicSeriesMemoryRecallControls {
  per_episode?: Record<string, AiComicSeriesMemoryRecallControls>;
  updated_at?: string;
}

export type AiComicProductionConstraintCategory =
  | 'continuity'
  | 'negative'
  | 'camera'
  | 'asset'
  | 'cultural_boundary';

export type AiComicProductionConstraintSeverity = 'must' | 'should' | 'watch';

export type AiComicProductionConstraintStatus = 'active' | 'resolved' | 'needs_review';

export interface AiComicProductionConstraintItem {
  constraint_id: string;
  category: AiComicProductionConstraintCategory;
  label: string;
  description: string;
  source: 'series_plan' | 'gears_segment' | 'seedance_shot' | 'manual';
  severity: AiComicProductionConstraintSeverity;
  status: AiComicProductionConstraintStatus;
  episode_no?: number;
  scene_id?: string;
  shot_id?: string;
  related_memory_ids?: string[];
  notes: string[];
}

export interface AiComicProductionConstraints {
  schema_version: 'ai-comic-production-constraints/v1';
  items: AiComicProductionConstraintItem[];
  conflicts: string[];
}

export interface AiComicContinuityLedger {
  schema_version: 'ai-comic-continuity-ledger/v1';
  last_generated_episode_no?: number;
  character_state_current: string[];
  open_threads: string[];
  paid_off_threads: string[];
  knowledge_used: string[];
  episode_records: AiComicContinuityLedgerEpisode[];
  series_memory?: AiComicSeriesMemory;
  production_constraints?: AiComicProductionConstraints;
  episodic_memory?: AiComicEpisodicMemoryIndex;
}

export interface AiComicEpisodeQualityReport {
  schema_version: 'ai-comic-episode-quality/v1';
  episode_no: number;
  score: number;
  passed: boolean;
  issues: string[];
  checks: {
    responds_to_previous: boolean;
    advances_phase_goal: boolean;
    updates_character_state: boolean;
    handles_threads: boolean;
    leaves_next_hook: boolean;
  };
}

export interface AiComicSeriesContinuityAudit {
  schema_version: 'ai-comic-continuity-audit/v1';
  checked_episode_no: number;
  passed: boolean;
  issues: string[];
  open_threads_after: string[];
  character_state_after: string[];
}

export type AiComicSeriesQualityEpisodeStatus = 'not_generated' | 'passed' | 'needs_attention' | 'unknown';

export type AiComicThreadClosureStatus =
  | 'planned'
  | 'opened'
  | 'in_progress'
  | 'paid_off'
  | 'overdue'
  | 'duplicate'
  | 'orphaned';

export interface AiComicSeriesQualityEpisodeReport {
  episode_no: number;
  story_id?: string;
  status: AiComicSeriesQualityEpisodeStatus;
  score?: number;
  issues: string[];
  plan_changed_after_generation?: boolean;
  needs_episode_regeneration?: boolean;
  needs_ledger_rebuild?: boolean;
}

export interface AiComicThreadClosureItem {
  thread_id: string;
  title: string;
  setup_episode?: number;
  payoff_episode?: number;
  status: AiComicThreadClosureStatus;
  opened_in_episodes: number[];
  paid_off_in_episodes: number[];
  related_episodes: number[];
  issues: string[];
  repair_suggestions: string[];
}

export interface AiComicThreadClosureReport {
  schema_version: 'ai-comic-thread-closure-report/v1';
  total_thread_count: number;
  opened_thread_count: number;
  paid_off_thread_count: number;
  overdue_thread_count: number;
  orphaned_thread_count: number;
  duplicate_thread_count: number;
  episodes_need_attention: number[];
  items: AiComicThreadClosureItem[];
}

export type AiComicMemoryConflictCategory =
  | 'character_state'
  | 'location_state'
  | 'relationship_state'
  | 'knowledge_boundary'
  | 'production_constraint';

export type AiComicMemoryConflictSeverity = 'blocking' | 'warning' | 'watch';

export interface AiComicMemoryConflictItem {
  conflict_id: string;
  category: AiComicMemoryConflictCategory;
  severity: AiComicMemoryConflictSeverity;
  title: string;
  description: string;
  related_episode_nos: number[];
  related_memory_ids: string[];
  evidence: string[];
  repair_suggestions: string[];
}

export interface AiComicMemoryConflictReport {
  schema_version: 'ai-comic-memory-conflict-report/v1';
  total_conflict_count: number;
  blocking_count: number;
  warning_count: number;
  watch_count: number;
  episodes_need_attention: number[];
  items: AiComicMemoryConflictItem[];
}

export interface AiComicSeriesQualityAudit {
  schema_version: 'ai-comic-series-quality-audit/v1';
  passed: boolean;
  score: number;
  generated_episode_count: number;
  total_episode_count: number;
  episodes_need_attention: number[];
  issues: string[];
  checks: {
    all_episodes_generated: boolean;
    generated_ids_in_plan_range: boolean;
    ledger_covers_generated_episodes: boolean;
    completed_series_threads_resolved: boolean;
    known_episode_quality_pass_rate: number;
  };
  episode_reports: AiComicSeriesQualityEpisodeReport[];
  thread_closure_report?: AiComicThreadClosureReport;
  memory_conflict_report?: AiComicMemoryConflictReport;
}

export interface AiComicSeriesProjectDetail {
  project: AiComicSeriesProjectMeta;
  plan: AiComicSeriesPlan;
  generated_episode_story_ids: Record<string, string>;
  continuity_ledger: AiComicContinuityLedger;
  memory_recall_preferences?: AiComicSeriesMemoryRecallPreferences;
  series_quality_audit?: AiComicSeriesQualityAudit;
  seedance_production?: AiComicSeedanceProductionLedger;
  seedance_asset_library?: AiComicSeedanceAssetLibrary;
  seedance_cut_assembly?: AiComicSeedanceCutAssemblyLedger;
  seedance_subtitle_render?: AiComicSeedanceSubtitleRenderLedger;
  seedance_audio_library?: AiComicSeedanceAudioLibrary;
  seedance_audio_mix?: AiComicSeedanceAudioMixLedger;
  seedance_title_card_render?: AiComicSeedanceTitleCardRenderLedger;
  seedance_final_delivery?: AiComicSeedanceFinalDeliveryLedger;
  seedance_review_ledger?: AiComicSeedanceReviewLedger;
  gears_job_ledger?: GearsJobLedger;
  production_readiness_automation_ledger?: ProductionReadinessAutomationRunLedger;
}

export interface AiComicSeriesBibleCharacterRow {
  name: string;
  role: string;
  starting_state: string;
  current_state: string;
  desire: string;
  long_arc: string;
  visual_signature: string;
  turning_points: string[];
}

export interface AiComicSeriesBibleLocationRow {
  location_id: string;
  label: string;
  episode_nos: number[];
  dramatic_use: string[];
  continuity_constraints: string[];
}

export interface AiComicSeriesBibleThreadRow {
  thread_id: string;
  title: string;
  setup_episode: number;
  payoff_episode: number;
  status: AiComicThreadClosureStatus;
  related_episodes: number[];
  issues: string[];
  repair_suggestions: string[];
}

export interface AiComicSeriesBibleKnowledgeBoundaryRow {
  label: string;
  episode_nos: number[];
  usage: string;
  boundary_note: string;
}

export interface AiComicSeriesBibleMemoryRow {
  category: AiComicSeriesMemoryCategory;
  label: string;
  status: string;
  episode_nos: number[];
  continuity_notes: string[];
}

export interface AiComicSeriesBibleProductionConstraintRow {
  category: AiComicProductionConstraintCategory;
  label: string;
  description: string;
  source: AiComicProductionConstraintItem['source'];
  severity: AiComicProductionConstraintSeverity;
  status: AiComicProductionConstraintStatus;
  episode_no?: number;
  shot_id?: string;
  notes: string[];
}

export interface AiComicSeriesBibleEpisodicMemoryRow {
  source: AiComicEpisodicMemorySource;
  episode_no: number;
  title: string;
  text: string;
  characters: string[];
  location?: string;
  emotional_tone?: string;
  keywords: string[];
}

export interface AiComicSeriesBiblePatternRow {
  pattern_id: NarrativePatternId;
  label: string;
  core_promise: string;
  required_signals: string[];
}

export interface AiComicSeriesBibleEpisodeStatusRow {
  episode_no: number;
  title: string;
  status: 'generated' | 'planned';
  story_id?: string;
  quality_status?: AiComicSeriesQualityEpisodeStatus;
  needs_episode_regeneration?: boolean;
  needs_ledger_rebuild?: boolean;
  attention_reasons: string[];
}

export interface AiComicSeriesBibleProductionTables {
  characters: AiComicSeriesBibleCharacterRow[];
  locations: AiComicSeriesBibleLocationRow[];
  threads: AiComicSeriesBibleThreadRow[];
  knowledge_boundaries: AiComicSeriesBibleKnowledgeBoundaryRow[];
  series_memory: AiComicSeriesBibleMemoryRow[];
  production_constraints: AiComicSeriesBibleProductionConstraintRow[];
  episodic_memory: AiComicSeriesBibleEpisodicMemoryRow[];
  narrative_patterns: AiComicSeriesBiblePatternRow[];
  episode_status: AiComicSeriesBibleEpisodeStatusRow[];
}

export interface AiComicSeriesBibleExportPackage {
  schema_version: 'ai-comic-series-bible-export/v1';
  exported_at: string;
  project: AiComicSeriesProjectMeta;
  plan: AiComicSeriesPlan;
  generated_episode_story_ids: Record<string, string>;
  continuity_ledger: AiComicContinuityLedger;
  series_quality_audit?: AiComicSeriesQualityAudit;
  episode_blueprints: AiComicEpisodeBlueprint[];
  production_tables: AiComicSeriesBibleProductionTables;
  markdown: string;
}

export interface AiComicEpisodeContextPreviewRequest {
  series_plan: AiComicSeriesPlan;
  episode_no: number;
  series_project_id?: string;
  narrative_pattern_ids?: NarrativePatternId[];
  memory_recall_controls?: AiComicSeriesMemoryRecallControls;
}

export interface AiComicEpisodeContextPreview {
  schema_version: 'ai-comic-episode-context-preview/v1';
  series_project_id?: string;
  episode_no: number;
  title: string;
  used_saved_ledger: boolean;
  blueprint: AiComicEpisodeBlueprint;
  narrative_patterns: string[];
  generation_outline: string;
  focused_memory_recall?: AiComicSeriesMemoryRecall;
  focused_episodic_memory_recall?: AiComicEpisodicMemoryRecall;
  ledger_summary: {
    last_generated_episode_no?: number;
    character_state_current: string[];
    open_threads: string[];
    paid_off_threads: string[];
    knowledge_used: string[];
    series_memory?: {
      characters: string[];
      relationships: string[];
      props: string[];
      locations: string[];
      visual_assets: string[];
      knowledge_boundaries: string[];
      story_events: string[];
      conflicts: string[];
    };
    production_constraints?: {
      active_count: number;
      must_count: number;
      needs_review_count: number;
      recent: string[];
      conflicts: string[];
    };
    memory_conflicts?: {
      total_conflict_count: number;
      blocking_count: number;
      warning_count: number;
      watch_count: number;
      recent: string[];
    };
    episodic_memory?: {
      total_count: number;
      recent: string[];
    };
  };
  previous_episode_memory: string[];
  next_episode_requirement?: string;
}

export interface AiComicSeriesProjectSaveRequest {
  series_project_id?: string;
  plan: AiComicSeriesPlan;
  generated_episode_story_ids?: Record<string, string>;
  continuity_ledger?: AiComicContinuityLedger;
  memory_recall_preferences?: AiComicSeriesMemoryRecallPreferences;
}

export interface AiComicSeriesProjectCopyRequest {
  title?: string;
}

export interface AiComicSeriesProjectArchiveRequest {
  archived?: boolean;
}

export interface AiComicSeriesProjectDeleteResult {
  series_project_id: string;
  deleted: true;
}

export interface AiComicSeriesLedgerRebuildRequest {
  from_episode_no?: number;
}

export interface AiComicEpisodeGenerateRequest {
  series_plan: AiComicSeriesPlan;
  episode_no: number;
  series_project_id?: string;
  model_profile_id?: string;
  output_gears_segments?: boolean;
  knowledge_pack?: KnowledgePack;
  narrative_pattern_ids?: NarrativePatternId[];
  memory_recall_controls?: AiComicSeriesMemoryRecallControls;
  auto_audit_continuity?: boolean;
  auto_repair_episode?: boolean;
}

export interface StoryQualityReport {
  hasCentralEvent: boolean;
  hasConflict: boolean;
  hasProtagonistChoice: boolean;
  hasSceneAction: boolean;
  hasClimax: boolean;
  hasEndingTheme: boolean;
  isNotBiographySummary: boolean;
  passed: boolean;
  issues: string[];
  video_type?: VideoType;
  story_structure?: StoryStructureType;
  truth_mode?: TruthMode;
  material_sufficiency_report?: MaterialSufficiencyReport;
  genre_score?: number;
  missing_required_elements?: string[];
  weak_beats?: string[];
  forbidden_patterns_found?: string[];
  repair_actions?: string[];
  outline_coverage_report?: OutlineCoverageReport;
  pattern_quality_report?: PatternQualityReport;
  gears_readiness_report?: GearsReadinessReport;
  production_material_readiness_report?: ProductionMaterialQualityReport;
  audience_text_report?: AudienceTextReport;
  repair_action_items?: QualityRepairAction[];
  repair_preview?: string;
}

export type QualitySignalStatus = 'satisfied' | 'weak' | 'missing';

export interface OutlineCoverageNode {
  node_id: string;
  order: number;
  text: string;
  status: 'covered' | 'partial' | 'missing';
  matched_scene_ids: number[];
  evidence: string[];
  repair_hint: string;
}

export interface OutlineCoverageReport {
  schema_version: 'outline-coverage/v1';
  coverage_score: number;
  total_nodes: number;
  covered_nodes: number;
  partial_nodes: number;
  missing_nodes: number;
  nodes: OutlineCoverageNode[];
  drift_items: string[];
  unauthorized_events: string[];
  repair_prompt: string;
  preview: string;
}

export interface PatternQualitySignal {
  signal_id: string;
  label: string;
  status: QualitySignalStatus;
  source: 'required_field' | 'genre_beat' | 'narrative_pattern' | 'sample_signal' | 'genre_rule';
  impact: string;
  gap: string;
  suggested_scene_ids: number[];
  repair_hint: string;
}

export interface PatternQualityReport {
  schema_version: 'pattern-quality/v1';
  pattern_score: number;
  satisfied_signals: PatternQualitySignal[];
  weak_signals: PatternQualitySignal[];
  gaps: string[];
  repair_prompt: string;
  preview: string;
}

export interface GearsReadinessReport {
  schema_version: 'gears-readiness/v1';
  readiness_score: number;
  ready: boolean;
  satisfied_items: string[];
  issue_items: string[];
  asset_gaps: string[];
  unit_gaps: string[];
  prompt_gaps: string[];
  repair_prompt: string;
  preview: string;
}

export interface ProductionMaterialQualityReport {
  schema_version: 'production-material-quality/v1';
  status: ProductionMaterialReadinessStatus;
  score: number;
  passed: boolean;
  pack_label: string;
  video_type: VideoType;
  missing_blocking_fields: ProductionMaterialMissingField[];
  missing_risk_fields: ProductionMaterialMissingField[];
  missing_optional_fields: ProductionMaterialMissingField[];
  gate_statuses: Array<{
    stage: MaterialSufficiencyStage;
    status: ProductionMaterialReadinessStatus;
    missing_count: number;
  }>;
  recommended_next_questions: string[];
  repair_prompt: string;
  preview: string;
}

export type AudienceTextField =
  | 'full_text'
  | 'theme'
  | 'logline'
  | 'scene_plot'
  | 'scene_dialogue_or_narration'
  | 'gears_script_text'
  | 'gears_segment_prompt_hint';

export interface AudienceTextIssue {
  issue_id: string;
  field: AudienceTextField;
  label: string;
  scene_id?: number;
  segment_id?: number;
  matched_terms: string[];
  excerpt: string;
  repair_hint: string;
}

export interface AudienceTextReport {
  schema_version: 'audience-text/v1';
  clean: boolean;
  issue_count: number;
  issue_items: AudienceTextIssue[];
  polluted_terms: string[];
  repair_prompt: string;
  preview: string;
}

export interface QualityRepairAction {
  action_id: string;
  label: string;
  target_report: 'outline' | 'pattern' | 'gears' | 'production_material' | 'audience' | 'combined';
  severity: 'low' | 'medium' | 'high';
  scene_ids: number[];
  prompt: string;
  expected_effect: string;
}

export interface StoryQualityRepairRequest {
  model_profile_id?: string;
  genre_strictness?: GenreStrictness;
  target_report?: QualityRepairAction['target_report'];
  repair_action_id?: string;
}

export interface StoryQualityRepairPromptRequest extends StoryQualityRepairRequest {
  user_instruction?: string;
  include_story_json?: boolean;
  include_markdown?: boolean;
  max_actions?: number;
}

export interface StoryQualityRepairPromptResult {
  schema_version: 'story-quality-repair-prompt/v1';
  project_id: string;
  story_id: string;
  title: string;
  generated_at: string;
  quality_snapshot: {
    video_type: VideoType;
    story_structure?: StoryStructureType;
    passed: boolean;
    genre_score?: number;
    issue_count: number;
  };
  repair_actions: QualityRepairAction[];
  source_issues: string[];
  target_scene_ids: number[];
  protected_fields: string[];
  output_contract: {
    format: 'json';
    root_type: 'StoryGenerateResult';
    required_top_level_fields: string[];
    validation_hint: string;
    apply_hint: string;
  };
  creation_contract?: CreationContract;
  material_sufficiency?: MaterialSufficiencyReport;
  prompt: string;
  original_story_json?: string;
  markdown?: string;
}

export interface StoryQualityRepairApplyRequest {
  repaired_story_json: string;
  user_instruction?: string;
  apply?: boolean;
  allow_no_improvement?: boolean;
}

export interface StoryQualityRepairSceneChange {
  scene_id: number;
  title?: string;
  changed_fields: string[];
  before_preview: string;
  after_preview: string;
}

export interface StoryQualityRepairChangeSummary {
  has_content_changes: boolean;
  changed_top_level_fields: string[];
  scene_changes: StoryQualityRepairSceneChange[];
  changed_gears_segment_ids: number[];
  protected_fields_preserved: string[];
  ignored_protected_field_changes: string[];
  quality_issue_delta: {
    resolved_issues: string[];
    new_issues: string[];
    remaining_issues: string[];
  };
  quality_delta: {
    passed_changed: boolean;
    genre_score_delta?: number;
    issue_count_delta: number;
  };
  summary_lines: string[];
}

export interface StoryQualityRepairApplyResult {
  schema_version: 'story-quality-repair-apply/v1';
  project_id: string;
  story_id: string;
  applied: boolean;
  can_apply: boolean;
  rejected_reason?: string;
  changed_scene_ids: number[];
  before_quality: {
    passed: boolean;
    genre_score?: number;
    issue_count: number;
  };
  after_quality: {
    passed: boolean;
    genre_score?: number;
    issue_count: number;
  };
  change_summary: StoryQualityRepairChangeSummary;
  operator_hints: string[];
  validation_summary_markdown: string;
  repair_trace: StoryRepairTrace;
  detail?: StoryProjectDetail;
}

export type EvidenceBoundaryType = 'verified' | 'uncertain' | 'creative_treatment';

export interface EvidenceBoundary {
  boundary_id: string;
  label: string;
  type: EvidenceBoundaryType;
  source: string;
  note: string;
}

export interface StoryGenreBeat {
  beat_id: string;
  order: number;
  function_label: string;
  function_description: string;
  scene_id?: number;
  content_requirement: string;
  emotional_turn?: string;
  evidence_boundary_ids: string[];
}

export interface StoryCharacterArcPlan {
  character_name: string;
  starting_state: string;
  pressure: string;
  turning_point: string;
  ending_state: string;
}

export interface StoryBlueprint {
  schema_version: 'story-blueprint/v1';
  storyId?: string;
  entry_name: string;
  source_entry: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure: StoryStructureType;
  target_duration: SupportedDuration;
  central_event?: string;
  central_question: string;
  protagonist?: string;
  genre_beats: StoryGenreBeat[];
  character_arcs: StoryCharacterArcPlan[];
  evidence_boundaries: EvidenceBoundary[];
  type_specific_requirements: string[];
  creation_contract?: CreationContract;
  material_sufficiency?: MaterialSufficiencyReport;
}

export interface GenreQualityReport extends StoryQualityReport {
  video_type: VideoType;
  story_structure?: StoryStructureType;
  genre_score: number;
  missing_required_elements: string[];
  weak_beats: string[];
  forbidden_patterns_found: string[];
  repair_actions: string[];
}

export interface StoryRepairTrace {
  trace_id: string;
  attempted: boolean;
  applied: boolean;
  reason: string;
  model_profile_id?: string;
  before_genre_score?: number;
  after_genre_score?: number;
  actions: string[];
}

// ---------------------------------------------------------------------------
// Creative reference trace — provenance for style pack influence
// ---------------------------------------------------------------------------

export interface ReferenceTrace {
  style_pack_id?: string;
  applied_rules: string[];
  source_story_structure: StoryStructureType;
}

// ---------------------------------------------------------------------------
// Story generate result (full output)
// ---------------------------------------------------------------------------

export interface StoryGenerateResult {
  storyId: string;
  project_id?: string;
  current_version_id?: string;
  model_profile_id?: string;
  generation_source?: string;
  generation_mode?: GenerationMode;
  generation_used_fallback?: boolean;
  title: string;
  generation_type: GenerationType;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  source_entry: string;
  original_user_query?: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: StoryScene[];
  gears_segments: GearsSegment[];
  gears_segments_url: string;
  gears_delivery?: GearsDeliveryPackage;
  cultural_constraints: string[];
  credibility_note: string;
  // New fields for multi-knowledge matching
  knowledge_pack?: KnowledgePack;
  material_pack?: MaterialPack;
  creation_use_case?: CreationUseCase;
  truth_mode?: TruthMode;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
  creation_contract?: CreationContract;
  material_sufficiency?: MaterialSufficiencyReport;
  production_material_pack?: ProductionMaterialPack;
  production_material_readiness?: ProductionMaterialReadinessReport;
  adaptation_analysis?: StoryAdaptationAnalysis;
  supplement_tasks?: KnowledgeSupplementTask[];
  quality_report?: StoryQualityReport | GenreQualityReport;
  gears_webhook?: GearsWebhookStatus;
  gears_video?: GearsVideoResult;
  ai_comic_episode_blueprint?: AiComicEpisodeBlueprint;
  ai_comic_episode_quality?: AiComicEpisodeQualityReport;
  continuity_audit?: AiComicSeriesContinuityAudit;
  // New fields for story structure and creative reference (Phase 5)
  story_structure?: StoryStructureType;
  story_blueprint?: StoryBlueprint;
  reference_trace?: ReferenceTrace[];
  repair_trace?: StoryRepairTrace[];
  production_board_repair_trace?: StoryProductionBoardRepairTrace[];
  memory_mosaic_seed?: MemoryMosaicStorySeed;
  // Type-specific optional fields — character_story / historical_drama / legend_story
  characters?: StoryCharacter[];
  act_structure?: ActBeat[];
  protagonist_arc?: ProtagonistArc[];
  // Type-specific optional fields — culture_promo / heritage_promo / city_brand_promo
  visual_symbols?: string[];
  craft_or_ritual_process?: string;
  modern_connection?: string;
  core_message?: string;
  slogan_or_key_sentence?: string;
  // Type-specific optional fields — scene_short / landscape_mood
  spatial_identity?: string;
  visual_route?: string[];
  time_layer?: string;
  atmosphere?: string;
  // Type-specific optional fields — ai_comic_drama
  dialogue?: Array<{ scene_id: number; lines: Array<{ character: string; text: string; emotion: string }> }>;
  // Type-specific optional fields — explainer_video / lecture_video
  argument_points?: string[];
  knowledge_outline?: string[];
  // Type-specific optional fields — documentary_short
  source_quotes?: string[];
  field_notes?: string[];
}

// ---------------------------------------------------------------------------
// Entry search & detail
// ---------------------------------------------------------------------------

export interface EntrySearchResult {
  name: string;
  province: string;
  region: string;
  type: string;
  summary: string;
  keywords: string[];
  credibility: string;
  knowledge_domain?: KnowledgeDomain;
  entry_role?: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
  asset_split?: KnowledgeAssetSplit;
  matched_snippets?: string[];
  match_reason?: string;
}

// ---------------------------------------------------------------------------
// Entry match result (smart topic matching)
// ---------------------------------------------------------------------------

export interface EntryMatchItem {
  entry_name: string;
  province: string;
  type: string;
  score: number;
  match_reason: string;
  usable_for_story: boolean;
}

export interface EntryMatchResult {
  query: string;
  matches: EntryMatchItem[];
  best_match: EntryMatchItem | null;
  fallback_message: string | null;
}

export interface EntryDetail {
  name: string;
  province: string;
  region: string;
  type: string;
  summary: string;
  story: string;
  culturalSignificance: string;
  relatedLocations: Array<{ name: string; description: string }>;
  localCreativeRelations?: LocalCreativeRelation[];
  keywords: string[];
  sources: string[];
  credibility: string;
  verificationMethod?: string;
  unverifiedPoints: string[];
  knowledge_domain?: KnowledgeDomain;
  entry_role?: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
  asset_split?: KnowledgeAssetSplit;
}

export type LocalRelationType =
  | 'direct_region'
  | 'related_location'
  | 'cultural_influence'
  | 'contemporary_adaptation'
  | 'do_not_write_as'
  | 'same_province'
  | 'keyword_context';

export interface LocalCreativeRelation {
  relation_type: LocalRelationType;
  target: string;
  description: string;
}

export interface KnowledgeAssetSplit {
  characters: string[];
  scenes: string[];
  character_props: string[];
  scene_props: string[];
}

export type KnowledgeDomain =
  | 'core_china_culture'
  | 'era_setting'
  | 'regional_culture'
  | 'folklore_zhiyi'
  | 'gears_asset'
  | 'narrative_pattern'
  | 'character_archetype'
  | 'conflict_pattern'
  | 'visual_style_pack'
  | 'safety_rule'
  | 'source_pack';

export type KnowledgeEntryRole =
  | 'core_entry'
  | 'setting_pack'
  | 'motif_pack'
  | 'asset_pack'
  | 'regional_pack'
  | 'pattern_pack'
  | 'archetype_pack'
  | 'conflict_pack'
  | 'style_pack'
  | 'rule_pack'
  | 'source_pack';

export type KnowledgeAssetUsage =
  | 'character_clothing'
  | 'character_props'
  | 'scene_space'
  | 'scene_props'
  | 'story_motif'
  | 'dialogue_tone'
  | 'credibility_boundary'
  | 'gears_delivery'
  | 'plot_structure'
  | 'character_arc'
  | 'conflict_engine'
  | 'visual_style'
  | 'safety_boundary'
  | 'source_grounding';

// ---------------------------------------------------------------------------
// System info
// ---------------------------------------------------------------------------

export interface ProvinceInfo {
  name: string;
  entry_count: number;
}

export type AIModelCapability = 'story_generation' | 'scene_regeneration';

export interface AIModelProfile {
  id: string;
  label: string;
  description: string;
  runtime: 'claude' | 'codex';
  model: string;
  recommended?: boolean;
  capabilities: AIModelCapability[];
}

export interface SeedanceProviderAdapterConfigInfo {
  provider: 'seedance';
  submit_endpoint_configured: boolean;
  poll_endpoint_configured: boolean;
  submit_token_configured: boolean;
  poll_token_configured: boolean;
  shared_token_configured: boolean;
  submit_signature_configured: boolean;
  poll_signature_configured: boolean;
  callback_secret_configured: boolean;
  callback_base_configured: boolean;
  callback_base_envs: string[];
  submit_request_mode: SeedanceProviderSubmitRequestMode;
  poll_request_mode: SeedanceProviderPollRequestMode;
  request_mode_envs: string[];
  submit_payload_mode: SeedanceProviderAdapterPayloadMode;
  poll_payload_mode: SeedanceProviderAdapterPayloadMode;
  payload_mode_envs: string[];
  poll_http_method: SeedanceProviderPollHttpMethod;
  poll_http_method_env: string;
  submit_auth_header: string;
  poll_auth_header: string;
  submit_auth_scheme: string;
  poll_auth_scheme: string;
  submit_signature_header: string;
  poll_signature_header: string;
  submit_timestamp_header: string;
  poll_timestamp_header: string;
  submit_timeout_ms: number;
  poll_timeout_ms: number;
  ready_for_submit_adapter: boolean;
  ready_for_poll_adapter: boolean;
  missing_submit_requirements: string[];
  missing_poll_requirements: string[];
  configuration_warnings: string[];
  next_actions: string[];
  generated_at: string;
}

export interface SeedanceProviderAdapterContractSection {
  schema_version: string;
  endpoint_env: string;
  auth_envs: string[];
  auth_header_envs: string[];
  auth_scheme_envs: string[];
  default_auth_header: string;
  default_auth_scheme: string;
  timeout_env: string;
  request_mode_env: string;
  request_modes: string[];
  payload_mode_env?: string;
  payload_modes?: string[];
  signature_envs?: string[];
  signature_header_envs?: string[];
  timestamp_header_envs?: string[];
  default_signature_header?: string;
  default_timestamp_header?: string;
  signature_base?: string;
  platform_field_envs?: string[];
  http_method_env?: string;
  http_methods?: string[];
  endpoint_template_fields?: string[];
  request_fields: string[];
  accepted_response_shapes: string[];
  normalized_result_fields: string[];
  request_example: Record<string, unknown>;
  response_examples: Array<Record<string, unknown>>;
  notes: string[];
}

export interface SeedanceProviderAdapterContractInfo {
  provider: 'seedance';
  callback_auth_env: string;
  callback_auth_headers: string[];
  submit: SeedanceProviderAdapterContractSection;
  poll: SeedanceProviderAdapterContractSection;
  generated_at: string;
}

export interface TypeInfo {
  name: string;
  recommended_generation_types: GenerationType[];
  recommended_video_types: VideoType[];
  recommended_presentation_styles: PresentationStyle[];
  description: string;
}
