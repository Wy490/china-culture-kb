import { describe, expect, it } from 'vitest';
import { buildGearsDeliveryPackage, ensureGearsDeliveryPackage } from '../services/gears-delivery-service.js';
import type { GearsDeliveryPackage, ProductionMaterialReadinessReport, StoryGenerateResult } from '@shared/types.js';

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260610-story-gears',
    title: '少年毛泽东的求索',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '毛泽东——从韶山冲走向天安门的农家革命者',
    logline: '少年毛泽东从韶山走向求学与革命觉醒。',
    theme: '求学与革命',
    full_text: '少年毛泽东在韶山求学，逐渐看见人民处境，选择寻找改变中国的道路。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '韶山求学',
        duration_sec: 32,
        location: '韶山私塾',
        time_of_day: '白天',
        dramatic_function: '开场',
        plot: '少年毛泽东坐在私塾里读书，窗外是湖南乡土。他看见农人劳作，也听见旧规矩压在人身上。少年抬头，第一次认真追问读书与天下之间的关系。',
        key_action: '抬头追问',
        characters: ['毛泽东'],
        visual_prompt: '韶山乡土，私塾，少年读书',
        camera_suggestion: '中景推近',
        cultural_note: '湖南乡土与求学背景',
        conflict: '旧规矩与少年追问',
        dialogue_or_narration: '毛泽东：「读书，难道只为自己吗？」',
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260610-story-gears/gears-segments',
    cultural_constraints: [],
    credibility_note: '基于知识库条目生成',
    characters: [
      { name: '毛泽东', role: 'protagonist', description: '湖南韶山少年，正在求学与觉醒', arc: '从求学走向革命理想' },
    ],
  };
}

function makeKnowledgeBackedStory(): StoryGenerateResult {
  return {
    storyId: '20260610-story-gears-kb',
    title: '周敦颐的良知',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '周敦颐在旧案前守住良知。',
    theme: '良知与公正',
    full_text: '周敦颐面对疑案，选择坚持重审。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '濂溪读书',
        duration_sec: 15,
        location: '濂溪畔',
        time_of_day: '清晨',
        dramatic_function: '铺垫',
        plot: '周敦颐在溪畔读书，案头放着旧书与毛笔。',
        key_action: '翻开旧书',
        characters: ['周敦颐'],
        visual_prompt: '溪水、旧书、毛笔',
        camera_suggestion: '中景缓推',
        cultural_note: '来自知识库条目',
        source_entries: ['周敦颐——理学开山鼻祖'],
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260610-story-gears-kb/gears-segments',
    cultural_constraints: [],
    credibility_note: '基于知识库条目生成',
    characters: [
      { name: '周敦颐', role: 'protagonist', description: '', arc: '' },
    ],
    knowledge_pack: {
      primary_entries: [
        {
          entry_name: '周敦颐——理学开山鼻祖',
          province: '湖南',
          region: '永州道县',
          type: '历史人物',
          summary: '周敦颐出身道县楼田村书香门第，幼年丧父，由母亲郑氏抚养，后在濂溪畔读书洗笔。',
          score: 0.98,
          role_in_story: '主人公经历来源',
          match_reason: '命中周敦颐与濂溪地点',
          keywords: ['周敦颐', '濂溪', '书香门第', '旧书', '毛笔'],
        },
      ],
      supporting_entries: [],
      missing_needs: [],
      overall_confidence: 0.92,
    },
  };
}

function makeSparseStory(): StoryGenerateResult {
  return {
    storyId: '20260610-story-gears-sparse',
    title: '资料不足测试',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '缺少资料的条目',
    logline: '测试资料不足时的提示。',
    theme: '资料补充',
    full_text: '',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '',
        duration_sec: 10,
        location: '',
        time_of_day: '',
        dramatic_function: '',
        plot: '',
        key_action: '',
        characters: ['人物甲'],
        visual_prompt: '',
        camera_suggestion: '',
        cultural_note: '',
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260610-story-gears-sparse/gears-segments',
    cultural_constraints: [],
    credibility_note: '资料不足',
  };
}

function makeGenderStory(): StoryGenerateResult {
  return {
    storyId: '20260610-story-gears-gender',
    title: '性别统计测试',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '测试条目',
    logline: '少年、老奶奶和村民共同出场。',
    theme: '人物识别',
    full_text: '少年在村口问路，老奶奶点灯回应，村民围在一旁。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '村口问路',
        duration_sec: 12,
        location: '村口',
        time_of_day: '夜晚',
        dramatic_function: '开场',
        plot: '少年在村口问路，老奶奶点灯回应，村民围在一旁。',
        key_action: '问路与回应',
        characters: ['少年', '老奶奶', '村民'],
        visual_prompt: '村口、灯火、人群',
        camera_suggestion: '中景',
        cultural_note: '测试',
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260610-story-gears-gender/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试',
  };
}

function makeSupplementedStory(): StoryGenerateResult {
  return {
    ...makeSparseStory(),
    storyId: '20260610-story-gears-supplemented',
    title: '补录资料测试',
    source_entry: '周敦颐——理学开山鼻祖',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '堂前催签',
        duration_sec: 10,
        location: '南安军衙',
        time_of_day: '白天',
        dramatic_function: '冲突升级',
        plot: '上官催促周敦颐签署文书。',
        key_action: '催促签署',
        characters: ['上官'],
        visual_prompt: '',
        camera_suggestion: '',
        cultural_note: '',
      },
    ],
    supplement_tasks: [
      {
        task_id: '20260610-story-gears-supplemented--supplement--supporting_characters',
        need_id: 'supporting_characters',
        label: '配角人物',
        description: '补充配角人物相关资料',
        category: 'supporting_character',
        status: 'resolved',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-10T10:00:00.000Z',
        resolved_at: '2026-06-10T11:00:00.000Z',
        supplement_note: '上官是南安军衙主管，负责催促签署疑案文书。',
      },
      {
        task_id: '20260610-story-gears-supplemented--supplement--regional_context',
        need_id: 'regional_context',
        label: '地域背景',
        description: '补充地域背景相关资料',
        status: 'open',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-10T10:00:00.000Z',
        supplement_note: '这条待补说明不应进入 GEARS。',
      },
    ],
  };
}

function makePollutedMoonCaveStory(): StoryGenerateResult {
  return {
    storyId: '20260611-story-5xgl',
    title: '月岩悟道传说',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '周敦颐少年时在月岩洞读书悟道。',
    theme: '读书悟道',
    full_text: '雨夜，永州→道县。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '月岩悟道传说',
        duration_sec: 12,
        location: '**月岩悟道传说**：道县有著名天然溶洞',
        time_of_day: '夜',
        dramatic_function: '开场',
        plot: '雨夜，永州→道县。',
        key_action: '',
        characters: ['周敦颐', '月岩悟道', '少年时在道'],
        visual_prompt: '烛火/文书/案卷/判词——核心画面是月岩悟道传说的紧张开场',
        camera_suggestion: '',
        cultural_note: '月岩悟道传说为民间传说，学术推测而非确证',
        factual_basis: '道县有著名天然溶洞“月岩”，传说周敦颐少年时常在月岩洞中读书悟道。',
        dialogue_or_narration: '',
      },
      {
        scene_id: 2,
        title: '月岩悟道传说',
        duration_sec: 15,
        location: '**月岩悟道传说**：道县有著名天然溶洞',
        time_of_day: '午',
        dramatic_function: '身份介绍',
        plot: '周敦颐是什么身份？',
        key_action: '',
        characters: ['周敦颐'],
        visual_prompt: '月岩洞',
        camera_suggestion: '',
        cultural_note: '',
        dialogue_or_narration: '',
      },
      {
        scene_id: 3,
        title: '月岩悟道传说',
        duration_sec: 15,
        location: '**月岩悟道传说**：道县有著名天然溶洞',
        time_of_day: '夜',
        dramatic_function: '残缺对白',
        plot: '',
        key_action: '',
        characters: ['周敦颐'],
        visual_prompt: '月岩洞',
        camera_suggestion: '',
        cultural_note: '',
        dialogue_or_narration: '"',
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260611-story-5xgl/gears-segments',
    cultural_constraints: [],
    credibility_note: '月岩悟道传说为民间传说，学术推测而非确证',
    characters: [
      { name: '周敦颐', role: 'protagonist', description: '北宋道县少年读书人，清瘦沉静', arc: '在月岩读书传说中形成求理问道的精神底色' },
    ],
    knowledge_pack: {
      primary_entries: [
        {
          entry_name: '周敦颐——理学开山鼻祖',
          province: '湖南',
          region: '永州道县',
          type: '历史人物',
          summary: '周敦颐出身道县楼田村书香门第，幼年丧父，由母亲郑氏抚养；道县月岩为天然岩洞，民间传说其少年时在洞中读书悟道。',
          score: 0.98,
          role_in_story: '主人公经历来源',
          match_reason: '命中周敦颐与月岩悟道传说',
          keywords: ['周敦颐', '月岩', '道县', '读书', '悟道'],
        },
      ],
      supporting_entries: [],
      missing_needs: [],
      overall_confidence: 0.86,
    },
  };
}

function makePollutedMaoStory(): StoryGenerateResult {
  return {
    storyId: '20260614-story-mao',
    title: '从韶山少年到革命青年',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '毛泽东——从韶山冲走向天安门的农家革命者',
    logline: '少年毛泽东从韶山求学走向思想觉醒。',
    theme: '求学、独立与时代觉醒',
    full_text: '少年毛泽东在韶山劳动读书，后来走出家乡，到长沙求学，逐渐把个人求学与国家前途联系起来。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '韶山少年',
        duration_sec: 12,
        location: '**韶山少年**：湖南湘潭韶山冲农家院落',
        time_of_day: '清晨',
        dramatic_function: '主角处境',
        plot: '毛泽东是什么身份？',
        key_action: '劳动后翻开书本',
        characters: ['毛泽东', '韶山少年', '湘江评论与驱张运动'],
        visual_prompt: '湘江评论与驱张运动（1919—1920）：五四运动后，毛泽东1919年7月14日在长沙创刊主编《湘江评论》，在创',
        camera_suggestion: '中景',
        cultural_note: '清末民初湖南乡村求学背景',
        conflict: '父亲希望他承担家业，少年更想继续求学',
        dialogue_or_narration: '窗外是田垄，少年把书压在膝上，听见父亲催他去做事。',
      },
      {
        scene_id: 2,
        title: '长沙求学',
        duration_sec: 12,
        location: '长沙新式学校',
        time_of_day: '白天',
        dramatic_function: '关键行动',
        plot: '',
        key_action: '阅读报刊并参加讨论',
        characters: ['毛泽东', '学生们'],
        visual_prompt: '书桌、报刊、课堂、青年学生围坐讨论',
        camera_suggestion: '近景切换',
        cultural_note: '新式教育与新思想冲击',
        conflict: '个人求学开始连接国家危机',
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260614-story-mao/gears-segments',
    cultural_constraints: [],
    credibility_note: '基于知识库条目生成',
    characters: [
      { name: '毛泽东', role: 'protagonist', description: '湖南韶山少年，清末民初求学青年', arc: '从乡村少年到有社会关怀的革命青年' },
    ],
  };
}

describe('gears-delivery-service', () => {
  it('builds a GEARS supply package with assets, markdown, and <=15s units', () => {
    const pkg = buildGearsDeliveryPackage(makeStory());

    expect(pkg.schema_version).toBe('gears-delivery/v1');
    expect(pkg.character_assets[0].name).toBe('毛泽东');
    expect(pkg.scene_assets[0].name).toBe('韶山私塾');
    expect(pkg.units.length).toBeGreaterThan(1);
    expect(pkg.units.every(unit => unit.suggested_duration_sec <= 15)).toBe(true);
    expect(pkg.units.every(unit => unit.scene_name === '韶山私塾')).toBe(true);
    expect(pkg.units.every(unit => unit.character_names.includes('毛泽东'))).toBe(true);
    expect(pkg.delivery_status).toBe('ready');
    expect(pkg.validation_notes).toEqual([]);
    expect(pkg.character_gender_summary.male).toBe(1);
    expect(pkg.character_assets[0].gender).toBe('男');
    expect(pkg.markdown).toContain('> delivery_status: ready');
    expect(pkg.markdown).toContain('# 人物性别统计');
    expect(pkg.markdown).toContain('# 资产清单');
    expect(pkg.markdown).toContain('### 毛泽东');
    expect(pkg.markdown).toContain('- 场景: 韶山私塾');
    expect(pkg.markdown).toContain('- 出场人物: 毛泽东');
  });

  it('downgrades delivery status when production material readiness needs input', () => {
    const missingField = {
      field_id: 'reference_images_or_keyframes',
      label: '参考图或关键帧',
      stage: 'production_ready' as const,
      blocking_level: 'risk' as const,
      reason: 'AI 漫剧生产前缺少角色或关键画面参考，可能导致角色和空间漂移。',
      recommended_question: '请补充主角、关键配角或第一场关键帧参考图。',
    };
    const productionMaterialReadiness: ProductionMaterialReadinessReport = {
      schema_version: 'production-material-readiness/v1',
      video_type: 'ai_comic_drama',
      pack_label: 'AI 漫剧单片',
      score: 66,
      status: 'needs_input',
      available_fields: ['core_conflict'],
      missing_fields: [missingField],
      gate_reports: [{
        stage: 'production_ready',
        status: 'needs_input',
        required_items: ['reference_images_or_keyframes'],
        available_fields: ['core_conflict'],
        missing_fields: [missingField],
        notes: ['production_ready 阶段需要补参考图。'],
      }],
      recommended_next_questions: ['请补充主角、关键配角或第一场关键帧参考图。'],
    };

    const pkg = buildGearsDeliveryPackage({
      ...makeStory(),
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      production_material_readiness: productionMaterialReadiness,
    });

    expect(pkg.delivery_status).toBe('needs_input');
    expect(pkg.validation_notes.some(note => note.includes('生产素材未达 production_ready'))).toBe(true);
    expect(pkg.validation_notes.some(note => note.includes('参考图或关键帧'))).toBe(true);
    expect(pkg.markdown).toContain('> delivery_status: needs_input');
    expect(pkg.markdown).toContain('生产素材未达 production_ready');
  });

  it('refreshes production material validation notes when existing delivery is stale', () => {
    const missingField = {
      field_id: 'reference_images_or_keyframes',
      label: '参考图或关键帧',
      stage: 'production_ready' as const,
      blocking_level: 'risk' as const,
      reason: 'AI 漫剧生产前缺少角色或关键画面参考，可能导致角色和空间漂移。',
      recommended_question: '请补充主角、关键配角或第一场关键帧参考图。',
    };
    const staleReadiness: ProductionMaterialReadinessReport = {
      schema_version: 'production-material-readiness/v1',
      video_type: 'ai_comic_drama',
      pack_label: 'AI 漫剧单片',
      score: 66,
      status: 'needs_input',
      available_fields: ['core_conflict'],
      missing_fields: [missingField],
      gate_reports: [{
        stage: 'production_ready',
        status: 'needs_input',
        required_items: ['reference_images_or_keyframes'],
        available_fields: ['core_conflict'],
        missing_fields: [missingField],
        notes: ['production_ready 阶段需要补参考图。'],
      }],
      recommended_next_questions: ['请补充主角、关键配角或第一场关键帧参考图。'],
    };
    const readyReadiness: ProductionMaterialReadinessReport = {
      ...staleReadiness,
      score: 100,
      status: 'ready',
      available_fields: ['core_conflict', 'reference_images_or_keyframes'],
      missing_fields: [],
      gate_reports: [{
        ...staleReadiness.gate_reports[0],
        status: 'ready',
        available_fields: ['core_conflict', 'reference_images_or_keyframes'],
        missing_fields: [],
        notes: ['当前素材已覆盖该阶段生产模板字段。'],
      }],
      recommended_next_questions: [],
    };
    const staleDelivery = buildGearsDeliveryPackage({
      ...makeStory(),
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      production_material_readiness: staleReadiness,
    });

    const refreshed = ensureGearsDeliveryPackage({
      ...makeStory(),
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      production_material_readiness: readyReadiness,
      gears_delivery: staleDelivery,
    });

    expect(refreshed.delivery_status).toBe('ready');
    expect(refreshed.validation_notes.some(note => note.includes('生产素材未达 production_ready'))).toBe(false);
    expect(refreshed.markdown).toContain('> delivery_status: ready');
    expect(refreshed.markdown).not.toContain('生产素材未达 production_ready');
  });

  it('merges short sentence chunks so historical drama units stay storyboardable', () => {
    const story: StoryGenerateResult = {
      ...makeStory(),
      storyId: '20260627-story-quyuan-gears',
      title: '屈原投江汨罗',
      source_entry: '屈原投江汨罗——端午节起源',
      video_type: 'historical_drama',
      presentation_style: 'cinematic',
      full_text: '汨罗江畔，楚国败局已成。郢都失守的消息传到江南，被放逐的屈原站在风里，家国之痛从朝堂压到江边。',
      scene_breakdown: [
        {
          scene_id: 1,
          title: '时代危机',
          duration_sec: 36,
          location: '汨罗江畔',
          time_of_day: '雨夜',
          dramatic_function: '时代危机',
          plot: '汨罗江畔，楚国败局已成。郢都失守的消息传到江南，被放逐的屈原站在风里，家国之痛从朝堂压到江边。',
          key_action: '交代郢都失守和流放处境',
          characters: ['屈原'],
          visual_prompt: '汨罗江畔，江雾、战火远影、简牍和破旧楚地旗帜，历史压迫感远景',
          camera_suggestion: '远景大画面，建立历史空间',
          cultural_note: '事实边界：可考信息与影视化调度需分开标注。',
          conflict: '国破流放 vs 保全自身',
          dialogue_or_narration: '旁白：据《史记》等传统叙述，郢都失守后，流放江南的屈原再也不能置身事外。',
        },
      ],
      characters: [
        { name: '屈原', role: 'protagonist', description: '楚国诗人，流放江南' },
      ],
    };

    const pkg = buildGearsDeliveryPackage(story);

    expect(pkg.validation_notes.some(note => note.includes('正文过短'))).toBe(false);
    expect(pkg.units.length).toBeGreaterThan(0);
    expect(pkg.units.every(unit => (unit.script_text.match(/[\p{Script=Han}A-Za-z0-9]/gu) ?? []).length >= 18)).toBe(true);
  });

  it('infers and summarizes character genders for the delivery package', () => {
    const pkg = buildGearsDeliveryPackage(makeGenderStory());

    expect(pkg.character_assets.find(character => character.name === '少年')?.gender).toBe('男');
    expect(pkg.character_assets.find(character => character.name === '老奶奶')?.gender).toBe('女');
    expect(pkg.character_assets.find(character => character.name === '村民')?.gender).toBe('不适用');
    expect(pkg.character_gender_summary).toEqual({
      total: 3,
      male: 1,
      female: 1,
      other: 0,
      unspecified: 0,
      not_applicable: 1,
    });
    expect(pkg.markdown).toContain('- 男: 1');
    expect(pkg.markdown).toContain('- 女: 1');
    expect(pkg.markdown).toContain('- 不适用: 1');
  });

  it('normalizes legacy delivery packages without a gender summary', () => {
    const current = buildGearsDeliveryPackage(makeGenderStory());
    const legacyDelivery = {
      ...current,
      character_assets: current.character_assets.map(character => ({
        ...character,
        gender: '未指定',
      })),
      character_gender_summary: undefined,
      markdown: '# 旧版 GEARS 供稿包',
    } as unknown as GearsDeliveryPackage;
    const pkg = ensureGearsDeliveryPackage({
      ...makeGenderStory(),
      gears_delivery: legacyDelivery,
    });

    expect(pkg.character_assets.find(character => character.name === '少年')?.gender).toBe('男');
    expect(pkg.character_assets.find(character => character.name === '老奶奶')?.gender).toBe('女');
    expect(pkg.character_gender_summary).toEqual({
      total: 3,
      male: 1,
      female: 1,
      other: 0,
      unspecified: 0,
      not_applicable: 1,
    });
    expect(pkg.markdown).toContain('# 人物性别统计');
  });

  it('enriches assets from knowledge_pack when story fields are thin', () => {
    const pkg = buildGearsDeliveryPackage(makeKnowledgeBackedStory());

    expect(pkg.character_assets[0].appearance_features).toContain('书香门第');
    expect(pkg.character_assets[0].background_oneliner).toContain('濂溪畔读书洗笔');
    expect(pkg.character_assets[0].signature_objects).toContain('书');
    expect(pkg.scene_assets[0].description).toContain('溪水、旧书、毛笔');
    expect(pkg.scene_assets[0].description).not.toContain('幼年丧父');
    expect(pkg.scene_assets[0].environment_props).toContain('旧书');
    expect(pkg.markdown).toContain('周敦颐出身道县楼田村书香门第');
  });

  it('adds validation notes for assets that still need source detail', () => {
    const pkg = buildGearsDeliveryPackage(makeSparseStory());

    expect(pkg.validation_notes).toContain('人物资产 人物甲 缺少稳定外观细节');
    expect(pkg.validation_notes).toContain('场景资产 场景1 缺少空间结构与陈设细节');
    expect(pkg.markdown).toContain('# 校验提示');
  });

  it('enriches GEARS assets from resolved supplement notes', () => {
    const pkg = buildGearsDeliveryPackage(makeSupplementedStory());

    expect(pkg.character_assets[0].appearance_features).toContain('南安军衙主管');
    expect(pkg.scene_assets[0].description).toContain('疑案文书');
    expect(pkg.markdown).toContain('负责催促签署疑案文书');
    expect(pkg.markdown).not.toContain('这条待补说明不应进入 GEARS');
  });

  it('cleans polluted moon cave delivery assets and flags thin script units', () => {
    const pkg = buildGearsDeliveryPackage(makePollutedMoonCaveStory());

    expect(pkg.character_assets.map(character => character.name)).toEqual(['周敦颐']);
    expect(pkg.character_assets[0].clothing).toContain('北宋士人');
    expect(pkg.character_assets[0].signature_objects).toContain('书');
    expect(pkg.scene_assets).toHaveLength(1);
    expect(pkg.scene_assets[0].name).toBe('月岩洞');
    expect(pkg.scene_assets[0].description).toContain('天然岩洞空间');
    expect(pkg.scene_assets[0].description).not.toContain('案卷');
    expect(pkg.scene_assets[0].environment_props).toBe('洞口、岩壁、石质地面');
    expect(pkg.units.every(unit => unit.scene_name === '月岩洞')).toBe(true);
    expect(pkg.units.every(unit => unit.character_names.join('、') === '周敦颐')).toBe(true);
    expect(pkg.units[0].script_text).toContain('天然溶洞');
    expect(pkg.validation_notes).toContain('单元 2 缺少可供分镜使用的剧本正文');
    expect(pkg.validation_notes).toContain('单元 3 缺少可供分镜使用的剧本正文');
    expect(pkg.markdown).toContain('- 场景道具/陈设: 洞口、岩壁、石质地面');
    expect(pkg.markdown).toContain('- 随身/标志性物件: 书');
  });

  it('keeps Song clothing for Zhou Dunyi stories localized to Changsha', () => {
    const story = makeKnowledgeBackedStory();
    story.title = '周敦颐橘子洲问莲';
    story.logline = '北宋少年周敦颐从道州赴汴京求学，途经长沙橘子洲。';
    story.full_text = '北宋少年周敦颐从道州赴汴京投奔舅父，途经长沙，在橘子洲头与垂钓老者偶遇。';
    story.scene_breakdown[0] = {
      ...story.scene_breakdown[0],
      title: '橘子洲问莲',
      location: '长沙橘子洲头',
      plot: '北宋少年周敦颐从道州赴汴京求学，途经长沙橘子洲，在湘江渡口停步问莲。',
      visual_prompt: '长沙橘子洲头，湘江水面，北宋少年读书人，书卷，莲叶',
    };

    const pkg = buildGearsDeliveryPackage(story);

    expect(pkg.character_assets[0].clothing).toContain('北宋士人');
    expect(pkg.character_assets[0].clothing).not.toContain('清末民初');
  });

  it('keeps modern revolutionary youth assets out of Song clothing and cleans polluted prompts', () => {
    const pkg = buildGearsDeliveryPackage(makePollutedMaoStory());

    expect(pkg.character_assets.map(character => character.name)).toEqual(['毛泽东', '学生们']);
    expect(pkg.character_assets[0].clothing).toContain('清末民初');
    expect(pkg.character_assets[0].clothing).not.toContain('北宋');
    expect(pkg.scene_assets[0].description).toContain('湖南湘潭韶山冲农家院落');
    expect(pkg.scene_assets[0].description).not.toContain('湘江评论与驱张运动');
    expect(pkg.units.every(unit => unit.character_names.includes('毛泽东'))).toBe(true);
    expect(pkg.units[0].script_text).toContain('父亲希望他承担家业');
    expect(pkg.units[1].script_text).toContain('阅读报刊并参加讨论');
    expect(pkg.units[1].script_text).toContain('个人求学开始连接国家危机');
    expect(pkg.units[1].script_text).not.toContain('【文本待补】');
  });
});
