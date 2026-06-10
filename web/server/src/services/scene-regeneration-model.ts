import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { StoryScene } from '@shared/types.js';
import type { SceneRegenerationPromptPackage } from './scene-regeneration-prompt.js';
import { getModelProfileById } from './model-catalog.js';

const ScenePatchSchema = z.object({
  plot: z.string().min(1),
  key_action: z.string().min(1),
  dialogue_or_narration: z.string().min(1),
  conflict: z.string().optional(),
  visual_prompt: z.string().min(1),
  camera_suggestion: z.string().min(1),
});

export type SceneRegenerationPatch = z.infer<typeof ScenePatchSchema>;

export interface SceneRegenerationModelResult {
  provider: string;
  patch: SceneRegenerationPatch | null;
  used_fallback: boolean;
  reason?: string;
}

function parseArgs(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
  } catch {
    return raw.split(/\s+/).filter(Boolean);
  }
}

function sanitizePatch(current: StoryScene, patch: SceneRegenerationPatch): SceneRegenerationPatch {
  return {
    plot: patch.plot.trim() || current.plot,
    key_action: patch.key_action.trim() || current.key_action,
    dialogue_or_narration: patch.dialogue_or_narration.trim() || current.dialogue_or_narration || current.key_action,
    conflict: patch.conflict?.trim() || current.conflict,
    visual_prompt: patch.visual_prompt.trim() || current.visual_prompt,
    camera_suggestion: patch.camera_suggestion.trim() || current.camera_suggestion,
  };
}

async function runCommandAdapter(input: {
  pkg: SceneRegenerationPromptPackage;
  current: StoryScene;
  modelProfileId?: string;
}): Promise<SceneRegenerationModelResult> {
  const command = process.env.SCENE_REGEN_COMMAND?.trim();
  if (!command) {
    return {
      provider: 'local_fallback',
      patch: null,
      used_fallback: true,
      reason: 'SCENE_REGEN_COMMAND is not configured',
    };
  }

  const args = parseArgs(process.env.SCENE_REGEN_COMMAND_ARGS);
  const timeoutMs = Number(process.env.SCENE_REGEN_COMMAND_TIMEOUT_MS ?? 45000);
  const selectedProfile = getModelProfileById(input.modelProfileId);
  const childEnv = {
    ...process.env,
    ...(selectedProfile ? {
      SCENE_REGEN_AGENT: selectedProfile.runtime,
      SCENE_REGEN_AGENT_MODEL: selectedProfile.model,
    } : {}),
  };

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
        patch: null,
        used_fallback: true,
        reason: `Command adapter timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });
    child.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        provider: 'command_json',
        patch: null,
        used_fallback: true,
        reason: `Command adapter failed to start: ${err.message}`,
      });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        resolve({
          provider: 'command_json',
          patch: null,
          used_fallback: true,
          reason: `Command adapter exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        const patch = sanitizePatch(input.current, ScenePatchSchema.parse(parsed));
        resolve({
          provider: 'command_json',
          patch,
          used_fallback: false,
        });
      } catch (err) {
        resolve({
          provider: 'command_json',
          patch: null,
          used_fallback: true,
          reason: `Command adapter returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });

    child.stdin.write(JSON.stringify(input.pkg, null, 2));
    child.stdin.end();
  });
}

export async function generateScenePatchWithAdapter(input: {
  pkg: SceneRegenerationPromptPackage;
  current: StoryScene;
  modelProfileId?: string;
}): Promise<SceneRegenerationModelResult> {
  const provider = process.env.SCENE_REGEN_PROVIDER?.trim() || 'command_json';

  if (provider === 'command_json') {
    return runCommandAdapter(input);
  }

  return {
    provider,
    patch: null,
    used_fallback: true,
    reason: `Unsupported SCENE_REGEN_PROVIDER "${provider}"`,
  };
}
