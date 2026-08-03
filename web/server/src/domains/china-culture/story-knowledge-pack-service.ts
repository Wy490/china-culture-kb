import type { EntryDetail, KnowledgePack, KnowledgePackEntry } from '@shared/types.js';
import { buildChinaCultureEntryKnowledgeSummary } from './entry-knowledge-service.js';
import { extractChinaCultureKeywords } from './entry-language-helpers.js';
import { appendChinaCultureDomainPackEntries } from './domain-pack-production-service.js';
import { attachMachineProductionGuidance } from './entry-production-guidance-service.js';

export interface ChinaCultureSingleEntryKnowledgePackContext {
  selectedEvent?: string;
  originalUserQuery?: string;
  outline?: string;
}

export function buildChinaCultureSingleEntryKnowledgePack(
  entry: EntryDetail,
  context: ChinaCultureSingleEntryKnowledgePackContext,
): KnowledgePack {
  const queryText = [
    context.originalUserQuery,
    context.outline,
    context.selectedEvent,
    entry.name,
  ].filter(Boolean).join(' ');
  const extractedKeywords = extractChinaCultureKeywords(queryText);
  const queryKeywords = context.selectedEvent
    ? [context.selectedEvent, ...extractedKeywords.filter(keyword => keyword !== context.selectedEvent)]
    : [...extractedKeywords, ...entry.keywords.slice(0, 5)];
  const summary = buildChinaCultureEntryKnowledgeSummary({
    name: entry.name,
    province: entry.province,
    region: entry.region,
    type: entry.type,
    summary: entry.summary,
    keywords: entry.keywords,
    credibility: entry.credibility,
    story: entry.story,
    culturalSignificance: entry.culturalSignificance,
    relatedLocationText: entry.relatedLocations.map(location => `${location.name} ${location.description}`).join(' '),
    sourcesText: entry.sources.join(' '),
    verificationText: entry.verificationMethod ?? '',
    unverifiedText: entry.unverifiedPoints.join(' '),
  }, queryKeywords);
  const primaryEntry: KnowledgePackEntry = attachMachineProductionGuidance({
    entry_name: entry.name,
    province: entry.province,
    region: entry.region,
    type: entry.type,
    summary,
    score: 1,
    role_in_story: 'primary_entry',
    match_reason: '用户指定来源条目，自动注入全文项目素材包',
    keywords: entry.keywords,
    knowledge_domain: entry.knowledge_domain,
    entry_role: entry.entry_role,
    era: entry.era,
    asset_usage: entry.asset_usage,
    asset_split: entry.asset_split,
  }, {
    name: entry.name,
    type: entry.type,
    summary: entry.summary,
    story: entry.story,
    culturalSignificance: entry.culturalSignificance,
    credibility: entry.credibility,
    unverifiedPoints: entry.unverifiedPoints,
    relatedLocations: entry.relatedLocations,
    asset_usage: entry.asset_usage,
    asset_split: entry.asset_split,
  });

  return {
    primary_entries: [primaryEntry],
    supporting_entries: appendChinaCultureDomainPackEntries([], {
      query: queryText,
      entry,
      primaryEntries: [primaryEntry],
      limit: 4,
    }),
    missing_needs: [],
    overall_confidence: 1,
  };
}
