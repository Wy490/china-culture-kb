import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { StoryGenerationPromptPackage } from './story-generation-prompt.js';
import type { CharacterStoryBenchmarkExecutionPackage } from './professional-benchmark-service.js';

const BRIDGE_INPUT_SCHEMA_VERSION = 'professional-character-benchmark-bridge-input/v2';
const BRIDGE_OUTPUT_SCHEMA_VERSION = 'professional-character-benchmark-bridge-output/v2';
const BENCHMARK_PROMPT_VERSION = 'character-story-professional-benchmark/v2';
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dedicatedBridgePath = path.resolve(
  moduleDir,
  '..',
  '..',
  'scripts',
  'professional-character-benchmark-bridge.mjs',
);

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmptyStringSchema = z.string().trim().min(1);

const BridgeStorySceneSchema = z.object({
  scene_id: z.number().int().min(1),
  title: NonEmptyStringSchema,
  duration_sec: z.number().finite().positive(),
  location: NonEmptyStringSchema,
  time_of_day: NonEmptyStringSchema,
  dramatic_function: NonEmptyStringSchema,
  plot: NonEmptyStringSchema,
  key_action: NonEmptyStringSchema,
  characters: z.array(NonEmptyStringSchema).min(1),
  visual_prompt: NonEmptyStringSchema,
  camera_suggestion: NonEmptyStringSchema,
  cultural_note: NonEmptyStringSchema,
  conflict: NonEmptyStringSchema,
  dialogue_or_narration: NonEmptyStringSchema,
  source_entries: z.array(NonEmptyStringSchema).min(1),
  factual_basis: NonEmptyStringSchema,
  fictionalized_elements: z.array(NonEmptyStringSchema).min(1),
}).strict();

const BridgeStorySchema = z.object({
  title: NonEmptyStringSchema,
  logline: NonEmptyStringSchema,
  theme: NonEmptyStringSchema,
  full_text: z.string().min(50),
  scene_breakdown: z.array(BridgeStorySceneSchema).min(1),
  cultural_constraints: z.array(NonEmptyStringSchema),
  credibility_note: NonEmptyStringSchema,
}).strict();

const CharacterEvidenceSchema = z.object({
  protagonist: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  resistance: z.string().trim().min(1),
  choice: z.string().trim().min(1),
  cost: z.string().trim().min(1),
  starting_relationship_state: z.string().trim().min(1),
  ending_relationship_state: z.string().trim().min(1),
  internal_change: z.string().trim().min(1),
  dialogue_voice_rules: z.array(z.string().trim().min(1)).min(2),
  subtext_strategy: z.string().trim().min(1),
  scene_turns: z.record(z.string(), z.string().trim().min(1)),
}).strict().refine(
  evidence => evidence.starting_relationship_state !== evidence.ending_relationship_state,
  { message: 'relationship states must differ' },
);

const ProviderUsageSchema = z.object({
  input_tokens: z.number().nonnegative(),
  output_tokens: z.number().nonnegative(),
  cache_read_input_tokens: z.number().nonnegative(),
  cache_creation_input_tokens: z.number().nonnegative(),
  source: z.literal('provider_reported'),
}).strict();

const ProviderCostSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().min(1),
  source: z.literal('provider_reported'),
}).strict();

const StrictBridgeEnvelopeSchema = z.object({
  schema_version: z.literal(BRIDGE_OUTPUT_SCHEMA_VERSION),
  run_id: z.string().min(1),
  benchmark_id: z.string().min(1),
  story: BridgeStorySchema,
  character_evidence: CharacterEvidenceSchema,
  provenance: z.object({
    execution_kind: z.literal('real_model'),
    generation_mode: z.literal('external_model'),
    provider: z.enum(['claude_cli', 'codex_cli']),
    used_fallback: z.literal(false),
    runtime: z.enum(['claude', 'codex']),
    model_profile_id: z.string().min(1),
    requested_model_id: z.string().min(1),
    reported_model_id: z.string().min(1).nullable(),
    benchmark_prompt_version: z.string().min(1),
    story_prompt_version: z.string().min(1),
    prompt_sha256: Sha256Schema,
    source_snapshot_sha256: Sha256Schema,
    cli_realpath: z.string().min(1),
    cli_sha256: Sha256Schema,
    cli_version: z.string().min(1).nullable(),
    operator_authorization: z.object({
      reference_sha256: Sha256Schema,
      budget_cap: z.object({
        amount: z.number().positive(),
        currency: z.string().trim().min(1),
      }).strict(),
    }).strict(),
    started_at: z.string().datetime(),
    finished_at: z.string().datetime(),
    duration_ms: z.number().nonnegative(),
    exit_code: z.literal(0),
    usage: ProviderUsageSchema.nullable(),
    cost: ProviderCostSchema.nullable(),
    provider_response_sha256: Sha256Schema,
    story_sha256: Sha256Schema,
    character_evidence_sha256: Sha256Schema,
    provenance_complete: z.boolean(),
    incomplete_reasons: z.array(z.string()),
  }).strict(),
}).strict();

export type ProfessionalBenchmarkBridgeEnvelope = z.infer<typeof StrictBridgeEnvelopeSchema>;

export interface ProfessionalBenchmarkRuntimeCliPaths {
  claude?: string;
  codex?: string;
}

export interface ProfessionalBenchmarkBridgeAdapterInput {
  run_id: string;
  execution_package: CharacterStoryBenchmarkExecutionPackage;
  benchmark_prompt: StoryGenerationPromptPackage;
  execute_authorized: boolean;
  paid_authorized: boolean;
  expected_bridge_anchor: {
    realpath: string;
    sha256: string;
  };
  runtime_cli_paths: ProfessionalBenchmarkRuntimeCliPaths;
  timeout_ms?: number;
}

export interface ProfessionalBenchmarkBridgeEnvelopeExpectation {
  run_id: string;
  benchmark_id: string;
  runtime: 'claude' | 'codex';
  model_profile_id: string;
  requested_model_id: string;
  benchmark_prompt_version: string;
  story_prompt_version: string;
  prompt_sha256: string;
  source_snapshot_sha256: string;
  cli_realpath: string;
  cli_sha256: string;
  authorization_reference_sha256: string;
  budget_cap: {
    amount: number;
    currency: string;
  };
}

export class ProfessionalBenchmarkBridgeAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfessionalBenchmarkBridgeAdapterError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new ProfessionalBenchmarkBridgeAdapterError('Benchmark prompt contains a non-JSON value');
  }
  return encoded;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function jsonRoundTrip<T>(value: T, label: string): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch (error) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `${label} must be JSON serializable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertSafeId(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ProfessionalBenchmarkBridgeAdapterError(`${field} is required`);
  if (/fixture|simulation/i.test(normalized)) {
    throw new ProfessionalBenchmarkBridgeAdapterError(`${field} cannot identify fixture or simulation data`);
  }
  return normalized;
}

function assertExecutionPackage(
  executionPackage: CharacterStoryBenchmarkExecutionPackage,
  prompt: StoryGenerationPromptPackage,
): 'claude' | 'codex' {
  if (executionPackage.schema_version !== 'character-story-professional-benchmark-execution-package/v2') {
    throw new ProfessionalBenchmarkBridgeAdapterError('Unsupported execution package schema');
  }
  if (executionPackage.video_type !== 'character_story') {
    throw new ProfessionalBenchmarkBridgeAdapterError('Bridge adapter only accepts character_story packages');
  }
  assertSafeId(executionPackage.benchmark_id, 'execution_package.benchmark_id');
  const contract = executionPackage.execution_contract;
  if (contract.execution_kind !== 'real_model'
    || contract.fallback_allowed_for_benchmark_credit !== false
    || contract.fixture_allowed_for_benchmark_credit !== false) {
    throw new ProfessionalBenchmarkBridgeAdapterError('Execution package is not strict real-model only');
  }
  if (contract.benchmark_prompt_version !== BENCHMARK_PROMPT_VERSION) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `Unsupported benchmark prompt version: ${contract.benchmark_prompt_version}`,
    );
  }
  if (contract.model_runtime !== 'claude' && contract.model_runtime !== 'codex') {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `Unsupported benchmark runtime: ${contract.model_runtime}`,
    );
  }
  if (prompt.prompt_version !== contract.story_generation_prompt_version) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `Prompt version mismatch: package=${prompt.prompt_version}, expected=${contract.story_generation_prompt_version}`,
    );
  }
  if (!/^[a-f0-9]{64}$/.test(executionPackage.source_snapshot.snapshot_sha256)) {
    throw new ProfessionalBenchmarkBridgeAdapterError('Execution package source snapshot hash is invalid');
  }
  return contract.model_runtime;
}

async function resolveExecutable(filePath: string | undefined, label: string): Promise<string> {
  if (!filePath?.trim()) throw new ProfessionalBenchmarkBridgeAdapterError(`${label} is required`);
  if (!path.isAbsolute(filePath)) {
    throw new ProfessionalBenchmarkBridgeAdapterError(`${label} must be an absolute path`);
  }
  try {
    const resolved = await realpath(filePath);
    await access(resolved, constants.X_OK);
    return resolved;
  } catch (error) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `${label} is not an executable file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

interface VerifiedFileTrustAnchor {
  realpath: string;
  sha256: string;
}

interface OperatorAuthorization {
  reference_sha256: string;
  budget_cap: {
    amount: number;
    currency: string;
  };
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readOperatorAuthorization(): OperatorAuthorization {
  if (process.env.PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED !== '1'
    || process.env.PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED !== '1'
    || process.env.PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED !== '1') {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      'Independent operator authorization and verified credentials are required',
    );
  }
  const reference = process.env.PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE?.trim();
  if (!reference) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      'PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE is required',
    );
  }
  const amount = Number(process.env.PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      'PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP must be a positive number',
    );
  }
  const currency = process.env.PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY?.trim().toUpperCase();
  if (!currency) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      'PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY is required',
    );
  }
  return {
    reference_sha256: sha256Text(reference),
    budget_cap: { amount, currency },
  };
}

async function resolveTrustedExecutable(
  filePath: string | undefined,
  runtime: 'claude' | 'codex',
): Promise<VerifiedFileTrustAnchor> {
  const label = `${runtime} CLI path`;
  const resolved = await resolveExecutable(filePath, label);
  const approvedPathKey = runtime === 'claude'
    ? 'PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_PATH'
    : 'PROFESSIONAL_BENCHMARK_APPROVED_CODEX_CLI_PATH';
  const approvedShaKey = runtime === 'claude'
    ? 'PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_SHA256'
    : 'PROFESSIONAL_BENCHMARK_APPROVED_CODEX_CLI_SHA256';
  const approvedPath = process.env[approvedPathKey]?.trim();
  if (!approvedPath || !path.isAbsolute(approvedPath)) {
    throw new ProfessionalBenchmarkBridgeAdapterError(`${approvedPathKey} must be an absolute path`);
  }
  const approvedRealpath = await resolveExecutable(approvedPath, approvedPathKey);
  if (resolved !== approvedRealpath) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `${runtime} CLI path does not match the operator-approved realpath`,
    );
  }
  const approvedSha256 = process.env[approvedShaKey]?.trim();
  if (!approvedSha256 || !/^[a-f0-9]{64}$/.test(approvedSha256)) {
    throw new ProfessionalBenchmarkBridgeAdapterError(`${approvedShaKey} must be a lowercase SHA-256 value`);
  }
  const actualSha256 = createHash('sha256').update(await readFile(resolved)).digest('hex');
  if (actualSha256 !== approvedSha256) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `${runtime} CLI SHA-256 does not match the operator-approved trust anchor`,
    );
  }
  return { realpath: resolved, sha256: actualSha256 };
}

async function resolveDedicatedBridge(
  expected: ProfessionalBenchmarkBridgeAdapterInput['expected_bridge_anchor'],
): Promise<VerifiedFileTrustAnchor> {
  if (!path.isAbsolute(dedicatedBridgePath)) {
    throw new ProfessionalBenchmarkBridgeAdapterError('Dedicated benchmark bridge path must be absolute');
  }
  if (!path.isAbsolute(expected.realpath)) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      'Expected dedicated benchmark bridge realpath must be absolute',
    );
  }
  if (!/^[a-f0-9]{64}$/.test(expected.sha256)) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      'Expected dedicated benchmark bridge SHA-256 must be a lowercase SHA-256 value',
    );
  }
  try {
    const resolved = await realpath(dedicatedBridgePath);
    await access(resolved, constants.R_OK);
    if (resolved !== expected.realpath) {
      throw new ProfessionalBenchmarkBridgeAdapterError(
        'Dedicated benchmark bridge realpath does not match the frozen run ledger anchor',
      );
    }
    const actualSha256 = createHash('sha256').update(await readFile(resolved)).digest('hex');
    if (actualSha256 !== expected.sha256) {
      throw new ProfessionalBenchmarkBridgeAdapterError(
        'Dedicated benchmark bridge SHA-256 does not match the frozen run ledger anchor',
      );
    }
    return { realpath: resolved, sha256: actualSha256 };
  } catch (error) {
    if (error instanceof ProfessionalBenchmarkBridgeAdapterError) throw error;
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `Dedicated benchmark bridge is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function adapterTimeoutMs(raw: number | undefined): number {
  const timeoutMs = raw ?? 340000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 910000) {
    throw new ProfessionalBenchmarkBridgeAdapterError('timeout_ms must be an integer from 1000 to 910000');
  }
  return timeoutMs;
}

function modelMatchesExpected(reported: string | null, expected: string): boolean {
  if (!reported) return true;
  const normalizedReported = reported.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();
  if (normalizedReported === normalizedExpected) return true;
  const controlledAliases: Partial<Record<string, RegExp>> = {
    opus: /^claude-opus-\d+(?:-\d+)*$/,
    sonnet: /^claude-sonnet-\d+(?:-\d+)*$/,
    haiku: /^claude-haiku-\d+(?:-\d+)*$/,
  };
  return controlledAliases[normalizedExpected]?.test(normalizedReported) ?? false;
}

function assertContiguousSceneIds(envelope: ProfessionalBenchmarkBridgeEnvelope): void {
  const seen = new Set<number>();
  envelope.story.scene_breakdown.forEach((scene, index) => {
    if (seen.has(scene.scene_id)) {
      throw new ProfessionalBenchmarkBridgeAdapterError(`Strict bridge returned duplicate scene_id: ${scene.scene_id}`);
    }
    seen.add(scene.scene_id);
    if (scene.scene_id !== index + 1) {
      throw new ProfessionalBenchmarkBridgeAdapterError(
        `Strict bridge returned non-contiguous scene_id: expected ${index + 1}, got ${scene.scene_id}`,
      );
    }
  });
  const expectedSceneTurnIds = envelope.story.scene_breakdown.map(scene => String(scene.scene_id));
  const actualSceneTurnIds = Object.keys(envelope.character_evidence.scene_turns)
    .sort((left, right) => Number(left) - Number(right));
  if (canonicalJson(actualSceneTurnIds) !== canonicalJson(expectedSceneTurnIds)) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      'Strict bridge character_evidence.scene_turns must cover every returned story scene exactly once',
    );
  }
}

export function parseProfessionalBenchmarkBridgeEnvelope(
  raw: string,
  expected: ProfessionalBenchmarkBridgeEnvelopeExpectation,
): ProfessionalBenchmarkBridgeEnvelope {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw.trim());
  } catch (error) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `Strict benchmark bridge returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = StrictBridgeEnvelopeSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `Strict benchmark bridge returned an invalid v2 envelope: ${parsed.error.issues
        .slice(0, 8)
        .map(issue => `${issue.path.join('.')}:${issue.message}`)
        .join('; ')}`,
    );
  }
  const envelope = parsed.data;
  assertContiguousSceneIds(envelope);
  const provenance = envelope.provenance;
  const mismatches = [
    envelope.run_id === expected.run_id ? '' : 'run_id_mismatch',
    envelope.benchmark_id === expected.benchmark_id ? '' : 'benchmark_id_mismatch',
    provenance.runtime === expected.runtime ? '' : 'runtime_mismatch',
    provenance.provider === `${expected.runtime}_cli` ? '' : 'provider_mismatch',
    provenance.model_profile_id === expected.model_profile_id ? '' : 'model_profile_mismatch',
    provenance.requested_model_id === expected.requested_model_id ? '' : 'requested_model_mismatch',
    modelMatchesExpected(provenance.reported_model_id, expected.requested_model_id)
      ? ''
      : 'reported_model_mismatch',
    provenance.benchmark_prompt_version === expected.benchmark_prompt_version
      ? ''
      : 'benchmark_prompt_version_mismatch',
    provenance.story_prompt_version === expected.story_prompt_version
      ? ''
      : 'story_prompt_version_mismatch',
    provenance.prompt_sha256 === expected.prompt_sha256 ? '' : 'prompt_sha256_mismatch',
    provenance.source_snapshot_sha256 === expected.source_snapshot_sha256
      ? ''
      : 'source_snapshot_sha256_mismatch',
    provenance.cli_realpath === expected.cli_realpath ? '' : 'cli_realpath_mismatch',
    provenance.cli_sha256 === expected.cli_sha256 ? '' : 'cli_sha256_mismatch',
    provenance.operator_authorization.reference_sha256 === expected.authorization_reference_sha256
      ? ''
      : 'operator_authorization_reference_mismatch',
    provenance.operator_authorization.budget_cap.amount === expected.budget_cap.amount
      && provenance.operator_authorization.budget_cap.currency.toUpperCase()
        === expected.budget_cap.currency.toUpperCase()
      ? ''
      : 'operator_budget_cap_mismatch',
    provenance.story_sha256 === sha256(envelope.story) ? '' : 'story_sha256_mismatch',
    provenance.character_evidence_sha256 === sha256(envelope.character_evidence)
      ? ''
      : 'character_evidence_sha256_mismatch',
    provenance.provenance_complete
      && (!provenance.reported_model_id || !provenance.cli_version || !provenance.usage || !provenance.cost)
      ? 'false_complete_provenance_claim'
      : '',
  ].filter(Boolean);
  if (mismatches.length > 0) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      `Strict benchmark bridge provenance mismatch: ${mismatches.join(',')}`,
    );
  }
  return envelope;
}

function spawnDedicatedBridge(input: {
  bridge_path: string;
  cli_realpath: string;
  cli_sha256: string;
  runtime: 'claude' | 'codex';
  operator_authorization: OperatorAuthorization;
  payload: unknown;
  timeout_ms: number;
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const bridgeTimeoutMs = Math.min(900000, Math.max(1000, input.timeout_ms - 5000));
    const child = spawn(process.execPath, [input.bridge_path], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        PROFESSIONAL_BENCHMARK_EXECUTE: '1',
        PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED:
          process.env.PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED,
        PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED:
          process.env.PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED,
        PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED:
          process.env.PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED,
        PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE:
          process.env.PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE,
        PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP: String(
          input.operator_authorization.budget_cap.amount,
        ),
        PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY:
          input.operator_authorization.budget_cap.currency,
        PROFESSIONAL_BENCHMARK_TIMEOUT_MS: String(bridgeTimeoutMs),
        PROFESSIONAL_BENCHMARK_CLAUDE_PATH: input.runtime === 'claude' ? input.cli_realpath : '',
        PROFESSIONAL_BENCHMARK_CLAUDE_SHA256: input.runtime === 'claude' ? input.cli_sha256 : '',
        PROFESSIONAL_BENCHMARK_CODEX_PATH: input.runtime === 'codex' ? input.cli_realpath : '',
        PROFESSIONAL_BENCHMARK_CODEX_SHA256: input.runtime === 'codex' ? input.cli_sha256 : '',
        PROFESSIONAL_BENCHMARK_CLAUDE_ARGS: '',
        PROFESSIONAL_BENCHMARK_CODEX_ARGS: '',
      },
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill('SIGTERM');
      finishError(new ProfessionalBenchmarkBridgeAdapterError(
        `Strict benchmark bridge timed out after ${input.timeout_ms}ms`,
      ));
    }, input.timeout_ms);
    const append = (current: string, chunk: Buffer | string, stream: string): string => {
      const next = current + String(chunk);
      if (Buffer.byteLength(next) > MAX_CAPTURE_BYTES) {
        child.kill('SIGTERM');
        finishError(new ProfessionalBenchmarkBridgeAdapterError(
          `Strict benchmark bridge ${stream} exceeded the maximum size`,
        ));
      }
      return next;
    };
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk, 'stdout'); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk, 'stderr'); });
    child.on('error', error => finishError(new ProfessionalBenchmarkBridgeAdapterError(
      `Strict benchmark bridge failed to start: ${error.message}`,
    )));
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new ProfessionalBenchmarkBridgeAdapterError(
          `Strict benchmark bridge exited with code ${code ?? 'null'}${signal ? ` signal ${signal}` : ''}`
          + `${stderr.trim() ? `: ${stderr.trim().slice(0, 1000)}` : ''}`,
        ));
        return;
      }
      resolvePromise({ stdout, stderr });
    });
    child.stdin.on('error', error => finishError(new ProfessionalBenchmarkBridgeAdapterError(
      `Strict benchmark bridge stdin failed: ${error.message}`,
    )));
    child.stdin.end(JSON.stringify(input.payload));
  });
}

export async function runProfessionalBenchmarkBridgeAdapter(
  input: ProfessionalBenchmarkBridgeAdapterInput,
): Promise<ProfessionalBenchmarkBridgeEnvelope> {
  if (input.execute_authorized !== true || input.paid_authorized !== true) {
    throw new ProfessionalBenchmarkBridgeAdapterError(
      'Benchmark bridge execution requires execute_authorized=true and paid_authorized=true',
    );
  }
  const operatorAuthorization = readOperatorAuthorization();
  const runId = assertSafeId(input.run_id, 'run_id');
  const prompt = jsonRoundTrip(input.benchmark_prompt, 'benchmark_prompt');
  const runtime = assertExecutionPackage(input.execution_package, prompt);
  const timeoutMs = adapterTimeoutMs(input.timeout_ms);
  if (!path.isAbsolute(process.execPath)) {
    throw new ProfessionalBenchmarkBridgeAdapterError('process.execPath must be an absolute path');
  }
  await access(process.execPath, constants.X_OK);
  const bridgeAnchor = await resolveDedicatedBridge(input.expected_bridge_anchor);
  const cliAnchor = await resolveTrustedExecutable(input.runtime_cli_paths[runtime], runtime);
  const cliRealpath = cliAnchor.realpath;
  const contract = input.execution_package.execution_contract;
  const payload = {
    schema_version: BRIDGE_INPUT_SCHEMA_VERSION,
    run_id: runId,
    benchmark_id: input.execution_package.benchmark_id,
    prompt_package: prompt,
    source_snapshot_sha256: input.execution_package.source_snapshot.snapshot_sha256,
    execution_contract: {
      execution_kind: 'real_model',
      benchmark_prompt_version: contract.benchmark_prompt_version,
      story_generation_prompt_version: contract.story_generation_prompt_version,
      model_profile_id: contract.model_profile_id,
      model_runtime: runtime,
      model_id: contract.model_id,
    },
  };
  const result = await spawnDedicatedBridge({
    bridge_path: bridgeAnchor.realpath,
    cli_realpath: cliRealpath,
    cli_sha256: cliAnchor.sha256,
    runtime,
    operator_authorization: operatorAuthorization,
    payload,
    timeout_ms: timeoutMs,
  });
  return parseProfessionalBenchmarkBridgeEnvelope(result.stdout, {
    run_id: runId,
    benchmark_id: input.execution_package.benchmark_id,
    runtime,
    model_profile_id: contract.model_profile_id,
    requested_model_id: contract.model_id,
    benchmark_prompt_version: contract.benchmark_prompt_version,
    story_prompt_version: contract.story_generation_prompt_version,
    prompt_sha256: sha256(prompt),
    source_snapshot_sha256: input.execution_package.source_snapshot.snapshot_sha256,
    cli_realpath: cliRealpath,
    cli_sha256: cliAnchor.sha256,
    authorization_reference_sha256: operatorAuthorization.reference_sha256,
    budget_cap: operatorAuthorization.budget_cap,
  });
}
