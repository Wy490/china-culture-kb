import { StoryKnowledgeGenerationShadowV1Schema } from '@shared/schemas.js';
import type {
  MaterialPack,
  StoryKnowledgeClaimV1,
  StoryKnowledgeGenerationShadowV1,
  StoryKnowledgePreparationV1,
  StoryKnowledgeSourceRefV1,
} from '@shared/types.js';

export function buildStoryKnowledgeGenerationShadow(input: {
  preparation: StoryKnowledgePreparationV1;
  materialPack: MaterialPack;
  entryCredibility: string;
}): StoryKnowledgeGenerationShadowV1 {
  const { preparation, materialPack } = input;
  const contract = preparation.contract;
  const sourceById = new Map(
    contract.sources.map(source => [source.source_ref_id, source]),
  );
  const factUsageClaims = contract.claims.filter(claim => claim.usage === 'fact');
  const factCandidates = factUsageClaims.filter(claim => (
    preparation.status === 'overlay_approved_read_only'
    && claim.claim_type === 'critical_fact'
    && claim.certainty === 'verified'
    && claimHasHumanVerifiedAuthoritativeSource(claim, sourceById)
    && input.entryCredibility.trim() !== '存疑'
  ));
  const factCandidateIds = factCandidates.map(claim => claim.claim_id);
  const factCandidateIdSet = new Set(factCandidateIds);
  const ungradedSourcePromotionCount = factUsageClaims.filter(claim => (
    claim.source_ref_ids.some(sourceRefId => sourceById.get(sourceRefId)?.grade === 'ungraded')
  )).length;
  const machineOnlySourcePromotionCount = factUsageClaims.filter(claim => (
    claim.source_ref_ids.length > 0
    && claim.source_ref_ids.every(sourceRefId => (
      sourceById.get(sourceRefId)?.verification_status === 'machine_mapped'
    ))
  )).length;
  const nonAuthoritativeSourcePromotionCount = factUsageClaims.filter(claim => (
    !claimHasHumanVerifiedAuthoritativeSource(claim, sourceById)
  )).length;
  const nonVerifiedClaimPromotionCount = factUsageClaims.filter(claim => (
    claim.certainty !== 'verified'
  )).length;
  const blockedClaimPromotionCount = contract.claims.filter(claim => (
    claim.usage === 'blocked' && factCandidateIdSet.has(claim.claim_id)
  )).length;
  const doubtfulEntryPromotedToFact = input.entryCredibility.trim() === '存疑'
    && factUsageClaims.length > 0;
  const structuredFactCountNotAboveReadyCount = factCandidateIds.length
    <= preparation.report.critical_fact_ready_count;
  const issues = [
    ...(ungradedSourcePromotionCount > 0
      ? ['ungraded_source_promoted_to_fact']
      : []),
    ...(machineOnlySourcePromotionCount > 0
      ? ['machine_only_source_promoted_to_fact']
      : []),
    ...(nonAuthoritativeSourcePromotionCount > 0
      ? ['non_authoritative_source_promoted_to_fact']
      : []),
    ...(nonVerifiedClaimPromotionCount > 0
      ? ['non_verified_claim_promoted_to_fact']
      : []),
    ...(blockedClaimPromotionCount > 0
      ? ['blocked_claim_promoted_to_fact']
      : []),
    ...(doubtfulEntryPromotedToFact
      ? ['doubtful_entry_promoted_to_fact']
      : []),
    ...(!structuredFactCountNotAboveReadyCount
      ? ['structured_fact_count_above_ready_count']
      : []),
  ];
  const status = issues.length > 0
    ? 'blocked'
    : factCandidateIds.length > 0
      ? 'safe_fact_candidates'
      : 'safe_no_fact_candidates';

  const shadow = StoryKnowledgeGenerationShadowV1Schema.parse({
    schema_version: 'story-knowledge-generation-shadow/v1',
    status,
    entry_name: preparation.entry_name,
    preparation_status: preparation.status,
    legacy_material_projection: {
      verified_fact_count: materialPack.verified_facts.length,
      uncertain_claim_count: materialPack.uncertain_claims.length,
    },
    contract_projection: {
      source_count: contract.sources.length,
      ungraded_source_count: contract.sources.filter(
        source => source.grade === 'ungraded',
      ).length,
      machine_mapped_source_count: contract.sources.filter(
        source => source.verification_status === 'machine_mapped',
      ).length,
      human_verified_authoritative_source_count: contract.sources.filter(
        isHumanVerifiedAuthoritativeSource,
      ).length,
      fact_candidate_claim_ids: factCandidateIds,
      bounded_context_claim_ids: contract.claims
        .filter(claim => claim.usage === 'bounded_context')
        .map(claim => claim.claim_id),
      blocked_claim_ids: contract.claims
        .filter(claim => claim.usage === 'blocked')
        .map(claim => claim.claim_id),
    },
    amplification_checks: {
      ungraded_source_promoted_to_fact_count: ungradedSourcePromotionCount,
      machine_only_source_promoted_to_fact_count: machineOnlySourcePromotionCount,
      non_authoritative_source_promoted_to_fact_count: nonAuthoritativeSourcePromotionCount,
      non_verified_claim_promoted_to_fact_count: nonVerifiedClaimPromotionCount,
      blocked_claim_promoted_to_fact_count: blockedClaimPromotionCount,
      doubtful_entry_promoted_to_fact: doubtfulEntryPromotedToFact,
      structured_fact_count_not_above_ready_count: structuredFactCountNotAboveReadyCount,
    },
    issues,
    boundary: {
      shadow_only: true,
      consumed_by_blueprint: false,
      consumed_by_prompt: false,
      consumed_by_fallback: false,
      persistence_allowed: false,
      generation_output_changed: false,
      generated_content_writeback_allowed: false,
      machine_validation_only: true,
      real_human_review_credit_granted: false,
    },
  });
  return deepFreeze(shadow);
}

function claimHasHumanVerifiedAuthoritativeSource(
  claim: StoryKnowledgeClaimV1,
  sourceById: ReadonlyMap<string, StoryKnowledgeSourceRefV1>,
): boolean {
  return claim.source_ref_ids.some(sourceRefId => {
    const source = sourceById.get(sourceRefId);
    return source ? isHumanVerifiedAuthoritativeSource(source) : false;
  });
}

function isHumanVerifiedAuthoritativeSource(
  source: StoryKnowledgeSourceRefV1,
): boolean {
  return source.verification_status === 'human_verified'
    && (source.grade === 'A' || source.grade === 'B');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
