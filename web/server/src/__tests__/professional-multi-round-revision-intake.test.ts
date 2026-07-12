import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  Stage6RealInputIntakeSchema,
  Stage6RealInputReadinessReportSchema,
} from '@shared/schemas.js';
import type { Stage6RealInputIntake } from '@shared/types.js';
import {
  buildStage6RealInputOperatorTemplate,
  validateStage6RealInputIntake,
} from '../services/professional-multi-round-revision-intake-service.js';
import type { MultiRoundRevisionSpecRegistry } from '../services/professional-multi-round-revision-execution-service.js';
import { createProfessionalTextPackageSkeleton } from '../services/professional-text-package-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(
  repoRoot,
  'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json',
), 'utf8')) as MultiRoundRevisionSpecRegistry;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stage6-real-input-'));

afterAll(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

function verified(reference: string) {
  return {
    status: 'verified' as const,
    reference,
    verified_by: 'operator-001',
    verified_at: '2026-07-11T16:00:00.000Z',
  };
}

function buildValidIntake(): Stage6RealInputIntake {
  const intake = buildStage6RealInputOperatorTemplate(registry);
  intake.submitted_at = '2026-07-11T16:00:00.000Z';
  intake.operator = {
    operator_id: 'operator-001',
    display_name: 'Stage 6 Operator',
    contact_reference: 'internal-directory://operator-001',
  };
  for (const [index, project] of intake.projects.entries()) {
    const realProjectId = `real-stage6-${String(index + 1).padStart(3, '0')}`;
    const pkg = createProfessionalTextPackageSkeleton({
      video_type: project.video_type,
      project_id: realProjectId,
      package_id: `${realProjectId}-initial-package`,
      now: '2026-07-11T16:00:00.000Z',
    });
    pkg.status = 'draft';
    pkg.full_text = `真实初稿 ${realProjectId}`;
    pkg.sequence_beats = [{
      beat_id: 'beat-1',
      order: 1,
      title: '开场',
      purpose: '建立真实项目命题',
      visible_action: '人物进入空间并作出选择',
      conflict_discovery_or_instruction: '形成可修订的行动压力',
      emotional_or_information_turn: '从观察转为行动',
      evidence_ids: [],
    }];
    pkg.scene_breakdown = [{
      scene_id: 1,
      title: '开场',
      duration_sec: 30,
      location: '真实地点待现场核验',
      time_of_day: '日',
      dramatic_function: '建立命题',
      plot: '人物进入并行动',
      key_action: '作出选择',
      characters: ['主角'],
      visual_prompt: '人物进入真实空间',
      camera_suggestion: '中景跟拍',
      cultural_note: '只使用已核验事实',
    }];
    pkg.delivery_text_package.script_text = pkg.full_text;
    const contents = `${JSON.stringify(pkg, null, 2)}\n`;
    const relativePath = `packages/${realProjectId}.json`;
    fs.mkdirSync(path.join(tempRoot, 'packages'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, relativePath), contents);

    project.provenance = 'operator_submitted_real_input';
    project.real_project_id = realProjectId;
    project.initial_package = { path: relativePath, sha256: sha256(contents) };
    project.creator_authorization = {
      subject_type: 'human_author',
      subject_id: `author-${index + 1}`,
      authorized_rounds: [1, 2],
      verification: verified(`authorization://${realProjectId}`),
    };
    project.revision_budget = {
      currency: 'CNY',
      amount: 1000,
      authorized_rounds: [1, 2],
      verification: verified(`budget://${realProjectId}`),
    };
    project.reviewers = [
      ['writer_editor', `writer-${index + 1}`],
      ['director', `director-${index + 1}`],
      ['fact_culture_reviewer', `fact-${index + 1}`],
    ].map(([role, reviewerId]) => ({
      role: role as 'writer_editor' | 'director' | 'fact_culture_reviewer',
      reviewer_id: reviewerId,
      display_name: `${role}-${index + 1}`,
      identity_verification: verified(`identity://${reviewerId}`),
    }));
    project.table_read = {
      schedule_reference: `meeting://${realProjectId}`,
      scheduled_at: '2026-07-20T10:00:00.000+08:00',
      timezone: 'Asia/Shanghai',
      participant_reviewer_ids: project.reviewers.map(reviewer => reviewer.reviewer_id),
      verification: verified(`schedule://${realProjectId}`),
    };
  }
  return intake;
}

describe('Stage 6 real-input intake', () => {
  it('creates a schema-valid operator template and reports all 15 projects as blocked without credit', () => {
    const template = buildStage6RealInputOperatorTemplate(registry);
    expect(Stage6RealInputIntakeSchema.safeParse(template).success).toBe(true);

    const report = validateStage6RealInputIntake({
      intake: template,
      registry,
      repoRoot,
      sourceIntakePath: 'operator-template.json',
      now: '2026-07-11T16:00:00.000Z',
    });
    expect(report.summary).toEqual({
      project_count: 15,
      ready_project_count: 0,
      blocked_project_count: 15,
      completed_verified_revision_round_count: 0,
      professional_pass_count: 0,
    });
    expect(report.projects.every(project => project.status === 'blocked'
      && project.professional_passed === false
      && project.completed_verified_round_count === 0
      && project.blockers.some(blocker => blocker.code === 'real_input_provenance_required'))).toBe(true);
    expect(Stage6RealInputReadinessReportSchema.safeParse(report).success).toBe(true);
  });

  it('marks all 15 projects ready only after file, hash, package, authorization, budget, reviewers, and table read validate', () => {
    const report = validateStage6RealInputIntake({
      intake: buildValidIntake(),
      registry,
      repoRoot: tempRoot,
      sourceIntakePath: 'verified-intake.json',
      now: '2026-07-11T16:00:00.000Z',
    });
    expect(report.summary.ready_project_count).toBe(15);
    expect(report.summary.blocked_project_count).toBe(0);
    expect(report.summary.completed_verified_revision_round_count).toBe(0);
    expect(report.summary.professional_pass_count).toBe(0);
    expect(report.projects.every(project => Object.values(project.checks).every(Boolean))).toBe(true);
  });

  it('blocks duplicate project IDs, anonymous reviewers, unverified authorization, and nonexistent files', () => {
    const intake = buildValidIntake();
    intake.projects[1].real_project_id = intake.projects[0].real_project_id;
    intake.projects[0].reviewers[0].display_name = 'anonymous';
    intake.projects[0].creator_authorization.verification.status = 'unverified';
    intake.projects[0].initial_package.path = 'packages/does-not-exist.json';
    const report = validateStage6RealInputIntake({ intake, registry, repoRoot: tempRoot });
    const firstCodes = report.projects[0].blockers.map(blocker => blocker.code);
    expect(firstCodes).toEqual(expect.arrayContaining([
      'duplicate_real_project_id',
      'anonymous_reviewer_not_allowed',
      'creator_authorization_unverified',
      'initial_package_file_not_found',
    ]));
    expect(report.projects[1].blockers.map(blocker => blocker.code)).toContain('duplicate_real_project_id');
    expect(report.summary.completed_verified_revision_round_count).toBe(0);
    expect(report.summary.professional_pass_count).toBe(0);
  });

  it('returns one deterministic readiness result per registry project when an intake item is malformed', () => {
    const intake = buildStage6RealInputOperatorTemplate(registry) as unknown as { projects: Array<Record<string, unknown>> };
    intake.projects[0].revision_budget = 'invalid';
    const report = validateStage6RealInputIntake({ intake, registry, repoRoot });
    expect(report.projects).toHaveLength(15);
    expect(report.projects[0].status).toBe('blocked');
    expect(report.projects[0].blockers.map(blocker => blocker.code)).toContain('intake_project_schema_invalid');
  });
});
