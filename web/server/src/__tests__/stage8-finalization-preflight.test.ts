import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage8BlindReviewRouter } from '../routes/stage8-blind-review.js';
import { evaluateStage8FinalizationPreflight, getStage8FinalizationPreflightWorkspace } from '../services/stage8-finalization-preflight-service.js';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const fixedNow = '2026-07-12T18:00:00.000Z';

describe('stage8 finalization read-only preflight', () => {
  it('reports all 75 projects blocked and grants no release or professional credit', async () => {
    const workspace = await getStage8FinalizationPreflightWorkspace({ repoRoot, now: fixedNow });
    expect(workspace.summary).toMatchObject({ project_count: 75, finalization_candidate_ready_project_count: 0, signed_release_project_count: 0, professional_pass_count: 0 });
    expect(workspace.projects).toHaveLength(75);
    expect(workspace.projects.every(project => project.status === 'blocked' && project.blockers.some(item => item.code === 'signed_release_record_missing'))).toBe(true);
    expect(workspace.template_preflight).toMatchObject({ dry_run_only: true, input_persisted: false, finalization_started: false, signed_release_created: false, professional_passed: false });
  });

  it('rejects malformed JSON and identity drift without side effects', () => {
    const result = evaluateStage8FinalizationPreflight({ expected: { benchmark_id: 'fixed-001', video_type: 'character_story' },
      finalizationInputRawJson: '{', trustPolicyRawJson: '{}', now: fixedNow });
    expect(result.checks.finalization_input_json_valid).toBe(false);
    expect(result.checks.eligible_for_signed_release).toBe(false);
    expect(result.issues.map(item => item.code)).toContain('finalization_input_json_invalid');
    expect(result.signed_release_created).toBe(false);
  });

  it('exposes only GET and validate POST; release mutations remain absent', async () => {
    const app = express(); app.use(createJsonBodyParser()); app.use('/api/stage8-blind-review', createStage8BlindReviewRouter(repoRoot)); app.use(errorHandler);
    const request = supertest(app);
    const workspace = await request.get('/api/stage8-blind-review/finalization');
    expect(workspace.status).toBe(200);
    const validation = await request.post('/api/stage8-blind-review/finalization/validate').send({ expected_benchmark_id: workspace.body.data.selected_benchmark_id,
      finalization_input_raw_json: workspace.body.data.finalization_input_template_raw_json, trust_policy_raw_json: workspace.body.data.trust_policy_template_raw_json });
    expect(validation.status).toBe(200);
    expect(validation.body.data.professional_passed).toBe(false);
    for (const action of ['persist', 'finalize', 'sign', 'release', 'approve', 'writeback']) expect((await request.post(`/api/stage8-blind-review/finalization/${action}`).send({})).status).toBe(404);
  });
});
