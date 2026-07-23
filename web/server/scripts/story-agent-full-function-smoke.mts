import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type { AiComicPacingProfile, ApiResponse, TruthMode } from '@shared/types.js'
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

type SmokeSeed = {
  seed_id: string
  outline: string
  series_title: string
  episode_count: number
  duration_range_sec: {
    min: number
    max: number
  }
  pacing_profile: AiComicPacingProfile
  expected_truth_mode: TruthMode
}

const DEFAULT_SEED: SmokeSeed = {
  seed_id: 'original-mystery',
  outline: '近未来海上城市停电后，记忆修理师顾弦发现失踪乘客的声音藏在废弃广播频段中。她与巡检员陆潮必须在三次潮汐前找出篡改航行记录的人，并决定是否公开一段会改变整座城市身份认知的集体记忆。',
  series_title: '潮汐失忆局',
  episode_count: 3,
  duration_range_sec: { min: 60, max: 90 },
  pacing_profile: 'mystery_cliffhanger',
  expected_truth_mode: 'fictional_original',
}

const MATRIX_SEEDS: SmokeSeed[] = [
  DEFAULT_SEED,
  {
    seed_id: 'historical-ethics',
    outline: '北宋南安军司理参军周敦颐面对一桩按律不该判死的案件，拒绝迎合上官王逵，甚至取出告身准备辞官。围绕案卷证据、官场压力与百姓命运，讲清可核实史实、地方传说和后世阐释的边界。',
    series_title: '告身不署',
    episode_count: 4,
    duration_range_sec: { min: 75, max: 120 },
    pacing_profile: 'slow_burn',
    expected_truth_mode: 'source_adaptation',
  },
  {
    seed_id: 'heritage-craft',
    outline: '长沙湘绣工作室面临代表作修复期限，青年绣娘苏翎必须向老师傅重新学习鬅毛针、掺针和劈丝。她一边修复狮虎绣屏，一边阻止团队把非遗工艺简化成流水线滤镜。',
    series_title: '一线醒狮',
    episode_count: 5,
    duration_range_sec: { min: 60, max: 100 },
    pacing_profile: 'balanced_drama',
    expected_truth_mode: 'source_adaptation',
  },
  {
    seed_id: 'children-legend',
    outline: '炎帝神农氏传说中的白鹿误把一袋待辨认的草药带进山谷，少年药童小禾必须在日落前辨清药性并送回洗药池。故事明确传说、文化记忆与可验证植物常识的边界。',
    series_title: '白鹿送药记',
    episode_count: 2,
    duration_range_sec: { min: 45, max: 75 },
    pacing_profile: 'fast_hook',
    expected_truth_mode: 'source_adaptation',
  },
]

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

async function runSmoke(workspaceRoot: string, seed: SmokeSeed = DEFAULT_SEED) {
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
    outline: seed.outline,
    series_title: seed.series_title,
    episode_count: seed.episode_count,
    episode_duration_range_sec: seed.duration_range_sec,
    pacing_profile: seed.pacing_profile,
  }), 'series plan')

  const initialProject = requireData(
    await saveAiComicSeriesProject({ plan }),
    'initial series project save',
  )
  const seriesProjectId = initialProject.project.series_project_id
  const generatedEpisodeStoryIds: Record<string, string> = {}
  const truthModes = new Set<TruthMode>()
  const generationEngines = new Set<string>()
  for (let episodeNo = 1; episodeNo <= seed.episode_count; episodeNo += 1) {
    const episode = requireData(await generateAiComicEpisodeFromPlan({
      series_plan: plan,
      episode_no: episodeNo,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
      auto_audit_continuity: true,
    }), `episode ${episodeNo} generation`)
    generatedEpisodeStoryIds[String(episodeNo)] = episode.storyId
    if (episode.truth_mode) truthModes.add(episode.truth_mode)
    if (episode.effective_engine) generationEngines.add(episode.effective_engine)
  }
  if (truthModes.size !== 1 || !truthModes.has(seed.expected_truth_mode)) {
    throw new Error(
      `seed ${seed.seed_id} truth mode expected ${seed.expected_truth_mode}, received ${[...truthModes].join(', ') || 'missing'}`,
    )
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
  if (
    promptPackage.generated_episode_count !== seed.episode_count
    || promptPackage.total_shot_count <= 0
  ) {
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
          outputUrl: `https://synthetic.invalid/story-agent/${seed.seed_id}/shot-${index + 2}.mp4`,
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
    videoUrl: `https://synthetic.invalid/story-agent/${seed.seed_id}/shot-retry.mp4`,
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
      seed_id: seed.seed_id,
      title: plan.series_title,
      planned_episode_count: plan.episode_count,
      generated_episode_count: Object.keys(generatedEpisodeStoryIds).length,
      shot_count: promptPackage.total_shot_count,
      pacing_profile: plan.pacing_profile,
      expected_truth_mode: seed.expected_truth_mode,
      actual_truth_modes: [...truthModes],
      generation_engines: [...generationEngines],
      series_quality_score: finalProject.series_quality_audit?.score,
      series_quality_passed: finalProject.series_quality_audit?.passed,
      series_quality_issues: finalProject.series_quality_audit?.issues ?? [],
      thread_closure_attention: finalProject.series_quality_audit?.thread_closure_report?.items
        .filter(item => item.issues.length > 0)
        .map(item => ({
          thread_id: item.thread_id,
          title: item.title,
          status: item.status,
          related_episode_nos: item.related_episodes,
          issues: item.issues,
        })) ?? [],
      blocking_memory_conflicts: finalProject.series_quality_audit?.memory_conflict_report?.items
        .filter(item => item.severity === 'blocking')
        .map(item => ({
          category: item.category,
          title: item.title,
          description: item.description,
          related_episode_nos: item.related_episode_nos,
          evidence: item.evidence,
        })) ?? [],
      premise_fidelity_passed: finalProject.premise_fidelity_audit?.hard_gate_passed,
      premise_fidelity_score: finalProject.premise_fidelity_audit?.premise_coverage_score,
      premise_fidelity_issues: finalProject.premise_fidelity_audit?.issues ?? [],
      commercial_machine_gate_passed: finalProject.commercial_quality_audit?.machine_gate_passed,
      commercial_quality_issues: finalProject.commercial_quality_audit?.issues ?? [],
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

async function runMatrix(workspaceRoot: string) {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  const reports: Awaited<ReturnType<typeof runSmoke>>[] = []
  for (const seed of MATRIX_SEEDS) {
    const seedWorkspaceRoot = resolve(workspaceRoot, seed.seed_id)
    await mkdir(seedWorkspaceRoot, { recursive: true })
    reports.push(await runSmoke(seedWorkspaceRoot, seed))
  }
  const totalEpisodeCount = reports.reduce(
    (sum, item) => sum + item.series.generated_episode_count,
    0,
  )
  const totalShotCount = reports.reduce((sum, item) => sum + item.series.shot_count, 0)
  const totalRetryJobCount = reports.reduce((sum, item) => sum + item.gears.retry_job_count, 0)
  const totalTitleCardCount = reports.reduce(
    (sum, item) => sum + (item.stages.title_card_render.artifact_count ?? 0),
    0,
  )
  const invariants = {
    every_seed_completed: reports.length === MATRIX_SEEDS.length,
    every_truth_mode_matched: reports.every(item =>
      item.series.actual_truth_modes.length === 1
      && item.series.actual_truth_modes[0] === item.series.expected_truth_mode
    ),
    every_series_quality_passed: reports.every(item =>
      item.series.series_quality_passed === true
    ),
    every_premise_fidelity_passed: reports.every(item =>
      item.series.premise_fidelity_passed === true
    ),
    every_commercial_machine_gate_passed: reports.every(item =>
      item.series.commercial_machine_gate_passed === true
    ),
    every_shot_ready: reports.every(item =>
      item.gears.ready_shot_count === item.series.shot_count
    ),
    every_retry_recovered: reports.every(item =>
      item.gears.synthetic_failure_count === 1
      && item.gears.retry_job_count === 1
      && item.gears.callback_import_failure_count === 0
    ),
    every_post_stage_ready: reports.every(item =>
      ['cut_assembly', 'subtitle_render', 'audio_mix', 'title_card_render', 'final_delivery']
        .every(stage => item.stages[stage]?.status === 'ready')
    ),
    every_release_immutable: reports.every(item => item.release.immutable),
  }
  const failedInvariants = Object.entries(invariants)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
  return {
    schema_version: 'story-agent-cross-seed-stability-smoke/v1',
    status: failedInvariants.length === 0 ? 'passed' : 'failed',
    mode: 'isolated_synthetic_artifacts',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    external_provider_called: false,
    external_authorization_used: false,
    human_review_required: false,
    formal_project_contaminated: false,
    coverage: {
      seed_count: reports.length,
      pacing_profile_count: new Set(reports.map(item => item.series.pacing_profile)).size,
      pacing_profiles: [...new Set(reports.map(item => item.series.pacing_profile))],
      expected_truth_mode_count: new Set(reports.map(item => item.series.expected_truth_mode)).size,
      truth_modes: [...new Set(reports.flatMap(item => item.series.actual_truth_modes))],
      total_episode_count: totalEpisodeCount,
      total_shot_count: totalShotCount,
      total_retry_job_count: totalRetryJobCount,
      total_title_card_count: totalTitleCardCount,
      immutable_release_count: reports.filter(item => item.release.immutable).length,
    },
    invariants,
    failed_invariants: failedInvariants,
    seeds: reports.map(item => ({
      seed_id: item.series.seed_id,
      title: item.series.title,
      pacing_profile: item.series.pacing_profile,
      expected_truth_mode: item.series.expected_truth_mode,
      actual_truth_modes: item.series.actual_truth_modes,
      generation_engines: item.series.generation_engines,
      episode_count: item.series.generated_episode_count,
      shot_count: item.series.shot_count,
      ready_shot_count: item.gears.ready_shot_count,
      retry_job_count: item.gears.retry_job_count,
      title_card_count: item.stages.title_card_render.artifact_count ?? 0,
      series_quality_score: item.series.series_quality_score,
      series_quality_passed: item.series.series_quality_passed,
      series_quality_issues: item.series.series_quality_issues,
      thread_closure_attention: item.series.thread_closure_attention,
      blocking_memory_conflicts: item.series.blocking_memory_conflicts,
      premise_fidelity_passed: item.series.premise_fidelity_passed,
      premise_fidelity_score: item.series.premise_fidelity_score,
      premise_fidelity_issues: item.series.premise_fidelity_issues,
      commercial_machine_gate_passed: item.series.commercial_machine_gate_passed,
      commercial_quality_issues: item.series.commercial_quality_issues,
      final_delivery_status: item.stages.final_delivery.status,
      release_immutable: item.release.immutable,
      output_sha256: item.release.output_sha256,
      manifest_sha256: item.release.manifest_sha256,
    })),
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
const matrixMode = process.argv.slice(2).includes('--matrix')
let report:
  | Awaited<ReturnType<typeof runSmoke>>
  | Awaited<ReturnType<typeof runMatrix>>
  | undefined
let failureReason: string | undefined
let cleanupRemoved = false
try {
  report = matrixMode
    ? await runMatrix(workspaceRoot)
    : await runSmoke(workspaceRoot)
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
  if (report.status !== 'passed') process.exitCode = 1
} else {
  console.log(JSON.stringify({
    schema_version: matrixMode
      ? 'story-agent-cross-seed-stability-smoke/v1'
      : 'story-agent-isolated-full-function-smoke/v1',
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
