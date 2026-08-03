import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  WritingCapabilityAdapterV1Schema,
  WritingCapabilityRolloutPolicyV1Schema,
} from '@shared/schemas.js';
import {
  preflightWritingCapabilityAdapter,
  writingCapabilityTextWeakensProtectedBoundary,
} from './writing-capability-adapter-service.js';

const ShadowIssueIdSchema = z.enum([
  'action_progression',
  'causal_chain',
  'cultural_safety',
  'fact_boundary',
  'hook_payoff',
  'review_separation',
  'rights_clearance',
]);

const PreviewSuggestionSchema = z.object({
  rule_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
  issue_id: ShadowIssueIdSchema,
  observation: z.string().trim().min(1).max(500),
}).strict();

const ClosedStateSchema = z.object({
  story_ref: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  observations: z.array(z.never()).max(0),
  preview_suggestions: z.array(z.never()).max(0),
  story_mutated: z.literal(false),
}).strict();

const ShadowPreviewStateSchema = z.object({
  story_ref: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  preview_suggestions: z.array(PreviewSuggestionSchema),
  story_mutated: z.literal(false),
}).strict().superRefine((state, context) => {
  const keys = state.preview_suggestions.map(suggestion => (
    `${suggestion.rule_id}:${suggestion.issue_id}`
  ));
  if (new Set(keys).size !== keys.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['preview_suggestions'],
      message: 'preview suggestions must be unique by rule_id and issue_id',
    });
  }
});

const ShadowEvaluationSampleSchema = z.object({
  sample_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  title: z.string().trim().min(1).max(120),
  source_status: z.literal('fictional_fixture'),
  sample_text: z.string().trim().min(20).max(1500),
  expected_issue_ids: z.array(ShadowIssueIdSchema),
  closed_state: ClosedStateSchema,
  shadow_preview_state: ShadowPreviewStateSchema,
}).strict().superRefine((sample, context) => {
  const sortedIssues = [...sample.expected_issue_ids]
    .sort((left, right) => left.localeCompare(right));
  if (
    new Set(sample.expected_issue_ids).size !== sample.expected_issue_ids.length
    || sample.expected_issue_ids.some((issueId, index) => issueId !== sortedIssues[index])
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expected_issue_ids'],
      message: 'expected_issue_ids must be unique and sorted',
    });
  }
  if (
    sample.closed_state.story_ref !== sample.sample_id
    || sample.shadow_preview_state.story_ref !== sample.sample_id
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['closed_state', 'story_ref'],
      message: 'closed and preview states must reference the unchanged sample',
    });
  }
});

export const WritingCapabilityShadowEvaluationDatasetV1Schema = z.object({
  schema_version: z.literal('writing-capability-shadow-evaluation-dataset/v1'),
  fixture_set_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  fixture_set_revision: z.number().int().positive(),
  capability_id: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
  video_type: z.literal('ai_comic_drama'),
  adapter_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  adapter_revision: z.number().int().positive(),
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  samples: z.array(ShadowEvaluationSampleSchema).min(1),
  boundary: z.object({
    offline_only: z.literal(true),
    synthetic_fixtures_only: z.literal(true),
    contains_production_story_data: z.literal(false),
    affects_generation: z.literal(false),
    repair_execution_allowed: z.literal(false),
    persistence_allowed: z.literal(false),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict().superRefine((dataset, context) => {
  const sampleIds = dataset.samples.map(sample => sample.sample_id);
  const sortedSampleIds = [...sampleIds].sort((left, right) => left.localeCompare(right));
  if (
    new Set(sampleIds).size !== sampleIds.length
    || sampleIds.some((sampleId, index) => sampleId !== sortedSampleIds[index])
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['samples'],
      message: 'samples must have unique, sorted sample_id values',
    });
  }
});

const EvaluationThresholdsSchema = z.object({
  min_sample_count: z.number().int().positive(),
  min_clean_sample_count: z.number().int().positive(),
  min_precision: z.number().min(0).max(1),
  min_recall: z.number().min(0).max(1),
  max_false_positive_rate: z.number().min(0).max(1),
  max_clean_sample_false_positive_rate: z.number().min(0).max(1),
  min_dimension_recall: z.number().min(0).max(1),
  min_boundary_recall: z.number().min(0).max(1),
  min_adapter_rule_coverage: z.number().min(0).max(1),
  max_conflict_count: z.number().int().nonnegative(),
  max_duplicate_suggestion_count: z.number().int().nonnegative(),
}).strict();

export const WritingCapabilityShadowEvaluationPolicyV1Schema = z.object({
  schema_version: z.literal('writing-capability-shadow-evaluation-policy/v1'),
  policy_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  policy_revision: z.number().int().positive(),
  candidate: z.object({
    capability_id: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
    video_type: z.literal('ai_comic_drama'),
    adapter_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
    adapter_revision: z.number().int().positive(),
    source_commit: z.string().regex(/^[a-f0-9]{40}$/),
    internal_adaptation_version: z.string().regex(/^[a-z][a-z0-9-]{2,63}\/v[1-9][0-9]*$/),
    rollback_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
  }).strict(),
  thresholds: EvaluationThresholdsSchema,
  human_review_checklist: z.array(z.object({
    check_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
    label: z.string().trim().min(1).max(200),
    required: z.literal(true),
  }).strict()).min(1).refine(
    items => new Set(items.map(item => item.check_id)).size === items.length,
    'human review check_id values must be unique',
  ),
  boundary: z.object({
    offline_only: z.literal(true),
    machine_gate_grants_canary: z.literal(false),
    human_review_required: z.literal(true),
    counts_as_human_review: z.literal(false),
    affects_generation: z.literal(false),
    repair_execution_allowed: z.literal(false),
    persistence_allowed: z.literal(false),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict();

const DimensionResultSchema = z.object({
  issue_id: ShadowIssueIdSchema,
  expected_count: z.number().int().nonnegative(),
  true_positive_count: z.number().int().nonnegative(),
  false_negative_count: z.number().int().nonnegative(),
  recall: z.number().min(0).max(1),
  threshold_passed: z.boolean(),
}).strict();

export const WritingCapabilityShadowEvaluationReportV1Schema = z.object({
  schema_version: z.literal('writing-capability-shadow-evaluation-report/v1'),
  status: z.enum(['machine_gate_passed_human_review_required', 'blocked']),
  machine_gate_status: z.enum(['passed', 'blocked']),
  canary_status: z.enum(['human_review_required', 'blocked']),
  fixture_set_id: z.string(),
  fixture_set_revision: z.number().int().positive(),
  dataset_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  policy_id: z.string(),
  policy_revision: z.number().int().positive(),
  capability_id: z.string(),
  video_type: z.literal('ai_comic_drama'),
  adapter_id: z.string(),
  adapter_revision: z.number().int().positive(),
  metrics: z.object({
    sample_count: z.number().int().nonnegative(),
    clean_sample_count: z.number().int().nonnegative(),
    expected_issue_count: z.number().int().nonnegative(),
    predicted_issue_count: z.number().int().nonnegative(),
    true_positive_count: z.number().int().nonnegative(),
    false_positive_count: z.number().int().nonnegative(),
    false_negative_count: z.number().int().nonnegative(),
    precision: z.number().min(0).max(1),
    recall: z.number().min(0).max(1),
    false_positive_rate: z.number().min(0).max(1),
    clean_sample_false_positive_rate: z.number().min(0).max(1),
    boundary_recall: z.number().min(0).max(1),
    adapter_rule_coverage: z.number().min(0).max(1),
    conflict_count: z.number().int().nonnegative(),
    duplicate_suggestion_count: z.number().int().nonnegative(),
  }).strict(),
  dimension_results: z.array(DimensionResultSchema),
  blockers: z.array(z.string()).refine(
    values => new Set(values).size === values.length,
    'blockers must be unique',
  ),
  human_review_checklist: z.array(z.object({
    check_id: z.string(),
    label: z.string(),
    required: z.literal(true),
    status: z.literal('pending'),
  }).strict()),
  rollback_evidence: z.object({
    rollback_id: z.string(),
    identity_verified: z.boolean(),
    activation_performed: z.literal(false),
    rollback_execution_required: z.literal(false),
  }).strict(),
  boundary: z.object({
    offline_only: z.literal(true),
    canary_allowed: z.literal(false),
    human_review_required: z.literal(true),
    counts_as_human_review: z.literal(false),
    affects_generation: z.literal(false),
    repair_execution_allowed: z.literal(false),
    persistence_allowed: z.literal(false),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict().superRefine((report, context) => {
  const passed = report.blockers.length === 0;
  if (
    (passed && (
      report.status !== 'machine_gate_passed_human_review_required'
      || report.machine_gate_status !== 'passed'
      || report.canary_status !== 'human_review_required'
    ))
    || (!passed && (
      report.status !== 'blocked'
      || report.machine_gate_status !== 'blocked'
      || report.canary_status !== 'blocked'
    ))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'evaluation status must match blocker state without granting canary',
    });
  }
});

type ShadowIssueId = z.infer<typeof ShadowIssueIdSchema>;
type ShadowEvaluationDataset = z.infer<typeof WritingCapabilityShadowEvaluationDatasetV1Schema>;
type ShadowEvaluationPolicy = z.infer<typeof WritingCapabilityShadowEvaluationPolicyV1Schema>;
type ShadowEvaluationReport = z.infer<typeof WritingCapabilityShadowEvaluationReportV1Schema>;

const ISSUE_IDS = ShadowIssueIdSchema.options;
const BOUNDARY_ISSUES = new Set<ShadowIssueId>([
  'cultural_safety',
  'fact_boundary',
  'rights_clearance',
]);
const RULE_ISSUE_MAP: Readonly<Record<string, readonly ShadowIssueId[]>> = {
  'sd-blueprint-causal-spine': ['causal_chain'],
  'sd-scene-action-progress': ['action_progression'],
  'sd-scene-hook-boundary': [
    'cultural_safety',
    'fact_boundary',
    'hook_payoff',
    'rights_clearance',
  ],
  'sd-quality-causal-loop': ['causal_chain', 'hook_payoff'],
  'sd-quality-review-separation': ['review_separation'],
  'sd-repair-local-causality': ['action_progression', 'causal_chain'],
  'sd-repair-boundary-preservation': [
    'cultural_safety',
    'fact_boundary',
    'rights_clearance',
  ],
};

export const CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY = deepFreeze({
  schema_version: 'writing-capability-shadow-evaluation-policy/v1',
  policy_id: 'short_drama_ai_comic_shadow_eval_gate_20260802',
  policy_revision: 1,
  candidate: {
    capability_id: 'short_drama_develop_write_review',
    video_type: 'ai_comic_drama',
    adapter_id: 'short_drama_ai_comic_shadow_adapter',
    adapter_revision: 1,
    source_commit: 'adab39cdfa001f272f03bbcf4e68ed005a43d8b6',
    internal_adaptation_version: 'short-drama-adapter/v1',
    rollback_id: 'disable-short-drama-ai-comic-shadow-v1',
  },
  thresholds: {
    min_sample_count: 12,
    min_clean_sample_count: 3,
    min_precision: 0.9,
    min_recall: 0.9,
    max_false_positive_rate: 0.1,
    max_clean_sample_false_positive_rate: 0.34,
    min_dimension_recall: 0.75,
    min_boundary_recall: 1,
    min_adapter_rule_coverage: 1,
    max_conflict_count: 0,
    max_duplicate_suggestion_count: 0,
  },
  human_review_checklist: [
    { check_id: 'verify_causal_diagnostics', label: '逐样本复核因果链与行动推进诊断。', required: true },
    { check_id: 'verify_hook_diagnostics', label: '复核开场、结尾钩子及兑现判断。', required: true },
    { check_id: 'verify_fact_boundaries', label: '复核事实与知识证据边界未被削弱。', required: true },
    { check_id: 'verify_cultural_safety', label: '复核文化禁区、仪式与地域表述。', required: true },
    { check_id: 'verify_rights_clearance', label: '复核原作、品牌、人物与素材许可边界。', required: true },
    { check_id: 'verify_false_findings', label: '复核误报、漏报、重复建议和可操作性。', required: true },
  ],
  boundary: {
    offline_only: true,
    machine_gate_grants_canary: false,
    human_review_required: true,
    counts_as_human_review: false,
    affects_generation: false,
    repair_execution_allowed: false,
    persistence_allowed: false,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
} satisfies ShadowEvaluationPolicy);

export class WritingCapabilityShadowEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WritingCapabilityShadowEvaluationError';
  }
}

export function evaluateWritingCapabilityShadowDataset(input: {
  dataset: unknown;
  evaluationPolicy: unknown;
  adapter: unknown;
  rolloutPolicy: unknown;
}): ShadowEvaluationReport {
  const dataset = parseOrThrow(
    WritingCapabilityShadowEvaluationDatasetV1Schema,
    input.dataset,
    'shadow evaluation dataset',
  );
  const evaluationPolicy = parseOrThrow(
    WritingCapabilityShadowEvaluationPolicyV1Schema,
    input.evaluationPolicy,
    'shadow evaluation policy',
  );
  const adapter = parseOrThrow(WritingCapabilityAdapterV1Schema, input.adapter, 'adapter');
  const rolloutPolicy = parseOrThrow(
    WritingCapabilityRolloutPolicyV1Schema,
    input.rolloutPolicy,
    'rollout policy',
  );
  const preflight = preflightWritingCapabilityAdapter({ adapter, rolloutPolicy });
  const conflictReasons: string[] = [];
  const policyCandidate = evaluationPolicy.candidate;
  const datasetIdentityMatches = (
    dataset.capability_id === adapter.capability_id
    && dataset.video_type === adapter.video_type
    && dataset.adapter_id === adapter.adapter_id
    && dataset.adapter_revision === adapter.adapter_revision
    && dataset.source_commit === adapter.source_commit
  );
  if (!datasetIdentityMatches) conflictReasons.push('dataset_adapter_identity_mismatch');
  const policyIdentityMatches = (
    policyCandidate.capability_id === adapter.capability_id
    && policyCandidate.video_type === adapter.video_type
    && policyCandidate.adapter_id === adapter.adapter_id
    && policyCandidate.adapter_revision === adapter.adapter_revision
    && policyCandidate.source_commit === adapter.source_commit
    && policyCandidate.internal_adaptation_version === adapter.internal_adaptation_version
    && policyCandidate.rollback_id === adapter.rollback_id
    && rolloutPolicy.candidate.rollback_id === adapter.rollback_id
  );
  if (!policyIdentityMatches) conflictReasons.push('evaluation_policy_identity_mismatch');
  if (preflight.status !== 'passed') conflictReasons.push('adapter_preflight_blocked');

  const adapterRuleIds = new Set(
    Object.values(adapter.rules).flatMap(rules => rules.map(rule => rule.rule_id)),
  );
  const usedRuleIds = new Set<string>();
  const expectedPairs = new Set<string>();
  const predictedPairs = new Set<string>();
  let duplicateSuggestionCount = 0;
  let cleanSamplesWithFalsePositive = 0;
  for (const sample of dataset.samples) {
    for (const issueId of sample.expected_issue_ids) {
      expectedPairs.add(`${sample.sample_id}:${issueId}`);
    }
    const sampleSuggestionKeys = new Set<string>();
    const samplePredictedIssues = new Set<ShadowIssueId>();
    for (const suggestion of sample.shadow_preview_state.preview_suggestions) {
      const suggestionKey = `${suggestion.rule_id}:${suggestion.issue_id}`;
      if (sampleSuggestionKeys.has(suggestionKey)) duplicateSuggestionCount += 1;
      sampleSuggestionKeys.add(suggestionKey);
      samplePredictedIssues.add(suggestion.issue_id);
      predictedPairs.add(`${sample.sample_id}:${suggestion.issue_id}`);
      if (!adapterRuleIds.has(suggestion.rule_id)) {
        conflictReasons.push('unknown_adapter_rule_reference');
      } else {
        usedRuleIds.add(suggestion.rule_id);
      }
      if (!RULE_ISSUE_MAP[suggestion.rule_id]?.includes(suggestion.issue_id)) {
        conflictReasons.push('rule_issue_mapping_conflict');
      }
      if (writingCapabilityTextWeakensProtectedBoundary(suggestion.observation)) {
        conflictReasons.push('protected_boundary_language_conflict');
      }
    }
    if (sample.expected_issue_ids.length === 0 && samplePredictedIssues.size > 0) {
      cleanSamplesWithFalsePositive += 1;
    }
  }

  const truePositiveCount = [...predictedPairs].filter(pair => expectedPairs.has(pair)).length;
  const falsePositiveCount = [...predictedPairs].filter(pair => !expectedPairs.has(pair)).length;
  const falseNegativeCount = [...expectedPairs].filter(pair => !predictedPairs.has(pair)).length;
  const predictedIssueCount = predictedPairs.size;
  const expectedIssueCount = expectedPairs.size;
  const cleanSampleCount = dataset.samples.filter(
    sample => sample.expected_issue_ids.length === 0,
  ).length;
  const precision = ratio(truePositiveCount, predictedIssueCount);
  const recall = ratio(truePositiveCount, expectedIssueCount);
  const falsePositiveRate = ratio(falsePositiveCount, predictedIssueCount);
  const cleanSampleFalsePositiveRate = ratio(cleanSamplesWithFalsePositive, cleanSampleCount);
  const boundaryExpectedPairs = [...expectedPairs].filter(pair => (
    BOUNDARY_ISSUES.has(pair.slice(pair.lastIndexOf(':') + 1) as ShadowIssueId)
  ));
  const boundaryTruePositiveCount = boundaryExpectedPairs.filter(pair => predictedPairs.has(pair)).length;
  const boundaryRecall = ratio(boundaryTruePositiveCount, boundaryExpectedPairs.length);
  const adapterRuleCoverage = ratio(usedRuleIds.size, adapterRuleIds.size);
  const dimensionResults = ISSUE_IDS.map(issueId => {
    const suffix = `:${issueId}`;
    const expectedCount = [...expectedPairs].filter(pair => pair.endsWith(suffix)).length;
    const truePositiveDimensionCount = [...predictedPairs]
      .filter(pair => pair.endsWith(suffix) && expectedPairs.has(pair)).length;
    const dimensionRecall = ratio(truePositiveDimensionCount, expectedCount);
    return {
      issue_id: issueId,
      expected_count: expectedCount,
      true_positive_count: truePositiveDimensionCount,
      false_negative_count: expectedCount - truePositiveDimensionCount,
      recall: dimensionRecall,
      threshold_passed: dimensionRecall >= evaluationPolicy.thresholds.min_dimension_recall,
    };
  });

  const metrics = {
    sample_count: dataset.samples.length,
    clean_sample_count: cleanSampleCount,
    expected_issue_count: expectedIssueCount,
    predicted_issue_count: predictedIssueCount,
    true_positive_count: truePositiveCount,
    false_positive_count: falsePositiveCount,
    false_negative_count: falseNegativeCount,
    precision,
    recall,
    false_positive_rate: falsePositiveRate,
    clean_sample_false_positive_rate: cleanSampleFalsePositiveRate,
    boundary_recall: boundaryRecall,
    adapter_rule_coverage: adapterRuleCoverage,
    conflict_count: conflictReasons.length + preflight.conflicts.length,
    duplicate_suggestion_count: duplicateSuggestionCount,
  };
  const thresholds = evaluationPolicy.thresholds;
  const blockers = uniqueSorted([
    ...conflictReasons,
    ...(preflight.conflicts.length > 0 ? ['adapter_preflight_conflicts_present'] : []),
    metrics.sample_count < thresholds.min_sample_count ? 'sample_count_below_threshold' : '',
    metrics.clean_sample_count < thresholds.min_clean_sample_count
      ? 'clean_sample_count_below_threshold'
      : '',
    metrics.precision < thresholds.min_precision ? 'overall_precision_below_threshold' : '',
    metrics.recall < thresholds.min_recall ? 'overall_recall_below_threshold' : '',
    metrics.false_positive_rate > thresholds.max_false_positive_rate
      ? 'false_positive_rate_above_threshold'
      : '',
    metrics.clean_sample_false_positive_rate > thresholds.max_clean_sample_false_positive_rate
      ? 'clean_sample_false_positive_rate_above_threshold'
      : '',
    dimensionResults.some(result => !result.threshold_passed)
      ? 'dimension_recall_below_threshold'
      : '',
    metrics.boundary_recall < thresholds.min_boundary_recall
      ? 'boundary_recall_below_threshold'
      : '',
    metrics.adapter_rule_coverage < thresholds.min_adapter_rule_coverage
      ? 'adapter_rule_coverage_below_threshold'
      : '',
    metrics.conflict_count > thresholds.max_conflict_count
      ? 'conflict_count_above_threshold'
      : '',
    metrics.duplicate_suggestion_count > thresholds.max_duplicate_suggestion_count
      ? 'duplicate_suggestion_count_above_threshold'
      : '',
  ]);
  const machinePassed = blockers.length === 0;
  const rollbackIdentityVerified = datasetIdentityMatches
    && policyIdentityMatches
    && preflight.status === 'passed';
  const report = WritingCapabilityShadowEvaluationReportV1Schema.parse({
    schema_version: 'writing-capability-shadow-evaluation-report/v1',
    status: machinePassed ? 'machine_gate_passed_human_review_required' : 'blocked',
    machine_gate_status: machinePassed ? 'passed' : 'blocked',
    canary_status: machinePassed ? 'human_review_required' : 'blocked',
    fixture_set_id: dataset.fixture_set_id,
    fixture_set_revision: dataset.fixture_set_revision,
    dataset_sha256: createHash('sha256').update(JSON.stringify(dataset)).digest('hex'),
    policy_id: evaluationPolicy.policy_id,
    policy_revision: evaluationPolicy.policy_revision,
    capability_id: dataset.capability_id,
    video_type: dataset.video_type,
    adapter_id: dataset.adapter_id,
    adapter_revision: dataset.adapter_revision,
    metrics,
    dimension_results: dimensionResults,
    blockers,
    human_review_checklist: evaluationPolicy.human_review_checklist.map(item => ({
      ...item,
      status: 'pending',
    })),
    rollback_evidence: {
      rollback_id: evaluationPolicy.candidate.rollback_id,
      identity_verified: rollbackIdentityVerified,
      activation_performed: false,
      rollback_execution_required: false,
    },
    boundary: {
      offline_only: true,
      canary_allowed: false,
      human_review_required: true,
      counts_as_human_review: false,
      affects_generation: false,
      repair_execution_allowed: false,
      persistence_allowed: false,
      public_api_exposed: false,
      third_party_code_executed: false,
    },
  });
  return deepFreeze(report);
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map(issue => (
      `${issue.path.join('.') || label}: ${issue.message}`
    )).join('; ');
    throw new WritingCapabilityShadowEvaluationError(`Invalid ${label}: ${details}`);
  }
  return result.data;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 1;
  return Number((numerator / denominator).toFixed(4));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
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
