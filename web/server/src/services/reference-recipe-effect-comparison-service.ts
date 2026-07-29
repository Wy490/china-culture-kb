import type {
  StoryGenerateResult,
  StoryQualityReport,
  StoryRecipeEffectComparison,
  StoryRecipeEffectQualityDimension,
} from '@shared/types.js';

type ComparableStory = Pick<
  StoryGenerateResult,
  'storyId' | 'quality_report' | 'reference_generation_recipe'
>;

interface DimensionScore {
  score: number;
  evidence: string[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function mean(values: number[]): number {
  return values.length
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

function report(story: ComparableStory): StoryQualityReport {
  if (!story.quality_report) {
    throw new Error(`Story "${story.storyId}" is missing machine quality evidence`);
  }
  return story.quality_report;
}

function qualityDimensions(
  story: ComparableStory,
  role: 'baseline' | 'recipe_assisted',
): Record<StoryRecipeEffectQualityDimension['dimension'], DimensionScore> {
  const quality = report(story);
  const coreChecks = [
    quality.hasCentralEvent,
    quality.hasConflict,
    quality.hasProtagonistChoice,
    quality.hasSceneAction,
    quality.hasClimax,
    quality.hasEndingTheme,
    quality.isNotBiographySummary,
  ];
  const causalityChecks = [
    quality.hasCentralEvent,
    quality.hasConflict,
    quality.hasProtagonistChoice,
    quality.hasClimax,
  ];
  const familyChecks = quality.family_quality_report?.checks ?? [];
  const continuityScore = familyChecks.length
    ? familyChecks.filter(check => check.status === 'passed').length / familyChecks.length * 100
    : quality.quality_gates?.gears_contract_gate.passed ? 100 : 0;
  const visualizationSignals = [
    quality.hasSceneAction ? 100 : 0,
    quality.gears_readiness_report?.readiness_score,
  ].filter((value): value is number => typeof value === 'number');
  const contractComplete = role === 'baseline'
    ? !story.reference_generation_recipe
    : Boolean(
      story.reference_generation_recipe?.schema_version === 'reference-generation-recipe/v1'
      && story.reference_generation_recipe.payload_sha256,
    );

  return {
    structure: {
      score: mean([
        coreChecks.filter(Boolean).length / coreChecks.length * 100,
        quality.genre_score ?? (quality.passed ? 100 : 0),
        quality.pattern_quality_report?.pattern_score
          ?? (quality.passed ? 100 : 0),
      ]),
      evidence: [
        `core_story_checks=${coreChecks.filter(Boolean).length}/${coreChecks.length}`,
        `genre_score=${quality.genre_score ?? 'unavailable'}`,
        `pattern_score=${quality.pattern_quality_report?.pattern_score ?? 'unavailable'}`,
      ],
    },
    causality: {
      score: round(causalityChecks.filter(Boolean).length / causalityChecks.length * 100),
      evidence: [
        `central_event=${quality.hasCentralEvent}`,
        `conflict=${quality.hasConflict}`,
        `protagonist_choice=${quality.hasProtagonistChoice}`,
        `climax=${quality.hasClimax}`,
      ],
    },
    visualization: {
      score: mean(visualizationSignals),
      evidence: [
        `scene_action=${quality.hasSceneAction}`,
        `gears_readiness=${quality.gears_readiness_report?.readiness_score ?? 'unavailable'}`,
      ],
    },
    continuity: {
      score: round(continuityScore),
      evidence: familyChecks.length
        ? [`family_quality_checks=${familyChecks.filter(check => check.status === 'passed').length}/${familyChecks.length}`]
        : [`gears_contract_gate=${quality.quality_gates?.gears_contract_gate.passed ?? false}`],
    },
    contract_completeness: {
      score: contractComplete ? 100 : 0,
      evidence: [
        role === 'baseline'
          ? `recipe_absent_as_required=${!story.reference_generation_recipe}`
          : `canonical_recipe_contract_present=${contractComplete}`,
      ],
    },
  };
}

export function buildStoryRecipeEffectComparison(input: {
  baseline: ComparableStory;
  recipeAssisted: ComparableStory;
}): StoryRecipeEffectComparison {
  const recipe = input.recipeAssisted.reference_generation_recipe;
  if (!recipe) {
    throw new Error('Recipe-assisted story is missing its canonical recipe contract');
  }
  if (input.baseline.reference_generation_recipe) {
    throw new Error('Recipe comparison baseline must remain recipe-free');
  }
  const baselineDimensions = qualityDimensions(input.baseline, 'baseline');
  const assistedDimensions = qualityDimensions(input.recipeAssisted, 'recipe_assisted');
  const dimensions = (Object.keys(baselineDimensions) as Array<
    StoryRecipeEffectQualityDimension['dimension']
  >).map(dimension => ({
    dimension,
    baseline_score: baselineDimensions[dimension].score,
    recipe_assisted_score: assistedDimensions[dimension].score,
    delta: round(assistedDimensions[dimension].score - baselineDimensions[dimension].score),
    evidence: [
      ...baselineDimensions[dimension].evidence.map(item => `baseline:${item}`),
      ...assistedDimensions[dimension].evidence.map(item => `recipe_assisted:${item}`),
    ],
  }));
  const baselineMachineScore = mean(dimensions.map(item => item.baseline_score));
  const assistedMachineScore = mean(dimensions.map(item => item.recipe_assisted_score));
  const aggregateDelta = round(assistedMachineScore - baselineMachineScore);
  const improvedDimensions = dimensions.filter(item => item.delta >= 3).length;
  const regressedDimensions = dimensions.filter(item => item.delta <= -3).length;
  const machineVerdict = aggregateDelta >= 3 && regressedDimensions === 0
    ? 'improved' as const
    : aggregateDelta <= -3 && improvedDimensions === 0
      ? 'regressed' as const
      : improvedDimensions > 0 || regressedDimensions > 0
        ? 'mixed' as const
        : 'no_material_change' as const;

  return {
    schema_version: 'story-recipe-effect-comparison/v1',
    status: 'completed',
    baseline_story_id: input.baseline.storyId,
    recipe_assisted_story_id: input.recipeAssisted.storyId,
    recipe,
    baseline_machine_score: baselineMachineScore,
    recipe_assisted_machine_score: assistedMachineScore,
    aggregate_delta: aggregateDelta,
    dimensions,
    machine_verdict: machineVerdict,
    boundary: {
      same_input_verified: true,
      machine_comparison_only: true,
      human_preference_measured: false,
      legal_conclusion_reached: false,
      production_credit_granted: false,
    },
  };
}
