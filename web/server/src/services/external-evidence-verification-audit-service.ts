import { createHash } from 'node:crypto';
import { ErrorCodes } from '@shared/types.js';
import type {
  ProjectExternalEvidenceCandidate,
  ProjectExternalEvidenceCandidateStatus,
  ProjectExternalEvidenceLedger,
  ProjectExternalEvidenceReviewer,
  ProjectExternalEvidenceVerificationEvent,
  ProjectExternalEvidenceVerificationRequest,
} from '@shared/types.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const EVENT_ID_PATTERN = /^external-evidence-verification-[a-f0-9]{24}$/;

export class ExternalEvidenceVerificationAuditIntegrityError extends Error {
  readonly code = ErrorCodes.REVIEW_STORAGE_UNAVAILABLE;

  constructor(message: string) {
    super(message);
    this.name = 'ExternalEvidenceVerificationAuditIntegrityError';
  }
}

export class ExternalEvidenceVerificationAuditConflictError extends Error {
  readonly code = ErrorCodes.PROJECT_WRITE_CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'ExternalEvidenceVerificationAuditConflictError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => (
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function validStatus(value: unknown): value is ProjectExternalEvidenceCandidateStatus {
  return value === 'pending_verification'
    || value === 'verified'
    || value === 'rejected'
    || value === 'revoked';
}

function validTransition(event: ProjectExternalEvidenceVerificationEvent): boolean {
  if (event.decision === 'accept') {
    return event.after_status === 'verified'
      && event.before_status !== 'verified'
      && event.source_retrieved
      && event.content_hash_verified
      && event.scope_verified
      && event.external_evidence_credit_granted
      && event.scope_attestation?.source_matches_candidate === true
      && event.scope_attestation.evidence_supports_field === true
      && event.scope_attestation.usage_scope_confirmed === true
      && event.actual_content_sha256 === event.expected_content_sha256;
  }
  if (event.decision === 'reject') {
    return event.before_status === 'pending_verification'
      && event.after_status === 'rejected'
      && !event.source_retrieved
      && !event.content_hash_verified
      && !event.scope_verified
      && !event.external_evidence_credit_granted;
  }
  return event.decision === 'revoke'
    && event.before_status === 'verified'
    && event.after_status === 'revoked'
    && !event.source_retrieved
    && !event.content_hash_verified
    && !event.scope_verified
    && !event.external_evidence_credit_granted;
}

function validRetrieval(event: ProjectExternalEvidenceVerificationEvent): boolean {
  if (!event.retrieval) return true;
  return event.decision === 'accept'
    && Number.isFinite(Date.parse(event.retrieval.retrieved_at))
    && event.retrieval.artifact_uri === `artifact://https/${event.expected_content_sha256}.bin`
    && event.retrieval.final_uri.startsWith('https://')
    && Boolean(event.retrieval.content_type)
    && Number.isSafeInteger(event.retrieval.redirect_count)
    && event.retrieval.redirect_count >= 0
    && event.retrieval.redirect_count <= 3
    && Array.isArray(event.retrieval.resolution_trace)
    && event.retrieval.resolution_trace.length >= 1
    && event.retrieval.resolution_trace.every(item => (
      typeof item.hostname === 'string'
      && typeof item.address === 'string'
      && (item.family === 4 || item.family === 6)
    ));
}

function validEvent(value: unknown): value is ProjectExternalEvidenceVerificationEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<ProjectExternalEvidenceVerificationEvent>;
  return event.schema_version === 'project-external-evidence-verification-event/v1'
    && typeof event.event_id === 'string'
    && EVENT_ID_PATTERN.test(event.event_id)
    && Number.isSafeInteger(event.sequence)
    && (event.sequence ?? 0) >= 1
    && (event.previous_event_sha256 === null
      || (typeof event.previous_event_sha256 === 'string' && SHA256_PATTERN.test(event.previous_event_sha256)))
    && typeof event.event_sha256 === 'string'
    && SHA256_PATTERN.test(event.event_sha256)
    && typeof event.request_sha256 === 'string'
    && SHA256_PATTERN.test(event.request_sha256)
    && typeof event.idempotency_key === 'string'
    && event.idempotency_key.length >= 8
    && typeof event.recorded_at === 'string'
    && Number.isFinite(Date.parse(event.recorded_at))
    && typeof event.project_id === 'string'
    && typeof event.story_id === 'string'
    && typeof event.evidence_id === 'string'
    && typeof event.field_id === 'string'
    && typeof event.evidence_type === 'string'
    && typeof event.source_uri === 'string'
    && typeof event.expected_content_sha256 === 'string'
    && SHA256_PATTERN.test(event.expected_content_sha256)
    && (event.actual_content_sha256 === undefined
      || (typeof event.actual_content_sha256 === 'string' && SHA256_PATTERN.test(event.actual_content_sha256)))
    && (event.decision === 'accept' || event.decision === 'reject' || event.decision === 'revoke')
    && validStatus(event.before_status)
    && validStatus(event.after_status)
    && typeof event.source_retrieved === 'boolean'
    && typeof event.content_hash_verified === 'boolean'
    && typeof event.scope_verified === 'boolean'
    && typeof event.external_evidence_credit_granted === 'boolean'
    && typeof event.reviewer?.actor_id === 'string'
    && (event.reviewer.authentication_method === 'static_registry_token'
      || event.reviewer.authentication_method === 'signed_session')
    && typeof event.review_note === 'string'
    && validTransition(event as ProjectExternalEvidenceVerificationEvent)
    && validRetrieval(event as ProjectExternalEvidenceVerificationEvent);
}

export function projectExternalEvidenceVerificationRequestSha256(
  request: ProjectExternalEvidenceVerificationRequest,
  reviewer: ProjectExternalEvidenceReviewer,
): string {
  return sha256(canonicalJson({ request, reviewer }));
}

export function assertProjectExternalEvidenceVerificationChain(
  ledger: ProjectExternalEvidenceLedger,
): ProjectExternalEvidenceVerificationEvent[] {
  const events = ledger.verification_events ?? [];
  const seenEventIds = new Set<string>();
  const seenIdempotencyKeys = new Set<string>();
  let previousHash: string | null = null;
  for (const [index, candidate] of events.entries()) {
    if (!validEvent(candidate)) {
      throw new ExternalEvidenceVerificationAuditIntegrityError(
        `External evidence verification event ${index + 1} is invalid`,
      );
    }
    const event = candidate as ProjectExternalEvidenceVerificationEvent;
    if (event.sequence !== index + 1 || event.previous_event_sha256 !== previousHash) {
      throw new ExternalEvidenceVerificationAuditIntegrityError(
        `External evidence verification chain breaks at sequence ${index + 1}`,
      );
    }
    const { event_sha256: storedHash, ...unsigned } = event;
    if (storedHash !== sha256(canonicalJson(unsigned))) {
      throw new ExternalEvidenceVerificationAuditIntegrityError(
        `External evidence verification hash mismatch at sequence ${index + 1}`,
      );
    }
    if (seenEventIds.has(event.event_id) || seenIdempotencyKeys.has(event.idempotency_key)) {
      throw new ExternalEvidenceVerificationAuditIntegrityError(
        `External evidence verification history contains a duplicate at sequence ${index + 1}`,
      );
    }
    seenEventIds.add(event.event_id);
    seenIdempotencyKeys.add(event.idempotency_key);
    previousHash = event.event_sha256;
  }
  if ((ledger.verification_head_sha256 ?? null) !== previousHash) {
    throw new ExternalEvidenceVerificationAuditIntegrityError(
      'External evidence verification ledger head does not match its event chain',
    );
  }
  return events;
}

export function findProjectExternalEvidenceVerificationReplay(input: {
  events: ProjectExternalEvidenceVerificationEvent[];
  idempotencyKey: string;
  requestSha256: string;
}): ProjectExternalEvidenceVerificationEvent | undefined {
  const existing = input.events.find(event => event.idempotency_key === input.idempotencyKey);
  if (existing && existing.request_sha256 !== input.requestSha256) {
    throw new ExternalEvidenceVerificationAuditConflictError(
      `External evidence verification idempotency key "${input.idempotencyKey}" has conflicting content`,
    );
  }
  return existing;
}

export function buildProjectExternalEvidenceVerificationEvent(input: {
  projectId: string;
  storyId: string;
  candidate: ProjectExternalEvidenceCandidate;
  updatedCandidate: ProjectExternalEvidenceCandidate;
  request: ProjectExternalEvidenceVerificationRequest;
  reviewer: ProjectExternalEvidenceReviewer;
  recordedAt: string;
  actualContentSha256?: string;
  events: ProjectExternalEvidenceVerificationEvent[];
}): ProjectExternalEvidenceVerificationEvent {
  const requestSha256 = projectExternalEvidenceVerificationRequestSha256(input.request, input.reviewer);
  const sequence = input.events.length + 1;
  const previousEventSha256 = input.events.at(-1)?.event_sha256 ?? null;
  const eventId = `external-evidence-verification-${sha256(canonicalJson({
    project_id: input.projectId,
    evidence_id: input.candidate.evidence_id,
    request_sha256: requestSha256,
    sequence,
    recorded_at: input.recordedAt,
  })).slice(0, 24)}`;
  const unsigned: Omit<ProjectExternalEvidenceVerificationEvent, 'event_sha256'> = {
    schema_version: 'project-external-evidence-verification-event/v1',
    event_id: eventId,
    sequence,
    previous_event_sha256: previousEventSha256,
    request_sha256: requestSha256,
    idempotency_key: input.request.idempotency_key,
    recorded_at: input.recordedAt,
    project_id: input.projectId,
    story_id: input.storyId,
    evidence_id: input.candidate.evidence_id,
    field_id: input.candidate.field_id,
    evidence_type: input.candidate.evidence_type,
    source_uri: input.candidate.source_uri,
    expected_content_sha256: input.candidate.content_sha256,
    ...(input.actualContentSha256 ? { actual_content_sha256: input.actualContentSha256 } : {}),
    decision: input.request.decision,
    before_status: input.candidate.status,
    after_status: input.updatedCandidate.status,
    source_retrieved: input.updatedCandidate.source_retrieved,
    content_hash_verified: input.updatedCandidate.content_hash_verified,
    scope_verified: input.updatedCandidate.scope_verified,
    external_evidence_credit_granted: input.updatedCandidate.external_evidence_credit_granted,
    reviewer: input.reviewer,
    ...(input.request.scope_attestation ? { scope_attestation: input.request.scope_attestation } : {}),
    review_note: input.request.review_note.trim(),
    ...(input.request.decision === 'accept'
      && input.updatedCandidate.retrieved_at
      && input.updatedCandidate.retrieved_artifact_uri
      && input.updatedCandidate.retrieval_final_uri
      && input.updatedCandidate.retrieval_content_type
      && input.updatedCandidate.retrieval_redirect_count !== undefined
      && input.updatedCandidate.retrieval_resolution_trace
      ? {
          retrieval: {
            retrieved_at: input.updatedCandidate.retrieved_at,
            artifact_uri: input.updatedCandidate.retrieved_artifact_uri,
            final_uri: input.updatedCandidate.retrieval_final_uri,
            content_type: input.updatedCandidate.retrieval_content_type,
            redirect_count: input.updatedCandidate.retrieval_redirect_count,
            resolution_trace: input.updatedCandidate.retrieval_resolution_trace,
          },
        }
      : {}),
  };
  return {
    ...unsigned,
    event_sha256: sha256(canonicalJson(unsigned)),
  };
}
