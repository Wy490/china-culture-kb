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
