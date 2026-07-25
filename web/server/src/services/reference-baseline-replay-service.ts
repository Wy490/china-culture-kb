import type {
  ReferenceBaselineReplayDraft,
  StoryGenerateRequest,
  StoryGenerateResult,
} from '@shared/types.js';
import { getStory } from '../platform/story-read-service.js';
import { getChinaCultureFullEntryDetail } from '../domains/china-culture/knowledge-source-adapter.js';
import { resolveReferenceGenerationContext } from './reference-generation-bridge-service.js';

export type ReferenceBaselineReplaySourceMode =
  | 'knowledge_entry'
  | 'user_material';

type ReplayableBaseline = Pick<
  StoryGenerateResult,
  | 'storyId'
  | 'generation_type'
  | 'video_type'
  | 'presentation_style'
  | 'source_entry'
  | 'original_user_query'
  | 'model_profile_id'
  | 'generation_mode'
  | 'story_structure'
  | 'story_blueprint'
  | 'creation_use_case'
  | 'truth_mode'
  | 'client_type'
  | 'target_audience'
  | 'communication_goal'
  | 'reference_trace'
  | 'reference_safety_report'
  | 'quality_report'
  | 'adaptation_analysis'
>;

export class ReferenceBaselineReplayError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    readonly issueCode:
      | 'baseline_machine_quality_missing'
      | 'baseline_not_reference_free'
      | 'baseline_input_incomplete'
      | 'baseline_story_unavailable'
      | 'style_pack_selection_missing'
      | 'style_pack_incompatible',
  ) {
    super(message);
    this.name = 'ReferenceBaselineReplayError';
  }
}

export function validateReferenceBaselineReplaySource(
  baseline: ReplayableBaseline,
): void {
  if (!baseline.quality_report) {
    throw new ReferenceBaselineReplayError(
      'Reference baseline requires an available machine quality report',
      'baseline_machine_quality_missing',
    );
  }
  if (
    baseline.reference_safety_report?.application.applied_to_generation
    || baseline.reference_trace?.some(trace => (
      trace.application_status === 'external_prompt_injected'
    ))
  ) {
    throw new ReferenceBaselineReplayError(
      'Reference baseline must remain reference_free',
      'baseline_not_reference_free',
    );
  }
  if (
    !baseline.storyId
    || !baseline.source_entry
    || !baseline.model_profile_id
    || !baseline.story_structure
    || !baseline.story_blueprint?.central_event
    || !baseline.story_blueprint.target_duration
  ) {
    throw new ReferenceBaselineReplayError(
      'Reference baseline is missing required same-input replay fields',
      'baseline_input_incomplete',
    );
  }
}

export function buildReferenceBaselineReplayRequest(input: {
  baseline: ReplayableBaseline;
  stylePackIds: string[];
  sourceMode: ReferenceBaselineReplaySourceMode;
}): StoryGenerateRequest {
  validateReferenceBaselineReplaySource(input.baseline);
  const stylePackIds = [...new Set(input.stylePackIds)];
  if (!stylePackIds.length) {
    throw new ReferenceBaselineReplayError(
      'At least one approved style pack is required for reference-assisted replay',
      'style_pack_selection_missing',
    );
  }
  const baseline = input.baseline;
  const userMaterial = input.sourceMode === 'user_material';
  if (userMaterial && !baseline.original_user_query?.trim()) {
    throw new ReferenceBaselineReplayError(
      'User-material baseline is missing its original input',
      'baseline_input_incomplete',
    );
  }

  return {
    entry_name: userMaterial ? undefined : baseline.source_entry,
    outline: userMaterial ? baseline.original_user_query : undefined,
    original_user_query: baseline.original_user_query,
    generation_type: baseline.generation_type,
    video_type: baseline.video_type,
    model_profile_id: baseline.model_profile_id,
    generation_fallback_policy: baseline.generation_mode === 'external_model'
      ? 'forbid_local_fallback'
      : 'allow_local_fallback',
    selected_event: baseline.story_blueprint?.central_event,
    target_video_duration: baseline.story_blueprint?.target_duration,
    presentation_style: baseline.presentation_style,
    output_gears_segments: true,
    creation_use_case: baseline.creation_use_case,
    truth_mode: baseline.truth_mode,
    client_type: baseline.client_type,
    target_audience: baseline.target_audience,
    communication_goal: baseline.communication_goal,
    story_structure: baseline.story_structure,
    source_material_mode: baseline.adaptation_analysis
      ? 'adapt_user_novel'
      : 'generate_from_knowledge',
    style_pack_ids: stylePackIds,
    reference_baseline_story_id: baseline.storyId,
  };
}

export async function createReferenceBaselineReplayDraft(input: {
  repoRoot: string;
  baselineStoryId: string;
  stylePackIds: string[];
}): Promise<ReferenceBaselineReplayDraft> {
  const baselineResult = await getStory(input.baselineStoryId);
  if (!baselineResult.ok || !baselineResult.data) {
    throw new ReferenceBaselineReplayError(
      `Reference baseline story "${input.baselineStoryId}" is unavailable`,
      'baseline_story_unavailable',
    );
  }
  const baseline = baselineResult.data;
  validateReferenceBaselineReplaySource(baseline);

  const sourceMode: ReferenceBaselineReplaySourceMode =
    await getChinaCultureFullEntryDetail(baseline.source_entry)
      ? 'knowledge_entry'
      : 'user_material';
  const referenceContext = await resolveReferenceGenerationContext({
    repoRoot: input.repoRoot,
    stylePackIds: input.stylePackIds,
    videoType: baseline.video_type,
    presentationStyle: baseline.presentation_style,
    storyStructure: baseline.story_structure!,
  });
  if (!referenceContext.ok) {
    throw new ReferenceBaselineReplayError(
      referenceContext.message,
      'style_pack_incompatible',
    );
  }

  const generationRequest = buildReferenceBaselineReplayRequest({
    baseline,
    stylePackIds: input.stylePackIds,
    sourceMode,
  });
  return {
    schema_version: 'reference-baseline-replay-draft/v1',
    baseline_story_id: baseline.storyId,
    style_pack_ids: [...input.stylePackIds],
    generation_request: generationRequest,
    baseline_summary: {
      title: baseline.title,
      source_entry: baseline.source_entry,
      video_type: baseline.video_type,
      presentation_style: baseline.presentation_style,
      story_structure: baseline.story_structure!,
      model_profile_id: baseline.model_profile_id!,
      source_mode: sourceMode,
    },
    no_generation_performed: true,
    same_input_server_revalidation_required: true,
    machine_comparison_only: true,
    real_credit_granted: false,
  };
}
