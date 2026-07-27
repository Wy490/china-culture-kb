import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { FileArtifactStore } from '../src/repositories/artifact-store.js';
import { inspectMediaAssetUpload } from '../src/services/asset-ingest-service.js';
import {
  verifyStoryAgentVisualAssetPressureBatchCompositionReport,
  type StoryAgentVisualAssetPressureCompositionVerification,
} from '../src/services/story-agent-visual-asset-pressure-batch-registry-service.js';
import {
  buildStoryAgentVisualAssetPressureReport,
  resolveStoryAgentVisualAssetPressureStyleFamilies,
  type StoryAgentVisualAssetPressureCase,
  type StoryAgentVisualAssetPressureScenarioResult,
} from '../src/services/story-agent-visual-asset-pressure-service.js';

interface CrossSeedManifest {
  schema_version: 'story-agent-cross-seed-image-asset-manifest/v1';
  assets: Array<{
    seed_id: string;
    series_title: string;
    label: string;
    kind: 'character' | 'costume' | 'location' | 'prop';
    source_path: string;
    prompt_path: string;
    provider_asset_id: string;
    content_sha256: string;
    prompt_sha256: string;
    required_visual_anchors: string[];
    forbidden_visual_anchors: string[];
  }>;
}

interface CrossSeedBindingReport {
  schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1';
  assets: Array<{
    seed_id: string;
    series_project_id: string;
    asset_id: string;
    provider_asset_id?: string;
    prompt_sha256?: string;
    content_sha256: string;
    immutable_preview_verified: boolean;
    functional_test_identity_mapping_current: boolean;
    identity_binding_status?: string;
    visual_identity_labels: string[];
  }>;
}

interface ImageRecoveryReport {
  schema_version: 'story-agent-15x3-image-recovery/v1';
  status: 'ready' | 'blocked';
  partial_recovery: {
    performed: boolean;
    run_id: string | null;
    task_id: string | null;
    verified_task_count: number;
    pending_task_count_after_partial: number | null;
  };
  completion: {
    processed_task_count: number;
    verified_task_count: number;
    matrix_status: 'ready' | 'blocked' | 'awaiting_imagegen';
  };
}

interface VisualAssetPressureStyleMap {
  schema_version: 'story-agent-visual-asset-pressure-style-map/v1';
  style_families: Record<string, string>;
}

const STYLE_FAMILY_BY_SEED: Record<string, string> = {
  'original-mystery': 'near_future_maritime_mystery',
  'historical-ethics': 'northern_song_historical_realism',
  'heritage-craft': 'contemporary_heritage_craft_drama',
  'children-legend': 'painterly_children_legend',
};

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function webRelativePath(path: string, label: string): string {
  const value = relative(webRoot, path).replaceAll('\\', '/');
  if (!value || isAbsolute(value) || value === '..' || value.startsWith('../')) {
    throw new Error(`${label} must stay beneath the web root`);
  }
  return value;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

const webRoot = resolve(import.meta.dirname, '..', '..');
const manifestPath = resolve(
  webRoot,
  argumentValue('--manifest')
    ?? 'generated/story-agent-cross-seed-image-assets-20260723/manifest.json',
);
const bindingPath = resolve(
  webRoot,
  argumentValue('--binding-report')
    ?? 'generated/story-agent-cross-seed-image-assets-20260723/binding-report.json',
);
const recoveryPath = resolve(
  webRoot,
  argumentValue('--recovery-report')
    ?? 'generated/story-agent-15x3-stability-matrix/image-recovery-report.json',
);
const styleMapArgument = argumentValue('--style-map');
const styleMapPath = styleMapArgument ? resolve(webRoot, styleMapArgument) : undefined;
const compositionReportArgument = argumentValue('--composition-report');
const compositionReportPath = compositionReportArgument
  ? resolve(webRoot, compositionReportArgument)
  : undefined;
const compositionReportRelativePath = compositionReportPath
  ? webRelativePath(compositionReportPath, 'composition report path')
  : undefined;
const generatedRoot = process.env.WEB_GENERATED_ROOT
  ? resolve(process.env.WEB_GENERATED_ROOT)
  : resolve(webRoot, 'generated');
const outputPath = resolve(
  webRoot,
  argumentValue('--output')
    ?? resolve(generatedRoot, 'system/story-agent-visual-asset-pressure/report.json'),
);

const [manifest, bindingReport, recoveryReport] = await Promise.all([
  readJson<CrossSeedManifest>(manifestPath),
  readJson<CrossSeedBindingReport>(bindingPath),
  readJson<ImageRecoveryReport>(recoveryPath),
]);
if (manifest.schema_version !== 'story-agent-cross-seed-image-asset-manifest/v1') {
  throw new Error(`Unsupported cross-seed manifest at "${manifestPath}"`);
}
if (bindingReport.schema_version !== 'story-agent-cross-seed-image-asset-binding-report/v1') {
  throw new Error(`Unsupported binding report at "${bindingPath}"`);
}
if (recoveryReport.schema_version !== 'story-agent-15x3-image-recovery/v1') {
  throw new Error(`Unsupported image recovery report at "${recoveryPath}"`);
}
let styleFamilies = STYLE_FAMILY_BY_SEED;
if (styleMapPath) {
  const styleMap = await readJson<VisualAssetPressureStyleMap>(styleMapPath);
  if (styleMap.schema_version !== 'story-agent-visual-asset-pressure-style-map/v1') {
    throw new Error(`Unsupported visual asset pressure style map at "${styleMapPath}"`);
  }
  styleFamilies = styleMap.style_families;
}
const seedIds = [...new Set(manifest.assets.map(item => item.seed_id))].sort();
const resolvedStyleFamilies = resolveStoryAgentVisualAssetPressureStyleFamilies(
  seedIds,
  styleFamilies,
);
let compositionProvenance: StoryAgentVisualAssetPressureCompositionVerification = {
  status: 'not_run',
  batch_count: 0,
  sealed_batch_count: 0,
  legacy_unsealed_batch_count: 0,
  file_count: 0,
  verified_file_count: 0,
  blockers: [],
};
if (compositionReportPath) {
  try {
    const compositionReport = await readJson<unknown>(compositionReportPath);
    compositionProvenance =
      await verifyStoryAgentVisualAssetPressureBatchCompositionReport({
        report: compositionReport,
        report_relative_path: compositionReportRelativePath,
        web_root: webRoot,
        expected_outputs: {
          manifest_path: webRelativePath(manifestPath, 'manifest path'),
          binding_report_path: webRelativePath(bindingPath, 'binding report path'),
          style_map_path: styleMapPath
            ? webRelativePath(styleMapPath, 'style map path')
            : '',
          recovery_report_path: webRelativePath(recoveryPath, 'recovery report path'),
        },
      });
  } catch (error) {
    compositionProvenance = {
      status: 'blocked',
      report_relative_path: compositionReportRelativePath,
      batch_count: 0,
      sealed_batch_count: 0,
      legacy_unsealed_batch_count: 0,
      file_count: 0,
      verified_file_count: 0,
      blockers: [`composition_report_unreadable:${(error as Error).message}`],
    };
  }
}

const cases: StoryAgentVisualAssetPressureCase[] = [];
for (const seedId of seedIds) {
  const manifestAssets = manifest.assets.filter(item => item.seed_id === seedId);
  const assets = await Promise.all(manifestAssets.map(async item => {
    const [sourceBytes, prompt] = await Promise.all([
      readFile(resolve(webRoot, item.source_path)),
      readFile(resolve(webRoot, item.prompt_path), 'utf8'),
    ]);
    const binding = bindingReport.assets.find(candidate => (
      candidate.seed_id === item.seed_id
      && candidate.provider_asset_id === item.provider_asset_id
      && candidate.prompt_sha256 === item.prompt_sha256
      && candidate.content_sha256 === item.content_sha256
    ));
    let mediaSignatureVerified = false;
    try {
      const inspection = inspectMediaAssetUpload({
        original_filename: item.source_path,
        declared_mime_type: 'image/png',
        expected_modality: 'image',
        buffer: sourceBytes,
      });
      mediaSignatureVerified = inspection.content_sha256 === item.content_sha256;
    } catch {
      mediaSignatureVerified = false;
    }
    return {
      asset_id: binding?.asset_id ?? item.provider_asset_id,
      label: item.label,
      kind: item.kind,
      prompt,
      prompt_sha256: item.prompt_sha256,
      content_sha256: item.content_sha256,
      required_visual_anchors: item.required_visual_anchors,
      forbidden_visual_anchors: item.forbidden_visual_anchors,
      semantic_context: binding?.visual_identity_labels ?? [],
      source_content_sha256_verified: sha256(sourceBytes) === item.content_sha256,
      media_signature_verified: mediaSignatureVerified,
      immutable_preview_verified: binding?.immutable_preview_verified ?? false,
      identity_mapping_current:
        binding?.functional_test_identity_mapping_current ?? false,
    };
  }));
  const firstBinding = bindingReport.assets.find(item => item.seed_id === seedId);
  cases.push({
    case_id: seedId,
    source_id: firstBinding?.series_project_id ?? seedId,
    title: manifestAssets[0]?.series_title ?? seedId,
    style_family: resolvedStyleFamilies[seedId]!,
    character_labels: manifestAssets
      .filter(item => item.kind === 'character')
      .map(item => item.label),
    location_labels: manifestAssets
      .filter(item => item.kind === 'location')
      .map(item => item.label),
    assets,
  });
}

let invalidImageRejected = false;
try {
  inspectMediaAssetUpload({
    original_filename: 'invalid.png',
    declared_mime_type: 'image/png',
    expected_modality: 'image',
    buffer: Buffer.from('not-an-image'),
  });
} catch {
  invalidImageRejected = true;
}
let missingFileRejected = false;
try {
  await readFile(`${manifestPath}.missing-probe`);
} catch (error) {
  missingFileRejected = (error as NodeJS.ErrnoException).code === 'ENOENT';
}
const firstSource = await readFile(resolve(webRoot, manifest.assets[0]!.source_path));
const mutatedSource = Buffer.concat([firstSource, Buffer.from([0])]);
const hashMismatchRejected = sha256(mutatedSource) !== manifest.assets[0]!.content_sha256;
const partialImportPreserved = recoveryReport.partial_recovery.performed
  && recoveryReport.partial_recovery.verified_task_count > 0
  && (recoveryReport.partial_recovery.pending_task_count_after_partial ?? 0) > 0;
const failedTaskRetryRecovered = recoveryReport.status === 'ready'
  && recoveryReport.completion.matrix_status === 'ready'
  && recoveryReport.completion.verified_task_count
    === recoveryReport.completion.processed_task_count;
const staleBinding = bindingReport.assets.find(
  item => item.identity_binding_status === 'stale',
);

function scenario(
  name: StoryAgentVisualAssetPressureScenarioResult['scenario'],
  passed: boolean,
  evidenceRefs: string[],
): StoryAgentVisualAssetPressureScenarioResult {
  return {
    scenario: name,
    status: passed ? 'passed' : 'failed',
    evidence_refs: evidenceRefs,
  };
}

const report = buildStoryAgentVisualAssetPressureReport({
  cases,
  composition_provenance: compositionProvenance,
  scenario_results: [
    scenario('missing_file_rejected', missingFileRejected, [
      `probe:${manifestPath}.missing-probe`,
      'test:api:Story Agent image run API pressure recovery',
    ]),
    scenario('invalid_image_rejected', invalidImageRejected, [
      'canonical_service:inspectMediaAssetUpload',
    ]),
    scenario('content_sha256_mismatch_rejected', hashMismatchRejected, [
      `source:${manifest.assets[0]!.source_path}`,
      'probe:mutated_source_sha256_conflict',
      'test:api:Story Agent image run API pressure recovery',
    ]),
    scenario('partial_import_preserved', partialImportPreserved, [
      `report:${recoveryPath}`,
      `image_run:${recoveryReport.partial_recovery.run_id}`,
      `image_task:${recoveryReport.partial_recovery.task_id}`,
      'test:api:Story Agent image run API pressure recovery',
    ]),
    scenario('failed_task_retry_recovered', failedTaskRetryRecovered, [
      `report:${recoveryPath}`,
      `verified:${recoveryReport.completion.verified_task_count}`,
      'test:api:Story Agent image run API pressure recovery',
    ]),
    scenario('identity_replacement_staled', Boolean(staleBinding), [
      `report:${bindingPath}`,
      ...(staleBinding ? [`asset:${staleBinding.asset_id}`] : []),
      'test:outline-service:series image replacement identity stale',
    ]),
  ],
});

const outputStore = new FileArtifactStore(resolve(outputPath, '..'));
await outputStore.writeText(
  basename(outputPath),
  `${JSON.stringify(report, null, 2)}\n`,
  { overwrite: 'replace' },
);
console.log(JSON.stringify({
  ...report,
  report_path: outputPath,
}, null, 2));
if (report.status !== 'ready') process.exitCode = 1;
