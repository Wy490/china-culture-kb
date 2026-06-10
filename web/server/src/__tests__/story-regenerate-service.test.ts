import { afterEach, describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildRegenerationNote, regenerateSceneInStory } from '../services/story-regenerate-service.js';

const ORIGINAL_SCENE_REGEN_PROVIDER = process.env.SCENE_REGEN_PROVIDER;
const ORIGINAL_SCENE_REGEN_COMMAND = process.env.SCENE_REGEN_COMMAND;
const ORIGINAL_SCENE_REGEN_COMMAND_ARGS = process.env.SCENE_REGEN_COMMAND_ARGS;

afterEach(() => {
  if (ORIGINAL_SCENE_REGEN_PROVIDER === undefined) delete process.env.SCENE_REGEN_PROVIDER;
  else process.env.SCENE_REGEN_PROVIDER = ORIGINAL_SCENE_REGEN_PROVIDER;

  if (ORIGINAL_SCENE_REGEN_COMMAND === undefined) delete process.env.SCENE_REGEN_COMMAND;
  else process.env.SCENE_REGEN_COMMAND = ORIGINAL_SCENE_REGEN_COMMAND;

  if (ORIGINAL_SCENE_REGEN_COMMAND_ARGS === undefined) delete process.env.SCENE_REGEN_COMMAND_ARGS;
  else process.env.SCENE_REGEN_COMMAND_ARGS = ORIGINAL_SCENE_REGEN_COMMAND_ARGS;
});

function makeDramaticStory(): StoryGenerateResult {
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
    full_text: '第一场。\n\n第二场。\n\n第三场。',
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
      {
        scene_id: 3,
        title: '高潮',
        duration_sec: 30,
        location: '堂前',
        time_of_day: '黄昏',
        dramatic_function: '高潮',
        plot: '他决定交还文书。',
        key_action: '交还文书',
        characters: ['周敦颐'],
        visual_prompt: '文书落桌',
        camera_suggestion: '特写',
        cultural_note: '基于知识库条目',
      },
    ],
    gears_segments: [
      {
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 30,
        panel_count: 6,
        script_text: 'scene1',
        purpose: '钩子开场',
        visual_focus: ['军衙'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
      {
        segment_id: 2,
        source_scene_id: 2,
        duration_sec: 30,
        panel_count: 6,
        script_text: 'scene2',
        purpose: '冲突升级',
        visual_focus: ['堂前'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
    ],
    gears_segments_url: '/api/stories/20260609-story-rg1/gears-segments',
    cultural_constraints: ['基于知识库条目'],
    credibility_note: '基本可靠',
    story_structure: 'single_event_drama',
  };
}

function makeMemoryMosaicStory(): StoryGenerateResult {
  return {
    storyId: '20260609-story-rg2',
    project_id: '20260609-story-rg2--character_story',
    current_version_id: '20260609-story-rg2--character_story-v1',
    title: '给阿嫲的回声',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '一件旧物，把主角的精神重新拼出来。',
    theme: '回忆拼图',
    full_text: '现实一。\n\n回忆一。\n\n现实二。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '现实钩子',
        duration_sec: 30,
        location: '旧宅',
        time_of_day: '清晨',
        dramatic_function: '现实钩子',
        plot: '追寻者发现一件旧物。',
        key_action: '发现旧物',
        characters: ['后人'],
        visual_prompt: '旧物特写',
        camera_suggestion: '缓推',
        cultural_note: '基于知识库条目',
      },
      {
        scene_id: 2,
        title: '见证人回忆',
        duration_sec: 30,
        location: '旧学馆',
        time_of_day: '白天',
        dramatic_function: '见证人回忆',
        plot: '见证人说起主角年轻时的选择。',
        key_action: '回忆往事',
        characters: ['后人', '同窗', '周敦颐'],
        visual_prompt: '口述与回忆画面交叠',
        camera_suggestion: '中景口述',
        cultural_note: '基于知识库条目',
      },
      {
        scene_id: 3,
        title: '最终揭示',
        duration_sec: 30,
        location: '旧宅',
        time_of_day: '黄昏',
        dramatic_function: '最终揭示',
        plot: '所有碎片开始拼合。',
        key_action: '理解真相',
        characters: ['后人'],
        visual_prompt: '旧物回响',
        camera_suggestion: '特写',
        cultural_note: '基于知识库条目',
      },
    ],
    gears_segments: [
      {
        segment_id: 2,
        source_scene_id: 2,
        duration_sec: 30,
        panel_count: 6,
        script_text: 'memory',
        purpose: '见证人回忆',
        visual_focus: ['旧学馆'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
    ],
    gears_segments_url: '/api/stories/20260609-story-rg2/gears-segments',
    cultural_constraints: ['基于知识库条目'],
    credibility_note: '基本可靠',
    story_structure: 'memory_mosaic_biography',
    memory_mosaic_seed: {
      subject: '周敦颐',
      present_day_seeker: '后人',
      seeker_goal: '想弄清他为什么会那样选择',
      trigger_object: '一卷残缺案牍',
      central_question: '周敦颐为什么宁可得罪上官也不肯签字？',
      witnesses: [
        {
          witness_name: '同窗',
          relationship_to_subject: '同窗挚友',
          remembered_event: '拒签前夜的争辩',
          subject_choice: '宁可得罪上官也不肯签字',
          emotional_bias: 'regret',
          object_or_phrase: '未签的判词',
          scene_location: '旧学馆',
          scene_time: '白天',
          present_day_effect: '让后人理解他的代价',
          factual_basis: '基于条目中的拒签冤案',
          fictionalized_elements: ['对白做了影视化处理'],
        },
      ],
      final_reveal: '他真正守的是那把心里的尺',
      ending_image: '案牍重新合上',
    },
  };
}

describe('story-regenerate-service', () => {
  it('rewrites a dramatic scene with stronger continuity and updates segments', async () => {
    delete process.env.SCENE_REGEN_COMMAND
    process.env.SCENE_REGEN_PROVIDER = 'command_json'

    const story = makeDramaticStory();
    const updated = await regenerateSceneInStory(story, {
      scene_id: 2,
      intent: 'tighten_conflict',
      user_note: '把丢官的风险写得更明确',
    });

    expect(updated.scene_breakdown[1].plot).toContain('把丢官的风险写得更明确');
    expect(updated.scene_breakdown[1].plot).toContain('高潮');
    expect(updated.gears_segments.find(seg => seg.source_scene_id === 2)?.script_text).toContain('冲突升级');
    expect(updated.full_text).toContain('把丢官的风险写得更明确');
    expect(updated.reference_trace?.at(-1)?.applied_rules[0]).toBe('scene_regeneration:tighten_conflict');
    expect(updated.reference_trace?.at(-1)?.applied_rules).toContain('provider:local_fallback');
    expect(updated.quality_report).toBeTruthy();
  });

  it('rewrites a memory mosaic witness scene in witness voice', async () => {
    delete process.env.SCENE_REGEN_COMMAND
    process.env.SCENE_REGEN_PROVIDER = 'command_json'

    const story = makeMemoryMosaicStory();
    const updated = await regenerateSceneInStory(story, {
      scene_id: 2,
      intent: 'rewrite_narration',
      user_note: '让见证人口吻更克制，像是多年后才敢说出口',
    });

    expect(updated.scene_breakdown[1].dialogue_or_narration).toContain('同窗说');
    expect(updated.scene_breakdown[1].plot).toContain('口述');
    expect(updated.gears_segments.find(seg => seg.source_scene_id === 2)?.purpose).toContain('回忆线');
    expect(updated.full_text).toContain('【回忆】');
    expect(updated.reference_trace?.at(-1)?.applied_rules[1]).toContain('回忆线');
    expect(updated.quality_report).toBeTruthy();
  });

  it('applies external adapter output when command provider is configured', async () => {
    process.env.SCENE_REGEN_PROVIDER = 'command_json'
    process.env.SCENE_REGEN_COMMAND = process.execPath
    process.env.SCENE_REGEN_COMMAND_ARGS = JSON.stringify([
      '-e',
      "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const input=JSON.parse(d);process.stdout.write(JSON.stringify({plot:'模型改写：'+input.target_scene.title,key_action:'模型动作',dialogue_or_narration:'模型旁白',conflict:'模型冲突',visual_prompt:'模型画面',camera_suggestion:'模型镜头'}));});",
    ])

    const story = makeDramaticStory()
    const updated = await regenerateSceneInStory(story, {
      scene_id: 2,
      intent: 'custom',
      user_note: '用模型重写',
    })

    expect(updated.scene_breakdown[1].plot).toBe('模型改写：正面交锋')
    expect(updated.scene_breakdown[1].dialogue_or_narration).toBe('模型旁白')
    expect(updated.reference_trace?.at(-1)?.applied_rules).toContain('provider:command_json')
    expect(updated.reference_trace?.at(-1)?.applied_rules).toContain('provider_output_applied')
  })

  it('preserves the original full-generation model_profile_id during scene regeneration', async () => {
    delete process.env.SCENE_REGEN_COMMAND
    process.env.SCENE_REGEN_PROVIDER = 'command_json'

    const story = {
      ...makeDramaticStory(),
      model_profile_id: 'claude_sonnet',
      generation_source: 'Claude Sonnet',
      generation_mode: 'external_model' as const,
      generation_used_fallback: false,
    }

    const updated = await regenerateSceneInStory(story, {
      scene_id: 2,
      intent: 'custom',
      user_note: '用另一个模型试写局部场景',
      model_profile_id: 'codex_gpt55',
    })

    expect(updated.model_profile_id).toBe('claude_sonnet')
    expect(updated.generation_source).toBe('Claude Sonnet')
    expect(updated.generation_mode).toBe('external_model')
    expect(updated.generation_used_fallback).toBe(false)
    expect(updated.reference_trace?.at(-1)?.applied_rules).toContain('provider:local_fallback')
  })

  it('builds readable regeneration notes', () => {
    expect(buildRegenerationNote({ scene_id: 1, intent: 'clarify_visuals' })).toBe('强化画面');
    expect(buildRegenerationNote({
      scene_id: 1,
      intent: 'custom',
      user_note: '把桌上的文书拍清楚',
    })).toBe('自定义修改：把桌上的文书拍清楚');
  });
});
