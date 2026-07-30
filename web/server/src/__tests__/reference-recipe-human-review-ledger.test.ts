import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReferenceGenerationRecipeContract } from '@shared/reference-generation-recipes.js';
import type {
  StoryRecipeEffectComparison,
  StoryRecipeEffectHumanReviewSubmitRequest,
} from '@shared/types.js';
import {
  buildStoryRecipeEffectMachineReport,
  type StoryRecipeEffectComparisonHistoryRecord,
} from '../services/reference-recipe-effect-history-service.js';
import {
  readStoryRecipeEffectHumanReviewLedger,
  storyRecipeEffectHumanReviewLedgerPath,
  submitStoryRecipeEffectHumanReview,
} from '../services/reference-recipe-human-review-ledger-service.js';

function comparisonRecord(): StoryRecipeEffectComparisonHistoryRecord {
  const recipe = buildReferenceGenerationRecipeContract('feature_long_goal_payoff');
  const storyId = '20260730-story-review1';
  const dimensions: StoryRecipeEffectComparison['dimensions'] = [
    'structure',
    'causality',
    'visualization',
    'continuity',
    'contract_completeness',
  ].map(dimension => ({
    dimension,
    baseline_score: 60,
    recipe_assisted_score: 72,
    delta: 12,
    evidence: [`${dimension}=fixture`],
  })) as StoryRecipeEffectComparison['dimensions'];
  return {
    project_id: '20260730-story-review1--character_story',
    project_title: '真人评审账本测试',
    updated_at: '2026-07-30T08:00:00.000Z',
    story: {
      storyId,
      source_entry: '测试条目',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      reference_generation_recipe: recipe,
      recipe_effect_comparison: {
        schema_version: 'story-recipe-effect-comparison/v1',
        status: 'completed',
        baseline_story_id: '20260730-story-baseline1',
        recipe_assisted_story_id: storyId,
        recipe,
        baseline_machine_score: 60,
        recipe_assisted_machine_score: 72,
        aggregate_delta: 12,
        dimensions,
        machine_verdict: 'improved',
        boundary: {
          same_input_verified: true,
          machine_comparison_only: true,
          human_preference_measured: false,
          legal_conclusion_reached: false,
          production_credit_granted: false,
        },
      },
    },
  };
}

function reviewRequest(
  record: StoryRecipeEffectComparisonHistoryRecord,
): StoryRecipeEffectHumanReviewSubmitRequest {
  const reportFilters = {
    recipe_id: 'feature_long_goal_payoff' as const,
    video_type: 'character_story' as const,
    min_comparisons_per_recipe: 1,
    limit: 20,
  };
  const report = buildStoryRecipeEffectMachineReport([record], {
    ...reportFilters,
    generated_at: '2026-07-30T08:30:00.000Z',
  });
  return {
    project_id: record.project_id,
    story_id: record.story.storyId,
    cohort: {
      cohort_id: report.cohort.cohort_id,
      membership_sha256: report.cohort.membership_sha256,
      report_filters: reportFilters,
    },
    reviewer: {
      reviewer_id: 'reviewer-wuyu-001',
      display_name: 'Wuyu',
      identity_reference: 'local-operator-profile:wuyu',
    },
    review: {
      decision: 'recipe_preferred',
      rationale: '两版均已完整观看；配方版的人物目标和因果推进更清楚。',
      evidence_references: ['review-note:scene-2', 'review-note:ending'],
      method: 'blind_to_machine_verdict',
    },
    attestation: {
      human_reviewer: true,
      compared_both_outputs: true,
      independent_judgment: true,
    },
    idempotency_key: 'review-submit-20260730-0001',
  };
}

describe('recipe effect human review ledger', () => {
  it('returns an honest empty state without creating synthetic reviews', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'recipe-human-review-empty-'));
    const ledger = await readStoryRecipeEffectHumanReviewLedger({ generatedRoot });

    expect(ledger).toMatchObject({
      schema_version: 'story-recipe-effect-human-review-ledger/v1',
      summary: {
        recorded_review_count: 0,
        human_reviews_recorded: false,
      },
      entries: [],
      integrity: {
        chain_valid: true,
        invalid_event_count: 0,
      },
      boundary: {
        aggregate_human_preference_claimed: false,
        causal_effect_proven: false,
        production_credit_granted: false,
      },
    });
  });

  it('appends a verified human review with a hash chain and idempotent replay', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'recipe-human-review-submit-'));
    const record = comparisonRecord();
    const request = reviewRequest(record);
    const first = await submitStoryRecipeEffectHumanReview(request, {
      generatedRoot,
      comparisonRecords: [record],
      now: () => new Date('2026-07-30T09:00:00.000Z'),
    });
    const replay = await submitStoryRecipeEffectHumanReview(request, {
      generatedRoot,
      comparisonRecords: [record],
      now: () => new Date('2026-07-30T10:00:00.000Z'),
    });

    expect(first.idempotent_replay).toBe(false);
    expect(replay.idempotent_replay).toBe(true);
    expect(replay.event).toEqual(first.event);
    expect(first.event).toMatchObject({
      schema_version: 'story-recipe-effect-human-review-event/v1',
      sequence: 1,
      previous_event_sha256: null,
      project_id: record.project_id,
      story_id: record.story.storyId,
      reviewer: request.reviewer,
      review: request.review,
      recorded_at: '2026-07-30T09:00:00.000Z',
      boundary: {
        human_review_recorded: true,
        aggregate_human_preference_claimed: false,
        causal_effect_proven: false,
        production_credit_granted: false,
      },
    });
    expect(first.event.event_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.event).not.toHaveProperty('machine_verdict');
    expect(first.event).not.toHaveProperty('machine_score');

    const ledger = await readStoryRecipeEffectHumanReviewLedger({ generatedRoot });
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.summary).toMatchObject({
      recorded_review_count: 1,
      human_reviews_recorded: true,
      decision_counts: {
        baseline_preferred: 0,
        recipe_preferred: 1,
        no_preference: 0,
        insufficient_evidence: 0,
      },
    });
    expect(ledger.integrity.chain_valid).toBe(true);
  });

  it('rejects an idempotency key reused with different review content', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'recipe-human-review-conflict-'));
    const record = comparisonRecord();
    const request = reviewRequest(record);
    await submitStoryRecipeEffectHumanReview(request, {
      generatedRoot,
      comparisonRecords: [record],
    });

    await expect(submitStoryRecipeEffectHumanReview({
      ...request,
      review: {
        ...request.review,
        decision: 'baseline_preferred',
      },
    }, {
      generatedRoot,
      comparisonRecords: [record],
    })).rejects.toMatchObject({ code: 'REVIEW_WRITE_CONFLICT' });
  });

  it('rejects a stale or fabricated cohort reference', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'recipe-human-review-cohort-'));
    const record = comparisonRecord();
    const request = reviewRequest(record);

    await expect(submitStoryRecipeEffectHumanReview({
      ...request,
      cohort: {
        ...request.cohort,
        membership_sha256: '0'.repeat(64),
      },
    }, {
      generatedRoot,
      comparisonRecords: [record],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('fails closed when the persisted hash chain is modified', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'recipe-human-review-tamper-'));
    const record = comparisonRecord();
    await submitStoryRecipeEffectHumanReview(reviewRequest(record), {
      generatedRoot,
      comparisonRecords: [record],
    });
    const path = storyRecipeEffectHumanReviewLedgerPath(generatedRoot);
    const stored = JSON.parse(await readFile(path, 'utf8')) as {
      entries: Array<{ review: { rationale: string } }>;
    };
    stored.entries[0].review.rationale = 'tampered';
    await writeFile(path, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');

    await expect(readStoryRecipeEffectHumanReviewLedger({ generatedRoot }))
      .rejects.toMatchObject({ code: 'REVIEW_STORAGE_UNAVAILABLE' });
  });
});
