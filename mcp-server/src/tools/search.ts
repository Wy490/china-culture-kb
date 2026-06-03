import { SearchResult } from '../types.js';
import { readProvinceFile, parseEntries } from '../lib/markdown.js';
import { PROVINCES, findProvinceByName } from '../lib/provinces.js';

interface SearchInput {
  keywords: string;
  type?: string;
  province?: string;
  region?: string;
}

export async function searchKnowledgeBase(input: SearchInput): Promise<SearchResult[]> {
  const provincesToSearch = input.province
    ? [findProvinceByName(input.province) ?? input.province]
    : PROVINCES;

  const keywordList = input.keywords.split(/[,，、\s]+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const province of provincesToSearch) {
    try {
      const content = await readProvinceFile(province);
      const entries = parseEntries(content, province);

      for (const entry of entries) {
        if (input.type && entry.type !== input.type) continue;
        if (input.region && entry.region !== input.region) continue;

        if (keywordList.length > 0) {
          const matchCount = keywordList.filter(kw =>
            entry.keywords.some(ekw => ekw.includes(kw) || kw.includes(ekw))
            || entry.name.includes(kw)
            || entry.summary.includes(kw)
          ).length;
          if (matchCount === 0) continue;
        }

        results.push(entry);
      }
    } catch {
      continue;
    }
  }
  return results;
}