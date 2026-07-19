import type {
  SeedanceShotLedger,
  SeedanceShotProviderRetryPlanCandidate,
  SeedanceShotProviderRetryPlanReason,
  SeedanceShotProviderRetryPlanRequest,
  SeedanceShotProviderRetryPlanResult,
  StoryProjectMeta,
} from '@shared/types.js';
import { seedanceShotStatusText } from './seedance-provider-callback-policy-service.js';
import {
  seedanceProviderEmptyRetryReasonCounts,
  seedanceProviderMatchesOverviewFilter,
  seedanceProviderRetryCandidate,
  seedanceProviderRetryCandidateSort,
  seedanceProviderRetryReason,
} from './seedance-provider-queue-service.js';

export function selectSeedanceProviderRetryPlanCandidates(input: {
  ledger: SeedanceShotLedger;
  request: SeedanceShotProviderRetryPlanRequest;
  generatedAt: string;
}): {
  provider?: string;
  queueId?: string;
  timeoutMinutes: number;
  candidates: SeedanceShotProviderRetryPlanCandidate[];
  reasonCounts: Record<SeedanceShotProviderRetryPlanReason, number>;
} {
  const provider = input.request.provider?.trim() || undefined;
  const queueId = input.request.queue_id?.trim() || undefined;
  const timeoutMinutes = input.request.timeout_minutes ?? 120;
  const nowMs = Date.parse(input.generatedAt);
  const failureCategories = input.request.failure_categories?.length
    ? new Set(input.request.failure_categories)
    : undefined;
  const candidates = input.ledger.items
    .filter(item => seedanceProviderMatchesOverviewFilter({ item, provider, queueId }))
    .filter(item =>
      !failureCategories
      || Boolean(item.failure_category && failureCategories.has(item.failure_category))
    )
    .reduce<SeedanceShotProviderRetryPlanCandidate[]>((items, item) => {
      const reason = seedanceProviderRetryReason({
        item,
        timeoutMinutes,
        nowMs,
        includeUnsubmitted: Boolean(input.request.include_unsubmitted),
      });
      if (!reason) return items;
      items.push(seedanceProviderRetryCandidate({
        item,
        reason,
        timeoutMinutes,
        nowMs,
        maxRetryCount: input.request.max_retry_count,
      }));
      return items;
    }, [])
    .sort(seedanceProviderRetryCandidateSort);
  const reasonCounts = seedanceProviderEmptyRetryReasonCounts();
  candidates.forEach(candidate => {
    reasonCounts[candidate.retry_reason] += 1;
  });
  return {
    provider,
    queueId,
    timeoutMinutes,
    candidates,
    reasonCounts,
  };
}

export function buildSeedanceProviderRetryPlan(input: {
  project: StoryProjectMeta;
  ledger: SeedanceShotLedger;
  request: SeedanceShotProviderRetryPlanRequest;
  generatedAt: string;
}): SeedanceShotProviderRetryPlanResult {
  const selection = selectSeedanceProviderRetryPlanCandidates({
    ledger: input.ledger,
    request: input.request,
    generatedAt: input.generatedAt,
  });
  const basePlan: Omit<SeedanceShotProviderRetryPlanResult, 'markdown'> = {
    project: input.project,
    seedance_shot_ledger: input.ledger,
    provider: selection.provider,
    queue_id: selection.queueId,
    generated_at: input.generatedAt,
    timeout_minutes: selection.timeoutMinutes,
    max_retry_count: input.request.max_retry_count,
    candidate_count: selection.candidates.length,
    resubmittable_count: selection.candidates.filter(candidate => candidate.can_resubmit).length,
    blocked_count: selection.candidates.filter(candidate => !candidate.can_resubmit).length,
    high_priority_count: selection.candidates.filter(candidate => candidate.priority === 'high').length,
    reason_counts: selection.reasonCounts,
    candidates: selection.candidates,
  };
  return {
    ...basePlan,
    markdown: buildSeedanceProviderRetryPlanMarkdown(basePlan),
  };
}

export function seedanceProviderRetryReasonText(reason: SeedanceShotProviderRetryPlanReason): string {
  const map: Record<SeedanceShotProviderRetryPlanReason, string> = {
    failed: '失败回片',
    timed_out: '等待超时',
    ready_missing_video: '完成但缺视频',
    unsubmitted: '尚未提交',
  };
  return map[reason];
}

export function buildSeedanceProviderRetryPlanMarkdown(
  plan: Omit<SeedanceShotProviderRetryPlanResult, 'markdown'>,
): string {
  const lines = [
    `# ${plan.project.title} — Seedance provider 人工重试策略`,
    '',
    `> projectId: ${plan.project.project_id}`,
    `> generatedAt: ${plan.generated_at}`,
    `> provider: ${plan.provider ?? '全部'}`,
    `> queueId: ${plan.queue_id ?? '全部'}`,
    `> timeoutMinutes: ${plan.timeout_minutes}`,
    typeof plan.max_retry_count === 'number'
      ? `> maxRetryCount: ${plan.max_retry_count}`
      : '> maxRetryCount: 未限制',
    '',
    '## 摘要',
    '',
    `- 候选镜头: ${plan.candidate_count}`,
    `- 可直接重提: ${plan.resubmittable_count}`,
    `- 需先处理: ${plan.blocked_count}`,
    `- 高优先级: ${plan.high_priority_count}`,
    `- 原因分布: 失败 ${plan.reason_counts.failed}；超时 ${plan.reason_counts.timed_out}；缺视频 ${plan.reason_counts.ready_missing_video}；未提交 ${plan.reason_counts.unsubmitted}`,
    '',
    '## 候选镜头',
  ];
  if (!plan.candidates.length) {
    lines.push('', '- 暂无需要人工重试的镜头。');
    return lines.join('\n');
  }
  for (const item of plan.candidates) {
    lines.push(
      '',
      `### ${item.shot_id} / 场景 ${item.source_scene_id ?? '未记录'}`,
      '',
      `- 优先级: ${item.priority}`,
      `- 原因: ${seedanceProviderRetryReasonText(item.retry_reason)}`,
      `- 状态: ${seedanceShotStatusText(item.status)}`,
      `- 可直接重提: ${item.can_resubmit ? '是' : '否'}`,
      item.block_reason ? `- 阻断原因: ${item.block_reason}` : '- 阻断原因: 无',
      `- 等待时间: ${item.minutes_waiting} 分钟`,
      `- 重试次数: ${item.retry_count}`,
      `- provider job: ${item.provider_job_id ?? '未记录'}`,
      `- queue: ${item.provider_queue_id ?? '未记录'}${item.provider_queue_position ? ` #${item.provider_queue_position}` : ''}`,
      `- 失败分类: ${item.failure_category ?? '未分类'}`,
      `- Provider 错误码: ${item.provider_error_code ?? '未记录'}`,
      `- 失败原因: ${item.failure_reason ?? '未记录'}`,
      `- 建议动作: ${item.suggested_action}`,
    );
  }
  return lines.join('\n');
}
