import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import type {
  CharacterStoryBenchmarkExecutionManifest,
  CharacterStoryBenchmarkExecutionPackage,
} from './professional-benchmark-service.js';
import {
  buildCharacterStoryProfessionalBenchmarkPrompt,
  type CharacterStoryProfessionalBenchmarkPromptPackage,
} from './professional-benchmark-prompt-service.js';
import {
  runProfessionalBenchmarkBridgeAdapter,
  type ProfessionalBenchmarkBridgeEnvelope,
  type ProfessionalBenchmarkRuntimeCliPaths,
} from './professional-benchmark-bridge-adapter.js';

export type ProfessionalBenchmarkRunStatus =
  | 'prepared'
  | 'authorization_ready'
  | 'initial_generated'
  | 'professional_evidence_pending'
  | 'provenance_rejected'
  | 'execution_failed';

export type ProfessionalBenchmarkArtifactKind =
  | 'execution_package'
  | 'prompt_package'
  | 'adapter_envelope'
  | 'initial_story'
  | 'character_evidence'
  | 'model_usage_and_cost'
  | 'provider_receipt';

export interface ProfessionalBenchmarkRunTransition {
  transition_id: string;
  from: ProfessionalBenchmarkRunStatus | null;
  to: ProfessionalBenchmarkRunStatus;
  occurred_at: string;
  reason: string;
}

export interface ProfessionalBenchmarkRunArtifact {
  artifact_id: string;
  kind: ProfessionalBenchmarkArtifactKind;
  logical_path: string;
  sha256: string;
  byte_length: number;
  registered_at: string;
}

export interface ProfessionalBenchmarkArtifactRegistry {
  schema_version: 'professional-benchmark-artifact-registry/v1';
  artifact_count: number;
  registry_sha256: string;
  items: ProfessionalBenchmarkRunArtifact[];
}

export interface ProfessionalBenchmarkRunAuthorization {
  credential_status: 'unverified' | 'verified';
  budget_authorized: boolean;
  runtime_activated: boolean;
  authorization_reference?: string;
  budget_cap?: {
    amount: number;
    currency: string;
  };
  approved_cli_realpath?: string;
  approved_cli_sha256?: string;
}

export interface ProfessionalBenchmarkAdapterEnvelope {
  schema_version: 'professional-character-benchmark-bridge-output/v2';
  run_id: string;
  benchmark_id: string;
  story: unknown;
  character_evidence: unknown;
  provenance: {
    execution_kind: string;
    generation_mode: string;
    provider: string;
    used_fallback: boolean;
    runtime: string;
    model_profile_id: string;
    requested_model_id: string;
    reported_model_id: string | null;
    benchmark_prompt_version: string;
    story_prompt_version: string;
    prompt_sha256: string;
    source_snapshot_sha256: string;
    cli_realpath: string;
    cli_sha256: string;
    cli_version: string | null;
    operator_authorization: {
      reference_sha256: string;
      budget_cap: {
        amount: number;
        currency: string;
      };
    };
    started_at: string;
    finished_at: string;
    duration_ms: number;
    exit_code: number;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens: number;
      cache_creation_input_tokens: number;
      source: string;
    } | null;
    cost: {
      amount: number;
      currency: string;
      source: string;
    } | null;
    provider_response_sha256: string;
    story_sha256: string;
    character_evidence_sha256: string;
    provenance_complete: boolean;
    incomplete_reasons: string[];
  };
}

export interface ProfessionalBenchmarkAdapterInput {
  run_id: string;
  benchmark_id: string;
  execution_package: CharacterStoryBenchmarkExecutionPackage;
  prompt_package: CharacterStoryProfessionalBenchmarkPromptPackage;
}

export type ProfessionalBenchmarkAdapterImplementation = (
  input: ProfessionalBenchmarkAdapterInput,
) => Promise<ProfessionalBenchmarkAdapterEnvelope>;

const INTERNAL_TEST_ADAPTER_BRAND = Symbol('professional-benchmark-internal-test-adapter');

export type ProfessionalBenchmarkAdapter = ProfessionalBenchmarkAdapterImplementation & {
  readonly [INTERNAL_TEST_ADAPTER_BRAND]: true;
};

/**
 * The injectable adapter path exists only for deterministic state-machine tests.
 * Production execution must use the dedicated strict bridge entry point instead
 * of accepting an arbitrary callback that can self-assert provenance.
 */
export function createInternalProfessionalBenchmarkTestAdapter(
  implementation: ProfessionalBenchmarkAdapterImplementation,
): ProfessionalBenchmarkAdapter {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Internal professional benchmark adapters are restricted to NODE_ENV=test');
  }
  Object.defineProperty(implementation, INTERNAL_TEST_ADAPTER_BRAND, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  return implementation as ProfessionalBenchmarkAdapter;
}

export interface ProfessionalBenchmarkRunLedger {
  schema_version: 'professional-benchmark-run-ledger/v3';
  run_id: string;
  benchmark_id: string;
  video_type: 'character_story';
  status: ProfessionalBenchmarkRunStatus;
  created_at: string;
  updated_at: string;
  execution_package_sha256: string;
  prompt_package_sha256: string;
  story_prompt_sha256: string;
  expected_provenance: {
    execution_kind: 'real_model';
    provider: string;
    runtime: 'claude' | 'codex';
    model_profile_id: string;
    requested_model_id: string;
    benchmark_prompt_version: string;
    story_prompt_version: string;
    story_prompt_sha256: string;
    source_snapshot_sha256: string;
    strict_bridge_realpath: string | null;
    strict_bridge_sha256: string | null;
    cli_realpath: string | null;
    cli_sha256: string | null;
    operator_authorization: {
      reference_sha256: string;
      budget_cap: {
        amount: number;
        currency: string;
      };
    } | null;
  };
  runtime: {
    strict_technical_ready: boolean;
    strict_bridge_anchor_ready: boolean;
    strict_bridge_realpath: string | null;
    strict_bridge_sha256: string | null;
    source_package_ready: boolean;
  };
  authorization: ProfessionalBenchmarkRunAuthorization & {
    blockers: string[];
  };
  provenance: {
    status: 'pending' | 'verified_initial_external' | 'rejected';
    blockers: string[];
    observed?: {
      execution_kind: string;
      generation_mode: string;
      provider: string;
      used_fallback: boolean;
      runtime: string;
      model_profile_id: string;
      requested_model_id: string;
      reported_model_id: string | null;
      prompt_sha256: string;
      source_snapshot_sha256: string;
      cli_realpath: string;
      cli_sha256: string;
      operator_authorization_reference_sha256: string;
      operator_budget_cap_amount: number;
      operator_budget_cap_currency: string;
      provenance_complete: boolean;
    };
  };
  usage: {
    status: 'not_reported' | 'provider_reported';
    input_tokens: number | null;
    output_tokens: number | null;
    cached_input_tokens: number | null;
    cost_amount: number | null;
    cost_currency: string | null;
    provider_receipt_artifact_id?: string;
  };
  artifact_registry: ProfessionalBenchmarkArtifactRegistry;
  transitions: ProfessionalBenchmarkRunTransition[];
  blockers: string[];
  credit_eligible: false;
  professional_passed: false;
  ledger_seal_sha256: string;
}

const ALLOWED_TRANSITIONS: Record<ProfessionalBenchmarkRunStatus, ProfessionalBenchmarkRunStatus[]> = {
  prepared: ['authorization_ready'],
  authorization_ready: ['initial_generated', 'provenance_rejected', 'execution_failed'],
  initial_generated: ['professional_evidence_pending', 'provenance_rejected', 'execution_failed'],
  professional_evidence_pending: [],
  provenance_rejected: [],
  execution_failed: [],
};

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const TimestampSchema = z.string().datetime({ offset: true });
const RunStatusSchema = z.enum([
  'prepared',
  'authorization_ready',
  'initial_generated',
  'professional_evidence_pending',
  'provenance_rejected',
  'execution_failed',
]);
const ArtifactKindSchema = z.enum([
  'execution_package',
  'prompt_package',
  'adapter_envelope',
  'initial_story',
  'character_evidence',
  'model_usage_and_cost',
  'provider_receipt',
]);
const RunArtifactSchema = z.object({
  artifact_id: z.string().trim().min(1),
  kind: ArtifactKindSchema,
  logical_path: z.string().trim().min(1),
  sha256: Sha256Schema,
  byte_length: z.number().int().nonnegative(),
  registered_at: TimestampSchema,
}).strict();
const ArtifactRegistrySchema = z.object({
  schema_version: z.literal('professional-benchmark-artifact-registry/v1'),
  artifact_count: z.number().int().nonnegative(),
  registry_sha256: Sha256Schema,
  items: z.array(RunArtifactSchema),
}).strict();
const RunAuthorizationSchema = z.object({
  credential_status: z.enum(['unverified', 'verified']),
  budget_authorized: z.boolean(),
  runtime_activated: z.boolean(),
  authorization_reference: z.string().trim().min(1).optional(),
  budget_cap: z.object({
    amount: z.number().finite().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }).strict().optional(),
  approved_cli_realpath: z.string().trim().min(1).refine(value => path.isAbsolute(value), {
    message: 'approved_cli_realpath must be absolute',
  }).optional(),
  approved_cli_sha256: Sha256Schema.optional(),
  blockers: z.array(z.string()),
}).strict();
const RunAuthorizationInputSchema = RunAuthorizationSchema.omit({ blockers: true });
const ObservedProvenanceSchema = z.object({
  execution_kind: z.string(),
  generation_mode: z.string(),
  provider: z.string(),
  used_fallback: z.boolean(),
  runtime: z.string(),
  model_profile_id: z.string(),
  requested_model_id: z.string(),
  reported_model_id: z.string().nullable(),
  prompt_sha256: Sha256Schema,
  source_snapshot_sha256: Sha256Schema,
  cli_realpath: z.string().trim().min(1),
  cli_sha256: Sha256Schema,
  operator_authorization_reference_sha256: Sha256Schema,
  operator_budget_cap_amount: z.number().finite().positive(),
  operator_budget_cap_currency: z.string().regex(/^[A-Z]{3}$/),
  provenance_complete: z.boolean(),
}).strict();
const RunLedgerSchema = z.object({
  schema_version: z.literal('professional-benchmark-run-ledger/v3'),
  run_id: z.string().trim().min(1),
  benchmark_id: z.string().trim().min(1),
  video_type: z.literal('character_story'),
  status: RunStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  execution_package_sha256: Sha256Schema,
  prompt_package_sha256: Sha256Schema,
  story_prompt_sha256: Sha256Schema,
  expected_provenance: z.object({
    execution_kind: z.literal('real_model'),
    provider: z.string().trim().min(1),
    runtime: z.enum(['claude', 'codex']),
    model_profile_id: z.string().trim().min(1),
    requested_model_id: z.string().trim().min(1),
    benchmark_prompt_version: z.string().trim().min(1),
    story_prompt_version: z.string().trim().min(1),
    story_prompt_sha256: Sha256Schema,
    source_snapshot_sha256: Sha256Schema,
    strict_bridge_realpath: z.string().trim().min(1).refine(value => path.isAbsolute(value), {
      message: 'strict_bridge_realpath must be absolute',
    }).nullable(),
    strict_bridge_sha256: Sha256Schema.nullable(),
    cli_realpath: z.string().trim().min(1).nullable(),
    cli_sha256: Sha256Schema.nullable(),
    operator_authorization: z.object({
      reference_sha256: Sha256Schema,
      budget_cap: z.object({
        amount: z.number().finite().positive(),
        currency: z.string().regex(/^[A-Z]{3}$/),
      }).strict(),
    }).strict().nullable(),
  }).strict(),
  runtime: z.object({
    strict_technical_ready: z.boolean(),
    strict_bridge_anchor_ready: z.boolean(),
    strict_bridge_realpath: z.string().trim().min(1).refine(value => path.isAbsolute(value), {
      message: 'strict_bridge_realpath must be absolute',
    }).nullable(),
    strict_bridge_sha256: Sha256Schema.nullable(),
    source_package_ready: z.boolean(),
  }).strict(),
  authorization: RunAuthorizationSchema,
  provenance: z.object({
    status: z.enum(['pending', 'verified_initial_external', 'rejected']),
    blockers: z.array(z.string()),
    observed: ObservedProvenanceSchema.optional(),
  }).strict(),
  usage: z.object({
    status: z.enum(['not_reported', 'provider_reported']),
    input_tokens: z.number().finite().nonnegative().nullable(),
    output_tokens: z.number().finite().nonnegative().nullable(),
    cached_input_tokens: z.number().finite().nonnegative().nullable(),
    cost_amount: z.number().finite().nonnegative().nullable(),
    cost_currency: z.string().trim().min(1).nullable(),
    provider_receipt_artifact_id: z.string().trim().min(1).optional(),
  }).strict(),
  artifact_registry: ArtifactRegistrySchema,
  transitions: z.array(z.object({
    transition_id: z.string().trim().min(1),
    from: RunStatusSchema.nullable(),
    to: RunStatusSchema,
    occurred_at: TimestampSchema,
    reason: z.string().trim().min(1),
  }).strict()).min(1),
  blockers: z.array(z.string()),
  credit_eligible: z.literal(false),
  professional_passed: z.literal(false),
  ledger_seal_sha256: Sha256Schema,
}).strict();

function stableJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => item === undefined ? null : stableJsonValue(item));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableJsonValue(item)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableJsonValue(value));
}

export function hashProfessionalBenchmarkArtifact(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function hashAuthorizationReference(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

type UnsealedProfessionalBenchmarkRunLedger = Omit<
  ProfessionalBenchmarkRunLedger,
  'ledger_seal_sha256'
> & { ledger_seal_sha256?: string };

function ledgerSealInput(
  ledger: UnsealedProfessionalBenchmarkRunLedger | ProfessionalBenchmarkRunLedger,
): Omit<ProfessionalBenchmarkRunLedger, 'ledger_seal_sha256'> {
  const {
    ledger_seal_sha256: _discardedSeal,
    ...withoutSeal
  } = ledger;
  return withoutSeal as Omit<ProfessionalBenchmarkRunLedger, 'ledger_seal_sha256'>;
}

function sealProfessionalBenchmarkRunLedger(
  input: UnsealedProfessionalBenchmarkRunLedger | ProfessionalBenchmarkRunLedger,
): ProfessionalBenchmarkRunLedger {
  const withoutSeal = {
    ...ledgerSealInput(input),
    credit_eligible: false as const,
    professional_passed: false as const,
  };
  return {
    ...withoutSeal,
    ledger_seal_sha256: hashProfessionalBenchmarkArtifact(withoutSeal),
  };
}

function assertProfessionalBenchmarkRunLedger(
  input: ProfessionalBenchmarkRunLedger,
): ProfessionalBenchmarkRunLedger {
  if ((input as { schema_version?: string }).schema_version === 'professional-benchmark-run-ledger/v2') {
    throw new Error(
      'Invalid professional benchmark run ledger: legacy_run_ledger_v2_read_only_reprepare_v3',
    );
  }
  const parsed = RunLedgerSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid professional benchmark run ledger: ${parsed.error.issues
      .slice(0, 8)
      .map(issue => `${issue.path.join('.')}:${issue.code}`)
      .join(',')}`);
  }
  const ledger = parsed.data as ProfessionalBenchmarkRunLedger;
  const expectedSeal = hashProfessionalBenchmarkArtifact(ledgerSealInput(ledger));
  if (ledger.ledger_seal_sha256 !== expectedSeal) {
    throw new Error('Invalid professional benchmark run ledger: ledger_seal_mismatch');
  }
  if (ledger.artifact_registry.artifact_count !== ledger.artifact_registry.items.length) {
    throw new Error('Invalid professional benchmark run ledger: artifact_count_mismatch');
  }
  if (ledger.artifact_registry.registry_sha256
    !== hashProfessionalBenchmarkArtifact(ledger.artifact_registry.items)) {
    throw new Error('Invalid professional benchmark run ledger: artifact_registry_seal_mismatch');
  }
  const artifactIds = ledger.artifact_registry.items.map(item => item.artifact_id);
  const artifactPaths = ledger.artifact_registry.items.map(item => item.logical_path);
  const artifactHashes = ledger.artifact_registry.items.map(item => item.sha256);
  if (new Set(artifactIds).size !== artifactIds.length
    || new Set(artifactPaths).size !== artifactPaths.length
    || new Set(artifactHashes).size !== artifactHashes.length) {
    throw new Error('Invalid professional benchmark run ledger: duplicate_artifact_identity');
  }
  if (ledger.artifact_registry.items.some(item =>
    !item.artifact_id.startsWith(`${ledger.run_id}:`)
    || !item.logical_path.startsWith(`runs/${ledger.run_id}/`)
  )) {
    throw new Error('Invalid professional benchmark run ledger: artifact_run_identity_mismatch');
  }
  const executionArtifact = ledger.artifact_registry.items[0];
  const promptArtifact = ledger.artifact_registry.items[1];
  if (executionArtifact?.kind !== 'execution_package'
    || executionArtifact.sha256 !== ledger.execution_package_sha256
    || promptArtifact?.kind !== 'prompt_package'
    || promptArtifact.sha256 !== ledger.prompt_package_sha256) {
    throw new Error('Invalid professional benchmark run ledger: frozen_input_artifacts_mismatch');
  }
  if (ledger.expected_provenance.story_prompt_sha256 !== ledger.story_prompt_sha256) {
    throw new Error('Invalid professional benchmark run ledger: expected_story_prompt_hash_mismatch');
  }
  if (ledger.expected_provenance.strict_bridge_realpath !== ledger.runtime.strict_bridge_realpath
    || ledger.expected_provenance.strict_bridge_sha256 !== ledger.runtime.strict_bridge_sha256) {
    throw new Error('Invalid professional benchmark run ledger: strict_bridge_anchor_mismatch');
  }
  if (ledger.runtime.strict_bridge_anchor_ready
    !== Boolean(ledger.runtime.strict_bridge_realpath && ledger.runtime.strict_bridge_sha256)) {
    throw new Error('Invalid professional benchmark run ledger: strict_bridge_readiness_mismatch');
  }
  const transitionIds = ledger.transitions.map(item => item.transition_id);
  if (new Set(transitionIds).size !== transitionIds.length
    || ledger.transitions[0]?.from !== null
    || ledger.transitions[0]?.to !== 'prepared') {
    throw new Error('Invalid professional benchmark run ledger: transition_chain_invalid');
  }
  for (let index = 1; index < ledger.transitions.length; index += 1) {
    const previous = ledger.transitions[index - 1];
    const current = ledger.transitions[index];
    if (current.from !== previous.to || !ALLOWED_TRANSITIONS[previous.to].includes(current.to)) {
      throw new Error('Invalid professional benchmark run ledger: transition_chain_invalid');
    }
  }
  if (ledger.transitions.at(-1)?.to !== ledger.status) {
    throw new Error('Invalid professional benchmark run ledger: status_transition_mismatch');
  }
  return ledger;
}

function artifactByteLength(value: unknown): number {
  return Buffer.byteLength(stableJson(value), 'utf8');
}

function registryFor(items: ProfessionalBenchmarkRunArtifact[]): ProfessionalBenchmarkArtifactRegistry {
  const copied = items.map(item => ({ ...item }));
  return {
    schema_version: 'professional-benchmark-artifact-registry/v1',
    artifact_count: copied.length,
    registry_sha256: hashProfessionalBenchmarkArtifact(copied),
    items: copied,
  };
}

function registerArtifact(
  ledger: ProfessionalBenchmarkRunLedger,
  input: {
    kind: ProfessionalBenchmarkArtifactKind;
    logical_path: string;
    value: unknown;
    registered_at: string;
  },
): ProfessionalBenchmarkRunLedger {
  const artifact: ProfessionalBenchmarkRunArtifact = {
    artifact_id: `${ledger.run_id}:${input.kind}:${ledger.artifact_registry.items.length + 1}`,
    kind: input.kind,
    logical_path: input.logical_path,
    sha256: hashProfessionalBenchmarkArtifact(input.value),
    byte_length: artifactByteLength(input.value),
    registered_at: input.registered_at,
  };
  return sealProfessionalBenchmarkRunLedger({
    ...ledger,
    updated_at: input.registered_at,
    artifact_registry: registryFor([...ledger.artifact_registry.items, artifact]),
  });
}

function transitionRun(
  ledger: ProfessionalBenchmarkRunLedger,
  to: ProfessionalBenchmarkRunStatus,
  reason: string,
  occurredAt: string,
): ProfessionalBenchmarkRunLedger {
  if (!ALLOWED_TRANSITIONS[ledger.status].includes(to)) {
    throw new Error(`Illegal professional benchmark run transition: ${ledger.status} -> ${to}`);
  }
  return sealProfessionalBenchmarkRunLedger({
    ...ledger,
    status: to,
    updated_at: occurredAt,
    transitions: [
      ...ledger.transitions,
      {
        transition_id: `${ledger.run_id}--transition-${ledger.transitions.length + 1}`,
        from: ledger.status,
        to,
        occurred_at: occurredAt,
        reason,
      },
    ],
  });
}

function packageFromManifest(
  manifest: CharacterStoryBenchmarkExecutionManifest,
  benchmarkId: string,
): CharacterStoryBenchmarkExecutionPackage {
  const schemaVersion = (manifest as { schema_version?: string }).schema_version;
  if (schemaVersion === 'character-story-professional-benchmark-execution-manifest/v1') {
    throw new Error('legacy_generic_readiness_manifest_read_only_rebuild_v2');
  }
  if (schemaVersion !== 'character-story-professional-benchmark-execution-manifest/v2') {
    throw new Error('Unsupported professional benchmark execution manifest');
  }
  const executionPackage = manifest.packages.find(item => item.benchmark_id === benchmarkId);
  if (!executionPackage) throw new Error(`Unknown professional benchmark: ${benchmarkId}`);
  if (executionPackage.schema_version !== 'character-story-professional-benchmark-execution-package/v2'
    || executionPackage.status !== 'source_package_ready') {
    throw new Error(`Unsupported professional benchmark execution package: ${benchmarkId}`);
  }
  return executionPackage;
}

function assertPromptPackageMatchesExecution(input: {
  executionPackage: CharacterStoryBenchmarkExecutionPackage;
  promptPackage: CharacterStoryProfessionalBenchmarkPromptPackage;
}): void {
  const { executionPackage, promptPackage } = input;
  const canonicalPromptPackage = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
  const mismatches = [
    promptPackage.schema_version === 'character-story-professional-benchmark-prompt/v2'
      ? ''
      : 'prompt_package_schema_version_mismatch',
    promptPackage.benchmark_id === executionPackage.benchmark_id ? '' : 'prompt_benchmark_id_mismatch',
    promptPackage.video_type === executionPackage.video_type ? '' : 'prompt_video_type_mismatch',
    promptPackage.benchmark_prompt_version === executionPackage.execution_contract.benchmark_prompt_version
      ? ''
      : 'prompt_benchmark_version_mismatch',
    promptPackage.story_generation_prompt_version === executionPackage.execution_contract.story_generation_prompt_version
      ? ''
      : 'prompt_story_version_mismatch',
    promptPackage.story_generation_prompt.prompt_version === executionPackage.execution_contract.story_generation_prompt_version
      ? ''
      : 'story_prompt_version_mismatch',
    promptPackage.source_snapshot_sha256 === executionPackage.source_snapshot.snapshot_sha256
      ? ''
      : 'prompt_source_snapshot_mismatch',
    promptPackage.prompt_sha256 === canonicalPromptPackage.prompt_sha256
      ? ''
      : 'prompt_package_sha256_mismatch',
    stableJson(promptPackage) === stableJson(canonicalPromptPackage)
      ? ''
      : 'prompt_package_not_canonical',
  ].filter(Boolean);
  if (mismatches.length > 0) {
    throw new Error(`Professional benchmark prompt package mismatch: ${mismatches.join(',')}`);
  }
}

function initialAuthorizationBlockers(input: {
  strictTechnicalReady: boolean;
  strictBridgeAnchorReady: boolean;
  sourcePackageReady: boolean;
  authorization: ProfessionalBenchmarkRunAuthorization;
}): string[] {
  return [
    input.strictTechnicalReady ? '' : 'strict_technical_readiness_missing',
    input.strictBridgeAnchorReady ? '' : 'strict_bridge_anchor_not_ready',
    input.sourcePackageReady ? '' : 'source_package_not_ready',
    input.authorization.credential_status === 'verified' ? '' : 'credentials_not_verified',
    input.authorization.budget_authorized ? '' : 'budget_not_authorized',
    input.authorization.runtime_activated ? '' : 'runtime_not_activated',
    input.authorization.authorization_reference?.trim() ? '' : 'authorization_reference_missing',
    input.authorization.budget_cap
      && Number.isFinite(input.authorization.budget_cap.amount)
      && input.authorization.budget_cap.amount > 0
      ? ''
      : 'budget_cap_invalid',
    input.authorization.budget_cap
      && /^[A-Z]{3}$/.test(input.authorization.budget_cap.currency)
      ? ''
      : 'budget_currency_invalid',
    input.authorization.approved_cli_realpath
      && path.isAbsolute(input.authorization.approved_cli_realpath)
      ? ''
      : 'approved_cli_realpath_missing',
    input.authorization.approved_cli_sha256
      && /^[a-f0-9]{64}$/.test(input.authorization.approved_cli_sha256)
      ? ''
      : 'approved_cli_sha256_missing',
  ].filter(Boolean);
}

export function prepareProfessionalBenchmarkRun(input: {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  prompt_package: CharacterStoryProfessionalBenchmarkPromptPackage;
  benchmark_id: string;
  run_id?: string;
  now?: string;
}): ProfessionalBenchmarkRunLedger {
  const now = input.now ?? new Date().toISOString();
  const runId = input.run_id ?? `professional-benchmark-run-${randomUUID()}`;
  const executionPackage = packageFromManifest(input.manifest, input.benchmark_id);
  assertPromptPackageMatchesExecution({
    executionPackage,
    promptPackage: input.prompt_package,
  });
  const modelRuntime = executionPackage.execution_contract.model_runtime;
  if (modelRuntime !== 'claude' && modelRuntime !== 'codex') {
    throw new Error(`Unsupported professional benchmark runtime: ${modelRuntime}`);
  }
  const manifestBridgeRealpath = input.manifest.strict_readiness.strict_bridge_realpath;
  const manifestBridgeSha256 = input.manifest.strict_readiness.strict_bridge_sha256;
  const strictBridgeAnchorReady = input.manifest.strict_readiness.strict_bridge_readable
    && Boolean(manifestBridgeRealpath && path.isAbsolute(manifestBridgeRealpath))
    && Boolean(manifestBridgeSha256 && /^[a-f0-9]{64}$/.test(manifestBridgeSha256));
  const runtime = {
    strict_technical_ready: input.manifest.strict_readiness.technical_ready,
    strict_bridge_anchor_ready: strictBridgeAnchorReady,
    strict_bridge_realpath: strictBridgeAnchorReady ? manifestBridgeRealpath : null,
    strict_bridge_sha256: strictBridgeAnchorReady ? manifestBridgeSha256 : null,
    source_package_ready: executionPackage.status === 'source_package_ready',
  };
  const authorization: ProfessionalBenchmarkRunAuthorization = {
    credential_status: 'unverified',
    budget_authorized: false,
    runtime_activated: false,
  };
  const authorizationBlockers = initialAuthorizationBlockers({
    strictTechnicalReady: runtime.strict_technical_ready,
    strictBridgeAnchorReady: runtime.strict_bridge_anchor_ready,
    sourcePackageReady: runtime.source_package_ready,
    authorization,
  });
  const packageHash = hashProfessionalBenchmarkArtifact(executionPackage);
  const promptPackageHash = hashProfessionalBenchmarkArtifact(input.prompt_package);
  const storyPromptHash = hashProfessionalBenchmarkArtifact(input.prompt_package.story_generation_prompt);
  const prepared = sealProfessionalBenchmarkRunLedger({
    schema_version: 'professional-benchmark-run-ledger/v3',
    run_id: runId,
    benchmark_id: executionPackage.benchmark_id,
    video_type: 'character_story',
    status: 'prepared',
    created_at: now,
    updated_at: now,
    execution_package_sha256: packageHash,
    prompt_package_sha256: promptPackageHash,
    story_prompt_sha256: storyPromptHash,
    expected_provenance: {
      execution_kind: executionPackage.execution_contract.execution_kind,
      provider: `${modelRuntime}_cli`,
      runtime: modelRuntime,
      model_profile_id: executionPackage.execution_contract.model_profile_id,
      requested_model_id: executionPackage.execution_contract.model_id,
      benchmark_prompt_version: executionPackage.execution_contract.benchmark_prompt_version,
      story_prompt_version: executionPackage.execution_contract.story_generation_prompt_version,
      story_prompt_sha256: storyPromptHash,
      source_snapshot_sha256: executionPackage.source_snapshot.snapshot_sha256,
      strict_bridge_realpath: runtime.strict_bridge_realpath,
      strict_bridge_sha256: runtime.strict_bridge_sha256,
      cli_realpath: null,
      cli_sha256: null,
      operator_authorization: null,
    },
    runtime,
    authorization: {
      ...authorization,
      blockers: authorizationBlockers,
    },
    provenance: {
      status: 'pending',
      blockers: [],
    },
    usage: {
      status: 'not_reported',
      input_tokens: null,
      output_tokens: null,
      cached_input_tokens: null,
      cost_amount: null,
      cost_currency: null,
    },
    artifact_registry: registryFor([]),
    transitions: [{
      transition_id: `${runId}--transition-1`,
      from: null,
      to: 'prepared',
      occurred_at: now,
      reason: 'execution_and_prompt_packages_frozen',
    }],
    blockers: authorizationBlockers,
    credit_eligible: false,
    professional_passed: false,
  });
  const withExecutionPackage = registerArtifact(prepared, {
    kind: 'execution_package',
    logical_path: `runs/${runId}/execution-package.json`,
    value: executionPackage,
    registered_at: now,
  });
  return registerArtifact(withExecutionPackage, {
    kind: 'prompt_package',
    logical_path: `runs/${runId}/professional-benchmark-prompt-package.json`,
    value: input.prompt_package,
    registered_at: now,
  });
}

export function authorizeProfessionalBenchmarkRun(input: {
  ledger: ProfessionalBenchmarkRunLedger;
  authorization: ProfessionalBenchmarkRunAuthorization;
  now?: string;
}): ProfessionalBenchmarkRunLedger {
  const now = input.now ?? new Date().toISOString();
  const ledger = assertProfessionalBenchmarkRunLedger(input.ledger);
  const parsedAuthorization = RunAuthorizationInputSchema.safeParse(input.authorization);
  if (!parsedAuthorization.success) {
    throw new Error(`Invalid professional benchmark authorization: ${parsedAuthorization.error.issues
      .map(issue => `${issue.path.join('.')}:${issue.code}`)
      .join(',')}`);
  }
  const authorization = parsedAuthorization.data as ProfessionalBenchmarkRunAuthorization;
  if (ledger.status !== 'prepared') {
    throw new Error(`Professional benchmark run cannot be authorized from ${ledger.status}`);
  }
  const blockers = initialAuthorizationBlockers({
    strictTechnicalReady: ledger.runtime.strict_technical_ready,
    strictBridgeAnchorReady: ledger.runtime.strict_bridge_anchor_ready,
    sourcePackageReady: ledger.runtime.source_package_ready,
    authorization,
  });
  const next = sealProfessionalBenchmarkRunLedger({
    ...ledger,
    updated_at: now,
    expected_provenance: {
      ...ledger.expected_provenance,
      cli_realpath: authorization.approved_cli_realpath ?? null,
      cli_sha256: authorization.approved_cli_sha256 ?? null,
      operator_authorization: authorization.authorization_reference && authorization.budget_cap
        ? {
            reference_sha256: hashAuthorizationReference(authorization.authorization_reference),
            budget_cap: { ...authorization.budget_cap },
          }
        : null,
    },
    authorization: {
      ...authorization,
      blockers,
    },
    blockers,
    credit_eligible: false,
    professional_passed: false,
  });
  return blockers.length === 0
    ? transitionRun(next, 'authorization_ready', 'credentials_budget_and_runtime_authorized', now)
    : next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function reportedModelMatchesRequested(reported: string | null, requested: string): boolean {
  if (!reported?.trim()) return false;
  const normalizedReported = reported.trim().toLowerCase();
  const normalizedRequested = requested.trim().toLowerCase();
  if (normalizedReported === normalizedRequested) return true;
  const allowedClaudeAliasPatterns: Record<string, RegExp> = {
    opus: /^claude-opus-\d+(?:-\d+)*$/,
    sonnet: /^claude-sonnet-\d+(?:-\d+)*$/,
    haiku: /^claude-haiku-\d+(?:-\d+)*$/,
  };
  return allowedClaudeAliasPatterns[normalizedRequested]?.test(normalizedReported) ?? false;
}

export function validateProfessionalBenchmarkAdapterEnvelope(input: {
  ledger: ProfessionalBenchmarkRunLedger;
  envelope: ProfessionalBenchmarkAdapterEnvelope;
}): { valid: boolean; blockers: string[] } {
  const ledger = assertProfessionalBenchmarkRunLedger(input.ledger);
  const { envelope } = input;
  const provenance = envelope.provenance;
  const story = isRecord(envelope.story) ? envelope.story : undefined;
  const characterEvidence = isRecord(envelope.character_evidence)
    ? envelope.character_evidence
    : undefined;
  const usage = isRecord(provenance.usage) ? provenance.usage : undefined;
  const cost = isRecord(provenance.cost) ? provenance.cost : undefined;
  const budgetCap = ledger.authorization.budget_cap;
  const blockers = [
    envelope.schema_version === 'professional-character-benchmark-bridge-output/v2'
      ? ''
      : 'bridge_envelope_schema_version_mismatch',
    envelope.run_id === ledger.run_id ? '' : 'run_id_mismatch',
    envelope.benchmark_id === ledger.benchmark_id ? '' : 'benchmark_id_mismatch',
    provenance.execution_kind === ledger.expected_provenance.execution_kind ? '' : 'execution_kind_not_real_model',
    provenance.generation_mode === 'external_model' ? '' : 'generation_mode_not_external_model',
    provenance.runtime === ledger.expected_provenance.runtime ? '' : 'runtime_mismatch',
    provenance.runtime === 'claude' || provenance.runtime === 'codex' ? '' : 'runtime_not_external_cli',
    provenance.provider === ledger.expected_provenance.provider ? '' : 'provider_mismatch',
    provenance.provider === `${provenance.runtime}_cli` ? '' : 'provider_runtime_mismatch',
    /local|fixture|simulation/i.test(provenance.provider) ? 'provider_not_external' : '',
    provenance.used_fallback === false ? '' : 'fallback_output_not_allowed',
    provenance.model_profile_id === ledger.expected_provenance.model_profile_id ? '' : 'model_profile_mismatch',
    provenance.requested_model_id === ledger.expected_provenance.requested_model_id
      ? ''
      : 'requested_model_id_mismatch',
    reportedModelMatchesRequested(
      provenance.reported_model_id,
      ledger.expected_provenance.requested_model_id,
    ) ? '' : 'reported_model_id_mismatch',
    provenance.benchmark_prompt_version === ledger.expected_provenance.benchmark_prompt_version
      ? ''
      : 'benchmark_prompt_version_mismatch',
    provenance.story_prompt_version === ledger.expected_provenance.story_prompt_version
      ? ''
      : 'story_prompt_version_mismatch',
    provenance.prompt_sha256 === ledger.expected_provenance.story_prompt_sha256
      ? ''
      : 'story_prompt_sha256_mismatch',
    provenance.source_snapshot_sha256 === ledger.expected_provenance.source_snapshot_sha256
      ? ''
      : 'source_snapshot_mismatch',
    provenance.cli_realpath === ledger.expected_provenance.cli_realpath
      ? ''
      : 'cli_realpath_mismatch',
    provenance.cli_sha256 === ledger.expected_provenance.cli_sha256
      ? ''
      : 'cli_sha256_mismatch',
    provenance.operator_authorization.reference_sha256
      === ledger.expected_provenance.operator_authorization?.reference_sha256
      ? ''
      : 'operator_authorization_reference_mismatch',
    provenance.operator_authorization.budget_cap.amount
      === ledger.expected_provenance.operator_authorization?.budget_cap.amount
      && provenance.operator_authorization.budget_cap.currency
        === ledger.expected_provenance.operator_authorization?.budget_cap.currency
      ? ''
      : 'operator_budget_cap_mismatch',
    provenance.provenance_complete === true ? '' : 'provenance_incomplete',
    provenance.incomplete_reasons.length === 0 ? '' : 'provenance_incomplete_reasons_present',
    story ? '' : 'initial_story_missing',
    characterEvidence ? '' : 'character_evidence_missing',
    story && provenance.story_sha256 === hashProfessionalBenchmarkArtifact(story)
      ? ''
      : 'story_sha256_mismatch',
    characterEvidence
      && provenance.character_evidence_sha256 === hashProfessionalBenchmarkArtifact(characterEvidence)
      ? ''
      : 'character_evidence_sha256_mismatch',
    usage ? '' : 'provider_usage_missing',
    cost ? '' : 'provider_cost_missing',
    usage?.source === 'provider_reported' ? '' : 'provider_usage_not_reported',
    cost?.source === 'provider_reported' ? '' : 'provider_cost_not_reported',
    usage
      && typeof usage.input_tokens === 'number'
      && Number.isFinite(usage.input_tokens)
      && usage.input_tokens >= 0
      && typeof usage.output_tokens === 'number'
      && Number.isFinite(usage.output_tokens)
      && usage.output_tokens > 0
      ? ''
      : 'provider_usage_invalid',
    cost
      && typeof cost.amount === 'number'
      && Number.isFinite(cost.amount)
      && cost.amount >= 0
      && typeof cost.currency === 'string'
      && /^[A-Z]{3}$/.test(cost.currency)
      ? ''
      : 'provider_cost_invalid',
    cost && budgetCap && cost.currency === budgetCap.currency ? '' : 'budget_currency_mismatch',
    cost && budgetCap && typeof cost.amount === 'number' && cost.amount <= budgetCap.amount
      ? ''
      : 'budget_cap_exceeded',
    provenance.exit_code === 0 ? '' : 'bridge_exit_code_not_zero',
    provenance.cli_version?.trim() ? '' : 'cli_version_missing',
    isSha256(provenance.provider_response_sha256) ? '' : 'provider_response_sha256_invalid',
  ].filter(Boolean);
  return { valid: blockers.length === 0, blockers: [...new Set(blockers)] };
}

function usageFromEnvelope(
  ledger: ProfessionalBenchmarkRunLedger,
  envelope: ProfessionalBenchmarkAdapterEnvelope,
  now: string,
): ProfessionalBenchmarkRunLedger {
  const usage = envelope.provenance.usage;
  const cost = envelope.provenance.cost;
  if (!usage || !cost) return ledger;
  const next = registerArtifact(ledger, {
    kind: 'model_usage_and_cost',
    logical_path: `runs/${ledger.run_id}/model-usage-and-cost.json`,
    value: {
      usage,
      cost,
      provider_response_sha256: envelope.provenance.provider_response_sha256,
    },
    registered_at: now,
  });
  return sealProfessionalBenchmarkRunLedger({
    ...next,
    usage: {
      status: 'provider_reported',
      input_tokens: Number.isFinite(usage.input_tokens) ? usage.input_tokens : null,
      output_tokens: Number.isFinite(usage.output_tokens) ? usage.output_tokens : null,
      cached_input_tokens: Number.isFinite(usage.cache_read_input_tokens)
        ? usage.cache_read_input_tokens
        : null,
      cost_amount: Number.isFinite(cost.amount) ? cost.amount : null,
      cost_currency: cost.currency.trim() || null,
      provider_receipt_artifact_id: next.artifact_registry.items.find(
        item => item.kind === 'adapter_envelope',
      )?.artifact_id,
    },
  });
}

function executionAuthorizationBlockers(ledger: ProfessionalBenchmarkRunLedger): string[] {
  return initialAuthorizationBlockers({
    strictTechnicalReady: ledger.runtime.strict_technical_ready,
    strictBridgeAnchorReady: ledger.runtime.strict_bridge_anchor_ready,
    sourcePackageReady: ledger.runtime.source_package_ready,
    authorization: ledger.authorization,
  });
}

async function executeProfessionalBenchmarkInitialRunInternal(input: {
  ledger: ProfessionalBenchmarkRunLedger;
  execution_package: CharacterStoryBenchmarkExecutionPackage;
  prompt_package: CharacterStoryProfessionalBenchmarkPromptPackage;
  adapter: ProfessionalBenchmarkAdapterImplementation;
  now?: string;
}): Promise<ProfessionalBenchmarkRunLedger> {
  const now = input.now ?? new Date().toISOString();
  const ledger = assertProfessionalBenchmarkRunLedger(input.ledger);
  const authorizationBlockers = executionAuthorizationBlockers(ledger);
  if (ledger.status !== 'authorization_ready' || authorizationBlockers.length > 0) {
    return sealProfessionalBenchmarkRunLedger({
      ...ledger,
      updated_at: now,
      blockers: [...new Set([
        ...ledger.blockers,
        ...authorizationBlockers,
        'run_not_authorized',
      ])],
      credit_eligible: false,
      professional_passed: false,
    });
  }
  if (hashProfessionalBenchmarkArtifact(input.execution_package) !== ledger.execution_package_sha256) {
    const rejected = transitionRun(
      ledger,
      'provenance_rejected',
      'execution_package_hash_mismatch',
      now,
    );
    return sealProfessionalBenchmarkRunLedger({
      ...rejected,
      provenance: {
        status: 'rejected',
        blockers: ['execution_package_hash_mismatch'],
      },
      blockers: ['execution_package_hash_mismatch'],
      credit_eligible: false,
      professional_passed: false,
    });
  }
  const promptPackageHash = hashProfessionalBenchmarkArtifact(input.prompt_package);
  const storyPromptHash = hashProfessionalBenchmarkArtifact(input.prompt_package.story_generation_prompt);
  let promptPackageIsCanonical = true;
  try {
    assertPromptPackageMatchesExecution({
      executionPackage: input.execution_package,
      promptPackage: input.prompt_package,
    });
  } catch {
    promptPackageIsCanonical = false;
  }
  if (promptPackageHash !== ledger.prompt_package_sha256
    || storyPromptHash !== ledger.story_prompt_sha256
    || !promptPackageIsCanonical) {
    const blockers = [
      promptPackageHash === ledger.prompt_package_sha256 ? '' : 'prompt_package_hash_mismatch',
      storyPromptHash === ledger.story_prompt_sha256 ? '' : 'story_prompt_hash_mismatch',
      promptPackageIsCanonical ? '' : 'prompt_package_not_canonical',
    ].filter(Boolean);
    const rejected = transitionRun(
      ledger,
      'provenance_rejected',
      'frozen_prompt_hash_mismatch',
      now,
    );
    return sealProfessionalBenchmarkRunLedger({
      ...rejected,
      provenance: {
        status: 'rejected',
        blockers,
      },
      blockers,
      credit_eligible: false,
      professional_passed: false,
    });
  }

  let envelope: ProfessionalBenchmarkAdapterEnvelope;
  try {
    envelope = await input.adapter({
      run_id: ledger.run_id,
      benchmark_id: ledger.benchmark_id,
      execution_package: input.execution_package,
      prompt_package: input.prompt_package,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = transitionRun(ledger, 'execution_failed', 'adapter_execution_failed', now);
    return sealProfessionalBenchmarkRunLedger({
      ...failed,
      blockers: [`adapter_execution_failed:${message}`],
      credit_eligible: false,
      professional_passed: false,
    });
  }

  let next = registerArtifact(ledger, {
    kind: 'adapter_envelope',
    logical_path: `runs/${ledger.run_id}/adapter-envelope.json`,
    value: envelope,
    registered_at: now,
  });
  const validation = validateProfessionalBenchmarkAdapterEnvelope({ ledger: next, envelope });
  const envelopeProvenance = envelope.provenance;
  const observed = {
    execution_kind: envelopeProvenance.execution_kind,
    generation_mode: envelopeProvenance.generation_mode,
    provider: envelopeProvenance.provider,
    used_fallback: envelopeProvenance.used_fallback,
    runtime: envelopeProvenance.runtime,
    model_profile_id: envelopeProvenance.model_profile_id,
    requested_model_id: envelopeProvenance.requested_model_id,
    reported_model_id: envelopeProvenance.reported_model_id,
    prompt_sha256: envelopeProvenance.prompt_sha256,
    source_snapshot_sha256: envelopeProvenance.source_snapshot_sha256,
    cli_realpath: envelopeProvenance.cli_realpath,
    cli_sha256: envelopeProvenance.cli_sha256,
    operator_authorization_reference_sha256:
      envelopeProvenance.operator_authorization.reference_sha256,
    operator_budget_cap_amount:
      envelopeProvenance.operator_authorization.budget_cap.amount,
    operator_budget_cap_currency:
      envelopeProvenance.operator_authorization.budget_cap.currency,
    provenance_complete: envelopeProvenance.provenance_complete,
  };
  if (!validation.valid) {
    const rejected = transitionRun(next, 'provenance_rejected', 'adapter_provenance_rejected', now);
    return sealProfessionalBenchmarkRunLedger({
      ...rejected,
      provenance: {
        status: 'rejected',
        blockers: validation.blockers,
        observed,
      },
      blockers: validation.blockers,
      credit_eligible: false,
      professional_passed: false,
    });
  }

  next = usageFromEnvelope(next, envelope, now);
  next = registerArtifact(next, {
    kind: 'initial_story',
    logical_path: `runs/${ledger.run_id}/initial-story.json`,
    value: envelope.story,
    registered_at: now,
  });
  next = registerArtifact(next, {
    kind: 'character_evidence',
    logical_path: `runs/${ledger.run_id}/character-evidence.json`,
    value: envelope.character_evidence,
    registered_at: now,
  });
  next = transitionRun(next, 'initial_generated', 'external_model_initial_story_verified', now);
  next = {
    ...next,
    provenance: {
      status: 'verified_initial_external',
      blockers: [],
      observed,
    },
    blockers: [],
  };
  next = transitionRun(next, 'professional_evidence_pending', 'professional_and_human_evidence_required', now);
  return sealProfessionalBenchmarkRunLedger({
    ...next,
    blockers: [
      'initial_professional_package_missing',
      'revision_trace_missing',
      'final_professional_package_missing',
      'human_blind_review_missing',
    ],
    credit_eligible: false,
    professional_passed: false,
  });
}

/**
 * Deterministic adapter injection for state-machine tests only. Production code
 * must call executeProfessionalBenchmarkInitialRunWithStrictBridge instead.
 */
export async function executeProfessionalBenchmarkInitialRun(input: {
  ledger: ProfessionalBenchmarkRunLedger;
  execution_package: CharacterStoryBenchmarkExecutionPackage;
  prompt_package: CharacterStoryProfessionalBenchmarkPromptPackage;
  adapter: ProfessionalBenchmarkAdapter;
  now?: string;
}): Promise<ProfessionalBenchmarkRunLedger> {
  if (input.adapter[INTERNAL_TEST_ADAPTER_BRAND] !== true || process.env.NODE_ENV !== 'test') {
    throw new Error(
      'Arbitrary professional benchmark adapters are test-only; use the dedicated production bridge entry point',
    );
  }
  return executeProfessionalBenchmarkInitialRunInternal(input);
}

export interface ProfessionalBenchmarkStrictBridgeExecutionResult {
  ledger: ProfessionalBenchmarkRunLedger;
  envelope: ProfessionalBenchmarkBridgeEnvelope | null;
}

/**
 * The only production execution entry point. It fixes the dedicated bridge and
 * never accepts a caller-supplied adapter implementation.
 */
export async function executeProfessionalBenchmarkInitialRunWithStrictBridge(input: {
  ledger: ProfessionalBenchmarkRunLedger;
  execution_package: CharacterStoryBenchmarkExecutionPackage;
  prompt_package: CharacterStoryProfessionalBenchmarkPromptPackage;
  execute_authorized: boolean;
  paid_authorized: boolean;
  runtime_cli_paths: ProfessionalBenchmarkRuntimeCliPaths;
  timeout_ms?: number;
  now?: string;
}): Promise<ProfessionalBenchmarkStrictBridgeExecutionResult> {
  const ledger = assertProfessionalBenchmarkRunLedger(input.ledger);
  const runtime = ledger.expected_provenance.runtime;
  const configuredCliPath = input.runtime_cli_paths[runtime];
  if (!configuredCliPath
    || configuredCliPath !== ledger.authorization.approved_cli_realpath
    || configuredCliPath !== ledger.expected_provenance.cli_realpath) {
    throw new Error('Strict bridge CLI path does not match the authorized run ledger');
  }
  if (input.execute_authorized !== true || input.paid_authorized !== true) {
    throw new Error('Strict bridge execution requires explicit execute and paid authorization');
  }
  let capturedEnvelope: ProfessionalBenchmarkBridgeEnvelope | null = null;
  const nextLedger = await executeProfessionalBenchmarkInitialRunInternal({
    ledger,
    execution_package: input.execution_package,
    prompt_package: input.prompt_package,
    adapter: async adapterInput => {
      const envelope = await runProfessionalBenchmarkBridgeAdapter({
        run_id: adapterInput.run_id,
        execution_package: adapterInput.execution_package,
        benchmark_prompt: adapterInput.prompt_package.story_generation_prompt,
        execute_authorized: input.execute_authorized,
        paid_authorized: input.paid_authorized,
        expected_bridge_anchor: {
          realpath: ledger.expected_provenance.strict_bridge_realpath ?? '',
          sha256: ledger.expected_provenance.strict_bridge_sha256 ?? '',
        },
        runtime_cli_paths: input.runtime_cli_paths,
        timeout_ms: input.timeout_ms,
      });
      capturedEnvelope = envelope;
      return envelope;
    },
    now: input.now,
  });
  return {
    ledger: nextLedger,
    envelope: capturedEnvelope,
  };
}
