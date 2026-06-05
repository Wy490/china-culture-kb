// web/server/src/services/entry-service.ts — Entry business logic

import {
  mcpSearch,
  mcpGetEntryDetail,
  convertSearchResult,
  convertFullEntryDetail,
} from './mcp-proxy.js';
import { success, fail, ErrorCodes } from '@shared/types.js';
import type { ApiResponse, EntrySearchResult, EntryDetail } from '@shared/types.js';

// ---------------------------------------------------------------------------
// Search entries
// ---------------------------------------------------------------------------

interface SearchParams {
  keywords?: string;
  type?: string;
  province?: string;
  region?: string;
}

export async function searchEntries(params: SearchParams): Promise<ApiResponse<EntrySearchResult[]>> {
  if (!params.keywords || params.keywords.trim() === '') {
    return success([]);
  }

  const results = await mcpSearch({
    keywords: params.keywords,
    type: params.type,
    province: params.province,
    region: params.region,
  });

  return success(results.map(convertSearchResult));
}

// ---------------------------------------------------------------------------
// Get entry detail by name
// ---------------------------------------------------------------------------

export async function getEntryDetailByName(name: string): Promise<ApiResponse<EntryDetail>> {
  const detail = await mcpGetEntryDetail(name);
  if (!detail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${name}" not found`);
  }
  return success(convertFullEntryDetail(detail));
}