import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { AiComicPacingProfile, ApiResponse } from '@shared/types.js'
import {
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  rebuildAiComicSeriesVisualBible,
  saveAiComicSeriesProject,
} from '../src/services/ai-comic-series-service.js'

type SeedDefinition = {
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
}

type PreparationCatalog = {
  schema_version: 'story-agent-visual-asset-pressure-batch-preparation/v1'
  preparation_revision: 3
  generated_at: string
  seeds: Array<SeedDefinition & {
    series_project_id: string
    generated_episode_count: number
    visual_identities: Array<{
      identity_id: string
      kind: 'character' | 'costume' | 'location' | 'prop'
      label: string
      canonical_description: string
    }>
    visual_world: {
      period: string
      region: string
      architectural_language: string[]
      lighting_and_color_rules: string[]
      material_rules: string[]
    }
  }>
}

const SEEDS: SeedDefinition[] = [
  {
    seed_id: 'shadow-puppet-fantasy',
    series_title: '灯影渡河',
    primary_character: '林照',
    outline:
      '虚构的关中皮影奇幻故事：少年皮影学徒林照在师父失声后，带着一盏旧影灯走进会移动的河滩戏台。他必须在鸡鸣前找回被洪水冲散的皮影人物，让观众分清传统皮影艺术的现实工艺与故事中的幻想设定。',
    episode_count: 2,
    duration_range_sec: { min: 45, max: 75 },
    pacing_profile: 'mystery_cliffhanger',
    style_family: 'shaanxi_shadow_puppet_expressionism',
  },
  {
    seed_id: 'desert-conservation-documentary',
    series_title: '壁上微光',
    primary_character: '唐遥',
    outline:
      '当代敦煌文物保护题材：青年数字化记录员唐遥在莫高窟数字化工作室发现一组采集数据出现色偏。她与保护员陈默逐项复核照明、色卡和影像记录，坚持不触碰壁画、不把数字复原误说成文物原貌，并在沙尘到来前完成可追溯的采集。',
    episode_count: 2,
    duration_range_sec: { min: 60, max: 90 },
    pacing_profile: 'slow_burn',
    style_family: 'dunhuang_conservation_documentary',
  },
  {
    seed_id: 'tea-mountain-social-realism',
    series_title: '一芽越岭',
    primary_character: '茶农叶澄',
    outline:
      '当代武夷山茶区故事：青年茶农叶澄在连续春雨后发现一批鲜叶必须重新分级。她与制茶师傅周岩在茶山、晾青间和焙火房之间协作，用可观察的叶片状态决定工序，不神化茶效，也不把地方经验冒充统一标准。',
    episode_count: 2,
    duration_range_sec: { min: 60, max: 90 },
    pacing_profile: 'balanced_drama',
    style_family: 'wuyi_tea_mountain_social_realism',
  },
  {
    seed_id: 'bronze-age-mythic-animation',
    series_title: '青铜鸟醒时',
    primary_character: '青牧',
    outline:
      '三星堆文化意象启发的完全虚构奇幻故事：少年面具守护者青牧在青铜神树的鸟形铃铛突然无风自鸣后，进入一座青绿雾气笼罩的地下城。他必须阻止贪心商旅夺走祭坛上的金面具；作品明确这不是考古复原，也不宣称对应真实古蜀仪式。',
    episode_count: 2,
    duration_range_sec: { min: 45, max: 75 },
    pacing_profile: 'fast_hook',
    style_family: 'bronze_teal_mythic_animation',
  },
]
const PREPARATION_REVISION = 3 as const

function requireData<T>(result: ApiResponse<T>, stage: string): T {
  if (!result.ok || !result.data) {
    throw new Error(`${stage}: ${result.error?.message ?? result.error?.code ?? 'missing data'}`)
  }
  return result.data
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function readPreviousCatalog(path: string): Promise<PreparationCatalog | undefined> {
  try {
    const catalog = JSON.parse(await readFile(path, 'utf8')) as PreparationCatalog
    return catalog.schema_version === 'story-agent-visual-asset-pressure-batch-preparation/v1'
      ? catalog
      : undefined
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const outputPath = resolve(
  webRoot,
  argumentValue('--output')
    ?? 'generated/story-agent-cross-seed-image-assets-20260725-batch2/identity-catalog.json',
)
const previousCatalog = await readPreviousCatalog(outputPath)
const preparedSeeds: PreparationCatalog['seeds'] = []

for (const seed of SEEDS) {
  const previous = previousCatalog?.preparation_revision === PREPARATION_REVISION
    ? previousCatalog.seeds.find(item => item.seed_id === seed.seed_id)
    : undefined
  let project = previous
    ? (await getAiComicSeriesProject(previous.series_project_id)).data
    : undefined
  if (project?.plan.series_title !== seed.series_title) project = undefined
  if (
    project
    && !project.visual_bible?.identities.some(identity => (
      identity.kind === 'character' && identity.label.includes(seed.primary_character)
    ))
  ) {
    project = undefined
  }

  if (!project) {
    const plan = requireData(await generateAiComicSeriesPlan({
      outline: seed.outline,
      series_title: seed.series_title,
      episode_count: seed.episode_count,
      episode_duration_range_sec: seed.duration_range_sec,
      pacing_profile: seed.pacing_profile,
      character_hints: [{
        name: seed.primary_character,
        role_position: '主角',
        character_kind: 'named_person',
        source_text: seed.outline,
        asset_stability: 'recurring',
      }],
    }), `${seed.seed_id} plan`)
    project = requireData(
      await saveAiComicSeriesProject({ plan }),
      `${seed.seed_id} save`,
    )
  }

  for (let episodeNo = 1; episodeNo <= seed.episode_count; episodeNo += 1) {
    if (project.generated_episode_story_ids[String(episodeNo)]) continue
    requireData(await generateAiComicEpisodeFromPlan({
      series_plan: project.plan,
      series_project_id: project.project.series_project_id,
      episode_no: episodeNo,
      output_gears_segments: true,
      auto_audit_continuity: true,
      knowledge_pack: {
        primary_entries: [],
        supporting_entries: [],
        missing_needs: [],
        overall_confidence: 0,
      },
    }), `${seed.seed_id} episode ${episodeNo}`)
    project = requireData(
      await getAiComicSeriesProject(project.project.series_project_id),
      `${seed.seed_id} refresh episode ${episodeNo}`,
    )
  }

  project = requireData(
    await rebuildAiComicSeriesVisualBible(project.project.series_project_id),
    `${seed.seed_id} visual bible`,
  )
  const visualIdentities = (project.visual_bible?.identities ?? []).map(identity => ({
    identity_id: identity.identity_id,
    kind: identity.kind,
    label: identity.label,
    canonical_description: identity.canonical_description,
  }))
  if (!visualIdentities.some(identity => identity.kind === 'character')) {
    throw new Error(`${seed.seed_id}: prepared project has no character identity`)
  }
  if (!visualIdentities.some(identity => identity.kind === 'location')) {
    throw new Error(`${seed.seed_id}: prepared project has no location identity`)
  }
  if (!project.visual_bible) {
    throw new Error(`${seed.seed_id}: prepared project has no visual bible`)
  }
  preparedSeeds.push({
    ...seed,
    series_project_id: project.project.series_project_id,
    generated_episode_count: Object.keys(project.generated_episode_story_ids).length,
    visual_identities: visualIdentities,
    visual_world: project.visual_bible.world,
  })
}

const catalog: PreparationCatalog = {
  schema_version: 'story-agent-visual-asset-pressure-batch-preparation/v1',
  preparation_revision: PREPARATION_REVISION,
  generated_at: new Date().toISOString(),
  seeds: preparedSeeds,
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(catalog, null, 2))
