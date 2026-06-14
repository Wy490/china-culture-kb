// web/server/src/services/narrative-pattern-library.ts
// Reusable narrative pattern packs distilled from genre traditions and classic
// story mechanisms. These are structural references, not plot/style copying.

import type {
  NarrativePattern,
  NarrativePatternCatalog,
  NarrativePatternId,
  VideoType,
} from '@shared/types.js';

const PATTERNS: Record<NarrativePatternId, NarrativePattern> = {
  mortal_growth: {
    pattern_id: 'mortal_growth',
    label: '凡人流成长',
    reference_archetypes: ['凡人修仙传式弱者成长机制', '底层逆袭长线成长故事'],
    narrative_engine: '低起点角色在高压规则中靠谨慎、资源管理和长期积累推进。',
    protagonist_engine: '主角不是天选全能，而是目标明确、风险敏感、能忍耐并持续学习。',
    conflict_engine: '强者压迫、资源稀缺、规则不公、阶段突破和隐藏底牌交替制造爽点。',
    pacing_pattern: ['低位处境', '发现机会', '谨慎试探', '付出代价', '阶段突破', '更大规则显现'],
    scene_recipes: ['弱者被迫进入强者规则', '小资源换来关键转机', '表面退让实则保存底牌', '突破后立刻出现更高门槛'],
    quality_signals: ['起点低', '成长有代价', '资源逻辑清楚', '胜利不是凭空开挂'],
    avoid: ['主角无代价开挂', '只写升级不写生存压力', '复刻具体修仙设定和人物'],
  },
  infinite_mission: {
    pattern_id: 'infinite_mission',
    label: '无限流任务生存',
    reference_archetypes: ['无限恐怖式任务副本机制', '关卡生存与团队博弈故事'],
    narrative_engine: '角色被投入规则明确的任务场，必须在倒计时、惩罚和隐藏机制下完成目标。',
    protagonist_engine: '主角通过读规则、识别队友能力、承担风险和反转策略推进。',
    conflict_engine: '任务目标、失败惩罚、隐藏规则、团队分歧和结算反馈持续升级。',
    pacing_pattern: ['进入任务', '公布规则', '第一次误判', '隐藏机制暴露', '团队牺牲或选择', '结算钩子'],
    scene_recipes: ['规则公告定场', '队友能力互补', '违反规则造成代价', '最后一刻发现真正目标'],
    quality_signals: ['任务规则清楚', '失败代价可见', '团队分工明确', '结尾有结算或下一关'],
    avoid: ['规则模糊', '只写怪物压迫不写任务逻辑', '复制具体副本和角色'],
  },
  historical_causal_story: {
    pattern_id: 'historical_causal_story',
    label: '历史因果讲述',
    reference_archetypes: ['明朝那些事儿式历史因果讲述', '通俗历史叙事'],
    narrative_engine: '把历史事件拆成性格、利益、制度、局势和选择的因果链。',
    protagonist_engine: '人物被放进时代压力中，通过选择暴露性格和局限。',
    conflict_engine: '制度困局、权力关系、现实利益和个人信念形成多层冲突。',
    pacing_pattern: ['时代问题', '关键人物入局', '利益与制度压力', '决定性选择', '后果扩散', '历史余响'],
    scene_recipes: ['用一个问题解释一段历史', '从人物性格推导决策', '把制度压力写成具体场景'],
    quality_signals: ['因果链清楚', '人物不是年表', '制度压力可见', '史实边界明确'],
    avoid: ['仿写特定作者腔调', '用段子替代史实边界', '把推断写成确证史料'],
  },
  power_strategy: {
    pattern_id: 'power_strategy',
    label: '权谋博弈',
    reference_archetypes: ['朝堂权谋故事', '多方势力博弈叙事'],
    narrative_engine: '多个角色围绕资源、名分、情报和位置进行策略交换。',
    protagonist_engine: '主角通过判断人心、识别局势和选择站位推进。',
    conflict_engine: '明面目标和真实目标不一致，胜负来自信息差与代价交换。',
    pacing_pattern: ['局势摆盘', '试探交锋', '信息反转', '代价显现', '关键站位', '余波留钩'],
    scene_recipes: ['一场话里有两层目的', '表面胜利隐藏成本', '配角反应暴露真实局势'],
    quality_signals: ['多方目标清楚', '信息差成立', '选择有代价', '反转来自前文铺垫'],
    avoid: ['全靠台词解释阴谋', '反转无铺垫', '人物只会装深沉'],
  },
  hero_choice: {
    pattern_id: 'hero_choice',
    label: '人物高光选择',
    reference_archetypes: ['单事件人物传记', '英雄人物精神短片'],
    narrative_engine: '用一次关键选择照亮人物长期价值。',
    protagonist_engine: '主角在外部压力和内心信念之间做不可撤回的选择。',
    conflict_engine: '安全、利益、名声、职责和信念之间形成两难。',
    pacing_pattern: ['危机压近', '价值冲突', '旁人阻拦', '主角行动', '代价落地', '精神被看见'],
    scene_recipes: ['一个动作胜过一段评价', '配角质疑主角选择', '结尾由他人反应证明影响'],
    quality_signals: ['目标明确', '两难成立', '行动具体', '精神落点来自选择'],
    avoid: ['空泛歌颂', '只写成就清单', '没有代价的高光'],
  },
  folk_legend_trial: {
    pattern_id: 'folk_legend_trial',
    label: '传说考验',
    reference_archetypes: ['民间传说', '神话寓言', '志异故事'],
    narrative_engine: '神异意象给凡人设置考验，结尾解释传说为何流传。',
    protagonist_engine: '凡人因善念、贪念、执念或勇气触发命运转折。',
    conflict_engine: '禁忌、预兆、异象和选择后果制造传说张力。',
    pacing_pattern: ['古老传闻', '异象出现', '凡人试探', '违反或守住禁忌', '命运转折', '流传至今'],
    scene_recipes: ['重复出现的神异物象', '老人或地名承载传说入口', '结尾回到习俗或地貌'],
    quality_signals: ['神异服务选择', '传说边界清楚', '象征意象贯穿', '结尾有流传理由'],
    avoid: ['把传说写成确证历史', '只堆奇观没有人的选择', '现代解释压过故事'],
  },
  mystery_reveal: {
    pattern_id: 'mystery_reveal',
    label: '悬疑揭示',
    reference_archetypes: ['线索解谜故事', '反转短片'],
    narrative_engine: '用一个异常现象驱动观众追问，逐步揭示真相。',
    protagonist_engine: '主角通过观察、追问、验证和重新解释线索推进。',
    conflict_engine: '表面解释与真实原因冲突，关键线索在后半段重新定义。',
    pacing_pattern: ['异常开场', '错误解释', '关键线索', '压力加码', '真相反转', '余味问题'],
    scene_recipes: ['开头给一个不合常理画面', '中段让同一物件出现新含义', '结尾回扣第一幕'],
    quality_signals: ['异常足够强', '线索可回扣', '反转有铺垫', '真相改变前文意义'],
    avoid: ['靠硬转折欺骗观众', '线索无法回看', '只制造气氛不揭示'],
  },
  ensemble_threads: {
    pattern_id: 'ensemble_threads',
    label: '群像多线',
    reference_archetypes: ['群像史诗', '多人物命运交织故事'],
    narrative_engine: '多名角色围绕同一主题从不同位置推进，最后在线索或事件上汇合。',
    protagonist_engine: '每个关键角色都有小目标，整体共同服务主主题。',
    conflict_engine: '个人目标相互碰撞，某一人的选择改变其他人的处境。',
    pacing_pattern: ['主题事件', '多角色切入', '线索交叉', '局势汇合', '共同代价', '主题回收'],
    scene_recipes: ['同一事件的不同视角', '角色间误解推动冲突', '最后由群体反应完成主题'],
    quality_signals: ['角色分工明确', '线索交叉', '主题统一', '不是散点人物介绍'],
    avoid: ['人物太多但无功能', '每条线互不影响', '主题被支线稀释'],
  },
  object_clue_journey: {
    pattern_id: 'object_clue_journey',
    label: '物件线索旅程',
    reference_archetypes: ['以物带史故事', '博物馆展陈叙事'],
    narrative_engine: '用一个物件、地名或空间节点串起人物、历史和当代连接。',
    protagonist_engine: '观看者或讲述者追随物件含义逐步深入。',
    conflict_engine: '物件表面用途与背后记忆之间形成认知差。',
    pacing_pattern: ['物件亮相', '用途说明', '历史记忆', '人物连接', '当代转化', '意义定格'],
    scene_recipes: ['特写物件纹理', '从物件切到使用场景', '最后回到当代保存或传承'],
    quality_signals: ['线索物明确', '古今连接自然', '画面路线清楚', '物件意义有变化'],
    avoid: ['物件只当装饰', '只讲来历不讲使用', '路线跳跃'],
  },
  craft_mastery: {
    pattern_id: 'craft_mastery',
    label: '匠艺精进',
    reference_archetypes: ['匠人成长故事', '传统工艺纪录片'],
    narrative_engine: '把技艺写成材料、工具、手、时间和失败修正的过程。',
    protagonist_engine: '匠人通过重复、等待、判断和传承关系证明技艺价值。',
    conflict_engine: '材料不稳定、技艺门槛、传承断层和现代市场压力形成冲突。',
    pacing_pattern: ['材料入场', '工具启动', '关键步骤', '失败修正', '成品显现', '传承回望'],
    scene_recipes: ['手部微距动作', '等待和火候形成张力', '成品与原料前后对照'],
    quality_signals: ['流程完整', '动词具体', '材料工具清楚', '匠心来自动作'],
    avoid: ['只喊匠心', '流程缺步骤', '把技艺写成玄学'],
  },
  ritual_process: {
    pattern_id: 'ritual_process',
    label: '仪式流程',
    reference_archetypes: ['节庆仪式短片', '民俗活动记录'],
    narrative_engine: '按准备、启动、高潮和收束展示仪式中的秩序与情感。',
    protagonist_engine: '参与者通过遵循流程进入共同体记忆。',
    conflict_engine: '传统规则、当代变化、群体参与和时间节点构成张力。',
    pacing_pattern: ['准备物件', '人群聚集', '仪式启动', '高潮动作', '祝愿或余韵'],
    scene_recipes: ['仪式物件特写', '人群同步动作', '声音节奏推动高潮'],
    quality_signals: ['流程顺序清楚', '群体参与可见', '声音动作明确', '文化边界清楚'],
    avoid: ['只写热闹', '流程顺序混乱', '忽略禁忌和地域差异'],
  },
  brand_symbol: {
    pattern_id: 'brand_symbol',
    label: '品牌符号承诺',
    reference_archetypes: ['城市品牌片', '文化形象片', '产品主张短片'],
    narrative_engine: '用一个高识别符号承载价值承诺，并通过画面重复形成记忆。',
    protagonist_engine: '品牌主体以空间、人物或物件形象出现，而不是抽象口号。',
    conflict_engine: '观众认知不足与品牌想传达的价值之间形成传播任务。',
    pacing_pattern: ['符号亮相', '价值解释', '多场景验证', '当代连接', '口号定格'],
    scene_recipes: ['符号在不同场景重复出现', '一句主张配一个可拍画面', '结尾回到符号'],
    quality_signals: ['符号鲜明', '主张可复述', '画面能验证口号', '结尾可传播'],
    avoid: ['全是形容词', '口号无法被画面证明', '符号不稳定'],
  },
  city_day_journey: {
    pattern_id: 'city_day_journey',
    label: '城市一日旅程',
    reference_archetypes: ['文旅目的地短片', '城市漫游片'],
    narrative_engine: '用一天的时间线串起城市地标、人文、饮食和生活气息。',
    protagonist_engine: '观看者像在城市中移动，通过路线理解地方气质。',
    conflict_engine: '古与今、景点与生活、外来视角与本地日常之间形成层次。',
    pacing_pattern: ['清晨地标', '白天人文', '午后烟火', '傍晚历史', '夜色品牌定格'],
    scene_recipes: ['从高处到街巷', '以一道食物或声音连接本地生活', '夜景回扣城市名片'],
    quality_signals: ['路线自然', '地方名词充足', '生活气息可见', '品牌句有地域性'],
    avoid: ['景点拼贴', '没有路线', '每座城市都能套用的空话'],
  },
  social_hook_contrast: {
    pattern_id: 'social_hook_contrast',
    label: '社交反差钩子',
    reference_archetypes: ['竖屏知识爆款结构', '短视频反差讲述'],
    narrative_engine: '用反常识、强对比或高冲突画面在前 3 秒建立停留理由。',
    protagonist_engine: '讲述者或画面引导观众从误解走向新认知。',
    conflict_engine: '观众原有认知与事实、故事或画面反差发生碰撞。',
    pacing_pattern: ['反差标题', '快速证据', '解释原因', '情绪放大', '金句回扣'],
    scene_recipes: ['第一句就是结论或问题', '数字/对比/前后变化制造节奏', '结尾引导评论或记忆'],
    quality_signals: ['3秒钩子强', '信息密度高', '字幕感明确', '结尾有停留点'],
    avoid: ['铺垫过长', '标题党无兑现', '信息点过散'],
  },
  documentary_investigation: {
    pattern_id: 'documentary_investigation',
    label: '纪实追踪',
    reference_archetypes: ['调查式微纪录', '现实现场加历史回望短片'],
    narrative_engine: '从现实现场提出问题，沿证据、访问和物件逐步接近解释。',
    protagonist_engine: '镜头或讲述者作为追问者，把观众带进核实过程。',
    conflict_engine: '已知叙述、现场痕迹、文献证据和口述差异之间形成张力。',
    pacing_pattern: ['现场问题', '证据寻找', '版本差异', '关键解释', '现实回望'],
    scene_recipes: ['用一个遗存提问', '翻阅资料或走访补证', '再现画面明确标边界'],
    quality_signals: ['现场明确', '来源提示存在', '版本差异可见', '再现边界清楚'],
    avoid: ['伪纪录片口吻冒充事实', '没有来源', '戏剧化对白压过纪实'],
  },
  knowledge_gap_explainer: {
    pattern_id: 'knowledge_gap_explainer',
    label: '认知缺口讲解',
    reference_archetypes: ['知识栏目', '动画科普讲解'],
    narrative_engine: '先制造观众不知道或误解的问题，再用概念、例子和图示补齐。',
    protagonist_engine: '讲述者承担拆解复杂知识的角色。',
    conflict_engine: '常识误区与真实逻辑之间的差异形成观看动力。',
    pacing_pattern: ['提出问题', '指出误区', '定义概念', '举例验证', '总结迁移'],
    scene_recipes: ['一个问题配一张图示', '用类比降低理解成本', '三点总结便于复盘'],
    quality_signals: ['问题明确', '层级清楚', '例子有效', '总结可记住'],
    avoid: ['知识点乱飞', '只给结论不讲为什么', '概念没有例子'],
  },
  lecture_case_argument: {
    pattern_id: 'lecture_case_argument',
    label: '案例论证宣讲',
    reference_archetypes: ['主题宣讲', '案例支撑式演讲'],
    narrative_engine: '先提出观点，再用事实案例、价值分析和现实连接完成说服。',
    protagonist_engine: '讲述者用案例承担价值判断和行动号召。',
    conflict_engine: '现实问题和价值目标之间形成论证压力。',
    pacing_pattern: ['主题提出', '案例叙述', '观点分析', '现实连接', '号召收束'],
    scene_recipes: ['每个观点配一个案例', '金句字幕只放真正的结论', '结尾给可行动方向'],
    quality_signals: ['观点明确', '案例支撑', '现实连接', '结尾有力量但不空泛'],
    avoid: ['纯口号', '观点无证据', '复杂史实被压成单一结论'],
  },
  training_loop: {
    pattern_id: 'training_loop',
    label: '教学闭环',
    reference_archetypes: ['课程教学视频', '步骤示范培训片'],
    narrative_engine: '以学习目标、示范、练习、反馈和复盘形成闭环。',
    protagonist_engine: '学习者从不会到会，讲述者提供清晰路径。',
    conflict_engine: '学习难点、常见错误和检查标准构成训练张力。',
    pacing_pattern: ['目标', '步骤', '示范', '练习', '反馈', '复盘'],
    scene_recipes: ['每步给编号', '错误示范与正确示范对照', '结尾清单复盘'],
    quality_signals: ['目标具体', '步骤完整', '练习存在', '复盘清楚'],
    avoid: ['只讲背景不教动作', '没有检查标准', '学习目标模糊'],
  },
  space_walkthrough: {
    pattern_id: 'space_walkthrough',
    label: '空间导览',
    reference_archetypes: ['地点导览短片', '建筑空间叙事'],
    narrative_engine: '用入口、路线、节点和回望组织空间叙事。',
    protagonist_engine: '镜头像带路人，带观众走完一条有意义的路线。',
    conflict_engine: '空间表面景观与历史、人文或功能记忆之间形成层次。',
    pacing_pattern: ['入口建立', '路径推进', '节点揭示', '时间叠印', '回望收束'],
    scene_recipes: ['从门槛或入口开始', '每个节点只讲一个功能', '最后从高处或远景回望'],
    quality_signals: ['空间身份清楚', '路线连续', '节点有功能', '氛围收束'],
    avoid: ['路线跳跃', '把地点写成人物简历', '只有景色形容'],
  },
  poetic_landscape: {
    pattern_id: 'poetic_landscape',
    label: '诗性山水',
    reference_archetypes: ['山水意境片', '水墨诗性短片'],
    narrative_engine: '以自然意象、光影、声音和留白组织情绪，而非密集信息。',
    protagonist_engine: '观看者跟随景物变化进入情绪状态。',
    conflict_engine: '动与静、远与近、古与今、声音与留白形成微弱张力。',
    pacing_pattern: ['自然开卷', '光影流动', '人文轻触', '情绪停驻', '留白定格'],
    scene_recipes: ['长镜头留白', '一句旁白对应一个自然意象', '声音比信息更重要'],
    quality_signals: ['自然意象突出', '旁白低密度', '光影季节明确', '留白成立'],
    avoid: ['宣传口号', '知识点过密', '硬塞剧情冲突'],
  },
  children_fable: {
    pattern_id: 'children_fable',
    label: '儿童寓言',
    reference_archetypes: ['儿童绘本', '少儿寓言动画'],
    narrative_engine: '用小问题、小行动和温和反馈表达清楚价值。',
    protagonist_engine: '儿童或拟人角色通过尝试、求助和勇敢选择成长。',
    conflict_engine: '误会、害怕、分享、守信和帮助构成低压冲突。',
    pacing_pattern: ['可爱角色', '小问题', '尝试失败', '得到帮助', '正确选择', '温暖反馈'],
    scene_recipes: ['重复句式帮助理解', '危险转为温和表达', '结尾给简单可复述道理'],
    quality_signals: ['语言简单', '因果清楚', '冲突温和', '结尾正向'],
    avoid: ['成人化权谋', '恐怖暴力细节', '价值说教过重'],
  },
};

const VIDEO_TYPE_PATTERN_MAP: Record<VideoType, NarrativePatternId[]> = {
  character_story: ['hero_choice', 'mortal_growth', 'mystery_reveal', 'ensemble_threads'],
  historical_drama: ['historical_causal_story', 'power_strategy', 'hero_choice', 'mystery_reveal'],
  legend_story: ['folk_legend_trial', 'children_fable', 'mystery_reveal', 'object_clue_journey'],
  culture_promo: ['brand_symbol', 'object_clue_journey', 'ritual_process', 'city_day_journey'],
  heritage_promo: ['craft_mastery', 'ritual_process', 'object_clue_journey', 'brand_symbol'],
  city_brand_promo: ['city_day_journey', 'brand_symbol', 'object_clue_journey', 'poetic_landscape'],
  scene_short: ['space_walkthrough', 'object_clue_journey', 'mystery_reveal', 'poetic_landscape'],
  landscape_mood: ['poetic_landscape', 'space_walkthrough', 'object_clue_journey'],
  documentary_short: ['documentary_investigation', 'historical_causal_story', 'object_clue_journey', 'ensemble_threads'],
  explainer_video: ['knowledge_gap_explainer', 'historical_causal_story', 'object_clue_journey'],
  lecture_video: ['lecture_case_argument', 'historical_causal_story', 'hero_choice'],
  education_training: ['training_loop', 'knowledge_gap_explainer', 'craft_mastery'],
  children_story: ['children_fable', 'folk_legend_trial', 'mortal_growth'],
  social_short: ['social_hook_contrast', 'mystery_reveal', 'brand_symbol', 'knowledge_gap_explainer'],
  ai_comic_drama: ['mortal_growth', 'infinite_mission', 'mystery_reveal', 'power_strategy', 'hero_choice'],
};

export const NARRATIVE_PATTERN_LIBRARY = PATTERNS;
export const NARRATIVE_PATTERN_VIDEO_TYPE_MAP = VIDEO_TYPE_PATTERN_MAP;

export function getNarrativePatternCatalog(): NarrativePatternCatalog {
  return {
    patterns: Object.values(PATTERNS),
    video_type_map: VIDEO_TYPE_PATTERN_MAP,
  };
}

export function getNarrativePatternsForVideoType(
  videoType: VideoType,
  selectedPatternIds: NarrativePatternId[] = [],
): NarrativePattern[] {
  return mergePatternIds(
    selectedPatternIds,
    VIDEO_TYPE_PATTERN_MAP[videoType] ?? VIDEO_TYPE_PATTERN_MAP.character_story,
  )
    .map(patternId => PATTERNS[patternId]);
}

export function getNarrativePatternQualitySignals(
  videoType: VideoType,
  selectedPatternIds: NarrativePatternId[] = [],
): string[] {
  return unique(getNarrativePatternsForVideoType(videoType, selectedPatternIds).flatMap(pattern => pattern.quality_signals));
}

export function getNarrativePatternRequirementLines(
  videoType: VideoType,
  selectedPatternIds: NarrativePatternId[] = [],
): string[] {
  return getNarrativePatternsForVideoType(videoType, selectedPatternIds).map(pattern =>
    `${pattern.label}：${pattern.narrative_engine}；节奏=${pattern.pacing_pattern.join(' → ')}`
  );
}

export function getNarrativePatternRepairActions(
  videoType: VideoType,
  selectedPatternIds: NarrativePatternId[] = [],
): string[] {
  return getNarrativePatternsForVideoType(videoType, selectedPatternIds).flatMap(pattern => [
    `对齐流派机制「${pattern.label}」：${pattern.narrative_engine}`,
    ...pattern.quality_signals.map(signal => `补强「${pattern.label}」质量信号：${signal}`),
  ]);
}

export function formatNarrativePatternsForPrompt(
  videoType: VideoType,
  selectedPatternIds: NarrativePatternId[] = [],
): string[] {
  const selected = new Set(selectedPatternIds);
  return getNarrativePatternsForVideoType(videoType, selectedPatternIds).flatMap(pattern => [
    selected.has(pattern.pattern_id) ? `- ${pattern.label}（用户强化；结构参考：${pattern.reference_archetypes.join('、')}）` : `- ${pattern.label}（默认参考；结构参考：${pattern.reference_archetypes.join('、')}）`,
    `  叙事引擎：${pattern.narrative_engine}`,
    `  主角引擎：${pattern.protagonist_engine}`,
    `  冲突引擎：${pattern.conflict_engine}`,
    `  节奏：${pattern.pacing_pattern.join(' → ')}`,
    `  场景配方：${pattern.scene_recipes.join('；')}`,
    `  质量信号：${pattern.quality_signals.join('；')}`,
    `  禁止：${pattern.avoid.join('；')}`,
  ]);
}

function mergePatternIds(primary: NarrativePatternId[], fallback: NarrativePatternId[]): NarrativePatternId[] {
  return unique([...primary, ...fallback])
    .filter(patternId => Boolean(PATTERNS[patternId]));
}

function unique<T extends string>(items: T[]): T[] {
  return items.filter((item, index, arr) => arr.indexOf(item) === index);
}
