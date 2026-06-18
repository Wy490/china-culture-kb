import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from './client'
import type {
  KnowledgeSupplementTaskUpdateRequest,
  StoryProjectBatchDeleteResult,
  ProjectSupplementTaskListItem,
  StoryProjectDeleteResult,
  StoryProjectDetail,
  StoryProjectExportPackage,
  StoryProjectListItem,
  StoryProjectRetainRecentResult,
  SeedanceAssetBatchImportRequest,
  SeedanceAssetBatchImportResult,
  SeedanceAssetFileUploadResult,
  SeedanceAssetReuseRequest,
  SeedanceAssetReuseResult,
  SeedanceGlobalAssetLibrary,
  SeedanceAssetLibraryUpdateRequest,
  SeedanceShotAutoSelectRequest,
  SeedanceShotCallbackImportRequest,
  SeedanceShotCallbackImportResult,
  SeedanceShotProviderRecoveryRequest,
  SeedanceShotProviderRecoveryResult,
  SeedanceShotProviderSubmitRequest,
  SeedanceShotProviderSubmitResult,
  SeedanceShotRetryPackage,
  SeedanceShotStatusBatchUpdateRequest,
  SeedanceShotStatusBatchUpdateResult,
  SeedanceShotStatusUpdateRequest,
  SeedanceShotVersionSelectRequest,
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

export function importProjectSeedanceAssetBatch(projectId: string, body: SeedanceAssetBatchImportRequest) {
  return apiPost<SeedanceAssetBatchImportResult>(`/projects/${projectId}/production-board/seedance-assets/import`, body)
}

export function uploadProjectSeedanceAssetFile(projectId: string, body: FormData) {
  return apiPostForm<SeedanceAssetFileUploadResult>(`/projects/${projectId}/production-board/seedance-assets/upload`, body)
}

export function getProjectSeedanceGlobalAssetLibrary(projectId: string) {
  return apiGet<SeedanceGlobalAssetLibrary>(`/projects/${projectId}/production-board/seedance-assets/global`)
}

export function reuseProjectSeedanceAsset(projectId: string, body: SeedanceAssetReuseRequest) {
  return apiPost<SeedanceAssetReuseResult>(`/projects/${projectId}/production-board/seedance-assets/reuse`, body)
}

export function updateProjectSeedanceShotStatus(projectId: string, body: SeedanceShotStatusUpdateRequest) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/production-board/seedance-shots`, body)
}

export function updateProjectSeedanceShotStatuses(projectId: string, body: SeedanceShotStatusBatchUpdateRequest) {
  return apiPost<SeedanceShotStatusBatchUpdateResult>(`/projects/${projectId}/production-board/seedance-shots/batch`, body)
}

export function importProjectSeedanceShotCallbacks(projectId: string, body: SeedanceShotCallbackImportRequest) {
  return apiPost<SeedanceShotCallbackImportResult>(`/projects/${projectId}/production-board/seedance-shots/import`, body)
}

export function selectProjectSeedanceShotVersion(projectId: string, body: SeedanceShotVersionSelectRequest) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/production-board/seedance-shots/select-version`, body)
}

export function autoSelectProjectSeedanceShotVersions(projectId: string, body: SeedanceShotAutoSelectRequest = {}) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/production-board/seedance-shots/auto-select`, body)
}

export function submitProjectSeedanceShotsToProvider(projectId: string, body: SeedanceShotProviderSubmitRequest = {}) {
  return apiPost<SeedanceShotProviderSubmitResult>(`/projects/${projectId}/production-board/seedance-shots/submit-provider`, body)
}

export function recoverProjectSeedanceProviderQueue(projectId: string, body: SeedanceShotProviderRecoveryRequest = {}) {
  return apiPost<SeedanceShotProviderRecoveryResult>(`/projects/${projectId}/production-board/seedance-shots/recover-provider`, body)
}

export function exportProjectSeedanceRetryPackage(projectId: string) {
  return apiPost<SeedanceShotRetryPackage>(`/projects/${projectId}/production-board/export-seedance-retry-package`, {})
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
