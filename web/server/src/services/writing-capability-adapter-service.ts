import {
  WritingCapabilityAdapterPreflightReportV1Schema,
  WritingCapabilityAdapterV1Schema,
  WritingCapabilityRolloutPolicyV1Schema,
} from '@shared/schemas.js';
import type {
  WritingCapabilityAdapterConflictCodeV1,
  WritingCapabilityAdapterPreflightReportV1,
  WritingCapabilityAdapterRuleLayerV1,
  WritingCapabilityAdapterV1,
} from '@shared/types.js';
import { getGenreStoryProfile } from './genre-story-profiles.js';
import { createWritingCapabilityRegistry } from './writing-capability-registry.js';

const CAPABILITY_ID = 'short_drama_develop_write_review';
const VIDEO_TYPE = 'ai_comic_drama';

export const CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER = deepFreeze({
  schema_version: 'writing-capability-adapter/v1',
  adapter_id: 'short_drama_ai_comic_shadow_adapter',
  adapter_revision: 1,
  capability_id: CAPABILITY_ID,
  video_type: VIDEO_TYPE,
  profile_schema_version: 'writing-capability-profile/v1',
  source_commit: 'adab39cdfa001f272f03bbcf4e68ed005a43d8b6',
  internal_adaptation_version: 'short-drama-adapter/v1',
  rollback_id: 'disable-short-drama-ai-comic-shadow-v1',
  rules: {
    blueprint_requirements: [
      {
        rule_id: 'sd-blueprint-causal-spine',
        layer: 'blueprint_requirements',
        text: '影子预览标记单集目标、压力、策略、局部结果与结尾交接；GenreStoryProfile 继续优先。',
        source_profile_field: 'blueprint_requirements',
        source_rule_index: 0,
      },
    ],
    scene_rules: [
      {
        rule_id: 'sd-scene-action-progress',
        layer: 'scene_rules',
        text: '影子预览检查每个节拍是否由行动、调度、对白或可见证据推进。',
        source_profile_field: 'scene_rules',
        source_rule_index: 0,
      },
      {
        rule_id: 'sd-scene-hook-boundary',
        layer: 'scene_rules',
        text: '影子预览中的开场或结尾钩子不得覆盖事实、文化、安全或许可边界。',
        source_profile_field: 'scene_rules',
        source_rule_index: 1,
      },
    ],
    quality_rules: [
      {
        rule_id: 'sd-quality-causal-loop',
        layer: 'quality_rules',
        text: '影子预览检查目标—阻力—策略—局部结果—交接是否形成可定位因果链。',
        source_profile_field: 'quality_rules',
        source_rule_index: 0,
      },
      {
        rule_id: 'sd-quality-review-separation',
        layer: 'quality_rules',
        text: '影子预览把结构、证据、制作与风格发现分层记录，不授予真人审稿信用。',
        source_profile_field: 'quality_rules',
        source_rule_index: 1,
      },
    ],
    repair_guidance: [
      {
        rule_id: 'sd-repair-local-causality',
        layer: 'repair_guidance',
        text: '影子预览只提出局部行动与因果衔接建议，不直接改写故事。',
        source_profile_field: 'repair_guidance',
        source_rule_index: 0,
      },
      {
        rule_id: 'sd-repair-boundary-preservation',
        layer: 'repair_guidance',
        text: '影子预览的修复建议不得补写未证实事实、删减文化禁区或假设权利已获许可。',
        source_profile_field: 'repair_guidance',
        source_rule_index: 1,
      },
    ],
  },
  guardrails: {
    genre_story_profile_precedence: true,
    story_knowledge_evidence_precedence: true,
    cultural_safety_precedence: true,
    rights_clearance_precedence: true,
    no_rule_removal: true,
  },
  boundary: {
    preview_only: true,
    affects_generation: false,
    rules_injected: false,
    persistence_allowed: false,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityAdapterV1);

export const CANONICAL_CONTINUITY_AI_COMIC_ADAPTER = deepFreeze({
  schema_version: 'writing-capability-adapter/v1',
  adapter_id: 'continuity_ai_comic_shadow_adapter',
  adapter_revision: 1,
  capability_id: 'continuity_state_tracking',
  video_type: VIDEO_TYPE,
  profile_schema_version: 'writing-capability-profile/v1',
  source_commit: 'c482d48f4eb9b488f033a77a51f9fae55cc0d75f',
  internal_adaptation_version: 'continuity-adapter/v1',
  rollback_id: 'disable-continuity-ai-comic-shadow-v1',
  rules: {
    blueprint_requirements: [
      { rule_id: 'ct-blueprint-state-ledger', layer: 'blueprint_requirements', text: '影子预览建立人物、物件与知识状态 ledger。', source_profile_field: 'blueprint_requirements', source_rule_index: 0 },
      { rule_id: 'ct-blueprint-promise-ledger', layer: 'blueprint_requirements', text: '影子预览记录承诺、疑问与预期兑现位置。', source_profile_field: 'blueprint_requirements', source_rule_index: 1 },
    ],
    scene_rules: [
      { rule_id: 'ct-scene-state-transition', layer: 'scene_rules', text: '影子预览检查相邻场景状态跳变是否有解释。', source_profile_field: 'scene_rules', source_rule_index: 0 },
      { rule_id: 'ct-scene-timeline-marker', layer: 'scene_rules', text: '影子预览检查闪回与转述是否显式标记。', source_profile_field: 'scene_rules', source_rule_index: 1 },
    ],
    quality_rules: [
      { rule_id: 'ct-quality-order-conflict', layer: 'quality_rules', text: '影子预览定位状态、承诺与答案的顺序冲突。', source_profile_field: 'quality_rules', source_rule_index: 0 },
      { rule_id: 'ct-quality-local-evidence', layer: 'quality_rules', text: '影子预览要求连续性发现绑定具体场景。', source_profile_field: 'quality_rules', source_rule_index: 1 },
    ],
    repair_guidance: [
      { rule_id: 'ct-repair-local-transition', layer: 'repair_guidance', text: '影子预览优先提出局部状态衔接修复。', source_profile_field: 'repair_guidance', source_rule_index: 0 },
      { rule_id: 'ct-repair-evidence-boundary', layer: 'repair_guidance', text: '影子预览修复不得用虚构事实掩盖连续性缺口。', source_profile_field: 'repair_guidance', source_rule_index: 1 },
    ],
  },
  guardrails: {
    genre_story_profile_precedence: true,
    story_knowledge_evidence_precedence: true,
    cultural_safety_precedence: true,
    rights_clearance_precedence: true,
    no_rule_removal: true,
  },
  boundary: {
    preview_only: true,
    affects_generation: false,
    rules_injected: false,
    persistence_allowed: false,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityAdapterV1);

export const CANONICAL_READER_SIMULATION_AI_COMIC_ADAPTER = deepFreeze({
  schema_version: 'writing-capability-adapter/v1',
  adapter_id: 'reader_simulation_ai_comic_shadow_adapter',
  adapter_revision: 1,
  capability_id: 'reader_simulation_review',
  video_type: VIDEO_TYPE,
  profile_schema_version: 'writing-capability-profile/v1',
  source_commit: 'fb9dab2d4d23434ae76568e8de36aaf515dea8d5',
  internal_adaptation_version: 'reader-simulation-adapter/v1',
  rollback_id: 'disable-reader-simulation-ai-comic-shadow-v1',
  rules: {
    blueprint_requirements: [
      { rule_id: 'rs-blueprint-audience-promise', layer: 'blueprint_requirements', text: '影子预览记录目标受众、观看承诺和预期体验。', source_profile_field: 'blueprint_requirements', source_rule_index: 0 },
    ],
    scene_rules: [
      { rule_id: 'rs-scene-comprehension', layer: 'scene_rules', text: '影子预览检查每场的问题、变化和观看收益是否清楚。', source_profile_field: 'scene_rules', source_rule_index: 0 },
    ],
    quality_rules: [
      { rule_id: 'rs-quality-reader-journey', layer: 'quality_rules', text: '影子预览检查开场承诺、清晰度、情绪推进与结尾兑现。', source_profile_field: 'quality_rules', source_rule_index: 0 },
      { rule_id: 'rs-quality-machine-boundary', layer: 'quality_rules', text: '影子预览结论必须定位文本且不得冒充真人反馈。', source_profile_field: 'quality_rules', source_rule_index: 1 },
    ],
    repair_guidance: [
      { rule_id: 'rs-repair-comprehension-first', layer: 'repair_guidance', text: '影子预览优先修复理解阻断和承诺破坏。', source_profile_field: 'repair_guidance', source_rule_index: 0 },
      { rule_id: 'rs-repair-intent-boundary', layer: 'repair_guidance', text: '影子预览修复保留作者意图、类型规则和文化证据边界。', source_profile_field: 'repair_guidance', source_rule_index: 1 },
    ],
  },
  guardrails: {
    genre_story_profile_precedence: true,
    story_knowledge_evidence_precedence: true,
    cultural_safety_precedence: true,
    rights_clearance_precedence: true,
    no_rule_removal: true,
  },
  boundary: {
    preview_only: true,
    affects_generation: false,
    rules_injected: false,
    persistence_allowed: false,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityAdapterV1);

interface AdapterConflict {
  code: WritingCapabilityAdapterConflictCodeV1;
  path: string;
  message: string;
}

export function preflightWritingCapabilityAdapter(input: {
  adapter: unknown;
  rolloutPolicy: unknown;
}): WritingCapabilityAdapterPreflightReportV1 {
  const adapterResult = WritingCapabilityAdapterV1Schema.safeParse(input.adapter);
  if (!adapterResult.success) {
    return buildReport({
      status: 'blocked',
      conflicts: adapterResult.error.issues.map(issue => ({
        code: 'invalid_adapter_schema',
        path: issue.path.join('.') || 'adapter',
        message: issue.message,
      })),
    });
  }
  const adapter = adapterResult.data;
  const conflicts: AdapterConflict[] = [];
  const profile = createWritingCapabilityRegistry().list().find(
    candidate => candidate.capability_id === adapter.capability_id,
  );
  if (!profile) {
    conflicts.push(conflict(
      'profile_identity_mismatch',
      'capability_id',
      `adapter capability "${adapter.capability_id}" is not registered`,
    ));
  } else {
    if (
      profile.schema_version !== adapter.profile_schema_version
      || profile.source_commit !== adapter.source_commit
      || profile.enabled
    ) {
      conflicts.push(conflict(
        'profile_identity_mismatch',
        'source_commit',
        'adapter profile identity must match one disabled canonical registry profile',
      ));
    }
    if (
      !profile.allowed_video_types.includes(adapter.video_type)
      || profile.forbidden_video_types.includes(adapter.video_type)
    ) {
      conflicts.push(conflict(
        'video_type_scope_mismatch',
        'video_type',
        `adapter video_type "${adapter.video_type}" is outside the capability profile scope`,
      ));
    }
    for (const [layer, rules] of adapterRuleEntries(adapter)) {
      for (const [index, rule] of rules.entries()) {
        if (rule.source_rule_index >= profile[layer].length) {
          conflicts.push(conflict(
            'profile_identity_mismatch',
            `rules.${layer}.${index}.source_rule_index`,
            `source rule index ${rule.source_rule_index} does not exist in profile.${layer}`,
          ));
        }
      }
    }
  }

  const policyResult = WritingCapabilityRolloutPolicyV1Schema.safeParse(input.rolloutPolicy);
  if (!policyResult.success) {
    conflicts.push(conflict(
      'policy_identity_mismatch',
      'rolloutPolicy',
      'adapter preflight requires a valid rollout policy',
    ));
  } else {
    const candidate = policyResult.data.candidate;
    if (
      policyResult.data.status !== 'shadow_plan'
      || candidate.capability_id !== adapter.capability_id
      || candidate.video_type !== adapter.video_type
      || candidate.profile_schema_version !== adapter.profile_schema_version
      || candidate.source_commit !== adapter.source_commit
      || candidate.internal_adaptation_version !== adapter.internal_adaptation_version
      || candidate.rollback_id !== adapter.rollback_id
    ) {
      conflicts.push(conflict(
        'policy_identity_mismatch',
        'rolloutPolicy.candidate',
        'adapter identity must exactly match the enabled shadow-plan candidate and rollback identity',
      ));
    }
  }

  const genreProfile = getGenreStoryProfile(adapter.video_type);
  const genreRules = collectGenreRules(genreProfile);
  for (const [layer, rules] of adapterRuleEntries(adapter)) {
    for (const [index, rule] of rules.entries()) {
      const normalizedText = normalizeRule(rule.text);
      if (genreRules.has(normalizedText)) {
        conflicts.push(conflict(
          'genre_rule_duplicate',
          `rules.${layer}.${index}.text`,
          'adapter rule duplicates an existing GenreStoryProfile rule',
        ));
      }
      if (writingCapabilityTextWeakensProtectedBoundary(rule.text)) {
        conflicts.push(conflict(
          'forbidden_boundary_language',
          `rules.${layer}.${index}.text`,
          'adapter rule may weaken fact, cultural-safety, or rights-clearance boundaries',
        ));
      }
    }
  }

  return buildReport({
    status: conflicts.length === 0 ? 'passed' : 'blocked',
    adapter,
    conflicts,
  });
}

function buildReport(input: {
  status: 'passed' | 'blocked';
  adapter?: WritingCapabilityAdapterV1;
  conflicts: readonly AdapterConflict[];
}): WritingCapabilityAdapterPreflightReportV1 {
  const adapter = input.adapter;
  const previewRules = input.status === 'passed' && adapter
    ? Object.fromEntries(adapterRuleEntries(adapter).map(([layer, rules]) => [
      layer,
      rules.map(rule => rule.text),
    ]))
    : emptyPreviewRules();
  const previewRuleCount = Object.values(previewRules)
    .reduce((count, rules) => count + rules.length, 0);
  const report = WritingCapabilityAdapterPreflightReportV1Schema.parse({
    schema_version: 'writing-capability-adapter-preflight-report/v1',
    status: input.status,
    capability_id: adapter?.capability_id ?? CAPABILITY_ID,
    video_type: adapter?.video_type ?? VIDEO_TYPE,
    ...(adapter ? {
      adapter_id: adapter.adapter_id,
      adapter_revision: adapter.adapter_revision,
    } : {}),
    conflicts: input.conflicts,
    preview_rules: previewRules,
    checks: {
      genre_story_profile: true,
      story_knowledge_evidence: true,
      cultural_safety: true,
      rights_clearance: true,
      rollback_identity: true,
    },
    summary: {
      preview_rule_count: previewRuleCount,
      conflict_count: input.conflicts.length,
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
  return deepFreeze(report);
}

function adapterRuleEntries(adapter: WritingCapabilityAdapterV1) {
  return (Object.keys(adapter.rules) as WritingCapabilityAdapterRuleLayerV1[])
    .map(layer => [layer, adapter.rules[layer]] as const);
}

function emptyPreviewRules(): Record<WritingCapabilityAdapterRuleLayerV1, string[]> {
  return {
    blueprint_requirements: [],
    scene_rules: [],
    quality_rules: [],
    repair_guidance: [],
  };
}

function collectGenreRules(profile: ReturnType<typeof getGenreStoryProfile>): Set<string> {
  return new Set([
    ...profile.framework,
    ...profile.must_include,
    ...profile.avoid,
    ...profile.scene_rules,
    ...profile.quality_rules,
    ...profile.repair_guidance,
    ...profile.material_requirements,
    ...profile.truth_rules,
    ...profile.institutional_rules,
    ...profile.adaptation_rules,
  ].map(normalizeRule));
}

function normalizeRule(value: string): string {
  return value.trim().replace(/\s+/gu, '').replace(/[，。；：、,.!！?？]/gu, '');
}

export function writingCapabilityTextWeakensProtectedBoundary(value: string): boolean {
  return /(?:可以|允许|直接)(?:忽略|覆盖|绕过|删去|取消).*(?:事实|证据|文化|安全|权利|许可|授权)/u.test(value)
    || /(?:未核实|未证实).*(?:写成|改成|视为).*(?:事实|已确认|已授权)/u.test(value)
    || /视为已获许可/u.test(value);
}

function conflict(
  code: WritingCapabilityAdapterConflictCodeV1,
  path: string,
  message: string,
): AdapterConflict {
  return { code, path, message };
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
