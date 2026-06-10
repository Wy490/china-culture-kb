import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIDGE_PATH = resolve(__dirname, '..', '..', 'scripts', 'story-generate-agent-bridge.mjs');
const TEMP_DIRS: string[] = [];

function runNode(command: string, args: string[], input: string, env: NodeJS.ProcessEnv) {
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', code => resolvePromise({ stdout, stderr, code }));

    child.stdin.write(input);
    child.stdin.end();
  });
}

afterEach(async () => {
  for (const dir of TEMP_DIRS.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('story-generate-agent-bridge', () => {
  it('normalizes missing or invalid scene_id values by scene order', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'story-gen-bridge-'));
    TEMP_DIRS.push(tempDir);

    const fakeClaudePath = resolve(tempDir, 'fake-claude.mjs');
    await writeFile(
      fakeClaudePath,
      [
        '#!/usr/bin/env node',
        'process.stdout.write(JSON.stringify({',
        "title:'模型标题',",
        "logline:'模型一句话',",
        "theme:'模型主题',",
        "full_text:'这是一个足够完整的模型故事文本，用来验证桥接脚本会输出标准 JSON。',",
        'scene_breakdown:[',
        "{scene_id:null,title:'第一场',plot:'第一场剧情足够长度',key_action:'第一场动作'},",
        "{scene_id:0,title:'第二场',plot:'第二场剧情足够长度',key_action:'第二场动作'}",
        '],',
        "cultural_constraints:['约束'],",
        "credibility_note:'基本可靠'",
        '}));',
      ].join('\n'),
      'utf8',
    );

    const pkg = {
      system_prompt: 'system',
      user_prompt: 'user',
    };

    const result = await runNode(
      process.execPath,
      [BRIDGE_PATH],
      JSON.stringify(pkg),
      {
        ...process.env,
        STORY_GEN_AGENT: 'claude',
        STORY_GEN_AGENT_CLAUDE_PATH: process.execPath,
        STORY_GEN_AGENT_CLAUDE_ARGS: JSON.stringify([fakeClaudePath]),
        STORY_GEN_AGENT_TIMEOUT_MS: '10000',
        NODE_OPTIONS: '',
      },
    );

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.scene_breakdown.map((scene: { scene_id: number }) => scene.scene_id)).toEqual([1, 2]);
  });
});
