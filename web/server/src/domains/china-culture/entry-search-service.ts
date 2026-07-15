import { success } from '@shared/types.js';
import type { ApiResponse, EntrySearchResult } from '@shared/types.js';
import {
  buildChinaCultureEntryMatchedSnippets as buildEntryMatchedSnippets,
  collectChinaCultureSearchableEntries as collectSearchableEntries,
} from './entry-knowledge-service.js';
import type { SearchableEntry } from './entry-knowledge-service.js';
import {
  convertChinaCultureSearchResult as convertSearchResult,
  searchChinaCultureKnowledgeBase as mcpSearch,
} from './knowledge-source-adapter.js';
import { extractChinaCultureKeywords } from './entry-language-helpers.js';

export interface ChinaCultureEntrySearchParams {
  keywords?: string;
  type?: string;
  province?: string;
  region?: string;
}

type SearchIntent = 'person_experience' | 'place_building' | 'folk_ritual' | 'religion' | 'event' | 'craft_process' | 'general';

export async function searchChinaCultureEntries(
  params: ChinaCultureEntrySearchParams,
): Promise<ApiResponse<EntrySearchResult[]>> {
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

  const queryKeywords = extractChinaCultureKeywords(params.keywords ?? '');
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
