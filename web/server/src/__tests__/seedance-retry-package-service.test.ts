import { describe, expect, it } from 'vitest';
import type {
  SeedanceShotLedger,
  SeedanceShotLedgerItem,
  StoryProductionBoardShotUnit,
  StoryProjectMeta,
} from '@shared/types.js';
import {
  buildSeedanceRetryPackage,
  buildSeedanceRetryPackageMarkdown,
  selectSeedanceRetryPackageShots,
  shouldRetrySeedanceShot,
} from '../services/seedance-retry-package-service.js';

function project(overrides: Partial<StoryProjectMeta> = {}): StoryProjectMeta {
  return {
    project_id: 'project-1',
    title: 'Seedance 重试测试',
    ...overrides,
  } as StoryProjectMeta;
}

function ledgerItem(overrides: Partial<SeedanceShotLedgerItem> = {}): SeedanceShotLedgerItem {
  return {
    production_id: 'seedance-shot-shot-1',
    shot_id: 'shot-1',
    source_scene_id: 1,
    status: 'failed',
    updated_at: '2026-07-20T00:00:00.000Z',
    failure_reason: 'provider timeout',
    failure_category: 'provider_timeout',
    provider_error_code: 'TIMEOUT',
    provider_job_id: 'provider-job-1',
    retry_count: 2,
    notes: [],
    versions: [],
    ...overrides,
  };
}

function ledger(items: SeedanceShotLedgerItem[]): SeedanceShotLedger {
  return {
    schema_version: 'seedance-shot-ledger/v1',
    updated_at: '2026-07-20T01:00:00.000Z',
    items,
  };
}

function shot(
  overrides: Partial<StoryProductionBoardShotUnit> = {},
): StoryProductionBoardShotUnit {
  return {
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
    seedance_material_validation: {} as StoryProductionBoardShotUnit['seedance_material_validation'],
    continuity_notes: ['承接上一镜雨势'],
    cultural_boundary: '服饰为艺术化复原',
    negative_constraints: ['禁止现代车辆'],
    qa_flags: [],
    ...overrides,
  };
}

describe('Seedance retry package service', () => {
  it('retries missing, failed, and ready-without-video items but skips completed or skipped shots', () => {
    expect(shouldRetrySeedanceShot()).toBe(true);
    expect(shouldRetrySeedanceShot(ledgerItem({ status: 'failed' }))).toBe(true);
    expect(shouldRetrySeedanceShot(ledgerItem({ status: 'ready', video_url: undefined }))).toBe(true);
    expect(shouldRetrySeedanceShot(ledgerItem({ status: 'ready', video_url: 'https://cdn.vendor.cn/shot.mp4' })))
      .toBe(false);
    expect(shouldRetrySeedanceShot(ledgerItem({ status: 'skipped' }))).toBe(false);
  });

  it('selects retry shots, defaults shots missing ledger state, and reports orphan ledger items', () => {
    const selection = selectSeedanceRetryPackageShots({
      shotUnits: [
        shot(),
        shot({ shot_id: 'shot-2', source_scene_id: 2 }),
        shot({ shot_id: 'shot-3', source_scene_id: 3 }),
      ],
      ledger: ledger([
        ledgerItem(),
        ledgerItem({
          production_id: 'seedance-shot-shot-2',
          shot_id: 'shot-2',
          source_scene_id: 2,
          status: 'ready',
          video_url: 'https://cdn.vendor.cn/shot-2.mp4',
        }),
        ledgerItem({
          production_id: 'seedance-orphan-shot',
          shot_id: 'orphan-shot',
          source_scene_id: 9,
          status: 'processing',
        }),
        ledgerItem({
          production_id: 'seedance-skipped-orphan',
          shot_id: 'skipped-orphan',
          status: 'skipped',
        }),
      ]),
    });

    expect(selection.shots.map(item => item.shot_id)).toEqual(['shot-1', 'shot-3']);
    expect(selection.shots[0]).toMatchObject({
      production_id: 'seedance-shot-shot-1',
      status: 'failed',
      retry_count: 2,
      failure_category: 'provider_timeout',
      provider_error_code: 'TIMEOUT',
      provider_job_id: 'provider-job-1',
    });
    expect(selection.shots[1]).toMatchObject({
      production_id: 'seedance-shot-shot-3',
      status: 'prompt_exported',
      retry_count: 0,
    });
    expect(selection.missingPromptShots).toEqual([{
      production_id: 'seedance-orphan-shot',
      shot_id: 'orphan-shot',
      source_scene_id: 9,
      reason: '账本中存在待处理镜头，但当前 Production Board 找不到对应镜头',
    }]);
  });

  it('keeps audience script, visual direction, camera, validation, and constraints in separate fields', () => {
    const selection = selectSeedanceRetryPackageShots({
      shotUnits: [shot()],
      ledger: ledger([ledgerItem()]),
    });

    expect(selection.shots[0].prompt).toEqual({
      duration_sec: 12,
      characters: ['阿青'],
      location: '江南石桥',
      script_text: '阿青提灯穿过雨幕。',
      visual_prompt: '雨后石桥，青衣少女提灯前行。',
      camera_suggestion: '中景缓慢跟拍',
      seedance_prompt: '0-3秒：石桥雨丝；3-7秒：少女提灯前行。',
      seedance_asset_slots: [expect.objectContaining({ reference_slot: '@图片1' })],
      seedance_validation_notes: ['保持灯笼位置连续'],
      negative_constraints: ['禁止现代车辆'],
    });
  });

  it('builds counts and Markdown from an explicit export time', () => {
    const pkg = buildSeedanceRetryPackage({
      project: project(),
      storyId: 'story-1',
      title: 'Seedance 重试测试',
      exportedAt: '2026-07-20T02:00:00.000Z',
      shotUnits: [shot()],
      ledger: ledger([
        ledgerItem(),
        ledgerItem({
          production_id: 'seedance-shot-shot-2',
          shot_id: 'shot-2',
          status: 'ready',
          video_url: 'https://cdn.vendor.cn/shot-2.mp4',
        }),
        ledgerItem({
          production_id: 'seedance-orphan-shot',
          shot_id: 'orphan-shot',
          status: 'failed',
        }),
      ]),
    });

    expect(pkg).toMatchObject({
      schema_version: 'story-seedance-retry-package/v1',
      exported_at: '2026-07-20T02:00:00.000Z',
      total_retry_shot_count: 1,
      skipped_ready_shot_count: 1,
      missing_prompt_shots: [expect.objectContaining({ shot_id: 'orphan-shot' })],
    });
    expect(pkg.markdown).toContain('# Seedance 重试测试 — Seedance 重试提交包');
    expect(pkg.markdown).toContain('状态: 失败');
    expect(pkg.markdown).toContain('失败分类: provider_timeout');
    expect(pkg.markdown).toContain('@图片1=阿青');
    expect(pkg.markdown).toContain('禁止现代车辆');
    expect(pkg.markdown).toContain('## 缺少提示词的待处理镜头');
    const { markdown, ...basePackage } = pkg;
    expect(buildSeedanceRetryPackageMarkdown(basePackage)).toBe(markdown);
  });
});
