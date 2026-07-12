import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateRealSubmissionImportEnvelope,
  type RealSubmissionImportContract,
  type RealSubmissionImportEnvelope
} from '../src/lib/real-submission-import-validator.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const contractPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-submission-import-contract-and-external-record-resolution.json'
);
const fixturesPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-submission-import-validator-rejection-fixtures.json'
);
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-real-submission-import-validator-rejection-report-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function asSet(values: string[]): Set<string> {
  return new Set(values);
}

describe('Domain Pack real submission import validator', () => {
  const contract = readJson(contractPath) as unknown as RealSubmissionImportContract;
  const fixtures = readJson(fixturesPath);
  const baseEnvelope = fixtures.base_format_valid_envelope as RealSubmissionImportEnvelope;

  it('distinguishes local format pass from unresolved external records', () => {
    const scenarios = (fixtures.validation_scenarios as JsonRecord[]).filter(
      scenario => scenario.scenario_kind === 'local_format_pass_fixture'
    );

    expect(scenarios).toHaveLength(2);

    for (const scenario of scenarios) {
      const envelope = { ...baseEnvelope, ...scenario.input_overrides };
      const report = validateRealSubmissionImportEnvelope(envelope, contract);

      expect(report.status).toBe('format_valid_external_resolution_required');
      expect(report.validation_scope).toBe('local_deterministic_only');
      expect(report.local_format_valid).toBe(true);
      expect(report.eligible_for_external_resolution).toBe(true);
      expect(report.external_resolution_required).toBe(true);
      expect(report.matched_import_route_id).toBe('real-import-route-001');
      expect(report.field_errors).toEqual([]);
      expect(report.failed_validation_rule_ids).toEqual([]);
      expect(report.rejection_reason_ids).toEqual([]);
      expect(report.unresolved_external_check_ids).toHaveLength(scenario.expected_unresolved_external_check_count);
      expect(report.real_submission_imported).toBe(false);
      expect(report.is_signed).toBe(false);
      expect(report.formal_patch_created).toBe(false);
      expect(report.formal_domain_pack_written).toBe(false);
      expect(report.province_markdown_written).toBe(false);
    }
  });

  it('generates the expected rejection report for all four simulation boundaries', () => {
    const scenarios = (fixtures.validation_scenarios as JsonRecord[]).filter(
      scenario => scenario.scenario_kind === 'local_rejection_fixture'
    );

    expect(scenarios).toHaveLength(4);

    for (const scenario of scenarios) {
      const envelope = { ...baseEnvelope, ...scenario.input_overrides };
      const report = validateRealSubmissionImportEnvelope(envelope, contract);

      expect(report.status).toBe(scenario.expected_status);
      expect(report.local_format_valid).toBe(false);
      expect(report.eligible_for_external_resolution).toBe(false);
      expect(report.external_resolution_required).toBe(false);
      expect(report.unresolved_external_check_ids).toEqual([]);
      expect(asSet(report.rejection_reason_ids)).toEqual(asSet(scenario.expected_rejection_reason_ids));
      expect(asSet(report.failed_validation_rule_ids)).toEqual(asSet(scenario.expected_failed_validation_rule_ids));
      expect(report.real_submission_imported).toBe(false);
      expect(report.is_signed).toBe(false);
      expect(report.formal_patch_created).toBe(false);
      expect(report.formal_domain_pack_written).toBe(false);
      expect(report.province_markdown_written).toBe(false);
    }
  });

  it('rejects an empty envelope with field-level errors instead of throwing', () => {
    const report = validateRealSubmissionImportEnvelope({}, contract);

    expect(report.status).toBe('rejected_local_validation');
    expect(report.local_format_valid).toBe(false);
    expect(report.field_errors.length).toBeGreaterThanOrEqual(23);
    expect(report.failed_validation_rule_ids).toContain('import-contract-version-must-match');
    expect(report.failed_validation_rule_ids).toContain('route-identifiers-must-match-frozen-intake');
    expect(report.failed_validation_rule_ids).toContain('all-six-attachment-slots-must-resolve');
    expect(report.failed_validation_rule_ids).toContain('submitter-attestation-must-reject-template-data');
    expect(report.real_submission_imported).toBe(false);
  });

  it('rejects locked-route mismatches and a decision from the wrong review track', () => {
    const report = validateRealSubmissionImportEnvelope(
      {
        ...baseEnvelope,
        candidate_id: 'dp-medical-heritage-privacy-boundary',
        reviewer_role: '医疗伦理审稿负责人',
        review_decision: 'approved_for_resubmission'
      },
      contract
    );

    expect(report.status).toBe('rejected_local_validation');
    expect(report.failed_validation_rule_ids).toContain('route-identifiers-must-match-frozen-intake');
    expect(report.failed_validation_rule_ids).toContain('role-and-assignment-must-match');
    expect(report.failed_validation_rule_ids).toContain('decision-and-reason-must-match-review-track');
    expect(report.unresolved_external_check_ids).toEqual([]);
  });

  it('rejects duplicate or incomplete attachment slot manifests', () => {
    const manifest = (baseEnvelope.attachment_record_manifest as JsonRecord[]).slice(0, 5);
    manifest.push({
      slot_id: 'source_bibliography_attachment',
      record_reference: 'external-attachment-source-duplicate-001'
    });
    const report = validateRealSubmissionImportEnvelope(
      { ...baseEnvelope, attachment_record_manifest: manifest },
      contract
    );

    expect(report.status).toBe('rejected_local_validation');
    expect(report.failed_validation_rule_ids).toContain('all-six-attachment-slots-must-resolve');
    expect(report.field_errors.some(error => error.error_id === 'six_unique_required_slots_not_covered')).toBe(true);
  });

  it('rejects malformed metadata, signature time, and incomplete attestation', () => {
    const report = validateRealSubmissionImportEnvelope(
      {
        ...baseEnvelope,
        received_at: '2026-07-10T17:45:00',
        payload_digest_sha256: 'ABC123',
        signed_at: '2026-07-10T17:40:00',
        submitter_attestation: {
          not_fixture: true,
          not_simulation: true
        }
      },
      contract
    );

    expect(report.status).toBe('rejected_local_validation');
    expect(report.failed_validation_rule_ids).toContain('source-record-must-be-external-and-unique');
    expect(report.failed_validation_rule_ids).toContain('payload-digest-must-be-valid-sha256');
    expect(report.failed_validation_rule_ids).toContain('signature-record-and-time-must-resolve');
    expect(report.failed_validation_rule_ids).toContain('submitter-attestation-must-reject-template-data');
  });

  it('documents validator fixtures and tracks Iteration 26 gates', () => {
    const formalDomainPack = readJson(formalDomainPackPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const machineGates = new Map((fixtures.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((fixtures.iteration_26_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(fixtures.validator_module_file).toBe('mcp-server/src/lib/real-submission-import-validator.ts');
    expect(fixtures.rejection_report_markdown_file).toBe(
      'docs/production-cards/domain-pack-real-submission-import-validator-rejection-report-20260710.md'
    );
    expect(markdown).toContain('状态：local_import_validator_fixtures_created_real_import_still_zero');
    expect(markdown).toContain('local_format_pass_is_real_import: false');
    expect(markdown).toContain('rejection_fixture_is_real_submission: false');
    expect(markdown).toContain('validator_runs_external_resolvers: false');
    expect(markdown).toContain('validator_result_is_signature: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 本地格式通过场景');
    expect(markdown).toContain('## 模拟数据拒绝报告');
    expect(markdown).toContain('## 输出结构');

    for (const scenario of fixtures.validation_scenarios as JsonRecord[]) {
      expect(markdown).toContain(scenario.scenario_id);
      expect(scenario.simulation_only).toBe(true);
      expect(scenario.real_submission_imported).toBe(false);
    }

    expect(fixtures.counts.machine_gate_count).toBe(9);
    expect(machineGates.get('deterministic-import-validator-created')?.current_count).toBe(1);
    expect(machineGates.get('validator-scenarios-created')?.current_count).toBe(6);
    expect(machineGates.get('all-simulation-rejection-rules-covered')?.current_count).toBe(4);
    expect(machineGates.get('real-submission-imports-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('twenty-four-field-validator-implemented')?.current_count).toBe(24);
    expect(exitGates.get('four-simulation-rejection-reports-covered')?.current_count).toBe(4);
    expect(exitGates.get('local-pass-distinguished-from-external-resolution')?.current_count).toBe(2);
    expect(exitGates.get('no-validator-result-claimed-as-signature')?.current_count).toBe(0);
    expect(exitGates.get('no-real-import-or-patch-created')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
