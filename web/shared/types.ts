// web/shared/types.ts — Web API type definitions (independent, NOT reusing MCP types)

import type {
  BaseEntry,
  BaseGearsSegment,
  BaseStory,
  BaseStoryScene,
  DomainEntryTypeDescriptor,
  DomainGenerationTypeDescriptor,
} from './platform-types.js';

export type {
  BaseEntry,
  BaseGearsSegment,
  BaseStory,
  BaseStoryScene,
  DomainEntryTypeDescriptor,
  DomainGenerationTypeDescriptor,
} from './platform-types.js';

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

export interface VideoTypeMeta extends DomainGenerationTypeDescriptor {
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
// Reference Intelligence — source, evidence, rights, and analysis audit
// ---------------------------------------------------------------------------

export type ReferenceSourceMediaType =
  | 'film'
  | 'episode'
  | 'promo'
  | 'novel'
  | 'screenplay'
  | 'tutorial';

export type ReferenceRightsStatus =
  | 'user_owned'
  | 'licensed'
  | 'public_domain'
  | 'research_only'
  | 'unknown';

export type ReferenceAccessScope =
  | 'metadata_only'
  | 'excerpt'
  | 'full_user_supplied';

export interface ReferenceSourceRecord {
  schema_version: 'reference-source-record/v1';
  reference_id: string;
  title: string;
  media_type: ReferenceSourceMediaType;
  source_url?: string;
  platform?: string;
  creator?: string;
  accessed_at: string;
  rights_status: ReferenceRightsStatus;
  access_scope: ReferenceAccessScope;
  content_fingerprint?: string;
  user_reason: string;
  created_at: string;
  updated_at: string;
}

export type ReferenceTextMaterialContentType =
  | 'text/plain'
  | 'text/markdown';

export interface ReferenceTextMaterialAuthorization {
  basis: Extract<
    ReferenceRightsStatus,
    'user_owned' | 'licensed' | 'public_domain'
  >;
  authorization_reference: string;
  attested_by: string;
  attested_at: string;
  confirmation: 'authorized_reference_text_ingest';
  machine_verified: false;
}

export interface ReferenceTextMaterialRecord {
  schema_version: 'reference-text-material/v1';
  material_id: string;
  reference_id: string;
  source_content_fingerprint: string;
  content_sha256: string;
  content_type: ReferenceTextMaterialContentType;
  byte_length: number;
  character_count: number;
  line_count: number;
  authorization: ReferenceTextMaterialAuthorization;
  created_at: string;
  governance: {
    source_material_transport: 'stored_user_supplied';
    server_download_allowed: false;
    prompt_injection_allowed: false;
    knowledge_writeback_allowed: false;
    production_credit_eligible: false;
  };
  human_review_complete: false;
  production_credit_granted: false;
}

export type ReferenceTextMaterialStatus =
  | {
      available: false;
      material: null;
    }
  | {
      available: true;
      material: ReferenceTextMaterialRecord;
    };

export interface ReferenceTextMaterialChunkDescriptor {
  chunk_id: string;
  index: number;
  locator: string;
  start_character: number;
  end_character: number;
  character_count: number;
  byte_length: number;
  content_sha256: string;
}

export interface ReferenceTextMaterialManifest {
  schema_version: 'reference-text-material-manifest/v1';
  material_id: string;
  reference_id: string;
  source_content_fingerprint: string;
  content_type: ReferenceTextMaterialContentType;
  byte_length: number;
  character_count: number;
  line_count: number;
  chunk_character_limit: 12000;
  chunk_count: number;
  chunks: ReferenceTextMaterialChunkDescriptor[];
  chunk_endpoint_template: string;
  content_included: false;
  prompt_injection_allowed: false;
  knowledge_writeback_allowed: false;
  human_review_complete: false;
  production_credit_granted: false;
}

export interface ReferenceTextMaterialChunk
  extends ReferenceTextMaterialChunkDescriptor {
  schema_version: 'reference-text-material-chunk/v1';
  material_id: string;
  reference_id: string;
  source_content_fingerprint: string;
  text: string;
  prompt_injection_allowed: false;
  knowledge_writeback_allowed: false;
  human_review_complete: false;
  production_credit_granted: false;
}

export type ReferencePrivateVideoMediaType = Extract<
  ReferenceSourceMediaType,
  'film' | 'episode' | 'promo' | 'tutorial'
>;

export interface ReferencePrivateVideoAuthorization {
  basis: Extract<
    ReferenceRightsStatus,
    'user_owned' | 'licensed' | 'public_domain'
  >;
  authorization_reference: string;
  attested_by: string;
  attested_at: string;
  confirmation: 'authorized_private_video_ingest';
  machine_verified: false;
}

export interface ReferencePrivateVideoSourceArtifact {
  original_filename: string;
  stored_private_relative_path: string;
  content_sha256: string;
  byte_length: number;
}

export interface ReferencePrivateVideoStreamSummary {
  codec_type: 'video' | 'audio';
  codec_name?: string;
  width?: number;
  height?: number;
  sample_rate?: number;
  channels?: number;
  duration_seconds?: number;
  avg_frame_rate?: string;
}

export type ReferencePrivateVideoProbeReport =
  | {
      status: 'ready';
      command: string;
      raw_json_private_relative_path: string;
      raw_json_sha256: string;
      format_name?: string;
      duration_seconds?: number;
      bit_rate?: number;
      video_streams: ReferencePrivateVideoStreamSummary[];
      audio_streams: ReferencePrivateVideoStreamSummary[];
    }
  | {
      status: 'blocked';
      command: string;
      blocked_reason: string;
      video_streams: [];
      audio_streams: [];
    };

export type ReferencePrivateVideoDerivedArtifact =
  | {
      status: 'ready';
      kind: 'thumbnail_jpeg' | 'audio_wav_16khz_mono';
      command: string;
      private_relative_path: string;
      content_sha256: string;
      byte_length: number;
    }
  | {
      status: 'blocked';
      kind: 'thumbnail_jpeg' | 'audio_wav_16khz_mono';
      command: string;
      blocked_reason: string;
    }
  | {
      status: 'not_requested';
      kind: 'thumbnail_jpeg' | 'audio_wav_16khz_mono';
    };

export type ReferencePrivateVideoTranscriptStatus =
  | {
      status: 'not_submitted';
    }
  | {
      status: 'ready';
      transcript_id: string;
      transcript_format: 'text/plain' | 'text/srt' | 'text/vtt';
      content_sha256: string;
      byte_length: number;
      character_count: number;
      line_count: number;
      private_relative_path: string;
      transcribed_by: string;
      transcribed_at: string;
      method: 'local_manual' | 'local_model';
      tool_name?: string;
      tool_version?: string;
      local_transcription_performed: true;
      external_model_call_performed: false;
      third_party_upload_performed: false;
    };

export interface ReferencePrivateVideoGovernanceBoundary
  extends ReferenceGovernanceBoundary {
  local_private_mode: true;
  source_video_in_git: false;
  source_path_persisted: false;
  server_download_allowed: false;
  third_party_upload_allowed: false;
  external_model_call_performed: false;
  ffprobe_allowed: true;
  ffmpeg_allowed: true;
  local_transcription_allowed: true;
  prompt_injection_allowed: false;
  human_review_complete: false;
  production_credit_granted: false;
}

export interface ReferencePrivateVideoSampleRecord {
  schema_version: 'reference-private-video-sample/v1';
  sample_id: string;
  title: string;
  media_type: ReferencePrivateVideoMediaType;
  rights_status: Extract<
    ReferenceRightsStatus,
    'user_owned' | 'licensed' | 'public_domain'
  >;
  access_scope: Extract<ReferenceAccessScope, 'excerpt' | 'full_user_supplied'>;
  user_reason: string;
  source_video: ReferencePrivateVideoSourceArtifact;
  authorization: ReferencePrivateVideoAuthorization;
  ffprobe: ReferencePrivateVideoProbeReport;
  ffmpeg_derivatives: {
    thumbnail: ReferencePrivateVideoDerivedArtifact;
    audio_wav: ReferencePrivateVideoDerivedArtifact;
  };
  transcript: ReferencePrivateVideoTranscriptStatus;
  governance: ReferencePrivateVideoGovernanceBoundary;
  created_at: string;
  updated_at: string;
}

export interface ReferencePrivateVideoSampleIngestResult {
  sample: ReferencePrivateVideoSampleRecord;
  idempotent_replay: boolean;
}

export interface ReferencePrivateVideoTranscriptSubmissionResult {
  sample: ReferencePrivateVideoSampleRecord;
  idempotent_replay: boolean;
}

export type ReferenceSimilarityDimension =
  | 'excerpt'
  | 'character_design'
  | 'plot_structure'
  | 'shot_sequence';

export interface ReferenceSimilarityMarkerObservation {
  observation_id: string;
  distinctive_markers: string[];
}

export interface ReferenceSimilarityEvidenceObservations {
  excerpts: Array<{
    observation_id: string;
    source_locator: string;
    text: string;
  }>;
  character_profiles: Array<ReferenceSimilarityMarkerObservation & {
    label: string;
  }>;
  plot_beats: Array<ReferenceSimilarityMarkerObservation & {
    order: number;
  }>;
  shot_sequence: Array<ReferenceSimilarityMarkerObservation & {
    order: number;
  }>;
}

export interface ReferenceSimilarityAuthorization {
  basis: Extract<
    ReferenceRightsStatus,
    'user_owned' | 'licensed' | 'public_domain'
  >;
  authorization_reference: string;
  attested_by: string;
  attested_at: string;
  confirmation: 'authorized_similarity_analysis_only';
  machine_verified: false;
}

export interface ReferenceSimilarityEvidenceRecord {
  schema_version: 'reference-similarity-evidence/v1';
  evidence_id: string;
  analysis_task_id?: string;
  reference_id: string;
  source_content_fingerprint: string;
  input_provenance: 'operator_submitted' | 'fixture';
  authorization: ReferenceSimilarityAuthorization;
  observations: ReferenceSimilarityEvidenceObservations;
  payload_sha256: string;
  created_at: string;
  governance: ReferenceGovernanceBoundary & {
    prompt_injection_allowed: false;
  };
}

export type ReferenceAnalysisTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed';

export interface ReferenceAnalysisTaskRecord {
  schema_version:
    | 'reference-analysis-task/v1'
    | 'reference-analysis-task/v2';
  task_id: string;
  reference_id: string;
  source_snapshot: {
    title: string;
    media_type: ReferenceSourceMediaType;
    rights_status: Extract<
      ReferenceRightsStatus,
      'user_owned' | 'licensed' | 'public_domain'
    >;
    access_scope: Extract<
      ReferenceAccessScope,
      'excerpt' | 'full_user_supplied'
    >;
    content_fingerprint: string;
  };
  requested_dimensions: ReferenceSimilarityDimension[];
  authorization: ReferenceSimilarityAuthorization;
  status: ReferenceAnalysisTaskStatus;
  manifest: {
    executor: 'codex_or_operator';
    server_download_allowed: false;
    input_provenance: 'operator_submitted';
    output_schema: 'reference-similarity-evidence/v1';
    output_submission_endpoint: string;
    prompt_injection_allowed: false;
    knowledge_writeback_allowed: false;
  } & (
    | {
        source_material_transport: 'out_of_band_user_authorized';
        source_material_id?: never;
        source_material_manifest_endpoint?: never;
      }
    | {
        source_material_transport: 'stored_user_supplied';
        source_material_id: string;
        source_material_manifest_endpoint: string;
      }
  );
  submission_key_sha256: string | null;
  observations_sha256: string | null;
  evidence_id: string | null;
  evidence_payload_sha256: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  human_review_complete: false;
  real_credit_granted: false;
}

export interface ReferenceAnalysisTaskSubmissionResult {
  task: ReferenceAnalysisTaskRecord;
  evidence: ReferenceSimilarityEvidenceRecord;
  idempotent_replay: boolean;
}

export interface ReferenceTextAnalysisPartialObservations {
  excerpts: ReferenceSimilarityEvidenceObservations['excerpts'];
  character_profiles:
    ReferenceSimilarityEvidenceObservations['character_profiles'];
  plot_beats: ReferenceSimilarityEvidenceObservations['plot_beats'];
  shot_sequence: ReferenceSimilarityEvidenceObservations['shot_sequence'];
}

export interface ReferenceTextAnalysisExecutionCheckpoint {
  chunk_id: string;
  index: number;
  locator: string;
  content_sha256: string;
  status: 'pending' | 'completed';
  partial_observations_sha256: string | null;
  submission_key_sha256: string | null;
  completed_at: string | null;
}

export interface ReferenceTextAnalysisExecutionRecord {
  schema_version: 'reference-text-analysis-execution/v1';
  execution_id: string;
  task_id: string;
  reference_id: string;
  material_id: string;
  material_manifest_sha256: string;
  requested_dimensions: ReferenceSimilarityDimension[];
  executor: {
    kind: 'codex' | 'operator';
    executor_id: string;
  };
  status: 'pending' | 'in_progress' | 'ready_to_finalize' | 'completed';
  cursor: {
    completed_chunk_count: number;
    next_chunk_id: string | null;
  };
  checkpoints: ReferenceTextAnalysisExecutionCheckpoint[];
  manifest: {
    server_model_call_allowed: false;
    source_text_instruction_authority: 'none';
    prompt_injection_allowed: false;
    knowledge_writeback_allowed: false;
    automatic_approval_allowed: false;
    production_credit_eligible: false;
  };
  evidence_id: string | null;
  evidence_payload_sha256: string | null;
  final_observations_sha256: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  human_review_complete: false;
  production_credit_granted: false;
}

export interface ReferenceTextAnalysisPartialRecord {
  schema_version: 'reference-text-analysis-partial/v1';
  execution_id: string;
  task_id: string;
  material_id: string;
  chunk_id: string;
  chunk_content_sha256: string;
  submitted_by: string;
  submission_key_sha256: string;
  observations_sha256: string;
  observations: ReferenceTextAnalysisPartialObservations;
  created_at: string;
  prompt_injection_allowed: false;
  knowledge_writeback_allowed: false;
  human_review_complete: false;
  production_credit_granted: false;
}

export interface ReferenceTextAnalysisNextChunkResult {
  complete: boolean;
  execution_id: string;
  requested_dimensions: ReferenceSimilarityDimension[];
  source_text_instruction_authority: 'none';
  chunk: ReferenceTextMaterialChunk | null;
}

export interface ReferenceTextAnalysisChunkSubmissionResult {
  execution: ReferenceTextAnalysisExecutionRecord;
  checkpoint: ReferenceTextAnalysisExecutionCheckpoint;
  idempotent_replay: boolean;
}

export interface ReferenceTextAnalysisFinalizationResult
  extends ReferenceAnalysisTaskSubmissionResult {
  execution: ReferenceTextAnalysisExecutionRecord;
}

export type TextReferenceAnalysisField =
  | 'source_units'
  | 'character_wants'
  | 'scene_patterns'
  | 'must_keep'
  | 'compression_options'
  | 'adaptation_risks'
  | 'reusable_principles'
  | 'avoid_copying';

export interface ReferenceTextAnalysisSupplementNeed {
  field: TextReferenceAnalysisField;
  reason:
    | 'not_observed'
    | 'conflicting_observations'
    | 'insufficient_source_coverage';
  evidence_id: string;
  evidence_observation_ids: string[];
  required_input: 'bounded_source_observations';
}

export interface ReferenceTextAnalysisSupplementRequestAudit {
  request_submission_key_sha256: string;
  request_payload_sha256: string;
  requested_by: string;
  requested_at: string;
  needs: ReferenceTextAnalysisSupplementNeed[];
}

export interface ReferenceTextAnalysisDraftSupplementItem {
  field: TextReferenceAnalysisField;
  source_locators: string[];
  observation_summary: string;
  limitations: string[];
}

export interface ReferenceTextAnalysisDraftSupplementRecord {
  schema_version: 'reference-text-analysis-draft-supplement/v1';
  supplement_id: string;
  draft_task_id: string;
  reference_id: string;
  source_content_fingerprint: string;
  supplement_request_sha256: string;
  submission_key_sha256: string;
  submitted_by: string;
  items: ReferenceTextAnalysisDraftSupplementItem[];
  input_provenance: 'operator_submitted';
  machine_verified: false;
  payload_sha256: string;
  created_at: string;
  governance: {
    prompt_injection_allowed: false;
    knowledge_writeback_allowed: false;
    production_credit_eligible: false;
  };
}

export interface ReferenceTextAnalysisDraftTaskRecord {
  schema_version:
    | 'reference-text-analysis-draft-task/v1'
    | 'reference-text-analysis-draft-task/v2';
  draft_task_id: string;
  analysis_task_id: string;
  text_execution_id: string;
  reference_id: string;
  source_content_fingerprint: string;
  similarity_evidence_id: string;
  similarity_evidence_payload_sha256: string;
  final_observations_sha256: string;
  requested_dimensions: ReferenceSimilarityDimension[];
  executor: {
    kind: 'codex' | 'operator';
    executor_id: string;
  };
  status: 'pending' | 'needs_supplement' | 'processing' | 'completed';
  manifest: {
    evidence_endpoint: string;
    output_submission_endpoint: string;
    supplement_request_endpoint?: string;
    supplement_submission_endpoint?: string;
    supplement_endpoint?: string;
    server_model_call_allowed: false;
    source_text_instruction_authority: 'none';
    output_schema: 'reference-analysis-record/v2';
    output_approval_status: 'pending';
    automatic_approval_allowed: false;
    prompt_injection_allowed: false;
    knowledge_writeback_allowed: false;
    production_credit_eligible: false;
  };
  supplement_request?: ReferenceTextAnalysisSupplementRequestAudit | null;
  supplement_id?: string | null;
  supplement_payload_sha256?: string | null;
  supplement_responded_at?: string | null;
  submission_key_sha256: string | null;
  analysis_payload_sha256: string | null;
  submitted_at: string | null;
  analysis_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  human_review_complete: false;
  production_credit_granted: false;
}

export interface FilmReferenceSequenceBeat {
  start: string;
  end: string;
  function: string;
}

export interface FilmReferenceShotObservation {
  timecode: string;
  framing?: string;
  camera_motion?: string;
  blocking?: string;
  lighting?: string;
  audio_function?: string;
  evidence_note: string;
}

export interface FilmReferenceAnalysis {
  hook_timecode?: string;
  central_question?: string;
  sequence_beats: FilmReferenceSequenceBeat[];
  shot_observations: FilmReferenceShotObservation[];
  continuity_methods: string[];
  reusable_principles: string[];
  avoid_copying: string[];
}

export interface TextReferenceSourceUnit {
  source_unit_id: string;
  summary: string;
}

export interface TextReferenceScenePattern {
  objective: string;
  opposition: string;
  turn: string;
  visible_action: string;
  subtext?: string;
}

export interface TextReferenceAnalysis {
  source_units: TextReferenceSourceUnit[];
  character_wants: string[];
  scene_patterns: TextReferenceScenePattern[];
  must_keep: string[];
  compression_options: string[];
  adaptation_risks: string[];
  reusable_principles: string[];
  avoid_copying: string[];
}

export type ReferenceAnalysisApproval =
  | { status: 'pending' }
  | { status: 'approved'; approved_by: string; approved_at: string };

export interface ReferenceAnalysisApprovalRequest {
  approved_by: string;
  approved_at: string;
  confirmation: 'human_reviewed_reference_analysis';
}

export interface FilmReferenceAnalysisRecord {
  schema_version: 'reference-analysis-record/v1';
  analysis_id: string;
  reference_id: string;
  analysis_type: 'film';
  analysis: FilmReferenceAnalysis;
  analyzed_by: string;
  analyzed_at: string;
  approval: ReferenceAnalysisApproval;
}

export interface TextReferenceAnalysisRecord {
  schema_version:
    | 'reference-analysis-record/v1'
    | 'reference-analysis-record/v2';
  analysis_id: string;
  reference_id: string;
  analysis_type: 'text';
  analysis: TextReferenceAnalysis;
  analyzed_by: string;
  analyzed_at: string;
  approval: ReferenceAnalysisApproval;
  provenance?: {
    draft_task_id: string;
    analysis_task_id: string;
    text_execution_id: string;
    similarity_evidence_id: string;
    similarity_evidence_payload_sha256: string;
    final_observations_sha256: string;
    source_content_fingerprint: string;
    input_provenance: 'operator_submitted';
    machine_verified: false;
    supplement_request_sha256?: string;
    supplement_id?: string;
    supplement_payload_sha256?: string;
  };
  governance?: {
    prompt_injection_allowed: false;
    knowledge_writeback_allowed: false;
    production_credit_eligible: false;
  };
}

export type ReferenceAnalysisRecord =
  | FilmReferenceAnalysisRecord
  | TextReferenceAnalysisRecord;

export interface ReferenceAnalysisApprovalResult {
  analysis: ReferenceAnalysisRecord;
  idempotent_replay: boolean;
}

export interface ReferenceTextAnalysisDraftSubmissionResult {
  draft_task: ReferenceTextAnalysisDraftTaskRecord;
  analysis: TextReferenceAnalysisRecord;
  idempotent_replay: boolean;
}

export interface ReferenceTextAnalysisDraftSupplementSubmissionResult {
  draft_task: ReferenceTextAnalysisDraftTaskRecord;
  supplement: ReferenceTextAnalysisDraftSupplementRecord;
  idempotent_replay: boolean;
}

export interface ReferenceLibraryDetail {
  source: ReferenceSourceRecord;
  analyses: ReferenceAnalysisRecord[];
  similarity_evidence: ReferenceSimilarityEvidenceRecord[];
}

export interface ReferenceGovernanceBoundary {
  knowledge_writeback_allowed: false;
  production_credit_eligible: false;
}

export interface ReferenceApprovedAudit {
  status: 'approved';
  approved_by: string;
  approved_at: string;
}

export interface BenchmarkCard {
  schema_version: 'reference-benchmark-card/v1';
  benchmark_id: string;
  reference_ids: string[];
  analysis_ids: string[];
  target_video_type: VideoType;
  target_dimension: 'hook' | 'character' | 'scene' | 'visual' | 'audio' | 'promo';
  principle: string;
  evidence_refs: string[];
  created_by: string;
  created_at: string;
  approval: ReferenceApprovedAudit;
  governance: ReferenceGovernanceBoundary;
}

export interface ReferenceStylePackRecord extends StylePack {
  schema_version: 'reference-style-pack/v1';
  source_analysis_ids: string[];
  source_benchmark_ids: string[];
  reusable_principles: string[];
  avoid_copying: string[];
  created_by: string;
  created_at: string;
  approval: ReferenceApprovedAudit;
  governance: ReferenceGovernanceBoundary;
}

export interface ReferenceStylePackCatalogItem {
  id: string;
  name: string;
  description: string;
  compatible_video_types: VideoType[];
  compatible_presentation_styles: PresentationStyle[];
  compatible_story_structures: StoryStructureType[];
  reusable_principles: string[];
  avoid_copying: string[];
  source_reference_count: number;
  source_analysis_count: number;
  source_benchmark_count: number;
  approval: ReferenceApprovedAudit;
  governance: ReferenceGovernanceBoundary;
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
  ACCESS_UNAUTHENTICATED: 'ACCESS_UNAUTHENTICATED',
  ACCESS_FORBIDDEN: 'ACCESS_FORBIDDEN',
  ACCESS_AUDIT_UNAVAILABLE: 'ACCESS_AUDIT_UNAVAILABLE',
  ACCESS_RESOURCE_UNBOUND: 'ACCESS_RESOURCE_UNBOUND',
  ACCESS_RESOURCE_FORBIDDEN: 'ACCESS_RESOURCE_FORBIDDEN',
  ACCESS_RESOURCE_MIGRATION_BLOCKED: 'ACCESS_RESOURCE_MIGRATION_BLOCKED',
  CALLBACK_UNAUTHENTICATED: 'CALLBACK_UNAUTHENTICATED',
  CALLBACK_AUTH_UNAVAILABLE: 'CALLBACK_AUTH_UNAVAILABLE',
  PROJECT_WRITE_CONFLICT: 'PROJECT_WRITE_CONFLICT',
  PROJECT_REPOSITORY_IDENTIFIER_INVALID: 'PROJECT_REPOSITORY_IDENTIFIER_INVALID',
  PROJECT_REPOSITORY_MIGRATION_BLOCKED: 'PROJECT_REPOSITORY_MIGRATION_BLOCKED',
  ARTIFACT_WRITE_CONFLICT: 'ARTIFACT_WRITE_CONFLICT',
  ARTIFACT_PATH_INVALID: 'ARTIFACT_PATH_INVALID',
  ARTIFACT_STORAGE_UNAVAILABLE: 'ARTIFACT_STORAGE_UNAVAILABLE',
  REVIEW_WRITE_CONFLICT: 'REVIEW_WRITE_CONFLICT',
  REVIEW_REPOSITORY_IDENTIFIER_INVALID: 'REVIEW_REPOSITORY_IDENTIFIER_INVALID',
  REVIEW_STORAGE_UNAVAILABLE: 'REVIEW_STORAGE_UNAVAILABLE',
  JOB_WRITE_CONFLICT: 'JOB_WRITE_CONFLICT',
  JOB_REPOSITORY_IDENTIFIER_INVALID: 'JOB_REPOSITORY_IDENTIFIER_INVALID',
  JOB_STORAGE_UNAVAILABLE: 'JOB_STORAGE_UNAVAILABLE',
  SERIES_PROJECT_WRITE_CONFLICT: 'SERIES_PROJECT_WRITE_CONFLICT',
  SERIES_PROJECT_IDENTIFIER_INVALID: 'SERIES_PROJECT_IDENTIFIER_INVALID',
  SERIES_PROJECT_STORAGE_UNAVAILABLE: 'SERIES_PROJECT_STORAGE_UNAVAILABLE',
  STORY_WRITE_CONFLICT: 'STORY_WRITE_CONFLICT',
  STORY_REPOSITORY_IDENTIFIER_INVALID: 'STORY_REPOSITORY_IDENTIFIER_INVALID',
  STORY_STORAGE_UNAVAILABLE: 'STORY_STORAGE_UNAVAILABLE',
  DOMAIN_PACK_NOT_FOUND: 'DOMAIN_PACK_NOT_FOUND',
  DOMAIN_PACK_REGISTRY_INVALID: 'DOMAIN_PACK_REGISTRY_INVALID',
  DOMAIN_SAFETY_VALIDATION_FAILED: 'DOMAIN_SAFETY_VALIDATION_FAILED',
  REFERENCE_SAFETY_VALIDATION_FAILED: 'REFERENCE_SAFETY_VALIDATION_FAILED',
  DOMAIN_SAFETY_MIGRATION_BLOCKED: 'DOMAIN_SAFETY_MIGRATION_BLOCKED',
  ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
  INVALID_GENERATION_TYPE: 'INVALID_GENERATION_TYPE',
  INVALID_VIDEO_TYPE: 'INVALID_VIDEO_TYPE',
  INVALID_PRESENTATION_STYLE: 'INVALID_PRESENTATION_STYLE',
  INVALID_STORY_STRUCTURE: 'INVALID_STORY_STRUCTURE',
  INVALID_DURATION: 'INVALID_DURATION',
  STORY_GENERATION_FAILED: 'STORY_GENERATION_FAILED',
  STORY_GENERATION_AUDIT_UNAVAILABLE: 'STORY_GENERATION_AUDIT_UNAVAILABLE',
  STORY_AGENT_RUN_INPUT_CONFLICT: 'STORY_AGENT_RUN_INPUT_CONFLICT',
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
  original_user_query?: string;
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

export type StoryGenerationFallbackPolicy =
  | 'allow_local_fallback'
  | 'forbid_local_fallback';

export type StoryMaterialReadinessPolicy =
  | 'allow_draft_with_risks'
  | 'require_script_ready';

export type ReferenceGenerationRecipeId =
  | 'feature_long_goal_payoff'
  | 'feature_epoch_character_mosaic'
  | 'feature_moral_pressure'
  | 'promo_space_emotion'
  | 'promo_mnemonic_reveal'
  | 'promo_collective_montage'
  | 'heritage_craft_process_evidence'
  | 'documentary_evidence_trail'
  | 'explainer_question_to_example'
  | 'series_strategy_chapters'
  | 'series_ritual_relationships';

export interface ReferenceGenerationRecipeContract {
  schema_version: 'reference-generation-recipe/v1';
  recipe_id: ReferenceGenerationRecipeId;
  recipe_version: '1.0.0';
  reusable_mechanisms: string[];
  avoid_copying: string[];
  payload_sha256: string;
}

export type ReferenceGenerationRecipeCreationPath =
  | 'original'
  | 'adaptation'
  | 'institutional';

export type ReferenceGenerationRecipeMaterialFeature =
  | 'structured_knowledge_pack'
  | 'documented_character_choice'
  | 'multi_period_scope'
  | 'ensemble_cast'
  | 'spatial_subject'
  | 'public_service_goal'
  | 'institutional_brief'
  | 'strategy_or_power_material'
  | 'ritual_or_relationship_material'
  | 'rhythmic_short_scene_material'
  | 'limited_or_unverified_material';

export interface ReferenceGenerationRecipeRecommendationRequest {
  creation_path: ReferenceGenerationRecipeCreationPath;
  video_type: VideoType;
  creation_use_case?: CreationUseCase;
  truth_mode?: TruthMode;
  subject_text?: string;
  narrative_goal?: string;
  material_features?: ReferenceGenerationRecipeMaterialFeature[];
}

export interface ReferenceGenerationRecipeRecommendation {
  recipe_id: ReferenceGenerationRecipeId;
  rank: number;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  matched_signals: string[];
  contract: ReferenceGenerationRecipeContract;
}

export interface ReferenceGenerationRecipeRecommendationResult {
  schema_version: 'reference-generation-recipe-recommendation/v1';
  recommendations: ReferenceGenerationRecipeRecommendation[];
  policy_warnings: string[];
  no_recommendation_reason?: string;
  boundary: {
    optional_recommendation: true;
    user_may_decline: true;
    machine_recommendation_only: true;
    truth_and_material_boundaries_take_priority: true;
    production_credit_granted: false;
  };
}

export interface StoryGenerateRequest {
  domain?: string;
  entry_name?: string;
  original_user_query?: string;
  generation_type?: GenerationType;
  video_type?: VideoType;
  model_profile_id?: string;
  generation_fallback_policy?: StoryGenerationFallbackPolicy;
  material_readiness_policy?: StoryMaterialReadinessPolicy;
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
  reference_similarity_evidence_ids?: string[];
  reference_baseline_story_id?: string;
  reference_generation_recipe?: ReferenceGenerationRecipeContract;
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

export interface StoryScene extends BaseStoryScene {
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
  /** Domain Pack that produced the Story. */
  sourceDomain: string;
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
  /** Domain Pack that owns the current Story version. */
  source_domain: string;
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
  /** Whether the narrative/factual/outline/audience gates allow story publication. */
  story_publishable?: boolean;
  /** Whether the production-material/GEARS/assets/provider gates are all ready. */
  production_ready?: boolean;
  quality_passed?: boolean;
  genre_score?: number;
  quality_issue_count?: number;
  open_supplement_task_count?: number;
  gears_video_status?: GearsVideoStatus;
  gears_video_url?: string;
  gears_video_thumbnail_url?: string;
  access_control?: import('./product-access.js').ProductResourceOwnership;
}

export type StoryProjectVersionChangeType =
  | 'initial_generation'
  | 'scene_regeneration'
  | 'quality_repair'
  | 'production_board_repair'
  | 'domain_safety_migration';

export interface StoryProjectVersionSummary {
  version_id: string;
  created_at: string;
  change_type: StoryProjectVersionChangeType;
  scene_ids_changed: number[];
  note?: string;
  story_publishable?: boolean;
  production_ready?: boolean;
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

export interface StoryProjectRepositoryConfigInfo {
  env: 'STORY_PROJECT_REPOSITORY_PROVIDER';
  sqlite_path_env: 'STORY_PROJECT_SQLITE_PATH';
  configured_provider: string;
  active_provider: 'file' | 'sqlite' | null;
  supported_providers: ['file', 'sqlite'];
  configuration_valid: boolean;
  database_kind: 'none' | 'embedded_sqlite';
  sqlite_runtime_available: boolean;
  sqlite_runtime_requirement: string;
  external_database: false;
  object_storage: false;
  same_host_atomic_locking: true;
  transactional_multi_record_writes: true;
  optimistic_concurrency_control: true;
  content_integrity_hashes: boolean;
  local_backup_verification_supported: boolean;
  production_recovery_drill_completed: false;
  production_persistence_ready: false;
  warnings: string[];
  next_actions: string[];
  generated_at: string;
}

export interface StoryStorageRootInventory {
  role: 'active' | 'legacy_misresolved';
  root: string;
  exists: boolean;
  readable: boolean;
  symbolic_link: boolean;
  project_count: number;
  project_version_count: number;
  story_count: number;
  ai_comic_series_project_count: number;
  inspection_error: string | null;
  read_only_inspection: true;
}

export interface StoryStorageRootConfigInfo {
  schema_version: 'story-storage-root-config/v1';
  kb_root_env: 'KB_ROOT';
  generated_root_env: 'WEB_GENERATED_ROOT';
  runtime_environment: string;
  kb_root: string;
  generated_root: string;
  kb_root_source: 'explicit_env' | 'default_derived';
  generated_root_source: 'explicit_env' | 'default_derived';
  default_kb_root: string;
  default_generated_root: string;
  legacy_misresolved_generated_root: string;
  paths_absolute: boolean;
  roots_disjoint: boolean;
  active_matches_legacy_misresolved_root: boolean;
  production_explicit_config_required: boolean;
  production_explicit_config_satisfied: boolean;
  configuration_valid: boolean;
  blockers: string[];
  warnings: string[];
  inventory: {
    active: StoryStorageRootInventory;
    legacy_misresolved: StoryStorageRootInventory;
  };
  legacy_policy: {
    discovery_only: true;
    included_in_active_read_roots: false;
    automatic_migration_allowed: false;
    automatic_merge_allowed: false;
    automatic_delete_allowed: false;
    automatic_writeback_allowed: false;
  };
  data_moved: false;
  data_deleted: false;
  data_overwritten: false;
  provider_switched: false;
  real_gears_seedance_delivery_credit_count: 0;
  counts_as_real_gears_seedance_delivery: false;
  generated_at: string;
}

export type StoryStorageLegacyStructureStatus =
  | 'empty_directory'
  | 'metadata_without_history'
  | 'complete_history'
  | 'invalid_metadata'
  | 'unsupported_directory';

export type StoryStorageLegacySourceStatus =
  | 'resolved'
  | 'domain_unregistered'
  | 'entry_not_found'
  | 'unavailable';

export type StoryStorageLegacyOwnershipStatus = 'valid' | 'missing' | 'invalid';

export interface StoryStorageLegacyDispositionItem {
  legacy_project_id: string;
  structure_status: StoryStorageLegacyStructureStatus;
  directory_entry_count: number;
  metadata_file_present: boolean;
  metadata_file_regular: boolean;
  metadata_sha256: string | null;
  metadata_semantic_fingerprint_sha256: string | null;
  metadata_identity_valid: boolean;
  declared_project_id: string | null;
  declared_story_id: string | null;
  declared_current_version_id: string | null;
  declared_version_count: number | null;
  source_domain: string | null;
  source_entry: string | null;
  source_status: StoryStorageLegacySourceStatus;
  ownership_status: StoryStorageLegacyOwnershipStatus;
  versions_directory_present: boolean;
  version_file_count: number;
  current_version_file_present: boolean;
  active_project_id_collision: boolean;
  active_story_id_collision_project_ids: string[];
  active_metadata_fingerprint_collision_project_ids: string[];
  active_same_source_title_candidate_project_ids: string[];
  legacy_equivalent_metadata_project_ids: string[];
  blockers: string[];
  requires_human_review: true;
  automatic_duplicate_inference: false;
  automatic_action_allowed: false;
  migration_planned: false;
  merge_planned: false;
  deletion_planned: false;
  writeback_performed: false;
  real_credit_granted: false;
}

export interface StoryStorageLegacyDispositionPreflight {
  schema_version: 'story-storage-legacy-disposition-preflight/v1';
  generated_at: string;
  active_root: string;
  legacy_root: string;
  read_only: true;
  preflight_complete: boolean;
  global_blockers: string[];
  consistent_snapshot_guaranteed: false;
  recheck_required_before_any_action: true;
  legacy_directory_count: number;
  empty_directory_count: number;
  metadata_file_count: number;
  valid_metadata_count: number;
  invalid_metadata_count: number;
  complete_history_count: number;
  metadata_without_history_count: number;
  active_project_id_collision_count: number;
  active_story_id_collision_count: number;
  active_metadata_fingerprint_collision_count: number;
  active_same_source_title_candidate_count: number;
  legacy_equivalent_metadata_item_count: number;
  legacy_equivalent_metadata_group_count: number;
  source_resolved_count: number;
  ownership_valid_count: number;
  blocked_item_count: number;
  human_review_required_count: number;
  automatic_action_count: 0;
  inventory_sha256: string;
  items: StoryStorageLegacyDispositionItem[];
  migration_performed: false;
  merge_performed: false;
  deletion_performed: false;
  overwrite_performed: false;
  writeback_performed: false;
  domain_safety_migration_performed: false;
  provider_switched: false;
  real_gears_seedance_delivery_credit_count: 0;
  counts_as_real_gears_seedance_delivery: false;
}

export interface StoryProjectFileToSqliteMigrationRequest {
  schema_version: 'story-project-file-to-sqlite-migration-request/v1';
  migration_id: string;
  expected_source_logical_sha256: string;
  review_reference: string;
  operator_confirmation: 'file_repository_snapshot_reviewed';
  dry_run: boolean;
}

export interface StoryProjectFileToSqliteMigrationPreflight {
  schema_version: 'story-project-file-to-sqlite-migration-preflight/v1';
  evaluated_at: string;
  source_provider: 'file';
  target_provider: 'sqlite';
  target_path_env: 'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_TARGET_PATH';
  target_path_configured: boolean;
  target_path: string | null;
  target_exists: boolean;
  source_project_count: number;
  source_version_count: number;
  source_logical_sha256: string | null;
  blockers: string[];
  preflight_ready: boolean;
  source_pending_transactions_recovered: false;
  source_writeback_performed: false;
  target_write_performed: false;
  external_database: false;
  object_storage: false;
  production_recovery_drill_completed: false;
  production_persistence_ready: false;
  real_credit_granted: false;
}

export interface StoryProjectFileToSqliteMigrationManifest {
  schema_version: 'story-project-file-to-sqlite-migration-manifest/v1';
  migration_id: string;
  created_at: string;
  requested_by_actor_id: string;
  requested_by_organization_id: string;
  review_reference: string;
  source_project_count: number;
  source_version_count: number;
  source_logical_sha256: string;
  target_logical_sha256: string;
  target_database_sha256: string;
  source_unchanged: true;
  destination_was_empty: true;
  history_overwrite_performed: false;
  active_provider_changed: false;
  external_database: false;
  object_storage: false;
  production_recovery_drill_completed: false;
  production_persistence_ready: false;
  real_credit_granted: false;
}

export interface StoryProjectFileToSqliteMigrationResult {
  schema_version: 'story-project-file-to-sqlite-migration-result/v1';
  evaluated_at: string;
  migration_id: string;
  requested_by_actor_id: string;
  dry_run: boolean;
  write_enabled: boolean;
  expected_source_logical_sha256: string;
  actual_source_logical_sha256: string | null;
  source_project_count: number;
  source_version_count: number;
  target_path_configured: boolean;
  target_path: string | null;
  target_existed_before: boolean;
  blockers: string[];
  preflight_ready: boolean;
  applied: boolean;
  idempotent_replay: boolean;
  target_logical_sha256: string | null;
  target_database_sha256: string | null;
  manifest_path: string | null;
  manifest: StoryProjectFileToSqliteMigrationManifest | null;
  durable_intent_written: boolean;
  durable_completion_written: boolean;
  source_pending_transactions_recovered: false;
  source_writeback_performed: false;
  source_unchanged: true;
  destination_was_empty: boolean;
  history_overwrite_performed: false;
  active_provider_changed: false;
  external_database: false;
  object_storage: false;
  production_recovery_drill_completed: false;
  production_persistence_ready: false;
  real_credit_granted: false;
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
  story_publishable?: boolean;
  production_ready?: boolean;
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
  source_domain: string;
  source_entry: string;
  video_type: VideoType;
  knowledge_writeback_eligible: boolean;
  knowledge_writeback_blockers: string[];
  target_province?: string;
  suggested_file_path?: string;
  suggested_section_heading?: string;
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

export interface ProjectSupplementCandidateExportFilters {
  project_id?: string;
  video_type?: VideoType;
  province?: string;
  status?: KnowledgeSupplementTaskStatus;
  stage?: MaterialSufficiencyStage;
  blocking_level?: MaterialBlockingLevel;
  source?: KnowledgeSupplementTaskSource;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  search_query?: string;
  task_key_count?: number;
}

export interface ProjectSupplementCandidateExportItem extends ProjectSupplementTaskListItem {
  task_key: string;
}

export interface ProjectSupplementCandidateExportPackage {
  schema_version: 'project-supplement-candidate-package/v1';
  exported_at: string;
  filters: ProjectSupplementCandidateExportFilters;
  task_count: number;
  open_task_count: number;
  blocking_open_count: number;
  risk_open_count: number;
  optional_open_count: number;
  project_count: number;
  target_files: string[];
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  markdown: string;
  items: ProjectSupplementCandidateExportItem[];
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

export interface GearsSegment extends BaseGearsSegment {
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

export interface GearsV2Segment extends GearsSegment {
  /**
   * Domain-neutral GEARS v2 constraint field. `cultural_constraints` remains
   * present during the v1 compatibility window and must contain the same data.
   */
  constraint_note: string[];
}

export interface GearsSegmentsResponse {
  schema_version: 'gears-segments/v2';
  storyId: string;
  title: string;
  sourceDomain: string;
  total_duration_sec: number;
  segments: GearsV2Segment[];
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
  /** Canonical production identity derived once from unit_id and reused downstream. */
  shot_id: string;
  source_scene_id: number;
  scene_name: string;
  character_names: string[];
  suggested_duration_sec: number;
  suggested_panel_count: PanelCount;
  time_of_day?: GearsTimeOfDay;
  beat_count: number;
  script_text: string;
  /** Workbench fields stay separate so operators can revise them independently. */
  visual_prompt?: string;
  camera_suggestion?: string;
  segment_prompt_hint?: string;
  constraint_note?: string[];
}

export type GearsDeliveryStatus = 'ready' | 'needs_input';

export interface GearsDeliveryPackage {
  schema_version: string;
  storyId: string;
  sourceDomain: string;
  title: string;
  delivery_status?: GearsDeliveryStatus;
  character_assets: GearsCharacterAsset[];
  character_gender_summary: GearsCharacterGenderSummary;
  scene_assets: GearsSceneAsset[];
  units: GearsDeliveryUnit[];
  markdown: string;
  validation_notes: string[];
}

export interface ProductionShot {
  shot_id: string;
  source_scene_id: number;
  source_unit_id: string;
}

export interface ProductionShotPlan {
  schema_version: 'production-shot-plan/v2';
  storyId: string;
  shots: ProductionShot[];
}

// ---------------------------------------------------------------------------
// GEARS workbench bridge (data import only; never execution-worker credit)
// ---------------------------------------------------------------------------

export interface GearsWorkbenchMappingOptions {
  character_style_pack_id: string;
  scene_style_pack_id: string;
  staging_pack_id: string;
  visual_pack_id: string;
}

export interface GearsWorkbenchProjectImportRequest {
  idempotency_key?: string;
  expected_source_version_id?: string;
  expected_payload_sha256?: string;
  mapping: GearsWorkbenchMappingOptions;
}

export interface GearsWorkbenchCreditBoundary {
  workbench_data_only: true;
  provider_invoked: false;
  media_generated: false;
  public_artifact_url_count: 0;
  counts_as_real_gears_seedance_delivery: false;
}

export interface GearsWorkbenchConfigInfo {
  service: 'gears-workbench';
  api_base_url_env: 'GEARS_WORKBENCH_API_BASE_URL';
  api_token_env: 'GEARS_WORKBENCH_API_TOKEN';
  api_base_url_configured: boolean;
  api_token_configured: boolean;
  capability_endpoint_path: '/integrations/story-agent/capabilities';
  dry_run_endpoint_path: '/integrations/story-agent/imports/dry-run';
  execute_endpoint_path: '/integrations/story-agent/imports';
  ready_for_capability_probe: boolean;
  missing_requirements: string[];
  configuration_warnings: string[];
  execution_worker_envs_used: false;
  credit_boundary: GearsWorkbenchCreditBoundary;
  generated_at: string;
}

export interface GearsWorkbenchCapabilities {
  schema_version: 'gears-workbench-capabilities/v1';
  service: 'gears-workbench';
  supported_delivery_schemas: string[];
  workbench_import_supported: true;
  character_asset_bootstrap_supported: true;
  character_asset_generation_modes: ['local_test'];
  execution_worker_supported: false;
  bearer_auth_required: true;
  dry_run_default: true;
  atomic_execute: true;
  idempotent_execute: true;
  operator_recipe_promotion_supported: true;
  promotion_requires_real_asset_versions: true;
  promotion_invokes_provider: false;
  entity_types: Array<'project' | 'character' | 'scene' | 'storyboard_draft'>;
  endpoints: Record<string, { method: 'GET' | 'POST'; path: string }>;
  available_character_style_pack_ids: string[];
  available_scene_style_pack_ids: string[];
  available_staging_pack_ids: string[];
  available_visual_pack_ids: string[];
  unsupported_worker_paths: string[];
  credit_boundary: GearsWorkbenchCreditBoundary;
}

export interface GearsWorkbenchImportSource {
  source_system: 'story-agent';
  project_id: string;
  story_id: string;
  version_id: string;
  source_domain: string;
}

export interface GearsWorkbenchImportEntityPlan {
  entity_type: 'project' | 'character' | 'scene' | 'storyboard_draft';
  source_key: string;
  display_name: string;
  action: 'create' | 'update' | 'reuse' | 'blocked';
  target_entity_id?: string;
  payload_sha256: string;
  blocker?: string;
}

export interface GearsWorkbenchImportSummary {
  entity_count: number;
  project_count: number;
  character_count: number;
  scene_count: number;
  storyboard_draft_count: number;
  create_count: number;
  update_count: number;
  reuse_count: number;
  blocked_count: number;
  provider_call_count: 0;
  media_artifact_count: 0;
  real_delivery_credit_count: 0;
}

export interface GearsWorkbenchImportResult {
  schema_version: 'gears-workbench-import-result/v1';
  mode: 'dry_run' | 'execute';
  status: 'planned' | 'blocked' | 'applied';
  import_id?: string | null;
  idempotency_key: string;
  replayed: boolean;
  atomic: true;
  source: GearsWorkbenchImportSource;
  payload_sha256: string;
  entities: GearsWorkbenchImportEntityPlan[];
  blockers: string[];
  warnings: string[];
  summary: GearsWorkbenchImportSummary;
  credit_boundary: GearsWorkbenchCreditBoundary;
  created_at?: string | null;
  local_audit?: GearsWorkbenchImportAuditReceipt;
}

export interface GearsWorkbenchImportAuditReceipt {
  schema_version: 'gears-workbench-import-audit-receipt/v1';
  audit_event_id: string;
  ledger_revision: string;
  ledger_event_count: number;
  recorded_at: string;
  separate_from_execution_worker_ledger: true;
  counts_as_real_gears_seedance_delivery: false;
}

export interface GearsWorkbenchImportAuditEvent {
  schema_version: 'gears-workbench-import-audit-event/v1';
  audit_event_id: string;
  project_id: string;
  story_id: string;
  version_id: string;
  source_domain: string;
  mode: 'dry_run' | 'execute';
  status: 'planned' | 'blocked' | 'applied';
  import_id?: string;
  idempotency_key: string;
  replayed: boolean;
  payload_sha256: string;
  entity_count: number;
  create_count: number;
  update_count: number;
  reuse_count: number;
  blocked_count: number;
  storyboard_draft_count: number;
  provider_call_count: 0;
  media_artifact_count: 0;
  real_delivery_credit_count: 0;
  separate_from_execution_worker_ledger: true;
  counts_as_real_gears_seedance_delivery: false;
  recorded_at: string;
}

export interface GearsWorkbenchImportAuditLedger {
  schema_version: 'gears-workbench-import-audit-ledger/v1';
  project_id: string;
  ledger_revision: string | null;
  ledger_event_count: number;
  separate_from_execution_worker_ledger: true;
  real_delivery_credit_count: 0;
  items: GearsWorkbenchImportAuditEvent[];
}

export interface GearsWorkbenchImportEnvelope {
  schema_version: 'gears-workbench-import/v1';
  idempotency_key: string;
  source: GearsWorkbenchImportSource;
  delivery: GearsDeliveryPackage;
  mapping: GearsWorkbenchMappingOptions;
}

export interface GearsCharacterAssetBootstrapSource {
  source_system: 'story-agent';
  project_id: string;
  version_id: string;
  source_fingerprint: string;
}

export interface GearsCharacterAssetBootstrapCharacter {
  identity_id: string;
  definition_fingerprint: string;
  name: string;
  role_position: '主角' | '反派' | '配角';
  species_type: '人类';
  ethnicity: ['东亚'];
  gender: '男' | '女' | '其他' | '未指定';
  age_range: '儿童' | '少年' | '青年' | '中年' | '老年';
  appearance_features: string;
  clothing: string;
  signature_objects?: string;
  background_oneliner?: string;
}

export interface GearsCharacterAssetBootstrapRequest {
  schema_version: 'story-agent-character-asset-bootstrap/v1';
  idempotency_key: string;
  source: GearsCharacterAssetBootstrapSource;
  character_style_pack_id: string;
  generation_mode: 'local_test';
  characters: GearsCharacterAssetBootstrapCharacter[];
}

export interface GearsCharacterAssetBootstrapItem {
  identity_id: string;
  definition_fingerprint: string;
  name: string;
  gears_project_id: string;
  gears_character_id: string;
  base_sheet_version_id: string;
  provider: 'gears_local_test';
  model: 'gears-local-test-card';
  media_url: string;
  content_sha256: string;
  prompt_sha256: string;
}

export interface GearsCharacterAssetBootstrapResult {
  schema_version: 'story-agent-character-asset-bootstrap-result/v1';
  status: 'applied' | 'replayed';
  idempotency_key: string;
  generation_mode: 'local_test';
  source: GearsCharacterAssetBootstrapSource;
  characters: GearsCharacterAssetBootstrapItem[];
  external_provider_call_count: 0;
  local_test_artifact_count: number;
  real_delivery_credit_count: 0;
  credit_boundary: {
    local_test_only: true;
    external_provider_invoked: false;
    counts_as_real_image_asset: false;
    counts_as_production_credit: false;
  };
}

export interface AiComicSeriesGearsCharacterAssetLocalTestResult {
  schema_version: 'ai-comic-series-gears-character-assets-local-test-result/v1';
  detail: AiComicSeriesProjectDetail;
  gears_result: GearsCharacterAssetBootstrapResult;
  imported_assets: AiComicSeedanceAssetLibraryItem[];
  imported_asset_count: number;
  reused_asset_count: number;
  external_provider_call_count: 0;
  production_credit_count: 0;
  local_test_only: true;
}

export type GearsExecutionJobType =
  | 'storyboard_image'
  | 'character_image'
  | 'scene_image'
  | 'prop_image'
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
  actual_cost_amount?: number;
  cost_currency?: string;
  message?: string;
}

export type GearsExecutionCostBoundaryStatus =
  | 'within_authorization'
  | 'exceeded_authorization'
  | 'currency_mismatch'
  | 'authorization_missing';

export interface GearsExecutionCostRecord {
  actual_cost_amount: number;
  cost_currency: string;
  provider_reported_at: string;
  reporting_channel: 'callback_or_poll';
  boundary_status: GearsExecutionCostBoundaryStatus;
  authorization_reference?: string;
  authorized_max_cost_amount?: number;
  authorization_total_actual_cost_amount?: number;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRecord;
  execution_cost?: GearsExecutionCostRecord;
  provider_asset_handoffs?: GearsProviderAssetHandoffAuditRecord[];
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

export interface GearsExecutionMetricDistribution {
  sample_count: number;
  average: number;
  p50: number;
  p95: number;
  max: number;
}

export interface GearsExecutionOperationalMetrics {
  schema_version: 'gears-execution-operational-metrics/v1';
  measured_at?: string;
  scope: 'authorized_external_jobs_only';
  all_job_count: number;
  authorized_external_job_count: number;
  active_job_count: number;
  terminal_job_count: number;
  ready_external_output_count: number;
  actual_output_rate_percent: number;
  terminal_failure_count: number;
  failure_rate_percent: number;
  failure_category_counts: Partial<Record<GearsExecutionFailureCategory, number>>;
  poll_failure_count: number;
  execution_duration_ms: GearsExecutionMetricDistribution;
  callback_delivery_latency_ms: GearsExecutionMetricDistribution;
  actual_cost_by_currency: Record<string, number>;
  cost_boundary_violation_count: number;
  pending_terminal_cost_report_count: number;
  local_acceptance_excluded: true;
}

export type GearsExecutionRecoveryStrategy =
  | 'status_resync'
  | 'retry_transient_failure'
  | 'repair_input_then_retry'
  | 'refresh_provider_credentials'
  | 'increase_provider_quota_or_budget'
  | 'manual_content_policy_review'
  | 'manual_failure_investigation';

export interface GearsExecutionRecoveryPlanItem {
  ledger_id: string;
  gears_job_id: string;
  source_unit_id: string;
  job_type: GearsExecutionJobType;
  status: GearsExecutionJobStatus;
  failure_category: GearsExecutionFailureCategory;
  strategy: GearsExecutionRecoveryStrategy;
  retry_eligible: boolean;
  can_auto_execute: boolean;
  requires_operator_review: boolean;
  requires_new_external_call_authorization: boolean;
  reason: string;
}

export interface GearsExecutionRecoveryPlan {
  schema_version: 'gears-execution-recovery-plan/v1';
  generated_at?: string;
  item_count: number;
  retry_eligible_count: number;
  status_resync_count: number;
  operator_intervention_count: number;
  auto_executable_count: number;
  items: GearsExecutionRecoveryPlanItem[];
  notes: string[];
}

export type ProductionReadinessStatus = 'ready' | 'needs_action' | 'blocked';

export type ProductionReadinessScope = 'story_project' | 'ai_comic_series';

export type ProductionReadinessLaneKey =
  | 'story_quality'
  | 'series_quality'
  | 'episode_generation'
  | 'visual_asset_readiness'
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

export type StoryProjectWorkflowState =
  | 'material_intake'
  | 'story_revision'
  | 'production_preparation'
  | 'shot_production'
  | 'external_delivery'
  | 'human_review'
  | 'release_governance';

export interface StoryProjectWorkflowNextAction {
  action_key: string;
  label: string;
  detail: string;
  route: string;
  anchor?: string;
  external_input_required: boolean;
  counts_as_real_completion: false;
}

export interface StoryProjectWorkflowSnapshot {
  schema_version: 'story-project-workflow/v1';
  state: StoryProjectWorkflowState;
  state_label: string;
  readiness_status: ProductionReadinessStatus;
  blocker_reason?: string;
  primary_next_action: StoryProjectWorkflowNextAction;
  source_next_action_count: number;
  secondary_action_count: number;
  primary_next_action_count: 1;
  credit_boundary: 'navigation_only_no_real_completion_credit';
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
  gears_operational_metrics: GearsExecutionOperationalMetrics;
  gears_recovery_plan: GearsExecutionRecoveryPlan;
  lanes: ProductionReadinessLane[];
  issues: ProductionReadinessIssue[];
  next_actions: ProductionReadinessNextAction[];
  workflow: StoryProjectWorkflowSnapshot;
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
  seedance_cost_governance: AiComicSeedanceExecutionCostGovernanceSummary;
  gears_operational_metrics: GearsExecutionOperationalMetrics;
  gears_recovery_plan: GearsExecutionRecoveryPlan;
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

export type StoryAgentGenerationActivityDiagnosis =
  | 'attempt_history_unavailable'
  | 'no_generation_request_since_latest_success'
  | 'generation_pipeline_failure_detected'
  | 'generation_attempt_incomplete'
  | 'storage_root_mismatch_detected'
  | 'pending_transaction_detected';

export type StoryAgentLatestPersistedActivityKind =
  | 'story_generation'
  | 'project_revision'
  | 'report_only'
  | 'none';

export interface StoryAgentGenerationActivityStoryEvidence {
  story_id: string;
  created_at: string;
}

export interface StoryAgentGenerationActivityVersionEvidence {
  project_id: string;
  version_id: string;
  created_at: string;
  change_type?: string;
}

export interface StoryAgentGenerationActivityReportEvidence {
  report_file: string;
  generated_at: string;
}

export interface StoryAgentGenerationActivityAttemptEvidence {
  attempt_id: string;
  entrypoint: 'web_api_stories_generate';
  source_domain: string;
  video_type: VideoType;
  status: 'started' | 'succeeded' | 'failed';
  started_at: string;
  terminal_at?: string;
  error_code?: ErrorCode | 'UNHANDLED_GENERATION_ERROR';
}

export type StoryGenerationAttemptAuditReadinessBlocker =
  | 'audit_parent_not_writable'
  | 'audit_directory_unsafe'
  | 'audit_directory_not_writable'
  | 'audit_directory_permissions_unsafe'
  | 'ledger_target_unsafe'
  | 'ledger_permissions_unsafe'
  | 'archive_target_unsafe'
  | 'archive_permissions_unsafe'
  | 'archive_retention_exceeded'
  | 'ledger_history_invalid'
  | 'ledger_lock_active'
  | 'ledger_lock_permissions_unsafe'
  | 'ledger_lock_invalid';

export type StoryGenerationAttemptAuditOperatorAction =
  | 'no_action_required'
  | 'review_audit_parent_permissions_after_backup'
  | 'review_audit_directory_safety_after_backup'
  | 'review_audit_directory_permissions_after_backup'
  | 'review_ledger_target_safety_after_backup'
  | 'review_ledger_permissions_after_backup'
  | 'review_archive_target_safety_after_backup'
  | 'review_archive_permissions_after_backup'
  | 'review_archive_retention_after_backup'
  | 'review_invalid_history_after_backup'
  | 'wait_for_active_writer_and_reinspect'
  | 'reinspect_expired_lock_on_next_canonical_request'
  | 'review_lock_permissions_after_backup'
  | 'review_invalid_lock_after_backup';

export type StoryGenerationAttemptAuditConfigurationWarning =
  | 'invalid_max_bytes_configuration_fell_back_to_default'
  | 'invalid_max_archives_configuration_fell_back_to_default'
  | 'invalid_lock_timeout_configuration_fell_back_to_default'
  | 'invalid_lock_retry_configuration_fell_back_to_default'
  | 'invalid_lock_stale_configuration_fell_back_to_default';

export interface StoryGenerationAttemptAuditReadiness {
  schema_version: 'story-generation-attempt-audit-readiness/v1';
  status: 'uninitialized' | 'ready' | 'blocked';
  storage_initialized: boolean;
  ledger_present: boolean;
  archive_count: number;
  current_file_bytes: number;
  configured_max_bytes: number;
  configured_max_archives: number;
  configured_lock_timeout_ms: number;
  configured_lock_retry_ms: number;
  configured_lock_stale_ms: number;
  configuration_valid: boolean;
  configuration_warnings: StoryGenerationAttemptAuditConfigurationWarning[];
  permission_policy: 'owner_only';
  permission_policy_satisfied: boolean;
  event_file_sync_required: true;
  no_follow_open_required: true;
  directory_entry_sync_guaranteed: true;
  lock_status: 'absent' | 'active' | 'expired_recoverable' | 'invalid';
  history_integrity: 'unavailable' | 'valid' | 'invalid';
  valid_event_count: number;
  invalid_event_count: number;
  ready_for_next_attempt: boolean;
  blockers: StoryGenerationAttemptAuditReadinessBlocker[];
  warnings: string[];
  operator_actions: StoryGenerationAttemptAuditOperatorAction[];
  automatic_repair_allowed: false;
  destructive_action_performed: false;
  request_content_recorded: false;
  model_output_recorded: false;
  raw_exception_recorded: false;
  absolute_path_exposed: false;
}

export interface StoryAgentGenerationActivityEvidence {
  schema_version: 'story-agent-generation-activity/v1';
  generated_at: string;
  diagnosis: StoryAgentGenerationActivityDiagnosis;
  latest_persisted_activity_kind: StoryAgentLatestPersistedActivityKind;
  latest_story?: StoryAgentGenerationActivityStoryEvidence;
  latest_project_version?: StoryAgentGenerationActivityVersionEvidence;
  latest_report?: StoryAgentGenerationActivityReportEvidence;
  legacy_latest_story?: StoryAgentGenerationActivityStoryEvidence;
  latest_generation_attempt?: StoryAgentGenerationActivityAttemptEvidence;
  attempt_audit_readiness: StoryGenerationAttemptAuditReadiness;
  summary: {
    story_count: number;
    project_count: number;
    version_count: number;
    report_count: number;
    project_revision_after_latest_story_count: number;
    report_after_latest_story_count: number;
    pending_transaction_count: number;
    legacy_story_count: number;
    legacy_project_count: number;
    generation_attempt_count: number;
    generation_attempt_succeeded_count: number;
    generation_attempt_failed_count: number;
    generation_attempt_incomplete_count: number;
    generation_attempt_invalid_event_count: number;
  };
  signals: {
    durable_generation_attempt_history_available: boolean;
    generation_attempt_audit_ready_for_next_request: boolean;
    no_generation_request_confirmed: boolean;
    generation_pipeline_failure_confirmed: boolean;
    generation_attempt_incomplete_detected: boolean;
    storage_root_switch_detected: boolean;
    report_only_activity_detected: boolean;
    project_revision_only_activity_detected: boolean;
  };
  unresolved_possibilities: Array<
    | 'no_generation_request_submitted'
    | 'generation_request_failed_before_persistence'
    | 'generation_request_in_progress_or_interrupted'
  >;
  safety: {
    read_only: true;
    generated_files_modified: false;
    model_invoked: false;
  };
  notes: string[];
}

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
  quality_passed?: boolean;
  quality_issue_count?: number;
  open_supplement_task_count?: number;
  material_sufficiency_blocked?: boolean;
  episode_count?: number;
  generated_episode_count?: number;
  generated_episode_story_id_count?: number;
  missing_episode_story_id_count?: number;
  production_item_count?: number;
  ready_production_item_count?: number;
  failed_production_item_count?: number;
  test_fixture_failure_item_count?: number;
  seedance_failure_marker_present?: boolean;
  contract_evidence_count?: number;
  relink_candidate?: boolean;
  signoff_eligible?: boolean;
  governance_disposition?: 'soft_archived_signoff_excluded';
  cut_ready?: boolean;
  subtitle_ready?: boolean;
  thumbnail_ready_count?: number;
  final_delivery_ready?: boolean;
  final_delivery_manifest_ready?: boolean;
  final_delivery_manifest_missing?: boolean;
  final_delivery_dry_run?: boolean;
}

export interface StoryAgentGeneratedHealthReport {
  schema_version: 'story-agent-generated-health/v1';
  generated_at: string;
  generation_activity?: StoryAgentGenerationActivityEvidence;
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
    story_quality_passed_count?: number;
    story_quality_failed_count?: number;
    story_open_supplement_task_count?: number;
    story_quality_passed_with_issue_count?: number;
    story_quality_passed_with_open_supplement_count?: number;
    story_quality_passed_with_issue_and_open_supplement_count?: number;
    story_material_sufficiency_blocked_count?: number;
    missing_episode_story_id_count: number;
    series_missing_delivery_count: number;
    series_missing_postproduction_count: number;
    series_missing_final_delivery_manifest_count?: number;
    series_ready_count?: number;
    series_planned_only_count?: number;
    series_production_gap_count?: number;
    series_interrupted_count?: number;
    series_governance_attention_count?: number;
    series_missing_story_ref_project_count?: number;
    series_contract_evidence_count?: number;
    series_relink_candidate_count?: number;
    series_signoff_portfolio_count?: number;
    series_soft_archive_excluded_count?: number;
    series_seedance_failed_project_count?: number;
    series_seedance_failed_item_count?: number;
    series_seedance_failure_marker_project_count?: number;
    series_seedance_test_fixture_failure_project_count?: number;
    series_seedance_test_fixture_failure_item_count?: number;
  };
  items: StoryAgentGeneratedHealthItem[];
  notes: string[];
  markdown: string;
}

export type StoryAgentBacklogHandoffPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type StoryAgentBacklogHandoffActionType =
  | 'repair_story_project_refs'
  | 'repair_quality'
  | 'repair_delivery_contract'
  | 'resolve_material_gate'
  | 'complete_supplement_task'
  | 'restore_series_story_refs'
  | 'continue_series_generation'
  | 'repair_series_delivery';

export interface StoryAgentBacklogHandoffItem {
  backlog_id: string;
  source_kind: 'generated_health' | 'supplement_candidate';
  priority: StoryAgentBacklogHandoffPriority;
  action_type: StoryAgentBacklogHandoffActionType;
  project_id: string;
  title?: string;
  scope?: StoryAgentGeneratedHealthScope;
  status?: StoryAgentGeneratedHealthStatus | KnowledgeSupplementTaskStatus;
  risk_score: number;
  reason: string;
  recommended_action: string;
  target_file?: string;
  task_key?: string;
  task_id?: string;
  video_type?: VideoType;
  source_entry?: string;
  missing_contracts: string[];
  evidence: string[];
}

export interface StoryAgentBacklogHandoffPackage {
  schema_version: 'story-agent-backlog-handoff/v1';
  generated_at: string;
  source_health_schema: 'story-agent-generated-health/v1';
  source_supplement_candidate_schema: 'project-supplement-candidate-package/v1' | '';
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  summary: {
    total_item_count: number;
    generated_health_item_count: number;
    supplement_candidate_item_count: number;
    interrupted_count: number;
    production_gap_count: number;
    quality_failed_count: number;
    material_blocked_count: number;
    open_supplement_candidate_count: number;
    supplement_blocking_open_count: number;
    supplement_risk_open_count: number;
    supplement_optional_open_count: number;
    p0_count: number;
    p1_count: number;
    p2_count: number;
    p3_count: number;
  };
  items: StoryAgentBacklogHandoffItem[];
  markdown: string;
}

export type StoryAgentGeneratedGovernanceActionKey =
  | 'review_final_delivery_manifest_gaps'
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
  final_delivery_manifest_missing?: boolean;
  final_delivery_dry_run?: boolean;
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
    series_final_delivery_manifest_review_candidate_count: number;
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

export type StoryAgentFinalDeliveryManifestDisposition =
  | 'preserve_fixture_exclude_from_publishable_delivery'
  | 'reexport_after_authorized_dependencies';

export interface StoryAgentFinalDeliveryManifestPreflightRequest {
  series_project_id: string;
  disposition: StoryAgentFinalDeliveryManifestDisposition;
  authorized_media_inputs_attested?: boolean;
}

export type StoryAgentFinalDeliveryManifestPreflightCheckKey =
  | 'target_exists'
  | 'manifest_gap_confirmed'
  | 'authorized_media_inputs'
  | 'cut_output'
  | 'subtitle_output'
  | 'audio_mix_output'
  | 'title_card_outputs'
  | 'project_scoped_paths';

export interface StoryAgentFinalDeliveryManifestPreflightCheck {
  key: StoryAgentFinalDeliveryManifestPreflightCheckKey;
  status: 'passed' | 'failed' | 'not_applicable';
  required: boolean;
  evidence: string[];
  missing_paths?: string[];
  unsafe_paths?: string[];
}

export interface StoryAgentFinalDeliveryManifestPreflightResult {
  schema_version: 'story-agent-final-delivery-manifest-preflight/v1';
  generated_at: string;
  series_project_id: string;
  disposition: StoryAgentFinalDeliveryManifestDisposition;
  status: 'ready' | 'blocked';
  eligible_for_selected_disposition: boolean;
  operator_review_required: true;
  publishable_delivery_credit_granted: false;
  generated_files_modified: false;
  final_assemble_invoked: false;
  manifest_written: false;
  project_json_written: false;
  checks: StoryAgentFinalDeliveryManifestPreflightCheck[];
  missing_dependencies: string[];
  unsafe_paths: string[];
  recommended_action: string;
  notes: string[];
  markdown: string;
}

export interface StoryAgentGeneratedGovernanceRunTarget {
  action_key: StoryAgentGeneratedGovernanceActionKey;
  scope: StoryAgentGeneratedHealthScope;
  project_id: string;
  title?: string;
  status: StoryAgentGeneratedGovernanceRunTargetStatus;
  planned_operation: string;
  expected_file_changes: string[];
  requires_operator_review: boolean;
  operator_disposition_status?: 'awaiting_operator_decision';
  allowed_operator_dispositions?: StoryAgentFinalDeliveryManifestDisposition[];
  preflight_checks?: string[];
  preflight_api?: {
    method: 'POST';
    path: '/api/system/story-agent-final-delivery-manifest-preflight';
    request_template: StoryAgentFinalDeliveryManifestPreflightRequest;
  };
  publishable_delivery_credit_granted?: false;
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
    story_quality_passed_count: number;
    story_quality_failed_count: number;
    story_open_supplement_task_count: number;
    story_quality_passed_with_issue_count: number;
    story_quality_passed_with_open_supplement_count: number;
    story_quality_passed_with_issue_and_open_supplement_count: number;
    story_supplement_open_count: number;
    story_supplement_optional_open_count: number;
    story_supplement_risk_open_count: number;
    story_supplement_blocking_open_count: number;
    story_supplement_candidate_package_schema: 'project-supplement-candidate-package/v1' | '';
    story_supplement_candidate_package_ready: boolean;
    story_supplement_candidate_package_task_count: number;
    story_supplement_candidate_package_open_task_count: number;
    story_supplement_candidate_package_blocking_open_count: number;
    story_supplement_candidate_package_risk_open_count: number;
    story_supplement_candidate_package_optional_open_count: number;
    story_supplement_candidate_package_project_count: number;
    story_supplement_candidate_package_target_file_count: number;
    story_supplement_candidate_package_direct_writeback_to_province_markdown: false;
    story_supplement_candidate_package_province_markdown_written: false;
    story_agent_backlog_handoff_schema: 'story-agent-backlog-handoff/v1';
    story_agent_backlog_handoff_item_count: number;
    story_agent_backlog_handoff_generated_health_item_count: number;
    story_agent_backlog_handoff_supplement_candidate_item_count: number;
    story_agent_backlog_handoff_p0_count: number;
    story_agent_backlog_handoff_p1_count: number;
    story_agent_backlog_handoff_p2_count: number;
    story_agent_backlog_handoff_p3_count: number;
    story_agent_backlog_handoff_direct_writeback_to_province_markdown: false;
    story_agent_backlog_handoff_province_markdown_written: false;
    story_material_sufficiency_blocked_count: number;
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
    knowledge_writeback_review_handoff_reviewer_identity_count: number;
    knowledge_writeback_review_handoff_missing_reviewer_identity_count: number;
    knowledge_writeback_review_handoff_source_ref_count: number;
    knowledge_writeback_review_handoff_signoff_batch_summary_count: number;
    knowledge_writeback_review_handoff_signoff_ready_count: number;
    knowledge_writeback_review_handoff_signoff_blocked_count: number;
    knowledge_writeback_review_handoff_signoff_manifest_id: string;
    knowledge_writeback_review_handoff_signoff_manifest_sha256: string;
    knowledge_writeback_signoff_package_schema: 'knowledge-writeback-queue-signoff-package/v1' | '';
    knowledge_writeback_signoff_package_item_count: number;
    knowledge_writeback_signoff_package_batch_summary_count: number;
    knowledge_writeback_manual_patch_package_schema: 'knowledge-writeback-manual-patch-package/v1' | '';
    knowledge_writeback_manual_patch_ready: boolean;
    knowledge_writeback_manual_patch_target_file_count: number;
    knowledge_writeback_manual_patch_ready_target_file_count: number;
    knowledge_writeback_manual_patch_blocked_target_file_count: number;
    knowledge_writeback_manual_patch_manifest_id: string;
    knowledge_writeback_manual_patch_manifest_sha256: string;
    knowledge_writeback_manual_patch_closure_certificate_id: string;
    knowledge_writeback_manual_patch_closure_certificate_sha256: string;
    knowledge_writeback_manual_patch_closure_certificate_ready: boolean;
    knowledge_writeback_manual_patch_total_patch_count: number;
    knowledge_writeback_manual_patch_project_patch_count: number;
    knowledge_writeback_manual_patch_expansion_patch_count: number;
    knowledge_writeback_source_ref_coverage_percent: number;
    knowledge_writeback_source_ref_blocker_item_count: number;
    knowledge_writeback_source_ref_warning_item_count: number;
    knowledge_writeback_source_ref_check_warning_count: number;
    knowledge_writeback_source_ref_check_blocker_count: number;
    knowledge_writeback_file_missing_source_ref_count: number;
    knowledge_writeback_anchor_missing_source_ref_count: number;
    knowledge_writeback_missing_source_ref_field_count: number;
    knowledge_writeback_missing_verification_note_field_count: number;
    knowledge_writeback_missing_writeback_hint_field_count: number;
    knowledge_writeback_manual_patch_blocker_reason_count: number;
    knowledge_writeback_manual_patch_warning_reason_count: number;
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
    domain_pack_expansion_review_closure_ready: boolean;
    domain_pack_expansion_review_closure_signoff_batch_count: number;
    domain_pack_expansion_review_closure_ready_for_signoff_count: number;
    domain_pack_expansion_review_closure_blocked_for_signoff_count: number;
    domain_pack_expansion_review_closure_missing_review_note_count: number;
    domain_pack_expansion_review_closure_missing_reviewer_identity_count: number;
    domain_pack_expansion_review_closure_missing_signoff_batch_count: number;
    domain_pack_expansion_review_closure_runtime_override_count: number;
    domain_pack_expansion_development_progress_average_percent: number;
    domain_pack_expansion_field_workbench_controls_percent: number;
    domain_pack_expansion_manual_review_closure_percent: number;
    domain_pack_expansion_writeback_safety_export_percent: number;
    domain_pack_expansion_third_batch_real_candidates_percent: number;
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
  backlog_handoff: StoryAgentBacklogHandoffPackage;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRequest;
  overwrite_existing?: boolean;
  payload?: Record<string, unknown>;
  callback_url?: string;
  note?: string;
}

export interface ExternalProviderCallAuthorizationRequest {
  authorized: boolean;
  authorization_reference: string;
  max_cost_amount: number;
  cost_currency: string;
  data_transfer_acknowledged: boolean;
}

export interface ExternalProviderCallAuthorizationRecord {
  authorized: true;
  authorization_reference: string;
  max_cost_amount: number;
  cost_currency: string;
  data_transfer_acknowledged: true;
  confirmed_at: string;
}

export interface GearsProviderAssetInput {
  schema_version: 'gears-provider-asset-input/v1';
  asset_id: string;
  label: string;
  modality: SeedanceAssetModality;
  reference_slot: string;
  content_sha256: string;
  rights_authorization_reference: string;
  human_reviewer_id: string;
  human_reviewed_at: string;
  transport:
    | { kind: 'https_url'; url: string }
    | { kind: 'provider_asset'; provider: string; provider_asset_id: string };
}

export interface GearsProviderAssetHandoffAuditRecord {
  schema_version: 'gears-provider-asset-handoff-audit/v1';
  asset_id: string;
  content_sha256: string;
  reference_slot: string;
  transport_kind: 'https_url' | 'provider_asset';
  url_origin?: string;
  provider?: string;
  provider_asset_id?: string;
  verified_at: string;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRecord;
  provider_asset_input_count?: number;
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
  actual_cost_amount?: number | string;
  actualCostAmount?: number | string;
  cost_amount?: number | string;
  costAmount?: number | string;
  cost_currency?: string;
  costCurrency?: string;
  currency?: string;
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
  api_base_url_env: 'GEARS_EXECUTION_WORKER_API_BASE_URL';
  api_token_env: 'GEARS_EXECUTION_WORKER_API_TOKEN';
  legacy_api_base_url_env: 'GEARS_API_BASE_URL';
  legacy_api_token_env: 'GEARS_API_TOKEN';
  api_base_url_source: 'preferred' | 'legacy' | null;
  api_token_source: 'preferred' | 'legacy' | null;
  legacy_execution_worker_envs_used: string[];
  api_base_url_configured: boolean;
  api_token_configured: boolean;
  callback_secret_configured: boolean;
  callback_base_configured: boolean;
  callback_base_envs: string[];
  capability_endpoint_path: string;
  capability_required_before_requests: boolean;
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

export interface GearsExecutionWorkerCapabilities {
  schema_version: 'gears-execution-worker-capabilities/v1';
  service: 'gears-execution-worker';
  execution_worker_supported: true;
  workbench_import_supported: false;
  bearer_auth_required: boolean;
  idempotent_submit: true;
  status_poll_supported: true;
  callback_delivery_supported: true;
  /** Optional v1 extension; required as true before submitting provider_asset_inputs. */
  provider_asset_handoff_supported?: boolean;
  supported_job_types: GearsExecutionJobType[];
  endpoints: {
    capabilities: {
      method: 'GET';
      path: '/gears/capabilities';
    };
    submit: {
      method: 'POST';
      path: '/gears/jobs';
    };
    job_status: {
      method: 'GET';
      path: '/gears/jobs/{gears_job_id}';
    };
  };
}

export interface GearsExecutionContractInfo {
  provider: 'gears';
  schema_version: 'gears-execution-contract/v1';
  env: {
    api_base_url: 'GEARS_EXECUTION_WORKER_API_BASE_URL';
    api_token: 'GEARS_EXECUTION_WORKER_API_TOKEN';
    legacy_api_base_url: 'GEARS_API_BASE_URL';
    legacy_api_token: 'GEARS_API_TOKEN';
    callback_secret: 'GEARS_CALLBACK_SECRET';
    callback_base_url: 'GEARS_CALLBACK_BASE_URL';
  };
  supported_job_types: GearsExecutionJobType[];
  capability: {
    method: 'GET';
    path: '/gears/capabilities';
    schema_version: 'gears-execution-worker-capabilities/v1';
    required_before_submit_and_poll: true;
    response_fields: string[];
  };
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
  portability: {
    backward_compatible_capability_schema: 'gears-execution-worker-capabilities/v1';
    provider_asset_input_schema: 'gears-provider-asset-input/v1';
    provider_asset_handoff_attestation_field: 'provider_asset_handoff_supported';
    provider_asset_handoff_required_when_inputs_present: true;
    missing_handoff_attestation_behavior: 'fail_closed_before_submit';
    persisted_handoff_audit_schema: 'gears-provider-asset-handoff-audit/v1';
    signed_url_query_persisted: false;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRequest;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRecord;
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
  | 'story_agent_backlog_handoff_report'
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

export type MediaArtifactIntegrityStatus = 'verified' | 'unverified' | 'rejected';
export type MediaArtifactRightsStatus = 'pending' | 'authorized' | 'restricted';
export type MediaArtifactHumanReviewStatus = 'pending' | 'approved' | 'rejected';
export type MediaArtifactSourceKind =
  | 'manual_upload'
  | 'provider_callback'
  | 'external_reference'
  | 'cross_project_reuse'
  | 'placeholder'
  | 'legacy_migration';

export interface AssetIngestReport {
  schema_version: 'asset-ingest/v1';
  modality: SeedanceAssetModality;
  detected_mime_type: string;
  canonical_extension: string;
  byte_size: number;
  content_sha256: string;
  integrity_status: 'verified';
  quarantined: false;
  technical_metadata: {
    width?: number;
    height?: number;
    duration_sec?: number;
  };
  warnings: string[];
}

export interface MediaArtifact {
  schema_version: 'media-artifact/v1';
  artifact_id: string;
  version_id: string;
  modality: SeedanceAssetModality;
  mime_type?: string;
  size_bytes?: number;
  content_sha256: string | null;
  integrity_status: MediaArtifactIntegrityStatus;
  storage: {
    kind: 'local_immutable' | 'external_url' | 'provider_asset' | 'legacy_reference';
    file_id?: string;
    local_path?: string;
    external_url?: string;
    provider_asset_id?: string;
    preview_url?: string;
  };
  provenance: {
    source_kind: MediaArtifactSourceKind;
    provider?: string;
    model?: string;
    prompt_sha256?: string;
    source_project_id: string;
    source_story_id: string;
    source_version_id?: string;
    source_asset_id: string;
    created_at: string;
  };
  rights: {
    status: MediaArtifactRightsStatus;
    authorization_reference?: string;
    person_consent_reference?: string;
  };
  human_review: {
    status: MediaArtifactHumanReviewStatus;
    reviewer_id?: string;
    reviewed_at?: string;
    note?: string;
  };
  placeholder: boolean;
  production_credit_granted: boolean;
}

export type AssetBindingStatus =
  | 'missing_artifact'
  | 'placeholder_only'
  | 'bound_unverified'
  | 'rights_pending'
  | 'review_pending'
  | 'ready'
  | 'rejected';

export interface AssetBinding {
  schema_version: 'asset-binding/v1';
  binding_id: string;
  source_project_id: string;
  source_story_id: string;
  source_version_id?: string;
  asset_id: string;
  artifact_id: string | null;
  kind: SeedanceAssetReferenceKind;
  modality: SeedanceAssetModality;
  role: SeedanceAssetSlotRole;
  reference_slot?: string;
  source_scene_ids: number[];
  source_shot_ids: string[];
  status: AssetBindingStatus;
  rights_status: MediaArtifactRightsStatus;
  human_review_status: MediaArtifactHumanReviewStatus;
  placeholder: boolean;
  production_credit_granted: boolean;
}

export interface MediaAssetLibrary {
  schema_version: 'media-asset-library/v1';
  project_id: string;
  story_id: string;
  source_version_id?: string;
  generated_at: string;
  artifacts: MediaArtifact[];
  bindings: AssetBinding[];
  summary: {
    artifact_count: number;
    binding_count: number;
    verified_artifact_count: number;
    placeholder_artifact_count: number;
    production_credit_binding_count: number;
    legacy_unverified_artifact_count: number;
    missing_artifact_binding_count: number;
  };
  migration: {
    source_schema_version: 'seedance-asset-library/v1';
    legacy_item_count: number;
    migrated_without_credit_count: number;
  };
}

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
  | 'provider_callback'
  | 'rights_review'
  | 'human_visual_review'
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
  content_sha256?: string;
  rights_status?: MediaArtifactRightsStatus;
  authorization_reference?: string;
  person_consent_reference?: string;
  human_review_status?: MediaArtifactHumanReviewStatus;
  reviewer_id?: string;
  reviewed_at?: string;
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
  /** Stage C compatibility fields; old v1 items omit them and migrate fail-closed. */
  content_sha256?: string;
  prompt_sha256?: string;
  model?: string;
  rights_status?: MediaArtifactRightsStatus;
  authorization_reference?: string;
  person_consent_reference?: string;
  human_review_status?: MediaArtifactHumanReviewStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  review_note?: string;
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
  content_sha256: string;
  preview_url: string;
  ingest: AssetIngestReport;
}

export interface MediaAssetReviewUpdateRequest {
  asset_id: string;
  expected_content_sha256?: string;
  rights_status?: MediaArtifactRightsStatus;
  authorization_reference?: string;
  person_consent_reference?: string;
  human_review_status?: MediaArtifactHumanReviewStatus;
  review_note?: string;
}

export interface MediaAssetReviewUpdateResult {
  detail: StoryProjectDetail;
  asset: SeedanceAssetLibraryItem;
  artifact: MediaArtifact;
  binding: AssetBinding;
  reviewer_id: string;
  reviewed_at: string;
  production_credit_granted: boolean;
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
  content_sha256?: string;
  rights_status?: MediaArtifactRightsStatus;
  human_review_status?: MediaArtifactHumanReviewStatus;
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
  sourceDomain: string;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRecord;
  execution_cost?: AiComicSeedanceExecutionCostRecord;
}

export interface AiComicSeedanceExecutionCostRecord {
  actual_cost_amount: number;
  cost_currency: string;
  provider_reported_at: string;
  reporting_channel: 'callback_or_poll';
  boundary_status: GearsExecutionCostBoundaryStatus;
  authorization_reference?: string;
  authorized_max_cost_amount?: number;
  authorization_total_actual_cost_amount?: number;
}

export type AiComicSeedanceExecutionCostGovernanceStatus =
  | 'not_applicable'
  | 'clear'
  | 'blocked';

export interface AiComicSeedanceExecutionCostGovernanceSummary {
  status: AiComicSeedanceExecutionCostGovernanceStatus;
  authorized_shot_count: number;
  reported_cost_count: number;
  pending_terminal_cost_report_count: number;
  boundary_violation_count: number;
  exceeded_authorization_count: number;
  currency_mismatch_count: number;
  authorization_missing_count: number;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRecord;
  execution_cost?: AiComicSeedanceExecutionCostRecord;
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
  actual_cost_amount?: number | string;
  actualCostAmount?: number | string;
  cost_currency?: string;
  costCurrency?: string;
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
  cost_governance: AiComicSeedanceExecutionCostGovernanceSummary;
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
  current_release?: AiComicSeedanceFinalDeliveryReleaseRecord;
  release_history?: AiComicSeedanceFinalDeliveryReleaseRecord[];
  rollback_events?: AiComicSeedanceFinalDeliveryRollbackEvent[];
}

export interface AiComicSeedanceFinalDeliveryReleaseRecord {
  schema_version: 'ai-comic-seedance-final-delivery-release/v1';
  release_id: string;
  created_at: string;
  source: 'local_assembly';
  immutable: true;
  canonical_output_path: string;
  canonical_manifest_path: string;
  archived_output_path: string;
  archived_manifest_path: string;
  output_sha256: string;
  manifest_sha256: string;
  output_byte_size: number;
  manifest_byte_size: number;
  output_profile: AiComicSeedanceFinalDeliveryOutputProfile;
}

export interface AiComicSeedanceFinalDeliveryRollbackEvent {
  event_id: string;
  rolled_back_at: string;
  target_release_id: string;
  previous_release_id?: string;
  actor_id: string;
  authentication_method: string;
  reason: string;
  output_sha256_verified: true;
  manifest_sha256_verified: true;
}

export interface AiComicSeedanceFinalDeliveryRollbackRequest {
  release_id: string;
  confirmed: boolean;
  reason: string;
}

export interface AiComicSeedanceFinalDeliveryRollbackResult {
  schema_version: 'ai-comic-series-seedance-final-delivery-rollback-result/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  rolled_back_at: string;
  previous_release_id?: string;
  target_release: AiComicSeedanceFinalDeliveryReleaseRecord;
  seedance_final_delivery: AiComicSeedanceFinalDeliveryLedger;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRequest;
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
  external_call_authorization?: ExternalProviderCallAuthorizationRecord;
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

export type AiComicSeedanceAssetReferenceKind = 'character' | 'costume' | 'location' | 'prop' | 'unknown';

export type AiComicSeedanceAssetIdentityBindingStatus = 'pending' | 'approved' | 'changes_requested' | 'stale';

export interface AiComicSeedanceAssetIdentityBinding {
  series_identity_id: string;
  source_fingerprint: string;
  visual_definition_fingerprint: string;
  status: AiComicSeedanceAssetIdentityBindingStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  review_note?: string;
  human_confirmed: boolean;
}

export interface AiComicSeedanceAssetReferenceItem {
  asset_id: string;
  series_identity_id?: string;
  identity_binding_status?: AiComicSeedanceAssetIdentityBindingStatus;
  kind: AiComicSeedanceAssetReferenceKind;
  label: string;
  reference_slot?: string;
  file_url?: string;
  file_id?: string;
  local_path?: string;
  original_filename?: string;
  provider?: string;
  content_sha256?: string;
  rights_status?: MediaArtifactRightsStatus;
  authorization_reference?: string;
  person_consent_reference?: string;
  human_review_status?: MediaArtifactHumanReviewStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  review_note?: string;
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
  local_path?: string;
  original_filename?: string;
  mime_type?: string;
  size_bytes?: number;
  provider?: string;
  provider_asset_id?: string;
  content_sha256?: string;
  prompt_sha256?: string;
  model?: string;
  rights_status?: MediaArtifactRightsStatus;
  authorization_reference?: string;
  person_consent_reference?: string;
  human_review_status?: MediaArtifactHumanReviewStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  review_note?: string;
  identity_binding?: AiComicSeedanceAssetIdentityBinding;
  history?: SeedanceAssetHistoryEvent[];
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
    series_identity_id?: string;
  }>;
}

export interface AiComicSeedanceAssetFileUploadResult {
  detail: AiComicSeriesProjectDetail;
  asset: AiComicSeedanceAssetLibraryItem;
  file_id: string;
  local_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  content_sha256: string;
  preview_url: string;
  ingest: AssetIngestReport;
}

export interface AiComicSeriesMediaAssetReviewUpdateResult {
  detail: AiComicSeriesProjectDetail;
  asset: AiComicSeedanceAssetLibraryItem;
  reviewer_id: string;
  reviewed_at: string;
  production_credit_granted: boolean;
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
  required_series_identity_ids: string[];
  missing_reference_asset_ids: string[];
  reference_slots: string[];
  prompt_preview: string;
}

export type AiComicSeriesVisualProductionCompletionStatus =
  | 'needs_visual_definitions'
  | 'needs_human_approvals'
  | 'needs_real_asset_files'
  | 'needs_production_credit'
  | 'ready_for_provider'
  | 'provider_in_progress'
  | 'complete';

export type AiComicSeriesVisualProductionStageKey =
  | 'visual_definitions'
  | 'human_approvals'
  | 'real_asset_files'
  | 'production_credit'
  | 'provider_shot_films';

export interface AiComicSeriesVisualProductionCompletionStage {
  key: AiComicSeriesVisualProductionStageKey;
  label: string;
  status: 'complete' | 'current' | 'blocked';
  current_count: number;
  required_count: number;
  next_action: string;
  completion_rule: string;
  operator_required: boolean;
}

export interface AiComicSeriesVisualProductionCompletionIdentity {
  identity_id: string;
  kind: AiComicSeriesVisualIdentityKind;
  label: string;
  missing_definition_fields: string[];
  definition_ready: boolean;
  definition_approved: boolean;
  asset_id?: string;
  functional_test_asset_ready: boolean;
  functional_test_identity_mapping_current: boolean;
  immutable_local_file_ready: boolean;
  rights_authorized: boolean;
  human_media_review_approved: boolean;
  current_identity_mapping_approved: boolean;
  production_credit: boolean;
  next_action: string;
}

export interface AiComicSeriesVisualProductionCompletionPlan {
  overall_status: AiComicSeriesVisualProductionCompletionStatus;
  summary: {
    identity_total: number;
    identity_definition_ready_count: number;
    identity_approved_count: number;
    world_rule_total: number;
    world_rule_definition_ready_count: number;
    world_rule_approved_count: number;
    pilot_binding_blocker_count: number;
    functional_test_asset_count: number;
    functional_test_identity_mapping_count: number;
    immutable_local_file_count: number;
    rights_authorized_count: number;
    human_media_review_approved_count: number;
    current_identity_mapping_approved_count: number;
    production_credit_count: number;
    provider_required_shot_count: number;
    provider_ready_shot_count: number;
  };
  stages: AiComicSeriesVisualProductionCompletionStage[];
  identities: AiComicSeriesVisualProductionCompletionIdentity[];
  blocking_issues: string[];
  real_completion_boundary: string;
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
  visual_bible: AiComicSeriesVisualBible;
  completion_plan: AiComicSeriesVisualProductionCompletionPlan;
  assets: AiComicSeedanceAssetReferenceItem[];
  shots: AiComicSeedanceShotAssetBinding[];
  markdown: string;
}

export interface AiComicSeriesSeedancePreproductionEpisode {
  episode_no: number;
  episode_title: string;
  story_id: string;
  story: {
    title: string;
    logline: string;
    theme: string;
    full_text: string;
    scene_breakdown: StoryScene[];
    gears_segments: GearsSegment[];
    cultural_constraints: string[];
    credibility_note: string;
  };
  script: {
    shot_count: number;
    total_duration_sec: number;
    shots: SeedancePromptShotUnit[];
  };
  seedance_prompt_package: SeedancePromptPackage;
  shot_asset_bindings: AiComicSeedanceShotAssetBinding[];
}

export interface AiComicSeriesSeedancePreproductionPackage {
  schema_version: 'ai-comic-series-seedance-preproduction-package/v1';
  project: AiComicSeriesProjectMeta;
  series_title: string;
  exported_at: string;
  target_platform: 'seedance_2_0';
  boundary: {
    story_agent_delivers: Array<'story' | 'script' | 'seedance_prompt' | 'image_asset'>;
    video_generation_in_scope: false;
    video_generation_executor: 'user_in_seedance';
    human_test_required_for_functional_acceptance: false;
    rights_or_human_review_grants_production_credit: false;
  };
  acceptance: {
    status: 'ready' | 'blocked';
    story_episode_count: number;
    expected_episode_count: number;
    script_shot_count: number;
    seedance_prompt_shot_count: number;
    image_asset_count: number;
    immutable_image_asset_count: number;
    current_identity_mapping_count: number;
    expected_identity_count: number;
    bound_shot_count: number;
    unbound_shot_count: number;
    blockers: string[];
    warnings: string[];
  };
  episodes: AiComicSeriesSeedancePreproductionEpisode[];
  image_assets: AiComicSeedanceAssetReferenceItem[];
  visual_bible: AiComicSeriesVisualBible;
  missing_episodes: AiComicSeriesSeedanceExportPackage['missing_episodes'];
  markdown: string;
}

export type StoryAgentSeedancePreproductionSourceKind =
  | 'story'
  | 'story_project'
  | 'ai_comic_series_project';

export interface StoryAgentSeedancePreproductionImageAsset {
  asset_id: string;
  source_kind: StoryAgentSeedancePreproductionSourceKind;
  source_asset_id: string;
  series_identity_id?: string;
  kind: SeedanceAssetReferenceKind | AiComicSeedanceAssetReferenceKind;
  label: string;
  reference_slot: string;
  local_path: string;
  content_sha256: string;
  provider?: string;
  provider_asset_id?: string;
  prompt_sha256?: string;
  model?: string;
  file_integrity_verified: true;
  source_story_ids: string[];
  source_shot_ids: string[];
  required_by_shot_count: number;
  rights_status?: MediaArtifactRightsStatus;
  human_review_status?: MediaArtifactHumanReviewStatus;
}

export interface StoryAgentSeedancePreproductionShotAssetBinding {
  unit_id: string;
  story_id: string;
  shot_id: string;
  source_scene_id?: number;
  required_asset_ids: string[];
  delivered_asset_ids: string[];
  missing_asset_ids: string[];
  reference_slots: string[];
}

export interface StoryAgentSeedancePreproductionStoryUnit {
  unit_id: string;
  order: number;
  title: string;
  story_id: string;
  project_id?: string;
  episode_no?: number;
  professional_text_package?: ProfessionalTextPackage;
  story: {
    title: string;
    logline: string;
    theme: string;
    full_text: string;
    scene_breakdown: StoryScene[];
    gears_segments: GearsSegment[];
    cultural_constraints: string[];
    credibility_note: string;
    reference_safety_report?: ReferenceGenerationSafetyReport;
  };
  script: {
    shot_count: number;
    total_duration_sec: number;
    shots: SeedancePromptShotUnit[];
  };
  seedance_prompt_package: SeedancePromptPackage;
  shot_asset_bindings: StoryAgentSeedancePreproductionShotAssetBinding[];
}

export interface StoryAgentSeedancePreproductionPackage {
  schema_version: 'story-agent-seedance-preproduction-package/v1';
  source: {
    kind: StoryAgentSeedancePreproductionSourceKind;
    source_id: string;
    title: string;
    story_ids: string[];
  };
  exported_at: string;
  target_platform: 'seedance_2_0';
  boundary: {
    story_agent_delivers: Array<'story' | 'professional_script' | 'seedance_prompt' | 'image_asset'>;
    video_generation_in_scope: false;
    video_generation_executor: 'user_in_seedance';
    human_test_required_for_functional_acceptance: false;
    rights_or_human_review_grants_production_credit: false;
  };
  acceptance: {
    status: 'ready' | 'blocked';
    story_unit_count: number;
    expected_story_unit_count: number;
    professional_script_count: number;
    script_shot_count: number;
    seedance_prompt_shot_count: number;
    expected_image_asset_count: number;
    image_asset_count: number;
    file_integrity_verified_image_asset_count: number;
    current_asset_mapping_count: number;
    bound_shot_count: number;
    unbound_shot_count: number;
    reference_safety: {
      status: 'not_available' | 'not_applicable' | 'passed' | 'passed_with_limits' | 'blocked';
      report_count: number;
      expected_report_count: number;
      similarity_completed_count: number;
      real_similarity_completed_count: number;
      blockers: string[];
      warnings: string[];
      machine_validation_only: true;
      human_review_complete: false;
      real_credit_granted: false;
    };
    blockers: string[];
    warnings: string[];
  };
  story_units: StoryAgentSeedancePreproductionStoryUnit[];
  image_assets: StoryAgentSeedancePreproductionImageAsset[];
  series?: {
    project: AiComicSeriesProjectMeta;
    visual_bible: AiComicSeriesVisualBible;
    missing_episodes: AiComicSeriesSeedanceExportPackage['missing_episodes'];
  };
  markdown: string;
}

export interface StoryAgentSeedancePreproductionExportRequest {
  story_id?: string;
  project_id?: string;
  series_project_id?: string;
}

export interface StoryAgentRunStartRequest {
  project_id?: string;
  series_project_id?: string;
}

export interface StoryAgentRunGenerateRequest {
  idempotency_key: string;
  generation_request: StoryGenerateRequest;
}

export type StoryAgentRunStage =
  | 'generation'
  | 'story_project'
  | 'source'
  | 'professional_script'
  | 'seedance_prompt'
  | 'image_assets'
  | 'preproduction_package';

export type StoryAgentRunStageStatus =
  | 'pending'
  | 'ready'
  | 'awaiting_external_action'
  | 'failed_retryable'
  | 'blocked';

export interface StoryAgentRunStageResult {
  stage: StoryAgentRunStage;
  status: StoryAgentRunStageStatus;
  evidence_refs: string[];
  blockers: string[];
  retryable_failures: string[];
}

export type StoryAgentRunWorkflowCheckpointKey =
  | 'evidence_supplement'
  | 'professional_package'
  | 'canonical_repair'
  | 'derived_state_rebuild';

export interface StoryAgentRunWorkflowCheckpointAttempt {
  attempt_number: number;
  status: StoryAgentRunStageStatus;
  started_at: string;
  completed_at: string;
  evidence_refs: string[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface StoryAgentRunWorkflowCheckpoint {
  checkpoint: StoryAgentRunWorkflowCheckpointKey;
  status: StoryAgentRunStageStatus;
  attempt_count: number;
  attempts: StoryAgentRunWorkflowCheckpointAttempt[];
  evidence_refs: string[];
  blockers: string[];
  retryable_failures: string[];
  action: {
    executor: 'canonical_project_service' | 'project_operator';
    operation:
      | 'update_project_supplement_task'
      | 'review_professional_text_package'
      | 'repair_project_quality'
      | 'rebuild_project_derived_state';
    endpoint?: string;
    automatic_on_run_resume: boolean;
  };
}

export interface StoryAgentRunImageRequestManifest {
  image_run_id: string;
  image_run_status: StoryAgentImageRun['status'];
  request_sha256: string;
  request_path: string;
  request: StoryAgentImageGenerationRequest;
  provider_invoked: false;
  executor: 'codex_imagegen';
  task_count: number;
  pending_task_count: number;
  verified_task_count: number;
  failed_retryable_task_count: number;
  blocked_task_count: number;
}

export interface StoryAgentProjectRun {
  schema_version: 'story-agent-run/v1';
  run_id: string;
  input_contract: {
    schema_version: 'story-agent-run-input/v1';
    project_id?: string;
    series_project_id?: string;
  };
  input_sha256: string;
  source: StoryAgentSeedancePreproductionPackage['source'];
  video_types: VideoType[];
  status:
    | 'in_progress'
    | 'awaiting_external_action'
    | 'failed_retryable'
    | 'ready'
    | 'blocked';
  current_stage: StoryAgentRunStage | 'complete';
  stage_results: StoryAgentRunStageResult[];
  workflow_checkpoints?: StoryAgentRunWorkflowCheckpoint[];
  blockers: string[];
  retryable_failures: string[];
  image_request_manifest?: StoryAgentRunImageRequestManifest;
  preproduction_package: StoryAgentSeedancePreproductionPackage;
  boundary: {
    canonical_services_reused: true;
    image_provider_invoked_by_server: false;
    video_generation_performed: false;
    human_review_credit_granted: false;
  };
  resume_count: number;
  created_at: string;
  updated_at: string;
}

export type StoryAgentRunGenerationProvenanceMode =
  | 'not_observed'
  | 'local_only'
  | 'local_fallback'
  | 'record_replay_fixture'
  | 'live_external';

export interface StoryAgentRunGenerationProvenance {
  mode: StoryAgentRunGenerationProvenanceMode;
  requested_model_profile_id?: string;
  effective_model_profile_id?: string;
  external_model_call_performed: boolean | null;
  generation_used_fallback: boolean | null;
}

export interface StoryAgentRunGenerationAttempt {
  attempt_number: number;
  status: 'in_progress' | 'succeeded' | 'failed_retryable' | 'blocked';
  started_at: string;
  completed_at?: string;
  story_id?: string;
  project_id?: string;
  last_error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  provenance: StoryAgentRunGenerationProvenance;
}

export interface StoryAgentGenerationRun {
  schema_version: 'story-agent-run/v2';
  run_id: string;
  input_contract: {
    schema_version: 'story-agent-run-input/v2';
    kind: 'generation_request';
    idempotency_key: string;
    generation_request: StoryGenerateRequest;
  };
  input_sha256: string;
  source: StoryAgentSeedancePreproductionPackage['source'] | null;
  video_types: VideoType[];
  status:
    | 'in_progress'
    | 'awaiting_external_action'
    | 'failed_retryable'
    | 'ready'
    | 'blocked';
  current_stage: StoryAgentRunStage | 'complete';
  stage_results: StoryAgentRunStageResult[];
  workflow_checkpoints?: StoryAgentRunWorkflowCheckpoint[];
  blockers: string[];
  retryable_failures: string[];
  generation_checkpoint: {
    status: StoryAgentRunGenerationAttempt['status'];
    request_sha256: string;
    attempt_count: number;
    story_id?: string;
    project_id?: string;
    attempts: StoryAgentRunGenerationAttempt[];
    last_error?: StoryAgentRunGenerationAttempt['last_error'];
    provenance: StoryAgentRunGenerationProvenance;
  };
  image_request_manifest?: StoryAgentRunImageRequestManifest;
  preproduction_package?: StoryAgentSeedancePreproductionPackage;
  access_control?: import('./product-access.js').ProductResourceOwnership;
  boundary: {
    canonical_services_reused: true;
    image_provider_invoked_by_server: false;
    video_generation_performed: false;
    human_review_credit_granted: false;
  };
  resume_count: number;
  created_at: string;
  updated_at: string;
}

export type StoryAgentRun = StoryAgentProjectRun | StoryAgentGenerationRun;

export type StoryAgentRunKind =
  | 'generation_request'
  | 'existing_project'
  | 'existing_series';

export interface StoryAgentRunListQuery {
  limit: number;
  cursor?: string;
  status?: StoryAgentRun['status'];
  kind?: StoryAgentRunKind;
  source_kind?: 'story_project' | 'ai_comic_series_project';
}

export interface StoryAgentRunListItem {
  run_id: string;
  schema_version: StoryAgentRun['schema_version'];
  kind: StoryAgentRunKind;
  source: StoryAgentRun['source'];
  generation_request?: {
    entry_name?: string;
    video_type?: VideoType;
  };
  video_types: VideoType[];
  status: StoryAgentRun['status'];
  current_stage: StoryAgentRun['current_stage'];
  blocker_count: number;
  retryable_failure_count: number;
  primary_blocker?: string;
  image_tasks?: {
    total: number;
    pending: number;
    verified: number;
    failed_retryable: number;
    blocked: number;
  };
  resume_count: number;
  created_at: string;
  updated_at: string;
}

export interface StoryAgentRunListResponse {
  schema_version: 'story-agent-run-list/v1';
  items: StoryAgentRunListItem[];
  page: {
    limit: number;
    scanned_count: number;
    has_more: boolean;
    next_cursor?: string;
  };
  filters: {
    status?: StoryAgentRun['status'];
    kind?: StoryAgentRunKind;
    source_kind?: 'story_project' | 'ai_comic_series_project';
  };
  boundary: {
    full_ledgers_omitted: true;
    max_scanned_ledgers: 250;
  };
}

export interface StoryAgentRunExportResponse {
  schema_version: 'story-agent-run-export/v1' | 'story-agent-run-export/v2';
  run_id: string;
  run_status: StoryAgentRun['status'];
  exported_at: string;
  video_generation_performed: false;
  preproduction_package: StoryAgentSeedancePreproductionPackage | null;
}

export interface StoryAgentRunImageImportResponse {
  schema_version: 'story-agent-run-image-import/v1';
  imported_at: string;
  image_import: StoryAgentImageResultImportResponse;
  run: StoryAgentRun;
}

export interface StoryAgentVisualAssetPressureOpsStatus {
  schema_version: 'story-agent-visual-asset-pressure-ops-status/v1';
  inspected_at: string;
  status: 'ready' | 'blocked' | 'not_run';
  report: {
    relative_path: 'system/story-agent-visual-asset-pressure/report.json';
    file_exists: boolean;
    schema_valid: boolean;
    generated_at?: string;
  };
  coverage: {
    case_count: number;
    unique_source_id_count: number;
    unique_style_family_count: number;
    unique_character_label_count: number;
    unique_location_label_count: number;
    unique_content_sha256_count: number;
    cross_case_content_reuse_count: number;
    semantic_gate_passed_case_count: number;
    source_content_sha256_verified_asset_count: number;
    media_signature_verified_asset_count: number;
    immutable_preview_verified_asset_count: number;
    identity_mapping_current_asset_count: number;
  };
  scenario_summary: {
    required_count: number;
    passed_count: number;
    failed_count: number;
    not_run_count: number;
  };
  composition_provenance: {
    status: 'verified' | 'blocked' | 'not_run';
    batch_count: number;
    sealed_batch_count: number;
    legacy_unsealed_batch_count: number;
    file_count: number;
    verified_file_count: number;
  };
  blockers: string[];
  warnings: string[];
  machine_validation_only: true;
  image_provider_invoked_by_server: false;
  video_generation_performed: false;
  production_credit_granted: false;
}

export type StoryAgentImageTaskStatus =
  | 'planned'
  | 'awaiting_imagegen'
  | 'generated'
  | 'ingested'
  | 'bound'
  | 'verified'
  | 'failed_retryable'
  | 'blocked';

export interface StoryAgentImageGenerationRequestTask {
  task_id: string;
  kind: StoryImageAssetRequirementKind | AiComicSeriesVisualIdentityKind;
  label: string;
  target_asset_ids: string[];
  series_identity_ids: string[];
  reference_slot?: string;
  source_story_ids: string[];
  source_scene_ids: number[];
  source_shot_ids: string[];
  prompt: string;
  negative_constraints: string[];
  prompt_sha256: string;
  expected_output_path: string;
  action: 'generate' | 'reuse_verified';
}

export interface StoryAgentImageGenerationRequest {
  schema_version: 'image-generation-request/v1';
  run_id: string;
  source: StoryAgentSeedancePreproductionPackage['source'];
  created_at: string;
  request_sha256: string;
  run_directory: string;
  output_directory: string;
  provider_invoked: false;
  executor: 'codex_imagegen';
  task_count: number;
  pending_task_count: number;
  verified_task_count: number;
  tasks: StoryAgentImageGenerationRequestTask[];
  instructions: string[];
}

export interface StoryAgentImageGenerationResultItem {
  task_id: string;
  covers_task_ids?: string[];
  status: Extract<StoryAgentImageTaskStatus, 'generated' | 'failed_retryable' | 'blocked'>;
  output_path?: string;
  mime_type?: string;
  content_sha256?: string;
  prompt_sha256: string;
  provider?: string;
  provider_asset_id?: string;
  model?: string;
  failure_reason?: string;
  retryable?: boolean;
}

export interface StoryAgentImageGenerationResult {
  schema_version: 'image-generation-result/v1';
  run_id: string;
  request_sha256: string;
  completed_at: string;
  items: StoryAgentImageGenerationResultItem[];
}

export interface StoryAgentImageRunAttempt {
  attempt_no: number;
  recorded_at: string;
  result_status: StoryAgentImageGenerationResultItem['status'];
  content_sha256?: string;
  provider?: string;
  provider_asset_id?: string;
  model?: string;
  failure_reason?: string;
}

export interface StoryAgentImageRunTask {
  task_id: string;
  status: StoryAgentImageTaskStatus;
  prompt_sha256: string;
  target_asset_ids: string[];
  series_identity_ids: string[];
  content_sha256?: string;
  local_paths: string[];
  attempts: StoryAgentImageRunAttempt[];
  last_error?: string;
  updated_at: string;
}

export interface StoryAgentImageRun {
  schema_version: 'story-agent-image-run/v1';
  run_id: string;
  source: StoryAgentSeedancePreproductionPackage['source'];
  status: 'awaiting_imagegen' | 'in_progress' | 'complete' | 'blocked';
  created_at: string;
  updated_at: string;
  request_path: string;
  result_path: string;
  request: StoryAgentImageGenerationRequest;
  tasks: StoryAgentImageRunTask[];
  summary: {
    task_count: number;
    awaiting_imagegen_count: number;
    generated_count: number;
    ingested_count: number;
    bound_count: number;
    verified_count: number;
    failed_retryable_count: number;
    blocked_count: number;
  };
  preproduction_acceptance: StoryAgentSeedancePreproductionPackage['acceptance'];
}

export interface StoryAgentImageRunExportRequest {
  project_id?: string;
  series_project_id?: string;
}

export interface StoryAgentImageResultImportResponse {
  schema_version: 'story-agent-image-result-import/v1';
  imported_at: string;
  processed_item_count: number;
  ingested_task_count: number;
  verified_task_count: number;
  skipped_idempotent_task_count: number;
  failed_task_count: number;
  run: StoryAgentImageRun;
  preproduction_package: StoryAgentSeedancePreproductionPackage;
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

export type StoryImageAssetRequirementKind = 'character' | 'location' | 'prop';

export interface StoryImageAssetRequirement {
  schema_version: 'story-image-asset-requirement/v1';
  requirement_id: string;
  asset_id: string;
  asset_kind: StoryImageAssetRequirementKind;
  label: string;
  job_type: Extract<GearsExecutionJobType, 'character_image' | 'scene_image' | 'prop_image'>;
  source_unit_id: string;
  reference_slot?: string;
  source_scene_ids: number[];
  source_shot_ids: string[];
  prompt: string;
  negative_constraints: string[];
  binding_status: AssetBindingStatus;
  provider_invoked: false;
  production_credit_granted: boolean;
}

export interface StoryImageAssetJobPlan {
  schema_version: 'story-image-asset-job-plan/v1';
  project_id: string;
  story_id: string;
  source_version_id?: string;
  generated_at: string;
  provider_invoked: false;
  production_credit_count: number;
  summary: {
    requirement_count: number;
    character_requirement_count: number;
    location_requirement_count: number;
    prop_requirement_count: number;
    ready_to_submit_count: number;
    production_ready_count: number;
  };
  requirements: StoryImageAssetRequirement[];
}

export interface StoryProductionBoardShotUnit {
  shot_id: string;
  source_scene_id: number;
  source_unit_id: string;
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
  | 'media_asset_library'
  | 'image_asset_job_plan'
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
  media_asset_library: MediaAssetLibrary;
  image_asset_job_plan: StoryImageAssetJobPlan;
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
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
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
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  writeback_updated_at?: string;
}

export interface DomainPackExpansionReviewStateUpdateRequest {
  review_item_id: string;
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
}

export interface DomainPackExpansionReviewStateBulkUpdateRequest {
  review_item_ids: string[];
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
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
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
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

export interface DomainPackExpansionReviewClosureBatchSummary {
  signoff_batch_id: string;
  signoff_batch_note?: string;
  item_count: number;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  review_status_counts: Record<DomainPackExpansionReviewStatus, number>;
  writeback_status_counts: Record<KnowledgeWritebackStatus, number>;
}

export interface DomainPackExpansionReviewClosureSummary {
  schema_version: 'domain-pack-expansion-review-closure/v1';
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  ready_for_human_handoff: boolean;
  review_item_count: number;
  approved_count: number;
  draft_ready_count: number;
  queued_count: number;
  written_back_count: number;
  needs_revision_count: number;
  review_ready_item_count: number;
  review_blocked_item_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  signoff_batch_count: number;
  missing_signoff_batch_count: number;
  runtime_override_count: number;
  seed_sourced_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  manual_writeback_required_count: number;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
  signoff_batch_summaries: DomainPackExpansionReviewClosureBatchSummary[];
  closure_checks: string[];
}

export interface DomainPackExpansionWritebackHandoffSummary {
  schema_version: 'domain-pack-expansion-writeback-handoff-summary/v1';
  ready_for_unified_export: boolean;
  target_file_count: number;
  target_files: string[];
  approved_draft_count: number;
  signoff_batch_count: number;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
  source_ref_count: number;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  writeback_queue_path: '/knowledge-writeback-queue';
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
  source_ref_coverage_percent: number;
  source_ref_quality_level: KnowledgeWritebackSourceRefQualityLevel;
  source_ref_blocker_count: number;
  source_ref_warning_count: number;
  writeback_status_counts: Record<KnowledgeWritebackStatus, number>;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  safety_note: string;
}

export type KnowledgeWritebackSourceRefQualityLevel = 'pass' | 'warning' | 'blocker';
export type KnowledgeWritebackSourceRefCheckStatus = 'pass' | 'warning' | 'blocker';
export type KnowledgeWritebackSourceRefCheckReason =
  | 'local_file_exists'
  | 'local_file_exists_no_anchor'
  | 'local_file_missing'
  | 'anchor_found'
  | 'anchor_missing_manual_review'
  | 'external_source_ref'
  | 'project_markdown_reference'
  | 'unparsed_source_ref';

export interface KnowledgeWritebackSourceRefCheck {
  source_ref: string;
  source_kind: 'project' | 'domain_pack_expansion';
  item_id: string;
  target_file: string;
  local_path?: string;
  anchor?: string;
  file_exists: boolean;
  anchor_checked: boolean;
  anchor_found: boolean;
  status: KnowledgeWritebackSourceRefCheckStatus;
  reason: KnowledgeWritebackSourceRefCheckReason;
}

export interface KnowledgeWritebackSourceRefQualityItem {
  item_id: string;
  source_kind: 'project' | 'domain_pack_expansion';
  title: string;
  target_file: string;
  candidate_field_count: number;
  checked_field_count: number;
  covered_field_count: number;
  source_ref_count: number;
  missing_source_ref_field_count: number;
  missing_verification_note_field_count: number;
  missing_writeback_hint_field_count: number;
  coverage_percent: number;
  quality_level: KnowledgeWritebackSourceRefQualityLevel;
  blocker_reasons: string[];
  warning_reasons: string[];
}

export interface KnowledgeWritebackSourceRefQualitySummary {
  schema_version: 'knowledge-writeback-source-ref-quality/v1';
  total_item_count: number;
  project_item_count: number;
  expansion_item_count: number;
  checked_field_count: number;
  covered_field_count: number;
  source_ref_count: number;
  missing_source_ref_field_count: number;
  missing_verification_note_field_count: number;
  missing_writeback_hint_field_count: number;
  coverage_percent: number;
  pass_item_count: number;
  warning_item_count: number;
  blocker_item_count: number;
  source_ref_check_count: number;
  source_ref_check_pass_count: number;
  source_ref_check_warning_count: number;
  source_ref_check_blocker_count: number;
  local_source_ref_count: number;
  file_missing_source_ref_count: number;
  anchor_missing_source_ref_count: number;
  source_ref_checks: KnowledgeWritebackSourceRefCheck[];
  items: KnowledgeWritebackSourceRefQualityItem[];
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
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
  writeback_note?: string;
  candidate_field_count: number;
  source_ref_count: number;
  required_action: string;
}

export interface KnowledgeWritebackQueueSignoffBatchSummary {
  signoff_batch_id: string;
  signoff_batch_note?: string;
  item_count: number;
  project_handoff_count: number;
  expansion_handoff_count: number;
  requires_manual_signoff_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  status_counts: Record<KnowledgeWritebackStatus, number>;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
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
  signoff_batch_ids: string[];
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
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  signoff_batch_count: number;
  missing_signoff_batch_count: number;
  signoff_batch_ids: string[];
  signoff_batch_summaries: KnowledgeWritebackQueueSignoffBatchSummary[];
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
  signoff_batch_summaries: KnowledgeWritebackQueueSignoffBatchSummary[];
  operator_checklist: string[];
  handoff_item_count: number;
  handoff_items: KnowledgeWritebackQueueReviewHandoffItem[];
}

export interface KnowledgeWritebackManualPatchTarget {
  target_file: string;
  patch_applyable: false;
  manual_apply_only: true;
  ready_for_manual_apply: boolean;
  project_patch_count: number;
  expansion_patch_count: number;
  total_patch_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  source_ref_coverage_percent: number;
  source_ref_quality_level: KnowledgeWritebackSourceRefQualityLevel;
  blocker_reasons: string[];
  warning_reasons: string[];
  append_markdown: string;
  review_diff: string;
  diff_preview_lines: string[];
  diff_preview_truncated: boolean;
  safety_checks: string[];
}

export interface KnowledgeWritebackManualPatchManifest {
  schema_version: 'knowledge-writeback-manual-patch-manifest/v1';
  manifest_id: string;
  generated_at: string;
  sha256: string;
  target_file_count: number;
  ready_target_file_count: number;
  blocked_target_file_count: number;
  total_patch_count: number;
  source_ref_check_warning_count: number;
  source_ref_check_blocker_count: number;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  patch_applyable: false;
  manual_apply_only: true;
  target_files: string[];
}

export interface KnowledgeWritebackManualPatchClosureCertificate {
  schema_version: 'knowledge-writeback-manual-patch-closure-certificate/v1';
  certificate_id: string;
  generated_at: string;
  sha256: string;
  status: 'ready_for_operator_apply' | 'blocked';
  ready_for_operator_apply: boolean;
  manual_patch_manifest_id: string;
  manual_patch_manifest_sha256: string;
  signoff_manifest_id: string;
  signoff_manifest_sha256: string;
  target_file_count: number;
  ready_target_file_count: number;
  blocked_target_file_count: number;
  total_patch_count: number;
  source_ref_check_warning_count: number;
  source_ref_check_blocker_count: number;
  blocker_reason_count: number;
  warning_reason_count: number;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  patch_applyable: false;
  manual_apply_only: true;
  operator_required_actions: string[];
}

export interface KnowledgeWritebackManualPatchPackage {
  schema_version: 'knowledge-writeback-manual-patch-package/v1';
  exported_at: string;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  patch_applyable: false;
  manual_apply_only: true;
  ready_for_manual_apply: boolean;
  target_file_count: number;
  target_files: string[];
  ready_target_file_count: number;
  blocked_target_file_count: number;
  total_patch_count: number;
  project_patch_count: number;
  expansion_patch_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  source_ref_quality: KnowledgeWritebackSourceRefQualitySummary;
  manual_patch_manifest: KnowledgeWritebackManualPatchManifest;
  manual_patch_closure_certificate: KnowledgeWritebackManualPatchClosureCertificate;
  ready_reasons: string[];
  blocker_reasons: string[];
  warning_reasons: string[];
  safety_checks: string[];
  operator_checklist: string[];
  target_patches: KnowledgeWritebackManualPatchTarget[];
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
  source_ref_quality: KnowledgeWritebackSourceRefQualitySummary;
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
  manual_patch_package: KnowledgeWritebackManualPatchPackage;
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
  review_closure: DomainPackExpansionReviewClosureSummary;
  writeback_handoff: DomainPackExpansionWritebackHandoffSummary;
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
  applicable_source_domains?: string[];
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
export type ProductionMaterialPackRejectionCode =
  | 'required_non_blank_string'
  | 'unsupported_video_type'
  | 'duplicate_video_type'
  | 'required_object'
  | 'required_non_blank_string_array'
  | 'optional_non_blank_string_array'
  | 'required_array'
  | 'optional_non_empty_unique_non_blank_string_array';

export interface ProductionMaterialPackRejectionDiagnostic {
  pack_index: number;
  code: ProductionMaterialPackRejectionCode;
  path: string;
}

export type ProductionMaterialPackFileDiagnosticCode =
  | 'source_unavailable'
  | 'required_object'
  | 'required_non_blank_string'
  | 'unsupported_schema_version'
  | 'required_array';

export interface ProductionMaterialPackFileDiagnostic {
  code: ProductionMaterialPackFileDiagnosticCode;
  path: string;
}

export interface ProductionMaterialPackHealthIssue {
  severity: ProductionMaterialPackIssueSeverity;
  issue_type:
    | 'missing_domain_sample_policy'
    | 'invalid_domain_sample_policy'
    | 'invalid_pack_file_structure'
    | 'invalid_pack_structure'
    | 'duplicate_pack_video_type'
    | 'missing_required_video_type'
    | 'unknown_required_field'
    | 'duplicate_required_field'
    | 'duplicate_sample_entry'
    | 'underfilled_prompt_layers'
    | 'underfilled_sample_entries'
    | 'underfilled_domain_sample_entries'
    | 'underfilled_supplement_questions'
    | 'underfilled_gate_items';
  video_type?: VideoType;
  source_domain?: string;
  message: string;
  details?: string[];
}

export interface ProductionMaterialPackHealthSummary {
  video_type: VideoType;
  label: string;
  required_field_count: number;
  prompt_layer_count: number;
  sample_entry_count: number;
  unique_sample_entry_count: number;
  duplicate_sample_entry_ids: string[];
  sample_entry_count_by_source_domain: Record<string, number>;
  minimum_sample_entry_count_by_source_domain: Record<string, number>;
  legacy_sample_entry_count: number;
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
  domain_sample_policy_valid: boolean;
  domain_sample_policy_video_types: VideoType[];
  pack_file_valid: boolean;
  pack_file_diagnostics: ProductionMaterialPackFileDiagnostic[];
  pack_count: number;
  rejected_pack_count: number;
  rejected_pack_diagnostics: ProductionMaterialPackRejectionDiagnostic[];
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
  | 'production_material_missing_field'
  | 'professional_evidence_missing';
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

export type SeriesPremiseTruthMode =
  | 'verified_fact'
  | 'oral_tradition'
  | 'legend'
  | 'fictional_mechanism';

export interface SeriesPremiseContractLockedCharacter {
  name: string;
  role?: string;
  required: boolean;
  evidence_span: string;
}

export interface SeriesPremiseContractWorldRule {
  rule_id: string;
  statement: string;
  required: boolean;
  consequence?: string;
  evidence_span: string;
}

export interface SeriesPremiseContractAntagonisticForce {
  label: string;
  function: string;
  required: boolean;
}

export interface SeriesPremiseContractCulturalBoundary {
  statement: string;
  truth_mode: SeriesPremiseTruthMode;
}

export interface SeriesPremiseContract {
  schema_version: 'series-premise-contract/v1';
  locked_characters: SeriesPremiseContractLockedCharacter[];
  world_rules: SeriesPremiseContractWorldRule[];
  antagonistic_forces: SeriesPremiseContractAntagonisticForce[];
  core_stakes: string[];
  must_cover_beats: string[];
  forbidden_substitutions: string[];
  cultural_boundaries: SeriesPremiseContractCulturalBoundary[];
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
  premise_contract?: SeriesPremiseContract;
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

export type AiComicCommercialOpeningHookType =
  | 'visual_anomaly'
  | 'countdown'
  | 'forbidden_action'
  | 'identity_gap'
  | 'evidence_reversal'
  | 'relationship_rupture';

export interface AiComicEpisodeCommercialBeats {
  schema_version: 'ai-comic-episode-commercial-beats/v1';
  hook_3s: string;
  opening_hook_type: AiComicCommercialOpeningHookType;
  episode_goal: string;
  external_pressure: string;
  failure_cost: string;
  midpoint_turn: string;
  character_choice: string;
  state_change: string;
  cliffhanger_question: string;
  opening_dialogue: string;
  scene_function_sequence: string[];
  signature_combo: string;
}

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
  premise_anchor_ids?: string[];
  commercial_beats?: AiComicEpisodeCommercialBeats;
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
  premise_anchor_ids?: string[];
  premise_anchors?: string[];
  commercial_beats?: AiComicEpisodeCommercialBeats;
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
  premise_contract?: SeriesPremiseContract;
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
  access_control?: import('./product-access.js').ProductResourceOwnership;
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

export type AiComicPremiseFidelityAnchorCategory =
  | 'character'
  | 'world_rule'
  | 'antagonistic_force'
  | 'core_stake';

export interface AiComicPremiseFidelityEvidenceItem {
  anchor_id: string;
  category: AiComicPremiseFidelityAnchorCategory;
  label: string;
  required: boolean;
  matched: boolean;
  evidence_spans: string[];
  episode_nos: number[];
}

export interface AiComicPremiseFidelityEpisodeReport {
  episode_no: number;
  hard_gate_passed: boolean;
  premise_coverage_score: number;
  missing_required_anchor_ids: string[];
  generic_substitution_issues: string[];
  evidence: AiComicPremiseFidelityEvidenceItem[];
}

export interface AiComicSeriesPremiseFidelityAudit {
  schema_version: 'ai-comic-series-premise-fidelity-audit/v2';
  hard_gate_passed: boolean;
  premise_coverage_score: number;
  named_character_coverage: number;
  world_rule_coverage: number;
  antagonistic_force_coverage: number;
  core_stakes_coverage: number;
  missing_required_anchor_ids: string[];
  generic_substitution_issues: string[];
  issues: string[];
  evidence: AiComicPremiseFidelityEvidenceItem[];
  episode_reports: AiComicPremiseFidelityEpisodeReport[];
}

export type AiComicCommercialBeatKey =
  | 'hook_3s'
  | 'episode_goal'
  | 'external_pressure'
  | 'failure_cost'
  | 'midpoint_turn'
  | 'character_choice'
  | 'state_change'
  | 'cliffhanger_question';

export interface AiComicCommercialQualityEvidenceItem {
  beat_key: AiComicCommercialBeatKey;
  label: string;
  matched: boolean;
  evidence_span?: string;
}

export interface AiComicCommercialQualityEpisodeReport {
  episode_no: number;
  machine_gate_passed: boolean;
  score: number;
  evidence: AiComicCommercialQualityEvidenceItem[];
  issues: string[];
}

export interface AiComicSeriesDiversityThresholds {
  max_adjacent_token_overlap: number;
  max_dialogue_token_overlap: number;
  max_hook_type_streak: number;
  max_scene_sequence_repetitions: number;
  max_signature_combo_streak: number;
}

export interface AiComicSeriesDiversityExactDuplicateGroup {
  normalized_hash: string;
  episode_nos: number[];
  evidence: string[];
}

export interface AiComicSeriesDiversityPairReport {
  left_episode_no: number;
  right_episode_no: number;
  token_overlap: number;
  dialogue_token_overlap: number;
  passed: boolean;
  issues: string[];
}

export interface AiComicSeriesDiversityReport {
  schema_version: 'ai-comic-series-diversity-report/v1';
  passed: boolean;
  score: number;
  thresholds: AiComicSeriesDiversityThresholds;
  exact_opening_duplicate_groups: AiComicSeriesDiversityExactDuplicateGroup[];
  adjacent_pair_reports: AiComicSeriesDiversityPairReport[];
  repeated_scene_function_sequences: Array<{
    sequence_key: string;
    episode_nos: number[];
  }>;
  hook_type_streak_issues: string[];
  signature_combo_streak_issues: string[];
  issues: string[];
}

export type AiComicHumanReviewDimension =
  | 'hook'
  | 'character'
  | 'dialogue'
  | 'progression'
  | 'turn'
  | 'ending'
  | 'cultural_credibility';

export interface AiComicHumanReviewScore {
  reviewer_id: string;
  blind: true;
  dimension: AiComicHumanReviewDimension;
  score: 1 | 2 | 3 | 4 | 5;
  note?: string;
  reviewed_at?: string;
}

export interface AiComicSeriesHumanReviewSubmitRequest {
  reviewer_id: string;
  blind: true;
  candidate_label: string;
  reviewer_packet_sha256: string;
  scores: Array<{
    dimension: AiComicHumanReviewDimension;
    score: 1 | 2 | 3 | 4 | 5;
    note?: string;
  }>;
}

export interface AiComicSeriesHumanReview {
  schema_version: 'ai-comic-series-human-review/v1';
  status: 'pending' | 'completed' | 'stale';
  blind_review_required: true;
  reviewer_count: number;
  dimension_averages: Partial<Record<AiComicHumanReviewDimension, number>>;
  overall_average?: number;
  minimum_dimension_average?: number;
  passed?: boolean;
  content_fingerprint?: string;
  reviewed_episode_story_ids?: Record<string, string>;
  candidate_label?: string;
  reviewer_packet_sha256?: string;
  scores: AiComicHumanReviewScore[];
  issues: string[];
}

export interface AiComicSeriesBlindReviewSceneSample {
  scene_order: number;
  title: string;
  location: string;
  time_of_day: string;
  dramatic_function: string;
  plot: string;
  key_action: string;
  dialogue_or_narration?: string;
  cultural_note?: string;
}

export interface AiComicSeriesBlindReviewEpisodeSample {
  sample_label: string;
  position_label: '开篇样本' | '中段样本' | '终局样本';
  title: string;
  full_text: string;
  scenes: AiComicSeriesBlindReviewSceneSample[];
}

export interface AiComicSeriesBlindReviewScorecardItem {
  dimension: AiComicHumanReviewDimension;
  label: string;
  review_prompt: string;
  score: null;
  note: string;
}

export interface AiComicSeriesBlindReviewReviewerPacket {
  schema_version: 'ai-comic-series-blind-review-reviewer-packet/v1';
  candidate_label: string;
  origin_hidden: true;
  machine_scores_included: false;
  source_engine_included: false;
  episode_order_preserved: true;
  instructions: string[];
  cultural_review_boundary: string[];
  episode_samples: AiComicSeriesBlindReviewEpisodeSample[];
  scorecard: AiComicSeriesBlindReviewScorecardItem[];
  required_attestations: string[];
}

export interface AiComicSeriesBlindReviewResponseScore {
  dimension: AiComicHumanReviewDimension;
  label: string;
  score: null | 1 | 2 | 3 | 4 | 5;
  note: string;
}

export interface AiComicSeriesBlindReviewResponseFile {
  schema_version: 'ai-comic-series-blind-review-response/v1';
  candidate_label: string;
  reviewer_packet_sha256: string;
  reviewer_id: string;
  blind: true;
  instructions: string[];
  scores: AiComicSeriesBlindReviewResponseScore[];
  attestations: {
    human_reviewer: boolean;
    origin_and_machine_scores_hidden: boolean;
    independent_review: boolean;
  };
}

export interface AiComicSeriesBlindReviewOperatorManifest {
  schema_version: 'ai-comic-series-blind-review-operator-manifest/v1';
  exported_at: string;
  series_project_id: string;
  series_title: string;
  candidate_label: string;
  review_content_fingerprint: string;
  reviewer_packet_sha256: string;
  reviewed_episode_story_ids: Record<string, string>;
  share_with_reviewer: false;
  instructions: string[];
}

export interface AiComicSeriesBlindReviewPackage {
  schema_version: 'ai-comic-series-blind-review-package/v1';
  candidate_label: string;
  reviewer_packet_sha256: string;
  reviewer_packet: AiComicSeriesBlindReviewReviewerPacket;
  reviewer_markdown: string;
  reviewer_response_template: AiComicSeriesBlindReviewResponseFile;
  reviewer_response_template_json: string;
  operator_manifest: AiComicSeriesBlindReviewOperatorManifest;
  operator_markdown: string;
}

export interface AiComicSeriesCommercialQualityAudit {
  schema_version: 'ai-comic-series-commercial-quality-audit/v1';
  machine_gate_passed: boolean;
  machine_score: number;
  ready_for_human_review: boolean;
  required_human_review_episode_nos: number[];
  missing_human_review_episode_nos: number[];
  review_content_fingerprint: string;
  issues: string[];
  episodes_need_attention: number[];
  episode_reports: AiComicCommercialQualityEpisodeReport[];
  diversity_report: AiComicSeriesDiversityReport;
  human_review: AiComicSeriesHumanReview;
}

export interface AiComicSeriesCommercialRepairResult {
  schema_version: 'ai-comic-series-commercial-repair-result/v1';
  project: AiComicSeriesProjectMeta;
  success: boolean;
  improved: boolean;
  changed_episode_nos: number[];
  changed_fields: string[];
  before_score: number;
  after_score: number;
  issues: string[];
  plan: AiComicSeriesPlan;
  commercial_quality_audit: AiComicSeriesCommercialQualityAudit;
  generated_episodes_need_regeneration: number[];
}

export type AiComicSeriesVisualIdentityKind = 'character' | 'costume' | 'location' | 'prop';

export interface AiComicSeriesVisualDefinitionField {
  field_id: string;
  label: string;
  value: string;
  required: boolean;
}

export type AiComicSeriesVisualApprovalStatus = 'pending' | 'approved' | 'changes_requested' | 'stale';

export interface AiComicSeriesVisualDefinitionApproval {
  status: AiComicSeriesVisualApprovalStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  review_note?: string;
  source_fingerprint?: string;
  human_confirmed: boolean;
}

export interface AiComicSeriesVisualIdentity {
  identity_id: string;
  kind: AiComicSeriesVisualIdentityKind;
  label: string;
  canonical_description: string;
  parent_identity_id?: string;
  source: 'plan_character' | 'premise_antagonist' | 'derived_costume' | 'series_memory';
  source_episode_nos: number[];
  pilot_episode_nos: number[];
  continuity_constraints: string[];
  negative_constraints: string[];
  source_fingerprint: string;
  definition_fingerprint: string;
  definition_fields: AiComicSeriesVisualDefinitionField[];
  definition_notes: string;
  approval: AiComicSeriesVisualDefinitionApproval;
  missing_definition_fields: string[];
  definition_status: 'ready' | 'needs_definition';
  production_credit: boolean;
}

export interface AiComicSeriesVisualWorldRule {
  rule_id: string;
  statement: string;
  consequence?: string;
  visual_symbol?: string;
  trigger_condition?: string;
  source_story_ids: Record<string, string>;
  source_fingerprint: string;
  definition_fields: AiComicSeriesVisualDefinitionField[];
  definition_notes: string;
  approval: AiComicSeriesVisualDefinitionApproval;
  missing_definition_fields: string[];
  definition_status: 'ready' | 'needs_definition';
  pilot_bindings: AiComicSeriesVisualWorldRulePilotBinding[];
  missing_pilot_episode_nos: number[];
  missing_visual_mapping: boolean;
}

export type AiComicSeriesVisualWorldRulePilotTargetType = 'seedance_shot' | 'gears_segment';

export interface AiComicSeriesVisualWorldRulePilotBinding {
  episode_no: number;
  target_type: AiComicSeriesVisualWorldRulePilotTargetType;
  target_id: string;
  story_id: string;
}

export interface AiComicSeriesVisualPilotBinding {
  episode_no: number;
  generated_story_id?: string;
  character_identity_ids: string[];
  costume_identity_ids: string[];
  location_identity_ids: string[];
  prop_identity_ids: string[];
  required_identity_ids: string[];
  production_credit_identity_ids: string[];
  identity_coverage_percent: number;
  production_credit_coverage_percent: number;
  missing_identity_kinds: AiComicSeriesVisualIdentityKind[];
  world_rule_ids: string[];
  missing_world_rule_ids: string[];
  world_rule_coverage_percent: number;
}

export interface AiComicSeriesVisualBible {
  schema_version: 'ai-comic-series-visual-bible/v1';
  generated_at: string;
  source_fingerprint: string;
  pilot_episode_nos: number[];
  world: {
    period: string;
    region: string;
    architectural_language: string[];
    lighting_and_color_rules: string[];
    material_rules: string[];
  };
  world_rules: AiComicSeriesVisualWorldRule[];
  cultural_boundaries: SeriesPremiseContractCulturalBoundary[];
  identities: AiComicSeriesVisualIdentity[];
  pilot_episode_bindings: AiComicSeriesVisualPilotBinding[];
  ready_identity_count: number;
  needs_definition_identity_count: number;
  approved_identity_count: number;
  needs_approval_identity_count: number;
  production_credit_identity_count: number;
  ready_world_rule_count: number;
  needs_definition_world_rule_count: number;
  approved_world_rule_count: number;
  needs_approval_world_rule_count: number;
  blocker_count: number;
  warning_count: number;
  issues: string[];
}

export interface AiComicSeriesVisualIdentityDefinitionUpdateRequest {
  expected_source_fingerprint: string;
  fields: Record<string, string>;
  definition_notes?: string;
  action: 'save_draft' | 'approve' | 'request_changes';
  reviewer_id?: string;
  human_confirmed?: true;
  review_note?: string;
}

export interface AiComicSeriesVisualWorldRuleDefinitionUpdateRequest {
  expected_source_fingerprint: string;
  fields: Record<string, string>;
  definition_notes?: string;
  pilot_bindings: Array<{
    episode_no: number;
    target_type: AiComicSeriesVisualWorldRulePilotTargetType;
    target_id: string;
  }>;
  action: 'save_draft' | 'approve' | 'request_changes';
  reviewer_id?: string;
  human_confirmed?: true;
  review_note?: string;
}

export interface AiComicSeriesVisualSuggestionDraft {
  schema_version: 'ai-comic-series-visual-suggestion-draft/v1';
  target_type: 'visual_identity' | 'visual_world_rule';
  target_id: string;
  source_fingerprint: string;
  input_fingerprint: string;
  suggestion_source: 'deterministic_template';
  suggestion_version: 'visual-definition-suggestions/v1';
  generated_at: string;
  fields: Record<string, string>;
  definition_notes?: string;
  suggested_field_ids: string[];
  unresolved_field_ids: string[];
  persisted: false;
  auto_approved: false;
}

export interface AiComicSeriesProjectDetail {
  project: AiComicSeriesProjectMeta;
  plan: AiComicSeriesPlan;
  generated_episode_story_ids: Record<string, string>;
  continuity_ledger: AiComicContinuityLedger;
  memory_recall_preferences?: AiComicSeriesMemoryRecallPreferences;
  series_quality_audit?: AiComicSeriesQualityAudit;
  premise_fidelity_audit?: AiComicSeriesPremiseFidelityAudit;
  commercial_quality_audit?: AiComicSeriesCommercialQualityAudit;
  visual_bible?: AiComicSeriesVisualBible;
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
  visual_bible: AiComicSeriesVisualBible;
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

export type StoryQualityGateId =
  | 'narrative_gate'
  | 'factual_cultural_gate'
  | 'outline_gate'
  | 'audience_text_gate'
  | 'production_material_gate'
  | 'gears_contract_gate'
  | 'asset_gate'
  | 'external_provider_gate';

export type StoryQualityGateScope = 'story' | 'production';
export type StoryQualityGateStatus = 'passed' | 'failed' | 'not_evaluated';

export interface StoryQualityGateResult {
  gate_id: StoryQualityGateId;
  scope: StoryQualityGateScope;
  status: StoryQualityGateStatus;
  /** `not_evaluated` gates may be non-blocking for legacy story publication. */
  passed: boolean;
  score?: number;
  summary: string;
  issues: string[];
}

export interface StoryQualityGatesV2 {
  schema_version: 'quality-gates/v2';
  narrative_gate: StoryQualityGateResult;
  factual_cultural_gate: StoryQualityGateResult;
  outline_gate: StoryQualityGateResult;
  audience_text_gate: StoryQualityGateResult;
  production_material_gate: StoryQualityGateResult;
  gears_contract_gate: StoryQualityGateResult;
  asset_gate: StoryQualityGateResult;
  external_provider_gate: StoryQualityGateResult;
  story_publishable: boolean;
  production_ready: boolean;
  story_blocking_gate_ids: StoryQualityGateId[];
  production_blocking_gate_ids: StoryQualityGateId[];
  /** Snapshot of the backward-compatible aggregate `quality_report.passed`. */
  legacy_passed: boolean;
}

export type StoryQualityFamily =
  | 'dramatic_narrative'
  | 'documentary_evidence'
  | 'promotional_communication'
  | 'instructional_learning'
  | 'spatial_landscape'
  | 'social_short_form';

export interface StoryFamilyQualityCheck {
  check_id: string;
  label: string;
  status: 'passed' | 'failed';
  evidence_scene_ids: number[];
  summary: string;
}

export interface StoryFamilyQualityReport {
  schema_version: 'story-family-quality/v1';
  family: StoryQualityFamily;
  family_label: string;
  passed: boolean;
  checks: StoryFamilyQualityCheck[];
  blocking_check_ids: string[];
}

export type StoryHumanReviewerRole =
  | 'screenwriter_or_script_editor'
  | 'genre_or_director_reviewer'
  | 'fact_or_culture_reviewer';

export type StoryMachineReviewStatus = 'supporting_evidence' | 'attention_required' | 'not_evaluated';

export interface StoryHumanReviewCriterion {
  criterion_id: string;
  dimension_id: ProfessionalQualityDimensionId;
  dimension_label: string;
  weight: number;
  machine_status: StoryMachineReviewStatus;
  machine_evidence: string[];
  machine_counter_evidence: string[];
  evidence_scene_ids: number[];
  source_refs: string[];
  /** Machine output must never populate or infer these human-owned fields. */
  human_verdict: 'not_reviewed';
  human_score: null;
  human_notes: '';
  counts_as_human_review_credit: false;
}

export interface StoryHumanReviewSection {
  role: StoryHumanReviewerRole;
  role_label: string;
  criteria: StoryHumanReviewCriterion[];
}

export interface StoryHumanReviewAlignment {
  schema_version: 'story-human-review-alignment/v1';
  video_type: VideoType;
  family: StoryQualityFamily;
  family_label: string;
  source_contracts: Array<
    | 'story-family-quality/v1'
    | 'pattern-quality/v2'
    | 'quality-gates/v2'
    | 'professional-blind-review-weight-contract/v1'
  >;
  weight_contract_sha256: string;
  machine_prefill_only: true;
  review_status: 'awaiting_human_review';
  human_review_complete: false;
  human_blind_review_passed: false;
  professional_passed: false;
  credit_boundary: string;
  sections: StoryHumanReviewSection[];
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
  quality_gates?: StoryQualityGatesV2;
  family_quality_report?: StoryFamilyQualityReport;
  human_review_alignment?: StoryHumanReviewAlignment;
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
  evidence_scene_ids: number[];
  observable_evidence: string[];
  counter_evidence: string[];
  confidence: number;
  repair_target: {
    scope: 'scene' | 'story_field';
    scene_ids: number[];
    fields: string[];
  };
}

export interface PatternQualityReport {
  schema_version: 'pattern-quality/v2';
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
  target_report: 'family' | 'outline' | 'pattern' | 'gears' | 'production_material' | 'audience' | 'combined';
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

export type ProfessionalTextPackageField =
  | 'creative_brief'
  | 'audience_promise'
  | 'premise_or_core_question'
  | 'theme_statement'
  | 'truth_and_adaptation_contract'
  | 'structure_outline'
  | 'sequence_beats'
  | 'scene_breakdown'
  | 'full_text'
  | 'dialogue_or_narration_pass'
  | 'director_text_plan'
  | 'continuity_ledger'
  | 'quality_report'
  | 'coverage_report'
  | 'revision_trace'
  | 'delivery_text_package';

export type ProfessionalQualityDimensionId =
  | 'creative_brief_and_audience_promise'
  | 'premise_and_theme_unity'
  | 'structure_causality_and_pacing'
  | 'character_agency_and_relationship_change'
  | 'scene_function_visible_action_and_blocking'
  | 'dialogue_narration_and_subtext'
  | 'emotional_curve_and_aftertaste'
  | 'cultural_fact_and_adaptation_boundary'
  | 'production_executability'
  | 'originality_and_distinctiveness';

export type ProfessionalTextArchitectureMode =
  | 'character_relationships'
  | 'information_architecture'
  | 'spatial_route'
  | 'visual_mood';

export interface ProfessionalTextTypeContract {
  schema_version: 'professional-text-type-contract/v1';
  video_type: VideoType;
  line: '剧情故事线' | '宣传传播线' | '非虚构与知识线' | '空间与意境线';
  primary_text_form: string;
  architecture_mode: ProfessionalTextArchitectureMode;
  required_package_fields: ProfessionalTextPackageField[];
  required_deliverables: string[];
  exclusive_quality_gate: string;
  quality_dimension_weights: Record<ProfessionalQualityDimensionId, number>;
  hard_gates: string[];
  repair_focus: string[];
}

export type ProfessionalTextPackageStatus =
  | 'skeleton'
  | 'draft'
  | 'in_review'
  | 'revision_required'
  | 'approved';

export type ProfessionalEvidenceStatus =
  | 'verified_fact'
  | 'plausible_dramatization'
  | 'fictional_addition'
  | 'unknown';

export interface ProfessionalCreativeBrief {
  target_audience: string;
  platform: string;
  target_duration: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  budget_assumptions: string[];
  delivery_constraints: string[];
}

export interface ProfessionalEvidenceItem {
  evidence_id: string;
  status: ProfessionalEvidenceStatus;
  claim: string;
  source: string;
  allowed_usage: string;
  verification_note: string;
}

export interface ResearchAndEvidenceDossier {
  source_summary: string;
  evidence_items: ProfessionalEvidenceItem[];
  unknowns: string[];
  authorization_notes: string[];
}

export interface ProfessionalTruthAndAdaptationContract {
  truth_mode: TruthMode;
  verified_facts: string[];
  plausible_dramatizations: string[];
  fictional_additions: string[];
  unknown_or_forbidden_claims: string[];
  required_disclaimers: string[];
}

export interface ProfessionalStructureOutline {
  structure_name: string;
  opening: string;
  development: string[];
  climax_or_key_turn: string;
  ending: string;
}

export interface ProfessionalSequenceBeat {
  beat_id: string;
  order: number;
  title: string;
  purpose: string;
  visible_action: string;
  conflict_discovery_or_instruction: string;
  emotional_or_information_turn: string;
  evidence_ids: string[];
}

export interface ProfessionalDialogueOrNarrationPass {
  mode: 'dialogue' | 'narration' | 'mixed' | 'minimal_text';
  voice_rules: string[];
  polished_text: string;
  unresolved_issues: string[];
}

export interface ProfessionalDirectorSequencePlan {
  sequence_id: string;
  scene_ids: number[];
  blocking_and_visible_action: string;
  camera_and_transition_intent: string;
  sound_intent: string;
  production_constraints: string[];
}

export interface ProfessionalDirectorTextPlan {
  visual_strategy: string;
  sound_strategy: string;
  rhythm_strategy: string;
  sequences: ProfessionalDirectorSequencePlan[];
}

export interface ProfessionalContinuityLedgerItem {
  continuity_id: string;
  category: 'character' | 'relationship' | 'fact' | 'prop' | 'location' | 'time' | 'visual' | 'terminology';
  rule: string;
  applies_to_scene_ids: number[];
  evidence_ids: string[];
}

export interface ProfessionalContinuityLedger {
  items: ProfessionalContinuityLedgerItem[];
  unresolved_conflicts: string[];
}

export interface ProfessionalQualityDimensionScore {
  dimension_id: ProfessionalQualityDimensionId;
  weight: number;
  score?: number;
  evidence: string[];
  issues: string[];
}

export interface ProfessionalTextQualityReport {
  status: 'not_evaluated' | 'failed' | 'production_candidate' | 'professional_candidate' | 'high_quality_candidate';
  total_score?: number;
  dimensions: ProfessionalQualityDimensionScore[];
  hard_gate_failures: string[];
  professional_passed: boolean;
  evaluator_notes: string[];
}

export interface ProfessionalCoverageReport {
  verdict: 'not_evaluated' | 'pass' | 'revise' | 'rebuild';
  strengths: string[];
  structure_notes: string[];
  character_or_information_notes: string[];
  scene_notes: string[];
  dialogue_or_narration_notes: string[];
  pacing_notes: string[];
  fact_and_culture_notes: string[];
  production_notes: string[];
  action_items: string[];
}

export interface ProfessionalRevisionTraceItem {
  revision_id: string;
  created_at: string;
  source: 'agent' | 'writer_editor' | 'director' | 'fact_culture_reviewer' | 'user';
  reason: string;
  changed_sections: ProfessionalTextPackageField[];
  resolved_issue_ids: string[];
  remaining_issues: string[];
  quality_delta?: number;
}

export interface ProfessionalDeliveryTextPackage {
  script_text: string;
  scene_units: Array<{
    scene_id: number;
    script_text: string;
    visual_action: string;
    camera_intent: string;
    sound_intent: string;
    continuity_notes: string[];
    evidence_boundary_notes: string[];
  }>;
  gears_handoff_notes: string[];
  seedance_handoff_notes: string[];
  validation_notes: string[];
}

export interface ProfessionalTextPackage {
  schema_version: 'professional-text-package/v1';
  package_id: string;
  story_id?: string;
  project_id?: string;
  video_type: VideoType;
  status: ProfessionalTextPackageStatus;
  created_at: string;
  updated_at: string;
  contract_version: 'professional-text-type-contract/v1';
  creative_brief: ProfessionalCreativeBrief;
  research_and_evidence_dossier: ResearchAndEvidenceDossier;
  audience_promise: string;
  premise_or_core_question: string;
  theme_statement: string;
  truth_and_adaptation_contract: ProfessionalTruthAndAdaptationContract;
  relationship_or_information_architecture: {
    mode: ProfessionalTextArchitectureMode;
    nodes: Array<{ node_id: string; label: string; role: string }>;
    links: Array<{ from: string; to: string; relationship: string }>;
  };
  structure_outline: ProfessionalStructureOutline;
  sequence_beats: ProfessionalSequenceBeat[];
  scene_breakdown: StoryScene[];
  full_text: string;
  dialogue_or_narration_pass: ProfessionalDialogueOrNarrationPass;
  director_text_plan: ProfessionalDirectorTextPlan;
  continuity_ledger: ProfessionalContinuityLedger;
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
  revision_trace: ProfessionalRevisionTraceItem[];
  delivery_text_package: ProfessionalDeliveryTextPackage;
}

export type Stage6RealInputProvenance =
  | 'operator_submitted_real_input'
  | 'preparation_template'
  | 'fixture'
  | 'simulation'
  | 'fallback';

export type Stage6VerificationStatus = 'unverified' | 'verified';

export type Stage6ReviewerRole =
  | 'writer_editor'
  | 'director'
  | 'fact_culture_reviewer';

export interface Stage6VerificationRecord {
  status: Stage6VerificationStatus;
  reference: string;
  verified_by: string;
  verified_at: string;
}

export interface Stage6ReviewerAssignment {
  role: Stage6ReviewerRole;
  reviewer_id: string;
  display_name: string;
  identity_verification: Stage6VerificationRecord;
}

export interface Stage6RealInputProject {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  provenance: Stage6RealInputProvenance;
  real_project_id: string;
  initial_package: {
    path: string;
    sha256: string;
  };
  creator_authorization: {
    subject_type: 'model' | 'human_author';
    subject_id: string;
    authorized_rounds: Array<1 | 2>;
    verification: Stage6VerificationRecord;
  };
  revision_budget: {
    currency: string;
    amount: number;
    authorized_rounds: Array<1 | 2>;
    verification: Stage6VerificationRecord;
  };
  reviewers: Stage6ReviewerAssignment[];
  table_read: {
    schedule_reference: string;
    scheduled_at: string;
    timezone: string;
    participant_reviewer_ids: string[];
    verification: Stage6VerificationRecord;
  };
}

export interface Stage6RealInputIntake {
  schema_version: 'story-agent-stage6-real-input-intake/v1';
  submitted_at: string;
  operator: {
    operator_id: string;
    display_name: string;
    contact_reference: string;
  };
  projects: Stage6RealInputProject[];
}

export interface Stage6RealInputReadinessIssue {
  code: string;
  path: string;
  message: string;
}

export interface Stage6RealInputProjectReadiness {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  real_project_id: string;
  initial_package_path: string;
  initial_package_sha256: string;
  status: 'ready' | 'blocked';
  blockers: Stage6RealInputReadinessIssue[];
  checks: {
    intake_schema_valid: boolean;
    registry_binding_valid: boolean;
    real_provenance_verified: boolean;
    real_project_id_valid: boolean;
    initial_package_file_valid: boolean;
    initial_package_schema_valid: boolean;
    initial_package_binding_valid: boolean;
    initial_package_sha256_valid: boolean;
    creator_authorization_verified: boolean;
    revision_budget_verified: boolean;
    reviewer_assignments_verified: boolean;
    table_read_verified: boolean;
  };
  completed_verified_round_count: 0;
  professional_passed: false;
}

export interface Stage6RealInputReadinessReport {
  schema_version: 'story-agent-stage6-real-input-readiness/v1';
  generated_at: string;
  source_intake_path: string;
  source_intake_schema_version: string;
  source_intake_canonical_sha256: string;
  source_registry_schema_version: string;
  source_registry_canonical_sha256: string;
  policy: {
    readiness_counts_as_completed_revision: false;
    fixture_simulation_fallback_counts_as_real_input: false;
    professional_pass_can_be_granted_by_intake: false;
  };
  global_errors: Stage6RealInputReadinessIssue[];
  summary: {
    project_count: number;
    ready_project_count: number;
    blocked_project_count: number;
    completed_verified_revision_round_count: 0;
    professional_pass_count: 0;
  };
  projects: Stage6RealInputProjectReadiness[];
}

export interface Stage6OperatorIntakeValidationResult {
  schema_version: 'story-agent-stage6-operator-intake-validation/v1';
  generated_at: string;
  source_intake_canonical_sha256: string;
  schema_valid: boolean;
  dry_run_only: true;
  input_persisted: false;
  execution_started: false;
  professional_passed: false;
  report: Stage6RealInputReadinessReport;
}

export interface Stage6OperatorIntakeWorkspace {
  schema_version: 'story-agent-stage6-operator-intake-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    input_files_are_not_persisted: true;
    readiness_counts_as_completed_revision: false;
    fixture_simulation_fallback_counts_as_real_input: false;
    professional_pass_can_be_granted_by_intake: false;
  };
  template: Stage6RealInputIntake;
  template_validation: Stage6OperatorIntakeValidationResult;
}

export interface Stage6OperatorRevisionPreflight {
  status: 'blocked' | 'ready' | 'already_completed';
  blockers: string[];
  benchmark_id: string;
  real_project_id: string;
  round_number: 1 | 2;
  attempt_number: number;
  readiness_report_sha256: string;
  command_sha256: string;
  professional_passed: false;
}

export interface Stage6OperatorRevisionPreflightResult {
  schema_version: 'story-agent-stage6-operator-revision-preflight/v1';
  generated_at: string;
  dry_run_only: true;
  execute_endpoint_available: false;
  artifacts_written: false;
  execution_started: false;
  verified_real_revision_credit: false;
  professional_passed: false;
  preflight: Stage6OperatorRevisionPreflight;
}

export interface Stage6OperatorRevisionPreflightWorkspace {
  schema_version: 'story-agent-stage6-operator-revision-preflight-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    execute_endpoint_available: false;
    explicit_cli_execute_required: true;
    artifacts_written_by_preflight: false;
    fixture_simulation_fallback_counts_as_real_revision: false;
    readiness_counts_as_completed_revision: false;
    professional_pass_can_be_granted_by_preflight: false;
  };
  command_template: unknown;
  current_batch_summary: {
    project_count: number;
    planned_round_count: number;
    p0_ready_project_count: number;
    blocked_project_count: number;
    completed_verified_revision_round_count: number;
    professional_pass_count: 0;
  };
  template_preflight: Stage6OperatorRevisionPreflightResult;
}

export interface Stage6ExitAuditBlocker {
  code: string;
  detail: string;
}

export interface Stage6ExitAuditProjectResult {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  real_project_id: string;
  status: 'blocked' | 'eligible_for_stage6_exit_review';
  blockers: Stage6ExitAuditBlocker[];
  checks: {
    p0_readiness_reverified: boolean;
    two_rounds_completed: boolean;
    two_rounds_real_provenance_verified: boolean;
    immutable_artifact_dag_valid: boolean;
    package_hash_chain_valid: boolean;
    revision_budget_valid: boolean;
    three_role_table_read_valid: boolean;
    all_feedback_effectively_closed: boolean;
    derived_rebuilds_complete: boolean;
    quality_improvement_traceable: boolean;
  };
  recorded_round_count: number;
  verified_real_revision_round_count: number;
  effective_open_feedback_count: number;
  total_cost_amount: number;
  cost_currency: string;
  stage6_exit_candidate: boolean;
  professional_passed: false;
}

export interface Stage6RealRevisionExitAuditReport {
  schema_version: 'story-agent-stage6-real-revision-exit-audit/v1';
  generated_at: string;
  source_readiness_canonical_sha256: string;
  source_intake_canonical_sha256: string;
  source_registry_canonical_sha256: string;
  policy: {
    required_real_revision_round_count: 2;
    simulation_fixture_fallback_counts_as_real_revision: false;
    prepared_or_recovered_counts_as_real_revision: false;
    effective_open_feedback_blocks_exit: true;
    stage6_exit_candidate_counts_as_professional_pass: false;
  };
  summary: {
    project_count: number;
    blocked_project_count: number;
    eligible_for_stage6_exit_review_project_count: number;
    recorded_round_count: number;
    verified_real_revision_round_count: number;
    effective_open_feedback_count: number;
    professional_pass_count: 0;
  };
  projects: Stage6ExitAuditProjectResult[];
}

export interface Stage6ProfessionalPackageInspectionIssue {
  code: string;
  path: string;
  message: string;
  gate: 'request' | 'schema' | 'binding' | 'revisionable' | 'consistency' | 'credit';
  blocking: boolean;
}

export interface Stage6ProfessionalPackageInspectionResult {
  schema_version: 'story-agent-stage6-professional-package-inspection/v1';
  generated_at: string;
  dry_run_only: true;
  input_persisted: false;
  p0_readiness_granted: false;
  execution_started: false;
  verified_real_revision_credit: false;
  professional_passed: false;
  source_file_sha256: string;
  canonical_package_sha256: string;
  schema_valid: boolean;
  p0_package_gate_passed: boolean;
  expected_binding: {
    project_id: string;
    video_type: VideoType | '';
  };
  checks: {
    request_valid: boolean;
    json_valid: boolean;
    package_schema_valid: boolean;
    project_id_present: boolean;
    expected_project_binding_valid: boolean;
    expected_video_type_binding_valid: boolean;
    non_skeleton_status: boolean;
    full_text_present: boolean;
    sequence_beats_present: boolean;
    scene_breakdown_present: boolean;
    delivery_script_present: boolean;
    scene_ids_unique: boolean;
    delivery_scene_ids_bound: boolean;
  };
  package_summary: {
    package_id: string;
    project_id: string;
    video_type: VideoType | '';
    status: ProfessionalTextPackageStatus | '';
    full_text_character_count: number;
    sequence_beat_count: number;
    scene_count: number;
    delivery_scene_count: number;
    evidence_item_count: number;
    continuity_item_count: number;
    revision_trace_count: number;
    quality_total_score?: number;
    source_claimed_professional_passed: boolean;
  };
  issues: Stage6ProfessionalPackageInspectionIssue[];
}

export interface Stage6ProfessionalPackageInspectorWorkspace {
  schema_version: 'story-agent-stage6-professional-package-inspector-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    input_files_are_not_persisted: true;
    p0_readiness_can_be_granted: false;
    canonical_hash_is_p0_source_file_hash: false;
    self_reported_professional_pass_is_credit: false;
  };
  selected_video_type: VideoType;
  template: ProfessionalTextPackage;
  template_inspection: Stage6ProfessionalPackageInspectionResult;
}

export type Stage6OperatorRequirementCategory =
  | 'operator_identity'
  | 'real_project'
  | 'initial_package'
  | 'authorization'
  | 'budget'
  | 'reviewers'
  | 'table_read'
  | 'revision_execution'
  | 'exit_evidence';

export type Stage6OperatorPhase =
  | 'awaiting_real_input'
  | 'awaiting_round_1'
  | 'awaiting_round_2'
  | 'awaiting_table_read_closure'
  | 'awaiting_exit_evidence'
  | 'eligible_for_stage6_exit_review';

export interface Stage6OperatorControlTowerProject {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  real_project_id: string;
  phase: Stage6OperatorPhase;
  readiness_status: 'ready' | 'blocked';
  execution_status: Stage6RevisionWorkspaceProjectSummary['execution_status'];
  exit_audit_status: Stage6ExitAuditProjectResult['status'];
  recorded_round_count: number;
  verified_real_revision_round_count: number;
  effective_open_feedback_count: number;
  stage6_exit_candidate: boolean;
  professional_passed: false;
  requirement_categories: Stage6OperatorRequirementCategory[];
  blocker_codes: string[];
  blocking_evidence_paths: string[];
  next_action: {
    code: string;
    label: string;
    route: string;
    external_input_required: boolean;
  };
}

export interface Stage6OperatorControlTowerReport {
  schema_version: 'story-agent-stage6-operator-control-tower/v1';
  generated_at: string;
  handoff_canonical_sha256: string;
  source_readiness_canonical_sha256: string;
  source_intake_canonical_sha256: string;
  source_registry_canonical_sha256: string;
  policy: {
    read_only: true;
    handoff_package_persisted: false;
    handoff_generation_is_external_input_completion: false;
    execute_endpoint_available: false;
    fixture_simulation_fallback_prepared_counts_as_real_revision: false;
    exit_candidate_counts_as_professional_pass: false;
  };
  summary: {
    project_count: number;
    external_handoff_project_count: number;
    p0_ready_project_count: number;
    blocked_project_count: number;
    planned_revision_round_count: 30;
    recorded_revision_round_count: number;
    verified_real_revision_round_count: number;
    effective_open_feedback_count: number;
    exit_review_candidate_project_count: number;
    professional_pass_count: 0;
  };
  lanes: Array<{
    lane_id: 'package_inspection' | 'operator_intake' | 'revision_execution' | 'table_read_and_versions' | 'exit_audit';
    label: string;
    status: 'blocked' | 'ready_for_operator' | 'complete';
    completed_count: number;
    target_count: number;
    route: string;
    credit_granted: false;
  }>;
  projects: Stage6OperatorControlTowerProject[];
}

export interface Stage6TableReadEvidenceInspectionIssue {
  code: string;
  path: string;
  message: string;
  gate: 'request' | 'schema' | 'identity' | 'reviewer' | 'session' | 'credit';
  blocking: boolean;
}

export interface Stage6TableReadEvidenceInspectionResult {
  schema_version: 'story-agent-stage6-table-read-evidence-inspection/v1';
  generated_at: string;
  dry_run_only: true;
  input_persisted: false;
  table_read_state_mutated: false;
  signature_created: false;
  human_table_read_credit_granted: false;
  execution_started: false;
  professional_passed: false;
  source_file_sha256: string;
  canonical_artifact_sha256: string;
  schema_valid: boolean;
  signature_preflight_ready: boolean;
  expected_binding: {
    benchmark_id: string;
    real_project_id: string;
    round_number: 1 | 2;
    session_reference: string;
  };
  checks: {
    request_valid: boolean;
    json_valid: boolean;
    artifact_schema_valid: boolean;
    p0_readiness_reverified: boolean;
    benchmark_binding_valid: boolean;
    real_project_binding_valid: boolean;
    round_binding_valid: boolean;
    session_reference_valid: boolean;
    table_read_schedule_verified: boolean;
    three_required_roles_present: boolean;
    reviewer_ids_match_verified_intake: boolean;
    feedback_ids_unique: boolean;
    submitted_at_not_before_scheduled_at: boolean;
  };
  artifact_summary: {
    benchmark_id: string;
    real_project_id: string;
    round_number: 1 | 2 | 0;
    session_reference: string;
    feedback_count: number;
    writer_editor_feedback_count: number;
    director_feedback_count: number;
    fact_culture_reviewer_feedback_count: number;
    evidence_required_feedback_count: number;
    source_claimed_signature_or_credit: boolean;
  };
  issues: Stage6TableReadEvidenceInspectionIssue[];
}

export interface Stage6TableReadEvidenceInspectorWorkspace {
  schema_version: 'story-agent-stage6-table-read-evidence-inspector-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    input_files_are_not_persisted: true;
    signature_preflight_is_signature: false;
    self_reported_signature_or_credit_is_accepted: false;
    human_table_read_credit_can_be_granted: false;
    professional_pass_can_be_granted: false;
  };
  selected_benchmark_id: string;
  selected_round_number: 1 | 2;
  projects: Array<{
    benchmark_id: string;
    video_type: VideoType;
    source_entry: string;
    real_project_id: string;
    readiness_status: 'ready' | 'blocked';
  }>;
  template: unknown;
  template_raw_json: string;
  template_inspection: Stage6TableReadEvidenceInspectionResult;
}

export interface Stage6ExitReviewSignatureIssue {
  code: string;
  path: string;
  message: string;
  gate: 'request' | 'schema' | 'trust' | 'binding' | 'decision' | 'signature' | 'credit';
  blocking: boolean;
}

export interface Stage6ExitReviewSignatureInspectionResult {
  schema_version: 'story-agent-stage6-exit-review-signature-inspection/v1';
  generated_at: string;
  dry_run_only: true;
  attestation_persisted: false;
  stage6_exit_record_persisted: false;
  signature_created: false;
  execution_started: false;
  professional_passed: false;
  source_file_sha256: string;
  canonical_attestation_payload_sha256: string;
  signature_verification_ready: boolean;
  expected_binding: {
    benchmark_id: string;
    real_project_id: string;
    exit_audit_binding_sha256: string;
    stage6_exit_candidate: boolean;
  };
  checks: {
    request_valid: boolean;
    json_valid: boolean;
    attestation_schema_valid: boolean;
    trust_policy_schema_valid: boolean;
    trust_policy_active: boolean;
    stage6_exit_candidate_reverified: boolean;
    benchmark_binding_valid: boolean;
    real_project_binding_valid: boolean;
    exit_audit_binding_valid: boolean;
    approval_decision_valid: boolean;
    required_roles_signed: boolean;
    trusted_signer_bindings_valid: boolean;
    signed_payload_digests_valid: boolean;
    cryptographic_signatures_valid: boolean;
    signature_timestamps_valid: boolean;
  };
  signature_summary: {
    signature_count: number;
    required_role_count: 3;
    trusted_signer_count: number;
    payload_digest_match_count: number;
    cryptographically_verified_signature_count: number;
    writer_editor_signature_count: number;
    director_signature_count: number;
    fact_culture_reviewer_signature_count: number;
    source_claimed_professional_pass: boolean;
  };
  issues: Stage6ExitReviewSignatureIssue[];
}

export interface Stage6ExitReviewSignatureInspectorWorkspace {
  schema_version: 'story-agent-stage6-exit-review-signature-inspector-workspace/v1';
  generated_at: string;
  trust_policy: {
    policy_id: string;
    status: 'preparation_template' | 'active';
    trusted_signer_count: number;
    required_role_count: 3;
  };
  policy: {
    dry_run_only: true;
    trust_policy_must_be_external_to_attestation: true;
    signature_verification_is_signature_creation: false;
    attestation_files_are_not_persisted: true;
    stage6_exit_record_can_be_persisted: false;
    exit_attestation_is_professional_pass: false;
  };
  selected_benchmark_id: string;
  projects: Array<{
    benchmark_id: string;
    video_type: VideoType;
    source_entry: string;
    real_project_id: string;
    stage6_exit_candidate: boolean;
  }>;
  template: unknown;
  template_raw_json: string;
  template_inspection: Stage6ExitReviewSignatureInspectionResult;
}

export type Stage7GoldenCardReviewerRole =
  | 'source_reviewer'
  | 'authorization_reviewer'
  | 'type_director'
  | 'fact_reviewer'
  | 'ethics_reviewer'
  | 'local_culture_reviewer';

export interface Stage7GoldenCardReviewIssue {
  code: string;
  path: string;
  message: string;
  gate: 'request' | 'schema' | 'binding' | 'reviewer' | 'evidence' | 'decision' | 'credit';
  blocking: boolean;
}

export interface Stage7GoldenCardReviewInspectionResult {
  schema_version: 'story-agent-stage7-golden-card-review-inspection/v1';
  generated_at: string;
  dry_run_only: true;
  review_record_persisted: false;
  source_card_modified: false;
  province_markdown_modified: false;
  human_approval_granted: false;
  golden_card_promoted: false;
  professional_passed: false;
  approval_preflight_ready: boolean;
  source_file_sha256: string;
  canonical_card_payload_sha256: string;
  expected_binding: {
    card_id: string;
    video_type: VideoType;
    source_card_file: string;
    risk_tier: 'p0' | 'p1' | 'p2';
    required_roles: Stage7GoldenCardReviewerRole[];
  };
  checks: {
    request_valid: boolean;
    json_valid: boolean;
    intake_schema_valid: boolean;
    card_found_in_index: boolean;
    card_pending_human_review: boolean;
    card_id_binding_valid: boolean;
    video_type_binding_valid: boolean;
    source_file_binding_valid: boolean;
    source_file_digest_valid: boolean;
    card_payload_digest_valid: boolean;
    review_decision_recorded: boolean;
    reviewer_roles_complete: boolean;
    reviewer_identities_verified: boolean;
    review_timestamps_valid: boolean;
    evidence_refs_present: boolean;
    review_notes_present: boolean;
    unanimous_role_approval: boolean;
    source_claimed_credit_rejected: boolean;
  };
  review_summary: {
    review_count: number;
    required_role_count: number;
    matched_required_role_count: number;
    verified_identity_count: number;
    approving_role_count: number;
    evidence_reference_count: number;
    source_claimed_human_approval: boolean;
    source_claimed_golden_card_promotion: boolean;
    source_claimed_professional_pass: boolean;
  };
  issues: Stage7GoldenCardReviewIssue[];
}

export interface Stage7GoldenCardReviewWorkspace {
  schema_version: 'story-agent-stage7-golden-card-review-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    review_records_are_not_persisted: true;
    source_cards_are_not_modified: true;
    province_markdown_is_not_modified: true;
    approval_preflight_is_human_approval: false;
    pending_or_fixture_counts_as_approved: false;
    professional_pass_can_be_granted: false;
  };
  summary: {
    target_video_type_count: 15;
    target_human_approved_card_count: 75;
    indexed_candidate_card_count: number;
    candidate_video_type_count: number;
    missing_video_type_count: number;
    missing_target_card_count: number;
    pending_human_review_card_count: number;
    approval_preflight_ready_card_count: 0;
    human_approved_card_count: 0;
    promoted_golden_card_count: 0;
    professional_pass_count: 0;
  };
  video_types: Array<{
    video_type: VideoType;
    label: string;
    target_card_count: 5;
    indexed_candidate_card_count: number;
    pending_human_review_card_count: number;
    human_approved_card_count: 0;
    missing_target_card_count: number;
    coverage_status: 'candidate_coverage_present' | 'missing_candidates';
  }>;
  cards: Array<{
    card_id: string;
    video_type: VideoType;
    entry_name: string;
    province: string;
    source_card_file: string;
    risk_tier: 'p0' | 'p1' | 'p2';
    review_status: string;
    required_roles: Stage7GoldenCardReviewerRole[];
    approval_preflight_ready: false;
    human_approved: false;
  }>;
  selected_card_id: string;
  template: unknown;
  template_raw_json: string;
  template_inspection: Stage7GoldenCardReviewInspectionResult;
}

export interface Stage7GoldenCardCandidateIssue {
  code: string;
  path: string;
  message: string;
  gate: 'request' | 'schema' | 'slot' | 'binding' | 'content' | 'evidence' | 'authorization' | 'credit';
  blocking: boolean;
}

export interface Stage7GoldenCardCandidateInspectionResult {
  schema_version: 'story-agent-stage7-golden-card-candidate-inspection/v1';
  generated_at: string;
  dry_run_only: true;
  candidate_persisted: false;
  golden_index_modified: false;
  source_card_file_created: false;
  province_markdown_modified: false;
  human_approval_granted: false;
  golden_card_promoted: false;
  professional_passed: false;
  candidate_ready_for_external_human_review: boolean;
  source_file_sha256: string;
  benchmark_project_sha256: string;
  profile_contract_sha256: string;
  expected_binding: {
    slot_id: string;
    candidate_id: string;
    video_type: VideoType;
    benchmark_id: string;
    source_entry: string;
    benchmark_file: string;
    required_material_fields: string[];
  };
  checks: {
    request_valid: boolean;
    json_valid: boolean;
    candidate_schema_valid: boolean;
    slot_found: boolean;
    target_video_type_still_missing_candidates: boolean;
    slot_id_binding_valid: boolean;
    candidate_id_binding_valid: boolean;
    video_type_binding_valid: boolean;
    benchmark_binding_valid: boolean;
    source_entry_binding_valid: boolean;
    benchmark_file_binding_valid: boolean;
    benchmark_file_digest_valid: boolean;
    benchmark_project_digest_valid: boolean;
    profile_contract_digest_valid: boolean;
    required_material_fields_present: boolean;
    required_material_fields_filled: boolean;
    visible_actions_present: boolean;
    verified_facts_present: boolean;
    source_refs_present: boolean;
    forbidden_claims_present: boolean;
    source_entry_confirmed: boolean;
    source_authorization_resolved: boolean;
    candidate_status_valid: boolean;
    source_claimed_credit_rejected: boolean;
  };
  content_summary: {
    required_material_field_count: number;
    present_material_field_count: number;
    filled_material_field_count: number;
    visible_action_count: number;
    verified_fact_count: number;
    plausible_dramatization_count: number;
    fictional_addition_count: number;
    unknown_count: number;
    forbidden_claim_count: number;
    source_reference_count: number;
    source_claimed_human_approval: boolean;
    source_claimed_golden_card_promotion: boolean;
    source_claimed_professional_pass: boolean;
  };
  issues: Stage7GoldenCardCandidateIssue[];
}

export interface Stage7GoldenCardCandidateWorkspace {
  schema_version: 'story-agent-stage7-golden-card-candidate-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    slots_are_not_golden_cards: true;
    validated_candidates_are_not_persisted: true;
    candidate_ready_is_human_approval: false;
    benchmark_specs_are_not_real_model_outputs: true;
    fixture_or_template_counts_as_candidate: false;
    professional_pass_can_be_granted: false;
  };
  summary: {
    target_video_type_count: 15;
    already_covered_video_type_count: 3;
    missing_video_type_count: 12;
    planned_slot_count: 60;
    candidate_import_ready_slot_count: 0;
    authored_candidate_count: 0;
    persisted_candidate_count: 0;
    human_approved_card_count: 0;
    professional_pass_count: 0;
  };
  video_types: Array<{
    video_type: VideoType;
    label: string;
    current_candidate_count: number;
    planned_slot_count: number;
    missing_target_card_count: number;
    status: 'already_has_candidate_coverage' | 'slots_prepared_missing_candidate_content';
  }>;
  slots: Array<{
    slot_id: string;
    candidate_id: string;
    video_type: VideoType;
    video_type_label: string;
    benchmark_id: string;
    source_entry: string;
    benchmark_file: string;
    required_material_fields: string[];
    status: 'template_slot_only';
    candidate_ready_for_external_human_review: false;
    human_approved: false;
  }>;
  selected_slot_id: string;
  template: unknown;
  template_raw_json: string;
  template_inspection: Stage7GoldenCardCandidateInspectionResult;
}

export interface Stage7GoldenCardReviewSignatureIssue {
  code: string;
  path: string;
  message: string;
  gate: 'request' | 'schema' | 'trust' | 'review' | 'binding' | 'decision' | 'signature' | 'credit';
  blocking: boolean;
}

export interface Stage7GoldenCardReviewSignatureInspectionResult {
  schema_version: 'story-agent-stage7-golden-card-review-signature-inspection/v1';
  generated_at: string;
  dry_run_only: true;
  signature_created: false;
  signed_review_persisted: false;
  source_card_modified: false;
  golden_index_modified: false;
  province_markdown_modified: false;
  human_approval_granted: false;
  golden_card_promoted: false;
  professional_passed: false;
  signature_verification_ready: boolean;
  canonical_review_payload_sha256: string;
  canonical_signature_payload_sha256: string;
  expected_binding: {
    card_id: string;
    video_type: VideoType;
    source_card_file_sha256: string;
    card_payload_sha256: string;
    required_roles: Stage7GoldenCardReviewerRole[];
    review_approval_preflight_ready: boolean;
  };
  checks: {
    request_valid: boolean;
    signature_json_valid: boolean;
    signature_attestation_schema_valid: boolean;
    trust_policy_schema_valid: boolean;
    trust_policy_active: boolean;
    review_approval_preflight_reverified: boolean;
    card_id_binding_valid: boolean;
    video_type_binding_valid: boolean;
    source_file_digest_binding_valid: boolean;
    card_payload_digest_binding_valid: boolean;
    review_payload_digest_binding_valid: boolean;
    approval_decision_valid: boolean;
    required_roles_signed: boolean;
    trusted_signer_bindings_valid: boolean;
    signed_payload_digests_valid: boolean;
    cryptographic_signatures_valid: boolean;
    signature_timestamps_valid: boolean;
    source_claimed_credit_rejected: boolean;
  };
  signature_summary: {
    signature_count: number;
    required_role_count: number;
    trusted_signer_count: number;
    payload_digest_match_count: number;
    cryptographically_verified_signature_count: number;
    source_claimed_human_approval: boolean;
    source_claimed_golden_card_promotion: boolean;
    source_claimed_professional_pass: boolean;
  };
  review_inspection: Stage7GoldenCardReviewInspectionResult;
  issues: Stage7GoldenCardReviewSignatureIssue[];
}

export interface Stage7GoldenCardReviewSignatureWorkspace {
  schema_version: 'story-agent-stage7-golden-card-review-signature-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    trust_policy_is_external_to_attestation: true;
    signature_verification_is_signature_creation: false;
    signed_reviews_are_not_persisted: true;
    verification_ready_is_human_approval: false;
    golden_card_promotion_can_be_granted: false;
    professional_pass_can_be_granted: false;
  };
  trust_policy: {
    policy_id: string;
    status: 'preparation_template' | 'active';
    trusted_signer_count: number;
  };
  cards: Stage7GoldenCardReviewWorkspace['cards'];
  selected_card_id: string;
  review_template_raw_json: string;
  signature_template: unknown;
  signature_template_raw_json: string;
  template_inspection: Stage7GoldenCardReviewSignatureInspectionResult;
}

export interface Stage7MaterialOperationsReport {
  schema_version: 'story-agent-stage7-material-operations/v1';
  generated_at: string;
  policy: {
    read_only: true;
    handoff_is_memory_only: true;
    handoff_is_external_completion: false;
    template_or_slot_counts_as_candidate: false;
    review_preflight_or_signature_fixture_counts_as_human_approval: false;
    simulation_counts_as_real_domain_pack_review: false;
    professional_pass_can_be_granted: false;
  };
  summary: {
    golden_card_target_count: 75;
    golden_card_indexed_candidate_count: number;
    golden_card_pending_human_review_count: number;
    golden_card_human_approved_count: 0;
    covered_video_type_count: number;
    missing_video_type_count: number;
    planned_candidate_slot_count: number;
    authored_candidate_count: 0;
    golden_review_preflight_ready_count: 0;
    golden_signature_verification_ready_count: 0;
    trusted_golden_reviewer_signer_count: 0;
    domain_pack_candidate_count: number;
    domain_pack_evidence_complete_count: 0;
    domain_pack_human_approved_count: 0;
    domain_pack_pre_signature_ready_count: 0;
    domain_pack_real_reviewer_submission_count: 0;
    domain_pack_real_signature_count: 0;
    domain_pack_formal_patch_count: 0;
    promoted_domain_pack_count: 0;
    external_handoff_task_count: number;
    professional_pass_count: 0;
  };
  lanes: Array<{
    lane_id: 'candidate_coverage' | 'golden_review' | 'golden_signature' | 'domain_pack_review' | 'domain_pack_promotion';
    label: string;
    status: 'blocked_external_input' | 'preparation_only';
    current_count: number;
    target_count: number;
    blocker_count: number;
    next_action: string;
  }>;
  tasks: Array<{
    task_id: string;
    scope: 'video_type' | 'golden_card' | 'domain_pack';
    target_id: string;
    label: string;
    priority: 'p0' | 'p1' | 'p2';
    next_action: 'complete_candidate_content_and_source_evidence' | 'complete_external_role_reviews' | 'complete_real_domain_pack_evidence_and_review';
    evidence_status: 'missing_external_input';
    counts_as_completion: false;
  }>;
  source_bindings: Array<{ path: string; sha256: string }>;
  handoff_package: {
    schema_version: 'story-agent-stage7-material-external-handoff/v1';
    generated_at: string;
    memory_only: true;
    persisted: false;
    execution_started: false;
    human_approval_granted: false;
    golden_card_promoted: false;
    domain_pack_promoted: false;
    professional_passed: false;
    source_bindings: Array<{ path: string; sha256: string }>;
    tasks: Stage7MaterialOperationsReport['tasks'];
  };
}

export type Stage8BlindReviewRole =
  | 'screenwriter_or_script_editor'
  | 'genre_or_director_reviewer'
  | 'fact_or_culture_reviewer';

export type Stage8BlindReviewInputProvenance =
  | 'operator_submitted_real_review'
  | 'preparation_template'
  | 'fixture'
  | 'simulation'
  | 'fallback';

export interface Stage8BlindReviewIntakeProject {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  provenance: Stage8BlindReviewInputProvenance;
  run_id: string;
  final_package: { path: string; sha256: string };
  randomization: {
    batch_id: string;
    candidate_label: string;
    candidate_origin_hidden_from_reviewers: boolean;
  };
  baseline: {
    baseline_id: string;
    path: string;
    sha256: string;
    rights: 'pending' | 'public_domain' | 'user_owned' | 'licensed';
    average_score: number;
    rights_verification: Stage6VerificationRecord;
  };
  reviewer_assignments: Array<{
    role: Stage8BlindReviewRole;
    reviewer_id: string;
    identity_verification: Stage6VerificationRecord;
    independence_verification: Stage6VerificationRecord;
    conflict_of_interest_declared: boolean;
  }>;
  review_schedule: {
    schedule_reference: string;
    due_at: string;
    timezone: string;
    verification: Stage6VerificationRecord;
  };
  human_blind_review_passed: false;
  professional_passed: false;
}

export interface Stage8BlindReviewIntake {
  schema_version: 'story-agent-stage8-blind-review-intake/v1';
  submitted_at: string;
  operator: { operator_id: string; display_name: string; contact_reference: string };
  projects: Stage8BlindReviewIntakeProject[];
}

export interface Stage8BlindReviewReadinessIssue {
  code: string;
  path: string;
  message: string;
  gate: 'schema' | 'registry' | 'provenance' | 'package' | 'randomization' | 'baseline' | 'reviewer' | 'schedule' | 'credit';
}

export interface Stage8BlindReviewProjectReadiness {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  status: 'ready_for_external_blind_review' | 'blocked';
  blockers: Stage8BlindReviewReadinessIssue[];
  checks: {
    project_schema_valid: boolean;
    registry_binding_valid: boolean;
    real_provenance_verified: boolean;
    run_id_present_and_unique: boolean;
    final_package_file_valid: boolean;
    final_package_sha256_valid: boolean;
    final_package_schema_valid: boolean;
    final_package_video_type_binding_valid: boolean;
    final_package_content_complete: boolean;
    blind_randomization_valid: boolean;
    authorized_baseline_file_valid: boolean;
    authorized_baseline_sha256_valid: boolean;
    baseline_rights_verified: boolean;
    three_role_assignments_verified: boolean;
    reviewer_independence_verified: boolean;
    review_schedule_verified: boolean;
    source_claimed_credit_rejected: boolean;
  };
  review_record_persisted: false;
  human_blind_review_passed: false;
  professional_passed: false;
}

export interface Stage8BlindReviewReadinessReport {
  schema_version: 'story-agent-stage8-blind-review-readiness/v1';
  generated_at: string;
  source_intake_canonical_sha256: string;
  source_bindings: Array<{ path: string; sha256: string }>;
  policy: {
    readiness_is_human_blind_review_pass: false;
    fixture_simulation_fallback_counts_as_real_review: false;
    threshold_evaluation_without_verified_human_artifacts_counts_as_pass: false;
    intake_can_persist_reviews: false;
    intake_can_grant_professional_pass: false;
  };
  global_errors: Stage8BlindReviewReadinessIssue[];
  summary: {
    target_video_type_count: 15;
    project_count: 75;
    ready_for_external_blind_review_count: number;
    blocked_project_count: number;
    reviewer_assignment_ready_project_count: number;
    human_blind_review_pass_project_count: 0;
    human_blind_review_pass_project_target: 45;
    professional_pass_count: 0;
  };
  video_types: Array<{
    video_type: VideoType;
    label: string;
    project_count: 5;
    ready_project_count: number;
    blocked_project_count: number;
    human_blind_review_pass_project_count: 0;
  }>;
  projects: Stage8BlindReviewProjectReadiness[];
}

export interface Stage8BlindReviewValidationResult {
  schema_version: 'story-agent-stage8-blind-review-validation/v1';
  generated_at: string;
  dry_run_only: true;
  input_persisted: false;
  review_record_persisted: false;
  review_execution_started: false;
  human_blind_review_passed: false;
  professional_passed: false;
  report: Stage8BlindReviewReadinessReport;
}

export interface Stage8BlindReviewWorkspace {
  schema_version: 'story-agent-stage8-blind-review-workspace/v1';
  generated_at: string;
  policy: Stage8BlindReviewReadinessReport['policy'] & { dry_run_only: true };
  thresholds: {
    minimum_weighted_average_score: 85;
    minimum_dimension_score: 75;
    maximum_baseline_gap: 3;
    minimum_production_advance_vote_ratio: '2/3';
    required_role_count: 3;
    hard_gate_failure_count_required: 0;
  };
  template: Stage8BlindReviewIntake;
  template_raw_json: string;
  template_validation: Stage8BlindReviewValidationResult;
}

export interface Stage8BlindReviewEvaluatorReadinessReport {
  schema_version: 'story-agent-stage8-blind-review-evaluator-readiness/v1';
  generated_at: string;
  policy: {
    score_threshold_is_human_blind_review_pass: false;
    fixture_simulation_fallback_counts_as_real_review: false;
    evaluator_can_grant_professional_pass: false;
    external_signed_human_artifacts_required_for_finalization: true;
  };
  summary: {
    target_video_type_count: 15;
    weight_contract_ready_count: number;
    weight_sum_valid_count: number;
    unique_weight_contract_sha256_count: number;
    blind_review_bundle_schema_version: 'professional-benchmark-blind-review/v2';
    blind_review_decision_schema_version: 'professional-benchmark-blind-review-decision/v2';
    real_review_bundle_count: 0;
    human_blind_review_pass_project_count: 0;
    professional_pass_count: 0;
  };
  thresholds: {
    minimum_weighted_average_score: 85;
    minimum_dimension_score: 75;
    maximum_baseline_gap: 3;
    minimum_production_advance_vote_ratio_numerator: 2;
    minimum_production_advance_vote_ratio_denominator: 3;
    required_role_count: 3;
    required_hard_gate_failure_count: 0;
  };
  source_bindings: Array<{ path: string; sha256: string }>;
  video_types: Array<{
    video_type: VideoType;
    label: string;
    line: string;
    weight_contract_sha256: string;
    dimension_weights: Record<ProfessionalQualityDimensionId, number>;
    weight_sum: 100;
    top_weight_dimensions: Array<{ dimension_id: ProfessionalQualityDimensionId; weight: number }>;
    evaluator_ready: true;
    real_review_bundle_count: 0;
    human_blind_review_pass_project_count: 0;
    professional_pass_count: 0;
  }>;
}

export interface Stage8BlindReviewSignatureIssue {
  code: string;
  path: string;
  message: string;
  gate: 'schema' | 'registry' | 'review' | 'decision' | 'binding' | 'trust' | 'signature' | 'credit';
  blocking: true;
}

export interface Stage8BlindReviewSignatureInspectionResult {
  schema_version: 'story-agent-stage8-blind-review-signature-inspection/v1';
  generated_at: string;
  dry_run_only: true;
  signature_created: false;
  signed_review_persisted: false;
  finalization_started: false;
  human_blind_review_passed: false;
  signed_release_created: false;
  professional_passed: false;
  signature_verification_ready: boolean;
  canonical_review_bundle_sha256: string;
  canonical_decision_sha256: string;
  canonical_signature_payload_sha256: string;
  expected_binding: {
    benchmark_id: string;
    video_type: VideoType;
    required_roles: Stage8BlindReviewRole[];
  };
  checks: {
    request_valid: boolean;
    review_bundle_json_valid: boolean;
    review_bundle_schema_valid: boolean;
    registry_binding_valid: boolean;
    score_threshold_passed: boolean;
    score_threshold_is_not_human_credit: boolean;
    trust_policy_schema_valid: boolean;
    trust_policy_active: boolean;
    signature_attestation_json_valid: boolean;
    signature_attestation_schema_valid: boolean;
    benchmark_binding_valid: boolean;
    video_type_binding_valid: boolean;
    run_id_binding_valid: boolean;
    review_bundle_digest_binding_valid: boolean;
    decision_digest_binding_valid: boolean;
    weight_contract_digest_binding_valid: boolean;
    score_threshold_binding_valid: boolean;
    required_roles_signed: boolean;
    trusted_reviewer_bindings_valid: boolean;
    signed_payload_digests_valid: boolean;
    cryptographic_signatures_valid: boolean;
    signature_timestamps_valid: boolean;
    source_claimed_credit_rejected: boolean;
  };
  signature_summary: {
    signature_count: number;
    required_role_count: 3;
    trusted_reviewer_count: number;
    payload_digest_match_count: number;
    cryptographically_verified_signature_count: number;
    real_signature_credit_count: 0;
    human_blind_review_pass_credit_count: 0;
    professional_pass_count: 0;
  };
  decision_summary: {
    video_type: VideoType | '';
    average_score: number;
    baseline_score_difference: number;
    production_advance_vote_count: number;
    hard_gate_failure_count: number;
    score_threshold_passed: boolean;
    counts_as_human_blind_review_pass: false;
    professional_passed: false;
    blockers: string[];
  };
  issues: Stage8BlindReviewSignatureIssue[];
}

export interface Stage8BlindReviewSignatureWorkspace {
  schema_version: 'story-agent-stage8-blind-review-signature-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    trust_policy_is_repository_controlled: true;
    signature_verification_is_signature_creation: false;
    signed_reviews_are_not_persisted: true;
    score_threshold_is_human_blind_review_pass: false;
    signature_ready_is_human_blind_review_pass: false;
    professional_pass_can_be_granted: false;
  };
  summary: {
    project_count: 75;
    score_threshold_ready_project_count: 0;
    signature_verification_ready_project_count: 0;
    trusted_reviewer_count: number;
    real_signature_count: 0;
    human_blind_review_pass_project_count: 0;
    professional_pass_count: 0;
  };
  trust_policy: { policy_id: string; status: 'preparation_template' | 'active'; trusted_reviewer_count: number };
  projects: Array<{ benchmark_id: string; video_type: VideoType; source_entry: string; signature_status: 'blocked_missing_external_review_and_signatures' }>;
  selected_benchmark_id: string;
  review_bundle_template: unknown;
  review_bundle_template_raw_json: string;
  signature_template: unknown;
  signature_template_raw_json: string;
  template_inspection: Stage8BlindReviewSignatureInspectionResult;
}

export interface Stage8FinalizationPreflightIssue {
  code: string;
  path: string;
  message: string;
  gate: 'json' | 'schema' | 'identity' | 'artifact' | 'revision' | 'review' | 'trust' | 'signature' | 'release' | 'credit';
  blocking: true;
}

export interface Stage8FinalizationDecision {
  schema_version: 'professional-benchmark-finalization-decision/v2';
  benchmark_id: string;
  run_id: string;
  video_type: VideoType | '';
  eligible_for_signed_release: boolean;
  professional_passed: false;
  initial_quality_score: number;
  final_quality_score: number;
  verified_quality_improvement: number;
  blockers: string[];
}

export interface Stage8FinalizationPreflightResult {
  schema_version: 'story-agent-stage8-finalization-preflight-result/v1';
  generated_at: string;
  dry_run_only: true;
  input_persisted: false;
  finalization_started: false;
  signed_release_created: false;
  professional_passed: false;
  expected_binding: { benchmark_id: string; video_type: VideoType };
  checks: {
    request_valid: boolean;
    finalization_input_json_valid: boolean;
    trust_policy_json_valid: boolean;
    benchmark_binding_valid: boolean;
    video_type_binding_valid: boolean;
    finalization_input_schema_valid: boolean;
    external_trust_policy_valid: boolean;
    professional_artifact_completion_ready: boolean;
    verified_real_revision_delta_ready: boolean;
    signed_external_blind_review_ready: boolean;
    eligible_for_signed_release: boolean;
    durable_signed_release_present: false;
    source_claimed_credit_rejected: boolean;
  };
  decision: Stage8FinalizationDecision;
  issues: Stage8FinalizationPreflightIssue[];
}

export interface Stage8FinalizationPreflightWorkspace {
  schema_version: 'story-agent-stage8-finalization-preflight-workspace/v1';
  generated_at: string;
  policy: {
    dry_run_only: true;
    finalization_candidate_is_signed_release: false;
    finalization_candidate_is_professional_pass: false;
    readiness_or_preparation_counts_as_real_evidence: false;
    fixture_simulation_fallback_counts_as_real_evidence: false;
    signed_release_can_be_created: false;
    professional_pass_can_be_granted: false;
  };
  summary: {
    project_count: 75;
    artifact_completion_ready_project_count: number;
    verified_revision_delta_ready_project_count: number;
    signed_blind_review_ready_project_count: number;
    external_trust_ready_project_count: number;
    finalization_candidate_ready_project_count: number;
    signed_release_project_count: 0;
    professional_pass_count: 0;
  };
  trust_policy: { policy_id: string; status: 'preparation_template'; trusted_key_count: number };
  projects: Array<{
    benchmark_id: string;
    video_type: VideoType;
    source_entry: string;
    status: 'blocked';
    checks: {
      professional_artifact_completion_ready: false;
      verified_real_revision_delta_ready: false;
      signed_external_blind_review_ready: false;
      external_trust_policy_ready: false;
      finalization_candidate_ready: false;
      durable_signed_release_present: false;
    };
    blockers: Stage8FinalizationPreflightIssue[];
    professional_passed: false;
  }>;
  selected_benchmark_id: string;
  finalization_input_template: unknown;
  finalization_input_template_raw_json: string;
  trust_policy_template: unknown;
  trust_policy_template_raw_json: string;
  template_preflight: Stage8FinalizationPreflightResult;
}

export interface Stage8DurableReleaseIssue {
  code: string;
  path: string;
  message: string;
  gate: 'json' | 'schema' | 'identity' | 'decision' | 'manifest' | 'authority' | 'signature' | 'time' | 'duplicate' | 'credit';
  blocking: true;
}

export interface Stage8DurableReleaseInspectionResult {
  schema_version: 'story-agent-stage8-durable-release-inspection/v1';
  generated_at: string;
  dry_run_only: true;
  release_record_created: false;
  release_record_imported: false;
  release_record_persisted: false;
  professional_passed: false;
  verification_ready: boolean;
  expected_binding: { benchmark_id: string; video_type: VideoType };
  canonical_finalization_decision_sha256: string;
  canonical_artifact_manifest_sha256: string;
  canonical_release_record_sha256: string;
  canonical_signature_payload_sha256: string;
  checks: {
    request_valid: boolean;
    finalization_decision_json_valid: boolean;
    finalization_decision_schema_valid: boolean;
    finalization_decision_quality_gate_valid: boolean;
    finalization_candidate_eligible: boolean;
    release_record_json_valid: boolean;
    release_record_schema_valid: boolean;
    benchmark_binding_valid: boolean;
    run_id_binding_valid: boolean;
    video_type_binding_valid: boolean;
    finalization_decision_digest_binding_valid: boolean;
    artifact_manifest_digest_valid: boolean;
    artifact_manifest_identity_valid: boolean;
    artifact_manifest_immutable_shape_valid: boolean;
    artifact_manifest_required_records_bound: boolean;
    authority_registry_schema_valid: boolean;
    authority_registry_is_external: boolean;
    authority_binding_valid: boolean;
    authority_key_trusted: boolean;
    release_id_unique: boolean;
    issued_at_valid: boolean;
    expires_at_valid: boolean;
    signature_payload_digest_valid: boolean;
    cryptographic_signature_valid: boolean;
    source_claimed_credit_rejected: boolean;
  };
  summary: {
    artifact_count: number;
    trusted_authority_count: number;
    known_release_id_count: number;
    duplicate_release_id: boolean;
    cryptographically_verified_signature_count: 0 | 1;
    durable_signed_release_credit_count: 0;
    professional_pass_count: 0;
  };
  issues: Stage8DurableReleaseIssue[];
}

export interface Stage8DurableReleaseWorkspace {
  schema_version: 'story-agent-stage8-durable-release-workspace/v1';
  generated_at: string;
  policy: {
    read_only: true;
    authority_registry_is_repository_controlled: true;
    request_supplied_authority_is_trusted: false;
    verification_is_release_creation: false;
    verification_is_durable_import: false;
    fixture_simulation_prepared_counts_as_signed_release: false;
    professional_pass_can_be_granted: false;
  };
  summary: {
    project_count: 75;
    finalization_candidate_ready_project_count: 0;
    active_release_authority_count: number;
    release_record_verification_ready_project_count: 0;
    durable_signed_release_imported_count: 0;
    professional_pass_count: 0;
  };
  authority_registry: {
    registry_id: string;
    status: 'preparation_template' | 'active';
    active_authority_count: number;
    known_release_id_count: number;
  };
  projects: Array<{
    benchmark_id: string;
    video_type: VideoType;
    source_entry: string;
    status: 'blocked_missing_finalization_candidate_and_external_release';
    durable_signed_release_imported: false;
    professional_passed: false;
  }>;
  selected_benchmark_id: string;
  finalization_decision_template: Stage8FinalizationDecision;
  finalization_decision_template_raw_json: string;
  release_record_template: unknown;
  release_record_template_raw_json: string;
  template_inspection: Stage8DurableReleaseInspectionResult;
}

export type Stage8OperationsPhase =
  | 'awaiting_blind_review_intake'
  | 'awaiting_external_review_bundle'
  | 'awaiting_three_role_signatures'
  | 'awaiting_finalization_candidate'
  | 'awaiting_durable_release_record'
  | 'awaiting_authorized_external_import';

export type Stage8OperationsNextActionCode =
  | 'complete_external_blind_review_intake'
  | 'submit_external_human_review_bundle'
  | 'complete_three_role_review_signatures'
  | 'assemble_finalization_candidate_evidence'
  | 'obtain_independent_durable_signed_release'
  | 'complete_authorized_external_release_import';

export interface Stage8OperationsProject {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  phase: Stage8OperationsPhase;
  checks: {
    blind_review_intake_ready: boolean;
    evaluator_contract_ready: boolean;
    real_review_bundle_present: boolean;
    three_role_signature_verification_ready: boolean;
    finalization_candidate_ready: boolean;
    durable_release_verification_ready: boolean;
    durable_release_imported: false;
    human_blind_review_passed: false;
    professional_passed: false;
  };
  blocker_codes: string[];
  next_action: {
    code: Stage8OperationsNextActionCode;
    label: string;
    route: string;
    required_external_evidence: string[];
    external_input_required: true;
    counts_as_completion: false;
  };
}

export interface Stage8OperationsReport {
  schema_version: 'story-agent-stage8-operations/v1';
  generated_at: string;
  handoff_canonical_sha256: string;
  policy: {
    read_only: true;
    handoff_is_memory_only: true;
    handoff_is_external_completion: false;
    execute_or_import_endpoint_available: false;
    readiness_or_machine_threshold_can_skip_external_evidence: false;
    fixture_simulation_fallback_prepared_counts_as_real_review: false;
    signature_verification_is_real_signature_credit: false;
    finalization_candidate_is_signed_release: false;
    release_verification_is_durable_import: false;
    professional_pass_can_be_granted: false;
  };
  summary: {
    project_count: 75;
    external_handoff_project_count: 75;
    blind_review_intake_ready_project_count: number;
    evaluator_contract_ready_video_type_count: number;
    real_review_bundle_count: 0;
    three_role_signature_ready_project_count: 0;
    finalization_candidate_ready_project_count: 0;
    durable_release_verification_ready_project_count: 0;
    durable_release_imported_count: 0;
    human_blind_review_pass_project_count: 0;
    professional_pass_count: 0;
  };
  lanes: Array<{
    lane_id: 'blind_review_intake' | 'all_format_evaluator' | 'review_signatures' | 'finalization_candidate' | 'durable_release';
    label: string;
    status: 'blocked_external_input' | 'contract_ready_waiting_external_input';
    current_count: number;
    target_count: number;
    blocker_count: number;
    route: string;
    next_action: string;
    credit_granted: false;
  }>;
  projects: Stage8OperationsProject[];
  source_bindings: Array<{ path: string; sha256: string }>;
  handoff_package: {
    schema_version: 'story-agent-stage8-external-handoff/v1';
    generated_at: string;
    canonical_sha256: string;
    memory_only: true;
    persisted: false;
    execution_started: false;
    external_evidence_completed: false;
    human_blind_review_passed: false;
    durable_release_imported: false;
    professional_passed: false;
    source_bindings: Array<{ path: string; sha256: string }>;
    tasks: Array<{
      task_id: string;
      benchmark_id: string;
      video_type: VideoType;
      source_entry: string;
      phase: Stage8OperationsPhase;
      next_action: Stage8OperationsProject['next_action'];
    }>;
  };
}

export type Stage6EvidenceBadge =
  | 'real_model_verified'
  | 'human_authored_verified'
  | 'simulation'
  | 'fixture'
  | 'prepared'
  | 'blocked';

export interface Stage6RevisionWorkspaceProjectSummary {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  real_project_id: string;
  readiness_status: 'ready' | 'blocked';
  execution_status: 'blocked' | 'awaiting_round_1' | 'round_1_completed' | 'two_rounds_completed';
  completed_round_count: number;
  verified_real_revision_round_count: number;
  open_feedback_count: number;
  evidence_badge: Stage6EvidenceBadge;
  stage6_exit_candidate: boolean;
  professional_passed: false;
  blockers: string[];
}

export interface Stage6RevisionWorkspacePortfolio {
  schema_version: 'story-agent-stage6-revision-workspace-portfolio/v1';
  generated_at: string;
  policy: {
    machine_candidate_is_professional_pass: false;
    readiness_is_revision_completion: false;
    simulation_fixture_fallback_is_real_evidence: false;
  };
  summary: {
    project_count: number;
    blocked_project_count: number;
    ready_project_count: number;
    completed_revision_round_count: number;
    verified_real_revision_round_count: number;
    professional_pass_count: 0;
  };
  projects: Stage6RevisionWorkspaceProjectSummary[];
}

export interface Stage6RevisionWorkspaceVersion {
  round_number: 0 | 1 | 2;
  label: string;
  available: boolean;
  package_sha256: string;
  full_text: string;
  scene_count: number;
  total_score?: number;
  quality_dimensions: Array<{
    dimension_id: ProfessionalQualityDimensionId;
    label: string;
    score?: number;
    delta_from_previous?: number;
  }>;
  hard_gate_failures: string[];
  evidence_badge: Stage6EvidenceBadge;
  professional_passed: false;
}

export interface Stage6RevisionWorkspaceFeedbackItem {
  feedback_id: string;
  round_number: 1 | 2;
  source: 'writer_editor' | 'director' | 'fact_culture_reviewer' | 'user';
  category: 'structure' | 'character_or_information' | 'scene' | 'dialogue_or_narration' | 'pacing' | 'fact_and_culture';
  note: string;
  issue_id: string;
  target_sections: ProfessionalTextPackageField[];
  evidence_required: boolean;
  immutable_status: 'open' | 'closed';
  effective_status: 'open' | 'closed';
  assigned_reviewer_id: string;
  resolution_note: string;
  reopened: boolean;
}

export interface Stage6RevisionWorkspaceDetail {
  schema_version: 'story-agent-stage6-revision-workspace-detail/v1';
  generated_at: string;
  project: Stage6RevisionWorkspaceProjectSummary;
  coverage: Array<{
    category: 'structure' | 'character_or_information' | 'scene' | 'dialogue_or_narration' | 'pacing' | 'fact_and_culture';
    label: string;
    notes: string[];
    action_items: string[];
    issue_ids: string[];
  }>;
  versions: Stage6RevisionWorkspaceVersion[];
  text_diffs: Array<{
    from_round: 0 | 1;
    to_round: 1 | 2;
    available: boolean;
    added_line_count: number;
    removed_line_count: number;
    hunks: Array<{ type: 'same' | 'added' | 'removed'; text: string }>;
  }>;
  feedback: Stage6RevisionWorkspaceFeedbackItem[];
  reviewers: Array<{
    role: Stage6ReviewerRole;
    reviewer_id: string;
    display_name: string;
    identity_verified: boolean;
  }>;
  feedback_drafts: Array<{
    draft_id: string;
    round_number: 1 | 2;
    reviewer_id: string;
    category: 'structure' | 'character_or_information' | 'scene' | 'dialogue_or_narration' | 'pacing' | 'fact_and_culture';
    note: string;
    issue_id: string;
    target_sections: ProfessionalTextPackageField[];
    evidence_required: boolean;
    created_at: string;
    created_by: string;
    provenance: 'preparation_draft';
    counts_as_human_table_read: false;
  }>;
  derived_rebuilds: Array<{
    round_number: 1 | 2;
    required_sections: ProfessionalTextPackageField[];
    rebuilt_sections: ProfessionalTextPackageField[];
    complete: boolean;
  }>;
  effective_stage6_exit_candidate: boolean;
  review_state_revision: number;
  professional_passed: false;
}

export interface Stage6FeedbackReviewUpdateRequest {
  schema_version: 'story-agent-stage6-feedback-review-update/v1';
  action: 'assign' | 'close' | 'reopen';
  expected_state_revision: number;
  actor_id: string;
  actor_name: string;
  assigned_reviewer_id?: string;
  resolution_note?: string;
}

export interface Stage6FeedbackDraftCreateRequest {
  schema_version: 'story-agent-stage6-feedback-draft-create/v1';
  round_number: 1 | 2;
  reviewer_id: string;
  category: 'structure' | 'character_or_information' | 'scene' | 'dialogue_or_narration' | 'pacing' | 'fact_and_culture';
  note: string;
  issue_id: string;
  target_sections: ProfessionalTextPackageField[];
  evidence_required: boolean;
  actor_id: string;
  actor_name: string;
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

export interface StoryDomainSafetyFinding {
  rule_id: string;
  severity: 'blocker' | 'warning';
  message: string;
}

export interface StoryDomainSafetyReport {
  schema_version: 'story-domain-safety/v1';
  domain: string;
  passed: boolean;
  evaluated_rule_ids: string[];
  blockers: StoryDomainSafetyFinding[];
  warnings: StoryDomainSafetyFinding[];
  machine_validation_only: true;
  human_review_complete: false;
  real_credit_granted: false;
}

export interface StoryDomainSafetyMigrationRecord {
  schema_version: 'story-domain-safety-migration-record/v1';
  migration_id: string;
  migrated_at: string;
  migrated_by_actor_id: string;
  review_reference: string;
  previous_version_id: string;
  previous_story_sha256: string;
  source_domain: string;
  source_entry: string;
  source_identity_confirmed_by_operator: true;
  history_overwrite_performed: false;
  machine_validation_only: true;
  human_review_complete: false;
  real_credit_granted: false;
}

export interface StoryDomainSafetyMigrationRequest {
  schema_version: 'story-domain-safety-migration-request/v1';
  migration_id: string;
  project_id: string;
  expected_current_version_id: string;
  expected_story_sha256: string;
  expected_source_domain: string;
  expected_source_entry: string;
  review_reference: string;
  operator_confirmation: 'migration_scope_reviewed';
  dry_run: boolean;
}

export type StoryDomainSafetyMigrationAuditStatus =
  | 'migration_candidate'
  | 'already_governed'
  | 'migrated'
  | 'blocked';

export interface StoryDomainSafetyMigrationAuditItem {
  project_id: string;
  current_version_id: string | null;
  version_count: number;
  story_id: string | null;
  story_sha256: string | null;
  source_domain: string | null;
  source_entry: string | null;
  domain_resolution: 'explicit' | 'project_metadata' | 'legacy_default' | 'unavailable';
  status: StoryDomainSafetyMigrationAuditStatus;
  blockers: string[];
  evaluated_safety: StoryDomainSafetyReport | null;
  requires_explicit_apply: boolean;
  history_overwrite_planned: false;
  writeback_performed: false;
  real_credit_granted: false;
}

export interface StoryDomainSafetyMigrationAuditReport {
  schema_version: 'story-domain-safety-migration-audit/v1';
  generated_at: string;
  read_only: true;
  repository_provider: string;
  discovered_project_count: number;
  migration_candidate_count: number;
  already_governed_count: number;
  migrated_count: number;
  blocked_count: number;
  items: StoryDomainSafetyMigrationAuditItem[];
  automatic_source_assignment: false;
  history_overwrite_performed: false;
  writeback_performed: false;
  human_review_complete: false;
  real_credit_granted: false;
}

export interface StoryDomainSafetyMigrationResult {
  schema_version: 'story-domain-safety-migration-result/v1';
  evaluated_at: string;
  migration_id: string;
  project_id: string;
  requested_by_actor_id: string;
  dry_run: boolean;
  write_enabled: boolean;
  status_before: StoryDomainSafetyMigrationAuditStatus;
  expected_current_version_id: string;
  actual_current_version_id: string | null;
  expected_story_sha256: string;
  actual_story_sha256: string | null;
  source_domain: string | null;
  source_entry: string | null;
  safety_report: StoryDomainSafetyReport | null;
  blockers: string[];
  preflight_ready: boolean;
  applied: boolean;
  idempotent_replay: boolean;
  resulting_version_id: string | null;
  durable_intent_written: boolean;
  durable_completion_written: boolean;
  automatic_source_assignment: false;
  history_overwrite_performed: false;
  human_review_complete: false;
  real_credit_granted: false;
}

export interface StoryDomainSafetyValidationInput {
  story: StoryGenerateResult;
  source_entry: EntryDetail;
}

// ---------------------------------------------------------------------------
// Creative reference trace — provenance for style pack influence
// ---------------------------------------------------------------------------

export interface ReferenceTrace {
  style_pack_id?: string;
  application_status?:
    | 'external_prompt_injected'
    | 'local_engine_not_applied'
    | 'local_fallback_not_applied';
  applied_rules: string[];
  requested_rules?: string[];
  avoid_copying_rules?: string[];
  source_reference_ids?: string[];
  source_analysis_ids?: string[];
  source_benchmark_ids?: string[];
  source_references?: ReferenceGenerationSourceTrace[];
  similarity_evidence_refs?: ReferenceSimilarityEvidenceTrace[];
  supplement_provenance_refs?: ReferenceSupplementProvenanceTrace[];
  source_story_structure: StoryStructureType;
}

export interface ReferenceGenerationSourceTrace {
  reference_id: string;
  rights_status: ReferenceRightsStatus;
  access_scope: ReferenceAccessScope;
  content_fingerprint?: string;
}

export interface ReferenceSimilarityEvidenceTrace {
  evidence_id: string;
  reference_id: string;
  payload_sha256: string;
  input_provenance: ReferenceSimilarityEvidenceRecord['input_provenance'];
  dimensions: ReferenceSimilarityDimension[];
}

export interface ReferenceSupplementProvenanceTrace {
  analysis_id: string;
  supplement_request_sha256: string;
  supplement_id: string;
  supplement_payload_sha256: string;
  status: 'verified';
}

export type ReferenceGenerationSimilarityStatus =
  | 'not_run_no_reference'
  | 'not_run_reference_not_applied'
  | 'not_run_no_authorized_source_material'
  | 'partially_completed'
  | 'completed';

export interface ReferenceGenerationSimilarityDimension {
  status: 'not_run' | 'completed';
  match_count: number | null;
}

export interface ReferenceGenerationSafetyFinding {
  issue_code:
    | 'reference_provenance_incomplete'
    | 'avoid_copying_constraints_missing'
    | 'unknown_rights_strong_reference'
    | 'unauthorized_adaptation_claim'
    | 'forbidden_imitation_language'
    | 'exact_long_sentence_match'
    | 'near_character_overlap'
    | 'character_design_similarity'
    | 'plot_structure_similarity'
    | 'shot_sequence_similarity'
    | 'similarity_evidence_provenance_incomplete';
  severity: 'blocker' | 'warning';
  message: string;
  reference_ids: string[];
}

export interface StoryReferenceBaselineQualityDimension {
  dimension:
    | 'core_story_checks'
    | 'genre_score'
    | 'pattern_score'
    | 'outline_coverage'
    | 'family_quality_checks'
    | 'story_publishable';
  baseline_score: number;
  reference_assisted_score: number;
  delta: number;
}

export interface StoryReferenceBaselineComparison {
  status: 'not_run_single_generation' | 'completed';
  baseline_story_id: string | null;
  reference_assisted_story_id: string | null;
  quality_delta: {
    schema_version: 'story-reference-baseline-quality-delta/v1';
    baseline_machine_score: number;
    reference_assisted_machine_score: number;
    aggregate_delta: number;
    dimensions: StoryReferenceBaselineQualityDimension[];
    same_input_verified: true;
    machine_comparison_only: true;
  } | null;
  comparison_credit_granted: false;
}

export interface ReferenceBaselineReplayDraftRequest {
  baseline_story_id: string;
  style_pack_ids: string[];
}

export interface ReferenceBaselineReplayDraft {
  schema_version: 'reference-baseline-replay-draft/v1';
  baseline_story_id: string;
  style_pack_ids: string[];
  generation_request: StoryGenerateRequest;
  baseline_summary: {
    title: string;
    source_entry: string;
    video_type: VideoType;
    presentation_style: PresentationStyle;
    story_structure: StoryStructureType;
    model_profile_id: string;
    source_mode: 'knowledge_entry' | 'user_material';
  };
  no_generation_performed: true;
  same_input_server_revalidation_required: true;
  machine_comparison_only: true;
  real_credit_granted: false;
}

export interface ReferenceRecipeComparisonDraftRequest {
  baseline_story_id: string;
  recipe_id: ReferenceGenerationRecipeId;
}

export interface ReferenceRecipeComparisonDraft {
  schema_version: 'reference-recipe-comparison-draft/v1';
  baseline_story_id: string;
  recipe: ReferenceGenerationRecipeContract;
  generation_request: StoryGenerateRequest;
  baseline_summary: ReferenceBaselineReplayDraft['baseline_summary'];
  no_generation_performed: true;
  same_input_server_revalidation_required: true;
  machine_comparison_only: true;
  human_preference_measured: false;
  production_credit_granted: false;
}

export type StoryRecipeEffectDimensionId =
  | 'structure'
  | 'causality'
  | 'visualization'
  | 'continuity'
  | 'contract_completeness';

export interface StoryRecipeEffectQualityDimension {
  dimension: StoryRecipeEffectDimensionId;
  baseline_score: number;
  recipe_assisted_score: number;
  delta: number;
  evidence: string[];
}

export interface StoryRecipeEffectComparison {
  schema_version: 'story-recipe-effect-comparison/v1';
  status: 'completed';
  baseline_story_id: string;
  recipe_assisted_story_id: string;
  recipe: ReferenceGenerationRecipeContract;
  baseline_machine_score: number;
  recipe_assisted_machine_score: number;
  aggregate_delta: number;
  dimensions: StoryRecipeEffectQualityDimension[];
  machine_verdict: 'improved' | 'mixed' | 'no_material_change' | 'regressed';
  boundary: {
    same_input_verified: true;
    machine_comparison_only: true;
    human_preference_measured: false;
    legal_conclusion_reached: false;
    production_credit_granted: false;
  };
}

export type StoryRecipeEffectMachineVerdict = StoryRecipeEffectComparison['machine_verdict'];

export interface StoryRecipeEffectComparisonHistoryFilters {
  recipe_id?: ReferenceGenerationRecipeId;
  video_type?: VideoType;
  machine_verdict?: StoryRecipeEffectMachineVerdict;
  limit?: number;
}

export interface StoryRecipeEffectComparisonHistoryItem {
  schema_version: 'story-recipe-effect-comparison-history-item/v1';
  project_id: string;
  project_title: string;
  story_id: string;
  source_entry: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  updated_at: string;
  comparison: StoryRecipeEffectComparison;
}

export interface StoryRecipeEffectDimensionTrend {
  dimension: StoryRecipeEffectDimensionId;
  comparison_count: number;
  average_baseline_score: number;
  average_recipe_assisted_score: number;
  average_delta: number;
}

export interface StoryRecipeEffectRecipeTrend {
  recipe: ReferenceGenerationRecipeContract;
  comparison_count: number;
  average_baseline_machine_score: number;
  average_recipe_assisted_machine_score: number;
  average_aggregate_delta: number;
  verdict_counts: Record<StoryRecipeEffectMachineVerdict, number>;
  dimensions: StoryRecipeEffectDimensionTrend[];
}

export interface StoryRecipeEffectComparisonHistory {
  schema_version: 'story-recipe-effect-comparison-history/v1';
  filters: {
    recipe_id: ReferenceGenerationRecipeId | null;
    video_type: VideoType | null;
    machine_verdict: StoryRecipeEffectMachineVerdict | null;
    limit: number;
  };
  summary: {
    matched_comparison_count: number;
    returned_comparison_count: number;
    skipped_invalid_comparison_count: number;
    average_aggregate_delta: number | null;
    verdict_counts: Record<StoryRecipeEffectMachineVerdict, number>;
  };
  trends: StoryRecipeEffectRecipeTrend[];
  items: StoryRecipeEffectComparisonHistoryItem[];
  boundary: {
    source_snapshot: 'current_project_versions';
    machine_comparison_only: true;
    human_preference_measured: false;
    causal_effect_proven: false;
    legal_conclusion_reached: false;
    production_credit_granted: false;
  };
}

export interface StoryRecipeEffectMachineReportFilters
  extends StoryRecipeEffectComparisonHistoryFilters {
  from_updated_at?: string;
  to_updated_at?: string;
  min_comparisons_per_recipe?: number;
}

export interface StoryRecipeEffectMachineReport {
  schema_version: 'story-recipe-effect-machine-report/v1';
  generated_at: string;
  cohort: {
    cohort_id: string;
    membership_sha256: string;
    source_snapshot: 'current_project_versions';
    recipe_id: ReferenceGenerationRecipeId | null;
    video_type: VideoType | null;
    machine_verdict: StoryRecipeEffectMachineVerdict | null;
    from_updated_at: string | null;
    to_updated_at: string | null;
    min_comparisons_per_recipe: number;
    item_limit: number;
    source_matched_comparison_count: number;
    candidate_comparison_count: number;
    included_comparison_count: number;
    excluded_below_minimum_sample_count: number;
    source_match_truncated: boolean;
  };
  history: StoryRecipeEffectComparisonHistory;
  boundary: {
    machine_comparison_only: true;
    human_preference_measured: false;
    causal_effect_proven: false;
    legal_conclusion_reached: false;
    production_credit_granted: false;
  };
  markdown: string;
}

export type StoryRecipeEffectHumanReviewDecision =
  | 'baseline_preferred'
  | 'recipe_preferred'
  | 'no_preference'
  | 'insufficient_evidence';

export interface StoryRecipeEffectHumanReviewSubmitRequest {
  project_id: string;
  story_id: string;
  cohort: {
    cohort_id: string;
    membership_sha256: string;
    report_filters: StoryRecipeEffectMachineReportFilters;
  };
  reviewer: {
    reviewer_id: string;
    display_name: string;
    identity_reference: string;
  };
  review: {
    decision: StoryRecipeEffectHumanReviewDecision;
    rationale: string;
    evidence_references: string[];
    method: 'blind_to_machine_verdict' | 'machine_verdict_visible';
  };
  attestation: {
    human_reviewer: true;
    compared_both_outputs: true;
    independent_judgment: true;
  };
  idempotency_key: string;
}

export interface StoryRecipeEffectHumanReviewEvent {
  schema_version: 'story-recipe-effect-human-review-event/v1';
  event_id: string;
  sequence: number;
  previous_event_sha256: string | null;
  event_sha256: string;
  request_sha256: string;
  idempotency_key: string;
  recorded_at: string;
  project_id: string;
  project_title: string;
  story_id: string;
  comparison: {
    comparison_payload_sha256: string;
    baseline_story_id: string;
    recipe_assisted_story_id: string;
    recipe_id: ReferenceGenerationRecipeId;
    recipe_version: string;
    recipe_payload_sha256: string;
  };
  cohort: StoryRecipeEffectHumanReviewSubmitRequest['cohort'];
  reviewer: StoryRecipeEffectHumanReviewSubmitRequest['reviewer'];
  review: StoryRecipeEffectHumanReviewSubmitRequest['review'];
  attestation: StoryRecipeEffectHumanReviewSubmitRequest['attestation'];
  boundary: {
    human_review_recorded: true;
    aggregate_human_preference_claimed: false;
    causal_effect_proven: false;
    legal_conclusion_reached: false;
    production_credit_granted: false;
  };
}

export interface StoryRecipeEffectHumanReviewSubmitResult {
  schema_version: 'story-recipe-effect-human-review-submit-result/v1';
  event: StoryRecipeEffectHumanReviewEvent;
  idempotent_replay: boolean;
}

export interface StoryRecipeEffectHumanReviewLedgerFilters {
  project_id?: string;
  story_id?: string;
  reviewer_id?: string;
  decision?: StoryRecipeEffectHumanReviewDecision;
  limit?: number;
}

export interface StoryRecipeEffectHumanReviewLedger {
  schema_version: 'story-recipe-effect-human-review-ledger/v1';
  filters: {
    project_id: string | null;
    story_id: string | null;
    reviewer_id: string | null;
    decision: StoryRecipeEffectHumanReviewDecision | null;
    limit: number;
  };
  summary: {
    recorded_review_count: number;
    returned_review_count: number;
    human_reviews_recorded: boolean;
    decision_counts: Record<StoryRecipeEffectHumanReviewDecision, number>;
  };
  entries: StoryRecipeEffectHumanReviewEvent[];
  integrity: {
    chain_valid: true;
    invalid_event_count: 0;
    ledger_head_sha256: string | null;
  };
  boundary: {
    source: 'operator_submitted_human_reviews';
    machine_scores_inferred_as_human_judgment: false;
    aggregate_human_preference_claimed: false;
    causal_effect_proven: false;
    legal_conclusion_reached: false;
    production_credit_granted: false;
  };
}

export interface ReferenceGenerationSafetyReport {
  schema_version: 'story-reference-generation-safety/v1';
  status: 'not_applicable' | 'passed' | 'passed_with_limits' | 'blocked';
  passed: boolean;
  reference_strength: ReferenceStrength | null;
  style_pack_ids: string[];
  source_references: ReferenceGenerationSourceTrace[];
  similarity_evidence_refs: ReferenceSimilarityEvidenceTrace[];
  application: {
    applied_to_generation: boolean;
    statuses: NonNullable<ReferenceTrace['application_status']>[];
  };
  checks: {
    provenance_complete: boolean;
    avoid_copying_constraints_present: boolean;
    unauthorized_adaptation_claim_absent: boolean;
    forbidden_imitation_language_absent: boolean;
  };
  similarity: {
    status: ReferenceGenerationSimilarityStatus;
    exact_long_sentence: ReferenceGenerationSimilarityDimension;
    near_character_overlap: ReferenceGenerationSimilarityDimension;
    character_design: ReferenceGenerationSimilarityDimension;
    plot_structure: ReferenceGenerationSimilarityDimension;
    shot_sequence: ReferenceGenerationSimilarityDimension;
    similarity_pass_credit_granted: false;
  };
  baseline_comparison: StoryReferenceBaselineComparison;
  issues: ReferenceGenerationSafetyFinding[];
  warnings: ReferenceGenerationSafetyFinding[];
  blocked_reference_ids: string[];
  machine_validation_only: true;
  human_review_complete: false;
  real_similarity_check_completed: boolean;
  real_credit_granted: false;
}

// ---------------------------------------------------------------------------
// Story generate result (full output)
// ---------------------------------------------------------------------------

export interface StoryGenerateResult extends BaseStory<StoryScene, GearsSegment> {
  storyId: string;
  /** Domain Pack that produced this story. Optional only for legacy snapshots. */
  sourceDomain?: string;
  project_id?: string;
  current_version_id?: string;
  model_profile_id?: string;
  requested_model_profile_id?: string;
  effective_engine?: 'local_story_engine' | 'external_model' | 'local_fallback';
  external_model_call_performed?: boolean;
  model_execution_evidence?: 'local_only' | 'live_external_command' | 'record_replay_fixture';
  recipe_effect_comparison?: StoryRecipeEffectComparison;
  generation_reason?: string;
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
  domain_safety?: StoryDomainSafetyReport;
  domain_safety_migration?: StoryDomainSafetyMigrationRecord;
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
  reference_generation_recipe?: ReferenceGenerationRecipeContract;
  reference_safety_report?: ReferenceGenerationSafetyReport;
  repair_trace?: StoryRepairTrace[];
  production_board_repair_trace?: StoryProductionBoardRepairTrace[];
  professional_text_package?: ProfessionalTextPackage;
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

export interface EntrySearchResult extends BaseEntry {
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

export interface EntryDetail extends BaseEntry {
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
  runtime: 'local' | 'claude' | 'codex';
  model: string;
  recommended?: boolean;
  capabilities: AIModelCapability[];
}

export interface StoryGenerationCapabilityModelProfile extends AIModelProfile {
  available: boolean;
  effective_engine: 'local_only' | 'external_model' | 'unavailable';
  external_call_possible: boolean;
  unavailable_reason?: string;
  scene_regeneration_available: boolean;
  scene_regeneration_external_call_possible: boolean;
  scene_regeneration_unavailable_reason?: string;
}

export interface StoryGenerationCapabilities {
  schema_version: 'story-generation-capabilities/v1';
  default_model_profile_id: string;
  effective_default_engine: 'local_only' | 'external_model';
  model_profiles: StoryGenerationCapabilityModelProfile[];
  external_adapter: {
    provider: string;
    provider_supported: boolean;
    command_configured: boolean;
    ready: boolean;
    external_data_transfer_possible: boolean;
    actual_cost_known_before_execution: false;
    cost_boundary: 'not_reported_by_story_generation_adapter';
    authorization_boundary: string;
  };
  scene_regeneration_adapter: {
    provider: string;
    provider_supported: boolean;
    command_configured: boolean;
    ready: boolean;
    external_data_transfer_possible: boolean;
    actual_cost_known_before_execution: false;
    cost_boundary: 'not_reported_by_scene_regeneration_adapter';
    authorization_boundary: string;
  };
  request_contract: {
    schema: 'StoryGenerateRequestSchema';
    unknown_model_profile_rejected: true;
    omitted_model_profile_uses_local_engine: true;
  };
  real_external_generation_performed: false;
  notes: string[];
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

export interface TypeInfo extends DomainEntryTypeDescriptor {
  name: string;
  recommended_generation_types: GenerationType[];
  recommended_video_types: VideoType[];
  recommended_presentation_styles: PresentationStyle[];
  description: string;
}
