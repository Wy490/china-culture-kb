import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ProfessionalQualityDimensionId } from '@shared/types.js';
import {
  computeProfessionalBenchmarkEvidenceSha256,
  computeProfessionalBenchmarkSignedRecordSha256,
  createProfessionalBenchmarkSignaturePayload,
  evaluateProfessionalBenchmarkFinalization,
  type ProfessionalBenchmarkFinalizationInput,
  type ProfessionalBenchmarkSignatureScope,
  type ProfessionalBenchmarkTrustedVerifierPolicy,
} from '../services/professional-benchmark-finalization-service.js';
import { PROFESSIONAL_BLIND_REVIEW_THRESHOLDS, professionalBlindReviewWeightContract } from '../services/professional-benchmark-review-service.js';

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

const roles = [
  'screenwriter_or_script_editor',
  'genre_or_director_reviewer',
  'fact_or_culture_reviewer',
] as const;

const allSignatureScopes: ProfessionalBenchmarkSignatureScope[] = [
  'artifact_validation',
  'reviewer_registry',
  'randomization_manifest',
  'review_attestation',
  'rights_evidence',
  'human_verification_record',
];

const digestFields: Record<ProfessionalBenchmarkSignatureScope, string> = {
  artifact_validation: 'validation_record_sha256',
  reviewer_registry: 'registry_sha256',
  randomization_manifest: 'manifest_sha256',
  review_attestation: 'attestation_record_sha256',
  rights_evidence: 'evidence_record_sha256',
  human_verification_record: 'verification_record_sha256',
};

const trustedKeyPair = generateKeyPairSync('ed25519');
const untrustedKeyPair = generateKeyPairSync('ed25519');
const trustedKeyId = 'external-professional-review-root-001';

function scores(score: number): Record<ProfessionalQualityDimensionId, number> {
  return Object.fromEntries(dimensions.map(dimension => [dimension, score])) as Record<
    ProfessionalQualityDimensionId,
    number
  >;
}

function placeholderSignature(keyId = trustedKeyId) {
  return {
    schema_version: 'professional-benchmark-ed25519-signature/v1' as const,
    algorithm: 'Ed25519' as const,
    key_id: keyId,
    signed_payload_sha256: '0'.repeat(64),
    signature_base64: Buffer.alloc(64).toString('base64'),
  };
}

function trustPolicy(): ProfessionalBenchmarkTrustedVerifierPolicy {
  return {
    schema_version: 'professional-benchmark-trusted-verifier-policy/v1',
    policy_id: 'externally-configured-professional-review-policy-001',
    trust_source: 'external_configuration',
    evidence_environment: 'external',
    established_at: '2026-07-10T00:00:00.000Z',
    keys: [{
      key_id: trustedKeyId,
      algorithm: 'Ed25519',
      public_key_spki_pem: trustedKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      status: 'trusted',
      allowed_scopes: [...allSignatureScopes],
    }],
  };
}

function sealRecord(
  scope: ProfessionalBenchmarkSignatureScope,
  record: Record<string, unknown>,
  privateKey: KeyObject = trustedKeyPair.privateKey,
  keyId = trustedKeyId,
): void {
  record[digestFields[scope]] = computeProfessionalBenchmarkSignedRecordSha256(scope, record);
  const payload = createProfessionalBenchmarkSignaturePayload(scope, record);
  record.record_signature = {
    schema_version: 'professional-benchmark-ed25519-signature/v1',
    algorithm: 'Ed25519',
    key_id: keyId,
    signed_payload_sha256: createHash('sha256').update(payload).digest('hex'),
    signature_base64: sign(null, payload, privateKey).toString('base64'),
  };
}

function sealEvidenceChain(input: ProfessionalBenchmarkFinalizationInput): void {
  sealRecord('artifact_validation', input.artifact_validation as unknown as Record<string, unknown>);
  sealRecord(
    'reviewer_registry',
    input.human_attestation_context.reviewer_registry as unknown as Record<string, unknown>,
  );
  sealRecord(
    'randomization_manifest',
    input.human_attestation_context.randomization_manifest as unknown as Record<string, unknown>,
  );
  input.human_attestation_context.review_decision_binding.randomization_manifest_sha256 =
    input.human_attestation_context.randomization_manifest.manifest_sha256;
  sealRecord(
    'rights_evidence',
    input.human_attestation_context.baseline_binding.rights_evidence as unknown as Record<string, unknown>,
  );
  for (const attestation of input.human_attestation_context.review_attestations) {
    sealRecord('review_attestation', attestation as unknown as Record<string, unknown>);
  }
  sealRecord(
    'human_verification_record',
    input.human_attestation_context as unknown as Record<string, unknown>,
  );
}

function validInput(): ProfessionalBenchmarkFinalizationInput {
  const initialQuality = {
    schema_version: 'professional-benchmark-quality-snapshot/v1' as const,
    package_sha256: '1'.repeat(64),
    total_score: 80,
    dimension_scores: scores(80),
    hard_gate_failures: ['人物关系转折仍不充分'],
    evaluator_id: 'professional-quality-service',
    evaluator_version: 'professional-text-quality-report/v1',
    measured_at: '2026-07-11T01:00:00.000Z',
  };
  const finalQuality = {
    schema_version: 'professional-benchmark-quality-snapshot/v1' as const,
    package_sha256: '2'.repeat(64),
    total_score: 90,
    dimension_scores: scores(90),
    hard_gate_failures: [],
    evaluator_id: 'professional-quality-service',
    evaluator_version: 'professional-text-quality-report/v1',
    measured_at: '2026-07-11T02:00:00.000Z',
  };
  const weightContract = professionalBlindReviewWeightContract('character_story');
  const reviewDecision = {
    schema_version: 'professional-benchmark-blind-review-decision/v2' as const,
    benchmark_id: 'character-benchmark-001',
    video_type: 'character_story' as const,
    run_id: 'run-001',
    weight_contract_schema_version: 'professional-blind-review-weight-contract/v1' as const,
    weight_contract_sha256: weightContract.sha256,
    applied_dimension_weights: weightContract.dimension_weights,
    thresholds: PROFESSIONAL_BLIND_REVIEW_THRESHOLDS,
    reviewer_count: 3,
    covered_roles: [...roles],
    average_score: 87,
    dimension_average_scores: scores(87),
    baseline_average_score: 88,
    baseline_score_difference: -1,
    production_advance_vote_count: 3,
    hard_gate_failure_count: 0,
    score_threshold_passed: true,
    review_threshold_passed: true,
    counts_as_human_blind_review_pass: false as const,
    professional_passed: false as const,
    blockers: [],
  };
  const blindBundleHash = 'b'.repeat(64);
  const baselineHash = 'a'.repeat(64);
  const reviewerRegistry = roles.map((role, index) => ({
    reviewer_id: `reviewer-${index + 1}`,
    role,
    status: 'authorized' as const,
    signing_key_id: trustedKeyId,
    authorization_record_sha256: String(index + 3).repeat(64),
    authorized_at: '2026-07-10T08:00:00.000Z',
  }));

  const input: ProfessionalBenchmarkFinalizationInput = {
    schema_version: 'professional-benchmark-finalization-input/v2',
    benchmark_id: 'character-benchmark-001',
    run_id: 'run-001',
    video_type: 'character_story',
    provenance: {
      schema_version: 'professional-benchmark-finalization-provenance/v1',
      execution_kind: 'real_model',
      generation_mode: 'external_model',
      revision_mode: 'external_model_and_verified_human',
      review_mode: 'external_human_blind_review',
      evidence_environment: 'external',
      used_fallback: false,
      is_fixture: false,
      is_simulation: false,
      provider_receipt_verified: true,
    },
    artifact_validation: {
      schema_version: 'professional-benchmark-artifact-validation-context/v2',
      benchmark_id: 'character-benchmark-001',
      run_id: 'run-001',
      validation_profile: 'professional_completion',
      integrity_valid: true,
      contract_valid: true,
      professional_passed: false,
      verified_artifact_count: 12,
      blockers: [],
      artifact_manifest_sha256: '8'.repeat(64),
      initial_package_sha256: initialQuality.package_sha256,
      final_package_sha256: finalQuality.package_sha256,
      final_quality_report_sha256: computeProfessionalBenchmarkEvidenceSha256(finalQuality),
      validator_id: 'professional-benchmark-artifact-service/v2',
      validation_record_sha256: '0'.repeat(64),
      verified_at: '2026-07-11T03:00:00.000Z',
      record_signature: placeholderSignature(),
    },
    initial_package: {
      package_sha256: initialQuality.package_sha256,
      quality_snapshot_sha256: computeProfessionalBenchmarkEvidenceSha256(initialQuality),
      quality_snapshot: initialQuality,
    },
    final_package: {
      package_sha256: finalQuality.package_sha256,
      quality_snapshot_sha256: computeProfessionalBenchmarkEvidenceSha256(finalQuality),
      quality_snapshot: finalQuality,
    },
    revision_trace: {
      schema_version: 'professional-benchmark-revision-trace/v1',
      initial_package_sha256: initialQuality.package_sha256,
      final_package_sha256: finalQuality.package_sha256,
      revision_plan_sha256: '6'.repeat(64),
      revision_output_sha256: '5'.repeat(64),
      initial_quality_snapshot_sha256: computeProfessionalBenchmarkEvidenceSha256(initialQuality),
      final_quality_snapshot_sha256: computeProfessionalBenchmarkEvidenceSha256(finalQuality),
      applied_action_ids: ['repair-character-cost', 'repair-relationship-turn'],
      unresolved_issue_ids: [],
      reported_score_improvement: 10,
      quality_improvement_verified: true,
      trace_record_sha256: '4'.repeat(64),
    },
    blind_review_decision: reviewDecision,
    human_attestation_context: {
      schema_version: 'professional-benchmark-human-attestation-context/v2',
      benchmark_id: 'character-benchmark-001',
      run_id: 'run-001',
      video_type: 'character_story',
      verification_status: 'verified_external',
      evidence_environment: 'external',
      is_fixture: false,
      is_simulation: false,
      verified_by_human_id: 'independent-review-coordinator-001',
      verification_record_sha256: '0'.repeat(64),
      verified_at: '2026-07-11T08:00:00.000Z',
      reviewer_registry: {
        schema_version: 'professional-benchmark-authorized-reviewer-registry/v2',
        registry_id: 'reviewer-registry-001',
        registry_sha256: '0'.repeat(64),
        authorization_scope: 'professional_benchmark_blind_review',
        reviewers: reviewerRegistry,
        record_signature: placeholderSignature(),
      },
      randomization_manifest: {
        schema_version: 'professional-benchmark-randomization-manifest/v2',
        manifest_id: 'randomization-001',
        manifest_sha256: '0'.repeat(64),
        randomization_batch_id: 'blind-batch-001',
        candidate_label: 'candidate-Q7',
        final_package_sha256: finalQuality.package_sha256,
        baseline_id: 'licensed-baseline-001',
        baseline_artifact_sha256: baselineHash,
        origin_concealed: true,
        generated_by_role: 'independent_randomization_operator',
        generated_at: '2026-07-11T04:00:00.000Z',
        evidence_environment: 'external',
        is_fixture: false,
        is_simulation: false,
        record_signature: placeholderSignature(),
      },
      baseline_binding: {
        baseline_id: 'licensed-baseline-001',
        artifact_sha256: baselineHash,
        rights_evidence: {
          schema_version: 'professional-benchmark-rights-evidence/v1',
          evidence_id: 'rights-evidence-001',
          evidence_record_sha256: '0'.repeat(64),
          baseline_id: 'licensed-baseline-001',
          baseline_artifact_sha256: baselineHash,
          rights: 'licensed',
          evidence_reference: 'external-license-ledger:license-2026-001',
          authorization_scope: 'professional_benchmark_comparative_review',
          authorized_for_comparative_review: true,
          issued_at: '2026-07-10T09:00:00.000Z',
          record_signature: placeholderSignature(),
        },
      },
      review_attestations: roles.map((role, index) => ({
        schema_version: 'professional-benchmark-review-attestation/v2' as const,
        attestation_id: `attestation-${index + 1}`,
        attestation_record_sha256: '0'.repeat(64),
        review_id: `review-${index + 1}`,
        reviewer_id: `reviewer-${index + 1}`,
        role,
        reviewer_authorization_record_sha256: reviewerRegistry[index].authorization_record_sha256,
        blind_review_bundle_sha256: blindBundleHash,
        final_package_sha256: finalQuality.package_sha256,
        baseline_artifact_sha256: baselineHash,
        blind_review_declared: true,
        independent_review_declared: true,
        conflict_of_interest_declared: false,
        signed_at: `2026-07-11T0${index + 5}:00:00.000Z`,
        record_signature: placeholderSignature(),
      })),
      review_decision_binding: {
        blind_review_bundle_sha256: blindBundleHash,
        blind_review_decision_sha256: computeProfessionalBenchmarkEvidenceSha256(reviewDecision),
        final_package_sha256: finalQuality.package_sha256,
        baseline_artifact_sha256: baselineHash,
        randomization_manifest_sha256: '0'.repeat(64),
        threshold_verification_completed: true,
        bound_at: '2026-07-11T08:00:00.000Z',
      },
      record_signature: placeholderSignature(),
    },
  };

  sealEvidenceChain(input);
  return input;
}

function refreshFinalQuality(input: ProfessionalBenchmarkFinalizationInput): void {
  const snapshotHash = computeProfessionalBenchmarkEvidenceSha256(input.final_package.quality_snapshot);
  input.final_package.quality_snapshot_sha256 = snapshotHash;
  input.revision_trace.final_quality_snapshot_sha256 = snapshotHash;
  input.artifact_validation.final_quality_report_sha256 = snapshotHash;
  input.revision_trace.reported_score_improvement = Math.round(
    (input.final_package.quality_snapshot.total_score - input.initial_package.quality_snapshot.total_score) * 100,
  ) / 100;
  sealRecord('artifact_validation', input.artifact_validation as unknown as Record<string, unknown>);
}

function refreshReviewBinding(input: ProfessionalBenchmarkFinalizationInput): void {
  input.human_attestation_context.review_decision_binding.blind_review_decision_sha256 =
    computeProfessionalBenchmarkEvidenceSha256(input.blind_review_decision);
  sealRecord(
    'human_verification_record',
    input.human_attestation_context as unknown as Record<string, unknown>,
  );
}

describe('professional benchmark finalization candidate gate', () => {
  it('accepts only a fully Ed25519-verified candidate and never awards professional pass', () => {
    expect(evaluateProfessionalBenchmarkFinalization(validInput(), trustPolicy())).toEqual({
      schema_version: 'professional-benchmark-finalization-decision/v2',
      benchmark_id: 'character-benchmark-001',
      run_id: 'run-001',
      video_type: 'character_story',
      eligible_for_signed_release: true,
      professional_passed: false,
      initial_quality_score: 80,
      final_quality_score: 90,
      verified_quality_improvement: 10,
      blockers: ['signed_release_record_missing'],
    });
  });

  it.each([
    ['fixture provenance', (input: ProfessionalBenchmarkFinalizationInput) => { input.provenance.is_fixture = true; }, 'non_real_or_local_evidence_rejected'],
    ['simulation provenance', (input: ProfessionalBenchmarkFinalizationInput) => { input.provenance.execution_kind = 'simulation'; }, 'non_real_or_local_evidence_rejected'],
    ['local provenance', (input: ProfessionalBenchmarkFinalizationInput) => { input.provenance.evidence_environment = 'local'; }, 'non_real_or_local_evidence_rejected'],
    ['fallback provenance', (input: ProfessionalBenchmarkFinalizationInput) => { input.provenance.used_fallback = true; }, 'non_real_or_local_evidence_rejected'],
    ['unverified artifact integrity', (input: ProfessionalBenchmarkFinalizationInput) => { input.artifact_validation.integrity_valid = false; }, 'professional_completion_integrity_not_verified'],
    ['unverified artifact contract', (input: ProfessionalBenchmarkFinalizationInput) => { input.artifact_validation.contract_valid = false; }, 'professional_completion_contract_not_verified'],
    ['too few completion artifacts', (input: ProfessionalBenchmarkFinalizationInput) => { input.artifact_validation.verified_artifact_count = 11; }, 'professional_completion_artifact_count_below_12'],
    ['final quality report hash drift', (input: ProfessionalBenchmarkFinalizationInput) => { input.artifact_validation.final_quality_report_sha256 = 'f'.repeat(64); }, 'final_quality_report_hash_drift'],
    ['final score below 85', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.final_package.quality_snapshot.total_score = 84;
      refreshFinalQuality(input);
    }, 'final_quality_score_below_85'],
    ['final core dimension below 75', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.final_package.quality_snapshot.dimension_scores.dialogue_narration_and_subtext = 74;
      refreshFinalQuality(input);
    }, 'final_core_dimension_below_75'],
    ['final hard gate remains', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.final_package.quality_snapshot.hard_gate_failures.push('事实来源尚未核验');
      refreshFinalQuality(input);
    }, 'final_quality_hard_gate_failure_present'],
    ['blind review baseline gap below minus three', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.blind_review_decision.baseline_average_score = 92;
      input.blind_review_decision.baseline_score_difference = -5;
      refreshReviewBinding(input);
    }, 'blind_review_baseline_gap_below_minus_three'],
    ['blind review votes below two thirds', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.blind_review_decision.production_advance_vote_count = 1;
      refreshReviewBinding(input);
    }, 'blind_review_votes_below_two_thirds'],
    ['blind review hard gate remains', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.blind_review_decision.hard_gate_failure_count = 1;
      refreshReviewBinding(input);
    }, 'blind_review_hard_gate_or_blocker_present'],
    ['blind review weight contract hash drift', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.blind_review_decision.weight_contract_sha256 = 'f'.repeat(64);
      refreshReviewBinding(input);
    }, 'blind_review_weight_contract_digest_mismatch'],
    ['blind review dimension weights drift', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.blind_review_decision.applied_dimension_weights.structure_causality_and_pacing = 99;
      refreshReviewBinding(input);
    }, 'blind_review_dimension_weights_mismatch'],
    ['reviewer is revoked', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.human_attestation_context.reviewer_registry.reviewers[0].status = 'revoked';
    }, 'reviewer_not_authorized:reviewer-1'],
    ['baseline rights are not verified', (input: ProfessionalBenchmarkFinalizationInput) => {
      input.human_attestation_context.baseline_binding.rights_evidence.rights = 'unverified';
    }, 'baseline_rights_not_verified'],
  ] as const)('rejects %s', (_name, mutate, expectedBlocker) => {
    const input = validInput();
    mutate(input);

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.blockers).toContain(expectedBlocker);
    expect(result.blockers).toContain('signed_release_record_missing');
  });

  it('rejects a fake formatted hash because it is recomputed from the signed registry payload', () => {
    const input = validInput();
    input.human_attestation_context.reviewer_registry.registry_sha256 = 'f'.repeat(64);

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.blockers).toContain('signed_record_digest_mismatch:reviewer_registry:reviewer-registry-001');
  });

  it('rejects any attestation field tampering after signature', () => {
    const input = validInput();
    input.human_attestation_context.review_attestations[0].signed_at = '2026-07-11T09:30:00.000Z';

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.blockers).toContain('signed_record_digest_mismatch:review_attestation:attestation-1');
    expect(result.blockers).toContain('signature_verification_failed:review_attestation:attestation-1');
  });

  it('rejects a correctly signed attestation when its signing key is not externally trusted', () => {
    const input = validInput();
    const registry = input.human_attestation_context.reviewer_registry;
    const attestation = input.human_attestation_context.review_attestations[0];
    registry.reviewers[0].signing_key_id = 'untrusted-reviewer-key';
    sealRecord('reviewer_registry', registry as unknown as Record<string, unknown>);
    sealRecord(
      'review_attestation',
      attestation as unknown as Record<string, unknown>,
      untrustedKeyPair.privateKey,
      'untrusted-reviewer-key',
    );
    sealRecord(
      'human_verification_record',
      input.human_attestation_context as unknown as Record<string, unknown>,
    );

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.blockers).toContain('signature_key_not_trusted:review_attestation:attestation-1');
  });

  it('rejects evidence when no external trust policy is injected', () => {
    const result = evaluateProfessionalBenchmarkFinalization(validInput());

    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.blockers).toContain('trusted_verifier_policy_invalid_or_missing');
  });

  it('rejects a legacy v1 unsigned input explicitly and fail-closed', () => {
    const input = validInput() as unknown as Record<string, unknown>;
    input.schema_version = 'professional-benchmark-finalization-input/v1';

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.schema_version).toBe('professional-benchmark-finalization-decision/v2');
    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.blockers).toContain('legacy_unsigned_finalization_input_rejected');
    expect(result.blockers).toContain('signed_release_record_missing');
  });

  it('rejects a revision with no measurable quality improvement', () => {
    const input = validInput();
    input.initial_package.quality_snapshot.total_score = 90;
    input.initial_package.quality_snapshot.hard_gate_failures = [];
    const initialSnapshotHash = computeProfessionalBenchmarkEvidenceSha256(input.initial_package.quality_snapshot);
    input.initial_package.quality_snapshot_sha256 = initialSnapshotHash;
    input.revision_trace.initial_quality_snapshot_sha256 = initialSnapshotHash;
    refreshFinalQuality(input);

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.verified_quality_improvement).toBe(0);
    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.blockers).toContain('quality_not_improved');
  });

  it('rejects package and quality-report hash drift', () => {
    const input = validInput();
    input.revision_trace.final_package_sha256 = 'f'.repeat(64);
    input.final_package.quality_snapshot.total_score = 91;

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'final_package_hash_drift',
      'final_quality_report_hash_drift',
    ]));
  });

  it('rejects a self-asserted review threshold that is not bound to the exact decision', () => {
    const input = validInput();
    input.blind_review_decision.average_score = 88;
    input.blind_review_decision.baseline_score_difference = 0;

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.blockers).toContain('review_threshold_self_assertion_unbound');
  });

  it('rejects strict-schema violations and a caller-supplied pass field', () => {
    const input = validInput() as unknown as Record<string, unknown>;
    input.professional_passed = true;

    const result = evaluateProfessionalBenchmarkFinalization(input, trustPolicy());

    expect(result.eligible_for_signed_release).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.blockers).toContain('finalization_input_schema_invalid');
    expect(result.blockers).toContain('signed_release_record_missing');
  });
});
