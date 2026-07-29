import type {
  BenchmarkCard,
  FilmReferenceAnalysis,
  FilmReferenceAnalysisRecord,
  ReferenceAnalysisApprovalRequest,
  ReferenceAnalysisApprovalResult,
  ReferenceAnalysisTaskRecord,
  ReferenceAnalysisTaskSubmissionResult,
  ReferenceLibraryDetail,
  ReferencePrivateVideoAuthorization,
  ReferencePrivateVideoMediaType,
  ReferencePrivateVideoSampleIngestResult,
  ReferencePrivateVideoSampleRecord,
  ReferencePrivateVideoTranscriptSubmissionResult,
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
  ReferenceTextAnalysisChunkSubmissionResult,
  ReferenceTextAnalysisExecutionRecord,
  ReferenceTextAnalysisFinalizationResult,
  ReferenceTextAnalysisNextChunkResult,
  ReferenceTextAnalysisPartialObservations,
  ReferenceTextAnalysisDraftSubmissionResult,
  ReferenceTextAnalysisDraftSupplementItem,
  ReferenceTextAnalysisDraftSupplementRecord,
  ReferenceTextAnalysisDraftSupplementSubmissionResult,
  ReferenceTextAnalysisDraftTaskRecord,
  ReferenceTextAnalysisSupplementNeed,
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

export interface CreateReferencePrivateVideoSampleRequest {
  title: string
  media_type: ReferencePrivateVideoMediaType
  local_video_path: string
  rights_status: ReferencePrivateVideoAuthorization['basis']
  access_scope: 'excerpt' | 'full_user_supplied'
  user_reason: string
  authorization: Omit<ReferencePrivateVideoAuthorization, 'machine_verified'>
  thumbnail_time_seconds?: number
  extract_thumbnail?: boolean
  extract_audio_wav?: boolean
}

export interface SubmitReferencePrivateVideoTranscriptRequest {
  transcript_text: string
  transcript_format: 'text/plain' | 'text/srt' | 'text/vtt'
  transcribed_by: string
  transcribed_at: string
  method: 'local_manual' | 'local_model'
  tool_name?: string
  tool_version?: string
  confirmation: 'local_private_transcription_only'
}

export interface CreateReferenceTextAnalysisExecutionRequest {
  executor: {
    kind: 'codex' | 'operator'
    executor_id: string
  }
  confirmation: 'source_text_treated_as_untrusted_data'
}

export interface SubmitReferenceTextAnalysisChunkRequest {
  submission_key: string
  submitted_by: string
  chunk_content_sha256: string
  observations: ReferenceTextAnalysisPartialObservations
}

export interface CreateReferenceTextAnalysisDraftTaskRequest {
  executor: {
    kind: 'codex' | 'operator'
    executor_id: string
  }
  confirmation: 'draft_complete_text_analysis_from_verified_evidence'
}

export interface SubmitReferenceTextAnalysisDraftRequest {
  submission_key: string
  submitted_by: string
  confirmation: 'submit_pending_text_reference_analysis'
  analysis: TextReferenceAnalysis
}

export interface RequestReferenceTextAnalysisSupplementRequest {
  submission_key: string
  requested_by: string
  confirmation: 'declare_text_analysis_evidence_insufficient'
  needs: ReferenceTextAnalysisSupplementNeed[]
}

export interface SubmitReferenceTextAnalysisSupplementRequest {
  submission_key: string
  submitted_by: string
  confirmation: 'submit_bounded_supplement_without_source_excerpts'
  items: ReferenceTextAnalysisDraftSupplementItem[]
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

export function createReferencePrivateVideoSample(
  request: CreateReferencePrivateVideoSampleRequest,
) {
  return apiPost<ReferencePrivateVideoSampleIngestResult>(
    '/reference-library/private-video-samples',
    request,
  )
}

export function getReferencePrivateVideoSample(sampleId: string) {
  return apiGet<ReferencePrivateVideoSampleRecord>(
    `/reference-library/private-video-samples/${encodeURIComponent(sampleId)}`,
  )
}

export function submitReferencePrivateVideoTranscript(
  sampleId: string,
  request: SubmitReferencePrivateVideoTranscriptRequest,
) {
  return apiPost<ReferencePrivateVideoTranscriptSubmissionResult>(
    `/reference-library/private-video-samples/${encodeURIComponent(sampleId)}/transcript`,
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

export function createReferenceTextAnalysisExecution(
  taskId: string,
  request: CreateReferenceTextAnalysisExecutionRequest,
) {
  return apiPost<ReferenceTextAnalysisExecutionRecord>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}/text-execution`,
    request,
  )
}

export function getReferenceTextAnalysisExecution(taskId: string) {
  return apiGet<ReferenceTextAnalysisExecutionRecord>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}/text-execution`,
  )
}

export function getReferenceTextAnalysisNextChunk(taskId: string) {
  return apiGet<ReferenceTextAnalysisNextChunkResult>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}/text-execution/next-chunk`,
  )
}

export function submitReferenceTextAnalysisChunk(
  taskId: string,
  chunkId: string,
  request: SubmitReferenceTextAnalysisChunkRequest,
) {
  return apiPost<ReferenceTextAnalysisChunkSubmissionResult>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}`
      + `/text-execution/chunks/${encodeURIComponent(chunkId)}/submissions`,
    request,
  )
}

export function finalizeReferenceTextAnalysisExecution(
  taskId: string,
  finalizedBy: string,
) {
  return apiPost<ReferenceTextAnalysisFinalizationResult>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}/text-execution/finalize`,
    {
      finalized_by: finalizedBy,
      confirmation: 'aggregate_completed_chunks_to_operator_evidence',
    },
  )
}

export function createReferenceTextAnalysisDraftTask(
  taskId: string,
  request: CreateReferenceTextAnalysisDraftTaskRequest,
) {
  return apiPost<ReferenceTextAnalysisDraftTaskRecord>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}`
      + '/text-analysis-draft-task',
    request,
  )
}

export function getReferenceTextAnalysisDraftTask(taskId: string) {
  return apiGet<ReferenceTextAnalysisDraftTaskRecord>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}`
      + '/text-analysis-draft-task',
  )
}

export function submitReferenceTextAnalysisDraft(
  taskId: string,
  request: SubmitReferenceTextAnalysisDraftRequest,
) {
  return apiPost<ReferenceTextAnalysisDraftSubmissionResult>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}`
      + '/text-analysis-draft-task/submissions',
    request,
  )
}

export function requestReferenceTextAnalysisSupplement(
  taskId: string,
  request: RequestReferenceTextAnalysisSupplementRequest,
) {
  return apiPost<ReferenceTextAnalysisDraftTaskRecord>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}`
      + '/text-analysis-draft-task/supplement-request',
    request,
  )
}

export function submitReferenceTextAnalysisSupplement(
  taskId: string,
  request: SubmitReferenceTextAnalysisSupplementRequest,
) {
  return apiPost<ReferenceTextAnalysisDraftSupplementSubmissionResult>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}`
      + '/text-analysis-draft-task/supplement-submissions',
    request,
  )
}

export function getReferenceTextAnalysisSupplement(taskId: string) {
  return apiGet<ReferenceTextAnalysisDraftSupplementRecord>(
    `/reference-library/analysis-tasks/${encodeURIComponent(taskId)}`
      + '/text-analysis-draft-task/supplement',
  )
}
