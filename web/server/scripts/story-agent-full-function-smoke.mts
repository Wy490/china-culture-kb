import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type { ApiResponse } from '@shared/types.js'
import {
  assembleAiComicSeriesSeedanceCut,
  assembleAiComicSeriesSeedanceFinalDelivery,
  exportAiComicSeriesSeedanceAudioPlanPackage,
  exportAiComicSeriesSeedancePrompts,
  exportAiComicSeriesSeedanceSubtitlePackage,
  exportAiComicSeriesSeedanceTitleCardPlanPackage,
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  importAiComicSeriesGearsCallbacks,
  mixAiComicSeriesSeedanceAudio,
  renderAiComicSeriesSeedanceSubtitles,
  renderAiComicSeriesSeedanceTitleCards,
  saveAiComicSeriesProject,
  submitAiComicSeriesGearsJobs,
  updateAiComicSeriesSeedanceAudioLibrary,
} from '../src/services/ai-comic-series-service.js'

const EPISODE_COUNT = 3

type SmokeStage = {
  status: string
  artifact_count?: number
  output_sha256?: string
  manifest_sha256?: string
}

function requireData<T>(
  result: ApiResponse<T>,
  stage: string,
): T {
  if (!result.ok || !result.data) {
    const detail = result.error?.message ?? result.error?.code ?? 'missing response data'
    throw new Error(`${stage} failed: ${detail}`)
  }
  return result.data
}

async function runSmoke(workspaceRoot: string) {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  const realDataRoot = resolve(import.meta.dirname, '..', '..', '..', 'data')
  const generatedRoot = resolve(workspaceRoot, 'web', 'generated')
  await symlink(realDataRoot, resolve(workspaceRoot, 'data'), 'dir')
  process.env.KB_ROOT = resolve(workspaceRoot, 'data')
  process.env.WEB_GENERATED_ROOT = generatedRoot
  delete process.env.GEARS_API_BASE_URL
  delete process.env.GEARS_EXECUTION_WORKER_API_BASE_URL
  delete process.env.SEEDANCE_PROVIDER_API_BASE_URL

  const plan = requireData(await generateAiComicSeriesPlan({
    outline: '宋代小城的守灯少女阿棠在雨夜发现一盏会映出失踪者记忆的皮影灯。她与年轻画师沈砚循着灯影追查旧戏班失火真相，必须在三夜内救出被困在影幕中的孩子，并决定真相应当如何被人记住。',
    series_title: '影灯三夜',
    episode_count: EPISODE_COUNT,
    episode_duration_range_sec: { min: 60, max: 90 },
    pacing_profile: 'balanced_drama',
  }), 'series plan')

  const initialProject = requireData(
    await saveAiComicSeriesProject({ plan }),
    'initial series project save',
  )
  const seriesProjectId = initialProject.project.series_project_id
  const generatedEpisodeStoryIds: Record<string, string> = {}
  for (let episodeNo = 1; episodeNo <= EPISODE_COUNT; episodeNo += 1) {
    const episode = requireData(await generateAiComicEpisodeFromPlan({
      series_plan: plan,
      episode_no: episodeNo,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
      auto_audit_continuity: true,
    }), `episode ${episodeNo} generation`)
    generatedEpisodeStoryIds[String(episodeNo)] = episode.storyId
  }
  requireData(await saveAiComicSeriesProject({
    series_project_id: seriesProjectId,
    plan,
    generated_episode_story_ids: generatedEpisodeStoryIds,
  }), 'generated episode project save')

  const promptPackage = requireData(
    await exportAiComicSeriesSeedancePrompts(seriesProjectId),
    'Seedance prompt export',
  )
  if (promptPackage.generated_episode_count !== EPISODE_COUNT || promptPackage.total_shot_count <= 0) {
    throw new Error('Seedance prompt export did not contain every generated episode and shot')
  }

  const initialSubmit = requireData(await submitAiComicSeriesGearsJobs(seriesProjectId, {
    job_type: 'seedance_video',
    use_gears_api: false,
    overwrite_existing: true,
    note: 'isolated full-function smoke: local mocked shot submission',
  }), 'local GEARS shot submit')
  const adapterStatus = initialSubmit.provider_adapter?.status
  if (adapterStatus !== 'mocked') {
    throw new Error(`expected mocked GEARS adapter, received ${adapterStatus ?? 'missing'}`)
  }
  if (initialSubmit.submitted_jobs.length !== promptPackage.total_shot_count) {
    throw new Error(
      `GEARS submitted ${initialSubmit.submitted_jobs.length}/${promptPackage.total_shot_count} shot jobs`,
    )
  }

  const [retryCandidate, ...firstPassJobs] = initialSubmit.submitted_jobs
  if (!retryCandidate) throw new Error('GEARS smoke did not create a retry candidate')
  const firstPassCallback = requireData(await importAiComicSeriesGearsCallbacks(seriesProjectId, {
    data: {
      tasks: [
        {
          jobId: retryCandidate.gears_job_id,
          sourceUnitId: retryCandidate.source_unit_id,
          jobType: 'seedance_video',
          taskStatus: 'FAILED',
          failureReason: 'synthetic transient failure for retry coverage',
        },
        ...firstPassJobs.map((job, index) => ({
          jobId: job.gears_job_id,
          sourceUnitId: job.source_unit_id,
          jobType: 'seedance_video',
          taskStatus: 'COMPLETED',
          outputUrl: `https://synthetic.invalid/story-agent/shot-${index + 2}.mp4`,
        })),
      ],
    },
  }), 'first-pass GEARS callbacks')
  if (firstPassCallback.failed_count !== 0) {
    throw new Error(`first-pass callback import reported ${firstPassCallback.failed_count} import failures`)
  }

  const retrySubmit = requireData(await submitAiComicSeriesGearsJobs(seriesProjectId, {
    job_type: 'seedance_video',
    source_unit_id: retryCandidate.source_unit_id,
    use_gears_api: false,
    overwrite_existing: true,
    note: 'isolated full-function smoke: retry transient shot failure',
  }), 'GEARS retry submit')
  if (retrySubmit.submitted_jobs.length !== 1) {
    throw new Error(`expected one GEARS retry job, received ${retrySubmit.submitted_jobs.length}`)
  }
  const retriedJob = retrySubmit.submitted_jobs[0]
  requireData(await importAiComicSeriesGearsCallbacks(seriesProjectId, {
    jobId: retriedJob.gears_job_id,
    sourceUnitId: retriedJob.source_unit_id,
    jobType: 'seedance_video',
    status: 'COMPLETED',
    videoUrl: 'https://synthetic.invalid/story-agent/shot-retry.mp4',
    message: 'synthetic retry completed',
  }), 'GEARS retry callback')

  const afterCallbacks = requireData(
    await getAiComicSeriesProject(seriesProjectId),
    'project refresh after callbacks',
  )
  const readyShots = afterCallbacks.seedance_production?.items.filter(item => item.status === 'ready') ?? []
  if (readyShots.length !== promptPackage.total_shot_count) {
    throw new Error(`ready shot count ${readyShots.length}/${promptPackage.total_shot_count}`)
  }

  const cut = requireData(await assembleAiComicSeriesSeedanceCut(
    seriesProjectId,
    {
      dry_run: false,
      overwrite: true,
      assembly_mode: 'transcode',
      output_profile: 'mp4_h264_720p',
      output_filename: 'isolated-full-series-cut.mp4',
    },
    {
      runner: async ({ outputPath }) => {
        await writeFile(outputPath, 'synthetic isolated cut artifact')
      },
    },
  ), 'cut assembly')
  if (cut.status !== 'assembled') throw new Error(`cut assembly status was ${cut.status}`)

  const subtitlePackage = requireData(
    await exportAiComicSeriesSeedanceSubtitlePackage(seriesProjectId),
    'subtitle package export',
  )
  const subtitles = requireData(await renderAiComicSeriesSeedanceSubtitles(
    seriesProjectId,
    {
      dry_run: false,
      overwrite: true,
      mode: 'burn_in',
      output_filename: 'isolated-full-series-subtitled.mp4',
    },
    {
      runner: async ({ outputPath }) => {
        await writeFile(outputPath, 'synthetic isolated subtitle-burned artifact')
      },
    },
  ), 'subtitle burn-in')
  if (subtitles.status !== 'rendered') throw new Error(`subtitle render status was ${subtitles.status}`)

  const audioPlan = requireData(
    await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId),
    'audio plan export',
  )
  const suggestedAudio = audioPlan.suggested_assets[0]
  if (!suggestedAudio) throw new Error('audio plan did not suggest a bindable asset')
  const projectDir = resolve(generatedRoot, 'ai-comic-series-projects', seriesProjectId)
  const localAudioPath = 'audio/isolated-series-bed.mp3'
  await mkdir(resolve(projectDir, 'audio'), { recursive: true })
  await writeFile(resolve(projectDir, localAudioPath), 'synthetic isolated audio asset')
  requireData(await updateAiComicSeriesSeedanceAudioLibrary(seriesProjectId, {
    items: [{
      asset_id: suggestedAudio.asset_id,
      kind: suggestedAudio.kind,
      label: suggestedAudio.label,
      file_url: localAudioPath,
      duration_sec: audioPlan.total_duration_sec,
      loopable: true,
      license_note: 'synthetic isolated functional smoke asset',
    }],
  }), 'audio library binding')

  const audioMix = requireData(await mixAiComicSeriesSeedanceAudio(
    seriesProjectId,
    {
      dry_run: false,
      overwrite: true,
      input_video_path: subtitles.output_path,
      output_filename: 'isolated-full-series-audio-mix.mp4',
      include_original_audio: true,
      original_audio_volume_db: -6,
    },
    {
      runner: async ({ outputPath }) => {
        await writeFile(outputPath, 'synthetic isolated audio-mixed artifact')
      },
    },
  ), 'audio mix')
  if (audioMix.status !== 'mixed') throw new Error(`audio mix status was ${audioMix.status}`)

  const titleCardPlan = requireData(
    await exportAiComicSeriesSeedanceTitleCardPlanPackage(seriesProjectId),
    'title-card plan export',
  )
  const fontPath = resolve(projectDir, 'fonts', 'isolated-smoke.ttf')
  await mkdir(resolve(projectDir, 'fonts'), { recursive: true })
  await writeFile(fontPath, 'synthetic isolated font fixture')
  const titleCards = requireData(await renderAiComicSeriesSeedanceTitleCards(
    seriesProjectId,
    {
      dry_run: false,
      overwrite: true,
      output_profile: 'mp4_h264_720p',
      font_path: fontPath,
    },
    {
      runner: async ({ card, outputPath }) => {
        await writeFile(outputPath, `synthetic isolated title card ${card.card_id}`)
      },
    },
  ), 'title-card render')
  if (titleCards.status !== 'rendered' || titleCards.rendered_count !== titleCardPlan.total_card_count) {
    throw new Error(
      `title-card render completed ${titleCards.rendered_count}/${titleCardPlan.total_card_count}`,
    )
  }

  const finalDelivery = requireData(await assembleAiComicSeriesSeedanceFinalDelivery(
    seriesProjectId,
    {
      dry_run: false,
      overwrite: true,
      include_subtitles: false,
      include_audio_mix: true,
      include_title_cards: true,
      missing_dependency_mode: 'strict',
      output_profile: 'mp4_h264_720p',
      output_filename: 'isolated-final-delivery.mp4',
    },
    {
      runner: async ({ outputPath }) => {
        await writeFile(outputPath, 'synthetic isolated final delivery artifact')
      },
    },
  ), 'final delivery assembly')
  const release = finalDelivery.seedance_final_delivery.current_release
  if (finalDelivery.status !== 'assembled' || !release?.immutable) {
    throw new Error(`final delivery did not produce an immutable release: ${finalDelivery.status}`)
  }

  const finalProject = requireData(
    await getAiComicSeriesProject(seriesProjectId),
    'final project refresh',
  )
  const stages: Record<string, SmokeStage> = {
    story_plan: { status: 'passed' },
    episode_generation: {
      status: 'passed',
      artifact_count: Object.keys(generatedEpisodeStoryIds).length,
    },
    shot_prompt_export: {
      status: 'passed',
      artifact_count: promptPackage.total_shot_count,
    },
    mocked_gears_submit_callback_retry: {
      status: 'passed',
      artifact_count: readyShots.length,
    },
    cut_assembly: { status: finalProject.seedance_cut_assembly?.status ?? 'missing' },
    subtitle_render: {
      status: finalProject.seedance_subtitle_render?.status ?? 'missing',
      artifact_count: subtitlePackage.cue_count,
    },
    audio_mix: {
      status: finalProject.seedance_audio_mix?.status ?? 'missing',
      artifact_count: audioMix.source_audio_count,
    },
    title_card_render: {
      status: finalProject.seedance_title_card_render?.status ?? 'missing',
      artifact_count: titleCards.rendered_count,
    },
    final_delivery: {
      status: finalProject.seedance_final_delivery?.status ?? 'missing',
      artifact_count: finalDelivery.manifest.deliverables.length,
      output_sha256: release.output_sha256,
      manifest_sha256: release.manifest_sha256,
    },
  }
  const nonPassingStages = Object.entries(stages).filter(([, stage]) =>
    !['passed', 'ready'].includes(stage.status)
  )
  if (nonPassingStages.length > 0) {
    throw new Error(`non-passing final stages: ${nonPassingStages.map(([name]) => name).join(', ')}`)
  }

  return {
    schema_version: 'story-agent-isolated-full-function-smoke/v1',
    status: 'passed',
    mode: 'isolated_synthetic_artifacts',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    external_provider_called: false,
    external_authorization_used: false,
    human_review_required: false,
    formal_project_contaminated: false,
    series: {
      title: plan.series_title,
      planned_episode_count: plan.episode_count,
      generated_episode_count: Object.keys(generatedEpisodeStoryIds).length,
      shot_count: promptPackage.total_shot_count,
    },
    gears: {
      adapter_status: adapterStatus,
      initial_job_count: initialSubmit.submitted_jobs.length,
      synthetic_failure_count: 1,
      retry_job_count: retrySubmit.submitted_jobs.length,
      ready_shot_count: readyShots.length,
      callback_import_failure_count: firstPassCallback.failed_count,
    },
    stages,
    release: {
      immutable: release.immutable,
      output_sha256: release.output_sha256,
      manifest_sha256: release.manifest_sha256,
      deliverable_count: finalDelivery.manifest.deliverables.length,
    },
  }
}

const originalEnv = {
  KB_ROOT: process.env.KB_ROOT,
  WEB_GENERATED_ROOT: process.env.WEB_GENERATED_ROOT,
  GEARS_API_BASE_URL: process.env.GEARS_API_BASE_URL,
  GEARS_EXECUTION_WORKER_API_BASE_URL: process.env.GEARS_EXECUTION_WORKER_API_BASE_URL,
  SEEDANCE_PROVIDER_API_BASE_URL: process.env.SEEDANCE_PROVIDER_API_BASE_URL,
}
const workspaceRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-full-function-smoke-'))
let report: Awaited<ReturnType<typeof runSmoke>> | undefined
let failureReason: string | undefined
let cleanupRemoved = false
try {
  report = await runSmoke(workspaceRoot)
} catch (error) {
  failureReason = error instanceof Error ? error.message : String(error)
} finally {
  try {
    await rm(workspaceRoot, { recursive: true, force: true })
    cleanupRemoved = true
  } catch (error) {
    const cleanupReason = error instanceof Error ? error.message : String(error)
    failureReason = failureReason
      ? `${failureReason}; isolated workspace cleanup failed: ${cleanupReason}`
      : `isolated workspace cleanup failed: ${cleanupReason}`
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

if (report && !failureReason && cleanupRemoved) {
  console.log(JSON.stringify({
    ...report,
    cleanup: {
      isolated_workspace_removed: true,
      formal_generated_root_untouched: true,
    },
  }, null, 2))
} else {
  console.log(JSON.stringify({
    schema_version: 'story-agent-isolated-full-function-smoke/v1',
    status: 'failed',
    mode: 'isolated_synthetic_artifacts',
    external_provider_called: false,
    external_authorization_used: false,
    human_review_required: false,
    formal_project_contaminated: false,
    cleanup: {
      isolated_workspace_removed: cleanupRemoved,
      formal_generated_root_untouched: true,
    },
    reason: failureReason ?? 'smoke report was not produced',
  }, null, 2))
  process.exitCode = 1
}
