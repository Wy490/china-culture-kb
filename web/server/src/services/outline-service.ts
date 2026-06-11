// web/server/src/services/outline-service.ts — Story outline analysis + multi-entry matching

import {
  mcpReadAllProvinceFiles,
  mcpParseEntries,
  mcpProvinces,
  convertSearchResult,
  mcpGetFullEntryDetail,
  convertFullEntryDetail,
} from './mcp-proxy.js';
import { success, fail, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  EntrySearchResult,
  StoryOutlineAnalysis,
  StoryOutlineAnalyzeRequest,
  KnowledgeNeed,
  KnowledgePackEntry,
  KnowledgePackMissing,
  KnowledgePack,
  MultiMatchResult,
  VideoType,
  EntryDetail,
  StoryDetectedCharacter,
} from '@shared/types.js';
import { VIDEO_TYPE_CONFIG } from '@shared/types.js';
import {
  buildEntryKnowledgeSummary,
  collectSearchableEntries,
  detectProvince,
  extractKeywords,
  computeMatchScore,
} from './entry-service.js';
import type { SearchableEntry } from './entry-service.js';
import { appendDomainPackEntries } from './domain-pack-service.js';

// ---------------------------------------------------------------------------
// Predefined word lists for outline subject extraction
// ---------------------------------------------------------------------------

const PERSON_NAME_PREFIXES = [
  '毛', '周', '朱', '贺', '刘', '彭', '蔡', '杨', '任', '向', '左', '粟', '陈', '何',
  '屈', '贾', '张', '王', '曾', '陶', '杜', '韩', '柳', '范', '辛', '李', '赵', '魏',
  '吴', '孙', '郑', '冯', '曹', '项', '吕', '司马', '欧阳', '诸葛',
];

const DYNASTY_PERIOD_WORDS = [
  '先秦', '秦', '汉', '三国', '晋', '南北朝', '隋', '唐', '五代', '宋', '元', '明', '清',
  '春秋', '战国', '西汉', '东汉', '北宋', '南宋', '初唐', '盛唐', '晚唐',
  '少年', '青年', '中年', '晚年', '早期', '晚期', '前期', '后期',
  '革命', '觉醒', '求学', '起义', '抗战', '解放', '建国', '改革开放',
  '古代', '近代', '现代', '当代', '中古',
];

const EVENT_WORDS = [
  '学会', '运动', '起义', '战役', '战争', '改革', '革命', '起义', '起义',
  '拒签', '断案', '断案', '悟道', '殉国', '殉国', '投江', '守城',
  '长征', '秋收', '抗战', '会战', '大火', '受降', '起义',
  '变法', '废藩', '削侯', '改制', '维新', '新政',
  '学案', '书院', '办学', '科举', '科举', '著书', '著述',
  '结社', '同盟', '建党', '入党', '组军', '建军', '建军',
];

const ACTION_WORDS = [
  '探索', '寻找', '觉醒', '挣扎', '奋斗', '抗争', '反抗', '拒绝', '坚持',
  '追求', '守护', '捍卫', '坚守', '突破', '超越', '领悟', '悟道',
  '成长', '蜕变', '觉醒', '觉醒', '觉醒', '觉醒',
  '觉醒', '求索', '探寻', '叩问', '追问',
];

const EMOTION_WORDS = [
  '热血', '激情', '壮烈', '庄重', '紧张', '克制', '沉郁',
  '温馨', '温暖', '感人', '悲壮', '悲愤', '悲怆',
  '豪迈', '慷慨', '激昂', '昂扬', '雄壮',
  '诙谐', '幽默', '轻松', '欢快',
  '崇敬', '敬畏', '肃穆', '肃然',
  '愤怒', '不甘', '义愤', '激愤',
  '希望', '信念', '理想', '信仰',
];

const CITY_NAMES = [
  '长沙', '岳阳', '衡阳', '株洲', '湘潭', '邵阳', '常德', '益阳', '永州',
  '怀化', '娄底', '郴州', '张家界', '湘西', '浏阳', '汨罗', '韶山',
  '炎陵', '醴陵', '宁乡', '湘乡', '双峰', '凤凰', '通道', '芷江',
  '平江', '汝城', '南县', '桑植', '汨罗', '道县',
  '北京', '南京', '杭州', '广州', '武汉', '西安', '成都', '重庆',
  '洛阳', '开封', '苏州', '扬州', '绍兴', '泉州', '厦门', '大理',
  '延安', '井冈山', '遵义', '赤水', '大庸',
];

const TYPE_KEYWORD_HINTS_FLAT: Record<string, string[]> = {
  '历史人物': ['人物', '革命', '先贤', '诗人', '英雄', '领袖', '将军', '学者', '名臣', '思想家'],
  '神话传说': ['传说', '神话', '神仙', '仙人', '龙', '凤凰', '灵'],
  '民间故事': ['故事', '民间', '传说', '爱情', '狐仙'],
  '非遗': ['非遗', '工艺', '技艺', '传承', '手艺', '绣', '陶瓷', '织', '雕刻'],
  '传统工艺': ['工艺', '技艺', '手工', '制作', '烧制', '编织'],
  '名胜古迹': ['景区', '山水', '古城', '楼', '阁', '书院', '寺', '庙', '墓', '洞', '遗址', '名胜', '古迹'],
  '地方掌故': ['掌故', '轶事', '事件', '转折', '转折'],
  '节庆习俗': ['节日', '节庆', '习俗', '端午', '中秋', '春节', '过年', '庆典'],
  '饮食文化': ['美食', '饮食', '菜', '味道', '小吃', '特产', '烹饪'],
  '地方戏曲': ['戏曲', '戏', '剧', '唱', '舞台'],
  '宗教信仰': ['宗教', '信仰', '佛', '道', '祭祀', '祭'],
  '民俗活动': ['民俗', '活动', '赶秋', '鼓舞', '仪式'],
};

const IDENTITY_CHARACTER_RULES: Array<{
  name: string;
  aliases: string[];
  age_range?: StoryDetectedCharacter['age_range'];
  gender?: StoryDetectedCharacter['gender'];
  role_position: StoryDetectedCharacter['role_position'];
  asset_stability: StoryDetectedCharacter['asset_stability'];
}> = [
  { name: '少年', aliases: ['一个少年', '少年'], age_range: '少年', gender: '男', role_position: '配角', asset_stability: 'single_scene' },
  { name: '少女', aliases: ['一个少女', '少女'], age_range: '少年', gender: '女', role_position: '配角', asset_stability: 'single_scene' },
  { name: '老奶奶', aliases: ['一个老奶奶', '老奶奶', '老妇人', '老婆婆', '阿婆'], age_range: '老年', gender: '女', role_position: '配角', asset_stability: 'single_scene' },
  { name: '老人', aliases: ['一个老人', '老人', '老者', '老先生'], age_range: '老年', gender: '男', role_position: '配角', asset_stability: 'single_scene' },
  { name: '书童', aliases: ['书童', '小书童'], age_range: '少年', gender: '男', role_position: '配角', asset_stability: 'recurring' },
  { name: '差役', aliases: ['差役', '衙役', '官差'], age_range: '青年', gender: '未指定', role_position: '配角', asset_stability: 'single_scene' },
  { name: '县令', aliases: ['县令', '知县'], age_range: '中年', gender: '男', role_position: '配角', asset_stability: 'recurring' },
  { name: '船夫', aliases: ['船夫', '艄公', '渔父', '渔夫'], age_range: '中年', gender: '男', role_position: '配角', asset_stability: 'single_scene' },
  { name: '道士', aliases: ['道士', '道人'], age_range: '中年', gender: '男', role_position: '配角', asset_stability: 'recurring' },
  { name: '僧人', aliases: ['僧人', '和尚', '老僧'], age_range: '中年', gender: '男', role_position: '配角', asset_stability: 'single_scene' },
];

const GROUP_CHARACTER_RULES = [
  '村民',
  '百姓',
  '乡民',
  '士兵',
  '香客',
  '围观者',
  '行人',
  '孩童',
  '学生',
  '族人',
];

const SUPERNATURAL_CHARACTER_RULES: Array<{
  name: string;
  aliases: string[];
  role_position: StoryDetectedCharacter['role_position'];
}> = [
  { name: '狐仙', aliases: ['狐仙', '狐女', '狐狸精'], role_position: '配角' },
  { name: '鬼魂', aliases: ['鬼魂', '冤魂', '亡魂', '女鬼'], role_position: '配角' },
  { name: '龙女', aliases: ['龙女', '洞庭龙女'], role_position: '配角' },
  { name: '山神', aliases: ['山神', '土地神', '神灵'], role_position: '配角' },
  { name: '妖怪', aliases: ['妖怪', '精怪', '异类'], role_position: '反派' },
];

// ---------------------------------------------------------------------------
// Extract subjects from outline text
// ---------------------------------------------------------------------------

interface ClassifiedSubjects {
  person_names: string[];
  place_names: string[];
  period_words: string[];
  event_words: string[];
  culture_type_words: string[];
  action_words: string[];
  emotion_words: string[];
  other_keywords: string[];
}

function addUnique(list: string[], value: string) {
  if (value && !list.includes(value)) list.push(value);
}

function getEntryPersonAlias(entry: EntrySearchResult): string | null {
  if (entry.type !== '历史人物' && !entry.keywords.some(k => k.includes('人物'))) return null;
  const alias = entry.name.split('——')[0]?.trim();
  if (!alias || alias.length < 2 || alias.length > 4) return null;
  const hasKnownPrefix = PERSON_NAME_PREFIXES.some(prefix => alias.startsWith(prefix));
  return hasKnownPrefix ? alias : null;
}

async function getKnownPersonNames(): Promise<string[]> {
  const provinceFiles = await mcpReadAllProvinceFiles();
  const names: string[] = [];
  for (const [provinceName, content] of provinceFiles) {
    const parsed = mcpParseEntries(content, provinceName).map(convertSearchResult);
    for (const entry of parsed) {
      const alias = getEntryPersonAlias(entry);
      if (alias) addUnique(names, alias);
    }
  }
  return names.sort((a, b) => b.length - a.length);
}

function looksLikeBoundedPersonName(word: string): boolean {
  const hasKnownPrefix = PERSON_NAME_PREFIXES.some(prefix =>
    word.startsWith(prefix) && word.length >= prefix.length + 1 && word.length <= prefix.length + 2
  );
  if (!hasKnownPrefix) return false;

  const semanticWords = [
    ...DYNASTY_PERIOD_WORDS,
    ...EVENT_WORDS,
    ...ACTION_WORDS,
    ...EMOTION_WORDS,
    '人物', '故事', '时期', '时代', '资料', '内容', '主人公',
  ];
  return !semanticWords.some(term => word.includes(term));
}

function removeCoveredShortNames(names: string[]): string[] {
  return names.filter(name =>
    !names.some(other => other !== name && other.includes(name) && other.length > name.length)
  );
}

function classifySubjects(outline: string, knownPersonNames: string[] = []): ClassifiedSubjects {
  const result: ClassifiedSubjects = {
    person_names: [],
    place_names: [],
    period_words: [],
    event_words: [],
    culture_type_words: [],
    action_words: [],
    emotion_words: [],
    other_keywords: [],
  };

  // Split outline into segments
  const segments = outline.split(/[，、。；：！？\s,·——–\-–_\n""''（）【】《》]+/)
    .filter(s => s.trim().length >= 2);
  const segmentSet = new Set(segments);

  // Person extraction is intentionally conservative: first trust KB aliases,
  // then only accept short names that appear as their own segment.
  for (const knownName of knownPersonNames) {
    if (outline.includes(knownName)) {
      addUnique(result.person_names, knownName);
    }
  }
  for (const segment of segments) {
    if (segment.length <= 4 && looksLikeBoundedPersonName(segment)) {
      addUnique(result.person_names, segment);
    }
  }
  result.person_names = removeCoveredShortNames(result.person_names)
    .sort((a, b) => outline.indexOf(a) - outline.indexOf(b));

  // Also extract 2-4 char overlapping substrings for longer segments
  const candidates: string[] = [];
  for (const seg of segments) {
    if (seg.length <= 4) {
      candidates.push(seg);
    } else {
      for (let len = 2; len <= Math.min(seg.length, 4); len++) {
        for (let i = 0; i <= seg.length - len; i++) {
          candidates.push(seg.substring(i, i + len));
        }
      }
    }
  }
  const uniqueCandidates = [...new Set(candidates)];

  // Classify each candidate
  for (const word of uniqueCandidates) {
    if (result.person_names.includes(word)) {
      continue;
    }

    // Place names
    if (CITY_NAMES.includes(word) || mcpProvinces.includes(word)) {
      addUnique(result.place_names, word);
      continue;
    }

    // Dynasty/period words
    if (DYNASTY_PERIOD_WORDS.includes(word)) {
      addUnique(result.period_words, word);
      continue;
    }

    // Event words
    if (EVENT_WORDS.includes(word)) {
      addUnique(result.event_words, word);
      continue;
    }

    // Action words
    if (ACTION_WORDS.includes(word)) {
      addUnique(result.action_words, word);
      continue;
    }

    // Emotion words
    if (EMOTION_WORDS.includes(word)) {
      addUnique(result.emotion_words, word);
      continue;
    }

    // Culture type words (reverse lookup from TYPE_KEYWORD_HINTS)
    let matchedType = false;
    for (const [typeName, hints] of Object.entries(TYPE_KEYWORD_HINTS_FLAT)) {
      if (hints.includes(word)) {
        addUnique(result.culture_type_words, `${typeName}→${word}`);
        matchedType = true;
        break;
      }
    }
    if (matchedType) continue;

    // Other keywords (2+ chars, not classified). Do not keep fragments of a
    // recognized person name, otherwise "毛泽东" leaks as "毛泽/泽东".
    if (result.person_names.some(name => name.includes(word))) {
      continue;
    }
    if (word.length >= 2 && segmentSet.has(word) && !result.other_keywords.includes(word)) {
      result.other_keywords.push(word);
    }
  }

  return result;
}

function extractDetectedCharacters(outline: string, subjects: ClassifiedSubjects): StoryDetectedCharacter[] {
  const characters: StoryDetectedCharacter[] = [];
  const mainCharacter = subjects.person_names[0] ?? null;

  for (const name of subjects.person_names) {
    addDetectedCharacter(characters, {
      name,
      role_position: name === mainCharacter ? '主角' : '配角',
      character_kind: 'named_person',
      source_text: findSourceSentence(outline, name),
      asset_stability: 'recurring',
      gender: '未指定',
    });
  }

  for (const rule of IDENTITY_CHARACTER_RULES) {
    const alias = rule.aliases.find(item => outline.includes(item));
    if (!alias) continue;
    addDetectedCharacter(characters, {
      name: rule.name,
      role_position: rule.role_position,
      character_kind: 'identity_role',
      source_text: findSourceSentence(outline, alias),
      asset_stability: countOccurrences(outline, alias) > 1 ? 'recurring' : rule.asset_stability,
      age_range: rule.age_range,
      gender: rule.gender,
    });
  }

  for (const name of GROUP_CHARACTER_RULES) {
    if (!outline.includes(name)) continue;
    addDetectedCharacter(characters, {
      name,
      role_position: '群演',
      character_kind: 'group_role',
      source_text: findSourceSentence(outline, name),
      asset_stability: 'single_scene',
      gender: '不适用',
    });
  }

  for (const rule of SUPERNATURAL_CHARACTER_RULES) {
    const alias = rule.aliases.find(item => outline.includes(item));
    if (!alias) continue;
    addDetectedCharacter(characters, {
      name: rule.name,
      role_position: rule.role_position,
      character_kind: 'supernatural_role',
      source_text: findSourceSentence(outline, alias),
      asset_stability: countOccurrences(outline, alias) > 1 ? 'recurring' : 'single_scene',
      gender: '未指定',
    });
  }

  return characters;
}

function addDetectedCharacter(characters: StoryDetectedCharacter[], character: StoryDetectedCharacter) {
  const existing = characters.find(item => item.name === character.name);
  if (!existing) {
    characters.push(character);
    return;
  }
  if (existing.role_position !== '主角' && character.role_position === '主角') {
    existing.role_position = '主角';
  }
  if (existing.asset_stability !== 'recurring' && character.asset_stability === 'recurring') {
    existing.asset_stability = 'recurring';
  }
  if (!existing.source_text.includes(character.source_text)) {
    existing.source_text = `${existing.source_text}；${character.source_text}`.substring(0, 160);
  }
}

function findSourceSentence(text: string, keyword: string): string {
  const sentences = text
    .split(/(?<=[。！？!?；;\n])/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  return sentences.find(sentence => sentence.includes(keyword)) ?? keyword;
}

function countOccurrences(text: string, keyword: string): number {
  return text.split(keyword).length - 1;
}

// ---------------------------------------------------------------------------
// Detect domain from subjects
// ---------------------------------------------------------------------------

function detectDomain(subjects: ClassifiedSubjects): 'china_culture_or_history' | 'modern' | 'other' {
  const hasHistoryOrCulture = subjects.period_words.length > 0
    || subjects.culture_type_words.length > 0
    || subjects.event_words.length > 0
    || subjects.place_names.some(p => mcpProvinces.includes(p));

  if (hasHistoryOrCulture || subjects.person_names.length > 0) {
    return 'china_culture_or_history';
  }
  if (subjects.action_words.some(a => ['革命', '起义', '抗战'].includes(a))) {
    return 'china_culture_or_history';
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// Infer story intent from classified subjects
// ---------------------------------------------------------------------------

function inferStoryIntent(subjects: ClassifiedSubjects, outline: string): {
  main_character: string | null;
  time_range: string | null;
  core_theme: string;
  conflict_keywords: string[];
  target_emotion: string[];
} {
  const mainCharacter = subjects.person_names.length > 0 ? subjects.person_names[0] : null;
  const timeRange = subjects.period_words.length > 0 ? subjects.period_words.join('→') : null;

  // Core theme from action/event/life-phase words.
  const phaseThemeWords = subjects.period_words.filter(p =>
    ['求学', '革命', '觉醒', '起义', '抗战', '解放', '建国', '改革开放'].includes(p)
  );
  const themeParts = [...subjects.action_words.slice(0, 2), ...subjects.event_words.slice(0, 2), ...phaseThemeWords.slice(0, 2)];
  const coreTheme = themeParts.length > 0 ? themeParts.join('与') : (outline.length > 20 ? outline.substring(0, 20) + '…' : outline);

  // Conflict keywords from event + action intersection
  const conflictKeywords = [...subjects.event_words.slice(0, 3), ...subjects.action_words.slice(0, 2)];

  // Target emotion from emotion words, or infer from context
  let targetEmotion = subjects.emotion_words.length > 0
    ? subjects.emotion_words.slice(0, 4)
    : inferEmotionFromContext(subjects);

  return {
    main_character: mainCharacter,
    time_range: timeRange,
    core_theme: coreTheme,
    conflict_keywords: conflictKeywords,
    target_emotion: targetEmotion,
  };
}

function inferEmotionFromContext(subjects: ClassifiedSubjects): string[] {
  // Default emotions based on subject types
  if (subjects.event_words.some(e => ['革命', '起义', '抗战', '起义'].includes(e))) {
    return ['热血', '壮烈', '庄重'];
  }
  if (subjects.person_names.length > 0 && subjects.period_words.some(p => ['古代', '先秦', '秦', '汉', '唐', '宋'].includes(p))) {
    return ['庄重', '克制', '沉郁'];
  }
  if (subjects.culture_type_words.some(c => c.includes('非遗') || c.includes('工艺'))) {
    return ['崇敬', '温暖', '感人'];
  }
  return ['庄重', '感人'];
}

// ---------------------------------------------------------------------------
// Generate knowledge needs from story intent + subjects
// ---------------------------------------------------------------------------

function generateKnowledgeNeeds(
  intent: { main_character: string | null; time_range: string | null },
  subjects: ClassifiedSubjects,
  detectedCharacters: StoryDetectedCharacter[],
): KnowledgeNeed[] {
  const needs: KnowledgeNeed[] = [];

  // Main character need
  const mainCharKeywords = intent.main_character
    ? [intent.main_character]
    : subjects.person_names.slice(0, 3);
  if (mainCharKeywords.length > 0) {
    needs.push({
      need_id: 'main_character',
      label: '主人公人物资料',
      keywords: mainCharKeywords,
      required: true,
    });
  }

  // Regional context need
  const placeKeywords = subjects.place_names.slice(0, 4);
  if (placeKeywords.length > 0) {
    needs.push({
      need_id: 'regional_context',
      label: '地域文化背景',
      keywords: placeKeywords,
      required: true,
    });
  }

  // Historical events need
  const eventKeywords = subjects.event_words.slice(0, 4);
  if (eventKeywords.length > 0) {
    needs.push({
      need_id: 'historical_events',
      label: '关键历史事件',
      keywords: eventKeywords,
      required: true,
    });
  }

  // Cultural background need
  const cultureKeywords = subjects.culture_type_words
    .map(c => c.split('→')[1])
    .filter(k => !['故事', '人物'].includes(k))
    .slice(0, 4);
  if (cultureKeywords.length > 0) {
    needs.push({
      need_id: 'cultural_background',
      label: '文化类型背景',
      keywords: cultureKeywords,
      required: subjects.person_names.length === 0, // required only if no person-focused story
    });
  }

  // Supporting characters need
  const supportingCharKeywords = [...new Set([
    ...subjects.person_names.filter(n => n !== intent.main_character),
    ...detectedCharacters
      .filter(character => character.role_position !== '主角')
      .map(character => character.name),
  ])].slice(0, 6);
  if (supportingCharKeywords.length > 0) {
    needs.push({
      need_id: 'supporting_characters',
      label: '相关人物资料',
      keywords: supportingCharKeywords,
      required: false,
    });
  }

  return needs;
}

// ---------------------------------------------------------------------------
// Analyze story outline — public API
// ---------------------------------------------------------------------------

export async function analyzeOutline(
  request: StoryOutlineAnalyzeRequest,
): Promise<ApiResponse<StoryOutlineAnalysis>> {
  const { outline } = request;
  if (!outline.trim()) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'outline cannot be empty');
  }

  const knownPersonNames = await getKnownPersonNames();
  const subjects = classifySubjects(outline, knownPersonNames);
  const domain = detectDomain(subjects);
  const intent = inferStoryIntent(subjects, outline);
  const detectedCharacters = extractDetectedCharacters(outline, subjects);
  const knowledgeNeeds = generateKnowledgeNeeds(intent, subjects, detectedCharacters);

  // Collect all detected subjects
  const detectedSubjects = [
    ...subjects.person_names,
    ...subjects.place_names,
    ...subjects.period_words,
    ...subjects.event_words,
    ...subjects.action_words,
    ...subjects.emotion_words,
    ...subjects.other_keywords.slice(0, 10),
  ];

  return success({
    outline: outline.trim(),
    detected_subjects: detectedSubjects,
    detected_domain: domain,
    story_intent: intent,
    detected_characters: detectedCharacters,
    knowledge_needs: knowledgeNeeds,
  });
}

// ---------------------------------------------------------------------------
// Multi-entry matching — public API
// ---------------------------------------------------------------------------

interface MultiMatchParams {
  outline: string;
  knowledge_needs: KnowledgeNeed[];
  limit_per_need: number;
}

export async function multiMatchEntries(
  params: MultiMatchParams,
): Promise<ApiResponse<MultiMatchResult>> {
  const { outline, knowledge_needs, limit_per_need } = params;

  // Step 1: Collect all entries from knowledge base, including long story/detail fields.
  const allEntries = await collectSearchableEntries();

  // Step 2: For each knowledge_need, independently match entries
  const entryRoleMap = new Map<string, { entry: SearchableEntry; score: number; role: string; reason: string; keywords: string[] }>();

  for (const need of knowledge_needs) {
    // Build a combined query from need keywords
    const needQuery = need.keywords.join(' ');
    const queryKeywords = extractKeywords(needQuery);
    const queryProvince = detectProvince(needQuery);

    for (const entry of allEntries) {
      if (!entryMatchesNeedRole(need, entry)) continue;
      const score = computeMatchScore(needQuery, queryKeywords, entry, queryProvince);
      if (score >= 0.35) {
        const existing = entryRoleMap.get(entry.name);
        // Keep the best role (highest score) for each entry
        if (!existing || score > existing.score) {
          const reason = buildMultiMatchReason(need, entry, score);
          entryRoleMap.set(entry.name, { entry, score, role: need.need_id, reason, keywords: queryKeywords });
        }
      }
    }
  }

  // Step 3: Categorize into primary/supporting/missing
  const primaryEntries: KnowledgePackEntry[] = [];
  const supportingEntries: KnowledgePackEntry[] = [];
  const missingNeeds: KnowledgePackMissing[] = [];

  const primaryRoleIds = ['main_character', 'historical_events'];
  const supportingRoleIds = ['regional_context', 'cultural_background', 'supporting_characters'];

  for (const [entryName, data] of entryRoleMap) {
    const entry = data.entry;
    const kpEntry: KnowledgePackEntry = {
      entry_name: entry.name,
      province: entry.province,
      region: entry.region || '',
      type: entry.type,
      summary: buildEntryKnowledgeSummary(entry, data.keywords),
      score: Math.round(data.score * 100) / 100,
      role_in_story: data.role,
      match_reason: data.reason,
      keywords: entry.keywords,
      knowledge_domain: entry.knowledge_domain,
      entry_role: entry.entry_role,
      era: entry.era,
      asset_usage: entry.asset_usage,
    };

    if (data.score >= 0.75 && primaryRoleIds.includes(data.role)) {
      primaryEntries.push(kpEntry);
    } else if (data.score >= 0.55) {
      if (primaryRoleIds.includes(data.role) && data.score >= 0.65) {
        primaryEntries.push(kpEntry);
      } else {
        supportingEntries.push(kpEntry);
      }
    }
  }

  // Sort by score descending
  primaryEntries.sort((a, b) => b.score - a.score);
  supportingEntries.sort((a, b) => b.score - a.score);
  const enrichedSupportingEntries = appendDomainPackEntries(supportingEntries, {
    query: outline,
    primaryEntries,
    limit: 5,
  });

  // Check for missing needs
  const coveredNeedIds = new Set([...primaryEntries, ...enrichedSupportingEntries].map(e => e.role_in_story));
  for (const need of knowledge_needs) {
    if (need.required && !coveredNeedIds.has(need.need_id)) {
      missingNeeds.push({
        need_id: need.need_id,
        label: need.label,
        message: `知识库中未找到高置信度条目，可作为创作方向但不可写成已验证史实`,
      });
    }
  }

  // Step 4: Calculate overall confidence
  const requiredNeeds = knowledge_needs.filter(n => n.required);
  const coveredRequired = requiredNeeds.filter(n => coveredNeedIds.has(n.need_id));
  const overallConfidence = requiredNeeds.length > 0
    ? Math.round((coveredRequired.length / requiredNeeds.length) * 100) / 100
    : 1.0;

  return success({
    outline: outline.trim(),
    matched_knowledge_pack: {
      primary_entries: primaryEntries,
      supporting_entries: enrichedSupportingEntries,
      missing_needs: missingNeeds,
      overall_confidence: overallConfidence,
    },
  });
}

function entryMatchesNeedRole(need: KnowledgeNeed, entry: EntrySearchResult): boolean {
  if (need.need_id === 'main_character') {
    return need.keywords.some(kw => {
      const entryAlias = entry.name.split('——')[0]?.trim() ?? entry.name;
      return entryAlias === kw || (entry.type === '历史人物' && (
        entry.name.includes(kw)
        || entry.summary.includes(kw)
        || entry.keywords.some(ekw => ekw.includes(kw) || kw.includes(ekw))
      ));
    });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Multi-match reason builder
// ---------------------------------------------------------------------------

function buildMultiMatchReason(need: KnowledgeNeed, entry: EntrySearchResult, score: number): string {
  const reasons: string[] = [];

  const matchedKws = need.keywords.filter(kw =>
    entry.name.includes(kw) || entry.summary.includes(kw) || entry.keywords.some(ekw => ekw.includes(kw) || kw.includes(ekw))
  );
  if (matchedKws.length > 0) {
    reasons.push(`关键词命中：${matchedKws.join('、')}`);
  }

  if (score >= 0.75) {
    reasons.push('高置信度匹配');
  } else if (score >= 0.55) {
    reasons.push('中等匹配度');
  }

  reasons.push(`角色：${need.label}`);

  return reasons.join('；');
}
