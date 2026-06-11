import fs from 'node:fs/promises';
import {
  CultureEntry,
  SearchResult,
  FullEntryDetail,
  KnowledgeAssetSplit,
  KnowledgeAssetUsage,
  KnowledgeDomain,
  KnowledgeEntryRole,
} from '../types.js';
import { resolveProvinceFile, PROVINCES } from './provinces.js';
import { formatEntry } from './templates.js';

// --- Memory Cache ---
const fileCache = new Map<string, string>();      // province → raw file content
const parsedCache = new Map<string, SearchResult[]>(); // province → parsed entries
let cacheTimestamp = 0;                            // last cache refresh time
const CACHE_TTL = 60_000;                         // cache expires after 60 seconds

function isCacheStale(): boolean {
  return Date.now() - cacheTimestamp > CACHE_TTL;
}

export function clearCache(): void {
  fileCache.clear();
  parsedCache.clear();
  cacheTimestamp = 0;
}

export async function readProvinceFile(province: string): Promise<string> {
  if (fileCache.has(province) && !isCacheStale()) {
    return fileCache.get(province)!;
  }
  const filePath = resolveProvinceFile(province);
  const content = await fs.readFile(filePath, 'utf-8');
  fileCache.set(province, content);
  if (isCacheStale()) {
    parsedCache.delete(province);
  }
  if (cacheTimestamp === 0) {
    cacheTimestamp = Date.now();
  }
  return content;
}

export async function readAllProvinceFiles(provinceHints?: string[], onlyHints?: boolean): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // When onlyHints=true, only read the hinted provinces (not all 34)
  if (onlyHints && provinceHints && provinceHints.length > 0) {
    const validHints = provinceHints.filter(p => PROVINCES.includes(p));
    for (const province of validHints) {
      try {
        const content = await readProvinceFile(province);
        results.set(province, content);
      } catch {
        // skip
      }
    }
    return results;
  }

  // Default: read all, with hints prioritized
  const priority = provinceHints?.filter(p => PROVINCES.includes(p)) ?? [];
  const rest = PROVINCES.filter(p => !priority.includes(p));
  const order = [...priority, ...rest];

  for (const province of order) {
    try {
      const content = await readProvinceFile(province);
      results.set(province, content);
    } catch {
      // 空文件或不存在，跳过
    }
  }
  return results;
}

export function parseEntries(content: string, province?: string): SearchResult[] {
  // If province is given and we have a cached parse, use it
  if (province && parsedCache.has(province) && !isCacheStale()) {
    return parsedCache.get(province)!;
  }

  const entries: SearchResult[] = [];
  const sectionRegex = /## (.+?)\n\n(- \*{2}省份\*{2}：(.+?)\n- \*{2}地区\*{2}：(.+?)\n- \*{2}类型\*{2}：(.+?)\n)/g;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(content)) !== null) {
    const name = match[1];
    const provinceName = match[3];
    const region = match[4];
    const type = match[5];

    const entryEnd = findEntryEnd(content, match.index + match[0].length);
    const entryContent = content.slice(match.index, entryEnd);

    const summaryMatch = entryContent.match(/### 简介\n\n(.+?)\n\n/);
    const summary = summaryMatch?.[1] || '';

    const kwMatch = entryContent.match(/### 关键词\n\n(.+?)(?:\n|$)/);
    const keywords = kwMatch?.[1]?.split('、') || [];

    const credMatch = entryContent.match(/### 可信度\n\n(.+?)\n/);
    const credibility = credMatch?.[1] || '待核实';
    const metadata = parseEntryMetadata(entryContent);
    const assetSplit = parseAssetSplit(entryContent);

    entries.push({
      name,
      province: provinceName,
      region,
      type: type as any,
      summary,
      keywords,
      credibility: credibility as any,
      ...metadata,
      ...(hasAssetSplit(assetSplit) ? { asset_split: assetSplit } : {}),
    });
  }

  // Cache parsed result if province is known
  if (province) {
    parsedCache.set(province, entries);
  }

  return entries;
}

export async function writeEntryToProvince(entry: CultureEntry, province: string): Promise<string> {
  const filePath = resolveProvinceFile(province);
  const existing = await fs.readFile(filePath, 'utf-8');
  const entryMarkdown = formatEntry(entry);

  const marker = '## 已整理条目';
  const insertPos = existing.indexOf(marker);
  if (insertPos === -1) {
    throw new Error(`省份文件 ${province} 缺少"已整理条目"区域`);
  }

  const afterMarker = insertPos + marker.length;
  const commentEnd = existing.indexOf('-->', afterMarker);
  const insertIndex = commentEnd !== -1 ? commentEnd + 3 : afterMarker;

  const newContent = existing.slice(0, insertIndex) + '\n\n' + entryMarkdown + existing.slice(insertIndex);
  await fs.writeFile(filePath, newContent, 'utf-8');

  // Invalidate cache for this province after write
  fileCache.delete(province);
  parsedCache.delete(province);

  return filePath;
}

export function extractRegionPrefix(region: string): string | null {
  if (!region || region.trim() === '') return null;
  const trimmed = region.trim();
  const prefix = trimmed.length > 3 ? trimmed.substring(0, 2) : trimmed;
  return prefix;
}

export async function writeEntryToRegionGroup(entry: CultureEntry, province: string): Promise<{ filePath: string; regionPrefix: string | null; grouped: boolean }> {
  const filePath = resolveProvinceFile(province);
  const existing = await fs.readFile(filePath, 'utf-8');
  const entryMarkdown = formatEntry(entry);
  const regionPrefix = extractRegionPrefix(entry.region);

  if (!regionPrefix) {
    const newFilePath = await writeEntryToProvince(entry, province);
    return { filePath: newFilePath, regionPrefix: null, grouped: false };
  }

  const regionHeader = `### ${regionPrefix}`;
  const regionHeaderIndex = existing.indexOf(regionHeader);

  if (regionHeaderIndex !== -1) {
    const afterHeader = regionHeaderIndex + regionHeader.length;
    let insertIndex = existing.length;

    const nextSectionRegex = /\n(?:### |## )/g;
    nextSectionRegex.lastIndex = afterHeader;
    const nextSection = nextSectionRegex.exec(existing);
    if (nextSection) {
      insertIndex = nextSection.index;
    }

    const newContent = existing.slice(0, insertIndex) + '\n\n' + entryMarkdown + existing.slice(insertIndex);
    await fs.writeFile(filePath, newContent, 'utf-8');

    // Invalidate cache
    fileCache.delete(province);
    parsedCache.delete(province);

    return { filePath, regionPrefix, grouped: true };
  }

  const marker = '## 已整理条目';
  const markerIndex = existing.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`省份文件 ${province} 缺少"已整理条目"区域`);
  }

  let sectionEnd = existing.length;
  const lastDelimiter = existing.lastIndexOf('\n---\n', existing.length);
  if (lastDelimiter > markerIndex) {
    sectionEnd = lastDelimiter + 5;
  }

  const newRegionBlock = `\n\n${regionHeader}\n\n${entryMarkdown}`;
  const newContent = existing.slice(0, sectionEnd) + newRegionBlock + existing.slice(sectionEnd);
  await fs.writeFile(filePath, newContent, 'utf-8');

  // Invalidate cache
  fileCache.delete(province);
  parsedCache.delete(province);

  return { filePath, regionPrefix, grouped: true };
}

/**
 * Parse a single full entry from province markdown content.
 * Unlike parseEntries() which only extracts summaries, this extracts
 * the complete content: story梗概, culturalSignificance, sources,
 * relatedLocations, unverifiedPoints, and verificationMethod.
 */
export function parseFullEntry(content: string, entryName: string): FullEntryDetail | null {
  // Find the entry header: ## {{entryName}}
  const headerRegex = new RegExp(`## ${escapeRegex(entryName)}\\n\\n`, 'g');
  const headerMatch = headerRegex.exec(content);
  if (!headerMatch) return null;

  const entryStart = headerMatch.index;

  // Find the end of this entry (next ## header or --- delimiter)
  const afterHeader = entryStart + headerMatch[0].length;
  const entryEnd = findEntryEnd(content, afterHeader);

  const entryContent = content.slice(entryStart, entryEnd);

  // Parse header fields (province, region, type)
  const provinceMatch = entryContent.match(/- \*{2}省份\*{2}：(.+?)\n/);
  const regionMatch = entryContent.match(/- \*{2}地区\*{2}：(.+?)\n/);
  const typeMatch = entryContent.match(/- \*{2}类型\*{2}：(.+?)\n/);

  // Parse summary
  const summary = extractSection(entryContent, '简介');

  // Parse keywords
  const kwText = extractSection(entryContent, '关键词');
  const keywords = kwText ? kwText.split('、').map(k => k.trim()).filter(Boolean) : [];

  // Parse credibility
  const credibilityRaw = extractSection(entryContent, '可信度');
  // Handle merged "可信度与核实" field (new format)
  const credibilityAndVerify = extractSection(entryContent, '可信度与核实');
  let credibility = '待核实';
  let verificationMethod = '';
  if (credibilityAndVerify) {
    // New merged format: "基本可靠（A级+B级交叉佐证；...）"
    const credLabelMatch = credibilityAndVerify.match(/^(可靠|基本可靠|待核实|存疑|混合)/);
    if (credLabelMatch) {
      credibility = credLabelMatch[1];
    }
    verificationMethod = credibilityAndVerify;
  } else if (credibilityRaw) {
    // Old separate format
    const credLabelMatch = credibilityRaw.match(/^(可靠|基本可靠|待核实|存疑|混合)/);
    if (credLabelMatch) {
      credibility = credLabelMatch[1];
    }
    const verifyMethod = extractSection(entryContent, '核实方法');
    verificationMethod = verifyMethod || '';
  }

  // Parse full content sections
  const story = extractSection(entryContent, '故事梗概') || '';
  const culturalSignificance = extractSection(entryContent, '文化意义') || '';

  // Parse sources (list items)
  const sourcesRaw = extractSection(entryContent, '来源');
  const sources = sourcesRaw
    ? sourcesRaw.split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').trim())
    : [];

  // Parse related locations (list items with optional descriptions)
  const locationsRaw = extractSection(entryContent, '相关地点');
  const relatedLocations: Array<{ name: string; description: string }> = [];
  if (locationsRaw) {
    for (const line of locationsRaw.split('\n')) {
      if (!line.startsWith('- ')) continue;
      const cleaned = line.replace(/^- /, '').trim();
      // Format: "地点名：描述" or "地点名（描述）" or just "地点名"
      const colonMatch = cleaned.match(/^(.+?)：(.+)$/);
      const parenMatch = cleaned.match(/^(.+?)（(.+?)）$/);
      if (colonMatch) {
        relatedLocations.push({ name: colonMatch[1].trim(), description: colonMatch[2].trim() });
      } else if (parenMatch) {
        relatedLocations.push({ name: parenMatch[1].trim(), description: parenMatch[2].trim() });
      } else {
        relatedLocations.push({ name: cleaned, description: '' });
      }
    }
  }

  // Parse unverified points (list items)
  const unverifiedRaw = extractSection(entryContent, '待核实点');
  const unverifiedPoints = unverifiedRaw
    ? unverifiedRaw.split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').trim())
    : [];
  const metadata = parseEntryMetadata(entryContent);
  const assetSplit = parseAssetSplit(entryContent);

  return {
    name: entryName,
    province: provinceMatch?.[1] || '',
    region: regionMatch?.[1] || '',
    type: (typeMatch?.[1] || '地方掌故') as any,
    summary: summary || '',
    keywords,
    credibility: credibility as any,
    story,
    culturalSignificance,
    sources,
    relatedLocations,
    unverifiedPoints,
    verificationMethod,
    ...metadata,
    ...(hasAssetSplit(assetSplit) ? { asset_split: assetSplit } : {}),
  };
}

function findEntryEnd(content: string, fromIndex: number): number {
  const nextEntryRegex = /\n---\n\n## /g;
  nextEntryRegex.lastIndex = fromIndex;
  const nextEntry = nextEntryRegex.exec(content);
  return nextEntry ? nextEntry.index : content.length;
}

function parseEntryMetadata(entryContent: string): {
  knowledge_domain?: KnowledgeDomain;
  entry_role?: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
} {
  const knowledgeDomain = parseHeaderField(entryContent, 'knowledge_domain') as KnowledgeDomain | undefined;
  const entryRole = parseHeaderField(entryContent, 'entry_role') as KnowledgeEntryRole | undefined;
  const era = parseHeaderField(entryContent, 'era');
  const assetUsageRaw = parseHeaderField(entryContent, 'asset_usage');
  const assetUsage = assetUsageRaw ? splitList(assetUsageRaw) as KnowledgeAssetUsage[] : [];
  return {
    ...(knowledgeDomain ? { knowledge_domain: knowledgeDomain } : {}),
    ...(entryRole ? { entry_role: entryRole } : {}),
    ...(era ? { era } : {}),
    ...(assetUsage.length ? { asset_usage: assetUsage } : {}),
  };
}

function parseHeaderField(entryContent: string, fieldName: string): string | undefined {
  const match = entryContent.match(new RegExp(`- \\*{2}${escapeRegex(fieldName)}\\*{2}：(.+?)\\n`));
  return match?.[1]?.trim();
}

function parseAssetSplit(entryContent: string): KnowledgeAssetSplit {
  return {
    characters: parseListSection(entryContent, '人物'),
    scenes: parseListSection(entryContent, '场景'),
    character_props: parseListSection(entryContent, '人物随身道具'),
    scene_props: parseListSection(entryContent, '场景陈设'),
  };
}

function parseListSection(entryContent: string, sectionName: string): string[] {
  const raw = extractSection(entryContent, sectionName);
  if (!raw) return [];
  const listItems = raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.replace(/^- /, '').trim())
    .filter(Boolean);
  return listItems.length ? listItems : splitList(raw);
}

function splitList(raw: string): string[] {
  return raw
    .split(/[、，,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function hasAssetSplit(assetSplit: KnowledgeAssetSplit): boolean {
  return assetSplit.characters.length > 0
    || assetSplit.scenes.length > 0
    || assetSplit.character_props.length > 0
    || assetSplit.scene_props.length > 0;
}

/**
 * Extract the content of a markdown section between ### headers.
 * e.g. extractSection(text, '故事梗概') returns the text between
 * "### 故事梗概" and the next "### " or "## " or "---" or end of content.
 */
function extractSection(content: string, sectionName: string): string | null {
  const sectionStartRegex = new RegExp(`### ${escapeRegex(sectionName)}\\n\\n`, 'g');
  const startMatch = sectionStartRegex.exec(content);
  if (!startMatch) return null;

  const contentStart = startMatch.index + startMatch[0].length;

  // Find the end: next ### header, ## header, --- delimiter, or end
  const endRegex = /\n(?:### |## |---)/g;
  endRegex.lastIndex = contentStart;
  const endMatch = endRegex.exec(content);
  const contentEnd = endMatch ? endMatch.index : content.length;

  return content.slice(contentStart, contentEnd).trim();
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get a full entry detail by name, searching across all province files.
 */
export async function getFullEntryDetail(entryName: string): Promise<FullEntryDetail | null> {
  for (const province of PROVINCES) {
    try {
      const content = await readProvinceFile(province);
      const detail = parseFullEntry(content, entryName);
      if (detail) return detail;
    } catch {
      continue;
    }
  }
  return null;
}
