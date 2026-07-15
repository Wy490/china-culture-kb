import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { StoryGenerateRequest, VideoType } from '@shared/types.js';
import {
  buildStoryPriorityInstruction,
  resolveLegacyGenerationType,
  resolveStoryNarrativePatternIds,
  resolveStoryStructureType,
  resolveStoryVideoType,
} from '../platform/story-generation-policy.js';

function request(overrides: Partial<StoryGenerateRequest> = {}): StoryGenerateRequest {
  return {
    original_user_query: '测试故事',
    target_video_duration: '3分钟',
    ...overrides,
  };
}

describe('platform story generation policy', () => {
  it('resolves explicit video type, legacy mapping and the stable default in priority order', () => {
    expect(resolveStoryVideoType(request({
      video_type: 'ai_comic_drama',
      generation_type: 'scene_short',
    }))).toBe('ai_comic_drama');
    expect(resolveStoryVideoType(request({ generation_type: 'scene_short' }))).toBe('scene_short');
    expect(resolveStoryVideoType(request())).toBe('character_story');
  });

  it('maps every current video type back to one legacy generation family', () => {
    const families: Record<string, VideoType[]> = {
      character_story: [
        'character_story', 'historical_drama', 'legend_story', 'ai_comic_drama', 'children_story',
      ],
      culture_promo: [
        'culture_promo', 'heritage_promo', 'city_brand_promo', 'social_short',
        'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
      ],
      scene_short: ['scene_short', 'landscape_mood'],
    };

    for (const [generationType, videoTypes] of Object.entries(families)) {
      for (const videoType of videoTypes) {
        expect(resolveLegacyGenerationType(videoType)).toBe(generationType);
      }
    }
  });

  it('adds, deduplicates and caps adaptation patterns without changing non-adaptation selections', () => {
    const selected = ['mortal_growth', 'source_fidelity_adaptation'] as const;
    expect(resolveStoryNarrativePatternIds(request({
      narrative_pattern_ids: [...selected],
    }))).toEqual(selected);

    expect(resolveStoryNarrativePatternIds(request({
      video_type: 'ai_comic_drama',
      source_material_mode: 'adapt_user_novel',
      narrative_pattern_ids: ['source_fidelity_adaptation'],
    }))).toEqual([
      'source_fidelity_adaptation',
      'novel_scene_compression',
      'chapter_slice_adaptation',
      'character_arc_adaptation',
      'serial_hook_adaptation',
    ]);
  });

  it('honors compatible explicit structures and keeps deterministic type defaults', () => {
    expect(resolveStoryStructureType(
      request({ story_structure: 'memory_mosaic_biography' }),
      'character_story',
    )).toBe('memory_mosaic_biography');
    expect(resolveStoryStructureType(
      request({ story_structure: 'memory_mosaic_biography' }),
      'scene_short',
    )).toBe('object_clue_journey');
    expect(resolveStoryStructureType(request(), 'documentary_short', {
      historical_person_entry: true,
    })).toBe('witness_testimony');
    expect(resolveStoryStructureType(request(), 'documentary_short')).toBe('single_event_drama');
    expect(resolveStoryStructureType(request(), 'education_training')).toBe('lecture_argument');
  });

  it('keeps all three priority instructions explicit and non-empty', () => {
    expect(buildStoryPriorityInstruction('plot_first')).toContain('剧情推进');
    expect(buildStoryPriorityInstruction('knowledge_first')).toContain('事实边界');
    expect(buildStoryPriorityInstruction('balanced')).toContain('保持均衡');
  });

  it('keeps the production story service on the platform boundary with no policy copies', async () => {
    const [source, preparationSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(source).toContain("from './story-generation-preparation-service.js'");
    expect(source).not.toContain("from '../../platform/story-generation-policy.js'");
    expect(preparationSource).toContain("from '../../platform/story-generation-policy.js'");
    expect(source).not.toContain('function resolveVideoType');
    expect(source).not.toContain('function resolveGenerationType');
    expect(source).not.toContain('function resolveNarrativePatternIds');
    expect(source).not.toContain('function storyPriorityInstruction');
    expect(source).not.toContain('function resolveStoryStructure');
  });
});
