import { createHash } from 'node:crypto';
import { StoryKnowledgePromptShadowComparisonV1Schema } from '@shared/schemas.js';
import type {
  KnowledgePack,
  MaterialPack,
  StoryBlueprint,
  StoryKnowledgeGenerationShadowV1,
  StoryKnowledgePreparationV1,
  StoryKnowledgePromptShadowComparisonV1,
} from '@shared/types.js';
import type { StoryGenerationPromptPackage } from '../../services/story-generation-prompt.js';

export function projectStoryKnowledgeFactCandidatesToMaterialPack(input: {
  preparation: StoryKnowledgePreparationV1;
  generationShadow: StoryKnowledgeGenerationShadowV1;
  activeMaterialPack: MaterialPack;
}): MaterialPack | undefined {
  if (input.generationShadow.status !== 'safe_fact_candidates') return undefined;
  const claimById = new Map(
    input.preparation.contract.claims.map(claim => [claim.claim_id, claim]),
  );
  const factTexts = input.generationShadow.contract_projection.fact_candidate_claim_ids
    .map(claimId => claimById.get(claimId)?.text.trim())
    .filter((text): text is string => Boolean(text));
  if (
    factTexts.length
    !== input.generationShadow.contract_projection.fact_candidate_claim_ids.length
  ) {
    return undefined;
  }
  return deepFreeze({
    ...structuredClone(input.activeMaterialPack),
    verified_facts: uniqueText([
      ...input.activeMaterialPack.verified_facts,
      ...factTexts,
    ]),
  });
}

export function buildStoryKnowledgePromptShadowComparison(input: {
  preparation: StoryKnowledgePreparationV1;
  generationShadow: StoryKnowledgeGenerationShadowV1;
  activeGenerationInputs: {
    knowledge_pack: KnowledgePack;
    material_pack: MaterialPack;
    story_blueprint: StoryBlueprint;
  };
  activePromptPackage: StoryGenerationPromptPackage;
  shadowMaterialPack?: MaterialPack;
  shadowPromptPackage?: StoryGenerationPromptPackage;
}): StoryKnowledgePromptShadowComparisonV1 {
  const candidateClaimIds = [
    ...input.generationShadow.contract_projection.fact_candidate_claim_ids,
  ];
  const missingCandidateArtifacts = input.generationShadow.status === 'safe_fact_candidates'
    && (!input.shadowMaterialPack || !input.shadowPromptPackage);
  const issues = uniqueText([
    ...input.generationShadow.issues,
    ...(missingCandidateArtifacts ? ['shadow_candidate_projection_incomplete'] : []),
  ]);
  const status = input.generationShadow.status === 'blocked' || missingCandidateArtifacts
    ? 'blocked'
    : input.generationShadow.status === 'safe_fact_candidates'
      ? 'candidate_ready'
      : 'safe_no_candidate';
  const shadowGenerationInputs = status === 'candidate_ready'
    ? {
      ...input.activeGenerationInputs,
      material_pack: input.shadowMaterialPack!,
    }
    : undefined;
  const activeGenerationInputsSha256 = hashStoryKnowledgeShadowArtifact(
    input.activeGenerationInputs,
  );
  const activePromptPackageSha256 = hashStoryKnowledgeShadowArtifact(
    input.activePromptPackage,
  );

  return deepFreeze(StoryKnowledgePromptShadowComparisonV1Schema.parse({
    schema_version: 'story-knowledge-prompt-shadow-comparison/v1',
    status,
    preparation_status: input.preparation.status,
    fact_candidate_claim_ids: candidateClaimIds,
    active_generation_inputs_sha256: activeGenerationInputsSha256,
    ...(shadowGenerationInputs
      ? { shadow_generation_inputs_sha256: hashStoryKnowledgeShadowArtifact(shadowGenerationInputs) }
      : {}),
    active_prompt_package_sha256: activePromptPackageSha256,
    ...(status === 'candidate_ready'
      ? { shadow_prompt_package_sha256: hashStoryKnowledgeShadowArtifact(input.shadowPromptPackage!) }
      : {}),
    execution_prompt_package_sha256: activePromptPackageSha256,
    changed_generation_input_paths: shadowGenerationInputs
      ? diffPaths(input.activeGenerationInputs, shadowGenerationInputs)
      : [],
    changed_prompt_package_paths: status === 'candidate_ready'
      ? diffPaths(input.activePromptPackage, input.shadowPromptPackage!)
      : [],
    issues,
    boundary: {
      comparison_only: true,
      active_prompt_preserved_for_execution: true,
      shadow_prompt_executed: false,
      shadow_prompt_persisted: false,
      generation_output_changed: false,
      source_markdown_writeback_allowed: false,
      machine_validation_only: true,
      real_human_review_credit_granted: false,
      production_credit_granted: false,
    },
  }));
}

export function hashStoryKnowledgeShadowArtifact(value: unknown): string {
  const encoded = JSON.stringify(canonicalize(value));
  return createHash('sha256').update(encoded ?? 'undefined').digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

function diffPaths(left: unknown, right: unknown, path = ''): string[] {
  if (
    hashStoryKnowledgeShadowArtifact(left)
    === hashStoryKnowledgeShadowArtifact(right)
  ) return [];
  if (Array.isArray(left) || Array.isArray(right)) return path ? [path] : ['$'];
  if (isRecord(left) && isRecord(right)) {
    return [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .sort()
      .flatMap(key => diffPaths(
        left[key],
        right[key],
        path ? `${path}.${key}` : key,
      ));
  }
  return path ? [path] : ['$'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
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
