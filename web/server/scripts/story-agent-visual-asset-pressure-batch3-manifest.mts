import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { AiComicPacingProfile } from '@shared/types.js'
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  verifyStoryAgentVisualAssetPressureBatchReceipt,
} from '../src/services/story-agent-visual-asset-pressure-batch-receipt-service.js'

type PreparationCatalog = {
  schema_version: 'story-agent-visual-asset-pressure-batch-preparation/v1'
  preparation_revision: 1
  seeds: Array<{
    seed_id: string
    series_title: string
    primary_character: string
    outline: string
    episode_count: number
    duration_range_sec: {
      min: number
      max: number
    }
    pacing_profile: AiComicPacingProfile
    style_family: string
    series_project_id: string
    visual_identities: Array<{
      identity_id: string
      kind: 'character' | 'costume' | 'location' | 'prop'
      label: string
    }>
  }>
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const batchRoot = 'generated/story-agent-cross-seed-image-assets-20260726-batch3'
const catalogPath = resolve(
  webRoot,
  argumentValue('--catalog') ?? `${batchRoot}/identity-catalog.json`,
)
const outputPath = resolve(
  webRoot,
  argumentValue('--output') ?? `${batchRoot}/manifest.json`,
)
const styleMapPath = resolve(
  webRoot,
  argumentValue('--style-map-output') ?? `${batchRoot}/style-map.json`,
)
const receiptPath = resolve(
  webRoot,
  argumentValue('--receipt')
    ?? 'server/scripts/story-agent-visual-asset-pressure-batch3-receipt.json',
)
const [catalogValue, receiptValue] = await Promise.all([
  readFile(catalogPath, 'utf8'),
  readFile(receiptPath, 'utf8'),
])
const catalog = JSON.parse(catalogValue) as PreparationCatalog
const receipt = parseStoryAgentVisualAssetPressureBatchReceipt(
  JSON.parse(receiptValue) as unknown,
)
if (
  catalog.schema_version !== 'story-agent-visual-asset-pressure-batch-preparation/v1'
  || catalog.preparation_revision !== 1
) {
  throw new Error('unsupported batch3 preparation catalog')
}
const receiptVerification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
  receipt,
  web_root: webRoot,
})
if (receiptVerification.status !== 'sealed') {
  throw new Error(
    `batch3 immutable receipt blocked: ${receiptVerification.blockers.join(', ')}`,
  )
}
const receiptAssets = new Map(
  receipt.assets.map(asset => [`${asset.seed_id}:${asset.role}`, asset]),
)
const catalogSeedIds = new Set(catalog.seeds.map(seed => seed.seed_id))
for (const asset of receipt.assets) {
  if (!catalogSeedIds.has(asset.seed_id)) {
    throw new Error(`batch3 receipt has unknown seed_id: ${asset.seed_id}`)
  }
}

const assets = []
for (const seed of catalog.seeds) {
  const characterReceipt = receiptAssets.get(`${seed.seed_id}:character`)
  const worldReceipt = receiptAssets.get(`${seed.seed_id}:world`)
  if (!characterReceipt || !worldReceipt) {
    throw new Error(`${seed.seed_id}: immutable receipt roles are incomplete`)
  }
  const character = seed.visual_identities.find(identity => (
    identity.kind === 'character' && identity.label.includes(seed.primary_character)
  ))
  const costume = seed.visual_identities.find(identity => (
    identity.kind === 'costume' && identity.label.includes(seed.primary_character)
  ))
  const location = seed.visual_identities.find(identity => identity.kind === 'location')
  const prop = seed.visual_identities.find(identity => identity.kind === 'prop')
  if (!character || !costume || !location) {
    throw new Error(`${seed.seed_id}: character, costume, or location identity missing`)
  }

  const requiredVisualAnchors = [character.label, location.label]
  const forbiddenVisualAnchors = catalog.seeds
    .filter(candidate => candidate.seed_id !== seed.seed_id)
    .map(candidate => candidate.primary_character)
  forbiddenVisualAnchors.push('案卷')
  const common = {
    seed_id: seed.seed_id,
    outline: seed.outline,
    series_title: seed.series_title,
    series_project_id: seed.series_project_id,
    episode_count: seed.episode_count,
    duration_range_sec: seed.duration_range_sec,
    pacing_profile: seed.pacing_profile,
    required_visual_anchors: requiredVisualAnchors,
    forbidden_visual_anchors: forbiddenVisualAnchors,
  }
  assets.push({
    ...common,
    label: character.label,
    kind: 'character',
    source_path: characterReceipt.source_path,
    prompt_path: characterReceipt.prompt_path,
    provider_asset_id: characterReceipt.provider_asset_id,
    content_sha256: characterReceipt.content_sha256,
    prompt_sha256: characterReceipt.prompt_sha256,
  })
  for (const identity of [costume, location, prop].filter(Boolean)) {
    assets.push({
      ...common,
      label: identity!.label,
      kind: identity!.kind,
      source_path: worldReceipt.source_path,
      prompt_path: worldReceipt.prompt_path,
      provider_asset_id: worldReceipt.provider_asset_id,
      content_sha256: worldReceipt.content_sha256,
      prompt_sha256: worldReceipt.prompt_sha256,
      bind_remaining_shot_identities: identity!.kind === 'location',
    })
  }
}

const manifest = {
  schema_version: 'story-agent-cross-seed-image-asset-manifest/v1',
  provider: receipt.provider,
  model: receipt.model,
  assets,
}
const styleMap = {
  schema_version: 'story-agent-visual-asset-pressure-style-map/v1',
  style_families: Object.fromEntries(
    catalog.seeds.map(seed => [seed.seed_id, seed.style_family]),
  ),
}
await Promise.all([
  mkdir(dirname(outputPath), { recursive: true }),
  mkdir(dirname(styleMapPath), { recursive: true }),
])
await Promise.all([
  writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  writeFile(styleMapPath, `${JSON.stringify(styleMap, null, 2)}\n`, 'utf8'),
])
console.log(JSON.stringify({
  manifest_path: outputPath,
  style_map_path: styleMapPath,
  seed_count: catalog.seeds.length,
  asset_count: assets.length,
  unique_content_sha256_count: new Set(assets.map(asset => asset.content_sha256)).size,
  receipt_path: receiptPath,
  receipt_status: receiptVerification.status,
}, null, 2))
