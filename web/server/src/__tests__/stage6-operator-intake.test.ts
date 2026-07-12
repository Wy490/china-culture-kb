import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import {
  getStage6OperatorIntakeWorkspace,
  validateStage6OperatorIntake,
} from '../services/stage6-operator-intake-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

describe('Stage 6 operator intake dry-run surface', () => {
  it('returns a 15-project template without granting readiness or professional credit', async () => {
    const workspace = await getStage6OperatorIntakeWorkspace({
      repoRoot,
      now: '2026-07-12T09:00:00.000Z',
    });

    expect(workspace.schema_version).toBe('story-agent-stage6-operator-intake-workspace/v1');
    expect(workspace.template.projects).toHaveLength(15);
    expect(new Set(workspace.template.projects.map(project => project.video_type)).size).toBe(15);
    expect(workspace.policy).toEqual({
      dry_run_only: true,
      input_files_are_not_persisted: true,
      readiness_counts_as_completed_revision: false,
      fixture_simulation_fallback_counts_as_real_input: false,
      professional_pass_can_be_granted_by_intake: false,
    });
    expect(workspace.template_validation).toMatchObject({
      schema_valid: true,
      dry_run_only: true,
      input_persisted: false,
      execution_started: false,
      professional_passed: false,
      report: {
        summary: {
          project_count: 15,
          ready_project_count: 0,
          blocked_project_count: 15,
          completed_verified_revision_round_count: 0,
          professional_pass_count: 0,
        },
      },
    });
  });

  it('turns malformed JSON values into a structured 15-project blocked report', async () => {
    const result = await validateStage6OperatorIntake({
      repoRoot,
      intake: { schema_version: 'wrong', projects: [] },
      now: '2026-07-12T09:00:00.000Z',
    });

    expect(result.schema_valid).toBe(false);
    expect(result.report.global_errors.map(item => item.code)).toEqual(expect.arrayContaining([
      'intake_schema_invalid',
      'intake_schema_version_invalid',
      'operator_identity_missing',
    ]));
    expect(result.report.projects).toHaveLength(15);
    expect(result.report.projects.every(project => project.status === 'blocked')).toBe(true);
    expect(result.report.summary.professional_pass_count).toBe(0);
  });

  it('exposes GET template and POST validation routes before the benchmark route', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage6-revisions', createStage6RevisionsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);

    const workspaceResponse = await request.get('/api/stage6-revisions/intake');
    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.data.template.projects).toHaveLength(15);

    const validationResponse = await request
      .post('/api/stage6-revisions/intake/validate')
      .send(workspaceResponse.body.data.template);
    expect(validationResponse.status).toBe(200);
    expect(validationResponse.body.data).toMatchObject({
      dry_run_only: true,
      input_persisted: false,
      execution_started: false,
      professional_passed: false,
      report: { summary: { blocked_project_count: 15, professional_pass_count: 0 } },
    });
  });
});
