import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { EntryDetail } from '@shared/types.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';

const entry: EntryDetail = {
  name: '沈括——梦溪求真',
  province: '江苏',
  region: '镇江',
  type: '历史人物',
  summary: '沈括观察自然并记录发现。',
  story: '沈括少年时随母亲迁居多地，常观察山川。\n\n同窗张君见他在梦溪园记录磁针、天文与地貌现象。\n\n门生李生见证他反复验证，不轻下结论。',
  culturalSignificance: '求真精神连接古代知识与现代科学。',
  relatedLocations: [{ name: '梦溪园', description: '晚年著述地' }],
  keywords: ['沈括', '梦溪笔谈', '科学'],
  sources: ['测试来源'],
  credibility: '待核验',
  unverifiedPoints: ['具体对话为戏剧化表达'],
};

describe('china_culture local story generation dispatch', () => {
  it('runs the dramatic engine without claiming unresolved style-pack influence', () => {
    const result = generateChinaCultureLocalStoryAssembly({
      entry,
      centralEvent: '梦溪园反复验证磁针',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '克制',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.storyResult.scene_breakdown.length).toBeGreaterThanOrEqual(3);
    expect(result.memoryMosaicSeed).toBeUndefined();
    expect(result.referenceTrace).toBeUndefined();
  });

  it('runs memory mosaic with a seed and a default trace when no style pack is selected', () => {
    const result = generateChinaCultureLocalStoryAssembly({
      entry,
      centralEvent: '梦溪园留下求真记录',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'memory_mosaic_biography',
      targetDuration: '3分钟',
      tone: '追忆',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.storyResult.scene_breakdown).toHaveLength(6);
    expect(result.memoryMosaicSeed).toBeDefined();
    expect(result.referenceTrace).toHaveLength(1);
    expect(result.referenceTrace?.[0]).toMatchObject({
      source_story_structure: 'memory_mosaic_biography',
      applied_rules: expect.arrayContaining(['用物件开场', '结尾呼应物件']),
    });
  });

  it('fails closed instead of inventing a witness or crashing when source material has none', () => {
    const result = generateChinaCultureLocalStoryAssembly({
      entry: {
        ...entry,
        story: '资料只记录梦溪园中的器物与自然观察，没有可识别的人物关系。',
      },
      centralEvent: '梦溪园留下求真记录',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'memory_mosaic_biography',
      targetDuration: '3分钟',
      tone: '追忆',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'memory_mosaic_witnesses_missing',
      message: '回忆拼图结构需要至少一位可从资料中识别的见证人物，请补充人物关系或改用其他故事结构',
    });
  });

  it('keeps the top-level orchestrator free of direct local engine dispatch', async () => {
    const [source, executionSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-execution-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(source).toContain("from './story-generation-execution-service.js'");
    expect(source).not.toContain("from './story-local-generation-service.js'");
    expect(source).not.toContain('generateDramaticContent({');
    expect(source).not.toContain('generateMemoryMosaicContent({');
    expect(source).not.toContain('buildMemoryMosaicSeed(');
    expect(source).not.toContain('function slugify(');
    expect(executionSource).toContain("from './story-local-generation-service.js'");
    expect(executionSource).toContain('generateChinaCultureLocalStoryAssembly({');
  });
});
