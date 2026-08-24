import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listProjectProductionReadinessTargetIds: vi.fn(),
  getProjectProductionReadiness: vi.fn(),
  listAiComicSeriesProductionReadinessTargetIds: vi.fn(),
  getAiComicSeriesProductionReadiness: vi.fn(),
}));

vi.mock('../services/project-service.js', () => ({
  exportProjectGearsExternalCallbackHandoff: vi.fn(),
  getProject: vi.fn(),
  getProjectProductionReadiness: mocks.getProjectProductionReadiness,
  importProjectGearsExternalCallbacks: vi.fn(),
  listProjectProductionReadinessTargetIds: mocks.listProjectProductionReadinessTargetIds,
  listProjects: vi.fn(),
  preflightProjectGearsExternalCallbacks: vi.fn(),
  runProjectProductionReadinessAutomation: vi.fn(),
}));

vi.mock('../services/ai-comic-series-service.js', () => ({
  getAiComicSeriesProductionReadiness: mocks.getAiComicSeriesProductionReadiness,
  listAiComicSeriesProductionReadinessTargetIds: mocks.listAiComicSeriesProductionReadinessTargetIds,
  listAiComicSeriesProjects: vi.fn(),
  runAiComicSeriesProductionReadinessAutomation: vi.fn(),
}));

vi.mock('../platform/story-storage-root.js', () => ({
  storyGeneratedRoot: () => '/private/tmp/story-agent-portfolio-concurrency-no-ledger',
}));

import { getProductionReadinessPortfolio } from '../services/production-readiness-portfolio-service.js';

function readiness(projectId: string): any {
  return {
    scope: 'story_project',
    title: projectId,
    project: { project_id: projectId, updated_at: '2026-08-22T10:00:00.000Z' },
    summary: {
      status: 'needs_action',
      score: 80,
      blocker_count: 0,
      warning_count: 1,
      next_action_count: 0,
      gears_job_count: 0,
      active_gears_job_count: 0,
      external_ready_gears_job_count: 0,
      local_acceptance_ready_gears_job_count: 0,
      ready_without_external_gears_artifact_count: 0,
      seedance_placeholder_asset_count: 0,
      seedance_production_asset_ready_count: 0,
    },
    automation_plan: {
      ready_step_count: 0,
      blocked_step_count: 0,
      manual_step_count: 1,
      external_step_count: 0,
    },
    issues: [],
    next_actions: [],
  };
}

describe('production readiness portfolio concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAiComicSeriesProductionReadinessTargetIds.mockResolvedValue({ ok: true, data: [] });
  });

  it('scans every target with bounded concurrency while preserving the item limit', async () => {
    const projects = Array.from(
      { length: 20 },
      (_, index) => `project-${String(index + 1).padStart(2, '0')}`,
    );
    let active = 0;
    let maxActive = 0;
    mocks.listProjectProductionReadinessTargetIds.mockResolvedValue({ ok: true, data: projects });
    mocks.getProjectProductionReadiness.mockImplementation(async (projectId: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active -= 1;
      return { ok: true, data: readiness(projectId) };
    });

    const report = await getProductionReadinessPortfolio({ limit: 5 });

    expect(mocks.getProjectProductionReadiness).toHaveBeenCalledTimes(20);
    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(8);
    expect(report.summary.total_target_count).toBe(20);
    expect(report.summary.story_project_count).toBe(20);
    expect(report.items).toHaveLength(5);
  });
});
