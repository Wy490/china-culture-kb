export type MachineProductionGuidanceField =
  | 'dialogue_tone'
  | 'dramatization_space'
  | 'visual_symbols'
  | 'forbidden_expressions';

export interface MachineProductionGuidanceValue {
  value: string;
  output_role: 'production_instruction' | 'review_boundary';
  evidence_refs: string[];
}

export interface MachineProductionFieldGuidance {
  schema_version: 'machine-production-field-guidance/v1';
  derivation_kind: 'deterministic_boundary_only';
  facts_added: false;
  source_markdown_writeback_allowed: false;
  fields: Record<
    Exclude<MachineProductionGuidanceField, 'visual_symbols'>,
    MachineProductionGuidanceValue
  > & Partial<Record<'visual_symbols', MachineProductionGuidanceValue>>;
}

export interface MachineProductionGuidanceInput {
  name: string;
  type: string;
  summary?: string;
  story?: string;
  culturalSignificance?: string;
  credibility?: string;
  unverifiedPoints?: string[] | string;
  relatedLocations?: Array<{ name: string; description?: string }> | string;
  asset_usage?: readonly string[];
  asset_split?: {
    characters?: readonly string[];
    scenes?: readonly string[];
    character_props?: readonly string[];
    scene_props?: readonly string[];
  };
}

interface TypeGuidance {
  dialogueTone: string;
  dramatizationSpace: string;
  forbiddenExpressions: string;
}

/**
 * Builds production instructions from structural metadata only. The result is
 * deliberately an execution boundary, not a new cultural-fact source.
 */
export function buildMachineProductionFieldGuidance(
  input: MachineProductionGuidanceInput,
): MachineProductionFieldGuidance {
  const typeGuidance = guidanceForType(input.type);
  const unverifiedPoints = normalizeTextList(input.unverifiedPoints);
  const locationNames = normalizeLocationNames(input.relatedLocations);
  const visualSymbols = uniqueNonEmpty([
    ...(input.asset_split?.character_props ?? []),
    ...(input.asset_split?.scene_props ?? []),
    ...(input.asset_split?.scenes ?? []),
    ...locationNames,
  ]).slice(0, 4);
  const evidenceRefs = uniqueNonEmpty([
    input.name ? `条目:${input.name}` : '',
    input.type ? `类型:${input.type}` : '',
    input.summary?.trim() ? '字段:summary' : '',
    input.story?.trim() ? '字段:story' : '',
    input.culturalSignificance?.trim() ? '字段:culturalSignificance' : '',
    input.credibility?.trim() ? `可信度:${input.credibility.trim()}` : '',
    unverifiedPoints.length ? '字段:unverifiedPoints' : '',
    locationNames.length ? '字段:relatedLocations' : '',
    input.asset_usage?.length ? '字段:asset_usage' : '',
    input.asset_split ? '字段:asset_split' : '',
  ]);

  const fields: MachineProductionFieldGuidance['fields'] = {
    dialogue_tone: productionInstruction(typeGuidance.dialogueTone, evidenceRefs),
    dramatization_space: productionInstruction(typeGuidance.dramatizationSpace, evidenceRefs),
    forbidden_expressions: reviewBoundary(
      [
        typeGuidance.forbiddenExpressions,
        unverifiedPoints.length
          ? `待核验点只作为核验清单，不得补写成确定事实：${unverifiedPoints.map(summarizeBoundaryItem).join('；')}。`
          : '未提供待核验点时，不得据空白自行补造姓名、年代、对白、因果或唯一性结论。',
      ].join(' '),
      evidenceRefs,
    ),
  };

  if (visualSymbols.length) {
    fields.visual_symbols = productionInstruction(
      `只从已有资产与地点中选取视觉锚点：${visualSymbols.join('、')}；可调整构图、景别和出场顺序，不得把视觉联想写成文化事实。`,
      evidenceRefs,
    );
  }

  return {
    schema_version: 'machine-production-field-guidance/v1',
    derivation_kind: 'deterministic_boundary_only',
    facts_added: false,
    source_markdown_writeback_allowed: false,
    fields,
  };
}

function guidanceForType(type: string): TypeGuidance {
  if (/历史|人物|旧址|革命|文物|古迹|遗址|书院|掌故/.test(type)) {
    return {
      dialogueTone: '对白与旁白保持克制、符合时代语感；只表达来源可支撑的立场，不复原无出处的原话。',
      dramatizationSpace: '可戏剧化场面调度、动作衔接、观察视角和情绪过渡；关键年代、身份、决定、因果及引语必须受来源约束。',
      forbiddenExpressions: '不得杜撰决定性事件、精确原话或心理定论，不得用后世概念替代当时语境。',
    };
  }
  if (/非遗|工艺|技艺|手工|织|绣|陶|瓷|雕|漆|造纸|印刷/.test(type)) {
    return {
      dialogueTone: '对白围绕动作、材料、工具和术语展开，以可见操作承载讲解，避免空泛赞美和万能匠人腔。',
      dramatizationSpace: '可戏剧化任务压力、学习过程、动作节奏与工序间的衔接；材料、工具、工序、传承身份和保护级别须由来源支撑。',
      forbiddenExpressions: '不得混编不同地区或流派的工序，不得无来源宣称唯一、首创、失传、皇家专用或固定传承谱系。',
    };
  }
  if (/神话|传说|民间故事|志异|民俗/.test(type)) {
    return {
      dialogueTone: '采用口述感和地方叙事节奏，用“相传”“某一版本中”等措辞标示传说身份。',
      dramatizationSpace: '可戏剧化人物行动、悬念、象征与口传版本的叙事衔接；现实地点和民俗事实仍须与来源边界分开。',
      forbiddenExpressions: '不得把超自然情节写成已证实事实，不得把单一口传版本表述为唯一版本。',
    };
  }
  if (/戏曲|音乐|舞蹈|表演|曲艺|歌舞/.test(type)) {
    return {
      dialogueTone: '对白和旁白以表演动作、舞台关系与可核术语为中心，不代替专业唱词或无出处的行话。',
      dramatizationSpace: '可戏剧化排演压力、台前幕后节奏和观演关系；声腔、角色行当、动作程式与流派归属须有来源。',
      forbiddenExpressions: '不得混用不同地区、剧种或流派的声腔程式，不得伪造传统唱词与代表性谱系。',
    };
  }
  if (/饮食|美食|茶|酒|菜|小吃/.test(type)) {
    return {
      dialogueTone: '对白突出感官、动作和地方生活语境，避免夸张功效与来源不明的宫廷轶事。',
      dramatizationSpace: '可戏剧化备料、制作、等待和分享的节奏；配方、起源、地域唯一性及历史身份必须受来源约束。',
      forbiddenExpressions: '不得无来源宣称治病保健、皇家御用、千年不变、全国唯一或确定发明人。',
    };
  }
  return {
    dialogueTone: '对白与旁白使用清晰、具体、可表演的表达；事实陈述只取自已有条目，不补造精确原话。',
    dramatizationSpace: '可戏剧化动作、场面调度、情绪过渡和叙事顺序；身份、时间、地点、因果与文化结论必须受来源约束。',
    forbiddenExpressions: '不得把推测、传说或创作补位写成已确认事实，不得无来源制造唯一性、权威性或精确引语。',
  };
}

function productionInstruction(value: string, evidenceRefs: string[]): MachineProductionGuidanceValue {
  return { value, output_role: 'production_instruction', evidence_refs: evidenceRefs };
}

function reviewBoundary(value: string, evidenceRefs: string[]): MachineProductionGuidanceValue {
  return { value, output_role: 'review_boundary', evidence_refs: evidenceRefs };
}

function normalizeTextList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return uniqueNonEmpty(value);
  if (!value?.trim()) return [];
  return uniqueNonEmpty(value.split(/[；;。\n]+/));
}

function normalizeLocationNames(
  value: MachineProductionGuidanceInput['relatedLocations'],
): string[] {
  if (typeof value === 'string') {
    return uniqueNonEmpty(value.split(/[；;、，,\n]+/).map(item => item.split(/[：:]/)[0] ?? ''));
  }
  return uniqueNonEmpty((value ?? []).map(location => location.name));
}

function summarizeBoundaryItem(value: string): string {
  const clean = value.trim().replace(/[。；;]+$/, '');
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    const clean = value?.trim();
    if (!clean || result.includes(clean)) continue;
    result.push(clean);
  }
  return result;
}
