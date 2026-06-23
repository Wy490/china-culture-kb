import type {
  ProductionReadinessPortfolioItem,
  ProductionReadinessPortfolioReport,
  StoryAgentGeneratedHealthItem,
  StoryAgentGeneratedHealthReport,
  StoryAgentGeneratedHealthScope,
  StoryAgentMvpLane,
  StoryAgentMvpPriorityTarget,
  StoryAgentMvpProgressSlice,
  StoryAgentMvpStatus,
  StoryAgentMvpStatusReport,
} from '@shared/types.js';
import { getStoryAgentGeneratedHealth } from './generated-health-service.js';
import { getProductionReadinessPortfolio } from './production-readiness-portfolio-service.js';

interface StoryAgentMvpStatusOptions {
  generatedLimit?: number;
  portfolioLimit?: number;
  includeArchivedSeries?: boolean;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function missingContractCount(
  health: StoryAgentGeneratedHealthReport,
  contract: string,
  scope?: StoryAgentGeneratedHealthScope,
): number {
  return health.items.filter(item =>
    (!scope || item.scope === scope) && item.missing_contracts.includes(contract),
  ).length;
}

function generatedArtifactsLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const total = summary.total_target_count;
  const openCount = summary.planned_count + summary.production_gap_count + summary.interrupted_count;
  const status: StoryAgentMvpStatus = total === 0 || summary.interrupted_count > 0
    ? 'blocked'
    : openCount > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'generated_artifacts',
    label: 'Generated artifacts',
    status,
    score: total === 0 ? 0 : clampScore((summary.ready_count / total) * 100 - summary.interrupted_count * 20),
    detail: total === 0
      ? 'No generated Story Agent project or AI comic series was found.'
      : `${summary.ready_count}/${total} generated targets are contract-complete.`,
    evidence: [
      `targets=${total}`,
      `ready=${summary.ready_count}`,
      `planned=${summary.planned_count}`,
      `production_gap=${summary.production_gap_count}`,
      `interrupted=${summary.interrupted_count}`,
    ],
    next_action: total === 0
      ? 'Generate or import at least one Story Agent project before GEARS worker acceptance.'
      : summary.interrupted_count > 0
        ? 'Repair broken current_story/current_version or episode story references before delivery.'
        : openCount > 0
          ? 'Finish planned episodes and close production_gap targets with Story Agent repair/export steps.'
          : undefined,
  };
}

function storyQualityLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const storyCount = summary.scanned_story_project_count;
  const missingCurrent = summary.missing_current_story_count;
  const missingScene = summary.missing_scene_breakdown_count;
  const missingQuality = summary.missing_quality_count;
  const status: StoryAgentMvpStatus = missingCurrent > 0
    ? 'blocked'
    : missingScene > 0 || missingQuality > 0 || storyCount === 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'story_quality',
    label: 'Story quality',
    status,
    score: storyCount === 0
      ? 35
      : clampScore(100 - missingCurrent * 40 - missingScene * 25 - missingQuality * 20),
    detail: storyCount === 0
      ? 'No standalone story project has a measurable scene and quality contract yet.'
      : `${storyCount - Math.min(storyCount, missingScene + missingQuality)}/${storyCount} story projects have scene and quality evidence.`,
    evidence: [
      `story_projects=${storyCount}`,
      `missing_current_story=${missingCurrent}`,
      `missing_scene_breakdown=${missingScene}`,
      `missing_quality=${missingQuality}`,
    ],
    next_action: missingCurrent > 0
      ? 'Restore interrupted story project pointers before repair automation.'
      : missingScene > 0 || missingQuality > 0
        ? 'Run Story Agent validation/repair to regenerate scene_breakdown and quality_report.'
        : storyCount === 0
          ? 'Generate the first measurable story project for quality validation.'
          : undefined,
  };
}

function repairLoopLane(portfolio: ProductionReadinessPortfolioReport): StoryAgentMvpLane {
  const summary = portfolio.summary;
  const total = summary.total_target_count;
  const readyAutomation = summary.ready_automation_step_count;
  const status: StoryAgentMvpStatus = total === 0 || (summary.blocker_count > 0 && readyAutomation === 0)
    ? 'blocked'
    : readyAutomation > 0 || summary.needs_action_count > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'repair_loop',
    label: 'Repair loop',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - summary.blocker_count * 25 - summary.warning_count * 8 - summary.needs_action_count * 10),
    detail: total === 0
      ? 'No production readiness target is available for safe Story Agent automation.'
      : `${readyAutomation} safe Story Agent automation steps are ready across ${total} targets.`,
    evidence: [
      `portfolio_targets=${total}`,
      `ready_automation_steps=${readyAutomation}`,
      `blockers=${summary.blocker_count}`,
      `warnings=${summary.warning_count}`,
    ],
    next_action: total === 0
      ? 'Create a project readiness target from generated Story Agent output.'
      : readyAutomation > 0
        ? 'Run production-readiness portfolio automation in dry-run first, then execute safe Story Agent steps.'
        : summary.blocker_count > 0
          ? 'Resolve blocking readiness issues before automation can continue.'
          : undefined,
  };
}

function deliveryContractLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const total = summary.total_target_count;
  const missingStoryDelivery = missingContractCount(health, 'delivery_contract', 'story_project');
  const missingSeriesDelivery = summary.series_missing_delivery_count;
  const missingHardContract = summary.missing_scene_breakdown_count + summary.missing_gears_segments_count;
  const openDeliveryCount = missingHardContract + missingStoryDelivery + missingSeriesDelivery;
  const status: StoryAgentMvpStatus = total === 0 || missingHardContract > 0
    ? 'blocked'
    : openDeliveryCount > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'delivery_contract',
    label: 'Delivery contract',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - missingHardContract * 30 - missingStoryDelivery * 16 - missingSeriesDelivery * 12),
    detail: openDeliveryCount === 0
      ? 'GEARS delivery contracts are present for scanned generated targets.'
      : `${openDeliveryCount} generated targets still need scene, segment, or delivery export closure.`,
    evidence: [
      `missing_scene_breakdown=${summary.missing_scene_breakdown_count}`,
      `missing_gears_segments=${summary.missing_gears_segments_count}`,
      `missing_story_delivery=${missingStoryDelivery}`,
      `series_missing_delivery=${missingSeriesDelivery}`,
    ],
    next_action: missingHardContract > 0
      ? 'Regenerate scene_breakdown and gears_segments before exporting GEARS delivery.'
      : openDeliveryCount > 0
        ? 'Export GEARS delivery and production-board contracts; keep media execution in GEARS v2.'
        : undefined,
  };
}

function productionCommandLane(portfolio: ProductionReadinessPortfolioReport): StoryAgentMvpLane {
  const summary = portfolio.summary;
  const total = summary.total_target_count;
  const externalOrManual = summary.external_automation_step_count + summary.manual_automation_step_count;
  const hasReadErrors = portfolio.errors.length > 0;
  const status: StoryAgentMvpStatus = hasReadErrors || summary.blocked_count > 0
    ? 'blocked'
    : total === 0
      ? 'blocked'
      : summary.needs_action_count > 0 || summary.ready_automation_step_count > 0 || externalOrManual > 0
        ? 'needs_action'
        : 'ready';
  return {
    key: 'production_command',
    label: 'Production command',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - summary.blocked_count * 35 - summary.needs_action_count * 15 - externalOrManual * 4 - portfolio.errors.length * 20),
    detail: total === 0
      ? 'No production readiness portfolio targets were found.'
      : `${summary.ready_count}/${total} targets are production-command ready.`,
    evidence: [
      `readiness_targets=${total}`,
      `ready=${summary.ready_count}`,
      `needs_action=${summary.needs_action_count}`,
      `blocked=${summary.blocked_count}`,
      `external_or_manual_steps=${externalOrManual}`,
      `read_errors=${portfolio.errors.length}`,
    ],
    next_action: hasReadErrors
      ? 'Fix production readiness read errors before portfolio sign-off.'
      : summary.blocked_count > 0
        ? 'Clear blocked readiness targets before GEARS worker acceptance.'
        : summary.ready_automation_step_count > 0
          ? 'Run safe Story Agent production-readiness automation before handoff.'
          : externalOrManual > 0
            ? 'Send external/manual steps to GEARS v2 or operator review; do not execute media work in china-culture-kb.'
            : undefined,
  };
}

function overallStatus(lanes: StoryAgentMvpLane[]): StoryAgentMvpStatus {
  if (lanes.some(lane => lane.status === 'blocked')) return 'blocked';
  if (lanes.some(lane => lane.status === 'needs_action')) return 'needs_action';
  return 'ready';
}

function healthPriorityTarget(item: StoryAgentGeneratedHealthItem): StoryAgentMvpPriorityTarget {
  const action = item.recommended_actions[0];
  return {
    scope: item.scope,
    project_id: item.project_id,
    ...(item.title ? { title: item.title } : {}),
    status: item.status,
    priority_score: item.risk_score,
    ...(action ? { primary_action: action } : {}),
    evidence: [
      `source=generated_health`,
      `risk=${item.risk_score}`,
      `issues=${item.issue_count}`,
      `missing=${item.missing_contracts.join(',') || 'none'}`,
      ...item.evidence.slice(0, 3),
    ],
  };
}

function portfolioPriorityTarget(item: ProductionReadinessPortfolioItem): StoryAgentMvpPriorityTarget {
  const action = item.primary_action_label ?? item.primary_issue_label;
  return {
    scope: item.scope,
    project_id: item.project_id,
    title: item.title,
    status: item.status,
    priority_score: item.priority_score,
    ...(action ? { primary_action: action } : {}),
    evidence: [
      `source=production_portfolio`,
      `score=${item.score}`,
      `blockers=${item.blocker_count}`,
      `warnings=${item.warning_count}`,
      `ready_automation_steps=${item.ready_automation_step_count}`,
      `external_steps=${item.external_automation_step_count}`,
      `manual_steps=${item.manual_automation_step_count}`,
    ],
  };
}

function priorityTargets(
  health: StoryAgentGeneratedHealthReport,
  portfolio: ProductionReadinessPortfolioReport,
): StoryAgentMvpPriorityTarget[] {
  return [
    ...health.items
      .filter(item => item.status !== 'ready' || item.risk_score > 0)
      .slice(0, 8)
      .map(healthPriorityTarget),
    ...portfolio.items
      .filter(item => item.status !== 'ready' || item.priority_score > 0)
      .slice(0, 8)
      .map(portfolioPriorityTarget),
  ]
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 12);
}

function nextActions(
  lanes: StoryAgentMvpLane[],
  health: StoryAgentGeneratedHealthReport,
  portfolio: ProductionReadinessPortfolioReport,
): string[] {
  return uniqueStrings([
    ...lanes.filter(lane => lane.status !== 'ready').map(lane => lane.next_action),
    ...health.items.slice(0, 5).map(item => item.recommended_actions[0]),
    ...portfolio.items.slice(0, 5).map(item => item.primary_action_label ?? item.primary_issue_label),
  ]).slice(0, 10);
}

function progressSlices(
  lanes: StoryAgentMvpLane[],
  health: StoryAgentGeneratedHealthReport,
  portfolio: ProductionReadinessPortfolioReport,
): StoryAgentMvpProgressSlice[] {
  const endpointConfigured = Boolean(process.env.GEARS_API_BASE_URL?.trim());
  const hasLocalContractBlocker = lanes.some(lane => lane.status === 'blocked');
  const externalOrManual = portfolio.summary.external_automation_step_count
    + portfolio.summary.manual_automation_step_count;
  return [
    {
      key: 'content_command_layer',
      label: 'Content and production command layer',
      status: hasLocalContractBlocker ? 'needs_action' : 'ready',
      percent: 99,
      detail: 'Story generation, quality/repair, versioning, generated-health, readiness portfolio, MVP status, and worker evidence signoff command surfaces are implemented in china-culture-kb.',
      evidence: [
        'implementation_progress=99',
        `mvp_lanes=${lanes.length}`,
        `generated_targets=${health.summary.total_target_count}`,
        `readiness_targets=${portfolio.summary.total_target_count}`,
        `local_contract_blocked=${hasLocalContractBlocker}`,
      ],
    },
    {
      key: 'gears_end_to_end_acceptance',
      label: 'GEARS v2 end-to-end acceptance',
      status: 'needs_action',
      percent: 95,
      detail: 'The remaining work is reachable GEARS v2 submit/status/callback smoke plus large-project worker pressure sign-off with real worker responses.',
      blocker: endpointConfigured ? 'gears_worker_signoff_evidence_pending' : 'real_gears_v2_endpoint_not_configured',
      evidence: [
        'acceptance_progress=95',
        `gears_endpoint_configured=${endpointConfigured}`,
        `external_or_manual_steps=${externalOrManual}`,
        'requires=run-gears-worker-acceptance.sh',
        'requires=worker_evidence_signoff',
      ],
    },
  ];
}

function renderMarkdown(report: Omit<StoryAgentMvpStatusReport, 'markdown'>): string {
  return [
    '# Story Agent MVP Status',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> status: ${report.status}`,
    `> score: ${report.score}`,
    '',
    '## Summary',
    '',
    `- generated targets: ${report.summary.generated_target_count}`,
    `- generated ready: ${report.summary.generated_ready_count}`,
    `- generated production_gap: ${report.summary.generated_production_gap_count}`,
    `- generated interrupted: ${report.summary.generated_interrupted_count}`,
    `- readiness targets: ${report.summary.readiness_target_count}`,
    `- readiness ready: ${report.summary.readiness_ready_count}`,
    `- readiness needs_action: ${report.summary.readiness_needs_action_count}`,
    `- readiness blocked: ${report.summary.readiness_blocked_count}`,
    `- safe automation steps: ${report.summary.ready_automation_step_count}`,
    `- GEARS/operator steps: ${report.summary.external_or_manual_step_count}`,
    '',
    '## Lanes',
    '',
    ...report.lanes.map(lane =>
      `- ${lane.status} · ${lane.score}/100 · ${lane.label}: ${lane.detail}`,
    ),
    '',
    '## Progress Split',
    '',
    ...report.progress.map(slice =>
      `- ${slice.status} · ${slice.percent}% · ${slice.label}: ${slice.detail}${slice.blocker ? ` blocker=${slice.blocker}` : ''}`,
    ),
    '',
    '## Priority Targets',
    '',
    ...(report.priority_targets.length
      ? report.priority_targets.map(target =>
        `- P${target.priority_score} · ${target.scope} · ${target.status} · ${target.project_id} · ${target.primary_action ?? 'no action'}`,
      )
      : ['- none']),
    '',
    '## Next Actions',
    '',
    ...(report.next_actions.length ? report.next_actions.map(action => `- ${action}`) : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n').trim() + '\n';
}

export async function getStoryAgentMvpStatus(
  options: StoryAgentMvpStatusOptions = {},
): Promise<StoryAgentMvpStatusReport> {
  const [generatedHealth, productionPortfolio] = await Promise.all([
    getStoryAgentGeneratedHealth({ limit: options.generatedLimit ?? 200 }),
    getProductionReadinessPortfolio({
      includeArchivedSeries: options.includeArchivedSeries,
      limit: options.portfolioLimit ?? 100,
    }),
  ]);
  const lanes = [
    generatedArtifactsLane(generatedHealth),
    storyQualityLane(generatedHealth),
    repairLoopLane(productionPortfolio),
    deliveryContractLane(generatedHealth),
    productionCommandLane(productionPortfolio),
  ];
  const status = overallStatus(lanes);
  const targets = priorityTargets(generatedHealth, productionPortfolio);
  const actions = nextActions(lanes, generatedHealth, productionPortfolio);
  const progress = progressSlices(lanes, generatedHealth, productionPortfolio);
  const externalOrManual = productionPortfolio.summary.external_automation_step_count
    + productionPortfolio.summary.manual_automation_step_count;
  const base: Omit<StoryAgentMvpStatusReport, 'markdown'> = {
    schema_version: 'story-agent-mvp-status/v1',
    generated_at: new Date().toISOString(),
    status,
    score: clampScore(lanes.reduce((sum, lane) => sum + lane.score, 0) / Math.max(1, lanes.length)),
    summary: {
      generated_target_count: generatedHealth.summary.total_target_count,
      generated_ready_count: generatedHealth.summary.ready_count,
      generated_planned_count: generatedHealth.summary.planned_count,
      generated_production_gap_count: generatedHealth.summary.production_gap_count,
      generated_interrupted_count: generatedHealth.summary.interrupted_count,
      readiness_target_count: productionPortfolio.summary.total_target_count,
      readiness_ready_count: productionPortfolio.summary.ready_count,
      readiness_needs_action_count: productionPortfolio.summary.needs_action_count,
      readiness_blocked_count: productionPortfolio.summary.blocked_count,
      ready_automation_step_count: productionPortfolio.summary.ready_automation_step_count,
      external_or_manual_step_count: externalOrManual,
      blocker_count: productionPortfolio.summary.blocker_count,
      warning_count: productionPortfolio.summary.warning_count,
    },
    lanes,
    progress,
    priority_targets: targets,
    next_actions: actions,
    notes: [
      'Read-only MVP status: combines generated artifact health with production readiness portfolio state.',
      'Progress is split: Story Agent content/production command layer is tracked separately from real GEARS v2 endpoint acceptance.',
      'The remaining 5% belongs to reachable GEARS v2 submit/status/callback smoke and large-project worker pressure sign-off, not in-repo media execution.',
      'china-culture-kb remains the content and production command layer; image, video, subtitle and final assembly execution stay in GEARS v2.',
      'Use this report to decide whether to repair Story Agent contracts, run safe readiness automation, or proceed to GEARS worker evidence sign-off.',
    ],
    generated_health: generatedHealth,
    production_portfolio: productionPortfolio,
  };
  return {
    ...base,
    markdown: renderMarkdown(base),
  };
}
