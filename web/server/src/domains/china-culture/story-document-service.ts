import type {
  StoryBlueprint,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { buildInitialGearsWebhookStatus } from '../../platform/generated-story-persistence.js';
import type { StoryAssembly } from '../../platform/story-model-output-merge.js';
import type { StoryGenerationModelResult } from '../../services/story-generation-model.js';
import type { PreparedChinaCultureStoryGeneration } from './story-generation-preparation-service.js';
import { buildChinaCultureStorySupplementTasks } from './story-supplement-task-service.js';
import { deriveChinaCultureTypeSpecificStoryFields } from './story-type-specific-fields-service.js';

export type ChinaCultureGeneratedStoryDocument = StoryGenerateResult & {
  _request_meta: Record<string, unknown>;
};

export function buildChinaCultureGeneratedStoryDocument(input: {
  request: StoryGenerateRequest;
  sourceDomain?: string;
  storyId: string;
  createdAt: string;
  preparation: PreparedChinaCultureStoryGeneration;
  storyResult: StoryAssembly;
  finalStoryBlueprint: StoryBlueprint;
  baseQualityReport: StoryQualityReport;
  adapterResult: StoryGenerationModelResult;
  generationMode: StoryGenerateResult['generation_mode'];
  generationUsedFallback: boolean;
  referenceTrace: StoryGenerateResult['reference_trace'];
  memoryMosaicSeed: StoryGenerateResult['memory_mosaic_seed'];
}): ChinaCultureGeneratedStoryDocument {
  const {
    primaryEntryName,
    entry,
    toneWithPriority,
    videoType,
    generationType,
    presentationStyle,
    targetDuration,
    productionMaterialPack,
    knowledgePackToUse,
    materialPackToUse,
    storyStructure,
    narrativePatternIds,
    creationUseCase,
    truthMode,
    genreMatrix,
    materialSufficiency,
    creationContract,
    adaptationAnalysis,
    productionMaterialReadiness,
    selectedModelProfile,
    centralEvent,
  } = input.preparation;
  const gearsSegments = input.request.output_gears_segments !== false
    ? input.storyResult.gears_segments
    : [];
  const supplementTasks = buildChinaCultureStorySupplementTasks(
    knowledgePackToUse,
    materialSufficiency,
    productionMaterialReadiness,
    { storyId: input.storyId, createdAt: input.createdAt },
  );

  return {
    storyId: input.storyId,
    sourceDomain: input.sourceDomain,
    title: input.storyResult.title,
    model_profile_id: selectedModelProfile.id,
    requested_model_profile_id: input.request.model_profile_id,
    effective_engine: input.generationMode === 'external_model'
      ? 'external_model'
      : input.generationMode === 'local_fallback'
        ? 'local_fallback'
        : 'local_story_engine',
    external_model_call_performed: input.generationMode === 'external_model',
    generation_reason: input.adapterResult.reason,
    generation_source: input.generationMode === 'external_model'
      ? selectedModelProfile.label
      : input.generationMode === 'local_fallback'
        ? '本地引擎 (未使用所选模型)'
        : '本地引擎',
    generation_mode: input.generationMode,
    generation_used_fallback: input.generationUsedFallback,
    generation_type: generationType,
    video_type: videoType,
    presentation_style: presentationStyle,
    source_entry: primaryEntryName,
    original_user_query: input.request.original_user_query ?? input.request.outline ?? undefined,
    logline: input.storyResult.logline,
    theme: input.storyResult.theme,
    full_text: input.storyResult.full_text,
    scene_breakdown: input.storyResult.scene_breakdown,
    gears_segments: gearsSegments,
    gears_segments_url: `/api/stories/${input.storyId}/gears-segments`,
    cultural_constraints: input.storyResult.cultural_constraints,
    credibility_note: input.storyResult.credibility_note,
    story_structure: storyStructure,
    story_blueprint: input.finalStoryBlueprint,
    creation_use_case: creationUseCase,
    truth_mode: truthMode,
    client_type: input.request.client_type,
    target_audience: input.request.target_audience,
    communication_goal: input.request.communication_goal,
    creation_contract: creationContract,
    material_pack: materialPackToUse,
    material_sufficiency: materialSufficiency,
    production_material_pack: productionMaterialPack,
    production_material_readiness: productionMaterialReadiness,
    reference_trace: input.referenceTrace,
    memory_mosaic_seed: input.memoryMosaicSeed,
    knowledge_pack: knowledgePackToUse,
    adaptation_analysis: adaptationAnalysis,
    supplement_tasks: supplementTasks,
    quality_report: input.baseQualityReport,
    gears_webhook: buildInitialGearsWebhookStatus(),
    characters: input.storyResult.characters,
    act_structure: input.storyResult.act_structure,
    protagonist_arc: input.storyResult.protagonist_arc,
    ...deriveChinaCultureTypeSpecificStoryFields({
      videoType,
      storyResult: input.storyResult,
      modelOutput: input.adapterResult.output,
      entry,
    }),
    _request_meta: {
      selected_event: centralEvent,
      target_video_duration: targetDuration,
      tone: toneWithPriority || null,
      output_gears_segments: input.request.output_gears_segments ?? true,
      entry_type: entry.type,
      video_type: videoType,
      presentation_style: presentationStyle,
      created_at: input.createdAt,
      model_provider: input.adapterResult.provider,
      model_used_fallback: input.adapterResult.used_fallback,
      model_fallback_reason: input.adapterResult.reason,
      genre_strictness: input.request.genre_strictness ?? 'balanced',
      auto_repair: input.request.auto_repair ?? false,
      story_priority: input.request.story_priority ?? 'balanced',
      narrative_pattern_ids: narrativePatternIds,
      creation_use_case: creationUseCase,
      truth_mode: truthMode,
      material_sufficiency: materialSufficiency,
      production_material_pack: productionMaterialPack,
      production_material_readiness: productionMaterialReadiness,
      creation_contract: creationContract,
      genre_matrix: genreMatrix,
      source_material_mode: input.request.source_material_mode ?? 'generate_from_knowledge',
      adaptation_analysis: adaptationAnalysis,
      localized_target_region: input.request.localized_target_region ?? null,
      localization_mode: input.request.localization_mode ?? 'allow_related_influence',
    },
  };
}
