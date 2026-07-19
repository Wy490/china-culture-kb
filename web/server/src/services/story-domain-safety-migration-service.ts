import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProductAccessActor } from '@shared/product-access.js';
import type {
  StoryDomainSafetyMigrationAuditItem,
  StoryDomainSafetyMigrationAuditReport,
  StoryDomainSafetyMigrationRecord,
  StoryDomainSafetyMigrationRequest,
  StoryDomainSafetyMigrationResult,
  StoryGenerateResult,
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import {
  ProjectRepositoryConflictError,
  type ProjectRepository,
} from '../repositories/project-repository.js';
import { createStoryProjectRepository, getStoryProjectRepositoryConfigInfo } from '../platform/project-repository-provider.js';
import { storyGeneratedRoot } from '../platform/story-storage.js';
import { LEGACY_STORY_SOURCE_DOMAIN } from '../platform/story-source-domain.js';
import { validateStoryAgainstRegisteredDomain } from '../platform/story-domain-revision-safety.js';
import { inspectDurableAuditPath } from './product-access-service.js';
import { rebuildDerivedStoryState } from './derived-story-state-service.js';

const WRITE_ENABLED_ENV = 'STORY_AGENT_DOMAIN_SAFETY_MIGRATION_WRITE_ENABLED';
const AUDIT_JSONL_ENV = 'STORY_AGENT_DOMAIN_SAFETY_MIGRATION_AUDIT_JSONL';

interface InspectedProject {
  item: StoryDomainSafetyMigrationAuditItem;
  meta: StoryProjectMeta | null;
  snapshot: StoryProjectVersionSnapshot | null;
}

function repository(): ProjectRepository {
  return createStoryProjectRepository(resolve(storyGeneratedRoot(), 'projects'));
}

function booleanEnvironment(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

export function storyDomainSafetyMigrationStorySha256(story: StoryGenerateResult): string {
  return createHash('sha256').update(JSON.stringify(story)).digest('hex');
}

function sourceIdentity(
  meta: StoryProjectMeta,
  story: StoryGenerateResult,
): Pick<StoryDomainSafetyMigrationAuditItem, 'source_domain' | 'source_entry' | 'domain_resolution'> {
  const explicitDomain = story.sourceDomain?.trim();
  if (explicitDomain) {
    return {
      source_domain: explicitDomain,
      source_entry: story.source_entry?.trim() || null,
      domain_resolution: 'explicit',
    };
  }
  const metadataDomain = meta.source_domain?.trim();
  if (metadataDomain) {
    return {
      source_domain: metadataDomain,
      source_entry: story.source_entry?.trim() || null,
      domain_resolution: 'project_metadata',
    };
  }
  return {
    source_domain: LEGACY_STORY_SOURCE_DOMAIN,
    source_entry: story.source_entry?.trim() || null,
    domain_resolution: 'legacy_default',
  };
}

function blockedInspection(
  projectId: string,
  meta: StoryProjectMeta | null,
  snapshot: StoryProjectVersionSnapshot | null,
  blockers: string[],
): InspectedProject {
  return {
    meta,
    snapshot,
    item: {
      project_id: projectId,
      current_version_id: meta?.current_version_id ?? null,
      version_count: meta?.version_count ?? 0,
      story_id: snapshot?.story.storyId ?? null,
      story_sha256: snapshot ? storyDomainSafetyMigrationStorySha256(snapshot.story) : null,
      source_domain: snapshot?.story.sourceDomain?.trim() || meta?.source_domain?.trim() || null,
      source_entry: snapshot?.story.source_entry?.trim() || null,
      domain_resolution: snapshot ? sourceIdentity(meta!, snapshot.story).domain_resolution : 'unavailable',
      status: 'blocked',
      blockers: [...new Set(blockers)],
      evaluated_safety: null,
      requires_explicit_apply: false,
      history_overwrite_planned: false,
      writeback_performed: false,
      real_credit_granted: false,
    },
  };
}

async function inspectProject(repo: ProjectRepository, projectId: string): Promise<InspectedProject> {
  let meta: StoryProjectMeta | null;
  let snapshot: StoryProjectVersionSnapshot | null;
  try {
    ({ meta, snapshot } = await repo.inspectCurrentStateReadOnly(projectId));
  } catch {
    return blockedInspection(projectId, null, null, ['project_current_state_unreadable']);
  }
  if (!meta) return blockedInspection(projectId, null, null, ['project_not_found']);
  if (!snapshot) return blockedInspection(projectId, meta, null, ['current_version_missing']);

  const story = snapshot.story;
  const identity = sourceIdentity(meta, story);
  const blockers: string[] = [];
  if (!identity.source_entry) blockers.push('source_entry_missing');
  if (story.sourceDomain?.trim() && meta.source_domain?.trim() && story.sourceDomain.trim() !== meta.source_domain.trim()) {
    blockers.push('story_project_source_domain_conflict');
  }
  if (story.domain_safety) {
    if (!story.domain_safety.passed) blockers.push('existing_domain_safety_failed');
    const migrated = Boolean(story.domain_safety_migration);
    return {
      meta,
      snapshot,
      item: {
        project_id: projectId,
        current_version_id: meta.current_version_id,
        version_count: meta.version_count,
        story_id: story.storyId,
        story_sha256: storyDomainSafetyMigrationStorySha256(story),
        ...identity,
        status: blockers.length > 0 ? 'blocked' : migrated ? 'migrated' : 'already_governed',
        blockers,
        evaluated_safety: story.domain_safety,
        requires_explicit_apply: false,
        history_overwrite_planned: false,
        writeback_performed: false,
        real_credit_granted: false,
      },
    };
  }
  if (blockers.length > 0 || !identity.source_domain || !identity.source_entry) {
    return blockedInspection(projectId, meta, snapshot, blockers);
  }

  let evaluatedSafety;
  try {
    evaluatedSafety = await validateStoryAgainstRegisteredDomain({
      ...story,
      sourceDomain: identity.source_domain,
    });
  } catch {
    return blockedInspection(projectId, meta, snapshot, ['source_domain_unregistered']);
  }
  const validationBlockers = evaluatedSafety.passed
    ? []
    : evaluatedSafety.blockers.map(finding => `domain_safety:${finding.rule_id}`);
  return {
    meta,
    snapshot,
    item: {
      project_id: projectId,
      current_version_id: meta.current_version_id,
      version_count: meta.version_count,
      story_id: story.storyId,
      story_sha256: storyDomainSafetyMigrationStorySha256(story),
      ...identity,
      status: evaluatedSafety.passed ? 'migration_candidate' : 'blocked',
      blockers: validationBlockers,
      evaluated_safety: evaluatedSafety,
      requires_explicit_apply: evaluatedSafety.passed,
      history_overwrite_planned: false,
      writeback_performed: false,
      real_credit_granted: false,
    },
  };
}

export async function getStoryDomainSafetyMigrationAuditReport(): Promise<StoryDomainSafetyMigrationAuditReport> {
  const repo = repository();
  const items: StoryDomainSafetyMigrationAuditItem[] = [];
  for (const projectId of await repo.listProjectIds()) {
    items.push((await inspectProject(repo, projectId)).item);
  }
  const count = (status: StoryDomainSafetyMigrationAuditItem['status']) => (
    items.filter(item => item.status === status).length
  );
  return {
    schema_version: 'story-domain-safety-migration-audit/v1',
    generated_at: new Date().toISOString(),
    read_only: true,
    repository_provider: getStoryProjectRepositoryConfigInfo().active_provider ?? 'invalid',
    discovered_project_count: items.length,
    migration_candidate_count: count('migration_candidate'),
    already_governed_count: count('already_governed'),
    migrated_count: count('migrated'),
    blocked_count: count('blocked'),
    items,
    automatic_source_assignment: false,
    history_overwrite_performed: false,
    writeback_performed: false,
    human_review_complete: false,
    real_credit_granted: false,
  };
}

function nextUpdatedAt(meta: StoryProjectMeta): string {
  const previous = Date.parse(meta.updated_at);
  return new Date(Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : Date.now())).toISOString();
}

function migrationRecordMatches(
  record: StoryDomainSafetyMigrationRecord | undefined,
  request: StoryDomainSafetyMigrationRequest,
): boolean {
  return Boolean(
    record
    && record.migration_id === request.migration_id
    && record.review_reference === request.review_reference
    && record.previous_version_id === request.expected_current_version_id
    && record.previous_story_sha256 === request.expected_story_sha256
    && record.source_domain === request.expected_source_domain
    && record.source_entry === request.expected_source_entry,
  );
}

function appendAuditEvent(
  path: string,
  phase: 'intent' | 'applied',
  request: StoryDomainSafetyMigrationRequest,
  actor: ProductAccessActor,
  source: { domain: string; entry: string; ruleIds: string[] },
  resultingVersionId: string | null,
): boolean {
  try {
    appendFileSync(path, `${JSON.stringify({
      schema_version: 'story-domain-safety-migration-audit-event/v1',
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      phase,
      migration_id: request.migration_id,
      project_id: request.project_id,
      requested_by_actor_id: actor.actor_id,
      requested_by_organization_id: actor.organization_id,
      review_reference: request.review_reference,
      expected_current_version_id: request.expected_current_version_id,
      expected_story_sha256: request.expected_story_sha256,
      source_domain: source.domain,
      source_entry: source.entry,
      evaluated_rule_ids: source.ruleIds,
      resulting_version_id: resultingVersionId,
      automatic_source_assignment: false,
      history_overwrite_performed: false,
      machine_validation_only: true,
      human_review_complete: false,
      real_credit_granted: false,
    })}\n`, { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

export async function migrateStoryDomainSafety(input: {
  request: StoryDomainSafetyMigrationRequest;
  actor: ProductAccessActor;
}): Promise<StoryDomainSafetyMigrationResult> {
  const { request, actor } = input;
  const writeEnabled = booleanEnvironment(WRITE_ENABLED_ENV);
  const repo = repository();
  const inspected = await inspectProject(repo, request.project_id);
  const { item, meta, snapshot } = inspected;
  const base = {
    schema_version: 'story-domain-safety-migration-result/v1' as const,
    evaluated_at: new Date().toISOString(),
    migration_id: request.migration_id,
    project_id: request.project_id,
    requested_by_actor_id: actor.actor_id,
    dry_run: request.dry_run,
    write_enabled: writeEnabled,
    status_before: item.status,
    expected_current_version_id: request.expected_current_version_id,
    actual_current_version_id: item.current_version_id,
    expected_story_sha256: request.expected_story_sha256,
    actual_story_sha256: item.story_sha256,
    source_domain: item.source_domain,
    source_entry: item.source_entry,
    safety_report: item.evaluated_safety,
    automatic_source_assignment: false as const,
    history_overwrite_performed: false as const,
    human_review_complete: false as const,
    real_credit_granted: false as const,
  };
  const replay = snapshot?.story.domain_safety?.passed
    && migrationRecordMatches(snapshot.story.domain_safety_migration, request);
  if (replay) {
    return {
      ...base,
      status_before: 'migrated',
      blockers: [],
      preflight_ready: true,
      applied: false,
      idempotent_replay: true,
      resulting_version_id: snapshot.version_id,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }

  const blockers = [
    ...item.blockers,
    ...(actor.role !== 'administrator' ? ['domain_safety_migration_administrator_required'] : []),
    ...(item.status !== 'migration_candidate' ? ['domain_safety_migration_candidate_required'] : []),
    ...(item.current_version_id !== request.expected_current_version_id ? ['current_version_conflict'] : []),
    ...(item.story_sha256 !== request.expected_story_sha256 ? ['story_sha256_conflict'] : []),
    ...(item.source_domain !== request.expected_source_domain ? ['source_domain_confirmation_mismatch'] : []),
    ...(item.source_entry !== request.expected_source_entry ? ['source_entry_confirmation_mismatch'] : []),
  ];
  const auditPath = process.env[AUDIT_JSONL_ENV]?.trim() ?? '';
  const audit = inspectDurableAuditPath(auditPath);
  if (!request.dry_run) {
    if (!writeEnabled) blockers.push('domain_safety_migration_write_disabled');
    if (!audit.configured) blockers.push('domain_safety_migration_audit_missing');
    else if (!audit.writable) blockers.push(...audit.issues.map(issue => `domain_safety_migration_${issue}`));
  }
  const uniqueBlockers = [...new Set(blockers)];
  if (request.dry_run || uniqueBlockers.length > 0 || !meta || !snapshot || !item.evaluated_safety) {
    return {
      ...base,
      blockers: uniqueBlockers,
      preflight_ready: uniqueBlockers.length === 0,
      applied: false,
      idempotent_replay: false,
      resulting_version_id: null,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }

  const nextVersionId = `${meta.project_id}-v${meta.version_count + 1}`;
  const source = {
    domain: request.expected_source_domain,
    entry: request.expected_source_entry,
    ruleIds: item.evaluated_safety.evaluated_rule_ids,
  };
  const durableIntentWritten = appendAuditEvent(auditPath, 'intent', request, actor, source, null);
  if (!durableIntentWritten) {
    return {
      ...base,
      blockers: ['domain_safety_migration_intent_audit_write_failed'],
      preflight_ready: false,
      applied: false,
      idempotent_replay: false,
      resulting_version_id: null,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }

  const migratedAt = nextUpdatedAt(meta);
  const migrationRecord: StoryDomainSafetyMigrationRecord = {
    schema_version: 'story-domain-safety-migration-record/v1',
    migration_id: request.migration_id,
    migrated_at: migratedAt,
    migrated_by_actor_id: actor.actor_id,
    review_reference: request.review_reference,
    previous_version_id: snapshot.version_id,
    previous_story_sha256: request.expected_story_sha256,
    source_domain: request.expected_source_domain,
    source_entry: request.expected_source_entry,
    source_identity_confirmed_by_operator: true,
    history_overwrite_performed: false,
    machine_validation_only: true,
    human_review_complete: false,
    real_credit_granted: false,
  };
  const storyWithSafety: StoryGenerateResult = {
    ...snapshot.story,
    sourceDomain: request.expected_source_domain,
    current_version_id: nextVersionId,
    domain_safety: item.evaluated_safety,
    domain_safety_migration: migrationRecord,
  };
  const story = await rebuildDerivedStoryState(storyWithSafety, {
    // The exact report was evaluated during migration preflight and is part of
    // the operator-authorized request. Reuse it while rebuilding all derivatives.
    revalidateDomainSafety: false,
  });
  const migratedSnapshot: StoryProjectVersionSnapshot = {
    project_id: meta.project_id,
    version_id: nextVersionId,
    created_at: migratedAt,
    change_type: 'domain_safety_migration',
    scene_ids_changed: [],
    note: `Domain safety migration ${request.migration_id}; ${request.review_reference}`,
    quality_report: story.quality_report,
    story,
  };
  const migratedMeta: StoryProjectMeta = {
    ...meta,
    source_domain: request.expected_source_domain,
    current_version_id: nextVersionId,
    version_count: meta.version_count + 1,
    updated_at: migratedAt,
  };
  try {
    await repo.commitVersion(migratedMeta, migratedSnapshot, {
      current_version_id: meta.current_version_id,
      version_count: meta.version_count,
      updated_at: meta.updated_at,
    });
  } catch (error) {
    if (error instanceof ProjectRepositoryConflictError) {
      return {
        ...base,
        blockers: ['domain_safety_migration_concurrent_project_change'],
        preflight_ready: false,
        applied: false,
        idempotent_replay: false,
        resulting_version_id: null,
        durable_intent_written: true,
        durable_completion_written: false,
      };
    }
    throw error;
  }
  const durableCompletionWritten = appendAuditEvent(
    auditPath,
    'applied',
    request,
    actor,
    source,
    nextVersionId,
  );
  return {
    ...base,
    blockers: durableCompletionWritten ? [] : ['domain_safety_migration_completion_audit_write_failed'],
    preflight_ready: true,
    applied: true,
    idempotent_replay: false,
    resulting_version_id: nextVersionId,
    durable_intent_written: true,
    durable_completion_written: durableCompletionWritten,
  };
}
