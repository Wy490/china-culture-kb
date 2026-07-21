import { randomUUID } from 'node:crypto';
import type {
  SeedanceAssetHistoryEvent,
  SeedanceAssetHistoryEventType,
  SeedanceAssetLibraryItem,
  StoryProjectMeta,
} from '@shared/types.js';

const SEEDANCE_ASSET_HISTORY_LIMIT = 25;

export function seedanceAssetHistoryEventId(
  createdAt: string,
  randomPart: string,
): string {
  const timestamp = createdAt.replace(/[^0-9]/g, '').slice(0, 14);
  const suffix = randomPart.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'event';
  return `seedance-asset-event-${timestamp}-${suffix}`;
}

export function normalizeSeedanceAssetHistory(
  history?: SeedanceAssetHistoryEvent[],
): SeedanceAssetHistoryEvent[] | undefined {
  const events = (history ?? [])
    .filter(event => event.event_id?.trim() && event.event_type && event.created_at)
    .map(event => ({
      event_id: event.event_id.trim(),
      event_type: event.event_type,
      created_at: event.created_at,
      upload_status: event.upload_status,
      provider: event.provider,
      provider_asset_id: event.provider_asset_id,
      file_url: event.file_url,
      file_id: event.file_id,
      local_path: event.local_path,
      original_filename: event.original_filename,
      mime_type: event.mime_type,
      size_bytes: event.size_bytes,
      content_sha256: event.content_sha256,
      rights_status: event.rights_status,
      authorization_reference: event.authorization_reference,
      person_consent_reference: event.person_consent_reference,
      human_review_status: event.human_review_status,
      reviewer_id: event.reviewer_id,
      reviewed_at: event.reviewed_at,
      source_project_id: event.source_project_id,
      source_project_title: event.source_project_title,
      source_asset_id: event.source_asset_id,
      note: event.note,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-SEEDANCE_ASSET_HISTORY_LIMIT);
  return events.length ? events : undefined;
}

export function seedanceAssetHistoryEvent(params: {
  asset: SeedanceAssetLibraryItem;
  eventType: SeedanceAssetHistoryEventType;
  createdAt: string;
  eventId?: string;
  note?: string;
  sourceProject?: Pick<StoryProjectMeta, 'project_id' | 'title'>;
  sourceAssetId?: string;
}): SeedanceAssetHistoryEvent {
  return {
    event_id: params.eventId
      ?? seedanceAssetHistoryEventId(params.createdAt, randomUUID().slice(0, 8)),
    event_type: params.eventType,
    created_at: params.createdAt,
    upload_status: params.asset.upload_status,
    provider: params.asset.provider,
    provider_asset_id: params.asset.provider_asset_id,
    file_url: params.asset.file_url,
    file_id: params.asset.file_id,
    local_path: params.asset.local_path,
    original_filename: params.asset.original_filename,
    mime_type: params.asset.mime_type,
    size_bytes: params.asset.size_bytes,
    content_sha256: params.asset.content_sha256,
    rights_status: params.asset.rights_status,
    authorization_reference: params.asset.authorization_reference,
    person_consent_reference: params.asset.person_consent_reference,
    human_review_status: params.asset.human_review_status,
    reviewer_id: params.asset.reviewer_id,
    reviewed_at: params.asset.reviewed_at,
    source_project_id: params.sourceProject?.project_id,
    source_project_title: params.sourceProject?.title,
    source_asset_id: params.sourceAssetId,
    note: params.note,
  };
}

export function appendSeedanceAssetHistory(
  previous: SeedanceAssetLibraryItem | undefined,
  event: SeedanceAssetHistoryEvent,
): SeedanceAssetHistoryEvent[] {
  return [...(normalizeSeedanceAssetHistory(previous?.history) ?? []), event]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-SEEDANCE_ASSET_HISTORY_LIMIT);
}
