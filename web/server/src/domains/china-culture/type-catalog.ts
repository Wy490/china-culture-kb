import {
  VIDEO_TYPE_CONFIG,
  type PresentationStyle,
  type TypeInfo,
  type VideoType,
  type VideoTypeMeta,
} from '@shared/types.js';

export const CHINA_CULTURE_ENTRY_TYPES: readonly TypeInfo[] = [
  { name: '历史人物', recommended_generation_types: ['character_story'], recommended_video_types: ['character_story', 'historical_drama', 'ai_comic_drama', 'documentary_short', 'lecture_video'] as VideoType[], recommended_presentation_styles: ['cinematic', 'ink_style', 'ai_comic', 'documentary', 'host_narration'] as PresentationStyle[], description: '适合人物故事、历史剧情、AI漫剧、纪录片等' },
  { name: '神话传说', recommended_generation_types: ['character_story', 'scene_short'], recommended_video_types: ['legend_story', 'ai_comic_drama', 'scene_short', 'culture_promo', 'children_story'] as VideoType[], recommended_presentation_styles: ['ink_style', 'ai_comic', 'cinematic', 'voiceover_montage', 'children_animation'] as PresentationStyle[], description: '适合传说故事、AI漫剧、场景短片等' },
  { name: '民间故事', recommended_generation_types: ['character_story'], recommended_video_types: ['character_story', 'legend_story', 'ai_comic_drama', 'children_story'] as VideoType[], recommended_presentation_styles: ['cinematic', 'ink_style', 'ai_comic', 'children_animation'] as PresentationStyle[], description: '适合人物故事、传说、AI漫剧等' },
  { name: '非遗', recommended_generation_types: ['culture_promo'], recommended_video_types: ['heritage_promo', 'culture_promo', 'explainer_video', 'ai_comic_drama', 'social_short'] as VideoType[], recommended_presentation_styles: ['documentary', 'voiceover_montage', 'host_narration', 'ai_comic', 'social_media_fastcut'] as PresentationStyle[], description: '适合非遗宣传片、知识讲解、AI漫剧等' },
  { name: '地方戏曲', recommended_generation_types: ['culture_promo'], recommended_video_types: ['culture_promo', 'ai_comic_drama', 'heritage_promo'] as VideoType[], recommended_presentation_styles: ['voiceover_montage', 'ai_comic', 'documentary'] as PresentationStyle[], description: '适合文化宣传片、AI漫剧、非遗宣传片等' },
  { name: '节庆习俗', recommended_generation_types: ['culture_promo'], recommended_video_types: ['culture_promo', 'scene_short', 'social_short', 'children_story'] as VideoType[], recommended_presentation_styles: ['voiceover_montage', 'cinematic', 'social_media_fastcut', 'children_animation'] as PresentationStyle[], description: '适合文化宣传片、场景短片、短视频等' },
  { name: '饮食文化', recommended_generation_types: ['culture_promo'], recommended_video_types: ['culture_promo', 'explainer_video', 'social_short', 'documentary_short'] as VideoType[], recommended_presentation_styles: ['voiceover_montage', 'host_narration', 'social_media_fastcut', 'documentary'] as PresentationStyle[], description: '适合文化宣传片、知识讲解、短视频等' },
  { name: '传统工艺', recommended_generation_types: ['culture_promo'], recommended_video_types: ['heritage_promo', 'culture_promo', 'explainer_video', 'documentary_short'] as VideoType[], recommended_presentation_styles: ['documentary', 'voiceover_montage', 'host_narration', 'documentary'] as PresentationStyle[], description: '适合非遗宣传片、文化宣传片、知识讲解等' },
  { name: '名胜古迹', recommended_generation_types: ['scene_short', 'culture_promo'], recommended_video_types: ['scene_short', 'landscape_mood', 'culture_promo', 'city_brand_promo', 'documentary_short'] as VideoType[], recommended_presentation_styles: ['cinematic', 'ink_style', 'voiceover_montage', 'voiceover_montage', 'documentary'] as PresentationStyle[], description: '适合场景短片、山水意境片、文旅宣传片等' },
  { name: '地方掌故', recommended_generation_types: ['character_story', 'scene_short'], recommended_video_types: ['character_story', 'scene_short', 'lecture_video', 'documentary_short'] as VideoType[], recommended_presentation_styles: ['cinematic', 'cinematic', 'host_narration', 'documentary'] as PresentationStyle[], description: '适合人物故事、场景短片、宣讲片等' },
  { name: '宗教信仰', recommended_generation_types: ['scene_short', 'culture_promo'], recommended_video_types: ['scene_short', 'culture_promo', 'explainer_video'] as VideoType[], recommended_presentation_styles: ['cinematic', 'voiceover_montage', 'host_narration'] as PresentationStyle[], description: '适合场景短片、文化宣传片、知识讲解等' },
  { name: '民俗活动', recommended_generation_types: ['culture_promo'], recommended_video_types: ['culture_promo', 'social_short', 'children_story'] as VideoType[], recommended_presentation_styles: ['voiceover_montage', 'social_media_fastcut', 'children_animation'] as PresentationStyle[], description: '适合文化宣传片、短视频、儿童故事等' },
];

export const CHINA_CULTURE_GENERATION_TYPES: readonly VideoTypeMeta[] = Object.values(VIDEO_TYPE_CONFIG);
