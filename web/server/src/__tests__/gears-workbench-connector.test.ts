import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ErrorCodes } from '@shared/types.js';
import type {
  GearsWorkbenchCapabilities,
  GearsWorkbenchImportResult,
  StoryGenerateResult,
} from '@shared/types.js';
import { createProjectFromGeneratedStory } from '../services/project-service.js';
import {
  getGearsWorkbenchCapabilities,
  getGearsWorkbenchConfigInfo,
  importProjectToGearsWorkbench,
  downloadGearsWorkbenchMedia,
  requestGearsCharacterAssetBootstrap,
} from '../services/gears-workbench-connector.js';
import { getGearsWorkbenchImportAudit } from '../services/gears-workbench-audit-service.js';

const mapping = {
  character_style_pack_id: 'chinese-ink',
  scene_style_pack_id: 'chinese-ink',
  staging_pack_id: 'sorkin',
  visual_pack_id: 'neutral',
};

const zeroCredit = {
  workbench_data_only: true as const,
  provider_invoked: false as const,
  media_generated: false as const,
  public_artifact_url_count: 0 as const,
  counts_as_real_gears_seedance_delivery: false as const,
};

function capabilities(): GearsWorkbenchCapabilities {
  return {
    schema_version: 'gears-workbench-capabilities/v1',
    service: 'gears-workbench',
    supported_delivery_schemas: ['gears-delivery/v1'],
    workbench_import_supported: true,
    character_asset_bootstrap_supported: true,
    character_asset_generation_modes: ['local_test'],
    execution_worker_supported: false,
    bearer_auth_required: true,
    dry_run_default: true,
    atomic_execute: true,
    idempotent_execute: true,
    operator_recipe_promotion_supported: true,
    promotion_requires_real_asset_versions: true,
    promotion_invokes_provider: false,
    entity_types: ['project', 'character', 'scene', 'storyboard_draft'],
    endpoints: {
      capabilities: { method: 'GET', path: '/integrations/story-agent/capabilities' },
      dry_run: { method: 'POST', path: '/integrations/story-agent/imports/dry-run' },
      execute: { method: 'POST', path: '/integrations/story-agent/imports' },
      character_asset_bootstrap: {
        method: 'POST',
        path: '/integrations/story-agent/character-assets/bootstrap',
      },
      promote_storyboard_draft: {
        method: 'POST',
        path: '/integrations/story-agent/storyboard-drafts/{draft_id}/promote',
      },
    },
    available_character_style_pack_ids: ['chinese-ink'],
    available_scene_style_pack_ids: ['chinese-ink'],
    available_staging_pack_ids: ['sorkin'],
    available_visual_pack_ids: ['neutral'],
    unsupported_worker_paths: ['/gears/jobs', '/gears/jobs/{gears_job_id}'],
    credit_boundary: { ...zeroCredit },
  };
}

function story(): StoryGenerateResult {
  return {
    storyId: '20260716-story-wb1',
    sourceDomain: 'china_culture',
    title: '分宁断案',
    generation_type: 'character_story',
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '周敦颐从互相矛盾的证词里找出疑点。',
    theme: '良知与公正',
    full_text: '周敦颐展开案卷，先核对时辰，再让证人重述经过。矛盾显现后，他拒绝草率定罪。',
    scene_breakdown: [{
      scene_id: 1,
      title: '公堂复核',
      duration_sec: 12,
      location: '分宁县衙',
      time_of_day: '清晨',
      dramatic_function: '查明疑点',
      plot: '周敦颐展开案卷，先核对时辰，再让证人重述经过。矛盾显现后，他拒绝草率定罪。',
      key_action: '展开案卷逐条核对',
      characters: ['周敦颐'],
      visual_prompt: '北宋县衙晨光，人物与案桌关系清楚',
      camera_suggestion: '中景缓推至案卷特写',
      cultural_note: '县衙陈设遵循北宋语境',
      conflict: '旧判词与新证词互相矛盾',
    }],
    gears_segments: [{
      segment_id: 1,
      source_scene_id: 1,
      duration_sec: 12,
      panel_count: 6,
      script_text: '周敦颐展开案卷，先核对时辰，再让证人重述经过。',
      purpose: '揭示证词矛盾',
      visual_focus: ['案卷', '人物反应'],
      cultural_constraints: ['不出现清代官帽'],
      video_type: 'historical_drama',
      presentation_style: 'cinematic',
      segment_prompt_hint: '保持周敦颐服装和案卷位置连续',
    }],
    gears_segments_url: '/api/stories/20260716-story-wb1/gears-segments',
    cultural_constraints: ['文字不入画'],
    credibility_note: '基于知识库条目生成',
    characters: [{
      name: '周敦颐',
      role: 'protagonist',
      description: '北宋青年县吏，清癯端正，穿县吏常服，随身带案卷',
      arc: '从发现疑点到拒绝草率定罪',
    }],
  };
}

function importResult(mode: 'dry_run' | 'execute'): GearsWorkbenchImportResult {
  return {
    schema_version: 'gears-workbench-import-result/v1',
    mode,
    status: mode === 'dry_run' ? 'planned' : 'applied',
    import_id: mode === 'execute' ? '00000000-0000-0000-0000-000000000010' : undefined,
    idempotency_key: 'story-agent:test-project:test-story:v1',
    replayed: false,
    atomic: true,
    source: {
      source_system: 'story-agent',
      project_id: 'test-project',
      story_id: 'test-story',
      version_id: 'v1',
      source_domain: 'china_culture',
    },
    payload_sha256: 'a'.repeat(64),
    entities: [],
    blockers: [],
    warnings: ['workbench data only'],
    summary: {
      entity_count: 0,
      project_count: 0,
      character_count: 0,
      scene_count: 0,
      storyboard_draft_count: 0,
      create_count: 0,
      update_count: 0,
      reuse_count: 0,
      blocked_count: 0,
      provider_call_count: 0,
      media_artifact_count: 0,
      real_delivery_credit_count: 0,
    },
    credit_boundary: { ...zeroCredit },
  };
}

let generatedRoot = '';

beforeEach(async () => {
  generatedRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-workbench-connector-'));
  vi.stubEnv('WEB_GENERATED_ROOT', generatedRoot);
  vi.stubEnv('KB_ROOT', resolve(import.meta.dirname, '..', '..', '..', '..', 'data'));
  vi.stubEnv('GEARS_WORKBENCH_API_BASE_URL', 'http://gears-workbench.example.test');
  vi.stubEnv('GEARS_WORKBENCH_API_TOKEN', 'workbench-test-token');
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(generatedRoot, { recursive: true, force: true });
});

describe('gears-workbench-connector', () => {
  it('accepts and verifies a zero-credit local-test character artifact', async () => {
    const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
    const contentSha256 = createHash('sha256').update(png).digest('hex');
    const envelope = {
      schema_version: 'story-agent-character-asset-bootstrap/v1' as const,
      idempotency_key: 'story-agent:series-fixture:visual-bible:test',
      source: {
        source_system: 'story-agent' as const,
        project_id: 'series-fixture',
        version_id: 'visual-bible-test',
        source_fingerprint: `sha256:${'a'.repeat(64)}`,
      },
      character_style_pack_id: 'realistic',
      generation_mode: 'local_test' as const,
      characters: [{
        identity_id: 'series-character-shenyan',
        definition_fingerprint: `sha256:${'b'.repeat(64)}`,
        name: '沈砚',
        role_position: '主角' as const,
        species_type: '人类' as const,
        ethnicity: ['东亚'] as ['东亚'],
        gender: '男' as const,
        age_range: '青年' as const,
        appearance_features: '稳定人物外观',
        clothing: '稳定人物服装',
      }],
    };
    const receipt = {
      schema_version: 'story-agent-character-asset-bootstrap-result/v1',
      status: 'applied',
      idempotency_key: envelope.idempotency_key,
      generation_mode: 'local_test',
      source: envelope.source,
      characters: [{
        identity_id: 'series-character-shenyan',
        definition_fingerprint: `sha256:${'b'.repeat(64)}`,
        name: '沈砚',
        gears_project_id: '00000000-0000-0000-0000-000000000001',
        gears_character_id: '00000000-0000-0000-0000-000000000002',
        base_sheet_version_id: 'v1',
        provider: 'gears_local_test',
        model: 'gears-local-test-card',
        media_url: '/media/test.png',
        content_sha256: contentSha256,
        prompt_sha256: 'c'.repeat(64),
      }],
      external_provider_call_count: 0,
      local_test_artifact_count: 1,
      real_delivery_credit_count: 0,
      credit_boundary: {
        local_test_only: true,
        external_provider_invoked: false,
        counts_as_real_image_asset: false,
        counts_as_production_credit: false,
      },
    };
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(receipt), { status: 200 }))
      .mockResolvedValueOnce(new Response(png, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const bootstrap = await requestGearsCharacterAssetBootstrap(envelope);
    const media = await downloadGearsWorkbenchMedia('/media/test.png', contentSha256);

    expect(bootstrap.ok).toBe(true);
    expect(bootstrap.data).toMatchObject({
      external_provider_call_count: 0,
      real_delivery_credit_count: 0,
      credit_boundary: { counts_as_production_credit: false },
    });
    expect(media).toMatchObject({
      ok: true,
      data: {
        mime_type: 'image/png',
        content_sha256: contentSha256,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never treats execution-worker envs as workbench configuration', () => {
    vi.stubEnv('GEARS_WORKBENCH_API_BASE_URL', '');
    vi.stubEnv('GEARS_WORKBENCH_API_TOKEN', '');
    vi.stubEnv('GEARS_API_BASE_URL', 'http://execution-worker.example.test');
    vi.stubEnv('GEARS_API_TOKEN', 'worker-token');

    const config = getGearsWorkbenchConfigInfo();

    expect(config.ready_for_capability_probe).toBe(false);
    expect(config.execution_worker_envs_used).toBe(false);
    expect(config.missing_requirements).toEqual([
      'GEARS_WORKBENCH_API_BASE_URL',
      'GEARS_WORKBENCH_API_TOKEN',
    ]);
    expect(config.configuration_warnings.join('\n')).toContain('execution worker');
  });

  it('fails closed when capability discovery reports an execution worker', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      ...capabilities(),
      execution_worker_supported: true,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getGearsWorkbenchCapabilities();

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.error?.message).toContain('capability contract');
  });

  it('probes capabilities then sends an enriched dry-run envelope with Bearer auth', async () => {
    const created = await createProjectFromGeneratedStory(story(), '2026-07-16T08:00:00.000Z');
    const dryRun = importResult('dry_run');
    dryRun.idempotency_key = `story-agent:${created.project_id}:${created.storyId}:${created.current_version_id}`;
    dryRun.source = {
      source_system: 'story-agent',
      project_id: created.project_id!,
      story_id: created.storyId,
      version_id: created.current_version_id!,
      source_domain: created.sourceDomain!,
    };
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(capabilities()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(dryRun), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await importProjectToGearsWorkbench(
      created.project_id!,
      { mapping },
      'dry_run',
    );

    expect(result.ok).toBe(true);
    expect(result.data?.local_audit).toMatchObject({
      schema_version: 'gears-workbench-import-audit-receipt/v1',
      ledger_event_count: 1,
      separate_from_execution_worker_ledger: true,
      counts_as_real_gears_seedance_delivery: false,
    });
    const audit = await getGearsWorkbenchImportAudit(created.project_id!);
    expect(audit).toMatchObject({
      schema_version: 'gears-workbench-import-audit-ledger/v1',
      project_id: created.project_id,
      ledger_event_count: 1,
      separate_from_execution_worker_ledger: true,
      real_delivery_credit_count: 0,
    });
    expect(audit.items[0]).toMatchObject({
      mode: 'dry_run',
      status: 'planned',
      provider_call_count: 0,
      media_artifact_count: 0,
      real_delivery_credit_count: 0,
      separate_from_execution_worker_ledger: true,
      counts_as_real_gears_seedance_delivery: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://gears-workbench.example.test/integrations/story-agent/capabilities',
    );
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      'http://gears-workbench.example.test/integrations/story-agent/imports/dry-run',
    );
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer workbench-test-token',
      'content-type': 'application/json',
    });
    const body = JSON.parse(String(init?.body)) as Record<string, any>;
    expect(body.schema_version).toBe('gears-workbench-import/v1');
    expect(body.source).toMatchObject({
      source_system: 'story-agent',
      project_id: created.project_id,
      story_id: story().storyId,
      source_domain: 'china_culture',
    });
    expect(body.mapping).toEqual(mapping);
    expect(body.delivery.schema_version).toBe('gears-delivery/v1');
    expect(body.delivery.units[0]).toMatchObject({
      visual_prompt: '北宋县衙晨光，人物与案桌关系清楚',
      camera_suggestion: '中景缓推至案卷特写',
      segment_prompt_hint: '保持周敦颐服装和案卷位置连续',
      constraint_note: ['不出现清代官帽', '文字不入画'],
    });
  });

  it('rejects a response that tries to claim provider or real-delivery credit', async () => {
    const created = await createProjectFromGeneratedStory(story(), '2026-07-16T08:00:00.000Z');
    const preflight = importResult('dry_run');
    const invalid = importResult('execute') as unknown as Record<string, any>;
    for (const result of [preflight, invalid as unknown as GearsWorkbenchImportResult]) {
      result.idempotency_key = `story-agent:${created.project_id}:${created.storyId}:${created.current_version_id}`;
      result.source = {
        source_system: 'story-agent',
        project_id: created.project_id!,
        story_id: created.storyId,
        version_id: created.current_version_id!,
        source_domain: created.sourceDomain!,
      };
    }
    invalid.summary.provider_call_count = 1;
    invalid.credit_boundary.provider_invoked = true;
    invalid.credit_boundary.counts_as_real_gears_seedance_delivery = true;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(capabilities()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(preflight), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(invalid), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await importProjectToGearsWorkbench(
      created.project_id!,
      {
        mapping,
        expected_source_version_id: created.current_version_id!,
        expected_payload_sha256: preflight.payload_sha256,
      },
      'execute',
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.error?.message).toContain('zero-credit');
  });

  it('refuses execute before any workbench request when the project version changed after dry-run', async () => {
    const created = await createProjectFromGeneratedStory(story(), '2026-07-16T08:00:00.000Z');
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const result = await importProjectToGearsWorkbench(
      created.project_id!,
      {
        mapping,
        expected_source_version_id: `${created.current_version_id}-stale`,
        expected_payload_sha256: 'a'.repeat(64),
      },
      'execute',
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_ERROR,
      message: expect.stringContaining('project version changed'),
      details: expect.objectContaining({ execute_sent: false }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revalidates the exact dry-run payload hash before execute', async () => {
    const created = await createProjectFromGeneratedStory(story(), '2026-07-16T08:00:00.000Z');
    const preflight = importResult('dry_run');
    preflight.idempotency_key = `story-agent:${created.project_id}:${created.storyId}:${created.current_version_id}`;
    preflight.source = {
      source_system: 'story-agent',
      project_id: created.project_id!,
      story_id: created.storyId,
      version_id: created.current_version_id!,
      source_domain: created.sourceDomain!,
    };
    preflight.payload_sha256 = 'b'.repeat(64);
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(capabilities()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(preflight), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await importProjectToGearsWorkbench(
      created.project_id!,
      {
        mapping,
        expected_source_version_id: created.current_version_id!,
        expected_payload_sha256: 'a'.repeat(64),
      },
      'execute',
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_ERROR,
      message: expect.stringContaining('import payload changed'),
      details: expect.objectContaining({ execute_sent: false }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/imports'))).toBe(false);
    const audit = await getGearsWorkbenchImportAudit(created.project_id!);
    expect(audit.items).toEqual([expect.objectContaining({
      mode: 'dry_run',
      payload_sha256: 'b'.repeat(64),
      real_delivery_credit_count: 0,
    })]);
  });

  it('rejects a valid-shaped response for a different source identity', async () => {
    const created = await createProjectFromGeneratedStory(story(), '2026-07-16T08:00:00.000Z');
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(capabilities()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(importResult('dry_run')), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await importProjectToGearsWorkbench(
      created.project_id!,
      { mapping },
      'dry_run',
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(result.error?.message).toContain('identity');
    const audit = await getGearsWorkbenchImportAudit(created.project_id!);
    expect(audit.ledger_event_count).toBe(0);
  });
});
