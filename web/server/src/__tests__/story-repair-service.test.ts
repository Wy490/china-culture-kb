import { describe, expect, it } from 'vitest';
import type { StoryBlueprint, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { buildStoryRepairPromptPackage, shouldAttemptStoryRepair } from '../services/story-repair-service.js';
import type { StoryGenerationPromptPackage } from '../services/story-generation-prompt.js';

function makeQualityReport(score: number, passed = false): StoryQualityReport {
  return {
    hasCentralEvent: true,
    hasConflict: true,
    hasProtagonistChoice: true,
    hasSceneAction: true,
    hasClimax: true,
    hasEndingTheme: true,
    isNotBiographySummary: true,
    passed,
    issues: ['类型字段缺失：craft_or_ritual_process'],
    genre_score: score,
    repair_actions: ['补齐类型字段：craft_or_ritual_process', '补充具体步骤'],
  };
}

function makeStory(): StoryGenerateResult {
  return {
    storyId: 'story-1',
    title: '缺少工艺流程的非遗片',
    generation_type: 'culture_promo',
    video_type: 'heritage_promo',
    presentation_style: 'documentary',
    source_entry: '测试非遗',
    logline: '一门技艺正在寻找新的传承方式。',
    theme: '非遗传承',
    full_text: '匠人走进作坊，讲述这门技艺的精神，但文本尚未写出清楚流程。',
    scene_breakdown: [{
      scene_id: 1,
      title: '匠人登场',
      duration_sec: 60,
      location: '作坊',
      time_of_day: '清晨',
      dramatic_function: '匠人登场',
      plot: '匠人走进作坊，抚摸工具，准备开始工作。',
      key_action: '准备制作',
      characters: ['匠人'],
      visual_prompt: '作坊、工具、手部动作',
      camera_suggestion: '中景',
      cultural_note: '非遗传承语境',
    }],
    gears_segments: [],
    gears_segments_url: '/api/stories/story-1/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试',
  };
}

function makeBasePackage(): StoryGenerationPromptPackage {
  return {
    prompt_version: 'story-generation/v1',
    context: {
      entry_name: '测试非遗',
      entry_type: '非遗',
      entry_region: '湖南',
      entry_keywords: ['工艺'],
      video_type: 'heritage_promo',
      presentation_style: 'documentary',
      story_structure: 'object_clue_journey',
      target_duration: '1分钟',
      tone: '',
    },
    entry_summary: '测试摘要',
    entry_story: '测试故事',
    entry_cultural_significance: '测试意义',
    output_contract: {
      must_provide: ['title'],
      should_respect: ['保持非遗宣传片质感'],
      return_json_fields: ['title'],
    },
    system_prompt: '系统提示',
    user_prompt: '用户提示',
  };
}

function makeBlueprint(): StoryBlueprint {
  return {
    schema_version: 'story-blueprint/v1',
    entry_name: '测试非遗',
    source_entry: '测试非遗',
    video_type: 'heritage_promo',
    presentation_style: 'documentary',
    story_structure: 'object_clue_journey',
    target_duration: '1分钟',
    central_question: '这门技艺如何通过动作和流程体现传承？',
    protagonist: '匠人',
    genre_beats: [{
      beat_id: 'beat-1',
      order: 1,
      function_label: '工艺全程',
      function_description: '完整工艺流程展示',
      content_requirement: '展示从原料到成品的关键步骤。',
      evidence_boundary_ids: ['source-entry'],
    }],
    character_arcs: [],
    evidence_boundaries: [{
      boundary_id: 'source-entry',
      label: '主条目事实边界',
      type: 'verified',
      source: '测试非遗',
      note: '保留条目边界。',
    }],
    type_specific_requirements: ['完整流程'],
  };
}

describe('story-repair-service', () => {
  it('uses strictness and score to decide whether to attempt repair', () => {
    expect(shouldAttemptStoryRepair({
      autoRepair: true,
      qualityReport: makeQualityReport(82, true),
      strictness: 'strict',
    })).toBe(true);
    expect(shouldAttemptStoryRepair({
      autoRepair: true,
      qualityReport: makeQualityReport(82, true),
      strictness: 'balanced',
    })).toBe(false);
    expect(shouldAttemptStoryRepair({
      autoRepair: false,
      qualityReport: makeQualityReport(20),
    })).toBe(false);
  });

  it('builds a focused repair package with quality issues and blueprint beats', () => {
    const pkg = buildStoryRepairPromptPackage({
      basePackage: makeBasePackage(),
      story: makeStory(),
      qualityReport: makeQualityReport(48),
      blueprint: makeBlueprint(),
      strictness: 'balanced',
    });

    expect(pkg.system_prompt).toContain('完整故事重写');
    expect(pkg.user_prompt).toContain('类型质量问题');
    expect(pkg.user_prompt).toContain('类型字段缺失：craft_or_ritual_process');
    expect(pkg.user_prompt).toContain('工艺全程');
    expect(pkg.output_contract.return_json_fields).toContain('craft_or_ritual_process');
  });
});
