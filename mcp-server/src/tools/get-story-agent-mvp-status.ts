import {
  getStoryAgentGeneratedHealth,
  type StoryAgentGeneratedHealthItem,
  type StoryAgentGeneratedHealthReport,
} from './get-generated-health.js';
import {
  getProductionReadinessPortfolio,
  type ProductionReadinessPortfolioReport,
} from './get-production-readiness-portfolio.js';

type MvpStatus = 'ready' | 'needs_action' | 'blocked';
type MvpLaneKey =
  | 'generated_artifacts'
  | 'story_quality'
  | 'repair_loop'
  | 'delivery_contract'
  | 'production_command';

type PortfolioItem = ProductionReadinessPortfolioReport['items'][number];
type HealthScope = StoryAgentGeneratedHealthItem['scope'];

export interface GetStoryAgentMvpStatusInput {
  generated_limit?: number;
  portfolio_limit?: number;
  include_markdown?: boolean;
}

export interface StoryAgentMvpLane {
  key: MvpLaneKey;
  label: string;
  status: MvpStatus;
  score: number;
  detail: string;
  evidence: string[];
  next_action?: string;
}

export interface StoryAgentMvpPriorityTarget {
  scope: PortfolioItem['scope'] | HealthScope;
  project_id: string;
  title?: string;
  status: string;
  priority_score: number;
  primary_action?: string;
  evidence: string[];
}

export interface StoryAgentMvpStatusReport {
  schema_version: 'mcp-story-agent-mvp-status/v1';
  generated_at: string;
  status: MvpStatus;
  score: number;
  summary: {
    generated_target_count: number;
    generated_ready_count: number;
    generated_planned_count: number;
    generated_production_gap_count: number;
    generated_interrupted_count: number;
    readiness_target_count: number;
    readiness_ready_count: number;
    readiness_needs_action_count: number;
    readiness_blocked_count: number;
    ready_automation_step_count: number;
    external_or_manual_step_count: number;
    blocker_count: number;
    warning_count: number;
  };
  lanes: StoryAgentMvpLane[];
  priority_targets: StoryAgentMvpPriorityTarget[];
  next_actions: string[];
  notes: string[];
  generated_health: StoryAgentGeneratedHealthReport;
  production_portfolio: ProductionReadinessPortfolioReport;
  markdown?: string;
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

function missingContractCount(health: StoryAgentGeneratedHealthReport, contract: string, scope?: HealthScope): number {
  return health.items.filter(item =>
    (!scope || item.scope === scope) && item.missing_contracts.includes(contract),
  ).length;
}

function generatedArtifactsLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const total = summary.total_target_count;
  const openCount = summary.planned_count + summary.production_gap_count + summary.interrupted_count;
  const status: MvpStatus = total === 0 || summary.interrupted_count > 0
    ? 'blocked'
    : openCount > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'generated_artifacts',
    label: 'Generated artifacts',
    status,
    score: total === 0 ? 0 : clampScore((summary.ready_count / total) * 100 - summary.interrupted_count * 20),
    detail: total === 0 ? 'No generated Story Agent targets were found.' : `${summary.ready_count}/${total} generated targets are ready.`,
    evidence: [
      `targets=${total}`,
      `ready=${summary.ready_count}`,
      `planned=${summary.planned_count}`,
      `production_gap=${summary.production_gap_count}`,
      `interrupted=${summary.interrupted_count}`,
    ],
    next_action: total === 0
      ? 'Generate or import at least one Story Agent target.'
      : summary.interrupted_count > 0
        ? 'Repair interrupted current story/version or episode references.'
        : openCount > 0
          ? 'Finish planned or production_gap targets before GEARS signoff.'
          : undefined,
  };
}

function storyQualityLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const storyCount = summary.scanned_story_project_count;
  const missingCurrent = summary.missing_current_story_count;
  const missingScene = summary.missing_scene_breakdown_count;
  const missingQuality = summary.missing_quality_count;
  const status: MvpStatus = missingCurrent > 0
    ? 'blocked'
    : missingScene > 0 || missingQuality > 0 || storyCount === 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'story_quality',
    label: 'Story quality',
    status,
    score: storyCount === 0 ? 35 : clampScore(100 - missingCurrent * 40 - missingScene * 25 - missingQuality * 20),
    detail: storyCount === 0
      ? 'No standalone story project has measurable scene and quality evidence.'
      : `${storyCount - Math.min(storyCount, missingScene + missingQuality)}/${storyCount} story projects have quality evidence.`,
    evidence: [
      `story_projects=${storyCount}`,
      `missing_current_story=${missingCurrent}`,
      `missing_scene_breakdown=${missingScene}`,
      `missing_quality=${missingQuality}`,
    ],
    next_action: missingCurrent > 0
      ? 'Restore interrupted story pointers before repair automation.'
      : missingScene > 0 || missingQuality > 0
        ? 'Run Story Agent validation/repair to regenerate scene_breakdown and quality_report.'
        : storyCount === 0
          ? 'Generate a story project for quality validation.'
          : undefined,
  };
}

function repairLoopLane(portfolio: ProductionReadinessPortfolioReport): StoryAgentMvpLane {
  const summary = portfolio.summary;
  const total = summary.total_target_count;
  const readyAutomation = summary.ready_automation_step_count;
  const status: MvpStatus = total === 0 || (summary.blocker_count > 0 && readyAutomation === 0)
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
      ? 'No readiness target is available for safe Story Agent automation.'
      : `${readyAutomation} safe Story Agent automation steps are ready.`,
    evidence: [
      `portfolio_targets=${total}`,
      `ready_automation_steps=${readyAutomation}`,
      `blockers=${summary.blocker_count}`,
      `warnings=${summary.warning_count}`,
    ],
    next_action: total === 0
      ? 'Create a readiness target from generated output.'
      : readyAutomation > 0
        ? 'Run production readiness automation in dry-run before execution.'
        : summary.blocker_count > 0
          ? 'Resolve blocking readiness issues before automation.'
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
  const status: MvpStatus = total === 0 || missingHardContract > 0
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
      ? 'GEARS delivery contracts are present for scanned targets.'
      : `${openDeliveryCount} targets still need delivery closure.`,
    evidence: [
      `missing_scene_breakdown=${summary.missing_scene_breakdown_count}`,
      `missing_gears_segments=${summary.missing_gears_segments_count}`,
      `missing_story_delivery=${missingStoryDelivery}`,
      `series_missing_delivery=${missingSeriesDelivery}`,
    ],
    next_action: missingHardContract > 0
      ? 'Regenerate scene_breakdown and gears_segments before GEARS export.'
      : openDeliveryCount > 0
        ? 'Export GEARS delivery and production-board contracts.'
        : undefined,
  };
}

function productionCommandLane(portfolio: ProductionReadinessPortfolioReport): StoryAgentMvpLane {
  const summary = portfolio.summary;
  const total = summary.total_target_count;
  const externalOrManual = summary.external_automation_step_count + summary.manual_automation_step_count;
  const status: MvpStatus = portfolio.errors.length > 0 || summary.blocked_count > 0
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
    detail: total === 0 ? 'No production readiness targets were found.' : `${summary.ready_count}/${total} targets are production-command ready.`,
    evidence: [
      `readiness_targets=${total}`,
      `ready=${summary.ready_count}`,
      `needs_action=${summary.needs_action_count}`,
      `blocked=${summary.blocked_count}`,
      `external_or_manual_steps=${externalOrManual}`,
      `read_errors=${portfolio.errors.length}`,
    ],
    next_action: portfolio.errors.length > 0
      ? 'Fix readiness read errors before signoff.'
      : summary.blocked_count > 0
        ? 'Clear blocked readiness targets before GEARS worker acceptance.'
        : summary.ready_automation_step_count > 0
          ? 'Run safe Story Agent readiness automation.'
          : externalOrManual > 0
            ? 'Send external/manual steps to GEARS v2 or operator review.'
            : undefined,
  };
}

function overallStatus(lanes: StoryAgentMvpLane[]): MvpStatus {
  if (lanes.some(lane => lane.status === 'blocked')) return 'blocked';
  if (lanes.some(lane => lane.status === 'needs_action')) return 'needs_action';
  return 'ready';
}

function priorityTargets(
  health: StoryAgentGeneratedHealthReport,
  portfolio: ProductionReadinessPortfolioReport,
): StoryAgentMvpPriorityTarget[] {
  return [
    ...health.items.slice(0, 8).map((item): StoryAgentMvpPriorityTarget => ({
      scope: item.scope,
      project_id: item.project_id,
      title: item.title,
      status: item.status,
      priority_score: item.risk_score,
      primary_action: item.recommended_actions[0],
      evidence: [
        'source=generated_health',
        `risk=${item.risk_score}`,
        `issues=${item.issue_count}`,
        `missing=${item.missing_contracts.join(',') || 'none'}`,
        ...item.evidence.slice(0, 3),
      ],
    })),
    ...portfolio.items.slice(0, 8).map((item): StoryAgentMvpPriorityTarget => ({
      scope: item.scope,
      project_id: item.project_id,
      title: item.title,
      status: item.status,
      priority_score: item.priority_score,
      primary_action: item.primary_action_label,
      evidence: [
        'source=production_portfolio',
        `score=${item.score}`,
        `blockers=${item.blocker_count}`,
        `warnings=${item.warning_count}`,
        `ready_automation_steps=${item.ready_automation_step_count}`,
      ],
    })),
  ]
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 12);
}

function buildMarkdown(report: Omit<StoryAgentMvpStatusReport, 'markdown'>): string {
  return [
    '# MCP Story Agent MVP Status',
    '',
    `> generatedAt: ${report.generated_at}`,
    `> status: ${report.status}`,
    `> score: ${report.score}`,
    '',
    '## Summary',
    '',
    `- generated targets: ${report.summary.generated_target_count}`,
    `- readiness targets: ${report.summary.readiness_target_count}`,
    `- safe automation steps: ${report.summary.ready_automation_step_count}`,
    `- GEARS/operator steps: ${report.summary.external_or_manual_step_count}`,
    '',
    '## Lanes',
    '',
    ...report.lanes.map(lane => `- ${lane.status} · ${lane.score}/100 · ${lane.label}: ${lane.detail}`),
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
  ].join('\n');
}

export async function getStoryAgentMvpStatus(
  input: GetStoryAgentMvpStatusInput = {},
): Promise<StoryAgentMvpStatusReport> {
  const [generatedHealth, productionPortfolio] = await Promise.all([
    getStoryAgentGeneratedHealth({ limit: input.generated_limit ?? 100, include_markdown: false }),
    getProductionReadinessPortfolio({ limit: input.portfolio_limit ?? 100, include_markdown: false }),
  ]);
  const lanes = [
    generatedArtifactsLane(generatedHealth),
    storyQualityLane(generatedHealth),
    repairLoopLane(productionPortfolio),
    deliveryContractLane(generatedHealth),
    productionCommandLane(productionPortfolio),
  ];
  const status = overallStatus(lanes);
  const externalOrManual = productionPortfolio.summary.external_automation_step_count
    + productionPortfolio.summary.manual_automation_step_count;
  const base: Omit<StoryAgentMvpStatusReport, 'markdown'> = {
    schema_version: 'mcp-story-agent-mvp-status/v1',
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
    priority_targets: priorityTargets(generatedHealth, productionPortfolio),
    next_actions: uniqueStrings([
      ...lanes.filter(lane => lane.status !== 'ready').map(lane => lane.next_action),
      ...generatedHealth.items.slice(0, 5).map(item => item.recommended_actions[0]),
      ...productionPortfolio.items.slice(0, 5).map(item => item.primary_action_label),
    ]).slice(0, 10),
    notes: [
      'MCP MVP status is read-only and combines local generated health with production readiness portfolio.',
      'Use this before GEARS worker evidence signoff to decide whether Story Agent contracts need repair.',
      'china-culture-kb remains the content and production command layer; media execution stays in GEARS v2.',
    ],
    generated_health: generatedHealth,
    production_portfolio: productionPortfolio,
  };
  return input.include_markdown === false ? base : { ...base, markdown: buildMarkdown(base) };
}
