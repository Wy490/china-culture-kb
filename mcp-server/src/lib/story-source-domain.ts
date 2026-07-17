export const LEGACY_STORY_SOURCE_DOMAIN = 'china_culture';

export function resolveStorySourceDomain(story: Record<string, unknown>): string {
  const sourceDomain = story.sourceDomain;
  return typeof sourceDomain === 'string' && sourceDomain.trim()
    ? sourceDomain.trim()
    : LEGACY_STORY_SOURCE_DOMAIN;
}
