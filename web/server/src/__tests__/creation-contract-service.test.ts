import { describe, expect, it } from 'vitest';
import { StoryGenerateRequestSchema } from '@shared/schemas.js';
import type { KnowledgePack, MaterialPack, StoryGenerateRequest } from '@shared/types.js';
import {
  buildCreationContract,
  buildMaterialSufficiencyReport,
  knowledgePackFromMaterialPack,
  materialPackFromKnowledgePack,
  resolveCreationUseCase,
  resolveTruthMode,
} from '../services/creation-contract-service.js';

function makeKnowledgePack(): KnowledgePack {
  return {
    primary_entries: [{
      entry_name: '周敦颐——理学开山鼻祖',
      province: '湖南',
      region: '永州',
      type: '历史人物',
      summary: '周敦颐是北宋理学重要人物。',
      score: 0.95,
      role_in_story: 'primary_entry',
      match_reason: '用户指定主素材',
      keywords: ['周敦颐', '北宋'],
      knowledge_domain: 'core_china_culture',
      entry_role: 'core_entry',
      era: '宋',
      asset_usage: ['character_clothing', 'source_grounding'],
    }],
    supporting_entries: [{
      entry_name: '北宋服饰设定包',
      province: '通用',
      region: '通用',
      type: '时代设定',
      summary: '用于服饰、称谓和器物边界。',
      score: 0.8,
      role_in_story: 'cultural_background',
      match_reason: '时代边界自动补充',
      keywords: ['北宋', '服饰'],
      knowledge_domain: 'era_setting',
      entry_role: 'setting_pack',
      asset_usage: ['character_clothing', 'credibility_boundary'],
    }],
    missing_needs: [{
      need_id: 'verified_dates',
      label: '确切时间',
      message: '需要补充可确认的发生时间。',
    }],
    overall_confidence: 0.82,
  };
}

function makeMaterialPack(): MaterialPack {
  return {
    schema_version: 'material-pack/v1',
    primary_materials: [{
      material_id: 'primary-zhou',
      title: '周敦颐项目素材',
      summary: '围绕周敦颐廉洁精神做一支机构宣传短片。',
      source_type: 'manual_note',
      purpose: ['fact_basis', 'institutional_position'],
      confidence: 0.75,
      tags: ['周敦颐', '廉洁'],
    }],
    supporting_materials: [],
    reference_materials: [],
    brand_or_institution_profile: { client_type: '政府机构' },
    visual_assets: [],
    verified_facts: ['周敦颐为北宋理学重要人物。'],
    uncertain_claims: [],
    creative_space: ['可用莲花意象做镜头转场。'],
    missing_needs: [],
    overall_confidence: 0.75,
  };
}

describe('creation contract compatibility layer', () => {
  it('treats AI comic generation from a knowledge entry as source adaptation', () => {
    const request: StoryGenerateRequest = {
      entry_name: '刘海砍樵——人仙之恋的湖南民间传说',
      video_type: 'ai_comic_drama',
      source_material_mode: 'generate_from_knowledge',
    };
    const creationUseCase = resolveCreationUseCase(request, 'ai_comic_drama');

    expect(creationUseCase).toBe('adapted_ai_comic');
    expect(resolveTruthMode(request, creationUseCase, 'ai_comic_drama')).toBe('source_adaptation');
    expect(resolveCreationUseCase({ video_type: 'ai_comic_drama', outline: '原创奇幻故事' }, 'ai_comic_drama'))
      .toBe('original_ai_comic');
  });

  it('keeps old knowledge_pack requests valid while accepting material_pack requests', () => {
    const oldRequest = StoryGenerateRequestSchema.safeParse({
      video_type: 'character_story',
      knowledge_pack: makeKnowledgePack(),
    });
    expect(oldRequest.success).toBe(true);

    const newRequest = StoryGenerateRequestSchema.safeParse({
      video_type: 'culture_promo',
      material_pack: makeMaterialPack(),
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
    });
    expect(newRequest.success).toBe(true);
  });

  it('rejects explicitly incompatible truth mode and video type combinations', () => {
    const parsed = StoryGenerateRequestSchema.safeParse({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'documentary_short',
      truth_mode: 'fictional_original',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some(issue => issue.path.includes('truth_mode'))).toBe(true);
  });

  it('maps knowledge_pack entries into material purposes and back to a compatible knowledge pack', () => {
    const materialPack = materialPackFromKnowledgePack(makeKnowledgePack());

    expect(materialPack.schema_version).toBe('material-pack/v1');
    expect(materialPack.primary_materials[0].purpose).toEqual(expect.arrayContaining(['fact_basis', 'character_source', 'source_work']));
    expect(materialPack.supporting_materials[0].purpose).toEqual(expect.arrayContaining(['era_context', 'creative_boundary']));
    expect(materialPack.missing_needs[0].need_id).toBe('verified_dates');

    const shadowPack = knowledgePackFromMaterialPack(materialPack);
    expect(shadowPack?.primary_entries[0].entry_name).toBe('周敦颐——理学开山鼻祖');
    expect(shadowPack?.supporting_entries[0].role_in_story).toBe('cultural_background');
  });

  it('does not promote a relevant but unverified retrieval summary into verified facts', () => {
    const pack = makeKnowledgePack();
    Object.assign(pack.primary_entries[0], {
      credibility: '待核实',
      source_refs: ['地方志来源线索'],
      verification_method: '需与地方志和遗址资料交叉核验。',
      unverified_points: ['月岩悟道细节属于地方传说。'],
    });

    const materialPack = materialPackFromKnowledgePack(pack);

    expect(materialPack.verified_facts).toEqual([]);
    expect(materialPack.uncertain_claims).toEqual(expect.arrayContaining([
      expect.stringContaining('周敦颐——理学开山鼻祖'),
      expect.stringContaining('可信度：待核实'),
      expect.stringContaining('月岩悟道细节属于地方传说'),
    ]));
    expect(materialPack.primary_materials[0].provenance).toContain('地方志来源线索');
  });

  it('promotes only explicitly verified retrieval entries without open unverified points', () => {
    const pack = makeKnowledgePack();
    Object.assign(pack.primary_entries[0], {
      credibility: '可靠',
      source_refs: ['《宋史》卷四百二十七'],
      verification_method: '与正史原文交叉核验。',
      unverified_points: [],
    });
    pack.missing_needs = [];

    const materialPack = materialPackFromKnowledgePack(pack);

    expect(materialPack.verified_facts).toEqual([
      '周敦颐——理学开山鼻祖：周敦颐是北宋理学重要人物。',
    ]);
    expect(materialPack.uncertain_claims).toEqual([]);
  });

  it('keeps a reliable entry uncertain while it still has an open unverified point', () => {
    const pack = makeKnowledgePack();
    Object.assign(pack.primary_entries[0], {
      credibility: '可靠',
      source_refs: ['《宋史》卷四百二十七'],
      unverified_points: ['具体对白没有一手原文。'],
    });
    pack.missing_needs = [];

    const materialPack = materialPackFromKnowledgePack(pack);

    expect(materialPack.verified_facts).toEqual([]);
    expect(materialPack.uncertain_claims.join('\n')).toContain('具体对白没有一手原文');
  });

  it('keeps original-fiction retrieval anchors out of both factual claim buckets', () => {
    const pack = makeKnowledgePack();
    Object.assign(pack.primary_entries[0], {
      credibility: '用户提供',
      source_refs: ['用户提供素材'],
      unverified_points: [],
    });
    pack.missing_needs = [];

    const materialPack = materialPackFromKnowledgePack(pack, {
      truth_mode: 'fictional_original',
      creation_use_case: 'original_ai_comic',
    });

    expect(materialPack.verified_facts).toEqual([]);
    expect(materialPack.uncertain_claims).toEqual([]);
    expect(materialPack.creative_space.join('\n')).toContain('用户原创故事种子');
    expect(materialPack.creative_space.join('\n')).toContain('真实人物、机构、地域或文化细节');
  });

  it('builds a blocking institutional sufficiency report and creation contract from material gaps', () => {
    const materialPack = {
      ...makeMaterialPack(),
      brand_or_institution_profile: undefined,
      verified_facts: [],
    };
    const request: StoryGenerateRequest = {
      video_type: 'culture_promo',
      material_pack: materialPack,
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
    };
    const creationUseCase = resolveCreationUseCase(request, 'culture_promo');
    const truthMode = resolveTruthMode(request, creationUseCase, 'culture_promo');
    const materialSufficiency = buildMaterialSufficiencyReport({
      materialPack,
      creationUseCase,
      truthMode,
    });
    const contract = buildCreationContract({
      request,
      materialSufficiency,
      creationUseCase,
      truthMode,
      videoType: 'culture_promo',
      presentationStyle: 'voiceover_montage',
      storyStructure: 'object_clue_journey',
      narrativePatternIds: [],
    });

    expect(materialSufficiency.blocked).toBe(true);
    expect(materialSufficiency.can_generate).toBe(false);
    expect(materialSufficiency.can_generate_with_risks).toBe(false);
    expect(materialSufficiency.missing_items.map(item => item.item_id)).toEqual(expect.arrayContaining(['institution_profile', 'verified_facts']));
    expect(contract.truth_mode).toBe('institutional_verified');
    expect(contract.forbidden_moves.join('\n')).toContain('虚构机构成果');
    expect(materialSufficiency.stage_reports?.find(report => report.stage === 'script_ready')?.status).toBe('blocked');
    expect(materialSufficiency.next_stage).toBe('script_ready');
  });

  it('separates script readiness from production readiness gates', () => {
    const materialPack = makeMaterialPack();
    const materialSufficiency = buildMaterialSufficiencyReport({
      materialPack,
      creationUseCase: 'institutional_promo',
      truthMode: 'institutional_verified',
    });

    expect(materialSufficiency.stage).toBe('script_ready');
    expect(materialSufficiency.active_stage).toBe('script_ready');
    expect(materialSufficiency.can_generate).toBe(true);
    expect(materialSufficiency.generation_posture).toBe('script_ready_production_pending');
    expect(materialSufficiency.stage_reports?.find(report => report.stage === 'minimum_viable_story')?.status).toBe('ready');
    expect(materialSufficiency.stage_reports?.find(report => report.stage === 'script_ready')?.status).toBe('ready');
    expect(materialSufficiency.stage_reports?.find(report => report.stage === 'production_ready')?.status).toBe('blocked');
    expect(materialSufficiency.optional_items.map(item => item.item_id)).toContain('visual_assets');
    expect(materialSufficiency.recommended_next_questions.join('\n')).toContain('视觉参考');
  });
});
