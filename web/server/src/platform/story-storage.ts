import { resolve } from 'node:path';
import type { VideoType } from '@shared/types.js';
import { FileProjectRepository } from '../repositories/project-repository.js';
import { FileStoryRepository } from '../repositories/story-repository.js';

export const ALL_STORY_VIDEO_TYPES: VideoType[] = [
  'character_story', 'historical_drama', 'legend_story',
  'culture_promo', 'heritage_promo', 'city_brand_promo',
  'scene_short', 'landscape_mood',
  'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
  'children_story', 'social_short', 'ai_comic_drama',
];

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

export function storyGeneratedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || resolve(kbRoot(), '..', 'web', 'generated');
}

export function createStoryRepository(): FileStoryRepository {
  return new FileStoryRepository(resolve(storyGeneratedRoot(), 'stories'), {
    video_types: ALL_STORY_VIDEO_TYPES,
  });
}

export function createProjectRepository(): FileProjectRepository {
  return new FileProjectRepository(resolve(storyGeneratedRoot(), 'projects'));
}
