import type { ExternalRecordResolverId } from './real-submission-external-record-orchestrator.js';

export type ExternalAdapterAuthScheme = 'bearer_env' | 'api_key_env' | 'mtls_env';
export type ExternalAdapterHealthStatus = 'not_run' | 'passed' | 'failed';
export type ExternalAdapterAuditStatus = 'not_configured' | 'ready';
export type ExternalAdapterApprovalStatus = 'not_requested' | 'approved' | 'rejected';
export type ExternalAdapterIsolationStatus = 'not_verified' | 'passed' | 'failed';

export interface ExternalAdapterConfig extends Record<string, unknown> {
  adapter_id: string;
  resolver_id: ExternalRecordResolverId;
  adapter_mode: 'external';
  enabled: boolean;
  endpoint_env_var: string;
  auth_scheme: ExternalAdapterAuthScheme;
  credential_env_var_names: string[];
  healthcheck_path: string;
  timeout_ms: number;
  audit_log_sink_env_var: string;
  owner_role: string;
  health_check_status: ExternalAdapterHealthStatus;
  audit_readiness_status: ExternalAdapterAuditStatus;
  simulation_isolation_status: ExternalAdapterIsolationStatus;
  human_approval_status: ExternalAdapterApprovalStatus;
  human_approval_record_reference: string;
  runtime_adapter_registered: boolean;
}

export type ExternalAdapterConfigStatus =
  | 'disabled_default'
  | 'blocked_invalid_config'
  | 'blocked_enablement_gates'
  | 'eligible_for_manual_runtime_registration';

export interface ExternalAdapterConfigError {
  field_id: string;
  error_id: string;
}

export interface ExternalAdapterGateResult {
  gate_id: string;
  met: boolean;
}

export interface ExternalAdapterConfigReport {
  adapter_id: string;
  resolver_id: ExternalRecordResolverId;
  status: ExternalAdapterConfigStatus;
  config_valid: boolean;
  enabled_requested: boolean;
  eligible_for_manual_enablement: boolean;
  config_errors: ExternalAdapterConfigError[];
  gate_results: ExternalAdapterGateResult[];
  unmet_gate_ids: string[];
  raw_secret_value_stored: false;
  environment_values_read: false;
  runtime_adapter_registered: false;
}

export interface ExternalAdapterRegistryReport {
  status: 'invalid_registry' | 'all_disabled_default' | 'enablement_blocked' | 'manual_registration_eligible';
  config_reports: ExternalAdapterConfigReport[];
  registry_error_ids: string[];
  summary: {
    config_count: number;
    invalid_config_count: number;
    disabled_config_count: number;
    blocked_enablement_count: number;
    manual_registration_eligible_count: number;
    runtime_adapter_registered_count: 0;
    raw_secret_value_stored_count: 0;
  };
  environment_values_read: false;
  runtime_registration_performed: false;
}

const ENV_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const HEALTHCHECK_PATH_PATTERN = /^\/[A-Za-z0-9/_-]*$/;
const ALLOWED_AUTH_SCHEMES = new Set<ExternalAdapterAuthScheme>(['bearer_env', 'api_key_env', 'mtls_env']);
const FORBIDDEN_SECRET_FIELD_PATTERN = /(?:api_key|token|secret|password|credential_value|private_key)(?:_value)?$/i;

function asNonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isEnvVarName(value: unknown): value is string {
  return typeof value === 'string' && ENV_VAR_NAME_PATTERN.test(value);
}

function hasForbiddenRawSecretField(config: ExternalAdapterConfig): boolean {
  return Object.keys(config).some(key => FORBIDDEN_SECRET_FIELD_PATTERN.test(key));
}

export function evaluateExternalAdapterConfig(
  config: ExternalAdapterConfig,
  expectedResolverIds: ReadonlySet<ExternalRecordResolverId>
): ExternalAdapterConfigReport {
  const configErrors: ExternalAdapterConfigError[] = [];
  const addError = (fieldId: string, errorId: string) => {
    if (configErrors.some(error => error.field_id === fieldId && error.error_id === errorId)) return;
    configErrors.push({ field_id: fieldId, error_id: errorId });
  };

  if (!asNonBlankString(config.adapter_id)) addError('adapter_id', 'nonblank_string_required');
  if (!expectedResolverIds.has(config.resolver_id)) addError('resolver_id', 'unknown_resolver_id');
  if (config.adapter_mode !== 'external') addError('adapter_mode', 'external_mode_required');
  if (typeof config.enabled !== 'boolean') addError('enabled', 'boolean_required');
  if (!isEnvVarName(config.endpoint_env_var)) addError('endpoint_env_var', 'environment_variable_name_required');
  if (!ALLOWED_AUTH_SCHEMES.has(config.auth_scheme)) addError('auth_scheme', 'unsupported_auth_scheme');
  if (
    !Array.isArray(config.credential_env_var_names)
    || config.credential_env_var_names.length === 0
    || config.credential_env_var_names.some(value => !isEnvVarName(value))
  ) {
    addError('credential_env_var_names', 'nonempty_environment_variable_name_list_required');
  }
  if (!HEALTHCHECK_PATH_PATTERN.test(config.healthcheck_path)) {
    addError('healthcheck_path', 'relative_healthcheck_path_required');
  }
  if (!Number.isInteger(config.timeout_ms) || config.timeout_ms < 100 || config.timeout_ms > 30_000) {
    addError('timeout_ms', 'integer_between_100_and_30000_required');
  }
  if (!isEnvVarName(config.audit_log_sink_env_var)) {
    addError('audit_log_sink_env_var', 'environment_variable_name_required');
  }
  if (!asNonBlankString(config.owner_role)) addError('owner_role', 'nonblank_string_required');
  if (hasForbiddenRawSecretField(config)) addError('config', 'raw_secret_field_forbidden');
  if (config.runtime_adapter_registered !== false) {
    addError('runtime_adapter_registered', 'runtime_registration_forbidden_in_static_config');
  }

  const endpointReady = isEnvVarName(config.endpoint_env_var);
  const authReady = Array.isArray(config.credential_env_var_names)
    && config.credential_env_var_names.length > 0
    && config.credential_env_var_names.every(isEnvVarName);
  const approvalReferencePresent = asNonBlankString(config.human_approval_record_reference) !== undefined;
  const gateResults: ExternalAdapterGateResult[] = [
    { gate_id: 'config-valid', met: configErrors.length === 0 },
    { gate_id: 'endpoint-reference-ready', met: endpointReady },
    { gate_id: 'auth-reference-ready', met: authReady },
    { gate_id: 'health-check-passed', met: config.health_check_status === 'passed' },
    {
      gate_id: 'audit-sink-ready',
      met: config.audit_readiness_status === 'ready' && isEnvVarName(config.audit_log_sink_env_var)
    },
    { gate_id: 'simulation-isolation-passed', met: config.simulation_isolation_status === 'passed' },
    {
      gate_id: 'human-approval-verified',
      met: config.human_approval_status === 'approved' && approvalReferencePresent
    },
    { gate_id: 'runtime-registration-remains-manual', met: config.runtime_adapter_registered === false }
  ];
  const unmetGateIds = gateResults.filter(gate => !gate.met).map(gate => gate.gate_id);
  const configValid = configErrors.length === 0;
  const eligibleForManualEnablement = configValid && config.enabled === true && unmetGateIds.length === 0;
  const status: ExternalAdapterConfigStatus = !configValid
    ? 'blocked_invalid_config'
    : config.enabled !== true
      ? 'disabled_default'
      : eligibleForManualEnablement
        ? 'eligible_for_manual_runtime_registration'
        : 'blocked_enablement_gates';

  return {
    adapter_id: config.adapter_id,
    resolver_id: config.resolver_id,
    status,
    config_valid: configValid,
    enabled_requested: config.enabled === true,
    eligible_for_manual_enablement: eligibleForManualEnablement,
    config_errors: configErrors,
    gate_results: gateResults,
    unmet_gate_ids: unmetGateIds,
    raw_secret_value_stored: false,
    environment_values_read: false,
    runtime_adapter_registered: false
  };
}

export function evaluateExternalAdapterRegistry(input: {
  configs: ExternalAdapterConfig[];
  expectedResolverIds: ExternalRecordResolverId[];
}): ExternalAdapterRegistryReport {
  const expectedResolverIdSet = new Set(input.expectedResolverIds);
  const configReports = input.configs.map(config => evaluateExternalAdapterConfig(config, expectedResolverIdSet));
  const registryErrorIds: string[] = [];
  const adapterIds = input.configs.map(config => config.adapter_id);
  const resolverIds = input.configs.map(config => config.resolver_id);

  if (new Set(adapterIds).size !== adapterIds.length) registryErrorIds.push('duplicate_adapter_id');
  if (new Set(resolverIds).size !== resolverIds.length) registryErrorIds.push('duplicate_resolver_id');
  if (expectedResolverIdSet.size !== input.expectedResolverIds.length) {
    registryErrorIds.push('duplicate_expected_resolver_id');
  }
  if (
    resolverIds.length !== expectedResolverIdSet.size
    || resolverIds.some(resolverId => !expectedResolverIdSet.has(resolverId))
    || input.expectedResolverIds.some(resolverId => !resolverIds.includes(resolverId))
  ) {
    registryErrorIds.push('resolver_registry_coverage_mismatch');
  }

  const invalidConfigCount = configReports.filter(report => !report.config_valid).length;
  const disabledConfigCount = configReports.filter(report => report.status === 'disabled_default').length;
  const blockedEnablementCount = configReports.filter(report => report.status === 'blocked_enablement_gates').length;
  const manualRegistrationEligibleCount = configReports.filter(
    report => report.status === 'eligible_for_manual_runtime_registration'
  ).length;
  const status: ExternalAdapterRegistryReport['status'] = registryErrorIds.length > 0 || invalidConfigCount > 0
    ? 'invalid_registry'
    : manualRegistrationEligibleCount > 0
      ? 'manual_registration_eligible'
      : blockedEnablementCount > 0
        ? 'enablement_blocked'
        : 'all_disabled_default';

  return {
    status,
    config_reports: configReports,
    registry_error_ids: registryErrorIds,
    summary: {
      config_count: configReports.length,
      invalid_config_count: invalidConfigCount,
      disabled_config_count: disabledConfigCount,
      blocked_enablement_count: blockedEnablementCount,
      manual_registration_eligible_count: manualRegistrationEligibleCount,
      runtime_adapter_registered_count: 0,
      raw_secret_value_stored_count: 0
    },
    environment_values_read: false,
    runtime_registration_performed: false
  };
}
