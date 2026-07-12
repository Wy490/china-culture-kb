import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  ProfessionalTextPackageSchema,
  Stage6RealInputIntakeSchema,
  Stage6RealInputProjectSchema,
  Stage6RealInputReadinessReportSchema,
} from '@shared/schemas.js';
import type {
  Stage6RealInputIntake,
  Stage6RealInputProject,
  Stage6RealInputProjectReadiness,
  Stage6RealInputReadinessIssue,
  Stage6RealInputReadinessReport,
  Stage6VerificationRecord,
  VideoType,
} from '@shared/types.js';
import type { MultiRoundRevisionSpecRegistry } from './professional-multi-round-revision-execution-service.js';

const REQUIRED_REVIEWER_ROLES = [
  'writer_editor',
  'director',
  'fact_culture_reviewer',
] as const;

const ANONYMOUS_MARKERS = new Set([
  'anonymous',
  'anon',
  'unknown',
  'n/a',
  'na',
  'tbd',
  '待定',
  '匿名',
  '未知',
]);

function emptyVerification(): Stage6VerificationRecord {
  return { status: 'unverified', reference: '', verified_by: '', verified_at: '' };
}

export function buildStage6RealInputOperatorTemplate(
  registry: MultiRoundRevisionSpecRegistry,
): Stage6RealInputIntake {
  return {
    schema_version: 'story-agent-stage6-real-input-intake/v1',
    submitted_at: '',
    operator: { operator_id: '', display_name: '', contact_reference: '' },
    projects: registry.projects.map(project => ({
      benchmark_id: project.benchmark_id,
      video_type: project.video_type,
      source_entry: project.source_entry,
      provenance: 'preparation_template',
      real_project_id: '',
      initial_package: { path: '', sha256: '' },
      creator_authorization: {
        subject_type: 'human_author',
        subject_id: '',
        authorized_rounds: [],
        verification: emptyVerification(),
      },
      revision_budget: {
        currency: '',
        amount: 0,
        authorized_rounds: [],
        verification: emptyVerification(),
      },
      reviewers: REQUIRED_REVIEWER_ROLES.map(role => ({
        role,
        reviewer_id: '',
        display_name: '',
        identity_verification: emptyVerification(),
      })),
      table_read: {
        schedule_reference: '',
        scheduled_at: '',
        timezone: '',
        participant_reviewer_ids: [],
        verification: emptyVerification(),
      },
    })),
  };
}

function issue(code: string, issuePath: string, message: string): Stage6RealInputReadinessIssue {
  return { code, path: issuePath, message };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function stage6CanonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function pushIssue(
  issues: Stage6RealInputReadinessIssue[],
  code: string,
  issuePath: string,
  message: string,
): void {
  if (!issues.some(item => item.code === code && item.path === issuePath)) {
    issues.push(issue(code, issuePath, message));
  }
}

function nonAnonymous(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !ANONYMOUS_MARKERS.has(normalized);
}

function validDateTime(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function verified(record: Stage6VerificationRecord): boolean {
  return record.status === 'verified'
    && nonAnonymous(record.reference)
    && nonAnonymous(record.verified_by)
    && validDateTime(record.verified_at);
}

function coversBothRounds(rounds: Array<1 | 2>): boolean {
  return new Set(rounds).size === 2 && rounds.includes(1) && rounds.includes(2);
}

function pathIsWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function baseChecks(intakeSchemaValid: boolean): Stage6RealInputProjectReadiness['checks'] {
  return {
    intake_schema_valid: intakeSchemaValid,
    registry_binding_valid: false,
    real_provenance_verified: false,
    real_project_id_valid: false,
    initial_package_file_valid: false,
    initial_package_schema_valid: false,
    initial_package_binding_valid: false,
    initial_package_sha256_valid: false,
    creator_authorization_verified: false,
    revision_budget_verified: false,
    reviewer_assignments_verified: false,
    table_read_verified: false,
  };
}

function rawProjects(input: unknown): unknown[] {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { projects?: unknown }).projects)) return [];
  return (input as { projects: unknown[] }).projects;
}

function rawString(input: unknown, key: string): string {
  if (!input || typeof input !== 'object') return '';
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function validateInitialPackage(input: {
  project: Stage6RealInputProject;
  repoRoot: string;
  blockers: Stage6RealInputReadinessIssue[];
  checks: Stage6RealInputProjectReadiness['checks'];
  basePath: string;
}): void {
  const artifactPath = input.project.initial_package.path.trim();
  if (!artifactPath) {
    pushIssue(input.blockers, 'initial_package_path_missing', `${input.basePath}.initial_package.path`, 'Initial ProfessionalTextPackage path is required.');
    return;
  }
  let resolvedPath: string;
  let contents: Buffer;
  try {
    const candidate = path.resolve(input.repoRoot, artifactPath);
    resolvedPath = realpathSync(candidate);
    const realRoot = realpathSync(input.repoRoot);
    if (!pathIsWithin(realRoot, resolvedPath)) {
      pushIssue(input.blockers, 'initial_package_path_outside_repository', `${input.basePath}.initial_package.path`, 'Initial package must resolve inside the repository.');
      return;
    }
    contents = readFileSync(resolvedPath);
    input.checks.initial_package_file_valid = true;
  } catch {
    pushIssue(input.blockers, 'initial_package_file_not_found', `${input.basePath}.initial_package.path`, 'Initial package file does not exist or cannot be read.');
    return;
  }

  const expectedSha = input.project.initial_package.sha256.trim().toLowerCase();
  const actualSha = createHash('sha256').update(contents).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(expectedSha)) {
    pushIssue(input.blockers, 'initial_package_sha256_invalid', `${input.basePath}.initial_package.sha256`, 'A lowercase 64-character SHA-256 is required.');
  } else if (expectedSha !== actualSha) {
    pushIssue(input.blockers, 'initial_package_sha256_mismatch', `${input.basePath}.initial_package.sha256`, 'Initial package SHA-256 does not match the file.');
  } else {
    input.checks.initial_package_sha256_valid = true;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(contents.toString('utf8'));
  } catch {
    pushIssue(input.blockers, 'initial_package_json_invalid', `${input.basePath}.initial_package.path`, 'Initial package is not valid JSON.');
    return;
  }
  const packageResult = ProfessionalTextPackageSchema.safeParse(parsedJson);
  if (!packageResult.success) {
    const first = packageResult.error.issues[0];
    pushIssue(
      input.blockers,
      'initial_package_schema_invalid',
      `${input.basePath}.initial_package.path`,
      `Initial package violates ProfessionalTextPackage schema${first ? `: ${first.path.join('.')} ${first.message}` : ''}.`,
    );
    return;
  }
  input.checks.initial_package_schema_valid = true;
  const pkg = packageResult.data;
  const bindingValid = pkg.project_id === input.project.real_project_id
    && pkg.video_type === input.project.video_type;
  if (!bindingValid) {
    pushIssue(input.blockers, 'initial_package_binding_mismatch', `${input.basePath}.initial_package.path`, 'Package project_id and video_type must match this real project intake.');
  } else if (pkg.status === 'skeleton'
    || !pkg.full_text.trim()
    || pkg.sequence_beats.length === 0
    || pkg.scene_breakdown.length === 0
    || !pkg.delivery_text_package.script_text.trim()) {
    pushIssue(input.blockers, 'initial_package_not_revisionable', `${input.basePath}.initial_package.path`, 'Initial package must contain a revisionable draft, scenes, beats, and delivery script text.');
  } else {
    input.checks.initial_package_binding_valid = true;
  }
}

function validateReviewers(input: {
  project: Stage6RealInputProject;
  blockers: Stage6RealInputReadinessIssue[];
  checks: Stage6RealInputProjectReadiness['checks'];
  basePath: string;
}): string[] {
  const reviewerIds: string[] = [];
  let valid = true;
  for (const role of REQUIRED_REVIEWER_ROLES) {
    const matches = input.project.reviewers.filter(reviewer => reviewer.role === role);
    if (matches.length !== 1) {
      valid = false;
      pushIssue(input.blockers, 'reviewer_role_assignment_invalid', `${input.basePath}.reviewers`, `Exactly one ${role} reviewer is required.`);
      continue;
    }
    const reviewer = matches[0];
    if (!nonAnonymous(reviewer.reviewer_id) || !nonAnonymous(reviewer.display_name)) {
      valid = false;
      pushIssue(input.blockers, 'anonymous_reviewer_not_allowed', `${input.basePath}.reviewers.${role}`, `${role} must have a non-anonymous ID and display name.`);
    } else {
      reviewerIds.push(reviewer.reviewer_id.trim());
    }
    if (!verified(reviewer.identity_verification)) {
      valid = false;
      pushIssue(input.blockers, 'reviewer_identity_unverified', `${input.basePath}.reviewers.${role}.identity_verification`, `${role} identity verification is incomplete.`);
    }
  }
  if (new Set(reviewerIds).size !== reviewerIds.length) {
    valid = false;
    pushIssue(input.blockers, 'reviewer_id_reused_across_roles', `${input.basePath}.reviewers`, 'The three required reviewer roles must use distinct reviewer IDs.');
  }
  input.checks.reviewer_assignments_verified = valid;
  return reviewerIds;
}

function validateProject(input: {
  project: Stage6RealInputProject;
  spec: MultiRoundRevisionSpecRegistry['projects'][number];
  repoRoot: string;
  duplicateRealProjectIds: Set<string>;
  operatorBlockers: Stage6RealInputReadinessIssue[];
}): Stage6RealInputProjectReadiness {
  const basePath = `projects.${input.spec.benchmark_id}`;
  const blockers = input.operatorBlockers.map(item => ({ ...item }));
  const checks = baseChecks(true);
  checks.registry_binding_valid = input.project.benchmark_id === input.spec.benchmark_id
    && input.project.video_type === input.spec.video_type
    && input.project.source_entry === input.spec.source_entry;
  if (!checks.registry_binding_valid) {
    pushIssue(blockers, 'registry_binding_mismatch', basePath, 'benchmark_id, video_type, and source_entry must match the Stage 6 registry.');
  }

  checks.real_provenance_verified = input.project.provenance === 'operator_submitted_real_input';
  if (!checks.real_provenance_verified) {
    pushIssue(blockers, 'real_input_provenance_required', `${basePath}.provenance`, 'Fixture, simulation, fallback, and preparation provenance cannot become ready.');
  }

  const realProjectId = input.project.real_project_id.trim();
  checks.real_project_id_valid = nonAnonymous(realProjectId) && !input.duplicateRealProjectIds.has(realProjectId);
  if (!nonAnonymous(realProjectId)) {
    pushIssue(blockers, 'real_project_id_missing', `${basePath}.real_project_id`, 'A non-placeholder real project ID is required.');
  } else if (input.duplicateRealProjectIds.has(realProjectId)) {
    pushIssue(blockers, 'duplicate_real_project_id', `${basePath}.real_project_id`, 'Real project ID must be unique across the 15-project intake.');
  }

  validateInitialPackage({ project: input.project, repoRoot: input.repoRoot, blockers, checks, basePath });

  const authorization = input.project.creator_authorization;
  checks.creator_authorization_verified = nonAnonymous(authorization.subject_id)
    && coversBothRounds(authorization.authorized_rounds)
    && verified(authorization.verification);
  if (!checks.creator_authorization_verified) {
    pushIssue(blockers, 'creator_authorization_unverified', `${basePath}.creator_authorization`, 'Creator/model authorization must be verified and cover rounds 1 and 2.');
  }

  const budget = input.project.revision_budget;
  checks.revision_budget_verified = budget.amount > 0
    && nonAnonymous(budget.currency)
    && coversBothRounds(budget.authorized_rounds)
    && verified(budget.verification);
  if (!checks.revision_budget_verified) {
    pushIssue(blockers, 'revision_budget_unverified', `${basePath}.revision_budget`, 'A verified positive budget covering rounds 1 and 2 is required.');
  }

  const reviewerIds = validateReviewers({ project: input.project, blockers, checks, basePath });
  const participantIds = new Set(input.project.table_read.participant_reviewer_ids.map(value => value.trim()).filter(Boolean));
  checks.table_read_verified = nonAnonymous(input.project.table_read.schedule_reference)
    && validDateTime(input.project.table_read.scheduled_at)
    && nonAnonymous(input.project.table_read.timezone)
    && reviewerIds.length === 3
    && reviewerIds.every(reviewerId => participantIds.has(reviewerId))
    && verified(input.project.table_read.verification);
  if (!checks.table_read_verified) {
    pushIssue(blockers, 'table_read_schedule_unverified', `${basePath}.table_read`, 'Verified table-read scheduling must include all three assigned reviewer IDs.');
  }

  return {
    benchmark_id: input.spec.benchmark_id,
    video_type: input.spec.video_type,
    source_entry: input.spec.source_entry,
    real_project_id: realProjectId,
    initial_package_path: input.project.initial_package.path,
    initial_package_sha256: input.project.initial_package.sha256,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    blockers,
    checks,
    completed_verified_round_count: 0,
    professional_passed: false,
  };
}

export function validateStage6RealInputIntake(input: {
  intake: unknown;
  registry: MultiRoundRevisionSpecRegistry;
  repoRoot: string;
  sourceIntakePath?: string;
  now?: string;
}): Stage6RealInputReadinessReport {
  if (input.registry.schema_version !== 'all-format-professional-multi-round-revision-specs/v1'
    || input.registry.projects.length !== 15
    || new Set(input.registry.projects.map(project => project.video_type)).size !== 15) {
    throw new Error('stage6_real_input_registry_invalid');
  }

  const globalErrors: Stage6RealInputReadinessIssue[] = [];
  const fullSchemaResult = Stage6RealInputIntakeSchema.safeParse(input.intake);
  if (!fullSchemaResult.success) {
    for (const schemaIssue of fullSchemaResult.error.issues) {
      pushIssue(globalErrors, 'intake_schema_invalid', schemaIssue.path.join('.'), schemaIssue.message);
    }
  }
  const raw = input.intake && typeof input.intake === 'object'
    ? input.intake as Record<string, unknown>
    : {};
  if (rawString(raw, 'schema_version') !== 'story-agent-stage6-real-input-intake/v1') {
    pushIssue(globalErrors, 'intake_schema_version_invalid', 'schema_version', 'Unsupported Stage 6 real-input intake schema version.');
  }
  if (!validDateTime(rawString(raw, 'submitted_at'))) {
    pushIssue(globalErrors, 'intake_submitted_at_invalid', 'submitted_at', 'Operator submission timestamp must be an ISO date-time.');
  }
  const operator = raw.operator && typeof raw.operator === 'object'
    ? raw.operator as Record<string, unknown>
    : {};
  const operatorBlockers: Stage6RealInputReadinessIssue[] = [];
  if (!nonAnonymous(rawString(operator, 'operator_id')) || !nonAnonymous(rawString(operator, 'display_name'))) {
    pushIssue(operatorBlockers, 'operator_identity_missing', 'operator', 'A non-anonymous operator ID and display name are required.');
  }
  if (!nonAnonymous(rawString(operator, 'contact_reference'))) {
    pushIssue(operatorBlockers, 'operator_contact_reference_missing', 'operator.contact_reference', 'An auditable operator contact reference is required.');
  }
  globalErrors.push(...operatorBlockers);

  const rawItems = rawProjects(input.intake);
  const parsedItems = rawItems.map(item => Stage6RealInputProjectSchema.safeParse(item));
  const validProjects = parsedItems.filter(result => result.success).map(result => result.data);
  const duplicateRealProjectIds = new Set<string>();
  const realIdCounts = new Map<string, number>();
  for (const project of validProjects) {
    const realId = project.real_project_id.trim();
    if (realId) realIdCounts.set(realId, (realIdCounts.get(realId) ?? 0) + 1);
  }
  for (const [realId, count] of realIdCounts) if (count > 1) duplicateRealProjectIds.add(realId);

  const registryIds = new Set(input.registry.projects.map(project => project.benchmark_id));
  for (const project of validProjects) {
    if (!registryIds.has(project.benchmark_id)) {
      pushIssue(globalErrors, 'unknown_benchmark_id', `projects.${project.benchmark_id}`, 'Intake project is not present in the Stage 6 registry.');
    }
  }

  const projects = input.registry.projects.map(spec => {
    const matchingRaw = rawItems.filter(item => rawString(item, 'benchmark_id') === spec.benchmark_id);
    if (matchingRaw.length !== 1) {
      const blockers = operatorBlockers.map(item => ({ ...item }));
      pushIssue(
        blockers,
        matchingRaw.length === 0 ? 'intake_project_missing' : 'duplicate_benchmark_id',
        `projects.${spec.benchmark_id}`,
        matchingRaw.length === 0 ? 'Registry project is missing from intake.' : 'benchmark_id appears more than once in intake.',
      );
      return {
        benchmark_id: spec.benchmark_id,
        video_type: spec.video_type,
        source_entry: spec.source_entry,
        real_project_id: '',
        initial_package_path: '',
        initial_package_sha256: '',
        status: 'blocked' as const,
        blockers,
        checks: baseChecks(false),
        completed_verified_round_count: 0 as const,
        professional_passed: false as const,
      };
    }
    const projectResult = Stage6RealInputProjectSchema.safeParse(matchingRaw[0]);
    if (!projectResult.success) {
      const blockers = operatorBlockers.map(item => ({ ...item }));
      for (const schemaIssue of projectResult.error.issues) {
        pushIssue(blockers, 'intake_project_schema_invalid', `projects.${spec.benchmark_id}.${schemaIssue.path.join('.')}`, schemaIssue.message);
      }
      return {
        benchmark_id: spec.benchmark_id,
        video_type: spec.video_type,
        source_entry: spec.source_entry,
        real_project_id: rawString(matchingRaw[0], 'real_project_id'),
        initial_package_path: '',
        initial_package_sha256: '',
        status: 'blocked' as const,
        blockers,
        checks: baseChecks(false),
        completed_verified_round_count: 0 as const,
        professional_passed: false as const,
      };
    }
    return validateProject({
      project: projectResult.data,
      spec,
      repoRoot: input.repoRoot,
      duplicateRealProjectIds,
      operatorBlockers,
    });
  });

  const report: Stage6RealInputReadinessReport = {
    schema_version: 'story-agent-stage6-real-input-readiness/v1',
    generated_at: input.now ?? new Date().toISOString(),
    source_intake_path: input.sourceIntakePath ?? '',
    source_intake_schema_version: rawString(raw, 'schema_version'),
    source_intake_canonical_sha256: stage6CanonicalSha256(input.intake),
    source_registry_schema_version: input.registry.schema_version,
    source_registry_canonical_sha256: stage6CanonicalSha256(input.registry),
    policy: {
      readiness_counts_as_completed_revision: false,
      fixture_simulation_fallback_counts_as_real_input: false,
      professional_pass_can_be_granted_by_intake: false,
    },
    global_errors: globalErrors,
    summary: {
      project_count: projects.length,
      ready_project_count: projects.filter(project => project.status === 'ready').length,
      blocked_project_count: projects.filter(project => project.status === 'blocked').length,
      completed_verified_revision_round_count: 0,
      professional_pass_count: 0,
    },
    projects,
  };
  const reportResult = Stage6RealInputReadinessReportSchema.safeParse(report);
  if (!reportResult.success) {
    throw new Error(`stage6_real_input_readiness_report_invalid:${reportResult.error.issues.map(item => `${item.path.join('.')}:${item.message}`).join('|')}`);
  }
  return report;
}

export function validateStage6RealInputReadinessReport(report: unknown): string[] {
  const result = Stage6RealInputReadinessReportSchema.safeParse(report);
  return result.success
    ? []
    : result.error.issues.map(item => `${item.path.join('.')}:${item.message}`);
}

export function stage6ReadinessByVideoType(
  report: Stage6RealInputReadinessReport,
): Record<VideoType, 'ready' | 'blocked'> {
  return Object.fromEntries(report.projects.map(project => [project.video_type, project.status])) as Record<VideoType, 'ready' | 'blocked'>;
}
