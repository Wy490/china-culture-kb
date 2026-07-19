import { describe, expect, it } from 'vitest';
import type { GearsJobLedger, GearsJobLedgerItem } from '@shared/types.js';
import { normalizeGearsJobCallback } from '../services/gears-execution-service.js';
import {
  localGearsAcceptanceArtifactUrl,
  projectGearsSyncItems,
  projectGearsLocalAcceptanceItems,
  updateGearsLedgerItemFromCallback,
} from '../services/project-gears-ledger-application-service.js';

function ledgerItem(overrides: Partial<GearsJobLedgerItem> = {}): GearsJobLedgerItem {
  return {
    ledger_id: 'ledger-1',
    gears_job_id: 'job-1',
    job_type: 'seedance_video',
    source_unit_id: 'shot-1',
    status: 'submitted',
    progress_percent: 10,
    artifact_urls: [],
    submitted_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:01:00.000Z',
    ...overrides,
  };
}

function ledger(items: GearsJobLedgerItem[]): GearsJobLedger {
  return { schema_version: 'gears-job-ledger/v1', items };
}

describe('project GEARS ledger application service', () => {
  it('filters sync candidates by type, source/job id and terminal policy before applying the limit', () => {
    const result = projectGearsSyncItems({
      ledger: ledger([
        ledgerItem(),
        ledgerItem({ ledger_id: 'ledger-2', gears_job_id: 'job-2', source_unit_id: 'shot-2' }),
        ledgerItem({ ledger_id: 'ledger-3', gears_job_id: 'job-3', source_unit_id: 'shot-3', status: 'ready' }),
        ledgerItem({
          ledger_id: 'ledger-4',
          gears_job_id: 'job-4',
          job_type: 'character_image',
          source_unit_id: 'character-1',
        }),
      ]),
      request: {
        job_type: 'seedance_video',
        source_unit_ids: ['shot-1', 'job-2', 'shot-3'],
        limit: 1,
      },
    });

    expect(result.items.map(item => item.gears_job_id)).toEqual(['job-1']);
    expect(result.skippedCount).toBe(1);
  });

  it('can include completed jobs explicitly', () => {
    const result = projectGearsSyncItems({
      ledger: ledger([
        ledgerItem({ status: 'ready' }),
        ledgerItem({ ledger_id: 'ledger-2', gears_job_id: 'job-2', source_unit_id: 'shot-2', status: 'failed' }),
      ]),
      request: { include_completed: true },
    });

    expect(result.items.map(item => item.status)).toEqual(['ready', 'failed']);
    expect(result.skippedCount).toBe(0);
  });

  it('ignores a non-terminal callback after a terminal ledger state', () => {
    const item = ledgerItem({
      status: 'ready',
      progress_percent: 100,
      artifact_urls: ['https://cdn.vendor.cn/original.mp4'],
      completed_at: '2026-07-20T00:05:00.000Z',
      last_poll_error: 'old poll error',
    });
    const callback = normalizeGearsJobCallback({
      jobId: 'job-1',
      sourceUnitId: 'shot-1',
      taskStatus: 'PROCESSING',
      progressPercent: 45,
      outputUrl: 'https://cdn.vendor.cn/regressed.mp4',
      eventId: 'event-regression-1',
    });

    const updated = updateGearsLedgerItemFromCallback({
      item,
      callback,
      receivedAt: '2026-07-20T00:10:00.000Z',
    });

    expect(updated).toMatchObject({
      status: 'ready',
      progress_percent: 100,
      artifact_urls: ['https://cdn.vendor.cn/original.mp4'],
      completed_at: '2026-07-20T00:05:00.000Z',
      last_poll_error: undefined,
      updated_at: '2026-07-20T00:10:00.000Z',
    });
    expect(updated.callback_events?.at(-1)).toMatchObject({
      event_id: 'event-regression-1',
      status: 'processing',
      applied_status: 'ready',
      status_regression_ignored: true,
    });
  });

  it('applies a terminal-to-terminal state change with new failure context', () => {
    const item = ledgerItem({
      status: 'ready',
      progress_percent: 100,
      artifact_urls: ['https://cdn.vendor.cn/shot-1.mp4'],
      completed_at: '2026-07-20T00:05:00.000Z',
    });
    const callback = normalizeGearsJobCallback({
      jobId: 'job-1',
      sourceUnitId: 'shot-1',
      taskStatus: 'FAILED',
      failureCategory: 'content_policy',
      errorCode: 'RISK_CONTROL',
      error: 'provider revoked output',
      eventId: 'event-terminal-change-1',
    });

    const updated = updateGearsLedgerItemFromCallback({
      item,
      callback,
      receivedAt: '2026-07-20T00:11:00.000Z',
    });

    expect(updated).toMatchObject({
      status: 'failed',
      failure_category: 'content_policy',
      error_code: 'RISK_CONTROL',
      failure_reason: 'provider revoked output',
      completed_at: '2026-07-20T00:11:00.000Z',
    });
    expect(updated.callback_events?.at(-1)).toMatchObject({
      terminal_status_changed: true,
      previous_status: 'ready',
      applied_status: 'failed',
    });
  });

  it('defaults ready progress to 100 and preserves completion time for repeated terminal status', () => {
    const first = updateGearsLedgerItemFromCallback({
      item: ledgerItem(),
      callback: normalizeGearsJobCallback({
        jobId: 'job-1',
        sourceUnitId: 'shot-1',
        taskStatus: 'SUCCEEDED',
        outputUrl: 'https://cdn.vendor.cn/shot-1.mp4',
        eventId: 'event-ready-1',
      }),
      receivedAt: '2026-07-20T00:05:00.000Z',
    });
    const repeated = updateGearsLedgerItemFromCallback({
      item: first,
      callback: normalizeGearsJobCallback({
        jobId: 'job-1',
        sourceUnitId: 'shot-1',
        taskStatus: 'SUCCEEDED',
        eventId: 'event-ready-2',
      }),
      receivedAt: '2026-07-20T00:10:00.000Z',
    });

    expect(first).toMatchObject({
      status: 'ready',
      progress_percent: 100,
      completed_at: '2026-07-20T00:05:00.000Z',
    });
    expect(repeated.completed_at).toBe(first.completed_at);
  });

  it('builds local acceptance URLs from explicit mappings before the encoded fallback', () => {
    const item = ledgerItem({ source_unit_id: 'shot / 1' });

    expect(localGearsAcceptanceArtifactUrl({
      projectId: 'project / 1',
      item,
      request: {
        artifact_url_map: {
          'shot / 1': 'https://local.example.test/by-source.mp4',
          'job-1': 'https://local.example.test/by-job.mp4',
        },
      },
    })).toBe('https://local.example.test/by-source.mp4');
    expect(localGearsAcceptanceArtifactUrl({
      projectId: 'project / 1',
      item,
      request: { artifact_base_url: 'https://local.example.test/base/' },
    })).toBe('https://local.example.test/base/project%20%2F%201/shot%20%2F%201.mp4');
  });

  it('excludes external jobs from local acceptance unless explicitly requested', () => {
    const input = ledger([
      ledgerItem({ gears_job_id: 'local-gears-seedance_video-shot-1-1' }),
      ledgerItem({ ledger_id: 'ledger-2', gears_job_id: 'external-job-2', source_unit_id: 'shot-2' }),
      ledgerItem({
        ledger_id: 'ledger-3',
        gears_job_id: 'local-gears-seedance_video-shot-3-1',
        source_unit_id: 'shot-3',
        status: 'ready',
      }),
    ]);

    expect(projectGearsLocalAcceptanceItems({ ledger: input, request: {} })).toMatchObject({
      items: [expect.objectContaining({ gears_job_id: 'local-gears-seedance_video-shot-1-1' })],
      skippedCount: 1,
    });
    expect(projectGearsLocalAcceptanceItems({
      ledger: input,
      request: { include_external_jobs: true },
    }).items.map(item => item.gears_job_id)).toEqual([
      'local-gears-seedance_video-shot-1-1',
      'external-job-2',
    ]);
  });
});
