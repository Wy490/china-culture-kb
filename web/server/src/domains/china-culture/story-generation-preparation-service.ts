import { ErrorCodes, VIDEO_TYPE_CONFIG } from '@shared/types.js';
import type {
  KnowledgePack,
  MaterialPack,
  StoryGenerateRequest,
} from '@shared/types.js';
import { buildStoryPriorityInstruction, resolveLegacyGenerationType, resolveStoryNarrativePatternIds, resolveStoryStructureType, resolveStoryVideoType } from '../../platform/story-generation-policy.js';
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
import { buildStoryBlueprint } from '../../services/story-blueprint-service.js';
import { buildChinaCultureSingleEntryKnowledgePack } from './story-knowledge-pack-service.js';
import { extractChinaCultureBoldEvents } from './story-planning-service.js';
import { resolveChinaCultureStorySource } from './story-source-service.js';

export async function prepareChinaCultureStoryGeneration(request: StoryGenerateRequest) {
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
  const generationType = request.generation_type ?? resolveLegacyGenerationType(videoType);
  const presentationStyle = request.presentation_style
    ?? VIDEO_TYPE_CONFIG[videoType].default_presentation_style;
  const targetDuration = target_video_duration ?? VIDEO_TYPE_CONFIG[videoType].default_duration;
  const productionMaterialPack = getProductionMaterialPack(videoType, { sourceDomain: 'china_culture' });

  const sourceResolution = await resolveChinaCultureStorySource(request);
  if (!sourceResolution.ok) return sourceResolution;
  const { primaryEntryName, entry } = sourceResolution;

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
    });
  }
  if (!materialPackToUse) {
    materialPackToUse = materialPackFromKnowledgePack(knowledgePackToUse, request);
  }

  const storyStructure = resolveStoryStructureType(request, videoType, {
    historical_person_entry: entry.type === '历史人物',
  });
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
  const productionMaterialReadiness = buildProductionMaterialReadinessReport({
    productionMaterialPack,
    materialPack: materialPackToUse,
    sourceDomain: 'china_culture',
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
  const preliminaryStoryBlueprint = buildStoryBlueprint({
    entry,
    videoType,
    presentationStyle,
    storyStructure,
    targetDuration,
    centralEvent,
    knowledgePack: knowledgePackToUse,
    narrativePatternIds,
    creationContract,
    materialSufficiency,
    genreMatrix,
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
    preliminaryStoryBlueprint,
  };
}

export type PreparedChinaCultureStoryGeneration = Extract<
  Awaited<ReturnType<typeof prepareChinaCultureStoryGeneration>>,
  { ok: true }
>;
