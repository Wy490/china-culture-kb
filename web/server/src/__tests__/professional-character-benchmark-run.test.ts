import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  CharacterStoryBenchmarkExecutionManifest,
  CharacterStoryBenchmarkExecutionPackage,
} from '../services/professional-benchmark-service.js';
import {
  buildCharacterStoryProfessionalBenchmarkPrompt,
  type CharacterStoryProfessionalBenchmarkPromptPackage,
} from '../services/professional-benchmark-prompt-service.js';
import {
  authorizeProfessionalBenchmarkRun,
  createInternalProfessionalBenchmarkTestAdapter,
  executeProfessionalBenchmarkInitialRun,
  executeProfessionalBenchmarkInitialRunWithStrictBridge,
  hashProfessionalBenchmarkArtifact,
  prepareProfessionalBenchmarkRun,
  validateProfessionalBenchmarkAdapterEnvelope,
  type ProfessionalBenchmarkAdapterImplementation,
  type ProfessionalBenchmarkAdapterEnvelope,
  type ProfessionalBenchmarkRunAuthorization,
  type ProfessionalBenchmarkRunLedger,
} from '../services/professional-benchmark-run-service.js';

const NOW = '2026-07-11T08:00:00.000Z';
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const storedManifest = JSON.parse(fs.readFileSync(path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-execution-manifest.json',
), 'utf8')) as CharacterStoryBenchmarkExecutionManifest;

interface RunFixture {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  executionPackage: CharacterStoryBenchmarkExecutionPackage;
  promptPackage: CharacterStoryProfessionalBenchmarkPromptPackage;
  ledger: ProfessionalBenchmarkRunLedger;
}

function runtimeReadyManifest(): CharacterStoryBenchmarkExecutionManifest {
  const manifest = structuredClone(storedManifest);
  const strictBridgePath = path.join(
    repoRoot,
    'web',
    'server',
    'scripts',
    'professional-character-benchmark-bridge.mjs',
  );
  const strictBridgeRealpath = fs.realpathSync(strictBridgePath);
  manifest.strict_readiness.strict_bridge_manifest_path = strictBridgePath;
  manifest.strict_readiness.strict_bridge_realpath = strictBridgeRealpath;
  manifest.strict_readiness.strict_bridge_sha256 = createHash('sha256')
    .update(fs.readFileSync(strictBridgeRealpath))
    .digest('hex');
  manifest.strict_readiness.strict_bridge_readable = true;
  return manifest;
}

function prepare(inputManifest = runtimeReadyManifest()): RunFixture {
  const executionPackage = inputManifest.packages[0];
  const promptPackage = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
  const ledger = prepareProfessionalBenchmarkRun({
    manifest: inputManifest,
    prompt_package: promptPackage,
    benchmark_id: executionPackage.benchmark_id,
    run_id: 'professional-run-001',
    now: NOW,
  });
  return { manifest: inputManifest, executionPackage, promptPackage, ledger };
}

const approvedAuthorization: ProfessionalBenchmarkRunAuthorization = {
  credential_status: 'verified',
  budget_authorized: true,
  runtime_activated: true,
  authorization_reference: 'approval-001',
  budget_cap: { amount: 10, currency: 'USD' },
  approved_cli_realpath: '/runtime/claude',
  approved_cli_sha256: 'c'.repeat(64),
};

function authorize(fixture: RunFixture): RunFixture {
  return {
    ...fixture,
    ledger: authorizeProfessionalBenchmarkRun({
      ledger: fixture.ledger,
      authorization: approvedAuthorization,
      now: NOW,
    }),
  };
}

function validStory(): Record<string, unknown> {
  return {
    title: '拒签之前',
    logline: '一纸判词逼迫周敦颐在官位与人命之间作出选择。',
    theme: '原则只有在付出代价时才成为人物行动。',
    full_text: '夜色压在案卷上。周敦颐发现关键证据不足，拒绝签署死刑判词。上官王逵当堂催逼，他没有继续辩解，而是取出告身放在案边，表示宁可辞官也不能让疑案成为定案。堂内从服从命令的程序，转为必须重新面对证据的选择。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '案卷疑点',
        plot: '周敦颐发现证据不足，停笔拒签。',
        key_action: '把蘸墨的笔搁回砚边',
      },
      {
        scene_id: 2,
        title: '堂前拒签',
        plot: '王逵当面催签，周敦颐取出告身承担辞官代价。',
        key_action: '将告身与未签判词并排放在案上',
      },
    ],
    cultural_constraints: ['对白为影视化创作，不作为史料原文。'],
    credibility_note: '中心事件遵守知识库边界，动作和对白属于合理戏剧化。',
  };
}

function validCharacterEvidence(): Record<string, unknown> {
  return {
    protagonist: '周敦颐',
    goal: '阻止证据不足的死刑判决生效',
    resistance: '上级王逵要求立即签署判词',
    choice: '拒签并交出告身准备辞官',
    cost: '失去官职并承担违逆上级的现实风险',
    starting_relationship_state: '王逵掌握命令权，周敦颐必须服从',
    ending_relationship_state: '王逵被迫正视周敦颐提出的证据疑点',
    internal_change: '从据理陈述走到以仕途为原则担保',
    dialogue_voice_rules: ['周敦颐克制而具体', '王逵短促并强调官阶'],
    subtext_strategy: '表面争的是签字程序，实际争的是官员是否敢为人命承担代价。',
    scene_turns: {
      '1': '从例行审卷转为确认存在冤判风险',
      '2': '从言语争辩转为不可撤回的辞官行动',
    },
  };
}

function validEnvelope(fixture: RunFixture): ProfessionalBenchmarkAdapterEnvelope {
  const story = validStory();
  const characterEvidence = validCharacterEvidence();
  const expected = fixture.ledger.expected_provenance;
  const reportedModelId = expected.runtime === 'claude'
    ? `claude-${expected.requested_model_id}-4-1-20250805`
    : expected.requested_model_id;
  return {
    schema_version: 'professional-character-benchmark-bridge-output/v2',
    run_id: fixture.ledger.run_id,
    benchmark_id: fixture.ledger.benchmark_id,
    story,
    character_evidence: characterEvidence,
    provenance: {
      execution_kind: 'real_model',
      generation_mode: 'external_model',
      provider: `${expected.runtime}_cli`,
      used_fallback: false,
      runtime: expected.runtime,
      model_profile_id: expected.model_profile_id,
      requested_model_id: expected.requested_model_id,
      reported_model_id: reportedModelId,
      benchmark_prompt_version: expected.benchmark_prompt_version,
      story_prompt_version: expected.story_prompt_version,
      prompt_sha256: hashProfessionalBenchmarkArtifact(
        fixture.promptPackage.story_generation_prompt,
      ),
      source_snapshot_sha256: expected.source_snapshot_sha256,
      cli_realpath: expected.cli_realpath ?? '',
      cli_sha256: expected.cli_sha256 ?? '',
      cli_version: 'fake-claude 1.2.3',
      operator_authorization: structuredClone(expected.operator_authorization ?? {
        reference_sha256: '',
        budget_cap: { amount: 0, currency: '' },
      }),
      started_at: NOW,
      finished_at: NOW,
      duration_ms: 0,
      exit_code: 0,
      usage: {
        input_tokens: 1400,
        output_tokens: 2300,
        cache_read_input_tokens: 120,
        cache_creation_input_tokens: 0,
        source: 'provider_reported',
      },
      cost: {
        amount: 1.75,
        currency: 'USD',
        source: 'provider_reported',
      },
      provider_response_sha256: 'b'.repeat(64),
      story_sha256: hashProfessionalBenchmarkArtifact(story),
      character_evidence_sha256: hashProfessionalBenchmarkArtifact(characterEvidence),
      provenance_complete: true,
      incomplete_reasons: [],
    },
  };
}

async function execute(
  fixture: RunFixture,
  adapter: ProfessionalBenchmarkAdapterImplementation,
): Promise<ProfessionalBenchmarkRunLedger> {
  return executeProfessionalBenchmarkInitialRun({
    ledger: fixture.ledger,
    execution_package: fixture.executionPackage,
    prompt_package: fixture.promptPackage,
    adapter: createInternalProfessionalBenchmarkTestAdapter(adapter),
    now: NOW,
  });
}

describe('professional character benchmark run state machine', () => {
  it('treats legacy generic-readiness manifests as read-only migration input', () => {
    const manifest = runtimeReadyManifest();
    const executionPackage = manifest.packages[0];
    const promptPackage = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
    const legacy = structuredClone(manifest) as unknown as Record<string, unknown>;
    legacy.schema_version = 'character-story-professional-benchmark-execution-manifest/v1';

    expect(() => prepareProfessionalBenchmarkRun({
      manifest: legacy as unknown as CharacterStoryBenchmarkExecutionManifest,
      prompt_package: promptPackage,
      benchmark_id: executionPackage.benchmark_id,
      run_id: 'legacy-manifest-run',
      now: NOW,
    })).toThrow('legacy_generic_readiness_manifest_read_only_rebuild_v2');
  });

  it('rejects a caller-authored prompt wrapper instead of trusting its embedded hash', () => {
    const manifest = runtimeReadyManifest();
    const executionPackage = manifest.packages[0];
    const promptPackage = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
    promptPackage.story_generation_prompt.user_prompt += '\n调用方伪造的基准指令';
    promptPackage.prompt_sha256 = 'a'.repeat(64);

    expect(() => prepareProfessionalBenchmarkRun({
      manifest,
      prompt_package: promptPackage,
      benchmark_id: executionPackage.benchmark_id,
      run_id: 'professional-run-forged-prompt',
      now: NOW,
    })).toThrow(/prompt_package_(sha256_mismatch|not_canonical)/);
  });

  it('rejects legacy v1 prompt packages before preparing a run', () => {
    const manifest = runtimeReadyManifest();
    const executionPackage = manifest.packages[0];
    const promptPackage = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
    (promptPackage as unknown as Record<string, unknown>).schema_version =
      'character-story-professional-benchmark-prompt/v1';

    expect(() => prepareProfessionalBenchmarkRun({
      manifest,
      prompt_package: promptPackage,
      benchmark_id: executionPackage.benchmark_id,
      run_id: 'professional-run-legacy-prompt-package',
      now: NOW,
    })).toThrow(/prompt_package_schema_version_mismatch/);
  });

  it('rejects legacy v1 bridge output envelopes during run provenance validation', () => {
    const fixture = authorize(prepare());
    const envelope = validEnvelope(fixture);
    (envelope as unknown as Record<string, unknown>).schema_version =
      'professional-character-benchmark-bridge-output/v1';

    expect(validateProfessionalBenchmarkAdapterEnvelope({
      ledger: fixture.ledger,
      envelope,
    }).blockers).toContain('bridge_envelope_schema_version_mismatch');
  });

  it.each([
    {
      label: 'authorization reference is missing',
      authorization: { ...approvedAuthorization, authorization_reference: undefined },
      blocker: 'authorization_reference_missing',
    },
    {
      label: 'budget cap is missing',
      authorization: { ...approvedAuthorization, budget_cap: undefined },
      blocker: 'budget_cap_invalid',
    },
  ])('keeps the run prepared when $label', ({ authorization, blocker }) => {
    const fixture = prepare();
    const result = authorizeProfessionalBenchmarkRun({
      ledger: fixture.ledger,
      authorization,
      now: NOW,
    });

    expect(result.status).toBe('prepared');
    expect(result.authorization.blockers).toContain(blocker);
    expect(result.credit_eligible).toBe(false);
    expect(result.professional_passed).toBe(false);
  });

  it('rejects malformed authorization values at the runtime boundary', () => {
    const fixture = prepare();
    expect(() => authorizeProfessionalBenchmarkRun({
      ledger: fixture.ledger,
      authorization: {
        ...approvedAuthorization,
        budget_cap: { amount: -1, currency: 'usd' },
      },
      now: NOW,
    })).toThrow('Invalid professional benchmark authorization');
  });

  it('rejects a mutated or pass-claim-injected ledger before any transition', () => {
    const fixture = prepare();
    const forged = {
      ...fixture.ledger,
      credit_eligible: true,
      professional_passed: true,
    } as unknown as ProfessionalBenchmarkRunLedger;

    expect(() => authorizeProfessionalBenchmarkRun({
      ledger: forged,
      authorization: approvedAuthorization,
      now: NOW,
    })).toThrow('Invalid professional benchmark run ledger');
  });

  it('freezes the manifest bridge trust anchor into both ledger provenance and runtime', () => {
    const fixture = prepare();
    const authorized = authorize(fixture);

    expect(fixture.ledger.schema_version).toBe('professional-benchmark-run-ledger/v3');
    expect(fixture.ledger.expected_provenance).toMatchObject({
      strict_bridge_realpath: fixture.manifest.strict_readiness.strict_bridge_realpath,
      strict_bridge_sha256: fixture.manifest.strict_readiness.strict_bridge_sha256,
    });
    expect(fixture.ledger.runtime).toMatchObject({
      strict_bridge_anchor_ready: true,
      strict_bridge_realpath: fixture.manifest.strict_readiness.strict_bridge_realpath,
      strict_bridge_sha256: fixture.manifest.strict_readiness.strict_bridge_sha256,
    });
    expect(authorized.ledger.expected_provenance.strict_bridge_realpath)
      .toBe(fixture.ledger.expected_provenance.strict_bridge_realpath);
    expect(authorized.ledger.expected_provenance.strict_bridge_sha256)
      .toBe(fixture.ledger.expected_provenance.strict_bridge_sha256);
    expect(authorized.ledger.runtime.strict_bridge_realpath)
      .toBe(fixture.ledger.runtime.strict_bridge_realpath);
    expect(authorized.ledger.runtime.strict_bridge_sha256)
      .toBe(fixture.ledger.runtime.strict_bridge_sha256);
  });

  it('fails closed on a legacy v2 run ledger before authorization can preserve stale anchors', () => {
    const fixture = prepare();
    const legacy = {
      ...fixture.ledger,
      schema_version: 'professional-benchmark-run-ledger/v2',
    } as unknown as ProfessionalBenchmarkRunLedger;

    expect(() => authorizeProfessionalBenchmarkRun({
      ledger: legacy,
      authorization: approvedAuthorization,
      now: NOW,
    })).toThrow('legacy_run_ledger_v2_read_only_reprepare_v3');
  });

  it('rejects an otherwise well-shaped ledger whose integrity seal is stale', () => {
    const fixture = prepare();
    const mutated = {
      ...fixture.ledger,
      blockers: [...fixture.ledger.blockers, 'out_of_band_mutation'],
    };

    expect(() => authorizeProfessionalBenchmarkRun({
      ledger: mutated,
      authorization: approvedAuthorization,
      now: NOW,
    })).toThrow('ledger_seal_mismatch');
  });

  it('rejects an unbranded injected adapter before it can execute', async () => {
    const fixture = authorize(prepare());
    const adapter = vi.fn(async () => validEnvelope(fixture));

    await expect(executeProfessionalBenchmarkInitialRun({
      ledger: fixture.ledger,
      execution_package: fixture.executionPackage,
      prompt_package: fixture.promptPackage,
      adapter: adapter as never,
      now: NOW,
    })).rejects.toThrow('Arbitrary professional benchmark adapters are test-only');
    expect(adapter).not.toHaveBeenCalled();
  });

  it('blocks the fixed production entry before spawn when CLI authorization differs', async () => {
    const fixture = authorize(prepare());

    await expect(executeProfessionalBenchmarkInitialRunWithStrictBridge({
      ledger: fixture.ledger,
      execution_package: fixture.executionPackage,
      prompt_package: fixture.promptPackage,
      execute_authorized: true,
      paid_authorized: true,
      runtime_cli_paths: { claude: '/runtime/not-authorized' },
      now: NOW,
    })).rejects.toThrow('CLI path does not match the authorized run ledger');
  });

  it('blocks the fixed production entry without both explicit execution flags', async () => {
    const fixture = authorize(prepare());

    await expect(executeProfessionalBenchmarkInitialRunWithStrictBridge({
      ledger: fixture.ledger,
      execution_package: fixture.executionPackage,
      prompt_package: fixture.promptPackage,
      execute_authorized: true,
      paid_authorized: false,
      runtime_cli_paths: { claude: '/runtime/claude' },
      now: NOW,
    })).rejects.toThrow('requires explicit execute and paid authorization');
  });

  it.each([
    {
      label: 'bridge content SHA is different from the frozen manifest anchor',
      mutate: (manifest: CharacterStoryBenchmarkExecutionManifest) => {
        manifest.strict_readiness.strict_bridge_sha256 = 'f'.repeat(64);
      },
      error: 'Dedicated benchmark bridge SHA-256 does not match the frozen run ledger anchor',
    },
    {
      label: 'bridge realpath is different from the fixed repository bridge',
      mutate: (manifest: CharacterStoryBenchmarkExecutionManifest) => {
        manifest.strict_readiness.strict_bridge_realpath = path.join(
          os.tmpdir(),
          'substituted-professional-character-benchmark-bridge.mjs',
        );
      },
      error: 'Dedicated benchmark bridge realpath does not match the frozen run ledger anchor',
    },
  ])('blocks the production entry before spawning a CLI when $label', async ({ mutate, error }) => {
    const manifest = runtimeReadyManifest();
    mutate(manifest);
    const fixture = prepare(manifest);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'professional-run-bridge-anchor-'));
    const cliPath = path.join(tempDir, 'fake-claude.mjs');
    const markerPath = path.join(tempDir, 'cli-spawned.marker');
    const cliSource = [
      '#!/usr/bin/env node',
      "import fs from 'node:fs';",
      `fs.writeFileSync(${JSON.stringify(markerPath)}, 'spawned');`,
      "process.stdout.write('{}');",
    ].join('\n');
    fs.writeFileSync(cliPath, `${cliSource}\n`, 'utf8');
    fs.chmodSync(cliPath, 0o755);
    const cliSha256 = createHash('sha256').update(fs.readFileSync(cliPath)).digest('hex');
    fixture.ledger = authorizeProfessionalBenchmarkRun({
      ledger: fixture.ledger,
      authorization: {
        ...approvedAuthorization,
        approved_cli_realpath: cliPath,
        approved_cli_sha256: cliSha256,
      },
      now: NOW,
    });
    vi.stubEnv('PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED', '1');
    vi.stubEnv('PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED', '1');
    vi.stubEnv('PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED', '1');
    vi.stubEnv('PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE', 'approval-001');
    vi.stubEnv('PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP', '10');
    vi.stubEnv('PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY', 'USD');
    vi.stubEnv('PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_PATH', cliPath);
    vi.stubEnv('PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_SHA256', cliSha256);

    try {
      const result = await executeProfessionalBenchmarkInitialRunWithStrictBridge({
        ledger: fixture.ledger,
        execution_package: fixture.executionPackage,
        prompt_package: fixture.promptPackage,
        execute_authorized: true,
        paid_authorized: true,
        runtime_cli_paths: { claude: cliPath },
        now: NOW,
      });

      expect(result.envelope).toBeNull();
      expect(result.ledger.status).toBe('execution_failed');
      expect(result.ledger.blockers).toContain(`adapter_execution_failed:${error}`);
      expect(result.ledger.expected_provenance.strict_bridge_realpath)
        .toBe(fixture.ledger.expected_provenance.strict_bridge_realpath);
      expect(result.ledger.expected_provenance.strict_bridge_sha256)
        .toBe(fixture.ledger.expected_provenance.strict_bridge_sha256);
      expect(fs.existsSync(markerPath)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each([
    {
      label: 'credentials are unverified',
      authorization: { ...approvedAuthorization, credential_status: 'unverified' as const },
      blocker: 'credentials_not_verified',
    },
    {
      label: 'budget is not authorized',
      authorization: { ...approvedAuthorization, budget_authorized: false },
      blocker: 'budget_not_authorized',
    },
    {
      label: 'runtime is not activated',
      authorization: { ...approvedAuthorization, runtime_activated: false },
      blocker: 'runtime_not_activated',
    },
  ])('does not invoke the injected adapter when $label', async ({ authorization, blocker }) => {
    const fixture = prepare();
    fixture.ledger = authorizeProfessionalBenchmarkRun({
      ledger: fixture.ledger,
      authorization,
      now: NOW,
    });
    const adapter = vi.fn(async () => validEnvelope(fixture));

    const result = await execute(fixture, adapter);

    expect(adapter).not.toHaveBeenCalled();
    expect(result.status).toBe('prepared');
    expect(result.authorization.blockers).toContain(blocker);
    expect(result.blockers).toContain('run_not_authorized');
    expect(result.credit_eligible).toBe(false);
    expect(result.professional_passed).toBe(false);
  });

  it('does not invoke the adapter when the manifest runtime remains inactive', async () => {
    const inactiveManifest = structuredClone(storedManifest);
    inactiveManifest.strict_readiness.technical_ready = false;
    inactiveManifest.strict_readiness.strict_bridge_readable = false;
    inactiveManifest.strict_readiness.strict_bridge_realpath = null;
    inactiveManifest.strict_readiness.strict_bridge_sha256 = null;
    inactiveManifest.strict_readiness.blockers = ['dedicated_strict_bridge_anchor_not_ready'];
    const fixture = prepare(inactiveManifest);
    fixture.ledger = authorizeProfessionalBenchmarkRun({
      ledger: fixture.ledger,
      authorization: approvedAuthorization,
      now: NOW,
    });
    const adapter = vi.fn(async () => validEnvelope(fixture));

    const result = await execute(fixture, adapter);

    expect(adapter).not.toHaveBeenCalled();
    expect(result.authorization.blockers).toEqual(expect.arrayContaining([
      'strict_technical_readiness_missing',
      'strict_bridge_anchor_not_ready',
    ]));
  });

  it('freezes the actual professional prompt and passes it to the injected adapter', async () => {
    const fixture = authorize(prepare());
    const adapter = vi.fn(async input => {
      expect(input.prompt_package).toEqual(fixture.promptPackage);
      expect(input.execution_package).toEqual(fixture.executionPackage);
      return validEnvelope(fixture);
    });

    const result = await execute(fixture, adapter);

    expect(adapter).toHaveBeenCalledOnce();
    expect(result.status).toBe('professional_evidence_pending');
    expect(result.credit_eligible).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.provenance.status).toBe('verified_initial_external');
    expect(result.transitions.map(item => item.to)).toEqual([
      'prepared',
      'authorization_ready',
      'initial_generated',
      'professional_evidence_pending',
    ]);
    expect(result.artifact_registry.items.map(item => item.kind)).toEqual([
      'execution_package',
      'prompt_package',
      'adapter_envelope',
      'model_usage_and_cost',
      'initial_story',
      'character_evidence',
    ]);
    expect(result.prompt_package_sha256).toBe(
      hashProfessionalBenchmarkArtifact(fixture.promptPackage),
    );
    expect(result.story_prompt_sha256).toBe(
      hashProfessionalBenchmarkArtifact(fixture.promptPackage.story_generation_prompt),
    );
    expect(result.usage).toMatchObject({
      status: 'provider_reported',
      input_tokens: 1400,
      output_tokens: 2300,
      cached_input_tokens: 120,
      cost_amount: 1.75,
      cost_currency: 'USD',
    });
    expect(result.blockers).toContain('human_blind_review_missing');
  });

  it.each([
    {
      label: 'fallback output',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          generation_mode: 'local_fallback',
          used_fallback: true,
        },
      }),
      blocker: 'fallback_output_not_allowed',
    },
    {
      label: 'fixture output',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          execution_kind: 'simulation_fixture',
          provider: 'fixture_adapter',
        },
      }),
      blocker: 'execution_kind_not_real_model',
    },
    {
      label: 'source hash mismatch',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          source_snapshot_sha256: 'f'.repeat(64),
        },
      }),
      blocker: 'source_snapshot_mismatch',
    },
    {
      label: 'requested model mismatch',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          requested_model_id: 'sonnet',
          reported_model_id: 'claude-sonnet-4',
        },
      }),
      blocker: 'requested_model_id_mismatch',
    },
    {
      label: 'reported model mismatch',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          reported_model_id: 'claude-sonnet-4',
        },
      }),
      blocker: 'reported_model_id_mismatch',
    },
    {
      label: 'reported model deceptive substring',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          reported_model_id: 'not-opus-simulated',
        },
      }),
      blocker: 'reported_model_id_mismatch',
    },
    {
      label: 'reported model non-canonical alias suffix',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          reported_model_id: 'claude-opus-simulated',
        },
      }),
      blocker: 'reported_model_id_mismatch',
    },
    {
      label: 'incomplete provenance',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          provenance_complete: false,
          incomplete_reasons: ['provider_usage_missing'],
          usage: null,
        },
      }),
      blocker: 'provenance_incomplete',
    },
    {
      label: 'story prompt hash mismatch',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          prompt_sha256: 'e'.repeat(64),
        },
      }),
      blocker: 'story_prompt_sha256_mismatch',
    },
    {
      label: 'CLI binary hash mismatch',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          cli_sha256: 'd'.repeat(64),
        },
      }),
      blocker: 'cli_sha256_mismatch',
    },
    {
      label: 'operator authorization reference mismatch',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          operator_authorization: {
            ...envelope.provenance.operator_authorization,
            reference_sha256: 'e'.repeat(64),
          },
        },
      }),
      blocker: 'operator_authorization_reference_mismatch',
    },
    {
      label: 'operator budget authorization mismatch',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          operator_authorization: {
            ...envelope.provenance.operator_authorization,
            budget_cap: { amount: 9, currency: 'USD' },
          },
        },
      }),
      blocker: 'operator_budget_cap_mismatch',
    },
    {
      label: 'reported cost exceeds the authorized cap',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          cost: {
            amount: 11,
            currency: 'USD',
            source: 'provider_reported',
          },
        },
      }),
      blocker: 'budget_cap_exceeded',
    },
    {
      label: 'reported cost currency differs from the authorization',
      mutate: (envelope: ProfessionalBenchmarkAdapterEnvelope) => ({
        ...envelope,
        provenance: {
          ...envelope.provenance,
          cost: {
            amount: 1,
            currency: 'EUR',
            source: 'provider_reported',
          },
        },
      }),
      blocker: 'budget_currency_mismatch',
    },
  ])('rejects $label provenance', async ({ mutate, blocker }) => {
    const fixture = authorize(prepare());
    const adapter = vi.fn(async () => mutate(validEnvelope(fixture)));

    const result = await execute(fixture, adapter);

    expect(adapter).toHaveBeenCalledOnce();
    expect(result.status).toBe('provenance_rejected');
    expect(result.provenance.status).toBe('rejected');
    expect(result.provenance.blockers).toContain(blocker);
    expect(result.credit_eligible).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.artifact_registry.items.some(item => item.kind === 'initial_story')).toBe(false);
    expect(result.artifact_registry.items.some(item => item.kind === 'character_evidence')).toBe(false);
  });

  it('rejects a prompt package changed after prepare without invoking the adapter', async () => {
    const fixture = authorize(prepare());
    fixture.promptPackage.story_generation_prompt.user_prompt += '\n漂移内容';
    const adapter = vi.fn(async () => validEnvelope(fixture));

    const result = await execute(fixture, adapter);

    expect(adapter).not.toHaveBeenCalled();
    expect(result.status).toBe('provenance_rejected');
    expect(result.blockers).toEqual(expect.arrayContaining([
      'prompt_package_hash_mismatch',
      'story_prompt_hash_mismatch',
    ]));
    expect(result.professional_passed).toBe(false);
  });

  it('moves to execution_failed when the injected adapter throws', async () => {
    const fixture = authorize(prepare());
    const adapter = vi.fn(async () => {
      throw new Error('adapter unavailable');
    });

    const result = await execute(fixture, adapter);

    expect(result.status).toBe('execution_failed');
    expect(result.blockers).toContain('adapter_execution_failed:adapter unavailable');
    expect(result.credit_eligible).toBe(false);
    expect(result.professional_passed).toBe(false);
  });
});
