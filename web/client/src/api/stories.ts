import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type {
  StoryPlanResult,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryListItem,
  GearsJobCallbackRequest,
  GearsJobStatusSyncRequest,
  GearsJobSubmitRequest,
  GearsSegmentsResponse,
  GearsDeliveryPackage,
  ProductionReadinessAutomationRunRequest,
  ProductionReadinessAutomationRunResult,
  AiComicSeriesGearsJobCallbackResult,
  AiComicSeriesGearsJobStatusSyncResult,
  AiComicSeriesGearsJobSubmitResult,
  SeedancePromptPackage,
  VideoType,
  StoryOutlineAnalyzeRequest,
  StoryOutlineAnalysis,
  AiComicEpisodeContextPreview,
  AiComicEpisodeContextPreviewRequest,
  AiComicEpisodeGenerateRequest,
  AiComicSeriesBibleExportPackage,
  AiComicSeriesLedgerRebuildRequest,
  AiComicSeriesProductionReadinessReport,
  AiComicSeriesProjectArchiveRequest,
  AiComicSeriesProjectCopyRequest,
  AiComicSeriesProjectDeleteResult,
  AiComicSeriesProjectDetail,
  AiComicSeriesProjectMeta,
  AiComicSeriesProjectSaveRequest,
  AiComicSeedanceAssetLibraryUpdateRequest,
  AiComicSeedanceCutAssemblyRequest,
  AiComicSeriesSeedanceAssetReportPackage,
  AiComicSeriesSeedanceAudioMixResult,
  AiComicSeriesSeedanceAudioPlanPackage,
  AiComicSeriesSeedanceCutAssemblyResult,
  AiComicSeriesSeedanceCutPackage,
  AiComicSeriesSeedanceDashboard,
  AiComicSeriesSeedanceEditAssetPackage,
  AiComicSeriesSeedanceEditingPlatformPackage,
  AiComicSeriesSeedanceFinalDeliveryResult,
  AiComicSeriesSeedanceExportPackage,
  AiComicSeriesSeedanceFinishingPlanPackage,
  AiComicSeriesSeedanceRetryExecutionPlan,
  AiComicSeriesSeedanceRetryPackage,
  AiComicSeriesSeedanceRetrySubmitResult,
  AiComicSeriesSeedanceReviewRepairPackage,
  AiComicSeriesSeedanceReviewUpdateResult,
  AiComicSeriesSeedanceProviderRecoveryResult,
  AiComicSeriesSeedanceSubtitlePackage,
  AiComicSeriesSeedanceSubtitleRenderResult,
  AiComicSeriesSeedanceThumbnailPlanPackage,
  AiComicSeriesSeedanceThumbnailCaptureResult,
  AiComicSeriesSeedanceTitleCardPlanPackage,
  AiComicSeriesSeedanceTitleCardRenderResult,
  AiComicSeriesSeedanceVersionComparisonPackage,
  AiComicSeedanceProductionAutoSelectRequest,
  AiComicSeedanceAudioLibraryUpdateRequest,
  AiComicSeedanceAudioMixRequest,
  AiComicSeedanceFinalDeliveryRequest,
  AiComicSeedanceProductionBatchUpdateRequest,
  AiComicSeedanceProductionCallbackRequest,
  AiComicSeedanceProductionStatusUpdateRequest,
  AiComicSeedanceProductionVersionSelectRequest,
  AiComicSeedanceProviderRecoveryRequest,
  AiComicSeedanceReviewAddRequest,
  AiComicSeedanceReviewResolveRequest,
  AiComicSeedanceRetrySubmitRequest,
  AiComicSeedanceSubtitleExportRequest,
  AiComicSeedanceSubtitleRenderRequest,
  AiComicSeedanceThumbnailCaptureRequest,
  AiComicSeedanceTitleCardRenderRequest,
  AiComicSeriesPlanRequest,
  AiComicSeriesPlan,
} from '@shared/types'

export function storyPlan(entryName: string, originalUserQuery?: string) {
  return apiPost<StoryPlanResult>('/stories/plan', {
    entry_name: entryName,
    original_user_query: originalUserQuery,
  })
}

export function storyGenerate(req: StoryGenerateRequest) {
  return apiPost<StoryGenerateResult>('/stories/generate', req)
}

export function listStories(generationType?: string, videoType?: VideoType, sourceDomain?: string) {
  const qs: Record<string, string> = {}
  if (videoType) qs.video_type = videoType
  else if (generationType) qs.generation_type = generationType
  if (sourceDomain) qs.domain = sourceDomain
  return apiGet<StoryListItem[]>('/stories', qs)
}

export function getStory(storyId: string) {
  return apiGet<StoryGenerateResult>(`/stories/${storyId}`)
}

export function getGearsSegments(storyId: string) {
  return apiGet<GearsSegmentsResponse>(`/stories/${storyId}/gears-segments`)
}

export function getGearsDeliveryPackage(storyId: string) {
  return apiGet<GearsDeliveryPackage>(`/stories/${storyId}/gears-delivery`)
}

export function getSeedancePromptPackage(storyId: string) {
  return apiGet<SeedancePromptPackage>(`/stories/${storyId}/seedance-prompts`)
}

export function updateGearsDeliveryMarkdown(storyId: string, markdown: string) {
  return apiPatch<GearsDeliveryPackage>(`/stories/${storyId}/gears-delivery`, { markdown })
}

// New: Story outline analysis
export function storyOutlineAnalyze(req: StoryOutlineAnalyzeRequest) {
  return apiPost<StoryOutlineAnalysis>('/story-outline/analyze', req)
}

export function aiComicSeriesPlan(req: AiComicSeriesPlanRequest) {
  return apiPost<AiComicSeriesPlan>('/story-outline/ai-comic-series-plan', req)
}

export function aiComicEpisodeGenerate(req: AiComicEpisodeGenerateRequest) {
  return apiPost<StoryGenerateResult>('/story-outline/ai-comic-episode', req)
}

export function aiComicEpisodeContextPreview(req: AiComicEpisodeContextPreviewRequest) {
  return apiPost<AiComicEpisodeContextPreview>('/story-outline/ai-comic-episode-context-preview', req)
}

export function listAiComicSeriesProjects(includeArchived = false) {
  return apiGet<AiComicSeriesProjectMeta[]>(
    '/story-outline/ai-comic-series-projects',
    includeArchived ? { include_archived: '1' } : undefined,
  )
}

export function getAiComicSeriesProject(seriesProjectId: string) {
  return apiGet<AiComicSeriesProjectDetail>(`/story-outline/ai-comic-series-projects/${seriesProjectId}`)
}

export function getAiComicSeriesProductionReadiness(seriesProjectId: string) {
  return apiGet<AiComicSeriesProductionReadinessReport>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/production-readiness`,
  )
}

export function runAiComicSeriesProductionReadinessAutomation(
  seriesProjectId: string,
  req: ProductionReadinessAutomationRunRequest = { dry_run: false },
) {
  return apiPost<ProductionReadinessAutomationRunResult<AiComicSeriesProductionReadinessReport>>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/production-readiness/run-automation`,
    req,
  )
}

export function saveAiComicSeriesProject(req: AiComicSeriesProjectSaveRequest) {
  return apiPost<AiComicSeriesProjectDetail>('/story-outline/ai-comic-series-projects', req)
}

export function copyAiComicSeriesProject(seriesProjectId: string, req: AiComicSeriesProjectCopyRequest = {}) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/copy`,
    req,
  )
}

export function archiveAiComicSeriesProject(seriesProjectId: string, req: AiComicSeriesProjectArchiveRequest = {}) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/archive`,
    req,
  )
}

export function deleteAiComicSeriesProject(seriesProjectId: string) {
  return apiDelete<AiComicSeriesProjectDeleteResult>(`/story-outline/ai-comic-series-projects/${seriesProjectId}`)
}

export function rebuildAiComicSeriesLedger(seriesProjectId: string, req: AiComicSeriesLedgerRebuildRequest) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/rebuild-ledger`,
    req,
  )
}

export function exportAiComicSeriesBible(seriesProjectId: string) {
  return apiPost<AiComicSeriesBibleExportPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-bible`,
    {},
  )
}

export function exportAiComicSeriesSeedancePrompts(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceExportPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-prompts`,
    {},
  )
}

export function exportAiComicSeriesSeedanceCutPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceCutPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-cut-package`,
    {},
  )
}

export function assembleAiComicSeriesSeedanceCut(
  seriesProjectId: string,
  req: AiComicSeedanceCutAssemblyRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceCutAssemblyResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-cut/assemble`,
    req,
  )
}

export function exportAiComicSeriesSeedanceRetryPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceRetryPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-retry-package`,
    {},
  )
}

export function exportAiComicSeriesSeedanceRetryExecutionPlan(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceRetryExecutionPlan>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-retry-execution-plan`,
    {},
  )
}

export function submitAiComicSeriesSeedanceRetryExecutionPlan(
  seriesProjectId: string,
  req: AiComicSeedanceRetrySubmitRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceRetrySubmitResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-retry/submit`,
    req,
  )
}

export function submitAiComicSeriesGearsJobs(
  seriesProjectId: string,
  req: GearsJobSubmitRequest = {},
) {
  return apiPost<AiComicSeriesGearsJobSubmitResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/gears-jobs/submit`,
    req,
  )
}

export function syncAiComicSeriesGearsJobs(
  seriesProjectId: string,
  req: GearsJobStatusSyncRequest = {},
) {
  return apiPost<AiComicSeriesGearsJobStatusSyncResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/gears-jobs/sync`,
    req,
  )
}

export function importAiComicSeriesGearsCallback(
  seriesProjectId: string,
  req: GearsJobCallbackRequest,
) {
  return apiPost<AiComicSeriesGearsJobCallbackResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/gears-callback`,
    req,
  )
}

export function recoverAiComicSeriesSeedanceProviderTimeouts(
  seriesProjectId: string,
  req: AiComicSeedanceProviderRecoveryRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceProviderRecoveryResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-provider/recover-timeouts`,
    req,
  )
}

export function exportAiComicSeriesSeedanceVersionComparisonPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceVersionComparisonPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-version-comparison`,
    {},
  )
}

export function exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceAssetReportPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-asset-report`,
    {},
  )
}

export function exportAiComicSeriesSeedanceEditAssetPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceEditAssetPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-edit-asset-package`,
    {},
  )
}

export function exportAiComicSeriesSeedanceThumbnailPlanPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceThumbnailPlanPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-thumbnail-plan`,
    {},
  )
}

export function exportAiComicSeriesSeedanceFinishingPlanPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceFinishingPlanPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-finishing-plan`,
    {},
  )
}

export function exportAiComicSeriesSeedanceSubtitlePackage(
  seriesProjectId: string,
  req: AiComicSeedanceSubtitleExportRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceSubtitlePackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-subtitles`,
    req,
  )
}

export function renderAiComicSeriesSeedanceSubtitles(
  seriesProjectId: string,
  req: AiComicSeedanceSubtitleRenderRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceSubtitleRenderResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-subtitles/render`,
    req,
  )
}

export function exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceAudioPlanPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-audio-plan`,
    {},
  )
}

export function mixAiComicSeriesSeedanceAudio(
  seriesProjectId: string,
  req: AiComicSeedanceAudioMixRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceAudioMixResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-audio/mix`,
    req,
  )
}

export function exportAiComicSeriesSeedanceTitleCardPlanPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceTitleCardPlanPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-title-card-plan`,
    {},
  )
}

export function exportAiComicSeriesSeedanceEditingPlatformPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceEditingPlatformPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-editing-platform-package`,
    {},
  )
}

export function getAiComicSeriesSeedanceProductionDashboard(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceDashboard>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-production-dashboard`,
    {},
  )
}

export function renderAiComicSeriesSeedanceTitleCards(
  seriesProjectId: string,
  req: AiComicSeedanceTitleCardRenderRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceTitleCardRenderResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-title-cards/render`,
    req,
  )
}

export function assembleAiComicSeriesSeedanceFinalDelivery(
  seriesProjectId: string,
  req: AiComicSeedanceFinalDeliveryRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceFinalDeliveryResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-final/assemble`,
    req,
  )
}

export function addAiComicSeriesSeedanceReview(
  seriesProjectId: string,
  req: AiComicSeedanceReviewAddRequest,
) {
  return apiPost<AiComicSeriesSeedanceReviewUpdateResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-reviews`,
    req,
  )
}

export function resolveAiComicSeriesSeedanceReview(
  seriesProjectId: string,
  req: AiComicSeedanceReviewResolveRequest,
) {
  return apiPost<AiComicSeriesSeedanceReviewUpdateResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-reviews/resolve`,
    req,
  )
}

export function exportAiComicSeriesSeedanceReviewRepairPackage(seriesProjectId: string) {
  return apiPost<AiComicSeriesSeedanceReviewRepairPackage>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-review-repair-package`,
    {},
  )
}

export function captureAiComicSeriesSeedanceThumbnails(
  seriesProjectId: string,
  req: AiComicSeedanceThumbnailCaptureRequest = {},
) {
  return apiPost<AiComicSeriesSeedanceThumbnailCaptureResult>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-thumbnails/capture`,
    req,
  )
}

export function updateAiComicSeriesSeedanceAssetLibrary(
  seriesProjectId: string,
  req: AiComicSeedanceAssetLibraryUpdateRequest,
) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-asset-library`,
    req,
  )
}

export function updateAiComicSeriesSeedanceAudioLibrary(
  seriesProjectId: string,
  req: AiComicSeedanceAudioLibraryUpdateRequest,
) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-audio-library`,
    req,
  )
}

export function updateAiComicSeriesSeedanceProductionStatus(
  seriesProjectId: string,
  req: AiComicSeedanceProductionStatusUpdateRequest,
) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-production-status`,
    req,
  )
}

export function updateAiComicSeriesSeedanceProductionStatuses(
  seriesProjectId: string,
  req: AiComicSeedanceProductionBatchUpdateRequest,
) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-production-status/batch`,
    req,
  )
}

export function applyAiComicSeriesSeedanceProductionCallback(
  seriesProjectId: string,
  req: AiComicSeedanceProductionCallbackRequest,
) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-production-callback`,
    req,
  )
}

export function selectAiComicSeriesSeedanceProductionVersion(
  seriesProjectId: string,
  req: AiComicSeedanceProductionVersionSelectRequest,
) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-production-version`,
    req,
  )
}

export function autoSelectAiComicSeriesSeedanceProductionVersions(
  seriesProjectId: string,
  req: AiComicSeedanceProductionAutoSelectRequest = {},
) {
  return apiPost<AiComicSeriesProjectDetail>(
    `/story-outline/ai-comic-series-projects/${seriesProjectId}/seedance-production-version/auto`,
    req,
  )
}
