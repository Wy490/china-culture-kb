import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { extractChinaCultureBoldEvents } from '../domains/china-culture/story-planning-service.js';

describe('china_culture story planning service boundary', () => {
  it('extracts narrative events while excluding structured knowledge field headings', () => {
    const text = [
      '**省份**：测试省',
      '**故事梗概**：测试梗概',
      '**拒签冤案**：事件一',
      '**月岩悟道**：事件二',
      '**待核实点**：需要核验',
    ].join('\n');

    expect(extractChinaCultureBoldEvents(text)).toEqual(['拒签冤案', '月岩悟道']);
  });

  it('keeps planning dispatch inside the china_culture Domain Pack', async () => {
    const domainPack = await readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf-8');

    expect(domainPack).toContain("from './story-planning-service.js'");
    expect(domainPack).toContain('planChinaCultureStory(params.entry_name, params.original_user_query)');
    expect(domainPack).not.toContain('generateAndStoreStory, planStory');
  });

  it('removes the planning implementation and export from the legacy story service', async () => {
    const [storyService, preparationService] = await Promise.all([
      readFile(new URL('../services/story-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(storyService).not.toContain('export async function planStory');
    expect(storyService).not.toContain('recommended_presentation_styles: recommendedPresentationStyles');
    expect(storyService).not.toContain('extractChinaCultureBoldEvents(entry.story)');
    expect(preparationService).toContain('extractChinaCultureBoldEvents(entry.story)');
  });
});
