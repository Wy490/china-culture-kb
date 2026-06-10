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
