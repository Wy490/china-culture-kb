import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  VideoTypeSchema,
  WritingCapabilityRoutingRequestV1Schema,
  WritingCapabilityRoutingReportV1Schema,
} from '@shared/schemas.js';
import {
  WRITING_CAPABILITY_PROFILES,
} from '../services/writing-capability-registry.js';
import {
  WritingCapabilityRouterError,
  routeWritingCapabilities,
} from '../services/writing-capability-router.js';

const CAPABILITY_IDS = [
  'continuity_state_tracking',
  'reader_simulation_review',
  'short_drama_develop_write_review',
];

describe('writing-capability-router/v1', () => {
  it('returns an empty frozen decision report when no capability is requested', () => {
    const report = routeWritingCapabilities({
      schema_version: 'writing-capability-routing-request/v1',
      video_type: 'ai_comic_drama',
      requested_capability_ids: [],
    });

    expect(WritingCapabilityRoutingReportV1Schema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      schema_version: 'writing-capability-routing-report/v1',
      video_type: 'ai_comic_drama',
      requested_capability_ids: [],
      active_capability_ids: [],
      decisions: [],
      summary: {
        requested_count: 0,
        decision_count: 0,
        active_count: 0,
        eligible_but_disabled_count: 0,
        incompatible_count: 0,
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
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.decisions)).toBe(true);
  });

  it('sorts requested capabilities and rejects applicable profiles because all remain disabled', () => {
    const report = routeWritingCapabilities({
      schema_version: 'writing-capability-routing-request/v1',
      video_type: 'ai_comic_drama',
      requested_capability_ids: [...CAPABILITY_IDS].reverse(),
    });

    expect(report.requested_capability_ids).toEqual(CAPABILITY_IDS);
    expect(report.active_capability_ids).toEqual([]);
    expect(report.decisions.map(decision => decision.capability_id)).toEqual(CAPABILITY_IDS);
    expect(report.decisions.every(decision => (
      decision.status === 'rejected'
      && decision.reason_code === 'profile_disabled'
      && decision.profile_enabled === false
      && decision.profile_schema_version === 'writing-capability-profile/v1'
      && /^[a-f0-9]{40}$/.test(decision.source_commit ?? '')
    ))).toBe(true);
    expect(report.summary).toMatchObject({
      requested_count: 3,
      decision_count: 3,
      active_count: 0,
      eligible_but_disabled_count: 3,
      incompatible_count: 0,
    });
  });

  it('rejects forbidden video types before reporting the disabled flag', () => {
    const continuity = routeWritingCapabilities({
      schema_version: 'writing-capability-routing-request/v1',
      video_type: 'culture_promo',
      requested_capability_ids: ['continuity_state_tracking'],
    });
    const reader = routeWritingCapabilities({
      schema_version: 'writing-capability-routing-request/v1',
      video_type: 'scene_short',
      requested_capability_ids: ['reader_simulation_review'],
    });
    const shortDrama = routeWritingCapabilities({
      schema_version: 'writing-capability-routing-request/v1',
      video_type: 'children_story',
      requested_capability_ids: ['short_drama_develop_write_review'],
    });

    for (const report of [continuity, reader, shortDrama]) {
      expect(report.decisions[0]).toMatchObject({
        status: 'rejected',
        reason_code: 'video_type_forbidden',
      });
      expect(report.summary).toMatchObject({
        eligible_but_disabled_count: 0,
        incompatible_count: 1,
      });
    }
  });

  it('fails closed for duplicate requests and reports an unknown capability without invention', () => {
    expect(WritingCapabilityRoutingRequestV1Schema.safeParse({
      schema_version: 'writing-capability-routing-request/v1',
      video_type: 'ai_comic_drama',
      requested_capability_ids: [
        'continuity_state_tracking',
        'continuity_state_tracking',
      ],
    }).success).toBe(false);
    expect(() => routeWritingCapabilities({
      schema_version: 'writing-capability-routing-request/v1',
      video_type: 'ai_comic_drama',
      requested_capability_ids: [
        'continuity_state_tracking',
        'continuity_state_tracking',
      ],
    })).toThrow(WritingCapabilityRouterError);

    const unknown = routeWritingCapabilities({
      schema_version: 'writing-capability-routing-request/v1',
      video_type: 'ai_comic_drama',
      requested_capability_ids: ['unknown_capability'],
    });
    expect(unknown.decisions).toEqual([{
      capability_id: 'unknown_capability',
      status: 'rejected',
      reason_code: 'unknown_capability',
      message: 'Capability "unknown_capability" is not registered',
    }]);
  });

  it('freezes a deterministic 15×3 default-off matrix with no active capability', () => {
    let profileDisabledCount = 0;
    let forbiddenCount = 0;
    const fingerprints: string[] = [];

    for (const videoType of VideoTypeSchema.options) {
      const first = routeWritingCapabilities({
        schema_version: 'writing-capability-routing-request/v1',
        video_type: videoType,
        requested_capability_ids: CAPABILITY_IDS,
      });
      const second = routeWritingCapabilities({
        schema_version: 'writing-capability-routing-request/v1',
        video_type: videoType,
        requested_capability_ids: [...CAPABILITY_IDS].reverse(),
      });

      expect(second).toEqual(first);
      expect(first.active_capability_ids).toEqual([]);
      expect(first.decisions).toHaveLength(3);
      profileDisabledCount += first.decisions.filter(
        decision => decision.reason_code === 'profile_disabled',
      ).length;
      forbiddenCount += first.decisions.filter(
        decision => decision.reason_code === 'video_type_forbidden',
      ).length;
      fingerprints.push(JSON.stringify(first));
    }

    expect(new Set(fingerprints)).toHaveLength(15);
    expect(profileDisabledCount).toBe(20);
    expect(forbiddenCount).toBe(25);
    expect(WRITING_CAPABILITY_PROFILES.every(profile => profile.enabled === false)).toBe(true);
  });

  it('does not enter blueprint, prompt, fallback, quality, repair or persistence', async () => {
    const [router, blueprint, prompt, fallback, quality, repair, generation] = await Promise.all([
      readFile(new URL('../services/writing-capability-router.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-blueprint-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-generation-prompt.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/dramatic-story.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/genre-quality-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-repair-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(router).toContain('runtime_enablement_supported: false');
    for (const source of [blueprint, prompt, fallback, quality, repair, generation]) {
      expect(source).not.toContain('writing-capability-router');
      expect(source).not.toContain('WritingCapabilityRoutingReportV1');
    }
  });

  it('publishes a reproducible 15×3 default-off routing baseline', async () => {
    const report = JSON.parse(await readFile(
      new URL('../../../../data/reports/story-agent-writing-capability-m2-routing-baseline.json', import.meta.url),
      'utf8',
    )) as Record<string, unknown>;

    expect(report).toMatchObject({
      schema_version: 'writing-capability-routing-baseline/v1',
      status: 'passed',
      video_type_count: 15,
      profile_count: 3,
      decision_count: 45,
      active_capability_count: 0,
      reason_counts: {
        unknown_capability: 0,
        video_type_forbidden: 25,
        video_type_not_allowed: 0,
        profile_disabled: 20,
      },
      matrix_sha256: '6d59efae036581f08ca61e0429436e5327ec0ffa12d2a1cfbe868df1e118d432',
      invariants: {
        covers_all_15_video_types: true,
        covers_all_3_profiles_per_type: true,
        every_profile_default_disabled: true,
        active_capability_count_is_zero: true,
        applicable_routes_are_explicitly_disabled: true,
        incompatible_routes_are_explicitly_forbidden: true,
        no_profile_rules_injected: true,
        no_generation_effect: true,
      },
      boundary: {
        report_only: true,
        affects_generation: false,
        runtime_enablement_supported: false,
        third_party_code_executed: false,
        external_execution_allowed: false,
      },
    });
  });
});
