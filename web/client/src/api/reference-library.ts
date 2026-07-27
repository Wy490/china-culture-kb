import type {
  BenchmarkCard,
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
  ReferenceStylePackRecord,
  ReferenceTextMaterialAuthorization,
  ReferenceTextMaterialContentType,
  ReferenceTextMaterialManifest,
  ReferenceTextMaterialRecord,
  ReferenceTextMaterialStatus,
  PresentationStyle,
  StoryStructureType,
  TextReferenceAnalysis,
  TextReferenceAnalysisRecord,
  VideoType,
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

export interface CreateReferenceTextMaterialRequest {
  content: string
  content_type: ReferenceTextMaterialContentType
  authorization: Omit<ReferenceTextMaterialAuthorization, 'machine_verified'>
}

export interface CreateReferenceTextMaterialResult {
  material: ReferenceTextMaterialRecord
  idempotent_replay: boolean
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

export interface CreateBenchmarkCardRequest {
  analysis_ids: string[]
  target_video_type: VideoType
  target_dimension: BenchmarkCard['target_dimension']
  principle: string
  evidence_refs: string[]
  created_by: string
  approval: {
    approved_by: string
    approved_at: string
  }
}

export interface CreateReferenceStylePackRequest {
  name: string
  description: string
  benchmark_card_ids: string[]
  compatible_video_types: VideoType[]
  compatible_presentation_styles: PresentationStyle[]
  compatible_story_structures: StoryStructureType[]
  created_by: string
  approval: {
    approved_by: string
    approved_at: string
  }
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

export function getReferenceTextMaterialStatus(referenceId: string) {
  return apiGet<ReferenceTextMaterialStatus>(
    `/reference-library/references/${encodeURIComponent(referenceId)}/text-material/status`,
  )
}

export function getReferenceTextMaterialManifest(referenceId: string) {
  return apiGet<ReferenceTextMaterialManifest>(
    `/reference-library/references/${encodeURIComponent(referenceId)}/text-material/manifest`,
  )
}

export function createReferenceTextMaterial(
  referenceId: string,
  request: CreateReferenceTextMaterialRequest,
) {
  return apiPost<CreateReferenceTextMaterialResult>(
    `/reference-library/references/${encodeURIComponent(referenceId)}/text-material`,
    request,
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

export function listReferenceBenchmarkCards() {
  return apiGet<BenchmarkCard[]>('/reference-library/benchmark-cards')
}

export function createReferenceBenchmarkCard(request: CreateBenchmarkCardRequest) {
  return apiPost<BenchmarkCard>('/reference-library/benchmark-cards', request)
}

export function listReferenceStylePacks() {
  return apiGet<ReferenceStylePackRecord[]>('/reference-library/style-packs')
}

export function createReferenceStylePack(request: CreateReferenceStylePackRequest) {
  return apiPost<ReferenceStylePackRecord>('/reference-library/style-packs', request)
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
