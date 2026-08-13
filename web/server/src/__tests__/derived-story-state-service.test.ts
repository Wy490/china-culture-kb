import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import { rebuildDerivedStoryState } from '../services/derived-story-state-service.js';
import { getProductionMaterialPack } from '../services/production-material-pack-service.js';
import {
  evaluateReferenceGenerationSafety,
} from '../services/reference-quality-service.js';

function makeStoryWithStaleLegacySegment(): StoryGenerateResult {
  return {
    storyId: '20260719-derived-state-legacy-segment',
    title: '拒签后的选择',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '测试条目',
    logline: '少年面对催签，公开证据并承担后果。',
    theme: '选择与担当',
    full_text: '少年面对催签，摊开案卷指出疑点，拒绝落笔并决定承担后果。',
    scene_breakdown: [{
      scene_id: 1,
      title: '堂前拒签',
      duration_sec: 20,
      location: '军衙堂前',
      time_of_day: '白天',
      dramatic_function: '高潮选择',
      plot: '少年面对催签，摊开案卷指出疑点，拒绝落笔并决定承担后果。',
      key_action: '摊开案卷公开疑点',
      conflict: '服从上官或坚持重查',
      dialogue_or_narration: '少年：此案有疑，我不能签。',
      characters: ['少年', '上官'],
      visual_prompt: '军衙堂前，少年摊开案卷，上官逼近，白日侧光',
      camera_suggestion: '中近景对切后推进案卷特写',
      cultural_note: '服饰与衙署陈设保持时代一致。',
    }],
    gears_segments: [{
      segment_id: 7,
      source_scene_id: 1,
      duration_sec: 20,
      panel_count: 6,
      script_text: '旧版本：少年已经签下文书。',
      purpose: '旧用途',
      visual_focus: ['旧场景'],
      cultural_constraints: [],
      video_type: 'character_story',
      presentation_style: 'cinematic',
      segment_prompt_hint: '保留人工镜头节奏覆盖层。',
    }],
    gears_segments_url: '/api/stories/20260719-derived-state-legacy-segment/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试故事。',
    story_structure: 'single_event_drama',
  };
}

describe('derived-story-state-service', () => {
  it('rebuilds stale legacy GEARS segment text while preserving its stable id and prompt overlay', async () => {
    const rebuilt = await rebuildDerivedStoryState(makeStoryWithStaleLegacySegment(), {
      revalidateDomainSafety: false,
    });

    expect(rebuilt.gears_segments).toHaveLength(1);
    expect(rebuilt.gears_segments[0].segment_id).toBe(7);
    expect(rebuilt.gears_segments[0].script_text).toContain('摊开案卷指出疑点');
    expect(rebuilt.gears_segments[0].script_text).not.toContain('已经签下文书');
    expect(rebuilt.gears_segments[0].purpose).toBe('高潮选择');
    expect(rebuilt.gears_segments[0].segment_prompt_hint).toContain('保留人工镜头节奏覆盖层');
    expect(rebuilt.gears_delivery?.units.map(unit => unit.script_text).join('\n')).toContain('摊开案卷指出疑点');
    expect(rebuilt.quality_report?.quality_gates?.schema_version).toBe('quality-gates/v2');
  });

  it('refreshes generated production-material evidence before recomputing quality gates', async () => {
    const story = makeStoryWithStaleLegacySegment();
    story.credibility_note = '事件依据知识条目；对白与镜头调度属于影视化创作补位。';
    story.scene_breakdown[0].factual_basis = '知识条目记载人物拒签并要求重查。';
    story.scene_breakdown[0].fictionalized_elements = ['堂前站位与对白节奏为影视化调度。'];
    story.characters = [
      { name: '少年', role: 'protagonist', description: '初任军衙的审案官' },
      { name: '上官', role: 'antagonist', description: '催促签字的长官' },
    ];
    story.protagonist_arc = [{
      starting_state: '初任时面对催签压力',
      turning_point: '拒绝签字并要求重查',
      resolution: '案件重审，人物承担选择后果',
    }];
    const characterPack = getProductionMaterialPack('character_story');
    expect(characterPack).toBeTruthy();
    story.production_material_pack = {
      ...characterPack!,
      material_template: {
        ...characterPack!.material_template,
        required_fields: [
          'life_stage_window',
          'relationship_map',
          'dialogue_voice',
          'factual_life_boundary',
          'ending_legacy',
        ],
      },
    };
    story.production_material_readiness = {
      schema_version: 'production-material-readiness/v1',
      video_type: 'character_story',
      pack_label: '人物故事',
      score: 0,
      status: 'blocked',
      available_fields: [],
      missing_fields: [],
      gate_reports: [],
      recommended_next_questions: [],
    };

    const rebuilt = await rebuildDerivedStoryState(story, {
      revalidateDomainSafety: false,
    });

    expect(rebuilt.production_material_readiness?.available_fields).toEqual(
      expect.arrayContaining([
        'life_stage_window',
        'relationship_map',
        'dialogue_voice',
        'factual_life_boundary',
        'ending_legacy',
      ]),
    );
    expect(rebuilt.quality_report?.quality_gates?.production_material_gate.passed).toBe(true);
  });

  it('revalidates approved-reference safety before rebuilding downstream artifacts', async () => {
    const story = makeStoryWithStaleLegacySegment();
    story.full_text += '\n本故事改编自某部著名电影。';
    story.reference_trace = [{
      style_pack_id: 'reference-style-pack-approved',
      application_status: 'external_prompt_injected',
      applied_rules: ['用可见行动建立人物选择'],
      requested_rules: ['用可见行动建立人物选择'],
      avoid_copying_rules: ['不得复制具体角色、情节与镜头顺序'],
      source_reference_ids: ['reference-approved'],
      source_analysis_ids: ['analysis-approved'],
      source_benchmark_ids: ['benchmark-approved'],
      source_references: [{
        reference_id: 'reference-approved',
        rights_status: 'research_only',
        access_scope: 'metadata_only',
      }],
      source_story_structure: 'single_event_drama',
    }];

    await expect(rebuildDerivedStoryState(story, {
      revalidateDomainSafety: false,
    })).rejects.toMatchObject({
      name: 'StoryDerivedStateValidationError',
      story: {
        reference_safety_report: {
          status: 'blocked',
          passed: false,
          issues: [
            expect.objectContaining({
              issue_code: 'unauthorized_adaptation_claim',
            }),
          ],
        },
      },
    });
  });

  it('fails closed when traced similarity evidence is unavailable during rebuild', async () => {
    const story = makeStoryWithStaleLegacySegment();
    story.reference_trace = [{
      style_pack_id: 'reference-style-pack-approved',
      application_status: 'external_prompt_injected',
      applied_rules: ['用可见行动建立人物选择'],
      requested_rules: ['用可见行动建立人物选择'],
      avoid_copying_rules: ['不得复制具体角色、情节与镜头顺序'],
      source_reference_ids: ['reference-approved'],
      source_analysis_ids: ['analysis-approved'],
      source_benchmark_ids: ['benchmark-approved'],
      source_references: [{
        reference_id: 'reference-approved',
        rights_status: 'user_owned',
        access_scope: 'full_user_supplied',
        content_fingerprint: 'a'.repeat(64),
      }],
      similarity_evidence_refs: [{
        evidence_id: 'reference-similarity-evidence-missing',
        reference_id: 'reference-approved',
        payload_sha256: 'b'.repeat(64),
        input_provenance: 'operator_submitted',
        dimensions: ['excerpt'],
      }],
      source_story_structure: 'single_event_drama',
    }];

    await expect(rebuildDerivedStoryState(story, {
      revalidateDomainSafety: false,
    })).rejects.toMatchObject({
      name: 'StoryDerivedStateValidationError',
      story: {
        reference_safety_report: {
          status: 'blocked',
          issues: [
            expect.objectContaining({
              issue_code: 'similarity_evidence_provenance_incomplete',
            }),
          ],
        },
      },
    });
  });

  it('fails closed when a completed baseline comparison cannot reload its baseline story', async () => {
    const story = makeStoryWithStaleLegacySegment();
    story.reference_safety_report = {
      ...evaluateReferenceGenerationSafety({
        generated_text: story.full_text,
      }),
      baseline_comparison: {
        status: 'completed',
        baseline_story_id: 'baseline-story-that-does-not-exist-20260724',
        reference_assisted_story_id: story.storyId,
        quality_delta: {
          schema_version: 'story-reference-baseline-quality-delta/v1',
          baseline_machine_score: 80,
          reference_assisted_machine_score: 85,
          aggregate_delta: 5,
          dimensions: [],
          same_input_verified: true,
          machine_comparison_only: true,
        },
        comparison_credit_granted: false,
      },
    };

    await expect(rebuildDerivedStoryState(story, {
      revalidateDomainSafety: false,
    })).rejects.toMatchObject({
      name: 'StoryDerivedStateValidationError',
      message: expect.stringContaining('baseline-story-that-does-not-exist-20260724'),
    });
  });
});
