import { success, fail, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  GearsDeliveryPackage,
  GearsSegmentsResponse,
  GearsV2Segment,
  GearsVideoReadyCallbackRequest,
  GearsVideoReadyCallbackResult,
  GearsVideoResult,
  SeedancePromptPackage,
} from '@shared/types.js';
import type { DomainGearsConstraintInput } from './domain-pack.js';
import {
  updateProjectCurrentGearsDelivery,
  updateProjectCurrentGearsVideo,
} from '../services/project-service.js';
import {
  ensureGearsDeliveryPackage,
} from '../services/gears-delivery-service.js';
import { buildSeedancePromptPackage } from '../services/seedance-prompt-service.js';
import { getStory } from './story-read-service.js';
import { createStoryRepository } from './story-storage.js';

interface GearsSegmentsDomainAdapter {
  mapGearsConstraints(input: DomainGearsConstraintInput): string[];
}

interface GetGearsSegmentsOptions {
  resolve_domain_pack?: (domain: string) => GearsSegmentsDomainAdapter;
}

const LEGACY_STORY_SOURCE_DOMAIN = 'china_culture';

export async function getGearsSegments(
  storyId: string,
  options: GetGearsSegmentsOptions = {},
): Promise<ApiResponse<GearsSegmentsResponse>> {
  const storyResult = await getStory(storyId);
  if (!storyResult.ok || !storyResult.data) {
    return fail(ErrorCodes.GEARS_SEGMENTS_NOT_FOUND, `Gears segments for story "${storyId}" not found`);
  }

  const story = storyResult.data;
  const sourceDomain = story.sourceDomain?.trim() || LEGACY_STORY_SOURCE_DOMAIN;
  const domainPack = options.resolve_domain_pack?.(sourceDomain);
  const segments: GearsV2Segment[] = (story.gears_segments || []).map(segment => {
    const constraintNote = domainPack
      ? domainPack.mapGearsConstraints({ story, segment })
      : [...new Set([
          ...story.cultural_constraints,
          ...segment.cultural_constraints,
        ].map(item => item.trim()).filter(Boolean))];
    return {
      ...segment,
      cultural_constraints: constraintNote,
      constraint_note: constraintNote,
    };
  });
  return success({
    schema_version: 'gears-segments/v2',
    storyId: story.storyId,
    title: story.title,
    sourceDomain,
    total_duration_sec: segments.reduce((sum, segment) => sum + segment.duration_sec, 0),
    segments,
  });
}

export async function getGearsDeliveryPackage(
  storyId: string,
): Promise<ApiResponse<GearsDeliveryPackage>> {
  const storyResult = await getStory(storyId);
  if (!storyResult.ok || !storyResult.data) {
    return fail(
      ErrorCodes.GEARS_SEGMENTS_NOT_FOUND,
      `Gears delivery package for story "${storyId}" not found`,
    );
  }
  return success(ensureGearsDeliveryPackage(storyResult.data));
}

export async function getSeedancePromptPackage(
  storyId: string,
): Promise<ApiResponse<SeedancePromptPackage>> {
  const storyResult = await getStory(storyId);
  if (!storyResult.ok || !storyResult.data) {
    return fail(
      ErrorCodes.GEARS_SEGMENTS_NOT_FOUND,
      `Seedance prompt package for story "${storyId}" not found`,
    );
  }
  return success(buildSeedancePromptPackage(storyResult.data));
}

export async function updateGearsDeliveryMarkdown(
  storyId: string,
  markdown: string,
): Promise<ApiResponse<GearsDeliveryPackage>> {
  const repository = createStoryRepository();
  const document = await repository.read(storyId);
  if (!document) return fail(ErrorCodes.STORY_NOT_FOUND, `Story "${storyId}" not found`);

  const updatedDelivery: GearsDeliveryPackage = {
    ...ensureGearsDeliveryPackage(document.story),
    markdown,
  };
  await repository.replace(
    { ...document.story, gears_delivery: updatedDelivery },
    document.revision,
  );
  await updateProjectCurrentGearsDelivery(
    document.story.project_id,
    document.story.storyId,
    updatedDelivery,
  );
  return success(updatedDelivery);
}

export async function updateGearsVideoReady(
  request: GearsVideoReadyCallbackRequest,
): Promise<ApiResponse<GearsVideoReadyCallbackResult>> {
  const now = new Date().toISOString();
  const repository = createStoryRepository();
  const document = await repository.read(request.storyId);
  if (!document) return fail(ErrorCodes.STORY_NOT_FOUND, `Story "${request.storyId}" not found`);

  const previous = document.story.gears_video;
  const gearsVideo: GearsVideoResult = {
    status: request.status,
    video_url: request.video_url ?? previous?.video_url,
    thumbnail_url: request.thumbnail_url ?? previous?.thumbnail_url,
    received_at: previous?.received_at ?? now,
    updated_at: now,
  };
  await repository.replace(
    { ...document.story, gears_video: gearsVideo },
    document.revision,
  );
  await updateProjectCurrentGearsVideo(
    document.story.project_id,
    document.story.storyId,
    gearsVideo,
  );
  return success({
    storyId: document.story.storyId,
    project_id: document.story.project_id,
    gears_video: gearsVideo,
  });
}
