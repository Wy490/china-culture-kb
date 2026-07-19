import { describe, expect, it } from 'vitest';
import type { SeedanceAssetBindingItem, SeedanceAssetLibrary } from '@shared/types.js';
import { buildMediaAssetLibrary } from '../services/media-asset-contract-service.js';

function binding(overrides: Partial<SeedanceAssetBindingItem> = {}): SeedanceAssetBindingItem {
  return {
    asset_id: 'character-zhouzi',
    label: '周子',
    kind: 'character',
    modality: 'image',
    role: 'character_reference',
    reference_slot: '@图片1',
    source_scene_ids: [1],
    source_shot_ids: ['shot-unit-1'],
    required_by_shot_count: 1,
    has_reference_slot: true,
    is_bound: true,
    needs_upload: false,
    status: 'bound',
    ...overrides,
  };
}

function library(items: Array<Record<string, unknown>>): SeedanceAssetLibrary {
  return {
    schema_version: 'seedance-asset-library/v1',
    updated_at: '2026-07-19T10:00:00.000Z',
    items: items as unknown as SeedanceAssetLibrary['items'],
  };
}

describe('MediaArtifact / AssetBinding compatibility contract', () => {
  it('migrates a legacy bound file as unverified evidence with no production credit', () => {
    const result = buildMediaAssetLibrary({
      project_id: 'project-001',
      story_id: 'story-001',
      source_version_id: 'project-001-v1',
      generated_at: '2026-07-19T10:01:00.000Z',
      seedance_asset_library: library([{
        asset_id: 'character-zhouzi',
        label: '周子',
        kind: 'character',
        modality: 'image',
        role: 'character_reference',
        reference_slot: '@图片1',
        local_path: 'projects/project-001/seedance-assets/uploads/zhouzi.png',
        mime_type: 'image/png',
        provider: 'local_upload',
        upload_status: 'uploaded',
        updated_at: '2026-07-19T10:00:00.000Z',
      }]),
      seedance_bindings: [binding({
        local_path: 'projects/project-001/seedance-assets/uploads/zhouzi.png',
        mime_type: 'image/png',
        provider: 'local_upload',
        upload_status: 'uploaded',
      })],
    });

    expect(result).toMatchObject({
      schema_version: 'media-asset-library/v1',
      summary: {
        artifact_count: 1,
        binding_count: 1,
        production_credit_binding_count: 0,
        legacy_unverified_artifact_count: 1,
      },
      migration: {
        source_schema_version: 'seedance-asset-library/v1',
        legacy_item_count: 1,
      },
    });
    expect(result.artifacts[0]).toMatchObject({
      schema_version: 'media-artifact/v1',
      content_sha256: null,
      integrity_status: 'unverified',
      rights: { status: 'pending' },
      human_review: { status: 'pending' },
      placeholder: false,
      production_credit_granted: false,
    });
    expect(result.bindings[0]).toMatchObject({
      schema_version: 'asset-binding/v1',
      source_project_id: 'project-001',
      source_story_id: 'story-001',
      source_version_id: 'project-001-v1',
      source_scene_ids: [1],
      source_shot_ids: ['shot-unit-1'],
      status: 'bound_unverified',
      production_credit_granted: false,
    });
  });

  it('keeps placeholders structurally bound but permanently excludes production credit', () => {
    const result = buildMediaAssetLibrary({
      project_id: 'project-001',
      story_id: 'story-001',
      generated_at: '2026-07-19T10:01:00.000Z',
      seedance_asset_library: library([{
        asset_id: 'location-county-office',
        label: '县衙',
        kind: 'location',
        modality: 'image',
        role: 'location_reference',
        local_path: 'projects/project-001/production-board/seedance-assets/placeholder-location.svg',
        mime_type: 'image/svg+xml',
        provider: 'story_agent_placeholder',
        upload_status: 'uploaded',
        updated_at: '2026-07-19T10:00:00.000Z',
      }]),
      seedance_bindings: [binding({
        asset_id: 'location-county-office',
        label: '县衙',
        kind: 'location',
        role: 'location_reference',
        local_path: 'projects/project-001/production-board/seedance-assets/placeholder-location.svg',
        mime_type: 'image/svg+xml',
        provider: 'story_agent_placeholder',
        is_placeholder: true,
      })],
    });

    expect(result.artifacts[0]).toMatchObject({
      placeholder: true,
      production_credit_granted: false,
    });
    expect(result.bindings[0]).toMatchObject({
      status: 'placeholder_only',
      placeholder: true,
      production_credit_granted: false,
    });
  });

  it('grants binding readiness only when integrity, rights, and human review all pass', () => {
    const sha256 = 'a'.repeat(64);
    const result = buildMediaAssetLibrary({
      project_id: 'project-001',
      story_id: 'story-001',
      generated_at: '2026-07-19T10:01:00.000Z',
      seedance_asset_library: library([{
        asset_id: 'character-zhouzi',
        label: '周子',
        kind: 'character',
        modality: 'image',
        role: 'character_reference',
        file_id: 'immutable-file-001',
        mime_type: 'image/png',
        provider: 'local_upload',
        upload_status: 'uploaded',
        content_sha256: sha256,
        rights_status: 'authorized',
        human_review_status: 'approved',
        updated_at: '2026-07-19T10:00:00.000Z',
      }]),
      seedance_bindings: [binding({ file_id: 'immutable-file-001', mime_type: 'image/png' })],
    });

    expect(result.artifacts[0]).toMatchObject({
      content_sha256: sha256,
      integrity_status: 'verified',
      rights: { status: 'authorized' },
      human_review: { status: 'approved' },
      production_credit_granted: true,
    });
    expect(result.bindings[0]).toMatchObject({
      status: 'ready',
      production_credit_granted: true,
    });
  });

  it('deduplicates immutable artifacts by content SHA-256 while retaining separate bindings', () => {
    const sha256 = 'b'.repeat(64);
    const shared = {
      modality: 'image',
      file_id: 'immutable-shared',
      mime_type: 'image/png',
      upload_status: 'uploaded',
      content_sha256: sha256,
      rights_status: 'authorized',
      human_review_status: 'approved',
      updated_at: '2026-07-19T10:00:00.000Z',
    };
    const result = buildMediaAssetLibrary({
      project_id: 'project-001',
      story_id: 'story-001',
      generated_at: '2026-07-19T10:01:00.000Z',
      seedance_asset_library: library([
        { ...shared, asset_id: 'prop-seal-a', label: '印章 A', kind: 'prop', role: 'prop_reference' },
        { ...shared, asset_id: 'prop-seal-b', label: '印章 B', kind: 'prop', role: 'prop_reference' },
      ]),
      seedance_bindings: [
        binding({ asset_id: 'prop-seal-a', label: '印章 A', kind: 'prop', role: 'prop_reference', file_id: 'immutable-shared' }),
        binding({ asset_id: 'prop-seal-b', label: '印章 B', kind: 'prop', role: 'prop_reference', file_id: 'immutable-shared', source_shot_ids: ['shot-unit-2'] }),
      ],
    });

    expect(result.artifacts).toHaveLength(1);
    expect(result.bindings).toHaveLength(2);
    expect(new Set(result.bindings.map(item => item.artifact_id))).toEqual(new Set([result.artifacts[0].artifact_id]));
  });
});
