import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const matrixPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-formal-patch-preflight-matrix-and-weekly-dispatch.json'
);
const exportPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-manual-patch-export-and-diff-draft.json'
);
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-formal-patch-preflight-matrix-weekly-dispatch-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function toSet(values: string[]): Set<string> {
  return new Set(values);
}

describe('Domain Pack formal patch preflight matrix and weekly dispatch', () => {
  it('creates a preflight matrix that mirrors all formal patch blocking checks', () => {
    const matrix = readJson(matrixPath);
    const exported = readJson(exportPath);
    const sourceCheckIds = toSet((exported.preflight_checks_before_formal_patch as JsonRecord[]).map(item => item.check_id));
    const matrixCheckIds = toSet((matrix.formal_patch_preflight_matrix as JsonRecord[]).map(item => item.check_id));

    expect(matrix.schema_version).toBe('domain-pack-formal-patch-preflight-matrix-weekly-dispatch/v1');
    expect(matrix.status).toBe('preflight_matrix_created_dispatch_only');
    expect(matrix.counts.preflight_matrix_item_count).toBe(8);
    expect(matrixCheckIds).toEqual(sourceCheckIds);

    for (const item of matrix.formal_patch_preflight_matrix as JsonRecord[]) {
      expect(item.assigned_role).toBeTruthy();
      expect(item.assignment_id).toBeTruthy();
      expect(item.blocks_formal_patch).toBe(true);
      if (item.check_id !== 'province-markdown-writeback-still-forbidden') {
        expect(item.weekly_status === 'not_started' || item.weekly_status === 'waiting_for_patch_request').toBe(true);
      }
    }
  });

  it('dispatches signature placeholders and audit/lint owners without signing anything', () => {
    const matrix = readJson(matrixPath);
    const exported = readJson(exportPath);
    const sourceSignatureIds = toSet((exported.signature_placeholders as JsonRecord[]).map(item => item.signature_id));
    const dispatchedSignatureIds = toSet((matrix.signature_assignments as JsonRecord[]).map(item => item.signature_id));
    const auditLintCheckIds = toSet((matrix.audit_lint_owner_assignments as JsonRecord[]).map(item => item.check_id));

    expect(matrix.counts.signature_assignment_count).toBe(4);
    expect(dispatchedSignatureIds).toEqual(sourceSignatureIds);

    for (const assignment of matrix.signature_assignments as JsonRecord[]) {
      expect(assignment.owner_placeholder).toBe('[待指定]');
      expect(assignment.signature_status).toBe('blank');
      expect(assignment.is_signed).toBe(false);
      expect(assignment.weekly_status).toBe('not_started');
    }

    expect(matrix.counts.audit_lint_owner_assignment_count).toBe(2);
    expect(auditLintCheckIds.has('kb-production-audit-required-after-patch')).toBe(true);
    expect(auditLintCheckIds.has('kb-lint-required-after-patch')).toBe(true);

    for (const assignment of matrix.audit_lint_owner_assignments as JsonRecord[]) {
      expect(assignment.owner_placeholder).toBe('[待指定]');
      expect(assignment.weekly_status).toBe('waiting_for_patch_request');
      expect(assignment.has_run).toBe(false);
    }
  });

  it('creates weekly dispatch and repair risk items without treating them as approval', () => {
    const matrix = readJson(matrixPath);
    const weeklyItems = matrix.weekly_dispatch_items as JsonRecord[];
    const repairItems = matrix.repair_resubmission_dispatch as JsonRecord[];
    const weeklyWorkstreams = toSet(weeklyItems.map(item => item.workstream));
    const repairUpdateIds = toSet(repairItems.map(item => item.source_update_id));

    expect(matrix.counts.weekly_dispatch_item_count).toBe(7);
    expect(matrix.counts.repair_resubmission_dispatch_item_count).toBe(4);
    expect(matrix.counts.high_due_risk_count).toBe(3);
    expect(weeklyWorkstreams.has('diff_draft_review')).toBe(true);
    expect(weeklyWorkstreams.has('manual_patch_review')).toBe(true);
    expect(weeklyWorkstreams.has('post_patch_audit')).toBe(true);
    expect(weeklyWorkstreams.has('post_patch_lint')).toBe(true);
    expect(repairUpdateIds.has('medical_privacy_boundary_rechecked')).toBe(true);
    expect(repairUpdateIds.has('real_reviewer_identity_attached')).toBe(true);

    for (const item of weeklyItems) {
      expect(item.status === 'not_started' || item.status === 'waiting_for_patch_request').toBe(true);
    }

    for (const item of repairItems) {
      expect(item.status).toBe('not_started');
      expect(item.due_risk === 'high' || item.due_risk === 'medium').toBe(true);
    }
  });

  it('documents the weekly dispatch while preserving no-writeback boundaries', () => {
    const matrix = readJson(matrixPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');

    expect(matrix.weekly_dispatch_markdown_file).toBe(
      'docs/production-cards/domain-pack-formal-patch-preflight-matrix-weekly-dispatch-20260710.md'
    );
    expect(markdown).toContain('状态：preflight_matrix_created_dispatch_only');
    expect(markdown).toContain('preflight_matrix_is_formal_approval: false');
    expect(markdown).toContain('weekly_dispatch_is_signature: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 正式 Patch 前预审矩阵');
    expect(markdown).toContain('## 本周工作项');
    expect(markdown).toContain('## 修复补证任务风险');

    for (const item of matrix.weekly_dispatch_items as JsonRecord[]) {
      expect(markdown).toContain(item.dispatch_id);
      expect(markdown).toContain(item.workstream);
    }
  });

  it('tracks Iteration 19 gates and keeps formal files untouched', () => {
    const matrix = readJson(matrixPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const machineGates = new Map((matrix.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((matrix.iteration_19_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(matrix.writeback_policy.formal_patch_created).toBe(false);
    expect(matrix.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(matrix.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(matrix.writeback_policy.province_markdown_written).toBe(false);
    expect(matrix.writeback_policy.preflight_matrix_is_formal_approval).toBe(false);
    expect(matrix.writeback_policy.weekly_dispatch_is_signature).toBe(false);
    expect(matrix.counts.formal_patch_count).toBe(0);

    expect(machineGates.get('preflight-matrix-created')?.current_count).toBe(8);
    expect(machineGates.get('signature-placeholders-dispatched')?.status).toBe('met_as_unsigned_assignments');
    expect(machineGates.get('audit-lint-owners-dispatched')?.status).toBe('met_as_waiting_for_patch');
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('formal-domain-pack-not-written')?.current_count).toBe(0);
    expect(machineGates.get('weekly-dispatch-not-signature')?.status).toBe('met');
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('formal-patch-preflight-matrix-created')?.current_count).toBe(8);
    expect(exitGates.get('signature-and-audit-dispatch-created')?.status).toBe('met_as_unsigned_assignments');
    expect(exitGates.get('repair-task-weekly-risk-created')?.current_count).toBe(4);
    expect(exitGates.get('formal-patch-still-zero')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
