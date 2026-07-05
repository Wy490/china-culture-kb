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
    expect(seeds.some(seed => seed.entry_name === '纪录片来源包——现实现场、来源线索与再现边界')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === 'AI漫剧分镜包——关键帧、表情节拍与连续性验收')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '朝代服饰与器物包——时代称谓、服装道具和事实边界')).toBe(true);
    expect(seeds.some(seed => seed.domain === 'narrative_pattern' && seed.role === 'pattern_pack')).toBe(true);
    expect(
      seeds.find(seed => seed.entry_name === '讲解知识结构包——核心问题、层级例子与图示字幕')?.production_prompts,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('观众问题'),
    ]));
    expect(
      seeds.find(seed => seed.entry_name === '非遗流程生产包——材料工具、工序动作与授权边界')?.review_boundaries,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('不得把通用流程包写成具体项目已确认流程'),
    ]));
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

  it('injects production domain packs for explainer and storyboard gaps', () => {
    const entries = buildDomainPackEntries({
      query: 'explainer_video 需要讲解知识结构包、核心问题、图示字幕，同时 AI漫剧分镜包 要补关键帧和连续性验收',
      limit: 6,
    });

    expect(entries.some(entry => entry.entry_name === '讲解知识结构包——核心问题、层级例子与图示字幕')).toBe(true);
    expect(entries.some(entry => entry.entry_name === 'AI漫剧分镜包——关键帧、表情节拍与连续性验收')).toBe(true);
    expect(entries.some(entry => entry.asset_usage?.includes('credibility_boundary'))).toBe(true);
    expect(
      entries.find(entry => entry.entry_name === '讲解知识结构包——核心问题、层级例子与图示字幕')?.production_prompts,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('图示'),
    ]));
    expect(
      entries.find(entry => entry.entry_name === 'AI漫剧分镜包——关键帧、表情节拍与连续性验收')?.review_boundaries,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('文化条目事实'),
    ]));
  });
});
