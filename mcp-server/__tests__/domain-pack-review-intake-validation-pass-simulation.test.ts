import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const validationPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-review-intake-validation-and-pass-simulation.json'
);
const dashboardPath = path.join(repoRoot, 'data', 'production-cards', 'domain-pack-review-dashboard-and-intake.json');
const evidenceLedgerPath = path.join(repoRoot, 'data', 'production-cards', 'domain-pack-review-evidence-ledger.json');
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-review-intake-validation-and-pass-simulation-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function toSet(values: string[]): Set<string> {
  return new Set(values);
}

describe('Domain Pack review intake validation and pass simulation', () => {
  it('defines validation rules that cover the dashboard required fields plus blocking gates', () => {
    const validation = readJson(validationPath);
    const dashboard = readJson(dashboardPath);
    const sourceFieldIds = toSet((validation.validation_rules as JsonRecord[]).map(rule => rule.source_field_id));
    const dashboardFieldIds = toSet((dashboard.required_field_rules as JsonRecord[]).map(rule => rule.field_id));

    expect(validation.schema_version).toBe('domain-pack-review-intake-validation-pass-simulation/v1');
    expect(validation.status).toBe('validation_simulation_created_no_formal_patch');
    expect(validation.counts.validation_rule_count).toBe(12);

    for (const fieldId of dashboardFieldIds) {
      expect(sourceFieldIds.has(fieldId), fieldId).toBe(true);
    }

    expect(sourceFieldIds.has('reviewer_identity_and_role_attachment')).toBe(true);
    expect(sourceFieldIds.has('formal_patch_created')).toBe(true);
  });

  it('keeps all actual blank ledger entries blocked and out of patch candidate queues', () => {
    const validation = readJson(validationPath);
    const dashboard = readJson(dashboardPath);
    const ledger = readJson(evidenceLedgerPath);
    const dashboardCandidateIds = toSet((dashboard.ledger_fill_statuses as JsonRecord[]).map(entry => entry.candidate_id));
    const ledgerCandidateIds = toSet((ledger.human_review_decision_ledger as JsonRecord[]).map(entry => entry.candidate_id));
    const actualCandidateIds = toSet(
      (validation.actual_candidate_validation_results as JsonRecord[]).map(entry => entry.candidate_id)
    );

    expect(validation.counts.actual_candidate_validation_count).toBe(9);
    expect(validation.counts.actual_candidate_pass_count).toBe(0);
    expect(actualCandidateIds).toEqual(dashboardCandidateIds);
    expect(actualCandidateIds).toEqual(ledgerCandidateIds);

    for (const result of validation.actual_candidate_validation_results as JsonRecord[]) {
      expect(result.actual_intake_status).toBe('not_started');
      expect(result.validation_status).toBe('blocked_blank_intake');
      expect(result.failed_rule_ids).toContain('reviewer-name-required');
      expect(result.failed_rule_ids).toContain('real-reviewer-signature-required');
      expect(result.can_enter_manual_patch_candidate_queue).toBe(false);
      expect(result.can_promote_now).toBe(false);
      expect(result.formal_patch_created).toBe(false);
    }
  });

  it('includes valid and invalid simulation samples with explicit failure reasons', () => {
    const validation = readJson(validationPath);
    const samples = validation.simulated_intake_samples as JsonRecord[];
    const validSamples = samples.filter(sample => sample.validation_status.startsWith('valid_'));
    const invalidSamples = samples.filter(sample => sample.validation_status.startsWith('invalid_'));
    const sampleById = new Map(samples.map(sample => [sample.sample_id, sample]));

    expect(validation.counts.simulated_intake_sample_count).toBe(5);
    expect(validation.counts.simulated_valid_sample_count).toBe(2);
    expect(validation.counts.simulated_invalid_sample_count).toBe(3);
    expect(validSamples).toHaveLength(2);
    expect(invalidSamples).toHaveLength(3);

    expect(sampleById.get('sim-valid-approve-craft-001')?.can_enter_manual_patch_candidate_queue).toBe(true);
    expect(sampleById.get('sim-valid-approve-craft-001')?.formal_patch_created).toBe(false);
    expect(sampleById.get('sim-valid-repair-medical-001')?.can_enter_manual_patch_candidate_queue).toBe(false);
    expect(sampleById.get('sim-invalid-missing-evidence-sensitive-001')?.failed_rule_ids).toContain(
      'source-bibliography-required'
    );
    expect(sampleById.get('sim-invalid-bad-decision-performance-001')?.failed_rule_ids).toContain(
      'decision-must-be-allowed'
    );
    expect(sampleById.get('sim-invalid-patch-before-sign-ai-comic-001')?.failed_rule_ids).toContain(
      'real-reviewer-signature-required'
    );

    for (const sample of samples) {
      expect(sample.simulation_only).toBe(true);
      expect(sample.can_promote_now).toBe(false);
      expect(sample.direct_write_to_china_culture_json).toBe(false);
      expect(sample.province_markdown_written).toBe(false);
    }
  });

  it('creates only simulated patch and repair queues without formal writeback', () => {
    const validation = readJson(validationPath);
    const patchQueue = validation.manual_patch_candidate_simulation_queue as JsonRecord[];
    const repairQueue = validation.repair_resubmission_simulation_queue as JsonRecord[];

    expect(validation.counts.manual_patch_candidate_simulation_count).toBe(1);
    expect(validation.counts.repair_resubmission_simulation_count).toBe(1);
    expect(patchQueue).toHaveLength(1);
    expect(repairQueue).toHaveLength(1);

    expect(patchQueue[0].queue_status).toBe('simulation_candidate_only_not_formal_patch');
    expect(patchQueue[0].required_before_formal_patch).toContain('real_human_review_approved_in_actual_ledger');
    expect(patchQueue[0].required_before_formal_patch).toContain('formal_patch_explicitly_requested_by_human');
    expect(patchQueue[0].formal_patch_created).toBe(false);
    expect(patchQueue[0].formal_domain_pack_written).toBe(false);
    expect(patchQueue[0].province_markdown_written).toBe(false);

    expect(repairQueue[0].queue_status).toBe('simulation_repair_resubmission_only');
    expect(repairQueue[0].required_before_resubmission).toContain('medical_privacy_boundary_rechecked');
    expect(repairQueue[0].formal_patch_created).toBe(false);
  });

  it('documents the simulation in Markdown without implying approval', () => {
    const validation = readJson(validationPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');

    expect(validation.simulation_markdown_file).toBe(
      'docs/production-cards/domain-pack-review-intake-validation-and-pass-simulation-20260710.md'
    );
    expect(markdown).toContain('状态：validation_simulation_created_no_formal_patch');
    expect(markdown).toContain('simulated_results_are_real_review: false');
    expect(markdown).toContain('manual_patch_candidate_queue_is_formal_patch: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('## 模拟填报样例');
    expect(markdown).toContain('## 人工 Patch 候选模拟队列');

    for (const sample of validation.simulated_intake_samples as JsonRecord[]) {
      expect(markdown).toContain(sample.sample_id);
      expect(markdown).toContain(sample.candidate_id);
    }
  });

  it('tracks Iteration 17 gates and keeps formal knowledge files untouched', () => {
    const validation = readJson(validationPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const machineGates = new Map((validation.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((validation.iteration_17_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(validation.writeback_policy.formal_patch_created).toBe(false);
    expect(validation.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(validation.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(validation.writeback_policy.province_markdown_written).toBe(false);
    expect(validation.writeback_policy.simulated_results_are_real_review).toBe(false);
    expect(validation.writeback_policy.manual_patch_candidate_queue_is_formal_patch).toBe(false);
    expect(validation.counts.formal_patch_count).toBe(0);

    expect(machineGates.get('validation-rules-created')?.current_count).toBe(12);
    expect(machineGates.get('actual-blank-intake-results-created')?.status).toBe('met_as_blocked');
    expect(machineGates.get('actual-blank-intake-has-zero-passes')?.current_count).toBe(0);
    expect(machineGates.get('simulated-manual-patch-candidate-created')?.status).toBe('met_as_simulation_only');
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-or-domain-pack-writeback')?.status).toBe('met');

    expect(exitGates.get('intake-validation-result-structure-created')?.status).toBe('met');
    expect(exitGates.get('manual-patch-candidate-queue-created-as-simulation')?.status).toBe('met_as_simulation_only');
    expect(exitGates.get('actual-ledger-still-has-zero-approvals')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
