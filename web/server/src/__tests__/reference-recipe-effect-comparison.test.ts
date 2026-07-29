import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { buildReferenceGenerationRecipeContract } from '@shared/reference-generation-recipes.js';
import { StoryGenerateRequestSchema } from '@shared/schemas.js';
import { buildStoryRecipeEffectComparison } from '../services/reference-recipe-effect-comparison-service.js';

function quality(score: number, passed: boolean): StoryQualityReport {
  return {
    hasCentralEvent: true,
    hasConflict: passed,
    hasProtagonistChoice: true,
    hasSceneAction: true,
    hasClimax: passed,
    hasEndingTheme: true,
    isNotBiographySummary: true,
    passed,
    issues: [],
    genre_score: score,
    pattern_quality_report: {
      schema_version: 'pattern-quality/v2',
      pattern_score: score,
      satisfied_signals: [],
      weak_signals: [],
      gaps: [],
      repair_prompt: '',
      preview: '',
    },
  };
}

function story(
  storyId: string,
  score: number,
  recipe = false,
): Pick<StoryGenerateResult, 'storyId' | 'quality_report' | 'reference_generation_recipe'> {
  return {
    storyId,
    quality_report: quality(score, score >= 80),
    reference_generation_recipe: recipe
      ? buildReferenceGenerationRecipeContract('feature_long_goal_payoff')
      : undefined,
  };
}

describe('recipe effect comparison', () => {
  it('allows a baseline replay with a canonical recipe but no style pack', () => {
    const parsed = StoryGenerateRequestSchema.safeParse({
      outline: '同一主题',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      reference_baseline_story_id: '20260730-story-baseline01',
      reference_generation_recipe:
        buildReferenceGenerationRecipeContract('feature_long_goal_payoff'),
    });
    expect(parsed.success).toBe(true);
  });

  it('computes five explainable machine-only dimensions', () => {
    const comparison = buildStoryRecipeEffectComparison({
      baseline: story('baseline-01', 70),
      recipeAssisted: story('assisted-01', 90, true),
    });

    expect(comparison).toMatchObject({
      schema_version: 'story-recipe-effect-comparison/v1',
      baseline_story_id: 'baseline-01',
      recipe_assisted_story_id: 'assisted-01',
      machine_verdict: 'improved',
      boundary: {
        same_input_verified: true,
        machine_comparison_only: true,
        human_preference_measured: false,
        legal_conclusion_reached: false,
        production_credit_granted: false,
      },
    });
    expect(comparison.dimensions.map(item => item.dimension)).toEqual([
      'structure',
      'causality',
      'visualization',
      'continuity',
      'contract_completeness',
    ]);
    expect(comparison.aggregate_delta).toBeGreaterThan(0);
  });

  it('fails closed when either comparison role violates its recipe boundary', () => {
    expect(() => buildStoryRecipeEffectComparison({
      baseline: story('baseline-01', 70, true),
      recipeAssisted: story('assisted-01', 90, true),
    })).toThrow('recipe-free');
    expect(() => buildStoryRecipeEffectComparison({
      baseline: story('baseline-01', 70),
      recipeAssisted: story('assisted-01', 90),
    })).toThrow('canonical recipe contract');
  });
});
