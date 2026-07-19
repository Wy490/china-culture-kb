import type {
  SeedanceShotLedger,
  SeedanceShotProviderQueueOverviewRequest,
  SeedanceShotProviderQueueOverviewResult,
  StoryProjectMeta,
} from '@shared/types.js';
import {
  seedanceProviderAttentionItem,
  seedanceProviderAttentionSort,
  seedanceProviderBatchOverview,
  seedanceProviderEmptyStatusCounts,
  seedanceProviderIsActiveStatus,
  seedanceProviderMatchesOverviewFilter,
  seedanceProviderNeedsAttention,
  seedanceShotWaitingMinutes,
} from './seedance-provider-queue-service.js';
import { shouldRetrySeedanceShot } from './seedance-retry-package-service.js';

export function buildSeedanceProviderQueueOverview(input: {
  project: StoryProjectMeta;
  ledger: SeedanceShotLedger;
  request: SeedanceShotProviderQueueOverviewRequest;
  generatedAt: string;
}): SeedanceShotProviderQueueOverviewResult {
  const provider = input.request.provider?.trim();
  const queueId = input.request.queue_id?.trim();
  const timeoutMinutes = input.request.timeout_minutes ?? 120;
  const nowMs = Date.parse(input.generatedAt);
  const ledgerItems = input.ledger.items.filter(item =>
    seedanceProviderMatchesOverviewFilter({ item, provider, queueId })
  );
  const ledgerByShotId = new Map(input.ledger.items.map(item => [item.shot_id, item]));
  const statusCounts = seedanceProviderEmptyStatusCounts();
  ledgerItems.forEach(item => {
    statusCounts[item.status] += 1;
  });

  const queueBatches = (input.project.seedance_provider_queue?.batches ?? [])
    .filter(batch =>
      (!provider || batch.provider === provider)
      && (!queueId || batch.queue_id === queueId)
    )
    .map(batch => seedanceProviderBatchOverview({
      batch,
      ledgerByShotId,
      timeoutMinutes,
      nowMs,
    }))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const latestQueueId = input.project.seedance_provider_queue?.latest_queue_id;
  const latestQueueBatch = queueBatches.find(batch => batch.queue_id === latestQueueId)
    ?? [...queueBatches].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];

  const allAttentionItems = ledgerItems
    .map(item => seedanceProviderAttentionItem({ item, timeoutMinutes, nowMs }))
    .filter(item => (
      input.request.include_completed
        ? seedanceProviderNeedsAttention(item) || Boolean(item.provider_job_id || item.provider_queue_id)
        : seedanceProviderNeedsAttention(item)
    ))
    .sort(seedanceProviderAttentionSort);
  const timedOutCount = ledgerItems.filter(item =>
    seedanceProviderIsActiveStatus(item.status)
    && seedanceShotWaitingMinutes(item, nowMs) >= timeoutMinutes
  ).length;
  const missingVideoCount = ledgerItems.filter(item =>
    item.status === 'ready' && !item.video_url
  ).length;

  return {
    project: input.project,
    seedance_shot_ledger: input.ledger,
    seedance_provider_queue: input.project.seedance_provider_queue,
    provider,
    queue_id: queueId,
    generated_at: input.generatedAt,
    timeout_minutes: timeoutMinutes,
    total_shot_count: ledgerItems.length,
    status_counts: statusCounts,
    active_count: statusCounts.submitted + statusCounts.processing,
    ready_count: statusCounts.ready,
    failed_count: statusCounts.failed,
    retryable_count: ledgerItems.filter(item => shouldRetrySeedanceShot(item)).length,
    timed_out_count: timedOutCount,
    missing_video_count: missingVideoCount,
    attention_count: allAttentionItems.length,
    batch_count: queueBatches.length,
    latest_queue_batch: latestQueueBatch,
    queue_batches: queueBatches,
    attention_items: allAttentionItems,
  };
}
