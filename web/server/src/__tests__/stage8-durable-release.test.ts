import { createHash } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage8BlindReviewRouter } from '../routes/stage8-blind-review.js';
import {
  computeStage8DurableReleaseSha256,
  createStage8DurableReleaseSignaturePayload,
  evaluateStage8DurableRelease,
  getStage8DurableReleaseWorkspace,
} from '../services/stage8-durable-release-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T20:00:00.000Z';
const publicKey = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=\n-----END PUBLIC KEY-----\n';
const invalidSignature = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

function authorityRegistry(status: 'active' | 'revoked' = 'active', knownReleaseIds: string[] = []) {
  return {
    schema_version: 'professional-benchmark-release-authority-registry/v1', registry_id: 'external-authority-registry-001',
    trust_source: 'external_configuration', evidence_environment: 'external', established_at: '2026-07-12T18:00:00.000Z',
    authorities: [{ authority_id: 'release-authority-001', key_id: 'release-key-001', algorithm: 'Ed25519', public_key_spki_pem: publicKey,
      status, allowed_scope: 'durable_professional_benchmark_release', allowed_video_types: ['character_story'],
      valid_from: '2026-07-12T18:00:00.000Z', valid_until: '2026-08-12T18:00:00.000Z' }], known_release_ids: knownReleaseIds,
  };
}

function refreshRecordDigests(decision: unknown, record: Record<string, unknown>) {
  record.finalization_decision_sha256 = computeStage8DurableReleaseSha256(decision);
  record.artifact_manifest_sha256 = computeStage8DurableReleaseSha256(record.immutable_artifact_manifest);
  const content = { ...record }; delete content.release_record_sha256; delete content.record_signature;
  record.release_record_sha256 = computeStage8DurableReleaseSha256(content);
  (record.record_signature as Record<string, unknown>).signed_payload_sha256 = createHash('sha256')
    .update(createStage8DurableReleaseSignaturePayload(record)).digest('hex');
}

function fixture() {
  const decision = {
    schema_version: 'professional-benchmark-finalization-decision/v2', benchmark_id: 'character-benchmark-001-zhou-dunyi-choice',
    run_id: 'external-run-001', video_type: 'character_story', eligible_for_signed_release: true, professional_passed: false,
    initial_quality_score: 82, final_quality_score: 89, verified_quality_improvement: 7, blockers: ['signed_release_record_missing'],
  };
  const manifest = {
    schema_version: 'professional-benchmark-release-artifact-manifest/v1', manifest_id: 'manifest-001', benchmark_id: decision.benchmark_id,
    run_id: decision.run_id, video_type: decision.video_type, created_at: '2026-07-12T19:00:00.000Z', evidence_environment: 'external',
    immutable: true, artifact_count: 12, final_package_sha256: 'a'.repeat(64), artifact_validation_record_sha256: 'b'.repeat(64),
    human_verification_record_sha256: 'c'.repeat(64), artifacts: Array.from({ length: 12 }, (_, index) => ({ artifact_id: `artifact-${index + 1}`,
      artifact_type: `professional-artifact-${index + 1}`, path: `/external/artifacts/${index + 1}.json`,
      sha256: index < 3 ? ['a', 'b', 'c'][index].repeat(64) : (index % 10).toString().repeat(64), size_bytes: 100 + index })),
  };
  const record: Record<string, unknown> = {
    schema_version: 'professional-benchmark-durable-signed-release/v1', release_id: 'release-001', benchmark_id: decision.benchmark_id,
    run_id: decision.run_id, video_type: decision.video_type, finalization_decision_sha256: computeStage8DurableReleaseSha256(decision),
    artifact_manifest_sha256: computeStage8DurableReleaseSha256(manifest), immutable_artifact_manifest: manifest,
    release_authority_id: 'release-authority-001', authority_key_id: 'release-key-001', issued_at: '2026-07-12T19:15:00.000Z',
    expires_at: '2026-08-01T00:00:00.000Z', evidence_environment: 'external', is_fixture: false, is_simulation: false,
    professional_passed: false, release_record_sha256: '', record_signature: {
      schema_version: 'professional-benchmark-durable-release-ed25519-signature/v1', algorithm: 'Ed25519', key_id: 'release-key-001',
      signed_payload_sha256: '', signature_base64: invalidSignature,
    },
  };
  refreshRecordDigests(decision, record);
  return { decision, record };
}

function evaluate(decision: unknown, record: unknown, registry: unknown, now = fixedNow) {
  return evaluateStage8DurableRelease({ expected: { benchmark_id: 'character-benchmark-001-zhou-dunyi-choice', video_type: 'character_story' },
    finalizationDecisionRawJson: JSON.stringify(decision), releaseRecordRawJson: JSON.stringify(record), authorityRegistry: registry, now });
}

describe('Stage 8 durable signed-release read-only import inspector', () => {
  it('keeps all 75 projects blocked with an empty repository authority registry and zero credit', async () => {
    const workspace = await getStage8DurableReleaseWorkspace({ repoRoot, now: fixedNow });
    expect(workspace.summary).toEqual({ project_count: 75, finalization_candidate_ready_project_count: 0, active_release_authority_count: 0,
      release_record_verification_ready_project_count: 0, durable_signed_release_imported_count: 0, professional_pass_count: 0 });
    expect(workspace.authority_registry).toMatchObject({ status: 'preparation_template', active_authority_count: 0, known_release_id_count: 0 });
    expect(workspace.projects).toHaveLength(75);
    expect(workspace.template_inspection).toMatchObject({ verification_ready: false, release_record_created: false,
      release_record_imported: false, release_record_persisted: false, professional_passed: false });
  });

  it('rejects a tampered or otherwise unverifiable Ed25519 signature without creating a release', () => {
    const { decision, record } = fixture();
    const result = evaluate(decision, record, authorityRegistry());
    expect(result.checks.signature_payload_digest_valid).toBe(true);
    expect(result.checks.cryptographic_signature_valid).toBe(false);
    expect(result.issues.map(item => item.code)).toContain('release_signature_verification_failed');
    expect(result).toMatchObject({ verification_ready: false, release_record_created: false, release_record_imported: false,
      release_record_persisted: false, professional_passed: false });
  });

  it('rejects a revoked external release authority key', () => {
    const { decision, record } = fixture();
    const result = evaluate(decision, record, authorityRegistry('revoked'));
    expect(result.checks.authority_binding_valid).toBe(true);
    expect(result.checks.authority_key_trusted).toBe(false);
    expect(result.issues.map(item => item.code)).toContain('release_authority_key_revoked');
  });

  it('rejects benchmark, run, and video-type identity drift', () => {
    const { decision, record } = fixture();
    const drifted = structuredClone(record) as Record<string, unknown>;
    drifted.benchmark_id = 'another-benchmark'; drifted.run_id = 'another-run'; drifted.video_type = 'historical_drama';
    const result = evaluate(decision, drifted, authorityRegistry());
    expect(result.checks.benchmark_binding_valid).toBe(false);
    expect(result.checks.run_id_binding_valid).toBe(false);
    expect(result.checks.video_type_binding_valid).toBe(false);
  });

  it('rejects a self-asserted eligible decision with an invalid quality delta', () => {
    const { decision, record } = fixture();
    decision.initial_quality_score = 90;
    decision.final_quality_score = 80;
    decision.verified_quality_improvement = 10;
    refreshRecordDigests(decision, record);
    const result = evaluate(decision, record, authorityRegistry());
    expect(result.checks.finalization_decision_quality_gate_valid).toBe(false);
    expect(result.checks.finalization_candidate_eligible).toBe(false);
    expect(result.issues.map(item => item.code)).toContain('finalization_decision_quality_gate_invalid');
  });

  it('rejects duplicate artifact paths and unbound required manifest records', () => {
    const duplicateFixture = fixture();
    const duplicateManifest = duplicateFixture.record.immutable_artifact_manifest as Record<string, unknown>;
    const duplicateArtifacts = duplicateManifest.artifacts as Array<Record<string, unknown>>;
    duplicateArtifacts[1].path = duplicateArtifacts[0].path;
    refreshRecordDigests(duplicateFixture.decision, duplicateFixture.record);
    expect(evaluate(duplicateFixture.decision, duplicateFixture.record, authorityRegistry()).checks.artifact_manifest_immutable_shape_valid).toBe(false);

    const unboundFixture = fixture();
    const unboundManifest = unboundFixture.record.immutable_artifact_manifest as Record<string, unknown>;
    unboundManifest.final_package_sha256 = 'd'.repeat(64);
    unboundManifest.artifact_validation_record_sha256 = 'e'.repeat(64);
    unboundManifest.human_verification_record_sha256 = 'f'.repeat(64);
    refreshRecordDigests(unboundFixture.decision, unboundFixture.record);
    const unbound = evaluate(unboundFixture.decision, unboundFixture.record, authorityRegistry());
    expect(unbound.checks.artifact_manifest_required_records_bound).toBe(false);
    expect(unbound.issues.map(item => item.code)).toContain('artifact_manifest_required_records_unbound');
  });

  it('rejects duplicate release IDs and future or expired records from the external registry snapshot', () => {
    const { decision, record } = fixture();
    const duplicate = evaluate(decision, record, authorityRegistry('active', ['release-001']));
    expect(duplicate.checks.release_id_unique).toBe(false);
    expect(duplicate.issues.map(item => item.code)).toContain('duplicate_release_id_rejected');
    const future = structuredClone(record) as Record<string, unknown>; future.issued_at = '2026-07-13T20:00:00.000Z'; future.expires_at = '2026-08-01T00:00:00.000Z';
    expect(evaluate(decision, future, authorityRegistry()).issues.map(item => item.code)).toContain('release_issued_at_invalid_or_future');
    const expired = structuredClone(record) as Record<string, unknown>; expired.expires_at = '2026-07-12T19:30:00.000Z';
    expect(evaluate(decision, expired, authorityRegistry()).issues.map(item => item.code)).toContain('release_expired_or_invalid_expiry');
  });

  it('exposes only workspace and memory validation; mutation endpoints remain absent', async () => {
    const app = express(); app.use(createJsonBodyParser()); app.use('/api/stage8-blind-review', createStage8BlindReviewRouter(repoRoot)); app.use(errorHandler);
    const request = supertest(app);
    const workspace = await request.get('/api/stage8-blind-review/durable-release');
    expect(workspace.status).toBe(200);
    const validation = await request.post('/api/stage8-blind-review/durable-release/validate').send({ expected_benchmark_id: workspace.body.data.selected_benchmark_id,
      finalization_decision_raw_json: workspace.body.data.finalization_decision_template_raw_json,
      release_record_raw_json: workspace.body.data.release_record_template_raw_json });
    expect(validation.status).toBe(200);
    expect(validation.body.data).toMatchObject({ release_record_created: false, release_record_imported: false, release_record_persisted: false, professional_passed: false });
    for (const action of ['create', 'sign', 'import', 'persist', 'release', 'approve', 'writeback']) {
      expect((await request.post(`/api/stage8-blind-review/durable-release/${action}`).send({})).status).toBe(404);
    }
  });
});
