import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { EntryDetail, EntrySearchResult } from '@shared/types.js';
import {
  enrichChinaCultureEntryDetailWithMetadata,
  inferChinaCultureEntryMetadata,
} from '../domains/china-culture/entry-metadata-service.js';

function searchEntry(overrides: Partial<EntrySearchResult> = {}): EntrySearchResult {
  return {
    name: '周敦颐——濂溪先生',
    province: '湖南',
    region: '湖南→永州→道县',
    type: '历史人物',
    summary: '宋代理学人物，留下《爱莲说》与书院故事。',
    keywords: ['周敦颐', '宋代', '理学', '书院'],
    credibility: 'A',
    ...overrides,
  };
}

describe('china_culture entry metadata service', () => {
  it('infers culture domain, era and production asset uses', () => {
    expect(inferChinaCultureEntryMetadata(searchEntry())).toMatchObject({
      knowledge_domain: 'core_china_culture',
      entry_role: 'core_entry',
      era: '宋',
      asset_usage: expect.arrayContaining(['character_clothing', 'character_props', 'scene_space']),
    });
  });

  it('keeps folklore and credibility signals in domain-owned inference', () => {
    const metadata = inferChinaCultureEntryMetadata(searchEntry({
      name: '柳毅传书',
      type: '民间故事',
      summary: '唐传奇中的龙女传说，文学边界待核实。',
      keywords: ['柳毅', '龙女', '传说'],
    }));

    expect(metadata.knowledge_domain).toBe('folklore_zhiyi');
    expect(metadata.era).toBe('唐');
    expect(metadata.asset_usage).toEqual(expect.arrayContaining(['story_motif', 'credibility_boundary']));
  });

  it('preserves explicit source metadata instead of replacing it with inference', () => {
    const entry = {
      ...searchEntry(),
      story: '已有故事',
      culturalSignificance: '已有文化说明',
      relatedLocations: [],
      localCreativeRelations: [],
      sources: [],
      verificationMethod: '',
      unverifiedPoints: [],
      knowledge_domain: 'source_pack',
      entry_role: 'source_pack',
      era: '自定义年代',
      asset_usage: ['source_grounding'],
    } as EntryDetail;

    expect(enrichChinaCultureEntryDetailWithMetadata(entry)).toMatchObject({
      knowledge_domain: 'source_pack',
      entry_role: 'source_pack',
      era: '自定义年代',
      asset_usage: ['source_grounding'],
    });
  });

  it('keeps legacy domain-pack metadata exports as aliases without duplicate rules', async () => {
    const [source, productionSource] = await Promise.all([
      readFile(new URL('../services/domain-pack-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/domain-pack-production-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(source).toContain('inferChinaCultureEntryMetadata as inferEntryMetadata');
    expect(source).not.toContain('detectChinaCultureEra');
    expect(productionSource).toContain('detectChinaCultureEra');
    expect(source).not.toContain('function inferKnowledgeDomain');
    expect(source).not.toContain('function inferAssetUsage');
    expect(source).not.toContain('function detectEra');
  });
});
