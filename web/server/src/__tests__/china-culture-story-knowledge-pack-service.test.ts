import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { EntryDetail } from '@shared/types.js';
import { buildChinaCultureSingleEntryKnowledgePack } from '../domains/china-culture/story-knowledge-pack-service.js';

beforeAll(() => {
  if (!process.env.KB_ROOT) {
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  }
});

function cultureEntry(): EntryDetail {
  return {
    name: '周敦颐——月岩悟道',
    province: '湖南',
    region: '湖南→永州→道县',
    type: '历史人物',
    summary: '宋代思想人物与月岩读书传说。',
    story: '**月岩悟道**\n\n周敦颐在月岩洞读书，留下地方文化记忆。',
    culturalSignificance: '地方叙事需区分人物史实与后世传说。',
    relatedLocations: [{ name: '月岩洞', description: '天然岩洞与地方传说场所。' }],
    keywords: ['周敦颐', '宋代', '月岩洞', '读书悟道'],
    sources: ['地方志来源线索'],
    credibility: 'B',
    verificationMethod: '需与地方志和遗址资料交叉核验。',
    unverifiedPoints: ['月岩悟道细节属于地方传说，待核实。'],
    knowledge_domain: 'core_china_culture',
    entry_role: 'core_entry',
    era: '宋',
    asset_usage: ['source_grounding', 'credibility_boundary'],
  };
}

describe('china_culture single-entry story knowledge pack', () => {
  it('preserves the primary source trace and injects bounded cultural support packs', () => {
    const pack = buildChinaCultureSingleEntryKnowledgePack(cultureEntry(), {
      originalUserQuery: '把月岩悟道改成宋代人物短片，保留洞穴资产和传说边界',
      selectedEvent: '月岩悟道',
    });

    expect(pack).toMatchObject({
      overall_confidence: 1,
      missing_needs: [],
      primary_entries: [expect.objectContaining({
        entry_name: '周敦颐——月岩悟道',
        score: 1,
        knowledge_domain: 'core_china_culture',
        era: '宋',
      })],
    });
    expect(pack.primary_entries[0]?.summary).toContain('待核实');
    expect(pack.primary_entries[0]?.production_prompts).toEqual(expect.arrayContaining([
      expect.stringContaining('机器派生生产指导'),
      expect.stringContaining('对白口吻'),
      expect.stringContaining('可戏剧化空间'),
    ]));
    expect(pack.primary_entries[0]?.review_boundaries).toEqual(expect.arrayContaining([
      expect.stringContaining('待核验点'),
      expect.stringContaining('不新增文化事实'),
    ]));
    expect(pack.supporting_entries.some(entry => entry.knowledge_domain === 'era_setting')).toBe(true);
    expect(pack.supporting_entries.some(entry => entry.knowledge_domain === 'gears_asset')).toBe(true);
    expect(pack.supporting_entries.length).toBeLessThanOrEqual(4);
  });

  it('keeps the legacy story orchestrator free of the extracted assembly implementation', async () => {
    const [storySource, preparationSource, domainSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-knowledge-pack-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(storySource).toContain("from './story-generation-preparation-service.js'");
    expect(storySource).not.toContain("from './story-knowledge-pack-service.js'");
    expect(storySource).not.toContain('function buildSingleEntryKnowledgePack');
    expect(storySource).not.toContain('buildChinaCultureEntryKnowledgeSummary');
    expect(storySource).not.toContain('appendChinaCultureDomainPackEntries');
    expect(preparationSource).toContain("from './story-knowledge-pack-service.js'");
    expect(preparationSource).toContain('buildChinaCultureSingleEntryKnowledgePack(entry');
    expect(domainSource).toContain('buildChinaCultureEntryKnowledgeSummary');
    expect(domainSource).toContain('appendChinaCultureDomainPackEntries');
  });
});
