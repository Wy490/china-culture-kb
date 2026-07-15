import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('china_culture generated Story document boundary', () => {
  it('owns the initial Story document and leaves the legacy service as a workflow coordinator', async () => {
    const [storySource, documentSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-document-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(storySource).toContain("from './story-document-service.js'");
    expect(storySource).toContain('buildChinaCultureGeneratedStoryDocument({');
    expect(storySource).not.toContain('generation_source:');
    expect(storySource).not.toContain('gears_segments_url:');
    expect(storySource).not.toContain('_request_meta: {');
    expect(storySource).not.toContain('buildInitialGearsWebhookStatus()');
    expect(storySource).not.toContain('deriveChinaCultureTypeSpecificStoryFields({');
    expect(documentSource).toContain('generation_source:');
    expect(documentSource).toContain('gears_segments_url:');
    expect(documentSource).toContain('_request_meta: {');
    expect(documentSource).toContain('buildInitialGearsWebhookStatus()');
    expect(documentSource).toContain('deriveChinaCultureTypeSpecificStoryFields({');
  });
});
