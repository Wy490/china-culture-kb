import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullEntryDetail, VideoType } from '../types.js';
import { parseEntries, parseFullEntry, readAllProvinceFiles } from '../lib/markdown.js';

type ProductionCardField =
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

interface FieldAudit {
  field: ProductionCardField;
  label: string;
  present: boolean;
  reason: string;
}

interface TypeTemplateAudit {
  video_type: VideoType;
  label: string;
  recommended: boolean;
  missing_fields: string[];
  readiness_score: number;
}

interface EntryProductionAudit {
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
  field_audits: FieldAudit[];
  type_template_audits: TypeTemplateAudit[];
  priority: 'high' | 'medium' | 'low';
  priority_reasons: string[];
}

interface ProductionMaterialAuditReport {
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
  heritage_promo: '非遗/工艺宣传片',
  documentary_short: '微纪录片',
  ai_comic_drama: 'AI漫剧',
};

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
  const text = entryText(detail);
  const fieldAudits = CORE_PRODUCTION_FIELDS.map(item => auditProductionField(item.field, item.label, detail, text));
  const missingProductionFields = fieldAudits.filter(item => !item.present).map(item => item.field);
  const productionCardScore = Math.round(((CORE_PRODUCTION_FIELDS.length - missingProductionFields.length) / CORE_PRODUCTION_FIELDS.length) * 100);
  const typeTemplateAudits = productionPacks
    .filter(pack => ['heritage_promo', 'documentary_short', 'ai_comic_drama'].includes(pack.video_type))
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
): FieldAudit {
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
      return result(field, label, detail.asset_usage?.includes('dialogue_tone') === true || /对白|口吻|旁白|语气|台词|问/.test(text), '需要对白或旁白口吻。');
    case 'forbidden_expressions':
      return result(field, label, /不得|不要|不可|不能写成|禁用|边界|不等同/.test(text), '需要禁用表达和事实边界。');
    case 'source_grades':
      return result(field, label, detail.sources.some(source => /[ABCD]级/.test(source)) || /[ABCD]级/.test(text), '需要来源等级。');
  }
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
  if (/非遗|传统工艺|地方戏曲|民俗活动|节庆习俗/.test(signal)) types.add('heritage_promo');
  if (/历史人物|名胜古迹|地方掌故|革命|旧址|纪念|墓|楼|书院|文物/.test(signal)) types.add('documentary_short');
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

function result(field: ProductionCardField, label: string, present: boolean, reason: string): FieldAudit {
  return { field, label, present, reason: present ? '已覆盖' : reason };
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
    '- 对非遗、微纪录、AI 漫剧推荐片型覆盖低的条目，按对应 ProductionMaterialPack 补字段。',
    '- 审计报告只做治理指挥，不自动改写省份 Markdown。',
  ];
  return `${lines.join('\n')}\n`;
}
