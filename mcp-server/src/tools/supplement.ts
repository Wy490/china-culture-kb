import { SupplementResult, SearchResult } from '../types.js';
import { searchKnowledgeBase } from './search.js';

interface SupplementInput {
  entryName?: string;
  storyText?: string;
  province?: string;
  keywords?: string[];
  type?: string;
}

export async function supplement(input: SupplementInput): Promise<SupplementResult> {
  const kwString = input.keywords?.join('、') ?? input.entryName ?? input.storyText ?? '';
  const excludeName = input.entryName ?? '';

  const allKeywordResults = await searchKnowledgeBase({
    keywords: kwString,
    type: input.type,
  });
  const versionDifferences = allKeywordResults.filter(
    r => r.name === excludeName && r.province !== input.province
  );

  const sameRegionType = input.province
    ? (await searchKnowledgeBase({
        keywords: '',
        type: input.type,
        province: input.province,
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

  return { versionDifferences, sameRegionType, relatedNetwork };
}