import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { AiComicPacingProfile } from '@shared/types.js'

type PreparationCatalog = {
  schema_version: 'story-agent-visual-asset-pressure-batch-preparation/v1'
  preparation_revision: 3
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

const PROVIDER_ASSET_IDS: Record<string, {
  character: string
  world: string
}> = {
  'shadow-puppet-fantasy': {
    character: 'imagegen-exec-40c11929-8389-4afc-a8a6-b19a634e49f1',
    world: 'imagegen-exec-aa8fa34a-1407-4029-b53f-b4299368ae51',
  },
  'desert-conservation-documentary': {
    character: 'imagegen-exec-56860832-9cc8-4317-b231-9d496de3acdb',
    world: 'imagegen-exec-0292a65d-d767-4d81-b415-229893ea69de',
  },
  'tea-mountain-social-realism': {
    character: 'imagegen-exec-761f4f6c-9772-448e-b890-87a1a5a14310',
    world: 'imagegen-exec-d856c9a2-b91f-461c-9d0b-0b898819e74e',
  },
  'bronze-age-mythic-animation': {
    character: 'imagegen-exec-2c96aa4b-a33e-40ff-85fc-74ed47f80a55',
    world: 'imagegen-exec-8512b9af-c5d5-4c2b-ad70-dc4942dc4f0a',
  },
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const batchRoot = 'generated/story-agent-cross-seed-image-assets-20260725-batch2'
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
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as PreparationCatalog
if (catalog.schema_version !== 'story-agent-visual-asset-pressure-batch-preparation/v1') {
  throw new Error(`unsupported preparation catalog: ${catalog.schema_version}`)
}

const assets = []
for (const seed of catalog.seeds) {
  const providerIds = PROVIDER_ASSET_IDS[seed.seed_id]
  if (!providerIds) throw new Error(`${seed.seed_id}: missing provider asset ids`)
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
  const characterSourcePath = `${batchRoot}/sources/${seed.seed_id}-character.png`
  const characterPromptPath = `${batchRoot}/prompts/${seed.seed_id}-character.txt`
  const worldSourcePath = `${batchRoot}/sources/${seed.seed_id}-world.png`
  const worldPromptPath = `${batchRoot}/prompts/${seed.seed_id}-world.txt`
  const [
    characterSource,
    characterPrompt,
    worldSource,
    worldPrompt,
  ] = await Promise.all([
    readFile(resolve(webRoot, characterSourcePath)),
    readFile(resolve(webRoot, characterPromptPath), 'utf8'),
    readFile(resolve(webRoot, worldSourcePath)),
    readFile(resolve(webRoot, worldPromptPath), 'utf8'),
  ])
  assets.push({
    ...common,
    label: character.label,
    kind: 'character',
    source_path: characterSourcePath,
    prompt_path: characterPromptPath,
    provider_asset_id: providerIds.character,
    content_sha256: sha256(characterSource),
    prompt_sha256: sha256(characterPrompt),
  })
  for (const identity of [costume, location, prop].filter(Boolean)) {
    assets.push({
      ...common,
      label: identity!.label,
      kind: identity!.kind,
      source_path: worldSourcePath,
      prompt_path: worldPromptPath,
      provider_asset_id: providerIds.world,
      content_sha256: sha256(worldSource),
      prompt_sha256: sha256(worldPrompt),
      bind_remaining_shot_identities: identity!.kind === 'location',
    })
  }
}

const manifest = {
  schema_version: 'story-agent-cross-seed-image-asset-manifest/v1',
  provider: 'openai_imagegen',
  model: 'gpt-image-2',
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
}, null, 2))
