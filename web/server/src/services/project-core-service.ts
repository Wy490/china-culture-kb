import { resolve } from 'node:path';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import { createStoryProjectRepository } from '../platform/project-repository-provider.js';
import type {
  ProjectMetaExpectation,
  ProjectRepository,
  ProjectVersionExpectation,
} from '../repositories/project-repository.js';
import type { StoryProjectMeta, VideoType } from '@shared/types.js';

export const STORY_PROJECT_VIDEO_TYPES: readonly VideoType[] = [
  'character_story', 'historical_drama', 'legend_story',
  'culture_promo', 'heritage_promo', 'city_brand_promo',
  'scene_short', 'landscape_mood',
  'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
  'children_story', 'social_short', 'ai_comic_drama',
];

export function projectsRoot(generatedRootOverride?: string): string {
  return resolve(generatedRootOverride ?? storyGeneratedRoot(), 'projects');
}

export function projectRepository(generatedRootOverride?: string): ProjectRepository {
  return createStoryProjectRepository(projectsRoot(generatedRootOverride));
}

export function projectVersionExpectation(project: StoryProjectMeta): ProjectVersionExpectation {
  return {
    current_version_id: project.current_version_id,
    version_count: project.version_count,
  };
}

export function projectMetaExpectation(project: StoryProjectMeta): ProjectMetaExpectation {
  return {
    ...projectVersionExpectation(project),
    updated_at: project.updated_at,
  };
}

export function nextProjectUpdatedAt(project: StoryProjectMeta): string {
  const previous = Date.parse(project.updated_at);
  return new Date(Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : Date.now())).toISOString();
}

export function projectDir(projectId: string, generatedRootOverride?: string): string {
  return resolve(projectsRoot(generatedRootOverride), projectId);
}

export function projectVersionsDir(projectId: string, generatedRootOverride?: string): string {
  return resolve(projectDir(projectId, generatedRootOverride), 'versions');
}

export function projectVersionPath(
  projectId: string,
  versionId: string,
  generatedRootOverride?: string,
): string {
  return resolve(projectVersionsDir(projectId, generatedRootOverride), `${versionId}.json`);
}

export function buildProjectId(storyId: string, videoType: string): string {
  return `${storyId}--${videoType}`;
}

export function buildVersionId(projectId: string, versionNumber: number): string {
  return `${projectId}-v${versionNumber}`;
}

export function parseProjectId(projectId: string): { storyId: string; videoType: VideoType } | null {
  const marker = '--';
  const markerIndex = projectId.indexOf(marker);
  if (markerIndex === -1) return null;

  const storyId = projectId.slice(0, markerIndex);
  const videoType = projectId.slice(markerIndex + marker.length) as VideoType;
  if (!STORY_PROJECT_VIDEO_TYPES.includes(videoType)) return null;
  return { storyId, videoType };
}
