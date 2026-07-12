import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage8BlindReviewRouter } from '../routes/stage8-blind-review.js';
import {
  getStage8BlindReviewWorkspace,
  inspectStage8BlindReviewIntake,
} from '../services/stage8-blind-review-intake-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T16:00:00.000Z';

describe('Stage 8 blind-review intake', () => {
  it('builds one schema-valid operator template for all 75 frozen benchmark projects', async () => {
    const workspace = await getStage8BlindReviewWorkspace({ repoRoot, now: fixedNow });
    expect(workspace.schema_version).toBe('story-agent-stage8-blind-review-workspace/v1');
    expect(workspace.template.projects).toHaveLength(75);
    expect(new Set(workspace.template.projects.map(item => item.benchmark_id)).size).toBe(75);
    expect(new Set(workspace.template.projects.map(item => item.video_type)).size).toBe(15);
    expect(workspace.template_validation.report.source_bindings).toHaveLength(15);
    expect(workspace.template_validation.report.source_bindings.every(item => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    expect(workspace.thresholds).toEqual({
      minimum_weighted_average_score: 85,
      minimum_dimension_score: 75,
      maximum_baseline_gap: 3,
      minimum_production_advance_vote_ratio: '2/3',
      required_role_count: 3,
      hard_gate_failure_count_required: 0,
    });
  });

  it('reports every preparation project blocked and grants zero review or professional credit', async () => {
    const workspace = await getStage8BlindReviewWorkspace({ repoRoot, now: fixedNow });
    const { report } = workspace.template_validation;
    expect(report.summary).toEqual({
      target_video_type_count: 15,
      project_count: 75,
      ready_for_external_blind_review_count: 0,
      blocked_project_count: 75,
      reviewer_assignment_ready_project_count: 0,
      human_blind_review_pass_project_count: 0,
      human_blind_review_pass_project_target: 45,
      professional_pass_count: 0,
    });
    expect(report.video_types).toHaveLength(15);
    expect(report.video_types.every(item => item.project_count === 5 && item.blocked_project_count === 5 && item.human_blind_review_pass_project_count === 0)).toBe(true);
    expect(report.projects.every(item => item.status === 'blocked' && !item.human_blind_review_passed && !item.professional_passed)).toBe(true);
    expect(report.policy).toMatchObject({
      readiness_is_human_blind_review_pass: false,
      fixture_simulation_fallback_counts_as_real_review: false,
      threshold_evaluation_without_verified_human_artifacts_counts_as_pass: false,
      intake_can_persist_reviews: false,
      intake_can_grant_professional_pass: false,
    });
  });

  it('rejects simulation provenance and self-reported credit without persisting anything', async () => {
    const generatedPath = path.resolve(repoRoot, 'web/generated/stage8-blind-reviews');
    const before = existsSync(generatedPath);
    const workspace = await getStage8BlindReviewWorkspace({ repoRoot, now: fixedNow });
    const fixture = structuredClone(workspace.template) as any;
    fixture.submitted_at = fixedNow;
    fixture.operator = { operator_id: 'fixture-operator', display_name: 'Fixture', contact_reference: 'fixture-only' };
    fixture.projects[0].provenance = 'simulation';
    fixture.projects[0].human_blind_review_passed = true;
    fixture.projects[0].professional_passed = true;
    const result = await inspectStage8BlindReviewIntake({ repoRoot, request: fixture, now: fixedNow });
    const project = result.report.projects[0];
    expect(project.status).toBe('blocked');
    expect(project.checks.real_provenance_verified).toBe(false);
    expect(project.checks.source_claimed_credit_rejected).toBe(false);
    expect(project.human_blind_review_passed).toBe(false);
    expect(project.professional_passed).toBe(false);
    expect(result).toMatchObject({ dry_run_only: true, input_persisted: false, review_record_persisted: false, review_execution_started: false, human_blind_review_passed: false, professional_passed: false });
    expect(existsSync(generatedPath)).toBe(before);
  });

  it('does not accept an arbitrary hash-matched JSON file as a final ProfessionalTextPackage', async () => {
    const workspace = await getStage8BlindReviewWorkspace({ repoRoot, now: fixedNow });
    const intake = structuredClone(workspace.template);
    const project = intake.projects[0];
    const relativePath = 'data/professional-benchmarks/character-story-iteration3-benchmark-specs.json';
    const bytes = await readFile(path.resolve(repoRoot, relativePath));
    project.final_package = { path: relativePath, sha256: createHash('sha256').update(bytes).digest('hex') };
    const result = await inspectStage8BlindReviewIntake({ repoRoot, request: intake, now: fixedNow });
    const readiness = result.report.projects[0];
    expect(readiness.checks.final_package_file_valid).toBe(true);
    expect(readiness.checks.final_package_sha256_valid).toBe(true);
    expect(readiness.checks.final_package_schema_valid).toBe(false);
    expect(readiness.checks.final_package_video_type_binding_valid).toBe(false);
    expect(readiness.checks.final_package_content_complete).toBe(false);
    expect(readiness.status).toBe('blocked');
  });

  it('rejects future intake submissions, expired schedules, and verification performed after submission', async () => {
    const workspace = await getStage8BlindReviewWorkspace({ repoRoot, now: fixedNow });
    const future = structuredClone(workspace.template);
    future.submitted_at = '2026-07-12T17:00:00.000Z';
    future.operator = { operator_id: 'external-operator', display_name: 'External Operator', contact_reference: 'authorization://operator/001' };
    const futureResult = await inspectStage8BlindReviewIntake({ repoRoot, request: future, now: fixedNow });
    expect(futureResult.report.global_errors.map(item => item.code)).toContain('stage8_submitted_at_future');

    const expired = structuredClone(workspace.template);
    expired.submitted_at = '2026-07-12T15:00:00.000Z';
    expired.operator = { operator_id: 'external-operator', display_name: 'External Operator', contact_reference: 'authorization://operator/001' };
    expired.projects[0].review_schedule = { schedule_reference: 'schedule://review/001', due_at: '2026-07-12T15:30:00.000Z', timezone: 'Asia/Shanghai',
      verification: { status: 'verified', reference: 'verification://schedule/001', verified_by: 'scheduler-001', verified_at: '2026-07-12T15:30:00.000Z' } };
    const expiredResult = await inspectStage8BlindReviewIntake({ repoRoot, request: expired, now: fixedNow });
    expect(expiredResult.report.projects[0].checks.review_schedule_verified).toBe(false);
  });

  it('exposes only template and dry-run validation endpoints', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage8-blind-review', createStage8BlindReviewRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);
    const response = await request.get('/api/stage8-blind-review/intake');
    expect(response.status).toBe(200);
    expect(response.body.data.template_validation.report.summary).toMatchObject({ project_count: 75, blocked_project_count: 75, human_blind_review_pass_project_count: 0 });
    const validate = await request.post('/api/stage8-blind-review/intake/validate').send(response.body.data.template);
    expect(validate.status).toBe(200);
    expect(validate.body.data).toMatchObject({ dry_run_only: true, input_persisted: false, review_execution_started: false, professional_passed: false });
    for (const action of ['persist', 'execute', 'approve', 'sign', 'publish', 'writeback']) expect((await request.post(`/api/stage8-blind-review/intake/${action}`).send({})).status).toBe(404);
  });
});
