import type {
  KnowledgePack,
  KnowledgePackMissing,
  KnowledgeSupplementTask,
  KnowledgeSupplementTaskCategory,
  MaterialSufficiencyMissingItem,
  MaterialSufficiencyReport,
  MaterialSufficiencyStage,
  ProductionMaterialMissingField,
  ProductionMaterialReadinessReport,
} from '@shared/types.js';

export function buildChinaCultureStorySupplementTasks(
  knowledgePack: KnowledgePack | undefined,
  materialSufficiency: MaterialSufficiencyReport | undefined,
  productionMaterialReadiness: ProductionMaterialReadinessReport | undefined,
  context: { storyId: string; createdAt: string },
): KnowledgeSupplementTask[] {
  const materialItems = materialSufficiency
    ? uniqueMaterialSufficiencyItems([
      ...materialSufficiency.missing_items,
      ...materialSufficiency.optional_items,
    ])
    : [];
  const usedMaterialItemIds = new Set<string>();
  const tasks: KnowledgeSupplementTask[] = (knowledgePack?.missing_needs ?? []).map((missing): KnowledgeSupplementTask => {
    const guidance = buildSupplementTaskGuidance(missing);
    const materialItem = materialItems.find(item => isMaterialItemForKnowledgeNeed(item, missing));
    if (materialItem) usedMaterialItemIds.add(materialItem.item_id);
    const message = normalizeMaterialMessage(missing.message);
    return {
      task_id: `${context.storyId}--supplement--${missing.need_id}`,
      need_id: missing.need_id,
      label: missing.label,
      description: `补充「${missing.label}」相关资料：${message}`,
      category: guidance.category,
      stage: materialItem ? materialSufficiencyItemStage(materialSufficiency, materialItem) : undefined,
      blocking_level: materialItem?.blocking_level,
      affects: materialItem?.affects,
      recommended_question: materialItem?.recommended_question,
      recommended_fields: guidance.recommendedFields,
      intake_prompt: mergeSupplementPrompts(guidance.intakePrompt, materialItem?.recommended_question),
      status: 'open',
      source: 'knowledge_pack_missing_need',
      created_at: context.createdAt,
    };
  });
  for (const item of materialItems) {
    if (usedMaterialItemIds.has(item.item_id)) continue;
    const guidance = buildSupplementTaskGuidance({
      need_id: item.item_id,
      label: item.label,
      message: item.reason,
    });
    tasks.push({
      task_id: `${context.storyId}--material-supplement--${safeTaskIdPart(item.item_id)}`,
      need_id: item.item_id,
      label: item.label,
      description: `补充「${item.label}」：${item.reason}`,
      category: guidance.category,
      stage: materialSufficiencyItemStage(materialSufficiency, item),
      blocking_level: item.blocking_level,
      affects: item.affects,
      recommended_question: item.recommended_question,
      recommended_fields: guidance.recommendedFields,
      intake_prompt: mergeSupplementPrompts(guidance.intakePrompt, item.recommended_question),
      status: 'open',
      source: 'material_sufficiency_missing_item',
      created_at: context.createdAt,
    });
  }
  if (productionMaterialReadiness) for (const field of productionMaterialReadiness.missing_fields) {
    const guidance = buildSupplementTaskGuidance({
      need_id: field.field_id,
      label: field.label,
      message: field.reason,
    });
    tasks.push({
      task_id: `${context.storyId}--production-template--${safeTaskIdPart(field.field_id)}`,
      need_id: `production_template_${field.field_id}`,
      label: field.label,
      description: `补齐「${productionMaterialReadiness.pack_label}」生产模板字段「${field.label}」：${field.reason}`,
      category: guidance.category,
      stage: field.stage,
      blocking_level: field.blocking_level,
      affects: productionFieldAffects(field),
      recommended_question: field.recommended_question,
      recommended_fields: [field.field_id],
      intake_prompt: mergeSupplementPrompts(guidance.intakePrompt, field.recommended_question),
      status: 'open',
      source: 'production_material_missing_field',
      created_at: context.createdAt,
    });
  }
  return tasks;
}

function productionFieldAffects(field: ProductionMaterialMissingField): string[] {
  const affects = new Set<string>(['production_material_readiness']);
  if (field.stage === 'minimum_viable_story') {
    affects.add('story_blueprint');
    affects.add('logline');
  }
  if (field.stage === 'script_ready') {
    affects.add('full_text');
    affects.add('scene_breakdown');
  }
  if (field.stage === 'production_ready') {
    affects.add('gears_segments');
    affects.add('asset_handoff');
  }
  return [...affects];
}

function normalizeMaterialMessage(message: string): string {
  return message
    .replace(/知识库/g, '项目素材')
    .replace(/知识包/g, '素材包');
}

function safeTaskIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}

function mergeSupplementPrompts(categoryPrompt: string, materialQuestion?: string): string {
  if (!materialQuestion || materialQuestion === categoryPrompt) return categoryPrompt;
  return `${categoryPrompt} ${materialQuestion}`;
}

function uniqueMaterialSufficiencyItems(items: MaterialSufficiencyMissingItem[]): MaterialSufficiencyMissingItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.item_id)) return false;
    seen.add(item.item_id);
    return true;
  });
}

function materialSufficiencyItemStage(
  materialSufficiency: MaterialSufficiencyReport | undefined,
  item: MaterialSufficiencyMissingItem,
): MaterialSufficiencyStage | undefined {
  for (const report of materialSufficiency?.stage_reports ?? []) {
    if (report.missing_items.some(missing => missing.item_id === item.item_id)) return report.stage;
    if (report.optional_items.some(optional => optional.item_id === item.item_id)) return report.stage;
  }
  return materialSufficiency?.stage;
}

function isMaterialItemForKnowledgeNeed(
  item: MaterialSufficiencyMissingItem,
  missing: KnowledgePackMissing,
): boolean {
  return item.item_id === missing.need_id
    || item.item_id === `missing_need_${missing.need_id}`
    || item.item_id.includes(missing.need_id)
    || item.label === missing.label;
}

function buildSupplementTaskGuidance(missing: { need_id: string; label: string; message: string }): {
  category: KnowledgeSupplementTaskCategory;
  recommendedFields: string[];
  intakePrompt: string;
} {
  const text = `${missing.need_id} ${missing.label} ${missing.message}`;
  if (missing.need_id === 'supporting_characters' || /配角|见证人|对手|上官|亲友/.test(text)) {
    return {
      category: 'supporting_character',
      recommendedFields: ['人物姓名或身份', '与主角关系', '在事件中的作用', '可用对白/行动线索'],
      intakePrompt: `补充${missing.label}时，优先写清人物关系和他们推动冲突的具体行动。`,
    };
  }
  if (missing.need_id === 'main_character' || /人物|主角|生平|经历/.test(text)) {
    return {
      category: 'person_experience',
      recommendedFields: ['人物身份与时代背景', '关键经历时间线', '核心选择或冲突', '与故事主线的关系'],
      intakePrompt: `补充${missing.label}时，优先写清人物经历、关键选择和可验证来源。`,
    };
  }
  if (/建筑|古迹|祠|庙|寺|楼|桥|塔|院|空间|场景|地点/.test(text)) {
    return {
      category: 'architecture_detail',
      recommendedFields: ['建筑或地点名称', '空间结构与方位', '材质/构件/纹样', '历史用途与现场可拍细节'],
      intakePrompt: `补充${missing.label}时，优先写清建筑细节、空间关系和可视化特征。`,
    };
  }
  if (missing.need_id === 'historical_events' || /事件|过程|冲突|案件|战役|变故|始末/.test(text)) {
    return {
      category: 'event_process',
      recommendedFields: ['事件起因', '关键参与者', '发展过程', '结果影响与争议点'],
      intakePrompt: `补充${missing.label}时，优先写清事件过程、因果链和史实边界。`,
    };
  }
  if (missing.need_id === 'regional_context' || /地域|地方|城市|省|县|乡|村/.test(text)) {
    return {
      category: 'regional_context',
      recommendedFields: ['地理位置', '时代背景', '地方风俗', '与故事主题的关系'],
      intakePrompt: `补充${missing.label}时，优先写清地方背景和它如何影响人物选择。`,
    };
  }
  if (missing.need_id === 'cultural_background' || /文化|民俗|宗教|礼制|工艺|仪式|非遗/.test(text)) {
    return {
      category: 'cultural_background',
      recommendedFields: ['文化概念', '实践流程', '象征意义', '当代传承或禁忌'],
      intakePrompt: `补充${missing.label}时，优先写清文化背景、流程和不可虚构的边界。`,
    };
  }
  return {
    category: 'general',
    recommendedFields: ['资料主题', '关键事实', '来源依据', '可用于画面的细节'],
    intakePrompt: `补充${missing.label}时，优先写清事实、来源和可转化为故事/画面的细节。`,
  };
}
