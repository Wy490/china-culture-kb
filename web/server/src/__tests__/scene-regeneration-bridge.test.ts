import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIDGE_PATH = resolve(__dirname, '..', '..', 'scripts', 'scene-regenerate-agent-bridge.mjs');
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

describe('scene-regenerate-agent-bridge', () => {
  it('returns normalized JSON patch through a fake claude adapter', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'scene-regen-bridge-'));
    TEMP_DIRS.push(tempDir);

    const fakeClaudePath = resolve(tempDir, 'fake-claude.mjs');
    await writeFile(
      fakeClaudePath,
      [
        '#!/usr/bin/env node',
        "process.stdout.write(JSON.stringify({",
        "plot:'桥接后的 plot',",
        "key_action:'桥接动作',",
        "dialogue_or_narration:'桥接旁白',",
        "conflict:'桥接冲突',",
        "visual_prompt:'桥接画面',",
        "camera_suggestion:'桥接镜头'",
        '}));',
      ].join('\n'),
      'utf8',
    );

    const pkg = {
      system_prompt: 'system',
      user_prompt: 'user',
      target_scene: { title: '目标场景' },
    };

    const result = await runNode(
      process.execPath,
      [BRIDGE_PATH],
      JSON.stringify(pkg),
      {
        ...process.env,
        SCENE_REGEN_AGENT: 'claude',
        SCENE_REGEN_AGENT_CLAUDE_PATH: process.execPath,
        SCENE_REGEN_AGENT_CLAUDE_ARGS: JSON.stringify([fakeClaudePath]),
        SCENE_REGEN_AGENT_TIMEOUT_MS: '10000',
        NODE_OPTIONS: '',
      },
    );

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.plot).toBe('桥接后的 plot');
    expect(parsed.camera_suggestion).toBe('桥接镜头');
  });
});
