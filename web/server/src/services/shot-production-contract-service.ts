import type { ShotProductionContract, StoryProductionBeat, StoryScene } from '@shared/types.js';

export const PRODUCTION_FPS = 24 as const;

/** Largest remainder, stable ties: every requested frame belongs to exactly one unit. */
export function allocateProductionFrames(totalFrames: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(totalFrames) || totalFrames < weights.length || !weights.length
    || weights.some(weight => !Number.isFinite(weight) || weight <= 0)) {
    throw new Error('Invalid production frame allocation');
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(totalWeight)) throw new Error('Invalid production frame weights');
  const shares = weights.map(weight => totalFrames * weight / totalWeight);
  const frames = shares.map(Math.floor);
  const order = shares.map((share, index) => ({ index, remainder: share - frames[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remainder = totalFrames - frames.reduce((sum, count) => sum + count, 0);
  for (let index = 0; index < remainder; index++) frames[order[index].index]++;
  if (frames.some(count => count < 1)) throw new Error('Action plan needs more frames or fewer beats');
  return frames;
}

export function productionFramesForSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Production duration must be positive');
  return Math.round(seconds * PRODUCTION_FPS);
}

function normalize(value: string): string {
  return value.replace(/\*\*|["“”]/g, '').replace(/\s+/g, ' ').trim();
}

export function buildShotProductionContract(input: {
  scene: StoryScene; unitId: string; chunk: string; startFrame: number; clipFrames: number;
  beat?: StoryProductionBeat;
}): ShotProductionContract {
  const { scene, beat } = input;
  const spokenParts = (scene.dialogue_or_narration ?? '').split(/(?<=[。！？!?])/)
    .map(normalize).filter(part => part && normalize(input.chunk).includes(part));
  const speechText = beat?.speech_text ?? spokenParts.join('');
  let action = normalize(input.chunk);
  for (const part of spokenParts) action = action.replace(part, '');
  action = action.replace(/(?:冲突|冲突压力)：[^。\n]*(?:。|$)/gu, '').trim();
  const startState = beat?.start_state?.trim() || null;
  const endState = beat?.end_state?.trim() || null;
  const visibleAction = beat?.visible_action ?? action;
  return {
    schema_version: 'shot-production-contract/v1',
    source_scene_id: scene.scene_id, source_unit_id: input.unitId, source_beat_id: beat?.beat_id,
    speech_text: speechText, visible_action: visibleAction,
    required_actions: beat?.required_actions ?? (visibleAction ? [visibleAction] : []),
    start_state: startState, end_state: endState,
    state_status: startState && endState ? 'specified' : 'needs_input',
    timing: {
      fps: PRODUCTION_FPS, scene_frames: productionFramesForSeconds(scene.duration_sec),
      start_frame: input.startFrame, end_frame: input.startFrame + input.clipFrames,
      clip_frames: input.clipFrames,
    },
  };
}
