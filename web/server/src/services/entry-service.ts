// web/server/src/services/entry-service.ts — Entry business logic

import {
  mcpSearch,
  mcpGetEntryDetail,
  mcpProvinces,
  mcpReadAllProvinceFiles,
  mcpParseEntries,
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

  return success(results.map(convertSearchResult));
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

// Type-related keyword hints for boosting scores
const TYPE_KEYWORD_HINTS: Record<string, string[]> = {
  '历史人物': ['人物', '革命', '先贤', '诗人', '英雄', '领袖', '将军', '皇帝', '大臣', '宰相', '学者', '名臣', '革命家', '政治家', '军事家', '哲学家', '思想家'],
  '神话传说': ['传说', '神话', '神仙', '妖怪', '仙人', '龙', '凤凰', '灵'],
  '民间故事': ['故事', '民间', '传说', '传说故事', '爱情', '狐仙'],
  '非遗': ['非遗', '工艺', '技艺', '传承', '手艺', '绣', '陶瓷', '织', '染', '雕刻'],
  '传统工艺': ['工艺', '技艺', '手工', '制作', '烧制', '编织'],
  '名胜古迹': ['景区', '山水', '古城', '楼', '阁', '书院', '寺', '庙', '墓', '洞', '遗址', '名胜', '古迹', '景点', '景点'],
  '地方掌故': ['掌故', '轶事', '事件', '故事', '转折', '转折'],
  '节庆习俗': ['节日', '节庆', '习俗', '端午', '中秋', '春节', '过年', '庆典'],
  '饮食文化': ['美食', '饮食', '菜', '味道', '小吃', '特产', '烹饪'],
  '地方戏曲': ['戏曲', '戏', '剧', '唱', '舞台'],
  '宗教信仰': ['宗教', '信仰', '佛', '道', '祭祀', '祭'],
  '民俗活动': ['民俗', '活动', '赶秋', '鼓舞', '仪式'],
};

// Province name mapping for query detection
const PROVINCE_NAMES = mcpProvinces;

export async function matchEntries(params: MatchParams): Promise<ApiResponse<EntryMatchResult>> {
  const { query, limit, preferred_province, preferred_type } = params;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'query cannot be empty');
  }

  // Step 1: Collect all entries from knowledge base
  const provinceFiles = await mcpReadAllProvinceFiles();
  const allEntries: EntrySearchResult[] = [];
  for (const [provinceName, content] of provinceFiles) {
    const parsed = mcpParseEntries(content, provinceName);
    allEntries.push(...parsed.map(convertSearchResult));
  }

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

// ---------------------------------------------------------------------------
// Local scoring helpers
// ---------------------------------------------------------------------------

function extractKeywords(query: string): string[] {
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
  return [...new Set(words)]; // Deduplicate
}

function detectProvince(query: string, preferred?: string): string | null {
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

function computeMatchScore(
  query: string,
  queryKeywords: string[],
  entry: EntrySearchResult,
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
      // Check keywords array
      if (entry.keywords.some(ekw => ekw.includes(kw) || kw.includes(ekw))) { hit = true; weight = Math.max(weight, 0.6); }
      // Check type
      if (entry.type.includes(kw)) { hit = true; weight = Math.max(weight, 0.3); }
      // Check province
      if (entry.province.includes(kw)) { hit = true; weight = Math.max(weight, 0.3); }
      // Check region
      if (entry.region.includes(kw)) { hit = true; weight = Math.max(weight, 0.2); }

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

function buildMatchReason(query: string, entry: EntrySearchResult, score: number): string {
  if (score >= 1.0) return `精确匹配：查询"${query}"与词条"${entry.name}"完全一致`;

  const reasons: string[] = [];

  // Name overlap
  if (entry.name.includes(query) || query.includes(entry.name)) {
    reasons.push(`名称包含"${query}"中的关键内容`);
  }

  // Keyword hits
  const queryKws = extractKeywords(query);
  const matchedKws = queryKws.filter(kw =>
    entry.name.includes(kw) || entry.summary.includes(kw) || entry.keywords.some(ekw => ekw.includes(kw) || kw.includes(ekw))
  );
  if (matchedKws.length > 0) {
    reasons.push(`关键词命中：${matchedKws.join('、')}`);
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