import type {
  GenreStrictness,
  PresentationStyle,
  StoryBlueprint,
  StoryGenerateResult,
  StoryQualityReport,
  StoryRepairTrace,
  VideoType,
} from '@shared/types.js';
import type {
  StoryGenerationModelOutput,
  StoryGenerationPromptPackage,
} from '../services/story-generation-prompt.js';
import {
  generateStoryWithAdapter,
  type StoryGenerationModelResult,
} from '../services/story-generation-model.js';
import {
  buildStoryRepairPromptPackage,
  shouldAttemptStoryRepair,
} from '../services/story-repair-service.js';
import {
  isModelSceneBreakdownCompatible,
  mergeModelOutputOntoLocalSkeleton,
  type StoryAssembly,
} from './story-model-output-merge.js';

type RepairAdapter = (input: {
  pkg: StoryGenerationPromptPackage;
  modelProfileId: string;
}) => Promise<StoryGenerationModelResult>;

export interface StoryRepairOrchestrationResult {
  storyResult: StoryAssembly;
  qualityReport: StoryQualityReport;
  repairTrace: StoryRepairTrace[];
}

export async function orchestrateStoryRepair(input: {
  storyId: string;
  autoRepair?: boolean;
  strictness?: GenreStrictness;
  story: StoryGenerateResult;
  storyResult: StoryAssembly;
  sourceModelOutput?: StoryGenerationModelOutput | null;
  qualityReport: StoryQualityReport;
  basePromptPackage: StoryGenerationPromptPackage;
  blueprint: StoryBlueprint;
  modelProfileId: string;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  applyStoryAssembly: (
    storyResult: StoryAssembly,
    modelOutput?: StoryGenerationModelOutput | null,
  ) => void;
  evaluateStoryQuality: (storyResult: StoryAssembly) => StoryQualityReport;
}, dependencies: {
  generateWithAdapter?: RepairAdapter;
} = {}): Promise<StoryRepairOrchestrationResult> {
  if (!shouldAttemptStoryRepair({
    autoRepair: input.autoRepair,
    qualityReport: input.qualityReport,
    strictness: input.strictness,
  })) {
    return {
      storyResult: input.storyResult,
      qualityReport: input.qualityReport,
      repairTrace: [],
    };
  }

  const beforeScore = input.qualityReport.genre_score;
  const repairPromptPackage = buildStoryRepairPromptPackage({
    basePackage: input.basePromptPackage,
    story: input.story,
    qualityReport: input.qualityReport,
    blueprint: input.blueprint,
    strictness: input.strictness,
  });
  const repairAdapterResult = await (dependencies.generateWithAdapter ?? generateStoryWithAdapter)({
    pkg: repairPromptPackage,
    modelProfileId: input.modelProfileId,
  });
  const trace: StoryRepairTrace = {
    trace_id: `${input.storyId}--repair-1`,
    attempted: true,
    applied: false,
    reason: repairAdapterResult.reason ?? `provider:${repairAdapterResult.provider}`,
    model_profile_id: input.modelProfileId,
    before_genre_score: beforeScore,
    actions: input.qualityReport.repair_actions ?? [],
  };

  if (!repairAdapterResult.output) {
    return {
      storyResult: input.storyResult,
      qualityReport: input.qualityReport,
      repairTrace: [trace],
    };
  }

  if (!isModelSceneBreakdownCompatible(
    input.storyResult.scene_breakdown,
    repairAdapterResult.output.scene_breakdown,
  )) {
    trace.reason = 'repair_scene_breakdown_incompatible';
    return {
      storyResult: input.storyResult,
      qualityReport: input.qualityReport,
      repairTrace: [trace],
    };
  }

  const repairedResult = mergeModelOutputOntoLocalSkeleton(
    input.storyResult,
    repairAdapterResult.output,
    input.videoType,
    input.presentationStyle,
  );
  input.applyStoryAssembly(repairedResult, repairAdapterResult.output);
  const repairedQualityReport = input.evaluateStoryQuality(repairedResult);
  trace.after_genre_score = repairedQualityReport.genre_score;

  if ((trace.after_genre_score ?? 0) >= (beforeScore ?? 0)) {
    trace.applied = true;
    trace.reason = 'repair_applied';
    return {
      storyResult: repairedResult,
      qualityReport: repairedQualityReport,
      repairTrace: [trace],
    };
  }

  input.applyStoryAssembly(input.storyResult, input.sourceModelOutput);
  const restoredQualityReport = input.evaluateStoryQuality(input.storyResult);
  trace.reason = 'repair_score_not_improved';
  return {
    storyResult: input.storyResult,
    qualityReport: restoredQualityReport,
    repairTrace: [trace],
  };
}
