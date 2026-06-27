import fs from 'node:fs/promises';
import { normalizeProvince, PROVINCES, resolveProvinceFile } from '../lib/provinces.js';
import type { KnowledgeAssetUsage, KnowledgeDomain, KnowledgeEntryRole } from '../types.js';

export interface MachineMetadataEnrichmentOptions {
  apply?: boolean;
  kbRoot?: string;
  provinces?: string[];
  generatedAt?: string;
}

export interface MachineMetadataSuggestion {
  knowledge_domain: KnowledgeDomain;
  entry_role: KnowledgeEntryRole;
  asset_usage: KnowledgeAssetUsage[];
  era?: string;
}

export interface MachineMetadataChange {
  entry_name: string;
  province: string;
  file_path: string;
  type: string;
  added_fields: string[];
  suggestion: MachineMetadataSuggestion;
}

export interface MachineMetadataFileResult {
  province: string;
  file_path: string;
  changed: boolean;
  changed_entries: number;
}

export interface MachineMetadataEnrichmentReport {
  schema_version: 'kb-machine-metadata-enrichment/v1';
  generated_at: string;
  apply: boolean;
  totals: {
    files_scanned: number;
    files_changed: number;
    entries_changed: number;
    fields_added: number;
    entries_with_inferred_era: number;
  };
  files: MachineMetadataFileResult[];
  changes: MachineMetadataChange[];
  markdown: string;
}

interface NormalizedEntry {
  content: string;
  change: Omit<MachineMetadataChange, 'province' | 'file_path'> | null;
}

interface NormalizedFile {
  content: string;
  changes: Array<Omit<MachineMetadataChange, 'province' | 'file_path'>>;
}

const METADATA_FIELDS = ['knowledge_domain', 'entry_role', 'era', 'asset_usage'] as const;

export async function enrichMachineMetadata(
  options: MachineMetadataEnrichmentOptions = {},
): Promise<MachineMetadataEnrichmentReport> {
  const apply = options.apply ?? false;
  const provinces = resolveTargetProvinces(options.provinces);
  const files: MachineMetadataFileResult[] = [];
  const changes: MachineMetadataChange[] = [];

  for (const province of provinces) {
    const filePath = resolveProvinceFile(province, options.kbRoot);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const normalized = enrichProvinceFile(raw);
    const fileChanges = normalized.changes.map(change => ({
      ...change,
      province,
      file_path: filePath,
    }));

    if (fileChanges.length > 0 && apply) {
      await fs.writeFile(filePath, normalized.content, 'utf8');
    }

    files.push({
      province,
      file_path: filePath,
      changed: fileChanges.length > 0,
      changed_entries: fileChanges.length,
    });
    changes.push(...fileChanges);
  }

  const base: Omit<MachineMetadataEnrichmentReport, 'markdown'> = {
    schema_version: 'kb-machine-metadata-enrichment/v1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    apply,
    totals: {
      files_scanned: files.length,
      files_changed: files.filter(file => file.changed).length,
      entries_changed: changes.length,
      fields_added: changes.reduce((sum, change) => sum + change.added_fields.length, 0),
      entries_with_inferred_era: changes.filter(change => change.added_fields.includes('era')).length,
    },
    files,
    changes,
  };

  return {
    ...base,
    markdown: buildMarkdown(base),
  };
}

function resolveTargetProvinces(provinceInputs?: string[]): string[] {
  if (!provinceInputs?.length) return PROVINCES;
  return provinceInputs
    .map(input => normalizeProvince(input))
    .filter((province): province is string => Boolean(province));
}

function enrichProvinceFile(content: string): NormalizedFile {
  const entryHeaderRegex = /^## (.+?)\n\n- \*\*省份\*\*：.+?\n- \*\*地区\*\*：.+?\n- \*\*类型\*\*：(.+?)\n/gm;
  const matches = Array.from(content.matchAll(entryHeaderRegex));
  if (matches.length === 0) return { content, changes: [] };

  let nextContent = '';
  let cursor = 0;
  const changes: NormalizedFile['changes'] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const entryStart = match.index ?? 0;
    const entryEnd = matches[index + 1]?.index ?? content.length;
    const entryBlock = content.slice(entryStart, entryEnd);
    const normalized = enrichEntry(entryBlock, match[1].trim(), match[2].trim());

    nextContent += content.slice(cursor, entryStart);
    nextContent += normalized.content;
    cursor = entryEnd;

    if (normalized.change) {
      changes.push(normalized.change);
    }
  }

  nextContent += content.slice(cursor);
  return { content: nextContent, changes };
}

function enrichEntry(entryBlock: string, entryName: string, type: string): NormalizedEntry {
  const suggestion = suggestMetadata(type, entryBlock);
  const addedLines: string[] = [];
  const addedFields: string[] = [];

  if (!hasHeaderField(entryBlock, 'knowledge_domain')) {
    addedLines.push(`- **knowledge_domain**：${suggestion.knowledge_domain}`);
    addedFields.push('knowledge_domain');
  }
  if (!hasHeaderField(entryBlock, 'entry_role')) {
    addedLines.push(`- **entry_role**：${suggestion.entry_role}`);
    addedFields.push('entry_role');
  }
  if (suggestion.era && !hasHeaderField(entryBlock, 'era')) {
    addedLines.push(`- **era**：${suggestion.era}`);
    addedFields.push('era');
  }
  if (!hasHeaderField(entryBlock, 'asset_usage')) {
    addedLines.push(`- **asset_usage**：${suggestion.asset_usage.join('、')}`);
    addedFields.push('asset_usage');
  }

  if (addedLines.length === 0) return { content: entryBlock, change: null };

  const firstSectionIndex = entryBlock.search(/\n\n### /);
  if (firstSectionIndex === -1) return { content: entryBlock, change: null };

  return {
    content: `${entryBlock.slice(0, firstSectionIndex)}\n${addedLines.join('\n')}${entryBlock.slice(firstSectionIndex)}`,
    change: {
      entry_name: entryName,
      type,
      added_fields: addedFields,
      suggestion,
    },
  };
}

function hasHeaderField(entryBlock: string, fieldName: string): boolean {
  return new RegExp(`^- \\*\\*${escapeRegex(fieldName)}\\*\\*：`, 'm').test(entryBlock);
}

function suggestMetadata(type: string, entryBlock: string): MachineMetadataSuggestion {
  const signal = `${type}\n${entryBlock}`;
  const era = inferEra(signal);
  const redHistory = isRedHistory(signal);

  if (/神话传说|民间故事|传说|志异/.test(type)) {
    return {
      knowledge_domain: 'folklore_zhiyi',
      entry_role: 'motif_pack',
      ...(era ? { era } : {}),
      asset_usage: ['story_motif', 'scene_space', 'dialogue_tone', 'credibility_boundary'],
    };
  }

  if (/非遗|传统工艺|地方戏曲|饮食文化|民俗活动|节庆习俗/.test(type)) {
    return {
      knowledge_domain: 'regional_culture',
      entry_role: 'motif_pack',
      ...(era ? { era } : {}),
      asset_usage: ['character_props', 'scene_space', 'scene_props', 'story_motif', 'credibility_boundary'],
    };
  }

  if (/历史人物/.test(type)) {
    return {
      knowledge_domain: 'core_china_culture',
      entry_role: 'core_entry',
      ...(era ? { era } : {}),
      asset_usage: ['character_clothing', 'character_props', 'dialogue_tone', 'character_arc', 'credibility_boundary', 'source_grounding'],
    };
  }

  if (/名胜古迹/.test(type)) {
    return {
      knowledge_domain: redHistory ? 'core_china_culture' : 'regional_culture',
      entry_role: 'core_entry',
      ...(era ? { era } : {}),
      asset_usage: ['scene_space', 'scene_props', 'gears_delivery', 'credibility_boundary', 'source_grounding'],
    };
  }

  if (/宗教信仰/.test(type)) {
    return {
      knowledge_domain: 'regional_culture',
      entry_role: 'motif_pack',
      ...(era ? { era } : {}),
      asset_usage: ['scene_space', 'story_motif', 'safety_boundary', 'credibility_boundary'],
    };
  }

  return {
    knowledge_domain: redHistory ? 'core_china_culture' : 'regional_culture',
    entry_role: 'core_entry',
    ...(era ? { era } : {}),
    asset_usage: ['scene_space', 'story_motif', 'conflict_engine', 'credibility_boundary', 'source_grounding'],
  };
}

function isRedHistory(signal: string): boolean {
  return /革命|抗战|战役|起义|会议|根据地|长征|解放|红军|苏区|七七事变|九一八|南京大屠杀/.test(signal);
}

function inferEra(signal: string): string | undefined {
  const rules: Array<[RegExp, string]> = [
    [/新石器|史前|远古/, '史前'],
    [/先秦|春秋|战国|楚国|屈原/, '先秦'],
    [/秦汉|西汉|东汉|汉代|汉墓|马王堆/, '秦汉'],
    [/魏晋|晋代|陶侃/, '魏晋'],
    [/隋唐|唐代|唐朝|李白|杜甫/, '唐'],
    [/五代十国/, '五代十国'],
    [/宋代|宋朝|南宋|北宋|周敦颐|岳麓书院/, '宋'],
    [/元代|元朝/, '元'],
    [/明清|明代|明朝|清代|清朝/, '明清'],
    [/民国|辛亥|黄花岗|武昌起义/, '近代'],
    [/新文化运动|北大红楼|五四/, '近代'],
    [/抗战|抗日|七七事变|九一八|台儿庄|衡阳保卫战|常德会战|南京大屠杀/, '抗日战争时期'],
    [/红军|长征|苏区|井冈山|遵义会议|四渡赤水|秋收起义|南昌起义|古田会议/, '新民主主义革命时期'],
    [/解放战争|辽沈战役|淮海战役|平津战役|渡江战役|中原突围/, '解放战争时期'],
    [/和平解放|新中国|改革开放/, '当代'],
  ];
  return rules.find(([regex]) => regex.test(signal))?.[1];
}

function buildMarkdown(report: Omit<MachineMetadataEnrichmentReport, 'markdown'>): string {
  const lines = [
    '# 机器字段补齐报告',
    '',
    `生成时间：${report.generated_at}`,
    `执行模式：${report.apply ? 'apply' : 'dry-run'}`,
    '',
    '## 总览',
    '',
    `- 扫描文件：${report.totals.files_scanned}`,
    `- 涉及文件：${report.totals.files_changed}`,
    `- 补齐条目：${report.totals.entries_changed}`,
    `- 新增字段数：${report.totals.fields_added}`,
    `- 推断 era 条目：${report.totals.entries_with_inferred_era}`,
    '',
    '## 变更条目',
    '',
    '| 条目 | 省份 | 类型 | 新增字段 | knowledge_domain | entry_role | asset_usage |',
    '|---|---|---|---|---|---|---|',
    ...report.changes.map(change =>
      `| ${change.entry_name} | ${change.province} | ${change.type} | ${change.added_fields.join('、')} | ${change.suggestion.knowledge_domain} | ${change.suggestion.entry_role} | ${change.suggestion.asset_usage.join('、')} |`,
    ),
    '',
    '## 说明',
    '',
    '- 本工具只补机器调度字段，不新增故事事实。',
    '- 已有 `knowledge_domain`、`entry_role`、`era`、`asset_usage` 不会被覆盖。',
    '- `era` 只在文本中有明显时代信号时自动补齐。',
  ];
  return `${lines.join('\n')}\n`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
