import { describe, expect, it } from 'vitest';
import type {
  SeedanceAssetBindingItem,
  SeedanceAssetHistoryEvent,
  SeedanceAssetLibraryItem,
} from '@shared/types.js';
import {
  buildSeedanceAssetPlaceholderMaterialization,
  buildSeedanceAssetPlaceholderPlan,
  isSeedanceAssetPlaceholderCandidate,
  seedanceAssetPlaceholderHistoryEventId,
} from '../services/seedance-asset-placeholder-service.js';

function binding(overrides: Partial<SeedanceAssetBindingItem> = {}): SeedanceAssetBindingItem {
  return {
    asset_id: 'character-aqing',
    label: '阿青 <主角>',
    kind: 'character',
    modality: 'image',
    role: 'character_reference',
    reference_slot: '@图片1',
    prompt_usage: '@图片1 作为阿青人物形象参考 & 保持青衣造型',
    source_scene_ids: [1, 2],
    source_shot_ids: ['shot-1', 'shot-2'],
    required_by_shot_count: 2,
    has_reference_slot: true,
    is_bound: false,
    needs_upload: true,
    status: 'missing_file',
    ...overrides,
  };
}

function previousHistory(index: number): SeedanceAssetHistoryEvent {
  return {
    event_id: `event-${index}`,
    event_type: 'manual_bind',
    created_at: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    note: `历史记录 ${index}`,
  };
}

function previousAsset(history: SeedanceAssetHistoryEvent[]): SeedanceAssetLibraryItem {
  return {
    asset_id: 'character-aqing',
    label: '阿青旧稿',
    kind: 'character',
    modality: 'image',
    role: 'character_reference',
    updated_at: '2026-07-19T00:00:00.000Z',
    history,
  };
}

describe('Seedance asset placeholder service', () => {
  it('accepts only unbound assets with a non-empty reference slot', () => {
    expect(isSeedanceAssetPlaceholderCandidate(binding())).toBe(true);
    expect(isSeedanceAssetPlaceholderCandidate(binding({ is_bound: true }))).toBe(false);
    expect(isSeedanceAssetPlaceholderCandidate(binding({ reference_slot: '   ' }))).toBe(false);
    expect(isSeedanceAssetPlaceholderCandidate(binding({ reference_slot: undefined }))).toBe(false);
  });

  it('builds a stable local write plan with an explicit placeholder boundary', () => {
    const plan = buildSeedanceAssetPlaceholderPlan({
      asset: binding(),
      projectId: 'project-1',
      projectTitle: '雨桥记 <制作版>',
    });

    expect(plan).toMatchObject({
      filename: 'placeholder-图片1-character-阿青-主角.svg',
      relativePath: 'production-board/seedance-assets/placeholder-图片1-character-阿青-主角.svg',
      localPath: 'projects/project-1/production-board/seedance-assets/placeholder-图片1-character-阿青-主角.svg',
    });
    expect(plan.description).toContain('Seedance 本地占位参考卡');
    expect(plan.description).toContain('正式投产前可替换为定稿视觉参考文件');
    expect(plan.svg).toContain('<svg');
    expect(plan.svg).toContain('雨桥记 &lt;制作版&gt;');
    expect(plan.svg).toContain('阿青 &lt;主角&gt;');
    expect(plan.svg).toContain('&amp; 保持青衣造型');
    expect(plan.svg).toContain('这是本地占位参考卡');
    expect(plan.svg).not.toContain('雨桥记 <制作版>');
  });

  it('materializes a created placeholder asset and audit event from written-file metadata', () => {
    const asset = binding();
    const plan = buildSeedanceAssetPlaceholderPlan({
      asset,
      projectId: 'project-1',
      projectTitle: '雨桥记',
    });
    const historyEventId = seedanceAssetPlaceholderHistoryEventId(
      '2026-07-20T03:04:05.000Z',
      'abcd1234',
    );
    const result = buildSeedanceAssetPlaceholderMaterialization({
      asset,
      plan,
      generatedAt: '2026-07-20T03:04:05.000Z',
      historyEventId,
      artifact: {
        absolutePath: '/tmp/project-1/seedance-assets/placeholder.svg',
        byteSize: 2048,
        replaced: false,
      },
    });

    expect(historyEventId).toBe('seedance-asset-event-20260720030405-abcd1234');
    expect(result.libraryAsset).toMatchObject({
      asset_id: 'character-aqing',
      local_path: plan.localPath,
      original_filename: plan.filename,
      mime_type: 'image/svg+xml',
      size_bytes: 2048,
      provider: 'story_agent_placeholder',
      provider_asset_id: `local:${plan.relativePath}`,
      upload_status: 'uploaded',
      description: plan.description,
      updated_at: '2026-07-20T03:04:05.000Z',
      history: [{
        event_id: historyEventId,
        event_type: 'placeholder_draft',
        local_path: plan.localPath,
        size_bytes: 2048,
        note: '自动生成 Seedance 本地占位参考卡',
      }],
    });
    expect(result.item).toMatchObject({
      asset_id: 'character-aqing',
      local_path: plan.localPath,
      relative_path: plan.relativePath,
      file_path: '/tmp/project-1/seedance-assets/placeholder.svg',
      size_bytes: 2048,
      status: 'created',
      source_shot_ids: ['shot-1', 'shot-2'],
      source_scene_ids: [1, 2],
    });
  });

  it('marks replacements updated and retains only the latest 25 history events', () => {
    const asset = binding();
    const plan = buildSeedanceAssetPlaceholderPlan({
      asset,
      projectId: 'project-1',
      projectTitle: '雨桥记',
    });
    const history = Array.from({ length: 25 }, (_, index) => previousHistory(index));
    const result = buildSeedanceAssetPlaceholderMaterialization({
      asset,
      plan,
      generatedAt: '2026-08-01T00:00:00.000Z',
      historyEventId: 'seedance-asset-event-20260801000000-efgh5678',
      previousAsset: previousAsset(history),
      artifact: {
        absolutePath: '/tmp/project-1/seedance-assets/placeholder.svg',
        byteSize: 4096,
        replaced: true,
      },
    });

    expect(result.item.status).toBe('updated');
    expect(result.libraryAsset.history).toHaveLength(25);
    expect(result.libraryAsset.history?.[0].event_id).toBe('event-1');
    expect(result.libraryAsset.history?.at(-1)?.event_id)
      .toBe('seedance-asset-event-20260801000000-efgh5678');
  });
});
