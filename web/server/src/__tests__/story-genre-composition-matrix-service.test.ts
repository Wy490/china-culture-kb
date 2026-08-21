import { describe, expect, it } from 'vitest';
import { buildStoryGenreCompositionMatrixReport } from '../services/story-genre-composition-matrix-service.js';

describe('story genre composition matrix service', () => {
  it('covers every cultural source kind and expanded mechanism with synchronized fusion output', () => {
    const report = buildStoryGenreCompositionMatrixReport();

    expect(report.schema_version).toBe('story-genre-composition-matrix/v2');
    expect(report.status).toBe('passed');
    expect(report.summary).toMatchObject({
      case_count: 28,
      passed_case_count: 28,
      mechanism_coverage_case_count: 16,
      compatibility_duration_case_count: 12,
      source_kind_coverage: '8/8',
      primary_pattern_coverage: '16/16',
      secondary_pattern_coverage: '16/16',
      mixed_source_case_count: 8,
      semantic_tension_rule_count: 4,
      compatible_video_type_coverage: '4/4',
      duration_coverage: '3/3',
      video_type_duration_cell_coverage: '12/12',
      capacity_conflict_skeleton_coverage: '12/12',
      capacity_conflict_fail_closed: true,
    });
    expect(report.cases.every(item => Object.values(item.checks).every(Boolean))).toBe(true);
    expect(report.cases.filter(item => item.suite === 'compatibility_duration')).toHaveLength(12);
    expect(new Set(report.cases.map(item => item.video_type))).toEqual(new Set([
      'ai_comic_drama',
      'character_story',
      'historical_drama',
      'legend_story',
    ]));
    expect(new Set(report.cases.map(item => item.target_duration))).toEqual(new Set([
      '30秒',
      '1分钟',
      '3分钟',
    ]));
    expect(report.boundaries).toEqual({
      external_model_invoked: false,
      human_review_complete: false,
      professional_credit_granted: false,
      real_production_credit_granted: false,
      province_markdown_written: false,
    });
  });
});
