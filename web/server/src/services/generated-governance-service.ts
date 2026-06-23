import type {
  StoryAgentGeneratedGovernanceAction,
  StoryAgentGeneratedGovernancePlan,
  StoryAgentGeneratedGovernanceTarget,
  StoryAgentGeneratedHealthItem,
} from '@shared/types.js';
import { getStoryAgentGeneratedHealth } from './generated-health-service.js';

interface GeneratedGovernanceOptions {
  limit?: number;
}

function boundedSampleLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(Math.floor(limit ?? 20), 100));
}

function toTarget(item: StoryAgentGeneratedHealthItem): StoryAgentGeneratedGovernanceTarget {
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

function sampleTargets(items: StoryAgentGeneratedHealthItem[], limit: number): StoryAgentGeneratedGovernanceTarget[] {
  return items.slice(0, limit).map(toTarget);
}

function buildAction(
  config: Omit<StoryAgentGeneratedGovernanceAction, 'target_count' | 'sample_targets'>,
  targets: StoryAgentGeneratedHealthItem[],
  limit: number,
): StoryAgentGeneratedGovernanceAction {
  return {
    ...config,
    target_count: targets.length,
    sample_targets: sampleTargets(targets, limit),
  };
}

function renderMarkdown(plan: Omit<StoryAgentGeneratedGovernancePlan, 'markdown'>): string {
  return [
    '# Story Agent Generated Governance Plan',
    '',
    `> schema_version: ${plan.schema_version}`,
    `> generated_at: ${plan.generated_at}`,
    `> status: ${plan.status}`,
    '',
    '## Summary',
    '',
    `- source_total_target_count: ${plan.summary.source_total_target_count}`,
    `- ready_target_count: ${plan.summary.ready_target_count}`,
    `- series_governance_attention: ${plan.summary.series_governance_attention_count}`,
    `- series_missing_story_ref_projects: ${plan.summary.series_missing_story_ref_project_count}`,
    `- series_relink_candidates: ${plan.summary.series_relink_candidate_count}`,
    `- series_archive_or_rebuild_candidates: ${plan.summary.series_archive_or_rebuild_candidate_count}`,
    `- series_planned_only: ${plan.summary.series_planned_only_count}`,
    `- series_contract_repair_candidates: ${plan.summary.series_contract_repair_candidate_count}`,
    `- story_ref_repair_candidates: ${plan.summary.story_ref_repair_candidate_count}`,
    `- ready_gears_signoff_candidates: ${plan.summary.ready_gears_signoff_candidate_count}`,
    '',
    '## Actions',
    '',
    ...(plan.actions.length
      ? plan.actions.map(action => [
        `- ${action.priority} · ${action.action_key} · ${action.target_count}`,
        `  - label: ${action.label}`,
        `  - runner: ${action.runner}`,
        `  - can_auto_apply: ${action.can_auto_apply}`,
        `  - next: ${action.next_step}`,
      ].join('\n'))
      : ['- none']),
    '',
    '## Notes',
    '',
    ...plan.notes.map(note => `- ${note}`),
  ].join('\n').trim() + '\n';
}

export async function getStoryAgentGeneratedGovernancePlan(
  options: GeneratedGovernanceOptions = {},
): Promise<StoryAgentGeneratedGovernancePlan> {
  const sampleLimit = boundedSampleLimit(options.limit);
  const health = await getStoryAgentGeneratedHealth();
  const seriesItems = health.items.filter(item => item.scope === 'ai_comic_series_project');
  const storyItems = health.items.filter(item => item.scope === 'story_project');
  const relinkSeries = seriesItems.filter(item => item.relink_candidate);
  const archiveOrRebuildSeries = seriesItems.filter(item => item.status === 'interrupted' && !item.relink_candidate);
  const plannedSeries = seriesItems.filter(item => item.status === 'planned');
  const contractRepairSeries = seriesItems.filter(item => item.status === 'production_gap');
  const storyRefRepair = storyItems.filter(item => item.status === 'interrupted');
  const readyTargets = health.items.filter(item => item.status === 'ready');

  const actions = [
    buildAction({
      action_key: 'restore_or_relink_series_story_refs',
      priority: 'P0',
      label: 'Restore missing episode story JSON or update generated_episode_story_ids',
      can_auto_apply: false,
      runner: 'operator',
      detail: 'Interrupted series with existing production or postproduction contract evidence should be relinked before they are judged as GEARS readiness failures.',
      next_step: 'Recover the missing generated story files from history or rewrite generated_episode_story_ids to existing story IDs, then rerun generated health.',
    }, relinkSeries, sampleLimit),
    buildAction({
      action_key: 'archive_or_rebuild_series_fixtures',
      priority: 'P1',
      label: 'Archive fixture-like interrupted series or rebuild them under the current contract',
      can_auto_apply: false,
      runner: 'operator',
      detail: 'Interrupted series without contract evidence are likely historical generated samples or incomplete drafts.',
      next_step: 'Mark these targets outside the GEARS signoff portfolio, or regenerate them with current Story Agent contracts.',
    }, archiveOrRebuildSeries, sampleLimit),
    buildAction({
      action_key: 'generate_first_series_episode',
      priority: 'P1',
      label: 'Generate the first episode for planned-only series',
      can_auto_apply: false,
      runner: 'story_agent_api',
      detail: 'Planned-only series are not GEARS worker candidates until they have at least one generated episode story and delivery contract.',
      next_step: 'Use the Story Agent series generation workflow to create the first episode, then rerun production readiness.',
    }, plannedSeries, sampleLimit),
    buildAction({
      action_key: 'repair_series_command_contracts',
      priority: 'P1',
      label: 'Repair missing series command-layer contracts',
      can_auto_apply: false,
      runner: 'story_agent_api',
      detail: 'Production-gap series have story refs but need delivery, ledger, subtitle, thumbnail, or final delivery command artifacts.',
      next_step: 'Run safe Story Agent readiness automation or regenerate the missing command contracts; media execution remains in GEARS v2.',
    }, contractRepairSeries, sampleLimit),
    buildAction({
      action_key: 'repair_story_project_refs',
      priority: 'P1',
      label: 'Repair interrupted single-story project references',
      can_auto_apply: false,
      runner: 'story_agent_api',
      detail: 'Single-story projects with missing current story or version refs should be repaired before portfolio readiness is used.',
      next_step: 'Restore the current version/story snapshot or create a new project version from an existing generated story.',
    }, storyRefRepair, sampleLimit),
    buildAction({
      action_key: 'promote_ready_targets_for_gears_signoff',
      priority: 'P2',
      label: 'Use ready generated targets for GEARS signoff smoke',
      can_auto_apply: false,
      runner: 'gears_worker',
      detail: 'Ready generated targets can be used as smoke candidates once the real GEARS v2 endpoint env is configured.',
      next_step: 'Export and run the GEARS worker acceptance kit only after generated governance noise is excluded from the signoff portfolio.',
    }, readyTargets, sampleLimit),
  ].filter(action => action.target_count > 0);

  const summary = {
    source_total_target_count: health.summary.total_target_count,
    ready_target_count: health.summary.ready_count,
    series_governance_attention_count: health.summary.series_governance_attention_count ?? 0,
    series_missing_story_ref_project_count: health.summary.series_missing_story_ref_project_count ?? 0,
    series_relink_candidate_count: relinkSeries.length,
    series_archive_or_rebuild_candidate_count: archiveOrRebuildSeries.length,
    series_planned_only_count: plannedSeries.length,
    series_contract_repair_candidate_count: contractRepairSeries.length,
    story_ref_repair_candidate_count: storyRefRepair.length,
    ready_gears_signoff_candidate_count: readyTargets.length,
  };

  const plan: Omit<StoryAgentGeneratedGovernancePlan, 'markdown'> = {
    schema_version: 'story-agent-generated-governance-plan/v1',
    generated_at: new Date().toISOString(),
    status: health.summary.total_target_count === 0
      ? 'blocked'
      : actions.some(action => action.priority === 'P0' || action.priority === 'P1')
        ? 'needs_action'
        : 'ready',
    summary,
    actions,
    notes: [
      'Read-only governance plan: no generated project, story, or series files are modified.',
      'Relink candidates have production or postproduction contract evidence but broken generated episode story refs.',
      'Archive/rebuild candidates should be excluded from GEARS signoff until they are regenerated or explicitly marked as fixtures.',
      'china-culture-kb remains the content and production command layer; media execution stays in GEARS v2.',
    ],
    source_health_summary: health.summary,
  };

  return {
    ...plan,
    markdown: renderMarkdown(plan),
  };
}
