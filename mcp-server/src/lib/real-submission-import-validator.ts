export interface RealSubmissionImportEnvelope extends Record<string, unknown> {
  import_envelope_id?: unknown;
  import_contract_version?: unknown;
  received_at?: unknown;
  source_system?: unknown;
  source_record_id?: unknown;
  idempotency_key?: unknown;
  payload_digest_sha256?: unknown;
  source_handoff_package_id?: unknown;
  reviewer_intake_id?: unknown;
  candidate_id?: unknown;
  reviewer_name_or_group?: unknown;
  reviewer_identity_type?: unknown;
  reviewer_identity_record_reference?: unknown;
  reviewer_role?: unknown;
  assignment_or_followup_id?: unknown;
  review_decision?: unknown;
  decision_reason?: unknown;
  evidence_package_id?: unknown;
  attachment_record_manifest?: unknown;
  signed_at?: unknown;
  signature_record_reference?: unknown;
  explicit_formal_patch_request?: unknown;
  formal_patch_request_record_reference?: unknown;
  submitter_attestation?: unknown;
}

export interface RealSubmissionImportRoute {
  import_route_id: string;
  source_reviewer_intake_id: string;
  source_handoff_package_id: string;
  candidate_id: string;
  reviewer_role: string;
  assignment_or_followup_id: string;
  evidence_package_id: string;
  allowed_review_decisions: string[];
}

export interface RealSubmissionImportContract {
  real_submission_import_envelope_schema: Array<{
    field_id: string;
    requirement: string;
  }>;
  blank_import_envelope_routes: RealSubmissionImportRoute[];
  explicitly_rejected_fixture_ids: string[];
  external_record_resolution_checklist: Array<{
    check_id: string;
    resolver_id: string;
    target: string;
    requirement: string;
  }>;
}

export interface ImportEnvelopeFieldError {
  field_id: string;
  error_id: string;
  rule_id: string;
}

export interface RealSubmissionImportValidationReport {
  status: 'rejected_local_validation' | 'format_valid_external_resolution_required';
  validation_scope: 'local_deterministic_only';
  local_format_valid: boolean;
  eligible_for_external_resolution: boolean;
  external_resolution_required: boolean;
  matched_import_route_id?: string;
  field_errors: ImportEnvelopeFieldError[];
  failed_validation_rule_ids: string[];
  rejection_reason_ids: string[];
  unresolved_external_check_ids: string[];
  real_submission_imported: false;
  is_signed: false;
  formal_patch_created: false;
  formal_domain_pack_written: false;
  province_markdown_written: false;
}

const IMPORT_CONTRACT_VERSION = 'domain-pack-real-submission-import/v1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const TIMEZONE_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const IDENTITY_TYPES = new Set(['person', 'accountable_group']);
const REQUIRED_ATTESTATIONS = [
  'not_fixture',
  'not_simulation',
  'not_blank_template',
  'not_auto_generated_signature',
  'source_accuracy_confirmed'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function requiredFieldRule(fieldId: string): string {
  if (fieldId === 'import_contract_version') return 'import-contract-version-must-match';
  if (fieldId === 'import_envelope_id') return 'import-envelope-id-must-not-be-fixture';
  if (['received_at', 'source_system', 'source_record_id', 'idempotency_key'].includes(fieldId)) {
    return 'source-record-must-be-external-and-unique';
  }
  if (fieldId === 'payload_digest_sha256') return 'payload-digest-must-be-valid-sha256';
  if (['source_handoff_package_id', 'reviewer_intake_id', 'candidate_id'].includes(fieldId)) {
    return 'route-identifiers-must-match-frozen-intake';
  }
  if (['reviewer_name_or_group', 'reviewer_identity_type', 'reviewer_identity_record_reference'].includes(fieldId)) {
    return 'reviewer-identity-record-must-resolve';
  }
  if (['reviewer_role', 'assignment_or_followup_id'].includes(fieldId)) return 'role-and-assignment-must-match';
  if (['review_decision', 'decision_reason'].includes(fieldId)) {
    return 'decision-and-reason-must-match-review-track';
  }
  if (fieldId === 'evidence_package_id') return 'evidence-package-must-match-route';
  if (fieldId === 'attachment_record_manifest') return 'all-six-attachment-slots-must-resolve';
  if (['signed_at', 'signature_record_reference'].includes(fieldId)) return 'signature-record-and-time-must-resolve';
  if (['explicit_formal_patch_request', 'formal_patch_request_record_reference'].includes(fieldId)) {
    return 'formal-patch-request-must-be-separate-and-resolved';
  }
  return 'submitter-attestation-must-reject-template-data';
}

function getAttachmentRecordReferences(manifest: unknown): string[] {
  if (!Array.isArray(manifest)) return [];
  return manifest.flatMap(item => {
    if (!isRecord(item)) return [];
    return [item.record_reference, item.waiver_record_reference]
      .map(asNonBlankString)
      .filter((value): value is string => value !== undefined);
  });
}

export function validateRealSubmissionImportEnvelope(
  input: unknown,
  contract: RealSubmissionImportContract
): RealSubmissionImportValidationReport {
  const envelope: RealSubmissionImportEnvelope = isRecord(input) ? input : {};
  const fieldErrors: ImportEnvelopeFieldError[] = [];
  const fieldErrorKeys = new Set<string>();
  const failedRuleIds = new Set<string>();
  const rejectionReasonIds = new Set<string>();

  const fail = (fieldId: string, errorId: string, ruleId: string) => {
    const key = `${fieldId}:${errorId}:${ruleId}`;
    if (fieldErrorKeys.has(key)) return;
    fieldErrorKeys.add(key);
    fieldErrors.push({ field_id: fieldId, error_id: errorId, rule_id: ruleId });
    failedRuleIds.add(ruleId);
  };

  for (const field of contract.real_submission_import_envelope_schema) {
    const conditional = field.requirement.startsWith('conditional_required');
    const required = field.requirement === 'required'
      || (conditional && envelope.explicit_formal_patch_request === true);
    if (required && envelope[field.field_id] === undefined) {
      fail(field.field_id, 'required_field_missing', requiredFieldRule(field.field_id));
    }
  }

  if (asNonBlankString(envelope.import_contract_version) !== IMPORT_CONTRACT_VERSION) {
    fail('import_contract_version', 'contract_version_mismatch', 'import-contract-version-must-match');
  }

  const importEnvelopeId = asNonBlankString(envelope.import_envelope_id);
  if (!importEnvelopeId) {
    fail('import_envelope_id', 'nonblank_string_required', 'import-envelope-id-must-not-be-fixture');
  }

  if (!TIMEZONE_DATETIME_PATTERN.test(asNonBlankString(envelope.received_at) ?? '')) {
    fail('received_at', 'timezone_datetime_required', 'source-record-must-be-external-and-unique');
  }

  for (const fieldId of ['source_system', 'source_record_id', 'idempotency_key'] as const) {
    if (!asNonBlankString(envelope[fieldId])) {
      fail(fieldId, 'nonblank_string_required', 'source-record-must-be-external-and-unique');
    }
  }

  if (!SHA256_PATTERN.test(asNonBlankString(envelope.payload_digest_sha256) ?? '')) {
    fail('payload_digest_sha256', 'lowercase_sha256_required', 'payload-digest-must-be-valid-sha256');
  }

  const reviewerIntakeId = asNonBlankString(envelope.reviewer_intake_id);
  const route = contract.blank_import_envelope_routes.find(item => item.source_reviewer_intake_id === reviewerIntakeId);
  if (!route) {
    fail('reviewer_intake_id', 'unknown_import_route', 'route-identifiers-must-match-frozen-intake');
  } else {
    const routeFields: Array<[string, string]> = [
      ['source_handoff_package_id', route.source_handoff_package_id],
      ['candidate_id', route.candidate_id],
      ['reviewer_role', route.reviewer_role],
      ['assignment_or_followup_id', route.assignment_or_followup_id],
      ['evidence_package_id', route.evidence_package_id]
    ];
    for (const [fieldId, expected] of routeFields) {
      if (envelope[fieldId] !== expected) {
        const ruleId = fieldId === 'reviewer_role' || fieldId === 'assignment_or_followup_id'
          ? 'role-and-assignment-must-match'
          : fieldId === 'evidence_package_id'
            ? 'evidence-package-must-match-route'
            : 'route-identifiers-must-match-frozen-intake';
        fail(fieldId, 'value_does_not_match_locked_route', ruleId);
      }
    }
    if (!route.allowed_review_decisions.includes(asNonBlankString(envelope.review_decision) ?? '')) {
      fail('review_decision', 'decision_not_allowed_for_route', 'decision-and-reason-must-match-review-track');
    }
  }

  const reviewerName = asNonBlankString(envelope.reviewer_name_or_group);
  if (!reviewerName) {
    fail('reviewer_name_or_group', 'nonblank_string_required', 'reviewer-identity-record-must-resolve');
  }
  if (!IDENTITY_TYPES.has(asNonBlankString(envelope.reviewer_identity_type) ?? '')) {
    fail('reviewer_identity_type', 'identity_type_invalid', 'reviewer-identity-record-must-resolve');
  }
  if (!asNonBlankString(envelope.reviewer_identity_record_reference)) {
    fail('reviewer_identity_record_reference', 'record_reference_required', 'reviewer-identity-record-must-resolve');
  }
  if (!asNonBlankString(envelope.decision_reason)) {
    fail('decision_reason', 'nonblank_string_required', 'decision-and-reason-must-match-review-track');
  }

  const requiredAttachmentSlots = contract.external_record_resolution_checklist
    .filter(item => item.resolver_id === 'attachment-or-waiver-record-resolver')
    .map(item => item.target);
  const attachmentManifest = Array.isArray(envelope.attachment_record_manifest)
    ? envelope.attachment_record_manifest
    : [];
  const attachmentSlots = new Set<string>();
  for (const item of attachmentManifest) {
    if (!isRecord(item)) continue;
    const slotId = asNonBlankString(item.slot_id);
    const recordReference = asNonBlankString(item.record_reference);
    const waiverReference = asNonBlankString(item.waiver_record_reference);
    if (slotId) attachmentSlots.add(slotId);
    if (!slotId || (!recordReference && !waiverReference)) {
      fail('attachment_record_manifest', 'slot_and_record_or_waiver_required', 'all-six-attachment-slots-must-resolve');
    }
  }
  if (
    attachmentManifest.length !== requiredAttachmentSlots.length
    || attachmentSlots.size !== requiredAttachmentSlots.length
    || requiredAttachmentSlots.some(slotId => !attachmentSlots.has(slotId))
  ) {
    fail('attachment_record_manifest', 'six_unique_required_slots_not_covered', 'all-six-attachment-slots-must-resolve');
  }

  if (!TIMEZONE_DATETIME_PATTERN.test(asNonBlankString(envelope.signed_at) ?? '')) {
    fail('signed_at', 'timezone_datetime_required', 'signature-record-and-time-must-resolve');
  }
  if (!asNonBlankString(envelope.signature_record_reference)) {
    fail('signature_record_reference', 'record_reference_required', 'signature-record-and-time-must-resolve');
  }

  if (typeof envelope.explicit_formal_patch_request !== 'boolean') {
    fail('explicit_formal_patch_request', 'boolean_required', 'formal-patch-request-must-be-separate-and-resolved');
  } else if (envelope.explicit_formal_patch_request === true) {
    if (!asNonBlankString(envelope.formal_patch_request_record_reference)) {
      fail(
        'formal_patch_request_record_reference',
        'separate_authorized_record_required',
        'formal-patch-request-must-be-separate-and-resolved'
      );
    }
  }

  const attestation = isRecord(envelope.submitter_attestation) ? envelope.submitter_attestation : undefined;
  if (!attestation || REQUIRED_ATTESTATIONS.some(fieldId => attestation[fieldId] !== true)) {
    fail('submitter_attestation', 'all_attestations_must_be_true', 'submitter-attestation-must-reject-template-data');
  }

  const fixtureIdentifierValues = [
    importEnvelopeId,
    asNonBlankString(envelope.source_record_id),
    reviewerIntakeId
  ].filter((value): value is string => value !== undefined);
  if (
    fixtureIdentifierValues.some(value => contract.explicitly_rejected_fixture_ids.includes(value))
    || fixtureIdentifierValues.some(value => /submission-fixture-|fixture_id|validation_fixture/i.test(value))
  ) {
    rejectionReasonIds.add('reject-fixture-identifiers');
    fail('import_envelope_id', 'fixture_identifier_rejected', 'import-envelope-id-must-not-be-fixture');
  }

  const recordReferences = [
    asNonBlankString(envelope.reviewer_identity_record_reference),
    ...getAttachmentRecordReferences(envelope.attachment_record_manifest),
    asNonBlankString(envelope.signature_record_reference),
    asNonBlankString(envelope.formal_patch_request_record_reference)
  ].filter((value): value is string => value !== undefined);
  if (recordReferences.some(value => /SIMULATION-|simulation-attachment-set-/i.test(value))) {
    rejectionReasonIds.add('reject-simulation-record-references');
    fail('record_references', 'simulation_record_reference_rejected', 'all-record-references-must-reject-simulation');
  }

  const placeholderValues = [reviewerName, asNonBlankString(envelope.decision_reason)]
    .filter((value): value is string => value !== undefined);
  if (placeholderValues.some(value => /结构校验占位|结构校验文本|\[待指定\]/.test(value))) {
    rejectionReasonIds.add('reject-structural-placeholder-values');
    fail('reviewer_name_or_group', 'structural_placeholder_rejected', 'reviewer-identity-record-must-resolve');
  }

  if (
    envelope.simulation_only === true
    || Object.prototype.hasOwnProperty.call(envelope, 'fixture_validation_mode')
    || Object.prototype.hasOwnProperty.call(envelope, 'derived_from_fixture_id')
  ) {
    rejectionReasonIds.add('reject-simulation-flags-and-fixture-metadata');
    fail('submitter_attestation', 'simulation_metadata_rejected', 'submitter-attestation-must-reject-template-data');
  }

  const localFormatValid = fieldErrors.length === 0;
  const unresolvedExternalCheckIds = localFormatValid
    ? contract.external_record_resolution_checklist
      .filter(item => !item.requirement.startsWith('conditional_') || envelope.explicit_formal_patch_request === true)
      .map(item => item.check_id)
    : [];

  return {
    status: localFormatValid ? 'format_valid_external_resolution_required' : 'rejected_local_validation',
    validation_scope: 'local_deterministic_only',
    local_format_valid: localFormatValid,
    eligible_for_external_resolution: localFormatValid,
    external_resolution_required: localFormatValid,
    ...(route ? { matched_import_route_id: route.import_route_id } : {}),
    field_errors: fieldErrors,
    failed_validation_rule_ids: [...failedRuleIds],
    rejection_reason_ids: [...rejectionReasonIds],
    unresolved_external_check_ids: unresolvedExternalCheckIds,
    real_submission_imported: false,
    is_signed: false,
    formal_patch_created: false,
    formal_domain_pack_written: false,
    province_markdown_written: false
  };
}
