import { success, fail, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  StoryGenerateRequest,
  StoryGenerateResult,
} from '@shared/types.js';
import type { DomainStoryGenerateOptions } from '../../platform/domain-pack.js';
import { attachBlueprintScenes } from '../../services/story-blueprint-service.js';
import {
  persistGeneratedStoryAndNotifyGears,
} from '../../platform/generated-story-persistence.js';
import { generateStoryId } from '../../platform/story-identity.js';
import { orchestrateStoryPostGeneration } from '../../platform/story-post-generation-orchestration.js';
import {
  createStoryRepository as storyRepository,
  storyGeneratedRoot as webGeneratedRoot,
} from '../../platform/story-storage.js';
import { validateChinaCultureStoryAssemblyBaseQuality } from './story-base-quality-service.js';
import { buildChinaCultureGeneratedStoryDocument } from './story-document-service.js';
import { executeChinaCultureStoryGeneration } from './story-generation-execution-service.js';
import { prepareChinaCultureStoryGeneration } from './story-generation-preparation-service.js';
import { validateChinaCultureStoryContent } from './story-safety.js';
import {
  applyChinaCultureStoryAssemblyToStoryData,
} from './story-type-specific-fields-service.js';

export interface ChinaCultureStoryGenerationOptions extends DomainStoryGenerateOptions {}

/**
 * Owns the complete china_culture generation workflow. The legacy story service
 * re-exports this entry point for compatibility. The domain identifier and
 * safety policy are bound here so no caller can bypass them accidentally.
 */
export async function generateAndStoreChinaCultureStory(
  request: StoryGenerateRequest,
  options: ChinaCultureStoryGenerationOptions = {},
): Promise<ApiResponse<StoryGenerateResult>> {
  const { output_gears_segments } = request;
  const preparation = await prepareChinaCultureStoryGeneration(request);
  if (!preparation.ok) {
    return fail(preparation.code, preparation.message);
  }
  const {
    primaryEntryName,
    entry,
    videoType,
    presentationStyle,
    storyStructure,
    narrativePatternIds,
    truthMode,
    materialSufficiency,
    selectedModelProfile,
    centralEvent,
    preliminaryStoryBlueprint,
  } = preparation;

  const generation = await executeChinaCultureStoryGeneration({ request, preparation });
  if (!generation.ok) {
    return fail(ErrorCodes.VALIDATION_ERROR, generation.message);
  }
  const {
    adapterResult,
    generationMode,
    generationUsedFallback,
    memoryMosaicSeed,
    promptPackage,
    referenceTrace,
  } = generation;
  let { storyResult } = generation;

  const storyId = generateStoryId(primaryEntryName);
  const finalStoryBlueprint = attachBlueprintScenes(
    preliminaryStoryBlueprint,
    storyResult.scene_breakdown,
    storyId,
  );
  const baseQualityReport = validateChinaCultureStoryAssemblyBaseQuality({
    storyResult,
    storyStructure,
    memoryMosaicSeed,
    selectedEvent: centralEvent,
    videoType,
    truthMode,
    materialSufficiency,
  });
  const createdAt = new Date().toISOString();
  let storyData = buildChinaCultureGeneratedStoryDocument({
    request,
    sourceDomain: 'china_culture',
    storyId,
    createdAt,
    preparation,
    storyResult,
    finalStoryBlueprint,
    baseQualityReport,
    adapterResult,
    generationMode,
    generationUsedFallback,
    referenceTrace,
    memoryMosaicSeed,
  });

  const postGeneration = await orchestrateStoryPostGeneration({
    storyId,
    story: storyData,
    storyResult,
    sourceModelOutput: adapterResult.output,
    baseQualityReport,
    basePromptPackage: promptPackage,
    blueprint: finalStoryBlueprint,
    modelProfileId: selectedModelProfile.id,
    narrativePatternIds,
    truthMode,
    materialSufficiency,
    autoRepair: request.auto_repair,
    strictness: request.genre_strictness,
    videoType,
    presentationStyle,
    applyStoryAssembly: (candidate, modelOutput) => {
      applyChinaCultureStoryAssemblyToStoryData({
        storyData,
        storyResult: candidate,
        modelOutput,
        entry,
        videoType,
        outputGearsSegments: output_gears_segments !== false,
      });
    },
    evaluateBaseQuality: candidate => validateChinaCultureStoryAssemblyBaseQuality({
      storyResult: candidate,
      storyStructure,
      memoryMosaicSeed,
      selectedEvent: centralEvent,
      videoType,
      truthMode,
      materialSufficiency,
    }),
  });
  storyResult = postGeneration.storyResult;

  if (options.transform_story_before_validation_and_persistence) {
    const transformedStory = await options.transform_story_before_validation_and_persistence(storyData);
    storyData = {
      ...transformedStory,
      _request_meta: storyData._request_meta,
    };
  }

  const domainSafety = validateChinaCultureStoryContent({ story: storyData, source_entry: entry });
  storyData.domain_safety = domainSafety;
  if (!domainSafety.passed) {
    return fail(
      ErrorCodes.DOMAIN_SAFETY_VALIDATION_FAILED,
      'Generated story failed the china_culture safety boundary',
      domainSafety,
    );
  }

  const apiStory = await persistGeneratedStoryAndNotifyGears({
    storyData,
    createdAt,
    accessControl: options.access_control,
    repository: storyRepository(),
    generatedRoot: webGeneratedRoot(),
  });
  return success(apiStory);
}
