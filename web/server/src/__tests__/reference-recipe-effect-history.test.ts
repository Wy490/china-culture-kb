import { describe, expect, it } from 'vitest';
import type {
  StoryGenerateResult,
  StoryRecipeEffectComparison,
  StoryRecipeEffectComparisonHistoryItem,
} from '@shared/types.js';
import { buildReferenceGenerationRecipeContract } from '@shared/reference-generation-recipes.js';
import {
  buildStoryRecipeEffectMachineReport,
  buildStoryRecipeEffectComparisonHistory,
  type StoryRecipeEffectComparisonHistoryRecord,
} from '../services/reference-recipe-effect-history-service.js';

const DIMENSIONS: StoryRecipeEffectComparison['dimensions'] = [
  'structure',
  'causality',
  'visualization',
  'continuity',
  'contract_completeness',
].map((dimension, index) => ({
  dimension,
  baseline_score: 60 + index,
  recipe_assisted_score: 70 + index,
  delta: 10,
  evidence: [`${dimension}=fixture`],
})) as StoryRecipeEffectComparison['dimensions'];

function record(input: {
  projectId: string;
  updatedAt: string;
  recipeId?: 'feature_long_goal_payoff' | 'promo_mnemonic_reveal';
  verdict?: StoryRecipeEffectComparison['machine_verdict'];
  delta?: number;
  videoType?: StoryGenerateResult['video_type'];
}): StoryRecipeEffectComparisonHistoryRecord {
  const recipe = buildReferenceGenerationRecipeContract(
    input.recipeId ?? 'feature_long_goal_payoff',
  );
  const delta = input.delta ?? 10;
  const storyId = `${input.projectId}-story`;
  const comparison: StoryRecipeEffectComparison = {
    schema_version: 'story-recipe-effect-comparison/v1',
    status: 'completed',
    baseline_story_id: `${input.projectId}-baseline`,
    recipe_assisted_story_id: storyId,
    recipe,
    baseline_machine_score: 60,
    recipe_assisted_machine_score: 60 + delta,
    aggregate_delta: delta,
    dimensions: DIMENSIONS.map(item => ({
      ...item,
      recipe_assisted_score: item.baseline_score + delta,
      delta,
    })),
    machine_verdict: input.verdict ?? 'improved',
    boundary: {
      same_input_verified: true,
      machine_comparison_only: true,
      human_preference_measured: false,
      legal_conclusion_reached: false,
      production_credit_granted: false,
    },
  };
  return {
    project_id: input.projectId,
    project_title: `项目 ${input.projectId}`,
    updated_at: input.updatedAt,
    story: {
      storyId,
      source_entry: `条目 ${input.projectId}`,
      video_type: input.videoType ?? 'character_story',
      presentation_style: 'cinematic',
      reference_generation_recipe: recipe,
      recipe_effect_comparison: comparison,
    },
  };
}

describe('recipe effect comparison history', () => {
  it('indexes only canonical current-version comparisons and sorts newest first', () => {
    const invalid = record({
      projectId: 'invalid',
      updatedAt: '2026-07-31T00:00:00.000Z',
    });
    invalid.story.recipe_effect_comparison = {
      ...invalid.story.recipe_effect_comparison!,
      recipe_assisted_story_id: 'another-story',
    };
    const withoutComparison = record({
      projectId: 'without',
      updatedAt: '2026-07-30T00:00:00.000Z',
    });
    delete withoutComparison.story.recipe_effect_comparison;

    const result = buildStoryRecipeEffectComparisonHistory([
      record({ projectId: 'older', updatedAt: '2026-07-28T00:00:00.000Z' }),
      invalid,
      withoutComparison,
      record({ projectId: 'newer', updatedAt: '2026-07-29T00:00:00.000Z' }),
    ]);

    expect(result.items.map(item => item.project_id)).toEqual(['newer', 'older']);
    expect(result.summary).toMatchObject({
      matched_comparison_count: 2,
      returned_comparison_count: 2,
      skipped_invalid_comparison_count: 1,
    });
  });

  it('filters before trend aggregation and limits only returned history items', () => {
    const result = buildStoryRecipeEffectComparisonHistory([
      record({
        projectId: 'feature-improved',
        updatedAt: '2026-07-30T00:00:00.000Z',
        delta: 10,
      }),
      record({
        projectId: 'feature-mixed',
        updatedAt: '2026-07-29T00:00:00.000Z',
        verdict: 'mixed',
        delta: 2,
      }),
      record({
        projectId: 'short-improved',
        updatedAt: '2026-07-28T00:00:00.000Z',
        recipeId: 'promo_mnemonic_reveal',
      }),
    ], {
      recipe_id: 'feature_long_goal_payoff',
      video_type: 'character_story',
      limit: 1,
    });

    expect(result.summary.matched_comparison_count).toBe(2);
    expect(result.summary.returned_comparison_count).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.trends).toHaveLength(1);
    expect(result.trends[0]).toMatchObject({
      comparison_count: 2,
      average_aggregate_delta: 6,
      verdict_counts: {
        improved: 1,
        mixed: 1,
        no_material_change: 0,
        regressed: 0,
      },
    });
  });

  it('aggregates all five dimensions and preserves non-causal boundaries', () => {
    const result = buildStoryRecipeEffectComparisonHistory([
      record({ projectId: 'a', updatedAt: '2026-07-30T00:00:00.000Z', delta: 10 }),
      record({ projectId: 'b', updatedAt: '2026-07-29T00:00:00.000Z', delta: -4, verdict: 'mixed' }),
    ]);

    expect(result.trends[0].dimensions).toHaveLength(5);
    expect(result.trends[0].dimensions[0]).toMatchObject({
      comparison_count: 2,
      average_delta: 3,
    });
    expect(result.boundary).toEqual({
      source_snapshot: 'current_project_versions',
      machine_comparison_only: true,
      human_preference_measured: false,
      causal_effect_proven: false,
      legal_conclusion_reached: false,
      production_credit_granted: false,
    });
  });

  it('returns stable public item contracts', () => {
    const result = buildStoryRecipeEffectComparisonHistory([
      record({ projectId: 'a', updatedAt: '2026-07-30T00:00:00.000Z' }),
    ]);
    const item: StoryRecipeEffectComparisonHistoryItem = result.items[0];
    expect(item).toMatchObject({
      schema_version: 'story-recipe-effect-comparison-history-item/v1',
      project_id: 'a',
      story_id: 'a-story',
      updated_at: '2026-07-30T00:00:00.000Z',
    });
  });

  it('builds a deterministic controlled cohort before exporting machine trends', () => {
    const records = [
      record({ projectId: 'feature-a', updatedAt: '2026-07-30T08:00:00.000Z', delta: 10 }),
      record({ projectId: 'feature-b', updatedAt: '2026-07-29T08:00:00.000Z', delta: 2, verdict: 'mixed' }),
      record({
        projectId: 'promo-a',
        updatedAt: '2026-07-30T09:00:00.000Z',
        recipeId: 'promo_mnemonic_reveal',
      }),
      record({ projectId: 'too-old', updatedAt: '2026-07-20T08:00:00.000Z' }),
    ];

    const report = buildStoryRecipeEffectMachineReport(records, {
      from_updated_at: '2026-07-29T00:00:00.000Z',
      to_updated_at: '2026-07-31T00:00:00.000Z',
      min_comparisons_per_recipe: 2,
      limit: 20,
      generated_at: '2026-07-30T10:00:00.000Z',
    });
    const replay = buildStoryRecipeEffectMachineReport([...records].reverse(), {
      from_updated_at: '2026-07-29T00:00:00.000Z',
      to_updated_at: '2026-07-31T00:00:00.000Z',
      min_comparisons_per_recipe: 2,
      limit: 20,
      generated_at: '2026-07-30T11:00:00.000Z',
    });

    expect(report).toMatchObject({
      schema_version: 'story-recipe-effect-machine-report/v1',
      generated_at: '2026-07-30T10:00:00.000Z',
      cohort: {
        source_snapshot: 'current_project_versions',
        min_comparisons_per_recipe: 2,
        candidate_comparison_count: 3,
        included_comparison_count: 2,
        excluded_below_minimum_sample_count: 1,
      },
      history: {
        summary: {
          matched_comparison_count: 2,
        },
      },
    });
    expect(report.cohort.cohort_id).toMatch(/^recipe-effect-cohort-[a-f0-9]{12}$/);
    expect(report.cohort.membership_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(replay.cohort.cohort_id).toBe(report.cohort.cohort_id);
    expect(replay.cohort.membership_sha256).toBe(report.cohort.membership_sha256);
    const offsetReplay = buildStoryRecipeEffectMachineReport(records, {
      from_updated_at: '2026-07-29T08:00:00.000+08:00',
      to_updated_at: '2026-07-31T08:00:00.000+08:00',
      min_comparisons_per_recipe: 2,
      limit: 20,
    });
    expect(offsetReplay.cohort.cohort_id).toBe(report.cohort.cohort_id);
    expect(report.history.items.map(item => item.project_id)).toEqual([
      'feature-a',
      'feature-b',
    ]);
  });

  it('exports neutral markdown without human, causal, legal, or production credit', () => {
    const report = buildStoryRecipeEffectMachineReport([
      record({ projectId: 'feature-a', updatedAt: '2026-07-30T08:00:00.000Z' }),
    ], {
      generated_at: '2026-07-30T10:00:00.000Z',
    });

    expect(report.markdown).toContain('# 创作配方机器对照报告');
    expect(report.markdown).toContain('只反映机器质量维度');
    expect(report.markdown).toContain('不证明因果');
    expect(report.boundary).toEqual({
      machine_comparison_only: true,
      human_preference_measured: false,
      causal_effect_proven: false,
      legal_conclusion_reached: false,
      production_credit_granted: false,
    });
  });
});
