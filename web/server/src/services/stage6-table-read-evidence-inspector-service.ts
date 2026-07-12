import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { Stage6RealInputIntakeSchema, Stage6RealInputReadinessReportSchema } from '@shared/schemas.js';
import type {
  Stage6RealInputIntake,
  Stage6RealInputReadinessReport,
  Stage6TableReadEvidenceInspectionIssue,
  Stage6TableReadEvidenceInspectionResult,
  Stage6TableReadEvidenceInspectorWorkspace,
} from '@shared/types.js';
import { Stage6TableReadArtifactSchema, type Stage6TableReadArtifact } from './professional-multi-round-revision-batch-service.js';
import { stage6CanonicalSha256, validateStage6RealInputIntake } from './professional-multi-round-revision-intake-service.js';
import type { MultiRoundRevisionSpecRegistry } from './professional-multi-round-revision-execution-service.js';

interface Sources {
  registry: MultiRoundRevisionSpecRegistry;
  intake: Stage6RealInputIntake;
  readiness: Stage6RealInputReadinessReport;
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function readJsonInside(repoRoot: string, relativePath: string): Promise<unknown> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  if (!inside(realRoot, resolved)) throw new Error('stage6_table_read_inspector_path_outside_repository');
  return JSON.parse(await readFile(resolved, 'utf8')) as unknown;
}

async function loadSources(repoRoot: string): Promise<Sources> {
  const registry = await readJsonInside(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json') as MultiRoundRevisionSpecRegistry;
  const readinessResult = Stage6RealInputReadinessReportSchema.safeParse(await readJsonInside(repoRoot, 'data/reports/story-agent-stage6-p0-project-readiness.json'));
  if (!readinessResult.success) throw new Error('stage6_table_read_inspector_readiness_invalid');
  const readiness = readinessResult.data;
  const intakeResult = Stage6RealInputIntakeSchema.safeParse(await readJsonInside(repoRoot, readiness.source_intake_path));
  if (!intakeResult.success) throw new Error('stage6_table_read_inspector_intake_invalid');
  if (registry.schema_version !== 'all-format-professional-multi-round-revision-specs/v1'
    || registry.projects.length !== 15
    || stage6CanonicalSha256(registry) !== readiness.source_registry_canonical_sha256
    || stage6CanonicalSha256(intakeResult.data) !== readiness.source_intake_canonical_sha256) {
    throw new Error('stage6_table_read_inspector_source_binding_invalid');
  }
  const recomputed = validateStage6RealInputIntake({
    intake: intakeResult.data,
    registry,
    repoRoot,
    sourceIntakePath: readiness.source_intake_path,
    now: readiness.generated_at,
  });
  if (stage6CanonicalSha256(recomputed) !== stage6CanonicalSha256(readiness)) {
    throw new Error('stage6_table_read_inspector_readiness_recomputation_mismatch');
  }
  return { registry, intake: intakeResult.data, readiness };
}

function pushIssue(issues: Stage6TableReadEvidenceInspectionIssue[], value: Stage6TableReadEvidenceInspectionIssue): void {
  if (!issues.some(item => item.code === value.code && item.path === value.path)) issues.push(value);
}

function sourceClaimedSignatureOrCredit(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.some(key => ['signature', 'signed_by', 'signed_at', 'human_table_read_credit_granted', 'professional_passed'].includes(key));
}

function emptySummary(claimed = false): Stage6TableReadEvidenceInspectionResult['artifact_summary'] {
  return {
    benchmark_id: '', real_project_id: '', round_number: 0, session_reference: '', feedback_count: 0,
    writer_editor_feedback_count: 0, director_feedback_count: 0, fact_culture_reviewer_feedback_count: 0,
    evidence_required_feedback_count: 0, source_claimed_signature_or_credit: claimed,
  };
}

export async function inspectStage6TableReadEvidence(input: {
  repoRoot: string;
  request: unknown;
  now?: string;
}): Promise<Stage6TableReadEvidenceInspectionResult> {
  const now = input.now ?? new Date().toISOString();
  const sources = await loadSources(input.repoRoot);
  const rawRequest = input.request && typeof input.request === 'object' ? input.request as Record<string, unknown> : {};
  const rawJson = typeof rawRequest.raw_json === 'string' ? rawRequest.raw_json : '';
  const expectedBenchmarkId = typeof rawRequest.expected_benchmark_id === 'string' ? rawRequest.expected_benchmark_id.trim() : '';
  const expectedRound = rawRequest.expected_round_number === 1 || rawRequest.expected_round_number === 2
    ? rawRequest.expected_round_number : 0;
  const requestValid = Boolean(rawJson && expectedBenchmarkId && expectedRound);
  const spec = sources.registry.projects.find(project => project.benchmark_id === expectedBenchmarkId);
  const intakeProject = sources.intake.projects.find(project => project.benchmark_id === expectedBenchmarkId);
  const readinessProject = sources.readiness.projects.find(project => project.benchmark_id === expectedBenchmarkId);
  const checks: Stage6TableReadEvidenceInspectionResult['checks'] = {
    request_valid: requestValid,
    json_valid: false,
    artifact_schema_valid: false,
    p0_readiness_reverified: readinessProject?.status === 'ready',
    benchmark_binding_valid: false,
    real_project_binding_valid: false,
    round_binding_valid: false,
    session_reference_valid: false,
    table_read_schedule_verified: false,
    three_required_roles_present: false,
    reviewer_ids_match_verified_intake: false,
    feedback_ids_unique: false,
    submitted_at_not_before_scheduled_at: false,
  };
  const issues: Stage6TableReadEvidenceInspectionIssue[] = [];
  if (!requestValid || !spec || !intakeProject || !readinessProject) {
    pushIssue(issues, { code: 'inspection_request_or_project_invalid', path: '', gate: 'request', blocking: true, message: 'A known benchmark, round 1 or 2, and raw_json are required.' });
  }
  if (!checks.p0_readiness_reverified) {
    pushIssue(issues, { code: 'p0_readiness_required_before_table_read_credit', path: 'expected_benchmark_id', gate: 'identity', blocking: true, message: 'P0 readiness must be reverified before table-read evidence can enter a real revision round.' });
  }
  let rawArtifact: unknown;
  try {
    rawArtifact = JSON.parse(rawJson) as unknown;
    checks.json_valid = true;
  } catch (error) {
    pushIssue(issues, { code: 'table_read_json_invalid', path: 'raw_json', gate: 'schema', blocking: true, message: (error as Error).message });
  }
  const claimed = sourceClaimedSignatureOrCredit(rawArtifact);
  if (claimed) {
    pushIssue(issues, { code: 'self_reported_signature_or_credit_rejected', path: '', gate: 'credit', blocking: false, message: 'Self-reported signature, human-review credit, or professional pass is not accepted.' });
  }
  const parsed = Stage6TableReadArtifactSchema.safeParse(rawArtifact);
  if (!parsed.success) {
    for (const item of parsed.error.issues.slice(0, 50)) {
      pushIssue(issues, { code: 'table_read_artifact_schema_invalid', path: item.path.join('.'), gate: 'schema', blocking: true, message: item.message });
    }
  }
  const artifact = parsed.success ? parsed.data : null;
  checks.artifact_schema_valid = Boolean(artifact);
  if (artifact && spec && intakeProject && readinessProject && expectedRound) {
    checks.benchmark_binding_valid = artifact.benchmark_id === spec.benchmark_id;
    checks.real_project_binding_valid = Boolean(intakeProject.real_project_id
      && artifact.real_project_id === intakeProject.real_project_id);
    checks.round_binding_valid = artifact.round_number === expectedRound;
    checks.session_reference_valid = Boolean(intakeProject.table_read.schedule_reference
      && artifact.session_reference === intakeProject.table_read.schedule_reference);
    checks.table_read_schedule_verified = intakeProject.table_read.verification.status === 'verified';
    const requiredRoles = ['writer_editor', 'director', 'fact_culture_reviewer'] as const;
    checks.three_required_roles_present = requiredRoles.every(role => artifact.feedback.some(item => item.source === role));
    checks.reviewer_ids_match_verified_intake = requiredRoles.every(role => {
      const reviewer = intakeProject.reviewers.find(item => item.role === role);
      return Boolean(reviewer
        && reviewer.identity_verification.status === 'verified'
        && artifact.feedback.some(item => item.source === role && item.reviewer_id === reviewer.reviewer_id));
    });
    checks.feedback_ids_unique = new Set(artifact.feedback.map(item => item.feedback_id)).size === artifact.feedback.length;
    const scheduledAt = Date.parse(intakeProject.table_read.scheduled_at);
    const submittedAt = Date.parse(artifact.submitted_at);
    checks.submitted_at_not_before_scheduled_at = Number.isFinite(scheduledAt)
      && Number.isFinite(submittedAt)
      && submittedAt >= scheduledAt;
    const gateIssues: Array<[keyof typeof checks, string, Stage6TableReadEvidenceInspectionIssue['gate'], string]> = [
      ['benchmark_binding_valid', 'table_read_benchmark_mismatch', 'identity', 'benchmark_id'],
      ['real_project_binding_valid', 'table_read_real_project_mismatch', 'identity', 'real_project_id'],
      ['round_binding_valid', 'table_read_round_mismatch', 'identity', 'round_number'],
      ['session_reference_valid', 'table_read_session_reference_mismatch', 'session', 'session_reference'],
      ['table_read_schedule_verified', 'table_read_schedule_unverified', 'session', 'session_reference'],
      ['three_required_roles_present', 'table_read_required_roles_missing', 'reviewer', 'feedback'],
      ['reviewer_ids_match_verified_intake', 'table_read_reviewer_identity_mismatch', 'reviewer', 'feedback'],
      ['feedback_ids_unique', 'table_read_feedback_id_duplicate', 'schema', 'feedback'],
      ['submitted_at_not_before_scheduled_at', 'table_read_submitted_before_schedule', 'session', 'submitted_at'],
    ];
    for (const [key, code, gate, pathValue] of gateIssues) {
      if (!checks[key]) pushIssue(issues, { code, path: pathValue, gate, blocking: true, message: `${pathValue} does not satisfy the signed table-read preflight.` });
    }
  }
  const allChecksPass = Object.values(checks).every(Boolean);
  const summary = artifact ? {
    benchmark_id: artifact.benchmark_id,
    real_project_id: artifact.real_project_id,
    round_number: artifact.round_number,
    session_reference: artifact.session_reference,
    feedback_count: artifact.feedback.length,
    writer_editor_feedback_count: artifact.feedback.filter(item => item.source === 'writer_editor').length,
    director_feedback_count: artifact.feedback.filter(item => item.source === 'director').length,
    fact_culture_reviewer_feedback_count: artifact.feedback.filter(item => item.source === 'fact_culture_reviewer').length,
    evidence_required_feedback_count: artifact.feedback.filter(item => item.evidence_required).length,
    source_claimed_signature_or_credit: claimed,
  } : emptySummary(claimed);
  return {
    schema_version: 'story-agent-stage6-table-read-evidence-inspection/v1',
    generated_at: now,
    dry_run_only: true,
    input_persisted: false,
    table_read_state_mutated: false,
    signature_created: false,
    human_table_read_credit_granted: false,
    execution_started: false,
    professional_passed: false,
    source_file_sha256: rawJson ? createHash('sha256').update(rawJson, 'utf8').digest('hex') : '',
    canonical_artifact_sha256: artifact ? stage6CanonicalSha256(artifact) : '',
    schema_valid: checks.artifact_schema_valid,
    signature_preflight_ready: allChecksPass,
    expected_binding: {
      benchmark_id: expectedBenchmarkId,
      real_project_id: intakeProject?.real_project_id ?? '',
      round_number: expectedRound || 1,
      session_reference: intakeProject?.table_read.schedule_reference ?? '',
    },
    checks,
    artifact_summary: summary,
    issues,
  };
}

function templateFor(input: {
  project: Stage6RealInputIntake['projects'][number];
  roundNumber: 1 | 2;
  now: string;
}): Stage6TableReadArtifact {
  const reviewerId = (role: Stage6RealInputIntake['projects'][number]['reviewers'][number]['role']) => (
    input.project.reviewers.find(item => item.role === role)?.reviewer_id ?? ''
  );
  return {
    schema_version: 'story-agent-stage6-table-read-feedback/v1',
    benchmark_id: input.project.benchmark_id,
    real_project_id: input.project.real_project_id,
    round_number: input.roundNumber,
    session_reference: input.project.table_read.schedule_reference,
    submitted_at: input.now,
    feedback: [
      { feedback_id: '', reviewer_id: reviewerId('writer_editor'), source: 'writer_editor', category: 'structure', note: '', issue_id: '', target_sections: [], evidence_required: false },
      { feedback_id: '', reviewer_id: reviewerId('director'), source: 'director', category: 'scene', note: '', issue_id: '', target_sections: [], evidence_required: false },
      { feedback_id: '', reviewer_id: reviewerId('fact_culture_reviewer'), source: 'fact_culture_reviewer', category: 'fact_and_culture', note: '', issue_id: '', target_sections: [], evidence_required: true },
    ],
  };
}

export async function getStage6TableReadEvidenceInspectorWorkspace(input: {
  repoRoot: string;
  benchmarkId?: unknown;
  roundNumber?: unknown;
  now?: string;
}): Promise<Stage6TableReadEvidenceInspectorWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const sources = await loadSources(input.repoRoot);
  const requested = typeof input.benchmarkId === 'string' ? input.benchmarkId : '';
  const selected = sources.intake.projects.find(project => project.benchmark_id === requested) ?? sources.intake.projects[0];
  const roundNumber = input.roundNumber === 2 || input.roundNumber === '2' ? 2 : 1;
  const template = templateFor({ project: selected, roundNumber, now });
  const templateRawJson = `${JSON.stringify(template, null, 2)}\n`;
  return {
    schema_version: 'story-agent-stage6-table-read-evidence-inspector-workspace/v1',
    generated_at: now,
    policy: {
      dry_run_only: true,
      input_files_are_not_persisted: true,
      signature_preflight_is_signature: false,
      self_reported_signature_or_credit_is_accepted: false,
      human_table_read_credit_can_be_granted: false,
      professional_pass_can_be_granted: false,
    },
    selected_benchmark_id: selected.benchmark_id,
    selected_round_number: roundNumber,
    projects: sources.registry.projects.map(spec => {
      const readiness = sources.readiness.projects.find(project => project.benchmark_id === spec.benchmark_id)!;
      return { benchmark_id: spec.benchmark_id, video_type: spec.video_type, source_entry: spec.source_entry, real_project_id: readiness.real_project_id, readiness_status: readiness.status };
    }),
    template,
    template_raw_json: templateRawJson,
    template_inspection: await inspectStage6TableReadEvidence({
      repoRoot: input.repoRoot,
      request: { raw_json: templateRawJson, expected_benchmark_id: selected.benchmark_id, expected_round_number: roundNumber },
      now,
    }),
  };
}
