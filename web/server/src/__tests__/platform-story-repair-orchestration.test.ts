import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type {
  StoryBlueprint,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { orchestrateStoryRepair } from '../platform/story-repair-orchestration.js';
import type { StoryAssembly } from '../platform/story-model-output-merge.js';
import type {
  StoryGenerationModelOutput,
  StoryGenerationPromptPackage,
} from '../services/story-generation-prompt.js';

function makeAssembly(title = '原故事'): StoryAssembly {
  return {
    title,
    logline: `${title}一句话`,
    theme: '守住事实边界',
    full_text: `${title}正文。这里提供足够长度的故事文本，用于验证 repair 编排只在场景骨架兼容时应用模型结果。`,
    scene_breakdown: [{
      scene_id: 1,
      title: `${title}第一场`,
      duration_sec: 60,
      location: '测试地点',
      time_of_day: '白天',
      dramatic_function: '钩子开场',
      plot: `${title}场景情节`,
      key_action: '主角作出选择',
      characters: ['主角'],
      visual_prompt: '测试地点、主角、关键道具',
      camera_suggestion: '中景推近',
      cultural_note: '机器测试文化边界',
    }],
    gears_segments: [],
    cultural_constraints: ['不得把机器测试当作真人审核'],
    credibility_note: '机器测试，不计真实信用。',
    characters: [{ name: '主角', role: 'protagonist', description: '测试角色' }],
    act_structure: [],
    protagonist_arc: [],
  };
}

function makeQuality(score: number, passed = false): StoryQualityReport {
  return {
    hasCentralEvent: true,
    hasConflict: true,
    hasProtagonistChoice: true,
    hasSceneAction: true,
    hasClimax: true,
    hasEndingTheme: true,
    isNotBiographySummary: true,
    passed,
    issues: passed ? [] : ['类型质量待修复'],
    genre_score: score,
    repair_actions: ['补强场景行动'],
  };
}

function makeStory(assembly: StoryAssembly, quality: StoryQualityReport): StoryGenerateResult {
  return {
    storyId: '20260715-story-test',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    gears_segments_url: '/api/stories/20260715-story-test/gears-segments',
    story_structure: 'single_event_drama',
    quality_report: quality,
    ...assembly,
  } as StoryGenerateResult;
}

function makePromptPackage(): StoryGenerationPromptPackage {
  return {
    prompt_version: 'story-generation/v1',
    context: {
      entry_name: '测试条目',
      entry_type: '测试',
      entry_region: '测试地区',
      entry_keywords: ['测试'],
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      story_structure: 'single_event_drama',
      target_duration: '1分钟',
      tone: '克制',
    },
    entry_summary: '测试摘要',
    entry_story: '测试故事',
    entry_cultural_significance: '测试意义',
    output_contract: {
      must_provide: ['title'],
      should_respect: ['保持 scene_id'],
      return_json_fields: ['title'],
    },
    system_prompt: '系统提示',
    user_prompt: '用户提示',
  };
}

function makeBlueprint(): StoryBlueprint {
  return {
    schema_version: 'story-blueprint/v1',
    entry_name: '测试条目',
    source_entry: '测试条目',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    story_structure: 'single_event_drama',
    target_duration: '1分钟',
    central_question: '主角如何作出选择？',
    protagonist: '主角',
    genre_beats: [],
    character_arcs: [],
    evidence_boundaries: [],
    type_specific_requirements: [],
  };
}

function makeModelOutput(assembly: StoryAssembly, sceneId = 1): StoryGenerationModelOutput {
  return {
    title: assembly.title,
    logline: assembly.logline,
    theme: assembly.theme,
    full_text: assembly.full_text,
    scene_breakdown: assembly.scene_breakdown.map(scene => ({
      scene_id: sceneId,
      title: scene.title,
      plot: scene.plot,
      key_action: scene.key_action,
      characters: scene.characters,
    })),
    cultural_constraints: assembly.cultural_constraints,
    credibility_note: assembly.credibility_note,
  };
}

function makeInput(options: {
  autoRepair?: boolean;
  quality?: StoryQualityReport;
  applyStoryAssembly?: (assembly: StoryAssembly, output?: StoryGenerationModelOutput | null) => void;
  evaluateStoryQuality?: (assembly: StoryAssembly) => StoryQualityReport;
} = {}) {
  const storyResult = makeAssembly();
  const qualityReport = options.quality ?? makeQuality(50);
  return {
    storyId: '20260715-story-test',
    autoRepair: options.autoRepair ?? true,
    strictness: 'balanced' as const,
    story: makeStory(storyResult, qualityReport),
    storyResult,
    sourceModelOutput: null as StoryGenerationModelOutput | null,
    qualityReport,
    basePromptPackage: makePromptPackage(),
    blueprint: makeBlueprint(),
    modelProfileId: 'local-balanced',
    videoType: 'ai_comic_drama' as const,
    presentationStyle: 'ai_comic' as const,
    applyStoryAssembly: options.applyStoryAssembly ?? (() => undefined),
    evaluateStoryQuality: options.evaluateStoryQuality ?? (() => makeQuality(60, true)),
  };
}

describe('platform story repair orchestration', () => {
  it('skips the adapter when auto repair is disabled or quality already passes the gate', async () => {
    const generateWithAdapter = vi.fn();
    const result = await orchestrateStoryRepair(
      makeInput({ autoRepair: false }),
      { generateWithAdapter },
    );

    expect(generateWithAdapter).not.toHaveBeenCalled();
    expect(result.repairTrace).toEqual([]);
    expect(result.storyResult.title).toBe('原故事');
  });

  it('records adapter fallback without mutating the story', async () => {
    const applyStoryAssembly = vi.fn();
    const result = await orchestrateStoryRepair(
      makeInput({ applyStoryAssembly }),
      {
        generateWithAdapter: async () => ({
          provider: 'command_json',
          output: null,
          used_fallback: true,
          reason: 'adapter_not_configured',
        }),
      },
    );

    expect(applyStoryAssembly).not.toHaveBeenCalled();
    expect(result.repairTrace[0]).toMatchObject({
      applied: false,
      reason: 'adapter_not_configured',
    });
  });

  it('rejects a repair output with an incompatible scene skeleton', async () => {
    const applyStoryAssembly = vi.fn();
    const result = await orchestrateStoryRepair(
      makeInput({ applyStoryAssembly }),
      {
        generateWithAdapter: async () => ({
          provider: 'test',
          output: makeModelOutput(makeAssembly('不兼容修复'), 2),
          used_fallback: false,
        }),
      },
    );

    expect(applyStoryAssembly).not.toHaveBeenCalled();
    expect(result.storyResult.title).toBe('原故事');
    expect(result.repairTrace[0].reason).toBe('repair_scene_breakdown_incompatible');
  });

  it('applies a compatible repair whose genre score does not decrease', async () => {
    const appliedTitles: string[] = [];
    const repaired = makeAssembly('已修复故事');
    const result = await orchestrateStoryRepair(
      makeInput({
        applyStoryAssembly: assembly => appliedTitles.push(assembly.title),
        evaluateStoryQuality: () => makeQuality(60, true),
      }),
      {
        generateWithAdapter: async () => ({
          provider: 'test',
          output: makeModelOutput(repaired),
          used_fallback: false,
        }),
      },
    );

    expect(appliedTitles).toEqual(['已修复故事']);
    expect(result.storyResult.title).toBe('已修复故事');
    expect(result.qualityReport.genre_score).toBe(60);
    expect(result.repairTrace[0]).toMatchObject({
      applied: true,
      reason: 'repair_applied',
      before_genre_score: 50,
      after_genre_score: 60,
    });
  });

  it('restores the original assembly and quality when the repair score decreases', async () => {
    const applied: Array<{ title: string; modelTitle?: string }> = [];
    const repaired = makeAssembly('退步修复');
    const originalModelOutput = makeModelOutput(makeAssembly('初始模型文案'));
    const input = makeInput({
      applyStoryAssembly: (assembly, output) => applied.push({
        title: assembly.title,
        modelTitle: output?.title,
      }),
      evaluateStoryQuality: assembly => assembly.title === '退步修复'
        ? makeQuality(40)
        : makeQuality(50),
    });
    input.sourceModelOutput = originalModelOutput;

    const result = await orchestrateStoryRepair(input, {
      generateWithAdapter: async () => ({
        provider: 'test',
        output: makeModelOutput(repaired),
        used_fallback: false,
      }),
    });

    expect(applied).toEqual([
      { title: '退步修复', modelTitle: '退步修复' },
      { title: '原故事', modelTitle: '初始模型文案' },
    ]);
    expect(result.storyResult.title).toBe('原故事');
    expect(result.qualityReport.genre_score).toBe(50);
    expect(result.repairTrace[0]).toMatchObject({
      applied: false,
      reason: 'repair_score_not_improved',
      after_genre_score: 40,
    });
  });

  it('keeps domain validation behind a callback and removes repair state-machine code from the orchestrator service', async () => {
    const storyGenerationSource = await readFile(
      new URL('../domains/china-culture/story-generation-service.ts', import.meta.url),
      'utf8',
    );
    const platformSource = await readFile(
      new URL('../platform/story-repair-orchestration.ts', import.meta.url),
      'utf8',
    );

    const postGenerationSource = await readFile(
      new URL('../platform/story-post-generation-orchestration.ts', import.meta.url),
      'utf8',
    );

    expect(storyGenerationSource).toContain("from '../../platform/story-post-generation-orchestration.js'");
    expect(storyGenerationSource).not.toContain("from '../../platform/story-repair-orchestration.js'");
    expect(storyGenerationSource).toContain("from './story-base-quality-service.js'");
    expect(storyGenerationSource).not.toContain("from '../../services/story-repair-service.js'");
    expect(storyGenerationSource).not.toContain('repair_scene_breakdown_incompatible');
    expect(storyGenerationSource).not.toContain('repair_score_not_improved');
    expect(storyGenerationSource).not.toContain('validateMemoryMosaicStory({');
    expect(postGenerationSource).toContain("from './story-repair-orchestration.js'");
    expect(postGenerationSource).toContain('orchestrateStoryRepair({');
    expect(platformSource).not.toContain('china-culture');
    expect(platformSource).toContain('input.applyStoryAssembly');
    expect(platformSource).toContain('input.evaluateStoryQuality');
  });
});
