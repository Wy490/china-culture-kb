import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage8BlindReviewRouter } from '../routes/stage8-blind-review.js';
import { getStage8BlindReviewEvaluatorReadiness } from '../services/stage8-blind-review-evaluator-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T17:00:00.000Z';

describe('Stage 8 all-format blind-review evaluator readiness', () => {
  it('binds all 15 video types to immutable, sum-100 weight contracts', async () => {
    const report = await getStage8BlindReviewEvaluatorReadiness({ repoRoot, now: fixedNow });
    const stored = JSON.parse(await readFile(path.resolve(repoRoot, 'data/reports/story-agent-stage8-blind-review-evaluator-readiness.json'), 'utf8'));
    expect(report.summary).toEqual({
      target_video_type_count: 15,
      weight_contract_ready_count: 15,
      weight_sum_valid_count: 15,
      unique_weight_contract_sha256_count: 15,
      blind_review_bundle_schema_version: 'professional-benchmark-blind-review/v2',
      blind_review_decision_schema_version: 'professional-benchmark-blind-review-decision/v2',
      real_review_bundle_count: 0,
      human_blind_review_pass_project_count: 0,
      professional_pass_count: 0,
    });
    expect(report.video_types).toHaveLength(15);
    expect(report.video_types.every(item => item.weight_sum === 100 && item.evaluator_ready && item.top_weight_dimensions.length === 3)).toBe(true);
    expect(new Set(report.video_types.map(item => item.weight_contract_sha256)).size).toBe(15);
    expect(stored).toEqual(report);
  });

  it('keeps score thresholds separate from human and professional credit', async () => {
    const report = await getStage8BlindReviewEvaluatorReadiness({ repoRoot, now: fixedNow });
    expect(report.policy).toEqual({
      score_threshold_is_human_blind_review_pass: false,
      fixture_simulation_fallback_counts_as_real_review: false,
      evaluator_can_grant_professional_pass: false,
      external_signed_human_artifacts_required_for_finalization: true,
    });
    expect(report.source_bindings).toHaveLength(4);
    expect(report.video_types.every(item => item.real_review_bundle_count === 0 && item.human_blind_review_pass_project_count === 0 && item.professional_pass_count === 0)).toBe(true);
  });

  it('exposes readiness as GET only with no evaluator execution or credit endpoint', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage8-blind-review', createStage8BlindReviewRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);
    const response = await request.get('/api/stage8-blind-review/evaluator');
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toMatchObject({ weight_contract_ready_count: 15, real_review_bundle_count: 0, professional_pass_count: 0 });
    for (const action of ['validate', 'execute', 'approve', 'credit', 'sign', 'publish']) expect((await request.post(`/api/stage8-blind-review/evaluator/${action}`).send({})).status).toBe(404);
  });
});
