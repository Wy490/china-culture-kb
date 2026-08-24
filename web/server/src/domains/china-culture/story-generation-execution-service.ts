import { ErrorCodes, type StoryGenerateRequest } from '@shared/types.js';
import { mergeCharacterHintsIntoStoryResult, resolveStoryGenerationResult } from '../../platform/story-model-output-merge.js';
import { generateStoryWithAdapter } from '../../services/story-generation-model.js';
import { buildStoryGenerationPromptPackage } from '../../services/story-generation-prompt.js';
import { buildReferenceGenerationTrace } from '../../services/reference-generation-bridge-service.js';
import type { PreparedChinaCultureStoryGeneration } from './story-generation-preparation-service.js';
import {
  buildStoryKnowledgePromptShadowComparison,
  projectStoryKnowledgeFactCandidatesToMaterialPack,
} from './story-knowledge-prompt-shadow-service.js';
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
    adaptationAnalysis: preparation.adaptationAnalysis,
    genreComposition: preparation.genreComposition,
  });
  if (!localGeneration.ok) {
    return {
      ok: false as const,
      code: ErrorCodes.VALIDATION_ERROR,
      message: localGeneration.message,
      details: {
        schema_version: 'story-local-generation-gate/v1' as const,
        reason: localGeneration.reason,
      },
    };
  }

  const buildPromptPackage = (materialPack: typeof preparation.materialPackToUse) => (
    buildStoryGenerationPromptPackage({
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
      materialPack,
      materialSufficiency: preparation.materialSufficiency,
      productionMaterialPack: preparation.productionMaterialPack,
      productionMaterialReadiness: preparation.productionMaterialReadiness,
      creationContract: preparation.creationContract,
      genreMatrix: preparation.genreMatrix,
      memoryMosaicSeed: localGeneration.memoryMosaicSeed,
      storyBlueprint: preparation.preliminaryStoryBlueprint,
      adaptationAnalysis: preparation.adaptationAnalysis,
      referenceGenerationRecipe: preparation.referenceGenerationRecipe,
      referenceGenerationContext: preparation.referenceGenerationContext,
    })
  );
  const promptPackage = buildPromptPackage(preparation.materialPackToUse);
  const shadowMaterialPack = preparation.storyKnowledgeGenerationShadow
    && preparation.storyKnowledgePreparation
    ? projectStoryKnowledgeFactCandidatesToMaterialPack({
      preparation: preparation.storyKnowledgePreparation,
      generationShadow: preparation.storyKnowledgeGenerationShadow,
      activeMaterialPack: preparation.materialPackToUse,
    })
    : undefined;
  const shadowPromptPackage = shadowMaterialPack
    ? buildPromptPackage(shadowMaterialPack)
    : undefined;
  const storyKnowledgePromptShadowComparison = preparation.storyKnowledgeGenerationShadow
    && preparation.storyKnowledgePreparation
    ? buildStoryKnowledgePromptShadowComparison({
      preparation: preparation.storyKnowledgePreparation,
      generationShadow: preparation.storyKnowledgeGenerationShadow,
      activeGenerationInputs: {
        knowledge_pack: preparation.knowledgePackToUse,
        material_pack: preparation.materialPackToUse,
        story_blueprint: preparation.preliminaryStoryBlueprint,
      },
      activePromptPackage: promptPackage,
      shadowMaterialPack,
      shadowPromptPackage,
    })
    : undefined;
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
  if (
    request.generation_fallback_policy === 'forbid_local_fallback'
    && preparation.selectedModelProfile.runtime !== 'local'
    && generationResolution.generationMode !== 'external_model'
  ) {
    return {
      ok: false as const,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'External story generation was required, but the adapter did not produce an accepted external result',
      details: {
        schema_version: 'story-generation-fallback-gate/v1' as const,
        policy: request.generation_fallback_policy,
        requested_model_profile_id: preparation.selectedModelProfile.id,
        adapter_provider: adapterResult.provider,
        generation_mode: generationResolution.generationMode,
        generation_used_fallback: generationResolution.generationUsedFallback,
        reason: adapterResult.reason
          ?? generationResolution.adapterTrace
          ?? 'external_model_result_unavailable',
      },
    };
  }
  const referenceApplicationStatus = generationResolution.generationMode === 'external_model'
    ? 'external_prompt_injected' as const
    : generationResolution.generationMode === 'local_fallback'
      ? 'local_fallback_not_applied' as const
      : 'local_engine_not_applied' as const;
  let referenceTrace = [
    ...(localGeneration.referenceTrace ?? []),
    ...buildReferenceGenerationTrace({
      context: preparation.referenceGenerationContext,
      storyStructure: preparation.storyStructure,
      applicationStatus: referenceApplicationStatus,
    }),
  ];
  if (generationResolution.adapterTrace) {
    referenceTrace = [
      ...referenceTrace,
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
    ...(storyKnowledgePromptShadowComparison
      ? { storyKnowledgePromptShadowComparison }
      : {}),
    adapterResult,
    generationMode: generationResolution.generationMode,
    generationUsedFallback: generationResolution.generationUsedFallback,
  };
}
