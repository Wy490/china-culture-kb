import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { AiComicPacingProfile, ApiResponse } from '@shared/types.js'
import {
  exportAiComicSeriesSeedanceAssetReportPackage,
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  readAiComicSeriesMediaAssetPreview,
  rebuildAiComicSeriesVisualBible,
  saveAiComicSeriesProject,
  uploadAiComicSeriesSeedanceAssetFile,
} from '../src/services/ai-comic-series-service.js'

type ImageAssetManifest = {
  schema_version: 'story-agent-cross-seed-image-asset-manifest/v1'
  provider: 'openai_imagegen'
  model: 'gpt-image-2'
  assets: Array<{
    seed_id: string
    outline: string
    series_title: string
    episode_count: number
    duration_range_sec: {
      min: number
      max: number
    }
    pacing_profile: AiComicPacingProfile
    label: string
    kind: 'character' | 'costume' | 'location' | 'prop'
    source_path: string
    prompt_path: string
    provider_asset_id: string
    content_sha256: string
    prompt_sha256: string
    required_visual_anchors: string[]
    forbidden_visual_anchors: string[]
    bind_remaining_shot_identities?: boolean
  }>
}

type ImageAssetManifestItem = ImageAssetManifest['assets'][number]

type BoundImageAssetReportItem = {
  seed_id: string
  series_project_id: string
  series_title: string
  generated_episode_count: number
  asset_id: string
  identity_id: string
  identity_binding_status?: string
  provider?: string
  provider_asset_id?: string
  model?: string
  prompt_sha256?: string
  content_sha256: string
  mime_type: string
  size_bytes: number
  immutable_preview_verified: true
  functional_test_asset_ready: true
  functional_test_identity_mapping_current: true
  visual_semantic_gate_passed: true
  visual_identity_labels: string[]
  rights_status?: string
  human_review_status?: string
  production_credit: false
  local_path: string
  preview_url: string
  reused_existing_project: boolean
}

type ImageAssetBindingReport = {
  schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1'
  assets: BoundImageAssetReportItem[]
}

function requireData<T>(result: ApiResponse<T>, stage: string): T {
  if (!result.ok || !result.data) {
    throw new Error(`${stage}: ${result.error?.message ?? result.error?.code ?? 'missing data'}`)
  }
  return result.data
}

function sha256(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function validateVisualSemantics(
  item: ImageAssetManifestItem,
  detail: NonNullable<Awaited<ReturnType<typeof getAiComicSeriesProject>>['data']>,
): string[] | undefined {
  const labels = detail.visual_bible?.identities.map(identity => identity.label.trim()).filter(Boolean) ?? []
  const visualText = labels.join('\n')
  if (item.required_visual_anchors.some(anchor => !visualText.includes(anchor))) return undefined
  if (item.forbidden_visual_anchors.some(anchor => visualText.includes(anchor))) return undefined
  return labels
}

async function readPreviousReport(path: string): Promise<ImageAssetBindingReport | undefined> {
  try {
    const report = JSON.parse(await readFile(path, 'utf8')) as ImageAssetBindingReport
    return report.schema_version === 'story-agent-cross-seed-image-asset-binding-report/v1'
      ? report
      : undefined
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function validateExistingBinding(params: {
  item: ImageAssetManifestItem
  imageBuffer: Buffer
  seriesProjectId: string
  reusedExistingProject: boolean
}): Promise<BoundImageAssetReportItem | undefined> {
  const projectResult = await getAiComicSeriesProject(params.seriesProjectId)
  if (!projectResult.ok || !projectResult.data) return undefined
  const detail = projectResult.data
  const visualIdentityLabels = validateVisualSemantics(params.item, detail)
  if (!visualIdentityLabels) return undefined
  const asset = detail.seedance_asset_library?.items.find(candidate =>
    candidate.label === params.item.label
    && candidate.kind === params.item.kind
    && candidate.provider === 'openai_imagegen'
    && candidate.provider_asset_id === params.item.provider_asset_id
    && candidate.prompt_sha256 === params.item.prompt_sha256
    && candidate.content_sha256 === params.item.content_sha256
  )
  if (!asset?.content_sha256 || !asset.local_path || !asset.mime_type || !asset.size_bytes) {
    return undefined
  }
  const identity = detail.visual_bible?.identities.find(candidate =>
    candidate.identity_id === asset.identity_binding?.series_identity_id
    && candidate.kind === params.item.kind
    && candidate.label === params.item.label
  )
  if (!identity) return undefined

  const artifactId = `media-sha256-${asset.content_sha256}`
  const preview = await readAiComicSeriesMediaAssetPreview(params.seriesProjectId, artifactId)
  if (
    !preview.ok
    || preview.data.content_sha256 !== params.item.content_sha256
    || !preview.data.buffer.equals(params.imageBuffer)
  ) {
    return undefined
  }
  const assetReportResult = await exportAiComicSeriesSeedanceAssetReportPackage(
    params.seriesProjectId,
  )
  if (!assetReportResult.ok || !assetReportResult.data) return undefined
  const identityReport = assetReportResult.data.completion_plan.identities.find(candidate =>
    candidate.asset_id === asset.asset_id
  )
  if (
    !identityReport?.functional_test_asset_ready
    || !identityReport.functional_test_identity_mapping_current
    || identityReport.production_credit
  ) {
    return undefined
  }

  return {
    seed_id: params.item.seed_id,
    series_project_id: params.seriesProjectId,
    series_title: params.item.series_title,
    generated_episode_count: Object.keys(detail.generated_episode_story_ids).length,
    asset_id: asset.asset_id,
    identity_id: identity.identity_id,
    identity_binding_status: asset.identity_binding?.status,
    provider: asset.provider,
    provider_asset_id: asset.provider_asset_id,
    model: asset.model,
    prompt_sha256: asset.prompt_sha256,
    content_sha256: asset.content_sha256,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    immutable_preview_verified: true,
    functional_test_asset_ready: true,
    functional_test_identity_mapping_current: true,
    visual_semantic_gate_passed: true,
    visual_identity_labels: visualIdentityLabels,
    rights_status: asset.rights_status,
    human_review_status: asset.human_review_status,
    production_credit: false,
    local_path: asset.local_path,
    preview_url: `/api/story-outline/ai-comic-series-projects/${params.seriesProjectId}/media-assets/${artifactId}/preview`,
    reused_existing_project: params.reusedExistingProject,
  }
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const manifestPath = resolve(
  webRoot,
  argumentValue('--manifest')
    ?? 'generated/story-agent-cross-seed-image-assets-20260723/manifest.json',
)
const outputPath = resolve(
  webRoot,
  argumentValue('--output')
    ?? 'generated/story-agent-cross-seed-image-assets-20260723/binding-report.json',
)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ImageAssetManifest
if (manifest.schema_version !== 'story-agent-cross-seed-image-asset-manifest/v1') {
  throw new Error(`unsupported manifest schema: ${manifest.schema_version}`)
}

const previousReport = await readPreviousReport(outputPath)
const reports: BoundImageAssetReportItem[] = []
const workItems = [...manifest.assets]
const queuedBindingKeys = new Set(
  workItems.map(item => `${item.seed_id}:${item.kind}:${item.label}`),
)
async function enqueueRemainingShotIdentities(
  item: ImageAssetManifestItem,
  seriesProjectId: string,
) {
  if (!item.bind_remaining_shot_identities) return
  const project = requireData(
    await rebuildAiComicSeriesVisualBible(seriesProjectId),
    `${item.seed_id} expand visual identities`,
  )
  for (const identity of project.visual_bible?.identities ?? []) {
    if (identity.kind !== 'character' && identity.kind !== 'location') continue
    const key = `${item.seed_id}:${identity.kind}:${identity.label}`
    if (queuedBindingKeys.has(key)) continue
    queuedBindingKeys.add(key)
    workItems.push({
      ...item,
      label: identity.label,
      kind: identity.kind,
      bind_remaining_shot_identities: false,
    })
  }
}

for (let itemIndex = 0; itemIndex < workItems.length; itemIndex += 1) {
  const item = workItems[itemIndex]
  const imagePath = resolve(webRoot, item.source_path)
  const promptPath = resolve(webRoot, item.prompt_path)
  const [imageBuffer, prompt] = await Promise.all([
    readFile(imagePath),
    readFile(promptPath, 'utf8'),
  ])
  const actualContentSha256 = sha256(imageBuffer)
  const actualPromptSha256 = sha256(prompt)
  if (actualContentSha256 !== item.content_sha256) {
    throw new Error(`${item.seed_id}: source image SHA-256 changed`)
  }
  if (actualPromptSha256 !== item.prompt_sha256) {
    throw new Error(`${item.seed_id}: prompt SHA-256 changed`)
  }
  const previousItem = previousReport?.assets.find(candidate =>
    candidate.seed_id === item.seed_id
    && candidate.provider_asset_id === item.provider_asset_id
    && candidate.prompt_sha256 === item.prompt_sha256
    && candidate.content_sha256 === item.content_sha256
  )
  if (previousItem) {
    const reused = await validateExistingBinding({
      item,
      imageBuffer,
      seriesProjectId: previousItem.series_project_id,
      reusedExistingProject: true,
    })
    if (reused) {
      reports.push(reused)
      await enqueueRemainingShotIdentities(item, reused.series_project_id)
      continue
    }
  }

  const seedProjectCandidate = [
    ...reports,
    ...(previousReport?.assets ?? []),
  ].find(candidate => candidate.seed_id === item.seed_id)
  let seriesProjectId = seedProjectCandidate?.series_project_id
  let reusedExistingProject = false
  if (seriesProjectId) {
    const candidateProject = await rebuildAiComicSeriesVisualBible(seriesProjectId)
    if (
      !candidateProject.ok
      || !candidateProject.data
      || !validateVisualSemantics(item, candidateProject.data)
    ) {
      seriesProjectId = undefined
    } else {
      reusedExistingProject = true
    }
  }
  if (!seriesProjectId) {
    const plan = requireData(await generateAiComicSeriesPlan({
      outline: item.outline,
      series_title: item.series_title,
      episode_count: item.episode_count,
      episode_duration_range_sec: item.duration_range_sec,
      pacing_profile: item.pacing_profile,
    }), `${item.seed_id} plan`)
    const initial = requireData(await saveAiComicSeriesProject({ plan }), `${item.seed_id} save`)
    seriesProjectId = initial.project.series_project_id
    for (let episodeNo = 1; episodeNo <= item.episode_count; episodeNo += 1) {
      requireData(await generateAiComicEpisodeFromPlan({
        series_plan: plan,
        series_project_id: seriesProjectId,
        episode_no: episodeNo,
        output_gears_segments: true,
        auto_audit_continuity: true,
      }), `${item.seed_id} episode ${episodeNo}`)
    }
  }

  const beforeUpload = requireData(
    await getAiComicSeriesProject(seriesProjectId),
    `${item.seed_id} refresh`,
  )
  if (!validateVisualSemantics(item, beforeUpload)) {
    throw new Error(`${item.seed_id}: visual semantic anchors or pollution gate failed`)
  }
  const identity = beforeUpload.visual_bible?.identities.find(candidate =>
    candidate.kind === item.kind && candidate.label === item.label
  )
  if (!identity) throw new Error(`${item.seed_id}: visual identity ${item.label} not found`)
  const existingAsset = beforeUpload.seedance_asset_library?.items.find(candidate =>
    candidate.kind === item.kind && candidate.label === item.label
  )
  const upload = requireData(await uploadAiComicSeriesSeedanceAssetFile(
    seriesProjectId,
    {
      asset_id: existingAsset?.asset_id,
      label: item.label,
      kind: item.kind,
      series_identity_id: identity.identity_id,
      description: `${item.series_title}跨种子真实图片母图；人物身份与世界观同图验证。`,
      file: {
        original_filename: basename(imagePath),
        mime_type: 'image/png',
        buffer: imageBuffer,
      },
      trusted_source: {
        provider: manifest.provider,
        provider_asset_id: item.provider_asset_id,
        prompt_sha256: item.prompt_sha256,
        model: manifest.model,
      },
    },
  ), `${item.seed_id} upload`)
  const verified = await validateExistingBinding({
    item,
    imageBuffer,
    seriesProjectId,
    reusedExistingProject,
  })
  if (!verified || verified.asset_id !== upload.asset.asset_id) {
    throw new Error(`${item.seed_id}: immutable preview or identity mapping invariants failed`)
  }
  reports.push(verified)
  await enqueueRemainingShotIdentities(item, seriesProjectId)
}

const shotBindingReports = []
for (const seriesProjectId of [...new Set(reports.map(item => item.series_project_id))]) {
  const assetReport = requireData(
    await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId),
    `${seriesProjectId} shot binding report`,
  )
  shotBindingReports.push({
    series_project_id: seriesProjectId,
    series_title: reports.find(item => item.series_project_id === seriesProjectId)?.series_title ?? '',
    shot_binding_count: assetReport.shot_binding_count,
    unbound_shot_count: assetReport.unbound_shot_count,
    functional_test_identity_mapping_count:
      assetReport.completion_plan.summary.functional_test_identity_mapping_count,
  })
}
const totalShotBindingCount = shotBindingReports.reduce(
  (total, item) => total + item.shot_binding_count,
  0,
)
const totalUnboundShotCount = shotBindingReports.reduce(
  (total, item) => total + item.unbound_shot_count,
  0,
)
if (totalUnboundShotCount > 0) {
  throw new Error(`shot-level image reference gate failed: ${totalUnboundShotCount} unbound shots`)
}

const report = {
  schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1',
  status: 'passed',
  generated_at: new Date().toISOString(),
  provider: manifest.provider,
  model: manifest.model,
  asset_count: reports.length,
  immutable_preview_verified_count: reports.filter(item => item.immutable_preview_verified).length,
  identity_mapping_current_count: reports.filter(
    item => item.functional_test_identity_mapping_current,
  ).length,
  visual_semantic_gate_passed_count: reports.filter(
    item => item.visual_semantic_gate_passed,
  ).length,
  reused_existing_project_count: reports.filter(item => item.reused_existing_project).length,
  created_project_count: reports.filter(item => !item.reused_existing_project).length,
  shot_binding_count: totalShotBindingCount,
  unbound_shot_count: totalUnboundShotCount,
  production_credit_count: reports.filter(item => item.production_credit).length,
  human_review_required: false,
  human_review_deferred: true,
  series_shot_bindings: shotBindingReports,
  assets: reports,
}
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
