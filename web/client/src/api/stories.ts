import { apiGet, apiPost } from './client'
import type {
  StoryPlanResult,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryListItem,
  GearsSegmentsResponse,
} from '@shared/types'

export function storyPlan(entryName: string) {
  return apiPost<StoryPlanResult>('/stories/plan', { entry_name: entryName })
}

export function storyGenerate(req: StoryGenerateRequest) {
  return apiPost<StoryGenerateResult>('/stories/generate', req)
}

export function listStories(generationType?: string) {
  const qs: Record<string, string> | undefined = generationType
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