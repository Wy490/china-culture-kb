// Compatibility facade. Runtime ownership lives in the china_culture Domain Pack.
export {
  buildChinaCultureEntryKnowledgeSummary as buildEntryKnowledgeSummary,
  buildChinaCultureEntryMatchedSnippets as buildEntryMatchedSnippets,
  collectChinaCultureSearchableEntries as collectSearchableEntries,
} from '../domains/china-culture/entry-knowledge-service.js';
export type { SearchableEntry } from '../domains/china-culture/entry-knowledge-service.js';
