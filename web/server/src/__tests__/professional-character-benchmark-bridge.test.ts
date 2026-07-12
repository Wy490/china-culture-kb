import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const bridgePath = path.join(
  repoRoot,
  'web',
  'server',
  'scripts',
  'professional-character-benchmark-bridge.mjs',
);
const tempDirs: string[] = [];
const cliHashes = new Map<string, string>();

interface BridgeRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function validStory() {
  return {
    title: '拒签之前',
    logline: '一纸判词逼迫周敦颐在仕途与人命之间作出选择。',
    theme: '原则只有在付出代价时才真正成立。',
    full_text: '夜色压在南安军署的屋脊上。周敦颐翻到案卷最后一页，笔尖却停在判词上。王逵派人催签，他逐条指出疑点。堂前争执越来越紧，周敦颐最终取出告身，宁愿辞官也不肯错判一条人命。王逵沉默许久，下令重审。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '笔停判词',
        duration_sec: 50,
        location: '南安军署书房',
        time_of_day: '夜',
        dramatic_function: '发现不可签署的证据缺口',
        plot: '周敦颐发现案卷证据不能支持死刑判决。',
        key_action: '把蘸墨的笔搁回砚边',
        characters: ['周敦颐'],
        visual_prompt: '烛火下的案卷与停在砚边的笔，周敦颐凝视证词矛盾处',
        camera_suggestion: '案卷特写推进至停笔动作，再切人物近景',
        cultural_note: '军署陈设与宋代文书形制需复核',
        conflict: '签署时限与证据不足正面冲突',
        dialogue_or_narration: '旁白：最后一页写着结案，证据却没有合上。',
        source_entries: ['周敦颐——理学开山鼻祖'],
        factual_basis: '知识库记录周敦颐任南安军司理参军时拒绝仓促定案。',
        fictionalized_elements: ['夜间审卷、停笔动作与旁白为影视化重构'],
      },
      {
        scene_id: 2,
        title: '堂前拒签',
        duration_sec: 70,
        location: '南安军署公堂',
        time_of_day: '次日清晨',
        dramatic_function: '让人物以仕途承担拒签代价',
        plot: '王逵当面催签，周敦颐取出告身承担辞官代价。',
        key_action: '将告身与未签判词并排放在案上',
        characters: ['周敦颐', '王逵'],
        visual_prompt: '公堂长案两端对峙，告身与未签判词并列在画面中心',
        camera_suggestion: '双人中景对峙后俯拍两份文书',
        cultural_note: '官阶礼仪与告身外观不得作现代化处理',
        conflict: '服从上级与避免冤判无法同时满足',
        dialogue_or_narration: '周敦颐：案可重审，字不能先落。',
        source_entries: ['周敦颐——理学开山鼻祖'],
        factual_basis: '拒绝定案并与上级争辩的事件来自冻结知识库摘要。',
        fictionalized_elements: ['告身道具动作、场面调度和对白为合理戏剧化'],
      },
    ],
    cultural_constraints: ['对白为影视化创作，不作为史料原文。'],
    credibility_note: '中心事件依据知识库史料边界，动作和对白属于合理戏剧化。',
  };
}

function validCharacterEvidence() {
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

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'professional-character-benchmark-bridge-input/v2',
    run_id: 'professional-run-001',
    benchmark_id: 'character-benchmark-001-zhou-dunyi-choice',
    prompt_package: {
      prompt_version: 'story-generation/v1',
      context: { video_type: 'character_story' },
      system_prompt: '你是专业人物剧情编剧，只能返回约定 JSON。',
      user_prompt: '围绕南安军拒签冤案完成单事件人物故事。',
    },
    source_snapshot_sha256: 'a'.repeat(64),
    execution_contract: {
      execution_kind: 'real_model',
      benchmark_prompt_version: 'character-story-professional-benchmark/v2',
      story_generation_prompt_version: 'story-generation/v1',
      model_profile_id: 'claude_opus',
      model_runtime: 'claude',
      model_id: 'opus',
    },
    ...overrides,
  };
}

function providerBundle(story = validStory()) {
  return {
    story,
    character_evidence: validCharacterEvidence(),
  };
}

function claudeResponse(overrides: Record<string, unknown> = {}) {
  return {
    type: 'result',
    subtype: 'success',
    model: 'claude-opus-4-1-20250805',
    result: JSON.stringify(providerBundle()),
    usage: {
      input_tokens: 1400,
      output_tokens: 2300,
      cache_read_input_tokens: 120,
    },
    total_cost_usd: 1.75,
    ...overrides,
  };
}

async function createFakeCli(kind: 'claude' | 'codex') {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `professional-benchmark-${kind}-`));
  tempDirs.push(tempDir);
  const cliPath = path.join(tempDir, `fake-${kind}.mjs`);
  const source = kind === 'claude'
    ? [
        '#!/usr/bin/env node',
        "import fs from 'node:fs';",
        "if (process.argv.includes('--version')) { process.stdout.write('fake-claude 1.2.3\\n'); process.exit(0); }",
        "if (process.env.FAKE_CAPTURE_PATH) fs.writeFileSync(process.env.FAKE_CAPTURE_PATH, JSON.stringify(process.argv.slice(2)));",
        "process.stdout.write(process.env.FAKE_PROVIDER_RESPONSE || '{}');",
      ].join('\n')
    : [
        '#!/usr/bin/env node',
        "import fs from 'node:fs';",
        "if (process.argv.includes('--version')) { process.stdout.write('fake-codex 5.5.0\\n'); process.exit(0); }",
        'const args = process.argv.slice(2);',
        "if (process.env.FAKE_CAPTURE_PATH) fs.writeFileSync(process.env.FAKE_CAPTURE_PATH, JSON.stringify(args));",
        "const outputIndex = args.indexOf('-o');",
        "if (outputIndex < 0 || !args[outputIndex + 1]) { process.stderr.write('missing -o'); process.exit(2); }",
        "fs.writeFileSync(args[outputIndex + 1], process.env.FAKE_OUTPUT_BUNDLE || '{}');",
        "process.stdout.write(process.env.FAKE_PROVIDER_EVENTS || '{}');",
      ].join('\n');
  await writeFile(cliPath, `${source}\n`, 'utf8');
  await chmod(cliPath, 0o755);
  cliHashes.set(cliPath, createHash('sha256').update(await readFile(cliPath)).digest('hex'));
  return { tempDir, cliPath };
}

function runBridge(input: unknown, env: NodeJS.ProcessEnv = {}): Promise<BridgeRunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [bridgePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        PROFESSIONAL_BENCHMARK_EXECUTE: '',
        PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED: '',
        PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED: '',
        PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED: '',
        PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE: '',
        PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP: '',
        PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY: '',
        PROFESSIONAL_BENCHMARK_CLAUDE_PATH: '',
        PROFESSIONAL_BENCHMARK_CLAUDE_SHA256: '',
        PROFESSIONAL_BENCHMARK_CODEX_PATH: '',
        PROFESSIONAL_BENCHMARK_CODEX_SHA256: '',
        PROFESSIONAL_BENCHMARK_CLAUDE_ARGS: '',
        PROFESSIONAL_BENCHMARK_CODEX_ARGS: '',
        ...env,
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', code => resolvePromise({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

function executeEnv(runtime: 'claude' | 'codex', cliPath: string): NodeJS.ProcessEnv {
  const cliSha256 = cliHashes.get(cliPath);
  if (!cliSha256) throw new Error(`Missing fake CLI hash: ${cliPath}`);
  return {
    PROFESSIONAL_BENCHMARK_EXECUTE: '1',
    PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED: '1',
    PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED: '1',
    PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED: '1',
    PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE: 'operator-authorization-test-001',
    PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP: '10',
    PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY: 'USD',
    [runtime === 'claude'
      ? 'PROFESSIONAL_BENCHMARK_CLAUDE_PATH'
      : 'PROFESSIONAL_BENCHMARK_CODEX_PATH']: cliPath,
    [runtime === 'claude'
      ? 'PROFESSIONAL_BENCHMARK_CLAUDE_SHA256'
      : 'PROFESSIONAL_BENCHMARK_CODEX_SHA256']: cliSha256,
  };
}

afterEach(async () => {
  for (const tempDir of tempDirs.splice(0)) {
    await rm(tempDir, { recursive: true, force: true });
  }
  cliHashes.clear();
});

describe('professional-character-benchmark-bridge', () => {
  it('rejects the legacy v1 input envelope before any CLI authorization check', async () => {
    const input = validInput({
      schema_version: 'professional-character-benchmark-bridge-input/v1',
    });
    const result = await runBridge(input);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('professional-character-benchmark-bridge-input/v2');
  });

  it('rejects the legacy v1 benchmark prompt contract before invoking a CLI', async () => {
    const input = validInput({
      execution_contract: {
        ...validInput().execution_contract,
        benchmark_prompt_version: 'character-story-professional-benchmark/v1',
      },
    });
    const result = await runBridge(input);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('character-story-professional-benchmark/v2');
  });

  it('does not invoke any CLI without both explicit execution authorization flags', async () => {
    const result = await runBridge(validInput());

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Real-model execution is disabled');
  });

  it('requires an independent operator reference and positive budget before invoking the CLI', async () => {
    const { cliPath } = await createFakeCli('claude');
    const env = executeEnv('claude', cliPath);
    env.PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE = '';
    const result = await runBridge(validInput(), env);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE');
  });

  it('rejects a CLI whose bytes do not match the approved SHA-256 anchor', async () => {
    const { cliPath } = await createFakeCli('claude');
    const env = executeEnv('claude', cliPath);
    env.PROFESSIONAL_BENCHMARK_CLAUDE_SHA256 = 'f'.repeat(64);
    const result = await runBridge(validInput(), env);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('CLI SHA-256 does not match the approved trust anchor');
  });

  it('returns a complete Claude provenance envelope from provider-reported usage', async () => {
    const { tempDir, cliPath } = await createFakeCli('claude');
    const capturePath = path.join(tempDir, 'args.json');
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_CAPTURE_PATH: capturePath,
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse()),
    });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    const envelope = JSON.parse(result.stdout);
    const expectedCliRealpath = await realpath(cliPath);
    expect(envelope).toMatchObject({
      schema_version: 'professional-character-benchmark-bridge-output/v2',
      run_id: 'professional-run-001',
      benchmark_id: 'character-benchmark-001-zhou-dunyi-choice',
      story: { title: '拒签之前' },
      character_evidence: { protagonist: '周敦颐' },
      provenance: {
        execution_kind: 'real_model',
        generation_mode: 'external_model',
        provider: 'claude_cli',
        used_fallback: false,
        runtime: 'claude',
        model_profile_id: 'claude_opus',
        requested_model_id: 'opus',
        reported_model_id: 'claude-opus-4-1-20250805',
        benchmark_prompt_version: 'character-story-professional-benchmark/v2',
        story_prompt_version: 'story-generation/v1',
        source_snapshot_sha256: 'a'.repeat(64),
        cli_realpath: expectedCliRealpath,
        cli_sha256: cliHashes.get(cliPath),
        cli_version: 'fake-claude 1.2.3',
        operator_authorization: {
          reference_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          budget_cap: { amount: 10, currency: 'USD' },
        },
        exit_code: 0,
        usage: {
          input_tokens: 1400,
          output_tokens: 2300,
          cache_read_input_tokens: 120,
          source: 'provider_reported',
        },
        cost: { amount: 1.75, currency: 'USD', source: 'provider_reported' },
        provenance_complete: true,
        incomplete_reasons: [],
      },
    });
    expect(envelope.provenance.prompt_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(envelope.provenance.story_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(envelope.provenance.character_evidence_sha256).toMatch(/^[a-f0-9]{64}$/);

    const args = JSON.parse(await readFile(capturePath, 'utf8')) as string[];
    expect(args.filter(arg => arg === '--model')).toHaveLength(1);
    expect(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2)).toEqual(['--model', 'opus']);
    expect(args.slice(args.indexOf('--output-format'), args.indexOf('--output-format') + 2))
      .toEqual(['--output-format', 'json']);
  });

  it('keeps a valid story but marks provenance incomplete when provider usage is absent', async () => {
    const { cliPath } = await createFakeCli('claude');
    const response: Record<string, unknown> = claudeResponse();
    delete response.usage;
    delete response.total_cost_usd;
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(response),
    });

    expect(result.code).toBe(0);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.story.title).toBe('拒签之前');
    expect(envelope.provenance).toMatchObject({
      usage: null,
      cost: null,
      provenance_complete: false,
      incomplete_reasons: expect.arrayContaining([
        'provider_usage_missing',
        'provider_cost_missing',
      ]),
    });
  });

  it('supports a Codex output file plus provider JSONL provenance events', async () => {
    const { tempDir, cliPath } = await createFakeCli('codex');
    const capturePath = path.join(tempDir, 'args.json');
    const input = validInput({
      execution_contract: {
        execution_kind: 'real_model',
        benchmark_prompt_version: 'character-story-professional-benchmark/v2',
        story_generation_prompt_version: 'story-generation/v1',
        model_profile_id: 'codex_gpt55',
        model_runtime: 'codex',
        model_id: 'gpt-5.5',
      },
    });
    const events = [
      { type: 'run.started', model: 'gpt-5.5' },
      {
        type: 'turn.completed',
        usage: { input_tokens: 900, output_tokens: 1700 },
        cost: { amount: 0.8, currency: 'USD' },
      },
    ].map(item => JSON.stringify(item)).join('\n');
    const result = await runBridge(input, {
      ...executeEnv('codex', cliPath),
      FAKE_CAPTURE_PATH: capturePath,
      FAKE_OUTPUT_BUNDLE: JSON.stringify(providerBundle()),
      FAKE_PROVIDER_EVENTS: events,
    });

    expect(result.code).toBe(0);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.provenance).toMatchObject({
      provider: 'codex_cli',
      runtime: 'codex',
      requested_model_id: 'gpt-5.5',
      reported_model_id: 'gpt-5.5',
      cli_version: 'fake-codex 5.5.0',
      usage: { input_tokens: 900, output_tokens: 1700 },
      cost: { amount: 0.8, currency: 'USD' },
      provenance_complete: true,
    });
    const args = JSON.parse(await readFile(capturePath, 'utf8')) as string[];
    expect(args.slice(0, 3)).toEqual(['--model', 'gpt-5.5', 'exec']);
    expect(args).toContain('--json');
    expect(args).toContain('--output-schema');
  });

  it('rejects unknown runtimes without invoking a CLI', async () => {
    const input = validInput({
      execution_contract: {
        execution_kind: 'real_model',
        benchmark_prompt_version: 'character-story-professional-benchmark/v2',
        story_generation_prompt_version: 'story-generation/v1',
        model_profile_id: 'local_fixture',
        model_runtime: 'local',
        model_id: 'fixture',
      },
    });
    const result = await runBridge(input, {
      PROFESSIONAL_BENCHMARK_EXECUTE: '1',
      PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED: '1',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unsupported benchmark runtime: local');
  });

  it.each([
    ['duplicate', [1, 1], 'Duplicate scene_id: 1'],
    ['zero', [0, 2], 'Invalid scene_id'],
    ['gap', [1, 3], 'scene_id must be contiguous and ordered'],
  ])('rejects %s scene ids instead of normalizing them', async (_label, ids, errorText) => {
    const { cliPath } = await createFakeCli('claude');
    const story = validStory();
    story.scene_breakdown[0].scene_id = ids[0];
    story.scene_breakdown[1].scene_id = ids[1];
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse({
        result: JSON.stringify(providerBundle(story)),
      })),
    });

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(errorText);
  });

  it.each([
    ['model', ['--model', 'sonnet'], '--model'],
    ['output format', ['--output-format', 'text'], '--output-format'],
  ])('rejects extra args that override the controlled %s', async (_label, args, errorText) => {
    const { cliPath } = await createFakeCli('claude');
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      PROFESSIONAL_BENCHMARK_CLAUDE_ARGS: JSON.stringify(args),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse()),
    });

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`cannot override controlled option: ${errorText}`);
  });

  it('rejects provider-reported fallback output', async () => {
    const { cliPath } = await createFakeCli('claude');
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse({
        used_fallback: true,
        generation_mode: 'local_fallback',
      })),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Provider reported fallback output');
  });

  it('rejects reserved pass and provenance fields embedded in model story output', async () => {
    const { cliPath } = await createFakeCli('claude');
    const story = { ...validStory(), professional_passed: true };
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse({
        result: JSON.stringify(providerBundle(story)),
      })),
    });

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('story contains reserved field: professional_passed');
  });

  it.each([
    ['missing field', (story: ReturnType<typeof validStory>) => {
      delete (story.scene_breakdown[0] as Partial<typeof story.scene_breakdown[number]>).factual_basis;
    }, 'factual_basis'],
    ['zero duration', (story: ReturnType<typeof validStory>) => {
      story.scene_breakdown[0].duration_sec = 0;
    }, 'duration_sec must be a positive number'],
    ['empty characters', (story: ReturnType<typeof validStory>) => {
      story.scene_breakdown[0].characters = [];
    }, 'characters must be a non-empty string array'],
  ])('rejects incomplete shootable scenes: %s', async (_label, mutate, errorText) => {
    const { cliPath } = await createFakeCli('claude');
    const story = validStory();
    mutate(story);
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse({
        result: JSON.stringify(providerBundle(story)),
      })),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(errorText);
  });

  it('rejects self-reported character evidence that is empty or does not cover every scene', async () => {
    const { cliPath } = await createFakeCli('claude');
    const characterEvidence = validCharacterEvidence();
    characterEvidence.goal = '   ';
    delete (characterEvidence.scene_turns as Record<string, string>)['2'];
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse({
        result: JSON.stringify({ story: validStory(), character_evidence: characterEvidence }),
      })),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('character_evidence.goal must be a non-empty string');
  });

  it('rejects character scene-turn evidence that omits a returned story scene', async () => {
    const { cliPath } = await createFakeCli('claude');
    const characterEvidence = validCharacterEvidence();
    delete (characterEvidence.scene_turns as Record<string, string>)['2'];
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse({
        result: JSON.stringify({ story: validStory(), character_evidence: characterEvidence }),
      })),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('scene_turns must cover every story scene exactly once');
  });

  it('rejects a provider-reported model that conflicts with the execution contract', async () => {
    const { cliPath } = await createFakeCli('claude');
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse({ model: 'claude-sonnet-4' })),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Provider model mismatch');
  });

  it('does not accept a misleading model identifier that merely contains the requested alias', async () => {
    const { cliPath } = await createFakeCli('claude');
    const result = await runBridge(validInput(), {
      ...executeEnv('claude', cliPath),
      FAKE_PROVIDER_RESPONSE: JSON.stringify(claudeResponse({ model: 'not-opus-simulated' })),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Provider model mismatch');
  });
});
