/**
 * Opt-in real HTTP E2E against the sibling GEARS v2 workbench.
 *
 * Run only with an isolated GEARS database and fake credentials:
 * GEARS_WORKBENCH_CROSS_REPO_E2E=1
 * GEARS_WORKBENCH_API_BASE_URL=http://127.0.0.1:<port>
 * GEARS_WORKBENCH_API_TOKEN=<fake-jwt>
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import express from 'express';
import supertest from 'supertest';
import type { StoryGenerateResult } from '@shared/types.js';
import { createProjectFromGeneratedStory } from '../services/project-service.js';
import { getGearsWorkbenchCapabilities } from '../services/gears-workbench-connector.js';
import { projectsRouter } from '../routes/projects.js';
import { errorHandler } from '../middleware/error-handler.js';
import {
  ORIGINAL_FICTION_ENTRY_NAME,
  originalFictionDomainPack,
} from '../domains/original-fiction/domain-pack.js';

const enabled = process.env.GEARS_WORKBENCH_CROSS_REPO_E2E === '1';
const mapping = {
  character_style_pack_id: 'chinese-ink',
  scene_style_pack_id: 'chinese-ink',
  staging_pack_id: 'sorkin',
  visual_pack_id: 'neutral',
};

function e2eStory(): StoryGenerateResult {
  return {
    storyId: '20260716-story-xrepo1',
    sourceDomain: 'china_culture',
    title: '分宁断案跨仓库验收',
    generation_type: 'character_story',
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '周敦颐从证词时辰的矛盾中发现疑点。',
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
    gears_segments_url: '/api/stories/20260716-story-xrepo1/gears-segments',
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

describe.runIf(enabled)('Story Agent → GEARS workbench cross-repo E2E', () => {
  let generatedRoot = '';

  beforeAll(async () => {
    generatedRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-gears-xrepo-e2e-'));
    process.env.WEB_GENERATED_ROOT = generatedRoot;
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
    process.env.STORY_AGENT_ACCESS_MODE = 'disabled';
  });

  afterAll(async () => {
    await rm(generatedRoot, { recursive: true, force: true });
  });

  it('dry-runs, atomically imports, replays, and leaves formal recipes at zero', async () => {
    const capabilities = await getGearsWorkbenchCapabilities();
    expect(capabilities.ok).toBe(true);
    expect(capabilities.data).toMatchObject({
      workbench_import_supported: true,
      execution_worker_supported: false,
      operator_recipe_promotion_supported: true,
      promotion_requires_real_asset_versions: true,
      promotion_invokes_provider: false,
      credit_boundary: {
        counts_as_real_gears_seedance_delivery: false,
      },
    });

    const project = await createProjectFromGeneratedStory(
      e2eStory(),
      '2026-07-16T08:00:00.000Z',
    );
    const request = {
      idempotency_key: `story-agent:xrepo:${Date.now()}`,
      mapping,
    };
    const app = express();
    app.use(express.json());
    app.use('/api/projects', projectsRouter);
    app.use(errorHandler);
    const storyAgent = supertest(app);
    const dryRun = await storyAgent
      .post(`/api/projects/${project.project_id}/gears-workbench-import/dry-run`)
      .send(request);
    expect(dryRun.status, JSON.stringify(dryRun.body)).toBe(200);
    expect(dryRun.body.ok).toBe(true);
    expect(dryRun.body.data).toMatchObject({
      mode: 'dry_run',
      status: 'planned',
      summary: {
        project_count: 1,
        character_count: 1,
        scene_count: 1,
        storyboard_draft_count: 1,
        provider_call_count: 0,
        media_artifact_count: 0,
        real_delivery_credit_count: 0,
      },
      credit_boundary: {
        counts_as_real_gears_seedance_delivery: false,
      },
      local_audit: {
        ledger_event_count: 1,
        separate_from_execution_worker_ledger: true,
        counts_as_real_gears_seedance_delivery: false,
      },
    });
    const executeRequest = {
      ...request,
      expected_source_version_id: dryRun.body.data.source.version_id,
      expected_payload_sha256: dryRun.body.data.payload_sha256,
    };

    const applied = await storyAgent
      .post(`/api/projects/${project.project_id}/gears-workbench-import`)
      .send(executeRequest);
    expect(applied.status, JSON.stringify(applied.body)).toBe(200);
    expect(applied.body.ok).toBe(true);
    expect(applied.body.data).toMatchObject({
      mode: 'execute',
      status: 'applied',
      replayed: false,
      local_audit: {
        ledger_event_count: 3,
        separate_from_execution_worker_ledger: true,
      },
    });
    const replayed = await storyAgent
      .post(`/api/projects/${project.project_id}/gears-workbench-import`)
      .send(executeRequest);
    expect(replayed.status, JSON.stringify(replayed.body)).toBe(200);
    expect(replayed.body.ok).toBe(true);
    expect(replayed.body.data.replayed).toBe(true);
    expect(replayed.body.data.import_id).toBe(applied.body.data.import_id);
    expect(replayed.body.data.local_audit).toMatchObject({
      ledger_event_count: 5,
      separate_from_execution_worker_ledger: true,
      counts_as_real_gears_seedance_delivery: false,
    });

    const audit = await storyAgent
      .get(`/api/projects/${project.project_id}/gears-workbench-import-audit`);
    expect(audit.status, JSON.stringify(audit.body)).toBe(200);
    expect(audit.body.data).toMatchObject({
      ledger_event_count: 5,
      separate_from_execution_worker_ledger: true,
      real_delivery_credit_count: 0,
    });
    expect(audit.body.data.items).toHaveLength(5);
    expect(audit.body.data.items.every(
      (item: Record<string, unknown>) => item.provider_call_count === 0
        && item.media_artifact_count === 0
        && item.real_delivery_credit_count === 0,
    )).toBe(true);

    const projectEntity = applied.body.data.entities.find(
      (item: Record<string, unknown>) => item.entity_type === 'project',
    ) as Record<string, unknown> | undefined;
    expect(projectEntity?.target_entity_id).toBeTruthy();
    const baseUrl = process.env.GEARS_WORKBENCH_API_BASE_URL!;
    const token = process.env.GEARS_WORKBENCH_API_TOKEN!;
    const headers = { authorization: `Bearer ${token}` };
    const draftsResponse = await fetch(
      `${baseUrl}/integrations/story-agent/storyboard-drafts?project_id=${projectEntity!.target_entity_id}`,
      { headers },
    );
    expect(draftsResponse.status).toBe(200);
    const drafts = await draftsResponse.json() as Array<Record<string, unknown>>;
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      visual_prompt: '北宋县衙晨光，人物与案桌关系清楚',
      camera_suggestion: '中景缓推至案卷特写',
      segment_prompt_hint: '保持周敦颐服装和案卷位置连续',
      constraint_note: ['不出现清代官帽', '文字不入画'],
    });

    const recipesResponse = await fetch(
      `${baseUrl}/storyboard-recipes?project_id=${projectEntity!.target_entity_id}`,
      { headers },
    );
    expect(recipesResponse.status).toBe(200);
    expect(await recipesResponse.json()).toEqual([]);
  }, 30_000);

  it('imports a generated original_fiction project without changing the zero-credit boundary', async () => {
    const generated = await originalFictionDomainPack.generateStory({
      entry_name: ORIGINAL_FICTION_ENTRY_NAME,
      outline: [
        '林岚在旧街工作室修复一台即将被收走的放映机',
        '债主要求她当天交出工作室，她没有时间继续等待',
        '她发现放映机里藏着父亲留下的未完成胶片',
        '她必须在出售机器和完成首映之间选择',
        '林岚拒绝撤回决定并邀请街坊搭起银幕',
        '首映后她承担债务，带着工作室开始新的生活',
      ].join('。'),
      video_type: 'character_story',
      presentation_style: 'cinematic',
      target_video_duration: '1分钟',
      truth_mode: 'fictional_original',
      output_gears_segments: true,
      character_hints: [{
        name: '林岚',
        role_position: '主角',
        character_kind: 'named_person',
        source_text: '用户原创人物',
        asset_stability: 'recurring',
      }],
    });
    expect(generated.ok).toBe(true);
    const story = generated.data!;
    expect(story.sourceDomain).toBe('original_fiction');

    const app = express();
    app.use(express.json());
    app.use('/api/projects', projectsRouter);
    app.use(errorHandler);
    const storyAgent = supertest(app);
    const request = {
      idempotency_key: `story-agent:xrepo:original-fiction:${Date.now()}`,
      mapping,
    };
    const dryRun = await storyAgent
      .post(`/api/projects/${story.project_id}/gears-workbench-import/dry-run`)
      .send(request);
    expect(dryRun.status, JSON.stringify(dryRun.body)).toBe(200);
    expect(dryRun.body.data).toMatchObject({
      mode: 'dry_run',
      status: 'planned',
      source: {
        project_id: story.project_id,
        story_id: story.storyId,
        version_id: story.current_version_id,
        source_domain: 'original_fiction',
      },
      summary: {
        project_count: 1,
        character_count: 1,
        scene_count: 3,
        storyboard_draft_count: 6,
        provider_call_count: 0,
        media_artifact_count: 0,
        real_delivery_credit_count: 0,
      },
      credit_boundary: {
        counts_as_real_gears_seedance_delivery: false,
      },
    });

    const applied = await storyAgent
      .post(`/api/projects/${story.project_id}/gears-workbench-import`)
      .send({
        ...request,
        expected_source_version_id: dryRun.body.data.source.version_id,
        expected_payload_sha256: dryRun.body.data.payload_sha256,
      });
    expect(applied.status, JSON.stringify(applied.body)).toBe(200);
    expect(applied.body.data).toMatchObject({
      mode: 'execute',
      status: 'applied',
      replayed: false,
      source: { source_domain: 'original_fiction' },
      local_audit: {
        ledger_event_count: 3,
        separate_from_execution_worker_ledger: true,
        counts_as_real_gears_seedance_delivery: false,
      },
    });

    const projectEntity = applied.body.data.entities.find(
      (item: Record<string, unknown>) => item.entity_type === 'project',
    ) as Record<string, unknown> | undefined;
    expect(projectEntity?.target_entity_id).toBeTruthy();
    const baseUrl = process.env.GEARS_WORKBENCH_API_BASE_URL!;
    const token = process.env.GEARS_WORKBENCH_API_TOKEN!;
    const headers = { authorization: `Bearer ${token}` };
    const draftsResponse = await fetch(
      `${baseUrl}/integrations/story-agent/storyboard-drafts?project_id=${projectEntity!.target_entity_id}`,
      { headers },
    );
    expect(draftsResponse.status).toBe(200);
    const drafts = await draftsResponse.json() as Array<Record<string, unknown>>;
    expect(drafts).toHaveLength(6);
    expect(drafts.every(draft => typeof draft.visual_prompt === 'string'
      && typeof draft.camera_suggestion === 'string'
      && Array.isArray(draft.constraint_note))).toBe(true);

    const recipesResponse = await fetch(
      `${baseUrl}/storyboard-recipes?project_id=${projectEntity!.target_entity_id}`,
      { headers },
    );
    expect(recipesResponse.status).toBe(200);
    expect(await recipesResponse.json()).toEqual([]);
  }, 30_000);
});
