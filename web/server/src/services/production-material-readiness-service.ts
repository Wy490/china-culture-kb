import type {
  MaterialBlockingLevel,
  MaterialPack,
  MaterialSufficiencyStage,
  ProductionMaterialGateReport,
  ProductionMaterialMissingField,
  ProductionMaterialPack,
  ProductionMaterialReadinessReport,
  ProductionMaterialReadinessStatus,
} from '@shared/types.js';

export interface ProductionMaterialFieldSpec {
  label: string;
  stage: MaterialSufficiencyStage;
  blocking_level: MaterialBlockingLevel;
  keywords: string[];
  question?: string;
}

const FIELD_SPECS: Record<string, ProductionMaterialFieldSpec> = {
  project_name: field('项目名称', 'minimum_viable_story', 'blocking', ['项目名称', '片名', '主题', 'project', 'entry_name']),
  communication_goal: field('传播目标', 'minimum_viable_story', 'blocking', ['传播目标', '目标', '希望', '让观众', 'communication']),
  heritage_or_craft_type: field('非遗/工艺类别', 'minimum_viable_story', 'blocking', ['非遗', '工艺', '技艺', '民俗', '传承', 'craft', 'heritage']),
  confirmed_status_and_sources: field('确认状态与来源', 'script_ready', 'blocking', ['来源', '出处', '核实', '可信', '官方', 'source', 'verified']),
  official_catalog_or_resource_links: field('官方目录或资源链接', 'production_ready', 'risk', ['官方目录', '中国非遗', '官网', '目录', '链接', 'url', '资源']),
  materials: field('材料', 'script_ready', 'risk', ['材料', '原料', '纸', '线', '瓷', '木', '布', '泥', '颜料']),
  tools: field('工具', 'script_ready', 'risk', ['工具', '刻刀', '针', '绷架', '窑', '织机', '刷', '笔']),
  process_steps: field('流程步骤', 'script_ready', 'blocking', ['流程', '步骤', '工序', '制作', '制坯', '套印', '烧制', '演唱']),
  hand_actions: field('手部动作', 'production_ready', 'risk', ['手部', '动作', '握', '刺绣', '刻', '刷', '拉', '敲', '捻']),
  practitioner_or_transmission_line: field('传承人或传承关系', 'script_ready', 'risk', ['传承人', '学徒', '师徒', '匠人', '工坊', '班社']),
  community_or_practitioner_consent: field('社区/传承人参与边界', 'production_ready', 'risk', ['授权', '同意', '参与', '传承人', '社区', '展馆']),
  documentation_assets: field('记录/影音资产', 'production_ready', 'optional', ['影音', '视频', '照片', '档案', '展陈', 'documentation']),
  visual_symbols: field('视觉符号', 'production_ready', 'risk', ['视觉', '符号', '纹样', '图案', '色彩', '造型']),
  sound_or_texture_details: field('声音或质感细节', 'production_ready', 'optional', ['声音', '质感', '纹理', '气味', '触感', '鼓点']),
  modern_connection: field('当代连接', 'script_ready', 'risk', ['当代', '今天', '现代', '市场', '保护', '传播']),
  production_risks: field('生产风险', 'production_ready', 'risk', ['风险', '禁用', '安全', '待核实', '边界']),

  documentary_question: field('纪录核心问题', 'minimum_viable_story', 'blocking', ['问题', '为什么', '如何', 'question']),
  real_world_site_or_object: field('现实地点或实物入口', 'minimum_viable_story', 'blocking', ['旧址', '现场', '地点', '实物', '文物', '展陈', '碑刻', 'site']),
  source_quotes_or_source_cues: field('来源提示或引用线索', 'script_ready', 'blocking', ['引用', '来源', '文献', '史料', '展板', '档案']),
  timeline: field('时间线', 'script_ready', 'risk', ['时间线', '年代', '年', '朝代', '时期', 'timeline']),
  witness_or_expert_roles: field('见证人/专家角色', 'script_ready', 'risk', ['采访', '馆员', '专家', '研究者', '见证人', '传承人']),
  interview_clip_selection: field('采访片段选择', 'production_ready', 'risk', ['采访片段', '同期声', '口述', 'clip', 'interview']),
  field_notes: field('现场笔记', 'production_ready', 'optional', ['现场', '环境声', '光线', '人流', '路径', 'field']),
  b_roll_plan: field('B-roll 计划', 'production_ready', 'risk', ['b-roll', 'B-roll', '空镜', '补充画面', '素材镜头']),
  reconstruction_boundary: field('再现边界', 'script_ready', 'blocking', ['再现', '复原', '示意', '相传', '推测', '边界']),
  present_day_trace: field('当下痕迹', 'script_ready', 'risk', ['今天', '当下', '现存', '还能看到', '痕迹']),
  ambient_sound: field('环境声', 'production_ready', 'optional', ['环境声', '声音', '风声', '水声', '人声', '鼓声']),
  what_must_not_be_claimed: field('不可声称事项', 'script_ready', 'blocking', ['不得', '不能', '不可', '禁写', '待核实']),

  core_question: field('核心问题', 'minimum_viable_story', 'blocking', ['核心问题', '问题', '为什么', '如何', '到底', 'question']),
  audience_level: field('受众认知层级', 'minimum_viable_story', 'risk', ['受众', '小白', '入门', '中学生', '游客', 'audience']),
  argument_points: field('讲解论点', 'script_ready', 'blocking', ['论点', '观点', '要点', 'argument']),
  knowledge_outline: field('知识大纲', 'script_ready', 'blocking', ['知识大纲', '层级', '结构', '提纲', 'outline']),
  concept_definitions: field('概念定义', 'script_ready', 'risk', ['概念', '定义', '术语', '是什么', 'definition']),
  knowledge_steps: field('知识步骤', 'script_ready', 'risk', ['步骤', '脉络', '顺序', '流程', 'step']),
  step_sequence: field('步骤序列', 'script_ready', 'blocking', ['步骤', '序列', '流程', '先', '再', '最后', 'step']),
  concrete_examples: field('具体例子', 'script_ready', 'risk', ['例子', '案例', '比如', '例如', 'example']),
  analogy_or_visual_metaphor: field('类比或视觉隐喻', 'production_ready', 'optional', ['类比', '隐喻', '好比', 'visual metaphor']),
  diagram_or_caption_plan: field('图示/字幕计划', 'production_ready', 'risk', ['图示', '字幕', '关键词', '信息图', 'caption']),
  source_cues: field('来源线索', 'script_ready', 'blocking', ['来源', '出处', '文献', '展陈', 'source']),
  misconception_or_boundary: field('误区或边界', 'production_ready', 'risk', ['误区', '边界', '不得', '不能', '易错']),
  recap_sentence: field('总结记忆句', 'production_ready', 'optional', ['总结', '记忆点', '一句话', '复盘', 'recap']),

  audience_age_band: field('儿童受众年龄段', 'minimum_viable_story', 'blocking', ['3-6岁', '7-9岁', '10-12岁', '年龄', '儿童', '少儿', '亲子']),
  child_safe_conflict: field('儿童安全冲突', 'script_ready', 'blocking', ['温和阻力', '善意张力', '误会', '选择', '不恐怖', 'child safe']),
  protagonist_choice: field('主角选择', 'script_ready', 'blocking', ['选择', '决定', '帮助', '勇敢', '道歉', '尝试']),
  wonder_or_cultural_symbol: field('奇观或文化符号', 'minimum_viable_story', 'risk', ['文化符号', '奇观', '神奇', '纹样', '节日', '道具']),
  emotional_resolution: field('情绪安放', 'script_ready', 'risk', ['情绪', '安放', '和解', '复盘', '安心', '成长']),
  parent_teacher_note: field('家长/教师提示', 'production_ready', 'optional', ['家长', '老师', '教师', '亲子', '课堂', '延伸']),

  opening_hook: field('开场钩子', 'minimum_viable_story', 'blocking', ['前三秒', '三秒', '开场', '钩子', '问题', '反差', 'hook']),
  platform_context: field('平台语境', 'minimum_viable_story', 'risk', ['竖屏', '短视频', '平台', '社媒', '评论区', '完播']),
  share_trigger: field('分享触发点', 'script_ready', 'risk', ['分享', '转发', '共鸣', '反转', '冷知识', '原来']),
  comment_prompt: field('评论互动提示', 'production_ready', 'optional', ['评论', '投票', '你觉得', '留言', '互动']),
  vertical_shot_plan: field('竖屏镜头计划', 'production_ready', 'risk', ['竖屏', '9:16', '近景', '字幕', '快剪', '镜头']),
  beat_interval: field('短视频节奏点', 'script_ready', 'risk', ['10秒', '15秒', '节奏', '转折', '揭示', 'beat']),
  fact_boundary_card: field('事实边界卡', 'script_ready', 'blocking', ['边界卡', '事实边界', '不得', '待核实', '来源']),

  learning_objective: field('学习目标', 'minimum_viable_story', 'blocking', ['学习目标', '学会', '掌握', '能说出', '能理解']),
  learner_profile: field('学习者画像', 'minimum_viable_story', 'risk', ['学习者', '学生', '学员', '受众', '年级', '基础']),
  speaker_position: field('主讲人定位', 'minimum_viable_story', 'risk', ['主讲人', '讲述者', '老师', '主持人', 'speaker']),
  case_examples: field('案例例子', 'script_ready', 'risk', ['案例', '例子', '比如', '例如', 'case']),
  slide_or_board_assets: field('板书/课件资产', 'production_ready', 'risk', ['板书', '课件', '字幕', '图示', 'slide', '白板']),
  audience_takeaway: field('受众带走点', 'production_ready', 'optional', ['带走', '总结', '行动', '复盘', 'takeaway']),
  practice_task: field('练习任务', 'production_ready', 'risk', ['练习', '任务', '互动题', '试一试', 'practice']),
  assessment_check: field('掌握检查', 'production_ready', 'risk', ['检查', '测验', '判断题', '选择题', 'assessment']),

  episode_hook: field('第一格钩子', 'minimum_viable_story', 'blocking', ['钩子', '第一格', '开场', '异常', '反转', 'hook']),
  world_and_truth_mode: field('世界观与真实度模式', 'minimum_viable_story', 'blocking', ['世界观', '真实度', '虚构', '史实', '传说', 'truth']),
  protagonist_goal: field('主角目标', 'minimum_viable_story', 'blocking', ['主角', '目标', '想要', '必须', 'protagonist']),
  opponent_or_pressure: field('对手或压力', 'script_ready', 'blocking', ['对手', '压力', '阻止', '危机', '冲突']),
  relationship_collision: field('关系碰撞', 'script_ready', 'risk', ['关系', '误会', '对白', '争执', '碰撞']),
  scene_anchor: field('场景锚点', 'minimum_viable_story', 'blocking', ['场景', '地点', '空间', '锚点', 'scene']),
  character_stability_tags: field('角色稳定标签', 'production_ready', 'risk', ['角色稳定', '服饰', '发式', '随身物', '表情']),
  dialogue_bubbles: field('对白气泡', 'script_ready', 'risk', ['对白', '气泡', '台词', '旁白']),
  emotion_beats: field('情绪节拍', 'script_ready', 'risk', ['情绪', '表情', '节拍', '反应']),
  shot_prompt_layers: field('镜头提示词分层', 'production_ready', 'risk', ['基础设定', '氛围', '画质', '画面内容', '提示词']),
  reference_images_or_keyframes: field('参考图或关键帧', 'production_ready', 'risk', ['参考图', '关键帧', 'keyframe', 'reference image']),
  identity_motion_consistency_plan: field('身份动作一致性计划', 'production_ready', 'risk', ['一致性', '身份', '动作方向', '视线', '道具位置']),
  single_shot_test: field('单镜头测试', 'production_ready', 'risk', ['单镜头', '单张', '测试']),
  multi_shot_continuity: field('多分镜连续性', 'production_ready', 'risk', ['多分镜', '连续性', '转场', '镜头连续']),
  transition_plan: field('转场计划', 'production_ready', 'optional', ['转场', '承接', '镜头切换']),
  ending_hook: field('结尾钩子', 'script_ready', 'risk', ['结尾钩子', '追看', '悬念', 'ending']),
  forbidden_claims: field('禁用/不可声称内容', 'script_ready', 'blocking', ['禁用', '不得', '不可', '待核实', '虚构边界']),
};

const STAGE_ORDER: MaterialSufficiencyStage[] = ['minimum_viable_story', 'script_ready', 'production_ready'];

export function buildProductionMaterialReadinessReport(input: {
  productionMaterialPack?: ProductionMaterialPack;
  materialPack?: MaterialPack;
  contextText?: string;
}): ProductionMaterialReadinessReport | undefined {
  const { productionMaterialPack } = input;
  if (!productionMaterialPack) return undefined;

  const materialText = normalizeSearchText(materialPackToText(input.materialPack, input.contextText));
  const fields = productionMaterialPack.material_template.required_fields;
  const availableFields = fields.filter(fieldId =>
    hasFieldEvidence(fieldId, productionMaterialPack.video_type, materialText, input.materialPack),
  );
  const missingFields = fields
    .filter(fieldId => !availableFields.includes(fieldId))
    .map((fieldId, index) => missingFieldForTemplateField(fieldId, productionMaterialPack, index));
  const gateReports = STAGE_ORDER.map(stage =>
    buildGateReport(stage, productionMaterialPack, availableFields, missingFields),
  );
  const score = scoreReadiness(fields, availableFields, missingFields);
  const status = readinessStatus(missingFields);

  return {
    schema_version: 'production-material-readiness/v1',
    video_type: productionMaterialPack.video_type,
    pack_label: productionMaterialPack.label,
    score,
    status,
    available_fields: availableFields,
    missing_fields: missingFields,
    gate_reports: gateReports,
    recommended_next_questions: missingFields
      .map(field => field.recommended_question)
      .filter((question, index, arr) => arr.indexOf(question) === index)
      .slice(0, 8),
  };
}

export function getProductionMaterialFieldSpec(fieldId: string): ProductionMaterialFieldSpec | undefined {
  return FIELD_SPECS[fieldId];
}

export function listProductionMaterialFieldIds(): string[] {
  return Object.keys(FIELD_SPECS).sort((a, b) => a.localeCompare(b));
}

function field(
  label: string,
  stage: MaterialSufficiencyStage,
  blocking_level: MaterialBlockingLevel,
  keywords: string[],
  question?: string,
): ProductionMaterialFieldSpec {
  return { label, stage, blocking_level, keywords, question };
}

function buildGateReport(
  stage: MaterialSufficiencyStage,
  pack: ProductionMaterialPack,
  availableFields: string[],
  missingFields: ProductionMaterialMissingField[],
): ProductionMaterialGateReport {
  const stageAvailable = availableFields.filter(fieldId => fieldStage(fieldId) === stage);
  const stageMissing = missingFields.filter(field => field.stage === stage);
  return {
    stage,
    status: readinessStatus(stageMissing),
    required_items: gateItemsForStage(pack, stage),
    available_fields: stageAvailable,
    missing_fields: stageMissing,
    notes: stageMissing.length > 0
      ? [`需补齐 ${stageMissing.map(field => field.label).join('、')}`]
      : ['当前素材已覆盖该阶段生产模板字段。'],
  };
}

function gateItemsForStage(pack: ProductionMaterialPack, stage: MaterialSufficiencyStage): string[] {
  if (stage === 'minimum_viable_story') return pack.material_template.minimum_viable_story_gate;
  if (stage === 'script_ready') return pack.material_template.script_ready_gate;
  return pack.material_template.production_ready_gate;
}

function readinessStatus(missingFields: ProductionMaterialMissingField[]): ProductionMaterialReadinessStatus {
  if (missingFields.some(field => field.blocking_level === 'blocking')) return 'blocked';
  if (missingFields.length > 0) return 'needs_input';
  return 'ready';
}

function scoreReadiness(
  fields: string[],
  availableFields: string[],
  missingFields: ProductionMaterialMissingField[],
): number {
  const totalWeight = fields.reduce((sum, fieldId) => sum + fieldWeight(fieldStage(fieldId)), 0);
  const availableWeight = availableFields.reduce((sum, fieldId) => sum + fieldWeight(fieldStage(fieldId)), 0);
  const blockingPenalty = missingFields.filter(field => field.blocking_level === 'blocking').length * 6;
  if (totalWeight <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((availableWeight / totalWeight) * 100 - blockingPenalty)));
}

function fieldStage(fieldId: string): MaterialSufficiencyStage {
  return FIELD_SPECS[fieldId]?.stage ?? 'production_ready';
}

function fieldWeight(stage: MaterialSufficiencyStage): number {
  if (stage === 'minimum_viable_story') return 3;
  if (stage === 'script_ready') return 2;
  return 1;
}

function missingFieldForTemplateField(
  fieldId: string,
  pack: ProductionMaterialPack,
  index: number,
): ProductionMaterialMissingField {
  const spec = FIELD_SPECS[fieldId] ?? field(humanizeFieldId(fieldId), 'production_ready', 'risk', []);
  const fallbackQuestion = pack.material_template.supplement_questions[index % Math.max(1, pack.material_template.supplement_questions.length)]
    ?? `请补充「${spec.label}」。`;
  return {
    field_id: fieldId,
    label: spec.label,
    stage: spec.stage,
    blocking_level: spec.blocking_level,
    reason: `当前素材不足以覆盖「${pack.label}」生产模板字段「${spec.label}」。`,
    recommended_question: spec.question ?? fallbackQuestion,
  };
}

function hasFieldEvidence(
  fieldId: string,
  videoType: ProductionMaterialPack['video_type'],
  materialText: string,
  materialPack: MaterialPack | undefined,
): boolean {
  if (fieldId === 'project_name') return Boolean(materialPack?.primary_materials.length || materialPack?.brand_or_institution_profile?.name || materialPack?.source_work_profile?.title);
  if (fieldId === 'confirmed_status_and_sources') return Boolean(materialPack?.verified_facts.length || materialPack?.uncertain_claims.length || /来源|出处|核实|source|verified/.test(materialText));
  if (fieldId === 'production_risks') return Boolean(materialPack?.uncertain_claims.length || materialPack?.brand_or_institution_profile?.forbidden_claims?.length || /风险|禁用|待核实|边界/.test(materialText));
  if (fieldId === 'visual_symbols') return Boolean(materialPack?.visual_assets.length || materialPackHasPurpose(materialPack, 'visual_asset') || /视觉|图案|纹样|符号/.test(materialText));
  if (fieldId === 'world_and_truth_mode') return /真实度|虚构|传说|史实|fictional|truth|相传|待核实/.test(materialText);
  if (fieldId === 'forbidden_claims') return /不得|不能|不可|禁用|待核实|边界/.test(materialText);
  if (fieldId === 'heritage_or_craft_type' && videoType === 'heritage_promo') return /非遗|工艺|技艺|民俗|传承/.test(materialText);
  if (fieldId === 'scene_anchor') return /场景|地点|空间|洞|楼|书院|江|馆|旧址|scene/.test(materialText);
  const spec = FIELD_SPECS[fieldId];
  if (!spec) return materialText.includes(fieldId.toLowerCase());
  return spec.keywords.some(keyword => materialText.includes(keyword.toLowerCase()));
}

function materialPackHasPurpose(materialPack: MaterialPack | undefined, purpose: string): boolean {
  if (!materialPack) return false;
  return [
    ...materialPack.primary_materials,
    ...materialPack.supporting_materials,
    ...materialPack.reference_materials,
  ].some(material => material.purpose.some(item => item === purpose));
}

function materialPackToText(materialPack: MaterialPack | undefined, contextText: string | undefined): string {
  if (!materialPack) return contextText ?? '';
  const materialLines = [
    ...materialPack.primary_materials,
    ...materialPack.supporting_materials,
    ...materialPack.reference_materials,
  ].flatMap(material => [
    material.title,
    material.summary,
    material.provenance,
    material.role_in_story,
    ...(material.tags ?? []),
    ...material.purpose,
  ]);
  const assetLines = materialPack.visual_assets.flatMap(asset => [
    asset.label,
    asset.kind,
    asset.description,
  ]);
  return [
    contextText,
    ...materialLines,
    ...assetLines,
    ...materialPack.verified_facts,
    ...materialPack.uncertain_claims,
    ...materialPack.creative_space,
    materialPack.brand_or_institution_profile?.name,
    materialPack.brand_or_institution_profile?.client_type,
    ...(materialPack.brand_or_institution_profile?.verified_claims ?? []),
    ...(materialPack.brand_or_institution_profile?.forbidden_claims ?? []),
    materialPack.source_work_profile?.title,
    materialPack.source_work_profile?.adaptation_boundary,
    ...(materialPack.source_work_profile?.core_characters ?? []),
    ...(materialPack.source_work_profile?.must_keep ?? []),
  ].filter((item): item is string => Boolean(item)).join('\n');
}

function normalizeSearchText(text: string): string {
  return text.toLowerCase();
}

function humanizeFieldId(fieldId: string): string {
  return fieldId
    .split('_')
    .filter(Boolean)
    .join(' ');
}
