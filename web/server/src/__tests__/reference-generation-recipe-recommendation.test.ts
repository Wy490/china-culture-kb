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

  it.each([
    {
      creation_path: 'adaptation' as const,
      video_type: 'legend_story' as const,
      creation_use_case: 'adapted_ai_comic' as const,
      truth_mode: 'source_adaptation' as const,
      subject_text: '一个地方传说以神异征兆考验凡人的承诺与选择，不同口述版本保留差异。',
      narrative_goal: '用象征意象、重复考验和人的选择表现传说意义。',
      material_features: ['ritual_or_relationship_material'] as const,
      recipe_id: 'legend_symbolic_trial',
    },
    {
      creation_path: 'original' as const,
      video_type: 'children_story' as const,
      creation_use_case: 'original_ai_comic' as const,
      truth_mode: 'fictional_original' as const,
      subject_text: '孩子和会说话的小纸鸢遇到一个温和难题，通过尝试、犯错和互助学会守信。',
      narrative_goal: '用重复物件、简单因果和温暖选择完成成长。',
      material_features: ['documented_character_choice'] as const,
      recipe_id: 'children_gentle_choice_loop',
    },
    {
      creation_path: 'institutional' as const,
      video_type: 'city_brand_promo' as const,
      creation_use_case: 'institutional_promo' as const,
      truth_mode: 'institutional_verified' as const,
      subject_text: '沿河岸、老街、市场和夜间公共空间展开城市一日，地标与居民生活互相连接。',
      narrative_goal: '用真实路线和生活动作凝练城市身份，而不是堆空镜。',
      material_features: ['spatial_subject', 'institutional_brief'] as const,
      recipe_id: 'promo_city_day_identity',
    },
    {
      creation_path: 'institutional' as const,
      video_type: 'lecture_video' as const,
      creation_use_case: 'public_service' as const,
      truth_mode: 'institutional_verified' as const,
      subject_text: '从一个有来源的真实案例提出观点，解释人物选择、现实意义与可执行行动。',
      narrative_goal: '让事实、论点和行动号召逐层成立。',
      material_features: ['structured_knowledge_pack', 'institutional_brief'] as const,
      recipe_id: 'lecture_case_to_action',
    },
    {
      creation_path: 'institutional' as const,
      video_type: 'education_training' as const,
      creation_use_case: 'education_training' as const,
      truth_mode: 'institutional_verified' as const,
      subject_text: '培训课程需要明确学习目标、步骤示范、练习、反馈和复盘标准。',
      narrative_goal: '让学习者完成一次可观察、可纠错的操作闭环。',
      material_features: ['structured_knowledge_pack', 'institutional_brief'] as const,
      recipe_id: 'training_objective_practice_feedback',
    },
    {
      creation_path: 'institutional' as const,
      video_type: 'scene_short' as const,
      creation_use_case: 'institutional_promo' as const,
      truth_mode: 'factual_reconstruction' as const,
      subject_text: '从城门进入院落再抵达后园，沿空间路线观察物件、人物痕迹和古今时间层。',
      narrative_goal: '让镜头移动揭示空间身份和历史记忆。',
      material_features: ['spatial_subject', 'structured_knowledge_pack'] as const,
      recipe_id: 'spatial_route_time_layers',
    },
    {
      creation_path: 'original' as const,
      video_type: 'landscape_mood' as const,
      creation_use_case: 'brand_commercial' as const,
      truth_mode: 'inspired_by_material' as const,
      subject_text: '山水在晨雾、风声、雨痕和暮色中缓慢变化，只留下少量人文痕迹。',
      narrative_goal: '用感官递进、光影流变和低密度旁白形成留白。',
      material_features: ['spatial_subject'] as const,
      recipe_id: 'landscape_sensory_breath',
    },
  ])('covers the remaining $video_type recipe with $recipe_id', input => {
    const result = recommendReferenceGenerationRecipes({
      creation_path: input.creation_path,
      video_type: input.video_type,
      creation_use_case: input.creation_use_case,
      truth_mode: input.truth_mode,
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
