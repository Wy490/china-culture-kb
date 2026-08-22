import { success, fail, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  NarrativePatternId,
  StoryGenerateResult,
  StoryListItem,
  VideoType,
} from '@shared/types.js';
import { ensureGearsDeliveryPackage } from '../services/gears-delivery-service.js';
import { enrichStoryQualityReport } from '../services/quality-workflow-service.js';
import {
  ALL_STORY_VIDEO_TYPES,
  createProjectRepository,
  createStoryRepository,
} from './story-storage.js';
import { resolveStorySourceDomain } from './story-source-domain.js';

function stripInternalFields(data: StoryGenerateResult): StoryGenerateResult {
  const cleaned = { ...data } as Record<string, unknown>;
  delete cleaned._request_meta;
  return cleaned as unknown as StoryGenerateResult;
}

function normalizeStoryForApi(
  data: StoryGenerateResult & { _request_meta?: unknown },
): StoryGenerateResult {
  const cleaned = stripInternalFields(data);
  cleaned.sourceDomain = resolveStorySourceDomain(cleaned);
  cleaned.generation_mode = cleaned.generation_mode ?? 'local_only';
  cleaned.generation_used_fallback = cleaned.generation_used_fallback ?? false;
  cleaned.gears_delivery = ensureGearsDeliveryPackage(cleaned);
  if (cleaned.quality_report) {
    const meta = data._request_meta as Record<string, unknown> | undefined;
    cleaned.quality_report = enrichStoryQualityReport({
      story: cleaned,
      qualityReport: cleaned.quality_report,
      narrativePatternIds: Array.isArray(meta?.narrative_pattern_ids)
        ? meta.narrative_pattern_ids as NarrativePatternId[]
        : undefined,
      gearsDelivery: cleaned.gears_delivery,
    });
  }
  return cleaned;
}

async function readCurrentProjectStoryForStoryId(
  storyId: string,
): Promise<StoryGenerateResult | undefined> {
  const repository = createProjectRepository();
  const candidates: Array<{ updatedAt: string; story: StoryGenerateResult }> = [];

  for (const videoType of ALL_STORY_VIDEO_TYPES) {
    const projectId = `${storyId}--${videoType}`;
    try {
      const meta = await repository.readMeta(projectId);
      if (!meta?.current_version_id || meta.current_story_id !== storyId) continue;

      const snapshot = await repository.readVersion(projectId, meta.current_version_id);
      if (!snapshot || snapshot.story.storyId !== storyId) continue;
      candidates.push({
        updatedAt: meta.updated_at || snapshot.created_at || '',
        story: normalizeStoryForApi(snapshot.story),
      });
    } catch {
      continue;
    }
  }

  candidates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return candidates[0]?.story;
}

export async function listStories(
  generationType?: string,
  videoType?: string,
  sourceDomain?: string,
): Promise<ApiResponse<StoryListItem[]>> {
  const results: StoryListItem[] = [];
  const requestedType = videoType ?? generationType;
  const typesToScan = requestedType
    ? ALL_STORY_VIDEO_TYPES.includes(requestedType as VideoType)
      ? [requestedType as VideoType]
      : []
    : ALL_STORY_VIDEO_TYPES;

  for (const document of await createStoryRepository().list(typesToScan)) {
    const data = document.story;
    const resolvedSourceDomain = resolveStorySourceDomain(data);
    if (sourceDomain && resolvedSourceDomain !== sourceDomain) continue;
    const meta = data._request_meta as Record<string, unknown> | undefined;
    results.push({
      storyId: data.storyId,
      sourceDomain: resolvedSourceDomain,
      title: data.title || '',
      generation_type: data.generation_type || document.video_type,
      video_type: data.video_type,
      presentation_style: data.presentation_style || '',
      source_entry: data.source_entry || '',
      logline: data.logline || '',
      created_at: meta?.created_at as string ?? '',
      has_gears_segments: (data.gears_segments?.length ?? 0) > 0,
      scene_count: data.scene_breakdown?.length ?? 0,
      credibility_note: data.credibility_note || '',
      model_profile_id: data.model_profile_id || undefined,
      generation_source: data.generation_source || undefined,
      generation_mode: data.generation_mode ?? 'local_only',
      generation_used_fallback: data.generation_used_fallback ?? false,
    });
  }

  results.sort((left, right) => {
    if (!left.created_at && !right.created_at) return left.title.localeCompare(right.title, 'zh-CN');
    if (!left.created_at) return 1;
    if (!right.created_at) return -1;
    return right.created_at.localeCompare(left.created_at);
  });
  return success(results);
}

export async function getStory(storyId: string): Promise<ApiResponse<StoryGenerateResult>> {
  const currentProjectStory = await readCurrentProjectStoryForStoryId(storyId);
  if (currentProjectStory) return success(currentProjectStory);

  const document = await createStoryRepository().read(storyId);
  if (document) return success(normalizeStoryForApi(document.story));

  return fail(ErrorCodes.STORY_NOT_FOUND, `Story "${storyId}" not found`);
}
