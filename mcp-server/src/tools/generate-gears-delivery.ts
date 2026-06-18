import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import { getProjectContext } from './get-project-context.js';

type SourceKind = 'project_id' | 'story_id' | 'story_json';
type PanelCount = 4 | 6 | 8 | 9 | 10 | 12;
type GearsSceneType = '室内' | '室外' | '虚构空间' | '不限';
type GearsSceneAtmosphere = '明亮' | '压抑' | '温馨' | '紧张' | '神秘' | '中性';
type GearsTimeOfDay = '早' | '午' | '夕' | '夜';
type GearsGender = '男' | '女' | '其他' | '未指定' | '不适用';
type GearsAgeRange = '儿童' | '少年' | '青年' | '中年' | '老年' | '不适用';
type GearsCharacterRolePosition = '主角' | '反派' | '配角' | '路人' | '群演';

interface StoryCharacterLike {
  name?: string;
  role?: string;
  description?: string;
  arc?: string;
}

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
  dialogue_or_narration?: string;
  factual_basis?: string;
  fictionalized_elements?: string[];
}

interface GearsSegmentLike {
  segment_id?: number;
  source_scene_id?: number;
  duration_sec?: number;
  panel_count?: number;
  script_text?: string;
  purpose?: string;
  visual_focus?: string[];
  cultural_constraints?: string[];
  segment_prompt_hint?: string;
  source_entries?: string[];
}

type StoryLike = Record<string, unknown> & {
  storyId?: string;
  project_id?: string;
  title?: string;
  logline?: string;
  theme?: string;
  source_entry?: string;
  credibility_note?: string;
  video_type?: string;
  presentation_style?: string;
  scene_breakdown?: StorySceneLike[];
  gears_segments?: GearsSegmentLike[];
  characters?: StoryCharacterLike[];
};

interface GearsCharacterAssetLite {
  name: string;
  role_position: GearsCharacterRolePosition;
  species_type: '人类';
  ethnicity: ['东亚'];
  gender: GearsGender;
  age_range: GearsAgeRange;
  appearance_features: string;
  clothing: string;
  carried_props?: string;
  signature_objects?: string;
  background_oneliner?: string;
}

interface GearsCharacterGenderSummaryLite {
  total: number;
  male: number;
  female: number;
  other: number;
  unspecified: number;
  not_applicable: number;
}

interface GearsSceneAssetLite {
  name: string;
  scene_type: GearsSceneType;
  description: string;
  environment_props?: string;
  atmosphere: GearsSceneAtmosphere;
}

interface GearsDeliveryUnitLite {
  unit_id: string;
  source_scene_id: number;
  scene_name: string;
  character_names: string[];
  suggested_duration_sec: number;
  suggested_panel_count: PanelCount;
  time_of_day?: GearsTimeOfDay;
  beat_count: number;
  script_text: string;
}

interface GearsDeliveryPackageLite {
  schema_version: 'gears-delivery/v1';
  storyId: string;
  title: string;
  character_assets: GearsCharacterAssetLite[];
  character_gender_summary: GearsCharacterGenderSummaryLite;
  scene_assets: GearsSceneAssetLite[];
  units: GearsDeliveryUnitLite[];
  validation_notes: string[];
  markdown?: string;
}

export interface GenerateGearsDeliveryInput {
  project_id?: string;
  story_id?: string;
  story_json?: string;
  include_markdown?: boolean;
}

export interface GenerateGearsDeliveryResult {
  source: SourceKind;
  project_id?: string;
  story_id?: string;
  package: GearsDeliveryPackageLite;
  validation_summary: {
    unit_count: number;
    character_asset_count: number;
    scene_asset_count: number;
    issue_count: number;
  };
}

const ALL_VIDEO_TYPES = [
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

const PROMPT_NOISE_WORDS = [
  '质量信号',
  '建议调整',
  '类型匹配',
  '资料显示',
  '来源显示',
  '摘要',
  '生成优先级',
  '具体细节请核实来源',
  '应该',
  '注意',
  'TODO',
];

const VALID_PANEL_COUNTS: PanelCount[] = [4, 6, 8, 9, 10, 12];

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
    video_type: context.current_story.video_type as string ?? context.project.video_type,
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
  const parsed = JSON.parse(storyJson);
  if (!isRecord(parsed)) throw new Error('story_json 必须是 JSON 对象');
  return parsed as StoryLike;
}

async function resolveStory(input: GenerateGearsDeliveryInput): Promise<{ story: StoryLike; source: SourceKind } | null> {
  if (input.project_id?.trim()) {
    const projectId = input.project_id.trim();
    assertSafeId(projectId, '项目 ID');
    const story = await resolveStoryFromProject(projectId);
    return story ? { story, source: 'project_id' } : null;
  }
  if (input.story_id?.trim()) {
    const storyId = input.story_id.trim();
    const story = await resolveStoryById(storyId);
    return story ? { story, source: 'story_id' } : null;
  }
  if (input.story_json?.trim()) return { story: parseStoryJson(input.story_json), source: 'story_json' };
  throw new Error('必须提供 project_id、story_id 或 story_json');
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function scenes(story: StoryLike): StorySceneLike[] {
  return Array.isArray(story.scene_breakdown) ? story.scene_breakdown.filter(isRecord) as StorySceneLike[] : [];
}

function segments(story: StoryLike): GearsSegmentLike[] {
  return Array.isArray(story.gears_segments) ? story.gears_segments.filter(isRecord) as GearsSegmentLike[] : [];
}

function compactStrings(values: Array<string | undefined | null | false>): string[] {
  return values
    .map(value => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function stripPromptNoise(value: string): string {
  let text = value
    .replace(/【文本待补】/g, '')
    .replace(/生成优先级[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/本场景基于[^，。；\n]*(?:，具体细节请核实来源)?/g, '')
    .replace(/来源条目[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/(?:质量|分析|建议)[:：][^。；\n]*/g, '');
  for (const word of PROMPT_NOISE_WORDS) {
    text = text.replaceAll(word, '');
  }
  return text.replace(/\s+/g, ' ').trim();
}

function hasPromptNoise(value: string): boolean {
  return PROMPT_NOISE_WORDS.some(word => value.includes(word)) || /(?:质量|分析|建议)[:：]/.test(value);
}

function cleanScript(value: string): string {
  return stripPromptNoise(value) || '【脚本文本待补】';
}

function sceneText(scene: StorySceneLike): string {
  return compactStrings([
    scene.title,
    scene.location,
    scene.plot,
    scene.key_action,
    scene.dialogue_or_narration,
    scene.visual_prompt,
    scene.camera_suggestion,
    scene.cultural_note,
    scene.factual_basis,
    ...(scene.fictionalized_elements ?? []),
  ]).join(' ');
}

function storyContext(story: StoryLike): string {
  return compactStrings([
    story.title,
    story.logline,
    story.theme,
    story.source_entry,
    story.credibility_note,
    ...scenes(story).map(sceneText),
  ]).join(' ');
}

function inferGender(name: string): GearsGender {
  if (['少女', '姑娘', '女子', '母亲', '郑氏', '阿婆'].some(word => name.includes(word))) return '女';
  if (['少年', '书童', '先生', '父亲', '县令', '周敦颐', '毛泽东'].some(word => name.includes(word))) return '男';
  if (['群体', '百姓', '众人', '村民', '人群'].some(word => name.includes(word))) return '不适用';
  return '未指定';
}

function inferAgeRange(text: string): GearsAgeRange {
  if (text.includes('儿童') || text.includes('孩子')) return '儿童';
  if (text.includes('少年')) return '少年';
  if (text.includes('青年') || text.includes('求学')) return '青年';
  if (text.includes('中年')) return '中年';
  if (text.includes('老年') || text.includes('晚年')) return '老年';
  return '青年';
}

function inferClothing(text: string): string {
  if (/(清末|民初|五四|近代|191\d|192\d|毛泽东|长沙|韶山)/.test(text)) {
    return '清末民初至五四前后中国人物固定服装：朴素学生长衫或短褂布鞋，发式按近代身份处理。';
  }
  if (/(周敦颐|濂溪|宋|北宋|理学)/.test(text)) {
    return '北宋士人或读书人固定服装：素色交领长衫或圆领袍，布履，发式束起。';
  }
  return '符合人物身份与故事时代背景的固定服装，所有单元保持一致。';
}

function inferCarriedProps(text: string): string | undefined {
  const props = ['旧信', '书信', '手稿', '书箱', '书', '竹简', '毛笔', '印章', '伞', '铜铃', '文书', '案卷'];
  const matched = props.filter(item => text.includes(item));
  return matched.length ? uniqueStrings(matched).slice(0, 3).join('、') : undefined;
}

function rolePosition(role: string | undefined, index: number): GearsCharacterRolePosition {
  const text = role ?? '';
  if (index === 0 || ['主角', 'protagonist', 'main'].some(item => text.includes(item))) return '主角';
  if (['反派', 'antagonist'].some(item => text.includes(item))) return '反派';
  if (['群演', 'crowd'].some(item => text.includes(item))) return '群演';
  if (['路人'].some(item => text.includes(item))) return '路人';
  return '配角';
}

function buildCharacterAssets(story: StoryLike): GearsCharacterAssetLite[] {
  const byName = new Map<string, StoryCharacterLike | undefined>();
  for (const character of Array.isArray(story.characters) ? story.characters : []) {
    const name = asString(character?.name).trim();
    if (name) byName.set(name, character);
  }
  for (const scene of scenes(story)) {
    for (const name of scene.characters ?? []) {
      if (name?.trim()) byName.set(name.trim(), byName.get(name.trim()));
    }
  }
  const context = storyContext(story);
  return [...byName.entries()].map(([name, character], index) => {
    const characterSceneText = scenes(story)
      .filter(scene => scene.characters?.includes(name))
      .map(sceneText)
      .join(' ');
    const characterContext = `${character?.description ?? ''} ${character?.arc ?? ''} ${characterSceneText} ${context}`;
    const carriedProps = inferCarriedProps(characterContext);
    return {
      name,
      role_position: rolePosition(character?.role, index),
      species_type: '人类',
      ethnicity: ['东亚'],
      gender: inferGender(name),
      age_range: inferAgeRange(`${name} ${characterContext}`),
      appearance_features: character?.description?.trim() || `${name}的稳定外观需由供稿侧补充，并在所有镜头中保持一致。`,
      clothing: inferClothing(characterContext),
      ...(carriedProps ? { carried_props: carriedProps, signature_objects: carriedProps } : {}),
      ...(character?.arc ? { background_oneliner: character.arc } : {}),
    };
  });
}

function summarizeCharacterGenders(characters: GearsCharacterAssetLite[]): GearsCharacterGenderSummaryLite {
  return characters.reduce<GearsCharacterGenderSummaryLite>((summary, character) => {
    summary.total += 1;
    if (character.gender === '男') summary.male += 1;
    else if (character.gender === '女') summary.female += 1;
    else if (character.gender === '其他') summary.other += 1;
    else if (character.gender === '不适用') summary.not_applicable += 1;
    else summary.unspecified += 1;
    return summary;
  }, { total: 0, male: 0, female: 0, other: 0, unspecified: 0, not_applicable: 0 });
}

function inferSceneType(text: string): GearsSceneType {
  if (/(梦境|幻象|意识|虚构)/.test(text)) return '虚构空间';
  if (/(室内|厅|房|屋|堂|殿|馆|书院|教室)/.test(text)) return '室内';
  if (/(室外|山|水|江|河|路|街|门外|庭院|溪|桥)/.test(text)) return '室外';
  return '不限';
}

function inferAtmosphere(text: string): GearsSceneAtmosphere {
  if (/(紧张|压迫|对峙|逼迫|冲突|危机)/.test(text)) return '紧张';
  if (/(压抑|阴暗|沉重|哭声)/.test(text)) return '压抑';
  if (/(温暖|温馨|柔和|希望)/.test(text)) return '温馨';
  if (/(神秘|迷雾|梦境|未知)/.test(text)) return '神秘';
  if (/(明亮|清晨|阳光|天亮)/.test(text)) return '明亮';
  return '中性';
}

function inferEnvironmentProps(text: string): string | undefined {
  const props = ['案几', '文书', '案卷', '灯笼', '烛火', '雨', '门', '书箱', '碑刻', '溪水', '莲'];
  const matched = props.filter(item => text.includes(item));
  return matched.length ? uniqueStrings(matched).slice(0, 5).join('、') : undefined;
}

function buildSceneAssets(story: StoryLike): GearsSceneAssetLite[] {
  const byName = new Map<string, StorySceneLike[]>();
  for (const scene of scenes(story)) {
    const name = asString(scene.location || scene.title || `场景${scene.scene_id ?? byName.size + 1}`).trim();
    byName.set(name, [...(byName.get(name) ?? []), scene]);
  }
  return [...byName.entries()].map(([name, relatedScenes]) => {
    const description = stripPromptNoise(compactStrings(relatedScenes.flatMap(scene => [
      scene.location,
      scene.visual_prompt,
      scene.plot,
      scene.cultural_note,
      scene.factual_basis,
    ])).join('，'));
    const text = `${name} ${description}`;
    return {
      name,
      scene_type: inferSceneType(text),
      description: description || `${name}的空间结构、材质、主要陈设和环境氛围需由供稿侧补充。`,
      ...(inferEnvironmentProps(text) ? { environment_props: inferEnvironmentProps(text) } : {}),
      atmosphere: inferAtmosphere(text),
    };
  });
}

function nearestPanelCount(value: number): PanelCount {
  return VALID_PANEL_COUNTS.reduce((best, item) =>
    Math.abs(item - value) < Math.abs(best - value) ? item : best,
  VALID_PANEL_COUNTS[1]);
}

function clampDuration(value: number): number {
  return Math.max(4, Math.min(90, Math.round(value || 8)));
}

function mapTimeOfDay(value: string | undefined): GearsTimeOfDay | undefined {
  const text = value ?? '';
  if (/(早|晨|清晨)/.test(text)) return '早';
  if (/(午|白天|日间)/.test(text)) return '午';
  if (/(夕|傍晚|黄昏)/.test(text)) return '夕';
  if (/(夜|晚上|雨夜)/.test(text)) return '夜';
  return undefined;
}

function countBeats(text: string): number {
  const punctuation = (text.match(/[，。；;、]/g) ?? []).length;
  return Math.max(1, Math.min(6, Math.round(punctuation / 2) + 1));
}

function buildDeliveryUnits(story: StoryLike): GearsDeliveryUnitLite[] {
  const storyScenes = scenes(story);
  const segmentBySceneId = new Map(segments(story).map(segment => [segment.source_scene_id, segment]));
  return storyScenes.map((scene, index) => {
    const sceneId = asNumber(scene.scene_id, index + 1);
    const segment = segmentBySceneId.get(sceneId);
    const scriptText = cleanScript(
      segment?.script_text
      || scene.dialogue_or_narration
      || scene.key_action
      || scene.plot
      || scene.title
      || `场景 ${sceneId}`,
    );
    return {
      unit_id: segment?.segment_id ? String(segment.segment_id) : `unit-${sceneId}`,
      source_scene_id: sceneId,
      scene_name: asString(scene.title || scene.location || `场景 ${sceneId}`),
      character_names: uniqueStrings(scene.characters ?? []),
      suggested_duration_sec: clampDuration(asNumber(segment?.duration_sec, asNumber(scene.duration_sec, 8))),
      suggested_panel_count: nearestPanelCount(asNumber(segment?.panel_count, Math.ceil(clampDuration(asNumber(scene.duration_sec, 8)) / 2))),
      ...(mapTimeOfDay(scene.time_of_day) ? { time_of_day: mapTimeOfDay(scene.time_of_day) } : {}),
      beat_count: countBeats(scriptText),
      script_text: scriptText,
    };
  });
}

function validateDeliveryPackage(input: {
  story: StoryLike;
  characterAssets: GearsCharacterAssetLite[];
  sceneAssets: GearsSceneAssetLite[];
  units: GearsDeliveryUnitLite[];
}): string[] {
  const notes: string[] = [];
  if (!input.units.length) notes.push('GEARS 缺少可交付单元：scene_breakdown 为空。');
  if (!input.characterAssets.length) notes.push('GEARS 缺少人物资产。');
  if (!input.sceneAssets.length) notes.push('GEARS 缺少场景资产。');

  const storyScenes = scenes(input.story);
  for (const unit of input.units) {
    if (!unit.script_text || unit.script_text.includes('【脚本文本待补】')) notes.push(`${unit.unit_id} 缺少可交付 script_text。`);
    if (!unit.character_names.length) notes.push(`${unit.unit_id} 缺少人物锚点。`);
    if (!unit.scene_name.trim()) notes.push(`${unit.unit_id} 缺少场景焦点。`);
  }
  for (const scene of storyScenes) {
    const sceneId = scene.scene_id ?? '?';
    if (hasPromptNoise(asString(scene.visual_prompt)) || hasPromptNoise(asString(scene.camera_suggestion))) {
      notes.push(`scene-${sceneId} visual/camera prompt 含内部说明，已在交付描述中清理。`);
    }
    if (!asString(scene.factual_basis).trim() && !asString(scene.cultural_note).trim()) {
      notes.push(`scene-${sceneId} 缺少文化或事实边界说明。`);
    }
  }
  for (const segment of segments(input.story)) {
    if (hasPromptNoise(asString(segment.segment_prompt_hint))) {
      notes.push(`segment-${segment.segment_id ?? segment.source_scene_id ?? '?'} segment_prompt_hint 含内部说明，需清理后交付。`);
    }
  }
  return uniqueStrings(notes);
}

function renderMarkdown(pkg: Omit<GearsDeliveryPackageLite, 'markdown'>): string {
  const lines = [
    `# ${pkg.title} — GEARS 交付包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> storyId: ${pkg.storyId}`,
    `> 单元: ${pkg.units.length}`,
    `> 人物资产: ${pkg.character_assets.length}`,
    `> 场景资产: ${pkg.scene_assets.length}`,
    '',
    '## 人物资产',
    ...(pkg.character_assets.length
      ? pkg.character_assets.map(asset => `- ${asset.name}（${asset.role_position}）：${asset.appearance_features}；服装：${asset.clothing}`)
      : ['- 无']),
    '',
    '## 场景资产',
    ...(pkg.scene_assets.length
      ? pkg.scene_assets.map(asset => `- ${asset.name}（${asset.scene_type}/${asset.atmosphere}）：${asset.description}`)
      : ['- 无']),
    '',
    '## 交付单元',
  ];
  for (const unit of pkg.units) {
    lines.push(
      '',
      `### ${unit.unit_id} / 场景 ${unit.source_scene_id}`,
      `- 场景: ${unit.scene_name}`,
      `- 人物: ${unit.character_names.join('、') || '未指定'}`,
      `- 时长: ${unit.suggested_duration_sec} 秒`,
      `- 分格: ${unit.suggested_panel_count}`,
      `- 节拍: ${unit.beat_count}`,
      '',
      unit.script_text,
    );
  }
  if (pkg.validation_notes.length) {
    lines.push('', '## 校验提醒', ...pkg.validation_notes.map(note => `- ${note}`));
  }
  return lines.join('\n');
}

function buildGearsDeliveryPackage(story: StoryLike, includeMarkdown: boolean): GearsDeliveryPackageLite {
  const characterAssets = buildCharacterAssets(story);
  const sceneAssets = buildSceneAssets(story);
  const units = buildDeliveryUnits(story);
  const pkgWithoutMarkdown: Omit<GearsDeliveryPackageLite, 'markdown'> = {
    schema_version: 'gears-delivery/v1',
    storyId: asString(story.storyId) || asString(story.story_id) || 'unknown-story',
    title: asString(story.title) || '未命名故事',
    character_assets: characterAssets,
    character_gender_summary: summarizeCharacterGenders(characterAssets),
    scene_assets: sceneAssets,
    units,
    validation_notes: validateDeliveryPackage({ story, characterAssets, sceneAssets, units }),
  };
  return includeMarkdown
    ? { ...pkgWithoutMarkdown, markdown: renderMarkdown(pkgWithoutMarkdown) }
    : pkgWithoutMarkdown;
}

export async function generateGearsDelivery(input: GenerateGearsDeliveryInput): Promise<GenerateGearsDeliveryResult | null> {
  const resolved = await resolveStory(input);
  if (!resolved) return null;

  const pkg = buildGearsDeliveryPackage(resolved.story, input.include_markdown ?? true);
  return {
    source: resolved.source,
    project_id: resolved.story.project_id ?? input.project_id,
    story_id: pkg.storyId,
    package: pkg,
    validation_summary: {
      unit_count: pkg.units.length,
      character_asset_count: pkg.character_assets.length,
      scene_asset_count: pkg.scene_assets.length,
      issue_count: pkg.validation_notes.length,
    },
  };
}
