import type {
  CreationContract,
  CreationUseCase,
  MaterialBlockingLevel,
  MaterialGenerationPosture,
  MaterialSufficiencyMissingItem,
  MaterialSufficiencyReport,
  MaterialSufficiencyStage,
  MaterialSufficiencyStageReport,
  MaterialSufficiencyStageStatus,
  PresentationStyle,
  ScriptType,
  StoryStructureType,
  TruthMode,
  VideoType,
} from '../types.js';

type StoryCreationOutputMode = 'story_text' | 'script_skeleton';

interface ScriptTypePreset {
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure: StoryStructureType;
}

export interface StoryCreationContractInput {
  script_type: ScriptType;
  entry_names: string[];
  output_mode: StoryCreationOutputMode;
  story_text?: string;
  target_duration?: string;
  title?: string;
  creation_use_case?: string;
  truth_mode?: string;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
}

const VALID_CREATION_USE_CASES: CreationUseCase[] = [
  'original_ai_comic',
  'adapted_ai_comic',
  'institutional_promo',
  'documentary_short',
  'brand_commercial',
  'education_training',
  'public_service',
];

const VALID_TRUTH_MODES: TruthMode[] = [
  'fictional_original',
  'inspired_by_material',
  'source_adaptation',
  'factual_reconstruction',
  'institutional_verified',
];

const SCRIPT_TYPE_PRESETS: Record<ScriptType, ScriptTypePreset> = {
  '纪录片': {
    video_type: 'documentary_short',
    presentation_style: 'documentary',
    story_structure: 'case_reconstruction',
  },
  '短剧': {
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    story_structure: 'three_act_drama',
  },
  '动画': {
    video_type: 'ai_comic_drama',
    presentation_style: 'animation_2d',
    story_structure: 'single_event_drama',
  },
  '文化解说': {
    video_type: 'explainer_video',
    presentation_style: 'host_narration',
    story_structure: 'problem_solution_explainer',
  },
};

const SUFFICIENCY_STAGE_ORDER: MaterialSufficiencyStage[] = [
  'minimum_viable_story',
  'script_ready',
  'production_ready',
];

const STAGE_REQUIRED_ITEMS: Record<MaterialSufficiencyStage, string[]> = {
  minimum_viable_story: ['主题或主体', '来源条目', '基础创作方向'],
  script_ready: ['完整故事/剧本正文', '关键事实边界', '真实度口径'],
  production_ready: ['视觉资产', '地点/服饰/品牌规范', '禁用项和交付边界'],
};

const STAGE_OUTPUTS: Record<MaterialSufficiencyStage, string[]> = {
  minimum_viable_story: ['故事方向', 'logline', '脚本骨架', '粗场景'],
  script_ready: ['完整剧本', '对白/旁白', '场景拆分', '质量报告'],
  production_ready: ['分镜资产说明', '角色/场景/道具约束', '生产指挥清单'],
};

function compactStrings(lines: Array<string | undefined>): string[] {
  return lines.filter((line): line is string => Boolean(line));
}

function normalizeCreationUseCase(value: string | undefined, videoType: VideoType): CreationUseCase {
  if (value && (VALID_CREATION_USE_CASES as string[]).includes(value)) {
    return value as CreationUseCase;
  }
  if (videoType === 'ai_comic_drama') return 'original_ai_comic';
  if (videoType === 'documentary_short') return 'documentary_short';
  if (videoType === 'children_story' || videoType === 'education_training') return 'education_training';
  if (videoType === 'city_brand_promo' || videoType === 'social_short') return 'brand_commercial';
  return 'institutional_promo';
}

function normalizeTruthMode(value: string | undefined, creationUseCase: CreationUseCase, videoType: VideoType): TruthMode {
  if (value && (VALID_TRUTH_MODES as string[]).includes(value)) {
    return value as TruthMode;
  }
  if (creationUseCase === 'adapted_ai_comic') return 'source_adaptation';
  if (creationUseCase === 'original_ai_comic') return 'fictional_original';
  if (creationUseCase === 'documentary_short' || videoType === 'documentary_short') return 'factual_reconstruction';
  if (['institutional_promo', 'education_training', 'public_service'].includes(creationUseCase)) return 'institutional_verified';
  return 'inspired_by_material';
}

function requiredStageForOutput(outputMode: StoryCreationOutputMode, creationUseCase: CreationUseCase, truthMode: TruthMode): MaterialSufficiencyStage {
  if (outputMode === 'script_skeleton') return 'minimum_viable_story';
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

function missingItem(
  item_id: string,
  label: string,
  reason: string,
  blocking_level: MaterialBlockingLevel,
  affects: string[],
  recommended_question: string,
): MaterialSufficiencyMissingItem {
  return { item_id, label, reason, blocking_level, affects, recommended_question };
}

function uniqueMissingItems(items: MaterialSufficiencyMissingItem[]): MaterialSufficiencyMissingItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.item_id)) return false;
    seen.add(item.item_id);
    return true;
  });
}

function scoreStage(missingItems: MaterialSufficiencyMissingItem[], optionalItems: MaterialSufficiencyMissingItem[]): number {
  const penalty = missingItems.reduce((total, item) => {
    if (item.blocking_level === 'blocking') return total + 35;
    if (item.blocking_level === 'risk') return total + 15;
    return total + 5;
  }, optionalItems.length * 5);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function buildStageReport(input: {
  stage: MaterialSufficiencyStage;
  missingItems: MaterialSufficiencyMissingItem[];
  optionalItems: MaterialSufficiencyMissingItem[];
  notes: string[];
}): MaterialSufficiencyStageReport {
  const blockingCount = input.missingItems.filter(item => item.blocking_level === 'blocking').length;
  const riskCount = input.missingItems.filter(item => item.blocking_level === 'risk').length;
  const status: MaterialSufficiencyStageStatus = blockingCount > 0
    ? 'blocked'
    : riskCount > 0
      ? 'needs_input'
      : 'ready';
  return {
    stage: input.stage,
    status,
    score: scoreStage(input.missingItems, input.optionalItems),
    can_proceed: blockingCount === 0,
    required_items: STAGE_REQUIRED_ITEMS[input.stage],
    available_outputs: STAGE_OUTPUTS[input.stage],
    missing_items: input.missingItems,
    optional_items: input.optionalItems,
    notes: input.notes,
  };
}

function buildMaterialSufficiencyReport(
  input: StoryCreationContractInput,
  creationUseCase: CreationUseCase,
  truthMode: TruthMode,
): MaterialSufficiencyReport {
  const hasEntryNames = input.entry_names.length > 0;
  const hasStoryText = Boolean(input.story_text?.trim()) && input.output_mode === 'story_text';
  const hasCommunicationGoal = Boolean(input.communication_goal?.trim());
  const hasClientContext = Boolean(input.client_type?.trim() || input.target_audience?.trim() || hasCommunicationGoal);
  const requiresVerifiedContext = ['institutional_verified', 'factual_reconstruction', 'source_adaptation'].includes(truthMode);
  const targetStage = requiredStageForOutput(input.output_mode, creationUseCase, truthMode);

  const minimumMissing: MaterialSufficiencyMissingItem[] = [];
  if (!hasEntryNames) {
    minimumMissing.push(missingItem(
      'source_entries',
      '来源条目',
      '需要至少一个知识库条目或来源主体，才能建立前期创作边界。',
      'blocking',
      ['story_blueprint', 'script_skeleton'],
      '这个项目的核心条目、人物、地点或原作材料是什么？',
    ));
  }
  if (!input.title?.trim() && !hasCommunicationGoal) {
    minimumMissing.push(missingItem(
      'creative_direction',
      '标题或传播目标',
      '缺少标题或传播目标时，只能形成宽泛骨架。',
      'risk',
      ['logline', 'tone'],
      '这支片子最想让观众记住的一句话是什么？',
    ));
  }

  const scriptMissing: MaterialSufficiencyMissingItem[] = [];
  if (!hasStoryText) {
    scriptMissing.push(missingItem(
      'script_body',
      '完整故事/剧本正文',
      input.output_mode === 'script_skeleton'
        ? '当前工具输出脚本骨架，正文、对白和旁白仍需后续填充。'
        : '缺少完整故事正文，无法判定剧本级完整度。',
      'blocking',
      ['full_text', 'dialogue', 'scene_breakdown'],
      '请补充完整故事正文、对白或旁白草稿。',
    ));
  }
  if (requiresVerifiedContext && !hasClientContext) {
    scriptMissing.push(missingItem(
      'verification_context',
      '审核/事实边界',
      '真实还原、机构审核或原作改编需要明确口径、事实边界或授权边界。',
      'risk',
      ['credibility_boundary', 'review'],
      '哪些事实、称谓、数据、原作设定或机构表述必须严格核验？',
    ));
  }

  const productionMissing: MaterialSufficiencyMissingItem[] = [
    missingItem(
      'visual_context',
      '视觉资产与生产规范',
      '进入分镜、资产和生产指挥前，需要地点、时代、服饰、道具、品牌或机构视觉规范。',
      'risk',
      ['asset_handoff', 'production_board'],
      '本片的地点、时代、服饰、道具、品牌规范和禁用画面分别是什么？',
    ),
  ];
  if (truthMode === 'institutional_verified' && !hasCommunicationGoal) {
    productionMissing.push(missingItem(
      'institution_claims',
      '机构确认表述/禁用表述',
      '机构类项目进入生产前需要确认可说内容、不可说内容和审核口径。',
      'risk',
      ['review', 'production_ready'],
      '机构有哪些必须表达的审核口径？有哪些禁用表述、禁用画面或敏感数据？',
    ));
  }

  const stageReports = [
    buildStageReport({
      stage: 'minimum_viable_story',
      missingItems: minimumMissing,
      optionalItems: [],
      notes: ['最小阶段允许先形成方向、logline、脚本骨架和粗场景。'],
    }),
    buildStageReport({
      stage: 'script_ready',
      missingItems: scriptMissing,
      optionalItems: [],
      notes: ['剧本阶段要求正文、关键事实、原作/机构边界和真实度口径足够清楚。'],
    }),
    buildStageReport({
      stage: 'production_ready',
      missingItems: productionMissing,
      optionalItems: [],
      notes: ['生产阶段聚焦视觉资产、地点服饰、品牌规范、禁用项和交付边界。'],
    }),
  ];

  const targetReport = stageReports.find(report => report.stage === targetStage) ?? stageReports[0];
  const minimumReport = stageReports[0];
  const scriptReport = stageReports[1];
  const productionReport = stageReports[2];
  const activeStage = productionReport.status === 'ready'
    ? 'production_ready'
    : scriptReport.status === 'ready'
      ? 'script_ready'
      : minimumReport.status === 'ready'
        ? 'minimum_viable_story'
        : targetStage;
  const blocked = !targetReport.can_proceed || !minimumReport.can_proceed;
  const targetRiskCount = targetReport.missing_items.filter(item => item.blocking_level === 'risk').length;
  const needsVerification = !blocked && targetRiskCount > 0;
  const futureReports = stageReports.filter(report => stageIndex(report.stage) > stageIndex(targetStage));
  const topMissing = uniqueMissingItems([
    ...minimumReport.missing_items,
    ...targetReport.missing_items,
  ]);
  const topOptional = uniqueMissingItems([
    ...futureReports.flatMap(report => [
      ...report.missing_items.map(item => ({ ...item, blocking_level: 'optional' as const })),
      ...report.optional_items,
    ]),
  ]);
  const generationPosture: MaterialGenerationPosture = blocked
    ? 'blocked_until_input'
    : needsVerification || targetReport.status === 'needs_input'
      ? 'draft_needs_verification'
      : productionReport.status !== 'ready'
        ? 'script_ready_production_pending'
        : 'ready';

  return {
    schema_version: 'material-sufficiency/v1',
    stage: targetStage,
    active_stage: activeStage,
    score: targetReport.score,
    can_generate: !blocked,
    can_generate_with_risks: !blocked && (needsVerification || topOptional.length > 0),
    blocked,
    needs_verification: needsVerification,
    generation_posture: generationPosture,
    next_stage: blocked ? targetStage : stageReports.find(report => !report.can_proceed)?.stage ?? nextStage(activeStage),
    downgrade_reason: blocked
      ? targetReport.missing_items.find(item => item.blocking_level === 'blocking')?.reason
      : needsVerification
        ? targetReport.missing_items.find(item => item.blocking_level === 'risk')?.reason
        : undefined,
    stage_reports: stageReports,
    missing_items: topMissing,
    optional_items: topOptional,
    token_risk: input.story_text && input.story_text.length > 12000 ? 'medium' : 'low',
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
      forbidden_moves: ['偏离原作主线或用知识库条目替换原作情节。'],
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

export function buildStoryCreationContract(input: StoryCreationContractInput): CreationContract {
  const preset = SCRIPT_TYPE_PRESETS[input.script_type] ?? SCRIPT_TYPE_PRESETS['文化解说'];
  const creationUseCase = normalizeCreationUseCase(input.creation_use_case, preset.video_type);
  const truthMode = normalizeTruthMode(input.truth_mode, creationUseCase, preset.video_type);
  const materialSufficiency = buildMaterialSufficiencyReport(input, creationUseCase, truthMode);
  const rules = truthModeRules(truthMode);

  return {
    schema_version: 'creation-contract/v1',
    creation_use_case: creationUseCase,
    truth_mode: truthMode,
    client_type: input.client_type,
    target_audience: input.target_audience,
    communication_goal: input.communication_goal,
    video_type: preset.video_type,
    presentation_style: preset.presentation_style,
    story_structure: preset.story_structure,
    narrative_pattern_ids: [],
    ...rules,
    material_sufficiency: materialSufficiency,
    delivery_expectation: compactStrings([
      input.output_mode === 'story_text'
        ? '当前工具输出：写入完整故事文本，作为剧本生产前置材料。'
        : '当前工具输出：写入脚本骨架，正文、对白和旁白仍需后续填充。',
      `素材当前目标阶段：${materialSufficiency.stage}`,
      materialSufficiency.active_stage ? `素材可安全推进到：${materialSufficiency.active_stage}` : undefined,
      materialSufficiency.generation_posture ? `生成姿态：${materialSufficiency.generation_posture}` : undefined,
      '本项目只准备内容与生产指挥材料，不执行图片、视频或后期实产。',
    ]),
  };
}

export function renderCreationContractMarkdown(contract: CreationContract): string[] {
  const lines: string[] = [
    '## 创作合同',
    `- **创作场景**：${contract.creation_use_case}`,
    `- **真实度模式**：${contract.truth_mode}`,
    `- **成片类型**：${contract.video_type}`,
    `- **表现形式**：${contract.presentation_style}`,
    `- **叙事结构**：${contract.story_structure}`,
  ];
  if (contract.client_type) lines.push(`- **客户/机构类型**：${contract.client_type}`);
  if (contract.target_audience) lines.push(`- **目标受众**：${contract.target_audience}`);
  if (contract.communication_goal) lines.push(`- **传播目标**：${contract.communication_goal}`);

  lines.push('', '### 真实度边界');
  for (const item of contract.allowed_fiction) lines.push(`- **允许虚构**：${item}`);
  for (const item of contract.must_verify) lines.push(`- **必须核实**：${item}`);
  for (const item of contract.forbidden_moves) lines.push(`- **禁止表达**：${item}`);
  for (const item of contract.required_disclaimers) lines.push(`- **必要声明**：${item}`);

  lines.push('', '### 素材 Gate');
  lines.push(`- **目标阶段**：${contract.material_sufficiency.stage}`);
  if (contract.material_sufficiency.active_stage) {
    lines.push(`- **当前可安全推进阶段**：${contract.material_sufficiency.active_stage}`);
  }
  lines.push(`- **评分**：${contract.material_sufficiency.score}/100`);
  lines.push(`- **可生成**：${contract.material_sufficiency.can_generate ? '是' : '否'}`);
  lines.push(`- **生成姿态**：${contract.material_sufficiency.generation_posture ?? 'ready'}`);
  if (contract.material_sufficiency.recommended_next_questions.length) {
    lines.push(`- **建议追问**：${contract.material_sufficiency.recommended_next_questions.join('；')}`);
  }

  if (contract.material_sufficiency.stage_reports?.length) {
    lines.push('', '### 三阶段素材报告');
    for (const report of contract.material_sufficiency.stage_reports) {
      lines.push(`- **${report.stage}**：${report.status}（${report.score}/100）`);
    }
  }

  if (contract.delivery_expectation.length) {
    lines.push('', '### 交付边界');
    for (const item of contract.delivery_expectation) lines.push(`- ${item}`);
  }

  return lines;
}
