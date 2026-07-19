import type {
  AssetBinding,
  GearsCharacterAsset,
  GearsSceneAsset,
  MediaAssetLibrary,
  SeedanceAssetBindingItem,
  StoryImageAssetJobPlan,
  StoryImageAssetRequirement,
  StoryProductionBoardPropAsset,
  StoryProductionBoardShotUnit,
} from '@shared/types.js';

type ImageRequirementSeed = Omit<
  StoryImageAssetRequirement,
  | 'schema_version'
  | 'requirement_id'
  | 'asset_id'
  | 'reference_slot'
  | 'binding_status'
  | 'provider_invoked'
  | 'production_credit_granted'
> & {
  fallback_asset_id: string;
};

export function buildStoryImageAssetJobPlan(input: {
  project_id: string;
  story_id: string;
  source_version_id?: string;
  generated_at: string;
  character_assets: GearsCharacterAsset[];
  location_assets: GearsSceneAsset[];
  prop_assets: StoryProductionBoardPropAsset[];
  shot_units: StoryProductionBoardShotUnit[];
  seedance_assets: SeedanceAssetBindingItem[];
  media_asset_library: MediaAssetLibrary;
  negative_constraints: string[];
}): StoryImageAssetJobPlan {
  const seedanceByKey = new Map(input.seedance_assets.map(asset => [
    assetLookupKey(asset.kind, asset.label),
    asset,
  ]));
  const mediaByAssetId = new Map(input.media_asset_library.bindings.map(binding => [binding.asset_id, binding]));
  const requirements = [
    ...input.character_assets.map(asset => characterRequirement(asset, input.shot_units, input.negative_constraints)),
    ...input.location_assets.map(asset => locationRequirement(asset, input.shot_units, input.negative_constraints)),
    ...input.prop_assets.map(asset => propRequirement(asset, input.shot_units, input.negative_constraints)),
  ].map(seed => finalizeRequirement(seed, seedanceByKey, mediaByAssetId));
  const productionCreditCount = requirements.filter(item => item.production_credit_granted).length;

  return {
    schema_version: 'story-image-asset-job-plan/v1',
    project_id: input.project_id,
    story_id: input.story_id,
    source_version_id: input.source_version_id,
    generated_at: input.generated_at,
    provider_invoked: false,
    production_credit_count: productionCreditCount,
    summary: {
      requirement_count: requirements.length,
      character_requirement_count: requirements.filter(item => item.asset_kind === 'character').length,
      location_requirement_count: requirements.filter(item => item.asset_kind === 'location').length,
      prop_requirement_count: requirements.filter(item => item.asset_kind === 'prop').length,
      ready_to_submit_count: requirements.filter(item => !item.production_credit_granted).length,
      production_ready_count: productionCreditCount,
    },
    requirements,
  };
}

function characterRequirement(
  asset: GearsCharacterAsset,
  shots: StoryProductionBoardShotUnit[],
  negativeConstraints: string[],
): ImageRequirementSeed {
  const sourceShots = shots.filter(shot => shot.characters.includes(asset.name));
  return {
    fallback_asset_id: `character:${asset.name}`,
    asset_kind: 'character',
    label: asset.name,
    job_type: 'character_image',
    source_unit_id: `character:${asset.name}`,
    source_scene_ids: uniqueNumbers(sourceShots.map(shot => shot.source_scene_id)),
    source_shot_ids: uniqueStrings(sourceShots.map(shot => shot.shot_id)),
    prompt: cleanAssetPrompt([
      `${asset.name}角色定妆参考图`,
      `身份定位：${asset.role_position}`,
      `外貌：${asset.appearance_features}`,
      `服装：${asset.clothing}`,
      asset.carried_props ? `随身道具：${asset.carried_props}` : '',
      asset.signature_objects ? `标志物：${asset.signature_objects}` : '',
      '正面或四分之三身位，人物轮廓、面部、发型与服饰细节清晰，供后续镜头保持角色一致性',
    ]),
    negative_constraints: negativeConstraints,
  };
}

function locationRequirement(
  asset: GearsSceneAsset,
  shots: StoryProductionBoardShotUnit[],
  negativeConstraints: string[],
): ImageRequirementSeed {
  const sourceShots = shots.filter(shot => shot.location === asset.name);
  return {
    fallback_asset_id: `location:${asset.name}`,
    asset_kind: 'location',
    label: asset.name,
    job_type: 'scene_image',
    source_unit_id: `scene:${asset.name}`,
    source_scene_ids: uniqueNumbers(sourceShots.map(shot => shot.source_scene_id)),
    source_shot_ids: uniqueStrings(sourceShots.map(shot => shot.shot_id)),
    prompt: cleanAssetPrompt([
      `${asset.name}场景设定参考图`,
      `空间类型：${asset.scene_type}`,
      `空间描述：${asset.description}`,
      asset.environment_props ? `环境道具：${asset.environment_props}` : '',
      `氛围：${asset.atmosphere}`,
      '广角建立镜头，空间结构、出入口、光线方向与关键陈设清晰，供后续镜头保持场景连续性',
    ]),
    negative_constraints: negativeConstraints,
  };
}

function propRequirement(
  asset: StoryProductionBoardPropAsset,
  shots: StoryProductionBoardShotUnit[],
  negativeConstraints: string[],
): ImageRequirementSeed {
  const sceneIds = new Set(asset.source_scene_ids);
  const sourceShots = shots.filter(shot => sceneIds.has(shot.source_scene_id));
  return {
    fallback_asset_id: asset.asset_id,
    asset_kind: 'prop',
    label: asset.label,
    job_type: 'prop_image',
    source_unit_id: `prop:${asset.asset_id}`,
    source_scene_ids: asset.source_scene_ids,
    source_shot_ids: uniqueStrings(sourceShots.map(shot => shot.shot_id)),
    prompt: cleanAssetPrompt([
      `${asset.label}关键道具设定参考图`,
      asset.usage_note,
      '单体清晰展示材质、形制、磨损与可辨识细节，背景简洁，供相关镜头保持道具一致性',
    ]),
    negative_constraints: negativeConstraints,
  };
}

function finalizeRequirement(
  seed: ImageRequirementSeed,
  seedanceByKey: Map<string, SeedanceAssetBindingItem>,
  mediaByAssetId: Map<string, AssetBinding>,
): StoryImageAssetRequirement {
  const seedanceAsset = seedanceByKey.get(assetLookupKey(seed.asset_kind, seed.label));
  const assetId = seedanceAsset?.asset_id ?? seed.fallback_asset_id;
  const mediaBinding = mediaByAssetId.get(assetId);
  return {
    schema_version: 'story-image-asset-requirement/v1',
    requirement_id: `image-requirement-${stableId(seed.asset_kind, assetId)}`,
    asset_id: assetId,
    asset_kind: seed.asset_kind,
    label: seed.label,
    job_type: seed.job_type,
    source_unit_id: seed.source_unit_id,
    reference_slot: seedanceAsset?.reference_slot,
    source_scene_ids: uniqueNumbers([
      ...seed.source_scene_ids,
      ...(seedanceAsset?.source_scene_ids ?? []),
    ]),
    source_shot_ids: uniqueStrings([
      ...seed.source_shot_ids,
      ...(seedanceAsset?.source_shot_ids ?? []),
    ]),
    prompt: seed.prompt,
    negative_constraints: uniqueStrings(seed.negative_constraints),
    binding_status: mediaBinding?.status ?? 'missing_artifact',
    provider_invoked: false,
    production_credit_granted: mediaBinding?.production_credit_granted ?? false,
  };
}

function assetLookupKey(kind: string, label: string): string {
  return `${kind}:${label.trim().toLocaleLowerCase('zh-CN')}`;
}

function stableId(kind: string, assetId: string): string {
  return `${kind}-${assetId}`
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function cleanAssetPrompt(parts: string[]): string {
  return parts
    .map(part => part
      .trim()
      .replace(/(?:质量信号|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|史实边界|知识库|用户大纲|生成优先级|资料显示|具体细节请核实来源|确证史实|确证史源|分析|应该|注意|TODO|待补)[:：]?/g, '')
      .replace(/\s{2,}/g, ' ')
    )
    .filter(Boolean)
    .join('；');
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, all) => value.trim().length > 0 && all.indexOf(value) === index);
}

function uniqueNumbers(values: number[]): number[] {
  return values.filter((value, index, all) => Number.isFinite(value) && all.indexOf(value) === index);
}
