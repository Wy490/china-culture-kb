import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, normalize, resolve } from 'node:path';
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  verifyStoryAgentVisualAssetPressureBatchReceipt,
} from './story-agent-visual-asset-pressure-batch-receipt-service.js';
import {
  parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
} from './story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.js';

type JsonObject = Record<string, unknown>;

export type StoryAgentVisualAssetPressureBatchRegistry = {
  schema_version: 'story-agent-visual-asset-pressure-batch-registry/v3';
  recovery_report_path: string;
  batches: Array<{
    batch_id: string;
    manifest_path: string;
    binding_report_path: string;
    style_map_path: string;
    receipt_status: 'sealed' | 'legacy_unsealed';
    receipt_path?: string;
    evidence_descriptor_path?: string;
  }>;
};

export type LoadedStoryAgentVisualAssetPressureBatch = {
  batch_id: string;
  manifest: JsonObject;
  binding_report: JsonObject;
  style_map: JsonObject;
};

type CompositionFileInput = {
  relative_path: string;
  bytes: Uint8Array;
};

type CompositionFileEvidence = {
  relative_path: string;
  content_sha256: string;
};

export type StoryAgentVisualAssetPressureBatchCompositionReport = {
  schema_version: 'story-agent-visual-asset-pressure-batch-composition/v3';
  generated_at: string;
  registry: CompositionFileEvidence;
  recovery_report: CompositionFileEvidence;
  batches: Array<{
    batch_id: string;
    manifest: CompositionFileEvidence;
    binding_report: CompositionFileEvidence;
    style_map: CompositionFileEvidence;
    receipt_status: 'sealed' | 'legacy_unsealed';
    receipt?: CompositionFileEvidence;
    evidence_descriptor?: CompositionFileEvidence;
    seed_count: number;
    manifest_asset_count: number;
    binding_asset_count: number;
    series_count: number;
  }>;
  outputs: {
    manifest: CompositionFileEvidence;
    binding_report: CompositionFileEvidence;
    style_map: CompositionFileEvidence;
    recovery_report: CompositionFileEvidence;
  };
  summary: {
    batch_count: number;
    source_file_count: number;
    output_file_count: 4;
    file_count: number;
    sealed_batch_count: number;
    legacy_unsealed_batch_count: number;
  };
  machine_validation_only: true;
  image_provider_invoked_by_server: false;
  video_generation_performed: false;
  production_credit_granted: false;
};

export type StoryAgentVisualAssetPressureCompositionVerification = {
  status: 'verified' | 'blocked' | 'not_run';
  report_relative_path?: string;
  registry_content_sha256?: string;
  batch_count: number;
  sealed_batch_count: number;
  legacy_unsealed_batch_count: number;
  file_count: number;
  verified_file_count: number;
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

function objectArray(value: unknown, label: string): JsonObject[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value.map((item, index) => asObject(item, `${label}[${index}]`));
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function nonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
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

function fileEvidence(
  input: CompositionFileInput,
  label: string,
): CompositionFileEvidence {
  return {
    relative_path: safeRelativePath(input.relative_path, `${label} relative_path`),
    content_sha256: sha256(input.bytes),
  };
}

function parseFileEvidence(value: unknown, label: string): CompositionFileEvidence {
  const input = asObject(value, label);
  const contentSha256 = requiredString(input.content_sha256, `${label} content_sha256`);
  if (!/^[a-f0-9]{64}$/i.test(contentSha256)) {
    throw new Error(`${label} content_sha256 must be SHA-256`);
  }
  return {
    relative_path: safeRelativePath(input.relative_path, `${label} relative_path`),
    content_sha256: contentSha256.toLowerCase(),
  };
}

export function parseStoryAgentVisualAssetPressureBatchRegistry(
  value: unknown,
): StoryAgentVisualAssetPressureBatchRegistry {
  const input = asObject(value, 'batch registry');
  const isV1 = input.schema_version
    === 'story-agent-visual-asset-pressure-batch-registry/v1';
  const isV2 = input.schema_version
    === 'story-agent-visual-asset-pressure-batch-registry/v2';
  const isV3 = input.schema_version
    === 'story-agent-visual-asset-pressure-batch-registry/v3';
  if (!isV1 && !isV2 && !isV3) {
    throw new Error(`unsupported batch registry schema: ${String(input.schema_version ?? '')}`);
  }
  if (!Array.isArray(input.batches) || input.batches.length < 1) {
    throw new Error('batch registry must declare at least one batch');
  }

  const batchIds = new Set<string>();
  const batches = input.batches.map((rawBatch, index) => {
    const batch = asObject(rawBatch, `batches[${index}]`);
    const batchId = requiredString(batch.batch_id, `batches[${index}] batch_id`);
    if (batchIds.has(batchId)) {
      throw new Error(`duplicate batch_id: ${batchId}`);
    }
    batchIds.add(batchId);
    const receiptStatus: 'sealed' | 'legacy_unsealed' = isV1
      ? 'legacy_unsealed' as const
      : batch.receipt_status as 'sealed' | 'legacy_unsealed';
    if (receiptStatus !== 'sealed' && receiptStatus !== 'legacy_unsealed') {
      throw new Error(`${batchId} receipt_status must be sealed or legacy_unsealed`);
    }
    if (receiptStatus === 'sealed' && !batch.receipt_path) {
      throw new Error(`${batchId} sealed batch must declare receipt_path`);
    }
    if (isV3 && receiptStatus === 'sealed' && !batch.evidence_descriptor_path) {
      throw new Error(
        `${batchId} sealed batch must declare evidence_descriptor_path`,
      );
    }
    if (receiptStatus === 'legacy_unsealed' && batch.receipt_path !== undefined) {
      throw new Error(`${batchId} legacy_unsealed batch cannot declare receipt_path`);
    }
    if (
      receiptStatus === 'legacy_unsealed'
      && batch.evidence_descriptor_path !== undefined
    ) {
      throw new Error(
        `${batchId} legacy_unsealed batch cannot declare evidence_descriptor_path`,
      );
    }
    return {
      batch_id: batchId,
      manifest_path: safeRelativePath(
        batch.manifest_path,
        `${batchId} manifest_path`,
      ),
      binding_report_path: safeRelativePath(
        batch.binding_report_path,
        `${batchId} binding_report_path`,
      ),
      style_map_path: safeRelativePath(
        batch.style_map_path,
        `${batchId} style_map_path`,
      ),
      receipt_status: receiptStatus,
      ...(receiptStatus === 'sealed'
        ? {
            receipt_path: safeRelativePath(
              batch.receipt_path,
              `${batchId} receipt_path`,
            ),
            ...(batch.evidence_descriptor_path
              ? {
                  evidence_descriptor_path: safeRelativePath(
                    batch.evidence_descriptor_path,
                    `${batchId} evidence_descriptor_path`,
                  ),
                }
              : {}),
          }
        : {}),
    };
  });

  return {
    schema_version: 'story-agent-visual-asset-pressure-batch-registry/v3',
    recovery_report_path: safeRelativePath(
      input.recovery_report_path,
      'recovery_report_path',
    ),
    batches,
  };
}

export function mergeStoryAgentVisualAssetPressureBatches(
  batches: LoadedStoryAgentVisualAssetPressureBatch[],
) {
  if (batches.length < 1) {
    throw new Error('at least one loaded visual pressure batch is required');
  }

  const manifestAssets: JsonObject[] = [];
  const bindingAssets: JsonObject[] = [];
  const seriesShotBindings: JsonObject[] = [];
  const styleFamilies: Record<string, string> = {};
  const seedIds = new Set<string>();
  let provider = '';
  let model = '';
  let allBindingsPassed = true;

  for (const [index, batch] of batches.entries()) {
    const manifest = asObject(batch.manifest, `${batch.batch_id} manifest`);
    const binding = asObject(batch.binding_report, `${batch.batch_id} binding report`);
    const styleMap = asObject(batch.style_map, `${batch.batch_id} style map`);
    if (manifest.schema_version !== 'story-agent-cross-seed-image-asset-manifest/v1') {
      throw new Error(`${batch.batch_id} manifest schema is unsupported`);
    }
    if (binding.schema_version !== 'story-agent-cross-seed-image-asset-binding-report/v1') {
      throw new Error(`${batch.batch_id} binding report schema is unsupported`);
    }
    if (styleMap.schema_version !== 'story-agent-visual-asset-pressure-style-map/v1') {
      throw new Error(`${batch.batch_id} style map schema is unsupported`);
    }

    const batchProvider = requiredString(manifest.provider, `${batch.batch_id} provider`);
    const batchModel = requiredString(manifest.model, `${batch.batch_id} model`);
    if (binding.provider !== batchProvider || binding.model !== batchModel) {
      throw new Error(`${batch.batch_id} binding provider/model does not match its manifest`);
    }
    if (index === 0) {
      provider = batchProvider;
      model = batchModel;
    } else if (batchProvider !== provider || batchModel !== model) {
      throw new Error(`${batch.batch_id} provider/model does not match baseline`);
    }

    const batchManifestAssets = objectArray(
      manifest.assets,
      `${batch.batch_id} manifest assets`,
    );
    const batchSeedIds = new Set(batchManifestAssets.map((asset, assetIndex) => (
      requiredString(asset.seed_id, `${batch.batch_id} manifest assets[${assetIndex}] seed_id`)
    )));
    for (const seedId of batchSeedIds) {
      if (seedIds.has(seedId)) {
        throw new Error(`duplicate seed_id across batches: ${seedId}`);
      }
      seedIds.add(seedId);
    }

    const batchStyleFamilies = asObject(
      styleMap.style_families,
      `${batch.batch_id} style_families`,
    );
    for (const seedId of batchSeedIds) {
      const styleFamily = requiredString(
        batchStyleFamilies[seedId],
        `${batch.batch_id} missing style family for seed_id: ${seedId}`,
      );
      styleFamilies[seedId] = styleFamily;
    }
    for (const styleSeedId of Object.keys(batchStyleFamilies)) {
      if (!batchSeedIds.has(styleSeedId)) {
        throw new Error(`${batch.batch_id} style map has unknown seed_id: ${styleSeedId}`);
      }
    }

    manifestAssets.push(...batchManifestAssets);
    bindingAssets.push(...objectArray(
      binding.assets,
      `${batch.batch_id} binding assets`,
    ));
    seriesShotBindings.push(...objectArray(
      binding.series_shot_bindings,
      `${batch.batch_id} series shot bindings`,
    ));
    allBindingsPassed &&= binding.status === 'passed';
  }

  const bindingReport = {
    schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1',
    status: allBindingsPassed ? 'passed' : 'blocked',
    generated_at: new Date().toISOString(),
    provider,
    model,
    asset_count: bindingAssets.length,
    immutable_preview_verified_count: bindingAssets.filter(item => (
      item.immutable_preview_verified === true
    )).length,
    identity_mapping_current_count: bindingAssets.filter(item => (
      item.functional_test_identity_mapping_current === true
    )).length,
    visual_semantic_gate_passed_count: bindingAssets.filter(item => (
      item.visual_semantic_gate_passed === true
    )).length,
    shot_binding_count: seriesShotBindings.reduce(
      (total, item) => total + Number(item.shot_binding_count ?? 0),
      0,
    ),
    unbound_shot_count: seriesShotBindings.reduce(
      (total, item) => total + Number(item.unbound_shot_count ?? 0),
      0,
    ),
    production_credit_count: bindingAssets.filter(item => (
      item.production_credit === true
    )).length,
    human_review_required: false,
    human_review_deferred: true,
    series_shot_bindings: seriesShotBindings,
    assets: bindingAssets,
  };

  return {
    manifest: {
      schema_version: 'story-agent-cross-seed-image-asset-manifest/v1',
      provider,
      model,
      assets: manifestAssets,
    },
    binding_report: bindingReport,
    style_map: {
      schema_version: 'story-agent-visual-asset-pressure-style-map/v1',
      style_families: styleFamilies,
    },
    summary: {
      batch_count: batches.length,
      seed_count: seedIds.size,
      manifest_asset_count: manifestAssets.length,
      binding_asset_count: bindingAssets.length,
      series_count: seriesShotBindings.length,
      unbound_shot_count: bindingReport.unbound_shot_count,
      production_credit_count: bindingReport.production_credit_count,
    },
  };
}

export function buildStoryAgentVisualAssetPressureBatchCompositionReport(input: {
  generated_at?: string;
  registry: CompositionFileInput;
  recovery_report: CompositionFileInput;
  batches: Array<{
    batch_id: string;
    manifest: CompositionFileInput;
    binding_report: CompositionFileInput;
    style_map: CompositionFileInput;
    receipt_status: 'sealed' | 'legacy_unsealed';
    receipt?: CompositionFileInput;
    evidence_descriptor?: CompositionFileInput;
    seed_count: number;
    manifest_asset_count: number;
    binding_asset_count: number;
    series_count: number;
  }>;
  outputs: {
    manifest: CompositionFileInput;
    binding_report: CompositionFileInput;
    style_map: CompositionFileInput;
    recovery_report: CompositionFileInput;
  };
}): StoryAgentVisualAssetPressureBatchCompositionReport {
  const sealedBatchCount = input.batches.filter(
    batch => batch.receipt_status === 'sealed',
  ).length;
  const legacyUnsealedBatchCount = input.batches.filter(
    batch => batch.receipt_status === 'legacy_unsealed',
  ).length;
  if (sealedBatchCount + legacyUnsealedBatchCount !== input.batches.length) {
    throw new Error('every composition batch must declare a valid receipt_status');
  }
  for (const batch of input.batches) {
    if (batch.receipt_status === 'sealed' && !batch.receipt) {
      throw new Error(`${batch.batch_id} sealed batch must include receipt evidence`);
    }
    if (batch.receipt_status === 'sealed' && !batch.evidence_descriptor) {
      throw new Error(
        `${batch.batch_id} sealed batch must include evidence descriptor`,
      );
    }
    if (batch.receipt_status === 'legacy_unsealed' && batch.receipt) {
      throw new Error(`${batch.batch_id} legacy_unsealed batch cannot include receipt evidence`);
    }
    if (
      batch.receipt_status === 'legacy_unsealed'
      && batch.evidence_descriptor
    ) {
      throw new Error(
        `${batch.batch_id} legacy_unsealed batch cannot include evidence descriptor`,
      );
    }
  }
  const sourceFileCount = 2 + input.batches.length * 3 + sealedBatchCount * 2;
  return {
    schema_version: 'story-agent-visual-asset-pressure-batch-composition/v3',
    generated_at: isoTimestamp(
      input.generated_at ?? new Date().toISOString(),
      'composition generated_at',
    ),
    registry: fileEvidence(input.registry, 'registry'),
    recovery_report: fileEvidence(input.recovery_report, 'recovery_report'),
    batches: input.batches.map(batch => ({
      batch_id: requiredString(batch.batch_id, 'batch_id'),
      manifest: fileEvidence(batch.manifest, `${batch.batch_id} manifest`),
      binding_report: fileEvidence(
        batch.binding_report,
        `${batch.batch_id} binding_report`,
      ),
      style_map: fileEvidence(batch.style_map, `${batch.batch_id} style_map`),
      receipt_status: batch.receipt_status,
      ...(batch.receipt
        ? { receipt: fileEvidence(batch.receipt, `${batch.batch_id} receipt`) }
        : {}),
      ...(batch.evidence_descriptor
        ? {
            evidence_descriptor: fileEvidence(
              batch.evidence_descriptor,
              `${batch.batch_id} evidence_descriptor`,
            ),
          }
        : {}),
      seed_count: nonnegativeInteger(batch.seed_count, `${batch.batch_id} seed_count`),
      manifest_asset_count: nonnegativeInteger(
        batch.manifest_asset_count,
        `${batch.batch_id} manifest_asset_count`,
      ),
      binding_asset_count: nonnegativeInteger(
        batch.binding_asset_count,
        `${batch.batch_id} binding_asset_count`,
      ),
      series_count: nonnegativeInteger(
        batch.series_count,
        `${batch.batch_id} series_count`,
      ),
    })),
    outputs: {
      manifest: fileEvidence(input.outputs.manifest, 'output manifest'),
      binding_report: fileEvidence(
        input.outputs.binding_report,
        'output binding_report',
      ),
      style_map: fileEvidence(input.outputs.style_map, 'output style_map'),
      recovery_report: fileEvidence(
        input.outputs.recovery_report,
        'output recovery_report',
      ),
    },
    summary: {
      batch_count: input.batches.length,
      source_file_count: sourceFileCount,
      output_file_count: 4,
      file_count: sourceFileCount + 4,
      sealed_batch_count: sealedBatchCount,
      legacy_unsealed_batch_count: legacyUnsealedBatchCount,
    },
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}

export function parseStoryAgentVisualAssetPressureBatchCompositionReport(
  value: unknown,
): StoryAgentVisualAssetPressureBatchCompositionReport {
  const input = asObject(value, 'batch composition report');
  const isV2 = input.schema_version
    === 'story-agent-visual-asset-pressure-batch-composition/v2';
  const isV3 = input.schema_version
    === 'story-agent-visual-asset-pressure-batch-composition/v3';
  if (!isV2 && !isV3) {
    throw new Error(
      `unsupported batch composition schema: ${String(input.schema_version ?? '')}`,
    );
  }
  const batches = objectArray(input.batches, 'composition batches').map(
    (batch, index) => {
      const batchId = requiredString(batch.batch_id, `composition batches[${index}] batch_id`);
      if (
        batch.receipt_status !== 'sealed'
        && batch.receipt_status !== 'legacy_unsealed'
      ) {
        throw new Error(
          `${batchId} receipt_status must be sealed or legacy_unsealed`,
        );
      }
      const receiptStatus: 'sealed' | 'legacy_unsealed' = batch.receipt_status;
      if (batch.receipt_status === 'sealed' && !batch.receipt) {
        throw new Error(`${batchId} sealed batch must include receipt evidence`);
      }
      if (isV3 && batch.receipt_status === 'sealed' && !batch.evidence_descriptor) {
        throw new Error(
          `${batchId} sealed batch must include evidence descriptor`,
        );
      }
      if (batch.receipt_status === 'legacy_unsealed' && batch.receipt !== undefined) {
        throw new Error(`${batchId} legacy_unsealed batch cannot include receipt evidence`);
      }
      if (
        batch.receipt_status === 'legacy_unsealed'
        && batch.evidence_descriptor !== undefined
      ) {
        throw new Error(
          `${batchId} legacy_unsealed batch cannot include evidence descriptor`,
        );
      }
      return {
        batch_id: batchId,
        manifest: parseFileEvidence(batch.manifest, `${batchId} manifest`),
        binding_report: parseFileEvidence(
          batch.binding_report,
          `${batchId} binding_report`,
        ),
        style_map: parseFileEvidence(batch.style_map, `${batchId} style_map`),
        receipt_status: receiptStatus,
        ...(receiptStatus === 'sealed'
          ? { receipt: parseFileEvidence(batch.receipt, `${batchId} receipt`) }
          : {}),
        ...(receiptStatus === 'sealed' && batch.evidence_descriptor
          ? {
              evidence_descriptor: parseFileEvidence(
                batch.evidence_descriptor,
                `${batchId} evidence_descriptor`,
              ),
            }
          : {}),
        seed_count: nonnegativeInteger(batch.seed_count, `${batchId} seed_count`),
        manifest_asset_count: nonnegativeInteger(
          batch.manifest_asset_count,
          `${batchId} manifest_asset_count`,
        ),
        binding_asset_count: nonnegativeInteger(
          batch.binding_asset_count,
          `${batchId} binding_asset_count`,
        ),
        series_count: nonnegativeInteger(batch.series_count, `${batchId} series_count`),
      };
    },
  );
  if (new Set(batches.map(batch => batch.batch_id)).size !== batches.length) {
    throw new Error('composition batch_id values must be unique');
  }
  const outputs = asObject(input.outputs, 'composition outputs');
  const summary = asObject(input.summary, 'composition summary');
  const parsed: StoryAgentVisualAssetPressureBatchCompositionReport = {
    schema_version: 'story-agent-visual-asset-pressure-batch-composition/v3',
    generated_at: isoTimestamp(input.generated_at, 'composition generated_at'),
    registry: parseFileEvidence(input.registry, 'composition registry'),
    recovery_report: parseFileEvidence(
      input.recovery_report,
      'composition recovery_report',
    ),
    batches,
    outputs: {
      manifest: parseFileEvidence(outputs.manifest, 'composition output manifest'),
      binding_report: parseFileEvidence(
        outputs.binding_report,
        'composition output binding_report',
      ),
      style_map: parseFileEvidence(
        outputs.style_map,
        'composition output style_map',
      ),
      recovery_report: parseFileEvidence(
        outputs.recovery_report,
        'composition output recovery_report',
      ),
    },
    summary: {
      batch_count: nonnegativeInteger(summary.batch_count, 'composition batch_count'),
      source_file_count: nonnegativeInteger(
        summary.source_file_count,
        'composition source_file_count',
      ),
      output_file_count: 4,
      file_count: nonnegativeInteger(summary.file_count, 'composition file_count'),
      sealed_batch_count: nonnegativeInteger(
        summary.sealed_batch_count,
        'composition sealed_batch_count',
      ),
      legacy_unsealed_batch_count: nonnegativeInteger(
        summary.legacy_unsealed_batch_count,
        'composition legacy_unsealed_batch_count',
      ),
    },
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
  if (
    input.machine_validation_only !== true
    || input.image_provider_invoked_by_server !== false
    || input.video_generation_performed !== false
    || input.production_credit_granted !== false
    || summary.output_file_count !== 4
  ) {
    throw new Error('batch composition execution boundary is invalid');
  }
  return parsed;
}

export async function verifyStoryAgentVisualAssetPressureBatchCompositionReport(
  input: {
    report: unknown;
    report_relative_path?: string;
    web_root: string;
    expected_outputs: {
      manifest_path: string;
      binding_report_path: string;
      style_map_path: string;
      recovery_report_path: string;
    };
  },
): Promise<StoryAgentVisualAssetPressureCompositionVerification> {
  let report: StoryAgentVisualAssetPressureBatchCompositionReport;
  try {
    report = parseStoryAgentVisualAssetPressureBatchCompositionReport(input.report);
  } catch (error) {
    return {
      status: 'blocked',
      ...(input.report_relative_path
        ? { report_relative_path: input.report_relative_path }
      : {}),
      batch_count: 0,
      sealed_batch_count: 0,
      legacy_unsealed_batch_count: 0,
      file_count: 0,
      verified_file_count: 0,
      blockers: [`composition_report_invalid:${(error as Error).message}`],
    };
  }

  const blockers: string[] = [];
  const expectedOutputs = {
    manifest: safeRelativePath(input.expected_outputs.manifest_path, 'expected manifest_path'),
    binding_report: safeRelativePath(
      input.expected_outputs.binding_report_path,
      'expected binding_report_path',
    ),
    style_map: safeRelativePath(
      input.expected_outputs.style_map_path,
      'expected style_map_path',
    ),
    recovery_report: safeRelativePath(
      input.expected_outputs.recovery_report_path,
      'expected recovery_report_path',
    ),
  };
  for (const [key, expectedPath] of Object.entries(expectedOutputs)) {
    const reportedPath = report.outputs[
      key as keyof StoryAgentVisualAssetPressureBatchCompositionReport['outputs']
    ].relative_path;
    if (reportedPath !== expectedPath) {
      blockers.push(`composition_output_path_mismatch:${key}:${reportedPath}:${expectedPath}`);
    }
  }

  const evidence = [
    report.registry,
    report.recovery_report,
    ...report.batches.flatMap(batch => [
      batch.manifest,
      batch.binding_report,
      batch.style_map,
      ...(batch.receipt ? [batch.receipt] : []),
      ...(batch.evidence_descriptor ? [batch.evidence_descriptor] : []),
    ]),
    report.outputs.manifest,
    report.outputs.binding_report,
    report.outputs.style_map,
    report.outputs.recovery_report,
  ];
  let verifiedFileCount = 0;
  for (const file of evidence) {
    try {
      const bytes = await readFile(resolve(input.web_root, file.relative_path));
      if (sha256(bytes) === file.content_sha256) {
        verifiedFileCount += 1;
      } else {
        blockers.push(`composition_sha256_mismatch:${file.relative_path}`);
      }
    } catch {
      blockers.push(`composition_file_unreadable:${file.relative_path}`);
    }
  }

  const sealedBatchCount = report.batches.filter(
    batch => batch.receipt_status === 'sealed',
  ).length;
  const legacyUnsealedBatchCount = report.batches.filter(
    batch => batch.receipt_status === 'legacy_unsealed',
  ).length;
  const receiptEvidenceCount = report.batches.filter(batch => batch.receipt).length;
  const descriptorEvidenceCount = report.batches.filter(
    batch => batch.evidence_descriptor,
  ).length;
  const expectedSourceFileCount = 2
    + report.batches.length * 3
    + receiptEvidenceCount
    + descriptorEvidenceCount;
  if (
    report.summary.batch_count !== report.batches.length
    || report.summary.source_file_count !== expectedSourceFileCount
    || report.summary.file_count !== expectedSourceFileCount + 4
    || report.summary.sealed_batch_count !== sealedBatchCount
    || report.summary.legacy_unsealed_batch_count !== legacyUnsealedBatchCount
    || sealedBatchCount + legacyUnsealedBatchCount !== report.batches.length
  ) {
    blockers.push('composition_summary_inconsistent');
  }

  try {
    const registryBytes = await readFile(resolve(input.web_root, report.registry.relative_path));
    const registry = parseStoryAgentVisualAssetPressureBatchRegistry(
      JSON.parse(registryBytes.toString('utf8')) as unknown,
    );
    if (registry.recovery_report_path !== report.recovery_report.relative_path) {
      blockers.push('composition_registry_recovery_path_mismatch');
    }
    if (registry.batches.length !== report.batches.length) {
      blockers.push('composition_registry_batch_count_mismatch');
    }
    for (const registeredBatch of registry.batches) {
      const composedBatch = report.batches.find(
        batch => batch.batch_id === registeredBatch.batch_id,
      );
      if (
        !composedBatch
        || composedBatch.manifest.relative_path !== registeredBatch.manifest_path
        || composedBatch.binding_report.relative_path
          !== registeredBatch.binding_report_path
        || composedBatch.style_map.relative_path !== registeredBatch.style_map_path
        || composedBatch.receipt_status !== registeredBatch.receipt_status
        || (registeredBatch.receipt_status === 'sealed'
          && (
            composedBatch.receipt?.relative_path !== registeredBatch.receipt_path
            || (
              registeredBatch.evidence_descriptor_path
              && composedBatch.evidence_descriptor?.relative_path
                !== registeredBatch.evidence_descriptor_path
            )
          ))
      ) {
        blockers.push(`composition_registry_batch_mismatch:${registeredBatch.batch_id}`);
      }
    }
  } catch (error) {
    blockers.push(`composition_registry_invalid:${(error as Error).message}`);
  }

  for (const batch of report.batches) {
    let sealedReceipt: ReturnType<
      typeof parseStoryAgentVisualAssetPressureBatchReceipt
    > | undefined;
    let sealedReceiptBytes: Uint8Array | undefined;
    if (batch.receipt_status === 'sealed' && batch.receipt) {
      try {
        const receiptBytes = await readFile(
          resolve(input.web_root, batch.receipt.relative_path),
        );
        sealedReceiptBytes = receiptBytes;
        const receipt = parseStoryAgentVisualAssetPressureBatchReceipt(
          JSON.parse(receiptBytes.toString('utf8')) as unknown,
        );
        sealedReceipt = receipt;
        if (receipt.batch_id !== batch.batch_id) {
          blockers.push(`composition_receipt_batch_id_mismatch:${batch.batch_id}`);
        }
        const receiptVerification =
          await verifyStoryAgentVisualAssetPressureBatchReceipt({
            receipt,
            web_root: input.web_root,
          });
        blockers.push(...receiptVerification.blockers.map(
          blocker => `composition_receipt_blocked:${batch.batch_id}:${blocker}`,
        ));
      } catch (error) {
        blockers.push(
          `composition_receipt_invalid:${batch.batch_id}:${(error as Error).message}`,
        );
      }
    }
    if (batch.receipt_status === 'sealed' && batch.evidence_descriptor) {
      try {
        const descriptorBytes = await readFile(
          resolve(input.web_root, batch.evidence_descriptor.relative_path),
        );
        const descriptor =
          parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
            JSON.parse(descriptorBytes.toString('utf8')) as unknown,
          );
        if (descriptor.batch_id !== batch.batch_id) {
          blockers.push(
            `composition_descriptor_batch_id_mismatch:${batch.batch_id}`,
          );
        }
        if (
          !sealedReceiptBytes
          || descriptor.receipt_content_sha256 !== sha256(sealedReceiptBytes)
        ) {
          blockers.push(
            `composition_descriptor_receipt_sha256_mismatch:${batch.batch_id}`,
          );
        }
      } catch (error) {
        blockers.push(
          `composition_descriptor_invalid:${batch.batch_id}:`
          + `${(error as Error).message}`,
        );
      }
    }
    try {
      const [manifestBytes, bindingBytes] = await Promise.all([
        readFile(resolve(input.web_root, batch.manifest.relative_path)),
        readFile(resolve(input.web_root, batch.binding_report.relative_path)),
      ]);
      const manifest = asObject(
        JSON.parse(manifestBytes.toString('utf8')) as unknown,
        `${batch.batch_id} manifest`,
      );
      const binding = asObject(
        JSON.parse(bindingBytes.toString('utf8')) as unknown,
        `${batch.batch_id} binding report`,
      );
      const manifestAssets = objectArray(
        manifest.assets,
        `${batch.batch_id} manifest assets`,
      );
      if (sealedReceipt) {
        if (
          manifest.provider !== sealedReceipt.provider
          || manifest.model !== sealedReceipt.model
        ) {
          blockers.push(`composition_receipt_provider_model_mismatch:${batch.batch_id}`);
        }
        const referencedReceiptKeys = new Set<string>();
        for (const [assetIndex, manifestAsset] of manifestAssets.entries()) {
          const seedId = requiredString(
            manifestAsset.seed_id,
            `${batch.batch_id} manifest assets[${assetIndex}] seed_id`,
          );
          const role = manifestAsset.kind === 'character' ? 'character' : 'world';
          const receiptAsset = sealedReceipt.assets.find(asset => (
            asset.seed_id === seedId
            && asset.role === role
            && asset.provider_asset_id === manifestAsset.provider_asset_id
            && asset.prompt_path === manifestAsset.prompt_path
            && asset.prompt_sha256 === manifestAsset.prompt_sha256
            && asset.source_path === manifestAsset.source_path
            && asset.content_sha256 === manifestAsset.content_sha256
          ));
          if (receiptAsset) {
            referencedReceiptKeys.add(`${receiptAsset.seed_id}:${receiptAsset.role}`);
          } else {
            blockers.push(
              `composition_manifest_asset_not_sealed:${batch.batch_id}:${assetIndex}`,
            );
          }
        }
        for (const receiptAsset of sealedReceipt.assets) {
          const key = `${receiptAsset.seed_id}:${receiptAsset.role}`;
          if (!referencedReceiptKeys.has(key)) {
            blockers.push(
              `composition_receipt_asset_unreferenced:${batch.batch_id}:${key}`,
            );
          }
        }
      }
      const seedCount = new Set(manifestAssets.map((asset, index) => (
        requiredString(
          asset.seed_id,
          `${batch.batch_id} manifest assets[${index}] seed_id`,
        )
      ))).size;
      const bindingAssetCount = objectArray(
        binding.assets,
        `${batch.batch_id} binding assets`,
      ).length;
      const seriesCount = objectArray(
        binding.series_shot_bindings,
        `${batch.batch_id} series_shot_bindings`,
      ).length;
      if (
        batch.seed_count !== seedCount
        || batch.manifest_asset_count !== manifestAssets.length
        || batch.binding_asset_count !== bindingAssetCount
        || batch.series_count !== seriesCount
      ) {
        blockers.push(`composition_batch_summary_mismatch:${batch.batch_id}`);
      }
    } catch (error) {
      blockers.push(
        `composition_batch_summary_invalid:${batch.batch_id}:${(error as Error).message}`,
      );
    }
  }

  const uniqueBlockers = [...new Set(blockers)];
  return {
    status: uniqueBlockers.length === 0
      && verifiedFileCount === report.summary.file_count
      ? 'verified'
      : 'blocked',
    ...(input.report_relative_path
      ? { report_relative_path: input.report_relative_path }
      : {}),
    registry_content_sha256: report.registry.content_sha256,
    batch_count: report.batches.length,
    sealed_batch_count: sealedBatchCount,
    legacy_unsealed_batch_count: legacyUnsealedBatchCount,
    file_count: report.summary.file_count,
    verified_file_count: verifiedFileCount,
    blockers: uniqueBlockers,
  };
}
