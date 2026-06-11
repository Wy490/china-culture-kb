// web/server/src/services/entry-service.ts — Entry business logic

import {
  mcpSearch,
  mcpGetEntryDetail,
  mcpProvinces,
  mcpReadAllProvinceFiles,
  mcpParseEntries,
  mcpParseFullEntry,
  convertSearchResult,
  convertFullEntryDetail,
} from './mcp-proxy.js';
import { success, fail, ErrorCodes } from '@shared/types.js';
import type { ApiResponse, EntrySearchResult, EntryDetail, EntryMatchResult, EntryMatchItem } from '@shared/types.js';

// ---------------------------------------------------------------------------
// Search entries
// ---------------------------------------------------------------------------

interface SearchParams {
  keywords?: string;
  type?: string;
  province?: string;
  region?: string;
}

export async function searchEntries(params: SearchParams): Promise<ApiResponse<EntrySearchResult[]>> {
  const hasFilter = params.province || params.type || params.region;
  const hasKeywords = params.keywords && params.keywords.trim() !== '';
  if (!hasKeywords && !hasFilter) {
    return success([]);
  }

  const results = await mcpSearch({
    keywords: params.keywords ?? '',
    type: params.type,
    province: params.province,
    region: params.region,
  });

  const converted = results.map(convertSearchResult);
  if (!hasKeywords) {
    return success(converted);
  }

  const queryKeywords = extractKeywords(params.keywords ?? '');
  const searchIntent = detectSearchIntent(params.keywords ?? '');
  const detailsByName = new Map((await collectSearchableEntries()).map(entry => [entry.name, entry]));
  const enriched = converted.map(entry => {
    const detail = detailsByName.get(entry.name);
    if (!detail) return { ...entry, _rank: 0 };
    const matchedSnippets = buildEntryMatchedSnippets(detail, queryKeywords, 3);
    return {
      ...entry,
      ...(matchedSnippets.length > 0 ? { matched_snippets: matchedSnippets } : {}),
      match_reason: buildEntrySearchReason(detail, queryKeywords, searchIntent),
      _rank: computeSearchRank(detail, queryKeywords, searchIntent),
    };
  });
  enriched.sort((a, b) => b._rank - a._rank);
  return success(enriched.map(({ _rank, ...entry }) => entry));
}

// ---------------------------------------------------------------------------
// Get entry detail by name
// ---------------------------------------------------------------------------

export async function getEntryDetailByName(name: string): Promise<ApiResponse<EntryDetail>> {
  const detail = await mcpGetEntryDetail(name);
  if (!detail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${name}" not found`);
  }
  return success(convertFullEntryDetail(detail));
}

// ---------------------------------------------------------------------------
// Match entries by creative topic — local scoring algorithm
// ---------------------------------------------------------------------------

interface MatchParams {
  query: string;
  limit: number;
  preferred_province?: string;
  preferred_type?: string;
}

export interface SearchableEntry extends EntrySearchResult {
  story?: string;
  culturalSignificance?: string;
  relatedLocationText?: string;
  sourcesText?: string;
  verificationText?: string;
  unverifiedText?: string;
  assetSplitText?: string;
}

type SearchIntent = 'person_experience' | 'place_building' | 'folk_ritual' | 'religion' | 'event' | 'craft_process' | 'general';

// Type-related keyword hints for boosting scores
const TYPE_KEYWORD_HINTS: Record<string, string[]> = {
  '历史人物': ['人物', '名人', '生平', '经历', '事迹', '传记', '革命', '先贤', '诗人', '英雄', '领袖', '将军', '皇帝', '大臣', '宰相', '学者', '名臣', '革命家', '政治家', '军事家', '哲学家', '思想家'],
  '神话传说': ['传说', '神话', '神仙', '妖怪', '仙人', '龙', '凤凰', '灵'],
  '民间故事': ['故事', '民间', '传说', '传说故事', '爱情', '狐仙'],
  '非遗': ['非遗', '民俗', '工艺', '技艺', '传承', '手艺', '绣', '陶瓷', '织', '染', '雕刻', '仪式'],
  '传统工艺': ['工艺', '技艺', '手工', '制作', '烧制', '编织', '流程'],
  '名胜古迹': ['地点', '建筑', '古建', '景区', '山水', '古城', '楼', '阁', '亭', '书院', '寺', '庙', '祠', '墓', '洞', '遗址', '名胜', '古迹', '景点'],
  '地方掌故': ['掌故', '轶事', '事件', '故事', '经历', '转折', '冲突'],
  '节庆习俗': ['节日', '节庆', '习俗', '端午', '中秋', '春节', '过年', '庆典', '仪式', '祭祀'],
  '饮食文化': ['美食', '饮食', '菜', '味道', '小吃', '特产', '烹饪'],
  '地方戏曲': ['戏曲', '戏', '剧', '唱', '舞台'],
  '宗教信仰': ['宗教', '信仰', '佛', '佛教', '禅宗', '道', '道教', '寺', '庙', '祠', '祭祀', '祭', '神灵'],
  '民俗活动': ['民俗', '习俗', '活动', '赶秋', '鼓舞', '仪式', '祭祀', '歌舞'],
};

// Province name mapping for query detection
const PROVINCE_NAMES = mcpProvinces;

export async function matchEntries(params: MatchParams): Promise<ApiResponse<EntryMatchResult>> {
  const { query, limit, preferred_province, preferred_type } = params;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'query cannot be empty');
  }

  // Step 1: Collect all entries from knowledge base, including long story/detail fields.
  const allEntries = await collectSearchableEntries();

  // Step 2: Extract query keywords
  const queryKeywords = extractKeywords(trimmedQuery);
  const queryProvince = detectProvince(trimmedQuery, preferred_province);

  // Step 3: Score each entry
  const scored: EntryMatchItem[] = [];
  for (const entry of allEntries) {
    const score = computeMatchScore(trimmedQuery, queryKeywords, entry, queryProvince, preferred_type);
    if (score >= 0.35) {
      const reason = buildMatchReason(trimmedQuery, entry, score);
      scored.push({
        entry_name: entry.name,
        province: entry.province,
        type: entry.type,
        score: Math.round(score * 100) / 100, // Round to 2 decimal places
        match_reason: reason,
        usable_for_story: score >= 0.75,
      });
    }
  }

  // Step 4: Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const matches = scored.slice(0, limit);

  // Step 5: Determine best_match
  const bestMatch = matches.find(m => m.score >= 0.75) ?? null;

  // Step 6: Fallback message
  let fallbackMessage: string | null = null;
  if (matches.length === 0) {
    fallbackMessage = '知识库中暂未找到高度相关词条，请更换关键词或先补充知识库条目。';
  } else if (!bestMatch) {
    fallbackMessage = '找到部分相关词条，但匹配度较低，建议确认是否适合创作。';
  }

  return success({
    query: trimmedQuery,
    matches,
    best_match: bestMatch,
    fallback_message: fallbackMessage,
  });
}

export async function collectSearchableEntries(): Promise<SearchableEntry[]> {
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
        sourcesText: detail?.sources.join(' ') ?? '',
        verificationText: detail?.verificationMethod ?? '',
        unverifiedText: detail?.unverifiedPoints.join(' ') ?? '',
        assetSplitText: assetSplitToText(summaryEntry.asset_split ?? detail?.asset_split),
      };
    }));
  }
  return allEntries;
}

export function buildEntryKnowledgeSummary(entry: SearchableEntry, queryKeywords: string[], maxLength = 360): string {
  const matchedSnippets = buildEntryMatchedSnippets(entry, queryKeywords, 4, false);
  const fallbackSnippets = matchedSnippets.length > 0 ? [] : buildEntryMatchedSnippets(entry, queryKeywords, 3, true);
  const snippets = uniqueTextParts([
    ...matchedSnippets,
    entry.summary,
    ...fallbackSnippets,
  ]);
  const summary = snippets.join('；');
  return summary.length > maxLength ? `${summary.substring(0, maxLength)}…` : summary;
}

export function buildEntryMatchedSnippets(
  entry: SearchableEntry,
  queryKeywords: string[],
  limit = 3,
  allowFallback = false,
): string[] {
  const candidates = uniqueTextParts([
    ...extractRelevantSnippets(entry.story ?? '', queryKeywords, 2, allowFallback),
    ...extractRelevantSnippets(entry.relatedLocationText ?? '', queryKeywords, 1, allowFallback).map(snippet => `相关地点：${snippet}`),
    ...extractRelevantSnippets(entry.culturalSignificance ?? '', queryKeywords, 1, allowFallback),
    ...extractRelevantSnippets(entry.keywords.join('、'), queryKeywords, 1, false).map(snippet => `关键词：${snippet}`),
    ...extractRelevantSnippets(entry.verificationText ?? '', queryKeywords, 1, false).map(snippet => `核验：${snippet}`),
    ...extractRelevantSnippets(entry.unverifiedText ?? '', queryKeywords, 1, false).map(snippet => `待核：${snippet}`),
  ]);
  return candidates
    .sort((a, b) => scoreSnippet(b, queryKeywords) - scoreSnippet(a, queryKeywords))
    .slice(0, limit);
}

function buildEntrySearchReason(entry: SearchableEntry, queryKeywords: string[], intent: SearchIntent): string {
  const matchedKeywords = queryKeywords.filter(keyword =>
    entry.name.includes(keyword)
    || entry.summary.includes(keyword)
    || (entry.story ?? '').includes(keyword)
    || (entry.relatedLocationText ?? '').includes(keyword)
    || (entry.culturalSignificance ?? '').includes(keyword)
    || entry.keywords.some(ekw => ekw.includes(keyword) || keyword.includes(ekw))
  );
  const keywordReason = matchedKeywords.length > 0
    ? `命中：${[...new Set(matchedKeywords)].slice(0, 6).join('、')}`
    : '内容相关';
  const intentLabel = searchIntentLabel(intent);
  return intentLabel ? `${keywordReason} · ${intentLabel}` : keywordReason;
}

function computeSearchRank(entry: SearchableEntry, queryKeywords: string[], intent: SearchIntent): number {
  const coreName = entry.name.split('——')[0] ?? entry.name;
  const baseRank = queryKeywords.reduce((rank, keyword) => {
    if (!keyword) return rank;
    let nextRank = rank;
    if (entry.name.includes(keyword)) nextRank += 12;
    if (coreName.includes(keyword)) nextRank += 10;
    if (entry.keywords.some(ekw => ekw.includes(keyword) || keyword.includes(ekw))) nextRank += 8;
    if (entry.summary.includes(keyword)) nextRank += 6;
    if ((entry.story ?? '').includes(keyword)) nextRank += 7;
    if ((entry.relatedLocationText ?? '').includes(keyword)) nextRank += 7;
    if ((entry.culturalSignificance ?? '').includes(keyword)) nextRank += 4;
    if (entry.type.includes(keyword) || entry.province.includes(keyword) || entry.region.includes(keyword)) nextRank += 2;
    return nextRank;
  }, 0);
  return baseRank + computeIntentRank(entry, intent, queryKeywords);
}

function detectSearchIntent(query: string): SearchIntent {
  if (['建筑', '古建', '楼', '阁', '亭', '寺', '庙', '祠', '书院', '遗址', '地点', '空间', '景点'].some(word => query.includes(word))) {
    return 'place_building';
  }
  if (['人物', '生平', '经历', '事迹', '传记', '主人公', '成长'].some(word => query.includes(word))) {
    return 'person_experience';
  }
  if (['民俗', '习俗', '仪式', '祭祀', '节庆', '节日', '活动'].some(word => query.includes(word))) {
    return 'folk_ritual';
  }
  if (['宗教', '信仰', '佛', '道教', '佛教', '神灵'].some(word => query.includes(word))) {
    return 'religion';
  }
  if (['事件', '起义', '战役', '战争', '革命', '拒签', '断案', '转折', '冲突'].some(word => query.includes(word))) {
    return 'event';
  }
  if (['工艺', '技艺', '流程', '制作', '传承', '手艺', '材料', '工具'].some(word => query.includes(word))) {
    return 'craft_process';
  }
  return 'general';
}

function computeIntentRank(entry: SearchableEntry, intent: SearchIntent, queryKeywords: string[]): number {
  const detailText = [
    entry.name,
    entry.summary,
    entry.story,
    entry.relatedLocationText,
    entry.culturalSignificance,
    entry.keywords.join(' '),
  ].join(' ');
  const hasKeywordInDetails = queryKeywords.some(keyword => keyword && detailText.includes(keyword));

  if (intent === 'place_building') {
    return (entry.type === '名胜古迹' ? 10 : 0) + ((entry.relatedLocationText ?? '').length > 0 && hasKeywordInDetails ? 8 : 0);
  }
  if (intent === 'person_experience') {
    return (entry.type === '历史人物' ? 10 : 0) + ((entry.story ?? '').length > 0 && hasKeywordInDetails ? 6 : 0);
  }
  if (intent === 'folk_ritual') {
    return (['民俗活动', '节庆习俗', '非遗'].includes(entry.type) ? 10 : 0) + (hasKeywordInDetails ? 5 : 0);
  }
  if (intent === 'religion') {
    return (entry.type === '宗教信仰' ? 10 : 0) + (hasKeywordInDetails ? 5 : 0);
  }
  if (intent === 'event') {
    return (['地方掌故', '历史人物'].includes(entry.type) ? 8 : 0) + ((entry.story ?? '').length > 0 && hasKeywordInDetails ? 7 : 0);
  }
  if (intent === 'craft_process') {
    return (['传统工艺', '非遗'].includes(entry.type) ? 10 : 0) + (hasKeywordInDetails ? 5 : 0);
  }
  return 0;
}

function searchIntentLabel(intent: SearchIntent): string | null {
  const labels: Record<SearchIntent, string | null> = {
    person_experience: '人物经历',
    place_building: '地点建筑',
    folk_ritual: '民俗仪式',
    religion: '宗教信仰',
    event: '历史事件',
    craft_process: '工艺流程',
    general: null,
  };
  return labels[intent];
}

function extractRelevantSnippets(text: string, keywords: string[], limit: number, allowFallback: boolean): string[] {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return [];

  const sentences = splitSnippetCandidates(cleaned);
  const matched = sentences
    .filter(sentence => keywords.some(keyword => keyword && sentence.includes(keyword)))
    .sort((a, b) => scoreSnippet(b, keywords) - scoreSnippet(a, keywords));
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

// ---------------------------------------------------------------------------
// Local scoring helpers
// ---------------------------------------------------------------------------

export function extractKeywords(query: string): string[] {
  // Split by common delimiters and Chinese punctuation
  const parts = query.split(/[，、\s,·——\-–_]+/).filter(p => p.trim().length >= 2);
  // Also extract individual meaningful words (2-4 chars)
  const words: string[] = [];
  for (const part of parts) {
    // Split 4+ char segments into 2-3 char meaningful chunks
    if (part.length <= 4) {
      words.push(part);
    } else {
      // For long segments, extract overlapping 2-char and 3-char substrings
      for (let i = 0; i < part.length - 1; i++) {
        words.push(part.substring(i, i + 2));
      }
    }
  }

  const queryText = parts.join('');
  for (const hints of Object.values(TYPE_KEYWORD_HINTS)) {
    for (const hint of hints) {
      if (queryText.includes(hint)) {
        words.push(hint);
      }
    }
  }

  return [...new Set(words)]; // Deduplicate
}

export function detectProvince(query: string, preferred?: string): string | null {
  // Check if query mentions a province name directly
  for (const prov of PROVINCE_NAMES) {
    if (query.includes(prov)) return prov;
  }
  // Use preferred province if provided
  if (preferred) {
    const found = PROVINCE_NAMES.find(p => p === preferred);
    if (found) return found;
  }
  return null;
}

export function computeMatchScore(
  query: string,
  queryKeywords: string[],
  entry: SearchableEntry,
  queryProvince: string | null,
  preferredType?: string,
): number {
  let score = 0;

  // 1. Exact match — query === entry.name
  if (query === entry.name) {
    return 1.0;
  }

  // 2. Contains match — query contains entry name, or entry name contains query
  // Also check for core-name overlap: extract the name prefix before "——"
  const entryCoreName = entry.name.split('——')[0]; // e.g. "周敦颐" from "周敦颐——理学开山鼻祖"
  if (entry.name.includes(query) || query.includes(entry.name)) {
    const overlapRatio = Math.min(query.length, entry.name.length) / Math.max(query.length, entry.name.length);
    score += 0.75 + overlapRatio * 0.2;
  } else if (query.includes(entryCoreName) || entryCoreName.includes(query)) {
    // Core name overlap — e.g. "周敦颐拒签冤案故事" contains "周敦颐"
    const coreRatio = entryCoreName.length / query.length;
    score += 0.65 + coreRatio * 0.2; // Range: 0.65 - 0.85 based on how significant the core name is
  }

  // 3. Keyword matching against entry fields
  if (score < 0.65) {
    let keywordHits = 0;
    let keywordHitWeight = 0;
    const totalKeywords = queryKeywords.length;

    for (const kw of queryKeywords) {
      let hit = false;
      let weight = 0.5;
      // Check entry name — highest weight
      if (entry.name.includes(kw)) { hit = true; weight = 1.0; }
      // Check core name — also high weight
      if (entryCoreName.includes(kw)) { hit = true; weight = 0.8; }
      // Check summary
      if (entry.summary.includes(kw)) { hit = true; weight = Math.max(weight, 0.4); }
      // Check full story content — useful when keyword is an event/experience not in summary
      if ((entry.story ?? '').includes(kw)) { hit = true; weight = Math.max(weight, 0.55); }
      // Check related locations — useful for buildings, temples, scenic spots and place search
      if ((entry.relatedLocationText ?? '').includes(kw)) { hit = true; weight = Math.max(weight, 0.65); }
      // Check cultural significance
      if ((entry.culturalSignificance ?? '').includes(kw)) { hit = true; weight = Math.max(weight, 0.35); }
      // Check keywords array
      if (entry.keywords.some(ekw => ekw.includes(kw) || kw.includes(ekw))) { hit = true; weight = Math.max(weight, 0.6); }
      // Check type
      if (entry.type.includes(kw)) { hit = true; weight = Math.max(weight, 0.3); }
      // Check province
      if (entry.province.includes(kw)) { hit = true; weight = Math.max(weight, 0.3); }
      // Check region
      if (entry.region.includes(kw)) { hit = true; weight = Math.max(weight, 0.2); }
      // Lower-weight provenance fields can still rescue sparse entries
      if ((entry.sourcesText ?? '').includes(kw) || (entry.verificationText ?? '').includes(kw) || (entry.unverifiedText ?? '').includes(kw)) {
        hit = true;
        weight = Math.max(weight, 0.2);
      }
      if ((entry.assetSplitText ?? '').includes(kw)) {
        hit = true;
        weight = Math.max(weight, 0.45);
      }

      if (hit) { keywordHits++; keywordHitWeight += weight; }
    }

    // Keyword match score: weighted by hit quality
    if (totalKeywords > 0 && keywordHits > 0) {
      const weightedRatio = keywordHitWeight / (totalKeywords * 1.0); // Normalized by max possible weight
      score += 0.2 + weightedRatio * 0.5;
    }
  }

  // 4. Province weighting
  if (queryProvince && entry.province === queryProvince) {
    score += 0.1;
  }

  // 5. Type weighting
  if (preferredType && entry.type === preferredType) {
    score += 0.1;
  }
  if (!preferredType) {
    for (const [typeName, hints] of Object.entries(TYPE_KEYWORD_HINTS)) {
      const hintHits = hints.filter(h => query.includes(h)).length;
      if (hintHits > 0 && entry.type === typeName) {
        score += Math.min(0.12, hintHits * 0.04);
      }
    }
  }

  // 6. Cap at 0.99
  score = Math.min(0.99, score);

  return score;
}

function buildMatchReason(query: string, entry: SearchableEntry, score: number): string {
  if (score >= 1.0) return `精确匹配：查询"${query}"与词条"${entry.name}"完全一致`;

  const reasons: string[] = [];

  // Name overlap
  if (entry.name.includes(query) || query.includes(entry.name)) {
    reasons.push(`名称包含"${query}"中的关键内容`);
  }

  // Keyword hits
  const queryKws = extractKeywords(query);
  const matchedKws = queryKws.filter(kw =>
    entry.name.includes(kw)
    || entry.summary.includes(kw)
    || (entry.story ?? '').includes(kw)
    || (entry.relatedLocationText ?? '').includes(kw)
    || (entry.culturalSignificance ?? '').includes(kw)
    || (entry.assetSplitText ?? '').includes(kw)
    || entry.keywords.some(ekw => ekw.includes(kw) || kw.includes(ekw))
  );
  if (matchedKws.length > 0) {
    reasons.push(`关键词命中：${matchedKws.join('、')}`);
  }

  if (queryKws.some(kw => (entry.story ?? '').includes(kw))) {
    reasons.push('故事梗概命中');
  }
  if (queryKws.some(kw => (entry.relatedLocationText ?? '').includes(kw))) {
    reasons.push('相关地点命中');
  }

  // Province match
  const detectedProv = detectProvince(query);
  if (detectedProv && entry.province === detectedProv) {
    reasons.push(`省份匹配：${entry.province}`);
  }

  // Type match
  for (const [typeName, hints] of Object.entries(TYPE_KEYWORD_HINTS)) {
    if (entry.type === typeName && hints.some(h => query.includes(h))) {
      reasons.push(`类型匹配：${typeName}`);
    }
  }

  if (reasons.length === 0) {
    reasons.push('部分内容相关性');
  }

  return reasons.join('，');
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
