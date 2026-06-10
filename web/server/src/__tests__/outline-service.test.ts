import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { analyzeOutline, multiMatchEntries } from '../services/outline-service.js';

beforeAll(() => {
  if (!process.env.KB_ROOT) {
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  }
});

describe('outline-service', () => {
  it('recognizes the protagonist from KB aliases instead of short sliding-window fragments', async () => {
    const res = await analyzeOutline({
      outline: '我想做一个毛泽东少年求学走向革命的故事',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.story_intent.main_character).toBe('毛泽东');
    expect(res.data?.story_intent.core_theme).toBe('求学与革命');
    expect(res.data?.knowledge_needs.find(need => need.need_id === 'main_character')?.keywords).toEqual(['毛泽东']);
    expect(res.data?.knowledge_needs.some(need => need.keywords.includes('故事'))).toBe(false);
    expect(res.data?.detected_subjects).not.toContain('毛泽');
    expect(res.data?.detected_subjects).not.toContain('向革');
  });

  it('matches the Mao Zedong entry for protagonist knowledge needs', async () => {
    const analysis = await analyzeOutline({
      outline: '我想做一个毛泽东少年求学走向革命的故事',
    });

    expect(analysis.ok).toBe(true);
    const res = await multiMatchEntries({
      outline: analysis.data!.outline,
      knowledge_needs: analysis.data!.knowledge_needs,
      limit_per_need: 5,
    });

    expect(res.ok).toBe(true);
    const matchedNames = [
      ...(res.data?.matched_knowledge_pack.primary_entries ?? []),
      ...(res.data?.matched_knowledge_pack.supporting_entries ?? []),
    ].map(entry => entry.entry_name);
    expect(matchedNames.some(name => name.startsWith('毛泽东——'))).toBe(true);
    expect(res.data?.matched_knowledge_pack.primary_entries.every(entry => entry.type === '历史人物')).toBe(true);
  });

  it('enriches multi-match knowledge pack summaries with detailed story snippets', async () => {
    const res = await multiMatchEntries({
      outline: '周敦颐少年在濂溪读书，后来面对南安军拒签冤案，坚持良知。',
      knowledge_needs: [
        {
          need_id: 'main_character',
          label: '主人公',
          keywords: ['周敦颐', '濂溪', '拒签冤案', '南安军'],
          required: true,
        },
      ],
      limit_per_need: 5,
    });

    expect(res.ok).toBe(true);
    const zhou = res.data?.matched_knowledge_pack.primary_entries.find(entry => entry.entry_name.startsWith('周敦颐——'));
    expect(zhou).toBeTruthy();
    expect(zhou?.summary).toContain('濂溪');
    expect(zhou?.summary).toContain('拒签冤案');
    expect(zhou?.summary.length).toBeGreaterThan(zhou?.entry_name.length ?? 0);
  });
});
