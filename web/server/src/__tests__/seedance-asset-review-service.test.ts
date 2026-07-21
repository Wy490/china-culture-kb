import { describe, expect, it } from 'vitest';
import type {
  AssetBinding,
  MediaArtifact,
  MediaAssetReviewUpdateRequest,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
  StoryProjectDetail,
} from '@shared/types.js';
import {
  buildSeedanceAssetReviewMaterialization,
  buildSeedanceAssetReviewResult,
  getSeedanceAssetReviewValidationError,
} from '../services/seedance-asset-review-service.js';

function uploadedAsset(overrides: Partial<SeedanceAssetLibraryItem> = {}): SeedanceAssetLibraryItem {
  return {
    asset_id: 'character-aqing',
    label: '阿青',
    kind: 'character',
    modality: 'image',
    role: 'character_reference',
    reference_slot: '@图片1',
    file_id: 'media-aqing',
    local_path: 'projects/project-1/media/originals/aqing.png',
    original_filename: 'aqing.png',
    mime_type: 'image/png',
    size_bytes: 2048,
    content_sha256: 'a'.repeat(64),
    rights_status: 'pending',
    human_review_status: 'pending',
    provider: 'local_upload',
    provider_asset_id: 'media-aqing',
    upload_status: 'uploaded',
    updated_at: '2026-07-19T00:00:00.000Z',
    history: [{
      event_id: 'upload-event',
      event_type: 'file_upload',
      created_at: '2026-07-19T00:00:00.000Z',
      content_sha256: 'a'.repeat(64),
      rights_status: 'pending',
      human_review_status: 'pending',
    }],
    ...overrides,
  };
}

function approvedRequest(overrides: Partial<MediaAssetReviewUpdateRequest> = {}): MediaAssetReviewUpdateRequest {
  return {
    asset_id: 'character-aqing',
    expected_content_sha256: 'a'.repeat(64),
    rights_status: 'authorized',
    authorization_reference: 'contract://rights/aqing',
    human_review_status: 'approved',
    review_note: '已核对不可变原图与时代细节，可进入制作。',
    ...overrides,
  };
}

describe('Seedance asset review service', () => {
  it('requires a review dimension and rejects stale immutable bytes', () => {
    const existing = uploadedAsset();
    expect(getSeedanceAssetReviewValidationError({
      existing,
      request: { asset_id: existing.asset_id },
      hasVerifiedImmutableArtifact: true,
    })).toBe('rights_status or human_review_status is required');

    expect(getSeedanceAssetReviewValidationError({
      existing,
      request: approvedRequest({ expected_content_sha256: 'b'.repeat(64) }),
      hasVerifiedImmutableArtifact: true,
    })).toBe('Media asset content changed or does not match expected_content_sha256; review the current immutable file');
  });

  it('requires authorization evidence and an explicit human decision note', () => {
    const existing = uploadedAsset();
    expect(getSeedanceAssetReviewValidationError({
      existing,
      request: approvedRequest({ authorization_reference: '   ' }),
      hasVerifiedImmutableArtifact: true,
    })).toBe('authorization_reference is required for authorized media rights');

    expect(getSeedanceAssetReviewValidationError({
      existing,
      request: approvedRequest({ review_note: '   ' }),
      hasVerifiedImmutableArtifact: true,
    })).toBe('expected_content_sha256 and review_note are required for a human visual review decision');
  });

  it('rejects human approval without verified local immutable evidence', () => {
    expect(getSeedanceAssetReviewValidationError({
      existing: uploadedAsset(),
      request: approvedRequest(),
      hasVerifiedImmutableArtifact: false,
    })).toBe('Human visual review requires a locally ingested immutable artifact with verified bytes');
  });

  it('materializes rights and human review history without mutating the source library', () => {
    const existing = uploadedAsset();
    const untouched = uploadedAsset({ asset_id: 'location-bridge', kind: 'location', label: '石桥' });
    const library: SeedanceAssetLibrary = {
      schema_version: 'seedance-asset-library/v1',
      items: [untouched, existing],
    };
    const result = buildSeedanceAssetReviewMaterialization({
      library,
      existing,
      request: approvedRequest({ person_consent_reference: 'consent://aqing' }),
      reviewerId: 'director-reviewer-001',
      reviewedAt: '2026-07-20T05:00:00.000Z',
      rightsHistoryEventId: 'rights-review-event',
      humanReviewHistoryEventId: 'human-review-event',
    });

    expect(result.asset).toMatchObject({
      asset_id: 'character-aqing',
      rights_status: 'authorized',
      authorization_reference: 'contract://rights/aqing',
      person_consent_reference: 'consent://aqing',
      human_review_status: 'approved',
      reviewer_id: 'director-reviewer-001',
      reviewed_at: '2026-07-20T05:00:00.000Z',
      review_note: '已核对不可变原图与时代细节，可进入制作。',
      updated_at: '2026-07-20T05:00:00.000Z',
    });
    expect(result.asset.history?.slice(-2)).toEqual([
      expect.objectContaining({
        event_id: 'rights-review-event',
        event_type: 'rights_review',
        rights_status: 'authorized',
        note: 'contract://rights/aqing',
      }),
      expect.objectContaining({
        event_id: 'human-review-event',
        event_type: 'human_visual_review',
        human_review_status: 'approved',
        reviewer_id: 'director-reviewer-001',
        note: '已核对不可变原图与时代细节，可进入制作。',
      }),
    ]);
    expect(result.library.items.map(item => item.asset_id)).toEqual([
      'character-aqing',
      'location-bridge',
    ]);
    expect(existing.rights_status).toBe('pending');
    expect(library.updated_at).toBeUndefined();
  });

  it('clears reviewer evidence when a human decision returns to pending', () => {
    const existing = uploadedAsset({
      human_review_status: 'approved',
      reviewer_id: 'old-reviewer',
      reviewed_at: '2026-07-19T06:00:00.000Z',
      review_note: '旧审核',
    });
    const result = buildSeedanceAssetReviewMaterialization({
      library: { schema_version: 'seedance-asset-library/v1', items: [existing] },
      existing,
      request: { asset_id: existing.asset_id, human_review_status: 'pending' },
      reviewerId: 'director-reviewer-002',
      reviewedAt: '2026-07-20T06:00:00.000Z',
      humanReviewHistoryEventId: 'human-pending-event',
    });

    expect(result.asset.human_review_status).toBe('pending');
    expect(result.asset.reviewer_id).toBeUndefined();
    expect(result.asset.reviewed_at).toBeUndefined();
    expect(result.asset.review_note).toBeUndefined();
  });

  it('assembles review evidence from bindings already resolved by orchestration', () => {
    const asset = uploadedAsset({ rights_status: 'authorized', human_review_status: 'approved' });
    const artifact = {
      artifact_id: 'artifact-aqing',
      production_credit_granted: true,
    } as MediaArtifact;
    const binding = {
      asset_id: asset.asset_id,
      production_credit_granted: true,
    } as AssetBinding;
    const detail = { project: { project_id: 'project-1' } } as StoryProjectDetail;

    expect(buildSeedanceAssetReviewResult({
      detail,
      asset,
      artifact,
      binding,
      reviewerId: 'director-reviewer-001',
      reviewedAt: '2026-07-20T05:00:00.000Z',
    })).toEqual({
      detail,
      asset,
      artifact,
      binding,
      reviewer_id: 'director-reviewer-001',
      reviewed_at: '2026-07-20T05:00:00.000Z',
      production_credit_granted: true,
    });
  });
});
