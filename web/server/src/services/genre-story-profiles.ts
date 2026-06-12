// web/server/src/services/genre-story-profiles.ts
// Central profile registry for genre-aware text generation.

import type {
  PresentationStyle,
  StoryStructureType,
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

export interface GenreStoryProfile {
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

const PROFILES: Record<VideoType, GenreStoryProfile> = {
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

export const GENRE_STORY_PROFILES = PROFILES;

export function getGenreStoryProfile(videoType: VideoType): GenreStoryProfile {
  return PROFILES[videoType] ?? PROFILES.character_story;
}

export function getGenreDramaticStructure(videoType: VideoType): GenreDramaticStructure {
  return getGenreStoryProfile(videoType).dramatic_structure;
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
