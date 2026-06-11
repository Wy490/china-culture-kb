import { describe, expect, it } from 'vitest';
import { buildStoryGenerationPromptPackage } from '../services/story-generation-prompt.js';
import type { EntryDetail, KnowledgePack, StoryGenerateRequest } from '@shared/types.js';

function makeEntry(): EntryDetail {
  return {
    name: '周敦颐——理学开山鼻祖',
    province: '湖南',
    region: '永州→道县',
    type: '历史人物',
    summary: '周敦颐为北宋理学重要人物。',
    story: '道县月岩悟道传说为民间传说，需标明可信度边界。',
    culturalSignificance: '濂溪学脉影响后世。',
    relatedLocations: [{ name: '月岩洞', description: '道县天然岩洞' }],
    keywords: ['周敦颐', '北宋', '月岩洞', '理学'],
    sources: ['测试来源'],
    credibility: '待核实',
    verificationMethod: '测试核验',
    unverifiedPoints: ['月岩悟道为民间传说'],
    knowledge_domain: 'core_china_culture',
    entry_role: 'core_entry',
    era: '宋',
    asset_usage: ['character_clothing', 'scene_space'],
    asset_split: {
      characters: ['周敦颐：北宋士人'],
      scenes: ['月岩洞：道县天然岩洞'],
      character_props: ['书卷：随身读书物'],
      scene_props: ['岩壁：自然场景陈设'],
    },
  };
}

function makeKnowledgePack(): KnowledgePack {
  return {
    primary_entries: [{
      entry_name: '周敦颐——理学开山鼻祖',
      province: '湖南',
      region: '永州→道县',
      type: '历史人物',
      summary: '主条目摘要',
      score: 1,
      role_in_story: 'primary_entry',
      match_reason: '用户指定',
      keywords: ['周敦颐'],
      knowledge_domain: 'core_china_culture',
      entry_role: 'core_entry',
      era: '宋',
      asset_usage: ['character_clothing'],
      asset_split: {
        characters: ['周敦颐：主角'],
        scenes: ['濂溪书斋：读书场景'],
        character_props: ['手稿：随身物'],
        scene_props: ['书桌：场景陈设'],
      },
    }],
    supporting_entries: [{
      entry_name: 'GEARS场景资产包——洞穴、书院与衙署边界',
      province: '通用',
      region: '通用',
      type: 'GEARS资产模板',
      summary: '洞穴、书院、衙署是场景资产；案卷、油灯等是场景道具/陈设。',
      score: 0.88,
      role_in_story: 'asset_pack',
      match_reason: '自动注入知识包',
      keywords: ['GEARS', '场景资产', '道具'],
      knowledge_domain: 'gears_asset',
      entry_role: 'asset_pack',
      asset_usage: ['scene_space', 'scene_props', 'gears_delivery'],
      asset_split: {
        characters: [],
        scenes: ['洞穴：场景资产', '书院：场景资产'],
        character_props: ['书卷：人物随身物'],
        scene_props: ['案卷：场景陈设', '油灯：场景陈设'],
      },
    }],
    missing_needs: [],
    overall_confidence: 1,
  };
}

describe('story-generation-prompt', () => {
  it('labels domain packs and keeps their use separate from historical facts', () => {
    const request: StoryGenerateRequest = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story',
      original_user_query: '周敦颐月岩悟道传说',
    };

    const pkg = buildStoryGenerationPromptPackage({
      entry: makeEntry(),
      request,
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '',
      knowledgePack: makeKnowledgePack(),
    });

    expect(pkg.user_prompt).toContain('知识域：gears_asset');
    expect(pkg.user_prompt).toContain('用途：scene_space、scene_props、gears_delivery');
    expect(pkg.user_prompt).toContain('资产拆分：人物=周敦颐：主角');
    expect(pkg.user_prompt).toContain('场景=洞穴：场景资产、书院：场景资产');
    expect(pkg.knowledge_context?.primary_entries[0].asset_split?.character_props[0]).toContain('手稿');
    expect(pkg.user_prompt).toContain('不要把设定包内容写成主条目的史实');
  });

  it('includes detected unnamed character hints in the model prompt', () => {
    const request: StoryGenerateRequest = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story',
      original_user_query: '一个老奶奶在洞口点灯，村民围过来听狐仙传说。',
      character_hints: [
        {
          name: '老奶奶',
          role_position: '配角',
          character_kind: 'identity_role',
          source_text: '一个老奶奶在洞口点灯',
          asset_stability: 'single_scene',
          age_range: '老年',
          gender: '女',
        },
        {
          name: '村民',
          role_position: '群演',
          character_kind: 'group_role',
          source_text: '村民围过来听狐仙传说',
          asset_stability: 'single_scene',
          gender: '不适用',
        },
      ],
    };

    const pkg = buildStoryGenerationPromptPackage({
      entry: makeEntry(),
      request,
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '',
      knowledgePack: makeKnowledgePack(),
    });

    expect(pkg.user_prompt).toContain('=== 大纲角色识别 ===');
    expect(pkg.user_prompt).toContain('老奶奶（配角；identity_role；single_scene；老年；女）');
    expect(pkg.user_prompt).toContain('村民（群演；group_role；single_scene；不适用）');
    expect(pkg.user_prompt).toContain('无名角色用稳定身份名');
  });
});
