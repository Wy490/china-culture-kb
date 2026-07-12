import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Stage6OperatorControlTowerReport } from '@shared/types.js';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import { getStage6OperatorControlTower } from '../services/stage6-operator-control-tower-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const revisionRoot = path.join(repoRoot, 'web/generated/stage6-revisions');
const workspaceRoot = path.join(repoRoot, 'web/generated/stage6-revision-workspace');

describe('Stage 6 operator control tower', () => {
  it('aggregates all 15 projects into an in-memory external handoff without granting credit', async () => {
    const revisionExisted = existsSync(revisionRoot);
    const workspaceExisted = existsSync(workspaceRoot);
    const report: Stage6OperatorControlTowerReport = await getStage6OperatorControlTower({
      repoRoot,
      now: '2026-07-12T08:00:00.000Z',
    });

    expect(report.schema_version).toBe('story-agent-stage6-operator-control-tower/v1');
    expect(report.handoff_canonical_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.policy).toEqual({
      read_only: true,
      handoff_package_persisted: false,
      handoff_generation_is_external_input_completion: false,
      execute_endpoint_available: false,
      fixture_simulation_fallback_prepared_counts_as_real_revision: false,
      exit_candidate_counts_as_professional_pass: false,
    });
    expect(report.summary).toEqual({
      project_count: 15,
      external_handoff_project_count: 15,
      p0_ready_project_count: 0,
      blocked_project_count: 15,
      planned_revision_round_count: 30,
      recorded_revision_round_count: 0,
      verified_real_revision_round_count: 0,
      effective_open_feedback_count: 0,
      exit_review_candidate_project_count: 0,
      professional_pass_count: 0,
    });
    expect(report.lanes).toHaveLength(5);
    expect(report.lanes.every(lane => lane.status === 'blocked' && lane.credit_granted === false)).toBe(true);
    expect(report.projects.every(project => (
      project.phase === 'awaiting_real_input'
      && project.next_action.code === 'prepare_and_inspect_initial_package'
      && project.next_action.route === '/story/stage6-package-inspector'
      && project.next_action.external_input_required
      && project.professional_passed === false
    ))).toBe(true);
    expect(report.projects.every(project => project.requirement_categories.includes('initial_package'))).toBe(true);
    expect(existsSync(revisionRoot)).toBe(revisionExisted);
    expect(existsSync(workspaceRoot)).toBe(workspaceExisted);
  });

  it('produces a deterministic handoff hash for unchanged evidence and timestamp', async () => {
    const left = await getStage6OperatorControlTower({ repoRoot, now: '2026-07-12T08:00:00.000Z' });
    const right = await getStage6OperatorControlTower({ repoRoot, now: '2026-07-12T08:00:00.000Z' });
    expect(left.handoff_canonical_sha256).toBe(right.handoff_canonical_sha256);
    expect(left.source_readiness_canonical_sha256).toBe(right.source_readiness_canonical_sha256);
  });

  it('exposes only a GET route and no server-side export, persist, or execute action', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage6-revisions', createStage6RevisionsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);

    const response = await request.get('/api/stage6-revisions/operations');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      schema_version: 'story-agent-stage6-operator-control-tower/v1',
      policy: { read_only: true, handoff_package_persisted: false, execute_endpoint_available: false },
      summary: { project_count: 15, p0_ready_project_count: 0, verified_real_revision_round_count: 0, professional_pass_count: 0 },
    });
    expect((await request.post('/api/stage6-revisions/operations/export').send({})).status).toBe(404);
    expect((await request.post('/api/stage6-revisions/operations/persist').send({})).status).toBe(404);
    expect((await request.post('/api/stage6-revisions/operations/execute').send({})).status).toBe(404);
  });
});
