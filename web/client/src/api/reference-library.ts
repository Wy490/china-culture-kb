import type {
  ReferenceAnalysisTaskRecord,
  ReferenceAnalysisTaskSubmissionResult,
  ReferenceLibraryDetail,
  ReferenceSimilarityAuthorization,
  ReferenceSimilarityDimension,
  ReferenceSimilarityEvidenceObservations,
  ReferenceSourceRecord,
} from '@shared/types'
import { apiGet, apiPost } from './client'

export interface CreateReferenceAnalysisTaskRequest {
  requested_dimensions: ReferenceSimilarityDimension[]
  authorization: Omit<ReferenceSimilarityAuthorization, 'machine_verified'>
}

export interface SubmitReferenceAnalysisTaskRequest {
  submission_key: string
  observations: ReferenceSimilarityEvidenceObservations
}

export function listReferenceSources() {
  return apiGet<ReferenceSourceRecord[]>('/reference-library/references')
}

export function getReferenceLibraryDetail(referenceId: string) {
  return apiGet<ReferenceLibraryDetail>(
    `/reference-library/references/${encodeURIComponent(referenceId)}`,
  )
}

export function listReferenceAnalysisTasks(referenceId: string) {
  return apiGet<ReferenceAnalysisTaskRecord[]>(
    `/reference-library/references/${encodeURIComponent(referenceId)}/analysis-tasks`,
  )
}

export function createReferenceAnalysisTask(
  referenceId: string,
  request: CreateReferenceAnalysisTaskRequest,
) {
  return apiPost<ReferenceAnalysisTaskRecord>(
    `/reference-library/references/${encodeURIComponent(referenceId)}/analysis-tasks`,
    request,
  )
}

export function submitReferenceAnalysisTask(
  taskId: string,
  request: SubmitReferenceAnalysisTaskRequest,
) {
  return apiPost<ReferenceAnalysisTaskSubmissionResult>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}/submissions`,
    request,
  )
}
