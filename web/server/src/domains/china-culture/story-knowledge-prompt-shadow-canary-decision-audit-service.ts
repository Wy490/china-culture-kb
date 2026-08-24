import { StoryKnowledgePromptShadowCanaryRequestV1Schema } from '@shared/schemas.js';
import type {
  StoryKnowledgeMigrationDecisionV1,
  StoryKnowledgePromptShadowComparisonV1,
} from '@shared/types.js';
import { adaptLegacyChinaCultureEntryToStoryKnowledgeContract } from './story-knowledge-contract-service.js';
import {
  runStoryKnowledgePromptShadowCanary,
  verifyStoryKnowledgePromptShadowCanaryReceipt,
} from './story-knowledge-prompt-shadow-canary-service.js';
import {
  buildStoryKnowledgePromptShadowMatrixFixtureDefinitions,
  STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
  type MatrixCaseId,
} from './story-knowledge-prompt-shadow-matrix-service.js';
import { prepareChinaCultureStoryGeneration } from './story-generation-preparation-service.js';
import { hashStoryKnowledgeShadowArtifact } from './story-knowledge-prompt-shadow-service.js';

type CanaryAuditCaseId = 'base_contract_only' | Exclude<
  MatrixCaseId,
  'approved_doubtful_entry'
>;

export interface StoryKnowledgePromptShadowCanaryDecisionAuditReportV1 {
  schema_version: 'story-knowledge-prompt-shadow-canary-decision-audit/v1';
  status: 'passed' | 'needs_action';
  generation_request_sha256: string;
  summary: {
    case_count: number;
    eligible_for_operator_review_count: number;
    remain_shadow_count: number;
    candidate_ready_count: number;
    blocked_count: number;
    safe_no_candidate_count: number;
    valid_binding_count: number;
    formal_consumption_allowed_count: number;
    adapter_invoked_count: number;
    persistence_performed_count: number;
  };
  gate_checks: {
    expected_case_count: boolean;
    only_approved_authoritative_multi_source_is_operator_review_eligible: boolean;
    every_receipt_binding_is_valid: boolean;
    every_case_keeps_formal_consumption_closed: boolean;
    no_adapter_or_persistence_performed: boolean;
  };
  cases: Array<{
    case_id: CanaryAuditCaseId;
    request_sha256: string;
    evidence_overlay_sha256?: string;
    generation_shadow_sha256: string;
    prompt_shadow_comparison_sha256: string;
    migration_decision_sha256: string;
    receipt_sha256: string;
    prompt_shadow_status: StoryKnowledgePromptShadowComparisonV1['status'];
    decision: StoryKnowledgeMigrationDecisionV1['decision'];
    formal_consumption_blockers: string[];
    binding_valid: boolean;
    binding_issues: string[];
    formal_consumption_allowed: false;
    adapter_invoked: false;
    persistence_performed: false;
  }>;
  boundary: {
    synthetic_fixture_audit: true;
    read_only_canary_only: true;
    prompt_text_returned: false;
    story_result_returned: false;
    source_markdown_written: false;
    external_model_called: false;
    human_review_complete: false;
    real_human_review_credit_granted: false;
    production_canary_executed: false;
    production_credit_granted: false;
  };
}

export async function buildStoryKnowledgePromptShadowCanaryDecisionAuditReport(): Promise<StoryKnowledgePromptShadowCanaryDecisionAuditReportV1> {
  const baseline = await prepareChinaCultureStoryGeneration(
    STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
  );
  if (!baseline.ok) throw new Error(baseline.message);
  const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(
    baseline.entry,
  ).contract;
  if (contract.sources.length < 2 || contract.claims.length === 0) {
    throw new Error('Canary decision audit requires at least two sources and one claim');
  }
  const definitions: Array<{
    case_id: CanaryAuditCaseId;
    overlay?: unknown;
  }> = [
    { case_id: 'base_contract_only' },
    ...buildStoryKnowledgePromptShadowMatrixFixtureDefinitions(contract)
      .filter(definition => !definition.entry_credibility_override)
      .map(definition => ({
        case_id: definition.case_id as CanaryAuditCaseId,
        overlay: definition.overlay,
      })),
  ];

  const cases: StoryKnowledgePromptShadowCanaryDecisionAuditReportV1['cases'] = [];
  for (const definition of definitions) {
    const request = StoryKnowledgePromptShadowCanaryRequestV1Schema.parse({
      schema_version: 'story-knowledge-prompt-shadow-canary-request/v1',
      operator_intent: 'read_only_shadow_canary',
      generation_request: STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
      ...(definition.overlay !== undefined
        ? { evidence_overlay: definition.overlay }
        : {}),
    });
    const result = await runStoryKnowledgePromptShadowCanary(request);
    if (!result.ok) {
      throw new Error(`${definition.case_id}: ${result.message}`);
    }
    const verification = verifyStoryKnowledgePromptShadowCanaryReceipt({
      request,
      receipt: result.data,
    });
    cases.push({
      case_id: definition.case_id,
      request_sha256: result.data.request_sha256,
      ...(result.data.binding.evidence_overlay_sha256
        ? { evidence_overlay_sha256: result.data.binding.evidence_overlay_sha256 }
        : {}),
      generation_shadow_sha256: result.data.binding.generation_shadow_sha256,
      prompt_shadow_comparison_sha256:
        result.data.binding.prompt_shadow_comparison_sha256,
      migration_decision_sha256: result.data.binding.migration_decision_sha256,
      receipt_sha256: hashStoryKnowledgeShadowArtifact(result.data),
      prompt_shadow_status: result.data.prompt_shadow_comparison.status,
      decision: result.data.migration_decision.decision,
      formal_consumption_blockers: [
        ...result.data.migration_decision.formal_consumption_blockers,
      ],
      binding_valid: verification.valid,
      binding_issues: [...verification.issues],
      formal_consumption_allowed:
        result.data.migration_decision.boundary.formal_consumption_allowed,
      adapter_invoked: result.data.boundary.adapter_invoked,
      persistence_performed:
        result.data.boundary.story_persisted
        || result.data.boundary.project_persisted,
    });
  }

  const summary = {
    case_count: cases.length,
    eligible_for_operator_review_count: cases.filter(
      item => item.decision === 'eligible_for_operator_review',
    ).length,
    remain_shadow_count: cases.filter(item => item.decision === 'remain_shadow').length,
    candidate_ready_count: cases.filter(
      item => item.prompt_shadow_status === 'candidate_ready',
    ).length,
    blocked_count: cases.filter(item => item.prompt_shadow_status === 'blocked').length,
    safe_no_candidate_count: cases.filter(
      item => item.prompt_shadow_status === 'safe_no_candidate',
    ).length,
    valid_binding_count: cases.filter(item => item.binding_valid).length,
    formal_consumption_allowed_count: cases.filter(
      item => item.formal_consumption_allowed,
    ).length,
    adapter_invoked_count: cases.filter(item => item.adapter_invoked).length,
    persistence_performed_count: cases.filter(item => item.persistence_performed).length,
  };
  const eligibleCaseIds = cases
    .filter(item => item.decision === 'eligible_for_operator_review')
    .map(item => item.case_id);
  const gateChecks = {
    expected_case_count: summary.case_count === 7,
    only_approved_authoritative_multi_source_is_operator_review_eligible:
      eligibleCaseIds.length === 1 && eligibleCaseIds[0] === 'approved_multi_source',
    every_receipt_binding_is_valid: summary.valid_binding_count === summary.case_count,
    every_case_keeps_formal_consumption_closed:
      summary.formal_consumption_allowed_count === 0
      && cases.every(item => item.formal_consumption_blockers.length > 0),
    no_adapter_or_persistence_performed:
      summary.adapter_invoked_count === 0
      && summary.persistence_performed_count === 0,
  };

  return {
    schema_version: 'story-knowledge-prompt-shadow-canary-decision-audit/v1',
    status: Object.values(gateChecks).every(Boolean) ? 'passed' : 'needs_action',
    generation_request_sha256: hashStoryKnowledgeShadowArtifact(
      StoryKnowledgePromptShadowCanaryRequestV1Schema.parse({
        schema_version: 'story-knowledge-prompt-shadow-canary-request/v1',
        operator_intent: 'read_only_shadow_canary',
        generation_request: STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
      }).generation_request,
    ),
    summary,
    gate_checks: gateChecks,
    cases,
    boundary: {
      synthetic_fixture_audit: true,
      read_only_canary_only: true,
      prompt_text_returned: false,
      story_result_returned: false,
      source_markdown_written: false,
      external_model_called: false,
      human_review_complete: false,
      real_human_review_credit_granted: false,
      production_canary_executed: false,
      production_credit_granted: false,
    },
  };
}
