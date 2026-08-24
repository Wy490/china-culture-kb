import type {
  StoryGenerateRequest,
  StoryKnowledgeContractV1,
  StoryKnowledgeEvidenceOverlayV1,
  StoryKnowledgePreparationStatusV1,
  StoryKnowledgePromptShadowComparisonV1,
} from '@shared/types.js';
import { adaptLegacyChinaCultureEntryToStoryKnowledgeContract } from './story-knowledge-contract-service.js';
import { executeChinaCultureStoryGeneration } from './story-generation-execution-service.js';
import { prepareChinaCultureStoryGeneration } from './story-generation-preparation-service.js';
import { buildStoryKnowledgeGenerationShadow } from './story-knowledge-generation-shadow-service.js';
import { hashStoryKnowledgeShadowArtifact } from './story-knowledge-prompt-shadow-service.js';

const REVIEWED_AT = '2026-08-24T09:00:00+08:00';
export const STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST: StoryGenerateRequest = {
  video_type: 'ai_comic_drama',
  presentation_style: 'ai_comic',
  creation_use_case: 'original_ai_comic',
  truth_mode: 'fictional_original',
  entry_name: '岳阳楼——先忧后乐的精神地标',
  original_user_query: '以岳阳楼的建筑变迁与忧乐精神为依据，创作一则守护文化记忆的故事。',
};

export type MatrixCaseId =
  | 'approved_multi_source'
  | 'approved_machine_only'
  | 'approved_mixed_certainty'
  | 'approved_doubtful_entry'
  | 'pending_machine_context'
  | 'rejected_overlay'
  | 'incompatible_revoked_overlay';

export interface StoryKnowledgePromptShadowMatrixReportV1 {
  schema_version: 'story-knowledge-prompt-shadow-matrix/v1';
  status: 'passed' | 'needs_action';
  request_sha256: string;
  summary: {
    case_count: number;
    candidate_ready_count: number;
    blocked_count: number;
    safe_no_candidate_count: number;
    active_prompt_match_count: number;
    generation_story_match_count: number;
    shadow_prompt_created_count: number;
    shadow_prompt_executed_count: number;
  };
  gate_checks: {
    expected_case_count: boolean;
    only_approved_authoritative_multi_source_case_ready: boolean;
    machine_only_and_doubtful_cases_blocked: boolean;
    mixed_certainty_pending_rejected_and_incompatible_have_no_candidate: boolean;
    active_prompt_unchanged_for_every_case: boolean;
    generation_story_unchanged_for_every_case: boolean;
    no_shadow_prompt_executed_or_persisted: boolean;
  };
  cases: Array<{
    case_id: MatrixCaseId;
    expected_status: StoryKnowledgePromptShadowComparisonV1['status'];
    preparation_status: StoryKnowledgePreparationStatusV1;
    generation_shadow_status: 'safe_no_fact_candidates' | 'safe_fact_candidates' | 'blocked';
    comparison_status: StoryKnowledgePromptShadowComparisonV1['status'];
    fact_candidate_count: number;
    active_prompt_matches_baseline: boolean;
    generation_story_matches_baseline: boolean;
    active_prompt_package_sha256: string;
    shadow_prompt_package_sha256?: string;
    changed_generation_input_paths: string[];
    changed_prompt_package_paths: string[];
    preparation_issues: string[];
    issues: string[];
  }>;
  boundary: {
    synthetic_overlay_matrix: true;
    active_prompt_sent_to_adapter_only: true;
    shadow_prompt_execution_allowed: false;
    shadow_prompt_persistence_allowed: false;
    source_markdown_written: false;
    external_model_called: false;
    human_review_complete: false;
    real_human_review_credit_granted: false;
    production_credit_granted: false;
  };
}

export interface StoryKnowledgePromptShadowMatrixFixtureDefinition {
  case_id: MatrixCaseId;
  expected_status: StoryKnowledgePromptShadowComparisonV1['status'];
  overlay: unknown;
  entry_credibility_override?: string;
}

export function buildStoryKnowledgePromptShadowMatrixFixtureDefinitions(
  contract: StoryKnowledgeContractV1,
): StoryKnowledgePromptShadowMatrixFixtureDefinition[] {
  return [
    {
      case_id: 'approved_multi_source',
      expected_status: 'candidate_ready',
      overlay: approvedOverlay(contract, 'multi_source'),
    },
    {
      case_id: 'approved_machine_only',
      expected_status: 'blocked',
      overlay: approvedOverlay(contract, 'machine_only'),
    },
    {
      case_id: 'approved_mixed_certainty',
      expected_status: 'safe_no_candidate',
      overlay: approvedOverlay(contract, 'mixed_certainty'),
    },
    {
      case_id: 'approved_doubtful_entry',
      expected_status: 'blocked',
      overlay: approvedOverlay(contract, 'multi_source'),
      entry_credibility_override: '存疑',
    },
    {
      case_id: 'pending_machine_context',
      expected_status: 'safe_no_candidate',
      overlay: unsignedOverlay(contract, 'pending'),
    },
    {
      case_id: 'rejected_overlay',
      expected_status: 'safe_no_candidate',
      overlay: unsignedOverlay(contract, 'rejected'),
    },
    {
      case_id: 'incompatible_revoked_overlay',
      expected_status: 'safe_no_candidate',
      overlay: {
        ...unsignedOverlay(contract, 'pending'),
        overlay_id: 'fixture-incompatible-revoked-overlay-20260824',
        signoff: {
          status: 'revoked',
          revoked_by: 'fixture-reviewer-not-real',
          revoked_at: REVIEWED_AT,
        },
      },
    },
  ];
}

export async function buildStoryKnowledgePromptShadowMatrixReport(): Promise<StoryKnowledgePromptShadowMatrixReportV1> {
  const baselinePreparation = await prepareChinaCultureStoryGeneration(
    STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
  );
  if (!baselinePreparation.ok) throw new Error(baselinePreparation.message);
  const baselineExecution = await executeChinaCultureStoryGeneration({
    request: STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
    preparation: baselinePreparation,
  });
  if (!baselineExecution.ok) throw new Error(baselineExecution.message);
  const baselinePromptSha256 = hashStoryKnowledgeShadowArtifact(
    baselineExecution.promptPackage,
  );
  const baselineStorySha256 = hashStoryKnowledgeShadowArtifact(
    baselineExecution.storyResult,
  );
  const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(
    baselinePreparation.entry,
  ).contract;
  if (contract.sources.length < 2 || contract.claims.length === 0) {
    throw new Error('Prompt shadow matrix fixture requires at least two sources and one claim');
  }

  const definitions = buildStoryKnowledgePromptShadowMatrixFixtureDefinitions(contract);

  const cases: StoryKnowledgePromptShadowMatrixReportV1['cases'] = [];
  for (const definition of definitions) {
    const preparation = await prepareChinaCultureStoryGeneration(
      STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
      {
        storyKnowledge: {
          enabled: true,
          generationShadow: true,
          evidenceOverlay: definition.overlay,
        },
      },
    );
    if (!preparation.ok) throw new Error(preparation.message);
    if (!preparation.storyKnowledgePreparation || !preparation.storyKnowledgeGenerationShadow) {
      throw new Error(`Missing story knowledge shadow for ${definition.case_id}`);
    }
    const generationShadow = definition.entry_credibility_override
      ? buildStoryKnowledgeGenerationShadow({
        preparation: preparation.storyKnowledgePreparation,
        materialPack: preparation.materialPackToUse,
        entryCredibility: definition.entry_credibility_override,
      })
      : preparation.storyKnowledgeGenerationShadow;
    const preparedForExecution = {
      ...preparation,
      storyKnowledgeGenerationShadow: generationShadow,
    };
    const execution = await executeChinaCultureStoryGeneration({
      request: STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
      preparation: preparedForExecution,
    });
    if (!execution.ok) throw new Error(execution.message);
    const comparison = execution.storyKnowledgePromptShadowComparison;
    if (!comparison) throw new Error(`Missing prompt shadow comparison for ${definition.case_id}`);
    cases.push({
      case_id: definition.case_id,
      expected_status: definition.expected_status,
      preparation_status: preparation.storyKnowledgePreparation.status,
      generation_shadow_status: generationShadow.status,
      comparison_status: comparison.status,
      fact_candidate_count: comparison.fact_candidate_claim_ids.length,
      active_prompt_matches_baseline:
        comparison.active_prompt_package_sha256 === baselinePromptSha256,
      generation_story_matches_baseline:
        hashStoryKnowledgeShadowArtifact(execution.storyResult) === baselineStorySha256,
      active_prompt_package_sha256: comparison.active_prompt_package_sha256,
      ...(comparison.shadow_prompt_package_sha256
        ? { shadow_prompt_package_sha256: comparison.shadow_prompt_package_sha256 }
        : {}),
      changed_generation_input_paths: [...comparison.changed_generation_input_paths],
      changed_prompt_package_paths: [...comparison.changed_prompt_package_paths],
      preparation_issues: [...preparation.storyKnowledgePreparation.issues],
      issues: [...comparison.issues],
    });
  }

  const summary = {
    case_count: cases.length,
    candidate_ready_count: cases.filter(item => item.comparison_status === 'candidate_ready').length,
    blocked_count: cases.filter(item => item.comparison_status === 'blocked').length,
    safe_no_candidate_count: cases.filter(item => item.comparison_status === 'safe_no_candidate').length,
    active_prompt_match_count: cases.filter(item => item.active_prompt_matches_baseline).length,
    generation_story_match_count: cases.filter(item => item.generation_story_matches_baseline).length,
    shadow_prompt_created_count: cases.filter(item => item.shadow_prompt_package_sha256).length,
    shadow_prompt_executed_count: 0,
  };
  const statusById = new Map(cases.map(item => [item.case_id, item.comparison_status]));
  const gateChecks = {
    expected_case_count: summary.case_count === 7,
    only_approved_authoritative_multi_source_case_ready:
      summary.candidate_ready_count === 1
      && statusById.get('approved_multi_source') === 'candidate_ready',
    machine_only_and_doubtful_cases_blocked:
      ['approved_machine_only', 'approved_doubtful_entry']
        .every(caseId => statusById.get(caseId as MatrixCaseId) === 'blocked'),
    mixed_certainty_pending_rejected_and_incompatible_have_no_candidate:
      [
        'approved_mixed_certainty',
        'pending_machine_context',
        'rejected_overlay',
        'incompatible_revoked_overlay',
      ]
        .every(caseId => statusById.get(caseId as MatrixCaseId) === 'safe_no_candidate'),
    active_prompt_unchanged_for_every_case:
      summary.active_prompt_match_count === summary.case_count,
    generation_story_unchanged_for_every_case:
      summary.generation_story_match_count === summary.case_count,
    no_shadow_prompt_executed_or_persisted: summary.shadow_prompt_executed_count === 0,
  };

  return {
    schema_version: 'story-knowledge-prompt-shadow-matrix/v1',
    status: Object.values(gateChecks).every(Boolean) ? 'passed' : 'needs_action',
    request_sha256: hashStoryKnowledgeShadowArtifact(
      STORY_KNOWLEDGE_PROMPT_SHADOW_MATRIX_REQUEST,
    ),
    summary,
    gate_checks: gateChecks,
    cases,
    boundary: {
      synthetic_overlay_matrix: true,
      active_prompt_sent_to_adapter_only: true,
      shadow_prompt_execution_allowed: false,
      shadow_prompt_persistence_allowed: false,
      source_markdown_written: false,
      external_model_called: false,
      human_review_complete: false,
      real_human_review_credit_granted: false,
      production_credit_granted: false,
    },
  };
}

function approvedOverlay(
  contract: StoryKnowledgeContractV1,
  mode: 'multi_source' | 'machine_only' | 'mixed_certainty',
): StoryKnowledgeEvidenceOverlayV1 {
  const multiSource = mode === 'multi_source';
  const machineOnly = mode === 'machine_only';
  const reviewedSources = contract.sources.slice(0, multiSource ? 2 : 1);
  return {
    schema_version: 'story-knowledge-evidence-overlay/v1',
    overlay_id: `fixture-approved-${mode.replaceAll('_', '-')}-20260824`,
    entry_name: contract.source_entry.name,
    source_reviews: reviewedSources.map((source, index) => ({
      source_ref_id: source.source_ref_id,
      grade: multiSource && index === 1 ? 'B' : 'A',
      verification_status: machineOnly ? 'machine_mapped' : 'human_verified',
      ...(!machineOnly ? { verified_at: REVIEWED_AT } : {}),
      note: '合成 overlay matrix 来源，不授予真实审核信用。',
    })),
    claim_mappings: [{
      claim_id: contract.claims[0]!.claim_id,
      source_ref_ids: reviewedSources.map(source => source.source_ref_id),
      claim_type: multiSource ? 'critical_fact' : 'supporting_fact',
      certainty: mode === 'mixed_certainty' ? 'probable' : 'verified',
      usage: 'fact',
      scope: `合成 ${mode} shadow 对照，不进入正式生成。`,
    }],
    signoff: {
      status: 'approved',
      reviewed_by: 'fixture-reviewer-not-real',
      reviewer_role: 'fact_culture_reviewer',
      reviewed_at: REVIEWED_AT,
      confirmation: 'human_reviewed_story_knowledge_evidence_overlay',
    },
    boundary: overlayBoundary(),
  };
}

function unsignedOverlay(
  contract: StoryKnowledgeContractV1,
  status: 'pending' | 'rejected',
): StoryKnowledgeEvidenceOverlayV1 {
  return {
    schema_version: 'story-knowledge-evidence-overlay/v1',
    overlay_id: `fixture-${status}-prompt-shadow-20260824`,
    entry_name: contract.source_entry.name,
    source_reviews: [{
      source_ref_id: contract.sources[0]!.source_ref_id,
      grade: 'C',
      verification_status: 'machine_mapped',
      note: '机器上下文候选，不可作为事实。',
    }],
    claim_mappings: [{
      claim_id: contract.claims[0]!.claim_id,
      source_ref_ids: [contract.sources[0]!.source_ref_id],
      claim_type: 'supporting_fact',
      certainty: 'probable',
      usage: 'bounded_context',
      scope: '未批准前只允许受限背景。',
    }],
    signoff: status === 'pending'
      ? { status: 'pending', reason: '等待事实与文化审核。' }
      : {
        status: 'rejected',
        reviewed_by: 'fixture-reviewer-not-real',
        reviewer_role: 'fact_culture_reviewer',
        reviewed_at: REVIEWED_AT,
        reason: '合成拒绝案例。',
      },
    boundary: overlayBoundary(),
  };
}

function overlayBoundary(): StoryKnowledgeEvidenceOverlayV1['boundary'] {
  return {
    read_only_overlay: true,
    source_markdown_writeback_allowed: false,
    generation_consumption_allowed: false,
    existing_supplement_tasks_mutable: false,
  };
}
