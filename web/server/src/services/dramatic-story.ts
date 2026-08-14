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
  StoryAdaptationAnalysis,
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

function isRefusalEvent(value?: string): boolean {
  return Boolean(value && /(?:拒签|拒绝(?:签押|签字|落笔))/.test(value));
}

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
    if (
      name !== protagonist
      && !isPartialProtagonistName(name, protagonist)
      && isUsableCharacterName(name)
    ) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  for (const [name, count] of counts) {
    if (count >= 2) chars.push(name);
  }
  const namedPersonPattern = /^[赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳史唐费薛雷贺倪汤滕殷罗毕郝邬安常乐于傅皮卞齐康伍余元顾孟黄穆萧尹姚邵汪祁毛禹狄米贝明臧计伏成戴宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪解应宗丁宣邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊甄曲封芮储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲台从鄂索咸籍赖卓蔺蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边燕冀浦尚农温别庄晏柴瞿阎慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公][\u4e00-\u9fa5]{1,3}$/;
  for (const keyword of keywords) {
    const candidate = keyword.trim();
    if (candidate === protagonist || chars.includes(candidate) || isPartialProtagonistName(candidate, protagonist)) continue;
    if (/砍樵|传书|起义|会师|运动|文化|传说|花鼓戏|狐仙$/.test(candidate)) continue;
    if (/^(?:慎动|主静|无极|太极|理学|道学|心学)$/.test(candidate)) continue;
    if (/(?:书|说|经|论|集|记|传|志|图)$/.test(candidate)) continue;
    if (namedPersonPattern.test(candidate) || /大姐|姑娘|龙女$/.test(candidate)) chars.push(candidate);
  }
  return chars.slice(0, 6);
}

function isPartialProtagonistName(candidate: string, protagonist: string): boolean {
  if (candidate.length < 2 || protagonist.length < 2) return false;
  return protagonist.startsWith(candidate) || candidate.startsWith(protagonist);
}

function isUsableCharacterName(name: string): boolean {
  if (/^(?:知军|上官|官员|司理参军)$/.test(name)) return false;
  if (/可作为|作为|不该|地方|后世|今永州|道县|衡阳|汝城|濂溪|书院|遗址|案件|案卷|文书|判词|选择|核心/.test(name)) return false;
  return name.length >= 2 && name.length <= 5;
}

function selectEventCharacterNames(
  characterNames: string[],
  protagonist: string,
  centralEvent: string,
  eventParagraphs: string[],
): string[] {
  if (!isRefusalEvent(centralEvent)) return characterNames;

  const eventText = eventParagraphs.join('\n');
  return eventText.includes('王逵') || characterNames.includes('王逵')
    ? [protagonist, '王逵']
    : [protagonist];
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
  if (isRefusalEvent(centralEvent)) return '南安军';
  if (centralEvent.includes('断案')) return '分宁县';
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) return '汨罗江畔';
  if (videoType === 'documentary_short' || videoType === 'heritage_promo') return subjectPlace(entry);
  return cleanPlaceName(entry.region) || subjectPlace(entry);
}

function inferSubject(entry: EntryDetail): string {
  return entry.name.split('——')[0].trim();
}

export function inferProtagonist(entry: EntryDetail, videoType: VideoType): string {
  const subject = inferSubject(entry);
  if (!DRAMATIC_VIDEO_TYPES.includes(videoType)) return subject;

  const eventNameMatch = subject.match(/^([\u4e00-\u9fa5]{2,4}?)(?:投江|殉国|断案|拒签|拒绝|治案|悟道|砍樵|传书|起义|会师|抗日|创立|修建|改建|被贬|求学)/);
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
  if (isRefusalEvent(centralEvent)) return `${eventShort}`;
  if (centralEvent.includes('断案')) return `${protagonist}${eventShort}`;
  if (centralEvent.includes('投江')) return `${eventShort}`;
  if (centralEvent.includes('殉国')) return `${eventShort}`;

  // For documentary/lecture, use more descriptive title
  if (videoType === 'documentary_short' || videoType === 'lecture_video') {
    if (eventShort === protagonist || eventShort.startsWith(`${protagonist}：`)) return eventShort;
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
  adaptationAnalysis?: StoryAdaptationAnalysis;
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
  const {
    entry,
    centralEvent,
    videoType,
    presentationStyle,
    targetDuration,
    tone,
    knowledgePack,
    originalUserQuery,
    adaptationAnalysis,
  } = input;

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
  const extractedCharacterNames = extractCharacterNames(entry.story, entry.name, protagonist, entry.keywords);
  const characterNames = selectEventCharacterNames(
    extractedCharacterNames,
    protagonist,
    centralEvent,
    eventParagraphs,
  );

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
  const requestedAdaptationArc = !requestedGrowthArc && adaptationAnalysis && originalUserQuery
    ? buildLocalAdaptationArc({
        source: originalUserQuery,
        analysis: adaptationAnalysis,
        templates,
        entry,
        centralEvent,
        videoType,
        perSceneDuration,
      })
    : undefined;
  const requestedLegendArc = !requestedGrowthArc && !requestedAdaptationArc
    ? buildLiuHaiLegendArc({
        entry,
        centralEvent,
        videoType,
        perSceneDuration,
      })
    : undefined;
  const requestedCulturePromoArc = !requestedGrowthArc && !requestedAdaptationArc && !requestedLegendArc
    ? buildYueluCulturePromoArc({
        entry,
        videoType,
        perSceneDuration,
      })
    : undefined;
  const requestedCityBrandArc = !requestedGrowthArc
    && !requestedAdaptationArc
    && !requestedLegendArc
    && !requestedCulturePromoArc
    ? buildChangshaCityBrandArc({
        entry,
        videoType,
        perSceneDuration,
        totalSeconds,
      })
    : undefined;
  const requestedDocumentaryArc = !requestedGrowthArc
    && !requestedAdaptationArc
    && !requestedLegendArc
    && !requestedCulturePromoArc
    && !requestedCityBrandArc
    ? buildYueluDocumentaryArc({
        entry,
        videoType,
        perSceneDuration,
      })
    : undefined;
  const requestedLandscapeArc = !requestedGrowthArc
    && !requestedAdaptationArc
    && !requestedLegendArc
    && !requestedCulturePromoArc
    && !requestedDocumentaryArc
    ? buildWulingyuanLandscapeArc({
        entry,
        videoType,
        perSceneDuration,
        totalSeconds,
      })
    : undefined;
  const scenes: StoryScene[] = requestedGrowthArc
    ?? requestedAdaptationArc
    ?? requestedLegendArc
    ?? requestedCulturePromoArc
    ?? requestedCityBrandArc
    ?? requestedDocumentaryArc
    ?? requestedLandscapeArc
    ?? [];
  const fullTextParts: string[] = scenes.map(scene => scene.plot);

  if (
    !requestedGrowthArc
    && !requestedAdaptationArc
    && !requestedLegendArc
    && !requestedCulturePromoArc
    && !requestedCityBrandArc
    && !requestedDocumentaryArc
    && !requestedLandscapeArc
  ) {
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

  if (!requestedAdaptationArc && videoType === 'historical_drama') {
    const historicalArc = enhanceWuchangUprisingAdaptationScenes(scenes, {
      source: entry.story,
      entry,
      perSceneDuration,
      sourceMode: 'knowledge_only',
    });
    if (historicalArc) {
      scenes.splice(0, scenes.length, ...historicalArc);
      fullTextParts.splice(0, fullTextParts.length, ...historicalArc.map(scene => scene.plot));
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
  const adaptationUsesSceneCharacters = Boolean(requestedAdaptationArc && [
    'historical_drama',
    'legend_story',
  ].includes(videoType));
  const arcCharacterNames = requestedGrowthArc || requestedLegendArc || adaptationUsesSceneCharacters
    ? [...new Set((requestedGrowthArc ?? requestedLegendArc ?? requestedAdaptationArc ?? []).flatMap(scene => scene.characters))]
    : characterNames;
  const characters = requestedGrowthArc
    ? buildMaoGrowthArcCharacters(arcCharacterNames)
    : adaptationUsesSceneCharacters
      ? buildAdaptationArcCharacters(arcCharacterNames, videoType)
    : videoType === 'scene_short'
      ? buildSceneShortCharacters(entry)
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
    : requestedAdaptationArc && videoType === 'historical_drama' && /武昌起义/.test(entry.name)
      ? [{
          starting_state: '起义计划泄露，普通新军士兵面临继续等待即被搜捕、立即行动则可能失败的压力。',
          turning_point: '士兵选择抢在搜捕前发动，并通过争夺楚望台军械库把决定变成集体行动。',
          resolution: '普通士兵的行动从营房扩展到武昌城，并成为更广泛革命连锁反应的重要开端。',
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
    scene.source_entries = [...new Set([entry.name, ...(scene.source_entries ?? [])])];
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

function buildLocalAdaptationArc(input: {
  source: string;
  analysis: StoryAdaptationAnalysis;
  templates: SceneTemplate[];
  entry: EntryDetail;
  centralEvent: string;
  videoType: VideoType;
  perSceneDuration: number;
}): StoryScene[] | undefined {
  if (!DRAMATIC_VIDEO_TYPES.includes(input.videoType)) return undefined;
  const sourceUnits = input.source
    .split(/\n{2,}|(?<=[。！？!?；;])\s*/)
    .map(unit => unit.trim())
    .filter(unit => unit.length >= 8);
  if (sourceUnits.length < 2) return undefined;

  const names = [...input.analysis.core_characters]
    .sort((left, right) => input.source.indexOf(left) - input.source.indexOf(right));
  const fallbackLocation = narrativePlace(input.entry, input.centralEvent, input.videoType);
  let previousLocation = fallbackLocation;
  const unitLocations = sourceUnits.map(unit => {
    const explicit = unit.match(/南安军衙|楚望台军械库|湖广总督署|武昌城|山路|竹林|家门口|城门|街巷|院子|屋内|江畔|村口/)?.[0];
    if (explicit) previousLocation = explicit;
    return previousLocation;
  });
  const endingTheme = adaptationEndingTheme(input.videoType);

  const scenes = input.templates.map((template, index) => {
    const sourceIndex = Math.min(
      sourceUnits.length - 1,
      Math.floor(index * sourceUnits.length / input.templates.length),
    );
    const unit = sourceUnits[sourceIndex];
    const location = unitLocations[sourceIndex] ?? fallbackLocation;
    const sceneNames = names.filter(name => unit.includes(name));
    const activeNames = sceneNames.length > 0 ? sceneNames : names.slice(0, 2);
    const boundary = input.videoType === 'legend_story'
      ? '本场按用户原作改编，并保留民间传说边界，不写成可考史实。'
      : '本场主线、人物与行动来自用户提供的改编素材；具体镜头调度为有限创作组织。';
    const isEndingScene = index === input.templates.length - 1;
    const visualAction = sourceIndex === 0
      ? '镜头从环境细节推进到人物的第一个异常发现，动作与关键物件同框。'
      : isEndingScene
        ? '镜头跟住选择后的行动与可见后果，最后停在尚未消失的情绪余波。'
        : '镜头沿人物移动、对峙与关键物件推进，让阻力和选择在同一空间发生。';
    const thematicLanding = isEndingScene ? endingTheme : '';
    return {
      scene_id: index + 1,
      title: buildSceneTitle(template, input.centralEvent, index),
      duration_sec: input.perSceneDuration,
      location,
      time_of_day: /雨夜|夜里|夜晚|雷光/.test(unit) ? '雨夜' : determineTimeOfDay(index, input.centralEvent, sourceUnits),
      dramatic_function: template.function_label,
      plot: `${unit}${visualAction}${thematicLanding}`,
      key_action: `把“${unit.slice(0, 32)}”落实为连续可见行动`,
      characters: activeNames,
      visual_prompt: `${location}，${activeNames.join('、') || '事件主体'}，关键物件与动作前后连续，环境光线明确，${visualAction}`,
      camera_suggestion: sourceIndex === 0 ? '环境近景切人物反应，再跟随关键动作推进' : '中近景跟拍动作，关键物件特写承接前后镜头',
      cultural_note: boundary,
      conflict: /逼|催|怀疑|劝|危机|搜捕|考验|失去|误会/.test(unit)
        ? `原作中的现实阻力在本场逼近，人物必须以行动回应：${unit.slice(0, 45)}`
        : `人物正在推进原作主线，并承担上一行动产生的后果。`,
      dialogue_or_narration: `旁白：${unit}`,
      source_entries: [input.entry.name, '用户提供改编素材'],
      factual_basis: '本场主线来自用户提供改编素材；与知识库事实边界分别记录。',
      fictionalized_elements: ['镜头顺序、景别与场内调度为改编所需的有限影视化组织。'],
    };
  });
  if (input.videoType === 'historical_drama') {
    const historicalArc = enhanceWuchangUprisingAdaptationScenes(scenes, input);
    if (historicalArc) return historicalArc;
  }
  return input.videoType === 'legend_story'
    ? enhanceLegendAdaptationScenes(scenes, input)
    : scenes;
}

function enhanceWuchangUprisingAdaptationScenes(
  scenes: StoryScene[],
  input: {
    source: string;
    entry: EntryDetail;
    perSceneDuration: number;
    sourceMode?: 'knowledge_only' | 'user_adaptation';
  },
): StoryScene[] | undefined {
  const sourceText = [input.source, input.entry.name, input.entry.story].join('\n');
  if (!/武昌起义/.test(sourceText) || !/楚望台军械库/.test(sourceText) || scenes.length !== 6) return undefined;

  const userAdaptation = input.sourceMode !== 'knowledge_only';
  const sourceEntries = userAdaptation
    ? [input.entry.name, '用户提供改编素材']
    : [input.entry.name];
  const makeScene = (
    scene: Omit<StoryScene, 'scene_id' | 'duration_sec' | 'source_entries'>,
    index: number,
  ): StoryScene => ({
    ...scene,
    scene_id: index + 1,
    duration_sec: input.perSceneDuration,
    source_entries: sourceEntries,
  });
  const sharedBoundary = userAdaptation
    ? '主线和人物群体来自用户素材；10月9日至10日、搜捕、楚望台军械库与湖广总督署依据知识条目。个体走位和无名士兵反应为有限合成再现。'
    : '10月9日至10日、搜捕、楚望台军械库与湖广总督署依据知识条目；个体走位、无名士兵反应和镜头调度为有限合成再现。';

  return [
    makeScene({
      title: '泄密后的夜',
      location: '武昌新军营房',
      time_of_day: '10月9日深夜',
      dramatic_function: '时代危机',
      plot: '1911年10月9日，起义计划因汉口俄租界的意外爆炸泄露。搜捕名单和三名革命党人遇害的消息传进武昌新军营房，军靴声沿街逼近；士兵们知道，原定计划已经失去等待的时间。',
      key_action: '新军士兵传递泄密与搜捕消息，关上营门并检查枪械',
      characters: ['新军士兵'],
      visual_prompt: '1911年10月9日武昌新军营房深夜，搜捕名单、军靴、营门、枪架与急促传递消息的新军士兵，冷色低光',
      camera_suggestion: '从搜捕名单特写切到街外军靴，再推入营房内彼此传递消息的士兵群像',
      cultural_note: sharedBoundary,
      conflict: '清军搜捕正在逼近，继续等待会让人员和计划同时暴露',
      dialogue_or_narration: '旁白：计划一旦泄露，原来的时间表就成了危险。',
      factual_basis: '条目记载10月9日意外爆炸导致计划泄露，清军随即搜捕并处死三名革命党人。',
      fictionalized_elements: ['搜捕名单进入营房和具体传递动作是合成再现，不作为原始记录。'],
    }, 0),
    makeScene({
      title: '提前发动',
      location: '武昌新军营房',
      time_of_day: '10月10日傍晚',
      dramatic_function: '人物卷入',
      plot: '10月10日傍晚，新军士兵围住铺开的武昌地图：若按原计划等待，清军可能先封营搜捕；若立即发动，他们就要在准备不足时承担伤亡和失败。领头士兵收起地图、推开营门，众人选择抢在搜捕前行动。',
      key_action: '新军士兵收起地图、推开营门，选择提前发动并承担失败风险',
      characters: ['新军士兵'],
      visual_prompt: '1911年10月10日傍晚，武昌新军营房，武昌地图、营门、枪械，新军士兵围桌后收图推门，暖灯与门外夜色对比',
      camera_suggestion: '俯拍地图与封锁位置，切士兵互看，跟拍收图、背枪、推门三个连续动作',
      cultural_note: sharedBoundary,
      conflict: '等待会遭搜捕瓦解 vs 准备不足仍提前发动并承担伤亡风险',
      dialogue_or_narration: '无名士兵低声说：“再等，等来的就是搜捕。”这句对白为影视化补足。',
      factual_basis: userAdaptation
        ? '依据用户素材“决定抢在清军搜捕前发动”及条目所载10月10日晚起义爆发。'
        : '条目记载10月9日计划泄露并引发搜捕，10月10日晚新军士兵提前发动起义。',
      fictionalized_elements: ['围图决策、推门动作与无名士兵对白为合成场景，不替代真实组织决策。'],
    }, 1),
    makeScene({
      title: '营门枪响',
      location: '工程第八营营门',
      time_of_day: '10月10日晚',
      dramatic_function: '冲突升级',
      plot: '10月10日晚，阻拦起义的军官封住营门。前排士兵停了一瞬，后队已被街外搜捕声逼近；枪声打破僵持，全营随即响应。镜头不指定“唯一第一枪”，只记录基层士兵从迟疑转为集体行动。',
      key_action: '前排士兵冲开营门，枪声后全营持枪响应',
      characters: ['新军士兵', '起义军'],
      visual_prompt: '1911年10月10日晚工程营营门，封门军官、持枪新军、街外搜捕火把，枪声后营房人群涌出，克制历史再现',
      camera_suggestion: '营门对峙中景，切停住的手和逼近火把，枪响后跟拍队伍冲出',
      cultural_note: '条目记载金兆龙、程定国等基层士兵率先行动，但具体经过有回忆差异；本场不宣称唯一第一枪人物。',
      conflict: '军官封门阻拦，街外搜捕逼近，士兵必须把决定变成不可逆的行动',
      dialogue_or_narration: '旁白：这一刻，计划不再写在纸上，而由普通士兵亲手推进。',
      factual_basis: '依据条目关于10月10日晚工程营士兵率先行动、全营响应的记载。',
      fictionalized_elements: ['对峙时长、火把位置和人物反应为有限再现；不虚构唯一第一枪归属。'],
    }, 2),
    makeScene({
      title: '争夺军械库',
      location: '楚望台军械库',
      time_of_day: '10月10日晚',
      dramatic_function: '关键行动',
      plot: '起义军冲到楚望台军械库，守军把库门合到一半。前队顶住门板，后队搬开障碍，士兵推开库门、接力搬出枪械和弹药箱；获得弹药后，队伍才有能力继续向湖广总督署推进。',
      key_action: '起义军顶门、推开库门并接力搬出枪械与弹药箱',
      characters: ['起义军', '普通士兵'],
      visual_prompt: '楚望台军械库夜晚，半合库门、木障碍、枪架、弹药箱，起义军顶门推门并接力搬运，火光与烟尘',
      camera_suggestion: '低机位拍顶门脚步，切门闩和弹药箱特写，再跟拍武器递出形成行动链',
      cultural_note: sharedBoundary,
      conflict: '守军封锁军械库，起义军若拿不到弹药就无法把行动推进到总督署',
      dialogue_or_narration: '旁白：军械库不是背景，它决定这场起义能否从营房走向全城。',
      factual_basis: userAdaptation
        ? '用户素材与知识条目均记载起义军攻占楚望台军械库、获得弹药后攻向湖广总督署。'
        : '知识条目记载起义军攻占楚望台军械库、获得弹药后攻向湖广总督署。',
      fictionalized_elements: ['顶门与接力搬箱的具体分工为依据已知行动所作的影视化组织。'],
    }, 3),
    makeScene({
      title: '从军械库到总督署',
      location: '楚望台至湖广总督署街路',
      time_of_day: '10月10日深夜',
      dramatic_function: '高潮',
      plot: '从楚望台军械库搬出的枪械被分到各队，普通士兵沿街传令，新的队伍从不同营门汇入。因为军械库被攻占，起义军得以向湖广总督署推进；总督署方向的守军动摇，武昌城内出现第一轮连锁响应。',
      key_action: '普通士兵分发军械、沿街传令，汇合队伍向湖广总督署推进',
      characters: ['普通士兵', '起义军'],
      visual_prompt: '武昌夜街，楚望台弹药箱、分发枪械的普通士兵、奔跑传令者、汇入队伍与远处湖广总督署门楼，多线汇合构图',
      camera_suggestion: '从弹药递手特写开始，跟随传令者穿街，拉远看多支队伍汇向总督署',
      cultural_note: sharedBoundary,
      conflict: '队伍必须在清军重新组织前把军械优势转化为对总督署的推进',
      dialogue_or_narration: '旁白：一箱弹药被递出，一队人随之加入；局势由一个营扩展到一座城。',
      factual_basis: '依据条目“攻占楚望台军械库获得弹药后攻入湖广总督署”的事件因果。',
      fictionalized_elements: ['具体传令路线和汇合调度为合成再现，不声称为唯一行军路线。'],
    }, 4),
    makeScene({
      title: '普通士兵改变局势',
      location: '武昌城与起义路线图',
      time_of_day: '10月11日清晨',
      dramatic_function: '历史余响',
      plot: '清晨，普通士兵把新的旗帜挂上武昌城头，街巷里的枪声逐渐停下。画面转向起义路线图：武昌局势改变后，汉阳、汉口相继响应，随后多省宣布独立。片尾明确，这不是某一个人的单独功劳，而是基层士兵共同选择与担当引发的连锁转折。',
      key_action: '普通士兵登上城头挂旗，地图依次点亮汉阳、汉口和多省响应',
      characters: ['普通士兵', '起义军'],
      visual_prompt: '1911年10月11日武昌清晨，普通士兵登城挂旗，街巷烟尘渐散，画面转为武汉三镇与多省响应地图，克制历史收束',
      camera_suggestion: '跟拍登城脚步和挂旗动作，转入路线地图逐点亮起，最后回到士兵疲惫面孔',
      cultural_note: '多省响应与帝制终结是复杂历史进程，片中只说明武昌起义构成重要开端，不作单因归纳。',
      conflict: '起义行动已经改变武昌，但其后果必须放回更广泛的革命进程理解',
      dialogue_or_narration: '旁白：普通人的行动汇入时代，但时代转折从来不是一个动作、一个人就能独自完成。',
      factual_basis: '条目记载武昌起义后武汉三镇光复，并在两个月内引发多省独立的连锁反应。',
      fictionalized_elements: ['城头挂旗的具体人物为群像化再现；地图点亮为信息可视化。'],
    }, 5),
  ];
}

function enhanceLegendAdaptationScenes(
  scenes: StoryScene[],
  input: {
    source: string;
    entry: EntryDetail;
  },
): StoryScene[] {
  const sourceText = [input.source, input.entry.name, input.entry.keywords.join(' ')].join('\n');
  if (!/刘海/.test(sourceText) || !/胡大姐|狐仙/.test(sourceText) || scenes.length < 5) return scenes;

  const [opening, supernatural, trial, consequence, ending] = scenes;
  opening.plot = `${opening.plot}刘海肩上的柴担和胡大姐手里的花篮第一次同框，成为这一路反复出现的传说意象。`;
  opening.key_action = '刘海扶稳柴担，与提花篮的胡大姐在山路相遇';
  opening.visual_prompt = `${opening.location}，刘海肩背柴担，胡大姐手提花篮，山风掀起披帛，两件道具同框建立传说意象。`;

  supernatural.plot = `${supernatural.plot}花篮披帛在风里扬起，地面短暂掠过狐影；乡邻正因这个神异征兆指认胡大姐，神异身份直接把两人推向分离。`;
  supernatural.key_action = '花篮披帛扬起狐影，乡邻据此逼迫两人分开';
  supernatural.characters = [...new Set(['刘海', '胡大姐', ...supernatural.characters])];
  supernatural.visual_prompt = `${supernatural.location}，花篮、披帛、狐影与乡邻指认同框，刘海和胡大姐被人群隔开。`;
  supernatural.conflict = '狐影显露神异身份，乡邻的怀疑从传闻变成逼迫两人分开的现实压力。';
  supernatural.cultural_note = '神异规则：胡大姐的力量只能短暂显出狐影、介入眼前危机，不能替刘海作出选择，也不能消除两人必须承担的现实代价；本场仍按民间传说而非史实表达。';
  supernatural.fictionalized_elements = [
    ...(supernatural.fictionalized_elements ?? []),
    '花篮披帛映出狐影是把用户素材“神异力量”可视化的象征性改编。',
  ];

  trial.plot = `${trial.plot}刘海想守住亲眼确认的善意与两人的情分。他从地上拾起两人初遇时的柴绳，拒绝随乡邻离开，转身沿花篮留下的痕迹寻找她；这个选择意味着他要承担被乡邻排斥、再次面对神异危险的代价。`;
  trial.key_action = '刘海拾起柴绳，拒绝随乡邻离开，回头寻找胡大姐';
  trial.characters = [...new Set(['刘海', '乡邻', ...trial.characters])];
  trial.visual_prompt = `${trial.location}，刘海从人群脚边拾起柴绳，转身逆着乡邻离开的方向追向花篮痕迹。`;
  trial.conflict = '随乡邻离开即可避开神异风险 vs 相信亲眼所见并承担排斥代价回头寻找胡大姐。';

  consequence.plot = `${consequence.plot}刘海把柴绳一端递给胡大姐，两人共同抬起柴担走回山路；乡邻因此停下追赶，原作中的“共同通过考验”有了可见结果。`;
  consequence.key_action = '刘海与胡大姐共同握住柴绳、抬起柴担，让追赶的乡邻停步';
  consequence.visual_prompt = `${consequence.location}，柴绳从刘海一人手中交到两人手中，柴担被共同抬起，乡邻停在远处。`;
  consequence.conflict = '分离后的两人必须共同承担，才能把选择变成可见结果。';

  ending.location = '长沙花鼓戏舞台';
  ending.plot = `${ending.plot}多年后的花鼓戏台上，演员带着同样的柴担和花篮复演这次回头与并肩，观众随锣鼓和对唱节奏应和；花篮披帛在叠化中化作山路薄雾，一瞬狐影退入竹林，山路上的歌声因此被一代代重讲。字幕标明：本片采用用户提供版本作为剧情主线，常德武陵民间传说与长沙花鼓戏只补足来源和传播层，这些版本不能叠合成可考历史。`;
  ending.key_action = '花鼓戏演员用柴担和花篮复演选择，观众应和，字幕标明版本边界';
  ending.characters = ['花鼓戏演员', '观众'];
  ending.visual_prompt = '长沙花鼓戏舞台，锣鼓、柴担、花篮与水袖，演员复演回头与并肩，观众应和，舞台叠化回武陵山路。';
  ending.camera_suggestion = '从柴担与花篮特写切至舞台群像，再叠化回山路完成意象回环';
  ending.cultural_note = '版本选择：保留用户原作“歌声留在山路上”的剧情主线，以常德武陵民间传说和长沙花鼓戏传播补足流传理由；地方口述、戏曲改编和具体唱词仍须分层核验。花鼓戏按地方民间演艺习俗呈现，不虚构独立祭仪。';
  ending.factual_basis = '用户提供改编结局与知识条目所载长沙花鼓戏传播事实分层组合。';
  ending.fictionalized_elements = [
    ...(ending.fictionalized_elements ?? []),
    '舞台与山路叠化是影视化收束，未引用未经授权的经典唱词。',
  ];

  return scenes;
}

function buildLiuHaiLegendArc(input: {
  entry: EntryDetail;
  centralEvent: string;
  videoType: VideoType;
  perSceneDuration: number;
}): StoryScene[] | undefined {
  if (input.videoType !== 'legend_story') return undefined;
  const sourceText = [input.entry.name, input.entry.summary, input.entry.story, input.entry.keywords.join(' ')].join('\n');
  if (!/刘海砍樵/.test(sourceText) || !/胡大姐|狐仙/.test(sourceText)) return undefined;

  const sourceEntries = [input.entry.name];
  const makeScene = (
    scene: Omit<StoryScene, 'scene_id' | 'duration_sec' | 'source_entries'>,
    index: number,
  ): StoryScene => ({
    ...scene,
    scene_id: index + 1,
    duration_sec: input.perSceneDuration,
    source_entries: sourceEntries,
  });

  return [
    makeScene({
      title: '武陵山路初相逢',
      location: '常德武陵山林砍樵路',
      time_of_day: '清晨',
      dramatic_function: '远古传说',
      plot: '相传，武陵山路上，樵夫刘海把斧头别在腰间，俯身收紧柴担。竹林风动，提着花篮的胡大姐从溪边走来；两个人在一担木柴前第一次停步相望。',
      key_action: '刘海收紧柴担，在山路上停步看向提花篮而来的胡大姐',
      characters: ['刘海', '胡大姐'],
      visual_prompt: '常德武陵山林清晨，竹林、溪水、山路，刘海身背柴担腰别斧头，胡大姐提花篮从薄雾中走来，民间传说水墨质感',
      camera_suggestion: '从草鞋与柴担特写沿山路上移，停在两人第一次对望的中景',
      cultural_note: '本场采用“相传”的民间传说口径；人物相遇和樵夫生活来自条目，具体走位为影视化组织。',
      conflict: '陌生相遇打破刘海日常砍樵节奏，胡大姐的来历仍未揭开',
      dialogue_or_narration: '旁白：武陵山里的故事，总从一条砍樵路和一次相逢讲起。',
      factual_basis: '依据条目所载武陵樵夫刘海在砍柴途中遇见狐仙胡大姐的民间传说。',
      fictionalized_elements: ['收紧柴担、溪边来路和初见调度是用于画面连续性的影视化创作。'],
    }, 0),
    makeScene({
      title: '花篮下的狐影',
      location: '常德武陵山林砍樵路',
      time_of_day: '黄昏',
      dramatic_function: '神力显现',
      plot: '山风骤起，胡大姐抬手护住将要倾倒的柴担；花篮披帛随风扬起，溪水倒影里掠过一瞬狐影。刘海握住斧柄，却没有挥下，只盯着她扶稳木柴的双手。',
      key_action: '胡大姐扶住倾倒的柴担显出狐影，刘海握斧停手并观察她的行动',
      characters: ['刘海', '胡大姐'],
      visual_prompt: '武陵山路黄昏，疾风掀起花篮披帛，柴担倾斜，胡大姐伸手扶稳，溪水倒影短暂呈狐影，刘海握住斧柄但没有挥下',
      camera_suggestion: '柴担倾斜的快速近景切到水中狐影，再推近刘海停住的手',
      cultural_note: '神异规则：胡大姐的力量只能短暂显出狐影、扶稳眼前柴担，不能替刘海作出选择，也不能免除两人共同承担的代价；狐仙身份属于民间传说，不作地方事实。',
      conflict: '神异身份突然显露，刘海必须在本能戒备与亲眼看见的善意之间判断',
      dialogue_or_narration: '刘海低声问：“你究竟是谁？”胡大姐没有辩解，只先把散落的木柴重新扶稳。',
      factual_basis: '条目记载胡大姐为狐仙化身并在砍柴途中与刘海相遇；显形动作属于传说改编层。',
      fictionalized_elements: ['疾风、溪水狐影与扶稳柴担是为外化神异身份新增的虚构镜头。'],
    }, 1),
    makeScene({
      title: '柴刀落地的选择',
      location: '武陵山居柴门前',
      time_of_day: '夜晚',
      dramatic_function: '凡人考验',
      plot: '乡邻举着火把围到柴门前，指着胡大姐在墙上的狐影，催刘海把她赶走。刘海想守住亲眼确认的善意与两人的情分；他先看见胡大姐挡在柴担前没有还手，随后放下柴刀，退到她身边，以凡人的选择承担被乡邻拒斥的风险。',
      key_action: '刘海在乡邻逼迫下放下柴刀，站到胡大姐身边并承担被排斥的代价',
      characters: ['刘海', '胡大姐', '乡邻'],
      visual_prompt: '武陵山居夜晚，柴门、火把、墙上狐影，乡邻逼近，胡大姐挡在柴担前，刘海把柴刀放到地上后站到她身旁',
      camera_suggestion: '火把与狐影交叉特写，俯拍柴刀落地，再横移至并肩站立的两人',
      cultural_note: '身份揭露与经历考验来自民间传说；乡邻围门、放下柴刀为表现凡人选择与代价的影视化虚构。',
      conflict: '乡邻要求驱离胡大姐 vs 刘海依据亲眼所见守住自己的判断',
      dialogue_or_narration: '刘海：“我看见的是她一次次伸手相助。若只因身份就翻脸，我先对不起自己的眼睛。”',
      factual_basis: '依据条目“狐仙身份被揭露，经历一系列考验”的传说梗概进行有限改编。',
      fictionalized_elements: ['乡邻围门、火把压力和放下柴刀均为明确标注的影视化虚构。'],
    }, 2),
    makeScene({
      title: '并肩走回山路',
      location: '常德武陵山林砍樵路',
      time_of_day: '拂晓',
      dramatic_function: '命运转折',
      plot: '刘海放下武器后回头提起散落的柴绳，把一端递给胡大姐。胡大姐收起神异光影，两人并肩把柴担抬过人群；乡邻因此停下脚步，让出通往山路的窄道，考验第一次有了可见结果。',
      key_action: '刘海回头拾起柴绳，与胡大姐并肩抬走柴担，让乡邻停止逼近',
      characters: ['刘海', '胡大姐', '乡邻'],
      visual_prompt: '武陵山居拂晓，地上柴绳与柴担，刘海回头拾绳递给胡大姐，两人并肩抬担，火把渐灭，乡邻从狭路两侧后退',
      camera_suggestion: '跟住拾绳、递绳、抬担三个连续动作，最后拉远看人群让出山路',
      cultural_note: '“战胜困难”的结局来自传说概述；柴绳接力与乡邻让路是把选择后果可视化的影视化改编。',
      conflict: '身份造成的隔绝仍在，但两人用共同承担的行动改变了当下局面',
      dialogue_or_narration: '旁白：神异没有替他们完成选择；真正改变道路的，是两个人同时握住了那根柴绳。',
      factual_basis: '条目仅记载两人经历考验并战胜困难；本场具体结果属于民间传说的影视化展开。',
      fictionalized_elements: ['递柴绳、共同抬担和乡邻让路是象征承诺的虚构动作设计。'],
    }, 3),
    makeScene({
      title: '从山路唱到戏台',
      location: '长沙花鼓戏舞台',
      time_of_day: '夜晚',
      dramatic_function: '传说永恒',
      plot: '多年后的花鼓戏台上，演员以刘海的柴担和胡大姐的花篮重新走过相逢与选择，锣鼓一响，观众跟着熟悉的对唱节奏应和。花篮披帛在舞台叠化中化作山路薄雾，一瞬狐影退入竹林，山路故事因此被一代代重讲；字幕同时注明：本片采用常德武陵口述传说作为剧情主线，以长沙花鼓戏改编作为传播结尾，不把多版本拼接为可考历史。',
      key_action: '花鼓戏演员携柴担与花篮复演故事，观众应和，字幕标清传说和改编边界',
      characters: ['花鼓戏演员', '观众'],
      visual_prompt: '长沙花鼓戏舞台夜晚，戏台幕布、锣鼓、柴担、花篮、水袖，演员复演刘海与胡大姐相逢，观众席应和，画面叠化回武陵山路',
      camera_suggestion: '从锣鼓与道具特写切到舞台对唱，再叠化回清晨山路完成时空闭环',
      cultural_note: '版本选择：常德武陵民间口述承担剧情主线，长沙花鼓戏承担舞台传播层，两种地域版本不混写成唯一说法。花鼓戏按地方民间演艺习俗呈现，不虚构独立祭仪；具体演出版本与唱词须另行核验和授权。',
      conflict: '不同口述和舞台版本持续变化，创作必须在传播感染力与版本边界之间保持诚实',
      dialogue_or_narration: '旁白：故事留下来，不只因为有狐仙，更因为凡人在压力前作出了选择。',
      factual_basis: '依据条目关于常德武陵传说流传及长沙花鼓戏加工传播的记载。',
      fictionalized_elements: ['舞台与山路叠化为影视化收束；未引用未经授权的经典唱词。'],
    }, 4),
  ];
}

function buildYueluCulturePromoArc(input: {
  entry: EntryDetail;
  videoType: VideoType;
  perSceneDuration: number;
}): StoryScene[] | undefined {
  if (input.videoType !== 'culture_promo' || !/岳麓书院/.test(input.entry.name)) return undefined;
  const sourceEntries = [input.entry.name];
  const makeScene = (
    scene: Omit<StoryScene, 'scene_id' | 'duration_sec' | 'source_entries'>,
    index: number,
  ): StoryScene => ({
    ...scene,
    scene_id: index + 1,
    duration_sec: input.perSceneDuration,
    source_entries: sourceEntries,
  });

  return [
    makeScene({
      title: '从门联进入书院',
      location: '岳麓书院门庭',
      time_of_day: '清晨',
      dramatic_function: '符号引入',
      plot: '清晨，镜头不从空泛山水开始，而从门联的木纹、石阶上的脚步和一本翻开的学生笔记进入。面向第一次到访的青年观众，片子先提出一个可见问题：一座书院的“千年”，今天还能在哪里被看见？',
      key_action: '寻访者沿石阶走到门联下，在笔记本写下“千年如何仍在发生”',
      characters: [],
      visual_prompt: '岳麓书院门庭清晨，门联木纹前景、石阶中景、青年寻访者与学生笔记后景，侧光扫过字迹，克制纪实构图',
      camera_suggestion: '门联木纹特写接石阶脚步，再跟到笔记问题，现场鸟鸣先于旁白',
      cultural_note: '门联、门庭与书院空间按知识条目呈现；不得用“唯一”“最古老”等无来源极值口号。',
      conflict: '观众熟悉的是文化符号，但还不知道符号背后的讲学与论辩如何延续',
      dialogue_or_narration: '旁白：先别急着赞美千年。沿着这副门联，我们去找三处仍可核对的证据。',
      factual_basis: '门庭、门联与岳麓书院空间来自知识条目及相关地点记录。',
      fictionalized_elements: ['青年寻访者和笔记问题是宣传片的观众视角设计，不代表特定真实人物。'],
    }, 0),
    makeScene({
      title: '创建年代落在实物上',
      location: '岳麓书院碑刻与院落',
      time_of_day: '上午',
      dramatic_function: '文化根基',
      plot: '镜头从笔记上的问题切到碑刻、院落轴线与讲堂匾额。画面给出北宋开宝九年（976年）创建的时间锚点，同时提醒：年代不是宣传口号，必须由可核对的条目、碑刻与空间共同承载。',
      key_action: '寻访者核对创建年代，依次指向碑刻、院落轴线和讲堂匾额',
      characters: [],
      visual_prompt: '岳麓书院碑刻与院落上午，笔记页、碑刻字迹、院落中轴和讲堂匾额依次同轴匹配，避免古风符号堆叠',
      camera_suggestion: '用笔记字迹匹配碑刻局部，再拉远交代院落与讲堂的空间关系',
      cultural_note: '创建时间依知识条目表达；碑刻具体文字和年代须以现场及官方资料复核。',
      conflict: '宣传感染力必须建立在可见证据上，不能把年代和声誉写成无人承载的口号',
      dialogue_or_narration: '旁白：第一处证据是时间。976年只是起点，真正延续千年的，是空间里反复发生的学习。',
      factual_basis: '依据条目关于岳麓书院始建于北宋开宝九年（976年）的记载。',
      fictionalized_elements: ['笔记与碑刻的匹配剪辑为蒙太奇组织，不声称笔记内容属于历史文献。'],
    }, 1),
    makeScene({
      title: '两把座椅留下论辩',
      location: '岳麓书院讲堂',
      time_of_day: '午后',
      dramatic_function: '技艺展示',
      plot: '讲堂内，两把相对座椅、摊开的讲义和听者环坐的位置替代不合对象的“材料、针尖、工具”。朱熹与张栻会讲作为第二处证据，说明这里的文化不是静态符号，而是观点在公开论辩中被检验。',
      key_action: '讲解者摆正两把相对座椅，学生在两栏笔记中记录不同观点与依据',
      characters: [],
      visual_prompt: '岳麓书院讲堂午后，两把相对木椅、讲义、两栏学生笔记和环坐听者构成前中后景，日光移动形成时间感',
      camera_suggestion: '相对座椅全景切两栏笔记近景，以现场翻页声承接观点对切，不复演未经证实对白',
      cultural_note: '朱张会讲有条目依据；座椅、学生笔记与课堂调度为克制再现，不引用虚构历史原话。',
      conflict: '若只拍匾额与门联，开放治学会沦为空话；必须让论辩结构转成可观察行动',
      dialogue_or_narration: '旁白：第二处证据是论辩。重要的不是替古人编一句金句，而是看见不同观点如何在同一讲堂被认真听见。',
      factual_basis: '依据条目关于南宋朱熹与张栻在岳麓书院会讲及其学术交流意义的记载。',
      fictionalized_elements: ['相对座椅和两栏笔记是解释会讲结构的合成再现，不作为历史现场复原。'],
    }, 2),
    makeScene({
      title: '笔记走进今天课堂',
      location: '岳麓书院与湖南大学校园课堂',
      time_of_day: '傍晚',
      dramatic_function: '现代传承',
      plot: '同一本笔记从讲堂带到今天的校园课堂。学生围绕一个问题查资料、标出处、交换意见；门联不再只是合影背景，而成为第三处证据的入口：书院文脉在当代学习、核对和讨论中继续发生。',
      key_action: '学生把讲堂笔记带进课堂，标注引文出处并交换两种不同解释',
      characters: [],
      visual_prompt: '岳麓书院与湖南大学校园傍晚，摊开的学生笔记与书页在前景，讨论手势居中，窗外书院屋脊在后景，暖色室内灯与冷色暮光交叠',
      camera_suggestion: '笔记本匹配剪辑连接古建讲堂与今天课堂，让讨论现场声逐渐覆盖旁白',
      cultural_note: '当代课堂只表达学习方式的延续，不把现代机构成果或学生身份作未经授权的具体宣称。',
      conflict: '千年文脉必须在今天产生可见行动，否则古今连接仍只是抽象赞美',
      dialogue_or_narration: '旁白：第三处证据在今天。文脉不是把旧答案背下来，而是继续提问、核对来源，也允许不同解释相遇。',
      factual_basis: '书院与当代大学空间相连有条目地点依据；具体课堂人物与讨论内容为宣传创作。',
      fictionalized_elements: ['课堂学生、资料题目和跨场笔记为合成人物与道具线，不指向真实课程或个人。'],
    }, 3),
    makeScene({
      title: '从一副门联继续提问',
      location: '岳麓书院门庭至讲堂',
      time_of_day: '入夜',
      dramatic_function: '标语收束',
      plot: '入夜前，青年寻访者沿门庭走回讲堂，把笔记停在开场问题下方：年代、会讲与今日课堂形成完整回答。镜头邀请观众到访时不只拍下门联，也沿着碑刻、讲堂和课堂线索继续核对这座书院的文脉。',
      key_action: '寻访者翻回开场问题，写下“从一副门联，走进一座仍在学习的书院”',
      characters: [],
      visual_prompt: '岳麓书院入夜，门联、碑刻、讲堂座椅、当代课堂和学生笔记五层蒙太奇回环，最后停在手写记忆句',
      camera_suggestion: '按门联→碑刻→座椅→课堂→笔记回放证据链，最后留两秒环境声和手写句',
      cultural_note: '结尾不把书院压缩成单一“湖湘精神”符号；年代、人物、空间和当代连接均保留各自来源边界。场地、人物肖像和图像署名须在真实制作阶段另行确认。',
      conflict: '观众需要从观看符号走向核对证据和实际到访，而不是只记住空泛赞美',
      dialogue_or_narration: '旁白：从一副门联，走进一座仍在学习的书院。下一次到访，请把问题也带进来。',
      factual_basis: '结尾的年代、会讲和空间线索分别回扣前述条目依据。',
      fictionalized_elements: ['笔记回环和到访邀请为传播结构，不替代开放信息、拍摄许可与现场导览说明。'],
    }, 4),
  ];
}

function buildChangshaCityBrandArc(input: {
  entry: EntryDetail;
  videoType: VideoType;
  perSceneDuration: number;
  totalSeconds: number;
}): StoryScene[] | undefined {
  if (input.videoType !== 'city_brand_promo' || !/岳麓书院/.test(input.entry.name)) return undefined;
  const sourceEntries = [input.entry.name];
  const sceneDuration = Math.max(1, Math.round(input.totalSeconds / 5));
  const makeScene = (
    scene: Omit<StoryScene, 'scene_id' | 'duration_sec' | 'source_entries'>,
    index: number,
  ): StoryScene => ({
    ...scene,
    scene_id: index + 1,
    duration_sec: sceneDuration,
    source_entries: sourceEntries,
  });

  return [
    makeScene({
      title: '从门联读一座城',
      location: '岳麓书院门庭',
      time_of_day: '清晨',
      dramatic_function: '地标引入',
      plot: '清晨，石阶脚步把镜头带到岳麓书院门庭。门联不是一张孤立的城市名片，而是长沙仍在学习、提问和欢迎不同解释的入口。',
      key_action: '到访者沿石阶进入门庭，在门联下停步阅读后继续向讲堂前行',
      characters: [],
      visual_prompt: '岳麓书院门庭清晨，门联木纹前景、石阶与慢行到访者中景、书院院落后景，晨光沿门槛推进，明亮克制的城市形象片构图',
      camera_suggestion: '城市声音景观从鸟鸣、石阶脚步和远处晨读声进入，低机位跟随脚步后抬到门联，不用配音覆盖全部现场声',
      cultural_note: '城市身份主张（创作提案）：长沙是一座把千年文脉继续变成当代提问与学习行动的城市；不是政府审定口径或官方城市口号。目标客群为首次到访、愿意慢行阅读的文化游客与本地市民。场地拍摄许可待真实确认。',
      conflict: '若只拍地标外观，城市身份仍会停在旅游明信片；必须让空间里的阅读行动出现',
      dialogue_or_narration: '旁白：从一副门联开始，不只看长沙留下了什么，也看这里今天怎样继续学习。',
      factual_basis: '岳麓书院门庭、门联及长沙岳麓区地点关系来自知识条目。',
      fictionalized_elements: ['到访者为合成观察视点，不代表特定真实游客。'],
    }, 0),
    makeScene({
      title: '年代与会讲成为证明',
      location: '岳麓书院碑刻与讲堂',
      time_of_day: '上午',
      dramatic_function: '历史底蕴',
      plot: '镜头沿门庭进入碑刻与讲堂，以976年的创建时间和朱张会讲两处证据回答：长沙的文教气质不是凭空写成，而是在具体空间里一次次被实践。',
      key_action: '到访者从门庭走到碑刻，再进入讲堂核对创建时间与朱张会讲线索',
      characters: [],
      visual_prompt: '岳麓书院碑刻与讲堂上午，碑刻局部、院落中轴、相对座椅和笔记形成连续空间节点，人物沿同一方向由外向内移动',
      camera_suggestion: '空间路线轴按门庭→碑刻→讲堂推进，以翻页声、木门声和讲堂静场连接，不复演未经证实对白',
      cultural_note: '空间路线轴第一段只连接知识条目可支持的书院节点；碑刻文字、开放路线和讲堂机位须现场复核，场地拍摄许可待真实确认。',
      conflict: '城市品牌主张必须由可核对地点和事实支撑，不能用一串形容词替代证明',
      dialogue_or_narration: '旁白：一座城的气质，要能在时间、空间和今天仍可观察的行动里找到依据。',
      factual_basis: '依据条目关于岳麓书院始建于北宋开宝九年（976年）及朱张会讲的记载。',
      fictionalized_elements: ['人物核对与空间串联为城市形象片的游线组织，不作为历史事件记录。'],
    }, 1),
    makeScene({
      title: '笔记走进今日校园',
      location: '岳麓书院与湖南大学校园公共学习空间',
      time_of_day: '午后',
      dramatic_function: '人文风貌',
      plot: '同一本笔记从讲堂带到今天的校园公共学习空间。学生查出处、交换看法，游客在开放区域旁听片刻；千年文脉由当下的学习动作接住。',
      key_action: '学生标出引文来源并交换两种解释，到访者沿开放通道从书院走向校园',
      characters: [],
      visual_prompt: '岳麓书院与湖南大学校园午后，笔记页、书页、讨论手势和开放通道形成古今匹配剪辑，窗外书院屋脊作为方向锚点',
      camera_suggestion: '城市声音景观转为翻页、低声讨论、脚步与自行车铃声；只收真实环境声，不合成学生发言',
      cultural_note: '目标客群在此获得可执行理解方式：不只合影，也可阅读说明、核对出处和观察当代学习。校园人物、开放区域和肖像须真实确认并取得相应场地拍摄许可。',
      conflict: '古今连接若没有今天的具体行动，就会退回抽象的“文脉延续”',
      dialogue_or_narration: '旁白：文脉不是把旧答案背下来，而是让新的问题继续有地方被认真讨论。',
      factual_basis: '书院与当代大学空间相连有地点依据；具体公共学习场景需实拍核验。',
      fictionalized_elements: ['学生与讨论内容为合成场景，不指向真实课程、个人或既有活动。'],
    }, 2),
    makeScene({
      title: '文脉落进城市日常',
      location: '岳麓山下公共街巷至湘江沿岸',
      time_of_day: '傍晚',
      dramatic_function: '生活气息',
      plot: '傍晚，书页合上，街巷卷帘、公交进站、骑行铃声和湘江岸边脚步接续出现。游客与市民共享同一条慢行节奏，书院文脉由此落进长沙的日常。',
      key_action: '到访者从山下公共街巷步行至湘江沿岸，与下班市民和慢行人群汇入同一方向',
      characters: [],
      visual_prompt: '岳麓山下公共街巷至湘江沿岸傍晚，卷帘、公交、骑行者、步行游客与市民构成生活蒙太奇，暖色街灯渐亮，不指向具体商户',
      camera_suggestion: '城市声音景观按卷帘声→公交提示音→骑行铃声→江风与脚步分层，镜头由中景跟行转为江岸远景',
      cultural_note: '游客行动路径为门庭阅读→讲堂核对→校园观察→街巷慢行→江岸回望。跨区域动线、交通安全、具体商户和公共空间场地拍摄许可待真实勘景确认。',
      conflict: '城市不能只作为景区布景，必须让游客行动与市民日常在公共空间自然相遇',
      dialogue_or_narration: '旁白：离开书院，提问没有结束；它跟着脚步，走进街巷、通勤和江风。',
      factual_basis: '长沙岳麓区与湘江沿岸的城市空间关系可作路线方向；精确步行距离与可拍节点须实勘。',
      fictionalized_elements: ['人群、公交与卷帘的组合为城市生活蒙太奇，不声称记录某一真实日期。'],
    }, 3),
    makeScene({
      title: '把问题带回长沙',
      location: '湘江沿岸远眺岳麓山与城市灯火',
      time_of_day: '入夜',
      dramatic_function: '品牌定格',
      plot: '入夜，江风盖过街声，镜头从岳麓山轮廓回望长沙灯火。门联、讲堂、校园与街巷依次闪回，城市留下的不是终点口号，而是一句邀请：把问题带来，让城市继续回答。',
      key_action: '到访者翻回开场笔记，写下“把问题带来，让城市继续回答”，随后合上笔记望向灯火',
      characters: [],
      visual_prompt: '湘江沿岸入夜，笔记近景、岳麓山轮廓中景、长沙灯火后景，门联讲堂校园街巷四层短闪回后定格江风中的城市远景',
      camera_suggestion: '城市声音景观由街声渐退到江风，以两秒安静承接记忆句；晴天拍江岸远景，降雨时不强行复刻同一画面',
      cultural_note: '天气备选方案：晴天完成江岸远景；遇雨转为已获许可的书院檐廊、校园室内公共区域或雨中街巷近景，未获许可即取消对应机位。品牌句是本片创作句，不作为官方城市口号；场地拍摄许可待真实确认。',
      conflict: '结尾要留下可复述的长沙气质，同时避免极值声称和未经审定的官方口径',
      dialogue_or_narration: '旁白：长沙，把问题带来，让城市继续回答。',
      factual_basis: '结尾只回扣前述地点与行动，不新增城市排名、唯一性或官方品牌事实。',
      fictionalized_elements: ['笔记回环和城市灯火闪回为品牌片结构设计。'],
    }, 4),
  ];
}

function buildYueluDocumentaryArc(input: {
  entry: EntryDetail;
  videoType: VideoType;
  perSceneDuration: number;
}): StoryScene[] | undefined {
  if (input.videoType !== 'documentary_short' || !/岳麓书院/.test(input.entry.name)) return undefined;
  const sourceEntries = [input.entry.name];
  const makeScene = (
    scene: Omit<StoryScene, 'scene_id' | 'duration_sec' | 'source_entries'>,
    index: number,
  ): StoryScene => ({
    ...scene,
    scene_id: index + 1,
    duration_sec: input.perSceneDuration,
    source_entries: sourceEntries,
  });

  return [
    makeScene({
      title: '门庭里留下的问题',
      location: '岳麓书院门庭',
      time_of_day: '清晨',
      dramatic_function: '现实引入',
      plot: '清晨的门庭里，镜头先记录木门、门联、石阶和进入院落的脚步。一名寻访者在空白笔记页写下问题：一座书院延续千年的证据，今天究竟还能在哪里看见？问题不是旁白口号，而是接下来逐处核对的路线。',
      key_action: '寻访者从门联走到石阶，在笔记页写下“千年如何仍在发生”',
      characters: [],
      visual_prompt: '岳麓书院门庭清晨，木门与门联在前景，石阶和进入院落的寻访者在中景，空白笔记页在近景，冷暖自然光交界，纪实构图',
      camera_suggestion: '固定镜头先留两秒鸟鸣与石阶脚步声，再从门联木纹跟到笔记问题；声音为拍摄规划，须由真实现场采集核验',
      cultural_note: '现实地点和门联按知识条目呈现；现场开放状态、门联文字与声音条件须在正式拍摄前复核。',
      conflict: '“千年学府”的熟悉称呼仍是结论，镜头需要找到能让观众自行判断的现实证据',
      dialogue_or_narration: '旁白：先不急着给答案。我们从今天能触摸到的门、石阶和声音开始。',
      factual_basis: '岳麓书院现实地点、门庭与书院空间来自知识条目及地点记录。',
      fictionalized_elements: ['寻访者与笔记问题是纪录结构中的观察视点，不代表真实受访者或特定游客。'],
    }, 0),
    makeScene({
      title: '把年代落到空间',
      location: '岳麓书院碑刻与院落中轴',
      time_of_day: '上午',
      dramatic_function: '历史回望',
      plot: '寻访者沿院落中轴核对碑刻、讲堂匾额和创建时间线。北宋开宝九年（976年）成为第一枚时间锚点；镜头不把一块碑当成全部证明，而把条目来源、现存空间与仍需现场复核的文字并列展示。',
      key_action: '寻访者翻到创建时间线，对照碑刻局部、院落中轴和讲堂匾额逐项做标记',
      characters: [],
      visual_prompt: '岳麓书院碑刻与院落中轴上午，时间线笔记前景、碑刻局部中景、讲堂匾额后景，寻访者手指逐项核对，克制自然光',
      camera_suggestion: '纸页翻页声连接时间线与碑刻特写，再拉远呈现院落中轴；碑文细节与纸页声均以现场拍摄和收声结果为准',
      cultural_note: '创建年代依知识条目表达；具体碑刻年代和文字不得仅凭生成文本认定，须对照官方目录或现场说明。',
      conflict: '单一历史称号不足以回答开场问题，年代必须落在可追溯的来源与现实空间上',
      dialogue_or_narration: '旁白：976年给出起点，但年代本身不会自动说明传统怎样延续。第二步，要看这里曾经发生过什么。',
      factual_basis: '依据条目关于岳麓书院始建于北宋开宝九年（976年）的记载。',
      fictionalized_elements: ['寻访者逐项标记的动作是证据组织方式，不把笔记伪装成历史档案。'],
    }, 1),
    makeScene({
      title: '会讲只能有限再现',
      location: '岳麓书院讲堂',
      time_of_day: '午后',
      dramatic_function: '关键节点',
      plot: '讲堂里，两把相对座椅和摊开的讲义示意朱熹与张栻会讲的结构。镜头只再现“相对而论、听者在场”的关系，不安排演员说出未经证实的历史原话；画面字幕标明这是依据条目制作的有限示意。',
      key_action: '工作人员摆好两把相对座椅，镜头对照条目中的朱张会讲线索后停在空座之间',
      characters: [],
      visual_prompt: '岳麓书院讲堂午后，两把相对木椅、摊开讲义与空置听者席形成前中后景，侧光移动，不出现历史人物拟真表演',
      camera_suggestion: '从讲义纸页声切到相对座椅全景，再推近空座之间；不配虚构历史对白，以短暂静场保留再现边界',
      cultural_note: '朱张会讲有条目依据；座椅、讲义和听者位置是有限再现，不是历史现场复原，也不证明具体对白。',
      conflict: '会讲是关键解释证据，但为了画面完整而补写古人原话会破坏纪录可信度',
      dialogue_or_narration: '旁白：条目能确认会讲及其学术交流意义，不能替我们还原每一句话。这里呈现的是关系，不是冒充现场。',
      factual_basis: '依据条目关于南宋朱熹与张栻在岳麓书院会讲的记载。',
      fictionalized_elements: ['相对座椅、摊开讲义和空席调度为明确标注的有限再现；未引用历史人物原话。'],
    }, 2),
    makeScene({
      title: '把解释留给真实采访',
      location: '岳麓书院讲堂外廊',
      time_of_day: '傍晚',
      dramatic_function: '史料/专家解读',
      plot: '镜头从讲堂空座移到外廊，列出需要向馆员或相关研究者核实的两个问题：会讲的史料出处如何分层，今天的讲学传统应怎样理解。采访规划（非现成同期声）：待真实采访录音后选择同时说明来源与版本边界的回答；当前版本不写采访原话，也不把角色规划当成已完成访问。',
      key_action: '寻访者在外廊写下两条采访问题，并把“待录音、待核实、待选段”贴到空白采访位旁',
      characters: [],
      visual_prompt: '岳麓书院讲堂外廊傍晚，廊柱与空白采访机位在中景，两条问题卡和未填写的声轨格在前景，暮光自然过渡',
      camera_suggestion: '从空座横移到外廊空白机位，保留风过树叶声与远处脚步声；不合成受访者声音，不制造同期声',
      cultural_note: '馆员或研究者只是拟邀采访角色，须真实联系、知情同意、录音并核对表述后才能形成采访选段。',
      conflict: '影片需要专业解释，但当前素材不能越过访问、授权和选段流程替专家发言',
      dialogue_or_narration: '旁白：这两个问题先留白。没有完成采访，就不该出现一段看似可信的“专家原话”。',
      factual_basis: '采访问题依据条目中的朱张会讲与当代延续线索提出；本场不新增事实结论。',
      fictionalized_elements: ['问题卡和空白机位是前期制作规划，不声称采访已经发生。'],
    }, 3),
    makeScene({
      title: '今天的回答仍是行动',
      location: '湖南大学校园课堂与岳麓书院门庭',
      time_of_day: '入夜前',
      dramatic_function: '当代意义',
      plot: '今天的课堂里，学生把同一问题分成两栏，分别标出论点与出处，再交换核对。镜头随后回到门庭：寻访者翻回开场那页，写下“传统不是重复答案，而是继续提出问题、标明来源、认真听见不同解释”。当代意义由这一组具体学习动作回答，而不是另加一句空泛口号。',
      key_action: '学生标出处并交换两种解释，寻访者翻回开场问题写下基于证据链的回答',
      characters: [],
      visual_prompt: '湖南大学校园课堂与岳麓书院门庭入夜前，两栏笔记、翻开的书页与讨论手势在前景，窗外书院屋脊和门联在后景，冷暖光交叠',
      camera_suggestion: '让课堂翻页声、低声讨论声和提问声逐渐替代旁白，再以笔记匹配剪辑回到门庭，最后留两秒真实环境声位',
      cultural_note: '课堂人物和讨论题目为合成观察场景，不指向真实课程或学生；正式拍摄须取得场地与肖像许可。',
      conflict: '若当代连接只停在“精神永存”，开场问题仍未被可观察的现实行动回答',
      dialogue_or_narration: '旁白：我们找到的不是一句最终答案，而是一种仍在发生的做法——提问、找依据、听见不同解释，再继续核对。',
      factual_basis: '书院与当代大学空间相连有地点依据；具体课堂行动作为当代观察方案，须由真实拍摄核验。',
      fictionalized_elements: ['跨场笔记、合成课堂人物和讨论动作是当代意义的拍摄方案，不作为现实事件记录。'],
    }, 4),
  ];
}

function buildWulingyuanLandscapeArc(input: {
  entry: EntryDetail;
  videoType: VideoType;
  perSceneDuration: number;
  totalSeconds: number;
}): StoryScene[] | undefined {
  if (input.videoType !== 'landscape_mood' || !/张家界|武陵源/.test(input.entry.name)) return undefined;
  const sourceEntries = [input.entry.name];
  const makeScene = (
    scene: Omit<StoryScene, 'scene_id' | 'duration_sec' | 'source_entries'>,
    index: number,
  ): StoryScene => ({
    ...scene,
    scene_id: index + 1,
    duration_sec: input.perSceneDuration,
    source_entries: sourceEntries,
  });

  const scenes = [
    makeScene({
      title: '雨后峰林开卷',
      location: '武陵源风景名胜区峰林观景点',
      time_of_day: '雨后清晨',
      dramatic_function: '山水开卷',
      plot: '雨后清晨，松针滴水，薄雾沿峡谷上升，中段峰柱逐根露出，远峰仍在灰蓝天光里。',
      key_action: '水滴落下，薄雾上升并依次露出中段峰柱与远处峰脊',
      characters: [],
      visual_prompt: '武陵源雨后清晨，前景是带水松针和深色栈道边缘，中景是雾中石英砂岩峰柱，后景是灰蓝峰脊、低云与开放栈道上的微小行者；行者作为人物尺度参照，色彩方案为墨绿、岩灰、雾白，景深清楚',
      camera_suggestion: '镜头节奏先用八秒固定近景听滴水，再以远景缓推进入峰谷，转场不加速，保留山风与鸟鸣声景',
      cultural_note: '景观边界：地名只写武陵源风景名胜区，不把其他不同点位拼成同一机位；雨后薄雾是拍摄方案，不作固定季节事实。',
      conflict: '雾遮住远峰，画面以逐层显露形成动静张力，不用抽象赞美代替自然变化',
      factual_basis: '武陵源石英砂岩峰林、峡谷与云雾景观来自知识条目；具体天气须以拍摄当日为准。',
      fictionalized_elements: ['雾线移动、滴水落点和光线顺序是可执行的拍摄预案，不声称已经实拍。'],
    }, 0),
    makeScene({
      title: '同一峰谷的光线流变',
      location: '武陵源风景名胜区峰谷固定机位',
      time_of_day: '清晨至暮色',
      dramatic_function: '意境流变',
      plot: '同一峰谷里，清晨冷蓝退开，日光擦亮峰壁，雨雾短暂吞没半山，暮色把石柱边缘染成暖金。',
      key_action: '清晨冷蓝、日光青绿、雨雾灰白和暮色暖金依次改变同一峰谷',
      characters: [],
      visual_prompt: '武陵源同一峰谷固定机位，前景湿岩与蕨叶，中景独立峰柱，后景层叠山谷；清晨冷蓝、日光青绿、雨雾灰白、暮色暖金构成连续色彩方案',
      camera_suggestion: '镜头节奏采用同机位四段定时观察，每段六至八秒，以云层运动自然叠化，不用快速四季混剪',
      cultural_note: '清晨、日光、雨雾、暮色是一日光线拍摄脚本，不代表同一天必然出现全部状态，更不作当地固定季节事实或气候承诺。',
      conflict: '需要用同一地点的真实状态变化建立诗意，不能用跨景区拼贴伪造连续时空',
      factual_basis: '峰林受光、云雾与降水影响呈现不同可见度属于一般自然观察；具体出现次序待现场天气核验。',
      fictionalized_elements: ['四段光线连续出现是后期组织方案，各镜头须保留真实拍摄时间与天气记录。'],
    }, 1),
    makeScene({
      title: '一名行者给出尺度',
      location: '武陵源风景名胜区栈道远眺位',
      time_of_day: '雨歇午后',
      dramatic_function: '人文轻触',
      plot: '雨衣行者沿开放栈道走过，只占画面一角；栏杆、行者与远峰给出由近到远的尺度。',
      key_action: '行者沿开放栈道走过两根栏杆间距，在峰柱前短暂停下后离开画面',
      characters: [],
      visual_prompt: '武陵源栈道雨歇午后，前景栏杆和水珠，中景深色雨衣行者，后景高耸峰柱与移动云带；人物尺度参照约占画高二十分之一，青灰色调',
      camera_suggestion: '镜头节奏用十二秒固定远景，不追拍、不特写人物，让脚步声从近到远并与谷风、水声分层',
      cultural_note: '人物仅为尺度参照，不指向特定游客；正式拍摄须使用开放路线并取得肖像许可，不进入未开放区域。',
      conflict: '人物尺度必须帮助观众理解山体空间，不能把自然景观变成人物表演背景',
      factual_basis: '开放栈道与具体取景位置须由景区现场确认；峰柱尺度不从生成画面反推数值。',
      fictionalized_elements: ['行者衣着、步速和停留位置为镜头调度，不作为真实游客活动记录。'],
    }, 2),
    makeScene({
      title: '蓝调时刻把声音留下',
      location: '武陵源风景名胜区峰林远眺点',
      time_of_day: '暮色至蓝调时刻',
      dramatic_function: '灵韵定格',
      plot: '蓝调时刻，云移开最后一根峰柱。脚步、鸟鸣和水声依次退去，只留山风与空镜留白。',
      key_action: '云带移开最后一根峰柱，脚步、鸟鸣和水声依次退去，只留山风',
      characters: [],
      visual_prompt: '武陵源蓝调时刻，前景暗色蕨叶，中景峰柱剪影，后景深蓝天空与最后一线云；色彩方案收束为靛蓝、岩黑、微弱暖金，大面积留白',
      camera_suggestion: '镜头节奏收慢为固定远景，声音依次渐退后停留五秒，不加诗句字幕，以空镜留白结束',
      cultural_note: '景观边界继续限定武陵源同一远眺区域；蓝调、云带和声景均是待现场核验的拍摄条件，不把偶发天气写成季节事实。',
      conflict: '结尾克制信息密度，让声音与光线完成收束，不以极值口号抢走山水余味',
      factual_basis: '地名与景观主体依据知识条目；暮色能见度、云量和自然声须按实拍记录。',
      fictionalized_elements: ['声音退场顺序和五秒停留为剪辑设计，不声称自然现场按脚本发生。'],
    }, 3),
  ];

  if (input.totalSeconds <= 30) {
    const compactScenes = [scenes[0], scenes[1], scenes[3]];
    const compactPlots = [
      '雨后清晨，薄雾上升，峰柱从滴水声里逐根露出。',
      '同一峰谷从冷蓝晨光走到暖金暮色，云开云合。',
      '蓝调时刻，云移开远峰，鸟鸣和水声退去，只留山风与空镜留白。',
    ];
    return compactScenes.map((scene, index) => ({
      ...scene,
      scene_id: index + 1,
      duration_sec: Math.round(input.totalSeconds / compactScenes.length),
      plot: compactPlots[index],
    }));
  }

  return scenes.map(scene => ({
    ...scene,
    duration_sec: Math.round(input.totalSeconds / scenes.length),
  }));
}

function adaptationEndingTheme(videoType: VideoType): string {
  if (videoType === 'historical_drama') {
    return '普通人的行动汇成时代转折，也让选择背后的担当留下余味。';
  }
  if (videoType === 'legend_story') {
    return '传说把这次选择留给后来的人：神异只是外壳，真心与勇敢才让故事继续流传。';
  }
  if (videoType === 'children_story') {
    return '这次温和而勇敢的判断，让善良成为可以练习的成长。';
  }
  if (videoType === 'ai_comic_drama') {
    return '新的脚步声逼近，但这次勇敢选择已经改变了两人的关系。';
  }
  return '选择产生了可见后果，也让愿意承担代价的良知留下余味。';
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

function buildAdaptationArcCharacters(characterNames: string[], videoType: VideoType): StoryCharacter[] {
  const descriptions: Record<string, { role: string; description: string }> = videoType === 'historical_drama'
    ? {
        新军士兵: { role: 'protagonist_group', description: '计划泄露后在搜捕压力下选择提前发动的基层士兵群体。' },
        起义军: { role: 'action_group', description: '从营房冲向楚望台军械库并向湖广总督署推进的行动群体。' },
        普通士兵: { role: 'consequence_witness', description: '以分发军械、传令和汇合行动引发连锁响应的基层人物群像。' },
      }
    : {
        刘海: { role: 'protagonist', description: '在神异身份与乡邻压力中依据亲眼所见作出选择的武陵樵夫。' },
        胡大姐: { role: 'supporting', description: '用户传说改编中的神异人物，与刘海共同经历考验。' },
        乡邻: { role: 'community_pressure', description: '以怀疑和排斥构成人物选择压力的群体。' },
        花鼓戏演员: { role: 'transmission', description: '在结尾把山路传说转化为舞台传播的表演者群体。' },
        观众: { role: 'transmission', description: '以应和和观看延续传说传播的群体。' },
      };
  return characterNames.slice(0, 8).map(name => ({
    name,
    role: descriptions[name]?.role ?? 'supporting',
    description: descriptions[name]?.description ?? '用户改编主线中的行动人物或群体。',
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
  const plot = buildScenePlot(
    template,
    entry,
    centralEvent,
    eventParagraphs,
    quotes,
    protagonist,
    characterNames,
    tone,
    videoType,
    supportingContext,
    idx,
    durationSec,
  );

  // Build conflict description
  const conflict = buildSceneConflict(template, centralEvent, protagonist, eventParagraphs);

  // Build dialogue/narration
  const dialogueOrNarration = buildDialogueOrNarration(
    template,
    centralEvent,
    quotes,
    protagonist,
    eventParagraphs,
    videoType,
    entry,
  );

  // Build key action
  const keyAction = buildKeyAction(template, protagonist, centralEvent, entry);

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

  const sceneShortPlan = videoType === 'scene_short'
    ? buildSceneShortSpatialPlan(entry, template, idx)
    : undefined;

  // Scene title
  const title = buildSceneTitle(template, centralEvent, idx);

  return {
    scene_id: idx + 1,
    title,
    duration_sec: durationSec,
    location: sceneShortPlan?.location ?? location,
    time_of_day: timeOfDay,
    dramatic_function: template.function_label,
    plot: sceneShortPlan?.plot ?? plot,
    key_action: sceneShortPlan?.keyAction ?? keyAction,
    characters: sceneShortPlan ? [sceneShortPlan.observer] : sceneChars,
    visual_prompt: sceneShortPlan?.visualPrompt ?? visualPrompt,
    camera_suggestion: sceneShortPlan?.cameraSuggestion ?? cameraSuggestion,
    cultural_note: culturalNote,
    conflict,
    dialogue_or_narration: dialogueOrNarration,
    source_entries: [entry.name],
    factual_basis: `基于${entry.name}中"${centralEvent}"相关内容`,
    fictionalized_elements: fictionalized,
  };
}

function buildSceneShortSpatialPlan(
  entry: EntryDetail,
  template: SceneTemplate,
  idx: number,
): {
  observer: string;
  location: string;
  plot: string;
  keyAction: string;
  visualPrompt: string;
  cameraSuggestion: string;
} {
  const rawObserver = entry.asset_split?.characters[0]?.trim();
  const observer = rawObserver ? sceneShortAssetLabel(rawObserver) : '当代寻访者';
  const subject = inferSubject(entry);
  const sourceNodes = entry.asset_split?.scenes.map(item => item.trim()).filter(Boolean) ?? [];
  const relatedNodes = entry.relatedLocations.map(item => item.name.trim()).filter(Boolean);
  const entrance = sourceNodes.some(item => item.includes('门庭'))
    ? `${subject}门庭`
    : sceneShortAssetLabel(sourceNodes[0] || relatedNodes[0] || `${subject}入口`);
  const middleSource = sourceNodes.find(item => /院落/.test(item));
  const middle = middleSource?.includes('书院院落')
    ? '书院院落'
    : sceneShortAssetLabel(middleSource || sourceNodes[1] || `${subject}院落`);
  const revealSource = sourceNodes.find(item => item.includes('朱张会讲'))
    ?? sourceNodes.find(item => item.includes('讲堂'));
  const revealLabel = sceneShortAssetLabel(revealSource || sourceNodes[2] || `${subject}核心空间`);
  const reveal = /朱张会讲/.test(revealLabel)
    ? '朱张会讲相关讲堂'
    : revealLabel;
  const rawAnchor = entry.asset_split?.scene_props[0]?.trim();
  const anchor = rawAnchor?.includes('门联') ? '门联' : sceneShortAssetLabel(rawAnchor || '入口标志物');
  const revealAction = /讲堂/.test(reveal) ? '推开讲堂木门' : `转过${reveal}入口`;

  if (template.function_label === '空间引入') {
    return {
      observer,
      location: entrance,
      plot: `${observer}从${entrance}进入${middle}，${anchor}与入口石阶先后进入视野；滴水声把人物引向空间内部。`,
      keyAction: `${observer}从${entrance}进入${middle}`,
      visualPrompt: `${entrance}为入口锚点，${observer}由外向内越过石阶，${anchor}在前景、${middle}在后景`,
      cameraSuggestion: `固定${entrance}内外轴线，跟拍人物由外向内`,
    };
  }
  if (template.function_label === '场景叙事' || template.function_label === '铺垫') {
    return {
      observer,
      location: middle,
      plot: `${observer}沿${middle}右侧廊道继续前行，绕过${anchor}，让${reveal}的入口从遮挡后逐步显现。`,
      keyAction: `${observer}沿${middle}右侧绕过${anchor}，走向${reveal}`,
      visualPrompt: `${middle}右侧廊柱保持同侧，${anchor}从前景移出，${reveal}入口在后景显现`,
      cameraSuggestion: `沿同一方向跟拍，不跨越${middle}廊道轴线`,
    };
  }
  if (template.function_label === '时空叠印') {
    return {
      observer,
      location: reveal,
      plot: `${observer}到达${reveal}并${revealAction}，室内匾额与书案由暗到明显现；当代寻访和历史说明在同一空间分层。`,
      keyAction: `${observer}${revealAction}，触发匾额和书案揭示`,
      visualPrompt: `由${middle}向${reveal}方向，右侧廊柱保持同侧，入口打开后匾额与书案从后景显现`,
      cameraSuggestion: `沿同一运动方向越过门槛，再切${reveal}全景`,
    };
  }
  return {
    observer,
    location: entrance,
    plot: `${observer}沿原路线从${reveal}经过${middle}返回${entrance}，右侧廊柱与${anchor}保持同侧，脚步声渐远。`,
    keyAction: `${observer}沿原路线返回${entrance}`,
    visualPrompt: `回程仍以右侧廊柱为方向锚点，${anchor}重新进入前景，${entrance}恢复为空间出口`,
    cameraSuggestion: `不跨轴跟拍回程，最后固定${entrance}空镜`,
  };
}

function sceneShortAssetLabel(value: string): string {
  return value
    .split(/[：:]/, 1)[0]
    .replace(/^[“”"'\s]+|[“”"'\s]+$/g, '')
    .trim();
}

function buildSceneShortCharacters(entry: EntryDetail): StoryCharacter[] {
  const rawObserver = entry.asset_split?.characters[0]?.trim();
  const name = rawObserver ? sceneShortAssetLabel(rawObserver) : '当代寻访者';
  const description = rawObserver?.split(/[：:]/).slice(1).join('：').trim()
    || `以当代观众视角串联${inferSubject(entry)}的连续空间`;
  return [{ name, role: 'protagonist', description, arc: '' }];
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
  if (isRefusalEvent(centralEvent)) return '南安军衙';
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
  durationSec: number,
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
      return buildLandscapeOpening(region, durationSec);
    case '意境流变':
      return buildMoodFlow(entry, region, durationSec);
    case '灵韵定格':
      return buildSpiritEssence(entry, durationSec);

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
  if (isRefusalEvent(centralEvent)) {
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
  if (isRefusalEvent(centralEvent)) {
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
  const antagonist = isRefusalEvent(centralEvent)
    ? refusalAntagonist(characterNames)
    : characterNames.length > 1 ? characterNames[1] : '上官';
  if (isRefusalEvent(centralEvent)) {
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
  if (isRefusalEvent(centralEvent)) {
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

function refusalAntagonist(characterNames: string[]): string {
  return characterNames.some(name => name.includes('王逵')) ? '知军王逵' : '知军';
}

const REFUSAL_EVENT_QUOTE = '杀人以媚人，吾不为也！';

function buildClimaxScene(protagonist: string, centralEvent: string, quote: string, details: string): string {
  if (isRefusalEvent(centralEvent)) {
    return `${protagonist}把未签的文书推回案头，对${antagonist_placeholder()}说："${REFUSAL_EVENT_QUOTE}"他将任命文书交还，准备辞官离去。${antagonist_placeholder()}被震动，案卷被重新打开。`;
  }
  if (centralEvent.includes('断案')) {
    return `新的证词和案卷细节互相印证，疑案终于查清。${protagonist}当众说明判由，冤屈者得以洗清，催促草率结案的人沉默退后。`;
  }
  if (centralEvent.includes('投江') || centralEvent.includes('殉国')) {
    return `${eventWithProtagonist(protagonist, centralEvent)}。江水合拢，岸边的人声忽然停住；这个选择，成为后世反复讲述的精神坐标。`;
  }
  return `${eventWithProtagonist(protagonist, centralEvent)}进入关键时刻。现场的人冲向目标、推开阻拦并完成决定局面的关键行动。${quote ? `"${quote}"` : `${protagonist}以实际行动回应现实，个人志向由此转向更广阔的人群与时代问题。`}`;
}

function buildEndingScene(protagonist: string, centralEvent: string, entry: EntryDetail, videoType: VideoType): string {
  if (isRefusalEvent(centralEvent)) {
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
  return `${usableQuote}。镜头回到工坊，${protagonist}把分开的细丝穿过针眼，再将成品纹理与手中材料并排举起，问题在这个动作里得到答案。`;
}

function buildAiComicEntrance(protagonist: string, centralEvent: string, region: string, details: string): string {
  if (centralEvent.includes('断案') || isRefusalEvent(centralEvent)) {
    return `白天，${region}衙署外雨声未停。${protagonist}把案卷摊开，指尖停在两处互相矛盾的证词上；门外脚步逼近，催签的人已经到了。`;
  }
  return `主角入场。${protagonist}带着未解决的疑问进入${region}，手中握着能改变局面的物件，表情从迟疑变得警觉。`;
}

function buildAiComicConflict(protagonist: string, centralEvent: string, details: string): string {
  if (centralEvent.includes('断案') || isRefusalEvent(centralEvent)) {
    return `上官把笔推到${protagonist}面前，案卷边缘被烛油烫出黑痕。${protagonist}没有接笔，而是把疑点逐条摊开：证词时间对不上，伤痕位置也不对。`;
  }
  return `对立面逼近，要求${protagonist}立刻接受既定结果。${protagonist}用一件可见证据反问，场面从沉默变成正面交锋。`;
}

function buildAiComicTurn(protagonist: string, centralEvent: string, quote: string): string {
  if (centralEvent.includes('断案') || isRefusalEvent(centralEvent)) {
    return `${protagonist}忽然合上案卷，转身走向牢门。他不再只在案头找答案，而要亲眼重看现场；这一转身，让所有人都意识到他不会顺势签下去。`;
  }
  return `${protagonist}突然改变行动方向，放弃最省事的路，选择承担更难的后果。表情从被逼迫变成清醒。`;
}

function buildAiComicClose(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  if (centralEvent.includes('断案') || isRefusalEvent(centralEvent)) {
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

interface HeritageCraftProfile {
  origin_objects: string;
  artisan_entrance: string;
  process_sequence: string;
  process_basis: string;
  process_visual: string;
  spirit_action: string;
  inheritance_action: string;
  default_narration: string;
  process_narration: string;
  inheritance_narration: string;
  key_actions: Record<string, string>;
  visual_details: Record<string, string>;
}

function inferHeritageCraftProfile(entry: EntryDetail): HeritageCraftProfile {
  const sourceText = [
    entry.name,
    entry.type,
    entry.summary,
    entry.story,
    entry.keywords.join(' '),
  ].join(' ');
  if (/皮影|影子戏|影偶|灯幕/.test(sourceText)) {
    return {
      origin_objects: '影偶、灯幕、旧唱本和操纵杆',
      artisan_entrance: '来到皮影工作台前，先检查牛皮影偶的关节，再摆齐雕刀、颜料和操纵杆。镜头拍雕刀转过皮面、关节活动和灯幕透光，人物情感从动作里出来。',
      process_sequence: '先选皮、刮制和画稿，再雕镂、敷彩、装订关节与操纵杆，最后到灯幕后试演',
      process_basis: '影偶需要经过皮料处理、画稿雕镂、敷彩装订和灯幕后场检验',
      process_visual: '镜头连续拍到雕刀转折、色彩落在镂空纹样上、关节被操纵杆带动，再让影偶在灯幕上完成第一个动作',
      spirit_action: '雕刀的转折、关节的装配和灯幕后每一次稳准操纵',
      inheritance_action: '年轻学徒接过影偶操纵杆，老艺人在灯幕后逐帧纠正动作',
      default_narration: '让影偶、雕刀、灯幕和唱腔自己说话。',
      process_narration: '选皮、雕镂、敷彩、装杆、试演，每一步都要慢下来给观众看清。',
      inheritance_narration: '真正的传承，不只在展柜里，也在年轻人接过影偶操纵杆、站到灯幕后的那一刻。',
      key_actions: {
        '技艺渊源': '展示影偶、旧唱本和灯幕，建立技艺来处',
        '匠人登场': '传承人检查影偶关节，摆齐雕刀、颜料和操纵杆',
        '工艺全程': '按顺序展示选皮、画稿、雕镂、敷彩、装杆和灯幕后试演',
        '精神内核': '用雕刀转折、关节装配和操纵动作表现匠心',
        '传承之路': '学徒接过影偶操纵杆，在灯幕后完成一次合演',
      },
      visual_details: {
        '技艺渊源': '影偶、灯幕、旧唱本和操纵杆，柔和侧光，微距开场',
        '匠人登场': '传承人在皮影工作台前检查牛皮影偶，雕刀、颜料和操纵杆同框，中近景',
        '工艺全程': '选皮、画稿、雕镂、敷彩、装杆和灯幕后试演，连续微距过程镜头',
        '精神内核': '雕刀沿镂空纹样转折，影偶关节活动与灯幕剪影交替特写',
        '传承之路': '学徒接过影偶操纵杆，老手与年轻手在灯幕后同框，暖光收束',
      },
    };
  }
  if (/绣|刺绣|湘绣|苏绣|蜀绣|粤绣|针法/.test(sourceText)) {
    return {
      origin_objects: '针线、绸面和图样',
      artisan_entrance: '坐到绣架前，先用指尖理顺丝线，再检查底稿。镜头拍手背的老茧、针尖的停顿和绸面的细光，人物情感从动作里出来。',
      process_sequence: '先选图样和底布，再配色、劈丝、穿针、落针',
      process_basis: '刺绣包含选稿、配线、劈丝、落针和收针等关键步骤',
      process_visual: '镜头连续拍到线从指间分开、针脚压住绸面、色线逐层过渡，流程顺序必须看得清',
      spirit_action: '一针一线、毛发光泽与层次在绸面上的准确落点',
      inheritance_action: '年轻学徒接过针线，老艺人在同一片绣面上纠正针脚',
      default_narration: '让手、线、工具和材料自己说话。',
      process_narration: '劈丝、配线、落针，每一步都要慢下来给观众看清。',
      inheritance_narration: '真正的传承，不只在展柜里，也在年轻人接过针线的那一刻。',
      key_actions: {
        '技艺渊源': '展示成品、旧照片和原料，建立技艺来处',
        '匠人登场': '传承人整理工具、检查底稿和丝线',
        '工艺全程': '按顺序展示配线、劈丝、穿针、落针和收针',
        '精神内核': '用慢针脚和细节修正表现匠心',
        '传承之路': '学徒接过针线，留下继续学习的动作',
      },
      visual_details: {
        '技艺渊源': '成品、旧照片、丝线、绸面和图样，柔和侧光，微距开场',
        '匠人登场': '传承人坐在绣架前，手背、针尖、线轴和底稿同框，中近景',
        '工艺全程': '劈丝、穿针、落针、针脚和色线过渡，连续微距过程镜头',
        '精神内核': '传承人低头修正针脚，绸面纹理和眼神特写',
        '传承之路': '学徒接过针线，老手与年轻手同框，暖光收束',
      },
    };
  }
  if (/舞|戏曲|唱腔|表演|鼓|乐器|曲艺/.test(sourceText)) {
    return {
      origin_objects: '代表性器具、服饰、旧谱和排练照片',
      artisan_entrance: '走进排练场，先检查器具、服饰和站位，再把一个基本动作拆开示范。镜头在手部、脚步和节奏提示之间切换，人物关系从纠正动作里出来。',
      process_sequence: '先检查器具和服饰，再分解基本动作、对齐节奏、组合段落并完整走场',
      process_basis: '表演类非遗需要把器具、基本动作、节奏配合和完整呈现逐项练清',
      process_visual: '镜头连续拍到手、脚、器具与队形的配合，动作前后顺序和安全距离必须看得清',
      spirit_action: '动作力度、节奏衔接和群体协作中的准确控制',
      inheritance_action: '年轻学习者接过器具、站入队列，在实践者纠正下完成同一段动作',
      default_narration: '让器具、脚步、节奏和人的配合自己说话。',
      process_narration: '查器具、拆动作、对节奏、合段落，每一步都要让观众看清。',
      inheritance_narration: '真正的传承，发生在年轻人站入队列、把同一段动作练准确的那一刻。',
      key_actions: {
        '技艺渊源': '展示代表性器具、旧谱和排练照片，建立项目来处',
        '匠人登场': '实践者检查器具与站位，拆解一个基本动作',
        '工艺全程': '按顺序展示器具检查、动作分解、节奏配合和完整走场',
        '精神内核': '用力度、节奏和群体协作表现技艺要求',
        '传承之路': '学习者站入队列，在纠正中完成同一段动作',
      },
      visual_details: {
        '技艺渊源': '代表性器具、服饰、旧谱和排练照片，柔和侧光，实物开场',
        '匠人登场': '实践者检查器具和服饰，手部、脚步与站位同框，中近景',
        '工艺全程': '动作分解、节奏配合、队形变化和完整走场，连续过程镜头',
        '精神内核': '器具、脚步、呼吸与群体协作交替特写',
        '传承之路': '年轻学习者站入队列，实践者在侧面纠正动作，暖光收束',
      },
    };
  }
  return {
    origin_objects: '代表性成品、原料、工具和工序记录',
    artisan_entrance: '来到工作台前，先检查材料与工具，再对照工序记录确认顺序。镜头拍手部力度、材料变化和工具停顿，人物情感从动作里出来。',
    process_sequence: '先备料和定形，再加工、装配、修整与检验',
    process_basis: '完整技艺需要把材料、工具、关键步骤和成品检验逐项讲清',
    process_visual: '镜头连续拍到材料在工具作用下发生变化，流程顺序和关键判断必须看得清',
    spirit_action: '材料变化、工具控制和反复检验中的准确判断',
    inheritance_action: '年轻学徒接过工具，在实践者纠正下完成同一道关键工序',
    default_narration: '让手、材料、工具和工序自己说话。',
    process_narration: '备料、加工、装配、检验，每一步都要慢下来给观众看清。',
    inheritance_narration: '真正的传承，发生在年轻人接过工具、把关键工序做准确的那一刻。',
    key_actions: {
      '技艺渊源': '展示成品、原料、工具和工序记录，建立技艺来处',
      '匠人登场': '实践者整理材料与工具，确认关键工序',
      '工艺全程': '按顺序展示备料、定形、加工、装配、修整和检验',
      '精神内核': '用材料变化、工具控制和反复检验表现匠心',
      '传承之路': '学徒接过工具，在纠正中完成关键工序',
    },
    visual_details: {
      '技艺渊源': '成品、原料、工具和工序记录，柔和侧光，实物开场',
      '匠人登场': '实践者在工作台前检查材料和工具，手部动作与工序记录同框',
      '工艺全程': '备料、定形、加工、装配、修整和检验，连续过程镜头',
      '精神内核': '材料细节、工具控制和反复检验交替特写',
      '传承之路': '学徒接过工具，实践者在旁纠正，暖光收束',
    },
  };
}

function buildHeritageOrigin(entry: EntryDetail, centralEvent: string, region: string): string {
  const subject = inferSubject(entry);
  const origin = firstCleanSentence(entry.story, entry.summary);
  const profile = inferHeritageCraftProfile(entry);
  return `${region}，镜头先落在${subject}的代表性实物与旧照片上。旁白交代技艺来处：${origin}。观众先看到${profile.origin_objects}，再进入实践现场。`;
}

function buildArtisanEntrance(protagonist: string, entry: EntryDetail, region: string): string {
  const subject = inferSubject(entry);
  const profile = inferHeritageCraftProfile(entry);
  return `一位${subject}传承人${profile.artisan_entrance}`;
}

function buildCraftProcess(entry: EntryDetail, details: string): string {
  const subject = inferSubject(entry);
  const profile = inferHeritageCraftProfile(entry);
  const basis = /制作|工艺|工序|步骤|流程|选料|雕|刻|装配|排练|动作/.test(details)
    ? details
    : firstCleanSentence(entry.story, `${subject}${profile.process_basis}`);
  return `工艺流程展开：${profile.process_sequence}。${basis}。${profile.process_visual}。`;
}

function buildCraftSpirit(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  const subject = inferSubject(entry);
  const spirit = firstCleanSentence(entry.culturalSignificance ?? '', '精益求精、以手传心');
  const profile = inferHeritageCraftProfile(entry);
  return `技艺不只是技术。${subject}的精神从${profile.spirit_action}里显出来：传承人宁愿放慢速度，也要把关键细节做准确。${spirit}。`;
}

function buildInheritancePath(protagonist: string, centralEvent: string, entry: EntryDetail): string {
  const subject = inferSubject(entry);
  const profile = inferHeritageCraftProfile(entry);
  return `传承的现实摆在镜头前：学习周期长、市场审美变化快，年轻学习者需要在速度和技艺准确之间做选择。${profile.inheritance_action}。${subject}不是陈列品，而是一条仍在继续的接力线。`;
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

function buildLandscapeOpening(region: string, durationSec: number): string {
  if (durationSec <= 10) {
    return `雾中，${region}露出峰脊；只听见风和滴水。`;
  }
  return `清晨，${region}从雾里露出峰脊。水汽沿石壁上升，风、滴水和鸟鸣唤醒山谷。`;
}

function buildMoodFlow(entry: EntryDetail, region: string, durationSec: number): string {
  if (durationSec <= 10) {
    return `${region}的晨光、雨雾、暮色掠过峰谷。`;
  }
  const keywords = entry.keywords.filter(k => ['山', '水', '云', '雾', '日', '月', '风', '雨', '春', '夏', '秋', '冬'].some(w => k.includes(w)));
  const moodWords = keywords.length > 0 ? keywords.slice(0, 4).join('、') : '晨光、雨雾、暮色';
  return `${moodWords}依次掠过${region}，峰壁与溪谷在时间里缓慢呼吸。`;
}

function buildSpiritEssence(entry: EntryDetail, durationSec: number): string {
  if (durationSec <= 10) {
    return '云移开，风声退下，山水的余味留给观看的人。';
  }
  const core = entry.culturalSignificance?.substring(0, 18)?.split(/[。]/)[0] ?? '山水灵韵';
  return `${core}。云从峰间移开，最远的一根石柱重新出现；风声退下去，山水把未说完的部分留给观看的人。`;
}

// ---------------------------------------------------------------------------
// Explainer video builders
// ---------------------------------------------------------------------------

function buildPoseQuestion(centralEvent: string, entry: EntryDetail): string {
  const visibleClues = entry.keywords.slice(0, 3).join('、') || entry.type;
  return `镜头来到${entry.region}，主讲人指向${visibleClues}的现场细节，把不同现象摆在同一画面里对照。${centralEvent}——为什么这件事值得关注？${entry.type === '非遗' ? '这种技艺为什么能千年传承？' : entry.type === '名胜古迹' ? '这个地方为什么成为文化地标？' : '这段历史为什么被记住？'}`;
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

function buildDialogueOrNarration(
  template: SceneTemplate,
  centralEvent: string,
  quotes: string[],
  protagonist: string,
  paragraphs: string[],
  videoType: VideoType,
  entry: EntryDetail,
): string {
  // For dramatic video types, extract actual dialogue
  if (['character_story', 'historical_drama', 'ai_comic_drama'].includes(videoType)) {
    if (isRefusalEvent(centralEvent)) {
      if (template.function_label === '钩子开场') return `旁白：案卷上的死罪二字压在案头，${protagonist}却迟迟没有落笔。`;
      if (template.function_label === '主角处境') return `${protagonist}（翻看片页）：证词前后不合，人命不能按催文定夺。`;
      if (template.function_label === '冲突升级') return `知军：此案已定，只等你签。${protagonist}：若证据有疑，这一笔便是误杀。`;
      if (template.function_label === '关键行动') return `${protagonist}：此案有疑，我不能签字。`;
      if (template.function_label === '高潮') return `${protagonist}：${REFUSAL_EVENT_QUOTE}`;
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
      const isCaseEvent = centralEvent.includes('断案') || isRefusalEvent(centralEvent);
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

  if (videoType === 'landscape_mood') {
    if (template.function_label === '山水开卷') return '旁白：山先从雾里醒来。';
    if (template.function_label === '灵韵定格') return '旁白：余味留给观看的人。';
    return '';
  }

  if (videoType === 'heritage_promo') {
    const profile = inferHeritageCraftProfile(entry);
    if (template.function_label === '工艺全程') return `旁白：${profile.process_narration}`;
    if (template.function_label === '传承之路') return `旁白：${profile.inheritance_narration}`;
    return `旁白：${profile.default_narration}`;
  }

  // Default: narration
  const sourceLine = cleanSourceSentences(paragraphs.join('\n'))[0];
  return sourceLine
    ? `旁白：${sourceLine}`
    : `旁白：${protagonist}在${centralEvent}中不断观察、判断，并把认识变成行动。`;
}

function buildKeyAction(
  template: SceneTemplate,
  protagonist: string,
  centralEvent: string,
  entry: EntryDetail,
): string {
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
    return inferHeritageCraftProfile(entry).key_actions[template.function_label] ?? '展示手艺流程';
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
    const isCaseEvent = centralEvent.includes('断案') || isRefusalEvent(centralEvent);
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
    const detail = inferHeritageCraftProfile(entry).visual_details[template.function_label];
    return detail
      ? `${location}，${timeOfDay}，${detail}`
      : `${location}，${timeOfDay}，${subject}材料、工具、手部动作，清晰过程构图`;
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
    const isCaseEvent = centralEvent.includes('断案') || isRefusalEvent(centralEvent);
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

  const isCaseEvent = centralEvent.includes('断案') || isRefusalEvent(centralEvent);
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

  if (isRefusalEvent(centralEvent)) {
    return `${protagonist}${centralEvent}——一份死刑文书面前，他选择了良知而非权势。`;
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
    '善良', '理解', '真心', '温暖', '成长', '勇敢', '选择', '诚实',
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
  const hasPoeticLandscapeEnding = result.videoType === 'landscape_mood'
    && /留白|余味|未说完|观看的人|风声退|静默/.test(lastSceneText);
  const hasEndingTheme = Boolean(lastScene && (
    themeWords.some(w => lastSceneText.includes(w) || fullText.includes(w) || result.title.includes(w))
    || hasPoeticLandscapeEnding
  ));
  if (!hasEndingTheme) issues.push('缺少结尾主题——没有精神/道德落点');

  // 7. isNotBiographySummary — full_text doesn't have 3+ year-starting paragraphs
  const yearPattern = /^(?:公元|前)?\d{3,4}年/;
  const paragraphs = fullText.split(/\n\n+/);
  const yearParagraphs = paragraphs.filter(p => yearPattern.test(p.trim()));
  const isNotBiographySummary = yearParagraphs.length < 3;
  if (!isNotBiographySummary) issues.push('full_text是生平年表——超过3个年份开头段落');

  const refusalEvidenceText = [
    fullText,
    ...scenes.flatMap(scene => [scene.plot, scene.dialogue_or_narration ?? '', ...scene.characters]),
  ].join('\n');
  const refusalEvidenceFaithful = !isRefusalEvent(result.selectedEvent)
    || (!/(?:向通书提出|通书不容|通书震怒|为上官杀人|以媚于人)/.test(refusalEvidenceText)
      && !scenes.some(scene => scene.characters.some(name => ['通书', '慎动', '陈抟'].includes(name))));
  if (!refusalEvidenceFaithful) {
    issues.push('拒签史实失真——著作或概念被误作人物，或可证原句遭改写');
  }

  const passed = hasCentralEvent
    && hasConflict
    && hasProtagonistChoice
    && hasSceneAction
    && hasClimax
    && hasEndingTheme
    && isNotBiographySummary
    && refusalEvidenceFaithful;

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
