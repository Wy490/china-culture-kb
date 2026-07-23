import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  AiComicSeriesSeedancePreproductionPackage,
  ApiResponse,
} from '@shared/types.js'
import { exportAiComicSeriesSeedancePreproductionPackage } from '../src/services/ai-comic-series-service.js'

type ImageBindingReport = {
  schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1'
  status: 'passed'
  asset_count: number
  shot_binding_count: number
  unbound_shot_count: number
  human_review_required: boolean
  human_review_deferred: boolean
  series_shot_bindings: Array<{
    series_project_id: string
    series_title: string
    shot_binding_count: number
    unbound_shot_count: number
    functional_test_identity_mapping_count: number
  }>
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function requireData<T>(result: ApiResponse<T>, stage: string): T {
  if (!result.ok || !result.data) {
    throw new Error(`${stage}: ${result.error?.message ?? result.error?.code ?? 'missing data'}`)
  }
  return result.data
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function safeFileStem(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'series'
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const evidenceRoot = resolve(webRoot, 'generated', 'story-agent-cross-seed-image-assets-20260723')
const bindingReportPath = resolve(
  webRoot,
  argumentValue('--binding-report')
    ?? 'generated/story-agent-cross-seed-image-assets-20260723/binding-report.json',
)
const outputRoot = resolve(
  webRoot,
  argumentValue('--output-root')
    ?? 'generated/story-agent-cross-seed-image-assets-20260723/seedance-preproduction-packages',
)
const reportPath = resolve(
  webRoot,
  argumentValue('--report')
    ?? 'generated/story-agent-cross-seed-image-assets-20260723/seedance-preproduction-report.json',
)
const bindingReport = JSON.parse(
  await readFile(bindingReportPath, 'utf8'),
) as ImageBindingReport

assert(
  bindingReport.schema_version === 'story-agent-cross-seed-image-asset-binding-report/v1',
  `unsupported binding report: ${bindingReport.schema_version}`,
)
assert(bindingReport.status === 'passed', 'image binding report is not passing')
assert(bindingReport.unbound_shot_count === 0, 'source binding report contains unbound shots')
assert(bindingReport.human_review_required === false, 'human review unexpectedly became a functional gate')
assert(bindingReport.human_review_deferred, 'deferred human review boundary is missing')

await mkdir(outputRoot, { recursive: true })
await mkdir(evidenceRoot, { recursive: true })

const startedAt = new Date().toISOString()
const projectReports: Array<{
  series_project_id: string
  series_title: string
  status: 'ready'
  episode_count: number
  shot_count: number
  image_asset_count: number
  current_identity_mapping_count: number
  warning_count: number
  json_path: string
  markdown_path: string
}> = []

for (const series of bindingReport.series_shot_bindings) {
  const stage = `${series.series_title} (${series.series_project_id})`
  const pkg = requireData<AiComicSeriesSeedancePreproductionPackage>(
    await exportAiComicSeriesSeedancePreproductionPackage(series.series_project_id),
    `${stage} preproduction export`,
  )

  assert(pkg.boundary.video_generation_in_scope === false, `${stage}: video entered Story Agent scope`)
  assert(
    pkg.boundary.video_generation_executor === 'user_in_seedance',
    `${stage}: Seedance user execution boundary changed`,
  )
  assert(
    pkg.boundary.human_test_required_for_functional_acceptance === false,
    `${stage}: human test became a functional blocker`,
  )
  assert(pkg.acceptance.status === 'ready', `${stage}: ${pkg.acceptance.blockers.join('; ')}`)
  assert(
    pkg.acceptance.story_episode_count === pkg.acceptance.expected_episode_count,
    `${stage}: incomplete stories`,
  )
  assert(
    pkg.acceptance.script_shot_count === series.shot_binding_count,
    `${stage}: script shots ${pkg.acceptance.script_shot_count}/${series.shot_binding_count}`,
  )
  assert(
    pkg.acceptance.seedance_prompt_shot_count === series.shot_binding_count,
    `${stage}: prompt shots ${pkg.acceptance.seedance_prompt_shot_count}/${series.shot_binding_count}`,
  )
  assert(
    pkg.acceptance.image_asset_count === series.functional_test_identity_mapping_count,
    `${stage}: delivered image count drifted`,
  )
  assert(
    pkg.acceptance.current_identity_mapping_count === pkg.acceptance.expected_identity_count,
    `${stage}: required visual identity mapping is incomplete`,
  )
  assert(pkg.acceptance.unbound_shot_count === 0, `${stage}: unbound shots remain`)
  assert(
    pkg.acceptance.immutable_image_asset_count === pkg.acceptance.image_asset_count,
    `${stage}: immutable image assets are incomplete`,
  )
  assert(pkg.episodes.every(episode => (
    episode.story.full_text.trim().length > 0
    && episode.story.scene_breakdown.length > 0
    && episode.story.gears_segments.length > 0
    && episode.script.shots.every(shot => (
      shot.script_text.trim().length > 0
      && shot.seedance_prompt.trim().length > 0
      && shot.seedance_prompt.includes('@图片')
      && shot.material_validation.missing_required_slots.length === 0
    ))
  )), `${stage}: story/script/prompt payload is incomplete`)
  assert(pkg.image_assets.every(asset => (
    Boolean(asset.local_path)
    && /^[a-f0-9]{64}$/i.test(asset.content_sha256 ?? '')
    && Boolean(asset.provider)
  )), `${stage}: image asset provenance is incomplete`)
  assert(pkg.episodes.every(episode => (
    episode.shot_asset_bindings.length === episode.script.shot_count
    && episode.shot_asset_bindings.every(binding => (
      binding.required_asset_ids.length > 0
      && binding.missing_reference_asset_ids.length === 0
      && binding.reference_slots.length > 0
    ))
  )), `${stage}: shot-to-image bindings are incomplete`)

  const stem = safeFileStem(series.series_project_id)
  const jsonPath = resolve(outputRoot, `${stem}.json`)
  const markdownPath = resolve(outputRoot, `${stem}.md`)
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8'),
    writeFile(markdownPath, pkg.markdown, 'utf8'),
  ])
  projectReports.push({
    series_project_id: series.series_project_id,
    series_title: series.series_title,
    status: 'ready',
    episode_count: pkg.acceptance.story_episode_count,
    shot_count: pkg.acceptance.script_shot_count,
    image_asset_count: pkg.acceptance.image_asset_count,
    current_identity_mapping_count: pkg.acceptance.current_identity_mapping_count,
    warning_count: pkg.acceptance.warnings.length,
    json_path: jsonPath,
    markdown_path: markdownPath,
  })
}

const totals = projectReports.reduce((summary, item) => ({
  episode_count: summary.episode_count + item.episode_count,
  shot_count: summary.shot_count + item.shot_count,
  image_asset_count: summary.image_asset_count + item.image_asset_count,
  current_identity_mapping_count:
    summary.current_identity_mapping_count + item.current_identity_mapping_count,
}), {
  episode_count: 0,
  shot_count: 0,
  image_asset_count: 0,
  current_identity_mapping_count: 0,
})
assert(
  totals.shot_count === bindingReport.shot_binding_count,
  `aggregate prompt shots ${totals.shot_count}/${bindingReport.shot_binding_count}`,
)
assert(
  totals.image_asset_count === bindingReport.asset_count,
  `aggregate images ${totals.image_asset_count}/${bindingReport.asset_count}`,
)

const report = {
  schema_version: 'story-agent-seedance-preproduction-smoke-report/v1',
  status: 'passed',
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  boundary: {
    story_agent_output: ['story', 'script', 'seedance_prompt', 'image_asset'],
    video_generation_in_scope: false,
    video_generation_executor: 'user_in_seedance',
    human_test_required: false,
  },
  project_count: projectReports.length,
  ...totals,
  unbound_shot_count: 0,
  projects: projectReports,
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
