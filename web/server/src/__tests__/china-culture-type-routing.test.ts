import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CHINA_CULTURE_ENTRY_TYPES } from '../domains/china-culture/type-catalog.js';
import {
  CHINA_CULTURE_GENERATION_TYPE_ROUTING,
  CHINA_CULTURE_STORY_STRUCTURE_ROUTING,
  CHINA_CULTURE_VIDEO_TYPE_ROUTING,
  chinaCultureGenerationTypes,
  chinaCultureStoryStructures,
  chinaCultureVideoTypes,
} from '../domains/china-culture/type-routing.js';

describe('china_culture type routing', () => {
  it('covers every catalog entry type in all three routing dimensions', () => {
    const catalogNames = CHINA_CULTURE_ENTRY_TYPES.map(type => type.name).sort();

    expect(Object.keys(CHINA_CULTURE_GENERATION_TYPE_ROUTING).sort()).toEqual(catalogNames);
    expect(Object.keys(CHINA_CULTURE_VIDEO_TYPE_ROUTING).sort()).toEqual(catalogNames);
    expect(Object.keys(CHINA_CULTURE_STORY_STRUCTURE_ROUTING).sort()).toEqual(catalogNames);
  });

  it('keeps catalog recommendations identical to executable generation and video routing', () => {
    for (const type of CHINA_CULTURE_ENTRY_TYPES) {
      expect(chinaCultureGenerationTypes(type.name)).toEqual(type.recommended_generation_types);
      expect(chinaCultureVideoTypes(type.name)).toEqual(type.recommended_video_types);
      expect(chinaCultureStoryStructures(type.name)).not.toHaveLength(0);
    }
  });

  it('uses deterministic safe fallbacks for an unknown legacy entry type', () => {
    expect(chinaCultureGenerationTypes('未来未知类型')).toEqual(['character_story']);
    expect(chinaCultureVideoTypes('未来未知类型')).toEqual(['character_story']);
    expect(chinaCultureStoryStructures('未来未知类型')).toEqual(['single_event_drama']);
  });

  it('keeps the three routing matrices out of the legacy story service body', async () => {
    const storyService = await readFile(new URL('../services/story-service.ts', import.meta.url), 'utf-8');

    expect(storyService).not.toContain('TYPE_VIDEO_TYPE_ROUTING');
    expect(storyService).not.toContain('TYPE_GENERATION_ROUTING');
    expect(storyService).not.toContain('TYPE_STORY_STRUCTURE_ROUTING');
  });
});
