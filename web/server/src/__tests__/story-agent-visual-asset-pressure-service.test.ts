import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildStoryAgentVisualAssetPressureReport,
  type StoryAgentVisualAssetPressureCase,
  type StoryAgentVisualAssetPressureScenarioResult,
} from '../services/story-agent-visual-asset-pressure-service.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function pressureCase(index: number): StoryAgentVisualAssetPressureCase {
  const caseId = `visual-case-${index}`;
  const character = `人物-${index}`;
  const location = `场景-${index}`;
  const prop = `道具-${index}`;
  const semanticContext = [character, location, prop, `风格锚点-${index}`];
  return {
    case_id: caseId,
    source_id: `source-${index}`,
    title: `多样素材案例 ${index}`,
    style_family: `style-${index}`,
    character_labels: [character],
    location_labels: [location],
    assets: [
      {
        asset_id: `${caseId}-character`,
        label: character,
        kind: 'character',
        prompt: `${character}位于${location}，风格锚点-${index}`,
        prompt_sha256: sha256(`${character}位于${location}，风格锚点-${index}`),
        content_sha256: sha256(`${caseId}:character`),
        required_visual_anchors: [character, location],
        forbidden_visual_anchors: ['跨案例污染'],
        semantic_context: semanticContext,
        source_content_sha256_verified: true,
        media_signature_verified: true,
        immutable_preview_verified: true,
        identity_mapping_current: true,
      },
      {
        asset_id: `${caseId}-location`,
        label: location,
        kind: 'location',
        prompt: `${location}包含${prop}，风格锚点-${index}`,
        prompt_sha256: sha256(`${location}包含${prop}，风格锚点-${index}`),
        content_sha256: sha256(`${caseId}:location`),
        required_visual_anchors: [location, prop],
        forbidden_visual_anchors: ['跨案例污染'],
        semantic_context: semanticContext,
        source_content_sha256_verified: true,
        media_signature_verified: true,
        immutable_preview_verified: true,
        identity_mapping_current: true,
      },
    ],
  };
}

function passedScenarios(): StoryAgentVisualAssetPressureScenarioResult[] {
  return [
    'missing_file_rejected',
    'invalid_image_rejected',
    'content_sha256_mismatch_rejected',
    'partial_import_preserved',
    'failed_task_retry_recovered',
    'identity_replacement_staled',
  ].map(scenario => ({
    scenario: scenario as StoryAgentVisualAssetPressureScenarioResult['scenario'],
    status: 'passed' as const,
    evidence_refs: [`test:${scenario}`],
  }));
}

describe('story-agent visual asset pressure service', () => {
  it('accepts four materially distinct visual worlds with complete recovery evidence', () => {
    const report = buildStoryAgentVisualAssetPressureReport({
      cases: [1, 2, 3, 4].map(pressureCase),
      scenario_results: passedScenarios(),
      generated_at: '2026-07-25T13:00:00.000Z',
    });

    expect(report).toMatchObject({
      schema_version: 'story-agent-visual-asset-pressure-report/v1',
      status: 'ready',
      coverage: {
        case_count: 4,
        unique_source_id_count: 4,
        unique_style_family_count: 4,
        unique_character_label_count: 4,
        unique_location_label_count: 4,
        unique_content_sha256_count: 8,
        cross_case_content_reuse_count: 0,
        semantic_gate_passed_case_count: 4,
        source_content_sha256_verified_asset_count: 8,
        media_signature_verified_asset_count: 8,
        immutable_preview_verified_asset_count: 8,
        identity_mapping_current_asset_count: 8,
      },
      scenario_summary: {
        required_count: 6,
        passed_count: 6,
      },
      machine_validation_only: true,
      image_provider_invoked_by_server: false,
      production_credit_granted: false,
    });
    expect(report.blockers).toEqual([]);
  });

  it('blocks reused bytes across worlds, prompt pollution, stale hashes, and missing scenarios', () => {
    const cases = [1, 2, 3, 4].map(pressureCase);
    cases[1].assets[0].content_sha256 = cases[0].assets[0].content_sha256;
    cases[2].assets[0].prompt = '质量报告：应该使用内部分析结论';
    cases[3].assets[0].semantic_context.push('跨案例污染');
    const scenarios = passedScenarios().filter(
      item => item.scenario !== 'failed_task_retry_recovered',
    );

    const report = buildStoryAgentVisualAssetPressureReport({
      cases,
      scenario_results: scenarios,
      generated_at: '2026-07-25T13:05:00.000Z',
    });

    expect(report.status).toBe('blocked');
    expect(report.coverage.cross_case_content_reuse_count).toBe(1);
    expect(report.blockers.join('\n')).toContain('cross_case_content_reuse');
    expect(report.blockers.join('\n')).toContain('prompt_sha256_mismatch');
    expect(report.blockers.join('\n')).toContain('prompt_pollution');
    expect(report.blockers.join('\n')).toContain('forbidden_visual_anchor');
    expect(report.blockers.join('\n')).toContain('failed_task_retry_recovered:not_run');
  });
});
