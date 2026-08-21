// web/server/src/services/story-generation-model.ts
// Model adapter for full story generation — mirrors scene-regeneration-model.ts pattern.
// Spawns an external command (agent bridge) via stdin/stdout, validates output with Zod,
// and falls back to local generation if the adapter fails or is not configured.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type {
  AIModelProfile,
  StoryGenerationRecordReplayReceipt,
} from '@shared/types.js';
import type { StoryGenerationPromptPackage, StoryGenerationModelOutput } from './story-generation-prompt.js';
import { getModelProfileById } from './model-catalog.js';

// ---------------------------------------------------------------------------
// Output Zod schema — validates what the external model returns
// ---------------------------------------------------------------------------

const StorySceneOutputSchema = z.object({
  scene_id: z.number().int().min(1),
  title: z.string().min(1),
  plot: z.string().min(10),
  key_action: z.string().min(1),
  conflict: z.string().optional(),
  dialogue_or_narration: z.string().optional(),
  visual_prompt: z.string().optional(),
  camera_suggestion: z.string().optional(),
  characters: z.array(z.string()).optional(),
  cultural_note: z.string().optional(),
});

const StoryGenerationOutputSchema = z.object({
  title: z.string().min(1),
  logline: z.string().min(1),
  theme: z.string().min(1),
  full_text: z.string().min(50),
  scene_breakdown: z.array(StorySceneOutputSchema).min(1),
  cultural_constraints: z.array(z.string()),
  credibility_note: z.string().min(1),
  // Optional type-specific fields
  characters: z.array(z.object({
    name: z.string(),
    role: z.string(),
    description: z.string(),
    arc: z.string().optional(),
  })).optional(),
  protagonist_arc: z.array(z.object({
    starting_state: z.string(),
    turning_point: z.string(),
    resolution: z.string(),
  })).optional(),
  visual_symbols: z.array(z.string()).optional(),
  core_message: z.string().optional(),
  slogan_or_key_sentence: z.string().optional(),
  craft_or_ritual_process: z.string().optional(),
  modern_connection: z.string().optional(),
  spatial_identity: z.string().optional(),
  visual_route: z.array(z.string()).optional(),
  time_layer: z.string().optional(),
  atmosphere: z.string().optional(),
  argument_points: z.array(z.string()).optional(),
  knowledge_outline: z.array(z.string()).optional(),
  source_quotes: z.array(z.string()).optional(),
  field_notes: z.array(z.string()).optional(),
});

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const StoryGenerationRecordReplayFixtureSchema = z.object({
  schema_version: z.literal('story-generation-record-replay/v1'),
  fixture_id: z.string().min(1),
  recorded_at: z.string().min(1),
  model_profile: z.object({
    id: z.string().min(1),
    runtime: z.enum(['claude', 'codex']),
    model: z.string().min(1),
  }).strict(),
  prompt_version: z.literal('story-generation/v1'),
  prompt_sha256: Sha256Schema,
  output_sha256: Sha256Schema,
  output: StoryGenerationOutputSchema,
  provenance: z.discriminatedUnion('source', [
    z.object({
      source: z.literal('offline_fixture'),
      external_model_call_recorded: z.literal(false),
    }).strict(),
    z.object({
      source: z.literal('captured_external_response'),
      external_model_call_recorded: z.literal(true),
    }).strict(),
  ]),
  boundaries: z.object({
    replay_invokes_external_model: z.literal(false),
    human_review_complete: z.literal(false),
    real_external_model_credit_granted: z.literal(false),
  }).strict(),
  fixture_sha256: Sha256Schema,
}).strict();

export type StoryGenerationRecordReplayFixture = z.infer<
  typeof StoryGenerationRecordReplayFixtureSchema
>;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface StoryGenerationModelResult {
  provider: string;
  output: StoryGenerationModelOutput | null;
  used_fallback: boolean;
  reason?: string;
  execution_evidence?: 'local_only' | 'live_external_command' | 'record_replay_fixture';
  record_replay_receipt?: StoryGenerationRecordReplayReceipt;
}

// ---------------------------------------------------------------------------
// Parse and sanitize — fill gaps so downstream merge logic doesn't crash
// ---------------------------------------------------------------------------

function sanitizeOutput(raw: StoryGenerationModelOutput): StoryGenerationModelOutput {
  return {
    title: raw.title.trim(),
    logline: raw.logline.trim(),
    theme: raw.theme.trim(),
    full_text: raw.full_text.trim(),
    scene_breakdown: raw.scene_breakdown.map(scene => ({
      scene_id: scene.scene_id,
      title: scene.title.trim(),
      plot: scene.plot.trim(),
      key_action: scene.key_action.trim(),
      conflict: scene.conflict?.trim() || undefined,
      dialogue_or_narration: scene.dialogue_or_narration?.trim() || undefined,
      visual_prompt: scene.visual_prompt?.trim() || undefined,
      camera_suggestion: scene.camera_suggestion?.trim() || undefined,
      characters: scene.characters || [],
      cultural_note: scene.cultural_note?.trim() || undefined,
    })),
    cultural_constraints: raw.cultural_constraints,
    credibility_note: raw.credibility_note.trim(),
    characters: raw.characters,
    protagonist_arc: raw.protagonist_arc,
    visual_symbols: raw.visual_symbols,
    core_message: raw.core_message,
    slogan_or_key_sentence: raw.slogan_or_key_sentence,
    craft_or_ritual_process: raw.craft_or_ritual_process?.trim() || undefined,
    modern_connection: raw.modern_connection?.trim() || undefined,
    spatial_identity: raw.spatial_identity?.trim() || undefined,
    visual_route: raw.visual_route,
    time_layer: raw.time_layer?.trim() || undefined,
    atmosphere: raw.atmosphere,
    argument_points: raw.argument_points,
    knowledge_outline: raw.knowledge_outline,
    source_quotes: raw.source_quotes,
    field_notes: raw.field_notes,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function canonicalSha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function fixtureHashInput(
  fixture: Omit<StoryGenerationRecordReplayFixture, 'fixture_sha256'>,
): Omit<StoryGenerationRecordReplayFixture, 'fixture_sha256'> {
  return fixture;
}

export function buildStoryGenerationRecordReplayFixture(input: {
  pkg: StoryGenerationPromptPackage;
  modelProfileId: string;
  output: StoryGenerationModelOutput;
  recordedAt: string;
  provenance: StoryGenerationRecordReplayFixture['provenance'];
}): StoryGenerationRecordReplayFixture {
  const modelProfile = getModelProfileById(input.modelProfileId);
  if (!modelProfile || modelProfile.runtime === 'local') {
    throw new Error(`Record replay requires a known external model profile, received "${input.modelProfileId}"`);
  }
  const output = sanitizeOutput(StoryGenerationOutputSchema.parse(input.output));
  const promptSha256 = canonicalSha256(input.pkg);
  const outputSha256 = canonicalSha256(output);
  const fixtureId = `story-generation-recording-${promptSha256.slice(0, 16)}-${outputSha256.slice(0, 16)}`;
  const unsigned: Omit<StoryGenerationRecordReplayFixture, 'fixture_sha256'> = {
    schema_version: 'story-generation-record-replay/v1',
    fixture_id: fixtureId,
    recorded_at: input.recordedAt,
    model_profile: {
      id: modelProfile.id,
      runtime: modelProfile.runtime,
      model: modelProfile.model,
    },
    prompt_version: input.pkg.prompt_version,
    prompt_sha256: promptSha256,
    output_sha256: outputSha256,
    output,
    provenance: input.provenance,
    boundaries: {
      replay_invokes_external_model: false,
      human_review_complete: false,
      real_external_model_credit_granted: false,
    },
  };
  return StoryGenerationRecordReplayFixtureSchema.parse({
    ...unsigned,
    fixture_sha256: canonicalSha256(fixtureHashInput(unsigned)),
  });
}

// ---------------------------------------------------------------------------
// Command adapter — spawns the bridge script, sends prompt via stdin, reads JSON from stdout
// ---------------------------------------------------------------------------

function parseArgs(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
  } catch {
    return raw.split(/\s+/).filter(Boolean);
  }
}

async function runCommandAdapter(input: {
  pkg: StoryGenerationPromptPackage;
  modelProfile: AIModelProfile;
}): Promise<StoryGenerationModelResult> {
  const command = process.env.STORY_GEN_COMMAND?.trim();
  if (!command) {
    // Adapter not configured — local engine is the intended path, not a fallback
    return {
      provider: 'local_only',
      output: null,
      used_fallback: false,
      reason: 'STORY_GEN_COMMAND is not configured',
      execution_evidence: 'local_only',
    };
  }

  const args = parseArgs(process.env.STORY_GEN_COMMAND_ARGS);
  const timeoutMs = Number(process.env.STORY_GEN_COMMAND_TIMEOUT_MS ?? 330000);

  // Build child env — inject the selected model's runtime + model name
  // This is the correct approach: child env inherits from process.env plus model overrides
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    STORY_GEN_AGENT: input.modelProfile.runtime,
    STORY_GEN_AGENT_MODEL: input.modelProfile.model,
  };

  // Also inject agent-specific paths if available
  if (input.modelProfile.runtime === 'claude' && process.env.STORY_GEN_AGENT_CLAUDE_PATH) {
    childEnv.STORY_GEN_AGENT_CLAUDE_PATH = process.env.STORY_GEN_AGENT_CLAUDE_PATH;
  }
  if (input.modelProfile.runtime === 'codex' && process.env.STORY_GEN_AGENT_CODEX_PATH) {
    childEnv.STORY_GEN_AGENT_CODEX_PATH = process.env.STORY_GEN_AGENT_CODEX_PATH;
  }

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: childEnv,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        provider: 'command_json',
        output: null,
        used_fallback: true,
        reason: `Story generation adapter timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    // A timed-out child may close stdin while the prompt is still being
    // flushed. The timeout/close paths below own the result; suppress EPIPE so
    // it cannot escape as an unhandled process error.
    child.stdin.on('error', () => {});
    child.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        provider: 'command_json',
        output: null,
        used_fallback: true,
        reason: `Story generation adapter failed to start: ${err.message}`,
      });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        resolve({
          provider: 'command_json',
          output: null,
          used_fallback: true,
          reason: `Story generation adapter exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        const validated = StoryGenerationOutputSchema.parse(parsed);
        resolve({
          provider: 'command_json',
          output: sanitizeOutput(validated),
          used_fallback: false,
          execution_evidence: 'live_external_command',
        });
      } catch (err) {
        resolve({
          provider: 'command_json',
          output: null,
          used_fallback: true,
          reason: `Story generation adapter returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });

    // Send prompt package via stdin
    child.stdin.write(JSON.stringify(input.pkg, null, 2));
    child.stdin.end();
  });
}

async function runRecordReplayAdapter(input: {
  pkg: StoryGenerationPromptPackage;
  modelProfile: AIModelProfile;
}): Promise<StoryGenerationModelResult> {
  const path = process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH?.trim();
  if (!path) {
    return {
      provider: 'record_replay_json',
      output: null,
      used_fallback: true,
      reason: 'STORY_GEN_RECORD_REPLAY_FIXTURE_PATH is not configured',
    };
  }

  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as unknown;
    const fixture = StoryGenerationRecordReplayFixtureSchema.parse(raw);
    const output = sanitizeOutput(fixture.output);
    const actualOutputSha256 = canonicalSha256(output);
    if (actualOutputSha256 !== fixture.output_sha256) {
      throw new Error(
        `output_sha256 mismatch: expected ${fixture.output_sha256}, received ${actualOutputSha256}`,
      );
    }
    const { fixture_sha256: expectedFixtureSha256, ...unsignedFixture } = fixture;
    const actualFixtureSha256 = canonicalSha256(fixtureHashInput(unsignedFixture));
    if (actualFixtureSha256 !== expectedFixtureSha256) {
      throw new Error(
        `fixture_sha256 mismatch: expected ${expectedFixtureSha256}, received ${actualFixtureSha256}`,
      );
    }
    if (
      fixture.model_profile.id !== input.modelProfile.id
      || fixture.model_profile.runtime !== input.modelProfile.runtime
      || fixture.model_profile.model !== input.modelProfile.model
    ) {
      throw new Error(
        `model_profile mismatch: fixture targets ${fixture.model_profile.id}/${fixture.model_profile.runtime}/${fixture.model_profile.model}`,
      );
    }
    const actualPromptSha256 = canonicalSha256(input.pkg);
    if (actualPromptSha256 !== fixture.prompt_sha256) {
      throw new Error(
        `prompt_sha256 mismatch: expected ${fixture.prompt_sha256}, received ${actualPromptSha256}`,
      );
    }

    return {
      provider: 'record_replay_json',
      output,
      used_fallback: false,
      execution_evidence: 'record_replay_fixture',
      record_replay_receipt: {
        schema_version: 'story-generation-record-replay-receipt/v1',
        fixture_id: fixture.fixture_id,
        prompt_sha256: fixture.prompt_sha256,
        output_sha256: fixture.output_sha256,
        fixture_sha256: fixture.fixture_sha256,
        recording_source: fixture.provenance.source,
        source_recording_external_call_claimed:
          fixture.provenance.external_model_call_recorded,
        replay_invokes_external_model: false,
        real_external_model_credit_granted: false,
      },
    };
  } catch (error) {
    return {
      provider: 'record_replay_json',
      output: null,
      used_fallback: true,
      reason: `Story generation record replay fixture rejected: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API — generate story with adapter, fall back to local if unavailable
// ---------------------------------------------------------------------------

export async function generateStoryWithAdapter(input: {
  pkg: StoryGenerationPromptPackage;
  modelProfileId: string;
}): Promise<StoryGenerationModelResult> {
  const provider = process.env.STORY_GEN_PROVIDER?.trim() || 'command_json';
  const modelProfile = getModelProfileById(input.modelProfileId);

  if (modelProfile?.runtime === 'local') {
    return {
      provider: 'local_only',
      output: null,
      used_fallback: false,
      reason: '已显式选择本地故事引擎',
      execution_evidence: 'local_only',
    };
  }

  if (provider === 'command_json' && modelProfile) {
    return runCommandAdapter({ pkg: input.pkg, modelProfile });
  }

  if (provider === 'record_replay_json' && modelProfile) {
    return runRecordReplayAdapter({ pkg: input.pkg, modelProfile });
  }

  // Unsupported provider or missing model profile → fallback
  return {
    provider: provider,
    output: null,
    used_fallback: true,
    reason: modelProfile
      ? `Unsupported STORY_GEN_PROVIDER "${provider}"`
      : `Unknown model profile "${input.modelProfileId}"`,
  };
}
