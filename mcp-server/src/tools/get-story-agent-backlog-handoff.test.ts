import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getStoryAgentBacklogHandoff } from './get-story-agent-backlog-handoff.js';

let tmpRoot = '';
let dataRoot = '';
const previousKbRoot = process.env.KB_ROOT;
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-story-agent-backlog-handoff-'));
  dataRoot = path.join(tmpRoot, 'data');
  process.env.KB_ROOT = dataRoot;
  process.env.WEB_GENERATED_ROOT = path.join(tmpRoot, 'web-generated');
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('getStoryAgentBacklogHandoff', () => {
  it('joins generated health and supplement candidate tasks without province markdown writeback', async () => {
    const generatedRoot = process.env.WEB_GENERATED_ROOT!;
    const brokenProjectDir = path.join(generatedRoot, 'projects', 'health-missing-story');
    fs.mkdirSync(path.join(brokenProjectDir, 'versions'), { recursive: true });
    fs.writeFileSync(
      path.join(brokenProjectDir, 'project.json'),
      JSON.stringify({
        project_id: 'health-missing-story',
        current_story_id: 'missing-story',
        current_version_id: 'v1',
        title: 'Missing Story Fixture',
        updated_at: '2026-07-09T01:00:00.000Z',
      }),
    );

    const supplementProjectId = 'story-supplement-handoff';
    const supplementVersionId = `${supplementProjectId}-v1`;
    const supplementProjectDir = path.join(generatedRoot, 'projects', supplementProjectId);
    fs.mkdirSync(path.join(supplementProjectDir, 'versions'), { recursive: true });
    fs.writeFileSync(
      path.join(supplementProjectDir, 'project.json'),
      JSON.stringify({
        project_id: supplementProjectId,
        current_story_id: 'story-supplement-handoff-story',
        current_version_id: supplementVersionId,
        title: '侗寨鼓楼的夜谈',
        source_entry: '侗寨鼓楼',
        video_type: 'documentary_short',
        updated_at: '2026-07-09T02:00:00.000Z',
      }),
    );
    fs.writeFileSync(
      path.join(supplementProjectDir, 'versions', `${supplementVersionId}.json`),
      JSON.stringify({
        project_id: supplementProjectId,
        version_id: supplementVersionId,
        story: {
          story_id: 'story-supplement-handoff-story',
          title: '侗寨鼓楼的夜谈',
          source_entry: '侗寨鼓楼',
          video_type: 'documentary_short',
          scene_breakdown: [{ scene_id: 's1' }],
          gears_segments: [{ segment_id: 'g1' }],
          quality_report: { score: 90 },
          gears_delivery: { package_id: 'delivery-1' },
          knowledge_pack: {
            primary_entries: [{
              entry_name: '侗寨鼓楼',
              province: '贵州',
            }],
          },
          supplement_tasks: [{
            task_id: 'task-source-refs',
            label: '补齐口述来源与拍摄许可',
            stage: 'production_ready',
            blocking_level: 'blocking',
            recommended_question: '是否有可公开引用的访谈对象、出版物或地方志来源？',
            recommended_fields: ['source_refs', 'permission_boundary'],
            status: 'open',
            source: 'production_material_missing_field',
            updated_at: '2026-07-09T02:10:00.000Z',
          }],
        },
      }),
    );

    const report = await getStoryAgentBacklogHandoff({ limit: 10 });

    expect(report).toMatchObject({
      schema_version: 'mcp-story-agent-backlog-handoff/v1',
      source_health_schema: 'mcp-story-agent-generated-health/v1',
      source_supplement_candidate_schema: 'project-supplement-candidate-package/v1',
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      summary: expect.objectContaining({
        total_item_count: expect.any(Number),
        generated_health_item_count: expect.any(Number),
        supplement_candidate_item_count: 1,
        supplement_blocking_open_count: 1,
        p0_count: expect.any(Number),
      }),
    });
    expect(report.summary.p0_count).toBeGreaterThanOrEqual(2);
    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source_kind: 'generated_health',
        project_id: 'health-missing-story',
        priority: 'P0',
        action_type: 'repair_story_project_refs',
      }),
      expect.objectContaining({
        source_kind: 'supplement_candidate',
        project_id: supplementProjectId,
        priority: 'P0',
        action_type: 'complete_supplement_task',
        target_file: 'data/provinces/贵州.md',
      }),
    ]));
    expect(report.markdown).toContain('MCP Story Agent Backlog Handoff');
    expect(report.markdown).toContain('province_markdown_written: false');
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '贵州.md'))).toBe(false);

    const jsonOnly = await getStoryAgentBacklogHandoff({ include_markdown: false });
    expect(jsonOnly.markdown).toBeUndefined();
  });
});
