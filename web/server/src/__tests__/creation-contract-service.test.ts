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
