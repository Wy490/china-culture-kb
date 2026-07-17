import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('story delivery platform boundary', () => {
  it('keeps GEARS/Seedance reads and story/project writeback out of generation orchestration', async () => {
    const source = await readFile(new URL('../services/story-service.ts', import.meta.url), 'utf8');
    const deliverySource = await readFile(
      new URL('../platform/story-delivery-service.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain("from '../platform/story-delivery-service.js'");
    expect(source).not.toContain('export async function getGearsSegments(');
    expect(source).not.toContain('export async function getGearsDeliveryPackage(');
    expect(source).not.toContain('export async function getSeedancePromptPackage(');
    expect(source).not.toContain('export async function updateGearsDeliveryMarkdown(');
    expect(source).not.toContain('export async function updateGearsVideoReady(');
    expect(deliverySource).toContain("schema_version: 'gears-segments/v2'");
    expect(deliverySource).toContain('resolveStorySourceDomain(story)');
    expect(deliverySource).not.toContain("const LEGACY_STORY_SOURCE_DOMAIN = 'china_culture'");
    expect(deliverySource).toContain('updateProjectCurrentGearsDelivery(');
    expect(deliverySource).toContain('updateProjectCurrentGearsVideo(');
  });
});
