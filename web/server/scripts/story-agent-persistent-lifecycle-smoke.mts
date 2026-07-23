import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ApiResponse } from '@shared/types.js'
import {
  assembleAiComicSeriesSeedanceCut,
  assembleAiComicSeriesSeedanceFinalDelivery,
  exportAiComicSeriesSeedanceAssetReportPackage,
  exportAiComicSeriesSeedanceAudioPlanPackage,
  exportAiComicSeriesSeedancePrompts,
  exportAiComicSeriesSeedanceSubtitlePackage,
  exportAiComicSeriesSeedanceTitleCardPlanPackage,
  getAiComicSeriesProject,
  importAiComicSeriesGearsCallbacks,
  mixAiComicSeriesSeedanceAudio,
  readAiComicSeriesMediaAssetPreview,
  renderAiComicSeriesSeedanceSubtitles,
  renderAiComicSeriesSeedanceTitleCards,
  submitAiComicSeriesGearsJobs,
  updateAiComicSeriesSeedanceAudioLibrary,
  updateAiComicSeriesSeedanceProductionStatuses,
} from '../src/services/ai-comic-series-service.js'

type ImageBindingReport = {
  schema_version: 'story-agent-cross-seed-image-asset-binding-report/v1'
  status: 'passed'
  asset_count: number
  shot_binding_count: number
  unbound_shot_count: number
  production_credit_count: number
  human_review_deferred: boolean
  series_shot_bindings: Array<{
    series_project_id: string
    series_title: string
    shot_binding_count: number
    unbound_shot_count: number
    functional_test_identity_mapping_count: number
  }>
  assets: Array<{
    seed_id: string
    series_project_id: string
    content_sha256: string
    immutable_preview_verified: boolean
    functional_test_asset_ready: boolean
    functional_test_identity_mapping_current: boolean
    production_credit: boolean
  }>
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const generatedRoot = resolve(webRoot, 'generated')
const evidenceRoot = resolve(
  generatedRoot,
  'story-agent-cross-seed-image-assets-20260723',
)
const bindingReportPath = resolve(evidenceRoot, 'binding-report.json')
const outputPath = resolve(evidenceRoot, 'persistent-lifecycle-report.json')
const bindingReport = JSON.parse(
  await readFile(bindingReportPath, 'utf8'),
) as ImageBindingReport

assert(
  bindingReport.schema_version
    === 'story-agent-cross-seed-image-asset-binding-report/v1',
  `unsupported image binding report: ${bindingReport.schema_version}`,
)
assert(bindingReport.status === 'passed', 'image binding report is not passing')
assert(bindingReport.unbound_shot_count === 0, 'image binding report contains unbound shots')
assert(bindingReport.production_credit_count === 0, 'functional image assets received production credit')
assert(bindingReport.human_review_deferred, 'human review must remain explicitly deferred')

const originalProviderEnv = {
  GEARS_API_BASE_URL: process.env.GEARS_API_BASE_URL,
  GEARS_EXECUTION_WORKER_API_BASE_URL: process.env.GEARS_EXECUTION_WORKER_API_BASE_URL,
  SEEDANCE_PROVIDER_API_BASE_URL: process.env.SEEDANCE_PROVIDER_API_BASE_URL,
}
delete process.env.GEARS_API_BASE_URL
delete process.env.GEARS_EXECUTION_WORKER_API_BASE_URL
delete process.env.SEEDANCE_PROVIDER_API_BASE_URL

const startedAt = new Date().toISOString()
const startedMs = Date.now()
const runId = startedAt.replace(/[^0-9]/g, '').slice(0, 14)
const projectReports = []

try {
  for (const series of bindingReport.series_shot_bindings) {
    const seriesProjectId = series.series_project_id
    const stageLabel = `${series.series_title} (${seriesProjectId})`
    const projectAssets = bindingReport.assets.filter(
      asset => asset.series_project_id === seriesProjectId,
    )
    assert(projectAssets.length > 0, `${stageLabel}: no generated image assets are bound`)
    assert(series.unbound_shot_count === 0, `${stageLabel}: binding report has unbound shots`)

    for (const asset of projectAssets) {
      assert(asset.immutable_preview_verified, `${stageLabel}: image preview is not immutable`)
      assert(asset.functional_test_asset_ready, `${stageLabel}: image asset is not functionally ready`)
      assert(
        asset.functional_test_identity_mapping_current,
        `${stageLabel}: image identity mapping is stale`,
      )
      assert(!asset.production_credit, `${stageLabel}: test image received production credit`)
      const previewResult = await readAiComicSeriesMediaAssetPreview(
        seriesProjectId,
        `media-sha256-${asset.content_sha256}`,
      )
      if (!previewResult.ok) {
        throw new Error(`${stageLabel} immutable image preview: ${previewResult.message}`)
      }
      const preview = previewResult.data
      assert(
        sha256(preview.buffer) === asset.content_sha256,
        `${stageLabel}: immutable image bytes changed`,
      )
    }

    const promptPackage = requireData(
      await exportAiComicSeriesSeedancePrompts(seriesProjectId),
      `${stageLabel} Seedance prompt export`,
    )
    assert(
      promptPackage.total_shot_count === series.shot_binding_count,
      `${stageLabel}: prompt shots ${promptPackage.total_shot_count}/${series.shot_binding_count}`,
    )
    assert(
      promptPackage.seedance_production?.items.length === promptPackage.total_shot_count,
      `${stageLabel}: Seedance production ledger was not initialized for every shot`,
    )
    const promptShots = promptPackage.episodes.flatMap(episode =>
      episode.package.shot_units.map(shot => ({
        episode_no: episode.episode_no,
        shot,
      }))
    )
    const invalidPromptShots = promptShots.filter(({ shot }) =>
      shot.asset_slots.filter(slot => slot.required).length === 0
      || shot.material_validation.missing_required_slots.length > 0
      || shot.material_validation.duration_risk === 'overloaded'
      || !shot.seedance_prompt.includes('@图片')
    )
    assert(
      invalidPromptShots.length === 0,
      `${stageLabel}: ${invalidPromptShots.length} prompts lost required image references`,
    )

    const beforeAssetReport = requireData(
      await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId),
      `${stageLabel} preflight asset report`,
    )
    assert(
      beforeAssetReport.shot_binding_count === promptPackage.total_shot_count
      && beforeAssetReport.unbound_shot_count === 0,
      `${stageLabel}: shot-level image binding preflight failed`,
    )
    assert(
      beforeAssetReport.completion_plan.summary.functional_test_identity_mapping_count
        === series.functional_test_identity_mapping_count,
      `${stageLabel}: functional image identity count drifted`,
    )
    assert(
      beforeAssetReport.completion_plan.summary.production_credit_count === 0,
      `${stageLabel}: human/rights gate was bypassed`,
    )

    requireData(await updateAiComicSeriesSeedanceProductionStatuses(seriesProjectId, {
      updates: promptShots.map(({ episode_no, shot }) => ({
        episode_no,
        shot_id: shot.shot_id,
        status: 'prompt_exported' as const,
        note: `persistent lifecycle smoke ${runId}: reset local simulation cycle`,
      })),
    }), `${stageLabel} repeatable local-cycle reset`)

    const initialSubmit = requireData(await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'seedance_video',
      use_gears_api: false,
      overwrite_existing: true,
      note: `persistent lifecycle smoke ${runId}: local mocked shot submission`,
    }), `${stageLabel} local GEARS submit`)
    assert(
      initialSubmit.provider_adapter?.status === 'mocked',
      `${stageLabel}: GEARS adapter was not mocked`,
    )
    assert(
      initialSubmit.submitted_jobs.length === promptPackage.total_shot_count,
      `${stageLabel}: submitted ${initialSubmit.submitted_jobs.length}/${promptPackage.total_shot_count} shots`,
    )

    const [retryCandidate, ...firstPassJobs] = initialSubmit.submitted_jobs
    assert(retryCandidate, `${stageLabel}: retry candidate was not created`)
    const firstPassCallback = requireData(
      await importAiComicSeriesGearsCallbacks(seriesProjectId, {
        data: {
          tasks: [
            {
              jobId: retryCandidate.gears_job_id,
              sourceUnitId: retryCandidate.source_unit_id,
              jobType: 'seedance_video',
              taskStatus: 'FAILED',
              failureReason: 'local synthetic transient failure for retry coverage',
            },
            ...firstPassJobs.map((job, index) => ({
              jobId: job.gears_job_id,
              sourceUnitId: job.source_unit_id,
              jobType: 'seedance_video',
              taskStatus: 'COMPLETED',
              outputUrl:
                `https://local-smoke.invalid/${seriesProjectId}/${runId}/shot-${index + 2}.mp4`,
            })),
          ],
        },
      }),
      `${stageLabel} first-pass callbacks`,
    )
    assert(
      firstPassCallback.failed_count === 0,
      `${stageLabel}: callback importer rejected ${firstPassCallback.failed_count} callbacks`,
    )

    const retrySubmit = requireData(await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'seedance_video',
      source_unit_id: retryCandidate.source_unit_id,
      use_gears_api: false,
      overwrite_existing: true,
      note: `persistent lifecycle smoke ${runId}: local retry`,
    }), `${stageLabel} retry submit`)
    assert(
      retrySubmit.provider_adapter?.status === 'mocked'
      && retrySubmit.submitted_jobs.length === 1,
      `${stageLabel}: expected exactly one mocked retry`,
    )
    const retriedJob = retrySubmit.submitted_jobs[0]
    requireData(await importAiComicSeriesGearsCallbacks(seriesProjectId, {
      jobId: retriedJob.gears_job_id,
      sourceUnitId: retriedJob.source_unit_id,
      jobType: 'seedance_video',
      status: 'COMPLETED',
      videoUrl: `https://local-smoke.invalid/${seriesProjectId}/${runId}/shot-retry.mp4`,
      message: 'local synthetic retry completed',
    }), `${stageLabel} retry callback`)

    const afterCallbacks = requireData(
      await getAiComicSeriesProject(seriesProjectId),
      `${stageLabel} callback refresh`,
    )
    const readyShots = afterCallbacks.seedance_production?.items.filter(
      item => item.status === 'ready' && Boolean(item.video_url),
    ) ?? []
    assert(
      readyShots.length === promptPackage.total_shot_count,
      `${stageLabel}: ready shots ${readyShots.length}/${promptPackage.total_shot_count}`,
    )
    const retryItem = readyShots.find(
      item => item.production_id === retryCandidate.source_unit_id,
    )
    assert(
      retryItem && retryItem.retry_count >= 1,
      `${stageLabel}: retry recovery was not persisted`,
    )

    const cut = requireData(await assembleAiComicSeriesSeedanceCut(
      seriesProjectId,
      {
        dry_run: false,
        overwrite: true,
        assembly_mode: 'transcode',
        output_profile: 'mp4_h264_720p',
        output_filename: 'persistent-lifecycle-cut.mp4',
      },
      {
        runner: async ({ outputPath: stagingPath }) => {
          await writeFile(
            stagingPath,
            `LOCAL SYNTHETIC CUT\nproject=${seriesProjectId}\nrun=${runId}\n`,
          )
        },
      },
    ), `${stageLabel} cut assembly`)
    assert(
      cut.status === 'assembled'
      && cut.source_shot_count === promptPackage.total_shot_count
      && cut.missing_shot_count === 0,
      `${stageLabel}: cut assembly did not cover all shots`,
    )

    const subtitlePackage = requireData(
      await exportAiComicSeriesSeedanceSubtitlePackage(seriesProjectId),
      `${stageLabel} subtitle export`,
    )
    assert(subtitlePackage.cue_count > 0, `${stageLabel}: subtitle package is empty`)
    const subtitles = requireData(await renderAiComicSeriesSeedanceSubtitles(
      seriesProjectId,
      {
        dry_run: false,
        overwrite: true,
        mode: 'burn_in',
        output_filename: 'persistent-lifecycle-subtitled.mp4',
      },
      {
        runner: async ({ outputPath: stagingPath }) => {
          await writeFile(
            stagingPath,
            `LOCAL SYNTHETIC SUBTITLED CUT\nproject=${seriesProjectId}\nrun=${runId}\n`,
          )
        },
      },
    ), `${stageLabel} subtitle render`)
    assert(subtitles.status === 'rendered', `${stageLabel}: subtitles were not rendered`)

    const initialAudioPlan = requireData(
      await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId),
      `${stageLabel} audio plan`,
    )
    assert(
      initialAudioPlan.suggested_assets.length > 0,
      `${stageLabel}: audio plan has no bindable suggestions`,
    )
    const projectDir = resolve(
      generatedRoot,
      'ai-comic-series-projects',
      seriesProjectId,
    )
    await mkdir(resolve(projectDir, 'audio'), { recursive: true })
    const audioItems = []
    for (const [index, suggested] of initialAudioPlan.suggested_assets.entries()) {
      const relativePath = `audio/persistent-lifecycle-${index + 1}.mp3`
      await writeFile(
        resolve(projectDir, relativePath),
        `LOCAL SYNTHETIC AUDIO\nproject=${seriesProjectId}\nrun=${runId}\nasset=${suggested.asset_id}\n`,
      )
      audioItems.push({
        asset_id: suggested.asset_id,
        kind: suggested.kind,
        label: suggested.label,
        file_url: relativePath,
        duration_sec: initialAudioPlan.total_duration_sec,
        loopable: true,
        license_note: 'local synthetic functional smoke asset; no production credit',
      })
    }
    requireData(await updateAiComicSeriesSeedanceAudioLibrary(seriesProjectId, {
      items: audioItems,
    }), `${stageLabel} audio library binding`)
    const boundAudioPlan = requireData(
      await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId),
      `${stageLabel} bound audio plan`,
    )
    assert(
      boundAudioPlan.missing_audio_count === 0,
      `${stageLabel}: ${boundAudioPlan.missing_audio_count} audio cues remain unbound`,
    )

    const audioMix = requireData(await mixAiComicSeriesSeedanceAudio(
      seriesProjectId,
      {
        dry_run: false,
        overwrite: true,
        input_video_path: subtitles.output_path,
        output_filename: 'persistent-lifecycle-audio-mix.mp4',
        include_original_audio: true,
        original_audio_volume_db: -6,
      },
      {
        runner: async ({ outputPath: stagingPath }) => {
          await writeFile(
            stagingPath,
            `LOCAL SYNTHETIC AUDIO MIX\nproject=${seriesProjectId}\nrun=${runId}\n`,
          )
        },
      },
    ), `${stageLabel} audio mix`)
    assert(
      audioMix.status === 'mixed'
      && audioMix.source_audio_count > 0
      && audioMix.missing_audio_count === 0,
      `${stageLabel}: audio mix is incomplete`,
    )

    const titleCardPlan = requireData(
      await exportAiComicSeriesSeedanceTitleCardPlanPackage(seriesProjectId),
      `${stageLabel} title-card plan`,
    )
    assert(titleCardPlan.total_card_count > 0, `${stageLabel}: title-card plan is empty`)
    const fontPath = resolve(projectDir, 'fonts', 'persistent-lifecycle-smoke.ttf')
    await mkdir(resolve(projectDir, 'fonts'), { recursive: true })
    await writeFile(fontPath, 'LOCAL SYNTHETIC FONT FIXTURE')
    const titleCards = requireData(await renderAiComicSeriesSeedanceTitleCards(
      seriesProjectId,
      {
        dry_run: false,
        overwrite: true,
        output_profile: 'mp4_h264_720p',
        font_path: fontPath,
      },
      {
        runner: async ({ card, outputPath: stagingPath }) => {
          await writeFile(
            stagingPath,
            `LOCAL SYNTHETIC TITLE CARD\nproject=${seriesProjectId}\ncard=${card.card_id}\nrun=${runId}\n`,
          )
        },
      },
    ), `${stageLabel} title-card render`)
    assert(
      titleCards.status === 'rendered'
      && titleCards.rendered_count === titleCardPlan.total_card_count,
      `${stageLabel}: title cards ${titleCards.rendered_count}/${titleCardPlan.total_card_count}`,
    )

    const finalDelivery = requireData(await assembleAiComicSeriesSeedanceFinalDelivery(
      seriesProjectId,
      {
        dry_run: false,
        overwrite: true,
        include_subtitles: true,
        include_audio_mix: true,
        include_title_cards: true,
        missing_dependency_mode: 'strict',
        output_profile: 'mp4_h264_720p',
        output_filename: 'persistent-lifecycle-final.mp4',
      },
      {
        runner: async ({ outputPath: stagingPath }) => {
          await writeFile(
            stagingPath,
            `LOCAL SYNTHETIC FINAL DELIVERY\nproject=${seriesProjectId}\nrun=${runId}\n`,
          )
        },
      },
    ), `${stageLabel} final delivery`)
    const release = finalDelivery.seedance_final_delivery.current_release
    assert(
      finalDelivery.status === 'assembled' && release?.immutable,
      `${stageLabel}: immutable final release was not created`,
    )
    assert(
      finalDelivery.dependency_status.missing_dependencies.length === 0,
      `${stageLabel}: final delivery has missing dependencies`,
    )
    assert(
      finalDelivery.manifest.cost_governance.status === 'not_applicable',
      `${stageLabel}: local smoke unexpectedly entered provider cost governance`,
    )
    const [archivedOutput, archivedManifest] = await Promise.all([
      readFile(resolve(projectDir, release.archived_output_path)),
      readFile(resolve(projectDir, release.archived_manifest_path)),
    ])
    assert(
      sha256(archivedOutput) === release.output_sha256
      && sha256(archivedManifest) === release.manifest_sha256,
      `${stageLabel}: immutable release hash verification failed`,
    )

    const finalProject = requireData(
      await getAiComicSeriesProject(seriesProjectId),
      `${stageLabel} final refresh`,
    )
    const finalAssetReport = requireData(
      await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId),
      `${stageLabel} final asset report`,
    )
    assert(
      finalAssetReport.shot_binding_count === promptPackage.total_shot_count
      && finalAssetReport.unbound_shot_count === 0,
      `${stageLabel}: image references drifted during lifecycle`,
    )
    const externallyAuthorizedItems = finalProject.seedance_production?.items.filter(item =>
      item.external_call_authorization
      || item.execution_cost
      || item.versions.some(version =>
        version.external_call_authorization || version.execution_cost
      )
    ) ?? []
    assert(
      externallyAuthorizedItems.length === 0,
      `${stageLabel}: external authorization or cost evidence appeared in local smoke`,
    )
    const stageStatuses = {
      cut: finalProject.seedance_cut_assembly?.status,
      subtitles: finalProject.seedance_subtitle_render?.status,
      audio: finalProject.seedance_audio_mix?.status,
      title_cards: finalProject.seedance_title_card_render?.status,
      final_delivery: finalProject.seedance_final_delivery?.status,
    }
    assert(
      Object.values(stageStatuses).every(status => status === 'ready'),
      `${stageLabel}: one or more persisted post-production stages are not ready`,
    )

    projectReports.push({
      seed_id: projectAssets[0].seed_id,
      series_project_id: seriesProjectId,
      series_title: series.series_title,
      generated_episode_count: promptPackage.generated_episode_count,
      shot_count: promptPackage.total_shot_count,
      image_asset_count: projectAssets.length,
      image_bound_shot_count: finalAssetReport.shot_binding_count,
      image_unbound_shot_count: finalAssetReport.unbound_shot_count,
      prompt_image_reference_count: promptShots.reduce(
        (total, item) => total + item.shot.asset_slots.filter(slot => slot.modality === 'image').length,
        0,
      ),
      initial_job_count: initialSubmit.submitted_jobs.length,
      callback_import_failure_count: firstPassCallback.failed_count,
      synthetic_failure_count: 1,
      retry_job_count: retrySubmit.submitted_jobs.length,
      ready_shot_count: readyShots.length,
      subtitle_cue_count: subtitlePackage.cue_count,
      audio_asset_count: audioItems.length,
      missing_audio_count: boundAudioPlan.missing_audio_count,
      title_card_count: titleCards.rendered_count,
      stages: stageStatuses,
      release: {
        release_id: release.release_id,
        immutable: release.immutable,
        output_sha256: release.output_sha256,
        manifest_sha256: release.manifest_sha256,
        output_byte_size: release.output_byte_size,
        manifest_byte_size: release.manifest_byte_size,
      },
    })
  }

  const totals = {
    project_count: projectReports.length,
    episode_count: projectReports.reduce(
      (total, project) => total + project.generated_episode_count,
      0,
    ),
    shot_count: projectReports.reduce((total, project) => total + project.shot_count, 0),
    image_asset_count: projectReports.reduce(
      (total, project) => total + project.image_asset_count,
      0,
    ),
    image_bound_shot_count: projectReports.reduce(
      (total, project) => total + project.image_bound_shot_count,
      0,
    ),
    prompt_image_reference_count: projectReports.reduce(
      (total, project) => total + project.prompt_image_reference_count,
      0,
    ),
    initial_job_count: projectReports.reduce(
      (total, project) => total + project.initial_job_count,
      0,
    ),
    synthetic_failure_count: projectReports.reduce(
      (total, project) => total + project.synthetic_failure_count,
      0,
    ),
    retry_job_count: projectReports.reduce(
      (total, project) => total + project.retry_job_count,
      0,
    ),
    ready_shot_count: projectReports.reduce(
      (total, project) => total + project.ready_shot_count,
      0,
    ),
    subtitle_cue_count: projectReports.reduce(
      (total, project) => total + project.subtitle_cue_count,
      0,
    ),
    audio_asset_count: projectReports.reduce(
      (total, project) => total + project.audio_asset_count,
      0,
    ),
    title_card_count: projectReports.reduce(
      (total, project) => total + project.title_card_count,
      0,
    ),
    immutable_release_count: projectReports.filter(
      project => project.release.immutable,
    ).length,
  }
  assert(
    totals.project_count === bindingReport.series_shot_bindings.length
    && totals.shot_count === bindingReport.shot_binding_count
    && totals.image_asset_count === bindingReport.asset_count
    && totals.image_bound_shot_count === totals.shot_count
    && totals.initial_job_count === totals.shot_count
    && totals.ready_shot_count === totals.shot_count
    && totals.retry_job_count === totals.project_count
    && totals.immutable_release_count === totals.project_count,
    'cross-project persistent lifecycle totals failed',
  )

  const report = {
    schema_version: 'story-agent-persistent-cross-seed-lifecycle-smoke/v1',
    status: 'passed',
    mode: 'persistent_projects_local_synthetic_media',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    external_provider_called: false,
    external_authorization_used: false,
    actual_provider_cost: 0,
    generated_images_are_real_ai_assets: true,
    video_audio_and_font_artifacts_are_local_synthetic_fixtures: true,
    human_review_required: false,
    human_review_deferred: true,
    production_credit_granted: false,
    source_image_binding_report: bindingReportPath,
    totals,
    invariants: {
      every_persistent_project_completed: true,
      every_shot_has_current_image_binding: true,
      every_prompt_has_required_image_references: true,
      every_mocked_job_recovered: true,
      every_audio_cue_bound: true,
      every_postproduction_stage_ready: true,
      every_release_immutable_and_hash_verified: true,
      no_external_provider_or_authorization_used: true,
      no_human_gate_or_production_credit_bypassed: true,
    },
    projects: projectReports,
  }
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
} finally {
  for (const [key, value] of Object.entries(originalProviderEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
