import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { entry, fidelityStory, productionBaselines } from './fixtures/shot-production-baselines.js';
import { buildProductionBoardSeedanceExport } from '../services/production-board-export-service.js';
import { mergeModelOutputOntoLocalSkeleton, type StoryAssembly } from '../platform/story-model-output-merge.js';
import { allocateProductionFrames } from '../services/shot-production-contract-service.js';
import { generateDramaticContent } from '../services/dramatic-story.js';
import { buildGearsDeliveryPackage } from '../services/gears-delivery-service.js';
import { buildStoryProductionBoard } from '../services/production-board-service.js';
import { buildSeedancePromptPackage } from '../services/seedance-prompt-service.js';

describe('S03 shot fidelity', () => {
  it('does not repeat the first source sentence across social-short scenes', () => {
    const story = generateDramaticContent({ entry, centralEvent: '改过与助人', videoType: 'social_short',
      presentationStyle: 'social_media_fastcut', targetDuration: '30秒', tone: '' });
    const spoken = story.scene_breakdown.map(scene => scene.dialogue_or_narration).filter(Boolean);
    expect(new Set(spoken).size).toBe(spoken.length);
    expect(spoken.length).toBeGreaterThan(1);
    expect(story.scene_breakdown.reduce((sum, scene) => sum + scene.duration_sec, 0)).toBe(30);
  });

  it('preserves scene time without shortening thin chunks or clipping a long single action', () => {
    const story = fidelityStory();
    const units = buildGearsDeliveryPackage(story).units;
    expect(units.reduce((sum, unit) => sum + unit.suggested_duration_sec, 0)).toBe(37);
    story.scene_breakdown[0].plot = '袁了凡持续托住车轮，直到老人把车完全推出泥地';
    story.scene_breakdown[0].key_action = story.scene_breakdown[0].plot;
    story.scene_breakdown[0].dialogue_or_narration = '';
    const longUnits = buildGearsDeliveryPackage(story).units;
    expect(longUnits.reduce((sum, unit) => sum + unit.suggested_duration_sec, 0)).toBe(37);
  });

  it('uses each delivery chunk on the board and in Seedance, rather than the whole scene', () => {
    const story = fidelityStory();
    const units = buildGearsDeliveryPackage(story).units;
    expect(units.length).toBeGreaterThan(1);
    const board = buildStoryProductionBoard(story);
    expect(board.shot_units.map(shot => shot.script_text)).toEqual(units.map(unit => unit.script_text));
    const prompts = buildSeedancePromptPackage(story);
    expect(new Set(prompts.shot_units.map(unit => unit.script_text)).size).toBe(units.length);
    expect(prompts.total_duration_sec).toBe(37);
  });
});

describe('S03 export contract', () => {
  it('keeps all baseline actions, speech and remainder through board and Seedance exports', () => {
    const story = productionBaselines();
    const delivery = buildGearsDeliveryPackage(story);
    const contracts = delivery.units.map(unit => unit.production_contract!);
    expect(contracts).toHaveLength(5);
    expect(contracts.reduce((sum, item) => sum + item.timing.clip_frames, 0)).toBe(605);
    expect(contracts.every(item => item.timing.clip_frames === 121)).toBe(true);
    expect(contracts.map(item => item.speech_text)).toEqual(story.scene_breakdown.flatMap(scene => scene.production_beats!.map(beat => beat.speech_text)));
    expect(buildStoryProductionBoard(story).shot_units.map(unit => unit.production_contract)).toEqual(contracts);
    const prompts = buildSeedancePromptPackage(story);
    expect(prompts.shot_units.map(unit => unit.production_contract)).toEqual(contracts);
    for (const unit of prompts.shot_units) {
      for (const action of unit.production_contract!.required_actions) expect(unit.seedance_prompt).toContain(action);
    }
    expect(buildProductionBoardSeedanceExport(buildStoryProductionBoard(story)).shot_units.map(unit => unit.production_contract)).toEqual(contracts);
    if (process.env.S03_FIXTURE_OUTPUT) writeFileSync(process.env.S03_FIXTURE_OUTPUT, JSON.stringify(delivery, null, 2));
  });
  it('uses the same contract for three offline model scenes and invalidates stale plans', () => {
    const story = productionBaselines();
    const assembly: StoryAssembly = { ...story, act_structure: [], protagonist_arc: [], characters: story.characters ?? [] };
    const model = { ...story, scene_breakdown: story.scene_breakdown.map(scene => ({ ...scene, plot: `模型测试：${scene.plot}` })) };
    const merged = { ...story, ...mergeModelOutputOntoLocalSkeleton(assembly, model, story.video_type!, story.presentation_style!) };
    expect(buildGearsDeliveryPackage(merged).units.map(unit => unit.production_contract)).toEqual(buildGearsDeliveryPackage(story).units.map(unit => unit.production_contract));
    model.scene_breakdown[0].production_beats = undefined;
    model.scene_breakdown[0].dialogue_or_narration = '';
    const changed = mergeModelOutputOntoLocalSkeleton(assembly, model, story.video_type!, story.presentation_style!);
    expect(changed.scene_breakdown[0].production_beats).toBeUndefined();
    expect(changed.scene_breakdown[0].dialogue_or_narration).toBe('');
  });
  it('conserves weighted frames and rejects plans with zero-frame beats', () => {
    expect(allocateProductionFrames(10, [1, 2, 3])).toEqual([2, 3, 5]);
    expect(() => allocateProductionFrames(3, [1, 1, 1000])).toThrow('needs more frames');
    expect(() => allocateProductionFrames(10, [Number.MAX_VALUE, Number.MAX_VALUE])).toThrow();
  });
});
