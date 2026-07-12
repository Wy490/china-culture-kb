import type {
  Stage7GoldenCardCandidateInspectionResult,
  Stage7GoldenCardCandidateWorkspace,
  Stage7GoldenCardReviewInspectionResult,
  Stage7GoldenCardReviewSignatureInspectionResult,
  Stage7GoldenCardReviewSignatureWorkspace,
  Stage7MaterialOperationsReport,
  Stage7GoldenCardReviewWorkspace,
} from '@shared/types'
import { apiGet, apiPost } from './client'

export function getStage7GoldenCardReviewWorkspace(cardId: string) {
  return apiGet<Stage7GoldenCardReviewWorkspace>(
    `/stage7-golden-cards/review-intake?card_id=${encodeURIComponent(cardId)}`,
  )
}

export function inspectStage7GoldenCardReview(request: { raw_json: string; expected_card_id: string }) {
  return apiPost<Stage7GoldenCardReviewInspectionResult>('/stage7-golden-cards/review-intake/validate', request)
}

export function getStage7GoldenCardCandidateWorkspace(slotId: string) {
  return apiGet<Stage7GoldenCardCandidateWorkspace>(
    `/stage7-golden-cards/candidate-expansion?slot_id=${encodeURIComponent(slotId)}`,
  )
}

export function inspectStage7GoldenCardCandidate(request: { raw_json: string; expected_slot_id: string }) {
  return apiPost<Stage7GoldenCardCandidateInspectionResult>('/stage7-golden-cards/candidate-expansion/validate', request)
}

export function getStage7GoldenCardReviewSignatureWorkspace(cardId: string) {
  return apiGet<Stage7GoldenCardReviewSignatureWorkspace>(
    `/stage7-golden-cards/review-signature?card_id=${encodeURIComponent(cardId)}`,
  )
}

export function inspectStage7GoldenCardReviewSignature(request: {
  expected_card_id: string
  review_raw_json: string
  signature_raw_json: string
}) {
  return apiPost<Stage7GoldenCardReviewSignatureInspectionResult>('/stage7-golden-cards/review-signature/validate', request)
}

export function getStage7MaterialOperations() {
  return apiGet<Stage7MaterialOperationsReport>('/stage7-golden-cards/operations')
}
