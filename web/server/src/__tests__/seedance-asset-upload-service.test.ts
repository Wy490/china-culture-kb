import { describe, expect, it } from 'vitest';
import type {
  AssetIngestReport,
  SeedanceAssetBindingItem,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
} from '@shared/types.js';
import {
  buildSeedanceAssetUploadFilePlan,
  buildSeedanceAssetUploadMaterialization,
  resolveSeedanceAssetUploadTarget,
} from '../services/seedance-asset-upload-service.js';

function reviewedAsset(overrides: Partial<SeedanceAssetLibraryItem> = {}): SeedanceAssetLibraryItem {
  return {
    asset_id: 'character-aqing',
    label: '阿青旧稿',
    kind: 'character',
    modality: 'image',
    role: 'character_reference',
    reference_slot: '@图片1',
    file_id: 'old-file',
    content_sha256: 'old-sha256',
    prompt_sha256: 'old-prompt-sha256',
    model: 'old-image-model',
    rights_status: 'authorized',
    authorization_reference: 'rights-ticket-1',
    person_consent_reference: 'consent-ticket-1',
    human_review_status: 'approved',
    reviewer_id: 'reviewer-1',
    reviewed_at: '2026-07-19T00:00:00.000Z',
    review_note: '旧文件审核通过',
    description: '旧资产说明',
    updated_at: '2026-07-19T00:00:00.000Z',
    history: [{
      event_id: 'existing-event',
      event_type: 'human_visual_review',
      created_at: '2026-07-19T00:00:00.000Z',
      rights_status: 'authorized',
      human_review_status: 'approved',
    }],
    ...overrides,
  };
}

function reportAsset(overrides: Partial<SeedanceAssetBindingItem> = {}): SeedanceAssetBindingItem {
  return {
    asset_id: 'prop-lantern',
    label: '旧灯笼',
    kind: 'prop',
    modality: 'image',
    role: 'prop_reference',
    reference_slot: '@图片2',
    prompt_usage: '@图片2 作为旧灯笼道具参考',
    source_scene_ids: [1],
    source_shot_ids: ['shot-1'],
    required_by_shot_count: 1,
    has_reference_slot: true,
    is_bound: false,
    needs_upload: true,
    status: 'missing_file',
    ...overrides,
  };
}

function ingest(overrides: Partial<AssetIngestReport> = {}): AssetIngestReport {
  return {
    schema_version: 'asset-ingest/v1',
    modality: 'image',
    detected_mime_type: 'image/png',
    canonical_extension: '.png',
    byte_size: 2048,
    content_sha256: 'a'.repeat(64),
    integrity_status: 'verified',
    quarantined: false,
    technical_metadata: { width: 1280, height: 720 },
    warnings: [],
    ...overrides,
  };
}

describe('Seedance asset upload service', () => {
  it('resolves an explicit target and preserves its presentation defaults before byte inspection', () => {
    const existing = reviewedAsset();
    const target = resolveSeedanceAssetUploadTarget({
      library: { schema_version: 'seedance-asset-library/v1', items: [existing] },
      reportAssets: [reportAsset()],
      request: {
        asset_id: '  character-aqing  ',
        label: '  阿青新稿  ',
      },
    });

    expect(target).toMatchObject({
      assetId: 'character-aqing',
      kind: 'character',
      label: '阿青新稿',
      modality: 'image',
      existing: { asset_id: 'character-aqing' },
    });
  });

  it('matches a Production Board requirement, generates stable ids, and rejects unresolved requests', () => {
    expect(resolveSeedanceAssetUploadTarget({
      library: { schema_version: 'seedance-asset-library/v1', items: [] },
      reportAssets: [reportAsset()],
      request: { kind: 'prop', label: ' 旧灯笼 ' },
    })).toMatchObject({
      assetId: 'prop-lantern',
      kind: 'prop',
      label: '旧灯笼',
      modality: 'image',
      reportMatch: { reference_slot: '@图片2' },
    });
    expect(resolveSeedanceAssetUploadTarget({
      library: { schema_version: 'seedance-asset-library/v1', items: [] },
      reportAssets: [],
      request: { kind: 'location', label: ' 江南石桥 ' },
    })).toMatchObject({
      assetId: 'seedance-asset-location-江南石桥',
      kind: 'location',
      label: '江南石桥',
      modality: 'image',
    });
    expect(resolveSeedanceAssetUploadTarget({
      library: { schema_version: 'seedance-asset-library/v1', items: [] },
      reportAssets: [],
      request: { asset_id: 'unknown-only' },
    })).toBeUndefined();
  });

  it('builds immutable file identity, local path, and preview URL from verified ingest', () => {
    const value = ingest();
    expect(buildSeedanceAssetUploadFilePlan({
      projectId: 'project-1',
      ingest: value,
    })).toEqual({
      fileId: `media-${value.content_sha256}`,
      filename: `${value.content_sha256}.png`,
      localPath: `projects/project-1/media/originals/${value.content_sha256}.png`,
      previewUrl: `/api/projects/project-1/production-board/media-assets/media-sha256-${value.content_sha256}/preview`,
    });
  });

  it('materializes new bytes with pending reviews and clears stale approval evidence', () => {
    const existing = reviewedAsset();
    const library: SeedanceAssetLibrary = {
      schema_version: 'seedance-asset-library/v1',
      items: [
        existing,
        reviewedAsset({ asset_id: 'location-bridge', kind: 'location', label: '石桥' }),
      ],
    };
    const target = resolveSeedanceAssetUploadTarget({
      library,
      reportAssets: [],
      request: {
        asset_id: existing.asset_id,
        label: '阿青新稿',
        description: '新字节重新审核',
      },
    })!;
    const verifiedIngest = ingest();
    const plan = buildSeedanceAssetUploadFilePlan({ projectId: 'project-1', ingest: verifiedIngest });
    const result = buildSeedanceAssetUploadMaterialization({
      library,
      target,
      request: {
        asset_id: existing.asset_id,
        label: '阿青新稿',
        description: '新字节重新审核',
        originalFilename: 'aqing-v2.png',
      },
      ingest: verifiedIngest,
      plan,
      updatedAt: '2026-07-20T04:00:00.000Z',
      historyEventId: 'seedance-asset-event-20260720040000-abcd1234',
    });

    expect(result.asset).toMatchObject({
      asset_id: 'character-aqing',
      label: '阿青新稿',
      file_id: plan.fileId,
      local_path: plan.localPath,
      original_filename: 'aqing-v2.png',
      mime_type: 'image/png',
      size_bytes: 2048,
      content_sha256: verifiedIngest.content_sha256,
      rights_status: 'pending',
      human_review_status: 'pending',
      provider: 'local_upload',
      provider_asset_id: plan.fileId,
      upload_status: 'uploaded',
      description: '新字节重新审核',
      history: [
        expect.objectContaining({ event_id: 'existing-event' }),
        expect.objectContaining({
          event_id: 'seedance-asset-event-20260720040000-abcd1234',
          event_type: 'file_upload',
          content_sha256: verifiedIngest.content_sha256,
          rights_status: 'pending',
          human_review_status: 'pending',
          note: 'aqing-v2.png',
        }),
      ],
    });
    expect(result.asset.authorization_reference).toBeUndefined();
    expect(result.asset.person_consent_reference).toBeUndefined();
    expect(result.asset.reviewer_id).toBeUndefined();
    expect(result.asset.reviewed_at).toBeUndefined();
    expect(result.asset.review_note).toBeUndefined();
    expect(result.asset.prompt_sha256).toBeUndefined();
    expect(result.asset.model).toBeUndefined();
    expect(result.library.items.map(item => item.asset_id)).toEqual([
      'character-aqing',
      'location-bridge',
    ]);
  });
});
