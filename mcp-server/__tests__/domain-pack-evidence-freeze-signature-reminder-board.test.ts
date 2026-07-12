import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const freezePath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-evidence-freeze-and-signature-reminder-board.json'
);
const matrixPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-formal-patch-preflight-matrix-and-weekly-dispatch.json'
);
const evidenceLedgerPath = path.join(repoRoot, 'data', 'production-cards', 'domain-pack-review-evidence-ledger.json');
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-evidence-freeze-signature-reminder-board-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function toSet(values: string[]): Set<string> {
  return new Set(values);
}

describe('Domain Pack evidence freeze and signature reminder board', () => {
  it('freezes the required evidence attachment slots from the evidence ledger', () => {
    const freeze = readJson(freezePath);
    const ledger = readJson(evidenceLedgerPath);
    const ledgerSlotIds = toSet((ledger.evidence_slot_schema as JsonRecord[]).map(slot => slot.slot_id));
    const frozenSlotIds = toSet((freeze.frozen_attachment_slot_schema as JsonRecord[]).map(slot => slot.slot_id));

    expect(freeze.schema_version).toBe('domain-pack-evidence-freeze-signature-reminder-board/v1');
    expect(freeze.status).toBe('evidence_package_frozen_reminder_board_created');
    expect(freeze.counts.frozen_attachment_slot_count).toBe(6);
    expect(frozenSlotIds).toEqual(ledgerSlotIds);

    for (const slot of freeze.frozen_attachment_slot_schema as JsonRecord[]) {
      expect(slot.freeze_status).toBe('frozen_required');
    }
  });

  it('creates two evidence packages without pretending files are committed', () => {
    const freeze = readJson(freezePath);
    const frozenSlotIds = (freeze.frozen_attachment_slot_schema as JsonRecord[]).map(slot => slot.slot_id);

    expect(freeze.counts.evidence_package_count).toBe(2);
    expect(freeze.counts.frozen_required_slot_reference_count).toBe(12);
    expect(freeze.counts.attachment_file_committed_count).toBe(0);

    for (const pkg of freeze.evidence_attachment_packages as JsonRecord[]) {
      expect(pkg.package_status).toBe('frozen_required_slots_pending_files');
      expect(pkg.frozen_required_slot_ids).toEqual(frozenSlotIds);
      expect(pkg.attachment_file_committed).toBe(false);
      expect(pkg.evidence_freeze_is_attachment_submission).toBe(false);
      expect(pkg.formal_patch_created).toBe(false);
      expect(pkg.formal_domain_pack_written).toBe(false);
      expect(pkg.province_markdown_written).toBe(false);
    }
  });

  it('creates signature reminders from dispatch assignments without signing them', () => {
    const freeze = readJson(freezePath);
    const matrix = readJson(matrixPath);
    const sourceAssignmentIds = toSet((matrix.signature_assignments as JsonRecord[]).map(item => item.assignment_id));
    const reminderAssignmentIds = toSet((freeze.signature_reminder_board as JsonRecord[]).map(item => item.assignment_id));

    expect(freeze.counts.signature_reminder_count).toBe(4);
    expect(freeze.counts.real_owner_placeholder_count).toBe(4);
    expect(freeze.counts.signature_completed_count).toBe(0);
    expect(reminderAssignmentIds).toEqual(sourceAssignmentIds);

    for (const reminder of freeze.signature_reminder_board as JsonRecord[]) {
      expect(reminder.real_owner_placeholder).toBe('[待指定]');
      expect(reminder.reminder_status).toBe('open_owner_needed');
      expect(reminder.signature_status).toBe('blank');
      expect(reminder.is_signed).toBe(false);
      expect(reminder.reminder_board_is_signature).toBe(false);
    }
  });

  it('creates post-patch audit/lint runbook items and repair followups only', () => {
    const freeze = readJson(freezePath);
    const matrix = readJson(matrixPath);
    const sourceAuditLintIds = toSet((matrix.audit_lint_owner_assignments as JsonRecord[]).map(item => item.assignment_id));
    const runbookAssignmentIds = toSet((freeze.audit_lint_post_patch_runbook as JsonRecord[]).map(item => item.source_assignment_id));
    const repairUpdateIds = toSet((freeze.repair_evidence_followups as JsonRecord[]).map(item => item.source_update_id));

    expect(freeze.counts.audit_lint_runbook_item_count).toBe(2);
    expect(freeze.counts.audit_lint_run_count).toBe(0);
    expect(runbookAssignmentIds).toEqual(sourceAuditLintIds);

    for (const runbook of freeze.audit_lint_post_patch_runbook as JsonRecord[]) {
      expect(runbook.run_timing).toBe('after_formal_patch_only');
      expect(runbook.run_status).toBe('waiting_for_formal_patch');
      expect(runbook.has_run).toBe(false);
      expect(runbook.audit_lint_runbook_is_run_result).toBe(false);
    }

    expect(freeze.counts.repair_evidence_followup_count).toBe(4);
    expect(repairUpdateIds.has('medical_privacy_boundary_rechecked')).toBe(true);
    expect(repairUpdateIds.has('real_reviewer_identity_attached')).toBe(true);

    for (const followup of freeze.repair_evidence_followups as JsonRecord[]) {
      expect(followup.followup_status).toBe('open_pending_attachment');
      expect(followup.evidence_package_id).toBe('evidence-freeze-package-002');
    }
  });

  it('documents the reminder board without implying evidence submission or signatures', () => {
    const freeze = readJson(freezePath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');

    expect(freeze.reminder_board_markdown_file).toBe(
      'docs/production-cards/domain-pack-evidence-freeze-signature-reminder-board-20260710.md'
    );
    expect(markdown).toContain('状态：evidence_package_frozen_reminder_board_created');
    expect(markdown).toContain('evidence_freeze_is_attachment_submission: false');
    expect(markdown).toContain('reminder_board_is_signature: false');
    expect(markdown).toContain('audit_lint_runbook_is_run_result: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 冻结附件槽位');
    expect(markdown).toContain('## 签署催办看板');
    expect(markdown).toContain('## 正式 Patch 后 audit / lint 运行清单');

    for (const reminder of freeze.signature_reminder_board as JsonRecord[]) {
      expect(markdown).toContain(reminder.reminder_id);
      expect(markdown).toContain(reminder.assignment_id);
    }
  });

  it('tracks Iteration 20 gates while keeping formal files untouched', () => {
    const freeze = readJson(freezePath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const machineGates = new Map((freeze.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((freeze.iteration_20_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(freeze.writeback_policy.formal_patch_created).toBe(false);
    expect(freeze.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(freeze.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(freeze.writeback_policy.province_markdown_written).toBe(false);
    expect(freeze.writeback_policy.evidence_freeze_is_attachment_submission).toBe(false);
    expect(freeze.writeback_policy.reminder_board_is_signature).toBe(false);
    expect(freeze.writeback_policy.audit_lint_runbook_is_run_result).toBe(false);
    expect(freeze.counts.formal_patch_count).toBe(0);

    expect(machineGates.get('evidence-package-list-created')?.status).toBe('met_as_frozen_slot_list');
    expect(machineGates.get('required-attachment-slots-frozen')?.current_count).toBe(6);
    expect(machineGates.get('signature-reminder-board-created')?.status).toBe('met_as_unsigned_reminders');
    expect(machineGates.get('audit-lint-runbook-created')?.status).toBe('met_as_waiting_for_formal_patch');
    expect(machineGates.get('attachment-files-not-committed')?.current_count).toBe(0);
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('reminder-board-not-signature')?.status).toBe('met');
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('evidence-attachment-package-list-frozen')?.status).toBe('met_as_slot_freeze_only');
    expect(exitGates.get('signature-reminder-board-created')?.status).toBe('met_as_unsigned_reminders');
    expect(exitGates.get('audit-lint-post-patch-runbook-created')?.status).toBe('met_as_waiting_for_formal_patch');
    expect(exitGates.get('formal-patch-still-zero')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
