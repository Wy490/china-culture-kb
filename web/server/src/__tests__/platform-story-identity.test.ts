import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { generateStoryId } from '../platform/story-identity.js';

describe('platform story identity', () => {
  it('keeps the date/story/base36+uuid format deterministic under injected sources', () => {
    const uuids = [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '00112233-4455-6677-8899-aabbccddeeff',
    ];
    const storyId = generateStoryId('测试条目', {
      now: () => new Date(2026, 6, 15, 12, 0, 0),
      timestamp: () => 123456789,
      uuid: () => uuids.shift()!,
      random: () => 0,
    });

    expect(storyId).toMatch(/^20260715-story-[0-9a-z]+00112233$/);
  });

  it('produces distinct IDs for repeated calls without exposing the entry name', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateStoryId('周敦颐')));
    expect(ids.size).toBe(20);
    for (const storyId of ids) {
      expect(storyId).toMatch(/^\d{8}-story-[0-9a-z]+$/);
      expect(storyId).not.toContain('周敦颐');
    }
  });

  it('keeps identity mechanics outside the generation orchestrator', async () => {
    const source = await readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8');
    expect(source).toContain("from '../../platform/story-identity.js'");
    expect(source).not.toContain('function generateStoryId(');
    expect(source).not.toContain("from 'node:crypto'");
  });
});
