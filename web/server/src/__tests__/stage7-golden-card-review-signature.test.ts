import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Stage7GoldenCardReviewerRole } from '@shared/types.js';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage7GoldenCardsRouter } from '../routes/stage7-golden-cards.js';
import {
  getStage7GoldenCardReviewWorkspace,
  inspectStage7GoldenCardReview,
} from '../services/stage7-golden-card-review-service.js';
import {
  createStage7GoldenCardReviewSignaturePayload,
  evaluateStage7GoldenCardReviewSignature,
  getStage7GoldenCardReviewSignatureWorkspace,
} from '../services/stage7-golden-card-review-signature-service.js';
import { stage7GoldenCardCanonicalSha256 } from '../services/stage7-golden-card-review-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T14:00:00.000Z';

async function validReview() {
  const workspace = await getStage7GoldenCardReviewWorkspace({ repoRoot, now: fixedNow });
  const value = structuredClone(workspace.template) as Record<string, any>;
  value.review_id = 'external-golden-review-001';
  value.overall_decision = 'approve';
  const roles = workspace.template_inspection.expected_binding.required_roles;
  value.reviews = roles.map((role, index) => ({
    reviewer_id: `external-reviewer-${index + 1}`,
    display_name: `Reviewer ${index + 1}`,
    organization: 'External Review Organization',
    identity_verified: true,
    authorization_reference: `authorization://golden-card/${role}`,
    role,
    decision: 'approve',
    reviewed_at: '2026-07-12T13:30:00.000Z',
    evidence_refs: [`evidence://golden-card/${role}/001`],
    review_note: `${role} independently approved the frozen review material.`,
  }));
  const rawJson = `${JSON.stringify(value, null, 2)}\n`;
  const inspection = await inspectStage7GoldenCardReview({ repoRoot, request: { raw_json: rawJson, expected_card_id: workspace.selected_card_id }, now: fixedNow });
  expect(inspection.approval_preflight_ready).toBe(true);
  return { rawJson, inspection, roles };
}

type Ed25519KeyPair = { publicKey: KeyObject; privateKey: KeyObject };

function trustPolicy(roles: Stage7GoldenCardReviewerRole[], keys: Ed25519KeyPair[], revokedRole?: Stage7GoldenCardReviewerRole) {
  return {
    schema_version: 'story-agent-stage7-golden-card-review-trust-policy/v1',
    policy_id: 'external-stage7-golden-card-review-policy-001',
    status: 'active',
    trust_source: 'external_configuration',
    evidence_environment: 'external',
    established_at: '2026-07-12T12:00:00.000Z',
    signers: roles.map((role, index) => ({
      signer_id: `signer-${role}`,
      role,
      key_id: `key-${role}`,
      algorithm: 'Ed25519',
      public_key_spki_pem: keys[index].publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      status: role === revokedRole ? 'revoked' : 'trusted',
      authorization_reference: `authorization://signer/${role}`,
      authorized_at: '2026-07-12T12:00:00.000Z',
    })),
    human_approval_can_be_granted: false,
    golden_card_promotion_can_be_granted: false,
    professional_pass_can_be_granted: false,
  };
}

async function signedFixture() {
  const review = await validReview();
  const keys: Ed25519KeyPair[] = review.roles.map(() => generateKeyPairSync('ed25519'));
  const attestation = {
    schema_version: 'story-agent-stage7-golden-card-review-signature-attestation/v1',
    attestation_id: 'golden-review-signature-attestation-001',
    card_id: review.inspection.expected_binding.card_id,
    video_type: review.inspection.expected_binding.video_type,
    source_card_file_sha256: review.inspection.source_file_sha256,
    card_payload_sha256: review.inspection.canonical_card_payload_sha256,
    review_payload_sha256: stage7GoldenCardCanonicalSha256(JSON.parse(review.rawJson) as unknown),
    decision: 'approve_golden_card_review',
    reviewed_at: '2026-07-12T13:45:00.000Z',
    review_note: 'All required external reviewers approved the frozen review payload.',
    signatures: [] as Array<Record<string, unknown>>,
    human_approved: false,
    golden_card_promoted: false,
    professional_passed: false,
  };
  const payload = createStage7GoldenCardReviewSignaturePayload(attestation);
  const digest = createHash('sha256').update(payload).digest('hex');
  attestation.signatures = review.roles.map((role, index) => ({
    schema_version: 'story-agent-stage7-golden-card-review-ed25519-signature/v1',
    signer_id: `signer-${role}`,
    role,
    key_id: `key-${role}`,
    algorithm: 'Ed25519',
    signed_payload_sha256: digest,
    signature_base64: sign(null, payload, keys[index].privateKey).toString('base64'),
    signed_at: '2026-07-12T13:50:00.000Z',
  }));
  return { ...review, keys, attestation };
}

describe('Stage 7 golden-card review signature inspector', () => {
  it('keeps the repository trust template blocked with zero signers and zero approval credit', async () => {
    const workspace = await getStage7GoldenCardReviewSignatureWorkspace({ repoRoot, now: fixedNow });
    expect(workspace.schema_version).toBe('story-agent-stage7-golden-card-review-signature-workspace/v1');
    expect(workspace.cards).toHaveLength(30);
    expect(workspace.trust_policy).toMatchObject({ status: 'preparation_template', trusted_signer_count: 0 });
    expect(workspace.template_inspection).toMatchObject({
      signature_verification_ready: false,
      signature_created: false,
      signed_review_persisted: false,
      human_approval_granted: false,
      golden_card_promoted: false,
      professional_passed: false,
    });
  });

  it('verifies all externally trusted risk-role signatures without granting approval', async () => {
    const fixture = await signedFixture();
    const result = evaluateStage7GoldenCardReviewSignature({
      signatureRawJson: `${JSON.stringify(fixture.attestation, null, 2)}\n`,
      reviewRawJson: fixture.rawJson,
      reviewInspection: fixture.inspection,
      trustPolicy: trustPolicy(fixture.roles, fixture.keys),
      now: fixedNow,
    });
    expect(result.signature_verification_ready).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(result.signature_summary).toMatchObject({ signature_count: 3, required_role_count: 3, trusted_signer_count: 3, payload_digest_match_count: 3, cryptographically_verified_signature_count: 3 });
    expect(result).toMatchObject({ signature_created: false, signed_review_persisted: false, human_approval_granted: false, golden_card_promoted: false, professional_passed: false });
  });

  it('rejects attestation tampering after signatures are created', async () => {
    const fixture = await signedFixture();
    fixture.attestation.review_note = 'tampered after signing';
    const result = evaluateStage7GoldenCardReviewSignature({ signatureRawJson: JSON.stringify(fixture.attestation), reviewRawJson: fixture.rawJson, reviewInspection: fixture.inspection, trustPolicy: trustPolicy(fixture.roles, fixture.keys), now: fixedNow });
    expect(result.signature_verification_ready).toBe(false);
    expect(result.checks.signed_payload_digests_valid).toBe(false);
    expect(result.checks.cryptographic_signatures_valid).toBe(false);
  });

  it('rejects a cryptographically valid signature from a revoked required-role signer', async () => {
    const fixture = await signedFixture();
    const revokedRole = fixture.roles[1];
    const result = evaluateStage7GoldenCardReviewSignature({ signatureRawJson: JSON.stringify(fixture.attestation), reviewRawJson: fixture.rawJson, reviewInspection: fixture.inspection, trustPolicy: trustPolicy(fixture.roles, fixture.keys, revokedRole), now: fixedNow });
    expect(result.signature_verification_ready).toBe(false);
    expect(result.checks.trusted_signer_bindings_valid).toBe(false);
    expect(result.checks.cryptographic_signatures_valid).toBe(false);
    expect(result.signature_summary.cryptographically_verified_signature_count).toBe(2);
  });

  it('exposes only workspace and validation with no sign, approve, persist, promote, or writeback endpoint', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage7-golden-cards', createStage7GoldenCardsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);
    const workspace = await request.get('/api/stage7-golden-cards/review-signature');
    expect(workspace.status).toBe(200);
    expect(workspace.body.data.trust_policy.trusted_signer_count).toBe(0);
    const validation = await request.post('/api/stage7-golden-cards/review-signature/validate').send({ expected_card_id: workspace.body.data.selected_card_id, review_raw_json: workspace.body.data.review_template_raw_json, signature_raw_json: workspace.body.data.signature_template_raw_json });
    expect(validation.status).toBe(200);
    expect(validation.body.data).toMatchObject({ signature_verification_ready: false, human_approval_granted: false, signed_review_persisted: false });
    for (const action of ['sign', 'approve', 'persist', 'promote', 'writeback']) expect((await request.post(`/api/stage7-golden-cards/review-signature/${action}`).send({})).status).toBe(404);
  });
});
