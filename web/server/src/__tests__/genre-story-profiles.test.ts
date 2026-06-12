import { describe, expect, it } from 'vitest';
import type { VideoType } from '@shared/types.js';
import {
  GENRE_STORY_PROFILES,
  getGenreDramaticStructure,
  getGenreReturnJsonFields,
  getGenreStoryProfile,
} from '../services/genre-story-profiles.js';

const ALL_VIDEO_TYPES: VideoType[] = [
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
];

describe('genre-story-profiles', () => {
  it('defines one complete profile for every video type', () => {
    expect(Object.keys(GENRE_STORY_PROFILES).sort()).toEqual([...ALL_VIDEO_TYPES].sort());

    for (const videoType of ALL_VIDEO_TYPES) {
      const profile = getGenreStoryProfile(videoType);

      expect(profile.video_type).toBe(videoType);
      expect(profile.label).not.toBe('');
      expect(profile.narrative_promise).not.toBe('');
      expect(profile.default_story_structures.length).toBeGreaterThan(0);
      expect(profile.compatible_presentation_styles.length).toBeGreaterThan(0);
      expect(profile.framework.length).toBeGreaterThan(0);
      expect(profile.must_include.length).toBeGreaterThan(0);
      expect(profile.avoid.length).toBeGreaterThan(0);
      expect(profile.scene_rules.length).toBeGreaterThan(0);
      expect(profile.gears_rules.length).toBeGreaterThan(0);
      expect(profile.quality_rules.length).toBeGreaterThan(0);
      expect(profile.repair_guidance.length).toBeGreaterThan(0);
    }
  });

  it('provides dramatic scene templates through the same profile source', () => {
    for (const videoType of ALL_VIDEO_TYPES) {
      const structure = getGenreDramaticStructure(videoType);

      expect(structure.video_type).toBe(videoType);
      expect(structure.min_scenes).toBeGreaterThanOrEqual(3);
      expect(structure.max_scenes).toBeGreaterThanOrEqual(structure.min_scenes);
      expect(structure.scene_templates.length).toBeGreaterThan(0);
      for (const template of structure.scene_templates) {
        expect(template.function_label).not.toBe('');
        expect(template.function_description).not.toBe('');
        expect(template.content_guide).not.toBe('');
      }
    }
  });

  it('adds type-specific fields to the model return contract', () => {
    expect(getGenreReturnJsonFields('character_story')).toEqual(
      expect.arrayContaining(['characters', 'protagonist_arc']),
    );
    expect(getGenreReturnJsonFields('heritage_promo')).toEqual(
      expect.arrayContaining(['craft_or_ritual_process', 'modern_connection']),
    );
    expect(getGenreReturnJsonFields('scene_short')).toEqual(
      expect.arrayContaining(['spatial_identity', 'visual_route', 'time_layer', 'atmosphere']),
    );
    expect(getGenreReturnJsonFields('documentary_short')).toEqual(
      expect.arrayContaining(['source_quotes', 'field_notes']),
    );
  });
});
