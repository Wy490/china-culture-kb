/**
 * Compatibility facade for callers that still import the legacy service path.
 * Production code should depend on the explicit china_culture domain service.
 */
export {
  appendChinaCultureDomainPackEntries as appendDomainPackEntries,
  buildChinaCultureDomainPackEntries as buildDomainPackEntries,
  getChinaCultureDomainPackProductionHealthReport as getDomainPackProductionHealthReport,
  getChinaCultureDomainPackSeeds as getDomainPackSeeds,
} from '../domains/china-culture/domain-pack-production-service.js';
export {
  enrichChinaCultureEntryDetailWithMetadata as enrichEntryDetailWithMetadata,
  enrichChinaCultureSearchResultWithMetadata as enrichSearchResultWithMetadata,
  inferChinaCultureEntryMetadata as inferEntryMetadata,
} from '../domains/china-culture/entry-metadata-service.js';
