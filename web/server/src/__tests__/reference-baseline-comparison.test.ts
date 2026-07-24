import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { StoryGenerateRequestSchema } from '@shared/schemas.js';
import {
  buildStoryReferenceBaselineComparison,
  validateReferenceBaselineCompatibility,
} from '../services/reference-baseline-comparison-service.js';

function qualityReport(input: {
  genreScore: number;
  patternScore: number;
  publishable: boolean;
  coreFailure?: boolean;
}): StoryQualityReport {
  return {
    hasCentralEvent: true,
    hasConflict: !input.coreFailure,
    hasProtagonistChoice: true,
    hasSceneAction: true,
    hasClimax: true,
    hasEndingTheme: true,
    isNotBiographySummary: true,
    passed: input.publishable,
    issues: [],
    genre_score: input.genreScore,
    pattern_quality_report: {
      schema_version: 'pattern-quality/v2',
      pattern_score: input.patternScore,
      satisfied_signals: [],
      weak_signals: [],
      gaps: [],
      repair_prompt: '',
      preview: '',
    },
    quality_gates: {
      schema_version: 'quality-gates/v2',
      narrative_gate: {
        gate_id: 'narrative_gate',
        scope: 'story',
        status: 'passed',
        passed: true,
        summary: '',
        issues: [],
      },
      factual_cultural_gate: {
        gate_id: 'factual_cultural_gate',
        scope: 'story',
        status: 'passed',
        passed: true,
        summary: '',
        issues: [],
      },
      outline_gate: {
        gate_id: 'outline_gate',
        scope: 'story',
        status: 'passed',
        passed: true,
        summary: '',
        issues: [],
      },
      audience_text_gate: {
        gate_id: 'audience_text_gate',
        scope: 'story',
        status: 'passed',
        passed: true,
        summary: '',
        issues: [],
      },
      production_material_gate: {
        gate_id: 'production_material_gate',
        scope: 'story',
        status: 'passed',
        passed: true,
        summary: '',
        issues: [],
      },
      gears_contract_gate: {
        gate_id: 'gears_contract_gate',
        scope: 'story',
        status: 'passed',
        passed: true,
        summary: '',
        issues: [],
      },
      asset_gate: {
        gate_id: 'asset_gate',
        scope: 'production',
        status: 'failed',
        passed: false,
        summary: '',
        issues: ['assets pending'],
      },
      external_provider_gate: {
        gate_id: 'external_provider_gate',
        scope: 'production',
        status: 'failed',
        passed: false,
        summary: '',
        issues: ['provider pending'],
      },
      story_publishable: input.publishable,
      production_ready: false,
      story_blocking_gate_ids: [],
      production_blocking_gate_ids: ['asset_gate', 'external_provider_gate'],
      legacy_passed: input.publishable,
    },
  };
}

function comparableStory(input: {
  storyId: string;
  quality: StoryQualityReport;
  appliedReference?: boolean;
}): Pick<
  StoryGenerateResult,
  | 'storyId'
  | 'source_entry'
  | 'original_user_query'
  | 'video_type'
  | 'presentation_style'
  | 'story_structure'
  | 'model_profile_id'
  | 'story_blueprint'
  | 'creation_use_case'
  | 'truth_mode'
  | 'client_type'
  | 'target_audience'
  | 'communication_goal'
  | 'reference_trace'
  | 'quality_report'
> {
  return {
    storyId: input.storyId,
    source_entry: '同一知识条目',
    original_user_query: '同一创作输入',
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    story_structure: 'three_act_drama',
    model_profile_id: 'external-command',
    story_blueprint: {
      schema_version: 'story-blueprint/v1',
      entry_name: '同一知识条目',
      source_entry: '同一知识条目',
      video_type: 'historical_drama',
      presentation_style: 'cinematic',
      story_structure: 'three_act_drama',
      target_duration: '3分钟',
      central_event: '同一中心事件',
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
    reference_trace: input.appliedReference
      ? [{
          style_pack_id: 'style-pack-01',
          application_status: 'external_prompt_injected',
          applied_rules: ['抽象节奏原则'],
          source_story_structure: 'three_act_drama',
        }]
      : [],
    quality_report: input.quality,
  };
}

describe('reference baseline comparison', () => {
  it('requires an explicit style pack when a baseline story is requested', () => {
    const withoutReference = StoryGenerateRequestSchema.safeParse({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'historical_drama',
      reference_baseline_story_id: '20260724-story-baseline-01',
    });
    const withReference = StoryGenerateRequestSchema.safeParse({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'historical_drama',
      style_pack_ids: ['reference-style-pack-01'],
      reference_baseline_story_id: '20260724-story-baseline-01',
    });

    expect(withoutReference.success).toBe(false);
    expect(withReference.success).toBe(true);
  });

  it('rejects a baseline that is not reference-free or does not match the same input', () => {
    const baseline = {
      ...comparableStory({
        storyId: 'baseline-01',
        quality: qualityReport({
          genreScore: 70,
          patternScore: 75,
          publishable: true,
        }),
        appliedReference: true,
      }),
      original_user_query: '另一个输入',
    };

    expect(validateReferenceBaselineCompatibility({
      baseline,
      expected: {
        source_entry: '同一知识条目',
        original_user_query: '同一创作输入',
        video_type: 'historical_drama',
        presentation_style: 'cinematic',
        story_structure: 'three_act_drama',
        model_profile_id: 'external-command',
        central_event: '同一中心事件',
        target_duration: '3分钟',
        creation_use_case: 'documentary_short',
        truth_mode: 'factual_reconstruction',
        client_type: '文化机构',
        target_audience: '青年观众',
        communication_goal: '理解人物选择',
      },
    })).toEqual([
      'original_user_query',
      'baseline_reference_free',
    ]);
  });

  it('computes an explainable machine-only quality delta with no comparison credit', () => {
    const comparison = buildStoryReferenceBaselineComparison({
      baseline: comparableStory({
        storyId: 'baseline-01',
        quality: qualityReport({
          genreScore: 70,
          patternScore: 75,
          publishable: false,
          coreFailure: true,
        }),
      }),
      referenceAssisted: comparableStory({
        storyId: 'assisted-01',
        quality: qualityReport({
          genreScore: 85,
          patternScore: 90,
          publishable: true,
        }),
        appliedReference: true,
      }),
    });

    expect(comparison).toMatchObject({
      status: 'completed',
      baseline_story_id: 'baseline-01',
      reference_assisted_story_id: 'assisted-01',
      comparison_credit_granted: false,
      quality_delta: {
        schema_version: 'story-reference-baseline-quality-delta/v1',
        same_input_verified: true,
        machine_comparison_only: true,
        dimensions: expect.arrayContaining([
          {
            dimension: 'genre_score',
            baseline_score: 70,
            reference_assisted_score: 85,
            delta: 15,
          },
          {
            dimension: 'pattern_score',
            baseline_score: 75,
            reference_assisted_score: 90,
            delta: 15,
          },
          {
            dimension: 'story_publishable',
            baseline_score: 0,
            reference_assisted_score: 100,
            delta: 100,
          },
        ]),
      },
    });
    expect(comparison.quality_delta!.aggregate_delta).toBeGreaterThan(0);
  });
});
