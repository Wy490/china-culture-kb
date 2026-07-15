import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('china_culture story generation boundary', () => {
  it('keeps the legacy import path as a facade and binds Domain Pack generation directly to the domain', async () => {
    const [legacySource, domainPackSource, generationSource] = await Promise.all([
      readFile(new URL('../services/story-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(legacySource).toContain('Compatibility facade');
    expect(legacySource).toContain('generateAndStoreChinaCultureStory as generateAndStoreStory');
    expect(legacySource).not.toContain('function ');
    expect(legacySource).not.toContain('prepareChinaCultureStoryGeneration(');
    expect(domainPackSource).toContain("from './story-generation-service.js'");
    expect(domainPackSource).not.toContain("from '../../services/story-service.js'");
    expect(domainPackSource).toContain('generateAndStoreChinaCultureStory(request');
    expect(generationSource).toContain('prepareChinaCultureStoryGeneration(request)');
    expect(generationSource).toContain('executeChinaCultureStoryGeneration({ request, preparation })');
    expect(generationSource).toContain('buildChinaCultureGeneratedStoryDocument({');
    expect(generationSource).toContain('orchestrateStoryPostGeneration({');
    expect(generationSource).toContain('options.validate_story_content({');
    expect(generationSource).toContain('persistGeneratedStoryAndNotifyGears({');
  });
});
