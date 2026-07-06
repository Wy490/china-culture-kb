import { describe, expect, it } from 'vitest';
import type { MaterialPack } from '@shared/types.js';
import {
  getProductionMaterialPack,
  getProductionMaterialPackHealthReport,
  getProductionMaterialPacks,
} from '../services/production-material-pack-service.js';
import {
  buildProductionMaterialReadinessReport,
  getProductionMaterialFieldSpec,
} from '../services/production-material-readiness-service.js';

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
  it('keeps production material packs mapped to readiness field specs', () => {
    const packs = getProductionMaterialPacks();
    const report = getProductionMaterialPackHealthReport({ generatedAt: '2026-07-06T00:00:00.000Z' });

    expect(report.schema_version).toBe('production-material-pack-health/v1');
    expect(report.status).toBe('passed');
    expect(report.pack_count).toBe(packs.length);
    expect(report.missing_required_video_types).toHaveLength(0);
    expect(report.issues).toHaveLength(0);

    for (const pack of packs) {
      for (const fieldId of pack.material_template.required_fields) {
        expect(getProductionMaterialFieldSpec(fieldId), `${pack.video_type}:${fieldId}`).toBeTruthy();
      }
    }
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
});
