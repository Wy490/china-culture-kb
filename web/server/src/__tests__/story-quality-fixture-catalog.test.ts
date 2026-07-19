import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import { getGenreStoryProfile } from '../services/genre-story-profiles.js';
import { rebuildDerivedStoryState } from '../services/derived-story-state-service.js';
import { buildStoryQualityFixtureCatalog } from './fixtures/story-quality-fixtures.js';

const catalog = buildStoryQualityFixtureCatalog();

describe('15-type story quality fixture catalog', () => {
  it('provides one complete, sparse, and failure fixture for every VideoType', () => {
    expect(catalog).toHaveLength(15);
    expect(new Set(catalog.map(item => item.video_type))).toHaveLength(15);
    for (const fixture of catalog) {
      expect(fixture.complete.storyId).toContain(fixture.video_type);
      expect(fixture.sparse.storyId).toContain('sparse');
      expect(fixture.failure.storyId).toContain('failure');
    }
  });

  it.each(catalog.map(item => [item.video_type, item.complete] as const))(
    'complete %s fixture has explainable family, required-field, and signal evidence',
    async (videoType, story) => {
      const rebuilt = await rebuildDerivedStoryState(story, { revalidateDomainSafety: false });
      const quality = rebuilt.quality_report!;
      const profile = getGenreStoryProfile(videoType);
      const signals = [
        ...(quality.pattern_quality_report?.satisfied_signals ?? []),
        ...(quality.pattern_quality_report?.weak_signals ?? []),
      ];

      expect(quality.family_quality_report?.passed).toBe(true);
      expect(quality.family_quality_report?.checks.length).toBeGreaterThanOrEqual(4);
      expect(quality.missing_required_elements).toEqual([]);
      for (const field of profile.required_fields) {
        expect(hasFieldValue(rebuilt, field), `${videoType}.${field}`).toBe(true);
      }
      expect(quality.pattern_quality_report?.schema_version).toBe('pattern-quality/v2');
      expect(signals.length).toBeGreaterThan(0);
      expect(signals.every(signal => (
        Array.isArray(signal.evidence_scene_ids)
        && Array.isArray(signal.observable_evidence)
        && Array.isArray(signal.counter_evidence)
        && signal.confidence >= 0
        && signal.confidence <= 1
        && Array.isArray(signal.repair_target.scene_ids)
        && signal.repair_target.fields.length > 0
      ))).toBe(true);
      expect(quality.issues.join('\n')).not.toMatch(/缺少主角选择|缺少明确冲突|缺少高潮场景|缺少结尾主题/);
    },
  );

  it.each(catalog.map(item => [item.video_type, item.sparse] as const))(
    'sparse %s fixture blocks production material without creating a family-text failure',
    async (_videoType, story) => {
      const rebuilt = await rebuildDerivedStoryState(story, { revalidateDomainSafety: false });
      const quality = rebuilt.quality_report!;

      expect(quality.family_quality_report?.passed).toBe(true);
      expect(quality.production_material_readiness_report).toMatchObject({
        status: 'blocked',
        passed: false,
      });
      expect(quality.quality_gates?.production_material_gate.status).toBe('failed');
      expect(quality.quality_gates?.production_ready).toBe(false);
      expect(quality.quality_gates?.narrative_gate.issues.join('\n')).not.toContain('生产参考素材');
      expect(quality.family_quality_report?.blocking_check_ids).toEqual([]);
    },
  );

  it.each(catalog.map(item => [item.video_type, item.failure] as const))(
    'failure %s fixture reports observable family blockers',
    async (_videoType, story) => {
      const rebuilt = await rebuildDerivedStoryState(story, { revalidateDomainSafety: false });
      const family = rebuilt.quality_report?.family_quality_report;

      expect(family?.passed).toBe(false);
      expect(family?.blocking_check_ids.length).toBeGreaterThan(0);
      expect(family?.checks.filter(check => check.status === 'failed').length).toBeGreaterThan(0);
      expect(rebuilt.quality_report?.quality_gates?.narrative_gate.status).toBe('failed');
      const familyRepair = rebuilt.quality_report?.repair_action_items
        ?.find(action => action.target_report === 'family');
      expect(familyRepair).toBeDefined();
      expect(familyRepair?.prompt).toContain(family?.family_label ?? '');
      expect(familyRepair?.prompt).not.toContain('统一补强主角目标');
    },
  );

  it.each(catalog.map(item => [item.video_type, item.complete] as const))(
    'aligns %s machine evidence to a blank three-role human review form',
    async (_videoType, story) => {
      const rebuilt = await rebuildDerivedStoryState(story, { revalidateDomainSafety: false });
      const alignment = rebuilt.quality_report?.human_review_alignment;
      const criteria = alignment?.sections.flatMap(section => section.criteria) ?? [];
      const sourceRefs = criteria.flatMap(criterion => criterion.source_refs);
      const familyCheckIds = rebuilt.quality_report?.family_quality_report?.checks
        .map(check => `family:${check.check_id}`) ?? [];

      expect(alignment).toMatchObject({
        schema_version: 'story-human-review-alignment/v1',
        machine_prefill_only: true,
        review_status: 'awaiting_human_review',
        human_review_complete: false,
        human_blind_review_passed: false,
        professional_passed: false,
      });
      expect(alignment?.sections.map(section => section.role)).toEqual([
        'screenwriter_or_script_editor',
        'genre_or_director_reviewer',
        'fact_or_culture_reviewer',
      ]);
      expect(alignment?.weight_contract_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(new Set(criteria.map(criterion => criterion.dimension_id)).size).toBe(10);
      expect(criteria.every(criterion => (
        criterion.human_verdict === 'not_reviewed'
        && criterion.human_score === null
        && criterion.human_notes === ''
        && criterion.counts_as_human_review_credit === false
      ))).toBe(true);
      expect(familyCheckIds.every(checkId => sourceRefs.includes(checkId))).toBe(true);
    },
  );

  it('keeps sparse production blockers in the director section without failing the story review', async () => {
    const story = catalog.find(item => item.video_type === 'heritage_promo')!.sparse;
    const rebuilt = await rebuildDerivedStoryState(story, { revalidateDomainSafety: false });
    const alignment = rebuilt.quality_report?.human_review_alignment;
    const director = alignment?.sections.find(section => section.role === 'genre_or_director_reviewer');
    const production = director?.criteria.find(criterion => criterion.dimension_id === 'production_executability');

    expect(rebuilt.quality_report?.quality_gates?.story_publishable).toBe(true);
    expect(rebuilt.quality_report?.quality_gates?.production_ready).toBe(false);
    expect(production).toMatchObject({
      machine_status: 'attention_required',
      human_verdict: 'not_reviewed',
      counts_as_human_review_credit: false,
    });
    expect(production?.source_refs).toContain('gate:production_material_gate');
  });

  it('routes family failure evidence to human attention without granting a verdict', async () => {
    const story = catalog.find(item => item.video_type === 'documentary_short')!.failure;
    const rebuilt = await rebuildDerivedStoryState(story, { revalidateDomainSafety: false });
    const alignment = rebuilt.quality_report?.human_review_alignment;
    const criteria = alignment?.sections.flatMap(section => section.criteria) ?? [];

    expect(criteria.some(criterion => criterion.machine_status === 'attention_required'
      && criterion.source_refs.some(ref => ref.startsWith('family:')))).toBe(true);
    expect(criteria.every(criterion => criterion.human_verdict === 'not_reviewed')).toBe(true);
    expect(alignment?.professional_passed).toBe(false);
  });
});

function hasFieldValue(story: StoryGenerateResult, field: string): boolean {
  const value = (story as unknown as Record<string, unknown>)[field];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}
