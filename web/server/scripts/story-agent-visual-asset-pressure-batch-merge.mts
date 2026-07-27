import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import {
  buildStoryAgentVisualAssetPressureBatchCompositionReport,
  mergeStoryAgentVisualAssetPressureBatches,
  parseStoryAgentVisualAssetPressureBatchRegistry,
} from '../src/services/story-agent-visual-asset-pressure-batch-registry-service.js'
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  verifyStoryAgentVisualAssetPressureBatchReceipt,
} from '../src/services/story-agent-visual-asset-pressure-batch-receipt-service.js'
import {
  parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
} from '../src/services/story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.js'

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function readJsonFile(path: string): Promise<{
  bytes: Buffer
  value: Record<string, unknown>
}> {
  const bytes = await readFile(path)
  const value = JSON.parse(bytes.toString('utf8')) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object`)
  }
  return {
    bytes,
    value: value as Record<string, unknown>,
  }
}

function webRelativePath(path: string, label: string): string {
  const value = relative(webRoot, path).replaceAll('\\', '/')
  if (!value || isAbsolute(value) || value === '..' || value.startsWith('../')) {
    throw new Error(`${label} must stay beneath the web root`)
  }
  return value
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const registryPath = resolve(
  webRoot,
  argumentValue('--registry')
    ?? 'server/scripts/story-agent-visual-asset-pressure-batch-registry.json',
)
const outputRoot = resolve(
  webRoot,
  argumentValue('--output-root')
    ?? 'generated/story-agent-cross-seed-image-assets-20260725-eight-world',
)
const registryRelativePath = webRelativePath(registryPath, 'registry path')
webRelativePath(outputRoot, 'output root')
const registryFile = await readJsonFile(registryPath)
const registry = parseStoryAgentVisualAssetPressureBatchRegistry(registryFile.value)
const recoveryInputPath = resolve(
  webRoot,
  argumentValue('--recovery-report') ?? registry.recovery_report_path,
)
const recoveryInputRelativePath = webRelativePath(
  recoveryInputPath,
  'recovery report path',
)
const [batchFiles, recoveryInput] = await Promise.all([
  Promise.all(registry.batches.map(async batch => ({
    batch_id: batch.batch_id,
    definition: batch,
    manifest: await readJsonFile(resolve(webRoot, batch.manifest_path)),
    binding_report: await readJsonFile(resolve(webRoot, batch.binding_report_path)),
    style_map: await readJsonFile(resolve(webRoot, batch.style_map_path)),
    receipt: batch.receipt_path
      ? await readJsonFile(resolve(webRoot, batch.receipt_path))
      : undefined,
    evidence_descriptor: batch.evidence_descriptor_path
      ? await readJsonFile(resolve(webRoot, batch.evidence_descriptor_path))
      : undefined,
  }))),
  readJsonFile(recoveryInputPath),
])
for (const batch of batchFiles) {
  if (
    batch.definition.receipt_status !== 'sealed'
    || !batch.receipt
    || !batch.evidence_descriptor
  ) continue
  const receipt = parseStoryAgentVisualAssetPressureBatchReceipt(batch.receipt.value)
  if (receipt.batch_id !== batch.batch_id) {
    throw new Error(`${batch.batch_id}: receipt batch_id mismatch`)
  }
  const verification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
    receipt,
    web_root: webRoot,
  })
  if (verification.status !== 'sealed') {
    throw new Error(
      `${batch.batch_id}: immutable receipt blocked: ${verification.blockers.join(', ')}`,
    )
  }
  const descriptor =
    parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
      batch.evidence_descriptor.value,
    )
  const receiptSha256 = createHash('sha256')
    .update(batch.receipt.bytes)
    .digest('hex')
  if (
    descriptor.batch_id !== batch.batch_id
    || descriptor.receipt_content_sha256 !== receiptSha256
  ) {
    throw new Error(`${batch.batch_id}: evidence descriptor does not bind receipt`)
  }
}
const loadedBatches = batchFiles.map(batch => ({
  batch_id: batch.batch_id,
  manifest: batch.manifest.value,
  binding_report: batch.binding_report.value,
  style_map: batch.style_map.value,
}))
const merged = mergeStoryAgentVisualAssetPressureBatches(loadedBatches)
const outputPaths = {
  manifest: resolve(outputRoot, 'manifest.json'),
  binding_report: resolve(outputRoot, 'binding-report.json'),
  style_map: resolve(outputRoot, 'style-map.json'),
  recovery_report: resolve(outputRoot, 'image-recovery-report.json'),
  composition_report: resolve(outputRoot, 'composition-report.json'),
}
const outputBytes = {
  manifest: Buffer.from(`${JSON.stringify(merged.manifest, null, 2)}\n`),
  binding_report: Buffer.from(`${JSON.stringify(merged.binding_report, null, 2)}\n`),
  style_map: Buffer.from(`${JSON.stringify(merged.style_map, null, 2)}\n`),
  recovery_report: recoveryInput.bytes,
}
const compositionReport = buildStoryAgentVisualAssetPressureBatchCompositionReport({
  registry: {
    relative_path: registryRelativePath,
    bytes: registryFile.bytes,
  },
  recovery_report: {
    relative_path: recoveryInputRelativePath,
    bytes: recoveryInput.bytes,
  },
  batches: batchFiles.map(batch => {
    const manifestAssets = Array.isArray(batch.manifest.value.assets)
      ? batch.manifest.value.assets as Array<Record<string, unknown>>
      : []
    return {
      batch_id: batch.batch_id,
      manifest: {
        relative_path: batch.definition.manifest_path,
        bytes: batch.manifest.bytes,
      },
      binding_report: {
        relative_path: batch.definition.binding_report_path,
        bytes: batch.binding_report.bytes,
      },
      style_map: {
        relative_path: batch.definition.style_map_path,
        bytes: batch.style_map.bytes,
      },
      receipt_status: batch.definition.receipt_status,
      ...(batch.receipt && batch.definition.receipt_path
        ? {
            receipt: {
              relative_path: batch.definition.receipt_path,
              bytes: batch.receipt.bytes,
            },
          }
        : {}),
      ...(batch.evidence_descriptor && batch.definition.evidence_descriptor_path
        ? {
            evidence_descriptor: {
              relative_path: batch.definition.evidence_descriptor_path,
              bytes: batch.evidence_descriptor.bytes,
            },
          }
        : {}),
      seed_count: new Set(manifestAssets.map(asset => asset.seed_id)).size,
      manifest_asset_count: manifestAssets.length,
      binding_asset_count: arrayLength(batch.binding_report.value.assets),
      series_count: arrayLength(batch.binding_report.value.series_shot_bindings),
    }
  }),
  outputs: {
    manifest: {
      relative_path: webRelativePath(outputPaths.manifest, 'output manifest path'),
      bytes: outputBytes.manifest,
    },
    binding_report: {
      relative_path: webRelativePath(
        outputPaths.binding_report,
        'output binding report path',
      ),
      bytes: outputBytes.binding_report,
    },
    style_map: {
      relative_path: webRelativePath(outputPaths.style_map, 'output style map path'),
      bytes: outputBytes.style_map,
    },
    recovery_report: {
      relative_path: webRelativePath(
        outputPaths.recovery_report,
        'output recovery report path',
      ),
      bytes: outputBytes.recovery_report,
    },
  },
})
const compositionBytes = Buffer.from(`${JSON.stringify(compositionReport, null, 2)}\n`)

await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(outputPaths.manifest, outputBytes.manifest),
  writeFile(outputPaths.binding_report, outputBytes.binding_report),
  writeFile(outputPaths.style_map, outputBytes.style_map),
  writeFile(outputPaths.recovery_report, outputBytes.recovery_report),
  writeFile(outputPaths.composition_report, compositionBytes),
])
console.log(JSON.stringify({
  registry_path: registryPath,
  output_root: outputRoot,
  composition_report_path: outputPaths.composition_report,
  composition_file_count: compositionReport.summary.file_count,
  ...merged.summary,
}, null, 2))
