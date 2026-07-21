import type {
  AssetIngestReport,
  SeedanceAssetBindingItem,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
} from '@shared/types.js';
import {
  appendSeedanceAssetHistory,
  seedanceAssetHistoryEvent,
} from './seedance-asset-history-service.js';
import {
  defaultSeedanceAssetModality,
  defaultSeedanceAssetRole,
  normalizeSeedanceAssetLibrary,
  sortSeedanceAssetLibraryItems,
} from './seedance-asset-library-service.js';
import {
  seedanceAssetId,
  seedanceAssetLookupKey,
} from './seedance-asset-reuse-service.js';

export interface SeedanceAssetUploadTargetRequest {
  asset_id?: string;
  label?: string;
  kind?: SeedanceAssetLibraryItem['kind'];
  modality?: SeedanceAssetLibraryItem['modality'];
  role?: SeedanceAssetLibraryItem['role'];
  reference_slot?: string;
  description?: string;
}

export interface SeedanceAssetUploadTarget {
  assetId: string;
  kind: SeedanceAssetLibraryItem['kind'];
  label: string;
  modality: SeedanceAssetLibraryItem['modality'];
  existing?: SeedanceAssetLibraryItem;
  reportMatch?: SeedanceAssetBindingItem;
}

export interface SeedanceAssetUploadFilePlan {
  fileId: string;
  filename: string;
  localPath: string;
  previewUrl: string;
}

export function resolveSeedanceAssetUploadTarget(input: {
  library?: SeedanceAssetLibrary;
  reportAssets: SeedanceAssetBindingItem[];
  request: SeedanceAssetUploadTargetRequest;
}): SeedanceAssetUploadTarget | undefined {
  const current = normalizeSeedanceAssetLibrary(input.library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const reportById = new Map(input.reportAssets.map(item => [item.asset_id, item]));
  const reportByKey = new Map(input.reportAssets.map(item => [
    seedanceAssetLookupKey(item.kind, item.label),
    item,
  ]));
  const label = input.request.label?.trim();
  const kind = input.request.kind;
  const directAssetId = input.request.asset_id?.trim();
  const reportMatch = directAssetId
    ? reportById.get(directAssetId)
    : kind && label
      ? reportByKey.get(seedanceAssetLookupKey(kind, label))
      : undefined;
  const previous = directAssetId ? byId.get(directAssetId) : undefined;
  const resolvedKind = kind ?? reportMatch?.kind ?? previous?.kind;
  const resolvedLabel = label || reportMatch?.label || previous?.label;
  const assetId = directAssetId || reportMatch?.asset_id || (
    resolvedKind && resolvedLabel ? seedanceAssetId(resolvedKind, resolvedLabel) : undefined
  );
  if (!assetId || !resolvedKind || !resolvedLabel) return undefined;
  const existing = byId.get(assetId);
  return {
    assetId,
    kind: resolvedKind,
    label: resolvedLabel,
    modality: input.request.modality
      ?? existing?.modality
      ?? reportMatch?.modality
      ?? defaultSeedanceAssetModality(resolvedKind),
    existing,
    reportMatch,
  };
}

export function buildSeedanceAssetUploadFilePlan(input: {
  projectId: string;
  ingest: AssetIngestReport;
}): SeedanceAssetUploadFilePlan {
  const fileId = `media-${input.ingest.content_sha256}`;
  const filename = `${input.ingest.content_sha256}${input.ingest.canonical_extension}`;
  return {
    fileId,
    filename,
    localPath: `projects/${input.projectId}/media/originals/${filename}`,
    previewUrl: `/api/projects/${input.projectId}/production-board/media-assets/media-sha256-${input.ingest.content_sha256}/preview`,
  };
}

export function buildSeedanceAssetUploadMaterialization(input: {
  library?: SeedanceAssetLibrary;
  target: SeedanceAssetUploadTarget;
  request: SeedanceAssetUploadTargetRequest & { originalFilename: string };
  ingest: AssetIngestReport;
  plan: SeedanceAssetUploadFilePlan;
  updatedAt: string;
  historyEventId: string;
}): {
  asset: SeedanceAssetLibraryItem;
  library: SeedanceAssetLibrary;
} {
  const current = normalizeSeedanceAssetLibrary(input.library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const existing = byId.get(input.target.assetId) ?? input.target.existing;
  const asset: SeedanceAssetLibraryItem = {
    asset_id: input.target.assetId,
    kind: input.target.kind,
    label: input.target.label,
    modality: input.target.modality,
    role: input.request.role
      ?? existing?.role
      ?? input.target.reportMatch?.role
      ?? defaultSeedanceAssetRole(input.target.kind),
    reference_slot: input.request.reference_slot?.trim()
      || existing?.reference_slot
      || input.target.reportMatch?.reference_slot,
    file_id: input.plan.fileId,
    local_path: input.plan.localPath,
    original_filename: input.request.originalFilename,
    mime_type: input.ingest.detected_mime_type,
    size_bytes: input.ingest.byte_size,
    content_sha256: input.ingest.content_sha256,
    rights_status: 'pending',
    human_review_status: 'pending',
    provider: 'local_upload',
    provider_asset_id: input.plan.fileId,
    upload_status: 'uploaded',
    upload_error: undefined,
    description: input.request.description?.trim()
      || existing?.description
      || input.target.reportMatch?.prompt_usage,
    updated_at: input.updatedAt,
  };
  const assetWithHistory: SeedanceAssetLibraryItem = {
    ...asset,
    history: appendSeedanceAssetHistory(existing, seedanceAssetHistoryEvent({
      asset,
      eventType: 'file_upload',
      createdAt: input.updatedAt,
      eventId: input.historyEventId,
      note: input.request.originalFilename,
    })),
  };
  byId.set(input.target.assetId, assetWithHistory);
  return {
    asset: assetWithHistory,
    library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: input.updatedAt,
      items: sortSeedanceAssetLibraryItems(byId.values()),
    },
  };
}
