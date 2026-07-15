import {
  GENERATION_TO_VIDEO_TYPE,
  STORY_STRUCTURE_CONFIG,
} from '@shared/types.js';
import type {
  GenerationType,
  NarrativePatternId,
  StoryGenerateRequest,
  StoryGenerationPriority,
  StoryStructureType,
  VideoType,
} from '@shared/types.js';

export function resolveStoryVideoType(request: StoryGenerateRequest): VideoType {
  return request.video_type
    ?? (request.generation_type ? GENERATION_TO_VIDEO_TYPE[request.generation_type] : undefined)
    ?? 'character_story';
}

export function resolveLegacyGenerationType(videoType: VideoType): GenerationType {
  if (videoType === 'character_story' || videoType === 'historical_drama'
    || videoType === 'legend_story' || videoType === 'ai_comic_drama'
    || videoType === 'children_story') return 'character_story';
  if (videoType === 'culture_promo' || videoType === 'heritage_promo'
    || videoType === 'city_brand_promo' || videoType === 'social_short'
    || videoType === 'documentary_short' || videoType === 'explainer_video'
    || videoType === 'lecture_video' || videoType === 'education_training') return 'culture_promo';
  return 'scene_short';
}

export function resolveStoryNarrativePatternIds(
  request: StoryGenerateRequest,
): NarrativePatternId[] {
  const selected = request.narrative_pattern_ids ?? [];
  if (request.source_material_mode !== 'adapt_user_novel') return selected;

  const adaptationDefaults: NarrativePatternId[] = [
    'source_fidelity_adaptation',
    'novel_scene_compression',
    request.video_type === 'ai_comic_drama'
      ? 'chapter_slice_adaptation'
      : 'theme_preserving_adaptation',
    'character_arc_adaptation',
    request.video_type === 'ai_comic_drama'
      ? 'serial_hook_adaptation'
      : 'theme_preserving_adaptation',
  ];
  return [...selected, ...adaptationDefaults]
    .filter((item, index, values) => values.indexOf(item) === index)
    .slice(0, 6);
}

export function buildStoryPriorityInstruction(
  priority: StoryGenerationPriority | undefined,
): string {
  if (priority === 'plot_first') {
    return '生成优先级：优先保证剧情推进、人物选择、冲突升级和场景行动完整；资料内容服务于剧情，不堆砌说明。';
  }
  if (priority === 'knowledge_first') {
    return '生成优先级：优先保证知识依据、事实边界、文化信息和资料完整性；戏剧化表达不得稀释核心知识点。';
  }
  return '生成优先级：剧情推进与资料完整保持均衡，关键知识点必须进入可观看的场景行动。';
}

export function resolveStoryStructureType(
  request: StoryGenerateRequest,
  videoType: VideoType,
  options: { historical_person_entry?: boolean } = {},
): StoryStructureType {
  if (request.story_structure) {
    const config = STORY_STRUCTURE_CONFIG[request.story_structure];
    if (config?.compatible_video_types.includes(videoType)) {
      return request.story_structure;
    }
  }

  if (['character_story', 'historical_drama', 'ai_comic_drama', 'children_story'].includes(videoType)) {
    return 'single_event_drama';
  }
  if (['explainer_video', 'lecture_video', 'education_training'].includes(videoType)) {
    return 'lecture_argument';
  }
  if (videoType === 'documentary_short' && options.historical_person_entry) {
    return 'witness_testimony';
  }
  if (['scene_short', 'landscape_mood'].includes(videoType)) {
    return 'object_clue_journey';
  }
  if (['culture_promo', 'heritage_promo', 'city_brand_promo', 'social_short'].includes(videoType)) {
    return 'object_clue_journey';
  }
  return 'single_event_drama';
}
