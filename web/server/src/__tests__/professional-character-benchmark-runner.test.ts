import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CharacterStoryBenchmarkExecutionManifest } from '../services/professional-benchmark-service.js';
import {
  hashProfessionalBenchmarkArtifact,
  type ProfessionalBenchmarkAdapterEnvelope,
} from '../services/professional-benchmark-run-service.js';
import {
  buildPersistedProviderReceiptPayload,
  buildControlledCharacterBenchmarkPlan,
  inspectControlledExecutionGates,
  parseControlledRunnerArgs,
  remainingControlledBatchBudget,
  validateControlledCharacterBenchmarkPlan,
} from '../../../../scripts/story-agent-character-benchmark-runner.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const storedManifest = JSON.parse(fs.readFileSync(path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-execution-manifest.json',
), 'utf8')) as CharacterStoryBenchmarkExecutionManifest;
const NOW = '2026-07-11T09:00:00.000Z';
let testManifest: CharacterStoryBenchmarkExecutionManifest;
let temporaryCliRoot = '';

beforeAll(async () => {
  temporaryCliRoot = await mkdtemp(path.join(os.tmpdir(), 'controlled-benchmark-runner-'));
  const cliPath = path.join(temporaryCliRoot, 'claude');
  const cliBody = '#!/bin/sh\nexit 99\n';
  await writeFile(cliPath, cliBody, 'utf8');
  await chmod(cliPath, 0o755);
  const cliRealpath = await realpath(cliPath);
  testManifest = structuredClone(storedManifest);
  testManifest.strict_readiness.selected_model_cli_manifest_path = cliPath;
  testManifest.strict_readiness.selected_model_cli_realpath = cliRealpath;
  testManifest.strict_readiness.selected_model_cli_sha256 = createHash('sha256').update(cliBody).digest('hex');
  testManifest.strict_readiness.selected_model_cli_executable = true;
  const strictBridgePath = path.join(
    repoRoot,
    'web',
    'server',
    'scripts',
    'professional-character-benchmark-bridge.mjs',
  );
  const strictBridgeRealpath = await realpath(strictBridgePath);
  testManifest.strict_readiness.strict_bridge_manifest_path = strictBridgePath;
  testManifest.strict_readiness.strict_bridge_realpath = strictBridgeRealpath;
  testManifest.strict_readiness.strict_bridge_sha256 = createHash('sha256')
    .update(await fs.promises.readFile(strictBridgeRealpath))
    .digest('hex');
  testManifest.strict_readiness.strict_bridge_readable = true;
  testManifest.strict_readiness.technical_ready = true;
  testManifest.strict_readiness.blockers = [];
  testManifest.summary.strict_cli_anchor_ready_count = testManifest.packages.length;
  testManifest.summary.strict_technical_ready_count = testManifest.packages.length;
});

afterAll(async () => {
  if (temporaryCliRoot) await rm(temporaryCliRoot, { recursive: true, force: true });
});

function readyManifest(): CharacterStoryBenchmarkExecutionManifest {
  return structuredClone(testManifest);
}

function authorizedOperatorEnv(plan: Awaited<ReturnType<typeof buildControlledCharacterBenchmarkPlan>>): NodeJS.ProcessEnv {
  const runtime = plan.runtime_anchor.model_runtime;
  if (!runtime || !plan.runtime_anchor.selected_cli_realpath || !plan.runtime_anchor.selected_cli_sha256) {
    throw new Error('Test runtime anchor unavailable');
  }
  const prefix = runtime === 'codex' ? 'CODEX' : 'CLAUDE';
  return {
    PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED: '1',
    PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED: '1',
    PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED: '1',
    PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE: 'operator-approval-001',
    PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP: '25',
    PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY: 'USD',
    [`PROFESSIONAL_BENCHMARK_APPROVED_${prefix}_CLI_PATH`]: plan.runtime_anchor.selected_cli_realpath,
    [`PROFESSIONAL_BENCHMARK_APPROVED_${prefix}_CLI_SHA256`]: plan.runtime_anchor.selected_cli_sha256,
  };
}

describe('controlled character_story benchmark runner', () => {
  it('builds five prompt ledgers with strict technical readiness and a zero-credit plan', async () => {
    const plan = await buildControlledCharacterBenchmarkPlan({
      manifest: testManifest,
      now: NOW,
    });

    expect(validateControlledCharacterBenchmarkPlan(plan)).toEqual({ valid: true, blockers: [] });
    expect(plan.summary).toMatchObject({
      fixed_project_spec_count: 5,
      professional_prompt_ready_count: 5,
      prepared_run_ledger_count: 5,
      strict_technical_ready_count: 5,
      blocked_run_count: 5,
      model_invocation_count: 0,
      real_model_completed_count: 0,
      fixed_real_model_project_count: 0,
      fixed_real_model_project_pass_count: 0,
      human_blind_review_pass_count: 0,
      professional_pass_count: 0,
      fixture_or_simulation_credit_count: 0,
    });
    expect(plan.runtime_anchor).toMatchObject({
      model_runtime: 'claude',
      selected_cli_executable: true,
      strict_bridge_readable: true,
    });
    expect(plan.runtime_anchor.selected_cli_realpath).toMatch(/^\//);
    expect(plan.runtime_anchor.selected_cli_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.runtime_anchor.strict_bridge_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.runs).toHaveLength(5);
    expect(plan.runs.every(run =>
      run.ledger_status === 'prepared'
      && run.execution_state === 'blocked'
      && run.blockers.includes('operator_paid_execution_authorization_missing')
      && run.real_model_completed === false
      && run.professional_passed === false
      && /^[a-f0-9]{64}$/.test(run.professional_prompt_sha256)
      && /^[a-f0-9]{64}$/.test(run.prompt_package_sha256)
    )).toBe(true);
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toContain('"system_prompt"');
    expect(serialized).not.toContain('"user_prompt"');
    expect(serialized).not.toContain('"story_generation_prompt"');
  });

  it('produces stable hashes and run ids for the same manifest and timestamp', async () => {
    const left = await buildControlledCharacterBenchmarkPlan({ manifest: testManifest, now: NOW });
    const right = await buildControlledCharacterBenchmarkPlan({ manifest: testManifest, now: NOW });

    expect(right.integrity_sha256).toBe(left.integrity_sha256);
    expect(right.runs.map(run => run.run_id)).toEqual(left.runs.map(run => run.run_id));
    expect(new Set(left.runs.map(run => run.run_id)).size).toBe(5);
  });

  it('rejects tampered credit and integrity claims', async () => {
    const plan = await buildControlledCharacterBenchmarkPlan({ manifest: testManifest, now: NOW });
    const tampered = structuredClone(plan);
    tampered.summary.professional_pass_count = 1 as 0;
    tampered.runs[0].professional_passed = true as false;

    expect(validateControlledCharacterBenchmarkPlan(tampered)).toMatchObject({
      valid: false,
      blockers: expect.arrayContaining([
        'integrity_sha256_mismatch',
        'unsupported_run_credit',
        'professional_pass_count_not_zero',
      ]),
    });
  });

  it('rejects legacy controlled plans as read-only migration input', async () => {
    const plan = await buildControlledCharacterBenchmarkPlan({ manifest: testManifest, now: NOW });
    const legacy = { ...plan, schema_version: 'character-story-controlled-benchmark-run-plan/v1' };

    expect(validateControlledCharacterBenchmarkPlan(legacy)).toEqual({
      valid: false,
      blockers: ['legacy_controlled_plan_read_only_rebuild_v2'],
    });
  });

  it('defaults to plan mode and exposes no CLI authorization, command, path, or extra-arg override', () => {
    expect(parseControlledRunnerArgs([])).toEqual({ mode: 'plan' });
    expect(parseControlledRunnerArgs(['--plan'])).toEqual({ mode: 'plan' });
    expect(parseControlledRunnerArgs(['--write'])).toEqual({ mode: 'write' });
    expect(parseControlledRunnerArgs(['--check'])).toEqual({ mode: 'check' });
    expect(parseControlledRunnerArgs(['--execute', '--timeout-ms', '120000'])).toEqual({
      mode: 'execute',
      timeout_ms: 120000,
    });
    for (const args of [
      ['--execute', '--paid-authorized'],
      ['--execute', '--authorization-reference', 'self-approved'],
      ['--execute', '--budget-cap', '25'],
      ['--execute', '--runtime-cli-realpath', '/tmp/arbitrary'],
      ['--execute', '--command', '/tmp/arbitrary'],
      ['--execute', '--extra-args', '["--dangerous"]'],
    ]) {
      expect(() => parseControlledRunnerArgs(args)).toThrow('Unsupported runner argument');
    }
    expect(() => parseControlledRunnerArgs(['--plan', '--execute'])).toThrow('mutually exclusive');
    expect(() => parseControlledRunnerArgs(['--timeout-ms', '1000'])).toThrow(
      'only valid with --execute',
    );
  });

  it('requires paid authorization, credentials, approval reference, budget, and CLI anchors from operator env', async () => {
    const manifest = readyManifest();
    const plan = await buildControlledCharacterBenchmarkPlan({ manifest, now: NOW });
    const gate = await inspectControlledExecutionGates({
      manifest,
      plan,
      options: { mode: 'execute' },
      operator_env: {},
    });

    expect(gate.ready).toBe(false);
    expect(gate.blockers).toEqual(expect.arrayContaining([
      'operator_execution_authorization_missing',
      'operator_paid_execution_authorization_missing',
      'operator_credentials_not_verified',
      'operator_authorization_reference_missing',
      'operator_positive_batch_budget_missing',
      'operator_budget_currency_invalid',
      'operator_approved_cli_path_mismatch',
      'operator_approved_cli_sha256_mismatch',
    ]));
  });

  it('rejects an operator-approved CLI hash that differs from the frozen plan anchor', async () => {
    const manifest = readyManifest();
    const plan = await buildControlledCharacterBenchmarkPlan({ manifest, now: NOW });
    const env = authorizedOperatorEnv(plan);
    const shaKey = plan.runtime_anchor.model_runtime === 'codex'
      ? 'PROFESSIONAL_BENCHMARK_APPROVED_CODEX_CLI_SHA256'
      : 'PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_SHA256';
    env[shaKey] = '0'.repeat(64);

    const gate = await inspectControlledExecutionGates({
      manifest,
      plan,
      options: { mode: 'execute' },
      operator_env: env,
    });

    expect(gate.ready).toBe(false);
    expect(gate.blockers).toContain('operator_approved_cli_sha256_mismatch');
  });

  it('recognizes every independent operator gate without invoking the fixed bridge', async () => {
    const manifest = readyManifest();
    const plan = await buildControlledCharacterBenchmarkPlan({ manifest, now: NOW });
    const env = authorizedOperatorEnv(plan);

    const gate = await inspectControlledExecutionGates({
      manifest,
      plan,
      options: { mode: 'execute' },
      operator_env: env,
    });

    expect(gate).toMatchObject({
      ready: true,
      runtime: 'claude',
      cli_realpath: plan.runtime_anchor.selected_cli_realpath,
      cli_sha256: plan.runtime_anchor.selected_cli_sha256,
      authorization_reference: 'operator-approval-001',
      budget_cap_amount: 25,
      budget_currency: 'USD',
      blockers: [],
    });
  });

  it('authorizes each paid run only for the unspent remainder of the batch cap', () => {
    expect(remainingControlledBatchBudget({ batch_cap: 25, spent: 0 })).toBe(25);
    expect(remainingControlledBatchBudget({ batch_cap: 25, spent: 7.5 })).toBe(17.5);
    expect(remainingControlledBatchBudget({ batch_cap: 25, spent: 25 })).toBe(0);
    expect(remainingControlledBatchBudget({ batch_cap: 25, spent: 30 })).toBe(0);
    expect(() => remainingControlledBatchBudget({ batch_cap: 0, spent: 0 }))
      .toThrow('positive finite');
    expect(() => remainingControlledBatchBudget({ batch_cap: 25, spent: -1 }))
      .toThrow('non-negative finite');
  });

  it('binds the durable provider receipt to the full bridge envelope and both model outputs', () => {
    const story = { title: '外部初稿' };
    const characterEvidence = { protagonist: '人物' };
    const envelope = {
      schema_version: 'professional-character-benchmark-bridge-output/v2',
      run_id: 'run-receipt-binding',
      benchmark_id: 'character-benchmark-receipt-binding',
      story,
      character_evidence: characterEvidence,
      provenance: {
        provider: 'claude_cli',
        runtime: 'claude',
        requested_model_id: 'opus',
        reported_model_id: 'claude-opus-4-1-20250805',
        prompt_sha256: '1'.repeat(64),
        provider_response_sha256: '2'.repeat(64),
        story_sha256: hashProfessionalBenchmarkArtifact(story),
        character_evidence_sha256: hashProfessionalBenchmarkArtifact(characterEvidence),
        used_fallback: false,
        provenance_complete: true,
        exit_code: 0,
        started_at: NOW,
        finished_at: NOW,
        cli_realpath: '/trusted/claude',
        cli_sha256: '3'.repeat(64),
        cli_version: 'claude-test',
        operator_authorization: {
          reference_sha256: '4'.repeat(64),
          budget_cap: { amount: 25, currency: 'USD' },
        },
      },
    } as unknown as ProfessionalBenchmarkAdapterEnvelope;

    expect(buildPersistedProviderReceiptPayload({
      benchmark_id: envelope.benchmark_id,
      run_id: envelope.run_id,
      envelope,
    })).toMatchObject({
      bridge_envelope_sha256: hashProfessionalBenchmarkArtifact(envelope),
      story_sha256: hashProfessionalBenchmarkArtifact(story),
      character_evidence_sha256: hashProfessionalBenchmarkArtifact(characterEvidence),
    });
  });

  it('rejects a re-sealed plan when a frozen prompt hash no longer matches the canonical builder', async () => {
    const manifest = readyManifest();
    const plan = await buildControlledCharacterBenchmarkPlan({ manifest, now: NOW });
    const tampered = structuredClone(plan);
    tampered.runs[0].story_prompt_sha256 = '0'.repeat(64);
    const { integrity_sha256: _oldSeal, ...withoutSeal } = tampered;
    tampered.integrity_sha256 = hashProfessionalBenchmarkArtifact(withoutSeal);
    expect(validateControlledCharacterBenchmarkPlan(tampered).valid).toBe(true);

    const gate = await inspectControlledExecutionGates({
      manifest,
      plan: tampered,
      options: { mode: 'execute' },
      operator_env: authorizedOperatorEnv(plan),
    });

    expect(gate.ready).toBe(false);
    expect(gate.blockers).toContain('controlled_plan_not_current');
  });

  it('fails closed on a legacy generic-readiness manifest before any execution', async () => {
    const legacy = structuredClone(testManifest) as unknown as Record<string, unknown>;
    legacy.schema_version = 'character-story-professional-benchmark-execution-manifest/v1';

    await expect(buildControlledCharacterBenchmarkPlan({
      manifest: legacy as unknown as CharacterStoryBenchmarkExecutionManifest,
      now: NOW,
    })).rejects.toThrow('legacy_generic_readiness_manifest_read_only_rebuild_v2');
  });
});
