import type { GenerationType, StoryStructureType, VideoType } from '@shared/types.js';

export const CHINA_CULTURE_VIDEO_TYPE_ROUTING: Readonly<Record<string, readonly VideoType[]>> = {
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

export const CHINA_CULTURE_GENERATION_TYPE_ROUTING: Readonly<Record<string, readonly GenerationType[]>> = {
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

export const CHINA_CULTURE_STORY_STRUCTURE_ROUTING: Readonly<Record<string, readonly StoryStructureType[]>> = {
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

export function chinaCultureGenerationTypes(entryType: string): GenerationType[] {
  return [...(CHINA_CULTURE_GENERATION_TYPE_ROUTING[entryType] ?? ['character_story'])];
}

export function chinaCultureVideoTypes(entryType: string): VideoType[] {
  return [...(CHINA_CULTURE_VIDEO_TYPE_ROUTING[entryType] ?? ['character_story'])];
}

export function chinaCultureStoryStructures(entryType: string): StoryStructureType[] {
  return [...(CHINA_CULTURE_STORY_STRUCTURE_ROUTING[entryType] ?? ['single_event_drama'])];
}
