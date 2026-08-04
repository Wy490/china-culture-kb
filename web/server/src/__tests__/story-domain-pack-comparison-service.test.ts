import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  STORY_AGENT_15_TYPE_MATRIX_CASES,
  storyAgentMatrixGenerationRequest,
} from '../services/story-agent-15-type-matrix-service.js';
import { buildStoryDomainPack15TypeComparison } from '../services/story-domain-pack-comparison-service.js';

beforeAll(() => {
  process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
});

describe('story-domain-pack-comparison-service', () => {
  it('builds a 15-type machine-only prompt counterfactual with no human or production credit', async () => {
    const report = await buildStoryDomainPack15TypeComparison({
      generatedAt: '2026-08-04T00:00:00.000+08:00',
      cases: STORY_AGENT_15_TYPE_MATRIX_CASES.map(matrixCase => ({
        case_id: `canonical-${matrixCase.video_type}`,
        request: storyAgentMatrixGenerationRequest(matrixCase),
      })),
    });

    expect(report).toMatchObject({
      schema_version: 'story-domain-pack-15-type-comparison/v1',
      status: 'passed',
      mode: 'machine_pre_generation_counterfactual',
      selection_policy: 'cultural_safety_then_type_specific_then_production_ready_diversity/v1',
      coverage: {
        type_count: 15,
        trace_covered_type_count: 15,
        prompt_delta_type_count: 15,
        readiness_score_stable_type_count: 15,
        expected_pack_matched_type_count: 15,
      },
      invariants: {
        every_video_type_present: true,
        every_type_has_domain_pack_trace: true,
        every_type_has_expected_domain_pack: true,
        every_active_prompt_has_guidance: true,
        every_control_prompt_suppresses_guidance: true,
        every_readiness_score_is_stable: true,
      },
      boundary: {
        machine_comparison_only: true,
        external_model_invoked: false,
        story_output_quality_measured: false,
        human_review_complete: false,
        real_production_credit_granted: false,
      },
    });
    expect(report.items).toHaveLength(15);
    expect(new Set(report.items.map(item => item.video_type)).size).toBe(15);
    expect(report.items.every(item => item.selected_pack_names.length > 0)).toBe(true);
    expect(report.items.every(item => item.expected_pack_names.length > 0)).toBe(true);
    expect(report.items.every(item => item.missing_expected_pack_names.length === 0)).toBe(true);
    expect(report.items.every(item => item.active_guidance_line_count > 0)).toBe(true);
    expect(report.items.every(item => item.control_guidance_line_count === 0)).toBe(true);
    expect(report.items.every(item => item.prompt_added_guidance_line_count > 0)).toBe(true);
    expect(report.items.every(item => item.readiness_score_delta === 0)).toBe(true);
  });
});
