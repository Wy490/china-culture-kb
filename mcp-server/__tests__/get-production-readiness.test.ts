import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getProductionReadiness } from '../src/tools/get-production-readiness.js';
import { getProductionReadinessPortfolio } from '../src/tools/get-production-readiness-portfolio.js';
import {
  getStoryAgentGeneratedGovernancePlan,
  runStoryAgentGeneratedGovernance,
} from '../src/tools/get-generated-governance-plan.js';
import { getStoryAgentGeneratedHealth } from '../src/tools/get-generated-health.js';

const tmpDir = path.join(os.tmpdir(), 'kb-production-readiness-test-' + Date.now());
const dataRoot = path.join(tmpDir, 'data');
const projectId = '20260622-story-ready--ai_comic_drama';
const seriesProjectId = '20260622-series-ready';

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });

  const projectRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId);
  fs.mkdirSync(path.join(projectRoot, 'versions'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: '20260622-story-ready',
    title: '测试生产项目',
    source_domain: 'china_culture',
    source_entry: '周敦颐——理学开山鼻祖',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    story_structure: 'single_event_drama',
    status: 'draft',
    created_at: '2026-06-22T01:00:00.000Z',
    updated_at: '2026-06-22T01:00:00.000Z',
    current_version_id: `${projectId}-v1`,
    version_count: 1,
    scene_count: 2,
    has_gears_segments: true,
    quality_passed: true,
    genre_score: 93,
    quality_issue_count: 0,
    seedance_shot_ledger: {
      schema_version: 'seedance-shot-ledger/v1',
      items: [{
        production_id: 'shot-1',
        shot_id: 'shot-1',
        status: 'ready',
        video_url: 'https://example.com/shot-1.mp4',
        retry_count: 0,
        notes: [],
        versions: [],
        updated_at: '2026-06-22T01:02:00.000Z',
      }, {
        production_id: 'shot-2',
        shot_id: 'shot-2',
        status: 'failed',
        failure_reason: 'render failed',
        retry_count: 1,
        notes: [],
        versions: [],
        updated_at: '2026-06-22T01:03:00.000Z',
      }],
    },
    gears_job_ledger: {
      schema_version: 'gears-job-ledger/v1',
      items: [{
        gears_job_id: 'gears-ready-1',
        job_type: 'seedance_video',
        source_unit_id: 'shot-1',
        status: 'ready',
        artifact_urls: ['https://example.com/shot-1.mp4'],
        submitted_at: '2026-06-22T01:01:00.000Z',
        updated_at: '2026-06-22T01:02:00.000Z',
      }, {
        gears_job_id: 'gears-failed-1',
        job_type: 'seedance_video',
        source_unit_id: 'shot-2',
        status: 'failed',
        failure_reason: 'render failed',
        submitted_at: '2026-06-22T01:01:00.000Z',
        updated_at: '2026-06-22T01:03:00.000Z',
      }],
    },
    production_readiness_automation_ledger: {
      schema_version: 'production-readiness-automation-run-ledger/v1',
      updated_at: '2026-06-22T01:06:00.000Z',
      total_run_count: 1,
      persisted_run_count: 1,
      latest_run: {
        run_id: 'production-readiness-run-story-1',
        scope: 'story_project',
        project_id: projectId,
        dry_run: false,
        started_at: '2026-06-22T01:05:00.000Z',
        completed_at: '2026-06-22T01:06:00.000Z',
        executed_step_count: 1,
        planned_step_count: 0,
        skipped_step_count: 0,
        failed_step_count: 0,
        before_status: 'needs_action',
        before_score: 72,
        after_status: 'needs_action',
        after_score: 78,
        steps: [{
          step_id: 'step-01-export-production-board',
          action_key: 'export_production_board',
          label: '导出 Production Board',
          status: 'executed',
        }],
        notes: ['persisted'],
      },
      items: [],
    },
  }, null, 2));
  fs.writeFileSync(path.join(projectRoot, 'versions', `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-22T01:00:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    quality_report: {
      passed: true,
      genre_score: 93,
      issues: [],
    },
    production_board_export: {
      exported_at: '2026-06-22T01:04:00.000Z',
      export_dir: 'exports/production-board',
      file_count: 6,
      delivery_stage: 'ready',
      delivery_stage_label: 'ready',
    },
    story: {
      storyId: '20260622-story-ready',
      title: '测试生产项目',
      full_text: '这是一个测试故事。',
      quality_report: {
        passed: true,
        genre_score: 93,
        issues: [],
      },
      scene_breakdown: [{ scene_id: 1, title: '开场' }, { scene_id: 2, title: '转折' }],
      gears_segments: [{ segment_id: 1, script_text: '开场文本' }, { segment_id: 2, script_text: '转折文本' }],
    },
  }, null, 2));

  const seriesRoot = path.join(tmpDir, 'web', 'generated', 'ai-comic-series-projects', seriesProjectId);
  fs.mkdirSync(seriesRoot, { recursive: true });
  fs.writeFileSync(path.join(seriesRoot, 'project.json'), JSON.stringify({
    project: {
      series_project_id: seriesProjectId,
      title: '测试系列',
      status: 'draft',
      created_at: '2026-06-22T02:00:00.000Z',
      updated_at: '2026-06-22T02:00:00.000Z',
      episode_count: 3,
      generated_episode_count: 2,
    },
    plan: {
      series_title: '测试系列',
      episode_count: 3,
      episodes: [
        { episode_no: 1, title: '第一集' },
        { episode_no: 2, title: '第二集' },
        { episode_no: 3, title: '第三集' },
      ],
    },
    generated_episode_story_ids: {
      1: 'story-1',
      2: 'story-2',
    },
    continuity_ledger: {},
    series_quality_audit: {
      schema_version: 'ai-comic-series-quality-audit/v1',
      passed: false,
      score: 76,
      generated_episode_count: 2,
      total_episode_count: 3,
      episodes_need_attention: [2],
      issues: ['第3集尚未生成'],
      checks: {
        all_episodes_generated: false,
        generated_ids_in_plan_range: true,
        ledger_covers_generated_episodes: true,
        completed_series_threads_resolved: false,
        known_episode_quality_pass_rate: 0.5,
      },
      episode_reports: [],
    },
    seedance_production: {
      schema_version: 'ai-comic-seedance-production-ledger/v1',
      items: [{
        production_id: 'ep1-shot1',
        episode_no: 1,
        episode_title: '第一集',
        shot_id: 'shot-1',
        status: 'submitted',
        retry_count: 0,
        notes: [],
        versions: [],
        updated_at: '2026-06-22T02:01:00.000Z',
      }],
    },
    seedance_review_ledger: {
      schema_version: 'ai-comic-seedance-review-ledger/v1',
      open_count: 1,
      resolved_count: 0,
      blocking_count: 1,
      final_reassemble_required: true,
      items: [],
    },
    production_readiness_automation_ledger: {
      schema_version: 'production-readiness-automation-run-ledger/v1',
      updated_at: '2026-06-22T02:06:00.000Z',
      total_run_count: 1,
      persisted_run_count: 1,
      latest_run: {
        run_id: 'production-readiness-run-series-1',
        scope: 'ai_comic_series',
        project_id: seriesProjectId,
        dry_run: false,
        started_at: '2026-06-22T02:05:00.000Z',
        completed_at: '2026-06-22T02:06:00.000Z',
        executed_step_count: 1,
        planned_step_count: 0,
        skipped_step_count: 0,
        failed_step_count: 0,
        before_status: 'blocked',
        before_score: 50,
        after_status: 'needs_action',
        after_score: 65,
        steps: [{
          step_id: 'step-01-generate-next-episode',
          action_key: 'generate_next_episode',
          label: '继续生成分集',
          status: 'executed',
        }],
        notes: ['persisted'],
      },
      items: [],
    },
  }, null, 2));

  const systemRoot = path.join(tmpDir, 'web', 'generated', 'system');
  fs.mkdirSync(systemRoot, { recursive: true });
  fs.writeFileSync(path.join(systemRoot, 'production-readiness-portfolio-automation-ledger.json'), JSON.stringify({
    schema_version: 'production-readiness-portfolio-run-ledger/v1',
    updated_at: '2026-06-22T03:06:00.000Z',
    total_run_count: 1,
    persisted_run_count: 1,
    latest_run: {
      run_id: 'production-readiness-portfolio-run-1',
      dry_run: false,
      started_at: '2026-06-22T03:05:00.000Z',
      completed_at: '2026-06-22T03:06:00.000Z',
      selected_target_count: 2,
      executed_target_count: 1,
      planned_target_count: 0,
      skipped_target_count: 1,
      failed_target_count: 0,
      targets: [{
        scope: 'story_project',
        project_id: projectId,
        title: '测试生产项目',
        priority_score: 60,
        status: 'executed',
        executed_step_count: 1,
        planned_step_count: 0,
        skipped_step_count: 0,
        failed_step_count: 0,
      }, {
        scope: 'ai_comic_series',
        project_id: seriesProjectId,
        title: '测试系列',
        priority_score: 90,
        status: 'skipped',
        executed_step_count: 0,
        planned_step_count: 0,
        skipped_step_count: 1,
        failed_step_count: 0,
      }],
      notes: ['portfolio ledger persisted'],
    },
    items: [],
  }, null, 2));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KB_ROOT;
});

describe('kb_get_production_readiness', () => {
  it('returns a single-story production readiness report', async () => {
    const result = await getProductionReadiness({ project_id: projectId });

    expect(result).not.toBeNull();
    expect(result!.schema_version).toBe('mcp-production-readiness/v1');
    expect(result!.scope).toBe('story_project');
    expect(result!.summary.gears_job_count).toBe(2);
    expect(result!.summary.failed_shot_count).toBe(1);
    expect(result!.issues.map(issue => issue.issue_id)).toContain('shot-production-failed');
    expect(result!.issues.map(issue => issue.issue_id)).toContain('gears-terminal-risk');
    expect(result!.automation_plan.schema_version).toBe('mcp-production-readiness-automation-plan/v1');
    expect(result!.automation_plan.steps.map(step => step.action_key)).toEqual(expect.arrayContaining([
      'export_retry_package',
      'sync_gears_jobs',
    ]));
    const retryStep = result!.automation_plan.steps.find(step => step.action_key === 'export_retry_package');
    expect(retryStep?.runner).toBe('story_agent_api');
    expect(retryStep?.mode).toBe('writes_project');
    expect(retryStep?.status).toBe('ready');
    expect(retryStep?.can_auto_execute).toBe(true);
    expect(retryStep?.api).toEqual({
      method: 'POST',
      path: `/api/projects/${projectId}/production-board/export-seedance-retry-package`,
    });
    const syncStep = result!.automation_plan.steps.find(step => step.action_key === 'sync_gears_jobs');
    expect(syncStep?.runner).toBe('gears_worker');
    expect(syncStep?.can_auto_execute).toBe(false);
    expect(syncStep?.prerequisites).toContain('GEARS_API_BASE_URL configured');
    expect(result!.latest_automation_run).toMatchObject({
      run_id: 'production-readiness-run-story-1',
      executed_step_count: 1,
      after_score: 78,
    });
    expect(result!.automation_ledger?.total_run_count).toBe(1);
    expect(result!.markdown).toContain('MCP Production Readiness');
    expect(result!.markdown).toContain('Automation Plan');
    expect(result!.markdown).toContain('Latest Automation Run');
  });

  it('returns an AI comic series production readiness report', async () => {
    const result = await getProductionReadiness({ series_project_id: seriesProjectId });

    expect(result).not.toBeNull();
    expect(result!.scope).toBe('ai_comic_series');
    expect(result!.summary.generated_episode_count).toBe(2);
    expect(result!.summary.total_episode_count).toBe(3);
    expect(result!.issues.map(issue => issue.issue_id)).toEqual(expect.arrayContaining([
      'series-quality-needs-attention',
      'episodes-not-complete',
      'open-review-items',
      'series-gears-ledger-empty',
    ]));
    expect(result!.next_actions.map(action => action.action_key)).toEqual(expect.arrayContaining([
      'generate_next_episode',
      'submit_gears_jobs',
    ]));
    expect(result!.automation_plan.steps.map(step => step.action_key)).toEqual(expect.arrayContaining([
      'generate_next_episode',
      'submit_gears_jobs',
      'export_review_repair_package',
    ]));
    const submitStep = result!.automation_plan.steps.find(step => step.action_key === 'submit_gears_jobs');
    expect(submitStep?.runner).toBe('gears_worker');
    expect(submitStep?.mode).toBe('external_execution');
    expect(submitStep?.status).toBe('blocked');
    expect(submitStep?.can_auto_execute).toBe(false);
    expect(submitStep?.blocked_by_issue_ids).toContain('open-review-items');
    expect(submitStep?.api).toEqual({
      method: 'POST',
      path: `/api/story-outline/ai-comic-series-projects/${seriesProjectId}/gears-jobs/submit`,
    });
    expect(submitStep?.prerequisites).toContain('GEARS_API_BASE_URL configured');
    const reviewStep = result!.automation_plan.steps.find(step => step.action_key === 'export_review_repair_package');
    expect(reviewStep?.status).toBe('manual');
    expect(reviewStep?.can_auto_execute).toBe(false);
    expect(result!.latest_automation_run).toMatchObject({
      run_id: 'production-readiness-run-series-1',
      executed_step_count: 1,
      after_score: 65,
    });
    expect(result!.automation_ledger?.total_run_count).toBe(1);
    expect(result!.markdown).toContain('Automation Plan');
    expect(result!.markdown).toContain('Latest Automation Run');
  });

  it('returns null for missing targets', async () => {
    const result = await getProductionReadiness({ project_id: 'missing-project' });
    expect(result).toBeNull();
  });

  it('returns a local production readiness portfolio across projects and series', async () => {
    const result = await getProductionReadinessPortfolio({ limit: 10 });

    expect(result.schema_version).toBe('mcp-production-readiness-portfolio/v1');
    expect(result.summary.total_target_count).toBeGreaterThanOrEqual(2);
    expect(result.summary.story_project_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.ai_comic_series_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.portfolio_automation_run_count).toBe(1);
    expect(result.latest_portfolio_automation_run).toMatchObject({
      run_id: 'production-readiness-portfolio-run-1',
      selected_target_count: 2,
      executed_target_count: 1,
    });
    expect(result.items.map(item => item.project_id)).toEqual(expect.arrayContaining([
      projectId,
      seriesProjectId,
    ]));
    expect(result.items[0]).toMatchObject({
      priority_score: expect.any(Number),
      status: expect.stringMatching(/ready|needs_action|blocked/),
    });
    expect(result.action_buckets.length).toBeGreaterThan(0);
    expect(result.markdown).toContain('MCP Production Readiness Portfolio');
    expect(result.markdown).toContain('portfolio automation runs: 1');
  });

  it('returns a local generated health audit for story and series projects', async () => {
    const plannedSeriesId = '20260622-series-planned';
    const plannedSeriesRoot = path.join(tmpDir, 'web', 'generated', 'ai-comic-series-projects', plannedSeriesId);
    fs.mkdirSync(plannedSeriesRoot, { recursive: true });
    fs.writeFileSync(path.join(plannedSeriesRoot, 'project.json'), JSON.stringify({
      project: {
        series_project_id: plannedSeriesId,
        title: '计划中系列',
        episode_count: 2,
        generated_episode_count: 0,
        created_at: '2026-06-22T04:00:00.000Z',
        updated_at: '2026-06-22T04:00:00.000Z',
      },
      plan: {
        series_title: '计划中系列',
        episode_count: 2,
        episodes: [],
      },
      generated_episode_story_ids: {},
    }, null, 2));

    const result = await getStoryAgentGeneratedHealth({ limit: 10 });

    expect(result.schema_version).toBe('mcp-story-agent-generated-health/v1');
    expect(result.summary.scanned_story_project_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.scanned_series_project_count).toBeGreaterThanOrEqual(2);
    expect(result.summary.ready_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.planned_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.interrupted_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_governance_attention_count).toBeGreaterThanOrEqual(2);
    expect(result.summary.series_missing_story_ref_project_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_contract_evidence_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_relink_candidate_count).toBeGreaterThanOrEqual(1);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'story_project',
        project_id: projectId,
        status: 'ready',
      }),
      expect.objectContaining({
        scope: 'ai_comic_series_project',
        project_id: seriesProjectId,
        status: 'interrupted',
        missing_contracts: expect.arrayContaining(['generated_episode_story_refs']),
        contract_evidence_count: expect.any(Number),
        relink_candidate: true,
      }),
      expect.objectContaining({
        scope: 'ai_comic_series_project',
        project_id: plannedSeriesId,
        status: 'planned',
      }),
    ]));
    expect(result.markdown).toContain('MCP Story Agent Generated Health');
    expect(result.markdown).toContain('series_relink_candidates');
    expect(result.notes.join('\n')).toContain('Series relink candidates');
  });

  it('returns a read-only generated governance plan', async () => {
    const result = await getStoryAgentGeneratedGovernancePlan({ limit: 5 });

    expect(result.schema_version).toBe('mcp-story-agent-generated-governance-plan/v1');
    expect(result.status).toMatch(/ready|needs_action|blocked/);
    expect(result.summary.source_total_target_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_relink_candidate_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_planned_only_count).toBeGreaterThanOrEqual(0);
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_key: 'restore_or_relink_series_story_refs',
        can_auto_apply: false,
        runner: 'operator',
      }),
      expect.objectContaining({
        action_key: 'promote_ready_targets_for_gears_signoff',
        can_auto_apply: false,
        runner: 'gears_worker',
      }),
    ]));
    expect(result.actions.find(action => action.action_key === 'restore_or_relink_series_story_refs')?.sample_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        project_id: seriesProjectId,
        relink_candidate: true,
      }),
    ]));
    expect(result.markdown).toContain('MCP Story Agent Generated Governance Plan');
    expect(result.notes.join('\n')).toContain('read-only');
  });

  it('returns a generated governance dry-run manifest', async () => {
    const result = await runStoryAgentGeneratedGovernance({
      dry_run: true,
      action_keys: ['restore_or_relink_series_story_refs'],
      max_targets: 1,
    });

    expect(result.schema_version).toBe('mcp-story-agent-generated-governance-run/v1');
    expect(result.dry_run).toBe(true);
    expect(result.status).toBe('needs_action');
    expect(result.planned_target_count).toBe(1);
    expect(result.blocked_target_count).toBe(0);
    expect(result.manifest.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_key: 'restore_or_relink_series_story_refs',
        project_id: seriesProjectId,
        status: 'planned',
        expected_file_changes: expect.arrayContaining([
          `web/generated/ai-comic-series-projects/${seriesProjectId}/project.json`,
        ]),
      }),
    ]));
    expect(result.markdown).toContain('MCP Story Agent Generated Governance Run');

    const blocked = await runStoryAgentGeneratedGovernance({
      dry_run: false,
      action_keys: ['restore_or_relink_series_story_refs'],
      max_targets: 1,
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.blocked_target_count).toBe(1);
    expect(blocked.notes.join('\n')).toContain('intentionally blocked');
  });
});
