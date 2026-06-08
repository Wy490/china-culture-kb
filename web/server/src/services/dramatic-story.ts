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

function extractQuotes(storyText: string): string[] {
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

  // 6. hasEndingTheme — last scene mentions spiritual/moral/value theme
  const themeWords = ['良知', '精神', '道德', '价值', '正义', '廉洁', '担当', '坚守', '传承', '出淤泥而不染'];
  const lastScene = scenes[scenes.length - 1];
  const hasEndingTheme = lastScene && themeWords.some(w =>
    lastScene.plot.includes(w) || fullText.includes(w)
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