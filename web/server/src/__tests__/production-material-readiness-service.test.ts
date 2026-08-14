import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MaterialPack, ProductionMaterialPack, StoryGenerateResult } from '@shared/types.js';
import { VIDEO_TYPE_CONFIG } from '@shared/types.js';
import {
  getProductionMaterialPack,
  getProductionMaterialPackHealthReport,
  getProductionMaterialPacks,
  scopeProductionMaterialPackToSourceDomain,
} from '../services/production-material-pack-service.js';
import {
  buildProductionMaterialReadinessReport,
  getProductionMaterialFieldSpec,
  refreshStoryProductionMaterialReadiness,
} from '../services/production-material-readiness-service.js';
import { buildAdaptationAnalysis } from '../services/adaptation-analysis-service.js';
import { generateDramaticContent } from '../services/dramatic-story.js';
import { deriveChinaCultureTypeSpecificStoryFields } from '../domains/china-culture/story-type-specific-fields-service.js';

function makeMaterialPack(summary: string): MaterialPack {
  return {
    schema_version: 'material-pack/v1',
    primary_materials: [{
      material_id: 'primary-1',
      title: '测试素材',
      summary,
      source_type: 'knowledge_entry',
      purpose: ['fact_basis'],
      confidence: 0.75,
      tags: ['测试'],
    }],
    supporting_materials: [],
    reference_materials: [],
    visual_assets: [],
    verified_facts: [summary],
    uncertain_claims: ['部分生产素材待核实。'],
    creative_space: [],
    missing_needs: [],
    overall_confidence: 0.75,
  };
}

interface ProductionHealthConformanceCase {
  case_id: string;
  health_policy?: unknown;
  loaded_video_types: string[];
  sample_entries_by_video_type?: Record<string, unknown[]>;
  expected: {
    domain_sample_policy_valid: boolean;
    policy_issue_type: 'missing_domain_sample_policy' | 'invalid_domain_sample_policy' | null;
    duplicate_sample_entry_ids_by_video_type?: Record<string, string[]>;
  };
}

interface ProductionPackStructureConformanceCase {
  case_id: string;
  omit_top_level_fields?: string[];
  top_level_overrides?: Record<string, unknown>;
  omit_material_template_fields?: string[];
  material_template_overrides?: Record<string, unknown>;
  sample_entries?: unknown[];
  expected: {
    loaded_pack_count: number;
    domain_sample_policy_valid: boolean;
  };
}

interface ProductionPackRejectionDiagnostic {
  pack_index: number;
  code: string;
  path: string;
}

interface ProductionPackFileDiagnostic {
  code: string;
  path: string;
}

interface ProductionPackFileStructureConformanceCase {
  case_id: string;
  root_value?: unknown;
  omit_fields?: string[];
  overrides?: Record<string, unknown>;
  expected: {
    pack_file_valid: boolean;
    loaded_pack_count: number;
    diagnostic: ProductionPackFileDiagnostic | null;
  };
}

interface ProductionPackCollectionConformanceCase {
  case_id: string;
  video_type: string;
  first_label: string;
  duplicate_label: string;
  expected: {
    loaded_pack_count: number;
    selected_label: string;
    diagnostic: ProductionPackRejectionDiagnostic;
  };
}

interface ProductionHealthConformanceFixture {
  schema_version: 'production-material-pack-health-conformance/v1';
  supported_video_types: string[];
  valid_domain_minimums: Record<string, number>;
  standard_pack: Record<string, unknown>;
  pack_file_structure_cases: ProductionPackFileStructureConformanceCase[];
  pack_collection_cases: ProductionPackCollectionConformanceCase[];
  pack_structure_cases: ProductionPackStructureConformanceCase[];
  pack_structure_diagnostic_expectations: Record<string, ProductionPackRejectionDiagnostic | null>;
  cases: ProductionHealthConformanceCase[];
}

const productionHealthConformance = JSON.parse(readFileSync(resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'data',
  'production-packs',
  'production-material-pack-health-conformance.json',
), 'utf8')) as ProductionHealthConformanceFixture;

function makeConformancePack(
  videoType: string,
  sampleEntries?: unknown[],
): ProductionMaterialPack {
  return {
    ...productionHealthConformance.standard_pack,
    video_type: videoType,
    sample_entries: sampleEntries ?? Object.keys(productionHealthConformance.valid_domain_minimums)
      .map(sourceDomain => ({
        sample_id: `${videoType}-${sourceDomain}`,
        entry_name: `${videoType} ${sourceDomain}`,
        applicable_source_domains: [sourceDomain],
      })),
  } as unknown as ProductionMaterialPack;
}

function makePackStructureConformancePack(
  testCase: ProductionPackStructureConformanceCase,
): ProductionMaterialPack {
  const pack: Record<string, unknown> = {
    ...productionHealthConformance.standard_pack,
    video_type: 'children_story',
    material_template: {
      ...(productionHealthConformance.standard_pack.material_template as Record<string, unknown>),
    },
    sample_entries: testCase.sample_entries ?? Object.keys(productionHealthConformance.valid_domain_minimums)
      .map(sourceDomain => ({
        sample_id: `children_story-${sourceDomain}`,
        entry_name: `children_story ${sourceDomain}`,
        applicable_source_domains: [sourceDomain],
      })),
  };
  const template = pack.material_template as Record<string, unknown>;
  for (const field of testCase.omit_material_template_fields ?? []) delete template[field];
  Object.assign(template, testCase.material_template_overrides ?? {});
  for (const field of testCase.omit_top_level_fields ?? []) delete pack[field];
  Object.assign(pack, testCase.top_level_overrides ?? {});
  return pack as unknown as ProductionMaterialPack;
}

function makePackFileStructureConformanceValue(
  testCase: ProductionPackFileStructureConformanceCase,
): unknown {
  if ('root_value' in testCase) return testCase.root_value;
  const value: Record<string, unknown> = {
    schema_version: 'video-type-material-supplement-packs/v1',
    health_policy: {
      required_domain_sample_video_types: ['children_story'],
      domain_sample_minimums: {
        children_story: productionHealthConformance.valid_domain_minimums,
      },
    },
    packs: [makeConformancePack('children_story')],
  };
  for (const field of testCase.omit_fields ?? []) delete value[field];
  Object.assign(value, testCase.overrides ?? {});
  return value;
}

describe('production-material-readiness-service', () => {
  it('refreshes generated structured fields without inventing external production evidence', () => {
    const explainerPack = getProductionMaterialPack('explainer_video');
    const heritagePack = getProductionMaterialPack('heritage_promo');
    const baseStory = {
      storyId: 'post-generation-readiness',
      title: '峰林如何形成',
      generation_type: 'character_story',
      video_type: 'explainer_video',
      presentation_style: 'host_narration',
      source_entry: '张家界武陵源',
      logline: '从岩层、抬升与侵蚀解释峰林形成。',
      theme: '地貌形成不是一次完成的雕刻',
      full_text: '核心问题是峰林如何形成。先定义石英砂岩，再看抬升与流水侵蚀，最后用剖面图复盘。',
      scene_breakdown: [],
      gears_segments: [],
      gears_segments_url: '/api/stories/post-generation-readiness/gears-segments',
      cultural_constraints: ['不能用类比替代事实来源。'],
      credibility_note: '来源线索来自知识条目，图示为讲解示意。',
      argument_points: ['岩层提供材料基础', '地壳抬升形成高差', '流水侵蚀切割峰体'],
      knowledge_outline: ['概念定义', '形成步骤', '剖面例子', '事实边界'],
      material_pack: makeMaterialPack('受众为入门游客。核心问题、概念定义、知识步骤、具体例子、图示字幕、来源线索、误区边界和总结记忆句均已明确。'),
    } satisfies StoryGenerateResult;

    const refreshedExplainer = refreshStoryProductionMaterialReadiness({
      ...baseStory,
      production_material_pack: explainerPack,
    });
    const refreshedHeritage = refreshStoryProductionMaterialReadiness({
      ...baseStory,
      video_type: 'heritage_promo',
      production_material_pack: heritagePack,
      material_pack: makeMaterialPack('非遗工艺使用纸张、颜料和刻刀，包含刻版、刷色、套印和晾晒流程；手部动作、传承关系、授权边界、视觉符号、声音质感、当代连接和生产风险均有记录。'),
    });

    expect(refreshedExplainer?.available_fields).toContain('argument_points');
    expect(refreshedExplainer?.missing_fields.map(field => field.field_id)).not.toContain('argument_points');
    expect(refreshedHeritage?.missing_fields.map(field => field.field_id))
      .toContain('official_catalog_or_resource_links');
  });

  it('derives character production fields from the generated character arc and scene evidence', () => {
    const characterPack = getProductionMaterialPack('character_story');
    const story = {
      storyId: 'character-generated-readiness',
      title: '周敦颐拒签冤案',
      generation_type: 'character_story',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      source_entry: '周敦颐——理学开山鼻祖',
      logline: '一名司理参军在上官催逼下拒绝草率画押。',
      theme: '选择必须承担代价',
      full_text: '他逐页核对案卷，拒绝画押，最后让案件重新审理。',
      scene_breakdown: [{
        scene_id: 1,
        title: '案头拒签',
        duration_sec: 30,
        location: '南安军衙',
        time_of_day: '夜',
        dramatic_function: '人物关键选择',
        plot: '周敦颐面对知军王逵的催逼，退回死刑文书。',
        key_action: '逐页核对案卷后停笔',
        characters: ['周敦颐', '王逵'],
        visual_prompt: '木案、烛火、案卷与停笔的手部近景',
        camera_suggestion: '从双人中景推到停笔特写',
        cultural_note: '官职称谓按条目核对，影视对白不作原话引用。',
        conflict: '草率执行与重新核查相冲突',
        dialogue_or_narration: '周敦颐克制地说：案卷仍有疑点，我不能签。',
        source_entries: ['周敦颐——理学开山鼻祖'],
        factual_basis: '条目记录拒签并以辞官相争的事件。',
        fictionalized_elements: ['烛火与停笔节奏为影视化调度。'],
      }],
      gears_segments: [],
      gears_segments_url: '/api/stories/character-generated-readiness/gears-segments',
      cultural_constraints: ['不得把影视对白写成历史原话。'],
      credibility_note: '核心事件来自知识条目；对白与镜头调度为创作补位。',
      characters: [
        { name: '周敦颐', role: 'protagonist', description: '初任南安军、负责核查案卷的司理参军' },
        { name: '王逵', role: 'antagonist', description: '催促画押的知军' },
      ],
      protagonist_arc: [{
        starting_state: '在上官催逼下核查案卷',
        turning_point: '拒绝画押并准备辞官',
        resolution: '案件重审，人物守住司法判断',
      }],
      material_pack: makeMaterialPack('人物与事件素材已确认。'),
      production_material_pack: characterPack,
    } satisfies StoryGenerateResult;

    const refreshed = refreshStoryProductionMaterialReadiness(story);

    expect(refreshed?.available_fields).toEqual(expect.arrayContaining([
      'life_stage_window',
      'relationship_map',
      'dialogue_voice',
      'factual_life_boundary',
      'ending_legacy',
    ]));
  });

  it.each([
    { label: 'knowledge-only', source: undefined },
    {
      label: 'user-adaptation',
      source: [
        '刘海在山路砍樵时遇见胡大姐，她用神异力量替他挡开危机，却没有立刻说明身份。',
        '乡邻的怀疑迫使两人分开；刘海决定相信一路看见的行动，回头寻找胡大姐。',
        '两人共同通过考验，歌声留在山路上；这是民间传说中的讲法。',
      ].join('\n\n'),
    },
  ])('derives the complete legend production chain from the generated $label story', ({ source }) => {
    const legendPack = getProductionMaterialPack('legend_story');
    const legendEntry = {
      name: '刘海砍樵——人仙之恋的湖南民间传说',
      province: '湖南',
      region: '常德→武陵（传说发源地）；长沙（花鼓戏经典改编地）',
      type: '民间故事',
      summary: '武陵樵夫刘海与狐仙胡大姐跨越人仙界限的爱情故事，后来经花鼓戏改编传播。',
      story: [
        '刘海是武陵的一名勤劳樵夫，以砍柴为生。狐仙胡大姐化身女子下凡，在砍柴途中与刘海相遇。',
        '两人相爱后，胡大姐的狐仙身份被揭露，经历一系列考验。最终两人战胜困难。',
        '该传说流传于常德武陵山区及长沙地区，长沙花鼓戏将其加工为舞台经典。',
      ].join('\n\n'),
      culturalSignificance: '传说表现勤劳善良与忠贞选择，并通过湖南花鼓戏经典对唱广泛传播。',
      relatedLocations: [
        { name: '常德武陵山林', description: '传说中的砍樵与相遇场景' },
        { name: '长沙花鼓戏舞台', description: '戏曲改编和传播场景' },
      ],
      keywords: ['刘海砍樵', '胡大姐', '狐仙', '花鼓戏', '武陵', '人仙之恋'],
      sources: ['常德武陵民间口述传说', '湖南花鼓戏经典剧目《刘海砍樵》'],
      credibility: '待核实',
      unverifiedPoints: ['民间口述版本与花鼓戏改编版本存在差异'],
    } satisfies import('@shared/types.js').EntryDetail;
    const generated = generateDramaticContent({
      entry: legendEntry,
      centralEvent: '刘海砍樵与人仙相恋的考验',
      videoType: 'legend_story',
      presentationStyle: 'ink_style',
      targetDuration: '3分钟',
      tone: '温暖传奇',
      ...(source
        ? {
            originalUserQuery: source,
            adaptationAnalysis: buildAdaptationAnalysis(source),
          }
        : {}),
    });
    const story = {
      storyId: `legend-generated-readiness-${source ? 'adaptation' : 'knowledge'}`,
      generation_type: 'character_story',
      video_type: 'legend_story',
      presentation_style: 'ink_style',
      source_entry: legendEntry.name,
      ...generated,
      gears_segments_url: '/api/stories/legend-generated-readiness/gears-segments',
      material_pack: makeMaterialPack('刘海与胡大姐的传说素材已确认。'),
      production_material_pack: legendPack,
      ...(source ? { original_user_query: source } : {}),
    } satisfies StoryGenerateResult;

    const refreshed = refreshStoryProductionMaterialReadiness(story);

    expect(refreshed?.available_fields).toEqual(expect.arrayContaining([
      'legend_source_versions',
      'oral_or_text_lineage',
      'supernatural_rule',
      'mortal_desire',
      'taboo_or_test',
      'transformation_cost',
      'symbolic_motif',
      'regional_variant',
      'ritual_or_custom_link',
      'version_choice',
      'legend_truth_boundary',
      'wonder_ending',
    ]));
    expect(refreshed?.missing_fields).toEqual([]);
    expect(refreshed?.status).toBe('ready');
  });

  it('derives culture-promo audience, montage, voiceover, and representation guidance without inventing rights', () => {
    const culturePack = getProductionMaterialPack('culture_promo');
    const cultureEntry = {
      name: '岳麓书院——千年学府弦歌不绝',
      province: '湖南',
      region: '长沙→岳麓区',
      type: '名胜古迹',
      summary: '岳麓书院以讲学、会讲和今日校园延续湖湘文脉。',
      story: [
        '岳麓书院始建于北宋开宝九年（976年），由潭州太守朱洞创立。',
        '南宋时朱熹与张栻在此会讲，形成开放论辩的学术传统。',
        '书院延续至今，与湖南大学校园和当代学习生活相连。',
      ].join('\n\n'),
      culturalSignificance: '岳麓书院是湖湘文化的重要精神地标，讲学与论辩传统延续到当代教育。',
      relatedLocations: [
        { name: '岳麓书院门庭', description: '门联与空间入口' },
        { name: '岳麓书院讲堂', description: '讲学与会讲空间' },
      ],
      keywords: ['岳麓书院', '朱张会讲', '惟楚有材', '湖湘文脉'],
      sources: ['岳麓书院官方资料'],
      credibility: '基本可靠',
      unverifiedPoints: ['具体会讲对白不可写成历史原话'],
    } satisfies import('@shared/types.js').EntryDetail;
    const generated = generateDramaticContent({
      entry: cultureEntry,
      centralEvent: '岳麓书院千年文脉',
      videoType: 'culture_promo',
      presentationStyle: 'voiceover_montage',
      targetDuration: '1分钟',
      tone: '克制明亮',
    });
    const typeFields = deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'culture_promo',
      storyResult: generated,
      entry: cultureEntry,
    });
    const story = {
      storyId: 'culture-promo-generated-readiness',
      generation_type: 'culture_promo',
      video_type: 'culture_promo',
      presentation_style: 'voiceover_montage',
      source_entry: cultureEntry.name,
      ...generated,
      ...typeFields,
      gears_segments_url: '/api/stories/culture-promo-generated-readiness/gears-segments',
      material_pack: makeMaterialPack('岳麓书院历史与当代教育联系已有知识条目依据。'),
      production_material_pack: culturePack,
    } satisfies StoryGenerateResult;

    const refreshed = refreshStoryProductionMaterialReadiness(story);

    expect(refreshed?.available_fields).toEqual(expect.arrayContaining([
      'cultural_theme',
      'audience_impression',
      'montage_arc',
      'voiceover_register',
      'representation_risk',
    ]));
    expect(refreshed?.missing_fields.map(field => field.field_id)).toEqual(['rights_and_attribution']);
    expect(refreshed?.status).toBe('blocked');
  });

  it('derives documentary ambient sound while keeping interview clip selection external', () => {
    const documentaryPack = getProductionMaterialPack('documentary_short');
    const documentaryEntry = {
      name: '岳麓书院——千年学府弦歌不绝',
      province: '湖南',
      region: '长沙→岳麓区',
      type: '名胜古迹',
      summary: '岳麓书院以讲学、会讲和今日校园延续湖湘文脉。',
      story: [
        '岳麓书院始建于北宋开宝九年（976年），由潭州太守朱洞创立。',
        '南宋时朱熹与张栻在此会讲，形成开放论辩的学术传统。',
        '书院延续至今，与湖南大学校园和当代学习生活相连。',
      ].join('\n\n'),
      culturalSignificance: '岳麓书院讲学与论辩传统延续到当代教育。',
      relatedLocations: [
        { name: '岳麓书院门庭', description: '门联与空间入口' },
        { name: '岳麓书院讲堂', description: '讲学与会讲空间' },
      ],
      keywords: ['岳麓书院', '朱张会讲', '湖湘文脉'],
      sources: ['岳麓书院官方资料'],
      credibility: '基本可靠',
      unverifiedPoints: ['具体会讲对白不可写成历史原话'],
    } satisfies import('@shared/types.js').EntryDetail;
    const generated = generateDramaticContent({
      entry: documentaryEntry,
      centralEvent: '朱张会讲',
      videoType: 'documentary_short',
      presentationStyle: 'documentary',
      targetDuration: '3分钟',
      tone: '克制求证',
    });
    const typeFields = deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'documentary_short',
      storyResult: generated,
      entry: documentaryEntry,
    });
    const story = {
      storyId: 'documentary-generated-readiness',
      generation_type: 'culture_promo',
      video_type: 'documentary_short',
      presentation_style: 'documentary',
      source_entry: documentaryEntry.name,
      ...generated,
      ...typeFields,
      gears_segments_url: '/api/stories/documentary-generated-readiness/gears-segments',
      material_pack: makeMaterialPack('岳麓书院现实地点、历史时间线、朱张会讲来源和有限再现边界已有知识条目依据。'),
      production_material_pack: documentaryPack,
    } satisfies StoryGenerateResult;

    const refreshed = refreshStoryProductionMaterialReadiness(story);

    expect(refreshed?.available_fields).toContain('ambient_sound');
    expect(refreshed?.missing_fields.map(field => field.field_id)).toContain('interview_clip_selection');
    expect(refreshed?.available_fields).not.toContain('interview_clip_selection');
  });

  it('derives the complete landscape production plan only from layered and bounded scenes', () => {
    const landscapePack = getProductionMaterialPack('landscape_mood');
    const landscapeEntry = {
      name: '张家界武陵源——3.8亿年雕琢的世界自然遗产',
      province: '湖南',
      region: '张家界→武陵源',
      type: '自然景观',
      summary: '武陵源以石英砂岩峰林地貌、峡谷、溪流和云雾景观闻名。',
      story: '武陵源的石英砂岩峰林在流水侵蚀、风化与崩塌等长期作用下形成。',
      culturalSignificance: '自然景观应在准确地名与季节边界下呈现。',
      relatedLocations: [{ name: '武陵源风景名胜区', description: '石英砂岩峰林集中分布区域' }],
      keywords: ['武陵源', '峰林', '云雾', '溪流'],
      sources: ['武陵源官方地质科普资料'],
      credibility: '基本可靠',
      unverifiedPoints: ['具体云海、光线和可见度受季节与天气影响'],
    } satisfies import('@shared/types.js').EntryDetail;
    const generated = generateDramaticContent({
      entry: landscapeEntry,
      centralEvent: '武陵源峰林云雾的一日变化',
      videoType: 'landscape_mood',
      presentationStyle: 'ink_style',
      targetDuration: '3分钟',
      tone: '空灵克制',
    });
    const typeFields = deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'landscape_mood',
      storyResult: generated,
      entry: landscapeEntry,
    });
    const story = {
      storyId: 'landscape-generated-readiness',
      generation_type: 'culture_promo',
      video_type: 'landscape_mood',
      presentation_style: 'ink_style',
      source_entry: landscapeEntry.name,
      ...generated,
      ...typeFields,
      gears_segments_url: '/api/stories/landscape-generated-readiness/gears-segments',
      material_pack: makeMaterialPack('武陵源现实地点、峰林地貌和天气不确定性已有知识条目依据。'),
      production_material_pack: landscapePack,
    } satisfies StoryGenerateResult;

    const refreshed = refreshStoryProductionMaterialReadiness(story);

    expect(refreshed?.available_fields).toEqual(expect.arrayContaining([
      'foreground_midground_background',
      'color_palette',
      'camera_rhythm',
      'soundscape_layers',
      'human_scale_reference',
      'landscape_claim_boundary',
    ]));
    expect(refreshed?.missing_fields).toEqual([]);
    expect(refreshed?.status).toBe('ready');
  });

  it('derives city-brand production guidance while keeping location permission external', () => {
    const cityPack = getProductionMaterialPack('city_brand_promo');
    const cityEntry = {
      name: '岳麓书院——千年学府弦歌不绝',
      province: '湖南',
      region: '长沙→岳麓区',
      type: '名胜古迹',
      summary: '岳麓书院以讲学、会讲和今日校园延续湖湘文脉。',
      story: '岳麓书院始建于北宋开宝九年（976年）。\n\n南宋时朱熹与张栻在此会讲。\n\n书院延续至今。',
      culturalSignificance: '讲学与论辩传统延续到当代教育。',
      relatedLocations: [
        { name: '岳麓书院', description: '书院空间与门联' },
        { name: '爱晚亭', description: '岳麓山文教山水节点' },
      ],
      keywords: ['岳麓书院', '朱张会讲', '惟楚有材', '湖湘文脉'],
      sources: ['岳麓书院官方资料'],
      credibility: '基本可靠',
      unverifiedPoints: ['具体活动、游客和场地开放状态须另行核验'],
    } satisfies import('@shared/types.js').EntryDetail;
    const generated = generateDramaticContent({
      entry: cityEntry,
      centralEvent: '长沙岳麓书院文脉与当代生活',
      videoType: 'city_brand_promo',
      presentationStyle: 'voiceover_montage',
      targetDuration: '3分钟',
      tone: '明亮克制',
    });
    const typeFields = deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'city_brand_promo',
      storyResult: generated,
      entry: cityEntry,
    });
    const story = {
      storyId: 'city-brand-generated-readiness',
      generation_type: 'culture_promo',
      video_type: 'city_brand_promo',
      presentation_style: 'voiceover_montage',
      source_entry: cityEntry.name,
      ...generated,
      ...typeFields,
      gears_segments_url: '/api/stories/city-brand-generated-readiness/gears-segments',
      material_pack: makeMaterialPack('长沙岳麓书院的年代、会讲、城市空间和当代教育联系已有知识条目依据。'),
      production_material_pack: cityPack,
    } satisfies StoryGenerateResult;

    const refreshed = refreshStoryProductionMaterialReadiness(story);

    expect(refreshed?.available_fields).toEqual(expect.arrayContaining([
      'city_identity',
      'target_audience',
      'route_or_spatial_axis',
      'city_soundscape',
      'visitor_action',
      'weather_contingency',
    ]));
    expect(refreshed?.missing_fields.map(field => field.field_id)).toEqual(['location_permissions']);
    expect(refreshed?.available_fields).not.toContain('location_permissions');
    expect(refreshed?.status).toBe('blocked');
  });

  it('matches the shared production health conformance matrix', () => {
    expect(productionHealthConformance.schema_version)
      .toBe('production-material-pack-health-conformance/v1');
    expect([...productionHealthConformance.supported_video_types].sort())
      .toEqual(Object.keys(VIDEO_TYPE_CONFIG).sort());

    for (const testCase of productionHealthConformance.cases) {
      const packs = testCase.loaded_video_types.map(videoType => makeConformancePack(
        videoType,
        testCase.sample_entries_by_video_type?.[videoType],
      ));
      const report = getProductionMaterialPackHealthReport({
        generatedAt: '2026-07-17T00:00:00.000Z',
        productionMaterialPacks: packs,
        requiredVideoTypes: [],
        coreVideoTypes: [],
        highFrequencyVideoTypes: [],
        domainSamplePolicy: testCase.health_policy,
      });
      const policyIssue = report.issues.find(issue =>
        issue.issue_type === 'missing_domain_sample_policy'
        || issue.issue_type === 'invalid_domain_sample_policy');

      expect(report.domain_sample_policy_valid, testCase.case_id)
        .toBe(testCase.expected.domain_sample_policy_valid);
      expect(policyIssue?.issue_type ?? null, testCase.case_id)
        .toBe(testCase.expected.policy_issue_type);
      for (const [videoType, duplicateIds] of Object.entries(
        testCase.expected.duplicate_sample_entry_ids_by_video_type ?? {},
      )) {
        expect(
          report.packs.find(pack => pack.video_type === videoType)?.duplicate_sample_entry_ids,
          testCase.case_id,
        ).toEqual(duplicateIds);
      }
    }
  });

  it('filters malformed injected packs using the shared structure matrix', () => {
    for (const testCase of productionHealthConformance.pack_structure_cases) {
      const report = getProductionMaterialPackHealthReport({
        generatedAt: '2026-07-17T00:00:00.000Z',
        productionMaterialPacks: [makePackStructureConformancePack(testCase)],
        requiredVideoTypes: [],
        coreVideoTypes: [],
        highFrequencyVideoTypes: [],
        domainSamplePolicy: {
          required_domain_sample_video_types: ['children_story'],
          domain_sample_minimums: {
            children_story: productionHealthConformance.valid_domain_minimums,
          },
        },
      });

      expect(report.pack_count, testCase.case_id).toBe(testCase.expected.loaded_pack_count);
      expect(report.domain_sample_policy_valid, testCase.case_id)
        .toBe(testCase.expected.domain_sample_policy_valid);
      const expectedDiagnostic = productionHealthConformance
        .pack_structure_diagnostic_expectations[testCase.case_id];
      expect(report.rejected_pack_count, testCase.case_id).toBe(expectedDiagnostic ? 1 : 0);
      expect(report.rejected_pack_diagnostics, testCase.case_id)
        .toEqual(expectedDiagnostic ? [expectedDiagnostic] : []);
    }
  });

  it('fails closed with shared diagnostics for malformed pack file roots', () => {
    for (const testCase of productionHealthConformance.pack_file_structure_cases) {
      const report = getProductionMaterialPackHealthReport({
        productionMaterialPackFile: makePackFileStructureConformanceValue(testCase),
        requiredVideoTypes: ['children_story'],
        coreVideoTypes: [],
        highFrequencyVideoTypes: [],
      });
      expect(report.pack_file_valid, testCase.case_id)
        .toBe(testCase.expected.pack_file_valid);
      expect(report.pack_file_diagnostics, testCase.case_id)
        .toEqual(testCase.expected.diagnostic ? [testCase.expected.diagnostic] : []);
      expect(report.pack_count, testCase.case_id).toBe(testCase.expected.loaded_pack_count);
      expect(
        report.issues.some(issue => issue.issue_type === 'invalid_pack_file_structure'),
        testCase.case_id,
      ).toBe(!testCase.expected.pack_file_valid);
      if (!testCase.expected.pack_file_valid) {
        expect(report.covered_required_video_types, testCase.case_id).toEqual([]);
        expect(report.domain_sample_policy_valid, testCase.case_id).toBe(false);
      }
    }
  });

  it('keeps the first pack and rejects later duplicate video types', () => {
    for (const testCase of productionHealthConformance.pack_collection_cases) {
      const firstPack = {
        ...makeConformancePack(testCase.video_type),
        label: testCase.first_label,
      } as ProductionMaterialPack;
      const duplicatePack = {
        ...makeConformancePack(testCase.video_type),
        label: testCase.duplicate_label,
      } as ProductionMaterialPack;
      const report = getProductionMaterialPackHealthReport({
        productionMaterialPacks: [firstPack, duplicatePack],
        domainSamplePolicy: {
          required_domain_sample_video_types: [testCase.video_type],
          domain_sample_minimums: {
            [testCase.video_type]: productionHealthConformance.valid_domain_minimums,
          },
        },
        requiredVideoTypes: [testCase.video_type as keyof typeof VIDEO_TYPE_CONFIG],
        coreVideoTypes: [],
        highFrequencyVideoTypes: [],
      });

      expect(report.pack_count, testCase.case_id).toBe(testCase.expected.loaded_pack_count);
      expect(report.rejected_pack_count, testCase.case_id).toBe(1);
      expect(report.rejected_pack_diagnostics, testCase.case_id)
        .toEqual([testCase.expected.diagnostic]);
      expect(report.packs.map(pack => pack.label), testCase.case_id)
        .toEqual([testCase.expected.selected_label]);
      expect(report.domain_sample_policy_valid, testCase.case_id).toBe(true);
      expect(report.covered_required_video_types, testCase.case_id)
        .toEqual([testCase.video_type]);
      expect(report.issues, testCase.case_id).toEqual(expect.arrayContaining([
        expect.objectContaining({ issue_type: 'duplicate_pack_video_type' }),
      ]));
    }
  });

  it('keeps production material packs mapped to readiness field specs', () => {
    const packs = getProductionMaterialPacks();
    const report = getProductionMaterialPackHealthReport({ generatedAt: '2026-07-06T00:00:00.000Z' });

    expect(report.schema_version).toBe('production-material-pack-health/v1');
    expect(report.status).toBe('passed');
    expect(report.domain_sample_policy_valid).toBe(true);
    expect(report.domain_sample_policy_video_types).toEqual([
      'ai_comic_drama',
      'children_story',
      'social_short',
    ]);
    expect(report.pack_file_valid).toBe(true);
    expect(report.pack_file_diagnostics).toEqual([]);
    expect(report.pack_count).toBe(packs.length);
    expect(report.rejected_pack_count).toBe(0);
    expect(report.rejected_pack_diagnostics).toEqual([]);
    expect(report.missing_required_video_types).toHaveLength(0);
    expect(report.issues).toHaveLength(0);

    for (const pack of packs) {
      for (const fieldId of pack.material_template.required_fields) {
        expect(getProductionMaterialFieldSpec(fieldId), `${pack.video_type}:${fieldId}`).toBeTruthy();
      }
    }
  });

  it('covers all 15 video types with production-depth templates and sample floors', () => {
    const packs = getProductionMaterialPacks();
    const configuredVideoTypes = Object.keys(VIDEO_TYPE_CONFIG).sort();
    const packedVideoTypes = packs.map(pack => pack.video_type).sort();
    const totalRequiredFieldCount = packs.reduce(
      (total, pack) => total + pack.material_template.required_fields.length,
      0,
    );

    expect(packedVideoTypes).toEqual(configuredVideoTypes);
    expect(packs).toHaveLength(15);
    expect(totalRequiredFieldCount).toBeGreaterThanOrEqual(184);

    for (const pack of packs) {
      expect(pack.sample_entries.length, `${pack.video_type}:samples`).toBeGreaterThanOrEqual(5);
      expect(pack.material_template.required_fields.length, `${pack.video_type}:fields`)
        .toBeGreaterThanOrEqual(10);
      expect(pack.material_template.prompt_layers?.length, `${pack.video_type}:prompt_layers`)
        .toBeGreaterThanOrEqual(4);
      expect(pack.material_template.supplement_questions.length, `${pack.video_type}:questions`)
        .toBeGreaterThanOrEqual(4);
    }
  });

  it('ships cross-regional failure-and-repair samples for every M3 expansion pack', () => {
    const expansionVideoTypes = [
      'character_story',
      'historical_drama',
      'legend_story',
      'culture_promo',
      'city_brand_promo',
      'scene_short',
      'landscape_mood',
    ] as const;

    for (const videoType of expansionVideoTypes) {
      const pack = getProductionMaterialPack(videoType);
      const regionalAnchors = new Set(pack?.sample_entries.map(sample => sample.regional_anchor));

      expect(pack, videoType).toBeTruthy();
      expect(regionalAnchors.size, `${videoType}:regions`).toBeGreaterThanOrEqual(4);
      expect(pack?.sample_entries.every(sample => Boolean(sample.failure_pattern)), `${videoType}:failures`)
        .toBe(true);
      expect(pack?.sample_entries.every(sample => Boolean(sample.repair_strategy)), `${videoType}:repairs`)
        .toBe(true);
    }
  });

  it('fails closed when an injected production pack set omits its domain sample policy', () => {
    const report = getProductionMaterialPackHealthReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      productionMaterialPacks: [],
      requiredVideoTypes: [],
      coreVideoTypes: [],
      highFrequencyVideoTypes: [],
    });

    expect(report.domain_sample_policy_valid).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_domain_sample_policy',
      }),
    ]));
  });

  it('fails closed when an injected domain sample policy contains a non-positive minimum', () => {
    const report = getProductionMaterialPackHealthReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      productionMaterialPacks: [],
      requiredVideoTypes: [],
      coreVideoTypes: [],
      highFrequencyVideoTypes: [],
      domainSamplePolicy: {
        required_domain_sample_video_types: ['children_story'],
        domain_sample_minimums: {
          children_story: { china_culture: 0, original_fiction: 2 },
        },
      },
    });

    expect(report.domain_sample_policy_valid).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'invalid_domain_sample_policy',
      }),
    ]));
  });

  it('fails closed when a domain sample policy references a pack that was not loaded', () => {
    const report = getProductionMaterialPackHealthReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      productionMaterialPacks: [],
      requiredVideoTypes: [],
      coreVideoTypes: [],
      highFrequencyVideoTypes: [],
      domainSamplePolicy: {
        required_domain_sample_video_types: ['children_story'],
        domain_sample_minimums: {
          children_story: { china_culture: 2, original_fiction: 2 },
        },
      },
    });

    expect(report.domain_sample_policy_valid).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'invalid_domain_sample_policy',
        details: expect.arrayContaining([
          'policy video_type=children_story has no loaded ProductionMaterialPack',
        ]),
      }),
    ]));
  });

  it('holds core production-ready video types to sample and prompt coverage gates', () => {
    const report = getProductionMaterialPackHealthReport({ generatedAt: '2026-07-06T00:00:00.000Z' });

    expect(report.production_ready_core_video_types).toEqual(expect.arrayContaining([
      'heritage_promo',
      'documentary_short',
      'ai_comic_drama',
      'explainer_video',
    ]));

    for (const videoType of report.core_video_types) {
      const summary = report.packs.find(pack => pack.video_type === videoType);
      expect(summary, videoType).toBeTruthy();
      expect(summary?.status).toBe('passed');
      expect(summary?.sample_entry_count).toBeGreaterThanOrEqual(10);
      expect(summary?.prompt_layer_count).toBeGreaterThanOrEqual(4);
      expect(summary?.supplement_question_count).toBeGreaterThanOrEqual(4);
      expect(summary?.gate_item_counts.minimum_viable_story).toBeGreaterThanOrEqual(3);
      expect(summary?.gate_item_counts.script_ready).toBeGreaterThanOrEqual(3);
      expect(summary?.gate_item_counts.production_ready).toBeGreaterThanOrEqual(3);
    }
  });

  it('reports source-domain sample coverage for every cross-domain production pack', () => {
    const report = getProductionMaterialPackHealthReport({ generatedAt: '2026-07-17T00:00:00.000Z' });

    for (const videoType of ['children_story', 'social_short', 'ai_comic_drama'] as const) {
      const summary = report.packs.find(pack => pack.video_type === videoType);
      expect(summary, videoType).toBeTruthy();
      expect(summary?.sample_entry_count_by_source_domain.china_culture, videoType).toBeGreaterThanOrEqual(2);
      expect(summary?.sample_entry_count_by_source_domain.original_fiction, videoType).toBeGreaterThanOrEqual(2);
      expect(summary?.minimum_sample_entry_count_by_source_domain).toEqual({
        china_culture: 2,
        original_fiction: 2,
      });
      expect(summary?.legacy_sample_entry_count).toBe(0);
    }
    expect(report.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ issue_type: 'underfilled_domain_sample_entries' }),
    ]));
  });

  it('counts legacy samples only for china_culture and warns when original coverage is thin', () => {
    const legacyPack: ProductionMaterialPack = {
      video_type: 'children_story',
      label: 'legacy children pack',
      goal: 'test domain coverage',
      material_template: {
        required_fields: [],
        prompt_layers: ['one', 'two', 'three', 'four'],
        minimum_viable_story_gate: ['one', 'two', 'three'],
        script_ready_gate: ['one', 'two', 'three'],
        production_ready_gate: ['one', 'two', 'three'],
        supplement_questions: ['one', 'two', 'three', 'four'],
      },
      sample_entries: [
        { sample_id: 'legacy-1', entry_name: 'legacy china sample' },
        {
          sample_id: 'original-1',
          entry_name: 'explicit original sample',
          applicable_source_domains: ['original_fiction'],
        },
        {
          sample_id: 'original-1',
          entry_name: 'duplicate original sample',
          applicable_source_domains: ['original_fiction'],
        },
      ],
    };
    const report = getProductionMaterialPackHealthReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      productionMaterialPacks: [legacyPack],
      requiredVideoTypes: ['children_story'],
      coreVideoTypes: [],
      highFrequencyVideoTypes: ['children_story'],
      highFrequencyMinimumSampleEntries: 2,
      domainSamplePolicy: {
        required_domain_sample_video_types: ['children_story'],
        domain_sample_minimums: {
          children_story: { china_culture: 2, original_fiction: 2 },
        },
      },
    });
    const summary = report.packs[0];

    expect(summary.sample_entry_count_by_source_domain).toEqual({
      china_culture: 1,
      original_fiction: 1,
    });
    expect(summary.sample_entry_count).toBe(3);
    expect(summary.unique_sample_entry_count).toBe(2);
    expect(summary.duplicate_sample_entry_ids).toEqual(['original-1']);
    expect(summary.legacy_sample_entry_count).toBe(1);
    expect(scopeProductionMaterialPackToSourceDomain(legacyPack, 'original_fiction').sample_entries)
      .toEqual([expect.objectContaining({ sample_id: 'original-1' })]);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        issue_type: 'duplicate_sample_entry',
        video_type: 'children_story',
      }),
      expect.objectContaining({
        issue_type: 'underfilled_domain_sample_entries',
        video_type: 'children_story',
        source_domain: 'original_fiction',
      }),
    ]));
  });

  it('keeps original-fiction supported production templates free from china-culture-only defaults', () => {
    const crossDomainPacks = ['children_story', 'social_short', 'ai_comic_drama']
      .map(videoType => getProductionMaterialPack(videoType as 'children_story' | 'social_short' | 'ai_comic_drama'));

    for (const pack of crossDomainPacks) {
      expect(pack).toBeTruthy();
      const activeTemplateText = JSON.stringify({
        goal: pack!.goal,
        material_template: pack!.material_template,
      });
      expect(activeTemplateText, pack!.video_type).not.toMatch(
        /把文化(?:素材|材料)|文化符号|解释文化知识|保护文化的意义|真实人物\/机构\/历史素材的虚构边界/,
      );
    }
  });

  it('builds type-specific missing field reports for AI comic drama', () => {
    const pack = getProductionMaterialPack('ai_comic_drama');
    const materialPack = makeMaterialPack('第一格钩子：少年在书院门口发现旧书。主角目标是查清误会，对手压力来自同窗质疑。场景锚点是岳麓书院夜色，真实度为原创虚构。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.schema_version).toBe('production-material-readiness/v1');
    expect(report?.video_type).toBe('ai_comic_drama');
    expect(report?.available_fields).toEqual(expect.arrayContaining(['episode_hook', 'protagonist_goal', 'scene_anchor']));
    expect(report?.missing_fields.map(field => field.field_id)).toContain('reference_images_or_keyframes');
    expect(report?.missing_fields.map(field => field.field_id)).toContain('identity_motion_consistency_plan');
    expect(report?.recommended_next_questions.length).toBeGreaterThan(0);
  });

  it('carries Domain Pack trace into readiness without claiming human review or changing the score', () => {
    const pack = getProductionMaterialPack('heritage_promo');
    const materialPack = makeMaterialPack('非遗工艺素材：记录材料、工具和制作流程。');
    const baseline = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });
    const traced = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      domainPackContext: {
        schema_version: 'story-domain-pack-context/v1',
        selected_packs: [{
          entry_name: '非遗流程生产包——材料工具、工序动作与授权边界',
          knowledge_domain: 'production_process',
          entry_role: 'asset_pack',
          production_prompts: ['把材料、工具和工序动作拆成可拍步骤。'],
          review_boundaries: ['通用流程包不能替代具体项目工序核验。'],
        }],
        production_prompt_count: 1,
        review_boundary_count: 1,
        machine_validation_only: true,
        human_review_complete: false,
        real_credit_granted: false,
      },
    });

    expect(traced?.score).toBe(baseline?.score);
    expect(traced?.available_fields).toEqual(baseline?.available_fields);
    expect(traced?.domain_pack_context).toMatchObject({
      selected_packs: [expect.objectContaining({ entry_name: '非遗流程生产包——材料工具、工序动作与授权边界' })],
      machine_validation_only: true,
      human_review_complete: false,
      real_credit_granted: false,
    });
  });

  it('does not count missing needs as production material evidence', () => {
    const pack = getProductionMaterialPack('ai_comic_drama');
    const materialPack = {
      ...makeMaterialPack('第一格钩子：少年在书院门口发现旧书。主角目标是查清误会。'),
      missing_needs: [{
        need_id: 'production_template_reference_images_or_keyframes',
        label: '参考图或关键帧',
        message: '参考图或关键帧待补。',
      }],
    };

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.available_fields).not.toContain('reference_images_or_keyframes');
    expect(report?.missing_fields.map(field => field.field_id)).toContain('reference_images_or_keyframes');
  });

  it('does not use AI comic fields for heritage production readiness', () => {
    const pack = getProductionMaterialPack('heritage_promo');
    const materialPack = makeMaterialPack('非遗工艺素材：以纸张、颜料和刻刀为核心，记录刻版、刷色、套印、晾晒等制作流程。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.video_type).toBe('heritage_promo');
    expect(report?.missing_fields.map(field => field.field_id)).toContain('official_catalog_or_resource_links');
    expect(report?.missing_fields.map(field => field.field_id)).not.toContain('single_shot_test');
    expect(report?.gate_reports.some(gate => gate.stage === 'production_ready')).toBe(true);
  });

  it('builds explainer video readiness from knowledge structure evidence', () => {
    const pack = getProductionMaterialPack('explainer_video');
    const materialPack = makeMaterialPack('核心问题：为什么非遗素材不能只写匠心？受众是研学入门观众。知识大纲分为材料、工具、步骤、来源边界；论点是每个知识层级都要有例子、图示字幕和总结记忆点。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.video_type).toBe('explainer_video');
    expect(report?.available_fields).toEqual(expect.arrayContaining([
      'core_question',
      'audience_level',
      'argument_points',
      'knowledge_outline',
      'concrete_examples',
      'diagram_or_caption_plan',
      'recap_sentence',
    ]));
    expect(report?.missing_fields.map(field => field.field_id)).toContain('concept_definitions');
    expect(report?.missing_fields.map(field => field.field_id)).not.toContain('single_shot_test');
  });

  it('builds children story readiness from age band and safe conflict evidence', () => {
    const pack = getProductionMaterialPack('children_story');
    const materialPack = makeMaterialPack('目标儿童为7-9岁。核心问题：为什么端午要听龙舟鼓点？具体例子是孩子跟着鼓点学会配合。主角选择先听同伴再敲鼓，温和阻力来自节奏误会；文化符号是小鼓、粽叶和江面队形。结尾有情绪安放和家长复盘，事实边界提示屈原传说与地方竞渡习俗分层，不得写成单一事实。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.video_type).toBe('children_story');
    expect(report?.available_fields).toEqual(expect.arrayContaining([
      'audience_age_band',
      'core_question',
      'child_safe_conflict',
      'protagonist_choice',
      'wonder_or_cultural_symbol',
      'emotional_resolution',
      'parent_teacher_note',
      'misconception_or_boundary',
      'forbidden_claims',
    ]));
  });

  it('uses original-fiction story markers and project-rights labels for children readiness', () => {
    const pack = getProductionMaterialPack('children_story');
    const materialPack = makeMaterialPack('目标儿童为7-9岁。核心问题是小满是否愿意把旧伞还给朋友；主角选择先道歉再一起修伞，温和阻力来自误会。故事标志物是会随心情变色的旧伞，结尾完成情绪安放；家长提示孩子讨论选择，项目设定与权利边界不得混同现实授权。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      sourceDomain: 'original_fiction',
    });

    expect(report?.available_fields).toContain('wonder_or_cultural_symbol');
    expect(getProductionMaterialFieldSpec('wonder_or_cultural_symbol', 'original_fiction')).toMatchObject({
      label: '奇观或故事标志物',
      keywords: expect.arrayContaining(['故事标志物', '关键物件', '视觉意象']),
    });
  });

  it('recognizes original-fiction social material and rights cues without culture-source wording', () => {
    const pack = getProductionMaterialPack('social_short');
    const materialPack = makeMaterialPack('前三秒开场提出问题，9:16竖屏短视频每10秒推进一次剧情。人物选择形成讨论焦点，评论互动邀请观众判断另一种选择；项目素材入口为原创大纲 v3 和角色设定稿，项目/权利边界卡标出创作者确认与授权待核。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      sourceDomain: 'original_fiction',
    });

    expect(report?.available_fields).toEqual(expect.arrayContaining([
      'share_trigger',
      'source_cues',
      'fact_boundary_card',
    ]));
    expect(getProductionMaterialFieldSpec('source_cues', 'original_fiction')?.label)
      .toBe('项目素材/权利线索');
    expect(getProductionMaterialFieldSpec('fact_boundary_card', 'original_fiction')?.label)
      .toBe('项目/权利边界卡');
  });

  it('recognizes an original-fiction AI comic world rule as truth-mode evidence', () => {
    const pack = getProductionMaterialPack('ai_comic_drama');
    const materialPack = {
      ...makeMaterialPack('第一格钩子是雨停在半空。原创设定采用架空都市，世界规则是角色说谎时影子会消失；主角目标是找回妹妹，对手压力来自追踪者，场景锚点是废弃车站。'),
      uncertain_claims: [],
    };

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      sourceDomain: 'original_fiction',
    });

    expect(report?.available_fields).toContain('world_and_truth_mode');
  });

  it('does not treat a generic pending-verification note as world-and-truth-mode evidence', () => {
    const pack = getProductionMaterialPack('ai_comic_drama');
    const materialPack = makeMaterialPack('第一格钩子是少年打开一封信，主角目标是找到寄信人；对手压力来自追踪者，场景锚点是旧车站。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      sourceDomain: 'original_fiction',
    });

    expect(report?.available_fields).not.toContain('world_and_truth_mode');
    expect(report?.missing_fields.map(field => field.field_id)).toContain('world_and_truth_mode');
  });

  it('builds social short readiness from hook and vertical rhythm evidence', () => {
    const pack = getProductionMaterialPack('social_short');
    const materialPack = makeMaterialPack('前三秒开场钩子：这句名文常被误解。平台语境是9:16竖屏短视频，核心问题是作者是否亲临岳阳楼。每10秒有字幕转折和事实边界卡，分享触发点是原来如此的反转，评论提示是你还听过哪些误解；来源线索来自文本和展陈。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.video_type).toBe('social_short');
    expect(report?.available_fields).toEqual(expect.arrayContaining([
      'opening_hook',
      'platform_context',
      'core_question',
      'share_trigger',
      'beat_interval',
      'vertical_shot_plan',
      'comment_prompt',
      'source_cues',
      'fact_boundary_card',
    ]));
  });

  it('builds lecture and training readiness from teaching structure evidence', () => {
    const lecturePack = getProductionMaterialPack('lecture_video');
    const trainingPack = getProductionMaterialPack('education_training');
    const materialPack = makeMaterialPack('主讲人是老师，传播目标是让观众理解书院既是建筑也是教育空间。论点包括空间、制度和当代研学，案例来自岳麓书院；知识大纲、概念定义、板书、图示和字幕资产已列出，来源线索来自馆方展陈，误区边界是不把后世影响写成本人亲历。学习目标是学会拆分空间功能，学习者为中学生，步骤序列为先看门额、再看讲堂、最后复盘；练习任务是给一个旧址列三类画面，掌握检查用判断题，受众带走点是事实分层。');

    const lectureReport = buildProductionMaterialReadinessReport({
      productionMaterialPack: lecturePack,
      materialPack,
    });
    const trainingReport = buildProductionMaterialReadinessReport({
      productionMaterialPack: trainingPack,
      materialPack,
    });

    expect(lectureReport?.video_type).toBe('lecture_video');
    expect(lectureReport?.available_fields).toEqual(expect.arrayContaining([
      'speaker_position',
      'communication_goal',
      'argument_points',
      'case_examples',
      'knowledge_outline',
      'slide_or_board_assets',
      'source_cues',
      'audience_takeaway',
      'misconception_or_boundary',
    ]));
    expect(trainingReport?.video_type).toBe('education_training');
    expect(trainingReport?.available_fields).toEqual(expect.arrayContaining([
      'learning_objective',
      'learner_profile',
      'knowledge_outline',
      'concept_definitions',
      'step_sequence',
      'case_examples',
      'practice_task',
      'assessment_check',
      'slide_or_board_assets',
      'audience_takeaway',
      'source_cues',
      'misconception_or_boundary',
    ]));
  });

  it('derives training definitions and assessment only from executable teaching scenes', () => {
    const trainingPack = getProductionMaterialPack('education_training');
    const baseStory = {
      storyId: 'training-generated-readiness',
      title: '认识书院的历史层次',
      generation_type: 'culture_promo',
      video_type: 'education_training',
      presentation_style: 'host_narration',
      source_entry: '岳麓书院',
      logline: '用现场对象区分地点、事件与文化解释。',
      theme: '先辨对象，再核时间层',
      full_text: '第一层看地点，第二层看事件，第三层辨文化解释。',
      scene_breakdown: [{
        scene_id: 1,
        title: '分层讲授',
        duration_sec: 30,
        location: '岳麓书院',
        time_of_day: '白天',
        dramatic_function: '知识讲授',
        plot: '第一层看岳麓书院，确认地点对象；第二层看朱张会讲，确认历史事件；第三层看匾额在今天的使用，区分文化解释。',
        key_action: '把三张对象卡按地点、事件、文化解释分类',
        characters: ['主讲人'],
        visual_prompt: '三张对象卡与分层字幕同框',
        camera_suggestion: '主讲人中景切换卡片特写',
        cultural_note: '现场对象、历史事件和文化解释不得混为同一时代事实。',
      }, {
        scene_id: 2,
        title: '现场检验',
        duration_sec: 30,
        location: '岳麓书院',
        time_of_day: '白天',
        dramatic_function: '检验反馈',
        plot: '知识检验：看到书院、朱张会讲和匾额时，学习者分别指出它属于地点、事件还是文化解释，再用一句话说明三者的时间关系。',
        key_action: '学习者完成分类并口头说明时间关系',
        characters: ['主讲人', '学习者'],
        visual_prompt: '三张分类卡、答案栏和反馈标记',
        camera_suggestion: '卡片俯拍后切换答案反馈',
        cultural_note: '答案以条目来源与现场说明为准。',
      }],
      gears_segments: [],
      gears_segments_url: '/api/stories/training-generated-readiness/gears-segments',
      cultural_constraints: ['不得把后世使用写成创建时事实。'],
      credibility_note: '知识层次来自条目；教学卡片为讲解设计。',
      material_pack: makeMaterialPack('学习目标、学习者、知识大纲、步骤、案例、练习、课件、复盘、来源和误区边界均已明确。'),
      production_material_pack: trainingPack,
    } satisfies StoryGenerateResult;

    const derived = refreshStoryProductionMaterialReadiness(baseStory);
    const labelsOnly = refreshStoryProductionMaterialReadiness({
      ...baseStory,
      storyId: 'training-labels-only',
      full_text: '完成知识讲授和检验反馈。',
      scene_breakdown: baseStory.scene_breakdown.map(scene => ({
        ...scene,
        plot: scene.dramatic_function,
        key_action: '主讲人继续讲述',
        visual_prompt: '主讲人正面画面',
        camera_suggestion: '固定中景',
      })),
    });

    expect(derived?.available_fields).toEqual(expect.arrayContaining([
      'concept_definitions',
      'assessment_check',
    ]));
    expect(labelsOnly?.available_fields).not.toContain('concept_definitions');
    expect(labelsOnly?.available_fields).not.toContain('assessment_check');
  });

  it('derives child examples and review guidance only from observable choices and an explicit recap', () => {
    const childrenPack = getProductionMaterialPack('children_story');
    const baseStory = {
      storyId: 'children-generated-readiness',
      title: '先看行动，再作判断',
      generation_type: 'character_story',
      video_type: 'children_story',
      presentation_style: 'children_animation',
      source_entry: '刘海砍樵',
      logline: '小刘海用观察和核对解开误会。',
      theme: '善良需要勇敢和判断',
      full_text: '小刘海先看行动，再核实误会，最后和伙伴把柴担送回家。',
      scene_breakdown: [{
        scene_id: 1,
        title: '观察善意',
        duration_sec: 24,
        location: '山路',
        time_of_day: '黄昏',
        dramatic_function: '学习成长',
        plot: '小刘海看见胡大姐把散落的木柴一根根捆好。他先听她说明，再观察柴绳和柴担，核对她是否真的在帮助自己。',
        key_action: '先听说明，再看木柴被捆好，最后核实误会',
        characters: ['小刘海', '胡大姐'],
        visual_prompt: '柴绳、木柴、柴担与两人的手部动作连续同框',
        camera_suggestion: '木柴特写切到小刘海观察反应',
        cultural_note: '传说身份不写成现实事实。',
      }, {
        scene_id: 2,
        title: '一起回家',
        duration_sec: 24,
        location: '家门口',
        time_of_day: '清晨',
        dramatic_function: '温暖结尾',
        plot: '误会解开后，两人把柴担送到家门口。这个结尾提醒孩子：认识一个人，要先看他的行动，再作判断。',
        key_action: '两人共同放下柴担并挥手告别',
        characters: ['小刘海', '胡大姐'],
        visual_prompt: '家门口暖灯、柴担归位与挥手告别',
        camera_suggestion: '跟拍到柴担落地后停在两人笑脸',
        cultural_note: '复盘只讨论故事中的观察方法。',
      }],
      gears_segments: [],
      gears_segments_url: '/api/stories/children-generated-readiness/gears-segments',
      cultural_constraints: ['不使用恐怖和暴力细节。'],
      credibility_note: '核心传说来自知识条目；儿童情节为改写设计。',
      material_pack: makeMaterialPack('儿童故事的年龄、温和误会、文化道具、情绪安放和事实边界已明确。'),
      production_material_pack: childrenPack,
    } satisfies StoryGenerateResult;

    const derived = refreshStoryProductionMaterialReadiness(baseStory);
    const slogansOnly = refreshStoryProductionMaterialReadiness({
      ...baseStory,
      storyId: 'children-slogans-only',
      full_text: '善良很重要，故事温暖结束。',
      scene_breakdown: baseStory.scene_breakdown.map(scene => ({
        ...scene,
        plot: scene.dramatic_function === '温暖结尾' ? '大家明白善良很重要，故事温暖结束。' : '小刘海学会善良。',
        key_action: '人物继续讲述',
        visual_prompt: '人物正面画面',
        camera_suggestion: '固定中景',
      })),
    });

    expect(derived?.available_fields).toEqual(expect.arrayContaining([
      'concrete_examples',
      'parent_teacher_note',
    ]));
    expect(slogansOnly?.available_fields).not.toContain('concrete_examples');
    expect(slogansOnly?.available_fields).not.toContain('parent_teacher_note');
  });

  it('derives comic shot prompt layers only when scene and GEARS delivery layers align', () => {
    const comicPack = getProductionMaterialPack('ai_comic_drama');
    const baseStory = {
      storyId: 'comic-generated-readiness',
      title: '雷光里的狐影',
      generation_type: 'character_story',
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      source_entry: '刘海砍樵',
      logline: '刘海在狐影、村人逼近与亲眼所见之间作出选择。',
      theme: '行动比身份更能说明真心',
      full_text: '雷光照出狐影，刘海放下柴刀，护住正在救孩子的胡大姐。',
      scene_breakdown: [{
        scene_id: 1,
        title: '狐影停刀',
        duration_sec: 12,
        location: '山屋门口',
        time_of_day: '雨夜',
        dramatic_function: '钩子开场',
        plot: '雷光照出狐形影子，刘海手里的柴刀停在半空，胡大姐挡在受伤孩子前。',
        key_action: '刘海看见救人动作后放下柴刀',
        characters: ['刘海', '胡大姐'],
        visual_prompt: '雨夜山屋门口，狐形影子在后景，柴刀与护住孩子的手在前景，冷蓝雷光',
        camera_suggestion: '狐影全景切柴刀手部特写，再对切刘海和胡大姐视线',
        cultural_note: '狐形影子按传说影视化表达。',
      }],
      gears_segments: [{
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 12,
        panel_count: 6,
        script_text: '雷光照出狐影，刘海看见胡大姐护住孩子，放下柴刀。',
        purpose: '钩子开场',
        visual_focus: ['狐影后景', '柴刀前景', '护住孩子的手'],
        cultural_constraints: ['狐形影子属于传说影视化表达。'],
        video_type: 'ai_comic_drama',
        presentation_style: 'ai_comic',
        segment_prompt_hint: '场景：雨夜山屋；主体：刘海、胡大姐；动作：停刀护人；构图：狐影后景、柴刀前景；镜头：全景切手部特写；光线：冷蓝雷光。',
      }],
      gears_segments_url: '/api/stories/comic-generated-readiness/gears-segments',
      cultural_constraints: ['神异身份不得写成现实事实。'],
      credibility_note: '传说来自知识条目；动作和镜头为漫画化改编。',
      material_pack: makeMaterialPack('第一格钩子、目标、压力、关系碰撞、角色稳定、对白气泡、表情节拍、参考图需求、单镜头测试、多分镜连续性、转场、结尾钩子和边界均已明确。'),
      production_material_pack: comicPack,
    } satisfies StoryGenerateResult;

    const derived = refreshStoryProductionMaterialReadiness(baseStory);
    const genericPrompts = refreshStoryProductionMaterialReadiness({
      ...baseStory,
      storyId: 'comic-generic-prompts',
      scene_breakdown: baseStory.scene_breakdown.map(scene => ({
        ...scene,
        visual_prompt: '高质量漫画画面，人物清晰，电影感。',
        camera_suggestion: '镜头推进。',
      })),
      gears_segments: baseStory.gears_segments.map(segment => ({
        ...segment,
        visual_focus: ['人物'],
        segment_prompt_hint: '高质量漫画，人物清晰。',
      })),
    });

    expect(derived?.available_fields).toContain('shot_prompt_layers');
    expect(genericPrompts?.available_fields).not.toContain('shot_prompt_layers');
  });

  it('derives historical event-chain evidence only from dated, sourced, bounded action scenes', () => {
    const historyPack = getProductionMaterialPack('historical_drama');
    const baseStory = {
      storyId: 'history-adaptation-readiness',
      title: '武昌起义的行动链',
      generation_type: 'character_story',
      video_type: 'historical_drama',
      presentation_style: 'cinematic',
      source_entry: '武昌起义',
      logline: '泄密与搜捕迫使新军士兵提前发动，并以军械库打开后续推进条件。',
      theme: '基层行动在风险中形成历史转折',
      full_text: '10月9日计划泄露，10月10日士兵选择提前发动；军械库被打开后，队伍才得以继续推进。',
      scene_breakdown: [{
        scene_id: 1,
        title: '泄密倒计时',
        duration_sec: 24,
        location: '武昌新军营房',
        time_of_day: '1911年10月9日深夜',
        dramatic_function: '时代危机',
        plot: '起义计划因意外爆炸泄露，搜捕名单和三名革命党人遇害的消息传进营房；士兵知道继续等待会让人员与计划同时暴露。',
        key_action: '新军士兵关上营门，传递搜捕名单并检查枪械',
        characters: ['新军士兵'],
        visual_prompt: '武昌营房深夜，搜捕名单、营门和枪架，冷色低光',
        camera_suggestion: '名单特写切街外军靴，再推入营房群像',
        cultural_note: '具体传递动作属于合成再现。',
        conflict: '继续等待会遭搜捕瓦解，提前发动则准备不足并可能伤亡',
        factual_basis: '条目记载10月9日意外爆炸导致计划泄露，清军随即搜捕并处死三名革命党人。',
        fictionalized_elements: ['名单进入营房和具体传递动作是合成再现。'],
      }, {
        scene_id: 2,
        title: '打开军械库',
        duration_sec: 24,
        location: '楚望台军械库',
        time_of_day: '1911年10月10日晚',
        dramatic_function: '关键行动',
        plot: '起义军顶住半合库门，接力搬出枪械与弹药箱；因为获得弹药，队伍才有条件继续向湖广总督署推进。',
        key_action: '起义军推开库门并接力搬出枪械与弹药箱',
        characters: ['起义军', '普通士兵'],
        visual_prompt: '半合库门、枪架、弹药箱与接力搬运群像',
        camera_suggestion: '低机位拍顶门脚步，切弹药箱特写后跟拍武器递出',
        cultural_note: '具体分工按已知行动有限再现。',
        conflict: '守军封锁军械库；没有弹药就无法继续推进',
        factual_basis: '用户素材与知识条目均记载攻占楚望台军械库、获得弹药后攻向湖广总督署。',
        fictionalized_elements: ['顶门与接力搬箱的分工为影视化组织。'],
      }],
      gears_segments: [],
      gears_segments_url: '/api/stories/history-adaptation-readiness/gears-segments',
      cultural_constraints: ['不指定唯一第一枪人物，不把帝制终结归因于单一动作。'],
      credibility_note: '核心事件来自知识条目；具体对白和调度为影视化创作补位。',
      material_pack: makeMaterialPack('历史地点、时代器物、戏剧补足、后果与历史声称边界已明确。'),
      production_material_pack: historyPack,
    } satisfies StoryGenerateResult;

    const derived = refreshStoryProductionMaterialReadiness(baseStory);
    const genericHistory = refreshStoryProductionMaterialReadiness({
      ...baseStory,
      storyId: 'history-generic-readiness',
      full_text: '时代风云激荡，人物必须行动，最终留下历史余响。',
      scene_breakdown: baseStory.scene_breakdown.map((scene, index) => ({
        ...scene,
        time_of_day: index === 0 ? '雨夜' : '清晨',
        plot: index === 0 ? '时代压力把人物推到选择面前。' : '人物采取关键行动，历史由此转折。',
        key_action: '人物采取行动',
        characters: ['历史人物'],
        conflict: '旧秩序与新主张发生冲突',
        factual_basis: undefined,
        fictionalized_elements: undefined,
      })),
    });

    expect(derived?.available_fields).toEqual(expect.arrayContaining([
      'historical_event_anchor',
      'historical_time_window',
      'historical_stakes',
      'faction_positions',
      'causal_chain',
      'evidence_hierarchy',
      'documented_actions',
      'conflict_turning_point',
    ]));
    expect(genericHistory?.available_fields).not.toEqual(expect.arrayContaining([
      'historical_event_anchor',
      'historical_time_window',
      'causal_chain',
      'evidence_hierarchy',
    ]));
  });

  it('derives scene-short movement evidence only from an explicit observer route and reveal axis', () => {
    const scenePack = getProductionMaterialPack('scene_short');
    const baseStory = {
      storyId: 'scene-short-generated-readiness',
      title: '书院门庭到讲堂',
      generation_type: 'scene_short',
      video_type: 'scene_short',
      presentation_style: 'cinematic',
      source_entry: '岳麓书院',
      logline: '寻访者循门联和滴水声进入讲堂，再沿原路线返回。',
      theme: '空间在人的行走中逐层显影',
      full_text: '寻访者从门庭进入院落，绕过门联后推开讲堂木门，最终沿原路线返回。',
      scene_breakdown: [{
        scene_id: 1,
        title: '门庭入场',
        duration_sec: 15,
        location: '岳麓书院门庭',
        time_of_day: '清晨',
        dramatic_function: '空间引入',
        plot: '寻访者从岳麓书院门庭进入书院院落，门联与石阶先后进入视野。',
        key_action: '寻访者从岳麓书院门庭进入书院院落',
        characters: ['寻访者'],
        visual_prompt: '门庭为入口锚点，寻访者由外向内越过石阶，门联在前景、院落在后景',
        camera_suggestion: '固定门庭内外轴线，跟拍人物由外向内',
        cultural_note: '人物路线为当代寻访设计。',
      }, {
        scene_id: 2,
        title: '讲堂揭示',
        duration_sec: 15,
        location: '朱张会讲相关讲堂',
        time_of_day: '清晨',
        dramatic_function: '时空叠印',
        plot: '寻访者沿院落右侧廊道走到讲堂，推开木门后，讲堂匾额和书案由暗到明显现。',
        key_action: '寻访者推开讲堂木门，触发匾额和书案揭示',
        characters: ['寻访者'],
        visual_prompt: '由院落向讲堂方向，右侧廊柱保持同侧，木门打开后匾额与书案从后景显现',
        camera_suggestion: '沿同一运动方向跟拍，越过门槛后切讲堂全景',
        cultural_note: '讲堂功能与历史层按来源说明。',
      }, {
        scene_id: 3,
        title: '原路收束',
        duration_sec: 15,
        location: '岳麓书院门庭',
        time_of_day: '清晨',
        dramatic_function: '意境收束',
        plot: '寻访者沿原路线返回门庭，右侧廊柱和门联保持同侧，脚步声渐远。',
        key_action: '寻访者沿原路线返回岳麓书院门庭',
        characters: ['寻访者'],
        visual_prompt: '回程仍以右侧廊柱为方向锚点，门联重新进入前景',
        camera_suggestion: '不跨轴跟拍回程，最后固定门庭空镜',
        cultural_note: '回程不新增未经确认的开放区域。',
      }],
      gears_segments: [],
      gears_segments_url: '/api/stories/scene-short-generated-readiness/gears-segments',
      cultural_constraints: ['不把不同历史时期人物放入同一现实场景。'],
      credibility_note: '空间节点来自条目；寻访路线为当代拍摄设计。',
      spatial_identity: '岳麓书院门庭—书院院落—朱张会讲相关讲堂',
      visual_route: ['门庭入口', '院落右侧廊道', '讲堂木门', '原路返回门庭'],
      time_layer: '当代寻访与书院历史说明分层。',
      atmosphere: '清晨滴水、脚步和木门声。',
      material_pack: makeMaterialPack('空间锚点、目标、分区、动作触发、时段、光线天气、环境声和镜头次序已明确。'),
      production_material_pack: scenePack,
    } satisfies StoryGenerateResult;

    const derived = refreshStoryProductionMaterialReadiness(baseStory);
    const routeLabelsOnly = refreshStoryProductionMaterialReadiness({
      ...baseStory,
      storyId: 'scene-short-route-labels-only',
      full_text: '走进空间，感受氛围。',
      scene_breakdown: baseStory.scene_breakdown.map(scene => ({
        ...scene,
        location: '岳麓书院',
        plot: '走进空间，感受这里的氛围。',
        key_action: '空间导览',
        characters: [],
        visual_prompt: '空间层次清晰。',
        camera_suggestion: '镜头推进。',
      })),
    });

    expect(derived?.available_fields).toEqual(expect.arrayContaining([
      'entering_character',
      'movement_route',
      'visual_reveal',
      'spatial_continuity',
    ]));
    expect(routeLabelsOnly?.available_fields).not.toEqual(expect.arrayContaining([
      'entering_character',
      'movement_route',
      'visual_reveal',
      'spatial_continuity',
    ]));
  });
});
