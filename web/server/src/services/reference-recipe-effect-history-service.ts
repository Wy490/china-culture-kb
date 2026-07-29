import type {
  PresentationStyle,
  ReferenceGenerationRecipeContract,
  StoryGenerateResult,
  StoryRecipeEffectComparison,
  StoryRecipeEffectComparisonHistory,
  StoryRecipeEffectComparisonHistoryFilters,
  StoryRecipeEffectComparisonHistoryItem,
  StoryRecipeEffectDimensionId,
  StoryRecipeEffectMachineVerdict,
  StoryRecipeEffectRecipeTrend,
  VideoType,
} from '@shared/types.js';
import { getProject, listProjects } from './project-service.js';

const DIMENSION_IDS: StoryRecipeEffectDimensionId[] = [
  'structure',
  'causality',
  'visualization',
  'continuity',
  'contract_completeness',
];
const VERDICTS: StoryRecipeEffectMachineVerdict[] = [
  'improved',
  'mixed',
  'no_material_change',
  'regressed',
];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface StoryRecipeEffectComparisonHistoryRecord {
  project_id: string;
  project_title: string;
  updated_at: string;
  story: Pick<
    StoryGenerateResult,
    | 'storyId'
    | 'source_entry'
    | 'video_type'
    | 'presentation_style'
    | 'reference_generation_recipe'
    | 'recipe_effect_comparison'
  >;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function mean(values: number[]): number {
  return values.length
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

function verdictCounts(
  comparisons: StoryRecipeEffectComparison[],
): Record<StoryRecipeEffectMachineVerdict, number> {
  return {
    improved: comparisons.filter(item => item.machine_verdict === 'improved').length,
    mixed: comparisons.filter(item => item.machine_verdict === 'mixed').length,
    no_material_change: comparisons.filter(
      item => item.machine_verdict === 'no_material_change',
    ).length,
    regressed: comparisons.filter(item => item.machine_verdict === 'regressed').length,
  };
}

function hasCanonicalBoundary(comparison: StoryRecipeEffectComparison): boolean {
  return comparison.boundary?.same_input_verified === true
    && comparison.boundary.machine_comparison_only === true
    && comparison.boundary.human_preference_measured === false
    && comparison.boundary.legal_conclusion_reached === false
    && comparison.boundary.production_credit_granted === false;
}

function hasCanonicalDimensions(comparison: StoryRecipeEffectComparison): boolean {
  if (comparison.dimensions.length !== DIMENSION_IDS.length) return false;
  const dimensions = new Set(comparison.dimensions.map(item => item.dimension));
  if (dimensions.size !== DIMENSION_IDS.length) return false;
  if (!DIMENSION_IDS.every(dimension => dimensions.has(dimension))) return false;
  return comparison.dimensions.every(item => (
    Number.isFinite(item.baseline_score)
    && Number.isFinite(item.recipe_assisted_score)
    && Number.isFinite(item.delta)
  ));
}

function isCanonicalComparison(
  record: StoryRecipeEffectComparisonHistoryRecord,
): record is StoryRecipeEffectComparisonHistoryRecord & {
  story: StoryRecipeEffectComparisonHistoryRecord['story'] & {
    reference_generation_recipe: ReferenceGenerationRecipeContract;
    recipe_effect_comparison: StoryRecipeEffectComparison;
  };
} {
  const comparison = record.story.recipe_effect_comparison;
  const recipe = record.story.reference_generation_recipe;
  if (!comparison || !recipe) return false;
  return comparison.schema_version === 'story-recipe-effect-comparison/v1'
    && comparison.status === 'completed'
    && comparison.recipe_assisted_story_id === record.story.storyId
    && comparison.recipe.recipe_id === recipe.recipe_id
    && comparison.recipe.recipe_version === recipe.recipe_version
    && comparison.recipe.payload_sha256 === recipe.payload_sha256
    && Number.isFinite(comparison.baseline_machine_score)
    && Number.isFinite(comparison.recipe_assisted_machine_score)
    && Number.isFinite(comparison.aggregate_delta)
    && VERDICTS.includes(comparison.machine_verdict)
    && hasCanonicalBoundary(comparison)
    && hasCanonicalDimensions(comparison);
}

function toHistoryItem(
  record: StoryRecipeEffectComparisonHistoryRecord & {
    story: StoryRecipeEffectComparisonHistoryRecord['story'] & {
      recipe_effect_comparison: StoryRecipeEffectComparison;
    };
  },
): StoryRecipeEffectComparisonHistoryItem {
  return {
    schema_version: 'story-recipe-effect-comparison-history-item/v1',
    project_id: record.project_id,
    project_title: record.project_title,
    story_id: record.story.storyId,
    source_entry: record.story.source_entry,
    video_type: record.story.video_type,
    presentation_style: record.story.presentation_style,
    updated_at: record.updated_at,
    comparison: record.story.recipe_effect_comparison,
  };
}

function buildRecipeTrend(
  items: StoryRecipeEffectComparisonHistoryItem[],
): StoryRecipeEffectRecipeTrend {
  const comparisons = items.map(item => item.comparison);
  const recipe = comparisons[0].recipe;
  return {
    recipe,
    comparison_count: comparisons.length,
    average_baseline_machine_score: mean(
      comparisons.map(item => item.baseline_machine_score),
    ),
    average_recipe_assisted_machine_score: mean(
      comparisons.map(item => item.recipe_assisted_machine_score),
    ),
    average_aggregate_delta: mean(comparisons.map(item => item.aggregate_delta)),
    verdict_counts: verdictCounts(comparisons),
    dimensions: DIMENSION_IDS.map(dimension => {
      const dimensions = comparisons.map(comparison => (
        comparison.dimensions.find(item => item.dimension === dimension)!
      ));
      return {
        dimension,
        comparison_count: dimensions.length,
        average_baseline_score: mean(dimensions.map(item => item.baseline_score)),
        average_recipe_assisted_score: mean(
          dimensions.map(item => item.recipe_assisted_score),
        ),
        average_delta: mean(dimensions.map(item => item.delta)),
      };
    }),
  };
}

function normalizedFilters(
  filters: StoryRecipeEffectComparisonHistoryFilters,
): StoryRecipeEffectComparisonHistory['filters'] {
  const requestedLimit = Number.isFinite(filters.limit)
    ? Math.trunc(filters.limit!)
    : DEFAULT_LIMIT;
  return {
    recipe_id: filters.recipe_id ?? null,
    video_type: filters.video_type ?? null,
    machine_verdict: filters.machine_verdict ?? null,
    limit: Math.min(MAX_LIMIT, Math.max(1, requestedLimit)),
  };
}

export function buildStoryRecipeEffectComparisonHistory(
  records: StoryRecipeEffectComparisonHistoryRecord[],
  requestedFilters: StoryRecipeEffectComparisonHistoryFilters = {},
): StoryRecipeEffectComparisonHistory {
  const filters = normalizedFilters(requestedFilters);
  const invalidComparisonCount = records.filter(record => (
    Boolean(record.story.recipe_effect_comparison) && !isCanonicalComparison(record)
  )).length;
  const matched = records
    .filter(isCanonicalComparison)
    .map(toHistoryItem)
    .filter(item => (
      (!filters.recipe_id || item.comparison.recipe.recipe_id === filters.recipe_id)
      && (!filters.video_type || item.video_type === filters.video_type)
      && (
        !filters.machine_verdict
        || item.comparison.machine_verdict === filters.machine_verdict
      )
    ))
    .sort((a, b) => (
      b.updated_at.localeCompare(a.updated_at)
      || a.project_id.localeCompare(b.project_id)
    ));
  const trendGroups = new Map<string, StoryRecipeEffectComparisonHistoryItem[]>();
  for (const item of matched) {
    const key = item.comparison.recipe.recipe_id;
    trendGroups.set(key, [...(trendGroups.get(key) ?? []), item]);
  }
  const trends = [...trendGroups.values()]
    .map(buildRecipeTrend)
    .sort((a, b) => (
      b.comparison_count - a.comparison_count
      || a.recipe.recipe_id.localeCompare(b.recipe.recipe_id)
    ));
  const comparisons = matched.map(item => item.comparison);
  const items = matched.slice(0, filters.limit);

  return {
    schema_version: 'story-recipe-effect-comparison-history/v1',
    filters,
    summary: {
      matched_comparison_count: matched.length,
      returned_comparison_count: items.length,
      skipped_invalid_comparison_count: invalidComparisonCount,
      average_aggregate_delta: comparisons.length
        ? mean(comparisons.map(item => item.aggregate_delta))
        : null,
      verdict_counts: verdictCounts(comparisons),
    },
    trends,
    items,
    boundary: {
      source_snapshot: 'current_project_versions',
      machine_comparison_only: true,
      human_preference_measured: false,
      causal_effect_proven: false,
      legal_conclusion_reached: false,
      production_credit_granted: false,
    },
  };
}

export async function collectStoryRecipeEffectComparisonHistoryRecords(
): Promise<StoryRecipeEffectComparisonHistoryRecord[]> {
  const projects = await listProjects();
  if (!projects.ok || !projects.data) return [];
  const details = await Promise.all(
    projects.data.map(project => getProject(project.project_id)),
  );
  return details.flatMap((detail, index) => {
    if (!detail.ok || !detail.data) return [];
    const project = projects.data![index];
    const story = detail.data.current_story;
    return [{
      project_id: project.project_id,
      project_title: project.title,
      updated_at: project.updated_at,
      story: {
        storyId: story.storyId,
        source_entry: story.source_entry,
        video_type: story.video_type as VideoType,
        presentation_style: story.presentation_style as PresentationStyle,
        reference_generation_recipe: story.reference_generation_recipe,
        recipe_effect_comparison: story.recipe_effect_comparison,
      },
    }];
  });
}
