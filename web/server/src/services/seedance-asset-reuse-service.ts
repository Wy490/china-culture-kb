import type {
  SeedanceAssetBindingItem,
  SeedanceAssetLibraryItem,
  SeedanceAssetReferenceKind,
  SeedanceAssetReuseRequest,
  SeedanceGlobalAssetLibraryItem,
} from '@shared/types.js';
import {
  appendSeedanceAssetHistory,
  seedanceAssetHistoryEvent,
} from './seedance-asset-history-service.js';

export interface SeedanceAssetProjectIdentity {
  project_id: string;
  title: string;
}

export interface SeedanceAssetReuseMaterialization {
  reusedAsset: SeedanceAssetLibraryItem;
  sourceAsset: SeedanceGlobalAssetLibraryItem;
  libraryItems: SeedanceAssetLibraryItem[];
}

export function slugifySeedanceAssetLabel(value: string): string {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii.slice(0, 80);
  return encodeURIComponent(value.trim()).replace(/%/g, '').slice(0, 80) || 'asset';
}

export function seedanceAssetId(kind: SeedanceAssetReferenceKind, label: string): string {
  return `seedance-asset-${kind}-${slugifySeedanceAssetLabel(label)}`;
}

export function seedanceAssetLookupKey(kind: SeedanceAssetReferenceKind, label: string): string {
  return `${kind}:${label.trim().toLowerCase()}`;
}

export function isReusableSeedanceAsset(item: SeedanceAssetLibraryItem): boolean {
  return Boolean(
    item.file_url
    || item.file_id
    || item.local_path
    || item.provider_asset_id
    || item.upload_status === 'uploaded'
    || item.upload_status === 'external'
  );
}

export function toGlobalSeedanceAssetItem(
  project: SeedanceAssetProjectIdentity,
  item: SeedanceAssetLibraryItem,
): SeedanceGlobalAssetLibraryItem {
  return {
    global_asset_id: `${project.project_id}:${item.asset_id}`,
    source_project_id: project.project_id,
    source_project_title: project.title,
    source_asset_id: item.asset_id,
    label: item.label,
    kind: item.kind,
    modality: item.modality,
    role: item.role,
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
    rights_status: item.rights_status,
    human_review_status: item.human_review_status,
    description: item.description,
    updated_at: item.updated_at,
  };
}

export function buildSeedanceGlobalAssetItems(input: {
  currentProjectId: string;
  projects: Array<{
    project: SeedanceAssetProjectIdentity;
    items: SeedanceAssetLibraryItem[];
  }>;
}): SeedanceGlobalAssetLibraryItem[] {
  const items = input.projects
    .filter(entry => entry.project.project_id !== input.currentProjectId)
    .flatMap(entry => entry.items
      .filter(isReusableSeedanceAsset)
      .map(item => toGlobalSeedanceAssetItem(entry.project, item)));
  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    const labelCmp = a.label.localeCompare(b.label, 'zh-CN');
    if (labelCmp !== 0) return labelCmp;
    return b.updated_at.localeCompare(a.updated_at);
  });
  return items;
}

export function buildSeedanceAssetReuseMaterialization(input: {
  request: SeedanceAssetReuseRequest;
  sourceProject: SeedanceAssetProjectIdentity;
  sourceItem: SeedanceAssetLibraryItem;
  targetItems: SeedanceAssetLibraryItem[];
  reportAssets: SeedanceAssetBindingItem[];
  updatedAt: string;
  historyEventId: string;
}): SeedanceAssetReuseMaterialization {
  const reportById = new Map(input.reportAssets.map(item => [item.asset_id, item]));
  const reportByKey = new Map(input.reportAssets.map(item => [
    seedanceAssetLookupKey(item.kind, item.label),
    item,
  ]));
  const targetKind = input.request.target_kind ?? input.sourceItem.kind;
  const targetLabel = input.request.target_label?.trim() || input.sourceItem.label;
  const reportMatch = input.request.target_asset_id
    ? reportById.get(input.request.target_asset_id)
    : reportByKey.get(seedanceAssetLookupKey(targetKind, targetLabel));
  const targetAssetId = input.request.target_asset_id?.trim()
    || reportMatch?.asset_id
    || seedanceAssetId(targetKind, targetLabel);
  const byId = new Map(input.targetItems.map(item => [item.asset_id, item]));
  const existing = byId.get(targetAssetId);
  const reusedAsset: SeedanceAssetLibraryItem = {
    asset_id: targetAssetId,
    kind: targetKind,
    label: targetLabel,
    modality: existing?.modality ?? reportMatch?.modality ?? input.sourceItem.modality,
    role: existing?.role ?? reportMatch?.role ?? input.sourceItem.role,
    reference_slot: input.request.reference_slot?.trim()
      || existing?.reference_slot
      || reportMatch?.reference_slot
      || input.sourceItem.reference_slot,
    file_url: input.sourceItem.file_url,
    file_id: input.sourceItem.file_id,
    local_path: input.sourceItem.local_path,
    original_filename: input.sourceItem.original_filename,
    mime_type: input.sourceItem.mime_type,
    size_bytes: input.sourceItem.size_bytes,
    provider: input.sourceItem.provider,
    provider_asset_id: input.sourceItem.provider_asset_id,
    upload_status: input.sourceItem.upload_status ?? 'external',
    upload_error: undefined,
    content_sha256: input.sourceItem.content_sha256,
    prompt_sha256: input.sourceItem.prompt_sha256,
    model: input.sourceItem.model,
    rights_status: input.sourceItem.rights_status,
    authorization_reference: input.sourceItem.authorization_reference,
    person_consent_reference: input.sourceItem.person_consent_reference,
    human_review_status: input.sourceItem.human_review_status,
    reviewer_id: input.sourceItem.reviewer_id,
    reviewed_at: input.sourceItem.reviewed_at,
    review_note: input.sourceItem.review_note,
    description: input.request.description?.trim()
      || existing?.description
      || reportMatch?.prompt_usage
      || input.sourceItem.description,
    updated_at: input.updatedAt,
  };
  const reusedAssetWithHistory: SeedanceAssetLibraryItem = {
    ...reusedAsset,
    history: appendSeedanceAssetHistory(existing, seedanceAssetHistoryEvent({
      asset: reusedAsset,
      eventType: 'cross_project_reuse',
      createdAt: input.updatedAt,
      eventId: input.historyEventId,
      sourceProject: input.sourceProject,
      sourceAssetId: input.sourceItem.asset_id,
      note: `复用自 ${input.sourceProject.title}`,
    })),
  };
  byId.set(targetAssetId, reusedAssetWithHistory);
  return {
    reusedAsset: reusedAssetWithHistory,
    sourceAsset: toGlobalSeedanceAssetItem(input.sourceProject, input.sourceItem),
    libraryItems: [...byId.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.label.localeCompare(b.label, 'zh-CN');
    }),
  };
}
