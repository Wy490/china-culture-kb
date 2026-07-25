import { apiGet, apiPost } from './client'
import type {
  StoryAgentImageGenerationResult,
  StoryAgentRun,
  StoryAgentRunExportResponse,
  StoryAgentRunImageImportResponse,
  StoryAgentRunListQuery,
  StoryAgentRunListResponse,
} from '@shared/types'

export function listStoryAgentRuns(query: Partial<StoryAgentRunListQuery> = {}) {
  const params: Record<string, string> = {}
  if (query.limit) params.limit = String(query.limit)
  if (query.cursor) params.cursor = query.cursor
  if (query.status) params.status = query.status
  if (query.kind) params.kind = query.kind
  if (query.source_kind) params.source_kind = query.source_kind
  return apiGet<StoryAgentRunListResponse>('/story-agent/runs', params)
}

export function getStoryAgentRun(runId: string) {
  return apiGet<StoryAgentRun>(`/story-agent/runs/${encodeURIComponent(runId)}`)
}

export function resumeStoryAgentRun(runId: string) {
  return apiPost<StoryAgentRun>(`/story-agent/runs/${encodeURIComponent(runId)}/resume`, {})
}

export function importStoryAgentRunImageResult(
  runId: string,
  result: StoryAgentImageGenerationResult,
) {
  return apiPost<StoryAgentRunImageImportResponse>(
    `/story-agent/runs/${encodeURIComponent(runId)}/import-images`,
    result,
  )
}

export function exportStoryAgentRun(runId: string) {
  return apiGet<StoryAgentRunExportResponse>(
    `/story-agent/runs/${encodeURIComponent(runId)}/export`,
  )
}
