import { describe, expect, it } from 'vitest';
import { buildGearsDeliveryPackage, ensureGearsDeliveryPackage } from '../services/gears-delivery-service.js';
import type { GearsDeliveryPackage, StoryGenerateResult } from '@shared/types.js';

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
    expect(pkg.validation_notes).toEqual([]);
    expect(pkg.character_gender_summary.male).toBe(1);
    expect(pkg.character_assets[0].gender).toBe('男');
    expect(pkg.markdown).toContain('# 人物性别统计');
    expect(pkg.markdown).toContain('# 资产清单');
    expect(pkg.markdown).toContain('### 毛泽东');
    expect(pkg.markdown).toContain('- 场景: 韶山私塾');
    expect(pkg.markdown).toContain('- 出场人物: 毛泽东');
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
    expect(pkg.units[0].suggested_duration_sec).toBeLessThan(12);
    expect(pkg.validation_notes).toContain('单元 2 正文过短，不足以支撑 5 秒分镜');
    expect(pkg.validation_notes).toContain('单元 3 缺少可供分镜使用的剧本正文');
    expect(pkg.markdown).toContain('- 场景道具/陈设: 洞口、岩壁、石质地面');
    expect(pkg.markdown).toContain('- 随身/标志性物件: 书');
  });
});
