import type { StoryGenerateResult } from '@shared/types.js';

export const LEGACY_STORY_SOURCE_DOMAIN = 'china_culture';

export function resolveStorySourceDomain(
  story: Pick<StoryGenerateResult, 'sourceDomain'>,
): string {
  return story.sourceDomain?.trim() || LEGACY_STORY_SOURCE_DOMAIN;
}
