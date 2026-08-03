import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  WritingCapabilityRolloutPolicyV1Schema,
  WritingCapabilityShadowPreparationPlanV1Schema,
} from '@shared/schemas.js';
import type { StoryGenerateRequest } from '@shared/types.js';
import {
  prepareChinaCultureStoryGeneration,
} from '../domains/china-culture/story-generation-preparation-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  buildWritingCapabilityShadowPreparationPlan,
} from '../services/writing-capability-rollout-service.js';

const CAPABILITY_ID = 'short_drama_develop_write_review';
const REQUEST: StoryGenerateRequest = {
  video_type: 'ai_comic_drama',
  presentation_style: 'ai_comic',
  creation_use_case: 'original_ai_comic',
  truth_mode: 'fictional_original',
  original_user_query: '标题：影子能力测试。少年发现古桥即将被洪水冲毁，决定召集伙伴守桥。',
};

describe('writing capability rollout shadow contract', () => {
  it('accepts exactly one shadow candidate and rejects global or active enablement', () => {
    expect(WritingCapabilityRolloutPolicyV1Schema.safeParse(
      CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    ).success).toBe(true);
    expect(WritingCapabilityRolloutPolicyV1Schema.safeParse({
      ...CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      status: 'enabled',
    }).success).toBe(false);
    expect(WritingCapabilityRolloutPolicyV1Schema.safeParse({
      ...CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      global_enablement_allowed: true,
    }).success).toBe(false);
    expect(WritingCapabilityRolloutPolicyV1Schema.safeParse({
      ...CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      candidates: [
        CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY.candidate,
        CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY.candidate,
      ],
    }).success).toBe(false);
    expect(Object.isFrozen(CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY)).toBe(true);
    expect(Object.isFrozen(CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY.candidate)).toBe(true);
  });

  it('builds one exact shadow-ready plan while keeping every projected rule list empty', () => {
    const plan = buildWritingCapabilityShadowPreparationPlan({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: [CAPABILITY_ID],
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });

    expect(WritingCapabilityShadowPreparationPlanV1Schema.safeParse(plan).success).toBe(true);
    expect(plan).toMatchObject({
      schema_version: 'writing-capability-shadow-preparation-plan/v1',
      status: 'shadow_ready',
      video_type: 'ai_comic_drama',
      requested_capability_ids: [CAPABILITY_ID],
      policy: {
        policy_id: 'short_drama_ai_comic_shadow_20260801',
        policy_revision: 1,
        status: 'shadow_plan',
        capability_id: CAPABILITY_ID,
        video_type: 'ai_comic_drama',
        profile_schema_version: 'writing-capability-profile/v1',
        source_commit: 'adab39cdfa001f272f03bbcf4e68ed005a43d8b6',
        internal_adaptation_version: 'short-drama-adapter/v1',
        rollback_id: 'disable-short-drama-ai-comic-shadow-v1',
      },
      routing_report: {
        active_capability_ids: [],
        decisions: [{ reason_code: 'profile_disabled' }],
      },
      projected_rules: {
        blueprint_requirements: [],
        scene_rules: [],
        quality_rules: [],
        repair_guidance: [],
      },
      boundary: {
        shadow_only: true,
        affects_generation: false,
        profile_rules_injected: false,
        runtime_activation_allowed: false,
        global_enablement_allowed: false,
        persistence_allowed: false,
      },
    });
    expect(plan.issues).toEqual([]);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.projected_rules)).toBe(true);
  });

  it('fails closed to mismatch, disabled, or incompatible policy states', () => {
    const wrongType = buildWritingCapabilityShadowPreparationPlan({
      videoType: 'children_story',
      requestedCapabilityIds: [CAPABILITY_ID],
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });
    const wrongCapability = buildWritingCapabilityShadowPreparationPlan({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: ['reader_simulation_review'],
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });
    const disabled = buildWritingCapabilityShadowPreparationPlan({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: [CAPABILITY_ID],
      rolloutPolicy: {
        ...CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
        status: 'disabled',
      },
    });
    const commitDrift = buildWritingCapabilityShadowPreparationPlan({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: [CAPABILITY_ID],
      rolloutPolicy: {
        ...CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
        candidate: {
          ...CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY.candidate,
          source_commit: '0000000000000000000000000000000000000000',
        },
      },
    });

    expect(wrongType).toMatchObject({ status: 'candidate_mismatch' });
    expect(wrongCapability).toMatchObject({ status: 'candidate_mismatch' });
    expect(disabled).toMatchObject({ status: 'policy_disabled' });
    expect(commitDrift).toMatchObject({
      status: 'policy_incompatible',
      issues: [expect.stringContaining('source_commit')],
    });
    for (const plan of [wrongType, wrongCapability, disabled, commitDrift]) {
      expect(plan.routing_report.active_capability_ids).toEqual([]);
      expect(plan.projected_rules).toEqual({
        blueprint_requirements: [],
        scene_rules: [],
        quality_rules: [],
        repair_guidance: [],
      });
      expect(plan.boundary.affects_generation).toBe(false);
    }
  });

  it('keeps default preparation byte-compatible and adds shadow plan only when explicitly requested', async () => {
    const baseline = await prepareChinaCultureStoryGeneration(REQUEST);
    const explicitDefault = await prepareChinaCultureStoryGeneration(REQUEST, {});
    const shadow = await prepareChinaCultureStoryGeneration(REQUEST, {
      writingCapability: {
        enabled: true,
        requestedCapabilityIds: [CAPABILITY_ID],
        rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      },
    });

    expect(explicitDefault).toEqual(baseline);
    expect(baseline).not.toHaveProperty('writingCapabilityShadowPlan');
    expect(shadow.ok).toBe(true);
    if (!baseline.ok || !shadow.ok) return;
    expect(shadow.writingCapabilityShadowPlan).toMatchObject({
      status: 'shadow_ready',
      boundary: {
        affects_generation: false,
        profile_rules_injected: false,
      },
    });
    expect(shadow.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
  });

  it('keeps the shadow plan out of public request, prompt, fallback, quality, repair, and persistence', async () => {
    const [schemas, preparation, prompt, fallback, quality, repair, document] = await Promise.all([
      readFile(new URL('../../../shared/schemas.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-generation-prompt.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/dramatic-story.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/genre-quality-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-repair-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-document-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(preparation).toContain('buildWritingCapabilityShadowPreparationPlan(');
    expect(schemas.slice(schemas.indexOf('export const StoryGenerateRequestSchema')))
      .not.toContain('writing_capability');
    for (const source of [prompt, fallback, quality, repair, document]) {
      expect(source).not.toContain('WritingCapabilityShadowPreparationPlanV1');
      expect(source).not.toContain('writingCapabilityShadowPlan');
    }
  });

  it('publishes a reproducible 15-type single-candidate shadow baseline', async () => {
    const report = JSON.parse(await readFile(
      new URL('../../../../data/reports/story-agent-writing-capability-m2-shadow-plan-baseline.json', import.meta.url),
      'utf8',
    )) as Record<string, unknown>;

    expect(report).toMatchObject({
      schema_version: 'writing-capability-shadow-plan-baseline/v1',
      status: 'passed',
      video_type_count: 15,
      shadow_ready_count: 1,
      active_capability_count: 0,
      projected_rule_count: 0,
      status_counts: {
        shadow_ready: 1,
        candidate_mismatch: 14,
      },
      matrix_sha256: '0d98d1e96a7507e9099b7bb3b6c2bbb01e9126f90f472735c9a05b56c1fde177',
      invariants: {
        covers_all_15_video_types: true,
        exactly_one_shadow_ready: true,
        only_ai_comic_is_shadow_ready: true,
        all_routes_remain_inactive: true,
        all_projected_rule_lists_empty: true,
        no_generation_effect: true,
        no_runtime_activation: true,
        no_global_enablement: true,
        no_persistence: true,
      },
    });
  });
});
