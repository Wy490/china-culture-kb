import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type JsonObject = Record<string, unknown>

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function readJson(path: string): Promise<JsonObject> {
  return JSON.parse(await readFile(path, 'utf8')) as JsonObject
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const oldRoot = resolve(webRoot, 'generated/story-agent-cross-seed-image-assets-20260723')
const newRoot = resolve(webRoot, 'generated/story-agent-cross-seed-image-assets-20260725-batch2')
const outputRoot = resolve(
  webRoot,
  argumentValue('--output-root')
    ?? 'generated/story-agent-cross-seed-image-assets-20260725-eight-world',
)
const recoveryInputPath = resolve(
  webRoot,
  argumentValue('--recovery-report')
    ?? 'generated/story-agent-15x3-stability-matrix/image-recovery-report.json',
)
const [oldManifest, newManifest, oldBinding, newBinding, newStyleMap, recoveryInput] =
  await Promise.all([
    readJson(resolve(oldRoot, 'manifest.json')),
    readJson(resolve(newRoot, 'manifest.json')),
    readJson(resolve(oldRoot, 'binding-report.json')),
    readJson(resolve(newRoot, 'binding-report.json')),
    readJson(resolve(newRoot, 'style-map.json')),
    readJson(recoveryInputPath),
  ])

const manifestAssets = [
  ...oldManifest.assets as unknown[],
  ...newManifest.assets as unknown[],
]
const bindingAssets = [
  ...oldBinding.assets as unknown[],
  ...newBinding.assets as unknown[],
]
const seriesShotBindings = [
  ...oldBinding.series_shot_bindings as unknown[],
  ...newBinding.series_shot_bindings as unknown[],
]
const manifest = {
  schema_version: 'story-agent-cross-seed-image-asset-manifest/v1',
  provider: 'openai_imagegen',
  model: 'gpt-image-2',
  assets: manifestAssets,
}
const binding = {
  schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1',
  status: oldBinding.status === 'passed' && newBinding.status === 'passed'
    ? 'passed'
    : 'blocked',
  generated_at: new Date().toISOString(),
  provider: 'openai_imagegen',
  model: 'gpt-image-2',
  asset_count: bindingAssets.length,
  immutable_preview_verified_count: bindingAssets.filter(item => (
    (item as JsonObject).immutable_preview_verified === true
  )).length,
  identity_mapping_current_count: bindingAssets.filter(item => (
    (item as JsonObject).functional_test_identity_mapping_current === true
  )).length,
  visual_semantic_gate_passed_count: bindingAssets.filter(item => (
    (item as JsonObject).visual_semantic_gate_passed === true
  )).length,
  shot_binding_count: seriesShotBindings.reduce<number>(
    (total, item) => total + Number((item as JsonObject).shot_binding_count ?? 0),
    0,
  ),
  unbound_shot_count: seriesShotBindings.reduce<number>(
    (total, item) => total + Number((item as JsonObject).unbound_shot_count ?? 0),
    0,
  ),
  production_credit_count: bindingAssets.filter(item => (
    (item as JsonObject).production_credit === true
  )).length,
  human_review_required: false,
  human_review_deferred: true,
  series_shot_bindings: seriesShotBindings,
  assets: bindingAssets,
}
const oldStyleFamilies = {
  'original-mystery': 'near_future_maritime_mystery',
  'historical-ethics': 'northern_song_historical_realism',
  'heritage-craft': 'contemporary_heritage_craft_drama',
  'children-legend': 'painterly_children_legend',
}
const styleMap = {
  schema_version: 'story-agent-visual-asset-pressure-style-map/v1',
  style_families: {
    ...oldStyleFamilies,
    ...(newStyleMap.style_families as Record<string, string>),
  },
}

await mkdir(outputRoot, { recursive: true })
await Promise.all([
  writeFile(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(resolve(outputRoot, 'binding-report.json'), `${JSON.stringify(binding, null, 2)}\n`),
  writeFile(resolve(outputRoot, 'style-map.json'), `${JSON.stringify(styleMap, null, 2)}\n`),
  writeFile(
    resolve(outputRoot, 'image-recovery-report.json'),
    `${JSON.stringify(recoveryInput, null, 2)}\n`,
  ),
])
console.log(JSON.stringify({
  output_root: outputRoot,
  manifest_asset_count: manifestAssets.length,
  binding_asset_count: bindingAssets.length,
  series_count: seriesShotBindings.length,
  unbound_shot_count: binding.unbound_shot_count,
  production_credit_count: binding.production_credit_count,
}, null, 2))
