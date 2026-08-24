// web/shared/schemas.ts — Zod validation schemas for Web API

import { z } from 'zod';
import { GEARS_CALLBACK_BATCH_ITEM_LIMIT } from './types.js';

// ---------------------------------------------------------------------------
// Generation type (3 modes) — backward compat
// ---------------------------------------------------------------------------

export const GenerationTypeSchema = z.enum([
  'character_story',
  'culture_promo',
  'scene_short',
]);

export const StoryGenerationModelProfileIdSchema = z.enum([
  'local_story_engine',
  'claude_sonnet',
  'claude_opus',
  'codex_gpt55',
]);

// ---------------------------------------------------------------------------
// Video type (15 成片类型)
// ---------------------------------------------------------------------------

export const VideoTypeSchema = z.enum([
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'children_story',
  'social_short',
  'ai_comic_drama',
]);

const WritingCapabilityNonEmptyTextSchema = z.string().trim().min(1);
const WritingCapabilityIdSchema = z.string().regex(/^[a-z][a-z0-9_]{2,63}$/);
const WritingCapabilityUniqueVideoTypesSchema = z.array(VideoTypeSchema)
  .refine(
    values => new Set(values).size === values.length,
    'video type lists must not contain duplicates',
  );
const WritingCapabilityAllowedVideoTypesSchema = WritingCapabilityUniqueVideoTypesSchema.refine(
  values => values.length > 0,
  'allowed_video_types must contain at least one video type',
);

export const WritingCapabilityProvenanceV1Schema = z.object({
  audited_at: z.string().datetime({ offset: true }),
  audit_scope: z.array(WritingCapabilityNonEmptyTextSchema).min(1),
  adopted_methods: z.array(WritingCapabilityNonEmptyTextSchema).min(1),
  excluded_components: z.array(WritingCapabilityNonEmptyTextSchema).min(1),
  risk_notes: z.array(WritingCapabilityNonEmptyTextSchema).min(1),
  static_adaptation_only: z.literal(true),
  third_party_code_executed: z.literal(false),
  external_network_access_allowed: z.literal(false),
  external_file_write_allowed: z.literal(false),
  external_command_execution_allowed: z.literal(false),
}).strict();

export const WritingCapabilityProfileV1Schema = z.object({
  schema_version: z.literal('writing-capability-profile/v1'),
  capability_id: WritingCapabilityIdSchema,
  display_name: WritingCapabilityNonEmptyTextSchema.max(120),
  source_repository: z.string().url().refine(
    value => /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(value),
    'source_repository must be a canonical GitHub repository URL',
  ),
  source_commit: z.string().regex(
    /^[a-f0-9]{40}$/,
    'source_commit must be a pinned full Git commit SHA',
  ),
  source_author: WritingCapabilityNonEmptyTextSchema.max(120),
  license: WritingCapabilityNonEmptyTextSchema.max(120),
  adapted_rules: z.array(WritingCapabilityNonEmptyTextSchema).min(1),
  allowed_video_types: WritingCapabilityAllowedVideoTypesSchema,
  forbidden_video_types: WritingCapabilityUniqueVideoTypesSchema,
  blueprint_requirements: z.array(WritingCapabilityNonEmptyTextSchema),
  scene_rules: z.array(WritingCapabilityNonEmptyTextSchema),
  quality_rules: z.array(WritingCapabilityNonEmptyTextSchema).min(1),
  repair_guidance: z.array(WritingCapabilityNonEmptyTextSchema).min(1),
  provenance: WritingCapabilityProvenanceV1Schema,
  enabled: z.boolean(),
}).strict().superRefine((profile, context) => {
  const forbidden = new Set(profile.forbidden_video_types);
  const conflicts = profile.allowed_video_types.filter(videoType => forbidden.has(videoType));
  if (conflicts.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['allowed_video_types'],
      message: `allowed_video_types conflicts with forbidden_video_types: ${conflicts.join(', ')}`,
    });
  }
});

export const WritingCapabilityCatalogItemV1Schema = z.object({
  capability_id: WritingCapabilityIdSchema,
  display_name: WritingCapabilityNonEmptyTextSchema.max(120),
  source_repository: z.string().url().refine(
    value => /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(value),
    'source_repository must be a canonical GitHub repository URL',
  ),
  source_commit: z.string().regex(
    /^[a-f0-9]{40}$/,
    'source_commit must be a pinned full Git commit SHA',
  ),
  source_author: WritingCapabilityNonEmptyTextSchema.max(120),
  license: WritingCapabilityNonEmptyTextSchema.max(120),
  allowed_video_types: WritingCapabilityAllowedVideoTypesSchema,
  forbidden_video_types: WritingCapabilityUniqueVideoTypesSchema,
  adapted_rule_count: z.number().int().positive(),
  audited_at: z.string().datetime({ offset: true }),
  enabled: z.boolean(),
}).strict();

export const WritingCapabilityCatalogReportV1Schema = z.object({
  schema_version: z.literal('writing-capability-catalog-report/v1'),
  profile_schema_version: z.literal('writing-capability-profile/v1'),
  total_count: z.number().int().nonnegative(),
  enabled_count: z.number().int().nonnegative(),
  disabled_count: z.number().int().nonnegative(),
  boundary: z.object({
    catalog_only: z.literal(true),
    affects_generation: z.literal(false),
    third_party_code_executed: z.literal(false),
    external_execution_allowed: z.literal(false),
  }).strict(),
  capabilities: z.array(WritingCapabilityCatalogItemV1Schema),
}).strict().superRefine((report, context) => {
  const enabledCount = report.capabilities.filter(capability => capability.enabled).length;
  const capabilityIds = report.capabilities.map(capability => capability.capability_id);

  if (report.total_count !== report.capabilities.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['total_count'],
      message: 'total_count must match capabilities.length',
    });
  }
  if (
    report.enabled_count !== enabledCount
    || report.disabled_count !== report.capabilities.length - enabledCount
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['enabled_count'],
      message: 'enabled_count and disabled_count must match capability states',
    });
  }
  if (new Set(capabilityIds).size !== capabilityIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['capabilities'],
      message: 'capability identifiers must be unique',
    });
  }
});

export const WritingCapabilityRoutingRequestV1Schema = z.object({
  schema_version: z.literal('writing-capability-routing-request/v1'),
  video_type: VideoTypeSchema,
  requested_capability_ids: z.array(WritingCapabilityIdSchema)
    .max(20)
    .refine(
      values => new Set(values).size === values.length,
      'requested_capability_ids must be unique',
    ),
}).strict();

export const WritingCapabilityRoutingDecisionV1Schema = z.object({
  capability_id: WritingCapabilityIdSchema,
  status: z.literal('rejected'),
  reason_code: z.enum([
    'unknown_capability',
    'video_type_forbidden',
    'video_type_not_allowed',
    'profile_disabled',
  ]),
  message: WritingCapabilityNonEmptyTextSchema,
  profile_enabled: z.literal(false).optional(),
  profile_schema_version: z.literal('writing-capability-profile/v1').optional(),
  source_commit: z.string().regex(/^[a-f0-9]{40}$/).optional(),
}).strict().superRefine((decision, context) => {
  const profileFields = [
    decision.profile_enabled,
    decision.profile_schema_version,
    decision.source_commit,
  ];
  if (
    decision.reason_code === 'unknown_capability'
    && profileFields.some(value => value !== undefined)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason_code'],
      message: 'unknown capabilities cannot claim profile metadata',
    });
  }
  if (
    decision.reason_code !== 'unknown_capability'
    && profileFields.some(value => value === undefined)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['profile_schema_version'],
      message: 'registered capability decisions require complete profile metadata',
    });
  }
});

export const WritingCapabilityRoutingReportV1Schema = z.object({
  schema_version: z.literal('writing-capability-routing-report/v1'),
  video_type: VideoTypeSchema,
  requested_capability_ids: z.array(WritingCapabilityIdSchema),
  active_capability_ids: z.array(WritingCapabilityIdSchema).max(0),
  decisions: z.array(WritingCapabilityRoutingDecisionV1Schema),
  summary: z.object({
    requested_count: z.number().int().nonnegative(),
    decision_count: z.number().int().nonnegative(),
    active_count: z.literal(0),
    eligible_but_disabled_count: z.number().int().nonnegative(),
    incompatible_count: z.number().int().nonnegative(),
  }).strict(),
  boundary: z.object({
    router_only: z.literal(true),
    affects_generation: z.literal(false),
    runtime_enablement_supported: z.literal(false),
    profile_rules_injected: z.literal(false),
    third_party_code_executed: z.literal(false),
    all_profiles_default_disabled: z.literal(true),
  }).strict(),
}).strict().superRefine((report, context) => {
  const requested = report.requested_capability_ids;
  const decisionIds = report.decisions.map(decision => decision.capability_id);
  const sortedRequested = [...requested].sort((left, right) => left.localeCompare(right));
  const eligibleButDisabledCount = report.decisions.filter(
    decision => decision.reason_code === 'profile_disabled',
  ).length;
  const incompatibleCount = report.decisions.length - eligibleButDisabledCount;

  if (
    new Set(requested).size !== requested.length
    || requested.some((id, index) => id !== sortedRequested[index])
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requested_capability_ids'],
      message: 'requested_capability_ids must be unique and sorted',
    });
  }
  if (
    decisionIds.length !== requested.length
    || decisionIds.some((id, index) => id !== requested[index])
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['decisions'],
      message: 'decisions must correspond one-to-one with requested_capability_ids',
    });
  }
  if (
    report.summary.requested_count !== requested.length
    || report.summary.decision_count !== report.decisions.length
    || report.summary.eligible_but_disabled_count !== eligibleButDisabledCount
    || report.summary.incompatible_count !== incompatibleCount
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary'],
      message: 'routing summary counts must match decisions',
    });
  }
});

export const WritingCapabilityRolloutPolicyV1Schema = z.object({
  schema_version: z.literal('writing-capability-rollout-policy/v1'),
  policy_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  policy_revision: z.number().int().positive(),
  status: z.enum(['disabled', 'shadow_plan']),
  candidate: z.object({
    capability_id: WritingCapabilityIdSchema,
    video_type: VideoTypeSchema,
    profile_schema_version: z.literal('writing-capability-profile/v1'),
    source_commit: z.string().regex(/^[a-f0-9]{40}$/),
    internal_adaptation_version: z.string().regex(/^[a-z][a-z0-9-]{2,63}\/v[1-9][0-9]*$/),
    rollback_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
  }).strict(),
  boundary: z.object({
    exact_single_capability: z.literal(true),
    exact_single_video_type: z.literal(true),
    global_enablement_allowed: z.literal(false),
    runtime_activation_allowed: z.literal(false),
    affects_generation: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict();

const WritingCapabilityAdapterRuleLayerV1Schema = z.enum([
  'blueprint_requirements',
  'scene_rules',
  'quality_rules',
  'repair_guidance',
]);

const WritingCapabilityAdapterRuleV1Schema = z.object({
  rule_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
  layer: WritingCapabilityAdapterRuleLayerV1Schema,
  text: WritingCapabilityNonEmptyTextSchema,
  source_profile_field: WritingCapabilityAdapterRuleLayerV1Schema,
  source_rule_index: z.number().int().nonnegative(),
}).strict().superRefine((rule, context) => {
  if (rule.layer !== rule.source_profile_field) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source_profile_field'],
      message: 'source_profile_field must match the adapter rule layer',
    });
  }
});

export const WritingCapabilityAdapterV1Schema = z.object({
  schema_version: z.literal('writing-capability-adapter/v1'),
  adapter_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  adapter_revision: z.number().int().positive(),
  capability_id: WritingCapabilityIdSchema,
  video_type: VideoTypeSchema,
  profile_schema_version: z.literal('writing-capability-profile/v1'),
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  internal_adaptation_version: z.string().regex(/^[a-z][a-z0-9-]{2,63}\/v[1-9][0-9]*$/),
  rollback_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
  rules: z.object({
    blueprint_requirements: z.array(WritingCapabilityAdapterRuleV1Schema).min(1),
    scene_rules: z.array(WritingCapabilityAdapterRuleV1Schema).min(1),
    quality_rules: z.array(WritingCapabilityAdapterRuleV1Schema).min(1),
    repair_guidance: z.array(WritingCapabilityAdapterRuleV1Schema).min(1),
  }).strict(),
  guardrails: z.object({
    genre_story_profile_precedence: z.literal(true),
    story_knowledge_evidence_precedence: z.literal(true),
    cultural_safety_precedence: z.literal(true),
    rights_clearance_precedence: z.literal(true),
    no_rule_removal: z.literal(true),
  }).strict(),
  boundary: z.object({
    preview_only: z.literal(true),
    affects_generation: z.literal(false),
    rules_injected: z.literal(false),
    persistence_allowed: z.literal(false),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict().superRefine((adapter, context) => {
  const entries = Object.entries(adapter.rules) as Array<[
    keyof typeof adapter.rules,
    typeof adapter.rules[keyof typeof adapter.rules],
  ]>;
  const allRules = entries.flatMap(([, rules]) => rules);
  for (const [layer, rules] of entries) {
    rules.forEach((rule, index) => {
      if (rule.layer !== layer) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rules', layer, index, 'layer'],
          message: 'rule layer must match its containing collection',
        });
      }
    });
  }
  const ids = allRules.map(rule => rule.rule_id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rules'],
      message: 'adapter rule_id values must be unique across all layers',
    });
  }
  const normalizedTexts = allRules.map(rule => rule.text.trim().replace(/\s+/gu, ' '));
  if (new Set(normalizedTexts).size !== normalizedTexts.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rules'],
      message: 'adapter rule text values must be unique across all layers',
    });
  }
});

const WritingCapabilityAdapterPreviewRulesV1Schema = z.object({
  blueprint_requirements: z.array(WritingCapabilityNonEmptyTextSchema),
  scene_rules: z.array(WritingCapabilityNonEmptyTextSchema),
  quality_rules: z.array(WritingCapabilityNonEmptyTextSchema),
  repair_guidance: z.array(WritingCapabilityNonEmptyTextSchema),
}).strict();

export const WritingCapabilityAdapterPreflightReportV1Schema = z.object({
  schema_version: z.literal('writing-capability-adapter-preflight-report/v1'),
  status: z.enum(['passed', 'blocked']),
  capability_id: WritingCapabilityIdSchema,
  video_type: VideoTypeSchema,
  adapter_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/).optional(),
  adapter_revision: z.number().int().positive().optional(),
  conflicts: z.array(z.object({
    code: z.enum([
      'invalid_adapter_schema',
      'profile_identity_mismatch',
      'video_type_scope_mismatch',
      'policy_identity_mismatch',
      'duplicate_rule_id',
      'duplicate_rule_text',
      'genre_rule_duplicate',
      'forbidden_boundary_language',
      'missing_guardrail',
    ]),
    path: z.string(),
    message: WritingCapabilityNonEmptyTextSchema,
  }).strict()),
  preview_rules: WritingCapabilityAdapterPreviewRulesV1Schema,
  checks: z.object({
    genre_story_profile: z.literal(true),
    story_knowledge_evidence: z.literal(true),
    cultural_safety: z.literal(true),
    rights_clearance: z.literal(true),
    rollback_identity: z.literal(true),
  }).strict(),
  summary: z.object({
    preview_rule_count: z.number().int().nonnegative(),
    conflict_count: z.number().int().nonnegative(),
  }).strict(),
  boundary: z.object({
    preview_only: z.literal(true),
    affects_generation: z.literal(false),
    rules_injected: z.literal(false),
    persistence_allowed: z.literal(false),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict().superRefine((report, context) => {
  const previewRuleCount = Object.values(report.preview_rules)
    .reduce((count, rules) => count + rules.length, 0);
  if (
    report.summary.preview_rule_count !== previewRuleCount
    || report.summary.conflict_count !== report.conflicts.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary'],
      message: 'preflight summary counts must match conflicts and preview rules',
    });
  }
  if (
    (report.status === 'passed' && (report.conflicts.length > 0 || previewRuleCount === 0))
    || (report.status === 'blocked' && (report.conflicts.length === 0 || previewRuleCount > 0))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'passed requires preview rules without conflicts; blocked requires conflicts and no preview rules',
    });
  }
});

const WritingCapabilityRolloutPolicySnapshotV1Schema = z.object({
  policy_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  policy_revision: z.number().int().positive(),
  status: z.enum(['disabled', 'shadow_plan']),
  capability_id: WritingCapabilityIdSchema,
  video_type: VideoTypeSchema,
  profile_schema_version: z.literal('writing-capability-profile/v1'),
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  internal_adaptation_version: z.string().regex(/^[a-z][a-z0-9-]{2,63}\/v[1-9][0-9]*$/),
  rollback_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
}).strict();

export const WritingCapabilityShadowPreparationPlanV1Schema = z.object({
  schema_version: z.literal('writing-capability-shadow-preparation-plan/v1'),
  status: z.enum([
    'not_requested',
    'policy_disabled',
    'shadow_ready',
    'policy_incompatible',
    'candidate_mismatch',
    'routing_rejected',
    'adapter_blocked',
  ]),
  video_type: VideoTypeSchema,
  requested_capability_ids: z.array(WritingCapabilityIdSchema),
  policy: WritingCapabilityRolloutPolicySnapshotV1Schema.optional(),
  routing_report: WritingCapabilityRoutingReportV1Schema,
  adapter_preview: WritingCapabilityAdapterPreflightReportV1Schema.optional(),
  projected_rules: z.object({
    blueprint_requirements: z.array(WritingCapabilityNonEmptyTextSchema).max(0),
    scene_rules: z.array(WritingCapabilityNonEmptyTextSchema).max(0),
    quality_rules: z.array(WritingCapabilityNonEmptyTextSchema).max(0),
    repair_guidance: z.array(WritingCapabilityNonEmptyTextSchema).max(0),
  }).strict(),
  issues: z.array(WritingCapabilityNonEmptyTextSchema)
    .refine(values => new Set(values).size === values.length, 'issues must be unique'),
  boundary: z.object({
    shadow_only: z.literal(true),
    affects_generation: z.literal(false),
    profile_rules_injected: z.literal(false),
    runtime_activation_allowed: z.literal(false),
    global_enablement_allowed: z.literal(false),
    persistence_allowed: z.literal(false),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict().superRefine((plan, context) => {
  const requested = plan.requested_capability_ids;
  const sortedRequested = [...requested].sort((left, right) => left.localeCompare(right));
  if (
    new Set(requested).size !== requested.length
    || requested.some((id, index) => id !== sortedRequested[index])
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requested_capability_ids'],
      message: 'requested_capability_ids must be unique and sorted',
    });
  }
  if (plan.status === 'shadow_ready') {
    const decision = plan.routing_report.decisions[0];
    if (
      !plan.policy
      || plan.policy.status !== 'shadow_plan'
      || plan.video_type !== plan.policy.video_type
      || requested.length !== 1
      || requested[0] !== plan.policy.capability_id
      || decision?.reason_code !== 'profile_disabled'
      || plan.issues.length > 0
      || plan.adapter_preview?.status === 'blocked'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'shadow_ready requires one exact disabled-profile candidate and no issues',
      });
    }
  }
  if (
    plan.status === 'policy_disabled'
    && plan.policy?.status !== 'disabled'
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['policy', 'status'],
      message: 'policy_disabled requires a disabled policy snapshot',
    });
  }
  if (
    plan.status === 'adapter_blocked'
    && (
      !plan.policy
      || plan.policy.status !== 'shadow_plan'
      || plan.video_type !== plan.policy.video_type
      || requested.length !== 1
      || requested[0] !== plan.policy.capability_id
      || plan.routing_report.decisions[0]?.reason_code !== 'profile_disabled'
      || plan.adapter_preview?.status !== 'blocked'
      || plan.issues.length === 0
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['adapter_preview'],
      message: 'adapter_blocked requires one exact disabled-profile candidate, a blocked preview, and issues',
    });
  }
});

export const WritingCapabilityRuntimeActivationV1Schema = z.object({
  schema_version: z.literal('writing-capability-runtime-activation/v1'),
  activation_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  activation_revision: z.number().int().positive(),
  status: z.literal('enabled'),
  candidate: z.object({
    capability_id: WritingCapabilityIdSchema,
    video_type: VideoTypeSchema,
    profile_schema_version: z.literal('writing-capability-profile/v1'),
    source_commit: z.string().regex(/^[a-f0-9]{40}$/),
    adapter_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
    adapter_revision: z.number().int().positive(),
    internal_adaptation_version: z.string().regex(/^[a-z][a-z0-9-]{2,63}\/v[1-9][0-9]*$/),
    rollback_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
  }).strict(),
  boundary: z.object({
    default_off: z.literal(true),
    exact_single_capability: z.literal(true),
    exact_single_video_type: z.literal(true),
    internal_opt_in_only: z.literal(true),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict();

const WritingCapabilityRuntimeRuleV1Schema = z.object({
  rule_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
  layer: WritingCapabilityAdapterRuleLayerV1Schema,
  text: WritingCapabilityNonEmptyTextSchema,
  source_profile_field: WritingCapabilityAdapterRuleLayerV1Schema,
  source_rule_index: z.number().int().nonnegative(),
}).strict().superRefine((rule, context) => {
  if (rule.layer !== rule.source_profile_field) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source_profile_field'],
      message: 'runtime rule source_profile_field must match layer',
    });
  }
});

const WritingCapabilityRuntimeRulesV1Schema = z.object({
  blueprint_requirements: z.array(WritingCapabilityRuntimeRuleV1Schema).min(1),
  scene_rules: z.array(WritingCapabilityRuntimeRuleV1Schema).min(1),
  quality_rules: z.array(WritingCapabilityRuntimeRuleV1Schema).min(1),
  repair_guidance: z.array(WritingCapabilityRuntimeRuleV1Schema).min(1),
}).strict();

export const WritingCapabilityRuntimeContextV1Schema = z.object({
  schema_version: z.literal('writing-capability-runtime-context/v1'),
  status: z.literal('active'),
  activation_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  activation_revision: z.number().int().positive(),
  capability_id: WritingCapabilityIdSchema,
  video_type: VideoTypeSchema,
  profile_schema_version: z.literal('writing-capability-profile/v1'),
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  adapter_id: z.string().regex(/^[a-z][a-z0-9_]{2,95}$/),
  adapter_revision: z.number().int().positive(),
  internal_adaptation_version: z.string().regex(/^[a-z][a-z0-9-]{2,63}\/v[1-9][0-9]*$/),
  rollback_id: z.string().regex(/^[a-z][a-z0-9-]{2,95}$/),
  rules: WritingCapabilityRuntimeRulesV1Schema,
  guardrails: z.object({
    genre_story_profile_precedence: z.literal(true),
    story_knowledge_evidence_precedence: z.literal(true),
    cultural_safety_precedence: z.literal(true),
    rights_clearance_precedence: z.literal(true),
    no_rule_removal: z.literal(true),
  }).strict(),
  boundary: z.object({
    default_off: z.literal(true),
    explicit_internal_opt_in: z.literal(true),
    affects_generation: z.literal(true),
    affects_quality: z.literal(true),
    affects_repair: z.literal(true),
    persistence_allowed: z.literal(true),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict().superRefine((runtime, context) => {
  const entries = Object.entries(runtime.rules) as Array<[
    keyof typeof runtime.rules,
    typeof runtime.rules[keyof typeof runtime.rules],
  ]>;
  const allRules = entries.flatMap(([, rules]) => rules);
  for (const [layer, rules] of entries) {
    rules.forEach((rule, index) => {
      if (rule.layer !== layer) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rules', layer, index, 'layer'],
          message: 'runtime rule layer must match its collection',
        });
      }
    });
  }
  if (new Set(allRules.map(rule => rule.rule_id)).size !== allRules.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rules'],
      message: 'runtime rule identifiers must be unique',
    });
  }
});

export const WritingCapabilityRuntimeResolutionV1Schema = z.object({
  schema_version: z.literal('writing-capability-runtime-resolution/v1'),
  status: z.enum(['active', 'fallback']),
  video_type: VideoTypeSchema,
  requested_capability_ids: z.array(WritingCapabilityIdSchema),
  context: WritingCapabilityRuntimeContextV1Schema.optional(),
  issues: z.array(WritingCapabilityNonEmptyTextSchema),
  boundary: z.object({
    default_off: z.literal(true),
    explicit_internal_opt_in: z.literal(true),
    fail_closed: z.literal(true),
    baseline_preserved_on_fallback: z.literal(true),
    public_api_exposed: z.literal(false),
    third_party_code_executed: z.literal(false),
  }).strict(),
}).strict().superRefine((resolution, context) => {
  if (
    (resolution.status === 'active' && (!resolution.context || resolution.issues.length > 0))
    || (resolution.status === 'fallback' && (resolution.context || resolution.issues.length === 0))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'active requires context without issues; fallback requires issues without context',
    });
  }
});

export const NarrativePatternIdSchema = z.enum([
  'mortal_growth',
  'infinite_mission',
  'historical_causal_story',
  'power_strategy',
  'hero_choice',
  'folk_legend_trial',
  'mystery_reveal',
  'ensemble_threads',
  'object_clue_journey',
  'craft_mastery',
  'ritual_process',
  'brand_symbol',
  'city_day_journey',
  'social_hook_contrast',
  'documentary_investigation',
  'knowledge_gap_explainer',
  'lecture_case_argument',
  'training_loop',
  'space_walkthrough',
  'poetic_landscape',
  'children_fable',
  'novel_scene_compression',
  'character_arc_adaptation',
  'serial_hook_adaptation',
  'cinematic_setpiece_adaptation',
  'theme_preserving_adaptation',
  'source_fidelity_adaptation',
  'chapter_slice_adaptation',
  'dialogue_scene_adaptation',
  'worldbuilding_grounding',
  'platform_short_drama_hook',
  'wuxia_chivalric_epic',
  'wuxia_lone_blade_mystery',
  'wuxia_sect_growth',
  'wuxia_revenge_journey',
  'wuxia_court_jianghu',
  'wuxia_romance_honor',
  'archaeological_mystery_expedition',
  'clan_legacy_conspiracy',
  'fair_play_detective',
  'mythic_voyage_homecoming',
  'historical_faction_epic',
  'mythic_hero_quest',
  'folk_supernatural_investigation',
  'survival_expedition',
  'conspiracy_puzzle_thriller',
  'courtroom_case_procedural',
  'team_heist_operation',
  'tragic_romance_choice',
  'family_saga_generations',
  'road_companion_quest',
  'war_strategy_campaign',
  'folk_satirical_comedy',
]);

export const CulturalStorySourceKindSchema = z.enum([
  'myth',
  'folk_legend',
  'historical_event',
  'historical_figure',
  'local_anecdote',
  'classic_literature',
  'heritage_memory',
  'user_original',
]);

const RecommendedNarrativePatternSchema = z.object({
  video_type: VideoTypeSchema,
  pattern_id: NarrativePatternIdSchema,
  reason: z.string().min(1),
  priority: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
  match_signals: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Presentation style (11 表现形式)
// ---------------------------------------------------------------------------

export const PresentationStyleSchema = z.enum([
  'cinematic',
  'documentary',
  'host_narration',
  'voiceover_montage',
  'vertical_drama',
  'ai_comic',
  'animation_2d',
  'ink_style',
  'children_animation',
  'museum_exhibit',
  'social_media_fastcut',
]);

// ---------------------------------------------------------------------------
// Story structure type (8 叙事结构) — Phase 5
// ---------------------------------------------------------------------------

export const StoryStructureTypeSchema = z.enum([
  'single_event_drama',
  'three_act_drama',
  'memory_mosaic_biography',
  'witness_testimony',
  'object_clue_journey',
  'before_after_transformation',
  'case_reconstruction',
  'lecture_argument',
]);

// ---------------------------------------------------------------------------
// Reference Intelligence
// ---------------------------------------------------------------------------

const ReferenceNonEmptyTextSchema = z.string().trim().min(1);
const ReferenceTimestampSchema = z.string().datetime({ offset: true });
const ReferenceContentFingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
const ReferenceTimecodeSchema = z.string().trim().regex(
  /^(?:\d{1,3}:)?[0-5]\d:[0-5]\d(?:\.\d{1,3})?$/,
  'timecode must use HH:MM:SS or MM:SS',
);

export const ReferenceSourceMediaTypeSchema = z.enum([
  'film',
  'episode',
  'promo',
  'novel',
  'screenplay',
  'tutorial',
]);

export const ReferenceRightsStatusSchema = z.enum([
  'user_owned',
  'licensed',
  'public_domain',
  'research_only',
  'unknown',
]);

export const ReferenceAccessScopeSchema = z.enum([
  'metadata_only',
  'excerpt',
  'full_user_supplied',
]);

export const ReferenceSourceCreateRequestSchema = z.object({
  title: ReferenceNonEmptyTextSchema.max(200),
  media_type: ReferenceSourceMediaTypeSchema,
  source_url: z.string().url().max(2_000).optional(),
  platform: ReferenceNonEmptyTextSchema.max(120).optional(),
  creator: ReferenceNonEmptyTextSchema.max(200).optional(),
  accessed_at: ReferenceTimestampSchema,
  rights_status: ReferenceRightsStatusSchema,
  access_scope: ReferenceAccessScopeSchema,
  content_fingerprint: ReferenceContentFingerprintSchema.optional(),
  user_reason: ReferenceNonEmptyTextSchema.max(1_000),
}).strict();

export const ReferenceSourceRecordSchema = ReferenceSourceCreateRequestSchema.extend({
  schema_version: z.literal('reference-source-record/v1'),
  reference_id: z.string().regex(/^reference-[a-f0-9-]+$/),
  created_at: ReferenceTimestampSchema,
  updated_at: ReferenceTimestampSchema,
}).strict();

export const ReferenceTextMaterialAuthorizationInputSchema = z.object({
  basis: z.enum(['user_owned', 'licensed', 'public_domain']),
  authorization_reference: ReferenceNonEmptyTextSchema.max(500),
  attested_by: ReferenceNonEmptyTextSchema.max(120),
  attested_at: ReferenceTimestampSchema,
  confirmation: z.literal('authorized_reference_text_ingest'),
}).strict();

export const ReferenceTextMaterialCreateRequestSchema = z.object({
  content: z.string()
    .min(1)
    .max(500_000)
    .refine(value => value.trim().length > 0, 'content must not be blank'),
  content_type: z.enum(['text/plain', 'text/markdown']),
  authorization: ReferenceTextMaterialAuthorizationInputSchema,
}).strict();

export const ReferenceTextMaterialRecordSchema =
ReferenceTextMaterialCreateRequestSchema.omit({
  content: true,
}).extend({
  schema_version: z.literal('reference-text-material/v1'),
  material_id: z.string().regex(/^reference-text-material-[a-f0-9]{32}$/),
  reference_id: z.string().regex(/^reference-[a-f0-9-]+$/),
  source_content_fingerprint: ReferenceContentFingerprintSchema,
  content_sha256: ReferenceContentFingerprintSchema,
  byte_length: z.number().int().min(1).max(1_500_000),
  character_count: z.number().int().min(1).max(500_000),
  line_count: z.number().int().min(1).max(500_001),
  authorization: ReferenceTextMaterialAuthorizationInputSchema.extend({
    machine_verified: z.literal(false),
  }).strict(),
  created_at: ReferenceTimestampSchema,
  governance: z.object({
    source_material_transport: z.literal('stored_user_supplied'),
    server_download_allowed: z.literal(false),
    prompt_injection_allowed: z.literal(false),
    knowledge_writeback_allowed: z.literal(false),
    production_credit_eligible: z.literal(false),
  }).strict(),
  human_review_complete: z.literal(false),
  production_credit_granted: z.literal(false),
}).strict();

export const ReferenceTextMaterialStatusSchema = z.discriminatedUnion(
  'available',
  [
    z.object({
      available: z.literal(false),
      material: z.null(),
    }).strict(),
    z.object({
      available: z.literal(true),
      material: ReferenceTextMaterialRecordSchema,
    }).strict(),
  ],
);

export const ReferenceTextMaterialChunkDescriptorSchema = z.object({
  chunk_id: z.string().regex(/^chunk-\d{4}$/),
  index: z.number().int().min(1).max(9_999),
  locator: z.string().regex(/^characters:\d+-\d+$/),
  start_character: z.number().int().min(1),
  end_character: z.number().int().min(1),
  character_count: z.number().int().min(1).max(12_000),
  byte_length: z.number().int().min(1).max(48_000),
  content_sha256: ReferenceContentFingerprintSchema,
}).strict();

export const ReferenceTextMaterialManifestSchema = z.object({
  schema_version: z.literal('reference-text-material-manifest/v1'),
  material_id: ReferenceTextMaterialRecordSchema.shape.material_id,
  reference_id: ReferenceTextMaterialRecordSchema.shape.reference_id,
  source_content_fingerprint: ReferenceContentFingerprintSchema,
  content_type: z.enum(['text/plain', 'text/markdown']),
  byte_length: z.number().int().min(1).max(1_500_000),
  character_count: z.number().int().min(1).max(500_000),
  line_count: z.number().int().min(1).max(500_001),
  chunk_character_limit: z.literal(12_000),
  chunk_count: z.number().int().min(1).max(9_999),
  chunks: z.array(ReferenceTextMaterialChunkDescriptorSchema).min(1).max(9_999),
  chunk_endpoint_template: z.string().regex(
    /^\/api\/reference-library\/references\/reference-[a-f0-9-]+\/text-material\/chunks\/\{chunk_id\}$/,
  ),
  content_included: z.literal(false),
  prompt_injection_allowed: z.literal(false),
  knowledge_writeback_allowed: z.literal(false),
  human_review_complete: z.literal(false),
  production_credit_granted: z.literal(false),
}).strict();

export const ReferenceTextMaterialChunkSchema =
ReferenceTextMaterialChunkDescriptorSchema.extend({
  schema_version: z.literal('reference-text-material-chunk/v1'),
  material_id: ReferenceTextMaterialRecordSchema.shape.material_id,
  reference_id: ReferenceTextMaterialRecordSchema.shape.reference_id,
  source_content_fingerprint: ReferenceContentFingerprintSchema,
  text: z.string().min(1).refine(
    value => Array.from(value).length <= 12_000,
    'text must contain at most 12000 Unicode characters',
  ),
  prompt_injection_allowed: z.literal(false),
  knowledge_writeback_allowed: z.literal(false),
  human_review_complete: z.literal(false),
  production_credit_granted: z.literal(false),
}).strict();

export const ReferencePrivateVideoMediaTypeSchema = z.enum([
  'film',
  'episode',
  'promo',
  'tutorial',
]);

export const ReferencePrivateVideoAuthorizationInputSchema = z.object({
  basis: z.enum(['user_owned', 'licensed', 'public_domain']),
  authorization_reference: ReferenceNonEmptyTextSchema.max(500),
  attested_by: ReferenceNonEmptyTextSchema.max(120),
  attested_at: ReferenceTimestampSchema,
  confirmation: z.literal('authorized_private_video_ingest'),
}).strict();

export const ReferencePrivateVideoSampleIngestRequestSchema = z.object({
  title: ReferenceNonEmptyTextSchema.max(200),
  media_type: ReferencePrivateVideoMediaTypeSchema,
  local_video_path: ReferenceNonEmptyTextSchema.max(2_000),
  rights_status: z.enum(['user_owned', 'licensed', 'public_domain']),
  access_scope: z.enum(['excerpt', 'full_user_supplied']),
  user_reason: ReferenceNonEmptyTextSchema.max(1_000),
  authorization: ReferencePrivateVideoAuthorizationInputSchema,
  thumbnail_time_seconds: z.number().min(0).max(36_000).optional(),
  extract_thumbnail: z.boolean().optional(),
  extract_audio_wav: z.boolean().optional(),
}).strict();

export const ReferencePrivateVideoSourceArtifactSchema = z.object({
  original_filename: ReferenceNonEmptyTextSchema.max(255),
  stored_private_relative_path: ReferenceNonEmptyTextSchema.max(1_000),
  content_sha256: ReferenceContentFingerprintSchema,
  byte_length: z.number().int().min(1),
}).strict();

export const ReferencePrivateVideoStreamSummarySchema = z.object({
  codec_type: z.enum(['video', 'audio']),
  codec_name: ReferenceNonEmptyTextSchema.max(80).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sample_rate: z.number().int().positive().optional(),
  channels: z.number().int().positive().optional(),
  duration_seconds: z.number().min(0).optional(),
  avg_frame_rate: ReferenceNonEmptyTextSchema.max(40).optional(),
}).strict();

export const ReferencePrivateVideoProbeReportSchema = z.discriminatedUnion(
  'status',
  [
    z.object({
      status: z.literal('ready'),
      command: ReferenceNonEmptyTextSchema.max(2_000),
      raw_json_private_relative_path: ReferenceNonEmptyTextSchema.max(1_000),
      raw_json_sha256: ReferenceContentFingerprintSchema,
      format_name: ReferenceNonEmptyTextSchema.max(200).optional(),
      duration_seconds: z.number().min(0).optional(),
      bit_rate: z.number().int().min(0).optional(),
      video_streams: z.array(ReferencePrivateVideoStreamSummarySchema).max(32),
      audio_streams: z.array(ReferencePrivateVideoStreamSummarySchema).max(32),
    }).strict(),
    z.object({
      status: z.literal('blocked'),
      command: ReferenceNonEmptyTextSchema.max(2_000),
      blocked_reason: ReferenceNonEmptyTextSchema.max(1_000),
      video_streams: z.tuple([]),
      audio_streams: z.tuple([]),
    }).strict(),
  ],
);

export const ReferencePrivateVideoDerivedArtifactSchema =
z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    kind: z.enum(['thumbnail_jpeg', 'audio_wav_16khz_mono']),
    command: ReferenceNonEmptyTextSchema.max(2_000),
    private_relative_path: ReferenceNonEmptyTextSchema.max(1_000),
    content_sha256: ReferenceContentFingerprintSchema,
    byte_length: z.number().int().min(1),
  }).strict(),
  z.object({
    status: z.literal('blocked'),
    kind: z.enum(['thumbnail_jpeg', 'audio_wav_16khz_mono']),
    command: ReferenceNonEmptyTextSchema.max(2_000),
    blocked_reason: ReferenceNonEmptyTextSchema.max(1_000),
  }).strict(),
  z.object({
    status: z.literal('not_requested'),
    kind: z.enum(['thumbnail_jpeg', 'audio_wav_16khz_mono']),
  }).strict(),
]);

export const ReferencePrivateVideoTranscriptSubmitRequestSchema = z.object({
  transcript_text: z.string()
    .min(1)
    .max(500_000)
    .refine(value => value.trim().length > 0, 'transcript_text must not be blank'),
  transcript_format: z.enum(['text/plain', 'text/srt', 'text/vtt']),
  transcribed_by: ReferenceNonEmptyTextSchema.max(120),
  transcribed_at: ReferenceTimestampSchema,
  method: z.enum(['local_manual', 'local_model']),
  tool_name: ReferenceNonEmptyTextSchema.max(120).optional(),
  tool_version: ReferenceNonEmptyTextSchema.max(120).optional(),
  confirmation: z.literal('local_private_transcription_only'),
}).strict();

export const ReferencePrivateVideoTranscriptStatusSchema =
z.discriminatedUnion('status', [
  z.object({
    status: z.literal('not_submitted'),
  }).strict(),
  z.object({
    status: z.literal('ready'),
    transcript_id: z.string().regex(
      /^reference-private-video-transcript-[a-f0-9]{24}$/,
    ),
    transcript_format: z.enum(['text/plain', 'text/srt', 'text/vtt']),
    content_sha256: ReferenceContentFingerprintSchema,
    byte_length: z.number().int().min(1),
    character_count: z.number().int().min(1).max(500_000),
    line_count: z.number().int().min(1).max(500_001),
    private_relative_path: ReferenceNonEmptyTextSchema.max(1_000),
    transcribed_by: ReferenceNonEmptyTextSchema.max(120),
    transcribed_at: ReferenceTimestampSchema,
    method: z.enum(['local_manual', 'local_model']),
    tool_name: ReferenceNonEmptyTextSchema.max(120).optional(),
    tool_version: ReferenceNonEmptyTextSchema.max(120).optional(),
    local_transcription_performed: z.literal(true),
    external_model_call_performed: z.literal(false),
    third_party_upload_performed: z.literal(false),
  }).strict(),
]);

export const ReferencePrivateVideoSampleRecordSchema = z.object({
  schema_version: z.literal('reference-private-video-sample/v1'),
  sample_id: z.string().regex(/^reference-private-video-[a-f0-9]{24}$/),
  title: ReferencePrivateVideoSampleIngestRequestSchema.shape.title,
  media_type: ReferencePrivateVideoMediaTypeSchema,
  rights_status: z.enum(['user_owned', 'licensed', 'public_domain']),
  access_scope: z.enum(['excerpt', 'full_user_supplied']),
  user_reason: ReferencePrivateVideoSampleIngestRequestSchema.shape.user_reason,
  source_video: ReferencePrivateVideoSourceArtifactSchema,
  authorization: ReferencePrivateVideoAuthorizationInputSchema.extend({
    machine_verified: z.literal(false),
  }).strict(),
  ffprobe: ReferencePrivateVideoProbeReportSchema,
  ffmpeg_derivatives: z.object({
    thumbnail: ReferencePrivateVideoDerivedArtifactSchema,
    audio_wav: ReferencePrivateVideoDerivedArtifactSchema,
  }).strict(),
  transcript: ReferencePrivateVideoTranscriptStatusSchema,
  governance: z.object({
    local_private_mode: z.literal(true),
    source_video_in_git: z.literal(false),
    source_path_persisted: z.literal(false),
    server_download_allowed: z.literal(false),
    third_party_upload_allowed: z.literal(false),
    external_model_call_performed: z.literal(false),
    ffprobe_allowed: z.literal(true),
    ffmpeg_allowed: z.literal(true),
    local_transcription_allowed: z.literal(true),
    prompt_injection_allowed: z.literal(false),
    knowledge_writeback_allowed: z.literal(false),
    production_credit_eligible: z.literal(false),
    human_review_complete: z.literal(false),
    production_credit_granted: z.literal(false),
  }).strict(),
  created_at: ReferenceTimestampSchema,
  updated_at: ReferenceTimestampSchema,
}).strict();

export const ReferencePrivateVideoSampleIngestResultSchema = z.object({
  sample: ReferencePrivateVideoSampleRecordSchema,
  idempotent_replay: z.boolean(),
}).strict();

export const ReferencePrivateVideoTranscriptSubmissionResultSchema = z.object({
  sample: ReferencePrivateVideoSampleRecordSchema,
  idempotent_replay: z.boolean(),
}).strict();

const ReferenceSimilarityMarkerSchema = ReferenceNonEmptyTextSchema.max(120);
const ReferenceSimilarityObservationIdSchema =
  ReferenceNonEmptyTextSchema.max(120);
const ReferenceSimilarityMarkerObservationSchema = z.object({
  observation_id: ReferenceSimilarityObservationIdSchema,
  distinctive_markers: z.array(ReferenceSimilarityMarkerSchema)
    .min(2)
    .max(12)
    .refine(uniqueReferenceIds, 'distinctive_markers must be unique'),
}).strict();
export const ReferenceSimilarityEvidenceObservationsSchema = z.object({
    excerpts: z.array(z.object({
      observation_id: ReferenceSimilarityObservationIdSchema,
      source_locator: ReferenceNonEmptyTextSchema.max(200),
      text: ReferenceNonEmptyTextSchema.min(15).max(500),
    }).strict()).max(20).refine(
      items => uniqueReferenceIds(items.map(item => item.observation_id)),
      'excerpt observation_id values must be unique',
    ),
    character_profiles: z.array(
      ReferenceSimilarityMarkerObservationSchema.extend({
        label: ReferenceNonEmptyTextSchema.max(120),
      }).strict(),
    ).max(50).refine(
      items => uniqueReferenceIds(items.map(item => item.observation_id)),
      'character profile observation_id values must be unique',
    ),
    plot_beats: z.array(
      ReferenceSimilarityMarkerObservationSchema.extend({
        order: z.number().int().min(1).max(500),
      }).strict(),
    ).max(100)
      .refine(
        items => uniqueReferenceIds(items.map(item => item.observation_id)),
        'plot beat observation_id values must be unique',
      )
      .refine(
        items => new Set(items.map(item => item.order)).size === items.length,
        'plot beat order values must be unique',
      ),
    shot_sequence: z.array(
      ReferenceSimilarityMarkerObservationSchema.extend({
        order: z.number().int().min(1).max(1_000),
      }).strict(),
    ).max(500)
      .refine(
        items => uniqueReferenceIds(items.map(item => item.observation_id)),
        'shot sequence observation_id values must be unique',
      )
      .refine(
        items => new Set(items.map(item => item.order)).size === items.length,
        'shot sequence order values must be unique',
      ),
  }).strict().refine(
    observations =>
      observations.excerpts.length > 0
      || observations.character_profiles.length > 0
      || observations.plot_beats.length > 0
      || observations.shot_sequence.length > 0,
    'at least one similarity observation is required',
  );

export const ReferenceSimilarityEvidenceCreateRequestSchema = z.object({
  source_content_fingerprint: ReferenceContentFingerprintSchema,
  input_provenance: z.enum(['operator_submitted', 'fixture']),
  authorization: z.object({
    basis: z.enum(['user_owned', 'licensed', 'public_domain']),
    authorization_reference: ReferenceNonEmptyTextSchema.max(500),
    attested_by: ReferenceNonEmptyTextSchema.max(120),
    attested_at: ReferenceTimestampSchema,
    confirmation: z.literal('authorized_similarity_analysis_only'),
  }).strict(),
  observations: ReferenceSimilarityEvidenceObservationsSchema,
}).strict();

export const ReferenceSimilarityEvidenceRecordSchema =
ReferenceSimilarityEvidenceCreateRequestSchema.extend({
  schema_version: z.literal('reference-similarity-evidence/v1'),
  evidence_id: z.string().regex(/^reference-similarity-evidence-[a-f0-9-]+$/),
  analysis_task_id: z.string().regex(/^reference-analysis-task-[a-f0-9-]+$/).optional(),
  reference_id: z.string().regex(/^reference-[a-f0-9-]+$/),
  authorization: ReferenceSimilarityEvidenceCreateRequestSchema.shape.authorization.extend({
    machine_verified: z.literal(false),
  }).strict(),
  payload_sha256: ReferenceContentFingerprintSchema,
  created_at: ReferenceTimestampSchema,
  governance: z.object({
    prompt_injection_allowed: z.literal(false),
    knowledge_writeback_allowed: z.literal(false),
    production_credit_eligible: z.literal(false),
  }).strict(),
}).strict();

export const ReferenceAnalysisTaskCreateRequestSchema = z.object({
  requested_dimensions: z.array(z.enum([
    'excerpt',
    'character_design',
    'plot_structure',
    'shot_sequence',
  ]))
    .min(1)
    .max(4)
    .refine(uniqueReferenceIds, 'requested_dimensions must be unique'),
  authorization: ReferenceSimilarityEvidenceCreateRequestSchema.shape.authorization,
}).strict();

export const ReferenceAnalysisTaskSubmissionSchema = z.object({
  submission_key: ReferenceNonEmptyTextSchema.min(8).max(200),
  observations: ReferenceSimilarityEvidenceObservationsSchema,
}).strict();

export const ReferenceTextAnalysisPartialObservationsSchema = z.object({
  excerpts: z.array(z.object({
    observation_id: ReferenceNonEmptyTextSchema.max(100),
    source_locator: ReferenceNonEmptyTextSchema.max(160),
    text: ReferenceNonEmptyTextSchema.min(15).max(500),
  }).strict()).max(20).refine(
    items => uniqueReferenceIds(items.map(item => item.observation_id)),
    'excerpt observation_id values must be unique',
  ),
  character_profiles: z.array(z.object({
    observation_id: ReferenceNonEmptyTextSchema.max(100),
    label: ReferenceNonEmptyTextSchema.max(120),
    distinctive_markers: z.array(ReferenceSimilarityMarkerSchema)
      .min(2)
      .max(12)
      .refine(uniqueReferenceIds, 'distinctive_markers must be unique'),
  }).strict()).max(50).refine(
    items => uniqueReferenceIds(items.map(item => item.observation_id)),
    'character profile observation_id values must be unique',
  ),
  plot_beats: z.array(z.object({
    observation_id: ReferenceNonEmptyTextSchema.max(100),
    order: z.number().int().min(1).max(500),
    distinctive_markers: z.array(ReferenceSimilarityMarkerSchema)
      .min(2)
      .max(12)
      .refine(uniqueReferenceIds, 'distinctive_markers must be unique'),
  }).strict()).max(100)
    .refine(
      items => uniqueReferenceIds(items.map(item => item.observation_id)),
      'plot beat observation_id values must be unique',
    )
    .refine(
      items => new Set(items.map(item => item.order)).size === items.length,
      'plot beat order values must be unique',
    ),
  shot_sequence: z.array(z.object({
    observation_id: ReferenceNonEmptyTextSchema.max(100),
    order: z.number().int().min(1).max(1_000),
    distinctive_markers: z.array(ReferenceSimilarityMarkerSchema)
      .min(2)
      .max(12)
      .refine(uniqueReferenceIds, 'distinctive_markers must be unique'),
  }).strict()).max(500)
    .refine(
      items => uniqueReferenceIds(items.map(item => item.observation_id)),
      'shot sequence observation_id values must be unique',
    )
    .refine(
      items => new Set(items.map(item => item.order)).size === items.length,
      'shot sequence order values must be unique',
    ),
}).strict();

export const ReferenceTextAnalysisExecutionCreateRequestSchema = z.object({
  executor: z.object({
    kind: z.enum(['codex', 'operator']),
    executor_id: ReferenceNonEmptyTextSchema.max(120),
  }).strict(),
  confirmation: z.literal('source_text_treated_as_untrusted_data'),
}).strict();

export const ReferenceTextAnalysisChunkSubmissionSchema = z.object({
  submission_key: ReferenceNonEmptyTextSchema.min(8).max(200),
  submitted_by: ReferenceNonEmptyTextSchema.max(120),
  chunk_content_sha256: ReferenceContentFingerprintSchema,
  observations: ReferenceTextAnalysisPartialObservationsSchema,
}).strict();

export const ReferenceTextAnalysisExecutionFinalizeRequestSchema = z.object({
  finalized_by: ReferenceNonEmptyTextSchema.max(120),
  confirmation: z.literal(
    'aggregate_completed_chunks_to_operator_evidence',
  ),
}).strict();

export const ReferenceTextAnalysisExecutionCheckpointSchema = z.object({
  chunk_id: ReferenceTextMaterialChunkDescriptorSchema.shape.chunk_id,
  index: ReferenceTextMaterialChunkDescriptorSchema.shape.index,
  locator: ReferenceTextMaterialChunkDescriptorSchema.shape.locator,
  content_sha256: ReferenceContentFingerprintSchema,
  status: z.enum(['pending', 'completed']),
  partial_observations_sha256: ReferenceContentFingerprintSchema.nullable(),
  submission_key_sha256: ReferenceContentFingerprintSchema.nullable(),
  completed_at: ReferenceTimestampSchema.nullable(),
}).strict();

export const ReferenceTextAnalysisExecutionRecordSchema = z.object({
  schema_version: z.literal('reference-text-analysis-execution/v1'),
  execution_id: z.string().regex(
    /^reference-text-analysis-execution-[a-f0-9-]+$/,
  ),
  task_id: z.string().regex(/^reference-analysis-task-[a-f0-9-]+$/),
  reference_id: z.string().regex(/^reference-[a-f0-9-]+$/),
  material_id: ReferenceTextMaterialRecordSchema.shape.material_id,
  material_manifest_sha256: ReferenceContentFingerprintSchema,
  requested_dimensions:
    ReferenceAnalysisTaskCreateRequestSchema.shape.requested_dimensions,
  executor: ReferenceTextAnalysisExecutionCreateRequestSchema.shape.executor,
  status: z.enum([
    'pending',
    'in_progress',
    'ready_to_finalize',
    'completed',
  ]),
  cursor: z.object({
    completed_chunk_count: z.number().int().min(0).max(9_999),
    next_chunk_id:
      ReferenceTextMaterialChunkDescriptorSchema.shape.chunk_id.nullable(),
  }).strict(),
  checkpoints: z.array(
    ReferenceTextAnalysisExecutionCheckpointSchema,
  ).min(1).max(9_999),
  manifest: z.object({
    server_model_call_allowed: z.literal(false),
    source_text_instruction_authority: z.literal('none'),
    prompt_injection_allowed: z.literal(false),
    knowledge_writeback_allowed: z.literal(false),
    automatic_approval_allowed: z.literal(false),
    production_credit_eligible: z.literal(false),
  }).strict(),
  evidence_id: z.string()
    .regex(/^reference-similarity-evidence-[a-f0-9-]+$/)
    .nullable(),
  evidence_payload_sha256: ReferenceContentFingerprintSchema.nullable(),
  final_observations_sha256: ReferenceContentFingerprintSchema.nullable(),
  created_at: ReferenceTimestampSchema,
  updated_at: ReferenceTimestampSchema,
  completed_at: ReferenceTimestampSchema.nullable(),
  human_review_complete: z.literal(false),
  production_credit_granted: z.literal(false),
}).strict();

export const ReferenceTextAnalysisPartialRecordSchema = z.object({
  schema_version: z.literal('reference-text-analysis-partial/v1'),
  execution_id: ReferenceTextAnalysisExecutionRecordSchema.shape.execution_id,
  task_id: z.string().regex(/^reference-analysis-task-[a-f0-9-]+$/),
  material_id: ReferenceTextMaterialRecordSchema.shape.material_id,
  chunk_id: ReferenceTextMaterialChunkDescriptorSchema.shape.chunk_id,
  chunk_content_sha256: ReferenceContentFingerprintSchema,
  submitted_by: ReferenceNonEmptyTextSchema.max(120),
  submission_key_sha256: ReferenceContentFingerprintSchema,
  observations_sha256: ReferenceContentFingerprintSchema,
  observations: ReferenceTextAnalysisPartialObservationsSchema,
  created_at: ReferenceTimestampSchema,
  prompt_injection_allowed: z.literal(false),
  knowledge_writeback_allowed: z.literal(false),
  human_review_complete: z.literal(false),
  production_credit_granted: z.literal(false),
}).strict();

export const ReferenceAnalysisTaskRecordSchema = z.object({
  schema_version: z.enum([
    'reference-analysis-task/v1',
    'reference-analysis-task/v2',
  ]),
  task_id: z.string().regex(/^reference-analysis-task-[a-f0-9-]+$/),
  reference_id: z.string().regex(/^reference-[a-f0-9-]+$/),
  source_snapshot: z.object({
    title: ReferenceNonEmptyTextSchema.max(200),
    media_type: ReferenceSourceMediaTypeSchema,
    rights_status: z.enum(['user_owned', 'licensed', 'public_domain']),
    access_scope: z.enum(['excerpt', 'full_user_supplied']),
    content_fingerprint: ReferenceContentFingerprintSchema,
  }).strict(),
  requested_dimensions: ReferenceAnalysisTaskCreateRequestSchema.shape.requested_dimensions,
  authorization: ReferenceSimilarityEvidenceCreateRequestSchema.shape.authorization.extend({
    machine_verified: z.literal(false),
  }).strict(),
  status: z.enum(['pending', 'processing', 'completed']),
  manifest: z.object({
    executor: z.literal('codex_or_operator'),
    source_material_transport: z.enum([
      'out_of_band_user_authorized',
      'stored_user_supplied',
    ]),
    source_material_id:
      ReferenceTextMaterialRecordSchema.shape.material_id.optional(),
    source_material_manifest_endpoint: z.string().regex(
      /^\/api\/reference-library\/references\/reference-[a-f0-9-]+\/text-material\/manifest$/,
    ).optional(),
    server_download_allowed: z.literal(false),
    input_provenance: z.literal('operator_submitted'),
    output_schema: z.literal('reference-similarity-evidence/v1'),
    output_submission_endpoint: z.string().regex(
      /^\/api\/reference-library\/analysis-tasks\/reference-analysis-task-[a-f0-9-]+\/submissions$/,
    ),
    prompt_injection_allowed: z.literal(false),
    knowledge_writeback_allowed: z.literal(false),
  }).strict(),
  submission_key_sha256: ReferenceContentFingerprintSchema.nullable(),
  observations_sha256: ReferenceContentFingerprintSchema.nullable(),
  evidence_id: z.string().regex(/^reference-similarity-evidence-[a-f0-9-]+$/).nullable(),
  evidence_payload_sha256: ReferenceContentFingerprintSchema.nullable(),
  created_at: ReferenceTimestampSchema,
  updated_at: ReferenceTimestampSchema,
  completed_at: ReferenceTimestampSchema.nullable(),
  human_review_complete: z.literal(false),
  real_credit_granted: z.literal(false),
}).strict().superRefine((record, context) => {
  const storedMaterial =
    record.manifest.source_material_transport === 'stored_user_supplied';
  const hasStoredMaterialFields = Boolean(
    record.manifest.source_material_id
    && record.manifest.source_material_manifest_endpoint,
  );
  if (
    (storedMaterial && !hasStoredMaterialFields)
    || (!storedMaterial && (
      record.manifest.source_material_id !== undefined
      || record.manifest.source_material_manifest_endpoint !== undefined
    ))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'analysis task source material manifest is inconsistent',
    });
  }
  if (
    record.schema_version === 'reference-analysis-task/v1'
    && storedMaterial
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'v1 analysis task cannot declare stored source material',
    });
  }
  const hasSubmissionHashes = Boolean(
    record.submission_key_sha256 && record.observations_sha256,
  );
  const hasCompletion = Boolean(
    record.evidence_id
    && record.evidence_payload_sha256
    && record.completed_at,
  );
  if (record.status === 'pending' && (hasSubmissionHashes || hasCompletion)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'pending analysis task cannot contain submission or completion state',
    });
  }
  if (record.status === 'processing' && (!hasSubmissionHashes || hasCompletion)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'processing analysis task requires submission hashes and no completion state',
    });
  }
  if (record.status === 'completed' && (!hasSubmissionHashes || !hasCompletion)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'completed analysis task requires submission and evidence state',
    });
  }
});

export const FilmReferenceAnalysisSchema = z.object({
  hook_timecode: ReferenceTimecodeSchema.optional(),
  central_question: ReferenceNonEmptyTextSchema.max(500).optional(),
  sequence_beats: z.array(z.object({
    start: ReferenceTimecodeSchema,
    end: ReferenceTimecodeSchema,
    function: ReferenceNonEmptyTextSchema.max(500),
  }).strict()).min(1).max(200),
  shot_observations: z.array(z.object({
    timecode: ReferenceTimecodeSchema,
    framing: ReferenceNonEmptyTextSchema.max(200).optional(),
    camera_motion: ReferenceNonEmptyTextSchema.max(300).optional(),
    blocking: ReferenceNonEmptyTextSchema.max(500).optional(),
    lighting: ReferenceNonEmptyTextSchema.max(300).optional(),
    audio_function: ReferenceNonEmptyTextSchema.max(500).optional(),
    evidence_note: ReferenceNonEmptyTextSchema.max(1_000),
  }).strict()).min(1).max(500),
  continuity_methods: z.array(ReferenceNonEmptyTextSchema.max(500)).max(100),
  reusable_principles: z.array(ReferenceNonEmptyTextSchema.max(500)).min(1).max(100),
  avoid_copying: z.array(ReferenceNonEmptyTextSchema.max(500)).min(1).max(100),
}).strict();

export const TextReferenceAnalysisSchema = z.object({
  source_units: z.array(z.object({
    source_unit_id: ReferenceNonEmptyTextSchema.max(120),
    summary: ReferenceNonEmptyTextSchema.max(1_000),
  }).strict()).min(1).max(1_000),
  character_wants: z.array(ReferenceNonEmptyTextSchema.max(500)).max(200),
  scene_patterns: z.array(z.object({
    objective: ReferenceNonEmptyTextSchema.max(500),
    opposition: ReferenceNonEmptyTextSchema.max(500),
    turn: ReferenceNonEmptyTextSchema.max(500),
    visible_action: ReferenceNonEmptyTextSchema.max(500),
    subtext: ReferenceNonEmptyTextSchema.max(500).optional(),
  }).strict()).min(1).max(500),
  must_keep: z.array(ReferenceNonEmptyTextSchema.max(500)).max(200),
  compression_options: z.array(ReferenceNonEmptyTextSchema.max(500)).max(200),
  adaptation_risks: z.array(ReferenceNonEmptyTextSchema.max(500)).max(200),
  reusable_principles: z.array(ReferenceNonEmptyTextSchema.max(500)).min(1).max(100),
  avoid_copying: z.array(ReferenceNonEmptyTextSchema.max(500)).min(1).max(100),
}).strict();

export const ReferenceAnalysisApprovalInputSchema = z.object({
  approved_by: ReferenceNonEmptyTextSchema.max(120),
  approved_at: ReferenceTimestampSchema,
}).strict();

export const ReferenceAnalysisApprovalRequestSchema =
  ReferenceAnalysisApprovalInputSchema.extend({
    confirmation: z.literal('human_reviewed_reference_analysis'),
  }).strict();

export const FilmReferenceAnalysisCreateRequestSchema = z.object({
  analysis: FilmReferenceAnalysisSchema,
  analyzed_by: ReferenceNonEmptyTextSchema.max(120),
  approval: ReferenceAnalysisApprovalInputSchema.optional(),
}).strict();

export const TextReferenceAnalysisCreateRequestSchema = z.object({
  analysis: TextReferenceAnalysisSchema,
  analyzed_by: ReferenceNonEmptyTextSchema.max(120),
  approval: ReferenceAnalysisApprovalInputSchema.optional(),
}).strict();

export const ReferenceApprovedAuditSchema = z.object({
  status: z.literal('approved'),
  approved_by: ReferenceNonEmptyTextSchema.max(120),
  approved_at: ReferenceTimestampSchema,
}).strict();

const ReferenceAnalysisApprovalSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }).strict(),
  ReferenceApprovedAuditSchema,
]);

const ReferenceAnalysisRecordBaseSchema = z.object({
  schema_version: z.enum([
    'reference-analysis-record/v1',
    'reference-analysis-record/v2',
  ]),
  analysis_id: z.string().regex(/^analysis-[a-f0-9-]+$/),
  reference_id: z.string().regex(/^reference-[a-f0-9-]+$/),
  analyzed_by: ReferenceNonEmptyTextSchema.max(120),
  analyzed_at: ReferenceTimestampSchema,
  approval: ReferenceAnalysisApprovalSchema,
});

export const FilmReferenceAnalysisRecordSchema = ReferenceAnalysisRecordBaseSchema.extend({
  schema_version: z.literal('reference-analysis-record/v1'),
  analysis_type: z.literal('film'),
  analysis: FilmReferenceAnalysisSchema,
}).strict();

export const TextReferenceAnalysisProvenanceSchema = z.object({
  draft_task_id: z.string().regex(
    /^reference-text-analysis-draft-task-[a-f0-9-]+$/,
  ),
  analysis_task_id: z.string().regex(
    /^reference-analysis-task-[a-f0-9-]+$/,
  ),
  text_execution_id: z.string().regex(
    /^reference-text-analysis-execution-[a-f0-9-]+$/,
  ),
  similarity_evidence_id: z.string().regex(
    /^reference-similarity-evidence-[a-f0-9-]+$/,
  ),
  similarity_evidence_payload_sha256: ReferenceContentFingerprintSchema,
  final_observations_sha256: ReferenceContentFingerprintSchema,
  source_content_fingerprint: ReferenceContentFingerprintSchema,
  input_provenance: z.literal('operator_submitted'),
  machine_verified: z.literal(false),
  supplement_request_sha256: ReferenceContentFingerprintSchema.optional(),
  supplement_id: z.string().regex(
    /^reference-text-analysis-draft-supplement-[a-f0-9-]+$/,
  ).optional(),
  supplement_payload_sha256: ReferenceContentFingerprintSchema.optional(),
}).strict().superRefine((record, context) => {
  const supplementValues = [
    record.supplement_request_sha256,
    record.supplement_id,
    record.supplement_payload_sha256,
  ];
  const present = supplementValues.filter(Boolean).length;
  if (present !== 0 && present !== supplementValues.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'supplement provenance must be complete when present',
    });
  }
});

export const TextReferenceAnalysisGovernanceSchema = z.object({
  prompt_injection_allowed: z.literal(false),
  knowledge_writeback_allowed: z.literal(false),
  production_credit_eligible: z.literal(false),
}).strict();

export const TextReferenceAnalysisRecordSchema = ReferenceAnalysisRecordBaseSchema.extend({
  analysis_type: z.literal('text'),
  analysis: TextReferenceAnalysisSchema,
  provenance: TextReferenceAnalysisProvenanceSchema.optional(),
  governance: TextReferenceAnalysisGovernanceSchema.optional(),
}).strict().superRefine((record, context) => {
  const bound = record.schema_version === 'reference-analysis-record/v2';
  if (
    (bound && (!record.provenance || !record.governance))
    || (!bound && (record.provenance || record.governance))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'reference analysis v2 requires provenance and governance',
    });
  }
});

export const ReferenceAnalysisRecordSchema = z.union([
  FilmReferenceAnalysisRecordSchema,
  TextReferenceAnalysisRecordSchema,
]);

export const ReferenceTextAnalysisDraftTaskCreateRequestSchema = z.object({
  executor: z.object({
    kind: z.enum(['codex', 'operator']),
    executor_id: ReferenceNonEmptyTextSchema.max(120),
  }).strict(),
  confirmation: z.literal(
    'draft_complete_text_analysis_from_verified_evidence',
  ),
}).strict();

export const ReferenceTextAnalysisDraftSubmissionSchema = z.object({
  submission_key: ReferenceNonEmptyTextSchema.min(8).max(200),
  submitted_by: ReferenceNonEmptyTextSchema.max(120),
  confirmation: z.literal('submit_pending_text_reference_analysis'),
  analysis: TextReferenceAnalysisSchema,
}).strict().refine(
  request => !JSON.stringify(request.analysis).includes('请填写'),
  'draft analysis must replace every editor placeholder',
);

export const TextReferenceAnalysisFieldSchema = z.enum([
  'source_units',
  'character_wants',
  'scene_patterns',
  'must_keep',
  'compression_options',
  'adaptation_risks',
  'reusable_principles',
  'avoid_copying',
]);

export const ReferenceTextAnalysisSupplementNeedSchema = z.object({
  field: TextReferenceAnalysisFieldSchema,
  reason: z.enum([
    'not_observed',
    'conflicting_observations',
    'insufficient_source_coverage',
  ]),
  evidence_id: z.string().regex(
    /^reference-similarity-evidence-[a-f0-9-]+$/,
  ),
  evidence_observation_ids: z.array(
    ReferenceNonEmptyTextSchema.max(200),
  ).max(100),
  required_input: z.literal('bounded_source_observations'),
}).strict();

function uniqueTextAnalysisFields(
  values: Array<{ field: string }>,
): boolean {
  return new Set(values.map(value => value.field)).size === values.length;
}

export const ReferenceTextAnalysisSupplementRequestSchema = z.object({
  submission_key: ReferenceNonEmptyTextSchema.min(8).max(200),
  requested_by: ReferenceNonEmptyTextSchema.max(120),
  confirmation: z.literal(
    'declare_text_analysis_evidence_insufficient',
  ),
  needs: z.array(ReferenceTextAnalysisSupplementNeedSchema)
    .min(1)
    .max(8)
    .refine(uniqueTextAnalysisFields, 'supplement need fields must be unique'),
}).strict();

export const ReferenceTextAnalysisSupplementRequestAuditSchema = z.object({
  request_submission_key_sha256: ReferenceContentFingerprintSchema,
  request_payload_sha256: ReferenceContentFingerprintSchema,
  requested_by: ReferenceNonEmptyTextSchema.max(120),
  requested_at: ReferenceTimestampSchema,
  needs: ReferenceTextAnalysisSupplementRequestSchema.shape.needs,
}).strict();

export const ReferenceTextAnalysisDraftSupplementItemSchema = z.object({
  field: TextReferenceAnalysisFieldSchema,
  source_locators: z.array(
    ReferenceNonEmptyTextSchema.max(200),
  ).min(1).max(100),
  observation_summary: ReferenceNonEmptyTextSchema.max(1_000),
  limitations: z.array(
    ReferenceNonEmptyTextSchema.max(500),
  ).max(20),
}).strict();

export const ReferenceTextAnalysisDraftSupplementSubmissionSchema = z.object({
  submission_key: ReferenceNonEmptyTextSchema.min(8).max(200),
  submitted_by: ReferenceNonEmptyTextSchema.max(120),
  confirmation: z.literal(
    'submit_bounded_supplement_without_source_excerpts',
  ),
  items: z.array(ReferenceTextAnalysisDraftSupplementItemSchema)
    .min(1)
    .max(8)
    .refine(uniqueTextAnalysisFields, 'supplement item fields must be unique'),
}).strict();

export const ReferenceTextAnalysisDraftSupplementRecordSchema = z.object({
  schema_version: z.literal(
    'reference-text-analysis-draft-supplement/v1',
  ),
  supplement_id: z.string().regex(
    /^reference-text-analysis-draft-supplement-[a-f0-9-]+$/,
  ),
  draft_task_id: z.string().regex(
    /^reference-text-analysis-draft-task-[a-f0-9-]+$/,
  ),
  reference_id: z.string().regex(/^reference-[a-f0-9-]+$/),
  source_content_fingerprint: ReferenceContentFingerprintSchema,
  supplement_request_sha256: ReferenceContentFingerprintSchema,
  submission_key_sha256: ReferenceContentFingerprintSchema,
  submitted_by: ReferenceNonEmptyTextSchema.max(120),
  items: ReferenceTextAnalysisDraftSupplementSubmissionSchema.shape.items,
  input_provenance: z.literal('operator_submitted'),
  machine_verified: z.literal(false),
  payload_sha256: ReferenceContentFingerprintSchema,
  created_at: ReferenceTimestampSchema,
  governance: TextReferenceAnalysisGovernanceSchema,
}).strict();

export const ReferenceTextAnalysisDraftTaskRecordSchema = z.object({
  schema_version: z.enum([
    'reference-text-analysis-draft-task/v1',
    'reference-text-analysis-draft-task/v2',
  ]),
  draft_task_id: z.string().regex(
    /^reference-text-analysis-draft-task-[a-f0-9-]+$/,
  ),
  analysis_task_id: z.string().regex(
    /^reference-analysis-task-[a-f0-9-]+$/,
  ),
  text_execution_id: z.string().regex(
    /^reference-text-analysis-execution-[a-f0-9-]+$/,
  ),
  reference_id: z.string().regex(/^reference-[a-f0-9-]+$/),
  source_content_fingerprint: ReferenceContentFingerprintSchema,
  similarity_evidence_id: z.string().regex(
    /^reference-similarity-evidence-[a-f0-9-]+$/,
  ),
  similarity_evidence_payload_sha256: ReferenceContentFingerprintSchema,
  final_observations_sha256: ReferenceContentFingerprintSchema,
  requested_dimensions:
    ReferenceAnalysisTaskCreateRequestSchema.shape.requested_dimensions,
  executor: ReferenceTextAnalysisDraftTaskCreateRequestSchema.shape.executor,
  status: z.enum([
    'pending',
    'needs_supplement',
    'processing',
    'completed',
  ]),
  manifest: z.object({
    evidence_endpoint: z.string().regex(
      /^\/api\/reference-library\/similarity-evidence\/reference-similarity-evidence-[a-f0-9-]+$/,
    ),
    output_submission_endpoint: z.string().regex(
      /^\/api\/reference-library\/analysis-tasks\/reference-analysis-task-[a-f0-9-]+\/text-analysis-draft-task\/submissions$/,
    ),
    supplement_request_endpoint: z.string().regex(
      /^\/api\/reference-library\/analysis-tasks\/reference-analysis-task-[a-f0-9-]+\/text-analysis-draft-task\/supplement-request$/,
    ).optional(),
    supplement_submission_endpoint: z.string().regex(
      /^\/api\/reference-library\/analysis-tasks\/reference-analysis-task-[a-f0-9-]+\/text-analysis-draft-task\/supplement-submissions$/,
    ).optional(),
    supplement_endpoint: z.string().regex(
      /^\/api\/reference-library\/analysis-tasks\/reference-analysis-task-[a-f0-9-]+\/text-analysis-draft-task\/supplement$/,
    ).optional(),
    server_model_call_allowed: z.literal(false),
    source_text_instruction_authority: z.literal('none'),
    output_schema: z.literal('reference-analysis-record/v2'),
    output_approval_status: z.literal('pending'),
    automatic_approval_allowed: z.literal(false),
    prompt_injection_allowed: z.literal(false),
    knowledge_writeback_allowed: z.literal(false),
    production_credit_eligible: z.literal(false),
  }).strict(),
  supplement_request:
    ReferenceTextAnalysisSupplementRequestAuditSchema.nullable().optional(),
  supplement_id: z.string().regex(
    /^reference-text-analysis-draft-supplement-[a-f0-9-]+$/,
  ).nullable().optional(),
  supplement_payload_sha256:
    ReferenceContentFingerprintSchema.nullable().optional(),
  supplement_responded_at: ReferenceTimestampSchema.nullable().optional(),
  submission_key_sha256: ReferenceContentFingerprintSchema.nullable(),
  analysis_payload_sha256: ReferenceContentFingerprintSchema.nullable(),
  submitted_at: ReferenceTimestampSchema.nullable(),
  analysis_id: z.string().regex(/^analysis-[a-f0-9-]+$/).nullable(),
  created_at: ReferenceTimestampSchema,
  updated_at: ReferenceTimestampSchema,
  completed_at: ReferenceTimestampSchema.nullable(),
  human_review_complete: z.literal(false),
  production_credit_granted: z.literal(false),
}).strict().superRefine((record, context) => {
  const isV2 =
    record.schema_version === 'reference-text-analysis-draft-task/v2';
  const hasV2Manifest = Boolean(
    record.manifest.supplement_request_endpoint
    && record.manifest.supplement_submission_endpoint
    && record.manifest.supplement_endpoint,
  );
  const hasV2Fields = (
    record.supplement_request !== undefined
    && record.supplement_id !== undefined
    && record.supplement_payload_sha256 !== undefined
    && record.supplement_responded_at !== undefined
  );
  if (
    (isV2 && (!hasV2Manifest || !hasV2Fields))
    || (
      !isV2
      && (
        hasV2Manifest
        || hasV2Fields
        || record.status === 'needs_supplement'
      )
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'draft task supplement contract does not match schema version',
    });
  }
  const hasSupplementResponse = Boolean(
    record.supplement_id
    && record.supplement_payload_sha256
    && record.supplement_responded_at,
  );
  if (
    isV2
    && (
      (
        record.status === 'needs_supplement'
        && (!record.supplement_request || hasSupplementResponse)
      )
      || (
        record.supplement_request
        && record.status !== 'needs_supplement'
        && !hasSupplementResponse
      )
      || (
        !record.supplement_request
        && hasSupplementResponse
      )
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'draft task supplement state is inconsistent',
    });
  }
  const completed = record.status === 'completed';
  const hasResult = Boolean(
    record.submission_key_sha256
    && record.analysis_payload_sha256
    && record.submitted_at
    && record.analysis_id
    && record.completed_at,
  );
  if ((completed && !hasResult) || (!completed && record.completed_at)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'draft task completion state is inconsistent',
    });
  }
});

const ReferenceAnalysisIdSchema = z.string().regex(/^analysis-[a-f0-9-]+$/);
const ReferenceBenchmarkIdSchema = z.string().regex(/^benchmark-[a-f0-9-]+$/);
const ReferenceStylePackIdSchema = z.string().regex(/^reference-style-pack-[a-f0-9-]+$/);
const ReferenceGovernanceBoundarySchema = z.object({
  knowledge_writeback_allowed: z.literal(false),
  production_credit_eligible: z.literal(false),
}).strict();

function uniqueReferenceIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

export const BenchmarkCardCreateRequestSchema = z.object({
  analysis_ids: z.array(ReferenceAnalysisIdSchema)
    .min(2)
    .max(20)
    .refine(uniqueReferenceIds, 'analysis_ids must be unique'),
  target_video_type: VideoTypeSchema,
  target_dimension: z.enum(['hook', 'character', 'scene', 'visual', 'audio', 'promo']),
  principle: ReferenceNonEmptyTextSchema.max(1_000),
  evidence_refs: z.array(ReferenceAnalysisIdSchema)
    .min(2)
    .max(50)
    .refine(uniqueReferenceIds, 'evidence_refs must be unique'),
  created_by: ReferenceNonEmptyTextSchema.max(120),
  approval: ReferenceAnalysisApprovalInputSchema,
}).strict();

export const BenchmarkCardSchema = z.object({
  schema_version: z.literal('reference-benchmark-card/v1'),
  benchmark_id: ReferenceBenchmarkIdSchema,
  reference_ids: z.array(z.string().regex(/^reference-[a-f0-9-]+$/))
    .min(2)
    .max(20)
    .refine(uniqueReferenceIds, 'reference_ids must be unique'),
  analysis_ids: z.array(ReferenceAnalysisIdSchema)
    .min(2)
    .max(20)
    .refine(uniqueReferenceIds, 'analysis_ids must be unique'),
  target_video_type: VideoTypeSchema,
  target_dimension: z.enum(['hook', 'character', 'scene', 'visual', 'audio', 'promo']),
  principle: ReferenceNonEmptyTextSchema.max(1_000),
  evidence_refs: z.array(ReferenceAnalysisIdSchema)
    .min(2)
    .max(50)
    .refine(uniqueReferenceIds, 'evidence_refs must be unique'),
  created_by: ReferenceNonEmptyTextSchema.max(120),
  created_at: ReferenceTimestampSchema,
  approval: ReferenceApprovedAuditSchema,
  governance: ReferenceGovernanceBoundarySchema,
}).strict();

export const ReferenceStylePackCreateRequestSchema = z.object({
  name: ReferenceNonEmptyTextSchema.max(200),
  description: ReferenceNonEmptyTextSchema.max(1_000),
  benchmark_card_ids: z.array(ReferenceBenchmarkIdSchema)
    .min(1)
    .max(20)
    .refine(uniqueReferenceIds, 'benchmark_card_ids must be unique'),
  compatible_video_types: z.array(VideoTypeSchema)
    .min(1)
    .max(15)
    .refine(uniqueReferenceIds, 'compatible_video_types must be unique'),
  compatible_presentation_styles: z.array(PresentationStyleSchema)
    .min(1)
    .max(11)
    .refine(uniqueReferenceIds, 'compatible_presentation_styles must be unique'),
  compatible_story_structures: z.array(StoryStructureTypeSchema)
    .min(1)
    .max(8)
    .refine(uniqueReferenceIds, 'compatible_story_structures must be unique'),
  created_by: ReferenceNonEmptyTextSchema.max(120),
  approval: ReferenceAnalysisApprovalInputSchema,
}).strict();

export const ReferenceStylePackRecordSchema = z.object({
  schema_version: z.literal('reference-style-pack/v1'),
  id: ReferenceStylePackIdSchema,
  name: ReferenceNonEmptyTextSchema.max(200),
  description: ReferenceNonEmptyTextSchema.max(1_000),
  source_reference_ids: z.array(z.string().regex(/^reference-[a-f0-9-]+$/))
    .min(2)
    .max(100)
    .refine(uniqueReferenceIds, 'source_reference_ids must be unique'),
  source_analysis_ids: z.array(ReferenceAnalysisIdSchema)
    .min(2)
    .max(100)
    .refine(uniqueReferenceIds, 'source_analysis_ids must be unique'),
  source_benchmark_ids: z.array(ReferenceBenchmarkIdSchema)
    .min(1)
    .max(20)
    .refine(uniqueReferenceIds, 'source_benchmark_ids must be unique'),
  compatible_video_types: z.array(VideoTypeSchema).min(1).max(15),
  compatible_presentation_styles: z.array(PresentationStyleSchema).min(1).max(11),
  compatible_story_structures: z.array(StoryStructureTypeSchema).min(1).max(8),
  structure_rules: z.array(ReferenceNonEmptyTextSchema.max(1_000)),
  rhythm_rules: z.array(ReferenceNonEmptyTextSchema.max(1_000)),
  scene_rules: z.array(ReferenceNonEmptyTextSchema.max(1_000)),
  narration_rules: z.array(ReferenceNonEmptyTextSchema.max(1_000)),
  dialogue_rules: z.array(ReferenceNonEmptyTextSchema.max(1_000)),
  visual_rules: z.array(ReferenceNonEmptyTextSchema.max(1_000)),
  ending_rules: z.array(ReferenceNonEmptyTextSchema.max(1_000)),
  forbidden_patterns: z.array(ReferenceNonEmptyTextSchema.max(1_000)),
  reusable_principles: z.array(ReferenceNonEmptyTextSchema.max(1_000)).min(1),
  avoid_copying: z.array(ReferenceNonEmptyTextSchema.max(1_000)).min(1),
  created_by: ReferenceNonEmptyTextSchema.max(120),
  created_at: ReferenceTimestampSchema,
  approval: ReferenceApprovedAuditSchema,
  governance: ReferenceGovernanceBoundarySchema,
}).strict();

export const ReferenceStrengthSchema = z.enum(['light', 'medium', 'strong']);
export const GenreStrictnessSchema = z.enum(['loose', 'balanced', 'strict']);
export const StoryGenerationPrioritySchema = z.enum(['balanced', 'plot_first', 'knowledge_first']);
export const SourceMaterialModeSchema = z.enum(['generate_from_knowledge', 'adapt_user_novel']);
export const LocalizationModeSchema = z.enum(['allow_related_influence', 'strict_direct_events']);

export const KnowledgeDomainSchema = z.enum([
  'core_china_culture',
  'era_setting',
  'regional_culture',
  'folklore_zhiyi',
  'gears_asset',
  'narrative_pattern',
  'character_archetype',
  'conflict_pattern',
  'visual_style_pack',
  'safety_rule',
  'source_pack',
]);

export const KnowledgeEntryRoleSchema = z.enum([
  'core_entry',
  'setting_pack',
  'motif_pack',
  'asset_pack',
  'regional_pack',
  'pattern_pack',
  'archetype_pack',
  'conflict_pack',
  'style_pack',
  'rule_pack',
  'source_pack',
]);

export const KnowledgeAssetUsageSchema = z.enum([
  'character_clothing',
  'character_props',
  'scene_space',
  'scene_props',
  'story_motif',
  'dialogue_tone',
  'credibility_boundary',
  'gears_delivery',
  'plot_structure',
  'character_arc',
  'conflict_engine',
  'visual_style',
  'safety_boundary',
  'source_grounding',
]);

export const KnowledgeAssetSplitSchema = z.object({
  characters: z.array(z.string()),
  scenes: z.array(z.string()),
  character_props: z.array(z.string()),
  scene_props: z.array(z.string()),
});

export const CreationUseCaseSchema = z.enum([
  'original_ai_comic',
  'adapted_ai_comic',
  'institutional_promo',
  'documentary_short',
  'brand_commercial',
  'education_training',
  'public_service',
]);

export const TruthModeSchema = z.enum([
  'fictional_original',
  'inspired_by_material',
  'source_adaptation',
  'factual_reconstruction',
  'institutional_verified',
]);

export const KnowledgePackEntrySchema = z.object({
  entry_name: z.string(),
  province: z.string(),
  region: z.string(),
  type: z.string(),
  summary: z.string(),
  score: z.number(),
  role_in_story: z.string(),
  match_reason: z.string(),
  keywords: z.array(z.string()),
  knowledge_domain: KnowledgeDomainSchema.optional(),
  entry_role: KnowledgeEntryRoleSchema.optional(),
  era: z.string().optional(),
  asset_usage: z.array(KnowledgeAssetUsageSchema).optional(),
  asset_split: KnowledgeAssetSplitSchema.optional(),
  production_prompts: z.array(z.string()).optional(),
  review_boundaries: z.array(z.string()).optional(),
  credibility: z.string().optional(),
  source_refs: z.array(z.string()).optional(),
  verification_method: z.string().optional(),
  unverified_points: z.array(z.string()).optional(),
});

export const KnowledgePackMissingSchema = z.object({
  need_id: z.string(),
  label: z.string(),
  message: z.string(),
});

export const KnowledgePackSchema = z.object({
  primary_entries: z.array(KnowledgePackEntrySchema),
  supporting_entries: z.array(KnowledgePackEntrySchema),
  missing_needs: z.array(KnowledgePackMissingSchema),
  overall_confidence: z.number(),
});

const StoryKnowledgeNonEmptyTextSchema = z.string().trim().min(1);
const StoryKnowledgeUniqueTextArraySchema = z.array(StoryKnowledgeNonEmptyTextSchema)
  .refine(values => new Set(values).size === values.length, 'values must be unique');

export const StoryKnowledgeSourceGradeV1Schema = z.enum([
  'A',
  'B',
  'C',
  'D',
  'ungraded',
]);

export const StoryKnowledgeSourceRefV1Schema = z.object({
  source_ref_id: z.string().regex(/^[a-z][a-z0-9_-]{2,95}$/),
  citation: StoryKnowledgeNonEmptyTextSchema,
  grade: StoryKnowledgeSourceGradeV1Schema,
  verification_status: z.enum([
    'human_verified',
    'machine_mapped',
    'legacy_unmapped',
  ]),
  verified_at: z.string().datetime({ offset: true }).optional(),
  note: StoryKnowledgeNonEmptyTextSchema.optional(),
}).strict().superRefine((source, context) => {
  if (source.verification_status === 'human_verified') {
    if (source.grade === 'ungraded') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['grade'],
        message: 'human_verified sources must have an explicit A-D grade',
      });
    }
    if (!source.verified_at) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verified_at'],
        message: 'human_verified sources must include verified_at',
      });
    }
  }
  if (source.verification_status === 'legacy_unmapped' && source.grade !== 'ungraded') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['grade'],
      message: 'legacy_unmapped sources must remain ungraded',
    });
  }
});

export const StoryKnowledgeClaimV1Schema = z.object({
  claim_id: z.string().regex(/^[a-z][a-z0-9_-]{2,127}$/),
  claim_type: z.enum([
    'critical_fact',
    'supporting_fact',
    'legend_variant',
    'disputed_or_unknown',
  ]),
  text: StoryKnowledgeNonEmptyTextSchema,
  subject: StoryKnowledgeNonEmptyTextSchema.optional(),
  event: StoryKnowledgeNonEmptyTextSchema.optional(),
  time: StoryKnowledgeNonEmptyTextSchema.optional(),
  place: StoryKnowledgeNonEmptyTextSchema.optional(),
  object: StoryKnowledgeNonEmptyTextSchema.optional(),
  source_ref_ids: StoryKnowledgeUniqueTextArraySchema,
  certainty: z.enum(['verified', 'probable', 'disputed', 'unverified']),
  usage: z.enum(['fact', 'bounded_context', 'variant_only', 'blocked']),
  scope: StoryKnowledgeNonEmptyTextSchema.optional(),
  last_verified_at: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((claim, context) => {
  if (claim.usage === 'fact' && claim.certainty !== 'verified') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['certainty'],
      message: 'fact usage requires verified certainty',
    });
  }
  if (claim.claim_type === 'disputed_or_unknown' && claim.usage === 'fact') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['usage'],
      message: 'disputed_or_unknown claims cannot be used as facts',
    });
  }
});

export const StoryKnowledgeCreativeAffordanceV1Schema = z.object({
  character_goals: StoryKnowledgeUniqueTextArraySchema,
  pressures: StoryKnowledgeUniqueTextArraySchema,
  choices: StoryKnowledgeUniqueTextArraySchema,
  consequences: StoryKnowledgeUniqueTextArraySchema,
  visible_events: StoryKnowledgeUniqueTextArraySchema,
  relationships: StoryKnowledgeUniqueTextArraySchema,
  story_pressures: StoryKnowledgeUniqueTextArraySchema,
  allowed_dramatization: StoryKnowledgeUniqueTextArraySchema,
  forbidden_dramatization: StoryKnowledgeUniqueTextArraySchema,
  legend_variants: StoryKnowledgeUniqueTextArraySchema,
  dialogue_register: StoryKnowledgeUniqueTextArraySchema,
  forbidden_language: StoryKnowledgeUniqueTextArraySchema,
}).strict();

export const StoryKnowledgeProductionMaterialV1Schema = z.object({
  characters: StoryKnowledgeUniqueTextArraySchema,
  costume_and_hair: StoryKnowledgeUniqueTextArraySchema,
  props: StoryKnowledgeUniqueTextArraySchema,
  architecture_and_spaces: StoryKnowledgeUniqueTextArraySchema,
  spaces_and_routes: StoryKnowledgeUniqueTextArraySchema,
  materials_tools_and_process: StoryKnowledgeUniqueTextArraySchema,
  lighting_season_and_weather: StoryKnowledgeUniqueTextArraySchema,
  ambient_sound: StoryKnowledgeUniqueTextArraySchema,
  rituals_and_crowd: StoryKnowledgeUniqueTextArraySchema,
  interviews_broll_and_archive: StoryKnowledgeUniqueTextArraySchema,
  rights_clearance_notes: StoryKnowledgeUniqueTextArraySchema,
}).strict();

export const StoryKnowledgeMissingMaterialV1Schema = z.object({
  missing_id: z.string().regex(/^[a-z][a-z0-9_-]{2,127}$/),
  category: z.enum([
    'claim_level_source_mapping',
    'authoritative_source',
    'creative_affordance',
    'production_material',
    'rights_clearance',
  ]),
  label: StoryKnowledgeNonEmptyTextSchema,
  reason: StoryKnowledgeNonEmptyTextSchema,
  blocking_level: z.enum(['blocking', 'risk', 'optional']),
  affects: StoryKnowledgeUniqueTextArraySchema,
}).strict();

export const StoryKnowledgeContractV1Schema = z.object({
  schema_version: z.literal('story-knowledge-contract/v1'),
  source_entry: z.object({
    name: StoryKnowledgeNonEmptyTextSchema,
    source_domain: StoryKnowledgeNonEmptyTextSchema,
    province: StoryKnowledgeNonEmptyTextSchema.optional(),
    region: StoryKnowledgeNonEmptyTextSchema.optional(),
    entry_type: StoryKnowledgeNonEmptyTextSchema.optional(),
    era: StoryKnowledgeNonEmptyTextSchema.optional(),
  }).strict(),
  sources: z.array(StoryKnowledgeSourceRefV1Schema),
  claims: z.array(StoryKnowledgeClaimV1Schema).min(1),
  creative_affordance: StoryKnowledgeCreativeAffordanceV1Schema,
  production_material: StoryKnowledgeProductionMaterialV1Schema,
  missing_material: z.array(StoryKnowledgeMissingMaterialV1Schema),
  boundary: z.object({
    legacy_adapter: z.boolean(),
    consumed_by_generation: z.literal(false),
    generated_content_writeback_allowed: z.literal(false),
    critical_facts_can_be_asserted: z.boolean(),
    machine_validation_only: z.literal(true),
    human_review_complete: z.literal(false),
  }).strict(),
}).strict().superRefine((contract, context) => {
  const sourceById = new Map(contract.sources.map(source => [source.source_ref_id, source]));
  const sourceIds = contract.sources.map(source => source.source_ref_id);
  const claimIds = contract.claims.map(claim => claim.claim_id);
  const missingIds = contract.missing_material.map(item => item.missing_id);
  if (new Set(sourceIds).size !== sourceIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sources'],
      message: 'source_ref_id values must be unique',
    });
  }
  if (new Set(claimIds).size !== claimIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['claims'],
      message: 'claim_id values must be unique',
    });
  }
  if (new Set(missingIds).size !== missingIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['missing_material'],
      message: 'missing_id values must be unique',
    });
  }

  const criticalFacts = contract.claims.filter(claim => claim.claim_type === 'critical_fact');
  const eligibleCriticalFacts = criticalFacts.filter(claim => (
    claim.certainty === 'verified'
    && claim.usage === 'fact'
    && claim.source_ref_ids.some(sourceRefId => {
      const source = sourceById.get(sourceRefId);
      return source?.verification_status === 'human_verified'
        && (source.grade === 'A' || source.grade === 'B');
    })
  ));

  for (const [claimIndex, claim] of contract.claims.entries()) {
    for (const sourceRefId of claim.source_ref_ids) {
      if (!sourceById.has(sourceRefId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['claims', claimIndex, 'source_ref_ids'],
          message: `unknown source_ref_id: ${sourceRefId}`,
        });
      }
    }
    if (
      claim.claim_type === 'critical_fact'
      && claim.usage === 'fact'
      && !eligibleCriticalFacts.includes(claim)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['claims', claimIndex, 'source_ref_ids'],
        message: 'critical facts require a human-verified A/B source',
      });
    }
  }

  if (
    contract.boundary.critical_facts_can_be_asserted
    && (criticalFacts.length === 0 || eligibleCriticalFacts.length !== criticalFacts.length)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['boundary', 'critical_facts_can_be_asserted'],
      message: 'critical_facts_can_be_asserted requires every critical fact to pass its evidence gate',
    });
  }
  if (
    !contract.boundary.critical_facts_can_be_asserted
    && eligibleCriticalFacts.length > 0
    && eligibleCriticalFacts.length === criticalFacts.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['boundary', 'critical_facts_can_be_asserted'],
      message: 'critical_facts_can_be_asserted must reflect the verified critical facts',
    });
  }
});

export const StoryKnowledgeEvidenceOverlaySourceReviewV1Schema = z.object({
  source_ref_id: z.string().regex(/^[a-z][a-z0-9_-]{2,95}$/),
  grade: z.enum(['A', 'B', 'C', 'D']),
  verification_status: z.enum(['human_verified', 'machine_mapped']),
  verified_at: z.string().datetime({ offset: true }).optional(),
  note: StoryKnowledgeNonEmptyTextSchema,
}).strict().superRefine((review, context) => {
  if (review.verification_status === 'human_verified' && !review.verified_at) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verified_at'],
      message: 'human_verified source reviews must include verified_at',
    });
  }
  if (review.verification_status === 'machine_mapped' && review.verified_at) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verified_at'],
      message: 'machine_mapped source reviews cannot include verified_at',
    });
  }
});

export const StoryKnowledgeEvidenceOverlayClaimMappingV1Schema = z.object({
  claim_id: z.string().regex(/^[a-z][a-z0-9_-]{2,127}$/),
  source_ref_ids: z.array(StoryKnowledgeNonEmptyTextSchema)
    .min(1)
    .refine(values => new Set(values).size === values.length, 'values must be unique'),
  claim_type: z.enum([
    'critical_fact',
    'supporting_fact',
    'legend_variant',
    'disputed_or_unknown',
  ]),
  certainty: z.enum(['verified', 'probable', 'disputed', 'unverified']),
  usage: z.enum(['fact', 'bounded_context', 'variant_only', 'blocked']),
  scope: StoryKnowledgeNonEmptyTextSchema,
}).strict().superRefine((mapping, context) => {
  if (mapping.usage === 'fact' && mapping.certainty !== 'verified') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['certainty'],
      message: 'fact usage requires verified certainty',
    });
  }
  if (mapping.claim_type === 'disputed_or_unknown' && mapping.usage === 'fact') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['usage'],
      message: 'disputed_or_unknown claims cannot be used as facts',
    });
  }
});

export const StoryKnowledgeEvidenceOverlaySignoffV1Schema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    reason: StoryKnowledgeNonEmptyTextSchema,
  }).strict(),
  z.object({
    status: z.literal('approved'),
    reviewed_by: StoryKnowledgeNonEmptyTextSchema,
    reviewer_role: z.literal('fact_culture_reviewer'),
    reviewed_at: z.string().datetime({ offset: true }),
    confirmation: z.literal('human_reviewed_story_knowledge_evidence_overlay'),
  }).strict(),
  z.object({
    status: z.literal('rejected'),
    reviewed_by: StoryKnowledgeNonEmptyTextSchema,
    reviewer_role: z.literal('fact_culture_reviewer'),
    reviewed_at: z.string().datetime({ offset: true }),
    reason: StoryKnowledgeNonEmptyTextSchema,
  }).strict(),
]);

export const StoryKnowledgeEvidenceOverlayV1Schema = z.object({
  schema_version: z.literal('story-knowledge-evidence-overlay/v1'),
  overlay_id: z.string().regex(/^[a-z][a-z0-9_-]{2,127}$/),
  entry_name: StoryKnowledgeNonEmptyTextSchema,
  source_reviews: z.array(StoryKnowledgeEvidenceOverlaySourceReviewV1Schema),
  claim_mappings: z.array(StoryKnowledgeEvidenceOverlayClaimMappingV1Schema),
  signoff: StoryKnowledgeEvidenceOverlaySignoffV1Schema,
  boundary: z.object({
    read_only_overlay: z.literal(true),
    source_markdown_writeback_allowed: z.literal(false),
    generation_consumption_allowed: z.literal(false),
    existing_supplement_tasks_mutable: z.literal(false),
  }).strict(),
}).strict().superRefine((overlay, context) => {
  const sourceReviewIds = overlay.source_reviews.map(review => review.source_ref_id);
  const claimMappingIds = overlay.claim_mappings.map(mapping => mapping.claim_id);
  if (new Set(sourceReviewIds).size !== sourceReviewIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source_reviews'],
      message: 'source_ref_id values must be unique within an overlay',
    });
  }
  if (new Set(claimMappingIds).size !== claimMappingIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['claim_mappings'],
      message: 'claim_id values must be unique within an overlay',
    });
  }

  const signedOff = overlay.signoff.status === 'approved';
  if (!signedOff) {
    for (const [reviewIndex, review] of overlay.source_reviews.entries()) {
      if (review.verification_status === 'human_verified') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['source_reviews', reviewIndex, 'verification_status'],
          message: 'human_verified source reviews require approved human signoff',
        });
      }
    }
    for (const [mappingIndex, mapping] of overlay.claim_mappings.entries()) {
      if (mapping.usage === 'fact') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['claim_mappings', mappingIndex, 'usage'],
          message: 'fact promotion requires approved human signoff',
        });
      }
    }
  }

  const reviewedSourceById = new Map(
    overlay.source_reviews.map(review => [review.source_ref_id, review]),
  );
  for (const [mappingIndex, mapping] of overlay.claim_mappings.entries()) {
    if (mapping.claim_type !== 'critical_fact' || mapping.usage !== 'fact') continue;
    const hasHumanVerifiedAuthoritativeSource = mapping.source_ref_ids.some(sourceRefId => {
      const review = reviewedSourceById.get(sourceRefId);
      return review?.verification_status === 'human_verified'
        && (review.grade === 'A' || review.grade === 'B');
    });
    if (!hasHumanVerifiedAuthoritativeSource) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['claim_mappings', mappingIndex, 'source_ref_ids'],
        message: 'critical fact promotion requires an explicitly reviewed human A/B source',
      });
    }
  }
});

export const StoryKnowledgePreparationV1Schema = z.object({
  schema_version: z.literal('story-knowledge-preparation/v1'),
  status: z.enum([
    'base_contract_only',
    'overlay_pending',
    'overlay_approved_read_only',
    'overlay_rejected',
    'overlay_incompatible',
  ]),
  entry_name: StoryKnowledgeNonEmptyTextSchema,
  overlay_id: z.string().regex(/^[a-z][a-z0-9_-]{2,127}$/).optional(),
  contract: StoryKnowledgeContractV1Schema,
  issues: StoryKnowledgeUniqueTextArraySchema,
  report: z.object({
    source_count: z.number().int().nonnegative(),
    claim_count: z.number().int().nonnegative(),
    human_verified_source_count: z.number().int().nonnegative(),
    critical_fact_ready_count: z.number().int().nonnegative(),
    missing_material_count: z.number().int().nonnegative(),
  }).strict(),
  boundary: z.object({
    read_only_preparation: z.literal(true),
    consumed_by_blueprint: z.literal(false),
    consumed_by_prompt: z.literal(false),
    consumed_by_fallback: z.literal(false),
    persistence_allowed: z.literal(false),
    generation_output_changed: z.literal(false),
    machine_validation_only: z.literal(true),
    real_human_review_credit_granted: z.literal(false),
  }).strict(),
}).strict().superRefine((preparation, context) => {
  if (
    preparation.status !== 'base_contract_only'
    && preparation.status !== 'overlay_incompatible'
    && !preparation.overlay_id
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['overlay_id'],
      message: `${preparation.status} requires overlay_id`,
    });
  }
  if (
    preparation.status === 'overlay_approved_read_only'
    && preparation.issues.length > 0
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['issues'],
      message: 'approved read-only overlays cannot carry preparation issues',
    });
  }
  if (
    preparation.status === 'base_contract_only'
    && preparation.contract.boundary.critical_facts_can_be_asserted
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contract', 'boundary', 'critical_facts_can_be_asserted'],
      message: 'base-only legacy preparation cannot assert critical facts',
    });
  }
});

export const StoryKnowledgeGenerationShadowV1Schema = z.object({
  schema_version: z.literal('story-knowledge-generation-shadow/v1'),
  status: z.enum(['safe_no_fact_candidates', 'safe_fact_candidates', 'blocked']),
  entry_name: StoryKnowledgeNonEmptyTextSchema,
  preparation_status: z.enum([
    'base_contract_only',
    'overlay_pending',
    'overlay_approved_read_only',
    'overlay_rejected',
    'overlay_incompatible',
  ]),
  legacy_material_projection: z.object({
    verified_fact_count: z.number().int().nonnegative(),
    uncertain_claim_count: z.number().int().nonnegative(),
  }).strict(),
  contract_projection: z.object({
    source_count: z.number().int().nonnegative(),
    ungraded_source_count: z.number().int().nonnegative(),
    machine_mapped_source_count: z.number().int().nonnegative(),
    human_verified_authoritative_source_count: z.number().int().nonnegative(),
    fact_candidate_claim_ids: StoryKnowledgeUniqueTextArraySchema,
    bounded_context_claim_ids: StoryKnowledgeUniqueTextArraySchema,
    blocked_claim_ids: StoryKnowledgeUniqueTextArraySchema,
  }).strict(),
  amplification_checks: z.object({
    ungraded_source_promoted_to_fact_count: z.number().int().nonnegative(),
    machine_only_source_promoted_to_fact_count: z.number().int().nonnegative(),
    non_authoritative_source_promoted_to_fact_count: z.number().int().nonnegative(),
    non_verified_claim_promoted_to_fact_count: z.number().int().nonnegative(),
    blocked_claim_promoted_to_fact_count: z.number().int().nonnegative(),
    doubtful_entry_promoted_to_fact: z.boolean(),
    structured_fact_count_not_above_ready_count: z.boolean(),
  }).strict(),
  issues: StoryKnowledgeUniqueTextArraySchema,
  boundary: z.object({
    shadow_only: z.literal(true),
    consumed_by_blueprint: z.literal(false),
    consumed_by_prompt: z.literal(false),
    consumed_by_fallback: z.literal(false),
    persistence_allowed: z.literal(false),
    generation_output_changed: z.literal(false),
    generated_content_writeback_allowed: z.literal(false),
    machine_validation_only: z.literal(true),
    real_human_review_credit_granted: z.literal(false),
  }).strict(),
}).strict().superRefine((shadow, context) => {
  if (shadow.status === 'blocked' && shadow.issues.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['issues'],
      message: 'blocked shadow reports require at least one issue',
    });
  }
  if (shadow.status !== 'blocked' && shadow.issues.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['issues'],
      message: 'safe shadow reports cannot carry issues',
    });
  }
  if (
    shadow.status === 'safe_no_fact_candidates'
    && shadow.contract_projection.fact_candidate_claim_ids.length > 0
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contract_projection', 'fact_candidate_claim_ids'],
      message: 'safe_no_fact_candidates requires an empty fact candidate projection',
    });
  }
});

const StoryKnowledgeSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const StoryKnowledgePromptShadowComparisonV1Schema = z.object({
  schema_version: z.literal('story-knowledge-prompt-shadow-comparison/v1'),
  status: z.enum(['safe_no_candidate', 'candidate_ready', 'blocked']),
  preparation_status: z.enum([
    'base_contract_only',
    'overlay_pending',
    'overlay_approved_read_only',
    'overlay_rejected',
    'overlay_incompatible',
  ]),
  fact_candidate_claim_ids: StoryKnowledgeUniqueTextArraySchema,
  active_generation_inputs_sha256: StoryKnowledgeSha256Schema,
  shadow_generation_inputs_sha256: StoryKnowledgeSha256Schema.optional(),
  active_prompt_package_sha256: StoryKnowledgeSha256Schema,
  shadow_prompt_package_sha256: StoryKnowledgeSha256Schema.optional(),
  execution_prompt_package_sha256: StoryKnowledgeSha256Schema,
  changed_generation_input_paths: StoryKnowledgeUniqueTextArraySchema,
  changed_prompt_package_paths: StoryKnowledgeUniqueTextArraySchema,
  issues: StoryKnowledgeUniqueTextArraySchema,
  boundary: z.object({
    comparison_only: z.literal(true),
    active_prompt_preserved_for_execution: z.literal(true),
    shadow_prompt_executed: z.literal(false),
    shadow_prompt_persisted: z.literal(false),
    generation_output_changed: z.literal(false),
    source_markdown_writeback_allowed: z.literal(false),
    machine_validation_only: z.literal(true),
    real_human_review_credit_granted: z.literal(false),
    production_credit_granted: z.literal(false),
  }).strict(),
}).strict().superRefine((comparison, context) => {
  if (comparison.execution_prompt_package_sha256 !== comparison.active_prompt_package_sha256) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['execution_prompt_package_sha256'],
      message: 'execution must remain bound to the active prompt package',
    });
  }
  const hasShadowArtifacts = Boolean(
    comparison.shadow_generation_inputs_sha256
    && comparison.shadow_prompt_package_sha256,
  );
  if (comparison.status === 'candidate_ready') {
    if (comparison.fact_candidate_claim_ids.length === 0 || !hasShadowArtifacts) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'candidate_ready requires fact candidates and both shadow hashes',
      });
    }
    if (
      comparison.changed_generation_input_paths.length === 0
      || comparison.changed_prompt_package_paths.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changed_prompt_package_paths'],
        message: 'candidate_ready requires observable generation-input and prompt-package diffs',
      });
    }
  }
  if (comparison.status === 'safe_no_candidate' && (
    comparison.fact_candidate_claim_ids.length > 0
    || hasShadowArtifacts
    || comparison.changed_generation_input_paths.length > 0
    || comparison.changed_prompt_package_paths.length > 0
  )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'safe_no_candidate cannot carry candidate artifacts or diffs',
    });
  }
  if (comparison.status === 'blocked' && comparison.issues.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['issues'],
      message: 'blocked prompt shadow comparisons require at least one issue',
    });
  }
  if (comparison.status !== 'blocked' && comparison.issues.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['issues'],
      message: 'safe prompt shadow comparisons cannot carry issues',
    });
  }
});

export const StoryKnowledgeMigrationDecisionV1Schema = z.object({
  schema_version: z.literal('story-knowledge-migration-decision/v1'),
  binding: z.object({
    generation_shadow_sha256: StoryKnowledgeSha256Schema,
    prompt_shadow_comparison_sha256: StoryKnowledgeSha256Schema,
  }).strict(),
  decision: z.enum(['eligible_for_operator_review', 'remain_shadow']),
  formal_consumption_blockers: StoryKnowledgeUniqueTextArraySchema.refine(
    values => values.length > 0,
    'formal consumption requires at least one unresolved blocker',
  ),
  summary: z.object({
    preparation_status: z.enum([
      'base_contract_only',
      'overlay_pending',
      'overlay_approved_read_only',
      'overlay_rejected',
      'overlay_incompatible',
    ]),
    generation_shadow_status: z.enum([
      'safe_no_fact_candidates',
      'safe_fact_candidates',
      'blocked',
    ]),
    prompt_shadow_status: z.enum(['safe_no_candidate', 'candidate_ready', 'blocked']),
    fact_candidate_count: z.number().int().nonnegative(),
  }).strict(),
  boundary: z.object({
    operator_review_only: z.literal(true),
    formal_consumption_allowed: z.literal(false),
    activation_performed: z.literal(false),
    rollback_required: z.literal(false),
    persistence_allowed: z.literal(false),
    real_human_review_credit_granted: z.literal(false),
    production_credit_granted: z.literal(false),
  }).strict(),
}).strict();

export const MaterialPurposeSchema = z.enum([
  'fact_basis',
  'character_source',
  'visual_asset',
  'era_context',
  'regional_context',
  'cultural_background',
  'brand_info',
  'institutional_position',
  'source_work',
  'reference_style',
  'creative_boundary',
]);

export const MaterialSourceTypeSchema = z.enum([
  'knowledge_entry',
  'user_outline',
  'user_source_text',
  'brand_profile',
  'institution_profile',
  'visual_asset',
  'reference_style',
  'manual_note',
]);

export const MaterialPackEntrySchema = z.object({
  material_id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  source_type: MaterialSourceTypeSchema,
  purpose: z.array(MaterialPurposeSchema).min(1),
  confidence: z.number().optional(),
  role_in_story: z.string().optional(),
  provenance: z.string().optional(),
  linked_entry_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const MaterialSufficiencyMissingItemSchema = z.object({
  item_id: z.string(),
  label: z.string(),
  reason: z.string(),
  blocking_level: z.enum(['blocking', 'risk', 'optional']),
  affects: z.array(z.string()),
  recommended_question: z.string(),
});

export const MaterialSufficiencyStageReportSchema = z.object({
  stage: z.enum(['minimum_viable_story', 'script_ready', 'production_ready']),
  status: z.enum(['ready', 'needs_input', 'blocked']),
  score: z.number().min(0).max(100),
  can_proceed: z.boolean(),
  required_items: z.array(z.string()),
  available_outputs: z.array(z.string()),
  missing_items: z.array(MaterialSufficiencyMissingItemSchema),
  optional_items: z.array(MaterialSufficiencyMissingItemSchema),
  notes: z.array(z.string()),
});

export const MaterialSufficiencyReportSchema = z.object({
  schema_version: z.literal('material-sufficiency/v1'),
  stage: z.enum(['minimum_viable_story', 'script_ready', 'production_ready']),
  active_stage: z.enum(['minimum_viable_story', 'script_ready', 'production_ready']).optional(),
  score: z.number().min(0).max(100),
  can_generate: z.boolean(),
  can_generate_with_risks: z.boolean(),
  blocked: z.boolean(),
  needs_verification: z.boolean().optional(),
  generation_posture: z.enum([
    'ready',
    'draft_needs_verification',
    'script_ready_production_pending',
    'blocked_until_input',
  ]).optional(),
  next_stage: z.enum(['minimum_viable_story', 'script_ready', 'production_ready']).optional(),
  downgrade_reason: z.string().optional(),
  stage_reports: z.array(MaterialSufficiencyStageReportSchema).optional(),
  missing_items: z.array(MaterialSufficiencyMissingItemSchema),
  optional_items: z.array(MaterialSufficiencyMissingItemSchema),
  token_risk: z.enum(['low', 'medium', 'high']),
  recommended_next_questions: z.array(z.string()),
});

export const MaterialPackSchema = z.object({
  schema_version: z.literal('material-pack/v1'),
  primary_materials: z.array(MaterialPackEntrySchema),
  supporting_materials: z.array(MaterialPackEntrySchema),
  reference_materials: z.array(MaterialPackEntrySchema),
  brand_or_institution_profile: z.object({
    name: z.string().optional(),
    client_type: z.string().optional(),
    voice: z.string().optional(),
    verified_claims: z.array(z.string()).optional(),
    forbidden_claims: z.array(z.string()).optional(),
  }).optional(),
  source_work_profile: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    rights_note: z.string().optional(),
    adaptation_boundary: z.string().optional(),
    core_characters: z.array(z.string()).optional(),
    must_keep: z.array(z.string()).optional(),
  }).optional(),
  visual_assets: z.array(z.object({
    asset_id: z.string(),
    label: z.string(),
    kind: z.enum(['character', 'scene', 'prop', 'document', 'brand', 'other']),
    description: z.string(),
    source_material_id: z.string().optional(),
    file_url: z.string().optional(),
  })),
  verified_facts: z.array(z.string()),
  uncertain_claims: z.array(z.string()),
  creative_space: z.array(z.string()),
  missing_needs: z.array(KnowledgePackMissingSchema),
  overall_confidence: z.number(),
  token_budget_summary: z.object({
    estimated_input_tokens: z.number().optional(),
    strategy: z.string().optional(),
    notes: z.array(z.string()).optional(),
  }).optional(),
});

export const ProjectMaterialPackTargetSchema = z.enum([
  'primary_materials',
  'supporting_materials',
  'reference_materials',
]);

export const ProjectMaterialPackAddMaterialRequestSchema = z.object({
  target: ProjectMaterialPackTargetSchema.optional().default('supporting_materials'),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1200),
  source_type: MaterialSourceTypeSchema.optional().default('manual_note'),
  purpose: z.array(MaterialPurposeSchema).min(1).max(6),
  confidence: z.number().min(0).max(1).optional(),
  role_in_story: z.string().trim().min(1).max(240).optional(),
  provenance: z.string().trim().min(1).max(240).optional(),
  linked_entry_name: z.string().trim().min(1).max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  mark_as_verified_fact: z.boolean().optional().default(false),
  remove_missing_need_id: z.string().trim().min(1).max(120).optional(),
});

const ProjectExternalEvidenceCandidateImportBaseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(1600),
  source_uri: z.string().trim().min(1).max(2048).url().refine(
    value => value.startsWith('https://') || value.startsWith('artifact://'),
    'source_uri must use https:// or artifact://',
  ),
  source_label: z.string().trim().min(1).max(240),
  content_sha256: z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/),
  captured_at: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().min(1).max(1200).optional(),
});

export const ProjectExternalEvidenceCandidateImportRequestSchema = z.discriminatedUnion('field_id', [
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('official_catalog_or_resource_links'),
    evidence_type: z.literal('official_resource_link'),
  }).strict(),
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('community_or_practitioner_consent'),
    evidence_type: z.literal('community_consent_record'),
  }).strict(),
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('documentation_assets'),
    evidence_type: z.literal('documentation_asset'),
  }).strict(),
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('interview_clip_selection'),
    evidence_type: z.literal('interview_clip'),
  }).strict(),
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('field_notes'),
    evidence_type: z.literal('field_note'),
  }).strict(),
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('reference_images_or_keyframes'),
    evidence_type: z.literal('reference_image'),
  }).strict(),
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('single_shot_test'),
    evidence_type: z.literal('single_shot_test_result'),
  }).strict(),
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('rights_and_attribution'),
    evidence_type: z.literal('rights_attribution_record'),
  }).strict(),
  ProjectExternalEvidenceCandidateImportBaseSchema.extend({
    field_id: z.literal('location_permissions'),
    evidence_type: z.literal('location_permission_record'),
  }).strict(),
]);

const ProjectExternalEvidenceUploadMetadataBaseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(1600),
  source_label: z.string().trim().min(1).max(240),
  captured_at: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().min(1).max(1200).optional(),
});

export const ProjectExternalEvidenceUploadMetadataSchema = z.discriminatedUnion('field_id', [
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('official_catalog_or_resource_links'),
    evidence_type: z.literal('official_resource_link'),
  }).strict(),
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('community_or_practitioner_consent'),
    evidence_type: z.literal('community_consent_record'),
  }).strict(),
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('documentation_assets'),
    evidence_type: z.literal('documentation_asset'),
  }).strict(),
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('interview_clip_selection'),
    evidence_type: z.literal('interview_clip'),
  }).strict(),
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('field_notes'),
    evidence_type: z.literal('field_note'),
  }).strict(),
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('reference_images_or_keyframes'),
    evidence_type: z.literal('reference_image'),
  }).strict(),
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('single_shot_test'),
    evidence_type: z.literal('single_shot_test_result'),
  }).strict(),
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('rights_and_attribution'),
    evidence_type: z.literal('rights_attribution_record'),
  }).strict(),
  ProjectExternalEvidenceUploadMetadataBaseSchema.extend({
    field_id: z.literal('location_permissions'),
    evidence_type: z.literal('location_permission_record'),
  }).strict(),
]);

export const ProjectExternalEvidenceIdSchema = z.string().regex(
  /^external-evidence-[a-z_]+-[a-f0-9]{16}$/,
  'evidence_id must identify a project external evidence candidate',
);

export const ProjectExternalEvidenceVerificationRequestSchema = z.object({
  evidence_id: ProjectExternalEvidenceIdSchema,
  expected_content_sha256: z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/),
  expected_candidate_status: z.enum(['pending_verification', 'verified', 'rejected', 'revoked']),
  idempotency_key: z.string().trim().min(8).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  decision: z.enum(['accept', 'reject', 'revoke']),
  scope_attestation: z.object({
    source_matches_candidate: z.literal(true),
    evidence_supports_field: z.literal(true),
    usage_scope_confirmed: z.literal(true),
  }).strict().optional(),
  review_note: z.string().trim().min(8).max(1200),
}).strict().superRefine((request, context) => {
  if (request.decision === 'accept' && !request.scope_attestation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scope_attestation'],
      message: 'scope_attestation is required to accept external evidence',
    });
  }
});

// ---------------------------------------------------------------------------
// Duration & panel count
// ---------------------------------------------------------------------------

export const DurationSchema = z.enum(['30秒', '1分钟', '3分钟', '5分钟', '8分钟', '10分钟', '15分钟', '20分钟']);

export const PanelCountSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(12),
]);

export const StoryDetectedCharacterSchema = z.object({
  name: z.string().min(1),
  role_position: z.enum(['主角', '反派', '配角', '路人', '群演']),
  character_kind: z.enum(['named_person', 'identity_role', 'group_role', 'supernatural_role']),
  source_text: z.string().min(1),
  asset_stability: z.enum(['recurring', 'single_scene']),
  age_range: z.enum(['儿童', '少年', '青年', '中年', '老年', '不适用']).optional(),
  gender: z.enum(['男', '女', '其他', '未指定', '不适用']).optional(),
});

// ---------------------------------------------------------------------------
// Story plan request
// ---------------------------------------------------------------------------

export const StoryPlanRequestSchema = z.object({
  domain: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/, 'domain must be a lowercase domain identifier').optional(),
  entry_name: z.string().min(1, 'entry_name cannot be empty'),
  original_user_query: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Story generate request
// ---------------------------------------------------------------------------

export const StoryGenerateRequestSchema = z.object({
  domain: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/, 'domain must be a lowercase domain identifier').optional(),
  entry_name: z.string().optional(),
  original_user_query: z.string().optional(),
  generation_type: GenerationTypeSchema.optional(),
  video_type: VideoTypeSchema.optional(),
  model_profile_id: StoryGenerationModelProfileIdSchema.optional(),
  generation_fallback_policy: z.enum([
    'allow_local_fallback',
    'forbid_local_fallback',
  ]).optional(),
  material_readiness_policy: z.enum([
    'allow_draft_with_risks',
    'require_script_ready',
  ]).optional(),
  selected_event: z.string().optional(),
  target_video_duration: DurationSchema.optional(),
  tone: z.string().optional(),
  presentation_style: PresentationStyleSchema.optional(),
  output_gears_segments: z.boolean().optional().default(true),
  // New fields for outline-driven multi-knowledge matching
  outline: z.string().optional(),
  character_hints: z.array(StoryDetectedCharacterSchema).optional(),
  knowledge_pack: KnowledgePackSchema.optional(),
  material_pack: MaterialPackSchema.optional(),
  creation_use_case: CreationUseCaseSchema.optional(),
  truth_mode: TruthModeSchema.optional(),
  client_type: z.string().trim().min(1).max(80).optional(),
  target_audience: z.string().trim().min(1).max(120).optional(),
  communication_goal: z.string().trim().min(1).max(240).optional(),
  // New fields for story structure and creative reference (Phase 5)
  story_structure: StoryStructureTypeSchema.optional(),
  creative_reference_ids: z.array(z.string()).optional(),
  style_pack_ids: z.array(z.string().trim().min(1))
    .max(20)
    .refine(uniqueReferenceIds, 'style_pack_ids must be unique')
    .optional(),
  reference_similarity_evidence_ids: z.array(
    z.string().regex(/^reference-similarity-evidence-[a-f0-9-]+$/),
  )
    .max(20)
    .refine(uniqueReferenceIds, 'reference_similarity_evidence_ids must be unique')
    .optional(),
  reference_baseline_story_id: z.string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/)
    .optional(),
  reference_generation_recipe: z.object({
    schema_version: z.literal('reference-generation-recipe/v1'),
    recipe_id: z.enum([
      'feature_long_goal_payoff',
      'feature_epoch_character_mosaic',
      'feature_moral_pressure',
      'promo_space_emotion',
      'promo_mnemonic_reveal',
      'promo_collective_montage',
      'heritage_craft_process_evidence',
      'documentary_evidence_trail',
      'explainer_question_to_example',
      'legend_symbolic_trial',
      'children_gentle_choice_loop',
      'promo_city_day_identity',
      'lecture_case_to_action',
      'training_objective_practice_feedback',
      'spatial_route_time_layers',
      'landscape_sensory_breath',
      'series_strategy_chapters',
      'series_ritual_relationships',
    ]),
    recipe_version: z.literal('1.0.0'),
    reusable_mechanisms: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
    avoid_copying: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
    payload_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict().optional(),
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  cultural_source_kinds: z.array(CulturalStorySourceKindSchema)
    .min(1)
    .max(4)
    .refine(uniqueReferenceIds, 'cultural_source_kinds must be unique')
    .optional(),
  reference_strength: ReferenceStrengthSchema.optional(),
  genre_strictness: GenreStrictnessSchema.optional().default('balanced'),
  auto_repair: z.boolean().optional().default(false),
  story_priority: StoryGenerationPrioritySchema.optional().default('balanced'),
  source_material_mode: SourceMaterialModeSchema.optional().default('generate_from_knowledge'),
  localized_target_region: z.string().trim().min(1).max(40).optional(),
  localization_mode: LocalizationModeSchema.optional().default('allow_related_influence'),
}).refine(
  (data) => data.entry_name || data.knowledge_pack || data.material_pack || data.outline,
  { message: 'At least one of entry_name, knowledge_pack, material_pack, or outline must be provided', path: ['entry_name'] },
).refine(
  (data) => data.generation_type || data.video_type,
  { message: 'Either generation_type or video_type must be provided', path: ['video_type'] },
).refine(
  (data) => {
    if (!data.truth_mode || !data.video_type) return true;
    if (data.truth_mode === 'fictional_original') {
      return !['documentary_short', 'education_training', 'lecture_video', 'explainer_video'].includes(data.video_type);
    }
    if (data.truth_mode === 'institutional_verified') {
      return !['legend_story', 'children_story'].includes(data.video_type);
    }
    return true;
  },
  { message: 'truth_mode is not compatible with the selected video_type', path: ['truth_mode'] },
).refine(
  (data) => !data.reference_baseline_story_id
    || (data.style_pack_ids?.length ?? 0) > 0
    || Boolean(data.reference_generation_recipe),
  {
    message: 'reference_baseline_story_id requires a style_pack_id or reference_generation_recipe',
    path: ['reference_baseline_story_id'],
  },
).refine(
  // memory_mosaic_biography only compatible with certain video_types
  (data) => {
    if (data.story_structure === 'memory_mosaic_biography') {
      const allowedVideoTypes = ['character_story', 'historical_drama', 'documentary_short', 'ai_comic_drama'];
      const resolvedVideoType = data.video_type ?? (data.generation_type ? { character_story: 'character_story', culture_promo: 'culture_promo', scene_short: 'scene_short' }[data.generation_type] : undefined);
      if (resolvedVideoType && !allowedVideoTypes.includes(resolvedVideoType)) {
        return false;
      }
    }
    return true;
  },
  { message: 'memory_mosaic_biography is only compatible with character_story, historical_drama, documentary_short, or ai_comic_drama', path: ['story_structure'] },
);

export const StoryKnowledgePromptShadowCanaryRequestV1Schema = z.object({
  schema_version: z.literal('story-knowledge-prompt-shadow-canary-request/v1'),
  operator_intent: z.literal('read_only_shadow_canary'),
  generation_request: StoryGenerateRequestSchema,
  evidence_overlay: z.unknown().optional(),
}).strict();

export const StoryKnowledgePromptShadowCanaryV1Schema = z.object({
  schema_version: z.literal('story-knowledge-prompt-shadow-canary/v1'),
  canary_status: z.literal('evaluated'),
  request_sha256: StoryKnowledgeSha256Schema,
  binding: z.object({
    generation_request_sha256: StoryKnowledgeSha256Schema,
    evidence_overlay_sha256: StoryKnowledgeSha256Schema.optional(),
    generation_shadow_sha256: StoryKnowledgeSha256Schema,
    prompt_shadow_comparison_sha256: StoryKnowledgeSha256Schema,
    migration_decision_sha256: StoryKnowledgeSha256Schema,
  }).strict(),
  entry_name: StoryKnowledgeNonEmptyTextSchema,
  generation_shadow: StoryKnowledgeGenerationShadowV1Schema,
  prompt_shadow_comparison: StoryKnowledgePromptShadowComparisonV1Schema,
  migration_decision: StoryKnowledgeMigrationDecisionV1Schema,
  boundary: z.object({
    restricted_operator_entry: z.literal(true),
    read_only: z.literal(true),
    adapter_invoked: z.literal(false),
    external_model_called: z.literal(false),
    local_generation_computed_in_memory: z.literal(true),
    local_generation_output_discarded: z.literal(true),
    local_story_result_returned: z.literal(false),
    prompt_text_returned: z.literal(false),
    shadow_prompt_executed: z.literal(false),
    story_persisted: z.literal(false),
    project_persisted: z.literal(false),
    source_markdown_written: z.literal(false),
    formal_generation_consumption_allowed: z.literal(false),
    real_human_review_credit_granted: z.literal(false),
    production_credit_granted: z.literal(false),
  }).strict(),
}).strict();

export const ReferenceGenerationRecipeRecommendationRequestSchema = z.object({
  creation_path: z.enum(['original', 'adaptation', 'institutional']),
  video_type: VideoTypeSchema,
  creation_use_case: CreationUseCaseSchema.optional(),
  truth_mode: TruthModeSchema.optional(),
  subject_text: z.string().trim().max(4_000).optional(),
  narrative_goal: z.string().trim().max(1_000).optional(),
  material_features: z.array(z.enum([
    'structured_knowledge_pack',
    'documented_character_choice',
    'multi_period_scope',
    'ensemble_cast',
    'spatial_subject',
    'public_service_goal',
    'institutional_brief',
    'strategy_or_power_material',
    'ritual_or_relationship_material',
    'rhythmic_short_scene_material',
    'limited_or_unverified_material',
  ])).max(20).refine(
    values => new Set(values).size === values.length,
    'material_features must be unique',
  ).optional(),
}).strict();

export const ReferenceGenerationRecipeIdSchema = z.enum([
  'feature_long_goal_payoff',
  'feature_epoch_character_mosaic',
  'feature_moral_pressure',
  'promo_space_emotion',
  'promo_mnemonic_reveal',
  'promo_collective_montage',
  'heritage_craft_process_evidence',
  'documentary_evidence_trail',
  'explainer_question_to_example',
  'legend_symbolic_trial',
  'children_gentle_choice_loop',
  'promo_city_day_identity',
  'lecture_case_to_action',
  'training_objective_practice_feedback',
  'spatial_route_time_layers',
  'landscape_sensory_breath',
  'series_strategy_chapters',
  'series_ritual_relationships',
]);

export const ReferenceRecipeComparisonDraftRequestSchema = z.object({
  baseline_story_id: z.string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/),
  recipe_id: ReferenceGenerationRecipeIdSchema,
}).strict();

export const StoryRecipeEffectComparisonHistoryQuerySchema = z.object({
  recipe_id: ReferenceGenerationRecipeIdSchema.optional(),
  video_type: VideoTypeSchema.optional(),
  machine_verdict: z.enum([
    'improved',
    'mixed',
    'no_material_change',
    'regressed',
  ]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const StoryRecipeEffectMachineReportQuerySchema =
StoryRecipeEffectComparisonHistoryQuerySchema.extend({
  from_updated_at: z.string().datetime({ offset: true }).optional(),
  to_updated_at: z.string().datetime({ offset: true }).optional(),
  min_comparisons_per_recipe: z.coerce.number().int().min(1).max(100).optional(),
}).strict().refine(
  value => !value.from_updated_at
    || !value.to_updated_at
    || value.from_updated_at <= value.to_updated_at,
  {
    message: 'from_updated_at must be earlier than or equal to to_updated_at',
    path: ['from_updated_at'],
  },
);

const StoryRecipeEffectHumanReviewDecisionSchema = z.enum([
  'baseline_preferred',
  'recipe_preferred',
  'no_preference',
  'insufficient_evidence',
]);

const StoryRecipeEffectHumanReviewReportFiltersSchema = z.object({
  recipe_id: ReferenceGenerationRecipeIdSchema.optional(),
  video_type: VideoTypeSchema.optional(),
  machine_verdict: z.enum([
    'improved',
    'mixed',
    'no_material_change',
    'regressed',
  ]).optional(),
  from_updated_at: z.string().datetime({ offset: true }).optional(),
  to_updated_at: z.string().datetime({ offset: true }).optional(),
  min_comparisons_per_recipe: z.number().int().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).strict().refine(
  value => !value.from_updated_at
    || !value.to_updated_at
    || value.from_updated_at <= value.to_updated_at,
  {
    message: 'from_updated_at must be earlier than or equal to to_updated_at',
    path: ['from_updated_at'],
  },
);

export const StoryRecipeEffectHumanReviewSubmitRequestSchema = z.object({
  project_id: z.string()
    .regex(/^\d{8}-story-[0-9a-z]+--[a-z_]+$/),
  story_id: z.string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/),
  cohort: z.object({
    cohort_id: z.string().regex(/^recipe-effect-cohort-[a-f0-9]{12}$/),
    membership_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    report_filters: StoryRecipeEffectHumanReviewReportFiltersSchema,
  }).strict(),
  reviewer: z.object({
    reviewer_id: z.string().trim().min(3).max(128)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/),
    display_name: z.string().trim().min(1).max(120),
    identity_reference: z.string().trim().min(3).max(256),
  }).strict(),
  review: z.object({
    decision: StoryRecipeEffectHumanReviewDecisionSchema,
    rationale: z.string().trim().min(10).max(4000),
    evidence_references: z.array(z.string().trim().min(1).max(256))
      .max(50)
      .refine(uniqueReferenceIds, 'evidence_references must be unique'),
    method: z.enum(['blind_to_machine_verdict', 'machine_verdict_visible']),
  }).strict(),
  attestation: z.object({
    human_reviewer: z.literal(true),
    compared_both_outputs: z.literal(true),
    independent_judgment: z.literal(true),
  }).strict(),
  idempotency_key: z.string().trim().min(8).max(128)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
}).strict();

export const StoryRecipeEffectHumanReviewLedgerQuerySchema = z.object({
  project_id: z.string()
    .regex(/^\d{8}-story-[0-9a-z]+--[a-z_]+$/)
    .optional(),
  story_id: z.string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/)
    .optional(),
  reviewer_id: z.string().trim().min(3).max(128)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/)
    .optional(),
  decision: StoryRecipeEffectHumanReviewDecisionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const ReferenceBaselineReplayDraftRequestSchema = z.object({
  baseline_story_id: z.string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/),
  style_pack_ids: z.array(ReferenceStylePackIdSchema)
    .min(1)
    .max(20)
    .refine(uniqueReferenceIds, 'style_pack_ids must be unique'),
}).strict();

export const StoryListQuerySchema = z.object({
  generation_type: GenerationTypeSchema.optional(),
  video_type: VideoTypeSchema.optional(),
  domain: z.string().trim().regex(
    /^[a-z][a-z0-9_]{1,63}$/,
    'domain must be a lowercase domain identifier',
  ).optional(),
});

export const ProfessionalTextPackageFieldSchema = z.enum([
  'creative_brief',
  'audience_promise',
  'premise_or_core_question',
  'theme_statement',
  'truth_and_adaptation_contract',
  'structure_outline',
  'sequence_beats',
  'scene_breakdown',
  'full_text',
  'dialogue_or_narration_pass',
  'director_text_plan',
  'continuity_ledger',
  'quality_report',
  'coverage_report',
  'revision_trace',
  'delivery_text_package',
]);

export const ProfessionalQualityDimensionIdSchema = z.enum([
  'creative_brief_and_audience_promise',
  'premise_and_theme_unity',
  'structure_causality_and_pacing',
  'character_agency_and_relationship_change',
  'scene_function_visible_action_and_blocking',
  'dialogue_narration_and_subtext',
  'emotional_curve_and_aftertaste',
  'cultural_fact_and_adaptation_boundary',
  'production_executability',
  'originality_and_distinctiveness',
]);

export const ProfessionalTextArchitectureModeSchema = z.enum([
  'character_relationships',
  'information_architecture',
  'spatial_route',
  'visual_mood',
]);

const ProfessionalQualityDimensionWeightsSchema = z.object({
  creative_brief_and_audience_promise: z.number().min(0).max(100),
  premise_and_theme_unity: z.number().min(0).max(100),
  structure_causality_and_pacing: z.number().min(0).max(100),
  character_agency_and_relationship_change: z.number().min(0).max(100),
  scene_function_visible_action_and_blocking: z.number().min(0).max(100),
  dialogue_narration_and_subtext: z.number().min(0).max(100),
  emotional_curve_and_aftertaste: z.number().min(0).max(100),
  cultural_fact_and_adaptation_boundary: z.number().min(0).max(100),
  production_executability: z.number().min(0).max(100),
  originality_and_distinctiveness: z.number().min(0).max(100),
}).refine(
  weights => Math.abs(Object.values(weights).reduce((sum, value) => sum + value, 0) - 100) < 0.001,
  { message: 'professional quality dimension weights must total 100' },
);

export const ProfessionalTextTypeContractSchema = z.object({
  schema_version: z.literal('professional-text-type-contract/v1'),
  video_type: VideoTypeSchema,
  line: z.enum(['剧情故事线', '宣传传播线', '非虚构与知识线', '空间与意境线']),
  primary_text_form: z.string().trim().min(1),
  architecture_mode: ProfessionalTextArchitectureModeSchema,
  required_package_fields: z.array(ProfessionalTextPackageFieldSchema).length(16),
  required_deliverables: z.array(z.string().trim().min(1)).min(5),
  exclusive_quality_gate: z.string().trim().min(1),
  quality_dimension_weights: ProfessionalQualityDimensionWeightsSchema,
  hard_gates: z.array(z.string().trim().min(1)).min(1),
  repair_focus: z.array(z.string().trim().min(1)).min(1),
}).superRefine((contract, context) => {
  if (new Set(contract.required_package_fields).size !== contract.required_package_fields.length) {
    context.addIssue({
      code: 'custom',
      path: ['required_package_fields'],
      message: 'required_package_fields must not contain duplicates',
    });
  }
});

const ProfessionalCreativeBriefSchema = z.object({
  target_audience: z.string(),
  platform: z.string(),
  target_duration: DurationSchema,
  communication_goal: z.string(),
  production_goal: z.string(),
  budget_assumptions: z.array(z.string()),
  delivery_constraints: z.array(z.string()),
});

const ProfessionalEvidenceItemSchema = z.object({
  evidence_id: z.string().trim().min(1),
  status: z.enum(['verified_fact', 'plausible_dramatization', 'fictional_addition', 'unknown']),
  claim: z.string(),
  source: z.string(),
  allowed_usage: z.string(),
  verification_note: z.string(),
});

const ResearchAndEvidenceDossierSchema = z.object({
  source_summary: z.string(),
  evidence_items: z.array(ProfessionalEvidenceItemSchema),
  unknowns: z.array(z.string()),
  authorization_notes: z.array(z.string()),
});

const ProfessionalTruthAndAdaptationContractSchema = z.object({
  truth_mode: TruthModeSchema,
  verified_facts: z.array(z.string()),
  plausible_dramatizations: z.array(z.string()),
  fictional_additions: z.array(z.string()),
  unknown_or_forbidden_claims: z.array(z.string()),
  required_disclaimers: z.array(z.string()),
});

const ProfessionalStructureOutlineSchema = z.object({
  structure_name: z.string(),
  opening: z.string(),
  development: z.array(z.string()),
  climax_or_key_turn: z.string(),
  ending: z.string(),
});

const ProfessionalSequenceBeatSchema = z.object({
  beat_id: z.string().trim().min(1),
  order: z.number().int().min(1),
  title: z.string(),
  purpose: z.string(),
  visible_action: z.string(),
  conflict_discovery_or_instruction: z.string(),
  emotional_or_information_turn: z.string(),
  evidence_ids: z.array(z.string()),
});

const ProfessionalStorySceneSchema = z.object({
  scene_id: z.number().int().min(1),
  title: z.string(),
  duration_sec: z.number().min(0),
  location: z.string(),
  time_of_day: z.string(),
  dramatic_function: z.string(),
  plot: z.string(),
  key_action: z.string(),
  characters: z.array(z.string()),
  visual_prompt: z.string(),
  camera_suggestion: z.string(),
  cultural_note: z.string(),
  conflict: z.string().optional(),
  dialogue_or_narration: z.string().optional(),
  source_entries: z.array(z.string()).optional(),
  factual_basis: z.string().optional(),
  fictionalized_elements: z.array(z.string()).optional(),
});

const ProfessionalDialogueOrNarrationPassSchema = z.object({
  mode: z.enum(['dialogue', 'narration', 'mixed', 'minimal_text']),
  voice_rules: z.array(z.string()),
  polished_text: z.string(),
  unresolved_issues: z.array(z.string()),
});

const ProfessionalDirectorTextPlanSchema = z.object({
  visual_strategy: z.string(),
  sound_strategy: z.string(),
  rhythm_strategy: z.string(),
  sequences: z.array(z.object({
    sequence_id: z.string().trim().min(1),
    scene_ids: z.array(z.number().int().min(1)),
    blocking_and_visible_action: z.string(),
    camera_and_transition_intent: z.string(),
    sound_intent: z.string(),
    production_constraints: z.array(z.string()),
  })),
});

const ProfessionalContinuityLedgerSchema = z.object({
  items: z.array(z.object({
    continuity_id: z.string().trim().min(1),
    category: z.enum(['character', 'relationship', 'fact', 'prop', 'location', 'time', 'visual', 'terminology']),
    rule: z.string(),
    applies_to_scene_ids: z.array(z.number().int().min(1)),
    evidence_ids: z.array(z.string()),
  })),
  unresolved_conflicts: z.array(z.string()),
});

const ProfessionalTextQualityReportSchema = z.object({
  status: z.enum(['not_evaluated', 'failed', 'production_candidate', 'professional_candidate', 'high_quality_candidate']),
  total_score: z.number().min(0).max(100).optional(),
  dimensions: z.array(z.object({
    dimension_id: ProfessionalQualityDimensionIdSchema,
    weight: z.number().min(0).max(100),
    score: z.number().min(0).max(100).optional(),
    evidence: z.array(z.string()),
    issues: z.array(z.string()),
  })),
  hard_gate_failures: z.array(z.string()),
  professional_passed: z.boolean(),
  evaluator_notes: z.array(z.string()),
});

const ProfessionalCoverageReportSchema = z.object({
  verdict: z.enum(['not_evaluated', 'pass', 'revise', 'rebuild']),
  strengths: z.array(z.string()),
  structure_notes: z.array(z.string()),
  character_or_information_notes: z.array(z.string()),
  scene_notes: z.array(z.string()),
  dialogue_or_narration_notes: z.array(z.string()),
  pacing_notes: z.array(z.string()),
  fact_and_culture_notes: z.array(z.string()),
  production_notes: z.array(z.string()),
  action_items: z.array(z.string()),
});

const ProfessionalRevisionTraceItemSchema = z.object({
  revision_id: z.string().trim().min(1),
  created_at: z.string().datetime(),
  source: z.enum(['agent', 'writer_editor', 'director', 'fact_culture_reviewer', 'user']),
  reason: z.string(),
  changed_sections: z.array(ProfessionalTextPackageFieldSchema),
  resolved_issue_ids: z.array(z.string()),
  remaining_issues: z.array(z.string()),
  quality_delta: z.number().optional(),
});

const ProfessionalDeliveryTextPackageSchema = z.object({
  script_text: z.string(),
  scene_units: z.array(z.object({
    scene_id: z.number().int().min(1),
    script_text: z.string(),
    visual_action: z.string(),
    camera_intent: z.string(),
    sound_intent: z.string(),
    continuity_notes: z.array(z.string()),
    evidence_boundary_notes: z.array(z.string()),
  })),
  gears_handoff_notes: z.array(z.string()),
  seedance_handoff_notes: z.array(z.string()),
  validation_notes: z.array(z.string()),
});

export const ProfessionalTextPackageSchema = z.object({
  schema_version: z.literal('professional-text-package/v1'),
  package_id: z.string().trim().min(1),
  story_id: z.string().trim().min(1).optional(),
  project_id: z.string().trim().min(1).optional(),
  video_type: VideoTypeSchema,
  status: z.enum(['skeleton', 'draft', 'in_review', 'revision_required', 'approved']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  contract_version: z.literal('professional-text-type-contract/v1'),
  creative_brief: ProfessionalCreativeBriefSchema,
  research_and_evidence_dossier: ResearchAndEvidenceDossierSchema,
  audience_promise: z.string(),
  premise_or_core_question: z.string(),
  theme_statement: z.string(),
  truth_and_adaptation_contract: ProfessionalTruthAndAdaptationContractSchema,
  relationship_or_information_architecture: z.object({
    mode: ProfessionalTextArchitectureModeSchema,
    nodes: z.array(z.object({
      node_id: z.string().trim().min(1),
      label: z.string(),
      role: z.string(),
    })),
    links: z.array(z.object({
      from: z.string().trim().min(1),
      to: z.string().trim().min(1),
      relationship: z.string(),
    })),
  }),
  structure_outline: ProfessionalStructureOutlineSchema,
  sequence_beats: z.array(ProfessionalSequenceBeatSchema),
  scene_breakdown: z.array(ProfessionalStorySceneSchema),
  full_text: z.string(),
  dialogue_or_narration_pass: ProfessionalDialogueOrNarrationPassSchema,
  director_text_plan: ProfessionalDirectorTextPlanSchema,
  continuity_ledger: ProfessionalContinuityLedgerSchema,
  quality_report: ProfessionalTextQualityReportSchema,
  coverage_report: ProfessionalCoverageReportSchema,
  revision_trace: z.array(ProfessionalRevisionTraceItemSchema),
  delivery_text_package: ProfessionalDeliveryTextPackageSchema,
}).superRefine((pkg, context) => {
  if (pkg.status === 'approved' && pkg.quality_report.professional_passed !== true) {
    context.addIssue({
      code: 'custom',
      path: ['quality_report', 'professional_passed'],
      message: 'approved package requires professional_passed=true',
    });
  }
  if (pkg.quality_report.professional_passed && pkg.quality_report.hard_gate_failures.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['quality_report', 'hard_gate_failures'],
      message: 'hard gate failures cannot coexist with professional_passed=true',
    });
  }
});

export const Stage6VerificationRecordSchema = z.object({
  status: z.enum(['unverified', 'verified']),
  reference: z.string(),
  verified_by: z.string(),
  verified_at: z.string(),
}).strict();

export const Stage6ReviewerAssignmentSchema = z.object({
  role: z.enum(['writer_editor', 'director', 'fact_culture_reviewer']),
  reviewer_id: z.string(),
  display_name: z.string(),
  identity_verification: Stage6VerificationRecordSchema,
}).strict();

export const Stage6RealInputProjectSchema = z.object({
  benchmark_id: z.string(),
  video_type: VideoTypeSchema,
  source_entry: z.string(),
  provenance: z.enum([
    'operator_submitted_real_input',
    'preparation_template',
    'fixture',
    'simulation',
    'fallback',
  ]),
  real_project_id: z.string(),
  initial_package: z.object({
    path: z.string(),
    sha256: z.string(),
  }).strict(),
  creator_authorization: z.object({
    subject_type: z.enum(['model', 'human_author']),
    subject_id: z.string(),
    authorized_rounds: z.array(z.union([z.literal(1), z.literal(2)])),
    verification: Stage6VerificationRecordSchema,
  }).strict(),
  revision_budget: z.object({
    currency: z.string(),
    amount: z.number().finite().min(0),
    authorized_rounds: z.array(z.union([z.literal(1), z.literal(2)])),
    verification: Stage6VerificationRecordSchema,
  }).strict(),
  reviewers: z.array(Stage6ReviewerAssignmentSchema),
  table_read: z.object({
    schedule_reference: z.string(),
    scheduled_at: z.string(),
    timezone: z.string(),
    participant_reviewer_ids: z.array(z.string()),
    verification: Stage6VerificationRecordSchema,
  }).strict(),
}).strict();

export const Stage6RealInputIntakeSchema = z.object({
  schema_version: z.literal('story-agent-stage6-real-input-intake/v1'),
  submitted_at: z.string(),
  operator: z.object({
    operator_id: z.string(),
    display_name: z.string(),
    contact_reference: z.string(),
  }).strict(),
  projects: z.array(Stage6RealInputProjectSchema).length(15),
}).strict();

const Stage6RealInputReadinessIssueSchema = z.object({
  code: z.string().trim().min(1),
  path: z.string(),
  message: z.string().trim().min(1),
}).strict();

export const Stage6RealInputProjectReadinessSchema = z.object({
  benchmark_id: z.string().trim().min(1),
  video_type: VideoTypeSchema,
  source_entry: z.string(),
  real_project_id: z.string(),
  initial_package_path: z.string(),
  initial_package_sha256: z.string(),
  status: z.enum(['ready', 'blocked']),
  blockers: z.array(Stage6RealInputReadinessIssueSchema),
  checks: z.object({
    intake_schema_valid: z.boolean(),
    registry_binding_valid: z.boolean(),
    real_provenance_verified: z.boolean(),
    real_project_id_valid: z.boolean(),
    initial_package_file_valid: z.boolean(),
    initial_package_schema_valid: z.boolean(),
    initial_package_binding_valid: z.boolean(),
    initial_package_sha256_valid: z.boolean(),
    creator_authorization_verified: z.boolean(),
    revision_budget_verified: z.boolean(),
    reviewer_assignments_verified: z.boolean(),
    table_read_verified: z.boolean(),
  }).strict(),
  completed_verified_round_count: z.literal(0),
  professional_passed: z.literal(false),
}).strict();

export const Stage6RealInputReadinessReportSchema = z.object({
  schema_version: z.literal('story-agent-stage6-real-input-readiness/v1'),
  generated_at: z.string().datetime(),
  source_intake_path: z.string(),
  source_intake_schema_version: z.string(),
  source_intake_canonical_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source_registry_schema_version: z.string(),
  source_registry_canonical_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  policy: z.object({
    readiness_counts_as_completed_revision: z.literal(false),
    fixture_simulation_fallback_counts_as_real_input: z.literal(false),
    professional_pass_can_be_granted_by_intake: z.literal(false),
  }).strict(),
  global_errors: z.array(Stage6RealInputReadinessIssueSchema),
  summary: z.object({
    project_count: z.number().int().nonnegative(),
    ready_project_count: z.number().int().nonnegative(),
    blocked_project_count: z.number().int().nonnegative(),
    completed_verified_revision_round_count: z.literal(0),
    professional_pass_count: z.literal(0),
  }).strict(),
  projects: z.array(Stage6RealInputProjectReadinessSchema).length(15),
}).strict().superRefine((report, context) => {
  if (report.summary.project_count !== report.projects.length
    || report.summary.ready_project_count !== report.projects.filter(project => project.status === 'ready').length
    || report.summary.blocked_project_count !== report.projects.filter(project => project.status === 'blocked').length) {
    context.addIssue({ code: 'custom', path: ['summary'], message: 'readiness summary does not match projects' });
  }
  if (report.projects.some(project => (project.status === 'ready') !== (project.blockers.length === 0))) {
    context.addIssue({ code: 'custom', path: ['projects'], message: 'project readiness status does not match blockers' });
  }
});

const Stage8BlindReviewRoleSchema = z.enum([
  'screenwriter_or_script_editor',
  'genre_or_director_reviewer',
  'fact_or_culture_reviewer',
]);

export const Stage8BlindReviewIntakeProjectSchema = z.object({
  benchmark_id: z.string(),
  video_type: VideoTypeSchema,
  source_entry: z.string(),
  provenance: z.enum([
    'operator_submitted_real_review',
    'preparation_template',
    'fixture',
    'simulation',
    'fallback',
  ]),
  run_id: z.string(),
  final_package: z.object({ path: z.string(), sha256: z.string() }).strict(),
  randomization: z.object({
    batch_id: z.string(),
    candidate_label: z.string(),
    candidate_origin_hidden_from_reviewers: z.boolean(),
  }).strict(),
  baseline: z.object({
    baseline_id: z.string(),
    path: z.string(),
    sha256: z.string(),
    rights: z.enum(['pending', 'public_domain', 'user_owned', 'licensed']),
    average_score: z.number().finite().min(0).max(100),
    rights_verification: Stage6VerificationRecordSchema,
  }).strict(),
  reviewer_assignments: z.array(z.object({
    role: Stage8BlindReviewRoleSchema,
    reviewer_id: z.string(),
    identity_verification: Stage6VerificationRecordSchema,
    independence_verification: Stage6VerificationRecordSchema,
    conflict_of_interest_declared: z.boolean(),
  }).strict()).length(3),
  review_schedule: z.object({
    schedule_reference: z.string(),
    due_at: z.string(),
    timezone: z.string(),
    verification: Stage6VerificationRecordSchema,
  }).strict(),
  human_blind_review_passed: z.literal(false),
  professional_passed: z.literal(false),
}).strict().superRefine((project, context) => {
  const roles = project.reviewer_assignments.map(item => item.role);
  const reviewerIds = project.reviewer_assignments.map(item => item.reviewer_id).filter(Boolean);
  if (new Set(roles).size !== 3) context.addIssue({ code: 'custom', path: ['reviewer_assignments'], message: 'three_unique_roles_required' });
  if (new Set(reviewerIds).size !== reviewerIds.length) context.addIssue({ code: 'custom', path: ['reviewer_assignments'], message: 'reviewer_ids_must_be_unique' });
});

export const Stage8BlindReviewIntakeSchema = z.object({
  schema_version: z.literal('story-agent-stage8-blind-review-intake/v1'),
  submitted_at: z.string(),
  operator: z.object({ operator_id: z.string(), display_name: z.string(), contact_reference: z.string() }).strict(),
  projects: z.array(Stage8BlindReviewIntakeProjectSchema).length(75),
}).strict().superRefine((intake, context) => {
  const benchmarkIds = intake.projects.map(item => item.benchmark_id).filter(Boolean);
  if (new Set(benchmarkIds).size !== benchmarkIds.length) context.addIssue({ code: 'custom', path: ['projects'], message: 'benchmark_ids_must_be_unique' });
});

export const Stage6FeedbackReviewUpdateRequestSchema = z.object({
  schema_version: z.literal('story-agent-stage6-feedback-review-update/v1'),
  action: z.enum(['assign', 'close', 'reopen']),
  expected_state_revision: z.number().int().nonnegative(),
  actor_id: z.string().trim().min(1),
  actor_name: z.string().trim().min(1),
  assigned_reviewer_id: z.string().trim().min(1).optional(),
  resolution_note: z.string().trim().min(1).optional(),
}).strict().superRefine((request, context) => {
  if (request.action === 'assign' && !request.assigned_reviewer_id) {
    context.addIssue({ code: 'custom', path: ['assigned_reviewer_id'], message: 'assign requires assigned_reviewer_id' });
  }
  if (request.action === 'close' && !request.resolution_note) {
    context.addIssue({ code: 'custom', path: ['resolution_note'], message: 'close requires resolution_note' });
  }
});

export const Stage6FeedbackDraftCreateRequestSchema = z.object({
  schema_version: z.literal('story-agent-stage6-feedback-draft-create/v1'),
  round_number: z.union([z.literal(1), z.literal(2)]),
  reviewer_id: z.string().trim().min(1),
  category: z.enum(['structure', 'character_or_information', 'scene', 'dialogue_or_narration', 'pacing', 'fact_and_culture']),
  note: z.string().trim().min(1),
  issue_id: z.string().trim().min(1),
  target_sections: z.array(ProfessionalTextPackageFieldSchema).min(1),
  evidence_required: z.boolean(),
  actor_id: z.string().trim().min(1),
  actor_name: z.string().trim().min(1),
}).strict();

// ---------------------------------------------------------------------------
// Entry detail query (GET query params)
// ---------------------------------------------------------------------------

export const EntryDetailQuerySchema = z.object({
  domain: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/, 'domain must be a lowercase domain identifier').optional(),
  name: z.string().min(1, 'name cannot be empty'),
});

// ---------------------------------------------------------------------------
// Entry search query (GET query params — all optional)
// ---------------------------------------------------------------------------

export const EntrySearchQuerySchema = z.object({
  domain: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/, 'domain must be a lowercase domain identifier').optional(),
  keywords: z.string().optional(),
  type: z.string().optional(),
  province: z.string().optional(),
  region: z.string().optional(),
});

export const DomainPackQuerySchema = z.object({
  domain: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/, 'domain must be a lowercase domain identifier').optional(),
});

// ---------------------------------------------------------------------------
// Entry match request (POST body — smart topic matching)
// ---------------------------------------------------------------------------

export const EntryMatchRequestSchema = z.object({
  domain: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/, 'domain must be a lowercase domain identifier').optional(),
  query: z.string().min(1, 'query cannot be empty'),
  limit: z.number().int().min(1).max(20).optional().default(5),
  preferred_province: z.string().optional(),
  preferred_type: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Story ID param (path param)
// ---------------------------------------------------------------------------

export const StoryIdParamSchema = z.object({
  storyId: z.string().regex(
    /^\d{8}-story-[0-9a-z]+$/,
    'storyId must match format YYYYMMDD-story-{hash36}',
  ),
});

export const StoryIdValueSchema = z.string().regex(
  /^\d{8}-story-[0-9a-z]+$/,
  'storyId must match format YYYYMMDD-story-{hash36}',
);

const ProjectIdValueSchema = z.string().regex(
  /^\d{8}-story-[0-9a-z]+--[a-z_]+$/,
  'projectId must match format YYYYMMDD-story-{hash36}--{video_type}',
);

export const AiComicSeriesProjectIdValueSchema = z.string().regex(
  /^\d{8}-series-[0-9a-z]+$/,
  'seriesProjectId must match format YYYYMMDD-series-{hash36}',
);

export const ProjectIdParamSchema = z.object({
  projectId: ProjectIdValueSchema,
});

export const ProjectExternalEvidenceVerificationParamSchema = ProjectIdParamSchema.extend({
  evidenceId: ProjectExternalEvidenceIdSchema,
});

export const MediaArtifactPreviewParamSchema = z.object({
  projectId: ProjectIdValueSchema,
  artifactId: z.string().regex(/^media-sha256-[a-f0-9]{64}$/, 'artifactId must be a verified SHA-256 media artifact'),
});

export const MediaAssetReviewParamSchema = z.object({
  projectId: ProjectIdValueSchema,
  assetId: z.string().trim().min(1).max(160),
});

export const AiComicSeriesProjectIdParamSchema = z.object({
  seriesProjectId: AiComicSeriesProjectIdValueSchema,
});

export const StoryAgentSeedancePreproductionExportRequestSchema = z.object({
  story_id: StoryIdValueSchema.optional(),
  project_id: ProjectIdValueSchema.optional(),
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
}).strict().superRefine((request, context) => {
  const sourceCount = [
    request.story_id,
    request.project_id,
    request.series_project_id,
  ].filter(Boolean).length;
  if (sourceCount !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'exactly one of story_id, project_id, or series_project_id is required',
    });
  }
});

export const StoryAgentRunIdParamSchema = z.object({
  runId: z.string().regex(
    /^story-agent-run-[a-f0-9]{24}$/,
    'runId must be a stable top-level Story Agent run id',
  ),
});

export const StoryAgentRunStartRequestSchema = z.object({
  project_id: ProjectIdValueSchema.optional(),
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
}).strict().superRefine((request, context) => {
  if ([request.project_id, request.series_project_id].filter(Boolean).length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'exactly one of project_id or series_project_id is required',
    });
  }
});

export const StoryAgentRunGenerateRequestSchema = z.object({
  idempotency_key: z.string().trim().regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/,
    'idempotency_key must be 8-128 stable URL-safe characters',
  ),
  generation_request: StoryGenerateRequestSchema,
}).strict();

export const StoryAgentRunListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().regex(
    /^[A-Za-z0-9_-]{20,512}$/,
    'cursor must be an opaque Story Agent run list cursor',
  ).optional(),
  status: z.enum([
    'in_progress',
    'awaiting_external_action',
    'failed_retryable',
    'ready',
    'blocked',
  ]).optional(),
  kind: z.enum([
    'generation_request',
    'existing_project',
    'existing_series',
  ]).optional(),
  source_kind: z.enum([
    'story_project',
    'ai_comic_series_project',
  ]).optional(),
}).strict();

export const StoryAgentImageRunIdParamSchema = z.object({
  runId: z.string().regex(
    /^image-run-[a-f0-9]{24}$/,
    'runId must be a stable Story Agent image run id',
  ),
});

export const StoryAgentImageRunExportRequestSchema = z.object({
  project_id: ProjectIdValueSchema.optional(),
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
}).strict().superRefine((request, context) => {
  if ([request.project_id, request.series_project_id].filter(Boolean).length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'exactly one of project_id or series_project_id is required',
    });
  }
});

export const StoryAgentImageGenerationResultSchema = z.object({
  schema_version: z.literal('image-generation-result/v1'),
  run_id: z.string().regex(/^image-run-[a-f0-9]{24}$/),
  request_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  completed_at: z.string().datetime(),
  items: z.array(z.object({
    task_id: z.string().trim().min(1).max(180),
    covers_task_ids: z.array(z.string().trim().min(1).max(180)).max(100).optional(),
    status: z.enum(['generated', 'failed_retryable', 'blocked']),
    output_path: z.string().trim().min(1).max(1_024).optional(),
    mime_type: z.string().trim().min(1).max(120).optional(),
    content_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    prompt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    provider: z.string().trim().min(1).max(120).optional(),
    provider_asset_id: z.string().trim().min(1).max(240).optional(),
    model: z.string().trim().min(1).max(120).optional(),
    failure_reason: z.string().trim().min(1).max(2_000).optional(),
    retryable: z.boolean().optional(),
  }).superRefine((item, context) => {
    if (item.status === 'generated') {
      for (const field of ['output_path', 'mime_type', 'content_sha256', 'provider', 'model'] as const) {
        if (!item[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for generated image results`,
          });
        }
      }
    } else if (!item.failure_reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failure_reason'],
        message: 'failure_reason is required for failed or blocked image results',
      });
    }
  })).min(1).max(500),
}).strict();

export const AiComicSeriesVisualIdentityDefinitionParamSchema = z.object({
  seriesProjectId: AiComicSeriesProjectIdValueSchema,
  visualIdentityId: z.string().regex(
    /^series-(character|costume|location|prop)-[a-f0-9]{12}$/,
    'visualIdentityId must be a stable series visual identity id',
  ),
});

export const AiComicSeriesVisualWorldRuleDefinitionParamSchema = z.object({
  seriesProjectId: AiComicSeriesProjectIdValueSchema,
  worldRuleId: z.string().regex(
    /^[a-z][a-z0-9_-]{1,119}$/,
    'worldRuleId must be a stable premise world rule id',
  ),
});

export const AiComicSeriesMediaArtifactPreviewParamSchema = z.object({
  seriesProjectId: AiComicSeriesProjectIdValueSchema,
  artifactId: z.string().regex(/^media-sha256-[a-f0-9]{64}$/, 'artifactId must be a verified SHA-256 media artifact'),
});

export const AiComicSeriesMediaAssetReviewParamSchema = z.object({
  seriesProjectId: AiComicSeriesProjectIdValueSchema,
  assetId: z.string().trim().min(1).max(160),
});

export const ProjectBatchDeleteRequestSchema = z.object({
  project_ids: z.array(ProjectIdValueSchema).min(1, 'project_ids cannot be empty').max(200, 'cannot delete more than 200 projects at once'),
});

export const ProjectRetainRecentRequestSchema = z.object({
  keep_recent: z.number().int().min(0).max(1000),
});

const SeedanceAssetReferenceKindSchema = z.enum(['character', 'location', 'prop', 'camera', 'audio']);
const SeedanceAssetModalitySchema = z.enum(['image', 'video', 'audio']);
const SeedanceAssetUploadStatusSchema = z.enum(['pending_upload', 'uploaded', 'failed', 'external']);
const SeedanceAssetSlotRoleSchema = z.enum([
  'character_reference',
  'location_reference',
  'prop_reference',
  'camera_reference',
  'music_reference',
  'sound_reference',
]);

export const SeedanceAssetLibraryUpdateRequestSchema = z.object({
  items: z.array(z.object({
    asset_id: z.string().trim().min(1).max(160).optional(),
    label: z.string().trim().min(1).max(120),
    kind: SeedanceAssetReferenceKindSchema,
    modality: SeedanceAssetModalitySchema.optional(),
    role: SeedanceAssetSlotRoleSchema.optional(),
    reference_slot: z.string().trim().min(1).max(40).optional(),
    file_url: z.string().trim().min(1).max(1000).optional(),
    file_id: z.string().trim().min(1).max(160).optional(),
    local_path: z.string().trim().min(1).max(1000).optional(),
    original_filename: z.string().trim().min(1).max(255).optional(),
    mime_type: z.string().trim().min(1).max(120).optional(),
    size_bytes: z.number().int().min(0).max(200 * 1024 * 1024).optional(),
    provider: z.string().trim().min(1).max(80).optional(),
    provider_asset_id: z.string().trim().min(1).max(200).optional(),
    upload_status: SeedanceAssetUploadStatusSchema.optional(),
    upload_error: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(500).optional(),
  })).min(1).max(200),
});

const SeedanceAssetBatchImportItemSchema = z.object({
  asset_id: z.string().trim().min(1).max(160).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  kind: SeedanceAssetReferenceKindSchema.optional(),
  modality: SeedanceAssetModalitySchema.optional(),
  role: SeedanceAssetSlotRoleSchema.optional(),
  reference_slot: z.string().trim().min(1).max(40).optional(),
  file_url: z.string().trim().min(1).max(1000).optional(),
  file_id: z.string().trim().min(1).max(160).optional(),
  local_path: z.string().trim().min(1).max(1000).optional(),
  original_filename: z.string().trim().min(1).max(255).optional(),
  mime_type: z.string().trim().min(1).max(120).optional(),
  size_bytes: z.number().int().min(0).max(200 * 1024 * 1024).optional(),
  provider: z.string().trim().min(1).max(80).optional(),
  provider_asset_id: z.string().trim().min(1).max(200).optional(),
  upload_status: SeedanceAssetUploadStatusSchema.optional(),
  upload_error: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(500).optional(),
}).refine(
  item => Boolean(item.asset_id || (item.label && item.kind)),
  'asset_id or label+kind is required',
).refine(
  item => Boolean(item.file_url || item.file_id || item.local_path || item.provider_asset_id || item.upload_status),
  'file_url, file_id, local_path, provider_asset_id or upload_status is required',
);

export const SeedanceAssetBatchImportRequestSchema = z.object({
  source_note: z.string().trim().min(1).max(500).optional(),
  items: z.array(SeedanceAssetBatchImportItemSchema).min(1).max(500),
});

export const SeedanceAssetReuseRequestSchema = z.object({
  source_project_id: ProjectIdValueSchema,
  source_asset_id: z.string().trim().min(1).max(160),
  target_asset_id: z.string().trim().min(1).max(160).optional(),
  target_label: z.string().trim().min(1).max(120).optional(),
  target_kind: SeedanceAssetReferenceKindSchema.optional(),
  reference_slot: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(500).optional(),
});

export const MediaAssetReviewUpdateRequestSchema = z.object({
  asset_id: z.string().trim().min(1).max(160),
  expected_content_sha256: z.string().trim().regex(/^[a-f0-9]{64}$/i).optional(),
  rights_status: z.enum(['pending', 'authorized', 'restricted']).optional(),
  authorization_reference: z.string().trim().min(1).max(500).optional(),
  person_consent_reference: z.string().trim().min(1).max(500).optional(),
  human_review_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  review_note: z.string().trim().min(1).max(1000).optional(),
}).superRefine((value, context) => {
  if (!value.rights_status && !value.human_review_status) {
    context.addIssue({
      code: 'custom',
      path: ['rights_status'],
      message: 'rights_status or human_review_status is required',
    });
  }
  if (value.rights_status === 'authorized' && !value.authorization_reference) {
    context.addIssue({
      code: 'custom',
      path: ['authorization_reference'],
      message: 'authorization_reference is required when rights_status is authorized',
    });
  }
  if (value.human_review_status && value.human_review_status !== 'pending') {
    if (!value.expected_content_sha256) {
      context.addIssue({
        code: 'custom',
        path: ['expected_content_sha256'],
        message: 'expected_content_sha256 is required for a human visual review decision',
      });
    }
    if (!value.review_note) {
      context.addIssue({
        code: 'custom',
        path: ['review_note'],
        message: 'review_note is required for a human visual review decision',
      });
    }
  }
});

const GearsExecutionJobTypeSchema = z.enum([
  'storyboard_image',
  'character_image',
  'scene_image',
  'prop_image',
  'seedance_video',
  'subtitle_render',
  'audio_mix',
  'title_card_render',
  'final_assemble',
]);

const GearsExecutionFailureCategorySchema = z.enum([
  'asset_missing',
  'artifact_invalid',
  'artifact_upload_failed',
  'callback_delivery_failed',
  'output_missing',
  'payload_invalid',
  'content_policy',
  'provider_timeout',
  'provider_quota',
  'provider_auth',
  'provider_rate_limit',
  'provider_server_error',
  'render_failed',
  'worker_unavailable',
  'network_error',
  'unknown',
]);

const GearsExecutionCodeValueSchema = z.union([
  z.string().trim().min(1).max(120),
  z.number().int(),
]);

const GearsExecutionProgressValueSchema = z.union([
  z.number(),
  z.string().trim().min(1).max(40),
]);

const GearsExecutionCostValueSchema = z.union([
  z.number().finite().nonnegative().max(1_000_000),
  z.string().trim().regex(/^\d+(?:\.\d+)?$/).max(40),
]);

const GearsExecutionTimestampValueSchema = z.union([
  z.string().trim().min(1).max(80),
  z.number().finite(),
]);

const GearsExecutionArtifactSchema = z.object({
  artifact_id: z.string().trim().min(1).max(160).optional(),
  kind: z.string().trim().min(1).max(80).optional(),
  url: z.string().trim().url(),
  role: z.string().trim().min(1).max(80).optional(),
  mime_type: z.string().trim().min(1).max(120).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ExternalProviderCallAuthorizationRequestSchema = z.object({
  authorized: z.literal(true),
  authorization_reference: z.string().trim().min(1).max(500),
  max_cost_amount: z.number().finite().nonnegative().max(1_000_000),
  cost_currency: z.string().trim().regex(/^[A-Z]{3}$/, 'cost_currency must be a 3-letter uppercase currency code'),
  data_transfer_acknowledged: z.literal(true),
}).strict();

export const GearsJobSubmitRequestSchema = z.object({
  job_type: GearsExecutionJobTypeSchema.optional().default('seedance_video'),
  source_unit_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(200).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  use_gears_api: z.boolean().optional().default(false),
  external_call_authorization: ExternalProviderCallAuthorizationRequestSchema.optional(),
  overwrite_existing: z.boolean().optional().default(false),
  payload: z.record(z.string(), z.unknown()).optional(),
  callback_url: z.string().trim().url().optional(),
  note: z.string().trim().min(1).max(500).optional(),
}).superRefine((value, context) => {
  if (value.use_gears_api && !value.external_call_authorization) {
    context.addIssue({
      code: 'custom',
      path: ['external_call_authorization'],
      message: 'external_call_authorization is required when use_gears_api=true',
    });
  }
});

export const GearsWorkbenchProjectImportRequestSchema = z.object({
  idempotency_key: z.string().trim().min(8).max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/)
    .optional(),
  expected_source_version_id: z.string().trim().min(1).max(200).optional(),
  expected_payload_sha256: z.string().trim().regex(/^[a-f0-9]{64}$/).optional(),
  mapping: z.object({
    character_style_pack_id: z.string().trim().min(1).max(100),
    scene_style_pack_id: z.string().trim().min(1).max(100),
    staging_pack_id: z.string().trim().min(1).max(100),
    visual_pack_id: z.string().trim().min(1).max(100),
  }).strict(),
}).strict();

export const GearsJobStatusSyncRequestSchema = z.object({
  job_type: GearsExecutionJobTypeSchema.optional(),
  source_unit_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(200).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  include_completed: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(50),
  note: z.string().trim().min(1).max(500).optional(),
});

export const GearsJobLocalAcceptanceRequestSchema = z.object({
  job_type: GearsExecutionJobTypeSchema.optional(),
  source_unit_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(200).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  include_completed: z.boolean().optional().default(false),
  include_external_jobs: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(50),
  artifact_base_url: z.string().trim().url().optional(),
  artifact_url_map: z.record(z.string(), z.string().trim().url()).optional(),
  artifact_kind: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const GearsExecutionLiveSmokeRunRequestSchema = z.object({
  execute: z.boolean().optional().default(false),
  poll_after_submit: z.boolean().optional().default(false),
  external_call_authorization: ExternalProviderCallAuthorizationRequestSchema.optional(),
  note: z.string().trim().min(1).max(500).optional(),
}).strict().superRefine((value, context) => {
  if (value.execute && !value.external_call_authorization) {
    context.addIssue({
      code: 'custom',
      path: ['external_call_authorization'],
      message: 'external_call_authorization is required when execute=true',
    });
  }
});

function isGearsCallbackObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const GEARS_CALLBACK_BATCH_ARRAY_KEYS = [
  'callbacks',
  'events',
  'jobs',
  'tasks',
  'items',
  'results',
];
const GEARS_CALLBACK_BATCH_CONTAINER_KEYS = [
  'data',
  'result',
  'response',
  'payload',
  'job',
  'task',
  'item',
  'record',
];

function countGearsCallbackBatchItems(value: unknown, depth = 0): number {
  if (depth > 5 || !isGearsCallbackObject(value)) return 0;
  let count = 0;
  for (const key of GEARS_CALLBACK_BATCH_ARRAY_KEYS) {
    const arrayValue = value[key];
    if (Array.isArray(arrayValue)) count += arrayValue.length;
  }
  for (const key of GEARS_CALLBACK_BATCH_CONTAINER_KEYS) {
    count += countGearsCallbackBatchItems(value[key], depth + 1);
  }
  return count;
}

function hasGearsCallbackIdentifier(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (Array.isArray(value)) {
    return value.some(item => hasGearsCallbackIdentifier(item, depth + 1));
  }
  if (!isGearsCallbackObject(value)) return false;
  if (
    value.gears_job_id
    || value.gearsJobId
    || value.job_id
    || value.jobId
    || value.task_id
    || value.taskId
    || value.id
    || value.source_unit_id
    || value.sourceUnitId
    || value.external_id
    || value.externalId
    || value.custom_id
    || value.customId
    || value.shot_id
    || value.shotId
    || value.production_id
    || value.productionId
    || value.idempotency_key
    || value.idempotencyKey
  ) {
    return true;
  }
  return [
    'data',
    'result',
    'response',
    'payload',
    'job',
    'task',
    'item',
    'record',
    'callbacks',
    'events',
    'jobs',
    'tasks',
    'items',
    'results',
  ].some(key => hasGearsCallbackIdentifier(value[key], depth + 1));
}

export const GearsJobCallbackRequestSchema = z.object({
  gears_job_id: z.string().trim().min(1).max(160).optional(),
  gearsJobId: z.string().trim().min(1).max(160).optional(),
  job_id: z.string().trim().min(1).max(160).optional(),
  jobId: z.string().trim().min(1).max(160).optional(),
  task_id: z.string().trim().min(1).max(160).optional(),
  taskId: z.string().trim().min(1).max(160).optional(),
  id: z.string().trim().min(1).max(160).optional(),
  job_type: GearsExecutionJobTypeSchema.optional(),
  jobType: GearsExecutionJobTypeSchema.optional(),
  source_project_id: z.string().trim().min(1).max(180).optional(),
  sourceProjectId: z.string().trim().min(1).max(180).optional(),
  source_story_id: z.string().trim().min(1).max(120).optional(),
  sourceStoryId: z.string().trim().min(1).max(120).optional(),
  series_project_id: z.string().trim().min(1).max(180).optional(),
  seriesProjectId: z.string().trim().min(1).max(180).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  sourceUnitId: z.string().trim().min(1).max(160).optional(),
  external_id: z.string().trim().min(1).max(160).optional(),
  externalId: z.string().trim().min(1).max(160).optional(),
  custom_id: z.string().trim().min(1).max(160).optional(),
  customId: z.string().trim().min(1).max(160).optional(),
  shot_id: z.string().trim().min(1).max(120).optional(),
  shotId: z.string().trim().min(1).max(120).optional(),
  production_id: z.string().trim().min(1).max(160).optional(),
  productionId: z.string().trim().min(1).max(160).optional(),
  status: z.string().trim().min(1).max(80).optional(),
  task_status: z.string().trim().min(1).max(80).optional(),
  taskStatus: z.string().trim().min(1).max(80).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  phase: z.string().trim().min(1).max(80).optional(),
  progress: GearsExecutionProgressValueSchema.optional(),
  progress_percent: GearsExecutionProgressValueSchema.optional(),
  progressPercent: GearsExecutionProgressValueSchema.optional(),
  percent: GearsExecutionProgressValueSchema.optional(),
  percentage: GearsExecutionProgressValueSchema.optional(),
  progress_ratio: GearsExecutionProgressValueSchema.optional(),
  progressRatio: GearsExecutionProgressValueSchema.optional(),
  actual_cost_amount: GearsExecutionCostValueSchema.optional(),
  actualCostAmount: GearsExecutionCostValueSchema.optional(),
  cost_amount: GearsExecutionCostValueSchema.optional(),
  costAmount: GearsExecutionCostValueSchema.optional(),
  cost_currency: z.string().trim().min(3).max(12).optional(),
  costCurrency: z.string().trim().min(3).max(12).optional(),
  currency: z.string().trim().min(3).max(12).optional(),
  provider_event_at: GearsExecutionTimestampValueSchema.optional(),
  providerEventAt: GearsExecutionTimestampValueSchema.optional(),
  event_time: GearsExecutionTimestampValueSchema.optional(),
  eventTime: GearsExecutionTimestampValueSchema.optional(),
  event_at: GearsExecutionTimestampValueSchema.optional(),
  eventAt: GearsExecutionTimestampValueSchema.optional(),
  timestamp: GearsExecutionTimestampValueSchema.optional(),
  created_at: GearsExecutionTimestampValueSchema.optional(),
  createdAt: GearsExecutionTimestampValueSchema.optional(),
  updated_at: GearsExecutionTimestampValueSchema.optional(),
  updatedAt: GearsExecutionTimestampValueSchema.optional(),
  completed_at: GearsExecutionTimestampValueSchema.optional(),
  completedAt: GearsExecutionTimestampValueSchema.optional(),
  finished_at: GearsExecutionTimestampValueSchema.optional(),
  finishedAt: GearsExecutionTimestampValueSchema.optional(),
  artifacts: z.array(GearsExecutionArtifactSchema).max(200).optional(),
  artifact_urls: z.array(z.string().trim().url()).max(200).optional(),
  artifactUrls: z.array(z.string().trim().url()).max(200).optional(),
  artifact_url: z.string().trim().url().optional(),
  artifactUrl: z.string().trim().url().optional(),
  video_url: z.string().trim().url().optional(),
  videoUrl: z.string().trim().url().optional(),
  output_url: z.string().trim().url().optional(),
  outputUrl: z.string().trim().url().optional(),
  file_url: z.string().trim().url().optional(),
  fileUrl: z.string().trim().url().optional(),
  manifest_url: z.string().trim().url().optional(),
  manifestUrl: z.string().trim().url().optional(),
  subtitle_url: z.string().trim().url().optional(),
  subtitleUrl: z.string().trim().url().optional(),
  srt_url: z.string().trim().url().optional(),
  srtUrl: z.string().trim().url().optional(),
  vtt_url: z.string().trim().url().optional(),
  vttUrl: z.string().trim().url().optional(),
  audio_url: z.string().trim().url().optional(),
  audioUrl: z.string().trim().url().optional(),
  image_url: z.string().trim().url().optional(),
  imageUrl: z.string().trim().url().optional(),
  thumbnail_url: z.string().trim().url().optional(),
  thumbnailUrl: z.string().trim().url().optional(),
  poster_url: z.string().trim().url().optional(),
  posterUrl: z.string().trim().url().optional(),
  url: z.string().trim().url().optional(),
  failure_category: GearsExecutionFailureCategorySchema.optional(),
  failureCategory: GearsExecutionFailureCategorySchema.optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
  error_code: GearsExecutionCodeValueSchema.optional(),
  errorCode: GearsExecutionCodeValueSchema.optional(),
  provider_error_code: GearsExecutionCodeValueSchema.optional(),
  providerErrorCode: GearsExecutionCodeValueSchema.optional(),
  code: GearsExecutionCodeValueSchema.optional(),
  error: z.string().trim().min(1).max(500).optional(),
  message: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  event_id: z.string().trim().min(1).max(160).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  callback_id: z.string().trim().min(1).max(160).optional(),
  callbackId: z.string().trim().min(1).max(160).optional(),
  idempotency_key: z.string().trim().min(1).max(160).optional(),
  idempotencyKey: z.string().trim().min(1).max(160).optional(),
  quality_score: z.number().min(0).max(100).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
  reviewNote: z.string().trim().min(1).max(500).optional(),
  data: z.unknown().optional(),
  result: z.unknown().optional(),
  response: z.unknown().optional(),
  job: z.unknown().optional(),
  task: z.unknown().optional(),
  item: z.unknown().optional(),
  record: z.unknown().optional(),
  callbacks: z.unknown().optional(),
  events: z.unknown().optional(),
  jobs: z.unknown().optional(),
  tasks: z.unknown().optional(),
  items: z.unknown().optional(),
  results: z.unknown().optional(),
  output: z.unknown().optional(),
  outputs: z.unknown().optional(),
  files: z.unknown().optional(),
  media: z.unknown().optional(),
  assets: z.unknown().optional(),
  payload: z.unknown().optional(),
}).refine(
  data => hasGearsCallbackIdentifier(data),
  { message: 'GEARS callback requires gears_job_id/job_id, source_unit_id/external_id/shot_id, or idempotency_key' },
).refine(
  data => countGearsCallbackBatchItems(data) <= GEARS_CALLBACK_BATCH_ITEM_LIMIT,
  { message: `GEARS callback batch item count must be <= ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}` },
);

const SeedanceShotProductionStatusSchema = z.enum([
  'not_started',
  'prompt_exported',
  'submitted',
  'processing',
  'ready',
  'failed',
  'skipped',
]);

const SeedanceShotProviderQueuePrioritySchema = z.enum(['low', 'normal', 'high']);
const SeedanceShotProviderRecoverableStatusSchema = z.enum(['submitted', 'processing']);
const SeedanceProviderFailureCategorySchema = z.enum([
  'asset_missing',
  'prompt_invalid',
  'content_policy',
  'provider_timeout',
  'provider_quota',
  'provider_auth',
  'provider_rate_limit',
  'provider_server_error',
  'network_error',
  'unknown',
]);
const SeedanceProviderCodeValueSchema = z.union([
  z.string().trim().min(1).max(120),
  z.number().int(),
]);

export const SeedanceShotStatusUpdateRequestSchema = z.object({
  shot_id: z.string().trim().min(1).max(80),
  status: SeedanceShotProductionStatusSchema,
  provider: z.string().trim().min(1).max(80).optional(),
  provider_job_id: z.string().trim().min(1).max(120).optional(),
  provider_queue_id: z.string().trim().min(1).max(120).optional(),
  provider_queue_position: z.number().int().min(1).max(10000).optional(),
  video_url: z.string().trim().url().optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  failure_category: SeedanceProviderFailureCategorySchema.optional(),
  provider_error_code: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  increment_retry: z.boolean().optional(),
  quality_score: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotStatusBatchUpdateRequestSchema = z.object({
  updates: z.array(SeedanceShotStatusUpdateRequestSchema).min(1).max(200),
});

export const SeedanceShotVersionSelectRequestSchema = z.object({
  shot_id: z.string().trim().min(1).max(80),
  version_id: z.string().trim().min(1).max(120),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotAutoSelectRequestSchema = z.object({
  min_quality_score: z.number().min(0).max(100).optional(),
  overwrite_manual: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotProviderSubmitRequestSchema = z.object({
  shot_ids: z.array(z.string().trim().min(1).max(80)).min(1).max(200).optional(),
  provider: z.string().trim().min(1).max(80).optional(),
  job_prefix: z.string().trim().min(1).max(80).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  queue_priority: SeedanceShotProviderQueuePrioritySchema.optional().default('normal'),
  use_provider_adapter: z.boolean().optional().default(false),
  overwrite_existing: z.boolean().optional().default(false),
  increment_retry: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotProviderRecoveryRequestSchema = z.object({
  timeout_minutes: z.number().int().min(1).max(10080).optional().default(120),
  statuses: z.array(SeedanceShotProviderRecoverableStatusSchema).min(1).max(2).optional(),
  mark_timed_out_failed: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotCallbackRequestSchema = z.object({
  shot_id: z.string().trim().min(1).max(80).optional(),
  shotId: z.string().trim().min(1).max(80).optional(),
  external_id: z.string().trim().min(1).max(80).optional(),
  externalId: z.string().trim().min(1).max(80).optional(),
  custom_id: z.string().trim().min(1).max(80).optional(),
  customId: z.string().trim().min(1).max(80).optional(),
  provider: z.string().trim().min(1).max(80).optional(),
  provider_job_id: z.string().trim().min(1).max(120).optional(),
  providerJobId: z.string().trim().min(1).max(120).optional(),
  job_id: z.string().trim().min(1).max(120).optional(),
  jobId: z.string().trim().min(1).max(120).optional(),
  task_id: z.string().trim().min(1).max(120).optional(),
  taskId: z.string().trim().min(1).max(120).optional(),
  request_id: z.string().trim().min(1).max(120).optional(),
  requestId: z.string().trim().min(1).max(120).optional(),
  id: z.string().trim().min(1).max(120).optional(),
  provider_queue_id: z.string().trim().min(1).max(120).optional(),
  providerQueueId: z.string().trim().min(1).max(120).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  queueId: z.string().trim().min(1).max(120).optional(),
  batch_id: z.string().trim().min(1).max(120).optional(),
  batchId: z.string().trim().min(1).max(120).optional(),
  provider_queue_position: z.number().int().min(1).max(10000).optional(),
  providerQueuePosition: z.number().int().min(1).max(10000).optional(),
  queue_position: z.number().int().min(1).max(10000).optional(),
  queuePosition: z.number().int().min(1).max(10000).optional(),
  position: z.number().int().min(1).max(10000).optional(),
  status: z.string().trim().min(1).max(80).optional(),
  task_status: z.string().trim().min(1).max(80).optional(),
  taskStatus: z.string().trim().min(1).max(80).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  phase: z.string().trim().min(1).max(80).optional(),
  video_url: z.string().trim().url().optional(),
  videoUrl: z.string().trim().url().optional(),
  output_url: z.string().trim().url().optional(),
  outputUrl: z.string().trim().url().optional(),
  file_url: z.string().trim().url().optional(),
  fileUrl: z.string().trim().url().optional(),
  download_url: z.string().trim().url().optional(),
  downloadUrl: z.string().trim().url().optional(),
  result_url: z.string().trim().url().optional(),
  resultUrl: z.string().trim().url().optional(),
  url: z.string().trim().url().optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
  error_message: z.string().trim().min(1).max(500).optional(),
  errorMessage: z.string().trim().min(1).max(500).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  failure_category: SeedanceProviderFailureCategorySchema.optional(),
  failureCategory: SeedanceProviderFailureCategorySchema.optional(),
  provider_error_code: SeedanceProviderCodeValueSchema.optional(),
  providerErrorCode: SeedanceProviderCodeValueSchema.optional(),
  error_code: SeedanceProviderCodeValueSchema.optional(),
  errorCode: SeedanceProviderCodeValueSchema.optional(),
  status_code: SeedanceProviderCodeValueSchema.optional(),
  statusCode: SeedanceProviderCodeValueSchema.optional(),
  code: SeedanceProviderCodeValueSchema.optional(),
  error: z.string().trim().min(1).max(500).optional(),
  message: z.string().trim().min(1).max(500).optional(),
  msg: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  increment_retry: z.boolean().optional(),
  incrementRetry: z.boolean().optional(),
  quality_score: z.number().min(0).max(100).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  score: z.number().min(0).max(100).optional(),
  quality: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
  reviewNote: z.string().trim().min(1).max(500).optional(),
}).refine(
  data => Boolean(
    data.shot_id
    || data.shotId
    || data.external_id
    || data.externalId
    || data.custom_id
    || data.customId
    || data.provider_job_id
    || data.providerJobId
    || data.job_id
    || data.jobId
    || data.task_id
    || data.taskId
    || data.request_id
    || data.requestId
    || data.id
    || data.provider_queue_id
    || data.providerQueueId
    || data.queue_id
    || data.queueId
    || data.batch_id
    || data.batchId
  ),
  { message: 'callback requires shot_id, provider_job_id/job_id, or provider_queue_id/queue_id' },
);

export const SeedanceShotCallbackImportRequestSchema = z.object({
  callbacks: z.array(SeedanceShotCallbackRequestSchema).min(1).max(200),
});

export const SeedanceShotProviderCallbackRequestSchema = SeedanceShotCallbackRequestSchema.and(z.object({
  event_id: z.string().trim().min(1).max(160).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  callback_id: z.string().trim().min(1).max(160).optional(),
  callbackId: z.string().trim().min(1).max(160).optional(),
  payload: z.unknown().optional(),
}));

export const SeedanceShotProviderPollRequestSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  shot_ids: z.array(z.string().trim().min(1).max(80)).min(1).max(200).optional(),
  statuses: z.array(SeedanceShotProviderRecoverableStatusSchema).min(1).max(2).optional(),
  limit: z.number().int().min(1).max(200).optional().default(100),
  include_prompt: z.boolean().optional().default(false),
  use_provider_adapter: z.boolean().optional().default(false),
  provider_results: z.array(SeedanceShotProviderCallbackRequestSchema).min(1).max(200).optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotProviderQueueOverviewRequestSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  timeout_minutes: z.number().int().min(1).max(10080).optional().default(120),
  include_completed: z.boolean().optional().default(false),
});

export const SeedanceShotProviderRetryPlanRequestSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  timeout_minutes: z.number().int().min(1).max(10080).optional().default(120),
  max_retry_count: z.number().int().min(0).max(20).optional(),
  include_unsubmitted: z.boolean().optional().default(false),
  failure_categories: z.array(SeedanceProviderFailureCategorySchema).min(1).max(10).optional(),
});

export const SeedanceShotProviderRetrySubmitRequestSchema = SeedanceShotProviderRetryPlanRequestSchema.extend({
  target_queue_id: z.string().trim().min(1).max(120).optional(),
  queue_priority: SeedanceShotProviderQueuePrioritySchema.optional().default('normal'),
  job_prefix: z.string().trim().min(1).max(80).optional(),
  use_provider_adapter: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const StorySceneRegenerateRequestSchema = z.object({
  scene_id: z.number().int().min(1),
  intent: z.enum([
    'tighten_conflict',
    'rewrite_narration',
    'shift_emotion',
    'clarify_visuals',
    'custom',
  ]),
  user_note: z.string().trim().max(300).optional(),
  model_profile_id: z.string().optional(),
});

export const StoryQualityRepairRequestSchema = z.object({
  model_profile_id: z.string().optional(),
  genre_strictness: GenreStrictnessSchema.optional().default('balanced'),
  target_report: z.enum(['family', 'outline', 'pattern', 'gears', 'production_material', 'audience', 'combined']).optional(),
  repair_action_id: z.string().trim().min(1).max(80).optional(),
});

export const StoryQualityRepairPromptRequestSchema = StoryQualityRepairRequestSchema.extend({
  user_instruction: z.string().trim().max(800).optional(),
  include_story_json: z.boolean().optional().default(false),
  include_markdown: z.boolean().optional().default(true),
  max_actions: z.number().int().min(1).max(50).optional().default(12),
});

export const StoryQualityRepairApplyRequestSchema = z.object({
  repaired_story_json: z.string().trim().min(2).max(2_000_000),
  user_instruction: z.string().trim().max(800).optional(),
  apply: z.boolean().optional().default(false),
  allow_no_improvement: z.boolean().optional().default(false),
});

export const StoryProductionBoardRepairRequestSchema = z.object({
  task_ids: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  actions: z.array(z.enum([
    'normalize_period_costumes',
    'register_asset',
    'clean_prompt',
    'strengthen_filmability',
    'add_continuity',
    'split_duration',
  ])).max(6).optional(),
  categories: z.array(z.enum([
    'asset',
    'prompt',
    'filmability',
    'continuity',
    'period',
    'duration',
  ])).max(6).optional(),
  shot_ids: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  scene_ids: z.array(z.number().int().min(1)).max(50).optional(),
  priorities: z.array(z.enum(['P0', 'P1', 'P2'])).max(3).optional(),
  apply_all: z.boolean().optional().default(false),
});

export const ProductionReadinessAutomationRunRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  max_steps: z.number().int().min(1).max(12).optional().default(6),
  action_keys: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  stop_on_error: z.boolean().optional().default(true),
});

export const ProductionReadinessPortfolioRunRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  include_archived_series: z.boolean().optional().default(false),
  max_targets: z.number().int().min(1).max(20).optional().default(5),
  per_target_max_steps: z.number().int().min(1).max(12).optional().default(4),
  min_priority_score: z.number().int().min(0).max(300).optional(),
  scopes: z.array(z.enum(['story_project', 'ai_comic_series'])).max(2).optional(),
  project_ids: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  action_keys: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  stop_on_error: z.boolean().optional().default(true),
});

export const StoryAgentGeneratedGovernanceActionKeySchema = z.enum([
  'review_final_delivery_manifest_gaps',
  'restore_or_relink_series_story_refs',
  'archive_or_rebuild_series_fixtures',
  'generate_first_series_episode',
  'repair_series_command_contracts',
  'repair_story_project_refs',
  'promote_ready_targets_for_gears_signoff',
]);

export const StoryAgentGeneratedGovernanceRunRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  action_keys: z.array(StoryAgentGeneratedGovernanceActionKeySchema).max(7).optional(),
  project_ids: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  max_targets: z.number().int().min(1).max(100).optional().default(20),
});

export const StoryAgentFinalDeliveryManifestPreflightRequestSchema = z.object({
  series_project_id: z.string().trim().min(1).max(160),
  disposition: z.enum([
    'preserve_fixture_exclude_from_publishable_delivery',
    'reexport_after_authorized_dependencies',
  ]),
  authorized_media_inputs_attested: z.boolean().optional().default(false),
}).strict();

const StoryAgentFinalDeliveryManifestDispositionSchema = z.enum([
  'preserve_fixture_exclude_from_publishable_delivery',
  'reexport_after_authorized_dependencies',
]);

export const StoryAgentFinalDeliveryManifestDispositionSubmitRequestSchema = z.object({
  series_project_id: z.string().trim().min(1).max(160)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  disposition: StoryAgentFinalDeliveryManifestDispositionSchema,
  authorized_media_inputs_attested: z.boolean().optional().default(false),
  operator: z.object({
    operator_id: z.string().trim().min(3).max(128)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/),
    display_name: z.string().trim().min(1).max(120),
    identity_reference: z.string().trim().min(3).max(256),
  }).strict(),
  decision: z.object({
    rationale: z.string().trim().min(10).max(4000),
    evidence_references: z.array(z.string().trim().min(1).max(256))
      .min(1)
      .max(50)
      .refine(uniqueReferenceIds, 'evidence_references must be unique'),
  }).strict(),
  attestation: z.object({
    human_operator: z.literal(true),
    reviewed_current_preflight: z.literal(true),
    accepts_no_publishable_delivery_credit: z.literal(true),
  }).strict(),
  idempotency_key: z.string().trim().min(8).max(128)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
}).strict();

export const StoryAgentFinalDeliveryManifestDispositionLedgerQuerySchema = z.object({
  series_project_id: z.string().trim().min(1).max(160)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    .optional(),
  operator_id: z.string().trim().min(3).max(128)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/)
    .optional(),
  disposition: StoryAgentFinalDeliveryManifestDispositionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const GearsDeliveryUpdateRequestSchema = z.object({
  markdown: z.string().min(1, 'markdown cannot be empty').max(120000, 'markdown is too long'),
});

const GearsVideoCallbackStatusSchema = z.enum([
  'processing',
  'ready',
  'failed',
  'queued',
  'running',
  'completed',
  'success',
  'done',
  'error',
]).transform((status) => {
  if (status === 'queued' || status === 'running') return 'processing';
  if (status === 'completed' || status === 'success' || status === 'done') return 'ready';
  if (status === 'error') return 'failed';
  return status;
});

function normalizeGearsVideoCallbackInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const raw = input as Record<string, unknown>;
  return {
    ...raw,
    storyId: raw.storyId ?? raw.story_id,
    video_url: raw.video_url ?? raw.videoUrl,
    status: typeof raw.status === 'string' ? raw.status.toLowerCase() : raw.status,
    thumbnail_url: raw.thumbnail_url ?? raw.thumbnailUrl,
  };
}

export const GearsVideoReadyCallbackRequestSchema = z.preprocess(
  normalizeGearsVideoCallbackInput,
  z.object({
    storyId: StoryIdValueSchema,
    video_url: z.string().url('video_url must be a valid URL').optional(),
    status: GearsVideoCallbackStatusSchema.default('ready'),
    thumbnail_url: z.string().url('thumbnail_url must be a valid URL').optional(),
  }),
).superRefine((data, ctx) => {
  if (data.status === 'ready' && !data.video_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['video_url'],
      message: 'video_url is required when status is ready',
    });
  }
});

export const SupplementTaskIdParamSchema = ProjectIdParamSchema.extend({
  taskId: z.string().min(1, 'taskId cannot be empty'),
});

export const KnowledgeSupplementTaskUpdateRequestSchema = z.object({
  status: z.enum(['open', 'resolved']),
  supplement_note: z.string().trim().max(4000, 'supplement_note is too long').optional(),
  supplement_field_values: z.record(
    z.string().trim().min(1).max(120),
    z.string().trim().max(2000),
  ).optional(),
  knowledge_candidate_review_status: z.enum(['pending_review', 'approved', 'rejected']).optional(),
  knowledge_candidate_review_note: z.string().trim().max(2000, 'knowledge_candidate_review_note is too long').optional(),
  knowledge_writeback_status: z.enum(['draft_ready', 'queued', 'written_back', 'needs_revision']).optional(),
  knowledge_writeback_note: z.string().trim().max(2000, 'knowledge_writeback_note is too long').optional(),
});

export const DomainPackExpansionReviewStateUpdateRequestSchema = z.object({
  review_item_id: z.string().trim().min(1, 'review_item_id is required').max(240),
  review_status: z.enum(['candidate_review', 'approved', 'rejected', 'needs_revision']),
  review_note: z.string().trim().max(4000, 'review_note is too long').optional(),
  reviewer_id: z.string().trim().max(120, 'reviewer_id is too long').optional(),
  reviewer_name: z.string().trim().max(120, 'reviewer_name is too long').optional(),
  reviewed_by: z.string().trim().max(120, 'reviewed_by is too long').optional(),
  signoff_batch_id: z.string().trim().max(160, 'signoff_batch_id is too long').optional(),
  signoff_batch_note: z.string().trim().max(500, 'signoff_batch_note is too long').optional(),
  writeback_status: z.enum(['draft_ready', 'queued', 'written_back', 'needs_revision']).optional(),
  writeback_note: z.string().trim().max(2000, 'writeback_note is too long').optional(),
});

export const DomainPackExpansionReviewStateBulkUpdateRequestSchema = z.object({
  review_item_ids: z.array(
    z.string().trim().min(1, 'review_item_id is required').max(240),
  ).min(1, 'review_item_ids cannot be empty').max(200, 'review_item_ids is too large'),
  review_status: z.enum(['candidate_review', 'approved', 'rejected', 'needs_revision']),
  review_note: z.string().trim().max(4000, 'review_note is too long').optional(),
  reviewer_id: z.string().trim().max(120, 'reviewer_id is too long').optional(),
  reviewer_name: z.string().trim().max(120, 'reviewer_name is too long').optional(),
  reviewed_by: z.string().trim().max(120, 'reviewed_by is too long').optional(),
  signoff_batch_id: z.string().trim().max(160, 'signoff_batch_id is too long').optional(),
  signoff_batch_note: z.string().trim().max(500, 'signoff_batch_note is too long').optional(),
  writeback_status: z.enum(['draft_ready', 'queued', 'written_back', 'needs_revision']).optional(),
  writeback_note: z.string().trim().max(2000, 'writeback_note is too long').optional(),
});

// ---------------------------------------------------------------------------
// Story outline analyze request
// ---------------------------------------------------------------------------

export const KnowledgeNeedSchema = z.object({
  need_id: z.string().min(1),
  label: z.string().min(1),
  keywords: z.array(z.string()),
  required: z.boolean(),
});

export const StoryOutlineAnalyzeRequestSchema = z.object({
  outline: z.string().min(1, 'outline cannot be empty'),
  preferred_video_types: VideoTypeSchema.array().optional(),
  target_video_duration: DurationSchema.optional(),
  localized_target_region: z.string().trim().min(1).max(40).optional(),
});

// ---------------------------------------------------------------------------
// Multi-entry match request
// ---------------------------------------------------------------------------

export const MultiMatchRequestSchema = z.object({
  outline: z.string().min(1, 'outline cannot be empty'),
  knowledge_needs: z.array(KnowledgeNeedSchema).min(1, 'at least one knowledge_need required'),
  limit_per_need: z.number().int().min(1).max(20).optional().default(5),
  localized_target_region: z.string().trim().min(1).max(40).optional(),
  localization_mode: LocalizationModeSchema.optional().default('allow_related_influence'),
});

// ---------------------------------------------------------------------------
// AI comic series plan request
// ---------------------------------------------------------------------------

export const AiComicPacingProfileSchema = z.enum([
  'fast_hook',
  'balanced_drama',
  'slow_burn',
  'mystery_cliffhanger',
]);

export const AiComicGenerationScopeSchema = z.enum([
  'series_bible',
  'episode_cards',
  'full_planning',
]);

const AiComicKnowledgePackSchema = z.object({
  primary_entries: z.array(z.object({
    entry_name: z.string(),
    province: z.string(),
    region: z.string(),
    type: z.string(),
    summary: z.string(),
    score: z.number(),
    role_in_story: z.string(),
    match_reason: z.string(),
    keywords: z.array(z.string()),
    knowledge_domain: KnowledgeDomainSchema.optional(),
    entry_role: KnowledgeEntryRoleSchema.optional(),
    era: z.string().optional(),
    asset_usage: z.array(KnowledgeAssetUsageSchema).optional(),
    asset_split: KnowledgeAssetSplitSchema.optional(),
  })),
  supporting_entries: z.array(z.object({
    entry_name: z.string(),
    province: z.string(),
    region: z.string(),
    type: z.string(),
    summary: z.string(),
    score: z.number(),
    role_in_story: z.string(),
    match_reason: z.string(),
    keywords: z.array(z.string()),
    knowledge_domain: KnowledgeDomainSchema.optional(),
    entry_role: KnowledgeEntryRoleSchema.optional(),
    era: z.string().optional(),
    asset_usage: z.array(KnowledgeAssetUsageSchema).optional(),
    asset_split: KnowledgeAssetSplitSchema.optional(),
  })),
  missing_needs: z.array(z.object({
    need_id: z.string(),
    label: z.string(),
    message: z.string(),
  })),
  overall_confidence: z.number(),
});

const SeriesPremiseContractSchema = z.object({
  schema_version: z.literal('series-premise-contract/v1'),
  locked_characters: z.array(z.object({
    name: z.string().trim().min(1).max(40),
    role: z.string().trim().min(1).max(80).optional(),
    required: z.boolean(),
    evidence_span: z.string().trim().min(1).max(600),
  })).max(30),
  world_rules: z.array(z.object({
    rule_id: z.string().trim().min(1).max(120),
    statement: z.string().trim().min(1).max(600),
    required: z.boolean(),
    consequence: z.string().trim().min(1).max(600).optional(),
    evidence_span: z.string().trim().min(1).max(600),
  })).max(60),
  antagonistic_forces: z.array(z.object({
    label: z.string().trim().min(1).max(80),
    function: z.string().trim().min(1).max(600),
    required: z.boolean(),
  })).max(30),
  core_stakes: z.array(z.string().trim().min(1).max(600)).max(30),
  must_cover_beats: z.array(z.string().trim().min(1).max(600)).max(60),
  forbidden_substitutions: z.array(z.string().trim().min(1).max(120)).max(60),
  cultural_boundaries: z.array(z.object({
    statement: z.string().trim().min(1).max(600),
    truth_mode: z.enum(['verified_fact', 'oral_tradition', 'legend', 'fictional_mechanism']),
  })).max(60),
});

export const AiComicSeriesPlanRequestSchema = z.object({
  outline: z.string().trim().min(1, 'outline cannot be empty').max(12000, 'outline is too long'),
  series_title: z.string().trim().min(1).max(80).optional(),
  episode_count: z.number().int().min(1).max(120),
  episode_duration_range_sec: z.object({
    min: z.number().int().min(30).max(1200),
    max: z.number().int().min(30).max(1200),
  }),
  pacing_profile: AiComicPacingProfileSchema.optional().default('balanced_drama'),
  generation_scope: AiComicGenerationScopeSchema.optional().default('full_planning'),
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  knowledge_pack: AiComicKnowledgePackSchema.optional(),
  character_hints: z.array(StoryDetectedCharacterSchema).optional(),
  premise_contract: SeriesPremiseContractSchema.optional(),
}).refine(
  data => data.episode_duration_range_sec.min <= data.episode_duration_range_sec.max,
  { message: 'episode_duration_range_sec.min cannot be greater than max', path: ['episode_duration_range_sec'] },
);

const AiComicSeriesCharacterArcSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  starting_state: z.string().min(1),
  desire: z.string().min(1),
  long_arc: z.string().min(1),
  turning_points: z.array(z.object({
    episode_no: z.number().int().min(1),
    change: z.string().min(1),
  })),
  visual_signature: z.string().min(1),
});

const AiComicPlotThreadSchema = z.object({
  thread_id: z.string().min(1),
  title: z.string().min(1),
  setup_episode: z.number().int().min(1),
  payoff_episode: z.number().int().min(1),
  description: z.string().min(1),
  continuity_notes: z.array(z.string()),
});

const AiComicSeriesPhaseSchema = z.object({
  phase_id: z.string().min(1),
  episode_range: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  purpose: z.string().min(1),
  turning_point: z.string().min(1),
});

const AiComicSeriesSpineBeatSchema = z.object({
  beat_id: z.string().min(1),
  episode_range: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  story_function: z.string().min(1),
  central_question: z.string().min(1),
  required_turn: z.string().min(1),
  payoff_target: z.string().min(1),
});

const AiComicEndingHookTypeSchema = z.enum([
  'choice',
  'reveal',
  'danger',
  'emotional_question',
  'quiet_aftertaste',
  'final_echo',
]);

const AiComicEpisodeCommercialBeatsSchema = z.object({
  schema_version: z.literal('ai-comic-episode-commercial-beats/v1'),
  hook_3s: z.string().trim().min(1).max(600),
  opening_hook_type: z.enum([
    'visual_anomaly',
    'countdown',
    'forbidden_action',
    'identity_gap',
    'evidence_reversal',
    'relationship_rupture',
  ]),
  episode_goal: z.string().trim().min(1).max(600),
  external_pressure: z.string().trim().min(1).max(600),
  failure_cost: z.string().trim().min(1).max(600),
  midpoint_turn: z.string().trim().min(1).max(600),
  character_choice: z.string().trim().min(1).max(600),
  state_change: z.string().trim().min(1).max(600),
  cliffhanger_question: z.string().trim().min(1).max(600),
  opening_dialogue: z.string().trim().min(1).max(600),
  scene_function_sequence: z.array(z.string().trim().min(1).max(120)).min(3).max(12),
  signature_combo: z.string().trim().min(1).max(600),
});

const AiComicEpisodePlanSchema = z.object({
  episode_no: z.number().int().min(1),
  title: z.string().min(1),
  target_duration_sec: z.number().int().min(30).max(1200),
  target_panel_count: z.number().int().min(1).max(240),
  story_phase: z.string().min(1),
  opening_hook: z.string().min(1).optional(),
  main_conflict: z.string().min(1),
  midpoint_turn: z.string().min(1).optional(),
  key_characters: z.array(z.string()),
  continuity_from_previous: z.array(z.string()),
  new_information: z.array(z.string()),
  foreshadowing: z.array(z.string()),
  payoff: z.array(z.string()),
  ending_hook: z.string().min(1),
  ending_hook_type: AiComicEndingHookTypeSchema.optional(),
  character_state_change: z.string().min(1).optional(),
  thread_action: z.string().min(1).optional(),
  knowledge_focus: z.array(z.string()),
  continuity_state_after: z.array(z.string()),
  premise_anchor_ids: z.array(z.string().min(1)).optional(),
  commercial_beats: AiComicEpisodeCommercialBeatsSchema.optional(),
});

const AiComicContinuityRuleSchema = z.object({
  rule_id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
});

const AiComicSeriesMemoryCategorySchema = z.enum([
  'character',
  'relationship',
  'prop',
  'location',
  'visual_asset',
  'knowledge_boundary',
  'story_event',
]);

const AiComicSeriesMemoryItemSchema = z.object({
  memory_id: z.string().min(1),
  category: AiComicSeriesMemoryCategorySchema,
  label: z.string().min(1),
  status: z.string().min(1),
  first_episode_no: z.number().int().min(1).max(120).optional(),
  last_episode_no: z.number().int().min(1).max(120).optional(),
  related_episode_nos: z.array(z.number().int().min(1).max(120)),
  continuity_notes: z.array(z.string()),
  visual_anchor: z.string().optional(),
  knowledge_boundary: z.string().optional(),
});

const AiComicSeriesMemorySchema = z.object({
  schema_version: z.literal('ai-comic-series-memory/v1'),
  characters: z.array(AiComicSeriesMemoryItemSchema),
  relationships: z.array(AiComicSeriesMemoryItemSchema),
  props: z.array(AiComicSeriesMemoryItemSchema),
  locations: z.array(AiComicSeriesMemoryItemSchema),
  visual_assets: z.array(AiComicSeriesMemoryItemSchema),
  knowledge_boundaries: z.array(AiComicSeriesMemoryItemSchema),
  story_events: z.array(AiComicSeriesMemoryItemSchema),
  conflicts: z.array(z.string()),
});

const AiComicEpisodicMemorySourceSchema = z.enum([
  'scene',
  'dialogue',
  'gears_segment',
  'seedance_shot',
]);

const AiComicEpisodicMemoryItemSchema = z.object({
  episodic_memory_id: z.string().min(1),
  source: AiComicEpisodicMemorySourceSchema,
  episode_no: z.number().int().min(1).max(120),
  scene_id: z.string().optional(),
  shot_id: z.string().optional(),
  title: z.string().min(1),
  text: z.string().min(1),
  characters: z.array(z.string()),
  location: z.string().optional(),
  emotional_tone: z.string().optional(),
  keywords: z.array(z.string()),
  token_signature: z.array(z.string()),
  recall_notes: z.array(z.string()),
});

const AiComicEpisodicMemoryIndexSchema = z.object({
  schema_version: z.literal('ai-comic-episodic-memory/v1'),
  embedding_strategy: z.literal('lexical-token-signature/v1'),
  items: z.array(AiComicEpisodicMemoryItemSchema),
  updated_at: z.string().optional(),
});

const AiComicProductionConstraintCategorySchema = z.enum([
  'continuity',
  'negative',
  'camera',
  'asset',
  'cultural_boundary',
]);

const AiComicProductionConstraintSeveritySchema = z.enum(['must', 'should', 'watch']);

const AiComicProductionConstraintStatusSchema = z.enum(['active', 'resolved', 'needs_review']);

const AiComicProductionConstraintItemSchema = z.object({
  constraint_id: z.string().min(1),
  category: AiComicProductionConstraintCategorySchema,
  label: z.string().min(1),
  description: z.string().min(1),
  source: z.enum(['series_plan', 'gears_segment', 'seedance_shot', 'manual']),
  severity: AiComicProductionConstraintSeveritySchema,
  status: AiComicProductionConstraintStatusSchema,
  episode_no: z.number().int().min(1).max(120).optional(),
  scene_id: z.string().optional(),
  shot_id: z.string().optional(),
  related_memory_ids: z.array(z.string()).optional(),
  notes: z.array(z.string()),
});

const AiComicProductionConstraintsSchema = z.object({
  schema_version: z.literal('ai-comic-production-constraints/v1'),
  items: z.array(AiComicProductionConstraintItemSchema),
  conflicts: z.array(z.string()),
});

const AiComicSeriesPlanSchema = z.object({
  schema_version: z.literal('ai-comic-series-plan/v1'),
  series_title: z.string().min(1),
  episode_count: z.number().int().min(1).max(120),
  episode_duration_range_sec: z.object({
    min: z.number().int().min(30).max(1200),
    max: z.number().int().min(30).max(1200),
  }),
  pacing_profile: AiComicPacingProfileSchema,
  generation_scope: AiComicGenerationScopeSchema,
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  recommended_narrative_patterns: z.array(RecommendedNarrativePatternSchema).optional(),
  premise: z.string().min(1).max(12000),
  premise_contract: SeriesPremiseContractSchema.optional(),
  logline: z.string().min(1),
  core_theme: z.string().min(1),
  main_characters: z.array(AiComicSeriesCharacterArcSchema),
  plot_threads: z.array(AiComicPlotThreadSchema),
  phases: z.array(AiComicSeriesPhaseSchema),
  series_spine: z.array(AiComicSeriesSpineBeatSchema).optional(),
  episodes: z.array(AiComicEpisodePlanSchema).min(1),
  continuity_rules: z.array(AiComicContinuityRuleSchema),
  recurring_motifs: z.array(z.string()),
  production_notes: z.array(z.string()),
}).refine(
  data => data.episode_duration_range_sec.min <= data.episode_duration_range_sec.max,
  { message: 'episode_duration_range_sec.min cannot be greater than max', path: ['episode_duration_range_sec'] },
);

const AiComicContinuityLedgerSchema = z.object({
  schema_version: z.literal('ai-comic-continuity-ledger/v1'),
  last_generated_episode_no: z.number().int().min(1).max(120).optional(),
  character_state_current: z.array(z.string()),
  open_threads: z.array(z.string()),
  paid_off_threads: z.array(z.string()),
  knowledge_used: z.array(z.string()),
  episode_records: z.array(z.object({
    episode_no: z.number().int().min(1).max(120),
    story_id: StoryIdValueSchema,
    title: z.string().min(1),
    generated_at: z.string().min(1),
    character_state: z.array(z.string()),
    opened_threads: z.array(z.string()),
    paid_off_threads: z.array(z.string()),
    pending_threads_after: z.array(z.string()),
    knowledge_used: z.array(z.string()),
    ending_hook: z.string().min(1),
    next_episode_memory: z.array(z.string()),
    memory_events: z.array(AiComicSeriesMemoryItemSchema).optional(),
  })),
  series_memory: AiComicSeriesMemorySchema.optional(),
  production_constraints: AiComicProductionConstraintsSchema.optional(),
  episodic_memory: AiComicEpisodicMemoryIndexSchema.optional(),
});

const AiComicSeriesMemoryRecallPreferencesSchema = z.object({
  locked_memory_ids: z.array(z.string().min(1)).max(30).optional(),
  excluded_memory_ids: z.array(z.string().min(1)).max(80).optional(),
  per_episode: z.record(z.string(), z.object({
    locked_memory_ids: z.array(z.string().min(1)).max(30).optional(),
    excluded_memory_ids: z.array(z.string().min(1)).max(80).optional(),
  })).optional(),
  updated_at: z.string().optional(),
}).optional();

export const AiComicSeriesProjectSaveRequestSchema = z.object({
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
  plan: AiComicSeriesPlanSchema,
  generated_episode_story_ids: z.record(z.string(), StoryIdValueSchema).optional(),
  continuity_ledger: AiComicContinuityLedgerSchema.optional(),
  memory_recall_preferences: AiComicSeriesMemoryRecallPreferencesSchema,
});

const AiComicHumanReviewDimensionSchema = z.enum([
  'hook',
  'character',
  'dialogue',
  'progression',
  'turn',
  'ending',
  'cultural_credibility',
]);

export const AiComicSeriesHumanReviewSubmitRequestSchema = z.object({
  reviewer_id: z.string().trim().min(1).max(120),
  blind: z.literal(true),
  candidate_label: z.string().regex(/^候选-[A-Z0-9]{8}$/),
  reviewer_packet_sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  scores: z.array(z.object({
    dimension: AiComicHumanReviewDimensionSchema,
    score: z.number().int().min(1).max(5),
    note: z.string().trim().max(1000).optional(),
  }).strict()).length(7),
}).strict().superRefine((value, ctx) => {
  const dimensions = new Set(value.scores.map(score => score.dimension));
  if (dimensions.size !== AiComicHumanReviewDimensionSchema.options.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['scores'],
      message: '真人盲评必须为七个维度各提交一次评分',
    });
  }
  value.scores.forEach((score, index) => {
    if (score.score < 4 && !score.note?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['scores', index, 'note'],
        message: '低于 4 分的维度必须填写可定位的修改意见',
      });
    }
  });
});

export const AiComicSeriesVisualIdentityDefinitionUpdateRequestSchema = z.object({
  expected_source_fingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  fields: z.record(
    z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    z.string().trim().max(500),
  ),
  definition_notes: z.string().trim().max(2000).optional(),
  action: z.enum(['save_draft', 'approve', 'request_changes']),
  reviewer_id: z.string().trim().min(1).max(120).optional(),
  human_confirmed: z.literal(true).optional(),
  review_note: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === 'save_draft') return;
  if (!value.reviewer_id) {
    ctx.addIssue({
      code: 'custom',
      path: ['reviewer_id'],
      message: '真人视觉审批必须填写 Reviewer ID',
    });
  }
  if (value.human_confirmed !== true) {
    ctx.addIssue({
      code: 'custom',
      path: ['human_confirmed'],
      message: '真人视觉审批必须显式确认已逐项复核',
    });
  }
  if (!value.review_note) {
    ctx.addIssue({
      code: 'custom',
      path: ['review_note'],
      message: '真人视觉审批必须填写复核说明',
    });
  }
});

export const AiComicSeriesVisualWorldRuleDefinitionUpdateRequestSchema = z.object({
  expected_source_fingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  fields: z.record(
    z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    z.string().trim().max(500),
  ),
  definition_notes: z.string().trim().max(2000).optional(),
  pilot_bindings: z.array(z.object({
    episode_no: z.number().int().min(1).max(999),
    target_type: z.enum(['seedance_shot', 'gears_segment']),
    target_id: z.string().trim().min(1).max(160),
  }).strict()).max(30),
  action: z.enum(['save_draft', 'approve', 'request_changes']),
  reviewer_id: z.string().trim().min(1).max(120).optional(),
  human_confirmed: z.literal(true).optional(),
  review_note: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, ctx) => {
  const seenEpisodeNos = new Set<number>();
  value.pilot_bindings.forEach((binding, index) => {
    if (seenEpisodeNos.has(binding.episode_no)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pilot_bindings', index, 'episode_no'],
        message: '同一世界规则每个代表集只能绑定一个目标',
      });
    }
    seenEpisodeNos.add(binding.episode_no);
  });
  if (value.action === 'save_draft') return;
  if (!value.reviewer_id) {
    ctx.addIssue({
      code: 'custom',
      path: ['reviewer_id'],
      message: '真人世界规则审批必须填写 Reviewer ID',
    });
  }
  if (value.human_confirmed !== true) {
    ctx.addIssue({
      code: 'custom',
      path: ['human_confirmed'],
      message: '真人世界规则审批必须显式确认已逐项复核',
    });
  }
  if (!value.review_note) {
    ctx.addIssue({
      code: 'custom',
      path: ['review_note'],
      message: '真人世界规则审批必须填写复核说明',
    });
  }
});

export const AiComicSeriesProjectCopyRequestSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export const AiComicSeriesProjectArchiveRequestSchema = z.object({
  archived: z.boolean().optional().default(true),
});

const AiComicSeedanceProductionStatusSchema = z.enum([
  'not_started',
  'prompt_exported',
  'submitted',
  'processing',
  'ready',
  'failed',
  'skipped',
]);

const AiComicSeedanceRecoverableProductionStatusSchema = z.enum(['submitted', 'processing']);

const AiComicSeedanceAssetReferenceKindSchema = z.enum(['character', 'costume', 'location', 'prop', 'unknown']);

export const AiComicSeedanceAssetLibraryUpdateRequestSchema = z.object({
  items: z.array(z.object({
    asset_id: z.string().trim().min(1).max(120).optional(),
    kind: AiComicSeedanceAssetReferenceKindSchema,
    label: z.string().trim().min(1).max(120),
    reference_slot: z.string().trim().min(1).max(40).optional(),
    file_url: z.string().trim().min(1).max(1000).optional(),
    file_id: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).optional(),
    series_identity_id: z.string().trim().min(1).max(160).optional(),
  })).min(1).max(200),
});

export const AiComicSeedanceProductionStatusUpdateRequestSchema = z.object({
  episode_no: z.number().int().min(1).max(120),
  shot_id: z.string().trim().min(1).max(80),
  status: AiComicSeedanceProductionStatusSchema,
  provider_job_id: z.string().trim().min(1).max(120).optional(),
  video_url: z.string().trim().url().optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  increment_retry: z.boolean().optional(),
  quality_score: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceProductionBatchUpdateRequestSchema = z.object({
  updates: z.array(AiComicSeedanceProductionStatusUpdateRequestSchema).min(1).max(200),
});

export const AiComicSeedanceRetrySubmitRequestSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  job_prefix: z.string().trim().min(1).max(80).optional(),
  use_provider_adapter: z.boolean().optional().default(false),
  external_call_authorization: ExternalProviderCallAuthorizationRequestSchema.optional(),
  note: z.string().trim().min(1).max(500).optional(),
}).superRefine((value, context) => {
  if (value.use_provider_adapter && !value.external_call_authorization) {
    context.addIssue({
      code: 'custom',
      path: ['external_call_authorization'],
      message: 'external_call_authorization is required when use_provider_adapter=true',
    });
  }
});

export const AiComicSeedanceProviderRecoveryRequestSchema = z.object({
  timeout_minutes: z.number().int().min(0).max(10080).optional().default(120),
  statuses: z.array(AiComicSeedanceRecoverableProductionStatusSchema).min(1).max(2).optional(),
  mark_timed_out_failed: z.boolean().optional().default(false),
  failure_reason: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceProductionCallbackRequestSchema = z.object({
  episode_no: z.number().int().min(1).max(120).optional(),
  episodeNo: z.number().int().min(1).max(120).optional(),
  shot_id: z.string().trim().min(1).max(80).optional(),
  shotId: z.string().trim().min(1).max(80).optional(),
  provider_job_id: z.string().trim().min(1).max(120).optional(),
  providerJobId: z.string().trim().min(1).max(120).optional(),
  job_id: z.string().trim().min(1).max(120).optional(),
  jobId: z.string().trim().min(1).max(120).optional(),
  status: z.string().trim().min(1).max(80).optional(),
  video_url: z.string().trim().url().optional(),
  videoUrl: z.string().trim().url().optional(),
  url: z.string().trim().url().optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
  error: z.string().trim().min(1).max(500).optional(),
  message: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  quality_score: z.number().min(0).max(100).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
  reviewNote: z.string().trim().min(1).max(500).optional(),
  actual_cost_amount: GearsExecutionCostValueSchema.optional(),
  actualCostAmount: GearsExecutionCostValueSchema.optional(),
  cost_currency: z.string().trim().regex(/^[A-Z]{3}$/, 'cost_currency must be a 3-letter uppercase currency code').optional(),
  costCurrency: z.string().trim().regex(/^[A-Z]{3}$/, 'costCurrency must be a 3-letter uppercase currency code').optional(),
}).superRefine((data, context) => {
  if (!Boolean(
    (data.episode_no ?? data.episodeNo) && (data.shot_id ?? data.shotId)
    || data.provider_job_id
    || data.providerJobId
    || data.job_id
    || data.jobId
  )) {
    context.addIssue({
      code: 'custom',
      message: 'callback requires episode_no + shot_id or provider_job_id/job_id',
    });
  }
  const hasCostAmount = (data.actual_cost_amount ?? data.actualCostAmount) !== undefined;
  const hasCostCurrency = Boolean(data.cost_currency ?? data.costCurrency);
  if (hasCostAmount !== hasCostCurrency) {
    context.addIssue({
      code: 'custom',
      path: hasCostAmount ? ['cost_currency'] : ['actual_cost_amount'],
      message: 'actual cost amount and cost currency must be provided together',
    });
  }
});

export const AiComicSeedanceProductionVersionSelectRequestSchema = z.object({
  episode_no: z.number().int().min(1).max(120),
  shot_id: z.string().trim().min(1).max(80),
  version_id: z.string().trim().min(1).max(120),
  note: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceProductionAutoSelectRequestSchema = z.object({
  min_quality_score: z.number().min(0).max(100).optional(),
  overwrite_manual: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceThumbnailCaptureRequestSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  overwrite: z.boolean().optional().default(false),
  episode_no: z.number().int().min(1).max(120).optional(),
  shot_id: z.string().trim().min(1).max(80).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const AiComicSeedanceCutAssemblyRequestSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  overwrite: z.boolean().optional().default(false),
  episode_no: z.number().int().min(1).max(120).optional(),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.mp4$/).optional(),
  assembly_mode: z.enum(['copy', 'transcode']).optional().default('copy'),
  output_profile: z.enum(['source_copy', 'mp4_h264_1080p', 'mp4_h264_720p']).optional(),
  fps: z.number().int().min(12).max(60).optional(),
  crf: z.number().int().min(14).max(32).optional(),
  preset: z.enum(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow']).optional(),
});

export const AiComicSeedanceSubtitleExportRequestSchema = z.object({
  episode_no: z.number().int().min(1).max(120).optional(),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.srt$/).optional(),
});

export const AiComicSeedanceSubtitleRenderRequestSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  overwrite: z.boolean().optional().default(false),
  mode: z.enum(['sidecar', 'burn_in']).optional().default('sidecar'),
  episode_no: z.number().int().min(1).max(120).optional(),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.(srt|mp4)$/).optional(),
  input_video_path: z.string().trim().min(1).max(500).optional(),
});

const AiComicSeedanceAudioKindSchema = z.enum(['dialogue', 'narration', 'music', 'sound_effect', 'ambient']);

export const AiComicSeedanceAudioLibraryUpdateRequestSchema = z.object({
  items: z.array(z.object({
    asset_id: z.string().trim().min(1).max(120).optional(),
    kind: AiComicSeedanceAudioKindSchema,
    label: z.string().trim().min(1).max(120),
    file_url: z.string().trim().min(1).max(1000).optional(),
    file_id: z.string().trim().min(1).max(160).optional(),
    duration_sec: z.number().min(0.1).max(7200).optional(),
    license_note: z.string().trim().max(500).optional(),
    loopable: z.boolean().optional(),
    bpm: z.number().min(20).max(260).optional(),
    mood_tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })).min(1).max(300),
});

export const AiComicSeedanceAudioMixRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(false),
  episode_no: z.number().int().min(1).max(120).optional(),
  input_video_path: z.string().trim().min(1).max(500).optional(),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.mp4$/).optional(),
  audio_profile: z.enum(['balanced_dialogue', 'music_forward', 'ambient_soft']).optional().default('balanced_dialogue'),
  include_original_audio: z.boolean().optional().default(false),
  original_audio_volume_db: z.number().min(-48).max(12).optional().default(0),
});

export const AiComicSeedanceTitleCardRenderRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(false),
  episode_no: z.number().int().min(1).max(120).optional(),
  output_profile: z.enum(['mp4_h264_1080p', 'mp4_h264_720p']).optional().default('mp4_h264_1080p'),
  font_path: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceFinalDeliveryRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(false),
  include_subtitles: z.boolean().optional().default(true),
  include_audio_mix: z.boolean().optional().default(true),
  include_title_cards: z.boolean().optional().default(true),
  missing_dependency_mode: z.enum(['strict', 'tolerant']).optional().default('strict'),
  allow_open_final_reviews: z.boolean().optional().default(false),
  resolve_reassemble_reviews: z.boolean().optional().default(false),
  resolved_note: z.string().trim().min(1).max(500).optional(),
  output_profile: z.enum(['mp4_h264_1080p', 'mp4_h264_720p', 'source_copy']).optional().default('mp4_h264_1080p'),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.mp4$/).optional(),
});

export const AiComicSeedanceFinalDeliveryRollbackRequestSchema = z.object({
  release_id: z.string().trim().regex(/^release-[0-9A-Za-z._-]+$/).max(180),
  confirmed: z.literal(true),
  reason: z.string().trim().min(8).max(500),
});

const AiComicSeedanceReviewTargetTypeSchema = z.enum(['shot', 'cut', 'final', 'subtitle', 'audio', 'title_card']);
const AiComicSeedanceReviewSeveritySchema = z.enum(['blocking', 'major', 'minor', 'note']);
const AiComicSeedanceReviewIssueTypeSchema = z.enum([
  'visual',
  'continuity',
  'subtitle',
  'audio',
  'pacing',
  'title_card',
  'technical',
  'compliance',
  'other',
]);
const AiComicSeedanceReviewRepairActionSchema = z.enum([
  'redo_shot',
  'reselect_version',
  'revise_subtitle',
  'adjust_audio',
  'revise_title_card',
  'reassemble_final',
  'manual_review',
]);

export const AiComicSeedanceReviewAddRequestSchema = z.object({
  target_type: AiComicSeedanceReviewTargetTypeSchema,
  target_id: z.string().trim().min(1).max(160).optional(),
  episode_no: z.number().int().min(1).max(120).optional(),
  shot_id: z.string().trim().min(1).max(80).optional(),
  severity: AiComicSeedanceReviewSeveritySchema,
  issue_type: AiComicSeedanceReviewIssueTypeSchema,
  note: z.string().trim().min(1).max(1000),
  repair_action: AiComicSeedanceReviewRepairActionSchema.optional(),
  created_by: z.string().trim().min(1).max(120).optional(),
}).refine(
  data => data.target_type !== 'shot' || Boolean(data.shot_id || data.target_id),
  { message: 'shot review requires shot_id or target_id' },
);

export const AiComicSeedanceReviewResolveRequestSchema = z.object({
  review_id: z.string().trim().min(1).max(120),
  status: z.enum(['resolved', 'wont_fix']).optional().default('resolved'),
  resolved_note: z.string().trim().min(1).max(1000).optional(),
});

export const AiComicSeriesLedgerRebuildRequestSchema = z.object({
  from_episode_no: z.number().int().min(1).max(120).optional().default(1),
});

const AiComicSeriesMemoryRecallControlsSchema = z.object({
  locked_memory_ids: z.array(z.string().min(1)).max(30).optional(),
  excluded_memory_ids: z.array(z.string().min(1)).max(80).optional(),
}).optional();

export const AiComicEpisodeContextPreviewRequestSchema = z.object({
  series_plan: AiComicSeriesPlanSchema,
  episode_no: z.number().int().min(1).max(120),
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  memory_recall_controls: AiComicSeriesMemoryRecallControlsSchema,
}).refine(
  data => data.episode_no <= data.series_plan.episode_count,
  { message: 'episode_no cannot exceed series_plan.episode_count', path: ['episode_no'] },
);

export const AiComicEpisodeGenerateRequestSchema = z.object({
  series_plan: AiComicSeriesPlanSchema,
  episode_no: z.number().int().min(1).max(120),
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
  model_profile_id: z.string().optional(),
  output_gears_segments: z.boolean().optional().default(true),
  knowledge_pack: AiComicKnowledgePackSchema.optional(),
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  memory_recall_controls: AiComicSeriesMemoryRecallControlsSchema,
  auto_audit_continuity: z.boolean().optional().default(true),
  auto_repair_episode: z.boolean().optional().default(false),
}).refine(
  data => data.episode_no <= data.series_plan.episode_count,
  { message: 'episode_no cannot exceed series_plan.episode_count', path: ['episode_no'] },
);

// ---------------------------------------------------------------------------
// Product resource ownership migration — explicit review + optimistic lock
// ---------------------------------------------------------------------------

const ProductResourceOwnershipMigrationOwnershipSchema = z.object({
  schema_version: z.literal('story-agent-product-resource-ownership/v1'),
  organization_id: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  owner_actor_id: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  member_actor_ids: z.array(z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:-]+$/)).max(200),
}).strict().superRefine((ownership, context) => {
  if (new Set(ownership.member_actor_ids).size !== ownership.member_actor_ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['member_actor_ids'], message: 'member_actor_ids must be unique' });
  }
  if (ownership.member_actor_ids.includes(ownership.owner_actor_id)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['member_actor_ids'], message: 'owner must not be duplicated as a member' });
  }
});

export const ProductResourceOwnershipMigrationRequestSchema = z.object({
  schema_version: z.literal('story-agent-product-resource-ownership-migration-request/v1'),
  migration_id: z.string().trim().min(8).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  resource_type: z.enum(['story_project', 'series_project']),
  resource_id: z.string().trim().min(1).max(180),
  expected_metadata_sha256: z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/),
  ownership: ProductResourceOwnershipMigrationOwnershipSchema,
  review_reference: z.string().trim().min(8).max(300),
  operator_confirmation: z.literal('ownership_reviewed'),
  dry_run: z.boolean().optional().default(true),
}).strict().superRefine((request, context) => {
  const valid = request.resource_type === 'story_project'
    ? /^\d{8}-story-[0-9a-z]+--[a-z_]+$/.test(request.resource_id)
    : /^\d{8}-series-[0-9a-z]+$/.test(request.resource_id);
  if (!valid) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['resource_id'], message: 'resource_id does not match resource_type' });
  }
});

export const StoryDomainSafetyMigrationRequestSchema = z.object({
  schema_version: z.literal('story-domain-safety-migration-request/v1'),
  migration_id: z.string().trim().min(8).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  project_id: z.string().trim().min(1).max(240).regex(/^[a-zA-Z0-9_-]+(?:--[a-z_]+)?$/),
  expected_current_version_id: z.string().trim().min(1).max(280).regex(/^[a-zA-Z0-9_-]+$/),
  expected_story_sha256: z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/),
  expected_source_domain: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/),
  expected_source_entry: z.string().trim().min(1).max(300),
  review_reference: z.string().trim().min(8).max(300),
  operator_confirmation: z.literal('migration_scope_reviewed'),
  dry_run: z.boolean().optional().default(true),
}).strict().superRefine((request, context) => {
  if (!request.expected_current_version_id.startsWith(`${request.project_id}-v`)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expected_current_version_id'],
      message: 'expected_current_version_id must belong to project_id',
    });
  }
});

export const StoryProjectFileToSqliteMigrationRequestSchema = z.object({
  schema_version: z.literal('story-project-file-to-sqlite-migration-request/v1'),
  migration_id: z.string().trim().min(8).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  expected_source_logical_sha256: z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/),
  review_reference: z.string().trim().min(8).max(300),
  operator_confirmation: z.literal('file_repository_snapshot_reviewed'),
  dry_run: z.boolean().optional().default(true),
}).strict();
