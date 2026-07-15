import { describe, expect, it } from 'vitest';
import { resolveStoryProjectWorkflow } from '@shared/project-workflow.js';
import type { ProductionReadinessIssue, ProductionReadinessNextAction } from '@shared/types.js';

function action(actionKey: string, priority: number): ProductionReadinessNextAction {
  return {
    action_key: actionKey,
    label: `action:${actionKey}`,
    detail: `detail:${actionKey}`,
    priority,
  };
}

function workflow(overrides: {
  project_status?: 'draft' | 'edited' | 'exported' | 'finalized';
  readiness_status?: 'ready' | 'needs_action' | 'blocked';
  open_supplement_task_count?: number;
  gears_job_count?: number;
  external_ready_gears_job_count?: number;
  ready_without_external_gears_artifact_count?: number;
  next_actions?: ProductionReadinessNextAction[];
  issues?: ProductionReadinessIssue[];
} = {}) {
  return resolveStoryProjectWorkflow({
    project_id: 'project-1',
    project_status: overrides.project_status ?? 'draft',
    readiness_status: overrides.readiness_status ?? 'needs_action',
    open_supplement_task_count: overrides.open_supplement_task_count ?? 0,
    gears_job_count: overrides.gears_job_count ?? 0,
    external_ready_gears_job_count: overrides.external_ready_gears_job_count ?? 0,
    ready_without_external_gears_artifact_count: overrides.ready_without_external_gears_artifact_count ?? 0,
    next_actions: overrides.next_actions ?? [],
    issues: overrides.issues ?? [],
  });
}

describe('story project workflow', () => {
  it('selects exactly one highest-priority NEXT and reports all others as secondary', () => {
    const result = workflow({
      next_actions: [action('submit_gears_jobs', 50), action('repair_quality', 10), action('export_production_board', 30)],
    });

    expect(result.state).toBe('story_revision');
    expect(result.primary_next_action.action_key).toBe('repair_quality');
    expect(result.primary_next_action_count).toBe(1);
    expect(result.secondary_action_count).toBe(2);
  });

  it('keeps real external delivery explicit and grants no completion credit', () => {
    const result = workflow({
      next_actions: [action('export_gears_external_callback_handoff', 58)],
    });

    expect(result.state).toBe('external_delivery');
    expect(result.primary_next_action.external_input_required).toBe(true);
    expect(result.primary_next_action.counts_as_real_completion).toBe(false);
  });

  it('routes a ready project to human review instead of treating machine readiness as completion', () => {
    const result = workflow({ readiness_status: 'ready' });

    expect(result.state).toBe('human_review');
    expect(result.primary_next_action.route).toBe('/workspace/review');
    expect(result.credit_boundary).toBe('navigation_only_no_real_completion_credit');
  });

  it('routes finalized projects with real external artifacts to release governance, not signed release', () => {
    const result = workflow({
      project_status: 'finalized',
      readiness_status: 'ready',
      gears_job_count: 2,
      external_ready_gears_job_count: 2,
      ready_without_external_gears_artifact_count: 0,
    });

    expect(result.state).toBe('release_governance');
    expect(result.primary_next_action.label).toBe('进入发布验收');
    expect(result.primary_next_action.counts_as_real_completion).toBe(false);
  });
});
