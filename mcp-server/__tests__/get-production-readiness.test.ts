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
const secondaryRelinkSeriesId = '20260622-series-relink-secondary';

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
  fs.mkdirSync(path.join(projectRoot, 'production-board'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'production-board', 'seedance-asset-report.json'), JSON.stringify({
    schema_version: 'seedance-asset-report/v1',
    placeholder_asset_count: 2,
    production_asset_ready_count: 1,
    assets: [],
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
      }, {
        production_id: 'ep1-shot2-test-failure',
        episode_no: 1,
        episode_title: '第一集',
        shot_id: 'shot-2',
        status: 'failed',
        provider_job_id: 'seedance-job-failed',
        failure_reason: '人物手部变形',
        retry_count: 1,
        notes: ['测试标记失败'],
        versions: [],
        updated_at: '2026-06-22T02:01:30.000Z',
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
    seedance_final_delivery: {
      status: 'planned',
      dry_run: true,
      output_path: 'delivery/final.mp4',
      concat_list_path: 'delivery/final.concat.txt',
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

  const secondaryRelinkRoot = path.join(tmpDir, 'web', 'generated', 'ai-comic-series-projects', secondaryRelinkSeriesId);
  fs.mkdirSync(secondaryRelinkRoot, { recursive: true });
  fs.writeFileSync(path.join(secondaryRelinkRoot, 'project.json'), JSON.stringify({
    project: {
      series_project_id: secondaryRelinkSeriesId,
      title: '第二个重连候选',
      status: 'draft',
      created_at: '2026-06-22T01:30:00.000Z',
      updated_at: '2026-06-22T01:30:00.000Z',
      episode_count: 1,
      generated_episode_count: 1,
    },
    plan: {
      series_title: '第二个重连候选',
      episode_count: 1,
      episodes: [
        { episode_no: 1, title: '第一集' },
      ],
    },
    generated_episode_story_ids: {
      1: 'missing-secondary-story',
    },
    gears_job_ledger: {
      schema_version: 'gears-job-ledger/v1',
      items: [{
        gears_job_id: 'gears-secondary-1',
        job_type: 'seedance_video',
        source_unit_id: 'episode-1:shot-1',
        status: 'ready',
        artifact_urls: ['https://example.com/secondary.mp4'],
      }],
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
    expect(result!.summary.seedance_placeholder_asset_count).toBe(2);
    expect(result!.summary.seedance_production_asset_ready_count).toBe(1);
    expect(result!.issues.map(issue => issue.issue_id)).toContain('shot-production-failed');
    expect(result!.issues.map(issue => issue.issue_id)).toContain('gears-terminal-risk');
    expect(result!.issues.map(issue => issue.issue_id)).toContain('seedance-assets-placeholder-only');
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
    expect(syncStep?.prerequisites).toContain('GEARS_EXECUTION_WORKER_API_BASE_URL configured (legacy accepted)');
    expect(result!.latest_automation_run).toMatchObject({
      run_id: 'production-readiness-run-story-1',
      executed_step_count: 1,
      after_score: 78,
    });
    expect(result!.automation_ledger?.total_run_count).toBe(1);
    expect(result!.markdown).toContain('MCP Production Readiness');
    expect(result!.markdown).toContain('Seedance placeholder assets: 2');
    expect(result!.markdown).toContain('Automation Plan');
    expect(result!.markdown).toContain('Latest Automation Run');
  });

  it('fails closed when the current project version snapshot is missing', async () => {
    const projectPath = path.join(tmpDir, 'web', 'generated', 'projects', projectId, 'project.json');
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8')) as Record<string, unknown>;
    project.current_version_id = `${projectId}-v9`;
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));

    await expect(getProductionReadiness({ project_id: projectId }))
      .rejects.toThrow(`项目当前版本快照缺失：${projectId}-v9`);
  });

  it('keeps local acceptance artifacts out of external GEARS readiness', async () => {
    const projectPath = path.join(tmpDir, 'web', 'generated', 'projects', projectId, 'project.json');
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8')) as Record<string, any>;
    const localAcceptanceUrl = `https://local.story-agent.invalid/gears-acceptance/${projectId}/shot-1.mp4`;
    project.seedance_shot_ledger.items = [{
      production_id: 'shot-1',
      shot_id: 'shot-1',
      status: 'ready',
      video_url: localAcceptanceUrl,
      retry_count: 0,
      notes: ['local acceptance artifact; not external provider output'],
      versions: [],
      updated_at: '2026-06-22T01:03:00.000Z',
    }];
    project.gears_job_ledger.items = [{
      gears_job_id: 'local-gears-seedance_video-shot-1-1',
      job_type: 'seedance_video',
      source_unit_id: 'shot-1',
      status: 'ready',
      artifact_urls: [localAcceptanceUrl],
      artifacts: [{
        kind: 'video',
        url: localAcceptanceUrl,
        role: 'local_acceptance',
        metadata: {
          acceptance_scope: 'local',
          not_external_provider_output: true,
        },
      }],
      submitted_at: '2026-06-22T01:01:00.000Z',
      updated_at: '2026-06-22T01:03:00.000Z',
    }];
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));

    const result = await getProductionReadiness({ project_id: projectId });
    const gearsLane = result?.lanes.find(lane => lane.key === 'gears_execution');

    expect(result?.summary.external_ready_gears_job_count).toBe(0);
    expect(result?.summary.local_acceptance_ready_gears_job_count).toBe(1);
    expect(result?.summary.ready_without_external_gears_artifact_count).toBe(1);
    expect(gearsLane?.status).toBe('needs_action');
    expect(gearsLane?.score).toBe(65);
    expect(result?.issues).toContainEqual(expect.objectContaining({
      issue_id: 'gears-local-acceptance-only',
      severity: 'info',
    }));
    expect(result?.next_actions.map(action => action.action_key)).toContain('export_gears_external_callback_handoff');
    expect(result?.automation_plan.steps).toContainEqual(expect.objectContaining({
      action_key: 'export_gears_external_callback_handoff',
      runner: 'operator_review',
      mode: 'manual',
      can_auto_execute: false,
    }));
    expect(result?.markdown).toContain('GEARS local acceptance ready: 1');
    expect(result?.markdown).toContain('GEARS ready without external artifact: 1');
  });

  it('returns an AI comic series production readiness report', async () => {
    const result = await getProductionReadiness({ series_project_id: seriesProjectId });

    expect(result).not.toBeNull();
    expect(result!.scope).toBe('ai_comic_series');
    expect(result!.summary.generated_episode_count).toBe(2);
    expect(result!.summary.total_episode_count).toBe(3);
    expect(result!.lanes.find(lane => lane.key === 'delivery_contract')).toMatchObject({
      status: 'needs_action',
      detail: expect.stringContaining('manifest'),
      evidence: expect.arrayContaining(['final_delivery manifest missing']),
    });
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
    expect(submitStep?.prerequisites).toContain('GEARS_EXECUTION_WORKER_API_BASE_URL configured (legacy GEARS_API_BASE_URL accepted)');
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
    expect(result.summary.seedance_placeholder_asset_count).toBeGreaterThanOrEqual(2);
    expect(result.summary.seedance_production_asset_ready_count).toBeGreaterThanOrEqual(1);
    expect(result.latest_portfolio_automation_run).toMatchObject({
      run_id: 'production-readiness-portfolio-run-1',
      selected_target_count: 2,
      executed_target_count: 1,
    });
    expect(result.items.map(item => item.project_id)).toEqual(expect.arrayContaining([
      projectId,
      seriesProjectId,
    ]));
    expect(result.items.find(item => item.project_id === projectId)).toMatchObject({
      seedance_placeholder_asset_count: 2,
      seedance_production_asset_ready_count: 1,
    });
    expect(result.items[0]).toMatchObject({
      priority_score: expect.any(Number),
      status: expect.stringMatching(/ready|needs_action|blocked/),
    });
    expect(result.action_buckets.length).toBeGreaterThan(0);
    expect(result.markdown).toContain('MCP Production Readiness Portfolio');
    expect(result.markdown).toContain('Seedance placeholder assets');
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
    expect(result.summary.series_seedance_failed_project_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_seedance_failed_item_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_seedance_failure_marker_project_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_seedance_test_fixture_failure_project_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.series_seedance_test_fixture_failure_item_count).toBeGreaterThanOrEqual(1);
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
        failed_production_item_count: 1,
        test_fixture_failure_item_count: 1,
        seedance_failure_marker_present: true,
      }),
      expect.objectContaining({
        scope: 'ai_comic_series_project',
        project_id: plannedSeriesId,
        status: 'planned',
      }),
    ]));
    expect(result.markdown).toContain('MCP Story Agent Generated Health');
    expect(result.markdown).toContain('series_relink_candidates');
    expect(result.markdown).toContain('series_seedance_test_fixture_failure_items');
    expect(result.notes.join('\n')).toContain('Series relink candidates');
    expect(result.notes.join('\n')).toContain('explicitly test-marked fixtures');
  });

  it('marks a current Story ID mismatch as an interrupted project instead of trusting the snapshot', async () => {
    const versionPath = path.join(
      tmpDir,
      'web',
      'generated',
      'projects',
      projectId,
      'versions',
      `${projectId}-v1.json`,
    );
    const snapshot = JSON.parse(fs.readFileSync(versionPath, 'utf-8')) as Record<string, any>;
    snapshot.story.storyId = '20260622-story-wrong-current';
    fs.writeFileSync(versionPath, JSON.stringify(snapshot, null, 2));

    const result = await getStoryAgentGeneratedHealth({ limit: 10 });
    const item = result.items.find(candidate => candidate.project_id === projectId);

    expect(item).toMatchObject({
      status: 'interrupted',
      missing_contracts: expect.arrayContaining(['current_story']),
    });
    expect(item?.evidence).toContain(
      'current_story_id=20260622-story-ready but version storyId=20260622-story-wrong-current',
    );
  });

  it('reversibly excludes manifest-listed historical series from GEARS signoff', async () => {
    const reportsDir = path.join(dataRoot, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(path.join(reportsDir, 'story-agent-soft-archive-manifest-20260710.json'), JSON.stringify({
      schema_version: 'story-agent-soft-archive-manifest/v1',
      mode: 'active_signoff_exclusion',
      policy: {
        signoff_exclusion_applied: true,
      },
      entries: [{
        project_id: seriesProjectId,
        execution_status: 'signoff_exclusion_active',
      }],
    }, null, 2));

    const result = await getStoryAgentGeneratedHealth({ limit: 10 });

    expect(result.summary.series_soft_archive_excluded_count).toBe(1);
    expect(result.summary.series_signoff_portfolio_count).toBe(1);
    expect(result.summary.signoff_portfolio_target_count).toBe(
      result.summary.total_target_count - 1,
    );
    expect(result.summary.signoff_portfolio_interrupted_count).toBe(
      result.summary.interrupted_count - 1,
    );
    expect(result.summary.soft_archive_excluded_target_count).toBe(1);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        project_id: seriesProjectId,
        signoff_eligible: false,
        governance_disposition: 'soft_archived_signoff_excluded',
      }),
      expect.objectContaining({
        project_id: secondaryRelinkSeriesId,
        signoff_eligible: true,
      }),
    ]));
    expect(result.notes.join('\n')).toContain('reversibly excluded');
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
      project_ids: [seriesProjectId],
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

    const targetedBeyondFirstSample = await runStoryAgentGeneratedGovernance({
      dry_run: true,
      action_keys: ['restore_or_relink_series_story_refs'],
      project_ids: [secondaryRelinkSeriesId],
      max_targets: 1,
    });
    expect(targetedBeyondFirstSample.status).toBe('needs_action');
    expect(targetedBeyondFirstSample.manifest.items).toEqual([
      expect.objectContaining({
        action_key: 'restore_or_relink_series_story_refs',
        project_id: secondaryRelinkSeriesId,
        status: 'planned',
      }),
    ]);

    const blocked = await runStoryAgentGeneratedGovernance({
      dry_run: false,
      action_keys: ['restore_or_relink_series_story_refs'],
      project_ids: [seriesProjectId],
      max_targets: 1,
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.blocked_target_count).toBe(1);
    expect(blocked.notes.join('\n')).toContain('intentionally blocked');
  });
});
