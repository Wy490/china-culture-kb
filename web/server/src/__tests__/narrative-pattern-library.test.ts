import { describe, expect, it } from 'vitest';
import type { VideoType } from '@shared/types.js';
import {
  getNarrativePatternCatalog,
  getNarrativePatternQualitySignals,
  getNarrativePatternRequirementLines,
  getNarrativePatternsForVideoType,
  NARRATIVE_PATTERN_VIDEO_TYPE_MAP,
  resolveActivePatternIds,
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

      expect(patterns.length).toBeGreaterThanOrEqual(1);
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

  it('keeps default pattern packs focused for each video type', () => {
    expect(resolveActivePatternIds('character_story')).toEqual(['hero_choice', 'historical_causal_story']);
    expect(resolveActivePatternIds('historical_drama')).toEqual(['historical_causal_story', 'hero_choice']);
    expect(resolveActivePatternIds('ai_comic_drama')).toEqual(['source_fidelity_adaptation', 'chapter_slice_adaptation']);
  });

  it('can still strengthen longform AI comic with selected engines', () => {
    const labels = getNarrativePatternsForVideoType('ai_comic_drama').map(pattern => pattern.label);

    expect(labels).toEqual(['原作保真改编', '章节切片改编']);

    const strengthenedLabels = getNarrativePatternsForVideoType('ai_comic_drama', ['infinite_mission', 'mystery_reveal'])
      .map(pattern => pattern.label);
    expect(strengthenedLabels).toEqual(expect.arrayContaining(['无限流任务生存', '悬疑揭示']));
  });

  it('exposes novel adaptation pattern packs for user-owned stories', () => {
    const labels = getNarrativePatternsForVideoType('ai_comic_drama', [
      'source_fidelity_adaptation',
      'chapter_slice_adaptation',
      'novel_scene_compression',
      'character_arc_adaptation',
      'serial_hook_adaptation',
    ]).map(pattern => pattern.label);

    expect(labels).toEqual(expect.arrayContaining([
      '原作保真改编',
      '章节切片改编',
      '小说场景压缩',
      '角色弧线改编',
      '连续剧钩子改编',
    ]));
  });

  it('models wuxia as multiple subgenre mechanisms instead of a single bucket', () => {
    const catalog = getNarrativePatternCatalog();
    const aiComicPatternIds = catalog.video_type_map.ai_comic_drama;
    const wuxiaPatterns = catalog.patterns.filter(pattern => pattern.subject_family === 'wuxia');

    expect(wuxiaPatterns.map(pattern => pattern.pattern_id)).toEqual(expect.arrayContaining([
      'wuxia_chivalric_epic',
      'wuxia_lone_blade_mystery',
      'wuxia_sect_growth',
      'wuxia_revenge_journey',
      'wuxia_court_jianghu',
      'wuxia_romance_honor',
    ]));
    expect(wuxiaPatterns.every(pattern => pattern.subgenre_tags && pattern.subgenre_tags.length > 0)).toBe(true);
    expect(wuxiaPatterns.every(pattern => pattern.user_facing_summary)).toBe(true);
    expect(wuxiaPatterns.every(pattern => pattern.style_axes && pattern.style_axes.length > 0)).toBe(true);
    expect(aiComicPatternIds).toEqual(expect.arrayContaining(['wuxia_chivalric_epic', 'wuxia_lone_blade_mystery']));
  });

  it('exports prompt requirement lines and quality signals', () => {
    expect(getNarrativePatternRequirementLines('historical_drama').join('\n')).toContain('历史因果讲述');
    expect(getNarrativePatternRequirementLines('ai_comic_drama', ['wuxia_lone_blade_mystery']).join('\n')).toContain('表达轴=');
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
