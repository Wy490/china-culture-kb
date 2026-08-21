import { resolve } from 'node:path';
import { ErrorCodes, VIDEO_TYPE_CONFIG } from '@shared/types.js';
import type {
  KnowledgePack,
  MaterialPack,
  StoryGenerateRequest,
} from '@shared/types.js';
import { buildStoryPriorityInstruction, resolveLegacyGenerationType, resolveStoryNarrativePatternIds, resolveStoryStructureType, resolveStoryVideoType } from '../../platform/story-generation-policy.js';
import { storyRepositoryRoot } from '../../platform/story-storage-root.js';
import { getStory } from '../../platform/story-read-service.js';
import { buildAdaptationAnalysis } from '../../services/adaptation-analysis-service.js';
import {
  buildCreationContract,
  buildMaterialSufficiencyReport,
  knowledgePackFromMaterialPack,
  materialPackFromKnowledgePack,
  resolveCreationUseCase,
  resolveTruthMode,
} from '../../services/creation-contract-service.js';
import { selectCentralEvent } from '../../services/dramatic-story.js';
import { resolveGenreStoryMatrix } from '../../services/genre-story-profiles.js';
import { resolveStoryGenerationModelProfile } from '../../services/model-catalog.js';
import { getProductionMaterialPack } from '../../services/production-material-pack-service.js';
import { buildProductionMaterialReadinessReport } from '../../services/production-material-readiness-service.js';
import { validateReferenceBaselineCompatibility } from '../../services/reference-baseline-comparison-service.js';
import { resolveReferenceGenerationRecipeContract } from '../../services/reference-generation-recipe-service.js';
import { resolveReferenceGenerationContext } from '../../services/reference-generation-bridge-service.js';
import { buildStoryBlueprint } from '../../services/story-blueprint-service.js';
import { buildStoryGenreComposition } from '../../services/story-genre-composition-service.js';
import { buildStoryDomainPackContext } from '../../services/story-domain-pack-trace-service.js';
import { buildWritingCapabilityShadowPreparationPlan } from '../../services/writing-capability-rollout-service.js';
import { buildWritingCapabilityRuntimeResolution } from '../../services/writing-capability-runtime-service.js';
import { buildChinaCultureSingleEntryKnowledgePack } from './story-knowledge-pack-service.js';
import { resolveStoryKnowledgePreparation } from './story-knowledge-preparation-service.js';
import { extractChinaCultureBoldEvents } from './story-planning-service.js';
import { resolveChinaCultureStorySource } from './story-source-service.js';

export interface ChinaCultureStoryGenerationPreparationOptions {
  storyKnowledge?: {
    enabled: true;
    evidenceOverlay?: unknown;
  };
  writingCapability?: {
    enabled: true;
    requestedCapabilityIds: readonly string[];
    rolloutPolicy?: unknown;
    adapter?: unknown;
    runtimeActivation?: unknown;
  };
}

export async function prepareChinaCultureStoryGeneration(
  request: StoryGenerateRequest,
  options: ChinaCultureStoryGenerationPreparationOptions = {},
) {
  const {
    original_user_query,
    selected_event,
    target_video_duration,
    tone,
    outline,
    knowledge_pack,
    material_pack,
  } = request;
  const toneWithPriority = [tone, buildStoryPriorityInstruction(request.story_priority)]
    .filter((item): item is string => Boolean(item))
    .join('\n');
  const localTone = tone ?? '';
  const videoType = resolveStoryVideoType(request);
  const writingCapabilityShadowPlan = options.writingCapability?.enabled
    ? buildWritingCapabilityShadowPreparationPlan({
      videoType,
      requestedCapabilityIds: options.writingCapability.requestedCapabilityIds,
      rolloutPolicy: options.writingCapability.rolloutPolicy,
      adapter: options.writingCapability.adapter,
    })
    : undefined;
  const writingCapabilityRuntimeResolution = options.writingCapability?.enabled
    && options.writingCapability.runtimeActivation !== undefined
    ? buildWritingCapabilityRuntimeResolution({
      videoType,
      requestedCapabilityIds: options.writingCapability.requestedCapabilityIds,
      activation: options.writingCapability.runtimeActivation,
      rolloutPolicy: options.writingCapability.rolloutPolicy,
      adapter: options.writingCapability.adapter,
    })
    : undefined;
  const generationType = request.generation_type ?? resolveLegacyGenerationType(videoType);
  const presentationStyle = request.presentation_style
    ?? VIDEO_TYPE_CONFIG[videoType].default_presentation_style;
  const targetDuration = target_video_duration ?? VIDEO_TYPE_CONFIG[videoType].default_duration;
  const productionMaterialPack = getProductionMaterialPack(videoType, { sourceDomain: 'china_culture' });
  const referenceGenerationRecipeResolution =
    resolveReferenceGenerationRecipeContract({
      request,
      videoType,
      presentationStyle,
    });
  if (!referenceGenerationRecipeResolution.ok) {
    return {
      ok: false as const,
      code: ErrorCodes.VALIDATION_ERROR,
      message: referenceGenerationRecipeResolution.message,
      details: referenceGenerationRecipeResolution.details,
    };
  }

  const sourceResolution = await resolveChinaCultureStorySource(request);
  if (!sourceResolution.ok) return sourceResolution;
  const { primaryEntryName, entry } = sourceResolution;
  const storyKnowledgePreparation = options.storyKnowledge?.enabled
    ? resolveStoryKnowledgePreparation(
      entry,
      options.storyKnowledge.evidenceOverlay,
    )
    : undefined;

  let knowledgePackToUse: KnowledgePack | undefined = knowledge_pack;
  let materialPackToUse: MaterialPack | undefined = material_pack;
  if (!knowledgePackToUse && materialPackToUse) {
    knowledgePackToUse = knowledgePackFromMaterialPack(materialPackToUse);
  }
  if (!knowledgePackToUse || knowledgePackToUse.primary_entries.length === 0) {
    knowledgePackToUse = buildChinaCultureSingleEntryKnowledgePack(entry, {
      selectedEvent: selected_event,
      originalUserQuery: original_user_query,
      outline,
      videoType,
    });
  }
  if (!materialPackToUse) {
    materialPackToUse = materialPackFromKnowledgePack(knowledgePackToUse, request);
  }

  const storyStructure = resolveStoryStructureType(request, videoType, {
    historical_person_entry: entry.type === '历史人物',
  });
  const referenceGenerationResolution = await resolveReferenceGenerationContext({
    repoRoot: process.env.REFERENCE_LIBRARY_REPO_ROOT?.trim()
      ? resolve(process.env.REFERENCE_LIBRARY_REPO_ROOT)
      : storyRepositoryRoot(),
    stylePackIds: request.style_pack_ids,
    similarityEvidenceIds: request.reference_similarity_evidence_ids,
    videoType,
    presentationStyle,
    storyStructure,
  });
  if (!referenceGenerationResolution.ok) {
    return {
      ok: false as const,
      code: ErrorCodes.VALIDATION_ERROR,
      message: referenceGenerationResolution.message,
      details: referenceGenerationResolution.details,
    };
  }
  const requestedNarrativePatternIds = resolveStoryNarrativePatternIds(request);
  const creationUseCase = resolveCreationUseCase(request, videoType);
  const truthMode = resolveTruthMode(request, creationUseCase, videoType);
  const genreMatrix = resolveGenreStoryMatrix({
    videoType,
    creationUseCase,
    truthMode,
    storyStructure,
    narrativePatternIds: requestedNarrativePatternIds,
  });
  const narrativePatternIds = genreMatrix.resolved_narrative_pattern_ids;
  const genreComposition = buildStoryGenreComposition({
    entry,
    videoType,
    truthMode,
    requestedSourceKinds: request.cultural_source_kinds,
    narrativePatternIds,
  });
  const materialSufficiency = buildMaterialSufficiencyReport({
    materialPack: materialPackToUse,
    creationUseCase,
    truthMode,
  });
  const scriptReadiness = materialSufficiency.stage_reports?.find(
    report => report.stage === 'script_ready',
  );
  if (
    request.material_readiness_policy === 'require_script_ready'
    && scriptReadiness?.status !== 'ready'
  ) {
    const unresolvedConflictNeedIds = materialPackToUse.missing_needs
      .filter(need => /(?:冲突|矛盾|互斥|conflict)/iu.test(
        `${need.need_id} ${need.label} ${need.message}`,
      ))
      .map(need => need.need_id);
    return {
      ok: false as const,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Story material is not script-ready under the strict material policy',
      details: {
        schema_version: 'story-material-readiness-gate/v1' as const,
        policy: request.material_readiness_policy,
        stage: 'script_ready' as const,
        status: scriptReadiness?.status ?? 'blocked',
        blocking_item_ids: scriptReadiness?.missing_items
          .filter(item => item.blocking_level === 'blocking')
          .map(item => item.item_id) ?? [],
        risk_item_ids: scriptReadiness?.missing_items
          .filter(item => item.blocking_level === 'risk')
          .map(item => item.item_id) ?? [],
        unresolved_conflict_need_ids: unresolvedConflictNeedIds,
        recommended_next_questions: materialSufficiency.recommended_next_questions,
      },
    };
  }
  const creationContract = buildCreationContract({
    request,
    materialSufficiency,
    creationUseCase,
    truthMode,
    videoType,
    presentationStyle,
    storyStructure,
    narrativePatternIds,
  });
  const adaptationAnalysis = request.source_material_mode === 'adapt_user_novel'
    ? buildAdaptationAnalysis(original_user_query ?? outline)
    : undefined;
  const domainPackContext = buildStoryDomainPackContext(knowledgePackToUse);
  const productionMaterialReadiness = buildProductionMaterialReadinessReport({
    productionMaterialPack,
    materialPack: materialPackToUse,
    sourceDomain: 'china_culture',
    domainPackContext,
    contextText: [
      original_user_query,
      outline,
      selected_event,
      entry.name,
      entry.type,
      entry.region,
      entry.summary,
      entry.story,
      entry.culturalSignificance,
      entry.keywords.join(' '),
    ].filter((item): item is string => Boolean(item)).join('\n'),
  });
  const selectedModelProfile = resolveStoryGenerationModelProfile(request.model_profile_id);
  const boldEvents = extractChinaCultureBoldEvents(entry.story);
  const centralEvent = selectCentralEvent(entry, boldEvents, videoType, selected_event);
  let referenceBaselineStory;
  if (request.reference_baseline_story_id) {
    if (
      !referenceGenerationResolution.context
      && !referenceGenerationRecipeResolution.context
    ) {
      return {
        ok: false as const,
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'reference_baseline_story_id requires an applied style pack or generation recipe',
        details: {
          schema_version: 'story-reference-baseline-gate/v1' as const,
          status: 'blocked' as const,
          issue_code: 'assisted_generation_required' as const,
          baseline_story_id: request.reference_baseline_story_id,
        },
      };
    }
    const baselineResult = await getStory(request.reference_baseline_story_id);
    if (!baselineResult.ok || !baselineResult.data) {
      return {
        ok: false as const,
        code: ErrorCodes.VALIDATION_ERROR,
        message: `Reference baseline story "${request.reference_baseline_story_id}" is unavailable`,
        details: {
          schema_version: 'story-reference-baseline-gate/v1' as const,
          status: 'blocked' as const,
          issue_code: 'baseline_story_unavailable' as const,
          baseline_story_id: request.reference_baseline_story_id,
        },
      };
    }
    const mismatches = validateReferenceBaselineCompatibility({
      baseline: baselineResult.data,
      expected: {
        source_entry: primaryEntryName,
        original_user_query: original_user_query ?? outline,
        video_type: videoType,
        presentation_style: presentationStyle,
        story_structure: storyStructure,
        model_profile_id: selectedModelProfile.id,
        central_event: centralEvent,
        target_duration: targetDuration,
        creation_use_case: creationUseCase,
        truth_mode: truthMode,
        client_type: request.client_type,
        target_audience: request.target_audience,
        communication_goal: request.communication_goal,
      },
    });
    if (mismatches.length) {
      return {
        ok: false as const,
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Reference baseline story is not comparable with the current generation input',
        details: {
          schema_version: 'story-reference-baseline-gate/v1' as const,
          status: 'blocked' as const,
          issue_code: 'baseline_story_incompatible' as const,
          baseline_story_id: request.reference_baseline_story_id,
          mismatched_dimensions: mismatches,
        },
      };
    }
    referenceBaselineStory = baselineResult.data;
  }
  const preliminaryStoryBlueprint = buildStoryBlueprint({
    entry,
    videoType,
    presentationStyle,
    storyStructure,
    targetDuration,
    centralEvent,
    knowledgePack: knowledgePackToUse,
    domainPackContext,
    narrativePatternIds,
    creationContract,
    materialSufficiency,
    genreMatrix,
    writingCapabilityContext: writingCapabilityRuntimeResolution?.status === 'active'
      ? writingCapabilityRuntimeResolution.context
      : undefined,
    genreComposition,
  });

  return {
    ok: true as const,
    primaryEntryName,
    entry,
    toneWithPriority,
    localTone,
    videoType,
    generationType,
    presentationStyle,
    targetDuration,
    productionMaterialPack,
    knowledgePackToUse,
    materialPackToUse,
    storyStructure,
    referenceGenerationRecipe:
      referenceGenerationRecipeResolution.context,
    referenceGenerationContext: referenceGenerationResolution.context,
    referenceSimilarityEvidence:
      referenceGenerationResolution.similarityEvidence,
    referenceBaselineStory,
    narrativePatternIds,
    creationUseCase,
    truthMode,
    genreMatrix,
    genreComposition,
    materialSufficiency,
    creationContract,
    adaptationAnalysis,
    productionMaterialReadiness,
    selectedModelProfile,
    centralEvent,
    preliminaryStoryBlueprint,
    ...(storyKnowledgePreparation ? { storyKnowledgePreparation } : {}),
    ...(writingCapabilityShadowPlan ? { writingCapabilityShadowPlan } : {}),
    ...(writingCapabilityRuntimeResolution
      ? { writingCapabilityRuntimeResolution }
      : {}),
  };
}

export type PreparedChinaCultureStoryGeneration = Extract<
  Awaited<ReturnType<typeof prepareChinaCultureStoryGeneration>>,
  { ok: true }
>;
