import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { ProfessionalTextPackage, Stage6RealInputIntake } from '@shared/types.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import {
  getStage6RevisionWorkspaceDetail,
  getStage6RevisionWorkspacePortfolio,
  createStage6FeedbackDraft,
  updateStage6FeedbackReview,
} from '../services/stage6-revision-workspace-service.js';
import {
  buildStage6RealInputOperatorTemplate,
  validateStage6RealInputIntake,
} from '../services/professional-multi-round-revision-intake-service.js';
import {
  importProfessionalTableReadFeedback,
  recordProfessionalRevisionRound,
} from '../services/professional-multi-round-revision-service.js';
import type { MultiRoundRevisionSpecRegistry } from '../services/professional-multi-round-revision-execution-service.js';
import type { Stage6RevisionProjectExecutionState } from '../services/professional-multi-round-revision-batch-service.js';
import { createProfessionalTextPackageSkeleton } from '../services/professional-text-package-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(
  repoRoot,
  'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json',
), 'utf8')) as MultiRoundRevisionSpecRegistry;
const tempRoots: string[] = [];

afterAll(() => tempRoots.forEach(root => fs.rmSync(root, { recursive: true, force: true })));

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(root: string, relativePath: string, value: unknown) {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return { relative_path: relativePath, sha256: hash(contents), byte_size: Buffer.byteLength(contents) };
}

function verified(reference: string) {
  return { status: 'verified' as const, reference, verified_by: 'operator-001', verified_at: '2026-07-11T16:00:00.000Z' };
}

function packageFor(videoType: ProfessionalTextPackage['video_type'], projectId: string): ProfessionalTextPackage {
  const pkg = createProfessionalTextPackageSkeleton({ video_type: videoType, project_id: projectId, package_id: `${projectId}-package`, now: '2026-07-11T16:00:00.000Z' });
  pkg.status = 'draft';
  pkg.full_text = `Round 0 ${projectId}`;
  pkg.sequence_beats = [{ beat_id: 'beat-1', order: 1, title: '开场', purpose: '建立命题', visible_action: '人物进入', conflict_discovery_or_instruction: '发现阻力', emotional_or_information_turn: '作出选择', evidence_ids: [] }];
  pkg.scene_breakdown = [{ scene_id: 1, title: '开场', duration_sec: 30, location: '现场', time_of_day: '日', dramatic_function: '建立命题', plot: '人物进入并发现阻力', key_action: '人物作出选择', characters: ['主角'], visual_prompt: '人物进入现场', camera_suggestion: '中景', cultural_note: '待核验', conflict: '选择与代价', dialogue_or_narration: '现在必须选择。' }];
  pkg.delivery_text_package.script_text = pkg.full_text;
  pkg.delivery_text_package.scene_units = [{ scene_id: 1, script_text: '现在必须选择。', visual_action: '人物作出选择', camera_intent: '中景', sound_intent: '同期声', continuity_notes: ['现场'], evidence_boundary_notes: ['待核验'] }];
  pkg.quality_report.total_score = 70;
  pkg.quality_report.dimensions = pkg.quality_report.dimensions.map(item => ({ ...item, score: 70 }));
  return pkg;
}

function prepareWorkspaceWithRound(): { root: string; benchmarkId: string; reviewerId: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage6-workspace-'));
  tempRoots.push(root);
  writeJson(root, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json', registry);
  const intake = buildStage6RealInputOperatorTemplate(registry);
  intake.submitted_at = '2026-07-11T16:00:00.000Z';
  intake.operator = { operator_id: 'operator-001', display_name: 'Operator', contact_reference: 'directory://operator-001' };
  const packages = new Map<string, ProfessionalTextPackage>();
  intake.projects.forEach((project, index) => {
    const projectId = `real-workspace-${index + 1}`;
    const pkg = packageFor(project.video_type, projectId);
    packages.set(project.benchmark_id, pkg);
    const reference = writeJson(root, `inputs/${projectId}.json`, pkg);
    project.provenance = 'operator_submitted_real_input';
    project.real_project_id = projectId;
    project.initial_package = { path: reference.relative_path, sha256: reference.sha256 };
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
  const readiness = validateStage6RealInputIntake({ intake, registry, repoRoot: root, sourceIntakePath: 'inputs/intake.json', now: '2026-07-11T16:00:00.000Z' });
  writeJson(root, 'data/reports/story-agent-stage6-p0-project-readiness.json', readiness);

  const project = intake.projects[0];
  const before = packages.get(project.benchmark_id)!;
  const after = structuredClone(before);
  after.full_text = `${before.full_text}\nRound 1 增加明确代价。`;
  after.scene_breakdown[0].plot = '人物发现阻力并承担代价';
  after.scene_breakdown[0].key_action = '人物交出信物';
  after.quality_report.total_score = 78;
  after.quality_report.dimensions = after.quality_report.dimensions.map(item => ({ ...item, score: 78 }));
  const feedback = importProfessionalTableReadFeedback({
    package: before,
    feedback: [
      { feedback_id: 'feedback-1', source: 'writer_editor', category: 'structure', note: '代价出现太晚', issue_id: 'structure-cost', target_sections: ['full_text'], evidence_required: false },
      { feedback_id: 'feedback-2', source: 'director', category: 'scene', note: '动作需要可见', issue_id: 'scene-action', target_sections: ['scene_breakdown'], evidence_required: false },
      { feedback_id: 'feedback-3', source: 'fact_culture_reviewer', category: 'fact_and_culture', note: '来源待核验', issue_id: 'fact-source', target_sections: ['full_text'], evidence_required: true },
    ],
  });
  const recorded = recordProfessionalRevisionRound({
    before_package: before,
    after_package: after,
    changed_sections: ['full_text', 'scene_breakdown'],
    rebuilt_derived_sections: ['sequence_beats', 'director_text_plan', 'delivery_text_package'],
    table_read_feedback: feedback,
    provenance: { artifact_kind: 'simulation', output_id: 'simulation-output', model_or_author: 'author-1', prompt_or_brief_version: 'brief/v1', provenance_verified: true, cost_recorded: true },
    now: '2026-07-20T12:00:00.000Z',
  });
  const projectDir = path.join('web/generated/stage6-revisions', hash(project.real_project_id).slice(0, 16));
  const envelope = {
    schema_version: 'story-agent-stage6-revision-artifact/v1', artifact_id: 'round1-revised', benchmark_id: project.benchmark_id,
    real_project_id: project.real_project_id, round_number: 1, attempt_number: 1, kind: 'revised_package', created_at: '2026-07-20T12:00:00.000Z',
    producer: 'story_agent', parent_sha256: [], payload_canonical_sha256: hash(JSON.stringify(after)), payload: after, professional_passed: false,
  };
  const artifact = writeJson(root, `${projectDir}/round-1/attempt-1/revised_package.json`, envelope);
  const reference = { artifact_id: 'round1-revised', kind: 'revised_package' as const, relative_path: artifact.relative_path, sha256: artifact.sha256, byte_size: artifact.byte_size, parent_sha256: [] };
  const state: Stage6RevisionProjectExecutionState = {
    schema_version: 'story-agent-stage6-revision-execution-state/v1', benchmark_id: project.benchmark_id, real_project_id: project.real_project_id,
    video_type: project.video_type, attempts: { round_1: [], round_2: [] },
    completed_rounds: [{ round_number: 1, command_id: 'command-round1', before_package_sha256: recorded.ledger.rounds[0].before_package_sha256, after_package_sha256: recorded.ledger.rounds[0].after_package_sha256, round_manifest_artifact: reference, revised_package_artifact: reference, cost_amount: 0, cost_currency: 'CNY', verified_real_revision_credit: false }],
    ledger: recorded.ledger, professional_passed: false,
  };
  writeJson(root, `${projectDir}/execution-state.json`, state);
  return { root, benchmarkId: project.benchmark_id, reviewerId: project.reviewers[0].reviewer_id };
}

describe('Stage 6 revision workspace', () => {
  it('shows the current real repository as 15 blocked projects with no false credit', async () => {
    const portfolio = await getStage6RevisionWorkspacePortfolio({ repoRoot, now: '2026-07-11T16:00:00.000Z' });
    expect(portfolio.summary).toMatchObject({ project_count: 15, blocked_project_count: 15, verified_real_revision_round_count: 0, professional_pass_count: 0 });
    expect(portfolio.projects.every(project => project.evidence_badge === 'blocked' && project.professional_passed === false)).toBe(true);
    const detail = await getStage6RevisionWorkspaceDetail({ repoRoot, benchmarkId: portfolio.projects[0].benchmark_id });
    expect(detail.coverage).toHaveLength(6);
    expect(detail.versions.map(version => version.available)).toEqual([false, false, false]);
    expect(detail.professional_passed).toBe(false);
  });

  it('renders simulation provenance, version diff, quality deltas, derived status, and feedback without real credit', async () => {
    const fixture = prepareWorkspaceWithRound();
    const detail = await getStage6RevisionWorkspaceDetail({ repoRoot: fixture.root, benchmarkId: fixture.benchmarkId });
    expect(detail.project).toMatchObject({ completed_round_count: 1, verified_real_revision_round_count: 0, evidence_badge: 'simulation', professional_passed: false });
    expect(detail.versions.map(version => version.available)).toEqual([true, true, false]);
    expect(detail.text_diffs[0]).toMatchObject({ available: true, added_line_count: 1 });
    expect(detail.versions[1].quality_dimensions.every(item => item.delta_from_previous === 8)).toBe(true);
    expect(detail.feedback).toHaveLength(3);
    expect(detail.derived_rebuilds[0].complete).toBe(true);
  });

  it('assigns, closes, and reopens feedback through an optimistic audited review state', async () => {
    const fixture = prepareWorkspaceWithRound();
    const assigned = await updateStage6FeedbackReview({
      repoRoot: fixture.root, benchmarkId: fixture.benchmarkId, roundNumber: 1, feedbackId: 'feedback-1',
      request: { schema_version: 'story-agent-stage6-feedback-review-update/v1', action: 'assign', expected_state_revision: 0, actor_id: 'operator-001', actor_name: 'Operator', assigned_reviewer_id: fixture.reviewerId },
      now: '2026-07-20T13:00:00.000Z',
    });
    expect(assigned.feedback[0].assigned_reviewer_id).toBe(fixture.reviewerId);
    const closed = await updateStage6FeedbackReview({
      repoRoot: fixture.root, benchmarkId: fixture.benchmarkId, roundNumber: 1, feedbackId: 'feedback-1',
      request: { schema_version: 'story-agent-stage6-feedback-review-update/v1', action: 'close', expected_state_revision: 1, actor_id: 'operator-001', actor_name: 'Operator', resolution_note: '已把代价提前到第一场。' },
    });
    expect(closed.feedback[0]).toMatchObject({ immutable_status: 'open', effective_status: 'closed', reopened: false });
    const reopened = await updateStage6FeedbackReview({
      repoRoot: fixture.root, benchmarkId: fixture.benchmarkId, roundNumber: 1, feedbackId: 'feedback-1',
      request: { schema_version: 'story-agent-stage6-feedback-review-update/v1', action: 'reopen', expected_state_revision: 2, actor_id: 'operator-001', actor_name: 'Operator' },
    });
    expect(reopened.feedback[0]).toMatchObject({ immutable_status: 'open', effective_status: 'open', reopened: true });
    await expect(updateStage6FeedbackReview({
      repoRoot: fixture.root, benchmarkId: fixture.benchmarkId, roundNumber: 1, feedbackId: 'feedback-1',
      request: { schema_version: 'story-agent-stage6-feedback-review-update/v1', action: 'close', expected_state_revision: 1, actor_id: 'operator-001', actor_name: 'Operator', resolution_note: 'stale' },
    })).rejects.toThrow('stage6_feedback_state_revision_conflict');
  });

  it('records feedback intake only as a preparation draft with zero human-table-read credit', async () => {
    const fixture = prepareWorkspaceWithRound();
    const detail = await createStage6FeedbackDraft({
      repoRoot: fixture.root,
      benchmarkId: fixture.benchmarkId,
      request: {
        schema_version: 'story-agent-stage6-feedback-draft-create/v1',
        round_number: 2,
        reviewer_id: fixture.reviewerId,
        category: 'structure',
        note: '第二轮需要进一步压缩开场。',
        issue_id: 'round2-opening-density',
        target_sections: ['full_text'],
        evidence_required: false,
        actor_id: 'operator-001',
        actor_name: 'Operator',
      },
      now: '2026-07-20T14:00:00.000Z',
    });
    expect(detail.feedback_drafts[0]).toMatchObject({
      provenance: 'preparation_draft',
      counts_as_human_table_read: false,
    });
    expect(detail.project.verified_real_revision_round_count).toBe(0);
  });

  it('registers portfolio, detail, and feedback mutation routes', () => {
    const router = createStage6RevisionsRouter(repoRoot);
    const routes = router.stack
      .filter(layer => layer.route)
      .map(layer => {
        const route = layer.route as unknown as { path: string; methods: Record<string, boolean> };
        return { path: route.path, methods: route.methods };
      });
    expect(routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/', methods: expect.objectContaining({ get: true }) }),
      expect.objectContaining({ path: '/exit-audit', methods: expect.objectContaining({ get: true }) }),
      expect.objectContaining({ path: '/:benchmarkId', methods: expect.objectContaining({ get: true }) }),
      expect.objectContaining({ path: '/:benchmarkId/rounds/:roundNumber/feedback/:feedbackId', methods: expect.objectContaining({ patch: true }) }),
      expect.objectContaining({ path: '/:benchmarkId/feedback-drafts', methods: expect.objectContaining({ post: true }) }),
    ]));
  });
});
