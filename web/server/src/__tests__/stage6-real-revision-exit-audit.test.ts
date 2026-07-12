import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import {
  buildStage6RealRevisionExitAudit,
  validateStage6RealRevisionExitAudit,
} from '../services/stage6-real-revision-exit-audit-service.js';
import {
  buildStage6RealInputOperatorTemplate,
  validateStage6RealInputIntake,
} from '../services/professional-multi-round-revision-intake-service.js';
import type { MultiRoundRevisionSpecRegistry } from '../services/professional-multi-round-revision-execution-service.js';
import type { Stage6RevisionProjectExecutionState } from '../services/professional-multi-round-revision-batch-service.js';
import type { ProfessionalMultiRoundRevisionLedger } from '../services/professional-multi-round-revision-service.js';
import { createProfessionalTextPackageSkeleton } from '../services/professional-text-package-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(
  repoRoot,
  'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json',
), 'utf8')) as MultiRoundRevisionSpecRegistry;
const tempRoots: string[] = [];

afterAll(() => tempRoots.forEach(root => fs.rmSync(root, { recursive: true, force: true })));

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(root: string, relativePath: string, value: unknown): { path: string; sha256: string } {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return { path: relativePath, sha256: sha256(contents) };
}

function verified(reference: string) {
  return { status: 'verified' as const, reference, verified_by: 'operator-001', verified_at: '2026-07-12T08:00:00.000Z' };
}

function revisionablePackage(videoType: ProfessionalTextPackage['video_type'], projectId: string): ProfessionalTextPackage {
  const pkg = createProfessionalTextPackageSkeleton({ video_type: videoType, project_id: projectId, package_id: `${projectId}-package`, now: '2026-07-12T08:00:00.000Z' });
  pkg.status = 'draft';
  pkg.full_text = `真实初稿 ${projectId}`;
  pkg.sequence_beats = [{ beat_id: 'beat-1', order: 1, title: '开场', purpose: '建立命题', visible_action: '人物进入', conflict_discovery_or_instruction: '发现阻力', emotional_or_information_turn: '作出选择', evidence_ids: [] }];
  pkg.scene_breakdown = [{ scene_id: 1, title: '开场', duration_sec: 30, location: '现场', time_of_day: '日', dramatic_function: '建立命题', plot: '人物进入并发现阻力', key_action: '人物作出选择', characters: ['主角'], visual_prompt: '人物进入现场', camera_suggestion: '中景', cultural_note: '待核验' }];
  pkg.delivery_text_package.script_text = pkg.full_text;
  pkg.delivery_text_package.scene_units = [{ scene_id: 1, script_text: pkg.full_text, visual_action: '人物作出选择', camera_intent: '中景', sound_intent: '同期声', continuity_notes: ['现场'], evidence_boundary_notes: ['待核验'] }];
  pkg.quality_report.total_score = 70;
  pkg.quality_report.dimensions = pkg.quality_report.dimensions.map(item => ({ ...item, score: 70 }));
  return pkg;
}

function prepareReadyWorkspace(): { root: string; projectId: string; benchmarkId: string; videoType: ProfessionalTextPackage['video_type']; packageId: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage6-exit-audit-'));
  tempRoots.push(root);
  writeJson(root, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json', registry);
  const intake = buildStage6RealInputOperatorTemplate(registry);
  intake.submitted_at = '2026-07-12T08:00:00.000Z';
  intake.operator = { operator_id: 'operator-001', display_name: 'Operator', contact_reference: 'directory://operator-001' };
  intake.projects.forEach((project, index) => {
    const projectId = `real-audit-${index + 1}`;
    const pkg = revisionablePackage(project.video_type, projectId);
    project.provenance = 'operator_submitted_real_input';
    project.real_project_id = projectId;
    project.initial_package = writeJson(root, `inputs/${projectId}.json`, pkg);
    project.creator_authorization = { subject_type: 'human_author', subject_id: `author-${index + 1}`, authorized_rounds: [1, 2], verification: verified(`authorization://${projectId}`) };
    project.revision_budget = { currency: 'CNY', amount: 1000, authorized_rounds: [1, 2], verification: verified(`budget://${projectId}`) };
    project.reviewers = [
      { role: 'writer_editor', reviewer_id: `writer-${index + 1}`, display_name: `Writer ${index + 1}`, identity_verification: verified(`identity://writer-${index + 1}`) },
      { role: 'director', reviewer_id: `director-${index + 1}`, display_name: `Director ${index + 1}`, identity_verification: verified(`identity://director-${index + 1}`) },
      { role: 'fact_culture_reviewer', reviewer_id: `fact-${index + 1}`, display_name: `Fact ${index + 1}`, identity_verification: verified(`identity://fact-${index + 1}`) },
    ];
    project.table_read = { schedule_reference: `meeting://${projectId}`, scheduled_at: '2026-07-20T10:00:00.000+08:00', timezone: 'Asia/Shanghai', participant_reviewer_ids: project.reviewers.map(item => item.reviewer_id), verification: verified(`schedule://${projectId}`) };
  });
  writeJson(root, 'inputs/intake.json', intake);
  const readiness = validateStage6RealInputIntake({ intake, registry, repoRoot: root, sourceIntakePath: 'inputs/intake.json', now: '2026-07-12T08:00:00.000Z' });
  writeJson(root, 'data/reports/story-agent-stage6-p0-project-readiness.json', readiness);
  const first = intake.projects[0];
  return { root, projectId: first.real_project_id, benchmarkId: first.benchmark_id, videoType: first.video_type, packageId: `${first.real_project_id}-package` };
}

function simulationLedger(input: { projectId: string; videoType: ProfessionalTextPackage['video_type']; packageId: string }): ProfessionalMultiRoundRevisionLedger {
  const feedback = ['writer_editor', 'director', 'fact_culture_reviewer'] as const;
  const rounds = [1, 2].map(roundNumber => ({
    round_id: `revision-round-${roundNumber}`,
    round_number: roundNumber,
    created_at: `2026-07-2${roundNumber}T08:00:00.000Z`,
    before_package_sha256: String(roundNumber).repeat(64),
    after_package_sha256: String(roundNumber + 1).repeat(64),
    before_quality_score: 70 + roundNumber * 5 - 5,
    after_quality_score: 70 + roundNumber * 5,
    quality_delta: 5,
    changed_sections: ['full_text'] as ProfessionalTextPackageField[],
    required_derived_rebuild_sections: ['scene_breakdown', 'sequence_beats', 'director_text_plan', 'delivery_text_package'] as ProfessionalTextPackageField[],
    rebuilt_derived_sections: ['scene_breakdown', 'sequence_beats', 'director_text_plan', 'delivery_text_package'] as ProfessionalTextPackageField[],
    resolved_issue_ids: [],
    new_issue_ids: [],
    remaining_issue_ids: [],
    table_read_feedback: feedback.map((source, index) => ({ feedback_id: `r${roundNumber}-f${index + 1}`, source, category: index === 0 ? 'structure' as const : index === 1 ? 'scene' as const : 'fact_and_culture' as const, note: 'fixture feedback', issue_id: `issue-${index + 1}`, target_sections: ['full_text'] as ProfessionalTextPackageField[], evidence_required: false, status: 'closed' as const, resolution_note: 'fixture resolution' })),
    provenance: { artifact_kind: 'simulation' as const, output_id: `simulation-${roundNumber}`, model_or_author: 'author-1', prompt_or_brief_version: 'brief/v1', provenance_verified: true, cost_recorded: true },
    quality_improvement_traceable: true,
    verified_real_revision_credit: false,
    professional_passed: false as const,
  }));
  return {
    schema_version: 'professional-multi-round-revision-ledger/v1',
    ledger_id: `${input.projectId}--ledger`,
    package_id: input.packageId,
    project_id: input.projectId,
    video_type: input.videoType,
    required_round_count: 2,
    rounds,
    summary: { recorded_round_count: 2, completed_verified_round_count: 0, traceable_quality_improvement_round_count: 2, total_quality_delta: 10, open_table_read_feedback_count: 0, closed_table_read_feedback_count: 6, fixture_or_simulation_round_count: 2, stage6_exit_candidate: false, professional_passed: false },
  };
}

describe('Stage 6 real revision exit audit', () => {
  it('reports the current 15 projects as blocked with zero revision or professional credit', async () => {
    const report = await buildStage6RealRevisionExitAudit({ repoRoot, now: '2026-07-12T08:00:00.000Z' });
    expect(report.summary).toEqual({ project_count: 15, blocked_project_count: 15, eligible_for_stage6_exit_review_project_count: 0, recorded_round_count: 0, verified_real_revision_round_count: 0, effective_open_feedback_count: 0, professional_pass_count: 0 });
    expect(report.projects.every(project => project.status === 'blocked' && project.professional_passed === false)).toBe(true);
    expect(validateStage6RealRevisionExitAudit(report)).toEqual([]);
  });

  it('keeps P0-ready projects blocked until a P1 execution state exists', async () => {
    const workspace = prepareReadyWorkspace();
    const report = await buildStage6RealRevisionExitAudit({ repoRoot: workspace.root });
    const project = report.projects.find(item => item.benchmark_id === workspace.benchmarkId)!;
    expect(project.checks.p0_readiness_reverified).toBe(true);
    expect(project.blockers.map(item => item.code)).toContain('revision_execution_state_missing');
    expect(project.stage6_exit_candidate).toBe(false);
  });

  it('rejects two simulation rounds and missing immutable artifacts without granting real credit', async () => {
    const workspace = prepareReadyWorkspace();
    const ledger = simulationLedger(workspace);
    const state: Stage6RevisionProjectExecutionState = {
      schema_version: 'story-agent-stage6-revision-execution-state/v1',
      benchmark_id: workspace.benchmarkId,
      real_project_id: workspace.projectId,
      video_type: workspace.videoType,
      attempts: { round_1: [], round_2: [] },
      completed_rounds: [1, 2].map(roundNumber => ({
        round_number: roundNumber as 1 | 2,
        command_id: `simulation-command-${roundNumber}`,
        before_package_sha256: ledger.rounds[roundNumber - 1].before_package_sha256,
        after_package_sha256: ledger.rounds[roundNumber - 1].after_package_sha256,
        round_manifest_artifact: { artifact_id: 'missing', kind: 'round_manifest', relative_path: 'missing', sha256: 'a'.repeat(64), byte_size: 1, parent_sha256: [] },
        revised_package_artifact: { artifact_id: 'missing', kind: 'revised_package', relative_path: 'missing', sha256: 'b'.repeat(64), byte_size: 1, parent_sha256: [] },
        cost_amount: 0,
        cost_currency: 'CNY',
        verified_real_revision_credit: false,
      })),
      ledger,
      professional_passed: false,
    };
    writeJson(workspace.root, `web/generated/stage6-revisions/${sha256(workspace.projectId).slice(0, 16)}/execution-state.json`, state);
    const report = await buildStage6RealRevisionExitAudit({ repoRoot: workspace.root });
    const project = report.projects.find(item => item.benchmark_id === workspace.benchmarkId)!;
    expect(project.checks.two_rounds_completed).toBe(true);
    expect(project.checks.two_rounds_real_provenance_verified).toBe(false);
    expect(project.blockers.map(item => item.code)).toEqual(expect.arrayContaining(['round_real_provenance_not_verified', 'completed_attempt_missing']));
    expect(project.verified_real_revision_round_count).toBe(0);
    expect(project.professional_passed).toBe(false);
  });

  it('detects any attempt to turn an eligible label into professional credit', async () => {
    const report = await buildStage6RealRevisionExitAudit({ repoRoot });
    report.projects[0].professional_passed = true as false;
    expect(validateStage6RealRevisionExitAudit(report)).toContain('false_professional_pass_credit');
  });
});
