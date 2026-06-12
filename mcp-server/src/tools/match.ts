import { MatchedEntry, MatchResult, SearchResult } from '../types.js';
import { readAllProvinceFiles, parseEntries, parseFullEntry } from '../lib/markdown.js';
import { scoreLocalRelevance, splitQueryTerms, normalizeForMatch, unique } from '../lib/local-relevance.js';

interface MatchInput {
  storyText: string;
  provinceHints?: string[];
  typeHint?: string;
  regionHint?: string;
}

export async function matchEntries(input: MatchInput): Promise<MatchResult> {
  const provinceHints = input.provinceHints?.map(hint => hint.trim()).filter(Boolean) ?? [];
  // When province hints are provided, only read those provinces (not all 34)
  const allFiles = await readAllProvinceFiles(provinceHints, provinceHints.length > 0);
  const allEntries: MatchResult['entries'] = [];
  const matchedEntries: MatchedEntry[] = [];
  let totalEntriesRead = 0;
  const queryTerms = splitQueryTerms(input.storyText);
  const regionHint = input.regionHint ?? inferRegionFromText(input.storyText);

  for (const [province, content] of allFiles) {
    const entries = parseEntries(content, province);
    totalEntriesRead += entries.length;

    const filtered = input.typeHint
      ? entries.filter(e => e.type === input.typeHint)
      : entries;

    allEntries.push(...filtered);

    for (const entry of filtered) {
      const detail = parseFullEntry(content, entry.name);
      const basic = scoreTextMatch(entry, detail?.story ?? '', detail?.culturalSignificance ?? '', input.storyText, queryTerms, provinceHints);
      const local = scoreLocalRelevance({
        entry,
        detail,
        targetRegion: regionHint,
        province: provinceHints[0],
        queryTerms,
        storyText: input.storyText,
      });
      const score = Math.round((basic.score + (local?.score ?? 0)) * 100) / 100;
      if (score <= 0) continue;
      matchedEntries.push({
        ...entry,
        score,
        match_reason: buildMatchReason(entry, score, basic.evidence, local?.match_reason),
        evidence: unique([...basic.evidence, ...(local?.evidence ?? [])]).slice(0, 8),
        ...(local?.relation_type ? { relation_type: local.relation_type } : {}),
        usable_for_story: score >= 3,
      });
    }
  }

  matchedEntries.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'));

  return {
    entries: allEntries,
    matchedEntries: matchedEntries.slice(0, 20),
    provinceHints,
    totalEntriesRead,
  };
}

function scoreTextMatch(
  entry: SearchResult,
  story: string,
  culturalSignificance: string,
  storyText: string,
  queryTerms: string[],
  provinceHints: string[],
): { score: number; evidence: string[] } {
  const normalizedStoryText = normalizeForMatch(storyText);
  const fields = [
    { label: '名称', text: entry.name, weight: 4 },
    { label: '关键词', text: entry.keywords.join('、'), weight: 2.5 },
    { label: '简介', text: entry.summary, weight: 1.5 },
    { label: '地区', text: entry.region, weight: 1.2 },
    { label: '故事梗概', text: story, weight: 1 },
    { label: '文化意义', text: culturalSignificance, weight: 1 },
  ];
  let score = 0;
  const evidence: string[] = [];

  if (normalizedStoryText.includes(normalizeForMatch(entry.name))) {
    score += 5;
    evidence.push(`故事文本直接提到词条「${entry.name}」`);
  }

  for (const term of queryTerms) {
    let bestHit: { label: string; weight: number } | null = null;
    for (const field of fields) {
      if (normalizeForMatch(field.text).includes(normalizeForMatch(term))) {
        if (!bestHit || field.weight > bestHit.weight) {
          bestHit = { label: field.label, weight: field.weight };
        }
      }
    }
    if (!bestHit) continue;
    score += Math.min(bestHit.weight, term.length >= 3 ? bestHit.weight : bestHit.weight * 0.7);
    evidence.push(`${bestHit.label}命中「${term}」`);
  }

  if (provinceHints.includes(entry.province)) {
    score += 0.8;
    evidence.push(`省份线索匹配「${entry.province}」`);
  }

  return { score: Math.round(score * 100) / 100, evidence: unique(evidence) };
}

function buildMatchReason(entry: SearchResult, score: number, evidence: string[], localReason: string | undefined): string {
  const evidenceText = evidence.slice(0, 3).join('；') || '文本语义相关';
  const localText = localReason ? `；${localReason}` : '';
  return `匹配「${entry.name}」：${evidenceText}${localText}。综合分 ${score}`;
}

function inferRegionFromText(storyText: string): string | undefined {
  return storyText.match(/([\u4e00-\u9fa5]{2,6})(?:市|县|区|州|府)/)?.[1];
}
