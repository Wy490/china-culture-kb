import { readFile } from 'node:fs/promises';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  BaseEntry,
  BaseGearsSegment,
  BaseStory,
  BaseStoryScene,
  DomainEntryTypeDescriptor,
  DomainGenerationTypeDescriptor,
} from '../platform/types.js';
import type {
  EntryDetail,
  EntrySearchResult,
  GearsSegment,
  StoryGenerateResult,
  StoryScene,
  TypeInfo,
  VideoTypeMeta,
} from '@shared/types.js';

describe('platform base type boundary', () => {
  it('keeps current china_culture models structurally compatible', () => {
    expectTypeOf<EntryDetail>().toExtend<BaseEntry>();
    expectTypeOf<EntrySearchResult>().toExtend<BaseEntry>();
    expectTypeOf<StoryScene>().toExtend<BaseStoryScene>();
    expectTypeOf<GearsSegment>().toExtend<BaseGearsSegment>();
    expectTypeOf<StoryGenerateResult>().toExtend<BaseStory<StoryScene, GearsSegment>>();
    expectTypeOf<TypeInfo>().toExtend<DomainEntryTypeDescriptor>();
    expectTypeOf<VideoTypeMeta>().toExtend<DomainGenerationTypeDescriptor>();
  });

  it('contains no china_culture-specific field names or runtime implementation', async () => {
    const source = await readFile(new URL('../../../shared/platform-types.ts', import.meta.url), 'utf-8');

    expect(source).not.toContain('cultural_note');
    expect(source).not.toContain('cultural_constraints');
    expect(source).not.toContain('credibility:');
    expect(source).not.toMatch(/^\s*(?:const|class|function)\s/m);
  });
});
