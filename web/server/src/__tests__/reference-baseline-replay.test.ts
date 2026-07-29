import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import {
  buildReferenceBaselineReplayRequest,
  buildReferenceRecipeComparisonReplayRequest,
  validateReferenceBaselineReplaySource,
} from '../services/reference-baseline-replay-service.js';

function baselineStory(overrides: Partial<StoryGenerateResult> = {}): StoryGenerateResult {
  return {
    storyId: '20260725-story-baseline-01',
    title: '同输入 Reference-free Baseline',
    generation_type: 'character_story',
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    original_user_query: '同一创作输入',
    model_profile_id: 'external-command',
    generation_mode: 'external_model',
    story_structure: 'three_act_drama',
    story_blueprint: {
      schema_version: 'story-blueprint/v1',
      entry_name: '周敦颐——理学开山鼻祖',
      source_entry: '周敦颐——理学开山鼻祖',
      video_type: 'historical_drama',
      presentation_style: 'cinematic',
      story_structure: 'three_act_drama',
      target_duration: '3分钟',
      central_event: '拒绝在冤案文书上落笔',
      central_question: '主人公如何完成选择？',
      genre_beats: [],
      character_arcs: [],
      evidence_boundaries: [],
      type_specific_requirements: [],
    },
    creation_use_case: 'documentary_short',
    truth_mode: 'factual_reconstruction',
    client_type: '文化机构',
    target_audience: '青年观众',
    communication_goal: '理解人物选择',
    reference_trace: [],
    quality_report: {
      hasCentralEvent: true,
      hasConflict: true,
      hasProtagonistChoice: true,
      hasSceneAction: true,
      hasClimax: true,
      hasEndingTheme: true,
      isNotBiographySummary: true,
      passed: true,
      issues: [],
    },
    full_text: 'baseline story',
    scene_breakdown: [],
    gears_segments: [],
    cultural_constraints: [],
    credibility_note: 'fixture',
    logline: 'fixture',
    theme: 'fixture',
    ...overrides,
  } as StoryGenerateResult;
}

describe('reference baseline replay', () => {
  it('builds an explicit same-input assisted request without invoking generation', () => {
    const request = buildReferenceBaselineReplayRequest({
      baseline: baselineStory(),
      stylePackIds: ['reference-style-pack-approved-01'],
      sourceMode: 'knowledge_entry',
    });

    expect(request).toMatchObject({
      entry_name: '周敦颐——理学开山鼻祖',
      original_user_query: '同一创作输入',
      generation_type: 'character_story',
      video_type: 'historical_drama',
      model_profile_id: 'external-command',
      generation_fallback_policy: 'forbid_local_fallback',
      selected_event: '拒绝在冤案文书上落笔',
      target_video_duration: '3分钟',
      presentation_style: 'cinematic',
      story_structure: 'three_act_drama',
      creation_use_case: 'documentary_short',
      truth_mode: 'factual_reconstruction',
      style_pack_ids: ['reference-style-pack-approved-01'],
      reference_baseline_story_id: '20260725-story-baseline-01',
    });
    expect(request.outline).toBeUndefined();
  });

  it('replays user material through outline and rejects non-reference-free baselines', () => {
    const userMaterial = baselineStory({
      source_entry: '守桥少年——用户原创故事种子',
      original_user_query: '一个少年在暴雨中守住古桥。',
      creation_use_case: 'original_ai_comic',
      truth_mode: 'fictional_original',
    });
    const request = buildReferenceBaselineReplayRequest({
      baseline: userMaterial,
      stylePackIds: ['reference-style-pack-approved-01'],
      sourceMode: 'user_material',
    });

    expect(request.entry_name).toBeUndefined();
    expect(request.outline).toBe('一个少年在暴雨中守住古桥。');

    expect(() => validateReferenceBaselineReplaySource(baselineStory({
      reference_trace: [{
        style_pack_id: 'reference-style-pack-already-applied',
        application_status: 'external_prompt_injected',
        applied_rules: ['已应用规则'],
        source_story_structure: 'three_act_drama',
      }],
    }))).toThrowError('reference_free');
  });

  it('builds a recipe-only replay and rejects an already recipe-assisted baseline', () => {
    const request = buildReferenceRecipeComparisonReplayRequest({
      baseline: baselineStory(),
      recipeId: 'feature_moral_pressure',
      sourceMode: 'knowledge_entry',
    });

    expect(request).toMatchObject({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'historical_drama',
      presentation_style: 'cinematic',
      reference_baseline_story_id: '20260725-story-baseline-01',
      reference_generation_recipe: {
        schema_version: 'reference-generation-recipe/v1',
        recipe_id: 'feature_moral_pressure',
      },
    });
    expect(request.style_pack_ids).toBeUndefined();

    expect(() => validateReferenceBaselineReplaySource(baselineStory({
      reference_generation_recipe: request.reference_generation_recipe,
    }))).toThrowError('recipe_free');
  });
});
