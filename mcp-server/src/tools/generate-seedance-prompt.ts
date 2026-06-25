import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import { getProjectContext } from './get-project-context.js';

type SourceKind = 'project_id' | 'story_id' | 'story_json';
type SeedanceAssetModality = 'image' | 'video' | 'audio';
type SeedanceAssetReferenceKind = 'character' | 'location' | 'prop' | 'camera' | 'audio';
type SeedanceAssetSlotRole =
  | 'character_reference'
  | 'location_reference'
  | 'prop_reference'
  | 'camera_reference'
  | 'music_reference'
  | 'sound_reference';
type SeedanceDurationRisk = 'ok' | 'dense' | 'overloaded';

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
  source_entries?: string[];
  factual_basis?: string;
  fictionalized_elements?: string[];
}

interface GearsSegmentLike {
  segment_id?: number;
  source_scene_id?: number;
  duration_sec?: number;
  panel_count?: number;
  script_text?: string;
  segment_prompt_hint?: string;
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

interface SeedanceAssetReferenceLite {
  asset_id: string;
  kind: SeedanceAssetReferenceKind;
  label: string;
  modality: SeedanceAssetModality;
  reference_slot: string;
  role: SeedanceAssetSlotRole;
  description: string;
  source_scene_ids: number[];
  source_shot_ids: string[];
  required: boolean;
}

interface SeedanceShotAssetSlotLite {
  asset_id: string;
  label: string;
  kind: SeedanceAssetReferenceKind;
  modality: SeedanceAssetModality;
  reference_slot: string;
  role: SeedanceAssetSlotRole;
  required: boolean;
  prompt_usage: string;
}

interface SeedanceShotMaterialValidationLite {
  total_file_count: number;
  image_count: number;
  video_count: number;
  audio_count: number;
  max_total_files: number;
  max_image_files: number;
  max_video_files: number;
  max_audio_files: number;
  missing_required_slots: string[];
  prompt_complexity_score: number;
  duration_sec: number;
  duration_risk: SeedanceDurationRisk;
  warnings: string[];
}

interface SeedancePackageMaterialValidationLite {
  total_file_count: number;
  image_count: number;
  video_count: number;
  audio_count: number;
  max_total_files: number;
  max_image_files: number;
  max_video_files: number;
  max_audio_files: number;
  over_limit: boolean;
  warnings: string[];
}

interface SeedancePromptShotUnitLite {
  shot_id: string;
  source_scene_id: number;
  source_unit_id?: string;
  duration_sec: number;
  characters: string[];
  location: string;
  script_text: string;
  visual_prompt: string;
  camera_suggestion: string;
  continuity_notes: string[];
  negative_constraints: string[];
  asset_slots: SeedanceShotAssetSlotLite[];
  material_validation: SeedanceShotMaterialValidationLite;
  seedance_prompt: string;
}

interface SeedancePromptPackageLite {
  schema_version: 'seedance-prompt-package/v1';
  storyId: string;
  title: string;
  target_platform: 'seedance_2_0';
  prompt_language: 'zh';
  total_duration_sec: number;
  asset_reference_plan: string[];
  asset_references: SeedanceAssetReferenceLite[];
  material_validation: SeedancePackageMaterialValidationLite;
  shot_units: SeedancePromptShotUnitLite[];
  validation_notes: string[];
  markdown?: string;
}

type SeedanceImageReferenceSeedLite = {
  kind: 'character' | 'location' | 'prop';
  label: string;
  role: 'character_reference' | 'location_reference' | 'prop_reference';
  description: string;
  source_scene_ids: number[];
  required: boolean;
  priority: number;
};

export interface GenerateSeedancePromptInput {
  project_id?: string;
  story_id?: string;
  story_json?: string;
  include_markdown?: boolean;
}

export interface GenerateSeedancePromptResult {
  source: SourceKind;
  project_id?: string;
  story_id?: string;
  package: SeedancePromptPackageLite;
  validation_summary: {
    shot_count: number;
    asset_reference_count: number;
    issue_count: number;
    over_limit: boolean;
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

const SEEDANCE_LIMITS = {
  maxTotalFiles: 12,
  maxImageFiles: 9,
  maxVideoFiles: 3,
  maxAudioFiles: 3,
};

const PROMPT_NOISE_WORDS = [
  '质量信号',
  '建议调整',
  '类型匹配',
  '资料显示',
  '来源显示',
  '摘要',
  '核心画面是',
  '为什么必须面对',
  '生成优先级',
  '具体细节请核实来源',
  '质量报告',
  '来源说明',
  '内部字段名',
  '来源条目',
  '史实依据',
  '影视化创作',
  '史实边界',
  '知识库',
  '用户大纲',
  '确证史实',
  '确证史源',
  '应该',
  '注意',
  'TODO',
];

const PROP_CANDIDATES = ['案卷', '文书', '判词', '毛笔', '书信', '旧信', '印章', '石碑', '莲', '灯', '伞', '铜铃', '香炉'];
const CAMERA_REFERENCE_KEYWORDS = ['@视频', '参考视频', '视频参考', '运镜参考', '镜头参考', '节奏参考', '动作参考'];
const AUDIO_REFERENCE_KEYWORDS = ['@音频', '参考音频', '音频参考', '音乐参考', '音效参考', '配乐参考', '声音参考', '环境声参考'];

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

async function resolveStory(input: GenerateSeedancePromptInput): Promise<{ story: StoryLike; source: SourceKind } | null> {
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

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function stripPromptNoise(value: string): string {
  let text = value
    .replace(/【文本待补】/g, '')
    .replace(/生成优先级[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/本场景基于[^，。；\n]*(?:，具体细节请核实来源)?/g, '')
    .replace(/来源条目[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/来源显示[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/史实依据[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/影视化创作[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/(?:质量|分析|建议)[:：][^。；\n]*/g, '');
  for (const word of PROMPT_NOISE_WORDS) {
    text = text.replaceAll(word, '');
  }
  return text
    .replace(/[；;]\s*/g, '，')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPrompt(value: string): string {
  const cleaned = stripPromptNoise(value)
    .replace(/^[:：,，；;\s]+/g, '')
    .replace(/[，,]\s*[，,]+/g, '，')
    .replace(/[，,]\s*$/g, '')
    .trim();
  return cleaned || '人物处于明确空间中，动作和表情清楚，光线自然。';
}

function cleanScript(value: string): string {
  return stripPromptNoise(value) || '【脚本文本待补】';
}

function hasPromptNoise(value: string): boolean {
  return PROMPT_NOISE_WORDS.some(word => value.includes(word))
    || /(?:质量|分析|建议|来源显示|来源条目|史实依据|影视化创作)[:：]/.test(value);
}

function includesAny(value: string, keywords: string[]): boolean {
  return keywords.some(keyword => value.includes(keyword));
}

function slugify(value: string): string {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii.slice(0, 80);
  return encodeURIComponent(value.trim()).replace(/%/g, '').slice(0, 80) || 'asset';
}

function seedanceAssetId(kind: SeedanceAssetReferenceKind, label: string): string {
  return `seedance-asset-${kind}-${slugify(label)}`;
}

function clampDuration(value: number): number {
  return Math.max(4, Math.min(15, Math.round(value || 8)));
}

function inferClothing(text: string): string {
  if (/(清末|民初|五四|近代|191\d|192\d|毛泽东|长沙|韶山)/.test(text)) {
    return '清末民初至五四前后中国人物固定服装，发式按近代身份处理。';
  }
  if (/(周敦颐|濂溪|宋|北宋|理学)/.test(text)) {
    return '北宋士人或读书人固定服装，素色交领长衫或圆领袍，布履，发式束起。';
  }
  return '符合人物身份与故事时代背景的固定服装。';
}

function storyText(story: StoryLike): string {
  return compactStrings([
    story.title,
    story.logline,
    story.theme,
    story.source_entry,
    story.credibility_note,
    ...scenes(story).flatMap(scene => [
      scene.title,
      scene.location,
      scene.plot,
      scene.key_action,
      scene.visual_prompt,
      scene.camera_suggestion,
      scene.dialogue_or_narration,
      scene.cultural_note,
      scene.factual_basis,
      ...(scene.fictionalized_elements ?? []),
    ]),
  ]).join(' ');
}

function charactersForStory(story: StoryLike): Array<{ name: string; description: string; role?: string; source_scene_ids: number[] }> {
  const byName = new Map<string, { description: string; role?: string; source_scene_ids: Set<number> }>();
  for (const character of Array.isArray(story.characters) ? story.characters : []) {
    const name = asString(character?.name).trim();
    if (!name) continue;
    byName.set(name, {
      description: compactStrings([character?.description, character?.arc]).join('；') || `${name}形象参考`,
      role: asString(character?.role),
      source_scene_ids: new Set<number>(),
    });
  }
  for (const scene of scenes(story)) {
    const sceneId = asNumber(scene.scene_id, 0);
    for (const name of scene.characters ?? []) {
      if (!name?.trim()) continue;
      const current = byName.get(name) ?? { description: `${name}形象参考`, source_scene_ids: new Set<number>() };
      if (sceneId) current.source_scene_ids.add(sceneId);
      byName.set(name, current);
    }
  }
  const context = storyText(story);
  return [...byName.entries()].map(([name, value]) => ({
    name,
    description: `${value.description}；服装：${inferClothing(`${name} ${value.description} ${context}`)}`,
    role: value.role,
    source_scene_ids: [...value.source_scene_ids].sort((a, b) => a - b),
  }));
}

function locationsForStory(story: StoryLike): Array<{ label: string; description: string; source_scene_ids: number[]; required: boolean; priority: number }> {
  const byName = new Map<string, { parts: string[]; source_scene_ids: Set<number> }>();
  for (const scene of scenes(story)) {
    const label = asString(scene.location || scene.title || `场景${scene.scene_id ?? byName.size + 1}`).trim();
    const current = byName.get(label) ?? { parts: [], source_scene_ids: new Set<number>() };
    current.parts.push(...compactStrings([scene.visual_prompt, scene.plot, scene.cultural_note, scene.factual_basis]));
    current.source_scene_ids.add(asNumber(scene.scene_id, 0));
    byName.set(label, current);
  }
  return [...byName.entries()].map(([label, value]) => ({
    label,
    description: cleanPrompt(value.parts.join('，')),
    source_scene_ids: [...value.source_scene_ids].filter(Boolean).sort((a, b) => a - b),
    required: true,
    priority: 25 + firstScenePriority([...value.source_scene_ids]),
  }));
}

function propReferences(story: StoryLike): Array<{
  kind: 'prop';
  label: string;
  role: 'prop_reference';
  description: string;
  source_scene_ids: number[];
  required: boolean;
  priority: number;
}> {
  const propMap = new Map<string, Set<number>>();
  for (const scene of scenes(story)) {
    const text = compactStrings([scene.title, scene.plot, scene.key_action, scene.visual_prompt, scene.dialogue_or_narration]).join(' ');
    for (const prop of PROP_CANDIDATES) {
      if (!text.includes(prop)) continue;
      if (!propMap.has(prop)) propMap.set(prop, new Set());
      propMap.get(prop)?.add(asNumber(scene.scene_id, 0));
    }
  }
  return [...propMap.entries()].map(([label, sceneIds]) => ({
    kind: 'prop',
    label,
    role: 'prop_reference',
    description: `${label}作为关键道具外观参考，需在相关镜头中保持造型、材质和位置连续。`,
    source_scene_ids: [...sceneIds].filter(Boolean).sort((a, b) => a - b),
    required: false,
    priority: 80 + firstScenePriority([...sceneIds]),
  }));
}

function cameraReferences(story: StoryLike): Array<{ label: string; description: string; source_scene_ids: number[] }> {
  const sourceSceneIds = scenes(story)
    .filter(scene => includesAny(compactStrings([
      scene.camera_suggestion,
      scene.visual_prompt,
      scene.key_action,
      scene.plot,
      scene.dialogue_or_narration,
    ]).join(' '), CAMERA_REFERENCE_KEYWORDS))
    .map(scene => asNumber(scene.scene_id, 0))
    .filter(Boolean);
  if (!sourceSceneIds.length) return [];
  return [{
    label: '运镜节奏参考',
    description: '参考镜头运动、动作衔接和节奏变化，不替代人物、场景或道具画面资产。',
    source_scene_ids: uniqueNumbers(sourceSceneIds),
  }];
}

function audioReferences(story: StoryLike): Array<{
  label: string;
  role: 'music_reference' | 'sound_reference';
  description: string;
  source_scene_ids: number[];
}> {
  const musicSceneIds: number[] = [];
  const soundSceneIds: number[] = [];
  for (const scene of scenes(story)) {
    const text = compactStrings([
      scene.title,
      scene.plot,
      scene.key_action,
      scene.visual_prompt,
      scene.dialogue_or_narration,
      scene.cultural_note,
    ]).join(' ');
    if (!includesAny(text, AUDIO_REFERENCE_KEYWORDS)) continue;
    if (/音乐|配乐|BGM|bgm/i.test(text)) musicSceneIds.push(asNumber(scene.scene_id, 0));
    else soundSceneIds.push(asNumber(scene.scene_id, 0));
  }
  return [
    musicSceneIds.length
      ? {
        label: '背景音乐参考',
        role: 'music_reference' as const,
        description: '参考背景音乐的情绪、节奏和强弱变化，不替代可见画面描述。',
        source_scene_ids: uniqueNumbers(musicSceneIds.filter(Boolean)),
      }
      : undefined,
    soundSceneIds.length
      ? {
        label: '环境音效参考',
        role: 'sound_reference' as const,
        description: '参考环境声、动作音效和空间声场，不替代对白或旁白内容。',
        source_scene_ids: uniqueNumbers(soundSceneIds.filter(Boolean)),
      }
      : undefined,
  ].filter((item): item is {
    label: string;
    role: 'music_reference' | 'sound_reference';
    description: string;
    source_scene_ids: number[];
  } => Boolean(item));
}

function buildAssetReferences(story: StoryLike): SeedanceAssetReferenceLite[] {
  const planned: SeedanceImageReferenceSeedLite[] = [
    ...charactersForStory(story).map((character, index) => {
      const required = isPrimaryCharacterRole(character.role) || index === 0 || character.source_scene_ids.length > 1;
      return {
      kind: 'character' as const,
      label: character.name,
      role: 'character_reference' as const,
      description: character.description,
      source_scene_ids: character.source_scene_ids,
      required,
      priority: required ? index === 0 || isPrimaryCharacterRole(character.role) ? 10 : 15 + firstScenePriority(character.source_scene_ids) : 60 + firstScenePriority(character.source_scene_ids),
    };
    }),
    ...locationsForStory(story).map(location => ({
      kind: 'location' as const,
      label: location.label,
      role: 'location_reference' as const,
      description: location.description,
      source_scene_ids: location.source_scene_ids,
      required: location.required,
      priority: location.priority,
    })),
    ...propReferences(story),
  ].sort((a, b) => a.priority - b.priority || firstScenePriority(a.source_scene_ids) - firstScenePriority(b.source_scene_ids) || a.label.localeCompare(b.label, 'zh-CN'));
  const imageReferences: SeedanceAssetReferenceLite[] = planned.slice(0, SEEDANCE_LIMITS.maxImageFiles).map((item, index) => ({
    asset_id: seedanceAssetId(item.kind, item.label),
    kind: item.kind,
    label: item.label,
    modality: 'image',
    reference_slot: `@图片${index + 1}`,
    role: item.role,
    description: item.description,
    source_scene_ids: uniqueNumbers(item.source_scene_ids),
    source_shot_ids: uniqueNumbers(item.source_scene_ids).map(sceneId => `shot-${sceneId}`),
    required: item.required,
  }));
  const videoReferences: SeedanceAssetReferenceLite[] = cameraReferences(story).slice(0, SEEDANCE_LIMITS.maxVideoFiles).map((item, index) => ({
    asset_id: seedanceAssetId('camera', item.label),
    kind: 'camera',
    label: item.label,
    modality: 'video',
    reference_slot: `@视频${index + 1}`,
    role: 'camera_reference',
    description: item.description,
    source_scene_ids: item.source_scene_ids,
    source_shot_ids: item.source_scene_ids.map(sceneId => `shot-${sceneId}`),
    required: false,
  }));
  const soundReferences: SeedanceAssetReferenceLite[] = audioReferences(story).slice(0, SEEDANCE_LIMITS.maxAudioFiles).map((item, index) => ({
    asset_id: seedanceAssetId('audio', item.label),
    kind: 'audio',
    label: item.label,
    modality: 'audio',
    reference_slot: `@音频${index + 1}`,
    role: item.role,
    description: item.description,
    source_scene_ids: item.source_scene_ids,
    source_shot_ids: item.source_scene_ids.map(sceneId => `shot-${sceneId}`),
    required: false,
  }));
  return [...imageReferences, ...videoReferences, ...soundReferences];
}

function isPrimaryCharacterRole(role: string | undefined): boolean {
  return Boolean(role && /主角|protagonist|main/i.test(role));
}

function firstScenePriority(sceneIds: number[]): number {
  return sceneIds.length ? Math.min(...sceneIds) : 99;
}

function normalizeLocationName(value: string): string {
  return value.replace(/[，,。；;\s]/g, '').trim();
}

function locationMatches(value: string, location: string): boolean {
  const a = normalizeLocationName(value);
  const b = normalizeLocationName(location);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function formatAssetReferencePlanItem(reference: SeedanceAssetReferenceLite): string {
  if (reference.kind === 'character') return `${reference.reference_slot} 可作为人物「${reference.label}」形象参考：${reference.description}`;
  if (reference.kind === 'location') return `${reference.reference_slot} 可作为场景「${reference.label}」氛围参考：${reference.description}`;
  if (reference.kind === 'prop') return `${reference.reference_slot} 可作为道具「${reference.label}」外观参考：${reference.description}`;
  if (reference.kind === 'camera') return `${reference.reference_slot} 可作为运镜和节奏参考：${reference.description}`;
  return `${reference.reference_slot} 可作为背景音乐或音效参考：${reference.description}`;
}

function seedanceSlotUsage(reference: SeedanceAssetReferenceLite): string {
  if (reference.kind === 'character') return `${reference.reference_slot} 作为人物「${reference.label}」形象参考`;
  if (reference.kind === 'location') return `${reference.reference_slot} 作为场景「${reference.label}」氛围参考`;
  if (reference.kind === 'prop') return `${reference.reference_slot} 作为道具「${reference.label}」外观参考`;
  if (reference.kind === 'camera') return `${reference.reference_slot} 作为运镜和节奏参考`;
  return `${reference.reference_slot} 作为音乐或音效参考`;
}

function buildShotAssetSlots(input: {
  references: SeedanceAssetReferenceLite[];
  shotId: string;
  sourceSceneId: number;
  characters: string[];
  location: string;
  text: string;
}): SeedanceShotAssetSlotLite[] {
  return input.references
    .filter(reference => {
      if (reference.kind === 'character') return input.characters.includes(reference.label);
      if (reference.kind === 'location') {
        return locationMatches(reference.label, input.location)
          || reference.source_scene_ids.includes(input.sourceSceneId);
      }
      if (reference.kind === 'prop') return reference.source_scene_ids.includes(input.sourceSceneId) || input.text.includes(reference.label);
      return reference.source_scene_ids.includes(input.sourceSceneId) || reference.source_shot_ids.includes(input.shotId);
    })
    .map(reference => ({
      asset_id: reference.asset_id,
      label: reference.label,
      kind: reference.kind,
      modality: reference.modality,
      reference_slot: reference.reference_slot,
      role: reference.role,
      required: reference.required,
      prompt_usage: seedanceSlotUsage(reference),
    }));
}

function validateAssetReferenceSlots(
  slots: Array<Pick<SeedanceAssetReferenceLite, 'kind' | 'modality' | 'reference_slot' | 'role' | 'label'>>,
): string[] {
  return slots.flatMap(slot => {
    const warnings: string[] = [];
    if (slot.modality === 'image' && !slot.reference_slot.startsWith('@图片')) warnings.push(`${slot.label} 图片素材引用槽位应使用 @图片 前缀`);
    if (slot.modality === 'video') {
      if (!slot.reference_slot.startsWith('@视频')) warnings.push(`${slot.label} 视频素材引用槽位应使用 @视频 前缀`);
      if (slot.kind !== 'camera' || slot.role !== 'camera_reference') warnings.push(`${slot.label} 视频素材需标注为运镜/节奏参考`);
    }
    if (slot.modality === 'audio') {
      if (!slot.reference_slot.startsWith('@音频')) warnings.push(`${slot.label} 音频素材引用槽位应使用 @音频 前缀`);
      if (slot.kind !== 'audio' || !['music_reference', 'sound_reference'].includes(slot.role)) warnings.push(`${slot.label} 音频素材需标注为音乐或音效参考`);
    }
    return warnings;
  });
}

function estimatePromptComplexity(text: string, slotCount: number): number {
  const timeMarkerCount = (text.match(/\d+[-—~至到]\d+秒/g) ?? []).length;
  const punctuationBeats = (text.match(/[，。；;、]/g) ?? []).length;
  const actionHints = (text.match(/镜头|动作|表情|道具|转折|冲突|对峙|特写|推|拉|摇|跟随/g) ?? []).length;
  return Math.min(100, Math.round(
    slotCount * 10
    + Math.min(35, text.length / 18)
    + Math.min(25, punctuationBeats * 2)
    + Math.min(20, actionHints * 2)
    + timeMarkerCount * 4,
  ));
}

function durationRiskForPrompt(durationSec: number, complexityScore: number): SeedanceDurationRisk {
  if (durationSec >= 12) {
    if (complexityScore >= 96) return 'overloaded';
    if (complexityScore >= 82) return 'dense';
    return 'ok';
  }
  if (durationSec >= 9) {
    if (complexityScore >= 92) return 'overloaded';
    if (complexityScore >= 78) return 'dense';
    return 'ok';
  }
  if (durationSec <= 5 && complexityScore >= 60) return 'overloaded';
  if (durationSec <= 8 && complexityScore >= 76) return 'overloaded';
  if (complexityScore >= 88) return 'overloaded';
  if (durationSec <= 8 && complexityScore >= 58) return 'dense';
  if (complexityScore >= 72) return 'dense';
  return 'ok';
}

function buildPackageMaterialValidation(references: SeedanceAssetReferenceLite[]): SeedancePackageMaterialValidationLite {
  const imageCount = references.filter(reference => reference.modality === 'image').length;
  const videoCount = references.filter(reference => reference.modality === 'video').length;
  const audioCount = references.filter(reference => reference.modality === 'audio').length;
  const totalFileCount = imageCount + videoCount + audioCount;
  const warnings = [
    totalFileCount > SEEDANCE_LIMITS.maxTotalFiles ? `素材总数 ${totalFileCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxTotalFiles}` : '',
    imageCount > SEEDANCE_LIMITS.maxImageFiles ? `图片素材 ${imageCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxImageFiles}` : '',
    videoCount > SEEDANCE_LIMITS.maxVideoFiles ? `视频素材 ${videoCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxVideoFiles}` : '',
    audioCount > SEEDANCE_LIMITS.maxAudioFiles ? `音频素材 ${audioCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxAudioFiles}` : '',
    ...validateAssetReferenceSlots(references),
  ].filter(Boolean);
  return {
    total_file_count: totalFileCount,
    image_count: imageCount,
    video_count: videoCount,
    audio_count: audioCount,
    max_total_files: SEEDANCE_LIMITS.maxTotalFiles,
    max_image_files: SEEDANCE_LIMITS.maxImageFiles,
    max_video_files: SEEDANCE_LIMITS.maxVideoFiles,
    max_audio_files: SEEDANCE_LIMITS.maxAudioFiles,
    over_limit: warnings.length > 0,
    warnings,
  };
}

function buildShotMaterialValidation(input: {
  durationSec: number;
  characters: string[];
  location: string;
  text: string;
  assetSlots: SeedanceShotAssetSlotLite[];
}): SeedanceShotMaterialValidationLite {
  const imageCount = input.assetSlots.filter(slot => slot.modality === 'image').length;
  const videoCount = input.assetSlots.filter(slot => slot.modality === 'video').length;
  const audioCount = input.assetSlots.filter(slot => slot.modality === 'audio').length;
  const totalFileCount = imageCount + videoCount + audioCount;
  const promptComplexityScore = estimatePromptComplexity(input.text, input.assetSlots.length);
  const durationRisk = durationRiskForPrompt(input.durationSec, promptComplexityScore);
  const hasCharacterAnchor = input.characters.length === 0 || input.assetSlots.some(slot => slot.kind === 'character');
  const hasLocationAnchor = !input.location.trim()
    || input.assetSlots.some(slot => slot.kind === 'location' && locationMatches(slot.label, input.location));
  const missingRequiredSlots = [
    hasCharacterAnchor ? '' : `character:${input.characters[0] ?? '主要人物'}`,
    hasLocationAnchor ? '' : `location:${input.location}`,
  ].filter(Boolean);
  const warnings = [
    totalFileCount > SEEDANCE_LIMITS.maxTotalFiles ? `素材总数 ${totalFileCount} 超过单条提示可控范围 ${SEEDANCE_LIMITS.maxTotalFiles}` : '',
    imageCount > SEEDANCE_LIMITS.maxImageFiles ? `图片素材 ${imageCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxImageFiles}` : '',
    videoCount > SEEDANCE_LIMITS.maxVideoFiles ? `视频素材 ${videoCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxVideoFiles}` : '',
    audioCount > SEEDANCE_LIMITS.maxAudioFiles ? `音频素材 ${audioCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxAudioFiles}` : '',
    ...validateAssetReferenceSlots(input.assetSlots),
    missingRequiredSlots.length ? `缺少必需素材引用槽位：${missingRequiredSlots.join('、')}` : '',
    durationRisk === 'overloaded' ? `提示复杂度 ${promptComplexityScore}/100 对 ${input.durationSec} 秒时长过载` : '',
    durationRisk === 'dense' ? `提示复杂度 ${promptComplexityScore}/100 偏高，建议拆分动作或延长时长` : '',
    /真人|写实人脸|真实人物|照片/.test(input.text) ? '存在写实真人脸素材风险，避免上传可识别真人脸参考' : '',
  ].filter(Boolean);
  return {
    total_file_count: totalFileCount,
    image_count: imageCount,
    video_count: videoCount,
    audio_count: audioCount,
    max_total_files: SEEDANCE_LIMITS.maxTotalFiles,
    max_image_files: SEEDANCE_LIMITS.maxImageFiles,
    max_video_files: SEEDANCE_LIMITS.maxVideoFiles,
    max_audio_files: SEEDANCE_LIMITS.maxAudioFiles,
    missing_required_slots: missingRequiredSlots,
    prompt_complexity_score: promptComplexityScore,
    duration_sec: input.durationSec,
    duration_risk: durationRisk,
    warnings,
  };
}

function buildNegativeConstraints(scene: StorySceneLike | undefined, visualPrompt: string, scriptText: string): string[] {
  return compactStrings([
    '不要出现现代无关物件',
    '只保留可见可听内容',
    hasPromptNoise(visualPrompt) || hasPromptNoise(scriptText) ? '清除不可见说明，只保留动作、表情、道具和声音' : '',
    scene?.cultural_note ? '文化对象、年代服饰和地点氛围保持一致' : '',
  ]).filter((item, index, arr) => arr.indexOf(item) === index);
}

function buildPromptContinuityNotes(scene?: StorySceneLike): string[] {
  if (!scene) return [];
  return compactStrings([
    scene.factual_basis || scene.cultural_note
      ? '年代、地点、服饰和文化对象保持同一语境。'
      : '',
    scene.fictionalized_elements?.length
      ? '新增人物或事件只通过可见动作、道具和空间关系服务本镜头。'
      : '',
    scene.source_entries?.length
      ? '人物名称、地点名称和核心文化物件前后一致。'
      : '',
  ]).filter((item, index, arr) => arr.indexOf(item) === index);
}

function buildShotAssetUsageLine(slots: SeedanceShotAssetSlotLite[]): string {
  if (!slots.length) return '';
  return `素材引用：${slots.map(slot => slot.prompt_usage).join('；')}。`;
}

function buildSeedancePrompt(input: {
  durationSec: number;
  location: string;
  characters: string[];
  scriptText: string;
  visualPrompt: string;
  cameraSuggestion: string;
  continuityNotes: string[];
  negativeConstraints: string[];
  assetSlots: SeedanceShotAssetSlotLite[];
}): string {
  const subject = input.characters.length > 0 ? input.characters.join('、') : '主要人物';
  const midPoint = input.durationSec <= 8 ? Math.max(4, input.durationSec - 2) : 7;
  const endPoint = input.durationSec;
  return [
    `生成 ${input.durationSec} 秒视频。主体：${subject}。场景：${input.location}。`,
    buildShotAssetUsageLine(input.assetSlots),
    `0-3秒：${input.visualPrompt}；${subject}进入画面，完成初始动作；镜头：${input.cameraSuggestion}。`,
    input.durationSec <= 8
      ? `3-${endPoint}秒：${input.scriptText}；突出表情、手部动作和空间关系，结尾留出半秒定格。`
      : `3-${midPoint}秒：${input.scriptText}；冲突或发现推进，镜头跟随人物动作变化。`,
    input.durationSec > 8 ? `${midPoint}-${endPoint}秒：关键情绪或转折落地，收束到可承接的定格画面。` : '',
    input.continuityNotes.length ? `连续性：${input.continuityNotes.join('；')}。` : '',
    '风格：AI漫剧/影视分镜，画面清晰，人物动作可拍，时代与服饰保持一致。',
    '音效/音乐：环境声贴合场景，情绪紧张处轻微增强节奏。',
    input.negativeConstraints.length ? `禁止：${input.negativeConstraints.join('；')}。` : '',
  ].filter(Boolean).join('\n');
}

function buildShotUnit(input: {
  story: StoryLike;
  scene: StorySceneLike;
  index: number;
  assetReferences: SeedanceAssetReferenceLite[];
}): SeedancePromptShotUnitLite {
  const sceneId = asNumber(input.scene.scene_id, input.index + 1);
  const segment = segments(input.story).find(item => item.source_scene_id === sceneId);
  const sourceUnitId = segment?.segment_id ? String(segment.segment_id) : `unit-${sceneId}`;
  const durationSec = clampDuration(asNumber(segment?.duration_sec, asNumber(input.scene.duration_sec, 8)));
  const characters = uniqueStrings(input.scene.characters ?? []);
  const location = asString(input.scene.location || input.scene.title || '未指定场景');
  const scriptText = buildConciseSeedanceScript(input.scene, segment);
  const visualPrompt = cleanPrompt(compactStrings([
    input.scene.visual_prompt,
    location,
    characters.length > 0 ? `人物：${characters.join('、')}` : undefined,
  ]).join('，'));
  const cameraSuggestion = cleanPrompt(input.scene.camera_suggestion || '中景固定镜头，动作清楚');
  const continuityNotes = buildPromptContinuityNotes(input.scene);
  const assetSlots = buildShotAssetSlots({
    references: input.assetReferences,
    shotId: `shot-${sourceUnitId}`,
    sourceSceneId: sceneId,
    characters,
    location,
    text: [scriptText, visualPrompt, cameraSuggestion].join(' '),
  });
  const materialValidation = buildShotMaterialValidation({
    durationSec,
    characters,
    location,
    text: [scriptText, visualPrompt, cameraSuggestion].join(' '),
    assetSlots,
  });
  const negativeConstraints = buildNegativeConstraints(input.scene, visualPrompt, scriptText);
  return {
    shot_id: `shot-${sourceUnitId}`,
    source_scene_id: sceneId,
    source_unit_id: sourceUnitId,
    duration_sec: durationSec,
    characters,
    location,
    script_text: scriptText,
    visual_prompt: visualPrompt,
    camera_suggestion: cameraSuggestion,
    continuity_notes: continuityNotes,
    negative_constraints: negativeConstraints,
    asset_slots: assetSlots,
    material_validation: materialValidation,
    seedance_prompt: buildSeedancePrompt({
      durationSec,
      location,
      characters,
      scriptText,
      visualPrompt,
      cameraSuggestion,
      continuityNotes,
      negativeConstraints,
      assetSlots,
    }),
  };
}

function buildConciseSeedanceScript(scene: StorySceneLike, segment?: GearsSegmentLike): string {
  const actionText = cleanScript(compactStrings([
    scene.key_action,
    conciseDialogue(scene.dialogue_or_narration),
  ]).join(' '));
  return summarizeSeedanceText(actionText || cleanScript(segment?.script_text || scene.plot || scene.title || ''), 120);
}

function conciseDialogue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .split(/[。；;\n]/)
    .map(item => item.trim())
    .find(Boolean);
}

function summarizeSeedanceText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const parts = text
    .split(/[。；;]/)
    .map(part => part.trim())
    .filter(Boolean);
  const summary: string[] = [];
  for (const part of parts) {
    const next = [...summary, part].join('。');
    if (next.length > maxLength) break;
    summary.push(part);
  }
  const compacted = summary.join('。').trim();
  return compacted || `${text.slice(0, maxLength - 1).trim()}…`;
}

function validateShotUnit(unit: SeedancePromptShotUnitLite): string[] {
  return [
    unit.duration_sec < 4 || unit.duration_sec > 15 ? `${unit.shot_id} 时长不在 Seedance 建议范围 4-15 秒` : '',
    !unit.characters.length ? `${unit.shot_id} 缺少人物锚点` : '',
    ...unit.material_validation.warnings.map(warning => `${unit.shot_id} ${warning}`),
    hasPromptNoise(unit.visual_prompt) || hasPromptNoise(unit.seedance_prompt) ? `${unit.shot_id} 提示词可能混入分析/质量说明` : '',
    unit.script_text.includes('【脚本文本待补】') ? `${unit.shot_id} 缺少可生成的脚本文本` : '',
  ].filter(Boolean);
}

function renderSeedanceMarkdown(pkg: Omit<SeedancePromptPackageLite, 'markdown'>): string {
  const lines = [
    `# ${pkg.title} — Seedance 2.0 镜头提示词包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> storyId: ${pkg.storyId}`,
    `> 总时长: ${pkg.total_duration_sec} 秒`,
    `> 素材: ${pkg.material_validation.total_file_count}/${pkg.material_validation.max_total_files} 个文件（图片 ${pkg.material_validation.image_count}/${pkg.material_validation.max_image_files}，视频 ${pkg.material_validation.video_count}/${pkg.material_validation.max_video_files}，音频 ${pkg.material_validation.audio_count}/${pkg.material_validation.max_audio_files}）`,
    '',
    '## 参考素材分配',
    ...(pkg.asset_reference_plan.length ? pkg.asset_reference_plan.map(item => `- ${item}`) : ['- 未配置参考素材；可直接使用文本提示生成。']),
    '',
    '## 镜头提示词',
  ];
  for (const unit of pkg.shot_units) {
    lines.push(
      '',
      `### ${unit.shot_id} / 场景 ${unit.source_scene_id}`,
      `- 时长: ${unit.duration_sec} 秒`,
      `- 人物: ${unit.characters.join('、') || '未指定'}`,
      `- 场景: ${unit.location}`,
      `- 镜头: ${unit.camera_suggestion}`,
      unit.asset_slots.length ? `- 素材 slot: ${unit.asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；')}` : '- 素材 slot: 无',
      unit.material_validation.warnings.length
        ? `- 素材校验: ${unit.material_validation.warnings.join('；')}`
        : `- 素材校验: 通过 · 复杂度 ${unit.material_validation.prompt_complexity_score}/100`,
      '',
      '```text',
      unit.seedance_prompt,
      '```',
    );
  }
  if (pkg.validation_notes.length) lines.push('', '## 校验提醒', ...pkg.validation_notes.map(note => `- ${note}`));
  return lines.join('\n');
}

function buildSeedancePromptPackage(story: StoryLike, includeMarkdown: boolean): SeedancePromptPackageLite {
  const assetReferences = buildAssetReferences(story);
  const shotUnits = scenes(story).map((scene, index) => buildShotUnit({
    story,
    scene,
    index,
    assetReferences,
  }));
  const materialValidation = buildPackageMaterialValidation(assetReferences);
  const pkgWithoutMarkdown: Omit<SeedancePromptPackageLite, 'markdown'> = {
    schema_version: 'seedance-prompt-package/v1',
    storyId: asString(story.storyId) || asString(story.story_id) || 'unknown-story',
    title: asString(story.title) || '未命名故事',
    target_platform: 'seedance_2_0',
    prompt_language: 'zh',
    total_duration_sec: shotUnits.reduce((sum, unit) => sum + unit.duration_sec, 0),
    asset_reference_plan: assetReferences.map(formatAssetReferencePlanItem),
    asset_references: assetReferences,
    material_validation: materialValidation,
    shot_units: shotUnits,
    validation_notes: uniqueStrings([
      ...materialValidation.warnings,
      ...shotUnits.flatMap(validateShotUnit),
    ]),
  };
  return includeMarkdown
    ? { ...pkgWithoutMarkdown, markdown: renderSeedanceMarkdown(pkgWithoutMarkdown) }
    : pkgWithoutMarkdown;
}

export async function generateSeedancePrompt(input: GenerateSeedancePromptInput): Promise<GenerateSeedancePromptResult | null> {
  const resolved = await resolveStory(input);
  if (!resolved) return null;

  const pkg = buildSeedancePromptPackage(resolved.story, input.include_markdown ?? true);
  return {
    source: resolved.source,
    project_id: resolved.story.project_id ?? input.project_id,
    story_id: pkg.storyId,
    package: pkg,
    validation_summary: {
      shot_count: pkg.shot_units.length,
      asset_reference_count: pkg.asset_references.length,
      issue_count: pkg.validation_notes.length,
      over_limit: pkg.material_validation.over_limit,
    },
  };
}
