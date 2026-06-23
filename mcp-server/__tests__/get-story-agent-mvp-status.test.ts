import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getStoryAgentMvpStatus } from '../src/tools/get-story-agent-mvp-status.js';

const tmpRoot = path.join(os.tmpdir(), 'kb-story-agent-mvp-status-test-' + Date.now());
const dataRoot = path.join(tmpRoot, 'data');
const previousKbRoot = process.env.KB_ROOT;
const projectId = '20260623-story-mvp-mcp--ai_comic_drama';

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });

  const projectRoot = path.join(tmpRoot, 'web', 'generated', 'projects', projectId);
  fs.mkdirSync(path.join(projectRoot, 'versions'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: '20260623-story-mvp-mcp',
    current_version_id: `${projectId}-v1`,
    title: 'MCP Story Agent MVP 状态测试',
    source_domain: 'china_culture',
    source_entry: '周敦颐——理学开山鼻祖',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    status: 'draft',
    created_at: '2026-06-23T09:00:00.000Z',
    updated_at: '2026-06-23T09:01:00.000Z',
    version_count: 1,
    scene_count: 2,
    has_gears_segments: true,
    quality_passed: true,
    genre_score: 91,
  }, null, 2));
  fs.writeFileSync(path.join(projectRoot, 'versions', `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-23T09:01:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    quality_report: {
      passed: true,
      genre_score: 91,
      issues: [],
    },
    production_board_export: {
      exported_at: '2026-06-23T09:02:00.000Z',
      export_dir: 'exports/production-board',
      file_count: 4,
      delivery_stage: 'ready',
    },
    story: {
      storyId: '20260623-story-mvp-mcp',
      title: 'MCP Story Agent MVP 状态测试',
      full_text: '这是一个用于 MVP 状态测试的故事。',
      quality_report: {
        passed: true,
        genre_score: 91,
        issues: [],
      },
      scene_breakdown: [
        { scene_id: 1, title: '开场' },
        { scene_id: 2, title: '选择' },
      ],
      gears_segments: [
        { segment_id: 1, script_text: '开场文本' },
        { segment_id: 2, script_text: '选择文本' },
      ],
    },
  }, null, 2));
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('kb_get_story_agent_mvp_status', () => {
  it('combines generated health and production readiness into MVP lanes', async () => {
    const result = await getStoryAgentMvpStatus({ generated_limit: 10, portfolio_limit: 10 });

    expect(result.schema_version).toBe('mcp-story-agent-mvp-status/v1');
    expect(result.status).toMatch(/ready|needs_action|blocked/);
    expect(result.summary.generated_target_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.readiness_target_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.generated_governance_action_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.generated_governance_ready_signoff_candidate_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.mcp_story_agent_tool_count).toBe(20);
    expect(result.summary.mcp_story_agent_loop_percent).toBe(100);
    expect(result.summary.content_command_layer_percent).toBe(100);
    expect(result.summary.production_delivery_contract_percent).toBe(100);
    expect(result.summary.production_delivery_contract_surface_count).toBe(12);
    expect(result.generated_health.schema_version).toBe('mcp-story-agent-generated-health/v1');
    expect(result.generated_governance_plan.schema_version).toBe('mcp-story-agent-generated-governance-plan/v1');
    expect(result.production_portfolio.schema_version).toBe('mcp-production-readiness-portfolio/v1');
    expect(result.lanes.map(lane => lane.key)).toEqual(expect.arrayContaining([
      'generated_artifacts',
      'generated_governance',
      'story_quality',
      'repair_loop',
      'delivery_contract',
      'production_command',
    ]));
    expect(result.progress).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'generated_governance',
        percent: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'mcp_story_agent_loop',
        percent: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'content_command_layer',
        percent: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'production_delivery_contract',
        percent: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'gears_end_to_end_acceptance',
        percent: 95,
        blocker: expect.any(String),
      }),
    ]));
    expect(result.progress.find(slice => slice.key === 'mcp_story_agent_loop')?.evidence).toEqual(expect.arrayContaining([
      'implementation_progress=100',
      expect.stringContaining('tool_count=20'),
      expect.stringContaining('kb_generate_story_repair_prompt'),
      'media_execution=gears_v2',
    ]));
    expect(result.progress.find(slice => slice.key === 'content_command_layer')?.evidence).toEqual(expect.arrayContaining([
      'implementation_progress=100',
      'local_target_health_tracked_by=lanes',
      'real_media_execution=gears_v2',
    ]));
    expect(result.progress.find(slice => slice.key === 'production_delivery_contract')?.evidence).toEqual(expect.arrayContaining([
      'implementation_progress=100',
      'surface_count=12',
      expect.stringContaining('production_board_export'),
      expect.stringContaining('worker_evidence_signoff'),
      'local_target_health_tracked_by=delivery_contract_lane',
      'real_media_execution=gears_v2',
    ]));
    expect(result.lanes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'generated_governance',
        score: 100,
        status: 'ready',
      }),
    ]));
    expect(result.priority_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'story_project',
        project_id: projectId,
        priority_score: expect.any(Number),
      }),
    ]));
    expect(result.notes.join('\n')).toContain('Generated governance command surface is complete at 100%');
    expect(result.notes.join('\n')).toContain('MCP Story Agent loop is complete at 100%');
    expect(result.notes.join('\n')).toContain('Content and production command layer is complete at 100%');
    expect(result.notes.join('\n')).toContain('Production Board / Delivery Contract command surface is complete at 100%');
    expect(result.notes.join('\n')).toContain('content and production command layer');
    expect(result.notes.join('\n')).toContain('remaining 5%');
    expect(result.markdown).toContain('MCP Story Agent MVP Status');
    expect(result.markdown).toContain('Progress Split');
    expect(result.markdown).toContain('production delivery contract: 100%');
  });

  it('can omit markdown for compact agent reads', async () => {
    const result = await getStoryAgentMvpStatus({ include_markdown: false });

    expect(result.schema_version).toBe('mcp-story-agent-mvp-status/v1');
    expect(result.markdown).toBeUndefined();
  });
});
