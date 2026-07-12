#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  access,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const INPUT_SCHEMA_VERSION = 'professional-character-benchmark-bridge-input/v2';
const OUTPUT_SCHEMA_VERSION = 'professional-character-benchmark-bridge-output/v2';
const BENCHMARK_PROMPT_VERSION = 'character-story-professional-benchmark/v2';
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;

const BUNDLE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['story', 'character_evidence'],
  properties: {
    story: {
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
        title: { type: 'string' },
        logline: { type: 'string' },
        theme: { type: 'string' },
        full_text: { type: 'string' },
        scene_breakdown: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'scene_id',
              'title',
              'duration_sec',
              'location',
              'time_of_day',
              'dramatic_function',
              'plot',
              'key_action',
              'characters',
              'visual_prompt',
              'camera_suggestion',
              'cultural_note',
              'conflict',
              'dialogue_or_narration',
              'source_entries',
              'factual_basis',
              'fictionalized_elements',
            ],
            properties: {
              scene_id: { type: 'integer', minimum: 1 },
              title: { type: 'string', minLength: 1 },
              duration_sec: { type: 'number', exclusiveMinimum: 0 },
              location: { type: 'string', minLength: 1 },
              time_of_day: { type: 'string', minLength: 1 },
              dramatic_function: { type: 'string', minLength: 1 },
              plot: { type: 'string', minLength: 1 },
              key_action: { type: 'string', minLength: 1 },
              characters: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', minLength: 1 },
              },
              visual_prompt: { type: 'string', minLength: 1 },
              camera_suggestion: { type: 'string', minLength: 1 },
              cultural_note: { type: 'string', minLength: 1 },
              conflict: { type: 'string', minLength: 1 },
              dialogue_or_narration: { type: 'string', minLength: 1 },
              source_entries: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', minLength: 1 },
              },
              factual_basis: { type: 'string', minLength: 1 },
              fictionalized_elements: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', minLength: 1 },
              },
            },
          },
        },
        cultural_constraints: { type: 'array', items: { type: 'string' } },
        credibility_note: { type: 'string' },
      },
    },
    character_evidence: {
      type: 'object',
      additionalProperties: false,
      required: [
        'protagonist',
        'goal',
        'resistance',
        'choice',
        'cost',
        'starting_relationship_state',
        'ending_relationship_state',
        'internal_change',
        'dialogue_voice_rules',
        'subtext_strategy',
        'scene_turns',
      ],
      properties: {
        protagonist: { type: 'string' },
        goal: { type: 'string' },
        resistance: { type: 'string' },
        choice: { type: 'string' },
        cost: { type: 'string' },
        starting_relationship_state: { type: 'string' },
        ending_relationship_state: { type: 'string' },
        internal_change: { type: 'string' },
        dialogue_voice_rules: {
          type: 'array',
          minItems: 2,
          items: { type: 'string' },
        },
        subtext_strategy: { type: 'string' },
        scene_turns: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
    },
  },
};

const RESERVED_OUTPUT_FIELDS = new Set([
  'professional_passed',
  'credit_eligible',
  'execution_kind',
  'generation_mode',
  'provider',
  'used_fallback',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function positiveNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  return value;
}

function nonEmptyStringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty string array`);
  }
  return value.map((item, index) => requiredString(item, `${field}[${index}]`));
}

function optionalNumber(...values) {
  for (const value of values) {
    const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
    if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const content = typeof value === 'string' ? value : canonicalJson(value);
  return createHash('sha256').update(content).digest('hex');
}

function assertNoReservedOutputFields(value, label) {
  if (!isRecord(value)) return;
  const reserved = Object.keys(value).find(key => RESERVED_OUTPUT_FIELDS.has(key));
  if (reserved) throw new Error(`${label} contains reserved field: ${reserved}`);
}

function parseJsonText(text, label) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`${label} was empty`);
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        // Fall through to the bounded error below.
      }
    }
  }
  throw new Error(`${label} did not contain valid JSON: ${trimmed.slice(0, 240)}`);
}

function parseExtraArgs(raw, field) {
  if (!raw?.trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${field} must be a JSON array`);
  }
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
    throw new Error(`${field} must be a JSON string array`);
  }
  return parsed;
}

function assertNoControlledArgOverrides(args) {
  const forbiddenExact = new Set([
    '--model',
    '-m',
    '--output-format',
    '--json',
    '--json-schema',
    '--output-schema',
    '-o',
    '--system-prompt',
  ]);
  const forbiddenPrefixes = [
    '--model=',
    '--output-format=',
    '--json-schema=',
    '--output-schema=',
    '--system-prompt=',
  ];
  const override = args.find(arg =>
    forbiddenExact.has(arg) || forbiddenPrefixes.some(prefix => arg.startsWith(prefix))
  );
  if (override) {
    throw new Error(`Benchmark CLI args cannot override controlled option: ${override}`);
  }
}

function validateConfiguredExtraArgs(runtime) {
  const field = runtime === 'claude'
    ? 'PROFESSIONAL_BENCHMARK_CLAUDE_ARGS'
    : 'PROFESSIONAL_BENCHMARK_CODEX_ARGS';
  const args = parseExtraArgs(process.env[field], field);
  assertNoControlledArgOverrides(args);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      input += chunk;
      if (Buffer.byteLength(input) > MAX_CAPTURE_BYTES) {
        reject(new Error('Benchmark bridge input exceeded the maximum size'));
      }
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

function validateInput(raw) {
  if (!isRecord(raw)) throw new Error('Bridge input must be a JSON object');
  if (raw.schema_version !== INPUT_SCHEMA_VERSION) {
    throw new Error(`schema_version must be ${INPUT_SCHEMA_VERSION}`);
  }
  const runId = requiredString(raw.run_id, 'run_id');
  if (/fixture|simulation/i.test(runId)) {
    throw new Error('Fixture or simulation run ids cannot use the real-model bridge');
  }
  const benchmarkId = requiredString(raw.benchmark_id, 'benchmark_id');
  if (/fixture|simulation/i.test(benchmarkId)) {
    throw new Error('Fixture or simulation benchmark ids cannot use the real-model bridge');
  }
  const sourceSnapshotSha256 = requiredString(raw.source_snapshot_sha256, 'source_snapshot_sha256');
  if (!/^[a-f0-9]{64}$/.test(sourceSnapshotSha256)) {
    throw new Error('source_snapshot_sha256 must be a lowercase SHA-256 value');
  }
  if (!isRecord(raw.prompt_package)) throw new Error('prompt_package must be an object');
  const promptPackage = raw.prompt_package;
  requiredString(promptPackage.system_prompt, 'prompt_package.system_prompt');
  requiredString(promptPackage.user_prompt, 'prompt_package.user_prompt');
  const promptVersion = requiredString(promptPackage.prompt_version, 'prompt_package.prompt_version');

  if (!isRecord(raw.execution_contract)) throw new Error('execution_contract must be an object');
  const contract = raw.execution_contract;
  if (contract.execution_kind !== 'real_model') {
    throw new Error('execution_contract.execution_kind must be real_model');
  }
  const runtime = requiredString(contract.model_runtime, 'execution_contract.model_runtime');
  if (runtime !== 'claude' && runtime !== 'codex') {
    throw new Error(`Unsupported benchmark runtime: ${runtime}`);
  }
  const storyPromptVersion = requiredString(
    contract.story_generation_prompt_version,
    'execution_contract.story_generation_prompt_version',
  );
  if (promptVersion !== storyPromptVersion) {
    throw new Error(`Prompt version mismatch: package=${promptVersion}, expected=${storyPromptVersion}`);
  }

  const benchmarkPromptVersion = requiredString(
    contract.benchmark_prompt_version,
    'execution_contract.benchmark_prompt_version',
  );
  if (benchmarkPromptVersion !== BENCHMARK_PROMPT_VERSION) {
    throw new Error(`execution_contract.benchmark_prompt_version must be ${BENCHMARK_PROMPT_VERSION}`);
  }

  return {
    run_id: runId,
    benchmark_id: benchmarkId,
    prompt_package: promptPackage,
    source_snapshot_sha256: sourceSnapshotSha256,
    execution_contract: {
      execution_kind: 'real_model',
      benchmark_prompt_version: benchmarkPromptVersion,
      story_generation_prompt_version: storyPromptVersion,
      model_profile_id: requiredString(contract.model_profile_id, 'execution_contract.model_profile_id'),
      model_runtime: runtime,
      model_id: requiredString(contract.model_id, 'execution_contract.model_id'),
    },
  };
}

function validateStory(raw) {
  if (!isRecord(raw)) throw new Error('Provider story must be an object');
  assertNoReservedOutputFields(raw, 'story');
  const story = {
    title: requiredString(raw.title, 'story.title'),
    logline: requiredString(raw.logline, 'story.logline'),
    theme: requiredString(raw.theme, 'story.theme'),
    full_text: requiredString(raw.full_text, 'story.full_text'),
    credibility_note: requiredString(raw.credibility_note, 'story.credibility_note'),
  };
  if (story.full_text.length < 50) throw new Error('story.full_text must contain at least 50 characters');
  if (!Array.isArray(raw.cultural_constraints)) {
    throw new Error('story.cultural_constraints must be an array');
  }
  story.cultural_constraints = raw.cultural_constraints.map((item, index) =>
    requiredString(item, `story.cultural_constraints[${index}]`)
  );
  if (!Array.isArray(raw.scene_breakdown) || raw.scene_breakdown.length === 0) {
    throw new Error('story.scene_breakdown must be a non-empty array');
  }
  const sceneIds = new Set();
  story.scene_breakdown = raw.scene_breakdown.map((scene, index) => {
    if (!isRecord(scene)) throw new Error(`story.scene_breakdown[${index}] must be an object`);
    assertNoReservedOutputFields(scene, `story.scene_breakdown[${index}]`);
    const sceneId = scene.scene_id;
    if (!Number.isInteger(sceneId) || sceneId < 1) {
      throw new Error(`Invalid scene_id at story.scene_breakdown[${index}]`);
    }
    if (sceneIds.has(sceneId)) throw new Error(`Duplicate scene_id: ${sceneId}`);
    sceneIds.add(sceneId);
    if (sceneId !== index + 1) {
      throw new Error(`scene_id must be contiguous and ordered; expected ${index + 1}, got ${sceneId}`);
    }
    return {
      scene_id: sceneId,
      title: requiredString(scene.title, `story.scene_breakdown[${index}].title`),
      duration_sec: positiveNumber(
        scene.duration_sec,
        `story.scene_breakdown[${index}].duration_sec`,
      ),
      location: requiredString(scene.location, `story.scene_breakdown[${index}].location`),
      time_of_day: requiredString(scene.time_of_day, `story.scene_breakdown[${index}].time_of_day`),
      dramatic_function: requiredString(
        scene.dramatic_function,
        `story.scene_breakdown[${index}].dramatic_function`,
      ),
      plot: requiredString(scene.plot, `story.scene_breakdown[${index}].plot`),
      key_action: requiredString(scene.key_action, `story.scene_breakdown[${index}].key_action`),
      characters: nonEmptyStringArray(
        scene.characters,
        `story.scene_breakdown[${index}].characters`,
      ),
      visual_prompt: requiredString(
        scene.visual_prompt,
        `story.scene_breakdown[${index}].visual_prompt`,
      ),
      camera_suggestion: requiredString(
        scene.camera_suggestion,
        `story.scene_breakdown[${index}].camera_suggestion`,
      ),
      cultural_note: requiredString(
        scene.cultural_note,
        `story.scene_breakdown[${index}].cultural_note`,
      ),
      conflict: requiredString(scene.conflict, `story.scene_breakdown[${index}].conflict`),
      dialogue_or_narration: requiredString(
        scene.dialogue_or_narration,
        `story.scene_breakdown[${index}].dialogue_or_narration`,
      ),
      source_entries: nonEmptyStringArray(
        scene.source_entries,
        `story.scene_breakdown[${index}].source_entries`,
      ),
      factual_basis: requiredString(
        scene.factual_basis,
        `story.scene_breakdown[${index}].factual_basis`,
      ),
      fictionalized_elements: nonEmptyStringArray(
        scene.fictionalized_elements,
        `story.scene_breakdown[${index}].fictionalized_elements`,
      ),
    };
  });
  return story;
}

function validateCharacterEvidence(raw) {
  if (!isRecord(raw)) throw new Error('character_evidence must be an object');
  assertNoReservedOutputFields(raw, 'character_evidence');
  const stringFields = [
    'protagonist',
    'goal',
    'resistance',
    'choice',
    'cost',
    'starting_relationship_state',
    'ending_relationship_state',
    'internal_change',
    'subtext_strategy',
  ];
  const evidence = {};
  for (const field of stringFields) {
    evidence[field] = requiredString(raw[field], `character_evidence.${field}`);
  }
  if (!Array.isArray(raw.dialogue_voice_rules)
    || raw.dialogue_voice_rules.some(rule => typeof rule !== 'string')) {
    throw new Error('character_evidence.dialogue_voice_rules must be a string array');
  }
  evidence.dialogue_voice_rules = raw.dialogue_voice_rules.map((rule, index) =>
    requiredString(rule, `character_evidence.dialogue_voice_rules[${index}]`)
  );
  if (evidence.dialogue_voice_rules.length < 2) {
    throw new Error('character_evidence.dialogue_voice_rules must contain at least two rules');
  }
  if (evidence.starting_relationship_state === evidence.ending_relationship_state) {
    throw new Error('character_evidence relationship states must differ');
  }
  if (!isRecord(raw.scene_turns)
    || Object.values(raw.scene_turns).some(turn => typeof turn !== 'string')) {
    throw new Error('character_evidence.scene_turns must be a string map');
  }
  evidence.scene_turns = Object.fromEntries(
    Object.entries(raw.scene_turns).map(([sceneId, turn]) => [
      sceneId,
      requiredString(turn, `character_evidence.scene_turns.${sceneId}`),
    ]),
  );
  return evidence;
}

function assertProviderDidNotFallback(raw) {
  if (!isRecord(raw)) return;
  if (raw.used_fallback === true) throw new Error('Provider reported fallback output');
  for (const field of ['execution_kind', 'generation_mode', 'provider']) {
    const value = raw[field];
    if (typeof value === 'string' && /fixture|simulation|local_fallback|local_only/i.test(value)) {
      throw new Error(`Provider reported non-real output in ${field}: ${value}`);
    }
  }
}

function outputBundleFromProvider(raw) {
  if (!isRecord(raw)) throw new Error('Provider response must be an object');
  assertProviderDidNotFallback(raw);
  let payload = raw;
  for (const field of ['result', 'output', 'content']) {
    if (typeof raw[field] === 'string' && raw[field].trim()) {
      payload = parseJsonText(raw[field], `provider ${field}`);
      break;
    }
    if (isRecord(raw[field])) {
      payload = raw[field];
      break;
    }
  }
  if (!isRecord(payload)) throw new Error('Provider result payload must be an object');
  assertProviderDidNotFallback(payload);
  assertNoReservedOutputFields(payload, 'provider payload');
  if (!isRecord(payload.story) || !isRecord(payload.character_evidence)) {
    throw new Error('Provider payload must contain story and character_evidence objects');
  }
  const story = validateStory(payload.story);
  const characterEvidence = validateCharacterEvidence(payload.character_evidence);
  const expectedSceneTurnKeys = story.scene_breakdown.map(scene => String(scene.scene_id));
  const actualSceneTurnKeys = Object.keys(characterEvidence.scene_turns).sort((left, right) =>
    Number(left) - Number(right)
  );
  if (canonicalJson(actualSceneTurnKeys) !== canonicalJson(expectedSceneTurnKeys)) {
    throw new Error('character_evidence.scene_turns must cover every story scene exactly once');
  }
  return { story, character_evidence: characterEvidence };
}

function findNestedValue(value, keys, depth = 0) {
  if (depth > 6) return undefined;
  if (isRecord(value)) {
    for (const key of keys) {
      if (value[key] !== undefined) return value[key];
    }
    for (const child of Object.values(value)) {
      const found = findNestedValue(child, keys, depth + 1);
      if (found !== undefined) return found;
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const found = findNestedValue(child, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function extractReportedModel(raw) {
  const direct = findNestedValue(raw, ['reported_model_id', 'model_id', 'model']);
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const modelUsage = isRecord(raw) && isRecord(raw.modelUsage) ? raw.modelUsage : undefined;
  if (modelUsage) {
    const modelIds = Object.keys(modelUsage).filter(Boolean);
    if (modelIds.length === 1) return modelIds[0];
  }
  return null;
}

function extractUsage(raw) {
  const usage = findNestedValue(raw, ['usage', 'token_usage', 'tokenUsage']);
  if (!isRecord(usage)) return null;
  const inputTokens = optionalNumber(
    usage.input_tokens,
    usage.inputTokens,
    usage.prompt_tokens,
    usage.promptTokens,
  );
  const outputTokens = optionalNumber(
    usage.output_tokens,
    usage.outputTokens,
    usage.completion_tokens,
    usage.completionTokens,
  );
  if (inputTokens === undefined || outputTokens === undefined) return null;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: optionalNumber(
      usage.cache_read_input_tokens,
      usage.cacheReadInputTokens,
    ) ?? 0,
    cache_creation_input_tokens: optionalNumber(
      usage.cache_creation_input_tokens,
      usage.cacheCreationInputTokens,
    ) ?? 0,
    source: 'provider_reported',
  };
}

function extractCost(raw) {
  const totalUsd = findNestedValue(raw, ['total_cost_usd', 'totalCostUsd']);
  const amount = optionalNumber(totalUsd);
  if (amount !== undefined) {
    return { amount, currency: 'USD', source: 'provider_reported' };
  }
  const cost = findNestedValue(raw, ['cost']);
  if (!isRecord(cost)) return null;
  const costAmount = optionalNumber(cost.amount, cost.cost_amount, cost.total);
  if (costAmount === undefined) return null;
  const currency = typeof cost.currency === 'string' && cost.currency.trim()
    ? cost.currency.trim().toUpperCase()
    : 'USD';
  return { amount: costAmount, currency, source: 'provider_reported' };
}

function modelMatchesExpected(reported, expected) {
  if (!reported) return false;
  const normalizedReported = reported.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();
  if (normalizedReported === normalizedExpected) return true;
  const controlledAliases = {
    opus: /^claude-opus-\d+(?:-\d+)*$/,
    sonnet: /^claude-sonnet-\d+(?:-\d+)*$/,
    haiku: /^claude-haiku-\d+(?:-\d+)*$/,
  };
  const aliasPattern = controlledAliases[normalizedExpected];
  return aliasPattern ? aliasPattern.test(normalizedReported) : false;
}

function readOperatorAuthorization() {
  if (process.env.PROFESSIONAL_BENCHMARK_EXECUTE !== '1'
    || process.env.PROFESSIONAL_BENCHMARK_EXECUTION_AUTHORIZED !== '1'
    || process.env.PROFESSIONAL_BENCHMARK_PAID_EXECUTION_AUTHORIZED !== '1'
    || process.env.PROFESSIONAL_BENCHMARK_CREDENTIALS_VERIFIED !== '1') {
    throw new Error(
      'Real-model execution is disabled; internal execute, independent execution/paid authorization, '
      + 'and verified credentials are all required',
    );
  }
  const authorizationReference = requiredString(
    process.env.PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE,
    'PROFESSIONAL_BENCHMARK_AUTHORIZATION_REFERENCE',
  );
  const budgetAmount = Number(process.env.PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP);
  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
    throw new Error('PROFESSIONAL_BENCHMARK_BATCH_BUDGET_CAP must be a positive number');
  }
  const budgetCurrency = requiredString(
    process.env.PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY,
    'PROFESSIONAL_BENCHMARK_BUDGET_CURRENCY',
  ).toUpperCase();
  return {
    reference_sha256: sha256(authorizationReference),
    budget_cap: { amount: budgetAmount, currency: budgetCurrency },
  };
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

    const finishError = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill('SIGTERM');
      finishError(new Error(`Benchmark CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const append = (current, chunk, streamName) => {
      const next = current + String(chunk);
      if (Buffer.byteLength(next) > MAX_CAPTURE_BYTES) {
        child.kill('SIGTERM');
        finishError(new Error(`Benchmark CLI ${streamName} exceeded the maximum size`));
      }
      return next;
    };
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk, 'stdout'); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk, 'stderr'); });
    child.on('error', finishError);
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(
          `Benchmark CLI exited with code ${code ?? 'null'}${signal ? ` signal ${signal}` : ''}`
          + `${stderr.trim() ? `: ${stderr.trim().slice(0, 800)}` : ''}`,
        ));
        return;
      }
      resolve({ stdout, stderr, exit_code: 0 });
    });
    child.stdin.on('error', finishError);
    child.stdin.end(inputText);
  });
}

async function resolveCli(runtime) {
  const envKey = runtime === 'claude'
    ? 'PROFESSIONAL_BENCHMARK_CLAUDE_PATH'
    : 'PROFESSIONAL_BENCHMARK_CODEX_PATH';
  const shaEnvKey = runtime === 'claude'
    ? 'PROFESSIONAL_BENCHMARK_CLAUDE_SHA256'
    : 'PROFESSIONAL_BENCHMARK_CODEX_SHA256';
  const configuredPath = requiredString(process.env[envKey], envKey);
  if (!path.isAbsolute(configuredPath)) throw new Error(`${envKey} must be an absolute path`);
  const resolvedPath = await realpath(configuredPath);
  await access(resolvedPath, constants.X_OK);
  const expectedSha256 = requiredString(process.env[shaEnvKey], shaEnvKey);
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error(`${shaEnvKey} must be a lowercase SHA-256 value`);
  }
  const actualSha256 = createHash('sha256').update(await readFile(resolvedPath)).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${runtime} CLI SHA-256 does not match the approved trust anchor`);
  }
  return { realpath: resolvedPath, sha256: actualSha256 };
}

async function readCliVersion(cliPath) {
  try {
    const result = await runCommand(cliPath, ['--version'], '', 10000);
    const version = `${result.stdout}\n${result.stderr}`.trim().split(/\r?\n/)[0]?.trim();
    return version || null;
  } catch {
    return null;
  }
}

async function runClaude(input, cliPath, timeoutMs) {
  const extraArgs = parseExtraArgs(
    process.env.PROFESSIONAL_BENCHMARK_CLAUDE_ARGS,
    'PROFESSIONAL_BENCHMARK_CLAUDE_ARGS',
  );
  assertNoControlledArgOverrides(extraArgs);
  const args = [
    ...extraArgs,
    '-p',
    '--output-format', 'json',
    '--system-prompt', input.prompt_package.system_prompt,
    '--model', input.execution_contract.model_id,
    input.prompt_package.user_prompt,
  ];
  const commandResult = await runCommand(cliPath, args, '', timeoutMs);
  const providerResponse = parseJsonText(commandResult.stdout, 'Claude response');
  return {
    command_result: commandResult,
    provider_response: providerResponse,
    output_bundle: outputBundleFromProvider(providerResponse),
    provider_response_sha256: sha256(commandResult.stdout),
  };
}

function parseJsonLines(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => parseJsonText(line, `Codex event line ${index + 1}`));
}

async function runCodex(input, cliPath, timeoutMs) {
  const extraArgs = parseExtraArgs(
    process.env.PROFESSIONAL_BENCHMARK_CODEX_ARGS,
    'PROFESSIONAL_BENCHMARK_CODEX_ARGS',
  );
  assertNoControlledArgOverrides(extraArgs);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'professional-character-benchmark-'));
  const schemaPath = path.join(tmpRoot, 'output-schema.json');
  const outputPath = path.join(tmpRoot, 'output.json');
  try {
    await writeFile(schemaPath, JSON.stringify(BUNDLE_OUTPUT_SCHEMA), 'utf8');
    const args = [
      '--model', input.execution_contract.model_id,
      'exec',
      ...extraArgs,
      '--skip-git-repo-check',
      '--sandbox', 'read-only',
      '--json',
      '--output-schema', schemaPath,
      '-o', outputPath,
      '-',
    ];
    const combinedPrompt = [
      'SYSTEM PROMPT:',
      input.prompt_package.system_prompt,
      '',
      'USER PROMPT:',
      input.prompt_package.user_prompt,
    ].join('\n');
    const commandResult = await runCommand(cliPath, args, combinedPrompt, timeoutMs);
    const outputBundle = outputBundleFromProvider(parseJsonText(
      await readFile(outputPath, 'utf8'),
      'Codex output file',
    ));
    const events = parseJsonLines(commandResult.stdout);
    const providerResponse = { events };
    assertProviderDidNotFallback(providerResponse);
    return {
      command_result: commandResult,
      provider_response: providerResponse,
      output_bundle: outputBundle,
      provider_response_sha256: sha256(commandResult.stdout),
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

function executionTimeoutMs() {
  const raw = process.env.PROFESSIONAL_BENCHMARK_TIMEOUT_MS ?? '330000';
  const timeoutMs = Number(raw);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 900000) {
    throw new Error('PROFESSIONAL_BENCHMARK_TIMEOUT_MS must be an integer from 1000 to 900000');
  }
  return timeoutMs;
}

async function main() {
  const input = validateInput(parseJsonText(await readStdin(), 'Bridge input'));
  const operatorAuthorization = readOperatorAuthorization();

  validateConfiguredExtraArgs(input.execution_contract.model_runtime);
  const cliAnchor = await resolveCli(input.execution_contract.model_runtime);
  const cliPath = cliAnchor.realpath;
  const cliVersion = await readCliVersion(cliPath);
  const startedAt = new Date();
  const timeoutMs = executionTimeoutMs();
  const run = input.execution_contract.model_runtime === 'claude'
    ? await runClaude(input, cliPath, timeoutMs)
    : await runCodex(input, cliPath, timeoutMs);
  const finishedAt = new Date();

  const reportedModelId = extractReportedModel(run.provider_response);
  if (!modelMatchesExpected(reportedModelId, input.execution_contract.model_id)) {
    throw new Error(
      `Provider model mismatch: requested=${input.execution_contract.model_id}, reported=${reportedModelId}`,
    );
  }
  const usage = extractUsage(run.provider_response);
  const cost = extractCost(run.provider_response);
  const incompleteReasons = [
    reportedModelId ? '' : 'reported_model_id_missing',
    cliVersion ? '' : 'cli_version_missing',
    usage ? '' : 'provider_usage_missing',
    cost ? '' : 'provider_cost_missing',
  ].filter(Boolean);

  const envelope = {
    schema_version: OUTPUT_SCHEMA_VERSION,
    run_id: input.run_id,
    benchmark_id: input.benchmark_id,
    story: run.output_bundle.story,
    character_evidence: run.output_bundle.character_evidence,
    provenance: {
      execution_kind: 'real_model',
      generation_mode: 'external_model',
      provider: `${input.execution_contract.model_runtime}_cli`,
      used_fallback: false,
      runtime: input.execution_contract.model_runtime,
      model_profile_id: input.execution_contract.model_profile_id,
      requested_model_id: input.execution_contract.model_id,
      reported_model_id: reportedModelId,
      benchmark_prompt_version: input.execution_contract.benchmark_prompt_version,
      story_prompt_version: input.execution_contract.story_generation_prompt_version,
      prompt_sha256: sha256(input.prompt_package),
      source_snapshot_sha256: input.source_snapshot_sha256,
      cli_realpath: cliPath,
      cli_sha256: cliAnchor.sha256,
      cli_version: cliVersion,
      operator_authorization: operatorAuthorization,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      exit_code: run.command_result.exit_code,
      usage,
      cost,
      provider_response_sha256: run.provider_response_sha256,
      story_sha256: sha256(run.output_bundle.story),
      character_evidence_sha256: sha256(run.output_bundle.character_evidence),
      provenance_complete: incompleteReasons.length === 0,
      incomplete_reasons: incompleteReasons,
    },
  };
  process.stdout.write(JSON.stringify(envelope));
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[professional-character-benchmark-bridge] ${message}\n`);
  process.exitCode = 1;
});
