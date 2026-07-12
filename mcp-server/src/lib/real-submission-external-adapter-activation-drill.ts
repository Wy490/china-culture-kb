import {
  evaluateExternalAdapterConfig,
  type ExternalAdapterApprovalStatus,
  type ExternalAdapterConfig
} from './real-submission-external-adapter-registry.js';
import type { ExternalRecordResolverId } from './real-submission-external-record-orchestrator.js';

export type EnvironmentPresenceStatus = 'present' | 'missing';

export interface EnvironmentPresenceEntry {
  environment_variable_name: string;
  presence_status: EnvironmentPresenceStatus;
}

export interface EnvironmentPresenceSnapshot {
  entries: EnvironmentPresenceEntry[];
  required_environment_variable_count: number;
  present_environment_variable_count: number;
  missing_environment_variable_count: number;
  values_read: false;
  raw_secret_values_stored: false;
}

export interface ExternalAdapterActivationApprovalPackage {
  approval_package_id: string;
  adapter_id: string;
  resolver_id: ExternalRecordResolverId;
  owner_role: string;
  status: 'pending_environment_snapshot_offline_drill_and_human_approval';
  required_environment_variable_names: string[];
  manual_activation_review_field_ids: string[];
  offline_drill_check_ids: string[];
  adapter_enabled: false;
  runtime_adapter_registered: false;
  real_external_connection_created: false;
  environment_values_read: false;
}

export interface ExternalAdapterOfflineDrillEvidence {
  health_check_contract_validated: boolean;
  audit_write_contract_validated: boolean;
  simulation_fixture_rejected: boolean;
  simulation_reference_rejected: boolean;
  rollback_disablement_validated: boolean;
  rollback_registration_removal_validated: boolean;
}

export interface ExternalAdapterHumanApprovalEvidence {
  approval_status: ExternalAdapterApprovalStatus;
  approval_record_reference: string;
}

export type ExternalAdapterActivationDrillStatus =
  | 'blocked_invalid_config'
  | 'blocked_environment_references_missing'
  | 'blocked_offline_drill'
  | 'blocked_human_approval'
  | 'ready_for_manual_activation_review';

export interface ExternalAdapterActivationDrillGateResult {
  gate_id: string;
  met: boolean;
}

export interface ExternalAdapterActivationDrillReport {
  adapter_id: string;
  resolver_id: ExternalRecordResolverId;
  status: ExternalAdapterActivationDrillStatus;
  config_valid: boolean;
  snapshot_error_ids: string[];
  missing_environment_variable_names: string[];
  gate_results: ExternalAdapterActivationDrillGateResult[];
  unmet_gate_ids: string[];
  eligible_for_manual_activation_review: boolean;
  adapter_enabled: false;
  runtime_adapter_registered: false;
  real_external_connection_created: false;
  environment_values_read: false;
  real_submission_imported: false;
  is_signed: false;
  formal_patch_created: false;
  formal_write_performed: false;
}

export const MANUAL_ACTIVATION_REVIEW_FIELD_IDS = [
  'activation_request_id',
  'requested_by',
  'adapter_owner_confirmation',
  'risk_review_reference',
  'change_window',
  'rollback_owner',
  'approval_status',
  'approval_record_reference'
] as const;

export const OFFLINE_ACTIVATION_DRILL_CHECK_IDS = [
  'health-check-contract-validated',
  'audit-write-contract-validated',
  'simulation-fixture-rejected',
  'simulation-reference-rejected',
  'rollback-disablement-validated',
  'rollback-registration-removal-validated'
] as const;

function asNonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function collectExternalAdapterEnvironmentVariableNames(config: ExternalAdapterConfig): string[] {
  return Array.from(new Set([
    config.endpoint_env_var,
    ...config.credential_env_var_names,
    config.audit_log_sink_env_var
  ]));
}

export function createEnvironmentPresenceSnapshot(
  requiredEnvironmentVariableNames: readonly string[],
  presentEnvironmentVariableNames: ReadonlySet<string>
): EnvironmentPresenceSnapshot {
  const entries = Array.from(new Set(requiredEnvironmentVariableNames)).map(environmentVariableName => ({
    environment_variable_name: environmentVariableName,
    presence_status: presentEnvironmentVariableNames.has(environmentVariableName)
      ? 'present' as const
      : 'missing' as const
  }));
  const presentCount = entries.filter(entry => entry.presence_status === 'present').length;

  return {
    entries,
    required_environment_variable_count: entries.length,
    present_environment_variable_count: presentCount,
    missing_environment_variable_count: entries.length - presentCount,
    values_read: false,
    raw_secret_values_stored: false
  };
}

export function buildExternalAdapterActivationApprovalPackages(
  configs: readonly ExternalAdapterConfig[]
): ExternalAdapterActivationApprovalPackage[] {
  return configs.map(config => ({
    approval_package_id: `activation-approval-${config.adapter_id}`,
    adapter_id: config.adapter_id,
    resolver_id: config.resolver_id,
    owner_role: config.owner_role,
    status: 'pending_environment_snapshot_offline_drill_and_human_approval',
    required_environment_variable_names: collectExternalAdapterEnvironmentVariableNames(config),
    manual_activation_review_field_ids: [...MANUAL_ACTIVATION_REVIEW_FIELD_IDS],
    offline_drill_check_ids: [...OFFLINE_ACTIVATION_DRILL_CHECK_IDS],
    adapter_enabled: false,
    runtime_adapter_registered: false,
    real_external_connection_created: false,
    environment_values_read: false
  }));
}

export function evaluateExternalAdapterActivationDrill(input: {
  config: ExternalAdapterConfig;
  expectedResolverIds: ReadonlySet<ExternalRecordResolverId>;
  environmentSnapshot: EnvironmentPresenceSnapshot;
  drillEvidence: ExternalAdapterOfflineDrillEvidence;
  humanApproval: ExternalAdapterHumanApprovalEvidence;
}): ExternalAdapterActivationDrillReport {
  const configReport = evaluateExternalAdapterConfig(input.config, input.expectedResolverIds);
  const requiredEnvironmentVariableNames = collectExternalAdapterEnvironmentVariableNames(input.config);
  const expectedNameSet = new Set(requiredEnvironmentVariableNames);
  const snapshotNameSet = new Set(input.environmentSnapshot.entries.map(entry => entry.environment_variable_name));
  const snapshotErrorIds: string[] = [];

  if (
    snapshotNameSet.size !== expectedNameSet.size
    || requiredEnvironmentVariableNames.some(name => !snapshotNameSet.has(name))
    || input.environmentSnapshot.entries.some(entry => !expectedNameSet.has(entry.environment_variable_name))
  ) {
    snapshotErrorIds.push('environment_snapshot_reference_mismatch');
  }
  if (snapshotNameSet.size !== input.environmentSnapshot.entries.length) {
    snapshotErrorIds.push('duplicate_environment_snapshot_entry');
  }
  if (input.environmentSnapshot.values_read !== false) {
    snapshotErrorIds.push('environment_value_read_forbidden');
  }
  if (input.environmentSnapshot.raw_secret_values_stored !== false) {
    snapshotErrorIds.push('raw_secret_value_storage_forbidden');
  }

  const snapshotEntryByName = new Map(
    input.environmentSnapshot.entries.map(entry => [entry.environment_variable_name, entry])
  );
  const missingEnvironmentVariableNames = requiredEnvironmentVariableNames.filter(name => (
    snapshotEntryByName.get(name)?.presence_status !== 'present'
  ));
  const environmentReferencesComplete = snapshotErrorIds.length === 0
    && missingEnvironmentVariableNames.length === 0;
  const approvalRecordPresent = asNonBlankString(input.humanApproval.approval_record_reference) !== undefined;
  const gateResults: ExternalAdapterActivationDrillGateResult[] = [
    { gate_id: 'environment-references-present', met: environmentReferencesComplete },
    {
      gate_id: 'health-check-contract-validated',
      met: input.drillEvidence.health_check_contract_validated === true
    },
    {
      gate_id: 'audit-write-contract-validated',
      met: input.drillEvidence.audit_write_contract_validated === true
    },
    {
      gate_id: 'simulation-fixture-rejected',
      met: input.drillEvidence.simulation_fixture_rejected === true
    },
    {
      gate_id: 'simulation-reference-rejected',
      met: input.drillEvidence.simulation_reference_rejected === true
    },
    {
      gate_id: 'rollback-disablement-validated',
      met: input.drillEvidence.rollback_disablement_validated === true
    },
    {
      gate_id: 'rollback-registration-removal-validated',
      met: input.drillEvidence.rollback_registration_removal_validated === true
    },
    {
      gate_id: 'human-approval-record-present',
      met: input.humanApproval.approval_status === 'approved' && approvalRecordPresent
    }
  ];
  const offlineDrillPassed = gateResults.slice(1, 7).every(gate => gate.met);
  const humanApprovalPassed = gateResults[7].met;
  const status: ExternalAdapterActivationDrillStatus = !configReport.config_valid
    ? 'blocked_invalid_config'
    : !environmentReferencesComplete
      ? 'blocked_environment_references_missing'
      : !offlineDrillPassed
        ? 'blocked_offline_drill'
        : !humanApprovalPassed
          ? 'blocked_human_approval'
          : 'ready_for_manual_activation_review';

  return {
    adapter_id: input.config.adapter_id,
    resolver_id: input.config.resolver_id,
    status,
    config_valid: configReport.config_valid,
    snapshot_error_ids: snapshotErrorIds,
    missing_environment_variable_names: missingEnvironmentVariableNames,
    gate_results: gateResults,
    unmet_gate_ids: gateResults.filter(gate => !gate.met).map(gate => gate.gate_id),
    eligible_for_manual_activation_review: status === 'ready_for_manual_activation_review',
    adapter_enabled: false,
    runtime_adapter_registered: false,
    real_external_connection_created: false,
    environment_values_read: false,
    real_submission_imported: false,
    is_signed: false,
    formal_patch_created: false,
    formal_write_performed: false
  };
}
