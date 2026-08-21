import { resolve } from 'node:path';
import { ErrorCodes } from '@shared/types.js';
import type {
  ProjectExternalEvidenceCandidate,
  ProjectExternalEvidenceLedger,
  ProjectExternalEvidenceSourceStorySyncReceipt,
  ProjectExternalEvidenceVerificationEvent,
  StoryGenerateResult,
} from '@shared/types.js';
import {
  FileStoryRepository,
  StoryRepositoryConflictError,
} from '../repositories/story-repository.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import {
  assertProjectExternalEvidenceVerificationChain,
  ExternalEvidenceVerificationAuditIntegrityError,
} from './external-evidence-verification-audit-service.js';

type StoredStoryFile = StoryGenerateResult & { _request_meta?: unknown };

export type ProjectExternalEvidenceSourceStorySyncPhase = 'reconcile' | 'commit';

export class ProjectExternalEvidenceSourceStorySyncError extends Error {
  readonly code = ErrorCodes.REVIEW_STORAGE_UNAVAILABLE;

  constructor(
    message: string,
    readonly details: {
      project_id: string;
      story_id: string;
      source_story_overwritten: false;
      external_evidence_credit_granted: false;
      reason: string;
    },
  ) {
    super(message);
    this.name = 'ProjectExternalEvidenceSourceStorySyncError';
  }
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

function externalEvidenceProjection(story: StoryGenerateResult): Record<string, unknown> {
  return JSON.parse(JSON.stringify({
    external_evidence_ledger: story.external_evidence_ledger,
    supplement_tasks: story.supplement_tasks,
    production_material_readiness: story.production_material_readiness,
    gears_segments: story.gears_segments,
    gears_delivery: story.gears_delivery,
    quality_report: story.quality_report,
    project_id: story.project_id,
    current_version_id: story.current_version_id,
  })) as Record<string, unknown>;
}

function receipt(input: {
  projectId: string;
  storyId: string;
  status: ProjectExternalEvidenceSourceStorySyncReceipt['status'];
}): ProjectExternalEvidenceSourceStorySyncReceipt {
  const updated = input.status === 'synchronized' || input.status === 'recovered';
  return {
    schema_version: 'project-external-evidence-source-story-sync/v1',
    project_id: input.projectId,
    story_id: input.storyId,
    status: input.status,
    recovery_performed: input.status === 'recovered',
    source_story_updated: updated,
    project_story_authoritative: true,
    source_story_sync_grants_external_evidence_credit: false,
  };
}

function immutableCandidateIdentity(candidate: ProjectExternalEvidenceCandidate): Record<string, unknown> {
  return JSON.parse(JSON.stringify({
    evidence_id: candidate.evidence_id,
    field_id: candidate.field_id,
    evidence_type: candidate.evidence_type,
    title: candidate.title,
    summary: candidate.summary,
    source_uri: candidate.source_uri,
    source_label: candidate.source_label,
    content_sha256: candidate.content_sha256,
    captured_at: candidate.captured_at,
    notes: candidate.notes,
    imported_at: candidate.imported_at,
  })) as Record<string, unknown>;
}

function candidateMatchesVerificationHead(
  candidate: ProjectExternalEvidenceCandidate,
  events: ProjectExternalEvidenceVerificationEvent[],
): boolean {
  let lastEvent: ProjectExternalEvidenceVerificationEvent | undefined;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].evidence_id === candidate.evidence_id) {
      lastEvent = events[index];
      break;
    }
  }
  if (!lastEvent) {
    return candidate.status === 'pending_verification'
      && candidate.source_retrieved === false
      && candidate.content_hash_verified === false
      && candidate.scope_verified === false
      && candidate.external_evidence_credit_granted === false;
  }
  return candidate.status === lastEvent.after_status
    && candidate.source_retrieved === lastEvent.source_retrieved
    && candidate.content_hash_verified === lastEvent.content_hash_verified
    && candidate.scope_verified === lastEvent.scope_verified
    && candidate.external_evidence_credit_granted === lastEvent.external_evidence_credit_granted;
}

function verifiedEvents(ledger: ProjectExternalEvidenceLedger): ProjectExternalEvidenceVerificationEvent[] {
  return assertProjectExternalEvidenceVerificationChain(ledger);
}

function ledgerMatchesStoryContext(input: {
  ledger: ProjectExternalEvidenceLedger;
  events: ProjectExternalEvidenceVerificationEvent[];
  projectId: string;
  storyId: string;
}): boolean {
  const { ledger, events, projectId, storyId } = input;
  if (
    ledger.schema_version !== 'project-external-evidence-ledger/v1'
    || ledger.policy.request_supplied_candidate_is_verified !== false
    || ledger.policy.candidate_import_changes_readiness !== false
    || ledger.policy.candidate_import_resolves_supplement_task !== false
    || ledger.policy.candidate_import_can_grant_external_evidence_credit !== false
  ) {
    return false;
  }
  const itemIds = ledger.items.map(candidate => candidate.evidence_id);
  if (new Set(itemIds).size !== itemIds.length) return false;
  const items = new Map(ledger.items.map(candidate => [candidate.evidence_id, candidate]));
  if (!ledger.items.every(candidate => candidateMatchesVerificationHead(candidate, events))) return false;
  return events.every(event => {
    const candidate = items.get(event.evidence_id);
    return Boolean(candidate)
      && event.project_id === projectId
      && event.story_id === storyId
      && event.field_id === candidate?.field_id
      && event.evidence_type === candidate?.evidence_type
      && event.source_uri === candidate?.source_uri
      && event.expected_content_sha256 === candidate?.content_sha256;
  });
}

function projectExplainsSource(input: {
  projectLedger?: ProjectExternalEvidenceLedger;
  sourceLedger?: ProjectExternalEvidenceLedger;
}): boolean {
  if (!input.sourceLedger) return Boolean(input.projectLedger);
  if (!input.projectLedger) return false;

  const projectEvents = verifiedEvents(input.projectLedger);
  const sourceEvents = verifiedEvents(input.sourceLedger);
  if (sourceEvents.length > projectEvents.length) return false;
  if (!sourceEvents.every((event, index) => event.event_sha256 === projectEvents[index]?.event_sha256)) {
    return false;
  }
  if (!input.sourceLedger.items.every(candidate => candidateMatchesVerificationHead(candidate, sourceEvents))) {
    return false;
  }
  if (!input.projectLedger.items.every(candidate => candidateMatchesVerificationHead(candidate, projectEvents))) {
    return false;
  }

  const projectItems = new Map(input.projectLedger.items.map(candidate => [candidate.evidence_id, candidate]));
  for (const sourceCandidate of input.sourceLedger.items) {
    const projectCandidate = projectItems.get(sourceCandidate.evidence_id);
    if (!projectCandidate) return false;
    if (canonicalJson(immutableCandidateIdentity(sourceCandidate)) !== canonicalJson(immutableCandidateIdentity(projectCandidate))) {
      return false;
    }
    if (
      sourceEvents.length === projectEvents.length
      && canonicalJson(sourceCandidate) !== canonicalJson(projectCandidate)
    ) {
      return false;
    }
  }
  return true;
}

function syncError(input: {
  projectId: string;
  storyId: string;
  reason: string;
  cause?: unknown;
}): ProjectExternalEvidenceSourceStorySyncError {
  const causeMessage = input.cause instanceof Error ? `: ${input.cause.message}` : '';
  return new ProjectExternalEvidenceSourceStorySyncError(
    `Project/source external evidence state cannot be safely synchronized${causeMessage}`,
    {
      project_id: input.projectId,
      story_id: input.storyId,
      source_story_overwritten: false,
      external_evidence_credit_granted: false,
      reason: input.reason,
    },
  );
}

export async function synchronizeProjectExternalEvidenceSourceStory(input: {
  projectId: string;
  projectStory: StoryGenerateResult;
  phase: ProjectExternalEvidenceSourceStorySyncPhase;
}): Promise<ProjectExternalEvidenceSourceStorySyncReceipt> {
  const { projectId, projectStory, phase } = input;
  const repository = new FileStoryRepository(resolve(storyGeneratedRoot(), 'stories'), {
    video_types: [projectStory.video_type],
  });
  let sourceDocument;
  try {
    sourceDocument = await repository.read(projectStory.storyId, [projectStory.video_type]);
  } catch (error) {
    throw syncError({
      projectId,
      storyId: projectStory.storyId,
      reason: 'source_story_unreadable',
      cause: error,
    });
  }
  if (!sourceDocument) {
    return receipt({ projectId, storyId: projectStory.storyId, status: 'source_story_absent' });
  }

  const sourceStory = sourceDocument.story as StoredStoryFile;
  const projectProjection = externalEvidenceProjection(projectStory);
  const sourceProjection = externalEvidenceProjection(sourceStory);
  try {
    if (projectStory.external_evidence_ledger) {
      const events = verifiedEvents(projectStory.external_evidence_ledger);
      if (!ledgerMatchesStoryContext({
        ledger: projectStory.external_evidence_ledger,
        events,
        projectId,
        storyId: projectStory.storyId,
      })) {
        throw new ExternalEvidenceVerificationAuditIntegrityError(
          'Project external evidence ledger is not coherent with the project story',
        );
      }
    }
    if (sourceStory.external_evidence_ledger) {
      const events = verifiedEvents(sourceStory.external_evidence_ledger);
      if (!ledgerMatchesStoryContext({
        ledger: sourceStory.external_evidence_ledger,
        events,
        projectId,
        storyId: projectStory.storyId,
      })) {
        throw new ExternalEvidenceVerificationAuditIntegrityError(
          'Source story external evidence ledger is not coherent with the project story',
        );
      }
    }
  } catch (error) {
    const reason = error instanceof ExternalEvidenceVerificationAuditIntegrityError
      ? 'verification_audit_invalid'
      : 'verification_audit_unreadable';
    throw syncError({ projectId, storyId: projectStory.storyId, reason, cause: error });
  }

  if (canonicalJson(projectProjection) === canonicalJson(sourceProjection)) {
    return receipt({ projectId, storyId: projectStory.storyId, status: 'consistent' });
  }
  if (!projectStory.external_evidence_ledger && !sourceStory.external_evidence_ledger) {
    return receipt({ projectId, storyId: projectStory.storyId, status: 'consistent' });
  }
  try {
    if (!projectExplainsSource({
      projectLedger: projectStory.external_evidence_ledger,
      sourceLedger: sourceStory.external_evidence_ledger,
    })) {
      throw syncError({
        projectId,
        storyId: projectStory.storyId,
        reason: 'source_story_is_ahead_or_forked',
      });
    }
  } catch (error) {
    if (error instanceof ProjectExternalEvidenceSourceStorySyncError) throw error;
    throw syncError({
      projectId,
      storyId: projectStory.storyId,
      reason: 'verification_audit_invalid',
      cause: error,
    });
  }

  const nextSource: StoredStoryFile = {
    ...sourceStory,
    ...projectProjection,
  } as StoredStoryFile;
  try {
    await repository.replace(nextSource, sourceDocument.revision);
  } catch (error) {
    throw syncError({
      projectId,
      storyId: projectStory.storyId,
      reason: error instanceof StoryRepositoryConflictError
        ? 'source_story_changed_during_sync'
        : 'source_story_atomic_write_failed',
      cause: error,
    });
  }
  return receipt({
    projectId,
    storyId: projectStory.storyId,
    status: phase === 'reconcile' ? 'recovered' : 'synchronized',
  });
}
