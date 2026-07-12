import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const dashboardPath = path.join(repoRoot, 'data', 'production-cards', 'domain-pack-review-dashboard-and-intake.json');
const evidenceLedgerPath = path.join(repoRoot, 'data', 'production-cards', 'domain-pack-review-evidence-ledger.json');
const intakeMarkdownPath = path.join(repoRoot, 'docs', 'production-cards', 'domain-pack-review-decision-intake-20260710.md');
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function toSet(values: string[]): Set<string> {
  return new Set(values);
}

describe('Domain Pack review dashboard and intake', () => {
  it('builds a five-column dashboard that covers all pending review work', () => {
    const dashboard = readJson(dashboardPath);
    const ledger = readJson(evidenceLedgerPath);
    const candidateIds = toSet(
      (ledger.domain_pack_evidence_slot_sets as JsonRecord[]).map(slotSet => slotSet.candidate_id)
    );
    const repairRejectTaskIds = toSet(
      (ledger.repair_reject_task_evidence_mappings as JsonRecord[]).map(task => task.task_id)
    );
    const passPrepareIds = toSet(
      (ledger.pass_draft_blocker_sets as JsonRecord[]).map(blocker => blocker.prepare_template_id)
    );
    const columns = new Map((dashboard.review_dashboard_columns as JsonRecord[]).map(column => [column.column_id, column]));

    expect(dashboard.schema_version).toBe('domain-pack-review-dashboard-intake/v1');
    expect(dashboard.status).toBe('dashboard_created_intake_template_only');
    expect(dashboard.counts.dashboard_column_count).toBe(5);
    expect(dashboard.counts.dashboard_candidate_count).toBe(9);

    expect(toSet(columns.get('evidence_pending')!.candidate_ids)).toEqual(candidateIds);
    expect(toSet(columns.get('reviewer_assignment_pending')!.candidate_ids)).toEqual(candidateIds);
    expect(toSet(columns.get('decision_not_started')!.candidate_ids)).toEqual(candidateIds);
    expect(toSet(columns.get('repair_reject_open')!.task_ids)).toEqual(repairRejectTaskIds);
    expect(toSet(columns.get('pass_blocked_until_real_review')!.prepare_template_ids)).toEqual(passPrepareIds);
  });

  it('creates required field rules and keeps all ledger fill statuses incomplete', () => {
    const dashboard = readJson(dashboardPath);
    const ledger = readJson(evidenceLedgerPath);
    const ledgerCandidateIds = toSet((ledger.human_review_decision_ledger as JsonRecord[]).map(entry => entry.candidate_id));
    const fillCandidateIds = toSet((dashboard.ledger_fill_statuses as JsonRecord[]).map(entry => entry.candidate_id));
    const requiredFieldIds = new Set((dashboard.required_field_rules as JsonRecord[]).map(rule => rule.field_id));

    expect(dashboard.counts.required_field_rule_count).toBe(10);
    expect(dashboard.counts.ledger_fill_status_count).toBe(9);
    expect(dashboard.counts.ledger_fill_required_complete_count).toBe(0);
    expect(fillCandidateIds).toEqual(ledgerCandidateIds);

    for (const fieldId of [
      'reviewer_name',
      'reviewer_role',
      'decision',
      'source_bibliography_attachment',
      'fact_boundary_table_attachment',
      'authorization_or_consent_attachment',
      'sample_validation_attachment',
      'final_decision_reason',
      'manual_patch_request_state',
    ]) {
      expect(requiredFieldIds.has(fieldId), fieldId).toBe(true);
    }

    for (const fillStatus of dashboard.ledger_fill_statuses as JsonRecord[]) {
      expect(fillStatus.intake_status).toBe('not_started');
      expect(fillStatus.decision_status).toBe('not_started');
      expect(fillStatus.required_fields_complete).toBe(false);
      expect(fillStatus.evidence_slots_complete).toBe(false);
      expect(fillStatus.real_reviewer_signed).toBe(false);
      expect(fillStatus.formal_patch_created).toBe(false);
      expect(fillStatus.missing_required_field_ids).toContain('reviewer_name');
      expect(fillStatus.missing_required_field_ids).toContain('final_decision_reason');
    }
  });

  it('aligns repair/reject intake and pass blockers with the evidence ledger', () => {
    const dashboard = readJson(dashboardPath);
    const ledger = readJson(evidenceLedgerPath);
    const repairRejectTaskIds = toSet(
      (ledger.repair_reject_task_evidence_mappings as JsonRecord[]).map(task => task.task_id)
    );
    const intakeTaskIds = toSet((dashboard.repair_reject_intake_queue as JsonRecord[]).map(task => task.task_id));
    const passPrepareIds = toSet(
      (ledger.pass_draft_blocker_sets as JsonRecord[]).map(blocker => blocker.prepare_template_id)
    );
    const intakePassPrepareIds = toSet(
      (dashboard.pass_blocker_intake_queue as JsonRecord[]).map(blocker => blocker.prepare_template_id)
    );

    expect(dashboard.counts.open_repair_reject_task_count).toBe(14);
    expect(dashboard.counts.pass_blocker_count).toBe(2);
    expect(intakeTaskIds).toEqual(repairRejectTaskIds);
    expect(intakePassPrepareIds).toEqual(passPrepareIds);

    for (const task of dashboard.repair_reject_intake_queue as JsonRecord[]) {
      expect(task.required_form_section).toBe('repair_or_reject_task_update');
      expect(task.owner_role).toBeTruthy();
      if (task.decision_type === 'reject') {
        expect(task.intake_status).toBe('waiting_for_new_source_package_entry');
      } else {
        expect(task.intake_status).toBe('waiting_for_evidence_entry');
      }
    }

    for (const blocker of dashboard.pass_blocker_intake_queue as JsonRecord[]) {
      expect(blocker.intake_status).toBe('blocked_until_required_fields_complete');
      expect(blocker.writeback_allowed_now).toBe(false);
      expect(blocker.formal_patch_created).toBe(false);
      expect(blocker.blocking_gate_ids).toContain('real_human_review_approved');
      expect(blocker.blocking_gate_ids).toContain('formal_patch_explicitly_requested_by_human');
    }
  });

  it('creates a fillable Markdown intake form without granting formal approval', () => {
    const dashboard = readJson(dashboardPath);
    const markdown = fs.readFileSync(intakeMarkdownPath, 'utf-8');

    expect(dashboard.decision_intake_markdown_file).toBe(
      'docs/production-cards/domain-pack-review-decision-intake-20260710.md'
    );
    expect(markdown).toContain('状态：intake_template_only');
    expect(markdown).toContain('## 9 个候选包决策填报表');
    expect(markdown).toContain('## repair / reject 任务更新表');
    expect(markdown).toContain('## pass 草案阻断表');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('intake_form_is_formal_approval: false');

    for (const fillStatus of dashboard.ledger_fill_statuses as JsonRecord[]) {
      expect(markdown).toContain(fillStatus.candidate_id);
      expect(markdown).toContain('not_started');
    }

    for (const task of dashboard.repair_reject_intake_queue as JsonRecord[]) {
      expect(markdown).toContain(task.task_id);
    }

    for (const blocker of dashboard.pass_blocker_intake_queue as JsonRecord[]) {
      expect(markdown).toContain(blocker.prepare_template_id);
      expect(markdown).toContain(blocker.card_id);
    }
  });

  it('tracks Iteration 16 gates while keeping formal knowledge files untouched', () => {
    const dashboard = readJson(dashboardPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const machineGates = new Map((dashboard.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((dashboard.iteration_16_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(dashboard.writeback_policy.formal_patch_created).toBe(false);
    expect(dashboard.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(dashboard.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(dashboard.writeback_policy.province_markdown_written).toBe(false);
    expect(dashboard.writeback_policy.intake_form_is_formal_approval).toBe(false);
    expect(dashboard.counts.formal_patch_count).toBe(0);

    expect(machineGates.get('review-dashboard-columns-created')?.current_count).toBe(5);
    expect(machineGates.get('dashboard-covers-nine-domain-pack-candidates')?.current_count).toBe(9);
    expect(machineGates.get('ledger-fill-statuses-created-without-approval')?.status).toBe('met_as_not_started');
    expect(machineGates.get('repair-reject-intake-queue-created')?.current_count).toBe(14);
    expect(machineGates.get('pass-blocker-intake-queue-created')?.status).toBe('met_as_blocking_queue');
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-or-domain-pack-writeback')?.status).toBe('met');

    expect(exitGates.get('review-dashboard-created')?.status).toBe('met');
    expect(exitGates.get('decision-intake-form-created')?.status).toBe('met_as_template_only');
    expect(exitGates.get('blank-ledger-fill-statuses-block-approval')?.status).toBe('met_as_not_started');
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
