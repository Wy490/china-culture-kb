import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  auditStoryAgentVisualAssetPressureReceiptRegistry,
} from '../services/story-agent-visual-asset-pressure-receipt-registry-audit-service.js';

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

async function fixture() {
  const webRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-receipt-registry-'));
  roots.push(webRoot);
  const receiptPath = 'server/scripts/sealed-receipt.json';
  const promptPath = 'generated/sealed/prompt.txt';
  const sourcePath = 'generated/sealed/source.png';
  const prompt = 'registry sealed prompt';
  const source = pngHeader(1024, 1536);
  const receipt = {
    schema_version: 'story-agent-visual-asset-pressure-batch-receipt/v1',
    batch_id: 'sealed-batch',
    generated_at: '2026-07-27T06:00:00.000Z',
    provider: 'openai_imagegen',
    model: 'gpt-image-2',
    assets: [{
      seed_id: 'world-1',
      role: 'character',
      provider_asset_id: 'imagegen-built-in-call_registrysealed',
      prompt_path: promptPath,
      prompt_sha256: sha256(prompt),
      source_path: sourcePath,
      content_sha256: sha256(source),
      mime_type: 'image/png',
      width: 1024,
      height: 1536,
    }],
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
  const registry = {
    schema_version: 'story-agent-visual-asset-pressure-batch-registry/v2',
    recovery_report_path: 'generated/recovery.json',
    batches: [
      {
        batch_id: 'legacy-batch',
        receipt_status: 'legacy_unsealed',
        manifest_path: 'generated/legacy/manifest.json',
        binding_report_path: 'generated/legacy/binding-report.json',
        style_map_path: 'generated/legacy/style-map.json',
      },
      {
        batch_id: 'sealed-batch',
        receipt_status: 'sealed',
        receipt_path: receiptPath,
        manifest_path: 'generated/sealed/manifest.json',
        binding_report_path: 'generated/sealed/binding-report.json',
        style_map_path: 'generated/sealed/style-map.json',
      },
    ],
  };
  await Promise.all([
    mkdir(resolve(webRoot, 'server/scripts'), { recursive: true }),
    mkdir(resolve(webRoot, 'generated/sealed'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(resolve(webRoot, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`),
    writeFile(resolve(webRoot, promptPath), prompt),
    writeFile(resolve(webRoot, sourcePath), source),
  ]);
  return { webRoot, registry, receipt, receiptPath, promptPath };
}

describe('Story Agent visual receipt registry audit', () => {
  it('enumerates legacy batches and verifies every sealed receipt without merged outputs', async () => {
    const item = await fixture();
    const audit = await auditStoryAgentVisualAssetPressureReceiptRegistry({
      registry: item.registry,
      web_root: item.webRoot,
      audited_at: '2026-07-27T06:30:00.000Z',
    });

    expect(audit).toEqual({
      schema_version: 'story-agent-visual-asset-pressure-receipt-registry-audit/v1',
      audited_at: '2026-07-27T06:30:00.000Z',
      status: 'verified',
      batches: [
        {
          batch_id: 'legacy-batch',
          receipt_status: 'legacy_unsealed',
          verification_status: 'not_applicable',
          asset_count: 0,
          verified_asset_count: 0,
          blockers: [],
        },
        {
          batch_id: 'sealed-batch',
          receipt_status: 'sealed',
          verification_status: 'sealed',
          asset_count: 1,
          verified_asset_count: 1,
          blockers: [],
        },
      ],
      summary: {
        batch_count: 2,
        sealed_batch_count: 1,
        verified_sealed_batch_count: 1,
        legacy_unsealed_batch_count: 1,
        receipt_asset_count: 1,
        verified_asset_count: 1,
      },
      blockers: [],
      machine_validation_only: true,
      image_provider_invoked_by_server: false,
      merged_outputs_generated: false,
      video_generation_performed: false,
      production_credit_granted: false,
    });
    expect(JSON.stringify(audit)).not.toContain(item.promptPath);
    expect(JSON.stringify(audit)).not.toContain('prompt_sha256');
  });

  it('fails closed when a sealed receipt source or prompt has drifted', async () => {
    const item = await fixture();
    await writeFile(resolve(item.webRoot, item.promptPath), 'drifted prompt');
    const audit = await auditStoryAgentVisualAssetPressureReceiptRegistry({
      registry: item.registry,
      web_root: item.webRoot,
    });

    expect(audit.status).toBe('blocked');
    expect(audit.summary.verified_sealed_batch_count).toBe(0);
    expect(audit.summary.verified_asset_count).toBe(0);
    expect(audit.batches[1]).toMatchObject({
      batch_id: 'sealed-batch',
      verification_status: 'blocked',
      asset_count: 1,
      verified_asset_count: 0,
    });
    expect(audit.blockers).toContain('sealed-batch:receipt_prompt_sha256_mismatch');
  });

  it('blocks receipt batch-id mismatches and invalid registries', async () => {
    const item = await fixture();
    await writeFile(
      resolve(item.webRoot, item.receiptPath),
      `${JSON.stringify({ ...item.receipt, batch_id: 'other-batch' }, null, 2)}\n`,
    );
    const mismatched = await auditStoryAgentVisualAssetPressureReceiptRegistry({
      registry: item.registry,
      web_root: item.webRoot,
    });
    expect(mismatched.status).toBe('blocked');
    expect(mismatched.blockers).toContain('sealed-batch:receipt_batch_id_mismatch');

    const invalid = await auditStoryAgentVisualAssetPressureReceiptRegistry({
      registry: { schema_version: 'wrong' },
      web_root: item.webRoot,
    });
    expect(invalid).toMatchObject({
      status: 'blocked',
      summary: {
        batch_count: 0,
        sealed_batch_count: 0,
        verified_sealed_batch_count: 0,
        legacy_unsealed_batch_count: 0,
      },
    });
    expect(invalid.blockers[0]).toContain('receipt_registry_invalid:');
  });
});
