import { describe, expect, it } from 'vitest';
import { buildStoryGenerationPromptPackage } from '../services/story-generation-prompt.js';
import { buildStoryBlueprint } from '../services/story-blueprint-service.js';
import { buildAdaptationAnalysis } from '../services/adaptation-analysis-service.js';
import { getProductionMaterialPack } from '../services/production-material-pack-service.js';
import { buildProductionMaterialReadinessReport } from '../services/production-material-readiness-service.js';
import type { EntryDetail, KnowledgePack, StoryGenerateRequest, VideoType } from '@shared/types.js';
import {
  buildCreationContract,
  buildMaterialSufficiencyReport,
  materialPackFromKnowledgePack,
} from '../services/creation-contract-service.js';
import { resolveGenreStoryMatrix } from '../services/genre-story-profiles.js';

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
    localCreativeRelations: [
      {
        relation_type: 'related_location',
        target: '长沙岳麓书院',
        description: '可作为长沙讲述周敦颐思想的空间入口，重点在后世书院教育和湖湘学脉阐释。',
      },
      {
        relation_type: 'cultural_influence',
        target: '长沙',
        description: '周敦颐思想可通过岳麓书院、湖湘文教传统和廉洁教育进入长沙叙事。',
      },
      {
        relation_type: 'do_not_write_as',
        target: '长沙',
        description: '不得写成周敦颐在长沙悟道、讲学、写《太极图说》或《爱莲说》。',
      },
    ],
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
      match_reason: '自动注入素材包',
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
      production_prompts: ['把洞穴、书院和衙署拆成独立可拍场景，不混用陈设'],
      review_boundaries: ['不得把通用资产包写成主条目已发生史实'],
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
    expect(pkg.user_prompt).toContain('生产提示：把洞穴、书院和衙署拆成独立可拍场景');
    expect(pkg.user_prompt).toContain('审稿边界：不得把通用资产包写成主条目已发生史实');
    expect(pkg.knowledge_context?.primary_entries[0].asset_split?.character_props[0]).toContain('手稿');
    expect(pkg.knowledge_context?.supporting_entries[0].production_prompts?.[0]).toContain('独立可拍场景');
    expect(pkg.knowledge_context?.supporting_entries[0].review_boundaries?.[0]).toContain('不得把通用资产包写成主条目');
    expect(pkg.system_prompt).toContain('结构化项目素材库，不是资料仓库');
    expect(pkg.user_prompt).toContain('项目素材库不是资料仓库');
    expect(pkg.user_prompt).toContain('先读取素材域、条目角色、时代、用途、资产拆分、可信度和风险提示');
    expect(pkg.output_contract.should_respect).toContain('按结构化项目素材库做创作决策，不把素材包当资料仓库堆砌');
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

  it('includes creation contract, material pack, and material sufficiency in the prompt package', () => {
    const entry = makeEntry();
    const request: StoryGenerateRequest = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'culture_promo',
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
      client_type: '政府机构',
      target_audience: '青少年研学群体',
      communication_goal: '用周敦颐廉洁精神做一支稳妥的文化宣传短片',
      original_user_query: '请做一支机构宣传片，不要虚构人物发言。',
    };
    const materialPack = {
      ...materialPackFromKnowledgePack(makeKnowledgePack(), request),
      brand_or_institution_profile: { client_type: '政府机构' },
      verified_facts: ['周敦颐为北宋理学重要人物。'],
    };
    const materialSufficiency = buildMaterialSufficiencyReport({
      materialPack,
      creationUseCase: 'institutional_promo',
      truthMode: 'institutional_verified',
    });
    const creationContract = buildCreationContract({
      request,
      materialSufficiency,
      creationUseCase: 'institutional_promo',
      truthMode: 'institutional_verified',
      videoType: 'culture_promo',
      presentationStyle: 'voiceover_montage',
      storyStructure: 'object_clue_journey',
      narrativePatternIds: [],
    });
    const genreMatrix = resolveGenreStoryMatrix({
      videoType: 'culture_promo',
      creationUseCase: 'institutional_promo',
      truthMode: 'institutional_verified',
      storyStructure: 'object_clue_journey',
      narrativePatternIds: [],
    });
    const storyBlueprint = buildStoryBlueprint({
      entry,
      videoType: 'culture_promo',
      presentationStyle: 'voiceover_montage',
      storyStructure: 'object_clue_journey',
      targetDuration: '1分钟',
      centralEvent: '廉洁精神',
      knowledgePack: makeKnowledgePack(),
      creationContract,
      materialSufficiency,
      genreMatrix,
    });

    const pkg = buildStoryGenerationPromptPackage({
      entry,
      request,
      videoType: 'culture_promo',
      presentationStyle: 'voiceover_montage',
      storyStructure: 'object_clue_journey',
      targetDuration: '1分钟',
      tone: '',
      knowledgePack: makeKnowledgePack(),
      materialPack,
      materialSufficiency,
      creationContract,
      genreMatrix,
      storyBlueprint,
    });

    expect(pkg.creation_contract?.truth_mode).toBe('institutional_verified');
    expect(pkg.material_pack?.primary_materials[0].purpose).toContain('fact_basis');
    expect(pkg.material_sufficiency?.stage).toBe('script_ready');
    expect(pkg.context.client_type).toBe('政府机构');
    expect(pkg.system_prompt).toContain('真实度模式：institutional_verified');
    expect(pkg.user_prompt).toContain('=== 项目素材包 ===');
    expect(pkg.user_prompt).toContain('素材包使用规则');
    expect(pkg.user_prompt).toContain('=== 素材充分度 ===');
    expect(pkg.user_prompt).toContain('三阶段素材 gate');
    expect(pkg.user_prompt).toContain('production_ready：needs_input');
    expect(pkg.user_prompt).toContain('生成姿态：script_ready_production_pending');
    expect(pkg.user_prompt).toContain('=== 类型片画像矩阵 ===');
    expect(pkg.user_prompt).toContain('推荐叙事流派：brand_symbol、object_clue_journey、social_hook_contrast');
    expect(pkg.user_prompt).toContain('禁止表达：未核实数据、虚构机构成果');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('执行真实度模式：institutional_verified');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('素材生成姿态：script_ready_production_pending');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('类型矩阵机构规则');
    expect(storyBlueprint.type_specific_requirements.join('\n')).toContain('真实度模式：institutional_verified');
    expect(storyBlueprint.type_specific_requirements.join('\n')).toContain('类型矩阵素材要求：主视觉符号');
  });

  it('adds a concrete creative protocol for each video type', () => {
    const cases: Array<{ videoType: VideoType; expectedSystem: string; expectedFields: string[] }> = [
      { videoType: 'character_story', expectedSystem: '主角目标', expectedFields: ['characters', 'protagonist_arc'] },
      { videoType: 'historical_drama', expectedSystem: '史实锚点', expectedFields: ['characters', 'protagonist_arc'] },
      { videoType: 'legend_story', expectedSystem: '传说与史实边界', expectedFields: ['characters'] },
      { videoType: 'culture_promo', expectedSystem: '核心视觉符号', expectedFields: ['visual_symbols', 'core_message', 'slogan_or_key_sentence', 'modern_connection'] },
      { videoType: 'heritage_promo', expectedSystem: '完整流程', expectedFields: ['craft_or_ritual_process', 'modern_connection'] },
      { videoType: 'city_brand_promo', expectedSystem: '品牌主张', expectedFields: ['visual_symbols', 'core_message', 'slogan_or_key_sentence'] },
      { videoType: 'scene_short', expectedSystem: '明确视觉路线', expectedFields: ['spatial_identity', 'visual_route', 'time_layer', 'atmosphere'] },
      { videoType: 'landscape_mood', expectedSystem: '山水意象', expectedFields: ['spatial_identity', 'visual_route', 'time_layer', 'atmosphere'] },
      { videoType: 'documentary_short', expectedSystem: '事实与再现边界', expectedFields: ['source_quotes', 'field_notes'] },
      { videoType: 'explainer_video', expectedSystem: '知识大纲', expectedFields: ['argument_points', 'knowledge_outline'] },
      { videoType: 'lecture_video', expectedSystem: '核心观点', expectedFields: ['argument_points', 'knowledge_outline'] },
      { videoType: 'education_training', expectedSystem: '学习路径', expectedFields: ['argument_points', 'knowledge_outline'] },
      { videoType: 'children_story', expectedSystem: '儿童可理解语言', expectedFields: ['characters', 'protagonist_arc'] },
      { videoType: 'social_short', expectedSystem: '3秒钩子', expectedFields: ['visual_symbols', 'core_message', 'slogan_or_key_sentence'] },
      { videoType: 'ai_comic_drama', expectedSystem: '表情标注', expectedFields: [] },
    ];

    for (const item of cases) {
      const request: StoryGenerateRequest = {
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: item.videoType,
        original_user_query: `${item.videoType} 测试`,
      };

      const pkg = buildStoryGenerationPromptPackage({
        entry: makeEntry(),
        request,
        videoType: item.videoType,
        presentationStyle: 'cinematic',
        storyStructure: 'single_event_drama',
        targetDuration: '3分钟',
        tone: '',
        knowledgePack: makeKnowledgePack(),
      });

      expect(pkg.system_prompt).toContain('类型创作目标');
      expect(pkg.system_prompt).toContain('类型叙事框架');
      expect(pkg.system_prompt).toContain('样片参考类型');
      expect(pkg.user_prompt).toContain('=== 样片化类型规则 ===');
      expect(pkg.user_prompt).toContain('质量信号');
      expect(pkg.user_prompt).toContain('质量信号只作为内部检查清单');
      expect(pkg.user_prompt).toContain('不要出现内部质量标签或检测词');
      expect(pkg.system_prompt).toContain(item.expectedSystem);
      expect(pkg.output_contract.should_respect.length).toBeGreaterThan(8);
      for (const field of item.expectedFields) {
        expect(pkg.output_contract.return_json_fields).toContain(field);
        expect(pkg.user_prompt).toContain(field);
      }
    }
  });

  it('includes the story blueprint in the model prompt', () => {
    const entry = makeEntry();
    const request: StoryGenerateRequest = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story',
      original_user_query: '周敦颐月岩悟道传说',
    };
    const storyBlueprint = buildStoryBlueprint({
      entry,
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      centralEvent: '月岩悟道',
      knowledgePack: makeKnowledgePack(),
    });

    const pkg = buildStoryGenerationPromptPackage({
      entry,
      request,
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '',
      knowledgePack: makeKnowledgePack(),
      storyBlueprint,
    });

    expect(pkg.story_blueprint?.schema_version).toBe('story-blueprint/v1');
    expect(pkg.user_prompt).toContain('=== 类型故事蓝图 ===');
    expect(pkg.user_prompt).toContain('中心问题');
    expect(pkg.user_prompt).toContain('类型节拍');
    expect(pkg.output_contract.should_respect).toEqual(expect.arrayContaining(storyBlueprint.type_specific_requirements));
  });

  it('prioritizes user-selected narrative patterns in the prompt', () => {
    const request: StoryGenerateRequest = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'ai_comic_drama',
      original_user_query: '写成弱者成长和任务压力很强的AI漫剧',
      narrative_pattern_ids: ['infinite_mission', 'mortal_growth'],
    };

    const pkg = buildStoryGenerationPromptPackage({
      entry: makeEntry(),
      request,
      videoType: 'ai_comic_drama',
      presentationStyle: 'ai_comic',
      storyStructure: 'single_event_drama',
      targetDuration: '3分钟',
      tone: '',
      knowledgePack: makeKnowledgePack(),
    });

    expect(pkg.context.narrative_pattern_ids).toEqual(['infinite_mission', 'mortal_growth']);
    expect(pkg.system_prompt).toContain('无限流任务生存');
    expect(pkg.user_prompt).toContain('无限流任务生存（用户强化');
    expect(pkg.user_prompt).toContain('凡人流成长（用户强化');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('无限流任务生存');
  });

  it('auto-selects production material packs by video type only', () => {
    expect(getProductionMaterialPack('heritage_promo')?.label).toBe('非遗/工艺宣传片');
    expect(getProductionMaterialPack('documentary_short')?.label).toBe('微纪录片');
    expect(getProductionMaterialPack('explainer_video')?.label).toBe('知识讲解视频');
    expect(getProductionMaterialPack('ai_comic_drama')?.label).toBe('AI漫剧');
    expect(getProductionMaterialPack('children_story')?.label).toBe('儿童故事片');
    expect(getProductionMaterialPack('social_short')?.label).toBe('竖屏短视频');
    expect(getProductionMaterialPack('lecture_video')?.label).toBe('宣讲片');
    expect(getProductionMaterialPack('education_training')?.label).toBe('教育/培训片');
    expect(getProductionMaterialPack('character_story')).toBeUndefined();
  });

  it('scopes production sample entries to the active source domain', () => {
    const originalChildren = getProductionMaterialPack('children_story', {
      sourceDomain: 'original_fiction',
    });
    const chinaChildren = getProductionMaterialPack('children_story', {
      sourceDomain: 'china_culture',
    });
    const originalSocial = getProductionMaterialPack('social_short', {
      sourceDomain: 'original_fiction',
    });
    const originalComic = getProductionMaterialPack('ai_comic_drama', {
      sourceDomain: 'original_fiction',
    });

    expect(originalChildren?.sample_entries.length).toBeGreaterThan(0);
    expect(originalSocial?.sample_entries.length).toBeGreaterThan(0);
    expect(originalComic?.sample_entries.length).toBeGreaterThan(0);
    expect(originalChildren?.sample_entries.map(item => item.entry_name)).toContain('停电夜的纸飞机队');
    expect(originalSocial?.sample_entries.map(item => item.entry_name)).toContain('同一封信的两个结局');
    expect(originalComic?.sample_entries.map(item => item.entry_name)).toContain('零号站台——只剩一分钟的列车');
    expect(originalComic?.sample_entries.map(item => item.entry_name).join('\n')).not.toMatch(/周敦颐|柳毅|屈原|岳麓书院|年画/);
    expect(originalComic?.sample_entries.every(item =>
      item.applicable_source_domains?.includes('original_fiction'),
    )).toBe(true);

    expect(chinaChildren?.sample_entries.map(item => item.entry_name)).toContain('端午龙舟小鼓手');
    expect(chinaChildren?.sample_entries.map(item => item.entry_name)).not.toContain('停电夜的纸飞机队');
    expect(getProductionMaterialPack('ai_comic_drama')?.sample_entries.length)
      .toBeGreaterThan(originalComic?.sample_entries.length ?? 0);
  });

  it('adds only the current video type production material template to the prompt', () => {
    const request: StoryGenerateRequest = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'ai_comic_drama',
      original_user_query: '写成有单镜头和多分镜验证的AI漫剧',
    };
    const productionMaterialPack = getProductionMaterialPack('ai_comic_drama');
    const productionMaterialReadiness = buildProductionMaterialReadinessReport({
      productionMaterialPack,
      materialPack: materialPackFromKnowledgePack(makeKnowledgePack(), request),
      contextText: request.original_user_query,
    });

    const pkg = buildStoryGenerationPromptPackage({
      entry: makeEntry(),
      request,
      videoType: 'ai_comic_drama',
      presentationStyle: 'ai_comic',
      storyStructure: 'single_event_drama',
      targetDuration: '3分钟',
      tone: '',
      knowledgePack: makeKnowledgePack(),
      productionMaterialPack,
      productionMaterialReadiness,
    });

    expect(pkg.production_material_pack?.video_type).toBe('ai_comic_drama');
    expect(pkg.production_material_readiness?.schema_version).toBe('production-material-readiness/v1');
    expect(pkg.system_prompt).toContain('当前成片类型生产模板：ai_comic_drama/AI漫剧');
    expect(pkg.user_prompt).toContain('=== 当前成片类型生产素材模板 ===');
    expect(pkg.user_prompt).toContain('=== 当前成片类型生产素材缺口 ===');
    expect(pkg.user_prompt).toContain('提示词/生产分层');
    expect(pkg.user_prompt).toContain('单镜头验证');
    expect(pkg.user_prompt).toContain('多分镜验证');
    expect(pkg.user_prompt).toContain('周敦颐拒签冤案');
    expect(pkg.user_prompt).not.toContain('湘绣工坊');
    expect(pkg.user_prompt).not.toContain('岳阳楼与《岳阳楼记》');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('仅使用当前成片类型 production_material_pack：ai_comic_drama/AI漫剧');
  });

  it('keeps the AI comic explainer template out of heritage and documentary prompts', () => {
    const cases: Array<{ videoType: VideoType; label: string; expected: string }> = [
      { videoType: 'heritage_promo', label: '非遗/工艺宣传片', expected: 'materials、tools' },
      { videoType: 'documentary_short', label: '微纪录片', expected: 'real_world_site_or_object' },
    ];

    for (const item of cases) {
      const request: StoryGenerateRequest = {
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: item.videoType,
        original_user_query: `${item.videoType} 测试`,
      };
      const productionMaterialPack = getProductionMaterialPack(item.videoType);

      const pkg = buildStoryGenerationPromptPackage({
        entry: makeEntry(),
        request,
        videoType: item.videoType,
        presentationStyle: 'cinematic',
        storyStructure: 'single_event_drama',
        targetDuration: '3分钟',
        tone: '',
        knowledgePack: makeKnowledgePack(),
        productionMaterialPack,
      });

      expect(pkg.production_material_pack?.label).toBe(item.label);
      expect(pkg.user_prompt).toContain(item.expected);
      expect(pkg.user_prompt).not.toContain('提示词-基础设定');
      expect(pkg.user_prompt).not.toContain('单镜头验证');
      expect(pkg.user_prompt).not.toContain('周敦颐拒签冤案');
      expect(pkg.output_contract.should_respect.join('\n')).toContain(`执行生产素材模板：${item.label}`);
    }
  });

  it('injects second-wave production material templates without leaking AI comic samples', () => {
    const cases: Array<{ videoType: VideoType; label: string; expected: string }> = [
      { videoType: 'children_story', label: '儿童故事片', expected: 'audience_age_band' },
      { videoType: 'social_short', label: '竖屏短视频', expected: 'opening_hook' },
      { videoType: 'lecture_video', label: '宣讲片', expected: 'speaker_position' },
      { videoType: 'education_training', label: '教育/培训片', expected: 'learning_objective' },
    ];

    for (const item of cases) {
      const request: StoryGenerateRequest = {
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: item.videoType,
        original_user_query: `${item.videoType} production template smoke`,
      };
      const productionMaterialPack = getProductionMaterialPack(item.videoType);

      const pkg = buildStoryGenerationPromptPackage({
        entry: makeEntry(),
        request,
        videoType: item.videoType,
        presentationStyle: 'cinematic',
        storyStructure: 'single_event_drama',
        targetDuration: '3分钟',
        tone: '',
        knowledgePack: makeKnowledgePack(),
        productionMaterialPack,
      });

      expect(pkg.production_material_pack?.label).toBe(item.label);
      expect(pkg.user_prompt).toContain(item.expected);
      expect(pkg.user_prompt).not.toContain('提示词-基础设定');
      expect(pkg.user_prompt).not.toContain('周敦颐拒签冤案');
      expect(pkg.output_contract.should_respect.join('\n')).toContain(`执行生产素材模板：${item.label}`);
    }
  });

  it('uses an adaptation protocol when the user provides a novel source', () => {
    const request: StoryGenerateRequest = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'ai_comic_drama',
      original_user_query: '少年阿青在书院门口等雨停，师友误会他偷走旧书，阿青决定留下来查清真相。',
      source_material_mode: 'adapt_user_novel',
      narrative_pattern_ids: ['novel_scene_compression', 'character_arc_adaptation'],
    };

    const pkg = buildStoryGenerationPromptPackage({
      entry: makeEntry(),
      request,
      videoType: 'ai_comic_drama',
      presentationStyle: 'ai_comic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '',
      knowledgePack: makeKnowledgePack(),
    });

    expect(pkg.context.source_material_mode).toBe('adapt_user_novel');
    expect(pkg.system_prompt).toContain('已有小说/故事文本的视频化改编');
    expect(pkg.system_prompt).toContain('不是重新生成一篇小说');
    expect(pkg.user_prompt).toContain('用户原作/改编素材');
    expect(pkg.user_prompt).toContain('不要续写、另写或重写成新小说');
    expect(pkg.output_contract.should_respect).toContain('改编用户已有小说：保留原作主线、人物关系、因果顺序和主题，不另写新故事');
  });

  it('adds client-localized creative boundaries to the prompt', () => {
    const request: StoryGenerateRequest = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story',
      original_user_query: '甲方想做周敦颐在长沙相关的思想文化故事',
      localized_target_region: '长沙',
      localization_mode: 'allow_related_influence',
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

    expect(pkg.context.localized_target_region).toBe('长沙');
    expect(pkg.user_prompt).toContain('甲方指定地域：长沙');
    expect(pkg.user_prompt).toContain('=== 地方化创作关系 ===');
    expect(pkg.user_prompt).toContain('思想文化影响｜长沙');
    expect(pkg.user_prompt).toContain('不可写成｜长沙');
    expect(pkg.user_prompt).toContain('不得写成周敦颐在长沙悟道、讲学');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('围绕甲方指定地域「长沙」创作');
  });

  it('passes user novel adaptation analysis into the prompt contract', () => {
    const source = '少年阿青在书院门口等雨停，师友误会他偷走旧书。阿青决定留下来查清真相。夜里，阿青举着油灯穿过藏书楼。';
    const request: StoryGenerateRequest = {
      video_type: 'ai_comic_drama',
      source_material_mode: 'adapt_user_novel',
      original_user_query: source,
      narrative_pattern_ids: ['novel_scene_compression'],
    };

    const pkg = buildStoryGenerationPromptPackage({
      entry: makeEntry(),
      request,
      videoType: 'ai_comic_drama',
      presentationStyle: 'ai_comic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '',
      knowledgePack: makeKnowledgePack(),
      adaptationAnalysis: buildAdaptationAnalysis(source),
    });

    expect(pkg.adaptation_analysis?.core_characters.some(item => item.includes('阿青'))).toBe(true);
    expect(pkg.user_prompt).toContain('=== 原作改编前置分析 ===');
    expect(pkg.user_prompt).toContain('必须保留');
    expect(pkg.output_contract.should_respect.some(item => item.includes('执行原作保留项'))).toBe(true);
  });
});
