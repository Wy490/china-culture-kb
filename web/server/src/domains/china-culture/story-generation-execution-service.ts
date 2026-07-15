import type { StoryGenerateRequest } from '@shared/types.js';
import { mergeCharacterHintsIntoStoryResult, resolveStoryGenerationResult } from '../../platform/story-model-output-merge.js';
import { generateStoryWithAdapter } from '../../services/story-generation-model.js';
import { buildStoryGenerationPromptPackage } from '../../services/story-generation-prompt.js';
import type { PreparedChinaCultureStoryGeneration } from './story-generation-preparation-service.js';
import { generateChinaCultureLocalStoryAssembly } from './story-local-generation-service.js';

export async function executeChinaCultureStoryGeneration(input: {
  request: StoryGenerateRequest;
  preparation: PreparedChinaCultureStoryGeneration;
}) {
  const { request, preparation } = input;
  const localGeneration = generateChinaCultureLocalStoryAssembly({
    entry: preparation.entry,
    centralEvent: preparation.centralEvent,
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
    storyStructure: preparation.storyStructure,
    targetDuration: preparation.targetDuration,
    tone: preparation.localTone,
    knowledgePack: preparation.knowledgePackToUse,
    originalUserQuery: request.original_user_query ?? request.outline,
    stylePackIds: request.style_pack_ids,
  });
  if (!localGeneration.ok) return localGeneration;

  const promptPackage = buildStoryGenerationPromptPackage({
    entry: preparation.entry,
    request: {
      ...request,
      narrative_pattern_ids: preparation.narrativePatternIds,
    },
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
    storyStructure: preparation.storyStructure,
    targetDuration: preparation.targetDuration,
    tone: preparation.toneWithPriority,
    selectedEvent: preparation.centralEvent,
    knowledgePack: preparation.knowledgePackToUse,
    materialPack: preparation.materialPackToUse,
    materialSufficiency: preparation.materialSufficiency,
    productionMaterialPack: preparation.productionMaterialPack,
    productionMaterialReadiness: preparation.productionMaterialReadiness,
    creationContract: preparation.creationContract,
    genreMatrix: preparation.genreMatrix,
    memoryMosaicSeed: localGeneration.memoryMosaicSeed,
    storyBlueprint: preparation.preliminaryStoryBlueprint,
    adaptationAnalysis: preparation.adaptationAnalysis,
  });
  const adapterResult = await generateStoryWithAdapter({
    pkg: promptPackage,
    modelProfileId: preparation.selectedModelProfile.id,
  });
  const generationResolution = resolveStoryGenerationResult({
    localResult: localGeneration.storyResult,
    adapterResult,
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
  });
  let referenceTrace = localGeneration.referenceTrace;
  if (generationResolution.adapterTrace) {
    referenceTrace = [
      ...(referenceTrace ?? []),
      {
        applied_rules: [generationResolution.adapterTrace],
        source_story_structure: preparation.storyStructure,
      },
    ];
  }
  const storyResult = mergeCharacterHintsIntoStoryResult(
    generationResolution.storyResult,
    request.character_hints,
    preparation.videoType,
    preparation.presentationStyle,
  );

  return {
    ok: true as const,
    storyResult,
    memoryMosaicSeed: localGeneration.memoryMosaicSeed,
    referenceTrace,
    promptPackage,
    adapterResult,
    generationMode: generationResolution.generationMode,
    generationUsedFallback: generationResolution.generationUsedFallback,
  };
}
