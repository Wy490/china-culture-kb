import { createHash } from 'node:crypto';
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

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function pngHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

async function fixture(sealed = false) {
  const webRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-visual-composition-'));
  roots.push(webRoot);
  const paths = {
    registry: 'server/scripts/registry.json',
    recovery: 'generated/recovery.json',
    batchManifest: 'generated/batch/manifest.json',
    batchBinding: 'generated/batch/binding-report.json',
    batchStyle: 'generated/batch/style-map.json',
    batchReceipt: 'server/scripts/batch-receipt.json',
    batchDescriptor: 'server/scripts/batch-evidence-descriptor.json',
    batchPrompt: 'generated/batch/prompts/world-1-character.txt',
    batchSource: 'generated/batch/sources/world-1-character.png',
    outputManifest: 'generated/combined/manifest.json',
    outputBinding: 'generated/combined/binding-report.json',
    outputStyle: 'generated/combined/style-map.json',
    outputRecovery: 'generated/combined/image-recovery-report.json',
  };
  const batchPrompt = 'sealed exact prompt';
  const batchSource = pngHeader(1024, 1536);
  const batchReceipt = {
    schema_version: 'story-agent-visual-asset-pressure-batch-receipt/v1',
    batch_id: 'batch-1',
    generated_at: '2026-07-26T03:00:00.000Z',
    provider: 'openai_imagegen',
    model: 'gpt-image-2',
    assets: [{
      seed_id: 'world-1',
      role: 'character',
      provider_asset_id: 'imagegen-built-in-call_sealed',
      prompt_path: paths.batchPrompt,
      prompt_sha256: sha256(batchPrompt),
      source_path: paths.batchSource,
      content_sha256: sha256(batchSource),
      mime_type: 'image/png',
      width: 1024,
      height: 1536,
    }],
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
  const batchReceiptBytes = Buffer.from(
    `${JSON.stringify(batchReceipt, null, 2)}\n`,
  );
  const values = {
    registry: {
      schema_version: 'story-agent-visual-asset-pressure-batch-registry/v3',
      recovery_report_path: paths.recovery,
      batches: [{
        batch_id: 'batch-1',
        receipt_status: sealed ? 'sealed' : 'legacy_unsealed',
        ...(sealed
          ? {
              receipt_path: paths.batchReceipt,
              evidence_descriptor_path: paths.batchDescriptor,
            }
          : {}),
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
      assets: [{
        seed_id: 'world-1',
        kind: 'character',
        provider_asset_id: 'imagegen-built-in-call_sealed',
        prompt_path: paths.batchPrompt,
        prompt_sha256: sha256(batchPrompt),
        source_path: paths.batchSource,
        content_sha256: sha256(batchSource),
      }],
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
    batchReceipt,
    batchDescriptor: {
      schema_version:
        'story-agent-visual-asset-pressure-receipt-evidence-descriptor/v1',
      batch_id: 'batch-1',
      receipt_content_sha256: sha256(batchReceiptBytes),
      bundle_file_name: 'batch-1-receipt-evidence-bundle.json',
      bundle_schema_version:
        'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1',
      bundle_content_sha256: 'a'.repeat(64),
      bundle_byte_length: 1024,
      file_count: 2,
      prompt_file_count: 1,
      source_file_count: 1,
      total_evidence_byte_count: batchPrompt.length + batchSource.length,
      machine_validation_only: true,
      external_location_declared: false,
      rights_granted: false,
      human_review_performed: false,
      video_generation_performed: false,
      production_credit_granted: false,
    },
    batchPrompt,
    batchSource,
    outputManifest: { schema_version: 'story-agent-cross-seed-image-asset-manifest/v1' },
    outputBinding: { schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1' },
    outputStyle: { schema_version: 'story-agent-visual-asset-pressure-style-map/v1' },
    outputRecovery: { schema_version: 'story-agent-15x3-image-recovery/v1' },
  };
  const bytes = Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key,
    Buffer.isBuffer(value)
      ? value
      : Buffer.from(typeof value === 'string'
        ? value
        : `${JSON.stringify(value, null, 2)}\n`),
  ])) as Record<keyof typeof values, Buffer>;
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
      receipt_status: sealed ? 'sealed' : 'legacy_unsealed',
      ...(sealed
        ? {
            receipt: {
              relative_path: paths.batchReceipt,
              bytes: bytes.batchReceipt,
            },
            evidence_descriptor: {
              relative_path: paths.batchDescriptor,
              bytes: bytes.batchDescriptor,
            },
          }
        : {}),
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
      schema_version: 'story-agent-visual-asset-pressure-batch-composition/v3',
      summary: {
        batch_count: 1,
        source_file_count: 5,
        output_file_count: 4,
        file_count: 9,
        sealed_batch_count: 0,
        legacy_unsealed_batch_count: 1,
      },
    });
    expect(verification).toEqual({
      status: 'verified',
      report_relative_path: undefined,
      registry_content_sha256: item.report.registry.content_sha256,
      batch_count: 1,
      sealed_batch_count: 0,
      legacy_unsealed_batch_count: 1,
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

  it('re-verifies sealed receipt prompt and source bytes during composition checks', async () => {
    const item = await fixture(true);
    const initial = await verifyStoryAgentVisualAssetPressureBatchCompositionReport({
      report: item.report,
      web_root: item.webRoot,
      expected_outputs: {
        manifest_path: item.paths.outputManifest,
        binding_report_path: item.paths.outputBinding,
        style_map_path: item.paths.outputStyle,
        recovery_report_path: item.paths.outputRecovery,
      },
    });
    expect(initial).toMatchObject({
      status: 'verified',
      sealed_batch_count: 1,
      legacy_unsealed_batch_count: 0,
      file_count: 11,
      verified_file_count: 11,
    });

    await writeFile(
      resolve(item.webRoot, item.paths.batchPrompt),
      'silently replaced prompt',
    );
    const changed = await verifyStoryAgentVisualAssetPressureBatchCompositionReport({
      report: item.report,
      web_root: item.webRoot,
      expected_outputs: {
        manifest_path: item.paths.outputManifest,
        binding_report_path: item.paths.outputBinding,
        style_map_path: item.paths.outputStyle,
        recovery_report_path: item.paths.outputRecovery,
      },
    });
    expect(changed.status).toBe('blocked');
    expect(changed.blockers).toContain(
      `composition_receipt_blocked:batch-1:`
      + `receipt_prompt_sha256_mismatch:${item.paths.batchPrompt}`,
    );
  });

  it('binds sealed descriptor evidence to the exact registered receipt bytes', async () => {
    const item = await fixture(true);
    const changedDescriptor = Buffer.from(`${JSON.stringify({
      ...JSON.parse(item.bytes.batchDescriptor.toString('utf8')) as object,
      receipt_content_sha256: 'b'.repeat(64),
    }, null, 2)}\n`);
    await writeFile(
      resolve(item.webRoot, item.paths.batchDescriptor),
      changedDescriptor,
    );
    const verification =
      await verifyStoryAgentVisualAssetPressureBatchCompositionReport({
        report: {
          ...item.report,
          batches: [{
            ...item.report.batches[0]!,
            evidence_descriptor: {
              relative_path: item.paths.batchDescriptor,
              content_sha256: sha256(changedDescriptor),
            },
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
    expect(verification.blockers).toContain(
      'composition_descriptor_receipt_sha256_mismatch:batch-1',
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
