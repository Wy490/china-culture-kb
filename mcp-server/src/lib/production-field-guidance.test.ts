import { describe, expect, it } from 'vitest';
import { buildMachineProductionFieldGuidance } from './production-field-guidance.js';

describe('machine production field guidance', () => {
  it('derives bounded instructions without adding facts or authorizing source writeback', () => {
    const guidance = buildMachineProductionFieldGuidance({
      name: '测试历史人物',
      type: '历史人物',
      summary: '一位近代人物在旧址面对关键选择。',
      credibility: '基本可靠',
      unverifiedPoints: ['具体对白待核实。'],
      relatedLocations: [{ name: '测试旧址', description: '现存空间。' }],
      asset_usage: ['character_clothing', 'credibility_boundary'],
      asset_split: {
        characters: ['近代人物'],
        scenes: ['测试旧址'],
        character_props: ['手稿'],
        scene_props: ['旧桌'],
      },
    });

    expect(guidance).toMatchObject({
      schema_version: 'machine-production-field-guidance/v1',
      derivation_kind: 'deterministic_boundary_only',
      facts_added: false,
      source_markdown_writeback_allowed: false,
      fields: {
        dialogue_tone: expect.objectContaining({ output_role: 'production_instruction' }),
        dramatization_space: expect.objectContaining({ output_role: 'production_instruction' }),
        visual_symbols: expect.objectContaining({ output_role: 'production_instruction' }),
        forbidden_expressions: expect.objectContaining({ output_role: 'review_boundary' }),
      },
    });
    expect(guidance.fields.visual_symbols?.value).toContain('手稿');
    expect(guidance.fields.forbidden_expressions.value).toContain('待核验点');
    expect(JSON.stringify(guidance)).not.toContain('具体对白是');
  });

  it('uses type-specific craft guidance while keeping process claims source-bound', () => {
    const guidance = buildMachineProductionFieldGuidance({
      name: '测试工艺',
      type: '传统技艺',
      summary: '材料、工具与制作步骤形成完整工序。',
      credibility: '基本可靠',
      unverifiedPoints: [],
      relatedLocations: [],
      asset_split: {
        characters: ['匠人'],
        scenes: ['工坊'],
        character_props: ['刻刀'],
        scene_props: ['材料台'],
      },
    });

    expect(guidance.fields.dialogue_tone.value).toContain('动作');
    expect(guidance.fields.dramatization_space.value).toContain('工序');
    expect(guidance.fields.forbidden_expressions.value).toContain('来源');
  });
});
