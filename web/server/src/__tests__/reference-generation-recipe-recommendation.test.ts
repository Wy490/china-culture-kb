import { describe, expect, it } from 'vitest';
import {
  recommendReferenceGenerationRecipes,
} from '../services/reference-generation-recipe-recommendation-service.js';

describe('reference generation recipe recommendations', () => {
  it('ranks long-goal structure first for an original character-choice story', () => {
    const result = recommendReferenceGenerationRecipes({
      creation_path: 'original',
      video_type: 'character_story',
      creation_use_case: 'original_ai_comic',
      truth_mode: 'fictional_original',
      subject_text: '一个修桥匠人坚持多年，在洪水前夜必须做出不可撤回的选择。',
      narrative_goal: '用长期行动、伏笔道具和最终代价证明人物信念。',
      material_features: ['documented_character_choice'],
    });

    expect(result.schema_version)
      .toBe('reference-generation-recipe-recommendation/v1');
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0]).toMatchObject({
      recipe_id: 'feature_long_goal_payoff',
      rank: 1,
    });
    expect(result.recommendations[0].reasons.length).toBeGreaterThan(0);
    expect(result.recommendations[0].contract.recipe_id)
      .toBe('feature_long_goal_payoff');
    expect(result.boundary).toEqual({
      optional_recommendation: true,
      user_may_decline: true,
      machine_recommendation_only: true,
      truth_and_material_boundaries_take_priority: true,
      production_credit_granted: false,
    });
  });

  it('prefers an epoch mosaic for multi-period biographical material', () => {
    const result = recommendReferenceGenerationRecipes({
      creation_path: 'adaptation',
      video_type: 'character_story',
      creation_use_case: 'adapted_ai_comic',
      truth_mode: 'source_adaptation',
      subject_text: '跨越三个时代阶段，以职业动作和人物关系串起一生。',
      narrative_goal: '避免年表式生平，让时代压力改变人物关系。',
      material_features: ['multi_period_scope', 'structured_knowledge_pack'],
    });

    expect(result.recommendations[0].recipe_id)
      .toBe('feature_epoch_character_mosaic');
    expect(result.recommendations[0].matched_signals)
      .toEqual(expect.arrayContaining(['multi_period_scope']));
  });

  it('puts truth first when institutional factual material is limited', () => {
    const result = recommendReferenceGenerationRecipes({
      creation_path: 'institutional',
      video_type: 'historical_drama',
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
      subject_text: '机构命题历史人物短片，但现有材料只有未经核验的传说。',
      narrative_goal: '稳妥传播。',
      material_features: ['institutional_brief', 'limited_or_unverified_material'],
    });

    expect(result.recommendations).toEqual([]);
    expect(result.no_recommendation_reason).toContain('真实性');
    expect(result.policy_warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('不得为套用配方'),
    ]));
  });

  it('ranks evidence-backed collective montage for an institutional culture promo', () => {
    const result = recommendReferenceGenerationRecipes({
      creation_path: 'institutional',
      video_type: 'culture_promo',
      creation_use_case: 'institutional_promo',
      truth_mode: 'factual_reconstruction',
      subject_text: '多位非遗实践者、多个地域动作共同证明文化传承。',
      narrative_goal: '用群像动作和统一主张完成机构传播。',
      material_features: [
        'institutional_brief',
        'ensemble_cast',
        'structured_knowledge_pack',
      ],
    });

    expect(result.recommendations[0].recipe_id)
      .toBe('promo_collective_montage');
    expect(result.policy_warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('事实'),
    ]));
  });

  it('recommends an evidence trail for a documentary with verified field material', () => {
    const result = recommendReferenceGenerationRecipes({
      creation_path: 'institutional',
      video_type: 'documentary_short',
      creation_use_case: 'documentary_short',
      truth_mode: 'factual_reconstruction',
      subject_text: '从现实现场、实物遗存和档案史料追踪事件证据。',
      narrative_goal: '区分现场观察、文献事实和谨慎推断，建立可核验的证据链。',
      material_features: ['structured_knowledge_pack', 'spatial_subject'],
    });

    expect(result.recommendations[0]).toMatchObject({
      recipe_id: 'documentary_evidence_trail',
      rank: 1,
    });
    expect(result.policy_warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('事实'),
    ]));
  });

  it.each([
    {
      video_type: 'heritage_promo' as const,
      creation_use_case: 'institutional_promo' as const,
      subject_text: '记录原料、工具、手部动作与关键工序，呈现传承人的实践。',
      narrative_goal: '让工艺变化和传承关系共同证明技艺价值。',
      material_features: ['structured_knowledge_pack', 'institutional_brief'] as const,
      recipe_id: 'heritage_craft_process_evidence',
    },
    {
      video_type: 'explainer_video' as const,
      creation_use_case: 'education_training' as const,
      subject_text: '解释为什么节气仪式形成，以及概念、例子和反例之间的关系。',
      narrative_goal: '用问题、概念、实例和回扣建立知识理解。',
      material_features: ['structured_knowledge_pack'] as const,
      recipe_id: 'explainer_question_to_example',
    },
  ])('recommends $recipe_id for $video_type', input => {
    const result = recommendReferenceGenerationRecipes({
      creation_path: 'institutional',
      video_type: input.video_type,
      creation_use_case: input.creation_use_case,
      truth_mode: 'institutional_verified',
      subject_text: input.subject_text,
      narrative_goal: input.narrative_goal,
      material_features: [...input.material_features],
    });

    expect(result.recommendations[0]).toMatchObject({
      recipe_id: input.recipe_id,
      rank: 1,
    });
  });

  it('never exposes research candidate titles in recommendation payloads', () => {
    const serialized = JSON.stringify(recommendReferenceGenerationRecipes({
      creation_path: 'original',
      video_type: 'ai_comic_drama',
      creation_use_case: 'original_ai_comic',
      truth_mode: 'fictional_original',
      subject_text: '家族礼仪中的潜台词与关系变化。',
      narrative_goal: '连续剧关系推进。',
      material_features: ['ritual_or_relationship_material', 'ensemble_cast'],
    }));

    expect(serialized).not.toMatch(
      /肖申克的救赎|霸王别姬|阿甘正传|教父|黑暗骑士|Welcome Home|Dumb Ways to Die|You Can.t Stop Us|三国演义|红楼梦/u,
    );
  });
});
