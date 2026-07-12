import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage8BlindReviewRouter } from '../routes/stage8-blind-review.js';
import {
  getStage8Operations,
  resolveStage8OperationsNextAction,
  resolveStage8OperationsPhase,
} from '../services/stage8-operations-service.js';
import type { Stage8OperationsProject } from '@shared/types.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T21:00:00.000Z';

describe('Stage 8 operations control tower', () => {
  it('aggregates five lanes for 75 projects while keeping every real credit at zero', async () => {
    const report = await getStage8Operations({ repoRoot, now: fixedNow });
    expect(report.summary).toEqual({ project_count: 75, external_handoff_project_count: 75,
      blind_review_intake_ready_project_count: 0, evaluator_contract_ready_video_type_count: 15,
      real_review_bundle_count: 0, three_role_signature_ready_project_count: 0,
      finalization_candidate_ready_project_count: 0, durable_release_verification_ready_project_count: 0,
      durable_release_imported_count: 0, human_blind_review_pass_project_count: 0, professional_pass_count: 0 });
    expect(report.lanes).toHaveLength(5);
    expect(report.lanes.find(lane => lane.lane_id === 'all_format_evaluator')).toMatchObject({
      status: 'contract_ready_waiting_external_input', current_count: 15, target_count: 15, blocker_count: 75, credit_granted: false,
    });
    expect(report.lanes.filter(lane => lane.lane_id !== 'all_format_evaluator').every(lane => lane.status === 'blocked_external_input' && lane.current_count === 0 && lane.blocker_count === 75 && lane.credit_granted === false)).toBe(true);
  });

  it('emits exactly one deterministic earliest NEXT for each fixed benchmark', async () => {
    const report = await getStage8Operations({ repoRoot, now: fixedNow });
    expect(report.projects).toHaveLength(75);
    expect(new Set(report.projects.map(project => project.benchmark_id)).size).toBe(75);
    expect(report.projects.every(project => project.phase === 'awaiting_blind_review_intake')).toBe(true);
    expect(report.projects.every(project => project.next_action.code === 'complete_external_blind_review_intake'
      && project.next_action.route === '/story/stage8-blind-review-intake'
      && project.next_action.external_input_required
      && !project.next_action.counts_as_completion)).toBe(true);
    expect(report.projects.every(project => project.checks.evaluator_contract_ready
      && !project.checks.real_review_bundle_present
      && !project.checks.human_blind_review_passed
      && !project.checks.durable_release_imported
      && !project.checks.professional_passed)).toBe(true);
  });

  it('resolves each project independently through the ordered external gates', () => {
    const baseChecks: Stage8OperationsProject['checks'] = {
      blind_review_intake_ready: false,
      evaluator_contract_ready: true,
      real_review_bundle_present: false,
      three_role_signature_verification_ready: false,
      finalization_candidate_ready: false,
      durable_release_verification_ready: false,
      durable_release_imported: false,
      human_blind_review_passed: false,
      professional_passed: false,
    };
    const cases: Array<{
      ready: Partial<Stage8OperationsProject['checks']>;
      phase: Stage8OperationsProject['phase'];
      code: Stage8OperationsProject['next_action']['code'];
    }> = [
      { ready: {}, phase: 'awaiting_blind_review_intake', code: 'complete_external_blind_review_intake' },
      { ready: { blind_review_intake_ready: true }, phase: 'awaiting_external_review_bundle', code: 'submit_external_human_review_bundle' },
      { ready: { blind_review_intake_ready: true, real_review_bundle_present: true }, phase: 'awaiting_three_role_signatures', code: 'complete_three_role_review_signatures' },
      { ready: { blind_review_intake_ready: true, real_review_bundle_present: true, three_role_signature_verification_ready: true }, phase: 'awaiting_finalization_candidate', code: 'assemble_finalization_candidate_evidence' },
      { ready: { blind_review_intake_ready: true, real_review_bundle_present: true, three_role_signature_verification_ready: true, finalization_candidate_ready: true }, phase: 'awaiting_durable_release_record', code: 'obtain_independent_durable_signed_release' },
      { ready: { blind_review_intake_ready: true, real_review_bundle_present: true, three_role_signature_verification_ready: true, finalization_candidate_ready: true, durable_release_verification_ready: true }, phase: 'awaiting_authorized_external_import', code: 'complete_authorized_external_release_import' },
    ];
    for (const item of cases) {
      const phase = resolveStage8OperationsPhase({ ...baseChecks, ...item.ready });
      expect(phase).toBe(item.phase);
      expect(resolveStage8OperationsNextAction(phase)).toMatchObject({
        code: item.code,
        external_input_required: true,
        counts_as_completion: false,
      });
    }
  });

  it('builds a source-bound memory-only handoff without writing generated state', async () => {
    const generatedPath = path.resolve(repoRoot, 'web/generated/stage8-external-handoffs');
    const before = existsSync(generatedPath);
    const report = await getStage8Operations({ repoRoot, now: fixedNow });
    expect(report.source_bindings.map(item => item.path)).toEqual([
      'data/reports/story-agent-stage8-blind-review-evaluator-readiness.json',
      'data/reports/story-agent-stage8-blind-review-readiness.json',
      'data/reports/story-agent-stage8-blind-review-signature-readiness.json',
      'data/reports/story-agent-stage8-durable-release-readiness.json',
      'data/reports/story-agent-stage8-finalization-preflight-readiness.json',
    ]);
    expect(report.source_bindings.every(item => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    expect(report.handoff_canonical_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.handoff_package).toMatchObject({ canonical_sha256: report.handoff_canonical_sha256, memory_only: true,
      persisted: false, execution_started: false, external_evidence_completed: false, human_blind_review_passed: false,
      durable_release_imported: false, professional_passed: false });
    expect(report.handoff_package.tasks).toHaveLength(75);
    expect(new Set(report.handoff_package.tasks.map(task => task.task_id)).size).toBe(75);
    expect(existsSync(generatedPath)).toBe(before);
  });

  it('exposes only GET operations; export, persist, execute, import, approve, release, and writeback remain absent', async () => {
    const app = express(); app.use(createJsonBodyParser()); app.use('/api/stage8-blind-review', createStage8BlindReviewRouter(repoRoot)); app.use(errorHandler);
    const request = supertest(app);
    const response = await request.get('/api/stage8-blind-review/operations');
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toMatchObject({ project_count: 75, external_handoff_project_count: 75,
      durable_release_imported_count: 0, professional_pass_count: 0 });
    for (const action of ['export', 'persist', 'execute', 'import', 'approve', 'release', 'writeback']) {
      expect((await request.post(`/api/stage8-blind-review/operations/${action}`).send({})).status).toBe(404);
    }
  });
});
