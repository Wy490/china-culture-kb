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

  it('injects domain packs for era, folklore, and GEARS asset boundaries', async () => {
    const res = await multiMatchEntries({
      outline: '周敦颐少年在道县月岩洞读书悟道，做一个民间传说短片，需要宋代服饰和洞穴场景道具边界。',
      knowledge_needs: [
        {
          need_id: 'main_character',
          label: '主人公',
          keywords: ['周敦颐', '月岩洞', '道县'],
          required: true,
        },
      ],
      limit_per_need: 5,
    });

    expect(res.ok).toBe(true);
    const supporting = res.data?.matched_knowledge_pack.supporting_entries ?? [];
    expect(supporting.some(entry => entry.knowledge_domain === 'era_setting' && entry.era === '宋')).toBe(true);
    expect(supporting.some(entry => entry.knowledge_domain === 'folklore_zhiyi')).toBe(true);
    expect(supporting.some(entry =>
      entry.knowledge_domain === 'gears_asset'
      && entry.asset_usage?.includes('scene_props')
      && entry.summary.includes('场景道具'),
    )).toBe(true);
  });

  it('detects unnamed supporting, crowd, and supernatural characters from outlines', async () => {
    const res = await analyzeOutline({
      outline: '周敦颐在月岩洞读书时，一个老奶奶在洞口点灯。村民围过来听她讲狐仙显灵的传说，书童递上书卷。',
    });

    expect(res.ok).toBe(true);
    const characters = res.data?.detected_characters ?? [];
    expect(characters.find(character => character.name === '周敦颐')?.role_position).toBe('主角');
    expect(characters.find(character => character.name === '老奶奶')).toMatchObject({
      character_kind: 'identity_role',
      role_position: '配角',
      age_range: '老年',
      gender: '女',
    });
    expect(characters.find(character => character.name === '村民')).toMatchObject({
      character_kind: 'group_role',
      role_position: '群演',
    });
    expect(characters.find(character => character.name === '狐仙')).toMatchObject({
      character_kind: 'supernatural_role',
      role_position: '配角',
    });
    expect(res.data?.knowledge_needs.find(need => need.need_id === 'supporting_characters')?.keywords)
      .toEqual(expect.arrayContaining(['老奶奶', '村民', '狐仙', '书童']));
  });
});
