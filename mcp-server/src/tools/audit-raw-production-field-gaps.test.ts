import { describe, expect, it } from 'vitest';
import { buildRawProductionFieldGapGovernance } from './audit-raw-production-field-gaps.js';
import type { ProductionMaterialAuditReport } from './audit-production-materials.js';

describe('buildRawProductionFieldGapGovernance', () => {
  it('classifies remaining gaps without authorizing automatic source writeback', () => {
    const productionAudit = {
      schema_version: 'kb-production-material-audit/v1',
      generated_at: '2026-08-04T00:00:00.000Z',
      totals: {
        entries: 1,
        source_authored_fields_visible_only_in_raw_markdown: 3,
      },
      entries: [{
        province: '北京',
        name: '测试条目',
        type: '传统技艺',
        source_count: 4,
        missing_production_fields: ['dialogue_tone', 'forbidden_expressions'],
        machine_guidance_fields: ['dialogue_tone', 'forbidden_expressions'],
      }],
    } as ProductionMaterialAuditReport;

    const report = buildRawProductionFieldGapGovernance(productionAudit);

    expect(report.totals.raw_gap_count).toBe(2);
    expect(report.totals.affected_entry_count).toBe(1);
    expect(report.totals.source_authored_fields_recovered_from_raw_markdown).toBe(3);
    expect(report.totals.auto_write_eligible_count).toBe(0);
    expect(report.totals.non_hunan_high_risk_gap_count).toBe(1);
    expect(report.totals.non_hunan_high_risk_scope_complete).toBe(false);
    expect(report.totals.high_risk_gap_count).toBe(1);
    expect(report.totals.high_risk_scope_complete).toBe(false);
    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'forbidden_expressions', lane: 'claim_boundary', risk: 'high' }),
      expect.objectContaining({ field: 'dialogue_tone', lane: 'dialogue_register', risk: 'medium' }),
    ]));
    expect(report.items.every(item => item.action === 'manual_source_patch_required')).toBe(true);
    expect(report.items.every(item => item.auto_write_allowed === false)).toBe(true);
    expect(report.batches.map(batch => batch.batch_id)).toEqual([
      'B1-non-hunan-high-risk-boundaries',
      'B3-non-hunan-dialogue-register',
    ]);
    expect(report.markdown).toContain('治理脚本只生成账本');
  });
});
