import { ErrorCodes } from '@shared/types.js';
import {
  StoryKnowledgeMigrationDecisionV1Schema,
  StoryKnowledgePromptShadowCanaryV1Schema,
} from '@shared/schemas.js';
import type {
  ErrorCode,
  StoryKnowledgeMigrationDecisionV1,
  StoryKnowledgePromptShadowCanaryRequestV1,
  StoryKnowledgePromptShadowCanaryV1,
} from '@shared/types.js';
import {
  prepareChinaCultureStoryGeneration,
} from './story-generation-preparation-service.js';
import { generateChinaCultureLocalStoryAssembly } from './story-local-generation-service.js';
import {
  buildPreparedStoryKnowledgePromptShadow,
  hashStoryKnowledgeShadowArtifact,
} from './story-knowledge-prompt-shadow-service.js';

export async function runStoryKnowledgePromptShadowCanary(
  request: StoryKnowledgePromptShadowCanaryRequestV1,
): Promise<
  | { ok: true; data: StoryKnowledgePromptShadowCanaryV1 }
  | { ok: false; code: ErrorCode; message: string; details?: unknown }
> {
  const preparation = await prepareChinaCultureStoryGeneration(
    request.generation_request,
    {
      storyKnowledge: {
        enabled: true,
        generationShadow: true,
        ...(request.evidence_overlay !== undefined
          ? { evidenceOverlay: request.evidence_overlay }
          : {}),
      },
    },
  );
  if (!preparation.ok) return preparation;

  const localContext = generateChinaCultureLocalStoryAssembly({
    entry: preparation.entry,
    centralEvent: preparation.centralEvent,
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
    storyStructure: preparation.storyStructure,
    targetDuration: preparation.targetDuration,
    tone: preparation.localTone,
    knowledgePack: preparation.knowledgePackToUse,
    originalUserQuery: request.generation_request.original_user_query
      ?? request.generation_request.outline,
    adaptationAnalysis: preparation.adaptationAnalysis,
    genreComposition: preparation.genreComposition,
  });
  if (!localContext.ok) {
    return {
      ok: false,
      code: ErrorCodes.VALIDATION_ERROR,
      message: localContext.message,
      details: {
        schema_version: 'story-knowledge-prompt-shadow-canary-gate/v1',
        reason: localContext.reason,
      },
    };
  }

  const promptShadow = buildPreparedStoryKnowledgePromptShadow({
    request: request.generation_request,
    preparation,
    memoryMosaicSeed: localContext.memoryMosaicSeed,
  });
  if (
    !preparation.storyKnowledgeGenerationShadow
    || !promptShadow.comparison
  ) {
    return {
      ok: false,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Story knowledge prompt shadow artifacts were not prepared',
      details: {
        schema_version: 'story-knowledge-prompt-shadow-canary-gate/v1',
        reason: 'shadow_artifacts_unavailable',
      },
    };
  }

  const migrationDecision = buildStoryKnowledgeMigrationDecision({
    generationShadow: preparation.storyKnowledgeGenerationShadow,
    promptShadow: promptShadow.comparison,
  });
  const data = StoryKnowledgePromptShadowCanaryV1Schema.parse({
    schema_version: 'story-knowledge-prompt-shadow-canary/v1',
    canary_status: 'evaluated',
    request_sha256: hashStoryKnowledgeShadowArtifact(request),
    entry_name: preparation.primaryEntryName,
    generation_shadow: preparation.storyKnowledgeGenerationShadow,
    prompt_shadow_comparison: promptShadow.comparison,
    migration_decision: migrationDecision,
    boundary: {
      restricted_operator_entry: true,
      read_only: true,
      adapter_invoked: false,
      external_model_called: false,
      local_generation_computed_in_memory: true,
      local_generation_output_discarded: true,
      local_story_result_returned: false,
      prompt_text_returned: false,
      shadow_prompt_executed: false,
      story_persisted: false,
      project_persisted: false,
      source_markdown_written: false,
      formal_generation_consumption_allowed: false,
      real_human_review_credit_granted: false,
      production_credit_granted: false,
    },
  });
  return { ok: true, data };
}

function buildStoryKnowledgeMigrationDecision(input: {
  generationShadow: StoryKnowledgePromptShadowCanaryV1['generation_shadow'];
  promptShadow: StoryKnowledgePromptShadowCanaryV1['prompt_shadow_comparison'];
}): StoryKnowledgeMigrationDecisionV1 {
  const candidateReady = input.promptShadow.status === 'candidate_ready';
  const blockers = uniqueText([
    ...(!candidateReady ? ['prompt_shadow_candidate_not_ready'] : []),
    ...input.promptShadow.issues.map(issue => `prompt_shadow:${issue}`),
    'real_human_review_attestation_unavailable',
    'independent_migration_approval_unavailable',
    'production_canary_not_executed',
  ]);
  return StoryKnowledgeMigrationDecisionV1Schema.parse({
    schema_version: 'story-knowledge-migration-decision/v1',
    decision: candidateReady ? 'eligible_for_operator_review' : 'remain_shadow',
    formal_consumption_blockers: blockers,
    summary: {
      preparation_status: input.promptShadow.preparation_status,
      generation_shadow_status: input.generationShadow.status,
      prompt_shadow_status: input.promptShadow.status,
      fact_candidate_count: input.promptShadow.fact_candidate_claim_ids.length,
    },
    boundary: {
      operator_review_only: true,
      formal_consumption_allowed: false,
      activation_performed: false,
      rollback_required: false,
      persistence_allowed: false,
      real_human_review_credit_granted: false,
      production_credit_granted: false,
    },
  });
}

function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
