import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
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
  hashProfessionalBenchmarkArtifact,
  prepareProfessionalBenchmarkRun,
  type ProfessionalBenchmarkAdapterEnvelope,
  type ProfessionalBenchmarkRunLedger,
} from '../services/professional-benchmark-run-service.js';
import {
  coordinateProfessionalBenchmarkPostInitial,
  type ProfessionalBenchmarkPostInitialInput,
} from '../services/professional-benchmark-post-initial-service.js';

const NOW = '2026-07-11T11:00:00.000Z';
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const storedManifest = JSON.parse(fs.readFileSync(path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-execution-manifest.json',
), 'utf8')) as CharacterStoryBenchmarkExecutionManifest;

interface Fixture {
  executionPackage: CharacterStoryBenchmarkExecutionPackage;
  promptPackage: CharacterStoryProfessionalBenchmarkPromptPackage;
  ledger: ProfessionalBenchmarkRunLedger;
  envelope: ProfessionalBenchmarkAdapterEnvelope;
}

function runtimeReadyManifest(): CharacterStoryBenchmarkExecutionManifest {
  const manifest = structuredClone(storedManifest);
  const packageContract = manifest.packages[0].execution_contract;
  manifest.schema_version = 'character-story-professional-benchmark-execution-manifest/v2';
  manifest.strict_readiness = {
    provider: 'dedicated_strict_bridge',
    model_profile_id: packageContract.model_profile_id,
    model_runtime: packageContract.model_runtime,
    model_id: packageContract.model_id,
    strict_bridge_manifest_path: 'web/server/scripts/professional-character-benchmark-bridge.mjs',
    strict_bridge_realpath: '/runtime/professional-character-benchmark-bridge.mjs',
    strict_bridge_sha256: 'd'.repeat(64),
    strict_bridge_readable: true,
    selected_model_cli_manifest_path: '/runtime/claude',
    selected_model_cli_realpath: '/runtime/claude',
    selected_model_cli_sha256: 'c'.repeat(64),
    selected_model_cli_executable: true,
    technical_ready: true,
    blockers: [],
  };
  manifest.packages = manifest.packages.map(item => ({
    ...item,
    schema_version: 'character-story-professional-benchmark-execution-package/v2',
    status: 'source_package_ready',
  }));
  manifest.summary.strict_bridge_anchor_ready_count = manifest.packages.length;
  manifest.summary.strict_cli_anchor_ready_count = manifest.packages.length;
  manifest.summary.strict_technical_ready_count = manifest.packages.length;
  manifest.summary.real_model_execution_ready_count = manifest.packages.length;
  return manifest;
}

function fullStory(): Record<string, unknown> {
  return {
    title: '未落下的一笔',
    logline: '周敦颐必须在服从上官与阻止疑案定罪之间作出不可撤回的选择。',
    theme: '原则只有在承担现实代价时才成为行动。',
    full_text: [
      '夜色压住公堂，周敦颐翻到相互矛盾的证词，把蘸墨的笔搁回砚边。王逵催他依例签下死刑判词，他只指出案卷里缺失的时刻与证人。',
      '王逵把告身推到他面前，提醒抗命会断送仕途。周敦颐没有借空泛道理拖延，而是取出自己的告身，与未签判词并排放在案上，表示宁可辞官也不能替疑案落笔。',
      '公堂从上下级命令变成对证据的公开检验。王逵最终收回判词，同意重审；周敦颐保住人命，却也让自己与上官的关系再不能回到从前。',
    ].join('\n'),
    scene_breakdown: [
      {
        scene_id: 1,
        title: '停笔',
        duration_sec: 70,
        location: '南安军公堂',
        time_of_day: '夜',
        dramatic_function: '发现证据缺口并建立倒计时压力',
        plot: '周敦颐发现证词矛盾，在王逵催签时停笔。',
        key_action: '把蘸墨的笔搁回砚边并圈出证词矛盾',
        characters: ['周敦颐', '王逵'],
        visual_prompt: '宋代公堂夜景，案卷压桌，未落笔形成动作焦点。',
        camera_suggestion: '从判词推近到停笔手部，再切两人对峙中景。',
        cultural_note: '官署称谓与告身用法进入事实文化复核。',
        conflict: '立即服从上官，还是冒着抗命风险坚持重审。',
        dialogue_or_narration: '王逵：照例签了。周敦颐：这两份证词，时刻对不上。',
        source_entries: ['周敦颐——理学开山鼻祖'],
        factual_basis: '中心事件来自执行包固定的南安军拒签冤案。',
        fictionalized_elements: ['夜间调度与具体对白为影视化补足。'],
      },
      {
        scene_id: 2,
        title: '交还告身',
        duration_sec: 80,
        location: '南安军公堂',
        time_of_day: '夜',
        dramatic_function: '让主角作出选择并承担代价',
        plot: '周敦颐交出告身拒签，王逵被迫重新面对证据。',
        key_action: '将告身和未签判词并排放在案上',
        characters: ['周敦颐', '王逵'],
        visual_prompt: '告身与判词并排，两人隔案站立，权力关系发生变化。',
        camera_suggestion: '低机位跟随告身落案，停顿后切王逵反应。',
        cultural_note: '不得把创作对白标成史料原话。',
        conflict: '王逵必须在维护权威和承认证据不足之间选择。',
        dialogue_or_narration: '周敦颐：人命面前，这一笔我不能落。',
        source_entries: ['周敦颐——理学开山鼻祖'],
        factual_basis: '辞官告身和改判边界来自执行包要求复核的事件。',
        fictionalized_elements: ['人物站位、停顿与非引文对白为影视化补足。'],
      },
    ],
    cultural_constraints: ['不得把影视化对白伪装成史料原文。'],
    credibility_note: '事件来自固定知识快照；具体对白和调度仍需事实与文化审阅。',
  };
}

function characterEvidence(): Record<string, unknown> {
  return {
    protagonist: '周敦颐',
    goal: '阻止证据不足的死刑判决生效',
    resistance: '知军王逵要求立即签署判词',
    choice: '拒签并交出告身准备辞官',
    cost: '失去官职并承担违逆上级的现实风险',
    starting_relationship_state: '王逵掌握命令权，周敦颐仍在服从框架内申辩',
    ending_relationship_state: '周敦颐以辞官打破服从框架，王逵被迫正视证据',
    internal_change: '从据理陈述走到以仕途为原则担保',
    dialogue_voice_rules: ['周敦颐克制而具体，只谈证据与行动', '王逵短促并强调官阶与程序'],
    subtext_strategy: '表面争的是签字程序，实际争的是官员是否敢为人命承担代价。',
    scene_turns: {
      '1': '从例行审卷转为确认存在冤判风险',
      '2': '从言语争辩转为不可撤回的辞官行动',
    },
  };
}

function envelopeFor(input: {
  ledger: ProfessionalBenchmarkRunLedger;
  promptPackage: CharacterStoryProfessionalBenchmarkPromptPackage;
  story: Record<string, unknown>;
  evidence: Record<string, unknown>;
}): ProfessionalBenchmarkAdapterEnvelope {
  const expected = input.ledger.expected_provenance;
  return {
    schema_version: 'professional-character-benchmark-bridge-output/v2',
    run_id: input.ledger.run_id,
    benchmark_id: input.ledger.benchmark_id,
    story: input.story,
    character_evidence: input.evidence,
    provenance: {
      execution_kind: 'real_model',
      generation_mode: 'external_model',
      provider: `${expected.runtime}_cli`,
      used_fallback: false,
      runtime: expected.runtime,
      model_profile_id: expected.model_profile_id,
      requested_model_id: expected.requested_model_id,
      reported_model_id: expected.runtime === 'claude'
        ? `claude-${expected.requested_model_id}-4-1-20250805`
        : expected.requested_model_id,
      benchmark_prompt_version: expected.benchmark_prompt_version,
      story_prompt_version: expected.story_prompt_version,
      prompt_sha256: hashProfessionalBenchmarkArtifact(input.promptPackage.story_generation_prompt),
      source_snapshot_sha256: expected.source_snapshot_sha256,
      cli_realpath: expected.cli_realpath ?? '',
      cli_sha256: expected.cli_sha256 ?? '',
      cli_version: 'external-cli 1.0.0',
      operator_authorization: structuredClone(expected.operator_authorization!),
      started_at: NOW,
      finished_at: NOW,
      duration_ms: 0,
      exit_code: 0,
      usage: {
        input_tokens: 1000,
        output_tokens: 1500,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        source: 'provider_reported',
      },
      cost: { amount: 1, currency: 'USD', source: 'provider_reported' },
      provider_response_sha256: 'b'.repeat(64),
      story_sha256: hashProfessionalBenchmarkArtifact(input.story),
      character_evidence_sha256: hashProfessionalBenchmarkArtifact(input.evidence),
      provenance_complete: true,
      incomplete_reasons: [],
    },
  };
}

async function makeFixture(input: {
  runId?: string;
  mutateStory?: (story: Record<string, unknown>) => void;
  mutateEvidence?: (evidence: Record<string, unknown>) => void;
} = {}): Promise<Fixture> {
  const manifest = runtimeReadyManifest();
  const executionPackage = manifest.packages[0];
  const promptPackage = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
  let ledger = prepareProfessionalBenchmarkRun({
    manifest,
    prompt_package: promptPackage,
    benchmark_id: executionPackage.benchmark_id,
    run_id: input.runId ?? 'external-run-001',
    now: NOW,
  });
  ledger = authorizeProfessionalBenchmarkRun({
    ledger,
    authorization: {
      credential_status: 'verified',
      budget_authorized: true,
      runtime_activated: true,
      authorization_reference: 'approved-external-run',
      budget_cap: { amount: 5, currency: 'USD' },
      approved_cli_realpath: '/runtime/claude',
      approved_cli_sha256: 'c'.repeat(64),
    },
    now: NOW,
  });
  const story = fullStory();
  const evidence = characterEvidence();
  input.mutateStory?.(story);
  input.mutateEvidence?.(evidence);
  const envelope = envelopeFor({ ledger, promptPackage, story, evidence });
  ledger = await executeProfessionalBenchmarkInitialRun({
    ledger,
    execution_package: executionPackage,
    prompt_package: promptPackage,
    adapter: createInternalProfessionalBenchmarkTestAdapter(async () => envelope),
    now: NOW,
  });
  expect(ledger.status).toBe('professional_evidence_pending');
  return { executionPackage, promptPackage, ledger, envelope };
}

function coordinatorInput(fixture: Fixture): ProfessionalBenchmarkPostInitialInput {
  return {
    post_initial_opt_in: true,
    execution_package: fixture.executionPackage,
    prompt_package: fixture.promptPackage,
    ledger: fixture.ledger,
    envelope: fixture.envelope,
    now: NOW,
  };
}

describe('professional benchmark post-initial coordinator', () => {
  it('creates an in-memory human-evidence work order from a verified external initial envelope', async () => {
    const fixture = await makeFixture();
    const result = coordinateProfessionalBenchmarkPostInitial(coordinatorInput(fixture));

    expect(result.blockers).toEqual([]);
    expect(result.status).toBe('human_evidence_required');
    expect(result.professional_passed).toBe(false);
    expect(result.credit_eligible).toBe(false);
    expect(result.initial_professional_package?.quality_report.professional_passed).toBe(false);
    expect(result.quality_report?.professional_passed).toBe(false);
    expect(result.revision_plan?.professional_passed).toBe(false);
    expect(result.revision_plan?.actions.map(action => action.issue_id)).toContain(
      'claim_level_verification_incomplete',
    );
    expect(result.next_action.kind).toBe('human_evidence_review');
    expect(result.next_action.human_blind_review_required).toBe(true);
    expect(result.artifact_payloads.initial_professional_package).toBe(
      result.initial_professional_package,
    );
    expect(ProfessionalTextPackageSchema.safeParse(result.initial_professional_package).success).toBe(true);
    expect(result.source_story?.scene_breakdown[0]).toMatchObject({
      location: '南安军公堂',
      duration_sec: 70,
      dialogue_or_narration: expect.stringContaining('证词'),
    });
  });

  it.each([
    {
      label: 'execution package hash drift',
      mutate: (input: ProfessionalBenchmarkPostInitialInput) => {
        input.execution_package.creative_contract.central_event += '（漂移）';
      },
      blocker: 'execution_package_hash_mismatch',
    },
    {
      label: 'source snapshot drift',
      mutate: (input: ProfessionalBenchmarkPostInitialInput) => {
        input.execution_package.source_snapshot.snapshot_sha256 = 'a'.repeat(64);
      },
      blocker: 'source_snapshot_sha256_mismatch',
    },
    {
      label: 'canonical prompt drift',
      mutate: (input: ProfessionalBenchmarkPostInitialInput) => {
        input.prompt_package.story_generation_prompt.user_prompt += '\n调用方漂移';
      },
      blocker: 'prompt_package_hash_mismatch',
    },
  ])('blocks $label', async ({ mutate, blocker }) => {
    const fixture = await makeFixture();
    const input = coordinatorInput(fixture);
    mutate(input);
    const result = coordinateProfessionalBenchmarkPostInitial(input);

    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain(blocker);
    expect(result.artifact_payloads).toEqual({});
    expect(result.professional_passed).toBe(false);
  });

  it('rejects a ledger with injected benchmark credit or professional pass', async () => {
    const fixture = await makeFixture();
    const input = coordinatorInput(fixture);
    input.ledger = {
      ...input.ledger,
      credit_eligible: true,
      professional_passed: true,
    } as unknown as ProfessionalBenchmarkRunLedger;

    const result = coordinateProfessionalBenchmarkPostInitial(input);
    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual(expect.arrayContaining([
      'ledger_credit_claim_not_allowed',
      'ledger_pass_claim_not_allowed',
    ]));
  });

  it('rejects fixture, simulation and local identities even with an internally valid ledger seal', async () => {
    const fixture = await makeFixture({ runId: 'fixture-run-001' });
    const result = coordinateProfessionalBenchmarkPostInitial(coordinatorInput(fixture));

    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('ledger_run_id_not_real_external');
    expect(result.professional_passed).toBe(false);
  });

  it.each([
    {
      label: 'required scene production field is missing',
      fixture: () => makeFixture({
        mutateStory: story => {
          const scene = (story.scene_breakdown as Array<Record<string, unknown>>)[0];
          delete scene.location;
        },
      }),
      blockerPrefix: 'initial_story_invalid:scene_breakdown.0.location',
    },
    {
      label: 'required character evidence is missing',
      fixture: () => makeFixture({
        mutateEvidence: evidence => { delete evidence.cost; },
      }),
      blockerPrefix: 'character_evidence_invalid:cost',
    },
  ])('fails closed when $label', async ({ fixture: fixtureFactory, blockerPrefix }) => {
    const fixture = await fixtureFactory();
    const result = coordinateProfessionalBenchmarkPostInitial(coordinatorInput(fixture));

    expect(result.status).toBe('blocked');
    expect(result.blockers.some(blocker => blocker.startsWith(blockerPrefix))).toBe(true);
    expect(result.initial_professional_package).toBeUndefined();
  });

  it('routes an observable full-text hard gate into a model revision action', async () => {
    const fixture = await makeFixture({
      mutateStory: story => {
        story.full_text = '周敦颐发现疑点后拒绝落笔，并以交出告身承担现实代价。'.repeat(3);
      },
    });
    const result = coordinateProfessionalBenchmarkPostInitial(coordinatorInput(fixture));

    expect(result.status).toBe('revision_required');
    expect(result.quality_report?.hard_gate_failures.join('\n')).toContain('full_text_not_final');
    expect(result.revision_plan?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        issue_id: 'full_text_not_final',
        repair_mode: 'model_rewrite_required',
      }),
    ]));
    expect(result.next_action.kind).toBe('model_revision_and_human_evidence');
    expect(result.professional_passed).toBe(false);
  });

  it('does nothing unless post-initial processing is explicitly opted in', async () => {
    const fixture = await makeFixture();
    const input = coordinatorInput(fixture);
    input.post_initial_opt_in = false;

    const result = coordinateProfessionalBenchmarkPostInitial(input);
    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('post_initial_opt_in_required');
    expect(result.artifact_payloads).toEqual({});
  });
});
