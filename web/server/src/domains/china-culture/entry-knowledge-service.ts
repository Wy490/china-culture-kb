import type { EntrySearchResult } from '@shared/types.js';
import {
  convertChinaCultureSearchResult as convertSearchResult,
  parseChinaCultureEntries as mcpParseEntries,
  parseChinaCultureFullEntry as mcpParseFullEntry,
  readAllChinaCultureProvinceFiles as mcpReadAllProvinceFiles,
} from './knowledge-source-adapter.js';

export interface SearchableEntry extends EntrySearchResult {
  story?: string;
  culturalSignificance?: string;
  relatedLocationText?: string;
  localCreativeRelationText?: string;
  sourcesText?: string;
  verificationText?: string;
  unverifiedText?: string;
  assetSplitText?: string;
}

export async function collectChinaCultureSearchableEntries(): Promise<SearchableEntry[]> {
  const provinceFiles = await mcpReadAllProvinceFiles();
  const allEntries: SearchableEntry[] = [];
  for (const [provinceName, content] of provinceFiles) {
    const parsed = mcpParseEntries(content, provinceName);
    allEntries.push(...parsed.map(entry => {
      const summaryEntry = convertSearchResult(entry);
      const detail = mcpParseFullEntry(content, entry.name);
      return {
        ...summaryEntry,
        story: detail?.story ?? '',
        culturalSignificance: detail?.culturalSignificance ?? '',
        relatedLocationText: detail?.relatedLocations.map(location => `${location.name} ${location.description}`).join(' ') ?? '',
        localCreativeRelationText: detail?.localCreativeRelations.map(relation => `${localRelationLabel(relation.relation_type)} ${relation.target} ${relation.description}`).join(' ') ?? '',
        sourcesText: detail?.sources.join(' ') ?? '',
        verificationText: detail?.verificationMethod ?? '',
        unverifiedText: detail?.unverifiedPoints.join(' ') ?? '',
        assetSplitText: assetSplitToText(summaryEntry.asset_split ?? detail?.asset_split),
      };
    }));
  }
  return allEntries;
}

export function buildChinaCultureEntryKnowledgeSummary(
  entry: SearchableEntry,
  queryKeywords: string[],
  maxLength = 360,
): string {
  const matchedSnippets = buildChinaCultureEntryMatchedSnippets(entry, queryKeywords, 4, false);
  const fallbackSnippets = matchedSnippets.length > 0
    ? []
    : buildChinaCultureEntryMatchedSnippets(entry, queryKeywords, 3, true);
  const snippets = uniqueTextParts([
    ...matchedSnippets,
    entry.summary,
    ...fallbackSnippets,
  ]);
  const summary = snippets.join('；');
  return summary.length > maxLength ? `${summary.substring(0, maxLength)}…` : summary;
}

export function buildChinaCultureEntryMatchedSnippets(
  entry: SearchableEntry,
  queryKeywords: string[],
  limit = 3,
  allowFallback = false,
): string[] {
  const candidates = uniqueTextParts([
    ...extractRelevantSnippets(entry.story ?? '', queryKeywords, 2, allowFallback),
    ...extractRelevantSnippets(entry.relatedLocationText ?? '', queryKeywords, 1, allowFallback).map(snippet => `相关地点：${snippet}`),
    ...extractRelevantSnippets(entry.localCreativeRelationText ?? '', queryKeywords, 2, allowFallback).map(snippet => `地方化关系：${snippet}`),
    ...extractRelevantSnippets(entry.culturalSignificance ?? '', queryKeywords, 1, allowFallback),
    ...extractRelevantSnippets(entry.keywords.join('、'), queryKeywords, 1, false).map(snippet => `关键词：${snippet}`),
    ...extractRelevantSnippets(entry.verificationText ?? '', queryKeywords, 1, false).map(snippet => `核验：${snippet}`),
    ...extractRelevantSnippets(entry.unverifiedText ?? '', queryKeywords, 1, false).map(snippet => `待核：${snippet}`),
  ]);
  return candidates
    .sort((left, right) => scoreSnippet(right, queryKeywords) - scoreSnippet(left, queryKeywords))
    .slice(0, limit);
}

function extractRelevantSnippets(text: string, keywords: string[], limit: number, allowFallback: boolean): string[] {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return [];
  const sentences = splitSnippetCandidates(cleaned);
  const matched = sentences
    .filter(sentence => keywords.some(keyword => keyword && sentence.includes(keyword)))
    .sort((left, right) => scoreSnippet(right, keywords) - scoreSnippet(left, keywords));
  const selected = matched.length > 0 ? matched : allowFallback ? sentences.slice(0, 1) : [];
  return selected.slice(0, limit).map(snippet => snippet.length > 120 ? `${snippet.substring(0, 120)}…` : snippet);
}

function splitSnippetCandidates(text: string): string[] {
  const sentenceParts = text
    .split(/(?<=[。！？!?；;])/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 8);
  if (sentenceParts.length > 0) return sentenceParts;
  return text
    .split(/[、，,\s]+/)
    .map(part => part.trim())
    .filter(part => part.length >= 2);
}

function scoreSnippet(sentence: string, keywords: string[]): number {
  return keywords.reduce((score, keyword) => {
    if (!keyword || !sentence.includes(keyword)) return score;
    return score + Math.min(4, keyword.length);
  }, 0);
}

function uniqueTextParts(parts: Array<string | undefined>): string[] {
  const result: string[] = [];
  for (const part of parts) {
    const cleaned = part?.trim();
    if (!cleaned || result.includes(cleaned)) continue;
    result.push(cleaned);
  }
  return result;
}

function assetSplitToText(assetSplit: SearchableEntry['asset_split']): string {
  if (!assetSplit) return '';
  return [
    ...assetSplit.characters,
    ...assetSplit.scenes,
    ...assetSplit.character_props,
    ...assetSplit.scene_props,
  ].join(' ');
}

function localRelationLabel(type: string): string {
  const labels: Record<string, string> = {
    direct_region: '直接事件',
    related_location: '相关地点',
    cultural_influence: '思想文化影响',
    contemporary_adaptation: '当代转化',
    do_not_write_as: '不可写成',
    same_province: '同省背景',
    keyword_context: '关键词语境',
  };
  return labels[type] ?? type;
}
