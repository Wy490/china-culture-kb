import { createHash } from 'node:crypto';
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
  StoryRecipeEffectMachineReport,
  StoryRecipeEffectMachineReportFilters,
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

export interface StoryRecipeEffectMachineReportBuildOptions
  extends StoryRecipeEffectMachineReportFilters {
  generated_at?: string;
}

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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeReportFilters(
  filters: StoryRecipeEffectMachineReportBuildOptions,
): Required<Pick<StoryRecipeEffectMachineReportBuildOptions, 'limit' | 'min_comparisons_per_recipe'>>
  & Omit<StoryRecipeEffectMachineReportFilters, 'limit' | 'min_comparisons_per_recipe'> {
  return {
    recipe_id: filters.recipe_id,
    video_type: filters.video_type,
    machine_verdict: filters.machine_verdict,
    from_updated_at: filters.from_updated_at
      ? new Date(filters.from_updated_at).toISOString()
      : undefined,
    to_updated_at: filters.to_updated_at
      ? new Date(filters.to_updated_at).toISOString()
      : undefined,
    limit: Math.min(MAX_LIMIT, Math.max(1, Math.trunc(filters.limit ?? DEFAULT_LIMIT))),
    min_comparisons_per_recipe: Math.min(
      MAX_LIMIT,
      Math.max(1, Math.trunc(filters.min_comparisons_per_recipe ?? 1)),
    ),
  };
}

function renderMachineReportMarkdown(
  report: Omit<StoryRecipeEffectMachineReport, 'markdown'>,
): string {
  const lines = [
    '# 创作配方机器对照报告',
    '',
    `> cohort: ${report.cohort.cohort_id}`,
    `> generatedAt: ${report.generated_at}`,
    '',
    '## Cohort',
    '',
    `- source snapshot: ${report.cohort.source_snapshot}`,
    `- membership SHA-256: ${report.cohort.membership_sha256}`,
    `- recipe: ${report.cohort.recipe_id ?? 'all'}`,
    `- video type: ${report.cohort.video_type ?? 'all'}`,
    `- machine verdict: ${report.cohort.machine_verdict ?? 'all'}`,
    `- updated from: ${report.cohort.from_updated_at ?? 'unbounded'}`,
    `- updated to: ${report.cohort.to_updated_at ?? 'unbounded'}`,
    `- minimum comparisons per recipe: ${report.cohort.min_comparisons_per_recipe}`,
    `- included comparisons: ${report.cohort.included_comparison_count}`,
    `- excluded below minimum sample: ${report.cohort.excluded_below_minimum_sample_count}`,
    '',
    '## Machine trends',
    '',
    ...(report.history.trends.length
      ? report.history.trends.flatMap(trend => [
        `### ${trend.recipe.recipe_id}`,
        '',
        `- comparisons: ${trend.comparison_count}`,
        `- average baseline score: ${trend.average_baseline_machine_score}`,
        `- average recipe-assisted score: ${trend.average_recipe_assisted_machine_score}`,
        `- average aggregate delta: ${trend.average_aggregate_delta}`,
        `- verdicts: improved ${trend.verdict_counts.improved}, mixed ${trend.verdict_counts.mixed}, no material change ${trend.verdict_counts.no_material_change}, regressed ${trend.verdict_counts.regressed}`,
        ...trend.dimensions.map(dimension => (
          `- ${dimension.dimension}: average delta ${dimension.average_delta} (${dimension.comparison_count} comparisons)`
        )),
        '',
      ])
      : ['- No comparisons satisfy the controlled cohort.', '']),
    '## Boundary',
    '',
    '- 本报告只反映机器质量维度。',
    '- 不代表真人偏好，不证明因果，不构成法律结论。',
    '- 不授予生产交付或真实外部验收信用。',
  ];
  return lines.join('\n');
}

export function buildStoryRecipeEffectMachineReport(
  records: StoryRecipeEffectComparisonHistoryRecord[],
  requestedFilters: StoryRecipeEffectMachineReportBuildOptions = {},
): StoryRecipeEffectMachineReport {
  const filters = normalizeReportFilters(requestedFilters);
  const timeBoundRecords = records.filter(record => (
    (!filters.from_updated_at || record.updated_at >= filters.from_updated_at)
    && (!filters.to_updated_at || record.updated_at <= filters.to_updated_at)
  ));
  const sourceHistory = buildStoryRecipeEffectComparisonHistory(timeBoundRecords, {
    recipe_id: filters.recipe_id,
    video_type: filters.video_type,
    machine_verdict: filters.machine_verdict,
    limit: filters.limit,
  });
  const eligibleRecipeIds = new Set(
    sourceHistory.trends
      .filter(trend => trend.comparison_count >= filters.min_comparisons_per_recipe)
      .map(trend => trend.recipe.recipe_id),
  );
  const candidateItems = sourceHistory.items;
  const includedKeys = new Set(
    candidateItems
      .filter(item => eligibleRecipeIds.has(item.comparison.recipe.recipe_id))
      .map(item => `${item.project_id}\u0000${item.story_id}`),
  );
  const cohortRecords = timeBoundRecords.filter(record => (
    includedKeys.has(`${record.project_id}\u0000${record.story.storyId}`)
  ));
  const history = buildStoryRecipeEffectComparisonHistory(cohortRecords, {
    recipe_id: filters.recipe_id,
    video_type: filters.video_type,
    machine_verdict: filters.machine_verdict,
    limit: filters.limit,
  });
  const definition = {
    source_snapshot: 'current_project_versions',
    recipe_id: filters.recipe_id ?? null,
    video_type: filters.video_type ?? null,
    machine_verdict: filters.machine_verdict ?? null,
    from_updated_at: filters.from_updated_at ?? null,
    to_updated_at: filters.to_updated_at ?? null,
    min_comparisons_per_recipe: filters.min_comparisons_per_recipe,
    item_limit: filters.limit,
  } as const;
  const membership = history.items
    .map(item => [
      item.project_id,
      item.story_id,
      item.comparison.recipe.recipe_id,
      item.comparison.recipe.payload_sha256,
    ].join(':'))
    .sort();
  const cohort = {
    cohort_id: `recipe-effect-cohort-${sha256(JSON.stringify(definition)).slice(0, 12)}`,
    membership_sha256: sha256(JSON.stringify(membership)),
    ...definition,
    source_matched_comparison_count: sourceHistory.summary.matched_comparison_count,
    candidate_comparison_count: candidateItems.length,
    included_comparison_count: history.summary.matched_comparison_count,
    excluded_below_minimum_sample_count: candidateItems.length
      - history.summary.matched_comparison_count,
    source_match_truncated: sourceHistory.summary.matched_comparison_count
      > sourceHistory.summary.returned_comparison_count,
  };
  const base: Omit<StoryRecipeEffectMachineReport, 'markdown'> = {
    schema_version: 'story-recipe-effect-machine-report/v1',
    generated_at: requestedFilters.generated_at ?? new Date().toISOString(),
    cohort,
    history,
    boundary: {
      machine_comparison_only: true,
      human_preference_measured: false,
      causal_effect_proven: false,
      legal_conclusion_reached: false,
      production_credit_granted: false,
    },
  };
  return {
    ...base,
    markdown: renderMachineReportMarkdown(base),
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
