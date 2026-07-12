import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const simulationPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'p0-p1-review-simulation-and-writeback-constraints.json'
);
const qualityIndexPath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-review-export-quality-index.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function decideByRule(sampleText: string, rule: JsonRecord): string {
  const rejected = (rule.reject_patterns as string[]).some(pattern => sampleText.includes(pattern));
  if (rejected) return 'reject';

  const allowed = (rule.allow_requires_any as string[]).some(pattern => sampleText.includes(pattern));
  return allowed ? 'allow_for_human_review' : 'needs_manual_review';
}

describe('P0/P1 review simulation and writeback constraints', () => {
  it('creates simulation results for all 16 quality-index checklists without granting writeback', () => {
    const simulation = readJson(simulationPath);
    const quality = readJson(qualityIndexPath);
    const qualityTemplateIds = new Set(
      (quality.markdown_review_checklists as JsonRecord[]).map(item => item.writeback_template_id)
    );
    const resultTemplateIds = new Set(
      (simulation.simulated_review_results as JsonRecord[]).map(item => item.writeback_template_id)
    );
    const decisions = new Set(
      (simulation.simulated_review_results as JsonRecord[]).map(item => item.simulated_decision)
    );

    expect(simulation.schema_version).toBe('p0-p1-review-simulation-writeback-constraints/v1');
    expect(simulation.simulation_policy.decision_source).toBe('policy_simulation_only');
    expect(simulation.simulation_policy.does_not_replace_human_review).toBe(true);
    expect(simulation.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(simulation.writeback_policy.province_markdown_written).toBe(false);
    expect(simulation.writeback_policy.pass_result_is_not_human_approval).toBe(true);
    expect(simulation.counts.simulated_review_result_count).toBe(16);
    expect(resultTemplateIds).toEqual(qualityTemplateIds);
    expect(decisions).toEqual(new Set(['pass', 'repair', 'reject']));

    for (const result of simulation.simulated_review_results as JsonRecord[]) {
      expect(result.writeback_allowed_now).toBe(false);
      expect(result.province_markdown_written).toBe(false);
      expect(result.required_next_actions.length).toBeGreaterThanOrEqual(3);
      expect(qualityTemplateIds.has(result.writeback_template_id), result.writeback_template_id).toBe(true);
    }
  });

  it('enforces different writeback constraints for pass, repair, and reject decisions', () => {
    const simulation = readJson(simulationPath);
    const constraints = new Map(
      (simulation.writeback_constraint_sets as JsonRecord[]).map(item => [item.constraint_set_id, item])
    );
    const resultsByDecision = new Map<string, JsonRecord[]>();

    for (const result of simulation.simulated_review_results as JsonRecord[]) {
      const list = resultsByDecision.get(result.simulated_decision) ?? [];
      list.push(result);
      resultsByDecision.set(result.simulated_decision, list);
    }

    expect(simulation.counts.writeback_constraint_set_count).toBe(3);
    expect(constraints.get('constraint-pass-candidate')?.writeback_allowed_now).toBe(false);
    expect(constraints.get('constraint-pass-candidate')?.allowed_field_groups_after_real_approval).toContain(
      'production_material_summary'
    );
    expect(constraints.get('constraint-pass-candidate')?.prohibited_field_groups).toContain('generated_full_text');
    expect(constraints.get('constraint-pass-candidate')?.prohibited_field_groups).toContain('seedance_prompt');
    expect(constraints.get('constraint-repair-required')?.allowed_field_groups_after_real_approval).toHaveLength(0);
    expect(constraints.get('constraint-reject-blocked')?.allowed_field_groups_after_real_approval).toHaveLength(0);
    expect(constraints.get('constraint-reject-blocked')?.prohibited_field_groups).toContain('all_current_candidate_fields');

    expect(resultsByDecision.get('pass')).toHaveLength(simulation.counts.pass_count);
    expect(resultsByDecision.get('repair')).toHaveLength(simulation.counts.repair_count);
    expect(resultsByDecision.get('reject')).toHaveLength(simulation.counts.reject_count);

    for (const result of simulation.simulated_review_results as JsonRecord[]) {
      const constraint = constraints.get(result.constraint_set_id);
      expect(constraint, result.constraint_set_id).toBeTruthy();
      expect(constraint!.applies_to_decision).toBe(result.simulated_decision);
      expect(constraint!.writeback_allowed_now).toBe(false);
    }
  });

  it('keeps batch simulation counts and machine gates consistent', () => {
    const simulation = readJson(simulationPath);
    const resultsByBatch = new Map<string, JsonRecord[]>();
    const gates = new Map((simulation.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    for (const result of simulation.simulated_review_results as JsonRecord[]) {
      const list = resultsByBatch.get(result.batch_id) ?? [];
      list.push(result);
      resultsByBatch.set(result.batch_id, list);
    }

    expect(simulation.counts.batch_simulation_count).toBe(4);
    expect(simulation.batch_simulations).toHaveLength(4);
    expect(gates.get('decisions-complete')?.status).toBe('met_as_simulation');
    expect(gates.get('decision-taxonomy-covered')?.required_decisions).toEqual(['pass', 'repair', 'reject']);
    expect(gates.get('no-direct-province-writeback')?.status).toBe('met');

    for (const batch of simulation.batch_simulations as JsonRecord[]) {
      const results = resultsByBatch.get(batch.batch_id) ?? [];
      const decisionCounts = {
        pass: results.filter(result => result.simulated_decision === 'pass').length,
        repair: results.filter(result => result.simulated_decision === 'repair').length,
        reject: results.filter(result => result.simulated_decision === 'reject').length,
      };

      expect(batch.status).toBe('simulation_complete_pending_real_human_review');
      expect(batch.writeback_template_ids).toHaveLength(results.length);
      expect(batch.decision_counts).toEqual(decisionCounts);
      expect(batch.machine_gate_ids).toContain('decisions-complete');
      expect(batch.machine_gate_ids).toContain('no-direct-province-writeback');
    }
  });

  it('adds P1 quality rules and sample expectations for history, community, rights, and archives', () => {
    const simulation = readJson(simulationPath);
    const ruleById = new Map((simulation.p1_quality_rules as JsonRecord[]).map(rule => [rule.rule_id, rule]));
    const allRejectPatterns = (simulation.p1_quality_rules as JsonRecord[]).flatMap(
      rule => rule.reject_patterns as string[]
    );

    expect(simulation.counts.p1_quality_rule_count).toBe(4);
    expect(simulation.counts.p1_quality_sample_expectation_count).toBe(8);
    expect(simulation.p1_quality_rules).toHaveLength(4);
    expect(allRejectPatterns).toContain('唯一化第一枪断言');
    expect(allRejectPatterns).toContain('未授权仪式空间');
    expect(allRejectPatterns).toContain('曲谱全文');
    expect(allRejectPatterns).toContain('展陈复制件未授权');

    for (const rule of simulation.p1_quality_rules as JsonRecord[]) {
      expect(rule.reject_patterns.length).toBeGreaterThanOrEqual(6);
      expect(rule.allow_requires_any.length).toBeGreaterThanOrEqual(5);
      expect(rule.repair_suggestions.length).toBeGreaterThanOrEqual(3);
    }

    for (const expectation of simulation.p1_quality_sample_expectations as JsonRecord[]) {
      const rule = ruleById.get(expectation.rule_id);

      expect(rule, expectation.rule_id).toBeTruthy();
      expect(decideByRule(expectation.sample_text, rule!)).toBe(expectation.expected_decision);
    }
  });

  it('tracks Iteration 12 exit gates without touching the province markdown layer', () => {
    const simulation = readJson(simulationPath);
    const gates = new Map((simulation.iteration_12_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(gates.get('review-simulation-created')?.status).toBe('met_as_simulation_only');
    expect(gates.get('writeback-constraints-created')?.status).toBe('met');
    expect(gates.get('p1-quality-rules-created')?.status).toBe('met');
    expect(gates.get('batch-pass-repair-reject-gates-created')?.status).toBe('met_as_machine_gates');
    expect(gates.get('no-direct-province-writeback')?.status).toBe('met');
    expect(simulation.writeback_policy.province_markdown_written).toBe(false);
    expect(simulation.writeback_policy.simulation_is_formal_writeback).toBe(false);
  });
});
