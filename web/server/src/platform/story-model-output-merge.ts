import type {
  ActBeat,
  GearsCharacterRolePosition,
  GearsSegment,
  PresentationStyle,
  ProtagonistArc,
  StoryCharacter,
  StoryDetectedCharacter,
  StoryScene,
  VideoType,
} from '@shared/types.js';
import type { StoryGenerationModelOutput } from '../services/story-generation-prompt.js';
import { buildPlatformGearsSegmentsFromScenes } from './story-gears-segment.js';

export type StoryAssembly = {
  title: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: StoryScene[];
  gears_segments: GearsSegment[];
  cultural_constraints: string[];
  credibility_note: string;
  characters: StoryCharacter[];
  act_structure: ActBeat[];
  protagonist_arc: ProtagonistArc[];
};

/** Model output may only merge onto an identical, unique scene-ID skeleton. */
export function isModelSceneBreakdownCompatible(
  localScenes: StoryScene[],
  modelScenes: Array<{ scene_id: number }>,
): boolean {
  if (modelScenes.length !== localScenes.length) return false;

  const localIds = new Set(localScenes.map(scene => scene.scene_id));
  const modelIds = new Set(modelScenes.map(scene => scene.scene_id));

  if (localIds.size !== localScenes.length) return false;
  if (modelIds.size !== modelScenes.length) return false;
  if (modelIds.size !== localIds.size) return false;

  for (const id of localIds) {
    if (!modelIds.has(id)) return false;
  }
  return true;
}

/** Preserve local structure and cultural constraints while applying model prose. */
export function mergeModelOutputOntoLocalSkeleton(
  local: StoryAssembly,
  modelOutput: StoryGenerationModelOutput,
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): StoryAssembly {
  const mergedSceneBreakdown: StoryScene[] = local.scene_breakdown.map((localScene) => {
    const modelScene = modelOutput.scene_breakdown.find(
      scene => scene.scene_id === localScene.scene_id,
    )!;

    return {
      ...localScene,
      title: modelScene.title || localScene.title,
      plot: modelScene.plot || localScene.plot,
      key_action: modelScene.key_action || localScene.key_action,
      conflict: modelScene.conflict || localScene.conflict,
      dialogue_or_narration: modelScene.dialogue_or_narration || localScene.dialogue_or_narration,
      visual_prompt: modelScene.visual_prompt || localScene.visual_prompt,
      camera_suggestion: modelScene.camera_suggestion || localScene.camera_suggestion,
      characters: modelScene.characters?.length ? modelScene.characters : localScene.characters,
      cultural_note: modelScene.cultural_note || localScene.cultural_note,
    };
  });
  const mergedGearsSegments = buildPlatformGearsSegmentsFromScenes(
    mergedSceneBreakdown,
    videoType,
    presentationStyle,
  );
  const mergedCharacters: StoryCharacter[] = modelOutput.characters?.length
    ? modelOutput.characters.map(character => ({
        name: character.name,
        role: character.role,
        description: character.description,
        arc: character.arc,
      }))
    : local.characters;
  const mergedProtagonistArc: ProtagonistArc[] = modelOutput.protagonist_arc?.length
    ? modelOutput.protagonist_arc
    : local.protagonist_arc;

  return {
    title: modelOutput.title || local.title,
    logline: modelOutput.logline || local.logline,
    theme: modelOutput.theme || local.theme,
    full_text: modelOutput.full_text || local.full_text,
    scene_breakdown: mergedSceneBreakdown,
    gears_segments: mergedGearsSegments,
    cultural_constraints: [...new Set([
      ...local.cultural_constraints,
      ...(modelOutput.cultural_constraints ?? []),
    ].map(item => item.trim()).filter(Boolean))],
    credibility_note: modelOutput.credibility_note && modelOutput.credibility_note !== local.credibility_note
      ? `${local.credibility_note}；模型补充：${modelOutput.credibility_note}`
      : local.credibility_note,
    characters: mergedCharacters,
    act_structure: local.act_structure,
    protagonist_arc: mergedProtagonistArc,
  };
}

export interface ResolvedStoryGenerationResult {
  storyResult: StoryAssembly;
  adapterTrace?: string;
  generationMode: 'external_model' | 'local_fallback' | 'local_only';
  generationUsedFallback: boolean;
}

export function resolveStoryGenerationResult(input: {
  localResult: StoryAssembly;
  adapterResult: {
    provider: string;
    output: StoryGenerationModelOutput | null;
    used_fallback: boolean;
    reason?: string;
  };
  videoType: VideoType;
  presentationStyle: PresentationStyle;
}): ResolvedStoryGenerationResult {
  if (input.adapterResult.output) {
    if (isModelSceneBreakdownCompatible(
      input.localResult.scene_breakdown,
      input.adapterResult.output.scene_breakdown,
    )) {
      return {
        storyResult: mergeModelOutputOntoLocalSkeleton(
          input.localResult,
          input.adapterResult.output,
          input.videoType,
          input.presentationStyle,
        ),
        adapterTrace: `provider:${input.adapterResult.provider}`,
        generationMode: 'external_model',
        generationUsedFallback: false,
      };
    }
    return {
      storyResult: input.localResult,
      adapterTrace: 'fallback:scene_breakdown_incompatible_with_local_skeleton',
      generationMode: 'local_fallback',
      generationUsedFallback: true,
    };
  }

  return {
    storyResult: input.localResult,
    adapterTrace: input.adapterResult.used_fallback
      ? `fallback:${input.adapterResult.reason || 'model unavailable'}`
      : undefined,
    generationMode: input.adapterResult.used_fallback ? 'local_fallback' : 'local_only',
    generationUsedFallback: input.adapterResult.used_fallback,
  };
}

const ROLE_POSITION_TO_STORY_ROLE: Record<GearsCharacterRolePosition, string> = {
  '主角': 'protagonist',
  '反派': 'antagonist',
  '配角': 'supporting',
  '路人': 'passerby',
  '群演': 'crowd',
};

function normalizeHintCharacterName(name: string): string {
  return name.replace(/[「」『』"'“”‘’（）()【】\[\]\s]/g, '').trim();
}

function buildHintCharacterDescription(hint: StoryDetectedCharacter): string {
  const parts = [
    hint.role_position,
    hint.character_kind === 'named_person' ? '具名人物' : hint.character_kind,
    hint.age_range,
    hint.gender,
    hint.source_text ? `来自大纲：“${hint.source_text}”` : undefined,
  ].filter(Boolean);
  return parts.join('；');
}

function extractSceneMatchTokens(hint: StoryDetectedCharacter): string[] {
  const rawText = `${hint.name} ${hint.source_text}`;
  const cleaned = rawText
    .replace(/[，。！？；：、“”‘’"'（）()【】\[\]\s]/g, ' ')
    .replace(/[一个某位这位那位正在走过来说听她讲的了和与在把将]/g, ' ');
  const tokens = new Set<string>();
  const directName = normalizeHintCharacterName(hint.name);
  if (directName) tokens.add(directName);

  for (const token of cleaned.split(/\s+/)) {
    const normalized = normalizeHintCharacterName(token);
    if (normalized.length >= 2 && normalized.length <= 10) tokens.add(normalized);
    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= normalized.length - size; index += 1) {
        const gram = normalized.slice(index, index + size);
        if (gram.length >= 2) tokens.add(gram);
      }
    }
  }
  return [...tokens].filter(token => token.length >= 2);
}

function sceneSearchText(scene: StoryScene): string {
  return [
    scene.title,
    scene.location,
    scene.time_of_day,
    scene.dramatic_function,
    scene.plot,
    scene.key_action,
    scene.dialogue_or_narration,
    scene.visual_prompt,
    scene.camera_suggestion,
    scene.cultural_note,
    ...(scene.characters ?? []),
  ].filter(Boolean).join(' ');
}

function findHintSceneIds(hint: StoryDetectedCharacter, scenes: StoryScene[]): Set<number> {
  const matched = new Set<number>();
  const name = normalizeHintCharacterName(hint.name);
  const sourceText = hint.source_text.trim();
  const tokens = extractSceneMatchTokens(hint);
  let bestSceneId: number | undefined;
  let bestScore = 0;

  for (const scene of scenes) {
    const text = sceneSearchText(scene);
    if ((name && text.includes(name)) || (sourceText && text.includes(sourceText))) {
      matched.add(scene.scene_id);
      continue;
    }
    const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestSceneId = scene.scene_id;
    }
  }

  if (matched.size > 0) return matched;
  if (bestSceneId !== undefined && bestScore >= 2) return new Set([bestSceneId]);
  if (scenes.length === 0) return matched;
  if (hint.asset_stability === 'recurring') {
    return new Set(scenes.map(scene => scene.scene_id));
  }
  return new Set([scenes[0].scene_id]);
}

/** Normalize outline-detected roles so GEARS receives stable character assets. */
export function mergeCharacterHintsIntoStoryResult(
  story: StoryAssembly,
  characterHints: StoryDetectedCharacter[] | undefined,
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): StoryAssembly {
  if (!characterHints?.length) return story;

  const existingNames = new Set(
    (story.characters ?? []).map(character => normalizeHintCharacterName(character.name)),
  );
  const sceneBreakdown = story.scene_breakdown.map(scene => ({
    ...scene,
    characters: [...(scene.characters ?? [])],
  }));
  const characters = [...(story.characters ?? [])];

  for (const hint of characterHints) {
    const name = normalizeHintCharacterName(hint.name);
    if (!name) continue;

    if (!existingNames.has(name)) {
      characters.push({
        name,
        role: ROLE_POSITION_TO_STORY_ROLE[hint.role_position] ?? 'supporting',
        description: buildHintCharacterDescription(hint),
        arc: hint.asset_stability === 'recurring'
          ? `${name}作为${hint.role_position}贯穿多个单元，推动或见证主要行动。`
          : `${name}作为${hint.role_position}在对应单元提供行动、对白或氛围支撑。`,
      });
      existingNames.add(name);
    }

    const matchedSceneIds = findHintSceneIds(hint, sceneBreakdown);
    for (const scene of sceneBreakdown) {
      if (!matchedSceneIds.has(scene.scene_id)) continue;
      if (!scene.characters.includes(name)) {
        scene.characters = [...scene.characters, name];
      }
    }
  }

  return {
    ...story,
    characters,
    scene_breakdown: sceneBreakdown,
    gears_segments: buildPlatformGearsSegmentsFromScenes(
      sceneBreakdown,
      videoType,
      presentationStyle,
    ),
  };
}
