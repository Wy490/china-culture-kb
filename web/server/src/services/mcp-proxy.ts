// web/server/src/services/mcp-proxy.ts — MCP function adapter layer
// Import ONLY safe pure functions from mcp-server; NEVER import index.ts (starts stdio server)

import { searchKnowledgeBase } from '../../../../mcp-server/src/tools/search.js';
import { getEntryDetail } from '../../../../mcp-server/src/tools/get-entry-detail.js';
import { getFullEntryDetail, readAllProvinceFiles, parseEntries, parseFullEntry } from '../../../../mcp-server/src/lib/markdown.js';
import { PROVINCES } from '../../../../mcp-server/src/lib/provinces.js';
import type { SearchResult as McpSearchResult, FullEntryDetail as McpFullEntryDetail } from '../../../../mcp-server/src/types.js';
import { enrichEntryDetailWithMetadata, enrichSearchResultWithMetadata } from './domain-pack-service.js';

import type { EntrySearchResult, EntryDetail } from '@shared/types.js';

// ---------------------------------------------------------------------------
// Type conversion: MCP internal types → Web API types
// (MCP types are NEVER re-exported; only converted results reach the frontend)
// ---------------------------------------------------------------------------

export function convertSearchResult(mcp: McpSearchResult): EntrySearchResult {
  return enrichSearchResultWithMetadata({
    name: mcp.name,
    province: mcp.province,
    region: mcp.region,
    type: mcp.type,
    summary: mcp.summary,
    keywords: mcp.keywords,
    credibility: mcp.credibility,
  });
}

export function convertFullEntryDetail(mcp: McpFullEntryDetail): EntryDetail {
  return enrichEntryDetailWithMetadata({
    name: mcp.name,
    province: mcp.province,
    region: mcp.region,
    type: mcp.type,
    summary: mcp.summary,
    story: mcp.story,
    culturalSignificance: mcp.culturalSignificance,
    relatedLocations: mcp.relatedLocations,
    keywords: mcp.keywords,
    sources: mcp.sources,
    credibility: mcp.credibility,
    verificationMethod: mcp.verificationMethod,
    unverifiedPoints: mcp.unverifiedPoints,
  });
}

// ---------------------------------------------------------------------------
// Re-export MCP functions with renamed aliases (clear namespace boundary)
// ---------------------------------------------------------------------------

export const mcpSearch = searchKnowledgeBase;
export const mcpGetEntryDetail = getEntryDetail;
export const mcpGetFullEntryDetail = getFullEntryDetail;
export const mcpProvinces = PROVINCES;
export const mcpReadAllProvinceFiles = readAllProvinceFiles;
export const mcpParseEntries = parseEntries;
export const mcpParseFullEntry = parseFullEntry;
