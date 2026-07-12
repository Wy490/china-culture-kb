import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
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
  'domain-pack-signature-feedback-review-lock-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function toSet(values: string[]): Set<string> {
  return new Set(values);
}

describe('Domain Pack signature feedback validation and review lock', () => {
  it('creates signature feedback rules while preserving no-writeback policies', () => {
    const reviewLock = readJson(reviewLockPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const ruleIds = toSet((reviewLock.signature_feedback_rules as JsonRecord[]).map(rule => rule.rule_id));

    expect(reviewLock.schema_version).toBe('domain-pack-signature-feedback-review-lock/v1');
    expect(reviewLock.status).toBe('signature_feedback_samples_created_review_packages_locked');
    expect(reviewLock.counts.signature_feedback_rule_count).toBe(8);
    expect(ruleIds.has('owner-must-be-real-person-or-group')).toBe(true);
    expect(ruleIds.has('attachment-package-must-have-files')).toBe(true);
    expect(ruleIds.has('signed-feedback-cannot-create-formal-patch')).toBe(true);
    expect(ruleIds.has('no-province-writeback')).toBe(true);

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(reviewLock.writeback_policy.signature_feedback_samples_are_real_signatures).toBe(false);
    expect(reviewLock.writeback_policy.review_package_lock_is_approval).toBe(false);
    expect(reviewLock.writeback_policy.locked_package_is_attachment_submission).toBe(false);
    expect(reviewLock.writeback_policy.formal_patch_created).toBe(false);
    expect(reviewLock.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(reviewLock.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(reviewLock.writeback_policy.province_markdown_written).toBe(false);
    expect(reviewLock.counts.formal_patch_count).toBe(0);
  });

  it('keeps all signature feedback samples as simulation-only fixtures', () => {
    const reviewLock = readJson(reviewLockPath);
    const samples = reviewLock.simulated_signature_feedback_samples as JsonRecord[];
    const validSamples = samples.filter(sample => sample.failed_rule_ids.length === 0);
    const invalidSamples = samples.filter(sample => sample.failed_rule_ids.length > 0);

    expect(reviewLock.counts.simulated_signature_feedback_sample_count).toBe(5);
    expect(reviewLock.counts.simulated_valid_feedback_count).toBe(2);
    expect(reviewLock.counts.simulated_invalid_feedback_count).toBe(3);
    expect(validSamples).toHaveLength(2);
    expect(invalidSamples).toHaveLength(3);

    for (const sample of samples) {
      expect(sample.simulation_only).toBe(true);
      expect(sample.is_signed).toBe(false);
      expect(sample.can_mark_real_signature).toBe(false);
      expect(sample.signature_feedback_samples_are_real_signatures).toBe(false);
      expect(sample.formal_patch_created).toBe(false);
      expect(sample.formal_domain_pack_written).toBe(false);
      expect(sample.province_markdown_written).toBe(false);
      expect(sample.assignment_id).toMatch(/^dispatch-signature-/);
      expect(sample.signature_id).toMatch(/^signature-placeholder-/);
    }

    expect(invalidSamples.map(sample => sample.sample_id)).toContain('sig-feedback-invalid-missing-owner-001');
    expect(invalidSamples.map(sample => sample.sample_id)).toContain('sig-feedback-invalid-missing-attachments-001');
    expect(invalidSamples.map(sample => sample.sample_id)).toContain('sig-feedback-invalid-pretend-formal-patch-001');
  });

  it('locks two evidence packages from the freeze board without treating lock as approval', () => {
    const reviewLock = readJson(reviewLockPath);
    const freeze = readJson(freezePath);
    const sourcePackages = freeze.evidence_attachment_packages as JsonRecord[];
    const lockedPackages = reviewLock.review_package_locks as JsonRecord[];
    const frozenSlotIds = (freeze.frozen_attachment_slot_schema as JsonRecord[]).map(slot => slot.slot_id);
    const sourcePackageIds = toSet(sourcePackages.map(pkg => pkg.package_id));
    const lockedSourcePackageIds = toSet(lockedPackages.map(pkg => pkg.source_evidence_package_id));

    expect(reviewLock.counts.review_package_lock_count).toBe(2);
    expect(reviewLock.counts.locked_required_slot_reference_count).toBe(12);
    expect(lockedSourcePackageIds).toEqual(sourcePackageIds);

    for (const lockedPackage of lockedPackages) {
      expect(lockedPackage.locked_required_slot_ids).toEqual(frozenSlotIds);
      expect(lockedPackage.attachment_file_committed).toBe(false);
      expect(lockedPackage.all_required_attachments_present).toBe(false);
      expect(lockedPackage.all_signatures_complete).toBe(false);
      expect(lockedPackage.real_owner_assigned).toBe(false);
      expect(lockedPackage.review_package_lock_is_approval).toBe(false);
      expect(lockedPackage.locked_package_is_attachment_submission).toBe(false);
      expect(lockedPackage.formal_patch_created).toBe(false);
      expect(lockedPackage.formal_domain_pack_written).toBe(false);
      expect(lockedPackage.province_markdown_written).toBe(false);
    }
  });

  it('indexes missing attachments, signatures, and owners from the freeze board', () => {
    const reviewLock = readJson(reviewLockPath);
    const freeze = readJson(freezePath);
    const failureIndex = reviewLock.failure_reason_index as JsonRecord;
    const missingAttachments = failureIndex.missing_attachment_failures as JsonRecord[];
    const missingSignatures = failureIndex.missing_signature_failures as JsonRecord[];
    const missingOwners = failureIndex.missing_owner_failures as JsonRecord[];
    const freezePackageIds = toSet((freeze.evidence_attachment_packages as JsonRecord[]).map(pkg => pkg.package_id));
    const attachmentPackageIds = toSet(missingAttachments.map(item => item.source_evidence_package_id));
    const freezeReminderIds = toSet((freeze.signature_reminder_board as JsonRecord[]).map(item => item.reminder_id));
    const signatureReminderIds = toSet(missingSignatures.map(item => item.source_reminder_id));
    const ownerReminderIds = toSet(missingOwners.map(item => item.source_reminder_id));

    expect(reviewLock.counts.missing_attachment_failure_count).toBe(2);
    expect(reviewLock.counts.missing_attachment_slot_reference_count).toBe(12);
    expect(reviewLock.counts.missing_signature_failure_count).toBe(4);
    expect(reviewLock.counts.missing_owner_failure_count).toBe(4);
    expect(attachmentPackageIds).toEqual(freezePackageIds);
    expect(signatureReminderIds).toEqual(freezeReminderIds);
    expect(ownerReminderIds).toEqual(freezeReminderIds);

    for (const attachment of missingAttachments) {
      expect(attachment.missing_slot_count).toBe(6);
      expect(attachment.missing_slot_ids).toHaveLength(6);
    }

    for (const signature of missingSignatures) {
      expect(signature.signature_status).toBe('blank');
      expect(signature.is_signed).toBe(false);
      expect(signature.blocking_status).toBe('blocks_formal_patch');
    }

    for (const owner of missingOwners) {
      expect(owner.real_owner_placeholder).toBe('[待指定]');
      expect(owner.blocking_status).toBe('blocks_signature');
    }
  });

  it('locks audit/lint runbook items as waiting for formal patch only', () => {
    const reviewLock = readJson(reviewLockPath);
    const freeze = readJson(freezePath);
    const sourceRunbookIds = toSet((freeze.audit_lint_post_patch_runbook as JsonRecord[]).map(item => item.runbook_id));
    const lockedRunbookIds = toSet((reviewLock.audit_lint_lock_status as JsonRecord[]).map(item => item.source_runbook_id));

    expect(reviewLock.counts.audit_lint_lock_item_count).toBe(2);
    expect(reviewLock.counts.audit_lint_run_count).toBe(0);
    expect(lockedRunbookIds).toEqual(sourceRunbookIds);

    for (const item of reviewLock.audit_lint_lock_status as JsonRecord[]) {
      expect(item.lock_status).toBe('locked_waiting_for_formal_patch');
      expect(item.has_run).toBe(false);
      expect(item.audit_lint_runbook_is_run_result).toBe(false);
    }
  });

  it('documents the review lock and tracks Iteration 21 gates', () => {
    const reviewLock = readJson(reviewLockPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const machineGates = new Map((reviewLock.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((reviewLock.iteration_21_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(reviewLock.review_lock_markdown_file).toBe(
      'docs/production-cards/domain-pack-signature-feedback-review-lock-20260710.md'
    );
    expect(markdown).toContain('状态：signature_feedback_samples_created_review_packages_locked');
    expect(markdown).toContain('signature_feedback_samples_are_real_signatures: false');
    expect(markdown).toContain('review_package_lock_is_approval: false');
    expect(markdown).toContain('locked_package_is_attachment_submission: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 签署反馈模拟样例');
    expect(markdown).toContain('## 审稿包锁版清单');
    expect(markdown).toContain('## 失败原因索引');

    for (const sample of reviewLock.simulated_signature_feedback_samples as JsonRecord[]) {
      expect(markdown).toContain(sample.sample_id);
    }

    for (const lockedPackage of reviewLock.review_package_locks as JsonRecord[]) {
      expect(markdown).toContain(lockedPackage.lock_id);
      expect(markdown).toContain(lockedPackage.source_evidence_package_id);
    }

    expect(machineGates.get('signature-feedback-rules-created')?.current_count).toBe(8);
    expect(machineGates.get('simulated-feedback-samples-created')?.status).toBe('met_as_simulation_only');
    expect(machineGates.get('review-package-locks-created')?.status).toBe('met_as_lock_only');
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('signature-feedback-validation-structure-created')?.current_count).toBe(8);
    expect(exitGates.get('signature-feedback-samples-created')?.status).toBe('met_as_simulation_only');
    expect(exitGates.get('review-packages-locked')?.current_count).toBe(2);
    expect(exitGates.get('failure-reasons-indexed')?.current_count).toBe(10);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
