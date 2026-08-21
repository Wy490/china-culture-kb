import { describe, expect, it } from 'vitest';
import { buildStoryGenreCompositionMatrixReport } from '../services/story-genre-composition-matrix-service.js';

describe('story genre composition matrix service', () => {
  it('covers every cultural source kind and expanded mechanism with synchronized fusion output', () => {
    const report = buildStoryGenreCompositionMatrixReport();

    expect(report.status).toBe('passed');
    expect(report.summary).toMatchObject({
      case_count: 16,
      passed_case_count: 16,
      source_kind_coverage: '8/8',
      primary_pattern_coverage: '16/16',
      secondary_pattern_coverage: '16/16',
      mixed_source_case_count: 8,
      semantic_tension_rule_count: 4,
      capacity_conflict_fail_closed: true,
    });
    expect(report.cases.every(item => Object.values(item.checks).every(Boolean))).toBe(true);
    expect(report.boundaries).toEqual({
      external_model_invoked: false,
      human_review_complete: false,
      professional_credit_granted: false,
      real_production_credit_granted: false,
      province_markdown_written: false,
    });
  });
});
