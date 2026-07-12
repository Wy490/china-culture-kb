import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExternalAdapterActivationApprovalPackages,
  collectExternalAdapterEnvironmentVariableNames,
  createEnvironmentPresenceSnapshot,
  evaluateExternalAdapterActivationDrill,
  type EnvironmentPresenceSnapshot,
  type ExternalAdapterHumanApprovalEvidence,
  type ExternalAdapterOfflineDrillEvidence
} from '../src/lib/real-submission-external-adapter-activation-drill.js';
import type { ExternalAdapterConfig } from '../src/lib/real-submission-external-adapter-registry.js';
import type { ExternalRecordResolverId } from '../src/lib/real-submission-external-record-orchestrator.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const drillPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-external-adapter-activation-approval-and-offline-drill.json'
);
const registryPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-external-adapter-config-registry-and-enable-gates.json'
);
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-real-external-adapter-activation-approval-offline-drill-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('Domain Pack real external adapter activation approval and offline drill', () => {
  const fixtures = readJson(drillPath);
  const registry = readJson(registryPath);
  const configs = registry.real_adapter_configs as ExternalAdapterConfig[];
  const expectedResolverIds = new Set(
    configs.map(config => config.resolver_id as ExternalRecordResolverId)
  );

  it('builds one pending activation approval package for each disabled adapter config', () => {
    const packages = buildExternalAdapterActivationApprovalPackages(configs);

    expect(packages).toEqual(fixtures.activation_approval_packages);
    expect(packages).toHaveLength(5);
    expect(new Set(packages.map(item => item.adapter_id)).size).toBe(5);
    expect(packages.every(item => item.status === 'pending_environment_snapshot_offline_drill_and_human_approval')).toBe(true);
    expect(packages.every(item => item.manual_activation_review_field_ids.length === 8)).toBe(true);
    expect(packages.every(item => item.offline_drill_check_ids.length === 6)).toBe(true);
    expect(packages.every(item => item.adapter_enabled === false)).toBe(true);
    expect(packages.every(item => item.runtime_adapter_registered === false)).toBe(true);
    expect(packages.every(item => item.real_external_connection_created === false)).toBe(true);
    expect(packages.every(item => item.environment_values_read === false)).toBe(true);

    for (const config of configs) {
      const approvalPackage = packages.find(item => item.adapter_id === config.adapter_id);
      expect(approvalPackage?.required_environment_variable_names).toEqual(
        collectExternalAdapterEnvironmentVariableNames(config)
      );
    }
  });

  it('creates a presence-only environment snapshot without reading or storing values', () => {
    const requiredNames = collectExternalAdapterEnvironmentVariableNames(configs[0]);
    const snapshot = createEnvironmentPresenceSnapshot(requiredNames, new Set([requiredNames[0]]));

    expect(snapshot.entries).toEqual([
      { environment_variable_name: requiredNames[0], presence_status: 'present' },
      { environment_variable_name: requiredNames[1], presence_status: 'missing' },
      { environment_variable_name: requiredNames[2], presence_status: 'missing' }
    ]);
    expect(snapshot.required_environment_variable_count).toBe(3);
    expect(snapshot.present_environment_variable_count).toBe(1);
    expect(snapshot.missing_environment_variable_count).toBe(2);
    expect(snapshot.values_read).toBe(false);
    expect(snapshot.raw_secret_values_stored).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('process.env');
    expect(snapshot.entries.every(entry => Object.keys(entry).sort().join(',') === 'environment_variable_name,presence_status')).toBe(true);
  });

  it('evaluates all four offline drill scenarios with deterministic blocking precedence', () => {
    for (const scenario of fixtures.offline_drill_scenarios as JsonRecord[]) {
      const config = configs.find(item => item.adapter_id === scenario.target_adapter_id);
      expect(config).toBeDefined();
      if (!config) continue;

      const requiredNames = collectExternalAdapterEnvironmentVariableNames(config);
      const environmentSnapshot = createEnvironmentPresenceSnapshot(
        requiredNames,
        new Set(scenario.present_environment_variable_names as string[])
      );
      const report = evaluateExternalAdapterActivationDrill({
        config,
        expectedResolverIds,
        environmentSnapshot,
        drillEvidence: scenario.drill_evidence as ExternalAdapterOfflineDrillEvidence,
        humanApproval: scenario.human_approval as ExternalAdapterHumanApprovalEvidence
      });

      expect(report.status).toBe(scenario.expected_status);
      expect(report.adapter_enabled).toBe(false);
      expect(report.runtime_adapter_registered).toBe(false);
      expect(report.real_external_connection_created).toBe(false);
      expect(report.environment_values_read).toBe(false);
      expect(report.real_submission_imported).toBe(false);
      expect(report.is_signed).toBe(false);
      expect(report.formal_patch_created).toBe(false);
      expect(report.formal_write_performed).toBe(false);
      expect(scenario.simulation_only).toBe(true);
    }
  });

  it('treats a fully passed simulation as manual review readiness only', () => {
    const scenario = (fixtures.offline_drill_scenarios as JsonRecord[]).find(
      item => item.scenario_id === 'activation-drill-ready-for-manual-review-only-001'
    );
    const config = configs.find(item => item.adapter_id === scenario.target_adapter_id) as ExternalAdapterConfig;
    const requiredNames = collectExternalAdapterEnvironmentVariableNames(config);
    const report = evaluateExternalAdapterActivationDrill({
      config,
      expectedResolverIds,
      environmentSnapshot: createEnvironmentPresenceSnapshot(
        requiredNames,
        new Set(scenario.present_environment_variable_names as string[])
      ),
      drillEvidence: scenario.drill_evidence as ExternalAdapterOfflineDrillEvidence,
      humanApproval: scenario.human_approval as ExternalAdapterHumanApprovalEvidence
    });

    expect(report.status).toBe('ready_for_manual_activation_review');
    expect(report.eligible_for_manual_activation_review).toBe(true);
    expect(report.gate_results).toHaveLength(8);
    expect(report.gate_results.every(gate => gate.met)).toBe(true);
    expect(config.enabled).toBe(false);
    expect(config.runtime_adapter_registered).toBe(false);
    expect(report.adapter_enabled).toBe(false);
    expect(report.runtime_adapter_registered).toBe(false);
    expect(report.real_external_connection_created).toBe(false);
  });

  it('blocks invalid configs and mismatched snapshots before activation review', () => {
    const config = configs[0];
    const requiredNames = collectExternalAdapterEnvironmentVariableNames(config);
    const completeEvidence: ExternalAdapterOfflineDrillEvidence = {
      health_check_contract_validated: true,
      audit_write_contract_validated: true,
      simulation_fixture_rejected: true,
      simulation_reference_rejected: true,
      rollback_disablement_validated: true,
      rollback_registration_removal_validated: true
    };
    const approval: ExternalAdapterHumanApprovalEvidence = {
      approval_status: 'approved',
      approval_record_reference: 'simulation-human-approval-record-002'
    };
    const invalidConfigReport = evaluateExternalAdapterActivationDrill({
      config: { ...config, endpoint_env_var: 'https://example.invalid' },
      expectedResolverIds,
      environmentSnapshot: createEnvironmentPresenceSnapshot(
        ['https://example.invalid', ...requiredNames.slice(1)],
        new Set(['https://example.invalid', ...requiredNames.slice(1)])
      ),
      drillEvidence: completeEvidence,
      humanApproval: approval
    });
    const mismatchedSnapshot = {
      ...createEnvironmentPresenceSnapshot(requiredNames.slice(0, 2), new Set(requiredNames.slice(0, 2)))
    } as EnvironmentPresenceSnapshot;
    const mismatchedSnapshotReport = evaluateExternalAdapterActivationDrill({
      config,
      expectedResolverIds,
      environmentSnapshot: mismatchedSnapshot,
      drillEvidence: completeEvidence,
      humanApproval: approval
    });

    expect(invalidConfigReport.status).toBe('blocked_invalid_config');
    expect(invalidConfigReport.config_valid).toBe(false);
    expect(mismatchedSnapshotReport.status).toBe('blocked_environment_references_missing');
    expect(mismatchedSnapshotReport.snapshot_error_ids).toContain('environment_snapshot_reference_mismatch');
    expect(mismatchedSnapshotReport.missing_environment_variable_names).toContain(requiredNames[2]);
    expect(mismatchedSnapshotReport.runtime_adapter_registered).toBe(false);
  });

  it('documents the offline boundary and tracks all Iteration 29 gates', () => {
    const formalDomainPack = readJson(formalDomainPackPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const machineGates = new Map((fixtures.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((fixtures.iteration_29_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(fixtures.activation_drill_module_file).toBe(
      'mcp-server/src/lib/real-submission-external-adapter-activation-drill.ts'
    );
    expect(fixtures.activation_drill_markdown_file).toBe(
      'docs/production-cards/domain-pack-real-external-adapter-activation-approval-offline-drill-20260710.md'
    );
    expect(markdown).toContain('状态：activation_approval_packages_created_offline_drill_only');
    expect(markdown).toContain('activation_approval_package_is_adapter_enablement: false');
    expect(markdown).toContain('offline_drill_is_real_connection: false');
    expect(markdown).toContain('environment_presence_snapshot_reads_values: false');
    expect(markdown).toContain('ready_for_manual_activation_review_is_runtime_registration: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 五份审批包');
    expect(markdown).toContain('## 环境变量存在性快照');
    expect(markdown).toContain('## 六项离线演练');
    expect(markdown).toContain('## 八项评估门槛');

    expect(fixtures.counts.machine_gate_count).toBe(11);
    expect(fixtures.counts.activation_approval_package_count).toBe(5);
    expect(fixtures.counts.offline_drill_check_count).toBe(6);
    expect(fixtures.counts.activation_evaluation_gate_count).toBe(8);
    expect(fixtures.counts.environment_value_read_count).toBe(0);
    expect(fixtures.counts.adapter_enabled_count).toBe(0);
    expect(fixtures.counts.runtime_adapter_registered_count).toBe(0);
    expect(fixtures.counts.real_external_connection_count).toBe(0);
    expect(machineGates.get('five-activation-approval-packages-created')?.current_count).toBe(5);
    expect(machineGates.get('environment-values-read-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('runtime-adapters-registered-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');
    expect(exitGates.get('independent-activation-approval-packages-created')?.current_count).toBe(5);
    expect(exitGates.get('health-audit-isolation-rollback-drills-covered')?.current_count).toBe(6);
    expect(exitGates.get('all-passed-still-requires-manual-activation-review')?.current_count).toBe(1);
    expect(exitGates.get('no-adapter-enabled-registered-or-connected')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
