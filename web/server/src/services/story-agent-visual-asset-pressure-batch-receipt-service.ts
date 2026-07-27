import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, normalize, resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

export type StoryAgentVisualAssetPressureBatchReceiptAsset = {
  seed_id: string;
  role: 'character' | 'world';
  provider_asset_id: string;
  prompt_path: string;
  prompt_sha256: string;
  source_path: string;
  content_sha256: string;
  mime_type: 'image/png';
  width: number;
  height: number;
};

export type StoryAgentVisualAssetPressureBatchReceipt = {
  schema_version: 'story-agent-visual-asset-pressure-batch-receipt/v1';
  batch_id: string;
  generated_at: string;
  provider: string;
  model: string;
  assets: StoryAgentVisualAssetPressureBatchReceiptAsset[];
  machine_validation_only: true;
  image_provider_invoked_by_server: false;
  video_generation_performed: false;
  production_credit_granted: false;
};

export type StoryAgentVisualAssetPressureBatchReceiptVerification = {
  status: 'sealed' | 'blocked';
  batch_id?: string;
  asset_count: number;
  verified_asset_count: number;
  blockers: string[];
};

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function safeRelativePath(value: unknown, label: string): string {
  const path = requiredString(value, label);
  const normalized = normalize(path).replaceAll('\\', '/');
  if (
    isAbsolute(path)
    || normalized === '..'
    || normalized.startsWith('../')
  ) {
    throw new Error(`${label} must stay beneath the web root`);
  }
  return normalized;
}

function sha256String(value: unknown, label: string): string {
  const digest = requiredString(value, label).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${label} must be SHA-256`);
  }
  return digest;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Number(value);
}

function isoTimestamp(value: unknown, label: string): string {
  const timestamp = requiredString(value, label);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return timestamp;
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const buffer = Buffer.from(bytes);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    buffer.length < 24
    || !buffer.subarray(0, 8).equals(pngSignature)
    || buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new Error('source is not a PNG with an IHDR header');
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1) {
    throw new Error('PNG dimensions must be positive');
  }
  return { width, height };
}

export function parseStoryAgentVisualAssetPressureBatchReceipt(
  value: unknown,
): StoryAgentVisualAssetPressureBatchReceipt {
  const input = asObject(value, 'batch receipt');
  if (
    input.schema_version
    !== 'story-agent-visual-asset-pressure-batch-receipt/v1'
  ) {
    throw new Error(
      `unsupported batch receipt schema: ${String(input.schema_version ?? '')}`,
    );
  }
  if (!Array.isArray(input.assets) || input.assets.length < 1) {
    throw new Error('batch receipt must declare at least one asset');
  }
  if (
    input.machine_validation_only !== true
    || input.image_provider_invoked_by_server !== false
    || input.video_generation_performed !== false
    || input.production_credit_granted !== false
  ) {
    throw new Error('batch receipt execution boundary is invalid');
  }

  const seedRoles = new Set<string>();
  const providerAssetIds = new Set<string>();
  const assets = input.assets.map((rawAsset, index) => {
    const label = `receipt assets[${index}]`;
    const asset = asObject(rawAsset, label);
    const seedId = requiredString(asset.seed_id, `${label} seed_id`);
    if (asset.role !== 'character' && asset.role !== 'world') {
      throw new Error(`${label} role must be character or world`);
    }
    const role: 'character' | 'world' = asset.role;
    const seedRole = `${seedId}:${role}`;
    if (seedRoles.has(seedRole)) {
      throw new Error(`duplicate receipt seed role: ${seedRole}`);
    }
    seedRoles.add(seedRole);
    const providerAssetId = requiredString(
      asset.provider_asset_id,
      `${label} provider_asset_id`,
    );
    if (!/^imagegen-built-in-call_[A-Za-z0-9]+$/.test(providerAssetId)) {
      throw new Error(
        `${label} provider_asset_id must be an immutable built-in ImageGen call id`,
      );
    }
    if (providerAssetIds.has(providerAssetId)) {
      throw new Error(`duplicate receipt provider_asset_id: ${providerAssetId}`);
    }
    providerAssetIds.add(providerAssetId);
    if (asset.mime_type !== 'image/png') {
      throw new Error(`${label} mime_type must be image/png`);
    }
    return {
      seed_id: seedId,
      role,
      provider_asset_id: providerAssetId,
      prompt_path: safeRelativePath(asset.prompt_path, `${label} prompt_path`),
      prompt_sha256: sha256String(asset.prompt_sha256, `${label} prompt_sha256`),
      source_path: safeRelativePath(asset.source_path, `${label} source_path`),
      content_sha256: sha256String(asset.content_sha256, `${label} content_sha256`),
      mime_type: 'image/png' as const,
      width: positiveInteger(asset.width, `${label} width`),
      height: positiveInteger(asset.height, `${label} height`),
    };
  });

  return {
    schema_version: 'story-agent-visual-asset-pressure-batch-receipt/v1',
    batch_id: requiredString(input.batch_id, 'batch receipt batch_id'),
    generated_at: isoTimestamp(input.generated_at, 'batch receipt generated_at'),
    provider: requiredString(input.provider, 'batch receipt provider'),
    model: requiredString(input.model, 'batch receipt model'),
    assets,
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}

export async function verifyStoryAgentVisualAssetPressureBatchReceipt(input: {
  receipt: unknown;
  web_root: string;
}): Promise<StoryAgentVisualAssetPressureBatchReceiptVerification> {
  let receipt: StoryAgentVisualAssetPressureBatchReceipt;
  try {
    receipt = parseStoryAgentVisualAssetPressureBatchReceipt(input.receipt);
  } catch (error) {
    return {
      status: 'blocked',
      asset_count: 0,
      verified_asset_count: 0,
      blockers: [`receipt_invalid:${(error as Error).message}`],
    };
  }

  const blockers: string[] = [];
  let verifiedAssetCount = 0;
  for (const asset of receipt.assets) {
    let assetVerified = true;
    try {
      const promptBytes = await readFile(resolve(input.web_root, asset.prompt_path));
      if (sha256(promptBytes) !== asset.prompt_sha256) {
        blockers.push(`receipt_prompt_sha256_mismatch:${asset.prompt_path}`);
        assetVerified = false;
      }
    } catch {
      blockers.push(`receipt_prompt_unreadable:${asset.prompt_path}`);
      assetVerified = false;
    }

    try {
      const sourceBytes = await readFile(resolve(input.web_root, asset.source_path));
      if (sha256(sourceBytes) !== asset.content_sha256) {
        blockers.push(`receipt_content_sha256_mismatch:${asset.source_path}`);
        assetVerified = false;
      }
      try {
        const actual = pngDimensions(sourceBytes);
        if (actual.width !== asset.width || actual.height !== asset.height) {
          blockers.push(
            `receipt_image_dimensions_mismatch:${asset.source_path}:`
            + `${actual.width}x${actual.height}:${asset.width}x${asset.height}`,
          );
          assetVerified = false;
        }
      } catch (error) {
        blockers.push(
          `receipt_image_invalid:${asset.source_path}:${(error as Error).message}`,
        );
        assetVerified = false;
      }
    } catch {
      blockers.push(`receipt_source_unreadable:${asset.source_path}`);
      assetVerified = false;
    }

    if (assetVerified) {
      verifiedAssetCount += 1;
    }
  }

  const uniqueBlockers = [...new Set(blockers)];
  return {
    status: uniqueBlockers.length === 0
      && verifiedAssetCount === receipt.assets.length
      ? 'sealed'
      : 'blocked',
    batch_id: receipt.batch_id,
    asset_count: receipt.assets.length,
    verified_asset_count: verifiedAssetCount,
    blockers: uniqueBlockers,
  };
}
