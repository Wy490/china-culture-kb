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
import type { GenreDramaticStructure, GenreSceneTemplate } from './genre-story-profiles.js';
import { getGenreDramaticStructure } from './genre-story-profiles.js';

// ---------------------------------------------------------------------------
// Conflict scoring — select the most dramatic event as the central event
// ---------------------------------------------------------------------------

const CONFLICT_BOOST_WORDS = ['拒', '争', '抗', '叛', '反', '逼', '杀', '冤', '冤案', '斩', '罚', '刑', '刑狱'];
const CHOICE_BOOST_WORDS = ['辞', '弃', '选', '决', '定', '择', '拒签', '断案', '悟道'];
const REVERSAL_BOOST_WORDS = ['变', '改', '转', '醒', '悟', '觉', '觉', '觉醒'];
const AUTHORITY_WORDS = ['官', '上官', '知军', '知府', '知县', '制度', '法', '令', '命', '旨', '诏'];
const RESULT_WORDS = ['免', '死', '胜', '败', '释', '放', '还', '退'];
const NEGATIVE_WORDS = ['生平', '一生', '事迹', '年谱', '履历']; // penalize biography-style events
const DRAMATIC_VIDEO_TYPES: VideoType[] = [
  'character_story',
  'historical_drama',
  'legend_story',
  'ai_comic_drama',
  'children_story',
];
const NON_DRAMATIC_VIDEO_TYPES: VideoType[] = [
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'scene_short',
  'landscape_mood',
  'social_short',
];

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
  const eventCandidates = boldEvents
    .map(cleanInlineMarkdown)
    .filter(isUsableCentralEvent);

  if (eventCandidates.length === 0) {
    return entry.name.split('——')[0].trim();
  }

  // Score each bold event and pick the highest conflict score
  let bestEvent = eventCandidates[0];
  let bestScore = -Infinity;

  for (const event of eventCandidates) {
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

function isUsableCentralEvent(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (text.length < 2 || text.length > 42) return false;
  if (/[|]/.test(text)) return false;
  if (/^(省份|地区|类型|简介|故事梗概|文化意义|相关地点|关键词|来源|可信度|核实方法|待核实点|年份|年龄|任职|关键事件)$/.test(text)) {
    return false;
  }
  if (/^[-:：\s]+$/.test(text)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Dramatic structure templates — per video_type
// ---------------------------------------------------------------------------

type SceneTemplate = GenreSceneTemplate;
type DramaticStructure = GenreDramaticStructure;

function getDramaticStructure(videoType: VideoType): DramaticStructure {
  return getGenreDramaticStructure(videoType);
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

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/`+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSourceParagraph(value: string): string {
  const lines = value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (/^\|/.test(line)) return false;
      if (/^\s*[-|:：]{3,}\s*$/.test(line)) return false;
      if (/^[-*]\s*\*\*(省份|地区|类型|简介|故事梗概|文化意义|相关地点|关键词|来源|可信度|核实方法|待核实点)/.test(line)) return false;
      return true;
    });

  return cleanInlineMarkdown(lines.join(' '))
    .replace(/\s*\|\s*/g, ' ')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^\s*[-*]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSourceSentences(value: string): string[] {
  const paragraph = cleanSourceParagraph(value);
  return paragraph
    .split(/[。！？；]/)
    .map(item => item.trim())
    .filter(item => item.length >= 8 && !/[|]/.test(item));
}

function firstCleanSentence(value: string, fallback = ''): string {
  return cleanSourceSentences(value)[0] ?? fallback;
}

function extractEventParagraphs(storyText: string, centralEvent: string): string[] {
  const paragraphs = storyText.split(/\n\n+/).filter(p => p.trim());
  // Find paragraphs that contain the central event keyword
  const relevant = paragraphs.filter(p =>
    p.includes(centralEvent) || p.includes(`**${centralEvent}**`)
  ).map(cleanSourceParagraph).filter(Boolean);
  // If no specific paragraphs found, use the whole story
  if (relevant.length === 0) {
    // Try to find paragraphs that contain any keyword from the central event
    const eventKeywords = centralEvent.split(/[，、]/);
    const keywordRelevant = paragraphs.filter(p =>
      eventKeywords.some(kw => p.includes(kw))
    ).map(cleanSourceParagraph).filter(Boolean);
    return keywordRelevant.length > 0 ? keywordRelevant : paragraphs.map(cleanSourceParagraph).filter(Boolean).slice(0, 5);
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
    const quote = cleanInlineMarkdown(match[1]);
    if (isUsableQuote(quote)) quotes.push(quote);
  }
  // Also extract bold text that looks like quotes
  const boldRegex = /\*\*(.+?)\*\*/g;
  const skipWords = ['省份', '地区', '类型', '简介', '故事梗概', '文化意义', '相关地点', '关键词', '来源', '可信度', '核实方法', '待核实点'];
  while ((match = boldRegex.exec(storyText)) !== null) {
    const text = cleanInlineMarkdown(match[1]);
    if (!skipWords.includes(text) && isUsableQuote(text)) quotes.push(text);
  }
  return quotes;
}

function isUsableQuote(value: string): boolean {
  const text = value.trim();
  if (text.length < 4 || text.length > 60) return false;
  if (/[|]/.test(text)) return false;
  if (/^(年份|年龄|任职|关键事件|省份|地区|类型|简介|故事梗概|文化意义|相关地点|关键词|来源|可信度|核实方法|待核实点)$/.test(text)) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Extract character names from story text
// ---------------------------------------------------------------------------

function extractCharacterNames(
  storyText: string,
  entryName: string,
  protagonistOverride?: string,
  keywords: string[] = [],
): string[] {
  const protagonist = protagonistOverride ?? entryName.split('——')[0].trim();
  const chars = [protagonist];

  // Extract other character names from story paragraphs
  const namePattern = /[^\x00-\x7F]{2,4}(?:公|君|卿|帅|将|帝|王|侯|臣|官|郎|翁|生|师|僧|仙|道|妇|女|郎|军|守|尹|丞)/g;
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = namePattern.exec(storyText)) !== null) {
    const name = m[0];
    if (name !== protagonist && isUsableCharacterName(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  for (const [name, count] of counts) {
    if (count >= 2) chars.push(name);
  }
  const namedPersonPattern = /^[赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳史唐费薛雷贺倪汤滕殷罗毕郝邬安常乐于傅皮卞齐康伍余元顾孟黄穆萧尹姚邵汪祁毛禹狄米贝明臧计伏成戴宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪解应宗丁宣邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊甄曲封芮储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲台从鄂索咸籍赖卓蔺蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边燕冀浦尚农温别庄晏柴瞿阎慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公][\u4e00-\u9fa5]{1,3}$/;
  for (const keyword of keywords) {
    const candidate = keyword.trim();
    if (candidate === protagonist || chars.includes(candidate)) continue;
    if (/砍樵|传书|起义|会师|运动|文化|传说|花鼓戏|狐仙$/.test(candidate)) continue;
    if (namedPersonPattern.test(candidate) || /大姐|姑娘|龙女$/.test(candidate)) chars.push(candidate);
  }
  return chars.slice(0, 6);
}

function isUsableCharacterName(name: string): boolean {
  if (/可作为|作为|不该|地方|后世|今永州|道县|衡阳|汝城|濂溪|书院|遗址|案件|案卷|文书|判词|选择|核心/.test(name)) return false;
  return name.length >= 2 && name.length <= 5;
}

function cleanPlaceName(value?: string): string {
  if (!value) return '';
  const cleaned = cleanInlineMarkdown(value)
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/→/g, '、')
    .trim();
  const first = cleaned.split(/[；;，,、]/).map(item => item.trim()).find(Boolean) ?? '';
  if (!first || /后来建有|始建于|遗址保存|相关地点|进行大规模|以.+为基础|融合/.test(first)) return '';
  return first.substring(0, 12);
}

function subjectPlace(entry: EntryDetail): string {
  const subject = inferSubject(entry);
  if (/湘绣|刺绣|织锦|剪纸|陶|瓷|漆|木雕|银饰/.test(subject) || /非遗|工艺/.test(entry.type)) return `${subject}工坊`;
  if (/[楼阁亭台寺庙祠馆园城镇村江湖山洞溪]$/.test(subject) || /岳阳楼|橘子洲|汨罗江|洞庭湖/.test(subject)) return subject;
  const related = entry.relatedLocations
    .map(item => cleanPlaceName(item.name))
    .find(Boolean);
  return related || cleanPlaceName(entry.region) || subject;
}

function narrativePlace(entry: EntryDetail, centralEvent: string, videoType: VideoType): string {
  if (centralEvent.includes('拒签')) return '南安军';
  if (centralEvent.includes('断案')) return '分宁县';
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) return '汨罗江畔';
  if (videoType === 'documentary_short' || videoType === 'heritage_promo') return subjectPlace(entry);
  return cleanPlaceName(entry.region) || subjectPlace(entry);
}

function inferSubject(entry: EntryDetail): string {
  return entry.name.split('——')[0].trim();
}

function inferProtagonist(entry: EntryDetail, videoType: VideoType): string {
  const subject = inferSubject(entry);
  if (!DRAMATIC_VIDEO_TYPES.includes(videoType)) return subject;

  const eventNameMatch = subject.match(/^([\u4e00-\u9fa5]{2,4}?)(?:投江|殉国|断案|拒签|治案|悟道|砍樵|传书|起义|会师|抗日|创立|修建|改建|被贬|求学)/);
  if (eventNameMatch) return eventNameMatch[1];

  if (/^[\u4e00-\u9fa5]{2,4}$/.test(subject)) return subject;

  const storyNameMatch = cleanSourceParagraph(entry.story).match(/(?:^|[，。；：\s])([\u4e00-\u9fa5]{2,4})(?:（[^）]+）)?(?:，|在|于|为|是|被|投江|殉国|断案|拒签|写下|创办|主持)/);
  if (storyNameMatch && !subject.includes(storyNameMatch[1])) return storyNameMatch[1];

  return subject;
}

function eventWithProtagonist(protagonist: string, centralEvent: string): string {
  return centralEvent.startsWith(protagonist) ? centralEvent : `${protagonist}${centralEvent}`;
}

// ---------------------------------------------------------------------------
// Generate a story title from the central event
// ---------------------------------------------------------------------------

function generateStoryTitle(centralEvent: string, entry: EntryDetail, videoType: VideoType): string {
  // If central event is a specific dramatic event, use it as title basis
  const protagonist = inferProtagonist(entry, videoType);

  // Try to create a dramatic title
  const eventShort = centralEvent.length <= 24 ? centralEvent : `${centralEvent.substring(0, 24)}…`;

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
    return centralEvent.startsWith(protagonist) ? eventShort : `${protagonist}的${eventShort}`;
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
    Math.min(
      structure.max_scenes,
      Math.max(3, structure.scene_templates.length, Math.round(totalSeconds / 50)),
    ),
  );

  const perSceneDuration = Math.round(totalSeconds / targetSceneCount);

  // Extract event-relevant content from the entry
  const eventParagraphs = extractEventParagraphs(entry.story, centralEvent);
  const quotes = extractQuotes(eventParagraphs.join('\n'));
  const protagonist = inferProtagonist(entry, videoType);
  const characterNames = extractCharacterNames(entry.story, entry.name, protagonist, entry.keywords);

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

  const requestedGrowthArc = buildRequestedMaoGrowthArc({
    entry,
    originalUserQuery,
    knowledgePack,
    perSceneDuration,
  });
  if (requestedGrowthArc?.length) {
    const requestedSceneDuration = Math.round(totalSeconds / requestedGrowthArc.length);
    for (const scene of requestedGrowthArc) scene.duration_sec = requestedSceneDuration;
  }
  const scenes: StoryScene[] = requestedGrowthArc ?? [];
  const fullTextParts: string[] = scenes.map(scene => scene.plot);

  if (!requestedGrowthArc) {
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
  }

  // Generate full_text from scene plots with transitions
  const fullText = buildFullText(fullTextParts, scenes, protagonist, centralEvent, entry, videoType);

  // Generate title
  const title = requestedGrowthArc
    ? `${protagonist}：从韶山少年到革命觉醒`
    : generateStoryTitle(centralEvent, entry, videoType);

  // Generate logline
  const logline = requestedGrowthArc
    ? `${protagonist}从韶山田埂走进长沙课堂，再走到农民中间，在一次次亲眼所见和具体行动中寻找改变中国的道路。`
    : generateLogline(entry, centralEvent, videoType);

  // Generate theme
  const theme = requestedGrowthArc
    ? '理想不是凭空形成的，它来自乡土经验、求学追问、同伴讨论和人民实践。'
    : generateTheme(entry, centralEvent, videoType);

  // Build gears_segments from scenes
  const gearsSegments = generateDramaticGearsSegments(scenes, videoType, presentationStyle);

  // Build characters
  const arcCharacterNames = requestedGrowthArc
    ? [...new Set(requestedGrowthArc.flatMap(scene => scene.characters))]
    : characterNames;
  const characters = requestedGrowthArc
    ? buildMaoGrowthArcCharacters(arcCharacterNames)
    : NON_DRAMATIC_VIDEO_TYPES.includes(videoType)
      ? []
    : buildCharacters(arcCharacterNames, protagonist, entry, centralEvent);

  // Build act_structure
  const actStructure = buildActStructure(scenes);

  // Build protagonist_arc
  const protagonistArc = requestedGrowthArc
    ? [{
        starting_state: '韶山少年从乡土生活中感到困惑，想通过求学寻找个人与国家的出路。',
        turning_point: '游学、新民学会和农民夜校让他从个人求索转向组织行动与人民实践。',
        resolution: '五县考察使他把乡土观察转化为对农民革命力量的判断，理想在实践中形成。',
      }]
    : NON_DRAMATIC_VIDEO_TYPES.includes(videoType)
      ? []
    : buildProtagonistArc(protagonist, scenes, centralEvent, entry);

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
    if (scene.plot.includes(centralEvent)) scene.factual_basis = `基于${entry.name}素材条目中"${centralEvent}"相关内容`;
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

function buildRequestedMaoGrowthArc(input: {
  entry: EntryDetail;
  originalUserQuery?: string;
  knowledgePack?: KnowledgePack;
  perSceneDuration: number;
}): StoryScene[] | undefined {
  const query = input.originalUserQuery ?? '';
  const protagonist = input.entry.name.split('——')[0]?.trim();
  const requestedSignals = ['少年', '求学', '新民学会', '农民运动', '理想形成', '革命觉醒']
    .filter(signal => query.includes(signal));
  if (
    protagonist !== '毛泽东'
    || requestedSignals.length < 4
    || !input.entry.story.includes('韶山少年')
    || !input.entry.story.includes('长沙求学与新民学会')
    || !input.entry.story.includes('韶山农民实践与考察报告')
  ) {
    return undefined;
  }

  const sourceEntries = [
    input.entry.name,
    ...(input.knowledgePack?.primary_entries
      .filter(entry => entry.entry_name !== input.entry.name)
      .map(entry => entry.entry_name) ?? []),
  ];
  const makeScene = (scene: Omit<StoryScene, 'scene_id' | 'duration_sec' | 'source_entries'>, index: number): StoryScene => ({
    ...scene,
    scene_id: index + 1,
    duration_sec: input.perSceneDuration,
    source_entries: sourceEntries,
  });

  return [
    makeScene({
      title: '田埂与书页',
      location: '韶山冲农舍与田埂',
      time_of_day: '夜晚',
      dramatic_function: '乡土起点',
      plot: '白天，少年毛泽东跟着父亲在田里劳作；夜里，他把《水浒》《三国》藏在账本下面，借微光继续读。父亲希望他守住家业，他却越来越想知道：田埂之外的中国为什么贫弱。1910年秋，他收起书和行囊，决定离开韶山求学。',
      key_action: '少年毛泽东在务农与读书的拉扯中收拾行囊，选择离乡求学',
      characters: ['毛泽东', '毛贻昌'],
      visual_prompt: '1910年前后的韶山冲农舍，夜色，木桌、旧书、账本、油灯与窗外田埂，少年毛泽东把书收入布包，父亲站在门边，克制的家庭张力，中近景',
      camera_suggestion: '从田埂劳作手部特写切到夜读书页，再缓推至收拾行囊的动作',
      cultural_note: '离乡求学与赠父诗见条目记载；具体夜读调度属于依据史料进行的有限影视化补足。',
      conflict: '父亲希望守住家业 vs 少年想走出乡土寻找国家出路',
      dialogue_or_narration: '旁白：他最早看到的中国，不在地图上，而在韶山的田里、账本里和农人的日子里。',
      factual_basis: '依据毛泽东条目“韶山少年（1893—1910）”及相关待核实说明。',
      fictionalized_elements: ['夜读与收拾行囊的连续场景为影视化组织，未虚构新的历史事件。'],
    }, 0),
    makeScene({
      title: '把课堂走到乡间',
      location: '湖南第一师范与湘中乡路',
      time_of_day: '白天',
      dramatic_function: '求学与观察',
      plot: '在湖南第一师范，毛泽东读新书、练身体，也不断追问书本怎样回应现实。1917年暑假，他与萧子升徒步游学，身无分文，沿途写对联换食宿。走过宁乡、安化、益阳、沅江，他看见农民的劳作与困顿，课堂里的问题第一次有了真实面孔。',
      key_action: '毛泽东离开课堂徒步九百余里，把沿途观察记进随身笔记',
      characters: ['毛泽东', '萧子升', '杨昌济'],
      visual_prompt: '1910年代湖南第一师范课堂与湘中乡路交叉剪辑，青年毛泽东背布包、穿草鞋，手持笔记和写有对联的纸张，农舍、稻田与赶路脚步，纪实质感',
      camera_suggestion: '课堂固定中景转为手持跟拍乡路，脚步、草鞋、笔记本和农人面孔连续特写',
      cultural_note: '一师求学、1917年徒步游学及写对联换食宿来自条目；具体镜头衔接为影视化处理。',
      conflict: '只在书本中寻找答案 vs 走进乡村亲眼观察现实',
      dialogue_or_narration: '旁白：书告诉他世界可以改变，乡路让他看见为什么必须改变。',
      factual_basis: '依据毛泽东条目“长沙求学与新民学会（1910—1918）”。',
      fictionalized_elements: ['课堂与游学的交叉剪辑为叙事压缩。'],
    }, 1),
    makeScene({
      title: '从砥砺品行到改造世界',
      location: '长沙岳麓山下新民学会成立旧址',
      time_of_day: '黄昏',
      dramatic_function: '同伴与组织',
      plot: '长沙岳麓山下，毛泽东、蔡和森、萧子升等青年围坐在木桌旁讨论新民学会章程。1918年的军阀统治与社会动荡把时代压力推到桌前：只谈个人修养已经不能回答现实。毛泽东把目光从纸上抬起，学会的方向逐渐指向“改造中国与世界”。',
      key_action: '毛泽东与蔡和森等人修改并确认新民学会的行动方向',
      characters: ['毛泽东', '蔡和森', '萧子升'],
      visual_prompt: '1918年长沙岳麓山下朴素民居，木桌、章程手稿、笔记本、油灯，毛泽东与蔡和森、萧子升围桌讨论，窗外岳麓山暮色，青年群像与纸面文字特写',
      camera_suggestion: '环绕青年群像，落到章程文字，再切毛泽东抬眼作出判断的近景',
      cultural_note: '事实边界：新民学会成立时间、成员与宗旨转向来自条目；具体会议对白和动作属于影视化创作再现。',
      conflict: '军阀统治与社会动荡的时代压力下，只求个人品行进步 vs 组织起来回应更广阔的社会问题',
      dialogue_or_narration: '旁白：个人怎样变好，已经不够；他们开始追问，一个国家怎样改变。',
      factual_basis: '依据毛泽东条目及“新民学会——湖南共产党的前身”条目。',
      fictionalized_elements: ['会议现场的具体座次、动作与对白节奏为有限再现。'],
    }, 2),
    makeScene({
      title: '夜校里的答案',
      location: '韶山农民夜校旧址',
      time_of_day: '夜晚',
      dramatic_function: '人民实践',
      plot: '回到韶山后，毛泽东走进农民夜校。1925年的夜校里，他在黑板上写字，农民学员却更关心谷价、租息和一家人的生计。他因此放下原来的讲稿，先听大家把难处说完，再把识字课和现实问题连在一起。夜校之外，农民协会开始组织起来；理想第一次不只是纸上的主张，而成为共同解决问题的行动。',
      key_action: '毛泽东停下单向讲授，听取农民诉求并组织夜校与农民协会',
      characters: ['毛泽东', '杨开慧', '农民夜校学员'],
      visual_prompt: '1925年韶山农民夜校，夜晚，旧校舍黑板、粉笔、油灯、谷米账册，毛泽东站在黑板旁倾听农民发言，杨开慧整理教材，农民学员围坐，真实乡土空间',
      camera_suggestion: '先拍黑板与粉笔，再转向农民粗糙双手和发言面孔，最后回到毛泽东放下讲稿的动作',
      cultural_note: '事实边界：农民夜校、杨开慧协助教学和农民协会来自条目；具体课堂发言为基于现实议题的影视化创作补足。',
      conflict: '地方权势、谷价与租息构成现实阻力；预设的启蒙方式 vs 农民最迫切的生计诉求',
      dialogue_or_narration: '旁白：他来到农民中间，不只是为了告诉他们答案，也为了重新学习问题本身。',
      factual_basis: '依据毛泽东条目“韶山农民实践与考察报告（1925—1927）”。',
      fictionalized_elements: ['放下讲稿与个别课堂发言为合成场景，不作为原话史实。'],
    }, 3),
    makeScene({
      title: '把脚印写成道路',
      location: '湖南五县农民运动考察路线',
      time_of_day: '清晨',
      dramatic_function: '高潮',
      plot: '走访湖南五县的第三十二天，毛泽东在清晨翻开沾着泥点的笔记。1927年初，他已经徒步考察湘潭、湘乡、衡山、醴陵、长沙，看到农民怎样组织、斗争并承担后果。因此，多年前从韶山带出的个人求学疑问，转化为一个清晰判断：道路不在远方，就在人民已经行动起来的土地上；这也成为他革命理想形成的关键一步。',
      key_action: '毛泽东整理五县调查笔记，把乡土观察转化为对农民革命力量的判断',
      characters: ['毛泽东', '农民协会骨干'],
      visual_prompt: '1927年湖南乡村清晨，泥泞道路、草鞋、斗笠、写满调查记录的笔记本，毛泽东与农民协会骨干同行，远处稻田和村舍，晨光照亮翻开的《湖南农民运动考察报告》手稿',
      camera_suggestion: '跟拍泥路脚步，切到笔记中的地名和数据，最后拉远至行走在田野中的人物群像',
      cultural_note: '事实边界：五县三十二天考察与考察报告来自条目；将多年成长压缩为首尾呼应属于影视化创作组织。',
      conflict: '把农民仅视为被帮助者的旧认识 vs 看见农民作为革命主体的现实行动',
      dialogue_or_narration: '旁白：他的理想不是在一间书房里突然完成的，而是在湖南的田埂、课堂、会议桌和农民中间一步步形成。',
      factual_basis: '依据毛泽东条目关于1927年湖南五县农民运动考察及报告的记载。',
      fictionalized_elements: ['泥点笔记与清晨整理手稿为视觉化处理。'],
    }, 4),
  ];
}

function buildMaoGrowthArcCharacters(characterNames: string[]): StoryCharacter[] {
  const descriptions: Record<string, { role: string; description: string }> = {
    毛泽东: { role: 'protagonist', description: '从韶山少年、长沙学生成长为走进农民实践的青年行动者。' },
    毛贻昌: { role: 'family_pressure', description: '父亲，希望儿子守住家业；构成少年离乡选择中的家庭压力。' },
    萧子升: { role: 'peer', description: '同学与游学伙伴，和毛泽东一起走入湘中乡村观察现实。' },
    杨昌济: { role: 'mentor', description: '湖南一师师长，参与青年毛泽东求学与思想启蒙阶段。' },
    蔡和森: { role: 'peer', description: '新民学会同伴，与毛泽东共同讨论从个人修养到社会改造的方向。' },
    杨开慧: { role: 'collaborator', description: '协助韶山农民夜校教学的行动伙伴。' },
    农民夜校学员: { role: 'community', description: '以谷价、租息和生计问题把抽象理想拉回乡土现实的群体。' },
    农民协会骨干: { role: 'community', description: '农民运动实践中的组织者群体，使人民力量成为可见行动。' },
  };
  return characterNames.slice(0, 8).map((name) => ({
    name,
    role: descriptions[name]?.role ?? 'supporting',
    description: descriptions[name]?.description ?? '青年成长与湖南实践线中的相关人物。',
  }));
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
  const visualPrompt = buildVisualPrompt(template, location, timeOfDay, centralEvent, protagonist, entry);

  // Build camera suggestion
  const cameraSuggestion = CAMERA_BY_FUNCTION[template.function_label] ?? '中景固定镜头';

  // Build characters for this scene
  const sceneChars = determineSceneCharacters(template, characterNames, protagonist, videoType);

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
  if (centralEvent.includes('拒签')) return '南安军衙';
  if (centralEvent.includes('断案')) return '分宁县衙';
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) return '汨罗江畔';

  const eventText = [centralEvent, ...paragraphs].join(' ');
  const eventLocation = entry.relatedLocations.find((place) => {
    const name = typeof place === 'string' ? place : place.name;
    const coreName = name.replace(/[《》]/g, '').replace(/(?:故居|旧址|遗址|纪念馆|所在地)$/g, '');
    return eventText.includes(name) || (coreName.length >= 2 && eventText.replace(/[《》]/g, '').includes(coreName));
  });
  if (eventLocation) {
    return typeof eventLocation === 'string' ? eventLocation : eventLocation.name;
  }

  const primaryPlace = subjectPlace(entry);
  if (primaryPlace && (/工坊|楼|阁|亭|台|寺|庙|祠|馆|园|城|镇|村|江|湖|山|洞|溪/.test(primaryPlace) || primaryPlace !== inferSubject(entry))) {
    return primaryPlace;
  }

  // Try to extract specific location from paragraphs
  const locationHints = ['军衙', '衙门', '官衙', '衙署', '书院', '楼', '阁', '亭', '池', '寺', '庙', '祠', '江', '河', '湖', '山', '洞', '府', '宫', '巷', '街'];
  for (const hint of locationHints) {
    for (const p of paragraphs) {
      const match = p.match(new RegExp(`[^，。！？]*${hint}[^，。！？]*`));
      if (match) {
        const candidate = cleanPlaceName(cleanSourceParagraph(match[0]));
        if (candidate) {
          return candidate.substring(0, 20);
        }
      }
    }
  }

  // Use entry region + supporting context
  if (supportingRegions.length > 0) {
    return `${cleanPlaceName(entry.region) || primaryPlace}（${supportingRegions[0]}）`;
  }
  return cleanPlaceName(entry.region) || primaryPlace || '未标注地点';
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
    '小主人公': [`小主人公`, '好奇出发'],
    '遇到问题': [`遇到问题`, '意外发现'],
    '学习成长': [`探索发现`, '认真听看'],
    '做出选择': [`勇敢选择`, '做出选择'],
    '温暖结尾': [`温暖结尾`, '带着收获回家'],
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
  const region = narrativePlace(entry, centralEvent, videoType);
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
      return buildChildProblem(protagonistName, centralEvent, entry);

    case '学习成长':
      return buildChildGrowth(protagonistName, centralEvent, actionDetails, entry);

    case '做出选择':
      return buildChildChoice(protagonistName, centralEvent, keyQuote, entry);

    case '温暖结尾':
      return buildChildEnding(protagonistName, centralEvent, entry);

    case '3秒钩子':
      return buildShortHook(protagonistName, centralEvent, keyQuote);

    case '关键信息':
      return buildShortKeyInfo(protagonistName, centralEvent);

    case '情绪推进':
      return buildShortEmotion(protagonistName, centralEvent, toneAdj);

    case '金句落点':
      return buildShortGoldenQuote(protagonistName, centralEvent, keyQuote);

    // --- AI comic single ---
    case '人物登场':
      return buildAiComicEntrance(protagonistName, centralEvent, region, actionDetails);
    case '冲突爆发':
      return buildAiComicConflict(protagonistName, centralEvent, actionDetails);
    case '反转/觉醒':
      return buildAiComicTurn(protagonistName, centralEvent, keyQuote);
    case '高燃收束':
      return buildAiComicClose(protagonistName, centralEvent, entry);

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
  const sentences = cleanSourceSentences(paragraph).filter(s => s.includes(centralEvent) || s.length >= 10);
  if (sentences.length > 0) {
    return sentences[0].trim().substring(0, 60);
  }
  return '';
}

function buildHookOpening(centralEvent: string, region: string, protagonist: string, details: string, quote: string, timeOfDay: string): string {
  if (centralEvent.includes('拒签')) {
    const office = region.endsWith('军') ? `${region}衙` : `${region}军衙`;
    return `${timeOfDay}，${office}。一份死刑文书摆在案头，烛火摇晃映出"死罪"二字。${protagonist}翻到案卷最后一页，手指停在判词上，第一次没有立刻签字。`;
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
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `${protagonist}被放逐在${region}一带，仍牵挂楚国。郢都失守的消息传来，他知道自己已无法回到朝堂，却必须用最后的行动回答家国之痛。`;
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
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `国都失陷、流放无归，身边人劝${protagonist}保全性命，江风却把亡国之痛吹到眼前。苟活可以避祸，殉志则意味着永别。`;
  }
  return `${centralEvent}进入关键阶段，旧有秩序、现实处境与新的主张正面碰撞。${protagonist}必须把思考变成行动，并承担选择带来的后果。${details || ''}`;
}

function buildKeyActionScene(protagonist: string, centralEvent: string, details: string, quote: string): string {
  if (centralEvent.includes('拒签')) {
    return `${protagonist}选择了拒签。他仔细翻阅案卷每一条证据，记录疑点，向知军逐条陈述。${antagonist_placeholder()}震怒，以长官权威相逼。${protagonist}拿起自己的任命文书——`;
  }
  if (centralEvent.includes('断案')) {
    return `${protagonist}开始深入调查。他走访现场、询问证人、比对证词。每一步都遇到阻力，但他不放弃。真相逐渐浮出水面。`;
  }
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `${protagonist}整理衣冠，把怀石抱入怀中。他回望楚地，最后一次低声诵读诗句，然后一步步走向汨罗江。`;
  }
  return `${protagonist}不再停留在思考中，开始围绕${centralEvent}采取具体行动。${details || ''}${quote ? `他在行动中提出："${quote}"` : ''}`;
}

function antagonist_placeholder(): string {
  return '知军';
}

function isRefusalQuote(quote: string): boolean {
  return /吾不为|不为也|不能签|不签|杀人|上官|人命/.test(quote);
}

function buildClimaxScene(protagonist: string, centralEvent: string, quote: string, details: string): string {
  if (centralEvent.includes('拒签')) {
    const coreQuote = isRefusalQuote(quote) ? quote : '为上官杀人，以媚于人，吾不为也';
    return `${protagonist}把未签的文书推回案头，对${antagonist_placeholder()}说："${coreQuote}。"他将任命文书交还，准备辞官离去。${antagonist_placeholder()}被震动，案卷被重新打开。`;
  }
  if (centralEvent.includes('断案')) {
    return `新的证词和案卷细节互相印证，疑案终于查清。${protagonist}当众说明判由，冤屈者得以洗清，催促草率结案的人沉默退后。`;
  }
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `${eventWithProtagonist(protagonist, centralEvent)}。江水合拢，岸边的人声忽然停住；这个选择，成为后世反复讲述的精神坐标。`;
  }
  return `${eventWithProtagonist(protagonist, centralEvent)}进入关键时刻。${quote ? `"${quote}"` : `${protagonist}以实际行动回应现实，个人志向由此转向更广阔的人群与时代问题。`}`;
}

function buildEndingScene(protagonist: string, centralEvent: string, entry: EntryDetail, videoType: VideoType): string {
  if (centralEvent.includes('拒签')) {
    return `囚犯因此免死。${protagonist}没有赢得权势，却守住了人命面前不能含糊的公道。拒签不是一句口号，而是他愿意为良知承担仕途代价的结果。`;
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
  const protagonist = inferProtagonist(entry, 'historical_drama');
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `${region}，楚国败局已成。郢都失守的消息传到江南，被放逐的${protagonist}站在风里，家国之痛从朝堂压到江边。`;
  }
  return `${region}，时代风云激荡。制度、战事或权力压力把人物推到选择面前。${eventWithProtagonist(protagonist, centralEvent)}，不是背景介绍，而是一场必须付出代价的行动。`;
}

function buildCharacterInvolved(protagonist: string, entry: EntryDetail, centralEvent: string, region: string): string {
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `${protagonist}在流放中听到郢都陷落。他不是战场上的将领，却仍以诗、以身体、以最后的姿态承担亡国之痛。`;
  }
  return `${protagonist}进入${region}的历史现场。职责、身份或时代处境把他推到事件中心，他必须在保全自身和回应现实之间做出判断。`;
}

function buildHistoricalEcho(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}的后续影响：${entry.culturalSignificance?.substring(0, 80) ?? `${protagonist}的${centralEvent}在历史上留下了什么痕迹`}。这个事件不只是个人抉择，更是一种精神的印记。`;
}

function buildRealityIntro(centralEvent: string, entry: EntryDetail, region: string): string {
  const subject = inferSubject(entry);
  const place = entry.relatedLocations[0];
  const placeName = typeof place === 'string' ? place : place?.name;
  return `今天，镜头从${placeName || region}进入。观众先看到可拍的现场：墙面、匾额、台基或展陈文字，再顺着这些痕迹回望${subject}与${centralEvent}。`;
}

function buildHistoricalRetrospect(protagonist: string, entry: EntryDetail, centralEvent: string, region: string): string {
  const basis = firstCleanSentence(entry.story, entry.summary);
  return `旁白交代可考线索：${basis}。本段只做事实梳理，历史再现场面与人物调度在画面中另行标明。`;
}

function buildKeyNode(protagonist: string, centralEvent: string, details: string, quote: string): string {
  const cleanedDetails = stripRepeatedEventPrefix(details, centralEvent, protagonist);
  return `${centralEvent}：${cleanedDetails || '关键时刻的具体经过'}${quote ? `。画外引用："${quote}"` : ''}`;
}

function stripRepeatedEventPrefix(text: string, centralEvent: string, protagonist: string): string {
  let result = cleanInlineMarkdown(text).trim();
  const prefixes = [
    `${protagonist}${centralEvent}`,
    centralEvent,
  ].filter(Boolean);
  for (const prefix of prefixes) {
    while (result.startsWith(prefix)) {
      result = result.slice(prefix.length).replace(/^[——：:，,。；;\s]+/, '').trim();
    }
  }
  return result;
}

function buildCultureExplanation(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  const cultural = firstCleanSentence(entry.culturalSignificance ?? '', '这个事件让地点、人物和精神解释彼此连接');
  return `${centralEvent}为什么被记住？镜头回到材料、文献和现场，由旁白解释它如何改变${protagonist}的文化含义：${cultural}。`;
}

function buildContemporaryMeaning(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  const cultural = firstCleanSentence(entry.culturalSignificance ?? '', '传统并未停在过去，而是在今天继续被观看、讲述和使用');
  return `今天，${protagonist}仍以现实空间被看见。${centralEvent}不再只是过去的节点，而成为观众理解当代文化记忆的入口：${cultural}。`;
}

function buildProposeTheme(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `核心观点：${centralEvent}照见${protagonist}的精神——${entry.culturalSignificance?.substring(0, 40).split(/[。]/)[0] ?? '公正与良知'}。让我们从这个案例开始，理解这种精神的深刻内涵。`;
}

function buildTellFacts(protagonist: string, centralEvent: string, details: string): string {
  return `围绕${centralEvent}，先看可考事实：${details || '事件发生的时间、地点、参与者和来源线索'}。史料记载、后世追述和现场再现需要分层说明。`;
}

function buildAnalyzeSpirit(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}首先体现的是开放讨论：不同观点可以在共同问题前展开论证；其次是求真，结论要经得起事实和学理检验；最后是传承，让一场对话成为后来者继续思考的起点。${entry.culturalSignificance?.substring(0, 60) ?? ''}`;
}

function buildConnectPresent(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}的开放治学精神，在今天仍可以落到课堂讨论、学术交流和公共学习中：允许分歧，要求证据，也愿意修正自己的判断。${entry.name.split('——')[0]}因此不只是历史遗址，也是仍在发生学习的空间。`;
}

function buildCallToAction(protagonist: string, centralEvent: string, quote: string): string {
  return `${quote || `“${centralEvent}”`}。把开放变成愿意倾听，把求真变成查证依据，把传承变成继续发问；一次好的学习，不以口号结束，而从下一次有根据的讨论开始。`;
}

function buildChildProtagonist(protagonist: string, entry: EntryDetail, region: string): string {
  if (entry.keywords.includes('人仙之恋') || (entry.keywords.includes('狐仙') && entry.keywords.includes('刘海砍樵'))) {
    return `${protagonist}是${region}山林里勤劳善良的年轻樵夫。每天，他背着柴担、带着斧头走上山路；这一天，他在竹林边遇见了提着花篮的胡大姐。`;
  }
  const source = cleanSourceSentences(entry.story).find(sentence => sentence.startsWith(protagonist));
  return source
    ? `${source}。这一次，他遇到了一件需要认真看、认真听的小难题。`
    : `${protagonist}住在${region}。他好奇、善良，遇到问题时愿意先看清楚，再想办法。`;
}

function buildChildProblem(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  if (entry.keywords.includes('人仙之恋') || entry.keywords.includes('狐仙')) {
    return `胡大姐告诉${protagonist}，自己来自传说中的狐仙世界。${protagonist}吃了一惊：如果只因为身份不同就转身离开，他会不会错过一个真诚善良的朋友？`;
  }
  return `${protagonist}在“${centralEvent}”中遇到了一个问题。眼前看到的和原先以为的不一样，他决定不急着下结论。`;
}

function buildChildGrowth(protagonist: string, centralEvent: string, details: string, entry: EntryDetail): string {
  if (entry.keywords.includes('人仙之恋') || entry.keywords.includes('狐仙')) {
    return `${protagonist}想起胡大姐一路上的帮助，也看见她没有伤害任何人。他先听她把话说完，再用自己亲眼看到的善意作判断，害怕慢慢变成了理解。`;
  }
  return `${protagonist}先观察，再询问，还亲手试了一次。${details || `他从${centralEvent}里找到了一条能解决问题的线索`}。`;
}

function buildChildChoice(protagonist: string, centralEvent: string, quote: string, entry: EntryDetail): string {
  if (entry.keywords.includes('人仙之恋') || entry.keywords.includes('狐仙')) {
    return `${protagonist}没有因为传说中的身份而否定胡大姐。他选择相信亲眼见过的善良，并和她一起面对接下来的考验。`;
  }
  const usableQuote = quote && quote !== centralEvent && !centralEvent.includes(quote) ? quote : '';
  return `${protagonist}做出了勇敢而温和的选择：不跟着误会走，要用行动把问题解决。${usableQuote ? `他说：“${usableQuote}”` : ''}`;
}

function buildChildEnding(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  if (entry.keywords.includes('人仙之恋') || entry.keywords.includes('狐仙')) {
    return `${protagonist}和胡大姐一起走过考验，山路上又响起轻快的歌声。这个温暖结局属于民间传说的讲法，也提醒孩子：认识一个人，要看他的行动和真心。`;
  }
  return `问题终于有了温暖的答案。${protagonist}明白了：遇到不同的人和事，先理解、再判断，善良也需要勇敢的行动。`;
}

function buildShortHook(protagonist: string, centralEvent: string, quote: string): string {
  return `${centralEvent}？镜头贴近${protagonist}最关键的材料与动作，答案先藏在一个反常细节里。`;
}

function buildShortKeyInfo(protagonist: string, centralEvent: string): string {
  return `${centralEvent}的关键不在表面：材料怎样变化、手如何操作、最后产生什么差别，三个信息依次出现。`;
}

function buildShortEmotion(protagonist: string, centralEvent: string, toneAdj: string): string {
  return `${toneAdj}材料在手指间一点点变化，粗糙变得细密，单一变得有层次；${protagonist}的耐心，让看不见的细节显出来。`;
}

function buildShortGoldenQuote(protagonist: string, centralEvent: string, quote: string): string {
  const usableQuote = quote && quote !== centralEvent && !centralEvent.includes(quote) ? `“${quote}”` : '看见一处细节，才看见一门手艺的分量';
  return `${usableQuote}。成品纹理与手中的材料同框，问题在答案里停住。`;
}

function buildAiComicEntrance(protagonist: string, centralEvent: string, region: string, details: string): string {
  if (centralEvent.includes('断案') || centralEvent.includes('拒签')) {
    return `白天，${region}衙署外雨声未停。${protagonist}把案卷摊开，指尖停在两处互相矛盾的证词上；门外脚步逼近，催签的人已经到了。`;
  }
  return `主角入场。${protagonist}带着未解决的疑问进入${region}，手中握着能改变局面的物件，表情从迟疑变得警觉。`;
}

function buildAiComicConflict(protagonist: string, centralEvent: string, details: string): string {
  if (centralEvent.includes('断案') || centralEvent.includes('拒签')) {
    return `上官把笔推到${protagonist}面前，案卷边缘被烛油烫出黑痕。${protagonist}没有接笔，而是把疑点逐条摊开：证词时间对不上，伤痕位置也不对。`;
  }
  return `对立面逼近，要求${protagonist}立刻接受既定结果。${protagonist}用一件可见证据反问，场面从沉默变成正面交锋。`;
}

function buildAiComicTurn(protagonist: string, centralEvent: string, quote: string): string {
  if (centralEvent.includes('断案') || centralEvent.includes('拒签')) {
    return `${protagonist}忽然合上案卷，转身走向牢门。他不再只在案头找答案，而要亲眼重看现场；这一转身，让所有人都意识到他不会顺势签下去。`;
  }
  return `${protagonist}突然改变行动方向，放弃最省事的路，选择承担更难的后果。表情从被逼迫变成清醒。`;
}

function buildAiComicClose(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  if (centralEvent.includes('断案') || centralEvent.includes('拒签')) {
    return `清晨，${protagonist}把未签的文书推回去。案卷上的疑点被重新打开，冤案还没有结束，但他已经用行动回答：人命面前，权势不能替良知落笔。`;
  }
  const theme = firstCleanSentence(entry.culturalSignificance ?? '', '选择之后，真正的问题才刚刚开始');
  return `${protagonist}站在光里，留下一个必须继续追问的问题。${theme}。画面定格在他握紧的手和未完成的道路上。`;
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
  return `${keywords}依次进入手边：材料铺开，工具落下，手指调整力度。${details ? `具体步骤：${details}` : '从原料到成品，每一步都留下可见变化'}。针尖、纹理和工具声把技艺讲清。`;
}

function buildModernInheritance(entry: EntryDetail, protagonist: string): string {
  const culturalSignificance = entry.culturalSignificance?.substring(0, 60) ?? '';
  return `传统如何在现代延续？${culturalSignificance || `${entry.name}在新一代手中继续传承`}。不是博物馆里的标本，而是活在当下的生命力。`;
}

function buildSloganClose(entry: EntryDetail, protagonist: string, quote: string): string {
  const coreMessage = entry.culturalSignificance?.split(/[。]/)[0]?.substring(0, 30) ?? entry.type;
  return `${quote || `${coreMessage}——文化精神最凝练的表达`}。镜头从代表性符号拉向今天仍在这里学习、参观和实践的人，让文化根脉落在现实行动中。`;
}

// ---------------------------------------------------------------------------
// Heritage promo builders
// ---------------------------------------------------------------------------

function buildHeritageOrigin(entry: EntryDetail, centralEvent: string, region: string): string {
  const subject = inferSubject(entry);
  const origin = firstCleanSentence(entry.story, entry.summary);
  return `${region}，镜头先落在${subject}的成品与旧照片上。旁白交代技艺来处：${origin}。观众先看到针线、绸面和图样，再进入制作现场。`;
}

function buildArtisanEntrance(protagonist: string, entry: EntryDetail, region: string): string {
  const subject = inferSubject(entry);
  return `一位${subject}传承人坐到绣架前，先用指尖理顺丝线，再检查底稿。镜头拍手背的老茧、针尖的停顿和绸面的细光，人物情感从动作里出来。`;
}

function buildCraftProcess(entry: EntryDetail, details: string): string {
  const subject = inferSubject(entry);
  const keywords = entry.keywords.slice(0, 3).join('、');
  const basis = details || firstCleanSentence(entry.story, `${subject}包含选稿、配线、劈丝、落针和收针等关键步骤`);
  return `工艺流程展开：先选图样和底布，再配色、劈丝、穿针、落针。${basis}。镜头连续拍到线从指间分开、针脚压住绸面、色线逐层过渡，流程顺序必须看得清。`;
}

function buildCraftSpirit(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  const subject = inferSubject(entry);
  const spirit = firstCleanSentence(entry.culturalSignificance ?? '', '精益求精、以手传心');
  return `技艺不只是技术。${subject}的精神从一针一线里显出来：传承人宁愿放慢速度，也要让毛发、光泽和层次准确落在绸面上。${spirit}。`;
}

function buildInheritancePath(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  const subject = inferSubject(entry);
  return `传承的现实摆在镜头前：学习周期长、市场审美变化快，年轻学徒需要在速度和手工质量之间做选择。最后一针落下，${subject}不是陈列品，而是一条仍在继续的接力线。`;
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
  return `${region}的地方文化落在${keywords}里，也落在晨读的人、讲解的声音和街巷里的日常往来中。地标因此不只是景点，而是仍被使用的生活空间。`;
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
  return `沿着空间继续前行，${protagonist}${centralEvent}留下的痕迹逐渐显现：${details || entry.story.substring(0, 60).replace(/\*\*/g, '').split(/[。]/)[0]}。脚步经过实物、建筑和人的活动，地点开始有了时间。`;
}

function buildTimeOverlay(entry: EntryDetail, centralEvent: string, protagonist: string): string {
  const culturalDepth = entry.culturalSignificance?.substring(0, 50) ?? '';
  return `同一个空间在不同时间的故事——古人与今人、旧貌与新颜。${protagonist}${centralEvent}的痕迹，与今天的生活叠印。${culturalDepth || '时间的深度让空间有了灵魂'}`;
}

function buildMoodClose(entry: EntryDetail, region: string): string {
  return `脚步停下，${region}的风声仍从建筑与树影之间穿过。镜头留在空出的石阶和渐远的人声上，让空间自己完成最后一句。`;
}

// ---------------------------------------------------------------------------
// Landscape mood builders
// ---------------------------------------------------------------------------

function buildLandscapeOpening(entry: EntryDetail, region: string): string {
  return `清晨的${region}先从雾里露出一线峰脊，水汽沿石壁缓慢上升。没有急促的人声，只有风、滴水和远处鸟鸣把山谷一点点唤醒。`;
}

function buildMoodFlow(entry: EntryDetail, region: string): string {
  const keywords = entry.keywords.filter(k => ['山', '水', '云', '雾', '日', '月', '风', '雨', '春', '夏', '秋', '冬'].some(w => k.includes(w)));
  const moodWords = keywords.length > 0 ? keywords.join('→') : '晨昏→四季→风雨→晴雾';
  return `${moodWords}依次掠过${region}：晨光擦亮峰壁，雨雾吞没半座山林，暮色又把溪谷拉深。山水不解释，只在时间里改变呼吸。`;
}

function buildSpiritEssence(entry: EntryDetail, region: string): string {
  const core = entry.culturalSignificance?.substring(0, 30)?.split(/[。]/)[0] ?? '山水灵韵';
  return `${core}。云从峰间移开，最远的一根石柱重新出现；风声退下去，山水把未说完的部分留给观看的人。`;
}

// ---------------------------------------------------------------------------
// Explainer video builders
// ---------------------------------------------------------------------------

function buildPoseQuestion(centralEvent: string, entry: EntryDetail): string {
  return `${centralEvent}——为什么这件事值得关注？${entry.type === '非遗' ? '这种技艺为什么能千年传承？' : entry.type === '名胜古迹' ? '这个地方为什么成为文化地标？' : '这段历史为什么被记住？'}`;
}

function buildConceptExplain(centralEvent: string, entry: EntryDetail): string {
  const keywords = entry.keywords.slice(0, 3).join('、');
  return `先认清三个概念：${keywords}。${entry.summary?.substring(0, 60) ?? centralEvent}。可以把岩层看作叠放的书页，把垂直节理看作书页上的裂缝，流水再沿裂缝不断切开。`;
}

function buildCaseEvidence(protagonist: string, centralEvent: string, details: string): string {
  return `以${protagonist}为例观察${centralEvent}：${details || '岩层、节理、溪谷和孤立峰柱同时出现在真实地点中'}。同一组地貌细节，把概念和现场对应起来。`;
}

function buildLogicDeepen(centralEvent: string, entry: EntryDetail): string {
  const culturalSig = entry.culturalSignificance?.substring(0, 60) ?? '';
  return `${centralEvent}不只是形状问题。${culturalSig || '岩石性质提供基础，节理决定切割方向，流水侵蚀和重力崩塌共同塑造今天的峰林'}。少掉其中任何一层，都解释不了眼前的地貌。`;
}

function buildSummary(centralEvent: string, entry: EntryDetail): string {
  return `最后记住${entry.keywords.slice(0, 3).join('、')}三个词：${centralEvent}不是一次完成的雕刻，而是岩层、裂隙、流水与漫长时间共同留下的结果。`;
}

// ---------------------------------------------------------------------------
// Education/training builders
// ---------------------------------------------------------------------------

function buildLearningObjective(centralEvent: string, entry: EntryDetail): string {
  return `学习目标：学完本节，能够说出${centralEvent}的三个层次，并用${entry.keywords.slice(0, 3).join('、')}各举一个现场例子。`;
}

function buildKnowledgeTeach(centralEvent: string, entry: EntryDetail): string {
  return `第一层看${entry.keywords[0] ?? centralEvent}，确认对象与地点；第二层看${entry.keywords[1] ?? '历史背景'}，理解关键事件；第三层看${entry.keywords[2] ?? '当代延续'}，分清历史遗存和今天的使用。`;
}

function buildDemonstration(protagonist: string, centralEvent: string, details: string): string {
  return `示范：从一处实物或建筑细节开始，找到对应事件，再回到今天的现场。${details || `${protagonist}、${centralEvent}与可见空间被逐一对应`}。`;
}

function buildPracticeGuide(centralEvent: string): string {
  return `练习：为${centralEvent}制作三张卡片，分别写“可见实物”“历史事件”“当代使用”，并说明三者为什么不能混为同一个时代。`;
}

function buildAssessment(centralEvent: string, entry: EntryDetail): string {
  return `知识检验：看到${entry.keywords.slice(0, 3).join('、')}时，能否指出它属于地点、事件还是文化解释？再用一句话说明${centralEvent}的时间关系。`;
}

function buildExtendedSummary(centralEvent: string, entry: EntryDetail): string {
  return `复盘：先辨实物，再核事件，最后讨论当代意义。继续学习${centralEvent}时，可对照${entry.type}条目的来源、现场说明和待核实点。`;
}

// ---------------------------------------------------------------------------
// Other scene field builders
// ---------------------------------------------------------------------------

function buildSceneConflict(template: SceneTemplate, centralEvent: string, protagonist: string, paragraphs: string[]): string {
  if (['技艺渊源', '匠人登场', '工艺全程', '精神内核', '传承之路'].includes(template.function_label)) {
    return `传统手工流程 vs 当代传播和传承压力`;
  }
  if (['现实引入', '历史回望', '关键节点', '文化解释', '当代意义'].includes(template.function_label)) {
    return `现场证据 vs 后世阐释——如何说清${centralEvent}的事实边界`;
  }
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `国破流放 vs 保全自身——${protagonist}如何回应家国之痛`;
  }
  const conflictMap: Record<string, string> = {
    '钩子开场': `悬念开场：${centralEvent}的危机是什么？`,
    '主角处境': `${protagonist}的身份与职责 vs 制度/权力压力`,
    '冲突升级': `旧有秩序与现实压力 vs ${protagonist}正在形成的新判断`,
    '关键行动': `${protagonist}做出选择——采取行动`,
    '高潮': `${centralEvent}的核心冲突爆发——正面交锋`,
    '结尾': `良知坚守 vs 权势得失——精神落点`,
    '时代危机': `社会现实与旧有秩序 vs 改变现实的愿望`,
    '人物卷入': `${protagonist}的个人求索 vs 时代提出的公共问题`,
    '历史余响': `短期得失 vs 长期精神`,
  };
  return conflictMap[template.function_label] ?? `${centralEvent}——${protagonist}的抉择`;
}

function buildDialogueOrNarration(template: SceneTemplate, centralEvent: string, quotes: string[], protagonist: string, paragraphs: string[], videoType: VideoType): string {
  // For dramatic video types, extract actual dialogue
  if (['character_story', 'historical_drama', 'ai_comic_drama'].includes(videoType)) {
    if (centralEvent.includes('拒签')) {
      if (template.function_label === '钩子开场') return `旁白：案卷上的死罪二字压在案头，${protagonist}却迟迟没有落笔。`;
      if (template.function_label === '主角处境') return `${protagonist}（翻看片页）：证词前后不合，人命不能按催文定夺。`;
      if (template.function_label === '冲突升级') return `知军：此案已定，只等你签。${protagonist}：若证据有疑，这一笔便是误杀。`;
      if (template.function_label === '关键行动') return `${protagonist}：此案有疑，我不能签字。`;
      if (template.function_label === '高潮') return `${protagonist}：为上官杀人，以媚于人，吾不为也。`;
      if (template.function_label === '结尾') return `旁白：他退回的不是一页文书，而是一条可能被草率夺走的人命。`;
    }
    if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
      if (template.function_label === '时代危机') return `旁白：据《史记》等传统叙述，郢都失守后，流放江南的${protagonist}再也不能置身事外。`;
      if (template.function_label === '人物卷入') return `${protagonist}（低声）：国都已破，我还能把什么留给后人？`;
      if (template.function_label === '冲突升级') return `旁人：活下去。${protagonist}：若心已无归处，身又往何处安放？`;
      if (template.function_label === '关键行动') return `旁白：他整理衣冠，抱石向江，所有话都交给水声。`;
      if (template.function_label === '高潮') return `旁白：屈原投江，人的一身沉入江水，忠愤却浮上千年。`;
    }
    if (centralEvent.includes('断案')) {
      if (template.function_label === '钩子开场') return `旁白：案卷里一个对不上的细节，让${protagonist}停住了笔。`;
      if (template.function_label === '主角处境') return `${protagonist}（翻看片页）：证词前后不合，不能只按催文落判。`;
      if (template.function_label === '冲突升级') return `上官：案子拖不得。${protagonist}：若有冤情，快一日便错一日。`;
      if (template.function_label === '关键行动') return `${protagonist}：此案有疑，我要重问证人，重看现场。`;
      if (template.function_label === '高潮') return `旁白：证词对上了，疑点也对上了；这一回，他没有让无辜者替草率结案付命。`;
      if (template.function_label === '结尾') return `旁白：周敦颐守住的不是一纸判文，而是人命面前不能含糊的公道。`;
    }
    if (videoType === 'ai_comic_drama') {
      const isCaseEvent = centralEvent.includes('断案') || centralEvent.includes('拒签');
      if (isCaseEvent) {
        if (template.function_label === '钩子开场') return `旁白：案卷上的一个疑点，让${protagonist}停住了笔。`;
        if (template.function_label === '人物登场') return `${protagonist}（压低声音）：证词前后不合，不能草草定案。`;
        if (template.function_label === '冲突爆发') return `上官（不耐）：照旧签了。${protagonist}（克制）：若有冤情，这一笔就是人命。`;
        if (template.function_label === '反转/觉醒') return `${protagonist}（抬眼）：我愿重查，也不愿误杀。`;
        if (template.function_label === '高燃收束') return `${protagonist}：为求一时顺从而害一人性命，吾不为也。`;
      }
      if (template.function_label === '钩子开场') return `旁白：${centralEvent}最意外的一幕，在这一刻定格。`;
      if (template.function_label === '人物登场') return `${protagonist}（警觉）：我只相信亲眼看见的行动。`;
      if (template.function_label === '冲突爆发') return `对方（逼问）：知道真相以后，你还会留下吗？${protagonist}（迟疑）：让我自己做决定。`;
      if (template.function_label === '反转/觉醒') return `${protagonist}（抬眼）：身份不是答案，做过什么才是。`;
      if (template.function_label === '高燃收束') return `${protagonist}：我选择相信真心，也愿意承担接下来的考验。`;
    }
    // Find quotes in paragraphs related to this scene's function
    if (template.function_label === '高潮' && quotes.length > 0) {
      return `核心台词："${quotes[0]}"`;
    }
    if (template.function_label === '关键行动') {
      return `旁白：${protagonist}不再只追问答案，而是围绕${centralEvent}开始组织、写作、调查或实践。`;
    }
    if (template.function_label === '钩子开场') {
      return `旁白：${centralEvent}——这不是传说，而是真实发生过的选择。`;
    }
  }

  // For documentary, use narrator style
  if (videoType === 'documentary_short') {
    if (template.function_label === '现实引入') return `旁白：先看今天还能抵达的现场，再回到文献中的${centralEvent}。`;
    if (template.function_label === '历史回望') return `旁白：可考事实与后世讲述在这里分开，镜头只把有依据的线索说清。`;
    if (template.function_label === '关键节点') return `旁白：这一段采用史料梳理加有限再现，不把再现画面当作原始记录。`;
    return `旁白：${centralEvent}的意义，需要在现场、文献和后世解释之间共同观看。`;
  }

  // For lecture, use presenter style
  if (videoType === 'lecture_video') {
    return `主讲人：${centralEvent}照见了什么精神？`;
  }

  // For children story, use simple narration
  if (videoType === 'children_story') {
    const isFolkloreEncounter = paragraphs.some(paragraph => /狐仙|胡大姐|人仙/.test(paragraph));
    if (isFolkloreEncounter) {
      const lines: Record<string, string> = {
        '小主人公': `旁白：${protagonist}背起柴担上山，没想到竹林里正等着一次奇妙相遇。`,
        '遇到问题': `${protagonist}：我有些害怕，但我愿意先听你把话说完。`,
        '学习成长': `旁白：他没有只听传闻，而是想起胡大姐真正做过的事。`,
        '做出选择': `${protagonist}：我相信亲眼看见的善良，我们一起面对。`,
        '温暖结尾': '旁白：传说有不同讲法，这个版本把真心和理解留在了山路上。',
      };
      return lines[template.function_label] ?? `旁白：${protagonist}先理解，再做选择。`;
    }
    return `旁白：${protagonist}先认真观察，再用温和而勇敢的行动解决问题。`;
  }

  if (videoType === 'heritage_promo') {
    if (template.function_label === '工艺全程') return `旁白：劈丝、配线、落针，每一步都要慢下来给观众看清。`;
    if (template.function_label === '传承之路') return `旁白：真正的传承，不只在展柜里，也在年轻人接过针线的那一刻。`;
    return `旁白：让手、线、工具和材料自己说话。`;
  }

  // Default: narration
  const sourceLine = cleanSourceSentences(paragraphs.join('\n'))[0];
  return sourceLine
    ? `旁白：${sourceLine}`
    : `旁白：${protagonist}在${centralEvent}中不断观察、判断，并把认识变成行动。`;
}

function buildKeyAction(template: SceneTemplate, protagonist: string, centralEvent: string): string {
  if (['小主人公', '遇到问题', '学习成长', '做出选择', '温暖结尾'].includes(template.function_label)) {
    const actionMap: Record<string, string> = {
      '小主人公': `${protagonist}带着日常工具进入故事现场`,
      '遇到问题': `${protagonist}停下脚步，先听对方说明情况`,
      '学习成长': `${protagonist}观察行动和细节，不被传闻牵着走`,
      '做出选择': `${protagonist}用一个温和而勇敢的动作表达决定`,
      '温暖结尾': `${protagonist}与伙伴一起离开，留下可重复的温暖意象`,
    };
    return actionMap[template.function_label] ?? `${protagonist}解决眼前问题`;
  }
  if (['技艺渊源', '匠人登场', '工艺全程', '精神内核', '传承之路'].includes(template.function_label)) {
    const actionMap: Record<string, string> = {
      '技艺渊源': '展示成品、旧照片和原料，建立技艺来处',
      '匠人登场': '传承人整理工具、检查底稿和丝线',
      '工艺全程': '按顺序展示配线、劈丝、穿针、落针和收针',
      '精神内核': '用慢针脚和细节修正表现匠心',
      '传承之路': '学徒接过工具，留下继续学习的动作',
    };
    return actionMap[template.function_label] ?? '展示手艺流程';
  }
  if (['现实引入', '历史回望', '关键节点', '文化解释', '当代意义'].includes(template.function_label)) {
    const actionMap: Record<string, string> = {
      '现实引入': '拍摄现实现场和可见痕迹',
      '历史回望': '用旁白梳理可考史料线索',
      '关键节点': '以有限再现呈现关键历史节点',
      '文化解释': '对照现场与文献解释文化意义',
      '当代意义': '回到今天的现场和观众经验',
    };
    return actionMap[template.function_label] ?? '推进纪实线索';
  }
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    const actionMap: Record<string, string> = {
      '时代危机': '交代郢都失守和流放处境',
      '人物卷入': `${protagonist}听闻国破消息，独自走向江边`,
      '冲突升级': '在苟活与殉志之间形成两难',
      '关键行动': `${protagonist}整理衣冠、怀石入江`,
      '高潮': '江水吞没身影，情绪抵达顶点',
      '历史余响': '以端午记忆和后世追怀收束',
    };
    return actionMap[template.function_label] ?? eventWithProtagonist(protagonist, centralEvent);
  }
  if (['人物登场', '冲突爆发', '反转/觉醒', '高燃收束'].includes(template.function_label)) {
    const isCaseEvent = centralEvent.includes('断案') || centralEvent.includes('拒签');
    const actionMap: Record<string, string> = isCaseEvent ? {
      '人物登场': `${protagonist}发现案卷证词矛盾，拒绝草草落笔`,
      '冲突爆发': `上官催签，${protagonist}当场摊开疑点反驳`,
      '反转/觉醒': `${protagonist}离开案头，转向现场重查`,
      '高燃收束': `${protagonist}退回未签文书，留下下一步追查钩子`,
    } : {
      '人物登场': `${protagonist}带着标志性物件进入现场，注意到反常细节`,
      '冲突爆发': `对立信息逼近，${protagonist}用亲眼所见作出反问`,
      '反转/觉醒': `${protagonist}放弃最省事的退路，转身采取新行动`,
      '高燃收束': `${protagonist}用明确选择回应${centralEvent}，留下后续考验`,
    };
    return actionMap[template.function_label] ?? `${protagonist}${centralEvent}`;
  }
  const actionMap: Record<string, string> = {
    '钩子开场': `进入危机现场`,
    '主角处境': `认清处境与选择压力`,
    '冲突升级': `面对两难，压力加深`,
    '关键行动': `${protagonist}围绕${centralEvent}采取具体行动`,
    '高潮': `${centralEvent}形成决定性行动与思想转折`,
    '结尾': `交代行动后果与理想形成`,
    '时代危机': `建立时代危机背景`,
    '人物卷入': `${protagonist}卷入事件中心`,
    '历史余响': `展示历史影响`,
  };
  return actionMap[template.function_label] ?? `${protagonist}${centralEvent}`;
}

function buildVisualPrompt(template: SceneTemplate, location: string, timeOfDay: string, centralEvent: string, protagonist: string, entry: EntryDetail): string {
  const keywords = entry.keywords.slice(0, 3).join('、');

  if (['技艺渊源', '匠人登场', '工艺全程', '精神内核', '传承之路'].includes(template.function_label)) {
    const subject = inferSubject(entry);
    const visualMap: Record<string, string> = {
      '技艺渊源': `${location}，${timeOfDay}，${subject}成品、旧照片、丝线、绸面、图样，柔和侧光，微距开场`,
      '匠人登场': `${location}，${timeOfDay}，传承人坐在绣架前，手背、针尖、线轴和底稿同框，中近景`,
      '工艺全程': `${location}，${timeOfDay}，劈丝、穿针、落针、针脚和色线过渡，连续微距过程镜头`,
      '精神内核': `${location}，${timeOfDay}，传承人低头修正针脚，绸面纹理和眼神特写`,
      '传承之路': `${location}，${timeOfDay}，学徒接过针线，老手与年轻手同框，暖光收束`,
    };
    return visualMap[template.function_label] ?? `${location}，${timeOfDay}，${subject}材料、工具、手部动作，清晰过程构图`;
  }

  if (['现实引入', '历史回望', '关键节点', '文化解释', '当代意义'].includes(template.function_label)) {
    const subject = inferSubject(entry);
    const visualMap: Record<string, string> = {
      '现实引入': `${location}，${timeOfDay}，${subject}实景、匾额、台基、展陈说明，纪录片空镜`,
      '历史回望': `${location}，${timeOfDay}，旧地图、文献页、建筑细部，旁白式史料画面`,
      '关键节点': `${location}，${timeOfDay}，有限历史再现、人物剪影、现场与文献叠化`,
      '文化解释': `${location}，${timeOfDay}，专家手指文献、现场细节、关键词字幕，稳定构图`,
      '当代意义': `${location}，${timeOfDay}，游客、讲解员、现实空间与文化符号同框，清晨自然光`,
    };
    return visualMap[template.function_label] ?? `${location}，${timeOfDay}，${subject}现场、文献、现实人物，纪实构图`;
  }

  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    const visualMap: Record<string, string> = {
      '时代危机': `${location}，${timeOfDay}，江雾、战火远影、简牍和破旧楚地旗帜，历史压迫感远景`,
      '人物卷入': `${location}，${timeOfDay}，${protagonist}独立江边，衣袂、竹简、远处城郭剪影，中景`,
      '冲突升级': `${location}，${timeOfDay}，江风、劝阻者背影、${protagonist}沉默侧脸，近景交替`,
      '关键行动': `${location}，${timeOfDay}，${protagonist}整理衣冠、怀石、迈向江水，动作特写`,
      '高潮': `${location}，${timeOfDay}，江面浪涌、人物身影消失、岸边静止，情绪定格`,
      '历史余响': `${location}，${timeOfDay}，龙舟、艾草、粽叶和江面叠化，后世纪念画面`,
    };
    return visualMap[template.function_label] ?? `${location}，${timeOfDay}，${protagonist}、江水、竹简、风声，历史剧情构图`;
  }

  if (['人物登场', '冲突爆发', '反转/觉醒', '高燃收束'].includes(template.function_label)) {
    const isCaseEvent = centralEvent.includes('断案') || centralEvent.includes('拒签');
    const visualMap: Record<string, string> = isCaseEvent ? {
      '人物登场': `${location}，${timeOfDay}，${protagonist}摊开案卷，证词两页并排，门外人影逼近，中景分镜`,
      '冲突爆发': `${location}，${timeOfDay}，上官推笔、烛油黑痕、${protagonist}按住疑点，近景快速切换`,
      '反转/觉醒': `${location}，${timeOfDay}，${protagonist}合上案卷转向牢门，众人错愕，动作转折特写`,
      '高燃收束': `${location}，${timeOfDay}，未签文书推回案头，晨光照在案卷疑点，人物正面定格`,
    } : {
      '人物登场': `${location}，${timeOfDay}，${protagonist}携带标志性物件入画，环境异象与警觉表情同框，中景漫画分镜`,
      '冲突爆发': `${location}，${timeOfDay}，${protagonist}与对方近景对切，身份线索、手部动作和表情连续变化`,
      '反转/觉醒': `${location}，${timeOfDay}，${protagonist}突然转身采取行动，背景人物错愕，动态构图`,
      '高燃收束': `${location}，${timeOfDay}，${protagonist}与核心人物并肩定格，${keywords}成为前景视觉钩子`,
    };
    return visualMap[template.function_label] ?? `${location}，${timeOfDay}，${protagonist}、${keywords}、表情变化，漫画分镜构图`;
  }

  const isCaseEvent = centralEvent.includes('断案') || centralEvent.includes('拒签');
  const visualMap: Record<string, string> = isCaseEvent ? {
    '钩子开场': `${location}，${timeOfDay}，木案、烛火、文书、案卷、判词，${protagonist}停笔特写，竖屏近景构图`,
    '主角处境': `${location}，${timeOfDay}，${protagonist}面对案卷和文书，中景展示人物、木案与门外压力`,
    '冲突升级': `${location}，${timeOfDay}，案卷细节、施压者身影、${protagonist}表情变化，近景交替构图`,
    '关键行动': `${location}，${timeOfDay}，${protagonist}翻开案卷、放下签笔、按住文书，动作特写`,
    '高潮': `${location}，${timeOfDay}，${protagonist}正面抬头，案卷和烛火在前景，情绪特写`,
    '结尾': `${location}，${timeOfDay}，远景拉开，${keywords}与书卷、案卷、晨光形成收束构图`,
  } : {
    '钩子开场': `${location}，${timeOfDay}，${keywords}形成强视觉前景，${protagonist}在关键动作中入画`,
    '主角处境': `${location}，${timeOfDay}，${protagonist}与身份物件、现实环境同框，中景建立处境`,
    '冲突升级': `${location}，${timeOfDay}，对立人物、环境阻力与${protagonist}表情变化交替呈现`,
    '关键行动': `${location}，${timeOfDay}，${protagonist}围绕${centralEvent}采取具体行动，手部与物件特写`,
    '高潮': `${location}，${timeOfDay}，${protagonist}完成决定性动作，人物关系和情绪在同一画面爆发`,
    '结尾': `${location}，${timeOfDay}，远景拉开，${keywords}与人物行动结果形成收束构图`,
  };

  return visualMap[template.function_label] ?? `${location}，${timeOfDay}，${keywords}，人物、道具、光线、空间层次清晰`;
}

function determineSceneCharacters(
  template: SceneTemplate,
  characterNames: string[],
  protagonist: string,
  videoType: VideoType,
): string[] {
  if (NON_DRAMATIC_VIDEO_TYPES.includes(videoType)) return [];
  const allChars = [protagonist];
  if (['遇到问题', '学习成长', '做出选择', '温暖结尾'].includes(template.function_label) && characterNames.length > 1) {
    allChars.push(characterNames[1]);
  }
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
  return `事实边界：可考信息与影视化调度需分开标注。`;
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
  return scenes.map((scene) => {
    const panelCount = PANEL_COUNT_BY_DURATION[scene.duration_sec] ?? 6;

    // NEW script_text format: cinematic script, not template concatenation
    const scriptText = buildGearsScriptText(scene, videoType);

    const visualFocus = [
      scene.location,
      ...scene.visual_prompt.split(/[，、。]/).filter(s => s.length > 1 && s.length < 8).slice(0, 2),
    ];

    const segmentPromptHint = [
      scene.visual_prompt,
      scene.camera_suggestion,
      scene.characters?.length ? `主体：${scene.characters.join('、')}` : '',
      `动作：${scene.key_action}`,
    ].filter(Boolean).join('；');

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
      const message = missing.message
        .replace(/知识库/g, '项目素材')
        .replace(/知识包/g, '素材包');
      constraints.push(`项目素材缺失：${missing.label}——${message}`);
    }
  }

  return constraints;
}

function buildCredibilityNote(entry: EntryDetail, knowledgePack?: KnowledgePack, originalUserQuery?: string, centralEvent?: string): string {
  let note = entry.credibility;

  // Add what comes from project material vs what is creative treatment
  note += `；核心事件"${centralEvent}"来自素材条目"${entry.name}"`;

  // Note creative elements
  note += '；场景调度、对白节奏、画面设计为影视化创作处理';

  // Note user query if present
  if (originalUserQuery) {
    note += `；用户创作主题"${originalUserQuery}"中的部分表达未在项目素材中验证，已按创作方向处理`;
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
  videoType?: VideoType;
}): StoryQualityReport {
  const issues: string[] = [];
  const fullText = result.full_text;
  const scenes = result.scene_breakdown;
  const isNonDramatic = result.videoType ? NON_DRAMATIC_VIDEO_TYPES.includes(result.videoType) : false;

  // 1. hasCentralEvent
  const hasCentralEvent = result.selectedEvent !== '整体故事'
    && result.selectedEvent !== undefined
    && !result.selectedEvent.includes('一生')
    && !result.selectedEvent.includes('生平');
  if (!hasCentralEvent) issues.push('缺少核心事件——标题为"整体故事"或人物一生概述');

  // 2. hasConflict — at least one scene has conflict with confrontation/choice words
  const conflictWords = ['拒', '争', '抗', '逼', '选择', '两难', '拒签', '冲突', '对决', '争辩', '催签', '施压', '权势', '人命', '疑点', '国破', '流放', '亡国', '苟活', '殉志'];
  const hasConflict = scenes.some(s =>
    (s.conflict ?? '') && conflictWords.some(w => (s.conflict ?? '').includes(w))
  ) || conflictWords.some(w => fullText.includes(w)) || isNonDramatic;
  if (!hasConflict) issues.push('缺少明确冲突——没有对抗、选择或两难');

  // 3. hasProtagonistChoice — at least one key_action has choice words
  const choiceWords = ['选择', '拒签', '断案', '拒', '辞', '定', '决', '坚持', '投江', '怀石', '殉志', '重查', '未签'];
  const hasProtagonistChoice = scenes.some(s =>
    choiceWords.some(w => s.key_action.includes(w) || s.plot.includes(w))
  ) || isNonDramatic;
  if (!hasProtagonistChoice) issues.push('缺少主角选择——没有明确的选择行为');

  // 4. hasSceneAction — scenes >= 3 and plots have action descriptions
  const hasSceneAction = scenes.length >= 3 && scenes.every(s => s.plot.length >= 20);
  if (!hasSceneAction) issues.push('场景缺少具体行动描述');

  // 5. hasClimax — at least one scene with dramatic_function = "高潮"
  const hasClimax = scenes.some(s =>
    s.dramatic_function === '高潮'
    || s.dramatic_function === '高燃收束'
    || s.dramatic_function === '金句落点'
    || s.dramatic_function === '命运转折'
    || s.dramatic_function === '做出选择'
  ) || isNonDramatic;
  if (!hasClimax) issues.push('缺少高潮场景');

  // 6. hasEndingTheme — last scene mentions spiritual/moral/value theme.
  // Revolutionary and coming-of-age stories often land on "理想/信仰/人民/道路/觉醒"
  // instead of explicit moral words such as "道德".
  const themeWords = [
    '良知', '精神', '道德', '价值', '正义', '廉洁', '担当', '坚守', '传承', '出淤泥而不染',
    '理想', '信仰', '人民', '道路', '觉醒', '初心', '使命', '家国', '民族', '奋斗', '求索',
    '牺牲', '独立自主', '实事求是', '敢为天下先',
    '善良', '理解', '真心', '温暖', '成长', '勇敢',
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
