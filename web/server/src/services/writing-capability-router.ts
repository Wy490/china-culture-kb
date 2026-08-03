import {
  WritingCapabilityRoutingReportV1Schema,
  WritingCapabilityRoutingRequestV1Schema,
} from '@shared/schemas.js';
import type {
  WritingCapabilityProfileV1,
  WritingCapabilityRoutingDecisionV1,
  WritingCapabilityRoutingReportV1,
  WritingCapabilityRoutingRequestV1,
} from '@shared/types.js';
import {
  createWritingCapabilityRegistry,
} from './writing-capability-registry.js';

export class WritingCapabilityRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WritingCapabilityRouterError';
  }
}

export function routeWritingCapabilities(
  candidate: unknown,
): WritingCapabilityRoutingReportV1 {
  const request = parseRequest(candidate);
  const profiles = createWritingCapabilityRegistry().list();
  if (profiles.some(profile => profile.enabled)) {
    throw new WritingCapabilityRouterError(
      'writing-capability-router/v1 requires every canonical profile to remain disabled',
    );
  }
  const profileById = new Map(
    profiles.map(profile => [profile.capability_id, profile]),
  );
  const requestedCapabilityIds = [...request.requested_capability_ids]
    .sort((left, right) => left.localeCompare(right));
  const decisions = requestedCapabilityIds.map(capabilityId => (
    buildDecision(request, capabilityId, profileById.get(capabilityId))
  ));
  const eligibleButDisabledCount = decisions.filter(
    decision => decision.reason_code === 'profile_disabled',
  ).length;
  const report = WritingCapabilityRoutingReportV1Schema.parse({
    schema_version: 'writing-capability-routing-report/v1',
    video_type: request.video_type,
    requested_capability_ids: requestedCapabilityIds,
    active_capability_ids: [],
    decisions,
    summary: {
      requested_count: requestedCapabilityIds.length,
      decision_count: decisions.length,
      active_count: 0,
      eligible_but_disabled_count: eligibleButDisabledCount,
      incompatible_count: decisions.length - eligibleButDisabledCount,
    },
    boundary: {
      router_only: true,
      affects_generation: false,
      runtime_enablement_supported: false,
      profile_rules_injected: false,
      third_party_code_executed: false,
      all_profiles_default_disabled: true,
    },
  });
  return deepFreeze(report);
}

function parseRequest(candidate: unknown): WritingCapabilityRoutingRequestV1 {
  const result = WritingCapabilityRoutingRequestV1Schema.safeParse(candidate);
  if (!result.success) {
    const details = result.error.issues
      .map(issue => `${issue.path.join('.') || 'request'}: ${issue.message}`)
      .join('; ');
    throw new WritingCapabilityRouterError(
      `Invalid writing capability routing request: ${details}`,
    );
  }
  return result.data;
}

function buildDecision(
  request: WritingCapabilityRoutingRequestV1,
  capabilityId: string,
  profile: WritingCapabilityProfileV1 | undefined,
): WritingCapabilityRoutingDecisionV1 {
  if (!profile) {
    return {
      capability_id: capabilityId,
      status: 'rejected',
      reason_code: 'unknown_capability',
      message: `Capability "${capabilityId}" is not registered`,
    };
  }
  const metadata = {
    profile_enabled: false as const,
    profile_schema_version: profile.schema_version,
    source_commit: profile.source_commit,
  };
  if (profile.forbidden_video_types.includes(request.video_type)) {
    return {
      capability_id: capabilityId,
      status: 'rejected',
      reason_code: 'video_type_forbidden',
      message: `Capability "${capabilityId}" explicitly forbids video type "${request.video_type}"`,
      ...metadata,
    };
  }
  if (!profile.allowed_video_types.includes(request.video_type)) {
    return {
      capability_id: capabilityId,
      status: 'rejected',
      reason_code: 'video_type_not_allowed',
      message: `Capability "${capabilityId}" does not allow video type "${request.video_type}"`,
      ...metadata,
    };
  }
  return {
    capability_id: capabilityId,
    status: 'rejected',
    reason_code: 'profile_disabled',
    message: `Capability "${capabilityId}" is eligible for "${request.video_type}" but remains disabled`,
    ...metadata,
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
