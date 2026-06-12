import { SupplementResult, SearchResult } from '../types.js';
import { readProvinceFile, parseFullEntry } from '../lib/markdown.js';
import { findProvinceByName } from '../lib/provinces.js';
import { scoreLocalRelevance, splitQueryTerms } from '../lib/local-relevance.js';
import { searchKnowledgeBase } from './search.js';

interface SupplementInput {
  entryName?: string;
  storyText?: string;
  province?: string;
  region?: string;
  keywords?: string[];
  type?: string;
}

export async function supplement(input: SupplementInput): Promise<SupplementResult> {
  const kwString = input.keywords?.join('、') ?? input.entryName ?? input.storyText ?? '';
  const excludeName = input.entryName ?? '';
  const province = input.province ? (findProvinceByName(input.province) ?? input.province) : undefined;
  const targetRegion = input.region ?? inferRegionFromText(input.storyText, input.keywords);

  const allKeywordResults = await searchKnowledgeBase({
    keywords: kwString,
    type: input.type,
  });
  const versionDifferences = allKeywordResults.filter(
    r => r.name === excludeName && r.province !== province
  );

  const sameRegionType = province
    ? (await searchKnowledgeBase({
        keywords: '',
        type: input.type,
        province,
      })).filter(r => r.name !== excludeName)
    : [];

  const relatedNetwork: SearchResult[] = [];
  for (const kw of input.keywords ?? []) {
    const kwResults = await searchKnowledgeBase({ keywords: kw });
    for (const r of kwResults) {
      if (
        r.name !== excludeName
        && !versionDifferences.some(v => v.name === r.name && v.province === r.province)
        && !sameRegionType.some(s => s.name === r.name)
        && !relatedNetwork.some(n => n.name === r.name && n.province === r.province)
      ) {
        relatedNetwork.push(r);
      }
    }
  }

  const localizedFocus = await buildLocalizedFocus({
    candidates: [...allKeywordResults, ...sameRegionType, ...relatedNetwork],
    excludeName,
    province,
    targetRegion,
    keywords: input.keywords,
    storyText: input.storyText,
  });

  return {
    versionDifferences,
    sameRegionType,
    relatedNetwork,
    localizedFocus,
    supplementStrategy: buildSupplementStrategy(targetRegion, province),
  };
}

async function buildLocalizedFocus(input: {
  candidates: SearchResult[];
  excludeName: string;
  province?: string;
  targetRegion?: string;
  keywords?: string[];
  storyText?: string;
}): Promise<SupplementResult['localizedFocus']> {
  const uniqueCandidates = dedupeEntries(input.candidates);
  const queryTerms = splitQueryTerms([
    input.keywords?.join('、') ?? '',
    input.excludeName,
    input.targetRegion ?? '',
  ].join('、'));
  const localized: SupplementResult['localizedFocus'] = [];

  for (const entry of uniqueCandidates) {
    const detail = await getCandidateDetail(entry);
    const relevance = scoreLocalRelevance({
      entry,
      detail,
      targetRegion: input.targetRegion,
      province: input.province,
      queryTerms,
      storyText: input.storyText,
    });
    if (!relevance) continue;
    localized.push({
      entry,
      relation_type: relevance.relation_type,
      score: relevance.score,
      match_reason: relevance.match_reason,
      evidence: relevance.evidence,
    });
  }

  return localized.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, 'zh-CN')).slice(0, 12);
}

async function getCandidateDetail(entry: SearchResult) {
  try {
    const content = await readProvinceFile(entry.province);
    return parseFullEntry(content, entry.name);
  } catch {
    return null;
  }
}

function dedupeEntries(entries: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const uniqueEntries: SearchResult[] = [];
  for (const entry of entries) {
    const key = `${entry.province}::${entry.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueEntries.push(entry);
  }
  return uniqueEntries;
}

function inferRegionFromText(storyText: string | undefined, keywords: string[] | undefined): string | undefined {
  const text = `${storyText ?? ''} ${keywords?.join(' ') ?? ''}`;
  const directCity = text.match(/([\u4e00-\u9fa5]{2,6}(?:市|县|区|州|府))/)?.[1];
  if (directCity) return directCity.replace(/[市县区州府]$/, '');
  return keywords?.find(keyword => keyword.length >= 2 && keyword.length <= 6);
}

function buildSupplementStrategy(targetRegion: string | undefined, province: string | undefined): string[] {
  const strategy = [
    '优先补充可核实的直接事件，不把思想影响误写成本人亲历。',
    '直接事件不足时，改走相关地点、书院学脉、地方传播和当代文化转化线。',
  ];
  if (targetRegion) strategy.unshift(`当前地方化目标：围绕「${targetRegion}」筛选直接地区、相关地点和思想文化影响。`);
  if (province) strategy.push(`同省材料仅作背景补强，需继续判断是否和目标地区发生关系：${province}。`);
  return strategy;
}
