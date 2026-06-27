// web/server/src/services/narrative-pattern-library.ts
// Reusable narrative pattern packs distilled from genre traditions and classic
// story mechanisms. These are structural references, not plot/style copying.

import type {
  NarrativePattern,
  NarrativePatternCatalog,
  NarrativePatternId,
  NarrativeStyleAxis,
  NarrativeStyleAxisId,
  NarrativeStyleAxisValue,
  StoryGenerateResult,
  VideoType,
} from '@shared/types.js';

export type NarrativePatternDiagnosticStatus = 'satisfied' | 'weak' | 'missing';

export interface NarrativePatternDiagnostic {
  diagnostic_id: string;
  pattern_id: NarrativePatternId;
  pattern_label: string;
  signal: string;
  status: NarrativePatternDiagnosticStatus;
  evidence: string[];
  suggested_scene_ids: number[];
  impact: string;
  gap: string;
  repair_hint: string;
}

function axis(axis_id: NarrativeStyleAxisId, label: string, value: NarrativeStyleAxisValue, note: string): NarrativeStyleAxis {
  return { axis_id, label, value, note };
}

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
  novel_scene_compression: {
    pattern_id: 'novel_scene_compression',
    label: '小说场景压缩',
    subject_family: 'adaptation',
    subgenre_tags: ['长篇压缩', '场景功能', '视频化改编'],
    user_facing_summary: '适合把长章节压成 3-6 个可拍场景，保留主线、合并旁枝。',
    style_axes: [
      axis('fidelity', '保真度', 'high', '保留原作主线和关键转折。'),
      axis('hook_intensity', '钩子强度', 'medium', '压缩后仍要有清楚的场景推进。'),
    ],
    reference_archetypes: ['长篇小说影视化改编', '章节浓缩式短剧改编'],
    narrative_engine: '保留原作因果链，把长段叙述压缩成少量可拍场景和明确场次功能。',
    protagonist_engine: '主角目标、关系和选择沿用原作，不重造人物动机。',
    conflict_engine: '从原作章节中提炼外部阻力、关系冲突和内心抉择，合并重复信息。',
    pacing_pattern: ['原作主线识别', '关键场景筛选', '合并过渡', '保留转折', '视听化落点'],
    scene_recipes: ['把心理描写转成动作/道具/表情', '把长背景压成一句旁白+一个画面', '每段只承载一个剧情功能'],
    quality_signals: ['保留原作主线', '删改理由清楚', '场景功能明确', '不新增抢戏支线'],
    avoid: ['把原作重写成新故事', '新增核心人物替代原主角', '只摘要不分镜'],
  },
  character_arc_adaptation: {
    pattern_id: 'character_arc_adaptation',
    label: '角色弧线改编',
    subject_family: 'adaptation',
    subgenre_tags: ['人物变化', '关系压力', '选择代价'],
    user_facing_summary: '适合突出主角从犹豫、误判到做出选择的变化。',
    style_axes: [
      axis('fidelity', '保真度', 'high', '保留原作人物核心性格和变化方向。'),
      axis('romance_density', '关系浓度', 'medium', '关系压力必须推动人物变化。'),
    ],
    reference_archetypes: ['人物弧光影视改编', '成长线短剧化'],
    narrative_engine: '围绕原作人物的状态变化组织场景，让每场推动关系、认知或选择变化。',
    protagonist_engine: '保留人物起点、欲望、弱点和最终变化，并让变化通过行动呈现。',
    conflict_engine: '人物内在矛盾、关系压力和外部事件互相推动。',
    pacing_pattern: ['初始状态', '欲望显现', '关系压力', '错误选择', '关键醒悟', '状态改变'],
    scene_recipes: ['用一次小选择呈现性格', '用配角反应证明变化', '结尾回扣开场状态'],
    quality_signals: ['人物变化可见', '关系压力保留', '关键选择来自原作', '弧线不是口号'],
    avoid: ['只保留剧情不保留人物变化', '用旁白宣布成长', '改变原作人物核心性格'],
  },
  serial_hook_adaptation: {
    pattern_id: 'serial_hook_adaptation',
    label: '连续剧钩子改编',
    subject_family: 'adaptation',
    subgenre_tags: ['分集', '集末钩子', '长线承接'],
    user_facing_summary: '适合把原作拆成多集短剧，每集有目标，结尾有可承接问题。',
    style_axes: [
      axis('hook_intensity', '钩子强度', 'high', '每集结尾需要明确下一步动作或问题。'),
      axis('fidelity', '保真度', 'medium', '钩子必须来自原作因果，不硬断章。'),
    ],
    reference_archetypes: ['网文分集改编', '短剧集末钩子'],
    narrative_engine: '把原作连续情节拆成集内目标和集末未解问题，推动追看。',
    protagonist_engine: '主角每集有明确小目标，长期目标跨集推进。',
    conflict_engine: '信息差、关系误会、危险逼近和选择后果形成集末钩子。',
    pacing_pattern: ['本集目标', '障碍升级', '信息反转', '付出代价', '集末钩子'],
    scene_recipes: ['每集开头承接上一集后果', '中段给一次误判', '结尾留下具体问题而非空悬念'],
    quality_signals: ['集内目标明确', '钩子可承接', '长期线不断裂', '不是硬断章'],
    avoid: ['为钩子篡改原作因果', '每集只铺垫不兑现', '结尾问题无法下一集回答'],
  },
  cinematic_setpiece_adaptation: {
    pattern_id: 'cinematic_setpiece_adaptation',
    label: '影视场面转译',
    subject_family: 'adaptation',
    subgenre_tags: ['名场面', '视听调度', '动作情绪'],
    user_facing_summary: '适合把小说名场面转成强画面、强动作、强情绪的镜头段落。',
    style_axes: [
      axis('action_density', '动作密度', 'high', '动作、站位和道具承担情绪表达。'),
      axis('dialogue_density', '对白密度', 'medium', '关键对白少而准，不搬运长段原文。'),
    ],
    reference_archetypes: ['小说名场面影视化', '关键段落视听转译'],
    narrative_engine: '把原作中的情绪高点、动作段落或关系摊牌转成可视听调度的名场面。',
    protagonist_engine: '主角通过动作、站位、表情、沉默和一句关键对白被看见。',
    conflict_engine: '空间压迫、道具、光线、声音和人物距离承担冲突表达。',
    pacing_pattern: ['空间建立', '人物入场', '压力逼近', '动作/对白爆发', '余波定格'],
    scene_recipes: ['用道具替代解释', '用站位体现关系', '用声音和停顿放大情绪'],
    quality_signals: ['名场面可拍', '视听动作具体', '情绪高点清楚', '不靠长解释'],
    avoid: ['只把原文搬成旁白', '画面提示混入分析', '缺少人物动作'],
  },
  theme_preserving_adaptation: {
    pattern_id: 'theme_preserving_adaptation',
    label: '主题保真改编',
    subject_family: 'adaptation',
    subgenre_tags: ['主题保真', '文学余味', '主旨回扣'],
    user_facing_summary: '适合文学性强、不想改偏主旨和情绪底色的作品。',
    style_axes: [
      axis('fidelity', '保真度', 'high', '删改不能伤害原作核心命题。'),
      axis('blank_space', '留白程度', 'medium', '结尾允许余味，不硬喊口号。'),
    ],
    reference_archetypes: ['文学作品主题改编', '主旨保留型影视化'],
    narrative_engine: '压缩和重排情节时保留原作核心命题、价值取向和情绪底色。',
    protagonist_engine: '人物选择必须继续服务原作主题，而不是服务外加口号。',
    conflict_engine: '主题冲突由原作关系和事件显现，通过结尾回扣完成表达。',
    pacing_pattern: ['主题命题', '反向压力', '人物试探', '主题选择', '余味回扣'],
    scene_recipes: ['删减前先确认主题功能', '合并场景时保留主题转折', '结尾用画面而非宣讲回扣主旨'],
    quality_signals: ['主题不漂移', '删改不伤主旨', '情绪底色一致', '结尾回扣原作命题'],
    avoid: ['把原作主题改成宣传口号', '只追求爽点丢掉余味', '新增结尾推翻原作表达'],
  },
  source_fidelity_adaptation: {
    pattern_id: 'source_fidelity_adaptation',
    label: '原作保真改编',
    subject_family: 'adaptation',
    subgenre_tags: ['IP 改编', '人物关系', '主线保真'],
    user_facing_summary: '适合已有小说/剧本改编，优先保证人物、关系、事件顺序不被改飞。',
    style_axes: [
      axis('fidelity', '保真度', 'high', '原作人物、关系、主线和主题优先级最高。'),
      axis('hook_intensity', '钩子强度', 'medium', '允许补强观看钩子，但不能替换原作因果。'),
    ],
    reference_archetypes: ['IP 改编圣经', '原作粉丝向剧本改编'],
    narrative_engine: '先锁定原作不可改动的人物、关系、事件顺序和主题，再决定压缩、合并和视听化补足。',
    protagonist_engine: '主角姓名、身份、欲望、关系压力和关键选择沿用原作，不用知识包或流派模板替换。',
    conflict_engine: '冲突来自原作既有事件、误会、对抗和选择代价，新增内容只负责连接和画面化。',
    pacing_pattern: ['原作锚点', '人物关系确认', '事件顺序锁定', '必要压缩', '视听补足', '保真复核'],
    scene_recipes: ['每场标注对应原作段落功能', '新增过场只解决转场问题', '结尾检查人物关系和主题是否仍属于原作'],
    quality_signals: ['人物不丢失', '关系不改写', '主线不换题', '新增内容不抢戏'],
    avoid: ['以素材库人物替换原主角', '把原作改成全新传记', '新增设定改变原作因果'],
  },
  chapter_slice_adaptation: {
    pattern_id: 'chapter_slice_adaptation',
    label: '章节切片改编',
    subject_family: 'adaptation',
    subgenre_tags: ['单集切片', '长线承接', '章节单元'],
    user_facing_summary: '适合从长篇原作里截取一集/一段，做成单集闭环。',
    style_axes: [
      axis('hook_intensity', '钩子强度', 'high', '结尾承接下一章，但本集也要有阶段结果。'),
      axis('fidelity', '保真度', 'medium', '只截取当前单元，不一集塞完整本书。'),
    ],
    reference_archetypes: ['长篇小说单集切片', '章节单元剧改编'],
    narrative_engine: '从长篇原作中截取一个完整单元，形成本集目标、阻力、转折和集末承接。',
    protagonist_engine: '主角长期目标保持在线，本集只解决一个阶段性问题。',
    conflict_engine: '集内冲突来自当前章节的阻碍，长期线索在开头和结尾轻量露出。',
    pacing_pattern: ['承接长线', '本集目标', '单元阻力', '中段转折', '阶段结果', '下一集钩子'],
    scene_recipes: ['开场一句交代上文后果', '中段集中写本章节关键冲突', '结尾只留一个可回答问题'],
    quality_signals: ['单集闭环', '长线不断', '切片边界清楚', '钩子来自原作'],
    avoid: ['一集塞完整本书', '只做摘要没有单集目标', '钩子脱离原作'],
  },
  dialogue_scene_adaptation: {
    pattern_id: 'dialogue_scene_adaptation',
    label: '对白场改编',
    subject_family: 'adaptation',
    subgenre_tags: ['强对白', '潜台词', '关系摊牌'],
    user_facing_summary: '适合把原作关键关系压进一场有目标、有潜台词、有转折的对白场。',
    style_axes: [
      axis('dialogue_density', '对白密度', 'high', '台词要有目标、潜台词和后果。'),
      axis('blank_space', '留白程度', 'medium', '未说出口的信息用动作和停顿表达。'),
    ],
    reference_archetypes: ['强对白短剧场', '关系摊牌戏'],
    narrative_engine: '把原作关键关系和信息差压进一场有目标、有潜台词、有转折的对白场。',
    protagonist_engine: '人物通过说什么、不说什么、打断、沉默和动作暴露真实诉求。',
    conflict_engine: '台词表层目的与真实目的错位，关系压力逐句升级。',
    pacing_pattern: ['入场目标', '试探台词', '信息差暴露', '关系反击', '一句真话', '余波动作'],
    scene_recipes: ['每句对白服务目标或阻力', '用动作打断解释', '让最后一句话改变下一场处境'],
    quality_signals: ['对白有目标', '潜台词可见', '关系升级', '不是旁白搬运'],
    avoid: ['人物轮流解释设定', '对白没有行动后果', '只复制原文长段独白'],
  },
  worldbuilding_grounding: {
    pattern_id: 'worldbuilding_grounding',
    label: '世界观落地',
    subject_family: 'adaptation',
    subgenre_tags: ['世界观', '规则可见', '设定落地'],
    user_facing_summary: '适合奇幻、玄幻、架空故事，把设定变成角色会遭遇的可见规则。',
    style_axes: [
      axis('world_scale', '世界尺度', 'high', '规则、禁忌和等级要能被场景看见。'),
      axis('action_density', '动作密度', 'medium', '用行动展示规则，不靠设定说明。'),
    ],
    reference_archetypes: ['奇幻/玄幻设定影视化', '规则型世界观短剧'],
    narrative_engine: '把原作世界观规则拆成角色会遭遇、会利用、会付代价的可见规则。',
    protagonist_engine: '主角通过一次行动展示自己与规则的关系，而不是听旁白解释设定。',
    conflict_engine: '世界规则、身份等级、禁忌或资源限制直接制造阻力。',
    pacing_pattern: ['规则可见', '角色试探', '违规代价', '利用规则', '更大规则露出'],
    scene_recipes: ['用一次失败展示规则', '把设定名词挂在道具/空间/仪式上', '让配角反应证明规则有效'],
    quality_signals: ['规则可拍', '设定不堆砌', '代价明确', '名词有画面锚点'],
    avoid: ['开头大段世界观说明', '设定名词无行动含义', '规则随剧情临时变化'],
  },
  platform_short_drama_hook: {
    pattern_id: 'platform_short_drama_hook',
    label: '平台短剧钩子',
    subject_family: 'adaptation',
    subgenre_tags: ['竖屏短剧', '强钩子', '集末反转'],
    user_facing_summary: '适合平台短剧化，前三秒有局，结尾有下一集动作。',
    style_axes: [
      axis('hook_intensity', '钩子强度', 'high', '前三秒进入压力现场，结尾给可承接反转。'),
      axis('dialogue_density', '对白密度', 'medium', '台词服务压迫、误会或身份揭示。'),
    ],
    reference_archetypes: ['竖屏短剧前三秒钩子', '付费短剧集末反转'],
    narrative_engine: '用高压局面、强关系冲突或信息反转快速建立观看理由，并在结尾给下一步动作。',
    protagonist_engine: '主角开场就处于可见压力中，必须马上做决定或承受后果。',
    conflict_engine: '羞辱、误会、倒计时、身份揭示、关系翻盘等高压元素服务原作主线。',
    pacing_pattern: ['3秒危机', '身份/关系亮明', '压迫升级', '小反击', '反转钩子'],
    scene_recipes: ['第一场直接进入压力现场', '每 20-30 秒给一次信息变化', '结尾钩子指向下一场行动'],
    quality_signals: ['前3秒有局', '关系冲突强', '反转可承接', '不牺牲原作'],
    avoid: ['为了爽点篡改原作人物', '只有吵架没有目标', '硬断章'],
  },
  wuxia_chivalric_epic: {
    pattern_id: 'wuxia_chivalric_epic',
    label: '武侠：家国侠义史诗',
    subject_family: 'wuxia',
    subgenre_tags: ['家国侠义', '宏大江湖', '群像成长', '门派秩序'],
    user_facing_summary: '适合门派、师承、江湖秩序和家国命题较重的武侠漫剧。',
    style_axes: [
      axis('world_scale', '江湖尺度', 'high', '门派、地域、势力和时代压力共同构成大江湖。'),
      axis('ensemble_degree', '群像程度', 'high', '多名角色围绕侠义命题互相影响。'),
      axis('historical_weight', '历史重量', 'medium', '可带家国或时代背景，但不压过人物行动。'),
      axis('action_density', '动作密度', 'medium', '武打服务选择和关系，不只是连续打斗。'),
    ],
    reference_archetypes: ['家国侠义型武侠', '门派群像成长故事', '江湖秩序与时代压力叙事'],
    narrative_engine: '用门派、师承、江湖规矩和时代压力推动主角理解“侠”的代价。',
    protagonist_engine: '主角从个人恩怨或少年理想出发，逐步承担更大的江湖责任。',
    conflict_engine: '个人情义、门派规矩、江湖公义和家国处境形成多层冲突。',
    pacing_pattern: ['少年入局', '师承立规', '江湖见闻', '情义两难', '大义选择', '余波传承'],
    scene_recipes: ['师门训诫与江湖现实相撞', '小人物遭难触发侠义选择', '群像反应证明主角选择的重量'],
    quality_signals: ['侠义命题清楚', '江湖规则可见', '群像有功能', '选择有家国/江湖后果'],
    avoid: ['只堆门派名词', '空喊侠义没有具体代价', '把宏大背景写成设定说明'],
  },
  wuxia_lone_blade_mystery: {
    pattern_id: 'wuxia_lone_blade_mystery',
    label: '武侠：孤刀悬疑留白',
    subject_family: 'wuxia',
    subgenre_tags: ['孤客', '悬疑', '决斗', '留白对白'],
    user_facing_summary: '适合冷峻刀客、身份谜团、短句对白和强反转的武侠漫剧。',
    style_axes: [
      axis('dialogue_density', '对白密度', 'medium', '对白短、硬、带潜台词。'),
      axis('blank_space', '留白程度', 'high', '沉默、空镜和未说出口的信息承担气质。'),
      axis('mystery_density', '悬疑密度', 'high', '身份、动机和旧案逐步翻转。'),
      axis('action_density', '动作密度', 'medium', '决斗少而狠，动作前后有心理压迫。'),
    ],
    reference_archetypes: ['冷峻刀客故事', '江湖旧案悬疑', '强对白决斗短剧'],
    narrative_engine: '用一个孤身角色和一个异常线索切入江湖旧案，在沉默与反转中揭开真相。',
    protagonist_engine: '主角少说多看，靠观察、试探和关键出手暴露过去。',
    conflict_engine: '身份伪装、旧案真相、复仇动机和决斗压力互相咬合。',
    pacing_pattern: ['异常入场', '短句试探', '线索反扣', '身份裂缝', '决斗摊牌', '留白余味'],
    scene_recipes: ['客栈/雨夜/荒院中一句话改变局势', '同一道具前后两次出现含义不同', '决斗前用静默拉满压力'],
    quality_signals: ['留白有信息', '对白有潜台词', '旧案可回扣', '决斗改变真相'],
    avoid: ['把留白写成信息缺失', '台词故作玄虚但无推进', '反转没有前文线索'],
  },
  wuxia_sect_growth: {
    pattern_id: 'wuxia_sect_growth',
    label: '武侠：门派成长试炼',
    subject_family: 'wuxia',
    subgenre_tags: ['少年成长', '门派试炼', '师徒关系', '功法阶段'],
    user_facing_summary: '适合少年入门、师徒、试炼升级和阶段性成长的武侠漫剧。',
    style_axes: [
      axis('world_scale', '江湖尺度', 'medium', '先从门派小世界展开，再露出更大江湖。'),
      axis('action_density', '动作密度', 'high', '训练、试炼和实战推动成长。'),
      axis('hook_intensity', '钩子强度', 'medium', '每集用考核结果或新规则承接。'),
      axis('fidelity', '成长保真', 'medium', '成长必须有训练、失败和代价。'),
    ],
    reference_archetypes: ['少年入门武侠', '师徒试炼故事', '门派考核成长线'],
    narrative_engine: '用门规、训练、考核和下山任务展示主角从不会到会的阶段成长。',
    protagonist_engine: '主角有短板、有误判，通过师徒关系和实战失败逐步建立能力。',
    conflict_engine: '门派规矩、同门竞争、师父要求、外部江湖危险共同制造压力。',
    pacing_pattern: ['入门短板', '门规压迫', '训练失败', '试炼任务', '险胜代价', '新境界露出'],
    scene_recipes: ['一次基础动作失败暴露短板', '师父不解释但用任务逼人成长', '试炼胜利后立刻出现更大江湖规则'],
    quality_signals: ['成长步骤清楚', '师徒压力可见', '试炼有代价', '武功不是凭空变强'],
    avoid: ['主角无训练突然变强', '门派只是背景板', '考核没有规则和代价'],
  },
  wuxia_revenge_journey: {
    pattern_id: 'wuxia_revenge_journey',
    label: '武侠：复仇追凶江湖路',
    subject_family: 'wuxia',
    subgenre_tags: ['复仇', '追凶', '旧案', '真相代价'],
    user_facing_summary: '适合血案、追凶、误会、真相和复仇代价驱动的武侠漫剧。',
    style_axes: [
      axis('mystery_density', '悬疑密度', 'high', '追凶过程不断重释旧案。'),
      axis('action_density', '动作密度', 'high', '追逃、伏击和决斗推动线索。'),
      axis('romance_density', '情感浓度', 'medium', '亲情、旧友或爱恨关系会改变复仇方向。'),
      axis('hook_intensity', '钩子强度', 'high', '每段追查都应留下新的嫌疑或真相裂缝。'),
    ],
    reference_archetypes: ['江湖血案复仇', '追凶路书', '误会与真相反转故事'],
    narrative_engine: '以一桩旧案或血仇为线索，让主角一路追查、误判、付代价并接近真相。',
    protagonist_engine: '主角被仇恨驱动，但必须在真相、情义和代价中重新选择。',
    conflict_engine: '仇人线索、伪证、旧友隐瞒、幕后势力和复仇代价持续升级。',
    pacing_pattern: ['血案钩子', '线索追踪', '误杀/误判风险', '旧人阻拦', '真相反转', '复仇选择'],
    scene_recipes: ['一件旧物指向下一个地点', '打斗后发现对手并非真凶', '最终让主角在杀与不杀之间承担代价'],
    quality_signals: ['复仇目标明确', '线索链不断', '真相改变选择', '复仇有代价'],
    avoid: ['只赶路不破案', '仇人随意更换', '复仇变成无后果爽点'],
  },
  wuxia_court_jianghu: {
    pattern_id: 'wuxia_court_jianghu',
    label: '武侠：庙堂江湖博弈',
    subject_family: 'wuxia',
    subgenre_tags: ['庙堂江湖', '权谋', '势力博弈', '身份站位'],
    user_facing_summary: '适合江湖门派、官府、朝堂和多方势力交错的武侠漫剧。',
    style_axes: [
      axis('world_scale', '江湖尺度', 'high', '江湖与权力结构互相牵制。'),
      axis('dialogue_density', '对白密度', 'high', '谈判、试探和站位通过台词推进。'),
      axis('ensemble_degree', '群像程度', 'high', '多方势力都有目标和筹码。'),
      axis('historical_weight', '历史重量', 'medium', '制度压力应具体，不写成空泛朝堂。'),
    ],
    reference_archetypes: ['江湖与官府博弈', '朝堂权谋武侠', '多势力站位故事'],
    narrative_engine: '让江湖门派、官府和权力势力围绕同一资源或秘密博弈。',
    protagonist_engine: '主角在江湖义气和现实权力之间判断站位，靠行动破局。',
    conflict_engine: '名分、密令、门派利益、官府压力和江湖道义形成多方冲突。',
    pacing_pattern: ['势力摆盘', '江湖事件', '官府介入', '站位试探', '代价交换', '破局余波'],
    scene_recipes: ['一场宴席/堂审/会盟中多方各说一套话', '表面江湖仇杀背后牵出权力交易', '主角选择使两边都付出代价'],
    quality_signals: ['多方目标清楚', '江湖与庙堂互相影响', '站位有代价', '权谋不靠解释'],
    avoid: ['官府只当反派符号', '势力太多但目标不清', '全靠长台词解释阴谋'],
  },
  wuxia_romance_honor: {
    pattern_id: 'wuxia_romance_honor',
    label: '武侠：情义名节抉择',
    subject_family: 'wuxia',
    subgenre_tags: ['侠女', '情义', '名节', '身份束缚'],
    user_facing_summary: '适合情感选择、身份束缚、江湖名节与个人自由冲突的武侠漫剧。',
    style_axes: [
      axis('romance_density', '情感浓度', 'high', '情感关系直接推动选择。'),
      axis('dialogue_density', '对白密度', 'medium', '对白兼具情义和克制。'),
      axis('action_density', '动作密度', 'medium', '动作常用于表达保护、决裂或成全。'),
      axis('blank_space', '留白程度', 'medium', '未说出口的情感应通过动作和道具表达。'),
    ],
    reference_archetypes: ['江湖儿女情义', '侠女身份抉择', '名节与自由冲突'],
    narrative_engine: '用情义关系与江湖名节冲突推动人物做选择。',
    protagonist_engine: '主角既有情感牵挂，也受身份、承诺或门规约束。',
    conflict_engine: '爱情、义气、名声、承诺和自由互相冲突。',
    pacing_pattern: ['情义建立', '身份阻隔', '江湖压力', '误会/试探', '公开选择', '余味成全'],
    scene_recipes: ['用一件信物承载未说出口的承诺', '用并肩或背离的站位表现关系变化', '结尾让人物选择比告白更有力量'],
    quality_signals: ['情感压力具体', '名节规则可见', '选择不廉价', '余味来自行动'],
    avoid: ['只谈恋爱没有江湖规则', '情感转折无铺垫', '用狗血误会替代人物选择'],
  },
};

const VIDEO_TYPE_PATTERN_MAP: Record<VideoType, NarrativePatternId[]> = {
  character_story: ['hero_choice', 'historical_causal_story', 'source_fidelity_adaptation', 'wuxia_chivalric_epic', 'wuxia_revenge_journey', 'character_arc_adaptation', 'novel_scene_compression', 'mortal_growth', 'mystery_reveal', 'ensemble_threads'],
  historical_drama: ['historical_causal_story', 'hero_choice', 'source_fidelity_adaptation', 'wuxia_court_jianghu', 'wuxia_chivalric_epic', 'theme_preserving_adaptation', 'cinematic_setpiece_adaptation', 'power_strategy', 'mystery_reveal'],
  legend_story: ['folk_legend_trial', 'object_clue_journey', 'children_fable', 'mystery_reveal'],
  culture_promo: ['brand_symbol', 'object_clue_journey', 'ritual_process', 'city_day_journey'],
  heritage_promo: ['craft_mastery', 'ritual_process', 'object_clue_journey', 'brand_symbol'],
  city_brand_promo: ['city_day_journey', 'brand_symbol', 'object_clue_journey', 'poetic_landscape'],
  scene_short: ['space_walkthrough', 'object_clue_journey', 'poetic_landscape', 'mystery_reveal'],
  landscape_mood: ['poetic_landscape', 'space_walkthrough', 'object_clue_journey'],
  documentary_short: ['documentary_investigation', 'historical_causal_story', 'object_clue_journey', 'source_fidelity_adaptation', 'theme_preserving_adaptation', 'ensemble_threads'],
  explainer_video: ['knowledge_gap_explainer', 'historical_causal_story', 'object_clue_journey'],
  lecture_video: ['lecture_case_argument', 'historical_causal_story', 'hero_choice'],
  education_training: ['training_loop', 'knowledge_gap_explainer', 'craft_mastery'],
  children_story: ['children_fable', 'folk_legend_trial', 'mortal_growth'],
  social_short: ['social_hook_contrast', 'platform_short_drama_hook', 'mystery_reveal', 'brand_symbol', 'knowledge_gap_explainer'],
  ai_comic_drama: ['platform_short_drama_hook', 'cinematic_setpiece_adaptation', 'hero_choice', 'dialogue_scene_adaptation', 'serial_hook_adaptation', 'character_arc_adaptation', 'source_fidelity_adaptation', 'chapter_slice_adaptation', 'novel_scene_compression', 'worldbuilding_grounding', 'wuxia_chivalric_epic', 'wuxia_lone_blade_mystery', 'wuxia_sect_growth', 'wuxia_revenge_journey', 'wuxia_court_jianghu', 'wuxia_romance_honor', 'mortal_growth', 'mystery_reveal', 'power_strategy', 'infinite_mission'],
};

const DEFAULT_PATTERN_COUNT_BY_VIDEO_TYPE: Record<VideoType, number> = {
  character_story: 2,
  historical_drama: 2,
  legend_story: 2,
  culture_promo: 2,
  heritage_promo: 2,
  city_brand_promo: 2,
  scene_short: 2,
  landscape_mood: 1,
  documentary_short: 2,
  explainer_video: 1,
  lecture_video: 1,
  education_training: 1,
  children_story: 1,
  social_short: 1,
  ai_comic_drama: 2,
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
  return resolveActivePatternIds(videoType, selectedPatternIds)
    .map(patternId => PATTERNS[patternId]);
}

export function resolveActivePatternIds(
  videoType: VideoType,
  selectedPatternIds: NarrativePatternId[] = [],
): NarrativePatternId[] {
  const fallback = VIDEO_TYPE_PATTERN_MAP[videoType] ?? VIDEO_TYPE_PATTERN_MAP.character_story;
  const selected = selectedPatternIds.filter(patternId => Boolean(PATTERNS[patternId]));
  if (selected.length > 0) {
    return unique(selected);
  }
  const defaultCount = DEFAULT_PATTERN_COUNT_BY_VIDEO_TYPE[videoType] ?? 1;
  return fallback.slice(0, defaultCount);
}

export function getNarrativePatternQualitySignals(
  videoType: VideoType,
  selectedPatternIds: NarrativePatternId[] = [],
): string[] {
  return unique(getNarrativePatternsForVideoType(videoType, selectedPatternIds).flatMap(pattern => pattern.quality_signals));
}

export function getNarrativePatternDiagnostics(input: {
  story: StoryGenerateResult;
  videoType: VideoType;
  selectedPatternIds?: NarrativePatternId[];
}): NarrativePatternDiagnostic[] {
  const text = storyText(input.story);
  return getNarrativePatternsForVideoType(input.videoType, input.selectedPatternIds ?? [])
    .flatMap(pattern => pattern.quality_signals.map((signal, signalIndex) => {
      const probe = probeSignal(input.story, text, signal);
      return {
        diagnostic_id: `${pattern.pattern_id}-${signalIndex + 1}`,
        pattern_id: pattern.pattern_id,
        pattern_label: pattern.label,
        signal,
        status: probe.status,
        evidence: probe.evidence,
        suggested_scene_ids: probe.sceneIds.length > 0
          ? probe.sceneIds
          : suggestedSceneIdsForSignal(input.story, signal),
        impact: patternImpact(pattern, signal),
        gap: probe.status === 'satisfied'
          ? `已出现「${signal}」相关机制。`
          : `「${pattern.label}」的「${signal}」偏弱，观众不容易感知所选流派机制。`,
        repair_hint: probe.status === 'satisfied'
          ? '保持现有机制表达，并避免后续修复时删除证据场景。'
          : buildPatternRepairHint(pattern, signal, input.story),
      };
    }));
}

export function getNarrativePatternRequirementLines(
  videoType: VideoType,
  selectedPatternIds: NarrativePatternId[] = [],
): string[] {
  return getNarrativePatternsForVideoType(videoType, selectedPatternIds).map(pattern =>
    `${pattern.label}：${pattern.narrative_engine}；${formatPatternMeta(pattern)}节奏=${pattern.pacing_pattern.join(' → ')}`
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
    pattern.subject_family ? `  题材族：${pattern.subject_family}${pattern.subgenre_tags?.length ? `；子流派=${pattern.subgenre_tags.join('、')}` : ''}` : '',
    pattern.user_facing_summary ? `  适用场景：${pattern.user_facing_summary}` : '',
    pattern.style_axes?.length ? `  表达风格轴：${pattern.style_axes.map(item => `${item.label}=${item.value}（${item.note}）`).join('；')}` : '',
    `  叙事引擎：${pattern.narrative_engine}`,
    `  主角引擎：${pattern.protagonist_engine}`,
    `  冲突引擎：${pattern.conflict_engine}`,
    `  节奏：${pattern.pacing_pattern.join(' → ')}`,
    `  场景配方：${pattern.scene_recipes.join('；')}`,
    `  质量信号：${pattern.quality_signals.join('；')}`,
    `  禁止：${pattern.avoid.join('；')}`,
  ].filter(Boolean));
}

function formatPatternMeta(pattern: NarrativePattern): string {
  const meta = [
    pattern.subgenre_tags?.length ? `子流派=${pattern.subgenre_tags.join('、')}` : '',
    pattern.style_axes?.length ? `表达轴=${pattern.style_axes.map(item => `${item.label}:${item.value}`).join('、')}` : '',
  ].filter(Boolean).join('；');
  return meta ? `${meta}；` : '';
}

function unique<T extends string>(items: T[]): T[] {
  return items.filter((item, index, arr) => arr.indexOf(item) === index);
}

function storyText(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    story.core_message,
    story.slogan_or_key_sentence,
    ...(story.protagonist_arc ?? []).flatMap(arc => [arc.starting_state, arc.turning_point, arc.resolution]),
    ...story.scene_breakdown.map(sceneText),
    ...story.gears_segments.flatMap(segment => [
      segment.script_text,
      segment.segment_prompt_hint ?? '',
      ...segment.visual_focus,
    ]),
  ].filter(Boolean).join('\n');
}

function sceneText(scene: StoryGenerateResult['scene_breakdown'][number]): string {
  return [
    scene.title,
    scene.location,
    scene.dramatic_function,
    scene.plot,
    scene.key_action,
    scene.conflict,
    scene.dialogue_or_narration,
    scene.visual_prompt,
    scene.camera_suggestion,
    scene.cultural_note,
    ...(scene.characters ?? []),
  ].filter(Boolean).join(' ');
}

function probeSignal(story: StoryGenerateResult, text: string, signal: string): {
  status: NarrativePatternDiagnosticStatus;
  evidence: string[];
  sceneIds: number[];
} {
  const probe = signalProbe(signal);
  const sceneMatches = story.scene_breakdown
    .map(scene => ({
      scene,
      hits: probe.terms.filter(term => sceneText(scene).includes(term)),
    }))
    .filter(item => item.hits.length > 0);
  const allHits = probe.terms.filter(term => text.includes(term));
  const requiredHits = probe.requiredTerms.filter(term => text.includes(term));
  const hasStructuralEvidence = probe.structural(story);
  const enoughTerms = allHits.length >= probe.minHits && requiredHits.length >= probe.requiredHits;

  const status: NarrativePatternDiagnosticStatus = hasStructuralEvidence || enoughTerms
    ? 'satisfied'
    : allHits.length > 0 || sceneMatches.length > 0
      ? 'weak'
      : 'missing';
  return {
    status,
    evidence: unique([...requiredHits, ...allHits]).slice(0, 6),
    sceneIds: sceneMatches.map(item => item.scene.scene_id).slice(0, 3),
  };
}

function signalProbe(signal: string): {
  terms: string[];
  requiredTerms: string[];
  minHits: number;
  requiredHits: number;
  structural: (story: StoryGenerateResult) => boolean;
} {
  const textTerms = signalTermMap(signal);
  const requiredTerms = requiredSignalTermMap(signal);
  const terms = unique([...textTerms, ...requiredTerms]);
  const desiredMinHits = signal.includes('明确') || signal.includes('清楚') || signal.includes('行动具体') ? 1 : 2;
  return {
    terms,
    requiredTerms,
    minHits: Math.min(terms.length || 1, desiredMinHits),
    requiredHits: requiredTerms.length > 0 ? 1 : 0,
    structural: structuralProbe(signal),
  };
}

function signalTermMap(signal: string): string[] {
  const map: Array<[RegExp, string[]]> = [
    [/起点低|低位|弱者/, ['少年', '初入', '无名', '底层', '贫', '弱', '不会', '短板', '低位']],
    [/成长|突破|变强|步骤/, ['训练', '失败', '试炼', '学习', '突破', '代价', '阶段', '短板']],
    [/代价|牺牲|失败/, ['代价', '失去', '受伤', '牺牲', '失败', '后果', '风险', '付出']],
    [/资源|规则|任务/, ['规则', '资源', '限制', '倒计时', '任务', '惩罚', '结算', '禁忌']],
    [/团队|分工|群像/, ['同伴', '队友', '分工', '各自', '群像', '配合', '误解', '反应']],
    [/因果|主线|顺序|不断/, ['因为', '于是', '导致', '若', '才', '看见', '生出', '承担', '主线', '承接', '后果', '上一', '下一']],
    [/目标明确|人物目标|主角目标/, ['目标', '所求', '要弄清', '为了', '志向', '求学不是']],
    [/选择|两难|目标|精神落点/, ['目标', '选择', '两难', '决定', '拒绝', '坚持', '转身', '站位', '未签', '停住', '重查', '投江', '怀石', '良知', '殉志']],
    [/线索|真相|悬疑|旧案|反转|证据/, ['线索', '真相', '旧案', '异常', '误判', '反转', '嫌疑', '证据', '案卷', '证词', '疑点', '封存', '文献', '旧地图']],
    [/钩子|前3秒|反转可承接|结尾|停留点/, ['钩子', '突然', '门外', '未完', '下一', '谁', '为什么', '？', '?', '逼近', '催签', '传唤', '案号', '反常']],
    [/关系|情感|名节|压力/, ['关系', '承诺', '信物', '名节', '门规', '情义', '保护', '决裂', '上官', '少年', '见证者', '匠人', '学徒']],
    [/江湖|门派|师徒|庙堂|官府|侠义/, ['江湖', '门派', '师父', '师兄', '门规', '官府', '朝堂', '侠义', '会盟']],
    [/对白|潜台词/, ['沉默', '打断', '停顿', '反问', '没有回答', '低声', '冷冷', '问', '说', '答', '一句']],
    [/行动具体|动词具体/, ['系紧', '停下脚步', '蹲下', '扶起', '挽起', '踩进', '捞起', '裹书', '写下', '长揖', '背起', '收起', '推开', '翻开', '重查', '怀石', '走向', '穿针', '落针', '劈丝', '收针']],
    [/人物不是年表/, ['背起', '停下脚步', '蹲下', '挽起', '踩进', '写下', '此刻', '少年', '站在', '走向', '整理衣冠', '停住笔']],
    [/史实边界|事实边界|文化边界|再现边界/, ['确证', '影视化创作', '事实边界', '史实边界', '再现边界', '不是《爱莲说》', '不把', '说清', '据', '可考', '传统叙述']],
    [/制度压力|阻力|时代压力/, ['官场规则', '制度压力', '时代压力', '名声', '人情', '催客', '浊浪', '路远', '上官', '催签', '郢都失守', '流放', '亡国']],
    [/画面|可拍|视听|动作|空间|名场面|情绪高点/, ['特写', '推近', '远景', '光线', '道具', '站位', '脚步', '伸手', '定格', '烛火', '江水', '汨罗江', '绣架', '针尖']],
    [/流程|材料|工具|仪式|工艺|匠心/, ['材料', '工具', '步骤', '手', '火候', '等待', '仪式', '人群', '丝线', '绸面', '图样', '绣架', '针尖', '劈丝', '穿针', '落针', '收针']],
    [/来源|边界|史实|版本|现场/, ['来源', '史实', '边界', '传说', '版本', '据', '可能', '创作', '现场', '文献', '匾额', '台基', '展陈', '旧照片', '旧地图']],
    [/古今|当代|路线|意义|物件/, ['今天', '当代', '旧物', '成品', '物件', '现场', '回到', '镜头从', '展陈', '传承']],
    [/主张|符号|口号|传播/, ['主张', '符号', '记住', '定格', '成品', '纹样', '色彩', '绣面']],
  ];
  const matched = map.flatMap(([pattern, terms]) => pattern.test(signal) ? terms : []);
  const fallback = signal.match(/[\u4e00-\u9fa5]{2,4}/g) ?? [];
  return unique([...matched, ...fallback]);
}

function requiredSignalTermMap(signal: string): string[] {
  if (/任务规则/.test(signal)) return ['任务', '规则'];
  if (/失败代价/.test(signal)) return ['失败', '惩罚', '代价', '后果'];
  if (/团队分工/.test(signal)) return ['队友', '分工', '配合'];
  if (/前3秒有局|3秒钩子/.test(signal)) return ['开场', '钩子', '危机', '压力', '突然'];
  if (/反转可承接|钩子可承接/.test(signal)) return ['下一', '结尾', '钩子', '承接', '？', '?'];
  if (/保留原作|人物不丢失|关系不改写|主线不换题/.test(signal)) return ['主角', '人物', '主线', '关系', '来源', '素材'];
  if (/江湖规则|侠义|门派|师徒/.test(signal)) return ['江湖', '门派', '门规', '侠义', '师父'];
  if (/代价/.test(signal)) return ['代价', '后果', '失去', '风险', '牺牲'];
  if (/线索/.test(signal)) return ['线索', '证据', '旧案', '真相'];
  return [];
}

function structuralProbe(signal: string): (story: StoryGenerateResult) => boolean {
  if (/前3秒有局|3秒钩子/.test(signal)) {
    return story => {
      const first = story.scene_breakdown[0];
      if (!first) return false;
      return Boolean(first.conflict)
        || /危机|逼|误会|突然|倒计时|拦住|质问|追/.test(sceneText(first));
    };
  }
  if (/集内目标|单集闭环|阶段结果/.test(signal)) {
    return story => story.scene_breakdown.some(scene => Boolean(scene.conflict))
      && story.scene_breakdown.some(scene => /结果|终于|决定|查清|完成|留下|离开/.test(sceneText(scene)));
  }
  if (/人物不丢失|主线不换题|新增内容不抢戏|保留原作主线|不牺牲原作/.test(signal)) {
    return story => {
      const protagonist = story.characters?.[0]?.name ?? story.source_entry.split(/[——：:]/)[0];
      const text = storyText(story);
      return Boolean(protagonist && text.includes(protagonist))
        && story.scene_breakdown.every(scene => scene.plot.trim().length >= 20);
    };
  }
  if (/关系不改写|关系冲突强|关系压力|关系升级/.test(signal)) {
    return story => story.scene_breakdown.some(scene =>
      (scene.characters?.length ?? 0) >= 2
      && /冲突|逼|问|催|拦|对峙|沉默|低声|争|压力/.test(sceneText(scene))
    );
  }
  if (/反转可承接|钩子可承接|长期线不断裂|长线不断|不是硬断章|钩子来自原作/.test(signal)) {
    return story => {
      const last = story.scene_breakdown[story.scene_breakdown.length - 1];
      return Boolean(last && /下一|门外|未完|新证|新线索|反常|钩子|留下|再/.test(sceneText(last)));
    };
  }
  if (/角色分工|团队分工|群像/.test(signal)) {
    return story => new Set(story.scene_breakdown.flatMap(scene => scene.characters ?? [])).size >= 3;
  }
  if (/场景功能|可拍|视听|画面/.test(signal)) {
    return story => story.scene_breakdown.every(scene => scene.visual_prompt.trim().length >= 12 && scene.key_action.trim().length > 0);
  }
  if (/名场面可拍|视听动作具体|情绪高点清楚|不靠长解释/.test(signal)) {
    return story => story.scene_breakdown.some(scene => /特写|定格|推近|对切|近景|远景|烛火|江水|针尖/.test(scene.visual_prompt))
      && story.scene_breakdown.some(scene => /推开|翻开|停住|重查|怀石|走向|穿针|落针|收针|定格/.test(sceneText(scene)));
  }
  if (/关系压力|人物变化/.test(signal)) {
    return story => (story.protagonist_arc?.length ?? 0) > 0
      || story.scene_breakdown.some(scene => (scene.characters?.length ?? 0) >= 2 && Boolean(scene.conflict));
  }
  if (/流程完整|材料工具清楚|动词具体|匠心来自动作|工艺流程/.test(signal)) {
    return story => {
      const text = storyText(story);
      const hasMaterial = /丝线|绸面|图样|绣架|针尖|工具|材料|底布/.test(text);
      const hasAction = /劈丝|穿针|落针|收针|配色|理顺|检查|放慢/.test(text);
      return hasMaterial && hasAction;
    };
  }
  if (/现场明确|来源提示存在|版本差异可见|再现边界清楚|事实边界/.test(signal)) {
    return story => {
      const text = storyText(story);
      return /现场|匾额|台基|展陈|旧地图|旧照片/.test(text)
        && /据|文献|可考|事实边界|再现边界|传统叙述|版本/.test(text);
    };
  }
  if (/线索物明确|古今连接自然|画面路线清楚|物件意义有变化/.test(signal)) {
    return story => {
      const text = storyText(story);
      return /物件|成品|旧物|匾额|案卷|丝线|绣面|现场/.test(text)
        && /今天|当代|回到|镜头从|一路|路线|传承|展陈/.test(text);
    };
  }
  return () => false;
}

function suggestedSceneIdsForSignal(story: StoryGenerateResult, signal: string): number[] {
  if (story.scene_breakdown.length === 0) return [];
  if (/开场|起点|目标|前3秒|3秒/.test(signal)) return [story.scene_breakdown[0].scene_id];
  if (/结尾|钩子|回扣|承接|余味/.test(signal)) return [story.scene_breakdown[story.scene_breakdown.length - 1].scene_id];
  if (/代价|转折|反转|真相|选择|关系/.test(signal)) {
    const middle = story.scene_breakdown[Math.max(0, Math.floor(story.scene_breakdown.length / 2))];
    return middle ? [middle.scene_id] : [];
  }
  return [story.scene_breakdown[0].scene_id];
}

function patternImpact(pattern: NarrativePattern, signal: string): string {
  if (pattern.subject_family === 'adaptation') return '改编流派信号不足会让输出像重新创作，削弱原作保真和分集承接。';
  if (pattern.subject_family === 'wuxia') return '武侠机制不足会让江湖、师承、侠义或旧案只停留在标签，缺少可拍的类型质感。';
  if (/钩子|反转/.test(signal)) return '钩子不足会降低短剧/漫剧追看动力。';
  return `「${pattern.label}」依赖该信号让叙事机制被观众看见。`;
}

function buildPatternRepairHint(pattern: NarrativePattern, signal: string, story: StoryGenerateResult): string {
  const sceneIds = suggestedSceneIdsForSignal(story, signal);
  const sceneLabel = sceneIds.length > 0 ? `在场景 ${sceneIds.join('、')} ` : '在对应场景 ';
  const recipe = pattern.scene_recipes[0] ?? pattern.narrative_engine;
  return `${sceneLabel}补强「${pattern.label} / ${signal}」：${recipe}，并写成动作、冲突、后果或镜头证据。`;
}
