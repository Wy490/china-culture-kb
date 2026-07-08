// web/server/src/services/genre-quality-service.ts
// Adds video-type quality checks on top of the existing structural story report.

import type {
  GenreQualityReport,
  NarrativePatternId,
  StoryBlueprint,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { getGenreSampleGuidance, getGenreStoryProfile } from './genre-story-profiles.js';
import { getNarrativePatternQualitySignals, getNarrativePatternRepairActions } from './narrative-pattern-library.js';

type StoryFieldValue = string | string[] | Array<unknown> | undefined;

export function validateGenreStoryQuality(input: {
  story: StoryGenerateResult;
  baseReport: StoryQualityReport;
  blueprint?: StoryBlueprint;
  narrativePatternIds?: NarrativePatternId[];
}): GenreQualityReport {
  const profile = getGenreStoryProfile(input.story.video_type);
  const sampleGuidance = getGenreSampleGuidance(input.story.video_type);
  const narrativePatternSignals = getNarrativePatternQualitySignals(input.story.video_type, input.narrativePatternIds ?? []);
  const missingRequiredElements = findMissingRequiredElements(input.story);
  const weakBeats = findWeakBeats(input.story, input.blueprint);
  const missingNarrativePatternSignals = findMissingNarrativePatternSignals(input.story, narrativePatternSignals);
  const outlineDriftIssues = findOutlineDriftIssues(input.story);
  const adaptationIssues = findAdaptationIssues(input.story);
  const forbiddenPatternsFound = profile.avoid.filter(pattern => storyText(input.story).includes(pattern));
  const repairActions = [
    ...missingRequiredElements.map(item => `补齐类型字段：${item}`),
    ...weakBeats.map(item => `强化节拍：${item}`),
    ...outlineDriftIssues.map(item => `回到用户大纲：${item}`),
    ...adaptationIssues.map(item => `修正改编偏差：${item}`),
    ...missingNarrativePatternSignals.flatMap(signal => buildSignalRepairActions(signal, input.story)),
    ...forbiddenPatternsFound.map(item => `改写不适配表达：${item}`),
    ...sampleGuidance.quality_signals.map(item => `对齐样片信号：${item}`),
    ...getNarrativePatternRepairActions(input.story.video_type, input.narrativePatternIds ?? []),
    ...profile.repair_guidance,
    ...buildGearsRepairActions(input.story),
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  const genreScore = Math.max(
    0,
    100
      - missingRequiredElements.length * 14
      - weakBeats.length * 8
      - Math.min(missingNarrativePatternSignals.length, 4) * 3
      - outlineDriftIssues.length * 12
      - adaptationIssues.length * 10
      - forbiddenPatternsFound.length * 10
      - input.baseReport.issues.length * 5,
  );

  const genreIssues = [
    ...missingRequiredElements.map(item => `类型字段缺失：${item}`),
    ...weakBeats.map(item => `类型节拍偏弱：${item}`),
    ...outlineDriftIssues.map(item => `用户大纲偏离：${item}`),
    ...adaptationIssues.map(item => `改编偏差：${item}`),
    ...missingNarrativePatternSignals.slice(0, 4).map(item => `流派质量信号偏弱：${item}`),
    ...forbiddenPatternsFound.map(item => `出现不适配表达：${item}`),
  ];

  return {
    ...input.baseReport,
    video_type: input.story.video_type,
    story_structure: input.story.story_structure,
    genre_score: genreScore,
    missing_required_elements: missingRequiredElements,
    weak_beats: weakBeats,
    forbidden_patterns_found: forbiddenPatternsFound,
    repair_actions: repairActions,
    passed: input.baseReport.passed && genreScore >= 70 && missingRequiredElements.length === 0,
    issues: [...input.baseReport.issues, ...genreIssues],
  };
}

function findAdaptationIssues(story: StoryGenerateResult): string[] {
  const meta = story as StoryGenerateResult & { _request_meta?: Record<string, unknown> };
  if (meta._request_meta?.source_material_mode !== 'adapt_user_novel') return [];
  const source = story.original_user_query ?? '';
  if (!source.trim()) return ['缺少可对照的用户原作/改编素材。'];

  const analysis = story.adaptation_analysis;
  const sourceNames = analysis?.core_characters?.length ? analysis.core_characters : extractLikelyNames(source);
  const text = storyText(story);
  const issues: string[] = [];
  const missingNames = sourceNames.filter(name => !text.includes(name)).slice(0, 3);
  if (missingNames.length > 0) {
    issues.push(`原作关键人物/称谓未进入改编方案：${missingNames.join('、')}。`);
  }
  if (analysis?.plot_beats?.length) {
    const missingBeats = analysis.plot_beats
      .filter(beat => !hasEnoughOverlap(text, beat))
      .slice(0, 2);
    if (missingBeats.length > 0) {
      issues.push(`原作主线节拍未被改编承接：${missingBeats.join('；')}。`);
    }
  }
  if (analysis?.must_keep?.length) {
    const missingMustKeep = analysis.must_keep
      .filter(item => !hasEnoughOverlap(text, item))
      .slice(0, 2);
    if (missingMustKeep.length > 0) {
      issues.push(`原作保留项未落实：${missingMustKeep.join('；')}。`);
    }
  }
  if (analysis?.visual_setpieces?.length && story.scene_breakdown.every(scene => countCjkAndWordChars(scene.visual_prompt) < 18)) {
    issues.push('已识别原作可视化场面，但场景画面提示过薄，需把原作场面转成地点、人物、道具、光线和构图。');
  }
  if (/(知识库|词条|文化意义|来源条目|主条目)/.test(story.full_text)) {
    issues.push('正文出现资料说明腔，应改成视频剧情/旁白，不要暴露内部资料结构。');
  }
  if (story.full_text.length > source.length * 1.8 && source.length > 120) {
    issues.push('改编正文明显扩写过多，需压回原作主线和目标时长。');
  }
  return issues;
}

function hasEnoughOverlap(targetText: string, sourceFragment: string): boolean {
  const chunks = extractMatchChunks(sourceFragment);
  if (chunks.length === 0) return true;
  return chunks.some(chunk => targetText.includes(chunk));
}

function extractMatchChunks(text: string): string[] {
  const normalized = normalizeForMatch(text);
  const chunks = normalized.match(/[\u4e00-\u9fa5]{2,6}/g) ?? [];
  const blocked = ['保留', '核心', '人物', '称谓', '主线', '事件', '顺序', '原作', '选择', '场景'];
  return chunks.filter(chunk => !blocked.includes(chunk)).slice(0, 8);
}

function extractLikelyNames(text: string): string[] {
  const matches = text.match(/[\u4e00-\u9fa5]{2,4}/g) ?? [];
  const blocked = ['一个', '这是', '故事', '小说', '改编', '时候', '他们', '我们', '人物', '场景', '后来', '突然', '已经', '因为', '所以'];
  return [...new Set(matches.filter(item => !blocked.includes(item)).slice(0, 8))];
}

function buildSignalRepairActions(signal: string, story: StoryGenerateResult): string[] {
  const targetScene = pickRepairScene(story, signal);
  const prefix = targetScene ? `在第 ${targetScene.scene_id} 场「${targetScene.title || targetScene.dramatic_function}」` : '在对应场景';
  if (signal.includes('起点低')) return [`${prefix}补出主角的出身、资源限制或初始处境，不要只写后期成就。`];
  if (signal.includes('成长有代价')) return [`${prefix}写清继续求学/坚持选择带来的家庭冲突、现实压力或失去。`];
  if (signal.includes('目标明确')) return [`${prefix}补一句主角当下具体目标，例如“继续求学”“弄清国家为何衰弱”。`];
  if (signal.includes('精神落点来自选择')) return [`${prefix}把精神主题落到一次可见选择和行动上，不要只用评价句收束。`];
  if (signal.includes('两难成立') || signal.includes('选择有代价')) return [`${prefix}同时写出两条路的后果，让选择压力可见。`];
  if (signal.includes('因果链清楚')) return [`${prefix}补上“时代压力 -> 个人观察 -> 行动转变”的因果链。`];
  if (signal.includes('史实边界明确')) return [`${prefix}标明史实锚点与影视化补足边界。`];
  if (signal.includes('行动具体')) return [`${prefix}补可拍动作、实物或对白，避免抽象概括。`];
  return [`${prefix}补强「${signal}」：写成动作、冲突、后果或画面，不要只加标签。`];
}

function pickRepairScene(story: StoryGenerateResult, signal: string) {
  if (signal.includes('起点') || signal.includes('目标')) return story.scene_breakdown[0];
  if (signal.includes('代价') || signal.includes('两难') || signal.includes('因果')) {
    return story.scene_breakdown[Math.max(1, Math.floor(story.scene_breakdown.length / 2) - 1)] ?? story.scene_breakdown[0];
  }
  if (signal.includes('精神') || signal.includes('史实边界')) return story.scene_breakdown[story.scene_breakdown.length - 1];
  return story.scene_breakdown.find(scene => countCjkAndWordChars(scene.plot) < 35) ?? story.scene_breakdown[0];
}

function buildGearsRepairActions(story: StoryGenerateResult): string[] {
  const actions: string[] = [];
  const thinScenes = story.scene_breakdown.filter(scene => countCjkAndWordChars(scene.plot) < 35 || hasOnlyQuestion(scene.plot));
  if (thinScenes.length > 0) {
    actions.push(`补厚 GEARS 剧本单元：第 ${thinScenes.map(scene => scene.scene_id).join('、')} 场 plot 至少写出地点、动作、冲突/发现和情绪变化。`);
  }
  const pollutedVisualScenes = story.scene_breakdown.filter(scene => isPollutedVisualPrompt(scene.visual_prompt));
  if (pollutedVisualScenes.length > 0) {
    actions.push(`清理 GEARS 场景提示：第 ${pollutedVisualScenes.map(scene => scene.scene_id).join('、')} 场 visual_prompt 只保留可生成画面的空间、人物、道具、光线和构图。`);
  }
  return actions;
}

function findOutlineDriftIssues(story: StoryGenerateResult): string[] {
  const outline = story.original_user_query ?? '';
  if (!outline.trim()) return [];
  const outlineText = normalizeForMatch(outline);
  const text = normalizeForMatch(storyText(story));
  const issues: string[] = [];

  const maoYouthAnchors = ['毛泽东', '韶山', '长沙', '第一师范', '湘江评论', '驱张运动'];
  const maoYouthAnchorCount = maoYouthAnchors.filter(word => outlineText.includes(word)).length;
  const isMaoYouthOutline = maoYouthAnchorCount >= 2
    || (outlineText.includes('毛泽东') && /(少年|求学|思想|新思想)/.test(outlineText));

  if (isMaoYouthOutline) {
    const expected = ['韶山', '私塾', '求学', '长沙', '思想'].filter(word => (
      outlineText.includes(word) || (word === '思想' && outlineText.includes('新思想'))
    ));
    const requiredExpected = expected.length > 0 ? expected : ['韶山', '私塾', '求学', '长沙', '思想'];
    const matchedCount = requiredExpected.filter(word => text.includes(word)).length;
    if (matchedCount < Math.min(3, requiredExpected.length)) {
      issues.push(`用户大纲强调少年求学与思想形成，正文没有覆盖${requiredExpected.join('、')}等核心阶段。`);
    }
    if (/湘江评论|驱张运动|井冈山|延安|北京|天安门/.test(text) && !/湘江评论|驱张运动|井冈山|延安|北京|天安门/.test(outlineText)) {
      issues.push('正文把后期政治运动或革命地点推成主线，应压缩为结尾历史余响。');
    }
  }
  return issues;
}

function normalizeForMatch(value: string): string {
  return value.replace(/[，。；、\s：:（）()—\-]/g, '');
}

function findMissingNarrativePatternSignals(story: StoryGenerateResult, signals: string[]): string[] {
  const text = storyText(story);
  return signals.filter(signal => !hasSignalText(text, signal));
}

function hasSignalText(text: string, signal: string): boolean {
  if (hasSemanticSignalEvidence(text, signal)) return true;

  const normalizedSignal = signal.replace(/[，。；、\s]/g, '');
  if (!normalizedSignal) return true;
  const chunks = normalizedSignal
    .split(/明确|清楚|可见|成立|充足|具体|自然|存在|强|高|低|有/)
    .map(item => item.trim())
    .filter(item => item.length >= 2);
  if (chunks.length === 0) return text.includes(signal);
  return chunks.some(chunk => text.includes(chunk));
}

function hasSemanticSignalEvidence(text: string, signal: string): boolean {
  const compactText = text.replace(/\s+/g, '');
  const checks: Array<[RegExp, RegExp[]]> = [
    [/目标明确|人物目标清楚|必须有主角目标/, [/所求/, /要弄清/, /为了/, /求学不是/, /志向/, /书袋内侧写下/, /不能签字/, /要先看清事实/, /重查/, /重问证人/]],
    [/阻力具体|必须有阻力|制度压力可见/, [/官场规则/, /制度压力/, /名声/, /人情/, /催客/, /浊浪/, /路远/, /书卷会湿/, /行程.{0,6}误/, /知军.{0,8}催/, /催他签字/, /此案已定/, /得罪上官/, /可能丢官/, /获罪/, /长官权威/]],
    [/两难成立/, [/若[^。；]+；若/, /一边[^。；]+一边/, /赶路.{0,12}帮人/, /安稳.{0,12}远行/, /照旧签字.{0,20}含冤/, /坚持重查.{0,20}(得罪上官|仕途代价|获罪)/]],
    [/选择有代价|必须有选择和代价/, [/错过渡船/, /书卷会湿/, /行程.{0,6}误/, /泥痕/, /误一程/, /付出/, /书页.{0,6}皱/, /丢官/, /获罪/, /仕途代价/, /交还任命文书/, /准备辞官/, /得罪上官/]],
    [/行动具体/, [/系紧/, /停下脚步/, /蹲下/, /扶起/, /挽起/, /踩进/, /捞起/, /裹书/, /写下/, /长揖/, /背起/, /收起/, /推开/, /翻开/, /重查/, /走向/]],
    [/精神落点来自选择|结尾有人物变化/, [/守良知/, /守住/, /正义/, /廉洁/, /出淤泥而不染/, /更清楚的心/, /泥痕/, /继续上路/, /守.{0,4}心/, /承担仕途代价/, /退回的不是/, /精神坐标/, /权势不能替良知/]],
    [/因果链清楚|事件因果清楚/, [/因为/, /于是/, /导致/, /若[^。；]+；若/, /才/, /看见.{0,12}生出/, /生出.{0,12}承担/, /愿意承担.{0,12}才/, /忽然发现/, /发现疑点/, /疑点重重/, /证词前后不合/, /证据不足/, /只待.{0,6}画押/]],
    [/人物不是年表|不得写成年表式介绍/, [/(少年周敦颐|周敦颐).*(背起|停下脚步|蹲下|挽起|踩进|写下|停住笔|重查|翻到案卷|不能签字|退回|交还任命文书|逐页细读|记录疑点)/, /(屈原).*(站在风里|走向汨罗江|整理衣冠|怀石)/]],
    [/史实边界明确|再现边界清楚/, [/影视化创作/, /事实边界/, /史实边界/, /再现边界/, /确证/, /可考/, /不是《爱莲说》/, /不把.{0,20}写成/, /仍要说清/, /只作.{0,8}伏笔/, /据《史记》/, /传统叙述/, /有限再现/, /不把再现画面当作原始记录/, /事实梳理/]],
    [/制度压力可见|时代压力可见/, [/郢都失守/, /楚国败局/, /国都失陷/, /流放无归/, /制度压力/, /上官/, /催签/, /权势/, /官场规则/]],
    [/前3秒有局|开场有强画面/, [/停住了笔/, /疑难案卷/, /门外脚步逼近/, /案卷上的一个疑点/, /江边.{0,12}衣袂/]],
    [/关系冲突强/, [/上官.{0,12}推/, /照旧签了/, /若有冤情/, /这一笔就是人命/, /旁人：活下去/]],
    [/反转可承接|钩子可承接/, [/重新打开/, /冤案还没有结束/, /重看现场/, /下一步/, /继续追问/]],
    [/人物不丢失/, [/周敦颐/, /少年/, /屈原/, /主角/, /见证者/]],
    [/关系不改写/, [/上官/, /少年/, /见证者/, /对照角色/, /师兄/, /关系/, /对峙/, /催签/]],
    [/主线不换题|不牺牲原作|保留原作主线/, [/拒签/, /未签/, /案卷/, /不能签字/, /良知/, /人命面前/, /据《史记》/, /传统叙述/, /可考线索/]],
    [/新增内容不抢戏/, [/周敦颐/, /拒签/, /未签/, /良知/, /人命面前/, /屈原/, /汨罗江/]],
    [/现场明确|现实现场/, [/镜头从/, /现场/, /匾额/, /台基/, /展陈/, /游客/, /讲解员/]],
    [/来源提示存在|来源提示|线索物明确/, [/可考线索/, /文献/, /旧地图/, /展陈文字/, /匾额/, /台基/, /据《史记》/]],
    [/版本差异可见/, [/可考事实.{0,20}后世讲述/, /事实梳理/, /后世解释/, /历史再现/]],
    [/名场面可拍|视听动作具体|情绪高点清楚|不靠长解释/, [/特写/, /定格/, /推近/, /对切/, /近景/, /远景/, /烛火/, /江水/, /针尖/, /绣架/, /停住笔/, /推开/, /翻开/, /重查/]],
    [/流程完整|流程顺序清楚/, [/先选图样/, /底布/, /配色/, /劈丝/, /穿针/, /落针/, /收针/]],
    [/动词具体/, [/理顺/, /检查/, /配色/, /劈丝/, /穿针/, /落针/, /压住/, /修正/]],
    [/材料工具清楚/, [/丝线/, /绸面/, /图样/, /底布/, /绣架/, /针尖/, /线轴/]],
    [/匠心来自动作/, [/放慢速度/, /针脚/, /准确落在绸面/, /手背/, /指尖/, /慢针脚/]],
  ];

  return checks.some(([pattern, evidence]) =>
    pattern.test(signal) && evidence.some(item => item.test(compactText)),
  );
}

function hasOnlyQuestion(text: string): boolean {
  const cleaned = text.replace(/\s+/g, '');
  return cleaned.endsWith('？') || cleaned.endsWith('?')
    ? !/[。！!；;\n]/.test(cleaned.replace(/[？?]+$/g, ''))
    : false;
}

function isPollutedVisualPrompt(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return [
    '关键时刻',
    '核心画面是',
    '故事',
    '质量信号',
    '流派',
    '做出选择',
    '什么身份',
    '为什么',
    '资料',
    '摘要',
  ].some(word => text.includes(word));
}

function countCjkAndWordChars(text: string): number {
  return (text.match(/[\p{Script=Han}A-Za-z0-9]/gu) ?? []).length;
}

function findMissingRequiredElements(story: StoryGenerateResult): string[] {
  const profile = getGenreStoryProfile(story.video_type);
  const missing: string[] = [];
  for (const field of profile.required_fields) {
    if (!hasFieldValue((story as unknown as Record<string, StoryFieldValue>)[field])) {
      missing.push(field);
    }
  }
  return missing;
}

function findWeakBeats(story: StoryGenerateResult, blueprint: StoryBlueprint | undefined): string[] {
  const beats = blueprint?.genre_beats ?? [];
  if (beats.length === 0) return ['缺少类型节拍蓝图'];

  const weak: string[] = [];
  for (const beat of beats) {
    const scene = beat.scene_id
      ? story.scene_breakdown.find(item => item.scene_id === beat.scene_id)
      : story.scene_breakdown[beat.order - 1];
    if (!scene) {
      weak.push(`${beat.order}. ${beat.function_label}缺少对应场景`);
      continue;
    }
    const sceneText = [scene.title, scene.dramatic_function, scene.plot, scene.key_action, scene.dialogue_or_narration].filter(Boolean).join(' ');
    const hasFunction = scene.dramatic_function.includes(beat.function_label)
      || beat.function_label.includes(scene.dramatic_function)
      || sceneText.includes(beat.function_label);
    if (!hasFunction && sceneText.length < 60) {
      weak.push(`${beat.order}. ${beat.function_label}功能不清`);
    }
  }
  return weak;
}

function hasFieldValue(value: StoryFieldValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined;
}

function storyText(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    ...story.scene_breakdown.flatMap(scene => [
      scene.title,
      scene.dramatic_function,
      scene.plot,
      scene.key_action,
      scene.dialogue_or_narration ?? '',
    ]),
  ].join('\n');
}
