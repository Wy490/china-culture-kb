import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('story quality evaluation platform boundary', () => {
  it('centralizes genre, creation/material context and delivery enrichment sequencing', async () => {
    const [source, postGenerationSource, qualitySource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../platform/story-post-generation-orchestration.ts', import.meta.url), 'utf8'),
      readFile(new URL('../platform/story-quality-evaluation.ts', import.meta.url), 'utf8'),
    ]);

    expect(source).toContain("from '../../platform/story-post-generation-orchestration.js'");
    expect(source).not.toContain("from '../../platform/story-quality-evaluation.js'");
    expect(source).not.toContain('function attachCreationQualityContext(');
    expect(source).not.toContain('validateGenreStoryQuality({');
    expect(source).not.toContain('enrichStoryQualityReport({');
    expect(postGenerationSource).toContain("from './story-quality-evaluation.js'");
    expect(postGenerationSource.indexOf('evaluateStoryQualityReport({'))
      .toBeLessThan(postGenerationSource.indexOf('orchestrateStoryRepair({'));
    expect(postGenerationSource.indexOf('orchestrateStoryRepair({'))
      .toBeLessThan(postGenerationSource.indexOf('buildGearsDeliveryPackage(input.story)'));
    expect(postGenerationSource.indexOf('buildGearsDeliveryPackage(input.story)'))
      .toBeLessThan(postGenerationSource.indexOf('enrichStoryQualityWithDelivery({'));
    expect(qualitySource).toContain('validateGenreStoryQuality({');
    expect(qualitySource.match(/attachCreationQualityContext\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(qualitySource).toContain('gearsDelivery: input.gearsDelivery');
  });
});
