import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateExternalAdapterConfig,
  evaluateExternalAdapterRegistry,
  type ExternalAdapterConfig
} from '../src/lib/real-submission-external-adapter-registry.js';
import type { ExternalRecordResolverId } from '../src/lib/real-submission-external-record-orchestrator.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const registryPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-external-adapter-config-registry-and-enable-gates.json'
);
const importContractPath = path.join(
  repoRoot,
  'data',
  'production-cards',
  'domain-pack-real-submission-import-contract-and-external-record-resolution.json'
);
const markdownPath = path.join(
  repoRoot,
  'docs',
  'production-cards',
  'domain-pack-real-external-adapter-config-registry-enable-gates-20260710.md'
);
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('Domain Pack real external adapter config registry', () => {
  const fixtures = readJson(registryPath);
  const importContract = readJson(importContractPath);
  const baseConfigs = fixtures.real_adapter_configs as ExternalAdapterConfig[];
  const expectedResolverIds = (importContract.external_record_resolvers as JsonRecord[]).map(
    resolver => resolver.resolver_id as ExternalRecordResolverId
  );

  it('keeps all five real adapter configs disabled and free of secret values', () => {
    const report = evaluateExternalAdapterRegistry({ configs: baseConfigs, expectedResolverIds });

    expect(baseConfigs).toHaveLength(5);
    expect(report.status).toBe('all_disabled_default');
    expect(report.registry_error_ids).toEqual([]);
    expect(report.summary.config_count).toBe(5);
    expect(report.summary.disabled_config_count).toBe(5);
    expect(report.summary.invalid_config_count).toBe(0);
    expect(report.summary.manual_registration_eligible_count).toBe(0);
    expect(report.summary.runtime_adapter_registered_count).toBe(0);
    expect(report.summary.raw_secret_value_stored_count).toBe(0);
    expect(report.environment_values_read).toBe(false);
    expect(report.runtime_registration_performed).toBe(false);

    for (const config of baseConfigs) {
      expect(config.adapter_mode).toBe('external');
      expect(config.enabled).toBe(false);
      expect(config.endpoint_env_var).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(config.credential_env_var_names.length).toBeGreaterThan(0);
      expect(config.credential_env_var_names.every(value => /^[A-Z][A-Z0-9_]*$/.test(value))).toBe(true);
      expect(config.audit_log_sink_env_var).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(config.runtime_adapter_registered).toBe(false);
    }

    for (const configReport of report.config_reports) {
      expect(configReport.status).toBe('disabled_default');
      expect(configReport.raw_secret_value_stored).toBe(false);
      expect(configReport.environment_values_read).toBe(false);
      expect(configReport.runtime_adapter_registered).toBe(false);
    }
  });

  it('evaluates every declared registry scenario without registering an adapter', () => {
    for (const scenario of fixtures.registry_evaluation_scenarios as JsonRecord[]) {
      const configs = baseConfigs.map(config => (
        config.adapter_id === scenario.target_adapter_id
          ? { ...config, ...scenario.config_overrides } as ExternalAdapterConfig
          : { ...config }
      ));
      const report = evaluateExternalAdapterRegistry({ configs, expectedResolverIds });

      expect(report.status).toBe(scenario.expected_registry_status);
      expect(report.summary.manual_registration_eligible_count).toBe(
        scenario.expected_manual_registration_eligible_count
      );
      expect(report.summary.runtime_adapter_registered_count).toBe(0);
      expect(report.runtime_registration_performed).toBe(false);

      if (scenario.target_adapter_id) {
        const targetReport = report.config_reports.find(
          configReport => configReport.adapter_id === scenario.target_adapter_id
        );
        expect(targetReport?.status).toBe(scenario.expected_adapter_status);
        expect(targetReport?.runtime_adapter_registered).toBe(false);
      } else {
        expect(report.config_reports.every(configReport => configReport.status === 'disabled_default')).toBe(true);
      }
    }
  });

  it('requires all eight gates before an enabled config is eligible for manual registration', () => {
    const base = baseConfigs[0];
    const blocked = evaluateExternalAdapterConfig(
      { ...base, enabled: true },
      new Set(expectedResolverIds)
    );
    const eligible = evaluateExternalAdapterConfig(
      {
        ...base,
        enabled: true,
        health_check_status: 'passed',
        audit_readiness_status: 'ready',
        simulation_isolation_status: 'passed',
        human_approval_status: 'approved',
        human_approval_record_reference: 'external-human-approval-record-001'
      },
      new Set(expectedResolverIds)
    );

    expect(blocked.status).toBe('blocked_enablement_gates');
    expect(blocked.unmet_gate_ids).toContain('health-check-passed');
    expect(blocked.unmet_gate_ids).toContain('audit-sink-ready');
    expect(blocked.unmet_gate_ids).toContain('simulation-isolation-passed');
    expect(blocked.unmet_gate_ids).toContain('human-approval-verified');
    expect(eligible.status).toBe('eligible_for_manual_runtime_registration');
    expect(eligible.gate_results).toHaveLength(8);
    expect(eligible.gate_results.every(gate => gate.met)).toBe(true);
    expect(eligible.eligible_for_manual_enablement).toBe(true);
    expect(eligible.runtime_adapter_registered).toBe(false);
  });

  it('rejects direct endpoints, raw secret fields, and static runtime registration claims', () => {
    const base = baseConfigs[0];
    const report = evaluateExternalAdapterConfig(
      {
        ...base,
        endpoint_env_var: 'https://example.invalid/api',
        api_key_value: 'not-a-real-secret',
        runtime_adapter_registered: true
      } as ExternalAdapterConfig,
      new Set(expectedResolverIds)
    );

    expect(report.status).toBe('blocked_invalid_config');
    expect(report.config_errors).toContainEqual({
      field_id: 'endpoint_env_var',
      error_id: 'environment_variable_name_required'
    });
    expect(report.config_errors).toContainEqual({ field_id: 'config', error_id: 'raw_secret_field_forbidden' });
    expect(report.config_errors).toContainEqual({
      field_id: 'runtime_adapter_registered',
      error_id: 'runtime_registration_forbidden_in_static_config'
    });
    expect(report.raw_secret_value_stored).toBe(false);
    expect(report.runtime_adapter_registered).toBe(false);
  });

  it('rejects duplicate adapter IDs and incomplete resolver coverage', () => {
    const duplicateConfigs = [
      ...baseConfigs.slice(0, 4),
      { ...baseConfigs[4], adapter_id: baseConfigs[0].adapter_id }
    ];
    const missingConfigReport = evaluateExternalAdapterRegistry({
      configs: baseConfigs.slice(0, 4),
      expectedResolverIds
    });
    const duplicateConfigReport = evaluateExternalAdapterRegistry({
      configs: duplicateConfigs,
      expectedResolverIds
    });

    expect(missingConfigReport.status).toBe('invalid_registry');
    expect(missingConfigReport.registry_error_ids).toContain('resolver_registry_coverage_mismatch');
    expect(duplicateConfigReport.status).toBe('invalid_registry');
    expect(duplicateConfigReport.registry_error_ids).toContain('duplicate_adapter_id');
  });

  it('documents safe enablement and tracks Iteration 28 gates', () => {
    const formalDomainPack = readJson(formalDomainPackPath);
    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const machineGates = new Map((fixtures.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((fixtures.iteration_28_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(Array.isArray(formalDomainPack.entries)).toBe(true);
    expect(fixtures.registry_module_file).toBe('mcp-server/src/lib/real-submission-external-adapter-registry.ts');
    expect(fixtures.registry_markdown_file).toBe(
      'docs/production-cards/domain-pack-real-external-adapter-config-registry-enable-gates-20260710.md'
    );
    expect(markdown).toContain('状态：real_adapter_registry_created_all_adapters_disabled');
    expect(markdown).toContain('adapter_registry_is_runtime_registration: false');
    expect(markdown).toContain('disabled_config_is_external_connection: false');
    expect(markdown).toContain('manual_registration_eligible_is_enabled: false');
    expect(markdown).toContain('environment_variable_references_are_secret_values: false');
    expect(markdown).toContain('environment_values_read: false');
    expect(markdown).toContain('formal_patch_created: false');
    expect(markdown).toContain('formal_domain_pack_written: false');
    expect(markdown).toContain('province_markdown_written: false');
    expect(markdown).toContain('## 配置字段');
    expect(markdown).toContain('## 五类默认配置');
    expect(markdown).toContain('## 八项启用门槛');
    expect(markdown).toContain('## 注册表状态');

    for (const scenario of fixtures.registry_evaluation_scenarios as JsonRecord[]) {
      expect(markdown).toContain(scenario.scenario_id);
      expect(scenario.simulation_only).toBe(true);
    }

    expect(fixtures.counts.machine_gate_count).toBe(10);
    expect(machineGates.get('five-real-adapter-configs-created')?.current_count).toBe(5);
    expect(machineGates.get('eight-safety-enablement-gates-created')?.current_count).toBe(8);
    expect(machineGates.get('all-real-adapters-disabled-by-default')?.current_count).toBe(5);
    expect(machineGates.get('raw-secret-values-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('runtime-adapters-registered-still-zero')?.current_count).toBe(0);
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('no-direct-province-writeback')?.status).toBe('met');

    expect(exitGates.get('real-adapter-config-registry-created')?.current_count).toBe(5);
    expect(exitGates.get('endpoint-auth-health-audit-human-gates-created')?.current_count).toBe(8);
    expect(exitGates.get('environment-reference-only-policy-enforced')?.current_count).toBe(16);
    expect(exitGates.get('manual-eligibility-does-not-register-runtime-adapter')?.current_count).toBe(1);
    expect(exitGates.get('no-real-adapter-connection-or-secret-stored')?.current_count).toBe(0);
    expect(exitGates.get('formal-domain-pack-and-province-markdown-untouched')?.status).toBe('met');
  });
});
