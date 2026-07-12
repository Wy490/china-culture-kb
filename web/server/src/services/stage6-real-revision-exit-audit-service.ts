import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  ProfessionalTextPackageSchema,
  Stage6RealInputIntakeSchema,
  Stage6RealInputReadinessReportSchema,
} from '@shared/schemas.js';
import type {
  ProfessionalTextPackage,
  Stage6ExitAuditBlocker,
  Stage6ExitAuditProjectResult,
  Stage6RealInputIntake,
  Stage6RealInputReadinessReport,
  Stage6RealRevisionExitAuditReport,
} from '@shared/types.js';
import type {
  Stage6RevisionArtifactKind,
  Stage6RevisionArtifactReference,
  Stage6RevisionProjectExecutionState,
} from './professional-multi-round-revision-batch-service.js';
import {
  professionalPackageSha256,
  validateProfessionalMultiRoundRevisionLedger,
} from './professional-multi-round-revision-service.js';
import {
  stage6CanonicalSha256,
  validateStage6RealInputIntake,
} from './professional-multi-round-revision-intake-service.js';
import type { MultiRoundRevisionSpecRegistry } from './professional-multi-round-revision-execution-service.js';

const REQUIRED_ARTIFACT_KINDS: Stage6RevisionArtifactKind[] = [
  'before_package',
  'revision_submission',
  'table_read_feedback',
  'cost_record',
  'revised_package',
  'coverage_action_set',
  'revision_ledger',
  'round_manifest',
];

const REQUIRED_REVIEW_ROLES = ['writer_editor', 'director', 'fact_culture_reviewer'] as const;

interface ArtifactEnvelope {
  schema_version: 'story-agent-stage6-revision-artifact/v1';
  artifact_id: string;
  benchmark_id: string;
  real_project_id: string;
  round_number: 1 | 2;
  attempt_number: number;
  kind: Stage6RevisionArtifactKind;
  created_at: string;
  producer: string;
  parent_sha256: string[];
  payload_canonical_sha256: string;
  payload: unknown;
  professional_passed: false;
}

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
}

interface AuditSources {
  registry: MultiRoundRevisionSpecRegistry;
  intake: Stage6RealInputIntake;
  readiness: Stage6RealInputReadinessReport;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function readJsonInside(repoRoot: string, relativePath: string): Promise<unknown> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  if (!inside(realRoot, resolved)) throw new Error('stage6_exit_audit_path_outside_repository');
  return JSON.parse(await readFile(resolved, 'utf8')) as unknown;
}

async function loadSources(repoRoot: string): Promise<AuditSources> {
  const registry = await readJsonInside(
    repoRoot,
    'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json',
  ) as MultiRoundRevisionSpecRegistry;
  const readinessResult = Stage6RealInputReadinessReportSchema.safeParse(await readJsonInside(
    repoRoot,
    'data/reports/story-agent-stage6-p0-project-readiness.json',
  ));
  if (!readinessResult.success) throw new Error('stage6_exit_audit_readiness_schema_invalid');
  const readiness = readinessResult.data;
  const intakeResult = Stage6RealInputIntakeSchema.safeParse(await readJsonInside(repoRoot, readiness.source_intake_path));
  if (!intakeResult.success) throw new Error('stage6_exit_audit_intake_schema_invalid');
  const intake = intakeResult.data;
  if (registry.schema_version !== 'all-format-professional-multi-round-revision-specs/v1'
    || registry.projects.length !== 15
    || new Set(registry.projects.map(project => project.video_type)).size !== 15) {
    throw new Error('stage6_exit_audit_registry_invalid');
  }
  if (stage6CanonicalSha256(registry) !== readiness.source_registry_canonical_sha256
    || stage6CanonicalSha256(intake) !== readiness.source_intake_canonical_sha256) {
    throw new Error('stage6_exit_audit_source_hash_mismatch');
  }
  const recomputed = validateStage6RealInputIntake({
    intake,
    registry,
    repoRoot,
    sourceIntakePath: readiness.source_intake_path,
    now: readiness.generated_at,
  });
  if (stage6CanonicalSha256(recomputed) !== stage6CanonicalSha256(readiness)) {
    throw new Error('stage6_exit_audit_readiness_recomputation_mismatch');
  }
  return { registry, intake, readiness };
}

function projectRoot(repoRoot: string, realProjectId: string): string {
  return path.join(repoRoot, 'web/generated/stage6-revisions', sha256(realProjectId).slice(0, 16));
}

async function loadExecutionState(repoRoot: string, realProjectId: string): Promise<Stage6RevisionProjectExecutionState | null> {
  if (!realProjectId.trim()) return null;
  try {
    const state = JSON.parse(await readFile(path.join(projectRoot(repoRoot, realProjectId), 'execution-state.json'), 'utf8')) as Stage6RevisionProjectExecutionState;
    if (state.schema_version !== 'story-agent-stage6-revision-execution-state/v1'
      || state.real_project_id !== realProjectId
      || state.professional_passed !== false) throw new Error('stage6_exit_audit_execution_state_invalid');
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function loadFeedbackReviewState(
  repoRoot: string,
  benchmarkId: string,
  realProjectId: string,
): Promise<FeedbackReviewState | null> {
  if (!realProjectId.trim()) return null;
  try {
    const state = JSON.parse(await readFile(
      path.join(projectRoot(repoRoot, realProjectId), 'feedback-review-state.json'),
      'utf8',
    )) as FeedbackReviewState;
    if (state.schema_version !== 'story-agent-stage6-feedback-review-state/v1'
      || state.benchmark_id !== benchmarkId
      || state.real_project_id !== realProjectId) throw new Error('stage6_exit_audit_feedback_state_invalid');
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function loadInitialPackage(
  repoRoot: string,
  intakeProject: Stage6RealInputIntake['projects'][number],
): Promise<ProfessionalTextPackage | null> {
  try {
    const realRoot = await realpath(repoRoot);
    const resolved = await realpath(path.resolve(realRoot, intakeProject.initial_package.path));
    if (!inside(realRoot, resolved)) return null;
    const bytes = await readFile(resolved);
    if (sha256(bytes) !== intakeProject.initial_package.sha256) return null;
    const parsed = ProfessionalTextPackageSchema.safeParse(JSON.parse(bytes.toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function blocker(
  blockers: Stage6ExitAuditBlocker[],
  code: string,
  detail: string,
): void {
  if (!blockers.some(item => item.code === code && item.detail === detail)) blockers.push({ code, detail });
}

async function loadAndValidateArtifact(input: {
  repoRoot: string;
  reference: Stage6RevisionArtifactReference;
  benchmarkId: string;
  realProjectId: string;
  roundNumber: 1 | 2;
  attemptNumber: number;
  blockers: Stage6ExitAuditBlocker[];
}): Promise<ArtifactEnvelope | null> {
  try {
    const realRoot = await realpath(input.repoRoot);
    const resolved = await realpath(path.resolve(realRoot, input.reference.relative_path));
    if (!inside(realRoot, resolved)) throw new Error('outside_repository');
    const bytes = await readFile(resolved);
    if (sha256(bytes) !== input.reference.sha256) throw new Error('sha256_mismatch');
    if (bytes.byteLength !== input.reference.byte_size) throw new Error('byte_size_mismatch');
    const envelope = JSON.parse(bytes.toString('utf8')) as ArtifactEnvelope;
    if (envelope.schema_version !== 'story-agent-stage6-revision-artifact/v1'
      || envelope.artifact_id !== input.reference.artifact_id
      || envelope.kind !== input.reference.kind
      || envelope.benchmark_id !== input.benchmarkId
      || envelope.real_project_id !== input.realProjectId
      || envelope.round_number !== input.roundNumber
      || envelope.attempt_number !== input.attemptNumber
      || envelope.professional_passed !== false
      || stage6CanonicalSha256(envelope.payload) !== envelope.payload_canonical_sha256
      || JSON.stringify(envelope.parent_sha256) !== JSON.stringify(input.reference.parent_sha256)) {
      throw new Error('envelope_contract_invalid');
    }
    return envelope;
  } catch (error) {
    blocker(
      input.blockers,
      'immutable_artifact_invalid',
      `${input.reference.kind}:${(error as Error).message}`,
    );
    return null;
  }
}

function effectiveFeedbackStatus(input: {
  roundNumber: number;
  feedbackId: string;
  immutableStatus: 'open' | 'closed';
  reviewState: FeedbackReviewState | null;
}): 'open' | 'closed' {
  return input.reviewState?.feedback[`${input.roundNumber}:${input.feedbackId}`]?.effective_status
    ?? input.immutableStatus;
}

async function auditProject(input: {
  repoRoot: string;
  spec: MultiRoundRevisionSpecRegistry['projects'][number];
  readinessProject: Stage6RealInputReadinessReport['projects'][number];
  intakeProject: Stage6RealInputIntake['projects'][number];
}): Promise<Stage6ExitAuditProjectResult> {
  const blockers: Stage6ExitAuditBlocker[] = [];
  const checks: Stage6ExitAuditProjectResult['checks'] = {
    p0_readiness_reverified: input.readinessProject.status === 'ready',
    two_rounds_completed: false,
    two_rounds_real_provenance_verified: false,
    immutable_artifact_dag_valid: false,
    package_hash_chain_valid: false,
    revision_budget_valid: false,
    three_role_table_read_valid: false,
    all_feedback_effectively_closed: false,
    derived_rebuilds_complete: false,
    quality_improvement_traceable: false,
  };
  if (!checks.p0_readiness_reverified) {
    for (const item of input.readinessProject.blockers) blocker(blockers, `p0_${item.code}`, item.path);
  }
  const realProjectId = input.readinessProject.real_project_id;
  const state = await loadExecutionState(input.repoRoot, realProjectId);
  if (!state) {
    blocker(blockers, 'revision_execution_state_missing', 'No P1 execution state exists for this project.');
    return {
      benchmark_id: input.spec.benchmark_id,
      video_type: input.spec.video_type,
      source_entry: input.spec.source_entry,
      real_project_id: realProjectId,
      status: 'blocked',
      blockers,
      checks,
      recorded_round_count: 0,
      verified_real_revision_round_count: 0,
      effective_open_feedback_count: 0,
      total_cost_amount: 0,
      cost_currency: '',
      stage6_exit_candidate: false,
      professional_passed: false,
    };
  }
  if (state.benchmark_id !== input.spec.benchmark_id || state.video_type !== input.spec.video_type) {
    blocker(blockers, 'execution_state_identity_mismatch', 'Execution state does not match registry identity.');
  }
  if (!state.ledger) blocker(blockers, 'revision_ledger_missing', 'Execution state has no multi-round ledger.');
  const ledger = state.ledger;
  if (ledger) {
    for (const error of validateProfessionalMultiRoundRevisionLedger(ledger)) {
      blocker(blockers, 'revision_ledger_invalid', error);
    }
  }
  checks.two_rounds_completed = state.completed_rounds.length === 2 && ledger?.rounds.length === 2;
  if (!checks.two_rounds_completed) blocker(blockers, 'two_real_revision_rounds_required', `recorded=${ledger?.rounds.length ?? 0}`);

  const reviewState = await loadFeedbackReviewState(input.repoRoot, input.spec.benchmark_id, realProjectId);
  let effectiveOpenFeedbackCount = 0;
  let totalCostAmount = 0;
  let costCurrency = '';
  let allArtifactsValid = checks.two_rounds_completed;
  let allReviewRolesValid = checks.two_rounds_completed;
  let allRebuildsValid = checks.two_rounds_completed;
  let allRealProvenanceValid = checks.two_rounds_completed;
  const revisedPackages = new Map<number, ProfessionalTextPackage>();

  for (const completed of state.completed_rounds) {
    const round = ledger?.rounds[completed.round_number - 1];
    if (!round) {
      blocker(blockers, 'ledger_round_missing', `round=${completed.round_number}`);
      allArtifactsValid = false;
      continue;
    }
    if (!round.verified_real_revision_credit
      || !['real_model', 'human_authored'].includes(round.provenance.artifact_kind)
      || !round.provenance.provenance_verified
      || !round.provenance.cost_recorded) {
      allRealProvenanceValid = false;
      blocker(blockers, 'round_real_provenance_not_verified', `round=${completed.round_number}`);
    }
    const attempt = state.attempts[`round_${completed.round_number}`].find(item =>
      item.status === 'completed' && item.command_id === completed.command_id
    );
    if (!attempt) {
      allArtifactsValid = false;
      blocker(blockers, 'completed_attempt_missing', `round=${completed.round_number}`);
      continue;
    }
    const kindCounts = new Map<Stage6RevisionArtifactKind, number>();
    for (const reference of attempt.artifacts) {
      kindCounts.set(reference.kind, (kindCounts.get(reference.kind) ?? 0) + 1);
    }
    if (REQUIRED_ARTIFACT_KINDS.some(kind => kindCounts.get(kind) !== 1) || attempt.artifacts.length !== 8) {
      allArtifactsValid = false;
      blocker(blockers, 'artifact_taxonomy_incomplete', `round=${completed.round_number}`);
    }
    const envelopes = new Map<Stage6RevisionArtifactKind, ArtifactEnvelope>();
    for (const reference of attempt.artifacts) {
      const envelope = await loadAndValidateArtifact({
        repoRoot: input.repoRoot,
        reference,
        benchmarkId: input.spec.benchmark_id,
        realProjectId,
        roundNumber: completed.round_number,
        attemptNumber: attempt.attempt_number,
        blockers,
      });
      if (envelope) envelopes.set(reference.kind, envelope); else allArtifactsValid = false;
    }
    const artifactHashes = new Set(attempt.artifacts.map(item => item.sha256));
    for (const reference of attempt.artifacts) {
      if (reference.parent_sha256.some(parent => !artifactHashes.has(parent))) {
        allArtifactsValid = false;
        blocker(blockers, 'artifact_parent_missing', `${reference.kind}`);
      }
    }
    const revisedEnvelope = envelopes.get('revised_package');
    const revisedResult = ProfessionalTextPackageSchema.safeParse(revisedEnvelope?.payload);
    if (!revisedResult.success || revisedResult.data.quality_report.professional_passed) {
      allArtifactsValid = false;
      blocker(blockers, 'revised_package_invalid', `round=${completed.round_number}`);
    } else {
      revisedPackages.set(completed.round_number, revisedResult.data);
      if (professionalPackageSha256(revisedResult.data) !== round.after_package_sha256
        || completed.after_package_sha256 !== round.after_package_sha256) {
        allArtifactsValid = false;
        blocker(blockers, 'after_package_hash_mismatch', `round=${completed.round_number}`);
      }
    }
    const cost = envelopes.get('cost_record')?.payload as Record<string, unknown> | undefined;
    if (!cost || typeof cost.amount !== 'number' || typeof cost.currency !== 'string'
      || cost.round_number !== completed.round_number
      || cost.real_project_id !== realProjectId
      || cost.output_id !== round.provenance.output_id) {
      blocker(blockers, 'cost_artifact_invalid', `round=${completed.round_number}`);
    } else {
      totalCostAmount += cost.amount;
      if (!costCurrency) costCurrency = cost.currency;
      else if (costCurrency !== cost.currency) blocker(blockers, 'cost_currency_inconsistent', `round=${completed.round_number}`);
    }
    const tableRead = envelopes.get('table_read_feedback')?.payload as Record<string, unknown> | undefined;
    const feedback = Array.isArray(tableRead?.feedback) ? tableRead.feedback as Array<Record<string, unknown>> : [];
    const reviewerByRole = new Map(input.intakeProject.reviewers.map(reviewer => [reviewer.role, reviewer.reviewer_id]));
    for (const role of REQUIRED_REVIEW_ROLES) {
      const expectedReviewer = reviewerByRole.get(role);
      if (!feedback.some(item => item.source === role && item.reviewer_id === expectedReviewer)) {
        allReviewRolesValid = false;
        blocker(blockers, 'required_table_read_role_missing', `round=${completed.round_number},role=${role}`);
      }
    }
    for (const item of round.table_read_feedback) {
      if (effectiveFeedbackStatus({
        roundNumber: round.round_number,
        feedbackId: item.feedback_id,
        immutableStatus: item.status,
        reviewState,
      }) === 'open') effectiveOpenFeedbackCount += 1;
    }
    const rebuildComplete = round.required_derived_rebuild_sections.every(section =>
      round.rebuilt_derived_sections.includes(section)
    );
    if (!rebuildComplete) {
      allRebuildsValid = false;
      blocker(blockers, 'derived_rebuild_incomplete', `round=${completed.round_number}`);
    }
    const manifest = envelopes.get('round_manifest')?.payload as Record<string, unknown> | undefined;
    if (!manifest
      || manifest.before_package_sha256 !== round.before_package_sha256
      || manifest.after_package_sha256 !== round.after_package_sha256
      || manifest.verified_real_revision_credit !== round.verified_real_revision_credit
      || manifest.professional_passed !== false) {
      allArtifactsValid = false;
      blocker(blockers, 'round_manifest_invalid', `round=${completed.round_number}`);
    }
  }

  checks.two_rounds_real_provenance_verified = allRealProvenanceValid;
  checks.immutable_artifact_dag_valid = allArtifactsValid && !blockers.some(item => [
    'immutable_artifact_invalid',
    'artifact_taxonomy_incomplete',
    'artifact_parent_missing',
    'round_manifest_invalid',
  ].includes(item.code));
  const initialPackage = await loadInitialPackage(input.repoRoot, input.intakeProject);
  const round1 = ledger?.rounds[0];
  const round2 = ledger?.rounds[1];
  checks.package_hash_chain_valid = Boolean(
    initialPackage
    && round1
    && round2
    && professionalPackageSha256(initialPackage) === round1.before_package_sha256
    && round1.after_package_sha256 === round2.before_package_sha256
    && revisedPackages.has(1)
    && revisedPackages.has(2)
    && professionalPackageSha256(revisedPackages.get(1)!) === round1.after_package_sha256
    && professionalPackageSha256(revisedPackages.get(2)!) === round2.after_package_sha256,
  );
  if (!checks.package_hash_chain_valid) blocker(blockers, 'package_hash_chain_invalid', 'Round 0 -> 1 -> 2 package hashes do not form a continuous chain.');
  checks.revision_budget_valid = totalCostAmount <= input.intakeProject.revision_budget.amount
    && costCurrency === input.intakeProject.revision_budget.currency;
  if (!checks.revision_budget_valid) blocker(blockers, 'revision_budget_invalid', `cost=${totalCostAmount} ${costCurrency}`);
  checks.three_role_table_read_valid = allReviewRolesValid;
  checks.all_feedback_effectively_closed = checks.two_rounds_completed && effectiveOpenFeedbackCount === 0;
  if (!checks.all_feedback_effectively_closed) blocker(blockers, 'effective_open_table_read_feedback', `count=${effectiveOpenFeedbackCount}`);
  checks.derived_rebuilds_complete = allRebuildsValid;
  checks.quality_improvement_traceable = Boolean(
    ledger
    && ledger.rounds.every(round => round.quality_improvement_traceable)
    && ledger.rounds.some(round => round.quality_delta > 0),
  );
  if (!checks.quality_improvement_traceable) blocker(blockers, 'quality_improvement_not_traceable', 'Two rounds must be traceable and at least one must improve.');
  const allChecksPass = blockers.length === 0 && Object.values(checks).every(Boolean);
  const exitCandidate = allChecksPass && Boolean(ledger?.summary.stage6_exit_candidate);
  if (allChecksPass && !ledger?.summary.stage6_exit_candidate) {
    blocker(blockers, 'ledger_stage6_exit_candidate_false', 'Ledger does not satisfy the immutable Stage 6 exit contract.');
  }
  return {
    benchmark_id: input.spec.benchmark_id,
    video_type: input.spec.video_type,
    source_entry: input.spec.source_entry,
    real_project_id: realProjectId,
    status: exitCandidate && blockers.length === 0 ? 'eligible_for_stage6_exit_review' : 'blocked',
    blockers,
    checks,
    recorded_round_count: ledger?.rounds.length ?? 0,
    verified_real_revision_round_count: ledger?.summary.completed_verified_round_count ?? 0,
    effective_open_feedback_count: effectiveOpenFeedbackCount,
    total_cost_amount: totalCostAmount,
    cost_currency: costCurrency,
    stage6_exit_candidate: exitCandidate && blockers.length === 0,
    professional_passed: false,
  };
}

export async function buildStage6RealRevisionExitAudit(input: {
  repoRoot: string;
  now?: string;
}): Promise<Stage6RealRevisionExitAuditReport> {
  const sources = await loadSources(input.repoRoot);
  const projects = await Promise.all(sources.registry.projects.map(spec => {
    const readinessProject = sources.readiness.projects.find(project => project.benchmark_id === spec.benchmark_id);
    const intakeProject = sources.intake.projects.find(project => project.benchmark_id === spec.benchmark_id);
    if (!readinessProject || !intakeProject) throw new Error(`stage6_exit_audit_project_binding_missing:${spec.benchmark_id}`);
    return auditProject({ repoRoot: input.repoRoot, spec, readinessProject, intakeProject });
  }));
  return {
    schema_version: 'story-agent-stage6-real-revision-exit-audit/v1',
    generated_at: input.now ?? new Date().toISOString(),
    source_readiness_canonical_sha256: stage6CanonicalSha256(sources.readiness),
    source_intake_canonical_sha256: stage6CanonicalSha256(sources.intake),
    source_registry_canonical_sha256: stage6CanonicalSha256(sources.registry),
    policy: {
      required_real_revision_round_count: 2,
      simulation_fixture_fallback_counts_as_real_revision: false,
      prepared_or_recovered_counts_as_real_revision: false,
      effective_open_feedback_blocks_exit: true,
      stage6_exit_candidate_counts_as_professional_pass: false,
    },
    summary: {
      project_count: projects.length,
      blocked_project_count: projects.filter(project => project.status === 'blocked').length,
      eligible_for_stage6_exit_review_project_count: projects.filter(project => project.status === 'eligible_for_stage6_exit_review').length,
      recorded_round_count: projects.reduce((sum, project) => sum + project.recorded_round_count, 0),
      verified_real_revision_round_count: projects.reduce((sum, project) => sum + project.verified_real_revision_round_count, 0),
      effective_open_feedback_count: projects.reduce((sum, project) => sum + project.effective_open_feedback_count, 0),
      professional_pass_count: 0,
    },
    projects,
  };
}

export function validateStage6RealRevisionExitAudit(report: Stage6RealRevisionExitAuditReport): string[] {
  const errors: string[] = [];
  if (report.schema_version !== 'story-agent-stage6-real-revision-exit-audit/v1') errors.push('schema_version_invalid');
  if (report.projects.length !== 15 || new Set(report.projects.map(project => project.video_type)).size !== 15) errors.push('video_type_coverage_invalid');
  if (report.summary.project_count !== report.projects.length
    || report.summary.blocked_project_count !== report.projects.filter(project => project.status === 'blocked').length
    || report.summary.eligible_for_stage6_exit_review_project_count !== report.projects.filter(project => project.status === 'eligible_for_stage6_exit_review').length) errors.push('summary_mismatch');
  if (report.summary.professional_pass_count !== 0 || report.projects.some(project => project.professional_passed !== false)) errors.push('false_professional_pass_credit');
  if (report.projects.some(project => project.status === 'eligible_for_stage6_exit_review'
    && (project.blockers.length > 0 || !Object.values(project.checks).every(Boolean) || !project.stage6_exit_candidate))) errors.push('eligible_project_gate_mismatch');
  if (report.projects.some(project => project.status === 'blocked' && project.stage6_exit_candidate)) errors.push('blocked_project_exit_candidate_mismatch');
  return errors;
}
