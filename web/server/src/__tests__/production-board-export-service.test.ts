import { describe, expect, it } from 'vitest';
import type {
  StoryProductionBoard,
  StoryProductionBoardExportFile,
} from '@shared/types.js';
import {
  buildProductionBoardDeliveryManifestDefinition,
  buildProductionBoardExportFileDefinitions,
  buildProductionBoardSeedanceExport,
  buildProductionBoardSeedanceMarkdown,
  buildSeedanceShotLedgerMarkdown,
} from '../services/production-board-export-service.js';

function board(): StoryProductionBoard {
  return {
    schema_version: 'story-production-board/v1',
    project_id: 'project-1',
    storyId: 'story-1',
    title: 'Production Board 导出测试',
    generated_at: '2026-07-20T00:00:00.000Z',
    character_assets: [],
    location_assets: [],
    costume_assets: [],
    prop_assets: [],
    director_plan: [],
    shot_units: [{
      shot_id: 'shot-1',
      source_scene_id: 1,
      source_unit_id: 'scene-1-shot-1',
      duration_sec: 12,
      panel_count: 3,
      characters: ['阿青'],
      location: '江南石桥',
      script_text: '阿青提灯穿过雨幕。',
      visual_prompt: '雨后石桥，青衣少女提灯前行。',
      camera_suggestion: '中景缓慢跟拍',
      production_prompt: 'production prompt',
      seedance_prompt: '0-3秒：石桥雨丝；3-7秒：少女提灯前行。',
      seedance_duration_sec: 12,
      seedance_validation_notes: ['保持灯笼位置连续'],
      seedance_asset_slots: [{
        asset_id: 'character-aqing',
        label: '阿青',
        kind: 'character',
        modality: 'image',
        reference_slot: '@图片1',
        role: 'character_reference',
        required: true,
        prompt_usage: '@图片1 作为阿青人物形象参考',
      }],
      seedance_material_validation: {
        total_file_count: 1,
        image_count: 1,
        video_count: 0,
        audio_count: 0,
        max_total_files: 9,
        max_image_files: 9,
        max_video_files: 3,
        max_audio_files: 3,
        missing_required_slots: [],
        prompt_complexity_score: 42,
        duration_sec: 12,
        duration_risk: 'ok',
        warnings: [],
      },
      continuity_notes: ['承接上一镜雨势'],
      cultural_boundary: '服饰为艺术化复原',
      negative_constraints: ['禁止现代车辆'],
      qa_flags: [],
    }],
    seedance_asset_report: {
      schema_version: 'seedance-asset-report/v1',
      markdown: '# Seedance 素材缺口报告',
    } as StoryProductionBoard['seedance_asset_report'],
    media_asset_library: {
      schema_version: 'media-asset-library/v1',
      project_id: 'project-1',
      story_id: 'story-1',
      generated_at: '2026-07-20T00:00:00.000Z',
      artifacts: [],
      bindings: [],
      summary: {
        artifact_count: 0,
        binding_count: 0,
        verified_artifact_count: 0,
        placeholder_artifact_count: 0,
        production_credit_binding_count: 0,
        legacy_unverified_artifact_count: 0,
        missing_artifact_binding_count: 0,
      },
      migration: {
        source_schema_version: 'seedance-asset-library/v1',
        legacy_item_count: 0,
        migrated_without_credit_count: 0,
      },
    },
    image_asset_job_plan: {
      schema_version: 'story-image-asset-job-plan/v1',
      project_id: 'project-1',
      story_id: 'story-1',
      generated_at: '2026-07-20T00:00:00.000Z',
      provider_invoked: false,
      production_credit_count: 0,
      summary: {
        requirement_count: 0,
        character_requirement_count: 0,
        location_requirement_count: 0,
        prop_requirement_count: 0,
        ready_to_submit_count: 0,
        production_ready_count: 0,
      },
      requirements: [],
    },
    seedance_shot_ledger: {
      schema_version: 'seedance-shot-ledger/v1',
      updated_at: '2026-07-20T01:00:00.000Z',
      items: [{
        production_id: 'seedance-shot-shot-1',
        shot_id: 'shot-1',
        source_scene_id: 1,
        status: 'failed',
        updated_at: '2026-07-20T01:00:00.000Z',
        provider_job_id: 'provider-job-1',
        retry_count: 1,
        notes: ['等待人工重试'],
        versions: [{
          version_id: 'seedance-shot-shot-1-v1',
          status: 'failed',
          created_at: '2026-07-20T01:00:00.000Z',
        }],
      }],
    },
    continuity_constraints: [],
    negative_constraints: [],
    supervision_report: {
      passed: false,
      score: 80,
      blockers: 0,
      warnings: 1,
      issue_count: 1,
      issues: [],
      priority_fixes: [],
    },
    repair_plan: {
      task_count: 0,
      blocker_task_count: 0,
      tasks: [],
    },
    delivery_manifest: {
      stage: 'needs_repair',
      stage_label: '需要修复',
      next_action: '修复失败镜头',
      blockers: [],
      ready_artifact_count: 5,
      artifacts: [],
    },
    qa_report: {
      passed: false,
      score: 80,
      issues: [],
      missing_asset_refs: [],
      prompt_pollution_flags: [],
      continuity_risks: [],
    },
    markdown: '# Production Board',
  };
}

function writtenFile(relativePath: string): StoryProductionBoardExportFile {
  return {
    file_id: relativePath.replace(/[^a-z]+/g, '-'),
    kind: 'board_json',
    label: relativePath,
    relative_path: `production-board/${relativePath}`,
    file_path: `/tmp/project-1/production-board/${relativePath}`,
    mime_type: 'application/json',
    byte_size: 128,
  };
}

describe('Production Board export service', () => {
  it('builds the stable Seedance JSON contract from structured shot units', () => {
    const result = buildProductionBoardSeedanceExport(board());

    expect(result).toMatchObject({
      schema_version: 'story-production-board-seedance-prompts/v1',
      project_id: 'project-1',
      storyId: 'story-1',
      delivery_stage: 'needs_repair',
      shot_count: 1,
      shot_units: [{
        shot_id: 'shot-1',
        duration_sec: 12,
        characters: ['阿青'],
        location: '江南石桥',
        prompt: '0-3秒：石桥雨丝；3-7秒：少女提灯前行。',
        asset_slots: [expect.objectContaining({ reference_slot: '@图片1' })],
        validation_notes: ['保持灯笼位置连续'],
      }],
    });
    expect(result.shot_units[0]).not.toHaveProperty('production_prompt');
  });

  it('renders Seedance prompt and ledger Markdown with operational context', () => {
    const value = board();
    const promptMarkdown = buildProductionBoardSeedanceMarkdown(value);
    const ledgerMarkdown = buildSeedanceShotLedgerMarkdown(value);

    expect(promptMarkdown).toContain('Seedance 2.0 镜头提示词');
    expect(promptMarkdown).toContain('@图片1=阿青');
    expect(promptMarkdown).toContain('文件 1/9；复杂度 42/100；风险 ok');
    expect(promptMarkdown).toContain('保持灯笼位置连续');
    expect(promptMarkdown).toContain(value.shot_units[0].seedance_prompt);
    expect(ledgerMarkdown).toContain('Seedance Shot Ledger');
    expect(ledgerMarkdown).toContain('失败: 1');
    expect(ledgerMarkdown).toContain('Provider Job: provider-job-1');
    expect(ledgerMarkdown).toContain('seedance-shot-shot-1-v1/failed');
  });

  it('builds the twelve non-manifest file definitions in stable order', () => {
    const definitions = buildProductionBoardExportFileDefinitions(board());

    expect(definitions).toHaveLength(12);
    expect(definitions.map(item => item.filename)).toEqual([
      'production-board.json',
      'production-board.md',
      'supervision-report.json',
      'repair-plan.json',
      'seedance-prompts.json',
      'seedance-prompts.md',
      'seedance-asset-report.json',
      'seedance-asset-report.md',
      'media-asset-library.json',
      'image-asset-job-plan.json',
      'seedance-shot-ledger.json',
      'seedance-shot-ledger.md',
    ]);
    expect(new Set(definitions.map(item => item.fileId)).size).toBe(12);
    expect(JSON.parse(definitions.find(item => item.filename === 'seedance-prompts.json')!.content))
      .toMatchObject({ shot_count: 1 });
    expect(definitions.find(item => item.filename === 'production-board.md')).toMatchObject({
      kind: 'board_markdown',
      mimeType: 'text/markdown',
      content: '# Production Board',
    });
  });

  it('builds a manifest definition from files that were actually written', () => {
    const files = [writtenFile('production-board.json'), writtenFile('seedance-prompts.json')];
    const definition = buildProductionBoardDeliveryManifestDefinition({
      projectId: 'project-1',
      board: board(),
      exportedAt: '2026-07-20T02:00:00.000Z',
      files,
    });
    const manifest = JSON.parse(definition.content);

    expect(definition).toMatchObject({
      fileId: 'delivery-manifest',
      kind: 'delivery_manifest',
      filename: 'manifest.json',
      mimeType: 'application/json',
    });
    expect(manifest).toMatchObject({
      schema_version: 'story-production-board-manifest/v1',
      project_id: 'project-1',
      storyId: 'story-1',
      exported_at: '2026-07-20T02:00:00.000Z',
      delivery_manifest: { stage: 'needs_repair' },
      files,
    });
  });
});
