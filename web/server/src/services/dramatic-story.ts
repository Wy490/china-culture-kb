// web/server/src/services/dramatic-story.ts — Dramatic story generation engine
// The CORE FIX: produces dramatic narrative stories, not biographical summaries
// Replaces the old template-concatenation buildSceneBreakdown/buildGearsSegments

import type {
  VideoType,
  PresentationStyle,
  SupportedDuration,
  PanelCount,
  EntryDetail,
  StoryScene,
  GearsSegment,
  StoryQualityReport,
  KnowledgePack,
  KnowledgePackEntry,
  StoryCharacter,
  ActBeat,
  ProtagonistArc,
} from '@shared/types.js';
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG } from '@shared/types.js';

// ---------------------------------------------------------------------------
// Conflict scoring — select the most dramatic event as the central event
// ---------------------------------------------------------------------------

const CONFLICT_BOOST_WORDS = ['拒', '争', '抗', '叛', '反', '逼', '杀', '冤', '冤案', '斩', '罚', '刑', '刑狱'];
const CHOICE_BOOST_WORDS = ['辞', '弃', '选', '决', '定', '择', '拒签', '断案', '悟道'];
const REVERSAL_BOOST_WORDS = ['变', '改', '转', '醒', '悟', '觉', '觉', '觉醒'];
const AUTHORITY_WORDS = ['官', '上官', '知军', '知府', '知县', '制度', '法', '令', '命', '旨', '诏'];
const RESULT_WORDS = ['免', '死', '胜', '败', '释', '放', '还', '退'];
const NEGATIVE_WORDS = ['生平', '一生', '事迹', '年谱', '履历']; // penalize biography-style events

export function conflictScore(eventText: string, storyText: string): number {
  let score = 0;

  // Check for conflict/confrontation words
  for (const word of CONFLICT_BOOST_WORDS) {
    if (eventText.includes(word) || storyText.includes(word)) score += 3;
  }

  // Check for choice/decision words
  for (const word of CHOICE_BOOST_WORDS) {
    if (eventText.includes(word)) score += 2;
  }

  // Check for reversal/awakening words
  for (const word of REVERSAL_BOOST_WORDS) {
    if (eventText.includes(word)) score += 2;
  }

  // Check for authority pressure words
  for (const word of AUTHORITY_WORDS) {
    if (storyText.includes(word)) score += 1;
  }

  // Check for result words
  for (const word of RESULT_WORDS) {
    if (eventText.includes(word) || storyText.includes(word)) score += 1;
  }

  // Bonus: event is a specific event (not a general description)
  if (eventText.length >= 4 && eventText.length <= 20) score += 2;

  // Bonus: event text is moderate length
  if (eventText.length >= 8 && eventText.length <= 80) score += 1;

  // Penalty: biography-style event names
  for (const word of NEGATIVE_WORDS) {
    if (eventText.includes(word)) score -= 2;
  }

  // Penalty: event starts with a person name (suggests biographical listing)
  const entryNamePrefix = eventText.split('——')[0].trim();
  if (entryNamePrefix.length <= 3 && eventText !== entryNamePrefix) score -= 1;

  return score;
}

export function selectCentralEvent(
  entry: EntryDetail,
  boldEvents: string[],
  videoType: VideoType,
  selectedEvent?: string,
): string {
  // If user explicitly selected an event, use it (unless it's "整体故事")
  if (selectedEvent && selectedEvent !== '整体故事') {
    return selectedEvent;
  }

  // If no bold events, fall back to entry name core
  if (boldEvents.length === 0) {
    return entry.name.split('——')[0].trim();
  }

  // Score each bold event and pick the highest conflict score
  let bestEvent = boldEvents[0];
  let bestScore = -Infinity;

  for (const event of boldEvents) {
    // Find the story paragraph that contains this event
    const eventParagraphs = entry.story.split(/\n\n+/).filter(
      p => p.includes(event) || p.includes(`**${event}**`)
    );
    const eventContext = eventParagraphs.length > 0 ? eventParagraphs.join(' ') : entry.story;

    const score = conflictScore(event, eventContext);
    if (score > bestScore) {
      bestScore = score;
      bestEvent = event;
    }
  }

  return bestEvent;
}

// ---------------------------------------------------------------------------
// Dramatic structure templates — per video_type
// ---------------------------------------------------------------------------

interface SceneTemplate {
  position: number;
  function_label: string;
  function_description: string;
  content_guide: string;
}

interface DramaticStructure {
  video_type: VideoType;
  label: string;
  min_scenes: number;
  max_scenes: number;
  scene_templates: SceneTemplate[];
}

const DRAMATIC_STRUCTURES: Record<string, DramaticStructure> = {
  character_story: {
    video_type: 'character_story',
    label: '人物故事',
    min_scenes: 5,
    max_scenes: 7,
    scene_templates: [
      { position: 0, function_label: '钩子开场', function_description: '直接进入危机或关键场面', content_guide: '直接进入危机/关键场面，不用介绍背景。用具体地点+时间+动作开场。开头第一句要制造紧张感或悬念。' },
      { position: 1, function_label: '主角处境', function_description: '主角身份、面对的选择、外部压力', content_guide: '交代主角身份、他为什么面对这个选择、上官/制度/世俗压力是什么。但要快速——不要写人物简介。' },
      { position: 2, function_label: '冲突升级', function_description: '对立面强化、两难加深', content_guide: '强化对立面——囚犯依法不该死但上官坚持判死；如果他拒签可能丢官获罪。冲突必须有具体的选择压力。' },
      { position: 3, function_label: '关键行动', function_description: '主角做出选择、采取行动', content_guide: '主角做出关键选择——查案卷/询问案情/与上官争辩/拒绝签字/准备辞官。行动要有画面感。' },
      { position: 4, function_label: '高潮', function_description: '核心台词/核心行动、局面反转', content_guide: '核心台词或核心行动爆发——说出关键对白、掷出文书、局面反转。这是情绪最高点。' },
      { position: 5, function_label: '结尾', function_description: '结果、精神落点、主题升华', content_guide: '结果+精神落点——囚犯免死/丢官但守住良知/后来写《爱莲说》呼应主题。结尾要落到人格或精神主题上。' },
    ],
  },
  historical_drama: {
    video_type: 'historical_drama',
    label: '历史剧情短片',
    min_scenes: 5,
    max_scenes: 7,
    scene_templates: [
      { position: 0, function_label: '时代危机', function_description: '宏观背景、局势紧迫', content_guide: '从宏观局势切入——时代危机、制度压迫、社会矛盾。不用介绍人物，先建立历史现场感。' },
      { position: 1, function_label: '人物卷入', function_description: '主角被卷入事件', content_guide: '主角被卷入——到任/接到命令/发现案件。写他如何进入事件中心，他的职责是什么。' },
      { position: 2, function_label: '冲突升级', function_description: '制度压力、权力对抗', content_guide: '强化权力对抗——上官施压、制度限制、官场规则。矛盾不只是个人层面，还有制度层面的压迫。' },
      { position: 3, function_label: '关键行动', function_description: '研究案卷/争辩/拒绝', content_guide: '主角采取行动——翻阅案卷发现疑点/与上官争辩/拒绝签字。行动要具体，有实物和动作。' },
      { position: 4, function_label: '高潮', function_description: '正面冲突爆发', content_guide: '正面冲突爆发——说出核心台词、场面反转、上官震动。冲突要有声音和动作。' },
      { position: 5, function_label: '历史余响', function_description: '事件后续影响', content_guide: '事件后续——改判/免死/历史评价。结尾要写这个事件在历史上留下什么痕迹，不只是个人结局。' },
    ],
  },
  ai_comic_drama: {
    video_type: 'ai_comic_drama',
    label: 'AI漫剧',
    min_scenes: 5,
    max_scenes: 6,
    scene_templates: [
      { position: 0, function_label: '钩子开场', function_description: '强视觉画面+悬念', content_guide: '强视觉冲击开场——用最紧张的画面定格开场，制造悬念。每个画面要有明确的构图和表情。' },
      { position: 1, function_label: '人物登场', function_description: '角色身份+初始困境', content_guide: '角色登场+困境揭示——用对白和表情标注角色身份和处境。对白要简短有力。' },
      { position: 2, function_label: '冲突爆发', function_description: '对白冲突+分镜感', content_guide: '对白冲突爆发——用密集的对白交锋推进冲突。每段2-3句对白，配合表情标注。分镜切换要快。' },
      { position: 3, function_label: '反转/觉醒', function_description: '行动反转+精神觉醒', content_guide: '反转时刻——主角做出意料之外的行动，精神觉醒。要有明显的表情变化和动作转折。' },
      { position: 4, function_label: '高燃收束', function_description: '金句+画面定格', content_guide: '金句定格收束——主角说出核心台词，画面定格。要有最强的视觉冲击力和金句感染力。' },
    ],
  },
  documentary_short: {
    video_type: 'documentary_short',
    label: '微纪录片',
    min_scenes: 5,
    max_scenes: 6,
    scene_templates: [
      { position: 0, function_label: '现实引入', function_description: '当下场景引入', content_guide: '从当下切入——现实地点、实物遗迹、今天还能看到什么。用旁白引入，要有文献感。' },
      { position: 1, function_label: '历史回望', function_description: '旁白讲述历史背景', content_guide: '历史回望——用旁白讲述时代背景和人物处境。引用史料原文或文献记载。语气客观但有叙事线。' },
      { position: 2, function_label: '关键节点', function_description: '核心事件再现', content_guide: '核心事件再现——讲述南安拒签/具体案件的具体经过。用事实叙述但要有人物行动和选择。' },
      { position: 3, function_label: '文化解释', function_description: '专家视角/史料解读', content_guide: '文化解读——从专家视角分析这个事件照见什么精神：公正、廉洁、良知、担当。引用《爱莲说》或相关文献。' },
      { position: 4, function_label: '当代意义', function_description: '精神传承与现实意义', content_guide: '当代意义——这种精神在今天如何传承。结尾要回到现实地点，表达精神不灭。' },
    ],
  },
  lecture_video: {
    video_type: 'lecture_video',
    label: '宣讲片',
    min_scenes: 5,
    max_scenes: 6,
    scene_templates: [
      { position: 0, function_label: '提出主题', function_description: '核心观点提出', content_guide: '直接提出核心主题——公正、廉洁、担当、良知。用案例引子开场：一个案件如何照见一个人的精神。' },
      { position: 1, function_label: '讲述事实', function_description: '案例故事叙述', content_guide: '讲述南安拒签案件的事实经过。重点在人物行为和关键选择，不是知识讲解。' },
      { position: 2, function_label: '分析精神', function_description: '精神内涵提炼', content_guide: '提炼精神内涵——这个选择照见了什么：不畏权势的公正、出淤泥而不染的廉洁、守正不阿的担当。' },
      { position: 3, function_label: '联系当下', function_description: '现实映射', content_guide: '联系当下——这种精神在今天如何体现、如何传承、如何在新时代继续照亮前路。' },
      { position: 4, function_label: '总结号召', function_description: '行动号召', content_guide: '总结号召——以金句或名言收束，号召传承精神、坚守正道。' },
    ],
  },
  children_story: {
    video_type: 'children_story',
    label: '儿童故事',
    min_scenes: 5,
    max_scenes: 6,
    scene_templates: [
      { position: 0, function_label: '小主人公', function_description: '少年人物出场', content_guide: '用少年视角出场——写一个年轻官员刚到新地方上任，他有好奇心和正义感。简化官场复杂性。' },
      { position: 1, function_label: '遇到问题', function_description: '简化困境', content_guide: '遇到问题——发现有一个人不该被惩罚但上面的人要惩罚他。孩子能理解的简化困境。' },
      { position: 2, function_label: '学习成长', function_description: '探索与发现', content_guide: '探索与发现——翻看案卷发现真相、询问别人了解情况、想办法帮助那个被冤枉的人。' },
      { position: 3, function_label: '做出选择', function_description: '正向抉择', content_guide: '做出正确的选择——勇敢地说"不行"，拒绝做不对的事。用简单的语言表达正义感。' },
      { position: 4, function_label: '温暖结尾', function_description: '成长收获', content_guide: '温暖的结尾——冤枉的人被救了、少年学到正义的力量、结尾要温暖正向、让孩子看到做好事的价值。' },
    ],
  },
  social_short: {
    video_type: 'social_short',
    label: '竖屏短视频',
    min_scenes: 3,
    max_scenes: 4,
    scene_templates: [
      { position: 0, function_label: '3秒钩子', function_description: '强冲击画面', content_guide: '3秒内抓住观众——最紧张的画面+最震撼的一句话。不求完整，只求冲击。' },
      { position: 1, function_label: '关键信息', function_description: '核心事实', content_guide: '5秒内讲清核心事实——谁+什么事+什么结果。简化到极致，信息密度最高。' },
      { position: 2, function_label: '情绪推进', function_description: '感情渲染', content_guide: '10秒内推进情绪——从紧张到感动，用画面节奏推情绪。旁白或音乐渲染。' },
      { position: 3, function_label: '金句落点', function_description: '定格金句', content_guide: '金句定格——最后一句是记忆点。"吾不为也"或"出淤泥而不染"。画面定格+文字。' },
    ],
  },
  legend_story: {
    video_type: 'legend_story',
    label: '神话/传说故事',
    min_scenes: 4,
    max_scenes: 6,
    scene_templates: [
      { position: 0, function_label: '远古传说', function_description: '神话/传说背景引入', content_guide: '从远古或超自然背景切入——天地异象、神力显现、传说起源。建立神话氛围，不用现代视角。' },
      { position: 1, function_label: '神力显现', function_description: '超自然力量介入', content_guide: '超自然元素显现——神力、天命、预言、异象。写凡人如何遇到超越人力的事件或力量。' },
      { position: 2, function_label: '凡人考验', function_description: '人的选择与考验', content_guide: '即使是神话，核心是人——凡人面对考验时如何选择。恐惧、犹豫、勇气、信念。要有人的情感。' },
      { position: 3, function_label: '命运转折', function_description: '命运/天意转折', content_guide: '命运转折——天意不可违但人心可以选择。写出命运与人力的交汇点。' },
      { position: 4, function_label: '传说永恒', function_description: '传说流传至今', content_guide: '传说如何流传至今——这个神话/传说为什么被世代传颂，它照见了什么精神或文化意义。' },
    ],
  },
  culture_promo: {
    video_type: 'culture_promo',
    label: '文化宣传片',
    min_scenes: 4,
    max_scenes: 5,
    scene_templates: [
      { position: 0, function_label: '符号引入', function_description: '文化符号/视觉锚点开场', content_guide: '用最具代表性的文化符号开场——建筑、器物、仪式、技艺。画面要美，氛围要浓。不讲故事，先建立视觉吸引力。' },
      { position: 1, function_label: '文化根基', function_description: '文化渊源与精神内核', content_guide: '追溯文化渊源——这种文化从何而来、为什么诞生、照见了什么精神。要有历史纵深，但不用叙事手法，用展示手法。' },
      { position: 2, function_label: '技艺展示', function_description: '核心技艺/仪式过程展示', content_guide: '展示核心技艺或仪式过程——手的动作、材料的质感、工具的声音。要有匠人的专注和手艺的美感。画面要有微距和慢动作。' },
      { position: 3, function_label: '现代传承', function_description: '当代传承与创新', content_guide: '传统如何在现代延续——新一代匠人、新的应用场景、文化在生活中的存在。要有现实温度，不是博物馆里的标本。' },
      { position: 4, function_label: '标语收束', function_description: '核心标语/品牌信息定格', content_guide: '用一句话或标语收束——不是口号，而是文化精神最凝练的表达。画面定格+文字叠加。' },
    ],
  },
  heritage_promo: {
    video_type: 'heritage_promo',
    label: '非遗/工艺宣传片',
    min_scenes: 4,
    max_scenes: 6,
    scene_templates: [
      { position: 0, function_label: '技艺渊源', function_description: '非遗项目的历史起源', content_guide: '从技艺的历史起源切入——何时诞生、何人首创、因何而生。用实物或文献引入，建立历史感。' },
      { position: 1, function_label: '匠人登场', function_description: '传承人/匠人出场', content_guide: '匠人出场——写他的身份、技艺、专注。不只是介绍，要写出他与这门技艺的情感联结。"我做了三十年"比"他是传承人"有力。' },
      { position: 2, function_label: '工艺全程', function_description: '完整工艺流程展示', content_guide: '展示完整工艺流程——从原料到成品，每一步都是匠心。要有手的动作、材料的质感、时间流逝的节奏。' },
      { position: 3, function_label: '精神内核', function_description: '技艺背后的精神与文化', content_guide: '技艺不只是技术——它照见什么精神？坚守、传承、精益求精、物我合一。用匠人自己的话或行为来表达。' },
      { position: 4, function_label: '传承之路', function_description: '传承困境与未来展望', content_guide: '传承的现实——年轻人不愿学、市场萎缩、技艺可能消亡。但也有人接过担子。结尾要有传承的希望。' },
    ],
  },
  city_brand_promo: {
    video_type: 'city_brand_promo',
    label: '城市/文旅宣传片',
    min_scenes: 4,
    max_scenes: 5,
    scene_templates: [
      { position: 0, function_label: '地标引入', function_description: '城市标志性空间开场', content_guide: '用最具标志性的地标开场——不只是建筑外观，要写空间的氛围、光影、人的活动。建立城市的空间认同感。' },
      { position: 1, function_label: '历史底蕴', function_description: '城市的历史纵深', content_guide: '这座城市有什么历史——名人、事件、文化积淀。用具体故事而非抽象概述，让历史活在今天。' },
      { position: 2, function_label: '人文风貌', function_description: '地方文化特色展示', content_guide: '展示地方文化的独特之处——方言、饮食、习俗、技艺。要有烟火气，不是空镜堆砌。' },
      { position: 3, function_label: '生活气息', function_description: '当代生活场景', content_guide: '生活在这座城市的人——他们的日常、情感、节奏。城市不只是景点，更是生活空间。要有温度。' },
      { position: 4, function_label: '品牌定格', function_description: '城市品牌形象定格', content_guide: '用一句凝练的标语或画面定格城市印象——不是口号，而是这座城市最核心的气质表达。画面定格+文字叠加。' },
    ],
  },
  scene_short: {
    video_type: 'scene_short',
    label: '场景短片',
    min_scenes: 3,
    max_scenes: 5,
    scene_templates: [
      { position: 0, function_label: '空间引入', function_description: '空间氛围建立', content_guide: '用一个空间开场——不只是地点名称，要写光线、声音、气味、质感。让观众"走进"这个空间。' },
      { position: 1, function_label: '场景叙事', function_description: '空间中发生的故事', content_guide: '在这个空间中发生了什么——人物、事件、情感。叙事要简短但要有具体内容，不是空镜。' },
      { position: 2, function_label: '时空叠印', function_description: '古今叠加/时间深度', content_guide: '同一个空间在不同时间的故事——古人与今人、旧貌与新颜。用叠影或旁白展现时间的深度。' },
      { position: 3, function_label: '意境收束', function_description: '氛围定格收束', content_guide: '收束在意境上——不是故事结局，而是空间本身的精神。一个画面+一句旁白即可。' },
    ],
  },
  landscape_mood: {
    video_type: 'landscape_mood',
    label: '山水意境片',
    min_scenes: 3,
    max_scenes: 4,
    scene_templates: [
      { position: 0, function_label: '山水开卷', function_description: '自然山水开场', content_guide: '纯自然山水开场——山、水、云、雾、光影。没有人物、没有叙事。只有自然本身的美与气息。画面要美，节奏要慢。' },
      { position: 1, function_label: '意境流变', function_description: '季节/天气/光影变化', content_guide: '意境在时间中流变——晨昏、四季、风雨、晴雾。同一个山水在不同状态下的美感。纯视觉诗，没有解释性旁白。' },
      { position: 2, function_label: '灵韵定格', function_description: '山水精神的凝练表达', content_guide: '山水的精神——不是"资源"，而是灵韵。一句话或一首诗定格即可。画面要有留白。' },
    ],
  },
  explainer_video: {
    video_type: 'explainer_video',
    label: '知识讲解视频',
    min_scenes: 4,
    max_scenes: 6,
    scene_templates: [
      { position: 0, function_label: '提出问题', function_description: '核心问题/悬念引入', content_guide: '用一个引人思考的问题开场——这种技艺为什么能千年传承？这段历史为什么被遗忘？问题比答案更有吸引力。' },
      { position: 1, function_label: '概念解释', function_description: '核心概念/知识点讲解', content_guide: '清晰讲解核心概念——用类比、对比、视觉辅助让复杂概念变得易懂。每个概念只讲一个要点。' },
      { position: 2, function_label: '实例论证', function_description: '具体案例/事实支撑', content_guide: '用具体案例支撑概念——不是抽象论证，要有真实的人物、事件、地点作为例证。案例要简短有力。' },
      { position: 3, function_label: '逻辑深化', function_description: '深层原理/延伸思考', content_guide: '深化到原理层面——不只是"是什么"，还要讲"为什么"和"意味着什么"。要有逻辑递进。' },
      { position: 4, function_label: '总结归纳', function_description: '知识要点归纳收束', content_guide: '归纳总结——用最简洁的语言重述核心要点。可以加一个延伸思考问题引发后续讨论。' },
    ],
  },
  education_training: {
    video_type: 'education_training',
    label: '教育/培训片',
    min_scenes: 5,
    max_scenes: 8,
    scene_templates: [
      { position: 0, function_label: '学习目标', function_description: '明确学习目标', content_guide: '明确告诉观众：学完这段你能掌握什么。目标要具体可衡量，不是"了解文化"，而是"掌握3个核心要点"。' },
      { position: 1, function_label: '知识讲授', function_description: '核心知识讲解', content_guide: '讲解核心知识——结构化、分步骤、有逻辑。每个知识点配一个案例或图示。避免信息过载，每个段落只讲一个要点。' },
      { position: 2, function_label: '示范演示', function_description: '操作/流程示范', content_guide: '如果涉及操作，做完整示范——从准备到执行到检验。要有步骤标注和要点提示。' },
      { position: 3, function_label: '练习引导', function_description: '练习/思考题', content_guide: '给出练习或思考题——让观众主动参与，不只是被动接受。练习要与学习目标直接对应。' },
      { position: 4, function_label: '检验反馈', function_description: '知识检验', content_guide: '检验是否达到学习目标——用问答或场景测试验证理解。反馈要及时，错误要纠正。' },
      { position: 5, function_label: '总结拓展', function_description: '知识总结+延伸学习', content_guide: '总结要点+提供延伸学习方向。告诉观众下一步可以学什么、在哪里找到更多资源。' },
    ],
  },
};

// Fallback: for video types without specific dramatic structure, use character_story as base
function getDramaticStructure(videoType: VideoType): DramaticStructure {
  return DRAMATIC_STRUCTURES[videoType] ?? DRAMATIC_STRUCTURES.character_story;
}

// ---------------------------------------------------------------------------
// Duration calculation helpers
// ---------------------------------------------------------------------------

const DURATION_SEC_MAP: Record<string, number> = {
  '30秒': 30, '1分钟': 60, '3分钟': 180, '5分钟': 300,
  '8分钟': 480, '10分钟': 600, '15分钟': 900, '20分钟': 1200,
};

const PANEL_COUNT_BY_DURATION: Record<number, PanelCount> = {
  12: 6, 15: 6, 20: 6, 25: 8, 30: 9, 36: 10, 43: 10, 45: 10,
  50: 10, 60: 12, 67: 12, 69: 12, 75: 12, 80: 12, 86: 12, 90: 12,
  96: 12, 100: 12, 109: 12, 113: 12, 120: 12,
};

const CAMERA_BY_FUNCTION: Record<string, string> = {
  '钩子开场': '近景特写切入，制造紧迫感',
  '主角处境': '中景固定镜头，人物动作清晰',
  '冲突升级': '近景快速切换，节奏紧凑',
  '关键行动': '中近景跟拍，动作细节凸显',
  '高潮': '特写+缓推交替，情绪聚焦',
  '结尾': '远景拉远，留白收束',
  '时代危机': '远景大画面，建立历史空间',
  '人物卷入': '中景跟随，人物入场',
  '历史余响': '远景+叠影，时空延展',
  '现实引入': '实景空镜+旁白，文献感开场',
  '历史回望': '史料画面+旁白，时间回溯',
  '关键节点': '中景叙事，事实再现',
  '文化解释': '专家旁白+史料画面',
  '当代意义': '现实场景+精神传承旁白',
  '提出主题': '主讲人正面镜头，观点鲜明',
  '讲述事实': '主讲人+画面辅助',
  '分析精神': '主讲人+金句字幕',
  '联系当下': '主讲人+现实场景',
  '总结号召': '主讲人正面+号召力收束',
  '小主人公': '明亮色调中景，少年出场',
  '遇到问题': '中景，表情清晰',
  '学习成长': '中景+小动作细节',
  '做出选择': '近景特写，决心表情',
  '温暖结尾': '远景+暖色调，温暖收束',
  '3秒钩子': '冲击画面特写',
  '关键信息': '快切画面+字幕',
  '情绪推进': '节奏蒙太奇',
  '金句落点': '定格画面+文字叠加',
  '开场': '远景缓缓推进，建立空间感',
  '铺垫': '中景固定镜头，人物动作清晰',
  '尾声': '远景拉远，留白收束',
  '人物登场': '中景出场镜头+表情标注',
  '冲突爆发': '密集对白+分镜切换',
  '反转/觉醒': '表情变化特写+动作转折',
  '高燃收束': '金句定格+画面冲击',
  // --- Legend story ---
  '远古传说': '远景推入，建立神话空间',
  '神力显现': '特效+光影变化，超自然氛围',
  '凡人考验': '中景，人物表情清晰',
  '命运转折': '特写+环境突变，命运感',
  '传说永恒': '远景+叠影，时空延展',
  // --- Culture promo ---
  '符号引入': '实物特写+空镜，视觉锚点',
  '文化根基': '史料画面+旁白，纵深感',
  '技艺展示': '微距+慢动作，手艺之美',
  '现代传承': '实景+生活场景，温度感',
  '标语收束': '画面定格+文字叠加',
  // --- Heritage promo ---
  '技艺渊源': '实物/文献引入+旁白',
  '匠人登场': '中景跟随，匠人出场',
  '工艺全程': '微距+过程镜头，步骤感',
  '精神内核': '匠人特写+旁白解读',
  '传承之路': '现实场景+希望光线',
  // --- City brand promo ---
  '地标引入': '航拍/远景推入，空间认同',
  '历史底蕴': '史料画面+具体故事旁白',
  '人文风貌': '生活场景快切，烟火气',
  '生活气息': '人物中景+日常节奏',
  '品牌定格': '画面定格+品牌文字叠加',
  // --- Scene short ---
  '空间引入': '空镜缓推，空间氛围建立',
  '场景叙事': '中景叙事，事件简短呈现',
  '时空叠印': '叠影+古今切换，时间深度',
  '意境收束': '远景+旁白留白',
  // --- Landscape mood ---
  '山水开卷': '航拍/远景缓推，自然入场',
  '意境流变': '四季/天气蒙太奇，视觉诗',
  '灵韵定格': '远景留白+诗句定格',
  // --- Explainer video ---
  '提出问题': '主讲人正面+问题字幕',
  '概念解释': '主讲人+视觉辅助/图示',
  '实例论证': '案例画面+旁白论证',
  '逻辑深化': '主讲人+逻辑图示',
  '总结归纳': '主讲人+要点字幕叠加',
  // --- Education/training ---
  '学习目标': '主讲人正面+目标字幕',
  '知识讲授': '主讲人+分步图示',
  '示范演示': '实操画面+步骤标注',
  '练习引导': '主讲人+练习画面',
  '检验反馈': '问答画面+反馈标注',
  '总结拓展': '主讲人+延伸资源字幕',
};

// ---------------------------------------------------------------------------
// Extract story paragraphs relevant to the central event
// ---------------------------------------------------------------------------

function extractEventParagraphs(storyText: string, centralEvent: string): string[] {
  const paragraphs = storyText.split(/\n\n+/).filter(p => p.trim());
  // Find paragraphs that contain the central event keyword
  const relevant = paragraphs.filter(p =>
    p.includes(centralEvent) || p.includes(`**${centralEvent}**`)
  );
  // If no specific paragraphs found, use the whole story
  if (relevant.length === 0) {
    // Try to find paragraphs that contain any keyword from the central event
    const eventKeywords = centralEvent.split(/[，、]/);
    const keywordRelevant = paragraphs.filter(p =>
      eventKeywords.some(kw => p.includes(kw))
    );
    return keywordRelevant.length > 0 ? keywordRelevant : paragraphs.slice(0, 5);
  }
  return relevant;
}

// ---------------------------------------------------------------------------
// Extract key dialogue/quotes from story text
// ---------------------------------------------------------------------------

export function extractQuotes(storyText: string): string[] {
  const quotes: string[] = [];
  // Chinese quotes pattern: "..." or 「...」
  const quoteRegex = /[「"『]([^」"』]+)[」"』]/g;
  let match: RegExpExecArray | null;
  while ((match = quoteRegex.exec(storyText)) !== null) {
    if (match[1].length >= 4) quotes.push(match[1]);
  }
  // Also extract bold text that looks like quotes
  const boldRegex = /\*\*(.+?)\*\*/g;
  const skipWords = ['省份', '地区', '类型', '简介', '故事梗概', '文化意义', '相关地点', '关键词', '来源', '可信度', '核实方法', '待核实点'];
  while ((match = boldRegex.exec(storyText)) !== null) {
    const text = match[1].trim();
    if (!skipWords.includes(text) && text.length >= 8) quotes.push(text);
  }
  return quotes;
}

// ---------------------------------------------------------------------------
// Extract character names from story text
// ---------------------------------------------------------------------------

function extractCharacterNames(storyText: string, entryName: string): string[] {
  const protagonist = entryName.split('——')[0].trim();
  const chars = [protagonist];

  // Extract other character names from story paragraphs
  const namePattern = /[^\x00-\x7F]{2,4}(?:公|君|卿|帅|将|帝|王|侯|臣|官|郎|翁|生|师|僧|仙|道|妇|女|郎|军|守|尹|丞)/g;
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = namePattern.exec(storyText)) !== null) {
    const name = m[0];
    if (name !== protagonist) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  for (const [name, count] of counts) {
    if (count >= 2) chars.push(name);
  }
  return chars.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Generate a story title from the central event
// ---------------------------------------------------------------------------

function generateStoryTitle(centralEvent: string, entry: EntryDetail, videoType: VideoType): string {
  // If central event is a specific dramatic event, use it as title basis
  const protagonist = entry.name.split('——')[0].trim();

  // Try to create a dramatic title
  const eventShort = centralEvent.length <= 8 ? centralEvent : centralEvent.substring(0, 8);

  // Check if the event contains dramatic keywords for title inspiration
  if (centralEvent.includes('拒签')) return `${eventShort}`;
  if (centralEvent.includes('断案')) return `${protagonist}${eventShort}`;
  if (centralEvent.includes('投江')) return `${eventShort}`;
  if (centralEvent.includes('殉国')) return `${eventShort}`;

  // For documentary/lecture, use more descriptive title
  if (videoType === 'documentary_short' || videoType === 'lecture_video') {
    return `${protagonist}：${eventShort}`;
  }

  // For children story, simplify
  if (videoType === 'children_story') {
    return `${protagonist}的${eventShort}`;
  }

  // Default: use central event as title
  return eventShort;
}

// ---------------------------------------------------------------------------
// Generate dramatic content — the CORE function
// ---------------------------------------------------------------------------

interface DramaticContentInput {
  entry: EntryDetail;
  centralEvent: string;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  targetDuration: SupportedDuration;
  tone: string;
  knowledgePack?: KnowledgePack;
  originalUserQuery?: string;
}

export function generateDramaticContent(input: DramaticContentInput): {
  title: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: StoryScene[];
  gears_segments: GearsSegment[];
  cultural_constraints: string[];
  credibility_note: string;
  characters: StoryCharacter[];
  act_structure: ActBeat[];
  protagonist_arc: ProtagonistArc[];
} {
  const { entry, centralEvent, videoType, presentationStyle, targetDuration, tone, knowledgePack, originalUserQuery } = input;

  const structure = getDramaticStructure(videoType);
  const totalSeconds = DURATION_SEC_MAP[targetDuration] ?? 60;

  // Determine scene count: min 3, max based on structure and duration
  const targetSceneCount = Math.max(
    structure.min_scenes,
    Math.min(structure.max_scenes, Math.max(3, Math.round(totalSeconds / 50)))
  );

  const perSceneDuration = Math.round(totalSeconds / targetSceneCount);

  // Extract event-relevant content from the entry
  const eventParagraphs = extractEventParagraphs(entry.story, centralEvent);
  const quotes = extractQuotes(entry.story);
  const characterNames = extractCharacterNames(entry.story, entry.name);
  const protagonist = entry.name.split('——')[0].trim();

  // Supporting knowledge from knowledge_pack
  const supportingRegions = knowledgePack?.supporting_entries
    ?.filter(e => e.role_in_story === 'regional_context')
    ?.map(e => e.entry_name.split('——')[0])
    ?? [];
  const supportingContext = knowledgePack?.supporting_entries
    ?.filter(e => e.role_in_story === 'cultural_background')
    ?.map(e => `${e.entry_name}(${e.summary.substring(0, 40)})`)
    ?? [];

  // Build scenes based on the dramatic structure templates
  const sceneTemplates = structure.scene_templates;
  // Extend or trim templates to match targetSceneCount
  const templates = adjustTemplates(sceneTemplates, targetSceneCount);

  const scenes: StoryScene[] = [];
  const fullTextParts: string[] = [];

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const scene = generateSceneContent(
      i, template, entry, centralEvent, eventParagraphs, quotes,
      characterNames, protagonist, perSceneDuration, tone, videoType,
      supportingRegions, supportingContext,
    );
    scenes.push(scene);
    fullTextParts.push(scene.plot);
  }

  // Generate full_text from scene plots with transitions
  const fullText = buildFullText(fullTextParts, scenes, protagonist, centralEvent, entry, videoType);

  // Generate title
  const title = generateStoryTitle(centralEvent, entry, videoType);

  // Generate logline
  const logline = generateLogline(entry, centralEvent, videoType);

  // Generate theme
  const theme = generateTheme(entry, centralEvent, videoType);

  // Build gears_segments from scenes
  const gearsSegments = generateDramaticGearsSegments(scenes, videoType, presentationStyle);

  // Build characters
  const characters = buildCharacters(characterNames, protagonist, entry, centralEvent);

  // Build act_structure
  const actStructure = buildActStructure(scenes);

  // Build protagonist_arc
  const protagonistArc = buildProtagonistArc(protagonist, scenes, centralEvent, entry);

  // Cultural constraints
  const culturalConstraints = buildCulturalConstraints(entry, knowledgePack);

  // Credibility note
  const credibilityNote = buildCredibilityNote(entry, knowledgePack, originalUserQuery, centralEvent);

  // Source entries for knowledge_pack traceability
  const sourceEntryNames = [entry.name];
  if (knowledgePack?.primary_entries) {
    for (const e of knowledgePack.primary_entries) sourceEntryNames.push(e.entry_name);
  }
  if (knowledgePack?.supporting_entries) {
    for (const e of knowledgePack.supporting_entries) sourceEntryNames.push(e.entry_name);
  }

  // Add source_entries to scenes and gears segments
  for (const scene of scenes) {
    scene.source_entries = [entry.name];
    if (scene.plot.includes(centralEvent)) scene.factual_basis = `基于${entry.name}知识库条目中"${centralEvent}"相关内容`;
  }
  for (const seg of gearsSegments) {
    seg.source_entries = sourceEntryNames;
  }

  return {
    title, logline, theme, full_text: fullText,
    scene_breakdown: scenes, gears_segments: gearsSegments,
    cultural_constraints: culturalConstraints, credibility_note: credibilityNote,
    characters, act_structure: actStructure, protagonist_arc: protagonistArc,
  };
}

// ---------------------------------------------------------------------------
// Adjust template count to match target scenes
// ---------------------------------------------------------------------------

function adjustTemplates(templates: SceneTemplate[], targetCount: number): SceneTemplate[] {
  if (templates.length === targetCount) return templates;
  if (templates.length > targetCount) return templates.slice(0, targetCount);

  // If we need more scenes, insert "铺垫" or "冲突升级" between existing templates
  const result = [...templates];
  while (result.length < targetCount) {
    // Insert a "铺垫" scene before the climax (position before last 2)
    const insertPos = result.length - 2;
    const prevTemplate = result[insertPos - 1] ?? result[0];
    result.splice(insertPos, 0, {
      position: insertPos,
      function_label: prevTemplate.function_label === '冲突升级' ? '冲突深化' : '铺垫',
      function_description: '中间过渡场景，加深冲突或补充细节',
      content_guide: '深化冲突或补充背景细节——用一个具体场景推进矛盾，不要跳到结局。要有具体地点和动作。',
    });
    // Re-number positions
    for (let i = 0; i < result.length; i++) result[i].position = i;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Generate content for a single scene
// ---------------------------------------------------------------------------

function generateSceneContent(
  idx: number,
  template: SceneTemplate,
  entry: EntryDetail,
  centralEvent: string,
  eventParagraphs: string[],
  quotes: string[],
  characterNames: string[],
  protagonist: string,
  durationSec: number,
  tone: string,
  videoType: VideoType,
  supportingRegions: string[],
  supportingContext: string[],
): StoryScene {
  // Determine time of day based on scene position and content hints
  const timeOfDay = determineTimeOfDay(idx, centralEvent, eventParagraphs);

  // Determine location
  const location = determineLocation(entry, idx, centralEvent, eventParagraphs, supportingRegions);

  // Build plot — the narrative description of this scene
  const plot = buildScenePlot(template, entry, centralEvent, eventParagraphs, quotes, protagonist, characterNames, tone, videoType, supportingContext, idx);

  // Build conflict description
  const conflict = buildSceneConflict(template, centralEvent, protagonist, eventParagraphs);

  // Build dialogue/narration
  const dialogueOrNarration = buildDialogueOrNarration(template, centralEvent, quotes, protagonist, eventParagraphs, videoType);

  // Build key action
  const keyAction = buildKeyAction(template, protagonist, centralEvent);

  // Build visual prompt
  const visualPrompt = buildVisualPrompt(template, location, timeOfDay, centralEvent, protagonist, entry, tone);

  // Build camera suggestion
  const cameraSuggestion = CAMERA_BY_FUNCTION[template.function_label] ?? '中景固定镜头';

  // Build characters for this scene
  const sceneChars = determineSceneCharacters(template, characterNames, protagonist);

  // Build cultural note
  const culturalNote = buildSceneCulturalNote(entry, centralEvent, template);

  // Build fictionalized elements
  const fictionalized = determineFictionalizedElements(template, videoType);

  // Scene title
  const title = buildSceneTitle(template, centralEvent, idx);

  return {
    scene_id: idx + 1,
    title,
    duration_sec: durationSec,
    location,
    time_of_day: timeOfDay,
    dramatic_function: template.function_label,
    plot,
    key_action: keyAction,
    characters: sceneChars,
    visual_prompt: visualPrompt,
    camera_suggestion: cameraSuggestion,
    cultural_note: culturalNote,
    conflict,
    dialogue_or_narration: dialogueOrNarration,
    source_entries: [entry.name],
    factual_basis: `基于${entry.name}中"${centralEvent}"相关内容`,
    fictionalized_elements: fictionalized,
  };
}

// ---------------------------------------------------------------------------
// Scene content builders
// ---------------------------------------------------------------------------

function determineTimeOfDay(idx: number, centralEvent: string, paragraphs: string[]): string {
  // Check if paragraphs mention time
  const timeHints = ['雨夜', '夜', '夜晚', '深夜', '清晨', '白天', '黄昏', '傍晚', '拂晓'];
  for (const hint of timeHints) {
    if (paragraphs.some(p => p.includes(hint))) {
      // Use the first time hint found as opening time
      if (idx === 0) return hint;
    }
  }
  // Default cycling based on dramatic structure
  const defaults = ['雨夜', '白天', '黄昏', '夜晚', '清晨'];
  return defaults[Math.min(idx, defaults.length - 1)];
}

function determineLocation(entry: EntryDetail, idx: number, centralEvent: string, paragraphs: string[], supportingRegions: string[]): string {
  // Try to extract specific location from paragraphs
  const locationHints = ['军衙', '衙门', '官衙', '衙署', '书院', '楼', '阁', '亭', '池', '寺', '庙', '祠', '江', '河', '湖', '山', '洞', '府', '宫', '巷', '街'];
  for (const hint of locationHints) {
    for (const p of paragraphs) {
      const match = p.match(new RegExp(`[^，。！？]*${hint}[^，。！？]*`));
      if (match) return match[0].trim().substring(0, 20);
    }
  }

  // Use entry region + supporting context
  if (supportingRegions.length > 0) {
    return `${entry.region}（${supportingRegions[0]}）`;
  }
  return entry.region || '未标注地点';
}

function buildSceneTitle(template: SceneTemplate, centralEvent: string, idx: number): string {
  // Generate a descriptive scene title
  const labelMap: Record<string, string[]> = {
    '钩子开场': [`雨夜${centralEvent}`, `危机开场`, `${centralEvent}现场`],
    '主角处境': [`主角处境`, `${centralEvent}中的选择`, '身处两难'],
    '冲突升级': [`冲突升级`, '压力与抉择', '矛盾深化'],
    '关键行动': [`关键行动`, '拒签/断案', '做出选择'],
    '高潮': [`高潮`, `${centralEvent}爆发`, '核心冲突'],
    '结尾': [`结尾`, '精神落点', '良知守望'],
    '时代危机': [`时代危机`, '局势紧迫'],
    '人物卷入': [`人物卷入`, '到任/接令'],
    '历史余响': [`历史余响`, '事件后续'],
    '现实引入': [`现实引入`, '今日遗迹'],
    '历史回望': [`历史回望`, '时光回溯'],
    '关键节点': [`关键节点`, centralEvent],
    '文化解释': [`文化解读`, '精神照见'],
    '当代意义': [`当代意义`, '精神传承'],
    '提出主题': [`提出主题`, '核心观点'],
    '讲述事实': [`讲述事实`, centralEvent],
    '分析精神': [`分析精神`, '精神提炼'],
    '联系当下': [`联系当下`, '现实映射'],
    '总结号召': [`总结号召`, '行动号召'],
    '小主人公': [`少年出场`, '新任官员'],
    '遇到问题': [`发现问题`, '冤案疑点'],
    '学习成长': [`探索真相`, '翻查案卷'],
    '做出选择': [`勇敢拒绝`, '做出选择'],
    '温暖结尾': [`冤案得雪`, '温暖结尾'],
    '3秒钩子': [`3秒开场`, '冲击画面'],
    '关键信息': [`核心事实`, '人物+事件'],
    '情绪推进': [`情感渲染`, '情绪推进'],
    '金句落点': [`金句定格`, '精神定格'],
    '开场': [`开场`, '建立情境'],
    '铺垫': [`铺垫`, '背景补充'],
    '尾声': [`尾声`, '留白收束'],
    '人物登场': [`人物登场`, '角色入场'],
    '冲突爆发': [`冲突爆发`, '对白交锋'],
    '反转/觉醒': [`反转觉醒`, '选择时刻'],
    '高燃收束': [`金句定格`, '精神定格'],
    '冲突深化': [`冲突深化`, '矛盾加深'],
    // --- Legend story ---
    '远古传说': [`远古传说`, '神话开场'],
    '神力显现': [`神力显现`, '超自然介入'],
    '凡人考验': [`凡人考验`, '人的抉择'],
    '命运转折': [`命运转折`, '天意与人意'],
    '传说永恒': [`传说永恒`, '世代传颂'],
    // --- Culture promo ---
    '符号引入': [`文化符号`, '视觉锚点'],
    '文化根基': [`文化根基`, '精神渊源'],
    '技艺展示': [`技艺展示`, '匠心之美'],
    '现代传承': [`现代传承`, '活在当下'],
    '标语收束': [`标语收束`, '精神定格'],
    // --- Heritage promo ---
    '技艺渊源': [`技艺渊源`, '非遗起源'],
    '匠人登场': [`匠人登场`, '传承人出场'],
    '工艺全程': [`工艺全程`, '手艺过程'],
    '精神内核': [`精神内核`, '技艺精神'],
    '传承之路': [`传承之路`, '接力延续'],
    // --- City brand promo ---
    '地标引入': [`地标引入`, '城市空间'],
    '历史底蕴': [`历史底蕴`, '城市记忆'],
    '人文风貌': [`人文风貌`, '地方特色'],
    '生活气息': [`生活气息`, '烟火日常'],
    '品牌定格': [`品牌定格`, '城市印象'],
    // --- Scene short ---
    '空间引入': [`空间引入`, '走进空间'],
    '场景叙事': [`场景叙事`, '空间故事'],
    '时空叠印': [`时空叠印`, '古今映照'],
    '意境收束': [`意境收束`, '氛围定格'],
    // --- Landscape mood ---
    '山水开卷': [`山水开卷`, '自然入场'],
    '意境流变': [`意境流变`, '四季流转'],
    '灵韵定格': [`灵韵定格`, '山水精神'],
    // --- Explainer video ---
    '提出问题': [`提出问题`, '核心悬念'],
    '概念解释': [`概念解释`, '知识讲解'],
    '实例论证': [`实例论证`, '案例支撑'],
    '逻辑深化': [`逻辑深化`, '深层原理'],
    '总结归纳': [`总结归纳`, '要点重述'],
    // --- Education/training ---
    '学习目标': [`学习目标`, '目标明确'],
    '知识讲授': [`知识讲授`, '分步讲解'],
    '示范演示': [`示范演示`, '操作展示'],
    '练习引导': [`练习引导`, '主动参与'],
    '检验反馈': [`检验反馈`, '知识检验'],
    '总结拓展': [`总结拓展`, '延伸方向'],
  };

  const options = labelMap[template.function_label] ?? [template.function_label];
  return options[Math.min(idx, options.length - 1)];
}

function buildScenePlot(
  template: SceneTemplate,
  entry: EntryDetail,
  centralEvent: string,
  paragraphs: string[],
  quotes: string[],
  protagonist: string,
  characterNames: string[],
  tone: string,
  videoType: VideoType,
  supportingContext: string[],
  idx: number,
): string {
  // Build plot based on the template's content_guide and the entry content
  // This is the KEY change: plot is narrative, not template-concatenation

  const protagonistName = protagonist;
  const region = entry.region || '';
  const eventContent = paragraphs.length > 0 ? paragraphs[0] : '';
  const keyQuote = quotes.length > 0 ? quotes[0] : '';

  // Extract specific action/setting details from paragraphs
  const actionDetails = extractActionDetails(eventContent, centralEvent);

  // Tone modifiers
  const toneAdj = tone ? `${tone}氛围下，` : '';

  switch (template.function_label) {
    case '钩子开场':
      return buildHookOpening(centralEvent, region, protagonistName, actionDetails, keyQuote, timeOfDay_forScene(idx));

    case '主角处境':
      return buildProtagonistSituation(protagonistName, entry, centralEvent, actionDetails, region);

    case '冲突升级':
      return buildConflictEscalation(protagonistName, centralEvent, actionDetails, characterNames);

    case '关键行动':
      return buildKeyActionScene(protagonistName, centralEvent, actionDetails, keyQuote);

    case '高潮':
      return buildClimaxScene(protagonistName, centralEvent, keyQuote, actionDetails);

    case '结尾':
      return buildEndingScene(protagonistName, centralEvent, entry, videoType);

    case '时代危机':
      return buildEraCrisis(centralEvent, entry, region);

    case '人物卷入':
      return buildCharacterInvolved(protagonistName, entry, centralEvent, region);

    case '历史余响':
      return buildHistoricalEcho(protagonistName, centralEvent, entry);

    case '现实引入':
      return buildRealityIntro(centralEvent, entry, region);

    case '历史回望':
      return buildHistoricalRetrospect(protagonistName, entry, centralEvent, region);

    case '关键节点':
      return buildKeyNode(protagonistName, centralEvent, actionDetails, keyQuote);

    case '文化解释':
      return buildCultureExplanation(protagonistName, centralEvent, entry);

    case '当代意义':
      return buildContemporaryMeaning(protagonistName, centralEvent, entry);

    case '提出主题':
      return buildProposeTheme(protagonistName, centralEvent, entry);

    case '讲述事实':
      return buildTellFacts(protagonistName, centralEvent, actionDetails);

    case '分析精神':
      return buildAnalyzeSpirit(protagonistName, centralEvent, entry);

    case '联系当下':
      return buildConnectPresent(protagonistName, centralEvent, entry);

    case '总结号召':
      return buildCallToAction(protagonistName, centralEvent, keyQuote);

    case '小主人公':
      return buildChildProtagonist(protagonistName, entry, region);

    case '遇到问题':
      return buildChildProblem(protagonistName, centralEvent);

    case '学习成长':
      return buildChildGrowth(protagonistName, centralEvent, actionDetails);

    case '做出选择':
      return buildChildChoice(protagonistName, centralEvent, keyQuote);

    case '温暖结尾':
      return buildChildEnding(protagonistName, centralEvent);

    case '3秒钩子':
      return buildShortHook(protagonistName, centralEvent, keyQuote);

    case '关键信息':
      return buildShortKeyInfo(protagonistName, centralEvent);

    case '情绪推进':
      return buildShortEmotion(protagonistName, centralEvent, toneAdj);

    case '金句落点':
      return buildShortGoldenQuote(protagonistName, centralEvent, keyQuote);

    // --- Legend story ---
    case '远古传说':
      return buildLegendOpening(centralEvent, region, protagonistName, entry);
    case '神力显现':
      return buildSupernaturalPower(centralEvent, protagonistName, entry);
    case '凡人考验':
      return buildHumanTrial(protagonistName, centralEvent, actionDetails);
    case '命运转折':
      return buildFateTurning(protagonistName, centralEvent, keyQuote, entry);
    case '传说永恒':
      return buildLegendEnduring(protagonistName, centralEvent, entry);

    // --- Culture promo ---
    case '符号引入':
      return buildSymbolOpening(entry, region);
    case '文化根基':
      return buildCultureRoots(entry, centralEvent);
    case '技艺展示':
      return buildCraftDisplay(entry, centralEvent, actionDetails);
    case '现代传承':
      return buildModernInheritance(entry, protagonistName);
    case '标语收束':
      return buildSloganClose(entry, protagonistName, keyQuote);

    // --- Heritage promo ---
    case '技艺渊源':
      return buildHeritageOrigin(entry, centralEvent, region);
    case '匠人登场':
      return buildArtisanEntrance(protagonistName, entry, region);
    case '工艺全程':
      return buildCraftProcess(entry, actionDetails);
    case '精神内核':
      return buildCraftSpirit(protagonistName, centralEvent, entry);
    case '传承之路':
      return buildInheritancePath(protagonistName, centralEvent, entry);

    // --- City brand promo ---
    case '地标引入':
      return buildLandmarkOpening(entry, region);
    case '历史底蕴':
      return buildCityHistory(entry, centralEvent, protagonistName);
    case '人文风貌':
      return buildCityCulture(entry, region);
    case '生活气息':
      return buildCityLife(entry, region);
    case '品牌定格':
      return buildBrandClose(entry, region);

    // --- Scene short ---
    case '空间引入':
      return buildSpaceIntro(entry, region);
    case '场景叙事':
      return buildSceneNarrative(protagonistName, centralEvent, actionDetails, entry);
    case '时空叠印':
      return buildTimeOverlay(entry, centralEvent, protagonistName);
    case '意境收束':
      return buildMoodClose(entry, region);

    // --- Landscape mood ---
    case '山水开卷':
      return buildLandscapeOpening(entry, region);
    case '意境流变':
      return buildMoodFlow(entry, region);
    case '灵韵定格':
      return buildSpiritEssence(entry, region);

    // --- Explainer video ---
    case '提出问题':
      return buildPoseQuestion(centralEvent, entry);
    case '概念解释':
      return buildConceptExplain(centralEvent, entry);
    case '实例论证':
      return buildCaseEvidence(protagonistName, centralEvent, actionDetails);
    case '逻辑深化':
      return buildLogicDeepen(centralEvent, entry);
    case '总结归纳':
      return buildSummary(centralEvent, entry);

    // --- Education/training ---
    case '学习目标':
      return buildLearningObjective(centralEvent, entry);
    case '知识讲授':
      return buildKnowledgeTeach(centralEvent, entry);
    case '示范演示':
      return buildDemonstration(protagonistName, centralEvent, actionDetails);
    case '练习引导':
      return buildPracticeGuide(centralEvent);
    case '检验反馈':
      return buildAssessment(centralEvent, entry);
    case '总结拓展':
      return buildExtendedSummary(centralEvent, entry);

    default:
      // Generic: use content guide + available material
      return `${region}，${template.function_label}。${protagonistName}${actionDetails || `面对${centralEvent}的选择`}`;
  }
}

// ---------------------------------------------------------------------------
// Specific scene plot builders — narrative text generation
// ---------------------------------------------------------------------------

function timeOfDay_forScene(idx: number): string {
  const defaults = ['雨夜', '白天', '黄昏', '夜晚', '清晨'];
  return defaults[Math.min(idx, defaults.length - 1)];
}

function extractActionDetails(paragraph: string, centralEvent: string): string {
  // Extract the most specific action description from the paragraph
  const sentences = paragraph.split(/[。！？]/).filter(s => s.includes(centralEvent) || s.length >= 10);
  if (sentences.length > 0) {
    return sentences[0].trim().substring(0, 60);
  }
  return '';
}

function buildHookOpening(centralEvent: string, region: string, protagonist: string, details: string, quote: string, timeOfDay: string): string {
  if (centralEvent.includes('拒签')) {
    return `${timeOfDay}，${region}军衙。一份死刑文书摆在案头，烛火摇晃映出"死罪"二字。${protagonist}翻到案卷最后一页，手指停在判词上，第一次没有立刻签字。`;
  }
  if (centralEvent.includes('断案')) {
    return `${timeOfDay}，${region}。${protagonist}翻开一份疑难案卷，案情疑点重重。他抬头看向催促他的上司，第一次没有立刻回话。`;
  }
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `${timeOfDay}，${region}。${protagonist}站在江边，衣袂被风吹起。身后是国破家亡的消息，面前是无尽的江水。`;
  }
  // Generic hook
  if (details) {
    return `${timeOfDay}，${region}。${details}${protagonist}第一次面对这样的局面——没有退路。`;
  }
  return `${timeOfDay}，${region}。${protagonist}${centralEvent}——这是他人生中最关键的时刻。`;
}

function buildProtagonistSituation(protagonist: string, entry: EntryDetail, centralEvent: string, details: string, region: string): string {
  if (centralEvent.includes('拒签')) {
    return `${protagonist}刚到${region}任司理参军——专管刑狱司法的底层官员。知军催他签字，说此案早已审结，只待他画押便可执行。但${protagonist}逐页细读案卷，发现疑点重重。囚犯依法不该死。`;
  }
  if (centralEvent.includes('断案')) {
    return `${protagonist}到任${region}，面对一桩疑难案件。所有人都催他尽快结案，但他看到案卷中隐含的疑点，不愿草率定案。`;
  }
  return `${protagonist}是什么身份？他为什么必须面对这个选择——${details || `在${region}，${centralEvent}把他推到了抉择面前`}`;
}

function buildConflictEscalation(protagonist: string, centralEvent: string, details: string, characterNames: string[]): string {
  const antagonist = characterNames.length > 1 ? characterNames[1] : '上官';
  if (centralEvent.includes('拒签')) {
    return `囚犯依法不该死——罪不至死，证据不足，量刑畸重。${protagonist}向${antagonist}提出异议，要求重新审查。${antagonist}不容置疑："此案已定，你只需签字。"签字，囚犯冤死，他保全官位；拒签，得罪上官，可能丢官甚至获罪。`;
  }
  if (centralEvent.includes('断案')) {
    return `案情越来越复杂，${antagonist}催促定案，地方势力暗中施压。${protagonist}如果草率结案，冤屈者受罚；如果坚持查明真相，可能得罪多方。`;
  }
  return `${antagonist}施压加大，矛盾不断深化。${protagonist}面对两难选择：妥协保全自己，还是坚持正义？${details || `外部压力与内心良知之间，裂痕越来越大`}`;
}

function buildKeyActionScene(protagonist: string, centralEvent: string, details: string, quote: string): string {
  if (centralEvent.includes('拒签')) {
    return `${protagonist}选择了拒签。他仔细翻阅案卷每一条证据，记录疑点，向知军逐条陈述。${antagonist_placeholder()}震怒，以长官权威相逼。${protagonist}拿起自己的任命文书——`;
  }
  if (centralEvent.includes('断案')) {
    return `${protagonist}开始深入调查。他走访现场、询问证人、比对证词。每一步都遇到阻力，但他不放弃。真相逐渐浮出水面。`;
  }
  return `${protagonist}做出选择——${details || `他选择了${centralEvent}的道路`}${quote ? `，说出："${quote}"` : ''}`;
}

function antagonist_placeholder(): string {
  return '知军';
}

function buildClimaxScene(protagonist: string, centralEvent: string, quote: string, details: string): string {
  if (centralEvent.includes('拒签')) {
    const coreQuote = quote || '为上官杀人，以媚于人，吾不为也';
    return `${protagonist}对${antagonist_placeholder()}说出那句话——"${coreQuote}"他将任命文书交还，准备辞官离去。${antagonist_placeholder()}被震动。局面反转。`;
  }
  if (centralEvent.includes('断案')) {
    return `真相大白。${protagonist}公布调查结果，冤屈者洗清嫌疑，正义得到伸张。这是${centralEvent}的关键时刻。`;
  }
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `${protagonist}${centralEvent}。${quote || `他的选择，成为千古传颂的精神坐标`}`;
  }
  return `${protagonist}${centralEvent}——关键时刻到来。${quote ? `"${quote}"` : '他的选择改变了一切'}`;
}

function buildEndingScene(protagonist: string, centralEvent: string, entry: EntryDetail, videoType: VideoType): string {
  if (centralEvent.includes('拒签')) {
    return `囚犯免死。${protagonist}没有赢得权势，但守住了良知。后来他写《爱莲说》，那朵"濂溪观莲"，正是${centralEvent.replace('冤案', '')}之后的选择余响——出淤泥而不染。`;
  }
  if (centralEvent.includes('断案')) {
    return `冤屈者得雪。${protagonist}守住了公正，没有让无辜者受罚。这个选择照见了他的精神——明察秋毫，不冤不纵。`;
  }
  // Generic ending: connect to the entry's cultural significance
  const culturalTheme = entry.culturalSignificance
    ? entry.culturalSignificance.substring(0, 80).split(/[。！？]/)[0]
    : `${protagonist}的精神传承至今`;
  return `${culturalTheme}。${centralEvent}——不是权势的胜利，而是良知的坚守。`;
}

function buildEraCrisis(centralEvent: string, entry: EntryDetail, region: string): string {
  return `${region}，时代风云激荡。制度压迫与个人良知之间的裂缝越来越大。在这样的背景下，${entry.name.split('——')[0]}${centralEvent}——一个案件如何照见一个人的精神。`;
}

function buildCharacterInvolved(protagonist: string, entry: EntryDetail, centralEvent: string, region: string): string {
  return `${protagonist}到任${region}。他的职责是什么？他为什么必须面对${centralEvent}这个选择？新官上任，案卷堆在桌面，命运就这样把他推到了风口浪尖。`;
}

function buildHistoricalEcho(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}的后续影响：${entry.culturalSignificance?.substring(0, 80) ?? `${protagonist}的${centralEvent}在历史上留下了什么痕迹`}。这个事件不只是个人抉择，更是一种精神的印记。`;
}

function buildRealityIntro(centralEvent: string, entry: EntryDetail, region: string): string {
  return `今天，${region}仍能找到${centralEvent}的遗迹与痕迹。走进${region}，历史的风声还在耳边。这是一个关于${entry.name.split('——')[0]}和${centralEvent}的故事。`;
}

function buildHistoricalRetrospect(protagonist: string, entry: EntryDetail, centralEvent: string, region: string): string {
  return `据史料记载，${protagonist}在${region}${centralEvent}。${entry.story.substring(0, 60).replace(/\*\*/g, '').split(/[。]/)[0]}。这不是传说，而是有据可查的真实事件。`;
}

function buildKeyNode(protagonist: string, centralEvent: string, details: string, quote: string): string {
  return `${protagonist}${centralEvent}——${details || '关键时刻的具体经过'}${quote ? `。核心对白："${quote}"` : ''}`;
}

function buildCultureExplanation(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}照见什么精神？公正、廉洁、良知、担当——${protagonist}的选择不是权势的计算，而是道德的自觉。${entry.culturalSignificance?.substring(0, 60) ?? '这种精神成为文化传承的一部分'}`;
}

function buildContemporaryMeaning(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `今天，${protagonist}${centralEvent}的精神仍在传承。${entry.culturalSignificance?.substring(0, 60) ?? '公正与良知的坚守，在任何时代都不会过时'}`;
}

function buildProposeTheme(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `核心观点：${centralEvent}照见${protagonist}的精神——${entry.culturalSignificance?.substring(0, 40).split(/[。]/)[0] ?? '公正与良知'}。让我们从这个案例开始，理解这种精神的深刻内涵。`;
}

function buildTellFacts(protagonist: string, centralEvent: string, details: string): string {
  return `${protagonist}${centralEvent}——${details || '事实经过'}。这不是虚构的故事，而是有史料记载的真实选择。`;
}

function buildAnalyzeSpirit(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}照见三种精神：不畏权势的公正、出淤泥而不染的廉洁、守正不阿的担当。${entry.culturalSignificance?.substring(0, 60) ?? `${protagonist}的选择，是精神力量的具体体现`}`;
}

function buildConnectPresent(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `${protagonist}${centralEvent}的精神，在今天如何传承？公正不是口号，廉洁不是标签，担当不是姿态——是需要像${protagonist}那样，在压力下做出的具体选择。`;
}

function buildCallToAction(protagonist: string, centralEvent: string, quote: string): string {
  return `${quote || `"${centralEvent}"`}——传承这种精神，坚守正道。让${protagonist}的选择，照亮每一个面对压力的人。`;
}

function buildChildProtagonist(protagonist: string, entry: EntryDetail, region: string): string {
  const simpleName = protagonist.length <= 3 ? protagonist : protagonist.substring(0, 3);
  return `${simpleName}是一个年轻的官员，刚到${region}上任。他有正义感，好奇心强，愿意认真看每一份文件。他不像其他人那样急着完成任务，他想知道真相。`;
}

function buildChildProblem(protagonist: string, centralEvent: string): string {
  return `${protagonist}发现一个问题：有一个人不该被惩罚，但上面的人要惩罚他。${protagonist}翻看资料，发现证据不对——这个人是冤枉的！`;
}

function buildChildGrowth(protagonist: string, centralEvent: string, details: string): string {
  return `${protagonist}开始认真调查。他翻看案卷、询问别人、想办法帮助那个被冤枉的人。他不怕困难，因为他知道做正确的事很重要。`;
}

function buildChildChoice(protagonist: string, centralEvent: string, quote: string): string {
  return `${protagonist}做出了勇敢的决定：他拒绝做不对的事！${quote ? `他说："${quote}"` : '他说："这样做不对，我不能签字！"'}`;
}

function buildChildEnding(protagonist: string, centralEvent: string): string {
  return `冤枉的人被救了！${protagonist}学到了一个道理：做正确的事有时候很困难，但只要坚持，正义一定能赢。`;
}

function buildShortHook(protagonist: string, centralEvent: string, quote: string): string {
  return `${quote || centralEvent}——${protagonist}${centralEvent}，3秒记住这个名字和这个选择。`;
}

function buildShortKeyInfo(protagonist: string, centralEvent: string): string {
  return `${protagonist}${centralEvent}——谁做了什么选择，什么结果。5秒讲清核心事实。`;
}

function buildShortEmotion(protagonist: string, centralEvent: string, toneAdj: string): string {
  return `${toneAdj}${protagonist}的压力、抉择、坚守——从紧张到感动，画面推情绪。`;
}

function buildShortGoldenQuote(protagonist: string, centralEvent: string, quote: string): string {
  return `${quote || `"吾不为也"`}——${protagonist}${centralEvent}的精神定格。`;
}

// ---------------------------------------------------------------------------
// Legend story builders
// ---------------------------------------------------------------------------

function buildLegendOpening(centralEvent: string, region: string, protagonist: string, entry: EntryDetail): string {
  return `远古${region}，${centralEvent}的传说从这里开始。${entry.story.substring(0, 60).replace(/\*\*/g, '').split(/[。]/)[0]}。这不是历史，而是代代相传的故事。`;
}

function buildSupernaturalPower(centralEvent: string, protagonist: string, entry: EntryDetail): string {
  return `天地异象，超自然的力量介入人间。${protagonist}面对超越人力的事件——${centralEvent}中有天命的指引，也有人力无法掌控的维度。`;
}

function buildHumanTrial(protagonist: string, centralEvent: string, details: string): string {
  return `即使是神话传说，核心是人的选择。${protagonist}面对${centralEvent}的考验——恐惧、犹豫、勇气、信念，凡人的情感在神话中更加真切。${details ? `具体考验：${details}` : ''}`;
}

function buildFateTurning(protagonist: string, centralEvent: string, quote: string, entry: EntryDetail): string {
  return `命运转折——天意与人意的交汇。${protagonist}${centralEvent}，命运看似不可违，但人心的选择才是关键。${quote ? `核心表达："${quote}"` : entry.culturalSignificance?.substring(0, 40) ?? '传说照见了人心的力量'}`;
}

function buildLegendEnduring(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}的传说为何世代传颂？${entry.culturalSignificance?.substring(0, 60) ?? `它照见了某种精神——即使在传说中，也有真实的情感和信念`}。传说不灭，精神永存。`;
}

// ---------------------------------------------------------------------------
// Culture promo builders
// ---------------------------------------------------------------------------

function buildSymbolOpening(entry: EntryDetail, region: string): string {
  const topKeywords = entry.keywords.slice(0, 3).join('、');
  return `${region}，${topKeywords}——最具代表性的文化符号。不用言语，先让画面说话。光影、质感、氛围，文化的视觉入口。`;
}

function buildCultureRoots(entry: EntryDetail, centralEvent: string): string {
  return `这种文化从何而来？${entry.culturalSignificance?.substring(0, 80) ?? `${centralEvent}的历史渊源`}。文化不是凭空而生，它有根基、有土壤、有精神源头。`;
}

function buildCraftDisplay(entry: EntryDetail, centralEvent: string, details: string): string {
  const keywords = entry.keywords.slice(0, 3).join('、');
  return `${keywords}——技艺的核心展示。手的动作、材料的质感、工具的声音。${details ? `具体步骤：${details}` : `从原料到成品，每一步都是匠心`}。画面要有微距和慢动作。`;
}

function buildModernInheritance(entry: EntryDetail, protagonist: string): string {
  const culturalSignificance = entry.culturalSignificance?.substring(0, 60) ?? '';
  return `传统如何在现代延续？${culturalSignificance || `${entry.name}在新一代手中继续传承`}。不是博物馆里的标本，而是活在当下的生命力。`;
}

function buildSloganClose(entry: EntryDetail, protagonist: string, quote: string): string {
  const coreMessage = entry.culturalSignificance?.split(/[。]/)[0]?.substring(0, 30) ?? entry.type;
  return `${quote || `${coreMessage}——文化精神最凝练的表达`}。画面定格，精神定格。`;
}

// ---------------------------------------------------------------------------
// Heritage promo builders
// ---------------------------------------------------------------------------

function buildHeritageOrigin(entry: EntryDetail, centralEvent: string, region: string): string {
  return `${region}，${centralEvent}的非遗技艺起源。${entry.story.substring(0, 50).replace(/\*\*/g, '').split(/[。]/)[0]}。这不是技艺的消亡史，而是技艺的诞生记。`;
}

function buildArtisanEntrance(protagonist: string, entry: EntryDetail, region: string): string {
  return `${protagonist}——${entry.type}的传承人。他在${region}做了几十年，手上是岁月刻下的痕迹。不只是"传承人"的标签，而是他本人与技艺的情感联结。`;
}

function buildCraftProcess(entry: EntryDetail, details: string): string {
  const keywords = entry.keywords.slice(0, 3).join('→');
  return `完整工艺流程：${keywords}。${details || '从原料准备到成品检验，每一步都要精准'}。要有步骤感——手的动作、材料的反应、时间的痕迹。`;
}

function buildCraftSpirit(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  const spirit = entry.culturalSignificance?.substring(0, 50) ?? '精益求精、物我合一';
  return `技艺不只是技术。${centralEvent}照见的精神：${spirit}。${protagonist}的手不只在做东西，更在传承一种信念。`;
}

function buildInheritancePath(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `传承的现实——年轻人不愿学、市场萎缩、技艺可能消亡。但也有人接过担子。${protagonist}的${centralEvent}不是终点，而是接力棒。传承之路，还在继续。`;
}

// ---------------------------------------------------------------------------
// City brand promo builders
// ---------------------------------------------------------------------------

function buildLandmarkOpening(entry: EntryDetail, region: string): string {
  return `${region}——城市的标志性空间。不只是建筑外观，更是光影、声音、人活动的总和。走进这个空间，感受它的呼吸。`;
}

function buildCityHistory(entry: EntryDetail, centralEvent: string, protagonist: string): string {
  return `${entry.region}的历史纵深——${protagonist}${centralEvent}，不是抽象概述而是具体故事。历史活在今天，不只是教科书上的年份。`;
}

function buildCityCulture(entry: EntryDetail, region: string): string {
  const keywords = entry.keywords.slice(0, 3).join('、');
  return `${region}的地方文化——${keywords}。方言、饮食、习俗、技艺，每一项都是这座城市的DNA。要有烟火气，不是空镜堆砌。`;
}

function buildCityLife(entry: EntryDetail, region: string): string {
  return `生活在这座城市的人——他们的日常、情感、节奏。${region}不只是景点，更是生活空间。清晨的早餐摊、傍晚的散步人、深夜的灯火。`;
}

function buildBrandClose(entry: EntryDetail, region: string): string {
  const core = entry.culturalSignificance?.split(/[。]/)[0]?.substring(0, 30) ?? entry.type;
  return `${core}——${region}最核心的气质表达。画面定格+文字叠加。不是口号，而是城市灵魂的凝练。`;
}

// ---------------------------------------------------------------------------
// Scene short builders
// ---------------------------------------------------------------------------

function buildSpaceIntro(entry: EntryDetail, region: string): string {
  return `走进${region}——光线、声音、气味、质感。不只是地名，而是空间的氛围。让观众"走进"这个空间，感受它的气息。`;
}

function buildSceneNarrative(protagonist: string, centralEvent: string, details: string, entry: EntryDetail): string {
  return `在这个空间中发生了什么——${protagonist}${centralEvent}。叙事要简短但具体：${details || entry.story.substring(0, 60).replace(/\*\*/g, '').split(/[。]/)[0]}。不是空镜，而是有故事的空间。`;
}

function buildTimeOverlay(entry: EntryDetail, centralEvent: string, protagonist: string): string {
  const culturalDepth = entry.culturalSignificance?.substring(0, 50) ?? '';
  return `同一个空间在不同时间的故事——古人与今人、旧貌与新颜。${protagonist}${centralEvent}的痕迹，与今天的生活叠印。${culturalDepth || '时间的深度让空间有了灵魂'}`;
}

function buildMoodClose(entry: EntryDetail, region: string): string {
  return `${region}的精神——不是故事的结局，而是空间本身。一个画面，一句旁白。留白收束。`;
}

// ---------------------------------------------------------------------------
// Landscape mood builders
// ---------------------------------------------------------------------------

function buildLandscapeOpening(entry: EntryDetail, region: string): string {
  return `${region}——山、水、云、雾、光影。没有人物、没有叙事。只有自然本身的美与气息。画面要美，节奏要慢。`;
}

function buildMoodFlow(entry: EntryDetail, region: string): string {
  const keywords = entry.keywords.filter(k => ['山', '水', '云', '雾', '日', '月', '风', '雨', '春', '夏', '秋', '冬'].some(w => k.includes(w)));
  const moodWords = keywords.length > 0 ? keywords.join('→') : '晨昏→四季→风雨→晴雾';
  return `意境在时间中流变——${moodWords}。同一个山水在不同状态下的美感。纯视觉诗，没有解释性旁白。`;
}

function buildSpiritEssence(entry: EntryDetail, region: string): string {
  const core = entry.culturalSignificance?.substring(0, 30)?.split(/[。]/)[0] ?? '山水灵韵';
  return `${core}——山水的精神不是"资源"，而是灵韵。一句话定格。画面要有留白。`;
}

// ---------------------------------------------------------------------------
// Explainer video builders
// ---------------------------------------------------------------------------

function buildPoseQuestion(centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}——为什么这件事值得关注？${entry.type === '非遗' ? '这种技艺为什么能千年传承？' : entry.type === '名胜古迹' ? '这个地方为什么成为文化地标？' : '这段历史为什么被记住？'}`;
}

function buildConceptExplain(centralEvent: string, entry: EntryDetail): string {
  const keywords = entry.keywords.slice(0, 3).join('、');
  return `核心概念：${keywords}。用类比和对比让复杂变简单——${entry.summary?.substring(0, 60) ?? centralEvent}。每个概念只讲一个要点。`;
}

function buildCaseEvidence(protagonist: string, centralEvent: string, details: string): string {
  return `具体案例：${protagonist}${centralEvent}。${details || '不是抽象论证，而是有真实的人物、事件、地点作为例证'}。案例要简短有力，直击要点。`;
}

function buildLogicDeepen(centralEvent: string, entry: EntryDetail): string {
  const culturalSig = entry.culturalSignificance?.substring(0, 60) ?? '';
  return `不只是"是什么"——${centralEvent}意味着什么？${culturalSig || '深层原理和延伸思考'}。从现象到本质，逻辑递进。`;
}

function buildSummary(centralEvent: string, entry: EntryDetail): string {
  return `要点归纳：${entry.keywords.slice(0, 3).join('·')}——${centralEvent}的核心启示。用最简洁的语言重述核心要点。`;
}

// ---------------------------------------------------------------------------
// Education/training builders
// ---------------------------------------------------------------------------

function buildLearningObjective(centralEvent: string, entry: EntryDetail): string {
  return `学习目标：学完本节，你能掌握${centralEvent}的3个核心要点——${entry.keywords.slice(0, 3).join('、')}。目标具体可衡量。`;
}

function buildKnowledgeTeach(centralEvent: string, entry: EntryDetail): string {
  return `核心知识讲解——${centralEvent}的要点1：${entry.keywords[0] ?? centralEvent}。要点2：${entry.keywords[1] ?? '文化背景'}。要点3：${entry.keywords[2] ?? '现实意义'}。结构化、分步骤、有逻辑。`;
}

function buildDemonstration(protagonist: string, centralEvent: string, details: string): string {
  return `示范演示——${protagonist}${centralEvent}的操作流程。${details || '从准备到执行到检验，每一步都有标注和要点提示'}。`;
}

function buildPracticeGuide(centralEvent: string): string {
  return `练习引导——基于${centralEvent}的思考题：这个事件照见了什么精神？在当代如何体现？让观众主动参与，不只是被动接受。`;
}

function buildAssessment(centralEvent: string, entry: EntryDetail): string {
  return `知识检验——${centralEvent}的核心知识点回顾：${entry.keywords.slice(0, 3).join('、')}。你是否达到了学习目标？`;
}

function buildExtendedSummary(centralEvent: string, entry: EntryDetail): string {
  return `总结拓展——${centralEvent}的要点归纳+延伸方向：${entry.type}相关的其他内容、参考资料、进阶学习路径。`;
}

// ---------------------------------------------------------------------------
// Other scene field builders
// ---------------------------------------------------------------------------

function buildSceneConflict(template: SceneTemplate, centralEvent: string, protagonist: string, paragraphs: string[]): string {
  const conflictMap: Record<string, string> = {
    '钩子开场': `悬念开场：${centralEvent}的危机是什么？`,
    '主角处境': `${protagonist}的身份与职责 vs 制度/权力压力`,
    '冲突升级': `个人良知 vs 权力要求——签字还是拒签？`,
    '关键行动': `${protagonist}做出选择——采取行动`,
    '高潮': `${centralEvent}的核心冲突爆发——正面交锋`,
    '结尾': `良知坚守 vs 权势得失——精神落点`,
    '时代危机': `时代压迫 vs 个人良知`,
    '人物卷入': `职责要求 vs 个人判断`,
    '历史余响': `短期得失 vs 长期精神`,
  };
  return conflictMap[template.function_label] ?? `${centralEvent}——${protagonist}的抉择`;
}

function buildDialogueOrNarration(template: SceneTemplate, centralEvent: string, quotes: string[], protagonist: string, paragraphs: string[], videoType: VideoType): string {
  // For dramatic video types, extract actual dialogue
  if (['character_story', 'historical_drama', 'ai_comic_drama'].includes(videoType)) {
    // Find quotes in paragraphs related to this scene's function
    if (template.function_label === '高潮' && quotes.length > 0) {
      return `核心台词："${quotes[0]}"`;
    }
    if (template.function_label === '关键行动') {
      return `${protagonist}："此案有疑，我不能签字。"`;
    }
    if (template.function_label === '钩子开场') {
      return `旁白：${centralEvent}——这不是传说，而是真实发生过的选择。`;
    }
  }

  // For documentary, use narrator style
  if (videoType === 'documentary_short') {
    return `旁白：${centralEvent}的经过，据史料记载……`;
  }

  // For lecture, use presenter style
  if (videoType === 'lecture_video') {
    return `主讲人：${centralEvent}照见了什么精神？`;
  }

  // For children story, use simple narration
  if (videoType === 'children_story') {
    return `${protagonist}：这样做不对，我不能签字！`;
  }

  // Default: narration
  return `${protagonist}面对${centralEvent}的选择——这是他人生的关键时刻。`;
}

function buildKeyAction(template: SceneTemplate, protagonist: string, centralEvent: string): string {
  const actionMap: Record<string, string> = {
    '钩子开场': `进入危机现场`,
    '主角处境': `认清处境与选择压力`,
    '冲突升级': `面对两难，压力加深`,
    '关键行动': `${protagonist}做出关键选择——拒签/断案/抗命`,
    '高潮': `核心冲突爆发，说出关键台词`,
    '结尾': `精神落点——守住良知`,
    '时代危机': `建立时代危机背景`,
    '人物卷入': `${protagonist}卷入事件中心`,
    '历史余响': `展示历史影响`,
  };
  return actionMap[template.function_label] ?? `${protagonist}${centralEvent}`;
}

function buildVisualPrompt(template: SceneTemplate, location: string, timeOfDay: string, centralEvent: string, protagonist: string, entry: EntryDetail, tone: string): string {
  const toneModifier = tone ? `，${tone}氛围` : '';
  const keywords = entry.keywords.slice(0, 3).join('、');

  const visualMap: Record<string, string> = {
    '钩子开场': `${location}，${timeOfDay}。烛火/文书/案卷/判词——核心画面是${centralEvent}的紧张开场${toneModifier}`,
    '主角处境': `${location}，${protagonist}面对案卷/文书。中景展示人物与处境${toneModifier}`,
    '冲突升级': `近景切换——${protagonist}的表情变化+案卷细节+对方施压${toneModifier}`,
    '关键行动': `${protagonist}做出行动——翻案卷/拒签字/拿起文书。动作细节凸显${toneModifier}`,
    '高潮': `特写——${protagonist}说出核心台词/做出核心动作。情绪最高点${toneModifier}`,
    '结尾': `远景拉远——${location}全景，${keywords}构成精神象征${toneModifier}`,
  };

  return visualMap[template.function_label] ?? `${location}，${timeOfDay}，${keywords}${toneModifier}`;
}

function determineSceneCharacters(template: SceneTemplate, characterNames: string[], protagonist: string): string[] {
  const allChars = [protagonist];
  if (['冲突升级', '关键行动', '高潮'].includes(template.function_label) && characterNames.length > 1) {
    allChars.push(characterNames[1]);
  }
  if (template.function_label === '结尾' && characterNames.length > 2) {
    allChars.push(characterNames[2]);
  }
  return allChars.slice(0, 4);
}

function buildSceneCulturalNote(entry: EntryDetail, centralEvent: string, template: SceneTemplate): string {
  // Find relevant unverified points
  const relevantPoints = entry.unverifiedPoints.filter(p =>
    centralEvent.includes(p.substring(0, 4)) || p.includes(centralEvent.substring(0, 4))
  );
  if (relevantPoints.length > 0) return relevantPoints[0];
  return `本场景基于${entry.name}知识库条目，具体细节请核实来源`;
}

function determineFictionalizedElements(template: SceneTemplate, videoType: VideoType): string[] {
  const elements: string[] = [];
  // All dramatic video types add cinematic treatment
  if (['character_story', 'historical_drama', 'ai_comic_drama', 'children_story'].includes(videoType)) {
    elements.push('场景调度和氛围为影视化创作处理');
    if (template.function_label === '钩子开场') {
      elements.push('开场画面为戏剧化设计，非史实记载');
    }
    if (template.function_label === '高潮') {
      elements.push('对白节奏为影视化强化，史实可能有差异');
    }
  }
  return elements;
}

// ---------------------------------------------------------------------------
// Build full_text from scene plots
// ---------------------------------------------------------------------------

function buildFullText(
  parts: string[],
  scenes: StoryScene[],
  protagonist: string,
  centralEvent: string,
  entry: EntryDetail,
  videoType: VideoType,
): string {
  // full_text = narrative paragraphs composed from scene plots
  // NOT entry.story directly

  if (videoType === 'documentary_short' || videoType === 'lecture_video') {
    // For documentary/lecture, use a different narration style
    return parts.join('\n\n');
  }

  // For dramatic types, compose as a continuous narrative
  // Add transitions between scenes
  const transitions: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      // Add transition based on scene progression
      const prevFunc = scenes[i - 1].dramatic_function;
      const currFunc = scenes[i].dramatic_function;
      if (currFunc === '高潮') {
        transitions.push('但局面没有缓和——');
      } else if (currFunc === '结尾') {
        transitions.push('最终——');
      } else if (currFunc === '关键行动') {
        transitions.push('面对这样的压力——');
      } else {
        transitions.push('');
      }
    }
  }

  const fullTextParts: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const transition = transitions[i] ?? '';
    fullTextParts.push(transition + parts[i]);
  }

  return fullTextParts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Generate GEARS segments from dramatic scenes
// ---------------------------------------------------------------------------

function generateDramaticGearsSegments(
  scenes: StoryScene[],
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): GearsSegment[] {
  const vtMeta = VIDEO_TYPE_CONFIG[videoType];
  const psMeta = PRESENTATION_STYLE_CONFIG[presentationStyle];

  return scenes.map((scene) => {
    const panelCount = PANEL_COUNT_BY_DURATION[scene.duration_sec] ?? 6;

    // NEW script_text format: cinematic script, not template concatenation
    const scriptText = buildGearsScriptText(scene, videoType);

    const visualFocus = [
      scene.location,
      ...scene.visual_prompt.split(/[，、。]/).filter(s => s.length > 1 && s.length < 8).slice(0, 2),
    ];

    const segmentPromptHint = `${vtMeta.label}/${psMeta.label}风格提示: ${psMeta.description}，场景${scene.scene_id}聚焦${scene.key_action}`;

    return {
      segment_id: scene.scene_id,
      source_scene_id: scene.scene_id,
      duration_sec: scene.duration_sec,
      panel_count: panelCount,
      script_text: scriptText,
      purpose: scene.dramatic_function,
      visual_focus: visualFocus.slice(0, 3),
      cultural_constraints: scene.cultural_note ? [scene.cultural_note] : [],
      video_type: videoType,
      presentation_style: presentationStyle,
      segment_prompt_hint: segmentPromptHint,
    };
  });
}

function buildGearsScriptText(scene: StoryScene, videoType: VideoType): string {
  // Build a cinematic script text, NOT the old template format
  // Format: location, time. scene description. character action. emotion. dialogue/narration fragment.

  const parts: string[] = [];

  // Location + time
  parts.push(`${scene.location}，${scene.time_of_day}。`);

  // Scene visual description (from plot, simplified for GEARS)
  const plotShort = scene.plot.length > 80 ? scene.plot.substring(0, 80) + '…' : scene.plot;
  parts.push(plotShort);

  // Dialogue/narration if available
  if (scene.dialogue_or_narration) {
    parts.push(scene.dialogue_or_narration);
  }

  // For ai_comic_drama, add panel-specific hints
  if (videoType === 'ai_comic_drama') {
    parts.push(`[分镜${scene.scene_id}: ${scene.camera_suggestion}]`);
  }

  return parts.join('');
}

// ---------------------------------------------------------------------------
// Build supporting structures (characters, act_structure, protagonist_arc)
// ---------------------------------------------------------------------------

function buildCharacters(characterNames: string[], protagonist: string, entry: EntryDetail, centralEvent: string): StoryCharacter[] {
  const chars: StoryCharacter[] = [
    { name: protagonist, role: 'protagonist', description: `主角，${entry.name}——面对${centralEvent}做出关键选择`, arc: '' },
  ];
  for (let i = 1; i < characterNames.length; i++) {
    const name = characterNames[i];
    chars.push({
      name,
      role: i === 1 ? 'antagonist' : 'supporting',
      description: `${centralEvent}中的${i === 1 ? '对立面' : '辅助角色'}`,
    });
  }
  return chars.slice(0, 6);
}

function buildActStructure(scenes: StoryScene[]): ActBeat[] {
  if (scenes.length === 0) return [];
  const acts: ActBeat[] = [];
  const actMap: Record<string, number[]> = {};
  for (const s of scenes) {
    if (!actMap[s.dramatic_function]) actMap[s.dramatic_function] = [];
    actMap[s.dramatic_function].push(s.scene_id);
  }

  let actNum = 1;
  for (const func of Object.keys(actMap)) {
    const ids = actMap[func];
    if (ids && ids.length > 0) {
      acts.push({ act: actNum, beat: func, scene_ids: ids, purpose: func });
      actNum++;
    }
  }
  return acts;
}

function buildProtagonistArc(protagonist: string, scenes: StoryScene[], centralEvent: string, entry: EntryDetail): ProtagonistArc[] {
  return [{
    starting_state: `面对${centralEvent}时的压力与困境`,
    turning_point: centralEvent,
    resolution: '守住良知，做出正义选择',
  }];
}

// ---------------------------------------------------------------------------
// Build cultural constraints and credibility note
// ---------------------------------------------------------------------------

function buildCulturalConstraints(entry: EntryDetail, knowledgePack?: KnowledgePack): string[] {
  const constraints: string[] = [];

  if (entry.credibility === '存疑') constraints.push('条目整体可信度存疑，需大量核实方可用于创作');
  if (entry.credibility === '待核实') constraints.push('条目可信度待核实，核心情节可能缺乏佐证');
  for (const point of entry.unverifiedPoints) constraints.push(`待核实：${point}`);

  // Missing needs from knowledge_pack
  if (knowledgePack?.missing_needs) {
    for (const missing of knowledgePack.missing_needs) {
      constraints.push(`知识库缺失：${missing.label}——${missing.message}`);
    }
  }

  return constraints;
}

function buildCredibilityNote(entry: EntryDetail, knowledgePack?: KnowledgePack, originalUserQuery?: string, centralEvent?: string): string {
  let note = entry.credibility;

  // Add what comes from knowledge base vs what is creative treatment
  note += `；核心事件"${centralEvent}"来自知识库条目"${entry.name}"`;

  // Note creative elements
  note += '；场景调度、对白节奏、画面设计为影视化创作处理';

  // Note user query if present
  if (originalUserQuery) {
    note += `；用户创作主题"${originalUserQuery}"中的部分表达未在知识库中验证，已按创作方向处理`;
  }

  // Note knowledge_pack sourcing
  if (knowledgePack?.primary_entries && knowledgePack.primary_entries.length > 0) {
    note += `；主依据条目：${knowledgePack.primary_entries.map(e => e.entry_name).join('、')}`;
  }
  if (knowledgePack?.supporting_entries && knowledgePack.supporting_entries.length > 0) {
    note += `；辅助条目：${knowledgePack.supporting_entries.map(e => e.entry_name).join('、')}`;
  }
  if (knowledgePack?.missing_needs && knowledgePack.missing_needs.length > 0) {
    note += '；缺失资料仅作为创作方向，不可写成已验证史实';
  }

  return note;
}

// ---------------------------------------------------------------------------
// Generate logline and theme
// ---------------------------------------------------------------------------

function generateLogline(entry: EntryDetail, centralEvent: string, videoType: VideoType): string {
  const protagonist = entry.name.split('——')[0].trim();
  const region = entry.region || '';

  if (centralEvent.includes('拒签')) {
    return `${region}，${protagonist}${centralEvent}——一份死刑文书面前，他选择了良知而非权势。`;
  }
  return `${protagonist}${centralEvent}——${entry.summary.substring(0, 40)}…`;
}

function generateTheme(entry: EntryDetail, centralEvent: string, videoType: VideoType): string {
  const vtLabel = VIDEO_TYPE_CONFIG[videoType]?.label ?? videoType;
  return `${vtLabel} × ${entry.type}——${centralEvent}`;
}

// ---------------------------------------------------------------------------
// Story quality validation
// ---------------------------------------------------------------------------

export function validateDramaticStory(result: {
  full_text: string;
  scene_breakdown: StoryScene[];
  title: string;
  selectedEvent?: string;
}): StoryQualityReport {
  const issues: string[] = [];
  const fullText = result.full_text;
  const scenes = result.scene_breakdown;

  // 1. hasCentralEvent
  const hasCentralEvent = result.selectedEvent !== '整体故事'
    && result.selectedEvent !== undefined
    && !result.selectedEvent.includes('一生')
    && !result.selectedEvent.includes('生平');
  if (!hasCentralEvent) issues.push('缺少核心事件——标题为"整体故事"或人物一生概述');

  // 2. hasConflict — at least one scene has conflict with confrontation/choice words
  const conflictWords = ['拒', '争', '抗', '逼', '选择', '两难', '拒签', '冲突', '对决', '争辩'];
  const hasConflict = scenes.some(s =>
    (s.conflict ?? '') && conflictWords.some(w => (s.conflict ?? '').includes(w))
  ) || conflictWords.some(w => fullText.includes(w));
  if (!hasConflict) issues.push('缺少明确冲突——没有对抗、选择或两难');

  // 3. hasProtagonistChoice — at least one key_action has choice words
  const choiceWords = ['选择', '拒签', '断案', '拒', '辞', '定', '决', '坚持'];
  const hasProtagonistChoice = scenes.some(s =>
    choiceWords.some(w => s.key_action.includes(w) || s.plot.includes(w))
  );
  if (!hasProtagonistChoice) issues.push('缺少主角选择——没有明确的选择行为');

  // 4. hasSceneAction — scenes >= 3 and plots have action descriptions
  const hasSceneAction = scenes.length >= 3 && scenes.every(s => s.plot.length >= 20);
  if (!hasSceneAction) issues.push('场景缺少具体行动描述');

  // 5. hasClimax — at least one scene with dramatic_function = "高潮"
  const hasClimax = scenes.some(s =>
    s.dramatic_function === '高潮'
    || s.dramatic_function === '高燃收束'
    || s.dramatic_function === '金句落点'
  );
  if (!hasClimax) issues.push('缺少高潮场景');

  // 6. hasEndingTheme — last scene mentions spiritual/moral/value theme.
  // Revolutionary and coming-of-age stories often land on "理想/信仰/人民/道路/觉醒"
  // instead of explicit moral words such as "道德".
  const themeWords = [
    '良知', '精神', '道德', '价值', '正义', '廉洁', '担当', '坚守', '传承', '出淤泥而不染',
    '理想', '信仰', '人民', '道路', '觉醒', '初心', '使命', '家国', '民族', '奋斗', '求索',
    '牺牲', '独立自主', '实事求是', '敢为天下先',
  ];
  const lastScene = scenes[scenes.length - 1];
  const lastSceneText = lastScene
    ? [
        lastScene.title,
        lastScene.dramatic_function,
        lastScene.plot,
        lastScene.key_action,
        lastScene.cultural_note,
      ].filter(Boolean).join(' ')
    : '';
  const hasEndingTheme = lastScene && themeWords.some(w =>
    lastSceneText.includes(w) || fullText.includes(w) || result.title.includes(w)
  );
  if (!hasEndingTheme) issues.push('缺少结尾主题——没有精神/道德落点');

  // 7. isNotBiographySummary — full_text doesn't have 3+ year-starting paragraphs
  const yearPattern = /^(?:公元|前)?\d{3,4}年/;
  const paragraphs = fullText.split(/\n\n+/);
  const yearParagraphs = paragraphs.filter(p => yearPattern.test(p.trim()));
  const isNotBiographySummary = yearParagraphs.length < 3;
  if (!isNotBiographySummary) issues.push('full_text是生平年表——超过3个年份开头段落');

  const passed = hasCentralEvent && hasConflict && hasProtagonistChoice && hasSceneAction && hasClimax && hasEndingTheme && isNotBiographySummary;

  return {
    hasCentralEvent,
    hasConflict,
    hasProtagonistChoice,
    hasSceneAction,
    hasClimax,
    hasEndingTheme,
    isNotBiographySummary,
    passed,
    issues,
  };
}
