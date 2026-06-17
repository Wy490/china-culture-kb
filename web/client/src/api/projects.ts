import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type {
  KnowledgeSupplementTaskUpdateRequest,
  StoryProjectBatchDeleteResult,
  ProjectSupplementTaskListItem,
  StoryProjectDeleteResult,
  StoryProjectDetail,
  StoryProjectExportPackage,
  StoryProjectListItem,
  StoryProjectRetainRecentResult,
  SeedanceAssetLibraryUpdateRequest,
  StoryProductionBoard,
  StoryProductionBoardExportPackage,
  StoryProductionBoardRepairExportResult,
  StoryProductionBoardRepairRequest,
  StoryProductionBoardRepairResult,
  StorySceneRegenerateRequest,
  StoryQualityRepairRequest,
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

export function repairProjectQuality(projectId: string, body: StoryQualityRepairRequest = {}) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/repair-quality`, body)
}

export function exportProjectCurrentVersion(projectId: string) {
  return apiPost<StoryProjectExportPackage>(`/projects/${projectId}/export`, {})
}

export function getProjectProductionBoard(projectId: string) {
  return apiGet<StoryProductionBoard>(`/projects/${projectId}/production-board`)
}

export function exportProjectProductionBoard(projectId: string) {
  return apiPost<StoryProductionBoardExportPackage>(`/projects/${projectId}/production-board/export`, {})
}

export function updateProjectSeedanceAssetLibrary(projectId: string, body: SeedanceAssetLibraryUpdateRequest) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/production-board/seedance-assets`, body)
}

export function repairProjectProductionBoard(projectId: string, body: StoryProductionBoardRepairRequest = {}) {
  return apiPost<StoryProductionBoardRepairResult>(`/projects/${projectId}/production-board/repair`, body)
}

export function repairAndExportProjectProductionBoard(projectId: string, body: StoryProductionBoardRepairRequest = {}) {
  return apiPost<StoryProductionBoardRepairExportResult>(`/projects/${projectId}/production-board/repair-export`, body)
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
