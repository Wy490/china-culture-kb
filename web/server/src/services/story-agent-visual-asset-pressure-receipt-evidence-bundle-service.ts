import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, normalize, resolve } from 'node:path';
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  verifyStoryAgentVisualAssetPressureBatchReceipt,
  type StoryAgentVisualAssetPressureBatchReceipt,
} from './story-agent-visual-asset-pressure-batch-receipt-service.js';

type JsonObject = Record<string, unknown>;

type ReceiptEvidenceBundleFile = {
  relative_path: string;
  kind: 'prompt' | 'source';
  media_type: 'text/plain;charset=utf-8' | 'image/png';
  content_sha256: string;
  byte_length: number;
  encoding: 'base64';
  content_base64: string;
};

export type StoryAgentVisualAssetPressureReceiptEvidenceBundle = {
  schema_version:
    'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1';
  batch_id: string;
  receipt_content_sha256: string;
  files: ReceiptEvidenceBundleFile[];
  summary: {
    file_count: number;
    prompt_file_count: number;
    source_file_count: number;
    total_byte_count: number;
  };
  machine_validation_only: true;
  image_provider_invoked_by_server: false;
  rights_granted: false;
  human_review_performed: false;
  video_generation_performed: false;
  production_credit_granted: false;
};

export type StoryAgentVisualAssetPressureReceiptEvidenceRestore = {
  status: 'restored' | 'verified_existing' | 'blocked';
  batch_id: string;
  file_count: number;
  restored_file_count: number;
  existing_file_count: number;
  blockers: string[];
};

const MAX_FILE_COUNT = 256;
const MAX_FILE_BYTE_LENGTH = 16 * 1024 * 1024;
const MAX_TOTAL_BYTE_LENGTH = 128 * 1024 * 1024;

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

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function sha256String(value: unknown, label: string): string {
  const digest = requiredString(value, label).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${label} must be SHA-256`);
  }
  return digest;
}

function nonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
  return Number(value);
}

function receiptFromMatchingBytes(input: {
  receipt: unknown;
  receipt_bytes: Uint8Array;
}): StoryAgentVisualAssetPressureBatchReceipt {
  const receipt = parseStoryAgentVisualAssetPressureBatchReceipt(input.receipt);
  let receiptFromBytes: StoryAgentVisualAssetPressureBatchReceipt;
  try {
    receiptFromBytes = parseStoryAgentVisualAssetPressureBatchReceipt(
      JSON.parse(Buffer.from(input.receipt_bytes).toString('utf8')) as unknown,
    );
  } catch (error) {
    throw new Error(`receipt bytes are invalid: ${(error as Error).message}`);
  }
  if (JSON.stringify(receipt) !== JSON.stringify(receiptFromBytes)) {
    throw new Error('receipt object does not match receipt bytes');
  }
  return receiptFromBytes;
}

function expectedReceiptFiles(
  receipt: StoryAgentVisualAssetPressureBatchReceipt,
): Array<{
  relative_path: string;
  kind: 'prompt' | 'source';
  media_type: ReceiptEvidenceBundleFile['media_type'];
  content_sha256: string;
}> {
  const files = receipt.assets.flatMap(asset => [
    {
      relative_path: asset.prompt_path,
      kind: 'prompt' as const,
      media_type: 'text/plain;charset=utf-8' as const,
      content_sha256: asset.prompt_sha256,
    },
    {
      relative_path: asset.source_path,
      kind: 'source' as const,
      media_type: 'image/png' as const,
      content_sha256: asset.content_sha256,
    },
  ]).sort((left, right) => left.relative_path.localeCompare(right.relative_path));
  const paths = new Set<string>();
  for (const file of files) {
    if (paths.has(file.relative_path)) {
      throw new Error(`duplicate receipt evidence path: ${file.relative_path}`);
    }
    paths.add(file.relative_path);
  }
  return files;
}

function decodeCanonicalBase64(value: unknown, label: string): Buffer {
  const encoded = requiredString(value, `${label} content_base64`);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error(`${label} content_base64 must be canonical base64`);
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) {
    throw new Error(`${label} content_base64 must be canonical base64`);
  }
  return bytes;
}

async function assertNoSymlinkComponents(
  webRoot: string,
  relativePath: string,
): Promise<void> {
  let currentPath = webRoot;
  for (const component of relativePath.split('/')) {
    currentPath = resolve(currentPath, component);
    try {
      const entry = await lstat(currentPath);
      if (entry.isSymbolicLink()) {
        throw new Error(`symbolic link is forbidden: ${relativePath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

export async function buildStoryAgentVisualAssetPressureReceiptEvidenceBundle(
  input: {
    receipt: unknown;
    receipt_bytes: Uint8Array;
    web_root: string;
  },
): Promise<StoryAgentVisualAssetPressureReceiptEvidenceBundle> {
  const receipt = receiptFromMatchingBytes(input);
  const verification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
    receipt,
    web_root: input.web_root,
  });
  if (verification.status !== 'sealed') {
    throw new Error(`receipt evidence is not sealed: ${verification.blockers.join(', ')}`);
  }

  const files = await Promise.all(expectedReceiptFiles(receipt).map(async file => {
    await assertNoSymlinkComponents(input.web_root, file.relative_path);
    const bytes = await readFile(resolve(input.web_root, file.relative_path));
    return {
      ...file,
      byte_length: bytes.length,
      encoding: 'base64' as const,
      content_base64: bytes.toString('base64'),
    };
  }));
  const totalByteCount = files.reduce(
    (total, file) => total + file.byte_length,
    0,
  );
  if (
    files.length > MAX_FILE_COUNT
    || files.some(file => file.byte_length > MAX_FILE_BYTE_LENGTH)
    || totalByteCount > MAX_TOTAL_BYTE_LENGTH
  ) {
    throw new Error('receipt evidence exceeds portable bundle limits');
  }
  return {
    schema_version:
      'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1',
    batch_id: receipt.batch_id,
    receipt_content_sha256: sha256(input.receipt_bytes),
    files,
    summary: {
      file_count: files.length,
      prompt_file_count: files.filter(file => file.kind === 'prompt').length,
      source_file_count: files.filter(file => file.kind === 'source').length,
      total_byte_count: totalByteCount,
    },
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    rights_granted: false,
    human_review_performed: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}

export function parseStoryAgentVisualAssetPressureReceiptEvidenceBundle(
  value: unknown,
): StoryAgentVisualAssetPressureReceiptEvidenceBundle {
  const input = asObject(value, 'receipt evidence bundle');
  if (
    input.schema_version
    !== 'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1'
  ) {
    throw new Error(
      `unsupported receipt evidence bundle schema: ${String(input.schema_version ?? '')}`,
    );
  }
  if (
    !Array.isArray(input.files)
    || input.files.length < 1
    || input.files.length > MAX_FILE_COUNT
  ) {
    throw new Error(`receipt evidence bundle files must contain 1-${MAX_FILE_COUNT} items`);
  }
  const paths = new Set<string>();
  let totalByteCount = 0;
  const files = input.files.map((rawFile, index) => {
    const label = `bundle files[${index}]`;
    const file = asObject(rawFile, label);
    const relativePath = safeRelativePath(file.relative_path, `${label} relative_path`);
    if (paths.has(relativePath)) {
      throw new Error(`duplicate bundle relative_path: ${relativePath}`);
    }
    paths.add(relativePath);
    if (file.kind !== 'prompt' && file.kind !== 'source') {
      throw new Error(`${label} kind must be prompt or source`);
    }
    const kind: ReceiptEvidenceBundleFile['kind'] = file.kind;
    const expectedMediaType: ReceiptEvidenceBundleFile['media_type'] = kind === 'prompt'
      ? 'text/plain;charset=utf-8'
      : 'image/png';
    if (file.media_type !== expectedMediaType) {
      throw new Error(`${label} media_type does not match kind`);
    }
    if (file.encoding !== 'base64') {
      throw new Error(`${label} encoding must be base64`);
    }
    const bytes = decodeCanonicalBase64(file.content_base64, label);
    const byteLength = nonnegativeInteger(file.byte_length, `${label} byte_length`);
    if (bytes.length !== byteLength) {
      throw new Error(`${label} byte_length mismatch`);
    }
    if (byteLength > MAX_FILE_BYTE_LENGTH) {
      throw new Error(`${label} exceeds byte limit`);
    }
    const contentSha256 = sha256String(
      file.content_sha256,
      `${label} content_sha256`,
    );
    if (sha256(bytes) !== contentSha256) {
      throw new Error(`${label} content_sha256 mismatch`);
    }
    totalByteCount += byteLength;
    return {
      relative_path: relativePath,
      kind,
      media_type: expectedMediaType,
      content_sha256: contentSha256,
      byte_length: byteLength,
      encoding: 'base64' as const,
      content_base64: bytes.toString('base64'),
    };
  });
  if (totalByteCount > MAX_TOTAL_BYTE_LENGTH) {
    throw new Error('receipt evidence bundle exceeds total byte limit');
  }
  const summary = asObject(input.summary, 'receipt evidence bundle summary');
  const parsed: StoryAgentVisualAssetPressureReceiptEvidenceBundle = {
    schema_version:
      'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1',
    batch_id: requiredString(input.batch_id, 'receipt evidence bundle batch_id'),
    receipt_content_sha256: sha256String(
      input.receipt_content_sha256,
      'receipt evidence bundle receipt_content_sha256',
    ),
    files,
    summary: {
      file_count: nonnegativeInteger(summary.file_count, 'bundle summary file_count'),
      prompt_file_count: nonnegativeInteger(
        summary.prompt_file_count,
        'bundle summary prompt_file_count',
      ),
      source_file_count: nonnegativeInteger(
        summary.source_file_count,
        'bundle summary source_file_count',
      ),
      total_byte_count: nonnegativeInteger(
        summary.total_byte_count,
        'bundle summary total_byte_count',
      ),
    },
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    rights_granted: false,
    human_review_performed: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
  if (
    input.machine_validation_only !== true
    || input.image_provider_invoked_by_server !== false
    || input.rights_granted !== false
    || input.human_review_performed !== false
    || input.video_generation_performed !== false
    || input.production_credit_granted !== false
  ) {
    throw new Error('receipt evidence bundle execution boundary is invalid');
  }
  if (
    parsed.summary.file_count !== files.length
    || parsed.summary.prompt_file_count
      !== files.filter(file => file.kind === 'prompt').length
    || parsed.summary.source_file_count
      !== files.filter(file => file.kind === 'source').length
    || parsed.summary.total_byte_count !== totalByteCount
  ) {
    throw new Error('receipt evidence bundle summary is inconsistent');
  }
  return parsed;
}

function blockedRestore(input: {
  batch_id: string;
  file_count: number;
  existing_file_count?: number;
  blockers: string[];
}): StoryAgentVisualAssetPressureReceiptEvidenceRestore {
  return {
    status: 'blocked',
    batch_id: input.batch_id,
    file_count: input.file_count,
    restored_file_count: 0,
    existing_file_count: input.existing_file_count ?? 0,
    blockers: [...new Set(input.blockers)],
  };
}

export async function restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle(
  input: {
    bundle: unknown;
    receipt: unknown;
    receipt_bytes: Uint8Array;
    web_root: string;
  },
): Promise<StoryAgentVisualAssetPressureReceiptEvidenceRestore> {
  let bundle: StoryAgentVisualAssetPressureReceiptEvidenceBundle;
  let receipt: StoryAgentVisualAssetPressureBatchReceipt;
  try {
    bundle = parseStoryAgentVisualAssetPressureReceiptEvidenceBundle(input.bundle);
    receipt = receiptFromMatchingBytes(input);
  } catch (error) {
    return blockedRestore({
      batch_id: '',
      file_count: 0,
      blockers: [`bundle_or_receipt_invalid:${(error as Error).message}`],
    });
  }
  const blockers: string[] = [];
  if (bundle.batch_id !== receipt.batch_id) {
    blockers.push('bundle_batch_id_mismatch');
  }
  if (bundle.receipt_content_sha256 !== sha256(input.receipt_bytes)) {
    blockers.push('bundle_receipt_sha256_mismatch');
  }
  let expectedFiles: ReturnType<typeof expectedReceiptFiles> = [];
  try {
    expectedFiles = expectedReceiptFiles(receipt);
  } catch (error) {
    blockers.push(`receipt_evidence_paths_invalid:${(error as Error).message}`);
  }
  const bundleByPath = new Map(
    bundle.files.map(file => [file.relative_path, file]),
  );
  for (const expected of expectedFiles) {
    const bundled = bundleByPath.get(expected.relative_path);
    if (
      !bundled
      || bundled.kind !== expected.kind
      || bundled.media_type !== expected.media_type
      || bundled.content_sha256 !== expected.content_sha256
    ) {
      blockers.push(`bundle_receipt_file_mismatch:${expected.relative_path}`);
    }
  }
  for (const bundled of bundle.files) {
    if (!expectedFiles.some(file => file.relative_path === bundled.relative_path)) {
      blockers.push(`bundle_file_not_in_receipt:${bundled.relative_path}`);
    }
  }
  if (blockers.length > 0) {
    return blockedRestore({
      batch_id: receipt.batch_id,
      file_count: bundle.files.length,
      blockers,
    });
  }

  const missing: ReceiptEvidenceBundleFile[] = [];
  let existingFileCount = 0;
  for (const file of bundle.files) {
    try {
      await assertNoSymlinkComponents(input.web_root, file.relative_path);
      const existing = await readFile(resolve(input.web_root, file.relative_path));
      if (sha256(existing) !== file.content_sha256) {
        blockers.push(`restore_target_conflict:${file.relative_path}`);
      } else {
        existingFileCount += 1;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        missing.push(file);
      } else {
        blockers.push(`restore_target_unreadable:${file.relative_path}`);
      }
    }
  }
  if (blockers.length > 0) {
    return blockedRestore({
      batch_id: receipt.batch_id,
      file_count: bundle.files.length,
      existing_file_count: existingFileCount,
      blockers,
    });
  }
  if (missing.length === 0) {
    return {
      status: 'verified_existing',
      batch_id: receipt.batch_id,
      file_count: bundle.files.length,
      restored_file_count: 0,
      existing_file_count: existingFileCount,
      blockers: [],
    };
  }

  const createdPaths: string[] = [];
  try {
    for (const file of missing) {
      const absolutePath = resolve(input.web_root, file.relative_path);
      await mkdir(resolve(absolutePath, '..'), { recursive: true });
      await assertNoSymlinkComponents(input.web_root, file.relative_path);
      await writeFile(
        absolutePath,
        Buffer.from(file.content_base64, 'base64'),
        { flag: 'wx' },
      );
      createdPaths.push(absolutePath);
    }
    const verification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
      receipt,
      web_root: input.web_root,
    });
    if (verification.status !== 'sealed') {
      throw new Error(`restored_receipt_blocked:${verification.blockers.join(',')}`);
    }
  } catch (error) {
    await Promise.all(createdPaths.map(path => unlink(path).catch(() => undefined)));
    return blockedRestore({
      batch_id: receipt.batch_id,
      file_count: bundle.files.length,
      existing_file_count: existingFileCount,
      blockers: [`restore_write_failed:${(error as Error).message}`],
    });
  }
  return {
    status: 'restored',
    batch_id: receipt.batch_id,
    file_count: bundle.files.length,
    restored_file_count: createdPaths.length,
    existing_file_count: existingFileCount,
    blockers: [],
  };
}
