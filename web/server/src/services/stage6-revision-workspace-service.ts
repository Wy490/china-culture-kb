import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ProfessionalTextPackageSchema, Stage6RealInputIntakeSchema, Stage6RealInputReadinessReportSchema } from '@shared/schemas.js';
import type {
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  Stage6FeedbackDraftCreateRequest,
  Stage6EvidenceBadge,
  Stage6FeedbackReviewUpdateRequest,
  Stage6RealInputIntake,
  Stage6RealInputReadinessReport,
  Stage6RevisionWorkspaceDetail,
  Stage6RevisionWorkspaceFeedbackItem,
  Stage6RevisionWorkspacePortfolio,
  Stage6RevisionWorkspaceProjectSummary,
  Stage6RevisionWorkspaceVersion,
} from '@shared/types.js';
import type {
  Stage6RevisionArtifactReference,
  Stage6RevisionProjectExecutionState,
} from './professional-multi-round-revision-batch-service.js';
import {
  buildProfessionalCoverageActionSet,
  professionalPackageSha256,
  type ProfessionalCoverageCategory,
  type ProfessionalTableReadFeedback,
} from './professional-multi-round-revision-service.js';
import type { MultiRoundRevisionSpecRegistry } from './professional-multi-round-revision-execution-service.js';
import {
  stage6CanonicalSha256,
  validateStage6RealInputIntake,
} from './professional-multi-round-revision-intake-service.js';

const CATEGORY_LABELS: Record<ProfessionalCoverageCategory, string> = {
  structure: '结构与因果',
  character_or_information: '人物 / 信息',
  scene: '场景与行动',
  dialogue_or_narration: '对白 / 旁白',
  pacing: '节奏与情绪',
  fact_and_culture: '事实与文化',
};

const QUALITY_LABELS: Record<ProfessionalQualityDimensionId, string> = {
  creative_brief_and_audience_promise: '简报与受众承诺',
  premise_and_theme_unity: '命题与主题统一',
  structure_causality_and_pacing: '结构、因果与节奏',
  character_agency_and_relationship_change: '人物能动性与关系变化',
  scene_function_visible_action_and_blocking: '场景功能与可见行动',
  dialogue_narration_and_subtext: '对白、旁白与潜台词',
  emotional_curve_and_aftertaste: '情绪曲线与余味',
  cultural_fact_and_adaptation_boundary: '事实与改编边界',
  production_executability: '生产可执行性',
  originality_and_distinctiveness: '原创性与辨识度',
};

interface FeedbackReviewState {
  schema_version: 'story-agent-stage6-feedback-review-state/v1';
  benchmark_id: string;
  real_project_id: string;
  revision: number;
  feedback: Record<string, {
    effective_status: 'open' | 'closed';
    assigned_reviewer_id: string;
    resolution_note: string;
    reopened: boolean;
  }>;
  audit_log: Array<{
    audit_id: string;
    feedback_key: string;
    action: 'assign' | 'close' | 'reopen';
    actor_id: string;
    actor_name: string;
    created_at: string;
    state_revision: number;
  }>;
}

interface FeedbackDraftState {
  schema_version: 'story-agent-stage6-feedback-draft-state/v1';
  benchmark_id: string;
  revision: number;
  drafts: Stage6RevisionWorkspaceDetail['feedback_drafts'];
}

interface WorkspaceSources {
  registry: MultiRoundRevisionSpecRegistry;
  readiness: Stage6RealInputReadinessReport;
  intake: Stage6RealInputIntake;
}

interface LoadedProject {
  summary: Stage6RevisionWorkspaceProjectSummary;
  readinessProject: Stage6RealInputReadinessReport['projects'][number];
  intakeProject?: Stage6RealInputIntake['projects'][number];
  state: Stage6RevisionProjectExecutionState | null;
  reviewState: FeedbackReviewState;
  draftState: FeedbackDraftState;
  versions: Array<{ round: 0 | 1 | 2; package: ProfessionalTextPackage; badge: Stage6EvidenceBadge }>;
}

function hashText(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function readJsonInside(repoRoot: string, relativePath: string): Promise<unknown> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  if (!inside(realRoot, resolved)) throw new Error('workspace_source_outside_repository');
  return JSON.parse(await readFile(resolved, 'utf8')) as unknown;
}

async function loadSources(repoRoot: string): Promise<WorkspaceSources> {
  const registryResult = await readJsonInside(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json');
  const readinessResult = Stage6RealInputReadinessReportSchema.safeParse(
    await readJsonInside(repoRoot, 'data/reports/story-agent-stage6-p0-project-readiness.json'),
  );
  if (!readinessResult.success) throw new Error('stage6_workspace_readiness_invalid');
  const readiness = readinessResult.data;
  const intakeResult = Stage6RealInputIntakeSchema.safeParse(await readJsonInside(repoRoot, readiness.source_intake_path));
  if (!intakeResult.success) throw new Error('stage6_workspace_intake_invalid');
  const registry = registryResult as MultiRoundRevisionSpecRegistry;
  if (registry.schema_version !== 'all-format-professional-multi-round-revision-specs/v1' || registry.projects.length !== 15) {
    throw new Error('stage6_workspace_registry_invalid');
  }
  if (stage6CanonicalSha256(registry) !== readiness.source_registry_canonical_sha256
    || stage6CanonicalSha256(intakeResult.data) !== readiness.source_intake_canonical_sha256) {
    throw new Error('stage6_workspace_source_hash_mismatch');
  }
  const recomputed = validateStage6RealInputIntake({
    intake: intakeResult.data,
    registry,
    repoRoot,
    sourceIntakePath: readiness.source_intake_path,
    now: readiness.generated_at,
  });
  if (stage6CanonicalSha256(recomputed) !== stage6CanonicalSha256(readiness)) {
    throw new Error('stage6_workspace_readiness_recomputation_mismatch');
  }
  return { registry, readiness, intake: intakeResult.data };
}

function executionProjectRoot(repoRoot: string, realProjectId: string): string {
  return path.join(repoRoot, 'web/generated/stage6-revisions', hashText(realProjectId).slice(0, 16));
}

function workspaceProjectRoot(repoRoot: string, benchmarkId: string): string {
  return path.join(repoRoot, 'web/generated/stage6-revision-workspace', hashText(benchmarkId).slice(0, 16));
}

async function loadExecutionState(repoRoot: string, realProjectId: string): Promise<Stage6RevisionProjectExecutionState | null> {
  if (!realProjectId.trim()) return null;
  try {
    const parsed = JSON.parse(await readFile(path.join(executionProjectRoot(repoRoot, realProjectId), 'execution-state.json'), 'utf8')) as Stage6RevisionProjectExecutionState;
    if (parsed.schema_version !== 'story-agent-stage6-revision-execution-state/v1'
      || parsed.real_project_id !== realProjectId
      || parsed.professional_passed !== false) throw new Error('stage6_workspace_execution_state_invalid');
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function emptyReviewState(benchmarkId: string, realProjectId: string): FeedbackReviewState {
  return {
    schema_version: 'story-agent-stage6-feedback-review-state/v1',
    benchmark_id: benchmarkId,
    real_project_id: realProjectId,
    revision: 0,
    feedback: {},
    audit_log: [],
  };
}

async function loadReviewState(repoRoot: string, benchmarkId: string, realProjectId: string): Promise<FeedbackReviewState> {
  if (!realProjectId.trim()) return emptyReviewState(benchmarkId, realProjectId);
  try {
    const parsed = JSON.parse(await readFile(path.join(executionProjectRoot(repoRoot, realProjectId), 'feedback-review-state.json'), 'utf8')) as FeedbackReviewState;
    if (parsed.schema_version !== 'story-agent-stage6-feedback-review-state/v1'
      || parsed.benchmark_id !== benchmarkId
      || parsed.real_project_id !== realProjectId
      || !Number.isInteger(parsed.revision)
      || parsed.revision < 0) throw new Error('stage6_feedback_review_state_invalid');
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyReviewState(benchmarkId, realProjectId);
    throw error;
  }
}

async function loadDraftState(repoRoot: string, benchmarkId: string): Promise<FeedbackDraftState> {
  try {
    const parsed = JSON.parse(await readFile(path.join(workspaceProjectRoot(repoRoot, benchmarkId), 'feedback-drafts.json'), 'utf8')) as FeedbackDraftState;
    if (parsed.schema_version !== 'story-agent-stage6-feedback-draft-state/v1'
      || parsed.benchmark_id !== benchmarkId
      || !Number.isInteger(parsed.revision)
      || parsed.revision < 0
      || !Array.isArray(parsed.drafts)) throw new Error('stage6_feedback_draft_state_invalid');
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { schema_version: 'story-agent-stage6-feedback-draft-state/v1', benchmark_id: benchmarkId, revision: 0, drafts: [] };
    }
    throw error;
  }
}

async function loadInitialPackage(repoRoot: string, intakeProject?: Stage6RealInputIntake['projects'][number]): Promise<ProfessionalTextPackage | null> {
  if (!intakeProject?.initial_package.path) return null;
  try {
    const realRoot = await realpath(repoRoot);
    const resolved = await realpath(path.resolve(realRoot, intakeProject.initial_package.path));
    if (!inside(realRoot, resolved)) return null;
    const bytes = await readFile(resolved);
    if (hashText(bytes) !== intakeProject.initial_package.sha256) return null;
    const result = ProfessionalTextPackageSchema.safeParse(JSON.parse(bytes.toString('utf8')));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function loadPackageArtifact(repoRoot: string, reference: Stage6RevisionArtifactReference): Promise<ProfessionalTextPackage | null> {
  try {
    const realRoot = await realpath(repoRoot);
    const resolved = await realpath(path.resolve(realRoot, reference.relative_path));
    if (!inside(realRoot, resolved)) return null;
    const bytes = await readFile(resolved);
    if (hashText(bytes) !== reference.sha256) return null;
    const envelope = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    if (envelope.schema_version !== 'story-agent-stage6-revision-artifact/v1' || envelope.kind !== 'revised_package') return null;
    const result = ProfessionalTextPackageSchema.safeParse(envelope.payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function badgeForRound(state: Stage6RevisionProjectExecutionState, roundNumber: 1 | 2): Stage6EvidenceBadge {
  const round = state.ledger?.rounds[roundNumber - 1];
  if (!round) return 'prepared';
  if (round.provenance.artifact_kind === 'simulation') return 'simulation';
  if (round.provenance.artifact_kind === 'fixture') return 'fixture';
  if (!round.verified_real_revision_credit) return 'prepared';
  return round.provenance.artifact_kind === 'real_model' ? 'real_model_verified' : 'human_authored_verified';
}

function feedbackKey(roundNumber: number, feedbackId: string): string {
  return `${roundNumber}:${feedbackId}`;
}

function effectiveFeedback(
  state: Stage6RevisionProjectExecutionState | null,
  reviewState: FeedbackReviewState,
): Stage6RevisionWorkspaceFeedbackItem[] {
  if (!state?.ledger) return [];
  return state.ledger.rounds.flatMap(round => round.table_read_feedback.map(item => {
    const override = reviewState.feedback[feedbackKey(round.round_number, item.feedback_id)];
    return {
      feedback_id: item.feedback_id,
      round_number: round.round_number as 1 | 2,
      source: item.source,
      category: item.category,
      note: item.note,
      issue_id: item.issue_id,
      target_sections: item.target_sections,
      evidence_required: item.evidence_required,
      immutable_status: item.status,
      effective_status: override?.effective_status ?? item.status,
      assigned_reviewer_id: override?.assigned_reviewer_id ?? '',
      resolution_note: override?.resolution_note ?? item.resolution_note,
      reopened: override?.reopened ?? false,
    };
  }));
}

async function loadProject(repoRoot: string, sources: WorkspaceSources, benchmarkId: string): Promise<LoadedProject> {
  const readinessProject = sources.readiness.projects.find(project => project.benchmark_id === benchmarkId);
  if (!readinessProject) throw new Error('stage6_workspace_project_not_found');
  const intakeProject = sources.intake.projects.find(project => project.benchmark_id === benchmarkId);
  const state = await loadExecutionState(repoRoot, readinessProject.real_project_id);
  const reviewState = await loadReviewState(repoRoot, benchmarkId, readinessProject.real_project_id);
  const draftState = await loadDraftState(repoRoot, benchmarkId);
  const versions: LoadedProject['versions'] = [];
  const initialPackage = await loadInitialPackage(repoRoot, intakeProject);
  if (initialPackage) versions.push({ round: 0, package: initialPackage, badge: 'prepared' });
  if (state) {
    for (const completed of state.completed_rounds) {
      const pkg = await loadPackageArtifact(repoRoot, completed.revised_package_artifact);
      if (pkg) versions.push({ round: completed.round_number, package: pkg, badge: badgeForRound(state, completed.round_number) });
    }
  }
  const feedback = effectiveFeedback(state, reviewState);
  const verifiedRounds = state?.ledger?.summary.completed_verified_round_count ?? 0;
  const completedRounds = state?.completed_rounds.length ?? 0;
  const openFeedback = feedback.filter(item => item.effective_status === 'open').length;
  const immutableExit = state?.ledger?.summary.stage6_exit_candidate ?? false;
  const latestBadge = versions.at(-1)?.badge ?? (readinessProject.status === 'ready' ? 'prepared' : 'blocked');
  const summary: Stage6RevisionWorkspaceProjectSummary = {
    benchmark_id: benchmarkId,
    video_type: readinessProject.video_type,
    source_entry: readinessProject.source_entry,
    real_project_id: readinessProject.real_project_id,
    readiness_status: readinessProject.status,
    execution_status: readinessProject.status === 'blocked'
      ? 'blocked'
      : completedRounds >= 2
        ? 'two_rounds_completed'
        : completedRounds === 1
          ? 'round_1_completed'
          : 'awaiting_round_1',
    completed_round_count: completedRounds,
    verified_real_revision_round_count: verifiedRounds,
    open_feedback_count: openFeedback,
    evidence_badge: latestBadge,
    stage6_exit_candidate: immutableExit && openFeedback === 0 && verifiedRounds >= 2,
    professional_passed: false,
    blockers: readinessProject.blockers.map(blocker => blocker.code),
  };
  return { summary, readinessProject, intakeProject, state, reviewState, draftState, versions };
}

function workspaceVersion(
  targetRound: 0 | 1 | 2,
  loaded: LoadedProject['versions'][number] | undefined,
  previous?: LoadedProject['versions'][number],
): Stage6RevisionWorkspaceVersion {
  const round = loaded?.round ?? targetRound;
  if (!loaded) {
    return {
      round_number: round,
      label: `Round ${round}`,
      available: false,
      package_sha256: '',
      full_text: '',
      scene_count: 0,
      quality_dimensions: [],
      hard_gate_failures: [],
      evidence_badge: 'blocked',
      professional_passed: false,
    };
  }
  const previousScores = new Map(previous?.package.quality_report.dimensions.map(item => [item.dimension_id, item.score]));
  return {
    round_number: loaded.round,
    label: loaded.round === 0 ? 'Round 0 初稿' : `Round ${loaded.round} 修订稿`,
    available: true,
    package_sha256: professionalPackageSha256(loaded.package),
    full_text: loaded.package.full_text,
    scene_count: loaded.package.scene_breakdown.length,
    total_score: loaded.package.quality_report.total_score,
    quality_dimensions: loaded.package.quality_report.dimensions.map(item => ({
      dimension_id: item.dimension_id,
      label: QUALITY_LABELS[item.dimension_id],
      score: item.score,
      delta_from_previous: item.score !== undefined && previousScores.get(item.dimension_id) !== undefined
        ? item.score - (previousScores.get(item.dimension_id) ?? 0)
        : undefined,
    })),
    hard_gate_failures: [...loaded.package.quality_report.hard_gate_failures],
    evidence_badge: loaded.badge,
    professional_passed: false,
  };
}

function lineDiff(left: string, right: string): Array<{ type: 'same' | 'added' | 'removed'; text: string }> {
  const a = left.split(/\r?\n/).slice(0, 400);
  const b = right.split(/\r?\n/).slice(0, 400);
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ type: 'same', text: a[i] }); i += 1; j += 1;
    } else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({ type: 'added', text: b[j] }); j += 1;
    } else {
      result.push({ type: 'removed', text: a[i] }); i += 1;
    }
  }
  return result;
}

export async function getStage6RevisionWorkspacePortfolio(input: {
  repoRoot: string;
  now?: string;
}): Promise<Stage6RevisionWorkspacePortfolio> {
  const sources = await loadSources(input.repoRoot);
  const projects = await Promise.all(sources.registry.projects.map(project => loadProject(input.repoRoot, sources, project.benchmark_id).then(item => item.summary)));
  return {
    schema_version: 'story-agent-stage6-revision-workspace-portfolio/v1',
    generated_at: input.now ?? new Date().toISOString(),
    policy: {
      machine_candidate_is_professional_pass: false,
      readiness_is_revision_completion: false,
      simulation_fixture_fallback_is_real_evidence: false,
    },
    summary: {
      project_count: projects.length,
      blocked_project_count: projects.filter(project => project.readiness_status === 'blocked').length,
      ready_project_count: projects.filter(project => project.readiness_status === 'ready').length,
      completed_revision_round_count: projects.reduce((sum, project) => sum + project.completed_round_count, 0),
      verified_real_revision_round_count: projects.reduce((sum, project) => sum + project.verified_real_revision_round_count, 0),
      professional_pass_count: 0,
    },
    projects,
  };
}

export async function getStage6RevisionWorkspaceDetail(input: {
  repoRoot: string;
  benchmarkId: string;
  now?: string;
}): Promise<Stage6RevisionWorkspaceDetail> {
  const sources = await loadSources(input.repoRoot);
  const loaded = await loadProject(input.repoRoot, sources, input.benchmarkId);
  const byRound = new Map(loaded.versions.map(version => [version.round, version]));
  const versions = ([0, 1, 2] as const).map(round => workspaceVersion(
    round,
    byRound.get(round),
    round > 0 ? byRound.get((round - 1) as 0 | 1) : undefined,
  ));
  const latest = loaded.versions.at(-1);
  const coverageSet = latest ? buildProfessionalCoverageActionSet({ package: latest.package, now: input.now }) : null;
  const coverage = (Object.keys(CATEGORY_LABELS) as ProfessionalCoverageCategory[]).map(category => {
    const item = coverageSet?.categories.find(candidate => candidate.category === category);
    return {
      category,
      label: CATEGORY_LABELS[category],
      notes: item?.notes ?? [],
      action_items: item?.action_items ?? [],
      issue_ids: item?.hard_gate_issue_ids ?? [],
    };
  });
  const diffs = [[0, 1], [1, 2]] as const;
  const textDiffs = diffs.map(([from, to]) => {
    const left = byRound.get(from);
    const right = byRound.get(to);
    const hunks = left && right ? lineDiff(left.package.full_text, right.package.full_text) : [];
    return {
      from_round: from,
      to_round: to,
      available: Boolean(left && right),
      added_line_count: hunks.filter(item => item.type === 'added').length,
      removed_line_count: hunks.filter(item => item.type === 'removed').length,
      hunks,
    };
  });
  const feedback = effectiveFeedback(loaded.state, loaded.reviewState);
  const derivedRebuilds = loaded.state?.ledger?.rounds.map(round => ({
    round_number: round.round_number as 1 | 2,
    required_sections: round.required_derived_rebuild_sections,
    rebuilt_sections: round.rebuilt_derived_sections,
    complete: round.required_derived_rebuild_sections.every(section => round.rebuilt_derived_sections.includes(section)),
  })) ?? [];
  return {
    schema_version: 'story-agent-stage6-revision-workspace-detail/v1',
    generated_at: input.now ?? new Date().toISOString(),
    project: loaded.summary,
    coverage,
    versions,
    text_diffs: textDiffs,
    feedback,
    reviewers: loaded.intakeProject?.reviewers.map(reviewer => ({
      role: reviewer.role,
      reviewer_id: reviewer.reviewer_id,
      display_name: reviewer.display_name,
      identity_verified: reviewer.identity_verification.status === 'verified',
    })) ?? [],
    feedback_drafts: loaded.draftState.drafts,
    derived_rebuilds: derivedRebuilds,
    effective_stage6_exit_candidate: loaded.summary.stage6_exit_candidate,
    review_state_revision: loaded.reviewState.revision,
    professional_passed: false,
  };
}

async function atomicWrite(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, filePath);
}

export async function updateStage6FeedbackReview(input: {
  repoRoot: string;
  benchmarkId: string;
  roundNumber: 1 | 2;
  feedbackId: string;
  request: Stage6FeedbackReviewUpdateRequest;
  now?: string;
}): Promise<Stage6RevisionWorkspaceDetail> {
  const sources = await loadSources(input.repoRoot);
  const loaded = await loadProject(input.repoRoot, sources, input.benchmarkId);
  if (!loaded.state?.ledger || !loaded.summary.real_project_id) throw new Error('stage6_feedback_project_has_no_revision_ledger');
  const round = loaded.state.ledger.rounds[input.roundNumber - 1];
  const immutable = round?.table_read_feedback.find(item => item.feedback_id === input.feedbackId);
  if (!immutable) throw new Error('stage6_feedback_not_found');
  if (loaded.reviewState.revision !== input.request.expected_state_revision) throw new Error('stage6_feedback_state_revision_conflict');
  const key = feedbackKey(input.roundNumber, input.feedbackId);
  const current = loaded.reviewState.feedback[key] ?? {
    effective_status: immutable.status,
    assigned_reviewer_id: '',
    resolution_note: immutable.resolution_note,
    reopened: false,
  };
  if (input.request.action === 'assign') {
    const allowedReviewerIds = new Set(loaded.intakeProject?.reviewers.map(reviewer => reviewer.reviewer_id) ?? []);
    if (!input.request.assigned_reviewer_id || !allowedReviewerIds.has(input.request.assigned_reviewer_id)) {
      throw new Error('stage6_feedback_assignee_not_verified_reviewer');
    }
    current.assigned_reviewer_id = input.request.assigned_reviewer_id;
  } else if (input.request.action === 'close') {
    if (!input.request.resolution_note?.trim()) throw new Error('stage6_feedback_resolution_required');
    current.effective_status = 'closed';
    current.resolution_note = input.request.resolution_note.trim();
    current.reopened = false;
  } else {
    current.effective_status = 'open';
    current.resolution_note = '';
    current.reopened = true;
  }
  loaded.reviewState.revision += 1;
  loaded.reviewState.feedback[key] = current;
  loaded.reviewState.audit_log.push({
    audit_id: `feedback-audit-${loaded.reviewState.revision}`,
    feedback_key: key,
    action: input.request.action,
    actor_id: input.request.actor_id,
    actor_name: input.request.actor_name,
    created_at: input.now ?? new Date().toISOString(),
    state_revision: loaded.reviewState.revision,
  });
  await atomicWrite(
    path.join(executionProjectRoot(input.repoRoot, loaded.summary.real_project_id), 'feedback-review-state.json'),
    loaded.reviewState,
  );
  return getStage6RevisionWorkspaceDetail({ repoRoot: input.repoRoot, benchmarkId: input.benchmarkId, now: input.now });
}

export async function createStage6FeedbackDraft(input: {
  repoRoot: string;
  benchmarkId: string;
  request: Stage6FeedbackDraftCreateRequest;
  now?: string;
}): Promise<Stage6RevisionWorkspaceDetail> {
  const sources = await loadSources(input.repoRoot);
  const loaded = await loadProject(input.repoRoot, sources, input.benchmarkId);
  const reviewer = loaded.intakeProject?.reviewers.find(item => item.reviewer_id === input.request.reviewer_id);
  if (!reviewer || reviewer.identity_verification.status !== 'verified') {
    throw new Error('stage6_feedback_draft_reviewer_not_verified');
  }
  loaded.draftState.revision += 1;
  loaded.draftState.drafts.push({
    draft_id: `feedback-draft-${loaded.draftState.revision}`,
    round_number: input.request.round_number,
    reviewer_id: input.request.reviewer_id,
    category: input.request.category,
    note: input.request.note.trim(),
    issue_id: input.request.issue_id.trim(),
    target_sections: [...new Set(input.request.target_sections)],
    evidence_required: input.request.evidence_required,
    created_at: input.now ?? new Date().toISOString(),
    created_by: `${input.request.actor_name} (${input.request.actor_id})`,
    provenance: 'preparation_draft',
    counts_as_human_table_read: false,
  });
  await atomicWrite(
    path.join(workspaceProjectRoot(input.repoRoot, input.benchmarkId), 'feedback-drafts.json'),
    loaded.draftState,
  );
  return getStage6RevisionWorkspaceDetail({ repoRoot: input.repoRoot, benchmarkId: input.benchmarkId, now: input.now });
}
