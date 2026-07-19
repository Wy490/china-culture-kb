import type {
  GearsExecutionJobStatus,
  GearsJobLedger,
  ProductionReadinessGearsSummary,
  ProductionReadinessIssue,
  ProductionReadinessLane,
  ProductionReadinessNextAction,
  ProductionReadinessStatus,
  SeedanceShotLedgerItem,
  SeedanceShotProductionStatus,
  StoryProductionBoard,
  StoryProjectProductionReadinessReport,
} from '@shared/types.js';
import { normalizeGearsJobLedger } from './gears-execution-service.js';
import { SEEDANCE_SHOT_PRODUCTION_STATUSES } from './seedance-provider-queue-service.js';
import {
  gearsJobHasExternalArtifact,
  gearsJobHasLocalAcceptanceArtifact,
} from './gears-external-artifact-policy-service.js';

const GEARS_EXECUTION_JOB_STATUSES: readonly GearsExecutionJobStatus[] = [
  'submitted',
  'queued',
  'processing',
  'ready',
  'failed',
  'canceled',
  'rejected',
];

export function seedanceShotProductionStatusCounts(
  items: SeedanceShotLedgerItem[],
): Record<SeedanceShotProductionStatus, number> {
  const counts = Object.fromEntries(
    SEEDANCE_SHOT_PRODUCTION_STATUSES.map(status => [status, 0]),
  ) as Record<SeedanceShotProductionStatus, number>;
  for (const item of items) {
    counts[item.status] += 1;
  }
  return counts;
}

export function summarizeProductionReadinessGears(
  ledger?: GearsJobLedger,
): ProductionReadinessGearsSummary {
  const normalized = normalizeGearsJobLedger(ledger);
  const statusCounts = Object.fromEntries(
    GEARS_EXECUTION_JOB_STATUSES.map(status => [status, 0]),
  ) as Record<GearsExecutionJobStatus, number>;
  let missingArtifact = 0;
  let pollFailure = 0;
  let externalReady = 0;
  let localAcceptanceReady = 0;
  let localAcceptanceActive = 0;
  for (const item of normalized.items) {
    statusCounts[item.status] += 1;
    const hasLocalAcceptance = gearsJobHasLocalAcceptanceArtifact(item);
    const hasExternalArtifact = gearsJobHasExternalArtifact(item);
    if (['submitted', 'queued', 'processing'].includes(item.status) && item.gears_job_id.startsWith('local-gears-')) {
      localAcceptanceActive += 1;
    }
    if (item.status === 'ready' && hasLocalAcceptance) {
      localAcceptanceReady += 1;
    }
    if (item.status === 'ready' && hasExternalArtifact) {
      externalReady += 1;
    }
    if (item.status === 'ready' && item.artifact_urls.length === 0 && (item.artifacts?.length ?? 0) === 0) {
      missingArtifact += 1;
    }
    if (item.last_poll_error) {
      pollFailure += 1;
    }
  }
  return {
    total: normalized.items.length,
    active: statusCounts.submitted + statusCounts.queued + statusCounts.processing,
    ready: statusCounts.ready,
    external_ready: externalReady,
    local_acceptance_ready: localAcceptanceReady,
    local_acceptance_active: localAcceptanceActive,
    ready_without_external_artifact: Math.max(0, statusCounts.ready - externalReady),
    failed: statusCounts.failed,
    rejected: statusCounts.rejected,
    canceled: statusCounts.canceled,
    missing_artifact: missingArtifact,
    poll_failure: pollFailure,
    status_counts: statusCounts,
  };
}

export function activeLocalGearsJobCount(ledger?: GearsJobLedger): number {
  return normalizeGearsJobLedger(ledger).items.filter(item =>
    item.gears_job_id.startsWith('local-gears-')
    && ['submitted', 'queued', 'processing'].includes(item.status)
  ).length;
}

export function productionReadinessDeliveryScore(
  stage: StoryProductionBoard['delivery_manifest']['stage'],
  exported: boolean,
): number {
  if (stage === 'ready') return exported ? 100 : 85;
  if (stage === 'needs_repair') return 65;
  return 30;
}

export function productionReadinessShotStatus(
  total: number,
  failed: number,
  active: number,
  ready: number,
): ProductionReadinessStatus {
  if (total <= 0 || failed > 0) return 'blocked';
  if (ready >= total) return 'ready';
  if (active > 0 || ready > 0) return 'needs_action';
  return 'needs_action';
}

export function productionReadinessShotScore(
  total: number,
  ready: number,
  active: number,
  failed: number,
): number {
  if (total <= 0) return 20;
  const readyScore = (ready / total) * 100;
  const activeCredit = (active / total) * 45;
  const failurePenalty = (failed / total) * 60;
  return Math.max(0, Math.min(100, Math.round(readyScore + activeCredit - failurePenalty)));
}

export function productionReadinessGearsStatus(
  summary: ProductionReadinessGearsSummary,
): ProductionReadinessStatus {
  if (summary.total === 0) return 'needs_action';
  if (summary.failed + summary.rejected + summary.canceled + summary.missing_artifact > 0) return 'blocked';
  if (
    summary.active > 0
    || summary.poll_failure > 0
    || summary.ready < summary.total
    || summary.ready_without_external_artifact > 0
  ) return 'needs_action';
  return 'ready';
}

export function productionReadinessGearsScore(summary: ProductionReadinessGearsSummary): number {
  if (summary.total === 0) return 45;
  const externalReadyScore = (summary.external_ready / summary.total) * 100;
  const localAcceptanceCredit = (summary.local_acceptance_ready / summary.total) * 65;
  const activeCredit = (summary.active / summary.total) * 50;
  const failurePenalty = ((summary.failed + summary.rejected + summary.canceled) / summary.total) * 70;
  const artifactPenalty = (summary.missing_artifact / summary.total) * 80;
  const pollPenalty = (summary.poll_failure / summary.total) * 20;
  return Math.max(0, Math.min(100, Math.round(
    externalReadyScore + localAcceptanceCredit + activeCredit - failurePenalty - artifactPenalty - pollPenalty,
  )));
}

export function buildProductionReadinessSummary(
  lanes: ProductionReadinessLane[],
  issues: ProductionReadinessIssue[],
  nextActions: ProductionReadinessNextAction[],
  extras: {
    qualityScore?: number;
    deliveryStage?: StoryProductionBoard['delivery_manifest']['stage'];
    generatedEpisodeCount?: number;
    totalEpisodeCount?: number;
    totalShotCount?: number;
    readyShotCount?: number;
    failedShotCount?: number;
    openReviewCount?: number;
    seedancePlaceholderAssetCount?: number;
    seedanceProductionAssetReadyCount?: number;
    gearsSummary: ProductionReadinessGearsSummary;
  },
): StoryProjectProductionReadinessReport['summary'] {
  const blockerCount = issues.filter(issue => issue.severity === 'blocking').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;
  const averageLaneScore = lanes.length
    ? lanes.reduce((sum, lane) => sum + lane.score, 0) / lanes.length
    : 0;
  return {
    status: productionReadinessOverallStatus(lanes, blockerCount, warningCount),
    score: Math.max(0, Math.min(100, Math.round(averageLaneScore - blockerCount * 6 - warningCount * 2))),
    ready_lane_count: lanes.filter(lane => lane.status === 'ready').length,
    total_lane_count: lanes.length,
    blocker_count: blockerCount,
    warning_count: warningCount,
    next_action_count: nextActions.length,
    quality_score: extras.qualityScore,
    delivery_stage: extras.deliveryStage,
    generated_episode_count: extras.generatedEpisodeCount,
    total_episode_count: extras.totalEpisodeCount,
    total_shot_count: extras.totalShotCount,
    ready_shot_count: extras.readyShotCount,
    failed_shot_count: extras.failedShotCount,
    open_review_count: extras.openReviewCount,
    gears_job_count: extras.gearsSummary.total,
    active_gears_job_count: extras.gearsSummary.active,
    external_ready_gears_job_count: extras.gearsSummary.external_ready,
    local_acceptance_ready_gears_job_count: extras.gearsSummary.local_acceptance_ready,
    ready_without_external_gears_artifact_count: extras.gearsSummary.ready_without_external_artifact,
    seedance_placeholder_asset_count: extras.seedancePlaceholderAssetCount ?? 0,
    seedance_production_asset_ready_count: extras.seedanceProductionAssetReadyCount ?? 0,
  };
}

function productionReadinessOverallStatus(
  lanes: ProductionReadinessLane[],
  blockerCount: number,
  warningCount: number,
): ProductionReadinessStatus {
  if (blockerCount > 0 || lanes.some(lane => lane.status === 'blocked')) return 'blocked';
  if (warningCount > 0 || lanes.some(lane => lane.status === 'needs_action')) return 'needs_action';
  return 'ready';
}

export function buildStoryProjectProductionReadinessMarkdown(
  report: Omit<StoryProjectProductionReadinessReport, 'markdown'>,
): string {
  return [
    `# ${report.title} — 制作 readiness`,
    '',
    `> schema: ${report.schema_version}`,
    `> projectId: ${report.project.project_id}`,
    `> generatedAt: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- 状态: ${productionReadinessStatusText(report.summary.status)}`,
    `- 分数: ${report.summary.score}/100`,
    `- lanes: ${report.summary.ready_lane_count}/${report.summary.total_lane_count}`,
    `- blockers: ${report.summary.blocker_count}`,
    `- warnings: ${report.summary.warning_count}`,
    `- next actions: ${report.summary.next_action_count}`,
    `- Seedance placeholder assets: ${report.summary.seedance_placeholder_asset_count}`,
    `- Seedance production assets ready: ${report.summary.seedance_production_asset_ready_count}`,
    '',
    '## GEARS Operational Metrics',
    '',
    `- scope: ${report.gears_operational_metrics.scope}`,
    `- authorized external jobs: ${report.gears_operational_metrics.authorized_external_job_count}`,
    `- actual output rate: ${report.gears_operational_metrics.actual_output_rate_percent}%`,
    `- failure rate: ${report.gears_operational_metrics.failure_rate_percent}%`,
    `- execution p50/p95: ${report.gears_operational_metrics.execution_duration_ms.p50}/${report.gears_operational_metrics.execution_duration_ms.p95} ms`,
    `- callback latency p50/p95: ${report.gears_operational_metrics.callback_delivery_latency_ms.p50}/${report.gears_operational_metrics.callback_delivery_latency_ms.p95} ms`,
    `- actual cost: ${Object.entries(report.gears_operational_metrics.actual_cost_by_currency).map(([currency, amount]) => `${amount} ${currency}`).join(' + ') || 'none'}`,
    `- local acceptance excluded: ${report.gears_operational_metrics.local_acceptance_excluded}`,
    '',
    '## GEARS Recovery Plan',
    '',
    `- recovery items: ${report.gears_recovery_plan.item_count}`,
    `- retry eligible: ${report.gears_recovery_plan.retry_eligible_count}`,
    `- status resync: ${report.gears_recovery_plan.status_resync_count}`,
    `- operator intervention: ${report.gears_recovery_plan.operator_intervention_count}`,
    ...report.gears_recovery_plan.items.map(item => `- ${item.source_unit_id} · ${item.failure_category} · ${item.strategy} · auto=${item.can_auto_execute}: ${item.reason}`),
    '',
    '## Project Workflow',
    '',
    `- 状态: ${report.workflow.state_label}`,
    `- 唯一 NEXT: ${report.workflow.primary_next_action.label}`,
    `- 说明: ${report.workflow.primary_next_action.detail}`,
    `- 外部输入: ${report.workflow.primary_next_action.external_input_required ? 'required' : 'not required'}`,
    `- 真实完成信用: ${report.workflow.primary_next_action.counts_as_real_completion ? 'granted' : 'not granted'}`,
    '',
    '## Lanes',
    '',
    '| 模块 | 状态 | 分数 | 说明 |',
    '|---|---:|---:|---|',
    ...report.lanes.map(lane =>
      `| ${lane.label} | ${productionReadinessStatusText(lane.status)} | ${lane.score}/100 | ${lane.detail} |`,
    ),
    '',
    '## Issues',
    '',
    ...(report.issues.length
      ? report.issues.map(issue =>
        `- ${issueSeverityText(issue.severity)} · ${issue.label}: ${issue.detail}`,
      )
      : ['- 暂无阻断项。']),
    '',
    '## Next Actions',
    '',
    ...(report.next_actions.length
      ? report.next_actions.map(action => `- P${action.priority} · ${action.label}: ${action.detail}`)
      : ['- 暂无下一步动作。']),
    '',
    '## Automation Plan',
    '',
    ...(report.automation_plan.steps.length
      ? report.automation_plan.steps.map(step =>
        `- ${step.step_id} · ${step.status} · ${step.runner}: ${step.label} -> ${step.expected_result}`,
      )
      : ['- 暂无自动化步骤。']),
    '',
    '## Latest Automation Run',
    '',
    ...(report.latest_automation_run
      ? [
        `- ${report.latest_automation_run.completed_at} · ${report.latest_automation_run.executed_step_count} executed · ${report.latest_automation_run.failed_step_count} failed · ${report.latest_automation_run.before_score}->${report.latest_automation_run.after_score}`,
        ...report.latest_automation_run.steps.map(step =>
          `  - ${step.status} · ${step.action_key}: ${step.label}`,
        ),
      ]
      : ['- 暂无已持久化的自动化运行记录。']),
  ].join('\n');
}

function productionReadinessStatusText(status: ProductionReadinessStatus): string {
  if (status === 'ready') return 'ready';
  if (status === 'blocked') return 'blocked';
  return 'needs_action';
}

function issueSeverityText(severity: ProductionReadinessIssue['severity']): string {
  if (severity === 'blocking') return '阻断';
  if (severity === 'warning') return '提醒';
  return '信息';
}
