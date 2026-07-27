import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStoryAgentVisualAssetPressureReceiptEvidenceBundle,
} from '../services/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.js';
import {
  parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
  verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
} from '../services/story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.js';

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
  const webRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-descriptor-'));
  roots.push(webRoot);
  const promptPath = 'generated/batch/prompt.txt';
  const sourcePath = 'generated/batch/source.png';
  const prompt = Buffer.from('descriptor prompt');
  const source = pngHeader(1024, 1536);
  await mkdir(resolve(webRoot, 'generated/batch'), { recursive: true });
  await Promise.all([
    writeFile(resolve(webRoot, promptPath), prompt),
    writeFile(resolve(webRoot, sourcePath), source),
  ]);
  const receipt = {
    schema_version: 'story-agent-visual-asset-pressure-batch-receipt/v1',
    batch_id: 'descriptor-batch',
    generated_at: '2026-07-27T08:00:00.000Z',
    provider: 'openai_imagegen',
    model: 'gpt-image-2',
    assets: [{
      seed_id: 'world-1',
      role: 'character',
      provider_asset_id: 'imagegen-built-in-call_descriptor',
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
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const bundle = await buildStoryAgentVisualAssetPressureReceiptEvidenceBundle({
    receipt,
    receipt_bytes: receiptBytes,
    web_root: webRoot,
  });
  const bundleBytes = Buffer.from(`${JSON.stringify(bundle)}\n`);
  const descriptor = {
    schema_version:
      'story-agent-visual-asset-pressure-receipt-evidence-descriptor/v1',
    batch_id: 'descriptor-batch',
    receipt_content_sha256: sha256(receiptBytes),
    bundle_file_name: 'descriptor-batch-receipt-evidence-bundle.json',
    bundle_schema_version:
      'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1',
    bundle_content_sha256: sha256(bundleBytes),
    bundle_byte_length: bundleBytes.length,
    file_count: bundle.summary.file_count,
    prompt_file_count: bundle.summary.prompt_file_count,
    source_file_count: bundle.summary.source_file_count,
    total_evidence_byte_count: bundle.summary.total_byte_count,
    machine_validation_only: true,
    external_location_declared: false,
    rights_granted: false,
    human_review_performed: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
  return { receiptBytes, bundleBytes, descriptor };
}

describe('Story Agent committed evidence bundle descriptor', () => {
  it('locks exact receipt and deterministic bundle bytes plus bounded counts', async () => {
    const item = await fixture();
    expect(parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
      item.descriptor,
    )).toEqual(item.descriptor);
    await expect(verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor({
      descriptor: item.descriptor,
      receipt_bytes: item.receiptBytes,
      bundle_bytes: item.bundleBytes,
    })).resolves.toEqual({
      status: 'verified',
      batch_id: 'descriptor-batch',
      bundle_byte_length: item.bundleBytes.length,
      file_count: 2,
      blockers: [],
    });
  });

  it('blocks transport drift and receipt drift even when JSON remains parseable', async () => {
    const item = await fixture();
    const bundleDrift = await verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor({
      descriptor: item.descriptor,
      receipt_bytes: item.receiptBytes,
      bundle_bytes: Buffer.concat([item.bundleBytes, Buffer.from('\n')]),
    });
    expect(bundleDrift.status).toBe('blocked');
    expect(bundleDrift.blockers).toContain('descriptor_bundle_sha256_mismatch');
    expect(bundleDrift.blockers).toContain('descriptor_bundle_byte_length_mismatch');

    const receiptDrift = await verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor({
      descriptor: item.descriptor,
      receipt_bytes: Buffer.concat([item.receiptBytes, Buffer.from('\n')]),
      bundle_bytes: item.bundleBytes,
    });
    expect(receiptDrift.status).toBe('blocked');
    expect(receiptDrift.blockers).toContain('descriptor_receipt_sha256_mismatch');
  });

  it('rejects external locations and authority claims in a descriptor', async () => {
    const item = await fixture();
    expect(() => parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor({
      ...item.descriptor,
      bundle_file_name: 'https://example.com/evidence.json',
    })).toThrow('bundle_file_name must be a portable file name');
    expect(() => parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor({
      ...item.descriptor,
      rights_granted: true,
    })).toThrow('evidence descriptor execution boundary is invalid');
  });
});
