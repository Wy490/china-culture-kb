// web/server/src/services/story-generation-model.ts
// Model adapter for full story generation — mirrors scene-regeneration-model.ts pattern.
// Spawns an external command (agent bridge) via stdin/stdout, validates output with Zod,
// and falls back to local generation if the adapter fails or is not configured.

import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { AIModelProfile } from '@shared/types.js';
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
  atmosphere: z.string().optional(),
  argument_points: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface StoryGenerationModelResult {
  provider: string;
  output: StoryGenerationModelOutput | null;
  used_fallback: boolean;
  reason?: string;
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
    atmosphere: raw.atmosphere,
    argument_points: raw.argument_points,
  };
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

// ---------------------------------------------------------------------------
// Public API — generate story with adapter, fall back to local if unavailable
// ---------------------------------------------------------------------------

export async function generateStoryWithAdapter(input: {
  pkg: StoryGenerationPromptPackage;
  modelProfileId: string;
}): Promise<StoryGenerationModelResult> {
  const provider = process.env.STORY_GEN_PROVIDER?.trim() || 'command_json';
  const modelProfile = getModelProfileById(input.modelProfileId);

  if (provider === 'command_json' && modelProfile) {
    return runCommandAdapter({ pkg: input.pkg, modelProfile });
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
