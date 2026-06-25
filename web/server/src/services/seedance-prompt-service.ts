import type {
  GearsDeliveryPackage,
  GearsDeliveryUnit,
  SeedanceAssetReference,
  SeedancePackageMaterialValidation,
  SeedancePromptPackage,
  SeedancePromptShotUnit,
  SeedanceShotAssetSlot,
  SeedanceShotMaterialValidation,
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
];

const SEEDANCE_LIMITS = {
  maxTotalFiles: 12,
  maxImageFiles: 9,
  maxVideoFiles: 3,
  maxAudioFiles: 3,
};

const PROP_CANDIDATES = ['案卷', '文书', '判词', '毛笔', '书信', '旧信', '印章', '石碑', '莲', '灯', '伞', '铜铃', '香炉'];
const CAMERA_REFERENCE_KEYWORDS = ['@视频', '参考视频', '视频参考', '运镜参考', '镜头参考', '节奏参考', '动作参考'];
const AUDIO_REFERENCE_KEYWORDS = ['@音频', '参考音频', '音频参考', '音乐参考', '音效参考', '配乐参考', '声音参考', '环境声参考'];

type SeedanceImageReferenceSeed = {
  kind: 'character' | 'location' | 'prop';
  label: string;
  role: 'character_reference' | 'location_reference' | 'prop_reference';
  description: string;
  source_scene_ids: number[];
  required: boolean;
  priority: number;
};

export function buildSeedancePromptPackage(story: StoryGenerateResult): SeedancePromptPackage {
  const delivery = ensureGearsDeliveryPackage(story);
  const sceneById = new Map(story.scene_breakdown.map(scene => [scene.scene_id, scene]));
  const assetReferences = buildAssetReferences(story, delivery);
  const shotUnits = delivery.units.map(unit => buildShotUnit({
    story,
    delivery,
    unit,
    scene: sceneById.get(unit.source_scene_id),
    assetReferences,
  }));
  const materialValidation = buildPackageMaterialValidation(assetReferences);
  const validationNotes = [
    ...delivery.validation_notes.map(note => `GEARS: ${note}`),
    ...materialValidation.warnings,
    ...shotUnits.flatMap(validateShotUnit),
  ].filter((item, index, arr) => arr.indexOf(item) === index);
  const basePackage: Omit<SeedancePromptPackage, 'markdown'> = {
    schema_version: 'seedance-prompt-package/v1',
    storyId: story.storyId,
    title: story.title,
    target_platform: 'seedance_2_0',
    prompt_language: 'zh',
    total_duration_sec: shotUnits.reduce((sum, unit) => sum + unit.duration_sec, 0),
    asset_reference_plan: assetReferences.map(formatAssetReferencePlanItem),
    asset_references: assetReferences,
    material_validation: materialValidation,
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
  assetReferences: SeedanceAssetReference[];
}): SeedancePromptShotUnit {
  const { unit, scene } = input;
  const durationSec = clampDuration(scene?.duration_sec ?? unit.suggested_duration_sec);
  const location = scene?.location?.trim() || unit.scene_name || '未指定场景';
  const characters = unit.character_names.length > 0
    ? unit.character_names
    : (scene?.characters ?? []).filter(Boolean).slice(0, 4);
  const visualPrompt = cleanPrompt(compactStrings([
    scene?.visual_prompt,
    location,
    characters.length > 0 ? `人物：${characters.join('、')}` : undefined,
  ]).join('，'));
  const scriptText = buildConciseSeedanceScript(unit, scene);
  const cameraSuggestion = cleanPrompt(scene?.camera_suggestion || defaultCamera(unit, scene));
  const continuityNotes = buildPromptContinuityNotes(scene);
  const negativeConstraints = buildNegativeConstraints(scene, visualPrompt, unit.script_text);
  const assetSlots = buildShotAssetSlots({
    references: input.assetReferences,
    shotId: `shot-${unit.unit_id}`,
    sourceSceneId: unit.source_scene_id,
    characters,
    location,
    text: [unit.script_text, visualPrompt, cameraSuggestion].join(' '),
  });
  const materialValidation = buildShotMaterialValidation({
    shotId: `shot-${unit.unit_id}`,
    durationSec,
    characters,
    location,
    text: [scriptText, visualPrompt, cameraSuggestion].join(' '),
    assetSlots,
  });
  return {
    shot_id: `shot-${unit.unit_id}`,
    source_scene_id: unit.source_scene_id,
    source_unit_id: unit.unit_id,
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

function buildSeedancePrompt(input: {
  durationSec: number;
  location: string;
  characters: string[];
  scriptText: string;
  visualPrompt: string;
  cameraSuggestion: string;
  continuityNotes: string[];
  negativeConstraints: string[];
  assetSlots: SeedanceShotAssetSlot[];
}): string {
  const subject = input.characters.length > 0 ? input.characters.join('、') : '主要人物';
  const midPoint = input.durationSec <= 8 ? Math.max(4, input.durationSec - 2) : 7;
  const endPoint = input.durationSec;
  const assetLine = buildShotAssetUsageLine(input.assetSlots);
  const lines = [
    `生成 ${input.durationSec} 秒视频。主体：${subject}。场景：${input.location}。`,
    assetLine,
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

function buildAssetReferences(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage,
): SeedanceAssetReference[] {
  const characterSeeds = delivery.character_assets.map(character => {
    const sourceSceneIds = story.scene_breakdown
      .filter(scene => scene.characters?.includes(character.name))
      .map(scene => scene.scene_id);
    const required = character.role_position === '主角' || sourceSceneIds.length > 1;
    return {
      kind: 'character' as const,
      label: character.name,
      role: 'character_reference' as const,
      description: `${character.appearance_features}；服装：${character.clothing}`,
      source_scene_ids: sourceSceneIds,
      required,
      priority: required ? character.role_position === '主角' ? 10 : 15 + firstScenePriority(sourceSceneIds) : 60 + firstScenePriority(sourceSceneIds),
    };
  });
  const locationSeeds = buildLocationReferenceSeeds(story, delivery);
  const propSeeds = buildPropReferenceSeeds(story);
  const planned = [...characterSeeds, ...locationSeeds, ...propSeeds]
    .sort((a, b) => a.priority - b.priority || firstScenePriority(a.source_scene_ids) - firstScenePriority(b.source_scene_ids) || a.label.localeCompare(b.label, 'zh-CN'));

  const imageReferences: SeedanceAssetReference[] = planned.slice(0, SEEDANCE_LIMITS.maxImageFiles).map((item, index) => ({
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
  const cameraReferences: SeedanceAssetReference[] = buildCameraReferenceSeeds(story)
    .slice(0, SEEDANCE_LIMITS.maxVideoFiles)
    .map((item, index) => ({
      asset_id: seedanceAssetId('camera', item.label),
      kind: 'camera',
      label: item.label,
      modality: 'video',
      reference_slot: `@视频${index + 1}`,
      role: 'camera_reference',
      description: item.description,
      source_scene_ids: uniqueNumbers(item.source_scene_ids),
      source_shot_ids: uniqueNumbers(item.source_scene_ids).map(sceneId => `shot-${sceneId}`),
      required: false,
    }));
  const audioReferences: SeedanceAssetReference[] = buildAudioReferenceSeeds(story)
    .slice(0, SEEDANCE_LIMITS.maxAudioFiles)
    .map((item, index) => ({
      asset_id: seedanceAssetId('audio', item.label),
      kind: 'audio',
      label: item.label,
      modality: 'audio',
      reference_slot: `@音频${index + 1}`,
      role: item.role,
      description: item.description,
      source_scene_ids: uniqueNumbers(item.source_scene_ids),
      source_shot_ids: uniqueNumbers(item.source_scene_ids).map(sceneId => `shot-${sceneId}`),
      required: false,
    }));
  return [...imageReferences, ...cameraReferences, ...audioReferences];
}

function buildLocationReferenceSeeds(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage,
): SeedanceImageReferenceSeed[] {
  const byLabel = new Map<string, SeedanceImageReferenceSeed>();
  const sceneAssets = delivery.scene_assets;
  for (const scene of story.scene_breakdown) {
    const label = scene.location.trim();
    if (!label) continue;
    const existing = byLabel.get(label);
    const matchedAsset = bestSceneAssetForLocation(label, sceneAssets);
    const description = cleanPrompt(compactStrings([
      matchedAsset?.description,
      scene.visual_prompt,
      matchedAsset?.atmosphere ? `氛围：${matchedAsset.atmosphere}` : undefined,
    ]).join('；'));
    byLabel.set(label, {
      kind: 'location',
      label,
      role: 'location_reference',
      description,
      source_scene_ids: uniqueNumbers([...(existing?.source_scene_ids ?? []), scene.scene_id]),
      required: true,
      priority: 25 + scene.scene_id,
    });
  }
  return [...byLabel.values()];
}

function bestSceneAssetForLocation(
  location: string,
  sceneAssets: GearsDeliveryPackage['scene_assets'],
): GearsDeliveryPackage['scene_assets'][number] | undefined {
  return [...sceneAssets]
    .filter(asset => locationMatches(asset.name, location) || locationMatches(asset.description, location))
    .sort((a, b) => sceneAssetMatchScore(a.name, location) - sceneAssetMatchScore(b.name, location))
    [0];
}

function sceneAssetMatchScore(label: string, location: string): number {
  if (label === location) return 0;
  if (label.includes(location)) return 1;
  if (location.includes(label)) return 2;
  return 3;
}

function locationMatches(value: string, location: string): boolean {
  const a = normalizeLocationName(value);
  const b = normalizeLocationName(location);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function normalizeLocationName(value: string): string {
  return value.replace(/[，,。；;\s]/g, '').trim();
}

function firstScenePriority(sceneIds: number[]): number {
  return sceneIds.length ? Math.min(...sceneIds) : 99;
}

function buildPropReferenceSeeds(story: StoryGenerateResult): Array<{
  kind: 'prop';
  label: string;
  role: 'prop_reference';
  description: string;
  source_scene_ids: number[];
  required: boolean;
  priority: number;
}> {
  const propMap = new Map<string, Set<number>>();
  for (const scene of story.scene_breakdown) {
    const text = [scene.title, scene.plot, scene.key_action, scene.visual_prompt, scene.dialogue_or_narration].join(' ');
    for (const prop of PROP_CANDIDATES) {
      if (!text.includes(prop)) continue;
      if (!propMap.has(prop)) propMap.set(prop, new Set());
      propMap.get(prop)?.add(scene.scene_id);
    }
  }
  return [...propMap.entries()].map(([label, sceneIds]) => ({
    kind: 'prop',
    label,
    role: 'prop_reference',
    description: `${label}作为关键道具外观参考，需在相关镜头中保持造型、材质和位置连续。`,
    source_scene_ids: [...sceneIds].sort((a, b) => a - b),
    required: false,
    priority: 80 + firstScenePriority([...sceneIds]),
  }));
}

function buildCameraReferenceSeeds(story: StoryGenerateResult): Array<{
  label: string;
  description: string;
  source_scene_ids: number[];
}> {
  const sourceSceneIds = story.scene_breakdown
    .filter(scene => includesAny([
      scene.camera_suggestion,
      scene.visual_prompt,
      scene.key_action,
      scene.plot,
      scene.dialogue_or_narration,
    ].join(' '), CAMERA_REFERENCE_KEYWORDS))
    .map(scene => scene.scene_id);
  if (!sourceSceneIds.length) return [];
  return [{
    label: '运镜节奏参考',
    description: '参考镜头运动、动作衔接和节奏变化，不替代人物、场景或道具画面资产。',
    source_scene_ids: uniqueNumbers(sourceSceneIds),
  }];
}

function buildAudioReferenceSeeds(story: StoryGenerateResult): Array<{
  label: string;
  role: 'music_reference' | 'sound_reference';
  description: string;
  source_scene_ids: number[];
}> {
  const musicSceneIds: number[] = [];
  const soundSceneIds: number[] = [];
  for (const scene of story.scene_breakdown) {
    const text = [
      scene.title,
      scene.plot,
      scene.key_action,
      scene.visual_prompt,
      scene.dialogue_or_narration,
      scene.cultural_note,
    ].join(' ');
    if (!includesAny(text, AUDIO_REFERENCE_KEYWORDS)) continue;
    if (/音乐|配乐|BGM|bgm/i.test(text)) {
      musicSceneIds.push(scene.scene_id);
    } else {
      soundSceneIds.push(scene.scene_id);
    }
  }
  return [
    musicSceneIds.length
      ? {
        label: '背景音乐参考',
        role: 'music_reference' as const,
        description: '参考背景音乐的情绪、节奏和强弱变化，不替代可见画面描述。',
        source_scene_ids: uniqueNumbers(musicSceneIds),
      }
      : undefined,
    soundSceneIds.length
      ? {
        label: '环境音效参考',
        role: 'sound_reference' as const,
        description: '参考环境声、动作音效和空间声场，不替代对白或旁白内容。',
        source_scene_ids: uniqueNumbers(soundSceneIds),
      }
      : undefined,
  ].filter((item): item is {
    label: string;
    role: 'music_reference' | 'sound_reference';
    description: string;
    source_scene_ids: number[];
  } => Boolean(item));
}

function formatAssetReferencePlanItem(reference: SeedanceAssetReference): string {
  if (reference.kind === 'character') {
    return `${reference.reference_slot} 可作为人物「${reference.label}」形象参考：${reference.description}`;
  }
  if (reference.kind === 'location') {
    return `${reference.reference_slot} 可作为场景「${reference.label}」氛围参考：${reference.description}`;
  }
  if (reference.kind === 'prop') {
    return `${reference.reference_slot} 可作为道具「${reference.label}」外观参考：${reference.description}`;
  }
  if (reference.kind === 'camera') return `${reference.reference_slot} 可作为运镜和节奏参考：${reference.description}`;
  return `${reference.reference_slot} 可作为背景音乐或音效参考：${reference.description}`;
}

function buildShotAssetSlots(input: {
  references: SeedanceAssetReference[];
  shotId: string;
  sourceSceneId: number;
  characters: string[];
  location: string;
  text: string;
}): SeedanceShotAssetSlot[] {
  return input.references
    .filter(reference => {
      if (reference.kind === 'character') return input.characters.includes(reference.label);
      if (reference.kind === 'location') {
        return input.location === reference.label
          || input.location.includes(reference.label)
          || reference.label.includes(input.location)
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

function seedanceSlotUsage(reference: SeedanceAssetReference): string {
  if (reference.kind === 'character') return `${reference.reference_slot} 作为人物「${reference.label}」形象参考`;
  if (reference.kind === 'location') return `${reference.reference_slot} 作为场景「${reference.label}」氛围参考`;
  if (reference.kind === 'prop') return `${reference.reference_slot} 作为道具「${reference.label}」外观参考`;
  if (reference.kind === 'camera') return `${reference.reference_slot} 作为运镜和节奏参考`;
  return `${reference.reference_slot} 作为音乐或音效参考`;
}

function buildShotAssetUsageLine(slots: SeedanceShotAssetSlot[]): string {
  if (!slots.length) return '';
  return `素材引用：${slots.map(slot => slot.prompt_usage).join('；')}。`;
}

function buildPackageMaterialValidation(references: SeedanceAssetReference[]): SeedancePackageMaterialValidation {
  const imageCount = references.filter(reference => reference.modality === 'image').length;
  const videoCount = references.filter(reference => reference.modality === 'video').length;
  const audioCount = references.filter(reference => reference.modality === 'audio').length;
  const totalFileCount = imageCount + videoCount + audioCount;
  const warnings = [
    totalFileCount > SEEDANCE_LIMITS.maxTotalFiles
      ? `素材总数 ${totalFileCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxTotalFiles}`
      : '',
    imageCount > SEEDANCE_LIMITS.maxImageFiles
      ? `图片素材 ${imageCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxImageFiles}`
      : '',
    videoCount > SEEDANCE_LIMITS.maxVideoFiles
      ? `视频素材 ${videoCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxVideoFiles}`
      : '',
    audioCount > SEEDANCE_LIMITS.maxAudioFiles
      ? `音频素材 ${audioCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxAudioFiles}`
      : '',
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
  shotId: string;
  durationSec: number;
  characters: string[];
  location: string;
  text: string;
  assetSlots: SeedanceShotAssetSlot[];
}): SeedanceShotMaterialValidation {
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
    totalFileCount > SEEDANCE_LIMITS.maxTotalFiles
      ? `素材总数 ${totalFileCount} 超过单条提示可控范围 ${SEEDANCE_LIMITS.maxTotalFiles}`
      : '',
    imageCount > SEEDANCE_LIMITS.maxImageFiles
      ? `图片素材 ${imageCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxImageFiles}`
      : '',
    videoCount > SEEDANCE_LIMITS.maxVideoFiles
      ? `视频素材 ${videoCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxVideoFiles}`
      : '',
    audioCount > SEEDANCE_LIMITS.maxAudioFiles
      ? `音频素材 ${audioCount} 超过 Seedance 限制 ${SEEDANCE_LIMITS.maxAudioFiles}`
      : '',
    ...validateAssetReferenceSlots(input.assetSlots),
    missingRequiredSlots.length ? `缺少必需素材引用槽位：${missingRequiredSlots.join('、')}` : '',
    durationRisk === 'overloaded'
      ? `提示复杂度 ${promptComplexityScore}/100 对 ${input.durationSec} 秒时长过载`
      : '',
    durationRisk === 'dense'
      ? `提示复杂度 ${promptComplexityScore}/100 偏高，建议拆分动作或延长时长`
      : '',
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

function validateAssetReferenceSlots(
  slots: Array<Pick<SeedanceAssetReference, 'kind' | 'modality' | 'reference_slot' | 'role' | 'label'>>,
): string[] {
  return slots.flatMap(slot => {
    const warnings: string[] = [];
    if (slot.modality === 'image' && !slot.reference_slot.startsWith('@图片')) {
      warnings.push(`${slot.label} 图片素材引用槽位应使用 @图片 前缀`);
    }
    if (slot.modality === 'video') {
      if (!slot.reference_slot.startsWith('@视频')) warnings.push(`${slot.label} 视频素材引用槽位应使用 @视频 前缀`);
      if (slot.kind !== 'camera' || slot.role !== 'camera_reference') {
        warnings.push(`${slot.label} 视频素材需标注为运镜/节奏参考`);
      }
    }
    if (slot.modality === 'audio') {
      if (!slot.reference_slot.startsWith('@音频')) warnings.push(`${slot.label} 音频素材引用槽位应使用 @音频 前缀`);
      if (slot.kind !== 'audio' || !['music_reference', 'sound_reference'].includes(slot.role)) {
        warnings.push(`${slot.label} 音频素材需标注为音乐或音效参考`);
      }
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

function durationRiskForPrompt(durationSec: number, complexityScore: number): 'ok' | 'dense' | 'overloaded' {
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

function renderSeedanceMarkdown(pkg: Omit<SeedancePromptPackage, 'markdown'>): string {
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
      unit.asset_slots.length
        ? `- 素材 slot: ${unit.asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；')}`
        : '- 素材 slot: 无',
      unit.material_validation.warnings.length
        ? `- 素材校验: ${unit.material_validation.warnings.join('；')}`
        : `- 素材校验: 通过 · 复杂度 ${unit.material_validation.prompt_complexity_score}/100`,
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
  notes.push(...unit.material_validation.warnings.map(warning => `${unit.shot_id} ${warning}`));
  if (hasPromptNoise(unit.visual_prompt) || hasPromptNoise(unit.seedance_prompt)) notes.push(`${unit.shot_id} 提示词可能混入分析/质量说明`);
  if (unit.script_text.includes('【文本待补】')) notes.push(`${unit.shot_id} 缺少可生成的脚本文本`);
  return notes;
}

function buildNegativeConstraints(scene: StoryScene | undefined, visualPrompt: string, scriptText: string): string[] {
  const items = [
    '不要出现现代无关物件',
    '只保留可见可听内容',
    hasPromptNoise(visualPrompt) || hasPromptNoise(scriptText) ? '清除不可见说明，只保留动作、表情、道具和声音' : '',
    scene?.cultural_note ? '文化对象、年代服饰和地点氛围保持一致' : '',
  ];
  return compactStrings(items).filter((item, index, arr) => arr.indexOf(item) === index);
}

function buildPromptContinuityNotes(scene?: StoryScene): string[] {
  if (!scene) return [];
  const notes = [
    scene.factual_basis || scene.cultural_note
      ? '年代、地点、服饰和文化对象保持同一语境。'
      : '',
    scene.fictionalized_elements?.length
      ? '新增人物或事件只通过可见动作、道具和空间关系服务本镜头。'
      : '',
    scene.source_entries?.length
      ? '人物名称、地点名称和核心文化物件前后一致。'
      : '',
  ];
  return compactStrings(notes).filter((item, index, arr) => arr.indexOf(item) === index);
}

function defaultCamera(unit: GearsDeliveryUnit, scene?: StoryScene): string {
  if (scene?.dramatic_function?.includes('开场')) return '建立镜头后慢推到人物中景';
  if (unit.beat_count >= 3) return '中景跟随，关键动作切近景';
  return '中景固定镜头，动作清楚';
}

function buildConciseSeedanceScript(unit: GearsDeliveryUnit, scene?: StoryScene): string {
  const actionText = cleanScript(compactStrings([
    scene?.key_action,
    conciseDialogue(scene?.dialogue_or_narration),
  ]).join(' '));
  return summarizeSeedanceText(actionText || cleanScript(unit.script_text), 120);
}

function conciseDialogue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .split(/[。；;\n]/)
    .map(item => item.trim())
    .find(item => item.length > 0);
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
    .replace(/^[:：,，；;\s]+/g, '')
    .replace(/[，,]\s*[，,]+/g, '，')
    .replace(/[，,]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '人物处于明确空间中，动作和表情清楚，光线自然。';
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
    .trim();
}

function hasPromptNoise(value: string): boolean {
  return PROMPT_NOISE_WORDS.some(word => value.includes(word))
    || /(?:质量|分析|建议|来源显示|来源条目|史实依据|影视化创作)[:：]/.test(value);
}

function compactStrings(items: Array<string | undefined | null | false>): string[] {
  return items
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean);
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function includesAny(value: string, keywords: string[]): boolean {
  return keywords.some(keyword => value.includes(keyword));
}

function seedanceAssetId(kind: SeedanceAssetReference['kind'], label: string): string {
  return `seedance-asset-${kind}-${slugify(label)}`;
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
