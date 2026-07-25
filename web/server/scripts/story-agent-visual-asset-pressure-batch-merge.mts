import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  mergeStoryAgentVisualAssetPressureBatches,
  parseStoryAgentVisualAssetPressureBatchRegistry,
} from '../src/services/story-agent-visual-asset-pressure-batch-registry-service.js'

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const value = JSON.parse(await readFile(path, 'utf8')) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object`)
  }
  return value as Record<string, unknown>
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
const registry = parseStoryAgentVisualAssetPressureBatchRegistry(
  await readJson(registryPath),
)
const recoveryInputPath = resolve(
  webRoot,
  argumentValue('--recovery-report') ?? registry.recovery_report_path,
)
const [loadedBatches, recoveryInput] = await Promise.all([
  Promise.all(registry.batches.map(async batch => ({
    batch_id: batch.batch_id,
    manifest: await readJson(resolve(webRoot, batch.manifest_path)),
    binding_report: await readJson(resolve(webRoot, batch.binding_report_path)),
    style_map: await readJson(resolve(webRoot, batch.style_map_path)),
  }))),
  readJson(recoveryInputPath),
])
const merged = mergeStoryAgentVisualAssetPressureBatches(loadedBatches)

await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(
    resolve(outputRoot, 'manifest.json'),
    `${JSON.stringify(merged.manifest, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, 'binding-report.json'),
    `${JSON.stringify(merged.binding_report, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, 'style-map.json'),
    `${JSON.stringify(merged.style_map, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, 'image-recovery-report.json'),
    `${JSON.stringify(recoveryInput, null, 2)}\n`,
  ),
])
console.log(JSON.stringify({
  registry_path: registryPath,
  output_root: outputRoot,
  ...merged.summary,
}, null, 2))
