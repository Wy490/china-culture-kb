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

function readyReport(caseCount = 8) {
  const caseAssetCounts = Array.from(
    { length: caseCount },
    (_, index) => index < 2 ? 5 : 4,
  );
  const totalAssetCount = caseAssetCounts.reduce((total, count) => total + count, 0);
  return {
    schema_version: 'story-agent-visual-asset-pressure-report/v1',
    status: 'ready',
    generated_at: '2026-07-25T12:00:00.000Z',
    coverage: {
      case_count: caseCount,
      unique_source_id_count: caseCount,
      unique_style_family_count: caseCount,
      unique_character_label_count: caseCount + 2,
      unique_location_label_count: caseCount,
      unique_content_sha256_count: caseCount * 2,
      cross_case_content_reuse_count: 0,
      semantic_gate_passed_case_count: caseCount,
      source_content_sha256_verified_asset_count: totalAssetCount,
      media_signature_verified_asset_count: totalAssetCount,
      immutable_preview_verified_asset_count: totalAssetCount,
      identity_mapping_current_asset_count: totalAssetCount,
    },
    scenario_summary: {
      required_count: 6,
      passed_count: 6,
      failed_count: 0,
      not_run_count: 0,
    },
    composition_provenance: {
      status: 'verified',
      report_relative_path: 'generated/combined/composition-report.json',
      registry_content_sha256: 'a'.repeat(64),
      batch_count: 2,
      file_count: 12,
      verified_file_count: 12,
      blockers: [] as string[],
    },
    scenario_results: REQUIRED_SCENARIOS.map(scenario => ({
      scenario,
      status: 'passed',
      evidence_refs: [`test:${scenario}`],
    })),
    cases: caseAssetCounts.map((assetCount, index) => ({
      case_id: `case-${index + 1}`,
      asset_count: assetCount,
      semantic_gate_passed: true,
      blockers: [],
    })),
    blockers: [],
    warnings: [`within_case_composite_asset_reuse:${totalAssetCount - caseCount * 2}`],
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}

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
      composition_provenance: {
        status: 'not_run',
        batch_count: 0,
        file_count: 0,
        verified_file_count: 0,
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
    await writeFile(reportPath, `${JSON.stringify(readyReport(), null, 2)}\n`, 'utf8');

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
        case_count: 8,
        unique_content_sha256_count: 16,
        cross_case_content_reuse_count: 0,
      },
      scenario_summary: {
        required_count: 6,
        passed_count: 6,
      },
      composition_provenance: {
        status: 'verified',
        batch_count: 2,
        file_count: 12,
        verified_file_count: 12,
      },
      blockers: [],
      warnings: ['within_case_composite_asset_reuse:18'],
    });
    expect(status).not.toHaveProperty('cases');
    expect(status).not.toHaveProperty('scenario_results');
    expect(status.composition_provenance).not.toHaveProperty('report_relative_path');
    expect(status.composition_provenance).not.toHaveProperty('registry_content_sha256');
    expect(status.composition_provenance).not.toHaveProperty('blockers');
  });

  it('fails closed when the canonical report regresses to the legacy four-world baseline', async () => {
    const generatedRoot = await testRoot();
    const reportPath = storyAgentVisualAssetPressureReportPath(generatedRoot);
    await mkdir(resolve(reportPath, '..'), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(readyReport(4), null, 2)}\n`, 'utf8');

    await expect(getStoryAgentVisualAssetPressureOpsStatus({ generatedRoot })).resolves.toMatchObject({
      status: 'blocked',
      coverage: {
        case_count: 4,
        unique_source_id_count: 4,
        unique_style_family_count: 4,
      },
      blockers: ['visual_asset_pressure_report_inconsistent'],
    });
  });

  it('fails closed when batch composition provenance is not fully verified', async () => {
    const generatedRoot = await testRoot();
    const reportPath = storyAgentVisualAssetPressureReportPath(generatedRoot);
    await mkdir(resolve(reportPath, '..'), { recursive: true });
    const report = readyReport();
    report.composition_provenance.status = 'blocked';
    report.composition_provenance.verified_file_count = 11;
    report.composition_provenance.blockers = [
      'composition_sha256_mismatch:generated/batch/manifest.json',
    ];
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    await expect(getStoryAgentVisualAssetPressureOpsStatus({ generatedRoot })).resolves.toMatchObject({
      status: 'blocked',
      composition_provenance: {
        status: 'blocked',
        batch_count: 2,
        file_count: 12,
        verified_file_count: 11,
      },
      blockers: ['visual_asset_pressure_report_inconsistent'],
    });
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
      composition_provenance: {
        status: 'blocked',
        batch_count: 0,
        file_count: 0,
        verified_file_count: 0,
      },
      blockers: ['visual_asset_pressure_report_invalid'],
    });
  });
});
