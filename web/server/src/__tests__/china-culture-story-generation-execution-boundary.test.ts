import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('china_culture story generation execution boundary', () => {
  it('owns local generation, prompt, adapter, resolution, trace and character-hint application', async () => {
    const [storySource, executionSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-execution-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(storySource).toContain('executeChinaCultureStoryGeneration({ request, preparation })');
    expect(storySource).not.toContain('buildStoryGenerationPromptPackage({');
    expect(storySource).not.toContain('generateStoryWithAdapter({');
    expect(storySource).not.toContain('resolveStoryGenerationResult({');
    expect(storySource).not.toContain('mergeCharacterHintsIntoStoryResult(');
    expect(storySource).not.toContain('adapterTrace');
    expect(executionSource).toContain('generateChinaCultureLocalStoryAssembly({');
    expect(executionSource).toContain('buildStoryGenerationPromptPackage({');
    expect(executionSource).toContain('generateStoryWithAdapter({');
    expect(executionSource).toContain('resolveStoryGenerationResult({');
    expect(executionSource).toContain('mergeCharacterHintsIntoStoryResult(');
    expect(executionSource).toContain('generationResolution.adapterTrace');
  });
});
