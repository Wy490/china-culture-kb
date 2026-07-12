import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ProfessionalQualityDimensionId, Stage8BlindReviewRole } from '@shared/types.js';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage8BlindReviewRouter } from '../routes/stage8-blind-review.js';
import { evaluateProfessionalBlindReviewBundle, type ProfessionalBlindReviewBundle } from '../services/professional-benchmark-review-service.js';
import {
  createStage8BlindReviewSignaturePayload,
  evaluateStage8BlindReviewSignature,
  getStage8BlindReviewSignatureWorkspace,
} from '../services/stage8-blind-review-signature-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T17:30:00.000Z';
const roles: Stage8BlindReviewRole[] = ['screenwriter_or_script_editor', 'genre_or_director_reviewer', 'fact_or_culture_reviewer'];
const dimensions: ProfessionalQualityDimensionId[] = [
  'creative_brief_and_audience_promise', 'premise_and_theme_unity', 'structure_causality_and_pacing',
  'character_agency_and_relationship_change', 'scene_function_visible_action_and_blocking', 'dialogue_narration_and_subtext',
  'emotional_curve_and_aftertaste', 'cultural_fact_and_adaptation_boundary', 'production_executability', 'originality_and_distinctiveness',
];
type KeyPair = { publicKey: KeyObject; privateKey: KeyObject };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
}
function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex'); }

function trustPolicy(keys: KeyPair[], revokedRole?: Stage8BlindReviewRole) {
  return {
    schema_version: 'story-agent-stage8-blind-review-trust-policy/v1', policy_id: 'external-stage8-policy-001', status: 'active',
    trust_source: 'external_configuration', evidence_environment: 'external', established_at: '2026-07-12T15:00:00.000Z',
    reviewers: roles.map((role, index) => ({ reviewer_id: `reviewer-${index + 1}`, role, key_id: `key-${index + 1}`, algorithm: 'Ed25519',
      public_key_spki_pem: keys[index].publicKey.export({ type: 'spki', format: 'pem' }).toString(), status: role === revokedRole ? 'revoked' : 'trusted',
      authorization_reference: `authorization://stage8/${role}`, authorized_at: '2026-07-12T15:00:00.000Z' })),
    signature_verification_can_grant_human_blind_review_pass: false, professional_pass_can_be_granted: false,
  };
}

async function signedFixture() {
  const workspace = await getStage8BlindReviewSignatureWorkspace({ repoRoot, now: fixedNow });
  const selected = workspace.projects[0];
  const bundle: ProfessionalBlindReviewBundle = {
    schema_version: 'professional-benchmark-blind-review/v2', benchmark_id: selected.benchmark_id, video_type: selected.video_type,
    run_id: 'external-run-001', final_package_sha256: 'a'.repeat(64), candidate_label: 'candidate-X7', randomization_batch_id: 'random-batch-001',
    evaluator_did_not_know_origin: true, baseline: { baseline_id: 'licensed-baseline-001', artifact_sha256: 'b'.repeat(64), rights: 'licensed', average_score: 85 },
    reviews: roles.map((role, index) => ({ review_id: `review-${index + 1}`, reviewer_id: `reviewer-${index + 1}`, role, candidate_label: 'candidate-X7',
      blind_review_declared: true, independent_review_declared: true, conflict_of_interest_declared: false,
      scores: dimensions.map(dimension_id => ({ dimension_id, score: 88, note: `${dimension_id} external review note` })), hard_gate_failures: [],
      fact_or_culture_issues: [], production_advance_vote: true, submitted_at: `2026-07-12T16:0${index}:00.000Z` })),
  };
  const decision = evaluateProfessionalBlindReviewBundle(bundle);
  expect(decision.score_threshold_passed).toBe(true);
  const keys = roles.map(() => generateKeyPairSync('ed25519'));
  const attestation = {
    schema_version: 'story-agent-stage8-blind-review-signature-attestation/v1', attestation_id: 'stage8-attestation-001',
    benchmark_id: bundle.benchmark_id, video_type: bundle.video_type, run_id: bundle.run_id, review_bundle_sha256: digest(bundle),
    decision_sha256: digest(decision), weight_contract_sha256: decision.weight_contract_sha256, score_threshold_passed: true,
    review_completed_at: '2026-07-12T16:10:00.000Z', signatures: [] as Array<Record<string, unknown>>,
    human_blind_review_passed: false, professional_passed: false,
  };
  const payload = createStage8BlindReviewSignaturePayload(attestation);
  const payloadDigest = createHash('sha256').update(payload).digest('hex');
  attestation.signatures = roles.map((role, index) => ({ schema_version: 'story-agent-stage8-blind-review-ed25519-signature/v1',
    reviewer_id: `reviewer-${index + 1}`, role, key_id: `key-${index + 1}`, algorithm: 'Ed25519', signed_payload_sha256: payloadDigest,
    signature_base64: sign(null, payload, keys[index].privateKey).toString('base64'), signed_at: '2026-07-12T16:15:00.000Z' }));
  return { workspace, selected, bundle, decision, attestation, keys };
}

describe('Stage 8 blind-review signature inspector', () => {
  it('keeps the repository trust template blocked with zero signatures and zero credit', async () => {
    const workspace = await getStage8BlindReviewSignatureWorkspace({ repoRoot, now: fixedNow });
    expect(workspace.summary).toEqual({ project_count: 75, score_threshold_ready_project_count: 0, signature_verification_ready_project_count: 0,
      trusted_reviewer_count: 0, real_signature_count: 0, human_blind_review_pass_project_count: 0, professional_pass_count: 0 });
    expect(workspace.trust_policy).toMatchObject({ status: 'preparation_template', trusted_reviewer_count: 0 });
    expect(workspace.template_inspection).toMatchObject({ signature_verification_ready: false, signature_created: false,
      signed_review_persisted: false, human_blind_review_passed: false, signed_release_created: false, professional_passed: false });
  });

  it('verifies three trusted Ed25519 signatures but grants no human or professional credit', async () => {
    const fixture = await signedFixture();
    const result = evaluateStage8BlindReviewSignature({ reviewBundleRawJson: JSON.stringify(fixture.bundle), signatureRawJson: JSON.stringify(fixture.attestation),
      expected: { benchmark_id: fixture.selected.benchmark_id, video_type: fixture.selected.video_type }, trustPolicy: trustPolicy(fixture.keys), now: fixedNow });
    expect(result.signature_verification_ready).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(result.signature_summary).toMatchObject({ signature_count: 3, trusted_reviewer_count: 3, payload_digest_match_count: 3,
      cryptographically_verified_signature_count: 3, real_signature_credit_count: 0, human_blind_review_pass_credit_count: 0, professional_pass_count: 0 });
    expect(result).toMatchObject({ signature_created: false, signed_review_persisted: false, finalization_started: false,
      human_blind_review_passed: false, signed_release_created: false, professional_passed: false });
  });

  it('rejects attestation tampering after signatures', async () => {
    const fixture = await signedFixture();
    fixture.attestation.decision_sha256 = 'f'.repeat(64);
    const result = evaluateStage8BlindReviewSignature({ reviewBundleRawJson: JSON.stringify(fixture.bundle), signatureRawJson: JSON.stringify(fixture.attestation),
      expected: { benchmark_id: fixture.selected.benchmark_id, video_type: fixture.selected.video_type }, trustPolicy: trustPolicy(fixture.keys), now: fixedNow });
    expect(result.signature_verification_ready).toBe(false);
    expect(result.checks.decision_digest_binding_valid).toBe(false);
    expect(result.checks.signed_payload_digests_valid).toBe(false);
    expect(result.checks.cryptographic_signatures_valid).toBe(false);
  });

  it('rejects a valid signature from a revoked required-role reviewer', async () => {
    const fixture = await signedFixture();
    const result = evaluateStage8BlindReviewSignature({ reviewBundleRawJson: JSON.stringify(fixture.bundle), signatureRawJson: JSON.stringify(fixture.attestation),
      expected: { benchmark_id: fixture.selected.benchmark_id, video_type: fixture.selected.video_type }, trustPolicy: trustPolicy(fixture.keys, roles[1]), now: fixedNow });
    expect(result.signature_verification_ready).toBe(false);
    expect(result.checks.trusted_reviewer_bindings_valid).toBe(false);
    expect(result.signature_summary.cryptographically_verified_signature_count).toBe(2);
  });

  it('rejects future signature timelines and reviewer authorization that starts after signing', async () => {
    const future = await signedFixture();
    future.attestation.review_completed_at = '2026-07-13T16:10:00.000Z';
    const futurePayload = createStage8BlindReviewSignaturePayload(future.attestation);
    const futureDigest = createHash('sha256').update(futurePayload).digest('hex');
    future.attestation.signatures = roles.map((role, index) => ({ schema_version: 'story-agent-stage8-blind-review-ed25519-signature/v1',
      reviewer_id: `reviewer-${index + 1}`, role, key_id: `key-${index + 1}`, algorithm: 'Ed25519', signed_payload_sha256: futureDigest,
      signature_base64: sign(null, futurePayload, future.keys[index].privateKey).toString('base64'), signed_at: '2026-07-13T16:15:00.000Z' }));
    const futureResult = evaluateStage8BlindReviewSignature({ reviewBundleRawJson: JSON.stringify(future.bundle), signatureRawJson: JSON.stringify(future.attestation),
      expected: { benchmark_id: future.selected.benchmark_id, video_type: future.selected.video_type }, trustPolicy: trustPolicy(future.keys), now: fixedNow });
    expect(futureResult.checks.cryptographic_signatures_valid).toBe(true);
    expect(futureResult.checks.signature_timestamps_valid).toBe(false);

    const lateAuthorization = await signedFixture();
    const latePolicy = trustPolicy(lateAuthorization.keys);
    latePolicy.reviewers[0].authorized_at = '2026-07-12T17:00:00.000Z';
    const lateResult = evaluateStage8BlindReviewSignature({ reviewBundleRawJson: JSON.stringify(lateAuthorization.bundle), signatureRawJson: JSON.stringify(lateAuthorization.attestation),
      expected: { benchmark_id: lateAuthorization.selected.benchmark_id, video_type: lateAuthorization.selected.video_type }, trustPolicy: latePolicy, now: fixedNow });
    expect(lateResult.checks.cryptographic_signatures_valid).toBe(true);
    expect(lateResult.checks.signature_timestamps_valid).toBe(false);
  });

  it('exposes only workspace and memory validation with no sign, credit, persist, finalization, or release endpoint', async () => {
    const app = express(); app.use(createJsonBodyParser()); app.use('/api/stage8-blind-review', createStage8BlindReviewRouter(repoRoot)); app.use(errorHandler);
    const request = supertest(app);
    const workspace = await request.get('/api/stage8-blind-review/signature');
    expect(workspace.status).toBe(200);
    expect(workspace.body.data.summary).toMatchObject({ project_count: 75, trusted_reviewer_count: 0, human_blind_review_pass_project_count: 0 });
    const validation = await request.post('/api/stage8-blind-review/signature/validate').send({ expected_benchmark_id: workspace.body.data.selected_benchmark_id,
      review_bundle_raw_json: workspace.body.data.review_bundle_template_raw_json, signature_raw_json: workspace.body.data.signature_template_raw_json });
    expect(validation.status).toBe(200);
    expect(validation.body.data).toMatchObject({ signature_verification_ready: false, signed_review_persisted: false, human_blind_review_passed: false, professional_passed: false });
    for (const action of ['sign', 'credit', 'persist', 'finalize', 'release', 'writeback']) expect((await request.post(`/api/stage8-blind-review/signature/${action}`).send({})).status).toBe(404);
  });
});
