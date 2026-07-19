import { describe, expect, it } from 'vitest';
import type {
  GearsExternalCallbackHandoffItem,
  GearsExternalCallbackHandoffPackage,
  GearsJobLedger,
  GearsJobLedgerItem,
  StoryProductionBoardShotUnit,
  StoryProjectMeta,
} from '@shared/types.js';
import {
  buildGearsExternalCallbackHandoffItems,
  buildGearsExternalCallbackHandoffPackage,
  buildGearsExternalCallbackHandoffMarkdown,
  gearsExternalCallbackBatchSample,
  gearsExternalCallbackCurlCommand,
  gearsExternalCallbackSample,
  gearsExternalHandoffPrompt,
  gearsExternalOperationUrl,
  gearsExternalOperatorChecklist,
  gearsExternalPreflightPath,
  gearsExternalSafeImportPath,
  gearsJobExternalArtifactUrls,
  gearsJobLocalAcceptanceArtifactUrls,
} from '../services/gears-external-callback-handoff-service.js';

function project(overrides: Partial<StoryProjectMeta> = {}): StoryProjectMeta {
  return {
    project_id: 'project /汉',
    title: '外部回片测试',
    ...overrides,
  } as StoryProjectMeta;
}

function ledgerItem(overrides: Partial<GearsJobLedgerItem> = {}): GearsJobLedgerItem {
  return {
    ledger_id: 'ledger-1',
    gears_job_id: 'job-1',
    job_type: 'seedance_video',
    source_unit_id: 'shot /1',
    status: 'ready',
    artifact_urls: [],
    submitted_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function ledger(items: GearsJobLedgerItem[]): GearsJobLedger {
  return {
    schema_version: 'gears-job-ledger/v1',
    updated_at: '2026-07-20T01:00:00.000Z',
    items,
  };
}

function shot(
  overrides: Partial<StoryProductionBoardShotUnit> = {},
): StoryProductionBoardShotUnit {
  return {
    shot_id: 'shot /1',
    source_scene_id: 3,
    source_unit_id: 'scene-3-shot-1',
    duration_sec: 12,
    panel_count: 3,
    characters: ['阿青'],
    location: '江南石桥',
    script_text: '阿青提灯走过石桥。',
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

function handoffItem(
  overrides: Partial<GearsExternalCallbackHandoffItem> = {},
): GearsExternalCallbackHandoffItem {
  const item = ledgerItem();
  return {
    source_unit_id: item.source_unit_id,
    gears_job_id: item.gears_job_id,
    job_type: item.job_type,
    status: item.status,
    source_scene_id: 3,
    local_acceptance_artifact_urls: ['https://local.story-agent.invalid/gears-acceptance/shot-1.mp4'],
    external_artifact_urls: [],
    requires_external_artifact: true,
    callback_path: '/api/projects/project/gears-callback',
    callback_url: 'https://story.example.test/public/api/projects/project/gears-callback',
    callback_sample: gearsExternalCallbackSample({
      project: project(),
      storyId: 'story-1',
      item,
    }),
    ...overrides,
  };
}

function handoffPackage(
  overrides: Partial<Omit<GearsExternalCallbackHandoffPackage, 'markdown'>> = {},
): Omit<GearsExternalCallbackHandoffPackage, 'markdown'> {
  const item = handoffItem();
  return {
    schema_version: 'project-gears-external-callback-handoff/v1',
    project: project({ project_id: 'project-1' }),
    storyId: 'story-1',
    title: '外部回片测试',
    exported_at: '2026-07-20T01:00:00.000Z',
    callback_path: '/api/projects/project-1/gears-callback',
    callback_url: 'https://story.example.test/public/api/projects/project-1/gears-callback',
    preflight_path: '/api/projects/project-1/production-board/gears-jobs/preflight-external-callbacks',
    preflight_url: 'https://story.example.test/public/api/projects/project-1/production-board/gears-jobs/preflight-external-callbacks',
    safe_import_path: '/api/projects/project-1/production-board/gears-jobs/import-external-callbacks',
    safe_import_url: 'https://story.example.test/public/api/projects/project-1/production-board/gears-jobs/import-external-callbacks',
    total_job_count: 1,
    external_ready_count: 0,
    local_acceptance_ready_count: 1,
    pending_external_artifact_count: 1,
    callback_batch_sample: gearsExternalCallbackBatchSample([item]),
    callback_batch_preflight_curl: 'curl preflight',
    callback_batch_curl: 'curl import',
    operator_checklist: gearsExternalOperatorChecklist(),
    items: [item],
    ...overrides,
  };
}

describe('GEARS external callback handoff service', () => {
  it('builds an explicitly fake callback sample without losing ledger identity', () => {
    const sample = gearsExternalCallbackSample({
      project: project(),
      storyId: 'story-1',
      item: ledgerItem(),
    });

    expect(sample).toEqual({
      jobId: 'job-1',
      sourceUnitId: 'shot /1',
      jobType: 'seedance_video',
      sourceProjectId: 'project /汉',
      sourceStoryId: 'story-1',
      taskStatus: 'COMPLETED',
      progressPercent: 100,
      outputUrl: 'https://gears.example/videos/project%20%2F%E6%B1%89-shot%20%2F1.mp4',
      eventId: 'external-ready-shot /1',
      note: 'Replace outputUrl with the real GEARS/Seedance artifact URL before callback import.',
    });
  });

  it('builds a batch sample with the replacement and safety contract', () => {
    const item = handoffItem();
    const batch = gearsExternalCallbackBatchSample([item]);

    expect(batch.callbacks).toEqual([item.callback_sample]);
    expect(batch.replace_before_import).toEqual(expect.arrayContaining([
      expect.stringContaining('real GEARS/Seedance artifact URL'),
      expect.stringContaining('absolute public http(s) URL'),
      expect.stringContaining('unique'),
      expect.stringContaining('local_acceptance'),
    ]));
    expect(batch.import_note).toContain('safe external callback import endpoint');
  });

  it('encodes project ids in preflight and safe-import paths', () => {
    expect(gearsExternalPreflightPath('project /汉')).toBe(
      '/api/projects/project%20%2F%E6%B1%89/production-board/gears-jobs/preflight-external-callbacks',
    );
    expect(gearsExternalSafeImportPath('project /汉')).toBe(
      '/api/projects/project%20%2F%E6%B1%89/production-board/gears-jobs/import-external-callbacks',
    );
  });

  it('preserves a public path prefix when deriving operation URLs', () => {
    const callbackPath = '/api/projects/project-1/gears-callback';
    const operationPath = gearsExternalPreflightPath('project-1');

    expect(gearsExternalOperationUrl({
      callbackPath,
      callbackUrl: `https://story.example.test/public${callbackPath}`,
      operationPath,
    })).toBe(`https://story.example.test/public${operationPath}`);
    expect(gearsExternalOperationUrl({
      callbackPath,
      callbackUrl: callbackPath,
      operationPath,
    })).toBe(operationPath);
    expect(gearsExternalOperationUrl({
      callbackPath,
      callbackUrl: 'https://story.example.test/different/callback',
      operationPath,
    })).toBe(`https://story.example.test${operationPath}`);
  });

  it('uses public URLs when available and shell base-url expansion otherwise', () => {
    expect(gearsExternalCallbackCurlCommand({
      projectId: 'project-1',
      targetPath: '/preflight',
      targetUrl: 'https://story.example.test/public/preflight',
    })).toBe(
      'curl -sS -X POST "https://story.example.test/public/preflight" -H "content-type: application/json" --data-binary @project-1-gears-external-callbacks.json',
    );
    expect(gearsExternalCallbackCurlCommand({
      projectId: 'project-1',
      targetPath: '/preflight',
      targetUrl: '/preflight',
    })).toContain('"$STORY_AGENT_BASE_URL/preflight"');
  });

  it('keeps local-acceptance and external artifact URL sets separate and deduplicated', () => {
    const localUrl = 'https://local.story-agent.invalid/gears-acceptance/shot-1.mp4';
    const externalUrl = 'https://cdn.vendor.cn/shot-1.mp4';
    const item = ledgerItem({
      artifact_urls: [localUrl, externalUrl],
      artifacts: [
        { url: localUrl, role: 'local_acceptance' },
        { url: externalUrl, role: 'video' },
      ],
    });

    expect(gearsJobLocalAcceptanceArtifactUrls(item)).toEqual([localUrl]);
    expect(gearsJobExternalArtifactUrls(item)).toEqual([externalUrl]);
  });

  it('maps a board shot into a separated Seedance handoff prompt', () => {
    expect(gearsExternalHandoffPrompt(shot())).toEqual({
      duration_sec: 12,
      characters: ['阿青'],
      location: '江南石桥',
      script_text: '阿青提灯走过石桥。',
      visual_prompt: '雨后石桥，青衣少女提灯前行。',
      camera_suggestion: '中景缓慢跟拍',
      seedance_prompt: '0-3秒：石桥雨丝；3-7秒：少女提灯前行。',
      seedance_asset_slots: [expect.objectContaining({ reference_slot: '@图片1' })],
      seedance_validation_notes: ['保持灯笼位置连续'],
      negative_constraints: ['禁止现代车辆'],
    });
    expect(gearsExternalHandoffPrompt(undefined)).toBeUndefined();
  });

  it('selects only viable Seedance jobs missing external artifacts and joins shot prompts', () => {
    const localUrl = 'https://local.story-agent.invalid/gears-acceptance/shot-1.mp4';
    const localReady = ledgerItem({ artifact_urls: [localUrl] });
    const externalReady = ledgerItem({
      ledger_id: 'ledger-2',
      gears_job_id: 'job-2',
      source_unit_id: 'shot-2',
      artifact_urls: ['https://cdn.vendor.cn/shot-2.mp4'],
    });
    const failed = ledgerItem({
      ledger_id: 'ledger-3',
      gears_job_id: 'job-3',
      source_unit_id: 'shot-3',
      status: 'failed',
    });
    const imageJob = ledgerItem({
      ledger_id: 'ledger-4',
      gears_job_id: 'job-4',
      job_type: 'storyboard_image',
      source_unit_id: 'shot-4',
      status: 'submitted',
    });

    const items = buildGearsExternalCallbackHandoffItems({
      project: project({ project_id: 'project-1' }),
      storyId: 'story-1',
      ledger: ledger([localReady, externalReady, failed, imageJob]),
      shotUnits: [shot()],
      callbackPath: '/api/projects/project-1/gears-callback',
      callbackUrl: 'https://story.example.test/public/api/projects/project-1/gears-callback',
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source_unit_id: 'shot /1',
      gears_job_id: 'job-1',
      source_scene_id: 3,
      local_acceptance_artifact_urls: [localUrl],
      external_artifact_urls: [],
      requires_external_artifact: true,
      callback_sample: {
        sourceProjectId: 'project-1',
        sourceStoryId: 'story-1',
      },
      prompt: {
        script_text: '阿青提灯走过石桥。',
        visual_prompt: '雨后石桥，青衣少女提灯前行。',
      },
    });
  });

  it('assembles stable counts, public endpoints, commands, items, and Markdown', () => {
    const localUrl = 'https://local.story-agent.invalid/gears-acceptance/shot-1.mp4';
    const externalUrl = 'https://cdn.vendor.cn/shot-2.mp4';
    const callbackPath = '/api/projects/project-1/gears-callback';
    const pkg = buildGearsExternalCallbackHandoffPackage({
      project: project({ project_id: 'project-1' }),
      storyId: 'story-1',
      title: '外部回片测试',
      exportedAt: '2026-07-20T02:00:00.000Z',
      ledger: ledger([
        ledgerItem({ artifact_urls: [localUrl] }),
        ledgerItem({
          ledger_id: 'ledger-2',
          gears_job_id: 'job-2',
          source_unit_id: 'shot-2',
          artifact_urls: [externalUrl],
        }),
        ledgerItem({
          ledger_id: 'ledger-3',
          gears_job_id: 'job-3',
          source_unit_id: 'shot-3',
          status: 'failed',
        }),
      ]),
      shotUnits: [shot()],
      callbackPath,
      callbackUrl: `https://story.example.test/public${callbackPath}`,
    });

    expect(pkg).toMatchObject({
      schema_version: 'project-gears-external-callback-handoff/v1',
      exported_at: '2026-07-20T02:00:00.000Z',
      total_job_count: 3,
      external_ready_count: 1,
      local_acceptance_ready_count: 1,
      pending_external_artifact_count: 1,
      preflight_url: expect.stringContaining('https://story.example.test/public/api/projects/project-1/'),
      safe_import_url: expect.stringContaining('https://story.example.test/public/api/projects/project-1/'),
      items: [expect.objectContaining({ gears_job_id: 'job-1' })],
    });
    expect(pkg.callback_batch_sample.callbacks).toHaveLength(1);
    expect(pkg.callback_batch_preflight_curl).toContain(pkg.preflight_url);
    expect(pkg.callback_batch_curl).toContain(pkg.safe_import_url);
    expect(pkg.markdown).toContain('待外部 artifact: 1');
    expect(pkg.markdown).toContain('外部 ready: 1');
  });

  it('renders operator safety, commands, samples, and empty-item state in Markdown', () => {
    const itemMarkdown = buildGearsExternalCallbackHandoffMarkdown(handoffPackage());
    expect(itemMarkdown).toContain('# 外部回片测试 — GEARS 外部回片交接包');
    expect(itemMarkdown).toContain('local_acceptance URL 只代表本地链路验收');
    expect(itemMarkdown).toContain('## Operator Checklist');
    expect(itemMarkdown).toContain('Preflight curl:');
    expect(itemMarkdown).toContain('Safe import curl:');
    expect(itemMarkdown).toContain('"outputUrl"');
    expect(itemMarkdown).toContain('### shot /1 / job-1');

    const emptyMarkdown = buildGearsExternalCallbackHandoffMarkdown(handoffPackage({
      pending_external_artifact_count: 0,
      callback_batch_sample: gearsExternalCallbackBatchSample([]),
      items: [],
    }));
    expect(emptyMarkdown).toContain('当前没有缺少外部 artifact 的 GEARS job');
  });

  it('returns the stable operator checklist in workflow order', () => {
    const checklist = gearsExternalOperatorChecklist();

    expect(checklist).toHaveLength(8);
    expect(checklist[0]).toContain('real external GEARS/Seedance artifact');
    expect(checklist[5]).toContain('preflight endpoint');
    expect(checklist[6]).toContain('safe import endpoint');
    expect(checklist[7]).toContain('production readiness');
  });
});
