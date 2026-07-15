import type { DomainPack } from '../../platform/domain-pack.js';
import { getChinaCultureEntryDetailByName } from './entry-detail-service.js';
import { matchChinaCultureEntries } from './entry-match-service.js';
import type { ChinaCultureEntryMatchParams } from './entry-match-service.js';
import { searchChinaCultureEntries } from './entry-search-service.js';
import type { ChinaCultureEntrySearchParams } from './entry-search-service.js';
import { CHINA_CULTURE_ENTRY_TYPES, CHINA_CULTURE_GENERATION_TYPES } from './type-catalog.js';
import { validateChinaCultureStoryContent } from './story-safety.js';
import { planChinaCultureStory } from './story-planning-service.js';
import { generateAndStoreChinaCultureStory } from './story-generation-service.js';

export const chinaCultureDomainPack: DomainPack = {
  meta: {
    schema_version: 'story-agent-domain-pack/v1',
    domain_id: 'china_culture',
    display_name: '中国传统文化故事',
    description: '中国传统文化知识检索与故事生产领域包',
    version: '1.0.0',
    capabilities: ['entry_search', 'entry_detail', 'entry_match', 'story_plan', 'story_generate', 'type_catalog', 'story_safety', 'gears_mapping'],
  },
  entryTypes: CHINA_CULTURE_ENTRY_TYPES,
  generationTypes: CHINA_CULTURE_GENERATION_TYPES,
  searchEntries(params) {
    return searchChinaCultureEntries(params as ChinaCultureEntrySearchParams);
  },
  getEntryDetail: getChinaCultureEntryDetailByName,
  matchEntries(params) {
    return matchChinaCultureEntries(params as ChinaCultureEntryMatchParams);
  },
  planStory(params) {
    return planChinaCultureStory(params.entry_name, params.original_user_query);
  },
  generateStory(request, options) {
    return generateAndStoreChinaCultureStory(request, {
      ...options,
      source_domain: 'china_culture',
      validate_story_content: validateChinaCultureStoryContent,
    });
  },
  validateStoryContent: validateChinaCultureStoryContent,
  mapGearsConstraints({ story, segment }) {
    return [...new Set([
      ...story.cultural_constraints,
      ...segment.cultural_constraints,
    ].map(item => item.trim()).filter(Boolean))];
  },
};
