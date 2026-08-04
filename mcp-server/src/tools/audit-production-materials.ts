import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullEntryDetail, VideoType } from '../types.js';
import { parseEntries, parseFullEntry, readAllProvinceFiles } from '../lib/markdown.js';
import {
  buildMachineProductionFieldGuidance,
  type MachineProductionGuidanceField,
} from '../lib/production-field-guidance.js';

export type ProductionCardField =
  | 'confirmed_facts'
  | 'unverified_facts'
  | 'dramatization_space'
  | 'characters'
  | 'scenes'
  | 'props'
  | 'costume_or_era'
  | 'visual_symbols'
  | 'dialogue_tone'
  | 'forbidden_expressions'
  | 'source_grades';

export interface FieldAudit {
  field: ProductionCardField;
  label: string;
  present: boolean;
  reason: string;
  evidence_origin: 'structured_detail' | 'raw_markdown' | 'missing';
}

interface TypeTemplateAudit {
  video_type: VideoType;
  label: string;
  recommended: boolean;
  missing_fields: string[];
  readiness_score: number;
}

export interface EntryProductionAudit {
  name: string;
  province: string;
  region: string;
  type: string;
  credibility: string;
  source_count: number;
  related_location_count: number;
  has_verification_method: boolean;
  has_explicit_verification_method_section: boolean;
  has_merged_credibility_verification_section: boolean;
  unverified_point_count: number;
  has_machine_metadata: boolean;
  has_asset_split: boolean;
  production_card_score: number;
  missing_production_fields: ProductionCardField[];
  machine_guidance_fields: ProductionCardField[];
  effective_missing_production_fields: ProductionCardField[];
  field_audits: FieldAudit[];
  type_template_audits: TypeTemplateAudit[];
  priority: 'high' | 'medium' | 'low';
  priority_reasons: string[];
}

export interface ProductionMaterialAuditReport {
  schema_version: 'kb-production-material-audit/v1';
  generated_at: string;
  totals: {
    files: number;
    entries: number;
    sources: number;
    average_sources_per_entry: number;
    entries_missing_sources: number;
    entries_missing_related_locations: number;
    missing_verification_method: number;
    missing_explicit_verification_method_section: number;
    entries_with_merged_credibility_verification: number;
    entries_with_unverified_points: number;
    entries_with_machine_metadata: number;
    entries_with_asset_split: number;
    non_enum_credibility: number;
    raw_missing_production_field_count: number;
    source_authored_fields_visible_only_in_raw_markdown: number;
    machine_guidance_field_count: number;
    effective_missing_production_field_count: number;
    entries_with_machine_guidance: number;
  };
  by_province: Array<{ province: string; count: number }>;
  by_type: Array<{ type: string; count: number }>;
  credibility_distribution: Array<{ credibility: string; count: number }>;
  top_priority_entries: EntryProductionAudit[];
  entries: EntryProductionAudit[];
  markdown: string;
}

interface ProductionPackFile {
  packs: Array<{
    video_type: VideoType;
    label: string;
    material_template: {
      required_fields: string[];
    };
  }>;
}

const ALLOWED_CREDIBILITY = new Set(['可靠', '基本可靠', '待核实', '存疑', '混合']);
const CORE_PRODUCTION_FIELDS: Array<{ field: ProductionCardField; label: string }> = [
  { field: 'confirmed_facts', label: '已确认事实' },
  { field: 'unverified_facts', label: '待核事实' },
  { field: 'dramatization_space', label: '可戏剧化空间' },
  { field: 'characters', label: '人物' },
  { field: 'scenes', label: '场景' },
  { field: 'props', label: '道具' },
  { field: 'costume_or_era', label: '服饰/时代' },
  { field: 'visual_symbols', label: '视觉符号' },
  { field: 'dialogue_tone', label: '对白口吻' },
  { field: 'forbidden_expressions', label: '禁用表达' },
  { field: 'source_grades', label: '来源等级' },
];

const VIDEO_TYPE_LABELS: Partial<Record<VideoType, string>> = {
  character_story: '人物故事片',
  historical_drama: '历史剧情片',
  legend_story: '传说故事片',
  culture_promo: '文化宣传片',
  heritage_promo: '非遗/工艺宣传片',
  city_brand_promo: '城市品牌宣传片',
  scene_short: '场景短片',
  landscape_mood: '风景氛围片',
  documentary_short: '微纪录片',
  explainer_video: '知识讲解视频',
  children_story: '儿童故事片',
  social_short: '竖屏短视频',
  lecture_video: '宣讲片',
  education_training: '教育/培训片',
  ai_comic_drama: 'AI漫剧',
};

const AUDITED_VIDEO_TYPES: VideoType[] = [
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'children_story',
  'social_short',
  'lecture_video',
  'education_training',
  'ai_comic_drama',
];

export async function auditProductionMaterials(): Promise<ProductionMaterialAuditReport> {
  const allFiles = await readAllProvinceFiles();
  const productionPacks = await loadProductionPacks();
  const entries: EntryProductionAudit[] = [];

  for (const [province, content] of allFiles) {
    const searchEntries = parseEntries(content, province);
    for (const entry of searchEntries) {
      const detail = parseFullEntry(content, entry.name);
      if (!detail) continue;
      entries.push(auditEntry(detail, productionPacks, extractEntryMarkdown(content, entry.name)));
    }
  }

  const totals = buildTotals(allFiles.size, entries);
  const baseReport: Omit<ProductionMaterialAuditReport, 'markdown'> = {
    schema_version: 'kb-production-material-audit/v1',
    generated_at: new Date().toISOString(),
    totals,
    by_province: countBy(entries, entry => entry.province, 'province'),
    by_type: countBy(entries, entry => entry.type, 'type'),
    credibility_distribution: countBy(entries, entry => entry.credibility, 'credibility'),
    top_priority_entries: [...entries]
      .sort((a, b) => priorityWeight(b) - priorityWeight(a) || a.production_card_score - b.production_card_score)
      .slice(0, 30),
    entries,
  };

  return {
    ...baseReport,
    markdown: buildMarkdown(baseReport),
  };
}

function auditEntry(
  detail: FullEntryDetail,
  productionPacks: ProductionPackFile['packs'],
  rawEntryText: string,
): EntryProductionAudit {
  // Some production-ready fields intentionally live in dedicated Markdown
  // sections that are not part of FullEntryDetail's public retrieval contract.
  // Audit both views so source-authored guidance is not misclassified as a gap.
  const structuredText = entryText(detail);
  const text = [structuredText, rawEntryText].filter(Boolean).join('\n');
  const fieldAudits = CORE_PRODUCTION_FIELDS.map(item => {
    const structuredAudit = auditProductionField(item.field, item.label, detail, structuredText);
    if (structuredAudit.present) {
      return { ...structuredAudit, evidence_origin: 'structured_detail' as const };
    }
    const sourceAudit = auditProductionField(item.field, item.label, detail, text);
    return {
      ...sourceAudit,
      evidence_origin: sourceAudit.present ? 'raw_markdown' as const : 'missing' as const,
    };
  });
  const missingProductionFields = fieldAudits.filter(item => !item.present).map(item => item.field);
  const machineGuidance = buildMachineProductionFieldGuidance({
    name: detail.name,
    type: detail.type,
    summary: detail.summary,
    story: detail.story,
    culturalSignificance: detail.culturalSignificance,
    credibility: detail.credibility,
    unverifiedPoints: detail.unverifiedPoints,
    relatedLocations: detail.relatedLocations,
    asset_usage: detail.asset_usage,
    asset_split: detail.asset_split,
  });
  const machineGuidanceFields = missingProductionFields.filter(field =>
    isMachineGuidanceField(field) && Boolean(machineGuidance.fields[field]),
  );
  const effectiveMissingProductionFields = missingProductionFields.filter(
    field => !machineGuidanceFields.includes(field),
  );
  const productionCardScore = Math.round(((CORE_PRODUCTION_FIELDS.length - missingProductionFields.length) / CORE_PRODUCTION_FIELDS.length) * 100);
  const typeTemplateAudits = productionPacks
    .filter(pack => AUDITED_VIDEO_TYPES.includes(pack.video_type))
    .map(pack => auditTypeTemplate(pack, detail, text));
  const priorityReasons = priorityReasonsForEntry(detail, rawEntryText, fieldAudits, typeTemplateAudits);

  return {
    name: detail.name,
    province: detail.province,
    region: detail.region,
    type: detail.type,
    credibility: detail.credibility,
    source_count: detail.sources.length,
    related_location_count: detail.relatedLocations.length,
    has_verification_method: hasUsableVerification(detail, rawEntryText),
    has_explicit_verification_method_section: hasSection(rawEntryText, '核实方法'),
    has_merged_credibility_verification_section: hasSection(rawEntryText, '可信度与核实'),
    unverified_point_count: detail.unverifiedPoints.length,
    has_machine_metadata: Boolean(detail.knowledge_domain || detail.entry_role || detail.era || detail.asset_usage?.length),
    has_asset_split: hasAssetSplit(detail),
    production_card_score: productionCardScore,
    missing_production_fields: missingProductionFields,
    machine_guidance_fields: machineGuidanceFields,
    effective_missing_production_fields: effectiveMissingProductionFields,
    field_audits: fieldAudits,
    type_template_audits: typeTemplateAudits,
    priority: priorityFromReasons(priorityReasons),
    priority_reasons: priorityReasons,
  };
}

function auditProductionField(
  field: ProductionCardField,
  label: string,
  detail: FullEntryDetail,
  text: string,
): Omit<FieldAudit, 'evidence_origin'> {
  const normalized = text.toLowerCase();
  switch (field) {
    case 'confirmed_facts':
      return result(field, label, detail.sources.length > 0 && ALLOWED_CREDIBILITY.has(detail.credibility), '需要来源和可信度枚举支撑已确认事实。');
    case 'unverified_facts':
      return result(field, label, detail.unverifiedPoints.length > 0 || /待核实|存疑|不详/.test(text), '需要待核事实或不确定点清单。');
    case 'dramatization_space':
      return result(field, label, /可戏剧化|创作空间|相传|传说|改编|虚构|不等同史实/.test(text), '需要说明哪些内容可戏剧化、哪些不能写成事实。');
    case 'characters':
      return result(field, label, Boolean(detail.asset_split?.characters.length) || /人物|主角|传承人|诗人|将领|书生|少年/.test(text), '需要人物或角色资产。');
    case 'scenes':
      return result(field, label, Boolean(detail.asset_split?.scenes.length) || detail.relatedLocations.length > 0 || /场景|地点|旧址|书院|江|楼|馆|祠/.test(text), '需要可拍场景或地点资产。');
    case 'props':
      return result(field, label, Boolean(detail.asset_split?.character_props.length || detail.asset_split?.scene_props.length) || /道具|案卷|书卷|工具|材料|船|鼓|印章|油灯/.test(text), '需要人物道具或场景陈设。');
    case 'costume_or_era':
      return result(field, label, Boolean(detail.era) || /先秦|汉|唐|宋|明|清|民国|近代|当代|服饰|衣着/.test(text), '需要时代或服饰口径。');
    case 'visual_symbols':
      return result(field, label, detail.asset_usage?.some(item => item.includes('visual') || item.includes('scene')) === true || /视觉|纹样|图案|色彩|象征|符号|江水|月光/.test(text), '需要视觉符号。');
    case 'dialogue_tone':
      return result(field, label, hasDialogueToneEvidence(detail.asset_usage, text), '需要对白或旁白口吻。');
    case 'forbidden_expressions':
      return result(field, label, /不得|不要|不可|不能写成|禁用|边界|不等同/.test(text), '需要禁用表达和事实边界。');
    case 'source_grades':
      return result(field, label, detail.sources.some(source => /[ABCD]级/.test(source)) || /[ABCD]级/.test(text), '需要来源等级。');
  }
}

export function hasDialogueToneEvidence(assetUsage: readonly string[] | undefined, text: string): boolean {
  if (assetUsage?.includes('dialogue_tone')) return true;
  return /(?:对白(?:[/／、和与]旁白)?|旁白(?:[/／、和与]对白)?|台词)(?:的)?(?:口吻|语气|风格)(?:（[^）\n]*）|\([^）)\n]*\))?(?:应|需|须|为|[:：])/.test(text)
    || /(?:^|\n)[-*]?\s*(?:口吻|语气|风格)\s*[:：]/.test(text);
}

function auditTypeTemplate(
  pack: ProductionPackFile['packs'][number],
  detail: FullEntryDetail,
  text: string,
): TypeTemplateAudit {
  const recommended = recommendedVideoTypes(detail).includes(pack.video_type);
  const missingFields = pack.material_template.required_fields.filter(fieldId => !hasTemplateFieldEvidence(fieldId, text, detail));
  const readinessScore = Math.round(((pack.material_template.required_fields.length - missingFields.length) / pack.material_template.required_fields.length) * 100);
  return {
    video_type: pack.video_type,
    label: VIDEO_TYPE_LABELS[pack.video_type] ?? pack.label,
    recommended,
    missing_fields: missingFields,
    readiness_score: readinessScore,
  };
}

function hasTemplateFieldEvidence(fieldId: string, text: string, detail: FullEntryDetail): boolean {
  const normalized = text.toLowerCase();
  const fieldText = fieldId.toLowerCase();
  if (fieldId === 'project_name') return Boolean(detail.name);
  if (fieldId === 'confirmed_status_and_sources') return detail.sources.length > 0 && ALLOWED_CREDIBILITY.has(detail.credibility);
  if (fieldId === 'source_quotes_or_source_cues') return detail.sources.length > 0;
  if (fieldId === 'what_must_not_be_claimed' || fieldId === 'forbidden_claims') return /不得|不可|不能|待核实|边界|不等同/.test(text);
  if (fieldId === 'real_world_site_or_object') return detail.relatedLocations.length > 0 || /旧址|现场|地点|文物|展陈|碑/.test(text);
  if (fieldId === 'heritage_or_craft_type') return /非遗|工艺|技艺|民俗|戏曲|传承/.test(text);
  if (fieldId === 'scene_anchor') return detail.relatedLocations.length > 0 || /场景|地点|空间|江|楼|书院|洞|馆/.test(text);
  if (fieldId === 'character_stability_tags') return hasAssetSplit(detail) || /服饰|发式|随身|表情|角色/.test(text);
  if (fieldId === 'visual_symbols') return /视觉|符号|纹样|图案|象征|色彩/.test(text);
  if (fieldId === 'timeline') return /公元|年|朝|时期|年代|时间/.test(text);
  if (fieldId === 'core_question') return /问题|为什么|如何|到底|核心/.test(text);
  if (fieldId === 'audience_level') return /受众|学生|游客|研学|入门|小白|观众/.test(text);
  if (fieldId === 'argument_points') return /论点|观点|要点|主张|解释/.test(text);
  if (fieldId === 'knowledge_outline') return /知识|大纲|层级|结构|提纲|脉络/.test(text);
  if (fieldId === 'concept_definitions') return /概念|定义|术语|是什么/.test(text);
  if (fieldId === 'knowledge_steps') return /步骤|流程|顺序|脉络|阶段/.test(text);
  if (fieldId === 'concrete_examples') return /例子|案例|比如|例如|对比/.test(text);
  if (fieldId === 'analogy_or_visual_metaphor') return /类比|隐喻|好比|像|示意/.test(text);
  if (fieldId === 'diagram_or_caption_plan') return /图示|字幕|关键词|信息图|图表/.test(text);
  if (fieldId === 'source_cues') return detail.sources.length > 0 || /来源|出处|文献|展陈|馆方/.test(text);
  if (fieldId === 'misconception_or_boundary') return /误区|边界|不得|不能|不可|待核实/.test(text);
  if (fieldId === 'recap_sentence') return /总结|记忆点|一句话|复盘/.test(text);
  if (fieldId === 'audience_age_band') return /3-6岁|7-9岁|10-12岁|年龄|儿童|少儿|亲子|低龄/.test(text);
  if (fieldId === 'child_safe_conflict') return /温和|善意|误会|选择|不恐怖|不惊吓|安全冲突/.test(text);
  if (fieldId === 'protagonist_choice') return /主角|选择|决定|帮助|勇敢|道歉|尝试/.test(text);
  if (fieldId === 'wonder_or_cultural_symbol') return /奇观|文化符号|神奇|纹样|节日|道具/.test(text);
  if (fieldId === 'emotional_resolution') return /情绪|安放|和解|安心|成长|复盘/.test(text);
  if (fieldId === 'parent_teacher_note') return /家长|教师|老师|亲子|课堂|延伸/.test(text);
  if (fieldId === 'opening_hook') return /前三秒|三秒|开场|钩子|反差|悬念/.test(text);
  if (fieldId === 'platform_context') return /竖屏|短视频|平台|社媒|评论区|完播/.test(text);
  if (fieldId === 'share_trigger') return /分享|转发|共鸣|反转|冷知识|原来/.test(text);
  if (fieldId === 'beat_interval') return /10秒|15秒|节奏|转折|揭示|beat/.test(text);
  if (fieldId === 'vertical_shot_plan') return /竖屏|9:16|近景|字幕|快剪|镜头/.test(text);
  if (fieldId === 'comment_prompt') return /评论|留言|投票|你觉得|互动/.test(text);
  if (fieldId === 'fact_boundary_card') return /边界卡|事实边界|不得|待核实|来源/.test(text);
  if (fieldId === 'learning_objective') return /学习目标|学会|掌握|能说出|能理解/.test(text);
  if (fieldId === 'learner_profile') return /学习者|学生|学员|年级|基础|受众/.test(text);
  if (fieldId === 'speaker_position') return /主讲人|讲述者|老师|主持人|speaker/.test(text);
  if (fieldId === 'communication_goal') return /传播目标|沟通目标|希望观众|行动转化|让观众/.test(text);
  if (fieldId === 'case_examples') return /案例|例子|比如|例如|case/.test(text);
  if (fieldId === 'slide_or_board_assets') return /板书|课件|字幕|图示|白板|slide/.test(text);
  if (fieldId === 'audience_takeaway') return /带走|总结|行动|复盘|takeaway/.test(text);
  if (fieldId === 'practice_task') return /练习|任务|互动题|试一试|practice/.test(text);
  if (fieldId === 'assessment_check') return /检查|测验|判断题|选择题|assessment/.test(text);
  if (fieldId === 'step_sequence') return /步骤|序列|流程|先|再|最后/.test(text);
  if (fieldId === 'materials') return /材料|原料|纸|线|瓷|木|布|颜料|泥/.test(text);
  if (fieldId === 'tools') return /工具|刀|针|窑|织机|鼓|笔|刷/.test(text);
  if (fieldId === 'process_steps') return /流程|步骤|工序|制作|烧制|套印|演唱|仪式/.test(text);
  if (fieldId === 'protagonist_goal') return /目标|想要|决定|选择|坚持|追寻/.test(text);
  if (fieldId === 'opponent_or_pressure') return /阻力|压力|冲突|对抗|危机|误会|阻止/.test(text);
  if (fieldId === 'dialogue_bubbles') return /对白|台词|问|答|说/.test(text);
  if (fieldId === 'episode_hook' || fieldId === 'ending_hook') return /钩子|悬念|反转|开场|结尾|追看/.test(text);
  return normalized.includes(fieldText.replace(/_/g, ' ')) || normalized.includes(fieldText);
}

function recommendedVideoTypes(detail: FullEntryDetail): VideoType[] {
  const signal = `${detail.type} ${detail.name} ${detail.keywords.join(' ')}`;
  const types = new Set<VideoType>();
  if (/历史人物|人物|传承人|名人|英雄|诗人|将领|思想家/.test(signal)) types.add('character_story');
  if (/历史人物|历史事件|地方掌故|革命|旧址|战役|起义|古迹|书院/.test(signal)) types.add('historical_drama');
  if (/神话传说|民间故事|地方掌故|传说|志异|神话/.test(signal)) types.add('legend_story');
  if (/非遗|传统工艺|饮食文化|节庆习俗|民俗活动|地方戏曲|名胜古迹|文化/.test(signal)) types.add('culture_promo');
  if (/非遗|传统工艺|地方戏曲|民俗活动|节庆习俗/.test(signal)) types.add('heritage_promo');
  if (/城市|古城|名胜古迹|地方文化|饮食文化|文旅|地域/.test(signal)) types.add('city_brand_promo');
  if (/名胜古迹|旧址|书院|洞|楼|馆|祠|墓|遗址|场景/.test(signal) || detail.relatedLocations.length > 0) types.add('scene_short');
  if (/山|水|江|湖|河|洞|楼|园林|风景|景观|名胜古迹/.test(signal)) types.add('landscape_mood');
  if (/历史人物|名胜古迹|地方掌故|革命|旧址|纪念|墓|楼|书院|文物/.test(signal)) types.add('documentary_short');
  if (/非遗|传统工艺|饮食文化|节庆习俗|宗教信仰|名胜古迹|历史人物|地方掌故|文物|书院|礼制|工艺/.test(signal)) types.add('explainer_video');
  if (/神话传说|民间故事|节庆习俗|民俗活动|少年|儿童|亲子/.test(signal)) types.add('children_story');
  if (/非遗|传统工艺|饮食文化|节庆习俗|民俗活动|地方戏曲|文旅|冷知识/.test(signal)) types.add('social_short');
  if (/历史人物|地方掌故|革命|纪念|旧址|抗战|起义|人物/.test(signal)) types.add('lecture_video');
  if (/非遗|传统工艺|节庆习俗|地方戏曲|民俗活动|工艺|课程|培训/.test(signal)) types.add('education_training');
  if (/神话传说|民间故事|历史人物|地方掌故|非遗|传说|志异|少年|案/.test(signal)) types.add('ai_comic_drama');
  return [...types];
}

function priorityReasonsForEntry(
  detail: FullEntryDetail,
  rawEntryText: string,
  fieldAudits: FieldAudit[],
  typeTemplateAudits: TypeTemplateAudit[],
): string[] {
  const reasons: string[] = [];
  if (!hasUsableVerification(detail, rawEntryText)) reasons.push('缺核实方法');
  if (!hasSection(rawEntryText, '核实方法')) reasons.push('缺独立核实方法 section');
  if (!ALLOWED_CREDIBILITY.has(detail.credibility)) reasons.push(`可信度非枚举：${detail.credibility}`);
  if (detail.sources.length === 0) reasons.push('缺来源');
  if (detail.relatedLocations.length === 0) reasons.push('缺相关地点');
  if (detail.unverifiedPoints.length > 0) reasons.push('存在待核点');
  if (!hasAssetSplit(detail)) reasons.push('缺 asset_split');
  if (!detail.knowledge_domain || !detail.entry_role || !detail.asset_usage?.length) reasons.push('缺机器字段');
  if (fieldAudits.filter(item => !item.present).length >= 5) reasons.push('生产卡片字段缺口多');
  const recommendedLow = typeTemplateAudits.filter(item => item.recommended && item.readiness_score < 50);
  if (recommendedLow.length > 0) reasons.push(`推荐片型模板覆盖低：${recommendedLow.map(item => item.video_type).join('、')}`);
  return reasons;
}

function priorityFromReasons(reasons: string[]): EntryProductionAudit['priority'] {
  if (reasons.some(reason => /缺核实方法|可信度非枚举|模板覆盖低|缺来源/.test(reason)) || reasons.length >= 4) return 'high';
  if (reasons.length >= 2) return 'medium';
  return 'low';
}

function result(
  field: ProductionCardField,
  label: string,
  present: boolean,
  reason: string,
): Omit<FieldAudit, 'evidence_origin'> {
  return { field, label, present, reason: present ? '已覆盖' : reason };
}

function isMachineGuidanceField(field: ProductionCardField): field is MachineProductionGuidanceField {
  return field === 'dialogue_tone'
    || field === 'dramatization_space'
    || field === 'visual_symbols'
    || field === 'forbidden_expressions';
}

function hasAssetSplit(detail: FullEntryDetail): boolean {
  const assetSplit = detail.asset_split;
  return Boolean(
    assetSplit?.characters.length
    && assetSplit.scenes.length
    && assetSplit.character_props.length
    && assetSplit.scene_props.length,
  );
}

function entryText(detail: FullEntryDetail): string {
  return [
    detail.name,
    detail.province,
    detail.region,
    detail.type,
    detail.summary,
    detail.story,
    detail.culturalSignificance,
    detail.verificationMethod,
    detail.credibility,
    detail.keywords.join(' '),
    detail.sources.join('\n'),
    detail.unverifiedPoints.join('\n'),
    detail.relatedLocations.map(location => `${location.name} ${location.description}`).join('\n'),
    detail.localCreativeRelations.map(relation => `${relation.relation_type} ${relation.target} ${relation.description}`).join('\n'),
    detail.knowledge_domain,
    detail.entry_role,
    detail.era,
    detail.asset_usage?.join(' '),
    detail.asset_split?.characters.join(' '),
    detail.asset_split?.scenes.join(' '),
    detail.asset_split?.character_props.join(' '),
    detail.asset_split?.scene_props.join(' '),
  ].filter(Boolean).join('\n');
}

function extractEntryMarkdown(content: string, entryName: string): string {
  const escaped = escapeRegex(entryName);
  const headerRegex = new RegExp(`## ${escaped}\\n\\n`, 'g');
  const match = headerRegex.exec(content);
  if (!match) return '';
  const start = match.index;
  const endRegex = /\n---\n\n## /g;
  endRegex.lastIndex = match.index + match[0].length;
  const next = endRegex.exec(content);
  return content.slice(start, next ? next.index : content.length);
}

function hasSection(entryText: string, sectionName: string): boolean {
  return new RegExp(`^### ${escapeRegex(sectionName)}(?:\\s*$|\\n)`, 'm').test(entryText);
}

function getSection(entryText: string, sectionName: string): string {
  const match = entryText.match(new RegExp(`^### ${escapeRegex(sectionName)}\\n\\n([\\s\\S]*?)(?=\\n### |\\n## |\\n---\\n|$)`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function hasUsableVerification(detail: FullEntryDetail, rawEntryText: string): boolean {
  const explicit = getSection(rawEntryText, '核实方法');
  if (explicit.trim()) return true;
  const merged = getSection(rawEntryText, '可信度与核实');
  if (!merged.trim()) return Boolean(detail.verificationMethod?.trim());
  return /[（(；;，,。:：]/.test(merged.replace(/^(可靠|基本可靠|待核实|存疑|混合)\s*/, ''));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTotals(files: number, entries: EntryProductionAudit[]): ProductionMaterialAuditReport['totals'] {
  const sources = entries.reduce((sum, entry) => sum + entry.source_count, 0);
  const rawMissingProductionFieldCount = entries.reduce(
    (sum, entry) => sum + entry.missing_production_fields.length,
    0,
  );
  const machineGuidanceFieldCount = entries.reduce(
    (sum, entry) => sum + entry.machine_guidance_fields.length,
    0,
  );
  const effectiveMissingProductionFieldCount = entries.reduce(
    (sum, entry) => sum + entry.effective_missing_production_fields.length,
    0,
  );
  const sourceAuthoredFieldsVisibleOnlyInRawMarkdown = entries.reduce(
    (sum, entry) => sum + entry.field_audits.filter(
      fieldAudit => fieldAudit.evidence_origin === 'raw_markdown',
    ).length,
    0,
  );
  return {
    files,
    entries: entries.length,
    sources,
    average_sources_per_entry: entries.length ? Math.round((sources / entries.length) * 100) / 100 : 0,
    entries_missing_sources: entries.filter(entry => entry.source_count === 0).length,
    entries_missing_related_locations: entries.filter(entry => entry.related_location_count === 0).length,
    missing_verification_method: entries.filter(entry => !entry.has_verification_method).length,
    missing_explicit_verification_method_section: entries.filter(entry => !entry.has_explicit_verification_method_section).length,
    entries_with_merged_credibility_verification: entries.filter(entry => entry.has_merged_credibility_verification_section).length,
    entries_with_unverified_points: entries.filter(entry => entry.unverified_point_count > 0).length,
    entries_with_machine_metadata: entries.filter(entry => entry.has_machine_metadata).length,
    entries_with_asset_split: entries.filter(entry => entry.has_asset_split).length,
    non_enum_credibility: entries.filter(entry => !ALLOWED_CREDIBILITY.has(entry.credibility)).length,
    raw_missing_production_field_count: rawMissingProductionFieldCount,
    source_authored_fields_visible_only_in_raw_markdown: sourceAuthoredFieldsVisibleOnlyInRawMarkdown,
    machine_guidance_field_count: machineGuidanceFieldCount,
    effective_missing_production_field_count: effectiveMissingProductionFieldCount,
    entries_with_machine_guidance: entries.filter(entry => entry.machine_guidance_fields.length > 0).length,
  };
}

function countBy<K extends 'province' | 'type' | 'credibility'>(
  entries: EntryProductionAudit[],
  selector: (entry: EntryProductionAudit) => string,
  key: K,
): Array<Record<K, string> & { count: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const value = selector(entry) || '未标注';
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .map(([value, count]) => ({ [key]: value, count }) as Record<K, string> & { count: number });
}

function priorityWeight(entry: EntryProductionAudit): number {
  if (entry.priority === 'high') return 3;
  if (entry.priority === 'medium') return 2;
  return 1;
}

async function loadProductionPacks(): Promise<ProductionPackFile['packs']> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const filePath = path.join(repoRoot, 'data', 'production-packs', 'video-type-material-supplement-packs.json');
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as ProductionPackFile;
    return Array.isArray(parsed.packs) ? parsed.packs : [];
  } catch {
    return [];
  }
}

function buildMarkdown(report: Omit<ProductionMaterialAuditReport, 'markdown'>): string {
  const lines: string[] = [
    '# 素材库生产化审计报告',
    '',
    `生成时间：${report.generated_at}`,
    '',
    '## 总览',
    '',
    `- 省份文件：${report.totals.files}`,
    `- 条目数：${report.totals.entries}`,
    `- 来源数：${report.totals.sources}`,
    `- 平均来源数：${report.totals.average_sources_per_entry}`,
    `- 缺来源条目：${report.totals.entries_missing_sources}`,
    `- 缺相关地点条目：${report.totals.entries_missing_related_locations}`,
    `- 缺核实方法：${report.totals.missing_verification_method}`,
    `- 缺独立核实方法 section：${report.totals.missing_explicit_verification_method_section}`,
    `- 使用可信度与核实合并 section：${report.totals.entries_with_merged_credibility_verification}`,
    `- 有待核点：${report.totals.entries_with_unverified_points}`,
    `- 有机器字段：${report.totals.entries_with_machine_metadata}`,
    `- 有 asset_split：${report.totals.entries_with_asset_split}`,
    `- 可信度非枚举：${report.totals.non_enum_credibility}`,
    `- 原始生产字段缺口：${report.totals.raw_missing_production_field_count}`,
    `- 仅在源 Markdown 专节中可见的已覆盖字段：${report.totals.source_authored_fields_visible_only_in_raw_markdown}`,
    `- 机器派生指导覆盖：${report.totals.machine_guidance_field_count}`,
    `- 运行时有效生产字段缺口：${report.totals.effective_missing_production_field_count}`,
    `- 获得机器派生指导的条目：${report.totals.entries_with_machine_guidance}`,
    '',
    '## 类型分布',
    '',
    '| 类型 | 数量 |',
    '|---|---:|',
    ...report.by_type.slice(0, 20).map(item => `| ${item.type} | ${item.count} |`),
    '',
    '## 省份分布',
    '',
    '| 省份 | 数量 |',
    '|---|---:|',
    ...report.by_province.slice(0, 20).map(item => `| ${item.province} | ${item.count} |`),
    '',
    '## 高优先级补库条目',
    '',
    '| 条目 | 省份 | 类型 | 生产卡片分 | 优先级 | 原因 |',
    '|---|---|---|---:|---|---|',
    ...report.top_priority_entries.slice(0, 30).map(entry =>
      `| ${entry.name} | ${entry.province} | ${entry.type} | ${entry.production_card_score} | ${entry.priority} | ${entry.priority_reasons.join('；')} |`,
    ),
    '',
    '## 下一步',
    '',
    '- 先处理高优先级条目的来源回溯、相关地点和 asset_split。',
    '- 原始生产字段缺口继续作为源素材治理任务；机器派生指导只在运行时组织已有素材，不等同于源字段已经补齐。',
    '- 对 15 种成片类型中推荐片型覆盖低的条目，按对应 ProductionMaterialPack 补字段。',
    '- 审计报告只做治理指挥，不自动改写省份 Markdown。',
  ];
  return `${lines.join('\n')}\n`;
}
