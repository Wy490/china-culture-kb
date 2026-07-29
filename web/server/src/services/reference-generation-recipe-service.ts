import { createHash } from 'node:crypto';
import {
  REFERENCE_GENERATION_RECIPES,
  buildReferenceGenerationRecipeContract,
  referenceGenerationRecipePayload,
} from '@shared/reference-generation-recipes.js';
import type {
  PresentationStyle,
  ReferenceGenerationRecipeContract,
  StoryGenerateRequest,
  VideoType,
} from '@shared/types.js';

export type ReferenceGenerationRecipeContractIssueCode =
  | 'unknown_recipe_id'
  | 'recipe_contract_tampered'
  | 'recipe_video_type_incompatible'
  | 'recipe_presentation_style_incompatible';

export type ReferenceGenerationRecipeContractResolution =
  | {
      ok: true;
      contract?: ReferenceGenerationRecipeContract;
      context?: ReferenceGenerationRecipeContract;
    }
  | {
      ok: false;
      issue_code: ReferenceGenerationRecipeContractIssueCode;
      message: string;
      details: {
        schema_version: 'reference-generation-recipe-gate/v1';
        issue_code: ReferenceGenerationRecipeContractIssueCode;
        recipe_id: string;
        expected_video_type?: VideoType;
        received_video_type?: VideoType;
        expected_presentation_style?: PresentationStyle;
        received_presentation_style?: PresentationStyle;
      };
    };

function payloadSha256(
  contract: Omit<ReferenceGenerationRecipeContract, 'payload_sha256'>,
): string {
  return createHash('sha256')
    .update(JSON.stringify(contract), 'utf8')
    .digest('hex');
}

function failResolution(
  issueCode: ReferenceGenerationRecipeContractIssueCode,
  message: string,
  recipeId: string,
  details: Omit<
    Extract<ReferenceGenerationRecipeContractResolution, { ok: false }>['details'],
    'schema_version' | 'issue_code' | 'recipe_id'
  > = {},
): Extract<ReferenceGenerationRecipeContractResolution, { ok: false }> {
  return {
    ok: false,
    issue_code: issueCode,
    message,
    details: {
      schema_version: 'reference-generation-recipe-gate/v1',
      issue_code: issueCode,
      recipe_id: recipeId,
      ...details,
    },
  };
}

export function resolveReferenceGenerationRecipeContract(input: {
  request: StoryGenerateRequest;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
}): ReferenceGenerationRecipeContractResolution {
  const submitted = input.request.reference_generation_recipe;
  if (!submitted) return { ok: true };

  const recipe = REFERENCE_GENERATION_RECIPES.find(
    item => item.id === submitted.recipe_id,
  );
  if (!recipe) {
    return failResolution(
      'unknown_recipe_id',
      `Unknown reference generation recipe "${String(submitted.recipe_id)}"`,
      String(submitted.recipe_id),
    );
  }

  const canonical = buildReferenceGenerationRecipeContract(recipe.id);
  const canonicalPayload = referenceGenerationRecipePayload(recipe);
  const canonicalPayloadSha256 = payloadSha256(canonicalPayload);
  const submittedPayload = {
    schema_version: submitted.schema_version,
    recipe_id: submitted.recipe_id,
    recipe_version: submitted.recipe_version,
    reusable_mechanisms: submitted.reusable_mechanisms,
    avoid_copying: submitted.avoid_copying,
  };
  const submittedMatchesCanonical = JSON.stringify(submittedPayload)
    === JSON.stringify(canonicalPayload)
    && submitted.payload_sha256 === canonical.payload_sha256
    && submitted.payload_sha256 === canonicalPayloadSha256;
  if (!submittedMatchesCanonical) {
    return failResolution(
      'recipe_contract_tampered',
      `Reference generation recipe "${recipe.id}" does not match the canonical catalog snapshot`,
      recipe.id,
    );
  }

  if (input.videoType !== recipe.video_type) {
    return failResolution(
      'recipe_video_type_incompatible',
      `Reference generation recipe "${recipe.id}" requires video_type "${recipe.video_type}"`,
      recipe.id,
      {
        expected_video_type: recipe.video_type,
        received_video_type: input.videoType,
      },
    );
  }

  if (input.presentationStyle !== recipe.presentation_style) {
    return failResolution(
      'recipe_presentation_style_incompatible',
      `Reference generation recipe "${recipe.id}" requires presentation_style "${recipe.presentation_style}"`,
      recipe.id,
      {
        expected_presentation_style: recipe.presentation_style,
        received_presentation_style: input.presentationStyle,
      },
    );
  }

  return {
    ok: true,
    contract: canonical,
    context: canonical,
  };
}
