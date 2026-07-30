import type {
  StoryAgentGeneratedGovernanceAction,
  StoryAgentGeneratedGovernanceActionKey,
  StoryAgentGeneratedGovernancePlan,
  StoryAgentGeneratedGovernanceRunRequest,
  StoryAgentGeneratedGovernanceRunResult,
  StoryAgentGeneratedGovernanceRunTarget,
  StoryAgentGeneratedGovernanceTarget,
  StoryAgentGeneratedHealthItem,
} from '@shared/types.js';
import { getStoryAgentGeneratedHealth } from './generated-health-service.js';
import {
  collectFinalDeliveryManifestDispositionEvents,
} from './final-delivery-manifest-disposition-ledger-service.js';

interface GeneratedGovernanceOptions {
  limit?: number;
}

const DEFAULT_RUN_ACTIONS: StoryAgentGeneratedGovernanceActionKey[] = [
  'review_final_delivery_manifest_gaps',
  'restore_or_relink_series_story_refs',
  'archive_or_rebuild_series_fixtures',
  'repair_story_project_refs',
];

function boundedSampleLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(Math.floor(limit ?? 20), 100));
}

function boundedRunTargetLimit(limit: number | undefined): number {
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
    final_delivery_manifest_missing: item.final_delivery_manifest_missing,
    final_delivery_dry_run: item.final_delivery_dry_run,
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
    `- series_final_delivery_manifest_review_candidates: ${plan.summary.series_final_delivery_manifest_review_candidate_count}`,
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

function operationForAction(actionKey: StoryAgentGeneratedGovernanceActionKey, target: StoryAgentGeneratedGovernanceTarget): string {
  switch (actionKey) {
    case 'review_final_delivery_manifest_gaps':
      return `Require an operator disposition for ${target.project_id}: preserve the fixture outside publishable delivery, or re-export only after authorized dependencies pass preflight.`;
    case 'restore_or_relink_series_story_refs':
      return `Restore missing generated story JSON for ${target.project_id}, or update generated_episode_story_ids to existing story IDs.`;
    case 'archive_or_rebuild_series_fixtures':
      return `Mark ${target.project_id} outside the GEARS signoff portfolio or rebuild it with current Story Agent contracts.`;
    case 'generate_first_series_episode':
      return `Generate the first episode story for ${target.project_id}, then rerun generated health and production readiness.`;
    case 'repair_series_command_contracts':
      return `Regenerate missing Story Agent command contracts for ${target.project_id}; media execution remains in GEARS v2.`;
    case 'repair_story_project_refs':
      return `Restore current story/version references for ${target.project_id}, or create a new project version from an existing generated story.`;
    case 'promote_ready_targets_for_gears_signoff':
      return `Use ${target.project_id} as a GEARS worker acceptance smoke candidate after endpoint env is configured.`;
  }
}

function expectedFileChanges(actionKey: StoryAgentGeneratedGovernanceActionKey, target: StoryAgentGeneratedGovernanceTarget): string[] {
  switch (actionKey) {
    case 'review_final_delivery_manifest_gaps':
      return [];
    case 'restore_or_relink_series_story_refs':
      return [
        `web/generated/ai-comic-series-projects/${target.project_id}/project.json`,
        'web/generated/stories/**/<missing-story-id>.json',
      ];
    case 'archive_or_rebuild_series_fixtures':
      return [
        `web/generated/ai-comic-series-projects/${target.project_id}/project.json`,
      ];
    case 'generate_first_series_episode':
      return [
        `web/generated/ai-comic-series-projects/${target.project_id}/project.json`,
        'web/generated/stories/ai_comic_drama/<new-story-id>.json',
      ];
    case 'repair_series_command_contracts':
      return [
        `web/generated/ai-comic-series-projects/${target.project_id}/project.json`,
      ];
    case 'repair_story_project_refs':
      return [
        `web/generated/projects/${target.project_id}/project.json`,
        `web/generated/projects/${target.project_id}/versions/<version-id>.json`,
      ];
    case 'promote_ready_targets_for_gears_signoff':
      return [];
  }
}

function requiresOperatorReview(actionKey: StoryAgentGeneratedGovernanceActionKey): boolean {
  return actionKey === 'review_final_delivery_manifest_gaps'
    || actionKey === 'restore_or_relink_series_story_refs'
    || actionKey === 'archive_or_rebuild_series_fixtures'
    || actionKey === 'promote_ready_targets_for_gears_signoff';
}

function renderRunMarkdown(result: Omit<StoryAgentGeneratedGovernanceRunResult, 'markdown'>): string {
  return [
    '# Story Agent Generated Governance Run',
    '',
    `> schema_version: ${result.schema_version}`,
    `> generated_at: ${result.generated_at}`,
    `> status: ${result.status}`,
    `> dry_run: ${result.dry_run}`,
    '',
    '## Summary',
    '',
    `- selected_action_count: ${result.selected_action_count}`,
    `- selected_target_count: ${result.selected_target_count}`,
    `- planned_target_count: ${result.planned_target_count}`,
    `- blocked_target_count: ${result.blocked_target_count}`,
    `- skipped_target_count: ${result.skipped_target_count}`,
    `- manifest_id: ${result.manifest.manifest_id}`,
    '',
    '## Manifest',
    '',
    ...(result.manifest.items.length
      ? result.manifest.items.slice(0, 50).map(item => [
        `- ${item.status} · ${item.action_key} · ${item.project_id}`,
        `  - operation: ${item.planned_operation}`,
        `  - expected_files: ${item.expected_file_changes.join(', ') || 'none'}`,
        item.operator_disposition_status ? `  - operator_disposition: ${item.operator_disposition_status}` : '',
        item.allowed_operator_dispositions?.length
          ? `  - allowed_dispositions: ${item.allowed_operator_dispositions.join(', ')}`
          : '',
        item.preflight_checks?.length ? `  - preflight: ${item.preflight_checks.join(', ')}` : '',
        item.publishable_delivery_credit_granted === false ? '  - publishable_delivery_credit_granted: false' : '',
        item.reason ? `  - reason: ${item.reason}` : '',
      ].filter(Boolean).join('\n'))
      : ['- none']),
    '',
    '## Notes',
    '',
    ...result.notes.map(note => `- ${note}`),
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
  const finalDeliveryManifestGaps = seriesItems.filter(item => item.final_delivery_manifest_missing === true);
  const archiveOrRebuildSeries = seriesItems.filter(item => item.status === 'interrupted' && !item.relink_candidate);
  const plannedSeries = seriesItems.filter(item => item.status === 'planned');
  const contractRepairSeries = seriesItems.filter(item =>
    item.status === 'production_gap' && item.final_delivery_manifest_missing !== true
  );
  const storyRefRepair = storyItems.filter(item => item.status === 'interrupted');
  const readyTargets = health.items.filter(item => item.status === 'ready');

  const actions = [
    buildAction({
      action_key: 'review_final_delivery_manifest_gaps',
      priority: 'P1',
      label: 'Review final-delivery manifest gaps before any publishable-delivery claim',
      can_auto_apply: false,
      runner: 'operator',
      detail: 'A concat/output plan without manifest is not publishable delivery evidence, including historical dry-run fixtures.',
      next_step: 'Choose preserve_fixture_exclude_from_publishable_delivery, or provide authorized media dependencies before a controlled final-delivery re-export.',
    }, finalDeliveryManifestGaps, sampleLimit),
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
    series_final_delivery_manifest_review_candidate_count: finalDeliveryManifestGaps.length,
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
      'Final-delivery manifest gaps require an explicit operator disposition; this plan never fabricates manifests or grants publishable-delivery credit.',
      'china-culture-kb remains the content and production command layer; media execution stays in GEARS v2.',
    ],
    source_health_summary: health.summary,
  };

  return {
    ...plan,
    markdown: renderMarkdown(plan),
  };
}

export async function runStoryAgentGeneratedGovernance(
  request: StoryAgentGeneratedGovernanceRunRequest = {},
): Promise<StoryAgentGeneratedGovernanceRunResult> {
  const maxTargets = boundedRunTargetLimit(request.max_targets);
  const requestedActionKeys = request.action_keys?.length ? request.action_keys : DEFAULT_RUN_ACTIONS;
  const requestedProjectIds = request.project_ids?.length ? new Set(request.project_ids) : undefined;
  const dryRun = request.dry_run ?? true;
  const plan = await getStoryAgentGeneratedGovernancePlan({ limit: maxTargets });
  const health = await getStoryAgentGeneratedHealth();
  const seriesItems = health.items.filter(item => item.scope === 'ai_comic_series_project');
  const storyItems = health.items.filter(item => item.scope === 'story_project');
  const dispositionEvents =
    await collectFinalDeliveryManifestDispositionEvents();
  const latestDispositionByProject = new Map(
    dispositionEvents.map(event => [event.series_project_id, event]),
  );
  const targetGroups: Record<StoryAgentGeneratedGovernanceActionKey, StoryAgentGeneratedHealthItem[]> = {
    review_final_delivery_manifest_gaps: seriesItems.filter(item => item.final_delivery_manifest_missing === true),
    restore_or_relink_series_story_refs: seriesItems.filter(item => item.relink_candidate),
    archive_or_rebuild_series_fixtures: seriesItems.filter(item => item.status === 'interrupted' && !item.relink_candidate),
    generate_first_series_episode: seriesItems.filter(item => item.status === 'planned'),
    repair_series_command_contracts: seriesItems.filter(item =>
      item.status === 'production_gap' && item.final_delivery_manifest_missing !== true
    ),
    repair_story_project_refs: storyItems.filter(item => item.status === 'interrupted'),
    promote_ready_targets_for_gears_signoff: health.items.filter(item => item.status === 'ready'),
  };
  const selectedActions = requestedActionKeys
    .map(actionKey => ({
      action_key: actionKey,
      targets: targetGroups[actionKey] ?? [],
    }))
    .filter(action => action.targets.length > 0);
  const manifestItems: StoryAgentGeneratedGovernanceRunTarget[] = [];

  for (const action of selectedActions) {
    const targets = requestedProjectIds
      ? action.targets.filter(target => requestedProjectIds.has(target.project_id))
      : action.targets;
    for (const item of targets) {
      if (manifestItems.length >= maxTargets) break;
      const target = toTarget(item);
      const recordedDisposition = action.action_key ===
        'review_final_delivery_manifest_gaps'
        ? latestDispositionByProject.get(target.project_id)
        : undefined;
      manifestItems.push({
        action_key: action.action_key,
        scope: target.scope,
        project_id: target.project_id,
        title: target.title,
        status: dryRun ? 'planned' : 'blocked',
        planned_operation: operationForAction(action.action_key, target),
        expected_file_changes: expectedFileChanges(action.action_key, target),
        requires_operator_review: requiresOperatorReview(action.action_key),
        ...(action.action_key === 'review_final_delivery_manifest_gaps' ? {
          operator_disposition_status: recordedDisposition?.disposition_status
            ?? 'awaiting_operator_decision' as const,
          ...(recordedDisposition ? {
            recorded_operator_disposition:
              recordedDisposition.disposition,
            operator_disposition_event_id: recordedDisposition.event_id,
            operator_disposition_preflight_status:
              recordedDisposition.preflight.status,
          } : {}),
          allowed_operator_dispositions: [
            'preserve_fixture_exclude_from_publishable_delivery' as const,
            'reexport_after_authorized_dependencies' as const,
          ],
          preflight_checks: [
            'verify_authorized_media_inputs',
            'verify_cut_subtitle_audio_title_card_dependencies',
            'verify_output_and_manifest_paths_are_project_scoped',
          ],
          preflight_api: {
            method: 'POST' as const,
            path: '/api/system/story-agent-final-delivery-manifest-preflight' as const,
            request_template: {
              series_project_id: target.project_id,
              disposition: 'preserve_fixture_exclude_from_publishable_delivery' as const,
              authorized_media_inputs_attested: false,
            },
          },
          publishable_delivery_credit_granted: false as const,
        } : {}),
        evidence: target.evidence,
        reason: dryRun
          ? 'dry_run=true: manifest only, no generated files are changed.'
          : 'dry_run=false is blocked in this version; review the manifest before enabling controlled writes.',
      });
    }
    if (manifestItems.length >= maxTargets) break;
  }

  const plannedTargetCount = manifestItems.filter(item => item.status === 'planned').length;
  const blockedTargetCount = manifestItems.filter(item => item.status === 'blocked').length;
  const selectedActionTargetCount = selectedActions.reduce((sum, action) => {
    const targets = requestedProjectIds
      ? action.targets.filter(target => requestedProjectIds.has(target.project_id))
      : action.targets;
    return sum + targets.length;
  }, 0);
  const skippedTargetCount = Math.max(0, selectedActionTargetCount - manifestItems.length);
  const generatedAt = new Date().toISOString();
  const result: Omit<StoryAgentGeneratedGovernanceRunResult, 'markdown'> = {
    schema_version: 'story-agent-generated-governance-run/v1',
    generated_at: generatedAt,
    status: !dryRun
      ? 'blocked'
      : manifestItems.length > 0
        ? 'needs_action'
        : 'ready',
    dry_run: dryRun,
    selected_action_count: selectedActions.length,
    selected_target_count: manifestItems.length,
    planned_target_count: plannedTargetCount,
    blocked_target_count: blockedTargetCount,
    skipped_target_count: skippedTargetCount,
    requested_action_keys: requestedActionKeys,
    manifest: {
      schema_version: 'story-agent-generated-governance-run-manifest/v1',
      manifest_id: `generated-governance-${generatedAt.replace(/[:.]/g, '-')}`,
      generated_at: generatedAt,
      dry_run: dryRun,
      items: manifestItems,
    },
    before_plan_summary: plan.summary,
    notes: [
      'This run is a governance manifest surface; no generated files are modified.',
      dryRun
        ? 'dry_run=true: review the manifest and expected file changes before any controlled write workflow.'
        : 'dry_run=false was requested but is intentionally blocked until an explicit controlled write workflow is implemented.',
      'Do not use archive/rebuild candidates as GEARS signoff evidence until they are relinked, regenerated, or explicitly excluded.',
      'Manifest-gap targets remain non-publishable until an operator chooses a disposition; this run does not write generated files.',
      'Media execution remains in GEARS v2; this manifest only concerns Story Agent generated artifacts and command contracts.',
    ],
  };

  return {
    ...result,
    markdown: renderRunMarkdown(result),
  };
}
