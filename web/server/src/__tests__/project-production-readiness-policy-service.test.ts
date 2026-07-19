import { describe, expect, it } from 'vitest';
import type {
  GearsJobLedger,
  GearsJobLedgerItem,
  ProductionReadinessIssue,
  ProductionReadinessLane,
  ProductionReadinessNextAction,
  SeedanceShotLedgerItem,
} from '@shared/types.js';
import {
  activeLocalGearsJobCount,
  buildProductionReadinessSummary,
  productionReadinessDeliveryScore,
  productionReadinessGearsScore,
  productionReadinessGearsStatus,
  productionReadinessShotScore,
  productionReadinessShotStatus,
  seedanceShotProductionStatusCounts,
  summarizeProductionReadinessGears,
} from '../services/project-production-readiness-policy-service.js';
import { LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL } from '../services/gears-external-artifact-policy-service.js';

function gearsItem(overrides: Partial<GearsJobLedgerItem> = {}): GearsJobLedgerItem {
  return {
    ledger_id: 'ledger-1',
    gears_job_id: 'gears-1',
    job_type: 'seedance_video',
    source_unit_id: 'shot-1',
    status: 'ready',
    artifact_urls: [],
    submitted_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:01:00.000Z',
    ...overrides,
  };
}

function ledger(items: GearsJobLedgerItem[]): GearsJobLedger {
  return {
    schema_version: 'gears-job-ledger/v1',
    updated_at: '2026-07-20T00:01:00.000Z',
    items,
  };
}

describe('project production readiness policy service', () => {
  it('keeps local acceptance, external output and missing artifacts in separate accounts', () => {
    const input = ledger([
      gearsItem({
        gears_job_id: 'local-gears-seedance_video-shot-1-1',
        artifact_urls: [`${LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL}/shot-1.mp4`],
        artifacts: [{
          url: `${LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL}/shot-1.mp4`,
          role: 'local_acceptance',
        }],
      }),
      gearsItem({
        ledger_id: 'ledger-2',
        gears_job_id: 'external-gears-2',
        source_unit_id: 'shot-2',
        artifact_urls: ['https://cdn.example.com/shot-2.mp4'],
      }),
      gearsItem({
        ledger_id: 'ledger-3',
        gears_job_id: 'external-gears-3',
        source_unit_id: 'shot-3',
      }),
      gearsItem({
        ledger_id: 'ledger-4',
        gears_job_id: 'local-gears-seedance_video-shot-4-1',
        source_unit_id: 'shot-4',
        status: 'processing',
      }),
    ]);

    expect(summarizeProductionReadinessGears(input)).toMatchObject({
      total: 4,
      active: 1,
      ready: 3,
      external_ready: 1,
      local_acceptance_ready: 1,
      local_acceptance_active: 1,
      ready_without_external_artifact: 2,
      missing_artifact: 1,
    });
    expect(activeLocalGearsJobCount(input)).toBe(1);
  });

  it('never promotes local-only acceptance to externally ready', () => {
    const localSummary = summarizeProductionReadinessGears(ledger([
      gearsItem({
        gears_job_id: 'local-gears-seedance_video-shot-1-1',
        artifact_urls: [`${LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL}/shot-1.mp4`],
      }),
    ]));
    const externalSummary = summarizeProductionReadinessGears(ledger([
      gearsItem({ artifact_urls: ['https://cdn.example.com/shot-1.mp4'] }),
    ]));

    expect(productionReadinessGearsStatus(localSummary)).toBe('needs_action');
    expect(productionReadinessGearsScore(localSummary)).toBe(65);
    expect(productionReadinessGearsStatus(externalSummary)).toBe('ready');
    expect(productionReadinessGearsScore(externalSummary)).toBe(100);
  });

  it('keeps shot status and scoring rules stable', () => {
    const items = [
      { status: 'ready' },
      { status: 'processing' },
      { status: 'failed' },
    ] as SeedanceShotLedgerItem[];

    expect(seedanceShotProductionStatusCounts(items)).toEqual({
      not_started: 0,
      prompt_exported: 0,
      submitted: 0,
      processing: 1,
      ready: 1,
      failed: 1,
      skipped: 0,
    });
    expect(productionReadinessShotStatus(2, 0, 1, 1)).toBe('needs_action');
    expect(productionReadinessShotScore(2, 1, 1, 0)).toBe(73);
    expect(productionReadinessShotStatus(3, 1, 0, 2)).toBe('blocked');
    expect(productionReadinessShotScore(0, 0, 0, 0)).toBe(20);
  });

  it('applies blocker and warning penalties after averaging lane scores', () => {
    const lanes = [
      { key: 'story_quality', status: 'ready', score: 100 },
      { key: 'gears_execution', status: 'needs_action', score: 80 },
    ] as ProductionReadinessLane[];
    const issues = [
      { issue_id: 'blocking-1', severity: 'blocking' },
      { issue_id: 'warning-1', severity: 'warning' },
    ] as ProductionReadinessIssue[];
    const nextActions = [
      { action_key: 'repair_quality', priority: 10 },
      { action_key: 'sync_gears_jobs', priority: 20 },
    ] as ProductionReadinessNextAction[];
    const gearsSummary = summarizeProductionReadinessGears(ledger([
      gearsItem({ artifact_urls: ['https://cdn.example.com/shot-1.mp4'] }),
    ]));

    expect(buildProductionReadinessSummary(lanes, issues, nextActions, { gearsSummary }))
      .toMatchObject({
        status: 'blocked',
        score: 82,
        ready_lane_count: 1,
        total_lane_count: 2,
        blocker_count: 1,
        warning_count: 1,
        next_action_count: 2,
        external_ready_gears_job_count: 1,
      });
  });

  it('keeps delivery-stage scoring distinct from export persistence', () => {
    expect(productionReadinessDeliveryScore('ready', true)).toBe(100);
    expect(productionReadinessDeliveryScore('ready', false)).toBe(85);
    expect(productionReadinessDeliveryScore('needs_repair', true)).toBe(65);
    expect(productionReadinessDeliveryScore('blocked', false)).toBe(30);
  });
});
