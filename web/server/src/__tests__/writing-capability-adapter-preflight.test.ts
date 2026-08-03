import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  WritingCapabilityAdapterPreflightReportV1Schema,
  WritingCapabilityAdapterV1Schema,
  WritingCapabilityShadowPreparationPlanV1Schema,
} from '@shared/schemas.js';
import type { StoryGenerateRequest } from '@shared/types.js';
import {
  prepareChinaCultureStoryGeneration,
} from '../domains/china-culture/story-generation-preparation-service.js';
import {
  CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  preflightWritingCapabilityAdapter,
} from '../services/writing-capability-adapter-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  buildWritingCapabilityShadowPreparationPlan,
} from '../services/writing-capability-rollout-service.js';

const CAPABILITY_ID = 'short_drama_develop_write_review';
const EMPTY_RULES = {
  blueprint_requirements: [],
  scene_rules: [],
  quality_rules: [],
  repair_guidance: [],
};
const REQUEST: StoryGenerateRequest = {
  video_type: 'ai_comic_drama',
  presentation_style: 'ai_comic',
  creation_use_case: 'original_ai_comic',
  truth_mode: 'fictional_original',
  original_user_query: '标题：适配器影子测试。少年发现古桥将被洪水冲毁，决定召集伙伴守桥。',
};

describe('writing capability static adapter preflight', () => {
  it('defines one frozen seven-rule adapter split across four preview layers', () => {
    expect(WritingCapabilityAdapterV1Schema.safeParse(
      CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
    ).success).toBe(true);
    expect(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER).toMatchObject({
      schema_version: 'writing-capability-adapter/v1',
      adapter_id: 'short_drama_ai_comic_shadow_adapter',
      adapter_revision: 1,
      capability_id: CAPABILITY_ID,
      video_type: 'ai_comic_drama',
      internal_adaptation_version: 'short-drama-adapter/v1',
      rollback_id: 'disable-short-drama-ai-comic-shadow-v1',
      boundary: {
        preview_only: true,
        affects_generation: false,
        rules_injected: false,
        third_party_code_executed: false,
      },
    });
    expect(Object.values(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.rules)
      .map(rules => rules.length)).toEqual([1, 2, 2, 2]);
    expect(new Set(Object.values(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.rules)
      .flatMap(rules => rules.map(rule => rule.rule_id))).size).toBe(7);
    expect(Object.isFrozen(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER)).toBe(true);
    expect(Object.isFrozen(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.rules.scene_rules)).toBe(true);
  });

  it('passes the canonical adapter while exposing only a read-only preview', () => {
    const report = preflightWritingCapabilityAdapter({
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });

    expect(WritingCapabilityAdapterPreflightReportV1Schema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      schema_version: 'writing-capability-adapter-preflight-report/v1',
      status: 'passed',
      capability_id: CAPABILITY_ID,
      video_type: 'ai_comic_drama',
      conflicts: [],
      checks: {
        genre_story_profile: true,
        story_knowledge_evidence: true,
        cultural_safety: true,
        rights_clearance: true,
        rollback_identity: true,
      },
      summary: {
        preview_rule_count: 7,
        conflict_count: 0,
      },
      boundary: {
        preview_only: true,
        affects_generation: false,
        rules_injected: false,
        persistence_allowed: false,
        public_api_exposed: false,
        third_party_code_executed: false,
      },
    });
    expect(Object.values(report.preview_rules).map(rules => rules.length)).toEqual([1, 2, 2, 2]);
    expect(Object.isFrozen(report)).toBe(true);
  });

  it('fails closed for duplicate IDs or text and returns no preview rules', () => {
    const canonical = CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER;
    const duplicateId = structuredClone(canonical);
    duplicateId.rules.scene_rules[1].rule_id = duplicateId.rules.scene_rules[0].rule_id;
    const duplicateText = structuredClone(canonical);
    duplicateText.rules.quality_rules[1].text = duplicateText.rules.quality_rules[0].text;

    for (const adapter of [duplicateId, duplicateText]) {
      const report = preflightWritingCapabilityAdapter({
        adapter,
        rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      });
      expect(report.status).toBe('blocked');
      expect(report.conflicts.map(conflict => conflict.code)).toContain('invalid_adapter_schema');
      expect(report.preview_rules).toEqual(EMPTY_RULES);
      expect(report.summary.preview_rule_count).toBe(0);
    }
  });

  it('blocks type, source, policy, rollback, and source-rule mapping drift', () => {
    const cases = [
      {
        adapter: {
          ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
          video_type: 'children_story',
        },
        code: 'video_type_scope_mismatch',
      },
      {
        adapter: {
          ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
          source_commit: '0000000000000000000000000000000000000000',
        },
        code: 'profile_identity_mismatch',
      },
      {
        adapter: {
          ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
          internal_adaptation_version: 'short-drama-adapter/v2',
        },
        code: 'policy_identity_mismatch',
      },
      {
        adapter: {
          ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
          rollback_id: 'different-rollback-v1',
        },
        code: 'policy_identity_mismatch',
      },
      {
        adapter: {
          ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
          rules: {
            ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.rules,
            scene_rules: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.rules.scene_rules.map((rule, index) => (
              index === 0 ? { ...rule, source_rule_index: 99 } : rule
            )),
          },
        },
        code: 'profile_identity_mismatch',
      },
    ] as const;

    for (const sample of cases) {
      const report = preflightWritingCapabilityAdapter({
        adapter: sample.adapter,
        rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      });
      expect(report.status).toBe('blocked');
      expect(report.conflicts.map(conflict => conflict.code)).toContain(sample.code);
      expect(report.preview_rules).toEqual(EMPTY_RULES);
    }
  });

  it('blocks rules that weaken facts, cultural safety, or rights boundaries', () => {
    const unsafeAdapter = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER);
    unsafeAdapter.rules.repair_guidance[0].text = '为了节奏可以忽略未证实事实，并视为已获许可。';
    const report = preflightWritingCapabilityAdapter({
      adapter: unsafeAdapter,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });

    expect(report).toMatchObject({
      status: 'blocked',
      preview_rules: EMPTY_RULES,
    });
    expect(report.conflicts.map(conflict => conflict.code))
      .toContain('forbidden_boundary_language');
  });

  it('attaches a passing adapter preview without projecting rules into runtime', () => {
    const baseline = buildWritingCapabilityShadowPreparationPlan({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: [CAPABILITY_ID],
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });
    const preview = buildWritingCapabilityShadowPreparationPlan({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: [CAPABILITY_ID],
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
    });

    expect(baseline).not.toHaveProperty('adapter_preview');
    expect(preview).toMatchObject({
      status: 'shadow_ready',
      projected_rules: EMPTY_RULES,
      adapter_preview: {
        status: 'passed',
        summary: { preview_rule_count: 7, conflict_count: 0 },
      },
    });
    expect(WritingCapabilityShadowPreparationPlanV1Schema.safeParse(preview).success).toBe(true);
  });

  it('marks a rejected adapter as adapter_blocked and keeps runtime projection empty', () => {
    const adapter = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER);
    adapter.rollback_id = 'different-rollback-v1';
    const plan = buildWritingCapabilityShadowPreparationPlan({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: [CAPABILITY_ID],
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      adapter,
    });

    expect(plan).toMatchObject({
      status: 'adapter_blocked',
      projected_rules: EMPTY_RULES,
      adapter_preview: {
        status: 'blocked',
        preview_rules: EMPTY_RULES,
      },
      boundary: {
        affects_generation: false,
        profile_rules_injected: false,
      },
    });

    expect(WritingCapabilityShadowPreparationPlanV1Schema.safeParse({
      ...plan,
      policy: {
        ...plan.policy,
        video_type: 'children_story',
      },
    }).success).toBe(false);
  });

  it('keeps default preparation byte-compatible and the explicit preview outside the blueprint', async () => {
    const baseline = await prepareChinaCultureStoryGeneration(REQUEST);
    const preview = await prepareChinaCultureStoryGeneration(REQUEST, {
      writingCapability: {
        enabled: true,
        requestedCapabilityIds: [CAPABILITY_ID],
        rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
        adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      },
    });

    expect(baseline).not.toHaveProperty('writingCapabilityShadowPlan');
    expect(preview.ok).toBe(true);
    if (!baseline.ok || !preview.ok) return;
    expect(preview.writingCapabilityShadowPlan).toMatchObject({
      status: 'shadow_ready',
      projected_rules: EMPTY_RULES,
      adapter_preview: { status: 'passed' },
    });
    expect(preview.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
  });

  it('keeps adapter preview imports out of prompt, fallback, quality, repair, and persistence', async () => {
    const sources = await Promise.all([
      readFile(new URL('../services/story-generation-prompt.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/dramatic-story.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/genre-quality-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-repair-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-document-service.ts', import.meta.url), 'utf8'),
    ]);

    for (const source of sources) {
      expect(source).not.toContain('WritingCapabilityAdapter');
      expect(source).not.toContain('adapter_preview');
    }
  });

  it('publishes a reproducible fail-closed adapter preflight baseline', async () => {
    const report = JSON.parse(await readFile(
      new URL(
        '../../../../data/reports/story-agent-writing-capability-m2-adapter-preflight-baseline.json',
        import.meta.url,
      ),
      'utf8',
    )) as Record<string, unknown>;

    expect(report).toMatchObject({
      schema_version: 'writing-capability-adapter-preflight-baseline/v1',
      status: 'passed',
      preview_rule_count: 7,
      preview_layer_counts: {
        blueprint_requirements: 1,
        scene_rules: 2,
        quality_rules: 2,
        repair_guidance: 2,
      },
      negative_case_count: 8,
      blocked_negative_case_count: 8,
      active_capability_count: 0,
      runtime_projected_rule_count: 0,
      baseline_sha256: '95bdb8a4128d47e86f09a8fe5f6be8b4c51ce9357f044f316335bcef1c7163ef',
      invariants: {
        canonical_adapter_passes: true,
        exactly_seven_preview_rules: true,
        expected_layer_split: true,
        all_negative_cases_blocked: true,
        blocked_cases_expose_no_preview_rules: true,
        baseline_shape_unchanged_without_adapter: true,
        preview_attached_only_when_requested: true,
        runtime_projected_rules_remain_empty: true,
        active_capability_count_remains_zero: true,
        no_generation_effect: true,
        no_persistence: true,
        no_public_api: true,
        no_third_party_execution: true,
      },
    });
  });
});
