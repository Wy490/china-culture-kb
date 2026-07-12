import type {
  Stage6FeedbackDraftCreateRequest,
  Stage6FeedbackReviewUpdateRequest,
  Stage6ExitReviewSignatureInspectionResult,
  Stage6ExitReviewSignatureInspectorWorkspace,
  Stage6OperatorIntakeValidationResult,
  Stage6OperatorIntakeWorkspace,
  Stage6OperatorRevisionPreflightResult,
  Stage6OperatorRevisionPreflightWorkspace,
  Stage6OperatorControlTowerReport,
  Stage6ProfessionalPackageInspectionResult,
  Stage6ProfessionalPackageInspectorWorkspace,
  Stage6RealRevisionExitAuditReport,
  Stage6TableReadEvidenceInspectionResult,
  Stage6TableReadEvidenceInspectorWorkspace,
  Stage6RevisionWorkspaceDetail,
  Stage6RevisionWorkspacePortfolio,
} from '@shared/types'
import { apiGet, apiPatch, apiPost } from './client'

export function getStage6RevisionPortfolio() {
  return apiGet<Stage6RevisionWorkspacePortfolio>('/stage6-revisions')
}

export function getStage6OperatorIntakeWorkspace() {
  return apiGet<Stage6OperatorIntakeWorkspace>('/stage6-revisions/intake')
}

export function validateStage6OperatorIntake(intake: unknown) {
  return apiPost<Stage6OperatorIntakeValidationResult>('/stage6-revisions/intake/validate', intake)
}

export function getStage6OperatorRevisionPreflightWorkspace() {
  return apiGet<Stage6OperatorRevisionPreflightWorkspace>('/stage6-revisions/preflight')
}

export function preflightStage6OperatorRevision(command: unknown) {
  return apiPost<Stage6OperatorRevisionPreflightResult>('/stage6-revisions/preflight/validate', command)
}

export function getStage6RealRevisionExitAudit() {
  return apiGet<Stage6RealRevisionExitAuditReport>('/stage6-revisions/exit-audit')
}

export function getStage6ProfessionalPackageInspector(videoType: string) {
  return apiGet<Stage6ProfessionalPackageInspectorWorkspace>(
    `/stage6-revisions/package-inspector?video_type=${encodeURIComponent(videoType)}`,
  )
}

export function inspectStage6ProfessionalPackage(request: {
  raw_json: string
  expected_project_id: string
  expected_video_type: string
}) {
  return apiPost<Stage6ProfessionalPackageInspectionResult>('/stage6-revisions/package-inspector/validate', request)
}

export function getStage6OperatorControlTower() {
  return apiGet<Stage6OperatorControlTowerReport>('/stage6-revisions/operations')
}

export function getStage6TableReadEvidenceInspector(benchmarkId: string, roundNumber: 1 | 2) {
  return apiGet<Stage6TableReadEvidenceInspectorWorkspace>(
    `/stage6-revisions/table-read-inspector?benchmark_id=${encodeURIComponent(benchmarkId)}&round_number=${roundNumber}`,
  )
}

export function inspectStage6TableReadEvidence(request: {
  raw_json: string
  expected_benchmark_id: string
  expected_round_number: 1 | 2
}) {
  return apiPost<Stage6TableReadEvidenceInspectionResult>('/stage6-revisions/table-read-inspector/validate', request)
}

export function getStage6ExitReviewSignatureInspector(benchmarkId: string) {
  return apiGet<Stage6ExitReviewSignatureInspectorWorkspace>(
    `/stage6-revisions/exit-review-signature?benchmark_id=${encodeURIComponent(benchmarkId)}`,
  )
}

export function inspectStage6ExitReviewSignature(request: {
  raw_json: string
  expected_benchmark_id: string
}) {
  return apiPost<Stage6ExitReviewSignatureInspectionResult>('/stage6-revisions/exit-review-signature/validate', request)
}

export function getStage6RevisionDetail(benchmarkId: string) {
  return apiGet<Stage6RevisionWorkspaceDetail>(`/stage6-revisions/${encodeURIComponent(benchmarkId)}`)
}

export function updateStage6Feedback(
  benchmarkId: string,
  roundNumber: 1 | 2,
  feedbackId: string,
  request: Stage6FeedbackReviewUpdateRequest,
) {
  return apiPatch<Stage6RevisionWorkspaceDetail>(
    `/stage6-revisions/${encodeURIComponent(benchmarkId)}/rounds/${roundNumber}/feedback/${encodeURIComponent(feedbackId)}`,
    request,
  )
}

export function createStage6FeedbackDraft(
  benchmarkId: string,
  request: Stage6FeedbackDraftCreateRequest,
) {
  return apiPost<Stage6RevisionWorkspaceDetail>(
    `/stage6-revisions/${encodeURIComponent(benchmarkId)}/feedback-drafts`,
    request,
  )
}
