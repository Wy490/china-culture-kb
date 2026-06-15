import type {
  GearsDeliveryPackage,
  GearsDeliveryUnit,
  SeedancePromptPackage,
  SeedancePromptShotUnit,
  StoryGenerateResult,
  StoryScene,
} from '@shared/types.js';
import { ensureGearsDeliveryPackage } from './gears-delivery-service.js';

const PROMPT_NOISE_WORDS = [
  '质量信号',
  '建议调整',
  '类型匹配',
  '资料显示',
  '来源显示',
  '摘要',
  '核心画面是',
  '为什么必须面对',
  '应该',
  '注意',
];

export function buildSeedancePromptPackage(story: StoryGenerateResult): SeedancePromptPackage {
  const delivery = ensureGearsDeliveryPackage(story);
  const sceneById = new Map(story.scene_breakdown.map(scene => [scene.scene_id, scene]));
  const shotUnits = delivery.units.map(unit => buildShotUnit({
    story,
    delivery,
    unit,
    scene: sceneById.get(unit.source_scene_id),
  }));
  const validationNotes = [
    ...delivery.validation_notes.map(note => `GEARS: ${note}`),
    ...shotUnits.flatMap(validateShotUnit),
  ].filter((item, index, arr) => arr.indexOf(item) === index);
  const basePackage: Omit<SeedancePromptPackage, 'markdown'> = {
    schema_version: 'seedance-prompt-package/v1',
    storyId: story.storyId,
    title: story.title,
    target_platform: 'seedance_2_0',
    prompt_language: 'zh',
    total_duration_sec: shotUnits.reduce((sum, unit) => sum + unit.duration_sec, 0),
    asset_reference_plan: buildAssetReferencePlan(delivery),
    shot_units: shotUnits,
    validation_notes: validationNotes,
  };
  return {
    ...basePackage,
    markdown: renderSeedanceMarkdown(basePackage),
  };
}

function buildShotUnit(input: {
  story: StoryGenerateResult;
  delivery: GearsDeliveryPackage;
  unit: GearsDeliveryUnit;
  scene?: StoryScene;
}): SeedancePromptShotUnit {
  const { unit, scene } = input;
  const durationSec = clampDuration(unit.suggested_duration_sec);
  const location = scene?.location?.trim() || unit.scene_name || '未指定场景';
  const characters = unit.character_names.length > 0
    ? unit.character_names
    : (scene?.characters ?? []).filter(Boolean).slice(0, 4);
  const visualPrompt = cleanPrompt(compactStrings([
    scene?.visual_prompt,
    location,
    characters.length > 0 ? `人物：${characters.join('、')}` : undefined,
    scene?.cultural_note,
  ]).join('，'));
  const cameraSuggestion = cleanPrompt(scene?.camera_suggestion || defaultCamera(unit, scene));
  const continuityNotes = compactStrings([
    scene?.factual_basis ? `史实依据：${scene.factual_basis}` : undefined,
    scene?.fictionalized_elements?.length ? `影视化创作：${scene.fictionalized_elements.join('；')}` : undefined,
    scene?.source_entries?.length ? `来源条目：${scene.source_entries.join('、')}` : undefined,
  ]);
  const negativeConstraints = buildNegativeConstraints(scene, visualPrompt, unit.script_text);
  return {
    shot_id: `shot-${unit.unit_id}`,
    source_scene_id: unit.source_scene_id,
    source_unit_id: unit.unit_id,
    duration_sec: durationSec,
    characters,
    location,
    script_text: cleanScript(unit.script_text),
    visual_prompt: visualPrompt,
    camera_suggestion: cameraSuggestion,
    continuity_notes: continuityNotes,
    negative_constraints: negativeConstraints,
    seedance_prompt: buildSeedancePrompt({
      durationSec,
      location,
      characters,
      scriptText: cleanScript(unit.script_text),
      visualPrompt,
      cameraSuggestion,
      continuityNotes,
      negativeConstraints,
    }),
  };
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
}): string {
  const subject = input.characters.length > 0 ? input.characters.join('、') : '主要人物';
  const midPoint = input.durationSec <= 8 ? Math.max(4, input.durationSec - 2) : 7;
  const endPoint = input.durationSec;
  const lines = [
    `生成 ${input.durationSec} 秒视频。主体：${subject}。场景：${input.location}。`,
    `0-3秒：${input.visualPrompt}；${subject}进入画面，完成初始动作；镜头：${input.cameraSuggestion}。`,
    input.durationSec <= 8
      ? `3-${endPoint}秒：${input.scriptText}；突出表情、手部动作和空间关系，结尾留出半秒定格。`
      : `3-${midPoint}秒：${input.scriptText}；冲突或发现推进，镜头跟随人物动作变化。`,
    input.durationSec > 8
      ? `${midPoint}-${endPoint}秒：关键情绪或转折落地，收束到可承接的定格画面。`
      : '',
    input.continuityNotes.length ? `连续性：${input.continuityNotes.join('；')}。` : '',
    `风格：AI漫剧/影视分镜，画面清晰，人物动作可拍，时代与服饰保持一致。`,
    `音效/音乐：环境声贴合场景，情绪紧张处轻微增强节奏。`,
    input.negativeConstraints.length ? `禁止：${input.negativeConstraints.join('；')}。` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function buildAssetReferencePlan(delivery: GearsDeliveryPackage): string[] {
  const characterRefs = delivery.character_assets.slice(0, 9).map((character, index) =>
    `@图片${index + 1} 可作为人物「${character.name}」形象参考：${character.appearance_features}；服装：${character.clothing}`
  );
  const sceneOffset = characterRefs.length;
  const sceneRefs = delivery.scene_assets.slice(0, Math.max(0, 9 - sceneOffset)).map((scene, index) =>
    `@图片${sceneOffset + index + 1} 可作为场景「${scene.name}」氛围参考：${scene.description}`
  );
  return [...characterRefs, ...sceneRefs];
}

function renderSeedanceMarkdown(pkg: Omit<SeedancePromptPackage, 'markdown'>): string {
  const lines = [
    `# ${pkg.title} — Seedance 2.0 镜头提示词包`,
    '',
    `> schema: ${pkg.schema_version}`,
    `> storyId: ${pkg.storyId}`,
    `> 总时长: ${pkg.total_duration_sec} 秒`,
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
      unit.continuity_notes.length ? `- 连续性: ${unit.continuity_notes.join('；')}` : '- 连续性: 无',
      unit.negative_constraints.length ? `- 禁止: ${unit.negative_constraints.join('；')}` : '- 禁止: 无',
      '',
      '```text',
      unit.seedance_prompt,
      '```',
    );
  }
  if (pkg.validation_notes.length) {
    lines.push('', '## 校验提醒', ...pkg.validation_notes.map(note => `- ${note}`));
  }
  return lines.join('\n');
}

function validateShotUnit(unit: SeedancePromptShotUnit): string[] {
  const notes: string[] = [];
  if (unit.duration_sec < 4 || unit.duration_sec > 15) notes.push(`${unit.shot_id} 时长不在 Seedance 建议范围 4-15 秒`);
  if (!unit.characters.length) notes.push(`${unit.shot_id} 缺少人物锚点`);
  if (hasPromptNoise(unit.visual_prompt) || hasPromptNoise(unit.seedance_prompt)) notes.push(`${unit.shot_id} 提示词可能混入分析/质量说明`);
  if (unit.script_text.includes('【文本待补】')) notes.push(`${unit.shot_id} 缺少可生成的脚本文本`);
  return notes;
}

function buildNegativeConstraints(scene: StoryScene | undefined, visualPrompt: string, scriptText: string): string[] {
  const items = [
    '不要出现现代无关物件',
    '不要出现质量报告、来源说明或内部字段名',
    hasPromptNoise(visualPrompt) || hasPromptNoise(scriptText) ? '清除分析性文字，只保留可见可听内容' : '',
    scene?.cultural_note ? '不要改写文化/史实边界为确定史实' : '',
  ];
  return compactStrings(items).filter((item, index, arr) => arr.indexOf(item) === index);
}

function defaultCamera(unit: GearsDeliveryUnit, scene?: StoryScene): string {
  if (scene?.dramatic_function?.includes('开场')) return '建立镜头后慢推到人物中景';
  if (unit.beat_count >= 3) return '中景跟随，关键动作切近景';
  return '中景固定镜头，动作清楚';
}

function clampDuration(value: number): number {
  return Math.max(4, Math.min(15, Math.round(value || 8)));
}

function cleanScript(value: string): string {
  return stripPromptNoise(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPrompt(value: string): string {
  const cleaned = stripPromptNoise(value)
    .replace(/[；;]\s*/g, '，')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '人物处于明确空间中，动作和表情清楚，光线自然。';
}

function stripPromptNoise(value: string): string {
  let text = value;
  for (const word of PROMPT_NOISE_WORDS) {
    text = text.replaceAll(word, '');
  }
  return text
    .replace(/【文本待补】/g, '')
    .replace(/(?:质量|分析|建议)[:：][^。；\n]*/g, '')
    .trim();
}

function hasPromptNoise(value: string): boolean {
  return PROMPT_NOISE_WORDS.some(word => value.includes(word)) || /(?:质量|分析|建议)[:：]/.test(value);
}

function compactStrings(items: Array<string | undefined | null | false>): string[] {
  return items
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean);
}
