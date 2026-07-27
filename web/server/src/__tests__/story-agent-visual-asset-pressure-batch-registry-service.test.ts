import { describe, expect, it } from 'vitest';
import {
  mergeStoryAgentVisualAssetPressureBatches,
  parseStoryAgentVisualAssetPressureBatchRegistry,
} from '../services/story-agent-visual-asset-pressure-batch-registry-service.js';

function registry() {
  return {
    schema_version: 'story-agent-visual-asset-pressure-batch-registry/v2',
    recovery_report_path: 'generated/recovery.json',
    batches: [
      {
        batch_id: 'baseline',
        receipt_status: 'legacy_unsealed',
        manifest_path: 'generated/baseline/manifest.json',
        binding_report_path: 'generated/baseline/binding-report.json',
        style_map_path: 'server/scripts/baseline-style-map.json',
      },
      {
        batch_id: 'batch-2',
        receipt_status: 'legacy_unsealed',
        manifest_path: 'generated/batch-2/manifest.json',
        binding_report_path: 'generated/batch-2/binding-report.json',
        style_map_path: 'generated/batch-2/style-map.json',
      },
      {
        batch_id: 'batch-3',
        receipt_status: 'sealed',
        receipt_path: 'server/scripts/batch-3-receipt.json',
        manifest_path: 'generated/batch-3/manifest.json',
        binding_report_path: 'generated/batch-3/binding-report.json',
        style_map_path: 'generated/batch-3/style-map.json',
      },
    ],
  };
}

function loadedBatch(batchId: string, seedId: string, status: 'passed' | 'blocked' = 'passed') {
  return {
    batch_id: batchId,
    manifest: {
      schema_version: 'story-agent-cross-seed-image-asset-manifest/v1',
      provider: 'openai_imagegen',
      model: 'gpt-image-2',
      assets: [{
        seed_id: seedId,
        label: `${seedId}-character`,
      }],
    },
    binding_report: {
      schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1',
      status,
      provider: 'openai_imagegen',
      model: 'gpt-image-2',
      assets: [{
        seed_id: seedId,
        immutable_preview_verified: true,
        functional_test_identity_mapping_current: true,
        visual_semantic_gate_passed: true,
        production_credit: false,
      }],
      series_shot_bindings: [{
        seed_id: seedId,
        shot_binding_count: 9,
        unbound_shot_count: 0,
      }],
    },
    style_map: {
      schema_version: 'story-agent-visual-asset-pressure-style-map/v1',
      style_families: {
        [seedId]: `${seedId}-style`,
      },
    },
  };
}

describe('Story Agent visual pressure batch registry', () => {
  it('accepts an additional batch without requiring merge-code changes', () => {
    expect(parseStoryAgentVisualAssetPressureBatchRegistry(registry())).toMatchObject({
      schema_version: 'story-agent-visual-asset-pressure-batch-registry/v2',
      recovery_report_path: 'generated/recovery.json',
      batches: [
        { batch_id: 'baseline', receipt_status: 'legacy_unsealed' },
        { batch_id: 'batch-2', receipt_status: 'legacy_unsealed' },
        {
          batch_id: 'batch-3',
          receipt_status: 'sealed',
          receipt_path: 'server/scripts/batch-3-receipt.json',
        },
      ],
    });
  });

  it('normalizes v1 registries to explicit legacy_unsealed provenance', () => {
    const legacy = registry();
    legacy.schema_version = 'story-agent-visual-asset-pressure-batch-registry/v1';
    legacy.batches = legacy.batches.map((batch) => {
      const { receipt_status: _receiptStatus, receipt_path: _receiptPath, ...rest } = batch;
      return rest as typeof batch;
    });
    expect(parseStoryAgentVisualAssetPressureBatchRegistry(legacy)).toMatchObject({
      schema_version: 'story-agent-visual-asset-pressure-batch-registry/v2',
      batches: [
        { receipt_status: 'legacy_unsealed' },
        { receipt_status: 'legacy_unsealed' },
        { receipt_status: 'legacy_unsealed' },
      ],
    });
  });

  it('rejects duplicate batch ids and paths that escape the web root', () => {
    const duplicate = registry();
    duplicate.batches[2]!.batch_id = 'batch-2';
    expect(() => parseStoryAgentVisualAssetPressureBatchRegistry(duplicate))
      .toThrow('duplicate batch_id: batch-2');

    const traversal = registry();
    traversal.batches[2]!.manifest_path = '../outside/manifest.json';
    expect(() => parseStoryAgentVisualAssetPressureBatchRegistry(traversal))
      .toThrow('batch-3 manifest_path must stay beneath the web root');
  });

  it('merges every registered batch and derives aggregate counts', () => {
    const merged = mergeStoryAgentVisualAssetPressureBatches([
      loadedBatch('baseline', 'world-1'),
      loadedBatch('batch-2', 'world-2'),
      loadedBatch('batch-3', 'world-3'),
    ]);

    expect(merged.manifest.assets).toHaveLength(3);
    expect(merged.binding_report).toMatchObject({
      status: 'passed',
      asset_count: 3,
      immutable_preview_verified_count: 3,
      identity_mapping_current_count: 3,
      visual_semantic_gate_passed_count: 3,
      shot_binding_count: 27,
      unbound_shot_count: 0,
      production_credit_count: 0,
    });
    expect(merged.style_map.style_families).toEqual({
      'world-1': 'world-1-style',
      'world-2': 'world-2-style',
      'world-3': 'world-3-style',
    });
    expect(merged.summary).toMatchObject({
      batch_count: 3,
      seed_count: 3,
      manifest_asset_count: 3,
      binding_asset_count: 3,
    });
  });

  it('fails closed on duplicate seeds, missing styles, or provider drift', () => {
    expect(() => mergeStoryAgentVisualAssetPressureBatches([
      loadedBatch('baseline', 'same-world'),
      loadedBatch('batch-2', 'same-world'),
    ])).toThrow('duplicate seed_id across batches: same-world');

    const missingStyle = loadedBatch('baseline', 'world-1');
    missingStyle.style_map.style_families = {};
    expect(() => mergeStoryAgentVisualAssetPressureBatches([missingStyle]))
      .toThrow('baseline missing style family for seed_id: world-1');

    const providerDrift = loadedBatch('batch-2', 'world-2');
    providerDrift.manifest.provider = 'other_provider';
    providerDrift.binding_report.provider = 'other_provider';
    expect(() => mergeStoryAgentVisualAssetPressureBatches([
      loadedBatch('baseline', 'world-1'),
      providerDrift,
    ])).toThrow('batch-2 provider/model does not match baseline');
  });
});
