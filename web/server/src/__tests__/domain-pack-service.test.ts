import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { getDomainPackSeeds, buildDomainPackEntries } from '../services/domain-pack-service.js';

beforeAll(() => {
  if (!process.env.KB_ROOT) {
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  }
});

describe('domain-pack-service', () => {
  it('loads editable china culture domain pack seeds from data/domain-packs', () => {
    const seeds = getDomainPackSeeds();

    expect(seeds.length).toBeGreaterThanOrEqual(6);
    expect(seeds.some(seed => seed.entry_name === '宋代士人设定包——服饰器物与称谓')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === 'GEARS场景资产包——洞穴、书院与衙署边界')).toBe(true);
    expect(seeds.some(seed => seed.domain === 'narrative_pattern' && seed.role === 'pattern_pack')).toBe(true);
  });

  it('builds knowledge pack entries from editable domain pack data', () => {
    const entries = buildDomainPackEntries({
      query: '周敦颐在月岩洞读书悟道，需要宋代士人服饰和洞穴场景资产边界',
      limit: 4,
    });

    expect(entries.some(entry => entry.knowledge_domain === 'era_setting' && entry.era === '宋')).toBe(true);
    expect(entries.some(entry => entry.knowledge_domain === 'gears_asset')).toBe(true);
  });

  it('injects narrative pattern packs for local historical influence stories', () => {
    const entries = buildDomainPackEntries({
      query: '周敦颐人物故事要讲长沙岳麓书院的思想影响、后世影响和当代转化',
      limit: 5,
    });

    expect(entries.some(entry =>
      entry.knowledge_domain === 'narrative_pattern'
      && entry.entry_role === 'pattern_pack'
      && entry.asset_usage?.includes('plot_structure'),
    )).toBe(true);
  });
});
