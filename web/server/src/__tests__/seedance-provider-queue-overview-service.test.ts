import { describe, expect, it } from 'vitest';
import type {
  SeedanceShotLedger,
  SeedanceShotLedgerItem,
  SeedanceShotProviderQueue,
  SeedanceShotProviderQueueBatch,
  StoryProjectMeta,
} from '@shared/types.js';
import { buildSeedanceProviderQueueOverview } from '../services/seedance-provider-queue-overview-service.js';

const GENERATED_AT = '2026-07-20T04:00:00.000Z';

function ledgerItem(overrides: Partial<SeedanceShotLedgerItem> = {}): SeedanceShotLedgerItem {
  return {
    production_id: 'seedance-shot-shot-1',
    shot_id: 'shot-1',
    source_scene_id: 1,
    status: 'submitted',
    updated_at: '2026-07-20T00:00:00.000Z',
    submitted_at: '2026-07-20T00:00:00.000Z',
    provider: 'provider-a',
    provider_job_id: 'provider-job-1',
    provider_queue_id: 'queue-a',
    provider_queue_position: 1,
    retry_count: 0,
    notes: [],
    versions: [],
    ...overrides,
  };
}

function ledger(items: SeedanceShotLedgerItem[]): SeedanceShotLedger {
  return {
    schema_version: 'seedance-shot-ledger/v1',
    updated_at: GENERATED_AT,
    items,
  };
}

function batch(overrides: Partial<SeedanceShotProviderQueueBatch> = {}): SeedanceShotProviderQueueBatch {
  return {
    queue_id: 'queue-a',
    provider: 'provider-a',
    priority: 'normal',
    created_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:00:00.000Z',
    submitted_count: 2,
    skipped_count: 0,
    failed_count: 0,
    items: [
      {
        shot_id: 'shot-1',
        source_scene_id: 1,
        status: 'submitted',
        provider_job_id: 'provider-job-1',
        queue_position: 1,
        queued_at: '2026-07-20T00:00:00.000Z',
      },
      {
        shot_id: 'shot-2',
        source_scene_id: 2,
        status: 'submitted',
        provider_job_id: 'provider-job-2',
        queue_position: 2,
        queued_at: '2026-07-20T03:30:00.000Z',
      },
    ],
    ...overrides,
  };
}

function queue(overrides: Partial<SeedanceShotProviderQueue> = {}): SeedanceShotProviderQueue {
  return {
    schema_version: 'seedance-provider-queue/v1',
    updated_at: '2026-07-20T03:00:00.000Z',
    latest_queue_id: 'missing-latest',
    batches: [
      batch(),
      batch({
        queue_id: 'queue-b',
        created_at: '2026-07-20T02:00:00.000Z',
        updated_at: '2026-07-20T03:00:00.000Z',
        items: [],
        submitted_count: 0,
      }),
    ],
    ...overrides,
  };
}

function project(overrides: Partial<StoryProjectMeta> = {}): StoryProjectMeta {
  return {
    project_id: 'project-1',
    title: 'Provider 队列概览测试',
    seedance_provider_queue: queue(),
    ...overrides,
  } as StoryProjectMeta;
}

function representativeLedger(): SeedanceShotLedger {
  return ledger([
    ledgerItem(),
    ledgerItem({
      production_id: 'seedance-shot-shot-2',
      shot_id: 'shot-2',
      source_scene_id: 2,
      status: 'processing',
      submitted_at: '2026-07-20T03:30:00.000Z',
      updated_at: '2026-07-20T03:30:00.000Z',
      provider_job_id: 'provider-job-2',
      provider_queue_position: 2,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-3',
      shot_id: 'shot-3',
      source_scene_id: 3,
      status: 'ready',
      video_url: 'https://cdn.vendor.cn/shot-3.mp4',
      provider_job_id: 'provider-job-3',
      provider_queue_position: 3,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-4',
      shot_id: 'shot-4',
      source_scene_id: 4,
      status: 'ready',
      video_url: undefined,
      provider_job_id: 'provider-job-4',
      provider_queue_position: 4,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-5',
      shot_id: 'shot-5',
      source_scene_id: 5,
      status: 'failed',
      failure_category: 'provider_timeout',
      failure_reason: 'timeout',
      provider_job_id: 'provider-job-5',
      provider_queue_position: 5,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-6',
      shot_id: 'shot-6',
      source_scene_id: 6,
      status: 'skipped',
      provider_job_id: 'provider-job-6',
      provider_queue_position: 6,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-7',
      shot_id: 'shot-7',
      provider: 'provider-b',
      provider_queue_id: 'queue-z',
      provider_job_id: 'provider-job-7',
    }),
  ]);
}

describe('Seedance provider queue overview service', () => {
  it('summarizes matching ledger status, retryability, timeouts, missing video, and attention', () => {
    const overview = buildSeedanceProviderQueueOverview({
      project: project(),
      ledger: representativeLedger(),
      request: { provider: ' provider-a ', timeout_minutes: 120 },
      generatedAt: GENERATED_AT,
    });

    expect(overview).toMatchObject({
      provider: 'provider-a',
      generated_at: GENERATED_AT,
      timeout_minutes: 120,
      total_shot_count: 6,
      status_counts: {
        not_started: 0,
        prompt_exported: 0,
        submitted: 1,
        processing: 1,
        ready: 2,
        failed: 1,
        skipped: 1,
      },
      active_count: 2,
      ready_count: 2,
      failed_count: 1,
      retryable_count: 4,
      timed_out_count: 1,
      missing_video_count: 1,
      attention_count: 4,
    });
    expect(overview.attention_items.map(item => item.shot_id)).toEqual([
      'shot-1',
      'shot-5',
      'shot-2',
      'shot-4',
    ]);
  });

  it('includes completed identified jobs only when requested', () => {
    const overview = buildSeedanceProviderQueueOverview({
      project: project(),
      ledger: representativeLedger(),
      request: { provider: 'provider-a', include_completed: true },
      generatedAt: GENERATED_AT,
    });

    expect(overview.attention_count).toBe(6);
    expect(overview.attention_items.map(item => item.shot_id)).toEqual(expect.arrayContaining([
      'shot-3',
      'shot-6',
    ]));
  });

  it('uses current ledger state for batches and falls back to the newest updated batch', () => {
    const overview = buildSeedanceProviderQueueOverview({
      project: project(),
      ledger: representativeLedger(),
      request: { provider: 'provider-a', timeout_minutes: 120 },
      generatedAt: GENERATED_AT,
    });

    expect(overview.queue_batches.map(item => item.queue_id)).toEqual(['queue-a', 'queue-b']);
    expect(overview.queue_batches[0]).toMatchObject({
      active_count: 2,
      ready_count: 0,
      timed_out_count: 1,
    });
    expect(overview.latest_queue_batch?.queue_id).toBe('queue-b');
  });

  it('applies queue filtering to ledger items and batches consistently', () => {
    const overview = buildSeedanceProviderQueueOverview({
      project: project(),
      ledger: representativeLedger(),
      request: { provider: 'provider-a', queue_id: ' queue-a ' },
      generatedAt: GENERATED_AT,
    });

    expect(overview.queue_id).toBe('queue-a');
    expect(overview.total_shot_count).toBe(6);
    expect(overview.batch_count).toBe(1);
    expect(overview.queue_batches[0].queue_id).toBe('queue-a');
    expect(overview.latest_queue_batch?.queue_id).toBe('queue-a');
  });
});
