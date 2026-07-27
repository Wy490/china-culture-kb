import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  verifyStoryAgentVisualAssetPressureBatchReceipt,
} from '../services/story-agent-visual-asset-pressure-batch-receipt-service.js';

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
  const webRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-visual-receipt-'));
  roots.push(webRoot);
  const promptPath = 'generated/batch/prompts/world-1-character.txt';
  const sourcePath = 'generated/batch/sources/world-1-character.png';
  const prompt = 'immutable exact ImageGen prompt';
  const source = pngHeader(1536, 1024);
  await Promise.all([
    mkdir(resolve(webRoot, 'generated/batch/prompts'), { recursive: true }),
    mkdir(resolve(webRoot, 'generated/batch/sources'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(resolve(webRoot, promptPath), prompt),
    writeFile(resolve(webRoot, sourcePath), source),
  ]);
  const receipt = {
    schema_version: 'story-agent-visual-asset-pressure-batch-receipt/v1',
    batch_id: 'batch-3',
    generated_at: '2026-07-26T03:00:00.000Z',
    provider: 'openai_imagegen',
    model: 'gpt-image-2',
    assets: [{
      seed_id: 'world-1',
      role: 'character',
      provider_asset_id: 'imagegen-built-in-call_immutable',
      prompt_path: promptPath,
      prompt_sha256: sha256(prompt),
      source_path: sourcePath,
      content_sha256: sha256(source),
      mime_type: 'image/png',
      width: 1536,
      height: 1024,
    }],
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  } as const;
  return { webRoot, promptPath, sourcePath, prompt, source, receipt };
}

describe('Story Agent immutable visual pressure batch receipt', () => {
  it('seals provider call ids, exact prompts, source bytes, dimensions, and seed roles', async () => {
    const item = await fixture();
    const verification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
      receipt: item.receipt,
      web_root: item.webRoot,
    });

    expect(parseStoryAgentVisualAssetPressureBatchReceipt(item.receipt)).toEqual(item.receipt);
    expect(verification).toEqual({
      status: 'sealed',
      batch_id: 'batch-3',
      asset_count: 1,
      verified_asset_count: 1,
      blockers: [],
    });
  });

  it('fails closed when exact prompt bytes change after the receipt is committed', async () => {
    const item = await fixture();
    await writeFile(resolve(item.webRoot, item.promptPath), `${item.prompt}\nchanged`);

    const verification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
      receipt: item.receipt,
      web_root: item.webRoot,
    });

    expect(verification.status).toBe('blocked');
    expect(verification.verified_asset_count).toBe(0);
    expect(verification.blockers).toContain(
      `receipt_prompt_sha256_mismatch:${item.promptPath}`,
    );
  });

  it('fails closed when image content or dimensions no longer match', async () => {
    const item = await fixture();
    const changed = pngHeader(1024, 1536);
    const receipt = {
      ...item.receipt,
      assets: [{
        ...item.receipt.assets[0],
        content_sha256: sha256(changed),
      }],
    };
    await writeFile(resolve(item.webRoot, item.sourcePath), changed);

    const verification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
      receipt,
      web_root: item.webRoot,
    });

    expect(verification.status).toBe('blocked');
    expect(verification.blockers).toContain(
      `receipt_image_dimensions_mismatch:${item.sourcePath}:1024x1536:1536x1024`,
    );
  });

  it('rejects duplicated seed roles, escaping paths, and invalid execution boundaries', async () => {
    const item = await fixture();
    expect(() => parseStoryAgentVisualAssetPressureBatchReceipt({
      ...item.receipt,
      assets: [item.receipt.assets[0], item.receipt.assets[0]],
    })).toThrow('duplicate receipt seed role: world-1:character');
    expect(() => parseStoryAgentVisualAssetPressureBatchReceipt({
      ...item.receipt,
      assets: [{
        ...item.receipt.assets[0],
        source_path: '../outside.png',
      }],
    })).toThrow('receipt assets[0] source_path must stay beneath the web root');
    expect(() => parseStoryAgentVisualAssetPressureBatchReceipt({
      ...item.receipt,
      production_credit_granted: true,
    })).toThrow('batch receipt execution boundary is invalid');
  });
});
