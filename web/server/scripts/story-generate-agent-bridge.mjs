#!/usr/bin/env node

// web/server/scripts/story-generate-agent-bridge.mjs
// Bridge script for full story generation.
// Reads a StoryGenerationPromptPackage from stdin, spawns claude/codex CLI,
// and returns the model's full story output as JSON on stdout.
// Mirrors scene-regenerate-agent-bridge.mjs design but for full-generation pipeline.

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'logline',
    'theme',
    'full_text',
    'scene_breakdown',
    'cultural_constraints',
    'credibility_note',
  ],
  properties: {
    title: { type: 'string', minLength: 1 },
    logline: { type: 'string', minLength: 1 },
    theme: { type: 'string', minLength: 1 },
    full_text: { type: 'string', minLength: 50 },
    scene_breakdown: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['scene_id', 'title', 'plot', 'key_action'],
        properties: {
          scene_id: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1 },
          plot: { type: 'string', minLength: 10 },
          key_action: { type: 'string', minLength: 1 },
          conflict: { type: 'string' },
          dialogue_or_narration: { type: 'string' },
          visual_prompt: { type: 'string' },
          camera_suggestion: { type: 'string' },
          characters: { type: 'array', items: { type: 'string' } },
          cultural_note: { type: 'string' },
        },
      },
    },
    cultural_constraints: { type: 'array', items: { type: 'string' } },
    credibility_note: { type: 'string', minLength: 1 },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'role', 'description'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          description: { type: 'string' },
          arc: { type: 'string' },
        },
      },
    },
    protagonist_arc: {
      type: 'array',
      items: {
        type: 'object',
        required: ['starting_state', 'turning_point', 'resolution'],
        properties: {
          starting_state: { type: 'string' },
          turning_point: { type: 'string' },
          resolution: { type: 'string' },
        },
      },
    },
    visual_symbols: { type: 'array', items: { type: 'string' } },
    core_message: { type: 'string' },
    slogan_or_key_sentence: { type: 'string' },
    atmosphere: { type: 'string' },
    argument_points: { type: 'array', items: { type: 'string' } },
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

function validateOutput(output) {
  const required = ['title', 'logline', 'theme', 'full_text', 'scene_breakdown', 'cultural_constraints', 'credibility_note'];
  for (const field of required) {
    if (!output[field]) throw new Error(`Missing required field "${field}"`);
  }
  if (!Array.isArray(output.scene_breakdown) || output.scene_breakdown.length === 0) {
    throw new Error('scene_breakdown must be a non-empty array');
  }
  for (const scene of output.scene_breakdown) {
    if (!scene.scene_id || !scene.title || !scene.plot || !scene.key_action) {
      throw new Error('Each scene must have scene_id, title, plot, key_action');
    }
  }
  return {
    title: String(output.title).trim(),
    logline: String(output.logline).trim(),
    theme: String(output.theme).trim(),
    full_text: String(output.full_text).trim(),
    scene_breakdown: output.scene_breakdown.map(s => ({
      scene_id: Number(s.scene_id),
      title: String(s.title).trim(),
      plot: String(s.plot).trim(),
      key_action: String(s.key_action).trim(),
      conflict: s.conflict ? String(s.conflict).trim() : undefined,
      dialogue_or_narration: s.dialogue_or_narration ? String(s.dialogue_or_narration).trim() : undefined,
      visual_prompt: s.visual_prompt ? String(s.visual_prompt).trim() : undefined,
      camera_suggestion: s.camera_suggestion ? String(s.camera_suggestion).trim() : undefined,
      characters: Array.isArray(s.characters) ? s.characters.map(String) : [],
      cultural_note: s.cultural_note ? String(s.cultural_note).trim() : undefined,
    })),
    cultural_constraints: Array.isArray(output.cultural_constraints) ? output.cultural_constraints.map(String) : [],
    credibility_note: String(output.credibility_note).trim(),
    characters: output.characters || undefined,
    protagonist_arc: output.protagonist_arc || undefined,
    visual_symbols: output.visual_symbols || undefined,
    core_message: output.core_message || undefined,
    slogan_or_key_sentence: output.slogan_or_key_sentence || undefined,
    atmosphere: output.atmosphere || undefined,
    argument_points: output.argument_points || undefined,
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
  const model = process.env.STORY_GEN_AGENT_MODEL?.trim();
  const args = [
    ...parseExtraArgs(process.env.STORY_GEN_AGENT_CLAUDE_ARGS),
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
  const { stdout } = await runCommand(process.env.STORY_GEN_AGENT_CLAUDE_PATH || 'claude', args, '', timeoutMs);
  return validateOutput(parseJsonBlock(stdout));
}

async function runCodex(pkg, timeoutMs) {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'story-gen-codex-'));
  const schemaPath = path.join(tmpRoot, 'schema.json');
  const outPath = path.join(tmpRoot, 'output.txt');

  try {
    await writeFile(schemaPath, JSON.stringify(OUTPUT_SCHEMA, null, 2), 'utf8');
    const args = [
      'exec',
      ...parseExtraArgs(process.env.STORY_GEN_AGENT_CODEX_ARGS),
      '--skip-git-repo-check',
      '--sandbox', 'read-only',
      '--output-schema', schemaPath,
      '-o', outPath,
      '-',
    ];

    const model = process.env.STORY_GEN_AGENT_MODEL?.trim();
    if (model) {
      args.splice(1, 0, '--model', model);
    }

    await runCommand(process.env.STORY_GEN_AGENT_CODEX_PATH || 'codex', args, combinedPrompt(pkg), timeoutMs);
    const output = await readFile(outPath, 'utf8');
    return validateOutput(parseJsonBlock(output));
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

async function main() {
  const raw = await readStdin();
  const pkg = JSON.parse(raw);
  const provider = (process.env.STORY_GEN_AGENT || 'claude').trim();
  const timeoutMs = Number(process.env.STORY_GEN_AGENT_TIMEOUT_MS || 180000);

  const result = provider === 'codex'
    ? await runCodex(pkg, timeoutMs)
    : await runClaude(pkg, timeoutMs);

  process.stdout.write(JSON.stringify(result));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[story-generate-agent-bridge] ${message}\n`);
  process.exit(1);
});