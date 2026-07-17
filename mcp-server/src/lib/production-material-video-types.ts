export const PRODUCTION_MATERIAL_SUPPORTED_VIDEO_TYPES = [
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'children_story',
  'social_short',
  'ai_comic_drama',
] as const;

export type ProductionMaterialVideoType = typeof PRODUCTION_MATERIAL_SUPPORTED_VIDEO_TYPES[number];

const PRODUCTION_MATERIAL_SUPPORTED_VIDEO_TYPE_SET = new Set<string>(
  PRODUCTION_MATERIAL_SUPPORTED_VIDEO_TYPES,
);

export function isSupportedProductionMaterialVideoType(
  value: string,
): value is ProductionMaterialVideoType {
  return PRODUCTION_MATERIAL_SUPPORTED_VIDEO_TYPE_SET.has(value);
}
