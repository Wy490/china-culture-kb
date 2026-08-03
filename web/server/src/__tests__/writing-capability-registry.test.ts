import { describe, expect, it } from 'vitest';
import {
  WritingCapabilityCatalogReportV1Schema,
  WritingCapabilityProfileV1Schema,
} from '@shared/schemas.js';
import type { WritingCapabilityProfileV1 } from '@shared/types.js';
import {
  WRITING_CAPABILITY_PROFILES,
  WritingCapabilityRegistry,
  WritingCapabilityRegistryError,
  createWritingCapabilityRegistry,
  getWritingCapabilityCatalogReport,
} from '../services/writing-capability-registry.js';

function cloneProfile(
  profile: WritingCapabilityProfileV1 = WRITING_CAPABILITY_PROFILES[0],
): WritingCapabilityProfileV1 {
  return structuredClone(profile);
}

describe('WritingCapabilityProfileV1Schema', () => {
  it('requires complete static-adaptation provenance', () => {
    const profile = cloneProfile();
    const { provenance: _provenance, ...missingProvenance } = profile;

    expect(WritingCapabilityProfileV1Schema.safeParse(missingProvenance).success).toBe(false);
  });

  it('rejects overlapping allowed and forbidden video types', () => {
    const profile = cloneProfile();
    const conflicted = {
      ...profile,
      forbidden_video_types: [
        ...profile.forbidden_video_types,
        profile.allowed_video_types[0],
      ],
    };

    const result = WritingCapabilityProfileV1Schema.safeParse(conflicted);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.message.includes('allowed_video_types'))).toBe(true);
    }
  });

  it('requires an allowed type but permits an explicit empty forbidden list', () => {
    const profile = cloneProfile();

    expect(WritingCapabilityProfileV1Schema.safeParse({
      ...profile,
      allowed_video_types: [],
    }).success).toBe(false);
    expect(WritingCapabilityProfileV1Schema.safeParse({
      ...profile,
      forbidden_video_types: [],
    }).success).toBe(true);
  });

  it('requires a pinned full commit and a declared license', () => {
    const profile = cloneProfile();

    expect(WritingCapabilityProfileV1Schema.safeParse({
      ...profile,
      source_commit: 'main',
    }).success).toBe(false);
    expect(WritingCapabilityProfileV1Schema.safeParse({
      ...profile,
      license: '',
    }).success).toBe(false);
  });

  it('cannot declare third-party command, network, or file execution', () => {
    const profile = cloneProfile();

    for (const field of [
      'third_party_code_executed',
      'external_network_access_allowed',
      'external_file_write_allowed',
      'external_command_execution_allowed',
    ] as const) {
      expect(WritingCapabilityProfileV1Schema.safeParse({
        ...profile,
        provenance: {
          ...profile.provenance,
          [field]: true,
        },
      }).success).toBe(false);
    }

    expect(WritingCapabilityProfileV1Schema.safeParse({
      ...profile,
      execute: () => undefined,
    }).success).toBe(false);
  });
});

describe('WritingCapabilityRegistry', () => {
  it('registers the first three audited capabilities and keeps all disabled', () => {
    const registry = createWritingCapabilityRegistry();
    const profiles = registry.list();

    expect(profiles.map(profile => profile.capability_id)).toEqual([
      'continuity_state_tracking',
      'reader_simulation_review',
      'short_drama_develop_write_review',
    ]);
    expect(profiles.every(profile => profile.enabled === false)).toBe(true);
    expect(profiles.every(profile => /^[a-f0-9]{40}$/.test(profile.source_commit))).toBe(true);
  });

  it('rejects duplicate capability identifiers', () => {
    const profile = cloneProfile();
    const registry = new WritingCapabilityRegistry();

    registry.register(profile);

    expect(() => registry.register(profile)).toThrow(WritingCapabilityRegistryError);
  });

  it('exposes a deterministic read-only status report without generation integration', () => {
    const report = getWritingCapabilityCatalogReport();

    expect(WritingCapabilityCatalogReportV1Schema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      schema_version: 'writing-capability-catalog-report/v1',
      profile_schema_version: 'writing-capability-profile/v1',
      total_count: 3,
      enabled_count: 0,
      disabled_count: 3,
      boundary: {
        catalog_only: true,
        affects_generation: false,
        third_party_code_executed: false,
        external_execution_allowed: false,
      },
    });
    expect(report.capabilities).toHaveLength(3);
    expect(report.capabilities[0]).toMatchObject({
      capability_id: 'continuity_state_tracking',
      source_repository: 'https://github.com/danjdewhurst/story-skills',
      license: 'MIT',
      enabled: false,
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.capabilities)).toBe(true);
  });

  it('rejects a catalog report whose counts or capability identifiers drift', () => {
    const report = getWritingCapabilityCatalogReport();

    expect(WritingCapabilityCatalogReportV1Schema.safeParse({
      ...report,
      total_count: report.total_count + 1,
    }).success).toBe(false);
    expect(WritingCapabilityCatalogReportV1Schema.safeParse({
      ...report,
      capabilities: [
        ...report.capabilities,
        report.capabilities[0],
      ],
      total_count: report.total_count + 1,
      disabled_count: report.disabled_count + 1,
    }).success).toBe(false);
  });
});
