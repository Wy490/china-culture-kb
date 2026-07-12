import { describe, expect, it } from 'vitest';
import type { EntryDetail, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { buildStoryBlueprint, attachBlueprintScenes } from '../services/story-blueprint-service.js';
import { validateGenreStoryQuality } from '../services/genre-quality-service.js';
import { buildAdaptationAnalysis } from '../services/adaptation-analysis-service.js';

function makeEntry(): EntryDetail {
  return {
    name: '周敦颐——理学开山鼻祖',
    province: '湖南',
    region: '永州→道县',
    type: '历史人物',
    summary: '周敦颐为北宋理学重要人物。',
    story: '周敦颐在月岩洞中思考学问与人生选择。',
    culturalSignificance: '濂溪学脉影响后世。',
    relatedLocations: [{ name: '月岩洞', description: '道县天然岩洞' }],
    keywords: ['周敦颐', '北宋', '月岩洞', '理学'],
    sources: ['测试来源'],
    credibility: '基本可靠',
    verificationMethod: '测试核验',
    unverifiedPoints: ['月岩悟道为民间传说'],
  };
}

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
  };
}

function makeStory(): StoryGenerateResult {
  const scenes = [
    {
      scene_id: 1,
      title: '钩子开场',
      duration_sec: 30,
      location: '月岩洞',
      time_of_day: '清晨',
      dramatic_function: '钩子开场',
      plot: '周敦颐在洞口停步，面对世俗功名与内心追问，意识到真正的选择已经到来。',
      key_action: '提出追问',
      characters: ['周敦颐'],
      visual_prompt: '月岩洞晨光与书卷',
      camera_suggestion: '近景',
      cultural_note: '保留传说边界',
      conflict: '功名与学问追求之间的冲突',
    },
    {
      scene_id: 2,
      title: '主角处境',
      duration_sec: 30,
      location: '月岩洞',
      time_of_day: '白天',
      dramatic_function: '主角处境',
      plot: '他回望仕途与乡土，知道每一步选择都会留下代价。',
      key_action: '衡量代价',
      characters: ['周敦颐'],
      visual_prompt: '书卷与洞壁',
      camera_suggestion: '中景',
      cultural_note: '创作性场景调度',
    },
    {
      scene_id: 3,
      title: '高潮',
      duration_sec: 30,
      location: '月岩洞',
      time_of_day: '黄昏',
      dramatic_function: '高潮',
      plot: '周敦颐最终选择坚守学问与良知，让个人追问落到精神传承之中。',
      key_action: '做出选择',
      characters: ['周敦颐'],
      visual_prompt: '黄昏光线与洞口远景',
      camera_suggestion: '特写',
      cultural_note: '精神落点',
    },
  ];

  return {
    storyId: 'story-test',
    title: '月岩洞前的选择',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '周敦颐在月岩洞前面对学问与功名的选择。',
    theme: '人物选择与精神传承',
    full_text: scenes.map(scene => scene.plot).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '/api/stories/story-test/gears-segments',
    cultural_constraints: [],
    credibility_note: '基本可靠',
    story_structure: 'single_event_drama',
    characters: [{ name: '周敦颐', role: 'protagonist', description: '北宋士人' }],
    protagonist_arc: [{ starting_state: '追问', turning_point: '选择', resolution: '精神落点' }],
  };
}

describe('story blueprint and genre quality', () => {
  it('builds and attaches scene-aware genre beats', () => {
    const entry = makeEntry();
    const story = makeStory();
    const blueprint = buildStoryBlueprint({
      entry,
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      centralEvent: '月岩悟道',
    });
    const attached = attachBlueprintScenes(blueprint, story.scene_breakdown, story.storyId);

    expect(attached.schema_version).toBe('story-blueprint/v1');
    expect(attached.storyId).toBe('story-test');
    expect(attached.genre_beats[0].scene_id).toBe(1);
    expect(attached.genre_beats[0].function_label).toBe('钩子开场');
    expect(attached.evidence_boundaries.map(item => item.boundary_id)).toContain('unverified-points');
  });

  it('adds genre quality fields to the base quality report', () => {
    const entry = makeEntry();
    const story = makeStory();
    const blueprint = attachBlueprintScenes(
      buildStoryBlueprint({
        entry,
        videoType: 'character_story',
        presentationStyle: 'cinematic',
        storyStructure: 'single_event_drama',
        targetDuration: '1分钟',
        centralEvent: '月岩悟道',
      }),
      story.scene_breakdown,
      story.storyId,
    );

    const report = validateGenreStoryQuality({
      story,
      baseReport: makeBaseReport(),
      blueprint,
    });

    expect(report.video_type).toBe('character_story');
    expect(report.genre_score).toBeGreaterThanOrEqual(70);
    expect(report.missing_required_elements).toEqual([]);
    expect(report.repair_actions).toContain('补强主角当下目标');
    expect(report.repair_actions).toContain('对齐样片信号：人物目标清楚');
  });

  it('recognizes narrative evidence without forcing quality labels into audience text', () => {
    const story = {
      ...makeStory(),
      logline: '少年周敦颐在橘子洲雨中回身相助，把求学志向落在泥水里。',
      theme: '守心不是避开浊流，而是在浊流中仍愿伸手。',
      full_text: [
        '少年周敦颐把此行所求写在书袋内侧：读书不是求一张功名纸，而是要弄清人怎样立身。',
        '橘子洲头风雨逼近，官场规则、名声、人情和催客的船夫一起压到眼前。',
        '他若立刻登船，今晚便能赶到驿路；若回身帮人，书卷会湿，行程也会误。',
        '他挽起衣摆踩进泥水，捞起孩童的书篮，把自己的干布包递过去。',
        '这里仍要说清：橘洲问莲是影视化创作，不是《爱莲说》的确证成因。',
      ].join('\n\n'),
      scene_breakdown: [
        {
          scene_id: 1,
          title: '橘洲雨起',
          duration_sec: 30,
          location: '长沙橘子洲头',
          time_of_day: '傍晚',
          dramatic_function: '钩子开场',
          plot: '少年周敦颐把此行所求写在书袋内侧，抬头看见渡口风雨压近。',
          key_action: '背起书袋',
          characters: ['周敦颐'],
          visual_prompt: '长沙橘子洲头，北宋少年，书袋，江风',
          camera_suggestion: '中景推近',
          cultural_note: '影视化创作',
          conflict: '远行求学与当下风雨阻隔',
        },
        {
          scene_id: 2,
          title: '泥水回身',
          duration_sec: 30,
          location: '橘子洲渡口',
          time_of_day: '雨中',
          dramatic_function: '关键行动',
          plot: '船夫催客上船，孩童的书篮滑进泥水；周敦颐若回身帮人，书卷会湿，行程也会误。',
          key_action: '挽起衣摆踩进泥水捞起书篮',
          characters: ['周敦颐', '孩童', '船夫'],
          visual_prompt: '雨中渡口，泥水，书篮，北宋少年',
          camera_suggestion: '手持跟拍',
          cultural_note: '用行动表现守心',
          conflict: '赶路与助人相冲突',
        },
        {
          scene_id: 3,
          title: '夜渡守心',
          duration_sec: 30,
          location: '湘江夜渡',
          time_of_day: '夜晚',
          dramatic_function: '高潮',
          plot: '他在船头写下求学先求其心，鞋边泥痕还在，人却带着更清楚的心继续上路。',
          key_action: '写下旅札后向岸边长揖',
          characters: ['周敦颐'],
          visual_prompt: '湘江夜渡，船头灯火，书卷，泥痕布履',
          camera_suggestion: '远景拉开',
          cultural_note: '这里仍要说清：橘洲问莲是影视化创作，不是《爱莲说》的确证成因。',
          conflict: '错过行程之后确认守心',
        },
      ],
    } as StoryGenerateResult;

    const report = validateGenreStoryQuality({
      story,
      baseReport: makeBaseReport(),
    });

    expect(report.genre_score).toBeGreaterThanOrEqual(90);
    expect(report.issues.filter(issue => issue.includes('流派质量信号偏弱'))).toEqual([]);
  });

  it('recognizes Mao growth actions, historical pressure, causality, and fact boundaries', () => {
    const story = {
      ...makeStory(),
      source_entry: '毛泽东——从韶山冲走向天安门的农家革命者',
      video_type: 'historical_drama',
      original_user_query: '毛泽东少年时期到革命觉醒的故事，重点表现湖南乡土、求学、新民学会、农民运动、理想形成。',
      title: '毛泽东：从韶山少年到革命觉醒',
      logline: '毛泽东从湖南乡土出发，在求学、结社与农民实践中形成革命理想。',
      theme: '理想在走进人民、看见现实并采取行动的过程中形成。',
      full_text: [
        '社会动荡与军阀统治构成时代压力，毛泽东离开韶山走进长沙求学。',
        '他组织新民学会讨论如何改造中国，又走进农民夜校倾听谷价、租息和生计问题。',
        '因此，他徒步考察湖南五县，整理调查笔记，把乡土观察转化为对农民革命力量的判断。',
      ].join('\n\n'),
      scene_breakdown: [{
        ...makeStory().scene_breakdown[0],
        title: '把脚印写成道路',
        location: '湖南五县农民运动考察路线',
        dramatic_function: '高潮',
        plot: '毛泽东翻开沾着泥点的笔记，因此确认道路就在人民已经行动起来的土地上。',
        key_action: '毛泽东徒步考察并整理调查笔记',
        characters: ['毛泽东', '农民协会骨干'],
        conflict: '地方权势与农民改变现实的行动相冲突',
        cultural_note: '事实边界：五县考察来自条目；清晨整理手稿是影视化创作。',
        factual_basis: '依据毛泽东条目关于1927年湖南五县农民运动考察的记载。',
        fictionalized_elements: ['泥点笔记是视觉化处理。'],
      }],
      characters: [{ name: '毛泽东', role: 'protagonist', description: '从韶山少年成长为青年行动者。' }],
      protagonist_arc: [{ starting_state: '离乡求学', turning_point: '走进农民实践', resolution: '形成革命理想' }],
    } as StoryGenerateResult;

    const report = validateGenreStoryQuality({
      story,
      baseReport: makeBaseReport(),
    });
    const issues = report.issues.join('\n');

    expect(issues).not.toContain('因果链清楚');
    expect(issues).not.toContain('人物不是年表');
    expect(issues).not.toContain('制度压力可见');
    expect(issues).not.toContain('史实边界明确');
    expect(issues).not.toContain('必须有时代压力');
    expect(issues).not.toContain('必须有事件因果');
    expect(issues).not.toContain('必须标注创作边界');
  });

  it('recognizes AI comic setpiece and choice signals from natural scene text', () => {
    const story = {
      ...makeStory(),
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      logline: '周敦颐为了看清事实，拒绝在疑案上草草落笔。',
      theme: '人命面前，权势不能替良知落笔。',
      full_text: [
        '雨夜，周敦颐停住笔，翻开案卷：他所求不是快些结案，而是要先看清事实。',
        '若照旧签字，囚犯可能含冤而死；若坚持重查，他就要得罪上官、承担仕途代价。',
        '周敦颐推开判词、重问证人，烛火在案卷疑点上跳动，镜头推近定格。',
        '清晨，他退回的不是一纸文书，而是守住人命面前的良知。',
      ].join('\n\n'),
      scene_breakdown: [
        {
          scene_id: 1,
          title: '停笔疑案',
          duration_sec: 20,
          location: '分宁县衙',
          time_of_day: '夜晚',
          dramatic_function: '钩子开场',
          plot: '周敦颐停住笔，翻开案卷：他所求不是快些结案，而是要先看清事实。',
          key_action: '停住笔、翻开案卷',
          characters: ['周敦颐'],
          visual_prompt: '分宁县衙，烛火特写，案卷疑点，镜头推近定格',
          camera_suggestion: '近景推近',
          cultural_note: '断案细节为影视化再现。',
          conflict: '催签压力逼近',
        },
        {
          scene_id: 2,
          title: '若签若查',
          duration_sec: 20,
          location: '分宁县衙',
          time_of_day: '黄昏',
          dramatic_function: '对白交锋',
          plot: '若照旧签字，囚犯可能含冤而死；若坚持重查，他就要得罪上官、承担仕途代价。',
          key_action: '推开判词、重问证人',
          characters: ['周敦颐', '上官'],
          visual_prompt: '上官推笔，周敦颐按住疑点，手部特写',
          camera_suggestion: '对切',
          cultural_note: '对白为戏剧化表达。',
          conflict: '顺势签字与坚持重查之间的两难',
          dialogue_or_narration: '周敦颐：我不能签字，先重问证人、重看现场。',
        },
        {
          scene_id: 3,
          title: '良知定格',
          duration_sec: 20,
          location: '分宁县衙',
          time_of_day: '清晨',
          dramatic_function: '精神定格',
          plot: '他退回的不是一纸文书，而是守住人命面前的良知。',
          key_action: '推回文书、守住良知',
          characters: ['周敦颐'],
          visual_prompt: '未签文书推回案头，晨光定格',
          camera_suggestion: '正面定格',
          cultural_note: '精神落点来自选择动作。',
          conflict: '权势与良知',
        },
      ],
    } as StoryGenerateResult;

    const report = validateGenreStoryQuality({
      story,
      baseReport: makeBaseReport(),
      narrativePatternIds: ['hero_choice', 'cinematic_setpiece_adaptation'],
    });

    expect(report.genre_score).toBeGreaterThanOrEqual(90);
    expect(report.issues.filter(issue => issue.includes('流派质量信号偏弱'))).toEqual([]);
    expect(story.full_text).not.toMatch(/目标明确|质量信号|名场面可拍/);
  });

  it('does not apply Mao youth outline drift checks to Zhou Dunyi youth outlines', () => {
    const story = {
      ...makeStory(),
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      original_user_query: '系列名：濂溪少年志。周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。本集主冲突：主角第一次面对“拒签”带来的选择。',
      logline: '少年周敦颐第一次意识到拒签不是旁观问题，而是必须亲自选择。',
      theme: '拒签不是逞强，而是在疑案前守住良知。',
      full_text: [
        '雨夜，周敦颐在濂溪旧书旁停住笔，发现案卷里的证词前后不合。',
        '若照旧签字，囚犯可能含冤而死；若坚持重查，他就要得罪上官、承担代价。',
        '他推开判词说：我不能签字，先重问证人、重看现场。',
        '清晨，他退回的不是一纸文书，而是守住人命面前的良知。',
      ].join('\n\n'),
    } as StoryGenerateResult;

    const report = validateGenreStoryQuality({
      story,
      baseReport: makeBaseReport(),
      narrativePatternIds: ['hero_choice', 'cinematic_setpiece_adaptation', 'source_fidelity_adaptation'],
    });

    expect(report.issues.filter(issue => issue.includes('用户大纲偏离'))).toEqual([]);
    expect(report.issues.filter(issue => issue.includes('流派质量信号偏弱'))).toEqual([]);
    expect(report.issues.join('\n')).not.toContain('韶山');
  });

  it('keeps Mao youth outline drift checks for Mao-specific outlines', () => {
    const story = {
      ...makeStory(),
      source_entry: '毛泽东——从韶山冲走向天安门的农家革命者',
      video_type: 'character_story',
      original_user_query: '少年毛泽东从韶山私塾到长沙求学，在第一师范接触新思想。',
      full_text: '少年毛泽东离开家乡，故事直接跳到北京和天安门的历史余响。',
      scene_breakdown: makeStory().scene_breakdown.map(scene => ({
        ...scene,
        characters: ['毛泽东'],
        plot: '少年毛泽东离开家乡，故事直接跳到北京和天安门的历史余响。',
      })),
    } as StoryGenerateResult;

    const report = validateGenreStoryQuality({
      story,
      baseReport: makeBaseReport(),
    });

    expect(report.issues.some(issue => issue.includes('用户大纲偏离') && issue.includes('韶山'))).toBe(true);
  });

  it('flags adaptation drift when user novel characters disappear', () => {
    const source = '少年阿青在书院门口等雨停，师友误会他偷走旧书。阿青决定留下来查清真相。夜里，阿青举着油灯穿过藏书楼。';
    const story = {
      ...makeStory(),
      original_user_query: source,
      full_text: '周敦颐在月岩洞前做出选择。',
      adaptation_analysis: buildAdaptationAnalysis(source),
      _request_meta: {
        source_material_mode: 'adapt_user_novel',
      },
    } as StoryGenerateResult & { _request_meta: Record<string, unknown> };

    const report = validateGenreStoryQuality({
      story,
      baseReport: makeBaseReport(),
      narrativePatternIds: ['novel_scene_compression'],
    });

    expect(report.issues.some(issue => issue.includes('改编偏差'))).toBe(true);
    expect(report.repair_actions.some(action => action.includes('原作关键人物/称谓未进入改编方案'))).toBe(true);
    expect(report.repair_actions.some(action => action.includes('原作主线节拍未被改编承接'))).toBe(true);
  });
});
