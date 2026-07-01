import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { draftProductionMaterialPack } from './draft-production-material-pack.js';

const previousKbRoot = process.env.KB_ROOT;

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
});

describe('draftProductionMaterialPack', () => {
  it('creates an editor-review draft from source observations for a new video type', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-draft-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [
        {
          source_id: 'explainer-source-1',
          source_type: 'course_reference',
          applies_to_video_types: ['explainer_video'],
          title: '分层讲解结构',
          usable_takeaways: ['讲解类视频需要学习目标、知识层级、步骤和复盘。'],
        },
        {
          source_id: 'explainer-source-2',
          source_type: 'video_reference',
          applies_to_video_types: ['explainer_video'],
          title: '例子与图示',
          usable_takeaways: ['知识讲解应提前准备例子、图示、字幕关键词和可视化资产。'],
        },
        {
          source_id: 'explainer-source-3',
          source_type: 'production_reference',
          applies_to_video_types: ['explainer_video'],
          title: '边界和验收',
          usable_takeaways: ['来源、核验和交付验收项需要写进模板，避免把观点当事实。'],
        },
      ],
      packs: [],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    const report = await draftProductionMaterialPack({
      videoType: 'explainer_video',
      generatedAt: '2026-07-02T00:00:00.000Z',
    });

    expect(report.schema_version).toBe('production-material-pack-draft/v1');
    expect(report.status).toBe('ready_for_editor_review');
    expect(report.source_count).toBe(3);
    expect(report.draft_pack.video_type).toBe('explainer_video');
    expect(report.draft_pack.material_template.required_fields).toEqual(expect.arrayContaining([
      'learning_objective',
      'knowledge_layers',
      'step_sequence',
      'example_bank',
      'delivery_acceptance_checks',
    ]));
    expect(report.review_checklist.join('\n')).toContain('10 条高质量 sample_entries');
    expect(report.markdown).toContain('explainer_video 生产素材包草案');
  });

  it('keeps existing packs as review context instead of overwriting them', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-existing-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [],
      packs: [{
        video_type: 'social_short',
        label: '社媒短视频',
        goal: '把文化素材改成平台短视频。',
        material_template: {
          required_fields: ['opening_hook'],
          prompt_layers: ['钩子', '观点', '行动'],
          minimum_viable_story_gate: ['有开场钩子'],
          script_ready_gate: ['脚本可分段'],
          production_ready_gate: ['竖屏镜头已列清'],
          supplement_questions: ['前三秒看到什么？'],
        },
        sample_entries: [],
      }],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    const report = await draftProductionMaterialPack({ videoType: 'social_short' });

    expect(report.status).toBe('needs_more_sources');
    expect(report.draft_pack.label).toBe('社媒短视频');
    expect(report.draft_pack.material_template.required_fields).toContain('opening_hook');
    expect(report.warnings).toContain('目标 video_type 已有正式 ProductionMaterialPack，建议走增量审稿。');
  });
});
