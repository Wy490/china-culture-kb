import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiComicHumanReviewDimension, AiComicHumanReviewScore } from '@shared/types.js';
import {
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  saveAiComicSeriesProject,
} from '../services/ai-comic-series-service.js';
import {
  auditAiComicSeriesCommercialQuality,
  buildAiComicSeriesHumanReview,
  repairAiComicSeriesCommercialQuality,
} from '../services/ai-comic-series-commercial-quality-service.js';
import { auditAiComicSeriesDiversity } from '../services/ai-comic-series-diversity-service.js';
import { SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE } from './fixtures/shadow-puppetry-keeper-series-fixture.js';

const ORIGINAL_WEB_GENERATED_ROOT = process.env.WEB_GENERATED_ROOT;
let generatedRoot = '';

beforeAll(async () => {
  generatedRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-commercial-quality-'));
  process.env.WEB_GENERATED_ROOT = generatedRoot;
});

afterAll(async () => {
  if (ORIGINAL_WEB_GENERATED_ROOT === undefined) {
    delete process.env.WEB_GENERATED_ROOT;
  } else {
    process.env.WEB_GENERATED_ROOT = ORIGINAL_WEB_GENERATED_ROOT;
  }
  if (generatedRoot) await rm(generatedRoot, { recursive: true, force: true });
});

describe('AI comic series commercial quality and diversity', () => {
  it('models the complete commercial beat contract for every episode', async () => {
    const result = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);
    expect(result.ok).toBe(true);

    const episodes = result.data!.episodes;
    expect(episodes.every(episode => Boolean(episode.commercial_beats))).toBe(true);
    for (const episode of episodes) {
      expect(episode.commercial_beats).toMatchObject({
        schema_version: 'ai-comic-episode-commercial-beats/v1',
        hook_3s: expect.any(String),
        episode_goal: expect.any(String),
        external_pressure: expect.any(String),
        failure_cost: expect.any(String),
        midpoint_turn: expect.any(String),
        character_choice: expect.any(String),
        state_change: expect.any(String),
        cliffhanger_question: expect.stringMatching(/[？?]$/),
        opening_dialogue: expect.any(String),
      });
      expect(episode.commercial_beats!.scene_function_sequence.length).toBeGreaterThanOrEqual(3);
    }
    for (let index = 0; index < episodes.length - 2; index += 1) {
      const states = episodes.slice(index, index + 3).map(episode => episode.commercial_beats!.state_change);
      expect(new Set(states).size).toBeGreaterThan(1);
    }
  });

  it('keeps machine commercial quality, diversity, and human review as separate gates', async () => {
    const result = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);
    const audit = auditAiComicSeriesCommercialQuality(
      result.data!,
      undefined,
      {
        1: '20260720-story-commercial-review-e1',
        10: '20260720-story-commercial-review-e10',
        20: '20260720-story-commercial-review-e20',
      },
    );

    expect(audit.machine_gate_passed, JSON.stringify(audit.issues)).toBe(true);
    expect(audit).toMatchObject({
      schema_version: 'ai-comic-series-commercial-quality-audit/v1',
      machine_gate_passed: true,
      ready_for_human_review: true,
      human_review: {
        schema_version: 'ai-comic-series-human-review/v1',
        status: 'pending',
        reviewer_count: 0,
      },
    });
    expect(audit.machine_score).toBeGreaterThanOrEqual(90);
    expect(audit.diversity_report).toMatchObject({
      schema_version: 'ai-comic-series-diversity-report/v1',
      passed: true,
      exact_opening_duplicate_groups: [],
    });

    const dimensions: AiComicHumanReviewDimension[] = [
      'hook',
      'character',
      'dialogue',
      'progression',
      'turn',
      'ending',
      'cultural_credibility',
    ];
    const humanScores: AiComicHumanReviewScore[] = dimensions.map(dimension => ({
      reviewer_id: 'blind-reviewer-a',
      blind: true,
      dimension,
      score: 4,
    }));
    const humanReview = buildAiComicSeriesHumanReview(humanScores);
    expect(humanReview).toMatchObject({
      status: 'completed',
      reviewer_count: 1,
      overall_average: 4,
      minimum_dimension_average: 4,
      passed: true,
    });
  });

  it('fails missing cost and exact or dialogue-skeleton repetition, then repairs only affected beats', async () => {
    const result = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);
    const polluted = structuredClone(result.data!);
    polluted.episodes[1].commercial_beats = structuredClone(polluted.episodes[0].commercial_beats!);
    polluted.episodes[1].commercial_beats!.failure_cost = '';

    const diversity = auditAiComicSeriesDiversity(polluted);
    expect(diversity.passed).toBe(false);
    expect(diversity.exact_opening_duplicate_groups[0].episode_nos).toEqual([1, 2]);
    expect(diversity.adjacent_pair_reports[0].dialogue_token_overlap).toBe(1);

    const before = auditAiComicSeriesCommercialQuality(polluted);
    expect(before.machine_gate_passed).toBe(false);
    expect(before.episodes_need_attention).toContain(2);
    const repair = repairAiComicSeriesCommercialQuality({ plan: polluted, audit: before });
    expect(repair).toMatchObject({
      success: true,
      improved: true,
      changed_episode_nos: [2],
    });
    expect(repair.changed_fields).toEqual(['episodes[2].commercial_beats']);
    expect(repair.after_score).toBeGreaterThan(repair.before_score);
    expect(repair.plan.episodes[0]).toEqual(polluted.episodes[0]);
    expect(repair.audit.machine_gate_passed).toBe(true);
  });

  it('persists the commercial audit while keeping real human review pending', async () => {
    const planResult = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);
    const legacyCompatiblePlan = structuredClone(planResult.data!);
    legacyCompatiblePlan.episodes.forEach(episode => delete episode.commercial_beats);
    const saved = await saveAiComicSeriesProject({ plan: legacyCompatiblePlan });
    expect(saved.data?.plan.episodes.every(episode => episode.commercial_beats)).toBe(true);
    expect(saved.data?.commercial_quality_audit).toMatchObject({
      schema_version: 'ai-comic-series-commercial-quality-audit/v1',
      machine_gate_passed: true,
      human_review: {
        status: 'pending',
        reviewer_count: 0,
      },
    });

    const loaded = await getAiComicSeriesProject(saved.data!.project.series_project_id);
    expect(loaded.data?.commercial_quality_audit?.machine_gate_passed).toBe(true);
    expect(loaded.data?.commercial_quality_audit?.human_review.status).toBe('pending');
  });

  it('uses distinct opening dialogue skeletons and scene functions in E1, E10, and E20', async () => {
    const planResult = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);
    const openingDialogues: string[] = [];
    const openingFunctions: string[] = [];

    for (const episodeNo of [1, 10, 20]) {
      const episode = await generateAiComicEpisodeFromPlan({
        series_plan: planResult.data!,
        episode_no: episodeNo,
        output_gears_segments: true,
      });
      expect(episode.ok, JSON.stringify(episode.error)).toBe(true);
      openingDialogues.push(episode.data!.scene_breakdown[0].dialogue_or_narration ?? '');
      openingFunctions.push(episode.data!.scene_breakdown[0].dramatic_function);
      expect(episode.data!.full_text).toContain(planResult.data!.episodes[episodeNo - 1].commercial_beats!.hook_3s);
    }

    expect(new Set(openingDialogues).size).toBe(3);
    expect(new Set(openingFunctions).size).toBe(3);
  });
});
