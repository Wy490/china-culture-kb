import { z } from 'zod';
import type {
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  StoryScene,
} from '@shared/types.js';
import type {
  CharacterStoryBenchmarkExecutionPackage,
} from './professional-benchmark-service.js';
import {
  buildCharacterStoryProfessionalBenchmarkPrompt,
  type CharacterStoryProfessionalBenchmarkPromptPackage,
} from './professional-benchmark-prompt-service.js';
import {
  hashProfessionalBenchmarkArtifact,
  validateProfessionalBenchmarkAdapterEnvelope,
  type ProfessionalBenchmarkAdapterEnvelope,
  type ProfessionalBenchmarkRunLedger,
} from './professional-benchmark-run-service.js';
import { buildCharacterStoryProfessionalTextPackage } from './professional-text-pipeline-service.js';
import {
  evaluateCharacterStoryProfessionalText,
  type CharacterStoryProfessionalEvidence,
} from './professional-text-quality-service.js';
import {
  buildCharacterStoryRevisionPlan,
  type ProfessionalTextRevisionPlan,
} from './professional-text-revision-service.js';

const FORBIDDEN_TEST_ID_PATTERN = /fixture|simulation|local/i;
const NonEmptyStringSchema = z.string().trim().min(1);

const StrictInitialStorySchema = z.object({
  title: NonEmptyStringSchema,
  logline: NonEmptyStringSchema,
  theme: NonEmptyStringSchema,
  full_text: NonEmptyStringSchema.min(50),
  scene_breakdown: z.array(z.object({
    scene_id: z.number().int().min(1),
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
  }).strict()).min(1),
  cultural_constraints: z.array(NonEmptyStringSchema),
  credibility_note: NonEmptyStringSchema,
}).strict();

const StrictCharacterEvidenceSchema = z.object({
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
  scene_turns: z.record(NonEmptyStringSchema),
}).strict().refine(
  evidence => evidence.starting_relationship_state !== evidence.ending_relationship_state,
  { path: ['ending_relationship_state'], message: 'relationship_state_unchanged' },
);

type StrictInitialStory = z.infer<typeof StrictInitialStorySchema>;

export type ProfessionalBenchmarkPostInitialStatus =
  | 'blocked'
  | 'revision_required'
  | 'human_evidence_required'
  | 'human_blind_review_required';

export interface ProfessionalBenchmarkPostInitialNextAction {
  kind:
    | 'resolve_integrity_blockers'
    | 'model_revision_and_human_evidence'
    | 'model_revision'
    | 'human_evidence_review'
    | 'prepare_final_package_and_human_blind_review';
  model_rewrite_action_ids: string[];
  human_evidence_action_ids: string[];
  deterministic_action_ids: string[];
  human_blind_review_required: true;
}

export interface ProfessionalBenchmarkPostInitialArtifactPayloads {
  initial_professional_package?: ProfessionalTextPackage;
  quality_report?: ProfessionalTextQualityReport & {
    schema_version: 'professional-text-quality-report/v1';
  };
  revision_plan?: ProfessionalTextRevisionPlan;
}

/**
 * A pure, in-memory work order. It deliberately cannot award benchmark credit:
 * real-model provenance only establishes the origin of the initial draft, while
 * revision evidence, a final package and independent human review remain pending.
 */
export interface ProfessionalBenchmarkPostInitialWorkOrder {
  schema_version: 'professional-benchmark-post-initial-work-order/v1';
  benchmark_id: string;
  run_id: string;
  status: ProfessionalBenchmarkPostInitialStatus;
  source_story?: StoryGenerateResult;
  research_dossier?: ResearchAndEvidenceDossier;
  initial_professional_package?: ProfessionalTextPackage;
  quality_report?: ProfessionalTextQualityReport & {
    schema_version: 'professional-text-quality-report/v1';
  };
  revision_plan?: ProfessionalTextRevisionPlan;
  next_action: ProfessionalBenchmarkPostInitialNextAction;
  artifact_payloads: ProfessionalBenchmarkPostInitialArtifactPayloads;
  blockers: string[];
  conversion_warnings: string[];
  credit_eligible: false;
  professional_passed: false;
}

export interface ProfessionalBenchmarkPostInitialInput {
  post_initial_opt_in: boolean;
  execution_package: CharacterStoryBenchmarkExecutionPackage;
  prompt_package: CharacterStoryProfessionalBenchmarkPromptPackage;
  ledger: ProfessionalBenchmarkRunLedger;
  envelope: ProfessionalBenchmarkAdapterEnvelope;
  now?: string;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function blockedWorkOrder(input: ProfessionalBenchmarkPostInitialInput, blockers: string[]): ProfessionalBenchmarkPostInitialWorkOrder {
  return {
    schema_version: 'professional-benchmark-post-initial-work-order/v1',
    benchmark_id: input.execution_package?.benchmark_id ?? input.ledger?.benchmark_id ?? '',
    run_id: input.ledger?.run_id ?? input.envelope?.run_id ?? '',
    status: 'blocked',
    next_action: {
      kind: 'resolve_integrity_blockers',
      model_rewrite_action_ids: [],
      human_evidence_action_ids: [],
      deterministic_action_ids: [],
      human_blind_review_required: true,
    },
    artifact_payloads: {},
    blockers: unique(blockers),
    conversion_warnings: [],
    credit_eligible: false,
    professional_passed: false,
  };
}

function preflightBlockers(input: ProfessionalBenchmarkPostInitialInput): string[] {
  const executionPackage = input.execution_package;
  const promptPackage = input.prompt_package;
  const ledger = input.ledger;
  const envelope = input.envelope;
  const blockers: string[] = [];

  if (input.post_initial_opt_in !== true) blockers.push('post_initial_opt_in_required');
  for (const [field, value] of [
    ['execution_benchmark_id', executionPackage?.benchmark_id],
    ['ledger_benchmark_id', ledger?.benchmark_id],
    ['ledger_run_id', ledger?.run_id],
    ['envelope_benchmark_id', envelope?.benchmark_id],
    ['envelope_run_id', envelope?.run_id],
  ] as const) {
    if (!value?.trim()) blockers.push(`${field}_missing`);
    else if (FORBIDDEN_TEST_ID_PATTERN.test(value)) blockers.push(`${field}_not_real_external`);
  }
  for (const [field, value] of [
    ['execution_model_profile_id', executionPackage?.execution_contract?.model_profile_id],
    ['execution_model_id', executionPackage?.execution_contract?.model_id],
    ['ledger_model_profile_id', ledger?.expected_provenance?.model_profile_id],
    ['ledger_requested_model_id', ledger?.expected_provenance?.requested_model_id],
    ['envelope_model_profile_id', envelope?.provenance?.model_profile_id],
    ['envelope_requested_model_id', envelope?.provenance?.requested_model_id],
    ['envelope_reported_model_id', envelope?.provenance?.reported_model_id],
  ] as const) {
    if (!value?.trim()) blockers.push(`${field}_missing`);
    else if (FORBIDDEN_TEST_ID_PATTERN.test(value)) blockers.push(`${field}_not_real_external`);
  }
  if (executionPackage?.video_type !== 'character_story') blockers.push('video_type_mismatch');
  if (executionPackage?.professional_passed !== false) blockers.push('execution_package_pass_claim_not_allowed');
  if (promptPackage?.professional_passed !== false) blockers.push('prompt_package_pass_claim_not_allowed');
  if (ledger?.status !== 'professional_evidence_pending') blockers.push('ledger_not_professional_evidence_pending');
  if (ledger?.credit_eligible !== false) blockers.push('ledger_credit_claim_not_allowed');
  if (ledger?.professional_passed !== false) blockers.push('ledger_pass_claim_not_allowed');
  if (ledger?.provenance?.status !== 'verified_initial_external') blockers.push('ledger_provenance_not_verified');
  if (ledger?.provenance?.blockers?.length) blockers.push('ledger_provenance_blockers_present');
  if (ledger?.provenance?.observed?.provenance_complete !== true) blockers.push('ledger_provenance_incomplete');
  if (envelope?.provenance?.used_fallback !== false) blockers.push('fallback_output_not_allowed');
  if (envelope?.provenance?.generation_mode !== 'external_model') blockers.push('generation_mode_not_external_model');
  if (envelope?.provenance?.execution_kind !== 'real_model') blockers.push('execution_kind_not_real_model');
  if (FORBIDDEN_TEST_ID_PATTERN.test(envelope?.provenance?.provider ?? '')) {
    blockers.push('provider_not_real_external');
  }
  return blockers;
}

function integrityBlockers(input: ProfessionalBenchmarkPostInitialInput): string[] {
  const blockers: string[] = [];
  const executionPackage = input.execution_package;
  const promptPackage = input.prompt_package;
  const ledger = input.ledger;

  try {
    const envelopeValidation = validateProfessionalBenchmarkAdapterEnvelope({
      ledger,
      envelope: input.envelope,
    });
    blockers.push(...envelopeValidation.blockers.map(blocker => `envelope:${blocker}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    blockers.push(`run_ledger_invalid:${message}`);
    return blockers;
  }

  if (hashProfessionalBenchmarkArtifact(executionPackage) !== ledger.execution_package_sha256) {
    blockers.push('execution_package_hash_mismatch');
  }
  if (executionPackage.benchmark_id !== ledger.benchmark_id) blockers.push('benchmark_id_mismatch');
  if (executionPackage.source_snapshot.snapshot_sha256 !== ledger.expected_provenance.source_snapshot_sha256) {
    blockers.push('source_snapshot_sha256_mismatch');
  }
  if (promptPackage.benchmark_id !== executionPackage.benchmark_id) blockers.push('prompt_benchmark_id_mismatch');
  if (promptPackage.source_snapshot_sha256 !== executionPackage.source_snapshot.snapshot_sha256) {
    blockers.push('prompt_source_snapshot_mismatch');
  }
  if (hashProfessionalBenchmarkArtifact(promptPackage) !== ledger.prompt_package_sha256) {
    blockers.push('prompt_package_hash_mismatch');
  }
  if (hashProfessionalBenchmarkArtifact(promptPackage.story_generation_prompt) !== ledger.story_prompt_sha256) {
    blockers.push('story_prompt_hash_mismatch');
  }
  try {
    const canonical = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
    if (hashProfessionalBenchmarkArtifact(canonical) !== hashProfessionalBenchmarkArtifact(promptPackage)) {
      blockers.push('prompt_package_not_canonical');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    blockers.push(`canonical_prompt_invalid:${message}`);
  }
  return blockers;
}

function parseStrictInitialContent(input: ProfessionalBenchmarkPostInitialInput): {
  story?: StrictInitialStory;
  characterEvidence?: CharacterStoryProfessionalEvidence;
  blockers: string[];
} {
  const blockers: string[] = [];
  const storyResult = StrictInitialStorySchema.safeParse(input.envelope.story);
  const evidenceResult = StrictCharacterEvidenceSchema.safeParse(input.envelope.character_evidence);
  if (!storyResult.success) {
    blockers.push(...storyResult.error.issues.map(issue =>
      `initial_story_invalid:${issue.path.join('.') || 'root'}:${issue.message}`
    ));
  }
  if (!evidenceResult.success) {
    blockers.push(...evidenceResult.error.issues.map(issue =>
      `character_evidence_invalid:${issue.path.join('.') || 'root'}:${issue.message}`
    ));
  }
  if (!storyResult.success || !evidenceResult.success) return { blockers: unique(blockers) };

  const sceneIds = storyResult.data.scene_breakdown.map(scene => scene.scene_id);
  if (new Set(sceneIds).size !== sceneIds.length
    || sceneIds.some((sceneId, index) => sceneId !== index + 1)) {
    blockers.push('initial_story_invalid:scene_ids_must_be_unique_contiguous_and_ordered');
  }
  const expectedTurnKeys = sceneIds.map(String).sort((left, right) => Number(left) - Number(right));
  const actualTurnKeys = Object.keys(evidenceResult.data.scene_turns)
    .sort((left, right) => Number(left) - Number(right));
  if (JSON.stringify(expectedTurnKeys) !== JSON.stringify(actualTurnKeys)) {
    blockers.push('character_evidence_invalid:scene_turns_must_cover_every_scene_exactly');
  }
  return {
    story: storyResult.data,
    characterEvidence: evidenceResult.data,
    blockers: unique(blockers),
  };
}

function buildResearchDossier(
  executionPackage: CharacterStoryBenchmarkExecutionPackage,
): ResearchAndEvidenceDossier {
  const snapshot = executionPackage.source_snapshot;
  const sourceLabel = snapshot.sources.map(source => source.citation).join('；') || snapshot.source_entry;
  return {
    source_summary: snapshot.summary,
    evidence_items: [
      ...executionPackage.truth_boundary.required_evidence_focus.map((claim, index) => ({
        evidence_id: `source-review-focus-${index + 1}`,
        status: 'unknown' as const,
        claim,
        source: sourceLabel,
        allowed_usage: '仅作为待人工逐条来源映射的核验焦点，不得据此自称已核验事实。',
        verification_note: 'source_snapshot.claim_level_verification_complete=false；专业通过前必须人工核验。',
      })),
      ...executionPackage.truth_boundary.plausible_dramatization_allowlist.map((claim, index) => ({
        evidence_id: `allowed-dramatization-${index + 1}`,
        status: 'plausible_dramatization' as const,
        claim,
        source: 'execution_package.truth_boundary.plausible_dramatization_allowlist',
        allowed_usage: '仅能在不改变可核验事件结果且显式保留戏剧化边界时使用。',
        verification_note: '这是预先声明的戏剧化许可，不是历史事实证据。',
      })),
    ],
    unknowns: unique([
      ...snapshot.unverified_points,
      ...executionPackage.truth_boundary.unknown_or_forbidden_claims,
    ]),
    authorization_notes: [
      ...executionPackage.truth_boundary.required_disclaimers,
      '本工作单只处理已验证外部初稿，不授权新增事实、对白、场景或专业通过结论。',
    ],
  };
}

function convertStrictStory(input: ProfessionalBenchmarkPostInitialInput, story: StrictInitialStory): {
  story?: StoryGenerateResult;
  warnings: string[];
  blockers: string[];
} {
  const request = input.execution_package.story_generation_request;
  const blockers = [
    request.presentation_style ? '' : 'story_conversion_context_missing:presentation_style',
    request.story_structure ? '' : 'story_conversion_context_missing:story_structure',
    request.truth_mode ? '' : 'story_conversion_context_missing:truth_mode',
  ].filter(Boolean);
  if (blockers.length > 0) return { warnings: [], blockers };

  // This is a lossless conversion from the strict bridge scene contract. Missing
  // required production fields are rejected before this function; the coordinator
  // never fills them with guessed or sentinel content.
  const scenes: StoryScene[] = story.scene_breakdown.map(scene => ({
    scene_id: scene.scene_id,
    title: scene.title,
    duration_sec: scene.duration_sec,
    location: scene.location,
    time_of_day: scene.time_of_day,
    dramatic_function: scene.dramatic_function,
    plot: scene.plot,
    key_action: scene.key_action,
    characters: [...scene.characters],
    visual_prompt: scene.visual_prompt,
    camera_suggestion: scene.camera_suggestion,
    cultural_note: scene.cultural_note,
    conflict: scene.conflict,
    dialogue_or_narration: scene.dialogue_or_narration,
    source_entries: [...scene.source_entries],
    factual_basis: scene.factual_basis,
    fictionalized_elements: [...scene.fictionalized_elements],
  }));
  const converted: StoryGenerateResult = {
    storyId: `${input.ledger.run_id}--initial-story`,
    model_profile_id: input.envelope.provenance.model_profile_id,
    generation_source: input.envelope.provenance.provider,
    generation_mode: 'external_model',
    generation_used_fallback: false,
    title: story.title,
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: request.presentation_style!,
    source_entry: input.execution_package.source_snapshot.source_entry,
    original_user_query: request.original_user_query,
    logline: story.logline,
    theme: story.theme,
    full_text: story.full_text,
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: [...story.cultural_constraints],
    credibility_note: story.credibility_note,
    truth_mode: request.truth_mode,
    target_audience: input.execution_package.creative_contract.target_audience,
    communication_goal: input.execution_package.creative_contract.communication_goal,
    story_structure: request.story_structure,
  };
  return {
    story: converted,
    blockers: [],
    warnings: [],
  };
}

function addRequiredHumanEvidenceAction(
  plan: ProfessionalTextRevisionPlan,
): ProfessionalTextRevisionPlan {
  if (plan.actions.some(action => action.issue_id === 'claim_level_verification_incomplete')) return plan;
  const action = {
    action_id: `revision-action-${plan.actions.length + 1}`,
    issue_id: 'claim_level_verification_incomplete',
    instruction: '由事实与文化审阅者完成主张到来源的逐条映射，并确认戏剧化与未知项边界。',
    target_sections: ['truth_and_adaptation_contract', 'continuity_ledger'] as const,
    repair_mode: 'human_evidence_required' as const,
    rebuild_derived_sections: [] as const,
  };
  const actions = [...plan.actions, {
    ...action,
    target_sections: [...action.target_sections],
    rebuild_derived_sections: [...action.rebuild_derived_sections],
  }];
  return {
    ...plan,
    action_count: actions.length,
    human_evidence_action_count: plan.human_evidence_action_count + 1,
    actions,
    professional_passed: false,
  };
}

function nextAction(plan: ProfessionalTextRevisionPlan): ProfessionalBenchmarkPostInitialNextAction {
  const model = plan.actions.filter(action => action.repair_mode === 'model_rewrite_required');
  const human = plan.actions.filter(action => action.repair_mode === 'human_evidence_required');
  const deterministic = plan.actions.filter(action => action.repair_mode === 'deterministic_derived_rebuild');
  return {
    kind: model.length > 0 && human.length > 0
      ? 'model_revision_and_human_evidence'
      : model.length > 0
        ? 'model_revision'
        : human.length > 0
          ? 'human_evidence_review'
          : 'prepare_final_package_and_human_blind_review',
    model_rewrite_action_ids: model.map(action => action.action_id),
    human_evidence_action_ids: human.map(action => action.action_id),
    deterministic_action_ids: deterministic.map(action => action.action_id),
    human_blind_review_required: true,
  };
}

export function coordinateProfessionalBenchmarkPostInitial(
  input: ProfessionalBenchmarkPostInitialInput,
): ProfessionalBenchmarkPostInitialWorkOrder {
  const preflight = preflightBlockers(input);
  if (preflight.length > 0) return blockedWorkOrder(input, preflight);

  const integrity = integrityBlockers(input);
  if (integrity.length > 0) return blockedWorkOrder(input, integrity);

  const parsed = parseStrictInitialContent(input);
  if (parsed.blockers.length > 0 || !parsed.story || !parsed.characterEvidence) {
    return blockedWorkOrder(input, parsed.blockers.length > 0
      ? parsed.blockers
      : ['strict_initial_content_missing']);
  }

  const converted = convertStrictStory(input, parsed.story);
  if (converted.blockers.length > 0 || !converted.story) {
    return blockedWorkOrder(input, converted.blockers.length > 0
      ? converted.blockers
      : ['story_conversion_failed']);
  }
  const research = buildResearchDossier(input.execution_package);
  const pkg = buildCharacterStoryProfessionalTextPackage({
    story: converted.story,
    target_audience: input.execution_package.creative_contract.target_audience,
    platform: input.execution_package.creative_contract.platform,
    target_duration: input.execution_package.creative_contract.target_duration,
    communication_goal: input.execution_package.creative_contract.communication_goal,
    production_goal: input.execution_package.creative_contract.production_goal,
    audience_promise: input.execution_package.creative_contract.audience_promise,
    truth_mode: input.execution_package.story_generation_request.truth_mode,
    research,
    character_evidence: parsed.characterEvidence,
    now: input.now,
  });

  pkg.truth_and_adaptation_contract.verified_facts = [];
  pkg.truth_and_adaptation_contract.plausible_dramatizations = [
    ...input.execution_package.truth_boundary.plausible_dramatization_allowlist,
  ];
  pkg.truth_and_adaptation_contract.fictional_additions = [];
  pkg.truth_and_adaptation_contract.unknown_or_forbidden_claims = unique([
    ...input.execution_package.source_snapshot.unverified_points,
    ...input.execution_package.truth_boundary.unknown_or_forbidden_claims,
  ]);
  pkg.truth_and_adaptation_contract.required_disclaimers = [
    ...input.execution_package.truth_boundary.required_disclaimers,
  ];
  pkg.delivery_text_package.validation_notes = [
    ...converted.warnings,
    '初稿来源已验证为外部模型，但本工作单不构成专业质量通过。',
    '所有未知生产字段必须经修订补齐，不得由协调器猜测。',
  ];
  const evaluation = evaluateCharacterStoryProfessionalText({
    package: pkg,
    character_evidence: parsed.characterEvidence,
  });
  evaluation.quality_report.professional_passed = false;
  evaluation.quality_report.evaluator_notes = unique([
    ...evaluation.quality_report.evaluator_notes,
    'post-initial coordinator 只生成修订工作单，不能授予专业通过或基准信用。',
  ]);
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = pkg.quality_report.hard_gate_failures.length > 0 ? 'revision_required' : 'in_review';

  const revisionPlan = addRequiredHumanEvidenceAction(buildCharacterStoryRevisionPlan(pkg));
  const action = nextAction(revisionPlan);
  const qualityReport = {
    schema_version: 'professional-text-quality-report/v1' as const,
    ...pkg.quality_report,
  };
  const status: ProfessionalBenchmarkPostInitialStatus = action.model_rewrite_action_ids.length > 0
    || action.deterministic_action_ids.length > 0
    ? 'revision_required'
    : action.human_evidence_action_ids.length > 0
      ? 'human_evidence_required'
      : 'human_blind_review_required';

  return {
    schema_version: 'professional-benchmark-post-initial-work-order/v1',
    benchmark_id: input.execution_package.benchmark_id,
    run_id: input.ledger.run_id,
    status,
    source_story: converted.story,
    research_dossier: research,
    initial_professional_package: pkg,
    quality_report: qualityReport,
    revision_plan: revisionPlan,
    next_action: action,
    artifact_payloads: {
      initial_professional_package: pkg,
      quality_report: qualityReport,
      revision_plan: revisionPlan,
    },
    blockers: [],
    conversion_warnings: converted.warnings,
    credit_eligible: false,
    professional_passed: false,
  };
}
