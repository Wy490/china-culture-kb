import type {
  CreationContract,
  CreationUseCase,
  KnowledgePack,
  KnowledgePackEntry,
  KnowledgePackMissing,
  MaterialPack,
  MaterialPackEntry,
  MaterialPurpose,
  MaterialSufficiencyStage,
  MaterialSufficiencyStageReport,
  MaterialSufficiencyMissingItem,
  MaterialSufficiencyReport,
  PresentationStyle,
  StoryGenerateRequest,
  StoryStructureType,
  TruthMode,
  VideoType,
  NarrativePatternId,
} from '@shared/types.js';

function stableId(prefix: string, value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return `${prefix}-${slug || index + 1}`;
}

function normalizeMaterialMessage(message: string): string {
  return message
    .replace(/知识库/g, '项目素材')
    .replace(/知识包/g, '素材包');
}

function materialPurposesFromKnowledgeEntry(entry: KnowledgePackEntry, primary: boolean): MaterialPurpose[] {
  const purposes = new Set<MaterialPurpose>();
  if (primary) {
    purposes.add('fact_basis');
    purposes.add('character_source');
  }
  if (entry.role_in_story === 'regional_context' || entry.knowledge_domain === 'regional_culture' || entry.entry_role === 'regional_pack') {
    purposes.add('regional_context');
  }
  if (entry.role_in_story === 'cultural_background' || entry.knowledge_domain === 'core_china_culture') {
    purposes.add('cultural_background');
  }
  if (entry.knowledge_domain === 'era_setting' || entry.entry_role === 'setting_pack') {
    purposes.add('era_context');
  }
  if (entry.knowledge_domain === 'gears_asset' || entry.entry_role === 'asset_pack' || entry.asset_usage?.some(item => item.includes('scene') || item.includes('character'))) {
    purposes.add('visual_asset');
  }
  if (entry.knowledge_domain === 'source_pack' || entry.entry_role === 'source_pack' || entry.asset_usage?.includes('source_grounding')) {
    purposes.add('source_work');
  }
  if (entry.entry_role === 'style_pack' || entry.asset_usage?.includes('visual_style')) {
    purposes.add('reference_style');
  }
  if (entry.asset_usage?.some(item => item.includes('credibility') || item.includes('safety'))) {
    purposes.add('creative_boundary');
  }
  if (purposes.size === 0) purposes.add(primary ? 'fact_basis' : 'cultural_background');
  return [...purposes];
}

function knowledgeEntryToMaterial(entry: KnowledgePackEntry, index: number, primary: boolean): MaterialPackEntry {
  const provenance = [
    entry.match_reason,
    entry.source_refs?.length ? `来源：${entry.source_refs.join('；')}` : '',
    entry.verification_method ? `核验：${entry.verification_method}` : '',
  ].filter(Boolean).join('；');
  return {
    material_id: stableId(primary ? 'primary' : 'supporting', entry.entry_name, index),
    title: entry.entry_name,
    summary: entry.summary,
    source_type: 'knowledge_entry',
    purpose: materialPurposesFromKnowledgeEntry(entry, primary),
    confidence: entry.score,
    role_in_story: entry.role_in_story,
    provenance,
    linked_entry_name: entry.entry_name,
    tags: [
      entry.type,
      entry.province,
      entry.region,
      entry.era,
      ...(entry.keywords ?? []),
    ].filter((item): item is string => Boolean(item)),
  };
}

function isExplicitlyVerifiedKnowledgeEntry(entry: KnowledgePackEntry): boolean {
  const credibility = entry.credibility?.trim();
  return Boolean(
    credibility
    && ['已核实', '可靠', 'A'].includes(credibility)
    && (entry.unverified_points?.length ?? 0) === 0,
  );
}

function knowledgeEntryClaim(entry: KnowledgePackEntry): string {
  const notes = [
    `可信度：${entry.credibility?.trim() || '未声明'}`,
    entry.unverified_points?.length
      ? `待核点：${entry.unverified_points.join('；')}`
      : '',
  ].filter(Boolean).join('；');
  return `${entry.entry_name}（${notes}）：${entry.summary}`;
}

function materialToKnowledgeEntry(material: MaterialPackEntry, index: number): KnowledgePackEntry {
  const role = material.role_in_story
    ?? (material.purpose.includes('regional_context')
      ? 'regional_context'
      : material.purpose.includes('cultural_background') || material.purpose.includes('era_context')
        ? 'cultural_background'
        : 'primary_entry');
  return {
    entry_name: material.linked_entry_name ?? material.title,
    province: '项目素材',
    region: '项目素材',
    type: material.source_type,
    summary: material.summary,
    score: material.confidence ?? 0.7,
    role_in_story: role,
    match_reason: material.provenance ?? `由 MaterialPack 素材 ${index + 1} 兼容映射`,
    keywords: material.tags ?? [],
  };
}

export function materialPackFromKnowledgePack(
  knowledgePack: KnowledgePack,
  request: Pick<StoryGenerateRequest, 'original_user_query' | 'outline' | 'source_material_mode' | 'client_type' | 'truth_mode' | 'creation_use_case'> = {},
): MaterialPack {
  const primaryMaterials = knowledgePack.primary_entries.map((entry, index) =>
    knowledgeEntryToMaterial(entry, index, true),
  );
  const supportingMaterials = knowledgePack.supporting_entries.map((entry, index) =>
    knowledgeEntryToMaterial(entry, index, false),
  );
  const verifiedFacts = knowledgePack.primary_entries
    .filter(isExplicitlyVerifiedKnowledgeEntry)
    .map(entry => `${entry.entry_name}：${entry.summary}`);
  const fictionalOriginal = request.truth_mode === 'fictional_original'
    || request.creation_use_case === 'original_ai_comic';
  const uncertainClaims = [
    ...(fictionalOriginal
      ? []
      : knowledgePack.primary_entries
          .filter(entry => !isExplicitlyVerifiedKnowledgeEntry(entry))
          .map(knowledgeEntryClaim)),
    ...knowledgePack.missing_needs.map(item => `${item.label}：${normalizeMaterialMessage(item.message)}`),
  ];
  const referenceMaterials: MaterialPackEntry[] = [];
  const sourceText = request.original_user_query ?? request.outline;
  if (sourceText && request.source_material_mode === 'adapt_user_novel') {
    referenceMaterials.push({
      material_id: 'user-source-work',
      title: '用户原作/改编素材',
      summary: sourceText.slice(0, 500),
      source_type: 'user_source_text',
      purpose: ['source_work'],
      confidence: 0.8,
      provenance: '用户输入',
    });
  }
  return {
    schema_version: 'material-pack/v1',
    primary_materials: primaryMaterials,
    supporting_materials: supportingMaterials,
    reference_materials: referenceMaterials,
    brand_or_institution_profile: request.client_type
      ? { client_type: request.client_type }
      : undefined,
    source_work_profile: request.source_material_mode === 'adapt_user_novel'
      ? { rights_note: '需由用户确认原作授权与改编边界' }
      : undefined,
    visual_assets: [],
    verified_facts: verifiedFacts,
    uncertain_claims: uncertainClaims,
    creative_space: [
      fictionalOriginal
        ? '用户原创故事种子只作为人物、世界、冲突和情节的创作锚点，不归类为历史事实或待核实事实；若引用真实人物、机构、地域或文化细节，仍须另行核验。'
        : '允许把材料转化为场景调度、镜头动作、对白节奏和视觉表达，但不得把创作补足写成已验证事实。',
    ],
    missing_needs: knowledgePack.missing_needs,
    overall_confidence: knowledgePack.overall_confidence,
    token_budget_summary: {
      strategy: '优先使用结构化摘要、素材用途和缺口清单；避免把长篇原文直接塞入生成 prompt。',
    },
  };
}

export function knowledgePackFromMaterialPack(materialPack: MaterialPack): KnowledgePack | undefined {
  const sourceMaterials = [
    ...materialPack.primary_materials,
    ...materialPack.supporting_materials,
  ].filter(item => item.source_type === 'knowledge_entry' || item.linked_entry_name);
  if (sourceMaterials.length === 0) return undefined;
  const primary = materialPack.primary_materials.length
    ? materialPack.primary_materials
    : sourceMaterials.slice(0, 1);
  const supporting = materialPack.supporting_materials.length
    ? materialPack.supporting_materials
    : sourceMaterials.slice(primary.length);
  return {
    primary_entries: primary.map(materialToKnowledgeEntry),
    supporting_entries: supporting.map(materialToKnowledgeEntry),
    missing_needs: materialPack.missing_needs,
    overall_confidence: materialPack.overall_confidence,
  };
}

export function resolveCreationUseCase(request: StoryGenerateRequest, videoType: VideoType): CreationUseCase {
  if (request.creation_use_case) return request.creation_use_case;
  if (request.source_material_mode === 'adapt_user_novel') return 'adapted_ai_comic';
  if (videoType === 'ai_comic_drama') {
    return request.entry_name || request.knowledge_pack || request.material_pack
      ? 'adapted_ai_comic'
      : 'original_ai_comic';
  }
  if (videoType === 'documentary_short') return 'documentary_short';
  if (videoType === 'education_training') return 'education_training';
  if (videoType === 'city_brand_promo' || videoType === 'social_short') return 'brand_commercial';
  if (videoType === 'lecture_video' || videoType === 'explainer_video') return 'institutional_promo';
  return 'institutional_promo';
}

export function resolveTruthMode(
  request: StoryGenerateRequest,
  useCase: CreationUseCase,
  videoType: VideoType,
): TruthMode {
  if (request.truth_mode) return request.truth_mode;
  if (request.source_material_mode === 'adapt_user_novel' || useCase === 'adapted_ai_comic') return 'source_adaptation';
  if (useCase === 'original_ai_comic') return 'fictional_original';
  if (useCase === 'documentary_short' || videoType === 'documentary_short') return 'factual_reconstruction';
  if (videoType === 'historical_drama') return 'factual_reconstruction';
  if (videoType === 'character_story' || videoType === 'legend_story' || videoType === 'children_story') {
    return 'inspired_by_material';
  }
  if (['institutional_promo', 'education_training', 'public_service'].includes(useCase)) return 'institutional_verified';
  return 'inspired_by_material';
}

function missingItem(
  item_id: string,
  label: string,
  reason: string,
  blocking_level: MaterialSufficiencyMissingItem['blocking_level'],
  affects: string[],
  recommended_question: string,
): MaterialSufficiencyMissingItem {
  return { item_id, label, reason, blocking_level, affects, recommended_question };
}

function materialTokenRisk(materialPack: MaterialPack): 'low' | 'medium' | 'high' {
  const totalLength = [
    ...materialPack.primary_materials,
    ...materialPack.supporting_materials,
    ...materialPack.reference_materials,
  ].reduce((sum, item) => sum + item.summary.length, 0);
  if (totalLength > 6000) return 'high';
  if (totalLength > 2500) return 'medium';
  return 'low';
}

const SUFFICIENCY_STAGE_ORDER: MaterialSufficiencyStage[] = [
  'minimum_viable_story',
  'script_ready',
  'production_ready',
];

const STAGE_OUTPUTS: Record<MaterialSufficiencyStage, string[]> = {
  minimum_viable_story: ['故事方向', 'logline', '类型蓝图', '粗场景'],
  script_ready: ['完整剧本', '对白/旁白', '场景拆分', '质量报告'],
  production_ready: ['分镜资产说明', '角色/场景/道具约束', '交付包 readiness', '生产指挥清单'],
};

const STAGE_REQUIRED_ITEMS: Record<MaterialSufficiencyStage, string[]> = {
  minimum_viable_story: ['主题或主体', '主角/对象', '基本目标或传播目的'],
  script_ready: ['关键事实', '人物/机构/原作边界', '真实度口径'],
  production_ready: ['视觉资产', '地点/服饰/品牌规范', '禁用项和交付边界'],
};

function requiredStageForGeneration(creationUseCase: CreationUseCase, truthMode: TruthMode): MaterialSufficiencyStage {
  if (['institutional_verified', 'factual_reconstruction', 'source_adaptation'].includes(truthMode)) return 'script_ready';
  if (['institutional_promo', 'education_training', 'public_service', 'documentary_short'].includes(creationUseCase)) return 'script_ready';
  return 'minimum_viable_story';
}

function stageIndex(stage: MaterialSufficiencyStage): number {
  return SUFFICIENCY_STAGE_ORDER.indexOf(stage);
}

function nextStage(stage: MaterialSufficiencyStage): MaterialSufficiencyStage | undefined {
  return SUFFICIENCY_STAGE_ORDER[stageIndex(stage) + 1];
}

function uniqueMissingItems(items: MaterialSufficiencyMissingItem[]): MaterialSufficiencyMissingItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.item_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildStageReport(input: {
  stage: MaterialSufficiencyStage;
  confidence: number;
  missingItems: MaterialSufficiencyMissingItem[];
  optionalItems?: MaterialSufficiencyMissingItem[];
  notes?: string[];
}): MaterialSufficiencyStageReport {
  const missingItems = uniqueMissingItems(input.missingItems);
  const optionalItems = uniqueMissingItems(input.optionalItems ?? []);
  const blockingCount = missingItems.filter(item => item.blocking_level === 'blocking').length;
  const riskCount = missingItems.filter(item => item.blocking_level === 'risk').length;
  const score = Math.max(0, Math.min(100, Math.round(
    input.confidence * 35
    + 65
    - blockingCount * 35
    - riskCount * 15
    - Math.min(optionalItems.length, 3) * 4,
  )));
  const status = blockingCount > 0 ? 'blocked' : riskCount > 0 ? 'needs_input' : 'ready';
  return {
    stage: input.stage,
    status,
    score,
    can_proceed: blockingCount === 0,
    required_items: STAGE_REQUIRED_ITEMS[input.stage],
    available_outputs: blockingCount === 0 ? STAGE_OUTPUTS[input.stage] : [],
    missing_items: missingItems,
    optional_items: optionalItems,
    notes: input.notes ?? [],
  };
}

export function buildMaterialSufficiencyReport(input: {
  materialPack: MaterialPack;
  creationUseCase: CreationUseCase;
  truthMode: TruthMode;
}): MaterialSufficiencyReport {
  const { materialPack, creationUseCase, truthMode } = input;
  const requiredStage = requiredStageForGeneration(creationUseCase, truthMode);
  const allMaterials = [
    ...materialPack.primary_materials,
    ...materialPack.supporting_materials,
    ...materialPack.reference_materials,
  ];
  const hasPrimary = materialPack.primary_materials.length > 0;
  const hasSourceWork = materialPack.reference_materials.some(item => item.purpose.includes('source_work'))
    || Boolean(
      materialPack.source_work_profile?.title
      || materialPack.source_work_profile?.core_characters?.length
      || materialPack.source_work_profile?.must_keep?.length,
    );
  const hasInstitutionProfile = Boolean(materialPack.brand_or_institution_profile?.name || materialPack.brand_or_institution_profile?.client_type);
  const hasInstitutionClaims = Boolean(
    materialPack.brand_or_institution_profile?.verified_claims?.length
    || materialPack.brand_or_institution_profile?.forbidden_claims?.length,
  );
  const hasStoryAnchor = allMaterials.length > 0
    || materialPack.verified_facts.length > 0
    || materialPack.creative_space.length > 0
    || Boolean(materialPack.brand_or_institution_profile || materialPack.source_work_profile);
  const hasVisualAssets = materialPack.visual_assets.length > 0
    || allMaterials.some(item => item.purpose.includes('visual_asset'));
  const hasProductionContext = hasVisualAssets
    || allMaterials.some(item =>
      item.purpose.includes('era_context')
      || item.purpose.includes('regional_context')
      || item.purpose.includes('brand_info')
      || item.purpose.includes('institutional_position'),
    );
  const hasAdaptationRightsNote = Boolean(materialPack.source_work_profile?.rights_note || materialPack.source_work_profile?.adaptation_boundary);
  const verifiedFactCount = materialPack.verified_facts.length;

  const minimumMissing: MaterialSufficiencyMissingItem[] = [];
  const minimumOptional: MaterialSufficiencyMissingItem[] = [];
  const scriptMissing: MaterialSufficiencyMissingItem[] = [];
  const scriptOptional: MaterialSufficiencyMissingItem[] = [];
  const productionMissing: MaterialSufficiencyMissingItem[] = [];
  const productionOptional: MaterialSufficiencyMissingItem[] = [];

  if (!hasStoryAnchor && truthMode !== 'fictional_original') {
    minimumMissing.push(missingItem(
      'minimum_story_anchor',
      '主题/主体/基本目标',
      '最小可行故事至少需要一个主体、主题方向或基本传播目的。',
      'blocking',
      ['logline', 'story_blueprint'],
      '本片围绕谁/什么对象展开？最基本的目标或主题是什么？',
    ));
  }

  if (!hasPrimary && truthMode !== 'fictional_original') {
    scriptMissing.push(missingItem(
      'primary_material',
      '主素材/事实依据',
      '当前任务不是纯原创虚构，需要至少一个主素材或来源事实作为生成锚点。',
      truthMode === 'institutional_verified' || truthMode === 'factual_reconstruction' ? 'blocking' : 'risk',
      ['blueprint', 'full_text', 'quality_report'],
      '本片最核心、必须被准确表达的事实或素材是什么？',
    ));
  }
  if (truthMode === 'source_adaptation' && !hasSourceWork) {
    scriptMissing.push(missingItem(
      'source_work_profile',
      '原作/改编素材边界',
      '改编任务需要原作主线、人物关系、授权或保留项边界。',
      'blocking',
      ['story_blueprint', 'full_text'],
      '请补充原作标题、核心人物、必须保留的主线，以及授权/改编边界。',
    ));
  }
  if (truthMode === 'source_adaptation' && hasSourceWork && !hasAdaptationRightsNote) {
    productionMissing.push(missingItem(
      'source_adaptation_rights',
      '原作授权/改编边界',
      '进入生产交付前需要确认原作授权、改编边界和署名要求。',
      'risk',
      ['production_ready', 'legal_review'],
      '原作授权、署名、可改编范围和不可改动内容分别是什么？',
    ));
  }
  if (truthMode === 'institutional_verified' && !hasInstitutionProfile) {
    scriptMissing.push(missingItem(
      'institution_profile',
      '机构/品牌审定口径',
      '机构审定模式需要客户身份、表达口径和禁用表述。',
      'blocking',
      ['prompt', 'quality_report'],
      '本片代表哪个机构/品牌发声？有哪些必须使用或禁止使用的表述？',
    ));
  }
  if (['institutional_verified', 'factual_reconstruction'].includes(truthMode) && verifiedFactCount === 0) {
    scriptMissing.push(missingItem(
      'verified_facts',
      '已确认事实清单',
      '高真实度模式需要可确认事实清单，避免把创作补足写成确定事实。',
      truthMode === 'institutional_verified' ? 'blocking' : 'risk',
      ['credibility_note', 'quality_report'],
      '请列出本片可以确定使用的事实、数据、时间、地点和出处。',
    ));
  }
  if (materialPack.missing_needs.length > 0) {
    scriptMissing.push(...materialPack.missing_needs.slice(0, 5).map((need, index) => missingItem(
      stableId('material-need', need.need_id || need.label, index),
      need.label,
      normalizeMaterialMessage(need.message),
      ['institutional_verified', 'factual_reconstruction'].includes(truthMode) ? 'risk' : 'optional',
      ['script_ready', 'quality_report'],
      `请补充「${need.label}」：${normalizeMaterialMessage(need.message)}`,
    )));
  }
  if (truthMode === 'fictional_original' && materialPack.primary_materials.length === 0) {
    minimumOptional.push(missingItem(
      'worldbuilding_anchor',
      '原创设定锚点',
      '原创 AI 漫剧可以先生成，但补充世界观、人物关系和风格锚点会显著提高稳定性。',
      'optional',
      ['characters', 'scene_breakdown'],
      '这个原创故事的世界观、主角欲望、对手压力和视觉风格是什么？',
    ));
  }
  if (!hasVisualAssets) {
    productionMissing.push(missingItem(
      'visual_assets',
      '视觉资产',
      '生产前需要角色、场景、道具、品牌规范等视觉资产。',
      'blocking',
      ['production_ready', 'asset_handoff'],
      '是否已有角色/场景/道具/品牌图形规范可作为视觉参考？',
    ));
  }
  if (!hasProductionContext) {
    productionMissing.push(missingItem(
      'production_context',
      '地点/时代/品牌生产语境',
      '进入分镜和资产交付前，需要地点、时代、服饰、器物、品牌或机构视觉规范等生产语境。',
      'risk',
      ['visual_prompt', 'asset_handoff'],
      '本片的地点、时代、服饰、道具、品牌规范和禁用画面分别是什么？',
    ));
  }
  if (['institutional_verified'].includes(truthMode) && !hasInstitutionClaims) {
    productionMissing.push(missingItem(
      'institution_claims',
      '机构确认表述/禁用表述',
      '生产交付前需要确认机构可说内容、不可说内容和审核口径。',
      'risk',
      ['production_ready', 'review'],
      '机构有哪些必须表达的审核口径？有哪些禁用表述、禁用画面或敏感数据？',
    ));
  }
  if (creationUseCase === 'brand_commercial' && !hasInstitutionClaims) {
    productionMissing.push(missingItem(
      'brand_claims',
      '品牌卖点/禁用表述',
      '品牌商业片进入生产前需要确认卖点、口吻、禁用承诺和视觉规范。',
      'risk',
      ['production_ready', 'brand_review'],
      '品牌核心卖点、语气、禁用承诺和视觉规范是什么？',
    ));
  }

  const stageReports = [
    buildStageReport({
      stage: 'minimum_viable_story',
      confidence: materialPack.overall_confidence,
      missingItems: minimumMissing,
      optionalItems: minimumOptional,
      notes: ['最小阶段允许先形成方向、logline、蓝图和粗场景。'],
    }),
    buildStageReport({
      stage: 'script_ready',
      confidence: materialPack.overall_confidence,
      missingItems: scriptMissing,
      optionalItems: scriptOptional,
      notes: ['剧本阶段要求关键事实、原作/机构边界和真实度口径足够清楚。'],
    }),
    buildStageReport({
      stage: 'production_ready',
      confidence: materialPack.overall_confidence,
      missingItems: productionMissing,
      optionalItems: productionOptional,
      notes: ['生产阶段聚焦视觉资产、地点服饰、品牌规范、禁用项和交付边界。'],
    }),
  ];
  const targetReport = stageReports.find(report => report.stage === requiredStage) ?? stageReports[0];
  const minimumReport = stageReports[0];
  const scriptReport = stageReports[1];
  const productionReport = stageReports[2];
  const activeStage = productionReport.status === 'ready'
    ? 'production_ready'
    : scriptReport.status === 'ready'
      ? 'script_ready'
      : minimumReport.status === 'ready'
        ? 'minimum_viable_story'
        : requiredStage;
  const blocked = !targetReport.can_proceed || !minimumReport.can_proceed;
  const targetRiskCount = targetReport.missing_items.filter(item => item.blocking_level === 'risk').length;
  const needsVerification = !blocked && targetRiskCount > 0;
  const nextStageToUnlock = stageReports.find(report => !report.can_proceed)?.stage;
  const topMissing = uniqueMissingItems([
    ...minimumReport.missing_items,
    ...targetReport.missing_items,
  ]);
  const topOptional = uniqueMissingItems([
    ...minimumReport.optional_items,
    ...targetReport.optional_items,
    ...stageReports
      .filter(report => stageIndex(report.stage) > stageIndex(requiredStage))
      .flatMap(report => [
        ...report.missing_items.map(item => ({ ...item, blocking_level: 'optional' as const })),
        ...report.optional_items,
      ]),
  ]);
  const tokenRisk = materialTokenRisk(materialPack);
  const generationPosture = blocked
    ? 'blocked_until_input'
    : needsVerification || targetReport.status === 'needs_input'
      ? 'draft_needs_verification'
      : productionReport.status !== 'ready'
        ? 'script_ready_production_pending'
        : 'ready';

  return {
    schema_version: 'material-sufficiency/v1',
    stage: requiredStage,
    active_stage: activeStage,
    score: targetReport.score,
    can_generate: !blocked,
    can_generate_with_risks: !blocked && (needsVerification || topOptional.length > 0 || tokenRisk !== 'low'),
    blocked,
    needs_verification: needsVerification,
    generation_posture: generationPosture,
    next_stage: blocked ? requiredStage : nextStageToUnlock ?? nextStage(activeStage),
    downgrade_reason: blocked
      ? targetReport.missing_items.find(item => item.blocking_level === 'blocking')?.reason
      : needsVerification
        ? targetReport.missing_items.find(item => item.blocking_level === 'risk')?.reason
        : undefined,
    stage_reports: stageReports,
    missing_items: topMissing,
    optional_items: topOptional,
    token_risk: tokenRisk,
    recommended_next_questions: uniqueMissingItems([...topMissing, ...topOptional]).map(item => item.recommended_question),
  };
}

function truthModeRules(truthMode: TruthMode): Pick<CreationContract, 'allowed_fiction' | 'must_verify' | 'forbidden_moves' | 'required_disclaimers'> {
  if (truthMode === 'fictional_original') {
    return {
      allowed_fiction: ['可原创人物、事件、冲突和世界观。'],
      must_verify: ['不得冒充真实历史、真实机构或真实人物事实。'],
      forbidden_moves: ['把原创设定写成已发生史实。'],
      required_disclaimers: ['必要时标注为原创虚构或架空创作。'],
    };
  }
  if (truthMode === 'source_adaptation') {
    return {
      allowed_fiction: ['可压缩、合并、重排场景以适配成片节奏。'],
      must_verify: ['原作主线、核心人物关系、授权与改编边界。'],
      forbidden_moves: ['偏离原作主线或用知识包替换原作情节。'],
      required_disclaimers: ['标明改编来源与影视化处理边界。'],
    };
  }
  if (truthMode === 'factual_reconstruction') {
    return {
      allowed_fiction: ['可做场景调度、镜头动作和必要的影视化补足。'],
      must_verify: ['关键事实、时间、地点、数据、人物身份和结论。'],
      forbidden_moves: ['虚构关键事实、虚构结论、虚构真实人物确定发言。'],
      required_disclaimers: ['标明事实依据、再现内容和推测边界。'],
    };
  }
  if (truthMode === 'institutional_verified') {
    return {
      allowed_fiction: ['仅允许表达方式、镜头调度和非事实性视觉转场的创作处理。'],
      must_verify: ['机构口径、数据、称谓、政策表述、品牌规范和人物发言。'],
      forbidden_moves: ['未核实数据、虚构机构成果、虚构人物发言、过度戏剧化冲突。'],
      required_disclaimers: ['必要时标明素材待审、口径待核或示意画面。'],
    };
  }
  return {
    allowed_fiction: ['可基于素材做戏剧化创作和视觉化补足。'],
    must_verify: ['核心事实、人物身份、地点、时代与机构相关表述。'],
    forbidden_moves: ['把象征、联想或支撑素材写成确定事实。'],
    required_disclaimers: ['必要时区分素材启发、合理想象和已确认事实。'],
  };
}

export function buildCreationContract(input: {
  request: StoryGenerateRequest;
  materialSufficiency: MaterialSufficiencyReport;
  creationUseCase: CreationUseCase;
  truthMode: TruthMode;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  storyStructure: StoryStructureType;
  narrativePatternIds?: NarrativePatternId[];
}): CreationContract {
  const rules = truthModeRules(input.truthMode);
  return {
    schema_version: 'creation-contract/v1',
    creation_use_case: input.creationUseCase,
    truth_mode: input.truthMode,
    client_type: input.request.client_type,
    target_audience: input.request.target_audience,
    communication_goal: input.request.communication_goal,
    video_type: input.videoType,
    presentation_style: input.presentationStyle,
    story_structure: input.storyStructure,
    narrative_pattern_ids: input.narrativePatternIds ?? [],
    ...rules,
    material_sufficiency: input.materialSufficiency,
    delivery_expectation: [
      `素材当前目标阶段：${input.materialSufficiency.stage}`,
      input.materialSufficiency.active_stage ? `素材可安全推进到：${input.materialSufficiency.active_stage}` : '',
      input.materialSufficiency.generation_posture ? `生成姿态：${input.materialSufficiency.generation_posture}` : '',
      '输出可进入剧本、场景拆分、分镜和资产说明的前期创作合同。',
      '本项目只准备内容与生产指挥材料，不执行图片、视频或后期实产。',
    ].filter(Boolean),
  };
}
