import type {
  GearsCharacterAsset,
  GearsDeliveryPackage,
  GearsSceneAsset,
  GearsSegment,
  SeedanceAssetBindingItem,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
  SeedanceAssetReportPackage,
  SeedanceAssetUploadChecklistItem,
  SeedanceShotLedger,
  SeedanceShotLedgerItem,
  StoryGenerateResult,
  StoryProductionBoard,
  StoryProductionBoardDeliveryArtifact,
  StoryProductionBoardDeliveryManifest,
  StoryProductionBoardDeliveryStage,
  StoryProductionBoardDirectorPlan,
  StoryProductionBoardPropAsset,
  StoryProductionBoardQaReport,
  StoryProductionBoardRepairAction,
  StoryProductionBoardRepairPlan,
  StoryProductionBoardRepairPriority,
  StoryProductionBoardRepairTask,
  StoryProductionBoardShotUnit,
  StoryProductionBoardSupervisionIssue,
  StoryProductionBoardSupervisionReport,
  ProductionShot,
  MediaAssetLibrary,
} from '@shared/types.js';
import { ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { buildProductionShotPlan } from './production-shot-plan-service.js';
import { buildSeedancePromptPackage } from './seedance-prompt-service.js';
import { buildMediaAssetLibrary } from './media-asset-contract-service.js';
import { buildStoryImageAssetJobPlan } from './story-image-asset-job-service.js';

const DEFAULT_NEGATIVE_CONSTRAINTS = [
  '只呈现可见的人物、空间、道具、光线、动作和情绪',
  '不要出现现代无关物件、占位文本和不可见抽象概念',
  '保持时代服饰、人物外观、年龄状态和连续道具一致',
];

const DELIVERY_PROMPT_INTERNAL_PATTERN =
  /(质量信号|主角目标|目标明确|行动具体|因果链|史实边界|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|知识库|用户大纲|生成优先级|资料显示|摘要|核心画面是|为什么必须面对|具体细节请核实来源|不可写成|确证史实|确证史源|创作边界|治理痕迹|分析|应该|注意|TODO|待补)/;

export function buildStoryProductionBoard(
  story: StoryGenerateResult,
  options: {
    seedanceAssetLibrary?: SeedanceAssetLibrary;
    seedanceShotLedger?: SeedanceShotLedger;
    sourceVersionId?: string;
  } = {},
): StoryProductionBoard {
  const delivery = sanitizeDeliveryForProductionBoard(ensureGearsDeliveryPackage(story));
  const shotPlan = buildProductionShotPlan(story, delivery);
  const seedancePackage = buildSeedancePromptPackage(story);
  const seedanceByShotId = new Map(seedancePackage.shot_units.map(unit => [unit.shot_id, unit]));
  const shotUnits = buildShotUnits(story, delivery, shotPlan.shots, seedanceByShotId);
  const directorPlan = buildDirectorPlan(story);
  const propAssets = buildPropAssets(story);
  const costumeAssets = delivery.character_assets.map((asset, index) => ({
    asset_id: `costume-${index + 1}`,
    character_name: asset.name,
    clothing: asset.clothing,
    continuity_note: `${asset.name}在所有镜头中保持服装、发型、随身物件一致；如有年龄或状态变化，需要在分镜说明中显式交代。`,
  }));
  const continuityConstraints = buildContinuityConstraints(story, delivery);
  const supervisionReport = buildSupervisionReport(story, delivery, shotUnits);
  const repairPlan = buildRepairPlan(supervisionReport);
  const qaReport = buildQaReport(shotUnits, delivery.validation_notes, supervisionReport);
  const generatedAt = new Date().toISOString();
  const seedanceAssetReport = buildSeedanceAssetReport({
    story,
    shotUnits,
    generatedAt,
    assetLibrary: options.seedanceAssetLibrary,
  });
  const seedanceShotLedger = syncSeedanceShotLedgerWithShots({
    ledger: options.seedanceShotLedger,
    shotUnits,
    generatedAt,
  });
  const mediaAssetLibrary = buildMediaAssetLibrary({
    project_id: story.project_id ?? `${story.storyId}--${story.video_type}`,
    story_id: story.storyId,
    source_version_id: options.sourceVersionId,
    generated_at: generatedAt,
    seedance_asset_library: options.seedanceAssetLibrary,
    seedance_bindings: seedanceAssetReport.assets,
  });
  const imageAssetJobPlan = buildStoryImageAssetJobPlan({
    project_id: story.project_id ?? `${story.storyId}--${story.video_type}`,
    story_id: story.storyId,
    source_version_id: options.sourceVersionId,
    generated_at: generatedAt,
    character_assets: delivery.character_assets,
    location_assets: delivery.scene_assets,
    prop_assets: propAssets,
    shot_units: shotUnits,
    seedance_assets: seedanceAssetReport.assets,
    media_asset_library: mediaAssetLibrary,
    negative_constraints: DEFAULT_NEGATIVE_CONSTRAINTS,
  });
  const deliveryManifest = buildDeliveryManifest(
    shotUnits,
    supervisionReport,
    repairPlan,
    qaReport,
    seedanceAssetReport,
    mediaAssetLibrary,
  );
  const pkgWithoutMarkdown: Omit<StoryProductionBoard, 'markdown'> = {
    schema_version: 'story-production-board/v1',
    project_id: story.project_id,
    storyId: story.storyId,
    title: story.title,
    generated_at: generatedAt,
    character_assets: delivery.character_assets,
    location_assets: delivery.scene_assets,
    costume_assets: costumeAssets,
    prop_assets: propAssets,
    director_plan: directorPlan,
    shot_units: shotUnits,
    seedance_asset_report: seedanceAssetReport,
    media_asset_library: mediaAssetLibrary,
    image_asset_job_plan: imageAssetJobPlan,
    seedance_shot_ledger: seedanceShotLedger,
    continuity_constraints: continuityConstraints,
    negative_constraints: DEFAULT_NEGATIVE_CONSTRAINTS,
    supervision_report: supervisionReport,
    repair_plan: repairPlan,
    delivery_manifest: deliveryManifest,
    qa_report: qaReport,
  };
  return {
    ...pkgWithoutMarkdown,
    markdown: renderProductionBoardMarkdown(pkgWithoutMarkdown),
  };
}

function buildShotUnits(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage,
  shots: ProductionShot[],
  seedanceByShotId: Map<string, ReturnType<typeof buildSeedancePromptPackage>['shot_units'][number]>,
): StoryProductionBoardShotUnit[] {
  const sceneById = new Map(story.scene_breakdown.map(scene => [scene.scene_id, scene]));
  const deliveryUnitById = new Map(delivery.units.map(unit => [unit.unit_id, unit]));
  return shots.map(shot => {
    const scene = sceneById.get(shot.source_scene_id)!;
    const deliveryUnit = deliveryUnitById.get(shot.source_unit_id);
    const sceneDeliveryUnits = delivery.units.filter(item => item.source_scene_id === scene.scene_id);
    const sceneUnitIndex = sceneDeliveryUnits.findIndex(item => item.unit_id === shot.source_unit_id);
    const sceneSegments = story.gears_segments.filter(item => item.source_scene_id === scene.scene_id);
    const segment = sceneSegments[sceneUnitIndex]
      ?? (sceneDeliveryUnits.length === 1 ? sceneSegments[0] : undefined);
    const seedanceUnit = seedanceByShotId.get(shot.shot_id);
    const scriptText = cleanDeliveryScriptText(segment?.script_text || deliveryUnit?.script_text || scene.dialogue_or_narration || scene.key_action || scene.plot);
    const originalVisualPrompt = deliveryUnit?.visual_prompt || scene.visual_prompt;
    const visualPrompt = cleanPrompt(originalVisualPrompt);
    const cameraSuggestion = cleanPrompt(scene.camera_suggestion);
    const continuityNotes = [
      scene.cultural_note,
      scene.factual_basis,
      ...(scene.fictionalized_elements?.map(item => `戏剧化补足：${item}`) ?? []),
      ...(segment?.cultural_constraints ?? []),
    ]
      .map(note => cleanProductionBoundaryNote(note ?? ''))
      .filter((note): note is string => Boolean(note));
    const seedancePrompt = cleanSeedancePrompt(seedanceUnit?.seedance_prompt ?? buildFallbackSeedancePrompt({
      durationSec: Math.max(4, Math.min(15, Math.round(deliveryUnit?.suggested_duration_sec ?? scene.duration_sec ?? 8))),
      location: scene.location,
      characters: scene.characters ?? [],
      scriptText,
      visualPrompt,
      cameraSuggestion,
    }));
    const seedanceAssetSlots = seedanceUnit?.asset_slots ?? [];
    const seedanceMaterialValidation = seedanceUnit?.material_validation ?? fallbackSeedanceMaterialValidation({
      durationSec: seedanceUnit?.duration_sec ?? Math.max(4, Math.min(15, Math.round(scene.duration_sec || 8))),
      characters: scene.characters ?? [],
      location: scene.location,
    });
    const productionPrompt = buildProductionPrompt({
      location: scene.location,
      characters: scene.characters ?? [],
      visualPrompt,
      cameraSuggestion,
      segmentPromptHint: deliveryUnit?.segment_prompt_hint ? cleanPrompt(deliveryUnit.segment_prompt_hint) : segment?.segment_prompt_hint ? cleanPrompt(segment.segment_prompt_hint) : undefined,
    });
    const qaFlags = [
      ...shotQaFlags({
        scriptText,
        visualPrompt,
        originalVisualPrompt,
        cameraSuggestion,
        productionPrompt,
        seedancePrompt,
        characters: scene.characters ?? [],
        location: scene.location,
        segment,
      }),
      ...seedanceMaterialValidation.warnings.map(warning => `Seedance 素材校验：${warning}`),
    ];
    return {
      shot_id: shot.shot_id,
      source_scene_id: scene.scene_id,
      source_unit_id: shot.source_unit_id,
      source_segment_id: segment?.segment_id,
      duration_sec: deliveryUnit?.suggested_duration_sec ?? segment?.duration_sec ?? scene.duration_sec,
      panel_count: deliveryUnit?.suggested_panel_count ?? segment?.panel_count ?? 6,
      characters: scene.characters ?? [],
      location: scene.location,
      script_text: scriptText,
      visual_prompt: visualPrompt,
      camera_suggestion: cameraSuggestion,
      production_prompt: productionPrompt,
      seedance_prompt: seedancePrompt,
      seedance_duration_sec: seedanceUnit?.duration_sec ?? Math.max(4, Math.min(15, Math.round(scene.duration_sec || 8))),
      seedance_validation_notes: seedanceUnit
        ? seedanceMaterialValidation.warnings
        : ['未找到对应 Seedance 单元，已使用 Production Board 兜底提示词。'],
      seedance_asset_slots: seedanceAssetSlots,
      seedance_material_validation: seedanceMaterialValidation,
      continuity_notes: continuityNotes,
      cultural_boundary: buildShotCulturalBoundary(scene),
      negative_constraints: DEFAULT_NEGATIVE_CONSTRAINTS,
      qa_flags: qaFlags,
    };
  });
}

function sanitizeDeliveryForProductionBoard(delivery: GearsDeliveryPackage): GearsDeliveryPackage {
  return {
    ...delivery,
    character_assets: delivery.character_assets.map(cleanCharacterAsset),
    scene_assets: delivery.scene_assets.map(cleanSceneAsset),
    validation_notes: delivery.validation_notes.map(cleanProductionBoundaryNote).filter(Boolean),
  };
}

function cleanCharacterAsset(asset: GearsCharacterAsset): GearsCharacterAsset {
  return {
    ...asset,
    appearance_features: cleanProductionAssetDescription(asset.appearance_features) || cleanProductionBoundaryNote(asset.appearance_features),
    clothing: cleanProductionBoundaryNote(asset.clothing),
    carried_props: asset.carried_props ? cleanProductionBoundaryNote(asset.carried_props) : asset.carried_props,
    signature_objects: asset.signature_objects ? cleanProductionBoundaryNote(asset.signature_objects) : asset.signature_objects,
    background_oneliner: asset.background_oneliner
      ? cleanProductionAssetDescription(asset.background_oneliner) || cleanProductionBoundaryNote(asset.background_oneliner)
      : asset.background_oneliner,
  };
}

function cleanSceneAsset(asset: GearsSceneAsset): GearsSceneAsset {
  return {
    ...asset,
    description: cleanProductionAssetDescription(asset.description) || cleanProductionBoundaryNote(cleanDeliveryScriptText(asset.description)),
    environment_props: asset.environment_props ? cleanProductionAssetDescription(asset.environment_props) || cleanProductionBoundaryNote(asset.environment_props) : asset.environment_props,
  };
}

function cleanProductionAssetDescription(value: string): string {
  const cleaned = cleanProductionBoundaryNote(cleanDeliveryScriptText(value));
  const parts = cleaned
    .split(/[；;]/)
    .map(part => part.trim())
    .filter(part =>
      part
      && !/^(事实锚点|创作处理|来源材料|素材包|用户素材|思想文化影响|地方化关系)[:：]?/.test(part)
      && !/(基于|来自|可作为|进行场景化|进行象征化|创作场景|创作处理|来源材料|用户素材|素材包|文化阐释|相关地点|地方化关系|思想文化影响|片尾说清|不把|不可写成|确定事实|确定来源|需由供稿侧补充)/.test(part)
    );
  return uniqueStrings(parts).join('；').trim();
}

function buildDirectorPlan(story: StoryGenerateResult): StoryProductionBoardDirectorPlan[] {
  return story.scene_breakdown.map((scene, index) => ({
    scene_id: scene.scene_id,
    dramatic_purpose: cleanProductionBoundaryNote(scene.dramatic_function || scene.conflict || '推进本场戏剧目标'),
    emotion_turn: scene.conflict
      ? cleanDeliveryScriptText(`${scene.conflict} -> ${scene.key_action}`)
      : cleanDeliveryScriptText(scene.key_action),
    camera_logic: cleanPrompt(scene.camera_suggestion) || '用稳定镜头建立空间，再以中近景承接人物动作。',
    transition_hint: index === story.scene_breakdown.length - 1
      ? '收束到主题余味或下一集钩子。'
      : `承接到场景 ${story.scene_breakdown[index + 1]?.scene_id}：${story.scene_breakdown[index + 1]?.title}`,
  }));
}

function buildPropAssets(story: StoryGenerateResult): StoryProductionBoardPropAsset[] {
  const propMap = new Map<string, Set<number>>();
  const candidates = ['案卷', '文书', '判词', '毛笔', '书信', '旧信', '印章', '石碑', '莲', '灯', '伞', '铜铃', '香炉'];
  for (const scene of story.scene_breakdown) {
    const text = [
      scene.title,
      scene.plot,
      scene.key_action,
      scene.visual_prompt,
      scene.dialogue_or_narration,
    ].join(' ');
    for (const prop of candidates) {
      if (!text.includes(prop)) continue;
      if (!propMap.has(prop)) propMap.set(prop, new Set());
      propMap.get(prop)?.add(scene.scene_id);
    }
  }
  return [...propMap.entries()].map(([label, sceneIds], index) => ({
    asset_id: `prop-${index + 1}`,
    label,
    source_scene_ids: [...sceneIds].sort((a, b) => a - b),
    usage_note: `${label}需要在相关镜头中保持外观一致，并作为动作或线索服务剧情。`,
  }));
}

function buildContinuityConstraints(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage,
): string[] {
  return [
    ...delivery.character_assets.map(asset => `${asset.name}: ${asset.appearance_features}；服装：${asset.clothing}`),
    ...delivery.scene_assets.map(asset => `${asset.name}: ${asset.description}`),
    ...(story.cultural_constraints ?? []),
  ]
    .map(cleanProductionBoundaryNote)
    .filter(Boolean);
}

function buildQaReport(
  shotUnits: StoryProductionBoardShotUnit[],
  validationNotes: string[],
  supervisionReport: StoryProductionBoardSupervisionReport,
): StoryProductionBoardQaReport {
  const missingShotAnchors = shotUnits
    .filter(unit => unit.characters.length === 0 || !unit.location)
    .map(unit => unit.shot_id);
  const missingSeedanceSlots = shotUnits.flatMap(unit =>
    unit.seedance_material_validation.missing_required_slots.map(slot => `${unit.shot_id}: ${slot}`),
  );
  const missingAssetRefs = [...missingShotAnchors, ...missingSeedanceSlots];
  const promptPollutionFlags = shotUnits.flatMap(unit =>
    unit.qa_flags
      .filter(flag => flag.includes('提示待清理'))
      .map(flag => `${unit.shot_id}: ${flag}`),
  );
  const continuityRisks = shotUnits.flatMap(unit =>
    unit.qa_flags
      .filter(flag => flag.includes('连续性'))
      .map(flag => `${unit.shot_id}: ${flag}`),
  );
  const issues = [
    ...validationNotes,
    ...shotUnits.flatMap(unit => unit.qa_flags.map(flag => `${unit.shot_id}: ${flag}`)),
    ...supervisionReport.issues.map(issue => `${issue.source_shot_id ?? 'board'}: ${issue.title} - ${issue.detail}`),
  ];
  const score = Math.min(
    supervisionReport.score,
    Math.max(0, 100 - issues.length * 8 - missingAssetRefs.length * 10),
  );
  return {
    passed: score >= 75 && missingAssetRefs.length === 0 && supervisionReport.passed,
    score,
    issues,
    missing_asset_refs: missingAssetRefs,
    prompt_pollution_flags: promptPollutionFlags,
    continuity_risks: continuityRisks,
  };
}

function buildSeedanceAssetReport(input: {
  story: StoryGenerateResult;
  shotUnits: StoryProductionBoardShotUnit[];
  generatedAt: string;
  assetLibrary?: SeedanceAssetLibrary;
}): SeedanceAssetReportPackage {
  const libraryByAssetId = new Map((input.assetLibrary?.items ?? []).map(item => [item.asset_id, item]));
  const libraryByKey = new Map((input.assetLibrary?.items ?? []).map(item => [seedanceAssetLookupKey(item.kind, item.label), item]));
  const assets = new Map<string, SeedanceAssetBindingItem>();
  const shots = input.shotUnits.map(unit => {
    for (const slot of unit.seedance_asset_slots) {
      const libraryItem = libraryByAssetId.get(slot.asset_id)
        ?? libraryByKey.get(seedanceAssetLookupKey(slot.kind, slot.label));
      const referenceSlot = slot.reference_slot || libraryItem?.reference_slot;
      upsertSeedanceAssetBinding(assets, {
        asset_id: slot.asset_id,
        label: slot.label,
        kind: slot.kind,
        modality: slot.modality,
        role: slot.role,
        reference_slot: referenceSlot,
        file_url: libraryItem?.file_url,
        file_id: libraryItem?.file_id,
        local_path: libraryItem?.local_path,
        original_filename: libraryItem?.original_filename,
        mime_type: libraryItem?.mime_type,
        size_bytes: libraryItem?.size_bytes,
        provider: libraryItem?.provider,
        provider_asset_id: libraryItem?.provider_asset_id,
        upload_status: libraryItem?.upload_status,
        upload_error: libraryItem?.upload_error,
        prompt_usage: slot.prompt_usage ?? libraryItem?.description,
        source_scene_ids: [unit.source_scene_id],
        source_shot_ids: [unit.shot_id],
        required_by_shot_count: 1,
        ...seedanceBindingState(referenceSlot, libraryItem),
      });
    }
    const requiredAssetIds = uniqueStrings(unit.seedance_asset_slots.map(slot => slot.asset_id));
    const missingAssetIds = uniqueStrings(unit.seedance_asset_slots
      .filter(slot => {
        const libraryItem = libraryByAssetId.get(slot.asset_id)
          ?? libraryByKey.get(seedanceAssetLookupKey(slot.kind, slot.label));
        return seedanceBindingState(slot.reference_slot || libraryItem?.reference_slot, libraryItem).status !== 'bound';
      })
      .map(slot => slot.asset_id));
    return {
      shot_id: unit.shot_id,
      source_scene_id: unit.source_scene_id,
      required_asset_ids: requiredAssetIds,
      missing_asset_ids: missingAssetIds,
      reference_slots: uniqueStrings(unit.seedance_asset_slots.map(slot => slot.reference_slot).filter(Boolean)),
      prompt_preview: summarizeText(unit.seedance_prompt, 120),
    };
  });
  const assetList = [...assets.values()].sort((a, b) => {
    const statusWeight: Record<SeedanceAssetBindingItem['status'], number> = {
      missing_reference_slot: 0,
      missing_file: 1,
      bound: 2,
    };
    if (a.status !== b.status) return statusWeight[a.status] - statusWeight[b.status];
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.label.localeCompare(b.label, 'zh-CN');
  });
  const placeholderAssetCount = assetList.filter(asset => asset.is_placeholder).length;
  const basePackage: Omit<SeedanceAssetReportPackage, 'markdown'> = {
    schema_version: 'seedance-asset-report/v1',
    project_id: input.story.project_id,
    storyId: input.story.storyId,
    title: input.story.title,
    generated_at: input.generatedAt,
    total_asset_count: assetList.length,
    missing_reference_slot_count: assetList.filter(asset => !asset.has_reference_slot).length,
    upload_required_count: assetList.filter(asset => asset.needs_upload).length,
    placeholder_asset_count: placeholderAssetCount,
    production_asset_ready_count: assetList.filter(asset => asset.is_bound && !asset.is_placeholder).length,
    shot_binding_count: shots.length,
    unbound_shot_count: shots.filter(shot => shot.missing_asset_ids.length > 0).length,
    upload_checklist: buildSeedanceAssetUploadChecklist(assetList),
    assets: assetList,
    shots,
  };
  return {
    ...basePackage,
    markdown: renderSeedanceAssetReportMarkdown(basePackage),
  };
}

function buildSeedanceAssetUploadChecklist(
  assets: SeedanceAssetBindingItem[],
): SeedanceAssetUploadChecklistItem[] {
  return assets
    .filter(asset => asset.needs_upload || asset.status !== 'bound')
    .map(asset => ({
      asset_id: asset.asset_id,
      reference_slot: asset.reference_slot,
      label: asset.label,
      kind: asset.kind,
      modality: asset.modality,
      role: asset.role,
      status: asset.status,
      needs_upload: asset.needs_upload,
      affected_shot_ids: asset.source_shot_ids,
      affected_scene_ids: asset.source_scene_ids,
      suggested_filename: seedanceSuggestedAssetFilename(asset),
      checklist_note: seedanceAssetChecklistNote(asset),
      acceptance_criteria: seedanceAssetAcceptanceCriteria(asset),
    }));
}

function seedanceSuggestedAssetFilename(asset: SeedanceAssetBindingItem): string {
  const slot = (asset.reference_slot ?? 'asset').replace(/^@/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-');
  const label = asset.label.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  const ext = asset.modality === 'audio' ? 'mp3' : asset.modality === 'video' ? 'mp4' : 'png';
  return `${slot}-${seedanceAssetKindLabel(asset.kind)}-${label || asset.asset_id}.${ext}`;
}

function seedanceAssetChecklistNote(asset: SeedanceAssetBindingItem): string {
  if (asset.status === 'missing_reference_slot') {
    return '先分配平台引用槽位，再绑定对应素材文件。';
  }
  if (asset.modality === 'image') {
    if (asset.kind === 'character') return '准备稳定人物形象参考，保持服饰、发型、年龄状态和随身物件一致。';
    if (asset.kind === 'location') return '准备场景氛围参考，突出空间结构、时代环境、主要道具、光线和色调。';
    return '准备道具外观参考，突出形状、材质、尺寸感和跨镜头一致性。';
  }
  if (asset.modality === 'video') return '准备运镜或动作节奏参考，只作为节奏和镜头运动参考。';
  return '准备音乐或环境声参考，只作为情绪、节奏和声场参考。';
}

function seedanceAssetAcceptanceCriteria(asset: SeedanceAssetBindingItem): string[] {
  const common = [
    `${asset.reference_slot ?? '引用槽位'} 已能在 Seedance prompt 中被稳定引用`,
    `覆盖镜头：${asset.source_shot_ids.join('、') || '未记录'}`,
  ];
  if (asset.kind === 'character') {
    return [
      ...common,
      '人物外观、服饰、发型和年龄状态与 Production Board 角色资产一致',
      '不使用可识别真人脸照片作为参考',
    ];
  }
  if (asset.kind === 'location') {
    return [
      ...common,
      '场景空间、时代氛围、主要陈设和光线与镜头提示一致',
      '不混入无关现代物件或跨时代环境',
    ];
  }
  if (asset.kind === 'prop') {
    return [
      ...common,
      '道具外观、材质和尺寸感清楚，能在相关镜头中复用',
    ];
  }
  if (asset.kind === 'camera') {
    return [
      ...common,
      '只参考镜头运动、节奏和动作衔接，不替代人物或场景素材',
    ];
  }
  return [
    ...common,
    '只参考音乐、音效或环境声情绪，不替代对白和画面内容',
  ];
}

export function syncSeedanceShotLedgerWithShots(input: {
  ledger?: SeedanceShotLedger;
  shotUnits: StoryProductionBoardShotUnit[];
  generatedAt: string;
}): SeedanceShotLedger {
  const normalizedItems = normalizeSeedanceShotLedger(input.ledger).items;
  const map = new Map(normalizedItems.map(item => [item.production_id, item]));
  const firstCanonicalShotByScene = new Map<number, string>();
  for (const unit of input.shotUnits) {
    if (!firstCanonicalShotByScene.has(unit.source_scene_id)) {
      firstCanonicalShotByScene.set(unit.source_scene_id, unit.shot_id);
    }
  }
  const legacyItemByCanonicalShotId = new Map<string, SeedanceShotLedgerItem>();
  for (const item of normalizedItems) {
    const sceneMatch = /^shot-(\d+)$/.exec(item.shot_id);
    if (!sceneMatch) continue;
    const sceneId = Number(sceneMatch[1]);
    const canonicalShotId = firstCanonicalShotByScene.get(sceneId);
    if (!canonicalShotId || canonicalShotId === item.shot_id) continue;
    legacyItemByCanonicalShotId.set(canonicalShotId, item);
  }
  const currentProductionIds = new Set<string>();
  for (const unit of input.shotUnits) {
    const productionId = seedanceShotProductionId(unit.shot_id);
    currentProductionIds.add(productionId);
    const legacy = legacyItemByCanonicalShotId.get(unit.shot_id);
    const existing = map.get(productionId) ?? legacy;
    map.set(productionId, {
      production_id: productionId,
      shot_id: unit.shot_id,
      source_scene_id: unit.source_scene_id,
      status: existing?.status && existing.status !== 'not_started' ? existing.status : 'prompt_exported',
      prompt_exported_at: existing?.prompt_exported_at ?? input.generatedAt,
      submitted_at: existing?.submitted_at,
      completed_at: existing?.completed_at,
      updated_at: existing?.updated_at ?? input.generatedAt,
      provider: existing?.provider,
      provider_job_id: existing?.provider_job_id,
      provider_queue_id: existing?.provider_queue_id,
      provider_queue_position: existing?.provider_queue_position,
      video_url: existing?.video_url,
      failure_reason: existing?.failure_reason,
      failure_category: existing?.failure_category,
      provider_error_code: existing?.provider_error_code,
      retry_count: existing?.retry_count ?? 0,
      notes: existing?.notes?.length
        ? uniqueStrings([
            ...existing.notes,
            ...(legacy ? [`从 v1 场景镜头 ${legacy.shot_id} 确定性迁移到 ${unit.shot_id}`] : []),
          ]).slice(-12)
        : [`提示词已生成：${input.generatedAt}`],
      versions: normalizeSeedanceShotVideoVersions(existing),
      selected_version_id: existing?.selected_version_id,
    });
  }
  return {
    schema_version: 'seedance-shot-ledger/v1',
    updated_at: input.ledger?.updated_at ?? input.generatedAt,
    items: [...map.values()]
      .filter(item => currentProductionIds.has(item.production_id))
      .sort((a, b) =>
        (a.source_scene_id ?? 0) - (b.source_scene_id ?? 0)
        || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN')
      ),
  };
}

function normalizeSeedanceShotLedger(ledger?: SeedanceShotLedger): SeedanceShotLedger {
  return {
    schema_version: 'seedance-shot-ledger/v1',
    updated_at: ledger?.updated_at,
    items: (ledger?.items ?? [])
      .filter(item => item.shot_id?.trim())
      .map(item => ({
        ...item,
        production_id: item.production_id || seedanceShotProductionId(item.shot_id),
        shot_id: item.shot_id.trim(),
        status: item.status ?? 'not_started',
        updated_at: item.updated_at ?? ledger?.updated_at ?? new Date(0).toISOString(),
        retry_count: item.retry_count ?? 0,
        notes: uniqueStrings(item.notes ?? []).slice(-12),
        versions: normalizeSeedanceShotVideoVersions(item),
      })),
  };
}

function normalizeSeedanceShotVideoVersions(
  item?: Partial<SeedanceShotLedgerItem>,
): SeedanceShotLedgerItem['versions'] {
  return (item?.versions ?? []).map(version => ({
    ...version,
    version_id: version.version_id,
    status: version.status,
    created_at: version.created_at,
  }));
}

export function seedanceShotProductionId(shotId: string): string {
  const slug = shotId.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  return `seedance-shot-${slug || 'shot'}`;
}

function seedanceBindingState(
  referenceSlot?: string,
  libraryItem?: SeedanceAssetLibraryItem,
): Pick<SeedanceAssetBindingItem, 'has_reference_slot' | 'is_bound' | 'is_placeholder' | 'needs_upload' | 'status'> {
  const hasReferenceSlot = Boolean(referenceSlot?.trim());
  const hasUploadedProviderAsset = libraryItem?.upload_status === 'uploaded' || libraryItem?.upload_status === 'external';
  const isBound = hasReferenceSlot && Boolean(
    libraryItem?.file_url
    || libraryItem?.file_id
    || libraryItem?.local_path
    || libraryItem?.provider_asset_id
    || hasUploadedProviderAsset
  );
  return {
    has_reference_slot: hasReferenceSlot,
    is_bound: isBound,
    is_placeholder: isBound && isSeedancePlaceholderAsset(libraryItem),
    needs_upload: !isBound,
    status: isBound ? 'bound' : hasReferenceSlot ? 'missing_file' : 'missing_reference_slot',
  };
}

function isSeedancePlaceholderAsset(
  asset?: Pick<SeedanceAssetLibraryItem | SeedanceAssetBindingItem, 'provider' | 'provider_asset_id' | 'local_path' | 'original_filename' | 'mime_type'>,
): boolean {
  if (!asset) return false;
  return asset.provider === 'story_agent_placeholder'
    || asset.provider_asset_id?.startsWith('story-agent-placeholder:') === true
    || asset.local_path?.includes('/seedance-assets/placeholder-') === true
    || asset.original_filename?.startsWith('placeholder-') === true
    || (asset.mime_type === 'image/svg+xml' && asset.local_path?.includes('/seedance-assets/') === true);
}

function upsertSeedanceAssetBinding(
  assets: Map<string, SeedanceAssetBindingItem>,
  next: SeedanceAssetBindingItem,
): void {
  const existing = assets.get(next.asset_id);
  if (!existing) {
    assets.set(next.asset_id, {
      ...next,
      source_scene_ids: uniqueNumbers(next.source_scene_ids),
      source_shot_ids: uniqueStrings(next.source_shot_ids),
    });
    return;
  }
  const referenceSlot = existing.reference_slot ?? next.reference_slot;
  const fileUrl = existing.file_url ?? next.file_url;
  const fileId = existing.file_id ?? next.file_id;
  const localPath = existing.local_path ?? next.local_path;
  const originalFilename = existing.original_filename ?? next.original_filename;
  const mimeType = existing.mime_type ?? next.mime_type;
  const sizeBytes = existing.size_bytes ?? next.size_bytes;
  const provider = existing.provider ?? next.provider;
  const providerAssetId = existing.provider_asset_id ?? next.provider_asset_id;
  const uploadStatus = existing.upload_status ?? next.upload_status;
  const uploadError = existing.upload_error ?? next.upload_error;
  const isPlaceholder = isSeedancePlaceholderAsset({
    provider,
    provider_asset_id: providerAssetId,
    local_path: localPath,
    original_filename: originalFilename,
    mime_type: mimeType,
  });
  const hasReferenceSlot = existing.has_reference_slot || next.has_reference_slot;
  const isBound = hasReferenceSlot && Boolean(
    fileUrl
    || fileId
    || localPath
    || providerAssetId
    || uploadStatus === 'uploaded'
    || uploadStatus === 'external'
  );
  const sourceShotIds = uniqueStrings([...existing.source_shot_ids, ...next.source_shot_ids]);
  assets.set(next.asset_id, {
    ...existing,
    reference_slot: referenceSlot,
    file_url: fileUrl,
    file_id: fileId,
    local_path: localPath,
    original_filename: originalFilename,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    provider,
    provider_asset_id: providerAssetId,
    upload_status: uploadStatus,
    upload_error: uploadError,
    prompt_usage: existing.prompt_usage ?? next.prompt_usage,
    source_scene_ids: uniqueNumbers([...existing.source_scene_ids, ...next.source_scene_ids]),
    source_shot_ids: sourceShotIds,
    required_by_shot_count: sourceShotIds.length,
    has_reference_slot: hasReferenceSlot,
    is_bound: isBound,
    is_placeholder: isBound && isPlaceholder,
    needs_upload: !isBound,
    status: isBound ? 'bound' : hasReferenceSlot ? 'missing_file' : 'missing_reference_slot',
  });
}

function renderSeedanceAssetReportMarkdown(pkg: Omit<SeedanceAssetReportPackage, 'markdown'>): string {
  const lines = [
    `# ${pkg.title} Seedance 素材缺口报告`,
    '',
    `- 项目 ID: ${pkg.project_id ?? '未记录'}`,
    `- 故事 ID: ${pkg.storyId}`,
    `- 生成时间: ${pkg.generated_at}`,
    `- 素材总数: ${pkg.total_asset_count}`,
    `- 待上传文件: ${pkg.upload_required_count}`,
    `- 占位参考图: ${pkg.placeholder_asset_count}`,
    `- 正式素材 ready: ${pkg.production_asset_ready_count}`,
    `- 缺引用槽位: ${pkg.missing_reference_slot_count}`,
    `- 受影响镜头: ${pkg.unbound_shot_count}/${pkg.shot_binding_count}`,
    ...(pkg.placeholder_asset_count > 0
      ? [`- 注意: ${pkg.placeholder_asset_count} 个 story_agent_placeholder 只表示结构化绑定，正式投产前仍需替换为真实视觉素材。`]
      : []),
    '',
    '## 上传清单',
    ...(pkg.upload_checklist.length ? pkg.upload_checklist.map(item => [
      `- ${item.reference_slot ?? '未分配槽位'} · ${seedanceAssetKindLabel(item.kind)}「${item.label}」 · ${item.suggested_filename}`,
      `  - 状态: ${seedanceAssetBindingStatusLabel(item.status)}；影响镜头: ${item.affected_shot_ids.join('、') || '无'}`,
      `  - 准备说明: ${item.checklist_note}`,
      `  - 验收: ${item.acceptance_criteria.join('；')}`,
    ]).flat() : ['- 无需上传']),
    '',
    '## 素材状态',
    ...(pkg.assets.length ? pkg.assets.map(asset => [
      `- [${seedanceAssetBindingStatusLabel(asset.status)}] ${asset.reference_slot ?? '未分配槽位'} · ${seedanceAssetKindLabel(asset.kind)}「${asset.label}」`,
      `  - 用途: ${seedanceAssetRoleLabel(asset.role)}；格式: ${asset.modality}；镜头: ${asset.source_shot_ids.join('、') || '无'}；使用次数: ${asset.required_by_shot_count}`,
      asset.is_placeholder ? '  - 占位素材: 是；仅用于结构化链路验收，正式投产前需替换。' : '',
      asset.original_filename ? `  - 文件: ${asset.original_filename}${asset.size_bytes ? `；大小: ${asset.size_bytes} bytes` : ''}` : '',
      asset.provider_asset_id ? `  - Provider 素材: ${asset.provider ?? 'unknown'} / ${asset.provider_asset_id}` : '',
      asset.upload_status ? `  - 上传状态: ${asset.upload_status}${asset.upload_error ? `；错误: ${asset.upload_error}` : ''}` : '',
      asset.prompt_usage ? `  - 提示词用途: ${asset.prompt_usage}` : '',
    ].filter(Boolean)).flat() : ['- 无']),
    '',
    '## 镜头缺口',
    ...(pkg.shots.length ? pkg.shots.map(shot => [
      `- ${shot.shot_id} / 场景 ${shot.source_scene_id}: ${shot.missing_asset_ids.length ? `缺 ${shot.missing_asset_ids.length} 个素材文件` : '素材已绑定'}`,
      `  - slots: ${shot.reference_slots.join('、') || '无'}`,
      `  - prompt: ${shot.prompt_preview}`,
    ]).flat() : ['- 无']),
    '',
  ];
  return lines.join('\n');
}

function seedanceAssetLookupKey(kind: SeedanceAssetBindingItem['kind'], label: string): string {
  return `${kind}:${label.trim().toLowerCase()}`;
}

function shotQaFlags(input: {
  scriptText: string;
  visualPrompt: string;
  originalVisualPrompt?: string;
  cameraSuggestion: string;
  productionPrompt: string;
  seedancePrompt: string;
  characters: string[];
  location: string;
  segment?: GearsSegment;
}): string[] {
  const flags: string[] = [];
  if (!input.scriptText.trim()) flags.push('缺少 script_text');
  if (!input.visualPrompt.trim()) flags.push('缺少 visual_prompt');
  if (!input.cameraSuggestion.trim()) flags.push('缺少 camera_suggestion');
  if (input.characters.length === 0) flags.push('缺少角色资产引用');
  if (!input.location.trim()) flags.push('缺少场景资产引用');
  if (hasPromptPollution(`${input.originalVisualPrompt ?? ''} ${input.visualPrompt}`)) {
    flags.push('画面提示待清理：画面提示含不可见制作说明');
  }
  if (hasPromptPollution(input.productionPrompt)) {
    flags.push('生产提示待清理：生产提示含不可见制作说明');
  }
  if (hasPromptPollution(input.seedancePrompt)) {
    flags.push('Seedance 提示待清理：视频提示含不可见制作说明');
  }
  if (!input.segment?.segment_prompt_hint) flags.push('连续性风险：缺少 segment_prompt_hint');
  return flags;
}

function buildSupervisionReport(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage,
  shotUnits: StoryProductionBoardShotUnit[],
): StoryProductionBoardSupervisionReport {
  const issues: StoryProductionBoardSupervisionIssue[] = [];
  const knownCharacters = new Set(delivery.character_assets.map(asset => asset.name));
  const knownLocations = new Set(delivery.scene_assets.map(asset => asset.name));
  const expectedPeriod = inferExpectedPeriod(story);

  for (const unit of shotUnits) {
    if (unit.characters.length === 0) {
      issues.push(supervisionIssue({
        category: 'asset',
        severity: 'blocker',
        unit,
        title: '缺少角色资产',
        detail: '镜头没有绑定角色，后续分镜和视频生成无法稳定复用人物形象。',
        fix_hint: '为该镜头补入至少一个角色，并在角色资产表中声明服饰、年龄段和随身物件。',
      }));
    }

    for (const character of unit.characters) {
      if (knownCharacters.has(character)) continue;
      issues.push(supervisionIssue({
        category: 'asset',
        severity: 'warn',
        unit,
        title: `角色资产未声明：${character}`,
        detail: '镜头引用了角色名，但角色资产表中没有对应形象设定。',
        fix_hint: '把该角色加入 character_assets，或把镜头角色名统一到已有资产名。',
      }));
    }

    if (!unit.location.trim()) {
      issues.push(supervisionIssue({
        category: 'asset',
        severity: 'blocker',
        unit,
        title: '缺少场景资产',
        detail: '镜头没有场景空间，画面生成会失去构图和环境锚点。',
        fix_hint: '补入具体地点，并在 location_assets 中声明空间类型、陈设和氛围。',
      }));
    } else if (!knownLocations.has(unit.location)) {
      issues.push(supervisionIssue({
        category: 'asset',
        severity: 'warn',
        unit,
        title: `场景资产未声明：${unit.location}`,
        detail: '镜头地点没有进入场景资产表，跨镜头复用时容易漂移。',
        fix_hint: '把该地点加入 location_assets，或把镜头地点归并到已有场景资产。',
      }));
    }

    if (
      hasPromptPollution(unit.visual_prompt)
      || hasPromptPollution(unit.production_prompt)
      || hasPromptPollution(unit.seedance_prompt)
      || unit.qa_flags.some(flag => flag.includes('提示待清理'))
    ) {
      issues.push(supervisionIssue({
        category: 'prompt',
        severity: 'warn',
        unit,
        title: '画面提示需精简',
        detail: '画面、生产或 Seedance 提示中混入不可见的制作说明。',
        fix_hint: '只保留可见的人物、空间、道具、光线、构图、动作和情绪表现。',
      }));
    }

    if (!isFilmable(unit)) {
      issues.push(supervisionIssue({
        category: 'filmability',
        severity: 'warn',
        unit,
        title: '镜头可拍性不足',
        detail: '镜头缺少可见动作、主体、空间或镜头语言，容易变成抽象说明。',
        fix_hint: '补一个可见动作或道具变化，并明确镜头景别、运动或构图重点。',
      }));
    }

    if (!unit.continuity_notes.length || unit.qa_flags.some(flag => flag.includes('连续性'))) {
      issues.push(supervisionIssue({
        category: 'continuity',
        severity: 'warn',
        unit,
        title: '连续性约束不足',
        detail: '镜头缺少可复用的前后镜头连续性提示。',
        fix_hint: '补充角色状态、服饰、道具位置、线索开合或上一镜头承接关系。',
      }));
    }

    if (unit.duration_sec > 15 && !/(0[-—~至到]\d+秒|\d+[-—~至到]\d+秒)/.test(unit.production_prompt)) {
      issues.push(supervisionIssue({
        category: 'duration',
        severity: 'info',
        unit,
        title: '长镜头缺少时间段拆分',
        detail: '超过 15 秒的镜头如果直接送视频模型，动作节奏可能不稳定。',
        fix_hint: '把生产提示拆成 0-4 秒、4-9 秒、9-15 秒等明确时间段。',
      }));
    }
  }

  if (expectedPeriod) {
    for (const asset of delivery.character_assets) {
      if (!isPeriodMismatch(expectedPeriod, asset.clothing)) continue;
      issues.push({
        issue_id: `period-${issues.length + 1}`,
        category: 'period',
        severity: 'blocker',
        title: `服饰时代错配：${asset.name}`,
        detail: `故事时代倾向为${expectedPeriod}，但角色服饰写成「${asset.clothing}」。`,
        fix_hint: `把 ${asset.name} 的服饰改为符合${expectedPeriod}语境的可见服饰，并同步镜头提示。`,
      });
    }
  }

  const sortedIssues = issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const blockers = sortedIssues.filter(issue => issue.severity === 'blocker').length;
  const warnings = sortedIssues.filter(issue => issue.severity === 'warn').length;
  const infoCount = sortedIssues.filter(issue => issue.severity === 'info').length;
  const score = Math.max(0, 100 - blockers * 18 - warnings * 8 - infoCount * 3);
  return {
    passed: blockers === 0 && score >= 75,
    score,
    blockers,
    warnings,
    issue_count: sortedIssues.length,
    issues: sortedIssues,
    priority_fixes: uniqueStrings(sortedIssues
      .filter(issue => issue.severity !== 'info')
      .map(issue => `${issue.title}：${issue.fix_hint}`))
      .slice(0, 5),
  };
}

function severityRank(severity: StoryProductionBoardSupervisionIssue['severity']): number {
  if (severity === 'blocker') return 0;
  if (severity === 'warn') return 1;
  return 2;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function summarizeText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function seedanceAssetBindingStatusLabel(status: SeedanceAssetBindingItem['status']): string {
  if (status === 'bound') return '已绑定文件';
  if (status === 'missing_file') return '缺文件';
  return '缺引用槽位';
}

function seedanceAssetKindLabel(kind: SeedanceAssetBindingItem['kind']): string {
  if (kind === 'character') return '人物';
  if (kind === 'location') return '场景';
  if (kind === 'prop') return '道具';
  if (kind === 'camera') return '运镜';
  return '音频';
}

function seedanceAssetRoleLabel(role: SeedanceAssetBindingItem['role']): string {
  if (role === 'character_reference') return '人物形象参考';
  if (role === 'location_reference') return '场景氛围参考';
  if (role === 'prop_reference') return '道具外观参考';
  if (role === 'camera_reference') return '运镜参考';
  if (role === 'music_reference') return '音乐参考';
  return '声音参考';
}

function seedanceShotStatusLabel(status: SeedanceShotLedgerItem['status']): string {
  if (status === 'not_started') return '未开始';
  if (status === 'prompt_exported') return '待提交';
  if (status === 'submitted') return '已提交';
  if (status === 'processing') return '处理中';
  if (status === 'ready') return '已完成';
  if (status === 'failed') return '失败';
  return '跳过';
}

function buildRepairPlan(report: StoryProductionBoardSupervisionReport): StoryProductionBoardRepairPlan {
  const tasks = [
    buildTaskForAction(report.issues, 'normalize_period_costumes'),
    buildTaskForAction(report.issues, 'register_asset'),
    buildTaskForAction(report.issues, 'clean_prompt'),
    buildTaskForAction(report.issues, 'strengthen_filmability'),
    buildTaskForAction(report.issues, 'add_continuity'),
    buildTaskForAction(report.issues, 'split_duration'),
  ].filter((task): task is StoryProductionBoardRepairTask => Boolean(task));
  return {
    task_count: tasks.length,
    blocker_task_count: tasks.filter(task => task.priority === 'P0').length,
    tasks,
  };
}

function buildDeliveryManifest(
  shotUnits: StoryProductionBoardShotUnit[],
  supervisionReport: StoryProductionBoardSupervisionReport,
  repairPlan: StoryProductionBoardRepairPlan,
  qaReport: StoryProductionBoardQaReport,
  seedanceAssetReport: SeedanceAssetReportPackage,
  mediaAssetLibrary: MediaAssetLibrary,
): StoryProductionBoardDeliveryManifest {
  const hasSeedancePrompts = shotUnits.length > 0
    && shotUnits.every(unit => unit.seedance_prompt.includes('0-3秒') && unit.seedance_duration_sec >= 4 && unit.seedance_duration_sec <= 15);
  const mediaProductionReady = mediaAssetLibrary.summary.binding_count > 0
    && mediaAssetLibrary.summary.production_credit_binding_count === mediaAssetLibrary.summary.binding_count;
  const stage: StoryProductionBoardDeliveryStage = supervisionReport.blockers > 0
    ? 'blocked'
    : qaReport.passed && repairPlan.task_count === 0 && mediaProductionReady ? 'ready' : 'needs_repair';
  const blockers = [
    ...supervisionReport.issues
      .filter(issue => issue.severity === 'blocker')
      .map(issue => issue.title),
    ...(!hasSeedancePrompts ? ['Seedance 提示词未满足 4-15 秒分时段要求'] : []),
  ];
  const artifacts: StoryProductionBoardDeliveryArtifact[] = [
    {
      artifact_id: 'board-json',
      kind: 'board_json',
      label: 'Production Board JSON',
      status: stage,
      description: '完整结构化生产包，包含资产、镜头、监督、修复和 Seedance 字段。',
    },
    {
      artifact_id: 'board-markdown',
      kind: 'board_markdown',
      label: 'Production Board Markdown',
      status: stage,
      description: '给导演、分镜、甲方或外部 Agent 阅读的 Markdown 交付稿。',
    },
    {
      artifact_id: 'supervision-report',
      kind: 'supervision_report',
      label: 'Supervision Report',
      status: supervisionReport.blockers > 0 ? 'blocked' : supervisionReport.warnings > 0 ? 'needs_repair' : 'ready',
      description: '资产、提示词、可拍性、连续性、时代服饰和时长监督结果。',
    },
    {
      artifact_id: 'repair-plan',
      kind: 'repair_plan',
      label: 'Production Repair Plan',
      status: repairPlan.blocker_task_count > 0 ? 'blocked' : repairPlan.task_count > 0 ? 'needs_repair' : 'ready',
      description: '可执行修复任务，包含目标镜头、修复指令、期望输出和验收标准。',
    },
    {
      artifact_id: 'seedance-prompts',
      kind: 'seedance_prompts',
      label: 'Seedance 2.0 Shot Prompts',
      status: hasSeedancePrompts ? stage : 'blocked',
      description: '每个镜头的 4-15 秒 Seedance 分时段视频提示词。',
    },
    {
      artifact_id: 'seedance-asset-report',
      kind: 'seedance_asset_report',
      label: 'Seedance Asset Report',
      status: seedanceAssetReport.unbound_shot_count > 0 || seedanceAssetReport.placeholder_asset_count > 0 ? 'needs_repair' : 'ready',
      description: seedanceAssetReport.placeholder_asset_count > 0
        ? `按素材 slot 聚合人物、场景和道具引用；仍有 ${seedanceAssetReport.placeholder_asset_count} 个占位参考图需替换为正式视觉素材。`
        : '按素材 slot 聚合人物、场景和道具引用，标记缺槽位、缺文件和待上传镜头。',
    },
    {
      artifact_id: 'media-asset-library',
      kind: 'media_asset_library',
      label: 'Media Asset Library',
      status: mediaProductionReady ? 'ready' : 'needs_repair',
      description: mediaProductionReady
        ? `全部 ${mediaAssetLibrary.summary.binding_count} 个媒体绑定已通过完整性、版权和真人视觉审核。`
        : `${mediaAssetLibrary.summary.production_credit_binding_count}/${mediaAssetLibrary.summary.binding_count} 个媒体绑定具备正式生产资格；结构绑定不等于可投产。`,
    },
    {
      artifact_id: 'image-asset-job-plan',
      kind: 'image_asset_job_plan',
      label: 'Image Asset Job Plan',
      status: 'ready',
      description: '人物、场景和道具参考图片的可审计 GEARS 任务计划；计划本身不代表供应商已调用。',
    },
    {
      artifact_id: 'seedance-shot-ledger',
      kind: 'seedance_shot_ledger',
      label: 'Seedance Shot Ledger',
      status: 'ready',
      description: '每个 Seedance 镜头的提交、生成、回片、失败和选用版本状态。',
    },
  ];
  return {
    stage,
    stage_label: deliveryStageLabel(stage),
    next_action: deliveryNextAction(stage, repairPlan, supervisionReport, seedanceAssetReport, mediaAssetLibrary),
    blockers: uniqueStrings(blockers),
    ready_artifact_count: artifacts.filter(artifact => artifact.status === 'ready').length,
    artifacts,
  };
}

function deliveryStageLabel(stage: StoryProductionBoardDeliveryStage): string {
  if (stage === 'ready') return '可交付';
  if (stage === 'blocked') return '存在阻断项';
  return '需修复后交付';
}

function deliveryNextAction(
  stage: StoryProductionBoardDeliveryStage,
  repairPlan: StoryProductionBoardRepairPlan,
  supervisionReport: StoryProductionBoardSupervisionReport,
  seedanceAssetReport: SeedanceAssetReportPackage,
  mediaAssetLibrary: MediaAssetLibrary,
): string {
  if (stage === 'ready') {
    if (seedanceAssetReport.upload_required_count > 0 || seedanceAssetReport.missing_reference_slot_count > 0) {
      return `Story Agent 交付包可用；提交 Seedance 前请先按素材缺口报告上传/绑定 ${seedanceAssetReport.upload_required_count} 个参考素材文件。`;
    }
    if (seedanceAssetReport.placeholder_asset_count > 0) {
      return `Story Agent 结构化交付包可用；正式投产前请把 ${seedanceAssetReport.placeholder_asset_count} 个占位参考图替换为真实视觉素材。`;
    }
    return '可以导出 Board Markdown/JSON，并按镜头提交 Seedance 提示词。';
  }
  if (mediaAssetLibrary.summary.production_credit_binding_count < mediaAssetLibrary.summary.binding_count) {
    return `先完成媒体资产完整性、版权授权和真人视觉审核：当前 ${mediaAssetLibrary.summary.production_credit_binding_count}/${mediaAssetLibrary.summary.binding_count} 个绑定具备生产资格。`;
  }
  const firstP0 = repairPlan.tasks.find(task => task.priority === 'P0');
  if (firstP0) return `先处理 P0：${firstP0.title}。`;
  const firstIssue = supervisionReport.issues.find(issue => issue.severity === 'warn');
  if (firstIssue) return `先处理警告：${firstIssue.title}。`;
  return '先完成生产修复包中的剩余任务。';
}

function buildTaskForAction(
  issues: StoryProductionBoardSupervisionIssue[],
  action: StoryProductionBoardRepairAction,
): StoryProductionBoardRepairTask | null {
  const targets = issues.filter(issue => repairActionMatchesIssue(action, issue));
  if (!targets.length) return null;
  const targetShotIds = uniqueStrings(targets.map(issue => issue.source_shot_id).filter((id): id is string => Boolean(id)));
  const targetSceneIds = [...new Set(targets.map(issue => issue.source_scene_id).filter((id): id is number => typeof id === 'number'))]
    .sort((a, b) => a - b);
  const priority: StoryProductionBoardRepairPriority = targets.some(issue => issue.severity === 'blocker')
    ? 'P0'
    : targets.some(issue => issue.severity === 'warn') ? 'P1' : 'P2';
  const spec = repairActionSpec(action, targetShotIds, targetSceneIds);
  return {
    task_id: `repair-${action}`,
    action,
    priority,
    target_issue_ids: targets.map(issue => issue.issue_id),
    target_shot_ids: targetShotIds,
    target_scene_ids: targetSceneIds,
    ...spec,
  };
}

function repairActionMatchesIssue(
  action: StoryProductionBoardRepairAction,
  issue: StoryProductionBoardSupervisionIssue,
): boolean {
  if (action === 'normalize_period_costumes') return issue.category === 'period';
  if (action === 'register_asset') return issue.category === 'asset';
  if (action === 'clean_prompt') return issue.category === 'prompt';
  if (action === 'strengthen_filmability') return issue.category === 'filmability';
  if (action === 'add_continuity') return issue.category === 'continuity';
  return issue.category === 'duration';
}

function repairActionSpec(
  action: StoryProductionBoardRepairAction,
  targetShotIds: string[],
  targetSceneIds: number[],
): Pick<StoryProductionBoardRepairTask, 'title' | 'instruction' | 'expected_output' | 'acceptance_criteria'> {
  const shotText = targetShotIds.length ? `目标镜头：${targetShotIds.join('、')}。` : '';
  const sceneText = targetSceneIds.length ? `目标场景：${targetSceneIds.join('、')}。` : '';
  const scope = [shotText, sceneText].filter(Boolean).join('');
  const specs: Record<StoryProductionBoardRepairAction, Pick<StoryProductionBoardRepairTask, 'title' | 'instruction' | 'expected_output' | 'acceptance_criteria'>> = {
    normalize_period_costumes: {
      title: '统一时代服饰资产',
      instruction: `${scope}把角色服饰改成与故事时代一致的可见服装，并同步到角色资产、服饰资产和相关镜头提示；不要使用跨时代词，如清末、民初、五四、现代、西装等。`,
      expected_output: '更新后的 character_assets、costume_assets、production_prompt 与 visual_prompt 服饰描述。',
      acceptance_criteria: ['所有角色服饰与故事时代一致', '镜头提示不再出现跨时代服饰词', '同一角色在全部镜头中服饰稳定'],
    },
    register_asset: {
      title: '补齐角色或场景资产',
      instruction: `${scope}为未声明的角色或地点补齐生产资产，包含名称、类型、外观/空间、服饰或陈设、氛围和复用说明；优先归并到已有资产，避免同物异名。`,
      expected_output: '补齐后的 character_assets 或 location_assets，以及镜头中的统一引用名。',
      acceptance_criteria: ['每个镜头角色都能匹配角色资产', '每个镜头地点都能匹配场景资产', '资产名在镜头和资产表中一致'],
    },
    clean_prompt: {
      title: '精简画面提示词',
      instruction: `${scope}重写画面提示和生产提示，只保留可见的人物、空间、道具、光线、构图、动作、情绪和时代信息；删除不可见的制作说明。`,
      expected_output: '可直接给画面或视频模型使用的干净提示词。',
      acceptance_criteria: ['提示词只保留可见内容', '提示词具备主体、动作、环境和光线', '保留必要文化边界但不写成说明文字'],
    },
    strengthen_filmability: {
      title: '强化镜头可拍性',
      instruction: `${scope}把抽象剧情说明改成可拍镜头：补主体动作、道具变化、人物表情、空间关系和明确镜头语言。`,
      expected_output: '更具体的 script_text、visual_prompt、camera_suggestion 和 production_prompt。',
      acceptance_criteria: ['每个目标镜头有可见动作', '每个目标镜头有清楚景别或运镜', '画面能被分镜师或视频模型直接理解'],
    },
    add_continuity: {
      title: '补充连续性约束',
      instruction: `${scope}补充角色状态、服饰、道具位置、线索承接、上一镜头/下一镜头关系，写入 continuity_notes 和 segment_prompt_hint。`,
      expected_output: '可复用的 continuity_notes、segment_prompt_hint，以及必要的镜头提示同步。',
      acceptance_criteria: ['角色状态不倒退', '道具和服饰在相邻镜头中稳定', '线索开合关系明确'],
    },
    split_duration: {
      title: '拆分长镜头时间段',
      instruction: `${scope}把超过 15 秒的镜头拆成 0-4 秒、4-9 秒、9-15 秒等时间段，分别标注主体动作、镜头运动、情绪变化和收束画面。`,
      expected_output: '带时间段的 production_prompt，可直接转 Seedance 或同类视频模型提示。',
      acceptance_criteria: ['每段时间都有明确动作', '镜头运动不互相矛盾', '结尾有收束或钩子画面'],
    },
  };
  return specs[action];
}

function supervisionIssue(input: {
  category: StoryProductionBoardSupervisionIssue['category'];
  severity: StoryProductionBoardSupervisionIssue['severity'];
  unit: StoryProductionBoardShotUnit;
  title: string;
  detail: string;
  fix_hint: string;
}): StoryProductionBoardSupervisionIssue {
  return {
    issue_id: `${input.category}-${input.unit.shot_id}`,
    category: input.category,
    severity: input.severity,
    source_shot_id: input.unit.shot_id,
    source_scene_id: input.unit.source_scene_id,
    title: input.title,
    detail: input.detail,
    fix_hint: input.fix_hint,
  };
}

function hasPromptPollution(value: string): boolean {
  return DELIVERY_PROMPT_INTERNAL_PATTERN.test(value)
    || /(?:质量|分析|应该|注意|来源显示|来源条目|TODO|待补|知识库缺失|生成优先级|具体细节请核实来源|不可写成已验证史实)/.test(value);
}

function isFilmable(unit: StoryProductionBoardShotUnit): boolean {
  const text = [unit.script_text, unit.visual_prompt, unit.camera_suggestion].join(' ');
  const hasVisibleAnchor = /[、，,]/.test(unit.visual_prompt) || /案卷|文书|灯|门|桌|船|山|水|街|院|衙|洞|碑|莲|镜|火|雨|人/.test(unit.visual_prompt);
  const hasAction = /看|走|停|举|落|推|转|打开|拿|递|跪|站|拒|签|追|回头|对峙|凝视|冲/.test(text);
  const hasCamera = /近景|中景|远景|特写|推|拉|摇|移|俯拍|仰拍|对切|定格|镜头/.test(unit.camera_suggestion);
  return hasVisibleAnchor && hasAction && hasCamera;
}

function inferExpectedPeriod(story: StoryGenerateResult): string | null {
  const text = [
    story.source_entry,
    story.full_text,
    story.credibility_note,
    ...story.cultural_constraints,
    ...(story.knowledge_pack?.primary_entries.flatMap(entry => [entry.era ?? '', entry.summary]) ?? []),
    ...(story.knowledge_pack?.supporting_entries.flatMap(entry => [entry.era ?? '', entry.summary]) ?? []),
  ].join(' ');
  if (/周敦颐|濂溪|朱熹|二程|南安军/.test(text)) return '宋';
  if (/岳飞|辛弃疾|陆游|苏轼|王安石|司马光|包拯/.test(text)) return '宋';
  const periods = [
    '先秦', '秦', '汉', '魏晋', '唐', '宋', '元', '明', '清', '民国', '近代', '现代',
  ];
  return periods.find(period => text.includes(period)) ?? null;
}

function isPeriodMismatch(expectedPeriod: string, clothing: string): boolean {
  const normalized = clothing.trim();
  if (!normalized) return true;
  const periodFamilies: Record<string, RegExp> = {
    先秦: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    秦: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    汉: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    魏晋: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    唐: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    宋: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    元: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    明: /清末|民初|民国|五四|近代|现代|西装|中山装|旗袍/,
    清: /五四|民初|民国|现代|西装|中山装/,
    民国: /宋制|唐制|汉服|官袍|朝服/,
    近代: /宋制|唐制|汉服|官袍|朝服/,
    现代: /宋制|唐制|官袍|朝服/,
  };
  return periodFamilies[expectedPeriod]?.test(normalized) ?? false;
}

function buildProductionPrompt(input: {
  location: string;
  characters: string[];
  visualPrompt: string;
  cameraSuggestion: string;
  segmentPromptHint?: string;
}): string {
  return [
    `场景：${input.location || '未指定场景'}`,
    `角色：${input.characters.join('、') || '未指定角色'}`,
    `画面：${input.visualPrompt || '按场景动作补足可见画面'}`,
    `镜头：${input.cameraSuggestion || '稳定镜头，动作清楚'}`,
    input.segmentPromptHint ? `生产提示：${input.segmentPromptHint}` : '',
  ].filter(Boolean).join('\n');
}

function buildFallbackSeedancePrompt(input: {
  durationSec: number;
  location: string;
  characters: string[];
  scriptText: string;
  visualPrompt: string;
  cameraSuggestion: string;
}): string {
  const subject = input.characters.join('、') || '主要人物';
  const duration = Math.max(4, Math.min(15, input.durationSec));
  if (duration <= 8) {
    return [
      `生成 ${duration} 秒视频。主体：${subject}。场景：${input.location || '未指定场景'}。`,
      `0-3秒：${input.visualPrompt || '建立场景和主体动作'}；镜头：${input.cameraSuggestion || '稳定中景'}。`,
      `3-${duration}秒：${input.scriptText || '人物完成关键动作'}；突出表情、手部动作和空间关系，结尾留半秒定格。`,
      '风格：AI漫剧/影视分镜，画面清晰，人物动作可拍，时代与服饰保持一致。',
      '音效/音乐：环境声贴合场景，情绪紧张处轻微增强节奏。',
      `禁止：${DEFAULT_NEGATIVE_CONSTRAINTS.join('；')}。`,
    ].join('\n');
  }
  return [
    `生成 ${duration} 秒视频。主体：${subject}。场景：${input.location || '未指定场景'}。`,
    `0-3秒：${input.visualPrompt || '建立场景和主体动作'}；镜头：${input.cameraSuggestion || '稳定中景'}。`,
    `3-7秒：${input.scriptText || '人物完成关键动作'}；冲突或发现推进，镜头跟随人物动作变化。`,
    `7-${duration}秒：关键情绪或转折落地，收束到可承接的定格画面。`,
    '风格：AI漫剧/影视分镜，画面清晰，人物动作可拍，时代与服饰保持一致。',
    '音效/音乐：环境声贴合场景，情绪紧张处轻微增强节奏。',
    `禁止：${DEFAULT_NEGATIVE_CONSTRAINTS.join('；')}。`,
  ].join('\n');
}

function fallbackSeedanceMaterialValidation(input: {
  durationSec: number;
  characters: string[];
  location: string;
}): StoryProductionBoardShotUnit['seedance_material_validation'] {
  const missingRequiredSlots = [
    ...input.characters.map(character => `character:${character}`),
    input.location.trim() ? `location:${input.location}` : '',
  ].filter(Boolean);
  return {
    total_file_count: 0,
    image_count: 0,
    video_count: 0,
    audio_count: 0,
    max_total_files: 12,
    max_image_files: 9,
    max_video_files: 3,
    max_audio_files: 3,
    missing_required_slots: missingRequiredSlots,
    prompt_complexity_score: 0,
    duration_sec: input.durationSec,
    duration_risk: 'ok',
    warnings: missingRequiredSlots.length
      ? [`缺少必需素材引用槽位：${missingRequiredSlots.join('、')}`]
      : [],
  };
}

function cleanPrompt(value: string): string {
  return value
    .replace(/^(视觉提示|画面提示|镜头建议|分析|注意)[:：]\s*/g, '')
    .replace(/生成优先级[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/本场景基于[^，。；\n]*(?:，具体细节请核实来源)?/g, '')
    .replace(/来源显示[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/来源条目[:：][^。；\n]*(?:。|；|\n)?/g, '')
    .replace(/(?:质量信号|建议调整|类型匹配|资料显示|摘要|核心画面是|为什么必须面对)[:：]?/g, '')
    .replace(/(?:主角目标|目标明确|行动具体|因果链|史实边界|来源说明|内部字段名|史实依据|影视化创作|知识库|用户大纲|创作边界|确证史实|确证史源|治理痕迹)[:：]?/g, '')
    .replace(/(?:质量|分析|应该|注意|TODO|待补|知识库缺失)[:：]?/g, '')
    .replace(/具体细节请核实来源/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanProductionBoundaryNote(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/知识库/g, '来源材料')
    .replace(/知识条目/g, '来源材料')
    .replace(/知识包/g, '素材包')
    .replace(/用户大纲/g, '用户素材')
    .replace(/史实依据[:：]?/g, '事实锚点：')
    .replace(/事实依据[:：]?/g, '事实锚点：')
    .replace(/影视化创作[:：]?/g, '创作处理：')
    .replace(/戏剧化补足[:：]?/g, '创作处理：')
    .replace(/确证史实/g, '确定事实')
    .replace(/确证史源/g, '确定来源')
    .replace(/来源显示[:：][^。；\n]*(?:[。；])?/g, '')
    .replace(/来源条目[:：][^。；\n]*(?:[。；])?/g, '')
    .replace(/来源条目/g, '来源材料')
    .replace(/(?:质量信号|主角目标|目标明确|行动具体|因果链|史实边界|质量报告|来源说明|内部字段名|生成优先级|资料显示|摘要|核心画面是|为什么必须面对|具体细节请核实来源|创作边界|治理痕迹|分析|应该|注意|TODO|待补)[:：]?/g, '')
    .replace(/：\s*；/g, '：')
    .replace(/；{2,}/g, '；')
    .replace(/，{2,}/g, '，')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[，,；;：:\s]+|[，,；;：:\s]+$/g, '')
    .trim();
}

function cleanDeliveryScriptText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/知识库/g, '来源材料')
    .replace(/知识包/g, '素材包')
    .replace(/用户大纲/g, '用户素材')
    .replace(/史实依据[:：]?/g, '事实锚点：')
    .replace(/影视化创作[:：]?/g, '创作处理：')
    .replace(/来源显示[:：][^。；\n]*(?:[。；])?/g, '')
    .replace(/来源条目[:：][^。；\n]*(?:[。；])?/g, '')
    .replace(/(?:质量信号|主角目标|目标明确|行动具体|因果链|史实边界|质量报告|来源说明|内部字段名|生成优先级|资料显示|核心画面是|为什么必须面对|具体细节请核实来源|不可写成|确证史实|确证史源|创作边界|治理痕迹|TODO|待补)[:：]?/g, '')
    .replace(/，\s*([。；])/g, '$1')
    .replace(/；{2,}/g, '；')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripProductionBoundaryPrefix(value: string): string {
  return value.replace(/^(事实锚点|创作处理)[:：]\s*/g, '').trim();
}

function buildShotCulturalBoundary(scene: StoryGenerateResult['scene_breakdown'][number]): string {
  const fact = cleanProductionBoundaryNote(scene.factual_basis ?? '');
  if (fact) return `事实锚点：${stripProductionBoundaryPrefix(fact)}`;
  const note = cleanProductionBoundaryNote(scene.cultural_note ?? '');
  if (note) return note;
  return '按来源材料可信边界处理，创作补足不可写成确定事实。';
}

function cleanSeedancePrompt(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(cleanSeedancePromptLine)
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanSeedancePromptLine(value: string): string {
  const line = value.trim();
  if (!line) return '';

  if (/^连续性[:：]/.test(line) && DELIVERY_PROMPT_INTERNAL_PATTERN.test(line)) {
    return '';
  }

  if (/^禁止[:：]/.test(line)) {
    const constraints = line
      .replace(/^禁止[:：]\s*/, '')
      .replace(/[。.]$/, '')
      .split(/[；;]/)
      .map(item => cleanPrompt(item))
      .filter(item => item && !DELIVERY_PROMPT_INTERNAL_PATTERN.test(item));
    return constraints.length ? `禁止：${uniqueStrings(constraints).join('；')}。` : '';
  }

  return stripDeliveryPromptInternalClauses(line)
    .replace(/^(分析|注意|质量|来源显示|来源条目|史实依据|影视化创作|创作边界)[:：]\s*/g, '')
    .replace(/(?:质量信号|主角目标|目标明确|行动具体|因果链|史实边界)[:：]?/g, '')
    .replace(/(?:来源说明|内部字段名|来源显示|来源条目|史实依据|影视化创作|知识库|用户大纲|生成优先级|资料显示|摘要|核心画面是|为什么必须面对|具体细节请核实来源|不可写成|确证史实|确证史源|创作边界|治理痕迹|分析|应该|注意|TODO|待补)[:：]?/g, '')
    .replace(/[，,]\s*([。；])/g, '$1')
    .replace(/；{2,}/g, '；')
    .replace(/，{2,}/g, '，')
    .replace(/：\s*；/g, '：')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripDeliveryPromptInternalClauses(value: string): string {
  return value
    .replace(/(?:^|[，,；;。])\s*(?:史实依据|影视化创作|来源条目|来源显示|来源说明|创作边界|质量信号|建议调整|类型匹配|资料显示|摘要|生成优先级)[:：][^。；\n]*(?:[。；])?/g, '；')
    .replace(/[，,]\s*[^，,。；\n]*(?:知识库|来源条目|史实依据|影视化创作|用户大纲|创作桥段|确证史源|确证史实|文化\/史实边界|史实边界|创作边界)[^。；\n]*(?=[。；])/g, '')
    .replace(/[，,]\s*片尾[^。；\n]*(?:创作边界|确证|伏笔)[^。；\n]*(?=[。；])/g, '');
}

function renderProductionBoardMarkdown(pkg: Omit<StoryProductionBoard, 'markdown'>): string {
  const lines = [
    `# ${pkg.title} Production Board`,
    '',
    '## 概览',
    `- 故事 ID: ${pkg.storyId}`,
    `- 项目 ID: ${pkg.project_id ?? '未记录'}`,
    `- 生成时间: ${pkg.generated_at}`,
    `- QA: ${pkg.qa_report.passed ? '通过' : '需处理'} · ${pkg.qa_report.score}/100`,
    `- 交付阶段: ${pkg.delivery_manifest.stage_label}`,
    `- 下一步: ${pkg.delivery_manifest.next_action}`,
    '',
    '## 交付清单',
    `- 可用交付物: ${pkg.delivery_manifest.ready_artifact_count}/${pkg.delivery_manifest.artifacts.length}`,
    ...(pkg.delivery_manifest.blockers.length ? pkg.delivery_manifest.blockers.map(blocker => `- 阻断: ${blocker}`) : ['- 阻断: 无']),
    ...pkg.delivery_manifest.artifacts.map(artifact => `- [${artifact.status}] ${artifact.label}: ${artifact.description}`),
    '',
    '## Seedance 素材缺口',
    `- 素材总数: ${pkg.seedance_asset_report.total_asset_count}`,
    `- 待上传文件: ${pkg.seedance_asset_report.upload_required_count}`,
    `- 占位参考图: ${pkg.seedance_asset_report.placeholder_asset_count}`,
    `- 结构已绑定（不等于可投产）: ${pkg.seedance_asset_report.production_asset_ready_count}`,
    `- 缺引用槽位: ${pkg.seedance_asset_report.missing_reference_slot_count}`,
    `- 受影响镜头: ${pkg.seedance_asset_report.unbound_shot_count}/${pkg.seedance_asset_report.shot_binding_count}`,
    ...(pkg.seedance_asset_report.assets.slice(0, 12).map(asset =>
      `- [${seedanceAssetBindingStatusLabel(asset.status)}] ${asset.reference_slot ?? '未分配槽位'} · ${seedanceAssetKindLabel(asset.kind)}「${asset.label}」 · 镜头 ${asset.source_shot_ids.join('、') || '无'}`
    )),
    '',
    '## MediaArtifact / AssetBinding',
    `- 不可变媒体 artifact: ${pkg.media_asset_library.summary.artifact_count}`,
    `- 完整性已验证: ${pkg.media_asset_library.summary.verified_artifact_count}`,
    `- 占位 artifact: ${pkg.media_asset_library.summary.placeholder_artifact_count}`,
    `- 可计生产信用的绑定: ${pkg.media_asset_library.summary.production_credit_binding_count}/${pkg.media_asset_library.summary.binding_count}`,
    `- 旧库未验证 artifact: ${pkg.media_asset_library.summary.legacy_unverified_artifact_count}`,
    ...(pkg.media_asset_library.bindings.slice(0, 12).map(binding =>
      `- [${binding.status}] ${binding.asset_id} · artifact ${binding.artifact_id ?? '缺失'} · 镜头 ${binding.source_shot_ids.join('、') || '无'} · production_credit=${binding.production_credit_granted}`
    )),
    '',
    '## 图片任务计划',
    `- 需求总数: ${pkg.image_asset_job_plan.summary.requirement_count}`,
    `- 人物/场景/道具: ${pkg.image_asset_job_plan.summary.character_requirement_count}/${pkg.image_asset_job_plan.summary.location_requirement_count}/${pkg.image_asset_job_plan.summary.prop_requirement_count}`,
    `- 待提交: ${pkg.image_asset_job_plan.summary.ready_to_submit_count}`,
    `- 已获生产资格: ${pkg.image_asset_job_plan.summary.production_ready_count}`,
    `- 计划是否调用供应商: ${pkg.image_asset_job_plan.provider_invoked}`,
    ...(pkg.image_asset_job_plan.requirements.slice(0, 20).map(requirement =>
      `- [${requirement.job_type}] ${requirement.label} · ${requirement.source_unit_id} · 镜头 ${requirement.source_shot_ids.join('、') || '无'} · production_credit=${requirement.production_credit_granted}`
    )),
    '',
    '## Seedance Shot Ledger',
    `- 镜头总数: ${pkg.seedance_shot_ledger.items.length}`,
    `- 已完成: ${pkg.seedance_shot_ledger.items.filter(item => item.status === 'ready').length}`,
    `- 处理中: ${pkg.seedance_shot_ledger.items.filter(item => item.status === 'processing').length}`,
    `- 失败: ${pkg.seedance_shot_ledger.items.filter(item => item.status === 'failed').length}`,
    ...(pkg.seedance_shot_ledger.items.slice(0, 12).map(item =>
      `- [${seedanceShotStatusLabel(item.status)}] ${item.shot_id} · 场景 ${item.source_scene_id ?? '未记录'}${item.provider_job_id ? ` · job ${item.provider_job_id}` : ''}${item.video_url ? ` · ${item.video_url}` : ''}`
    )),
    '',
    '## 角色资产',
    ...pkg.character_assets.map(asset => `- ${asset.name}: ${asset.role_position}；${asset.appearance_features}；服装：${asset.clothing}`),
    '',
    '## 场景资产',
    ...pkg.location_assets.map(asset => `- ${asset.name}: ${asset.scene_type}；${asset.description}；氛围：${asset.atmosphere}`),
    '',
    '## 道具资产',
    ...(pkg.prop_assets.length ? pkg.prop_assets.map(asset => `- ${asset.label}: 场景 ${asset.source_scene_ids.join('、')}；${asset.usage_note}`) : ['- 未自动识别']),
    '',
    '## 导演计划',
    ...pkg.director_plan.map(plan => `- 场景 ${plan.scene_id}: ${plan.dramatic_purpose}；情绪转折：${plan.emotion_turn}；镜头：${plan.camera_logic}；转场：${plan.transition_hint}`),
    '',
    '## 监督检查',
    `- 状态: ${pkg.supervision_report.passed ? '通过' : '需处理'} · ${pkg.supervision_report.score}/100`,
    `- 阻断项: ${pkg.supervision_report.blockers}；警告项: ${pkg.supervision_report.warnings}`,
    ...(pkg.supervision_report.priority_fixes.length
      ? pkg.supervision_report.priority_fixes.map(fix => `- 优先修复: ${fix}`)
      : ['- 优先修复: 无']),
    ...(pkg.supervision_report.issues.length
      ? pkg.supervision_report.issues.map(issue => `- [${issue.severity}/${issue.category}] ${issue.source_shot_id ? `${issue.source_shot_id}: ` : ''}${issue.title}：${issue.detail}；建议：${issue.fix_hint}`)
      : ['- 无监督问题']),
    '',
    '## 生产修复包',
    `- 修复任务: ${pkg.repair_plan.task_count}`,
    `- P0 任务: ${pkg.repair_plan.blocker_task_count}`,
    ...(pkg.repair_plan.tasks.length ? pkg.repair_plan.tasks.map(task => [
      `### ${task.priority} · ${task.title}`,
      `- 动作: ${task.action}`,
      `- 目标镜头: ${task.target_shot_ids.join('、') || '全局'}`,
      `- 指令: ${task.instruction}`,
      `- 期望输出: ${task.expected_output}`,
      `- 验收: ${task.acceptance_criteria.join('；')}`,
      '',
    ]).flat() : ['- 无需修复']),
    '',
    '## 镜头单元',
    ...pkg.shot_units.map(unit => [
      `### ${unit.shot_id}`,
      `- 场景: ${unit.location}`,
      `- 角色: ${unit.characters.join('、') || '未指定'}`,
      `- 时长/格数: ${unit.duration_sec} 秒 / ${unit.panel_count} 格`,
      `- Script: ${unit.script_text}`,
      `- Visual: ${unit.visual_prompt}`,
      `- Camera: ${unit.camera_suggestion}`,
      `- Production Prompt:\n${unit.production_prompt}`,
      `- Seedance ${unit.seedance_duration_sec}s Prompt:\n${unit.seedance_prompt}`,
      unit.seedance_asset_slots.length
        ? `- Seedance 素材 slot: ${unit.seedance_asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；')}`
        : '- Seedance 素材 slot: 无',
      `- Seedance 素材校验: 文件 ${unit.seedance_material_validation.total_file_count}/${unit.seedance_material_validation.max_total_files}；复杂度 ${unit.seedance_material_validation.prompt_complexity_score}/100；风险 ${unit.seedance_material_validation.duration_risk}`,
      unit.seedance_validation_notes.length ? `- Seedance 校验: ${unit.seedance_validation_notes.join('；')}` : '- Seedance 校验: 无',
      `- QA: ${unit.qa_flags.join('；') || '无'}`,
      '',
    ]).flat(),
    '## QA 报告',
    ...(pkg.qa_report.issues.length ? pkg.qa_report.issues.map(issue => `- ${issue}`) : ['- 无']),
    '',
  ];
  return lines.join('\n');
}
