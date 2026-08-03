import {
  StoryKnowledgeContractV1Schema,
  StoryKnowledgeEvidenceOverlayV1Schema,
} from '@shared/schemas.js';
import type {
  KnowledgeSupplementTask,
  MaterialSufficiencyStage,
  StoryKnowledgeContractV1,
  StoryKnowledgeEvidenceOverlayAssemblyV1,
  StoryKnowledgeEvidenceOverlayV1,
  StoryKnowledgeMissingMaterialCategoryV1,
  StoryKnowledgeMissingMaterialV1,
  StoryKnowledgeSupplementTaskProjectionV1,
} from '@shared/types.js';

export class StoryKnowledgeEvidenceOverlayReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryKnowledgeEvidenceOverlayReferenceError';
  }
}

export function assembleStoryKnowledgeContractWithEvidenceOverlay(
  baseContract: StoryKnowledgeContractV1,
  overlay: StoryKnowledgeEvidenceOverlayV1,
): StoryKnowledgeEvidenceOverlayAssemblyV1 {
  const contract = StoryKnowledgeContractV1Schema.parse(baseContract);
  const parsedOverlay = StoryKnowledgeEvidenceOverlayV1Schema.parse(overlay);
  validateStableReferences(contract, parsedOverlay);

  const sourceReviewById = new Map(
    parsedOverlay.source_reviews.map(review => [review.source_ref_id, review]),
  );
  const claimMappingById = new Map(
    parsedOverlay.claim_mappings.map(mapping => [mapping.claim_id, mapping]),
  );
  const sources = contract.sources.map(source => {
    const review = sourceReviewById.get(source.source_ref_id);
    if (!review) return source;
    const { verified_at: _previousVerifiedAt, ...sourceWithoutVerifiedAt } = source;
    return {
      ...sourceWithoutVerifiedAt,
      grade: review.grade,
      verification_status: review.verification_status,
      ...(review.verified_at ? { verified_at: review.verified_at } : {}),
      note: review.note,
    };
  });
  const claims = contract.claims.map(claim => {
    const mapping = claimMappingById.get(claim.claim_id);
    if (!mapping) return claim;
    const { last_verified_at: _previousVerifiedAt, ...claimWithoutVerifiedAt } = claim;
    return {
      ...claimWithoutVerifiedAt,
      source_ref_ids: [...mapping.source_ref_ids],
      claim_type: mapping.claim_type,
      certainty: mapping.certainty,
      usage: mapping.usage,
      scope: mapping.scope,
      ...(parsedOverlay.signoff.status === 'approved'
        ? { last_verified_at: parsedOverlay.signoff.reviewed_at }
        : {}),
    };
  });
  const sourceById = new Map(sources.map(source => [source.source_ref_id, source]));
  const eligibleCriticalFacts = claims.filter(claim => (
    claim.claim_type === 'critical_fact'
    && claim.certainty === 'verified'
    && claim.usage === 'fact'
    && claim.source_ref_ids.some(sourceRefId => {
      const source = sourceById.get(sourceRefId);
      return source?.verification_status === 'human_verified'
        && (source.grade === 'A' || source.grade === 'B');
    })
  ));
  const criticalFacts = claims.filter(claim => claim.claim_type === 'critical_fact');
  const mappedClaimIds = new Set(parsedOverlay.claim_mappings.map(mapping => mapping.claim_id));
  const claimLevelMappingComplete = claims
    .filter(claim => claim.usage !== 'blocked')
    .every(claim => mappedClaimIds.has(claim.claim_id) && claim.source_ref_ids.length > 0);
  const authoritativeSourcePresent = sources.some(source => (
    source.verification_status === 'human_verified'
    && (source.grade === 'A' || source.grade === 'B')
  ));
  const removableCategories = new Set<StoryKnowledgeMissingMaterialCategoryV1>();
  if (claimLevelMappingComplete) removableCategories.add('claim_level_source_mapping');
  if (authoritativeSourcePresent) removableCategories.add('authoritative_source');
  const removedMissingIds = contract.missing_material
    .filter(item => removableCategories.has(item.category))
    .map(item => item.missing_id);
  const missingMaterial = contract.missing_material
    .filter(item => !removableCategories.has(item.category));

  const assembledContract = StoryKnowledgeContractV1Schema.parse({
    ...contract,
    sources,
    claims,
    missing_material: missingMaterial,
    boundary: {
      ...contract.boundary,
      critical_facts_can_be_asserted: criticalFacts.length > 0
        && eligibleCriticalFacts.length === criticalFacts.length,
    },
  });
  const result: StoryKnowledgeEvidenceOverlayAssemblyV1 = {
    schema_version: 'story-knowledge-evidence-overlay-assembly/v1',
    overlay_id: parsedOverlay.overlay_id,
    entry_name: parsedOverlay.entry_name,
    contract: assembledContract,
    report: {
      source_review_count: parsedOverlay.source_reviews.length,
      claim_mapping_count: parsedOverlay.claim_mappings.length,
      human_verified_source_count: assembledContract.sources.filter(
        source => source.verification_status === 'human_verified',
      ).length,
      critical_fact_ready_count: eligibleCriticalFacts.length,
      removed_missing_ids: removedMissingIds,
      remaining_missing_count: assembledContract.missing_material.length,
    },
    boundary: {
      read_only_assembly: true,
      consumed_by_generation: false,
      source_markdown_writeback_allowed: false,
      existing_supplement_tasks_modified: false,
    },
  };
  return deepFreeze(result);
}

export function projectStoryKnowledgeMissingMaterialToSupplementTasks(
  contractInput: StoryKnowledgeContractV1,
  context: { projectionId: string; createdAt: string },
): StoryKnowledgeSupplementTaskProjectionV1 {
  const contract = StoryKnowledgeContractV1Schema.parse(contractInput);
  const projectionId = safeTaskIdPart(context.projectionId);
  const tasks = contract.missing_material.map((missing): KnowledgeSupplementTask => {
    const guidance = supplementGuidance(missing);
    return {
      task_id: `${projectionId}--story-knowledge--${safeTaskIdPart(missing.missing_id)}`,
      need_id: `story_knowledge_contract_${missing.missing_id}`,
      label: missing.label,
      description: `补齐 Story Knowledge Contract 缺口「${missing.label}」：${missing.reason}`,
      category: 'general',
      stage: guidance.stage,
      blocking_level: missing.blocking_level,
      affects: [...missing.affects],
      recommended_question: guidance.question,
      recommended_fields: guidance.fields,
      intake_prompt: `${guidance.question} 请保留来源、判断边界与待核实项。`,
      status: 'open',
      source: 'story_knowledge_contract_missing_material',
      created_at: context.createdAt,
    };
  });
  return deepFreeze({
    schema_version: 'story-knowledge-supplement-task-projection/v1',
    projection_id: context.projectionId,
    entry_name: contract.source_entry.name,
    task_count: tasks.length,
    tasks,
    boundary: {
      read_only_projection: true,
      persistence_allowed: false,
      existing_supplement_tasks_modified: false,
      generation_consumption_allowed: false,
    },
  });
}

function validateStableReferences(
  contract: StoryKnowledgeContractV1,
  overlay: StoryKnowledgeEvidenceOverlayV1,
): void {
  if (overlay.entry_name !== contract.source_entry.name) {
    throw new StoryKnowledgeEvidenceOverlayReferenceError(
      `entry_name mismatch: expected "${contract.source_entry.name}", received "${overlay.entry_name}"`,
    );
  }
  const sourceIds = new Set(contract.sources.map(source => source.source_ref_id));
  const claimIds = new Set(contract.claims.map(claim => claim.claim_id));
  for (const review of overlay.source_reviews) {
    if (!sourceIds.has(review.source_ref_id)) {
      throw new StoryKnowledgeEvidenceOverlayReferenceError(
        `unknown source_ref_id: ${review.source_ref_id}`,
      );
    }
  }
  for (const mapping of overlay.claim_mappings) {
    if (!claimIds.has(mapping.claim_id)) {
      throw new StoryKnowledgeEvidenceOverlayReferenceError(
        `unknown claim_id: ${mapping.claim_id}`,
      );
    }
    for (const sourceRefId of mapping.source_ref_ids) {
      if (!sourceIds.has(sourceRefId)) {
        throw new StoryKnowledgeEvidenceOverlayReferenceError(
          `unknown source_ref_id in claim mapping ${mapping.claim_id}: ${sourceRefId}`,
        );
      }
    }
  }
}

function supplementGuidance(missing: StoryKnowledgeMissingMaterialV1): {
  stage: MaterialSufficiencyStage;
  question: string;
  fields: string[];
} {
  switch (missing.category) {
    case 'claim_level_source_mapping':
      return {
        stage: 'minimum_viable_story',
        question: '每条 claim 分别由哪些来源支持，允许以何种确定性使用？',
        fields: ['claim_id', 'source_ref_id', 'claim_type', 'claim_certainty', 'claim_usage'],
      };
    case 'authoritative_source':
      return {
        stage: 'minimum_viable_story',
        question: '是否有可由事实与文化审核角色确认的 A/B 级权威来源？',
        fields: ['source_ref_id', 'source_citation', 'source_grade', 'reviewed_by', 'reviewed_at'],
      };
    case 'creative_affordance':
      return {
        stage: 'script_ready',
        question: '哪些目标、压力、选择、后果和可见事件可在事实边界内转化为叙事？',
        fields: [
          'character_goals',
          'pressures',
          'choices',
          'consequences',
          'visible_events',
          'forbidden_dramatization',
        ],
      };
    case 'production_material':
      return {
        stage: 'production_ready',
        question: '人物、空间路线、服化道、材料流程与环境声音还缺哪些可制作细节？',
        fields: [
          'characters',
          'costume_and_hair',
          'props',
          'spaces_and_routes',
          'materials_tools_and_process',
          'ambient_sound',
        ],
      };
    case 'rights_clearance':
      return {
        stage: 'production_ready',
        question: '人物、社区、场所、作品和拍摄素材分别需要哪些授权或许可？',
        fields: ['rights_holder', 'permission_scope', 'clearance_status', 'rights_clearance_notes'],
      };
  }
}

function safeTaskIdPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'projection';
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
