import { appendFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Request } from 'express';
import type {
  ProductAccessActor,
  ProductResourceBinding,
  ProductResourceOwnership,
  ProductResourceOwnershipAuditItem,
  ProductResourceOwnershipAuditReport,
  ProductResourceOwnershipMigrationRecord,
  ProductResourceOwnershipMigrationRequest,
  ProductResourceOwnershipMigrationResult,
  ProductResourceType,
} from '@shared/product-access.js';
import {
  getProductAccessReadiness,
  getRegisteredProductResourceBinding,
  inspectDurableAuditPath,
  listRegisteredProductResourceBindings,
  resolveProductAccess,
  validateProductResourceOwnershipAgainstRegistry,
} from './product-access-service.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';

const STORY_PROJECT_ID_PATTERN = /^\d{8}-story-[0-9a-z]+--[a-z_]+$/;
const SERIES_PROJECT_ID_PATTERN = /^\d{8}-series-[0-9a-z]+$/;

export interface ProductResourceResolution {
  binding: ProductResourceBinding | null;
  reason:
    | 'resource_binding_resolved'
    | 'resource_binding_missing'
    | 'resource_binding_conflict'
    | 'resource_binding_metadata_invalid';
}

interface StoredProductResourceInspection {
  resourceExists: boolean;
  ownershipState: 'missing' | 'valid' | 'invalid';
  binding: ProductResourceBinding | null;
}

function generatedRoot(): string {
  return storyGeneratedRoot();
}

function ownershipFromUnknown(value: unknown): ProductResourceOwnership | null {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (
    record?.schema_version !== 'story-agent-product-resource-ownership/v1'
    || typeof record.organization_id !== 'string'
    || !record.organization_id.trim()
    || typeof record.owner_actor_id !== 'string'
    || !record.owner_actor_id.trim()
    || !Array.isArray(record.member_actor_ids)
    || !record.member_actor_ids.every(item => typeof item === 'string' && item.trim())
  ) {
    return null;
  }
  return {
    schema_version: 'story-agent-product-resource-ownership/v1',
    organization_id: record.organization_id.trim(),
    owner_actor_id: record.owner_actor_id.trim(),
    member_actor_ids: [...new Set(record.member_actor_ids.map(item => String(item).trim()))],
  };
}

function resourceMetadataPath(resourceType: ProductResourceType, resourceId: string): string {
  return resourceType === 'story_project'
    ? resolve(generatedRoot(), 'projects', resourceId, 'project.json')
    : resolve(generatedRoot(), 'ai-comic-series-projects', resourceId, 'project.json');
}

async function inspectStoredProductResource(
  resourceType: ProductResourceType,
  resourceId: string,
): Promise<StoredProductResourceInspection> {
  const validId = resourceType === 'story_project'
    ? STORY_PROJECT_ID_PATTERN.test(resourceId)
    : SERIES_PROJECT_ID_PATTERN.test(resourceId);
  if (!validId) return { resourceExists: false, ownershipState: 'missing', binding: null };
  let raw: string;
  try {
    raw = await readFile(resourceMetadataPath(resourceType, resourceId), 'utf8');
  } catch {
    return { resourceExists: false, ownershipState: 'missing', binding: null };
  }
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { resourceExists: true, ownershipState: 'invalid', binding: null };
    }
    parsed = value as Record<string, unknown>;
  } catch {
    return { resourceExists: true, ownershipState: 'invalid', binding: null };
  }
  const accessControl = resourceType === 'story_project'
    ? parsed.access_control
    : (parsed.project as Record<string, unknown> | undefined)?.access_control;
  if (accessControl === undefined) {
    return { resourceExists: true, ownershipState: 'missing', binding: null };
  }
  const ownership = ownershipFromUnknown(accessControl);
  if (!ownership) {
    return { resourceExists: true, ownershipState: 'invalid', binding: null };
  }
  return {
    resourceExists: true,
    ownershipState: 'valid',
    binding: { ...ownership, resource_type: resourceType, resource_id: resourceId },
  };
}

function sameBinding(left: ProductResourceBinding, right: ProductResourceBinding): boolean {
  return left.resource_type === right.resource_type
    && left.resource_id === right.resource_id
    && left.organization_id === right.organization_id
    && left.owner_actor_id === right.owner_actor_id
    && [...left.member_actor_ids].sort().join('\u0000') === [...right.member_actor_ids].sort().join('\u0000');
}

export async function resolveProductResourceBinding(
  resourceType: ProductResourceType,
  resourceId: string,
): Promise<ProductResourceResolution> {
  const registered = getRegisteredProductResourceBinding(resourceType, resourceId);
  const inspection = await inspectStoredProductResource(resourceType, resourceId);
  if (inspection.ownershipState === 'invalid') {
    return { binding: null, reason: 'resource_binding_metadata_invalid' };
  }
  const stored = inspection.binding;
  if (registered && stored && !sameBinding(registered, stored)) {
    return { binding: null, reason: 'resource_binding_conflict' };
  }
  const binding = stored ?? registered;
  return binding
    ? { binding, reason: 'resource_binding_resolved' }
    : { binding: null, reason: 'resource_binding_missing' };
}

async function listStoredProductResourceIds(resourceType: ProductResourceType): Promise<string[]> {
  const directory = resourceType === 'story_project'
    ? resolve(generatedRoot(), 'projects')
    : resolve(generatedRoot(), 'ai-comic-series-projects');
  const pattern = resourceType === 'story_project' ? STORY_PROJECT_ID_PATTERN : SERIES_PROJECT_ID_PATTERN;
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && pattern.test(entry.name))
      .map(entry => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function ownershipFromBinding(binding: ProductResourceBinding | null): ProductResourceOwnership | null {
  if (!binding) return null;
  return {
    schema_version: 'story-agent-product-resource-ownership/v1',
    organization_id: binding.organization_id,
    owner_actor_id: binding.owner_actor_id,
    member_actor_ids: [...binding.member_actor_ids],
  };
}

async function auditResource(
  resourceType: ProductResourceType,
  resourceId: string,
  registered: ProductResourceBinding | null,
): Promise<ProductResourceOwnershipAuditItem> {
  const stored = await inspectStoredProductResource(resourceType, resourceId);
  const base = {
    resource_type: resourceType,
    resource_id: resourceId,
    stored_ownership: ownershipFromBinding(stored.binding),
    registered_ownership: ownershipFromBinding(registered),
    automatic_owner_assignment: false as const,
    writeback_performed: false as const,
  };
  if (!stored.resourceExists) {
    return {
      ...base,
      status: 'orphaned_registry_binding',
      access_enforcement_ready: false,
      migration_action: 'remove_or_restore_orphaned_binding_manually',
      blockers: ['registered_resource_metadata_missing'],
    };
  }
  if (stored.ownershipState === 'invalid') {
    return {
      ...base,
      status: 'invalid_metadata',
      access_enforcement_ready: false,
      migration_action: 'repair_invalid_metadata_manually',
      blockers: ['stored_resource_ownership_invalid'],
    };
  }
  if (stored.binding && registered && !sameBinding(stored.binding, registered)) {
    return {
      ...base,
      status: 'conflict',
      access_enforcement_ready: false,
      migration_action: 'resolve_binding_conflict_manually',
      blockers: ['stored_and_registered_ownership_conflict'],
    };
  }
  if (stored.binding && registered) {
    return {
      ...base,
      status: 'consistent',
      access_enforcement_ready: true,
      migration_action: 'none',
      blockers: [],
    };
  }
  if (stored.binding) {
    return {
      ...base,
      status: 'stored_only',
      access_enforcement_ready: true,
      migration_action: 'none',
      blockers: [],
    };
  }
  if (registered) {
    return {
      ...base,
      status: 'registry_managed_legacy',
      access_enforcement_ready: true,
      migration_action: 'persist_registered_ownership',
      blockers: [],
    };
  }
  return {
    ...base,
    status: 'unbound',
    access_enforcement_ready: false,
    migration_action: 'assign_ownership_manually',
    blockers: ['owner_assignment_required'],
  };
}

export async function getProductResourceOwnershipAuditReport(): Promise<ProductResourceOwnershipAuditReport> {
  const generatedAt = new Date().toISOString();
  const registeredBindings = listRegisteredProductResourceBindings();
  const registeredByKey = new Map(registeredBindings.map(binding => [
    `${binding.resource_type}:${binding.resource_id}`,
    binding,
  ]));
  const keys = new Set<string>(registeredByKey.keys());
  for (const resourceType of ['story_project', 'series_project'] as const) {
    for (const resourceId of await listStoredProductResourceIds(resourceType)) {
      keys.add(`${resourceType}:${resourceId}`);
    }
  }
  const items: ProductResourceOwnershipAuditItem[] = [];
  for (const key of [...keys].sort()) {
    const separator = key.indexOf(':');
    const resourceType = key.slice(0, separator) as ProductResourceType;
    const resourceId = key.slice(separator + 1);
    items.push(await auditResource(resourceType, resourceId, registeredByKey.get(key) ?? null));
  }
  const migrationActions = items.filter(item => item.migration_action !== 'none');
  const accessReadiness = getProductAccessReadiness();
  const statusCount = (status: ProductResourceOwnershipAuditItem['status']): number => (
    items.filter(item => item.status === status).length
  );
  const readyForEnforcedAccess = items.every(item => item.access_enforcement_ready);
  const blockers = [
    ...accessReadiness.blockers,
    ...(statusCount('unbound') ? [`resource_ownership_unbound:${statusCount('unbound')}`] : []),
    ...(statusCount('conflict') ? [`resource_ownership_conflict:${statusCount('conflict')}`] : []),
    ...(statusCount('invalid_metadata') ? [`resource_ownership_metadata_invalid:${statusCount('invalid_metadata')}`] : []),
    ...(statusCount('orphaned_registry_binding') ? [`resource_registry_binding_orphaned:${statusCount('orphaned_registry_binding')}`] : []),
  ];
  return {
    schema_version: 'story-agent-product-resource-ownership-audit/v1',
    generated_at: generatedAt,
    read_only: true,
    discovered_resource_count: items.length,
    access_enforcement_ready_count: items.filter(item => item.access_enforcement_ready).length,
    registry_managed_legacy_count: statusCount('registry_managed_legacy'),
    unbound_count: statusCount('unbound'),
    conflict_count: statusCount('conflict'),
    invalid_metadata_count: statusCount('invalid_metadata'),
    orphaned_registry_binding_count: statusCount('orphaned_registry_binding'),
    ready_for_enforced_access: readyForEnforcedAccess,
    ready_for_production: readyForEnforcedAccess && accessReadiness.ready_for_production && blockers.length === 0,
    blockers: [...new Set(blockers)],
    items,
    migration_manifest: {
      schema_version: 'story-agent-product-resource-ownership-migration-manifest/v1',
      generated_at: generatedAt,
      read_only: true,
      automatic_owner_assignment: false,
      writeback_performed: false,
      action_count: migrationActions.length,
      actions: migrationActions,
      credit_boundary: 'migration audit is machine evidence only and grants no human review, professional pass or signed release credit',
    },
    automatic_owner_assignment: false,
    writeback_performed: false,
    real_credit_granted: false,
  };
}

function booleanEnvironment(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

function sameOwnership(left: ProductResourceOwnership, right: ProductResourceOwnership): boolean {
  return left.organization_id === right.organization_id
    && left.owner_actor_id === right.owner_actor_id
    && [...left.member_actor_ids].sort().join('\u0000') === [...right.member_actor_ids].sort().join('\u0000');
}

function migrationRecordFromUnknown(value: unknown): ProductResourceOwnershipMigrationRecord | null {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (
    record?.schema_version !== 'story-agent-product-resource-ownership-migration-record/v1'
    || typeof record.migration_id !== 'string'
    || typeof record.migrated_at !== 'string'
    || typeof record.migrated_by_actor_id !== 'string'
    || typeof record.review_reference !== 'string'
    || typeof record.previous_metadata_sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(record.previous_metadata_sha256)
    || record.real_credit_granted !== false
  ) {
    return null;
  }
  return record as unknown as ProductResourceOwnershipMigrationRecord;
}

function appendMigrationAudit(
  path: string,
  phase: 'intent' | 'applied',
  input: ProductResourceOwnershipMigrationRequest,
  actor: ProductAccessActor,
  metadataSha256: string,
): boolean {
  try {
    appendFileSync(path, `${JSON.stringify({
      schema_version: 'story-agent-product-resource-ownership-migration-audit-event/v1',
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      phase,
      migration_id: input.migration_id,
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      requested_by_actor_id: actor.actor_id,
      requested_by_organization_id: actor.organization_id,
      review_reference: input.review_reference,
      ownership: input.ownership,
      metadata_sha256: metadataSha256,
      automatic_owner_assignment: false,
      ownership_overwrite_allowed: false,
      real_credit_granted: false,
    })}\n`, { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

function resultBase(
  input: ProductResourceOwnershipMigrationRequest,
  actor: ProductAccessActor,
  writeEnabled: boolean,
): Omit<ProductResourceOwnershipMigrationResult,
  | 'status_before'
  | 'actual_metadata_sha256'
  | 'resulting_metadata_sha256'
  | 'blockers'
  | 'preflight_ready'
  | 'applied'
  | 'idempotent_replay'
  | 'durable_intent_written'
  | 'durable_completion_written'> {
  return {
    schema_version: 'story-agent-product-resource-ownership-migration-result/v1',
    evaluated_at: new Date().toISOString(),
    migration_id: input.migration_id,
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    requested_by_actor_id: actor.actor_id,
    requested_by_organization_id: actor.organization_id,
    dry_run: input.dry_run,
    write_enabled: writeEnabled,
    expected_metadata_sha256: input.expected_metadata_sha256,
    automatic_owner_assignment: false,
    ownership_overwrite_allowed: false,
    real_credit_granted: false,
  };
}

export async function migrateProductResourceOwnership(input: {
  request: ProductResourceOwnershipMigrationRequest;
  actor: ProductAccessActor;
}): Promise<ProductResourceOwnershipMigrationResult> {
  const request = input.request;
  const actor = input.actor;
  const writeEnabled = booleanEnvironment('STORY_AGENT_RESOURCE_MIGRATION_WRITE_ENABLED');
  const base = resultBase(request, actor, writeEnabled);
  const validResourceId = request.resource_type === 'story_project'
    ? STORY_PROJECT_ID_PATTERN.test(request.resource_id)
    : SERIES_PROJECT_ID_PATTERN.test(request.resource_id);
  if (!validResourceId) {
    return {
      ...base,
      status_before: 'unbound',
      actual_metadata_sha256: null,
      resulting_metadata_sha256: null,
      blockers: ['resource_id_invalid'],
      preflight_ready: false,
      applied: false,
      idempotent_replay: false,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }
  const path = resourceMetadataPath(request.resource_type, request.resource_id);
  const registered = getRegisteredProductResourceBinding(request.resource_type, request.resource_id);
  const blockers = [
    ...(actor.role !== 'administrator' ? ['resource_migration_administrator_required'] : []),
    ...(actor.organization_id !== request.ownership.organization_id
      ? ['resource_migration_organization_mismatch']
      : []),
    ...validateProductResourceOwnershipAgainstRegistry(request.ownership),
  ];
  let raw: string;
  let fileMode = 0o600;
  try {
    const [loadedRaw, file] = await Promise.all([
      readFile(path, 'utf8'),
      lstat(path),
    ]);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error('resource_metadata_file_invalid');
    raw = loadedRaw;
    fileMode = file.mode & 0o777;
  } catch {
    return {
      ...base,
      status_before: registered ? 'orphaned_registry_binding' : 'unbound',
      actual_metadata_sha256: null,
      resulting_metadata_sha256: null,
      blockers: [...new Set([...blockers, 'resource_metadata_missing'])],
      preflight_ready: false,
      applied: false,
      idempotent_replay: false,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }
  const actualSha256 = createHash('sha256').update(raw).digest('hex');
  let metadata: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    metadata = parsed as Record<string, unknown>;
  } catch {
    return {
      ...base,
      status_before: 'invalid_metadata',
      actual_metadata_sha256: actualSha256,
      resulting_metadata_sha256: null,
      blockers: [...new Set([...blockers, 'resource_metadata_json_invalid'])],
      preflight_ready: false,
      applied: false,
      idempotent_replay: false,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }
  const projectContainer = request.resource_type === 'story_project'
    ? metadata
    : metadata.project && typeof metadata.project === 'object' && !Array.isArray(metadata.project)
      ? metadata.project as Record<string, unknown>
      : null;
  if (!projectContainer) {
    return {
      ...base,
      status_before: 'invalid_metadata',
      actual_metadata_sha256: actualSha256,
      resulting_metadata_sha256: null,
      blockers: [...new Set([...blockers, 'series_project_metadata_container_invalid'])],
      preflight_ready: false,
      applied: false,
      idempotent_replay: false,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }
  const existingOwnership = ownershipFromUnknown(projectContainer.access_control);
  const existingMigration = migrationRecordFromUnknown(projectContainer.access_control_migration);
  if (
    existingOwnership
    && existingMigration?.migration_id === request.migration_id
    && existingMigration.review_reference === request.review_reference
    && sameOwnership(existingOwnership, request.ownership)
    && blockers.length === 0
  ) {
    return {
      ...base,
      status_before: 'already_migrated',
      actual_metadata_sha256: actualSha256,
      resulting_metadata_sha256: actualSha256,
      blockers: [],
      preflight_ready: true,
      applied: false,
      idempotent_replay: true,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }
  if (projectContainer.access_control !== undefined) {
    blockers.push(existingOwnership
      ? 'resource_ownership_overwrite_forbidden'
      : 'resource_ownership_metadata_invalid');
  }
  if (projectContainer.access_control === undefined && projectContainer.access_control_migration !== undefined) {
    blockers.push('resource_migration_record_without_ownership');
  }
  if (registered) {
    const requestedBinding: ProductResourceBinding = {
      ...request.ownership,
      resource_type: request.resource_type,
      resource_id: request.resource_id,
    };
    if (!sameBinding(registered, requestedBinding)) {
      blockers.push('registered_ownership_mismatch');
    }
  }
  if (actualSha256 !== request.expected_metadata_sha256) {
    blockers.push('resource_metadata_sha256_conflict');
  }
  const statusBefore: ProductResourceOwnershipAuditItem['status'] = projectContainer.access_control !== undefined && !existingOwnership
    ? 'invalid_metadata'
    : existingOwnership
    ? registered && sameBinding(registered, {
      ...existingOwnership,
      resource_type: request.resource_type,
      resource_id: request.resource_id,
    }) ? 'consistent' : registered ? 'conflict' : 'stored_only'
    : registered ? 'registry_managed_legacy' : 'unbound';
  const migrationAuditPath = process.env.STORY_AGENT_RESOURCE_MIGRATION_AUDIT_JSONL?.trim() ?? '';
  const migrationAudit = inspectDurableAuditPath(migrationAuditPath);
  if (!request.dry_run) {
    if (!writeEnabled) blockers.push('resource_migration_write_disabled');
    if (!migrationAudit.configured) blockers.push('resource_migration_audit_missing');
    else if (!migrationAudit.writable) blockers.push(...migrationAudit.issues.map(issue => `resource_migration_${issue}`));
  }
  const uniqueBlockers = [...new Set(blockers)];
  if (request.dry_run || uniqueBlockers.length > 0) {
    return {
      ...base,
      status_before: statusBefore,
      actual_metadata_sha256: actualSha256,
      resulting_metadata_sha256: null,
      blockers: uniqueBlockers,
      preflight_ready: uniqueBlockers.length === 0,
      applied: false,
      idempotent_replay: false,
      durable_intent_written: false,
      durable_completion_written: false,
    };
  }

  const lockPath = `${path}.ownership-migration.lock`;
  let lock: Awaited<ReturnType<typeof open>> | null = null;
  let durableIntentWritten = false;
  let applied = false;
  let resultingSha256: string | null = null;
  let durableCompletionWritten = false;
  try {
    try {
      lock = await open(lockPath, 'wx', 0o600);
    } catch {
      return {
        ...base,
        status_before: statusBefore,
        actual_metadata_sha256: actualSha256,
        resulting_metadata_sha256: null,
        blockers: ['resource_migration_concurrent_operation'],
        preflight_ready: false,
        applied: false,
        idempotent_replay: false,
        durable_intent_written: false,
        durable_completion_written: false,
      };
    }
    const lockedRaw = await readFile(path, 'utf8');
    const lockedSha256 = createHash('sha256').update(lockedRaw).digest('hex');
    if (lockedSha256 !== actualSha256) {
      return {
        ...base,
        status_before: statusBefore,
        actual_metadata_sha256: lockedSha256,
        resulting_metadata_sha256: null,
        blockers: ['resource_metadata_sha256_conflict'],
        preflight_ready: false,
        applied: false,
        idempotent_replay: false,
        durable_intent_written: false,
        durable_completion_written: false,
      };
    }
    durableIntentWritten = appendMigrationAudit(migrationAuditPath, 'intent', request, actor, lockedSha256);
    if (!durableIntentWritten) {
      return {
        ...base,
        status_before: statusBefore,
        actual_metadata_sha256: lockedSha256,
        resulting_metadata_sha256: null,
        blockers: ['resource_migration_intent_audit_write_failed'],
        preflight_ready: false,
        applied: false,
        idempotent_replay: false,
        durable_intent_written: false,
        durable_completion_written: false,
      };
    }
    const migratedAt = new Date().toISOString();
    projectContainer.access_control = { ...request.ownership, member_actor_ids: [...request.ownership.member_actor_ids] };
    projectContainer.access_control_migration = {
      schema_version: 'story-agent-product-resource-ownership-migration-record/v1',
      migration_id: request.migration_id,
      migrated_at: migratedAt,
      migrated_by_actor_id: actor.actor_id,
      review_reference: request.review_reference,
      previous_metadata_sha256: lockedSha256,
      real_credit_granted: false,
    } satisfies ProductResourceOwnershipMigrationRecord;
    const output = `${JSON.stringify(metadata, null, 2)}\n`;
    resultingSha256 = createHash('sha256').update(output).digest('hex');
    const temporary = `${path}.ownership-migration-${process.pid}-${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, output, { encoding: 'utf8', flag: 'wx', mode: fileMode });
      await rename(temporary, path);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
    applied = true;
    durableCompletionWritten = appendMigrationAudit(migrationAuditPath, 'applied', request, actor, resultingSha256);
  } finally {
    if (lock) {
      await lock.close().catch(() => undefined);
      await unlink(lockPath).catch(() => undefined);
    }
  }
  return {
    ...base,
    status_before: statusBefore,
    actual_metadata_sha256: actualSha256,
    resulting_metadata_sha256: resultingSha256,
    blockers: durableCompletionWritten ? [] : ['resource_migration_completion_audit_write_failed'],
    preflight_ready: true,
    applied,
    idempotent_replay: false,
    durable_intent_written: durableIntentWritten,
    durable_completion_written: durableCompletionWritten,
  };
}

export function productResourceOwnershipForActor(actor: ProductAccessActor): ProductResourceOwnership {
  return {
    schema_version: 'story-agent-product-resource-ownership/v1',
    organization_id: actor.organization_id,
    owner_actor_id: actor.actor_id,
    member_actor_ids: [],
  };
}

export async function storyProjectResourceIdsForStoryId(storyId: string): Promise<string[]> {
  if (!/^\d{8}-story-[0-9a-z]+$/.test(storyId)) return [];
  try {
    return (await readdir(resolve(generatedRoot(), 'projects')))
      .filter(projectId => projectId.startsWith(`${storyId}--`) && STORY_PROJECT_ID_PATTERN.test(projectId));
  } catch {
    return [];
  }
}

export function actorCanAccessProductResource(
  actor: ProductAccessActor,
  binding: ProductResourceBinding,
): boolean {
  if (actor.organization_id !== binding.organization_id) return false;
  return actor.role === 'administrator'
    || actor.actor_id === binding.owner_actor_id
    || binding.member_actor_ids.includes(actor.actor_id);
}

export async function filterProductResourcesForRequest<T>(
  req: Request,
  resourceType: ProductResourceType,
  items: readonly T[],
  resourceId: (item: T) => string,
): Promise<T[]> {
  const access = resolveProductAccess(req);
  if (access.mode === 'disabled') return [...items];
  if (!access.actor) return [];
  const filtered: T[] = [];
  for (const item of items) {
    const resolution = await resolveProductResourceBinding(resourceType, resourceId(item));
    if (resolution.binding && actorCanAccessProductResource(access.actor, resolution.binding)) {
      filtered.push(item);
    }
  }
  return filtered;
}
