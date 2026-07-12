import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import {
  access,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CharacterStoryBenchmarkExecutionManifest,
  CharacterStoryBenchmarkExecutionPackage,
} from '../web/server/src/services/professional-benchmark-service.js';
import {
  buildCharacterStoryProfessionalBenchmarkPrompt,
  type CharacterStoryProfessionalBenchmarkPromptPackage,
} from '../web/server/src/services/professional-benchmark-prompt-service.js';
import {
  validateProfessionalBenchmarkArtifacts,
  type ProfessionalBenchmarkArtifactKind,
  type ProfessionalBenchmarkArtifactProducer,
  type ProfessionalBenchmarkArtifactReference,
} from '../web/server/src/services/professional-benchmark-artifact-service.js';
import {
  authorizeProfessionalBenchmarkRun,
  executeProfessionalBenchmarkInitialRunWithStrictBridge,
  hashProfessionalBenchmarkArtifact,
  prepareProfessionalBenchmarkRun,
  type ProfessionalBenchmarkAdapterEnvelope,
  type ProfessionalBenchmarkRunLedger,
} from '../web/server/src/services/professional-benchmark-run-service.js';

export const CONTROLLED_PLAN_SCHEMA_VERSION = 'character-story-controlled-benchmark-run-plan/v2';
export const CONTROLLED_EXECUTION_SCHEMA_VERSION = 'character-story-controlled-benchmark-execution/v2';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-execution-manifest.json',
);
const planPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-controlled-run-plan.json',
);
const executionRoot = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-runs',
);
const strictBridgePath = path.join(
  repoRoot,
  'web',
  'server',
  'scripts',
  'professional-character-benchmark-bridge.mjs',
);
const manifestRelativePath = path.relative(repoRoot, manifestPath);
const planRelativePath = path.relative(repoRoot, planPath);

type RunnerMode = 'plan' | 'write' | 'check' | 'execute';

export interface ControlledRunnerOptions {
  mode: RunnerMode;
  timeout_ms?: number;
}

export interface ControlledRuntimeAnchor {
  model_runtime: 'claude' | 'codex' | null;
  selected_cli_manifest_path: string;
  selected_cli_realpath: string | null;
  selected_cli_sha256: string | null;
  selected_cli_executable: boolean;
  strict_bridge_realpath: string | null;
  strict_bridge_sha256: string | null;
  strict_bridge_readable: boolean;
}

export interface ControlledCharacterBenchmarkPlanRun {
  benchmark_id: string;
  run_id: string;
  source_snapshot_sha256: string;
  execution_package_sha256: string;
  professional_prompt_sha256: string;
  prompt_package_sha256: string;
  story_prompt_sha256: string;
  runtime_anchor_sha256: string;
  ledger_status: 'prepared';
  execution_state: 'blocked';
  blockers: string[];
  real_model_completed: false;
  human_blind_review_passed: false;
  professional_passed: false;
}

export interface ControlledCharacterBenchmarkRunPlan {
  schema_version: typeof CONTROLLED_PLAN_SCHEMA_VERSION;
  generated_at: string;
  video_type: 'character_story';
  source_manifest_path: string;
  source_manifest_sha256: string;
  runtime_anchor: ControlledRuntimeAnchor;
  mode: 'plan_only';
  policy: {
    invokes_model: false;
    writes_model_outputs: false;
    plan_contains_prompt_text: false;
    explicit_execute_authorization_required: true;
    paid_execution_authorization_required: true;
    verified_credentials_required: true;
    positive_budget_cap_required: true;
    absolute_cli_realpath_required: true;
    operator_env_authorization_required: true;
    approved_cli_path_and_sha_required: true;
    fixed_strict_bridge_only: true;
    arbitrary_command_or_extra_args_allowed: false;
    fixture_or_simulation_counts_as_real_run: false;
    fixture_or_simulation_counts_as_professional_pass: false;
  };
  summary: {
    fixed_project_spec_count: number;
    professional_prompt_ready_count: number;
    prepared_run_ledger_count: number;
    strict_technical_ready_count: number;
    selected_cli_anchor_ready_count: number;
    strict_bridge_anchor_ready_count: number;
    blocked_run_count: number;
    model_invocation_count: 0;
    real_model_completed_count: 0;
    fixed_real_model_project_count: 0;
    fixed_real_model_project_pass_count: 0;
    human_blind_review_pass_count: 0;
    professional_pass_count: 0;
    fixture_or_simulation_credit_count: 0;
  };
  runs: ControlledCharacterBenchmarkPlanRun[];
  integrity_sha256: string;
}

export interface ControlledExecutionGateInput {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  plan: ControlledCharacterBenchmarkRunPlan;
  options: ControlledRunnerOptions;
  operator_env?: NodeJS.ProcessEnv;
}

export interface ControlledExecutionGateResult {
  ready: boolean;
  runtime: 'claude' | 'codex' | null;
  cli_realpath: string | null;
  cli_sha256: string | null;
  authorization_reference: string | null;
  budget_cap_amount: number | null;
  budget_currency: string | null;
  blockers: string[];
}

export interface ControlledCharacterBenchmarkExecutionSummary {
  schema_version: typeof CONTROLLED_EXECUTION_SCHEMA_VERSION;
  generated_at: string;
  video_type: 'character_story';
  source_plan_sha256: string;
  authorization_reference_sha256: string;
  budget_cap: { amount: number; currency: string };
  summary: {
    attempted_count: number;
    initial_real_model_completed_count: number;
    professional_pass_count: 0;
    human_blind_review_pass_count: 0;
    total_reported_cost: number;
    cost_currency: string;
    stopped_for_budget: boolean;
  };
  runs: Array<{
    benchmark_id: string;
    run_id: string;
    ledger_status: ProfessionalBenchmarkRunLedger['status'];
    run_ledger_sha256: string;
    professional_passed: false;
  }>;
}

/**
 * Returns the only per-run authorization cap that is safe inside a batch. Passing the original
 * batch cap to every run would allow a later provider response to overspend before the runner can
 * observe it.
 */
export function remainingControlledBatchBudget(input: {
  batch_cap: number;
  spent: number;
}): number {
  if (!Number.isFinite(input.batch_cap) || input.batch_cap <= 0) {
    throw new Error('Batch budget cap must be a positive finite number');
  }
  if (!Number.isFinite(input.spent) || input.spent < 0) {
    throw new Error('Batch budget spent amount must be a non-negative finite number');
  }
  return Math.max(0, input.batch_cap - input.spent);
}

interface PreparedRunMaterial {
  executionPackage: CharacterStoryBenchmarkExecutionPackage;
  promptPackage: CharacterStoryProfessionalBenchmarkPromptPackage;
  ledger: ProfessionalBenchmarkRunLedger;
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolvePromise);
  });
  return hash.digest('hex');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function requireFlagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseControlledRunnerArgs(argv: string[]): ControlledRunnerOptions {
  let mode: RunnerMode | undefined;
  const options: ControlledRunnerOptions = {
    mode: 'plan',
  };
  const setMode = (next: RunnerMode): void => {
    if (mode && mode !== next) throw new Error(`Runner modes are mutually exclusive: ${mode}, ${next}`);
    mode = next;
    options.mode = next;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--plan': setMode('plan'); break;
      case '--write': setMode('write'); break;
      case '--check': setMode('check'); break;
      case '--execute': setMode('execute'); break;
      case '--timeout-ms': {
        const raw = requireFlagValue(argv, index, arg);
        const timeout = Number(raw);
        if (!Number.isInteger(timeout)) throw new Error('--timeout-ms must be an integer');
        options.timeout_ms = timeout;
        index += 1;
        break;
      }
      default:
        throw new Error(`Unsupported runner argument: ${arg}`);
    }
  }
  const executionOnlyOptionsPresent = options.timeout_ms !== undefined;
  if (options.mode !== 'execute' && executionOnlyOptionsPresent) {
    throw new Error('Execution authorization and runtime options are only valid with --execute');
  }
  return options;
}

function assertStoredManifestShape(manifest: CharacterStoryBenchmarkExecutionManifest): void {
  if ((manifest as { schema_version?: string }).schema_version
    === 'character-story-professional-benchmark-execution-manifest/v1') {
    throw new Error('legacy_generic_readiness_manifest_read_only_rebuild_v2');
  }
  if (manifest.schema_version !== 'character-story-professional-benchmark-execution-manifest/v2'
    || manifest.video_type !== 'character_story') {
    throw new Error('Unsupported character_story benchmark execution manifest');
  }
  if (manifest.packages.length !== 5
    || new Set(manifest.packages.map(item => item.benchmark_id)).size !== 5) {
    throw new Error('Controlled benchmark runner requires exactly five unique packages');
  }
  if (manifest.summary.fixed_real_model_project_count !== 0
    || manifest.summary.fixed_real_model_project_pass_count !== 0
    || manifest.summary.human_blind_review_pass_count !== 0
    || manifest.summary.professional_pass_count !== 0) {
    throw new Error('Source manifest contains unsupported real-model or professional pass claims');
  }
  for (const executionPackage of manifest.packages) {
    if (executionPackage.schema_version !== 'character-story-professional-benchmark-execution-package/v2'
      || executionPackage.video_type !== 'character_story'
      || executionPackage.status !== 'source_package_ready'
      || executionPackage.execution_contract.execution_kind !== 'real_model'
      || executionPackage.execution_contract.fallback_allowed_for_benchmark_credit !== false
      || executionPackage.execution_contract.fixture_allowed_for_benchmark_credit !== false
      || executionPackage.professional_passed !== false) {
      throw new Error(`Unsafe execution package policy: ${executionPackage.benchmark_id}`);
    }
  }
}

function deterministicRunId(index: number, manifestSha256: string): string {
  return `character-story-iteration3-run-${String(index + 1).padStart(3, '0')}-${manifestSha256.slice(0, 12)}`;
}

async function inspectRuntimeAnchor(
  manifest: CharacterStoryBenchmarkExecutionManifest,
): Promise<ControlledRuntimeAnchor> {
  const runtimes = unique(manifest.packages.map(item => item.execution_contract.model_runtime));
  const modelRuntime = runtimes.length === 1 && (runtimes[0] === 'claude' || runtimes[0] === 'codex')
    ? runtimes[0]
    : null;
  let selectedCliRealpath: string | null = null;
  let selectedCliSha256: string | null = null;
  let selectedCliExecutable = false;
  const selectedCliManifestPath = manifest.strict_readiness.selected_model_cli_manifest_path;
  if (path.isAbsolute(selectedCliManifestPath)) {
    try {
      selectedCliRealpath = await realpath(selectedCliManifestPath);
      await access(selectedCliRealpath, constants.X_OK);
      selectedCliSha256 = await sha256File(selectedCliRealpath);
      selectedCliExecutable = true;
    } catch {
      selectedCliRealpath = null;
      selectedCliSha256 = null;
      selectedCliExecutable = false;
    }
  }
  let strictBridgeRealpath: string | null = null;
  let strictBridgeSha256: string | null = null;
  let strictBridgeReadable = false;
  try {
    strictBridgeRealpath = await realpath(strictBridgePath);
    await access(strictBridgeRealpath, constants.R_OK);
    strictBridgeSha256 = await sha256File(strictBridgeRealpath);
    strictBridgeReadable = true;
  } catch {
    strictBridgeRealpath = null;
    strictBridgeSha256 = null;
    strictBridgeReadable = false;
  }
  return {
    model_runtime: modelRuntime,
    selected_cli_manifest_path: selectedCliManifestPath,
    selected_cli_realpath: selectedCliRealpath,
    selected_cli_sha256: selectedCliSha256,
    selected_cli_executable: selectedCliExecutable,
    strict_bridge_realpath: strictBridgeRealpath,
    strict_bridge_sha256: strictBridgeSha256,
    strict_bridge_readable: strictBridgeReadable,
  };
}

function manifestStrictAnchorMatches(
  manifest: CharacterStoryBenchmarkExecutionManifest,
  runtimeAnchor: ControlledRuntimeAnchor,
): boolean {
  const strict = manifest.strict_readiness;
  return strict.provider === 'dedicated_strict_bridge'
    && strict.technical_ready
    && strict.model_runtime === runtimeAnchor.model_runtime
    && strict.selected_model_cli_realpath === runtimeAnchor.selected_cli_realpath
    && strict.selected_model_cli_sha256 === runtimeAnchor.selected_cli_sha256
    && strict.selected_model_cli_executable === runtimeAnchor.selected_cli_executable
    && strict.strict_bridge_realpath === runtimeAnchor.strict_bridge_realpath
    && strict.strict_bridge_sha256 === runtimeAnchor.strict_bridge_sha256
    && strict.strict_bridge_readable === runtimeAnchor.strict_bridge_readable;
}

function prepareRunMaterials(input: {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  now: string;
}): PreparedRunMaterial[] {
  const manifestSha256 = hashProfessionalBenchmarkArtifact(input.manifest);
  return input.manifest.packages.map((executionPackage, index) => {
    const promptPackage = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
    const ledger = prepareProfessionalBenchmarkRun({
      manifest: input.manifest,
      prompt_package: promptPackage,
      benchmark_id: executionPackage.benchmark_id,
      run_id: deterministicRunId(index, manifestSha256),
      now: input.now,
    });
    return { executionPackage, promptPackage, ledger };
  });
}

function planHashInput(plan: Omit<ControlledCharacterBenchmarkRunPlan, 'integrity_sha256'>): string {
  return hashProfessionalBenchmarkArtifact(plan);
}

export async function buildControlledCharacterBenchmarkPlan(input: {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  now?: string;
  source_manifest_path?: string;
}): Promise<ControlledCharacterBenchmarkRunPlan> {
  assertStoredManifestShape(input.manifest);
  const generatedAt = input.now ?? new Date().toISOString();
  const manifestSha256 = hashProfessionalBenchmarkArtifact(input.manifest);
  const runtimeAnchor = await inspectRuntimeAnchor(input.manifest);
  const strictAnchorMatches = manifestStrictAnchorMatches(input.manifest, runtimeAnchor);
  const runtimeAnchorSha256 = hashProfessionalBenchmarkArtifact(runtimeAnchor);
  const materials = prepareRunMaterials({ manifest: input.manifest, now: generatedAt });
  const runs = materials.map(({ executionPackage, promptPackage, ledger }) => ({
    benchmark_id: executionPackage.benchmark_id,
    run_id: ledger.run_id,
    source_snapshot_sha256: executionPackage.source_snapshot.snapshot_sha256,
    execution_package_sha256: ledger.execution_package_sha256,
    professional_prompt_sha256: promptPackage.prompt_sha256,
    prompt_package_sha256: ledger.prompt_package_sha256,
    story_prompt_sha256: ledger.story_prompt_sha256,
    runtime_anchor_sha256: runtimeAnchorSha256,
    ledger_status: 'prepared' as const,
    execution_state: 'blocked' as const,
    blockers: unique([
      ...ledger.blockers,
      'execute_intent_not_selected',
      'operator_execution_authorization_missing',
      'operator_paid_execution_authorization_missing',
      'operator_credentials_not_verified',
      'operator_authorization_reference_missing',
      'operator_batch_budget_missing',
      strictAnchorMatches ? '' : 'manifest_strict_anchor_not_current',
      runtimeAnchor.selected_cli_executable ? '' : 'frozen_runtime_cli_not_executable',
      runtimeAnchor.strict_bridge_readable ? '' : 'fixed_strict_bridge_not_readable',
    ]),
    real_model_completed: false as const,
    human_blind_review_passed: false as const,
    professional_passed: false as const,
  }));
  const planWithoutIntegrity: Omit<ControlledCharacterBenchmarkRunPlan, 'integrity_sha256'> = {
    schema_version: CONTROLLED_PLAN_SCHEMA_VERSION,
    generated_at: generatedAt,
    video_type: 'character_story',
    source_manifest_path: input.source_manifest_path ?? manifestRelativePath,
    source_manifest_sha256: manifestSha256,
    runtime_anchor: runtimeAnchor,
    mode: 'plan_only',
    policy: {
      invokes_model: false,
      writes_model_outputs: false,
      plan_contains_prompt_text: false,
      explicit_execute_authorization_required: true,
      paid_execution_authorization_required: true,
      verified_credentials_required: true,
      positive_budget_cap_required: true,
      absolute_cli_realpath_required: true,
      operator_env_authorization_required: true,
      approved_cli_path_and_sha_required: true,
      fixed_strict_bridge_only: true,
      arbitrary_command_or_extra_args_allowed: false,
      fixture_or_simulation_counts_as_real_run: false,
      fixture_or_simulation_counts_as_professional_pass: false,
    },
    summary: {
      fixed_project_spec_count: runs.length,
      professional_prompt_ready_count: runs.length,
      prepared_run_ledger_count: runs.length,
      strict_technical_ready_count: materials.filter(({ executionPackage }) =>
        strictAnchorMatches
        && executionPackage.status === 'source_package_ready'
      ).length,
      selected_cli_anchor_ready_count: runtimeAnchor.selected_cli_executable ? runs.length : 0,
      strict_bridge_anchor_ready_count: runtimeAnchor.strict_bridge_readable ? runs.length : 0,
      blocked_run_count: runs.length,
      model_invocation_count: 0,
      real_model_completed_count: 0,
      fixed_real_model_project_count: 0,
      fixed_real_model_project_pass_count: 0,
      human_blind_review_pass_count: 0,
      professional_pass_count: 0,
      fixture_or_simulation_credit_count: 0,
    },
    runs,
  };
  return {
    ...planWithoutIntegrity,
    integrity_sha256: planHashInput(planWithoutIntegrity),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateControlledCharacterBenchmarkPlan(
  value: unknown,
): { valid: boolean; blockers: string[] } {
  if (!isRecord(value)) return { valid: false, blockers: ['plan_not_object'] };
  if (value.schema_version === 'character-story-controlled-benchmark-run-plan/v1') {
    return { valid: false, blockers: ['legacy_controlled_plan_read_only_rebuild_v2'] };
  }
  const plan = value as unknown as ControlledCharacterBenchmarkRunPlan;
  const runs = Array.isArray(plan.runs) ? plan.runs : [];
  const summary: Record<string, unknown> = isRecord(plan.summary) ? plan.summary : {};
  const policy: Record<string, unknown> = isRecord(plan.policy) ? plan.policy : {};
  const runtimeAnchor: Record<string, unknown> = isRecord(plan.runtime_anchor)
    ? plan.runtime_anchor
    : {};
  const hashInput = { ...plan } as Partial<ControlledCharacterBenchmarkRunPlan>;
  delete hashInput.integrity_sha256;
  const forbiddenPromptKeys = /(?:^|\")(?:system_prompt|user_prompt|entry_story|story_generation_prompt|prompt_package|execution_package)(?:\"|$)/;
  const blockers = [
    plan.schema_version === CONTROLLED_PLAN_SCHEMA_VERSION ? '' : 'invalid_schema_version',
    plan.video_type === 'character_story' ? '' : 'invalid_video_type',
    plan.mode === 'plan_only' ? '' : 'plan_mode_not_plan_only',
    plan.source_manifest_path === manifestRelativePath ? '' : 'source_manifest_path_mismatch',
    Number.isFinite(Date.parse(String(plan.generated_at ?? ''))) ? '' : 'generated_at_invalid',
    /^[a-f0-9]{64}$/.test(String(plan.source_manifest_sha256 ?? '')) ? '' : 'source_manifest_sha256_invalid',
    /^[a-f0-9]{64}$/.test(String(plan.integrity_sha256 ?? '')) ? '' : 'integrity_sha256_invalid',
    plan.integrity_sha256 === hashProfessionalBenchmarkArtifact(hashInput) ? '' : 'integrity_sha256_mismatch',
    runs.length === 5 ? '' : 'run_count_not_five',
    new Set(runs.map(run => run.benchmark_id)).size === runs.length ? '' : 'duplicate_benchmark_id',
    new Set(runs.map(run => run.run_id)).size === runs.length ? '' : 'duplicate_run_id',
    runs.every(run => !/fixture|simulation/i.test(`${run.benchmark_id}:${run.run_id}`))
      ? ''
      : 'fixture_or_simulation_run_identity',
    runs.every(run => [
      run.source_snapshot_sha256,
      run.execution_package_sha256,
      run.professional_prompt_sha256,
      run.prompt_package_sha256,
      run.story_prompt_sha256,
    ].every(hash => /^[a-f0-9]{64}$/.test(String(hash))))
      ? ''
      : 'run_evidence_sha256_invalid',
    runs.every(run => run.ledger_status === 'prepared' && run.execution_state === 'blocked')
      ? ''
      : 'run_not_prepared_blocked',
    runs.every(run => run.blockers.length > 0) ? '' : 'blocked_run_without_blocker',
    runs.every(run => /^[a-f0-9]{64}$/.test(String(run.runtime_anchor_sha256 ?? '')))
      ? ''
      : 'runtime_anchor_sha256_invalid',
    runs.every(run => run.runtime_anchor_sha256 === hashProfessionalBenchmarkArtifact(plan.runtime_anchor))
      ? ''
      : 'runtime_anchor_sha256_mismatch',
    runs.every(run => run.real_model_completed === false
      && run.human_blind_review_passed === false
      && run.professional_passed === false)
      ? ''
      : 'unsupported_run_credit',
    summary.fixed_project_spec_count === 5 ? '' : 'fixed_project_spec_count_not_five',
    summary.professional_prompt_ready_count === 5 ? '' : 'professional_prompt_ready_count_not_five',
    summary.prepared_run_ledger_count === 5 ? '' : 'prepared_run_ledger_count_not_five',
    summary.blocked_run_count === 5 ? '' : 'blocked_run_count_not_five',
    Number.isInteger(summary.strict_technical_ready_count)
      && Number(summary.strict_technical_ready_count) >= 0
      && Number(summary.strict_technical_ready_count) <= 5
      ? ''
      : 'strict_technical_ready_count_invalid',
    Number.isInteger(summary.selected_cli_anchor_ready_count)
      && (summary.selected_cli_anchor_ready_count === 0 || summary.selected_cli_anchor_ready_count === 5)
      ? ''
      : 'selected_cli_anchor_ready_count_invalid',
    Number.isInteger(summary.strict_bridge_anchor_ready_count)
      && (summary.strict_bridge_anchor_ready_count === 0 || summary.strict_bridge_anchor_ready_count === 5)
      ? ''
      : 'strict_bridge_anchor_ready_count_invalid',
    summary.model_invocation_count === 0 ? '' : 'model_invocation_count_not_zero',
    summary.real_model_completed_count === 0 ? '' : 'real_model_completed_count_not_zero',
    summary.fixed_real_model_project_count === 0 ? '' : 'fixed_real_model_project_count_not_zero',
    summary.fixed_real_model_project_pass_count === 0 ? '' : 'fixed_real_model_project_pass_count_not_zero',
    summary.human_blind_review_pass_count === 0 ? '' : 'human_blind_review_pass_count_not_zero',
    summary.professional_pass_count === 0 ? '' : 'professional_pass_count_not_zero',
    summary.fixture_or_simulation_credit_count === 0 ? '' : 'fixture_or_simulation_credit_count_not_zero',
    policy.invokes_model === false && policy.writes_model_outputs === false ? '' : 'plan_has_execution_side_effects',
    policy.plan_contains_prompt_text === false ? '' : 'plan_claims_prompt_text',
    policy.fixed_strict_bridge_only === true ? '' : 'strict_bridge_not_required',
    policy.operator_env_authorization_required === true ? '' : 'operator_env_authorization_not_required',
    policy.approved_cli_path_and_sha_required === true ? '' : 'approved_cli_anchor_not_required',
    policy.arbitrary_command_or_extra_args_allowed === false ? '' : 'arbitrary_command_or_args_allowed',
    policy.fixture_or_simulation_counts_as_real_run === false
      && policy.fixture_or_simulation_counts_as_professional_pass === false
      ? ''
      : 'fixture_or_simulation_credit_allowed',
    runtimeAnchor.model_runtime === 'claude' || runtimeAnchor.model_runtime === 'codex'
      ? ''
      : 'runtime_anchor_model_runtime_invalid',
    runtimeAnchor.selected_cli_executable === true
      ? (/^[a-f0-9]{64}$/.test(String(runtimeAnchor.selected_cli_sha256 ?? ''))
        && path.isAbsolute(String(runtimeAnchor.selected_cli_realpath ?? ''))
        ? ''
        : 'selected_cli_anchor_incomplete')
      : (runtimeAnchor.selected_cli_realpath === null && runtimeAnchor.selected_cli_sha256 === null
        ? ''
        : 'selected_cli_unavailable_anchor_inconsistent'),
    runtimeAnchor.strict_bridge_readable === true
      ? (/^[a-f0-9]{64}$/.test(String(runtimeAnchor.strict_bridge_sha256 ?? ''))
        && path.isAbsolute(String(runtimeAnchor.strict_bridge_realpath ?? ''))
        ? ''
        : 'strict_bridge_anchor_incomplete')
      : (runtimeAnchor.strict_bridge_realpath === null && runtimeAnchor.strict_bridge_sha256 === null
        ? ''
        : 'strict_bridge_unavailable_anchor_inconsistent'),
    forbiddenPromptKeys.test(JSON.stringify(plan)) ? 'plan_contains_forbidden_prompt_payload' : '',
  ].filter(Boolean);
  return { valid: blockers.length === 0, blockers: unique(blockers) };
}

export async function inspectControlledExecutionGates(
  input: ControlledExecutionGateInput,
): Promise<ControlledExecutionGateResult> {
  const { manifest, plan, options } = input;
  const operatorEnv = input.operator_env ?? process.env;
  const currentAnchor = await inspectRuntimeAnchor(manifest);
  const currentAnchorMatches = hashProfessionalBenchmarkArtifact(currentAnchor)
    === hashProfessionalBenchmarkArtifact(plan.runtime_anchor);
  const strictManifestAnchorMatches = manifestStrictAnchorMatches(manifest, currentAnchor);
  const runtime = currentAnchor.model_runtime;
  const cliRealpath = currentAnchor.selected_cli_realpath;
  const authorizationReference = operatorEnv.PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE?.trim() ?? '';
  const budgetCapAmount = Number(operatorEnv.PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP ?? '');
  const currency = operatorEnv.PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY?.trim().toUpperCase() ?? '';
  const approvedCliPathKey = runtime === 'codex'
    ? 'PROFESSIONAL_BENCHMARK_APPROVED_CODEX_CLI_PATH'
    : 'PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_PATH';
  const approvedCliShaKey = runtime === 'codex'
    ? 'PROFESSIONAL_BENCHMARK_APPROVED_CODEX_CLI_SHA256'
    : 'PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_SHA256';
  const approvedCliPath = operatorEnv[approvedCliPathKey]?.trim() ?? '';
  const approvedCliSha256 = operatorEnv[approvedCliShaKey]?.trim().toLowerCase() ?? '';
  const planValidation = validateControlledCharacterBenchmarkPlan(plan);
  let rebuiltPlanMatches = false;
  try {
    const rebuiltPlan = await buildControlledCharacterBenchmarkPlan({
      manifest,
      now: plan.generated_at,
      source_manifest_path: plan.source_manifest_path,
    });
    rebuiltPlanMatches = rebuiltPlan.integrity_sha256 === plan.integrity_sha256;
  } catch {
    rebuiltPlanMatches = false;
  }
  const blockers = unique([
    options.mode === 'execute' ? '' : 'execute_mode_not_selected',
    operatorEnv.PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED === '1'
      ? ''
      : 'operator_execution_authorization_missing',
    operatorEnv.PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED === '1'
      ? ''
      : 'operator_paid_execution_authorization_missing',
    operatorEnv.PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED === '1'
      ? ''
      : 'operator_credentials_not_verified',
    authorizationReference ? '' : 'operator_authorization_reference_missing',
    Number.isFinite(budgetCapAmount) && budgetCapAmount > 0
      ? ''
      : 'operator_positive_batch_budget_missing',
    /^[A-Z]{3}$/.test(currency) ? '' : 'operator_budget_currency_invalid',
    options.timeout_ms === undefined
      || (Number.isInteger(options.timeout_ms) && options.timeout_ms >= 1000 && options.timeout_ms <= 910000)
      ? ''
      : 'timeout_ms_out_of_range',
    currentAnchor.selected_cli_executable ? '' : 'frozen_runtime_cli_not_executable',
    currentAnchor.strict_bridge_readable ? '' : 'fixed_strict_bridge_not_readable',
    currentAnchorMatches ? '' : 'frozen_runtime_anchor_mismatch',
    approvedCliPath && approvedCliPath === plan.runtime_anchor.selected_cli_realpath
      ? ''
      : 'operator_approved_cli_path_mismatch',
    /^[a-f0-9]{64}$/.test(approvedCliSha256)
      && approvedCliSha256 === plan.runtime_anchor.selected_cli_sha256
      ? ''
      : 'operator_approved_cli_sha256_mismatch',
    runtime ? '' : 'benchmark_runtime_not_single_supported_cli',
    manifest.strict_readiness.technical_ready ? '' : 'strict_technical_readiness_missing',
    strictManifestAnchorMatches ? '' : 'manifest_strict_anchor_not_current',
    manifest.packages.every(item => item.status === 'source_package_ready')
      ? ''
      : 'source_packages_not_ready',
    plan.summary.strict_technical_ready_count === plan.runs.length
      ? ''
      : 'plan_strict_technical_readiness_missing',
    planValidation.valid ? '' : `invalid_controlled_plan:${planValidation.blockers.join(',')}`,
    rebuiltPlanMatches ? '' : 'controlled_plan_not_current',
  ]);
  return {
    ready: blockers.length === 0,
    runtime,
    cli_realpath: cliRealpath,
    cli_sha256: currentAnchor.selected_cli_sha256,
    authorization_reference: authorizationReference || null,
    budget_cap_amount: Number.isFinite(budgetCapAmount) && budgetCapAmount > 0
      ? budgetCapAmount
      : null,
    budget_currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    blockers,
  };
}

function executionArtifactEnvelope(input: {
  artifactId: string;
  runId: string;
  benchmarkId: string;
  kind: ProfessionalBenchmarkArtifactKind;
  schemaVersion: string;
  producer: ProfessionalBenchmarkArtifactProducer;
  parents: string[];
  payload: unknown;
  now: string;
}): Record<string, unknown> {
  return {
    schema_version: 'professional-benchmark-artifact-envelope/v1',
    artifact_id: input.artifactId,
    benchmark_id: input.benchmarkId,
    run_id: input.runId,
    artifact_kind: input.kind,
    payload_schema_version: input.schemaVersion,
    created_at: input.now,
    producer: input.producer,
    parent_artifact_sha256: input.parents,
    payload: input.payload,
  };
}

async function writeJsonExclusive(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

async function writePersistedArtifact(input: {
  directory: string;
  relativePath: string;
  artifactId: string;
  benchmarkId: string;
  runId: string;
  kind: ProfessionalBenchmarkArtifactKind;
  schemaVersion: string;
  producer: ProfessionalBenchmarkArtifactProducer;
  parents: string[];
  payload: unknown;
  now: string;
}): Promise<ProfessionalBenchmarkArtifactReference> {
  const artifactEnvelope = executionArtifactEnvelope({
    artifactId: input.artifactId,
    runId: input.runId,
    benchmarkId: input.benchmarkId,
    kind: input.kind,
    schemaVersion: input.schemaVersion,
    producer: input.producer,
    parents: input.parents,
    payload: input.payload,
    now: input.now,
  });
  const content = `${JSON.stringify(artifactEnvelope, null, 2)}\n`;
  await writeFile(path.join(input.directory, input.relativePath), content, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return {
    artifact_id: input.artifactId,
    kind: input.kind,
    relative_path: input.relativePath,
    sha256: sha256Text(content),
    byte_size: Buffer.byteLength(content, 'utf8'),
    payload_schema_version: input.schemaVersion,
    created_at: input.now,
    producer: input.producer,
    parent_artifact_sha256: [...input.parents],
  };
}

/** Builds the durable receipt that cryptographically binds the raw bridge response to both model outputs. */
export function buildPersistedProviderReceiptPayload(input: {
  benchmark_id: string;
  run_id: string;
  envelope: ProfessionalBenchmarkAdapterEnvelope;
}): Record<string, unknown> {
  const provenance = input.envelope.provenance;
  return {
    schema_version: 'professional-benchmark-provider-receipt/v1',
    benchmark_id: input.benchmark_id,
    run_id: input.run_id,
    provider: provenance.provider,
    runtime: provenance.runtime,
    requested_model_id: provenance.requested_model_id,
    reported_model_id: provenance.reported_model_id,
    prompt_sha256: provenance.prompt_sha256,
    provider_response_sha256: provenance.provider_response_sha256,
    bridge_envelope_sha256: hashProfessionalBenchmarkArtifact(input.envelope),
    story_sha256: provenance.story_sha256,
    character_evidence_sha256: provenance.character_evidence_sha256,
    used_fallback: provenance.used_fallback,
    provenance_complete: provenance.provenance_complete,
    exit_code: provenance.exit_code,
    started_at: provenance.started_at,
    finished_at: provenance.finished_at,
    cli_realpath: provenance.cli_realpath,
    cli_sha256: provenance.cli_sha256,
    cli_version: provenance.cli_version,
    operator_authorization: provenance.operator_authorization,
  };
}

async function persistExecutedRun(input: {
  material: PreparedRunMaterial;
  envelope: ProfessionalBenchmarkAdapterEnvelope;
  ledger: ProfessionalBenchmarkRunLedger;
  now: string;
}): Promise<void> {
  const finalDir = path.join(executionRoot, input.ledger.run_id);
  const temporaryDir = `${finalDir}.tmp-${process.pid}`;
  await mkdir(executionRoot, { recursive: true });
  await mkdir(temporaryDir, { recursive: false });
  try {
    // Preserve the immutable raw inputs and strict bridge receipt before deriving
    // the normalized artifact chain. A later contract failure must not erase a
    // paid external-model response that operators need for audit and recovery.
    await writeJsonExclusive(path.join(temporaryDir, 'execution-package.json'), input.material.executionPackage);
    await writeJsonExclusive(path.join(temporaryDir, 'strict-bridge-envelope.json'), input.envelope);
    await writeJsonExclusive(path.join(temporaryDir, 'run-ledger.json'), input.ledger);
    const promptArtifact = await writePersistedArtifact({
      directory: temporaryDir,
      relativePath: 'prompt-package.artifact.json',
      artifactId: `${input.ledger.run_id}:prompt-package`,
      runId: input.ledger.run_id,
      benchmarkId: input.ledger.benchmark_id,
      kind: 'prompt_package',
      schemaVersion: 'character-story-professional-benchmark-prompt/v2',
      producer: 'runner',
      parents: [],
      payload: input.material.promptPackage,
      now: input.now,
    });
    const provenance = input.envelope.provenance;
    const providerReceiptPayload = buildPersistedProviderReceiptPayload({
      benchmark_id: input.ledger.benchmark_id,
      run_id: input.ledger.run_id,
      envelope: input.envelope,
    });
    const providerArtifact = await writePersistedArtifact({
      directory: temporaryDir,
      relativePath: 'provider-receipt.artifact.json',
      artifactId: `${input.ledger.run_id}:provider-receipt`,
      runId: input.ledger.run_id,
      benchmarkId: input.ledger.benchmark_id,
      kind: 'provider_receipt',
      schemaVersion: 'professional-benchmark-provider-receipt/v1',
      producer: 'model',
      parents: [promptArtifact.sha256],
      payload: providerReceiptPayload,
      now: input.now,
    });
    const initialStoryPayload = {
      schema_version: 'professional-benchmark-initial-story/v2',
      ...(input.envelope.story as Record<string, unknown>),
    };
    const storyArtifact = await writePersistedArtifact({
      directory: temporaryDir,
      relativePath: 'initial-story.artifact.json',
      artifactId: `${input.ledger.run_id}:initial-story`,
      runId: input.ledger.run_id,
      benchmarkId: input.ledger.benchmark_id,
      kind: 'initial_story',
      schemaVersion: 'professional-benchmark-initial-story/v2',
      producer: 'model',
      parents: [promptArtifact.sha256, providerArtifact.sha256],
      payload: initialStoryPayload,
      now: input.now,
    });
    const characterEvidencePayload = {
      schema_version: 'character-story-professional-evidence/v1',
      ...(input.envelope.character_evidence as Record<string, unknown>),
    };
    const evidenceArtifact = await writePersistedArtifact({
      directory: temporaryDir,
      relativePath: 'character-evidence.artifact.json',
      artifactId: `${input.ledger.run_id}:character-evidence`,
      runId: input.ledger.run_id,
      benchmarkId: input.ledger.benchmark_id,
      kind: 'character_evidence',
      schemaVersion: 'character-story-professional-evidence/v1',
      producer: 'model',
      parents: [storyArtifact.sha256],
      payload: characterEvidencePayload,
      now: input.now,
    });
    if (!provenance.usage || !provenance.cost) {
      throw new Error(`Provider usage or cost is missing: ${input.ledger.run_id}`);
    }
    const usagePayload = {
      schema_version: 'professional-benchmark-usage-and-cost/v1',
      benchmark_id: input.ledger.benchmark_id,
      run_id: input.ledger.run_id,
      provider: provenance.provider,
      runtime: provenance.runtime,
      model_id: provenance.requested_model_id,
      input_tokens: provenance.usage.input_tokens,
      output_tokens: provenance.usage.output_tokens,
      cached_input_tokens: provenance.usage.cache_read_input_tokens,
      cost_amount: provenance.cost.amount,
      cost_currency: provenance.cost.currency,
      usage_source: provenance.usage.source,
      provider_receipt_sha256: providerArtifact.sha256,
    };
    const usageArtifact = await writePersistedArtifact({
      directory: temporaryDir,
      relativePath: 'usage-and-cost.artifact.json',
      artifactId: `${input.ledger.run_id}:usage-and-cost`,
      runId: input.ledger.run_id,
      benchmarkId: input.ledger.benchmark_id,
      kind: 'usage_and_cost',
      schemaVersion: 'professional-benchmark-usage-and-cost/v1',
      producer: 'model',
      parents: [providerArtifact.sha256],
      payload: usagePayload,
      now: input.now,
    });
    const artifactReferences = [
      promptArtifact,
      providerArtifact,
      storyArtifact,
      evidenceArtifact,
      usageArtifact,
    ];
    const artifactValidation = await validateProfessionalBenchmarkArtifacts({
      run_root: temporaryDir,
      benchmark_id: input.ledger.benchmark_id,
      run_id: input.ledger.run_id,
      artifacts: artifactReferences,
      validation_profile: 'initial_run',
    });
    if (!artifactValidation.integrity_valid || !artifactValidation.contract_valid) {
      throw new Error(
        `Persisted initial-run artifacts failed validation: ${artifactValidation.blockers.join(',')}`,
      );
    }
    await writeJsonExclusive(path.join(temporaryDir, 'artifact-registry.json'), {
      schema_version: 'professional-benchmark-persisted-artifact-registry/v1',
      benchmark_id: input.ledger.benchmark_id,
      run_id: input.ledger.run_id,
      validation_profile: 'initial_run',
      integrity_valid: artifactValidation.integrity_valid,
      contract_valid: artifactValidation.contract_valid,
      professional_passed: false,
      artifacts: artifactReferences,
    });
    await rename(temporaryDir, finalDir);
  } catch (error) {
    const quarantineDir = `${finalDir}.rejected-${Date.now()}`;
    let retainedAt = temporaryDir;
    try {
      await rename(temporaryDir, quarantineDir);
      retainedAt = quarantineDir;
    } catch {
      // Keep the temporary directory in place if quarantine rename itself fails.
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}; paid-run evidence retained at ${retainedAt}`);
  }
}

export async function executeControlledCharacterBenchmarkBatch(input: {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  plan: ControlledCharacterBenchmarkRunPlan;
  options: ControlledRunnerOptions;
  now?: string;
}): Promise<ControlledCharacterBenchmarkExecutionSummary> {
  const gate = await inspectControlledExecutionGates({
    manifest: input.manifest,
    plan: input.plan,
    options: input.options,
  });
  if (!gate.ready || !gate.runtime || !gate.cli_realpath || !gate.cli_sha256) {
    throw new Error(`Controlled benchmark execution blocked: ${gate.blockers.join(',')}`);
  }
  const runtime = gate.runtime;
  const cliRealpath = gate.cli_realpath;
  const now = input.now ?? new Date().toISOString();
  const authorizationReference = gate.authorization_reference ?? '';
  const budgetCap = gate.budget_cap_amount ?? 0;
  const currency = gate.budget_currency ?? '';
  const materials = prepareRunMaterials({ manifest: input.manifest, now });
  await mkdir(executionRoot, { recursive: true });
  const batchLockPath = path.join(executionRoot, '.controlled-batch.lock');
  try {
    await mkdir(batchLockPath, { recursive: false });
  } catch {
    throw new Error('Another controlled character benchmark batch holds the execution lock');
  }
  try {
  for (const material of materials) {
    try {
      await access(path.join(executionRoot, material.ledger.run_id));
      throw new Error(`Controlled run output already exists: ${material.ledger.run_id}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Controlled run output already exists:')) throw error;
    }
  }

  let totalCost = 0;
  let stoppedForBudget = false;
  const runs: ControlledCharacterBenchmarkExecutionSummary['runs'] = [];
  for (const material of materials) {
    const remainingBudget = remainingControlledBatchBudget({
      batch_cap: budgetCap,
      spent: totalCost,
    });
    if (remainingBudget <= 0) {
      stoppedForBudget = true;
      break;
    }
    const authorizedLedger = authorizeProfessionalBenchmarkRun({
      ledger: material.ledger,
      authorization: {
        credential_status: 'verified',
        budget_authorized: true,
        runtime_activated: true,
        authorization_reference: authorizationReference,
        budget_cap: { amount: remainingBudget, currency },
        approved_cli_realpath: gate.cli_realpath,
        approved_cli_sha256: gate.cli_sha256,
      },
      now,
    });
    const strictResult = await executeProfessionalBenchmarkInitialRunWithStrictBridge({
      ledger: authorizedLedger,
      execution_package: material.executionPackage,
      prompt_package: material.promptPackage,
      execute_authorized: input.options.mode === 'execute'
        && process.env.PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED === '1',
      paid_authorized: process.env.PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED === '1',
      runtime_cli_paths: { [runtime]: cliRealpath },
      timeout_ms: input.options.timeout_ms,
      now,
    });
    const ledger = strictResult.ledger;
    const capturedEnvelope = strictResult.envelope;
    if (!capturedEnvelope) {
      throw new Error(`Strict bridge did not return a captured envelope: ${material.ledger.run_id}`);
    }
    await persistExecutedRun({ material, envelope: capturedEnvelope, ledger, now });
    if (ledger.status !== 'professional_evidence_pending'
      || ledger.provenance.status !== 'verified_initial_external') {
      throw new Error(`Strict bridge result did not reach verified initial evidence: ${material.ledger.run_id}`);
    }
    const reportedCost = capturedEnvelope.provenance.cost;
    if (!reportedCost || reportedCost.currency.toUpperCase() !== currency) {
      throw new Error(`Provider cost currency mismatch: ${material.ledger.run_id}`);
    }
    totalCost += reportedCost.amount;
    runs.push({
      benchmark_id: ledger.benchmark_id,
      run_id: ledger.run_id,
      ledger_status: ledger.status,
      run_ledger_sha256: hashProfessionalBenchmarkArtifact(ledger),
      professional_passed: false,
    });
    if (totalCost > budgetCap) {
      stoppedForBudget = true;
      break;
    }
  }
  return {
    schema_version: CONTROLLED_EXECUTION_SCHEMA_VERSION,
    generated_at: now,
    video_type: 'character_story',
    source_plan_sha256: input.plan.integrity_sha256,
    authorization_reference_sha256: sha256Text(authorizationReference),
    budget_cap: { amount: budgetCap, currency },
    summary: {
      attempted_count: runs.length,
      initial_real_model_completed_count: runs.filter(run =>
        run.ledger_status === 'professional_evidence_pending'
      ).length,
      professional_pass_count: 0,
      human_blind_review_pass_count: 0,
      total_reported_cost: totalCost,
      cost_currency: currency,
      stopped_for_budget: stoppedForBudget,
    },
    runs,
  };
  } finally {
    await rm(batchLockPath, { recursive: true, force: true });
  }
}

async function readManifest(): Promise<CharacterStoryBenchmarkExecutionManifest> {
  return JSON.parse(await readFile(manifestPath, 'utf8')) as CharacterStoryBenchmarkExecutionManifest;
}

export async function readAndValidateStoredControlledPlan(): Promise<ControlledCharacterBenchmarkRunPlan> {
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as unknown;
  const validation = validateControlledCharacterBenchmarkPlan(plan);
  if (!validation.valid) {
    throw new Error(`Controlled benchmark plan failed checks: ${validation.blockers.join(',')}`);
  }
  const typedPlan = plan as ControlledCharacterBenchmarkRunPlan;
  const sourceManifest = await readManifest();
  if (typedPlan.source_manifest_sha256 !== hashProfessionalBenchmarkArtifact(sourceManifest)) {
    throw new Error('Controlled benchmark plan source manifest hash is stale');
  }
  const currentAnchor = await inspectRuntimeAnchor(sourceManifest);
  if (hashProfessionalBenchmarkArtifact(typedPlan.runtime_anchor)
    !== hashProfessionalBenchmarkArtifact(currentAnchor)) {
    throw new Error('Controlled benchmark plan runtime anchor is stale');
  }
  const rebuiltPlan = await buildControlledCharacterBenchmarkPlan({
    manifest: sourceManifest,
    now: typedPlan.generated_at,
    source_manifest_path: typedPlan.source_manifest_path,
  });
  if (rebuiltPlan.integrity_sha256 !== typedPlan.integrity_sha256) {
    throw new Error('Controlled benchmark plan prompt or run ledger hashes are stale');
  }
  if (typedPlan.summary.model_invocation_count !== 0
    || typedPlan.summary.real_model_completed_count !== 0
    || typedPlan.summary.fixed_real_model_project_count !== 0
    || typedPlan.summary.fixed_real_model_project_pass_count !== 0
    || typedPlan.summary.human_blind_review_pass_count !== 0
    || typedPlan.summary.professional_pass_count !== 0
    || typedPlan.summary.fixture_or_simulation_credit_count !== 0) {
    throw new Error('Stored controlled benchmark plan does not preserve the zero-execution zero-credit baseline');
  }
  return typedPlan;
}

async function main(): Promise<void> {
  const options = parseControlledRunnerArgs(process.argv.slice(2));
  if (options.mode === 'check') {
    const checked = await readAndValidateStoredControlledPlan();
    process.stdout.write(`${JSON.stringify({
      checked: true,
      plan_path: planRelativePath,
      integrity_sha256: checked.integrity_sha256,
      summary: checked.summary,
    }, null, 2)}\n`);
    return;
  }
  const manifest = await readManifest();
  if (options.mode === 'execute') {
    const storedPlan = await readAndValidateStoredControlledPlan();
    const result = await executeControlledCharacterBenchmarkBatch({
      manifest,
      plan: storedPlan,
      options,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const plan = await buildControlledCharacterBenchmarkPlan({ manifest });
  if (options.mode === 'write') {
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({
      written: true,
      plan_path: planRelativePath,
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
    process.stderr.write(`[story-agent-character-benchmark-runner] ${message}\n`);
    process.exitCode = 1;
  });
}
