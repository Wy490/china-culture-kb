import { describe, expect, it } from 'vitest';
import {
  ProfessionalTextPackageSchema,
  ProfessionalTextTypeContractSchema,
  StoryGenerateRequestSchema,
} from '@shared/schemas.js';
import { VIDEO_TYPE_CONFIG, type VideoType } from '@shared/types.js';
import { getGenreStoryProfile } from '../services/genre-story-profiles.js';
import {
  PROFESSIONAL_TEXT_PACKAGE_FIELDS,
  PROFESSIONAL_TEXT_TYPE_CONTRACTS,
} from '../services/professional-text-contracts.js';
import { createProfessionalTextPackageSkeleton } from '../services/professional-text-package-service.js';

const VIDEO_TYPES = Object.keys(VIDEO_TYPE_CONFIG) as VideoType[];

describe('ProfessionalTextPackage contracts', () => {
  it('defines a schema-valid type-specific contract for all 15 VideoTypes', () => {
    expect(VIDEO_TYPES).toHaveLength(15);
    expect(Object.keys(PROFESSIONAL_TEXT_TYPE_CONTRACTS)).toHaveLength(15);

    for (const videoType of VIDEO_TYPES) {
      const profile = getGenreStoryProfile(videoType);
      const contract = profile.professional_text_contract;
      const parsed = ProfessionalTextTypeContractSchema.safeParse(contract);

      expect(parsed.success, `${videoType}: ${parsed.error?.message ?? ''}`).toBe(true);
      expect(contract.video_type).toBe(videoType);
      expect(contract.required_package_fields).toEqual(PROFESSIONAL_TEXT_PACKAGE_FIELDS);
      expect(new Set(contract.required_package_fields).size).toBe(16);
      expect(contract.required_deliverables.length).toBeGreaterThanOrEqual(5);
      expect(contract.exclusive_quality_gate.length).toBeGreaterThan(0);
      expect(Object.values(contract.quality_dimension_weights)
        .reduce((sum, value) => sum + value, 0)).toBe(100);
      expect(contract.hard_gates.length).toBeGreaterThanOrEqual(9);
      expect(contract.repair_focus.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('creates a schema-valid skeleton for every type without claiming professional quality', () => {
    for (const videoType of VIDEO_TYPES) {
      const skeleton = createProfessionalTextPackageSkeleton({
        video_type: videoType,
        package_id: `professional-${videoType}`,
        target_duration: '3分钟',
        now: '2026-07-10T16:00:00.000Z',
      });
      const parsed = ProfessionalTextPackageSchema.safeParse(skeleton);

      expect(parsed.success, `${videoType}: ${parsed.error?.message ?? ''}`).toBe(true);
      expect(skeleton.status).toBe('skeleton');
      expect(skeleton.quality_report.status).toBe('not_evaluated');
      expect(skeleton.quality_report.professional_passed).toBe(false);
      expect(skeleton.quality_report.dimensions).toHaveLength(10);
      expect(skeleton.quality_report.dimensions.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
      expect(skeleton.delivery_text_package.validation_notes).toContain('skeleton_only_not_professional_pass');
      expect(skeleton.coverage_report.action_items).toHaveLength(
        PROFESSIONAL_TEXT_TYPE_CONTRACTS[videoType].required_deliverables.length,
      );
    }
  });

  it('blocks false approval and keeps legacy StoryGenerateRequest input compatible', () => {
    const skeleton = createProfessionalTextPackageSkeleton({
      video_type: 'character_story',
      package_id: 'professional-character-story',
      now: '2026-07-10T16:00:00.000Z',
    });
    expect(ProfessionalTextPackageSchema.safeParse({ ...skeleton, status: 'approved' }).success).toBe(false);
    expect(ProfessionalTextPackageSchema.safeParse({
      ...skeleton,
      quality_report: {
        ...skeleton.quality_report,
        professional_passed: true,
        hard_gate_failures: ['事实边界失败'],
      },
    }).success).toBe(false);

    expect(StoryGenerateRequestSchema.safeParse({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story',
    }).success).toBe(true);
  });
});
