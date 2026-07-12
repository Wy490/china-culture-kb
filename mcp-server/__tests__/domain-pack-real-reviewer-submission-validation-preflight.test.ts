import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const preflightPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-reviewer-submission-validation-fixtures-and-pre-signature-preflight.json'
);
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
  'domain-pack-real-reviewer-submission-validation-pre-signature-preflight-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function ids(items: JsonRecord[], key: string): Set<string> {
  return new Set(items.map(item => item[key] as string));
}

describe('Domain Pack real reviewer submission validation and pre-signature preflight', () => {
  it('creates simulation-only fixtures without claiming real review or formal writeback', () => {
    const preflight = readJson(preflightPath);
    const formalDomainPack = readJson(formalDomainPackPath);

    expect(preflight.schema_version).toBe(
      'domain-pack-real-reviewer-submission-validation-pre-signature-preflight/v1'
    );
    expect(preflight.status).toBe('submission_validation_fixtures_created_pre_signature_preflight_blocked');
    expect(preflight.counts.simulation_fixture_count).toBe(14);
    expect(preflight.counts.pre_signature_ready_count).toBe(0);
    expect(preflight.counts.real_reviewer_submission_count).toBe(0);
    expect(preflight.counts.real_signature_count).toBe(0);
    expect(preflight.counts.formal_patch_count).toBe(0);
    expect(Array.isArray(formalDomainPack.entries)).toBe(true);

    expect(preflight.writeback_policy.simulation_fixtures_are_real_submissions).toBe(false);
    expect(preflight.writeback_policy.structurally_valid_fixture_is_signed).toBe(false);
    expect(preflight.writeback_policy.pre_signature_preflight_is_approval).toBe(false);
    expect(preflight.writeback_policy.attachment_references_verified).toBe(false);
    expect(preflight.writeback_policy.signature_references_verified).toBe(false);
    expect(preflight.writeback_policy.formal_patch_request_recorded).toBe(false);
    expect(preflight.writeback_policy.formal_patch_created).toBe(false);
    expect(preflight.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(preflight.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(preflight.writeback_policy.province_markdown_written).toBe(false);
  });

  it('inherits all sixteen fields and eleven validation rules from the frozen intake contract', () => {
    const preflight = readJson(preflightPath);
    const intake = readJson(intakePath);

    expect(preflight.counts.source_intake_field_count).toBe(intake.reviewer_intake_field_schema.length);
    expect(preflight.counts.source_validation_rule_count).toBe(intake.intake_validation_rules.length);
    expect(preflight.counts.source_intake_field_count).toBe(16);
    expect(preflight.counts.source_validation_rule_count).toBe(11);
  });

  it('provides complete and intentionally incomplete simulated attachment reference sets', () => {
    const preflight = readJson(preflightPath);
    const handoff = readJson(handoffPath);
    const referenceSets = preflight.simulated_attachment_reference_sets as JsonRecord[];
    const setById = new Map(referenceSets.map(item => [item.reference_set_id, item]));
    const handoffPackages = handoff.human_handoff_packages as JsonRecord[];
    const craftSlots = new Set(
      handoffPackages.find(item => item.handoff_package_id === 'human-handoff-package-001')?.required_attachment_slot_ids
    );
    const repairSlots = new Set(
      handoffPackages.find(item => item.handoff_package_id === 'human-handoff-package-002')?.required_attachment_slot_ids
    );
    const completeCraft = setById.get('simulation-attachment-set-complete-craft-001') as JsonRecord;
    const completeRepair = setById.get('simulation-attachment-set-complete-repair-001') as JsonRecord;
    const incompleteCraft = setById.get('simulation-attachment-set-incomplete-craft-001') as JsonRecord;

    expect(referenceSets).toHaveLength(3);
    expect(ids(completeCraft.attachment_record_references, 'slot_id')).toEqual(craftSlots);
    expect(ids(completeRepair.attachment_record_references, 'slot_id')).toEqual(repairSlots);
    expect(incompleteCraft.attachment_record_references).toHaveLength(5);
    expect(ids(incompleteCraft.attachment_record_references, 'slot_id').has('final_decision_record_attachment')).toBe(
      false
    );

    for (const set of referenceSets) {
      expect(set.simulation_only).toBe(true);
      expect(set.attachment_references_verified).toBe(false);
    }
  });

  it('keeps three structurally valid fixtures blocked as simulations', () => {
    const preflight = readJson(preflightPath);
    const intake = readJson(intakePath);
    const fixtures = preflight.structurally_valid_simulation_fixtures as JsonRecord[];
    const sourceTemplates = new Map(
      (intake.blank_reviewer_intake_templates as JsonRecord[]).map(item => [item.reviewer_intake_id, item])
    );
    const referenceSets = new Map(
      (preflight.simulated_attachment_reference_sets as JsonRecord[]).map(item => [item.reference_set_id, item])
    );

    expect(fixtures).toHaveLength(3);

    for (const fixture of fixtures) {
      const sourceTemplate = sourceTemplates.get(fixture.source_template_id) as JsonRecord;
      const referenceSet = referenceSets.get(fixture.input.attachment_reference_set_id) as JsonRecord;

      expect(sourceTemplate).toBeDefined();
      expect(fixture.input.reviewer_role).toBe(sourceTemplate.reviewer_role);
      expect(fixture.input.assignment_or_followup_id).toBe(sourceTemplate.assignment_or_followup_id);
      expect(sourceTemplate.allowed_review_decisions).toContain(fixture.input.review_decision);
      expect(referenceSet.attachment_record_references).toHaveLength(6);
      expect(fixture.input.signed_at).toMatch(/[+-]\d{2}:\d{2}$/);
      expect(fixture.input.signature_record_reference).toMatch(/^SIMULATION-SIGNATURE-REF-/);
      expect(fixture.format_validation_status).toBe('valid_as_simulation_fixture_only');
      expect(fixture.failed_rule_ids).toEqual([]);
      expect(fixture.external_identity_verification_status).toBe('not_run_simulation_only');
      expect(fixture.external_attachment_verification_status).toBe('not_run_simulation_only');
      expect(fixture.external_signature_verification_status).toBe('not_run_simulation_only');
      expect(fixture.simulation_only).toBe(true);
      expect(fixture.is_real_reviewer_submission).toBe(false);
      expect(fixture.is_signed).toBe(false);
      expect(fixture.pre_signature_ready).toBe(false);
      expect(fixture.formal_patch_created).toBe(false);
      expect(fixture.formal_domain_pack_written).toBe(false);
      expect(fixture.province_markdown_written).toBe(false);
    }
  });

  it('covers every source validation rule with one focused invalid fixture', () => {
    const preflight = readJson(preflightPath);
    const intake = readJson(intakePath);
    const invalidFixtures = preflight.invalid_simulation_fixtures as JsonRecord[];
    const validFixtureIds = ids(preflight.structurally_valid_simulation_fixtures as JsonRecord[], 'fixture_id');
    const sourceRuleIds = ids(intake.intake_validation_rules as JsonRecord[], 'rule_id');
    const coveredRuleIds = new Set(
      invalidFixtures.flatMap(fixture => fixture.expected_failed_rule_ids as string[])
    );

    expect(invalidFixtures).toHaveLength(11);
    expect(coveredRuleIds).toEqual(sourceRuleIds);

    for (const fixture of invalidFixtures) {
      expect(validFixtureIds.has(fixture.derived_from_fixture_id)).toBe(true);
      expect(fixture.expected_failed_rule_ids).toHaveLength(1);
      expect(fixture.validation_status).toBe('invalid_expected_rule_failure');
      expect(fixture.simulation_only).toBe(true);
      expect(fixture.is_real_reviewer_submission).toBe(false);
      expect(fixture.is_signed).toBe(false);
      expect(fixture.pre_signature_ready).toBe(false);
    }
  });

  it('produces fourteen blocked pre-signature results and five failure groups', () => {
    const preflight = readJson(preflightPath);
    const checks = preflight.pre_signature_check_matrix as JsonRecord[];
    const results = preflight.pre_signature_fixture_results as JsonRecord[];
    const validFixtures = preflight.structurally_valid_simulation_fixtures as JsonRecord[];
    const invalidFixtures = preflight.invalid_simulation_fixtures as JsonRecord[];
    const allFixtureIds = new Set([
      ...validFixtures.map(item => item.fixture_id as string),
      ...invalidFixtures.map(item => item.fixture_id as string)
    ]);
    const validResultIds = ids(validFixtures, 'fixture_id');

    expect(checks).toHaveLength(12);
    expect(ids(checks, 'check_id').size).toBe(12);
    expect(results).toHaveLength(14);
    expect(ids(results, 'fixture_id')).toEqual(allFixtureIds);
    expect(results.filter(item => item.pre_signature_ready)).toHaveLength(0);
    expect(preflight.failure_reason_summary).toHaveLength(5);

    for (const result of results) {
      expect(result.pre_signature_ready).toBe(false);
      if (validResultIds.has(result.fixture_id)) {
        expect(result.blocking_check_ids).toEqual([
          'real-reviewer-identity-externally-verified',
          'attachment-records-externally-resolved',
          'signature-record-externally-resolved',
          'simulation-fixture-excluded-from-real-submission'
        ]);
      } else {
        expect(result.blocking_rule_ids).toHaveLength(1);
      }
    }
  });

  it('documents the fixture matrix and tracks Iteration 24 gates', () => {
    const preflight = readJson(preflightPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const machineGates = new Map((preflight.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((preflight.iteration_24_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(preflight.pre_signature_markdown_file).toBe(
      'docs/production-cards/domain-pack-real-reviewer-submission-validation-pre-signature-preflight-20260710.md'
    );
    expect(markdown).toContain('状态：submission_validation_fixtures_created_pre_signature_preflight_blocked');
    expect(markdown).toContain('simulation_fixtures_are_real_submissions: false');
    expect(markdown).toContain('structurally_valid_fixture_is_signed: false');
    expect(markdown).toContain('pre_signature_preflight_is_approval: false');
    expect(markdown).toContain('attachment_references_verified: false');
    expect(markdown).toContain('signature_references_verified: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 格式合法模拟夹具');
    expect(markdown).toContain('## 非法模拟夹具');
    expect(markdown).toContain('## 签署前预检矩阵');
    expect(markdown).toContain('## 失败原因汇总');

    for (const fixture of preflight.structurally_valid_simulation_fixtures as JsonRecord[]) {
      expect(markdown).toContain(fixture.fixture_id);
    }
    for (const fixture of preflight.invalid_simulation_fixtures as JsonRecord[]) {
      expect(markdown).toContain(fixture.fixture_id);
    }

    expect(preflight.counts.machine_gate_count).toBe(10);
    expect(machineGates.get('submission-validation-fixtures-created')?.current_count).toBe(14);
    expect(machineGates.get('all-intake-validation-rules-covered')?.current_count).toBe(11);
    expect(machineGates.get('pre-signature-ready-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('legal-illegal-validation-fixtures-created')?.current_count).toBe(14);
    expect(exitGates.get('all-eleven-validation-rules-covered')?.current_count).toBe(11);
    expect(exitGates.get('pre-signature-preflight-created')?.current_count).toBe(12);
    expect(exitGates.get('failure-reason-summary-created')?.current_count).toBe(5);
    expect(exitGates.get('no-real-review-or-signature-claimed')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
