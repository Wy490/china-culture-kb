import fs from 'node:fs/promises';
import { normalizeProvince, PROVINCES, resolveProvinceFile } from '../lib/provinces.js';

type ResidueKind = 'invalid_source_object' | 'invalid_location_undefined';

export interface CleanImportResidueOptions {
  apply?: boolean;
  kbRoot?: string;
  provinces?: string[];
  generatedAt?: string;
}

export interface ImportResidueChange {
  entry_name: string;
  province: string;
  file_path: string;
  removed_invalid_source_lines: number;
  removed_invalid_location_lines: number;
  residue_kinds: ResidueKind[];
}

export interface ImportResidueFileResult {
  province: string;
  file_path: string;
  changed: boolean;
  changed_entries: number;
  removed_invalid_source_lines: number;
  removed_invalid_location_lines: number;
}

export interface CleanImportResidueReport {
  schema_version: 'kb-import-residue-cleanup/v1';
  generated_at: string;
  apply: boolean;
  totals: {
    files_scanned: number;
    files_changed: number;
    entries_changed: number;
    removed_invalid_source_lines: number;
    removed_invalid_location_lines: number;
  };
  files: ImportResidueFileResult[];
  changes: ImportResidueChange[];
  markdown: string;
}

interface CleanedEntry {
  content: string;
  change: Omit<ImportResidueChange, 'province' | 'file_path'> | null;
}

interface CleanedFile {
  content: string;
  changes: Array<Omit<ImportResidueChange, 'province' | 'file_path'>>;
}

export async function cleanImportResidue(
  options: CleanImportResidueOptions = {},
): Promise<CleanImportResidueReport> {
  const apply = options.apply ?? false;
  const provinces = resolveTargetProvinces(options.provinces);
  const files: ImportResidueFileResult[] = [];
  const changes: ImportResidueChange[] = [];

  for (const province of provinces) {
    const filePath = resolveProvinceFile(province, options.kbRoot);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const cleaned = cleanProvinceFile(raw);
    const fileChanges = cleaned.changes.map(change => ({
      ...change,
      province,
      file_path: filePath,
    }));

    if (fileChanges.length > 0 && apply) {
      await fs.writeFile(filePath, cleaned.content, 'utf8');
    }

    files.push({
      province,
      file_path: filePath,
      changed: fileChanges.length > 0,
      changed_entries: fileChanges.length,
      removed_invalid_source_lines: fileChanges.reduce((sum, change) => sum + change.removed_invalid_source_lines, 0),
      removed_invalid_location_lines: fileChanges.reduce((sum, change) => sum + change.removed_invalid_location_lines, 0),
    });
    changes.push(...fileChanges);
  }

  const base: Omit<CleanImportResidueReport, 'markdown'> = {
    schema_version: 'kb-import-residue-cleanup/v1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    apply,
    totals: {
      files_scanned: files.length,
      files_changed: files.filter(file => file.changed).length,
      entries_changed: changes.length,
      removed_invalid_source_lines: changes.reduce((sum, change) => sum + change.removed_invalid_source_lines, 0),
      removed_invalid_location_lines: changes.reduce((sum, change) => sum + change.removed_invalid_location_lines, 0),
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

function cleanProvinceFile(content: string): CleanedFile {
  const entryHeaderRegex = /^## (.+?)\n\n- \*\*省份\*\*：.+?\n- \*\*地区\*\*：.+?\n- \*\*类型\*\*：.+?\n/gm;
  const matches = Array.from(content.matchAll(entryHeaderRegex));
  if (matches.length === 0) return { content, changes: [] };

  let nextContent = '';
  let cursor = 0;
  const changes: CleanedFile['changes'] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const entryStart = match.index ?? 0;
    const entryEnd = matches[index + 1]?.index ?? content.length;
    const entryName = match[1].trim();
    const entryBlock = content.slice(entryStart, entryEnd);
    const cleaned = cleanEntry(entryBlock, entryName);

    nextContent += content.slice(cursor, entryStart);
    nextContent += cleaned.content;
    cursor = entryEnd;

    if (cleaned.change) {
      changes.push(cleaned.change);
    }
  }

  nextContent += content.slice(cursor);
  return { content: nextContent, changes };
}

function cleanEntry(entryBlock: string, entryName: string): CleanedEntry {
  const lines = entryBlock.split('\n');
  const kept: string[] = [];
  let removedInvalidSources = 0;
  let removedInvalidLocations = 0;

  for (const line of lines) {
    if (line.trim() === '- [object Object]') {
      removedInvalidSources += 1;
      continue;
    }
    if (line.trim() === '- undefined：undefined') {
      removedInvalidLocations += 1;
      continue;
    }
    kept.push(line);
  }

  const residueKinds: ResidueKind[] = [];
  if (removedInvalidSources > 0) residueKinds.push('invalid_source_object');
  if (removedInvalidLocations > 0) residueKinds.push('invalid_location_undefined');
  if (residueKinds.length === 0) return { content: entryBlock, change: null };

  return {
    content: kept.join('\n').replace(/\n{4,}(?=### )/g, '\n\n'),
    change: {
      entry_name: entryName,
      removed_invalid_source_lines: removedInvalidSources,
      removed_invalid_location_lines: removedInvalidLocations,
      residue_kinds: residueKinds,
    },
  };
}

function buildMarkdown(report: Omit<CleanImportResidueReport, 'markdown'>): string {
  const lines = [
    '# 导入残留清洗报告',
    '',
    `生成时间：${report.generated_at}`,
    `执行模式：${report.apply ? 'apply' : 'dry-run'}`,
    '',
    '## 总览',
    '',
    `- 扫描文件：${report.totals.files_scanned}`,
    `- 涉及文件：${report.totals.files_changed}`,
    `- 清洗条目：${report.totals.entries_changed}`,
    `- 删除无效来源行：${report.totals.removed_invalid_source_lines}`,
    `- 删除无效地点行：${report.totals.removed_invalid_location_lines}`,
    '',
    '## 清洗条目',
    '',
    '| 条目 | 省份 | 删除无效来源 | 删除无效地点 | 类型 |',
    '|---|---|---:|---:|---|',
    ...report.changes.map(change =>
      `| ${change.entry_name} | ${change.province} | ${change.removed_invalid_source_lines} | ${change.removed_invalid_location_lines} | ${change.residue_kinds.join('、')} |`,
    ),
    '',
    '## 说明',
    '',
    '- 本工具只删除导入残留占位符，不回填来源或地点事实。',
    '- 被清洗条目需要后续执行回溯补源，补齐来源名称、来源等级和可核实地点。',
  ];
  return `${lines.join('\n')}\n`;
}
