import { isAbsolute, normalize } from 'node:path';

type JsonObject = Record<string, unknown>;

export type StoryAgentVisualAssetPressureBatchRegistry = {
  schema_version: 'story-agent-visual-asset-pressure-batch-registry/v1';
  recovery_report_path: string;
  batches: Array<{
    batch_id: string;
    manifest_path: string;
    binding_report_path: string;
    style_map_path: string;
  }>;
};

export type LoadedStoryAgentVisualAssetPressureBatch = {
  batch_id: string;
  manifest: JsonObject;
  binding_report: JsonObject;
  style_map: JsonObject;
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

export function parseStoryAgentVisualAssetPressureBatchRegistry(
  value: unknown,
): StoryAgentVisualAssetPressureBatchRegistry {
  const input = asObject(value, 'batch registry');
  if (input.schema_version !== 'story-agent-visual-asset-pressure-batch-registry/v1') {
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
    };
  });

  return {
    schema_version: 'story-agent-visual-asset-pressure-batch-registry/v1',
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
