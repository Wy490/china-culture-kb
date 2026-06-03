import { QueryIndexResult, SearchResult } from '../types.js';
import { readAllProvinceFiles, parseEntries } from '../lib/markdown.js';
import { PROVINCES, findProvinceByName } from '../lib/provinces.js';

interface QueryIndexInput {
  query_type: string;
  filter: string;
  province?: string;
}

export async function queryIndex(input: QueryIndexInput): Promise<QueryIndexResult> {
  const provincesToSearch = input.province
    ? [findProvinceByName(input.province) ?? input.province]
    : undefined;

  // When province specified, only read that one file (not all 34)
  const allFiles = await readAllProvinceFiles(provincesToSearch, !!input.province);
  const allEntries: SearchResult[] = [];

  for (const [province, content] of allFiles) {
    const entries = parseEntries(content, province);
    allEntries.push(...entries);
  }

  let filtered: SearchResult[];
  switch (input.query_type) {
    case 'by_type':
      filtered = allEntries.filter(e => e.type === input.filter);
      break;
    case 'by_keyword':
      filtered = allEntries.filter(e => e.keywords.some(kw => kw === input.filter));
      break;
    case 'by_region':
      filtered = allEntries.filter(e => e.region.includes(input.filter));
      break;
    default:
      throw new Error(`不支持的查询类型：${input.query_type}。支持：by_type, by_keyword, by_region`);
  }

  const provincesInvolved = [...new Set(filtered.map(e => e.province))];

  return {
    queryType: input.query_type as QueryIndexResult['queryType'],
    filter: input.filter,
    entries: filtered,
    count: filtered.length,
    provincesInvolved,
  };
}