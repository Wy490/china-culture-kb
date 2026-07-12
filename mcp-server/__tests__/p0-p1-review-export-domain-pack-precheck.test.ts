import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const precheckPath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-review-export-and-domain-pack-precheck.json');
const simulationPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'p0-p1-review-simulation-and-writeback-constraints.json'
);
const candidatesPath = path.join(repoRoot, 'data', 'domain-packs', 'phase2-candidate-rule-packs.json');
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');
const qualityIndexPath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-review-export-quality-index.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('P0/P1 review export and domain pack precheck', () => {
  it('exports all 16 simulated review results without granting writeback', () => {
    const precheck = readJson(precheckPath);
    const simulation = readJson(simulationPath);
    const simulationByTemplateId = new Map(
      (simulation.simulated_review_results as JsonRecord[]).map(item => [item.writeback_template_id, item])
    );

    expect(precheck.schema_version).toBe('p0-p1-review-export-domain-pack-precheck/v1');
    expect(precheck.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(precheck.writeback_policy.province_markdown_written).toBe(false);
    expect(precheck.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(precheck.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(precheck.counts.review_result_export_count).toBe(16);
    expect(precheck.review_result_export_manifest).toHaveLength(16);

    for (const exported of precheck.review_result_export_manifest as JsonRecord[]) {
      const simulated = simulationByTemplateId.get(exported.writeback_template_id);

      expect(simulated, exported.writeback_template_id).toBeTruthy();
      expect(exported.card_id).toBe(simulated!.card_id);
      expect(exported.decision).toBe(simulated!.simulated_decision);
      expect(exported.writeback_allowed_now).toBe(false);
    }
  });

  it('splits pass, repair, and reject queues consistently with the simulation decisions', () => {
    const precheck = readJson(precheckPath);
    const simulation = readJson(simulationPath);
    const decisionByTemplateId = new Map(
      (simulation.simulated_review_results as JsonRecord[]).map(item => [item.writeback_template_id, item.simulated_decision])
    );

    expect(precheck.pass_candidate_queue).toHaveLength(precheck.counts.pass_candidate_count);
    expect(precheck.repair_task_queue).toHaveLength(precheck.counts.repair_task_count);
    expect(precheck.reject_task_queue).toHaveLength(precheck.counts.reject_task_count);

    for (const item of precheck.pass_candidate_queue as JsonRecord[]) {
      expect(decisionByTemplateId.get(item.writeback_template_id)).toBe('pass');
      expect(item.writeback_allowed_now).toBe(false);
      expect(item.required_before_draft).toContain('real_human_review_approved');
      expect(item.linked_domain_pack_candidate_ids.length).toBeGreaterThanOrEqual(2);
    }

    for (const item of precheck.repair_task_queue as JsonRecord[]) {
      expect(decisionByTemplateId.get(item.writeback_template_id)).toBe('repair');
      expect(item.repair_focus.length).toBeGreaterThanOrEqual(3);
      expect(item.linked_domain_pack_candidate_ids.length).toBeGreaterThanOrEqual(2);
    }

    for (const item of precheck.reject_task_queue as JsonRecord[]) {
      expect(decisionByTemplateId.get(item.writeback_template_id)).toBe('reject');
      expect(item.restart_required).toBe(true);
      expect(item.reject_reason).toBeTruthy();
    }
  });

  it('maps P0/P1 quality rules to all nine Phase 2 domain pack candidates', () => {
    const precheck = readJson(precheckPath);
    const candidates = readJson(candidatesPath);
    const quality = readJson(qualityIndexPath);
    const simulation = readJson(simulationPath);
    const candidateIds = new Set((candidates.candidates as JsonRecord[]).map(candidate => candidate.candidate_id));
    const p0RuleIds = (quality.p0_extended_quality_rules as JsonRecord[]).map(rule => rule.rule_id);
    const p1RuleIds = (simulation.p1_quality_rules as JsonRecord[]).map(rule => rule.rule_id);
    const ruleIds = new Set([...p0RuleIds, ...p1RuleIds]);
    const mappedCandidateIds = new Set(
      (precheck.domain_pack_quality_rule_mappings as JsonRecord[]).map(mapping => mapping.candidate_id)
    );

    expect(precheck.counts.domain_pack_rule_mapping_count).toBe(9);
    expect(mappedCandidateIds).toEqual(candidateIds);

    for (const mapping of precheck.domain_pack_quality_rule_mappings as JsonRecord[]) {
      expect(candidateIds.has(mapping.candidate_id), mapping.candidate_id).toBe(true);
      expect(mapping.related_writeback_template_ids.length).toBeGreaterThanOrEqual(1);
      expect(mapping.blocking_decisions.length).toBeGreaterThanOrEqual(1);

      for (const ruleId of mapping.mapped_quality_rule_ids as string[]) {
        expect(ruleIds.has(ruleId), `${mapping.candidate_id} missing rule ${ruleId}`).toBe(true);
      }
    }
  });

  it('blocks every candidate from promotion and keeps formal domain pack untouched', () => {
    const precheck = readJson(precheckPath);
    const candidates = readJson(candidatesPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const formalEntryNames = new Set((formalDomainPack.entries as JsonRecord[]).map(entry => entry.entry_name));
    const candidateById = new Map((candidates.candidates as JsonRecord[]).map(candidate => [candidate.candidate_id, candidate]));

    expect(precheck.counts.promotion_precheck_count).toBe(9);
    expect(precheck.counts.promotion_ready_count).toBe(0);
    expect(precheck.counts.promotion_blocked_count).toBe(9);
    expect(precheck.domain_pack_promotion_prechecks).toHaveLength(9);
    expect(precheck.promotion_required_checklist).toContain('real_domain_review_completed');
    expect(precheck.promotion_required_checklist).toContain('no_direct_write_to_china_culture_json');

    for (const item of precheck.domain_pack_promotion_prechecks as JsonRecord[]) {
      const candidate = candidateById.get(item.candidate_id);

      expect(candidate, item.candidate_id).toBeTruthy();
      expect(item.can_promote_now).toBe(false);
      expect(item.formal_domain_pack_written).toBe(false);
      expect(item.precheck_status).toContain('blocked');
      expect(item.blockers.length).toBeGreaterThanOrEqual(3);
      expect(formalEntryNames.has(candidate!.entry_name), candidate!.entry_name).toBe(false);
    }
  });

  it('tracks Iteration 13 gates for export, task queues, and promotion precheck', () => {
    const precheck = readJson(precheckPath);
    const machineGates = new Map((precheck.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((precheck.iteration_13_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(precheck.counts.machine_gate_count).toBe(7);
    expect(machineGates.get('review-result-export-manifest-complete')?.status).toBe('met');
    expect(machineGates.get('domain-pack-rule-mapping-covers-all-candidates')?.current_count).toBe(9);
    expect(machineGates.get('promotion-prechecks-block-all-unreviewed-candidates')?.current_count).toBe(9);
    expect(machineGates.get('no-direct-formal-domain-pack-write')?.status).toBe('met');
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('review-result-export-package-created')?.status).toBe('met');
    expect(exitGates.get('repair-and-reject-queues-created')?.current_count).toBe(14);
    expect(exitGates.get('domain-pack-promotion-precheck-created')?.status).toBe('met_as_blocking_precheck');
    expect(exitGates.get('formal-domain-pack-not-written')?.status).toBe('met');
    expect(exitGates.get('province-markdown-not-written')?.status).toBe('met');
  });
});
