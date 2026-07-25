import type {
  FilmReferenceAnalysis,
  FilmReferenceAnalysisRecord,
  ReferenceAnalysisApprovalRequest,
  ReferenceAnalysisApprovalResult,
  ReferenceAnalysisTaskRecord,
  ReferenceAnalysisTaskSubmissionResult,
  ReferenceLibraryDetail,
  ReferenceSimilarityAuthorization,
  ReferenceSimilarityDimension,
  ReferenceSimilarityEvidenceObservations,
  ReferenceSourceRecord,
  TextReferenceAnalysis,
  TextReferenceAnalysisRecord,
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

export type CreateReferenceSourceRequest = Omit<
  ReferenceSourceRecord,
  'schema_version' | 'reference_id' | 'created_at' | 'updated_at'
>

export interface CreateFilmReferenceAnalysisRequest {
  analysis: FilmReferenceAnalysis
  analyzed_by: string
}

export interface CreateTextReferenceAnalysisRequest {
  analysis: TextReferenceAnalysis
  analyzed_by: string
}

export function listReferenceSources() {
  return apiGet<ReferenceSourceRecord[]>('/reference-library/references')
}

export function createReferenceSource(request: CreateReferenceSourceRequest) {
  return apiPost<ReferenceSourceRecord>('/reference-library/references', request)
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

export function createFilmReferenceAnalysis(
  referenceId: string,
  request: CreateFilmReferenceAnalysisRequest,
) {
  return apiPost<FilmReferenceAnalysisRecord>(
    `/reference-library/references/${encodeURIComponent(referenceId)}/film-analyses`,
    request,
  )
}

export function createTextReferenceAnalysis(
  referenceId: string,
  request: CreateTextReferenceAnalysisRequest,
) {
  return apiPost<TextReferenceAnalysisRecord>(
    `/reference-library/references/${encodeURIComponent(referenceId)}/text-analyses`,
    request,
  )
}

export function approveReferenceAnalysis(
  analysisId: string,
  request: ReferenceAnalysisApprovalRequest,
) {
  return apiPost<ReferenceAnalysisApprovalResult>(
    `/reference-library/analyses/${encodeURIComponent(analysisId)}/approval`,
    request,
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
