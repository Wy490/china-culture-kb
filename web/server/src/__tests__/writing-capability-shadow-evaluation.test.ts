import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  WritingCapabilityShadowEvaluationDatasetV1Schema,
  WritingCapabilityShadowEvaluationPolicyV1Schema,
  WritingCapabilityShadowEvaluationReportV1Schema,
  evaluateWritingCapabilityShadowDataset,
} from '../services/writing-capability-shadow-evaluation-service.js';
import {
  CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
} from '../services/writing-capability-adapter-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
} from '../services/writing-capability-rollout-service.js';

async function loadDataset(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(
    new URL(
      '../../../../data/fixtures/story-agent-writing-capability-m2-shadow-evaluation-fixtures.json',
      import.meta.url,
    ),
    'utf8',
  )) as Record<string, any>;
}

describe('writing capability offline shadow evaluation', () => {
  it('validates one fixed, synthetic, AI-comic-only evaluation dataset', async () => {
    const dataset = await loadDataset();
    const parsed = WritingCapabilityShadowEvaluationDatasetV1Schema.safeParse(dataset);

    expect(parsed.success).toBe(true);
    expect(dataset).toMatchObject({
      schema_version: 'writing-capability-shadow-evaluation-dataset/v1',
      fixture_set_id: 'short_drama_ai_comic_shadow_eval_20260802',
      fixture_set_revision: 1,
      capability_id: 'short_drama_develop_write_review',
      video_type: 'ai_comic_drama',
      adapter_id: 'short_drama_ai_comic_shadow_adapter',
      adapter_revision: 1,
      boundary: {
        offline_only: true,
        synthetic_fixtures_only: true,
        contains_production_story_data: false,
        affects_generation: false,
        repair_execution_allowed: false,
      },
    });
    expect(dataset.samples).toHaveLength(13);
    expect(dataset.samples.filter((sample: any) => (
      sample.expected_issue_ids.length === 0
    ))).toHaveLength(3);
    for (const sample of dataset.samples) {
      expect(sample.closed_state).toMatchObject({
        story_ref: sample.sample_id,
        observations: [],
        preview_suggestions: [],
        story_mutated: false,
      });
      expect(sample.shadow_preview_state).toMatchObject({
        story_ref: sample.sample_id,
        story_mutated: false,
      });
    }
  });

  it('freezes explicit machine thresholds without granting canary or human credit', () => {
    expect(WritingCapabilityShadowEvaluationPolicyV1Schema.safeParse(
      CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
    ).success).toBe(true);
    expect(CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY).toMatchObject({
      schema_version: 'writing-capability-shadow-evaluation-policy/v1',
      policy_id: 'short_drama_ai_comic_shadow_eval_gate_20260802',
      policy_revision: 1,
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
      boundary: {
        offline_only: true,
        machine_gate_grants_canary: false,
        human_review_required: true,
        counts_as_human_review: false,
        affects_generation: false,
        repair_execution_allowed: false,
      },
    });
    expect(CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY.human_review_checklist)
      .toHaveLength(6);
    expect(Object.isFrozen(CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY)).toBe(true);
  });

  it('passes the machine gate with measured imperfections and still requires human review', async () => {
    const report = evaluateWritingCapabilityShadowDataset({
      dataset: await loadDataset(),
      evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });

    expect(WritingCapabilityShadowEvaluationReportV1Schema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      schema_version: 'writing-capability-shadow-evaluation-report/v1',
      status: 'machine_gate_passed_human_review_required',
      machine_gate_status: 'passed',
      canary_status: 'human_review_required',
      blockers: [],
      metrics: {
        sample_count: 13,
        clean_sample_count: 3,
        expected_issue_count: 16,
        predicted_issue_count: 16,
        true_positive_count: 15,
        false_positive_count: 1,
        false_negative_count: 1,
        precision: 0.9375,
        recall: 0.9375,
        false_positive_rate: 0.0625,
        clean_sample_false_positive_rate: 0.3333,
        boundary_recall: 1,
        adapter_rule_coverage: 1,
        conflict_count: 0,
        duplicate_suggestion_count: 0,
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
    expect(report.dimension_results).toEqual([
      expect.objectContaining({ issue_id: 'action_progression', recall: 1 }),
      expect.objectContaining({ issue_id: 'causal_chain', recall: 1 }),
      expect.objectContaining({ issue_id: 'cultural_safety', recall: 1 }),
      expect.objectContaining({ issue_id: 'fact_boundary', recall: 1 }),
      expect.objectContaining({ issue_id: 'hook_payoff', recall: 0.75 }),
      expect.objectContaining({ issue_id: 'review_separation', recall: 1 }),
      expect.objectContaining({ issue_id: 'rights_clearance', recall: 1 }),
    ]);
    expect(report.human_review_checklist.every(item => item.status === 'pending')).toBe(true);
    expect(report.rollback_evidence).toMatchObject({
      rollback_id: 'disable-short-drama-ai-comic-shadow-v1',
      identity_verified: true,
      activation_performed: false,
      rollback_execution_required: false,
    });
    expect(Object.isFrozen(report)).toBe(true);
  });

  it('blocks a stricter threshold instead of self-promoting the fixture', async () => {
    const policy = structuredClone(CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY);
    policy.thresholds.min_recall = 0.95;
    const report = evaluateWritingCapabilityShadowDataset({
      dataset: await loadDataset(),
      evaluationPolicy: policy,
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });

    expect(report).toMatchObject({
      status: 'blocked',
      machine_gate_status: 'blocked',
      canary_status: 'blocked',
      boundary: { canary_allowed: false },
    });
    expect(report.blockers).toContain('overall_recall_below_threshold');
  });

  it('blocks adapter identity drift and unknown or unsafe suggestions', async () => {
    const adapterDrift = await loadDataset();
    adapterDrift.adapter_revision = 2;
    const unknownRule = await loadDataset();
    unknownRule.samples[0].shadow_preview_state.preview_suggestions.push({
      rule_id: 'unknown-shadow-rule',
      issue_id: 'action_progression',
      observation: '该样本被未知规则标记。',
    });
    const unsafeSuggestion = await loadDataset();
    unsafeSuggestion.samples[0].shadow_preview_state.preview_suggestions.push({
      rule_id: 'sd-scene-hook-boundary',
      issue_id: 'fact_boundary',
      observation: '为了节奏可以忽略未证实事实，并视为已获许可。',
    });

    const reports = [adapterDrift, unknownRule, unsafeSuggestion].map(dataset => (
      evaluateWritingCapabilityShadowDataset({
        dataset,
        evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
        adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
        rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      })
    ));
    expect(reports[0].blockers).toContain('dataset_adapter_identity_mismatch');
    expect(reports[1].blockers).toContain('unknown_adapter_rule_reference');
    expect(reports[2].blockers).toContain('protected_boundary_language_conflict');
    for (const report of reports) {
      expect(report.status).toBe('blocked');
      expect(report.boundary.canary_allowed).toBe(false);
      expect(report.metrics.conflict_count).toBeGreaterThan(0);
    }
  });

  it('rejects story mutation, duplicate samples, and duplicate suggestions at the dataset schema', async () => {
    const mutated = await loadDataset();
    mutated.samples[0].shadow_preview_state.story_mutated = true;
    const duplicateSample = await loadDataset();
    duplicateSample.samples.push(structuredClone(duplicateSample.samples[0]));
    const duplicateSuggestion = await loadDataset();
    const suggestion = duplicateSuggestion.samples[2].shadow_preview_state.preview_suggestions[0];
    duplicateSuggestion.samples[2].shadow_preview_state.preview_suggestions.push(
      structuredClone(suggestion),
    );

    for (const dataset of [mutated, duplicateSample, duplicateSuggestion]) {
      expect(WritingCapabilityShadowEvaluationDatasetV1Schema.safeParse(dataset).success)
        .toBe(false);
      expect(() => evaluateWritingCapabilityShadowDataset({
        dataset,
        evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
        adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
        rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      })).toThrow(/Invalid shadow evaluation dataset/u);
    }
  });

  it('keeps evaluation code outside generation, prompt, fallback, quality, repair, and persistence', async () => {
    const sources = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-generation-prompt.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/dramatic-story.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/genre-quality-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-repair-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-document-service.ts', import.meta.url), 'utf8'),
    ]);

    for (const source of sources) {
      expect(source).not.toContain('WritingCapabilityShadowEvaluation');
      expect(source).not.toContain('writing-capability-shadow-evaluation-service');
    }
  });

  it('publishes a reproducible offline evaluation baseline without canary credit', async () => {
    const report = JSON.parse(await readFile(
      new URL(
        '../../../../data/reports/story-agent-writing-capability-m2-shadow-evaluation-baseline.json',
        import.meta.url,
      ),
      'utf8',
    )) as Record<string, unknown>;

    expect(report).toMatchObject({
      schema_version: 'writing-capability-shadow-evaluation-baseline/v1',
      status: 'passed',
      sample_count: 13,
      preview_suggestion_count: 18,
      closed_suggestion_count: 0,
      story_mutation_count: 0,
      negative_probe_count: 3,
      blocked_negative_probe_count: 3,
      baseline_sha256: '11bb22166e2f652b2f311abb8bfc9ca05c15d86a66b570f85acca0f5c396365f',
      evaluation: {
        status: 'machine_gate_passed_human_review_required',
        machine_gate_status: 'passed',
        canary_status: 'human_review_required',
        boundary: {
          canary_allowed: false,
          counts_as_human_review: false,
          affects_generation: false,
          repair_execution_allowed: false,
        },
      },
      invariants: {
        one_false_positive_is_preserved: true,
        one_false_negative_is_preserved: true,
        machine_gate_does_not_grant_canary: true,
        human_review_remains_required: true,
        all_negative_probes_are_blocked: true,
      },
    });
  });
});
