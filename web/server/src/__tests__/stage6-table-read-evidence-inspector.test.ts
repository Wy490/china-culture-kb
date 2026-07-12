import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import {
  getStage6TableReadEvidenceInspectorWorkspace,
  inspectStage6TableReadEvidence,
} from '../services/stage6-table-read-evidence-inspector-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const revisionRoot = path.join(repoRoot, 'web/generated/stage6-revisions');
const workspaceRoot = path.join(repoRoot, 'web/generated/stage6-revision-workspace');

function schemaValidArtifact() {
  return {
    schema_version: 'story-agent-stage6-table-read-feedback/v1',
    benchmark_id: 'stage6-001-character-story',
    real_project_id: 'real-project-001',
    round_number: 1,
    session_reference: 'table-read-session-001',
    submitted_at: '2026-07-12T10:00:00.000Z',
    feedback: [
      { feedback_id: 'feedback-writer-1', reviewer_id: 'reviewer-writer-1', source: 'writer_editor', category: 'structure', note: '结构意见', issue_id: 'issue-1', target_sections: ['full_text'], evidence_required: false },
      { feedback_id: 'feedback-director-1', reviewer_id: 'reviewer-director-1', source: 'director', category: 'scene', note: '场景意见', issue_id: 'issue-2', target_sections: ['scene_breakdown'], evidence_required: false },
      { feedback_id: 'feedback-fact-1', reviewer_id: 'reviewer-fact-1', source: 'fact_culture_reviewer', category: 'fact_and_culture', note: '事实意见', issue_id: 'issue-3', target_sections: ['truth_and_adaptation_contract'], evidence_required: true },
    ],
  };
}

describe('Stage 6 table-read evidence inspector', () => {
  it('returns a 15-project blocked template without creating signatures or state', async () => {
    const revisionExisted = existsSync(revisionRoot);
    const workspaceExisted = existsSync(workspaceRoot);
    const workspace = await getStage6TableReadEvidenceInspectorWorkspace({
      repoRoot,
      benchmarkId: 'stage6-001-character-story',
      roundNumber: 1,
      now: '2026-07-12T08:00:00.000Z',
    });

    expect(workspace.schema_version).toBe('story-agent-stage6-table-read-evidence-inspector-workspace/v1');
    expect(workspace.projects).toHaveLength(15);
    expect(workspace.policy).toEqual({
      dry_run_only: true,
      input_files_are_not_persisted: true,
      signature_preflight_is_signature: false,
      self_reported_signature_or_credit_is_accepted: false,
      human_table_read_credit_can_be_granted: false,
      professional_pass_can_be_granted: false,
    });
    expect(workspace.template_inspection).toMatchObject({
      signature_preflight_ready: false,
      input_persisted: false,
      table_read_state_mutated: false,
      signature_created: false,
      human_table_read_credit_granted: false,
      execution_started: false,
      professional_passed: false,
    });
    expect(workspace.template_inspection.checks.p0_readiness_reverified).toBe(false);
    expect(existsSync(revisionRoot)).toBe(revisionExisted);
    expect(existsSync(workspaceRoot)).toBe(workspaceExisted);
  });

  it('keeps a schema-valid three-role artifact blocked when P0 identities and session are unverified', async () => {
    const result = await inspectStage6TableReadEvidence({
      repoRoot,
      request: {
        raw_json: `${JSON.stringify(schemaValidArtifact(), null, 2)}\n`,
        expected_benchmark_id: 'stage6-001-character-story',
        expected_round_number: 1,
      },
      now: '2026-07-12T10:00:00.000Z',
    });

    expect(result.schema_valid).toBe(true);
    expect(result.artifact_summary).toMatchObject({ feedback_count: 3, writer_editor_feedback_count: 1, director_feedback_count: 1, fact_culture_reviewer_feedback_count: 1 });
    expect(result.signature_preflight_ready).toBe(false);
    expect(result.checks).toMatchObject({
      artifact_schema_valid: true,
      three_required_roles_present: true,
      feedback_ids_unique: true,
      p0_readiness_reverified: false,
      real_project_binding_valid: false,
      session_reference_valid: false,
      reviewer_ids_match_verified_intake: false,
    });
    expect(result.signature_created).toBe(false);
    expect(result.human_table_read_credit_granted).toBe(false);
    expect(result.professional_passed).toBe(false);
  });

  it('rejects self-reported signatures and credit as both schema and credit evidence', async () => {
    const claimed = { ...schemaValidArtifact(), signature: 'not-a-real-signature', professional_passed: true };
    const result = await inspectStage6TableReadEvidence({
      repoRoot,
      request: { raw_json: JSON.stringify(claimed), expected_benchmark_id: 'stage6-001-character-story', expected_round_number: 1 },
    });
    expect(result.schema_valid).toBe(false);
    expect(result.artifact_summary.source_claimed_signature_or_credit).toBe(true);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'self_reported_signature_or_credit_rejected', blocking: false, gate: 'credit' }),
      expect.objectContaining({ code: 'table_read_artifact_schema_invalid', blocking: true, gate: 'schema' }),
    ]));
    expect(result.signature_created).toBe(false);
    expect(result.human_table_read_credit_granted).toBe(false);
  });

  it('exposes only template and validate routes with no sign, persist, close, or execute endpoint', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage6-revisions', createStage6RevisionsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);

    const workspace = await request.get('/api/stage6-revisions/table-read-inspector?benchmark_id=stage6-001-character-story&round_number=2');
    expect(workspace.status).toBe(200);
    expect(workspace.body.data).toMatchObject({ selected_benchmark_id: 'stage6-001-character-story', selected_round_number: 2 });
    const response = await request.post('/api/stage6-revisions/table-read-inspector/validate').send({
      raw_json: workspace.body.data.template_raw_json,
      expected_benchmark_id: workspace.body.data.selected_benchmark_id,
      expected_round_number: 2,
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ signature_preflight_ready: false, signature_created: false, human_table_read_credit_granted: false, professional_passed: false });
    for (const action of ['sign', 'persist', 'close', 'execute']) {
      expect((await request.post(`/api/stage6-revisions/table-read-inspector/${action}`).send({})).status).toBe(404);
    }
  });
});
