// Compatibility facade. Runtime ownership lives in the china_culture Domain Pack.
export {
  chinaCultureProvinces as mcpProvinces,
  convertChinaCultureFullEntryDetail as convertFullEntryDetail,
  convertChinaCultureSearchResult as convertSearchResult,
  getChinaCultureEntryDetail as mcpGetEntryDetail,
  getChinaCultureFullEntryDetail as mcpGetFullEntryDetail,
  parseChinaCultureEntries as mcpParseEntries,
  parseChinaCultureFullEntry as mcpParseFullEntry,
  readAllChinaCultureProvinceFiles as mcpReadAllProvinceFiles,
  searchChinaCultureKnowledgeBase as mcpSearch,
} from '../domains/china-culture/knowledge-source-adapter.js';
