import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { success } from '@shared/types.js';
import {
  DomainPackNotFoundError,
  DomainPackRegistrationError,
  DomainPackRegistry,
  type DomainPack,
} from '../platform/domain-pack.js';
import { createStoryAgentDomainRegistry } from '../platform/domain-registry.js';

function fakePack(domain: string): DomainPack {
  return {
    meta: {
      schema_version: 'story-agent-domain-pack/v1',
      domain_id: domain,
      display_name: domain,
      description: `${domain} test pack`,
      version: '1.0.0',
      capabilities: ['entry_search', 'entry_detail', 'entry_match', 'story_plan', 'story_generate', 'type_catalog', 'story_safety', 'gears_mapping'],
    },
    entryTypes: [{
      name: 'test_entry',
      recommended_generation_types: [`${domain}_generation`],
      recommended_video_types: [`${domain}_story`],
      recommended_presentation_styles: [`${domain}_style`],
      description: 'test entry type',
    }],
    generationTypes: [{
      id: `${domain}_story`,
      group: 'test group',
      label: `${domain} story`,
      description: 'test generation type',
      default_presentation_style: `${domain}_style`,
      default_duration: 60,
      compatible_entry_types: ['test_entry'],
    }],
    async searchEntries() {
      return success([]);
    },
    async getEntryDetail() {
      throw new Error('not used by registry unit tests');
    },
    async matchEntries() {
      return success({ query: '', matches: [], best_match: null, fallback_message: null });
    },
    async planStory() {
      throw new Error('not used by registry unit tests');
    },
    async generateStory() {
      throw new Error('not used by registry unit tests');
    },
    validateStoryContent() {
      throw new Error('not used by registry unit tests');
    },
    mapGearsConstraints({ story, segment }) {
      return [...story.cultural_constraints, ...segment.cultural_constraints];
    },
  };
}

describe('DomainPackRegistry', () => {
  it('registers packs and exposes a deterministic domain list', () => {
    const registry = new DomainPackRegistry();
    registry.register(fakePack('second_domain'));
    registry.register(fakePack('first_domain'));

    expect(registry.list()).toEqual(['first_domain', 'second_domain']);
    expect(registry.require('first_domain').meta.domain_id).toBe('first_domain');
    expect(registry.require('first_domain').generationTypes[0]?.id).toBe('first_domain_story');
  });

  it('fails closed for an unknown domain', () => {
    const registry = new DomainPackRegistry();

    expect(() => registry.require('unknown_domain')).toThrow(DomainPackNotFoundError);
    try {
      registry.require('unknown_domain');
    } catch (error) {
      expect(error).toMatchObject({ code: 'DOMAIN_PACK_NOT_FOUND' });
    }
  });

  it('rejects invalid and duplicate registrations', () => {
    const registry = new DomainPackRegistry();
    registry.register(fakePack('china_culture'));

    expect(() => registry.register(fakePack('../unsafe'))).toThrow(DomainPackRegistrationError);
    expect(() => registry.register(fakePack('china_culture'))).toThrow(DomainPackRegistrationError);

    const baseIncompletePack = fakePack('incomplete_domain');
    const incompletePack: DomainPack = {
      ...baseIncompletePack,
      meta: { ...baseIncompletePack.meta, capabilities: ['entry_search'] },
    };
    expect(() => registry.register(incompletePack)).toThrow(DomainPackRegistrationError);
  });

  it('rejects malformed domain-owned type catalogs without restricting valid new identifiers', () => {
    const registry = new DomainPackRegistry();
    const malformedBase = fakePack('catalog_domain');
    const malformed: DomainPack = {
      ...malformedBase,
      generationTypes: [{
        ...malformedBase.generationTypes[0],
        id: 'Uppercase-Unsafe',
      }],
    };

    expect(() => registry.register(malformed)).toThrow(DomainPackRegistrationError);

    const valid = fakePack('police_story');
    registry.register(valid);
    expect(registry.require('police_story').generationTypes[0]?.id).toBe('police_story_story');
  });

  it('fails registration before traffic when runtime shape contradicts capability claims', () => {
    const missingMethod = {
      ...fakePack('missing_method'),
      mapGearsConstraints: undefined,
    } as unknown as DomainPack;
    const wrongSchemaBase = fakePack('wrong_schema');
    const wrongSchema = {
      ...wrongSchemaBase,
      meta: { ...wrongSchemaBase.meta, schema_version: 'story-agent-domain-pack/v99' },
    } as unknown as DomainPack;
    const wrongDurationBase = fakePack('wrong_duration');
    const wrongDuration = {
      ...wrongDurationBase,
      generationTypes: [{ ...wrongDurationBase.generationTypes[0], default_duration: false }],
    } as unknown as DomainPack;

    expect(() => new DomainPackRegistry().register(missingMethod)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(wrongSchema)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(wrongDuration)).toThrow(DomainPackRegistrationError);
  });

  it('boots with the china_culture Domain Pack only', () => {
    const registry = createStoryAgentDomainRegistry();

    expect(registry.list()).toEqual(['china_culture']);
    expect(registry.require('china_culture').meta).toMatchObject({
      domain_id: 'china_culture',
      version: '1.0.0',
      capabilities: ['entry_search', 'entry_detail', 'entry_match', 'story_plan', 'story_generate', 'type_catalog', 'story_safety', 'gears_mapping'],
    });
    expect(registry.require('china_culture').searchEntries).toBeTypeOf('function');
    expect(registry.require('china_culture').mapGearsConstraints).toBeTypeOf('function');
    expect(registry.describe()).toEqual([expect.objectContaining({
      entry_type_count: 12,
      generation_type_count: 15,
    })]);
  });

  it('maps china_culture story and scene constraints to one deduplicated GEARS v2 boundary', () => {
    const pack = createStoryAgentDomainRegistry().require('china_culture');
    const constraints = pack.mapGearsConstraints({
      story: {
        cultural_constraints: ['全局史实边界', '重复边界'],
      },
      segment: {
        cultural_constraints: ['重复边界', '镜头虚构边界'],
      },
    } as Parameters<DomainPack['mapGearsConstraints']>[0]);

    expect(constraints).toEqual(['全局史实边界', '重复边界', '镜头虚构边界']);
  });

  it('keeps the platform entry route independent from the legacy entry service', async () => {
    const routeSource = await readFile(new URL('../routes/entries.ts', import.meta.url), 'utf-8');

    expect(routeSource).not.toContain("from '../services/entry-service.js'");
    expect(routeSource).toContain('storyAgentDomainRegistry.require(domain)');
  });

  it('keeps china_culture entry detail physically owned by the Domain Pack', async () => {
    const [packSource, legacyEntryServiceSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/entry-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(packSource).toContain("from './entry-detail-service.js'");
    expect(packSource).toContain('getEntryDetail: getChinaCultureEntryDetailByName');
    expect(packSource).not.toContain('getEntryDetailByName, matchEntries, searchEntries');
    expect(legacyEntryServiceSource).not.toContain('export async function getEntryDetailByName');
  });

  it('keeps china_culture search dispatch and ranking rules inside the Domain Pack', async () => {
    const [packSource, searchSource, legacyEntryServiceSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-search-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/entry-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(packSource).toContain("from './entry-search-service.js'");
    expect(packSource).toContain('return searchChinaCultureEntries');
    expect(searchSource).toContain('function detectSearchIntent');
    expect(searchSource).toContain('function computeSearchRank');
    expect(legacyEntryServiceSource).not.toContain('export async function searchEntries');
    expect(legacyEntryServiceSource).not.toContain('function detectSearchIntent');
    expect(legacyEntryServiceSource).not.toContain('function computeSearchRank');
  });

  it('keeps china_culture match scoring and language rules inside the domain boundary', async () => {
    const [packSource, matchSource, languageSource, legacyEntryServiceSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-match-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-language-helpers.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/entry-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(packSource).toContain("from './entry-match-service.js'");
    expect(packSource).toContain('return matchChinaCultureEntries');
    expect(matchSource).toContain('export function computeChinaCultureMatchScore');
    expect(languageSource).toContain('export function extractChinaCultureKeywords');
    expect(languageSource).toContain('export function detectChinaCultureProvince');
    expect(legacyEntryServiceSource).not.toContain('export async function matchEntries');
    expect(legacyEntryServiceSource).not.toContain('export function computeMatchScore');
    expect(legacyEntryServiceSource).not.toContain('TYPE_KEYWORD_HINTS');
  });

  it('keeps the legacy entry service as a logic-free compatibility facade', async () => {
    const [legacySource, knowledgeSource, searchSource, matchSource, storySource, storyPreparationSource, storyKnowledgeSource, outlineSource] = await Promise.all([
      readFile(new URL('../services/entry-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-knowledge-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-search-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-match-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-knowledge-pack-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/outline-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(legacySource).toContain('Compatibility facade');
    expect(legacySource).not.toContain('function ');
    expect(legacySource).not.toContain('mcp-proxy');
    expect(knowledgeSource).toContain('export async function collectChinaCultureSearchableEntries');
    expect(searchSource).toContain("from './entry-knowledge-service.js'");
    expect(matchSource).toContain("from './entry-knowledge-service.js'");
    expect(storySource).toContain("from './story-generation-preparation-service.js'");
    expect(storyPreparationSource).toContain("from './story-knowledge-pack-service.js'");
    expect(storySource).not.toContain("from './entry-knowledge-service.js'");
    expect(storyKnowledgeSource).toContain("from './entry-knowledge-service.js'");
    expect(outlineSource).toContain("from '../domains/china-culture/entry-knowledge-service.js'");
  });

  it('keeps the China Culture MCP adapter in the domain and its legacy path logic-free', async () => {
    const [adapterSource, legacyProxySource, systemRouteSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/knowledge-source-adapter.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/mcp-proxy.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../routes/system.ts', import.meta.url), 'utf-8'),
    ]);

    expect(adapterSource).toContain("from '../../../../../mcp-server/src/tools/search.js'");
    expect(adapterSource).toContain('export function convertChinaCultureFullEntryDetail');
    expect(legacyProxySource).toContain('Compatibility facade');
    expect(legacyProxySource).not.toContain('function ');
    expect(legacyProxySource).not.toContain("from '../../../../mcp-server");
    expect(systemRouteSource).toContain("from '../domains/china-culture/knowledge-source-adapter.js'");
    expect(systemRouteSource).not.toContain("from '../services/mcp-proxy.js'");
  });

  it('keeps story plan and generate behind the Domain Pack boundary', async () => {
    const routeSource = await readFile(new URL('../routes/stories.ts', import.meta.url), 'utf-8');

    expect(routeSource).not.toContain('planStory,');
    expect(routeSource).not.toContain('generateAndStoreStory,');
    expect(routeSource).toContain('storyAgentDomainRegistry.require(domain).planStory');
    expect(routeSource).toContain('storyAgentDomainRegistry.require(domain).generateStory');
  });
});
