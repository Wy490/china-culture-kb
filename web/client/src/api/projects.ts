import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from './client'
import type {
  KnowledgeSupplementTaskUpdateRequest,
  GearsJobCallbackRequest,
  GearsJobCallbackResult,
  GearsExternalCallbackHandoffPackage,
  GearsExternalCallbackImportResult,
  GearsExternalCallbackPreflightResult,
  GearsJobLocalAcceptanceRequest,
  GearsJobLocalAcceptanceResult,
  GearsJobStatusSyncRequest,
  GearsJobStatusSyncResult,
  GearsJobSubmitRequest,
  GearsJobSubmitResult,
  GearsWorkbenchImportResult,
  GearsWorkbenchImportAuditLedger,
  GearsWorkbenchProjectImportRequest,
  StoryProjectBatchDeleteResult,
  ProjectMaterialPackAddMaterialRequest,
  ProjectDraftProductionMaterialFieldsResult,
  ProjectSeedanceAssetPlaceholderResult,
  ProjectSupplementTaskListItem,
  ProjectSupplementTaskListFilters,
  StoryProjectDeleteResult,
  StoryProjectDetail,
  StoryProjectExportPackage,
  ProjectKnowledgeCandidateExportPackage,
  ProjectKnowledgeWritebackPatchPackage,
  ProjectSupplementCandidateExportPackage,
  StoryProjectListItem,
  ProductionReadinessAutomationRunRequest,
  ProductionReadinessAutomationRunResult,
  StoryProjectProductionReadinessReport,
  StoryProjectRetainRecentResult,
  SeedanceAssetBatchImportRequest,
  SeedanceAssetBatchImportResult,
  SeedanceAssetFileUploadResult,
  MediaAssetReviewUpdateRequest,
  MediaAssetReviewUpdateResult,
  SeedanceAssetReuseRequest,
  SeedanceAssetReuseResult,
  SeedanceGlobalAssetLibrary,
  SeedanceAssetLibraryUpdateRequest,
  SeedanceShotAutoSelectRequest,
  SeedanceShotCallbackImportRequest,
  SeedanceShotCallbackImportResult,
  SeedanceShotProviderCallbackRequest,
  SeedanceShotProviderCallbackResult,
  SeedanceShotProviderPollRequest,
  SeedanceShotProviderPollResult,
  SeedanceShotProviderQueueOverviewRequest,
  SeedanceShotProviderQueueOverviewResult,
  SeedanceShotProviderRetryPlanRequest,
  SeedanceShotProviderRetryPlanResult,
  SeedanceShotProviderRetrySubmitRequest,
  SeedanceShotProviderRetrySubmitResult,
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
  StoryQualityRepairApplyRequest,
  StoryQualityRepairApplyResult,
  StoryQualityRepairPromptRequest,
  StoryQualityRepairPromptResult,
  StoryQualityRepairRequest,
} from '@shared/types'

export function listProjects(sourceDomain?: string) {
  return apiGet<StoryProjectListItem[]>('/projects', sourceDomain ? { domain: sourceDomain } : undefined)
}

export function listSupplementTasks(filters: ProjectSupplementTaskListFilters = {}) {
  const query = Object.fromEntries(
    Object.entries(filters).flatMap(([key, value]) => {
      if (typeof value === 'string' && value.length > 0) return [[key, value]];
      if (typeof value === 'boolean') return [[key, value ? '1' : '0']];
      return [];
    }),
  )
  return apiGet<ProjectSupplementTaskListItem[]>('/projects/supplement-tasks', query)
}

export function getProject(projectId: string) {
  return apiGet<StoryProjectDetail>(`/projects/${projectId}`)
}

export function dryRunProjectGearsWorkbenchImport(
  projectId: string,
  body: GearsWorkbenchProjectImportRequest,
) {
  return apiPost<GearsWorkbenchImportResult>(`/projects/${projectId}/gears-workbench-import/dry-run`, body)
}

export function executeProjectGearsWorkbenchImport(
  projectId: string,
  body: GearsWorkbenchProjectImportRequest,
) {
  return apiPost<GearsWorkbenchImportResult>(`/projects/${projectId}/gears-workbench-import`, body)
}

export function getProjectGearsWorkbenchImportAudit(projectId: string) {
  return apiGet<GearsWorkbenchImportAuditLedger>(`/projects/${projectId}/gears-workbench-import-audit`)
}

export function regenerateProjectScene(projectId: string, body: StorySceneRegenerateRequest) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/regenerate-scene`, body)
}

export function repairProjectQuality(projectId: string, body: StoryQualityRepairRequest = {}) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/repair-quality`, body)
}

export function generateProjectQualityRepairPrompt(
  projectId: string,
  body: StoryQualityRepairPromptRequest = {},
) {
  return apiPost<StoryQualityRepairPromptResult>(`/projects/${projectId}/repair-quality/prompt`, body)
}

export function applyProjectQualityRepairJson(
  projectId: string,
  body: StoryQualityRepairApplyRequest,
) {
  return apiPost<StoryQualityRepairApplyResult>(`/projects/${projectId}/repair-quality/apply`, body)
}

export function exportProjectCurrentVersion(projectId: string) {
  return apiPost<StoryProjectExportPackage>(`/projects/${projectId}/export`, {})
}

export function exportProjectKnowledgeCandidates(projectId: string) {
  return apiGet<ProjectKnowledgeCandidateExportPackage>(`/projects/${projectId}/knowledge-candidates/export`)
}

export function exportProjectKnowledgeWritebackPatch(projectId: string) {
  return apiGet<ProjectKnowledgeWritebackPatchPackage>(`/projects/${projectId}/knowledge-candidates/writeback-patch/export`)
}

export function exportKnowledgeWritebackQueuePatch(filters: ProjectSupplementTaskListFilters = {}) {
  const query = Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string | string[]] => (
      (typeof entry[1] === 'string' && entry[1].length > 0)
      || (Array.isArray(entry[1]) && entry[1].length > 0)
    )),
  ) as Record<string, string | string[]>
  return apiGet<ProjectKnowledgeWritebackPatchPackage>('/projects/knowledge-candidates/writeback-patch/export', query)
}

export function exportSupplementCandidatePackage(filters: ProjectSupplementTaskListFilters = {}) {
  const query = Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string | string[]] => (
      (typeof entry[1] === 'string' && entry[1].length > 0)
      || (Array.isArray(entry[1]) && entry[1].length > 0)
    )),
  ) as Record<string, string | string[]>
  return apiGet<ProjectSupplementCandidateExportPackage>('/projects/supplement-tasks/candidate-package/export', query)
}

export function getProjectProductionBoard(projectId: string) {
  return apiGet<StoryProductionBoard>(`/projects/${projectId}/production-board`)
}

export function getProjectProductionReadiness(projectId: string) {
  return apiGet<StoryProjectProductionReadinessReport>(`/projects/${projectId}/production-readiness`)
}

export function runProjectProductionReadinessAutomation(
  projectId: string,
  body: ProductionReadinessAutomationRunRequest = { dry_run: false },
) {
  return apiPost<ProductionReadinessAutomationRunResult<StoryProjectProductionReadinessReport>>(
    `/projects/${projectId}/production-readiness/run-automation`,
    body,
  )
}

export function draftProjectProductionMaterialFields(projectId: string) {
  return apiPost<ProjectDraftProductionMaterialFieldsResult>(`/projects/${projectId}/supplement-tasks/draft-production-material`, {})
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

export function draftProjectSeedanceAssetPlaceholders(projectId: string) {
  return apiPost<ProjectSeedanceAssetPlaceholderResult>(`/projects/${projectId}/production-board/seedance-assets/draft-placeholders`, {})
}

export function uploadProjectSeedanceAssetFile(projectId: string, body: FormData) {
  return apiPostForm<SeedanceAssetFileUploadResult>(`/projects/${projectId}/production-board/seedance-assets/upload`, body)
}

export function reviewProjectMediaAsset(
  projectId: string,
  assetId: string,
  body: MediaAssetReviewUpdateRequest,
) {
  return apiPost<MediaAssetReviewUpdateResult>(
    `/projects/${projectId}/production-board/media-assets/${encodeURIComponent(assetId)}/review`,
    body,
  )
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

export function importProjectSeedanceProviderCallback(projectId: string, body: SeedanceShotProviderCallbackRequest) {
  return apiPost<SeedanceShotProviderCallbackResult>(`/projects/${projectId}/production-board/seedance-shots/provider-callback`, body)
}

export function pollProjectSeedanceProviderQueue(projectId: string, body: SeedanceShotProviderPollRequest = {}) {
  return apiPost<SeedanceShotProviderPollResult>(`/projects/${projectId}/production-board/seedance-shots/poll-provider`, body)
}

export function getProjectSeedanceProviderQueueOverview(projectId: string, body: SeedanceShotProviderQueueOverviewRequest = {}) {
  return apiPost<SeedanceShotProviderQueueOverviewResult>(`/projects/${projectId}/production-board/seedance-shots/provider-overview`, body)
}

export function getProjectSeedanceProviderRetryPlan(projectId: string, body: SeedanceShotProviderRetryPlanRequest = {}) {
  return apiPost<SeedanceShotProviderRetryPlanResult>(`/projects/${projectId}/production-board/seedance-shots/provider-retry-plan`, body)
}

export function submitProjectSeedanceProviderRetryPlan(projectId: string, body: SeedanceShotProviderRetrySubmitRequest = {}) {
  return apiPost<SeedanceShotProviderRetrySubmitResult>(`/projects/${projectId}/production-board/seedance-shots/provider-retry-submit`, body)
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

export function submitProjectGearsJobs(projectId: string, body: GearsJobSubmitRequest = {}) {
  return apiPost<GearsJobSubmitResult>(`/projects/${projectId}/production-board/gears-jobs/submit`, body)
}

export function syncProjectGearsJobs(projectId: string, body: GearsJobStatusSyncRequest = {}) {
  return apiPost<GearsJobStatusSyncResult>(`/projects/${projectId}/production-board/gears-jobs/sync`, body)
}

export function acceptProjectLocalGearsArtifacts(projectId: string, body: GearsJobLocalAcceptanceRequest = {}) {
  return apiPost<GearsJobLocalAcceptanceResult>(`/projects/${projectId}/production-board/gears-jobs/local-acceptance`, body)
}

export function exportProjectGearsExternalCallbackHandoff(projectId: string) {
  return apiPost<GearsExternalCallbackHandoffPackage>(`/projects/${projectId}/production-board/gears-jobs/export-external-callback-handoff`, {})
}

export function preflightProjectGearsExternalCallbacks(projectId: string, body: GearsJobCallbackRequest) {
  return apiPost<GearsExternalCallbackPreflightResult>(`/projects/${projectId}/production-board/gears-jobs/preflight-external-callbacks`, body)
}

export function importProjectGearsExternalCallbacks(projectId: string, body: GearsJobCallbackRequest) {
  return apiPost<GearsExternalCallbackImportResult>(`/projects/${projectId}/production-board/gears-jobs/import-external-callbacks`, body)
}

export function importProjectGearsCallback(projectId: string, body: GearsJobCallbackRequest) {
  return apiPost<GearsJobCallbackResult>(`/projects/${projectId}/gears-callback`, body)
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

export function addProjectMaterialPackMaterial(projectId: string, body: ProjectMaterialPackAddMaterialRequest) {
  return apiPost<StoryProjectDetail>(`/projects/${projectId}/material-pack/materials`, body)
}
