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
  | 'story'
  | 'promo'
  | 'knowledge'
  | 'spatial'
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
    id: 'legend_symbolic_trial',
    category: 'story',
    label: '象征考验与凡人选择',
    summary: '用重复意象、递进考验和凡人选择组织有口述边界的传说故事。',
    video_type: 'legend_story',
    presentation_style: 'ink_style',
    narrative_pattern_ids: [
      'folk_legend_trial',
      'object_clue_journey',
      'mystery_reveal',
    ],
    story_priority: 'plot_first',
    genre_strictness: 'strict',
    tone: '神秘、质朴、有口述节奏，神异奇观服务人的选择',
    communication_goal: '让观众通过一个凡人在神异考验中的行动理解传说意义，并知道它属于何种口述版本。',
    reusable_mechanisms: [
      '用一个可反复出现的自然意象或民间物件建立传说规则',
      '让每轮神异考验都增加选择代价，并暴露人物欲望或承诺',
      '用最终选择改变意象含义，再标明传说版本与史实边界',
    ],
    avoid_copying: [
      '不得把地方口述、神异事件或象征解释写成确定史实',
      '不得复刻既有神话人物组合、法器、关卡或结局',
      '不得只堆奇观、怪物和预言而省略凡人的行动选择',
    ],
  },
  {
    id: 'children_gentle_choice_loop',
    category: 'story',
    label: '温和尝试与成长选择',
    summary: '以熟悉物件、重复尝试和温和后果组织儿童可理解的文化成长故事。',
    video_type: 'children_story',
    presentation_style: 'children_animation',
    narrative_pattern_ids: [
      'children_fable',
      'folk_legend_trial',
      'mortal_growth',
    ],
    story_priority: 'plot_first',
    genre_strictness: 'strict',
    tone: '明亮、温和、好奇，冲突安全且因果清楚',
    communication_goal: '让儿童通过主人公的尝试、犯错、互助和修正理解一个可执行的正向选择。',
    reusable_mechanisms: [
      '用儿童熟悉的目标和可重复出现的物件建立简单问题',
      '按尝试、犯错、获得帮助、再次尝试组织清楚因果',
      '让最终选择产生温和可见的后果，并回收重复物件',
    ],
    avoid_copying: [
      '不得使用恐怖、羞辱、残酷惩罚或成人化关系制造刺激',
      '不得复刻识别性童话角色、魔法规则、对白或结局',
      '不得用成人说教替代儿童自己观察、尝试和做出选择',
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
    id: 'heritage_craft_process_evidence',
    category: 'promo',
    label: '工艺过程与传承证据',
    summary: '以材料变化、关键工序和实践者关系证明非遗技艺价值。',
    video_type: 'heritage_promo',
    presentation_style: 'documentary',
    narrative_pattern_ids: [
      'craft_mastery',
      'ritual_process',
      'object_clue_journey',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '克制、细致、重视材料质感与真实劳动',
    communication_goal: '让观众从原料、工具、手部动作和成品变化中理解技艺难度与传承关系。',
    reusable_mechanisms: [
      '用原料初始状态与成品状态建立可见的过程问题',
      '按不可跳步的关键工序组织动作、工具、判断标准和失败风险',
      '让实践者之间的示范、纠正与接力承担传承表达',
    ],
    avoid_copying: [
      '不得虚构未经材料支持的工序、口诀或传承谱系',
      '不得用空泛匠心口号替代材料、工具和手部动作',
      '不得把宣传性判断写成已经完成的机构或法律认证',
    ],
  },
  {
    id: 'promo_city_day_identity',
    category: 'promo',
    label: '城市一日与生活身份',
    summary: '沿真实空间路线连接地标、居民动作和昼夜变化，形成可识别的城市气质。',
    video_type: 'city_brand_promo',
    presentation_style: 'voiceover_montage',
    narrative_pattern_ids: [
      'city_day_journey',
      'brand_symbol',
      'object_clue_journey',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '开放、鲜活、有生活温度，地标与居民平等',
    communication_goal: '让观众从一条可追踪路线和真实生活动作中辨认城市，而不是只记住宣传口号。',
    reusable_mechanisms: [
      '按清晨、白昼、黄昏或夜晚组织一条可验证的城市空间路线',
      '让每个地标与一种居民动作、声音或公共生活发生关系',
      '从多个生活片段提炼城市主张，并回到开场空间完成身份闭环',
    ],
    avoid_copying: [
      '不得虚构地标位置、地方历史、节庆传统或居民身份',
      '不得用航拍、空镜和泛化口号替代可识别的空间路线',
      '不得把游客消费视角冒充城市居民的完整生活经验',
    ],
  },
  {
    id: 'documentary_evidence_trail',
    category: 'knowledge',
    label: '现场问题与证据追踪',
    summary: '从现实现场提出问题，以实物、档案和见证材料建立可核验的纪录片证据链。',
    video_type: 'documentary_short',
    presentation_style: 'documentary',
    narrative_pattern_ids: [
      'documentary_investigation',
      'historical_causal_story',
      'object_clue_journey',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '客观、探究、证据优先、对未知保持克制',
    communication_goal: '让每个历史或文化判断都能回到现实现场、来源层级与明确的不确定性边界。',
    reusable_mechanisms: [
      '从今天仍可观察的地点、实物或现象提出一个可核验问题',
      '交替使用现场观察、文献记录和受约束的解释推进证据链',
      '在结尾区分已经证实、合理推断和仍待核验的内容',
    ],
    avoid_copying: [
      '不得伪造采访、引语、时间码、档案出处或现场观察',
      '不得把影视化再现剪成未经标识的真实记录',
      '不得用情绪蒙太奇替代证据之间的因果连接',
    ],
  },
  {
    id: 'explainer_question_to_example',
    category: 'knowledge',
    label: '问题拆解与实例回扣',
    summary: '围绕一个知识问题，用概念、实例、反例和回扣建立可理解的解释链。',
    video_type: 'explainer_video',
    presentation_style: 'host_narration',
    narrative_pattern_ids: [
      'knowledge_gap_explainer',
      'historical_causal_story',
      'object_clue_journey',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '清楚、准确、层级分明、亲切但不简化事实',
    communication_goal: '让观众不仅记住结论，还能用实例说明概念、识别边界并回答开场问题。',
    reusable_mechanisms: [
      '先提出一个观众能够复述的核心问题并标明理解障碍',
      '按概念定义、具体实例、易错反例和视觉证据逐层解释',
      '结尾回扣开场问题，并给出可复述的判断步骤而非口号',
    ],
    avoid_copying: [
      '不得把未经证实的起源传说包装成知识结论',
      '不得把类比、动画示意或个案当成事实本身',
      '不得只堆结论、术语和金句而省略解释过程',
    ],
  },
  {
    id: 'lecture_case_to_action',
    category: 'knowledge',
    label: '案例论证与现实行动',
    summary: '由有来源的案例提出观点，经事实与反思形成克制、可执行的宣讲结尾。',
    video_type: 'lecture_video',
    presentation_style: 'host_narration',
    narrative_pattern_ids: [
      'lecture_case_argument',
      'historical_causal_story',
      'hero_choice',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '真诚、清楚、有感染力但不过度煽情',
    communication_goal: '让观众看到观点如何由事实和人物选择成立，并能把结尾号召转成具体行动。',
    reusable_mechanisms: [
      '用一个来源明确的案例困境提出中心观点而非先喊口号',
      '按事实经过、关键选择、结果与反思逐层建立论证',
      '把精神提炼连接到当下场景，并给出具体可执行行动',
    ],
    avoid_copying: [
      '不得为增强感染力而虚构案例、引语、数据或人物选择',
      '不得把复杂历史和文化议题压缩成单一价值标签',
      '不得以抽象号召、名言堆叠或情绪音乐替代事实论证',
    ],
  },
  {
    id: 'training_objective_practice_feedback',
    category: 'knowledge',
    label: '目标练习与反馈闭环',
    summary: '以可观察学习目标、步骤示范、主动练习和纠错反馈组织教育培训内容。',
    video_type: 'education_training',
    presentation_style: 'host_narration',
    narrative_pattern_ids: [
      'training_loop',
      'knowledge_gap_explainer',
      'craft_mastery',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '明确、耐心、可操作，鼓励学习者主动判断',
    communication_goal: '让学习者完成一次可观察、可练习、可纠错和可复盘的知识或技能闭环。',
    reusable_mechanisms: [
      '把学习目标写成完成后能够观察或检验的行为',
      '按示范、分步练习、常见错误和即时反馈组织学习循环',
      '用迁移任务和复盘清单检验学习者是否能独立完成',
    ],
    avoid_copying: [
      '不得虚构安全规范、工艺参数、操作资格或考核标准',
      '不得只播放完整示范而省略练习、反馈和错误纠正',
      '不得把宣传介绍或知识罗列包装成已经完成的培训效果',
    ],
  },
  {
    id: 'spatial_route_time_layers',
    category: 'spatial',
    label: '空间路线与时间显影',
    summary: '让镜头沿可追踪路线移动，通过节点、物件和人物痕迹揭示空间的时间层。',
    video_type: 'scene_short',
    presentation_style: 'cinematic',
    narrative_pattern_ids: [
      'space_walkthrough',
      'object_clue_journey',
      'poetic_landscape',
    ],
    story_priority: 'knowledge_first',
    genre_strictness: 'strict',
    tone: '沉浸、清晰、有历史回声，空间是叙事主体',
    communication_goal: '让观众知道镜头从哪里到哪里、每个空间节点为何重要，以及古今痕迹如何在路线中相遇。',
    reusable_mechanisms: [
      '用入口、转折点和终点建立连续且可复述的镜头路线',
      '让每个空间节点通过物件、声音或人物痕迹显出一个时间层',
      '在终点回望起点，使空间身份和历史记忆完成闭环',
    ],
    avoid_copying: [
      '不得虚构建筑关系、历史用途、地点事件或不可见空间',
      '不得把地点短片改写成人物传记或百科式背景介绍',
      '不得用无方向空镜和跳切破坏空间路线的可理解性',
    ],
  },
  {
    id: 'landscape_sensory_breath',
    category: 'spatial',
    label: '感官流变与山水留白',
    summary: '用声音、天气、光影和低密度人文痕迹组织具有呼吸感的山水意境。',
    video_type: 'landscape_mood',
    presentation_style: 'ink_style',
    narrative_pattern_ids: [
      'poetic_landscape',
      'space_walkthrough',
      'object_clue_journey',
    ],
    story_priority: 'balanced',
    genre_strictness: 'strict',
    tone: '安静、诗性、低密度，以感官变化和留白推进',
    communication_goal: '让观众通过连续的自然状态变化形成情绪体验，同时保持地点、物候和文化引用准确。',
    reusable_mechanisms: [
      '按声音、空气、光影或天气的细微变化组织镜头呼吸',
      '让少量人文痕迹进入山水，但不抢占自然意境主体',
      '用前后呼应的自然意象收束，保留未被旁白解释的空间',
    ],
    avoid_copying: [
      '不得错配地点、季节、物候、诗文出处或文化意象',
      '不得用密集剧情、知识点和宣传口号破坏山水留白',
      '不得复刻识别性画作构图、诗句组合或视听段落',
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
  heritage_craft_process_evidence: 'e66e93f0f0afad4251e28cbaef1113547d054412bad19bedf98815952ad3ed68',
  documentary_evidence_trail: 'f91200727ac14156371340a589fb7bfd3a9d4e5448239b90d9993b2375ac071c',
  explainer_question_to_example: 'acdb92cd37ef5625ca0d510dfbf09a405f4d15782e578e5583b4ccfda6a7c828',
  legend_symbolic_trial: 'f790d1d1b9fffb910807ed53e8823511f292f7a4e1fa55a3d50779d0301b6fe3',
  children_gentle_choice_loop: '6b2db6d901741534c6221e3160deba22022055def9fbfd57f862d9e9ce224301',
  promo_city_day_identity: '3def9c2d6eaebd92f0f12f3333f2c21a9c1dd3b94732e743b30eeb88c25ab0a9',
  lecture_case_to_action: 'd3ef43d671d0622c381571df0e999c6f9b55f4b0038a8209303a2e05d273fd23',
  training_objective_practice_feedback: '397859cb00b56a37433ea9ff561f278245a6cf2380b34146b7cb372b0d2f8c98',
  spatial_route_time_layers: 'a00e77ea8cb5b84a1eb815d1a5779d469dcb751b32590fb0ef9bf0ceab86b0dd',
  landscape_sensory_breath: 'ff15dff7ec6093274ef874dc8125591fe3fcd2fa03778e91f16af977f37a7ab9',
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
