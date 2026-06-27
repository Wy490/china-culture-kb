import fs from 'node:fs/promises';
import { normalizeProvince, PROVINCES, resolveProvinceFile } from '../lib/provinces.js';
import type { CredibilityLevel } from '../types.js';

type VerificationAction = 'created' | 'merged_into_existing' | 'already_contained';

export interface NormalizeCredibilityOptions {
  apply?: boolean;
  kbRoot?: string;
  provinces?: string[];
  generatedAt?: string;
}

export interface CredibilityNormalizationChange {
  entry_name: string;
  province: string;
  file_path: string;
  credibility: CredibilityLevel;
  had_explicit_credibility: boolean;
  had_explicit_verification_method: boolean;
  verification_action: VerificationAction;
}

export interface CredibilityNormalizationFileResult {
  province: string;
  file_path: string;
  changed: boolean;
  changed_entries: number;
}

export interface CredibilityNormalizationReport {
  schema_version: 'kb-credibility-normalization/v1';
  generated_at: string;
  apply: boolean;
  totals: {
    files_scanned: number;
    files_changed: number;
    entries_changed: number;
    created_verification_sections: number;
    merged_into_existing_verification_sections: number;
    already_contained_verification_sections: number;
  };
  files: CredibilityNormalizationFileResult[];
  changes: CredibilityNormalizationChange[];
  markdown: string;
}

interface SectionRange {
  start: number;
  contentStart: number;
  contentEnd: number;
  end: number;
  content: string;
}

interface NormalizedEntry {
  content: string;
  change: Omit<CredibilityNormalizationChange, 'province' | 'file_path'> | null;
}

interface NormalizedFile {
  content: string;
  changes: Array<Omit<CredibilityNormalizationChange, 'province' | 'file_path'>>;
}

const CREDIBILITY_LABELS: CredibilityLevel[] = ['可靠', '基本可靠', '待核实', '存疑', '混合'];

export async function normalizeCredibilitySections(
  options: NormalizeCredibilityOptions = {},
): Promise<CredibilityNormalizationReport> {
  const apply = options.apply ?? false;
  const provinces = resolveTargetProvinces(options.provinces);
  const files: CredibilityNormalizationFileResult[] = [];
  const changes: CredibilityNormalizationChange[] = [];

  for (const province of provinces) {
    const filePath = resolveProvinceFile(province, options.kbRoot);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const normalized = normalizeProvinceFile(raw);
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

  const base: Omit<CredibilityNormalizationReport, 'markdown'> = {
    schema_version: 'kb-credibility-normalization/v1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    apply,
    totals: {
      files_scanned: files.length,
      files_changed: files.filter(file => file.changed).length,
      entries_changed: changes.length,
      created_verification_sections: changes.filter(change => change.verification_action === 'created').length,
      merged_into_existing_verification_sections: changes.filter(change => change.verification_action === 'merged_into_existing').length,
      already_contained_verification_sections: changes.filter(change => change.verification_action === 'already_contained').length,
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

function normalizeProvinceFile(content: string): NormalizedFile {
  const entryHeaderRegex = /^## (.+?)\n\n- \*\*省份\*\*：.+?\n- \*\*地区\*\*：.+?\n- \*\*类型\*\*：.+?\n/gm;
  const matches = Array.from(content.matchAll(entryHeaderRegex));
  if (matches.length === 0) return { content, changes: [] };

  let nextContent = '';
  let cursor = 0;
  const changes: NormalizedFile['changes'] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const entryStart = match.index ?? 0;
    const entryEnd = matches[index + 1]?.index ?? content.length;
    const entryName = match[1].trim();
    const entryBlock = content.slice(entryStart, entryEnd);
    const normalized = normalizeEntry(entryBlock, entryName);

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

function normalizeEntry(entryBlock: string, entryName: string): NormalizedEntry {
  const merged = getSection(entryBlock, '可信度与核实');
  if (!merged) return normalizeLongCredibilitySection(entryBlock, entryName);

  const hadExplicitCredibility = Boolean(getSection(entryBlock, '可信度'));
  const hadExplicitVerificationMethod = Boolean(getSection(entryBlock, '核实方法'));
  const credibility = extractCredibility(merged.content);

  let nextBlock = entryBlock;
  if (hadExplicitCredibility) {
    nextBlock = replaceRange(nextBlock, merged.start, merged.end, '');
  } else if (hadExplicitVerificationMethod) {
    nextBlock = replaceRange(nextBlock, merged.start, merged.end, sectionText('可信度', credibility));
  } else {
    nextBlock = replaceRange(nextBlock, merged.start, merged.end, [
      sectionText('可信度', credibility),
      sectionText('核实方法', merged.content),
    ].join('\n'));
  }

  const verificationAction = mergeVerificationContent(nextBlock, merged.content, hadExplicitVerificationMethod);
  nextBlock = verificationAction.content;

  return {
    content: tidySectionSpacing(nextBlock),
    change: {
      entry_name: entryName,
      credibility,
      had_explicit_credibility: hadExplicitCredibility,
      had_explicit_verification_method: hadExplicitVerificationMethod,
      verification_action: verificationAction.action,
    },
  };
}

function normalizeLongCredibilitySection(entryBlock: string, entryName: string): NormalizedEntry {
  const credibilitySection = getSection(entryBlock, '可信度');
  if (!credibilitySection || isCredibilityEnumOnly(credibilitySection.content)) {
    return { content: entryBlock, change: null };
  }

  const credibility = extractCredibility(credibilitySection.content);
  const hadExplicitVerificationMethod = Boolean(getSection(entryBlock, '核实方法'));
  let nextBlock = replaceRange(entryBlock, credibilitySection.contentStart, credibilitySection.contentEnd, `${credibility}\n`);
  const verificationAction = mergeVerificationContent(nextBlock, credibilitySection.content, hadExplicitVerificationMethod);
  nextBlock = verificationAction.content;

  return {
    content: tidySectionSpacing(nextBlock),
    change: {
      entry_name: entryName,
      credibility,
      had_explicit_credibility: true,
      had_explicit_verification_method: hadExplicitVerificationMethod,
      verification_action: verificationAction.action,
    },
  };
}

function mergeVerificationContent(
  entryBlock: string,
  mergedContent: string,
  hadExplicitVerificationMethod: boolean,
): { content: string; action: VerificationAction } {
  if (!hadExplicitVerificationMethod) {
    return { content: entryBlock, action: 'created' };
  }

  const verification = getSection(entryBlock, '核实方法');
  if (!verification) {
    return {
      content: `${entryBlock.trimEnd()}\n\n${sectionText('核实方法', mergedContent)}`,
      action: 'created',
    };
  }

  const existing = verification.content.trim();
  const merged = mergedContent.trim();
  if (existing.includes(merged)) {
    return { content: entryBlock, action: 'already_contained' };
  }

  const note = `可信度说明：${merged}`;
  const nextVerification = existing ? `${note}\n\n${existing}` : note;
  return {
    content: replaceRange(entryBlock, verification.contentStart, verification.contentEnd, `${nextVerification}\n`),
    action: 'merged_into_existing',
  };
}

function extractCredibility(content: string): CredibilityLevel {
  const trimmed = content.trim();
  const matched = CREDIBILITY_LABELS.find(label => trimmed.startsWith(label));
  return matched ?? '待核实';
}

function isCredibilityEnumOnly(content: string): boolean {
  return CREDIBILITY_LABELS.includes(content.trim() as CredibilityLevel);
}

function getSection(content: string, sectionName: string): SectionRange | null {
  const headerRegex = new RegExp(`^### ${escapeRegex(sectionName)}\\n\\n`, 'm');
  const header = headerRegex.exec(content);
  if (!header) return null;

  const start = header.index;
  const contentStart = start + header[0].length;
  const endRegex = /\n(?:### |## |---)/g;
  endRegex.lastIndex = contentStart;
  const endMatch = endRegex.exec(content);
  const contentEnd = endMatch?.index ?? content.length;

  return {
    start,
    contentStart,
    contentEnd,
    end: contentEnd,
    content: content.slice(contentStart, contentEnd).trim(),
  };
}

function replaceRange(content: string, start: number, end: number, replacement: string): string {
  return `${content.slice(0, start)}${replacement}${content.slice(end)}`;
}

function sectionText(sectionName: string, content: string): string {
  return `### ${sectionName}\n\n${content.trim()}\n`;
}

function tidySectionSpacing(content: string): string {
  return content.replace(/\n{4,}(?=### )/g, '\n\n').replace(/\n{3,}(?=---\n\n## )/g, '\n\n');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMarkdown(report: Omit<CredibilityNormalizationReport, 'markdown'>): string {
  const lines = [
    '# 可信度字段归一化报告',
    '',
    `生成时间：${report.generated_at}`,
    `执行模式：${report.apply ? 'apply' : 'dry-run'}`,
    '',
    '## 总览',
    '',
    `- 扫描文件：${report.totals.files_scanned}`,
    `- 涉及文件：${report.totals.files_changed}`,
    `- 归一化条目：${report.totals.entries_changed}`,
    `- 新增核实方法 section：${report.totals.created_verification_sections}`,
    `- 合并到既有核实方法：${report.totals.merged_into_existing_verification_sections}`,
    `- 既有核实方法已包含说明：${report.totals.already_contained_verification_sections}`,
    '',
    '## 变更条目',
    '',
    '| 条目 | 省份 | 可信度 | 核实方法处理 |',
    '|---|---|---|---|',
    ...report.changes.map(change =>
      `| ${change.entry_name} | ${change.province} | ${change.credibility} | ${verificationActionLabel(change.verification_action)} |`,
    ),
    '',
    '## 说明',
    '',
    '- 本工具只拆分格式，不新增事实。',
    '- `可信度` 只保留枚举：可靠 / 基本可靠 / 待核实 / 存疑 / 混合。',
    '- 原 `可信度与核实` 内容进入 `核实方法`，用于保留来源互证说明和边界口径。',
  ];
  return `${lines.join('\n')}\n`;
}

function verificationActionLabel(action: VerificationAction): string {
  if (action === 'created') return '新增核实方法';
  if (action === 'merged_into_existing') return '合并到既有核实方法';
  return '既有核实方法已包含说明';
}
