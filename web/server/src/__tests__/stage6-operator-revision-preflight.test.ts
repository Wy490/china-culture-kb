import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import {
  getStage6OperatorRevisionPreflightWorkspace,
  preflightStage6OperatorRevision,
} from '../services/stage6-operator-revision-preflight-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const executionRoot = path.join(repoRoot, 'web/generated/stage6-revisions');

describe('Stage 6 operator revision preflight surface', () => {
  it('returns a current template and blocked dry-run without creating execution artifacts', async () => {
    const existedBefore = existsSync(executionRoot);
    const workspace = await getStage6OperatorRevisionPreflightWorkspace({ repoRoot, now: '2026-07-12T10:00:00.000Z' });

    expect(workspace.schema_version).toBe('story-agent-stage6-operator-revision-preflight-workspace/v1');
    expect(workspace.current_batch_summary).toMatchObject({ project_count: 15, planned_round_count: 30, p0_ready_project_count: 0, professional_pass_count: 0 });
    expect(workspace.policy).toMatchObject({ dry_run_only: true, execute_endpoint_available: false, artifacts_written_by_preflight: false, professional_pass_can_be_granted_by_preflight: false });
    expect(workspace.template_preflight).toMatchObject({ artifacts_written: false, execution_started: false, verified_real_revision_credit: false, professional_passed: false, preflight: { status: 'blocked', professional_passed: false } });
    expect(workspace.template_preflight.preflight.blockers.some(item => item.startsWith('command_schema_invalid'))).toBe(true);
    expect(existsSync(executionRoot)).toBe(existedBefore);
  });

  it('returns structured schema blockers for malformed command values', async () => {
    const result = await preflightStage6OperatorRevision({ repoRoot, command: {}, now: '2026-07-12T10:00:00.000Z' });
    expect(result.preflight.status).toBe('blocked');
    expect(result.preflight.blockers.length).toBeGreaterThan(5);
    expect(result.preflight.blockers.every(item => item.startsWith('command_schema_invalid'))).toBe(true);
    expect(result).toMatchObject({ dry_run_only: true, execute_endpoint_available: false, artifacts_written: false, execution_started: false, verified_real_revision_credit: false, professional_passed: false });
  });

  it('exposes preflight routes before the benchmark detail route and never exposes execute', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage6-revisions', createStage6RevisionsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);

    const workspaceResponse = await request.get('/api/stage6-revisions/preflight');
    expect(workspaceResponse.status).toBe(200);
    const response = await request.post('/api/stage6-revisions/preflight/validate').send(workspaceResponse.body.data.command_template);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ execute_endpoint_available: false, artifacts_written: false, execution_started: false, professional_passed: false, preflight: { status: 'blocked' } });
    expect((await request.post('/api/stage6-revisions/preflight/execute').send({})).status).toBe(404);
  });
});
