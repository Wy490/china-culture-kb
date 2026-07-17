import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import { createStoryRepository } from '../platform/story-storage.js';
import { getStory, listStories } from '../platform/story-read-service.js';

const roots: string[] = [];
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;

function story(storyId: string, sourceDomain?: string): StoryGenerateResult {
  return {
    storyId,
    sourceDomain,
    title: storyId,
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: 'Story read source-domain fixture',
    logline: 'The read boundary preserves explicit domain ownership.',
    credibility_note: 'Machine fixture only.',
    scene_breakdown: [],
    gears_segments: [],
  } as unknown as StoryGenerateResult;
}

afterEach(async () => {
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('story read service source domain', () => {
  it('normalizes legacy detail reads and filters summaries by explicit source domain', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-story-read-'));
    roots.push(root);
    process.env.WEB_GENERATED_ROOT = root;
    const repository = createStoryRepository();
    await repository.create(story('20260716-story-legacy'));
    await repository.create(story('20260716-story-domain', 'second_domain'));

    const legacy = await getStory('20260716-story-legacy');
    const custom = await getStory('20260716-story-domain');
    const legacyList = await listStories(undefined, undefined, 'china_culture');
    const customList = await listStories(undefined, undefined, 'second_domain');

    expect(legacy.data?.sourceDomain).toBe('china_culture');
    expect(custom.data?.sourceDomain).toBe('second_domain');
    expect(legacyList.data?.map(item => [item.storyId, item.sourceDomain])).toEqual([
      ['20260716-story-legacy', 'china_culture'],
    ]);
    expect(customList.data?.map(item => [item.storyId, item.sourceDomain])).toEqual([
      ['20260716-story-domain', 'second_domain'],
    ]);
  });
});
