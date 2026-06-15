import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { enrichStoryQualityReport } from '../services/quality-workflow-service.js';

function makeBaseReport(): StoryQualityReport {
  return {
    hasCentralEvent: true,
    hasConflict: true,
    hasProtagonistChoice: true,
    hasSceneAction: true,
    hasClimax: true,
    hasEndingTheme: true,
    isNotBiographySummary: true,
    passed: true,
    issues: [],
    genre_score: 82,
    repair_actions: [],
  };
}

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260615-story-p0',
    title: '少年求学',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    original_user_query: '少年离开山村求学。师兄误会他偷书。少年夜探藏书楼查清真相。',
    logline: '少年在误会中寻找真相。',
    theme: '选择与成长',
    full_text: '少年离开山村求学，面对同窗冷眼，他决定留下。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '离村',
        duration_sec: 20,
        location: '山村路口',
        time_of_day: '清晨',
        dramatic_function: '钩子开场',
        plot: '少年离开山村求学。',
        key_action: '背起书箱',
        characters: ['少年'],
        visual_prompt: '山村路口，少年背书箱，晨光',
        camera_suggestion: '中景推近',
        cultural_note: '测试',
      },
      {
        scene_id: 2,
        title: '书院误会',
        duration_sec: 20,
        location: '书院门口',
        time_of_day: '午后',
        dramatic_function: '冲突升级',
        plot: '师兄误会少年偷书。',
        key_action: '少年护住书箱',
        characters: ['少年', '师兄'],
        visual_prompt: '核心画面是故事里少年为什么被误会',
        camera_suggestion: '近景对切',
        cultural_note: '测试',
        conflict: '误会与自证',
      },
      {
        scene_id: 3,
        title: '留下',
        duration_sec: 20,
        location: '书院廊下',
        time_of_day: '夜晚',
        dramatic_function: '结尾钩子',
        plot: '少年决定留下。',
        key_action: '',
        characters: [],
        visual_prompt: '',
        camera_suggestion: '定格',
        cultural_note: '测试',
      },
    ],
    gears_segments: [{
      segment_id: 1,
      source_scene_id: 1,
      duration_sec: 20,
      panel_count: 6,
      script_text: '少年离村。',
      purpose: '钩子开场',
      visual_focus: [],
      cultural_constraints: [],
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      segment_prompt_hint: '质量信号：需要更强冲突',
    }],
    gears_segments_url: '/api/stories/20260615-story-p0/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试',
    story_structure: 'single_event_drama',
    characters: [{ name: '少年', role: 'protagonist', description: '求学少年' }],
  };
}

describe('quality-workflow-service', () => {
  it('builds P0 reports and repair actions for outline, pattern, and GEARS gaps', () => {
    const report = enrichStoryQualityReport({
      story: makeStory(),
      qualityReport: makeBaseReport(),
      narrativePatternIds: ['platform_short_drama_hook'],
    });

    expect(report.passed).toBe(false);
    expect(report.outline_coverage_report?.schema_version).toBe('outline-coverage/v1');
    expect(report.outline_coverage_report?.missing_nodes).toBeGreaterThan(0);
    expect(report.pattern_quality_report?.schema_version).toBe('pattern-quality/v1');
    expect(report.pattern_quality_report?.weak_signals.length).toBeGreaterThan(0);
    expect(report.gears_readiness_report?.schema_version).toBe('gears-readiness/v1');
    expect(report.gears_readiness_report?.prompt_gaps.length).toBeGreaterThan(0);

    const targets = report.repair_action_items?.map(action => action.target_report) ?? [];
    expect(targets).toContain('outline');
    expect(targets).toContain('pattern');
    expect(targets).toContain('gears');
    expect(targets).toContain('combined');
    expect(report.repair_action_items?.find(action => action.target_report === 'gears')?.scene_ids).toContain(2);
    expect(report.gears_readiness_report?.preview).toContain('交付缺口');
  });
});
