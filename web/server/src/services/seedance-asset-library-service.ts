import type {
  SeedanceAssetBatchImportRequest,
  SeedanceAssetBatchImportResult,
  SeedanceAssetBindingItem,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
  SeedanceAssetLibraryUpdateRequest,
} from '@shared/types.js';
import {
  appendSeedanceAssetHistory,
  normalizeSeedanceAssetHistory,
  seedanceAssetHistoryEvent,
} from './seedance-asset-history-service.js';
import {
  seedanceAssetId,
  seedanceAssetLookupKey,
} from './seedance-asset-reuse-service.js';

export interface SeedanceAssetBatchImportBuildResult {
  library: SeedanceAssetLibrary;
  importedCount: number;
  matchedExistingCount: number;
  skippedItems: SeedanceAssetBatchImportResult['skipped_items'];
  updatedAssetIds: string[];
}

export function defaultSeedanceAssetModality(
  kind: SeedanceAssetLibraryItem['kind'],
): SeedanceAssetLibraryItem['modality'] {
  if (kind === 'audio') return 'audio';
  if (kind === 'camera') return 'video';
  return 'image';
}

export function defaultSeedanceAssetRole(
  kind: SeedanceAssetLibraryItem['kind'],
): SeedanceAssetLibraryItem['role'] {
  if (kind === 'character') return 'character_reference';
  if (kind === 'location') return 'location_reference';
  if (kind === 'prop') return 'prop_reference';
  if (kind === 'camera') return 'camera_reference';
  return 'sound_reference';
}

export function normalizeSeedanceAssetLibrary(library?: SeedanceAssetLibrary): SeedanceAssetLibrary {
  return {
    schema_version: 'seedance-asset-library/v1',
    updated_at: library?.updated_at,
    items: (library?.items ?? [])
      .filter(item => item.label?.trim())
      .map(item => ({
        asset_id: item.asset_id || seedanceAssetId(item.kind, item.label),
        kind: item.kind,
        label: item.label.trim(),
        modality: item.modality ?? defaultSeedanceAssetModality(item.kind),
        role: item.role ?? defaultSeedanceAssetRole(item.kind),
        reference_slot: item.reference_slot,
        file_url: item.file_url,
        file_id: item.file_id,
        local_path: item.local_path,
        original_filename: item.original_filename,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        provider: item.provider,
        provider_asset_id: item.provider_asset_id,
        upload_status: item.upload_status,
        upload_error: item.upload_error,
        content_sha256: item.content_sha256,
        prompt_sha256: item.prompt_sha256,
        model: item.model,
        rights_status: item.rights_status,
        authorization_reference: item.authorization_reference,
        person_consent_reference: item.person_consent_reference,
        human_review_status: item.human_review_status,
        reviewer_id: item.reviewer_id,
        reviewed_at: item.reviewed_at,
        review_note: item.review_note,
        history: normalizeSeedanceAssetHistory(item.history),
        description: item.description,
        updated_at: item.updated_at ?? library?.updated_at ?? new Date(0).toISOString(),
      })),
  };
}

export function sortSeedanceAssetLibraryItems(
  items: Iterable<SeedanceAssetLibraryItem>,
): SeedanceAssetLibraryItem[] {
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.label.localeCompare(b.label, 'zh-CN');
  });
}

function requiredHistoryEventId(ids: string[], index: number): string {
  const eventId = ids[index]?.trim();
  if (!eventId) throw new Error(`Missing Seedance asset history event id for item ${index}`);
  return eventId;
}

export function buildSeedanceAssetLibraryUpdate(input: {
  library?: SeedanceAssetLibrary;
  request: SeedanceAssetLibraryUpdateRequest;
  updatedAt: string;
  historyEventIds: string[];
}): SeedanceAssetLibrary {
  const current = normalizeSeedanceAssetLibrary(input.library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  input.request.items.forEach((item, index) => {
    const label = item.label.trim();
    const kind = item.kind;
    const assetId = item.asset_id?.trim() || seedanceAssetId(kind, label);
    const previous = byId.get(assetId);
    const asset: SeedanceAssetLibraryItem = {
      asset_id: assetId,
      kind,
      label,
      modality: item.modality ?? previous?.modality ?? defaultSeedanceAssetModality(kind),
      role: item.role ?? previous?.role ?? defaultSeedanceAssetRole(kind),
      reference_slot: item.reference_slot?.trim() || previous?.reference_slot,
      file_url: item.file_url?.trim() || previous?.file_url,
      file_id: item.file_id?.trim() || previous?.file_id,
      local_path: item.local_path?.trim() || previous?.local_path,
      original_filename: item.original_filename?.trim() || previous?.original_filename,
      mime_type: item.mime_type?.trim() || previous?.mime_type,
      size_bytes: item.size_bytes ?? previous?.size_bytes,
      provider: item.provider?.trim() || previous?.provider,
      provider_asset_id: item.provider_asset_id?.trim() || previous?.provider_asset_id,
      upload_status: item.upload_status ?? previous?.upload_status,
      upload_error: item.upload_error?.trim() || previous?.upload_error,
      content_sha256: previous?.content_sha256,
      prompt_sha256: previous?.prompt_sha256,
      model: previous?.model,
      rights_status: previous?.rights_status,
      authorization_reference: previous?.authorization_reference,
      person_consent_reference: previous?.person_consent_reference,
      human_review_status: previous?.human_review_status,
      reviewer_id: previous?.reviewer_id,
      reviewed_at: previous?.reviewed_at,
      review_note: previous?.review_note,
      description: item.description?.trim() || previous?.description,
      updated_at: input.updatedAt,
    };
    byId.set(assetId, {
      ...asset,
      history: appendSeedanceAssetHistory(previous, seedanceAssetHistoryEvent({
        asset,
        eventType: 'manual_bind',
        createdAt: input.updatedAt,
        eventId: requiredHistoryEventId(input.historyEventIds, index),
        note: item.description?.trim() || '前端手动绑定素材',
      })),
    });
  });
  return {
    schema_version: 'seedance-asset-library/v1',
    updated_at: input.updatedAt,
    items: sortSeedanceAssetLibraryItems(byId.values()),
  };
}

export function buildSeedanceAssetBatchImport(input: {
  library?: SeedanceAssetLibrary;
  request: SeedanceAssetBatchImportRequest;
  reportAssets: SeedanceAssetBindingItem[];
  updatedAt: string;
  historyEventIds: string[];
}): SeedanceAssetBatchImportBuildResult {
  const current = normalizeSeedanceAssetLibrary(input.library);
  const byId = new Map(current.items.map(item => [item.asset_id, item]));
  const reportById = new Map(input.reportAssets.map(item => [item.asset_id, item]));
  const reportByKey = new Map(input.reportAssets.map(item => [
    seedanceAssetLookupKey(item.kind, item.label),
    item,
  ]));
  const skippedItems: SeedanceAssetBatchImportResult['skipped_items'] = [];
  const importedAssetIds: string[] = [];
  let matchedExistingCount = 0;

  input.request.items.forEach((item, index) => {
    const label = item.label?.trim();
    const kind = item.kind;
    const directAssetId = item.asset_id?.trim();
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
    if (!assetId || !resolvedKind || !resolvedLabel) {
      skippedItems.push({
        index,
        reason: '缺少 asset_id，或缺少可推断的 label+kind',
        asset_id: directAssetId,
        label,
      });
      return;
    }
    const hasImportValue = Boolean(
      item.file_url?.trim()
      || item.file_id?.trim()
      || item.local_path?.trim()
      || item.provider_asset_id?.trim()
      || item.upload_status
    );
    if (!hasImportValue) {
      skippedItems.push({
        index,
        reason: '缺少 file_url、file_id、local_path、provider_asset_id 或 upload_status',
        asset_id: assetId,
        label: resolvedLabel,
      });
      return;
    }

    const existing = byId.get(assetId);
    if (existing || reportMatch) matchedExistingCount += 1;
    const asset: SeedanceAssetLibraryItem = {
      asset_id: assetId,
      kind: resolvedKind,
      label: resolvedLabel,
      modality: item.modality
        ?? existing?.modality
        ?? reportMatch?.modality
        ?? defaultSeedanceAssetModality(resolvedKind),
      role: item.role
        ?? existing?.role
        ?? reportMatch?.role
        ?? defaultSeedanceAssetRole(resolvedKind),
      reference_slot: item.reference_slot?.trim()
        || existing?.reference_slot
        || reportMatch?.reference_slot,
      file_url: item.file_url?.trim() || existing?.file_url,
      file_id: item.file_id?.trim() || existing?.file_id,
      local_path: item.local_path?.trim() || existing?.local_path,
      original_filename: item.original_filename?.trim() || existing?.original_filename,
      mime_type: item.mime_type?.trim() || existing?.mime_type,
      size_bytes: item.size_bytes ?? existing?.size_bytes,
      provider: item.provider?.trim() || existing?.provider,
      provider_asset_id: item.provider_asset_id?.trim() || existing?.provider_asset_id,
      upload_status: item.upload_status ?? existing?.upload_status,
      upload_error: item.upload_error?.trim() || existing?.upload_error,
      content_sha256: existing?.content_sha256,
      prompt_sha256: existing?.prompt_sha256,
      model: existing?.model,
      rights_status: existing?.rights_status,
      authorization_reference: existing?.authorization_reference,
      person_consent_reference: existing?.person_consent_reference,
      human_review_status: existing?.human_review_status,
      reviewer_id: existing?.reviewer_id,
      reviewed_at: existing?.reviewed_at,
      review_note: existing?.review_note,
      description: item.description?.trim() || existing?.description || reportMatch?.prompt_usage,
      updated_at: input.updatedAt,
    };
    byId.set(assetId, {
      ...asset,
      history: appendSeedanceAssetHistory(existing, seedanceAssetHistoryEvent({
        asset,
        eventType: 'batch_import',
        createdAt: input.updatedAt,
        eventId: requiredHistoryEventId(input.historyEventIds, index),
        note: input.request.source_note ?? item.description?.trim() ?? '批量导入素材清单',
      })),
    });
    importedAssetIds.push(assetId);
  });

  return {
    library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: input.updatedAt,
      items: sortSeedanceAssetLibraryItems(byId.values()),
    },
    importedCount: importedAssetIds.length,
    matchedExistingCount,
    skippedItems,
    updatedAssetIds: [...new Set(importedAssetIds)],
  };
}
