// web/server/src/services/genre-story-profiles.ts
// Central profile registry for genre-aware text generation.

import type {
  CreationUseCase,
  NarrativePatternId,
  PresentationStyle,
  StoryStructureType,
  TruthMode,
  VideoType,
} from '@shared/types.js';

export type GenreOutputField =
  | 'characters'
  | 'protagonist_arc'
  | 'visual_symbols'
  | 'core_message'
  | 'slogan_or_key_sentence'
  | 'craft_or_ritual_process'
  | 'modern_connection'
  | 'spatial_identity'
  | 'visual_route'
  | 'time_layer'
  | 'atmosphere'
  | 'argument_points'
  | 'knowledge_outline'
  | 'source_quotes'
  | 'field_notes';

export interface GenreSceneTemplate {
  position: number;
  function_label: string;
  function_description: string;
  content_guide: string;
}

export interface GenreDramaticStructure {
  video_type: VideoType;
  label: string;
  min_scenes: number;
  max_scenes: number;
  scene_templates: GenreSceneTemplate[];
}

export interface GenreStoryMatrixFields {
  compatible_use_cases: CreationUseCase[];
  compatible_truth_modes: TruthMode[];
  default_truth_mode: TruthMode;
  recommended_narrative_patterns: NarrativePatternId[];
  allowed_narrative_patterns: NarrativePatternId[];
  forbidden_narrative_patterns: NarrativePatternId[];
  material_requirements: string[];
  truth_rules: string[];
  institutional_rules: string[];
  adaptation_rules: string[];
}

export interface GenreStoryProfile extends GenreStoryMatrixFields {
  video_type: VideoType;
  label: string;
  narrative_promise: string;
  default_story_structures: StoryStructureType[];
  compatible_presentation_styles: PresentationStyle[];
  text_shape: string;
  framework: string[];
  must_include: string[];
  avoid: string[];
  required_fields: GenreOutputField[];
  scene_rules: string[];
  gears_rules: string[];
  quality_rules: string[];
  repair_guidance: string[];
  dramatic_structure: GenreDramaticStructure;
}

export interface GenreSampleGuidance {
  reference_samples: string[];
  opening_moves: string[];
  middle_moves: string[];
  ending_moves: string[];
  visual_moves: string[];
  script_moves: string[];
  quality_signals: string[];
}

export interface GenreStoryMatrixResolution {
  video_type: VideoType;
  creation_use_case: CreationUseCase;
  truth_mode: TruthMode;
  default_truth_mode: TruthMode;
  compatible_use_case: boolean;
  compatible_truth_mode: boolean;
  recommended_narrative_patterns: NarrativePatternId[];
  allowed_narrative_patterns: NarrativePatternId[];
  forbidden_narrative_patterns: NarrativePatternId[];
  rejected_narrative_pattern_ids: NarrativePatternId[];
  resolved_narrative_pattern_ids: NarrativePatternId[];
  material_requirements: string[];
  truth_rules: string[];
  institutional_rules: string[];
  adaptation_rules: string[];
  requirement_lines: string[];
  warnings: string[];
}

type GenreStoryProfileBase = Omit<GenreStoryProfile, keyof GenreStoryMatrixFields>;

const PROFILES: Record<VideoType, GenreStoryProfileBase> = {
  character_story: {
    video_type: 'character_story',
    label: '人物故事',
    narrative_promise: '围绕人物选择、阻力、代价和精神落点展开。',
    default_story_structures: ['single_event_drama', 'three_act_drama', 'memory_mosaic_biography'],
    compatible_presentation_styles: ['cinematic', 'documentary', 'ai_comic', 'voiceover_montage'],
    text_shape: '连续剧情正文，场景推进清楚，主角通过行动被看见。',
    framework: ['钩子开场', '主角处境', '冲突升级', '关键行动', '高潮选择', '余味结尾'],
    must_include: ['主角目标', '可视化阻力', '价值选择', '选择代价', '人物弧光', '可信度边界'],
    avoid: ['传记流水账', '只罗列生平成就', '用抽象赞美代替选择'],
    required_fields: ['characters', 'protagonist_arc'],
    scene_rules: ['每场都要推进人物处境或选择压力', '结尾必须体现人物精神变化'],
    gears_rules: ['segment_prompt_hint 标明人物选择和情绪压力', 'script_text 保留核心动作与关键对白'],
    quality_rules: ['必须有主角目标', '必须有阻力', '必须有选择和代价', '不得写成年表式介绍'],
    repair_guidance: ['补强主角当下目标', '把抽象评价改写成行动', '为结尾增加精神落点'],
    dramatic_structure: {
      video_type: 'character_story',
      label: '人物故事',
      min_scenes: 5,
      max_scenes: 7,
      scene_templates: [
        { position: 0, function_label: '钩子开场', function_description: '直接进入危机或关键场面', content_guide: '直接进入危机/关键场面，不用介绍背景。用具体地点+时间+动作开场。开头第一句要制造紧张感或悬念。' },
        { position: 1, function_label: '主角处境', function_description: '主角身份、面对的选择、外部压力', content_guide: '交代主角身份、他为什么面对这个选择、上官/制度/世俗压力是什么。但要快速，不要写人物简介。' },
        { position: 2, function_label: '冲突升级', function_description: '对立面强化、两难加深', content_guide: '强化对立面。如果他坚持选择，会付出什么代价。冲突必须有具体选择压力。' },
        { position: 3, function_label: '关键行动', function_description: '主角做出选择、采取行动', content_guide: '主角做出关键选择。行动要有画面感，有实物、动作或一句关键话。' },
        { position: 4, function_label: '高潮', function_description: '核心台词/核心行动、局面反转', content_guide: '核心台词或核心行动爆发，局面发生反转。这是情绪最高点。' },
        { position: 5, function_label: '结尾', function_description: '结果、精神落点、主题升华', content_guide: '结果加精神落点。结尾要落到人格、信念或文化精神上。' },
      ],
    },
  },
  historical_drama: {
    video_type: 'historical_drama',
    label: '历史剧情短片',
    narrative_promise: '在史实锚点下还原历史事件中的压力、因果和人物选择。',
    default_story_structures: ['single_event_drama', 'three_act_drama', 'case_reconstruction'],
    compatible_presentation_styles: ['cinematic', 'documentary', 'ai_comic'],
    text_shape: '有历史现场感的剧情正文，史实和影视化补足边界清晰。',
    framework: ['时代危机', '人物卷入', '制度压力', '关键行动', '正面冲突', '历史余响'],
    must_include: ['历史场景质感', '事件因果', '史实锚点', '影视化边界'],
    avoid: ['把虚构对白写成史料原文', '架空历史', '只写宏大背景不写人物行动'],
    required_fields: ['characters', 'protagonist_arc'],
    scene_rules: ['每场都要标出事件因果', '关键冲突不能脱离史实锚点'],
    gears_rules: ['分段中保留史实边界提示', '视觉提示要服务时代质感'],
    quality_rules: ['必须有时代压力', '必须有事件因果', '必须标注创作边界'],
    repair_guidance: ['补充史实依据', '压缩宏观背景', '把历史说明改成场景行动'],
    dramatic_structure: {
      video_type: 'historical_drama',
      label: '历史剧情短片',
      min_scenes: 5,
      max_scenes: 7,
      scene_templates: [
        { position: 0, function_label: '时代危机', function_description: '宏观背景、局势紧迫', content_guide: '从宏观局势切入。建立历史现场感，不用先介绍人物。' },
        { position: 1, function_label: '人物卷入', function_description: '主角被卷入事件', content_guide: '写主角如何进入事件中心，他的职责、身份或处境是什么。' },
        { position: 2, function_label: '冲突升级', function_description: '制度压力、权力对抗', content_guide: '强化制度、权力或时代压力。矛盾不只是个人层面。' },
        { position: 3, function_label: '关键行动', function_description: '研究案卷/争辩/拒绝', content_guide: '主角采取具体行动。行动要有实物、地点和动作。' },
        { position: 4, function_label: '高潮', function_description: '正面冲突爆发', content_guide: '正面冲突爆发，关键话语、动作或证据让局面变化。' },
        { position: 5, function_label: '历史余响', function_description: '事件后续影响', content_guide: '写事件后续和历史余响，不只是个人结局。' },
      ],
    },
  },
  legend_story: {
    video_type: 'legend_story',
    label: '神话/传说故事',
    narrative_promise: '以传说意象和凡人选择呈现民间故事的象征力量。',
    default_story_structures: ['single_event_drama', 'three_act_drama', 'object_clue_journey'],
    compatible_presentation_styles: ['cinematic', 'animation_2d', 'ink_style', 'ai_comic'],
    text_shape: '有神异氛围、象征画面和传说边界的叙事文本。',
    framework: ['传说起源', '神异显现', '凡人考验', '命运转折', '传说流传'],
    must_include: ['神异元素', '象征画面', '民间版本提示', '传说与史实边界'],
    avoid: ['把口述传说写成确定史实', '只堆奇观没有人的选择', '现代解释腔过重'],
    required_fields: ['characters'],
    scene_rules: ['神异元素必须服务人的选择', '每段都要保留传说质感'],
    gears_rules: ['视觉提示突出象征意象', '约束提示标明传说边界'],
    quality_rules: ['必须有象征意象', '必须有人物考验', '必须标明传说边界'],
    repair_guidance: ['增加凡人的选择', '补充传说边界', '减少现代解释性旁白'],
    dramatic_structure: {
      video_type: 'legend_story',
      label: '神话/传说故事',
      min_scenes: 4,
      max_scenes: 6,
      scene_templates: [
        { position: 0, function_label: '远古传说', function_description: '神话/传说背景引入', content_guide: '从远古或超自然背景切入，建立神话氛围，不用现代视角。' },
        { position: 1, function_label: '神力显现', function_description: '超自然力量介入', content_guide: '写神力、预兆、异象或天命如何介入凡人世界。' },
        { position: 2, function_label: '凡人考验', function_description: '人的选择与考验', content_guide: '核心是人。凡人面对考验时如何犹豫、害怕或选择。' },
        { position: 3, function_label: '命运转折', function_description: '命运/天意转折', content_guide: '写命运和人力交汇的转折点。' },
        { position: 4, function_label: '传说永恒', function_description: '传说流传至今', content_guide: '写这个传说为什么被世代传颂，它照见什么文化意义。' },
      ],
    },
  },
  ai_comic_drama: {
    video_type: 'ai_comic_drama',
    label: 'AI漫剧',
    narrative_promise: '用强分镜、强对白、强表情和结尾钩子推动追看。',
    default_story_structures: ['single_event_drama', 'three_act_drama', 'memory_mosaic_biography'],
    compatible_presentation_styles: ['ai_comic', 'vertical_drama', 'animation_2d', 'cinematic'],
    text_shape: '场景短促，情绪和对白密度高，每段能转成漫画分镜。',
    framework: ['钩子开场', '人物登场', '对白冲突', '反转觉醒', '高燃收束'],
    must_include: ['对白/旁白', '表情标注', '漫画分镜画面', '结尾钩子'],
    avoid: ['长段旁白压过对白', '没有表情动作', '每场缺少画面冲击'],
    required_fields: [],
    scene_rules: ['每场都有可画成定格的画面', '每场都有情绪或表情变化'],
    gears_rules: ['segment_prompt_hint 必须提示漫画分镜感', 'script_text 保留对白和情绪'],
    quality_rules: ['必须有对白或强旁白', '必须有结尾钩子', '必须有表情动作'],
    repair_guidance: ['增加对白交锋', '补强表情变化', '为结尾增加追看钩子'],
    dramatic_structure: {
      video_type: 'ai_comic_drama',
      label: 'AI漫剧',
      min_scenes: 5,
      max_scenes: 6,
      scene_templates: [
        { position: 0, function_label: '钩子开场', function_description: '强视觉画面+悬念', content_guide: '用最紧张的画面定格开场，制造悬念。每个画面要有构图和表情。' },
        { position: 1, function_label: '人物登场', function_description: '角色身份+初始困境', content_guide: '用对白和表情标注角色身份和处境。对白要短。' },
        { position: 2, function_label: '冲突爆发', function_description: '对白冲突+分镜感', content_guide: '对白冲突爆发，配合表情标注和快速分镜切换。' },
        { position: 3, function_label: '反转/觉醒', function_description: '行动反转+精神觉醒', content_guide: '主角做出意料之外的行动，有明显表情变化和动作转折。' },
        { position: 4, function_label: '高燃收束', function_description: '金句+画面定格', content_guide: '主角说出核心话语，画面定格，留下情绪或悬念。' },
      ],
    },
  },
  children_story: {
    video_type: 'children_story',
    label: '儿童故事',
    narrative_promise: '用儿童可理解的因果、温和冲突和正向选择表达文化价值。',
    default_story_structures: ['single_event_drama', 'three_act_drama'],
    compatible_presentation_styles: ['children_animation', 'animation_2d', 'ink_style'],
    text_shape: '语言清楚温和，因果简单，结尾温暖。',
    framework: ['小主人公', '遇到问题', '探索发现', '勇敢选择', '温暖结尾'],
    must_include: ['儿童可理解语言', '正向价值', '清楚因果', '温暖安全的情绪'],
    avoid: ['成人化复杂表达', '恐怖暴力细节', '晦涩典故堆砌'],
    required_fields: ['characters', 'protagonist_arc'],
    scene_rules: ['每场只承载一个简单行动', '冲突不能造成压迫感过强'],
    gears_rules: ['视觉提示明亮温和', '分段文本适合儿童动画表达'],
    quality_rules: ['语言必须简单', '结尾必须温暖', '不得出现不适合儿童的细节'],
    repair_guidance: ['简化官场或历史复杂性', '把沉重冲突改成可理解问题', '增加温暖结尾'],
    dramatic_structure: {
      video_type: 'children_story',
      label: '儿童故事',
      min_scenes: 5,
      max_scenes: 6,
      scene_templates: [
        { position: 0, function_label: '小主人公', function_description: '少年人物出场', content_guide: '用儿童能理解的视角出场，有好奇心和正义感。' },
        { position: 1, function_label: '遇到问题', function_description: '简化困境', content_guide: '发现一个孩子能理解的问题，因果要简单。' },
        { position: 2, function_label: '学习成长', function_description: '探索与发现', content_guide: '通过询问、观察、尝试找到答案。' },
        { position: 3, function_label: '做出选择', function_description: '正向抉择', content_guide: '勇敢做正确的选择，用简单语言表达。' },
        { position: 4, function_label: '温暖结尾', function_description: '成长收获', content_guide: '问题解决，主人公获得成长，结尾温暖正向。' },
      ],
    },
  },
  culture_promo: {
    video_type: 'culture_promo',
    label: '文化宣传片',
    narrative_promise: '用视觉符号、文化根基、当代延续和传播关键句建立传播力。',
    default_story_structures: ['object_clue_journey', 'lecture_argument'],
    compatible_presentation_styles: ['voiceover_montage', 'documentary', 'museum_exhibit', 'social_media_fastcut'],
    text_shape: '宣传片旁白和画面组织，不是剧情短片。',
    framework: ['符号引入', '文化根基', '过程展示', '现代传承', '标语收束'],
    must_include: ['核心视觉符号', '核心信息', '当代连接', '一句可传播关键句'],
    avoid: ['纯口号堆砌', '百科介绍', '没有画面路线'],
    required_fields: ['visual_symbols', 'core_message', 'slogan_or_key_sentence', 'modern_connection'],
    scene_rules: ['先让观众看到符号，再讲文化根基', '结尾要有传播记忆点'],
    gears_rules: ['视觉焦点突出符号和过程', '分段提示宣传片画面节奏'],
    quality_rules: ['必须有核心主张', '必须有视觉符号', '必须有当代连接'],
    repair_guidance: ['补充视觉符号', '把口号改成可拍画面', '增加当代延续'],
    dramatic_structure: {
      video_type: 'culture_promo',
      label: '文化宣传片',
      min_scenes: 4,
      max_scenes: 5,
      scene_templates: [
        { position: 0, function_label: '符号引入', function_description: '文化符号/视觉锚点开场', content_guide: '用最具代表性的文化符号开场。画面要美，氛围要浓。' },
        { position: 1, function_label: '文化根基', function_description: '文化渊源与精神内核', content_guide: '追溯文化渊源和精神根基，要有历史纵深。' },
        { position: 2, function_label: '技艺展示', function_description: '核心技艺/仪式过程展示', content_guide: '展示核心技艺、仪式或代表过程，要有动作、材料或声音。' },
        { position: 3, function_label: '现代传承', function_description: '当代传承与创新', content_guide: '传统如何在现代延续，要有现实温度。' },
        { position: 4, function_label: '标语收束', function_description: '核心标语/品牌信息定格', content_guide: '用一句凝练关键句收束，画面定格。' },
      ],
    },
  },
  heritage_promo: {
    video_type: 'heritage_promo',
    label: '非遗/工艺宣传片',
    narrative_promise: '让技艺流程、手部动作、匠人情感和传承困境同时成立。',
    default_story_structures: ['object_clue_journey', 'before_after_transformation'],
    compatible_presentation_styles: ['documentary', 'voiceover_montage', 'museum_exhibit', 'social_media_fastcut'],
    text_shape: '工艺流程清楚，画面聚焦材料、工具、手部动作和传承关系。',
    framework: ['技艺渊源', '匠人登场', '工艺全程', '精神内核', '传承之路'],
    must_include: ['原料/工具/手部动作', '完整流程', '传承人或实践者', '传承困境与希望'],
    avoid: ['只写成普通宣传口号', '忽略工艺步骤', '把工艺流程写成玄学'],
    required_fields: ['visual_symbols', 'craft_or_ritual_process', 'modern_connection', 'core_message', 'slogan_or_key_sentence'],
    scene_rules: ['至少两场写清工艺动作或步骤', '人物情感要来自技艺过程'],
    gears_rules: ['视觉焦点包含材料、工具和手部动作', '分段提示适合微距和过程镜头'],
    quality_rules: ['必须有工艺流程', '必须有材料或工具', '必须有传承关系'],
    repair_guidance: ['补充具体步骤', '把抽象匠心改成手部动作', '增加传承困境'],
    dramatic_structure: {
      video_type: 'heritage_promo',
      label: '非遗/工艺宣传片',
      min_scenes: 4,
      max_scenes: 6,
      scene_templates: [
        { position: 0, function_label: '技艺渊源', function_description: '非遗项目的历史起源', content_guide: '从技艺的历史起源切入，用实物或文献建立历史感。' },
        { position: 1, function_label: '匠人登场', function_description: '传承人/匠人出场', content_guide: '写匠人与这门技艺的情感联结。' },
        { position: 2, function_label: '工艺全程', function_description: '完整工艺流程展示', content_guide: '展示从原料到成品的关键步骤，要有手的动作和材料质感。' },
        { position: 3, function_label: '精神内核', function_description: '技艺背后的精神与文化', content_guide: '通过匠人的行为表达精神，不只喊口号。' },
        { position: 4, function_label: '传承之路', function_description: '传承困境与未来展望', content_guide: '写传承现实和希望。' },
      ],
    },
  },
  city_brand_promo: {
    video_type: 'city_brand_promo',
    label: '城市/文旅宣传片',
    narrative_promise: '用地标、历史、人文和生活气息凝练地方气质。',
    default_story_structures: ['object_clue_journey', 'lecture_argument'],
    compatible_presentation_styles: ['voiceover_montage', 'documentary', 'social_media_fastcut'],
    text_shape: '城市形象片文案，空间识别清楚，古今连接自然。',
    framework: ['地标引入', '历史底蕴', '人文风貌', '生活气息', '品牌定格'],
    must_include: ['城市空间识别', '地方文化特色', '现实生活温度', '品牌主张'],
    avoid: ['空镜堆砌', '游客广告腔', '只喊城市口号没有地方细节'],
    required_fields: ['visual_symbols', 'core_message', 'slogan_or_key_sentence', 'modern_connection'],
    scene_rules: ['每场都要有地方识别细节', '城市不只作为景点，要作为生活空间'],
    gears_rules: ['视觉焦点包含地标、人文和生活场景', '分段提示文旅宣传节奏'],
    quality_rules: ['必须有地标识别', '必须有城市气质', '必须有生活场景'],
    repair_guidance: ['加入真实地方细节', '减少泛化口号', '增加古今连接'],
    dramatic_structure: {
      video_type: 'city_brand_promo',
      label: '城市/文旅宣传片',
      min_scenes: 4,
      max_scenes: 5,
      scene_templates: [
        { position: 0, function_label: '地标引入', function_description: '城市标志性空间开场', content_guide: '用最具标志性的地标开场，建立空间认同感。' },
        { position: 1, function_label: '历史底蕴', function_description: '城市的历史纵深', content_guide: '用具体故事让历史活在今天。' },
        { position: 2, function_label: '人文风貌', function_description: '地方文化特色展示', content_guide: '展示地方文化特色和烟火气。' },
        { position: 3, function_label: '生活气息', function_description: '当代生活场景', content_guide: '写生活在这座城市的人和日常节奏。' },
        { position: 4, function_label: '品牌定格', function_description: '城市品牌形象定格', content_guide: '用一句凝练表达定格城市印象。' },
      ],
    },
  },
  social_short: {
    video_type: 'social_short',
    label: '竖屏短视频',
    narrative_promise: '前 3 秒抓人，中段高信息密度，结尾有可转发记忆点。',
    default_story_structures: ['single_event_drama', 'object_clue_journey'],
    compatible_presentation_styles: ['social_media_fastcut', 'vertical_drama', 'host_narration'],
    text_shape: '短句、强钩子、强字幕感，适合竖屏快节奏。',
    framework: ['3秒钩子', '关键信息', '情绪推进', '金句落点'],
    must_include: ['竖屏节奏', '强开头', '字幕/画面记忆点', '可转发核心句'],
    avoid: ['铺垫过长', '横屏长片节奏', '信息过散'],
    required_fields: ['visual_symbols', 'core_message', 'slogan_or_key_sentence'],
    scene_rules: ['第一场必须直接给出钩子', '每场只承载一个信息点'],
    gears_rules: ['script_text 短句化', 'segment_prompt_hint 提示快切和字幕'],
    quality_rules: ['开头必须有钩子', '必须有三类信息点或一个强记忆点', '不得铺垫过长'],
    repair_guidance: ['重写第一句钩子', '压缩长句', '补充字幕记忆点'],
    dramatic_structure: {
      video_type: 'social_short',
      label: '竖屏短视频',
      min_scenes: 3,
      max_scenes: 4,
      scene_templates: [
        { position: 0, function_label: '3秒钩子', function_description: '强冲击画面', content_guide: '3秒内抓住观众，最紧张画面加最有记忆点的一句话。' },
        { position: 1, function_label: '关键信息', function_description: '核心事实', content_guide: '讲清谁、什么事、什么结果，信息密度高。' },
        { position: 2, function_label: '情绪推进', function_description: '感情渲染', content_guide: '用快节奏画面推进情绪。' },
        { position: 3, function_label: '金句落点', function_description: '定格金句', content_guide: '最后一句是记忆点，画面定格加文字。' },
      ],
    },
  },
  documentary_short: {
    video_type: 'documentary_short',
    label: '微纪录片',
    narrative_promise: '用现实现场、史料、再现和解读组成可信短纪录结构。',
    default_story_structures: ['witness_testimony', 'case_reconstruction', 'memory_mosaic_biography'],
    compatible_presentation_styles: ['documentary', 'museum_exhibit', 'voiceover_montage'],
    text_shape: '纪实旁白为主，现场和史料并重，事实与再现边界清楚。',
    framework: ['现实引入', '历史回望', '关键节点', '史料/专家解读', '当代意义'],
    must_include: ['现实地点或实物', '史料引用或来源提示', '可拍摄现场素材', '事实与再现边界'],
    avoid: ['把传说当作确证历史', '完全戏剧对白化', '缺少现场或文献依据'],
    required_fields: ['source_quotes', 'field_notes'],
    scene_rules: ['现实现场和历史回望要交替支撑', '再现内容必须标出边界'],
    gears_rules: ['视觉焦点包含现场素材和史料实物', '分段提示纪实拍法'],
    quality_rules: ['必须有现实现场', '必须有来源提示', '必须有事实边界'],
    repair_guidance: ['补充现场物件', '增加来源提示', '把戏剧对白改成纪实叙述'],
    dramatic_structure: {
      video_type: 'documentary_short',
      label: '微纪录片',
      min_scenes: 5,
      max_scenes: 6,
      scene_templates: [
        { position: 0, function_label: '现实引入', function_description: '当下场景引入', content_guide: '从现实地点、实物遗迹或今天还能看到的痕迹切入。' },
        { position: 1, function_label: '历史回望', function_description: '旁白讲述历史背景', content_guide: '用旁白讲述时代背景和人物处境，语气客观但有叙事线。' },
        { position: 2, function_label: '关键节点', function_description: '核心事件再现', content_guide: '讲述关键事件经过，用事实叙述但保留人物行动。' },
        { position: 3, function_label: '文化解释', function_description: '专家视角/史料解读', content_guide: '分析事件照见的精神或文化含义。' },
        { position: 4, function_label: '当代意义', function_description: '精神传承与现实意义', content_guide: '回到现实地点，表达当代连接。' },
      ],
    },
  },
  explainer_video: {
    video_type: 'explainer_video',
    label: '知识讲解视频',
    narrative_promise: '围绕一个问题，用概念、步骤、例子和总结让观众理解知识。',
    default_story_structures: ['lecture_argument', 'case_reconstruction'],
    compatible_presentation_styles: ['host_narration', 'museum_exhibit', 'animation_2d'],
    text_shape: '问题驱动、层级清楚、适合图文或动画辅助。',
    framework: ['提出问题', '概念解释', '关键步骤/脉络', '例子说明', '总结记忆点'],
    must_include: ['清晰论点', '知识大纲', '图文示意建议', '文化边界'],
    avoid: ['变成剧情短片', '知识点无层级', '只讲结论不讲为什么'],
    required_fields: ['argument_points', 'knowledge_outline'],
    scene_rules: ['每场只解释一个知识点', '例子必须服务概念'],
    gears_rules: ['视觉焦点包含图示、关键词和例子', '分段提示讲解画面'],
    quality_rules: ['必须有核心问题', '必须有知识层级', '必须有例子或类比'],
    repair_guidance: ['补充核心问题', '拆分知识层级', '增加例子说明'],
    dramatic_structure: {
      video_type: 'explainer_video',
      label: '知识讲解视频',
      min_scenes: 4,
      max_scenes: 6,
      scene_templates: [
        { position: 0, function_label: '提出问题', function_description: '核心问题/悬念引入', content_guide: '用一个引人思考的问题开场。问题比答案更有吸引力。' },
        { position: 1, function_label: '概念解释', function_description: '核心概念/知识点讲解', content_guide: '用类比、对比、视觉辅助讲清一个概念。' },
        { position: 2, function_label: '实例论证', function_description: '具体案例/事实支撑', content_guide: '用具体案例支撑概念，案例要简短有力。' },
        { position: 3, function_label: '逻辑深化', function_description: '深层原理/延伸思考', content_guide: '讲为什么和意味着什么，要有逻辑递进。' },
        { position: 4, function_label: '总结归纳', function_description: '知识要点归纳收束', content_guide: '用简洁语言总结核心要点，可加延伸问题。' },
      ],
    },
  },
  lecture_video: {
    video_type: 'lecture_video',
    label: '宣讲片',
    narrative_promise: '用案例支撑观点，提炼精神，并形成有号召力的结尾。',
    default_story_structures: ['lecture_argument', 'case_reconstruction'],
    compatible_presentation_styles: ['host_narration', 'documentary', 'voiceover_montage'],
    text_shape: '观点明确，论据有层次，结尾有力量但不过度口号化。',
    framework: ['提出主题', '讲述事实', '分析精神', '联系当下', '总结号召'],
    must_include: ['核心观点', '案例事实', '精神提炼', '现实连接'],
    avoid: ['空泛说教', '没有案例支撑', '把复杂史实简化成单一口号'],
    required_fields: ['argument_points', 'knowledge_outline'],
    scene_rules: ['每个观点都要有案例或事实支撑', '结尾要回到现实行动'],
    gears_rules: ['视觉焦点包含讲述者、案例画面和金句字幕', '分段提示宣讲节奏'],
    quality_rules: ['必须有中心观点', '必须有例证', '必须有现实连接'],
    repair_guidance: ['补充论点', '为观点增加案例', '减少空泛号召'],
    dramatic_structure: {
      video_type: 'lecture_video',
      label: '宣讲片',
      min_scenes: 5,
      max_scenes: 6,
      scene_templates: [
        { position: 0, function_label: '提出主题', function_description: '核心观点提出', content_guide: '直接提出核心主题，用案例引子开场。' },
        { position: 1, function_label: '讲述事实', function_description: '案例故事叙述', content_guide: '讲述事实经过，重点在行为和选择。' },
        { position: 2, function_label: '分析精神', function_description: '精神内涵提炼', content_guide: '提炼精神内涵，连接核心观点。' },
        { position: 3, function_label: '联系当下', function_description: '现实映射', content_guide: '联系当下，说明这种精神如何延续。' },
        { position: 4, function_label: '总结号召', function_description: '行动号召', content_guide: '用金句或名言收束，号召传承精神。' },
      ],
    },
  },
  education_training: {
    video_type: 'education_training',
    label: '教育/培训片',
    narrative_promise: '用学习目标、知识模块、步骤示范和复盘支持教学场景。',
    default_story_structures: ['lecture_argument'],
    compatible_presentation_styles: ['host_narration', 'museum_exhibit', 'animation_2d'],
    text_shape: '课程式结构，目标明确，步骤和复盘清楚。',
    framework: ['学习目标', '知识模块', '操作/理解步骤', '案例练习', '复盘要点'],
    must_include: ['教学目标', '分层知识大纲', '可复盘要点', '适合课堂或培训的节奏'],
    avoid: ['只做宣传', '知识点过散', '缺少学习路径'],
    required_fields: ['argument_points', 'knowledge_outline'],
    scene_rules: ['每场对应一个学习环节', '必须有练习或提问'],
    gears_rules: ['视觉焦点包含步骤标注和要点字幕', '分段提示课堂节奏'],
    quality_rules: ['必须有学习目标', '必须有步骤', '必须有复盘或练习'],
    repair_guidance: ['增加学习目标', '拆分步骤', '补充练习或复盘'],
    dramatic_structure: {
      video_type: 'education_training',
      label: '教育/培训片',
      min_scenes: 5,
      max_scenes: 8,
      scene_templates: [
        { position: 0, function_label: '学习目标', function_description: '明确学习目标', content_guide: '明确告诉观众学完能掌握什么，目标要具体。' },
        { position: 1, function_label: '知识讲授', function_description: '核心知识讲解', content_guide: '结构化讲解核心知识，每个知识点配一个例子或图示。' },
        { position: 2, function_label: '示范演示', function_description: '操作/流程示范', content_guide: '如果涉及操作，做完整示范，要有步骤标注。' },
        { position: 3, function_label: '练习引导', function_description: '练习/思考题', content_guide: '给出练习或思考题，让观众主动参与。' },
        { position: 4, function_label: '检验反馈', function_description: '知识检验', content_guide: '用问答或场景测试验证理解。' },
        { position: 5, function_label: '总结拓展', function_description: '知识总结+延伸学习', content_guide: '总结要点并提供延伸学习方向。' },
      ],
    },
  },
  scene_short: {
    video_type: 'scene_short',
    label: '场景短片',
    narrative_promise: '以空间为主角，用视觉路线、时间层和氛围带观众进入地点。',
    default_story_structures: ['object_clue_journey', 'single_event_drama'],
    compatible_presentation_styles: ['cinematic', 'documentary', 'ink_style'],
    text_shape: '空间导览式叙事，地点、路线、氛围和历史回声清楚。',
    framework: ['空间建立', '视觉移动', '历史层显影', '人物或物件经过', '氛围收束'],
    must_include: ['明确视觉路线', '空间身份', '时间层', '氛围关键词'],
    avoid: ['把地点写成人物传记', '路线不清', '只有景色形容没有行动'],
    required_fields: ['spatial_identity', 'visual_route', 'time_layer', 'atmosphere'],
    scene_rules: ['每场都要推进空间路线', '空间必须承载时间记忆或人物痕迹'],
    gears_rules: ['视觉焦点包含空间节点', '分段提示镜头路线'],
    quality_rules: ['必须有空间身份', '必须有视觉路线', '必须有氛围结尾'],
    repair_guidance: ['补充空间路线', '减少人物生平介绍', '增加时间层和氛围'],
    dramatic_structure: {
      video_type: 'scene_short',
      label: '场景短片',
      min_scenes: 3,
      max_scenes: 5,
      scene_templates: [
        { position: 0, function_label: '空间引入', function_description: '空间氛围建立', content_guide: '用光线、声音、气味、质感让观众走进空间。' },
        { position: 1, function_label: '场景叙事', function_description: '空间中发生的故事', content_guide: '写空间中曾经或正在发生的事，简短但具体。' },
        { position: 2, function_label: '时空叠印', function_description: '古今叠加/时间深度', content_guide: '同一个空间在不同时间的故事，用古今叠影展现时间深度。' },
        { position: 3, function_label: '意境收束', function_description: '氛围定格收束', content_guide: '收束在空间精神，一个画面加一句旁白即可。' },
      ],
    },
  },
  landscape_mood: {
    video_type: 'landscape_mood',
    label: '山水意境片',
    narrative_promise: '用山水、季节、声音、光影和低密度旁白形成诗性留白。',
    default_story_structures: ['object_clue_journey'],
    compatible_presentation_styles: ['ink_style', 'cinematic', 'voiceover_montage'],
    text_shape: '低密度、重感官、重留白，不以剧情为中心。',
    framework: ['自然开场', '山水流动', '人文痕迹', '情绪停驻', '留白收束'],
    must_include: ['山水意象', '光影/季节/天气', '低密度旁白', '留白感'],
    avoid: ['过度剧情化', '宣传口号', '密集知识点破坏意境'],
    required_fields: ['spatial_identity', 'visual_route', 'time_layer', 'atmosphere'],
    scene_rules: ['减少信息密度', '每场突出一种感官或光影状态'],
    gears_rules: ['视觉焦点包含自然元素和留白画面', '分段提示慢节奏镜头'],
    quality_rules: ['必须有自然意象', '必须有光影季节', '旁白不可过密'],
    repair_guidance: ['减少知识解释', '增加声音和光影', '把口号改成诗性旁白'],
    dramatic_structure: {
      video_type: 'landscape_mood',
      label: '山水意境片',
      min_scenes: 3,
      max_scenes: 4,
      scene_templates: [
        { position: 0, function_label: '山水开卷', function_description: '自然山水开场', content_guide: '纯自然山水开场，画面要美，节奏要慢。' },
        { position: 1, function_label: '意境流变', function_description: '季节/天气/光影变化', content_guide: '晨昏、四季、风雨、晴雾等状态流变。' },
        { position: 2, function_label: '灵韵定格', function_description: '山水精神的凝练表达', content_guide: '一句话或一首诗定格，画面要有留白。' },
      ],
    },
  },
};

const SAMPLE_GUIDANCE: Record<VideoType, GenreSampleGuidance> = {
  character_story: {
    reference_samples: ['人物传记短片', '人物微纪录访谈段落', '单事件人物剧情短片'],
    opening_moves: ['从人物面临选择的一刻开场', '用一个动作或一句话暴露人物压力'],
    middle_moves: ['让外部阻力逐场加码', '用配角反应映出主角立场'],
    ending_moves: ['用选择后的代价收束', '留下人物精神被他人看见的余味'],
    visual_moves: ['特写手部、眼神、随身物', '用同一地点前后变化表现人物弧线'],
    script_moves: ['旁白少讲评价，多写行动', '关键句必须来自人物处境，不写空泛赞美'],
    quality_signals: ['人物目标清楚', '阻力具体', '选择有代价', '结尾有人物变化'],
  },
  historical_drama: {
    reference_samples: ['历史事件剧情短片', '历史现场再现段落', '史料驱动的事件短片'],
    opening_moves: ['从时代压力或危机现场切入', '用制度、案卷、战报等物件建立历史锚点'],
    middle_moves: ['因果链要一环扣一环', '人物行动必须受时代规则限制'],
    ending_moves: ['回到事件后果与历史余响', '交代创作补足和史实边界'],
    visual_moves: ['服饰、器物、称谓要服务时代质感', '用空间调度体现权力关系'],
    script_moves: ['对白可戏剧化，但不能伪装成史料原文', '旁白标清可考信息与合理补足'],
    quality_signals: ['时代压力可见', '事件因果清楚', '史实边界明确', '人物不是背景板'],
  },
  legend_story: {
    reference_samples: ['民间传说动画短片', '水墨神话故事片段', '口述传说改编短片'],
    opening_moves: ['从异象、禁忌或古老传闻开场', '先建立传说氛围再引出人物'],
    middle_moves: ['神异元素推动人的考验', '用重复意象强化宿命感'],
    ending_moves: ['落到传说为何流传', '用地名、习俗或物件承接现实'],
    visual_moves: ['云、影、水、火、古树等象征意象贯穿', '水墨或剪影式画面保留神秘感'],
    script_moves: ['保持“相传”“民间说法”等边界', '减少现代解释腔，让故事自己显义'],
    quality_signals: ['神异意象服务选择', '凡人考验成立', '传说边界清楚', '结尾有流传理由'],
  },
  ai_comic_drama: {
    reference_samples: ['竖屏动态漫画短剧', '分镜漫画剧情号', '强对白短篇漫剧'],
    opening_moves: ['第一格就给冲突定格', '用大字旁白或角色表情制造追看问题'],
    middle_moves: ['对白短、来回快，每场都有表情变化', '用反应格放大误会、震惊或觉醒'],
    ending_moves: ['以反转、选择或危险问题结尾', '最后一格留出下一集承接'],
    visual_moves: ['近景表情、动作线、分屏、定格金句', '每场都能拆成 3-6 个漫画画面'],
    script_moves: ['对白优先，旁白只补情绪和转场', '每句台词都短到适合气泡框'],
    quality_signals: ['开场有强画面', '对白密度高', '表情动作明确', '结尾钩子强'],
  },
  children_story: {
    reference_samples: ['儿童绘本动画', '少儿寓言故事短片', '面向儿童的传统故事动画'],
    opening_moves: ['从孩子能理解的小问题开场', '先给可爱的主人公和清楚愿望'],
    middle_moves: ['每场只解决一个小困难', '用重复句式帮助儿童跟上因果'],
    ending_moves: ['问题解决后给温暖反馈', '用一句简单道理收束'],
    visual_moves: ['明亮色彩、明确动作、少量角色', '危险场面转为温和表达'],
    script_moves: ['短句、简单词、少典故', '价值表达要通过帮助、分享、勇敢等行动'],
    quality_signals: ['语言简单', '冲突温和', '因果清楚', '结尾正向'],
  },
  culture_promo: {
    reference_samples: ['文化主题形象片', '博物馆展陈宣传片', '节庆文化推广短片'],
    opening_moves: ['用最强文化符号开场', '先让观众看见质感，再讲意义'],
    middle_moves: ['文化根基、代表过程、当代延续三段递进', '用人和物连接传统与今天'],
    ending_moves: ['落到一句可传播关键句', '画面定格在符号、人群或仪式上'],
    visual_moves: ['宏观氛围与细节特写交替', '颜色、纹样、器物形成统一识别'],
    script_moves: ['旁白有节奏，不做百科列表', '核心主张要凝练可复述'],
    quality_signals: ['符号鲜明', '主张清楚', '当代连接自然', '结尾有记忆句'],
  },
  heritage_promo: {
    reference_samples: ['非遗代表作视频', '传统工艺微纪录', '匠人流程宣传片'],
    opening_moves: ['从材料、工具或手部动作开场', '用声音和质感立刻进入工艺现场'],
    middle_moves: ['流程按关键步骤推进', '匠人情感从动作和等待中出现'],
    ending_moves: ['从成品回到传承人和下一代', '呈现传承困境与希望'],
    visual_moves: ['微距手部、材料纹理、工具运动', '原料到成品的前后对照'],
    script_moves: ['每个步骤要有动词', '少喊匠心，多写技艺如何发生'],
    quality_signals: ['流程完整', '材料工具清楚', '手部动作充足', '传承关系可见'],
  },
  city_brand_promo: {
    reference_samples: ['城市文旅形象片', '城市品牌宣传片', '旅行目的地短片'],
    opening_moves: ['从地标或城市日出/夜色建立识别', '一句话说出城市气质'],
    middle_moves: ['历史、人文、生活、产业或自然景观交替', '用一日时间线串联城市节奏'],
    ending_moves: ['回到城市品牌主张', '用人群或地标大景定格'],
    visual_moves: ['航拍、街巷、人物生活、地标特写组合', '古今空间自然转场'],
    script_moves: ['少写泛化形容词，多写地方名词', '品牌句要有地域辨识度'],
    quality_signals: ['地标清楚', '生活气息充足', '古今连接自然', '品牌句有地方感'],
  },
  social_short: {
    reference_samples: ['竖屏知识短视频', '社交平台文化短片', '快节奏文旅短内容'],
    opening_moves: ['3 秒内抛出反差、问题或极强画面', '第一句就是字幕标题'],
    middle_moves: ['一场一个信息点，快速换画面', '用数字、对比、动作保持节奏'],
    ending_moves: ['用金句、互动问题或反差回扣收束', '结尾画面要适合停留和转发'],
    visual_moves: ['竖屏构图、字幕占位、快切、近景细节', '每个画面只保留一个视觉重点'],
    script_moves: ['短句化、口语化、强节拍', '减少铺垫，先给结论再解释'],
    quality_signals: ['前 3 秒有钩子', '信息点集中', '字幕感强', '结尾可记住'],
  },
  documentary_short: {
    reference_samples: ['微纪录片', '现实现场加历史回望短片', '人物/地点观察式短纪录'],
    opening_moves: ['从现实地点、实物或声音进入', '用一个当下问题引出历史回望'],
    middle_moves: ['现场、史料、人物讲述交替', '事实叙述和再现画面分清边界'],
    ending_moves: ['回到今天还能看见的痕迹', '用现实意义而非口号收束'],
    visual_moves: ['实景、物件、文献、手部翻阅、环境声', '再现画面要有边界提示'],
    script_moves: ['旁白客观但有线索', '引用和来源提示要服务可信度'],
    quality_signals: ['现实现场明确', '来源提示存在', '边界清楚', '当代意义自然'],
  },
  explainer_video: {
    reference_samples: ['博物馆知识讲解视频', '动画知识讲解短片', '主持人知识栏目'],
    opening_moves: ['用一个观众会问的问题开场', '先制造认知缺口再给框架'],
    middle_moves: ['概念、步骤、例子、误区逐层展开', '用图示和类比降低理解成本'],
    ending_moves: ['总结 3 个要点', '留下一个延伸问题或应用场景'],
    visual_moves: ['关键词卡片、流程图、对比图、局部放大', '主持人与图文信息交替'],
    script_moves: ['每段先说结论再解释', '避免知识点堆叠，保持层级编号'],
    quality_signals: ['核心问题明确', '层级清楚', '例子有效', '总结可复盘'],
  },
  lecture_video: {
    reference_samples: ['主题宣讲片', '人物精神讲述短片', '案例支撑式演讲视频'],
    opening_moves: ['用案例引出主题观点', '先给现实问题再进入历史事实'],
    middle_moves: ['事实、分析、价值、当下连接递进', '每个观点必须有例证'],
    ending_moves: ['用凝练号召或价值回扣收束', '让观众知道今天能怎么理解'],
    visual_moves: ['讲述者、案例画面、金句字幕、资料画面交替', '节奏稳重但不能静止'],
    script_moves: ['观点明确，语气有力量但不过火', '减少空泛表达，增加案例支撑'],
    quality_signals: ['中心观点明确', '论据充分', '现实连接清楚', '结尾有力量'],
  },
  education_training: {
    reference_samples: ['课堂教学视频', '步骤示范培训片', '课程模块化讲解视频'],
    opening_moves: ['先说明学完能掌握什么', '用一个练习或任务建立学习目标'],
    middle_moves: ['模块、步骤、示范、练习、反馈逐步推进', '每个环节都有可复盘要点'],
    ending_moves: ['用清单复盘', '给出下一步练习或延伸任务'],
    visual_moves: ['标题卡、步骤编号、示范画面、检查表', '复杂流程拆成可暂停画面'],
    script_moves: ['教学语言直接清楚', '每段都对应一个学习动作'],
    quality_signals: ['学习目标具体', '步骤完整', '练习存在', '复盘清楚'],
  },
  scene_short: {
    reference_samples: ['地点导览短片', '空间氛围短片', '物件线索带路的场景片'],
    opening_moves: ['用光线、声音或入口带观众进入空间', '先确定空间身份和观看路线'],
    middle_moves: ['沿路线移动，每到一处揭示一层时间记忆', '用人物经过或物件触发故事'],
    ending_moves: ['把路线停在最有意味的空间节点', '用氛围而不是口号收束'],
    visual_moves: ['入口、路径、转角、局部纹理、远景回望', '空间移动要清楚可拍'],
    script_moves: ['旁白像带路，不像人物传记', '每句都服务空间感和时间层'],
    quality_signals: ['空间身份明确', '视觉路线完整', '时间层存在', '氛围收束'],
  },
  landscape_mood: {
    reference_samples: ['山水意境短片', '自然风光诗性短片', '水墨风景片段'],
    opening_moves: ['从山、水、雾、风、光影的慢镜头开场', '用低密度旁白留出呼吸'],
    middle_moves: ['季节、天气、光线或声音缓慢流变', '人文痕迹只作为轻触点'],
    ending_moves: ['以留白画面和一句诗性旁白定格', '让情绪停住，不急于解释'],
    visual_moves: ['长镜头、空镜、雾气、倒影、慢推慢移', '自然元素占主导'],
    script_moves: ['句子短、信息少、重声音和光影', '避免密集知识讲解和口号'],
    quality_signals: ['自然意象突出', '光影季节明确', '旁白低密度', '留白感成立'],
  },
};

const DRAMATIC_PATTERNS: NarrativePatternId[] = [
  'mortal_growth',
  'historical_causal_story',
  'hero_choice',
  'mystery_reveal',
  'ensemble_threads',
  'object_clue_journey',
  'character_arc_adaptation',
  'theme_preserving_adaptation',
  'worldbuilding_grounding',
];

const ADAPTATION_PATTERNS: NarrativePatternId[] = [
  'novel_scene_compression',
  'character_arc_adaptation',
  'serial_hook_adaptation',
  'cinematic_setpiece_adaptation',
  'theme_preserving_adaptation',
  'source_fidelity_adaptation',
  'chapter_slice_adaptation',
  'dialogue_scene_adaptation',
  'worldbuilding_grounding',
];

const PROMO_PATTERNS: NarrativePatternId[] = [
  'object_clue_journey',
  'craft_mastery',
  'ritual_process',
  'brand_symbol',
  'city_day_journey',
  'social_hook_contrast',
  'space_walkthrough',
  'poetic_landscape',
];

const DOCUMENTARY_PATTERNS: NarrativePatternId[] = [
  'documentary_investigation',
  'historical_causal_story',
  'object_clue_journey',
  'mystery_reveal',
  'space_walkthrough',
  'lecture_case_argument',
];

const EDUCATION_PATTERNS: NarrativePatternId[] = [
  'knowledge_gap_explainer',
  'lecture_case_argument',
  'training_loop',
  'historical_causal_story',
  'object_clue_journey',
  'children_fable',
];

const AI_COMIC_PATTERNS: NarrativePatternId[] = [
  'platform_short_drama_hook',
  'mortal_growth',
  'infinite_mission',
  'hero_choice',
  'mystery_reveal',
  'ensemble_threads',
  'character_arc_adaptation',
  'serial_hook_adaptation',
  'dialogue_scene_adaptation',
  'cinematic_setpiece_adaptation',
  'worldbuilding_grounding',
  'wuxia_chivalric_epic',
  'wuxia_lone_blade_mystery',
  'wuxia_sect_growth',
  'wuxia_revenge_journey',
  'wuxia_court_jianghu',
  'wuxia_romance_honor',
];

const SPACE_PATTERNS: NarrativePatternId[] = [
  'space_walkthrough',
  'object_clue_journey',
  'poetic_landscape',
  'city_day_journey',
  'brand_symbol',
  'documentary_investigation',
];

const STRICT_FACT_FORBIDDEN_PATTERNS: NarrativePatternId[] = [
  'platform_short_drama_hook',
  'infinite_mission',
  'wuxia_chivalric_epic',
  'wuxia_lone_blade_mystery',
  'wuxia_sect_growth',
  'wuxia_revenge_journey',
  'wuxia_court_jianghu',
  'wuxia_romance_honor',
];

function matrix(
  fields: Omit<GenreStoryMatrixFields, 'allowed_narrative_patterns' | 'forbidden_narrative_patterns'> &
    Partial<Pick<GenreStoryMatrixFields, 'allowed_narrative_patterns' | 'forbidden_narrative_patterns'>>,
): GenreStoryMatrixFields {
  return {
    ...fields,
    allowed_narrative_patterns: fields.allowed_narrative_patterns ?? [],
    forbidden_narrative_patterns: fields.forbidden_narrative_patterns ?? [],
  };
}

const GENRE_MATRIX_DEFAULTS: Record<VideoType, GenreStoryMatrixFields> = {
  character_story: matrix({
    compatible_use_cases: ['original_ai_comic', 'adapted_ai_comic', 'documentary_short', 'institutional_promo', 'education_training', 'public_service'],
    compatible_truth_modes: ['inspired_by_material', 'factual_reconstruction', 'source_adaptation', 'institutional_verified', 'fictional_original'],
    default_truth_mode: 'inspired_by_material',
    recommended_narrative_patterns: ['mortal_growth', 'hero_choice', 'character_arc_adaptation'],
    allowed_narrative_patterns: uniquePatternIds([...DRAMATIC_PATTERNS, ...ADAPTATION_PATTERNS, ...DOCUMENTARY_PATTERNS]),
    material_requirements: ['主角原型或条目事实', '中心事件或关键选择压力', '可视化的地点、随身物或行动线索'],
    truth_rules: ['真实人物事迹需要保留可考边界，合理补写的动作和对白不得伪装成史料原文。'],
    institutional_rules: ['机构或公益项目中，荣誉、头衔、数据和评价必须来自已确认素材。'],
    adaptation_rules: ['改编已有文本时，优先保留主角目标、人物关系、关键选择和主题落点。'],
  }),
  historical_drama: matrix({
    compatible_use_cases: ['adapted_ai_comic', 'documentary_short', 'institutional_promo', 'education_training', 'public_service'],
    compatible_truth_modes: ['factual_reconstruction', 'inspired_by_material', 'source_adaptation', 'institutional_verified'],
    default_truth_mode: 'factual_reconstruction',
    recommended_narrative_patterns: ['historical_causal_story', 'hero_choice', 'mystery_reveal'],
    allowed_narrative_patterns: uniquePatternIds([...DRAMATIC_PATTERNS, ...DOCUMENTARY_PATTERNS, ...ADAPTATION_PATTERNS]),
    forbidden_narrative_patterns: ['infinite_mission'],
    material_requirements: ['时代和事件锚点', '人物身份与制度压力', '可标注边界的再现空间'],
    truth_rules: ['历史剧情可以影视化补足场面，但事件因果、人物身份和时代边界必须可解释。'],
    institutional_rules: ['机构项目中避免把传说、逸闻或艺术处理写成确证历史。'],
    adaptation_rules: ['历史改编需要保留原作主线，同时补足服饰、称谓、器物和时代边界。'],
  }),
  legend_story: matrix({
    compatible_use_cases: ['original_ai_comic', 'adapted_ai_comic', 'brand_commercial', 'education_training', 'public_service'],
    compatible_truth_modes: ['fictional_original', 'inspired_by_material', 'source_adaptation'],
    default_truth_mode: 'inspired_by_material',
    recommended_narrative_patterns: ['folk_legend_trial', 'object_clue_journey', 'children_fable'],
    allowed_narrative_patterns: ['folk_legend_trial', 'object_clue_journey', 'children_fable', 'mystery_reveal', 'poetic_landscape', 'theme_preserving_adaptation', 'worldbuilding_grounding'],
    forbidden_narrative_patterns: ['documentary_investigation', 'source_fidelity_adaptation'],
    material_requirements: ['传说版本或民间说法来源', '核心神异意象', '现实地名、习俗或物件承接'],
    truth_rules: ['传说、神异和民间说法不得写成确定史实，需要用“相传/民间说法”等边界表达。'],
    institutional_rules: ['机构项目中应把传说作为文化资源或地方记忆，不作为政绩、事实证据或历史定论。'],
    adaptation_rules: ['改编传说时保留核心禁忌、考验、象征意象和流传理由。'],
  }),
  culture_promo: matrix({
    compatible_use_cases: ['institutional_promo', 'brand_commercial', 'documentary_short', 'education_training', 'public_service'],
    compatible_truth_modes: ['institutional_verified', 'inspired_by_material', 'factual_reconstruction'],
    default_truth_mode: 'inspired_by_material',
    recommended_narrative_patterns: ['brand_symbol', 'object_clue_journey', 'social_hook_contrast'],
    allowed_narrative_patterns: uniquePatternIds([...PROMO_PATTERNS, ...DOCUMENTARY_PATTERNS, ...EDUCATION_PATTERNS]),
    forbidden_narrative_patterns: ['infinite_mission'],
    material_requirements: ['主视觉符号', '文化主张或传播关键词', '当代连接和受众场景'],
    truth_rules: ['文化表达可以凝练和诗化，但来源事实、地域归属和文化身份不得混淆。'],
    institutional_rules: ['甲方口径、机构名称、活动成果和政策表达必须以素材包确认为准。'],
    adaptation_rules: ['从原作改编宣传片时，只提炼可传播主题和视觉符号，不替换原作核心关系。'],
  }),
  heritage_promo: matrix({
    compatible_use_cases: ['institutional_promo', 'brand_commercial', 'documentary_short', 'education_training', 'public_service'],
    compatible_truth_modes: ['institutional_verified', 'factual_reconstruction', 'inspired_by_material'],
    default_truth_mode: 'factual_reconstruction',
    recommended_narrative_patterns: ['craft_mastery', 'ritual_process', 'object_clue_journey'],
    allowed_narrative_patterns: uniquePatternIds([...PROMO_PATTERNS, ...DOCUMENTARY_PATTERNS, ...EDUCATION_PATTERNS]),
    forbidden_narrative_patterns: ['platform_short_drama_hook', 'infinite_mission'],
    material_requirements: ['工艺步骤或仪式流程', '材料、工具、手部动作', '传承人/实践者与传承现状'],
    truth_rules: ['工艺步骤、传承谱系和非遗称谓必须清楚区分已确认事实与创作性描述。'],
    institutional_rules: ['非遗级别、代表性传承人、机构资质和获奖信息必须来自已确认素材。'],
    adaptation_rules: ['改编时保留技艺流程和传承关系，剧情化人物只能服务流程理解。'],
  }),
  city_brand_promo: matrix({
    compatible_use_cases: ['institutional_promo', 'brand_commercial', 'documentary_short', 'education_training', 'public_service'],
    compatible_truth_modes: ['institutional_verified', 'inspired_by_material', 'factual_reconstruction'],
    default_truth_mode: 'inspired_by_material',
    recommended_narrative_patterns: ['city_day_journey', 'brand_symbol', 'space_walkthrough'],
    allowed_narrative_patterns: uniquePatternIds([...PROMO_PATTERNS, ...SPACE_PATTERNS, ...DOCUMENTARY_PATTERNS]),
    forbidden_narrative_patterns: ['infinite_mission'],
    material_requirements: ['城市地标或空间路线', '地方文化识别点', '品牌主张和目标受众'],
    truth_rules: ['城市故事可以用一日路线或象征串联，但地名、历史归属和现实业态不能错置。'],
    institutional_rules: ['城市品牌口号、重点产业、活动名称和公共数据必须按甲方素材执行。'],
    adaptation_rules: ['若从原作改编城市宣传内容，原作事件只能作为城市气质的入口，不能强行改地点。'],
  }),
  scene_short: matrix({
    compatible_use_cases: ['institutional_promo', 'brand_commercial', 'documentary_short', 'education_training', 'public_service', 'original_ai_comic'],
    compatible_truth_modes: ['inspired_by_material', 'factual_reconstruction', 'institutional_verified', 'fictional_original'],
    default_truth_mode: 'inspired_by_material',
    recommended_narrative_patterns: ['space_walkthrough', 'object_clue_journey', 'poetic_landscape'],
    allowed_narrative_patterns: uniquePatternIds([...SPACE_PATTERNS, ...PROMO_PATTERNS, ...DOCUMENTARY_PATTERNS]),
    material_requirements: ['空间身份', '观看路线或移动顺序', '空间中的时间层、物件或人物痕迹'],
    truth_rules: ['空间气氛可以诗化，但真实地点、功能和历史层需要与素材一致。'],
    institutional_rules: ['展陈、景区、城市空间项目中，开放状态、展项名称和空间功能不得臆造。'],
    adaptation_rules: ['改编成场景短片时，把原作关系压缩为空间中的物件、声音和行动痕迹。'],
  }),
  landscape_mood: matrix({
    compatible_use_cases: ['institutional_promo', 'brand_commercial', 'documentary_short', 'public_service'],
    compatible_truth_modes: ['inspired_by_material', 'factual_reconstruction', 'institutional_verified'],
    default_truth_mode: 'inspired_by_material',
    recommended_narrative_patterns: ['poetic_landscape', 'space_walkthrough', 'object_clue_journey'],
    allowed_narrative_patterns: uniquePatternIds([...SPACE_PATTERNS, 'ritual_process']),
    forbidden_narrative_patterns: ['platform_short_drama_hook', 'infinite_mission', 'training_loop'],
    material_requirements: ['山水/季节/天气意象', '地点或地域气质', '低密度旁白和留白目标'],
    truth_rules: ['诗性表达不得替代基本地点事实；自然、人文和季节信息必须避免硬凑。'],
    institutional_rules: ['文旅项目中避免承诺式、功效式或未经核实的资源表述。'],
    adaptation_rules: ['改编时保留原作情绪和意象，不强行加入复杂剧情冲突。'],
  }),
  documentary_short: matrix({
    compatible_use_cases: ['documentary_short', 'institutional_promo', 'education_training', 'public_service'],
    compatible_truth_modes: ['factual_reconstruction', 'institutional_verified', 'inspired_by_material'],
    default_truth_mode: 'factual_reconstruction',
    recommended_narrative_patterns: ['documentary_investigation', 'object_clue_journey', 'historical_causal_story'],
    allowed_narrative_patterns: uniquePatternIds([...DOCUMENTARY_PATTERNS, ...EDUCATION_PATTERNS, 'city_day_journey']),
    forbidden_narrative_patterns: STRICT_FACT_FORBIDDEN_PATTERNS,
    material_requirements: ['现实现场或实物', '来源提示或可核验事实', '再现内容边界'],
    truth_rules: ['纪录片口径中，再现、推测、传说和未核实说法必须显式标边界。'],
    institutional_rules: ['机构纪录短片中的身份、成果、口号和数据必须使用已核验素材。'],
    adaptation_rules: ['改编已有素材时，原作可作为访问线索或叙述素材，不得改写成未经证实的事实。'],
  }),
  explainer_video: matrix({
    compatible_use_cases: ['education_training', 'institutional_promo', 'documentary_short', 'public_service'],
    compatible_truth_modes: ['factual_reconstruction', 'institutional_verified', 'inspired_by_material'],
    default_truth_mode: 'factual_reconstruction',
    recommended_narrative_patterns: ['knowledge_gap_explainer', 'lecture_case_argument', 'object_clue_journey'],
    allowed_narrative_patterns: uniquePatternIds([...EDUCATION_PATTERNS, ...DOCUMENTARY_PATTERNS, ...PROMO_PATTERNS]),
    forbidden_narrative_patterns: ['platform_short_drama_hook', 'infinite_mission'],
    material_requirements: ['核心问题', '知识层级或步骤', '可视化例子、图示或类比'],
    truth_rules: ['讲解内容必须区分事实、解释、类比和观点，不能把类比写成史实。'],
    institutional_rules: ['课程、科普或政务讲解中的定义、政策和数据必须按确认素材执行。'],
    adaptation_rules: ['改编文本为讲解视频时，保留原作论点，把情节转成案例或问题。'],
  }),
  lecture_video: matrix({
    compatible_use_cases: ['institutional_promo', 'education_training', 'public_service', 'documentary_short'],
    compatible_truth_modes: ['institutional_verified', 'factual_reconstruction', 'inspired_by_material'],
    default_truth_mode: 'institutional_verified',
    recommended_narrative_patterns: ['lecture_case_argument', 'historical_causal_story', 'hero_choice'],
    allowed_narrative_patterns: uniquePatternIds([...EDUCATION_PATTERNS, ...DOCUMENTARY_PATTERNS, ...DRAMATIC_PATTERNS]),
    forbidden_narrative_patterns: ['infinite_mission'],
    material_requirements: ['中心观点', '事实案例或人物选择', '现实连接与行动号召'],
    truth_rules: ['宣讲片可以有立场，但观点必须由案例和事实支撑，不得替代事实核验。'],
    institutional_rules: ['价值表述、政策口径、机构立场和行动号召必须与甲方确认口径一致。'],
    adaptation_rules: ['改编时把原作冲突转成论据链条，保留核心主题而非照搬情节密度。'],
  }),
  education_training: matrix({
    compatible_use_cases: ['education_training', 'institutional_promo', 'public_service'],
    compatible_truth_modes: ['institutional_verified', 'factual_reconstruction'],
    default_truth_mode: 'institutional_verified',
    recommended_narrative_patterns: ['training_loop', 'knowledge_gap_explainer', 'lecture_case_argument'],
    allowed_narrative_patterns: EDUCATION_PATTERNS,
    forbidden_narrative_patterns: ['platform_short_drama_hook', 'infinite_mission', 'wuxia_chivalric_epic', 'wuxia_revenge_journey'],
    material_requirements: ['学习目标', '分层知识大纲', '练习、示范或复盘机制'],
    truth_rules: ['培训内容必须以可核验知识、步骤或制度口径为准，不用剧情爽点替代学习路径。'],
    institutional_rules: ['机构培训中的制度流程、岗位职责、考核项和安全要求必须准确。'],
    adaptation_rules: ['改编原作时只抽取可教学的案例、选择和复盘点，不保留无关支线。'],
  }),
  children_story: matrix({
    compatible_use_cases: ['original_ai_comic', 'adapted_ai_comic', 'education_training', 'public_service'],
    compatible_truth_modes: ['fictional_original', 'inspired_by_material', 'source_adaptation'],
    default_truth_mode: 'inspired_by_material',
    recommended_narrative_patterns: ['children_fable', 'folk_legend_trial', 'object_clue_journey'],
    allowed_narrative_patterns: ['children_fable', 'folk_legend_trial', 'object_clue_journey', 'mortal_growth', 'hero_choice', 'poetic_landscape', 'theme_preserving_adaptation'],
    forbidden_narrative_patterns: ['power_strategy', 'wuxia_revenge_journey', 'documentary_investigation'],
    material_requirements: ['儿童可理解的主人公目标', '单一清楚的问题', '正向价值和安全情绪'],
    truth_rules: ['面向儿童的改写可以寓言化，但不得把复杂或存疑史实包装成简单定论。'],
    institutional_rules: ['公益或教育项目中，价值表达要通过行动呈现，避免成人化口号。'],
    adaptation_rules: ['改编给儿童时，保留原作温度和主题，简化冲突、称谓和典故。'],
  }),
  social_short: matrix({
    compatible_use_cases: ['institutional_promo', 'brand_commercial', 'documentary_short', 'education_training', 'public_service', 'original_ai_comic'],
    compatible_truth_modes: ['inspired_by_material', 'institutional_verified', 'factual_reconstruction', 'fictional_original'],
    default_truth_mode: 'inspired_by_material',
    recommended_narrative_patterns: ['social_hook_contrast', 'brand_symbol', 'mystery_reveal'],
    allowed_narrative_patterns: uniquePatternIds([...PROMO_PATTERNS, ...DOCUMENTARY_PATTERNS, ...EDUCATION_PATTERNS, ...DRAMATIC_PATTERNS, 'platform_short_drama_hook']),
    material_requirements: ['前三秒钩子', '单一传播记忆点', '字幕化短句和可视化素材'],
    truth_rules: ['短视频可以强钩子，但不能用标题党扭曲事实、地域、人物身份或机构口径。'],
    institutional_rules: ['机构短视频中不得夸大成果、制造未经核实的对比或伪造群众反应。'],
    adaptation_rules: ['改编时优先抽取最强冲突或反差点，保留原作基本因果。'],
  }),
  ai_comic_drama: matrix({
    compatible_use_cases: ['original_ai_comic', 'adapted_ai_comic', 'brand_commercial', 'public_service'],
    compatible_truth_modes: ['fictional_original', 'source_adaptation', 'inspired_by_material'],
    default_truth_mode: 'fictional_original',
    recommended_narrative_patterns: ['platform_short_drama_hook', 'mortal_growth', 'character_arc_adaptation'],
    allowed_narrative_patterns: uniquePatternIds([...AI_COMIC_PATTERNS, ...ADAPTATION_PATTERNS]),
    forbidden_narrative_patterns: ['documentary_investigation', 'training_loop', 'lecture_case_argument'],
    material_requirements: ['主角困境和目标', '对白/表情/分镜动作', '结尾追看钩子或反转'],
    truth_rules: ['AI 漫剧可强戏剧化，但若来自真实人物或机构素材，不能伪造可核验事实和发言。'],
    institutional_rules: ['公益或品牌漫剧中，品牌/机构只能作为确认素材中的角色、场景或价值背景。'],
    adaptation_rules: ['改编原作时必须保留主角关系、关键冲突和情绪底色，压缩为可分镜场面。'],
  }),
};

export const GENRE_STORY_PROFILES = Object.fromEntries(
  Object.entries(PROFILES).map(([videoType, profile]) => [
    videoType,
    {
      ...profile,
      ...GENRE_MATRIX_DEFAULTS[videoType as VideoType],
    },
  ]),
) as Record<VideoType, GenreStoryProfile>;

export function getGenreStoryProfile(videoType: VideoType): GenreStoryProfile {
  return GENRE_STORY_PROFILES[videoType] ?? GENRE_STORY_PROFILES.character_story;
}

export function getGenreDramaticStructure(videoType: VideoType): GenreDramaticStructure {
  return getGenreStoryProfile(videoType).dramatic_structure;
}

export function getGenreSampleGuidance(videoType: VideoType): GenreSampleGuidance {
  return SAMPLE_GUIDANCE[videoType] ?? SAMPLE_GUIDANCE.character_story;
}

export function getGenreReturnJsonFields(videoType: VideoType): string[] {
  return [
    'title',
    'logline',
    'theme',
    'full_text',
    'scene_breakdown',
    'cultural_constraints',
    'credibility_note',
    ...getGenreStoryProfile(videoType).required_fields,
  ];
}

export function resolveGenreStoryMatrix(input: {
  videoType: VideoType;
  creationUseCase: CreationUseCase;
  truthMode?: TruthMode;
  storyStructure?: StoryStructureType;
  narrativePatternIds?: NarrativePatternId[];
}): GenreStoryMatrixResolution {
  const profile = getGenreStoryProfile(input.videoType);
  const truthMode = input.truthMode ?? profile.default_truth_mode;
  const requestedPatterns = uniquePatternIds(input.narrativePatternIds ?? []);
  const recommendedPatterns = profile.recommended_narrative_patterns;
  const allowedPatternSet = new Set(profile.allowed_narrative_patterns);
  const forbiddenPatternSet = new Set(profile.forbidden_narrative_patterns);
  const rejectedPatterns = requestedPatterns.filter(patternId =>
    forbiddenPatternSet.has(patternId) || (allowedPatternSet.size > 0 && !allowedPatternSet.has(patternId)),
  );
  const candidatePatterns = uniquePatternIds([
    ...requestedPatterns,
    ...recommendedPatterns,
  ]);
  const resolvedPatterns = candidatePatterns
    .filter(patternId => !forbiddenPatternSet.has(patternId))
    .filter(patternId => allowedPatternSet.size === 0 || allowedPatternSet.has(patternId))
    .slice(0, 6);
  const compatibleUseCase = profile.compatible_use_cases.includes(input.creationUseCase);
  const compatibleTruthMode = profile.compatible_truth_modes.includes(truthMode);
  const warnings = [
    compatibleUseCase ? '' : `创作用途 ${input.creationUseCase} 不是 ${profile.label} 的优先用途，需人工确认定位。`,
    compatibleTruthMode ? '' : `真实度模式 ${truthMode} 与 ${profile.label} 常规边界不匹配，需提高免责声明和核验要求。`,
    rejectedPatterns.length ? `已过滤不适合该类型/真实度边界的叙事流派：${rejectedPatterns.join('、')}` : '',
  ].filter(Boolean);

  return {
    video_type: input.videoType,
    creation_use_case: input.creationUseCase,
    truth_mode: truthMode,
    default_truth_mode: profile.default_truth_mode,
    compatible_use_case: compatibleUseCase,
    compatible_truth_mode: compatibleTruthMode,
    recommended_narrative_patterns: recommendedPatterns,
    allowed_narrative_patterns: profile.allowed_narrative_patterns,
    forbidden_narrative_patterns: profile.forbidden_narrative_patterns,
    rejected_narrative_pattern_ids: rejectedPatterns,
    resolved_narrative_pattern_ids: resolvedPatterns,
    material_requirements: profile.material_requirements,
    truth_rules: profile.truth_rules,
    institutional_rules: profile.institutional_rules,
    adaptation_rules: profile.adaptation_rules,
    requirement_lines: buildGenreMatrixRequirementLines(profile, input.creationUseCase, truthMode, input.storyStructure, resolvedPatterns),
    warnings,
  };
}

function buildGenreMatrixRequirementLines(
  profile: GenreStoryProfile,
  creationUseCase: CreationUseCase,
  truthMode: TruthMode,
  storyStructure: StoryStructureType | undefined,
  narrativePatternIds: NarrativePatternId[],
): string[] {
  return [
    `类型矩阵创作用途：${creationUseCase}`,
    `类型矩阵真实模式：${truthMode}`,
    storyStructure ? `类型矩阵叙事结构：${storyStructure}` : '',
    narrativePatternIds.length ? `类型矩阵叙事流派：${narrativePatternIds.join('、')}` : '',
    ...profile.material_requirements.map(item => `类型矩阵素材要求：${item}`),
    ...profile.truth_rules.map(item => `类型矩阵真实边界：${item}`),
    ...profile.institutional_rules.map(item => `类型矩阵机构规则：${item}`),
    ...profile.adaptation_rules.map(item => `类型矩阵改编规则：${item}`),
  ].filter(Boolean);
}

function uniquePatternIds(patternIds: NarrativePatternId[]): NarrativePatternId[] {
  return Array.from(new Set(patternIds));
}
