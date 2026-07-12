import { createHash } from 'node:crypto';
import { VIDEO_TYPE_CONFIG, type ProfessionalQualityDimensionId, type VideoType } from '@shared/types.js';
import { z } from 'zod';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export type ProfessionalBlindReviewRole =
  | 'screenwriter_or_script_editor'
  | 'genre_or_director_reviewer'
  | 'fact_or_culture_reviewer';

export interface ProfessionalBlindReviewDimensionScore {
  dimension_id: ProfessionalQualityDimensionId;
  score: number;
  note: string;
}

export interface ProfessionalBlindReviewRecord {
  review_id: string;
  reviewer_id: string;
  role: ProfessionalBlindReviewRole;
  candidate_label: string;
  blind_review_declared: boolean;
  independent_review_declared: boolean;
  conflict_of_interest_declared: boolean;
  scores: ProfessionalBlindReviewDimensionScore[];
  hard_gate_failures: string[];
  fact_or_culture_issues: string[];
  production_advance_vote: boolean;
  submitted_at: string;
}

export interface ProfessionalBlindReviewBundle {
  schema_version: 'professional-benchmark-blind-review/v2';
  benchmark_id: string;
  video_type: VideoType;
  run_id: string;
  final_package_sha256: string;
  candidate_label: string;
  randomization_batch_id: string;
  evaluator_did_not_know_origin: boolean;
  baseline: {
    baseline_id: string;
    artifact_sha256: string;
    rights: 'public_domain' | 'user_owned' | 'licensed';
    average_score: number;
  };
  reviews: ProfessionalBlindReviewRecord[];
}

export interface ProfessionalBlindReviewDecision {
  schema_version: 'professional-benchmark-blind-review-decision/v2';
  benchmark_id: string;
  video_type: VideoType | '';
  run_id: string;
  weight_contract_schema_version: 'professional-blind-review-weight-contract/v1';
  weight_contract_sha256: string;
  applied_dimension_weights: Record<ProfessionalQualityDimensionId, number>;
  thresholds: typeof PROFESSIONAL_BLIND_REVIEW_THRESHOLDS;
  reviewer_count: number;
  covered_roles: ProfessionalBlindReviewRole[];
  average_score: number;
  dimension_average_scores: Record<ProfessionalQualityDimensionId, number>;
  baseline_average_score: number;
  baseline_score_difference: number;
  production_advance_vote_count: number;
  hard_gate_failure_count: number;
  score_threshold_passed: boolean;
  review_threshold_passed: boolean;
  counts_as_human_blind_review_pass: false;
  professional_passed: false;
  blockers: string[];
}

const DIMENSIONS = [
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
] as const satisfies readonly ProfessionalQualityDimensionId[];

const REQUIRED_ROLES = [
  'screenwriter_or_script_editor',
  'genre_or_director_reviewer',
  'fact_or_culture_reviewer',
] as const satisfies readonly ProfessionalBlindReviewRole[];

export const PROFESSIONAL_BLIND_REVIEW_THRESHOLDS = {
  minimum_weighted_average_score: 85,
  minimum_dimension_score: 75,
  maximum_baseline_gap: 3,
  minimum_production_advance_vote_ratio_numerator: 2,
  minimum_production_advance_vote_ratio_denominator: 3,
  required_role_count: 3,
  required_hard_gate_failure_count: 0,
} as const;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}

export function professionalBlindReviewWeightContract(videoType: VideoType): {
  schema_version: 'professional-blind-review-weight-contract/v1';
  video_type: VideoType;
  dimension_weights: Record<ProfessionalQualityDimensionId, number>;
  thresholds: typeof PROFESSIONAL_BLIND_REVIEW_THRESHOLDS;
  sha256: string;
} {
  const dimensionWeights = { ...getProfessionalTextTypeContract(videoType).quality_dimension_weights };
  const payload = {
    schema_version: 'professional-blind-review-weight-contract/v1' as const,
    video_type: videoType,
    dimension_weights: dimensionWeights,
    thresholds: PROFESSIONAL_BLIND_REVIEW_THRESHOLDS,
  };
  return { ...payload, sha256: createHash('sha256').update(JSON.stringify(stableValue(payload)), 'utf8').digest('hex') };
}

const DimensionIdSchema = z.enum(DIMENSIONS);
const ReviewRoleSchema = z.enum(REQUIRED_ROLES);
const BlindReviewBundleSchema = z.object({
  schema_version: z.literal('professional-benchmark-blind-review/v2'),
  benchmark_id: z.string().min(1),
  video_type: z.custom<VideoType>(value => typeof value === 'string' && value in VIDEO_TYPE_CONFIG),
  run_id: z.string().min(1),
  final_package_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  candidate_label: z.string().min(1),
  randomization_batch_id: z.string().min(1),
  evaluator_did_not_know_origin: z.literal(true),
  baseline: z.object({
    baseline_id: z.string().min(1),
    artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    rights: z.enum(['public_domain', 'user_owned', 'licensed']),
    average_score: z.number().finite().min(0).max(100),
  }).strict(),
  reviews: z.array(z.object({
    review_id: z.string().min(1),
    reviewer_id: z.string().min(1),
    role: ReviewRoleSchema,
    candidate_label: z.string().min(1),
    blind_review_declared: z.literal(true),
    independent_review_declared: z.literal(true),
    conflict_of_interest_declared: z.literal(false),
    scores: z.array(z.object({
      dimension_id: DimensionIdSchema,
      score: z.number().finite().min(0).max(100),
      note: z.string().min(1),
    }).strict()).length(DIMENSIONS.length),
    hard_gate_failures: z.array(z.string()),
    fact_or_culture_issues: z.array(z.string()),
    production_advance_vote: z.boolean(),
    submitted_at: z.string().datetime({ offset: true }),
  }).strict()).min(3),
}).strict();

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function evaluateProfessionalBlindReviewBundle(
  bundle: ProfessionalBlindReviewBundle,
): ProfessionalBlindReviewDecision {
  const parsedBundle = BlindReviewBundleSchema.safeParse(bundle);
  if (!parsedBundle.success) {
    const emptyWeights = Object.fromEntries(DIMENSIONS.map(id => [id, 0])) as Record<ProfessionalQualityDimensionId, number>;
    return {
      schema_version: 'professional-benchmark-blind-review-decision/v2',
      benchmark_id: typeof bundle?.benchmark_id === 'string' ? bundle.benchmark_id : '',
      video_type: typeof bundle?.video_type === 'string' && bundle.video_type in VIDEO_TYPE_CONFIG ? bundle.video_type as VideoType : '',
      run_id: typeof bundle?.run_id === 'string' ? bundle.run_id : '',
      weight_contract_schema_version: 'professional-blind-review-weight-contract/v1',
      weight_contract_sha256: '',
      applied_dimension_weights: emptyWeights,
      thresholds: PROFESSIONAL_BLIND_REVIEW_THRESHOLDS,
      reviewer_count: Array.isArray(bundle?.reviews) ? bundle.reviews.length : 0,
      covered_roles: [],
      average_score: 0,
      dimension_average_scores: emptyWeights,
      baseline_average_score: 0,
      baseline_score_difference: 0,
      production_advance_vote_count: 0,
      hard_gate_failure_count: 0,
      score_threshold_passed: false,
      review_threshold_passed: false,
      counts_as_human_blind_review_pass: false,
      professional_passed: false,
      blockers: [
        'review_bundle_schema_invalid',
        ...parsedBundle.error.issues.map(issue => `review_schema:${issue.path.join('.')}:${issue.code}`),
      ],
    };
  }
  bundle = parsedBundle.data as ProfessionalBlindReviewBundle;
  const blockers: string[] = [];
  if (bundle.schema_version !== 'professional-benchmark-blind-review/v2') blockers.push('invalid_schema_version');
  if (!bundle.benchmark_id?.trim()) blockers.push('benchmark_id_missing');
  if (!bundle.run_id?.trim()) blockers.push('run_id_missing');
  const reviewerIds = new Set(bundle.reviews.map(review => review.reviewer_id));
  const coveredRoles = [...new Set(bundle.reviews.map(review => review.role))];
  if (!/^[a-f0-9]{64}$/.test(bundle.final_package_sha256)) blockers.push('final_package_hash_invalid');
  if (!/^[a-f0-9]{64}$/.test(bundle.baseline.artifact_sha256)) blockers.push('baseline_hash_invalid');
  if (!bundle.baseline.baseline_id.trim()) blockers.push('authorized_baseline_missing');
  if (!['public_domain', 'user_owned', 'licensed'].includes(bundle.baseline.rights)) {
    blockers.push('baseline_rights_invalid');
  }
  if (!Number.isFinite(bundle.baseline.average_score)
    || bundle.baseline.average_score < 0
    || bundle.baseline.average_score > 100) {
    blockers.push('baseline_score_invalid');
  }
  if (!bundle.randomization_batch_id.trim() || !bundle.candidate_label.trim()) blockers.push('blind_randomization_missing');
  if (!bundle.evaluator_did_not_know_origin) blockers.push('blind_origin_declaration_missing');
  if (bundle.reviews.length < 3) blockers.push('reviewer_count_below_three');
  if (reviewerIds.size !== bundle.reviews.length) blockers.push('duplicate_reviewer');
  for (const role of REQUIRED_ROLES) {
    if (!coveredRoles.includes(role)) blockers.push(`review_role_missing:${role}`);
  }

  for (const review of bundle.reviews) {
    if (review.candidate_label !== bundle.candidate_label) blockers.push(`candidate_label_mismatch:${review.review_id}`);
    if (!review.blind_review_declared) blockers.push(`review_not_blind:${review.review_id}`);
    if (!review.independent_review_declared) blockers.push(`review_not_independent:${review.review_id}`);
    if (review.conflict_of_interest_declared) blockers.push(`reviewer_conflict_of_interest:${review.review_id}`);
    const dimensionIds = review.scores.map(score => score.dimension_id);
    if (review.scores.length !== DIMENSIONS.length || new Set(dimensionIds).size !== DIMENSIONS.length) {
      blockers.push(`review_dimensions_incomplete:${review.review_id}`);
    }
    if (review.scores.some(score => score.score < 0 || score.score > 100 || !score.note.trim())) {
      blockers.push(`review_score_invalid:${review.review_id}`);
    }
  }

  const dimensionAverageScores = Object.fromEntries(DIMENSIONS.map(dimensionId => {
    const values = bundle.reviews
      .flatMap(review => review.scores)
      .filter(score => score.dimension_id === dimensionId)
      .map(score => score.score)
      .filter(Number.isFinite);
    const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return [dimensionId, round(average)];
  })) as Record<ProfessionalQualityDimensionId, number>;
  const dimensionValues = Object.values(dimensionAverageScores);
  const weightContract = professionalBlindReviewWeightContract(bundle.video_type);
  const weights = weightContract.dimension_weights;
  const averageScore = round(DIMENSIONS.reduce(
    (sum, dimensionId) => sum + dimensionAverageScores[dimensionId] * (weights[dimensionId] / 100),
    0,
  ));
  const baselineScoreDifference = round(averageScore - bundle.baseline.average_score);
  const productionAdvanceVoteCount = bundle.reviews.filter(review => review.production_advance_vote).length;
  const hardGateFailureCount = bundle.reviews.reduce(
    (sum, review) => sum + review.hard_gate_failures.length + review.fact_or_culture_issues.length,
    0,
  );

  if (averageScore < PROFESSIONAL_BLIND_REVIEW_THRESHOLDS.minimum_weighted_average_score) blockers.push('average_score_below_85');
  if (dimensionValues.some(score => score < PROFESSIONAL_BLIND_REVIEW_THRESHOLDS.minimum_dimension_score)) blockers.push('core_dimension_below_75');
  if (!Number.isFinite(baselineScoreDifference) || baselineScoreDifference < -PROFESSIONAL_BLIND_REVIEW_THRESHOLDS.maximum_baseline_gap) {
    blockers.push('baseline_non_inferiority_gap_exceeded');
  }
  if (productionAdvanceVoteCount < Math.ceil(bundle.reviews.length
    * PROFESSIONAL_BLIND_REVIEW_THRESHOLDS.minimum_production_advance_vote_ratio_numerator
    / PROFESSIONAL_BLIND_REVIEW_THRESHOLDS.minimum_production_advance_vote_ratio_denominator)) {
    blockers.push('production_advance_votes_below_two_thirds');
  }
  if (hardGateFailureCount > 0) blockers.push('review_hard_gate_or_fact_issue_present');

  return {
    schema_version: 'professional-benchmark-blind-review-decision/v2',
    benchmark_id: bundle.benchmark_id,
    video_type: bundle.video_type,
    run_id: bundle.run_id,
    weight_contract_schema_version: weightContract.schema_version,
    weight_contract_sha256: weightContract.sha256,
    applied_dimension_weights: weights,
    thresholds: PROFESSIONAL_BLIND_REVIEW_THRESHOLDS,
    reviewer_count: bundle.reviews.length,
    covered_roles: coveredRoles,
    average_score: averageScore,
    dimension_average_scores: dimensionAverageScores,
    baseline_average_score: bundle.baseline.average_score,
    baseline_score_difference: baselineScoreDifference,
    production_advance_vote_count: productionAdvanceVoteCount,
    hard_gate_failure_count: hardGateFailureCount,
    score_threshold_passed: blockers.length === 0,
    review_threshold_passed: blockers.length === 0,
    counts_as_human_blind_review_pass: false,
    professional_passed: false,
    blockers,
  };
}
