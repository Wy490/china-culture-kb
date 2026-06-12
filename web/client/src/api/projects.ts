import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type {
  KnowledgeSupplementTaskUpdateRequest,
  StoryProjectBatchDeleteResult,
  ProjectSupplementTaskListItem,
  StoryProjectDeleteResult,
  StoryProjectDetail,
  StoryProjectListItem,
  StoryProjectRetainRecentResult,
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

export function deleteProjects(projectIds: string[]) {
  return apiPost<StoryProjectBatchDeleteResult>('/projects/batch-delete', { project_ids: projectIds })
}

export function retainRecentProjects(keepRecent: number) {
  return apiPost<StoryProjectRetainRecentResult>('/projects/retain-recent', { keep_recent: keepRecent })
}

export function updateProjectSupplementTask(projectId: string, taskId: string, body: KnowledgeSupplementTaskUpdateRequest) {
  return apiPatch<StoryProjectDetail>(`/projects/${projectId}/supplement-tasks/${encodeURIComponent(taskId)}`, body)
}
