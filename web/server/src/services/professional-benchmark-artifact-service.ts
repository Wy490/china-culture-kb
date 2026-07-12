import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { VideoTypeSchema } from '@shared/schemas.js';

export type ProfessionalBenchmarkArtifactKind =
  | 'prompt_package'
  | 'provider_receipt'
  | 'initial_story'
  | 'character_evidence'
  | 'initial_professional_package'
  | 'quality_report'
  | 'revision_plan'
  | 'revision_output'
  | 'final_professional_package'
  | 'final_quality_report'
  | 'usage_and_cost'
  | 'human_blind_review';

export type ProfessionalBenchmarkArtifactProducer =
  | 'runner'
  | 'model'
  | 'agent'
  | 'human_reviewer'
  | 'system';

export interface ProfessionalBenchmarkArtifactReference {
  artifact_id: string;
  kind: ProfessionalBenchmarkArtifactKind;
  relative_path: string;
  sha256: string;
  byte_size: number;
  payload_schema_version: string;
  created_at: string;
  producer: ProfessionalBenchmarkArtifactProducer;
  parent_artifact_sha256: string[];
}

export interface ProfessionalBenchmarkArtifactEnvelope {
  schema_version: 'professional-benchmark-artifact-envelope/v1';
  artifact_id: string;
  benchmark_id: string;
  run_id: string;
  artifact_kind: ProfessionalBenchmarkArtifactKind;
  payload_schema_version: string;
  created_at: string;
  producer: ProfessionalBenchmarkArtifactProducer;
  parent_artifact_sha256: string[];
  payload: unknown;
}

/**
 * `integrity_valid` covers the on-disk bytes, identities and immutable DAG.
 * `contract_valid` additionally covers the fixed profile and kind-specific payload contracts.
 * This validator can never award professional quality credit.
 */
export interface ProfessionalBenchmarkArtifactValidation {
  integrity_valid: boolean;
  contract_valid: boolean;
  professional_passed: false;
  verified_artifact_count: number;
  blockers: string[];
}

export type ProfessionalBenchmarkArtifactValidationProfile = 'initial_run' | 'professional_completion';

/**
 * The run ledger uses internal names while execution is in flight. Persistent evidence must be
 * normalized to this completion taxonomy before artifact validation; the mapping does not imply
 * that an internal ledger entry is already durable evidence.
 */
export const PROFESSIONAL_BENCHMARK_PERSISTED_ARTIFACT_TAXONOMY = {
  adapter_envelope: 'provider_receipt',
  final_quality_evaluation: 'final_quality_report',
  model_usage_and_cost: 'usage_and_cost',
} as const;

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const HashSchema = z.string().regex(HASH_PATTERN);
const NonEmptyStringSchema = z.string().trim().min(1);
const TimestampSchema = z.string().datetime({ offset: true });
const ProducerSchema = z.enum(['runner', 'model', 'agent', 'human_reviewer', 'system']);
const ArtifactKindSchema = z.enum([
  'prompt_package',
  'provider_receipt',
  'initial_story',
  'character_evidence',
  'initial_professional_package',
  'quality_report',
  'revision_plan',
  'revision_output',
  'final_professional_package',
  'final_quality_report',
  'usage_and_cost',
  'human_blind_review',
]);
const ProfileSchema = z.enum(['initial_run', 'professional_completion']);
const RESERVED_PROVENANCE_FIELDS = new Set([
  'credit_eligible',
  'execution_kind',
  'generation_mode',
  'provider',
  'used_fallback',
]);

function addReservedFieldIssue(
  value: Record<string, unknown>,
  context: z.RefinementCtx,
): void {
  const reserved = Object.keys(value).find(key =>
    key === 'professional_passed' || RESERVED_PROVENANCE_FIELDS.has(key)
  );
  if (reserved) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: [reserved], message: 'reserved_field_not_allowed' });
  }
}

const SceneIdSchema = z.union([NonEmptyStringSchema, z.number().int().nonnegative()]);
const StorySceneSchema = z.object({
  scene_id: SceneIdSchema,
  title: NonEmptyStringSchema.optional(),
  location: NonEmptyStringSchema.optional(),
  key_action: NonEmptyStringSchema.optional(),
  plot: NonEmptyStringSchema.optional(),
  summary: NonEmptyStringSchema.optional(),
}).passthrough().superRefine((scene, context) => {
  addReservedFieldIssue(scene, context);
  if (!scene.key_action && !scene.plot && !scene.summary) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'scene_requires_observable_action_or_summary' });
  }
});

const BenchmarkStorySceneSchema = z.object({
  scene_id: z.number().int().positive(),
  title: NonEmptyStringSchema,
  duration_sec: z.number().finite().positive(),
  location: NonEmptyStringSchema,
  time_of_day: NonEmptyStringSchema,
  dramatic_function: NonEmptyStringSchema,
  plot: NonEmptyStringSchema,
  key_action: NonEmptyStringSchema,
  characters: z.array(NonEmptyStringSchema).min(1),
  visual_prompt: NonEmptyStringSchema,
  camera_suggestion: NonEmptyStringSchema,
  cultural_note: NonEmptyStringSchema,
  conflict: NonEmptyStringSchema,
  dialogue_or_narration: NonEmptyStringSchema,
  source_entries: z.array(NonEmptyStringSchema).min(1),
  factual_basis: NonEmptyStringSchema,
  fictionalized_elements: z.array(NonEmptyStringSchema).min(1),
}).strict().superRefine((scene, context) => {
  addReservedFieldIssue(scene, context);
});

const PromptPackagePayloadSchema = z.object({
  schema_version: z.literal('character-story-professional-benchmark-prompt/v2'),
  benchmark_id: NonEmptyStringSchema,
  video_type: z.literal('character_story'),
  benchmark_prompt_version: z.literal('character-story-professional-benchmark/v2'),
  story_generation_prompt_version: z.literal('story-generation/v1'),
  source_snapshot_sha256: HashSchema,
  benchmark_instruction_sha256: HashSchema,
  base_story_prompt_sha256: HashSchema,
  story_blueprint: z.record(z.string(), z.unknown()),
  story_generation_prompt: z.object({
    prompt_version: z.literal('story-generation/v1'),
    system_prompt: NonEmptyStringSchema,
    user_prompt: NonEmptyStringSchema,
    output_contract: z.object({
      must_provide: z.array(NonEmptyStringSchema).min(1),
      should_respect: z.array(NonEmptyStringSchema).min(1),
      return_json_fields: z.array(NonEmptyStringSchema).min(1),
    }).passthrough(),
  }).passthrough(),
  story_scene_output_contract: z.object({
    schema_version: z.literal('character-story-professional-scene/v1'),
    root_field: z.literal('story.scene_breakdown[]'),
    required_fields: z.array(NonEmptyStringSchema).min(17),
    constraints: z.record(z.string(), z.unknown()),
    json_shape: z.record(z.string(), z.unknown()),
  }).strict(),
  character_evidence_output_contract: z.object({
    schema_version: z.literal('character-story-professional-evidence/v1'),
    required_fields: z.array(NonEmptyStringSchema).min(11),
    constraints: z.record(z.string(), z.unknown()),
  }).passthrough(),
  prompt_sha256: HashSchema,
  professional_passed: z.literal(false),
}).passthrough();

const ProviderReceiptPayloadSchema = z.object({
  schema_version: z.literal('professional-benchmark-provider-receipt/v1'),
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  provider: z.enum(['claude_cli', 'codex_cli']),
  runtime: z.enum(['claude', 'codex']),
  requested_model_id: NonEmptyStringSchema,
  reported_model_id: NonEmptyStringSchema,
  prompt_sha256: HashSchema,
  provider_response_sha256: HashSchema,
  bridge_envelope_sha256: HashSchema,
  story_sha256: HashSchema,
  character_evidence_sha256: HashSchema,
  used_fallback: z.literal(false),
  provenance_complete: z.literal(true),
  exit_code: z.literal(0),
  cli_realpath: NonEmptyStringSchema.refine(value => path.isAbsolute(value), 'cli_realpath_not_absolute'),
  cli_sha256: HashSchema,
  cli_version: NonEmptyStringSchema,
  operator_authorization: z.object({
    reference_sha256: HashSchema,
    budget_cap: z.object({
      amount: z.number().finite().positive(),
      currency: z.string().regex(/^[A-Z]{3}$/),
    }).strict(),
  }).strict(),
  started_at: TimestampSchema,
  finished_at: TimestampSchema,
}).strict().superRefine((receipt, context) => {
  for (const reserved of ['professional_passed', 'credit_eligible', 'generation_mode'] as const) {
    if (reserved in receipt) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [reserved], message: 'reserved_field_not_allowed' });
    }
  }
  if (receipt.provider !== `${receipt.runtime}_cli`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['provider'], message: 'provider_runtime_mismatch' });
  }
  if (!modelMatchesExpected(receipt.reported_model_id, receipt.requested_model_id)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['reported_model_id'], message: 'model_mismatch' });
  }
  if (Date.parse(receipt.finished_at) < Date.parse(receipt.started_at)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['finished_at'], message: 'time_order_invalid' });
  }
});

function modelMatchesExpected(reported: string, expected: string): boolean {
  const normalizedReported = reported.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();
  if (normalizedReported === normalizedExpected) return true;
  const controlledAliases: Partial<Record<string, RegExp>> = {
    opus: /^claude-opus-\d+(?:-\d+)*$/,
    sonnet: /^claude-sonnet-\d+(?:-\d+)*$/,
    haiku: /^claude-haiku-\d+(?:-\d+)*$/,
  };
  return controlledAliases[normalizedExpected]?.test(normalizedReported) ?? false;
}

const InitialStoryPayloadSchema = z.object({
  schema_version: z.literal('professional-benchmark-initial-story/v2'),
  title: NonEmptyStringSchema,
  logline: NonEmptyStringSchema,
  theme: NonEmptyStringSchema,
  full_text: NonEmptyStringSchema,
  scene_breakdown: z.array(BenchmarkStorySceneSchema).min(1),
  cultural_constraints: z.array(NonEmptyStringSchema),
  credibility_note: NonEmptyStringSchema,
}).strict().superRefine((story, context) => {
  addReservedFieldIssue(story, context);
  const sceneIds = story.scene_breakdown.map(scene => String(scene.scene_id));
  if (new Set(sceneIds).size !== sceneIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['scene_breakdown'], message: 'duplicate_scene_id' });
  }
});

const CharacterEvidencePayloadSchema = z.object({
  schema_version: z.literal('character-story-professional-evidence/v1'),
  protagonist: NonEmptyStringSchema,
  goal: NonEmptyStringSchema,
  resistance: NonEmptyStringSchema,
  choice: NonEmptyStringSchema,
  cost: NonEmptyStringSchema,
  starting_relationship_state: NonEmptyStringSchema,
  ending_relationship_state: NonEmptyStringSchema,
  internal_change: NonEmptyStringSchema,
  dialogue_voice_rules: z.array(NonEmptyStringSchema).min(2),
  subtext_strategy: NonEmptyStringSchema,
  scene_turns: z.record(z.string().min(1), NonEmptyStringSchema).refine(
    value => Object.keys(value).length > 0,
    'scene_turns_empty',
  ),
}).strict().refine(
  evidence => evidence.starting_relationship_state !== evidence.ending_relationship_state,
  { path: ['ending_relationship_state'], message: 'relationship_state_unchanged' },
);

const ProfessionalTextPackagePayloadSchema = z.object({
  schema_version: z.literal('professional-text-package/v1'),
  package_id: NonEmptyStringSchema,
  video_type: z.literal('character_story'),
  status: NonEmptyStringSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  contract_version: NonEmptyStringSchema,
  creative_brief: z.object({
    target_audience: NonEmptyStringSchema,
    platform: NonEmptyStringSchema,
    target_duration: NonEmptyStringSchema,
    communication_goal: NonEmptyStringSchema,
  }).passthrough(),
  truth_and_adaptation_contract: z.object({
    truth_mode: NonEmptyStringSchema,
    verified_facts: z.array(z.unknown()),
    plausible_dramatizations: z.array(z.unknown()),
    fictional_additions: z.array(z.unknown()),
    unknown_or_forbidden_claims: z.array(z.unknown()),
  }).passthrough(),
  audience_promise: NonEmptyStringSchema,
  premise_or_core_question: NonEmptyStringSchema,
  theme_statement: NonEmptyStringSchema,
  scene_breakdown: z.array(StorySceneSchema).min(1),
  full_text: NonEmptyStringSchema,
  quality_report: z.object({
    status: NonEmptyStringSchema,
    dimensions: z.array(z.unknown()).min(1),
    hard_gate_failures: z.array(z.string()),
    professional_passed: z.literal(false),
  }).passthrough(),
  delivery_text_package: z.object({
    script_text: NonEmptyStringSchema,
    scene_units: z.array(z.unknown()).min(1),
    validation_notes: z.array(z.string()),
  }).passthrough(),
}).passthrough().superRefine((professionalPackage, context) => {
  addReservedFieldIssue(professionalPackage, context);
});

const QualityDimensionIdSchema = z.enum([
  'creative_brief_and_audience_promise',
  'premise_and_theme_unity',
  'structure_causality_and_pacing',
  'character_agency_and_relationship_change',
  'scene_function_visible_action_and_blocking',
  'dialogue_narration_and_subtext',
  'emotional_curve_and_aftertaste',
  'cultural_fact_and_adaptation_boundary',
  'production_executability',
  'originality_and_distinctiveness',
]);

const QualityDimensionScoresSchema = z.object({
  creative_brief_and_audience_promise: z.number().finite().min(0).max(100),
  premise_and_theme_unity: z.number().finite().min(0).max(100),
  structure_causality_and_pacing: z.number().finite().min(0).max(100),
  character_agency_and_relationship_change: z.number().finite().min(0).max(100),
  scene_function_visible_action_and_blocking: z.number().finite().min(0).max(100),
  dialogue_narration_and_subtext: z.number().finite().min(0).max(100),
  emotional_curve_and_aftertaste: z.number().finite().min(0).max(100),
  cultural_fact_and_adaptation_boundary: z.number().finite().min(0).max(100),
  production_executability: z.number().finite().min(0).max(100),
  originality_and_distinctiveness: z.number().finite().min(0).max(100),
}).strict();

const QualityReportPayloadSchema = z.object({
  schema_version: z.literal('professional-text-quality-report/v1'),
  status: z.enum(['failed', 'production_candidate', 'professional_candidate', 'high_quality_candidate']),
  total_score: z.number().finite().min(0).max(100),
  dimensions: z.array(z.object({
    dimension_id: QualityDimensionIdSchema,
    weight: z.number().finite().positive(),
    score: z.number().finite().min(0).max(100),
    evidence: z.array(NonEmptyStringSchema),
    issues: z.array(NonEmptyStringSchema),
  }).strict()).length(10),
  hard_gate_failures: z.array(NonEmptyStringSchema),
  evaluator_notes: z.array(NonEmptyStringSchema).min(1),
  professional_passed: z.literal(false),
}).strict().superRefine((report, context) => {
  const ids = report.dimensions.map(dimension => dimension.dimension_id);
  if (new Set(ids).size !== 10) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dimensions'], message: 'dimensions_not_unique' });
  }
  const totalWeight = report.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.001) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dimensions'], message: 'dimension_weights_not_100' });
  }
});

const FinalQualityReportPayloadSchema = z.object({
  schema_version: z.literal('professional-benchmark-quality-snapshot/v1'),
  package_sha256: HashSchema,
  total_score: z.number().finite().min(0).max(100),
  dimension_scores: QualityDimensionScoresSchema,
  hard_gate_failures: z.array(NonEmptyStringSchema),
  evaluator_id: NonEmptyStringSchema,
  evaluator_version: NonEmptyStringSchema,
  measured_at: TimestampSchema,
}).strict().superRefine((report, context) => {
  addReservedFieldIssue(report, context);
});

const RevisionPlanPayloadSchema = z.object({
  schema_version: z.literal('professional-text-revision-plan/v1'),
  package_id: NonEmptyStringSchema,
  video_type: z.literal('character_story'),
  action_count: z.number().int().nonnegative(),
  deterministic_action_count: z.number().int().nonnegative(),
  model_rewrite_action_count: z.number().int().nonnegative(),
  human_evidence_action_count: z.number().int().nonnegative(),
  actions: z.array(z.object({
    action_id: NonEmptyStringSchema,
    issue_id: NonEmptyStringSchema,
    instruction: NonEmptyStringSchema,
    target_sections: z.array(NonEmptyStringSchema).min(1),
    repair_mode: z.enum(['deterministic_derived_rebuild', 'model_rewrite_required', 'human_evidence_required']),
    rebuild_derived_sections: z.array(NonEmptyStringSchema),
  }).strict()),
  professional_passed: z.literal(false),
}).strict().superRefine((plan, context) => {
  const counted = plan.deterministic_action_count
    + plan.model_rewrite_action_count
    + plan.human_evidence_action_count;
  if (plan.action_count !== plan.actions.length || counted !== plan.action_count) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['action_count'], message: 'action_counts_mismatch' });
  }
});

const RevisionOutputPayloadSchema = z.object({
  schema_version: z.literal('professional-benchmark-revision-output/v1'),
  revision_id: NonEmptyStringSchema,
  source_package_sha256: HashSchema,
  revision_plan_sha256: HashSchema,
  applied_action_ids: z.array(NonEmptyStringSchema).min(1),
  unresolved_issue_ids: z.array(NonEmptyStringSchema),
  revised_package: ProfessionalTextPackagePayloadSchema,
  completed_at: TimestampSchema,
  professional_passed: z.literal(false),
}).strict();

const UsageAndCostPayloadSchema = z.object({
  schema_version: z.literal('professional-benchmark-usage-and-cost/v1'),
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  provider: z.enum(['claude_cli', 'codex_cli']),
  runtime: z.enum(['claude', 'codex']),
  model_id: NonEmptyStringSchema,
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cached_input_tokens: z.number().int().nonnegative(),
  cost_amount: z.number().finite().nonnegative(),
  cost_currency: NonEmptyStringSchema,
  usage_source: NonEmptyStringSchema,
  provider_receipt_sha256: HashSchema,
}).strict().refine(
  usage => usage.provider === `${usage.runtime}_cli`,
  { path: ['provider'], message: 'provider_runtime_mismatch' },
);

const BlindReviewRoleSchema = z.enum([
  'screenwriter_or_script_editor',
  'genre_or_director_reviewer',
  'fact_or_culture_reviewer',
]);
const BlindReviewPayloadSchema = z.object({
  schema_version: z.literal('professional-benchmark-blind-review/v2'),
  benchmark_id: NonEmptyStringSchema,
  video_type: VideoTypeSchema,
  run_id: NonEmptyStringSchema,
  final_package_sha256: HashSchema,
  candidate_label: NonEmptyStringSchema,
  randomization_batch_id: NonEmptyStringSchema,
  evaluator_did_not_know_origin: z.literal(true),
  baseline: z.object({
    baseline_id: NonEmptyStringSchema,
    artifact_sha256: HashSchema,
    rights: z.enum(['public_domain', 'user_owned', 'licensed']),
    average_score: z.number().finite().min(0).max(100),
  }).strict(),
  reviews: z.array(z.object({
    review_id: NonEmptyStringSchema,
    reviewer_id: NonEmptyStringSchema,
    role: BlindReviewRoleSchema,
    candidate_label: NonEmptyStringSchema,
    blind_review_declared: z.literal(true),
    independent_review_declared: z.literal(true),
    conflict_of_interest_declared: z.literal(false),
    scores: z.array(z.object({
      dimension_id: QualityDimensionIdSchema,
      score: z.number().finite().min(0).max(100),
      note: NonEmptyStringSchema,
    }).strict()).length(10),
    hard_gate_failures: z.array(z.string()),
    fact_or_culture_issues: z.array(z.string()),
    production_advance_vote: z.boolean(),
    submitted_at: TimestampSchema,
  }).strict()).min(3),
}).strict().superRefine((bundle, context) => {
  const reviewerIds = bundle.reviews.map(review => review.reviewer_id);
  const roles = bundle.reviews.map(review => review.role);
  if (new Set(reviewerIds).size !== reviewerIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['reviews'], message: 'reviewers_not_unique' });
  }
  if (new Set(roles).size !== 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['reviews'], message: 'required_roles_not_unique' });
  }
  for (const [index, review] of bundle.reviews.entries()) {
    if (review.candidate_label !== bundle.candidate_label) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['reviews', index, 'candidate_label'], message: 'candidate_mismatch' });
    }
    const dimensions = review.scores.map(score => score.dimension_id);
    if (new Set(dimensions).size !== 10) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['reviews', index, 'scores'], message: 'dimensions_not_unique' });
    }
  }
});

interface ArtifactPolicy {
  payload_schema_version: string;
  payload_schema: z.ZodTypeAny;
  producers: readonly ProfessionalBenchmarkArtifactProducer[];
  required_parent_kinds: readonly ProfessionalBenchmarkArtifactKind[];
  allowed_parent_kinds: readonly ProfessionalBenchmarkArtifactKind[];
}

const ARTIFACT_POLICIES: Record<ProfessionalBenchmarkArtifactKind, ArtifactPolicy> = {
  prompt_package: {
    payload_schema_version: 'character-story-professional-benchmark-prompt/v2',
    payload_schema: PromptPackagePayloadSchema,
    producers: ['runner'],
    required_parent_kinds: [],
    allowed_parent_kinds: [],
  },
  provider_receipt: {
    payload_schema_version: 'professional-benchmark-provider-receipt/v1',
    payload_schema: ProviderReceiptPayloadSchema,
    producers: ['model'],
    required_parent_kinds: ['prompt_package'],
    allowed_parent_kinds: ['prompt_package'],
  },
  initial_story: {
    payload_schema_version: 'professional-benchmark-initial-story/v2',
    payload_schema: InitialStoryPayloadSchema,
    producers: ['model'],
    required_parent_kinds: ['prompt_package', 'provider_receipt'],
    allowed_parent_kinds: ['prompt_package', 'provider_receipt'],
  },
  character_evidence: {
    payload_schema_version: 'character-story-professional-evidence/v1',
    payload_schema: CharacterEvidencePayloadSchema,
    producers: ['model'],
    required_parent_kinds: ['initial_story'],
    allowed_parent_kinds: ['initial_story'],
  },
  initial_professional_package: {
    payload_schema_version: 'professional-text-package/v1',
    payload_schema: ProfessionalTextPackagePayloadSchema,
    producers: ['agent', 'system'],
    required_parent_kinds: ['initial_story', 'character_evidence'],
    allowed_parent_kinds: ['initial_story', 'character_evidence'],
  },
  quality_report: {
    payload_schema_version: 'professional-text-quality-report/v1',
    payload_schema: QualityReportPayloadSchema,
    producers: ['agent', 'system'],
    required_parent_kinds: ['initial_professional_package', 'character_evidence'],
    allowed_parent_kinds: ['initial_professional_package', 'character_evidence'],
  },
  revision_plan: {
    payload_schema_version: 'professional-text-revision-plan/v1',
    payload_schema: RevisionPlanPayloadSchema,
    producers: ['agent'],
    required_parent_kinds: ['initial_professional_package', 'quality_report'],
    allowed_parent_kinds: ['initial_professional_package', 'quality_report'],
  },
  revision_output: {
    payload_schema_version: 'professional-benchmark-revision-output/v1',
    payload_schema: RevisionOutputPayloadSchema,
    producers: ['model', 'agent'],
    required_parent_kinds: ['initial_professional_package', 'revision_plan'],
    allowed_parent_kinds: ['initial_professional_package', 'revision_plan'],
  },
  final_professional_package: {
    payload_schema_version: 'professional-text-package/v1',
    payload_schema: ProfessionalTextPackagePayloadSchema,
    producers: ['agent', 'system'],
    required_parent_kinds: ['character_evidence', 'revision_output'],
    allowed_parent_kinds: ['character_evidence', 'quality_report', 'revision_output'],
  },
  final_quality_report: {
    payload_schema_version: 'professional-benchmark-quality-snapshot/v1',
    payload_schema: FinalQualityReportPayloadSchema,
    producers: ['agent', 'system'],
    required_parent_kinds: ['final_professional_package'],
    allowed_parent_kinds: ['final_professional_package', 'revision_output'],
  },
  usage_and_cost: {
    payload_schema_version: 'professional-benchmark-usage-and-cost/v1',
    payload_schema: UsageAndCostPayloadSchema,
    producers: ['model', 'runner'],
    required_parent_kinds: ['provider_receipt'],
    allowed_parent_kinds: ['provider_receipt'],
  },
  human_blind_review: {
    payload_schema_version: 'professional-benchmark-blind-review/v2',
    payload_schema: BlindReviewPayloadSchema,
    producers: ['human_reviewer'],
    required_parent_kinds: ['final_professional_package'],
    allowed_parent_kinds: ['final_professional_package'],
  },
};

const PROFILE_REQUIRED_KINDS: Record<
  ProfessionalBenchmarkArtifactValidationProfile,
  readonly ProfessionalBenchmarkArtifactKind[]
> = {
  initial_run: ['prompt_package', 'provider_receipt', 'initial_story', 'character_evidence', 'usage_and_cost'],
  professional_completion: [
    'prompt_package',
    'provider_receipt',
    'initial_story',
    'character_evidence',
    'initial_professional_package',
    'quality_report',
    'revision_plan',
    'revision_output',
    'final_professional_package',
    'final_quality_report',
    'usage_and_cost',
    'human_blind_review',
  ],
};

const ArtifactReferenceSchema = z.object({
  artifact_id: NonEmptyStringSchema,
  kind: ArtifactKindSchema,
  relative_path: NonEmptyStringSchema,
  sha256: HashSchema,
  byte_size: z.number().int().positive(),
  payload_schema_version: NonEmptyStringSchema,
  created_at: TimestampSchema,
  producer: ProducerSchema,
  parent_artifact_sha256: z.array(HashSchema),
}).strict();

const ArtifactEnvelopeSchema = z.object({
  schema_version: z.literal('professional-benchmark-artifact-envelope/v1'),
  artifact_id: NonEmptyStringSchema,
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  artifact_kind: ArtifactKindSchema,
  payload_schema_version: NonEmptyStringSchema,
  created_at: TimestampSchema,
  producer: ProducerSchema,
  parent_artifact_sha256: z.array(HashSchema),
  payload: z.unknown(),
}).strict();

const StrictBridgeBindingSchema = z.object({
  schema_version: NonEmptyStringSchema,
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  story: z.record(z.string(), z.unknown()),
  character_evidence: z.record(z.string(), z.unknown()),
  provenance: z.object({
    story_sha256: HashSchema,
    character_evidence_sha256: HashSchema,
  }).passthrough(),
}).passthrough();

function isInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    ).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('non_json_value');
  return encoded;
}

function canonicalJsonSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function persistedPayloadContent(payload: Record<string, unknown>): Record<string, unknown> {
  const { schema_version: _schemaVersion, ...content } = payload;
  return content;
}

function duplicateValues(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

export async function validateProfessionalBenchmarkArtifacts(input: {
  run_root: string;
  benchmark_id: string;
  run_id: string;
  artifacts: ProfessionalBenchmarkArtifactReference[];
  validation_profile: ProfessionalBenchmarkArtifactValidationProfile;
}): Promise<ProfessionalBenchmarkArtifactValidation> {
  const integrityBlockers: string[] = [];
  const contractBlockers: string[] = [];
  let verifiedArtifactCount = 0;
  const addIntegrity = (blocker: string): void => { integrityBlockers.push(blocker); };
  const addContract = (blocker: string): void => { contractBlockers.push(blocker); };

  if (!input.benchmark_id?.trim()) addIntegrity('benchmark_id_missing');
  if (!input.run_id?.trim()) addIntegrity('run_id_missing');
  const profileResult = ProfileSchema.safeParse(input.validation_profile);
  if (!profileResult.success) {
    return {
      integrity_valid: false,
      contract_valid: false,
      professional_passed: false,
      verified_artifact_count: 0,
      blockers: ['validation_profile_invalid'],
    };
  }
  const requiredKinds = PROFILE_REQUIRED_KINDS[profileResult.data];

  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(input.run_root);
    if (!(await stat(canonicalRoot)).isDirectory()) throw new Error('not_directory');
  } catch {
    return {
      integrity_valid: false,
      contract_valid: false,
      professional_passed: false,
      verified_artifact_count: 0,
      blockers: ['run_root_missing_or_not_directory'],
    };
  }

  const parsedReferences = input.artifacts.map(artifact => ArtifactReferenceSchema.safeParse(artifact));
  for (const [index, parsed] of parsedReferences.entries()) {
    if (!parsed.success) addIntegrity(`artifact_reference_invalid:${input.artifacts[index]?.artifact_id || index}`);
  }
  for (const id of duplicateValues(input.artifacts.map(item => item.artifact_id))) {
    addIntegrity(`duplicate_artifact_id:${id}`);
  }
  for (const itemPath of duplicateValues(input.artifacts.map(item => item.relative_path))) {
    addIntegrity(`duplicate_artifact_path:${itemPath}`);
  }
  for (const hash of duplicateValues(input.artifacts.map(item => item.sha256))) {
    addIntegrity(`duplicate_artifact_sha256:${hash}`);
  }
  for (const kind of duplicateValues(input.artifacts.map(item => item.kind))) {
    addContract(`artifact_kind_not_unique:${kind}`);
  }

  const presentKinds = new Set(input.artifacts.map(item => item.kind));
  for (const kind of requiredKinds) {
    if (!presentKinds.has(kind)) addContract(`required_artifact_missing:${kind}`);
  }

  const referencesByHash = new Map(input.artifacts.map((artifact, index) => [artifact.sha256, { artifact, index }]));
  const verifiedHashes = new Set<string>();
  const verifiedPayloads = new Map<string, unknown>();

  for (const [artifactIndex, artifact] of input.artifacts.entries()) {
    let artifactInvalid = !parsedReferences[artifactIndex]?.success;
    if (!artifact.relative_path?.trim() || path.isAbsolute(artifact.relative_path)) {
      addIntegrity(`artifact_path_not_relative:${artifact.artifact_id}`);
      continue;
    }
    const resolvedPath = path.resolve(canonicalRoot, artifact.relative_path);
    if (!isInsideRoot(canonicalRoot, resolvedPath)) {
      addIntegrity(`artifact_path_outside_run_root:${artifact.artifact_id}`);
      continue;
    }
    let canonicalArtifactPath: string;
    try {
      if ((await lstat(resolvedPath)).isSymbolicLink()) {
        addIntegrity(`artifact_symlink_not_allowed:${artifact.artifact_id}`);
        continue;
      }
      canonicalArtifactPath = await realpath(resolvedPath);
    } catch {
      addIntegrity(`artifact_file_missing:${artifact.artifact_id}`);
      continue;
    }
    if (!isInsideRoot(canonicalRoot, canonicalArtifactPath)) {
      addIntegrity(`artifact_symlink_outside_run_root:${artifact.artifact_id}`);
      continue;
    }
    if (canonicalArtifactPath !== resolvedPath) {
      addIntegrity(`artifact_symlink_not_allowed:${artifact.artifact_id}`);
      continue;
    }
    const fileStat = await stat(canonicalArtifactPath);
    if (!fileStat.isFile()) {
      addIntegrity(`artifact_not_file:${artifact.artifact_id}`);
      continue;
    }
    const content = await readFile(canonicalArtifactPath);
    if (content.byteLength !== artifact.byte_size) {
      addIntegrity(`artifact_size_mismatch:${artifact.artifact_id}`);
      continue;
    }
    if (!HASH_PATTERN.test(artifact.sha256) || sha256(content) !== artifact.sha256) {
      addIntegrity(`artifact_sha256_mismatch:${artifact.artifact_id}`);
      continue;
    }

    let envelope: z.infer<typeof ArtifactEnvelopeSchema>;
    try {
      const parsedJson = JSON.parse(content.toString('utf8')) as unknown;
      const parsedEnvelope = ArtifactEnvelopeSchema.safeParse(parsedJson);
      if (!parsedEnvelope.success) throw new Error('invalid_envelope');
      envelope = parsedEnvelope.data;
    } catch {
      addIntegrity(`artifact_envelope_invalid:${artifact.artifact_id}`);
      continue;
    }
    if (envelope.benchmark_id !== input.benchmark_id || envelope.run_id !== input.run_id) {
      addIntegrity(`artifact_run_identity_mismatch:${artifact.artifact_id}`);
      artifactInvalid = true;
    }
    if (envelope.artifact_id !== artifact.artifact_id
      || envelope.artifact_kind !== artifact.kind
      || envelope.created_at !== artifact.created_at
      || envelope.producer !== artifact.producer
      || JSON.stringify(envelope.parent_artifact_sha256) !== JSON.stringify(artifact.parent_artifact_sha256)) {
      addIntegrity(`artifact_reference_envelope_mismatch:${artifact.artifact_id}`);
      artifactInvalid = true;
    }

    const policy = ARTIFACT_POLICIES[artifact.kind];
    if (!policy) {
      addContract(`artifact_kind_unsupported:${artifact.artifact_id}`);
      continue;
    }
    if (artifact.payload_schema_version !== policy.payload_schema_version
      || envelope.payload_schema_version !== policy.payload_schema_version) {
      addContract(`artifact_payload_schema_version_mismatch:${artifact.artifact_id}`);
      artifactInvalid = true;
    }
    if (!policy.producers.includes(artifact.producer)) {
      addContract(`artifact_producer_not_allowed:${artifact.artifact_id}`);
      artifactInvalid = true;
    }
    const parsedPayload = policy.payload_schema.safeParse(envelope.payload);
    if (!parsedPayload.success) {
      addContract(`artifact_payload_schema_invalid:${artifact.artifact_id}`);
      artifactInvalid = true;
    }

    const parentHashes = artifact.parent_artifact_sha256;
    if (new Set(parentHashes).size !== parentHashes.length) {
      addIntegrity(`artifact_parent_hash_not_unique:${artifact.artifact_id}`);
      artifactInvalid = true;
    }
    const parentKinds: ProfessionalBenchmarkArtifactKind[] = [];
    for (const parentHash of parentHashes) {
      const parent = referencesByHash.get(parentHash);
      if (!parent || parentHash === artifact.sha256 || parent.index >= artifactIndex) {
        addIntegrity(`artifact_parent_dag_invalid:${artifact.artifact_id}`);
        artifactInvalid = true;
        continue;
      }
      if (!verifiedHashes.has(parentHash)) {
        addIntegrity(`artifact_parent_not_verified:${artifact.artifact_id}`);
        artifactInvalid = true;
      }
      parentKinds.push(parent.artifact.kind);
    }
    for (const requiredParentKind of policy.required_parent_kinds) {
      if (!parentKinds.includes(requiredParentKind)) {
        addContract(`artifact_required_parent_missing:${artifact.artifact_id}:${requiredParentKind}`);
        artifactInvalid = true;
      }
    }
    for (const parentKind of parentKinds) {
      if (!policy.allowed_parent_kinds.includes(parentKind)) {
        addContract(`artifact_parent_kind_not_allowed:${artifact.artifact_id}:${parentKind}`);
        artifactInvalid = true;
      }
    }
    if (parentKinds.length < policy.required_parent_kinds.length
      || parentKinds.length > policy.allowed_parent_kinds.length) {
      addContract(`artifact_parent_cardinality_invalid:${artifact.artifact_id}`);
      artifactInvalid = true;
    }

    const parentHashForKind = (kind: ProfessionalBenchmarkArtifactKind): string | undefined =>
      parentHashes.find(parentHash => referencesByHash.get(parentHash)?.artifact.kind === kind);
    if (parsedPayload.success && artifact.kind === 'provider_receipt') {
      const payload = parsedPayload.data as z.infer<typeof ProviderReceiptPayloadSchema>;
      const bridgePath = path.join(canonicalRoot, 'strict-bridge-envelope.json');
      let bridgeEnvelope: z.infer<typeof StrictBridgeBindingSchema> | undefined;
      try {
        if ((await lstat(bridgePath)).isSymbolicLink()) {
          addIntegrity(`artifact_bridge_envelope_symlink_not_allowed:${artifact.artifact_id}`);
          artifactInvalid = true;
        } else {
          const canonicalBridgePath = await realpath(bridgePath);
          if (!isInsideRoot(canonicalRoot, canonicalBridgePath) || canonicalBridgePath !== bridgePath) {
            addIntegrity(`artifact_bridge_envelope_path_invalid:${artifact.artifact_id}`);
            artifactInvalid = true;
          } else if (!(await stat(canonicalBridgePath)).isFile()) {
            addIntegrity(`artifact_bridge_envelope_not_file:${artifact.artifact_id}`);
            artifactInvalid = true;
          } else {
            const decoded = JSON.parse((await readFile(canonicalBridgePath, 'utf8'))) as unknown;
            const parsedBridge = StrictBridgeBindingSchema.safeParse(decoded);
            if (parsedBridge.success) {
              bridgeEnvelope = parsedBridge.data;
            } else {
              addContract(`artifact_bridge_envelope_schema_invalid:${artifact.artifact_id}`);
              artifactInvalid = true;
            }
          }
        }
      } catch {
        addIntegrity(`artifact_bridge_envelope_missing_or_invalid:${artifact.artifact_id}`);
        artifactInvalid = true;
      }
      if (bridgeEnvelope) {
        if (payload.bridge_envelope_sha256 !== canonicalJsonSha256(bridgeEnvelope)) {
          addContract(`artifact_bridge_envelope_sha256_mismatch:${artifact.artifact_id}`);
          artifactInvalid = true;
        }
        if (bridgeEnvelope.benchmark_id !== input.benchmark_id || bridgeEnvelope.run_id !== input.run_id) {
          addContract(`artifact_bridge_envelope_identity_mismatch:${artifact.artifact_id}`);
          artifactInvalid = true;
        }
        const bridgeStoryHash = canonicalJsonSha256(bridgeEnvelope.story);
        const bridgeEvidenceHash = canonicalJsonSha256(bridgeEnvelope.character_evidence);
        if (bridgeEnvelope.provenance.story_sha256 !== bridgeStoryHash
          || payload.story_sha256 !== bridgeStoryHash) {
          addContract(`artifact_bridge_story_sha256_mismatch:${artifact.artifact_id}`);
          artifactInvalid = true;
        }
        if (bridgeEnvelope.provenance.character_evidence_sha256 !== bridgeEvidenceHash
          || payload.character_evidence_sha256 !== bridgeEvidenceHash) {
          addContract(`artifact_bridge_character_evidence_sha256_mismatch:${artifact.artifact_id}`);
          artifactInvalid = true;
        }
      }
    }
    if (parsedPayload.success && artifact.kind === 'initial_story') {
      const receiptHash = parentHashForKind('provider_receipt');
      const receipt = receiptHash
        ? verifiedPayloads.get(receiptHash) as z.infer<typeof ProviderReceiptPayloadSchema> | undefined
        : undefined;
      const payload = parsedPayload.data as z.infer<typeof InitialStoryPayloadSchema>;
      if (!receipt
        || receipt.story_sha256 !== canonicalJsonSha256(
          persistedPayloadContent(payload as unknown as Record<string, unknown>),
        )) {
        addContract(`artifact_payload_receipt_hash_mismatch:${artifact.artifact_id}:story_sha256`);
        artifactInvalid = true;
      }
    }
    if (parsedPayload.success && artifact.kind === 'usage_and_cost') {
      const receiptHash = parentHashForKind('provider_receipt');
      const payload = parsedPayload.data as z.infer<typeof UsageAndCostPayloadSchema>;
      if (!receiptHash || payload.provider_receipt_sha256 !== receiptHash) {
        addContract(`artifact_payload_parent_hash_mismatch:${artifact.artifact_id}:provider_receipt`);
        artifactInvalid = true;
      }
    }
    if (parsedPayload.success && artifact.kind === 'revision_output') {
      const sourcePackageHash = parentHashForKind('initial_professional_package');
      const revisionPlanHash = parentHashForKind('revision_plan');
      const payload = parsedPayload.data as z.infer<typeof RevisionOutputPayloadSchema>;
      if (!sourcePackageHash || payload.source_package_sha256 !== sourcePackageHash) {
        addContract(`artifact_payload_parent_hash_mismatch:${artifact.artifact_id}:initial_professional_package`);
        artifactInvalid = true;
      }
      if (!revisionPlanHash || payload.revision_plan_sha256 !== revisionPlanHash) {
        addContract(`artifact_payload_parent_hash_mismatch:${artifact.artifact_id}:revision_plan`);
        artifactInvalid = true;
      }
    }
    if (parsedPayload.success && artifact.kind === 'human_blind_review') {
      const finalPackageHash = parentHashForKind('final_professional_package');
      const payload = parsedPayload.data as z.infer<typeof BlindReviewPayloadSchema>;
      if (!finalPackageHash || payload.final_package_sha256 !== finalPackageHash) {
        addContract(`artifact_payload_parent_hash_mismatch:${artifact.artifact_id}:final_professional_package`);
        artifactInvalid = true;
      }
    }
    if (parsedPayload.success && artifact.kind === 'final_quality_report') {
      const finalPackageHash = parentHashForKind('final_professional_package');
      const payload = parsedPayload.data as z.infer<typeof FinalQualityReportPayloadSchema>;
      if (!finalPackageHash || payload.package_sha256 !== finalPackageHash) {
        addContract(`artifact_payload_parent_hash_mismatch:${artifact.artifact_id}:final_professional_package`);
        artifactInvalid = true;
      }
    }
    if (parsedPayload.success && artifact.kind === 'character_evidence') {
      const storyHash = parentHashForKind('initial_story');
      const story = storyHash ? verifiedPayloads.get(storyHash) as z.infer<typeof InitialStoryPayloadSchema> | undefined : undefined;
      const evidence = parsedPayload.data as z.infer<typeof CharacterEvidencePayloadSchema>;
      const sceneIds = story?.scene_breakdown.map(scene => String(scene.scene_id)).sort() ?? [];
      const turnIds = Object.keys(evidence.scene_turns).sort();
      if (JSON.stringify(sceneIds) !== JSON.stringify(turnIds)) {
        addContract(`artifact_character_evidence_scene_coverage_mismatch:${artifact.artifact_id}`);
        artifactInvalid = true;
      }
      const storyReference = storyHash ? referencesByHash.get(storyHash)?.artifact : undefined;
      const receiptHash = storyReference?.parent_artifact_sha256.find(
        parentHash => referencesByHash.get(parentHash)?.artifact.kind === 'provider_receipt',
      );
      const receipt = receiptHash
        ? verifiedPayloads.get(receiptHash) as z.infer<typeof ProviderReceiptPayloadSchema> | undefined
        : undefined;
      if (!receipt
        || receipt.character_evidence_sha256 !== canonicalJsonSha256(
          persistedPayloadContent(evidence as unknown as Record<string, unknown>),
        )) {
        addContract(`artifact_payload_receipt_hash_mismatch:${artifact.artifact_id}:character_evidence_sha256`);
        artifactInvalid = true;
      }
    }

    if (!artifactInvalid) {
      verifiedArtifactCount += 1;
      verifiedHashes.add(artifact.sha256);
      if (parsedPayload.success) verifiedPayloads.set(artifact.sha256, parsedPayload.data);
    }
  }

  const blockers = [...new Set([...integrityBlockers, ...contractBlockers])];
  const integrityValid = integrityBlockers.length === 0;
  return {
    integrity_valid: integrityValid,
    contract_valid: integrityValid && contractBlockers.length === 0,
    professional_passed: false,
    verified_artifact_count: verifiedArtifactCount,
    blockers,
  };
}
