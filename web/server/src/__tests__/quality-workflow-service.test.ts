import { describe, expect, it } from 'vitest';
import type { ProductionMaterialReadinessReport, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
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
      story: {
        ...makeStory(),
        original_user_query: [
          '分镜大纲：',
          '1. 少年离开山村求学。',
          '2. 师兄误会他偷书。',
          '3. 少年夜探藏书楼查清真相。',
          '4. 真相公开后离开书院。',
        ].join('\n'),
      },
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
    expect(targets).toContain('audience');
    expect(targets).toContain('combined');
    expect(report.repair_action_items?.find(action => action.target_report === 'gears')?.scene_ids).toContain(2);
    expect(report.gears_readiness_report?.preview).toContain('交付缺口');
    expect(report.audience_text_report?.clean).toBe(false);
    expect(report.audience_text_report?.polluted_terms).toContain('质量信号');
  });

  it('reports audience-facing quality labels as repairable pollution', () => {
    const story = {
      ...makeStory(),
      full_text: '少年写下主角目标，随后用行动具体地完成选择。',
      scene_breakdown: makeStory().scene_breakdown.map(scene => scene.scene_id === 2
        ? {
            ...scene,
            plot: '师兄误会少年偷书，旁白强调因果链必须清楚。',
            dialogue_or_narration: '旁白：人物不是年表，要补目标明确。',
          }
        : scene),
      gears_segments: [{
        ...makeStory().gears_segments[0],
        script_text: '这一段要说明选择有代价，并标明史实边界。',
        segment_prompt_hint: '生成优先级：先补质量信号。',
      }],
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: makeBaseReport(),
    });

    expect(report.passed).toBe(false);
    expect(report.audience_text_report?.schema_version).toBe('audience-text/v1');
    expect(report.audience_text_report?.clean).toBe(false);
    expect(report.audience_text_report?.polluted_terms).toEqual(expect.arrayContaining([
      '主角目标',
      '行动具体',
      '因果链',
      '人物不是年表',
      '目标明确',
      '选择有代价',
      '史实边界',
      '生成优先级',
      '质量信号',
    ]));
    expect(report.repair_action_items?.some(action => action.action_id === 'repair-audience-text')).toBe(true);
    expect(report.repair_action_items?.find(action => action.action_id === 'repair-audience-text')?.scene_ids).toContain(2);
  });

  it('downgrades quality when production material readiness is blocked', () => {
    const productionMaterialReadiness: ProductionMaterialReadinessReport = {
      schema_version: 'production-material-readiness/v1',
      video_type: 'ai_comic_drama',
      pack_label: 'AI 漫剧单片',
      score: 42,
      status: 'blocked',
      available_fields: ['core_conflict'],
      missing_fields: [{
        field_id: 'reference_images_or_keyframes',
        label: '参考图或关键帧',
        stage: 'production_ready',
        blocking_level: 'blocking',
        reason: 'AI 漫剧进入生产前需要角色或关键画面参考，避免角色和空间漂移。',
        recommended_question: '请补充主角、关键配角或第一场关键帧参考图。',
      }],
      gate_reports: [{
        stage: 'production_ready',
        status: 'blocked',
        required_items: ['reference_images_or_keyframes'],
        available_fields: ['core_conflict'],
        missing_fields: [{
          field_id: 'reference_images_or_keyframes',
          label: '参考图或关键帧',
          stage: 'production_ready',
          blocking_level: 'blocking',
          reason: 'AI 漫剧进入生产前需要角色或关键画面参考，避免角色和空间漂移。',
          recommended_question: '请补充主角、关键配角或第一场关键帧参考图。',
        }],
        notes: ['production_ready 阶段阻塞。'],
      }],
      recommended_next_questions: ['请补充主角、关键配角或第一场关键帧参考图。'],
    };

    const report = enrichStoryQualityReport({
      story: {
        ...makeStory(),
        production_material_readiness: productionMaterialReadiness,
      },
      qualityReport: makeBaseReport(),
    });

    expect(report.passed).toBe(false);
    expect(report.production_material_readiness_report?.schema_version).toBe('production-material-quality/v1');
    expect(report.production_material_readiness_report?.status).toBe('blocked');
    expect(report.production_material_readiness_report?.missing_blocking_fields.map(field => field.field_id))
      .toContain('reference_images_or_keyframes');
    expect(report.repair_action_items?.some(action => action.target_report === 'production_material')).toBe(true);
    expect(report.repair_actions?.join('\n')).toContain('参考图或关键帧');
    expect(report.repair_preview).toContain('生产素材需补');
  });

  it('recognizes natural action evidence in pattern reports', () => {
    const story: StoryGenerateResult = {
      ...makeStory(),
      video_type: 'character_story',
      presentation_style: 'cinematic',
      original_user_query: '少年周敦颐在长沙橘子洲问莲，雨中帮助孩童，明白守心。',
      logline: '少年周敦颐在橘子洲雨中回身相助。',
      theme: '守心要在浊流里被看见。',
      full_text: [
        '少年周敦颐把此行所求写在书袋内侧：读书不是求一张功名纸，而是要弄清人怎样立身。',
        '官场规则、名声、人情和催客的船夫一起压到眼前。',
        '他若立刻登船，今晚便能赶到驿路；若回身帮人，书卷会湿，行程也会误。',
        '他挽起衣摆踩进泥水，捞起孩童的书篮，把自己的干布包递过去。',
        '这里仍要说清：橘洲问莲是影视化创作，不是《爱莲说》的确证成因。',
      ].join('\n\n'),
      scene_breakdown: [
        {
          scene_id: 1,
          title: '橘洲雨起',
          duration_sec: 20,
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
          duration_sec: 20,
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
          duration_sec: 20,
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
      gears_segments: [],
      characters: [{ name: '周敦颐', role: 'protagonist', description: '北宋少年读书人' }],
      protagonist_arc: [{ starting_state: '远行求学', turning_point: '雨中回身', resolution: '守心上路' }],
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: makeBaseReport(),
    });

    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];
    expect(weakLabels).not.toContain('人物高光选择：目标明确');
    expect(weakLabels).not.toContain('人物高光选择：行动具体');
    expect(weakLabels).not.toContain('历史因果讲述：因果链清楚');
    expect(weakLabels).not.toContain('历史因果讲述：史实边界明确');
    expect(report.audience_text_report?.clean).toBe(true);
  });

  it('recognizes refusal-case evidence as character-story pattern signals', () => {
    const story: StoryGenerateResult = {
      ...makeStory(),
      video_type: 'character_story',
      presentation_style: 'cinematic',
      original_user_query: '生成一个单片人物故事，讲周敦颐面对疑案拒签死刑文书的选择。',
      logline: '周敦颐在疑案前拒绝草草签下死刑文书。',
      theme: '人命面前不能含糊。',
      full_text: [
        '雨夜，南安军衙。一份死刑文书摆在案头，周敦颐翻到案卷最后一页，第一次没有立刻签字。',
        '知军催他签字，说此案早已审结；但周敦颐逐页细读案卷，发现疑点重重，证词前后不合。',
        '签字，囚犯冤死，他保全官位；拒签，得罪上官，可能丢官甚至获罪。',
        '周敦颐说：此案有疑，我不能签字。他交还任命文书，准备辞官。',
        '囚犯因此免死。周敦颐没有赢得权势，却守住了人命面前不能含糊的公道。',
      ].join('\n\n'),
      scene_breakdown: [
        {
          scene_id: 1,
          title: '雨夜案卷',
          duration_sec: 30,
          location: '南安军衙',
          time_of_day: '夜',
          dramatic_function: '钩子开场',
          plot: '雨夜，南安军衙。一份死刑文书摆在案头，周敦颐翻到案卷最后一页，第一次没有立刻签字。',
          key_action: '翻到案卷，停住签笔',
          characters: ['周敦颐'],
          visual_prompt: '南安军衙，案卷，烛火，停住的签笔',
          camera_suggestion: '近景特写',
          cultural_note: '事实边界：可考信息与影视化调度分开。',
          conflict: '人命与官场催签相冲突',
        },
        {
          scene_id: 2,
          title: '知军催签',
          duration_sec: 30,
          location: '南安军衙',
          time_of_day: '白天',
          dramatic_function: '冲突升级',
          plot: '知军催他签字，说此案早已审结；但周敦颐逐页细读案卷，发现疑点重重，证词前后不合。',
          key_action: '逐页细读案卷',
          characters: ['周敦颐', '知军'],
          visual_prompt: '案卷两页并排，知军催签',
          camera_suggestion: '近景对切',
          cultural_note: '史实边界明确。',
          conflict: '此案已定与证据不足相冲突',
        },
        {
          scene_id: 3,
          title: '不能签字',
          duration_sec: 30,
          location: '南安军衙',
          time_of_day: '夜晚',
          dramatic_function: '关键行动',
          plot: '签字，囚犯冤死，他保全官位；拒签，得罪上官，可能丢官甚至获罪。周敦颐说：此案有疑，我不能签字。',
          key_action: '交还任命文书，准备辞官',
          characters: ['周敦颐', '知军'],
          visual_prompt: '未签文书，任命文书，周敦颐抬眼',
          camera_suggestion: '中近景跟拍',
          cultural_note: '影视化创作只强化动作节奏。',
          conflict: '仕途代价与良知选择相冲突',
        },
        {
          scene_id: 4,
          title: '良知守望',
          duration_sec: 30,
          location: '南安军衙',
          time_of_day: '清晨',
          dramatic_function: '结尾',
          plot: '囚犯因此免死。周敦颐没有赢得权势，却守住了人命面前不能含糊的公道。',
          key_action: '退回未签文书',
          characters: ['周敦颐'],
          visual_prompt: '清晨，未签文书推回案头',
          camera_suggestion: '远景拉开',
          cultural_note: '事实边界明确。',
          conflict: '短期权势与长期良知相冲突',
        },
      ],
      gears_segments: [],
      characters: [{ name: '周敦颐', role: 'protagonist', description: '北宋官员' }],
      protagonist_arc: [{ starting_state: '面对催签', turning_point: '拒签并准备辞官', resolution: '守住公道' }],
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: makeBaseReport(),
    });

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];
    expect(weakLabels).not.toContain('人物目标清楚');
    expect(weakLabels).not.toContain('阻力具体');
    expect(weakLabels).not.toContain('选择有代价');
    expect(weakLabels).not.toContain('结尾有人物变化');
    expect(weakLabels).not.toContain('必须有主角目标');
    expect(weakLabels).not.toContain('必须有阻力');
    expect(weakLabels).not.toContain('必须有选择和代价');
  });
});
