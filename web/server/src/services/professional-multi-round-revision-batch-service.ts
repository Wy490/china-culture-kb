import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  ProfessionalTextPackageFieldSchema,
  ProfessionalTextPackageSchema,
  Stage6RealInputIntakeSchema,
  Stage6RealInputReadinessReportSchema,
} from '@shared/schemas.js';
import type {
  ProfessionalTextPackage,
  ProfessionalTextPackageField,
  Stage6RealInputIntake,
  Stage6RealInputReadinessReport,
} from '@shared/types.js';
import {
  buildProfessionalCoverageActionSet,
  importProfessionalTableReadFeedback,
  professionalPackageSha256,
  recordProfessionalRevisionRound,
  validateProfessionalMultiRoundRevisionLedger,
  type ProfessionalMultiRoundRevisionLedger,
  type ProfessionalRevisionArtifactKind,
  type ProfessionalTableReadFeedback,
} from './professional-multi-round-revision-service.js';
import {
  stage6CanonicalSha256,
  validateStage6RealInputIntake,
} from './professional-multi-round-revision-intake-service.js';
import type { MultiRoundRevisionSpecRegistry } from './professional-multi-round-revision-execution-service.js';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmptyStringSchema = z.string().trim().min(1);
const TimestampSchema = z.string().datetime({ offset: true });
const FileReferenceSchema = z.object({
  path: NonEmptyStringSchema,
  sha256: HashSchema,
}).strict();

export const Stage6RevisionBatchCommandSchema = z.object({
  schema_version: z.literal('story-agent-stage6-revision-batch-command/v1'),
  command_id: NonEmptyStringSchema,
  created_at: TimestampSchema,
  benchmark_id: NonEmptyStringSchema,
  real_project_id: NonEmptyStringSchema,
  round_number: z.union([z.literal(1), z.literal(2)]),
  opt_in_execution_confirmed: z.literal(true),
  readiness_report: FileReferenceSchema,
  before_package: FileReferenceSchema,
  revision_submission: FileReferenceSchema,
  table_read_feedback: FileReferenceSchema,
  cost_record: FileReferenceSchema,
  declared_changed_sections: z.array(ProfessionalTextPackageFieldSchema).min(1),
  feedback_resolutions: z.array(z.object({
    feedback_id: NonEmptyStringSchema,
    resolution_note: NonEmptyStringSchema,
  }).strict()),
  provenance: z.object({
    artifact_kind: z.enum(['real_model', 'human_authored', 'simulation', 'fixture']),
    output_id: NonEmptyStringSchema,
    model_or_author: NonEmptyStringSchema,
    prompt_or_brief_version: NonEmptyStringSchema,
    provenance_verified: z.boolean(),
    verification_reference: NonEmptyStringSchema,
    verified_by: NonEmptyStringSchema,
    verified_at: TimestampSchema,
  }).strict(),
}).strict();

export type Stage6RevisionBatchCommand = z.infer<typeof Stage6RevisionBatchCommandSchema>;

export const Stage6TableReadArtifactSchema = z.object({
  schema_version: z.literal('story-agent-stage6-table-read-feedback/v1'),
  benchmark_id: NonEmptyStringSchema,
  real_project_id: NonEmptyStringSchema,
  round_number: z.union([z.literal(1), z.literal(2)]),
  session_reference: NonEmptyStringSchema,
  submitted_at: TimestampSchema,
  feedback: z.array(z.object({
    feedback_id: NonEmptyStringSchema,
    reviewer_id: NonEmptyStringSchema,
    source: z.enum(['writer_editor', 'director', 'fact_culture_reviewer', 'user']),
    category: z.enum(['structure', 'character_or_information', 'scene', 'dialogue_or_narration', 'pacing', 'fact_and_culture']),
    note: NonEmptyStringSchema,
    issue_id: NonEmptyStringSchema,
    target_sections: z.array(ProfessionalTextPackageFieldSchema).min(1),
    evidence_required: z.boolean(),
  }).strict()).min(3),
}).strict();

export const Stage6RevisionCostArtifactSchema = z.object({
  schema_version: z.literal('story-agent-stage6-revision-cost/v1'),
  benchmark_id: NonEmptyStringSchema,
  real_project_id: NonEmptyStringSchema,
  round_number: z.union([z.literal(1), z.literal(2)]),
  output_id: NonEmptyStringSchema,
  provider_or_author: NonEmptyStringSchema,
  amount: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  usage_reference: NonEmptyStringSchema,
  recorded_at: TimestampSchema,
}).strict();

export type Stage6TableReadArtifact = z.infer<typeof Stage6TableReadArtifactSchema>;
export type Stage6RevisionCostArtifact = z.infer<typeof Stage6RevisionCostArtifactSchema>;

export type Stage6RevisionArtifactKind =
  | 'before_package'
  | 'revision_submission'
  | 'table_read_feedback'
  | 'cost_record'
  | 'revised_package'
  | 'coverage_action_set'
  | 'revision_ledger'
  | 'round_manifest';

export interface Stage6RevisionArtifactReference {
  artifact_id: string;
  kind: Stage6RevisionArtifactKind;
  relative_path: string;
  sha256: string;
  byte_size: number;
  parent_sha256: string[];
}

interface Stage6RevisionArtifactEnvelope {
  schema_version: 'story-agent-stage6-revision-artifact/v1';
  artifact_id: string;
  benchmark_id: string;
  real_project_id: string;
  round_number: 1 | 2;
  attempt_number: number;
  kind: Stage6RevisionArtifactKind;
  created_at: string;
  producer: 'operator' | 'model_or_author' | 'story_agent';
  parent_sha256: string[];
  payload_canonical_sha256: string;
  payload: unknown;
  professional_passed: false;
}

interface Stage6RevisionAttemptState {
  attempt_number: number;
  command_id: string;
  command_sha256: string;
  status: 'running' | 'failed' | 'completed';
  started_at: string;
  finished_at: string;
  error_code: string;
  artifacts: Stage6RevisionArtifactReference[];
}

export interface Stage6RevisionProjectExecutionState {
  schema_version: 'story-agent-stage6-revision-execution-state/v1';
  benchmark_id: string;
  real_project_id: string;
  video_type: ProfessionalTextPackage['video_type'];
  attempts: Record<'round_1' | 'round_2', Stage6RevisionAttemptState[]>;
  completed_rounds: Array<{
    round_number: 1 | 2;
    command_id: string;
    before_package_sha256: string;
    after_package_sha256: string;
    round_manifest_artifact: Stage6RevisionArtifactReference;
    revised_package_artifact: Stage6RevisionArtifactReference;
    cost_amount: number;
    cost_currency: string;
    verified_real_revision_credit: boolean;
  }>;
  ledger: ProfessionalMultiRoundRevisionLedger | null;
  professional_passed: false;
}

export interface Stage6RevisionBatchPreflight {
  status: 'ready' | 'blocked' | 'already_completed';
  blockers: string[];
  benchmark_id: string;
  real_project_id: string;
  round_number: 1 | 2;
  attempt_number: number;
  readiness_report_sha256: string;
  command_sha256: string;
  professional_passed: false;
}

export interface Stage6RevisionBatchExecutionResult {
  status: 'completed' | 'recovered';
  benchmark_id: string;
  real_project_id: string;
  round_number: 1 | 2;
  attempt_number: number;
  artifacts: Stage6RevisionArtifactReference[];
  ledger: ProfessionalMultiRoundRevisionLedger;
  verified_real_revision_credit: boolean;
  professional_passed: false;
}

interface LoadedExecutionContext {
  command: Stage6RevisionBatchCommand;
  commandSha256: string;
  report: Stage6RealInputReadinessReport;
  intake: Stage6RealInputIntake;
  intakeProject: Stage6RealInputIntake['projects'][number];
  beforePackage: ProfessionalTextPackage;
  submittedPackage: ProfessionalTextPackage;
  tableRead: Stage6TableReadArtifact;
  cost: Stage6RevisionCostArtifact;
  state: Stage6RevisionProjectExecutionState;
  statePath: string;
  attemptNumber: number;
  artifactRoot: string;
}

const CREATIVE_CHANGE_FIELDS: ProfessionalTextPackageField[] = [
  'creative_brief',
  'audience_promise',
  'premise_or_core_question',
  'theme_statement',
  'truth_and_adaptation_contract',
  'structure_outline',
  'scene_breakdown',
  'full_text',
  'dialogue_or_narration_pass',
  'continuity_ledger',
];

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function resolveInside(repoRoot: string, filePath: string): Promise<string> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(repoRoot, filePath));
  if (!inside(realRoot, resolved)) throw new Error('artifact_path_outside_repository');
  return resolved;
}

async function readReferencedJson(input: {
  repoRoot: string;
  reference: { path: string; sha256: string };
}): Promise<{ value: unknown; bytes: Buffer; resolvedPath: string }> {
  const resolvedPath = await resolveInside(input.repoRoot, input.reference.path);
  const bytes = await readFile(resolvedPath);
  if (sha256(bytes) !== input.reference.sha256) throw new Error('referenced_artifact_sha256_mismatch');
  try {
    return { value: JSON.parse(bytes.toString('utf8')), bytes, resolvedPath };
  } catch {
    throw new Error('referenced_artifact_json_invalid');
  }
}

function parsePackageValue(value: unknown): ReturnType<typeof ProfessionalTextPackageSchema.safeParse> {
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (candidate.schema_version === 'story-agent-stage6-revision-artifact/v1'
      && ['before_package', 'revision_submission', 'revised_package'].includes(String(candidate.kind))) {
      return ProfessionalTextPackageSchema.safeParse(candidate.payload);
    }
  }
  return ProfessionalTextPackageSchema.safeParse(value);
}

function valueEqual(left: unknown, right: unknown): boolean {
  return stage6CanonicalSha256(left) === stage6CanonicalSha256(right);
}

function changedCreativeSections(
  before: ProfessionalTextPackage,
  after: ProfessionalTextPackage,
): ProfessionalTextPackageField[] {
  return CREATIVE_CHANGE_FIELDS.filter(field => !valueEqual(before[field], after[field]));
}

function rebuildDerivedPackage(input: {
  package: ProfessionalTextPackage;
  now: string;
}): { package: ProfessionalTextPackage; rebuiltSections: ProfessionalTextPackageField[] } {
  const pkg = structuredClone(input.package);
  pkg.sequence_beats = pkg.scene_breakdown.map((scene, index) => ({
    beat_id: `stage6-rebuild-beat-${index + 1}`,
    order: index + 1,
    title: scene.title,
    purpose: scene.dramatic_function,
    visible_action: scene.key_action,
    conflict_discovery_or_instruction: scene.conflict ?? scene.plot,
    emotional_or_information_turn: scene.plot,
    evidence_ids: [],
  }));
  pkg.director_text_plan.sequences = pkg.scene_breakdown.map(scene => ({
    sequence_id: `stage6-sequence-${scene.scene_id}`,
    scene_ids: [scene.scene_id],
    blocking_and_visible_action: scene.key_action,
    camera_and_transition_intent: scene.camera_suggestion,
    sound_intent: scene.dialogue_or_narration ?? '环境声与动作声承担推进。',
    production_constraints: [scene.cultural_note].filter(Boolean),
  }));
  pkg.delivery_text_package.script_text = pkg.full_text;
  pkg.delivery_text_package.scene_units = pkg.scene_breakdown.map(scene => ({
    scene_id: scene.scene_id,
    script_text: scene.dialogue_or_narration ?? scene.plot,
    visual_action: scene.key_action,
    camera_intent: scene.camera_suggestion,
    sound_intent: scene.dialogue_or_narration ?? '环境声与动作声承担推进。',
    continuity_notes: [scene.location, ...scene.characters].filter(Boolean),
    evidence_boundary_notes: [scene.factual_basis, ...(scene.fictionalized_elements ?? [])]
      .filter((item): item is string => Boolean(item)),
  }));
  pkg.updated_at = input.now;
  pkg.status = pkg.quality_report.hard_gate_failures.length > 0 ? 'revision_required' : 'in_review';
  pkg.quality_report.professional_passed = false;
  return {
    package: pkg,
    rebuiltSections: ['sequence_beats', 'director_text_plan', 'delivery_text_package'],
  };
}

function emptyState(input: {
  benchmarkId: string;
  realProjectId: string;
  videoType: ProfessionalTextPackage['video_type'];
}): Stage6RevisionProjectExecutionState {
  return {
    schema_version: 'story-agent-stage6-revision-execution-state/v1',
    benchmark_id: input.benchmarkId,
    real_project_id: input.realProjectId,
    video_type: input.videoType,
    attempts: { round_1: [], round_2: [] },
    completed_rounds: [],
    ledger: null,
    professional_passed: false,
  };
}

async function readState(
  statePath: string,
  identity: { benchmarkId: string; realProjectId: string; videoType: ProfessionalTextPackage['video_type'] },
): Promise<Stage6RevisionProjectExecutionState> {
  try {
    const parsed = JSON.parse(await readFile(statePath, 'utf8')) as Stage6RevisionProjectExecutionState;
    if (parsed.schema_version !== 'story-agent-stage6-revision-execution-state/v1'
      || parsed.benchmark_id !== identity.benchmarkId
      || parsed.real_project_id !== identity.realProjectId
      || parsed.video_type !== identity.videoType
      || parsed.professional_passed !== false) {
      throw new Error('revision_execution_state_invalid');
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState(identity);
    throw error;
  }
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporaryPath, filePath);
}

async function writeImmutableArtifact(input: {
  repoRoot: string;
  directory: string;
  envelope: Stage6RevisionArtifactEnvelope;
}): Promise<Stage6RevisionArtifactReference> {
  await mkdir(input.directory, { recursive: true });
  const filePath = path.join(input.directory, `${input.envelope.kind}.json`);
  const bytes = Buffer.from(`${JSON.stringify(input.envelope, null, 2)}\n`, 'utf8');
  try {
    await writeFile(filePath, bytes, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existing = await readFile(filePath);
    if (!existing.equals(bytes)) throw new Error(`immutable_artifact_conflict:${input.envelope.kind}`);
  }
  return {
    artifact_id: input.envelope.artifact_id,
    kind: input.envelope.kind,
    relative_path: path.relative(input.repoRoot, filePath),
    sha256: sha256(bytes),
    byte_size: bytes.byteLength,
    parent_sha256: [...input.envelope.parent_sha256],
  };
}

function envelope(input: {
  context: LoadedExecutionContext;
  kind: Stage6RevisionArtifactKind;
  now: string;
  producer: Stage6RevisionArtifactEnvelope['producer'];
  parents: Stage6RevisionArtifactReference[];
  payload: unknown;
}): Stage6RevisionArtifactEnvelope {
  return {
    schema_version: 'story-agent-stage6-revision-artifact/v1',
    artifact_id: `${input.context.command.command_id}--${input.kind}`,
    benchmark_id: input.context.command.benchmark_id,
    real_project_id: input.context.command.real_project_id,
    round_number: input.context.command.round_number,
    attempt_number: input.context.attemptNumber,
    kind: input.kind,
    created_at: input.now,
    producer: input.producer,
    parent_sha256: input.parents.map(parent => parent.sha256),
    payload_canonical_sha256: stage6CanonicalSha256(input.payload),
    payload: input.payload,
    professional_passed: false,
  };
}

async function loadContext(input: {
  command: unknown;
  repoRoot: string;
  artifactRoot: string;
  registry: MultiRoundRevisionSpecRegistry;
}): Promise<{ context?: LoadedExecutionContext; preflight: Stage6RevisionBatchPreflight }> {
  const commandResult = Stage6RevisionBatchCommandSchema.safeParse(input.command);
  if (!commandResult.success) {
    return {
      preflight: {
        status: 'blocked',
        blockers: commandResult.error.issues.map(item => `command_schema_invalid:${item.path.join('.')}:${item.message}`),
        benchmark_id: '',
        real_project_id: '',
        round_number: 1,
        attempt_number: 0,
        readiness_report_sha256: '',
        command_sha256: stage6CanonicalSha256(input.command),
        professional_passed: false,
      },
    };
  }
  const command = commandResult.data;
  const blockers: string[] = [];
  const commandSha256 = stage6CanonicalSha256(command);
  let report: Stage6RealInputReadinessReport;
  try {
    const loaded = await readReferencedJson({ repoRoot: input.repoRoot, reference: command.readiness_report });
    const parsed = Stage6RealInputReadinessReportSchema.safeParse(loaded.value);
    if (!parsed.success) throw new Error('readiness_report_schema_invalid');
    report = parsed.data;
  } catch (error) {
    blockers.push((error as Error).message);
    return {
      preflight: {
        status: 'blocked', blockers, benchmark_id: command.benchmark_id,
        real_project_id: command.real_project_id, round_number: command.round_number,
        attempt_number: 0, readiness_report_sha256: command.readiness_report.sha256,
        command_sha256: commandSha256, professional_passed: false,
      },
    };
  }
  const readinessProject = report.projects.find(project => project.benchmark_id === command.benchmark_id);
  if (!readinessProject) blockers.push('readiness_project_missing');
  else {
    if (readinessProject.status !== 'ready') blockers.push('readiness_project_not_ready');
    if (readinessProject.real_project_id !== command.real_project_id) blockers.push('readiness_real_project_id_mismatch');
  }

  let intake: Stage6RealInputIntake | undefined;
  let intakeProject: Stage6RealInputIntake['projects'][number] | undefined;
  try {
    const intakePath = await resolveInside(input.repoRoot, report.source_intake_path);
    const parsed = Stage6RealInputIntakeSchema.safeParse(JSON.parse(await readFile(intakePath, 'utf8')));
    if (!parsed.success) throw new Error('source_intake_schema_invalid');
    if (stage6CanonicalSha256(parsed.data) !== report.source_intake_canonical_sha256) {
      throw new Error('source_intake_sha256_mismatch');
    }
    intake = parsed.data;
    if (stage6CanonicalSha256(input.registry) !== report.source_registry_canonical_sha256) {
      throw new Error('source_registry_sha256_mismatch');
    }
    const recomputedReport = validateStage6RealInputIntake({
      intake,
      registry: input.registry,
      repoRoot: input.repoRoot,
      sourceIntakePath: report.source_intake_path,
      now: report.generated_at,
    });
    if (stage6CanonicalSha256(recomputedReport) !== stage6CanonicalSha256(report)) {
      throw new Error('readiness_report_recomputation_mismatch');
    }
    intakeProject = intake.projects.find(project => project.benchmark_id === command.benchmark_id);
    if (!intakeProject) throw new Error('source_intake_project_missing');
    if (intakeProject.real_project_id !== command.real_project_id) throw new Error('source_intake_project_id_mismatch');
  } catch (error) {
    blockers.push((error as Error).message);
  }

  const realRepoRoot = await realpath(input.repoRoot);
  const absoluteArtifactRoot = path.resolve(realRepoRoot, input.artifactRoot);
  if (!inside(realRepoRoot, absoluteArtifactRoot)) blockers.push('execution_artifact_root_outside_repository');
  const projectRoot = path.join(absoluteArtifactRoot, sha256(command.real_project_id).slice(0, 16));
  const statePath = path.join(projectRoot, 'execution-state.json');

  let beforePackage: ProfessionalTextPackage | undefined;
  let submittedPackage: ProfessionalTextPackage | undefined;
  let tableRead: Stage6TableReadArtifact | undefined;
  let cost: Stage6RevisionCostArtifact | undefined;
  try {
    const [beforeFile, submissionFile, tableReadFile, costFile] = await Promise.all([
      readReferencedJson({ repoRoot: input.repoRoot, reference: command.before_package }),
      readReferencedJson({ repoRoot: input.repoRoot, reference: command.revision_submission }),
      readReferencedJson({ repoRoot: input.repoRoot, reference: command.table_read_feedback }),
      readReferencedJson({ repoRoot: input.repoRoot, reference: command.cost_record }),
    ]);
    const beforeResult = parsePackageValue(beforeFile.value);
    const submittedResult = ProfessionalTextPackageSchema.safeParse(submissionFile.value);
    const tableReadResult = Stage6TableReadArtifactSchema.safeParse(tableReadFile.value);
    const costResult = Stage6RevisionCostArtifactSchema.safeParse(costFile.value);
    if (!beforeResult.success) {
      blockers.push(`before_package_schema_invalid:${beforeResult.error.issues[0]?.path.join('.')}:${beforeResult.error.issues[0]?.message}`);
    } else beforePackage = beforeResult.data;
    if (!submittedResult.success) {
      blockers.push(`revision_submission_schema_invalid:${submittedResult.error.issues[0]?.path.join('.')}:${submittedResult.error.issues[0]?.message}`);
    } else submittedPackage = submittedResult.data;
    if (!tableReadResult.success) blockers.push('table_read_artifact_schema_invalid'); else tableRead = tableReadResult.data;
    if (!costResult.success) blockers.push('cost_artifact_schema_invalid'); else cost = costResult.data;
  } catch (error) {
    blockers.push((error as Error).message);
  }

  const state = beforePackage
    ? await readState(statePath, {
      benchmarkId: command.benchmark_id,
      realProjectId: command.real_project_id,
      videoType: beforePackage.video_type,
    })
    : emptyState({ benchmarkId: command.benchmark_id, realProjectId: command.real_project_id, videoType: 'character_story' });
  const roundKey = `round_${command.round_number}` as const;
  const completed = state.completed_rounds.find(round => round.round_number === command.round_number);
  if (completed?.command_id === command.command_id) {
    return {
      preflight: {
        status: 'already_completed', blockers: [], benchmark_id: command.benchmark_id,
        real_project_id: command.real_project_id, round_number: command.round_number,
        attempt_number: state.attempts[roundKey].find(item => item.command_id === command.command_id)?.attempt_number ?? 1,
        readiness_report_sha256: command.readiness_report.sha256, command_sha256: commandSha256,
        professional_passed: false,
      },
    };
  }
  if (completed) blockers.push('revision_round_already_completed');
  const expectedRound = state.completed_rounds.length + 1;
  if (command.round_number !== expectedRound) blockers.push('revision_round_sequence_invalid');

  if (beforePackage && submittedPackage) {
    if (beforePackage.package_id !== submittedPackage.package_id
      || beforePackage.project_id !== command.real_project_id
      || submittedPackage.project_id !== command.real_project_id
      || beforePackage.video_type !== submittedPackage.video_type
      || readinessProject?.video_type !== submittedPackage.video_type) blockers.push('revision_package_identity_mismatch');
    if (submittedPackage.status === 'approved' || submittedPackage.quality_report.professional_passed) blockers.push('revision_submission_false_professional_pass');
    if (beforePackage.quality_report.total_score === undefined || submittedPackage.quality_report.total_score === undefined) blockers.push('revision_quality_score_missing');
    const actualChanges = changedCreativeSections(beforePackage, submittedPackage);
    const declared = [...new Set(command.declared_changed_sections)].sort();
    if (declared.some(field => !CREATIVE_CHANGE_FIELDS.includes(field))) blockers.push('declared_noncreative_or_derived_section');
    if (JSON.stringify([...actualChanges].sort()) !== JSON.stringify(declared)) blockers.push('declared_changed_sections_mismatch');
    if (actualChanges.length === 0) blockers.push('revision_submission_unchanged');
    if (actualChanges.includes('full_text') && !actualChanges.includes('scene_breakdown')) blockers.push('full_text_changed_without_scene_breakdown_revision');
    if (!valueEqual(beforePackage.research_and_evidence_dossier, submittedPackage.research_and_evidence_dossier)) blockers.push('untracked_research_dossier_change');
    if (command.round_number === 1 && intakeProject) {
      if (command.before_package.path !== intakeProject.initial_package.path
        || command.before_package.sha256 !== intakeProject.initial_package.sha256) blockers.push('round_1_before_package_not_p0_initial_package');
    }
    if (command.round_number === 2) {
      const prior = state.completed_rounds.find(round => round.round_number === 1);
      if (!prior || professionalPackageSha256(beforePackage) !== prior.after_package_sha256) blockers.push('round_2_before_package_chain_mismatch');
    }
  }

  if (intakeProject) {
    if (command.provenance.model_or_author !== intakeProject.creator_authorization.subject_id) blockers.push('provenance_creator_not_authorized');
    if (!intakeProject.creator_authorization.authorized_rounds.includes(command.round_number)) blockers.push('revision_round_not_authorized');
    const expectedRealKind = intakeProject.creator_authorization.subject_type === 'model' ? 'real_model' : 'human_authored';
    if (['real_model', 'human_authored'].includes(command.provenance.artifact_kind)
      && command.provenance.artifact_kind !== expectedRealKind) blockers.push('provenance_artifact_kind_authorization_mismatch');
  }
  if (tableRead && intakeProject) {
    if (tableRead.benchmark_id !== command.benchmark_id
      || tableRead.real_project_id !== command.real_project_id
      || tableRead.round_number !== command.round_number
      || tableRead.session_reference !== intakeProject.table_read.schedule_reference) blockers.push('table_read_identity_mismatch');
    const reviewerByRole = new Map(intakeProject.reviewers.map(reviewer => [reviewer.role, reviewer.reviewer_id]));
    for (const role of ['writer_editor', 'director', 'fact_culture_reviewer'] as const) {
      if (!tableRead.feedback.some(item => item.source === role && item.reviewer_id === reviewerByRole.get(role))) {
        blockers.push(`table_read_required_reviewer_feedback_missing:${role}`);
      }
    }
  }
  if (cost && intakeProject) {
    if (cost.benchmark_id !== command.benchmark_id
      || cost.real_project_id !== command.real_project_id
      || cost.round_number !== command.round_number
      || cost.output_id !== command.provenance.output_id
      || cost.provider_or_author !== command.provenance.model_or_author) blockers.push('cost_record_identity_mismatch');
    if (cost.currency !== intakeProject.revision_budget.currency) blockers.push('cost_currency_mismatch');
    const previousCost = state.completed_rounds.reduce((sum, round) => sum + round.cost_amount, 0);
    if (previousCost + cost.amount > intakeProject.revision_budget.amount) blockers.push('revision_budget_exceeded');
  }

  const attemptNumber = state.attempts[roundKey].length + 1;
  const preflight: Stage6RevisionBatchPreflight = {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    blockers: [...new Set(blockers)],
    benchmark_id: command.benchmark_id,
    real_project_id: command.real_project_id,
    round_number: command.round_number,
    attempt_number: blockers.length === 0 ? attemptNumber : 0,
    readiness_report_sha256: command.readiness_report.sha256,
    command_sha256: commandSha256,
    professional_passed: false,
  };
  if (blockers.length > 0 || !intake || !intakeProject || !beforePackage || !submittedPackage || !tableRead || !cost) {
    return { preflight };
  }
  return {
    preflight,
    context: {
      command, commandSha256, report, intake, intakeProject, beforePackage, submittedPackage,
      tableRead, cost, state, statePath, attemptNumber, artifactRoot: absoluteArtifactRoot,
    },
  };
}

export async function preflightStage6RevisionBatch(input: {
  command: unknown;
  repoRoot: string;
  registry: MultiRoundRevisionSpecRegistry;
  artifactRoot?: string;
}): Promise<Stage6RevisionBatchPreflight> {
  return (await loadContext({
    command: input.command,
    repoRoot: input.repoRoot,
    registry: input.registry,
    artifactRoot: input.artifactRoot ?? 'web/generated/stage6-revisions',
  })).preflight;
}

export async function executeStage6RevisionBatch(input: {
  command: unknown;
  repoRoot: string;
  registry: MultiRoundRevisionSpecRegistry;
  artifactRoot?: string;
  now?: string;
  failAfterArtifactKindForTest?: Stage6RevisionArtifactKind;
}): Promise<Stage6RevisionBatchExecutionResult> {
  const loaded = await loadContext({
    command: input.command,
    repoRoot: input.repoRoot,
    registry: input.registry,
    artifactRoot: input.artifactRoot ?? 'web/generated/stage6-revisions',
  });
  if (loaded.preflight.status === 'already_completed') {
    const command = Stage6RevisionBatchCommandSchema.parse(input.command);
    const projectRoot = path.join(
      path.resolve(await realpath(input.repoRoot), input.artifactRoot ?? 'web/generated/stage6-revisions'),
      sha256(command.real_project_id).slice(0, 16),
    );
    const state = await readState(path.join(projectRoot, 'execution-state.json'), {
      benchmarkId: command.benchmark_id,
      realProjectId: command.real_project_id,
      videoType: 'character_story',
    }).catch(async () => JSON.parse(await readFile(path.join(projectRoot, 'execution-state.json'), 'utf8')) as Stage6RevisionProjectExecutionState);
    const attempt = state.attempts[`round_${command.round_number}`].find(item => item.command_id === command.command_id && item.status === 'completed');
    if (!attempt || !state.ledger) throw new Error('completed_revision_state_missing');
    const round = state.ledger.rounds[command.round_number - 1];
    return {
      status: 'recovered', benchmark_id: command.benchmark_id, real_project_id: command.real_project_id,
      round_number: command.round_number, attempt_number: attempt.attempt_number,
      artifacts: attempt.artifacts, ledger: state.ledger,
      verified_real_revision_credit: round?.verified_real_revision_credit ?? false,
      professional_passed: false,
    };
  }
  if (loaded.preflight.status !== 'ready' || !loaded.context) {
    throw new Error(`stage6_revision_batch_blocked:${loaded.preflight.blockers.join(',')}`);
  }
  const context = loaded.context;
  const now = new Date(input.now ?? Date.now()).toISOString();
  const roundKey = `round_${context.command.round_number}` as const;
  const attempt: Stage6RevisionAttemptState = {
    attempt_number: context.attemptNumber,
    command_id: context.command.command_id,
    command_sha256: context.commandSha256,
    status: 'running',
    started_at: now,
    finished_at: '',
    error_code: '',
    artifacts: [],
  };
  context.state.attempts[roundKey].push(attempt);
  await atomicWriteJson(context.statePath, context.state);
  const attemptDirectory = path.join(
    context.artifactRoot,
    sha256(context.command.real_project_id).slice(0, 16),
    `round-${context.command.round_number}`,
    `attempt-${context.attemptNumber}`,
  );
  const artifacts: Stage6RevisionArtifactReference[] = [];
  const persist = async (
    kind: Stage6RevisionArtifactKind,
    producer: Stage6RevisionArtifactEnvelope['producer'],
    parents: Stage6RevisionArtifactReference[],
    payload: unknown,
  ): Promise<Stage6RevisionArtifactReference> => {
    const reference = await writeImmutableArtifact({
      repoRoot: input.repoRoot,
      directory: attemptDirectory,
      envelope: envelope({ context, kind, now, producer, parents, payload }),
    });
    artifacts.push(reference);
    attempt.artifacts = [...artifacts];
    await atomicWriteJson(context.statePath, context.state);
    if (input.failAfterArtifactKindForTest === kind) throw new Error(`injected_failure_after:${kind}`);
    return reference;
  };

  try {
    const beforeArtifact = await persist('before_package', 'operator', [], context.beforePackage);
    const submissionArtifact = await persist('revision_submission', 'model_or_author', [beforeArtifact], context.submittedPackage);
    const tableReadArtifact = await persist('table_read_feedback', 'operator', [beforeArtifact], context.tableRead);
    const costArtifact = await persist('cost_record', 'operator', [submissionArtifact], context.cost);
    const rebuilt = rebuildDerivedPackage({ package: context.submittedPackage, now });
    const importedFeedback: ProfessionalTableReadFeedback[] = importProfessionalTableReadFeedback({
      package: context.beforePackage,
      feedback: context.tableRead.feedback.map(({ reviewer_id: _reviewerId, ...feedback }) => feedback),
    });
    const provisional = recordProfessionalRevisionRound({
      ledger: context.state.ledger ?? undefined,
      before_package: context.beforePackage,
      after_package: rebuilt.package,
      changed_sections: context.command.declared_changed_sections,
      rebuilt_derived_sections: rebuilt.rebuiltSections,
      table_read_feedback: importedFeedback,
      feedback_resolutions: context.command.feedback_resolutions,
      provenance: {
        artifact_kind: context.command.provenance.artifact_kind as ProfessionalRevisionArtifactKind,
        output_id: context.command.provenance.output_id,
        model_or_author: context.command.provenance.model_or_author,
        prompt_or_brief_version: context.command.provenance.prompt_or_brief_version,
        provenance_verified: context.command.provenance.provenance_verified,
        cost_recorded: true,
      },
      now,
    });
    const finalPackage = structuredClone(rebuilt.package);
    finalPackage.revision_trace.push(provisional.revision_trace_item);
    const recorded = recordProfessionalRevisionRound({
      ledger: context.state.ledger ?? undefined,
      before_package: context.beforePackage,
      after_package: finalPackage,
      changed_sections: context.command.declared_changed_sections,
      rebuilt_derived_sections: rebuilt.rebuiltSections,
      table_read_feedback: importedFeedback,
      feedback_resolutions: context.command.feedback_resolutions,
      provenance: {
        artifact_kind: context.command.provenance.artifact_kind as ProfessionalRevisionArtifactKind,
        output_id: context.command.provenance.output_id,
        model_or_author: context.command.provenance.model_or_author,
        prompt_or_brief_version: context.command.provenance.prompt_or_brief_version,
        provenance_verified: context.command.provenance.provenance_verified,
        cost_recorded: true,
      },
      now,
    });
    const ledgerErrors = validateProfessionalMultiRoundRevisionLedger(recorded.ledger);
    if (ledgerErrors.length > 0) throw new Error(`revision_ledger_invalid:${ledgerErrors.join(',')}`);
    const revisedArtifact = await persist('revised_package', 'story_agent', [submissionArtifact, tableReadArtifact], finalPackage);
    const coverage = buildProfessionalCoverageActionSet({ package: finalPackage, now });
    const coverageArtifact = await persist('coverage_action_set', 'story_agent', [revisedArtifact], coverage);
    const ledgerArtifact = await persist('revision_ledger', 'story_agent', [revisedArtifact, coverageArtifact, costArtifact], recorded.ledger);
    const recordedRound = recorded.ledger.rounds[context.command.round_number - 1];
    const roundManifestPayload = {
      schema_version: 'story-agent-stage6-revision-round-manifest/v1',
      command_id: context.command.command_id,
      command_sha256: context.commandSha256,
      readiness_report_sha256: context.command.readiness_report.sha256,
      source_intake_canonical_sha256: context.report.source_intake_canonical_sha256,
      provenance_verification: {
        reference: context.command.provenance.verification_reference,
        verified_by: context.command.provenance.verified_by,
        verified_at: context.command.provenance.verified_at,
      },
      before_package_sha256: recordedRound.before_package_sha256,
      after_package_sha256: recordedRound.after_package_sha256,
      artifact_sha256_chain: artifacts.map(artifact => artifact.sha256),
      verified_real_revision_credit: recordedRound.verified_real_revision_credit,
      professional_passed: false as const,
    };
    const roundManifestArtifact = await persist('round_manifest', 'story_agent', [ledgerArtifact], roundManifestPayload);
    attempt.status = 'completed';
    attempt.finished_at = now;
    attempt.artifacts = [...artifacts];
    context.state.ledger = recorded.ledger;
    context.state.completed_rounds.push({
      round_number: context.command.round_number,
      command_id: context.command.command_id,
      before_package_sha256: recordedRound.before_package_sha256,
      after_package_sha256: recordedRound.after_package_sha256,
      round_manifest_artifact: roundManifestArtifact,
      revised_package_artifact: revisedArtifact,
      cost_amount: context.cost.amount,
      cost_currency: context.cost.currency,
      verified_real_revision_credit: recordedRound.verified_real_revision_credit,
    });
    await atomicWriteJson(context.statePath, context.state);
    return {
      status: 'completed',
      benchmark_id: context.command.benchmark_id,
      real_project_id: context.command.real_project_id,
      round_number: context.command.round_number,
      attempt_number: context.attemptNumber,
      artifacts,
      ledger: recorded.ledger,
      verified_real_revision_credit: recordedRound.verified_real_revision_credit,
      professional_passed: false,
    };
  } catch (error) {
    attempt.status = 'failed';
    attempt.finished_at = now;
    attempt.error_code = (error as Error).message;
    attempt.artifacts = [...artifacts];
    await atomicWriteJson(context.statePath, context.state);
    throw error;
  }
}
