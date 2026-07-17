import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type {
  GearsWorkbenchImportAuditEvent,
  GearsWorkbenchImportAuditLedger,
  GearsWorkbenchImportAuditReceipt,
  GearsWorkbenchImportResult,
} from '@shared/types.js';
import { FileJobRepository } from '../repositories/job-repository.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';

function generatedRoot(): string {
  return storyGeneratedRoot();
}

function auditRoot(): string {
  return resolve(generatedRoot(), 'gears-workbench-import-audit');
}

function auditFileName(projectId: string): string {
  const projectHash = createHash('sha256').update(projectId).digest('hex').slice(0, 24);
  return `project-${projectHash}.jsonl`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAuditEvent(value: unknown): GearsWorkbenchImportAuditEvent | undefined {
  if (!isRecord(value)
    || value.schema_version !== 'gears-workbench-import-audit-event/v1'
    || typeof value.audit_event_id !== 'string'
    || typeof value.project_id !== 'string'
    || typeof value.story_id !== 'string'
    || typeof value.version_id !== 'string'
    || typeof value.source_domain !== 'string'
    || (value.mode !== 'dry_run' && value.mode !== 'execute')
    || !['planned', 'blocked', 'applied'].includes(String(value.status))
    || typeof value.idempotency_key !== 'string'
    || typeof value.replayed !== 'boolean'
    || typeof value.payload_sha256 !== 'string'
    || typeof value.recorded_at !== 'string'
    || value.provider_call_count !== 0
    || value.media_artifact_count !== 0
    || value.real_delivery_credit_count !== 0
    || value.separate_from_execution_worker_ledger !== true
    || value.counts_as_real_gears_seedance_delivery !== false) return undefined;
  const countFields = [
    'entity_count',
    'create_count',
    'update_count',
    'reuse_count',
    'blocked_count',
    'storyboard_draft_count',
  ];
  if (countFields.some(field => !Number.isSafeInteger(value[field]) || Number(value[field]) < 0)) {
    return undefined;
  }
  if (value.import_id !== undefined && typeof value.import_id !== 'string') return undefined;
  return value as unknown as GearsWorkbenchImportAuditEvent;
}

function repository(projectId: string): FileJobRepository<GearsWorkbenchImportAuditEvent> {
  return new FileJobRepository(auditRoot(), auditFileName(projectId), {
    normalize_item: normalizeAuditEvent,
    item_id: event => event.audit_event_id,
  });
}

export async function appendGearsWorkbenchImportAudit(
  result: GearsWorkbenchImportResult,
): Promise<GearsWorkbenchImportAuditReceipt> {
  const recordedAt = new Date().toISOString();
  const event: GearsWorkbenchImportAuditEvent = {
    schema_version: 'gears-workbench-import-audit-event/v1',
    audit_event_id: randomUUID(),
    project_id: result.source.project_id,
    story_id: result.source.story_id,
    version_id: result.source.version_id,
    source_domain: result.source.source_domain,
    mode: result.mode,
    status: result.status,
    ...(result.import_id ? { import_id: result.import_id } : {}),
    idempotency_key: result.idempotency_key,
    replayed: result.replayed,
    payload_sha256: result.payload_sha256,
    entity_count: result.summary.entity_count,
    create_count: result.summary.create_count,
    update_count: result.summary.update_count,
    reuse_count: result.summary.reuse_count,
    blocked_count: result.summary.blocked_count,
    storyboard_draft_count: result.summary.storyboard_draft_count,
    provider_call_count: 0,
    media_artifact_count: 0,
    real_delivery_credit_count: 0,
    separate_from_execution_worker_ledger: true,
    counts_as_real_gears_seedance_delivery: false,
    recorded_at: recordedAt,
  };
  const appended = await repository(result.source.project_id).append(event);
  const snapshot = await repository(result.source.project_id).read();
  return {
    schema_version: 'gears-workbench-import-audit-receipt/v1',
    audit_event_id: appended.item.audit_event_id,
    ledger_revision: appended.revision,
    ledger_event_count: snapshot.items.length,
    recorded_at: recordedAt,
    separate_from_execution_worker_ledger: true,
    counts_as_real_gears_seedance_delivery: false,
  };
}

export async function getGearsWorkbenchImportAudit(
  projectId: string,
): Promise<GearsWorkbenchImportAuditLedger> {
  const snapshot = await repository(projectId).read();
  return {
    schema_version: 'gears-workbench-import-audit-ledger/v1',
    project_id: projectId,
    ledger_revision: snapshot.revision,
    ledger_event_count: snapshot.items.length,
    separate_from_execution_worker_ledger: true,
    real_delivery_credit_count: 0,
    items: snapshot.items.slice().reverse(),
  };
}
