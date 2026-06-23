import {
  getStoryAgentGeneratedHealth,
  type StoryAgentGeneratedHealthItem,
  type StoryAgentGeneratedHealthReport,
} from './get-generated-health.js';

export interface GetStoryAgentGeneratedGovernancePlanInput {
  limit?: number;
  include_markdown?: boolean;
}

type GovernanceActionKey =
  | 'restore_or_relink_series_story_refs'
  | 'archive_or_rebuild_series_fixtures'
  | 'generate_first_series_episode'
  | 'repair_series_command_contracts'
  | 'repair_story_project_refs'
  | 'promote_ready_targets_for_gears_signoff';

interface GovernanceTarget {
  scope: StoryAgentGeneratedHealthItem['scope'];
  project_id: string;
  title?: string;
  status: StoryAgentGeneratedHealthItem['status'];
  risk_score: number;
  missing_contracts: string[];
  missing_episode_story_id_count?: number;
  contract_evidence_count?: number;
  relink_candidate?: boolean;
  evidence: string[];
}

interface GovernanceAction {
  action_key: GovernanceActionKey;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  label: string;
  target_count: number;
  sample_targets: GovernanceTarget[];
  can_auto_apply: boolean;
  runner: 'operator' | 'story_agent_api' | 'gears_worker';
  detail: string;
  next_step: string;
}

export interface StoryAgentGeneratedGovernancePlan {
  schema_version: 'mcp-story-agent-generated-governance-plan/v1';
  generated_at: string;
  status: 'ready' | 'needs_action' | 'blocked';
  summary: {
    source_total_target_count: number;
    ready_target_count: number;
    series_governance_attention_count: number;
    series_missing_story_ref_project_count: number;
    series_relink_candidate_count: number;
    series_archive_or_rebuild_candidate_count: number;
    series_planned_only_count: number;
    series_contract_repair_candidate_count: number;
    story_ref_repair_candidate_count: number;
    ready_gears_signoff_candidate_count: number;
  };
  actions: GovernanceAction[];
  notes: string[];
  source_health_summary: StoryAgentGeneratedHealthReport['summary'];
  markdown?: string;
}

function toTarget(item: StoryAgentGeneratedHealthItem): GovernanceTarget {
  return {
    scope: item.scope,
    project_id: item.project_id,
    title: item.title,
    status: item.status,
    risk_score: item.risk_score,
    missing_contracts: item.missing_contracts,
    missing_episode_story_id_count: item.missing_episode_story_id_count,
    contract_evidence_count: item.contract_evidence_count,
    relink_candidate: item.relink_candidate,
    evidence: item.evidence,
  };
}

function buildAction(
  config: Omit<GovernanceAction, 'target_count' | 'sample_targets'>,
  targetCount: number,
  samples: StoryAgentGeneratedHealthItem[],
): GovernanceAction {
  return {
    ...config,
    target_count: targetCount,
    sample_targets: samples.map(toTarget),
  };
}

function buildMarkdown(plan: Omit<StoryAgentGeneratedGovernancePlan, 'markdown'>): string {
  return [
    '# MCP Story Agent Generated Governance Plan',
    '',
    `> generatedAt: ${plan.generated_at}`,
    `> status: ${plan.status}`,
    '',
    '## Summary',
    '',
    `- source_total_target_count: ${plan.summary.source_total_target_count}`,
    `- series_governance_attention: ${plan.summary.series_governance_attention_count}`,
    `- series_relink_candidates: ${plan.summary.series_relink_candidate_count}`,
    `- series_archive_or_rebuild_candidates: ${plan.summary.series_archive_or_rebuild_candidate_count}`,
    `- story_ref_repair_candidates: ${plan.summary.story_ref_repair_candidate_count}`,
    `- ready_gears_signoff_candidates: ${plan.summary.ready_gears_signoff_candidate_count}`,
    '',
    '## Actions',
    '',
    ...(plan.actions.length
      ? plan.actions.map(action => `- ${action.priority} · ${action.action_key} · ${action.target_count} · auto=${action.can_auto_apply}`)
      : ['- none']),
    '',
    '## Notes',
    '',
    ...plan.notes.map(note => `- ${note}`),
  ].join('\n');
}

export async function getStoryAgentGeneratedGovernancePlan(
  input: GetStoryAgentGeneratedGovernancePlanInput = {},
): Promise<StoryAgentGeneratedGovernancePlan> {
  const sampleLimit = Number.isFinite(input.limit) ? Math.max(1, Math.min(Math.floor(input.limit ?? 20), 100)) : 20;
  const health = await getStoryAgentGeneratedHealth({ limit: 100, include_markdown: false });
  const seriesItems = health.items.filter(item => item.scope === 'ai_comic_series_project');
  const storyItems = health.items.filter(item => item.scope === 'story_project');
  const relinkSamples = seriesItems.filter(item => item.relink_candidate).slice(0, sampleLimit);
  const archiveSamples = seriesItems.filter(item => item.status === 'interrupted' && !item.relink_candidate).slice(0, sampleLimit);
  const plannedSamples = seriesItems.filter(item => item.status === 'planned').slice(0, sampleLimit);
  const contractRepairSamples = seriesItems.filter(item => item.status === 'production_gap').slice(0, sampleLimit);
  const storyRefRepairSamples = storyItems.filter(item => item.status === 'interrupted').slice(0, sampleLimit);
  const readySamples = health.items.filter(item => item.status === 'ready').slice(0, sampleLimit);

  const seriesRelinkCandidateCount = health.summary.series_relink_candidate_count ?? relinkSamples.length;
  const seriesPlannedOnlyCount = health.summary.series_planned_only_count ?? plannedSamples.length;
  const seriesContractRepairCandidateCount = health.summary.series_production_gap_count ?? contractRepairSamples.length;
  const storyRefRepairCandidateCount = storyItems.filter(item => item.status === 'interrupted').length;
  const readySignoffCandidateCount = health.summary.ready_count;
  const seriesArchiveOrRebuildCandidateCount = Math.max(
    0,
    (health.summary.series_interrupted_count ?? 0) - seriesRelinkCandidateCount,
  );

  const actions = [
    buildAction({
      action_key: 'restore_or_relink_series_story_refs',
      priority: 'P0',
      label: 'Restore missing episode story JSON or update generated_episode_story_ids',
      can_auto_apply: false,
      runner: 'operator',
      detail: 'Interrupted series with contract evidence should be relinked before GEARS readiness judgment.',
      next_step: 'Recover missing generated story JSON or rewrite refs to existing story IDs, then rerun generated health.',
    }, seriesRelinkCandidateCount, relinkSamples),
    buildAction({
      action_key: 'archive_or_rebuild_series_fixtures',
      priority: 'P1',
      label: 'Archive fixture-like interrupted series or rebuild them under the current contract',
      can_auto_apply: false,
      runner: 'operator',
      detail: 'Interrupted series without contract evidence should be excluded from GEARS signoff until rebuilt.',
      next_step: 'Archive fixtures outside the signoff portfolio or regenerate them with current Story Agent contracts.',
    }, seriesArchiveOrRebuildCandidateCount, archiveSamples),
    buildAction({
      action_key: 'generate_first_series_episode',
      priority: 'P1',
      label: 'Generate the first episode for planned-only series',
      can_auto_apply: false,
      runner: 'story_agent_api',
      detail: 'Planned-only series are not GEARS worker candidates.',
      next_step: 'Generate the first episode and rerun production readiness.',
    }, seriesPlannedOnlyCount, plannedSamples),
    buildAction({
      action_key: 'repair_series_command_contracts',
      priority: 'P1',
      label: 'Repair missing series command-layer contracts',
      can_auto_apply: false,
      runner: 'story_agent_api',
      detail: 'Production-gap series need Story Agent command artifacts before GEARS signoff.',
      next_step: 'Run safe readiness automation or regenerate missing command contracts.',
    }, seriesContractRepairCandidateCount, contractRepairSamples),
    buildAction({
      action_key: 'repair_story_project_refs',
      priority: 'P1',
      label: 'Repair interrupted single-story project references',
      can_auto_apply: false,
      runner: 'story_agent_api',
      detail: 'Single-story project current story/version refs should be repaired before portfolio readiness.',
      next_step: 'Restore the current version/story snapshot or create a new project version from an existing generated story.',
    }, storyRefRepairCandidateCount, storyRefRepairSamples),
    buildAction({
      action_key: 'promote_ready_targets_for_gears_signoff',
      priority: 'P2',
      label: 'Use ready generated targets for GEARS signoff smoke',
      can_auto_apply: false,
      runner: 'gears_worker',
      detail: 'Ready generated targets can be used once real GEARS v2 endpoint env is configured.',
      next_step: 'Run worker acceptance only after generated governance noise is excluded from signoff.',
    }, readySignoffCandidateCount, readySamples),
  ].filter(action => action.target_count > 0);

  const base: Omit<StoryAgentGeneratedGovernancePlan, 'markdown'> = {
    schema_version: 'mcp-story-agent-generated-governance-plan/v1',
    generated_at: new Date().toISOString(),
    status: health.summary.total_target_count === 0
      ? 'blocked'
      : actions.some(action => action.priority === 'P0' || action.priority === 'P1')
        ? 'needs_action'
        : 'ready',
    summary: {
      source_total_target_count: health.summary.total_target_count,
      ready_target_count: health.summary.ready_count,
      series_governance_attention_count: health.summary.series_governance_attention_count ?? 0,
      series_missing_story_ref_project_count: health.summary.series_missing_story_ref_project_count ?? 0,
      series_relink_candidate_count: seriesRelinkCandidateCount,
      series_archive_or_rebuild_candidate_count: seriesArchiveOrRebuildCandidateCount,
      series_planned_only_count: seriesPlannedOnlyCount,
      series_contract_repair_candidate_count: seriesContractRepairCandidateCount,
      story_ref_repair_candidate_count: storyRefRepairCandidateCount,
      ready_gears_signoff_candidate_count: readySignoffCandidateCount,
    },
    actions,
    notes: [
      'MCP generated governance plan is read-only and does not modify generated files.',
      'Use relink candidates before judging GEARS v2 worker readiness.',
      'Archive/rebuild candidates should be excluded from GEARS signoff until regenerated or marked as fixtures.',
      'china-culture-kb remains the content and production command layer; media execution stays in GEARS v2.',
    ],
    source_health_summary: health.summary,
  };

  return input.include_markdown === false ? base : { ...base, markdown: buildMarkdown(base) };
}
