import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('story read platform boundary', () => {
  it('keeps storage discovery, list/detail normalization and current project selection out of generation', async () => {
    const [source, generationSource, readSource] = await Promise.all([
      readFile(new URL('../services/story-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../platform/story-read-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(source).toContain("from '../platform/story-read-service.js'");
    expect(source).not.toContain("from '../platform/story-storage.js'");
    expect(generationSource).toContain("from '../../platform/story-storage.js'");
    expect(readSource).toContain("from './story-storage.js'");
    expect(source).not.toContain('export async function listStories(');
    expect(source).not.toContain('export async function getStory(');
    expect(source).not.toContain('function normalizeStoryForApi(');
    expect(source).not.toContain('function readCurrentProjectStoryForStoryId(');
    expect(readSource).toContain('export async function listStories(');
    expect(readSource).toContain('export async function getStory(');
  });
});
