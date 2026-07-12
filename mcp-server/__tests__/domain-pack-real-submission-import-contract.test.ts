import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const importContractPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-submission-import-contract-and-external-record-resolution.json'
);
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
  'domain-pack-real-submission-import-contract-external-record-resolution-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function ids(items: JsonRecord[], key: string): Set<string> {
  return new Set(items.map(item => item[key] as string));
}

describe('Domain Pack real submission import contract', () => {
  it('defines an import contract without claiming a real submission or writeback', () => {
    const contract = readJson(importContractPath);
    const formalDomainPack = readJson(formalDomainPackPath);

    expect(contract.schema_version).toBe('domain-pack-real-submission-import-contract-external-record-resolution/v1');
    expect(contract.status).toBe('real_submission_import_contract_created_external_records_unresolved');
    expect(contract.counts.real_submission_import_count).toBe(0);
    expect(contract.counts.resolved_external_record_count).toBe(0);
    expect(contract.counts.real_signature_count).toBe(0);
    expect(contract.counts.formal_patch_count).toBe(0);
    expect(Array.isArray(formalDomainPack.entries)).toBe(true);

    expect(contract.writeback_policy.import_contract_is_real_submission).toBe(false);
    expect(contract.writeback_policy.blank_import_route_is_imported_submission).toBe(false);
    expect(contract.writeback_policy.external_record_checklist_is_resolution_result).toBe(false);
    expect(contract.writeback_policy.simulation_fixture_import_allowed).toBe(false);
    expect(contract.writeback_policy.formal_patch_request_recorded).toBe(false);
    expect(contract.writeback_policy.formal_patch_created).toBe(false);
    expect(contract.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(contract.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(contract.writeback_policy.province_markdown_written).toBe(false);
  });

  it('freezes twenty-four import envelope fields and fourteen validation rules', () => {
    const contract = readJson(importContractPath);
    const fields = contract.real_submission_import_envelope_schema as JsonRecord[];
    const rules = contract.import_validation_rules as JsonRecord[];
    const fieldIds = ids(fields, 'field_id');

    expect(fields).toHaveLength(24);
    expect(fieldIds.size).toBe(24);
    expect(fields.filter(field => field.requirement === 'required')).toHaveLength(23);
    expect(fields.filter(field => field.requirement.startsWith('conditional_required'))).toHaveLength(1);
    expect(rules).toHaveLength(14);
    expect(ids(rules, 'rule_id').size).toBe(14);

    for (const requiredField of [
      'source_record_id',
      'idempotency_key',
      'payload_digest_sha256',
      'reviewer_identity_record_reference',
      'attachment_record_manifest',
      'signature_record_reference',
      'formal_patch_request_record_reference',
      'submitter_attestation'
    ]) {
      expect(fieldIds.has(requiredField)).toBe(true);
    }
  });

  it('rejects all known validation fixtures and simulation markers', () => {
    const contract = readJson(importContractPath);
    const preflight = readJson(preflightPath);
    const knownFixtureIds = new Set([
      ...(preflight.structurally_valid_simulation_fixtures as JsonRecord[]).map(item => item.fixture_id as string),
      ...(preflight.invalid_simulation_fixtures as JsonRecord[]).map(item => item.fixture_id as string)
    ]);
    const rejectionRules = contract.simulation_rejection_rules as JsonRecord[];
    const rejectedPatterns = rejectionRules.flatMap(rule => (rule.rejected_patterns ?? []) as string[]);

    expect(rejectionRules).toHaveLength(4);
    expect(ids(rejectionRules, 'rule_id').size).toBe(4);
    expect(new Set(contract.explicitly_rejected_fixture_ids)).toEqual(knownFixtureIds);
    expect(rejectedPatterns).toContain('submission-fixture-');
    expect(rejectedPatterns).toContain('SIMULATION-');
    expect(rejectedPatterns).toContain('结构校验占位');

    for (const rule of rejectionRules) {
      expect(rule.action).toBe('reject_real_import');
    }
  });

  it('creates five resolver contracts and ten unresolved record checks', () => {
    const contract = readJson(importContractPath);
    const handoff = readJson(handoffPath);
    const resolvers = contract.external_record_resolvers as JsonRecord[];
    const checklist = contract.external_record_resolution_checklist as JsonRecord[];
    const resolverIds = ids(resolvers, 'resolver_id');
    const attachmentChecks = checklist.filter(item => item.resolver_id === 'attachment-or-waiver-record-resolver');
    const expectedAttachmentSlots = new Set(
      (handoff.human_handoff_packages as JsonRecord[])[0].required_attachment_slot_ids as string[]
    );

    expect(resolvers).toHaveLength(5);
    expect(resolverIds.size).toBe(5);
    expect(checklist).toHaveLength(10);
    expect(attachmentChecks).toHaveLength(6);
    expect(ids(attachmentChecks, 'target')).toEqual(expectedAttachmentSlots);

    for (const item of checklist) {
      expect(resolverIds.has(item.resolver_id)).toBe(true);
      expect(['missing_real_import_envelope', 'not_applicable_until_explicit_request']).toContain(item.current_status);
    }

    for (const resolver of resolvers) {
      expect(resolver.current_status).toMatch(/not_run$/);
    }
  });

  it('maps eight blank import routes to every frozen reviewer intake template', () => {
    const contract = readJson(importContractPath);
    const intake = readJson(intakePath);
    const routes = contract.blank_import_envelope_routes as JsonRecord[];
    const templates = intake.blank_reviewer_intake_templates as JsonRecord[];
    const templateById = new Map(templates.map(item => [item.reviewer_intake_id, item]));

    expect(routes).toHaveLength(8);
    expect(ids(routes, 'source_reviewer_intake_id')).toEqual(ids(templates, 'reviewer_intake_id'));

    for (const route of routes) {
      const template = templateById.get(route.source_reviewer_intake_id) as JsonRecord;

      expect(template).toBeDefined();
      expect(route.source_handoff_package_id).toBe(template.source_handoff_package_id);
      expect(route.candidate_id).toBe(template.candidate_id);
      expect(route.reviewer_role).toBe(template.reviewer_role);
      expect(route.assignment_or_followup_id).toBe(template.assignment_or_followup_id);
      expect(route.evidence_package_id).toBe(template.evidence_package_id);
      expect(route.allowed_review_decisions).toEqual(template.allowed_review_decisions);
      expect(route.blank_external_field_ids).toContain('source_record_id');
      expect(route.blank_external_field_ids).toContain('reviewer_identity_record_reference');
      expect(route.blank_external_field_ids).toContain('attachment_record_manifest');
      expect(route.blank_external_field_ids).toContain('signature_record_reference');
      expect(route.import_status).toBe('blocked_blank_import_envelope');
      expect(route.real_submission_imported).toBe(false);
    }
  });

  it('documents the import boundary, resolver checklist, and role routes', () => {
    const contract = readJson(importContractPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');

    expect(contract.record_resolution_markdown_file).toBe(
      'docs/production-cards/domain-pack-real-submission-import-contract-external-record-resolution-20260710.md'
    );
    expect(markdown).toContain('状态：real_submission_import_contract_created_external_records_unresolved');
    expect(markdown).toContain('import_contract_is_real_submission: false');
    expect(markdown).toContain('blank_import_route_is_imported_submission: false');
    expect(markdown).toContain('external_record_checklist_is_resolution_result: false');
    expect(markdown).toContain('simulation_fixture_import_allowed: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 导入信封');
    expect(markdown).toContain('## 模拟数据拒绝规则');
    expect(markdown).toContain('## 外部记录解析器');
    expect(markdown).toContain('## 记录解析清单');
    expect(markdown).toContain('## 角色级导入路由');

    for (const route of contract.blank_import_envelope_routes as JsonRecord[]) {
      expect(markdown).toContain(route.import_route_id);
      expect(markdown).toContain(route.source_reviewer_intake_id);
    }
  });

  it('tracks Iteration 25 gates while imports and external resolutions remain zero', () => {
    const contract = readJson(importContractPath);
    const machineGates = new Map((contract.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((contract.iteration_25_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(contract.counts.machine_gate_count).toBe(10);
    expect(machineGates.get('real-submission-import-envelope-schema-created')?.current_count).toBe(24);
    expect(machineGates.get('all-known-fixtures-explicitly-rejected')?.current_count).toBe(14);
    expect(machineGates.get('external-record-resolver-contracts-created')?.current_count).toBe(5);
    expect(machineGates.get('record-resolution-checklist-created')?.current_count).toBe(10);
    expect(machineGates.get('real-submission-imports-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('real-submission-import-contract-separated-from-fixtures')?.current_count).toBe(24);
    expect(exitGates.get('fixture-and-simulation-rejection-created')?.current_count).toBe(4);
    expect(exitGates.get('external-record-resolution-contracts-created')?.current_count).toBe(5);
    expect(exitGates.get('eight-role-import-routes-created')?.current_count).toBe(8);
    expect(exitGates.get('no-real-import-or-signature-claimed')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
