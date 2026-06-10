import { apiGet, apiPost } from './client'
import type {
  StoryProjectDetail,
  StoryProjectListItem,
  StorySceneRegenerateRequest,
} from '@shared/types'

export function listProjects() {
  return apiGet<StoryProjectListItem[]>('/projects')
}

export function getProject(projectId: string) {
  return apiGet<StoryProjectDetail>(`/projects/${projectId}`)
}

export function regenerateProjectScene(projectId: string, body: StorySceneRegenerateRequest) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/regenerate-scene`, body)
}
