import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import { getProjectContext } from './get-project-context.js';
import { updateProjectVersion, type UpdateProjectVersionResult } from './update-project-version.js';
import { validateGenreStory, type ValidateGenreStoryResult } from './validate-genre-story.js';

type SourceKind = 'project_id' | 'story_id' | 'story_json';
type RepairPriority = 'P0' | 'P1' | 'P2';
type RepairCategory = 'structure' | 'genre' | 'scene' | 'evidence' | 'delivery';

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

type StoryLike = Record<string, unknown> & {
  storyId?: string;
  project_id?: string;
  title?: string;
  logline?: string;
  theme?: string;
  full_text?: string;
  video_type?: string;
  story_structure?: string;
  scene_breakdown?: StorySceneLike[];
};

export interface RepairStoryInput {
  project_id?: string;
  story_id?: string;
  story_json?: string;
  repaired_story_json?: string;
  user_instruction?: string;
  auto_apply?: boolean;
  include_markdown?: boolean;
  max_actions?: number;
}

export interface RepairTargetScene {
  scene_id: number;
  title?: string;
  reason: string;
  field_hints: string[];
}

export interface RepairDryRunAction {
  action_id: string;
  priority: RepairPriority;
  category: RepairCategory;
  issue: string;
  suggested_change: string;
  target_scene_ids: number[];
  field_hints: string[];
  target_scenes: RepairTargetScene[];
  acceptance_check: string;
}

export interface RepairStoryResult {
  source: SourceKind;
  project_id?: string;
  story_id?: string;
  auto_apply: boolean;
  auto_apply_requested: boolean;
  applied: boolean;
  quality_snapshot: {
    video_type: string;
    story_structure?: string;
    passed: boolean;
    genre_score: number;
    issue_count: number;
  };
  after_quality_snapshot?: {
    video_type: string;
    story_structure?: string;
    passed: boolean;
    genre_score: number;
    issue_count: number;
  };
  update_result?: UpdateProjectVersionResult;
  source_issues: string[];
  repair_actions: RepairDryRunAction[];
  target_scenes: RepairTargetScene[];
  risk_notes: string[];
  markdown?: string;
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
    story_structure: context.current_story.story_structure as string ?? context.project.story_structure,
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
    if (!isRecord(parsed)) throw new Error('story_json 必须是 JSON 对象');
    return parsed as StoryLike;
  } catch (error) {
    if (error instanceof Error && error.message === 'story_json 必须是 JSON 对象') throw error;
    throw new Error(`story_json 不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function resolveStory(input: RepairStoryInput): Promise<{ story: StoryLike; source: SourceKind } | null> {
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

function countTextChars(text: string): number {
  return (text.match(/[\p{Script=Han}A-Za-z0-9]/gu) ?? []).length;
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
  return [...new Set(values.filter(value => Number.isFinite(value)))].sort((a, b) => a - b);
}

function scenes(story: StoryLike): StorySceneLike[] {
  return Array.isArray(story.scene_breakdown) ? story.scene_breakdown.filter(isRecord) as StorySceneLike[] : [];
}

function sceneId(scene: StorySceneLike, index: number): number {
  return typeof scene.scene_id === 'number' && Number.isFinite(scene.scene_id) ? scene.scene_id : index + 1;
}

function sceneText(scene: StorySceneLike): string {
  return compactStrings([
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
  ]).join(' ');
}

function hasAny(text: string, words: string[]): boolean {
  return words.some(word => text.includes(word));
}

function hasDialogueText(text: string): boolean {
  return /[「『“"][^」』”"]{2,}[」』”"]/.test(text)
    || /(对白|旁白|他说|她说|问道|答道|喊道|低声|沉声|：|:)/.test(text);
}

function hasExpressionOrActionText(text: string): boolean {
  return /(表情|皱眉|抬头|转身|握紧|定格|分镜|特写|眼神|沉默|一愣|拔高|冲上|推开|回头)/.test(text);
}

function fieldLabelForMissingRequired(actionText: string): string | null {
  const match = actionText.match(/类型字段缺失[:：]?\s*([A-Za-z_]+)/) ?? actionText.match(/补齐类型字段[:：]\s*([A-Za-z_]+)/);
  return match?.[1] ?? null;
}

function priorityFor(text: string): RepairPriority {
  if (/(缺少核心事件|缺少明确冲突|缺少主角选择|生平流水账|缺少高潮|缺少结尾主题|full_text是生平年表)/.test(text)) {
    return 'P0';
  }
  if (/(AI 漫剧|工艺步骤|史实锚点|核心问题|概念定义|空间路线|类型字段缺失|补齐类型字段|表情动作|追看钩子|对白)/.test(text)) {
    return 'P1';
  }
  return 'P2';
}

function categoryFor(text: string): RepairCategory {
  if (/(史实|依据|史料|边界|factual_basis|fictionalized|来源|可信)/.test(text)) return 'evidence';
  if (/(GEARS|Seedance|交付|镜头|visual_prompt|camera_suggestion)/i.test(text)) return 'delivery';
  if (/(AI 漫剧|非遗|工艺|知识讲解|场景短片|类型字段|节拍|对白|旁白|表情|钩子)/.test(text)) return 'genre';
  if (/(场景|行动|plot|key_action|空间路线|入口|路径)/.test(text)) return 'scene';
  return 'structure';
}

function suggestedChangeFor(text: string): string {
  if (text.includes('AI 漫剧缺少对白') || text.includes('短对白')) {
    return '为目标场景补 1-2 句短对白或强旁白，让冲突从人物嘴里或旁白里直接推进。';
  }
  if (text.includes('表情动作')) {
    return '在目标场景的 plot、key_action 或 visual_prompt 中补表情变化、动作定格和漫画分镜构图。';
  }
  if (text.includes('追看钩子')) {
    return '把最后一场改成疑问、反转或未完成行动，留下继续观看理由。';
  }
  if (text.includes('工艺步骤')) {
    return '按材料、工具、关键工序、手部动作和成品效果补齐可拍流程。';
  }
  if (text.includes('史实锚点')) {
    return '为关键场景补 factual_basis，并把虚构对白、调度或合成画面写入 fictionalized_elements。';
  }
  if (text.includes('生平流水账') || text.includes('核心事件')) {
    return '选定一个高冲突事件重写结构，保留目标、阻力、选择、代价和结尾精神落点。';
  }
  if (text.includes('核心问题')) {
    return '开头增加一个观众能理解的问题，并同步写入 story_blueprint.central_question。';
  }
  if (text.includes('概念定义')) {
    return '补一段概念定义，再接一个具体例子，最后用一句可复述结论收束。';
  }
  if (text.includes('空间路线')) {
    return '按“入口 -> 路径 -> 视觉节点 -> 时间层 -> 氛围收束”重排场景移动。';
  }
  if (text.includes('主角选择')) {
    return '在关键场景写清主角做了什么选择、为什么会有代价，以及选择后局面如何变化。';
  }
  if (text.includes('明确冲突')) {
    return '为前两场补对抗双方、外部压力和不可同时满足的两难。';
  }
  if (text.includes('具体行动描述')) {
    return '把概述句改成可拍行动：人物动作、道具移动、空间位置和可见结果。';
  }
  if (text.includes('缺少高潮')) {
    return '指定一场为高潮/高燃收束，强化正面对抗、最终选择和画面峰值。';
  }
  if (text.includes('结尾主题')) {
    return '在最后一场补精神、价值或传承落点，并让它由画面和行动带出。';
  }
  const missingField = fieldLabelForMissingRequired(text);
  if (missingField) return `补齐故事顶层字段 ${missingField}，让类型承诺能被 UI、校验器和交付工具读取。`;
  if (text.includes('强化节拍')) return '补清该节拍的戏剧功能、人物行动和场景结果，避免只停留在标题。';
  return text.startsWith('处理问题') ? text : `处理问题：${text}`;
}

function acceptanceCheckFor(text: string): string {
  if (text.includes('对白') || text.includes('短对白')) {
    return '重新运行 kb_validate_genre_story，AI 漫剧缺少对白/旁白不再出现；目标场景有 1-2 句短对白或强旁白。';
  }
  if (text.includes('表情动作')) {
    return '目标场景 plot、key_action 或 visual_prompt 能看见表情变化、动作定格或漫画分镜。';
  }
  if (text.includes('追看钩子')) {
    return '最后一场以疑问、反转或未完成行动收束，并且结尾钩子 issue 消失。';
  }
  if (text.includes('史实锚点')) {
    return '关键场景含 factual_basis 或 fictionalized_elements，史实边界 issue 消失。';
  }
  if (text.includes('工艺步骤')) {
    return '故事中至少出现材料、工具、关键工序、手部动作中的三类可拍信息。';
  }
  if (text.includes('核心问题')) {
    return '开场问题在 central_question 或前 20 秒内容中可直接读出。';
  }
  if (text.includes('空间路线')) {
    return '场景 location/plot/camera_suggestion 形成清晰移动路线，空间路线 issue 消失。';
  }
  return '重新运行 kb_validate_genre_story，相关 issue 消失或 genre_score 上升。';
}

function targetScenesFor(
  story: StoryLike,
  actionText: string,
): { target_scenes: RepairTargetScene[]; field_hints: string[] } {
  const storyScenes = scenes(story);
  const fallbackTargets = storyScenes.slice(0, Math.min(3, storyScenes.length));
  const firstScene = storyScenes[0] ? [storyScenes[0]] : [];
  const lastScene = storyScenes.length ? [storyScenes[storyScenes.length - 1]] : [];

  let selected = fallbackTargets;
  let reason = '通用修复建议';
  let fieldHints = ['full_text', 'scene_breakdown'];
  const missingField = fieldLabelForMissingRequired(actionText);

  if (missingField) {
    selected = [];
    reason = `顶层类型字段 ${missingField} 缺失`;
    fieldHints = [missingField];
  } else if (/(对白|短对白|旁白)/.test(actionText)) {
    selected = storyScenes.filter(scene => !hasDialogueText(compactStrings([
      scene.dialogue_or_narration,
      scene.plot,
    ]).join(' ')));
    if (!selected.length) selected = fallbackTargets;
    reason = '缺少可听见的对白/旁白推进';
    fieldHints = ['scene_breakdown[].dialogue_or_narration', 'scene_breakdown[].plot', 'scene_breakdown[].key_action'];
  } else if (/(表情动作|分镜|画面冲击)/.test(actionText)) {
    selected = storyScenes.filter(scene => !hasExpressionOrActionText(sceneText(scene)));
    if (!selected.length) selected = fallbackTargets;
    reason = '表情、动作或漫画分镜不够可见';
    fieldHints = ['scene_breakdown[].visual_prompt', 'scene_breakdown[].plot', 'scene_breakdown[].key_action', 'scene_breakdown[].camera_suggestion'];
  } else if (/(追看钩子|结尾|最后一场)/.test(actionText)) {
    selected = lastScene;
    reason = '结尾缺少继续观看的悬念或反转';
    fieldHints = ['scene_breakdown[-1].plot', 'scene_breakdown[-1].dialogue_or_narration', 'scene_breakdown[-1].dramatic_function'];
  } else if (/(工艺步骤|材料|工具|手部|工序|流程)/.test(actionText)) {
    selected = fallbackTargets;
    reason = '工艺流程缺少可拍的材料、工具或手部动作';
    fieldHints = ['craft_or_ritual_process', 'scene_breakdown[].plot', 'scene_breakdown[].key_action', 'scene_breakdown[].visual_prompt'];
  } else if (/(史实锚点|史实依据|factual_basis|影视化|虚构|边界)/.test(actionText)) {
    selected = storyScenes.filter(scene => !asString(scene.factual_basis).trim() && !(scene.fictionalized_elements?.length));
    if (!selected.length) selected = fallbackTargets;
    reason = '缺少事实依据或创作边界标注';
    fieldHints = ['scene_breakdown[].factual_basis', 'scene_breakdown[].fictionalized_elements', 'scene_breakdown[].cultural_note'];
  } else if (/(核心事件|生平流水账|单事件|年表)/.test(actionText)) {
    selected = storyScenes.slice(0, Math.min(5, storyScenes.length));
    reason = '整体结构需要从人物生平改成单事件叙事';
    fieldHints = ['story_blueprint.central_event', 'story_blueprint.genre_beats', 'full_text', 'scene_breakdown'];
  } else if (/(核心问题|开场问题)/.test(actionText)) {
    selected = firstScene;
    reason = '开场缺少观众可理解的核心问题';
    fieldHints = ['story_blueprint.central_question', 'full_text', 'scene_breakdown[0].plot'];
  } else if (/(概念定义|例子|总结|结论)/.test(actionText)) {
    selected = uniqueScenes([...firstScene, ...lastScene]);
    reason = '讲解结构缺少定义、例子或结论';
    fieldHints = ['knowledge_outline', 'argument_points', 'full_text', 'scene_breakdown'];
  } else if (/(空间路线|入口|路径|视觉节点)/.test(actionText)) {
    selected = storyScenes;
    reason = '镜头空间移动路线不清';
    fieldHints = ['visual_route', 'scene_breakdown[].location', 'scene_breakdown[].plot', 'scene_breakdown[].camera_suggestion'];
  } else if (/(主角选择|价值选择|选择代价)/.test(actionText)) {
    const choiceWords = ['选择', '拒签', '断案', '拒', '辞', '定', '决', '坚持', '承担'];
    selected = storyScenes.filter(scene => !hasAny(`${scene.key_action ?? ''}${scene.plot ?? ''}`, choiceWords));
    if (!selected.length) selected = fallbackTargets;
    reason = '主角选择或选择代价不够明确';
    fieldHints = ['scene_breakdown[].key_action', 'scene_breakdown[].plot', 'scene_breakdown[].conflict'];
  } else if (/(明确冲突|对抗|两难|阻力)/.test(actionText)) {
    const conflictWords = ['拒', '争', '抗', '逼', '选择', '两难', '冲突', '对决', '争辩'];
    selected = storyScenes.filter(scene => !hasAny(`${scene.conflict ?? ''}${scene.plot ?? ''}`, conflictWords));
    if (!selected.length) selected = fallbackTargets;
    reason = '对抗双方、压力或两难不清';
    fieldHints = ['scene_breakdown[].conflict', 'scene_breakdown[].plot', 'scene_breakdown[].key_action'];
  } else if (/(具体行动|可拍行动|场景缺少)/.test(actionText)) {
    selected = storyScenes.filter(scene => countTextChars(scene.plot ?? '') < 20);
    if (!selected.length) selected = fallbackTargets;
    reason = 'plot 还停留在概述，缺少可拍动作';
    fieldHints = ['scene_breakdown[].plot', 'scene_breakdown[].key_action', 'scene_breakdown[].visual_prompt'];
  } else if (/(缺少高潮|高潮|高燃收束)/.test(actionText)) {
    selected = lastScene;
    reason = '缺少戏剧峰值或高燃收束场';
    fieldHints = ['scene_breakdown[-1].dramatic_function', 'scene_breakdown[-1].plot', 'scene_breakdown[-1].key_action'];
  } else if (/强化节拍[:：]\s*(\d+)/.test(actionText) || /类型节拍偏弱[:：]\s*(\d+)/.test(actionText)) {
    const order = Number((actionText.match(/(?:强化节拍|类型节拍偏弱)[:：]\s*(\d+)/) ?? [])[1]);
    const scene = storyScenes[order - 1];
    selected = scene ? [scene] : fallbackTargets;
    reason = `第 ${order} 个类型节拍功能不清`;
    fieldHints = ['story_blueprint.genre_beats', 'scene_breakdown[].dramatic_function', 'scene_breakdown[].plot'];
  }

  const targetScenes = selected.map((scene, index) => ({
    scene_id: sceneId(scene, storyScenes.indexOf(scene) >= 0 ? storyScenes.indexOf(scene) : index),
    title: scene.title,
    reason,
    field_hints: fieldHints,
  }));

  return {
    target_scenes: targetScenes,
    field_hints: uniqueStrings(fieldHints),
  };
}

function uniqueScenes(storyScenes: StorySceneLike[]): StorySceneLike[] {
  const seen = new Set<StorySceneLike>();
  const result: StorySceneLike[] = [];
  for (const scene of storyScenes) {
    if (seen.has(scene)) continue;
    seen.add(scene);
    result.push(scene);
  }
  return result;
}

function normalizeRepairText(text: string): string {
  return text.replace(/\s+/g, '').replace(/[，。；;:：、]/g, '');
}

function isDuplicateAction(actions: RepairDryRunAction[], text: string): boolean {
  const normalized = normalizeRepairText(text);
  return actions.some(action => {
    const issue = normalizeRepairText(action.issue);
    const suggested = normalizeRepairText(action.suggested_change);
    return issue.includes(normalized) || normalized.includes(issue) || suggested.includes(normalized) || normalized.includes(suggested);
  });
}

function buildAction(story: StoryLike, actionId: string, issue: string, suggestedChange?: string): RepairDryRunAction {
  const suggested = suggestedChange ?? suggestedChangeFor(issue);
  const targetPlan = targetScenesFor(story, `${issue} ${suggested}`);
  const targetSceneIds = uniqueNumbers(targetPlan.target_scenes.map(scene => scene.scene_id));
  const actionText = `${issue} ${suggested}`;
  return {
    action_id: actionId,
    priority: priorityFor(actionText),
    category: categoryFor(actionText),
    issue,
    suggested_change: suggested,
    target_scene_ids: targetSceneIds,
    field_hints: targetPlan.field_hints,
    target_scenes: targetPlan.target_scenes,
    acceptance_check: acceptanceCheckFor(actionText),
  };
}

function buildRepairActions(story: StoryLike, validation: ValidateGenreStoryResult, maxActions: number): RepairDryRunAction[] {
  const actions: RepairDryRunAction[] = [];
  for (const issue of validation.issues) {
    actions.push(buildAction(story, `repair-${String(actions.length + 1).padStart(3, '0')}`, issue));
  }

  for (const repairAction of validation.repair_actions) {
    if (isDuplicateAction(actions, repairAction)) continue;
    actions.push(buildAction(
      story,
      `repair-${String(actions.length + 1).padStart(3, '0')}`,
      `补充修复指导：${repairAction}`,
      suggestedChangeFor(repairAction),
    ));
  }

  return actions
    .sort((a, b) => {
      const priorityOrder: Record<RepairPriority, number> = { P0: 0, P1: 1, P2: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.action_id.localeCompare(b.action_id);
    })
    .slice(0, maxActions)
    .map((action, index) => ({
      ...action,
      action_id: `repair-${String(index + 1).padStart(3, '0')}`,
    }));
}

function aggregateTargetScenes(actions: RepairDryRunAction[]): RepairTargetScene[] {
  const byScene = new Map<number, { title?: string; reasons: string[]; field_hints: string[] }>();
  for (const action of actions) {
    for (const target of action.target_scenes) {
      const current = byScene.get(target.scene_id) ?? { title: target.title, reasons: [], field_hints: [] };
      current.title = current.title ?? target.title;
      current.reasons.push(target.reason);
      current.field_hints.push(...target.field_hints);
      byScene.set(target.scene_id, current);
    }
  }
  return [...byScene.entries()].sort(([a], [b]) => a - b).map(([sceneIdValue, value]) => ({
    scene_id: sceneIdValue,
    title: value.title,
    reason: uniqueStrings(value.reasons).join('；'),
    field_hints: uniqueStrings(value.field_hints),
  }));
}

function buildRiskNotes(
  input: RepairStoryInput,
  story: StoryLike,
  validation: ValidateGenreStoryResult,
  applied: boolean,
  autoApplyNotes: string[],
): string[] {
  const notes = [
    applied
      ? 'auto_apply 已通过 kb_update_project_version 写入新项目版本；旧版本未覆盖。'
      : 'dry-run 阶段未修改项目文件、版本快照或故事 JSON。',
  ];
  notes.push(...autoApplyNotes);
  if (!scenes(story).length) {
    notes.push('故事缺少 scene_breakdown，场景级定位只能落到 full_text 或蓝图字段。');
  }
  if (validation.source === 'story_json') {
    notes.push('story_json 输入不会关联项目版本；后续自动应用需要 project_id。');
  }
  if (validation.genre_score < 60) {
    notes.push('genre_score 低于 60，建议先处理 P0/P1，再生成 GEARS 或 Seedance 交付包。');
  }
  if (validation.passed) {
    notes.push('当前类型校验已通过，建议只做轻微增强，避免破坏已通过结构。');
  }
  return notes;
}

function qualitySnapshot(validation: ValidateGenreStoryResult): RepairStoryResult['quality_snapshot'] {
  return {
    video_type: validation.video_type,
    story_structure: validation.story_structure,
    passed: validation.passed,
    genre_score: validation.genre_score,
    issue_count: validation.issues.length,
  };
}

function storyWithValidationQuality(story: StoryLike, validation: ValidateGenreStoryResult): StoryLike {
  if (story.quality_report) return story;
  return {
    ...story,
    quality_report: {
      passed: validation.passed,
      genre_score: validation.genre_score,
      issues: validation.issues,
      repair_actions: validation.repair_actions,
      missing_required_elements: validation.missing_required_elements,
      weak_beats: validation.weak_beats,
      forbidden_patterns_found: validation.forbidden_patterns_found,
    },
  };
}

async function maybeApplyRepair(input: RepairStoryInput): Promise<{
  updateResult?: UpdateProjectVersionResult;
  afterValidation?: ValidateGenreStoryResult;
  notes: string[];
}> {
  if (!input.auto_apply) return { notes: [] };
  if (!input.project_id?.trim()) {
    return { notes: ['auto_apply=true 需要 project_id；story_id/story_json 只返回 dry-run，不写版本。'] };
  }
  if (!input.repaired_story_json?.trim()) {
    return { notes: ['auto_apply=true 需要 repaired_story_json；工具不会凭空生成或猜测修复后正文。'] };
  }

  const repairedStory = parseStoryJson(input.repaired_story_json);
  const afterValidation = await validateGenreStory({
    story_json: JSON.stringify(repairedStory),
    include_repair_actions: true,
  });
  if (!afterValidation) {
    return { notes: ['repaired_story_json 无法完成质量校验，未写入版本。'] };
  }

  const storyForVersion = storyWithValidationQuality(repairedStory, afterValidation);
  const updateResult = await updateProjectVersion({
    project_id: input.project_id.trim(),
    change_type: 'quality_repair',
    snapshot_json: JSON.stringify(storyForVersion),
    user_instruction: input.user_instruction ?? 'MCP kb_repair_story(auto_apply=true)',
  });
  if (!updateResult) {
    return { afterValidation, notes: [`未找到项目：${input.project_id}，未写入版本。`] };
  }

  return {
    updateResult,
    afterValidation,
    notes: ['auto_apply=true 使用调用方提供的 repaired_story_json 写入；工具没有自行虚构修复正文。'],
  };
}

function buildMarkdown(result: Omit<RepairStoryResult, 'markdown'>): string {
  const lines = [
    '# Story Repair Dry Run',
    '',
    `- 来源：${result.source}`,
    `- 项目：${result.project_id ?? '未关联'}`,
    `- 故事：${result.story_id ?? '未命名'}`,
    `- 类型：${result.quality_snapshot.video_type}`,
    `- 分数：${result.quality_snapshot.genre_score}`,
    `- 通过：${result.quality_snapshot.passed ? '是' : '否'}`,
    `- issue 数：${result.quality_snapshot.issue_count}`,
    `- 自动应用：${result.applied ? `已写入 ${result.update_result?.version_id ?? ''}` : '未写入'}`,
    '',
    '## 修复动作',
    '',
  ];

  if (!result.repair_actions.length) {
    lines.push('- 暂无必须修复项。');
  } else {
    for (const action of result.repair_actions) {
      const targets = action.target_scene_ids.length ? `场景 ${action.target_scene_ids.join(', ')}` : '故事顶层字段';
      lines.push(`- ${action.action_id} [${action.priority}/${action.category}] ${action.issue}`);
      lines.push(`  - 建议：${action.suggested_change}`);
      lines.push(`  - 目标：${targets}`);
      lines.push(`  - 验收：${action.acceptance_check}`);
    }
  }

  if (result.after_quality_snapshot) {
    lines.push('', '## 应用后质量快照', '');
    lines.push(`- 分数：${result.after_quality_snapshot.genre_score}`);
    lines.push(`- 通过：${result.after_quality_snapshot.passed ? '是' : '否'}`);
    lines.push(`- issue 数：${result.after_quality_snapshot.issue_count}`);
  }

  lines.push('', '## 风险说明', '');
  for (const note of result.risk_notes) {
    lines.push(`- ${note}`);
  }
  return lines.join('\n');
}

function clampMaxActions(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 12;
  return Math.max(1, Math.min(50, Math.floor(value)));
}

export async function repairStory(input: RepairStoryInput): Promise<RepairStoryResult | null> {
  const resolved = await resolveStory(input);
  if (!resolved) return null;

  const validation = await validateGenreStory({
    project_id: input.project_id,
    story_id: input.story_id,
    story_json: input.story_json,
    include_repair_actions: true,
  });
  if (!validation) return null;

  const repairActions = buildRepairActions(resolved.story, validation, clampMaxActions(input.max_actions));
  const autoApply = await maybeApplyRepair(input);
  const applied = Boolean(autoApply.updateResult);
  const result: Omit<RepairStoryResult, 'markdown'> = {
    source: resolved.source,
    project_id: autoApply.updateResult?.project_id ?? validation.project_id ?? resolved.story.project_id ?? input.project_id,
    story_id: validation.story_id ?? resolved.story.storyId ?? input.story_id,
    auto_apply: applied,
    auto_apply_requested: input.auto_apply === true,
    applied,
    quality_snapshot: qualitySnapshot(validation),
    after_quality_snapshot: autoApply.afterValidation ? qualitySnapshot(autoApply.afterValidation) : undefined,
    update_result: autoApply.updateResult,
    source_issues: validation.issues,
    repair_actions: repairActions,
    target_scenes: aggregateTargetScenes(repairActions),
    risk_notes: buildRiskNotes(input, resolved.story, validation, applied, autoApply.notes),
  };

  if (input.include_markdown === false) return result;
  return {
    ...result,
    markdown: buildMarkdown(result),
  };
}
