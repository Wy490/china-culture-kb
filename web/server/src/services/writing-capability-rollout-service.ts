import {
  WritingCapabilityRolloutPolicyV1Schema,
  WritingCapabilityShadowPreparationPlanV1Schema,
} from '@shared/schemas.js';
import type {
  VideoType,
  WritingCapabilityAdapterPreflightReportV1,
  WritingCapabilityRolloutPolicyV1,
  WritingCapabilityShadowPreparationPlanV1,
  WritingCapabilityShadowPreparationStatusV1,
} from '@shared/types.js';
import {
  createWritingCapabilityRegistry,
} from './writing-capability-registry.js';
import { preflightWritingCapabilityAdapter } from './writing-capability-adapter-service.js';
import {
  routeWritingCapabilities,
} from './writing-capability-router.js';

export const CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY = deepFreeze({
  schema_version: 'writing-capability-rollout-policy/v1',
  policy_id: 'short_drama_ai_comic_shadow_20260801',
  policy_revision: 1,
  status: 'shadow_plan',
  candidate: {
    capability_id: 'short_drama_develop_write_review',
    video_type: 'ai_comic_drama',
    profile_schema_version: 'writing-capability-profile/v1',
    source_commit: 'adab39cdfa001f272f03bbcf4e68ed005a43d8b6',
    internal_adaptation_version: 'short-drama-adapter/v1',
    rollback_id: 'disable-short-drama-ai-comic-shadow-v1',
  },
  boundary: {
    exact_single_capability: true,
    exact_single_video_type: true,
    global_enablement_allowed: false,
    runtime_activation_allowed: false,
    affects_generation: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityRolloutPolicyV1);

export const CANONICAL_CONTINUITY_AI_COMIC_SHADOW_POLICY = deepFreeze({
  schema_version: 'writing-capability-rollout-policy/v1',
  policy_id: 'continuity_ai_comic_shadow_20260803',
  policy_revision: 1,
  status: 'shadow_plan',
  candidate: {
    capability_id: 'continuity_state_tracking',
    video_type: 'ai_comic_drama',
    profile_schema_version: 'writing-capability-profile/v1',
    source_commit: 'c482d48f4eb9b488f033a77a51f9fae55cc0d75f',
    internal_adaptation_version: 'continuity-adapter/v1',
    rollback_id: 'disable-continuity-ai-comic-shadow-v1',
  },
  boundary: {
    exact_single_capability: true,
    exact_single_video_type: true,
    global_enablement_allowed: false,
    runtime_activation_allowed: false,
    affects_generation: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityRolloutPolicyV1);

export const CANONICAL_READER_SIMULATION_AI_COMIC_SHADOW_POLICY = deepFreeze({
  schema_version: 'writing-capability-rollout-policy/v1',
  policy_id: 'reader_simulation_ai_comic_shadow_20260803',
  policy_revision: 1,
  status: 'shadow_plan',
  candidate: {
    capability_id: 'reader_simulation_review',
    video_type: 'ai_comic_drama',
    profile_schema_version: 'writing-capability-profile/v1',
    source_commit: 'fb9dab2d4d23434ae76568e8de36aaf515dea8d5',
    internal_adaptation_version: 'reader-simulation-adapter/v1',
    rollback_id: 'disable-reader-simulation-ai-comic-shadow-v1',
  },
  boundary: {
    exact_single_capability: true,
    exact_single_video_type: true,
    global_enablement_allowed: false,
    runtime_activation_allowed: false,
    affects_generation: false,
    third_party_code_executed: false,
  },
} satisfies WritingCapabilityRolloutPolicyV1);

export function buildWritingCapabilityShadowPreparationPlan(input: {
  videoType: VideoType;
  requestedCapabilityIds: readonly string[];
  rolloutPolicy?: unknown;
  adapter?: unknown;
}): WritingCapabilityShadowPreparationPlanV1 {
  const requestedCapabilityIds = [...input.requestedCapabilityIds]
    .sort((left, right) => left.localeCompare(right));
  const routingReport = routeWritingCapabilities({
    schema_version: 'writing-capability-routing-request/v1',
    video_type: input.videoType,
    requested_capability_ids: requestedCapabilityIds,
  });
  if (input.rolloutPolicy === undefined) {
    return buildPlan({
      status: 'not_requested',
      videoType: input.videoType,
      requestedCapabilityIds,
      routingReport,
      issues: ['rollout policy was not provided'],
    });
  }

  const policyResult = WritingCapabilityRolloutPolicyV1Schema.safeParse(
    input.rolloutPolicy,
  );
  if (!policyResult.success) {
    return buildPlan({
      status: 'policy_incompatible',
      videoType: input.videoType,
      requestedCapabilityIds,
      routingReport,
      issues: policyResult.error.issues.map(issue => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      }),
    });
  }
  const policy = policyResult.data;
  const policyIssues = validatePolicyAgainstRegistry(policy);
  if (policyIssues.length > 0) {
    return buildPlan({
      status: 'policy_incompatible',
      videoType: input.videoType,
      requestedCapabilityIds,
      routingReport,
      policy,
      issues: policyIssues,
    });
  }
  if (requestedCapabilityIds.length === 0) {
    return buildPlan({
      status: 'not_requested',
      videoType: input.videoType,
      requestedCapabilityIds,
      routingReport,
      policy,
      issues: ['no capability was requested'],
    });
  }
  if (policy.status === 'disabled') {
    return buildPlan({
      status: 'policy_disabled',
      videoType: input.videoType,
      requestedCapabilityIds,
      routingReport,
      policy,
      issues: [`rollout policy "${policy.policy_id}" is disabled`],
    });
  }
  if (
    requestedCapabilityIds.length !== 1
    || requestedCapabilityIds[0] !== policy.candidate.capability_id
    || input.videoType !== policy.candidate.video_type
  ) {
    return buildPlan({
      status: 'candidate_mismatch',
      videoType: input.videoType,
      requestedCapabilityIds,
      routingReport,
      policy,
      issues: [
        `policy candidate requires exactly "${policy.candidate.capability_id}" for "${policy.candidate.video_type}"`,
      ],
    });
  }
  const decision = routingReport.decisions[0];
  if (decision?.reason_code !== 'profile_disabled') {
    return buildPlan({
      status: 'routing_rejected',
      videoType: input.videoType,
      requestedCapabilityIds,
      routingReport,
      policy,
      issues: [decision?.message ?? 'routing decision is unavailable'],
    });
  }
  if (input.adapter !== undefined) {
    const adapterPreview = preflightWritingCapabilityAdapter({
      adapter: input.adapter,
      rolloutPolicy: policy,
    });
    if (adapterPreview.status === 'blocked') {
      return buildPlan({
        status: 'adapter_blocked',
        videoType: input.videoType,
        requestedCapabilityIds,
        routingReport,
        policy,
        adapterPreview,
        issues: adapterPreview.conflicts.map(conflict => (
          `${conflict.code} at ${conflict.path}: ${conflict.message}`
        )),
      });
    }
    return buildPlan({
      status: 'shadow_ready',
      videoType: input.videoType,
      requestedCapabilityIds,
      routingReport,
      policy,
      adapterPreview,
      issues: [],
    });
  }
  return buildPlan({
    status: 'shadow_ready',
    videoType: input.videoType,
    requestedCapabilityIds,
    routingReport,
    policy,
    issues: [],
  });
}

function validatePolicyAgainstRegistry(
  policy: WritingCapabilityRolloutPolicyV1,
): string[] {
  const profile = createWritingCapabilityRegistry().list().find(
    candidate => candidate.capability_id === policy.candidate.capability_id,
  );
  if (!profile) {
    return [`candidate capability "${policy.candidate.capability_id}" is not registered`];
  }
  const issues: string[] = [];
  if (profile.schema_version !== policy.candidate.profile_schema_version) {
    issues.push('candidate profile_schema_version does not match the canonical profile');
  }
  if (profile.source_commit !== policy.candidate.source_commit) {
    issues.push('candidate source_commit does not match the canonical profile');
  }
  if (
    profile.forbidden_video_types.includes(policy.candidate.video_type)
    || !profile.allowed_video_types.includes(policy.candidate.video_type)
  ) {
    issues.push('candidate video_type is not allowed by the canonical profile');
  }
  if (profile.enabled) {
    issues.push('canonical profile must remain disabled during shadow planning');
  }
  return issues;
}

function buildPlan(input: {
  status: WritingCapabilityShadowPreparationStatusV1;
  videoType: VideoType;
  requestedCapabilityIds: readonly string[];
  routingReport: ReturnType<typeof routeWritingCapabilities>;
  policy?: WritingCapabilityRolloutPolicyV1;
  adapterPreview?: WritingCapabilityAdapterPreflightReportV1;
  issues: readonly string[];
}): WritingCapabilityShadowPreparationPlanV1 {
  const policy = input.policy;
  const result = WritingCapabilityShadowPreparationPlanV1Schema.parse({
    schema_version: 'writing-capability-shadow-preparation-plan/v1',
    status: input.status,
    video_type: input.videoType,
    requested_capability_ids: [...input.requestedCapabilityIds],
    ...(policy ? {
      policy: {
        policy_id: policy.policy_id,
        policy_revision: policy.policy_revision,
        status: policy.status,
        capability_id: policy.candidate.capability_id,
        video_type: policy.candidate.video_type,
        profile_schema_version: policy.candidate.profile_schema_version,
        source_commit: policy.candidate.source_commit,
        internal_adaptation_version: policy.candidate.internal_adaptation_version,
        rollback_id: policy.candidate.rollback_id,
      },
    } : {}),
    routing_report: input.routingReport,
    ...(input.adapterPreview ? { adapter_preview: input.adapterPreview } : {}),
    projected_rules: {
      blueprint_requirements: [],
      scene_rules: [],
      quality_rules: [],
      repair_guidance: [],
    },
    issues: [...new Set(input.issues.map(issue => issue.trim()).filter(Boolean))],
    boundary: {
      shadow_only: true,
      affects_generation: false,
      profile_rules_injected: false,
      runtime_activation_allowed: false,
      global_enablement_allowed: false,
      persistence_allowed: false,
      public_api_exposed: false,
      third_party_code_executed: false,
    },
  });
  return deepFreeze(result);
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
