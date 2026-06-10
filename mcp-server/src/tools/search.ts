import { SearchResult } from '../types.js';
import { readProvinceFile, parseEntries, parseFullEntry } from '../lib/markdown.js';
import { PROVINCES, findProvinceByName } from '../lib/provinces.js';

interface SearchInput {
  keywords?: string;
  type?: string;
  province?: string;
  region?: string;
}

const INTENT_EXPANSIONS: Record<string, { types: string[]; terms: string[] }> = {
  人物: {
    types: ['历史人物'],
    terms: ['生平', '经历', '事迹', '故居', '墓', '祠', '书院', '师承', '思想'],
  },
  地点: {
    types: ['名胜古迹', '地方掌故'],
    terms: ['地点', '遗址', '景区', '故居', '古城', '山', '湖', '江', '洞', '岛'],
  },
  建筑: {
    types: ['名胜古迹', '宗教信仰'],
    terms: ['建筑', '楼', '阁', '亭', '寺', '庙', '祠', '书院', '故居', '古井'],
  },
  民俗: {
    types: ['民俗活动', '节庆习俗', '非遗'],
    terms: ['民俗', '习俗', '仪式', '节庆', '祭祀', '歌舞', '龙舟', '赶秋'],
  },
  宗教: {
    types: ['宗教信仰', '名胜古迹'],
    terms: ['宗教', '信仰', '佛教', '道教', '寺', '庙', '祠', '祭祀', '神灵'],
  },
  事件: {
    types: ['地方掌故', '历史人物'],
    terms: ['事件', '经历', '转折', '冲突', '拒签', '投江', '起义', '会讲', '殉国'],
  },
};

function unique(items: string[]): string[] {
  return [...new Set(items.map(item => item.trim()).filter(Boolean))];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function splitKeywords(raw: string): string[] {
  const parts = raw.split(/[,，、\s;；:：·——\-–_]+/).filter(part => part.trim().length >= 2);
  const terms: string[] = [...parts];
  for (const part of parts) {
    if (part.length > 4) {
      for (let i = 0; i < part.length - 1; i += 1) {
        terms.push(part.substring(i, i + 2));
      }
    }
  }
  return unique(terms);
}

function expandKeywords(keywords: string[]): { terms: string[]; typeHints: Set<string> } {
  const terms = [...keywords];
  const typeHints = new Set<string>();
  const queryText = keywords.join('');

  for (const [intent, expansion] of Object.entries(INTENT_EXPANSIONS)) {
    if (queryText.includes(intent) || expansion.terms.some(term => queryText.includes(term))) {
      terms.push(...expansion.terms);
      expansion.types.forEach(type => typeHints.add(type));
    }
  }

  return { terms: unique(terms), typeHints };
}

function fieldScore(fieldText: string, term: string, weight: number): number {
  if (!fieldText || !term) return 0;
  const normalizedField = normalizeText(fieldText);
  const normalizedTerm = normalizeText(term);
  if (!normalizedField || !normalizedTerm) return 0;
  if (normalizedField === normalizedTerm) return weight * 1.25;
  if (normalizedField.includes(normalizedTerm)) return weight;
  if (normalizedTerm.includes(normalizedField) && normalizedField.length >= 2) return weight * 0.75;
  return 0;
}

function buildSearchCorpus(entry: SearchResult, content: string): string[] {
  const detail = parseFullEntry(content, entry.name);
  return [
    entry.name,
    entry.province,
    entry.region,
    entry.type,
    entry.summary,
    entry.keywords.join('、'),
    detail?.story ?? '',
    detail?.culturalSignificance ?? '',
    detail?.relatedLocations.map(location => `${location.name} ${location.description}`).join(' ') ?? '',
    detail?.sources.join(' ') ?? '',
    detail?.verificationMethod ?? '',
    detail?.unverifiedPoints.join(' ') ?? '',
  ];
}

function computeSearchScore(
  entry: SearchResult,
  content: string,
  terms: string[],
  typeHints: Set<string>,
): number {
  if (terms.length === 0) return 1;

  const detail = parseFullEntry(content, entry.name);
  const fields = [
    { text: entry.name, weight: 5 },
    { text: entry.keywords.join('、'), weight: 4 },
    { text: entry.summary, weight: 3 },
    { text: entry.region, weight: 2.2 },
    { text: entry.type, weight: 2 },
    { text: detail?.relatedLocations.map(location => `${location.name} ${location.description}`).join(' ') ?? '', weight: 2.5 },
    { text: detail?.story ?? '', weight: 2 },
    { text: detail?.culturalSignificance ?? '', weight: 1.5 },
    { text: detail?.sources.join(' ') ?? '', weight: 0.8 },
    { text: detail?.verificationMethod ?? '', weight: 0.6 },
    { text: detail?.unverifiedPoints.join(' ') ?? '', weight: 0.5 },
    { text: entry.province, weight: 1.2 },
  ];

  let score = typeHints.has(entry.type) ? 1.5 : 0;
  for (const term of terms) {
    let best = 0;
    for (const field of fields) {
      best = Math.max(best, fieldScore(field.text, term, field.weight));
    }
    score += best;
  }
  return score;
}

export async function searchKnowledgeBase(input: SearchInput): Promise<SearchResult[]> {
  const provincesToSearch = input.province
    ? [findProvinceByName(input.province) ?? input.province]
    : PROVINCES;

  const keywordList = splitKeywords(input.keywords ?? '');
  const expanded = expandKeywords(keywordList);
  const results: Array<{ entry: SearchResult; score: number }> = [];

  for (const province of provincesToSearch) {
    try {
      const content = await readProvinceFile(province);
      const entries = parseEntries(content, province);

      for (const entry of entries) {
        if (input.type && entry.type !== input.type) continue;
        if (input.region && !entry.region.includes(input.region)) continue;

        let score = computeSearchScore(entry, content, expanded.terms, expanded.typeHints);

        if (keywordList.length > 0) {
          const corpus = buildSearchCorpus(entry, content).join(' ');
          const normalizedCorpus = normalizeText(corpus);
          const directHitCount = keywordList.filter(kw => normalizeText(kw).length >= 2 && normalizedCorpus.includes(normalizeText(kw))).length;
          const hasDirectHit = directHitCount > 0;
          const hasIntentTypeHit = expanded.typeHints.has(entry.type);
          if (score <= 0 || (!hasDirectHit && !hasIntentTypeHit)) continue;
          score += directHitCount * 20;
        }

        if (input.province && entry.province === (findProvinceByName(input.province) ?? input.province)) score += 1;
        if (input.type && entry.type === input.type) score += 1;
        if (input.region && entry.region.includes(input.region)) score += 1;

        results.push({ entry, score });
      }
    } catch {
      continue;
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, 'zh-CN'))
    .map(result => result.entry);
}
