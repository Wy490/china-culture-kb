import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import { getProjectContext } from './get-project-context.js';

type VideoType =
  | 'character_story'
  | 'historical_drama'
  | 'legend_story'
  | 'culture_promo'
  | 'heritage_promo'
  | 'city_brand_promo'
  | 'scene_short'
  | 'landscape_mood'
  | 'documentary_short'
  | 'explainer_video'
  | 'lecture_video'
  | 'education_training'
  | 'children_story'
  | 'social_short'
  | 'ai_comic_drama';

type StoryStructureType =
  | 'single_event_drama'
  | 'three_act_drama'
  | 'memory_mosaic_biography'
  | 'witness_testimony'
  | 'object_clue_journey'
  | 'before_after_transformation'
  | 'case_reconstruction'
  | 'lecture_argument'
  | string;

type GenreOutputField =
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

interface StorySceneLike {
  scene_id?: number;
  title?: string;
  duration_sec?: number;
  location?: string;
  time_of_day?: string;
  dramatic_function?: string;
  plot?: string;
  key_action?: string;
  characters?: string[];
  visual_prompt?: string;
  camera_suggestion?: string;
  cultural_note?: string;
  conflict?: string;
  dialogue_or_narration?: string;
  factual_basis?: string;
  fictionalized_elements?: string[];
}

interface StoryGenreBeatLike {
  order: number;
  function_label: string;
  scene_id?: number;
}

interface StoryBlueprintLike {
  central_question?: string;
  central_event?: string;
  genre_beats?: StoryGenreBeatLike[];
  evidence_boundaries?: Array<{ label?: string; note?: string; type?: string }>;
}

type StoryLike = Record<string, unknown> & {
  storyId?: string;
  project_id?: string;
  title?: string;
  logline?: string;
  theme?: string;
  full_text?: string;
  video_type?: VideoType;
  story_structure?: StoryStructureType;
  scene_breakdown?: StorySceneLike[];
  story_blueprint?: StoryBlueprintLike;
  quality_report?: {
    passed?: boolean;
    genre_score?: number;
    issues?: string[];
  };
  _request_meta?: Record<string, unknown>;
};

interface GenreProfileLite {
  video_type: VideoType;
  label: string;
  required_fields: GenreOutputField[];
  must_include: string[];
  avoid: string[];
  repair_guidance: string[];
}

interface BaseQualityReport {
  hasCentralEvent: boolean;
  hasConflict: boolean;
  hasProtagonistChoice: boolean;
  hasSceneAction: boolean;
  hasClimax: boolean;
  hasEndingTheme: boolean;
  isNotBiographySummary: boolean;
  passed: boolean;
  issues: string[];
}

export interface ValidateGenreStoryInput {
  project_id?: string;
  story_id?: string;
  story_json?: string;
  include_repair_actions?: boolean;
}

export interface ValidateGenreStoryResult {
  story_id?: string;
  project_id?: string;
  video_type: VideoType;
  story_structure?: StoryStructureType;
  passed: boolean;
  genre_score: number;
  issues: string[];
  missing_required_elements: string[];
  weak_beats: string[];
  forbidden_patterns_found: string[];
  repair_actions: string[];
  base_report: BaseQualityReport;
  source: 'project_id' | 'story_id' | 'story_json';
}

const ALL_VIDEO_TYPES: VideoType[] = [
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'children_story',
  'social_short',
  'ai_comic_drama',
];

const PROFILES: Record<VideoType, GenreProfileLite> = {
  character_story: {
    video_type: 'character_story',
    label: '人物故事',
    required_fields: ['characters', 'protagonist_arc'],
    must_include: ['主角目标', '可视化阻力', '价值选择', '选择代价', '人物弧光', '可信度边界'],
    avoid: ['传记流水账', '只罗列生平成就', '用抽象赞美代替选择'],
    repair_guidance: ['补强主角当下目标', '把抽象评价改写成行动', '为结尾增加精神落点'],
  },
  historical_drama: {
    video_type: 'historical_drama',
    label: '历史剧情短片',
    required_fields: ['characters', 'protagonist_arc'],
    must_include: ['历史场景质感', '事件因果', '史实锚点', '影视化边界'],
    avoid: ['把虚构对白写成史料原文', '架空历史', '只写宏大背景不写人物行动'],
    repair_guidance: ['补充史实依据', '压缩宏观背景', '把历史说明改成场景行动'],
  },
  legend_story: {
    video_type: 'legend_story',
    label: '神话/传说故事',
    required_fields: ['characters'],
    must_include: ['神异元素', '象征画面', '民间版本提示', '传说与史实边界'],
    avoid: ['把口述传说写成确定史实', '只堆奇观没有人的选择', '现代解释腔过重'],
    repair_guidance: ['增加凡人的选择', '补充传说边界', '减少现代解释性旁白'],
  },
  culture_promo: {
    video_type: 'culture_promo',
    label: '文化宣传片',
    required_fields: ['visual_symbols', 'core_message', 'slogan_or_key_sentence', 'modern_connection'],
    must_include: ['核心视觉符号', '核心信息', '当代连接', '一句可传播关键句'],
    avoid: ['纯口号堆砌', '百科介绍', '没有画面路线'],
    repair_guidance: ['补充视觉符号', '把口号改成可拍画面', '增加当代延续'],
  },
  heritage_promo: {
    video_type: 'heritage_promo',
    label: '非遗/工艺宣传片',
    required_fields: ['visual_symbols', 'craft_or_ritual_process', 'modern_connection', 'core_message', 'slogan_or_key_sentence'],
    must_include: ['原料/工具/手部动作', '完整流程', '传承人或实践者', '传承困境与希望'],
    avoid: ['只写成普通宣传口号', '忽略工艺步骤', '把工艺流程写成玄学'],
    repair_guidance: ['补出材料、工具和手部动作', '按顺序写清关键工序', '让传承困境来自真实工艺过程'],
  },
  city_brand_promo: {
    video_type: 'city_brand_promo',
    label: '城市/文旅宣传片',
    required_fields: ['spatial_identity', 'visual_symbols', 'modern_connection', 'slogan_or_key_sentence'],
    must_include: ['地理识别', '城市气质', '古今连接', '文旅记忆点'],
    avoid: ['泛泛城市口号', '缺少具体地点', '把城市写成抽象形容词'],
    repair_guidance: ['补具体地点和行走路线', '增加古今连接', '压缩泛化口号'],
  },
  scene_short: {
    video_type: 'scene_short',
    label: '场景短片',
    required_fields: ['spatial_identity', 'visual_route', 'time_layer', 'atmosphere'],
    must_include: ['空间路线', '时间层', '视觉焦点', '氛围收束'],
    avoid: ['只写地点介绍', '没有空间移动', '缺少氛围变化'],
    repair_guidance: ['补清空间路线', '增加时间层叠', '用氛围变化收束'],
  },
  landscape_mood: {
    video_type: 'landscape_mood',
    label: '山水意境片',
    required_fields: ['visual_symbols', 'atmosphere'],
    must_include: ['山水主体', '季节/天气', '声音', '光影', '留白'],
    avoid: ['讲解过多', '缺少自然主体', '画面无留白'],
    repair_guidance: ['减少解释', '补光影、声音和季节', '增加留白收束'],
  },
  documentary_short: {
    video_type: 'documentary_short',
    label: '微纪录片',
    required_fields: ['source_quotes', 'field_notes', 'modern_connection'],
    must_include: ['真实地点', '来源线索', '观察者视角', '当代连接'],
    avoid: ['过度戏剧化', '无来源线索', '把推测写成事实'],
    repair_guidance: ['补来源线索', '增加现场观察', '标出不确定边界'],
  },
  explainer_video: {
    video_type: 'explainer_video',
    label: '知识讲解视频',
    required_fields: ['argument_points', 'knowledge_outline'],
    must_include: ['核心问题', '概念定义', '例子', '可视化比喻', '结论'],
    avoid: ['概念堆叠', '没有例子', '没有总结'],
    repair_guidance: ['先提出核心问题', '补概念定义和例子', '增加可视化解释和总结'],
  },
  lecture_video: {
    video_type: 'lecture_video',
    label: '宣讲片',
    required_fields: ['argument_points', 'core_message', 'slogan_or_key_sentence'],
    must_include: ['明确论点', '论据', '案例', '精神提炼', '行动号召'],
    avoid: ['空泛口号', '论点和案例脱节', '缺少行动指向'],
    repair_guidance: ['明确论点', '补案例和论据', '用行动号召收束'],
  },
  education_training: {
    video_type: 'education_training',
    label: '教育/培训片',
    required_fields: ['knowledge_outline', 'argument_points'],
    must_include: ['学习目标', '步骤', '示范', '练习', '复盘'],
    avoid: ['不可操作', '一场承载多个教学目标', '缺少练习反馈'],
    repair_guidance: ['拆成可操作步骤', '增加示范和练习', '补复盘'],
  },
  children_story: {
    video_type: 'children_story',
    label: '儿童故事',
    required_fields: ['characters', 'protagonist_arc'],
    must_include: ['儿童可理解语言', '正向价值', '清楚因果', '温暖安全的情绪'],
    avoid: ['成人化复杂表达', '恐怖暴力细节', '晦涩典故堆砌'],
    repair_guidance: ['简化复杂概念', '降低冲突压迫感', '增加温暖结尾'],
  },
  social_short: {
    video_type: 'social_short',
    label: '竖屏短视频',
    required_fields: ['visual_symbols', 'slogan_or_key_sentence'],
    must_include: ['开场钩子', '反差信息', '高密度画面', '字幕记忆点'],
    avoid: ['开场慢', '信息拖沓', '缺少定格记忆点'],
    repair_guidance: ['压缩开场', '补反差信息', '增加字幕记忆点'],
  },
  ai_comic_drama: {
    video_type: 'ai_comic_drama',
    label: 'AI漫剧',
    required_fields: [],
    must_include: ['对白/旁白', '表情标注', '漫画分镜画面', '结尾钩子'],
    avoid: ['长段旁白压过对白', '没有表情动作', '每场缺少画面冲击'],
    repair_guidance: ['增加对白交锋', '补强表情变化', '为结尾增加追看钩子'],
  },
};

function storiesRoot(): string {
  return path.resolve(getKbRoot(), '..', 'web', 'generated', 'stories');
}

function assertSafeId(id: string, label: string): void {
  if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
    throw new Error(`非法${label}：${id}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function resolveStoryFromProject(projectId: string): Promise<StoryLike | null> {
  const context = await getProjectContext({ project_id: projectId });
  if (!context) return null;
  return {
    ...context.current_story,
    project_id: context.project.project_id,
    video_type: context.current_story.video_type as VideoType ?? context.project.video_type as VideoType,
    story_structure: context.current_story.story_structure as StoryStructureType ?? context.project.story_structure,
  } as StoryLike;
}

async function resolveStoryById(storyId: string): Promise<StoryLike | null> {
  assertSafeId(storyId, '故事 ID');
  for (const videoType of ALL_VIDEO_TYPES) {
    const filePath = path.join(storiesRoot(), videoType, `${storyId}.json`);
    try {
      return await readJsonFile<StoryLike>(filePath);
    } catch {
      // Try next video type directory.
    }
  }
  return null;
}

function parseStoryJson(storyJson: string): StoryLike {
  try {
    const parsed = JSON.parse(storyJson);
    if (!isRecord(parsed)) {
      throw new Error('story_json 必须是 JSON 对象');
    }
    return parsed as StoryLike;
  } catch (error) {
    if (error instanceof Error && error.message === 'story_json 必须是 JSON 对象') throw error;
    throw new Error(`story_json 不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function resolveStory(input: ValidateGenreStoryInput): Promise<{ story: StoryLike; source: ValidateGenreStoryResult['source'] } | null> {
  if (input.project_id?.trim()) {
    assertSafeId(input.project_id.trim(), '项目 ID');
    const story = await resolveStoryFromProject(input.project_id.trim());
    return story ? { story, source: 'project_id' } : null;
  }
  if (input.story_id?.trim()) {
    const story = await resolveStoryById(input.story_id.trim());
    return story ? { story, source: 'story_id' } : null;
  }
  if (input.story_json?.trim()) {
    return { story: parseStoryJson(input.story_json), source: 'story_json' };
  }
  throw new Error('必须提供 project_id、story_id 或 story_json');
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sceneText(scene: StorySceneLike): string {
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
    scene.factual_basis,
    ...(scene.fictionalized_elements ?? []),
  ].filter(Boolean).join('\n');
}

function scenes(story: StoryLike): StorySceneLike[] {
  return Array.isArray(story.scene_breakdown) ? story.scene_breakdown.filter(isRecord) as StorySceneLike[] : [];
}

function storyText(story: StoryLike): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    story.credibility_note,
    ...scenes(story).map(sceneText),
  ].filter(Boolean).join('\n');
}

function countTextChars(text: string): number {
  return (text.match(/[\p{Script=Han}A-Za-z0-9]/gu) ?? []).length;
}

function hasAny(text: string, words: string[]): boolean {
  return words.some(word => text.includes(word));
}

function validateBaseStory(story: StoryLike): BaseQualityReport {
  const storyScenes = scenes(story);
  const text = storyText(story);
  const selectedEvent = asString(story.story_blueprint?.central_event)
    || asString(story._request_meta?.selected_event);
  const issues: string[] = [];

  const hasCentralEvent = Boolean(selectedEvent)
    && selectedEvent !== '整体故事'
    && !selectedEvent.includes('一生')
    && !selectedEvent.includes('生平');
  if (!hasCentralEvent) issues.push('缺少核心事件——标题为"整体故事"或人物一生概述');

  const conflictWords = ['拒', '争', '抗', '逼', '选择', '两难', '拒签', '冲突', '对决', '争辩'];
  const hasConflict = storyScenes.some(scene => hasAny(`${scene.conflict ?? ''}${scene.plot ?? ''}`, conflictWords))
    || hasAny(text, conflictWords);
  if (!hasConflict) issues.push('缺少明确冲突——没有对抗、选择或两难');

  const choiceWords = ['选择', '拒签', '断案', '拒', '辞', '定', '决', '坚持'];
  const hasProtagonistChoice = storyScenes.some(scene => hasAny(`${scene.key_action ?? ''}${scene.plot ?? ''}`, choiceWords));
  if (!hasProtagonistChoice) issues.push('缺少主角选择——没有明确的选择行为');

  const hasSceneAction = storyScenes.length >= 3 && storyScenes.every(scene => countTextChars(scene.plot ?? '') >= 20);
  if (!hasSceneAction) issues.push('场景缺少具体行动描述');

  const hasClimax = storyScenes.some(scene => ['高潮', '高燃收束', '金句落点'].includes(scene.dramatic_function ?? ''));
  if (!hasClimax) issues.push('缺少高潮场景');

  const themeWords = [
    '良知', '精神', '道德', '价值', '正义', '廉洁', '担当', '坚守', '传承', '理想',
    '信仰', '觉醒', '初心', '使命', '家国', '民族', '奋斗', '求索',
  ];
  const lastSceneText = storyScenes.length ? sceneText(storyScenes[storyScenes.length - 1]) : '';
  const hasEndingTheme = hasAny(lastSceneText + text + asString(story.title), themeWords);
  if (!hasEndingTheme) issues.push('缺少结尾主题——没有精神/道德落点');

  const yearParagraphs = asString(story.full_text).split(/\n\n+/).filter(p => /^(?:公元|前)?\d{3,4}年/.test(p.trim()));
  const isNotBiographySummary = yearParagraphs.length < 3;
  if (!isNotBiographySummary) issues.push('full_text是生平年表——超过3个年份开头段落');

  return {
    hasCentralEvent,
    hasConflict,
    hasProtagonistChoice,
    hasSceneAction,
    hasClimax,
    hasEndingTheme,
    isNotBiographySummary,
    passed: hasCentralEvent && hasConflict && hasProtagonistChoice && hasSceneAction && hasClimax && hasEndingTheme && isNotBiographySummary,
    issues,
  };
}

function hasFieldValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

function findMissingRequiredElements(story: StoryLike, profile: GenreProfileLite): string[] {
  return profile.required_fields.filter(field => !hasFieldValue(story[field]));
}

function findWeakBeats(story: StoryLike): string[] {
  const beats = story.story_blueprint?.genre_beats ?? [];
  const storyScenes = scenes(story);
  if (beats.length === 0) return ['缺少类型节拍蓝图'];

  const weak: string[] = [];
  for (const beat of beats) {
    const scene = beat.scene_id
      ? storyScenes.find(item => item.scene_id === beat.scene_id)
      : storyScenes[beat.order - 1];
    if (!scene) {
      weak.push(`${beat.order}. ${beat.function_label}缺少对应场景`);
      continue;
    }
    const text = [
      scene.title,
      scene.dramatic_function,
      scene.plot,
      scene.key_action,
      scene.dialogue_or_narration,
    ].filter(Boolean).join(' ');
    const hasFunction = asString(scene.dramatic_function).includes(beat.function_label)
      || beat.function_label.includes(asString(scene.dramatic_function))
      || text.includes(beat.function_label);
    if (!hasFunction && countTextChars(text) < 60) {
      weak.push(`${beat.order}. ${beat.function_label}功能不清`);
    }
  }
  return weak;
}

function hasDialogue(story: StoryLike): boolean {
  const text = storyText(story);
  const sceneDialogue = scenes(story).map(scene => scene.dialogue_or_narration ?? '').join('\n');
  return /[「『“"][^」』”"]{2,}[」』”"]/.test(text)
    || /(对白|旁白|他说|她说|问道|答道|喊道|低声|沉声)/.test(sceneDialogue + text);
}

function hasExpressionOrAction(story: StoryLike): boolean {
  return /(表情|皱眉|抬头|转身|握紧|定格|分镜|特写|眼神|沉默|一愣|拔高|冲上)/.test(storyText(story));
}

function hasEndingHook(story: StoryLike): boolean {
  const storyScenes = scenes(story);
  const last = storyScenes.length ? sceneText(storyScenes[storyScenes.length - 1]) : asString(story.full_text).slice(-120);
  return /(悬念|追看|下一|还能|究竟|为什么|？|\?)/.test(last);
}

function hasCraftProcess(story: StoryLike): boolean {
  const text = storyText(story);
  const processWords = ['第一步', '第二步', '工序', '流程', '选料', '打磨', '雕刻', '烧制', '上色', '编织', '捶打', '晾晒', '发酵', '缝制', '手部', '工具', '材料'];
  const processCount = processWords.filter(word => text.includes(word)).length;
  return processCount >= 3 || countTextChars(asString(story.craft_or_ritual_process)) >= 20;
}

function hasHistoricalBoundary(story: StoryLike): boolean {
  const text = storyText(story);
  const hasSceneBoundary = scenes(story).some(scene => countTextChars(scene.factual_basis ?? '') > 0 || (scene.fictionalized_elements?.length ?? 0) > 0);
  const hasBlueprintBoundary = (story.story_blueprint?.evidence_boundaries?.length ?? 0) > 0;
  return hasSceneBoundary || hasBlueprintBoundary || /(史实|依据|史料|记载|地方志|正史|创作补足|影视化|虚构|边界|待核实)/.test(text);
}

function isBiographySummary(story: StoryLike): boolean {
  const text = asString(story.full_text);
  const yearHits = text.match(/(?:公元|前)?\d{3,4}年/g) ?? [];
  return yearHits.length >= 3 || /(一生|生平|历任|出生于|卒于|主要事迹|成就包括)/.test(text);
}

function hasCoreQuestion(story: StoryLike): boolean {
  const text = storyText(story);
  return Boolean(story.story_blueprint?.central_question)
    || /(为什么|是什么|如何|核心问题|先问|问题是|？|\?)/.test(text);
}

function hasConceptExampleAndSummary(story: StoryLike): boolean {
  const text = storyText(story);
  return /(定义|概念|意思是|所谓)/.test(text)
    && /(比如|例如|案例|举例)/.test(text)
    && /(所以|总结|带走|结论)/.test(text);
}

function hasSpatialRoute(story: StoryLike): boolean {
  if (countTextChars(asString(story.visual_route)) >= 12) return true;
  const locations = new Set(scenes(story).map(scene => scene.location).filter(Boolean));
  const text = storyText(story);
  return locations.size >= 2 && /(从|沿着|走进|穿过|转入|来到|进入|离开|路线|路径|台阶|巷道|门楼)/.test(text);
}

function findTypeIssues(story: StoryLike, videoType: VideoType): string[] {
  const issues: string[] = [];
  if (videoType === 'ai_comic_drama') {
    if (!hasDialogue(story)) issues.push('AI 漫剧缺少对白/旁白，冲突需要通过短对白或强旁白推进。');
    if (!hasExpressionOrAction(story)) issues.push('AI 漫剧缺少表情动作或漫画分镜画面。');
    if (!hasEndingHook(story)) issues.push('AI 漫剧结尾缺少追看钩子。');
  }
  if (videoType === 'heritage_promo' && !hasCraftProcess(story)) {
    issues.push('非遗/工艺宣传片缺少可拍的工艺步骤、材料、工具或手部动作。');
  }
  if (videoType === 'historical_drama' && !hasHistoricalBoundary(story)) {
    issues.push('历史剧情短片缺少史实锚点或影视化创作边界。');
  }
  if (videoType === 'character_story' && isBiographySummary(story)) {
    issues.push('人物故事写成生平流水账，需要改成围绕目标、阻力、选择和代价的单事件叙事。');
  }
  if (videoType === 'explainer_video') {
    if (!hasCoreQuestion(story)) issues.push('知识讲解视频缺少开场核心问题。');
    if (!hasConceptExampleAndSummary(story)) issues.push('知识讲解视频需要概念定义、例子和总结。');
  }
  if (videoType === 'scene_short' && !hasSpatialRoute(story)) {
    issues.push('场景短片缺少空间路线，观众不知道镜头如何在地点中移动。');
  }
  return issues;
}

function repairFromIssue(issue: string): string {
  if (issue.includes('AI 漫剧缺少对白')) return '为每场补 1-2 句短对白或强旁白，让人物冲突直接可听见。';
  if (issue.includes('表情动作')) return '在每场 plot 或 visual_prompt 中补表情变化、动作定格和漫画分镜构图。';
  if (issue.includes('追看钩子')) return '把最后一场改成疑问、反转或未完成行动，留下继续观看理由。';
  if (issue.includes('工艺步骤')) return '按材料、工具、关键工序、手部动作、成品效果补齐工艺流程。';
  if (issue.includes('史实锚点')) return '为关键场景补 factual_basis，并把虚构对白/调度写入 fictionalized_elements。';
  if (issue.includes('生平流水账')) return '选一个高冲突事件重写，保留目标、阻力、选择、代价和结尾精神落点。';
  if (issue.includes('核心问题')) return '开头用一个观众能理解的问题引出知识点，例如“为什么它会这样做/这样流传？”。';
  if (issue.includes('概念定义')) return '补一段概念定义，再用一个具体例子和一句总结收束。';
  if (issue.includes('空间路线')) return '按“入口 -> 路径 -> 视觉节点 -> 时间层 -> 氛围收束”重排场景。';
  return `处理问题：${issue}`;
}

function buildRepairActions(input: {
  missingRequiredElements: string[];
  weakBeats: string[];
  forbiddenPatternsFound: string[];
  typeIssues: string[];
  profile: GenreProfileLite;
}): string[] {
  return [
    ...input.missingRequiredElements.map(item => `补齐类型字段：${item}`),
    ...input.weakBeats.map(item => `强化节拍：${item}`),
    ...input.typeIssues.map(repairFromIssue),
    ...input.forbiddenPatternsFound.map(item => `改写不适配表达：${item}`),
    ...input.profile.repair_guidance,
  ].filter((item, index, arr) => arr.indexOf(item) === index);
}

function resolveVideoType(story: StoryLike): VideoType {
  const videoType = story.video_type;
  if (videoType && ALL_VIDEO_TYPES.includes(videoType)) return videoType;
  return 'character_story';
}

export async function validateGenreStory(input: ValidateGenreStoryInput): Promise<ValidateGenreStoryResult | null> {
  const resolved = await resolveStory(input);
  if (!resolved) return null;

  const story = resolved.story;
  const videoType = resolveVideoType(story);
  const profile = PROFILES[videoType];
  const baseReport = validateBaseStory(story);
  const missingRequiredElements = findMissingRequiredElements(story, profile);
  const weakBeats = findWeakBeats(story);
  const text = storyText(story);
  const forbiddenPatternsFound = profile.avoid.filter(pattern => text.includes(pattern));
  const typeIssues = findTypeIssues(story, videoType);
  const issues = [
    ...baseReport.issues,
    ...missingRequiredElements.map(item => `类型字段缺失：${item}`),
    ...weakBeats.map(item => `类型节拍偏弱：${item}`),
    ...typeIssues,
    ...forbiddenPatternsFound.map(item => `出现不适配表达：${item}`),
  ];

  const genreScore = Math.max(
    0,
    100
      - missingRequiredElements.length * 14
      - weakBeats.length * 8
      - typeIssues.length * 12
      - forbiddenPatternsFound.length * 10
      - baseReport.issues.length * 5,
  );
  const repairActions = input.include_repair_actions === false
    ? []
    : buildRepairActions({
        missingRequiredElements,
        weakBeats,
        forbiddenPatternsFound,
        typeIssues,
        profile,
      });

  return {
    story_id: story.storyId,
    project_id: story.project_id,
    video_type: videoType,
    story_structure: story.story_structure,
    passed: baseReport.passed && genreScore >= 70 && missingRequiredElements.length === 0 && typeIssues.length === 0,
    genre_score: genreScore,
    issues,
    missing_required_elements: missingRequiredElements,
    weak_beats: weakBeats,
    forbidden_patterns_found: forbiddenPatternsFound,
    repair_actions: repairActions,
    base_report: baseReport,
    source: resolved.source,
  };
}
