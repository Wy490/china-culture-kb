import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const evidenceLedgerPath = path.join(repoRoot, 'data', 'production-cards', 'domain-pack-review-evidence-ledger.json');
const isolationPath = path.join(repoRoot, 'data', 'production-cards', 'domain-pack-human-review-and-patch-isolation.json');
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('Domain Pack review evidence ledger', () => {
  it('adds evidence slot sets and Markdown sections for all nine review templates', () => {
    const ledger = readJson(evidenceLedgerPath);
    const isolation = readJson(isolationPath);
    const templatePaths = new Set((isolation.domain_pack_review_templates as JsonRecord[]).map(template => template.path));
    const slotPaths = new Set((ledger.domain_pack_evidence_slot_sets as JsonRecord[]).map(slotSet => slotSet.path));

    expect(ledger.schema_version).toBe('domain-pack-review-evidence-ledger/v1');
    expect(ledger.counts.domain_pack_evidence_slot_set_count).toBe(9);
    expect(ledger.counts.evidence_slot_schema_count).toBe(6);
    expect(ledger.counts.domain_pack_review_markdown_with_evidence_slots_count).toBe(9);
    expect(slotPaths).toEqual(templatePaths);

    for (const slotSet of ledger.domain_pack_evidence_slot_sets as JsonRecord[]) {
      const markdown = fs.readFileSync(path.join(repoRoot, slotSet.path), 'utf-8');

      expect(slotSet.slot_status).toBe('pending_evidence_attachment');
      expect(slotSet.required_slot_ids).toHaveLength(6);
      expect(slotSet.required_slot_ids).toContain('source_bibliography_attachment');
      expect(slotSet.required_slot_ids).toContain('final_decision_record_attachment');
      expect(markdown).toContain('## 证据附件槽位');
      expect(markdown).toContain('来源目录附件：[待补]');
      expect(markdown).toContain('最终决策记录附件：[待补]');
    }
  });

  it('creates a blank human decision ledger without approvals or patches', () => {
    const ledger = readJson(evidenceLedgerPath);
    const isolation = readJson(isolationPath);
    const templateCandidateIds = new Set(
      (isolation.domain_pack_review_templates as JsonRecord[]).map(template => template.candidate_id)
    );
    const ledgerCandidateIds = new Set(
      (ledger.human_review_decision_ledger as JsonRecord[]).map(entry => entry.candidate_id)
    );

    expect(ledger.counts.decision_ledger_entry_count).toBe(9);
    expect(ledger.counts.decision_ledger_approved_count).toBe(0);
    expect(ledgerCandidateIds).toEqual(templateCandidateIds);

    for (const entry of ledger.human_review_decision_ledger as JsonRecord[]) {
      expect(entry.decision_status).toBe('not_started');
      expect(entry.allowed_decisions).toContain('approve_for_manual_patch_candidate');
      expect(entry.allowed_decisions).toContain('repair_required');
      expect(entry.allowed_decisions).toContain('reject_or_rebuild');
      expect(entry.real_reviewer_signed).toBe(false);
      expect(entry.evidence_slots_complete).toBe(false);
      expect(entry.formal_patch_created).toBe(false);
    }
  });

  it('maps all repair and reject tasks to evidence slots and owner roles', () => {
    const ledger = readJson(evidenceLedgerPath);
    const isolation = readJson(isolationPath);
    const sourceTaskIds = new Set((isolation.repair_reject_task_statuses as JsonRecord[]).map(task => task.task_id));
    const mappedTaskIds = new Set(
      (ledger.repair_reject_task_evidence_mappings as JsonRecord[]).map(mapping => mapping.task_id)
    );
    const slotIds = new Set((ledger.evidence_slot_schema as JsonRecord[]).map(slot => slot.slot_id));

    expect(ledger.counts.repair_reject_task_evidence_mapping_count).toBe(14);
    expect(mappedTaskIds).toEqual(sourceTaskIds);

    for (const mapping of ledger.repair_reject_task_evidence_mappings as JsonRecord[]) {
      expect(mapping.owner_role).toBeTruthy();
      expect(mapping.candidate_ids.length).toBeGreaterThanOrEqual(2);
      expect(mapping.required_slot_ids.length).toBeGreaterThanOrEqual(3);
      expect(mapping.status.startsWith('open_')).toBe(true);

      for (const slotId of mapping.required_slot_ids as string[]) {
        expect(slotIds.has(slotId), `${mapping.task_id} missing slot ${slotId}`).toBe(true);
      }
    }
  });

  it('keeps pass draft blockers in place before real review approval', () => {
    const ledger = readJson(evidenceLedgerPath);
    const isolation = readJson(isolationPath);
    const passPrepareIds = new Set(
      (isolation.pass_draft_prepare_templates as JsonRecord[]).map(template => template.prepare_template_id)
    );

    expect(ledger.counts.pass_draft_blocker_set_count).toBe(2);
    expect(ledger.pass_draft_blocker_sets).toHaveLength(2);

    for (const blockerSet of ledger.pass_draft_blocker_sets as JsonRecord[]) {
      expect(passPrepareIds.has(blockerSet.prepare_template_id), blockerSet.prepare_template_id).toBe(true);
      expect(blockerSet.writeback_allowed_now).toBe(false);
      expect(blockerSet.formal_patch_created).toBe(false);
      expect(blockerSet.blocking_gate_ids).toContain('real_human_review_approved');
      expect(blockerSet.blocking_gate_ids).toContain('domain_pack_decision_ledger_recorded');
      expect(blockerSet.blocking_gate_ids).toContain('formal_patch_explicitly_requested_by_human');
    }
  });

  it('tracks Iteration 15 gates while keeping formal files untouched', () => {
    const ledger = readJson(evidenceLedgerPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const machineGates = new Map((ledger.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((ledger.iteration_15_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(ledger.writeback_policy.formal_patch_created).toBe(false);
    expect(ledger.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(ledger.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(ledger.writeback_policy.province_markdown_written).toBe(false);
    expect(ledger.writeback_policy.blank_decision_ledger_is_approval).toBe(false);

    expect(machineGates.get('evidence-slot-sets-created')?.current_count).toBe(9);
    expect(machineGates.get('decision-ledger-no-approvals')?.current_count).toBe(0);
    expect(machineGates.get('repair-reject-tasks-mapped-to-evidence')?.current_count).toBe(14);
    expect(machineGates.get('pass-draft-blockers-created')?.current_count).toBe(2);
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('domain-pack-evidence-slots-created')?.status).toBe('met');
    expect(exitGates.get('blank-human-decision-ledger-created')?.status).toBe('met_as_blank_ledger');
    expect(exitGates.get('formal-domain-pack-still-untouched')?.status).toBe('met');
    expect(exitGates.get('province-markdown-still-untouched')?.status).toBe('met');
  });
});
