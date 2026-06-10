import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildSceneRegenerationPromptPackage } from '../services/scene-regeneration-prompt.js';

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260609-story-rg1',
    project_id: '20260609-story-rg1--character_story',
    current_version_id: '20260609-story-rg1--character_story-v1',
    title: '拒签冤案',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '一纸判词，逼出一场良知选择。',
    theme: '人物故事',
    full_text: '第一场。\n\n第二场。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '雨夜开场',
        duration_sec: 30,
        location: '军衙',
        time_of_day: '雨夜',
        dramatic_function: '钩子开场',
        plot: '他看着案卷，没有落笔。',
        key_action: '停笔凝视',
        characters: ['周敦颐'],
        visual_prompt: '案卷、烛火、未签判词',
        camera_suggestion: '近景切入',
        cultural_note: '基于知识库条目',
        conflict: '签还是不签',
        dialogue_or_narration: '旁白：这一笔关乎人命。',
      },
      {
        scene_id: 2,
        title: '正面交锋',
        duration_sec: 30,
        location: '堂前',
        time_of_day: '白天',
        dramatic_function: '冲突升级',
        plot: '上官催签，周敦颐坚持重审。',
        key_action: '当面拒签',
        characters: ['周敦颐', '上官'],
        visual_prompt: '堂前对峙',
        camera_suggestion: '对切镜头',
        cultural_note: '基于知识库条目',
        conflict: '权势与良知对撞',
        dialogue_or_narration: '周敦颐：此案有疑。',
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260609-story-rg1/gears-segments',
    cultural_constraints: ['基于知识库条目'],
    credibility_note: '基本可靠',
    supplement_tasks: [
      {
        task_id: '20260609-story-rg1--supplement--supporting_characters',
        need_id: 'supporting_characters',
        label: '配角人物',
        description: '补充配角人物相关资料',
        category: 'supporting_character',
        status: 'resolved',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-09T10:00:00.000Z',
        resolved_at: '2026-06-10T10:00:00.000Z',
        supplement_note: '上官可设定为南安军衙主管，负责催促签署疑案文书。',
      },
      {
        task_id: '20260609-story-rg1--supplement--regional_context',
        need_id: 'regional_context',
        label: '地域背景',
        description: '补充地域背景相关资料',
        status: 'open',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-09T10:00:00.000Z',
        supplement_note: '这条待补说明不应进入重写提示。',
      },
    ],
  };
}

describe('buildSceneRegenerationPromptPackage', () => {
  it('injects resolved supplement notes into scene regeneration context', () => {
    const story = makeStory();
    const pkg = buildSceneRegenerationPromptPackage({
      story,
      current: story.scene_breakdown[1]!,
      previous: story.scene_breakdown[0]!,
      request: {
        scene_id: 2,
        intent: 'tighten_conflict',
      },
    });

    expect(pkg.supplement_context).toHaveLength(1);
    expect(pkg.supplement_context?.[0]).toMatchObject({
      label: '配角人物',
      category: 'supporting_character',
      supplement_note: '上官可设定为南安军衙主管，负责催促签署疑案文书。',
    });
    expect(pkg.user_prompt).toContain('已完成资料补录');
    expect(pkg.user_prompt).toContain('南安军衙主管');
    expect(pkg.user_prompt).not.toContain('这条待补说明不应进入重写提示');
  });
});
