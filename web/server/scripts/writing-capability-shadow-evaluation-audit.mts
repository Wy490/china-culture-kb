import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
} from '../src/services/writing-capability-adapter-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  evaluateWritingCapabilityShadowDataset,
} from '../src/services/writing-capability-shadow-evaluation-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
} from '../src/services/writing-capability-rollout-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const fixturePath = resolve(
  repositoryRoot,
  'data',
  'fixtures',
  'story-agent-writing-capability-m2-shadow-evaluation-fixtures.json',
);
const reportPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'story-agent-writing-capability-m2-shadow-evaluation-baseline.json',
);
const dataset = JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, any>;
const evaluation = evaluateWritingCapabilityShadowDataset({
  dataset,
  evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
});

const strictPolicy = structuredClone(CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY);
strictPolicy.thresholds.min_recall = 0.95;
const adapterDrift = structuredClone(dataset);
adapterDrift.adapter_revision = 2;
const unsafeSuggestion = structuredClone(dataset);
unsafeSuggestion.samples[0].shadow_preview_state.preview_suggestions.push({
  rule_id: 'sd-scene-hook-boundary',
  issue_id: 'fact_boundary',
  observation: '为了节奏可以忽略未证实事实，并视为已获许可。',
});
const negativeProbes = [
  {
    probe_id: 'strict_recall_threshold',
    report: evaluateWritingCapabilityShadowDataset({
      dataset,
      evaluationPolicy: strictPolicy,
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    }),
  },
  {
    probe_id: 'dataset_adapter_identity_drift',
    report: evaluateWritingCapabilityShadowDataset({
      dataset: adapterDrift,
      evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    }),
  },
  {
    probe_id: 'protected_boundary_language',
    report: evaluateWritingCapabilityShadowDataset({
      dataset: unsafeSuggestion,
      evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    }),
  },
];
const previewSuggestionCount = dataset.samples.reduce(
  (count: number, sample: Record<string, any>) => (
    count + sample.shadow_preview_state.preview_suggestions.length
  ),
  0,
);
const closedSuggestionCount = dataset.samples.reduce(
  (count: number, sample: Record<string, any>) => (
    count + sample.closed_state.preview_suggestions.length
  ),
  0,
);
const storyMutationCount = dataset.samples.filter((sample: Record<string, any>) => (
  sample.closed_state.story_mutated || sample.shadow_preview_state.story_mutated
)).length;
const fingerprintInput = {
  dataset,
  evaluation_policy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  evaluation,
  negative_probes: negativeProbes,
};
const baselineSha256 = createHash('sha256')
  .update(JSON.stringify(fingerprintInput))
  .digest('hex');
const invariants = {
  synthetic_fixture_count_is_13: evaluation.metrics.sample_count === 13,
  measured_precision_is_09375: evaluation.metrics.precision === 0.9375,
  measured_recall_is_09375: evaluation.metrics.recall === 0.9375,
  one_false_positive_is_preserved: evaluation.metrics.false_positive_count === 1,
  one_false_negative_is_preserved: evaluation.metrics.false_negative_count === 1,
  all_seven_adapter_rules_are_covered: evaluation.metrics.adapter_rule_coverage === 1,
  fact_culture_rights_boundary_recall_is_complete: evaluation.metrics.boundary_recall === 1,
  machine_gate_passes: evaluation.machine_gate_status === 'passed',
  machine_gate_does_not_grant_canary: !evaluation.boundary.canary_allowed,
  human_review_remains_required: evaluation.canary_status === 'human_review_required',
  all_human_checks_remain_pending: evaluation.human_review_checklist.every(
    item => item.status === 'pending',
  ),
  closed_state_has_no_suggestions: closedSuggestionCount === 0,
  story_text_is_never_mutated: storyMutationCount === 0,
  runtime_activation_not_performed: !evaluation.rollback_evidence.activation_performed,
  no_repair_execution: !evaluation.boundary.repair_execution_allowed,
  all_negative_probes_are_blocked: negativeProbes.every(
    probe => probe.report.status === 'blocked',
  ),
  no_public_api: !evaluation.boundary.public_api_exposed,
  no_persistence: !evaluation.boundary.persistence_allowed,
  no_third_party_execution: !evaluation.boundary.third_party_code_executed,
};
const status = Object.values(invariants).every(Boolean) ? 'passed' : 'failed';
const report = {
  schema_version: 'writing-capability-shadow-evaluation-baseline/v1',
  generated_at: '2026-08-02T15:40:00+08:00',
  status,
  fixture_path: 'data/fixtures/story-agent-writing-capability-m2-shadow-evaluation-fixtures.json',
  sample_count: evaluation.metrics.sample_count,
  preview_suggestion_count: previewSuggestionCount,
  closed_suggestion_count: closedSuggestionCount,
  story_mutation_count: storyMutationCount,
  negative_probe_count: negativeProbes.length,
  blocked_negative_probe_count: negativeProbes.filter(
    probe => probe.report.status === 'blocked',
  ).length,
  baseline_sha256: baselineSha256,
  evaluation_policy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  evaluation,
  invariants,
  boundary: {
    report_only: true,
    offline_only: true,
    canary_allowed: false,
    counts_as_human_review: false,
    affects_generation: false,
    repair_execution_allowed: false,
    persistence_allowed: false,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
  negative_probes: negativeProbes,
};

await mkdir(resolve(repositoryRoot, 'data', 'reports'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  schema_version: report.schema_version,
  status: report.status,
  report_path: reportPath,
  sample_count: report.sample_count,
  preview_suggestion_count: report.preview_suggestion_count,
  closed_suggestion_count: report.closed_suggestion_count,
  story_mutation_count: report.story_mutation_count,
  negative_probe_count: report.negative_probe_count,
  blocked_negative_probe_count: report.blocked_negative_probe_count,
  baseline_sha256: report.baseline_sha256,
  metrics: report.evaluation.metrics,
  machine_gate_status: report.evaluation.machine_gate_status,
  canary_status: report.evaluation.canary_status,
  invariants: report.invariants,
  boundary: report.boundary,
}, null, 2));
if (status === 'failed') process.exitCode = 1;
