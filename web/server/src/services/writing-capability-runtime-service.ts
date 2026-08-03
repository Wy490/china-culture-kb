import {
  WritingCapabilityRuntimeActivationV1Schema,
  WritingCapabilityRuntimeContextV1Schema,
  WritingCapabilityRuntimeResolutionV1Schema,
} from '@shared/schemas.js';
import type {
  VideoType,
  WritingCapabilityAdapterRuleLayerV1,
  WritingCapabilityAdapterV1,
  WritingCapabilityRuntimeActivationV1,
  WritingCapabilityRuntimeContextV1,
  WritingCapabilityProfileV1,
  WritingCapabilityRuntimeResolutionV1,
  WritingCapabilityRuntimeRuleV1,
} from '@shared/types.js';
import { preflightWritingCapabilityAdapter } from './writing-capability-adapter-service.js';
import { createWritingCapabilityRegistry } from './writing-capability-registry.js';

const CAPABILITY_ID = 'short_drama_develop_write_review';
const VIDEO_TYPE = 'ai_comic_drama';

export const CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION = deepFreeze({
  schema_version: 'writing-capability-runtime-activation/v1',
  activation_id: 'short_drama_ai_comic_runtime_20260802',
  activation_revision: 1,
  status: 'enabled',
  candidate: {
    capability_id: CAPABILITY_ID,
    video_type: VIDEO_TYPE,
    profile_schema_version: 'writing-capability-profile/v1',
    source_commit: 'adab39cdfa001f272f03bbcf4e68ed005a43d8b6',
    adapter_id: 'short_drama_ai_comic_shadow_adapter',
    adapter_revision: 1,
    internal_adaptation_version: 'short-drama-adapter/v1',
    rollback_id: 'disable-short-drama-ai-comic-shadow-v1',
  },
  boundary: {
    default_off: true,
    exact_single_capability: true,
    exact_single_video_type: true,
    internal_opt_in_only: true,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityRuntimeActivationV1);

export const CANONICAL_CONTINUITY_AI_COMIC_RUNTIME_ACTIVATION = deepFreeze({
  schema_version: 'writing-capability-runtime-activation/v1',
  activation_id: 'continuity_ai_comic_runtime_20260803',
  activation_revision: 1,
  status: 'enabled',
  candidate: {
    capability_id: 'continuity_state_tracking',
    video_type: VIDEO_TYPE,
    profile_schema_version: 'writing-capability-profile/v1',
    source_commit: 'c482d48f4eb9b488f033a77a51f9fae55cc0d75f',
    adapter_id: 'continuity_ai_comic_shadow_adapter',
    adapter_revision: 1,
    internal_adaptation_version: 'continuity-adapter/v1',
    rollback_id: 'disable-continuity-ai-comic-shadow-v1',
  },
  boundary: {
    default_off: true,
    exact_single_capability: true,
    exact_single_video_type: true,
    internal_opt_in_only: true,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityRuntimeActivationV1);

export const CANONICAL_READER_SIMULATION_AI_COMIC_RUNTIME_ACTIVATION = deepFreeze({
  schema_version: 'writing-capability-runtime-activation/v1',
  activation_id: 'reader_simulation_ai_comic_runtime_20260803',
  activation_revision: 1,
  status: 'enabled',
  candidate: {
    capability_id: 'reader_simulation_review',
    video_type: VIDEO_TYPE,
    profile_schema_version: 'writing-capability-profile/v1',
    source_commit: 'fb9dab2d4d23434ae76568e8de36aaf515dea8d5',
    adapter_id: 'reader_simulation_ai_comic_shadow_adapter',
    adapter_revision: 1,
    internal_adaptation_version: 'reader-simulation-adapter/v1',
    rollback_id: 'disable-reader-simulation-ai-comic-shadow-v1',
  },
  boundary: {
    default_off: true,
    exact_single_capability: true,
    exact_single_video_type: true,
    internal_opt_in_only: true,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityRuntimeActivationV1);

export const CANONICAL_WRITING_CAPABILITY_RUNTIME_ACTIVATIONS = deepFreeze([
  CANONICAL_CONTINUITY_AI_COMIC_RUNTIME_ACTIVATION,
  CANONICAL_READER_SIMULATION_AI_COMIC_RUNTIME_ACTIVATION,
  CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
] satisfies readonly WritingCapabilityRuntimeActivationV1[]);

export function buildWritingCapabilityRuntimeResolution(input: {
  videoType: VideoType;
  requestedCapabilityIds: readonly string[];
  activation: unknown;
  adapter: unknown;
  rolloutPolicy: unknown;
}): WritingCapabilityRuntimeResolutionV1 {
  const requestedCapabilityIds = [...input.requestedCapabilityIds]
    .sort((left, right) => left.localeCompare(right));
  const issues: string[] = [];
  const activationResult = WritingCapabilityRuntimeActivationV1Schema.safeParse(
    input.activation,
  );
  if (!activationResult.success) {
    issues.push(...activationResult.error.issues.map(issue => (
      `activation.${issue.path.join('.') || 'root'}: ${issue.message}`
    )));
  }
  const adapterPreflight = preflightWritingCapabilityAdapter({
    adapter: input.adapter,
    rolloutPolicy: input.rolloutPolicy,
  });
  if (adapterPreflight.status !== 'passed') {
    issues.push(...adapterPreflight.conflicts.map(conflict => (
      `adapter.${conflict.path}: ${conflict.message}`
    )));
  }

  const activation = activationResult.data;
  const adapter = adapterPreflight.status === 'passed'
    ? input.adapter as WritingCapabilityAdapterV1
    : undefined;
  const candidate = activation?.candidate;
  const canonicalActivation = activation
    ? CANONICAL_WRITING_CAPABILITY_RUNTIME_ACTIVATIONS.find(
      item => item.activation_id === activation.activation_id,
    )
    : undefined;
  if (
    !candidate
    || requestedCapabilityIds.length !== 1
    || requestedCapabilityIds[0] !== candidate.capability_id
    || input.videoType !== candidate.video_type
  ) {
    issues.push('runtime activation requires exactly its declared capability and video type');
  }
  if (activation && (!canonicalActivation || !sameActivationIdentity(activation, canonicalActivation))) {
    issues.push('runtime activation identity does not match the canonical candidate');
  }
  if (activation && adapter && candidate && (
    candidate.capability_id !== adapter.capability_id
    || candidate.video_type !== adapter.video_type
    || candidate.profile_schema_version !== adapter.profile_schema_version
    || candidate.source_commit !== adapter.source_commit
    || candidate.adapter_id !== adapter.adapter_id
    || candidate.adapter_revision !== adapter.adapter_revision
    || candidate.internal_adaptation_version !== adapter.internal_adaptation_version
    || candidate.rollback_id !== adapter.rollback_id
  )) {
    issues.push('runtime activation, profile, and adapter identities must match exactly');
  }

  const profile = createWritingCapabilityRegistry().list().find(
    item => item.capability_id === candidate?.capability_id,
  );
  if (!profile) {
    issues.push(`canonical capability "${candidate?.capability_id ?? 'unknown'}" is unavailable`);
  } else if (
    profile.schema_version !== candidate?.profile_schema_version
    || profile.source_commit !== candidate?.source_commit
    || !candidate
    || !profile.allowed_video_types.includes(candidate.video_type)
    || profile.forbidden_video_types.includes(candidate.video_type)
  ) {
    issues.push('canonical capability profile identity or video-type scope drifted');
  }

  if (issues.length > 0 || !activation || !adapter || !profile) {
    return buildFallbackResolution(input.videoType, requestedCapabilityIds, issues);
  }

  const context = WritingCapabilityRuntimeContextV1Schema.parse({
    schema_version: 'writing-capability-runtime-context/v1',
    status: 'active',
    activation_id: activation.activation_id,
    activation_revision: activation.activation_revision,
    capability_id: adapter.capability_id,
    video_type: adapter.video_type,
    profile_schema_version: adapter.profile_schema_version,
    source_commit: adapter.source_commit,
    adapter_id: adapter.adapter_id,
    adapter_revision: adapter.adapter_revision,
    internal_adaptation_version: adapter.internal_adaptation_version,
    rollback_id: adapter.rollback_id,
    rules: mapRuntimeRules(adapter, profile),
    guardrails: adapter.guardrails,
    boundary: {
      default_off: true,
      explicit_internal_opt_in: true,
      affects_generation: true,
      affects_quality: true,
      affects_repair: true,
      persistence_allowed: true,
      public_api_exposed: false,
      third_party_code_executed: false,
    },
  });
  return deepFreeze(WritingCapabilityRuntimeResolutionV1Schema.parse({
    schema_version: 'writing-capability-runtime-resolution/v1',
    status: 'active',
    video_type: input.videoType,
    requested_capability_ids: requestedCapabilityIds,
    context,
    issues: [],
    boundary: runtimeResolutionBoundary(),
  }));
}

export function writingCapabilityGenerationRequirementLines(
  context?: WritingCapabilityRuntimeContextV1,
): string[] {
  if (!context || context.status !== 'active') return [];
  return [
    ...context.rules.blueprint_requirements,
    ...context.rules.scene_rules,
  ].map(rule => `写作能力 ${context.capability_id} [${rule.rule_id}]：${rule.text}`);
}

function mapRuntimeRules(
  adapter: WritingCapabilityAdapterV1,
  profile: WritingCapabilityProfileV1,
): Record<WritingCapabilityAdapterRuleLayerV1, WritingCapabilityRuntimeRuleV1[]> {
  return Object.fromEntries(
    (Object.keys(adapter.rules) as WritingCapabilityAdapterRuleLayerV1[]).map(layer => [
      layer,
      adapter.rules[layer].map(rule => ({
        rule_id: rule.rule_id,
        layer,
        text: profile[layer][rule.source_rule_index],
        source_profile_field: layer,
        source_rule_index: rule.source_rule_index,
      })),
    ]),
  ) as Record<WritingCapabilityAdapterRuleLayerV1, WritingCapabilityRuntimeRuleV1[]>;
}

function sameActivationIdentity(
  activation: WritingCapabilityRuntimeActivationV1,
  canonical: WritingCapabilityRuntimeActivationV1,
): boolean {
  return activation.activation_id === canonical.activation_id
    && activation.activation_revision === canonical.activation_revision
    && activation.status === canonical.status
    && sameRecord(activation.candidate, canonical.candidate)
    && sameRecord(activation.boundary, canonical.boundary);
}

function sameRecord(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  const expectedEntries = Object.entries(expected);
  return Object.keys(actual).length === expectedEntries.length
    && expectedEntries.every(([key, value]) => actual[key] === value);
}

function buildFallbackResolution(
  videoType: VideoType,
  requestedCapabilityIds: readonly string[],
  issues: readonly string[],
): WritingCapabilityRuntimeResolutionV1 {
  return deepFreeze(WritingCapabilityRuntimeResolutionV1Schema.parse({
    schema_version: 'writing-capability-runtime-resolution/v1',
    status: 'fallback',
    video_type: videoType,
    requested_capability_ids: [...requestedCapabilityIds],
    issues: [...new Set(issues.length > 0 ? issues : ['runtime activation is unavailable'])],
    boundary: runtimeResolutionBoundary(),
  }));
}

function runtimeResolutionBoundary() {
  return {
    default_off: true as const,
    explicit_internal_opt_in: true as const,
    fail_closed: true as const,
    baseline_preserved_on_fallback: true as const,
    public_api_exposed: false as const,
    third_party_code_executed: false as const,
  };
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
