import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import {
  createStage6ExitReviewSignaturePayload,
  evaluateStage6ExitReviewAttestation,
  getStage6ExitReviewSignatureInspectorWorkspace,
} from '../services/stage6-exit-review-signature-inspector-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const revisionRoot = path.join(repoRoot, 'web/generated/stage6-revisions');
const workspaceRoot = path.join(repoRoot, 'web/generated/stage6-revision-workspace');
const roles = ['writer_editor', 'director', 'fact_culture_reviewer'] as const;
const keyPairs = roles.map(() => generateKeyPairSync('ed25519'));

function trustPolicy(revokedRole?: typeof roles[number]) {
  return {
    schema_version: 'story-agent-stage6-exit-review-trust-policy/v1',
    policy_id: 'external-stage6-exit-review-policy-001',
    status: 'active',
    trust_source: 'external_configuration',
    evidence_environment: 'external',
    established_at: '2026-07-12T09:00:00.000Z',
    signers: roles.map((role, index) => ({
      signer_id: `reviewer-${role}`,
      role,
      key_id: `key-${role}`,
      algorithm: 'Ed25519',
      public_key_spki_pem: keyPairs[index].publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      status: role === revokedRole ? 'revoked' : 'trusted',
      authorization_reference: `authorization://${role}`,
      authorized_at: '2026-07-12T09:00:00.000Z',
    })),
    professional_pass_can_be_granted: false,
  };
}

function signedAttestation() {
  const value = {
    schema_version: 'story-agent-stage6-exit-review-attestation/v1',
    attestation_id: 'exit-attestation-001',
    benchmark_id: 'stage6-001-character-story',
    real_project_id: 'real-project-001',
    exit_audit_binding_sha256: 'a'.repeat(64),
    decision: 'approve_stage6_exit',
    reviewed_at: '2026-07-12T10:00:00.000Z',
    review_note: '三角色确认 Stage 6 两轮修订证据满足退出复核要求。',
    signatures: [] as Array<Record<string, unknown>>,
    professional_passed: false,
  };
  const payload = createStage6ExitReviewSignaturePayload(value);
  const digest = createHash('sha256').update(payload).digest('hex');
  value.signatures = roles.map((role, index) => ({
    schema_version: 'story-agent-stage6-exit-review-ed25519-signature/v1',
    signer_id: `reviewer-${role}`,
    role,
    key_id: `key-${role}`,
    algorithm: 'Ed25519',
    signed_payload_sha256: digest,
    signature_base64: sign(null, payload, keyPairs[index].privateKey).toString('base64'),
    signed_at: '2026-07-12T10:05:00.000Z',
  }));
  return value;
}

function evaluate(attestation: unknown, policy: unknown = trustPolicy()) {
  return evaluateStage6ExitReviewAttestation({
    rawJson: `${JSON.stringify(attestation, null, 2)}\n`,
    expectedBenchmarkId: 'stage6-001-character-story',
    expectedRealProjectId: 'real-project-001',
    expectedExitAuditBindingSha256: 'a'.repeat(64),
    stage6ExitCandidate: true,
    trustPolicy: policy,
    now: '2026-07-12T10:10:00.000Z',
  });
}

describe('Stage 6 exit-review signature inspector', () => {
  it('keeps the repository template blocked with zero trusted signers and no state writes', async () => {
    const revisionExisted = existsSync(revisionRoot);
    const workspaceExisted = existsSync(workspaceRoot);
    const workspace = await getStage6ExitReviewSignatureInspectorWorkspace({
      repoRoot,
      benchmarkId: 'stage6-001-character-story',
      now: '2026-07-12T10:00:00.000Z',
    });

    expect(workspace.schema_version).toBe('story-agent-stage6-exit-review-signature-inspector-workspace/v1');
    expect(workspace.projects).toHaveLength(15);
    expect(workspace.projects.every(project => project.stage6_exit_candidate === false)).toBe(true);
    expect(workspace.trust_policy).toMatchObject({ status: 'preparation_template', trusted_signer_count: 0, required_role_count: 3 });
    expect(workspace.template_inspection).toMatchObject({
      signature_verification_ready: false,
      attestation_persisted: false,
      stage6_exit_record_persisted: false,
      signature_created: false,
      execution_started: false,
      professional_passed: false,
    });
    expect(existsSync(revisionRoot)).toBe(revisionExisted);
    expect(existsSync(workspaceRoot)).toBe(workspaceExisted);
  });

  it('cryptographically verifies three externally trusted role signatures without granting pass or persisting exit', () => {
    const result = evaluate(signedAttestation());
    expect(result.signature_verification_ready).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(result.signature_summary).toMatchObject({
      signature_count: 3,
      trusted_signer_count: 3,
      payload_digest_match_count: 3,
      cryptographically_verified_signature_count: 3,
      writer_editor_signature_count: 1,
      director_signature_count: 1,
      fact_culture_reviewer_signature_count: 1,
    });
    expect(result).toMatchObject({ attestation_persisted: false, stage6_exit_record_persisted: false, signature_created: false, execution_started: false, professional_passed: false });
  });

  it('rejects attestation content tampering after signatures are created', () => {
    const value = signedAttestation();
    value.review_note = '篡改后的复核意见';
    const result = evaluate(value);
    expect(result.signature_verification_ready).toBe(false);
    expect(result.checks.signed_payload_digests_valid).toBe(false);
    expect(result.checks.cryptographic_signatures_valid).toBe(false);
    expect(result.issues.map(item => item.code)).toEqual(expect.arrayContaining([
      'exit_review_signed_payload_digest_mismatch',
      'exit_review_ed25519_signature_invalid',
    ]));
  });

  it('rejects a cryptographically valid signature from a revoked signer', () => {
    const result = evaluate(signedAttestation(), trustPolicy('director'));
    expect(result.signature_verification_ready).toBe(false);
    expect(result.checks.trusted_signer_bindings_valid).toBe(false);
    expect(result.checks.cryptographic_signatures_valid).toBe(false);
    expect(result.signature_summary.cryptographically_verified_signature_count).toBe(2);
  });

  it('exposes only template and validation routes with no sign, import, persist, or execute endpoint', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage6-revisions', createStage6RevisionsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);

    const workspace = await request.get('/api/stage6-revisions/exit-review-signature?benchmark_id=stage6-001-character-story');
    expect(workspace.status).toBe(200);
    expect(workspace.body.data.trust_policy.trusted_signer_count).toBe(0);
    const response = await request.post('/api/stage6-revisions/exit-review-signature/validate').send({
      raw_json: workspace.body.data.template_raw_json,
      expected_benchmark_id: workspace.body.data.selected_benchmark_id,
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ signature_verification_ready: false, signature_created: false, stage6_exit_record_persisted: false, professional_passed: false });
    for (const action of ['sign', 'import', 'persist', 'execute']) {
      expect((await request.post(`/api/stage6-revisions/exit-review-signature/${action}`).send({})).status).toBe(404);
    }
  });
});
