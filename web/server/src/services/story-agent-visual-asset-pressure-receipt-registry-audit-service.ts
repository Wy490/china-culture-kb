import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  verifyStoryAgentVisualAssetPressureBatchReceipt,
} from './story-agent-visual-asset-pressure-batch-receipt-service.js';
import {
  parseStoryAgentVisualAssetPressureBatchRegistry,
} from './story-agent-visual-asset-pressure-batch-registry-service.js';

type ReceiptRegistryAuditBatch = {
  batch_id: string;
  receipt_status: 'sealed' | 'legacy_unsealed';
  verification_status: 'sealed' | 'blocked' | 'not_applicable';
  asset_count: number;
  verified_asset_count: number;
  blockers: string[];
};

export type StoryAgentVisualAssetPressureReceiptRegistryAudit = {
  schema_version: 'story-agent-visual-asset-pressure-receipt-registry-audit/v1';
  audited_at: string;
  status: 'verified' | 'blocked';
  batches: ReceiptRegistryAuditBatch[];
  summary: {
    batch_count: number;
    sealed_batch_count: number;
    verified_sealed_batch_count: number;
    legacy_unsealed_batch_count: number;
    receipt_asset_count: number;
    verified_asset_count: number;
  };
  blockers: string[];
  machine_validation_only: true;
  image_provider_invoked_by_server: false;
  merged_outputs_generated: false;
  video_generation_performed: false;
  production_credit_granted: false;
};

function timestamp(value: string | undefined): string {
  const result = value ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(result))) {
    throw new Error('receipt registry audited_at must be an ISO timestamp');
  }
  return result;
}

function boundedBlocker(value: string): string {
  const separator = value.indexOf(':');
  return separator < 0 ? value : value.slice(0, separator);
}

function buildAudit(input: {
  audited_at: string;
  batches: ReceiptRegistryAuditBatch[];
  blockers: string[];
}): StoryAgentVisualAssetPressureReceiptRegistryAudit {
  const sealedBatches = input.batches.filter(
    batch => batch.receipt_status === 'sealed',
  );
  const uniqueBlockers = [...new Set(input.blockers)];
  return {
    schema_version: 'story-agent-visual-asset-pressure-receipt-registry-audit/v1',
    audited_at: input.audited_at,
    status: uniqueBlockers.length === 0
      && sealedBatches.every(batch => batch.verification_status === 'sealed')
      ? 'verified'
      : 'blocked',
    batches: input.batches,
    summary: {
      batch_count: input.batches.length,
      sealed_batch_count: sealedBatches.length,
      verified_sealed_batch_count: sealedBatches.filter(
        batch => batch.verification_status === 'sealed',
      ).length,
      legacy_unsealed_batch_count: input.batches.filter(
        batch => batch.receipt_status === 'legacy_unsealed',
      ).length,
      receipt_asset_count: sealedBatches.reduce(
        (total, batch) => total + batch.asset_count,
        0,
      ),
      verified_asset_count: sealedBatches.reduce(
        (total, batch) => total + batch.verified_asset_count,
        0,
      ),
    },
    blockers: uniqueBlockers,
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    merged_outputs_generated: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}

export async function auditStoryAgentVisualAssetPressureReceiptRegistry(input: {
  registry: unknown;
  web_root: string;
  audited_at?: string;
}): Promise<StoryAgentVisualAssetPressureReceiptRegistryAudit> {
  const auditedAt = timestamp(input.audited_at);
  let registry: ReturnType<
    typeof parseStoryAgentVisualAssetPressureBatchRegistry
  >;
  try {
    registry = parseStoryAgentVisualAssetPressureBatchRegistry(input.registry);
  } catch (error) {
    return buildAudit({
      audited_at: auditedAt,
      batches: [],
      blockers: [`receipt_registry_invalid:${(error as Error).message}`],
    });
  }

  const batches: ReceiptRegistryAuditBatch[] = [];
  const blockers: string[] = [];
  for (const batch of registry.batches) {
    if (batch.receipt_status === 'legacy_unsealed') {
      batches.push({
        batch_id: batch.batch_id,
        receipt_status: 'legacy_unsealed',
        verification_status: 'not_applicable',
        asset_count: 0,
        verified_asset_count: 0,
        blockers: [],
      });
      continue;
    }

    const batchBlockers: string[] = [];
    let assetCount = 0;
    let verifiedAssetCount = 0;
    try {
      const receiptBytes = await readFile(
        resolve(input.web_root, batch.receipt_path!),
      );
      const receipt = parseStoryAgentVisualAssetPressureBatchReceipt(
        JSON.parse(receiptBytes.toString('utf8')) as unknown,
      );
      assetCount = receipt.assets.length;
      if (receipt.batch_id !== batch.batch_id) {
        batchBlockers.push('receipt_batch_id_mismatch');
      }
      const verification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
        receipt,
        web_root: input.web_root,
      });
      verifiedAssetCount = verification.verified_asset_count;
      batchBlockers.push(...verification.blockers.map(boundedBlocker));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      batchBlockers.push(code === 'ENOENT' ? 'receipt_unreadable' : 'receipt_invalid');
    }
    const uniqueBatchBlockers = [...new Set(batchBlockers)];
    blockers.push(...uniqueBatchBlockers.map(
      blocker => `${batch.batch_id}:${blocker}`,
    ));
    batches.push({
      batch_id: batch.batch_id,
      receipt_status: 'sealed',
      verification_status: uniqueBatchBlockers.length === 0
        && verifiedAssetCount === assetCount
        ? 'sealed'
        : 'blocked',
      asset_count: assetCount,
      verified_asset_count: verifiedAssetCount,
      blockers: uniqueBatchBlockers,
    });
  }

  return buildAudit({
    audited_at: auditedAt,
    batches,
    blockers,
  });
}
