import { describe, expect, it } from 'vitest';
import { buildGearsDeliveryPackage } from '../services/gears-delivery-service.js';
import type { StoryGenerateResult } from '@shared/types.js';

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
    expect(pkg.markdown).toContain('# 资产清单');
    expect(pkg.markdown).toContain('### 毛泽东');
    expect(pkg.markdown).toContain('- 场景: 韶山私塾');
    expect(pkg.markdown).toContain('- 出场人物: 毛泽东');
  });

  it('enriches assets from knowledge_pack when story fields are thin', () => {
    const pkg = buildGearsDeliveryPackage(makeKnowledgeBackedStory());

    expect(pkg.character_assets[0].appearance_features).toContain('书香门第');
    expect(pkg.character_assets[0].background_oneliner).toContain('濂溪畔读书洗笔');
    expect(pkg.character_assets[0].signature_objects).toContain('书');
    expect(pkg.scene_assets[0].description).toContain('幼年丧父');
    expect(pkg.scene_assets[0].description).toContain('溪水、旧书、毛笔');
    expect(pkg.markdown).toContain('周敦颐出身道县楼田村书香门第');
  });

  it('adds validation notes for assets that still need source detail', () => {
    const pkg = buildGearsDeliveryPackage(makeSparseStory());

    expect(pkg.validation_notes).toContain('人物资产 人物甲 缺少稳定外观细节');
    expect(pkg.validation_notes).toContain('场景资产 场景1 缺少空间结构与陈设细节');
    expect(pkg.markdown).toContain('# 校验提示');
  });
});
