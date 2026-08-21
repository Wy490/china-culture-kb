import { describe, expect, it } from 'vitest';
import type { ProductionMaterialReadinessReport, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { buildAdaptationAnalysis } from '../services/adaptation-analysis-service.js';
import { buildGearsDeliveryPackage } from '../services/gears-delivery-service.js';
import { generateDramaticContent } from '../services/dramatic-story.js';
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

function makePublishableStoryWithProductionGap(
  productionMaterialReadiness: ProductionMaterialReadinessReport,
): StoryGenerateResult {
  const base = makeStory();
  return {
    ...base,
    original_user_query: undefined,
    full_text: '少年离开山村进入书院。面对误会，他查清书籍去向并公开证据，最终选择留下继续求学。',
    scene_breakdown: base.scene_breakdown.map((scene, index) => ({
      ...scene,
      plot: [
        '清晨，少年背起书箱离开山村，沿山路走向书院。',
        '午后，师兄误会少年偷书；少年护住书箱，提出一起核对借阅簿。',
        '夜晚，少年找到错放的书和借阅记录，公开证据后决定留在书院。',
      ][index],
      key_action: ['背起书箱踏上山路', '摊开借阅簿逐项核对', '举起借阅记录公开真相'][index],
      characters: index === 1 ? ['少年', '师兄'] : ['少年'],
      visual_prompt: ['山村路口，少年，书箱，晨光', '书院门口，少年与师兄，借阅簿，午后侧光', '书院廊下，少年举起借阅记录，灯笼暖光'][index],
    })),
    gears_segments: [{
      ...base.gears_segments[0],
      script_text: '少年背起书箱离开山村，沿山路走向书院。',
      segment_prompt_hint: '山路清晨，中景跟拍少年背书箱前行。',
    }],
    production_material_readiness: productionMaterialReadiness,
  };
}

describe('quality-workflow-service', () => {
  it('fully covers short focus nodes in a thematic historical outline', () => {
    const story: StoryGenerateResult = {
      ...makeStory(),
      video_type: 'historical_drama',
      original_user_query: '毛泽东少年时期到革命觉醒的故事，重点表现湖南乡土、求学、新民学会、农民运动、理想形成。',
      full_text: '毛泽东从韶山乡土出发求学，参与新民学会，走进农民运动，革命觉醒与理想形成都落实为行动。',
      scene_breakdown: [
        {
          ...makeStory().scene_breakdown[0],
          title: '从韶山到求学',
          plot: '少年毛泽东从湖南韶山乡土出发，选择离乡求学。',
          key_action: '收拾行囊离开韶山',
          characters: ['毛泽东'],
        },
        {
          ...makeStory().scene_breakdown[1],
          title: '新民学会',
          plot: '毛泽东与同伴组织新民学会，把个人求索变成社会行动。',
          key_action: '修改学会章程',
          characters: ['毛泽东', '蔡和森'],
        },
        {
          ...makeStory().scene_breakdown[2],
          title: '农民运动与理想形成',
          plot: '毛泽东走进农民运动，在人民实践中完成革命觉醒与理想形成。',
          key_action: '整理农民运动调查笔记',
          characters: ['毛泽东', '农民协会骨干'],
        },
      ],
    };

    const report = enrichStoryQualityReport({ story, qualityReport: makeBaseReport() });

    expect(report.outline_coverage_report?.coverage_score).toBe(100);
    expect(report.outline_coverage_report?.nodes.map(node => [node.text, node.status])).toEqual([
      ['毛泽东少年时期到革命觉醒', 'covered'],
      ['湖南乡土', 'covered'],
      ['求学', 'covered'],
      ['新民学会', 'covered'],
      ['农民运动', 'covered'],
      ['理想形成', 'covered'],
    ]);
    expect(report.issues.some(issue => issue.includes('大纲覆盖不足'))).toBe(false);
  });

  it('covers instruction-style AI comic outlines across multiple scenes', () => {
    const story: StoryGenerateResult = {
      ...makeStory(),
      original_user_query: '生成一集AI漫剧：周敦颐在疑案前拒签死刑文书，突出前三秒钩子、对白冲突、表情动作和结尾追看钩子。',
      full_text: [
        '雨夜，周敦颐翻开疑难案卷，案卷首页压着死刑文书，只等他画押。',
        '上官催签，周敦颐停住笔：若照旧签字，囚犯可能含冤而死；若坚持重查，他就要得罪上官。',
        '清晨，他推回未签文书，门外又传来证人改口的消息，下一步必须追到现场。',
      ].join('\n\n'),
      scene_breakdown: [
        {
          ...makeStory().scene_breakdown[0],
          title: '疑案停笔',
          plot: '周敦颐翻开疑难案卷，案卷首页压着死刑文书，只等他画押。',
          key_action: '停住笔、翻开案卷',
          visual_prompt: '烛火特写，案卷疑点，镜头推近定格',
        },
        {
          ...makeStory().scene_breakdown[1],
          title: '对白冲突',
          plot: '上官催签，周敦颐拒签死刑文书，坚持重查。',
          key_action: '周敦颐推回判词',
          visual_prompt: '上官推笔，人物表情对切，手部动作特写',
          conflict: '对白冲突',
        },
        {
          ...makeStory().scene_breakdown[2],
          title: '追看钩子',
          plot: '门外又传来证人改口的消息，下一步必须追到现场。',
          key_action: '推回未签文书',
          visual_prompt: '未签文书定格，门外脚步逼近',
        },
      ],
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: makeBaseReport(),
    });

    expect(report.outline_coverage_report?.coverage_score).toBe(100);
    expect(report.outline_coverage_report?.nodes[0].evidence).toEqual(expect.arrayContaining([
      '周敦颐',
      '疑案',
      '死刑文书',
      '拒签',
      '钩子',
    ]));
    expect(report.issues.some(issue => issue.includes('大纲覆盖不足'))).toBe(false);
  });

  it('scores episode-focused serial outlines without requiring meta-only instructions', () => {
    const story: StoryGenerateResult = {
      ...makeStory(),
      original_user_query: [
        '系列《濂溪少年志》第1集《第1集：未签的案卷》',
        '本集只写第1集，不展开其他集。',
        '系列梗概：周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
        '本集目标：90秒左右，约15格。',
        '本集阶段：phase-1：建立主角目标、世界规则和核心问题。',
        '阶段目标：建立主角目标、世界规则和核心问题。',
        '本集开场：用周敦颐的视觉细节开场，让主角第一次碰到“拒签”的问题。',
        '本集主冲突：主角第一次面对“拒签”带来的选择。',
        '中段反转：主角发现“拒签”不是旁观问题，而是必须亲自选择。',
        '人物变化：第1集后，周敦颐对“拒签”的理解推进一层。',
        '结尾钩子：主角得到新信息，也失去一种原本确定的判断。',
        '关键角色：周敦颐、少年。',
        '承接：建立主角初始状态、核心问题和第一条长期线索。',
      ].join('\n'),
      full_text: [
        '雨夜，周敦颐停住笔，案卷首页压着未签文书，只等他画押。',
        '若照旧签字，囚犯可能含冤而死；若坚持重查，他就要得罪上官。',
        '少年站在门外看见他推回判词，第一次明白拒签不是旁观问题。',
        '门外又传来证人改口的消息，下一步必须追到现场。',
      ].join('\n\n'),
      scene_breakdown: [
        {
          ...makeStory().scene_breakdown[0],
          title: '未签案卷',
          plot: '周敦颐停住笔，案卷首页压着未签文书，只等他画押。',
          key_action: '停住笔、翻开案卷',
          characters: ['周敦颐', '少年'],
          visual_prompt: '县衙雨夜，未签文书，烛火，少年门外侧影',
        },
        {
          ...makeStory().scene_breakdown[1],
          title: '拒签选择',
          plot: '若照旧签字，囚犯可能含冤而死；若坚持重查，他就要得罪上官。',
          key_action: '推回判词',
          characters: ['周敦颐', '上官', '少年'],
          visual_prompt: '上官推笔，周敦颐按住案卷，少年屏息',
        },
        {
          ...makeStory().scene_breakdown[2],
          title: '证人改口',
          plot: '少年站在门外看见他推回判词，门外又传来证人改口的消息，下一步必须追到现场。',
          key_action: '追向现场',
          characters: ['周敦颐', '少年', '证人'],
          visual_prompt: '清晨县衙门口，证人回头，未签文书定格',
        },
      ],
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: makeBaseReport(),
    });

    expect(report.outline_coverage_report?.nodes.some(node => node.text.includes('本集只写'))).toBe(false);
    expect(report.outline_coverage_report?.nodes.some(node => node.text.includes('90秒'))).toBe(false);
    expect(report.outline_coverage_report?.nodes.some(node => node.text.includes('phase-1'))).toBe(false);
    expect(report.outline_coverage_report?.coverage_score).toBeGreaterThanOrEqual(70);
    expect(report.issues.some(issue => issue.includes('大纲覆盖不足'))).toBe(false);
  });

  it('does not score production constraints as story outline nodes', () => {
    const report = enrichStoryQualityReport({
      story: {
        ...makeStory(),
        original_user_query: [
          '围绕“少年求学”制作三分钟版本。',
          '开场必须尽快建立可见问题，中段至少包含一次选择或证据推进，结尾回到当代观众能够理解的具体意义。',
          '所有历史、人物、技艺、机构和地貌表达都服从知识条目边界；无法确认的细节使用克制画面，不写成确定事实。',
          '镜头需要有稳定人物或空间锚点、可见动作、连续道具和清楚光线，避免抽象口号、模板化解说与无关现代物件。',
        ].join(''),
      },
      qualityReport: makeBaseReport(),
    });

    expect(report.outline_coverage_report).toMatchObject({
      coverage_score: 100,
      total_nodes: 0,
      missing_nodes: 0,
    });
    expect(report.issues.some(issue => issue.includes('大纲覆盖不足'))).toBe(false);
  });

  it('does not score compact-video instructions as story outline nodes', () => {
    const report = enrichStoryQualityReport({
      story: {
        ...makeStory(),
        original_user_query: [
          '把“少年求学”压缩为三十秒版本。',
          '前三秒给出一个可见钩子，只保留一个核心知识点或品牌承诺；每个镜头只承担一个动作或信息。',
          '结尾用具体画面收束，不使用空泛口号；保持文化事实、工艺步骤、机构表达与地貌类型准确。',
        ].join(''),
      },
      qualityReport: makeBaseReport(),
    });

    expect(report.outline_coverage_report).toMatchObject({
      coverage_score: 100,
      total_nodes: 0,
      missing_nodes: 0,
    });
    expect(report.issues.some(issue => issue.includes('大纲覆盖不足'))).toBe(false);
  });

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
    expect(report.pattern_quality_report?.schema_version).toBe('pattern-quality/v2');
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

  it('allows audience-facing why questions in visual generation prompts', () => {
    const base = makeStory();
    const story: StoryGenerateResult = {
      ...base,
      gears_segments: base.gears_segments.map(segment => ({
        ...segment,
        script_text: '湘绣工坊里，绣工举起一根丝线，镜头贴近丝线分股与针尖穿行的动作。',
        segment_prompt_hint: '湘绣工坊，绣工举起丝线，动作：一根湘绣丝线为什么要劈成多股',
      })),
    };

    const report = enrichStoryQualityReport({ story, qualityReport: makeBaseReport() });

    expect(report.gears_readiness_report?.prompt_gaps.join('\n'))
      .not.toContain('生成提示含说明性内容');
  });

  it('does not require character assets for a character-free landscape delivery', () => {
    const base = makeStory();
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'landscape_mood',
      presentation_style: 'ink_style',
      characters: [],
      scene_breakdown: base.scene_breakdown.map(scene => ({
        ...scene,
        plot: `${scene.plot} 云海沿峰林移动，山风和光线形成可见的时序变化。`,
        key_action: '云海移动并显露峰林层次',
        characters: [],
        visual_prompt: '张家界峰林，清晨云海，山风，远景长镜头，水墨层次',
      })),
    };

    const report = enrichStoryQualityReport({ story, qualityReport: makeBaseReport() });

    expect(report.gears_readiness_report?.asset_gaps.join('\n')).not.toMatch(/角色资产|角色列表/);
  });

  it('accepts concise landscape prose when the visual unit still has executable natural motion', () => {
    const base = makeStory();
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'landscape_mood',
      presentation_style: 'ink_style',
      characters: [],
      full_text: '雾中，峰脊醒来。\n\n云移开，风声退下。\n\n余味留给观看的人。',
      scene_breakdown: base.scene_breakdown.map((scene, index) => ({
        ...scene,
        plot: ['雾中，峰脊醒来。', '晨光、雨雾掠过峰谷。', '云移开，风声退下。'][index],
        key_action: ['薄雾沿石壁上升并露出峰脊', '云影掠过峰壁并改变明暗层次', '风声退下，镜头停在远峰留白'][index],
        characters: [],
        visual_prompt: ['清晨薄雾沿峰壁上升，峰脊从遮蔽中显露', '侧光与雨雾依次掠过峰谷，溪面反光变化', '远峰剪影，大面积暮色留白，风吹草叶'][index],
        camera_suggestion: '固定长镜头，等待自然状态在画面内部变化',
      })),
    };

    const report = enrichStoryQualityReport({ story, qualityReport: makeBaseReport() });

    expect(report.gears_readiness_report?.unit_gaps.join('\n')).not.toContain('剧情过薄');
  });

  it('reports audience-facing quality labels as repairable pollution', () => {
    const story = {
      ...makeStory(),
      logline: '永州→道县（籍贯/出生地）；衡阳（少年成长地），一纸判词逼出选择。',
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
      '籍贯/出生地',
      '少年成长地',
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

  it('separates a publishable story from production readiness when reference assets are missing', () => {
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
        reason: '进入生产前需要真实参考图。',
        recommended_question: '请补充主角和第一场关键帧参考图。',
      }],
      gate_reports: [],
      recommended_next_questions: ['请补充主角和第一场关键帧参考图。'],
    };

    const report = enrichStoryQualityReport({
      story: makePublishableStoryWithProductionGap(productionMaterialReadiness),
      qualityReport: { ...makeBaseReport(), genre_score: 100 },
    });

    expect(report.passed).toBe(false);
    expect(report.quality_gates?.schema_version).toBe('quality-gates/v2');
    expect(report.quality_gates?.story_publishable).toBe(true);
    expect(report.quality_gates?.production_ready).toBe(false);
    expect(report.quality_gates?.narrative_gate.status).toBe('passed');
    expect(report.quality_gates?.outline_gate.status).toBe('passed');
    expect(report.quality_gates?.audience_text_gate.status).toBe('passed');
    expect(report.quality_gates?.production_material_gate.status).toBe('failed');
    expect(report.quality_gates?.asset_gate.status).toBe('not_evaluated');
    expect(report.quality_gates?.external_provider_gate.status).toBe('not_evaluated');
    expect(report.quality_gates?.story_blocking_gate_ids).toEqual([]);
    expect(report.quality_gates?.production_blocking_gate_ids).toContain('production_material_gate');
  });

  it('does not double-count production material reminders as GEARS contract failures', () => {
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
        reason: '进入生产前需要真实参考图。',
        recommended_question: '请补充主角和第一场关键帧参考图。',
      }],
      gate_reports: [],
      recommended_next_questions: ['请补充主角和第一场关键帧参考图。'],
    };
    const storyWithGap = makePublishableStoryWithProductionGap(productionMaterialReadiness);
    const storyWithoutGap = {
      ...storyWithGap,
      production_material_readiness: undefined,
    };
    const deliveryWithGap = buildGearsDeliveryPackage(storyWithGap);
    const deliveryWithoutGap = buildGearsDeliveryPackage(storyWithoutGap);

    expect(deliveryWithGap.validation_notes.join('\n')).toContain('生产素材未达 production_ready');

    const withGap = enrichStoryQualityReport({
      story: storyWithGap,
      qualityReport: { ...makeBaseReport(), genre_score: 100 },
      gearsDelivery: deliveryWithGap,
    });
    const withoutGap = enrichStoryQualityReport({
      story: storyWithoutGap,
      qualityReport: { ...makeBaseReport(), genre_score: 100 },
      gearsDelivery: deliveryWithoutGap,
    });

    expect(withGap.gears_readiness_report?.readiness_score)
      .toBe(withoutGap.gears_readiness_report?.readiness_score);
    expect(withGap.gears_readiness_report?.issue_items.join('\n'))
      .not.toContain('生产素材');
    expect(withGap.repair_action_items?.filter(action => action.target_report === 'production_material'))
      .toHaveLength(1);
  });

  it('does not let a legacy production failure poison the story gate during read-time enrichment', () => {
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
        reason: '进入生产前需要真实参考图。',
        recommended_question: '请补充主角和第一场关键帧参考图。',
      }],
      gate_reports: [],
      recommended_next_questions: ['请补充主角和第一场关键帧参考图。'],
    };
    const story = makePublishableStoryWithProductionGap(productionMaterialReadiness);
    const firstReport = enrichStoryQualityReport({
      story,
      qualityReport: { ...makeBaseReport(), genre_score: 100 },
    });

    const readTimeReport = enrichStoryQualityReport({ story, qualityReport: firstReport });

    expect(firstReport.passed).toBe(false);
    expect(readTimeReport.passed).toBe(false);
    expect(readTimeReport.quality_gates?.story_publishable).toBe(true);
    expect(readTimeReport.quality_gates?.narrative_gate.status).toBe('passed');
  });

  it('blocks story publication when the factual and cultural safety gate fails', () => {
    const story: StoryGenerateResult = {
      ...makePublishableStoryWithProductionGap({
        schema_version: 'production-material-readiness/v1',
        video_type: 'ai_comic_drama',
        pack_label: 'AI 漫剧单片',
        score: 100,
        status: 'ready',
        available_fields: ['core_conflict', 'reference_images_or_keyframes'],
        missing_fields: [],
        gate_reports: [],
        recommended_next_questions: [],
      }),
      domain_safety: {
        schema_version: 'story-domain-safety/v1',
        domain: 'china_culture',
        passed: false,
        evaluated_rule_ids: ['verified-fact-boundary'],
        blockers: [{
          rule_id: 'verified-fact-boundary',
          severity: 'blocker',
          message: '把虚构桥段写成已核实史实。',
        }],
        warnings: [],
        machine_validation_only: true,
        human_review_complete: false,
        real_credit_granted: false,
      },
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: { ...makeBaseReport(), genre_score: 100 },
    });

    expect(report.quality_gates?.factual_cultural_gate.status).toBe('failed');
    expect(report.quality_gates?.factual_cultural_gate.issues).toContain('把虚构桥段写成已核实史实。');
    expect(report.quality_gates?.story_publishable).toBe(false);
    expect(report.quality_gates?.story_blocking_gate_ids).toContain('factual_cultural_gate');
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
    const actionSignal = report.pattern_quality_report?.satisfied_signals
      .find(signal => signal.label === '人物高光选择：行动具体');
    expect(actionSignal?.evidence_scene_ids).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(actionSignal?.observable_evidence[0]).toContain('场景');
    expect(actionSignal?.counter_evidence).toEqual([]);
    expect(actionSignal?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(actionSignal?.repair_target.fields).toContain('key_action');
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

  it('recognizes observable landmark, daily-life, and regional-brand evidence in city promos', () => {
    const base = makeStory();
    const cityScenes = [
      {
        plot: '清晨，镜头越过岳麓山麓，沿岳麓书院中轴推进，晨读声从讲堂传到庭院。',
        key_action: '游客循着书院中轴走过赫曦台、讲堂与御书楼',
        visual_prompt: '长沙岳麓书院，赫曦台、讲堂、御书楼，晨光中的游人与晨读学生',
        camera_suggestion: '航拍落到书院匾额，再沿中轴稳定推进',
      },
      {
        plot: '午后，讲解员在朱张会讲旧址前停下，游人抬头辨认“惟楚有材，于斯为盛”的楹联。',
        key_action: '讲解员指向楹联，学生记录湖湘文脉',
        visual_prompt: '朱张会讲旧址、书院楹联、记录笔记的学生，午后侧光',
        camera_suggestion: '楹联特写转向学生笔记',
      },
      {
        plot: '傍晚，书院外的街巷渐热，早餐摊收起蒸笼，散步的人沿湘江走向橘子洲，城市生活接住千年文脉。',
        key_action: '摊主收起蒸笼，市民从岳麓山下步行到湘江边',
        visual_prompt: '长沙街巷、早餐摊、湘江与橘子洲，散步市民，傍晚灯火',
        camera_suggestion: '跟随人群从街巷移动到湘江岸边',
      },
      {
        plot: '夜色里，岳麓书院的檐影与长沙灯火同框：惟楚有材，不只是一块匾额，也是这座城仍在生长的求知气质。',
        key_action: '书院匾额与城市灯火叠化定格',
        visual_prompt: '岳麓书院檐影、长沙夜景、惟楚有材匾额，同框定格',
        camera_suggestion: '匾额近景叠化为长沙夜景',
      },
    ];
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'city_brand_promo',
      presentation_style: 'voiceover_montage',
      title: '从岳麓书院读懂长沙',
      logline: '沿一日路线走过岳麓书院与湘江街巷，看湖湘文脉怎样活在长沙人的日常里。',
      theme: '千年文脉与当代生活共同塑造长沙的求知气质。',
      full_text: cityScenes.map(scene => scene.plot).join('\n\n'),
      scene_breakdown: cityScenes.map((scene, index) => ({
        ...base.scene_breakdown[index % base.scene_breakdown.length],
        ...scene,
        scene_id: index + 1,
        title: ['地标晨读', '文脉午后', '街巷傍晚', '城市夜色'][index],
        location: ['岳麓书院', '朱张会讲旧址', '长沙街巷', '岳麓书院'][index],
        time_of_day: ['清晨', '午后', '傍晚', '夜晚'][index],
        dramatic_function: ['地标引入', '历史底蕴', '生活气息', '品牌定格'][index],
        characters: [],
      })),
      gears_segments: [],
      characters: [],
      protagonist_arc: [],
      core_message: '岳麓书院的千年文脉仍在长沙日常中生长。',
      slogan_or_key_sentence: '惟楚有材，长沙仍在生长。',
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: { ...makeBaseReport(), genre_score: 88 },
    });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '城市一日旅程：地方名词充足',
      '城市一日旅程：生活气息可见',
      '城市一日旅程：品牌句有地域性',
      '地标清楚',
      '生活气息充足',
      '品牌句有地方感',
      '必须有地标识别',
      '必须有城市气质',
      '必须有生活场景',
    ]));
  });

  it('recognizes a continuous functional route and atmospheric ending in scene shorts', () => {
    const base = makeStory();
    const plots = [
      '镜头从岳麓书院正门进入，沿中轴走向讲堂，先确认千年书院的空间身份。',
      '脚步经过赫曦台抵达讲堂，楹联与晨读声说明这里至今仍承担讲学功能。',
      '路线继续到御书楼，旧藏书空间与今天记录笔记的学生形成时间叠印。',
      '镜头从御书楼回望庭院，脚步停下，只留风穿树影和渐远人声。',
    ];
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'scene_short',
      presentation_style: 'voiceover_montage',
      full_text: plots.join('\n\n'),
      scene_breakdown: plots.map((plot, index) => ({
        ...base.scene_breakdown[index % 3],
        scene_id: index + 1,
        location: ['岳麓书院正门', '赫曦台与讲堂', '御书楼', '岳麓书院庭院'][index],
        plot,
        key_action: ['跨过门槛进入中轴', '沿中轴从赫曦台走到讲堂', '从讲堂继续走到御书楼', '停步回望庭院'][index],
        visual_prompt: ['岳麓书院正门与中轴', '赫曦台、讲堂楹联、晨读学生', '御书楼、藏书与学生笔记', '庭院远景、风动树影、空石阶'][index],
        camera_suggestion: index === 3 ? '远景固定长镜头，保留环境声与空镜留白' : '稳定跟拍，保持行进方向连续',
        characters: [],
      })),
      gears_segments: [],
      characters: [],
      protagonist_arc: [],
    };
    const report = enrichStoryQualityReport({ story, qualityReport: { ...makeBaseReport(), genre_score: 88 } });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '空间导览：节点有功能', '空间导览：氛围收束', '空间身份明确', '视觉路线完整',
      '时间层存在', '氛围收束', '必须有空间身份', '必须有视觉路线', '必须有氛围结尾',
    ]));
  });

  it('recognizes position-bound hook, dense information, subtitles, and payoff in social shorts', () => {
    const base = makeStory();
    const plots = [
      '一根湘绣丝线为什么要劈成多股？答案先藏在针尖前这个反常细节里。',
      '先看材料怎样变细，再看手怎样劈丝，最后看成品纹理为什么更有层次，三个信息依次出现。',
      '粗丝在指间分开，穿过针眼，针脚从厚重变得细密。',
      '“以针代笔、以线代色”。绣工把细丝与成品并排举起，开头的问题在这个动作里得到答案。',
    ];
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'social_short',
      presentation_style: 'social_media_fastcut',
      full_text: plots.join('\n\n'),
      scene_breakdown: plots.map((plot, index) => ({
        ...base.scene_breakdown[index % 3],
        scene_id: index + 1,
        title: ['3秒开场', '三个信息', '动作兑现', '金句定格'][index],
        dramatic_function: ['3秒钩子', '关键信息', '情绪推进', '金句落点'][index],
        plot,
        key_action: ['针尖前举起一根未劈开的丝线', '依次展示材料、手法和成品差别', '劈丝、穿针、落针', '将细丝与成品并排举起'][index],
        visual_prompt: ['湘绣丝线与针尖超近景', '材料、手部动作、成品纹理三联快切', '手指劈丝与针脚微距', '细丝和绣面同框定格'][index],
        camera_suggestion: ['前三秒冲击特写', '快切画面加三条短字幕', '微距节奏蒙太奇', '定格画面加金句文字'][index],
        characters: [],
      })),
      gears_segments: [],
      characters: [],
      protagonist_arc: [],
      slogan_or_key_sentence: '以针代笔、以线代色',
    };
    const report = enrichStoryQualityReport({ story, qualityReport: { ...makeBaseReport(), genre_score: 91 } });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '社交反差钩子：信息密度高', '社交反差钩子：字幕感明确', '前 3 秒有钩子',
      '信息点集中', '字幕感强', '结尾可记住', '开头必须有钩子',
      '必须有三类信息点或一个强记忆点', '不得铺垫过长',
    ]));
  });

  it('recognizes measurable objectives, ordered steps, practice, assessment, and recap in training videos', () => {
    const base = makeStory();
    const plots = [
      '学完本节，能够说出岳麓书院的三个历史层次，并为每层各举一个现场例子。',
      '第一步辨认可见实物，第二步核对历史事件，第三步说明今天怎样使用。',
      '示范：从讲堂楹联出发，找到朱张会讲的事件记录，再回到今天的书院现场。',
      '请制作三张卡片，分别写下实物、事件与当代使用，并说明三者为何不能混为同一时代。',
      '看到讲堂、朱张会讲与晨读学生时，逐项判断它属于地点、事件还是当代使用。',
      '复盘清单：先辨实物，再核事件，最后讨论当代意义；对照三张卡片检查答案。',
    ];
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'education_training',
      presentation_style: 'host_narration',
      full_text: plots.join('\n\n'),
      scene_breakdown: plots.map((plot, index) => ({
        ...base.scene_breakdown[index % 3],
        scene_id: index + 1,
        title: ['学习目标', '分步讲解', '操作展示', '主动练习', '知识检验', '复盘清单'][index],
        dramatic_function: ['学习目标', '知识讲授', '示范演示', '练习引导', '检验反馈', '总结拓展'][index],
        plot,
        key_action: ['展示三层目标卡', '依次翻开三张步骤卡', '指向楹联、事件记录和现场', '学习者填写并排列三张卡片', '逐项选择分类并核对', '勾选三项复盘清单'][index],
        visual_prompt: ['三层学习目标字幕', '第一第二第三步骤图示', '讲堂楹联与事件记录对照', '学习者填写三张练习卡', '地点事件当代使用三类反馈', '复盘清单逐项打勾'][index],
        camera_suggestion: '主讲人与步骤字幕交替，操作过程清楚可见',
        characters: ['主讲人', '学习者'],
      })),
      gears_segments: [],
      characters: [],
      protagonist_arc: [],
    };
    const report = enrichStoryQualityReport({ story, qualityReport: { ...makeBaseReport(), genre_score: 97 } });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '教学闭环：练习存在', '教学闭环：复盘清楚', '学习目标具体', '步骤完整',
      '练习存在', '复盘清楚', '必须有学习目标', '必须有步骤', '必须有复盘或练习',
    ]));
  });

  it('recognizes a question, concept hierarchy, analogy, example, and recap in explainers', () => {
    const base = makeStory();
    const plots = [
      '石英砂岩峰林为什么会长成一根根石柱？先看岩层、裂隙和流水怎样共同作用。',
      '先认清三个概念：第一是水平岩层，第二是垂直裂隙，第三是沿裂隙切割的流水。可以把岩层看作叠放的书页，把裂隙看作书页上的切口。',
      '以武陵源的一道岩壁为例：雨水沿垂直裂隙下切，两侧松散岩块脱落，较坚硬部分逐渐独立成峰柱。',
      '峰柱不是一次被雕成的，也不只由流水决定；岩层、裂隙、风化与漫长时间缺一不可。',
      '最后记住三个要点：先有岩层，再由裂隙分块，最后由流水和风化持续切割。',
    ];
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'explainer_video',
      presentation_style: 'host_narration',
      full_text: plots.join('\n\n'),
      scene_breakdown: plots.map((plot, index) => ({
        ...base.scene_breakdown[index % 3],
        scene_id: index + 1,
        title: ['提出问题', '概念解释', '实例论证', '澄清误区', '要点重述'][index],
        dramatic_function: ['提出问题', '概念解释', '实例论证', '逻辑深化', '总结归纳'][index],
        plot,
        key_action: ['指向完整峰壁提出问题', '依次展开岩层、裂隙和流水三张图卡', '在岩壁图上标出裂隙和脱落区', '划掉一次雕成的错误答案', '依次点亮三项总结字幕'][index],
        visual_prompt: ['武陵源峰壁与问题字幕', '岩层书页类比图、裂隙切口图和流水箭头', '真实岩壁局部与裂隙切割示意叠加', '错误答案与四因素对照图', '岩层、裂隙、流水风化三项总结卡'][index],
        camera_suggestion: '主持人与局部放大图交替，关键词字幕逐项出现',
        characters: ['主讲人'],
      })),
      gears_segments: [],
      characters: [],
      protagonist_arc: [],
    };
    const report = enrichStoryQualityReport({ story, qualityReport: { ...makeBaseReport(), genre_score: 91 } });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '认知缺口讲解：问题明确', '认知缺口讲解：层级清楚', '认知缺口讲解：例子有效',
      '认知缺口讲解：总结可记住', '核心问题明确', '层级清楚', '例子有效',
      '总结可复盘', '必须有核心问题', '必须有知识层级', '必须有例子或类比',
    ]));
  });

  it('recognizes a claim, factual case, analysis, present-day connection, and action in lectures', () => {
    const base = makeStory();
    const plots = [
      '核心观点：朱张会讲说明，开放治学不是没有标准，而是允许分歧并要求以证据完成讨论。',
      '先看可考案例：1167年，朱熹到岳麓书院与张栻会讲；书院现场与相关记载共同留下这场学术交流的线索。',
      '这个案例首先体现开放讨论，其次强调求真检验，最后把一次对话变成后来者继续思考的起点。',
      '今天，这种精神仍能落到课堂讨论、学术交流和公共学习中：允许不同答案，也要求查证依据并修正判断。',
      '把开放变成愿意倾听，把求真变成查证依据；下一次讨论时，先听完不同意见，再拿出自己的证据。',
    ];
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'lecture_video',
      presentation_style: 'host_narration',
      full_text: plots.join('\n\n'),
      scene_breakdown: plots.map((plot, index) => ({
        ...base.scene_breakdown[index % 3],
        scene_id: index + 1,
        title: ['提出主题', '事实案例', '精神分析', '现实映射', '行动号召'][index],
        dramatic_function: ['提出主题', '讲述事实', '分析精神', '联系当下', '总结号召'][index],
        plot,
        key_action: ['亮出核心观点卡', '指向年代、人物和会讲地点三项证据', '依次展开开放、求真、传承三张卡', '切到课堂讨论和公共学习现场', '观众写下证据并举手发言'][index],
        visual_prompt: ['岳麓书院讲堂与核心观点字幕', '1167年时间卡、朱熹张栻人物卡和书院现场', '开放求真传承三项分析字幕', '课堂、学术交流与公共学习三联画面', '倾听、查证、发言三步行动字幕'][index],
        camera_suggestion: '主讲人、案例资料和现实行动画面交替',
        characters: ['主讲人'],
      })),
      gears_segments: [],
      characters: [],
      protagonist_arc: [],
    };
    const report = enrichStoryQualityReport({ story, qualityReport: { ...makeBaseReport(), genre_score: 91 } });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '案例论证宣讲：观点明确', '案例论证宣讲：案例支撑', '案例论证宣讲：现实连接',
      '中心观点明确', '论据充分', '现实连接清楚', '结尾有力量',
      '必须有中心观点', '必须有例证', '必须有现实连接',
    ]));
  });

  it('recognizes natural motion, changing light, sparse narration, and a held landscape ending', () => {
    const base = makeStory();
    const plots = [
      '清晨，峰脊从雾里露出。水汽沿石壁上升，风、滴水和鸟鸣一点点唤醒山谷。',
      '晨光擦亮峰壁，雨雾随后吞没半座山林，暮色又把溪谷拉深。',
      '云从峰间移开，最远的一根石柱重新出现；风声退下去，余味留给观看的人。',
    ];
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'landscape_mood',
      presentation_style: 'ink_style',
      full_text: plots.join('\n\n'),
      scene_breakdown: plots.map((plot, index) => ({
        ...base.scene_breakdown[index],
        scene_id: index + 1,
        title: ['山水开卷', '四季流转', '山水余韵'][index],
        dramatic_function: ['山水开卷', '意境流变', '灵韵定格'][index],
        plot,
        key_action: ['薄雾上升并露出峰脊', '晨光、雨雾和暮色依次改变峰谷', '云移开后风声渐退'][index],
        visual_prompt: ['薄雾沿峰壁上升，峰脊显露', '晨光、雨雾、暮色依次掠过峰谷', '远峰、空谷、云层移开，大面积暮色留白'][index],
        camera_suggestion: ['远景缓推，保留环境声', '固定长镜头观察自然状态变化', '远景固定，声音渐退，停留五秒'][index],
        characters: [],
        dialogue_or_narration: undefined,
      })),
      gears_segments: [],
      characters: [],
      protagonist_arc: [],
    };
    const report = enrichStoryQualityReport({ story, qualityReport: { ...makeBaseReport(), genre_score: 91 } });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '诗性山水：自然意象突出', '诗性山水：旁白低密度', '诗性山水：光影季节明确',
      '诗性山水：留白成立', '自然意象突出', '光影季节明确', '旁白低密度',
      '留白感成立', '必须有自然意象', '必须有光影季节', '旁白不可过密',
    ]));
  });

  it('does not award landscape mood from poetic labels without natural state changes or silence', () => {
    const base = makeStory();
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'landscape_mood',
      presentation_style: 'ink_style',
      full_text: '山水开卷。四季流转。诗意留白。',
      scene_breakdown: base.scene_breakdown.map((scene, index) => ({
        ...scene,
        scene_id: index + 1,
        title: ['山水开卷', '四季流转', '诗意留白'][index],
        dramatic_function: ['山水开卷', '意境流变', '灵韵定格'][index],
        plot: ['这里介绍景区背景。', '讲解员继续介绍相关知识。', '最后进行诗意总结。'][index],
        key_action: '讲解员继续介绍',
        visual_prompt: '讲解员固定中景，背景墙',
        camera_suggestion: '固定镜头',
        characters: ['讲解员'],
        dialogue_or_narration: '这里继续介绍相关内容和背景知识。',
      })),
      gears_segments: [],
    };
    const report = enrichStoryQualityReport({ story, qualityReport: makeBaseReport() });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(weakLabels).toEqual(expect.arrayContaining([
      '自然意象突出', '光影季节明确', '旁白低密度', '留白感成立',
      '必须有自然意象', '必须有光影季节', '旁白不可过密',
    ]));
  });

  it('recognizes simple language, gentle stakes, causal learning, and a warm visible ending in children stories', () => {
    const base = makeStory();
    const plots = [
      '小刘海在山路上丢了柴绳。胡大姐停下来，帮他把散落的木柴一根根捆好。',
      '别人劝小刘海不要相信陌生人。他有点害怕，却决定先听胡大姐把话说完。',
      '小刘海看见胡大姐没有拿走木柴，还把最后一根柴放回担子。他明白，判断一个人要看行动。',
      '于是，小刘海先核对柴担，再向胡大姐道谢。误会解开了，两个人一起把柴送回家。',
      '家门口亮起暖灯。他们放下柴担，笑着约好明天再走这条山路。',
    ];
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'children_story',
      presentation_style: 'animation_2d',
      full_text: plots.join('\n\n'),
      scene_breakdown: plots.map((plot, index) => ({
        ...base.scene_breakdown[index % 3],
        scene_id: index + 1,
        title: ['柴绳散开', '陌生人的疑问', '看见善意', '解开误会', '暖灯下回家'][index],
        dramatic_function: ['小主人公', '遇到问题', '学习成长', '做出选择', '温暖结尾'][index],
        plot,
        key_action: ['捡起柴绳并重新捆柴', '停下脚步听完说明', '检查柴担和最后一根木柴', '核对柴担后一起抬起', '在暖灯下放下柴担并挥手'][index],
        conflict: ['柴绳断开，木柴散落', '旁人的怀疑与亲眼行动不一致', '害怕与观察到的善意冲突', '选择核实而不是赶走对方', '误会解除，伙伴安全回家'][index],
        visual_prompt: ['山路、柴绳、散落木柴、两双手', '小刘海停步，旁人摇头，胡大姐安静等待', '柴担、最后一根木柴和小刘海观察的眼睛', '两人一起抬起柴担走向家门', '暖灯、柴担、挥手告别，暖色远景'][index],
        camera_suggestion: '明亮中景与手部动作特写交替，表情清楚',
        characters: ['小刘海', '胡大姐'],
        dialogue_or_narration: undefined,
      })),
      gears_segments: [],
      characters: [],
      protagonist_arc: [],
    };
    const report = enrichStoryQualityReport({ story, qualityReport: { ...makeBaseReport(), genre_score: 91 } });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(report.pattern_quality_report?.pattern_score).toBeGreaterThanOrEqual(70);
    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '儿童寓言：语言简单', '儿童寓言：冲突温和', '儿童寓言：结尾正向',
      '语言简单', '冲突温和', '因果清楚', '结尾正向',
      '语言必须简单', '结尾必须温暖',
    ]));
  });

  it('does not award children-story quality from labels, cruelty, slogans, or an unseen resolution', () => {
    const base = makeStory();
    const story: StoryGenerateResult = {
      ...base,
      video_type: 'children_story',
      presentation_style: 'animation_2d',
      full_text: '儿童故事。冲突温和。结尾温暖。',
      scene_breakdown: base.scene_breakdown.map((scene, index) => ({
        ...scene,
        scene_id: index + 1,
        title: ['小主人公', '温和冲突', '温暖结尾'][index],
        dramatic_function: ['小主人公', '遇到问题', '温暖结尾'][index],
        plot: [
          '这里介绍一个小主人公和复杂的相关背景内容。',
          '坏人狠狠殴打小动物，大家都非常害怕。',
          '最后旁白说要善良，事情已经解决了。',
        ][index],
        key_action: ['介绍背景', '暴力攻击', '旁白总结'][index],
        conflict: ['一般问题', '残酷暴力', '没有行动后果'][index],
        visual_prompt: ['固定背景墙', '攻击画面', '黑屏文字：善良'][index],
        camera_suggestion: '固定镜头',
        characters: ['讲解员'],
        dialogue_or_narration: '这里继续解释复杂背景和抽象道理。',
      })),
      gears_segments: [],
    };
    const report = enrichStoryQualityReport({ story, qualityReport: makeBaseReport() });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(weakLabels).toEqual(expect.arrayContaining([
      '语言简单', '冲突温和', '因果清楚', '结尾正向', '语言必须简单', '结尾必须温暖',
    ]));
  });

  it('does not award explainer or lecture structure from empty functional labels', () => {
    const base = makeStory();
    const explainer = {
      ...base,
      video_type: 'explainer_video' as const,
      scene_breakdown: base.scene_breakdown.map((scene, index) => ({
        ...scene,
        scene_id: index + 1,
        title: ['提出问题', '实例论证', '总结归纳'][index],
        dramatic_function: ['提出问题', '实例论证', '总结归纳'][index],
        plot: ['这里提出相关内容。', '这里提供相关内容。', '这里总结相关内容。'][index],
        key_action: '主讲人继续介绍',
        visual_prompt: '主讲人固定中景',
        camera_suggestion: '固定镜头',
      })),
      gears_segments: [],
    };
    const lecture = {
      ...base,
      video_type: 'lecture_video' as const,
      scene_breakdown: base.scene_breakdown.map((scene, index) => ({
        ...scene,
        scene_id: index + 1,
        title: ['提出主题', '案例支撑', '现实连接'][index],
        dramatic_function: ['提出主题', '讲述事实', '联系当下'][index],
        plot: ['这里提出观点。', '这里介绍案例。', '这对今天很重要。'][index],
        key_action: '主讲人继续介绍',
        visual_prompt: '主讲人固定中景',
        camera_suggestion: '固定镜头',
      })),
      gears_segments: [],
    };

    const explainerReport = enrichStoryQualityReport({ story: explainer, qualityReport: makeBaseReport() });
    const lectureReport = enrichStoryQualityReport({ story: lecture, qualityReport: makeBaseReport() });
    const explainerWeak = explainerReport.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];
    const lectureWeak = lectureReport.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(explainerWeak).toEqual(expect.arrayContaining([
      '核心问题明确', '层级清楚', '例子有效', '总结可复盘',
    ]));
    expect(lectureWeak).toEqual(expect.arrayContaining([
      '中心观点明确', '论据充分', '现实连接清楚',
    ]));
  });

  it('does not award social or training structure from misplaced hooks and empty labels', () => {
    const base = makeStory();
    const social = {
      ...base,
      video_type: 'social_short' as const,
      presentation_style: 'social_media_fastcut' as const,
      scene_breakdown: base.scene_breakdown.map((scene, index) => ({
        ...scene,
        scene_id: index + 1,
        dramatic_function: index === 1 ? '3秒钩子' : '背景介绍',
        plot: index === 1 ? '为什么会这样？答案藏在反常细节里。' : '继续介绍相关背景。',
        visual_prompt: index === 1 ? '反常细节特写' : '一般背景画面',
        camera_suggestion: index === 1 ? '冲击特写' : '固定中景',
      })),
      gears_segments: [],
    };
    const training = {
      ...base,
      video_type: 'education_training' as const,
      presentation_style: 'host_narration' as const,
      scene_breakdown: base.scene_breakdown.map((scene, index) => ({
        ...scene,
        scene_id: index + 1,
        title: ['学习目标', '练习', '复盘'][index],
        dramatic_function: ['学习目标', '练习引导', '总结拓展'][index],
        plot: ['本节介绍相关背景。', '这里是练习环节。', '这里进行复盘。'][index],
        key_action: '主讲人继续介绍',
        visual_prompt: '主讲人固定中景',
        camera_suggestion: '固定镜头',
      })),
      gears_segments: [],
    };

    const socialReport = enrichStoryQualityReport({
      story: social,
      qualityReport: { ...makeBaseReport(), genre_score: 91 },
    });
    const trainingReport = enrichStoryQualityReport({
      story: training,
      qualityReport: { ...makeBaseReport(), genre_score: 97 },
    });
    const socialWeak = socialReport.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];
    const trainingWeak = trainingReport.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];

    expect(socialWeak).toEqual(expect.arrayContaining(['前 3 秒有钩子', '开头必须有钩子']));
    expect(trainingWeak).toEqual(expect.arrayContaining([
      '学习目标具体', '练习存在', '复盘清楚', '必须有学习目标', '必须有复盘或练习',
    ]));
  });

  it('does not award a pattern signal for leaked quality labels without observable scene evidence', () => {
    const story: StoryGenerateResult = {
      ...makeStory(),
      title: '一般人物介绍',
      logline: '介绍人物相关内容。',
      theme: '人物内容',
      full_text: '目标明确。阻力具体。选择有代价。行动具体。结尾有人物变化。',
      scene_breakdown: makeStory().scene_breakdown.map((scene, index) => ({
        ...scene,
        title: `一般场景${index + 1}`,
        dramatic_function: '一般介绍',
        plot: '人物站在室内，旁白继续介绍相关背景内容。',
        key_action: '介绍背景',
        conflict: undefined,
        dialogue_or_narration: '这里继续介绍相关内容。',
        visual_prompt: '室内，一般人物，中景',
        camera_suggestion: '固定镜头',
        cultural_note: '测试。',
      })),
      gears_segments: [],
      protagonist_arc: [],
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: makeBaseReport(),
      narrativePatternIds: ['hero_choice'],
    });
    const signal = [
      ...(report.pattern_quality_report?.satisfied_signals ?? []),
      ...(report.pattern_quality_report?.weak_signals ?? []),
    ].find(item => item.label.includes('目标明确'));

    expect(signal).toBeDefined();
    expect(signal?.status).not.toBe('satisfied');
    expect(signal?.evidence_scene_ids).toEqual([]);
    expect(signal?.observable_evidence).toEqual([]);
    expect(signal?.counter_evidence.join('\n')).toContain('标签');
    expect(signal?.confidence).toBeLessThanOrEqual(0.5);
    expect(signal?.repair_target).toMatchObject({
      scope: 'scene',
      scene_ids: expect.any(Array),
    });
  });

  it('recognizes adaptation fidelity from source-bound characters, choices, consequences, and episode closure', () => {
    const source = [
      '雨夜，刘海发现胡大姐的影子在雷光里短暂变成狐形，手中的柴刀停在半空。',
      '追来的村人逼他交人；胡大姐挡在受伤孩子前，刘海必须在怀疑与亲眼所见之间选择。',
      '刘海放下柴刀护住胡大姐，门外却响起新的脚步声，神异身份引出下一场危机。',
    ].join('\n\n');
    const adaptationAnalysis = buildAdaptationAnalysis(source)!;
    const generated = generateDramaticContent({
      entry: {
        name: '刘海砍樵——人仙之恋的湖南民间传说',
        province: '湖南',
        region: '常德',
        type: '民间故事',
        summary: '刘海与胡大姐的民间传说有多个流传版本。',
        story: '刘海砍樵故事经民间讲述与花鼓戏改编流传，人物关系与具体情节存在不同版本。',
        culturalSignificance: '传说以选择、信任与担当组织人仙关系。',
        relatedLocations: [{ name: '武陵山路', description: '传说叙事空间，具体地点待核。' }],
        keywords: ['刘海', '胡大姐', '刘海砍樵', '花鼓戏'],
        sources: ['地方文化资料'],
        credibility: '传说类材料',
        unverifiedPoints: ['具体神异情节不可写成可考史实'],
      },
      centralEvent: '刘海识破胡大姐神异身份',
      videoType: 'ai_comic_drama',
      presentationStyle: 'ai_comic',
      targetDuration: '3分钟',
      tone: '紧张克制',
      originalUserQuery: source,
      adaptationAnalysis,
    });
    const story: StoryGenerateResult = {
      ...makeStory(),
      ...generated,
      storyId: 'adaptation-observable-evidence',
      generation_type: 'character_story',
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      source_entry: '刘海砍樵——人仙之恋的湖南民间传说',
      original_user_query: source,
      adaptation_analysis: adaptationAnalysis,
      story_structure: 'single_event_drama',
    };

    const report = enrichStoryQualityReport({
      story,
      qualityReport: makeBaseReport(),
      narrativePatternIds: [
        'novel_scene_compression',
        'chapter_slice_adaptation',
        'character_arc_adaptation',
      ],
    });
    const weakLabels = report.pattern_quality_report?.weak_signals.map(signal => signal.label) ?? [];
    const satisfied = report.pattern_quality_report?.satisfied_signals ?? [];

    expect(weakLabels).not.toEqual(expect.arrayContaining([
      '小说场景压缩：删改理由清楚',
      '小说场景压缩：不新增抢戏支线',
      '章节切片改编：单集闭环',
      '角色弧线改编：弧线不是口号',
    ]));
    for (const label of [
      '小说场景压缩：删改理由清楚',
      '小说场景压缩：不新增抢戏支线',
      '章节切片改编：单集闭环',
      '角色弧线改编：弧线不是口号',
    ]) {
      const signal = satisfied.find(item => item.label === label);
      expect(signal?.evidence_scene_ids.length).toBeGreaterThan(0);
      expect(signal?.observable_evidence.join('\n')).not.toContain('质量标签');
      expect(signal?.confidence).toBeGreaterThanOrEqual(0.82);
    }

    const metadataOnly: StoryGenerateResult = {
      ...story,
      scene_breakdown: story.scene_breakdown.map((scene, index) => ({
        ...scene,
        plot: `人物出现在一般场景 ${index + 1}，旁白概括背景。`,
        key_action: '介绍背景',
        conflict: undefined,
        characters: [],
        source_entries: [],
        factual_basis: '',
        cultural_note: '一般改编说明。',
      })),
      protagonist_arc: [],
    };
    const metadataOnlyReport = enrichStoryQualityReport({
      story: metadataOnly,
      qualityReport: makeBaseReport(),
      narrativePatternIds: [
        'novel_scene_compression',
        'chapter_slice_adaptation',
        'character_arc_adaptation',
      ],
    });
    const metadataOnlySatisfied = metadataOnlyReport.pattern_quality_report?.satisfied_signals
      .map(signal => signal.label) ?? [];
    expect(metadataOnlySatisfied).not.toEqual(expect.arrayContaining([
      '小说场景压缩：删改理由清楚',
      '小说场景压缩：不新增抢戏支线',
      '章节切片改编：单集闭环',
      '角色弧线改编：弧线不是口号',
    ]));
  });

  it('recognizes a legend contract only when supernatural imagery drives a costly human choice and transmission ending', () => {
    const base = makeStory();
    const legend: StoryGenerateResult = {
      ...base,
      title: '刘海砍樵与人仙相恋的考验',
      generation_type: 'character_story',
      video_type: 'legend_story',
      presentation_style: 'ink_style',
      source_entry: '刘海砍樵——人仙之恋的湖南民间传说',
      logline: '狐影显现后，刘海必须在人群压力与亲眼所见之间选择。',
      theme: '神异照见凡人的判断与担当。',
      full_text: '相传刘海在武陵山路遇见胡大姐。狐影显现，乡邻逼迫，刘海放下柴刀站到她身边。两人共同抬起柴担，后来花鼓戏把这次选择一代代重讲。',
      story_structure: 'single_event_drama',
      characters: [
        { name: '刘海', role: 'protagonist', description: '武陵樵夫' },
        { name: '胡大姐', role: 'supporting', description: '民间传说中的狐仙人物' },
      ],
      scene_breakdown: [
        {
          ...base.scene_breakdown[0],
          scene_id: 1,
          title: '武陵山路初相逢',
          dramatic_function: '远古传说',
          plot: '相传，刘海在武陵山路收紧柴担，胡大姐提着花篮从竹林走来。',
          key_action: '刘海收紧柴担并停步',
          characters: ['刘海', '胡大姐'],
          visual_prompt: '武陵山路，柴担、花篮与竹林薄雾，中景推近',
          cultural_note: '本场采用民间传说口径，具体走位为影视化创作。',
          factual_basis: '依据武陵民间传说，不作可考历史。',
          fictionalized_elements: ['具体走位为影视化创作。'],
        },
        {
          ...base.scene_breakdown[1],
          scene_id: 2,
          title: '花篮下的狐影',
          dramatic_function: '神力显现',
          plot: '花篮披帛扬起，水中狐影掠过；胡大姐伸手扶稳倾倒的柴担，刘海握住斧柄却没有挥下。',
          key_action: '胡大姐扶稳柴担显出狐影，刘海握斧停手',
          characters: ['刘海', '胡大姐'],
          visual_prompt: '花篮、狐影、倾斜柴担与停住的手，近景对切',
          conflict: '神异身份显露，刘海必须判断亲眼看见的善意',
          cultural_note: '狐仙身份属于民间传说，狐影显形为影视化虚构。',
          factual_basis: '依据狐仙胡大姐传说进行改编。',
          fictionalized_elements: ['水中狐影为象征性虚构。'],
        },
        {
          ...base.scene_breakdown[1],
          scene_id: 3,
          title: '柴刀落地',
          dramatic_function: '凡人考验',
          plot: '乡邻举火把逼刘海赶走胡大姐。刘海看见她护住柴担没有还手，于是放下柴刀站到她身边，承担被乡邻排斥的风险。',
          key_action: '刘海放下柴刀，选择站到胡大姐身边',
          characters: ['刘海', '胡大姐', '乡邻'],
          visual_prompt: '火把、柴担、落地柴刀与并肩人物，俯拍转横移',
          conflict: '乡邻逼迫驱离 vs 刘海依据亲眼所见作出选择',
          cultural_note: '身份考验来自传说，乡邻围门与柴刀动作是影视化虚构。',
          factual_basis: '传说只记经历考验，本场不作为史实。',
          fictionalized_elements: ['放下柴刀为外化选择的改编动作。'],
        },
        {
          ...base.scene_breakdown[1],
          scene_id: 4,
          title: '并肩抬担',
          dramatic_function: '命运转折',
          plot: '刘海回头拾起柴绳，与胡大姐并肩抬走柴担；乡邻因此停下脚步，让出山路。',
          key_action: '两人共同握住柴绳抬起柴担',
          characters: ['刘海', '胡大姐', '乡邻'],
          visual_prompt: '柴绳从一人手中交到两人手中，柴担被共同抬起，远景拉开',
          conflict: '身份隔绝仍在，两人用共同承担改变局面',
          cultural_note: '共同抬担为传说结局的影视化改编。',
          factual_basis: '依据战胜困难的传说概述，不作确定史实。',
          fictionalized_elements: ['柴绳接力是象征承诺的虚构动作。'],
        },
        {
          ...base.scene_breakdown[2],
          scene_id: 5,
          title: '从山路唱到戏台',
          dramatic_function: '传说永恒',
          plot: '花鼓戏演员带着柴担和花篮复演这次选择，观众随锣鼓应和，武陵山路的故事因此被一代代重讲。字幕注明这是多版本民间传说与戏曲改编。',
          key_action: '演员复演并由字幕标明传说版本边界',
          characters: ['花鼓戏演员', '观众'],
          visual_prompt: '戏台、锣鼓、柴担、花篮与观众应和，叠化回山路',
          conflict: '传播感染力与版本边界必须同时保留',
          cultural_note: '花鼓戏传播有条目依据，具体版本和唱词需要另核。',
          factual_basis: '依据长沙花鼓戏改编传播记载。',
          fictionalized_elements: ['舞台叠化为影视化收束。'],
        },
      ],
      gears_segments: [],
    };
    const generic: StoryGenerateResult = {
      ...legend,
      full_text: '天地异象介入人间。凡人经历恐惧、犹豫、勇气与信念。传说不灭，精神永存。',
      scene_breakdown: legend.scene_breakdown.map((item, index) => ({
        ...item,
        title: `抽象传说${index + 1}`,
        dramatic_function: ['远古传说', '神力显现', '凡人考验', '命运转折', '传说永恒'][index],
        plot: ['传说从这里开始。', '天地异象，超自然力量介入。', '凡人面对恐惧、犹豫、勇气与信念。', '命运发生转折。', '传说不灭，精神永存。'][index],
        key_action: '表达传说主题',
        conflict: '天意与人意',
        visual_prompt: '神秘光影与人物，中景',
        cultural_note: '这是传说。',
        factual_basis: '传说内容。',
        fictionalized_elements: [],
      })),
    };

    const positiveReport = enrichStoryQualityReport({ story: legend, qualityReport: makeBaseReport() });
    const negativeReport = enrichStoryQualityReport({ story: generic, qualityReport: makeBaseReport() });
    const positiveSatisfied = positiveReport.pattern_quality_report?.satisfied_signals.map(item => item.label) ?? [];
    const negativeSatisfied = negativeReport.pattern_quality_report?.satisfied_signals.map(item => item.label) ?? [];

    expect(positiveSatisfied).toEqual(expect.arrayContaining([
      '传说考验：象征意象贯穿',
      '传说考验：结尾有流传理由',
      '神异意象服务选择',
      '凡人考验成立',
      '传说边界清楚',
      '结尾有流传理由',
      '必须有象征意象',
      '必须有人物考验',
      '必须标明传说边界',
    ]));
    expect(negativeSatisfied).not.toEqual(expect.arrayContaining([
      '神异意象服务选择',
      '凡人考验成立',
      '传说边界清楚',
      '结尾有流传理由',
    ]));
  });

  it('recognizes historical ensemble agency only when dated pressure, choice, causal action, consequence, and boundaries connect', () => {
    const source = [
      '武昌起义消息提前泄露，新军士兵连夜集结，决定抢在清军搜捕前发动。',
      '起义军冲向楚望台军械库，推开库门、搬出枪械，再向湖广总督署推进。',
      '普通士兵的行动引发连锁响应，武昌城的局势由此改变。',
    ].join('\n\n');
    const generated = generateDramaticContent({
      entry: {
        name: '武昌起义——辛亥革命的第一声枪响',
        province: '湖北',
        region: '武汉武昌',
        type: '地方掌故',
        summary: '1911年10月10日，新军在武昌发动起义并攻占湖广总督署。',
        story: '10月9日计划泄露，清军搜捕。10月10日晚新军起义，攻占楚望台军械库后攻入湖广总督署。',
        culturalSignificance: '普通新军士兵的行动成为辛亥革命的重要开端。',
        relatedLocations: [{ name: '楚望台军械库', description: '起义军获得弹药的转折空间' }],
        keywords: ['武昌起义', '新军起义', '金兆龙', '程定国', '楚望台军械库'],
        sources: ['辛亥革命武昌起义纪念馆官方资料'],
        credibility: '基本可靠',
        unverifiedPoints: ['第一枪具体经过存在回忆差异'],
        era: '近代',
      },
      centralEvent: '武昌起义提前发动并争夺楚望台军械库',
      videoType: 'historical_drama',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '紧张克制',
      originalUserQuery: source,
      adaptationAnalysis: {
        source_mode: 'user_novel',
        source_length: source.length,
        source_summary: '普通新军士兵在搜捕压力下提前行动并引发连锁响应。',
        core_characters: ['新军士兵', '起义军', '普通士兵'],
        plot_beats: source.split('\n\n'),
        must_keep: ['新军士兵', '起义军', '普通士兵', '楚望台军械库', '连锁响应'],
        compressible_parts: [],
        visual_setpieces: ['夜间搜捕', '军械库争夺', '湖广总督署推进'],
        adaptation_risks: ['不得把复杂历史结果归为单因'],
      },
    });
    const positive: StoryGenerateResult = {
      ...makeStory(),
      ...generated,
      storyId: 'historical-ensemble-positive',
      generation_type: 'scene_short',
      video_type: 'historical_drama',
      presentation_style: 'cinematic',
      source_entry: '武昌起义——辛亥革命的第一声枪响',
      original_user_query: source,
      story_structure: 'single_event_drama',
    };
    const generic: StoryGenerateResult = {
      ...positive,
      storyId: 'historical-ensemble-generic',
      full_text: '时代压力到来。人物采取行动。事件产生影响。历史留下余响。',
      scene_breakdown: positive.scene_breakdown.map((scene, index) => ({
        ...scene,
        plot: ['时代压力到来。', '人物被卷入历史。', '冲突继续升级。', '人物采取关键行动。', '历史局势发生变化。', '事件留下历史余响。'][index],
        key_action: '表现历史事件',
        conflict: '时代与人物发生冲突',
        visual_prompt: '历史空间与人物群像，中景',
        cultural_note: '历史改编。',
        factual_basis: '历史素材。',
        fictionalized_elements: [],
      })),
    };
    const positiveReport = enrichStoryQualityReport({ story: positive, qualityReport: makeBaseReport() });
    const genericReport = enrichStoryQualityReport({ story: generic, qualityReport: makeBaseReport() });
    const positiveSatisfied = positiveReport.pattern_quality_report?.satisfied_signals.map(item => item.label) ?? [];
    const genericSatisfied = genericReport.pattern_quality_report?.satisfied_signals.map(item => item.label) ?? [];

    expect(positiveSatisfied).toEqual(expect.arrayContaining([
      '时代压力可见',
      '事件因果清楚',
      '史实边界明确',
      '人物不是背景板',
      '必须有时代压力',
      '必须有事件因果',
      '必须标注创作边界',
    ]));
    expect(genericSatisfied).not.toEqual(expect.arrayContaining([
      '时代压力可见',
      '事件因果清楚',
      '史实边界明确',
      '人物不是背景板',
    ]));
  });

  it('recognizes documentary evidence, interview boundaries, and a concrete present-day answer', () => {
    const generated = generateDramaticContent({
      entry: {
        name: '岳麓书院——千年学府弦歌不绝',
        province: '湖南',
        region: '长沙→岳麓区',
        type: '名胜古迹',
        summary: '岳麓书院以讲学、会讲和今日校园延续湖湘文脉。',
        story: '岳麓书院始建于北宋开宝九年（976年）。\n\n南宋时朱熹与张栻在此会讲。\n\n书院延续至今。',
        culturalSignificance: '讲学与论辩传统延续到当代教育。',
        relatedLocations: [{ name: '岳麓书院讲堂', description: '讲学与会讲空间' }],
        keywords: ['岳麓书院', '朱张会讲', '湖湘文脉'],
        sources: ['岳麓书院官方资料'],
        credibility: '基本可靠',
        unverifiedPoints: ['具体会讲对白不可写成历史原话'],
      },
      centralEvent: '朱张会讲',
      videoType: 'documentary_short',
      presentationStyle: 'documentary',
      targetDuration: '3分钟',
      tone: '克制求证',
    });
    const documentary: StoryGenerateResult = {
      ...makeStory(),
      ...generated,
      storyId: 'documentary-evidence-positive',
      generation_type: 'culture_promo',
      video_type: 'documentary_short',
      presentation_style: 'documentary',
      source_entry: '岳麓书院——千年学府弦歌不绝',
      story_structure: 'object_clue_journey',
    };
    const generic: StoryGenerateResult = {
      ...documentary,
      storyId: 'documentary-evidence-generic',
      full_text: '书院历史悠久，文化影响深远，今天仍有重要意义。',
      scene_breakdown: documentary.scene_breakdown.map((scene, index) => ({
        ...scene,
        plot: ['书院出现在画面中。', '历史悠久。', '文化影响深远。', '专家进行讲解。', '精神永远流传。'][index],
        key_action: '展示书院文化',
        camera_suggestion: '书院空间中景',
        cultural_note: '内容待核。',
        factual_basis: '历史素材。',
        fictionalized_elements: [],
      })),
    };

    const positiveReport = enrichStoryQualityReport({ story: documentary, qualityReport: makeBaseReport() });
    const genericReport = enrichStoryQualityReport({ story: generic, qualityReport: makeBaseReport() });
    const positiveSatisfied = positiveReport.pattern_quality_report?.satisfied_signals.map(item => item.label) ?? [];
    const genericSatisfied = genericReport.pattern_quality_report?.satisfied_signals.map(item => item.label) ?? [];

    expect(positiveSatisfied).toEqual(expect.arrayContaining([
      '现实现场明确',
      '来源提示存在',
      '边界清楚',
      '当代意义自然',
    ]));
    expect(genericSatisfied).not.toEqual(expect.arrayContaining([
      '边界清楚',
      '当代意义自然',
    ]));
  });
});
