import type {
  GenreStrictness,
  MaterialSufficiencyReport,
  NarrativePatternId,
  StoryBlueprint,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { buildGearsDeliveryPackage } from '../services/gears-delivery-service.js';
import type {
  StoryGenerationModelOutput,
  StoryGenerationPromptPackage,
} from '../services/story-generation-prompt.js';
import {
  enrichStoryQualityWithDelivery,
  evaluateStoryQualityReport,
} from './story-quality-evaluation.js';
import type { StoryAssembly } from './story-model-output-merge.js';
import { orchestrateStoryRepair } from './story-repair-orchestration.js';

export async function orchestrateStoryPostGeneration(input: {
  storyId: string;
  story: StoryGenerateResult;
  storyResult: StoryAssembly;
  sourceModelOutput?: StoryGenerationModelOutput | null;
  baseQualityReport: StoryQualityReport;
  basePromptPackage: StoryGenerationPromptPackage;
  blueprint: StoryBlueprint;
  modelProfileId: string;
  narrativePatternIds: NarrativePatternId[];
  truthMode: StoryGenerateResult['truth_mode'];
  materialSufficiency: MaterialSufficiencyReport;
  autoRepair?: boolean;
  strictness?: GenreStrictness;
  videoType: StoryGenerateResult['video_type'];
  presentationStyle: StoryGenerateResult['presentation_style'];
  applyStoryAssembly: (
    storyResult: StoryAssembly,
    modelOutput?: StoryGenerationModelOutput | null,
  ) => void;
  evaluateBaseQuality: (storyResult: StoryAssembly) => StoryQualityReport;
}) {
  input.story.quality_report = evaluateStoryQualityReport({
    story: input.story,
    baseReport: input.baseQualityReport,
    blueprint: input.blueprint,
    narrativePatternIds: input.narrativePatternIds,
    truthMode: input.truthMode,
    materialSufficiency: input.materialSufficiency,
  });
  const repairResult = await orchestrateStoryRepair({
    storyId: input.storyId,
    autoRepair: input.autoRepair,
    strictness: input.strictness,
    story: input.story,
    storyResult: input.storyResult,
    sourceModelOutput: input.sourceModelOutput,
    qualityReport: input.story.quality_report,
    basePromptPackage: input.basePromptPackage,
    blueprint: input.blueprint,
    modelProfileId: input.modelProfileId,
    videoType: input.videoType,
    presentationStyle: input.presentationStyle,
    applyStoryAssembly: input.applyStoryAssembly,
    evaluateStoryQuality: candidate => evaluateStoryQualityReport({
      story: input.story,
      baseReport: input.evaluateBaseQuality(candidate),
      blueprint: input.blueprint,
      narrativePatternIds: input.narrativePatternIds,
      truthMode: input.truthMode,
      materialSufficiency: input.materialSufficiency,
    }),
  });
  input.story.quality_report = repairResult.qualityReport;
  if (repairResult.repairTrace.length > 0) {
    input.story.repair_trace = repairResult.repairTrace;
  }
  input.story.gears_delivery = buildGearsDeliveryPackage(input.story);
  input.story.quality_report = enrichStoryQualityWithDelivery({
    story: input.story,
    qualityReport: input.story.quality_report,
    narrativePatternIds: input.narrativePatternIds,
    gearsDelivery: input.story.gears_delivery,
    truthMode: input.truthMode,
    materialSufficiency: input.materialSufficiency,
  });

  return {
    storyResult: repairResult.storyResult,
    qualityReport: input.story.quality_report,
    repairTrace: repairResult.repairTrace,
    gearsDelivery: input.story.gears_delivery,
  };
}
