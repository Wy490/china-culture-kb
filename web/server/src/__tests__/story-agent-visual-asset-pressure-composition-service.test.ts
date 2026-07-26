import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStoryAgentVisualAssetPressureBatchCompositionReport,
  parseStoryAgentVisualAssetPressureBatchCompositionReport,
  verifyStoryAgentVisualAssetPressureBatchCompositionReport,
} from '../services/story-agent-visual-asset-pressure-batch-registry-service.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const webRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-visual-composition-'));
  roots.push(webRoot);
  const paths = {
    registry: 'server/scripts/registry.json',
    recovery: 'generated/recovery.json',
    batchManifest: 'generated/batch/manifest.json',
    batchBinding: 'generated/batch/binding-report.json',
    batchStyle: 'generated/batch/style-map.json',
    outputManifest: 'generated/combined/manifest.json',
    outputBinding: 'generated/combined/binding-report.json',
    outputStyle: 'generated/combined/style-map.json',
    outputRecovery: 'generated/combined/image-recovery-report.json',
  };
  const values = {
    registry: {
      schema_version: 'story-agent-visual-asset-pressure-batch-registry/v1',
      recovery_report_path: paths.recovery,
      batches: [{
        batch_id: 'batch-1',
        manifest_path: paths.batchManifest,
        binding_report_path: paths.batchBinding,
        style_map_path: paths.batchStyle,
      }],
    },
    recovery: { schema_version: 'story-agent-15x3-image-recovery/v1' },
    batchManifest: {
      schema_version: 'story-agent-cross-seed-image-asset-manifest/v1',
      provider: 'openai_imagegen',
      model: 'gpt-image-2',
      assets: [{ seed_id: 'world-1' }],
    },
    batchBinding: {
      schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1',
      assets: [{ seed_id: 'world-1' }],
      series_shot_bindings: [{ seed_id: 'world-1' }],
    },
    batchStyle: {
      schema_version: 'story-agent-visual-asset-pressure-style-map/v1',
      style_families: { 'world-1': 'world-1-style' },
    },
    outputManifest: { schema_version: 'story-agent-cross-seed-image-asset-manifest/v1' },
    outputBinding: { schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1' },
    outputStyle: { schema_version: 'story-agent-visual-asset-pressure-style-map/v1' },
    outputRecovery: { schema_version: 'story-agent-15x3-image-recovery/v1' },
  };
  const bytes = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
    ]),
  ) as Record<keyof typeof values, Buffer>;
  await Promise.all(Object.entries(paths).map(async ([key, path]) => {
    const absolutePath = resolve(webRoot, path);
    await mkdir(resolve(absolutePath, '..'), { recursive: true });
    await writeFile(absolutePath, bytes[key as keyof typeof bytes]);
  }));
  const report = buildStoryAgentVisualAssetPressureBatchCompositionReport({
    generated_at: '2026-07-26T03:00:00.000Z',
    registry: { relative_path: paths.registry, bytes: bytes.registry },
    recovery_report: { relative_path: paths.recovery, bytes: bytes.recovery },
    batches: [{
      batch_id: 'batch-1',
      manifest: { relative_path: paths.batchManifest, bytes: bytes.batchManifest },
      binding_report: { relative_path: paths.batchBinding, bytes: bytes.batchBinding },
      style_map: { relative_path: paths.batchStyle, bytes: bytes.batchStyle },
      seed_count: 1,
      manifest_asset_count: 1,
      binding_asset_count: 1,
      series_count: 1,
    }],
    outputs: {
      manifest: { relative_path: paths.outputManifest, bytes: bytes.outputManifest },
      binding_report: { relative_path: paths.outputBinding, bytes: bytes.outputBinding },
      style_map: { relative_path: paths.outputStyle, bytes: bytes.outputStyle },
      recovery_report: { relative_path: paths.outputRecovery, bytes: bytes.outputRecovery },
    },
  });
  return { webRoot, paths, bytes, report };
}

describe('Story Agent visual pressure batch composition provenance', () => {
  it('verifies the registry, every batch input, and every merged output by SHA', async () => {
    const item = await fixture();
    const verification = await verifyStoryAgentVisualAssetPressureBatchCompositionReport({
      report: item.report,
      web_root: item.webRoot,
      expected_outputs: {
        manifest_path: item.paths.outputManifest,
        binding_report_path: item.paths.outputBinding,
        style_map_path: item.paths.outputStyle,
        recovery_report_path: item.paths.outputRecovery,
      },
    });

    expect(item.report).toMatchObject({
      schema_version: 'story-agent-visual-asset-pressure-batch-composition/v1',
      summary: {
        batch_count: 1,
        source_file_count: 5,
        output_file_count: 4,
        file_count: 9,
      },
    });
    expect(verification).toEqual({
      status: 'verified',
      report_relative_path: undefined,
      registry_content_sha256: item.report.registry.content_sha256,
      batch_count: 1,
      file_count: 9,
      verified_file_count: 9,
      blockers: [],
    });
  });

  it('fails closed when a registered batch input changes after merge', async () => {
    const item = await fixture();
    await writeFile(
      resolve(item.webRoot, item.paths.batchManifest),
      Buffer.concat([item.bytes.batchManifest, Buffer.from('\n')]),
    );

    const verification = await verifyStoryAgentVisualAssetPressureBatchCompositionReport({
      report: item.report,
      report_relative_path: 'generated/combined/composition-report.json',
      web_root: item.webRoot,
      expected_outputs: {
        manifest_path: item.paths.outputManifest,
        binding_report_path: item.paths.outputBinding,
        style_map_path: item.paths.outputStyle,
        recovery_report_path: item.paths.outputRecovery,
      },
    });

    expect(verification.status).toBe('blocked');
    expect(verification.verified_file_count).toBe(8);
    expect(verification.blockers).toContain(
      `composition_sha256_mismatch:${item.paths.batchManifest}`,
    );
  });

  it('rejects invalid timestamps and duplicate batch identifiers', async () => {
    const item = await fixture();
    expect(() => parseStoryAgentVisualAssetPressureBatchCompositionReport({
      ...item.report,
      generated_at: 'not-a-timestamp',
    })).toThrow('composition generated_at must be an ISO timestamp');
    expect(() => parseStoryAgentVisualAssetPressureBatchCompositionReport({
      ...item.report,
      batches: [item.report.batches[0], item.report.batches[0]],
    })).toThrow('composition batch_id values must be unique');
  });

  it('fails closed when the composition batch summary is altered', async () => {
    const item = await fixture();
    const verification = await verifyStoryAgentVisualAssetPressureBatchCompositionReport({
      report: {
        ...item.report,
        batches: [{
          ...item.report.batches[0],
          seed_count: 2,
        }],
      },
      web_root: item.webRoot,
      expected_outputs: {
        manifest_path: item.paths.outputManifest,
        binding_report_path: item.paths.outputBinding,
        style_map_path: item.paths.outputStyle,
        recovery_report_path: item.paths.outputRecovery,
      },
    });

    expect(verification.status).toBe('blocked');
    expect(verification.verified_file_count).toBe(9);
    expect(verification.blockers).toContain(
      'composition_batch_summary_mismatch:batch-1',
    );
  });
});
