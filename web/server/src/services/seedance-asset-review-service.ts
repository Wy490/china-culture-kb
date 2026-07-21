import type {
  AssetBinding,
  MediaArtifact,
  MediaAssetReviewUpdateRequest,
  MediaAssetReviewUpdateResult,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
  StoryProjectDetail,
} from '@shared/types.js';
import {
  appendSeedanceAssetHistory,
  seedanceAssetHistoryEvent,
} from './seedance-asset-history-service.js';
import {
  normalizeSeedanceAssetLibrary,
  sortSeedanceAssetLibraryItems,
} from './seedance-asset-library-service.js';

export function getSeedanceAssetReviewValidationError(input: {
  existing: SeedanceAssetLibraryItem;
  request: MediaAssetReviewUpdateRequest;
  hasVerifiedImmutableArtifact: boolean;
}): string | undefined {
  const { existing, request } = input;
  if (!request.rights_status && !request.human_review_status) {
    return 'rights_status or human_review_status is required';
  }
  if (request.expected_content_sha256) {
    const expected = request.expected_content_sha256.toLowerCase();
    if (!existing.content_sha256 || existing.content_sha256.toLowerCase() !== expected) {
      return 'Media asset content changed or does not match expected_content_sha256; review the current immutable file';
    }
  }
  if (request.rights_status === 'authorized' && !request.authorization_reference?.trim()) {
    return 'authorization_reference is required for authorized media rights';
  }
  if (request.human_review_status && request.human_review_status !== 'pending') {
    if (!request.expected_content_sha256 || !request.review_note?.trim()) {
      return 'expected_content_sha256 and review_note are required for a human visual review decision';
    }
    if (!input.hasVerifiedImmutableArtifact) {
      return 'Human visual review requires a locally ingested immutable artifact with verified bytes';
    }
  }
  return undefined;
}

function requiredHistoryEventId(eventId: string | undefined, eventType: string): string {
  const value = eventId?.trim();
  if (!value) throw new Error(`Missing Seedance asset ${eventType} history event id`);
  return value;
}

export function buildSeedanceAssetReviewMaterialization(input: {
  library?: SeedanceAssetLibrary;
  existing: SeedanceAssetLibraryItem;
  request: MediaAssetReviewUpdateRequest;
  reviewerId: string;
  reviewedAt: string;
  rightsHistoryEventId?: string;
  humanReviewHistoryEventId?: string;
}): {
  asset: SeedanceAssetLibraryItem;
  library: SeedanceAssetLibrary;
} {
  const current = normalizeSeedanceAssetLibrary(input.library);
  const humanReviewStatus = input.request.human_review_status
    ?? input.existing.human_review_status
    ?? 'pending';
  const asset: SeedanceAssetLibraryItem = {
    ...input.existing,
    rights_status: input.request.rights_status ?? input.existing.rights_status ?? 'pending',
    authorization_reference: input.request.authorization_reference?.trim()
      ?? input.existing.authorization_reference,
    person_consent_reference: input.request.person_consent_reference?.trim()
      ?? input.existing.person_consent_reference,
    human_review_status: humanReviewStatus,
    reviewer_id: input.request.human_review_status && input.request.human_review_status !== 'pending'
      ? input.reviewerId
      : input.request.human_review_status === 'pending' ? undefined : input.existing.reviewer_id,
    reviewed_at: input.request.human_review_status && input.request.human_review_status !== 'pending'
      ? input.reviewedAt
      : input.request.human_review_status === 'pending' ? undefined : input.existing.reviewed_at,
    review_note: input.request.human_review_status && input.request.human_review_status !== 'pending'
      ? input.request.review_note?.trim()
      : input.request.human_review_status === 'pending' ? undefined : input.existing.review_note,
    updated_at: input.reviewedAt,
  };

  let reviewedAsset = asset;
  if (input.request.rights_status) {
    reviewedAsset = {
      ...reviewedAsset,
      history: appendSeedanceAssetHistory(reviewedAsset, seedanceAssetHistoryEvent({
        asset,
        eventType: 'rights_review',
        createdAt: input.reviewedAt,
        eventId: requiredHistoryEventId(input.rightsHistoryEventId, 'rights review'),
        note: input.request.authorization_reference?.trim()
          ?? `rights_status=${input.request.rights_status}`,
      })),
    };
  }
  if (input.request.human_review_status) {
    reviewedAsset = {
      ...reviewedAsset,
      history: appendSeedanceAssetHistory(reviewedAsset, seedanceAssetHistoryEvent({
        asset,
        eventType: 'human_visual_review',
        createdAt: input.reviewedAt,
        eventId: requiredHistoryEventId(input.humanReviewHistoryEventId, 'human review'),
        note: input.request.review_note?.trim()
          ?? `human_review_status=${input.request.human_review_status}`,
      })),
    };
  }

  return {
    asset: reviewedAsset,
    library: {
      schema_version: 'seedance-asset-library/v1',
      updated_at: input.reviewedAt,
      items: sortSeedanceAssetLibraryItems(current.items.map(item => (
        item.asset_id === reviewedAsset.asset_id ? reviewedAsset : item
      ))),
    },
  };
}

export function buildSeedanceAssetReviewResult(input: {
  detail: StoryProjectDetail;
  asset: SeedanceAssetLibraryItem;
  artifact: MediaArtifact;
  binding: AssetBinding;
  reviewerId: string;
  reviewedAt: string;
}): MediaAssetReviewUpdateResult {
  return {
    detail: input.detail,
    asset: input.asset,
    artifact: input.artifact,
    binding: input.binding,
    reviewer_id: input.reviewerId,
    reviewed_at: input.reviewedAt,
    production_credit_granted: input.binding.production_credit_granted,
  };
}
