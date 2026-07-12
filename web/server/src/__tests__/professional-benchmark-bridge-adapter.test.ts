import {
  access,
  chmod,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoryGenerationPromptPackage } from '../services/story-generation-prompt.js';
import type { CharacterStoryBenchmarkExecutionPackage } from '../services/professional-benchmark-service.js';
import {
  parseProfessionalBenchmarkBridgeEnvelope,
  runProfessionalBenchmarkBridgeAdapter,
} from '../services/professional-benchmark-bridge-adapter.js';

const tempDirs: string[] = [];
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const dedicatedBridgePath = path.join(
  repoRoot,
  'web',
  'server',
  'scripts',
  'professional-character-benchmark-bridge.mjs',
);

function expectedBridgeAnchor() {
  const bridgeRealpath = realpathSync(dedicatedBridgePath);
  return {
    realpath: bridgeRealpath,
    sha256: createHash('sha256').update(readFileSync(bridgeRealpath)).digest('hex'),
  };
}

function benchmarkPrompt(): StoryGenerationPromptPackage {
  return {
    prompt_version: 'story-generation/v1',
    context: {
      entry_name: '周敦颐——理学开山鼻祖',
      entry_type: '历史人物',
      entry_region: '湖南',
      entry_keywords: ['周敦颐'],
      video_type: 'character_story',
      presentation_style: 'cinematic',
      story_structure: 'single_event_drama',
      target_duration: '5分钟',
      tone: '克制',
    },
    entry_summary: '周敦颐人物简介',
    entry_story: '南安军拒签冤案',
    entry_cultural_significance: '以行动呈现操守',
    output_contract: {
      must_provide: ['story', 'character_evidence'],
      should_respect: ['不得伪造史料原话'],
      return_json_fields: ['story', 'character_evidence'],
    },
    system_prompt: '你是专业人物剧情编剧，只返回约定 JSON。',
    user_prompt: '围绕拒签事件写完整人物剧情。',
  };
}

function executionPackage(): CharacterStoryBenchmarkExecutionPackage {
  return {
    schema_version: 'character-story-professional-benchmark-execution-package/v2',
    benchmark_id: 'character-benchmark-001-zhou-dunyi-choice',
    video_type: 'character_story',
    status: 'source_package_ready',
    source_snapshot: {
      source_entry: '周敦颐——理学开山鼻祖',
      source_province: '湖南',
      source_region: '湖南',
      source_type: '历史人物',
      knowledge_base_credibility: '基本可靠',
      summary: '人物简介',
      story: '拒签事件',
      cultural_significance: '操守',
      sources: [{ source_id: 'source-1', citation: '《宋史》', grade: 'A' }],
      unverified_points: ['影视对白并非史料原文'],
      snapshot_sha256: 'a'.repeat(64),
      claim_level_verification_complete: false,
    },
    creative_contract: {
      central_event: '南安军拒签冤案',
      dramatic_question: '是否愿意用仕途为拒签承担代价？',
      target_audience: '18至35岁观众',
      platform: '剧情短片',
      target_duration: '5分钟',
      communication_goal: '用选择呈现人物',
      production_goal: '形成可拍摄剧本',
      audience_promise: '看到不可撤回的选择',
    },
    truth_boundary: {
      knowledge_base_claim_status: 'mixed_claims_require_source_level_review',
      required_evidence_focus: ['拒签事件'],
      plausible_dramatization_allowlist: ['非引文对白'],
      fictional_addition_policy: '必须标记',
      unknown_or_forbidden_claims: ['不得伪造引文'],
      required_disclaimers: ['对白属于影视化创作'],
    },
    story_generation_request: {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story',
    },
    execution_contract: {
      execution_kind: 'real_model',
      benchmark_prompt_version: 'character-story-professional-benchmark/v2',
      story_generation_prompt_version: 'story-generation/v1',
      professional_text_package_version: 'professional-text-package/v1',
      model_profile_id: 'claude_opus',
      model_runtime: 'claude',
      model_id: 'opus',
      fallback_allowed_for_benchmark_credit: false,
      fixture_allowed_for_benchmark_credit: false,
      required_artifacts: ['initial-story.json'],
    },
    professional_passed: false,
  };
}

function storyBundle() {
  return {
    story: {
      title: '拒签之前',
      logline: '一纸判词逼出不可撤回的选择。',
      theme: '原则必须承担代价。',
      full_text: '夜色压在军署屋脊上，周敦颐翻到案卷最后一页，笔尖却停在判词上。王逵派人催签，他逐条指出疑点。堂前争执越来越紧，他最终取出告身，宁愿辞官也不肯错判一条人命。王逵沉默许久，下令重审。',
      scene_breakdown: [
        {
          scene_id: 1,
          title: '停笔',
          duration_sec: 80,
          location: '南安军签押房',
          time_of_day: '夜',
          dramatic_function: '发现疑点并建立选择压力',
          plot: '周敦颐发现证据不能支持死刑判决。',
          key_action: '把笔搁回砚边',
          characters: ['周敦颐'],
          visual_prompt: '宋代签押房，案卷压桌，周敦颐停笔。',
          camera_suggestion: '中近景推向停笔动作。',
          cultural_note: '官署陈设与文书形制需符合宋代边界。',
          conflict: '签字结案与证据疑点正面冲突。',
          dialogue_or_narration: '这几个疑点，不能拿人命填过去。',
          source_entries: ['周敦颐——理学开山鼻祖'],
          factual_basis: '知识条目所载拒签冤案。',
          fictionalized_elements: ['夜间签押与具体停笔动作为影视化补足。'],
        },
        {
          scene_id: 2,
          title: '拒签',
          duration_sec: 100,
          location: '南安军公堂',
          time_of_day: '夜',
          dramatic_function: '完成关键选择并支付代价',
          plot: '王逵催签，周敦颐交出告身准备辞官。',
          key_action: '将告身放在未签判词旁',
          characters: ['周敦颐', '王逵'],
          visual_prompt: '宋代公堂，两份文书并排压在案上。',
          camera_suggestion: '手部特写后切双方对峙。',
          cultural_note: '告身用途与辞官表达需标注戏剧化边界。',
          conflict: '服从上官可保官位，拒签才能守住人命。',
          dialogue_or_narration: '若一定要签，这份告身也请一并收回。',
          source_entries: ['周敦颐——理学开山鼻祖'],
          factual_basis: '知识条目所载交还告身、以辞官相争。',
          fictionalized_elements: ['具体对白、站位与文书摆放为影视化补足。'],
        },
      ],
      cultural_constraints: ['影视对白不作为史料原文'],
      credibility_note: '事件有知识库依据，动作和对白属于合理戏剧化。',
    },
    character_evidence: {
      protagonist: '周敦颐',
      goal: '阻止证据不足的死刑判决',
      resistance: '上级要求立即签署',
      choice: '拒签并准备辞官',
      cost: '失去官职',
      starting_relationship_state: '服从上级命令',
      ending_relationship_state: '迫使上级重审',
      internal_change: '从陈述疑点走到承担代价',
      dialogue_voice_rules: ['周敦颐克制具体', '王逵短促强硬'],
      subtext_strategy: '签字程序背后是人命责任。',
      scene_turns: { '1': '发现冤判风险', '2': '以辞官承担代价' },
    },
  };
}

async function createFakeClaudeCli(
  mode: 'success' | 'error' | 'marker',
  bundle: ReturnType<typeof storyBundle> = storyBundle(),
) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'professional-bridge-adapter-'));
  tempDirs.push(tempDir);
  const cliPath = path.join(tempDir, 'fake-claude.mjs');
  const markerPath = path.join(tempDir, 'spawned.marker');
  const response = {
    type: 'result',
    model: 'claude-opus-4-1-20250805',
    result: JSON.stringify(bundle),
    usage: { input_tokens: 1000, output_tokens: 1800 },
    total_cost_usd: 1.2,
  };
  const source = [
    '#!/usr/bin/env node',
    "import fs from 'node:fs';",
    `const markerPath = ${JSON.stringify(markerPath)};`,
    "fs.writeFileSync(markerPath, 'spawned');",
    "if (process.argv.includes('--version')) { process.stdout.write('fake-claude 1.2.3\\n'); process.exit(0); }",
    mode === 'error'
      ? "process.stderr.write('fake provider failed'); process.exit(7);"
      : `process.stdout.write(${JSON.stringify(JSON.stringify(response))});`,
  ].join('\n');
  const fileContent = `${source}\n`;
  await writeFile(cliPath, fileContent, 'utf8');
  await chmod(cliPath, 0o755);
  return {
    cliPath,
    markerPath,
    cliSha256: createHash('sha256').update(fileContent).digest('hex'),
  };
}

function authorizeOperator(cliPath: string, cliSha256: string): void {
  vi.stubEnv('PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED', '1');
  vi.stubEnv('PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED', '1');
  vi.stubEnv('PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED', '1');
  vi.stubEnv('PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE', 'operator-test-reference-001');
  vi.stubEnv('PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP', '10');
  vi.stubEnv('PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY', 'USD');
  vi.stubEnv('PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_PATH', cliPath);
  vi.stubEnv('PROFESSIONAL_BENCHMARK_APPROVED_CLAUDE_CLI_SHA256', cliSha256);
}

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const tempDir of tempDirs.splice(0)) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe('professional benchmark bridge adapter', () => {
  it('rejects a legacy v1 benchmark prompt contract before resolving or spawning a CLI', async () => {
    const { cliPath, markerPath, cliSha256 } = await createFakeClaudeCli('marker');
    authorizeOperator(cliPath, cliSha256);
    const legacy = executionPackage() as unknown as Record<string, any>;
    legacy.execution_contract.benchmark_prompt_version = 'character-story-professional-benchmark/v1';

    await expect(runProfessionalBenchmarkBridgeAdapter({
      run_id: 'professional-run-adapter-legacy-prompt',
      expected_bridge_anchor: expectedBridgeAnchor(),
      execution_package: legacy as unknown as CharacterStoryBenchmarkExecutionPackage,
      benchmark_prompt: benchmarkPrompt(),
      execute_authorized: true,
      paid_authorized: true,
      runtime_cli_paths: { claude: cliPath },
    })).rejects.toThrow('Unsupported benchmark prompt version');
    await expect(access(markerPath)).rejects.toThrow();
  });

  it('does not spawn the bridge or model CLI without both authorizations', async () => {
    const { cliPath, markerPath } = await createFakeClaudeCli('marker');

    await expect(runProfessionalBenchmarkBridgeAdapter({
      run_id: 'professional-run-adapter-001',
      expected_bridge_anchor: expectedBridgeAnchor(),
      execution_package: executionPackage(),
      benchmark_prompt: benchmarkPrompt(),
      execute_authorized: false,
      paid_authorized: true,
      runtime_cli_paths: { claude: cliPath },
    })).rejects.toThrow('execute_authorized=true and paid_authorized=true');
    await expect(access(markerPath)).rejects.toThrow();
  });

  it('does not accept call-site booleans as a substitute for independent operator authorization', async () => {
    const { cliPath, markerPath } = await createFakeClaudeCli('marker');

    await expect(runProfessionalBenchmarkBridgeAdapter({
      run_id: 'professional-run-adapter-operator-missing',
      expected_bridge_anchor: expectedBridgeAnchor(),
      execution_package: executionPackage(),
      benchmark_prompt: benchmarkPrompt(),
      execute_authorized: true,
      paid_authorized: true,
      runtime_cli_paths: { claude: cliPath },
    })).rejects.toThrow('Independent operator authorization');
    await expect(access(markerPath)).rejects.toThrow();
  });

  it('rejects a call-site CLI path that does not match the operator-approved trust anchor', async () => {
    const approved = await createFakeClaudeCli('success');
    const substituted = await createFakeClaudeCli('marker');
    authorizeOperator(approved.cliPath, approved.cliSha256);

    await expect(runProfessionalBenchmarkBridgeAdapter({
      run_id: 'professional-run-adapter-anchor-mismatch',
      expected_bridge_anchor: expectedBridgeAnchor(),
      execution_package: executionPackage(),
      benchmark_prompt: benchmarkPrompt(),
      execute_authorized: true,
      paid_authorized: true,
      runtime_cli_paths: { claude: substituted.cliPath },
    })).rejects.toThrow('does not match the operator-approved realpath');
    await expect(access(substituted.markerPath)).rejects.toThrow();
  });

  it('uses the dedicated bridge with the runtime-specific verified CLI path', async () => {
    const { cliPath, cliSha256 } = await createFakeClaudeCli('success');
    authorizeOperator(cliPath, cliSha256);
    const expectedCliRealpath = await realpath(cliPath);

    const envelope = await runProfessionalBenchmarkBridgeAdapter({
      run_id: 'professional-run-adapter-002',
      expected_bridge_anchor: expectedBridgeAnchor(),
      execution_package: executionPackage(),
      benchmark_prompt: benchmarkPrompt(),
      execute_authorized: true,
      paid_authorized: true,
      runtime_cli_paths: { claude: cliPath },
      timeout_ms: 15000,
    });

    expect(envelope).toMatchObject({
      schema_version: 'professional-character-benchmark-bridge-output/v2',
      run_id: 'professional-run-adapter-002',
      benchmark_id: 'character-benchmark-001-zhou-dunyi-choice',
      story: { title: '拒签之前' },
      character_evidence: { protagonist: '周敦颐' },
      provenance: {
        provider: 'claude_cli',
        runtime: 'claude',
        requested_model_id: 'opus',
        reported_model_id: 'claude-opus-4-1-20250805',
        cli_realpath: expectedCliRealpath,
        cli_sha256: cliSha256,
        cli_version: 'fake-claude 1.2.3',
        operator_authorization: {
          reference_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          budget_cap: { amount: 10, currency: 'USD' },
        },
        provenance_complete: true,
      },
    });
  });

  it('surfaces strict bridge failures without returning fallback data', async () => {
    const { cliPath, cliSha256 } = await createFakeClaudeCli('error');
    authorizeOperator(cliPath, cliSha256);

    await expect(runProfessionalBenchmarkBridgeAdapter({
      run_id: 'professional-run-adapter-003',
      expected_bridge_anchor: expectedBridgeAnchor(),
      execution_package: executionPackage(),
      benchmark_prompt: benchmarkPrompt(),
      execute_authorized: true,
      paid_authorized: true,
      runtime_cli_paths: { claude: cliPath },
      timeout_ms: 15000,
    })).rejects.toThrow(/Strict benchmark bridge exited with code 1.*fake provider failed/s);
  });

  it('rejects invalid JSON before it can be treated as a strict v2 envelope', () => {
    expect(() => parseProfessionalBenchmarkBridgeEnvelope('not-json', {
      run_id: 'professional-run-adapter-004',
      benchmark_id: 'character-benchmark-001-zhou-dunyi-choice',
      runtime: 'claude',
      model_profile_id: 'claude_opus',
      requested_model_id: 'opus',
      benchmark_prompt_version: 'character-story-professional-benchmark/v2',
      story_prompt_version: 'story-generation/v1',
      prompt_sha256: 'b'.repeat(64),
      source_snapshot_sha256: 'a'.repeat(64),
      cli_realpath: '/verified/fake-claude',
      cli_sha256: 'c'.repeat(64),
      authorization_reference_sha256: 'd'.repeat(64),
      budget_cap: { amount: 10, currency: 'USD' },
    })).toThrow('Strict benchmark bridge returned invalid JSON');
  });

  it('rejects a legacy v1 bridge output envelope at the parser boundary', () => {
    expect(() => parseProfessionalBenchmarkBridgeEnvelope(JSON.stringify({
      schema_version: 'professional-character-benchmark-bridge-output/v1',
    }), {
      run_id: 'professional-run-adapter-legacy-output',
      benchmark_id: 'character-benchmark-001-zhou-dunyi-choice',
      runtime: 'claude',
      model_profile_id: 'claude_opus',
      requested_model_id: 'opus',
      benchmark_prompt_version: 'character-story-professional-benchmark/v2',
      story_prompt_version: 'story-generation/v1',
      prompt_sha256: 'b'.repeat(64),
      source_snapshot_sha256: 'a'.repeat(64),
      cli_realpath: '/verified/fake-claude',
      cli_sha256: 'c'.repeat(64),
      authorization_reference_sha256: 'd'.repeat(64),
      budget_cap: { amount: 10, currency: 'USD' },
    })).toThrow('invalid v2 envelope');
  });

  it('rejects model output with a missing shootable scene field', async () => {
    const bundle = storyBundle();
    delete (bundle.story.scene_breakdown[0] as Partial<typeof bundle.story.scene_breakdown[number]>).visual_prompt;
    const { cliPath, cliSha256 } = await createFakeClaudeCli('success', bundle);
    authorizeOperator(cliPath, cliSha256);

    await expect(runProfessionalBenchmarkBridgeAdapter({
      run_id: 'professional-run-adapter-incomplete-scene',
      expected_bridge_anchor: expectedBridgeAnchor(),
      execution_package: executionPackage(),
      benchmark_prompt: benchmarkPrompt(),
      execute_authorized: true,
      paid_authorized: true,
      runtime_cli_paths: { claude: cliPath },
      timeout_ms: 15000,
    })).rejects.toThrow(/visual_prompt/);
  });
});
