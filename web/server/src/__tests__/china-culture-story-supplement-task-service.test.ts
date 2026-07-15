import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type {
  KnowledgePack,
  MaterialSufficiencyMissingItem,
  MaterialSufficiencyReport,
  ProductionMaterialMissingField,
  ProductionMaterialReadinessReport,
} from '@shared/types.js';
import { buildChinaCultureStorySupplementTasks } from '../domains/china-culture/story-supplement-task-service.js';

const CONTEXT = { storyId: 'story-supplement-test', createdAt: '2026-07-15T00:00:00.000Z' };

function knowledgePack(missingNeeds: KnowledgePack['missing_needs']): KnowledgePack {
  return {
    primary_entries: [],
    supporting_entries: [],
    missing_needs: missingNeeds,
    overall_confidence: 0.5,
  };
}

function materialItem(overrides: Partial<MaterialSufficiencyMissingItem> = {}): MaterialSufficiencyMissingItem {
  return {
    item_id: 'missing_need_regional_context',
    label: '地方背景',
    reason: '缺少地方背景',
    blocking_level: 'risk',
    affects: ['story_blueprint'],
    recommended_question: '请补充地方风俗如何影响人物选择？',
    ...overrides,
  };
}

function materialSufficiency(item: MaterialSufficiencyMissingItem): MaterialSufficiencyReport {
  return {
    schema_version: 'material-sufficiency/v1',
    stage: 'minimum_viable_story',
    score: 50,
    can_generate: true,
    can_generate_with_risks: true,
    blocked: false,
    stage_reports: [{
      stage: 'script_ready',
      status: 'needs_input',
      score: 50,
      can_proceed: true,
      required_items: [],
      available_outputs: [],
      missing_items: [item],
      optional_items: [],
      notes: [],
    }],
    missing_items: [item],
    optional_items: [item],
    token_risk: 'low',
    recommended_next_questions: [],
  };
}

function productionReadiness(fields: ProductionMaterialMissingField[]): ProductionMaterialReadinessReport {
  return {
    schema_version: 'production-material-readiness/v1',
    video_type: 'character_story',
    pack_label: '人物故事生产素材包',
    score: 40,
    status: 'needs_input',
    available_fields: [],
    missing_fields: fields,
    gate_reports: [],
    recommended_next_questions: fields.map(field => field.recommended_question),
  };
}

describe('china_culture story supplement task service', () => {
  it('routes cultural knowledge gaps into the seven existing task categories', () => {
    const tasks = buildChinaCultureStorySupplementTasks(knowledgePack([
      { need_id: 'supporting_characters', label: '配角', message: '补配角关系' },
      { need_id: 'main_character', label: '主角经历', message: '补人物生平' },
      { need_id: 'location_detail', label: '古桥建筑', message: '补空间与材质' },
      { need_id: 'historical_events', label: '事件始末', message: '补冲突过程' },
      { need_id: 'regional_context', label: '地方背景', message: '补地域风俗' },
      { need_id: 'cultural_background', label: '非遗文化', message: '补工艺与禁忌' },
      { need_id: 'other', label: '其他资料', message: '补来源' },
    ]), undefined, undefined, CONTEXT);

    expect(tasks.map(task => task.category)).toEqual([
      'supporting_character',
      'person_experience',
      'architecture_detail',
      'event_process',
      'regional_context',
      'cultural_background',
      'general',
    ]);
    expect(tasks.every(task => task.status === 'open' && task.source === 'knowledge_pack_missing_need')).toBe(true);
  });

  it('merges a matching material gap once, inherits its stage and removes internal knowledge-base wording', () => {
    const item = materialItem();
    const tasks = buildChinaCultureStorySupplementTasks(knowledgePack([
      {
        need_id: 'regional_context',
        label: '地方背景',
        message: '知识库与知识包都缺少地域说明',
      },
    ]), materialSufficiency(item), undefined, CONTEXT);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      need_id: 'regional_context',
      category: 'regional_context',
      stage: 'script_ready',
      blocking_level: 'risk',
      affects: ['story_blueprint'],
      recommended_question: item.recommended_question,
      source: 'knowledge_pack_missing_need',
    });
    expect(tasks[0]?.description).toContain('项目素材与素材包');
    expect(tasks[0]?.intake_prompt).toContain(item.recommended_question);
  });

  it('maps each production-readiness stage to the existing downstream affects', () => {
    const fields: ProductionMaterialMissingField[] = [
      {
        field_id: 'premise',
        label: '核心命题',
        stage: 'minimum_viable_story',
        blocking_level: 'blocking',
        reason: '缺少核心命题',
        recommended_question: '核心命题是什么？',
      },
      {
        field_id: 'scene_action',
        label: '场景动作',
        stage: 'script_ready',
        blocking_level: 'risk',
        reason: '缺少场景动作',
        recommended_question: '场景里发生什么？',
      },
      {
        field_id: 'asset_boundary',
        label: '资产边界',
        stage: 'production_ready',
        blocking_level: 'risk',
        reason: '缺少资产边界',
        recommended_question: '哪些资产已确认？',
      },
    ];
    const tasks = buildChinaCultureStorySupplementTasks(undefined, undefined, productionReadiness(fields), CONTEXT);

    expect(tasks.map(task => task.affects)).toEqual([
      ['production_material_readiness', 'story_blueprint', 'logline'],
      ['production_material_readiness', 'full_text', 'scene_breakdown'],
      ['production_material_readiness', 'gears_segments', 'asset_handoff'],
    ]);
    expect(tasks.every(task => task.source === 'production_material_missing_field')).toBe(true);
  });

  it('keeps supplement routing and wording rules out of the story orchestrator', async () => {
    const [storySource, documentSource, supplementSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-document-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-supplement-task-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(storySource).toContain("from './story-document-service.js'");
    expect(storySource).not.toContain("from './story-supplement-task-service.js'");
    expect(storySource).not.toContain('function buildKnowledgeSupplementTasks');
    expect(storySource).not.toContain('function buildSupplementTaskGuidance');
    expect(storySource).not.toContain('function productionFieldAffects');
    expect(documentSource).toContain("from './story-supplement-task-service.js'");
    expect(documentSource).toContain('buildChinaCultureStorySupplementTasks(');
    expect(supplementSource).toContain('function buildSupplementTaskGuidance');
    expect(supplementSource).toContain('function productionFieldAffects');
  });
});
