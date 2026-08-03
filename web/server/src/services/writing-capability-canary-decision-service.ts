import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  WritingCapabilityAdapterV1Schema,
  WritingCapabilityRolloutPolicyV1Schema,
} from '@shared/schemas.js';
import { preflightWritingCapabilityAdapter } from './writing-capability-adapter-service.js';
import {
  WritingCapabilityShadowEvaluationDatasetV1Schema,
  WritingCapabilityShadowEvaluationPolicyV1Schema,
  WritingCapabilityShadowEvaluationReportV1Schema,
} from './writing-capability-shadow-evaluation-service.js';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const ReviewBindingSchema = z.object({
  dataset_sha256: Sha256Schema,
  evaluation_report_sha256: Sha256Schema,
  evaluation_baseline_sha256: Sha256Schema,
  adapter_sha256: Sha256Schema,
  adapter_preflight_sha256: Sha256Schema,
  rollout_policy_sha256: Sha256Schema,
  evaluation_policy_sha256: Sha256Schema,
  rollback_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
}).strict();

const ReviewJudgmentSchema = z.object({
  check_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  decision: z.enum(['pass', 'fail']),
  note: z.string().trim().min(10).max(500),
}).strict();

export const WritingCapabilityHumanReviewIntakeV1Schema = z.object({
  schema_version: z.literal('writing-capability-human-review-intake/v1'),
  intake_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  review_environment: z.enum(['verified_human', 'contract_fixture']),
  binding: ReviewBindingSchema,
  reviewer: z.object({
    reviewer_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
    display_name: z.string().trim().min(1).max(120),
    role: z.enum(['screenwriter_editor', 'culture_fact_reviewer', 'director_producer']),
    identity_record_id: z.string().trim().min(1).max(160),
    actor_type: z.enum(['human', 'machine']),
    machine_generated: z.boolean(),
    independent_from_machine_evaluator: z.boolean(),
    reviewed_without_automated_approval: z.boolean(),
  }).strict(),
  sample_reviews: z.array(z.object({
    sample_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
    judgments: z.array(ReviewJudgmentSchema).min(1).refine(
      values => new Set(values.map(value => value.check_id)).size === values.length,
      'judgment check_id values must be unique per sample',
    ),
  }).strict()).min(1).refine(
    values => new Set(values.map(value => value.sample_id)).size === values.length,
    'sample review IDs must be unique',
  ),
  overall_recommendation: z.enum(['eligible', 'blocked']),
  signed_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
  attestation_sha256: Sha256Schema,
  boundary: z.object({
    evidence_only: z.literal(true),
    activates_capability: z.literal(false),
    counts_as_production_authorization: z.literal(false),
    persistence_allowed: z.literal(false),
    public_api_exposed: z.literal(false),
  }).strict(),
}).strict();

export const WritingCapabilityCanaryDecisionPackageV1Schema = z.object({
  schema_version: z.literal('writing-capability-canary-decision-package/v1'),
  decision: z.enum(['eligible', 'blocked']),
  decision_at: z.string().datetime({ offset: true }),
  intake_id: z.string(),
  binding: ReviewBindingSchema,
  blockers: z.array(z.string()).refine(
    values => new Set(values).size === values.length,
    'blockers must be unique',
  ),
  summary: z.object({
    reviewed_sample_count: z.number().int().nonnegative(),
    required_sample_count: z.number().int().nonnegative(),
    judgment_count: z.number().int().nonnegative(),
    passed_judgment_count: z.number().int().nonnegative(),
    failed_judgment_count: z.number().int().nonnegative(),
    reviewer_count: z.literal(1),
  }).strict(),
  reviewer: z.object({
    reviewer_id: z.string(),
    display_name: z.string(),
    role: z.string(),
    identity_record_id: z.string(),
    actor_type: z.enum(['human', 'machine']),
    machine_generated: z.boolean(),
  }).strict(),
  rollback_evidence: z.object({
    rollback_id: z.string(),
    identity_verified: z.boolean(),
    activation_performed: z.literal(false),
    rollback_execution_required: z.literal(false),
  }).strict(),
  boundary: z.object({
    read_only: z.literal(true),
    canary_executed: z.literal(false),
    capability_enabled: z.literal(false),
    activation_allowed: z.literal(false),
    counts_as_production_authorization: z.literal(false),
    affects_generation: z.literal(false),
    persistence_allowed: z.literal(false),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict().superRefine((value, context) => {
  if ((value.decision === 'eligible') !== (value.blockers.length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['decision'],
      message: 'eligible requires zero blockers',
    });
  }
});

type HumanReviewIntake = z.infer<typeof WritingCapabilityHumanReviewIntakeV1Schema>;
type ReviewBinding = z.infer<typeof ReviewBindingSchema>;
type CanaryDecisionPackage = z.infer<typeof WritingCapabilityCanaryDecisionPackageV1Schema>;

export function createWritingCapabilityHumanReviewBinding(input: {
  dataset: unknown;
  evaluation: unknown;
  evaluationBaselineSha256: string;
  evaluationPolicy: unknown;
  adapter: unknown;
  rolloutPolicy: unknown;
}): ReviewBinding {
  const dataset = WritingCapabilityShadowEvaluationDatasetV1Schema.parse(input.dataset);
  const evaluation = WritingCapabilityShadowEvaluationReportV1Schema.parse(input.evaluation);
  const evaluationPolicy = WritingCapabilityShadowEvaluationPolicyV1Schema.parse(
    input.evaluationPolicy,
  );
  const adapter = WritingCapabilityAdapterV1Schema.parse(input.adapter);
  const rolloutPolicy = WritingCapabilityRolloutPolicyV1Schema.parse(input.rolloutPolicy);
  const preflight = preflightWritingCapabilityAdapter({ adapter, rolloutPolicy });
  return deepFreeze(ReviewBindingSchema.parse({
    dataset_sha256: evaluation.dataset_sha256,
    evaluation_report_sha256: digest(evaluation),
    evaluation_baseline_sha256: Sha256Schema.parse(input.evaluationBaselineSha256),
    adapter_sha256: digest(adapter),
    adapter_preflight_sha256: digest(preflight),
    rollout_policy_sha256: digest(rolloutPolicy),
    evaluation_policy_sha256: digest(evaluationPolicy),
    rollback_id: adapter.rollback_id,
  }));
}

export function computeWritingCapabilityHumanReviewAttestationSha256(input: unknown): string {
  const value = input as Record<string, any>;
  return digest({
    schema_version: value.schema_version,
    intake_id: value.intake_id,
    review_environment: value.review_environment,
    binding: value.binding,
    reviewer: value.reviewer,
    sample_reviews: value.sample_reviews,
    overall_recommendation: value.overall_recommendation,
    signed_at: value.signed_at,
    expires_at: value.expires_at,
    boundary: value.boundary,
  });
}

export function buildWritingCapabilityCanaryDecisionPackage(input: {
  dataset: unknown;
  evaluation: unknown;
  evaluationBaselineSha256: string;
  evaluationPolicy: unknown;
  adapter: unknown;
  rolloutPolicy: unknown;
  humanReviewIntake: unknown;
  decisionAt: string;
}): CanaryDecisionPackage {
  const dataset = WritingCapabilityShadowEvaluationDatasetV1Schema.parse(input.dataset);
  const evaluation = WritingCapabilityShadowEvaluationReportV1Schema.parse(input.evaluation);
  const evaluationPolicy = WritingCapabilityShadowEvaluationPolicyV1Schema.parse(
    input.evaluationPolicy,
  );
  const adapter = WritingCapabilityAdapterV1Schema.parse(input.adapter);
  const rolloutPolicy = WritingCapabilityRolloutPolicyV1Schema.parse(input.rolloutPolicy);
  const intake = WritingCapabilityHumanReviewIntakeV1Schema.parse(input.humanReviewIntake);
  const decisionAt = z.string().datetime({ offset: true }).parse(input.decisionAt);
  const expectedBinding = createWritingCapabilityHumanReviewBinding(input);
  const blockers: string[] = [];
  if (evaluation.machine_gate_status !== 'passed') blockers.push('machine_gate_not_passed');
  if (JSON.stringify(intake.binding) !== JSON.stringify(expectedBinding)) {
    blockers.push('review_binding_mismatch');
  }
  if (intake.binding.rollback_id !== adapter.rollback_id) {
    blockers.push('rollback_identity_mismatch');
  }
  if (intake.review_environment !== 'verified_human') {
    blockers.push('review_environment_not_verified_human');
  }
  if (
    intake.reviewer.actor_type !== 'human'
    || intake.reviewer.machine_generated
    || !intake.reviewer.independent_from_machine_evaluator
    || !intake.reviewer.reviewed_without_automated_approval
  ) {
    blockers.push('machine_or_self_signed_review_forbidden');
  }
  if (
    computeWritingCapabilityHumanReviewAttestationSha256(intake)
    !== intake.attestation_sha256
  ) {
    blockers.push('review_attestation_hash_mismatch');
  }
  const decisionTime = Date.parse(decisionAt);
  if (Date.parse(intake.signed_at) > decisionTime) blockers.push('review_signed_after_decision');
  if (Date.parse(intake.expires_at) < decisionTime) blockers.push('review_evidence_expired');

  const expectedSampleIds = dataset.samples.map(sample => sample.sample_id).sort();
  const reviewedSampleIds = intake.sample_reviews.map(review => review.sample_id).sort();
  if (JSON.stringify(expectedSampleIds) !== JSON.stringify(reviewedSampleIds)) {
    blockers.push('sample_review_coverage_incomplete');
  }
  const requiredCheckIds = evaluationPolicy.human_review_checklist
    .map(item => item.check_id).sort();
  for (const review of intake.sample_reviews) {
    const reviewedCheckIds = review.judgments.map(judgment => judgment.check_id).sort();
    if (JSON.stringify(requiredCheckIds) !== JSON.stringify(reviewedCheckIds)) {
      blockers.push('checklist_coverage_incomplete');
    }
  }
  const judgments = intake.sample_reviews.flatMap(review => review.judgments);
  if (judgments.some(judgment => judgment.decision === 'fail')) {
    blockers.push('human_judgment_failed');
  }
  if (intake.overall_recommendation !== 'eligible') {
    blockers.push('human_recommendation_blocked');
  }
  const uniqueBlockers = uniqueSorted(blockers);
  const identityVerified = (
    uniqueBlockers.every(blocker => ![
      'review_binding_mismatch',
      'rollback_identity_mismatch',
    ].includes(blocker))
    && expectedBinding.rollback_id === rolloutPolicy.candidate.rollback_id
  );
  return deepFreeze(WritingCapabilityCanaryDecisionPackageV1Schema.parse({
    schema_version: 'writing-capability-canary-decision-package/v1',
    decision: uniqueBlockers.length === 0 ? 'eligible' : 'blocked',
    decision_at: decisionAt,
    intake_id: intake.intake_id,
    binding: expectedBinding,
    blockers: uniqueBlockers,
    summary: {
      reviewed_sample_count: intake.sample_reviews.length,
      required_sample_count: dataset.samples.length,
      judgment_count: judgments.length,
      passed_judgment_count: judgments.filter(item => item.decision === 'pass').length,
      failed_judgment_count: judgments.filter(item => item.decision === 'fail').length,
      reviewer_count: 1,
    },
    reviewer: {
      reviewer_id: intake.reviewer.reviewer_id,
      display_name: intake.reviewer.display_name,
      role: intake.reviewer.role,
      identity_record_id: intake.reviewer.identity_record_id,
      actor_type: intake.reviewer.actor_type,
      machine_generated: intake.reviewer.machine_generated,
    },
    rollback_evidence: {
      rollback_id: adapter.rollback_id,
      identity_verified: identityVerified,
      activation_performed: false,
      rollback_execution_required: false,
    },
    boundary: {
      read_only: true,
      canary_executed: false,
      capability_enabled: false,
      activation_allowed: false,
      counts_as_production_authorization: false,
      affects_generation: false,
      persistence_allowed: false,
      public_api_exposed: false,
      third_party_code_executed: false,
    },
  }));
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
