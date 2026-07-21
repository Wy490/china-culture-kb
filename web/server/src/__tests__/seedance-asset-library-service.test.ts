import { describe, expect, it } from 'vitest';
import type {
  SeedanceAssetBatchImportRequest,
  SeedanceAssetBindingItem,
  SeedanceAssetLibrary,
  SeedanceAssetLibraryItem,
  SeedanceAssetLibraryUpdateRequest,
} from '@shared/types.js';
import {
  buildSeedanceAssetBatchImport,
  buildSeedanceAssetLibraryUpdate,
  defaultSeedanceAssetModality,
  defaultSeedanceAssetRole,
  normalizeSeedanceAssetLibrary,
} from '../services/seedance-asset-library-service.js';

function reviewedAsset(overrides: Partial<SeedanceAssetLibraryItem> = {}): SeedanceAssetLibraryItem {
  return {
    asset_id: 'character-aqing',
    label: '阿青',
    kind: 'character',
    modality: 'image',
    role: 'character_reference',
    file_id: 'old-file',
    content_sha256: 'verified-sha256',
    prompt_sha256: 'prompt-sha256',
    model: 'image-model-v1',
    rights_status: 'authorized',
    authorization_reference: 'rights-ticket-1',
    person_consent_reference: 'consent-ticket-1',
    human_review_status: 'approved',
    reviewer_id: 'reviewer-1',
    reviewed_at: '2026-07-19T00:00:00.000Z',
    review_note: '人物形象审核通过',
    description: '旧说明',
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

describe('Seedance asset library service', () => {
  it('normalizes legacy items, defaults identity fields, and cleans history', () => {
    const library = {
      schema_version: 'seedance-asset-library/v1',
      updated_at: '2026-07-18T00:00:00.000Z',
      items: [{
        asset_id: '',
        label: '  环境声  ',
        kind: 'audio',
        updated_at: '',
        history: [{
          event_id: ' valid-event ',
          event_type: 'manual_bind',
          created_at: '2026-07-17T00:00:00.000Z',
        }, {
          event_id: '',
          event_type: 'manual_bind',
          created_at: '2026-07-16T00:00:00.000Z',
        }],
      }, {
        asset_id: 'empty-label',
        label: '   ',
        kind: 'prop',
        updated_at: '',
      }],
    } as SeedanceAssetLibrary;

    expect(normalizeSeedanceAssetLibrary(library)).toEqual({
      schema_version: 'seedance-asset-library/v1',
      updated_at: '2026-07-18T00:00:00.000Z',
      items: [expect.objectContaining({
        asset_id: 'seedance-asset-audio-环境声',
        label: '环境声',
        modality: 'audio',
        role: 'sound_reference',
        updated_at: '',
        history: [expect.objectContaining({ event_id: 'valid-event' })],
      })],
    });
  });

  it('assigns the established modality and role defaults for every asset kind', () => {
    expect(['character', 'location', 'prop', 'camera', 'audio'].map(kind => ({
      kind,
      modality: defaultSeedanceAssetModality(kind as SeedanceAssetLibraryItem['kind']),
      role: defaultSeedanceAssetRole(kind as SeedanceAssetLibraryItem['kind']),
    }))).toEqual([
      { kind: 'character', modality: 'image', role: 'character_reference' },
      { kind: 'location', modality: 'image', role: 'location_reference' },
      { kind: 'prop', modality: 'image', role: 'prop_reference' },
      { kind: 'camera', modality: 'video', role: 'camera_reference' },
      { kind: 'audio', modality: 'audio', role: 'sound_reference' },
    ]);
  });

  it('merges manual bindings without clearing verified provenance or review evidence', () => {
    const request: SeedanceAssetLibraryUpdateRequest = {
      items: [{
        asset_id: 'character-aqing',
        kind: 'character',
        label: '  阿青定稿  ',
        file_url: '  https://cdn.example.com/aqing-v2.png  ',
        description: '  更新人物图  ',
      }],
    };
    const result = buildSeedanceAssetLibraryUpdate({
      library: {
        schema_version: 'seedance-asset-library/v1',
        items: [reviewedAsset()],
      },
      request,
      updatedAt: '2026-07-20T01:00:00.000Z',
      historyEventIds: ['seedance-asset-event-20260720010000-abcd1234'],
    });

    expect(result.items[0]).toMatchObject({
      asset_id: 'character-aqing',
      label: '阿青定稿',
      file_url: 'https://cdn.example.com/aqing-v2.png',
      content_sha256: 'verified-sha256',
      prompt_sha256: 'prompt-sha256',
      model: 'image-model-v1',
      rights_status: 'authorized',
      authorization_reference: 'rights-ticket-1',
      person_consent_reference: 'consent-ticket-1',
      human_review_status: 'approved',
      reviewer_id: 'reviewer-1',
      reviewed_at: '2026-07-19T00:00:00.000Z',
      review_note: '人物形象审核通过',
      description: '更新人物图',
      history: [
        expect.objectContaining({ event_id: 'existing-event' }),
        expect.objectContaining({
          event_id: 'seedance-asset-event-20260720010000-abcd1234',
          event_type: 'manual_bind',
          note: '更新人物图',
        }),
      ],
    });
  });

  it('resolves batch targets, reports skipped rows, and preserves existing review evidence', () => {
    const request: SeedanceAssetBatchImportRequest = {
      source_note: '批量替换文件引用',
      items: [{
        asset_id: 'character-aqing',
        provider: 'seedance',
        provider_asset_id: 'provider-aqing-v2',
        upload_status: 'uploaded',
      }, {
        kind: 'prop',
        label: '旧灯笼',
        file_id: 'lantern-file',
      }, {
        asset_id: 'missing-asset',
        upload_status: 'pending_upload',
      }, {
        kind: 'location',
        label: '空场景',
      }],
    };
    const result = buildSeedanceAssetBatchImport({
      library: {
        schema_version: 'seedance-asset-library/v1',
        items: [reviewedAsset()],
      },
      request,
      reportAssets: [reportAsset()],
      updatedAt: '2026-07-20T02:00:00.000Z',
      historyEventIds: [
        'seedance-asset-event-20260720020000-event001',
        'seedance-asset-event-20260720020000-event002',
        'seedance-asset-event-20260720020000-event003',
        'seedance-asset-event-20260720020000-event004',
      ],
    });

    expect(result).toMatchObject({
      importedCount: 2,
      matchedExistingCount: 2,
      updatedAssetIds: ['character-aqing', 'prop-lantern'],
      skippedItems: [{
        index: 2,
        reason: '缺少 asset_id，或缺少可推断的 label+kind',
        asset_id: 'missing-asset',
      }, {
        index: 3,
        reason: '缺少 file_url、file_id、local_path、provider_asset_id 或 upload_status',
        asset_id: 'seedance-asset-location-空场景',
        label: '空场景',
      }],
    });
    const reviewed = result.library.items.find(item => item.asset_id === 'character-aqing');
    expect(reviewed).toMatchObject({
      provider: 'seedance',
      provider_asset_id: 'provider-aqing-v2',
      content_sha256: 'verified-sha256',
      rights_status: 'authorized',
      human_review_status: 'approved',
      reviewer_id: 'reviewer-1',
      history: expect.arrayContaining([
        expect.objectContaining({
          event_type: 'batch_import',
          note: '批量替换文件引用',
        }),
      ]),
    });
    expect(result.library.items.find(item => item.asset_id === 'prop-lantern')).toMatchObject({
      file_id: 'lantern-file',
      reference_slot: '@图片2',
      description: '@图片2 作为旧灯笼道具参考',
    });
  });

  it('counts repeated successful rows while returning unique updated asset ids', () => {
    const result = buildSeedanceAssetBatchImport({
      library: { schema_version: 'seedance-asset-library/v1', items: [] },
      request: {
        items: [{
          asset_id: 'prop-lantern',
          kind: 'prop',
          label: '灯笼',
          file_id: 'file-1',
        }, {
          asset_id: 'prop-lantern',
          kind: 'prop',
          label: '灯笼',
          file_id: 'file-2',
        }],
      },
      reportAssets: [],
      updatedAt: '2026-07-20T03:00:00.000Z',
      historyEventIds: [
        'seedance-asset-event-20260720030000-event001',
        'seedance-asset-event-20260720030000-event002',
      ],
    });

    expect(result.importedCount).toBe(2);
    expect(result.updatedAssetIds).toEqual(['prop-lantern']);
    expect(result.library.items).toHaveLength(1);
    expect(result.library.items[0]).toMatchObject({
      file_id: 'file-2',
      history: [
        expect.objectContaining({ event_id: 'seedance-asset-event-20260720030000-event001' }),
        expect.objectContaining({ event_id: 'seedance-asset-event-20260720030000-event002' }),
      ],
    });
  });
});
