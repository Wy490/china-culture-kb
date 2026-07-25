import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getStoryAgentVisualAssetPressureOpsStatus,
  storyAgentVisualAssetPressureReportPath,
} from '../services/story-agent-visual-asset-pressure-ops-service.js';

const roots: string[] = [];
const REQUIRED_SCENARIOS = [
  'missing_file_rejected',
  'invalid_image_rejected',
  'content_sha256_mismatch_rejected',
  'partial_import_preserved',
  'failed_task_retry_recovered',
  'identity_replacement_staled',
] as const;

async function testRoot(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'story-agent-visual-pressure-ops-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('Story Agent visual asset pressure ops status', () => {
  it('returns not_run without inventing pressure evidence when the canonical report is missing', async () => {
    const generatedRoot = await testRoot();

    await expect(getStoryAgentVisualAssetPressureOpsStatus({ generatedRoot })).resolves.toMatchObject({
      schema_version: 'story-agent-visual-asset-pressure-ops-status/v1',
      status: 'not_run',
      report: {
        relative_path: 'system/story-agent-visual-asset-pressure/report.json',
        file_exists: false,
        schema_valid: false,
      },
      blockers: ['visual_asset_pressure_report_missing'],
      machine_validation_only: true,
      image_provider_invoked_by_server: false,
      video_generation_performed: false,
      production_credit_granted: false,
    });
  });

  it('summarizes the canonical report without duplicating case or scenario detail', async () => {
    const generatedRoot = await testRoot();
    const reportPath = storyAgentVisualAssetPressureReportPath(generatedRoot);
    await mkdir(resolve(reportPath, '..'), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify({
      schema_version: 'story-agent-visual-asset-pressure-report/v1',
      status: 'ready',
      generated_at: '2026-07-25T12:00:00.000Z',
      coverage: {
        case_count: 4,
        unique_source_id_count: 4,
        unique_style_family_count: 4,
        unique_character_label_count: 6,
        unique_location_label_count: 4,
        unique_content_sha256_count: 8,
        cross_case_content_reuse_count: 0,
        semantic_gate_passed_case_count: 4,
        source_content_sha256_verified_asset_count: 18,
        media_signature_verified_asset_count: 18,
        immutable_preview_verified_asset_count: 18,
        identity_mapping_current_asset_count: 18,
      },
      scenario_summary: {
        required_count: 6,
        passed_count: 6,
        failed_count: 0,
        not_run_count: 0,
      },
      scenario_results: REQUIRED_SCENARIOS.map(scenario => ({
        scenario,
        status: 'passed',
        evidence_refs: [`test:${scenario}`],
      })),
      cases: Array.from({ length: 4 }, (_, index) => ({
        case_id: `case-${index + 1}`,
        asset_count: index < 2 ? 5 : 4,
        semantic_gate_passed: true,
        blockers: [],
      })),
      blockers: [],
      warnings: ['within_case_composite_asset_reuse:10'],
      machine_validation_only: true,
      image_provider_invoked_by_server: false,
      video_generation_performed: false,
      production_credit_granted: false,
    }, null, 2)}\n`, 'utf8');

    const status = await getStoryAgentVisualAssetPressureOpsStatus({ generatedRoot });

    expect(status).toMatchObject({
      schema_version: 'story-agent-visual-asset-pressure-ops-status/v1',
      status: 'ready',
      report: {
        relative_path: 'system/story-agent-visual-asset-pressure/report.json',
        file_exists: true,
        schema_valid: true,
        generated_at: '2026-07-25T12:00:00.000Z',
      },
      coverage: {
        case_count: 4,
        unique_content_sha256_count: 8,
        cross_case_content_reuse_count: 0,
      },
      scenario_summary: {
        required_count: 6,
        passed_count: 6,
      },
      blockers: [],
      warnings: ['within_case_composite_asset_reuse:10'],
    });
    expect(status).not.toHaveProperty('cases');
    expect(status).not.toHaveProperty('scenario_results');
  });

  it('fails closed when the canonical report is malformed', async () => {
    const generatedRoot = await testRoot();
    const reportPath = storyAgentVisualAssetPressureReportPath(generatedRoot);
    await mkdir(resolve(reportPath, '..'), { recursive: true });
    await writeFile(reportPath, '{"schema_version":"wrong"}\n', 'utf8');

    await expect(getStoryAgentVisualAssetPressureOpsStatus({ generatedRoot })).resolves.toMatchObject({
      status: 'blocked',
      report: {
        file_exists: true,
        schema_valid: false,
      },
      blockers: ['visual_asset_pressure_report_invalid'],
    });
  });
});
