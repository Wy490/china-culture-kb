import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type {
  KnowledgeSupplementTaskUpdateRequest,
  ProjectSupplementTaskListItem,
  StoryProjectDeleteResult,
  StoryProjectDetail,
  StoryProjectListItem,
  StorySceneRegenerateRequest,
} from '@shared/types'

export function listProjects() {
  return apiGet<StoryProjectListItem[]>('/projects')
}

export function listSupplementTasks(status?: 'open' | 'resolved') {
  return apiGet<ProjectSupplementTaskListItem[]>('/projects/supplement-tasks', status ? { status } : undefined)
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
