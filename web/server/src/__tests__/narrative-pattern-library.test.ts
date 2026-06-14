import { describe, expect, it } from 'vitest';
import type { VideoType } from '@shared/types.js';
import {
  getNarrativePatternQualitySignals,
  getNarrativePatternRequirementLines,
  getNarrativePatternsForVideoType,
  NARRATIVE_PATTERN_VIDEO_TYPE_MAP,
} from '../services/narrative-pattern-library.js';

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

describe('narrative-pattern-library', () => {
  it('maps every video type to reusable narrative patterns', () => {
    expect(Object.keys(NARRATIVE_PATTERN_VIDEO_TYPE_MAP).sort()).toEqual([...ALL_VIDEO_TYPES].sort());

    for (const videoType of ALL_VIDEO_TYPES) {
      const patterns = getNarrativePatternsForVideoType(videoType);

      expect(patterns.length).toBeGreaterThanOrEqual(2);
      for (const pattern of patterns) {
        expect(pattern.label).not.toBe('');
        expect(pattern.reference_archetypes.length).toBeGreaterThan(0);
        expect(pattern.narrative_engine).not.toBe('');
        expect(pattern.protagonist_engine).not.toBe('');
        expect(pattern.conflict_engine).not.toBe('');
        expect(pattern.pacing_pattern.length).toBeGreaterThan(0);
        expect(pattern.scene_recipes.length).toBeGreaterThan(0);
        expect(pattern.quality_signals.length).toBeGreaterThan(0);
        expect(pattern.avoid.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers longform AI comic with growth, mission, reveal, strategy and choice engines', () => {
    const labels = getNarrativePatternsForVideoType('ai_comic_drama').map(pattern => pattern.label);

    expect(labels).toEqual(expect.arrayContaining([
      '凡人流成长',
      '无限流任务生存',
      '悬疑揭示',
      '权谋博弈',
      '人物高光选择',
    ]));
  });

  it('exports prompt requirement lines and quality signals', () => {
    expect(getNarrativePatternRequirementLines('historical_drama').join('\n')).toContain('历史因果讲述');
    expect(getNarrativePatternQualitySignals('social_short')).toEqual(
      expect.arrayContaining(['3秒钩子强', '信息密度高']),
    );
  });

  it('merges selected patterns before video-type defaults', () => {
    const patterns = getNarrativePatternsForVideoType('culture_promo', ['infinite_mission']);

    expect(patterns[0].pattern_id).toBe('infinite_mission');
    expect(patterns.map(pattern => pattern.pattern_id)).toEqual(
      expect.arrayContaining(['brand_symbol', 'object_clue_journey']),
    );
  });
});
