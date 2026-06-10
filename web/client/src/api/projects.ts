import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type {
  KnowledgeSupplementTaskUpdateRequest,
  StoryProjectDeleteResult,
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

export function deleteProject(projectId: string) {
  return apiDelete<StoryProjectDeleteResult>(`/projects/${projectId}`)
}

export function updateProjectSupplementTask(projectId: string, taskId: string, body: KnowledgeSupplementTaskUpdateRequest) {
  return apiPatch<StoryProjectDetail>(`/projects/${projectId}/supplement-tasks/${encodeURIComponent(taskId)}`, body)
}
