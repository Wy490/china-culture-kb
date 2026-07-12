import type { Stage8BlindReviewEvaluatorReadinessReport, Stage8BlindReviewSignatureInspectionResult, Stage8BlindReviewSignatureWorkspace, Stage8DurableReleaseInspectionResult, Stage8DurableReleaseWorkspace, Stage8OperationsReport, Stage8BlindReviewValidationResult, Stage8BlindReviewWorkspace, Stage8FinalizationPreflightResult, Stage8FinalizationPreflightWorkspace } from '@shared/types'
import { apiGet, apiPost } from './client'

export function getStage8BlindReviewWorkspace() {
  return apiGet<Stage8BlindReviewWorkspace>('/stage8-blind-review/intake')
}

export function validateStage8BlindReviewIntake(request: unknown) {
  return apiPost<Stage8BlindReviewValidationResult>('/stage8-blind-review/intake/validate', request)
}

export function getStage8BlindReviewEvaluatorReadiness() {
  return apiGet<Stage8BlindReviewEvaluatorReadinessReport>('/stage8-blind-review/evaluator')
}

export function getStage8BlindReviewSignatureWorkspace(benchmarkId = '') {
  return apiGet<Stage8BlindReviewSignatureWorkspace>(`/stage8-blind-review/signature?benchmark_id=${encodeURIComponent(benchmarkId)}`)
}

export function validateStage8BlindReviewSignature(request: { expected_benchmark_id: string; review_bundle_raw_json: string; signature_raw_json: string }) {
  return apiPost<Stage8BlindReviewSignatureInspectionResult>('/stage8-blind-review/signature/validate', request)
}

export function getStage8FinalizationPreflightWorkspace(benchmarkId = '') {
  return apiGet<Stage8FinalizationPreflightWorkspace>(`/stage8-blind-review/finalization?benchmark_id=${encodeURIComponent(benchmarkId)}`)
}

export function validateStage8FinalizationPreflight(request: { expected_benchmark_id: string; finalization_input_raw_json: string; trust_policy_raw_json: string }) {
  return apiPost<Stage8FinalizationPreflightResult>('/stage8-blind-review/finalization/validate', request)
}

export function getStage8DurableReleaseWorkspace(benchmarkId = '') {
  return apiGet<Stage8DurableReleaseWorkspace>(`/stage8-blind-review/durable-release?benchmark_id=${encodeURIComponent(benchmarkId)}`)
}

export function validateStage8DurableRelease(request: { expected_benchmark_id: string; finalization_decision_raw_json: string; release_record_raw_json: string }) {
  return apiPost<Stage8DurableReleaseInspectionResult>('/stage8-blind-review/durable-release/validate', request)
}

export function getStage8Operations() {
  return apiGet<Stage8OperationsReport>('/stage8-blind-review/operations')
}
