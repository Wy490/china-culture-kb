import { describe, expect, it } from 'vitest';
import type { VideoType } from '@shared/types.js';
import {
  GENRE_STORY_PROFILES,
  getGenreDramaticStructure,
  getGenreReturnJsonFields,
  getGenreStoryProfile,
  resolveGenreStoryMatrix,
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
      expect(profile.compatible_use_cases.length).toBeGreaterThan(0);
      expect(profile.compatible_truth_modes.length).toBeGreaterThan(0);
      expect(profile.default_truth_mode).not.toBe('');
      expect(profile.recommended_narrative_patterns.length).toBeGreaterThan(0);
      expect(profile.allowed_narrative_patterns.length).toBeGreaterThan(0);
      expect(profile.material_requirements.length).toBeGreaterThan(0);
      expect(profile.truth_rules.length).toBeGreaterThan(0);
      expect(profile.institutional_rules.length).toBeGreaterThan(0);
      expect(profile.adaptation_rules.length).toBeGreaterThan(0);
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

  it('resolves AI comic defaults and filters documentary-only patterns', () => {
    const matrix = resolveGenreStoryMatrix({
      videoType: 'ai_comic_drama',
      creationUseCase: 'original_ai_comic',
      narrativePatternIds: ['documentary_investigation', 'platform_short_drama_hook'],
    });

    expect(matrix.truth_mode).toBe('fictional_original');
    expect(matrix.compatible_use_case).toBe(true);
    expect(matrix.compatible_truth_mode).toBe(true);
    expect(matrix.resolved_narrative_pattern_ids).toEqual(
      expect.arrayContaining(['platform_short_drama_hook', 'mortal_growth', 'character_arc_adaptation']),
    );
    expect(matrix.resolved_narrative_pattern_ids).not.toContain('documentary_investigation');
    expect(matrix.rejected_narrative_pattern_ids).toContain('documentary_investigation');
    expect(matrix.requirement_lines.join('\n')).toContain('类型矩阵真实模式：fictional_original');
  });

  it('warns when documentary work is requested with fictional comic settings', () => {
    const matrix = resolveGenreStoryMatrix({
      videoType: 'documentary_short',
      creationUseCase: 'original_ai_comic',
      truthMode: 'fictional_original',
      narrativePatternIds: ['platform_short_drama_hook', 'documentary_investigation'],
    });

    expect(matrix.compatible_use_case).toBe(false);
    expect(matrix.compatible_truth_mode).toBe(false);
    expect(matrix.resolved_narrative_pattern_ids).toContain('documentary_investigation');
    expect(matrix.resolved_narrative_pattern_ids).not.toContain('platform_short_drama_hook');
    expect(matrix.warnings.join('\n')).toContain('不是 微纪录片 的优先用途');
    expect(matrix.warnings.join('\n')).toContain('fictional_original');
  });

  it('prefers training-loop patterns for education and training scripts', () => {
    const matrix = resolveGenreStoryMatrix({
      videoType: 'education_training',
      creationUseCase: 'education_training',
      truthMode: 'institutional_verified',
    });

    expect(matrix.resolved_narrative_pattern_ids).toEqual(
      expect.arrayContaining(['training_loop', 'knowledge_gap_explainer', 'lecture_case_argument']),
    );
    expect(matrix.material_requirements.join('\n')).toContain('学习目标');
    expect(matrix.institutional_rules.join('\n')).toContain('制度流程');
    expect(matrix.adaptation_rules.join('\n')).toContain('可教学的案例');
  });
});
