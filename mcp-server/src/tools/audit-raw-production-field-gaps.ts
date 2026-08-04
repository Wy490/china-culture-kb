import { auditProductionMaterials, type ProductionCardField, type ProductionMaterialAuditReport } from './audit-production-materials.js';

type GovernanceLane =
  | 'claim_boundary'
  | 'dramatization_boundary'
  | 'visual_evidence'
  | 'dialogue_register';

type GovernanceRisk = 'high' | 'medium';

interface FieldPolicy {
  lane: GovernanceLane;
  risk: GovernanceRisk;
  evidence_requirement: string;
  acceptance_rule: string;
}

interface GapGovernanceItem {
  province: string;
  entry_name: string;
  entry_type: string;
  source_file: string;
  source_count: number;
  field: ProductionCardField;
  field_label: string;
  lane: GovernanceLane;
  risk: GovernanceRisk;
  evidence_requirement: string;
  acceptance_rule: string;
  action: 'manual_source_patch_required';
  runtime_fallback_available: boolean;
  auto_write_allowed: false;
}

interface GovernanceBatch {
  batch_id: string;
  label: string;
  priority: number;
  item_count: number;
  entry_count: number;
  fields: ProductionCardField[];
  provinces: string[];
}

export interface RawProductionFieldGapGovernanceReport {
  schema_version: 'kb-raw-production-field-gap-governance/v1';
  generated_at: string;
  source_audit_schema_version: ProductionMaterialAuditReport['schema_version'];
  totals: {
    entries: number;
    raw_gap_count: number;
    affected_entry_count: number;
    source_authored_fields_recovered_from_raw_markdown: number;
    manual_source_patch_required_count: number;
    runtime_fallback_available_count: number;
    auto_write_eligible_count: 0;
    non_hunan_high_risk_gap_count: number;
    non_hunan_high_risk_scope_complete: boolean;
    high_risk_gap_count: number;
    high_risk_scope_complete: boolean;
  };
  by_field: Array<{ field: ProductionCardField; label: string; count: number }>;
  by_lane: Array<{ lane: GovernanceLane; count: number }>;
  by_province: Array<{ province: string; count: number }>;
  batches: GovernanceBatch[];
  items: GapGovernanceItem[];
  markdown: string;
}

const FIELD_POLICIES: Record<ProductionCardField, FieldPolicy | undefined> = {
  confirmed_facts: undefined,
  unverified_facts: undefined,
  characters: undefined,
  scenes: undefined,
  props: undefined,
  costume_or_era: undefined,
  source_grades: undefined,
  forbidden_expressions: {
    lane: 'claim_boundary',
    risk: 'high',
    evidence_requirement: '逐项绑定已核事实、待核点或来源冲突，明确哪些断言不得出现。',
    acceptance_rule: '不得把通用安全模板写成条目事实；每条禁用表达必须能回指本条目材料。',
  },
  dramatization_space: {
    lane: 'dramatization_boundary',
    risk: 'high',
    evidence_requirement: '以已核事实和待核点为边界，区分可重建动作、明确虚构和不可改写事实。',
    acceptance_rule: '必须显式标注创作建模或改编，不得把补写动作、心理或对白升级为史实。',
  },
  visual_symbols: {
    lane: 'visual_evidence',
    risk: 'high',
    evidence_requirement: '从来源、馆藏/现场描述或已核资产中确认视觉对象、纹样、色彩与空间锚点。',
    acceptance_rule: '无图像或文本证据的象征含义不得写入事实层；仅可作为待核视觉建议。',
  },
  dialogue_tone: {
    lane: 'dialogue_register',
    risk: 'medium',
    evidence_requirement: '依据人物身份、时代、地域、体裁和现有叙事材料撰写口吻规范。',
    acceptance_rule: '只写生产指导，不伪造原话、方言、口述史或人物心理。',
  },
};

const FIELD_LABELS: Record<ProductionCardField, string> = {
  confirmed_facts: '已确认事实',
  unverified_facts: '待核事实',
  dramatization_space: '可戏剧化空间',
  characters: '人物',
  scenes: '场景',
  props: '道具',
  costume_or_era: '服饰/时代',
  visual_symbols: '视觉符号',
  dialogue_tone: '对白口吻',
  forbidden_expressions: '禁用表达',
  source_grades: '来源等级',
};

export async function auditRawProductionFieldGaps(): Promise<RawProductionFieldGapGovernanceReport> {
  return buildRawProductionFieldGapGovernance(await auditProductionMaterials());
}

export function buildRawProductionFieldGapGovernance(
  productionAudit: ProductionMaterialAuditReport,
): RawProductionFieldGapGovernanceReport {
  const items = productionAudit.entries.flatMap(entry => entry.missing_production_fields.map(field => {
    const policy = FIELD_POLICIES[field];
    if (!policy) throw new Error(`Missing governance policy for raw production field: ${field}`);
    return {
      province: entry.province,
      entry_name: entry.name,
      entry_type: entry.type,
      source_file: `data/provinces/${entry.province}.md`,
      source_count: entry.source_count,
      field,
      field_label: FIELD_LABELS[field],
      lane: policy.lane,
      risk: policy.risk,
      evidence_requirement: policy.evidence_requirement,
      acceptance_rule: policy.acceptance_rule,
      action: 'manual_source_patch_required' as const,
      runtime_fallback_available: entry.machine_guidance_fields.includes(field),
      auto_write_allowed: false as const,
    };
  })).sort(compareItems);

  const batches = buildBatches(items);
  const baseReport: Omit<RawProductionFieldGapGovernanceReport, 'markdown'> = {
    schema_version: 'kb-raw-production-field-gap-governance/v1',
    generated_at: new Date().toISOString(),
    source_audit_schema_version: productionAudit.schema_version,
    totals: {
      entries: productionAudit.totals.entries,
      raw_gap_count: items.length,
      affected_entry_count: new Set(items.map(item => `${item.province}\u0000${item.entry_name}`)).size,
      source_authored_fields_recovered_from_raw_markdown:
        productionAudit.totals.source_authored_fields_visible_only_in_raw_markdown,
      manual_source_patch_required_count: items.length,
      runtime_fallback_available_count: items.filter(item => item.runtime_fallback_available).length,
      auto_write_eligible_count: 0,
      non_hunan_high_risk_gap_count: items.filter(
        item => item.province !== '湖南' && item.risk === 'high',
      ).length,
      non_hunan_high_risk_scope_complete: items.every(
        item => item.province === '湖南' || item.risk !== 'high',
      ),
      high_risk_gap_count: items.filter(item => item.risk === 'high').length,
      high_risk_scope_complete: items.every(item => item.risk !== 'high'),
    },
    by_field: countBy(items, item => item.field)
      .map(({ value, count }) => ({ field: value as ProductionCardField, label: FIELD_LABELS[value as ProductionCardField], count })),
    by_lane: countBy(items, item => item.lane)
      .map(({ value, count }) => ({ lane: value as GovernanceLane, count })),
    by_province: countBy(items, item => item.province)
      .map(({ value, count }) => ({ province: value, count })),
    batches,
    items,
  };
  return { ...baseReport, markdown: buildMarkdown(baseReport) };
}

function compareItems(a: GapGovernanceItem, b: GapGovernanceItem): number {
  const risk = (a.risk === 'high' ? 0 : 1) - (b.risk === 'high' ? 0 : 1);
  if (risk !== 0) return risk;
  const province = a.province.localeCompare(b.province, 'zh-Hans-CN');
  if (province !== 0) return province;
  const entry = a.entry_name.localeCompare(b.entry_name, 'zh-Hans-CN');
  if (entry !== 0) return entry;
  return a.field.localeCompare(b.field);
}

function countBy<T>(items: T[], selector: (item: T) => string): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = selector(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .map(([value, count]) => ({ value, count }));
}

function buildBatches(items: GapGovernanceItem[]): GovernanceBatch[] {
  const definitions: Array<{ batch_id: string; label: string; priority: number; matches: (item: GapGovernanceItem) => boolean }> = [
    {
      batch_id: 'B1-non-hunan-high-risk-boundaries',
      label: '非湖南高风险事实/改编/视觉边界',
      priority: 1,
      matches: item => item.province !== '湖南' && item.risk === 'high',
    },
    {
      batch_id: 'B2-hunan-high-risk-boundaries',
      label: '湖南存量高风险事实/改编/视觉边界',
      priority: 2,
      matches: item => item.province === '湖南' && item.risk === 'high',
    },
    {
      batch_id: 'B3-non-hunan-dialogue-register',
      label: '非湖南对白/旁白口吻规范',
      priority: 3,
      matches: item => item.province !== '湖南' && item.lane === 'dialogue_register',
    },
    {
      batch_id: 'B4-hunan-dialogue-register',
      label: '湖南存量对白/旁白口吻规范',
      priority: 4,
      matches: item => item.province === '湖南' && item.lane === 'dialogue_register',
    },
  ];
  return definitions.map(definition => {
    const batchItems = items.filter(definition.matches);
    return {
      batch_id: definition.batch_id,
      label: definition.label,
      priority: definition.priority,
      item_count: batchItems.length,
      entry_count: new Set(batchItems.map(item => `${item.province}\u0000${item.entry_name}`)).size,
      fields: [...new Set(batchItems.map(item => item.field))].sort(),
      provinces: [...new Set(batchItems.map(item => item.province))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
    };
  }).filter(batch => batch.item_count > 0);
}

function buildMarkdown(report: Omit<RawProductionFieldGapGovernanceReport, 'markdown'>): string {
  return `${[
    '# 原始生产字段缺口治理账本',
    '',
    `生成时间：${report.generated_at}`,
    '',
    '## 治理结论',
    '',
    `- 当前原始字段缺口：${report.totals.raw_gap_count}`,
    `- 受影响条目：${report.totals.affected_entry_count}`,
    `- 已从源 Markdown 专节恢复识别：${report.totals.source_authored_fields_recovered_from_raw_markdown}`,
    `- 需人工/source-authored 补写：${report.totals.manual_source_patch_required_count}`,
    `- 运行时兜底可用：${report.totals.runtime_fallback_available_count}`,
    `- 允许自动回写省级 Markdown：${report.totals.auto_write_eligible_count}`,
    `- 非湖南高风险边界剩余：${report.totals.non_hunan_high_risk_gap_count}`,
    `- B1 非湖南高风险边界完成：${report.totals.non_hunan_high_risk_scope_complete ? '是' : '否'}`,
    `- 全库高风险边界剩余：${report.totals.high_risk_gap_count}`,
    `- B1+B2 高风险边界完成：${report.totals.high_risk_scope_complete ? '是' : '否'}`,
    '',
    '> 运行时机器指导不等于源字段完成。治理脚本只生成账本，不修改 `data/provinces/*.md`。',
    '',
    '## 字段分布',
    '',
    '| 字段 | 缺口 |',
    '|---|---:|',
    ...report.by_field.map(item => `| ${item.label}（${item.field}） | ${item.count} |`),
    '',
    '## 治理批次',
    '',
    '| 优先级 | 批次 | 条目 | 字段缺口 |',
    '|---:|---|---:|---:|',
    ...report.batches.map(batch => `| ${batch.priority} | ${batch.label} | ${batch.entry_count} | ${batch.item_count} |`),
    '',
    '## 省份分布',
    '',
    '| 省份 | 缺口 |',
    '|---|---:|',
    ...report.by_province.map(item => `| ${item.province} | ${item.count} |`),
    '',
    '## 逐项账本',
    '',
    '| 风险 | 省份 | 条目 | 字段 | 治理车道 | 来源数 |',
    '|---|---|---|---|---|---:|',
    ...report.items.map(item => `| ${item.risk} | ${item.province} | ${item.entry_name} | ${item.field_label} | ${item.lane} | ${item.source_count} |`),
    '',
    '## 验收规则',
    '',
    '- 每个源字段补丁必须保留已核事实、待核点、改编空间和明确虚构的分层。',
    '- 对白口吻只能作为生产指导，不得伪造原话、口述史或方言事实。',
    '- 视觉符号必须回指文本、图像、馆藏、现场或资产证据；象征阐释无证据时进入待核。',
    '- 修改正式条目后重新运行 `kb:lint`、`kb:production-audit` 与本治理账本。',
  ].join('\n')}\n`;
}
