import type {
  RealSubmissionImportContract,
  RealSubmissionImportEnvelope,
  RealSubmissionImportValidationReport
} from './real-submission-import-validator.js';

export type ExternalRecordResolverId =
  | 'source-submission-record-resolver'
  | 'reviewer-identity-record-resolver'
  | 'attachment-or-waiver-record-resolver'
  | 'signature-record-resolver'
  | 'formal-patch-request-record-resolver';

export type ExternalRecordAdapterMode = 'simulation' | 'external';
export type ExternalRecordAdapterStatus = 'unresolved' | 'failed' | 'resolved_as_simulation' | 'resolved_real';

export interface ExternalRecordResolutionContract extends RealSubmissionImportContract {
  external_record_resolvers: Array<{
    resolver_id: ExternalRecordResolverId;
    record_kind: string;
    required_input_field: string;
  }>;
}

export interface ExternalRecordResolverRequest {
  check_id: string;
  target: string;
  record_reference?: string;
  envelope: RealSubmissionImportEnvelope;
}

export interface ExternalRecordAdapterResult {
  status: ExternalRecordAdapterStatus;
  record_id?: string;
  verification_reference?: string;
  reason_id?: string;
}

interface BaseExternalRecordResolverAdapter<Id extends ExternalRecordResolverId> {
  resolver_id: Id;
  adapter_mode: ExternalRecordAdapterMode;
  resolve(request: ExternalRecordResolverRequest): Promise<ExternalRecordAdapterResult>;
}

export interface SourceSubmissionRecordResolverAdapter
  extends BaseExternalRecordResolverAdapter<'source-submission-record-resolver'> {}

export interface ReviewerIdentityRecordResolverAdapter
  extends BaseExternalRecordResolverAdapter<'reviewer-identity-record-resolver'> {}

export interface AttachmentOrWaiverRecordResolverAdapter
  extends BaseExternalRecordResolverAdapter<'attachment-or-waiver-record-resolver'> {}

export interface SignatureRecordResolverAdapter
  extends BaseExternalRecordResolverAdapter<'signature-record-resolver'> {}

export interface FormalPatchRequestRecordResolverAdapter
  extends BaseExternalRecordResolverAdapter<'formal-patch-request-record-resolver'> {}

export type ExternalRecordResolverAdapter =
  | SourceSubmissionRecordResolverAdapter
  | ReviewerIdentityRecordResolverAdapter
  | AttachmentOrWaiverRecordResolverAdapter
  | SignatureRecordResolverAdapter
  | FormalPatchRequestRecordResolverAdapter;

export type ExternalRecordCheckStatus = ExternalRecordAdapterStatus | 'not_applicable';

export interface ExternalRecordCheckResult {
  check_id: string;
  resolver_id: ExternalRecordResolverId;
  target: string;
  status: ExternalRecordCheckStatus;
  adapter_mode?: ExternalRecordAdapterMode;
  record_reference?: string;
  record_id?: string;
  verification_reference?: string;
  reason_id?: string;
}

export interface ExternalRecordResolutionSummary {
  total_check_count: number;
  unresolved_count: number;
  failed_count: number;
  resolved_as_simulation_count: number;
  resolved_real_count: number;
  not_applicable_count: number;
}

export interface ExternalRecordOrchestrationReport {
  status:
    | 'blocked_local_validation'
    | 'external_resolution_incomplete'
    | 'external_resolution_failed'
    | 'resolved_as_simulation_only'
    | 'external_records_resolved_pending_human_acceptance';
  orchestration_scope: 'external_record_resolution_only';
  local_validation_status: RealSubmissionImportValidationReport['status'];
  check_results: ExternalRecordCheckResult[];
  summary: ExternalRecordResolutionSummary;
  all_required_checks_resolved_real: boolean;
  real_submission_imported: false;
  is_signed: false;
  formal_patch_created: false;
  formal_domain_pack_written: false;
  province_markdown_written: false;
}

function asNonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getAttachmentReference(envelope: RealSubmissionImportEnvelope, slotId: string): string | undefined {
  if (!Array.isArray(envelope.attachment_record_manifest)) return undefined;
  const item = envelope.attachment_record_manifest.find(value => (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).slot_id === slotId
  ));
  if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
  const record = item as Record<string, unknown>;
  return asNonBlankString(record.record_reference) ?? asNonBlankString(record.waiver_record_reference);
}

function getRecordReference(
  envelope: RealSubmissionImportEnvelope,
  resolverId: ExternalRecordResolverId,
  target: string
): string | undefined {
  if (resolverId === 'source-submission-record-resolver') return asNonBlankString(envelope.source_record_id);
  if (resolverId === 'reviewer-identity-record-resolver') {
    return asNonBlankString(envelope.reviewer_identity_record_reference);
  }
  if (resolverId === 'attachment-or-waiver-record-resolver') return getAttachmentReference(envelope, target);
  if (resolverId === 'signature-record-resolver') return asNonBlankString(envelope.signature_record_reference);
  return asNonBlankString(envelope.formal_patch_request_record_reference);
}

function summarize(results: ExternalRecordCheckResult[]): ExternalRecordResolutionSummary {
  return {
    total_check_count: results.length,
    unresolved_count: results.filter(result => result.status === 'unresolved').length,
    failed_count: results.filter(result => result.status === 'failed').length,
    resolved_as_simulation_count: results.filter(result => result.status === 'resolved_as_simulation').length,
    resolved_real_count: results.filter(result => result.status === 'resolved_real').length,
    not_applicable_count: results.filter(result => result.status === 'not_applicable').length
  };
}

function emptySummary(): ExternalRecordResolutionSummary {
  return {
    total_check_count: 0,
    unresolved_count: 0,
    failed_count: 0,
    resolved_as_simulation_count: 0,
    resolved_real_count: 0,
    not_applicable_count: 0
  };
}

export async function orchestrateExternalRecordResolution(input: {
  envelope: RealSubmissionImportEnvelope;
  validationReport: RealSubmissionImportValidationReport;
  contract: ExternalRecordResolutionContract;
  adapters: ExternalRecordResolverAdapter[];
}): Promise<ExternalRecordOrchestrationReport> {
  if (!input.validationReport.eligible_for_external_resolution) {
    return {
      status: 'blocked_local_validation',
      orchestration_scope: 'external_record_resolution_only',
      local_validation_status: input.validationReport.status,
      check_results: [],
      summary: emptySummary(),
      all_required_checks_resolved_real: false,
      real_submission_imported: false,
      is_signed: false,
      formal_patch_created: false,
      formal_domain_pack_written: false,
      province_markdown_written: false
    };
  }

  const adaptersById = new Map(input.adapters.map(adapter => [adapter.resolver_id, adapter]));
  const contractResolverIds = new Set(input.contract.external_record_resolvers.map(resolver => resolver.resolver_id));
  const checkResults: ExternalRecordCheckResult[] = [];

  for (const check of input.contract.external_record_resolution_checklist) {
    const resolverId = check.resolver_id as ExternalRecordResolverId;
    const conditional = check.requirement.startsWith('conditional_');
    if (conditional && input.envelope.explicit_formal_patch_request !== true) {
      checkResults.push({
        check_id: check.check_id,
        resolver_id: resolverId,
        target: check.target,
        status: 'not_applicable',
        reason_id: 'explicit_formal_patch_request_false'
      });
      continue;
    }

    const adapter = adaptersById.get(resolverId);
    const recordReference = getRecordReference(input.envelope, resolverId, check.target);
    if (!contractResolverIds.has(resolverId) || !adapter) {
      checkResults.push({
        check_id: check.check_id,
        resolver_id: resolverId,
        target: check.target,
        status: 'unresolved',
        record_reference: recordReference,
        reason_id: !contractResolverIds.has(resolverId) ? 'resolver_not_in_contract' : 'resolver_adapter_missing'
      });
      continue;
    }

    try {
      const adapterResult = await adapter.resolve({
        check_id: check.check_id,
        target: check.target,
        record_reference: recordReference,
        envelope: input.envelope
      });
      const status = adapter.adapter_mode === 'simulation' && adapterResult.status === 'resolved_real'
        ? 'resolved_as_simulation'
        : adapterResult.status;
      checkResults.push({
        check_id: check.check_id,
        resolver_id: resolverId,
        target: check.target,
        status,
        adapter_mode: adapter.adapter_mode,
        record_reference: recordReference,
        record_id: adapterResult.record_id,
        verification_reference: adapterResult.verification_reference,
        reason_id: status !== adapterResult.status
          ? 'simulation_adapter_cannot_resolve_real_record'
          : adapterResult.reason_id
      });
    } catch {
      checkResults.push({
        check_id: check.check_id,
        resolver_id: resolverId,
        target: check.target,
        status: 'failed',
        adapter_mode: adapter.adapter_mode,
        record_reference: recordReference,
        reason_id: 'resolver_adapter_threw'
      });
    }
  }

  const summary = summarize(checkResults);
  const applicableCount = summary.total_check_count - summary.not_applicable_count;
  const allRequiredChecksResolvedReal = applicableCount > 0 && summary.resolved_real_count === applicableCount;
  const status: ExternalRecordOrchestrationReport['status'] = summary.failed_count > 0
    ? 'external_resolution_failed'
    : summary.unresolved_count > 0
      ? 'external_resolution_incomplete'
      : summary.resolved_as_simulation_count > 0
        ? 'resolved_as_simulation_only'
        : 'external_records_resolved_pending_human_acceptance';

  return {
    status,
    orchestration_scope: 'external_record_resolution_only',
    local_validation_status: input.validationReport.status,
    check_results: checkResults,
    summary,
    all_required_checks_resolved_real: allRequiredChecksResolvedReal,
    real_submission_imported: false,
    is_signed: false,
    formal_patch_created: false,
    formal_domain_pack_written: false,
    province_markdown_written: false
  };
}
