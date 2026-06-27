import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult, VideoType } from '@shared/types.js';
import {
  getNarrativePatternCatalog,
  getNarrativePatternDiagnostics,
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
    expect(resolveActivePatternIds('ai_comic_drama')).toEqual(['platform_short_drama_hook', 'cinematic_setpiece_adaptation']);
  });

  it('can still strengthen longform AI comic with selected engines', () => {
    const labels = getNarrativePatternsForVideoType('ai_comic_drama').map(pattern => pattern.label);

    expect(labels).toEqual(['平台短剧钩子', '影视场面转译']);

    const strengthenedLabels = getNarrativePatternsForVideoType('ai_comic_drama', ['infinite_mission', 'mystery_reveal'])
      .map(pattern => pattern.label);
    expect(strengthenedLabels).toEqual(['无限流任务生存', '悬疑揭示']);
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

  it('honors selected patterns without pulling unrelated video-type defaults', () => {
    const patterns = getNarrativePatternsForVideoType('culture_promo', ['infinite_mission']);

    expect(patterns[0].pattern_id).toBe('infinite_mission');
    expect(patterns.map(pattern => pattern.pattern_id)).toEqual(['infinite_mission']);
  });

  it('returns explainable diagnostics for selected pattern mechanisms', () => {
    const story: StoryGenerateResult = {
      storyId: '20260615-story-pattern',
      title: '雨夜任务',
      generation_type: 'character_story',
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      source_entry: '测试',
      logline: '少年被迫进入一场倒计时任务。',
      theme: '规则与代价',
      full_text: '开场，少年在雨夜被拦住。规则公布：天亮前必须找到旧案证据，失败会失去进入书院的资格。',
      scene_breakdown: [
        {
          scene_id: 1,
          title: '雨夜拦路',
          duration_sec: 20,
          location: '书院门外',
          time_of_day: '雨夜',
          dramatic_function: '钩子开场',
          plot: '少年刚到书院门外就被师兄拦住，倒计时任务突然开始。',
          key_action: '少年抓紧书箱，追问规则',
          characters: ['少年', '师兄'],
          visual_prompt: '雨夜，书院门外，少年和师兄对峙',
          camera_suggestion: '近景对切',
          cultural_note: '测试',
          conflict: '入门资格与任务规则冲突',
        },
      ],
      gears_segments: [],
      gears_segments_url: '/api/stories/20260615-story-pattern/gears-segments',
      cultural_constraints: [],
      credibility_note: '测试',
    };

    const diagnostics = getNarrativePatternDiagnostics({
      story,
      videoType: 'ai_comic_drama',
      selectedPatternIds: ['infinite_mission', 'platform_short_drama_hook'],
    });

    expect(diagnostics.some(item => item.pattern_id === 'infinite_mission' && item.signal === '任务规则清楚' && item.status === 'satisfied')).toBe(true);
    expect(diagnostics.some(item => item.pattern_id === 'platform_short_drama_hook' && item.signal === '前3秒有局' && item.status === 'satisfied')).toBe(true);
    expect(diagnostics.some(item => item.status !== 'satisfied' && item.repair_hint.includes('补强'))).toBe(true);
  });

  it('satisfies compact single-term signals when the term is present', () => {
    const story: StoryGenerateResult = {
      storyId: '20260623-story-hero-choice',
      title: '雨中选择',
      generation_type: 'character_story',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      source_entry: '测试',
      logline: '少年在雨中做出行动具体的选择。',
      theme: '选择与代价',
      full_text: '目标明确，两难成立。少年转身入雨，行动具体，并承担错过渡船的代价。',
      scene_breakdown: [
        {
          scene_id: 1,
          title: '雨中转身',
          duration_sec: 20,
          location: '渡口',
          time_of_day: '傍晚',
          dramatic_function: '关键行动',
          plot: '少年在渡口面对两难，选择转身入雨帮助别人。',
          key_action: '少年转身入雨',
          characters: ['少年'],
          visual_prompt: '渡口，雨水，少年，书袋',
          camera_suggestion: '中景跟拍',
          cultural_note: '测试',
          conflict: '赶路目标与当下助人冲突',
        },
      ],
      gears_segments: [],
      gears_segments_url: '/api/stories/20260623-story-hero-choice/gears-segments',
      cultural_constraints: [],
      credibility_note: '测试',
    };

    const diagnostics = getNarrativePatternDiagnostics({
      story,
      videoType: 'character_story',
    });

    expect(diagnostics.some(item => item.pattern_id === 'hero_choice' && item.signal === '行动具体' && item.status === 'satisfied')).toBe(true);
  });
});
