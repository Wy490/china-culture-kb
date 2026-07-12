import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CharacterStoryBenchmarkExecutionManifest } from '../web/server/src/services/professional-benchmark-service.js';
import { hashProfessionalBenchmarkArtifact } from '../web/server/src/services/professional-benchmark-run-service.js';
import {
  CONTROLLED_PLAN_SCHEMA_VERSION,
  validateControlledCharacterBenchmarkPlan,
  type ControlledCharacterBenchmarkPlanRun,
  type ControlledCharacterBenchmarkRunPlan,
} from './story-agent-character-benchmark-runner.mjs';

export const LIFECYCLE_PLAN_SCHEMA_VERSION =
  'character-story-professional-benchmark-lifecycle-plan/v1';

const EXECUTION_MANIFEST_SCHEMA_VERSION =
  'character-story-professional-benchmark-execution-manifest/v2';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-execution-manifest.json',
);
const controlledPlanPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-controlled-run-plan.json',
);
const lifecyclePlanPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-lifecycle-plan.json',
);

const manifestRelativePath = path.relative(repoRoot, manifestPath);
const controlledPlanRelativePath = path.relative(repoRoot, controlledPlanPath);
const lifecyclePlanRelativePath = path.relative(repoRoot, lifecyclePlanPath);

type LifecyclePlanMode = 'plan' | 'write' | 'check';

export interface LifecyclePlanCliOptions {
  mode: LifecyclePlanMode;
}

export const REQUIRED_LIFECYCLE_ARTIFACT_CHAIN = [
  {
    stage_id: 'verified_initial_external_story',
    artifact_file: 'initial-story.json',
    completion_evidence: 'strict artifact envelope and verified external provider provenance',
  },
  {
    stage_id: 'initial_professional_text_package',
    artifact_file: 'initial-professional-text-package.json',
    completion_evidence: 'package hash bound to the verified initial story artifact',
  },
  {
    stage_id: 'initial_quality_report',
    artifact_file: 'initial-quality-report.json',
    completion_evidence: 'machine quality report bound to the initial professional text package',
  },
  {
    stage_id: 'revision_work_order',
    artifact_file: 'revision-work-order.json',
    completion_evidence: 'revision instructions bound to initial package and quality hashes',
  },
  {
    stage_id: 'revision_output',
    artifact_file: 'revision-output.json',
    completion_evidence: 'revision output bound to the initial package and revision work order',
  },
  {
    stage_id: 'final_professional_text_package',
    artifact_file: 'final-professional-text-package.json',
    completion_evidence: 'final package bound to the independently recorded revision output',
  },
  {
    stage_id: 'final_quality_report',
    artifact_file: 'final-quality-report.json',
    completion_evidence: 'final quality snapshot bound to the final package and revision-output DAG',
  },
  {
    stage_id: 'human_blind_review',
    artifact_file: 'human-blind-review.json',
    completion_evidence: 'authorized independent blind-review quorum bound to final hashes',
  },
  {
    stage_id: 'artifact_validation',
    artifact_file: 'artifact-validation.json',
    completion_evidence: 'professional_completion validation after the human review artifact closes the persisted DAG',
  },
  {
    stage_id: 'finalization_candidate',
    artifact_file: 'finalization-decision.json',
    completion_evidence: 'fail-closed candidate decision explicitly eligible for a separate signed release',
  },
  {
    stage_id: 'signed_release',
    artifact_file: 'signed-release-record.json',
    completion_evidence: 'authorized signed release after every prior gate passes',
  },
] as const;

type LifecycleStageId = typeof REQUIRED_LIFECYCLE_ARTIFACT_CHAIN[number]['stage_id'];

export interface CharacterBenchmarkLifecycleStage {
  stage_id: LifecycleStageId;
  artifact_file: string;
  status: 'awaiting_verified_input' | 'blocked_by_prior_stage';
  blocker: string;
  professional_credit: false;
}

export interface CharacterBenchmarkLifecycleRun {
  benchmark_id: string;
  run_id: string;
  controlled_run_sha256: string;
  source_snapshot_sha256: string;
  status: 'awaiting_verified_initial_run';
  execution_state: 'blocked';
  blockers: ['verified_initial_external_story_missing'];
  stages: CharacterBenchmarkLifecycleStage[];
  initial_real_model_completed: false;
  model_output_validated: false;
  human_blind_review_passed: false;
  signed_release_present: false;
  professional_passed: false;
}

export interface CharacterStoryBenchmarkLifecyclePlan {
  schema_version: typeof LIFECYCLE_PLAN_SCHEMA_VERSION;
  generated_at: string;
  video_type: 'character_story';
  mode: 'plan_only';
  source_manifest: {
    path: string;
    schema_version: typeof EXECUTION_MANIFEST_SCHEMA_VERSION;
    sha256: string;
  };
  source_controlled_plan: {
    path: string;
    schema_version: typeof CONTROLLED_PLAN_SCHEMA_VERSION;
    integrity_sha256: string;
    artifact_sha256: string;
  };
  policy: {
    invokes_model: false;
    writes_model_outputs: false;
    creates_run_directory: false;
    contains_prompt_text: false;
    contains_credentials_or_secrets: false;
    verified_external_provenance_required: true;
    fixture_counts_as_progress_or_credit: false;
    simulation_counts_as_progress_or_credit: false;
    local_output_counts_as_progress_or_credit: false;
    human_blind_review_required: true;
    signed_release_required_for_professional_pass: true;
  };
  required_artifact_chain: typeof REQUIRED_LIFECYCLE_ARTIFACT_CHAIN;
  summary: {
    fixed_project_spec_count: 5;
    awaiting_verified_initial_run_count: 5;
    blocked_run_count: 5;
    model_invocation_count: 0;
    initial_real_model_completed_count: 0;
    initial_professional_text_package_count: 0;
    initial_quality_report_count: 0;
    revision_work_order_count: 0;
    revision_output_count: 0;
    final_professional_text_package_count: 0;
    final_quality_report_count: 0;
    artifact_validation_pass_count: 0;
    human_blind_review_pass_count: 0;
    finalization_candidate_count: 0;
    signed_release_count: 0;
    professional_pass_count: 0;
    fixture_simulation_or_local_credit_count: 0;
  };
  runs: CharacterBenchmarkLifecycleRun[];
  integrity_sha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function validSha256(value: unknown): boolean {
  return /^[a-f0-9]{64}$/.test(String(value ?? ''));
}

function assertSourceManifestShape(manifest: CharacterStoryBenchmarkExecutionManifest): void {
  const schemaVersion = (manifest as { schema_version?: string }).schema_version;
  if (schemaVersion === 'character-story-professional-benchmark-execution-manifest/v1') {
    throw new Error('legacy_generic_readiness_manifest_read_only_rebuild_v2');
  }
  if (schemaVersion !== EXECUTION_MANIFEST_SCHEMA_VERSION
    || manifest.video_type !== 'character_story') {
    throw new Error('unsupported_character_story_execution_manifest');
  }
  if (manifest.packages.length !== 5
    || new Set(manifest.packages.map(item => item.benchmark_id)).size !== 5) {
    throw new Error('execution_manifest_requires_five_unique_packages');
  }
  if (manifest.summary.real_model_execution_ready_count !== 0
    || manifest.summary.fixed_real_model_project_count !== 0
    || manifest.summary.fixed_real_model_project_pass_count !== 0
    || manifest.summary.human_blind_review_pass_count !== 0
    || manifest.summary.professional_pass_count !== 0) {
    throw new Error('execution_manifest_contains_unsupported_credit');
  }
  if (manifest.packages.some(item =>
    item.status !== 'source_package_ready'
    || item.execution_contract.execution_kind !== 'real_model'
    || item.execution_contract.fallback_allowed_for_benchmark_credit !== false
    || item.execution_contract.fixture_allowed_for_benchmark_credit !== false
    || item.professional_passed !== false
  )) {
    throw new Error('execution_manifest_package_policy_unsafe');
  }
}

function assertControlledPlanMatchesManifest(input: {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  controlled_plan: ControlledCharacterBenchmarkRunPlan;
}): void {
  const validation = validateControlledCharacterBenchmarkPlan(input.controlled_plan);
  if (!validation.valid) {
    throw new Error(`controlled_plan_invalid:${validation.blockers.join(',')}`);
  }
  const manifestSha256 = hashProfessionalBenchmarkArtifact(input.manifest);
  if (input.controlled_plan.source_manifest_sha256 !== manifestSha256) {
    throw new Error('controlled_plan_source_manifest_sha256_mismatch');
  }
  const manifestIds = input.manifest.packages.map(item => item.benchmark_id).sort();
  const planIds = input.controlled_plan.runs.map(item => item.benchmark_id).sort();
  if (JSON.stringify(manifestIds) !== JSON.stringify(planIds)) {
    throw new Error('controlled_plan_benchmark_set_mismatch');
  }
  const summary = input.controlled_plan.summary;
  if (summary.model_invocation_count !== 0
    || summary.real_model_completed_count !== 0
    || summary.fixed_real_model_project_count !== 0
    || summary.fixed_real_model_project_pass_count !== 0
    || summary.human_blind_review_pass_count !== 0
    || summary.professional_pass_count !== 0
    || summary.fixture_or_simulation_credit_count !== 0) {
    throw new Error('controlled_plan_contains_unsupported_credit');
  }
}

function buildLifecycleStages(): CharacterBenchmarkLifecycleStage[] {
  return REQUIRED_LIFECYCLE_ARTIFACT_CHAIN.map((stage, index) => ({
    stage_id: stage.stage_id,
    artifact_file: stage.artifact_file,
    status: index === 0 ? 'awaiting_verified_input' : 'blocked_by_prior_stage',
    blocker: index === 0
      ? 'verified_initial_external_story_missing'
      : `prior_stage_incomplete:${REQUIRED_LIFECYCLE_ARTIFACT_CHAIN[index - 1].stage_id}`,
    professional_credit: false,
  }));
}

function buildLifecycleRun(run: ControlledCharacterBenchmarkPlanRun): CharacterBenchmarkLifecycleRun {
  return {
    benchmark_id: run.benchmark_id,
    run_id: run.run_id,
    controlled_run_sha256: hashProfessionalBenchmarkArtifact(run),
    source_snapshot_sha256: run.source_snapshot_sha256,
    status: 'awaiting_verified_initial_run',
    execution_state: 'blocked',
    blockers: ['verified_initial_external_story_missing'],
    stages: buildLifecycleStages(),
    initial_real_model_completed: false,
    model_output_validated: false,
    human_blind_review_passed: false,
    signed_release_present: false,
    professional_passed: false,
  };
}

export function buildCharacterBenchmarkLifecyclePlan(input: {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  controlled_plan: ControlledCharacterBenchmarkRunPlan;
  now?: string;
  source_manifest_path?: string;
  source_controlled_plan_path?: string;
}): CharacterStoryBenchmarkLifecyclePlan {
  assertSourceManifestShape(input.manifest);
  assertControlledPlanMatchesManifest(input);
  const generatedAt = input.now ?? new Date().toISOString();
  const runs = input.controlled_plan.runs.map(buildLifecycleRun);
  const withoutIntegrity: Omit<CharacterStoryBenchmarkLifecyclePlan, 'integrity_sha256'> = {
    schema_version: LIFECYCLE_PLAN_SCHEMA_VERSION,
    generated_at: generatedAt,
    video_type: 'character_story',
    mode: 'plan_only',
    source_manifest: {
      path: input.source_manifest_path ?? manifestRelativePath,
      schema_version: EXECUTION_MANIFEST_SCHEMA_VERSION,
      sha256: hashProfessionalBenchmarkArtifact(input.manifest),
    },
    source_controlled_plan: {
      path: input.source_controlled_plan_path ?? controlledPlanRelativePath,
      schema_version: CONTROLLED_PLAN_SCHEMA_VERSION,
      integrity_sha256: input.controlled_plan.integrity_sha256,
      artifact_sha256: hashProfessionalBenchmarkArtifact(input.controlled_plan),
    },
    policy: {
      invokes_model: false,
      writes_model_outputs: false,
      creates_run_directory: false,
      contains_prompt_text: false,
      contains_credentials_or_secrets: false,
      verified_external_provenance_required: true,
      fixture_counts_as_progress_or_credit: false,
      simulation_counts_as_progress_or_credit: false,
      local_output_counts_as_progress_or_credit: false,
      human_blind_review_required: true,
      signed_release_required_for_professional_pass: true,
    },
    required_artifact_chain: REQUIRED_LIFECYCLE_ARTIFACT_CHAIN,
    summary: {
      fixed_project_spec_count: 5,
      awaiting_verified_initial_run_count: 5,
      blocked_run_count: 5,
      model_invocation_count: 0,
      initial_real_model_completed_count: 0,
      initial_professional_text_package_count: 0,
      initial_quality_report_count: 0,
      revision_work_order_count: 0,
      revision_output_count: 0,
      final_professional_text_package_count: 0,
      final_quality_report_count: 0,
      artifact_validation_pass_count: 0,
      human_blind_review_pass_count: 0,
      finalization_candidate_count: 0,
      signed_release_count: 0,
      professional_pass_count: 0,
      fixture_simulation_or_local_credit_count: 0,
    },
    runs,
  };
  return {
    ...withoutIntegrity,
    integrity_sha256: hashProfessionalBenchmarkArtifact(withoutIntegrity),
  };
}

export function validateCharacterBenchmarkLifecyclePlan(
  value: unknown,
): { valid: boolean; blockers: string[] } {
  if (!isRecord(value)) return { valid: false, blockers: ['lifecycle_plan_not_object'] };
  if (value.schema_version === 'character-story-professional-benchmark-lifecycle-plan/v0') {
    return { valid: false, blockers: ['legacy_lifecycle_plan_read_only_rebuild_v1'] };
  }
  const plan = value as unknown as CharacterStoryBenchmarkLifecyclePlan;
  const sourceManifest: Record<string, unknown> = isRecord(plan.source_manifest)
    ? plan.source_manifest
    : {};
  const sourceControlledPlan: Record<string, unknown> = isRecord(plan.source_controlled_plan)
    ? plan.source_controlled_plan
    : {};
  const policy: Record<string, unknown> = isRecord(plan.policy) ? plan.policy : {};
  const summary: Record<string, unknown> = isRecord(plan.summary) ? plan.summary : {};
  const runs = Array.isArray(plan.runs) ? plan.runs : [];
  const artifactChain = Array.isArray(plan.required_artifact_chain)
    ? plan.required_artifact_chain
    : [];
  const hashInput = { ...plan } as Partial<CharacterStoryBenchmarkLifecyclePlan>;
  delete hashInput.integrity_sha256;
  const serialized = JSON.stringify(plan);
  const forbiddenPayload = /"(?:system_prompt|user_prompt|story_generation_prompt|entry_story|source_material|credential|api_key|access_token|authorization_reference)"\s*:/i;
  const expectedStageIds = REQUIRED_LIFECYCLE_ARTIFACT_CHAIN.map(stage => stage.stage_id);
  const expectedArtifactFiles = REQUIRED_LIFECYCLE_ARTIFACT_CHAIN.map(stage => stage.artifact_file);
  const expectedCompletionEvidence = REQUIRED_LIFECYCLE_ARTIFACT_CHAIN.map(
    stage => stage.completion_evidence,
  );
  const zeroSummaryFields = [
    'model_invocation_count',
    'initial_real_model_completed_count',
    'initial_professional_text_package_count',
    'initial_quality_report_count',
    'revision_work_order_count',
    'revision_output_count',
    'final_professional_text_package_count',
    'final_quality_report_count',
    'artifact_validation_pass_count',
    'human_blind_review_pass_count',
    'finalization_candidate_count',
    'signed_release_count',
    'professional_pass_count',
    'fixture_simulation_or_local_credit_count',
  ];
  const blockers = [
    plan.schema_version === LIFECYCLE_PLAN_SCHEMA_VERSION ? '' : 'invalid_schema_version',
    plan.video_type === 'character_story' ? '' : 'invalid_video_type',
    plan.mode === 'plan_only' ? '' : 'lifecycle_plan_not_plan_only',
    Number.isFinite(Date.parse(String(plan.generated_at ?? ''))) ? '' : 'generated_at_invalid',
    sourceManifest.path === manifestRelativePath ? '' : 'source_manifest_path_mismatch',
    sourceManifest.schema_version === EXECUTION_MANIFEST_SCHEMA_VERSION
      ? ''
      : 'source_manifest_schema_version_invalid',
    validSha256(sourceManifest.sha256) ? '' : 'source_manifest_sha256_invalid',
    sourceControlledPlan.path === controlledPlanRelativePath
      ? ''
      : 'source_controlled_plan_path_mismatch',
    sourceControlledPlan.schema_version === CONTROLLED_PLAN_SCHEMA_VERSION
      ? ''
      : 'source_controlled_plan_schema_version_invalid',
    validSha256(sourceControlledPlan.integrity_sha256)
      ? ''
      : 'source_controlled_plan_integrity_sha256_invalid',
    validSha256(sourceControlledPlan.artifact_sha256)
      ? ''
      : 'source_controlled_plan_artifact_sha256_invalid',
    validSha256(plan.integrity_sha256) ? '' : 'integrity_sha256_invalid',
    plan.integrity_sha256 === hashProfessionalBenchmarkArtifact(hashInput)
      ? ''
      : 'integrity_sha256_mismatch',
    policy.invokes_model === false
      && policy.writes_model_outputs === false
      && policy.creates_run_directory === false
      ? ''
      : 'lifecycle_plan_has_execution_side_effects',
    policy.contains_prompt_text === false
      && policy.contains_credentials_or_secrets === false
      ? ''
      : 'lifecycle_plan_allows_sensitive_payload',
    policy.verified_external_provenance_required === true
      && policy.human_blind_review_required === true
      && policy.signed_release_required_for_professional_pass === true
      ? ''
      : 'professional_gate_requirement_missing',
    policy.fixture_counts_as_progress_or_credit === false
      && policy.simulation_counts_as_progress_or_credit === false
      && policy.local_output_counts_as_progress_or_credit === false
      ? ''
      : 'non_external_output_credit_allowed',
    artifactChain.length === REQUIRED_LIFECYCLE_ARTIFACT_CHAIN.length
      && artifactChain.every((stage, index) =>
        isRecord(stage)
        && stage.stage_id === expectedStageIds[index]
        && stage.artifact_file === expectedArtifactFiles[index]
        && stage.completion_evidence === expectedCompletionEvidence[index]
      )
      ? ''
      : 'required_artifact_chain_mismatch',
    summary.fixed_project_spec_count === 5 ? '' : 'fixed_project_spec_count_not_five',
    summary.awaiting_verified_initial_run_count === 5
      ? ''
      : 'awaiting_verified_initial_run_count_not_five',
    summary.blocked_run_count === 5 ? '' : 'blocked_run_count_not_five',
    zeroSummaryFields.every(field => summary[field] === 0)
      ? ''
      : 'nonzero_lifecycle_credit_or_completion_claim',
    runs.length === 5 ? '' : 'run_count_not_five',
    new Set(runs.map(run => run.benchmark_id)).size === runs.length
      ? ''
      : 'duplicate_benchmark_id',
    new Set(runs.map(run => run.run_id)).size === runs.length ? '' : 'duplicate_run_id',
    runs.every(run => validSha256(run.controlled_run_sha256)
      && validSha256(run.source_snapshot_sha256))
      ? ''
      : 'run_source_hash_invalid',
    runs.every(run => run.status === 'awaiting_verified_initial_run'
      && run.execution_state === 'blocked'
      && Array.isArray(run.blockers)
      && run.blockers.length === 1
      && run.blockers[0] === 'verified_initial_external_story_missing')
      ? ''
      : 'run_not_awaiting_verified_initial_run',
    runs.every(run => run.initial_real_model_completed === false
      && run.model_output_validated === false
      && run.human_blind_review_passed === false
      && run.signed_release_present === false
      && run.professional_passed === false)
      ? ''
      : 'unsupported_run_credit',
    runs.every(run => Array.isArray(run.stages)
      && run.stages.length === REQUIRED_LIFECYCLE_ARTIFACT_CHAIN.length
      && run.stages.every((stage, index) =>
        stage.stage_id === expectedStageIds[index]
        && stage.artifact_file === expectedArtifactFiles[index]
        && stage.status === (index === 0 ? 'awaiting_verified_input' : 'blocked_by_prior_stage')
        && stage.professional_credit === false
        && stage.blocker === (index === 0
          ? 'verified_initial_external_story_missing'
          : `prior_stage_incomplete:${expectedStageIds[index - 1]}`)
      ))
      ? ''
      : 'run_lifecycle_stage_mismatch',
    runs.every(run => !/fixture|simulation|(?:^|[-_])local(?:[-_]|$)/i.test(
      `${run.benchmark_id}:${run.run_id}`,
    )) ? '' : 'non_external_run_identity',
    forbiddenPayload.test(serialized) ? 'forbidden_prompt_or_secret_payload' : '',
  ].filter(Boolean);
  return { valid: blockers.length === 0, blockers: unique(blockers) };
}

export function parseLifecyclePlanArgs(argv: string[]): LifecyclePlanCliOptions {
  let mode: LifecyclePlanMode | undefined;
  const setMode = (next: LifecyclePlanMode): void => {
    if (mode && mode !== next) {
      throw new Error(`Lifecycle plan modes are mutually exclusive: ${mode}, ${next}`);
    }
    mode = next;
  };
  for (const arg of argv) {
    if (arg === '--plan') setMode('plan');
    else if (arg === '--write') setMode('write');
    else if (arg === '--check') setMode('check');
    else throw new Error(`Unsupported lifecycle plan argument: ${arg}`);
  }
  return { mode: mode ?? 'plan' };
}

async function readSourceInputs(): Promise<{
  manifest: CharacterStoryBenchmarkExecutionManifest;
  controlled_plan: ControlledCharacterBenchmarkRunPlan;
}> {
  const [manifestText, planText] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(controlledPlanPath, 'utf8'),
  ]);
  return {
    manifest: JSON.parse(manifestText) as CharacterStoryBenchmarkExecutionManifest,
    controlled_plan: JSON.parse(planText) as ControlledCharacterBenchmarkRunPlan,
  };
}

export async function readAndValidateStoredLifecyclePlan(): Promise<CharacterStoryBenchmarkLifecyclePlan> {
  const [sources, lifecycleText] = await Promise.all([
    readSourceInputs(),
    readFile(lifecyclePlanPath, 'utf8'),
  ]);
  assertSourceManifestShape(sources.manifest);
  assertControlledPlanMatchesManifest(sources);
  const value = JSON.parse(lifecycleText) as unknown;
  const validation = validateCharacterBenchmarkLifecyclePlan(value);
  if (!validation.valid) {
    throw new Error(`lifecycle_plan_invalid:${validation.blockers.join(',')}`);
  }
  const plan = value as CharacterStoryBenchmarkLifecyclePlan;
  if (plan.source_manifest.sha256 !== hashProfessionalBenchmarkArtifact(sources.manifest)) {
    throw new Error('lifecycle_plan_source_manifest_sha256_stale');
  }
  if (plan.source_controlled_plan.integrity_sha256 !== sources.controlled_plan.integrity_sha256
    || plan.source_controlled_plan.artifact_sha256
      !== hashProfessionalBenchmarkArtifact(sources.controlled_plan)) {
    throw new Error('lifecycle_plan_source_controlled_plan_hash_stale');
  }
  const sourceRuns = new Map(sources.controlled_plan.runs.map(run => [run.benchmark_id, run]));
  if (plan.runs.some(run => {
    const sourceRun = sourceRuns.get(run.benchmark_id);
    return !sourceRun
      || run.run_id !== sourceRun.run_id
      || run.controlled_run_sha256 !== hashProfessionalBenchmarkArtifact(sourceRun)
      || run.source_snapshot_sha256 !== sourceRun.source_snapshot_sha256;
  })) {
    throw new Error('lifecycle_plan_controlled_run_binding_stale');
  }
  const rebuilt = buildCharacterBenchmarkLifecyclePlan({
    ...sources,
    now: plan.generated_at,
    source_manifest_path: plan.source_manifest.path,
    source_controlled_plan_path: plan.source_controlled_plan.path,
  });
  if (rebuilt.integrity_sha256 !== plan.integrity_sha256) {
    throw new Error('lifecycle_plan_not_current');
  }
  return plan;
}

async function main(): Promise<void> {
  const options = parseLifecyclePlanArgs(process.argv.slice(2));
  if (options.mode === 'check') {
    const checked = await readAndValidateStoredLifecyclePlan();
    process.stdout.write(`${JSON.stringify({
      checked: true,
      lifecycle_plan_path: lifecyclePlanRelativePath,
      integrity_sha256: checked.integrity_sha256,
      summary: checked.summary,
    }, null, 2)}\n`);
    return;
  }
  const sources = await readSourceInputs();
  const plan = buildCharacterBenchmarkLifecyclePlan(sources);
  if (options.mode === 'write') {
    await writeFile(lifecyclePlanPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({
      written: true,
      lifecycle_plan_path: lifecyclePlanRelativePath,
      integrity_sha256: plan.integrity_sha256,
      summary: plan.summary,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[story-agent-character-benchmark-lifecycle-plan] ${message}\n`);
    process.exitCode = 1;
  });
}
