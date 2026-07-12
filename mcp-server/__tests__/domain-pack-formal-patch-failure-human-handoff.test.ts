import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const handoffPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-formal-patch-failure-report-and-human-handoff.json'
);
const reviewLockPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-signature-feedback-validation-and-review-lock.json'
);
const freezePath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-evidence-freeze-and-signature-reminder-board.json'
);
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-formal-patch-failure-human-handoff-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function ids(items: JsonRecord[], key: string): Set<string> {
  return new Set(items.map(item => item[key] as string));
}

describe('Domain Pack formal patch failure report and human handoff', () => {
  it('creates a failure report while preserving all formal write boundaries', () => {
    const handoff = readJson(handoffPath);
    const formalDomainPack = readJson(formalDomainPackPath);

    expect(handoff.schema_version).toBe('domain-pack-formal-patch-failure-human-handoff/v1');
    expect(handoff.status).toBe('formal_patch_failure_report_human_handoff_created');
    expect(handoff.counts.failure_report_item_count).toBe(12);
    expect(handoff.counts.source_failure_reason_count).toBe(10);
    expect(handoff.counts.blocker_group_count).toBe(4);
    expect(handoff.counts.real_human_approval_count).toBe(0);
    expect(handoff.counts.formal_patch_count).toBe(0);
    expect(Array.isArray(formalDomainPack.entries)).toBe(true);

    expect(handoff.writeback_policy.handoff_package_is_formal_approval).toBe(false);
    expect(handoff.writeback_policy.failure_report_is_patch_request).toBe(false);
    expect(handoff.writeback_policy.printable_handoff_is_signature).toBe(false);
    expect(handoff.writeback_policy.formal_patch_created).toBe(false);
    expect(handoff.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(handoff.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(handoff.writeback_policy.province_markdown_written).toBe(false);
  });

  it('mirrors all source failures and audit/lint waiting locks', () => {
    const handoff = readJson(handoffPath);
    const reviewLock = readJson(reviewLockPath);
    const report = handoff.formal_patch_failure_report as JsonRecord;
    const sourceFailures = reviewLock.failure_reason_index as JsonRecord;
    const attachmentItems = report.missing_attachment_items as JsonRecord[];
    const signatureItems = report.missing_signature_items as JsonRecord[];
    const ownerItems = report.missing_owner_items as JsonRecord[];
    const auditLintItems = report.audit_lint_waiting_items as JsonRecord[];

    expect(ids(attachmentItems, 'failure_id')).toEqual(
      ids(sourceFailures.missing_attachment_failures as JsonRecord[], 'failure_id')
    );
    expect(ids(signatureItems, 'failure_id')).toEqual(
      ids(sourceFailures.missing_signature_failures as JsonRecord[], 'failure_id')
    );
    expect(ids(ownerItems, 'failure_id')).toEqual(
      ids(sourceFailures.missing_owner_failures as JsonRecord[], 'failure_id')
    );
    expect(ids(auditLintItems, 'source_lock_id')).toEqual(
      ids(reviewLock.audit_lint_lock_status as JsonRecord[], 'lock_id')
    );

    expect(attachmentItems).toHaveLength(2);
    expect(signatureItems).toHaveLength(4);
    expect(ownerItems).toHaveLength(4);
    expect(auditLintItems).toHaveLength(2);
    expect(attachmentItems.reduce((sum, item) => sum + item.missing_slot_count, 0)).toBe(12);

    for (const item of signatureItems) {
      expect(item.signature_status).toBe('blank');
      expect(item.is_signed).toBe(false);
    }

    for (const item of ownerItems) {
      expect(item.real_owner_placeholder).toBe('[待指定]');
    }

    for (const item of auditLintItems) {
      expect(item.status).toBe('waiting_for_formal_patch');
      expect(item.has_run).toBe(false);
    }
  });

  it('builds two handoff packages directly from the locked review packages', () => {
    const handoff = readJson(handoffPath);
    const reviewLock = readJson(reviewLockPath);
    const freeze = readJson(freezePath);
    const packages = handoff.human_handoff_packages as JsonRecord[];
    const lockedPackages = reviewLock.review_package_locks as JsonRecord[];
    const sourceLocks = new Map(lockedPackages.map(item => [item.lock_id, item]));
    const repairFollowupIds = ids(freeze.repair_evidence_followups as JsonRecord[], 'followup_id');

    expect(handoff.counts.human_handoff_package_count).toBe(2);
    expect(ids(packages, 'source_review_lock_id')).toEqual(ids(lockedPackages, 'lock_id'));

    for (const pkg of packages) {
      const source = sourceLocks.get(pkg.source_review_lock_id) as JsonRecord;
      expect(pkg.source_evidence_package_id).toBe(source.source_evidence_package_id);
      expect(pkg.candidate_id).toBe(source.candidate_id);
      expect(pkg.required_attachment_slot_ids).toEqual(source.locked_required_slot_ids);
      expect(pkg.all_required_attachments_present).toBe(false);
      expect(pkg.handoff_package_is_formal_approval).toBe(false);
      expect(pkg.formal_patch_created).toBe(false);
      expect(pkg.formal_domain_pack_written).toBe(false);
      expect(pkg.province_markdown_written).toBe(false);
    }

    const repairPackage = packages.find(item => item.handoff_package_id === 'human-handoff-package-002');
    expect(repairPackage).toBeDefined();
    expect(new Set(repairPackage?.repair_followup_ids)).toEqual(repairFollowupIds);
    expect(repairPackage?.repair_signoff_complete).toBe(false);
    expect(repairPackage?.repair_resubmitted).toBe(false);
  });

  it('keeps printable review sheets as unsigned handoff templates', () => {
    const handoff = readJson(handoffPath);
    const packages = handoff.human_handoff_packages as JsonRecord[];
    const sheets = handoff.printable_review_sheets as JsonRecord[];

    expect(handoff.counts.printable_review_sheet_count).toBe(2);
    expect(ids(sheets, 'handoff_package_id')).toEqual(ids(packages, 'handoff_package_id'));

    for (const sheet of sheets) {
      const sourcePackage = packages.find(pkg => pkg.handoff_package_id === sheet.handoff_package_id);
      expect(sourcePackage).toBeDefined();
      expect(sheet.candidate_id).toBe(sourcePackage?.candidate_id);
      expect(sheet.review_section_ids.length).toBeGreaterThanOrEqual(6);
      expect(sheet.required_signoff_fields).toContain('signature_record_reference');
      expect(sheet.signature_record_reference).toBe('');
      expect(sheet.printable_handoff_is_signature).toBe(false);
      expect(sheet.handoff_package_is_formal_approval).toBe(false);
      expect(sheet.failure_report_is_patch_request).toBe(false);
    }
  });

  it('documents the handoff package and every remaining blocker class', () => {
    const handoff = readJson(handoffPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');

    expect(handoff.human_handoff_markdown_file).toBe(
      'docs/production-cards/domain-pack-formal-patch-failure-human-handoff-20260710.md'
    );
    expect(markdown).toContain('状态：formal_patch_failure_report_human_handoff_created');
    expect(markdown).toContain('handoff_package_is_formal_approval: false');
    expect(markdown).toContain('failure_report_is_patch_request: false');
    expect(markdown).toContain('printable_handoff_is_signature: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 阻断摘要');
    expect(markdown).toContain('## 人审交接包一');
    expect(markdown).toContain('## 人审交接包二');
    expect(markdown).toContain('## audit/lint 后置清单');

    for (const group of handoff.blocker_summary as JsonRecord[]) {
      expect(markdown).toContain(group.blocker_group_id);
    }

    for (const pkg of handoff.human_handoff_packages as JsonRecord[]) {
      expect(markdown).toContain(pkg.handoff_package_id);
      expect(markdown).toContain(pkg.source_review_lock_id);
      expect(markdown).toContain(pkg.printable_review_sheet_id);
    }
  });

  it('tracks Iteration 22 gates without claiming external human completion', () => {
    const handoff = readJson(handoffPath);
    const machineGates = new Map((handoff.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((handoff.iteration_22_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(handoff.counts.machine_gate_count).toBe(9);
    expect(machineGates.get('formal-patch-failure-report-created')?.current_count).toBe(12);
    expect(machineGates.get('human-handoff-packages-created')?.status).toBe('met_as_handoff_only');
    expect(machineGates.get('printable-review-sheets-created')?.status).toBe('met_as_unsigned_templates');
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('failure-report-and-four-blocker-groups-created')?.current_count).toBe(4);
    expect(exitGates.get('human-review-handoff-packages-created')?.status).toBe('met_as_handoff_only');
    expect(exitGates.get('owners-attachments-signatures-still-explicitly-blocked')?.current_count).toBe(10);
    expect(exitGates.get('audit-lint-still-waiting-for-formal-patch')?.current_count).toBe(2);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
