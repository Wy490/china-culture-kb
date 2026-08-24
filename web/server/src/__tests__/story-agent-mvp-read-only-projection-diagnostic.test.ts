import { describe, expect, it } from 'vitest';
import type { StoryAgentMvpStatusReport } from '@shared/types.js';
import {
  buildStoryAgentMvpReadOnlyProjectionDiagnostic,
  validateStoryAgentMvpReadOnlyProjectionDiagnosticReport,
} from '../../scripts/story-agent-mvp-read-only-projection-diagnostic.mjs';

function mvpStatus(overrides: Record<string, number> = {}): StoryAgentMvpStatusReport {
  return {
    schema_version: 'story-agent-mvp-status/v1',
    status: 'needs_action',
    performance: {
      total_ms: 120,
      generated_health_ms: 40,
      supplement_task_snapshot_ms: 10,
      supplement_package_ms: 1,
      generated_governance_ms: 1,
      backlog_handoff_ms: 1,
      production_material_pack_ms: 1,
      domain_pack_ms: 1,
      domain_pack_expansion_ms: 1,
      knowledge_writeback_ms: 1,
      production_portfolio_ms: 60,
      external_evidence_sync_health_ms: 5,
      supplement_backlog_ms: 1,
      project_projection_list_repository_call_count: 1,
      project_projection_list_cache_hit_count: 2,
      project_projection_current_state_repository_call_count: 1,
      project_projection_current_state_cache_hit_count: 5,
      project_projection_current_state_seeded_count: 2,
      project_projection_current_state_seed_rejected_count: 0,
      project_projection_readable_project_count: 3,
      project_projection_failed_project_count: 0,
      ...overrides,
    },
    generated_health: {
      summary: {
        scanned_story_project_count: 3,
        scanned_series_project_count: 2,
      },
    },
    external_evidence_sync_health: {
      machine_read_only: true,
      project_store_modified: false,
      source_story_store_modified: false,
      external_evidence_credit_granted: false,
      summary: {
        scanned_project_count: 3,
      },
    },
    production_portfolio: {
      summary: {
        total_target_count: 5,
        story_project_count: 3,
        ai_comic_series_count: 2,
      },
      errors: [],
      performance: {
        wall_clock_observation_not_sla: true,
        configured_read_concurrency: 8,
        target_discovery_ms: 5,
        readiness_scan_ms: 50,
        summary_assembly_ms: 2,
        markdown_render_ms: 1,
        total_ms: 58,
        story_project_target_count: 3,
        ai_comic_series_target_count: 2,
        story_project_cumulative_readiness_work_ms: 100,
        ai_comic_series_cumulative_readiness_work_ms: 80,
      },
    },
  } as unknown as StoryAgentMvpStatusReport;
}

describe('Story Agent MVP read-only projection diagnostic', () => {
  it('passes deterministic projection equations while treating wall clock as observation only', () => {
    const report = buildStoryAgentMvpReadOnlyProjectionDiagnostic({
      capturedAt: '2026-08-24T15:00:00.000Z',
      wallClockMs: 125,
      mvpStatus: mvpStatus(),
      storeFingerprintBefore: 'a'.repeat(64),
      storeFingerprintAfter: 'a'.repeat(64),
      sourceFingerprints: { 'src/services/example.ts': 'b'.repeat(64) },
    });

    expect(report).toMatchObject({
      schema_version: 'story-agent-mvp-read-only-projection-diagnostic/v1',
      status: 'passed',
      wall_clock_observation_not_sla: true,
      machine_read_only: true,
      project_store_modified: false,
      source_story_store_modified: false,
      province_markdown_modified: false,
      external_evidence_credit_granted: false,
      inventory: {
        story_project_count: 3,
        series_project_count: 2,
        sync_health_scanned_project_count: 3,
      },
      projection: {
        list_repository_call_count: 1,
        list_cache_hit_count: 2,
        current_state_seeded_count: 2,
        current_state_repository_call_count: 1,
        current_state_cache_hit_count: 5,
        readable_project_count: 3,
        failed_project_count: 0,
      },
      production_portfolio_observations: {
        configured_read_concurrency: 8,
        story_project_target_count: 3,
        ai_comic_series_target_count: 2,
      },
    });
    expect(report.checks.every(check => check.passed)).toBe(true);
    expect(report.report_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateStoryAgentMvpReadOnlyProjectionDiagnosticReport(report, {
      sourceFingerprints: report.source_fingerprints,
      storeFingerprint: report.store_fingerprint.after_sha256,
    })).toEqual([]);
  });

  it('fails when cache reuse no longer matches three-consumer projection semantics', () => {
    const report = buildStoryAgentMvpReadOnlyProjectionDiagnostic({
      capturedAt: '2026-08-24T15:00:00.000Z',
      wallClockMs: 125,
      mvpStatus: mvpStatus({ project_projection_current_state_cache_hit_count: 4 }),
      storeFingerprintBefore: 'a'.repeat(64),
      storeFingerprintAfter: 'a'.repeat(64),
      sourceFingerprints: { 'src/services/example.ts': 'b'.repeat(64) },
    });

    expect(report.status).toBe('failed');
    expect(report.checks).toContainEqual(expect.objectContaining({
      check_id: 'current_state_cache_reuse_equation',
      passed: false,
    }));
  });
});
