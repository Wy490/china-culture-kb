import { apiGet, apiPatch, apiPost } from './client'
import type {
  StoryPlanResult,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryListItem,
  GearsSegmentsResponse,
  GearsDeliveryPackage,
  VideoType,
  StoryOutlineAnalyzeRequest,
  StoryOutlineAnalysis,
  AiComicEpisodeContextPreview,
  AiComicEpisodeContextPreviewRequest,
  AiComicEpisodeGenerateRequest,
  AiComicSeriesBibleExportPackage,
  AiComicSeriesLedgerRebuildRequest,
  AiComicSeriesProjectDetail,
  AiComicSeriesProjectMeta,
  AiComicSeriesProjectSaveRequest,
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

export function listStories(generationType?: string, videoType?: VideoType) {
  const qs: Record<string, string> | undefined = videoType
    ? { video_type: videoType }
    : generationType
      ? { generation_type: generationType }
      : undefined
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

export function listAiComicSeriesProjects() {
  return apiGet<AiComicSeriesProjectMeta[]>('/story-outline/ai-comic-series-projects')
}

export function getAiComicSeriesProject(seriesProjectId: string) {
  return apiGet<AiComicSeriesProjectDetail>(`/story-outline/ai-comic-series-projects/${seriesProjectId}`)
}

export function saveAiComicSeriesProject(req: AiComicSeriesProjectSaveRequest) {
  return apiPost<AiComicSeriesProjectDetail>('/story-outline/ai-comic-series-projects', req)
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
