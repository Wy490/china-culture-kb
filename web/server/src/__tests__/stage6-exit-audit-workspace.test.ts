import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Stage6RealRevisionExitAuditReport } from '@shared/types.js';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import {
  buildStage6RealRevisionExitAudit,
  validateStage6RealRevisionExitAudit,
} from '../services/stage6-real-revision-exit-audit-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const executionRoot = path.join(repoRoot, 'web/generated/stage6-revisions');

describe('Stage 6 exit audit product surface', () => {
  it('returns a typed read-only portfolio with zero false credit and no artifact writes', async () => {
    const existedBefore = existsSync(executionRoot);
    const report: Stage6RealRevisionExitAuditReport = await buildStage6RealRevisionExitAudit({
      repoRoot,
      now: '2026-07-12T12:00:00.000Z',
    });

    expect(report.schema_version).toBe('story-agent-stage6-real-revision-exit-audit/v1');
    expect(report.summary).toEqual({
      project_count: 15,
      blocked_project_count: 15,
      eligible_for_stage6_exit_review_project_count: 0,
      recorded_round_count: 0,
      verified_real_revision_round_count: 0,
      effective_open_feedback_count: 0,
      professional_pass_count: 0,
    });
    expect(report.policy).toMatchObject({
      simulation_fixture_fallback_counts_as_real_revision: false,
      prepared_or_recovered_counts_as_real_revision: false,
      stage6_exit_candidate_counts_as_professional_pass: false,
    });
    expect(report.projects.every(project => (
      project.status === 'blocked'
      && project.stage6_exit_candidate === false
      && project.professional_passed === false
    ))).toBe(true);
    expect(validateStage6RealRevisionExitAudit(report)).toEqual([]);
    expect(existsSync(executionRoot)).toBe(existedBefore);
  });

  it('exposes only GET for the exit audit and keeps mutations unavailable', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage6-revisions', createStage6RevisionsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);

    const response = await request.get('/api/stage6-revisions/exit-audit');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      schema_version: 'story-agent-stage6-real-revision-exit-audit/v1',
      summary: {
        project_count: 15,
        blocked_project_count: 15,
        eligible_for_stage6_exit_review_project_count: 0,
        verified_real_revision_round_count: 0,
        professional_pass_count: 0,
      },
    });
    expect((await request.post('/api/stage6-revisions/exit-audit').send({})).status).toBe(404);
  });
});
