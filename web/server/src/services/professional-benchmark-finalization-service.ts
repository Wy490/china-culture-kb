import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from 'node:crypto';
import { VideoTypeSchema } from '@shared/schemas.js';
import type { ProfessionalQualityDimensionId, VideoType } from '@shared/types.js';
import { z } from 'zod';
import { professionalBlindReviewWeightContract } from './professional-benchmark-review-service.js';

const QUALITY_DIMENSIONS = [
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

const REVIEW_ROLES = [
  'screenwriter_or_script_editor',
  'genre_or_director_reviewer',
  'fact_or_culture_reviewer',
] as const;

const SIGNATURE_SCOPES = [
  'artifact_validation',
  'reviewer_registry',
  'randomization_manifest',
  'review_attestation',
  'rights_evidence',
  'human_verification_record',
] as const;

export type ProfessionalBenchmarkSignatureScope = typeof SIGNATURE_SCOPES[number];

const SIGNATURE_DIGEST_FIELDS: Record<ProfessionalBenchmarkSignatureScope, string> = {
  artifact_validation: 'validation_record_sha256',
  reviewer_registry: 'registry_sha256',
  randomization_manifest: 'manifest_sha256',
  review_attestation: 'attestation_record_sha256',
  rights_evidence: 'evidence_record_sha256',
  human_verification_record: 'verification_record_sha256',
};

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmptyStringSchema = z.string().trim().min(1);
const TimestampSchema = z.string().datetime({ offset: true });
const ReviewRoleSchema = z.enum(REVIEW_ROLES);
const SignatureScopeSchema = z.enum(SIGNATURE_SCOPES);
const Ed25519SignatureSchema = z.string().refine(value => {
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length === 64 && decoded.toString('base64') === value;
  } catch {
    return false;
  }
}, 'expected canonical base64 Ed25519 signature');

const RecordSignatureSchema = z.object({
  schema_version: z.literal('professional-benchmark-ed25519-signature/v1'),
  algorithm: z.literal('Ed25519'),
  key_id: NonEmptyStringSchema,
  signed_payload_sha256: HashSchema,
  signature_base64: Ed25519SignatureSchema,
}).strict();

const TrustedVerifierPolicySchema = z.object({
  schema_version: z.literal('professional-benchmark-trusted-verifier-policy/v1'),
  policy_id: NonEmptyStringSchema,
  trust_source: z.literal('external_configuration'),
  evidence_environment: z.literal('external'),
  established_at: TimestampSchema,
  keys: z.array(z.object({
    key_id: NonEmptyStringSchema,
    algorithm: z.literal('Ed25519'),
    public_key_spki_pem: NonEmptyStringSchema,
    status: z.enum(['trusted', 'revoked']),
    allowed_scopes: z.array(SignatureScopeSchema).min(1),
  }).strict()).min(1),
}).strict();

export type ProfessionalBenchmarkTrustedVerifierPolicy = z.infer<typeof TrustedVerifierPolicySchema>;

const DimensionScoresSchema = z.object(Object.fromEntries(
  QUALITY_DIMENSIONS.map(dimension => [dimension, z.number().finite().min(0).max(100)]),
) as Record<ProfessionalQualityDimensionId, z.ZodNumber>).strict();

const QualitySnapshotSchema = z.object({
  schema_version: z.literal('professional-benchmark-quality-snapshot/v1'),
  package_sha256: HashSchema,
  total_score: z.number().finite().min(0).max(100),
  dimension_scores: DimensionScoresSchema,
  hard_gate_failures: z.array(NonEmptyStringSchema),
  evaluator_id: NonEmptyStringSchema,
  evaluator_version: NonEmptyStringSchema,
  measured_at: TimestampSchema,
}).strict();

const PackageQualityEvidenceSchema = z.object({
  package_sha256: HashSchema,
  quality_snapshot_sha256: HashSchema,
  quality_snapshot: QualitySnapshotSchema,
}).strict();

const ArtifactValidationSchema = z.object({
  schema_version: z.literal('professional-benchmark-artifact-validation-context/v2'),
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  validation_profile: z.literal('professional_completion'),
  integrity_valid: z.boolean(),
  contract_valid: z.boolean(),
  professional_passed: z.literal(false),
  verified_artifact_count: z.number().int().nonnegative(),
  blockers: z.array(NonEmptyStringSchema),
  artifact_manifest_sha256: HashSchema,
  initial_package_sha256: HashSchema,
  final_package_sha256: HashSchema,
  final_quality_report_sha256: HashSchema,
  validator_id: NonEmptyStringSchema,
  validation_record_sha256: HashSchema,
  verified_at: TimestampSchema,
  record_signature: RecordSignatureSchema,
}).strict();

const RevisionTraceSchema = z.object({
  schema_version: z.literal('professional-benchmark-revision-trace/v1'),
  initial_package_sha256: HashSchema,
  final_package_sha256: HashSchema,
  revision_plan_sha256: HashSchema,
  revision_output_sha256: HashSchema,
  initial_quality_snapshot_sha256: HashSchema,
  final_quality_snapshot_sha256: HashSchema,
  applied_action_ids: z.array(NonEmptyStringSchema).min(1),
  unresolved_issue_ids: z.array(NonEmptyStringSchema),
  reported_score_improvement: z.number().finite(),
  quality_improvement_verified: z.boolean(),
  trace_record_sha256: HashSchema,
}).strict();

const BlindReviewDecisionSchema = z.object({
  schema_version: z.literal('professional-benchmark-blind-review-decision/v2'),
  benchmark_id: NonEmptyStringSchema,
  video_type: VideoTypeSchema,
  run_id: NonEmptyStringSchema,
  weight_contract_schema_version: z.literal('professional-blind-review-weight-contract/v1'),
  weight_contract_sha256: HashSchema,
  applied_dimension_weights: DimensionScoresSchema,
  thresholds: z.object({
    minimum_weighted_average_score: z.literal(85),
    minimum_dimension_score: z.literal(75),
    maximum_baseline_gap: z.literal(3),
    minimum_production_advance_vote_ratio_numerator: z.literal(2),
    minimum_production_advance_vote_ratio_denominator: z.literal(3),
    required_role_count: z.literal(3),
    required_hard_gate_failure_count: z.literal(0),
  }).strict(),
  reviewer_count: z.number().int().nonnegative(),
  covered_roles: z.array(ReviewRoleSchema),
  average_score: z.number().finite().min(0).max(100),
  dimension_average_scores: DimensionScoresSchema,
  baseline_average_score: z.number().finite().min(0).max(100),
  baseline_score_difference: z.number().finite().min(-100).max(100),
  production_advance_vote_count: z.number().int().nonnegative(),
  hard_gate_failure_count: z.number().int().nonnegative(),
  score_threshold_passed: z.boolean(),
  review_threshold_passed: z.boolean(),
  counts_as_human_blind_review_pass: z.literal(false),
  professional_passed: z.literal(false),
  blockers: z.array(NonEmptyStringSchema),
}).strict();

const ReviewerRegistrySchema = z.object({
  schema_version: z.literal('professional-benchmark-authorized-reviewer-registry/v2'),
  registry_id: NonEmptyStringSchema,
  registry_sha256: HashSchema,
  authorization_scope: z.literal('professional_benchmark_blind_review'),
  reviewers: z.array(z.object({
    reviewer_id: NonEmptyStringSchema,
    role: ReviewRoleSchema,
    status: z.enum(['authorized', 'revoked']),
    signing_key_id: NonEmptyStringSchema,
    authorization_record_sha256: HashSchema,
    authorized_at: TimestampSchema,
  }).strict()).min(3),
  record_signature: RecordSignatureSchema,
}).strict();

const RandomizationManifestSchema = z.object({
  schema_version: z.literal('professional-benchmark-randomization-manifest/v2'),
  manifest_id: NonEmptyStringSchema,
  manifest_sha256: HashSchema,
  randomization_batch_id: NonEmptyStringSchema,
  candidate_label: NonEmptyStringSchema,
  final_package_sha256: HashSchema,
  baseline_id: NonEmptyStringSchema,
  baseline_artifact_sha256: HashSchema,
  origin_concealed: z.boolean(),
  generated_by_role: z.literal('independent_randomization_operator'),
  generated_at: TimestampSchema,
  evidence_environment: z.enum(['external', 'local']),
  is_fixture: z.boolean(),
  is_simulation: z.boolean(),
  record_signature: RecordSignatureSchema,
}).strict();

const RightsEvidenceSchema = z.object({
  schema_version: z.literal('professional-benchmark-rights-evidence/v1'),
  evidence_id: NonEmptyStringSchema,
  evidence_record_sha256: HashSchema,
  baseline_id: NonEmptyStringSchema,
  baseline_artifact_sha256: HashSchema,
  rights: z.enum(['public_domain', 'user_owned', 'licensed', 'unverified']),
  evidence_reference: NonEmptyStringSchema,
  authorization_scope: z.literal('professional_benchmark_comparative_review'),
  authorized_for_comparative_review: z.boolean(),
  issued_at: TimestampSchema,
  record_signature: RecordSignatureSchema,
}).strict();

const BaselineBindingSchema = z.object({
  baseline_id: NonEmptyStringSchema,
  artifact_sha256: HashSchema,
  rights_evidence: RightsEvidenceSchema,
}).strict();

const ReviewAttestationSchema = z.object({
  schema_version: z.literal('professional-benchmark-review-attestation/v2'),
  attestation_id: NonEmptyStringSchema,
  attestation_record_sha256: HashSchema,
  review_id: NonEmptyStringSchema,
  reviewer_id: NonEmptyStringSchema,
  role: ReviewRoleSchema,
  reviewer_authorization_record_sha256: HashSchema,
  blind_review_bundle_sha256: HashSchema,
  final_package_sha256: HashSchema,
  baseline_artifact_sha256: HashSchema,
  blind_review_declared: z.boolean(),
  independent_review_declared: z.boolean(),
  conflict_of_interest_declared: z.boolean(),
  signed_at: TimestampSchema,
  record_signature: RecordSignatureSchema,
}).strict();

const ReviewDecisionBindingSchema = z.object({
  blind_review_bundle_sha256: HashSchema,
  blind_review_decision_sha256: HashSchema,
  final_package_sha256: HashSchema,
  baseline_artifact_sha256: HashSchema,
  randomization_manifest_sha256: HashSchema,
  threshold_verification_completed: z.boolean(),
  bound_at: TimestampSchema,
}).strict();

const HumanAttestationContextSchema = z.object({
  schema_version: z.literal('professional-benchmark-human-attestation-context/v2'),
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  video_type: VideoTypeSchema,
  verification_status: z.enum(['verified_external', 'unverified']),
  evidence_environment: z.enum(['external', 'local']),
  is_fixture: z.boolean(),
  is_simulation: z.boolean(),
  verified_by_human_id: NonEmptyStringSchema,
  verification_record_sha256: HashSchema,
  verified_at: TimestampSchema,
  reviewer_registry: ReviewerRegistrySchema,
  randomization_manifest: RandomizationManifestSchema,
  baseline_binding: BaselineBindingSchema,
  review_attestations: z.array(ReviewAttestationSchema).min(3),
  review_decision_binding: ReviewDecisionBindingSchema,
  record_signature: RecordSignatureSchema,
}).strict();

const EvidenceProvenanceSchema = z.object({
  schema_version: z.literal('professional-benchmark-finalization-provenance/v1'),
  execution_kind: z.enum(['real_model', 'fixture', 'simulation']),
  generation_mode: z.enum(['external_model', 'local', 'fallback', 'fixture', 'simulation']),
  revision_mode: z.enum(['external_model', 'verified_human', 'external_model_and_verified_human', 'local', 'fixture', 'simulation']),
  review_mode: z.enum(['external_human_blind_review', 'local', 'fixture', 'simulation']),
  evidence_environment: z.enum(['external', 'local']),
  used_fallback: z.boolean(),
  is_fixture: z.boolean(),
  is_simulation: z.boolean(),
  provider_receipt_verified: z.boolean(),
}).strict();

const FinalizationInputSchema = z.object({
  schema_version: z.literal('professional-benchmark-finalization-input/v2'),
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  video_type: VideoTypeSchema,
  provenance: EvidenceProvenanceSchema,
  artifact_validation: ArtifactValidationSchema,
  initial_package: PackageQualityEvidenceSchema,
  final_package: PackageQualityEvidenceSchema,
  revision_trace: RevisionTraceSchema,
  blind_review_decision: BlindReviewDecisionSchema,
  human_attestation_context: HumanAttestationContextSchema,
}).strict();

export type ProfessionalBenchmarkFinalizationInput = z.infer<typeof FinalizationInputSchema>;

export interface ProfessionalBenchmarkFinalizationDecision {
  schema_version: 'professional-benchmark-finalization-decision/v2';
  benchmark_id: string;
  run_id: string;
  video_type: VideoType | '';
  eligible_for_signed_release: boolean;
  professional_passed: false;
  initial_quality_score: number;
  final_quality_score: number;
  verified_quality_improvement: number;
  blockers: string[];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

/** Computes a canonical digest for immutable evidence binding. */
export function computeProfessionalBenchmarkEvidenceSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function signedRecordContent(
  scope: ProfessionalBenchmarkSignatureScope,
  record: unknown,
): Record<string, unknown> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  const content = { ...(record as Record<string, unknown>) };
  delete content.record_signature;
  delete content[SIGNATURE_DIGEST_FIELDS[scope]];
  return content;
}

/**
 * Creates the exact, domain-separated bytes an external Ed25519 signer must sign.
 * The record digest and signature envelope are excluded to avoid recursive signatures.
 */
export function createProfessionalBenchmarkSignaturePayload(
  scope: ProfessionalBenchmarkSignatureScope,
  record: unknown,
): Buffer {
  return Buffer.from(JSON.stringify(canonicalize({
    signature_contract: 'professional-benchmark-ed25519-payload/v1',
    scope,
    payload: signedRecordContent(scope, record),
  })), 'utf8');
}

/** Computes the semantic record digest stored beside a signed record. */
export function computeProfessionalBenchmarkSignedRecordSha256(
  scope: ProfessionalBenchmarkSignatureScope,
  record: unknown,
): string {
  return computeProfessionalBenchmarkEvidenceSha256(signedRecordContent(scope, record));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function safelyReadIdentity(input: unknown): {
  benchmark_id: string;
  run_id: string;
  video_type: VideoType | '';
} {
  if (!input || typeof input !== 'object') return { benchmark_id: '', run_id: '', video_type: '' };
  const value = input as Record<string, unknown>;
  return {
    benchmark_id: typeof value.benchmark_id === 'string' ? value.benchmark_id : '',
    run_id: typeof value.run_id === 'string' ? value.run_id : '',
    video_type: VideoTypeSchema.safeParse(value.video_type).success ? value.video_type as VideoType : '',
  };
}

function signedRecordId(scope: ProfessionalBenchmarkSignatureScope, record: Record<string, unknown>): string {
  const idFields: Record<ProfessionalBenchmarkSignatureScope, string> = {
    artifact_validation: 'run_id',
    reviewer_registry: 'registry_id',
    randomization_manifest: 'manifest_id',
    review_attestation: 'attestation_id',
    rights_evidence: 'evidence_id',
    human_verification_record: 'run_id',
  };
  const value = record[idFields[scope]];
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function verifySignedRecord(
  scope: ProfessionalBenchmarkSignatureScope,
  record: Record<string, unknown>,
  trustedKeys: Map<string, z.infer<typeof TrustedVerifierPolicySchema>['keys'][number]>,
  blockers: string[],
): void {
  const id = signedRecordId(scope, record);
  const signature = record.record_signature as z.infer<typeof RecordSignatureSchema>;
  const digestField = SIGNATURE_DIGEST_FIELDS[scope];
  const expectedRecordDigest = computeProfessionalBenchmarkSignedRecordSha256(scope, record);
  if (record[digestField] !== expectedRecordDigest) {
    blockers.push(`signed_record_digest_mismatch:${scope}:${id}`);
  }

  const payload = createProfessionalBenchmarkSignaturePayload(scope, record);
  const payloadDigest = createHash('sha256').update(payload).digest('hex');
  if (signature.signed_payload_sha256 !== payloadDigest) {
    blockers.push(`signed_payload_digest_mismatch:${scope}:${id}`);
  }

  const trustedKey = trustedKeys.get(signature.key_id);
  if (!trustedKey || trustedKey.status !== 'trusted') {
    blockers.push(`signature_key_not_trusted:${scope}:${id}`);
    return;
  }
  if (!trustedKey.allowed_scopes.includes(scope)) {
    blockers.push(`signature_scope_not_authorized:${scope}:${id}`);
    return;
  }

  try {
    const publicKey = createPublicKey(trustedKey.public_key_spki_pem);
    if (publicKey.asymmetricKeyType !== 'ed25519') {
      blockers.push(`signature_key_not_ed25519:${scope}:${id}`);
      return;
    }
    const valid = verifySignature(
      null,
      payload,
      publicKey,
      Buffer.from(signature.signature_base64, 'base64'),
    );
    if (!valid) blockers.push(`signature_verification_failed:${scope}:${id}`);
  } catch {
    blockers.push(`signature_key_or_verification_invalid:${scope}:${id}`);
  }
}

/**
 * Fail-closed candidate gate. Trust policy must come from external configuration, never from the
 * evidence input. The gate cannot award professional credit; a separate authorized workflow must
 * create a durable signed release record after consuming an eligible decision.
 */
export function evaluateProfessionalBenchmarkFinalization(
  input: unknown,
  externalTrustPolicy?: unknown,
): ProfessionalBenchmarkFinalizationDecision {
  const identity = safelyReadIdentity(input);
  const parsed = FinalizationInputSchema.safeParse(input);
  if (!parsed.success) {
    const legacyUnsigned = Boolean(input && typeof input === 'object'
      && (input as Record<string, unknown>).schema_version === 'professional-benchmark-finalization-input/v1');
    return {
      schema_version: 'professional-benchmark-finalization-decision/v2',
      ...identity,
      eligible_for_signed_release: false,
      professional_passed: false,
      initial_quality_score: 0,
      final_quality_score: 0,
      verified_quality_improvement: 0,
      blockers: unique([
        ...(legacyUnsigned ? ['legacy_unsigned_finalization_input_rejected'] : []),
        'finalization_input_schema_invalid',
        ...parsed.error.issues.map(issue => `finalization_schema:${issue.path.join('.')}:${issue.code}`),
        'signed_release_record_missing',
      ]),
    };
  }

  const value = parsed.data;
  const blockers: string[] = [];
  const initialScore = value.initial_package.quality_snapshot.total_score;
  const finalScore = value.final_package.quality_snapshot.total_score;
  const computedImprovement = round(finalScore - initialScore);
  const trustPolicy = TrustedVerifierPolicySchema.safeParse(externalTrustPolicy);
  const trustedKeys = new Map<string, z.infer<typeof TrustedVerifierPolicySchema>['keys'][number]>();

  if (!trustPolicy.success) {
    blockers.push('trusted_verifier_policy_invalid_or_missing');
  } else {
    for (const key of trustPolicy.data.keys) {
      if (trustedKeys.has(key.key_id)) blockers.push(`trusted_verifier_key_id_duplicate:${key.key_id}`);
      else trustedKeys.set(key.key_id, key);
    }
  }

  if (value.provenance.execution_kind !== 'real_model'
    || value.provenance.generation_mode !== 'external_model'
    || value.provenance.evidence_environment !== 'external'
    || value.provenance.review_mode !== 'external_human_blind_review'
    || ['local', 'fixture', 'simulation'].includes(value.provenance.revision_mode)
    || value.provenance.used_fallback
    || value.provenance.is_fixture
    || value.provenance.is_simulation
    || !value.provenance.provider_receipt_verified) {
    blockers.push('non_real_or_local_evidence_rejected');
  }

  const validation = value.artifact_validation;
  if (!validation.integrity_valid) blockers.push('professional_completion_integrity_not_verified');
  if (!validation.contract_valid) blockers.push('professional_completion_contract_not_verified');
  if (validation.verified_artifact_count < 12) blockers.push('professional_completion_artifact_count_below_12');
  if (validation.blockers.length > 0) blockers.push('professional_completion_validation_has_blockers');
  if (validation.benchmark_id !== value.benchmark_id || validation.run_id !== value.run_id) {
    blockers.push('artifact_validation_identity_drift');
  }

  const initialSnapshotHash = computeProfessionalBenchmarkEvidenceSha256(value.initial_package.quality_snapshot);
  const finalSnapshotHash = computeProfessionalBenchmarkEvidenceSha256(value.final_package.quality_snapshot);
  if (value.initial_package.package_sha256 !== value.initial_package.quality_snapshot.package_sha256
    || validation.initial_package_sha256 !== value.initial_package.package_sha256
    || value.revision_trace.initial_package_sha256 !== value.initial_package.package_sha256) {
    blockers.push('initial_package_hash_drift');
  }
  if (value.final_package.package_sha256 !== value.final_package.quality_snapshot.package_sha256
    || validation.final_package_sha256 !== value.final_package.package_sha256
    || value.revision_trace.final_package_sha256 !== value.final_package.package_sha256) {
    blockers.push('final_package_hash_drift');
  }
  if (value.initial_package.quality_snapshot_sha256 !== initialSnapshotHash
    || value.revision_trace.initial_quality_snapshot_sha256 !== initialSnapshotHash) {
    blockers.push('initial_quality_snapshot_hash_drift');
  }
  if (value.final_package.quality_snapshot_sha256 !== finalSnapshotHash
    || value.revision_trace.final_quality_snapshot_sha256 !== finalSnapshotHash
    || validation.final_quality_report_sha256 !== finalSnapshotHash) {
    blockers.push('final_quality_report_hash_drift');
  }

  if (!value.revision_trace.quality_improvement_verified) blockers.push('quality_improvement_not_verified');
  if (computedImprovement <= 0) blockers.push('quality_not_improved');
  if (Math.abs(value.revision_trace.reported_score_improvement - computedImprovement) > 0.001) {
    blockers.push('quality_improvement_value_mismatch');
  }
  if (value.revision_trace.unresolved_issue_ids.length > 0) blockers.push('revision_unresolved_issues_present');
  if (finalScore < 85) blockers.push('final_quality_score_below_85');
  if (Object.values(value.final_package.quality_snapshot.dimension_scores).some(score => score < 75)) {
    blockers.push('final_core_dimension_below_75');
  }
  if (value.final_package.quality_snapshot.hard_gate_failures.length > 0) {
    blockers.push('final_quality_hard_gate_failure_present');
  }

  const review = value.blind_review_decision;
  if (review.benchmark_id !== value.benchmark_id || review.run_id !== value.run_id || review.video_type !== value.video_type) {
    blockers.push('blind_review_identity_drift');
  }
  const expectedWeightContract = professionalBlindReviewWeightContract(value.video_type);
  if (review.weight_contract_sha256 !== expectedWeightContract.sha256) blockers.push('blind_review_weight_contract_digest_mismatch');
  if (QUALITY_DIMENSIONS.some(dimension => review.applied_dimension_weights[dimension] !== expectedWeightContract.dimension_weights[dimension])) {
    blockers.push('blind_review_dimension_weights_mismatch');
  }
  if (review.score_threshold_passed !== review.review_threshold_passed) blockers.push('blind_review_score_threshold_state_mismatch');
  if (review.reviewer_count < 3) blockers.push('blind_review_reviewer_count_below_three');
  if (new Set(review.covered_roles).size !== REVIEW_ROLES.length
    || REVIEW_ROLES.some(role => !review.covered_roles.includes(role))) {
    blockers.push('blind_review_role_coverage_incomplete');
  }
  if (review.average_score < 85) blockers.push('blind_review_average_below_85');
  if (Object.values(review.dimension_average_scores).some(score => score < 75)) {
    blockers.push('blind_review_core_dimension_below_75');
  }
  const recomputedBaselineDifference = round(review.average_score - review.baseline_average_score);
  if (Math.abs(review.baseline_score_difference - recomputedBaselineDifference) > 0.001) {
    blockers.push('blind_review_baseline_difference_mismatch');
  }
  if (review.baseline_score_difference < -3) blockers.push('blind_review_baseline_gap_below_minus_three');
  if (review.production_advance_vote_count < Math.ceil(review.reviewer_count * 2 / 3)) {
    blockers.push('blind_review_votes_below_two_thirds');
  }
  if (review.hard_gate_failure_count > 0 || review.blockers.length > 0) {
    blockers.push('blind_review_hard_gate_or_blocker_present');
  }
  if (!review.review_threshold_passed) blockers.push('blind_review_threshold_not_passed');

  const human = value.human_attestation_context;
  if (human.benchmark_id !== value.benchmark_id || human.run_id !== value.run_id
    || human.video_type !== value.video_type) {
    blockers.push('human_attestation_identity_drift');
  }
  if (human.verification_status !== 'verified_external'
    || human.evidence_environment !== 'external'
    || human.is_fixture
    || human.is_simulation) {
    blockers.push('human_attestation_not_verified_external');
  }
  if (human.randomization_manifest.evidence_environment !== 'external'
    || human.randomization_manifest.is_fixture
    || human.randomization_manifest.is_simulation) {
    blockers.push('randomization_manifest_not_external_real_evidence');
  }
  if (!human.randomization_manifest.origin_concealed) blockers.push('blind_origin_not_concealed');

  const baseline = human.baseline_binding;
  const rightsEvidence = baseline.rights_evidence;
  if (rightsEvidence.rights === 'unverified' || !rightsEvidence.authorized_for_comparative_review) {
    blockers.push('baseline_rights_not_verified');
  }
  if (rightsEvidence.baseline_id !== baseline.baseline_id
    || rightsEvidence.baseline_artifact_sha256 !== baseline.artifact_sha256) {
    blockers.push('rights_evidence_baseline_binding_drift');
  }

  const authorizedReviewers = new Map(human.reviewer_registry.reviewers
    .filter(reviewer => reviewer.status === 'authorized')
    .map(reviewer => [reviewer.reviewer_id, reviewer]));
  if (new Set(human.reviewer_registry.reviewers.map(reviewer => reviewer.reviewer_id)).size
    !== human.reviewer_registry.reviewers.length) {
    blockers.push('reviewer_registry_duplicate_identity');
  }
  if (new Set(human.review_attestations.map(attestation => attestation.reviewer_id)).size
    !== human.review_attestations.length
    || new Set(human.review_attestations.map(attestation => attestation.review_id)).size
    !== human.review_attestations.length) {
    blockers.push('review_attestation_identity_not_unique');
  }
  if (human.review_attestations.length !== review.reviewer_count) {
    blockers.push('review_attestation_count_mismatch');
  }
  for (const attestation of human.review_attestations) {
    const authorization = authorizedReviewers.get(attestation.reviewer_id);
    if (!authorization
      || authorization.role !== attestation.role
      || authorization.authorization_record_sha256 !== attestation.reviewer_authorization_record_sha256
      || authorization.signing_key_id !== attestation.record_signature.key_id) {
      blockers.push(`reviewer_not_authorized:${attestation.reviewer_id}`);
    }
    if (!attestation.blind_review_declared
      || !attestation.independent_review_declared
      || attestation.conflict_of_interest_declared) {
      blockers.push(`review_attestation_declaration_invalid:${attestation.review_id}`);
    }
  }
  const attestedRoles = new Set(human.review_attestations.map(attestation => attestation.role));
  if (REVIEW_ROLES.some(role => !attestedRoles.has(role))) blockers.push('review_attestation_role_coverage_incomplete');

  const randomization = human.randomization_manifest;
  const decisionBinding = human.review_decision_binding;
  if (randomization.baseline_id !== baseline.baseline_id
    || randomization.baseline_artifact_sha256 !== baseline.artifact_sha256
    || decisionBinding.baseline_artifact_sha256 !== baseline.artifact_sha256
    || human.review_attestations.some(item => item.baseline_artifact_sha256 !== baseline.artifact_sha256)) {
    blockers.push('baseline_hash_or_identity_drift');
  }
  if (randomization.final_package_sha256 !== value.final_package.package_sha256
    || decisionBinding.final_package_sha256 !== value.final_package.package_sha256
    || human.review_attestations.some(item => item.final_package_sha256 !== value.final_package.package_sha256)) {
    blockers.push('human_review_final_package_hash_drift');
  }
  if (decisionBinding.randomization_manifest_sha256 !== randomization.manifest_sha256) {
    blockers.push('randomization_manifest_hash_drift');
  }
  if (human.review_attestations.some(item =>
    item.blind_review_bundle_sha256 !== decisionBinding.blind_review_bundle_sha256)) {
    blockers.push('blind_review_bundle_hash_drift');
  }
  const computedDecisionHash = computeProfessionalBenchmarkEvidenceSha256(review);
  if (!decisionBinding.threshold_verification_completed
    || decisionBinding.blind_review_decision_sha256 !== computedDecisionHash) {
    blockers.push('review_threshold_self_assertion_unbound');
  }

  if (trustPolicy.success && blockers.every(blocker => !blocker.startsWith('trusted_verifier_key_id_duplicate:'))) {
    verifySignedRecord('artifact_validation', validation as unknown as Record<string, unknown>, trustedKeys, blockers);
    verifySignedRecord('reviewer_registry', human.reviewer_registry as unknown as Record<string, unknown>, trustedKeys, blockers);
    verifySignedRecord('randomization_manifest', randomization as unknown as Record<string, unknown>, trustedKeys, blockers);
    verifySignedRecord('rights_evidence', rightsEvidence as unknown as Record<string, unknown>, trustedKeys, blockers);
    for (const attestation of human.review_attestations) {
      verifySignedRecord('review_attestation', attestation as unknown as Record<string, unknown>, trustedKeys, blockers);
    }
    verifySignedRecord('human_verification_record', human as unknown as Record<string, unknown>, trustedKeys, blockers);
  }

  const eligibilityBlockers = unique(blockers);
  return {
    schema_version: 'professional-benchmark-finalization-decision/v2',
    benchmark_id: value.benchmark_id,
    run_id: value.run_id,
    video_type: value.video_type,
    eligible_for_signed_release: eligibilityBlockers.length === 0,
    professional_passed: false,
    initial_quality_score: initialScore,
    final_quality_score: finalScore,
    verified_quality_improvement: computedImprovement,
    blockers: [...eligibilityBlockers, 'signed_release_record_missing'],
  };
}
