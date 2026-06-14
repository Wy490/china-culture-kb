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
    id: 'ai_comic_drama', group: '剧情故事类', label: 'AI 漫剧',
    description: '漫画风格分镜叙事，含对白和表情标注', default_presentation_style: 'ai_comic',
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
  character_hints?: StoryDetectedCharacter[];
  // New fields for story structure and creative reference (Phase 5)
  story_structure?: StoryStructureType;
  creative_reference_ids?: string[];
  style_pack_ids?: string[];
  reference_strength?: ReferenceStrength;
  genre_strictness?: GenreStrictness;
  auto_repair?: boolean;
  story_priority?: StoryGenerationPriority;
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

export type StoryProjectVersionChangeType = 'initial_generation' | 'scene_regeneration';

export interface StoryProjectVersionSummary {
  version_id: string;
  created_at: string;
  change_type: StoryProjectVersionChangeType;
  scene_ids_changed: number[];
  note?: string;
  quality_passed?: boolean;
  genre_score?: number;
  quality_issue_count?: number;
}

export interface StoryProjectMeta extends StoryProjectListItem {
  created_at: string;
  current_version_id: string;
  version_count: number;
}

export interface StoryProjectVersionSnapshot {
  project_id: string;
  version_id: string;
  created_at: string;
  change_type: StoryProjectVersionChangeType;
  scene_ids_changed: number[];
  note?: string;
  quality_report?: StoryQualityReport | GenreQualityReport;
  story: StoryGenerateResult;
}

export interface StoryProjectDetail {
  project: StoryProjectMeta;
  current_story: StoryGenerateResult;
  versions: StoryProjectVersionSummary[];
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

export interface ProjectSupplementTaskListItem {
  project_id: string;
  current_story_id: string;
  project_title: string;
  source_entry: string;
  video_type: VideoType;
  updated_at: string;
  task: KnowledgeSupplementTask;
}

export interface StoryProjectDeleteResult {
  project_id: string;
  story_id: string;
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

export interface GearsDeliveryPackage {
  schema_version: string;
  storyId: string;
  title: string;
  character_assets: GearsCharacterAsset[];
  character_gender_summary: GearsCharacterGenderSummary;
  scene_assets: GearsSceneAsset[];
  units: GearsDeliveryUnit[];
  markdown: string;
  validation_notes: string[];
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

export type KnowledgeSupplementTaskStatus = 'open' | 'resolved';
export type KnowledgeSupplementTaskSource = 'knowledge_pack_missing_need';
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
  recommended_fields?: string[];
  intake_prompt?: string;
  status: KnowledgeSupplementTaskStatus;
  source: KnowledgeSupplementTaskSource;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  supplement_note?: string;
}

export interface KnowledgeSupplementTaskUpdateRequest {
  status: KnowledgeSupplementTaskStatus;
  supplement_note?: string;
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
}

export interface AiComicContinuityLedger {
  schema_version: 'ai-comic-continuity-ledger/v1';
  last_generated_episode_no?: number;
  character_state_current: string[];
  open_threads: string[];
  paid_off_threads: string[];
  knowledge_used: string[];
  episode_records: AiComicContinuityLedgerEpisode[];
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
}

export interface AiComicSeriesProjectDetail {
  project: AiComicSeriesProjectMeta;
  plan: AiComicSeriesPlan;
  generated_episode_story_ids: Record<string, string>;
  continuity_ledger: AiComicContinuityLedger;
  series_quality_audit?: AiComicSeriesQualityAudit;
}

export interface AiComicSeriesProjectSaveRequest {
  series_project_id?: string;
  plan: AiComicSeriesPlan;
  generated_episode_story_ids?: Record<string, string>;
  continuity_ledger?: AiComicContinuityLedger;
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
  genre_score?: number;
  missing_required_elements?: string[];
  weak_beats?: string[];
  forbidden_patterns_found?: string[];
  repair_actions?: string[];
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
  | 'gears_asset';

export type KnowledgeEntryRole =
  | 'core_entry'
  | 'setting_pack'
  | 'motif_pack'
  | 'asset_pack'
  | 'regional_pack';

export type KnowledgeAssetUsage =
  | 'character_clothing'
  | 'character_props'
  | 'scene_space'
  | 'scene_props'
  | 'story_motif'
  | 'dialogue_tone'
  | 'credibility_boundary'
  | 'gears_delivery';

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

export interface TypeInfo {
  name: string;
  recommended_generation_types: GenerationType[];
  recommended_video_types: VideoType[];
  recommended_presentation_styles: PresentationStyle[];
  description: string;
}
