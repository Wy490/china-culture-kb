import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStoryAgentVisualAssetPressureReceiptEvidenceBundle,
  parseStoryAgentVisualAssetPressureReceiptEvidenceBundle,
  restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle,
} from '../services/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.js';
import {
  verifyStoryAgentVisualAssetPressureBatchReceipt,
} from '../services/story-agent-visual-asset-pressure-batch-receipt-service.js';
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
  const webRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-receipt-bundle-'));
  roots.push(webRoot);
  const values = {
    characterPrompt: Buffer.from('character exact prompt'),
    worldPrompt: Buffer.from('world exact prompt'),
    characterSource: pngHeader(1024, 1536),
    worldSource: pngHeader(1536, 1024),
  };
  const paths = {
    characterPrompt: 'generated/batch/prompts/world-1-character.txt',
    worldPrompt: 'generated/batch/prompts/world-1-world.txt',
    characterSource: 'generated/batch/sources/world-1-character.png',
    worldSource: 'generated/batch/sources/world-1-world.png',
  };
  const receipt = {
    schema_version: 'story-agent-visual-asset-pressure-batch-receipt/v1',
    batch_id: 'sealed-batch',
    generated_at: '2026-07-27T06:00:00.000Z',
    provider: 'openai_imagegen',
    model: 'gpt-image-2',
    assets: [
      {
        seed_id: 'world-1',
        role: 'character',
        provider_asset_id: 'imagegen-built-in-call_bundlecharacter',
        prompt_path: paths.characterPrompt,
        prompt_sha256: sha256(values.characterPrompt),
        source_path: paths.characterSource,
        content_sha256: sha256(values.characterSource),
        mime_type: 'image/png',
        width: 1024,
        height: 1536,
      },
      {
        seed_id: 'world-1',
        role: 'world',
        provider_asset_id: 'imagegen-built-in-call_bundleworld',
        prompt_path: paths.worldPrompt,
        prompt_sha256: sha256(values.worldPrompt),
        source_path: paths.worldSource,
        content_sha256: sha256(values.worldSource),
        mime_type: 'image/png',
        width: 1536,
        height: 1024,
      },
    ],
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  for (const [key, relativePath] of Object.entries(paths)) {
    const absolutePath = resolve(webRoot, relativePath);
    await mkdir(resolve(absolutePath, '..'), { recursive: true });
    await writeFile(absolutePath, values[key as keyof typeof values]);
  }
  return { webRoot, values, paths, receipt, receiptBytes };
}

describe('Story Agent sealed receipt evidence bundle', () => {
  it('builds a deterministic bundle and safely restores a clean evidence workspace', async () => {
    const item = await fixture();
    const bundle = await buildStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      receipt: item.receipt,
      receipt_bytes: item.receiptBytes,
      web_root: item.webRoot,
    });
    const repeated = await buildStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      receipt: item.receipt,
      receipt_bytes: item.receiptBytes,
      web_root: item.webRoot,
    });

    expect(bundle).toEqual(repeated);
    expect(bundle).toMatchObject({
      schema_version:
        'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1',
      batch_id: 'sealed-batch',
      receipt_content_sha256: sha256(item.receiptBytes),
      summary: {
        file_count: 4,
        prompt_file_count: 2,
        source_file_count: 2,
        total_byte_count: Object.values(item.values)
          .reduce((total, value) => total + value.length, 0),
      },
      machine_validation_only: true,
      image_provider_invoked_by_server: false,
      rights_granted: false,
      human_review_performed: false,
      video_generation_performed: false,
      production_credit_granted: false,
    });
    expect(bundle.files.map(file => file.relative_path)).toEqual(
      [...Object.values(item.paths)].sort(),
    );

    await Promise.all(Object.values(item.paths).map(path => (
      rm(resolve(item.webRoot, path))
    )));
    const restored = await restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      bundle,
      receipt: item.receipt,
      receipt_bytes: item.receiptBytes,
      web_root: item.webRoot,
    });
    expect(restored).toEqual({
      status: 'restored',
      batch_id: 'sealed-batch',
      file_count: 4,
      restored_file_count: 4,
      existing_file_count: 0,
      blockers: [],
    });
    await expect(verifyStoryAgentVisualAssetPressureBatchReceipt({
      receipt: item.receipt,
      web_root: item.webRoot,
    })).resolves.toMatchObject({
      status: 'sealed',
      verified_asset_count: 2,
    });
    const receiptPath = 'server/scripts/receipt.json';
    await mkdir(resolve(item.webRoot, 'server/scripts'), { recursive: true });
    await writeFile(resolve(item.webRoot, receiptPath), item.receiptBytes);
    await expect(auditStoryAgentVisualAssetPressureReceiptRegistry({
      registry: {
        schema_version: 'story-agent-visual-asset-pressure-batch-registry/v2',
        recovery_report_path: 'generated/recovery.json',
        batches: [{
          batch_id: 'sealed-batch',
          receipt_status: 'sealed',
          receipt_path: receiptPath,
          manifest_path: 'generated/batch/manifest.json',
          binding_report_path: 'generated/batch/binding-report.json',
          style_map_path: 'generated/batch/style-map.json',
        }],
      },
      web_root: item.webRoot,
    })).resolves.toMatchObject({
      status: 'verified',
      summary: {
        sealed_batch_count: 1,
        verified_sealed_batch_count: 1,
        receipt_asset_count: 2,
        verified_asset_count: 2,
      },
    });

    await expect(restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      bundle,
      receipt: item.receipt,
      receipt_bytes: item.receiptBytes,
      web_root: item.webRoot,
    })).resolves.toEqual({
      status: 'verified_existing',
      batch_id: 'sealed-batch',
      file_count: 4,
      restored_file_count: 0,
      existing_file_count: 4,
      blockers: [],
    });
  });

  it('rejects tampered bundle bytes and a bundle bound to another receipt', async () => {
    const item = await fixture();
    const bundle = await buildStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      receipt: item.receipt,
      receipt_bytes: item.receiptBytes,
      web_root: item.webRoot,
    });
    expect(() => parseStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      ...bundle,
      files: [{
        ...bundle.files[0],
        content_base64: Buffer.from('tampered').toString('base64'),
      }, ...bundle.files.slice(1)],
    })).toThrow('bundle files[0] byte_length mismatch');

    const differentReceiptBytes = Buffer.concat([
      item.receiptBytes,
      Buffer.from('\n'),
    ]);
    const result = await restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      bundle,
      receipt: item.receipt,
      receipt_bytes: differentReceiptBytes,
      web_root: item.webRoot,
    });
    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('bundle_receipt_sha256_mismatch');
  });

  it('never overwrites a conflicting existing evidence file or partially restores peers', async () => {
    const item = await fixture();
    const bundle = await buildStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      receipt: item.receipt,
      receipt_bytes: item.receiptBytes,
      web_root: item.webRoot,
    });
    await Promise.all(Object.values(item.paths).map(path => (
      rm(resolve(item.webRoot, path))
    )));
    await writeFile(
      resolve(item.webRoot, item.paths.characterPrompt),
      'operator-owned conflicting bytes',
    );

    const result = await restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle({
      bundle,
      receipt: item.receipt,
      receipt_bytes: item.receiptBytes,
      web_root: item.webRoot,
    });
    expect(result.status).toBe('blocked');
    expect(result.restored_file_count).toBe(0);
    expect(result.blockers).toContain(
      `restore_target_conflict:${item.paths.characterPrompt}`,
    );
    await expect(readFile(resolve(item.webRoot, item.paths.worldPrompt)))
      .rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(resolve(item.webRoot, item.paths.characterPrompt), 'utf8'))
      .resolves.toBe('operator-owned conflicting bytes');
  });
});
