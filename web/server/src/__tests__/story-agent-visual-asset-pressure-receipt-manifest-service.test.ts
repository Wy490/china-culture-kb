import { describe, expect, it } from 'vitest';
import {
  buildStoryAgentVisualAssetPressureReceiptBackedManifest,
} from '../services/story-agent-visual-asset-pressure-receipt-manifest-service.js';

function catalog() {
  return {
    schema_version: 'story-agent-visual-asset-pressure-batch-preparation/v1',
    preparation_revision: 1,
    seeds: [
      {
        seed_id: 'world-1',
        series_title: '世界一',
        primary_character: '角色甲',
        outline: '角色甲在地点甲完成一次可见行动。',
        episode_count: 2,
        duration_range_sec: { min: 45, max: 75 },
        pacing_profile: 'balanced_drama',
        style_family: 'style-world-1',
        series_project_id: 'series-world-1',
        visual_identities: [
          { identity_id: 'char-1', kind: 'character', label: '角色甲' },
          { identity_id: 'costume-1', kind: 'costume', label: '角色甲常服' },
          { identity_id: 'location-1', kind: 'location', label: '地点甲' },
          { identity_id: 'prop-1', kind: 'prop', label: '道具甲' },
        ],
      },
      {
        seed_id: 'world-2',
        series_title: '世界二',
        primary_character: '角色乙',
        outline: '角色乙在地点乙完成一次可见行动。',
        episode_count: 2,
        duration_range_sec: { min: 60, max: 90 },
        pacing_profile: 'slow_burn',
        style_family: 'style-world-2',
        series_project_id: 'series-world-2',
        visual_identities: [
          { identity_id: 'char-2', kind: 'character', label: '角色乙' },
          { identity_id: 'costume-2', kind: 'costume', label: '角色乙常服' },
          { identity_id: 'location-2', kind: 'location', label: '地点乙' },
        ],
      },
    ],
  };
}

function receipt() {
  return {
    schema_version: 'story-agent-visual-asset-pressure-batch-receipt/v1',
    batch_id: 'imagegen-test-batch',
    generated_at: '2026-07-27T06:00:00.000Z',
    provider: 'openai_imagegen',
    model: 'gpt-image-2',
    assets: ['world-1', 'world-2'].flatMap(seedId => [
      {
        seed_id: seedId,
        role: 'character',
        provider_asset_id: `imagegen-built-in-call_${seedId.replace('-', '')}character`,
        prompt_path: `generated/${seedId}-character.txt`,
        prompt_sha256: 'a'.repeat(64),
        source_path: `generated/${seedId}-character.png`,
        content_sha256: 'b'.repeat(64),
        mime_type: 'image/png',
        width: 1024,
        height: 1536,
      },
      {
        seed_id: seedId,
        role: 'world',
        provider_asset_id: `imagegen-built-in-call_${seedId.replace('-', '')}world`,
        prompt_path: `generated/${seedId}-world.txt`,
        prompt_sha256: 'c'.repeat(64),
        source_path: `generated/${seedId}-world.png`,
        content_sha256: 'd'.repeat(64),
        mime_type: 'image/png',
        width: 1536,
        height: 1024,
      },
    ]),
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}

describe('Story Agent reusable receipt-backed visual manifest builder', () => {
  it('derives manifest and style map from a catalog plus a parsed immutable receipt', () => {
    const result = buildStoryAgentVisualAssetPressureReceiptBackedManifest({
      catalog: catalog(),
      receipt: receipt(),
    });

    expect(result.summary).toEqual({
      batch_id: 'imagegen-test-batch',
      seed_count: 2,
      receipt_asset_count: 4,
      manifest_asset_count: 7,
      unique_content_sha256_count: 2,
    });
    expect(result.manifest).toMatchObject({
      schema_version: 'story-agent-cross-seed-image-asset-manifest/v1',
      provider: 'openai_imagegen',
      model: 'gpt-image-2',
    });
    expect(result.style_map).toEqual({
      schema_version: 'story-agent-visual-asset-pressure-style-map/v1',
      style_families: {
        'world-1': 'style-world-1',
        'world-2': 'style-world-2',
      },
    });
    const firstCharacter = result.manifest.assets.find(asset => (
      asset.seed_id === 'world-1' && asset.kind === 'character'
    ));
    const firstWorldAssets = result.manifest.assets.filter(asset => (
      asset.seed_id === 'world-1' && asset.kind !== 'character'
    ));
    expect(firstCharacter).toMatchObject({
      provider_asset_id: 'imagegen-built-in-call_world1character',
      prompt_sha256: 'a'.repeat(64),
      content_sha256: 'b'.repeat(64),
    });
    expect(firstWorldAssets).toHaveLength(3);
    expect(firstWorldAssets.every(asset => (
      asset.provider_asset_id === 'imagegen-built-in-call_world1world'
      && asset.prompt_sha256 === 'c'.repeat(64)
      && asset.content_sha256 === 'd'.repeat(64)
    ))).toBe(true);
  });

  it('rejects incomplete receipt roles and receipt seeds absent from the catalog', () => {
    const incomplete = receipt();
    incomplete.assets = incomplete.assets.filter(asset => (
      !(asset.seed_id === 'world-2' && asset.role === 'world')
    ));
    expect(() => buildStoryAgentVisualAssetPressureReceiptBackedManifest({
      catalog: catalog(),
      receipt: incomplete,
    })).toThrow('world-2: immutable receipt roles are incomplete');

    const unknown = receipt();
    unknown.assets[0]!.seed_id = 'unknown-world';
    expect(() => buildStoryAgentVisualAssetPressureReceiptBackedManifest({
      catalog: catalog(),
      receipt: unknown,
    })).toThrow('receipt has unknown seed_id: unknown-world');
  });

  it('rejects duplicate catalog seeds and missing canonical identities', () => {
    const duplicate = catalog();
    duplicate.seeds[1]!.seed_id = 'world-1';
    expect(() => buildStoryAgentVisualAssetPressureReceiptBackedManifest({
      catalog: duplicate,
      receipt: receipt(),
    })).toThrow('duplicate preparation seed_id: world-1');

    const missingLocation = catalog();
    missingLocation.seeds[0]!.visual_identities = missingLocation.seeds[0]!
      .visual_identities.filter(identity => identity.kind !== 'location');
    expect(() => buildStoryAgentVisualAssetPressureReceiptBackedManifest({
      catalog: missingLocation,
      receipt: receipt(),
    })).toThrow('world-1: character, costume, or location identity missing');
  });
});
