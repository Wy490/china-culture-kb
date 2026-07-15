// China Culture knowledge-source adapter.
// Import only pure MCP functions; importing the MCP index would start stdio.
import { getFullEntryDetail, parseEntries, parseFullEntry, readAllProvinceFiles } from '../../../../../mcp-server/src/lib/markdown.js';
import { PROVINCES } from '../../../../../mcp-server/src/lib/provinces.js';
import { getEntryDetail } from '../../../../../mcp-server/src/tools/get-entry-detail.js';
import { searchKnowledgeBase } from '../../../../../mcp-server/src/tools/search.js';
import type {
  FullEntryDetail as McpFullEntryDetail,
  SearchResult as McpSearchResult,
} from '../../../../../mcp-server/src/types.js';
import type { EntryDetail, EntrySearchResult } from '@shared/types.js';
import {
  enrichChinaCultureEntryDetailWithMetadata,
  enrichChinaCultureSearchResultWithMetadata,
} from './entry-metadata-service.js';

export function convertChinaCultureSearchResult(mcp: McpSearchResult): EntrySearchResult {
  return enrichChinaCultureSearchResultWithMetadata({
    name: mcp.name,
    province: mcp.province,
    region: mcp.region,
    type: mcp.type,
    summary: mcp.summary,
    keywords: mcp.keywords,
    credibility: mcp.credibility,
    knowledge_domain: mcp.knowledge_domain,
    entry_role: mcp.entry_role,
    era: mcp.era,
    asset_usage: mcp.asset_usage,
    asset_split: mcp.asset_split,
  });
}

export function convertChinaCultureFullEntryDetail(mcp: McpFullEntryDetail): EntryDetail {
  return enrichChinaCultureEntryDetailWithMetadata({
    name: mcp.name,
    province: mcp.province,
    region: mcp.region,
    type: mcp.type,
    summary: mcp.summary,
    story: mcp.story,
    culturalSignificance: mcp.culturalSignificance,
    relatedLocations: mcp.relatedLocations,
    localCreativeRelations: mcp.localCreativeRelations,
    keywords: mcp.keywords,
    sources: mcp.sources,
    credibility: mcp.credibility,
    verificationMethod: mcp.verificationMethod,
    unverifiedPoints: mcp.unverifiedPoints,
    knowledge_domain: mcp.knowledge_domain,
    entry_role: mcp.entry_role,
    era: mcp.era,
    asset_usage: mcp.asset_usage,
    asset_split: mcp.asset_split,
  });
}

export const searchChinaCultureKnowledgeBase = searchKnowledgeBase;
export const getChinaCultureEntryDetail = getEntryDetail;
export const getChinaCultureFullEntryDetail = getFullEntryDetail;
export const chinaCultureProvinces = PROVINCES;
export const readAllChinaCultureProvinceFiles = readAllProvinceFiles;
export const parseChinaCultureEntries = parseEntries;
export const parseChinaCultureFullEntry = parseFullEntry;
