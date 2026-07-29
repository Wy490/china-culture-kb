import type {
  GenreStrictness,
  NarrativePatternId,
  PresentationStyle,
  ReferenceGenerationRecipeContract,
  ReferenceGenerationRecipeId,
  StoryGenerationPriority,
  VideoType,
} from './types.js';

export type ReferenceGenerationRecipeCategory =
  | 'feature_film'
  | 'promo'
  | 'classic_series';

export type { ReferenceGenerationRecipeId } from './types.js';

export interface ReferenceGenerationRecipe {
  id: ReferenceGenerationRecipeId;
  category: ReferenceGenerationRecipeCategory;
  label: string;
  summary: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  narrative_pattern_ids: NarrativePatternId[];
  story_priority: StoryGenerationPriority;
  genre_strictness: GenreStrictness;
  tone: string;
  communication_goal: string;
  reusable_mechanisms: string[];
  avoid_copying: string[];
}

export const REFERENCE_GENERATION_RECIPES: ReferenceGenerationRecipe[] = [
  {
    id: 'feature_long_goal_payoff',
    category: 'feature_film',
    label: '长线目标与延迟回收',
    summary: '以长期困境、隐蔽行动、物件伏笔和最终选择组织人物电影。',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    narrative_pattern_ids: ['mortal_growth', 'hero_choice', 'mystery_reveal'],
    story_priority: 'plot_first',
    genre_strictness: 'strict',
    tone: '克制、耐心、压迫中逐步积累希望',
    communication_goal: '让观众从长期行动与最终代价中理解人物信念，而不是依赖旁白评价。',
    reusable_mechanisms: [
      '给主角一个长期可执行目标，并让每次小行动同时承担生存与推进功能',
      '让道具、习惯或空间细节在后段获得新含义',
      '把人物价值放进不可撤回的选择与后果中完成',
    ],
    avoid_copying: [
      '不得复刻具体越狱、监禁或救赎情节',
      '不得复刻识别性人物关系、台词或道具组合',
      '不得用相同结局揭示替代原创因果',
    ],
  },
  {
    id: 'feature_epoch_character_mosaic',
    category: 'feature_film',
    label: '人物命运与时代拼图',
    summary: '以人物关系、职业或文化动作串起多个时代阶段。',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    narrative_pattern_ids: [
      'historical_causal_story',
      'character_arc_adaptation',
      'ensemble_threads',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '史诗感、细腻、人物关系与时代压力并重',
    communication_goal: '让时代变化通过关系、职业动作和人物选择被看见，避免写成年表式生平。',
    reusable_mechanisms: [
      '用一个持续多年的职业动作或文化母题连接时代切片',
      '每次时代跳跃都必须改变人物关系、身份或选择空间',
      '用配角立场变化证明主角命运，而不是只靠主角自述',
    ],
    avoid_copying: [
      '不得复刻具体戏曲人物、关系三角或历史桥段',
      '不得搬用识别性舞台调度、台词或时代蒙太奇',
      '不得把真实历史推断写成确定事实',
    ],
  },
  {
    id: 'feature_moral_pressure',
    category: 'feature_film',
    label: '权力压力与道德两难',
    summary: '通过多方目标、信息差和不断升级的选择代价推动类型电影。',
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    narrative_pattern_ids: [
      'power_strategy',
      'hero_choice',
      'historical_causal_story',
    ],
    story_priority: 'plot_first',
    genre_strictness: 'strict',
    tone: '冷静、紧张、权力关系清晰、选择后果沉重',
    communication_goal: '让冲突来自制度、名分、利益与信念的真实碰撞，并由行动结果完成主题。',
    reusable_mechanisms: [
      '每个主要角色都拥有公开目标、真实目标和可交换筹码',
      '每轮胜利必须暴露新的成本或更高层压力',
      '在仪式、会议或公共行动中交叉呈现私人关系与权力后果',
    ],
    avoid_copying: [
      '不得复刻具体犯罪家族、超级英雄或反派设定',
      '不得复刻标志性仪式、交叉剪辑桥段或对白',
      '不得用无铺垫反转替代信息差与人物选择',
    ],
  },
  {
    id: 'promo_space_emotion',
    category: 'promo',
    label: '空间变化与情绪品牌片',
    summary: '让产品、文化符号或地方元素成为空间与人物情绪变化的触发器。',
    video_type: 'culture_promo',
    presentation_style: 'cinematic',
    narrative_pattern_ids: [
      'brand_symbol',
      'space_walkthrough',
      'object_clue_journey',
    ],
    story_priority: 'plot_first',
    genre_strictness: 'balanced',
    tone: '沉浸、感性、低文案、以动作和空间变化表达',
    communication_goal: '让核心价值通过人物状态和空间变化被感知，结尾再完成品牌或文化落点。',
    reusable_mechanisms: [
      '建立变化前的受限人物状态与受限空间',
      '让核心符号触发一连串可见、递进且可逆的空间变化',
      '使用动作、音乐和美术完成情绪弧，减少解释性文案',
    ],
    avoid_copying: [
      '不得复刻识别性舞蹈、房间形变或美术设计',
      '不得沿用具体产品功能演示路径',
      '不得用风格奇观掩盖传播目标',
    ],
  },
  {
    id: 'promo_mnemonic_reveal',
    category: 'promo',
    label: '记忆旋律与结尾揭示',
    summary: '以重复节奏、递进短场景和最后信息揭示完成公益或社媒传播。',
    video_type: 'social_short',
    presentation_style: 'animation_2d',
    narrative_pattern_ids: [
      'social_hook_contrast',
      'mystery_reveal',
      'brand_symbol',
    ],
    story_priority: 'plot_first',
    genre_strictness: 'balanced',
    tone: '轻巧、反差、节奏鲜明、严肃信息延迟揭示',
    communication_goal: '先建立可记忆的观看模式，再在结尾把娱乐性动作收束为明确公共信息。',
    reusable_mechanisms: [
      '用固定节拍组织多个长度相近的递进短场景',
      '让重复句式或声音结构承担记忆锚点',
      '最后一个场景改变前面所有场景的传播含义',
    ],
    avoid_copying: [
      '不得复刻具体歌曲、角色造型或黑色笑料',
      '不得用伤害性内容换取传播',
      '不得让娱乐段落压过最终公共信息',
    ],
  },
  {
    id: 'promo_collective_montage',
    category: 'promo',
    label: '群像动作与主题蒙太奇',
    summary: '用跨人物动作匹配和统一旁白，把分散素材组织成同一价值主张。',
    video_type: 'culture_promo',
    presentation_style: 'voiceover_montage',
    narrative_pattern_ids: [
      'brand_symbol',
      'social_hook_contrast',
      'object_clue_journey',
    ],
    story_priority: 'balanced',
    genre_strictness: 'strict',
    tone: '有力量、节奏精准、群像平等、旁白与动作互证',
    communication_goal: '让不同人物、地域或技艺通过动作、构图和声音匹配共同证明一个文化主张。',
    reusable_mechanisms: [
      '按动作方向、身体姿态、构图或声音建立跨场景匹配点',
      '每句旁白必须得到至少两个不同场景的视觉验证',
      '从个体努力逐步扩展到群体共同价值',
    ],
    avoid_copying: [
      '不得复刻具体分屏构图、运动素材或旁白',
      '不得用无关系素材做表面卡点',
      '不得让品牌口号先于人物和文化证据出现',
    ],
  },
  {
    id: 'series_strategy_chapters',
    category: 'classic_series',
    label: '历史权谋章回连续剧',
    summary: '用阵营目标、谋略行动和阶段性结果组织长线历史系列。',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    narrative_pattern_ids: [
      'power_strategy',
      'chapter_slice_adaptation',
      'serial_hook_adaptation',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '庄重、清晰、谋略可见、章回推进',
    communication_goal: '让每集围绕一个历史压力和一个阶段目标闭环，同时持续推进阵营与人物长线。',
    reusable_mechanisms: [
      '每集先摆明阵营、资源、名分与当集目标',
      '谋略必须转化为调兵、谈判、文书、站位或公开选择',
      '集末给出阶段后果，并留下由因果自然产生的下一集问题',
    ],
    avoid_copying: [
      '不得复刻原著对白、章回标题或经典调度',
      '不得把史实人物简化成单一忠奸标签',
      '不得用旁白代替策略行动与后果',
    ],
  },
  {
    id: 'series_ritual_relationships',
    category: 'classic_series',
    label: '礼俗群像关系连续剧',
    summary: '通过礼俗、日常物件和低强度关系冲突积累长线命运。',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    narrative_pattern_ids: [
      'ensemble_threads',
      'dialogue_scene_adaptation',
      'serial_hook_adaptation',
    ],
    story_priority: 'balanced',
    genre_strictness: 'strict',
    tone: '含蓄、细腻、礼俗具体、关系潜台词充足',
    communication_goal: '让家族或共同体关系通过日常动作、礼俗规则、物件和未说出口的信息持续变化。',
    reusable_mechanisms: [
      '让礼俗流程同时承担身份排序、关系试探和情绪压力',
      '用物件递送、座次、称谓和停顿表现潜台词',
      '每集解决一个日常事件，同时改变至少两条人物关系',
    ],
    avoid_copying: [
      '不得复刻具体家族人物、诗词、对白或名场面',
      '不得把低强度冲突写成无推进的生活流水账',
      '不得用现代口号解释传统礼俗中的复杂关系',
    ],
  },
];

export const REFERENCE_GENERATION_RECIPE_VERSION = '1.0.0' as const;

const REFERENCE_GENERATION_RECIPE_PAYLOAD_SHA256: Record<
  ReferenceGenerationRecipeId,
  string
> = {
  feature_long_goal_payoff: 'd259b451b425835b869b8472548edadba5534415c1dd0cf6302980e54613ea64',
  feature_epoch_character_mosaic: '2e7342bc3209727cc269a596c1ba6b676fee0da9b032eed1e899462ddda1e14f',
  feature_moral_pressure: '48d7034e1a8569bf81b46888c07fc0a4fa691337b28029db48e4300bb551bd6a',
  promo_space_emotion: 'c41e9c25b7734e66540d42e37de04d64a096f26ffadb625123994f5ba3cc19cc',
  promo_mnemonic_reveal: '299f2eb149dcca7f20090a779cfd98b32fab91110f69914dc81e2b94da7af565',
  promo_collective_montage: '08aa2f93c254b45922184c0e1789ca96bf78bd50cf4a5f70e9a60668d17828b0',
  series_strategy_chapters: '36442de5dbb0f84e018e0a2093b9b99c1232be43d11a192b1a10833e5a595ad6',
  series_ritual_relationships: '99409049b84791fc20a32881fd300aa7b0800382c384dc24d99eb9e8ef978f69',
};

export function referenceGenerationRecipePayload(
  recipe: ReferenceGenerationRecipe,
): Omit<ReferenceGenerationRecipeContract, 'payload_sha256'> {
  return {
    schema_version: 'reference-generation-recipe/v1',
    recipe_id: recipe.id,
    recipe_version: REFERENCE_GENERATION_RECIPE_VERSION,
    reusable_mechanisms: [...recipe.reusable_mechanisms],
    avoid_copying: [...recipe.avoid_copying],
  };
}

export function buildReferenceGenerationRecipeContract(
  recipeId: ReferenceGenerationRecipeId,
): ReferenceGenerationRecipeContract {
  const recipe = REFERENCE_GENERATION_RECIPES.find(item => item.id === recipeId);
  if (!recipe) {
    throw new Error(`Unknown reference generation recipe "${recipeId}"`);
  }
  return {
    ...referenceGenerationRecipePayload(recipe),
    payload_sha256: REFERENCE_GENERATION_RECIPE_PAYLOAD_SHA256[recipe.id],
  };
}
