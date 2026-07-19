import { describe, expect, it } from 'vitest';
import type {
  SeedanceShotLedgerItem,
  SeedanceShotProviderQueueBatch,
  StoryProductionBoard,
} from '@shared/types.js';
import {
  seedanceProviderAttentionItem,
  seedanceProviderBatchOverview,
  seedanceProviderEmptyRetryReasonCounts,
  seedanceProviderEmptyStatusCounts,
  seedanceProviderNeedsAttention,
  seedanceProviderPollTargets,
  seedanceProviderRetryCandidate,
  seedanceProviderRetryReason,
  seedanceShotRetrySuggestedAction,
} from '../services/seedance-provider-queue-service.js';

const NOW = Date.parse('2026-07-20T00:20:00.000Z');

function ledgerItem(overrides: Partial<SeedanceShotLedgerItem> = {}): SeedanceShotLedgerItem {
  return {
    shot_id: 'shot-1',
    source_scene_id: 1,
    status: 'submitted',
    provider: 'seedance-fixture',
    provider_job_id: 'job-1',
    provider_queue_id: 'queue-1',
    provider_queue_position: 1,
    submitted_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:00:00.000Z',
    retry_count: 0,
    versions: [],
    ...overrides,
  } as SeedanceShotLedgerItem;
}

describe('seedance provider queue service', () => {
  it('counts all matching ledger items but only polls targets with provider job IDs', () => {
    const first = ledgerItem();
    const second = ledgerItem({
      shot_id: 'shot-2',
      source_scene_id: 2,
      provider_job_id: undefined,
    });
    const board = {
      shot_units: [
        { shot_id: 'shot-1', seedance_prompt: '第一镜提示词' },
        { shot_id: 'shot-2', seedance_prompt: '第二镜提示词' },
      ],
      seedance_shot_ledger: { items: [first, second] },
    } as StoryProductionBoard;

    const result = seedanceProviderPollTargets({
      board,
      statuses: new Set(['submitted']),
      provider: 'seedance-fixture',
      limit: 10,
      includePrompt: true,
      nowMs: NOW,
    });

    expect(result.checkedCount).toBe(2);
    expect(result.targets).toEqual([
      expect.objectContaining({
        shot_id: 'shot-1',
        provider_job_id: 'job-1',
        minutes_waiting: 20,
        seedance_prompt: '第一镜提示词',
      }),
    ]);
  });

  it('uses current ledger state when summarizing queue batches and timeouts', () => {
    const batch = {
      queue_id: 'queue-1',
      provider: 'seedance-fixture',
      priority: 'normal',
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
      item_count: 2,
      submitted_count: 2,
      skipped_count: 0,
      failed_count: 0,
      items: [
        {
          shot_id: 'shot-1',
          status: 'submitted',
          provider_job_id: 'job-1',
          queue_position: 1,
          queued_at: '2026-07-20T00:00:00.000Z',
        },
        {
          shot_id: 'shot-2',
          status: 'submitted',
          provider_job_id: 'job-2',
          queue_position: 2,
          queued_at: '2026-07-20T00:19:00.000Z',
        },
      ],
    } as SeedanceShotProviderQueueBatch;
    const ledgerByShotId = new Map([
      ['shot-1', ledgerItem({ status: 'processing' })],
      ['shot-2', ledgerItem({ shot_id: 'shot-2', status: 'ready', video_url: 'https://cdn.example.com/shot-2.mp4' })],
    ]);

    expect(seedanceProviderBatchOverview({ batch, ledgerByShotId, timeoutMinutes: 15, nowMs: NOW }))
      .toMatchObject({
        active_count: 1,
        ready_count: 1,
        failed_item_count: 0,
        timed_out_count: 1,
      });
  });

  it('marks timed-out and failed shots for operator attention with stable guidance', () => {
    const timedOut = seedanceProviderAttentionItem({
      item: ledgerItem({ status: 'processing' }),
      timeoutMinutes: 15,
      nowMs: NOW,
    });
    const assetFailure = ledgerItem({
      status: 'failed',
      failure_category: 'asset_missing',
      failure_reason: 'missing image',
    });

    expect(timedOut).toMatchObject({ timed_out: true, minutes_waiting: 20 });
    expect(seedanceProviderNeedsAttention(timedOut)).toBe(true);
    expect(seedanceShotRetrySuggestedAction(assetFailure)).toContain('补齐或重新绑定缺失素材');
  });

  it('keeps retry eligibility fail-closed for permanent input failures', () => {
    const item = ledgerItem({
      status: 'failed',
      failure_category: 'asset_missing',
      retry_count: 1,
    });
    const reason = seedanceProviderRetryReason({
      item,
      timeoutMinutes: 15,
      nowMs: NOW,
      includeUnsubmitted: false,
    });

    expect(reason).toBe('failed');
    expect(seedanceProviderRetryCandidate({
      item,
      reason: reason!,
      timeoutMinutes: 15,
      nowMs: NOW,
      maxRetryCount: 3,
    })).toMatchObject({
      priority: 'normal',
      can_resubmit: false,
      block_reason: '素材缺失，补齐或重新绑定素材后再提交。',
    });
  });

  it('returns complete zero-value status and retry reason counters', () => {
    expect(seedanceProviderEmptyStatusCounts()).toEqual({
      not_started: 0,
      prompt_exported: 0,
      submitted: 0,
      processing: 0,
      ready: 0,
      failed: 0,
      skipped: 0,
    });
    expect(seedanceProviderEmptyRetryReasonCounts()).toEqual({
      failed: 0,
      timed_out: 0,
      ready_missing_video: 0,
      unsubmitted: 0,
    });
  });
});
