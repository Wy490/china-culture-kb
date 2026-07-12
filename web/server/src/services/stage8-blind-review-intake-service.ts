import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { ProfessionalTextPackageSchema, Stage8BlindReviewIntakeProjectSchema, Stage8BlindReviewIntakeSchema } from '@shared/schemas.js';
import {
  VIDEO_TYPE_CONFIG,
  type Stage6VerificationRecord,
  type Stage8BlindReviewIntake,
  type Stage8BlindReviewIntakeProject,
  type Stage8BlindReviewProjectReadiness,
  type Stage8BlindReviewReadinessIssue,
  type Stage8BlindReviewReadinessReport,
  type Stage8BlindReviewValidationResult,
  type Stage8BlindReviewWorkspace,
  type VideoType,
} from '@shared/types.js';

const BENCHMARK_FILES: Record<VideoType, string> = {
  character_story: 'data/professional-benchmarks/character-story-iteration3-benchmark-specs.json',
  historical_drama: 'data/professional-benchmarks/historical-drama-iteration4-benchmark-specs.json',
  legend_story: 'data/professional-benchmarks/legend-story-iteration5-benchmark-specs.json',
  children_story: 'data/professional-benchmarks/children-story-iteration6-benchmark-specs.json',
  ai_comic_drama: 'data/professional-benchmarks/ai-comic-drama-iteration7-benchmark-specs.json',
  culture_promo: 'data/professional-benchmarks/culture-promo-stage3-iteration1-benchmark-specs.json',
  heritage_promo: 'data/professional-benchmarks/heritage-promo-stage3-iteration2-benchmark-specs.json',
  city_brand_promo: 'data/professional-benchmarks/city-brand-promo-stage3-iteration3-benchmark-specs.json',
  social_short: 'data/professional-benchmarks/social-short-stage3-iteration4-benchmark-specs.json',
  documentary_short: 'data/professional-benchmarks/documentary-short-stage4-iteration1-benchmark-specs.json',
  explainer_video: 'data/professional-benchmarks/explainer-video-stage4-iteration2-benchmark-specs.json',
  lecture_video: 'data/professional-benchmarks/lecture-video-stage4-iteration3-benchmark-specs.json',
  education_training: 'data/professional-benchmarks/education-training-stage4-iteration4-benchmark-specs.json',
  scene_short: 'data/professional-benchmarks/scene-short-stage5-iteration1-benchmark-specs.json',
  landscape_mood: 'data/professional-benchmarks/landscape-mood-stage5-iteration2-benchmark-specs.json',
};

const REQUIRED_ROLES = [
  'screenwriter_or_script_editor',
  'genre_or_director_reviewer',
  'fact_or_culture_reviewer',
] as const;

interface BenchmarkBinding {
  benchmarkId: string;
  videoType: VideoType;
  sourceEntry: string;
  sourcePath: string;
  sourceSha256: string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}

export function stage8BlindReviewCanonicalSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value)), 'utf8').digest('hex');
}

async function readRepositoryJson(repoRoot: string, relativePath: string): Promise<{ raw: string; value: Record<string, unknown>; sha256: string }> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage8_blind_review_path_outside_repository');
  const raw = await readFile(resolved, 'utf8');
  return { raw, value: JSON.parse(raw) as Record<string, unknown>, sha256: createHash('sha256').update(raw, 'utf8').digest('hex') };
}

async function inspectRepositoryArtifact(repoRoot: string, relativePath: string, expectedSha256: string): Promise<{ fileValid: boolean; digestValid: boolean; jsonValue?: unknown }> {
  if (!relativePath.trim() || !/^[a-f0-9]{64}$/.test(expectedSha256)) return { fileValid: false, digestValid: false };
  try {
    const realRoot = await realpath(repoRoot);
    const resolved = await realpath(path.resolve(realRoot, relativePath));
    const relative = path.relative(realRoot, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return { fileValid: false, digestValid: false };
    const content = await readFile(resolved);
    let jsonValue: unknown;
    try { jsonValue = JSON.parse(content.toString('utf8')) as unknown; } catch { jsonValue = undefined; }
    return { fileValid: true, digestValid: createHash('sha256').update(content).digest('hex') === expectedSha256, jsonValue };
  } catch {
    return { fileValid: false, digestValid: false };
  }
}

async function loadBenchmarkBindings(repoRoot: string): Promise<{ bindings: BenchmarkBinding[]; sourceBindings: Array<{ path: string; sha256: string }> }> {
  const bindings: BenchmarkBinding[] = [];
  const sourceBindings: Array<{ path: string; sha256: string }> = [];
  for (const videoType of Object.keys(VIDEO_TYPE_CONFIG) as VideoType[]) {
    const sourcePath = BENCHMARK_FILES[videoType];
    const source = await readRepositoryJson(repoRoot, sourcePath);
    if (source.value.video_type !== videoType) throw new Error(`stage8_blind_review_video_type_binding_drifted:${videoType}`);
    const projects = Array.isArray(source.value.projects) ? source.value.projects : [];
    if (projects.length !== 5) throw new Error(`stage8_blind_review_project_count_drifted:${videoType}`);
    sourceBindings.push({ path: sourcePath, sha256: source.sha256 });
    for (const rawProject of projects) {
      if (!rawProject || typeof rawProject !== 'object' || Array.isArray(rawProject)) throw new Error(`stage8_blind_review_project_invalid:${videoType}`);
      const project = rawProject as Record<string, unknown>;
      const benchmarkId = String(project.benchmark_id ?? '');
      const sourceEntry = String(project.source_entry ?? '');
      if (!benchmarkId || !sourceEntry) throw new Error(`stage8_blind_review_project_binding_missing:${videoType}`);
      bindings.push({ benchmarkId, videoType, sourceEntry, sourcePath, sourceSha256: source.sha256 });
    }
  }
  if (bindings.length !== 75 || new Set(bindings.map(item => item.benchmarkId)).size !== 75) throw new Error('stage8_blind_review_registry_identity_invalid');
  return { bindings, sourceBindings: sourceBindings.sort((left, right) => left.path.localeCompare(right.path)) };
}

function blankVerification(): Stage6VerificationRecord {
  return { status: 'unverified', reference: '', verified_by: '', verified_at: '' };
}

function projectTemplate(binding: BenchmarkBinding): Stage8BlindReviewIntakeProject {
  return {
    benchmark_id: binding.benchmarkId,
    video_type: binding.videoType,
    source_entry: binding.sourceEntry,
    provenance: 'preparation_template',
    run_id: '',
    final_package: { path: '', sha256: '' },
    randomization: { batch_id: '', candidate_label: '', candidate_origin_hidden_from_reviewers: false },
    baseline: {
      baseline_id: '', path: '', sha256: '', rights: 'pending', average_score: 0, rights_verification: blankVerification(),
    },
    reviewer_assignments: REQUIRED_ROLES.map(role => ({
      role, reviewer_id: '', identity_verification: blankVerification(), independence_verification: blankVerification(), conflict_of_interest_declared: false,
    })),
    review_schedule: { schedule_reference: '', due_at: '', timezone: '', verification: blankVerification() },
    human_blind_review_passed: false,
    professional_passed: false,
  };
}

function isVerified(record: Stage6VerificationRecord | undefined, notAfter: number): boolean {
  const verifiedAt = Date.parse(record?.verified_at ?? '');
  return record?.status === 'verified'
    && Boolean(record.reference.trim() && record.verified_by.trim())
    && Number.isFinite(verifiedAt)
    && Number.isFinite(notAfter)
    && verifiedAt <= notAfter;
}

function rawRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function pushIssue(issues: Stage8BlindReviewReadinessIssue[], issue: Stage8BlindReviewReadinessIssue): void {
  if (!issues.some(item => item.code === issue.code && item.path === issue.path)) issues.push(issue);
}

export async function validateStage8BlindReviewIntake(input: { repoRoot: string; intake: unknown; now?: string }): Promise<Stage8BlindReviewReadinessReport> {
  const now = input.now ?? new Date().toISOString();
  const nowMs = Date.parse(now);
  const { bindings, sourceBindings } = await loadBenchmarkBindings(input.repoRoot);
  const intakeRecord = rawRecord(input.intake);
  const incomingProjects = Array.isArray(intakeRecord.projects) ? intakeRecord.projects : [];
  const parsedIntake = Stage8BlindReviewIntakeSchema.safeParse(input.intake);
  const globalErrors: Stage8BlindReviewReadinessIssue[] = [];
  if (!parsedIntake.success) for (const issue of parsedIntake.error.issues.slice(0, 100)) pushIssue(globalErrors, {
    code: 'stage8_intake_schema_invalid', path: issue.path.join('.'), gate: 'schema', message: issue.message,
  });
  const operator = rawRecord(intakeRecord.operator);
  const submittedAt = Date.parse(String(intakeRecord.submitted_at ?? ''));
  if (!String(intakeRecord.submitted_at ?? '').trim() || !Number.isFinite(submittedAt)) pushIssue(globalErrors, {
    code: 'stage8_submitted_at_invalid', path: 'submitted_at', gate: 'schema', message: 'submitted_at must be a verified timestamp.',
  });
  if (!Number.isFinite(nowMs) || (Number.isFinite(submittedAt) && submittedAt > nowMs)) pushIssue(globalErrors, {
    code: 'stage8_submitted_at_future', path: 'submitted_at', gate: 'schema', message: 'submitted_at cannot be later than the validation time.',
  });
  for (const field of ['operator_id', 'display_name', 'contact_reference']) if (!String(operator[field] ?? '').trim()) pushIssue(globalErrors, {
    code: `stage8_${field}_missing`, path: `operator.${field}`, gate: 'schema', message: `${field} is required for a real intake.`,
  });
  const runIds = incomingProjects.map(item => String(rawRecord(item).run_id ?? '')).filter(Boolean);
  const runIdCounts = new Map<string, number>();
  for (const runId of runIds) runIdCounts.set(runId, (runIdCounts.get(runId) ?? 0) + 1);

  const projects: Stage8BlindReviewProjectReadiness[] = [];
  for (const binding of bindings) {
    const candidates = incomingProjects.filter(item => rawRecord(item).benchmark_id === binding.benchmarkId);
    const rawProject = candidates[0] ?? {};
    const parsedProject = Stage8BlindReviewIntakeProjectSchema.safeParse(rawProject);
    const project = parsedProject.success ? parsedProject.data as Stage8BlindReviewIntakeProject : undefined;
    const issues: Stage8BlindReviewReadinessIssue[] = [];
    if (!parsedProject.success) for (const issue of parsedProject.error.issues.slice(0, 30)) pushIssue(issues, {
      code: 'stage8_project_schema_invalid', path: issue.path.join('.'), gate: 'schema', message: issue.message,
    });
    const raw = rawRecord(rawProject);
    const claimsCredit = raw.human_blind_review_passed === true || raw.professional_passed === true;
    const finalPackage = project?.final_package ?? { path: '', sha256: '' };
    const baseline = project?.baseline;
    const [finalArtifact, baselineArtifact] = await Promise.all([
      inspectRepositoryArtifact(input.repoRoot, finalPackage.path, finalPackage.sha256),
      inspectRepositoryArtifact(input.repoRoot, baseline?.path ?? '', baseline?.sha256 ?? ''),
    ]);
    const assignments = project?.reviewer_assignments ?? [];
    const parsedFinalPackage = ProfessionalTextPackageSchema.safeParse(finalArtifact.jsonValue);
    const roles = assignments.map(item => item.role);
    const reviewerIds = assignments.map(item => item.reviewer_id).filter(Boolean);
    const dueAt = Date.parse(project?.review_schedule.due_at ?? '');
    const checks: Stage8BlindReviewProjectReadiness['checks'] = {
      project_schema_valid: parsedProject.success && candidates.length === 1,
      registry_binding_valid: project?.benchmark_id === binding.benchmarkId && project.video_type === binding.videoType && project.source_entry === binding.sourceEntry,
      real_provenance_verified: project?.provenance === 'operator_submitted_real_review',
      run_id_present_and_unique: Boolean(project?.run_id.trim() && runIdCounts.get(project.run_id) === 1),
      final_package_file_valid: finalArtifact.fileValid,
      final_package_sha256_valid: finalArtifact.digestValid,
      final_package_schema_valid: parsedFinalPackage.success,
      final_package_video_type_binding_valid: parsedFinalPackage.success && parsedFinalPackage.data.video_type === binding.videoType,
      final_package_content_complete: parsedFinalPackage.success && parsedFinalPackage.data.status !== 'skeleton'
        && Boolean(parsedFinalPackage.data.full_text.trim() && parsedFinalPackage.data.scene_breakdown.length
          && parsedFinalPackage.data.delivery_text_package.script_text.trim()),
      blind_randomization_valid: Boolean(project?.randomization.batch_id.trim() && project.randomization.candidate_label.trim() && project.randomization.candidate_origin_hidden_from_reviewers),
      authorized_baseline_file_valid: baselineArtifact.fileValid,
      authorized_baseline_sha256_valid: baselineArtifact.digestValid,
      baseline_rights_verified: Boolean(baseline && baseline.rights !== 'pending' && baseline.baseline_id.trim() && isVerified(baseline.rights_verification, submittedAt)),
      three_role_assignments_verified: assignments.length === 3 && new Set(roles).size === 3 && REQUIRED_ROLES.every(role => roles.includes(role))
        && reviewerIds.length === 3 && new Set(reviewerIds).size === 3 && assignments.every(item => isVerified(item.identity_verification, submittedAt) && !item.conflict_of_interest_declared),
      reviewer_independence_verified: assignments.length === 3 && assignments.every(item => isVerified(item.independence_verification, submittedAt)),
      review_schedule_verified: Boolean(project?.review_schedule.schedule_reference.trim() && project.review_schedule.timezone.trim()
        && Number.isFinite(dueAt) && dueAt > submittedAt && dueAt > nowMs && isVerified(project.review_schedule.verification, submittedAt)),
      source_claimed_credit_rejected: !claimsCredit && project?.human_blind_review_passed === false && project.professional_passed === false,
    };
    const gates: Array<[keyof typeof checks, string, Stage8BlindReviewReadinessIssue['gate'], string, string]> = [
      ['project_schema_valid', 'stage8_project_schema_or_identity_invalid', 'schema', 'project', 'Project must match the unified Stage 8 intake schema exactly once.'],
      ['registry_binding_valid', 'stage8_registry_binding_invalid', 'registry', 'benchmark_id', 'Benchmark ID, video type, and source entry must match the frozen 75-project registry.'],
      ['real_provenance_verified', 'stage8_real_review_provenance_missing', 'provenance', 'provenance', 'Preparation, fixture, simulation, and fallback inputs are not real blind-review evidence.'],
      ['run_id_present_and_unique', 'stage8_run_id_missing_or_duplicate', 'package', 'run_id', 'A unique real run ID is required.'],
      ['final_package_file_valid', 'stage8_final_package_file_missing', 'package', 'final_package.path', 'Final ProfessionalTextPackage artifact must exist inside the repository.'],
      ['final_package_sha256_valid', 'stage8_final_package_sha256_invalid', 'package', 'final_package.sha256', 'Final package SHA-256 must match the file bytes.'],
      ['final_package_schema_valid', 'stage8_final_package_schema_invalid', 'package', 'final_package.path', 'Final artifact must satisfy ProfessionalTextPackage v1.'],
      ['final_package_video_type_binding_valid', 'stage8_final_package_video_type_mismatch', 'package', 'final_package.path', 'Final package video type must match the frozen benchmark project.'],
      ['final_package_content_complete', 'stage8_final_package_content_incomplete', 'package', 'final_package.path', 'Skeleton or empty final text cannot enter blind review.'],
      ['blind_randomization_valid', 'stage8_blind_randomization_invalid', 'randomization', 'randomization', 'Randomized candidate label and origin concealment are required.'],
      ['authorized_baseline_file_valid', 'stage8_baseline_file_missing', 'baseline', 'baseline.path', 'Authorized comparison baseline artifact must exist inside the repository.'],
      ['authorized_baseline_sha256_valid', 'stage8_baseline_sha256_invalid', 'baseline', 'baseline.sha256', 'Baseline SHA-256 must match the file bytes.'],
      ['baseline_rights_verified', 'stage8_baseline_rights_unverified', 'baseline', 'baseline.rights_verification', 'Baseline rights and verification must be complete.'],
      ['three_role_assignments_verified', 'stage8_three_role_assignments_unverified', 'reviewer', 'reviewer_assignments', 'Three unique, identity-verified, conflict-free review roles are required.'],
      ['reviewer_independence_verified', 'stage8_reviewer_independence_unverified', 'reviewer', 'reviewer_assignments', 'Each reviewer must have independent-review verification.'],
      ['review_schedule_verified', 'stage8_review_schedule_unverified', 'schedule', 'review_schedule', 'A verified review deadline and schedule reference are required.'],
      ['source_claimed_credit_rejected', 'stage8_self_reported_credit_rejected', 'credit', 'human_blind_review_passed', 'Intake cannot self-grant blind-review or professional-pass credit.'],
    ];
    for (const [key, code, gate, issuePath, message] of gates) if (!checks[key]) pushIssue(issues, { code, path: issuePath, gate, message });
    const ready = Object.values(checks).every(Boolean) && globalErrors.length === 0;
    projects.push({
      benchmark_id: binding.benchmarkId,
      video_type: binding.videoType,
      source_entry: binding.sourceEntry,
      status: ready ? 'ready_for_external_blind_review' : 'blocked',
      blockers: issues,
      checks,
      review_record_persisted: false,
      human_blind_review_passed: false,
      professional_passed: false,
    });
  }
  const readyCount = projects.filter(item => item.status === 'ready_for_external_blind_review').length;
  const reviewerReadyCount = projects.filter(item => item.checks.three_role_assignments_verified && item.checks.reviewer_independence_verified).length;
  return {
    schema_version: 'story-agent-stage8-blind-review-readiness/v1',
    generated_at: now,
    source_intake_canonical_sha256: stage8BlindReviewCanonicalSha256(input.intake),
    source_bindings: sourceBindings,
    policy: {
      readiness_is_human_blind_review_pass: false,
      fixture_simulation_fallback_counts_as_real_review: false,
      threshold_evaluation_without_verified_human_artifacts_counts_as_pass: false,
      intake_can_persist_reviews: false,
      intake_can_grant_professional_pass: false,
    },
    global_errors: globalErrors,
    summary: {
      target_video_type_count: 15,
      project_count: 75,
      ready_for_external_blind_review_count: readyCount,
      blocked_project_count: 75 - readyCount,
      reviewer_assignment_ready_project_count: reviewerReadyCount,
      human_blind_review_pass_project_count: 0,
      human_blind_review_pass_project_target: 45,
      professional_pass_count: 0,
    },
    video_types: (Object.keys(VIDEO_TYPE_CONFIG) as VideoType[]).map(videoType => {
      const items = projects.filter(item => item.video_type === videoType);
      const readyProjectCount = items.filter(item => item.status === 'ready_for_external_blind_review').length;
      return {
        video_type: videoType,
        label: VIDEO_TYPE_CONFIG[videoType].label,
        project_count: 5,
        ready_project_count: readyProjectCount,
        blocked_project_count: 5 - readyProjectCount,
        human_blind_review_pass_project_count: 0,
      };
    }),
    projects,
  };
}

export async function inspectStage8BlindReviewIntake(input: { repoRoot: string; request: unknown; now?: string }): Promise<Stage8BlindReviewValidationResult> {
  const report = await validateStage8BlindReviewIntake({ repoRoot: input.repoRoot, intake: input.request, now: input.now });
  return {
    schema_version: 'story-agent-stage8-blind-review-validation/v1',
    generated_at: report.generated_at,
    dry_run_only: true,
    input_persisted: false,
    review_record_persisted: false,
    review_execution_started: false,
    human_blind_review_passed: false,
    professional_passed: false,
    report,
  };
}

export async function getStage8BlindReviewWorkspace(input: { repoRoot: string; now?: string }): Promise<Stage8BlindReviewWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const { bindings } = await loadBenchmarkBindings(input.repoRoot);
  const template: Stage8BlindReviewIntake = {
    schema_version: 'story-agent-stage8-blind-review-intake/v1',
    submitted_at: '',
    operator: { operator_id: '', display_name: '', contact_reference: '' },
    projects: bindings.map(projectTemplate),
  };
  const templateValidation = await inspectStage8BlindReviewIntake({ repoRoot: input.repoRoot, request: template, now });
  if (templateValidation.report.summary.project_count !== 75 || templateValidation.report.summary.ready_for_external_blind_review_count !== 0) {
    throw new Error('stage8_blind_review_template_baseline_drifted');
  }
  return {
    schema_version: 'story-agent-stage8-blind-review-workspace/v1',
    generated_at: now,
    policy: { dry_run_only: true, ...templateValidation.report.policy },
    thresholds: {
      minimum_weighted_average_score: 85,
      minimum_dimension_score: 75,
      maximum_baseline_gap: 3,
      minimum_production_advance_vote_ratio: '2/3',
      required_role_count: 3,
      hard_gate_failure_count_required: 0,
    },
    template,
    template_raw_json: `${JSON.stringify(template, null, 2)}\n`,
    template_validation: templateValidation,
  };
}
