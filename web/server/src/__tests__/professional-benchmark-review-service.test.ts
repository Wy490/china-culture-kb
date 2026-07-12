import { describe, expect, it } from 'vitest';
import { VIDEO_TYPE_CONFIG, type ProfessionalQualityDimensionId, type VideoType } from '@shared/types.js';
import {
  evaluateProfessionalBlindReviewBundle,
  professionalBlindReviewWeightContract,
  type ProfessionalBlindReviewBundle,
  type ProfessionalBlindReviewRole,
} from '../services/professional-benchmark-review-service.js';

const dimensions: ProfessionalQualityDimensionId[] = [
  'creative_brief_and_audience_promise',
  'premise_and_theme_unity',
  'structure_causality_and_pacing',
  'character_agency_and_relationship_change',
  'scene_function_visible_action_and_blocking',
  'dialogue_narration_and_subtext',
  'emotional_curve_and_aftertaste',
  'cultural_fact_and_adaptation_boundary',
  'production_executability',
  'originality_and_distinctiveness',
];

function bundle(score = 87, videoType: VideoType = 'character_story'): ProfessionalBlindReviewBundle {
  const roles: ProfessionalBlindReviewRole[] = [
    'screenwriter_or_script_editor',
    'genre_or_director_reviewer',
    'fact_or_culture_reviewer',
  ];
  return {
    schema_version: 'professional-benchmark-blind-review/v2',
    benchmark_id: `${videoType}-benchmark-001`,
    video_type: videoType,
    run_id: 'run-001',
    final_package_sha256: 'a'.repeat(64),
    candidate_label: 'candidate-Q7',
    randomization_batch_id: 'blind-batch-001',
    evaluator_did_not_know_origin: true,
    baseline: {
      baseline_id: 'licensed-baseline-001',
      artifact_sha256: 'b'.repeat(64),
      rights: 'licensed',
      average_score: 88,
    },
    reviews: roles.map((role, index) => ({
      review_id: `review-${index + 1}`,
      reviewer_id: `reviewer-${index + 1}`,
      role,
      candidate_label: 'candidate-Q7',
      blind_review_declared: true,
      independent_review_declared: true,
      conflict_of_interest_declared: false,
      scores: dimensions.map(dimensionId => ({
        dimension_id: dimensionId,
        score,
        note: `${dimensionId} 独立评分记录`,
      })),
      hard_gate_failures: [],
      fact_or_culture_issues: [],
      production_advance_vote: true,
      submitted_at: `2026-07-11T0${index + 4}:00:00.000Z`,
    })),
  };
}

describe('professional benchmark blind review decision', () => {
  it('passes review thresholds without self-promoting the fixture to professional pass', () => {
    expect(evaluateProfessionalBlindReviewBundle(bundle())).toMatchObject({
      reviewer_count: 3,
      average_score: 87,
      baseline_score_difference: -1,
      production_advance_vote_count: 3,
      hard_gate_failure_count: 0,
      review_threshold_passed: true,
      score_threshold_passed: true,
      counts_as_human_blind_review_pass: false,
      professional_passed: false,
      blockers: [],
    });
  });

  it('uses the exact type contract and digest for all 15 video types', () => {
    const dimensionScores: Record<ProfessionalQualityDimensionId, number> = {
      creative_brief_and_audience_promise: 91,
      premise_and_theme_unity: 86,
      structure_causality_and_pacing: 82,
      character_agency_and_relationship_change: 78,
      scene_function_visible_action_and_blocking: 88,
      dialogue_narration_and_subtext: 84,
      emotional_curve_and_aftertaste: 79,
      cultural_fact_and_adaptation_boundary: 93,
      production_executability: 87,
      originality_and_distinctiveness: 76,
    };
    const results = (Object.keys(VIDEO_TYPE_CONFIG) as VideoType[]).map(videoType => {
      const input = bundle(87, videoType);
      for (const review of input.reviews) for (const score of review.scores) score.score = dimensionScores[score.dimension_id];
      input.baseline.average_score = 80;
      const decision = evaluateProfessionalBlindReviewBundle(input);
      const contract = professionalBlindReviewWeightContract(videoType);
      const expected = Math.round(dimensions.reduce((sum, dimension) =>
        sum + dimensionScores[dimension] * contract.dimension_weights[dimension] / 100, 0) * 100) / 100;
      expect(decision).toMatchObject({
        schema_version: 'professional-benchmark-blind-review-decision/v2',
        video_type: videoType,
        weight_contract_sha256: contract.sha256,
        applied_dimension_weights: contract.dimension_weights,
        average_score: expected,
        counts_as_human_blind_review_pass: false,
        professional_passed: false,
      });
      expect(Object.values(decision.applied_dimension_weights).reduce((sum, value) => sum + value, 0)).toBe(100);
      return decision;
    });
    expect(new Set(results.map(item => item.weight_contract_sha256)).size).toBe(15);
    expect(new Set(results.map(item => item.average_score)).size).toBeGreaterThan(1);
  });

  it('rejects duplicate reviewers and missing role coverage', () => {
    const input = bundle();
    input.reviews[2].reviewer_id = input.reviews[1].reviewer_id;
    input.reviews[2].role = 'genre_or_director_reviewer';

    const result = evaluateProfessionalBlindReviewBundle(input);

    expect(result.professional_passed).toBe(false);
    expect(result.review_threshold_passed).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'duplicate_reviewer',
      'review_role_missing:fact_or_culture_reviewer',
    ]));
  });

  it('rejects high averages when any fact issue or hard gate remains', () => {
    const input = bundle(95);
    input.reviews[2].fact_or_culture_issues.push('关键引文尚未核验原始文献。');

    const result = evaluateProfessionalBlindReviewBundle(input);

    expect(result.average_score).toBe(95);
    expect(result.professional_passed).toBe(false);
    expect(result.review_threshold_passed).toBe(false);
    expect(result.blockers).toContain('review_hard_gate_or_fact_issue_present');
  });

  it('enforces score, baseline-gap and two-thirds production vote thresholds', () => {
    const input = bundle(80);
    input.baseline.average_score = 90;
    input.reviews[1].production_advance_vote = false;
    input.reviews[2].production_advance_vote = false;

    const result = evaluateProfessionalBlindReviewBundle(input);

    expect(result.professional_passed).toBe(false);
    expect(result.review_threshold_passed).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'average_score_below_85',
      'baseline_non_inferiority_gap_exceeded',
      'production_advance_votes_below_two_thirds',
    ]));
  });

  it('uses the character_story contract weights instead of an equal dimension average', () => {
    const input = bundle(95);
    const highWeightLowDimensions = new Set<ProfessionalQualityDimensionId>([
      'structure_causality_and_pacing',
      'character_agency_and_relationship_change',
      'scene_function_visible_action_and_blocking',
      'dialogue_narration_and_subtext',
      'emotional_curve_and_aftertaste',
    ]);
    for (const review of input.reviews) {
      for (const score of review.scores) {
        if (highWeightLowDimensions.has(score.dimension_id)) score.score = 75;
      }
    }
    input.baseline.average_score = 84;

    const result = evaluateProfessionalBlindReviewBundle(input);

    expect(result.average_score).toBe(83.2);
    expect(result.review_threshold_passed).toBe(false);
    expect(result.blockers).toContain('average_score_below_85');
  });

  it('rejects runtime-invalid JSON values instead of relying on TypeScript declarations', () => {
    const input = bundle() as unknown as Record<string, any>;
    input.schema_version = 'wrong/v1';
    input.benchmark_id = '';
    input.baseline.rights = 'unknown';
    input.baseline.average_score = '90';
    input.reviews[0].scores[0].score = '90';
    input.reviews[0].submitted_at = 'not-a-date';

    const result = evaluateProfessionalBlindReviewBundle(input as ProfessionalBlindReviewBundle);

    expect(result.review_threshold_passed).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'review_bundle_schema_invalid',
    ]));
  });
});
