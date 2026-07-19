import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { repairStoryWithQualityWorkflow } from '../services/quality-repair-service.js';

function makeAiComicQualityReport(): StoryQualityReport {
  return {
    hasCentralEvent: true,
    hasConflict: true,
    hasProtagonistChoice: true,
    hasSceneAction: true,
    hasClimax: true,
    hasEndingTheme: true,
    isNotBiographySummary: true,
    passed: false,
    video_type: 'ai_comic_drama',
    genre_score: 88,
    issues: [
      '流派质量信号偏弱：目标明确',
      '流派质量信号偏弱：两难成立',
      '流派质量信号偏弱：精神落点来自选择',
      '流派质量信号偏弱：名场面可拍',
    ],
    repair_actions: [
      '在第 1 场补一句主角当下具体目标。',
      '在第 3 场同时写出两条路的后果，让选择压力可见。',
      '在第 5 场把精神主题落到一次可见选择和行动上。',
      '补强名场面可拍：写成动作、冲突、后果或画面。',
    ],
    repair_action_items: [{
      action_id: 'repair-ai-comic-signals',
      label: '补强 AI 漫剧流派信号',
      target_report: 'pattern',
      severity: 'high',
      scene_ids: [1, 3, 5],
      prompt: '补强目标明确、两难成立、精神落点来自选择、名场面可拍；不要写内部质量标签。',
      expected_effect: '观众文本出现具体目标、两难后果、选择动作和可拍名场面。',
    }],
  };
}

function makeAiComicStory(): StoryGenerateResult {
  const scenes: StoryGenerateResult['scene_breakdown'] = [
    {
      scene_id: 1,
      title: '雨夜分宁断案',
      duration_sec: 20,
      location: '分宁县衙',
      time_of_day: '夜晚',
      dramatic_function: '钩子开场',
      plot: '雨夜，分宁县。周敦颐翻开一份疑难案卷，案情疑点重重。他抬头看向催促他的上司，第一次没有立刻回话。',
      key_action: '进入危机现场',
      characters: ['周敦颐'],
      conflict: '悬念开场：分宁断案的危机是什么？',
      dialogue_or_narration: '旁白：案卷里一个对不上的细节，让周敦颐停住了笔。',
      visual_prompt: '分宁县衙，夜，木案、烛火、文书、案卷、判词，周敦颐停笔特写，竖屏近景构图',
      camera_suggestion: '近景推近',
      cultural_note: '分宁断案作为影视化再现场景处理。',
    },
    {
      scene_id: 2,
      title: '角色入场',
      duration_sec: 20,
      location: '分宁县衙',
      time_of_day: '白天',
      dramatic_function: '角色入场',
      plot: '白天，分宁县衙署外雨声未停。周敦颐把案卷摊开，指尖停在两处互相矛盾的证词上；门外脚步逼近，催签的人已经到了。',
      key_action: '周敦颐发现案卷证词矛盾',
      characters: ['周敦颐'],
      conflict: '周敦颐的抉择',
      dialogue_or_narration: '周敦颐（压低声音）：证词前后不合，不能草草定案。',
      visual_prompt: '分宁县衙，白天，周敦颐摊开案卷，证词两页并排，门外人影逼近，中景分镜',
      camera_suggestion: '中景对切',
      cultural_note: '案卷细节为剧情化表达。',
    },
    {
      scene_id: 3,
      title: '对白交锋',
      duration_sec: 20,
      location: '分宁县衙',
      time_of_day: '黄昏',
      dramatic_function: '高潮',
      plot: '上官把笔推到周敦颐面前，案卷边缘被烛油烫出黑痕。周敦颐没有接笔，而是把疑点逐条摊开。',
      key_action: '上官催签，周敦颐当场摊开疑点反驳',
      characters: ['周敦颐', '上官'],
      conflict: '周敦颐的抉择',
      dialogue_or_narration: '上官（不耐）：照旧签了。周敦颐（克制）：若有冤情，这一笔就是人命。',
      visual_prompt: '分宁县衙，黄昏，上官推笔、烛油黑痕、周敦颐按住疑点，近景快速切换',
      camera_suggestion: '手部特写',
      cultural_note: '对白为影视化创作。',
    },
    {
      scene_id: 4,
      title: '选择时刻',
      duration_sec: 20,
      location: '分宁县衙',
      time_of_day: '夜晚',
      dramatic_function: '选择时刻',
      plot: '周敦颐忽然合上案卷，转身走向牢门。他不再只在案头找答案，而要亲眼重看现场。',
      key_action: '周敦颐离开案头，转向现场重查',
      characters: ['周敦颐'],
      conflict: '是否顺势签字',
      dialogue_or_narration: '周敦颐（抬眼）：我愿重查，也不愿误杀。',
      visual_prompt: '分宁县衙，夜晚，周敦颐合上案卷转向牢门，众人错愕，动作转折特写',
      camera_suggestion: '转身跟拍',
      cultural_note: '重查动作为戏剧化场面。',
    },
    {
      scene_id: 5,
      title: '精神定格',
      duration_sec: 20,
      location: '分宁县衙',
      time_of_day: '清晨',
      dramatic_function: '精神定格',
      plot: '清晨，周敦颐把未签的文书推回去。案卷上的疑点被重新打开，冤案还没有结束。',
      key_action: '周敦颐退回未签文书',
      characters: ['周敦颐'],
      conflict: '权势与良知',
      dialogue_or_narration: '周敦颐：为求一时顺从而害一人性命，吾不为也。',
      visual_prompt: '分宁县衙，清晨，未签文书推回案头，晨光照在案卷疑点，人物正面定格',
      camera_suggestion: '正面定格',
      cultural_note: '精神落点来自剧情选择。',
    },
  ];

  return {
    storyId: 'story-ai-comic-repair',
    title: '周敦颐分宁断案',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '周敦颐',
    logline: '周敦颐面对疑难案卷与催签压力，选择重查而非草草落笔。',
    theme: '人命面前，良知不能被权势替代。',
    full_text: scenes.map(scene => scene.plot).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '/api/stories/story-ai-comic-repair/gears-segments',
    cultural_constraints: ['断案细节为影视化表达'],
    credibility_note: '基于文化条目进行戏剧化再现。',
    story_structure: 'single_event_drama',
    characters: [{ name: '周敦颐', role: 'protagonist', description: '分宁任上的青年官员' }],
    protagonist_arc: [{ starting_state: '停笔犹疑', turning_point: '拒绝催签并重查', resolution: '守住良知' }],
    story_blueprint: {
      schema_version: 'story-blueprint/v1',
      entry_name: '周敦颐',
      source_entry: '周敦颐',
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      story_structure: 'single_event_drama',
      target_duration: '1分钟',
      central_event: '分宁断案',
      central_question: '周敦颐是否会在催签压力下草草落笔？',
      protagonist: '周敦颐',
      genre_beats: [
        {
          beat_id: 'beat-1',
          order: 1,
          function_label: '钩子开场',
          function_description: '疑难案卷和催签压力进入第一画面',
          content_requirement: '用案卷疑点和停笔动作建立危机。',
          evidence_boundary_ids: ['boundary-1'],
        },
        {
          beat_id: 'beat-3',
          order: 3,
          function_label: '高潮',
          function_description: '上官催签与周敦颐拒签形成正面冲突',
          content_requirement: '写清两条路后果和主角选择。',
          evidence_boundary_ids: ['boundary-1'],
        },
      ],
      character_arcs: [{
        character_name: '周敦颐',
        starting_state: '停笔犹疑',
        pressure: '上官催签',
        turning_point: '拒绝草草签字并重查',
        ending_state: '守住良知',
      }],
      evidence_boundaries: [{
        boundary_id: 'boundary-1',
        label: '断案再现边界',
        type: 'creative_treatment',
        source: '测试条目',
        note: '断案细节为影视化表达。',
      }],
      type_specific_requirements: ['对白冲突', '表情动作', '结尾钩子'],
    },
    quality_report: makeAiComicQualityReport(),
    _request_meta: {
      narrative_pattern_ids: ['hero_choice', 'cinematic_setpiece_adaptation'],
    },
  } as StoryGenerateResult & { _request_meta: { narrative_pattern_ids: string[] } };
}

describe('quality-repair-service', () => {
  it('marks a quality-only recomputation as not repaired when story content is unchanged', async () => {
    const base = makeAiComicStory();
    const story: StoryGenerateResult = {
      ...base,
      generation_type: 'character_story',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      story_blueprint: base.story_blueprint
        ? {
            ...base.story_blueprint,
            video_type: 'character_story',
            presentation_style: 'cinematic',
          }
        : undefined,
    };

    const result = await repairStoryWithQualityWorkflow(story, {});

    expect(result.trace.applied).toBe(false);
    expect(result.trace.reason).toBe('quality_recomputed_not_repaired');
    expect(result.story.full_text).toBe(story.full_text);
    expect(result.story.scene_breakdown).toEqual(story.scene_breakdown);
  });

  it('locally repairs AI comic genre signals without leaking quality labels', async () => {
    const { story, trace } = await repairStoryWithQualityWorkflow(makeAiComicStory(), {});

    expect(trace.applied).toBe(true);
    expect(trace.reason).toBe('local_ai_comic_quality_repair_applied');
    expect(story.quality_report?.passed).toBe(true);
    expect(story.quality_report?.issues.filter(issue => issue.includes('流派质量信号偏弱'))).toEqual([]);
    expect(story.full_text).toContain('要先看清事实');
    expect(story.full_text).toContain('若照旧签字');
    expect(story.full_text).toContain('守住人命面前的良知');
    expect(story.full_text).not.toMatch(/目标明确|质量信号|名场面可拍/);
    expect(story.scene_breakdown[0].visual_prompt).toContain('镜头推近定格');
  });

  it('recognizes backlog quality wording when applying local AI comic repair', async () => {
    const baseStory = makeAiComicStory();
    const pollutedScenes = baseStory.scene_breakdown.map(scene => ({
      ...scene,
      visual_prompt: `${scene.visual_prompt}——核心画面是第1集的紧张开场，连续漫剧第1集，保持人物状态、线索开合和结尾钩子前后一致。\n生成优先级：剧情推进与资料完整保持均衡，关键知识点必须进入可观看的场景行动。氛围`,
    }));
    const backlogStory = {
      ...baseStory,
      original_user_query: '系列名：濂溪少年志。周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。本集主冲突：主角第一次面对“拒签”带来的选择。',
      scene_breakdown: pollutedScenes,
      gears_segments: pollutedScenes.map(scene => ({
        segment_id: scene.scene_id,
        source_scene_id: scene.scene_id,
        duration_sec: scene.duration_sec,
        panel_count: 6,
        script_text: scene.plot,
        purpose: scene.dramatic_function,
        visual_focus: [],
        cultural_constraints: [],
        video_type: 'ai_comic_drama' as const,
        presentation_style: 'ai_comic' as const,
        segment_prompt_hint: scene.visual_prompt,
      })),
      quality_report: {
        ...makeAiComicQualityReport(),
        issues: [
          '缺少主角选择——没有明确的选择行为',
          '用户大纲偏离：用户大纲强调少年求学与思想形成，正文没有覆盖韶山、私塾、长沙求学等核心阶段。',
          '流派质量信号偏弱：人物不丢失',
          '流派质量信号偏弱：关系不改写',
          '流派质量信号偏弱：主线不换题',
          '流派质量信号偏弱：新增内容不抢戏',
        ],
        repair_actions: [
          '补出主角明确选择行为。',
          '回到用户大纲，围绕濂溪少年志、周敦颐知识线和拒签主线推进。',
          '对齐样片信号：人物不丢失。',
          '对齐样片信号：关系不改写。',
        ],
        repair_action_items: [],
      },
      _request_meta: {
        narrative_pattern_ids: ['hero_choice', 'cinematic_setpiece_adaptation', 'source_fidelity_adaptation'],
      },
    } as StoryGenerateResult & { _request_meta: { narrative_pattern_ids: string[] } };

    const { story, trace } = await repairStoryWithQualityWorkflow(backlogStory, {});

    expect(trace.applied).toBe(true);
    expect(trace.reason).toBe('local_ai_comic_quality_repair_applied');
    expect(story.quality_report?.issues.join('\n')).not.toContain('韶山');
    expect(story.quality_report?.issues.filter(issue => issue.includes('流派质量信号偏弱'))).toEqual([]);
    expect(story.full_text).toContain('我不能签字');
    expect(story.full_text).toContain('先重问证人、重看现场');
    expect(story.quality_report?.audience_text_report?.polluted_terms ?? []).toEqual([]);
    expect(story.gears_segments.map(segment => segment.segment_prompt_hint ?? '').join('\n')).not.toMatch(/生成优先级|核心画面是/);
  });
});
