import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { EntryDetail } from '@shared/types.js';
import {
  buildChinaCulturePlanSupplementNeeds,
  computeChinaCulturePlanningRisks,
} from '../domains/china-culture/planning-rules.js';

function entry(overrides: Partial<EntryDetail> = {}): EntryDetail {
  return {
    name: '测试文化条目',
    province: '测试省',
    region: '测试地区',
    type: '地方掌故',
    summary: '用于验证规划规则的条目。',
    story: '这是一段已经具备足够过程、人物选择、场景地点和可视化细节的故事材料。'.repeat(4),
    culturalSignificance: '测试文化意义。',
    relatedLocations: [],
    keywords: ['测试'],
    sources: ['测试来源'],
    credibility: '可靠',
    verificationMethod: '查阅公开地方志并交叉核对。',
    unverifiedPoints: [],
    ...overrides,
  };
}

describe('china_culture planning rules', () => {
  it('does not invent risk or supplement work for a sufficiently documented reliable entry', () => {
    const input = entry();

    expect(computeChinaCulturePlanningRisks(input)).toEqual([]);
    expect(buildChinaCulturePlanSupplementNeeds(input)).toEqual([]);
  });

  it('preserves credibility, verification, unverified-point and short-story boundaries', () => {
    const input = entry({
      credibility: '待核实',
      verificationMethod: ' ',
      unverifiedPoints: ['年代待核', '人物关系待核'],
      story: '材料很短。',
    });

    expect(computeChinaCulturePlanningRisks(input)).toEqual([
      '条目可信度待核实，核心情节可能缺乏佐证',
      '待核实：年代待核',
      '待核实：人物关系待核',
    ]);
    expect(buildChinaCulturePlanSupplementNeeds(input).map(item => item.need_id)).toEqual([
      'credibility_review',
      'verification_method',
      'unverified_3',
      'unverified_4',
      'story_detail',
    ]);
  });

  it('caps surfaced unverified points at five without hiding the overall credibility blocker', () => {
    const input = entry({
      credibility: '存疑',
      unverifiedPoints: Array.from({ length: 7 }, (_, index) => `待核点${index + 1}`),
    });

    const needs = buildChinaCulturePlanSupplementNeeds(input);
    expect(needs.filter(item => item.label === '待核实内容')).toHaveLength(5);
    expect(needs[0]?.need_id).toBe('credibility_review');
    expect(computeChinaCulturePlanningRisks(input)[0]).toContain('整体可信度存疑');
  });

  it('keeps cultural planning rules out of the legacy story service body', async () => {
    const storyService = await readFile(new URL('../services/story-service.ts', import.meta.url), 'utf-8');
    const planningService = await readFile(new URL('../domains/china-culture/story-planning-service.ts', import.meta.url), 'utf-8');

    expect(storyService).not.toContain('function computeCulturalRisks');
    expect(storyService).not.toContain('function buildPlanSupplementNeeds');
    expect(planningService).toContain('computeChinaCulturePlanningRisks(entry)');
    expect(planningService).toContain('buildChinaCulturePlanSupplementNeeds(entry)');
  });
});
