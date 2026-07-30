import {
  REFERENCE_GENERATION_RECIPES,
  buildReferenceGenerationRecipeContract,
} from '@shared/reference-generation-recipes.js';
import type {
  ReferenceGenerationRecipeId,
  ReferenceGenerationRecipeMaterialFeature,
  ReferenceGenerationRecipeRecommendation,
  ReferenceGenerationRecipeRecommendationRequest,
  ReferenceGenerationRecipeRecommendationResult,
} from '@shared/types.js';

interface RecipeRecommendationSignals {
  creation_paths: ReferenceGenerationRecipeRecommendationRequest['creation_path'][];
  material_features: ReferenceGenerationRecipeMaterialFeature[];
  keywords: string[];
  reason: string;
}

const RECIPE_SIGNALS = {
  feature_long_goal_payoff: {
    creation_paths: ['original', 'adaptation'],
    material_features: ['documented_character_choice'],
    keywords: ['长期', '多年', '坚持', '目标', '伏笔', '道具', '选择', '代价', '信念', '成长'],
    reason: '题材包含长期目标、行动积累或关键选择，适合用延迟回收证明人物信念。',
  },
  feature_epoch_character_mosaic: {
    creation_paths: ['adaptation', 'institutional'],
    material_features: ['multi_period_scope', 'structured_knowledge_pack', 'ensemble_cast'],
    keywords: ['时代', '年代', '一生', '生平', '年表', '跨越', '职业', '关系', '群像', '阶段'],
    reason: '素材具有多阶段、时代或人物关系线索，适合用命运切片代替年表堆叠。',
  },
  feature_moral_pressure: {
    creation_paths: ['original', 'adaptation', 'institutional'],
    material_features: ['documented_character_choice', 'strategy_or_power_material'],
    keywords: ['权力', '制度', '名分', '利益', '道德', '两难', '压力', '选择', '后果', '策略'],
    reason: '题材包含制度压力、利益冲突或道德选择，适合用多方目标和代价推进。',
  },
  promo_space_emotion: {
    creation_paths: ['institutional', 'original'],
    material_features: ['spatial_subject'],
    keywords: ['空间', '城市', '地方', '场所', '建筑', '变化', '沉浸', '情绪', '文旅', '体验'],
    reason: '传播对象具有明确空间或地方体验，适合让空间变化承载情绪与价值。',
  },
  promo_mnemonic_reveal: {
    creation_paths: ['institutional', 'original'],
    material_features: ['public_service_goal', 'rhythmic_short_scene_material'],
    keywords: ['公益', '社媒', '节奏', '重复', '旋律', '记忆', '揭示', '反差', '短场景', '传播'],
    reason: '目标强调短时记忆、节奏或结尾揭示，适合用重复结构建立传播锚点。',
  },
  promo_collective_montage: {
    creation_paths: ['institutional', 'adaptation'],
    material_features: ['ensemble_cast', 'institutional_brief', 'structured_knowledge_pack'],
    keywords: ['群像', '多位', '多个', '共同', '集体', '地域', '技艺', '机构', '统一主张', '传承'],
    reason: '素材包含多人物、多地域或多行动证据，适合用匹配剪辑共同证明传播主张。',
  },
  heritage_craft_process_evidence: {
    creation_paths: ['institutional', 'adaptation'],
    material_features: ['structured_knowledge_pack', 'institutional_brief'],
    keywords: ['非遗', '工艺', '原料', '工具', '手部', '工序', '步骤', '成品', '实践者', '传承'],
    reason: '素材包含可核验的工艺过程和实践者信息，适合用材料变化与关键工序证明技艺价值。',
  },
  documentary_evidence_trail: {
    creation_paths: ['institutional', 'adaptation'],
    material_features: ['structured_knowledge_pack', 'spatial_subject', 'multi_period_scope'],
    keywords: ['现场', '实物', '遗存', '档案', '史料', '证据', '见证', '核验', '推断', '来源'],
    reason: '素材包含现场、实物或文献证据，适合从问题出发建立来源分层清楚的纪录片证据链。',
  },
  explainer_question_to_example: {
    creation_paths: ['institutional', 'adaptation', 'original'],
    material_features: ['structured_knowledge_pack'],
    keywords: ['为什么', '概念', '知识', '解释', '实例', '例子', '反例', '原理', '步骤', '关系'],
    reason: '目标强调理解概念与原理，适合用核心问题、实例、反例和回扣建立解释链。',
  },
  legend_symbolic_trial: {
    creation_paths: ['adaptation', 'original'],
    material_features: ['ritual_or_relationship_material', 'structured_knowledge_pack'],
    keywords: ['传说', '神异', '征兆', '口述', '版本', '象征', '考验', '承诺', '选择', '凡人'],
    reason: '素材具有口述版本、象征意象或神异考验，适合让凡人选择承担传说意义。',
  },
  children_gentle_choice_loop: {
    creation_paths: ['original', 'adaptation'],
    material_features: ['documented_character_choice'],
    keywords: ['儿童', '孩子', '温和', '尝试', '犯错', '互助', '成长', '守信', '重复', '物件'],
    reason: '目标强调儿童成长和清楚因果，适合用温和尝试、反馈与最终选择组织故事。',
  },
  promo_city_day_identity: {
    creation_paths: ['institutional', 'adaptation'],
    material_features: ['spatial_subject', 'institutional_brief', 'structured_knowledge_pack'],
    keywords: ['城市', '地标', '街区', '河岸', '市场', '居民', '生活', '路线', '昼夜', '文旅'],
    reason: '素材具有可识别城市空间和居民生活，适合沿一日路线建立地方身份。',
  },
  lecture_case_to_action: {
    creation_paths: ['institutional', 'adaptation'],
    material_features: ['structured_knowledge_pack', 'institutional_brief', 'documented_character_choice'],
    keywords: ['案例', '观点', '事实', '选择', '精神', '现实', '行动', '号召', '论证', '意义'],
    reason: '素材包含有来源案例和现实主张，适合从事实、选择与反思推进到具体行动。',
  },
  training_objective_practice_feedback: {
    creation_paths: ['institutional', 'adaptation'],
    material_features: ['structured_knowledge_pack', 'institutional_brief'],
    keywords: ['培训', '学习目标', '步骤', '示范', '练习', '错误', '反馈', '纠错', '复盘', '考核'],
    reason: '任务要求可操作学习路径，适合用目标、示范、练习、反馈和复盘形成教学闭环。',
  },
  spatial_route_time_layers: {
    creation_paths: ['institutional', 'adaptation', 'original'],
    material_features: ['spatial_subject', 'structured_knowledge_pack'],
    keywords: ['空间', '路线', '入口', '院落', '节点', '移动', '物件', '痕迹', '古今', '时间层'],
    reason: '素材具有明确空间节点和历史痕迹，适合用连续路线让时间层逐步显影。',
  },
  landscape_sensory_breath: {
    creation_paths: ['original', 'institutional', 'adaptation'],
    material_features: ['spatial_subject'],
    keywords: ['山水', '晨雾', '风声', '雨痕', '暮色', '光影', '天气', '感官', '留白', '意境'],
    reason: '目标强调自然状态和诗性留白，适合用感官与光影流变组织低密度意境。',
  },
  series_strategy_chapters: {
    creation_paths: ['adaptation', 'original'],
    material_features: ['strategy_or_power_material', 'structured_knowledge_pack'],
    keywords: ['历史', '权谋', '策略', '阵营', '资源', '名分', '战争', '谈判', '章回', '连续'],
    reason: '素材包含阵营、资源和策略行动，适合按阶段目标组织章回推进。',
  },
  series_ritual_relationships: {
    creation_paths: ['adaptation', 'original'],
    material_features: ['ritual_or_relationship_material', 'ensemble_cast'],
    keywords: ['礼俗', '仪式', '家族', '关系', '潜台词', '日常', '物件', '座次', '称谓', '群像'],
    reason: '素材以礼俗、日常动作或关系潜台词见长，适合用低强度事件积累长线变化。',
  },
} satisfies Record<ReferenceGenerationRecipeId, RecipeRecommendationSignals>;

const FACT_SENSITIVE_TRUTH_MODES = new Set([
  'factual_reconstruction',
  'institutional_verified',
]);

const BOUNDARY: ReferenceGenerationRecipeRecommendationResult['boundary'] = {
  optional_recommendation: true,
  user_may_decline: true,
  machine_recommendation_only: true,
  truth_and_material_boundaries_take_priority: true,
  production_credit_granted: false,
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function scoreRecipe(
  recipeId: ReferenceGenerationRecipeId,
  request: ReferenceGenerationRecipeRecommendationRequest,
): Omit<ReferenceGenerationRecipeRecommendation, 'rank' | 'contract'> {
  const signals: RecipeRecommendationSignals = RECIPE_SIGNALS[recipeId];
  const materialFeatures = request.material_features ?? [];
  const searchableText = `${request.subject_text ?? ''}\n${request.narrative_goal ?? ''}`
    .toLocaleLowerCase('zh-CN');
  const matchedFeatures = signals.material_features
    .filter(feature => materialFeatures.includes(feature));
  const matchedKeywords = signals.keywords
    .filter(keyword => searchableText.includes(keyword.toLocaleLowerCase('zh-CN')));
  const creationPathMatched = signals.creation_paths.includes(request.creation_path);
  const matchedSignals = unique([
    ...matchedFeatures,
    ...matchedKeywords.map(keyword => `text:${keyword}`),
    creationPathMatched ? `creation_path:${request.creation_path}` : '',
  ]);
  const score = Math.min(
    100,
    40
      + (creationPathMatched ? 8 : 0)
      + matchedFeatures.length * 12
      + Math.min(5, matchedKeywords.length) * 6
      + (request.creation_use_case ? 3 : 0),
  );
  const reasons = [
    signals.reason,
    matchedFeatures.length
      ? `素材特征匹配：${matchedFeatures.join('、')}。`
      : '',
    matchedKeywords.length
      ? `题材/目标信号匹配：${matchedKeywords.slice(0, 5).join('、')}。`
      : '',
  ].filter(Boolean);
  return {
    recipe_id: recipeId,
    score,
    confidence: score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low',
    reasons,
    matched_signals: matchedSignals,
  };
}

export function recommendReferenceGenerationRecipes(
  request: ReferenceGenerationRecipeRecommendationRequest,
): ReferenceGenerationRecipeRecommendationResult {
  const factSensitive = Boolean(
    request.truth_mode && FACT_SENSITIVE_TRUTH_MODES.has(request.truth_mode),
  );
  const limitedMaterial = request.material_features
    ?.includes('limited_or_unverified_material') ?? false;
  const policyWarnings = factSensitive
    ? ['事实型或机构审定任务必须以已核验材料为先；配方只能组织表达，不能补造事实。']
    : [];

  if (factSensitive && limitedMaterial) {
    return {
      schema_version: 'reference-generation-recipe-recommendation/v1',
      recommendations: [],
      policy_warnings: [
        ...policyWarnings,
        '当前素材有限或待核实，不得为套用配方牺牲真实性、机构口径或材料边界。',
      ],
      no_recommendation_reason: '真实性优先：请先补齐和核验关键材料，再评估是否使用创作配方。',
      boundary: BOUNDARY,
    };
  }

  const compatibleRecipes = REFERENCE_GENERATION_RECIPES
    .filter(recipe => recipe.video_type === request.video_type);
  if (!compatibleRecipes.length) {
    return {
      schema_version: 'reference-generation-recipe-recommendation/v1',
      recommendations: [],
      policy_warnings: policyWarnings,
      no_recommendation_reason: `当前成片类型 ${request.video_type} 没有兼容的 canonical 创作配方；保持无配方生成。`,
      boundary: BOUNDARY,
    };
  }

  const recommendations = compatibleRecipes
    .map((recipe, catalogIndex) => ({
      ...scoreRecipe(recipe.id, request),
      catalogIndex,
      contract: buildReferenceGenerationRecipeContract(recipe.id),
    }))
    .sort((left, right) =>
      right.score - left.score || left.catalogIndex - right.catalogIndex
    )
    .slice(0, 3)
    .map(({ catalogIndex: _catalogIndex, ...item }, index) => ({
      ...item,
      rank: index + 1,
    }));

  return {
    schema_version: 'reference-generation-recipe-recommendation/v1',
    recommendations,
    policy_warnings: policyWarnings,
    boundary: BOUNDARY,
  };
}
