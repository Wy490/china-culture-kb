import { createHash } from 'node:crypto';
import {
  parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
  verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
} from './story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.js';

export type StoryAgentVisualAssetPressureReceiptEvidencePreflight = {
  schema_version:
    'story-agent-visual-asset-pressure-receipt-evidence-preflight/v1';
  status: 'verified' | 'blocked';
  batch_id: string;
  bundle_file_name: string;
  receipt_content_sha256: string;
  bundle_content_sha256: string;
  bundle_byte_length: number;
  file_count: number;
  blockers: string[];
  artifact_bytes_verified: boolean;
  machine_validation_only: true;
  external_location_declared: false;
  external_artifact_download_verified_by_transport: false;
  rights_granted: false;
  human_review_performed: false;
  video_generation_performed: false;
  production_credit_granted: false;
};

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function preflightStoryAgentVisualAssetPressureReceiptEvidence(
  input: {
    descriptor: unknown;
    receipt_bytes: Uint8Array;
    bundle_bytes: Uint8Array;
    bundle_file_name: string;
  },
): Promise<StoryAgentVisualAssetPressureReceiptEvidencePreflight> {
  const verification =
    await verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor({
      descriptor: input.descriptor,
      receipt_bytes: input.receipt_bytes,
      bundle_bytes: input.bundle_bytes,
    });
  const blockers = [...verification.blockers];
  let expectedBundleFileName = '';
  try {
    const descriptor =
      parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
        input.descriptor,
      );
    expectedBundleFileName = descriptor.bundle_file_name;
    if (input.bundle_file_name !== descriptor.bundle_file_name) {
      blockers.push('preflight_bundle_file_name_mismatch');
    }
  } catch {
    // The descriptor verifier already emits a bounded descriptor_invalid blocker.
  }
  const uniqueBlockers = [...new Set(blockers)];
  const status = uniqueBlockers.length === 0 ? 'verified' : 'blocked';
  return {
    schema_version:
      'story-agent-visual-asset-pressure-receipt-evidence-preflight/v1',
    status,
    batch_id: verification.batch_id,
    bundle_file_name: expectedBundleFileName || input.bundle_file_name,
    receipt_content_sha256: sha256(input.receipt_bytes),
    bundle_content_sha256: sha256(input.bundle_bytes),
    bundle_byte_length: input.bundle_bytes.length,
    file_count: verification.file_count,
    blockers: uniqueBlockers,
    artifact_bytes_verified: status === 'verified',
    machine_validation_only: true,
    external_location_declared: false,
    external_artifact_download_verified_by_transport: false,
    rights_granted: false,
    human_review_performed: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}
