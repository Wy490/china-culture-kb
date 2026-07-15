import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { StoryScene } from '@shared/types.js';
import { buildPlatformGearsSegmentsFromScenes } from '../platform/story-gears-segment.js';

function scene(overrides: Partial<StoryScene> = {}): StoryScene {
  return {
    scene_id: 1,
    title: '桥上抉择',
    duration_sec: 30,
    location: '古桥',
    time_of_day: '黄昏',
    dramatic_function: '高潮',
    plot: '主角决定公开旧信。',
    key_action: '举起旧信面对众人',
    characters: ['主角', '见证人'],
    visual_prompt: '古桥，落日，旧信在风中展开。',
    camera_suggestion: '近景缓推',
    cultural_note: '旧信年代仍待核实',
    ...overrides,
  };
}

describe('platform story scene to GEARS segment mapping', () => {
  it('preserves known duration panel counts, script, focus, prompt and cultural boundary fields', () => {
    const [segment] = buildPlatformGearsSegmentsFromScenes(
      [scene()],
      'ai_comic_drama',
      'ai_comic',
    );

    expect(segment).toMatchObject({
      segment_id: 1,
      source_scene_id: 1,
      duration_sec: 30,
      panel_count: 9,
      purpose: '高潮',
      cultural_constraints: ['旧信年代仍待核实'],
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
    });
    expect(segment?.script_text).toBe('【高潮】古桥，黄昏。古桥，落日，旧信在风中展开。。举起旧信面对众人——桥上抉择。近景缓推。');
    expect(segment?.visual_focus).toEqual(['古桥', '古桥', '落日']);
    expect(segment?.segment_prompt_hint).toContain('主体：主角、见证人');
    expect(segment?.segment_prompt_hint).toContain('动作：举起旧信面对众人');
  });

  it('keeps the existing six-panel fallback and empty cultural constraints', () => {
    const [segment] = buildPlatformGearsSegmentsFromScenes(
      [scene({ duration_sec: 31, cultural_note: '', characters: [] })],
      'character_story',
      'cinematic',
    );

    expect(segment?.panel_count).toBe(6);
    expect(segment?.cultural_constraints).toEqual([]);
    expect(segment?.segment_prompt_hint).not.toContain('主体：');
  });

  it('removes zero-call legacy scene assembly and keeps both live rebuild paths behind the platform boundary', async () => {
    const storySource = await readFile(new URL('../services/story-service.ts', import.meta.url), 'utf-8');
    const modelMergeSource = await readFile(
      new URL('../platform/story-model-output-merge.ts', import.meta.url),
      'utf-8',
    );

    expect(storySource).not.toContain('function buildSceneBreakdown');
    expect(storySource).not.toContain('function extractCharactersFromStory');
    expect(storySource).not.toContain('function buildActStructure');
    expect(storySource).not.toContain('DURATION_BY_SCENE_COUNT');
    expect(storySource).not.toContain('PANEL_COUNT_BY_DURATION');
    expect(storySource).not.toContain('function buildGearsSegments');
    expect(storySource).not.toContain('buildPlatformGearsSegmentsFromScenes');
    expect(modelMergeSource.match(/buildPlatformGearsSegmentsFromScenes\(/g)).toHaveLength(2);
  });
});
