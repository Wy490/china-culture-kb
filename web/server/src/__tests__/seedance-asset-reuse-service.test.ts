import { describe, expect, it } from 'vitest';
import type {
  SeedanceAssetBindingItem,
  SeedanceAssetLibraryItem,
  SeedanceAssetReuseRequest,
} from '@shared/types.js';
import {
  buildSeedanceAssetReuseMaterialization,
  buildSeedanceGlobalAssetItems,
  isReusableSeedanceAsset,
} from '../services/seedance-asset-reuse-service.js';

function asset(overrides: Partial<SeedanceAssetLibraryItem> = {}): SeedanceAssetLibraryItem {
  return {
    asset_id: 'character-aqing',
    label: '阿青',
    kind: 'character',
    modality: 'image',
    role: 'character_reference',
    updated_at: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function reportAsset(overrides: Partial<SeedanceAssetBindingItem> = {}): SeedanceAssetBindingItem {
  return {
    asset_id: 'target-character-aqing',
    label: '阿青',
    kind: 'character',
    modality: 'image',
    role: 'character_reference',
    reference_slot: '@图片1',
    prompt_usage: '@图片1 作为阿青人物形象参考',
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

describe('Seedance asset reuse service', () => {
  it('keeps the existing reusable gate, including local placeholders without granting review credit', () => {
    expect(isReusableSeedanceAsset(asset({ file_url: 'https://cdn.example.com/aqing.png' }))).toBe(true);
    expect(isReusableSeedanceAsset(asset({ file_id: 'provider-file-1' }))).toBe(true);
    expect(isReusableSeedanceAsset(asset({ local_path: 'projects/source/placeholder.svg' }))).toBe(true);
    expect(isReusableSeedanceAsset(asset({ provider_asset_id: 'provider-asset-1' }))).toBe(true);
    expect(isReusableSeedanceAsset(asset({ upload_status: 'uploaded' }))).toBe(true);
    expect(isReusableSeedanceAsset(asset({ upload_status: 'external' }))).toBe(true);
    expect(isReusableSeedanceAsset(asset({ upload_status: 'failed' }))).toBe(false);
    expect(isReusableSeedanceAsset(asset())).toBe(false);
  });

  it('maps reusable assets from other projects and sorts by kind, label, then newest update', () => {
    const items = buildSeedanceGlobalAssetItems({
      currentProjectId: 'current-project',
      projects: [
        {
          project: { project_id: 'current-project', title: '当前项目' },
          items: [asset({ asset_id: 'ignored', file_id: 'ignored' })],
        },
        {
          project: { project_id: 'source-old', title: '来源旧版' },
          items: [
            asset({
              asset_id: 'aqing-old',
              file_id: 'file-old',
              rights_status: 'authorized',
              human_review_status: 'approved',
              updated_at: '2026-07-18T00:00:00.000Z',
            }),
            asset({
              asset_id: 'not-reusable',
              kind: 'prop',
              label: '灯笼',
            }),
          ],
        },
        {
          project: { project_id: 'source-new', title: '来源新版' },
          items: [
            asset({
              asset_id: 'aqing-new',
              file_id: 'file-new',
              updated_at: '2026-07-20T00:00:00.000Z',
            }),
            asset({
              asset_id: 'bridge',
              kind: 'location',
              label: '江南石桥',
              role: 'location_reference',
              file_id: 'file-bridge',
            }),
          ],
        },
      ],
    });

    expect(items.map(item => item.global_asset_id)).toEqual([
      'source-new:aqing-new',
      'source-old:aqing-old',
      'source-new:bridge',
    ]);
    expect(items[1]).toMatchObject({
      source_project_title: '来源旧版',
      rights_status: 'authorized',
      human_review_status: 'approved',
    });
  });

  it('matches a board requirement and inherits source provenance and review state fail-closed', () => {
    const sourceItem = asset({
      local_path: 'projects/source/production-board/seedance-assets/placeholder.svg',
      provider: 'story_agent_placeholder',
      provider_asset_id: 'local:production-board/seedance-assets/placeholder.svg',
      upload_status: 'uploaded',
      rights_status: undefined,
      human_review_status: undefined,
      description: '来源占位卡',
    });
    const result = buildSeedanceAssetReuseMaterialization({
      request: {
        source_project_id: 'source-project',
        source_asset_id: sourceItem.asset_id,
      },
      sourceProject: { project_id: 'source-project', title: '来源项目' },
      sourceItem,
      targetItems: [],
      reportAssets: [reportAsset()],
      updatedAt: '2026-07-20T01:00:00.000Z',
      historyEventId: 'seedance-asset-event-20260720010000-abcd1234',
    });

    expect(result.reusedAsset).toMatchObject({
      asset_id: 'target-character-aqing',
      reference_slot: '@图片1',
      local_path: sourceItem.local_path,
      provider: 'story_agent_placeholder',
      provider_asset_id: sourceItem.provider_asset_id,
      upload_status: 'uploaded',
      description: '@图片1 作为阿青人物形象参考',
      history: [expect.objectContaining({
        event_id: 'seedance-asset-event-20260720010000-abcd1234',
        event_type: 'cross_project_reuse',
        source_project_id: 'source-project',
        source_asset_id: 'character-aqing',
      })],
    });
    expect(result.reusedAsset.rights_status).toBeUndefined();
    expect(result.reusedAsset.human_review_status).toBeUndefined();
    expect(result.sourceAsset).toMatchObject({
      global_asset_id: 'source-project:character-aqing',
      provider: 'story_agent_placeholder',
    });
  });

  it('honors explicit target overrides while preserving existing target presentation fields', () => {
    const request: SeedanceAssetReuseRequest = {
      source_project_id: 'source-project',
      source_asset_id: 'source-character',
      target_asset_id: 'custom-target',
      target_label: '阿青定稿',
      target_kind: 'character',
      reference_slot: '@图片9',
      description: '指定复用说明',
    };
    const existing = asset({
      asset_id: 'custom-target',
      label: '旧目标',
      modality: 'video',
      role: 'camera_reference',
      history: [{
        event_id: 'existing-event',
        event_type: 'manual_bind',
        created_at: '2026-07-19T00:00:00.000Z',
      }],
    });
    const sourceItem = asset({
      asset_id: 'source-character',
      file_url: 'https://cdn.example.com/aqing.png',
      upload_status: 'external',
      content_sha256: 'source-sha256',
      rights_status: 'authorized',
      human_review_status: 'approved',
    });
    const result = buildSeedanceAssetReuseMaterialization({
      request,
      sourceProject: { project_id: 'source-project', title: '来源项目' },
      sourceItem,
      targetItems: [existing, asset({ asset_id: 'other-target', label: '其他资产' })],
      reportAssets: [reportAsset()],
      updatedAt: '2026-07-20T02:00:00.000Z',
      historyEventId: 'seedance-asset-event-20260720020000-efgh5678',
    });

    expect(result.reusedAsset).toMatchObject({
      asset_id: 'custom-target',
      label: '阿青定稿',
      modality: 'video',
      role: 'camera_reference',
      reference_slot: '@图片9',
      file_url: sourceItem.file_url,
      content_sha256: 'source-sha256',
      rights_status: 'authorized',
      human_review_status: 'approved',
      description: '指定复用说明',
    });
    expect(result.reusedAsset.history?.map(event => event.event_id)).toEqual([
      'existing-event',
      'seedance-asset-event-20260720020000-efgh5678',
    ]);
    expect(result.libraryItems.map(item => item.asset_id)).toContain('other-target');
    expect(result.libraryItems.filter(item => item.asset_id === 'custom-target')).toHaveLength(1);
  });
});
