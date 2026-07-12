import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const exportPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-manual-patch-export-and-diff-draft.json'
);
const validationPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-review-intake-validation-and-pass-simulation.json'
);
const candidatesPath = path.join(repoRoot, 'data', 'domain-packs', 'phase2-candidate-rule-packs.json');
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');
const diffDraftPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-manual-patch-diff-draft-dp-craft-material-tool-process-20260710.md'
);
const repairTaskPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-repair-resubmission-task-dp-medical-heritage-privacy-boundary-20260710.md'
);

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('Domain Pack manual patch export and diff draft', () => {
  it('exports the simulated patch candidate without creating a formal patch', () => {
    const exported = readJson(exportPath);
    const validation = readJson(validationPath);
    const sourceQueueIds = new Set(
      (validation.manual_patch_candidate_simulation_queue as JsonRecord[]).map(item => item.queue_id)
    );

    expect(exported.schema_version).toBe('domain-pack-manual-patch-export-diff-draft/v1');
    expect(exported.status).toBe('manual_patch_export_created_diff_draft_not_applied');
    expect(exported.counts.manual_patch_export_package_count).toBe(1);
    expect(exported.counts.formal_patch_count).toBe(0);
    expect(exported.writeback_policy.manual_patch_export_is_formal_patch).toBe(false);
    expect(exported.writeback_policy.diff_draft_applied).toBe(false);
    expect(exported.writeback_policy.formal_patch_created).toBe(false);
    expect(exported.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(exported.writeback_policy.province_markdown_written).toBe(false);

    const exportPackage = exported.manual_patch_export_packages[0] as JsonRecord;
    expect(sourceQueueIds.has(exportPackage.source_queue_id)).toBe(true);
    expect(exportPackage.candidate_id).toBe('dp-craft-material-tool-process');
    expect(exportPackage.export_status).toBe('diff_draft_created_not_applied');
    expect(exportPackage.duplicate_risk).toBe('high_if_appended_as_new_formal_entry');
    expect(exportPackage.formal_patch_created).toBe(false);
  });

  it('creates a diff draft from the candidate while warning about formal pack merge risk', () => {
    const exported = readJson(exportPath);
    const candidates = readJson(candidatesPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const candidate = (candidates.candidates as JsonRecord[]).find(
      item => item.candidate_id === 'dp-craft-material-tool-process'
    );
    const formalEntryNames = new Set((formalDomainPack.entries as JsonRecord[]).map(entry => entry.entry_name));
    const draft = exported.diff_draft_templates[0] as JsonRecord;
    const markdown = fs.readFileSync(diffDraftPath, 'utf-8');

    expect(candidate).toBeTruthy();
    expect(draft.candidate_id).toBe(candidate!.candidate_id);
    expect(draft.draft_status).toBe('template_only_not_applied');
    expect(draft.target_file).toBe('data/domain-packs/china-culture.json');
    expect(formalEntryNames.has(draft.target_entry_name)).toBe(true);
    expect(draft.diff_draft_applied).toBe(false);
    expect(draft.formal_patch_created).toBe(false);

    expect(markdown).toContain('状态：diff_draft_template_only_not_applied');
    expect(markdown).toContain('candidate_id: dp-craft-material-tool-process');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('diff_draft_applied: false');
    expect(markdown).toContain(candidate!.summary);
    expect(markdown).toContain('不得直接追加重复正式条目');
  });

  it('creates blank signature placeholders and blocking preflight checks', () => {
    const exported = readJson(exportPath);
    const signatureRoles = new Set((exported.signature_placeholders as JsonRecord[]).map(item => item.role));
    const preflightIds = new Set((exported.preflight_checks_before_formal_patch as JsonRecord[]).map(item => item.check_id));

    expect(exported.counts.signature_placeholder_count).toBe(4);
    expect(signatureRoles.has('工艺流程审稿')).toBe(true);
    expect(signatureRoles.has('人工 Patch 复核')).toBe(true);

    for (const signature of exported.signature_placeholders as JsonRecord[]) {
      expect(signature.status).toBe('blank');
    }

    expect(exported.counts.preflight_check_count).toBe(8);
    expect(preflightIds.has('real-human-review-approved-in-actual-ledger')).toBe(true);
    expect(preflightIds.has('kb-production-audit-required-after-patch')).toBe(true);
    expect(preflightIds.has('kb-lint-required-after-patch')).toBe(true);
    expect(preflightIds.has('province-markdown-writeback-still-forbidden')).toBe(true);

    for (const check of exported.preflight_checks_before_formal_patch as JsonRecord[]) {
      expect(check.blocking).toBe(true);
      if (check.check_id !== 'province-markdown-writeback-still-forbidden') {
        expect(check.status === 'not_met' || check.status === 'not_run').toBe(true);
      }
    }
  });

  it('turns the repair resubmission simulation into a trackable evidence task template only', () => {
    const exported = readJson(exportPath);
    const validation = readJson(validationPath);
    const repairQueueIds = new Set(
      (validation.repair_resubmission_simulation_queue as JsonRecord[]).map(item => item.queue_id)
    );
    const task = exported.repair_resubmission_task_templates[0] as JsonRecord;
    const markdown = fs.readFileSync(repairTaskPath, 'utf-8');

    expect(exported.counts.repair_resubmission_task_template_count).toBe(1);
    expect(repairQueueIds.has(task.source_queue_id)).toBe(true);
    expect(task.candidate_id).toBe('dp-medical-heritage-privacy-boundary');
    expect(task.task_status).toBe('evidence_task_template_created_not_resubmitted');
    expect(task.required_evidence_updates).toContain('medical_privacy_boundary_rechecked');
    expect(task.required_evidence_updates).toContain('real_reviewer_identity_attached');
    expect(task.repair_resubmitted).toBe(false);
    expect(task.formal_patch_created).toBe(false);

    expect(markdown).toContain('状态：evidence_task_template_created_not_resubmitted');
    expect(markdown).toContain('candidate_id: dp-medical-heritage-privacy-boundary');
    expect(markdown).toContain('repair_resubmitted: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('medical_privacy_boundary_rechecked');
  });

  it('tracks Iteration 18 gates while keeping formal files untouched', () => {
    const exported = readJson(exportPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const machineGates = new Map((exported.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((exported.iteration_18_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(machineGates.get('manual-patch-export-package-created')?.status).toBe('met_as_draft_export');
    expect(machineGates.get('diff-draft-template-created')?.status).toBe('met_as_template_only');
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('formal-domain-pack-not-written')?.current_count).toBe(0);
    expect(machineGates.get('diff-draft-not-applied')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('patch-candidate-export-created')?.status).toBe('met_as_draft_export');
    expect(exitGates.get('human-review-diff-draft-created')?.status).toBe('met_as_template_only');
    expect(exitGates.get('repair-resubmission-evidence-task-created')?.status).toBe('met_as_template_only');
    expect(exitGates.get('formal-patch-still-zero')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
