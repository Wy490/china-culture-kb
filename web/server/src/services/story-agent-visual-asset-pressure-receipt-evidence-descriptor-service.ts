import { createHash } from 'node:crypto';
import {
  parseStoryAgentVisualAssetPressureReceiptEvidenceBundle,
} from './story-agent-visual-asset-pressure-receipt-evidence-bundle-service.js';
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
} from './story-agent-visual-asset-pressure-batch-receipt-service.js';

type JsonObject = Record<string, unknown>;

export type StoryAgentVisualAssetPressureReceiptEvidenceDescriptor = {
  schema_version:
    'story-agent-visual-asset-pressure-receipt-evidence-descriptor/v1';
  batch_id: string;
  receipt_content_sha256: string;
  bundle_file_name: string;
  bundle_schema_version:
    'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1';
  bundle_content_sha256: string;
  bundle_byte_length: number;
  file_count: number;
  prompt_file_count: number;
  source_file_count: number;
  total_evidence_byte_count: number;
  machine_validation_only: true;
  external_location_declared: false;
  rights_granted: false;
  human_review_performed: false;
  video_generation_performed: false;
  production_credit_granted: false;
};

export type StoryAgentVisualAssetPressureReceiptEvidenceDescriptorVerification = {
  status: 'verified' | 'blocked';
  batch_id: string;
  bundle_byte_length: number;
  file_count: number;
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

function positiveInteger(value: unknown, label: string): number {
  const result = nonnegativeInteger(value, label);
  if (result < 1) {
    throw new Error(`${label} must be positive`);
  }
  return result;
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
  value: unknown,
): StoryAgentVisualAssetPressureReceiptEvidenceDescriptor {
  const input = asObject(value, 'evidence descriptor');
  if (
    input.schema_version
    !== 'story-agent-visual-asset-pressure-receipt-evidence-descriptor/v1'
  ) {
    throw new Error(
      `unsupported evidence descriptor schema: ${String(input.schema_version ?? '')}`,
    );
  }
  if (
    input.bundle_schema_version
    !== 'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1'
  ) {
    throw new Error('evidence descriptor bundle schema is unsupported');
  }
  const bundleFileName = requiredString(
    input.bundle_file_name,
    'bundle_file_name',
  );
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(bundleFileName)) {
    throw new Error('bundle_file_name must be a portable file name');
  }
  if (
    input.machine_validation_only !== true
    || input.external_location_declared !== false
    || input.rights_granted !== false
    || input.human_review_performed !== false
    || input.video_generation_performed !== false
    || input.production_credit_granted !== false
  ) {
    throw new Error('evidence descriptor execution boundary is invalid');
  }
  const parsed: StoryAgentVisualAssetPressureReceiptEvidenceDescriptor = {
    schema_version:
      'story-agent-visual-asset-pressure-receipt-evidence-descriptor/v1',
    batch_id: requiredString(input.batch_id, 'evidence descriptor batch_id'),
    receipt_content_sha256: sha256String(
      input.receipt_content_sha256,
      'evidence descriptor receipt_content_sha256',
    ),
    bundle_file_name: bundleFileName,
    bundle_schema_version:
      'story-agent-visual-asset-pressure-receipt-evidence-bundle/v1',
    bundle_content_sha256: sha256String(
      input.bundle_content_sha256,
      'evidence descriptor bundle_content_sha256',
    ),
    bundle_byte_length: positiveInteger(
      input.bundle_byte_length,
      'evidence descriptor bundle_byte_length',
    ),
    file_count: positiveInteger(
      input.file_count,
      'evidence descriptor file_count',
    ),
    prompt_file_count: nonnegativeInteger(
      input.prompt_file_count,
      'evidence descriptor prompt_file_count',
    ),
    source_file_count: nonnegativeInteger(
      input.source_file_count,
      'evidence descriptor source_file_count',
    ),
    total_evidence_byte_count: positiveInteger(
      input.total_evidence_byte_count,
      'evidence descriptor total_evidence_byte_count',
    ),
    machine_validation_only: true,
    external_location_declared: false,
    rights_granted: false,
    human_review_performed: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
  if (
    parsed.prompt_file_count + parsed.source_file_count !== parsed.file_count
  ) {
    throw new Error('evidence descriptor file counts are inconsistent');
  }
  return parsed;
}

export async function verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
  input: {
    descriptor: unknown;
    receipt_bytes: Uint8Array;
    bundle_bytes: Uint8Array;
  },
): Promise<StoryAgentVisualAssetPressureReceiptEvidenceDescriptorVerification> {
  let descriptor: StoryAgentVisualAssetPressureReceiptEvidenceDescriptor;
  try {
    descriptor = parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
      input.descriptor,
    );
  } catch (error) {
    return {
      status: 'blocked',
      batch_id: '',
      bundle_byte_length: input.bundle_bytes.length,
      file_count: 0,
      blockers: [`descriptor_invalid:${(error as Error).message}`],
    };
  }
  const blockers: string[] = [];
  if (sha256(input.receipt_bytes) !== descriptor.receipt_content_sha256) {
    blockers.push('descriptor_receipt_sha256_mismatch');
  }
  if (sha256(input.bundle_bytes) !== descriptor.bundle_content_sha256) {
    blockers.push('descriptor_bundle_sha256_mismatch');
  }
  if (input.bundle_bytes.length !== descriptor.bundle_byte_length) {
    blockers.push('descriptor_bundle_byte_length_mismatch');
  }

  try {
    const receipt = parseStoryAgentVisualAssetPressureBatchReceipt(
      JSON.parse(Buffer.from(input.receipt_bytes).toString('utf8')) as unknown,
    );
    const bundle = parseStoryAgentVisualAssetPressureReceiptEvidenceBundle(
      JSON.parse(Buffer.from(input.bundle_bytes).toString('utf8')) as unknown,
    );
    if (
      receipt.batch_id !== descriptor.batch_id
      || bundle.batch_id !== descriptor.batch_id
    ) {
      blockers.push('descriptor_batch_id_mismatch');
    }
    if (
      bundle.receipt_content_sha256 !== descriptor.receipt_content_sha256
      || bundle.receipt_content_sha256 !== sha256(input.receipt_bytes)
    ) {
      blockers.push('descriptor_bundle_receipt_sha256_mismatch');
    }
    if (
      bundle.schema_version !== descriptor.bundle_schema_version
      || bundle.summary.file_count !== descriptor.file_count
      || bundle.summary.prompt_file_count !== descriptor.prompt_file_count
      || bundle.summary.source_file_count !== descriptor.source_file_count
      || bundle.summary.total_byte_count !== descriptor.total_evidence_byte_count
    ) {
      blockers.push('descriptor_bundle_summary_mismatch');
    }
  } catch (error) {
    blockers.push(`descriptor_payload_invalid:${(error as Error).message}`);
  }
  const uniqueBlockers = [...new Set(blockers)];
  return {
    status: uniqueBlockers.length === 0 ? 'verified' : 'blocked',
    batch_id: descriptor.batch_id,
    bundle_byte_length: input.bundle_bytes.length,
    file_count: descriptor.file_count,
    blockers: uniqueBlockers,
  };
}
