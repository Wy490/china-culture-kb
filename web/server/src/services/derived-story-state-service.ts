import type {
  GearsDeliveryPackage,
  GearsSegment,
  NarrativePatternId,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { validateGenreStoryQuality } from './genre-quality-service.js';
import { enrichStoryQualityReport } from './quality-workflow-service.js';
import { combineQualityReports, validateReferenceSafety } from './reference-quality-service.js';
import { validateStoryFamilyBaseQuality } from './story-family-quality-service.js';
import { attachBlueprintScenes } from './story-blueprint-service.js';
import { revalidateStoryDomainRevision } from '../platform/story-domain-revision-safety.js';

export class StoryDerivedStateValidationError extends Error {
  constructor(
    message: string,
    readonly story: StoryGenerateResult,
  ) {
    super(message);
    this.name = 'StoryDerivedStateValidationError';
  }
}

/**
 * Rebuilds every Story-level derivative that can be computed from canonical
 * narrative fields. Project-owned media ledgers remain outside this function;
 * Production Board and Seedance are rebuilt from the returned GEARS delivery.
 */
export async function rebuildDerivedStoryState(
  story: StoryGenerateResult,
  options: {
    narrativePatternIds?: NarrativePatternId[];
    revalidateDomainSafety?: boolean;
  } = {},
): Promise<StoryGenerateResult> {
  const storyBlueprint = story.story_blueprint
    ? attachBlueprintScenes(story.story_blueprint, story.scene_breakdown, story.storyId)
    : story.story_blueprint;
  let canonicalStory: StoryGenerateResult = {
    ...story,
    story_blueprint: storyBlueprint,
  };

  if (options.revalidateDomainSafety !== false) {
    const domainSafety = await revalidateStoryDomainRevision(canonicalStory);
    if (domainSafety) {
      canonicalStory = { ...canonicalStory, domain_safety: domainSafety };
      if (!domainSafety.passed) {
        throw new StoryDerivedStateValidationError(
          `Story failed the ${domainSafety.domain} safety boundary while rebuilding derived state`,
          canonicalStory,
        );
      }
    }
  }

  const gearsDelivery = ensureGearsDeliveryPackage(canonicalStory);
  canonicalStory = {
    ...canonicalStory,
    gears_segments: rebuildLegacyGearsSegments(canonicalStory, gearsDelivery),
    gears_delivery: gearsDelivery,
  };

  const structuralQuality = validateStoryFamilyBaseQuality(canonicalStory, {
    selectedEvent: canonicalStory.story_blueprint?.central_event ?? canonicalStory.title,
  });
  const referenceSafety = validateReferenceSafety({
    generated_text: canonicalStory.full_text,
    reference_trace: canonicalStory.reference_trace ?? [],
  });
  const baseQuality = combineQualityReports(structuralQuality, referenceSafety);
  const narrativePatternIds = options.narrativePatternIds
    ?? canonicalStory.creation_contract?.narrative_pattern_ids
    ?? [];
  let qualityReport: StoryQualityReport = validateGenreStoryQuality({
    story: canonicalStory,
    baseReport: baseQuality,
    blueprint: canonicalStory.story_blueprint,
    narrativePatternIds,
  });
  qualityReport = enrichStoryQualityReport({
    story: canonicalStory,
    qualityReport,
    narrativePatternIds,
    gearsDelivery,
  });

  return {
    ...canonicalStory,
    quality_report: {
      ...qualityReport,
      truth_mode: canonicalStory.truth_mode,
      material_sufficiency_report: canonicalStory.material_sufficiency,
    },
  };
}

export function rebuildLegacyGearsSegments(
  story: Pick<StoryGenerateResult, 'gears_segments' | 'scene_breakdown' | 'video_type' | 'presentation_style'>,
  delivery: Pick<GearsDeliveryPackage, 'units'>,
): GearsSegment[] {
  const sceneById = new Map(story.scene_breakdown.map(scene => [scene.scene_id, scene]));
  const unitsByScene = new Map<number, GearsDeliveryPackage['units']>();
  for (const unit of delivery.units) {
    const units = unitsByScene.get(unit.source_scene_id) ?? [];
    units.push(unit);
    unitsByScene.set(unit.source_scene_id, units);
  }
  const segmentCountByScene = new Map<number, number>();
  for (const segment of story.gears_segments) {
    segmentCountByScene.set(
      segment.source_scene_id,
      (segmentCountByScene.get(segment.source_scene_id) ?? 0) + 1,
    );
  }
  const nextIndexByScene = new Map<number, number>();

  return story.gears_segments.map((segment) => {
    const scene = sceneById.get(segment.source_scene_id);
    const units = unitsByScene.get(segment.source_scene_id) ?? [];
    if (!scene || units.length === 0) return segment;
    const index = nextIndexByScene.get(segment.source_scene_id) ?? 0;
    nextIndexByScene.set(segment.source_scene_id, index + 1);
    const segmentCount = segmentCountByScene.get(segment.source_scene_id) ?? 1;
    const matchedUnit = segmentCount === units.length ? units[index] : undefined;
    const scriptText = matchedUnit?.script_text
      ?? units.map(unit => unit.script_text).filter(Boolean).join('\n');
    const visualFocus = uniqueStrings([
      scene.location,
      scene.key_action,
      scene.visual_prompt,
    ]).slice(0, 3);

    return {
      ...segment,
      source_scene_id: scene.scene_id,
      duration_sec: matchedUnit?.suggested_duration_sec ?? scene.duration_sec,
      panel_count: matchedUnit?.suggested_panel_count ?? segment.panel_count,
      script_text: scriptText,
      purpose: scene.dramatic_function,
      visual_focus: visualFocus,
      cultural_constraints: uniqueStrings([
        ...segment.cultural_constraints,
        ...(scene.cultural_note ? [scene.cultural_note] : []),
        ...(matchedUnit?.constraint_note ?? []),
      ]),
      video_type: story.video_type,
      presentation_style: story.presentation_style,
      segment_prompt_hint: segment.segment_prompt_hint
        ?? matchedUnit?.segment_prompt_hint,
    };
  });
}

function uniqueStrings(items: Array<string | undefined>): string[] {
  return items
    .map(item => item?.trim())
    .filter((item): item is string => Boolean(item))
    .filter((item, index, all) => all.indexOf(item) === index);
}
