import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult, VideoType } from '@shared/types.js';
import {
  resolveStoryQualityFamily,
  validateStoryFamilyBaseQuality,
} from '../services/story-family-quality-service.js';
import { rebuildDerivedStoryState } from '../services/derived-story-state-service.js';

function makeSpatialStory(videoType: 'scene_short' | 'landscape_mood'): StoryGenerateResult {
  const scenes = [
    {
      scene_id: 1,
      title: '溪口开卷',
      duration_sec: 12,
      location: '濂溪入口',
      time_of_day: '清晨',
      dramatic_function: '空间引入',
      plot: '晨雾贴着溪面移动，水声从石桥下传来，镜头沿湿润石阶进入山谷。',
      key_action: '镜头沿石阶进入溪谷',
      characters: [],
      visual_prompt: '清晨薄雾，溪水，湿石阶，竹影，冷青色天光，大面积留白',
      camera_suggestion: '低机位沿石阶缓慢前移',
      cultural_note: '空间位置以实地资料为边界。',
      dialogue_or_narration: '雾从水面醒来。',
    },
    {
      scene_id: 2,
      title: '竹影转深',
      duration_sec: 12,
      location: '濂溪竹径',
      time_of_day: '午后',
      dramatic_function: '视觉移动',
      plot: '镜头从溪口转入竹径，风穿过叶片，斑驳日光沿石墙缓慢移动。',
      key_action: '沿溪转入竹径',
      characters: [],
      visual_prompt: '午后竹径，风吹叶片，石墙光斑，空镜，纵深构图',
      camera_suggestion: '沿溪横移后转入竹径',
      cultural_note: '不虚构人物事件。',
      dialogue_or_narration: '只听见风，把光推向更深处。',
    },
    {
      scene_id: 3,
      title: '暮色停驻',
      duration_sec: 12,
      location: '濂溪石桥',
      time_of_day: '黄昏',
      dramatic_function: '留白收束',
      plot: '暮色落到石桥，水声继续，最后一个远景停在桥洞与天光之间。',
      key_action: '镜头停在石桥远景',
      characters: [],
      visual_prompt: '黄昏石桥，桥洞倒影，暖灰天光，水纹，远景留白',
      camera_suggestion: '缓慢拉远后固定长镜头',
      cultural_note: '以空间真实形态为准。',
      dialogue_or_narration: '山不回答，水仍向前。',
    },
  ];
  return {
    storyId: `story-${videoType}`,
    title: '濂溪一日',
    generation_type: 'scene_short',
    video_type: videoType,
    presentation_style: videoType === 'landscape_mood' ? 'ink_style' : 'cinematic',
    source_entry: '濂溪测试条目',
    logline: '镜头沿濂溪从晨雾走到暮色。',
    theme: '空间、光影与时间的流动',
    full_text: scenes.map(scene => scene.dialogue_or_narration).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: `/api/stories/story-${videoType}/gears-segments`,
    cultural_constraints: [],
    credibility_note: '测试边界。',
    spatial_identity: '濂溪入口—竹径—石桥组成的溪谷空间',
    visual_route: ['濂溪入口', '濂溪竹径', '濂溪石桥'],
    time_layer: '清晨薄雾—午后光斑—黄昏暮色',
    atmosphere: '水声、竹风与留白',
  };
}

function makeDocumentaryStory(): StoryGenerateResult {
  const story = makeSpatialStory('scene_short');
  return {
    ...story,
    storyId: 'story-documentary',
    video_type: 'documentary_short',
    presentation_style: 'documentary',
    title: '石桥下的旧水尺',
    logline: '一支摄制组追问石桥水尺如何记录濂溪近百年的水位变化。',
    theme: '现场痕迹如何连接地方记忆',
    full_text: '今天还能看见什么？摄制组从桥下水尺开始追索。\n\n地方志记载了三次洪水，老人补充亲历口述。\n\n再现镜头只说明测量方法，不冒充历史原始影像。',
    source_quotes: ['《濂溪地方志》水利卷记载三次洪水水位。'],
    field_notes: ['石桥东侧桥墩仍留有水尺刻痕。'],
    scene_breakdown: story.scene_breakdown.map((scene, index) => ({
      ...scene,
      plot: index === 0
        ? '摄制组来到石桥现场，镜头贴近桥墩水尺刻痕，追问这些刻线记录了什么。'
        : index === 1
          ? '地方志页码、水尺实物与老人关于洪水的口述在现场交叉印证。'
          : '实验人员演示旧式测量方法，并明确这段画面是有限再现，不是历史原始记录。',
      key_action: index === 0 ? '测量水尺刻痕' : index === 1 ? '对照地方志与口述' : '演示测量并标注再现',
      visual_prompt: index === 0 ? '石桥现场，桥墩水尺刻痕，卷尺特写' : index === 1 ? '地方志书页，老人手指旧照片，石桥实景' : '测量工具演示，画面角标“方法再现”',
      cultural_note: index === 2 ? '事实边界：测量动作为方法再现，不作为原始历史影像。' : '来源提示：地方志与现场遗存交叉核验。',
      factual_basis: index === 1 ? '地方志水利卷和老人公开口述。' : '石桥现场水尺遗存。',
      fictionalized_elements: index === 2 ? ['测量动作按现存工具有限再现'] : [],
    })),
  };
}

function makePromotionalStory(): StoryGenerateResult {
  const story = makeSpatialStory('scene_short');
  return {
    ...story,
    storyId: 'story-promo',
    video_type: 'culture_promo',
    presentation_style: 'voiceover_montage',
    title: '一针穿过今天',
    logline: '从绣架上的一针，看见湘绣如何进入今天的生活。',
    theme: '传统技艺在当代日常中继续生长',
    core_message: '湘绣不是静止的展品，而是仍在被使用的生活技艺。',
    slogan_or_key_sentence: '让一针旧技艺，绣进今天。',
    modern_connection: '青年设计师把传统针法用于当代服饰与公共课程。',
    visual_symbols: ['绣架', '丝线', '双面绣虎眼'],
    scene_breakdown: story.scene_breakdown.map((scene, index) => ({
      ...scene,
      location: ['湘绣工坊', '湘绣博物馆', '青年设计工作室'][index],
      plot: [
        '匠人把丝线劈细，在绣架上用游针绣出虎眼的第一层光。',
        '博物馆展柜里的老绣片与今天课堂里的针法示范并置出现。',
        '青年设计师把绣片缝入当代衣装，邀请观众走进工坊体验一针。',
      ][index],
      key_action: ['劈丝落针', '对照老绣片与课堂示范', '把绣片缝入衣装并邀请体验'][index],
      visual_prompt: ['绣架，丝线，虎眼针脚微距', '展柜老绣片，课堂手部示范', '当代服饰，青年工作室，绣片特写'][index],
      dialogue_or_narration: index === 2 ? '让一针旧技艺，绣进今天。' : scene.dialogue_or_narration,
    })),
  };
}

function makeInstructionalStory(): StoryGenerateResult {
  const story = makeSpatialStory('scene_short');
  return {
    ...story,
    storyId: 'story-training',
    video_type: 'education_training',
    presentation_style: 'host_narration',
    title: '三步辨认传统纹样',
    logline: '学会从构图、寓意和使用场景三步辨认传统纹样。',
    theme: '建立可复用的纹样观察方法',
    argument_points: ['先看构图骨架', '再查核心寓意', '最后核对使用场景'],
    knowledge_outline: ['学习目标', '三步辨认法', '案例练习', '复盘清单'],
    scene_breakdown: story.scene_breakdown.map((scene, index) => ({
      ...scene,
      title: ['学习目标', '三步示范', '练习与复盘'][index],
      dramatic_function: ['学习目标', '示范演示', '练习复盘'][index],
      plot: [
        '学完这节课，你能回答如何用三步辨认一个陌生的传统纹样。',
        '以团花纹为例：第一步标出构图骨架，第二步查核心寓意，第三步核对器物场景。',
        '请暂停画面完成练习，再用构图、寓意、场景三项清单复盘答案。',
      ][index],
      key_action: ['展示学习目标卡', '逐步标注团花纹', '完成练习并核对清单'][index],
      visual_prompt: ['学习目标字幕卡，三项图标', '团花纹拆解图，第一步第二步第三步标注', '练习题对比图，复盘清单字幕'][index],
      dialogue_or_narration: ['今天学会三步辨认法。', '例如这枚团花纹，先看骨架，再查寓意。', '现在试一试，并记住三项复盘要点。'][index],
    })),
  };
}

function makeSocialStory(): StoryGenerateResult {
  const story = makeSpatialStory('scene_short');
  return {
    ...story,
    storyId: 'story-social',
    video_type: 'social_short',
    presentation_style: 'social_media_fastcut',
    title: '一根丝线为什么要劈成八份？',
    logline: '用三个近景看懂湘绣劈丝如何改变光泽。',
    theme: '细到极致，光才会活。',
    core_message: '劈丝决定针脚的细度与光泽。',
    slogan_or_key_sentence: '丝越细，光越活。',
    scene_breakdown: story.scene_breakdown.map((scene, index) => ({
      ...scene,
      duration_sec: index === 0 ? 3 : 8,
      title: ['3秒钩子', '一眼对比', '记忆句'][index],
      dramatic_function: ['3秒钩子', '关键信息', '金句落点'][index],
      plot: [
        '一根丝线为什么要劈成八份？针尖马上给你答案！',
        '粗丝反光硬，细丝贴着绸面转动，同一只虎眼立刻亮起来。',
        '手指收住最后一缕细丝，画面定格在虎眼光点。',
      ][index],
      key_action: ['手指瞬间劈开丝线', '粗细丝线同屏落针对比', '收住细丝并定格虎眼光点'][index],
      visual_prompt: ['9:16微距，手指劈丝，针尖强反差', '左右对比，粗丝与细丝针脚', '虎眼光点特写，金句字幕'][index],
      dialogue_or_narration: ['为什么要劈八份？', '粗丝硬。细丝活。', '丝越细，光越活。'][index],
    })),
  };
}

describe('story-family-quality-service', () => {
  it('maps all 15 video types into six explicit quality families', () => {
    const expected: Record<VideoType, ReturnType<typeof resolveStoryQualityFamily>> = {
      character_story: 'dramatic_narrative',
      historical_drama: 'dramatic_narrative',
      legend_story: 'dramatic_narrative',
      ai_comic_drama: 'dramatic_narrative',
      children_story: 'dramatic_narrative',
      documentary_short: 'documentary_evidence',
      culture_promo: 'promotional_communication',
      heritage_promo: 'promotional_communication',
      city_brand_promo: 'promotional_communication',
      explainer_video: 'instructional_learning',
      lecture_video: 'instructional_learning',
      education_training: 'instructional_learning',
      scene_short: 'spatial_landscape',
      landscape_mood: 'spatial_landscape',
      social_short: 'social_short_form',
    };

    expect(Object.fromEntries(
      (Object.keys(expected) as VideoType[]).map(videoType => [
        videoType,
        resolveStoryQualityFamily(videoType),
      ]),
    )).toEqual(expected);
    expect(new Set(Object.values(expected))).toHaveLength(6);
  });

  it.each(['scene_short', 'landscape_mood'] as const)(
    'passes a golden %s without inventing protagonist choice, conflict, climax, or moral-theme failures',
    (videoType) => {
      const report = validateStoryFamilyBaseQuality(makeSpatialStory(videoType));

      expect(report.passed).toBe(true);
      expect(report.family_quality_report).toMatchObject({
        schema_version: 'story-family-quality/v1',
        family: 'spatial_landscape',
        passed: true,
        blocking_check_ids: [],
      });
      expect(report.family_quality_report?.checks.every(check => check.status === 'passed')).toBe(true);
      expect(report.issues.join('\n')).not.toMatch(/主角选择|明确冲突|高潮场景|精神\/道德落点/);
    },
  );

  it('fails a spatial film on observable route, time/light, sound, and blank-space evidence', () => {
    const story = makeSpatialStory('landscape_mood');
    story.spatial_identity = undefined;
    story.visual_route = undefined;
    story.time_layer = undefined;
    story.atmosphere = undefined;
    story.full_text = '濂溪文化历史悠久，具有重要价值。'.repeat(30);
    story.scene_breakdown = story.scene_breakdown.slice(0, 1).map(scene => ({
      ...scene,
      location: '',
      time_of_day: '',
      plot: '这里具有重要历史文化价值，需要系统了解相关知识内容。'.repeat(8),
      key_action: '介绍文化价值',
      visual_prompt: '文化价值宣传画面',
      camera_suggestion: '常规镜头',
      dialogue_or_narration: '这里历史悠久，文化深厚，意义重大。'.repeat(20),
    }));

    const report = validateStoryFamilyBaseQuality(story);
    const failedIds = report.family_quality_report?.blocking_check_ids ?? [];

    expect(report.passed).toBe(false);
    expect(failedIds).toEqual(expect.arrayContaining([
      'spatial_identity',
      'visual_route',
      'time_light_sound',
      'sensory_blank_space',
    ]));
    expect(report.issues.join('\n')).toContain('空间/山水');
    expect(report.issues.join('\n')).not.toContain('缺少主角选择');
  });

  it('persists the family report through the canonical derived-state rebuild', async () => {
    const rebuilt = await rebuildDerivedStoryState(makeSpatialStory('landscape_mood'), {
      revalidateDomainSafety: false,
    });

    expect(rebuilt.quality_report?.family_quality_report).toMatchObject({
      schema_version: 'story-family-quality/v1',
      family: 'spatial_landscape',
      passed: true,
    });
    expect(rebuilt.quality_report?.issues.join('\n')).not.toMatch(/主角选择|明确冲突|高潮场景|精神\/道德落点/);
  });

  it.each([
    ['纪录证据', makeDocumentaryStory, 'documentary_evidence'],
    ['宣传传播', makePromotionalStory, 'promotional_communication'],
    ['讲解教学', makeInstructionalStory, 'instructional_learning'],
    ['社交短视频', makeSocialStory, 'social_short_form'],
  ] as const)('passes a golden %s story with observable family evidence', (_label, buildStory, family) => {
    const report = validateStoryFamilyBaseQuality(buildStory());

    expect(report.family_quality_report?.family).toBe(family);
    expect(report.family_quality_report?.passed).toBe(true);
    expect(report.family_quality_report?.blocking_check_ids).toEqual([]);
    expect(report.issues.join('\n')).not.toMatch(/主角选择|明确冲突|高潮场景|精神\/道德落点/);
  });

  it.each([
    ['纪录证据', makeDocumentaryStory, ['source_evidence', 'field_presence', 'fact_reconstruction_boundary']],
    ['宣传传播', makePromotionalStory, ['value_proposition', 'verifiable_visuals', 'contemporary_connection', 'communication_memory_line']],
    ['讲解教学', makeInstructionalStory, ['learning_question_or_objective', 'example_or_demonstration', 'recap_or_practice', 'teaching_visual_support']],
    ['社交短视频', makeSocialStory, ['three_second_hook', 'information_density', 'caption_rhythm', 'memory_line', 'vertical_visual_action']],
  ] as const)('reports family-specific blockers for a weak %s story', (label, buildStory, expectedIds) => {
    const story = buildStory();
    story.title = '一般文化介绍';
    story.logline = '全面介绍相关文化内容。';
    story.theme = '文化';
    story.core_message = undefined;
    story.slogan_or_key_sentence = undefined;
    story.modern_connection = undefined;
    story.visual_symbols = undefined;
    story.argument_points = undefined;
    story.knowledge_outline = undefined;
    story.source_quotes = undefined;
    story.field_notes = undefined;
    story.credibility_note = '';
    story.scene_breakdown = story.scene_breakdown.slice(0, 1).map(scene => ({
      ...scene,
      title: '一般介绍',
      dramatic_function: '一般介绍',
      duration_sec: 12,
      location: '',
      plot: '这里具有重要历史文化价值，需要进一步进行全面系统深入介绍。'.repeat(12),
      key_action: '介绍价值',
      visual_prompt: '',
      camera_suggestion: '常规镜头',
      cultural_note: '',
      factual_basis: undefined,
      fictionalized_elements: [],
      source_entries: [],
      dialogue_or_narration: undefined,
    }));
    story.full_text = story.scene_breakdown[0].plot;

    const report = validateStoryFamilyBaseQuality(story);

    expect(report.passed).toBe(false);
    expect(report.family_quality_report?.blocking_check_ids).toEqual(expect.arrayContaining([...expectedIds]));
    expect(report.issues.join('\n')).toContain(label);
    expect(report.issues.join('\n')).not.toContain('缺少主角选择');
  });
});
