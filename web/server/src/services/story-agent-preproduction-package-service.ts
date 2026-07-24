import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import type {
  AiComicSeriesSeedancePreproductionPackage,
  ApiResponse,
  SeedanceAssetLibraryItem,
  SeedancePromptPackage,
  StoryAgentSeedancePreproductionExportRequest,
  StoryAgentSeedancePreproductionImageAsset,
  StoryAgentSeedancePreproductionPackage,
  StoryAgentSeedancePreproductionShotAssetBinding,
  StoryAgentSeedancePreproductionStoryUnit,
  StoryGenerateResult,
  StoryProductionBoard,
  ProfessionalTextPackage,
} from '@shared/types.js';
import { ErrorCodes, fail, success } from '@shared/types.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import { getStory } from './story-service.js';
import { getProject, getProjectProductionBoard } from './project-service.js';
import { buildStoryProductionBoard } from './production-board-service.js';
import { buildSeedancePromptPackage } from './seedance-prompt-service.js';
import { exportAiComicSeriesSeedancePreproductionPackage } from './ai-comic-series-service.js';
import { buildProfessionalTextPackageForStory } from './professional-text-dispatch-service.js';

const BOUNDARY: StoryAgentSeedancePreproductionPackage['boundary'] = {
  story_agent_delivers: ['story', 'professional_script', 'seedance_prompt', 'image_asset'],
  video_generation_in_scope: false,
  video_generation_executor: 'user_in_seedance',
  human_test_required_for_functional_acceptance: false,
  rights_or_human_review_grants_production_credit: false,
};

interface PackageParts {
  source: StoryAgentSeedancePreproductionPackage['source'];
  storyUnits: StoryAgentSeedancePreproductionStoryUnit[];
  imageAssets: StoryAgentSeedancePreproductionImageAsset[];
  expectedStoryUnitCount: number;
  sourceBlockers: string[];
  sourceWarnings: string[];
  series?: StoryAgentSeedancePreproductionPackage['series'];
}

interface OrdinaryAssetCandidate {
  asset_id: string;
  kind: SeedanceAssetLibraryItem['kind'];
  label: string;
  reference_slot?: string;
  local_path?: string;
  content_sha256?: string;
  provider?: string;
  provider_asset_id?: string;
  prompt_sha256?: string;
  model?: string;
  source_story_ids: string[];
  source_shot_ids: string[];
  required_by_shot_count: number;
  rights_status?: SeedanceAssetLibraryItem['rights_status'];
  human_review_status?: SeedanceAssetLibraryItem['human_review_status'];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeErrorCode(code?: string): typeof ErrorCodes[keyof typeof ErrorCodes] {
  return Object.values(ErrorCodes).includes(code as typeof ErrorCodes[keyof typeof ErrorCodes])
    ? code as typeof ErrorCodes[keyof typeof ErrorCodes]
    : ErrorCodes.INTERNAL_ERROR;
}

async function verifyLocalImageAsset(input: {
  local_path?: string;
  content_sha256?: string;
}): Promise<{ local_path: string; content_sha256: string } | null> {
  const localPath = input.local_path?.trim();
  const declaredSha = input.content_sha256?.trim().toLowerCase();
  if (!localPath || !declaredSha?.match(/^[a-f0-9]{64}$/)) return null;

  const generatedRoot = resolve(storyGeneratedRoot());
  const filePath = isAbsolute(localPath) ? resolve(localPath) : resolve(generatedRoot, localPath);
  const relativePath = relative(generatedRoot, filePath);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) return null;

  try {
    const bytes = await readFile(filePath);
    const actualSha = createHash('sha256').update(bytes).digest('hex');
    return actualSha === declaredSha
      ? { local_path: localPath, content_sha256: actualSha }
      : null;
  } catch {
    return null;
  }
}

function storyPayload(story: StoryGenerateResult): StoryAgentSeedancePreproductionStoryUnit['story'] {
  return {
    title: story.title,
    logline: story.logline,
    theme: story.theme,
    full_text: story.full_text,
    scene_breakdown: story.scene_breakdown,
    gears_segments: story.gears_segments,
    cultural_constraints: story.cultural_constraints,
    credibility_note: story.credibility_note,
  };
}

function professionalTextPackageForStory(
  story: StoryGenerateResult,
): ProfessionalTextPackage | undefined {
  if (story.professional_text_package) return story.professional_text_package;
  try {
    return buildProfessionalTextPackageForStory(story);
  } catch {
    return undefined;
  }
}

function ordinaryBindings(input: {
  unitId: string;
  storyId: string;
  board: StoryProductionBoard;
  deliveredAssetIds: Set<string>;
  imageAssetIds: Set<string>;
}): StoryAgentSeedancePreproductionShotAssetBinding[] {
  const bindingByShotId = new Map(input.board.seedance_asset_report.shots.map(item => [item.shot_id, item]));
  return input.board.shot_units.map(shot => {
    const binding = bindingByShotId.get(shot.shot_id);
    const requiredImageSlots = shot.seedance_asset_slots.filter(slot => (
      slot.required && slot.modality === 'image'
    ));
    const requiredAssetIds = unique(requiredImageSlots.map(slot => slot.asset_id))
      .filter(assetId => input.imageAssetIds.has(assetId));
    const deliveredAssetIds = requiredAssetIds.filter(assetId => input.deliveredAssetIds.has(assetId));
    return {
      unit_id: input.unitId,
      story_id: input.storyId,
      shot_id: shot.shot_id,
      source_scene_id: shot.source_scene_id,
      required_asset_ids: requiredAssetIds,
      delivered_asset_ids: deliveredAssetIds,
      missing_asset_ids: requiredAssetIds.filter(assetId => !input.deliveredAssetIds.has(assetId)),
      reference_slots: unique([
        ...requiredImageSlots.map(slot => slot.reference_slot),
        ...(binding?.reference_slots ?? []),
      ]),
    };
  });
}

async function buildOrdinaryParts(input: {
  story: StoryGenerateResult;
  sourceKind: 'story' | 'story_project';
  sourceId: string;
  sourceTitle: string;
  board: StoryProductionBoard;
  assetLibraryItems: SeedanceAssetLibraryItem[];
}): Promise<PackageParts> {
  const promptPackage = buildSeedancePromptPackage(input.story);
  const libraryById = new Map(input.assetLibraryItems.map(item => [item.asset_id, item]));
  const requiredImageAssetIds = new Set(
    input.board.shot_units.flatMap(shot => (
      shot.seedance_asset_slots
        .filter(slot => slot.required && slot.modality === 'image')
        .map(slot => slot.asset_id)
    )),
  );
  const candidates: OrdinaryAssetCandidate[] = input.board.seedance_asset_report.assets
    .filter(asset => requiredImageAssetIds.has(asset.asset_id))
    .map(asset => {
      const libraryItem = libraryById.get(asset.asset_id);
      return {
        asset_id: asset.asset_id,
        kind: asset.kind,
        label: asset.label,
        reference_slot: asset.reference_slot,
        local_path: libraryItem?.local_path,
        content_sha256: libraryItem?.content_sha256,
        provider: libraryItem?.provider,
        provider_asset_id: libraryItem?.provider_asset_id,
        prompt_sha256: libraryItem?.prompt_sha256,
        model: libraryItem?.model,
        source_story_ids: [input.story.storyId],
        source_shot_ids: asset.source_shot_ids,
        required_by_shot_count: asset.required_by_shot_count,
        rights_status: libraryItem?.rights_status,
        human_review_status: libraryItem?.human_review_status,
      };
    });
  const imageAssets: StoryAgentSeedancePreproductionImageAsset[] = [];
  for (const candidate of candidates) {
    const integrity = await verifyLocalImageAsset(candidate);
    if (!integrity || !candidate.reference_slot) continue;
    imageAssets.push({
      asset_id: candidate.asset_id,
      source_kind: input.sourceKind,
      source_asset_id: candidate.asset_id,
      kind: candidate.kind,
      label: candidate.label,
      reference_slot: candidate.reference_slot,
      ...integrity,
      provider: candidate.provider,
      provider_asset_id: candidate.provider_asset_id,
      prompt_sha256: candidate.prompt_sha256,
      model: candidate.model,
      file_integrity_verified: true,
      source_story_ids: candidate.source_story_ids,
      source_shot_ids: candidate.source_shot_ids,
      required_by_shot_count: candidate.required_by_shot_count,
      rights_status: candidate.rights_status,
      human_review_status: candidate.human_review_status,
    });
  }
  const unitId = input.sourceKind === 'story_project' ? input.sourceId : input.story.storyId;
  const deliveredAssetIds = new Set(imageAssets.map(asset => asset.asset_id));
  const bindings = ordinaryBindings({
    unitId,
    storyId: input.story.storyId,
    board: input.board,
    deliveredAssetIds,
    imageAssetIds: requiredImageAssetIds,
  });
  const storyUnit: StoryAgentSeedancePreproductionStoryUnit = {
    unit_id: unitId,
    order: 1,
    title: input.story.title,
    story_id: input.story.storyId,
    project_id: input.story.project_id,
    professional_text_package: professionalTextPackageForStory(input.story),
    story: storyPayload(input.story),
    script: {
      shot_count: promptPackage.shot_units.length,
      total_duration_sec: promptPackage.total_duration_sec,
      shots: promptPackage.shot_units,
    },
    seedance_prompt_package: promptPackage,
    shot_asset_bindings: bindings,
  };
  return {
    source: {
      kind: input.sourceKind,
      source_id: input.sourceId,
      title: input.sourceTitle,
      story_ids: [input.story.storyId],
    },
    storyUnits: [storyUnit],
    imageAssets,
    expectedStoryUnitCount: 1,
    sourceBlockers: [],
    sourceWarnings: unique([
      ...(candidates.some(asset => asset.rights_status !== 'authorized')
        ? ['图片权利状态尚未全部授权；不影响功能验收，但正式商用前需处理。']
        : []),
      ...(candidates.some(asset => asset.human_review_status !== 'approved')
        ? ['真人媒体审核尚未全部完成；按当前产品边界不作为功能验收阻塞项。']
        : []),
    ]),
  };
}

async function buildSeriesParts(
  legacy: AiComicSeriesSeedancePreproductionPackage,
): Promise<PackageParts> {
  const imageAssets: StoryAgentSeedancePreproductionImageAsset[] = [];
  for (const asset of legacy.image_assets) {
    const integrity = await verifyLocalImageAsset(asset);
    if (!integrity || !asset.reference_slot) continue;
    const sourceStoryIds = unique(
      legacy.episodes
        .filter(episode => asset.source_episode_nos.includes(episode.episode_no))
        .map(episode => episode.story_id),
    );
    imageAssets.push({
      asset_id: asset.asset_id,
      source_kind: 'ai_comic_series_project',
      source_asset_id: asset.asset_id,
      series_identity_id: asset.series_identity_id,
      kind: asset.kind,
      label: asset.label,
      reference_slot: asset.reference_slot,
      ...integrity,
      provider: asset.provider,
      file_integrity_verified: true,
      source_story_ids: sourceStoryIds,
      source_shot_ids: asset.source_shot_ids,
      required_by_shot_count: asset.required_by_shot_count,
      rights_status: asset.rights_status,
      human_review_status: asset.human_review_status,
    });
  }
  const deliveredAssetIds = new Set(imageAssets.map(asset => asset.asset_id));
  const storyUnits: StoryAgentSeedancePreproductionStoryUnit[] = [];
  for (const episode of legacy.episodes) {
    const storyResult = await getStory(episode.story_id);
    const professionalTextPackage = storyResult.ok && storyResult.data
      ? professionalTextPackageForStory(storyResult.data)
      : undefined;
    const unitId = `episode-${episode.episode_no}`;
    storyUnits.push({
      unit_id: unitId,
      order: episode.episode_no,
      title: episode.episode_title,
      story_id: episode.story_id,
      episode_no: episode.episode_no,
      professional_text_package: professionalTextPackage,
      story: episode.story,
      script: episode.script,
      seedance_prompt_package: episode.seedance_prompt_package,
      shot_asset_bindings: episode.script.shots.map(shot => {
        const binding = episode.shot_asset_bindings.find(item => item.shot_id === shot.shot_id);
        const requiredAssetIds = unique(binding?.required_asset_ids ?? []);
        const delivered = requiredAssetIds.filter(assetId => deliveredAssetIds.has(assetId));
        return {
          unit_id: unitId,
          story_id: episode.story_id,
          shot_id: shot.shot_id,
          source_scene_id: shot.source_scene_id,
          required_asset_ids: requiredAssetIds,
          delivered_asset_ids: delivered,
          missing_asset_ids: requiredAssetIds.filter(assetId => !deliveredAssetIds.has(assetId)),
          reference_slots: unique(binding?.reference_slots ?? []),
        };
      }),
    });
  }
  return {
    source: {
      kind: 'ai_comic_series_project',
      source_id: legacy.project.series_project_id,
      title: legacy.series_title,
      story_ids: storyUnits.map(unit => unit.story_id),
    },
    storyUnits,
    imageAssets,
    expectedStoryUnitCount: legacy.acceptance.expected_episode_count,
    sourceBlockers: legacy.missing_episodes.length
      ? [`仍有 ${legacy.missing_episodes.length} 个故事单元未生成`]
      : [],
    sourceWarnings: legacy.acceptance.warnings,
    series: {
      project: legacy.project,
      visual_bible: legacy.visual_bible,
      missing_episodes: legacy.missing_episodes,
    },
  };
}

function buildAcceptance(
  parts: PackageParts,
): StoryAgentSeedancePreproductionPackage['acceptance'] {
  const shots = parts.storyUnits.flatMap(unit => unit.script.shots);
  const bindings = parts.storyUnits.flatMap(unit => unit.shot_asset_bindings);
  const professionalScriptCount = parts.storyUnits.filter(unit => unit.professional_text_package).length;
  const emptyScriptCount = shots.filter(shot => !shot.script_text.trim()).length;
  const emptyPromptCount = shots.filter(shot => !shot.seedance_prompt.trim()).length;
  const bindingKeys = new Set(bindings.map(binding => `${binding.unit_id}:${binding.shot_id}`));
  const missingBindingCount = parts.storyUnits.flatMap(unit => unit.script.shots.map(shot => ({
    unitId: unit.unit_id,
    shotId: shot.shot_id,
  }))).filter(item => !bindingKeys.has(`${item.unitId}:${item.shotId}`)).length;
  const requiredAssetIds = new Set(bindings.flatMap(binding => binding.required_asset_ids));
  const deliveredAssetIds = new Set(parts.imageAssets.map(asset => asset.asset_id));
  const currentAssetMappingCount = [...requiredAssetIds]
    .filter(assetId => deliveredAssetIds.has(assetId))
    .length;
  const unboundShotCount = bindings.filter(binding => (
    binding.required_asset_ids.length === 0 || binding.missing_asset_ids.length > 0
  )).length;
  const blockers = unique([
    ...parts.sourceBlockers,
    ...(parts.storyUnits.length !== parts.expectedStoryUnitCount
      ? [`故事单元不完整：${parts.storyUnits.length}/${parts.expectedStoryUnitCount}`]
      : []),
    ...(professionalScriptCount !== parts.storyUnits.length
      ? [`专业文本包不完整：${professionalScriptCount}/${parts.storyUnits.length}`]
      : []),
    ...(shots.length === 0 ? ['没有可交付的逐镜脚本'] : []),
    ...(emptyScriptCount ? [`${emptyScriptCount} 个镜头缺少剧本动作或对白`] : []),
    ...(emptyPromptCount ? [`${emptyPromptCount} 个镜头缺少 Seedance 提示词`] : []),
    ...(missingBindingCount ? [`${missingBindingCount} 个镜头缺少图片绑定记录`] : []),
    ...(requiredAssetIds.size === 0 ? ['逐镜脚本没有声明必需图片资产'] : []),
    ...(currentAssetMappingCount !== requiredAssetIds.size
      ? [`当前逐镜图片映射不完整：${currentAssetMappingCount}/${requiredAssetIds.size}`]
      : []),
    ...(unboundShotCount ? [`${unboundShotCount} 个镜头存在图片缺口`] : []),
  ]);
  return {
    status: blockers.length ? 'blocked' : 'ready',
    story_unit_count: parts.storyUnits.length,
    expected_story_unit_count: parts.expectedStoryUnitCount,
    professional_script_count: professionalScriptCount,
    script_shot_count: shots.length,
    seedance_prompt_shot_count: shots.length - emptyPromptCount,
    expected_image_asset_count: requiredAssetIds.size,
    image_asset_count: parts.imageAssets.length,
    file_integrity_verified_image_asset_count: parts.imageAssets.length,
    current_asset_mapping_count: currentAssetMappingCount,
    bound_shot_count: Math.max(0, bindings.length - unboundShotCount),
    unbound_shot_count: unboundShotCount,
    blockers,
    warnings: parts.sourceWarnings,
  };
}

function renderMarkdown(
  pkg: Omit<StoryAgentSeedancePreproductionPackage, 'markdown'>,
): string {
  const lines = [
    '# Story Agent → Seedance 通用前置制作交付包',
    '',
    `- 来源：${pkg.source.kind} / ${pkg.source.source_id}`,
    `- 标题：${pkg.source.title}`,
    `- 验收：${pkg.acceptance.status}`,
    `- 专业文本：${pkg.acceptance.professional_script_count}/${pkg.acceptance.story_unit_count}`,
    `- 逐镜脚本：${pkg.acceptance.script_shot_count}`,
    `- Seedance 提示词：${pkg.acceptance.seedance_prompt_shot_count}`,
    `- 已校验图片：${pkg.acceptance.image_asset_count}/${pkg.acceptance.expected_image_asset_count}`,
    '',
    '## 产品边界',
    '',
    '- Story Agent 交付故事、专业剧本、逐镜 Seedance 提示词与图片资产。',
    '- 视频生成不在本 Agent 范围内，由用户在 Seedance 中执行。',
    '- 人工测试、权利审核与真人媒体审核不作为功能验收阻塞项，也不会自动授予 production credit。',
  ];
  if (pkg.acceptance.blockers.length) {
    lines.push('', '## 阻塞项', '', ...pkg.acceptance.blockers.map(item => `- ${item}`));
  }
  if (pkg.acceptance.warnings.length) {
    lines.push('', '## 非阻塞提醒', '', ...pkg.acceptance.warnings.map(item => `- ${item}`));
  }
  for (const unit of pkg.story_units) {
    lines.push(
      '',
      `## ${unit.order}. ${unit.title}`,
      '',
      `- story_id：${unit.story_id}`,
      `- 专业文本包：${unit.professional_text_package?.package_id ?? '缺失'}`,
      `- 镜头数：${unit.script.shot_count}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export async function exportStoryAgentSeedancePreproductionPackage(
  request: StoryAgentSeedancePreproductionExportRequest,
): Promise<ApiResponse<StoryAgentSeedancePreproductionPackage>> {
  let parts: PackageParts;
  if (request.project_id) {
    const [detailResult, boardResult] = await Promise.all([
      getProject(request.project_id),
      getProjectProductionBoard(request.project_id),
    ]);
    if (!detailResult.ok || !detailResult.data || !boardResult.ok || !boardResult.data) {
      return fail(
        normalizeErrorCode(detailResult.error?.code ?? boardResult.error?.code),
        detailResult.error?.message ?? boardResult.error?.message ?? `Project "${request.project_id}" not found`,
      );
    }
    parts = await buildOrdinaryParts({
      story: detailResult.data.current_story,
      sourceKind: 'story_project',
      sourceId: request.project_id,
      sourceTitle: detailResult.data.project.title,
      board: boardResult.data,
      assetLibraryItems: detailResult.data.project.seedance_asset_library?.items ?? [],
    });
  } else if (request.story_id) {
    const storyResult = await getStory(request.story_id);
    if (!storyResult.ok || !storyResult.data) {
      return fail(
        normalizeErrorCode(storyResult.error?.code),
        storyResult.error?.message ?? `Story "${request.story_id}" not found`,
      );
    }
    const story = storyResult.data;
    parts = await buildOrdinaryParts({
      story,
      sourceKind: 'story',
      sourceId: story.storyId,
      sourceTitle: story.title,
      board: buildStoryProductionBoard(story),
      assetLibraryItems: [],
    });
  } else if (request.series_project_id) {
    const legacyResult = await exportAiComicSeriesSeedancePreproductionPackage(
      request.series_project_id,
    );
    if (!legacyResult.ok || !legacyResult.data) {
      return fail(
        normalizeErrorCode(legacyResult.error?.code),
        legacyResult.error?.message
          ?? `AI comic series project "${request.series_project_id}" not found`,
      );
    }
    parts = await buildSeriesParts(legacyResult.data);
  } else {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Exactly one of story_id, project_id, or series_project_id is required',
    );
  }

  const exportedAt = new Date().toISOString();
  const acceptance = buildAcceptance(parts);
  const basePackage: Omit<StoryAgentSeedancePreproductionPackage, 'markdown'> = {
    schema_version: 'story-agent-seedance-preproduction-package/v1',
    source: parts.source,
    exported_at: exportedAt,
    target_platform: 'seedance_2_0',
    boundary: BOUNDARY,
    acceptance,
    story_units: parts.storyUnits,
    image_assets: parts.imageAssets,
    series: parts.series,
  };
  return success({
    ...basePackage,
    markdown: renderMarkdown(basePackage),
  });
}
