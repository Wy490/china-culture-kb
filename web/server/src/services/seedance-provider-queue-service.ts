import type {
  SeedanceShotLedgerItem,
  SeedanceShotProductionStatus,
  SeedanceShotProviderPollTarget,
  SeedanceShotProviderQueue,
  SeedanceShotProviderQueueAttentionItem,
  SeedanceShotProviderQueueBatch,
  SeedanceShotProviderQueueBatchOverview,
  SeedanceShotProviderRecoverableStatus,
  SeedanceShotProviderRetryPlanCandidate,
  SeedanceShotProviderRetryPlanPriority,
  SeedanceShotProviderRetryPlanReason,
  StoryProductionBoard,
} from '@shared/types.js';

export const SEEDANCE_SHOT_PRODUCTION_STATUSES: readonly SeedanceShotProductionStatus[] = [
  'not_started',
  'prompt_exported',
  'submitted',
  'processing',
  'ready',
  'failed',
  'skipped',
];

export function appendSeedanceProviderQueueBatch(
  existing: SeedanceShotProviderQueue | undefined,
  batch: SeedanceShotProviderQueueBatch,
): SeedanceShotProviderQueue {
  const batches = [
    ...(existing?.batches ?? []).filter(item => item.queue_id !== batch.queue_id),
    batch,
  ].slice(-12);
  return {
    schema_version: 'seedance-provider-queue/v1',
    updated_at: batch.updated_at,
    latest_queue_id: batch.queue_id,
    batches,
  };
}

export function seedanceShotWaitingMinutes(item: SeedanceShotLedgerItem, nowMs: number): number {
  const timestamp = Date.parse(item.submitted_at ?? item.updated_at);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((nowMs - timestamp) / 60000));
}

export function seedanceProviderPollTargets(input: {
  board: StoryProductionBoard;
  statuses: Set<SeedanceShotProviderRecoverableStatus>;
  provider?: string;
  queueId?: string;
  shotIds?: Set<string>;
  limit: number;
  includePrompt: boolean;
  nowMs: number;
}): { checkedCount: number; targets: SeedanceShotProviderPollTarget[] } {
  const shotById = new Map(input.board.shot_units.map(shot => [shot.shot_id, shot]));
  const checkedItems = input.board.seedance_shot_ledger.items.filter(item => {
    if (!input.statuses.has(item.status as SeedanceShotProviderRecoverableStatus)) return false;
    if (input.provider && item.provider !== input.provider) return false;
    if (input.queueId && item.provider_queue_id !== input.queueId) return false;
    if (input.shotIds && !input.shotIds.has(item.shot_id)) return false;
    return true;
  });
  const targets = checkedItems
    .filter(item => Boolean(item.provider_job_id))
    .slice(0, input.limit)
    .map(item => {
      const shot = shotById.get(item.shot_id);
      return {
        shot_id: item.shot_id,
        source_scene_id: item.source_scene_id,
        status: item.status as SeedanceShotProviderRecoverableStatus,
        provider: item.provider,
        provider_job_id: item.provider_job_id,
        provider_queue_id: item.provider_queue_id,
        provider_queue_position: item.provider_queue_position,
        submitted_at: item.submitted_at,
        updated_at: item.updated_at,
        minutes_waiting: seedanceShotWaitingMinutes(item, input.nowMs),
        retry_count: item.retry_count,
        seedance_prompt: input.includePrompt ? shot?.seedance_prompt : undefined,
      };
    });
  return { checkedCount: checkedItems.length, targets };
}

export function seedanceProviderEmptyStatusCounts(): Record<SeedanceShotProductionStatus, number> {
  return Object.fromEntries(
    SEEDANCE_SHOT_PRODUCTION_STATUSES.map(status => [status, 0]),
  ) as Record<SeedanceShotProductionStatus, number>;
}

export function seedanceProviderIsActiveStatus(status: SeedanceShotProductionStatus): boolean {
  return status === 'submitted' || status === 'processing';
}

export function seedanceProviderMatchesOverviewFilter(input: {
  item: SeedanceShotLedgerItem;
  provider?: string;
  queueId?: string;
}): boolean {
  if (input.provider && input.item.provider !== input.provider) return false;
  if (input.queueId && input.item.provider_queue_id !== input.queueId) return false;
  return true;
}

export function seedanceProviderBatchOverview(input: {
  batch: SeedanceShotProviderQueueBatch;
  ledgerByShotId: Map<string, SeedanceShotLedgerItem>;
  timeoutMinutes: number;
  nowMs: number;
}): SeedanceShotProviderQueueBatchOverview {
  let activeCount = 0;
  let readyCount = 0;
  let failedItemCount = 0;
  let timedOutCount = 0;
  for (const batchItem of input.batch.items) {
    const ledgerItem = input.ledgerByShotId.get(batchItem.shot_id);
    const status = ledgerItem?.status ?? batchItem.status;
    if (seedanceProviderIsActiveStatus(status)) {
      activeCount += 1;
      const minutesWaiting = ledgerItem
        ? seedanceShotWaitingMinutes(ledgerItem, input.nowMs)
        : Math.max(0, Math.floor((input.nowMs - Date.parse(batchItem.queued_at)) / 60000));
      if (minutesWaiting >= input.timeoutMinutes) {
        timedOutCount += 1;
      }
    }
    if (status === 'ready') readyCount += 1;
    if (status === 'failed') failedItemCount += 1;
  }
  return {
    queue_id: input.batch.queue_id,
    provider: input.batch.provider,
    priority: input.batch.priority,
    created_at: input.batch.created_at,
    updated_at: input.batch.updated_at,
    note: input.batch.note,
    item_count: input.batch.items.length,
    submitted_count: input.batch.submitted_count,
    skipped_count: input.batch.skipped_count,
    failed_count: input.batch.failed_count,
    active_count: activeCount,
    ready_count: readyCount,
    failed_item_count: failedItemCount,
    timed_out_count: timedOutCount,
  };
}

export function seedanceProviderAttentionItem(input: {
  item: SeedanceShotLedgerItem;
  timeoutMinutes: number;
  nowMs: number;
}): SeedanceShotProviderQueueAttentionItem {
  const minutesWaiting = seedanceShotWaitingMinutes(input.item, input.nowMs);
  const timedOut = seedanceProviderIsActiveStatus(input.item.status)
    && minutesWaiting >= input.timeoutMinutes;
  return {
    shot_id: input.item.shot_id,
    source_scene_id: input.item.source_scene_id,
    status: input.item.status,
    provider: input.item.provider,
    provider_job_id: input.item.provider_job_id,
    provider_queue_id: input.item.provider_queue_id,
    provider_queue_position: input.item.provider_queue_position,
    submitted_at: input.item.submitted_at,
    updated_at: input.item.updated_at,
    minutes_waiting: minutesWaiting,
    timed_out: timedOut,
    retry_count: input.item.retry_count,
    video_url: input.item.video_url,
    failure_reason: input.item.failure_reason,
    failure_category: input.item.failure_category,
    provider_error_code: input.item.provider_error_code,
    suggested_action: seedanceShotRetrySuggestedAction(input.item),
  };
}

export function seedanceProviderNeedsAttention(item: SeedanceShotProviderQueueAttentionItem): boolean {
  if (item.timed_out) return true;
  if (item.status === 'submitted' || item.status === 'processing' || item.status === 'failed') return true;
  if (item.status === 'ready' && !item.video_url) return true;
  return false;
}

export function seedanceProviderAttentionSort(
  a: SeedanceShotProviderQueueAttentionItem,
  b: SeedanceShotProviderQueueAttentionItem,
): number {
  const rank = (item: SeedanceShotProviderQueueAttentionItem) => {
    if (item.timed_out) return 0;
    if (item.status === 'failed') return 1;
    if (item.status === 'processing') return 2;
    if (item.status === 'submitted') return 3;
    if (item.status === 'ready') return 4;
    return 5;
  };
  return rank(a) - rank(b)
    || b.minutes_waiting - a.minutes_waiting
    || (a.provider_queue_position ?? 0) - (b.provider_queue_position ?? 0)
    || (a.source_scene_id ?? 0) - (b.source_scene_id ?? 0)
    || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN');
}

export function seedanceProviderEmptyRetryReasonCounts(): Record<SeedanceShotProviderRetryPlanReason, number> {
  return {
    failed: 0,
    timed_out: 0,
    ready_missing_video: 0,
    unsubmitted: 0,
  };
}

function seedanceProviderRetryBlockReason(item: SeedanceShotLedgerItem): string | undefined {
  if (item.status === 'ready' && !item.video_url) return '状态已完成但缺少视频 URL，建议先向平台补拉结果。';
  if (item.failure_category === 'asset_missing') return '素材缺失，补齐或重新绑定素材后再提交。';
  if (item.failure_category === 'prompt_invalid') return '提示词或参数非法，修正 Seedance 提示词后再提交。';
  if (item.failure_category === 'content_policy') return '内容审核未通过，调整敏感或版权相关表达后再提交。';
  if (item.failure_category === 'provider_quota') return 'provider 额度或余额不足，恢复额度后再提交。';
  if (item.failure_category === 'provider_auth') return 'provider 鉴权或权限失败，修复凭证后再提交。';
  return undefined;
}

export function seedanceProviderRetryReason(input: {
  item: SeedanceShotLedgerItem;
  timeoutMinutes: number;
  nowMs: number;
  includeUnsubmitted: boolean;
}): SeedanceShotProviderRetryPlanReason | undefined {
  if (input.item.status === 'failed') return 'failed';
  if (
    seedanceProviderIsActiveStatus(input.item.status)
    && seedanceShotWaitingMinutes(input.item, input.nowMs) >= input.timeoutMinutes
  ) {
    return 'timed_out';
  }
  if (input.item.status === 'ready' && !input.item.video_url) return 'ready_missing_video';
  if (
    input.includeUnsubmitted
    && (input.item.status === 'not_started' || input.item.status === 'prompt_exported')
  ) {
    return 'unsubmitted';
  }
  return undefined;
}

function seedanceProviderRetryPriority(
  reason: SeedanceShotProviderRetryPlanReason,
  item: SeedanceShotLedgerItem,
): SeedanceShotProviderRetryPlanPriority {
  if (reason === 'timed_out') return 'high';
  if (reason === 'failed') {
    if (
      item.failure_category === 'provider_timeout'
      || item.failure_category === 'provider_rate_limit'
      || item.failure_category === 'provider_server_error'
      || item.failure_category === 'network_error'
    ) {
      return 'high';
    }
    return 'normal';
  }
  if (reason === 'ready_missing_video') return 'normal';
  return 'low';
}

export function seedanceProviderRetryCandidate(input: {
  item: SeedanceShotLedgerItem;
  reason: SeedanceShotProviderRetryPlanReason;
  timeoutMinutes: number;
  nowMs: number;
  maxRetryCount?: number;
}): SeedanceShotProviderRetryPlanCandidate {
  const blockReason = seedanceProviderRetryBlockReason(input.item);
  const maxRetryBlocked = typeof input.maxRetryCount === 'number'
    && input.item.retry_count >= input.maxRetryCount;
  const canResubmit = !blockReason && !maxRetryBlocked && input.reason !== 'ready_missing_video';
  return {
    shot_id: input.item.shot_id,
    source_scene_id: input.item.source_scene_id,
    status: input.item.status,
    retry_reason: input.reason,
    priority: seedanceProviderRetryPriority(input.reason, input.item),
    provider: input.item.provider,
    provider_job_id: input.item.provider_job_id,
    provider_queue_id: input.item.provider_queue_id,
    provider_queue_position: input.item.provider_queue_position,
    submitted_at: input.item.submitted_at,
    updated_at: input.item.updated_at,
    minutes_waiting: seedanceShotWaitingMinutes(input.item, input.nowMs),
    retry_count: input.item.retry_count,
    failure_reason: input.item.failure_reason,
    failure_category: input.item.failure_category,
    provider_error_code: input.item.provider_error_code,
    suggested_action: seedanceShotRetrySuggestedAction(input.item),
    can_resubmit: canResubmit,
    block_reason: maxRetryBlocked
      ? `已达到最大重试次数 ${input.maxRetryCount}`
      : blockReason,
  };
}

export function seedanceProviderRetryCandidateSort(
  a: SeedanceShotProviderRetryPlanCandidate,
  b: SeedanceShotProviderRetryPlanCandidate,
): number {
  const priorityRank: Record<SeedanceShotProviderRetryPlanPriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
  };
  return priorityRank[a.priority] - priorityRank[b.priority]
    || Number(b.can_resubmit) - Number(a.can_resubmit)
    || b.minutes_waiting - a.minutes_waiting
    || (a.provider_queue_position ?? 0) - (b.provider_queue_position ?? 0)
    || (a.source_scene_id ?? 0) - (b.source_scene_id ?? 0)
    || a.shot_id.localeCompare(b.shot_id, 'zh-Hans-CN');
}

export function seedanceShotRetrySuggestedAction(item?: SeedanceShotLedgerItem): string {
  if (!item) return '尚未提交，按原提示词提交生成。';
  if (item.status === 'failed') {
    if (item.failure_category === 'asset_missing') return '先补齐或重新绑定缺失素材，再重新提交。';
    if (item.failure_category === 'prompt_invalid') return '先精简或修正 Seedance 提示词，再重新提交。';
    if (item.failure_category === 'content_policy') return '先调整敏感画面、人物或版权相关表达，再重新提交。';
    if (item.failure_category === 'provider_timeout') return '先确认平台任务是否仍在处理；超时无结果时重新提交。';
    if (item.failure_category === 'provider_quota') return '先确认 provider 额度或余额，再重新提交。';
    if (item.failure_category === 'provider_auth') return '先检查 provider 凭证和权限配置，再重新提交。';
    if (item.failure_category === 'provider_rate_limit') return '等待限流窗口恢复后再重新提交。';
    if (item.failure_category === 'provider_server_error' || item.failure_category === 'network_error') {
      return '稍后重试；若连续失败，保留错误码并切换 provider 或人工检查。';
    }
    return item.retry_count > 0 ? '检查失败原因后再次提交，必要时微调负向约束。' : '按原提示词重新提交一次。';
  }
  if (item.status === 'ready' && !item.video_url) return '状态已完成但缺少视频 URL，优先向平台补拉结果。';
  if (item.status === 'processing' || item.status === 'submitted') return '确认平台任务是否超时；如无结果则重新提交。';
  if (item.status === 'prompt_exported' || item.status === 'not_started') return '按提示词提交生成。';
  return '人工复核后决定是否重试。';
}
