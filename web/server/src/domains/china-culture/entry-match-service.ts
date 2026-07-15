import { fail, success, ErrorCodes } from '@shared/types.js';
import type { ApiResponse, EntryMatchItem, EntryMatchResult } from '@shared/types.js';
import { collectChinaCultureSearchableEntries as collectSearchableEntries } from './entry-knowledge-service.js';
import type { SearchableEntry } from './entry-knowledge-service.js';
import {
  CHINA_CULTURE_TYPE_KEYWORD_HINTS,
  detectChinaCultureProvince,
  extractChinaCultureKeywords,
} from './entry-language-helpers.js';

export interface ChinaCultureEntryMatchParams {
  query: string;
  limit: number;
  preferred_province?: string;
  preferred_type?: string;
}

export async function matchChinaCultureEntries(
  params: ChinaCultureEntryMatchParams,
): Promise<ApiResponse<EntryMatchResult>> {
  const { query, limit, preferred_province, preferred_type } = params;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'query cannot be empty');
  }

  const allEntries = await collectSearchableEntries();
  const queryKeywords = extractChinaCultureKeywords(trimmedQuery);
  const queryProvince = detectChinaCultureProvince(trimmedQuery, preferred_province);
  const scored: EntryMatchItem[] = [];
  for (const entry of allEntries) {
    const score = computeChinaCultureMatchScore(trimmedQuery, queryKeywords, entry, queryProvince, preferred_type);
    if (score >= 0.35) {
      scored.push({
        entry_name: entry.name,
        province: entry.province,
        type: entry.type,
        score: Math.round(score * 100) / 100,
        match_reason: buildMatchReason(trimmedQuery, entry, score),
        usable_for_story: score >= 0.75,
      });
    }
  }

  scored.sort((left, right) => right.score - left.score);
  const matches = scored.slice(0, limit);
  const bestMatch = matches.find(match => match.score >= 0.75) ?? null;
  let fallbackMessage: string | null = null;
  if (matches.length === 0) {
    fallbackMessage = '素材库中暂未找到高度相关来源条目，请更换关键词或先补充项目素材。';
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

export function computeChinaCultureMatchScore(
  query: string,
  queryKeywords: string[],
  entry: SearchableEntry,
  queryProvince: string | null,
  preferredType?: string,
): number {
  let score = 0;
  if (query === entry.name) return 1.0;

  const entryCoreName = entry.name.split('——')[0];
  if (entry.name.includes(query) || query.includes(entry.name)) {
    const overlapRatio = Math.min(query.length, entry.name.length) / Math.max(query.length, entry.name.length);
    score += 0.75 + overlapRatio * 0.2;
  } else if (query.includes(entryCoreName) || entryCoreName.includes(query)) {
    const coreRatio = entryCoreName.length / query.length;
    score += 0.65 + coreRatio * 0.2;
  }

  if (score < 0.65) {
    let keywordHits = 0;
    let keywordHitWeight = 0;
    for (const keyword of queryKeywords) {
      let hit = false;
      let weight = 0.5;
      if (entry.name.includes(keyword)) { hit = true; weight = 1.0; }
      if (entryCoreName.includes(keyword)) { hit = true; weight = 0.8; }
      if (entry.summary.includes(keyword)) { hit = true; weight = Math.max(weight, 0.4); }
      if ((entry.story ?? '').includes(keyword)) { hit = true; weight = Math.max(weight, 0.55); }
      if ((entry.relatedLocationText ?? '').includes(keyword)) { hit = true; weight = Math.max(weight, 0.65); }
      if ((entry.localCreativeRelationText ?? '').includes(keyword)) { hit = true; weight = Math.max(weight, 0.75); }
      if ((entry.culturalSignificance ?? '').includes(keyword)) { hit = true; weight = Math.max(weight, 0.35); }
      if (entry.keywords.some(entryKeyword => entryKeyword.includes(keyword) || keyword.includes(entryKeyword))) {
        hit = true;
        weight = Math.max(weight, 0.6);
      }
      if (entry.type.includes(keyword)) { hit = true; weight = Math.max(weight, 0.3); }
      if (entry.province.includes(keyword)) { hit = true; weight = Math.max(weight, 0.3); }
      if (entry.region.includes(keyword)) { hit = true; weight = Math.max(weight, 0.2); }
      if ((entry.sourcesText ?? '').includes(keyword) || (entry.verificationText ?? '').includes(keyword) || (entry.unverifiedText ?? '').includes(keyword)) {
        hit = true;
        weight = Math.max(weight, 0.2);
      }
      if ((entry.assetSplitText ?? '').includes(keyword)) {
        hit = true;
        weight = Math.max(weight, 0.45);
      }
      if (hit) {
        keywordHits += 1;
        keywordHitWeight += weight;
      }
    }
    if (queryKeywords.length > 0 && keywordHits > 0) {
      score += 0.2 + (keywordHitWeight / queryKeywords.length) * 0.5;
    }
  }

  if (queryProvince && entry.province === queryProvince) score += 0.1;
  score += computeLocalizedTargetBoost(query, entry);
  if (preferredType && entry.type === preferredType) {
    score += 0.1;
  } else if (!preferredType) {
    for (const [typeName, hints] of Object.entries(CHINA_CULTURE_TYPE_KEYWORD_HINTS)) {
      const hintHits = hints.filter(hint => query.includes(hint)).length;
      if (hintHits > 0 && entry.type === typeName) score += Math.min(0.12, hintHits * 0.04);
    }
  }
  return Math.min(0.99, score);
}

function buildMatchReason(query: string, entry: SearchableEntry, score: number): string {
  if (score >= 1.0) return `精确匹配：查询"${query}"与词条"${entry.name}"完全一致`;
  const reasons: string[] = [];
  if (entry.name.includes(query) || query.includes(entry.name)) {
    reasons.push(`名称包含"${query}"中的关键内容`);
  }

  const queryKeywords = extractChinaCultureKeywords(query);
  const matchedKeywords = queryKeywords.filter(keyword =>
    entry.name.includes(keyword)
    || entry.summary.includes(keyword)
    || (entry.story ?? '').includes(keyword)
    || (entry.relatedLocationText ?? '').includes(keyword)
    || (entry.localCreativeRelationText ?? '').includes(keyword)
    || (entry.culturalSignificance ?? '').includes(keyword)
    || (entry.assetSplitText ?? '').includes(keyword)
    || entry.keywords.some(entryKeyword => entryKeyword.includes(keyword) || keyword.includes(entryKeyword))
  );
  if (matchedKeywords.length > 0) reasons.push(`关键词命中：${matchedKeywords.join('、')}`);
  if (queryKeywords.some(keyword => (entry.story ?? '').includes(keyword))) reasons.push('故事梗概命中');
  if (queryKeywords.some(keyword => (entry.relatedLocationText ?? '').includes(keyword))) reasons.push('相关地点命中');
  if (queryKeywords.some(keyword => (entry.localCreativeRelationText ?? '').includes(keyword))) reasons.push('地方化创作关系命中');

  const detectedProvince = detectChinaCultureProvince(query);
  if (detectedProvince && entry.province === detectedProvince) reasons.push(`省份匹配：${entry.province}`);
  for (const [typeName, hints] of Object.entries(CHINA_CULTURE_TYPE_KEYWORD_HINTS)) {
    if (entry.type === typeName && hints.some(hint => query.includes(hint))) reasons.push(`类型匹配：${typeName}`);
  }
  if (reasons.length === 0) reasons.push('部分内容相关性');
  return reasons.join('，');
}

function computeLocalizedTargetBoost(query: string, entry: SearchableEntry): number {
  const target = extractLocalizedTargetRegion(query);
  if (!target) return 0;
  let boost = 0;
  if (entry.region.includes(target)) boost += 0.18;
  if ((entry.relatedLocationText ?? '').includes(target)) boost += 0.16;
  if ((entry.localCreativeRelationText ?? '').includes(target)) boost += 0.22;
  if ((entry.culturalSignificance ?? '').includes(target)) boost += 0.1;
  if (/严格|直接事件|亲历|发生/.test(query) && !entry.region.includes(target) && !(entry.localCreativeRelationText ?? '').includes(`直接事件 ${target}`)) {
    boost -= 0.08;
  }
  return boost;
}

function extractLocalizedTargetRegion(query: string): string | null {
  const patterns = [
    /甲方指定地域[:：]\s*([^\s，,。；;]+)/,
    /本地化目标[:：]\s*([^\s，,。；;]+)/,
    /当地范围[:：]\s*([^\s，,。；;]+)/,
  ];
  for (const pattern of patterns) {
    const matched = query.match(pattern)?.[1]?.trim();
    if (matched) return matched;
  }
  return null;
}
