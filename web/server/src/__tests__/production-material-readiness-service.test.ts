import { describe, expect, it } from 'vitest';
import type { MaterialPack } from '@shared/types.js';
import { getProductionMaterialPack } from '../services/production-material-pack-service.js';
import { buildProductionMaterialReadinessReport } from '../services/production-material-readiness-service.js';

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

describe('production-material-readiness-service', () => {
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
});
