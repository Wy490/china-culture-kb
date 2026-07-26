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
  preparation_revision: 1
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
    seed_id: 'tulou-rain-documentary',
    series_title: '土楼听雨',
    primary_character: '建筑测绘员许砚',
    outline:
      '当代福建土楼建筑保护纪录题材：建筑测绘员许砚在连续降雨后，与当地维护人员逐层记录墙体裂缝、木构节点和排水痕迹。她必须在不干扰居民生活的前提下完成可追溯测绘，不把单座建筑的观察夸大为所有土楼的统一结论，也不虚构古老仪式。',
    episode_count: 2,
    duration_range_sec: { min: 60, max: 90 },
    pacing_profile: 'slow_burn',
    style_family: 'fujian_tulou_rain_architectural_documentary',
  },
  {
    seed_id: 'kunqu-backstage-drama',
    series_title: '水袖未落',
    primary_character: '青年昆曲演员沈清和',
    outline:
      '当代江南昆曲后台故事：青年演员沈清和在演出前发现一件水袖戏服的暗线松脱，她与服装师、笛师在排练场和后台之间协调修补与走位。故事通过可见的身段、谱页、针线和舞台调度表现传承压力，不把剧团经验说成所有昆曲表演的唯一规则。',
    episode_count: 2,
    duration_range_sec: { min: 45, max: 75 },
    pacing_profile: 'balanced_drama',
    style_family: 'jiangnan_kunqu_gongbi_backstage_drama',
  },
  {
    seed_id: 'paper-cut-snow-fable',
    series_title: '红窗追月',
    primary_character: '剪纸学徒小满',
    outline:
      '明确虚构的东北冬日儿童童话：剪纸学徒小满为了修补被风吹破的窗花，在雪夜追赶一只从红纸上跳下来的月兔。她用剪刀、折纸和重复纹样找到回家的路；会活动的纸兔与红纸森林均为幻想，不宣称对应真实民俗传说。',
    episode_count: 2,
    duration_range_sec: { min: 45, max: 75 },
    pacing_profile: 'fast_hook',
    style_family: 'northeast_red_papercut_snow_fable',
  },
  {
    seed_id: 'maritime-porcelain-museum',
    series_title: '瓷片归港',
    primary_character: '博物馆编目员林屿',
    outline:
      '当代闽南海洋文化博物馆悬疑：编目员林屿收到一枚来源标签脱落的青白瓷片，她与库房管理员按照片、入库记录和包装痕迹逐项追索。在证据补齐前，他们拒绝判断瓷片的具体年代、窑口或沉船来源，故事重点是可追溯记录与克制推断。',
    episode_count: 2,
    duration_range_sec: { min: 60, max: 90 },
    pacing_profile: 'mystery_cliffhanger',
    style_family: 'minnan_maritime_cyanotype_museum_mystery',
  },
]

const PREPARATION_REVISION = 1 as const

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
    ?? 'generated/story-agent-cross-seed-image-assets-20260726-batch3/identity-catalog.json',
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
