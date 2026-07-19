import { createHash } from 'node:crypto';
import type {
  AssetBinding,
  AssetBindingStatus,
  MediaArtifact,
  MediaArtifactHumanReviewStatus,
  MediaArtifactRightsStatus,
  MediaArtifactSourceKind,
  MediaAssetLibrary,
  SeedanceAssetBindingItem,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
} from '@shared/types.js';

export function buildMediaAssetLibrary(input: {
  project_id: string;
  story_id: string;
  source_version_id?: string;
  generated_at: string;
  seedance_asset_library?: SeedanceAssetLibrary;
  seedance_bindings: SeedanceAssetBindingItem[];
}): MediaAssetLibrary {
  const legacyItems = input.seedance_asset_library?.items ?? [];
  const byId = new Map(legacyItems.map(item => [item.asset_id, item]));
  const byKey = new Map(legacyItems.map(item => [assetLookupKey(item.kind, item.label), item]));
  const artifacts = new Map<string, MediaArtifact>();
  const bindings: AssetBinding[] = input.seedance_bindings.map(binding => {
    const item = byId.get(binding.asset_id) ?? byKey.get(assetLookupKey(binding.kind, binding.label));
    const artifact = binding.is_bound ? buildMediaArtifact(input, binding, item) : undefined;
    if (artifact && !artifacts.has(artifact.artifact_id)) artifacts.set(artifact.artifact_id, artifact);
    return buildAssetBinding(input, binding, item, artifact);
  });
  const artifactList = [...artifacts.values()].sort((a, b) => a.artifact_id.localeCompare(b.artifact_id));
  const migratedWithoutCreditCount = bindings.filter(binding => (
    binding.artifact_id !== null && !binding.production_credit_granted
  )).length;

  return {
    schema_version: 'media-asset-library/v1',
    project_id: input.project_id,
    story_id: input.story_id,
    source_version_id: input.source_version_id,
    generated_at: input.generated_at,
    artifacts: artifactList,
    bindings: bindings.sort((a, b) => a.asset_id.localeCompare(b.asset_id)),
    summary: {
      artifact_count: artifactList.length,
      binding_count: bindings.length,
      verified_artifact_count: artifactList.filter(artifact => artifact.integrity_status === 'verified').length,
      placeholder_artifact_count: artifactList.filter(artifact => artifact.placeholder).length,
      production_credit_binding_count: bindings.filter(binding => binding.production_credit_granted).length,
      legacy_unverified_artifact_count: artifactList.filter(artifact => artifact.integrity_status === 'unverified').length,
      missing_artifact_binding_count: bindings.filter(binding => binding.status === 'missing_artifact').length,
    },
    migration: {
      source_schema_version: 'seedance-asset-library/v1',
      legacy_item_count: legacyItems.length,
      migrated_without_credit_count: migratedWithoutCreditCount,
    },
  };
}

function buildMediaArtifact(
  input: Parameters<typeof buildMediaAssetLibrary>[0],
  binding: SeedanceAssetBindingItem,
  item?: SeedanceAssetLibraryItem,
): MediaArtifact {
  const contentSha256 = validSha256(item?.content_sha256) ? item!.content_sha256!.toLowerCase() : null;
  const placeholder = Boolean(binding.is_placeholder) || isPlaceholder(item, binding);
  const rightsStatus = item?.rights_status ?? 'pending';
  const humanReviewStatus = item?.human_review_status ?? 'pending';
  const integrityStatus: MediaArtifact['integrity_status'] = contentSha256 ? 'verified' : 'unverified';
  const productionCredit = integrityStatus === 'verified'
    && rightsStatus === 'authorized'
    && humanReviewStatus === 'approved'
    && !placeholder;
  const artifactId = contentSha256
    ? `media-sha256-${contentSha256}`
    : `media-legacy-${stableDigest([
        input.project_id,
        binding.asset_id,
        item?.file_id,
        item?.local_path,
        item?.file_url,
        item?.provider_asset_id,
      ]).slice(0, 32)}`;
  const sourceKind = mediaSourceKind(item, placeholder);

  return {
    schema_version: 'media-artifact/v1',
    artifact_id: artifactId,
    version_id: `${artifactId}-v1`,
    modality: binding.modality,
    mime_type: item?.mime_type ?? binding.mime_type,
    size_bytes: item?.size_bytes ?? binding.size_bytes,
    content_sha256: contentSha256,
    integrity_status: integrityStatus,
    storage: mediaStorage(item, binding, contentSha256, input.project_id, artifactId),
    provenance: {
      source_kind: sourceKind,
      provider: item?.provider ?? binding.provider,
      model: item?.model,
      prompt_sha256: validSha256(item?.prompt_sha256) ? item?.prompt_sha256?.toLowerCase() : undefined,
      source_project_id: input.project_id,
      source_story_id: input.story_id,
      source_version_id: input.source_version_id,
      source_asset_id: binding.asset_id,
      created_at: item?.updated_at ?? input.generated_at,
    },
    rights: {
      status: rightsStatus,
      authorization_reference: item?.authorization_reference,
      person_consent_reference: item?.person_consent_reference,
    },
    human_review: {
      status: humanReviewStatus,
      reviewer_id: item?.reviewer_id,
      reviewed_at: item?.reviewed_at,
      note: item?.review_note,
    },
    placeholder,
    production_credit_granted: productionCredit,
  };
}

function buildAssetBinding(
  input: Parameters<typeof buildMediaAssetLibrary>[0],
  binding: SeedanceAssetBindingItem,
  item: SeedanceAssetLibraryItem | undefined,
  artifact: MediaArtifact | undefined,
): AssetBinding {
  const placeholder = artifact?.placeholder ?? Boolean(binding.is_placeholder);
  const rightsStatus = item?.rights_status ?? artifact?.rights.status ?? 'pending';
  const humanReviewStatus = item?.human_review_status ?? artifact?.human_review.status ?? 'pending';
  const status = assetBindingStatus({ artifact, placeholder, rightsStatus, humanReviewStatus });
  const productionCredit = status === 'ready';

  return {
    schema_version: 'asset-binding/v1',
    binding_id: `binding-${stableDigest([
      input.project_id,
      input.source_version_id,
      binding.asset_id,
      ...binding.source_shot_ids,
    ]).slice(0, 32)}`,
    source_project_id: input.project_id,
    source_story_id: input.story_id,
    source_version_id: input.source_version_id,
    asset_id: binding.asset_id,
    artifact_id: artifact?.artifact_id ?? null,
    kind: binding.kind,
    modality: binding.modality,
    role: binding.role,
    reference_slot: binding.reference_slot,
    source_scene_ids: uniqueNumbers(binding.source_scene_ids),
    source_shot_ids: uniqueStrings(binding.source_shot_ids),
    status,
    rights_status: rightsStatus,
    human_review_status: humanReviewStatus,
    placeholder,
    production_credit_granted: productionCredit,
  };
}

function assetBindingStatus(input: {
  artifact?: MediaArtifact;
  placeholder: boolean;
  rightsStatus: MediaArtifactRightsStatus;
  humanReviewStatus: MediaArtifactHumanReviewStatus;
}): AssetBindingStatus {
  if (!input.artifact) return 'missing_artifact';
  if (input.placeholder) return 'placeholder_only';
  if (input.artifact.integrity_status === 'rejected'
    || input.rightsStatus === 'restricted'
    || input.humanReviewStatus === 'rejected') return 'rejected';
  if (input.artifact.integrity_status !== 'verified') return 'bound_unverified';
  if (input.rightsStatus !== 'authorized') return 'rights_pending';
  if (input.humanReviewStatus !== 'approved') return 'review_pending';
  return 'ready';
}

function mediaStorage(
  item: SeedanceAssetLibraryItem | undefined,
  binding: SeedanceAssetBindingItem,
  contentSha256: string | null,
  projectId: string,
  artifactId: string,
): MediaArtifact['storage'] {
  const localPath = item?.local_path ?? binding.local_path;
  const fileId = item?.file_id ?? binding.file_id;
  if (localPath || fileId) {
    return {
      kind: contentSha256 ? 'local_immutable' : 'legacy_reference',
      file_id: fileId,
      local_path: localPath,
      preview_url: contentSha256
        ? `/api/projects/${encodeURIComponent(projectId)}/production-board/media-assets/${encodeURIComponent(artifactId)}/preview`
        : undefined,
    };
  }
  if (item?.file_url || binding.file_url) {
    return { kind: 'external_url', external_url: item?.file_url ?? binding.file_url };
  }
  if (item?.provider_asset_id || binding.provider_asset_id) {
    return {
      kind: 'provider_asset',
      provider_asset_id: item?.provider_asset_id ?? binding.provider_asset_id,
    };
  }
  return { kind: 'legacy_reference' };
}

function mediaSourceKind(item: SeedanceAssetLibraryItem | undefined, placeholder: boolean): MediaArtifactSourceKind {
  if (placeholder) return 'placeholder';
  const lastEvent = item?.history?.at(-1)?.event_type;
  if (lastEvent === 'cross_project_reuse') return 'cross_project_reuse';
  if (item?.provider === 'local_upload') return 'manual_upload';
  if (item?.provider_asset_id) return 'provider_callback';
  if (item?.file_url) return 'external_reference';
  return 'legacy_migration';
}

function isPlaceholder(
  item: SeedanceAssetLibraryItem | undefined,
  binding: SeedanceAssetBindingItem,
): boolean {
  const provider = item?.provider ?? binding.provider;
  const providerAssetId = item?.provider_asset_id ?? binding.provider_asset_id;
  const localPath = item?.local_path ?? binding.local_path;
  const originalFilename = item?.original_filename ?? binding.original_filename;
  const mimeType = item?.mime_type ?? binding.mime_type;
  return provider === 'story_agent_placeholder'
    || providerAssetId?.startsWith('story-agent-placeholder:') === true
    || localPath?.includes('/seedance-assets/placeholder-') === true
    || originalFilename?.startsWith('placeholder-') === true
    || (mimeType === 'image/svg+xml' && localPath?.includes('/seedance-assets/') === true);
}

function assetLookupKey(kind: string, label: string): string {
  return `${kind}:${label.trim().toLowerCase()}`;
}

function validSha256(value: string | undefined): boolean {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function stableDigest(values: Array<string | undefined>): string {
  return createHash('sha256').update(JSON.stringify(values.map(value => value ?? '')), 'utf8').digest('hex');
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, all) => value.trim().length > 0 && all.indexOf(value) === index);
}

function uniqueNumbers(values: number[]): number[] {
  return values.filter((value, index, all) => Number.isFinite(value) && all.indexOf(value) === index);
}
