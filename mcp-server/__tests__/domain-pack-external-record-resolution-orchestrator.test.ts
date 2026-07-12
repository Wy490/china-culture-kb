import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  orchestrateExternalRecordResolution,
  type ExternalRecordAdapterStatus,
  type ExternalRecordResolutionContract,
  type ExternalRecordResolverAdapter,
  type ExternalRecordResolverId
} from '../src/lib/real-submission-external-record-orchestrator.js';
import {
  validateRealSubmissionImportEnvelope,
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
const validatorFixturesPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-submission-import-validator-rejection-fixtures.json'
);
const orchestratorFixturesPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-external-record-resolution-orchestrator-fixtures.json'
);
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-external-record-resolution-orchestrator-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function createAdapters(profile: JsonRecord): ExternalRecordResolverAdapter[] {
  return Object.entries(profile.resolver_statuses as Record<string, ExternalRecordAdapterStatus>).map(
    ([resolverId, status]) => ({
      resolver_id: resolverId as ExternalRecordResolverId,
      adapter_mode: profile.adapter_mode,
      async resolve(request) {
        return {
          status,
          record_id: `test-record:${request.check_id}`,
          verification_reference: `test-verification:${request.check_id}`,
          reason_id: profile.reason_id
        };
      }
    } as ExternalRecordResolverAdapter)
  );
}

describe('Domain Pack external record resolution orchestrator', () => {
  const contract = readJson(contractPath) as unknown as ExternalRecordResolutionContract;
  const validatorFixtures = readJson(validatorFixturesPath);
  const fixtures = readJson(orchestratorFixturesPath);
  const baseEnvelope = validatorFixtures.base_format_valid_envelope as RealSubmissionImportEnvelope;
  const profiles = new Map(
    (fixtures.test_adapter_profiles as JsonRecord[]).map(profile => [profile.profile_id, profile])
  );

  it('orchestrates every declared fixture with the expected state summary', async () => {
    for (const scenario of fixtures.orchestration_scenarios as JsonRecord[]) {
      const envelope = { ...baseEnvelope, ...scenario.input_overrides };
      const validationReport = validateRealSubmissionImportEnvelope(envelope, contract);
      const profile = profiles.get(scenario.adapter_profile_id) as JsonRecord;
      const report = await orchestrateExternalRecordResolution({
        envelope,
        validationReport,
        contract,
        adapters: createAdapters(profile)
      });

      expect(report.status).toBe(scenario.expected_status);
      expect(report.summary.total_check_count).toBe(scenario.expected_total_check_count);
      expect(report.summary.unresolved_count).toBe(scenario.expected_unresolved_count);
      expect(report.summary.failed_count).toBe(scenario.expected_failed_count);
      expect(report.summary.resolved_as_simulation_count).toBe(
        scenario.expected_resolved_as_simulation_count
      );
      expect(report.summary.resolved_real_count).toBe(scenario.expected_resolved_real_count);
      expect(report.summary.not_applicable_count).toBe(scenario.expected_not_applicable_count);
      expect(report.real_submission_imported).toBe(false);
      expect(report.is_signed).toBe(false);
      expect(report.formal_patch_created).toBe(false);
      expect(report.formal_domain_pack_written).toBe(false);
      expect(report.province_markdown_written).toBe(false);
    }
  });

  it('short-circuits external resolution when local validation is rejected', async () => {
    const envelope = {
      ...baseEnvelope,
      import_envelope_id: 'submission-fixture-valid-craft-approved-001'
    };
    const validationReport = validateRealSubmissionImportEnvelope(envelope, contract);
    let adapterCallCount = 0;
    const adapters = createAdapters(profiles.get('adapter-profile-all-unresolved-001') as JsonRecord).map(
      adapter => ({
        ...adapter,
        async resolve(request) {
          adapterCallCount += 1;
          return adapter.resolve(request);
        }
      } as ExternalRecordResolverAdapter)
    );
    const report = await orchestrateExternalRecordResolution({ envelope, validationReport, contract, adapters });

    expect(validationReport.status).toBe('rejected_local_validation');
    expect(report.status).toBe('blocked_local_validation');
    expect(report.check_results).toEqual([]);
    expect(report.summary.total_check_count).toBe(0);
    expect(adapterCallCount).toBe(0);
  });

  it('marks every applicable check unresolved when adapters are missing', async () => {
    const validationReport = validateRealSubmissionImportEnvelope(baseEnvelope, contract);
    const report = await orchestrateExternalRecordResolution({
      envelope: baseEnvelope,
      validationReport,
      contract,
      adapters: []
    });

    expect(report.status).toBe('external_resolution_incomplete');
    expect(report.summary.total_check_count).toBe(10);
    expect(report.summary.unresolved_count).toBe(9);
    expect(report.summary.not_applicable_count).toBe(1);
    expect(report.check_results.filter(result => result.reason_id === 'resolver_adapter_missing')).toHaveLength(9);
  });

  it('turns adapter exceptions into structured failed checks', async () => {
    const validationReport = validateRealSubmissionImportEnvelope(baseEnvelope, contract);
    const adapters = createAdapters(profiles.get('adapter-profile-all-unresolved-001') as JsonRecord);
    const throwingSignatureAdapter = {
      resolver_id: 'signature-record-resolver',
      adapter_mode: 'simulation',
      async resolve() {
        throw new Error('test resolver failure');
      }
    } as ExternalRecordResolverAdapter;
    const report = await orchestrateExternalRecordResolution({
      envelope: baseEnvelope,
      validationReport,
      contract,
      adapters: [
        ...adapters.filter(adapter => adapter.resolver_id !== 'signature-record-resolver'),
        throwingSignatureAdapter
      ]
    });

    expect(report.status).toBe('external_resolution_failed');
    expect(report.summary.failed_count).toBe(1);
    expect(report.check_results.find(result => result.check_id === 'resolve-signature-record')?.reason_id).toBe(
      'resolver_adapter_threw'
    );
  });

  it('downgrades every real-resolution claim made by simulation adapters', async () => {
    const envelope = {
      ...baseEnvelope,
      import_envelope_id: 'real-import-envelope-orchestrator-local-pass-002',
      source_record_id: 'external-review-record-orchestrator-002',
      idempotency_key: 'external-review-system:external-review-record-orchestrator-002:v1',
      payload_digest_sha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      explicit_formal_patch_request: true,
      formal_patch_request_record_reference: 'external-authorized-patch-request-orchestrator-001'
    };
    const validationReport = validateRealSubmissionImportEnvelope(envelope, contract);
    const adapters = createAdapters(profiles.get('adapter-profile-simulation-claims-resolved-real-001') as JsonRecord);
    const report = await orchestrateExternalRecordResolution({ envelope, validationReport, contract, adapters });

    expect(report.status).toBe('resolved_as_simulation_only');
    expect(report.summary.resolved_as_simulation_count).toBe(10);
    expect(report.summary.resolved_real_count).toBe(0);
    expect(report.all_required_checks_resolved_real).toBe(false);
    expect(report.check_results.every(result => result.status === 'resolved_as_simulation')).toBe(true);
    expect(
      report.check_results.every(result => result.reason_id === 'simulation_adapter_cannot_resolve_real_record')
    ).toBe(true);
    expect(report.real_submission_imported).toBe(false);
    expect(report.is_signed).toBe(false);
  });

  it('documents adapter interfaces and tracks Iteration 27 gates', () => {
    const formalDomainPack = readJson(formalDomainPackPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const machineGates = new Map((fixtures.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((fixtures.iteration_27_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(fixtures.orchestrator_module_file).toBe(
      'mcp-server/src/lib/real-submission-external-record-orchestrator.ts'
    );
    expect(fixtures.orchestrator_markdown_file).toBe(
      'docs/production-cards/domain-pack-external-record-resolution-orchestrator-20260710.md'
    );
    expect(markdown).toContain('状态：external_record_orchestrator_fixtures_created_real_resolution_zero');
    expect(markdown).toContain('test_adapter_result_is_real_resolution: false');
    expect(markdown).toContain('resolved_as_simulation_is_real_record: false');
    expect(markdown).toContain('orchestrator_result_is_real_import: false');
    expect(markdown).toContain('orchestrator_result_is_signature: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 五类适配器接口');
    expect(markdown).toContain('## 编排状态');
    expect(markdown).toContain('## 十项解析检查');
    expect(markdown).toContain('## 测试场景');

    for (const scenario of fixtures.orchestration_scenarios as JsonRecord[]) {
      expect(markdown).toContain(scenario.scenario_id);
      expect(scenario.simulation_only).toBe(true);
      expect(scenario.real_submission_imported).toBe(false);
    }

    expect(fixtures.counts.machine_gate_count).toBe(10);
    expect(machineGates.get('five-external-record-adapter-interfaces-created')?.current_count).toBe(5);
    expect(machineGates.get('ten-resolution-checks-orchestrated')?.current_count).toBe(10);
    expect(machineGates.get('unresolved-failed-simulation-statuses-covered')?.current_count).toBe(3);
    expect(machineGates.get('simulation-real-claim-downgraded')?.current_count).toBe(1);
    expect(machineGates.get('real-external-adapters-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('external-record-adapter-interface-set-created')?.current_count).toBe(5);
    expect(exitGates.get('resolution-state-orchestrator-created')?.current_count).toBe(10);
    expect(exitGates.get('three-required-test-statuses-covered')?.current_count).toBe(3);
    expect(exitGates.get('test-adapters-cannot-claim-real-resolution')?.current_count).toBe(1);
    expect(exitGates.get('no-real-resolution-import-or-signature-claimed')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
