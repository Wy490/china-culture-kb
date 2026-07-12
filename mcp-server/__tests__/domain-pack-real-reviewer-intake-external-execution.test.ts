import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const intakePath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-reviewer-intake-field-freeze-and-external-execution-checklist.json'
);
const handoffPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-formal-patch-failure-report-and-human-handoff.json'
);
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-real-reviewer-intake-field-freeze-external-execution-checklist-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function ids(items: JsonRecord[], key: string): Set<string> {
  return new Set(items.map(item => item[key] as string));
}

describe('Domain Pack real reviewer intake and external execution checklist', () => {
  it('freezes the intake contract without claiming submission, signature, or writeback', () => {
    const intake = readJson(intakePath);
    const formalDomainPack = readJson(formalDomainPackPath);

    expect(intake.schema_version).toBe('domain-pack-real-reviewer-intake-field-freeze-external-execution/v1');
    expect(intake.status).toBe('real_reviewer_intake_fields_frozen_external_execution_checklist_created');
    expect(intake.counts.valid_real_reviewer_intake_count).toBe(0);
    expect(intake.counts.audit_lint_run_count).toBe(0);
    expect(intake.counts.formal_patch_count).toBe(0);
    expect(Array.isArray(formalDomainPack.entries)).toBe(true);

    expect(intake.writeback_policy.reviewer_intake_templates_are_real_submissions).toBe(false);
    expect(intake.writeback_policy.blank_intake_is_signature).toBe(false);
    expect(intake.writeback_policy.external_execution_checklist_is_run_result).toBe(false);
    expect(intake.writeback_policy.formal_patch_request_recorded).toBe(false);
    expect(intake.writeback_policy.formal_patch_created).toBe(false);
    expect(intake.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(intake.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(intake.writeback_policy.province_markdown_written).toBe(false);
  });

  it('freezes sixteen fields and eleven validation rules', () => {
    const intake = readJson(intakePath);
    const fields = intake.reviewer_intake_field_schema as JsonRecord[];
    const rules = intake.intake_validation_rules as JsonRecord[];
    const fieldIds = ids(fields, 'field_id');
    const ruleIds = ids(rules, 'rule_id');

    expect(fields).toHaveLength(16);
    expect(fieldIds.size).toBe(16);
    expect(fields.filter(field => field.requirement === 'required')).toHaveLength(14);
    expect(fields.filter(field => field.requirement.startsWith('conditional_required'))).toHaveLength(1);
    expect(fields.filter(field => field.requirement === 'optional')).toHaveLength(1);
    expect(rules).toHaveLength(11);
    expect(ruleIds.size).toBe(11);

    for (const fieldId of [
      'reviewer_name_or_group',
      'reviewer_role',
      'review_decision',
      'decision_reason',
      'signed_at',
      'signature_record_reference',
      'explicit_formal_patch_request',
      'formal_patch_request_record_reference'
    ]) {
      expect(fieldIds.has(fieldId)).toBe(true);
    }

    expect(ruleIds.has('all-attachment-slots-must-have-record-or-waiver')).toBe(true);
    expect(ruleIds.has('signature-record-reference-must-be-nonblank')).toBe(true);
    expect(ruleIds.has('formal-patch-request-must-have-separate-authorized-record')).toBe(true);
  });

  it('maps eight blank role-specific intakes to the two human handoff packages', () => {
    const intake = readJson(intakePath);
    const handoff = readJson(handoffPath);
    const templates = intake.blank_reviewer_intake_templates as JsonRecord[];
    const handoffPackages = handoff.human_handoff_packages as JsonRecord[];
    const packageById = new Map(handoffPackages.map(pkg => [pkg.handoff_package_id, pkg]));
    const craftTemplates = templates.filter(item => item.source_handoff_package_id === 'human-handoff-package-001');
    const repairTemplates = templates.filter(item => item.source_handoff_package_id === 'human-handoff-package-002');
    const report = handoff.formal_patch_failure_report as JsonRecord;

    expect(templates).toHaveLength(8);
    expect(craftTemplates).toHaveLength(4);
    expect(repairTemplates).toHaveLength(4);
    expect(ids(craftTemplates, 'reviewer_role')).toEqual(
      new Set(packageById.get('human-handoff-package-001')?.required_reviewer_roles)
    );
    expect(ids(repairTemplates, 'reviewer_role')).toEqual(
      new Set(packageById.get('human-handoff-package-002')?.required_reviewer_roles)
    );
    expect(ids(craftTemplates, 'assignment_or_followup_id')).toEqual(
      ids(report.missing_signature_items as JsonRecord[], 'assignment_id')
    );
    expect(ids(repairTemplates, 'assignment_or_followup_id')).toEqual(
      new Set(packageById.get('human-handoff-package-002')?.repair_followup_ids)
    );

    for (const template of templates) {
      expect(template.reviewer_name_or_group).toBe('');
      expect(template.reviewer_identity_type).toBe('');
      expect(template.review_decision).toBe('');
      expect(template.decision_reason).toBe('');
      expect(template.attachment_record_references).toEqual([]);
      expect(template.attachment_waiver_record_references).toEqual([]);
      expect(template.signed_at).toBe('');
      expect(template.signature_record_reference).toBe('');
      expect(template.explicit_formal_patch_request).toBe(false);
      expect(template.formal_patch_request_record_reference).toBe('');
      expect(template.validation_status).toBe('blocked_blank_external_intake');
      expect(template.failed_rule_ids).toHaveLength(7);
      expect(template.is_signed).toBe(false);
      expect(template.reviewer_intake_templates_are_real_submissions).toBe(false);
      expect(template.blank_intake_is_signature).toBe(false);
      expect(template.formal_patch_created).toBe(false);
      expect(template.formal_domain_pack_written).toBe(false);
      expect(template.province_markdown_written).toBe(false);
    }
  });

  it('maps sixteen external tasks to the existing blockers and blank intake templates', () => {
    const intake = readJson(intakePath);
    const handoff = readJson(handoffPath);
    const checklist = intake.external_execution_checklist as JsonRecord;
    const ownerTasks = checklist.owner_assignment_tasks as JsonRecord[];
    const attachmentTasks = checklist.attachment_submission_tasks as JsonRecord[];
    const reviewTasks = checklist.review_signature_submission_tasks as JsonRecord[];
    const postPatchTasks = checklist.post_patch_audit_lint_tasks as JsonRecord[];
    const templates = intake.blank_reviewer_intake_templates as JsonRecord[];
    const report = handoff.formal_patch_failure_report as JsonRecord;

    expect(ownerTasks).toHaveLength(4);
    expect(attachmentTasks).toHaveLength(2);
    expect(reviewTasks).toHaveLength(8);
    expect(postPatchTasks).toHaveLength(2);
    expect(ownerTasks.length + attachmentTasks.length + reviewTasks.length + postPatchTasks.length).toBe(16);

    expect(ids(ownerTasks, 'source_failure_id')).toEqual(ids(report.missing_owner_items as JsonRecord[], 'failure_id'));
    expect(ids(attachmentTasks, 'source_failure_id')).toEqual(
      ids(report.missing_attachment_items as JsonRecord[], 'failure_id')
    );
    expect(ids(reviewTasks, 'target_reviewer_intake_id')).toEqual(ids(templates, 'reviewer_intake_id'));
    expect(ids(postPatchTasks, 'source_blocker_id')).toEqual(
      ids(report.audit_lint_waiting_items as JsonRecord[], 'blocker_id')
    );

    for (const task of ownerTasks) {
      expect(task.real_owner).toBe('');
      expect(task.completion_record_reference).toBe('');
      expect(task.status).toBe('open_external_human_action');
    }

    for (const task of attachmentTasks) {
      expect(task.required_slot_count).toBe(6);
      expect(task.submitted_attachment_record_references).toEqual([]);
      expect(task.approved_waiver_record_references).toEqual([]);
      expect(task.all_slots_addressed).toBe(false);
    }

    for (const task of reviewTasks) {
      expect(task.submission_record_reference).toBe('');
      expect(task.is_signed).toBe(false);
      expect(task.status).toBe('blocked_blank_intake');
    }

    for (const task of postPatchTasks) {
      expect(task.run_record_reference).toBe('');
      expect(task.has_run).toBe(false);
      expect(task.status).toBe('blocked_until_formal_patch');
    }
  });

  it('documents the frozen fields, blank intakes, and four external workstreams', () => {
    const intake = readJson(intakePath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');

    expect(intake.external_execution_markdown_file).toBe(
      'docs/production-cards/domain-pack-real-reviewer-intake-field-freeze-external-execution-checklist-20260710.md'
    );
    expect(markdown).toContain('状态：real_reviewer_intake_fields_frozen_external_execution_checklist_created');
    expect(markdown).toContain('reviewer_intake_templates_are_real_submissions: false');
    expect(markdown).toContain('blank_intake_is_signature: false');
    expect(markdown).toContain('external_execution_checklist_is_run_result: false');
    expect(markdown).toContain('formal_patch_request_recorded: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 冻结字段');
    expect(markdown).toContain('## 空白填报实例');
    expect(markdown).toContain('### 负责人指定');
    expect(markdown).toContain('### 附件提交');
    expect(markdown).toContain('### 审稿与签署提交');
    expect(markdown).toContain('### 正式 Patch 后检查');

    for (const template of intake.blank_reviewer_intake_templates as JsonRecord[]) {
      expect(markdown).toContain(template.reviewer_intake_id);
      expect(markdown).toContain(template.assignment_or_followup_id);
    }
  });

  it('tracks Iteration 23 gates while external human completion remains zero', () => {
    const intake = readJson(intakePath);
    const machineGates = new Map((intake.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((intake.iteration_23_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(intake.counts.machine_gate_count).toBe(10);
    expect(machineGates.get('reviewer-intake-fields-frozen')?.current_count).toBe(16);
    expect(machineGates.get('blank-reviewer-intake-templates-created')?.status).toBe(
      'met_as_blank_unsigned_templates'
    );
    expect(machineGates.get('valid-real-reviewer-intakes-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('external-execution-tasks-created')?.current_count).toBe(16);
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('real-reviewer-intake-contract-frozen')?.current_count).toBe(16);
    expect(exitGates.get('role-specific-blank-intakes-created')?.current_count).toBe(8);
    expect(exitGates.get('external-execution-checklist-created')?.current_count).toBe(16);
    expect(exitGates.get('no-real-reviewer-submission-claimed')?.current_count).toBe(0);
    expect(exitGates.get('audit-lint-still-blocked-until-formal-patch')?.current_count).toBe(2);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
