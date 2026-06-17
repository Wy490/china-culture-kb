import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildSeedancePromptPackage } from '../services/seedance-prompt-service.js';

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260615-story-seedance',
    title: '书院雨夜',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    logline: '少年在雨夜进入书院，必须查清旧案。',
    theme: '选择与代价',
    full_text: '少年被师兄拦在书院门外，必须在天亮前找到旧案证据。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '雨夜入局',
        duration_sec: 24,
        location: '书院门外',
        time_of_day: '夜晚',
        dramatic_function: '钩子开场',
        plot: '少年抱着书箱站在雨里，师兄挡住门，宣布天亮前找不到旧案证据就失去入门资格。',
        key_action: '少年抓紧书箱，抬头追问规则。',
        characters: ['少年', '师兄'],
        visual_prompt: '质量信号：书院门外，雨水，灯笼，少年与师兄对峙',
        camera_suggestion: '建立镜头后慢推到少年近景',
        cultural_note: '本场景基于测试条目，具体细节请核实来源；生成优先级：剧情推进与资料完整保持均衡。',
        conflict: '入门资格与旧案任务冲突',
        dialogue_or_narration: '师兄：天亮前，拿证据来。',
        source_entries: ['测试条目'],
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260615-story-seedance/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试',
    characters: [
      { name: '少年', role: 'protagonist', description: '背书箱的求学少年' },
      { name: '师兄', role: 'supporting', description: '守门的书院师兄' },
    ],
  };
}

describe('seedance-prompt-service', () => {
  it('builds shot-level Seedance prompts from story and GEARS delivery data', () => {
    const pkg = buildSeedancePromptPackage(makeStory());

    expect(pkg.schema_version).toBe('seedance-prompt-package/v1');
    expect(pkg.target_platform).toBe('seedance_2_0');
    expect(pkg.shot_units.length).toBeGreaterThan(0);
    expect(pkg.asset_reference_plan.some(item => item.includes('@图片1'))).toBe(true);
    expect(pkg.asset_references.some(item => item.kind === 'character' && item.reference_slot === '@图片1')).toBe(true);
    expect(pkg.material_validation.image_count).toBeGreaterThan(0);
    expect(pkg.material_validation.image_count).toBeLessThanOrEqual(pkg.material_validation.max_image_files);
    expect(pkg.markdown).toContain('Seedance 2.0 镜头提示词包');
    expect(pkg.markdown).toContain('素材 slot');

    for (const unit of pkg.shot_units) {
      expect(unit.duration_sec).toBeGreaterThanOrEqual(4);
      expect(unit.duration_sec).toBeLessThanOrEqual(15);
      expect(unit.asset_slots.length).toBeGreaterThan(0);
      expect(unit.material_validation.total_file_count).toBe(unit.asset_slots.length);
      expect(unit.material_validation.prompt_complexity_score).toBeGreaterThan(0);
      expect(unit.seedance_prompt).toContain('0-3秒');
      expect(unit.seedance_prompt).toContain('@图片');
      expect(unit.seedance_prompt).toContain('风格：');
      expect(unit.seedance_prompt).not.toContain('质量信号');
      expect(unit.seedance_prompt).not.toContain('生成优先级');
      expect(unit.seedance_prompt).not.toContain('本场景基于');
      expect(unit.negative_constraints).toContain('不要出现质量报告、来源说明或内部字段名');
    }
  });
});
