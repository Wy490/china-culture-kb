#!/usr/bin/env node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'plot',
    'key_action',
    'dialogue_or_narration',
    'visual_prompt',
    'camera_suggestion',
  ],
  properties: {
    plot: { type: 'string', minLength: 1 },
    key_action: { type: 'string', minLength: 1 },
    dialogue_or_narration: { type: 'string', minLength: 1 },
    conflict: { type: 'string' },
    visual_prompt: { type: 'string', minLength: 1 },
    camera_suggestion: { type: 'string', minLength: 1 },
  },
};

function parseExtraArgs(raw) {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
  } catch {
    return raw.split(/\s+/).filter(Boolean);
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });
}

function parseJsonBlock(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Model returned empty output');

  const directCandidates = [trimmed];
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    directCandidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of directCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }

  throw new Error(`Could not parse JSON from model output: ${trimmed.slice(0, 300)}`);
}

function validatePatch(patch) {
  const required = ['plot', 'key_action', 'dialogue_or_narration', 'visual_prompt', 'camera_suggestion'];
  for (const field of required) {
    if (typeof patch[field] !== 'string' || !patch[field].trim()) {
      throw new Error(`Invalid or missing field "${field}" in model output`);
    }
  }
  if (patch.conflict !== undefined && typeof patch.conflict !== 'string') {
    throw new Error('Field "conflict" must be a string when present');
  }
  return {
    plot: patch.plot.trim(),
    key_action: patch.key_action.trim(),
    dialogue_or_narration: patch.dialogue_or_narration.trim(),
    conflict: typeof patch.conflict === 'string' ? patch.conflict.trim() : undefined,
    visual_prompt: patch.visual_prompt.trim(),
    camera_suggestion: patch.camera_suggestion.trim(),
  };
}

function combinedPrompt(pkg) {
  return [
    'SYSTEM PROMPT:',
    pkg.system_prompt,
    '',
    'USER PROMPT:',
    pkg.user_prompt,
  ].join('\n');
}

function runCommand(command, args, inputText, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}${stderr.trim() ? `: ${stderr.trim()}` : ''}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.write(inputText);
    child.stdin.end();
  });
}

async function runClaude(pkg, timeoutMs) {
  const model = process.env.SCENE_REGEN_AGENT_MODEL?.trim();
  const args = [
    ...parseExtraArgs(process.env.SCENE_REGEN_AGENT_CLAUDE_ARGS),
    '-p',
    '--output-format', 'text',
    '--json-schema', JSON.stringify(OUTPUT_SCHEMA),
    '--allowedTools', '',
    '--system-prompt', pkg.system_prompt,
  ];

  if (model) {
    args.push('--model', model);
  }

  args.push(pkg.user_prompt);
  const { stdout } = await runCommand(process.env.SCENE_REGEN_AGENT_CLAUDE_PATH || 'claude', args, '', timeoutMs);
  return validatePatch(parseJsonBlock(stdout));
}

async function runCodex(pkg, timeoutMs) {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'scene-regen-codex-'));
  const schemaPath = path.join(tmpRoot, 'schema.json');
  const outPath = path.join(tmpRoot, 'output.txt');

  try {
    await writeFile(schemaPath, JSON.stringify(OUTPUT_SCHEMA, null, 2), 'utf8');
    const args = [
      'exec',
      ...parseExtraArgs(process.env.SCENE_REGEN_AGENT_CODEX_ARGS),
      '--skip-git-repo-check',
      '--sandbox', 'read-only',
      '--output-schema', schemaPath,
      '-o', outPath,
      '-',
    ];

    const model = process.env.SCENE_REGEN_AGENT_MODEL?.trim();
    if (model) {
      args.splice(1, 0, '--model', model);
    }

    await runCommand(process.env.SCENE_REGEN_AGENT_CODEX_PATH || 'codex', args, combinedPrompt(pkg), timeoutMs);
    const output = await readFile(outPath, 'utf8');
    return validatePatch(parseJsonBlock(output));
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

async function main() {
  const raw = await readStdin();
  const pkg = JSON.parse(raw);
  const provider = (process.env.SCENE_REGEN_AGENT || 'claude').trim();
  const timeoutMs = Number(process.env.SCENE_REGEN_AGENT_TIMEOUT_MS || 120000);

  const patch = provider === 'codex'
    ? await runCodex(pkg, timeoutMs)
    : await runClaude(pkg, timeoutMs);

  process.stdout.write(JSON.stringify(patch));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[scene-regenerate-agent-bridge] ${message}\n`);
  process.exit(1);
});
