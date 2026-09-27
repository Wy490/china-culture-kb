import { describe, expect, it } from 'vitest';
import type { MaterialPack, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import liaofan from './fixtures/liaofan-production-requirements-v2.json';
import { buildAdaptationAnalysis } from '../services/adaptation-analysis-service.js';
import { validateGenreStoryQuality } from '../services/genre-quality-service.js';

// Read-only projection of the real 20260926 Liaofan v2; unused GEARS units are omitted.
const story = liaofan.story as StoryGenerateResult;
const baseReport = liaofan.base_report as StoryQualityReport;
const source = '少年阿青在书院门口看见一封密信。阿青决定留下来寻找遗失铜铃。王逵从藏书楼走来，拒绝交还钥匙。';

function sourcePack(sourceType: 'user_source_text' | 'manual_note', summary = source): MaterialPack {
  return {
    schema_version: 'material-pack/v1',
    primary_materials: [{
      material_id: 'original-excerpt', title: '原作片段', summary,
      source_type: sourceType, purpose: ['source_work'], provenance: '用户提供片段',
    }],
    supporting_materials: [], reference_materials: [], visual_assets: [],
    verified_facts: [], uncertain_claims: [], creative_space: [], missing_needs: [], overall_confidence: 0.8,
  };
}

function missingSourceStory(): StoryGenerateResult {
  return {
    ...story,
    full_text: '山村里的人望着远处的灯火。',
    logline: '村落夜景', theme: '夜色', characters: [], argument_points: [], knowledge_outline: [],
    scene_breakdown: story.scene_breakdown.map(scene => ({
      ...scene, plot: '山村里的人望着远处的灯火。', title: '夜景', characters: [],
      key_action: '抬头', dialogue_or_narration: '灯火亮起。', cultural_note: '', conflict: '', visual_prompt: '村落夜景',
    })),
    gears_segments: [],
  };
}

describe('adaptation source quality', () => {
  it('does not invent missing characters from the real Liaofan production request', () => {
    const report = validateGenreStoryQuality({ story, baseReport });

    expect(report.issues.filter(issue => issue.includes('原作关键人物/称谓'))).toEqual([]);
    expect(report.repair_actions.join('\n')).not.toMatch(/分钟国风|水墨、视频/);
    expect(report).toMatchObject({
      adaptation_comparison: { status: 'needs_source_material', source_status: 'requirements_only' },
      passed: false,
    });
    expect(report.issues).toContain(baseReport.issues[0]);
    expect(report.family_quality_report).toEqual(baseReport.family_quality_report);
  });

  it('keeps production requirements out of original-work anchors', () => {
    const analysis = buildAdaptationAnalysis(story.original_user_query);

    expect(analysis).toMatchObject({
      source_length: 0,
      core_characters: [],
      plot_beats: [],
      must_keep: [],
      source_trace: {
        status: 'requirements_only',
        source_text: '',
        production_requirements: [story.original_user_query],
      },
    });
  });

  it.each([
    '请制作约180秒的动画，16:9，温润男声配音并加BGM。',
    '画幅：9:16；配音：成年男声；字幕：中文；画风：国风水墨。',
    '请用孔先生和袁了凡的故事制作3分钟国风视频。',
  ])('does not extract source anchors from specifications: %s', query => {
    expect(buildAdaptationAnalysis(query)).toMatchObject({
      core_characters: [], plot_beats: [], must_keep: [],
      source_trace: { status: 'requirements_only', source_text: '' },
    });
  });

  it('separates a mixed brief while retaining missing real characters, beats and keep items', () => {
    const query = `${story.original_user_query}。\n${source}`;
    const analysis = buildAdaptationAnalysis(query);
    expect(analysis.source_trace).toMatchObject({
      status: 'comparable', source_refs: ['original_user_query'], source_text: source.replaceAll('。', '。\n').trim(),
    });
    expect(analysis.core_characters).toEqual(expect.arrayContaining(['阿青', '王逵']));
    const report = validateGenreStoryQuality({
      story: {
        ...missingSourceStory(), original_user_query: query,
        adaptation_analysis: { ...analysis, must_keep: ['遗失铜铃必须归还'] },
      }, baseReport,
    });
    expect(report.adaptation_comparison?.status).toBe('checked');
    expect(report.issues.join('\n')).toContain('原作关键人物/称谓未进入改编方案：阿青、王逵');
    expect(report.issues.join('\n')).toContain('原作主线节拍未被改编承接');
    expect(report.issues.join('\n')).toContain('原作保留项未落实：遗失铜铃必须归还');
    expect(report.issues.join('\n')).not.toMatch(/分钟国风、水墨、视频/);
  });

  it('uses typed source-work material when the user query contains only production requirements', () => {
    const materialPack = sourcePack('user_source_text');
    const analysis = buildAdaptationAnalysis(story.original_user_query, { materialPack });
    expect(analysis.source_trace).toMatchObject({ status: 'comparable', source_refs: ['material_pack:original-excerpt'] });
    const report = validateGenreStoryQuality({
      story: {
        ...missingSourceStory(), material_pack: materialPack,
        // Legacy metadata must be resolved from material provenance, without rewriting it.
        adaptation_analysis: { ...story.adaptation_analysis!, core_characters: [] },
      }, baseReport,
    });
    expect(report.issues.join('\n')).toContain('阿青、王逵');
    expect(report.issues.join('\n')).toContain('原作主线节拍未被改编承接');
    expect(report.adaptation_comparison?.source_refs).toEqual(['material_pack:original-excerpt']);
    expect(materialPack.verified_facts).toEqual([]);
  });

  it('still recovers real source names for a legacy empty character list', () => {
    const report = validateGenreStoryQuality({
      story: { ...missingSourceStory(), original_user_query: source, adaptation_analysis: story.adaptation_analysis },
      baseReport,
    });
    expect(report.issues.join('\n')).toContain('原作关键人物/称谓未进入改编方案：阿青、王逵');
  });

  it('does not mistake a technical object inside a narrative for a production instruction', () => {
    const analysis = buildAdaptationAnalysis('阿青看见门外横屏视频亮起，三分钟后决定离开。');
    expect(analysis.source_trace?.status).toBe('comparable');
    expect(analysis.core_characters).toContain('阿青');
  });

  it.each([
    [undefined, 'empty', 'needs_source_material'],
    ['', 'empty', 'needs_source_material'],
    ['来源未知，材料稍后补充。', 'unknown_source', 'needs_source_clarification'],
    ['《未提供正文的书名》', 'unknown_source', 'needs_source_clarification'],
  ])('reports a pending comparison without invented anchors for %s', (query, sourceStatus, status) => {
    const analysis = buildAdaptationAnalysis(query);
    expect(analysis).toMatchObject({ core_characters: [], plot_beats: [], source_trace: { status: sourceStatus, source_text: '' } });
    const report = validateGenreStoryQuality({
      story: { ...story, original_user_query: query, adaptation_analysis: analysis }, baseReport,
    });
    expect(report.adaptation_comparison).toMatchObject({ status, source_status: sourceStatus });
    expect(report.passed).toBe(false);
    expect(report.issues.filter(issue => /原作关键人物|原作主线节拍/.test(issue))).toEqual([]);
  });

  it('keeps untyped notes pending instead of using them as original-work evidence', () => {
    const analysis = buildAdaptationAnalysis(undefined, { materialPack: sourcePack('manual_note') });
    expect(analysis.source_trace?.status).toBe('empty');
    expect(analysis.core_characters).toEqual([]);
    const report = validateGenreStoryQuality({
      story: { ...story, original_user_query: undefined, adaptation_analysis: undefined }, baseReport,
    });
    expect(report.adaptation_comparison?.status).toBe('needs_source_material');
  });

  it.each(['https://example.test/original', '来源：https://example.test/original', '《了凡四训》'])('does not treat a source locator as supplied original text: %s', locator => {
    const materialPack = sourcePack('user_source_text', locator);
    const analysis = buildAdaptationAnalysis(undefined, { materialPack });
    expect(analysis.source_trace?.status).toBe('unknown_source');
    const report = validateGenreStoryQuality({
      story: { ...story, original_user_query: undefined, material_pack: materialPack, adaptation_analysis: analysis }, baseReport,
    });
    expect(report.adaptation_comparison?.status).toBe('needs_source_clarification');
  });

  it('preserves specified original-work anchors when the adaptation contains them', () => {
    const analysis = buildAdaptationAnalysis(source);
    const report = validateGenreStoryQuality({
      story: { ...story, original_user_query: source, full_text: source, adaptation_analysis: analysis }, baseReport,
    });
    expect(report.issues.filter(issue => /原作关键人物|原作主线节拍/.test(issue))).toEqual([]);
    expect(report.passed).toBe(false); // The unrelated teaching-visual defect still blocks.
  });
});
