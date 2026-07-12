import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProfessionalTextPackage, Stage6RealInputIntake } from '@shared/types.js';
import {
  executeStage6RevisionBatch,
  preflightStage6RevisionBatch,
  type Stage6RevisionBatchCommand,
} from '../services/professional-multi-round-revision-batch-service.js';
import {
  buildStage6RealInputOperatorTemplate,
  validateStage6RealInputIntake,
} from '../services/professional-multi-round-revision-intake-service.js';
import type { MultiRoundRevisionSpecRegistry } from '../services/professional-multi-round-revision-execution-service.js';
import { createProfessionalTextPackageSkeleton } from '../services/professional-text-package-service.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(
  workspaceRoot,
  'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json',
), 'utf8')) as MultiRoundRevisionSpecRegistry;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(root: string, relativePath: string, value: unknown) {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
  return { path: relativePath, sha256: sha256(contents) };
}

function verification(reference: string) {
  return {
    status: 'verified' as const,
    reference,
    verified_by: 'operator-001',
    verified_at: '2026-07-11T16:00:00.000Z',
  };
}

function revisionablePackage(videoType: ProfessionalTextPackage['video_type'], projectId: string): ProfessionalTextPackage {
  const pkg = createProfessionalTextPackageSkeleton({
    video_type: videoType,
    project_id: projectId,
    package_id: `${projectId}-package`,
    now: '2026-07-11T16:00:00.000Z',
  });
  pkg.status = 'draft';
  pkg.full_text = `初稿正文 ${projectId}`;
  pkg.sequence_beats = [{
    beat_id: 'beat-1', order: 1, title: '开场', purpose: '建立命题', visible_action: '人物走入现场',
    conflict_discovery_or_instruction: '人物发现阻力', emotional_or_information_turn: '从观察转为选择', evidence_ids: [],
  }];
  pkg.scene_breakdown = [{
    scene_id: 1, title: '开场', duration_sec: 30, location: '现场', time_of_day: '日', dramatic_function: '建立命题',
    plot: '人物走入现场并发现阻力', key_action: '人物停下并作出选择', characters: ['主角'], visual_prompt: '真实现场中人物行动',
    camera_suggestion: '中景跟拍', cultural_note: '事实边界待真人复核', conflict: '选择与代价冲突', dialogue_or_narration: '我必须现在作出选择。',
  }];
  pkg.delivery_text_package.script_text = pkg.full_text;
  pkg.delivery_text_package.scene_units = [{
    scene_id: 1, script_text: '我必须现在作出选择。', visual_action: '人物停下并作出选择', camera_intent: '中景跟拍',
    sound_intent: '同期声', continuity_notes: ['现场'], evidence_boundary_notes: ['待真人复核'],
  }];
  pkg.quality_report.total_score = 70;
  pkg.quality_report.dimensions = pkg.quality_report.dimensions.map(dimension => ({ ...dimension, score: 70 }));
  return pkg;
}

function prepareReadyWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage6-batch-'));
  roots.push(root);
  const intake = buildStage6RealInputOperatorTemplate(registry);
  intake.submitted_at = '2026-07-11T16:00:00.000Z';
  intake.operator = { operator_id: 'operator-001', display_name: 'Operator', contact_reference: 'directory://operator-001' };
  const initialPackages = new Map<string, { pkg: ProfessionalTextPackage; reference: { path: string; sha256: string } }>();
  intake.projects.forEach((project, index) => {
    const projectId = `real-stage6-${index + 1}`;
    const pkg = revisionablePackage(project.video_type, projectId);
    const packageReference = writeJson(root, `inputs/${projectId}-initial.json`, pkg);
    initialPackages.set(project.benchmark_id, { pkg, reference: packageReference });
    project.provenance = 'operator_submitted_real_input';
    project.real_project_id = projectId;
    project.initial_package = packageReference;
    project.creator_authorization = {
      subject_type: 'human_author', subject_id: `author-${index + 1}`, authorized_rounds: [1, 2],
      verification: verification(`authorization://${projectId}`),
    };
    project.revision_budget = {
      currency: 'CNY', amount: 1000, authorized_rounds: [1, 2], verification: verification(`budget://${projectId}`),
    };
    project.reviewers = [
      { role: 'writer_editor', reviewer_id: `writer-${index + 1}`, display_name: `Writer ${index + 1}`, identity_verification: verification(`identity://writer-${index + 1}`) },
      { role: 'director', reviewer_id: `director-${index + 1}`, display_name: `Director ${index + 1}`, identity_verification: verification(`identity://director-${index + 1}`) },
      { role: 'fact_culture_reviewer', reviewer_id: `fact-${index + 1}`, display_name: `Fact ${index + 1}`, identity_verification: verification(`identity://fact-${index + 1}`) },
    ];
    project.table_read = {
      schedule_reference: `meeting://${projectId}`,
      scheduled_at: '2026-07-20T10:00:00.000+08:00',
      timezone: 'Asia/Shanghai',
      participant_reviewer_ids: project.reviewers.map(reviewer => reviewer.reviewer_id),
      verification: verification(`schedule://${projectId}`),
    };
  });
  writeJson(root, 'inputs/intake.json', intake);
  const report = validateStage6RealInputIntake({
    intake,
    registry,
    repoRoot: root,
    sourceIntakePath: 'inputs/intake.json',
    now: '2026-07-11T16:00:00.000Z',
  });
  const reportReference = writeJson(root, 'inputs/readiness.json', report);
  expect(report.summary.ready_project_count).toBe(15);
  return { root, intake, reportReference, initialPackages };
}

function buildCommand(input: ReturnType<typeof prepareReadyWorkspace>, projectIndex = 0): Stage6RevisionBatchCommand {
  const project = input.intake.projects[projectIndex];
  const initial = input.initialPackages.get(project.benchmark_id)!;
  const revised = structuredClone(initial.pkg);
  revised.full_text = `${initial.pkg.full_text}\n修订后人物承担了明确代价。`;
  revised.scene_breakdown[0].plot = '人物走入现场、发现阻力并承担代价';
  revised.scene_breakdown[0].key_action = '人物交出珍藏之物并继续前行';
  revised.quality_report.total_score = 78;
  revised.quality_report.dimensions = revised.quality_report.dimensions.map(dimension => ({ ...dimension, score: 78 }));
  const revisionReference = writeJson(input.root, `inputs/${project.real_project_id}-round1-submission.json`, revised);
  const tableRead = {
    schema_version: 'story-agent-stage6-table-read-feedback/v1',
    benchmark_id: project.benchmark_id,
    real_project_id: project.real_project_id,
    round_number: 1,
    session_reference: project.table_read.schedule_reference,
    submitted_at: '2026-07-20T12:00:00.000+08:00',
    feedback: project.reviewers.map((reviewer, index) => ({
      feedback_id: `feedback-${index + 1}`,
      reviewer_id: reviewer.reviewer_id,
      source: reviewer.role,
      category: index === 0 ? 'structure' : index === 1 ? 'scene' : 'fact_and_culture',
      note: `第${index + 1}类真人桌读意见`,
      issue_id: `issue-${index + 1}`,
      target_sections: index === 1 ? ['scene_breakdown'] : ['full_text'],
      evidence_required: index === 2,
    })),
  };
  const tableReference = writeJson(input.root, `inputs/${project.real_project_id}-round1-table-read.json`, tableRead);
  const costReference = writeJson(input.root, `inputs/${project.real_project_id}-round1-cost.json`, {
    schema_version: 'story-agent-stage6-revision-cost/v1',
    benchmark_id: project.benchmark_id,
    real_project_id: project.real_project_id,
    round_number: 1,
    output_id: `output-${project.real_project_id}-round1`,
    provider_or_author: project.creator_authorization.subject_id,
    amount: 100,
    currency: 'CNY',
    usage_reference: `cost://${project.real_project_id}/round1`,
    recorded_at: '2026-07-20T12:05:00.000+08:00',
  });
  return {
    schema_version: 'story-agent-stage6-revision-batch-command/v1',
    command_id: `command-${project.real_project_id}-round1`,
    created_at: '2026-07-20T12:10:00.000+08:00',
    benchmark_id: project.benchmark_id,
    real_project_id: project.real_project_id,
    round_number: 1,
    opt_in_execution_confirmed: true,
    readiness_report: input.reportReference,
    before_package: initial.reference,
    revision_submission: revisionReference,
    table_read_feedback: tableReference,
    cost_record: costReference,
    declared_changed_sections: ['scene_breakdown', 'full_text'],
    feedback_resolutions: tableRead.feedback.map(item => ({ feedback_id: item.feedback_id, resolution_note: `已按 ${item.issue_id} 修订` })),
    provenance: {
      artifact_kind: 'simulation',
      output_id: `output-${project.real_project_id}-round1`,
      model_or_author: project.creator_authorization.subject_id,
      prompt_or_brief_version: 'brief/v1',
      provenance_verified: true,
      verification_reference: `verification://${project.real_project_id}/round1`,
      verified_by: 'operator-001',
      verified_at: '2026-07-20T12:08:00.000+08:00',
    },
  };
}

function buildRound2Command(
  input: ReturnType<typeof prepareReadyWorkspace>,
  revisedArtifact: { path: string; sha256: string },
): Stage6RevisionBatchCommand {
  const project = input.intake.projects[0];
  const envelope = JSON.parse(fs.readFileSync(path.join(input.root, revisedArtifact.path), 'utf8')) as { payload: ProfessionalTextPackage };
  const revised = structuredClone(envelope.payload);
  revised.full_text = `${revised.full_text}\n第二轮进一步收紧事实边界。`;
  revised.scene_breakdown[0].plot = '人物承担代价后，核验事实并修正表达';
  revised.scene_breakdown[0].key_action = '人物删去未经核验的判断并补上来源说明';
  revised.quality_report.total_score = 82;
  revised.quality_report.dimensions = revised.quality_report.dimensions.map(dimension => ({ ...dimension, score: 82 }));
  const submission = writeJson(input.root, `inputs/${project.real_project_id}-round2-submission.json`, revised);
  const feedback = project.reviewers.map((reviewer, index) => ({
    feedback_id: `round2-feedback-${index + 1}`,
    reviewer_id: reviewer.reviewer_id,
    source: reviewer.role,
    category: index === 0 ? 'pacing' : index === 1 ? 'dialogue_or_narration' : 'fact_and_culture',
    note: `第二轮第${index + 1}类桌读意见`,
    issue_id: `round2-issue-${index + 1}`,
    target_sections: index === 1 ? ['scene_breakdown'] : ['full_text'],
    evidence_required: index === 2,
  }));
  const tableRead = writeJson(input.root, `inputs/${project.real_project_id}-round2-table-read.json`, {
    schema_version: 'story-agent-stage6-table-read-feedback/v1',
    benchmark_id: project.benchmark_id,
    real_project_id: project.real_project_id,
    round_number: 2,
    session_reference: project.table_read.schedule_reference,
    submitted_at: '2026-07-21T12:00:00.000+08:00',
    feedback,
  });
  const cost = writeJson(input.root, `inputs/${project.real_project_id}-round2-cost.json`, {
    schema_version: 'story-agent-stage6-revision-cost/v1',
    benchmark_id: project.benchmark_id,
    real_project_id: project.real_project_id,
    round_number: 2,
    output_id: `output-${project.real_project_id}-round2`,
    provider_or_author: project.creator_authorization.subject_id,
    amount: 100,
    currency: 'CNY',
    usage_reference: `cost://${project.real_project_id}/round2`,
    recorded_at: '2026-07-21T12:05:00.000+08:00',
  });
  return {
    schema_version: 'story-agent-stage6-revision-batch-command/v1',
    command_id: `command-${project.real_project_id}-round2`,
    created_at: '2026-07-21T12:10:00.000+08:00',
    benchmark_id: project.benchmark_id,
    real_project_id: project.real_project_id,
    round_number: 2,
    opt_in_execution_confirmed: true,
    readiness_report: input.reportReference,
    before_package: revisedArtifact,
    revision_submission: submission,
    table_read_feedback: tableRead,
    cost_record: cost,
    declared_changed_sections: ['scene_breakdown', 'full_text'],
    feedback_resolutions: feedback.map(item => ({ feedback_id: item.feedback_id, resolution_note: `已处理 ${item.issue_id}` })),
    provenance: {
      artifact_kind: 'simulation',
      output_id: `output-${project.real_project_id}-round2`,
      model_or_author: project.creator_authorization.subject_id,
      prompt_or_brief_version: 'brief/v2',
      provenance_verified: true,
      verification_reference: `verification://${project.real_project_id}/round2`,
      verified_by: 'operator-001',
      verified_at: '2026-07-21T12:08:00.000+08:00',
    },
  };
}

describe('Stage 6 revision batch executor', () => {
  it('persists an immutable artifact DAG while simulation receives no real revision credit', async () => {
    const workspace = prepareReadyWorkspace();
    const command = buildCommand(workspace);
    const preflight = await preflightStage6RevisionBatch({ command, repoRoot: workspace.root, registry, artifactRoot: 'generated' });
    expect(preflight.status).toBe('ready');
    const result = await executeStage6RevisionBatch({
      command,
      repoRoot: workspace.root,
      registry,
      artifactRoot: 'generated',
      now: '2026-07-20T12:15:00.000+08:00',
    });
    expect(result.status).toBe('completed');
    expect(result.artifacts.map(artifact => artifact.kind)).toEqual([
      'before_package', 'revision_submission', 'table_read_feedback', 'cost_record',
      'revised_package', 'coverage_action_set', 'revision_ledger', 'round_manifest',
    ]);
    expect(result.verified_real_revision_credit).toBe(false);
    expect(result.ledger.summary.fixture_or_simulation_round_count).toBe(1);
    expect(result.ledger.summary.professional_passed).toBe(false);
    const recovered = await executeStage6RevisionBatch({ command, repoRoot: workspace.root, registry, artifactRoot: 'generated' });
    expect(recovered.status).toBe('recovered');
    expect(recovered.attempt_number).toBe(1);
    const revisedArtifact = result.artifacts.find(artifact => artifact.kind === 'revised_package')!;
    const round2 = buildRound2Command(workspace, { path: revisedArtifact.relative_path, sha256: revisedArtifact.sha256 });
    const round2Result = await executeStage6RevisionBatch({ command: round2, repoRoot: workspace.root, registry, artifactRoot: 'generated' });
    expect(round2Result.ledger.rounds).toHaveLength(2);
    expect(round2Result.ledger.summary.completed_verified_round_count).toBe(0);
    expect(round2Result.ledger.summary.stage6_exit_candidate).toBe(false);
  });

  it('records partial failure and resumes as a new immutable attempt', async () => {
    const workspace = prepareReadyWorkspace();
    const command = buildCommand(workspace, 1);
    await expect(executeStage6RevisionBatch({
      command,
      repoRoot: workspace.root,
      registry,
      artifactRoot: 'generated',
      failAfterArtifactKindForTest: 'cost_record',
    })).rejects.toThrow('injected_failure_after:cost_record');
    const retryPreflight = await preflightStage6RevisionBatch({ command, repoRoot: workspace.root, registry, artifactRoot: 'generated' });
    expect(retryPreflight).toMatchObject({ status: 'ready', attempt_number: 2 });
    const result = await executeStage6RevisionBatch({ command, repoRoot: workspace.root, registry, artifactRoot: 'generated' });
    expect(result).toMatchObject({ status: 'completed', attempt_number: 2, verified_real_revision_credit: false });
  });

  it('fails closed when P0 readiness is blocked', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage6-batch-blocked-'));
    roots.push(root);
    const intake = buildStage6RealInputOperatorTemplate(registry);
    writeJson(root, 'inputs/intake.json', intake);
    const report = validateStage6RealInputIntake({ intake, registry, repoRoot: root, sourceIntakePath: 'inputs/intake.json' });
    const reportReference = writeJson(root, 'inputs/readiness.json', report);
    const command = {
      ...buildCommand(prepareReadyWorkspace()),
      readiness_report: reportReference,
      benchmark_id: registry.projects[0].benchmark_id,
      real_project_id: 'blocked-project',
    };
    const preflight = await preflightStage6RevisionBatch({ command, repoRoot: root, registry, artifactRoot: 'generated' });
    expect(preflight.status).toBe('blocked');
    expect(preflight.blockers).toContain('readiness_project_not_ready');
  });

  it('recomputes P0 readiness and rejects a hand-edited ready report', async () => {
    const workspace = prepareReadyWorkspace();
    const command = buildCommand(workspace);
    const reportPath = path.join(workspace.root, workspace.reportReference.path);
    const tampered = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Record<string, unknown>;
    (tampered.global_errors as unknown[]).push({ code: 'manual_override', path: '', message: 'hand edited' });
    command.readiness_report = writeJson(workspace.root, 'inputs/tampered-readiness.json', tampered);
    const preflight = await preflightStage6RevisionBatch({
      command,
      repoRoot: workspace.root,
      registry,
      artifactRoot: 'generated',
    });
    expect(preflight.status).toBe('blocked');
    expect(preflight.blockers).toContain('readiness_report_recomputation_mismatch');
  });
});
