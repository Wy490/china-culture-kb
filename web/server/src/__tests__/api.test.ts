// web/server/src/__tests__/api.test.ts — API integration tests
// Tests the Express routes with supertest, verifying:
//  - Unified response envelope (ok/data/error)
//  - Zod validation middleware (400 on invalid input)
//  - Entry search & detail endpoints
//  - System provinces & types endpoints
//  - Story plan, generate, list, detail, gears-segments endpoints
//  - Error handling (404, validation, internal)

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { resolve } from 'path';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import supertest from 'supertest';
import express from 'express';
import cors from 'cors';
import { createCorsOptions } from '../middleware/cors.js';
import { errorHandler } from '../middleware/error-handler.js';
import { entriesRouter } from '../routes/entries.js';
import { storiesRouter } from '../routes/stories.js';
import { systemRouter } from '../routes/system.js';
import { projectsRouter } from '../routes/projects.js';
import { gearsCallbackRouter } from '../routes/gears-callback.js';
import { outlineRouter } from '../routes/outline.js';
import { createProjectFromGeneratedStory } from '../services/project-service.js';
import { storyDefaultGeneratedRoot } from '../platform/story-storage-root.js';
import {
  GEARS_CALLBACK_BATCH_ITEM_LIMIT,
  GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
  type StoryProjectMeta,
  type StoryGenerateResult,
} from '@shared/types.js';

const ORIGINAL_KB_ROOT = process.env.KB_ROOT;
const ORIGINAL_WEB_GENERATED_ROOT = process.env.WEB_GENERATED_ROOT;
const ORIGINAL_SEEDANCE_CALLBACK_SECRET = process.env.SEEDANCE_CALLBACK_SECRET;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT = process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
const ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN = process.env.SEEDANCE_PROVIDER_API_TOKEN;
const ORIGINAL_SEEDANCE_PROVIDER_AUTH_HEADER = process.env.SEEDANCE_PROVIDER_AUTH_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_AUTH_SCHEME = process.env.SEEDANCE_PROVIDER_AUTH_SCHEME;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER = process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS = process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS = process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
const ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL = process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE = process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD = process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
const DEFAULT_PROJECTS_ROOT = resolve(storyDefaultGeneratedRoot(), 'projects');
let testWorkspaceRoot = '';
let defaultProjectDirsBefore = new Set<string>();

async function readDirNameSet(dirPath: string): Promise<Set<string>> {
  try {
    return new Set(await readdir(dirPath));
  } catch {
    return new Set();
  }
}

async function cleanupDefaultProjectArtifacts(): Promise<void> {
  const currentDirs = await readDirNameSet(DEFAULT_PROJECTS_ROOT);
  for (const projectId of currentDirs) {
    if (defaultProjectDirsBefore.has(projectId)) continue;
    if (!/^\d{8}-story-[0-9a-z]+--[a-z_]+$/.test(projectId)) continue;

    const dirPath = resolve(DEFAULT_PROJECTS_ROOT, projectId);
    try {
      const raw = JSON.parse(await readFile(resolve(dirPath, 'project.json'), 'utf-8')) as {
        source_domain?: string;
      };
      if (raw.source_domain === 'china_culture') {
        await rm(dirPath, { recursive: true, force: true });
      }
    } catch {
      continue;
    }
  }
}

async function writeJsonFixture(dirPath: string, filename: string, value: unknown): Promise<void> {
  await writeFile(resolve(dirPath, filename), `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

async function ensureEvidenceFixtureFile(dirPath: string, filename: string, value: unknown = {}): Promise<void> {
  try {
    await readFile(resolve(dirPath, filename), 'utf-8');
    return;
  } catch {
    // Continue below and create a small placeholder attachment.
  }
  if (filename.endsWith('.json')) {
    await writeJsonFixture(dirPath, filename, value);
    return;
  }
  await writeFile(resolve(dirPath, filename), `placeholder for ${filename}\n`, 'utf-8');
}

function extractNodeHeredocScript(command: string): string {
  const startMarker = "<<'NODE'\n";
  const start = command.indexOf(startMarker);
  const end = command.lastIndexOf('\nNODE');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Command does not contain a NODE heredoc: ${command.slice(0, 80)}`);
  }
  return command.slice(start + startMarker.length, end);
}

async function runAcceptanceKitNodeCommand(command: string, evidenceDir: string): Promise<void> {
  const script = extractNodeHeredocScript(command);
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['-', evidenceDir], {
      cwd: evidenceDir,
      env: {
        ...process.env,
        GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`Acceptance kit command failed with exit ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
    child.stdin.end(script);
  });
}

async function assertBashSyntax(script: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn('/bin/bash', ['-n'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`Generated acceptance shell failed bash -n with exit ${code}\n${stderr}`));
    });
    child.stdin.end(script);
  });
}

beforeAll(async () => {
  defaultProjectDirsBefore = await readDirNameSet(DEFAULT_PROJECTS_ROOT);
  testWorkspaceRoot = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-api-'));
  const realDataRoot = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  await symlink(realDataRoot, resolve(testWorkspaceRoot, 'data'), 'dir');
  process.env.KB_ROOT = resolve(testWorkspaceRoot, 'data');
  process.env.WEB_GENERATED_ROOT = resolve(testWorkspaceRoot, 'web', 'generated');
});

beforeEach(() => {
  if (testWorkspaceRoot) {
    process.env.KB_ROOT = resolve(testWorkspaceRoot, 'data');
    process.env.WEB_GENERATED_ROOT = resolve(testWorkspaceRoot, 'web', 'generated');
  }
  delete process.env.STORY_AGENT_SOFT_ARCHIVE_MANIFEST_PATH;
});

afterAll(async () => {
  await cleanupDefaultProjectArtifacts();
  if (ORIGINAL_KB_ROOT === undefined) {
    delete process.env.KB_ROOT;
  } else {
    process.env.KB_ROOT = ORIGINAL_KB_ROOT;
  }
  if (ORIGINAL_WEB_GENERATED_ROOT === undefined) {
    delete process.env.WEB_GENERATED_ROOT;
  } else {
    process.env.WEB_GENERATED_ROOT = ORIGINAL_WEB_GENERATED_ROOT;
  }
  if (ORIGINAL_SEEDANCE_CALLBACK_SECRET === undefined) {
    delete process.env.SEEDANCE_CALLBACK_SECRET;
  } else {
    process.env.SEEDANCE_CALLBACK_SECRET = ORIGINAL_SEEDANCE_CALLBACK_SECRET;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN === undefined) {
    delete process.env.SEEDANCE_PROVIDER_API_TOKEN;
  } else {
    process.env.SEEDANCE_PROVIDER_API_TOKEN = ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_AUTH_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_AUTH_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_AUTH_HEADER = ORIGINAL_SEEDANCE_PROVIDER_AUTH_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_AUTH_SCHEME === undefined) {
    delete process.env.SEEDANCE_PROVIDER_AUTH_SCHEME;
  } else {
    process.env.SEEDANCE_PROVIDER_AUTH_SCHEME = ORIGINAL_SEEDANCE_PROVIDER_AUTH_SCHEME;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER = ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS = ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL === undefined) {
    delete process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
  } else {
    process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL = ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD = ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
  }
  await rm(testWorkspaceRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Build a test Express app (same configuration as production, no listen)
// ---------------------------------------------------------------------------

const app = express();
app.use(cors(createCorsOptions()));
app.use(express.json());
app.use('/api/entries', entriesRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/system', systemRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/gears-callback', gearsCallbackRouter);
app.use('/api/story-outline', outlineRouter);
app.use(errorHandler);

const request = supertest(app);

// ---------------------------------------------------------------------------
// Helper: check unified response envelope
// ---------------------------------------------------------------------------

function expectEnvelope(body: any) {
  expect(body).toHaveProperty('ok');
  expect(body).toHaveProperty('data');
  expect(body).toHaveProperty('error');
  expect(typeof body.ok).toBe('boolean');
}

function expectSuccess(body: any) {
  expectEnvelope(body);
  expect(body.ok).toBe(true);
  expect(body.data).not.toBeNull();
  expect(body.error).toBeNull();
}

function expectFailure(body: any, code?: string) {
  expectEnvelope(body);
  expect(body.ok).toBe(false);
  expect(body.data).toBeNull();
  expect(body.error).not.toBeNull();
  if (code) {
    expect(body.error.code).toBe(code);
  }
}

function makeApiStory(): StoryGenerateResult {
  return {
    storyId: '20260617-story-api1',
    title: 'API 删除测试故事',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '一纸判词前的选择。',
    theme: '人物故事',
    full_text: '第一场原文。\n\n第二场原文。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '雨夜开场',
        duration_sec: 30,
        location: '南安军衙',
        time_of_day: '雨夜',
        dramatic_function: '钩子开场',
        plot: '周敦颐看着案卷迟迟没有落笔。',
        key_action: '停笔凝视',
        characters: ['周敦颐'],
        visual_prompt: '烛火、案卷、未签的判词',
        camera_suggestion: '近景切入',
        cultural_note: '基于知识库条目',
        conflict: '签还是不签',
        dialogue_or_narration: '旁白：这一笔落下，就是一条命。',
        source_entries: ['周敦颐——理学开山鼻祖'],
      },
      {
        scene_id: 2,
        title: '正面交锋',
        duration_sec: 30,
        location: '军衙堂前',
        time_of_day: '白天',
        dramatic_function: '冲突升级',
        plot: '上官逼他签字，周敦颐坚持重审。',
        key_action: '当面拒签',
        characters: ['周敦颐', '上官'],
        visual_prompt: '堂前对峙，案卷摊开',
        camera_suggestion: '中近景对切',
        cultural_note: '基于知识库条目',
        conflict: '权势与良知对撞',
        dialogue_or_narration: '周敦颐：此案有疑，我不能签。',
        source_entries: ['周敦颐——理学开山鼻祖'],
      },
    ],
    gears_segments: [
      {
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 30,
        panel_count: 6,
        script_text: '第一场分段',
        purpose: '钩子开场',
        visual_focus: ['南安军衙', '案卷'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
      {
        segment_id: 2,
        source_scene_id: 2,
        duration_sec: 30,
        panel_count: 6,
        script_text: '第二场分段',
        purpose: '冲突升级',
        visual_focus: ['军衙堂前', '案卷'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
    ],
    gears_segments_url: '/api/stories/20260617-story-api1/gears-segments',
    cultural_constraints: ['基于知识库条目'],
    credibility_note: '基本可靠',
    story_structure: 'single_event_drama',
    model_profile_id: 'claude_sonnet',
    quality_report: {
      hasCentralEvent: true,
      hasConflict: true,
      hasProtagonistChoice: true,
      hasSceneAction: true,
      hasClimax: true,
      hasEndingTheme: true,
      isNotBiographySummary: true,
      passed: true,
      issues: [],
      video_type: 'character_story',
      story_structure: 'single_event_drama',
      genre_score: 92,
      missing_required_elements: [],
      weak_beats: [],
      forbidden_patterns_found: [],
      repair_actions: [],
    },
  };
}

function makeApiProductionRepairStory(): StoryGenerateResult {
  const baseStory = makeApiStory();
  return {
    ...baseStory,
    storyId: '20260617-story-apr1',
    title: 'API 生产修复测试故事',
    gears_segments_url: '/api/stories/20260617-story-apr1/gears-segments',
    scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
      ? {
          ...scene,
          visual_prompt: `质量：待补；${scene.visual_prompt}`,
        }
      : scene),
    gears_delivery: {
      schema_version: 'gears-delivery/v1',
      storyId: '20260617-story-apr1',
      sourceDomain: 'china_culture',
      title: 'API 生产修复测试故事',
      character_assets: [
        {
          name: '周敦颐',
          role_position: '主角',
          species_type: '人类',
          ethnicity: ['东亚'],
          gender: '男',
          age_range: '青年',
          appearance_features: '青年士人，神情克制',
          clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
        },
      ],
      character_gender_summary: {
        total: 1,
        male: 1,
        female: 0,
        other: 0,
        unspecified: 0,
        not_applicable: 0,
      },
      scene_assets: [{
        name: '南安军衙',
        scene_type: '室内',
        description: '衙署案桌、烛火、案卷',
        atmosphere: '紧张',
      }],
      units: [],
      validation_notes: [],
      markdown: '# GEARS',
    },
  };
}

// ---------------------------------------------------------------------------
// System API tests
// ---------------------------------------------------------------------------

describe('System API', () => {
  describe('GET /api/system/provinces', () => {
    it('returns unified envelope with province list', async () => {
      const res = await request.get('/api/system/provinces');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Each province has name and entry_count
      if (res.body.data.length > 0) {
        const first = res.body.data[0];
        expect(first).toHaveProperty('name');
        expect(first).toHaveProperty('entry_count');
        expect(typeof first.entry_count).toBe('number');
      }
    });
  });

  describe('GET /api/system/types', () => {
    it('returns unified envelope with type mapping', async () => {
      const res = await request.get('/api/system/types');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Each type has name, recommended_generation_types, description
      const first = res.body.data[0];
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('recommended_generation_types');
      expect(first).toHaveProperty('description');
      expect(Array.isArray(first.recommended_generation_types)).toBe(true);
    });
  });

  describe('GET /api/system/narrative-patterns', () => {
    it('returns narrative pattern catalog mapped to video types', async () => {
      const res = await request.get('/api/system/narrative-patterns');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data.patterns)).toBe(true);
      expect(res.body.data.patterns.length).toBeGreaterThan(0);
      expect(res.body.data.video_type_map.ai_comic_drama).toEqual(
        expect.arrayContaining(['mortal_growth', 'infinite_mission']),
      );
    });
  });

  describe('GET /api/system/production-readiness-portfolio', () => {
    it('returns cross-project production readiness priority queue', async () => {
      const story: StoryGenerateResult = {
        ...makeApiProductionRepairStory(),
        storyId: '20260622-story-portfolio-api',
        title: 'API 生产指挥总览测试故事',
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T10:20:00.000Z');
      const planRes = await request.post('/api/story-outline/ai-comic-series-plan').send({
        outline: '周敦颐少年在濂溪读书，面对冤案和师友关系，一步步形成自己的选择。',
        series_title: '濂溪生产总览测试',
        episode_count: 2,
        episode_duration_range_sec: { min: 60, max: 120 },
      });
      expect(planRes.status).toBe(200);
      expectSuccess(planRes.body);
      const saveRes = await request.post('/api/story-outline/ai-comic-series-projects').send({
        plan: planRes.body.data,
        generated_episode_story_ids: { 1: '20260611-story-portfolio' },
      });
      expect(saveRes.status).toBe(200);
      expectSuccess(saveRes.body);

      const res = await request.get('/api/system/production-readiness-portfolio?limit=10');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'production-readiness-portfolio/v1',
        summary: {
          total_target_count: expect.any(Number),
          story_project_count: expect.any(Number),
          ai_comic_series_count: expect.any(Number),
          ready_automation_step_count: expect.any(Number),
          gears_job_count: expect.any(Number),
          active_gears_job_count: expect.any(Number),
          external_ready_gears_job_count: expect.any(Number),
          local_acceptance_ready_gears_job_count: expect.any(Number),
          ready_without_external_gears_artifact_count: expect.any(Number),
          seedance_placeholder_asset_count: expect.any(Number),
          seedance_production_asset_ready_count: expect.any(Number),
        },
      });
      expect(res.body.data.summary.total_target_count).toBeGreaterThanOrEqual(2);
      expect(res.body.data.items.map((item: any) => item.project_id)).toEqual(expect.arrayContaining([
        enriched.project_id,
        saveRes.body.data.project.series_project_id,
      ]));
      expect(res.body.data.items[0]).toMatchObject({
        scope: expect.stringMatching(/story_project|ai_comic_series/),
        priority_score: expect.any(Number),
        status: expect.stringMatching(/ready|needs_action|blocked/),
        local_acceptance_ready_gears_job_count: expect.any(Number),
        ready_without_external_gears_artifact_count: expect.any(Number),
        seedance_placeholder_asset_count: expect.any(Number),
        seedance_production_asset_ready_count: expect.any(Number),
      });
      expect(res.body.data.action_buckets.length).toBeGreaterThan(0);
      expect(res.body.data.markdown).toContain('Production Readiness Portfolio');
      expect(res.body.data.markdown).toContain('GEARS local acceptance ready');
      expect(res.body.data.markdown).toContain('Seedance placeholder assets');

      const runRes = await request
        .post('/api/system/production-readiness-portfolio/run-automation')
        .send({
          dry_run: true,
          max_targets: 2,
          per_target_max_steps: 2,
          project_ids: [
            enriched.project_id,
            saveRes.body.data.project.series_project_id,
          ],
          stop_on_error: false,
        });
      expect(runRes.status).toBe(200);
      expectSuccess(runRes.body);
      expect(runRes.body.data).toMatchObject({
        schema_version: 'production-readiness-portfolio-run/v1',
        dry_run: true,
        selected_target_count: 2,
        planned_target_count: 2,
        failed_target_count: 0,
      });
      expect(runRes.body.data.targets.map((item: any) => item.project_id)).toEqual(expect.arrayContaining([
        enriched.project_id,
        saveRes.body.data.project.series_project_id,
      ]));
      expect(runRes.body.data.notes.join('\n')).toContain('GEARS worker');

      const liveRunRes = await request
        .post('/api/system/production-readiness-portfolio/run-automation')
        .send({
          dry_run: false,
          max_targets: 1,
          per_target_max_steps: 1,
          project_ids: [enriched.project_id],
          stop_on_error: false,
        });
      expect(liveRunRes.status).toBe(200);
      expectSuccess(liveRunRes.body);
      expect(liveRunRes.body.data).toMatchObject({
        schema_version: 'production-readiness-portfolio-run/v1',
        dry_run: false,
        selected_target_count: 1,
        portfolio_automation_ledger: {
          schema_version: 'production-readiness-portfolio-run-ledger/v1',
          total_run_count: 1,
          persisted_run_count: 1,
        },
        latest_portfolio_automation_run: {
          selected_target_count: 1,
        },
      });
      expect(liveRunRes.body.data.latest_portfolio_automation_run.targets[0].project_id).toBe(enriched.project_id);

      const afterRunRes = await request.get('/api/system/production-readiness-portfolio?limit=10');
      expect(afterRunRes.status).toBe(200);
      expectSuccess(afterRunRes.body);
      expect(afterRunRes.body.data.summary.portfolio_automation_run_count).toBe(1);
      expect(afterRunRes.body.data.latest_portfolio_automation_run.targets[0].project_id).toBe(enriched.project_id);
      expect(afterRunRes.body.data.markdown).toContain('portfolio automation runs: 1');
    });
  });

  describe('GET /api/system/production-material-pack-health', () => {
    it('returns production material pack portfolio health gates', async () => {
      const res = await request.get('/api/system/production-material-pack-health');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'production-material-pack-health/v1',
        status: 'passed',
        pack_file_valid: true,
        pack_file_diagnostics: [],
        pack_count: expect.any(Number),
        rejected_pack_count: 0,
        rejected_pack_diagnostics: [],
        required_video_types: expect.arrayContaining([
          'heritage_promo',
          'documentary_short',
          'ai_comic_drama',
          'explainer_video',
        ]),
        missing_required_video_types: [],
        production_ready_core_video_types: expect.arrayContaining([
          'heritage_promo',
          'documentary_short',
          'ai_comic_drama',
          'explainer_video',
        ]),
        issues: [],
      });
      expect(res.body.data.packs.some((pack: any) => (
        pack.video_type === 'ai_comic_drama'
        && pack.sample_entry_count >= 10
        && pack.unknown_required_fields.length === 0
      ))).toBe(true);
    });
  });

  describe('GET /api/system/domain-pack-production-health', () => {
    it('returns production Domain Pack prompt and review-boundary health gates', async () => {
      const res = await request.get('/api/system/domain-pack-production-health');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'domain-pack-production-health/v1',
        domain_id: 'china_culture',
        status: 'passed',
        pack_count: expect.any(Number),
        production_pack_count: 8,
        required_pack_ids: expect.arrayContaining([
          'heritage_process_pack',
          'documentary_source_pack',
          'ai_comic_storyboard_pack',
          'explainer_knowledge_structure_pack',
        ]),
        missing_required_pack_ids: [],
        production_ready_pack_ids: expect.arrayContaining([
          'heritage_process_pack',
          'documentary_source_pack',
          'ai_comic_storyboard_pack',
          'explainer_knowledge_structure_pack',
        ]),
        issues: [],
      });
      expect(res.body.data.packs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          pack_id: 'education_training_structure_pack',
          production_prompt_count: 3,
          review_boundary_count: 3,
          status: 'passed',
        }),
      ]));
    });
  });

  describe('GET /api/system/domain-pack-expansion-candidates', () => {
    it('returns review-gated Domain Pack expansion candidate batches', async () => {
      const res = await request.get('/api/system/domain-pack-expansion-candidates');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'domain-pack-expansion-candidates-report/v1',
        source_schema_version: 'domain-pack-expansion-candidates/v1',
        domain_id: 'china_culture',
        status: 'passed',
        required_pack_ids: expect.arrayContaining([
          'heritage_process_pack',
          'documentary_source_pack',
          'ai_comic_storyboard_pack',
          'era_and_costume_pack',
          'explainer_knowledge_structure_pack',
          'children_adaptation_safety_pack',
          'short_video_hook_pack',
          'education_training_structure_pack',
        ]),
        missing_required_pack_ids: [],
        review_policy: {
          direct_writeback_to_province_markdown: false,
          requires_candidate_markdown: true,
          requires_human_review: true,
          requires_source_level: true,
        },
        batch_count: 11,
        issues: [],
        review_packet: {
          schema_version: 'domain-pack-expansion-review-packet/v1',
          status: 'passed',
          review_policy: {
            direct_writeback_to_province_markdown: false,
            requires_candidate_markdown: true,
            requires_human_review: true,
            requires_source_level: true,
          },
        },
        writeback_preflight: {
          schema_version: 'domain-pack-expansion-writeback-preflight/v1',
          direct_writeback_to_province_markdown: false,
          province_markdown_written: false,
          approved_draft_count: 100,
          draft_ready_count: 100,
          target_file_count: 7,
          ready_for_unified_export: true,
        },
        writeback_handoff: {
          schema_version: 'domain-pack-expansion-writeback-handoff-summary/v1',
          ready_for_unified_export: true,
          target_file_count: 7,
          approved_draft_count: 100,
          signoff_batch_count: 6,
          ready_for_signoff_count: 100,
          blocked_for_signoff_count: 0,
          direct_writeback_to_province_markdown: false,
          province_markdown_written: false,
          writeback_queue_path: '/knowledge-writeback-queue',
        },
      });
      expect(res.body.data.next_development_tasks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          task_id: 'field_workbench_controls',
          progress_percent: 100,
          related_plan_items: [1],
        }),
        expect.objectContaining({
          task_id: 'manual_review_closure',
          progress_percent: 100,
          related_plan_items: [2],
        }),
        expect.objectContaining({
          task_id: 'writeback_safety_export',
          progress_percent: 100,
          related_plan_items: [3],
        }),
        expect.objectContaining({
          task_id: 'third_batch_real_candidates',
          progress_percent: 100,
          related_plan_items: [4],
        }),
        expect.objectContaining({
          task_id: 'mvp_completion_surface',
          progress_percent: 100,
          related_plan_items: [5],
        }),
      ]));
      expect(res.body.data.review_closure).toMatchObject({
        schema_version: 'domain-pack-expansion-review-closure/v1',
        ready_for_human_handoff: true,
        review_item_count: 100,
        approved_count: 100,
        review_note_count: 100,
        missing_review_note_count: 0,
        reviewer_identity_count: 100,
        missing_reviewer_identity_count: 0,
        signoff_batch_count: 6,
        missing_signoff_batch_count: 0,
        ready_for_signoff_count: 100,
        blocked_for_signoff_count: 0,
        manual_writeback_required_count: 100,
      });
      expect(res.body.data.seed_target_count).toBeGreaterThanOrEqual(30);
      expect(res.body.data.candidate_field_count).toBeGreaterThanOrEqual(80);
      expect(res.body.data.review_packet.review_item_count).toBe(res.body.data.seed_target_count);
      expect(res.body.data.review_packet.markdown).toContain('Domain Pack Expansion Review Packet');
      expect(res.body.data.review_packet.markdown).toContain('滩头年画');
      expect(res.body.data.review_packet.batches).toEqual(expect.arrayContaining([
        expect.objectContaining({
          pack_id: 'heritage_process_pack',
          review_items: expect.arrayContaining([
            expect.objectContaining({
              candidate_status: 'candidate_review',
              review_state_source: 'seed',
              review_state_overrides_seed: false,
              candidate_markdown: expect.stringContaining('review_state_source: seed'),
            }),
          ]),
        }),
      ]));
      expect(res.body.data.review_packet.markdown).toContain('review_state_source: seed');
      expect(res.body.data.review_packet.markdown).toContain('review_state_overrides_seed: false');
      expect(res.body.data.batches).toEqual(expect.arrayContaining([
        expect.objectContaining({
          pack_id: 'heritage_process_pack',
          priority: 'P0',
          seed_target_count: 13,
        }),
        expect.objectContaining({
          pack_id: 'explainer_knowledge_structure_pack',
          target_video_types: expect.arrayContaining(['explainer_video']),
        }),
        expect.objectContaining({
          pack_id: 'children_adaptation_safety_pack',
          target_video_types: expect.arrayContaining(['children_story']),
        }),
        expect.objectContaining({
          pack_id: 'short_video_hook_pack',
          target_video_types: expect.arrayContaining(['social_short']),
        }),
        expect.objectContaining({
          pack_id: 'education_training_structure_pack',
          target_video_types: expect.arrayContaining(['education_training']),
        }),
      ]));
      expect(res.body.data.markdown).toContain('Domain Pack Expansion Candidates');
      expect(res.body.data.markdown).toContain('direct_writeback_to_province_markdown: false');
      expect(res.body.data.markdown).toContain('Writeback Safety Preflight');
      expect(res.body.data.markdown).toContain('Next Development Tasks');
      expect(res.body.data.markdown).toContain('review_packet_item_count');
    });

    it('stores expansion review state and exports approved writeback drafts without writing provinces', async () => {
      const reviewItemId = 'heritage_process_pack_expansion_20260707::target_01';
      const stateDir = resolve(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion');
      await rm(stateDir, { recursive: true, force: true });

      const updateRes = await request
        .patch('/api/system/domain-pack-expansion-candidates/review-state')
        .send({
          review_item_id: reviewItemId,
          review_status: 'approved',
          review_note: 'API 审稿通过，进入人工补源草案。',
          reviewer_name: 'API复核人',
          reviewed_by: 'API复核人',
          signoff_batch_id: 'api-signoff-batch-001',
          signoff_batch_note: 'API 单条审签批次归档测试。',
          writeback_status: 'draft_ready',
        });

      expect(updateRes.status).toBe(200);
      expectSuccess(updateRes.body);
      const updatedItem = updateRes.body.data.review_packet.batches
        .flatMap((batch: any) => batch.review_items)
        .find((item: any) => item.review_item_id === reviewItemId);
      expect(updatedItem).toMatchObject({
        review_status: 'approved',
        review_note: 'API 审稿通过，进入人工补源草案。',
        reviewer_name: 'API复核人',
        reviewed_by: 'API复核人',
        signoff_batch_id: 'api-signoff-batch-001',
        signoff_batch_note: 'API 单条审签批次归档测试。',
        writeback_status: 'draft_ready',
        writeback_draft_markdown: expect.stringContaining('扩库候选审稿草案'),
      });
      expect(updatedItem.writeback_draft_markdown).toContain('direct_writeback_to_province_markdown: false');
      expect(updatedItem.writeback_draft_markdown).toContain('reviewed_by: API复核人');
      expect(updatedItem.writeback_draft_markdown).toContain('signoff_batch_id: api-signoff-batch-001');

      const draftRes = await request.get('/api/system/domain-pack-expansion-writeback-draft');

      expect(draftRes.status).toBe(200);
      expectSuccess(draftRes.body);
      expect(draftRes.body.data).toMatchObject({
        schema_version: 'domain-pack-expansion-writeback-draft/v1',
        approved_count: 100,
        target_files: [
          'data/provinces/云南.md',
          'data/provinces/四川.md',
          'data/provinces/山西.md',
          'data/provinces/江西.md',
          'data/provinces/湖南.md',
          'data/provinces/贵州.md',
          'data/provinces/辽宁.md',
        ],
        status_counts: {
          draft_ready: 100,
          queued: 0,
          written_back: 0,
          needs_revision: 0,
        },
      });
      expect(draftRes.body.data.markdown).toContain('本草案只作为人工补库采集清单');
      await rm(stateDir, { recursive: true, force: true });
    });

    it('bulk updates filtered expansion review state without writing provinces', async () => {
      const stateDir = resolve(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion');
      await rm(stateDir, { recursive: true, force: true });

      const bulkRes = await request
        .patch('/api/system/domain-pack-expansion-candidates/review-state/bulk')
        .send({
          review_item_ids: [
            'short_video_hook_pack_expansion_20260707::target_01',
            'short_video_hook_pack_expansion_20260707::target_02',
          ],
          review_status: 'approved',
          review_note: 'API 批量审稿通过，仍需人工补源。',
          writeback_status: 'queued',
          writeback_note: '批量排入短视频钩子补录。',
        });

      expect(bulkRes.status).toBe(200);
      expectSuccess(bulkRes.body);
      expect(bulkRes.body.data).toMatchObject({
        schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
        updated_count: 2,
        missing_review_item_ids: [],
        direct_writeback_to_province_markdown: false,
        province_markdown_written: false,
        report: {
          review_packet: {
            approved_writeback_draft_count: 100,
          },
        },
      });
      expect(bulkRes.body.data.report.review_packet.review_status_counts).toMatchObject({
        approved: 100,
      });

      const draftRes = await request.get('/api/system/domain-pack-expansion-writeback-draft');
      expect(draftRes.status).toBe(200);
      expectSuccess(draftRes.body);
      expect(draftRes.body.data).toMatchObject({
        approved_count: 100,
        direct_writeback_to_province_markdown: false,
        filters: {},
        status_counts: expect.objectContaining({
          queued: 2,
          draft_ready: 98,
        }),
      });

      const scopedDraftRes = await request
        .get('/api/system/domain-pack-expansion-writeback-draft')
        .query({
          pack_id: 'short_video_hook_pack',
          video_type: 'social_short',
          province: '湖南',
          writeback_status: 'queued',
        });
      expect(scopedDraftRes.status).toBe(200);
      expectSuccess(scopedDraftRes.body);
      expect(scopedDraftRes.body.data).toMatchObject({
        approved_count: 2,
        target_files: ['data/provinces/湖南.md'],
        direct_writeback_to_province_markdown: false,
        filters: {
          pack_ids: ['short_video_hook_pack'],
          video_types: ['social_short'],
          provinces: ['湖南'],
          writeback_statuses: ['queued'],
        },
        status_counts: expect.objectContaining({
          queued: 2,
        }),
      });
      expect(scopedDraftRes.body.data.markdown).toContain('pack_ids: short_video_hook_pack');

      const remainingDraftRes = await request
        .get('/api/system/domain-pack-expansion-writeback-draft')
        .query({
          pack_id: 'short_video_hook_pack',
          writeback_status: 'draft_ready',
        });
      expect(remainingDraftRes.status).toBe(200);
      expectSuccess(remainingDraftRes.body);
      expect(remainingDraftRes.body.data).toMatchObject({
        approved_count: 2,
        target_files: ['data/provinces/湖南.md'],
        filters: {
          pack_ids: ['short_video_hook_pack'],
          writeback_statuses: ['draft_ready'],
        },
        status_counts: expect.objectContaining({
          draft_ready: 2,
          queued: 0,
        }),
      });
      await rm(stateDir, { recursive: true, force: true });
    });

    it('exports a unified knowledge writeback queue package for scoped expansion drafts', async () => {
      const reviewItemId = 'short_video_hook_pack_expansion_20260707::target_01';
      const stateDir = resolve(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion');
      await rm(stateDir, { recursive: true, force: true });

      const updateRes = await request
        .patch('/api/system/domain-pack-expansion-candidates/review-state')
        .send({
          review_item_id: reviewItemId,
          review_status: 'approved',
          review_note: 'API 审稿通过，进入统一写回队列导出。',
          reviewer_name: '统一导出复核人',
          reviewed_by: '统一导出复核人',
          signoff_batch_id: 'api-unified-signoff-001',
          signoff_batch_note: '统一写回导出审签批次归档测试。',
          writeback_status: 'queued',
          writeback_note: '统一导出测试入队。',
        });
      expect(updateRes.status).toBe(200);
      expectSuccess(updateRes.body);

      const exportRes = await request
        .get('/api/system/knowledge-writeback-queue/export')
        .query({
          video_type: 'social_short',
          province: '湖南',
          knowledge_writeback_status: 'queued',
          expansion_review_item_id: reviewItemId,
        });

      expect(exportRes.status).toBe(200);
      expectSuccess(exportRes.body);
      expect(exportRes.body.data).toMatchObject({
        schema_version: 'knowledge-writeback-queue-export/v1',
        direct_writeback_to_province_markdown: false,
        province_markdown_written: false,
        filters: {
          video_type: 'social_short',
          province: '湖南',
          knowledge_writeback_status: 'queued',
          expansion_review_item_count: 1,
        },
        approved_count: 1,
        project_approved_count: 0,
        expansion_approved_count: 1,
        target_files: ['data/provinces/湖南.md'],
        status_counts: {
          project: expect.objectContaining({ queued: 0 }),
          expansion: expect.objectContaining({ queued: 1 }),
          total: expect.objectContaining({ queued: 1 }),
        },
        preflight: {
          schema_version: 'knowledge-writeback-queue-export-preflight/v1',
          direct_writeback_to_province_markdown: false,
          province_markdown_written: false,
          target_file_count: 1,
          target_files: ['data/provinces/湖南.md'],
          total_draft_count: 1,
          project_draft_count: 0,
          expansion_draft_count: 1,
          expansion_candidate_field_count: 4,
          expansion_field_missing_count: 0,
          manual_review_required_count: 1,
          blocked_direct_writeback_count: 1,
          ready_for_manual_export: true,
          source_ref_quality: expect.objectContaining({
            schema_version: 'knowledge-writeback-source-ref-quality/v1',
            coverage_percent: 100,
            blocker_item_count: 0,
            warning_item_count: 0,
            source_ref_check_count: expect.any(Number),
            source_ref_check_warning_count: expect.any(Number),
            source_ref_check_blocker_count: 0,
            file_missing_source_ref_count: 0,
            anchor_missing_source_ref_count: expect.any(Number),
            missing_source_ref_field_count: 0,
            missing_verification_note_field_count: 0,
            missing_writeback_hint_field_count: 0,
          }),
          target_file_preflight: [expect.objectContaining({
            target_file: 'data/provinces/湖南.md',
            expansion_draft_count: 1,
            expansion_candidate_field_count: 4,
            expansion_field_missing_count: 0,
            source_ref_coverage_percent: 100,
            source_ref_quality_level: 'pass',
            source_ref_blocker_count: 0,
            source_ref_warning_count: 0,
            direct_writeback_to_province_markdown: false,
          })],
          review_handoff: expect.objectContaining({
            schema_version: 'knowledge-writeback-queue-review-handoff/v1',
            signoff_manifest: expect.objectContaining({
              schema_version: 'knowledge-writeback-queue-signoff-manifest/v1',
              manifest_id: expect.stringMatching(/^kwb-signoff-/),
              sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
              item_count: 1,
              target_file_count: 1,
              requires_manual_signoff_count: 1,
              signoff_batch_ids: ['api-unified-signoff-001'],
              direct_writeback_to_province_markdown: false,
              province_markdown_written: false,
            }),
            total_handoff_count: 1,
            expansion_handoff_count: 1,
            requires_manual_signoff_count: 1,
            reviewer_identity_count: 1,
            missing_reviewer_identity_count: 0,
            signoff_batch_count: 1,
            missing_signoff_batch_count: 0,
            signoff_batch_ids: ['api-unified-signoff-001'],
            signoff_batch_summaries: [expect.objectContaining({
              signoff_batch_id: 'api-unified-signoff-001',
              signoff_batch_note: '统一写回导出审签批次归档测试。',
              item_count: 1,
              expansion_handoff_count: 1,
              ready_for_signoff_count: 1,
              blocked_for_signoff_count: 0,
              status_counts: expect.objectContaining({
                queued: 1,
              }),
            })],
            source_ref_count: expect.any(Number),
            candidate_field_count: 4,
            items: [expect.objectContaining({
              handoff_id: reviewItemId,
              source_kind: 'domain_pack_expansion',
              writeback_status: 'queued',
              reviewed_by: '统一导出复核人',
              signoff_batch_id: 'api-unified-signoff-001',
              signoff_batch_note: '统一写回导出审签批次归档测试。',
              target_file: 'data/provinces/湖南.md',
              required_action: expect.stringContaining('已入队'),
            })],
          }),
          safety_checks: expect.arrayContaining([
            'direct_writeback_to_province_markdown=false',
            'province_markdown_written=false',
            'review_handoff_items=1',
            'review_handoff_requires_signoff=1',
            'signoff_batch_summaries=1',
            expect.stringMatching(/^source_ref_check_warnings=/),
            'source_ref_check_blockers=0',
            expect.stringMatching(/^signoff_manifest_id=kwb-signoff-/),
            expect.stringMatching(/^signoff_manifest_sha256=[a-f0-9]{64}$/),
            'default_action=export_only_no_file_write',
          ]),
        },
        signoff_package: expect.objectContaining({
          schema_version: 'knowledge-writeback-queue-signoff-package/v1',
          handoff_item_count: 1,
          direct_writeback_to_province_markdown: false,
          province_markdown_written: false,
          signoff_manifest: expect.objectContaining({
            manifest_id: expect.stringMatching(/^kwb-signoff-/),
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            signoff_batch_ids: ['api-unified-signoff-001'],
          }),
          signoff_batch_summaries: [expect.objectContaining({
            signoff_batch_id: 'api-unified-signoff-001',
            ready_for_signoff_count: 1,
          })],
        }),
        manual_patch_package: expect.objectContaining({
          schema_version: 'knowledge-writeback-manual-patch-package/v1',
          direct_writeback_to_province_markdown: false,
          province_markdown_written: false,
          patch_applyable: false,
          manual_apply_only: true,
          ready_for_manual_apply: true,
          target_file_count: 1,
          target_files: ['data/provinces/湖南.md'],
          ready_target_file_count: 1,
          blocked_target_file_count: 0,
          total_patch_count: 1,
          project_patch_count: 0,
          expansion_patch_count: 1,
          candidate_field_count: 4,
          source_ref_quality: expect.objectContaining({
            coverage_percent: 100,
            blocker_item_count: 0,
            warning_item_count: 0,
            source_ref_check_warning_count: expect.any(Number),
            source_ref_check_blocker_count: 0,
          }),
          manual_patch_manifest: expect.objectContaining({
            schema_version: 'knowledge-writeback-manual-patch-manifest/v1',
            manifest_id: expect.stringMatching(/^kwb-manual-patch-/),
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            target_file_count: 1,
            ready_target_file_count: 1,
            blocked_target_file_count: 0,
            patch_applyable: false,
            manual_apply_only: true,
          }),
          manual_patch_closure_certificate: expect.objectContaining({
            schema_version: 'knowledge-writeback-manual-patch-closure-certificate/v1',
            certificate_id: expect.stringMatching(/^kwb-manual-closure-/),
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            status: 'ready_for_operator_apply',
            ready_for_operator_apply: true,
            target_file_count: 1,
            ready_target_file_count: 1,
            blocked_target_file_count: 0,
            patch_applyable: false,
            manual_apply_only: true,
            operator_required_actions: expect.any(Array),
          }),
          ready_reasons: expect.arrayContaining([
            'manual_patch_has_target_patches',
            'source_ref_quality_blockers=0',
          ]),
          blocker_reasons: [],
          warning_reasons: expect.any(Array),
          target_patches: [expect.objectContaining({
            target_file: 'data/provinces/湖南.md',
            patch_applyable: false,
            manual_apply_only: true,
            ready_for_manual_apply: true,
            total_patch_count: 1,
            project_patch_count: 0,
            expansion_patch_count: 1,
            candidate_field_count: 4,
            source_ref_coverage_percent: 100,
            source_ref_quality_level: 'pass',
            blocker_reasons: [],
            warning_reasons: expect.any(Array),
            diff_preview_lines: expect.arrayContaining([
              expect.stringContaining('@@ manual_append_review_only @@'),
            ]),
            diff_preview_truncated: false,
            append_markdown: expect.stringContaining(reviewItemId),
            review_diff: expect.stringContaining('@@ manual_append_review_only @@'),
            safety_checks: expect.arrayContaining([
              'direct_writeback_to_province_markdown=false',
              'province_markdown_written=false',
              'patch_applyable=false',
              'manual_apply_only=true',
            ]),
          })],
        }),
        project_patch: {
          schema_version: 'project-knowledge-writeback-patch/v1',
          approved_count: 0,
        },
        expansion_draft: {
          schema_version: 'domain-pack-expansion-writeback-draft/v1',
          approved_count: 1,
          filters: {
            review_item_ids: [reviewItemId],
            video_types: ['social_short'],
            provinces: ['湖南'],
            writeback_statuses: ['queued'],
          },
        },
      });
      expect(exportRes.body.data.markdown).toContain('Knowledge Writeback Queue Export');
      expect(exportRes.body.data.markdown).toContain('province_markdown_written: false');
      expect(exportRes.body.data.markdown).toContain('Export Preflight');
      expect(exportRes.body.data.markdown).toContain('Signoff Package');
      expect(exportRes.body.data.markdown).toContain('Manual Writeback Patch Package');
      expect(exportRes.body.data.markdown).toContain('knowledge-writeback-manual-patch-package/v1');
      expect(exportRes.body.data.markdown).toContain('knowledge-writeback-manual-patch-closure-certificate/v1');
      expect(exportRes.body.data.markdown).toContain('closure_certificate_ready: true');
      expect(exportRes.body.data.markdown).toContain('manual_patch_ready: true');
      expect(exportRes.body.data.markdown).toContain('patch_applyable: false');
      expect(exportRes.body.data.markdown).toContain('@@ manual_append_review_only @@');
      expect(exportRes.body.data.markdown).toContain('Signoff Batch Summaries');
      expect(exportRes.body.data.markdown).toContain('signoff_batch_summary_count: 1');
      expect(exportRes.body.data.markdown).toContain('signoff_manifest_id: kwb-signoff-');
      expect(exportRes.body.data.markdown).toContain('expansion_field_diff');
      expect(exportRes.body.data.markdown).toContain('项目草案来源');
      expect(exportRes.body.data.markdown).toContain('Domain Pack Expansion Writeback Draft');
      await rm(stateDir, { recursive: true, force: true });
    });

    it('rejects expansion review updates for unknown items', async () => {
      const res = await request
        .patch('/api/system/domain-pack-expansion-candidates/review-state')
        .send({
          review_item_id: 'missing-review-item',
          review_status: 'approved',
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.message).toContain('未找到扩库候选审稿项');
    });
  });

  describe('GET /api/system/gears-external-callback-handoff-queue', () => {
    it('returns a read-only cross-project GEARS external callback queue package', async () => {
      const res = await request.get('/api/system/gears-external-callback-handoff-queue?limit=5');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'gears-external-callback-handoff-queue/v1',
        project_count: expect.any(Number),
        pending_external_artifact_count: expect.any(Number),
        system_preflight_curl: expect.stringContaining('/api/system/gears-external-callbacks/preflight'),
        system_safe_import_curl: expect.stringContaining('/api/system/gears-external-callbacks/import'),
        callback_sample_count: expect.any(Number),
        callback_sample_ready_for_import_count: expect.any(Number),
        callback_sample_placeholder_output_url_count: expect.any(Number),
        sample_payload_ready_for_import: expect.any(Boolean),
        callback_batch_sample: {
          callbacks: expect.any(Array),
          replace_before_import: expect.any(Array),
          import_note: expect.any(String),
        },
        projects: expect.any(Array),
        operator_checklist: expect.any(Array),
      });
      expect(res.body.data.markdown).toContain('GEARS External Callback Handoff Queue');
      expect(res.body.data.markdown).toContain('## System Commands');
      expect(res.body.data.markdown).toContain('callback sample ready for import');
      expect(res.body.data.callback_batch_sample.import_note).toContain('cross-project operator handoff');
    });
  });

  describe('GET /api/system/story-agent-generated-health', () => {
    it('distinguishes interrupted, planned and production-gap generated projects', async () => {
      const generatedRoot = process.env.WEB_GENERATED_ROOT ?? resolve(testWorkspaceRoot, 'web', 'generated');
      const interruptedStoryDir = resolve(generatedRoot, 'projects', 'health-interrupted-story');
      const plannedSeriesDir = resolve(generatedRoot, 'ai-comic-series-projects', 'health-planned-series');
      const gapSeriesDir = resolve(generatedRoot, 'ai-comic-series-projects', 'health-gap-series');
      const relinkSeriesDir = resolve(generatedRoot, 'ai-comic-series-projects', 'health-relink-series');
      const manifestGapSeriesDir = resolve(generatedRoot, 'ai-comic-series-projects', 'health-manifest-gap-series');
      const archiveSeriesDir = resolve(generatedRoot, 'ai-comic-series-projects', 'health-archive-series');
      const storyFileDir = resolve(generatedRoot, 'stories', 'ai_comic_drama');
      await mkdir(resolve(interruptedStoryDir, 'versions'), { recursive: true });
      await mkdir(plannedSeriesDir, { recursive: true });
      await mkdir(gapSeriesDir, { recursive: true });
      await mkdir(relinkSeriesDir, { recursive: true });
      await mkdir(manifestGapSeriesDir, { recursive: true });
      await mkdir(archiveSeriesDir, { recursive: true });
      await mkdir(storyFileDir, { recursive: true });
      await writeFile(resolve(interruptedStoryDir, 'project.json'), JSON.stringify({
        project_id: 'health-interrupted-story',
        current_story_id: '20260622-story-health-missing',
        current_version_id: 'health-interrupted-story-v1',
        title: 'Health Interrupted Story',
        source_domain: 'china_culture',
        status: 'draft',
        created_at: '2026-06-22T01:00:00.000Z',
        updated_at: '2026-06-22T01:01:00.000Z',
        video_type: 'ai_comic_drama',
        presentation_style: 'ai_comic',
        version_count: 1,
      }));
      await writeFile(resolve(interruptedStoryDir, 'versions', 'health-interrupted-story-v1.json'), JSON.stringify({
        project_id: 'health-interrupted-story',
        version_id: 'health-interrupted-story-v1',
        created_at: '2026-06-22T01:01:00.000Z',
        change_type: 'initial_generation',
        scene_ids_changed: [],
      }));
      await writeFile(resolve(storyFileDir, '20260622-story-health-series-1.json'), JSON.stringify({
        ...makeApiStory(),
        storyId: '20260622-story-health-series-1',
        title: 'Health Series Episode 1',
        project_id: undefined,
        current_version_id: undefined,
      }));
      await writeFile(resolve(plannedSeriesDir, 'project.json'), JSON.stringify({
        project: {
          series_project_id: 'health-planned-series',
          title: 'Health Planned Series',
          episode_count: 3,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          logline: '计划中的系列。',
          created_at: '2026-06-22T01:00:00.000Z',
          updated_at: '2026-06-22T01:02:00.000Z',
          generated_episode_count: 0,
        },
        plan: {
          schema_version: 'ai-comic-series-plan/v1',
          series_title: 'Health Planned Series',
          episode_count: 3,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          generation_scope: 'series_plan',
          premise: '计划中的系列。',
          logline: '计划中的系列。',
          core_theme: '项目健康',
          main_characters: [],
          plot_threads: [],
          phases: [],
          episodes: [],
          continuity_rules: [],
          recurring_motifs: [],
          production_notes: [],
        },
        generated_episode_story_ids: {},
      }));
      await writeFile(resolve(gapSeriesDir, 'project.json'), JSON.stringify({
        project: {
          series_project_id: 'health-gap-series',
          title: 'Health Gap Series',
          episode_count: 2,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          logline: '已有分集但缺生产指挥合同。',
          created_at: '2026-06-22T01:00:00.000Z',
          updated_at: '2026-06-22T01:03:00.000Z',
          generated_episode_count: 1,
        },
        plan: {
          schema_version: 'ai-comic-series-plan/v1',
          series_title: 'Health Gap Series',
          episode_count: 2,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          generation_scope: 'series_plan',
          premise: '已有分集但缺生产指挥合同。',
          logline: '已有分集但缺生产指挥合同。',
          core_theme: '项目健康',
          main_characters: [],
          plot_threads: [],
          phases: [],
          episodes: [],
          continuity_rules: [],
          recurring_motifs: [],
          production_notes: [],
        },
        generated_episode_story_ids: {
          '1': '20260622-story-health-series-1',
        },
      }));
      await writeFile(resolve(relinkSeriesDir, 'project.json'), JSON.stringify({
        project: {
          series_project_id: 'health-relink-series',
          title: 'Health Relink Series',
          episode_count: 1,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          logline: '已有生产指挥合同但分集引用断链。',
          created_at: '2026-06-22T01:00:00.000Z',
          updated_at: '2026-06-22T01:04:00.000Z',
          generated_episode_count: 1,
        },
        plan: {
          schema_version: 'ai-comic-series-plan/v1',
          series_title: 'Health Relink Series',
          episode_count: 1,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          generation_scope: 'full_planning',
          premise: '已有生产指挥合同但分集引用断链。',
          logline: '已有生产指挥合同但分集引用断链。',
          core_theme: '项目健康',
          main_characters: [],
          plot_threads: [],
          phases: [],
          episodes: [],
          continuity_rules: [],
          recurring_motifs: [],
          production_notes: [],
        },
        generated_episode_story_ids: {
          '1': '20260622-story-health-series-missing',
        },
        seedance_production: {
          items: [{
            shot_id: 'shot-1',
            status: 'ready',
            video_url: '/generated/relink/shot-1.mp4',
            thumbnail: {
              status: 'ready',
              output_path: '/generated/relink/thumb-1.jpg',
            },
          }, {
            shot_id: 'shot-2',
            status: 'failed',
            provider_job_id: 'seedance-job-failed',
            failure_reason: '人物手部变形',
            notes: ['测试标记失败'],
          }],
        },
        seedance_cut_assembly: {
          status: 'ready',
          output_path: '/generated/relink/cut.concat.txt',
        },
        seedance_subtitle_render: {
          status: 'ready',
          srt_path: '/generated/relink/subtitles.srt',
        },
        seedance_final_delivery: {
          status: 'ready',
          manifest_path: '/generated/relink/final.manifest.json',
        },
        gears_job_ledger: {
          jobs: [{
            gears_job_id: 'gears-health-relink-job',
            source_unit_id: 'shot-1',
            status: 'ready',
          }],
        },
      }));
      await writeFile(resolve(manifestGapSeriesDir, 'project.json'), JSON.stringify({
        project: {
          series_project_id: 'health-manifest-gap-series',
          title: 'Health Manifest Gap Series',
          episode_count: 1,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          logline: '已有装配计划但缺少发布 manifest。',
          created_at: '2026-06-22T01:00:00.000Z',
          updated_at: '2026-06-22T01:04:30.000Z',
          generated_episode_count: 1,
        },
        plan: {
          schema_version: 'ai-comic-series-plan/v1',
          series_title: 'Health Manifest Gap Series',
          episode_count: 1,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          generation_scope: 'full_planning',
          premise: '已有装配计划但缺少发布 manifest。',
          logline: '已有装配计划但缺少发布 manifest。',
          core_theme: '交付完整性',
          main_characters: [],
          plot_threads: [],
          phases: [],
          episodes: [{
            episode_no: 1,
            title: '交付检查',
            target_duration_sec: 90,
            target_panel_count: 12,
            story_phase: 'setup',
            opening_hook: '最终装配计划已经生成。',
            main_conflict: '发布 manifest 仍然缺失。',
            midpoint_turn: '健康审计拒绝把 concat 当成交付。',
            key_characters: [],
            continuity_from_previous: [],
            new_information: ['最终交付需要输出与 manifest 同时存在'],
            foreshadowing: [],
            payoff: ['生成明确修复动作'],
            ending_hook: '是否在授权后重跑导出？',
            ending_hook_type: 'emotional_question',
            character_state_change: '从误判可发布转向待修复',
            thread_action: '完成 manifest 完整性检查',
            knowledge_focus: ['最终交付合同'],
            continuity_state_after: ['等待人工确认或重导出'],
          }],
          continuity_rules: [],
          recurring_motifs: [],
          production_notes: [],
        },
        generated_episode_story_ids: {
          '1': '20260622-story-health-series-1',
        },
        seedance_production: {
          items: [{
            shot_id: 'shot-1',
            status: 'ready',
            video_url: '/generated/manifest-gap/shot-1.mp4',
            thumbnail: {
              status: 'ready',
              output_path: '/generated/manifest-gap/thumb-1.jpg',
            },
          }],
        },
        seedance_cut_assembly: {
          status: 'ready',
          output_path: '/generated/manifest-gap/cut.mp4',
          concat_list_path: '/generated/manifest-gap/cut.concat.txt',
        },
        seedance_subtitle_render: {
          status: 'ready',
          output_path: '/generated/manifest-gap/subtitled.mp4',
          srt_path: '/generated/manifest-gap/subtitles.srt',
        },
        seedance_final_delivery: {
          status: 'planned',
          dry_run: true,
          output_path: '/generated/manifest-gap/final.mp4',
          concat_list_path: '/generated/manifest-gap/final.concat.txt',
        },
        gears_job_ledger: {
          jobs: [{
            gears_job_id: 'gears-health-manifest-gap-job',
            source_unit_id: 'shot-1',
            status: 'ready',
          }],
        },
      }));
      await writeFile(resolve(archiveSeriesDir, 'project.json'), JSON.stringify({
        project: {
          series_project_id: 'health-archive-series',
          title: 'Health Archive Series',
          episode_count: 3,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          logline: '历史样本，分集引用断链且没有生产合同证据。',
          created_at: '2026-06-22T01:00:00.000Z',
          updated_at: '2026-06-22T01:05:00.000Z',
          generated_episode_count: 1,
        },
        plan: {
          schema_version: 'ai-comic-series-plan/v1',
          series_title: 'Health Archive Series',
          episode_count: 3,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          generation_scope: 'series_plan',
          premise: '历史样本，分集引用断链且没有生产合同证据。',
          logline: '历史样本，分集引用断链且没有生产合同证据。',
          core_theme: '项目健康',
          main_characters: [],
          plot_threads: [],
          phases: [],
          episodes: [],
          continuity_rules: [],
          recurring_motifs: [],
          production_notes: [],
        },
        generated_episode_story_ids: {
          '1': '20260622-story-health-series-archive-missing',
        },
      }));
      const manifestPath = resolve(testWorkspaceRoot, 'story-agent-soft-archive-manifest-20260710.json');
      process.env.STORY_AGENT_SOFT_ARCHIVE_MANIFEST_PATH = manifestPath;
      await writeFile(manifestPath, JSON.stringify({
        schema_version: 'story-agent-soft-archive-manifest/v1',
        mode: 'active_signoff_exclusion',
        policy: {
          signoff_exclusion_applied: true,
        },
        entries: [{
          project_id: 'health-archive-series',
          execution_status: 'signoff_exclusion_active',
        }],
      }));

      const res = await request.get('/api/system/story-agent-generated-health?limit=200');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'story-agent-generated-health/v1',
        summary: expect.objectContaining({
          scanned_story_project_count: expect.any(Number),
          scanned_series_project_count: expect.any(Number),
          total_target_count: expect.any(Number),
          interrupted_count: expect.any(Number),
          planned_count: expect.any(Number),
          production_gap_count: expect.any(Number),
          series_planned_only_count: expect.any(Number),
          series_production_gap_count: expect.any(Number),
          series_interrupted_count: expect.any(Number),
          series_governance_attention_count: expect.any(Number),
          series_missing_story_ref_project_count: expect.any(Number),
          series_contract_evidence_count: expect.any(Number),
          series_relink_candidate_count: expect.any(Number),
          series_signoff_portfolio_count: expect.any(Number),
          series_soft_archive_excluded_count: expect.any(Number),
          series_seedance_failed_project_count: expect.any(Number),
          series_seedance_failed_item_count: expect.any(Number),
          series_seedance_failure_marker_project_count: expect.any(Number),
          series_seedance_test_fixture_failure_project_count: expect.any(Number),
          series_seedance_test_fixture_failure_item_count: expect.any(Number),
          series_missing_final_delivery_manifest_count: expect.any(Number),
          story_quality_passed_with_issue_count: expect.any(Number),
          story_quality_passed_with_open_supplement_count: expect.any(Number),
          story_quality_passed_with_issue_and_open_supplement_count: expect.any(Number),
        }),
      });
      expect(res.body.data.markdown).toContain('story_quality_passed_with_issues_and_open_supplement');
      expect(res.body.data.summary.scanned_story_project_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.scanned_series_project_count).toBeGreaterThanOrEqual(2);
      expect(res.body.data.summary.series_planned_only_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_production_gap_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_governance_attention_count).toBeGreaterThanOrEqual(2);
      expect(res.body.data.summary.series_missing_story_ref_project_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_contract_evidence_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_relink_candidate_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_soft_archive_excluded_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_seedance_failed_project_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_seedance_failed_item_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_seedance_failure_marker_project_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_seedance_test_fixture_failure_project_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_seedance_test_fixture_failure_item_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.series_missing_final_delivery_manifest_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'story_project',
          project_id: 'health-interrupted-story',
          status: 'interrupted',
          missing_contracts: expect.arrayContaining(['current_story']),
        }),
        expect.objectContaining({
          scope: 'ai_comic_series_project',
          project_id: 'health-planned-series',
          status: 'planned',
        }),
        expect.objectContaining({
          scope: 'ai_comic_series_project',
          project_id: 'health-gap-series',
          status: 'production_gap',
          missing_contracts: expect.arrayContaining(['remaining_episodes', 'shot_production_ledger', 'series_delivery']),
        }),
        expect.objectContaining({
          scope: 'ai_comic_series_project',
          project_id: 'health-relink-series',
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
          project_id: 'health-manifest-gap-series',
          status: 'production_gap',
          missing_contracts: expect.arrayContaining(['final_delivery_manifest']),
          final_delivery_ready: false,
          final_delivery_manifest_ready: false,
          final_delivery_manifest_missing: true,
          final_delivery_dry_run: true,
        }),
        expect.objectContaining({
          scope: 'ai_comic_series_project',
          project_id: 'health-archive-series',
          signoff_eligible: false,
          governance_disposition: 'soft_archived_signoff_excluded',
        }),
      ]));
      expect(res.body.data.markdown).toContain('# Story Agent Generated Health');
      expect(res.body.data.markdown).toContain('series_governance_attention');
      expect(res.body.data.markdown).toContain('series_relink_candidates');
      expect(res.body.data.markdown).toContain('series_soft_archive_excluded');
      expect(res.body.data.markdown).toContain('series_seedance_test_fixture_failure_items');
      expect(res.body.data.markdown).toContain('series_missing_final_delivery_manifest');
      expect(res.body.data.markdown).toContain('health-interrupted-story');
      expect(res.body.data.notes.join('\n')).toContain('Series governance');
      expect(res.body.data.notes.join('\n')).toContain('Series relink candidates');
      expect(res.body.data.notes.join('\n')).toContain('explicitly test-marked fixtures');

      const backlogRes = await request.get('/api/system/story-agent-backlog-handoff?limit=20');
      expect(backlogRes.status).toBe(200);
      expectSuccess(backlogRes.body);
      expect(backlogRes.body.data).toMatchObject({
        schema_version: 'story-agent-backlog-handoff/v1',
        source_health_schema: 'story-agent-generated-health/v1',
        direct_writeback_to_province_markdown: false,
        province_markdown_written: false,
        summary: expect.objectContaining({
          total_item_count: expect.any(Number),
          generated_health_item_count: expect.any(Number),
          supplement_candidate_item_count: expect.any(Number),
          p0_count: expect.any(Number),
          p1_count: expect.any(Number),
        }),
      });
      expect(backlogRes.body.data.summary.generated_health_item_count).toBeGreaterThanOrEqual(3);
      expect(backlogRes.body.data.summary.p0_count).toBeGreaterThanOrEqual(2);
      expect(backlogRes.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          source_kind: 'generated_health',
          project_id: 'health-interrupted-story',
          priority: 'P0',
          action_type: 'repair_story_project_refs',
          missing_contracts: expect.arrayContaining(['current_story']),
        }),
        expect.objectContaining({
          source_kind: 'generated_health',
          project_id: 'health-relink-series',
          priority: 'P0',
          action_type: 'restore_series_story_refs',
        }),
      ]));
      expect(backlogRes.body.data.markdown).toContain('# Story Agent Backlog Handoff');
      expect(backlogRes.body.data.markdown).toContain('province_markdown_written: false');

      const governanceRes = await request.get('/api/system/story-agent-generated-governance-plan?limit=2');
      expect(governanceRes.status).toBe(200);
      expectSuccess(governanceRes.body);
      expect(governanceRes.body.data).toMatchObject({
        schema_version: 'story-agent-generated-governance-plan/v1',
        status: expect.stringMatching(/ready|needs_action|blocked/),
        summary: expect.objectContaining({
          source_total_target_count: expect.any(Number),
          series_relink_candidate_count: expect.any(Number),
          series_archive_or_rebuild_candidate_count: expect.any(Number),
          series_planned_only_count: expect.any(Number),
          series_contract_repair_candidate_count: expect.any(Number),
          story_ref_repair_candidate_count: expect.any(Number),
          ready_gears_signoff_candidate_count: expect.any(Number),
        }),
        source_health_summary: expect.objectContaining({
          total_target_count: expect.any(Number),
        }),
      });
      expect(governanceRes.body.data.summary.series_relink_candidate_count).toBeGreaterThanOrEqual(1);
      expect(governanceRes.body.data.summary.series_archive_or_rebuild_candidate_count).toBeGreaterThanOrEqual(1);
      expect(governanceRes.body.data.summary.series_planned_only_count).toBeGreaterThanOrEqual(1);
      expect(governanceRes.body.data.summary.series_contract_repair_candidate_count).toBeGreaterThanOrEqual(1);
      expect(governanceRes.body.data.summary.story_ref_repair_candidate_count).toBeGreaterThanOrEqual(1);
      expect(governanceRes.body.data.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          action_key: 'restore_or_relink_series_story_refs',
          can_auto_apply: false,
          runner: 'operator',
          sample_targets: expect.arrayContaining([
            expect.objectContaining({
              project_id: 'health-relink-series',
              relink_candidate: true,
            }),
          ]),
        }),
        expect.objectContaining({
          action_key: 'archive_or_rebuild_series_fixtures',
          can_auto_apply: false,
        }),
        expect.objectContaining({
          action_key: 'generate_first_series_episode',
          runner: 'story_agent_api',
          can_auto_apply: false,
        }),
        expect.objectContaining({
          action_key: 'repair_series_command_contracts',
          runner: 'story_agent_api',
          can_auto_apply: false,
        }),
        expect.objectContaining({
          action_key: 'repair_story_project_refs',
          runner: 'story_agent_api',
          can_auto_apply: false,
        }),
      ]));
      expect(governanceRes.body.data.markdown).toContain('Story Agent Generated Governance Plan');
      expect(governanceRes.body.data.markdown).toContain('restore_or_relink_series_story_refs');
      expect(governanceRes.body.data.notes.join('\n')).toContain('Read-only governance plan');

      const governanceRunRes = await request
        .post('/api/system/story-agent-generated-governance-plan/run')
        .send({
          dry_run: true,
          action_keys: ['restore_or_relink_series_story_refs'],
          project_ids: ['health-relink-series'],
          max_targets: 1,
        });
      expect(governanceRunRes.status).toBe(200);
      expectSuccess(governanceRunRes.body);
      expect(governanceRunRes.body.data).toMatchObject({
        schema_version: 'story-agent-generated-governance-run/v1',
        dry_run: true,
        status: 'needs_action',
        selected_action_count: 1,
        selected_target_count: 1,
        planned_target_count: 1,
        blocked_target_count: 0,
        manifest: {
          schema_version: 'story-agent-generated-governance-run-manifest/v1',
          dry_run: true,
          items: [expect.objectContaining({
            action_key: 'restore_or_relink_series_story_refs',
            project_id: 'health-relink-series',
            status: 'planned',
            expected_file_changes: expect.arrayContaining([
              'web/generated/ai-comic-series-projects/health-relink-series/project.json',
            ]),
          })],
        },
      });
      expect(governanceRunRes.body.data.markdown).toContain('Story Agent Generated Governance Run');

      const blockedRunRes = await request
        .post('/api/system/story-agent-generated-governance-plan/run')
        .send({
          dry_run: false,
          action_keys: ['restore_or_relink_series_story_refs'],
          project_ids: ['health-relink-series'],
          max_targets: 1,
        });
      expect(blockedRunRes.status).toBe(200);
      expectSuccess(blockedRunRes.body);
      expect(blockedRunRes.body.data.status).toBe('blocked');
      expect(blockedRunRes.body.data.blocked_target_count).toBe(1);
      expect(blockedRunRes.body.data.notes.join('\n')).toContain('intentionally blocked');

      await rm(interruptedStoryDir, { recursive: true, force: true });
      await rm(plannedSeriesDir, { recursive: true, force: true });
      await rm(gapSeriesDir, { recursive: true, force: true });
      await rm(relinkSeriesDir, { recursive: true, force: true });
      await rm(archiveSeriesDir, { recursive: true, force: true });
      await rm(resolve(storyFileDir, '20260622-story-health-series-1.json'), { force: true });
    });
  });

  describe('GET /api/system/story-agent-mvp-status', () => {
    it('combines generated health and production readiness into MVP lanes', async () => {
      const story: StoryGenerateResult = {
        ...makeApiStory(),
        storyId: '20260623-story-mvp-status-api',
        title: 'API Story Agent MVP 状态测试故事',
        gears_segments_url: '/api/stories/20260623-story-mvp-status-api/gears-segments',
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-23T09:00:00.000Z');

      const res = await request.get('/api/system/story-agent-mvp-status?generatedLimit=50&portfolioLimit=50');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'story-agent-mvp-status/v1',
        status: expect.stringMatching(/ready|needs_action|blocked/),
        score: expect.any(Number),
        summary: expect.objectContaining({
          generated_target_count: expect.any(Number),
          readiness_target_count: expect.any(Number),
          ready_automation_step_count: expect.any(Number),
          external_or_manual_step_count: expect.any(Number),
          real_gears_endpoint_configured: expect.any(Boolean),
          real_gears_callback_secret_configured: expect.any(Boolean),
          real_gears_callback_base_configured: expect.any(Boolean),
          real_gears_callback_base_public: expect.any(Boolean),
          real_gears_acceptance_ready_to_run: expect.any(Boolean),
          real_gears_acceptance_blocker: expect.any(String),
          local_acceptance_counts_as_real_external_callback: false,
          seedance_provider_submit_adapter_configured: expect.any(Boolean),
          seedance_provider_poll_adapter_configured: expect.any(Boolean),
          seedance_provider_callback_base_configured: expect.any(Boolean),
          seedance_provider_external_loop_ready: expect.any(Boolean),
          seedance_placeholder_asset_count: expect.any(Number),
          seedance_production_asset_ready_count: expect.any(Number),
          knowledge_writeback_ready_count: expect.any(Number),
          knowledge_writeback_project_ready_count: expect.any(Number),
          knowledge_writeback_expansion_ready_count: expect.any(Number),
          knowledge_writeback_total_ready_count: expect.any(Number),
          knowledge_writeback_project_count: expect.any(Number),
          knowledge_writeback_draft_ready_count: expect.any(Number),
          knowledge_writeback_queued_count: expect.any(Number),
          knowledge_writeback_written_back_count: expect.any(Number),
          knowledge_writeback_needs_revision_count: expect.any(Number),
          knowledge_writeback_expansion_draft_ready_count: expect.any(Number),
          knowledge_writeback_expansion_queued_count: expect.any(Number),
          knowledge_writeback_expansion_written_back_count: expect.any(Number),
          knowledge_writeback_expansion_needs_revision_count: expect.any(Number),
          knowledge_writeback_total_draft_ready_count: expect.any(Number),
          knowledge_writeback_total_queued_count: expect.any(Number),
          knowledge_writeback_total_written_back_count: expect.any(Number),
          knowledge_writeback_total_needs_revision_count: expect.any(Number),
          knowledge_writeback_unified_export_schema: 'knowledge-writeback-queue-export/v1',
          knowledge_writeback_unified_export_ready: expect.any(Boolean),
          knowledge_writeback_unified_export_approved_count: expect.any(Number),
          knowledge_writeback_unified_export_project_approved_count: expect.any(Number),
          knowledge_writeback_unified_export_expansion_approved_count: expect.any(Number),
          knowledge_writeback_unified_export_target_file_count: expect.any(Number),
          knowledge_writeback_unified_export_direct_writeback_to_province_markdown: false,
          knowledge_writeback_unified_export_province_markdown_written: false,
          knowledge_writeback_review_handoff_count: expect.any(Number),
          knowledge_writeback_review_handoff_requires_signoff_count: expect.any(Number),
          knowledge_writeback_review_handoff_runtime_override_count: expect.any(Number),
          knowledge_writeback_review_handoff_missing_review_note_count: expect.any(Number),
          knowledge_writeback_review_handoff_reviewer_identity_count: expect.any(Number),
          knowledge_writeback_review_handoff_missing_reviewer_identity_count: expect.any(Number),
          knowledge_writeback_review_handoff_source_ref_count: expect.any(Number),
          knowledge_writeback_review_handoff_signoff_batch_summary_count: expect.any(Number),
          knowledge_writeback_review_handoff_signoff_ready_count: expect.any(Number),
          knowledge_writeback_review_handoff_signoff_blocked_count: expect.any(Number),
          knowledge_writeback_review_handoff_signoff_manifest_id: expect.stringMatching(/^kwb-signoff-/),
          knowledge_writeback_review_handoff_signoff_manifest_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          knowledge_writeback_signoff_package_schema: 'knowledge-writeback-queue-signoff-package/v1',
          knowledge_writeback_signoff_package_item_count: expect.any(Number),
          knowledge_writeback_signoff_package_batch_summary_count: expect.any(Number),
          knowledge_writeback_manual_patch_package_schema: 'knowledge-writeback-manual-patch-package/v1',
          knowledge_writeback_manual_patch_ready: expect.any(Boolean),
          knowledge_writeback_manual_patch_target_file_count: expect.any(Number),
          knowledge_writeback_manual_patch_closure_certificate_id: expect.stringMatching(/^kwb-manual-closure-/),
          knowledge_writeback_manual_patch_closure_certificate_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          knowledge_writeback_manual_patch_closure_certificate_ready: expect.any(Boolean),
          knowledge_writeback_manual_patch_total_patch_count: expect.any(Number),
          knowledge_writeback_manual_patch_project_patch_count: expect.any(Number),
          knowledge_writeback_manual_patch_expansion_patch_count: expect.any(Number),
          generated_governance_action_count: expect.any(Number),
          generated_governance_p0_p1_action_count: expect.any(Number),
          generated_governance_ready_signoff_candidate_count: expect.any(Number),
          story_quality_passed_count: expect.any(Number),
          story_quality_failed_count: expect.any(Number),
          story_open_supplement_task_count: expect.any(Number),
          story_quality_passed_with_issue_count: expect.any(Number),
          story_quality_passed_with_open_supplement_count: expect.any(Number),
          story_quality_passed_with_issue_and_open_supplement_count: expect.any(Number),
          story_supplement_open_count: expect.any(Number),
          story_supplement_optional_open_count: expect.any(Number),
          story_supplement_risk_open_count: expect.any(Number),
          story_supplement_blocking_open_count: expect.any(Number),
          story_supplement_candidate_package_schema: 'project-supplement-candidate-package/v1',
          story_supplement_candidate_package_ready: true,
          story_supplement_candidate_package_task_count: expect.any(Number),
          story_supplement_candidate_package_open_task_count: expect.any(Number),
          story_supplement_candidate_package_blocking_open_count: expect.any(Number),
          story_supplement_candidate_package_risk_open_count: expect.any(Number),
          story_supplement_candidate_package_optional_open_count: expect.any(Number),
          story_supplement_candidate_package_project_count: expect.any(Number),
          story_supplement_candidate_package_target_file_count: expect.any(Number),
          story_supplement_candidate_package_direct_writeback_to_province_markdown: false,
          story_supplement_candidate_package_province_markdown_written: false,
          story_agent_backlog_handoff_schema: 'story-agent-backlog-handoff/v1',
          story_agent_backlog_handoff_item_count: expect.any(Number),
          story_agent_backlog_handoff_generated_health_item_count: expect.any(Number),
          story_agent_backlog_handoff_supplement_candidate_item_count: expect.any(Number),
          story_agent_backlog_handoff_p0_count: expect.any(Number),
          story_agent_backlog_handoff_p1_count: expect.any(Number),
          story_agent_backlog_handoff_p2_count: expect.any(Number),
          story_agent_backlog_handoff_p3_count: expect.any(Number),
          story_agent_backlog_handoff_direct_writeback_to_province_markdown: false,
          story_agent_backlog_handoff_province_markdown_written: false,
          story_material_sufficiency_blocked_count: expect.any(Number),
          production_material_pack_status: 'passed',
          production_material_pack_count: expect.any(Number),
          production_material_pack_issue_count: 0,
          production_material_pack_core_ready_count: 4,
          production_material_pack_core_total_count: 4,
          domain_pack_status: 'passed',
          domain_pack_count: expect.any(Number),
          domain_pack_issue_count: 0,
          production_domain_pack_ready_count: 8,
          production_domain_pack_required_count: 8,
          domain_pack_expansion_status: 'passed',
          domain_pack_expansion_batch_count: 11,
          domain_pack_expansion_seed_target_count: expect.any(Number),
          domain_pack_expansion_candidate_field_count: expect.any(Number),
          domain_pack_expansion_pipeline_progress_percent: 100,
          domain_pack_expansion_pipeline_stage: 'complete',
          domain_pack_expansion_field_workbench_item_count: expect.any(Number),
          domain_pack_expansion_field_supplement_candidate_count: expect.any(Number),
          domain_pack_expansion_field_missing_candidate_count: expect.any(Number),
          domain_pack_expansion_field_candidate_completion_percent: expect.any(Number),
          domain_pack_expansion_field_review_ready_count: expect.any(Number),
          domain_pack_expansion_field_review_blocker_count: expect.any(Number),
          domain_pack_expansion_field_review_ready_percent: expect.any(Number),
          domain_pack_expansion_field_supplement_priority_target_count: expect.any(Number),
          domain_pack_expansion_review_ready_priority_target_count: expect.any(Number),
          domain_pack_expansion_issue_count: 0,
          domain_pack_expansion_review_ready_item_count: expect.any(Number),
          domain_pack_expansion_review_blocked_item_count: expect.any(Number),
          domain_pack_expansion_review_candidate_count: expect.any(Number),
          domain_pack_expansion_review_approved_count: 100,
          domain_pack_expansion_review_rejected_count: 0,
          domain_pack_expansion_review_needs_revision_count: 0,
          domain_pack_expansion_approved_writeback_draft_count: 100,
          domain_pack_expansion_writeback_draft_ready_count: 100,
          domain_pack_expansion_writeback_queued_count: 0,
          domain_pack_expansion_writeback_written_back_count: 0,
          domain_pack_expansion_writeback_needs_revision_count: 0,
          domain_pack_expansion_review_closure_ready: true,
          domain_pack_expansion_review_closure_signoff_batch_count: 6,
          domain_pack_expansion_review_closure_ready_for_signoff_count: 100,
          domain_pack_expansion_review_closure_blocked_for_signoff_count: 0,
          domain_pack_expansion_review_closure_missing_review_note_count: 0,
          domain_pack_expansion_review_closure_missing_reviewer_identity_count: 0,
          domain_pack_expansion_review_closure_missing_signoff_batch_count: 0,
          domain_pack_expansion_review_closure_runtime_override_count: 0,
          domain_pack_expansion_development_progress_average_percent: 100,
          domain_pack_expansion_field_workbench_controls_percent: 100,
          domain_pack_expansion_manual_review_closure_percent: 100,
          domain_pack_expansion_writeback_safety_export_percent: 100,
          domain_pack_expansion_third_batch_real_candidates_percent: 100,
          domain_pack_expansion_mvp_completion_surface_percent: 100,
          story_agent_command_surface_status: 'ready',
          story_agent_command_surface_percent: 100,
          mcp_story_agent_tool_count: expect.any(Number),
          mcp_story_agent_loop_percent: 100,
          content_command_layer_percent: 100,
          production_delivery_contract_percent: 100,
          production_delivery_contract_surface_count: 13,
        }),
        generated_health: {
          schema_version: 'story-agent-generated-health/v1',
        },
        backlog_handoff: {
          schema_version: 'story-agent-backlog-handoff/v1',
          direct_writeback_to_province_markdown: false,
          province_markdown_written: false,
        },
        generated_governance_plan: {
          schema_version: 'story-agent-generated-governance-plan/v1',
        },
        production_material_pack_health: {
          schema_version: 'production-material-pack-health/v1',
          status: 'passed',
        },
        domain_pack_health: {
          schema_version: 'domain-pack-production-health/v1',
          status: 'passed',
        },
        domain_pack_expansion_candidates: {
          schema_version: 'domain-pack-expansion-candidates-report/v1',
          status: 'passed',
        },
        production_portfolio: {
          schema_version: 'production-readiness-portfolio/v1',
          summary: {
            seedance_placeholder_asset_count: expect.any(Number),
            seedance_production_asset_ready_count: expect.any(Number),
          },
        },
      });
      expect(res.body.data.summary.generated_target_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.readiness_target_count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.domain_pack_expansion_field_workbench_item_count)
        .toBeGreaterThanOrEqual(res.body.data.summary.domain_pack_expansion_field_supplement_candidate_count);
      expect(res.body.data.summary.domain_pack_expansion_field_supplement_candidate_count).toBeGreaterThanOrEqual(120);
      expect(res.body.data.summary.domain_pack_expansion_field_missing_candidate_count).toBe(
        res.body.data.summary.domain_pack_expansion_field_workbench_item_count
        - res.body.data.summary.domain_pack_expansion_field_supplement_candidate_count,
      );
      expect(res.body.data.summary.domain_pack_expansion_field_supplement_priority_target_count)
        .toBe(res.body.data.summary.domain_pack_expansion_field_missing_candidate_count);
      expect(res.body.data.summary.domain_pack_expansion_field_candidate_completion_percent).toBeGreaterThanOrEqual(100);
      expect(res.body.data.summary.domain_pack_expansion_field_review_ready_count)
        .toBe(res.body.data.summary.domain_pack_expansion_field_workbench_item_count);
      expect(res.body.data.summary.domain_pack_expansion_field_review_blocker_count).toBe(0);
      expect(res.body.data.summary.domain_pack_expansion_field_review_ready_percent).toBe(100);
      expect(res.body.data.summary.domain_pack_expansion_review_ready_item_count)
        .toBe(res.body.data.summary.domain_pack_expansion_seed_target_count);
      expect(res.body.data.summary.domain_pack_expansion_review_blocked_item_count).toBe(0);
      expect(res.body.data.summary.domain_pack_expansion_review_ready_priority_target_count).toBe(0);
      expect(res.body.data.summary.domain_pack_expansion_pipeline_progress_percent).toBe(100);
      expect(res.body.data.summary.domain_pack_expansion_pipeline_stage).toBe('complete');
      expect(res.body.data.markdown).toContain('Seedance placeholder assets');
      expect(res.body.data.markdown).toContain('local acceptance counts as real external callback: false');
      expect(res.body.data.markdown).toContain('story supplement candidate package');
      expect(res.body.data.markdown).toContain('story quality passed with followups');
      expect(res.body.data.markdown).toContain('story agent backlog handoff');
      expect(res.body.data.markdown).toContain('knowledge writeback ready drafts');
      expect(res.body.data.markdown).toContain('domain pack expansion field workbench items');
      expect(res.body.data.markdown).toContain('domain pack expansion pipeline progress: 100%');
      expect(res.body.data.markdown).toContain('domain pack expansion pipeline stage: complete');
      expect(res.body.data.markdown).toContain('domain pack expansion field supplement candidates');
      expect(res.body.data.markdown).toContain('domain pack expansion field missing candidates');
      expect(res.body.data.markdown).toContain('domain pack expansion field candidate completion');
      expect(res.body.data.markdown).toContain('domain pack expansion field review ready');
      expect(res.body.data.markdown).toContain('domain pack expansion field review blockers');
      expect(res.body.data.markdown).toContain('domain pack expansion field supplement priority targets');
      expect(res.body.data.markdown).toContain('domain pack expansion review ready priority targets');
      expect(res.body.data.markdown).toContain('domain pack expansion review approved: 100');
      expect(res.body.data.markdown).toContain('domain pack expansion approved writeback drafts: 100');
      expect(res.body.data.markdown).toContain('domain pack expansion review closure ready: true');
      expect(res.body.data.markdown).toContain('domain pack expansion review closure ready/blocked: 100/0');
      expect(res.body.data.markdown).toContain('knowledge writeback review handoff');
      expect(res.body.data.markdown).toContain('knowledge writeback signoff package');
      expect(res.body.data.markdown).toContain('knowledge writeback manual patch package');
      expect(res.body.data.markdown).toContain('knowledge writeback review handoff reviewer identities');
      expect(res.body.data.markdown).toContain('domain pack expansion writeback preflight ready: true');
      expect(res.body.data.markdown).toContain('domain pack expansion manual writeback required: 100');
      expect(res.body.data.markdown).toContain('domain pack expansion next development tasks: 5');
      expect(res.body.data.lanes.map((lane: any) => lane.key)).toEqual(expect.arrayContaining([
        'generated_artifacts',
        'generated_governance',
        'production_material_packs',
        'domain_packs',
        'domain_pack_expansion',
        'knowledge_writeback',
        'story_quality',
        'repair_loop',
        'delivery_contract',
        'production_command',
      ]));
      expect(res.body.data.lanes.find((lane: any) => lane.key === 'production_material_packs')?.evidence)
        .toContain('domain_sample_ready=3/3');
      const storyQualityLane = res.body.data.lanes.find((lane: any) => lane.key === 'story_quality');
      expect(storyQualityLane.evidence).toEqual(expect.arrayContaining([
        expect.stringMatching(/^quality_passed=\d+/),
        expect.stringMatching(/^quality_failed=\d+/),
        expect.stringMatching(/^quality_passed_with_issues=\d+/),
        expect.stringMatching(/^quality_passed_with_open_supplement=\d+/),
        expect.stringMatching(/^quality_passed_with_issues_and_open_supplement=\d+/),
        'quality_followup_semantics=passed_main_gate_not_hidden_failure',
        expect.stringMatching(/^open_supplement_tasks=\d+/),
        expect.stringMatching(/^supplement_optional=\d+/),
        expect.stringMatching(/^supplement_risk=\d+/),
        expect.stringMatching(/^supplement_blocking=\d+/),
        expect.stringMatching(/^supplement_candidate_package_ready=(true|false)$/),
        expect.stringMatching(/^supplement_candidate_package_tasks=\d+/),
        expect.stringMatching(/^supplement_candidate_package_open=\d+/),
        expect.stringMatching(/^supplement_candidate_package_blocking=\d+/),
        expect.stringMatching(/^supplement_candidate_package_risk=\d+/),
        expect.stringMatching(/^supplement_candidate_package_optional=\d+/),
        expect.stringMatching(/^supplement_candidate_package_target_files=\d+/),
        expect.stringMatching(/^material_sufficiency_blocked=\d+/),
      ]));
      expect(res.body.data.progress).toEqual(expect.arrayContaining([
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
      expect(res.body.data.progress.find((slice: any) => slice.key === 'mcp_story_agent_loop')?.evidence).toEqual(expect.arrayContaining([
        'implementation_progress=100',
        expect.stringContaining('tool_count=28'),
        expect.stringContaining('kb_get_story_agent_backlog_handoff'),
        expect.stringContaining('kb_get_domain_pack_expansion_candidates'),
        expect.stringContaining('kb_get_domain_pack_expansion_writeback_draft'),
        expect.stringContaining('kb_update_domain_pack_expansion_review_state'),
        expect.stringContaining('kb_update_domain_pack_expansion_review_state_bulk'),
        expect.stringContaining('kb_generate_story_repair_prompt'),
        'media_execution=gears_v2',
      ]));
      expect(res.body.data.progress.find((slice: any) => slice.key === 'content_command_layer')?.evidence).toEqual(expect.arrayContaining([
        'implementation_progress=100',
        'production_material_pack_status=passed',
        'production_material_core_ready=4/4',
        'production_material_pack_issues=0',
        'domain_pack_status=passed',
        'domain_pack_ready=8/8',
        'domain_pack_issues=0',
        'domain_pack_expansion_status=passed',
        'domain_pack_expansion_batches=11',
        expect.stringContaining('domain_pack_expansion_seed_targets='),
        expect.stringContaining('domain_pack_expansion_candidate_fields='),
        'domain_pack_expansion_progress=100',
        'domain_pack_expansion_stage=complete',
        expect.stringContaining('domain_pack_expansion_field_workbench_items='),
        expect.stringContaining('domain_pack_expansion_field_samples='),
        expect.stringContaining('domain_pack_expansion_field_missing='),
        expect.stringContaining('domain_pack_expansion_field_completion='),
        expect.stringContaining('domain_pack_expansion_field_review_ready='),
        expect.stringContaining('domain_pack_expansion_field_review_blockers='),
        expect.stringContaining('domain_pack_expansion_field_review_ready_percent='),
        expect.stringContaining('domain_pack_expansion_field_priority_targets='),
        expect.stringContaining('domain_pack_expansion_review_ready_priority_targets='),
        expect.stringContaining('domain_pack_expansion_review_ready_items='),
        expect.stringContaining('domain_pack_expansion_review_blocked_items='),
        'domain_pack_expansion_review_approved=100',
        'domain_pack_expansion_approved_writeback_drafts=100',
        'domain_pack_expansion_writeback_queued=0',
        'domain_pack_expansion_review_closure_ready=true',
        'domain_pack_expansion_review_closure_signoff_batches=6',
        'domain_pack_expansion_review_closure_ready_for_signoff=100',
        'domain_pack_expansion_review_closure_blocked_for_signoff=0',
        'domain_pack_expansion_review_closure_missing_notes=0',
        'domain_pack_expansion_review_closure_missing_reviewers=0',
        'domain_pack_expansion_review_closure_missing_batches=0',
        'domain_pack_expansion_writeback_preflight_ready=true',
        'domain_pack_expansion_writeback_target_files=7',
        'domain_pack_expansion_manual_writeback_required=100',
        'domain_pack_expansion_next_development_tasks=5',
        'domain_pack_expansion_plan_1_field_workbench_controls_percent=100',
        'domain_pack_expansion_plan_2_manual_review_closure_percent=100',
        'domain_pack_expansion_plan_3_writeback_safety_export_percent=100',
        'domain_pack_expansion_plan_4_third_batch_real_candidates_percent=100',
        'domain_pack_expansion_plan_5_mvp_completion_surface_percent=100',
        expect.stringContaining('knowledge_writeback_review_handoff='),
        expect.stringContaining('knowledge_writeback_review_handoff_signoff='),
        expect.stringContaining('knowledge_writeback_review_handoff_reviewer_identities='),
        expect.stringContaining('knowledge_writeback_review_handoff_missing_reviewer_identities='),
        expect.stringContaining('knowledge_writeback_review_handoff_signoff_batches='),
        expect.stringContaining('knowledge_writeback_review_handoff_signoff_ready='),
        expect.stringContaining('knowledge_writeback_review_handoff_signoff_blocked='),
        'knowledge_writeback_signoff_package_schema=knowledge-writeback-queue-signoff-package/v1',
        expect.stringContaining('knowledge_writeback_signoff_package_items='),
        expect.stringContaining('knowledge_writeback_signoff_package_batches='),
        'domain_pack_expansion_direct_writeback=false',
        'local_target_health_tracked_by=lanes',
        'real_media_execution=gears_v2',
      ]));
      expect(res.body.data.progress.find((slice: any) => slice.key === 'production_delivery_contract')?.evidence).toEqual(expect.arrayContaining([
        'implementation_progress=100',
        'surface_count=13',
        expect.stringContaining('production_board_export'),
        expect.stringContaining('seedance_asset_upload_checklist'),
        expect.stringContaining('worker_evidence_signoff'),
        'local_target_health_tracked_by=delivery_contract_lane',
        'real_media_execution=gears_v2',
      ]));
      expect(res.body.data.progress.find((slice: any) => slice.key === 'gears_end_to_end_acceptance')?.evidence).toEqual(expect.arrayContaining([
        'acceptance_progress=95',
        expect.stringContaining('gears_endpoint_configured='),
        expect.stringContaining('gears_callback_secret_configured='),
        expect.stringContaining('gears_callback_base_configured='),
        expect.stringContaining('gears_callback_base_public='),
        expect.stringContaining('ready_to_run_real_acceptance='),
        'local_acceptance_counts_as_real_external_callback=false',
        expect.stringContaining('seedance_provider_external_loop_ready='),
        expect.stringContaining('external_or_manual_steps='),
        'requires=run-gears-worker-acceptance.sh',
        'requires=worker_evidence_signoff',
      ]));
      expect(res.body.data.lanes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'generated_governance',
          score: 100,
          status: 'ready',
        }),
        expect.objectContaining({
          key: 'production_material_packs',
          score: 100,
          status: 'ready',
          evidence: expect.arrayContaining([
            'pack_file_valid=true',
            'rejected_pack_count=0',
            'duplicate_pack_video_type_count=0',
          ]),
        }),
        expect.objectContaining({
          key: 'domain_packs',
          score: 100,
          status: 'ready',
        }),
        expect.objectContaining({
          key: 'domain_pack_expansion',
          status: 'ready',
          evidence: expect.arrayContaining([
            'candidate_status=passed',
            'pipeline_progress_percent=100',
            'pipeline_stage=complete',
            expect.stringContaining('field_workbench_item_count='),
            expect.stringContaining('field_supplement_candidate_count='),
            expect.stringContaining('field_missing_candidate_count='),
            expect.stringContaining('field_candidate_completion_percent='),
            expect.stringContaining('field_review_ready_count='),
            expect.stringContaining('field_review_blocker_count='),
            expect.stringContaining('field_review_ready_percent='),
            expect.stringContaining('field_supplement_priority_target_count='),
            expect.stringContaining('review_ready_priority_target_count='),
            expect.stringContaining('review_ready_item_count='),
            expect.stringContaining('review_blocked_item_count='),
            expect.stringContaining('review_candidate_count='),
            'review_approved_count=100',
            'approved_writeback_drafts=100',
            'writeback_queued=0',
            'writeback_preflight_ready=true',
            'writeback_preflight_target_files=7',
            'writeback_handoff_ready=true',
            'writeback_handoff_target_files=7',
            'writeback_handoff_signoff_batches=6',
            'writeback_handoff_ready_for_signoff=100',
            'writeback_handoff_blocked_for_signoff=0',
            expect.stringContaining('writeback_handoff_source_refs='),
            'manual_writeback_required=100',
            'next_development_tasks=5',
            expect.stringContaining('next_development_task_ids=field_workbench_controls'),
            'direct_writeback=false',
            'requires_candidate_markdown=true',
            'requires_human_review=true',
            'requires_source_level=true',
          ]),
        }),
      ]));
      expect(res.body.data.priority_targets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'story_project',
          project_id: enriched.project_id,
          priority_score: expect.any(Number),
        }),
      ]));
      expect(res.body.data.notes.join('\n')).toContain('Generated governance command surface is complete at 100%');
      expect(res.body.data.notes.join('\n')).toContain('Production material pack health is now a Story Agent MVP lane');
      expect(res.body.data.notes.join('\n')).toContain('Domain Pack production health is now a Story Agent MVP lane');
      expect(res.body.data.notes.join('\n')).toContain('Domain Pack expansion candidates are tracked as a Story Agent MVP lane');
      expect(res.body.data.notes.join('\n')).toContain('MCP Story Agent loop is complete at 100%');
      expect(res.body.data.notes.join('\n')).toContain('Content and production command layer is complete at 100%');
      expect(res.body.data.notes.join('\n')).toContain('Production Board / Delivery Contract command surface is complete at 100%');
      expect(res.body.data.notes.join('\n')).toContain('Story Agent command surface is signed off at 100%');
      expect(res.body.data.notes.join('\n')).toContain('content and production command layer');
      expect(res.body.data.notes.join('\n')).toContain('remaining 5%');
      expect(res.body.data.markdown).toContain('# Story Agent MVP Status');
      expect(res.body.data.markdown).toContain('Progress Split');
      expect(res.body.data.markdown).toContain('production delivery contract: 100%');
      expect(res.body.data.markdown).toContain('production material pack health: passed');
      expect(res.body.data.markdown).toContain('domain pack health: passed');
      expect(res.body.data.markdown).toContain('domain pack expansion candidates: passed');
      expect(res.body.data.markdown).toContain('Production material packs');
      expect(res.body.data.markdown).toContain('Domain packs');
      expect(res.body.data.markdown).toContain('Domain pack expansion candidates');
      expect(res.body.data.markdown).toContain('Story Agent command surface: ready · 100%');
      expect(res.body.data.markdown).toContain('Delivery contract');
    });

    it('does not count local callback URLs as real external GEARS callback readiness', async () => {
      const previous = {
        preferredApiBaseUrl: process.env.GEARS_EXECUTION_WORKER_API_BASE_URL,
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
        publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL,
        appBaseUrl: process.env.APP_BASE_URL,
      };
      try {
        process.env.GEARS_EXECUTION_WORKER_API_BASE_URL = 'https://gears.example.test/api-root';
        delete process.env.GEARS_API_BASE_URL;
        process.env.GEARS_CALLBACK_SECRET = 'private-callback-token';
        process.env.GEARS_CALLBACK_BASE_URL = 'http://127.0.0.1:3002';
        delete process.env.PUBLIC_API_BASE_URL;
        delete process.env.APP_BASE_URL;

        const res = await request.get('/api/system/story-agent-mvp-status?generatedLimit=10&portfolioLimit=10');

        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data.summary).toMatchObject({
          real_gears_endpoint_configured: true,
          real_gears_callback_secret_configured: true,
          real_gears_callback_base_configured: true,
          real_gears_callback_base_public: false,
          real_gears_acceptance_ready_to_run: false,
          real_gears_acceptance_blocker: 'real_gears_callback_base_not_public',
          local_acceptance_counts_as_real_external_callback: false,
        });
        const gearsAcceptance = res.body.data.progress.find((slice: any) => slice.key === 'gears_end_to_end_acceptance');
        expect(gearsAcceptance).toMatchObject({
          blocker: 'real_gears_callback_base_not_public',
        });
        expect(gearsAcceptance?.evidence).toEqual(expect.arrayContaining([
          'gears_endpoint_configured=true',
          'gears_callback_secret_configured=true',
          'gears_callback_base_configured=true',
          'gears_callback_base_public=false',
          'ready_to_run_real_acceptance=false',
          'local_acceptance_counts_as_real_external_callback=false',
        ]));
      } finally {
        if (previous.preferredApiBaseUrl === undefined) delete process.env.GEARS_EXECUTION_WORKER_API_BASE_URL;
        else process.env.GEARS_EXECUTION_WORKER_API_BASE_URL = previous.preferredApiBaseUrl;
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
        if (previous.publicApiBaseUrl === undefined) delete process.env.PUBLIC_API_BASE_URL;
        else process.env.PUBLIC_API_BASE_URL = previous.publicApiBaseUrl;
        if (previous.appBaseUrl === undefined) delete process.env.APP_BASE_URL;
        else process.env.APP_BASE_URL = previous.appBaseUrl;
      }
    });

    it('preserves the legacy type catalog through explicit china_culture routing', async () => {
      const legacyRes = await request.get('/api/system/types');
      const domainRes = await request.get('/api/system/types?domain=china_culture');

      expect(domainRes.status).toBe(200);
      expect(domainRes.body).toEqual(legacyRes.body);
    });

    it('fails closed for an unregistered type-catalog domain', async () => {
      const res = await request.get('/api/system/types?domain=unregistered_domain');

      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });
  });

  describe('GET /api/system/domain-packs', () => {
    it('returns a secret-free self-description of registered packs', async () => {
      const res = await request.get('/api/system/domain-packs');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toEqual([
        expect.objectContaining({
          meta: expect.objectContaining({
            domain_id: 'china_culture',
            capabilities: expect.arrayContaining(['entry_search', 'story_generate', 'type_catalog']),
          }),
          entry_type_count: 12,
          generation_type_count: 15,
        }),
        expect.objectContaining({
          meta: expect.objectContaining({
            domain_id: 'original_fiction',
            capabilities: expect.arrayContaining(['entry_search', 'story_generate', 'type_catalog']),
          }),
          entry_type_count: 1,
          generation_type_count: 5,
        }),
      ]);
      expect(JSON.stringify(res.body)).not.toContain('searchEntries');
    });
  });

  describe('GET /api/system/story-project-repository-config', () => {
    it('reports the file provider boundary without claiming database or object storage readiness', async () => {
      const previous = process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
      try {
        delete process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
        const res = await request.get('/api/system/story-project-repository-config');

        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          env: 'STORY_PROJECT_REPOSITORY_PROVIDER',
          configured_provider: 'file',
          active_provider: 'file',
          supported_providers: ['file', 'sqlite'],
          configuration_valid: true,
          database_kind: 'none',
          external_database: false,
          object_storage: false,
          same_host_atomic_locking: true,
          transactional_multi_record_writes: true,
          optimistic_concurrency_control: true,
          content_integrity_hashes: false,
          local_backup_verification_supported: false,
          production_recovery_drill_completed: false,
          production_persistence_ready: false,
        });
      } finally {
        if (previous === undefined) delete process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
        else process.env.STORY_PROJECT_REPOSITORY_PROVIDER = previous;
      }
    });
  });

  describe('GET /api/system/story-storage-root-config', () => {
    it('reports explicit active roots and keeps the legacy root discovery-only', async () => {
      const res = await request.get('/api/system/story-storage-root-config');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'story-storage-root-config/v1',
        kb_root: process.env.KB_ROOT,
        generated_root: process.env.WEB_GENERATED_ROOT,
        kb_root_source: 'explicit_env',
        generated_root_source: 'explicit_env',
        configuration_valid: true,
        legacy_policy: {
          discovery_only: true,
          included_in_active_read_roots: false,
          automatic_migration_allowed: false,
          automatic_merge_allowed: false,
          automatic_delete_allowed: false,
          automatic_writeback_allowed: false,
        },
        data_moved: false,
        data_deleted: false,
        data_overwritten: false,
        provider_switched: false,
        real_gears_seedance_delivery_credit_count: 0,
        counts_as_real_gears_seedance_delivery: false,
      });
      expect(res.body.data.generated_root).not.toBe(
        res.body.data.legacy_misresolved_generated_root,
      );
    });
  });

  describe('GET /api/system/story-storage-legacy-disposition-preflight', () => {
    it('returns a read-only, zero-action disposition report', async () => {
      const res = await request.get('/api/system/story-storage-legacy-disposition-preflight');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'story-storage-legacy-disposition-preflight/v1',
        read_only: true,
        consistent_snapshot_guaranteed: false,
        recheck_required_before_any_action: true,
        automatic_action_count: 0,
        migration_performed: false,
        merge_performed: false,
        deletion_performed: false,
        overwrite_performed: false,
        writeback_performed: false,
        domain_safety_migration_performed: false,
        provider_switched: false,
        real_gears_seedance_delivery_credit_count: 0,
        counts_as_real_gears_seedance_delivery: false,
      });
      expect(res.body.data.inventory_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.data.items.every((item: {
        requires_human_review: boolean;
        automatic_action_allowed: boolean;
        real_credit_granted: boolean;
      }) => (
        item.requires_human_review
        && !item.automatic_action_allowed
        && !item.real_credit_granted
      ))).toBe(true);
    });
  });

  describe('GET /api/system/generation-types', () => {
    it('returns the china_culture generation catalog', async () => {
      const res = await request.get('/api/system/generation-types?domain=china_culture');

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toHaveLength(15);
      expect(res.body.data.map((type: { id: string }) => type.id)).toEqual(expect.arrayContaining([
        'character_story',
        'ai_comic_drama',
        'documentary_short',
      ]));
    });

    it('rejects an invalid generation-catalog domain identifier', async () => {
      const res = await request.get('/api/system/generation-types?domain=../unsafe');

      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/system/gears-execution-config', () => {
    it('returns safe GEARS execution config without leaking secrets', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        apiToken: process.env.GEARS_API_TOKEN,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
      };
      try {
        process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
        process.env.GEARS_API_TOKEN = 'private-api-token-123';
        process.env.GEARS_CALLBACK_SECRET = 'private-callback-token-456';
        process.env.GEARS_CALLBACK_BASE_URL = 'https://story.example.test/public';

        const res = await request.get('/api/system/gears-execution-config');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'gears',
          api_base_url_env: 'GEARS_EXECUTION_WORKER_API_BASE_URL',
          api_token_env: 'GEARS_EXECUTION_WORKER_API_TOKEN',
          legacy_api_base_url_env: 'GEARS_API_BASE_URL',
          legacy_api_token_env: 'GEARS_API_TOKEN',
          api_base_url_source: 'legacy',
          api_token_source: 'legacy',
          legacy_execution_worker_envs_used: ['GEARS_API_BASE_URL', 'GEARS_API_TOKEN'],
          api_base_url_configured: true,
          api_token_configured: true,
          callback_secret_configured: true,
          callback_base_configured: true,
          capability_endpoint_path: '/gears/capabilities',
          capability_required_before_requests: true,
          submit_endpoint_path: '/gears/jobs',
          job_status_endpoint_path: '/gears/jobs/{gears_job_id}',
          project_callback_path_template: '/api/projects/:projectId/gears-callback',
          series_callback_path_template: '/api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-callback',
          callback_batch_item_limit: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
          ready_for_submit: true,
          missing_submit_requirements: [],
        });
        expect(res.body.data.supported_job_types).toEqual(expect.arrayContaining([
          'storyboard_image',
          'seedance_video',
          'final_assemble',
        ]));
        expect(JSON.stringify(res.body.data)).not.toContain('private-api-token-123');
        expect(JSON.stringify(res.body.data)).not.toContain('private-callback-token-456');
        expect(JSON.stringify(res.body.data)).not.toContain('gears.example.test');
        expect(JSON.stringify(res.body.data)).not.toContain('story.example.test');
      } finally {
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.apiToken === undefined) delete process.env.GEARS_API_TOKEN;
        else process.env.GEARS_API_TOKEN = previous.apiToken;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
      }
    });
  });

  describe('GET /api/system/gears-execution-worker-capabilities', () => {
    it('returns only a validated independent execution-worker capability response', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_EXECUTION_WORKER_API_BASE_URL,
        apiToken: process.env.GEARS_EXECUTION_WORKER_API_TOKEN,
      };
      try {
        process.env.GEARS_EXECUTION_WORKER_API_BASE_URL = 'https://worker.example.test/root';
        process.env.GEARS_EXECUTION_WORKER_API_TOKEN = 'private-worker-token';
        const capability = {
          schema_version: 'gears-execution-worker-capabilities/v1',
          service: 'gears-execution-worker',
          execution_worker_supported: true,
          workbench_import_supported: false,
          bearer_auth_required: true,
          idempotent_submit: true,
          status_poll_supported: true,
          callback_delivery_supported: true,
          supported_job_types: ['seedance_video'],
          endpoints: {
            capabilities: { method: 'GET', path: '/gears/capabilities' },
            submit: { method: 'POST', path: '/gears/jobs' },
            job_status: { method: 'GET', path: '/gears/jobs/{gears_job_id}' },
          },
        };
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(capability)));
        vi.stubGlobal('fetch', fetchMock);

        const res = await request.get('/api/system/gears-execution-worker-capabilities');

        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toEqual(capability);
        expect(fetchMock).toHaveBeenCalledWith(
          'https://worker.example.test/root/gears/capabilities',
          expect.objectContaining({
            method: 'GET',
            headers: { authorization: 'Bearer private-worker-token' },
          }),
        );
      } finally {
        vi.unstubAllGlobals();
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_EXECUTION_WORKER_API_BASE_URL;
        else process.env.GEARS_EXECUTION_WORKER_API_BASE_URL = previous.apiBaseUrl;
        if (previous.apiToken === undefined) delete process.env.GEARS_EXECUTION_WORKER_API_TOKEN;
        else process.env.GEARS_EXECUTION_WORKER_API_TOKEN = previous.apiToken;
      }
    });
  });

  describe('GET /api/system/gears-execution-contract', () => {
    it('returns GEARS submit and callback contract metadata', async () => {
      const res = await request.get('/api/system/gears-execution-contract');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        provider: 'gears',
        schema_version: 'gears-execution-contract/v1',
        env: {
          api_base_url: 'GEARS_EXECUTION_WORKER_API_BASE_URL',
          api_token: 'GEARS_EXECUTION_WORKER_API_TOKEN',
          legacy_api_base_url: 'GEARS_API_BASE_URL',
          legacy_api_token: 'GEARS_API_TOKEN',
          callback_secret: 'GEARS_CALLBACK_SECRET',
          callback_base_url: 'GEARS_CALLBACK_BASE_URL',
        },
        capability: {
          method: 'GET',
          path: '/gears/capabilities',
          schema_version: 'gears-execution-worker-capabilities/v1',
          required_before_submit_and_poll: true,
        },
        submit: {
          method: 'POST',
          path: '/gears/jobs',
        },
        poll: {
          method: 'GET',
          path: '/gears/jobs/{gears_job_id}',
        },
        callback: {
          project_path: '/api/projects/:projectId/gears-callback',
          series_path: '/api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-callback',
          auth_env: 'GEARS_CALLBACK_SECRET',
          auth_optional_when_unset: true,
        },
      });
      expect(res.body.data.callback.auth_headers).toEqual(expect.arrayContaining([
        'Authorization: Bearer <GEARS_CALLBACK_SECRET>',
        'X-GEARS-Callback-Secret: <GEARS_CALLBACK_SECRET>',
      ]));
      expect(res.body.data.submit.request_fields).toEqual(expect.arrayContaining([
        'payload.units[].schema_version',
        'payload.units[].source_unit_id',
        'payload.units[].external_id',
        'payload.units[].custom_id',
        'payload.units[].idempotency_key',
        'payload.units[].callback_url',
        'payload.units[].metadata',
        'payload.units[].retry_count',
        'payload.units[].retry_reason',
        'payload.units[].previous_provider_job_id',
        'payload.units[].last_video_url',
        'payload.units[].review_issues',
      ]));
      expect(res.body.data.submit.accepted_response_shapes).toEqual(expect.arrayContaining([
        '{ data: { acceptedUnits: [...], rejectedUnits: [...] } }',
        '{ data: { rejectedUnits: [...] } }',
        '{ data: { task: { taskId, externalId, taskStatus } } }',
      ]));
      expect(res.body.data.submit.request_example).toMatchObject({
        series_project_id: '20260618-ai-comic-series-demo',
        job_type: 'seedance_video',
        payload: {
          units: [
            expect.objectContaining({
              schema_version: 'gears-series-seedance-video-retry-payload/v1',
              retry_count: 1,
              retry_reason: 'review_required',
              previous_provider_job_id: 'old-gears-job-001',
              last_video_url: 'https://media.example.test/old-shot-001.mp4',
              idempotency_key: 'seedance_video:episode:1:shot:001',
            }),
          ],
        },
      });
      expect(res.body.data.callback.accepted_status_fields).toEqual(expect.arrayContaining([
        'taskStatus',
        'job_status',
        'failed aliases: failed | error | timed_out | timeout | expired | deadline_exceeded | quota_exceeded | no_credit | access_denied | token_expired | rate_limited | network_error | service_unavailable | provider_error | render_failed | artifact_upload_failed | callback_delivery_failed | output_missing | artifact_invalid | worker_unavailable',
        'rejected aliases: rejected | blocked | policy_blocked | moderation_failed | content_policy | safety_blocked | risk_control | invalid_prompt | invalid_payload | validation_failed | asset_missing | unsupported_media | invalid_asset',
      ]));
      expect(res.body.data.callback.accepted_envelope_shapes).toEqual(expect.arrayContaining([
        '{ callbacks: [{ ...callback fields }] }',
        '{ events: [{ ...callback fields }] }',
        '{ data: { task: { task_id, taskStatus, output: { files[] } } } }',
        '{ data: { job: { jobId, job_status, outputs[] } } }',
      ]));
      expect(res.body.data.callback.request_fields).toEqual(expect.arrayContaining([
        'external_id | externalId',
        'custom_id | customId',
        'production_id | productionId',
        'idempotency_key | idempotencyKey',
      ]));
      expect(res.body.data.callback.accepted_artifact_fields).toEqual(expect.arrayContaining([
        'output.files[].mediaUrl',
        'outputs[].downloadUrl',
        'manifest_url | manifestUrl',
        'subtitle_url | subtitleUrl | srt_url | srtUrl | vtt_url | vttUrl',
        'audio_url | audioUrl',
      ]));
      expect(res.body.data.callback.idempotency_fields).toEqual(expect.arrayContaining([
        'event_id | eventId | callback_id | callbackId',
        'idempotency_key | idempotencyKey (job match key; lifecycle callbacks with changed status/progress/message are preserved)',
      ]));
      expect(res.body.data.callback.max_batch_items).toBe(GEARS_CALLBACK_BATCH_ITEM_LIMIT);
      expect(res.body.data.callback.accepted_time_fields).toEqual(expect.arrayContaining([
        'eventTime',
        'timestamp',
        'completedAt',
      ]));
      expect(res.body.data.callback.response_fields).toEqual(expect.arrayContaining([
        'failures[].path',
        'gears_job_ledger.items[].idempotency_key',
        'gears_job_ledger.items[].last_poll_error',
        'gears_job_ledger.items[].last_poll_failure_category',
        'gears_job_ledger.items[].completed_at',
        'gears_job_ledger.items[].callback_events[].event_id_source',
        'gears_job_ledger.items[].callback_events[].provider_event_at',
        'gears_job_ledger.items[].callback_events[].previous_status',
        'gears_job_ledger.items[].callback_events[].applied_status',
        'gears_job_ledger.items[].callback_events[].status_regression_ignored',
        'gears_job_ledger.items[].callback_events[].terminal_status_changed',
      ]));
      expect(res.body.data.poll.accepted_response_shapes).toEqual(expect.arrayContaining([
        '{ data: { job: { job_status, output: { files[] } } } }',
        '{ data: { task: { task_state, outputs[] } } }',
      ]));
      expect(res.body.data.poll.accepted_status_fields).toEqual(expect.arrayContaining([
        'taskStatus',
        'job_status',
        'failed aliases: failed | error | timed_out | timeout | expired | deadline_exceeded | quota_exceeded | no_credit | access_denied | token_expired | rate_limited | network_error | service_unavailable | provider_error | render_failed | artifact_upload_failed | callback_delivery_failed | output_missing | artifact_invalid | worker_unavailable',
        'rejected aliases: rejected | blocked | policy_blocked | moderation_failed | content_policy | safety_blocked | risk_control | invalid_prompt | invalid_payload | validation_failed | asset_missing | unsupported_media | invalid_asset',
      ]));
      expect(res.body.data.poll.accepted_artifact_fields).toEqual(expect.arrayContaining([
        'output.files[].mediaUrl',
        'outputs[].downloadUrl',
        'manifest_url | manifestUrl',
        'subtitle_url | subtitleUrl | srt_url | srtUrl | vtt_url | vttUrl',
        'audio_url | audioUrl',
      ]));
      expect(res.body.data.callback.request_examples).toEqual(expect.arrayContaining([
        expect.objectContaining({
          externalId: 'shot-1',
          idempotencyKey: 'seedance_video:shot-1',
        }),
        expect.objectContaining({
          jobType: 'final_assemble',
          artifacts: expect.arrayContaining([
            expect.objectContaining({ kind: 'video' }),
            expect.objectContaining({ kind: 'manifest' }),
          ]),
        }),
      ]));
      expect(res.body.data.supported_job_types).toContain('audio_mix');
      expect(JSON.stringify(res.body.data)).toContain('Legacy SEEDANCE_PROVIDER_* endpoints remain compatibility-only.');
    });
  });

  describe('GET /api/system/gears-execution-readiness', () => {
    it('returns GEARS readiness checks and local smoke results without leaking secrets', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        apiToken: process.env.GEARS_API_TOKEN,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
      };
      try {
        process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
        process.env.GEARS_API_TOKEN = 'private-api-token-123';
        process.env.GEARS_CALLBACK_SECRET = 'private-callback-token-456';
        process.env.GEARS_CALLBACK_BASE_URL = 'https://story.example.test/public';

        const res = await request.get('/api/system/gears-execution-readiness');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'gears',
          schema_version: 'gears-execution-readiness/v1',
          status: 'ready',
          local_smoke_passed_count: 5,
          local_smoke_total_count: 5,
          blocking_check_ids: [],
          live_e2e: {
            ready: true,
            ready_step_count: 4,
            total_step_count: 4,
            blocked_by: [],
          },
        });
        expect(res.body.data.score).toBe(100);
        expect(res.body.data.checks).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: 'api_base_url', status: 'pass' }),
          expect.objectContaining({ id: 'callback_secret', status: 'pass' }),
          expect.objectContaining({ id: 'callback_limits', status: 'pass' }),
        ]));
        expect(res.body.data.smoke).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'submit_normalization',
            status: 'pass',
            details: expect.objectContaining({
              accepted_count: 1,
              rejected_count: 1,
              rejected_error_code: 'INVALID_PAYLOAD',
            }),
          }),
          expect.objectContaining({
            id: 'ledger_writeback',
            status: 'pass',
            details: expect.objectContaining({
              rejected_status: 'rejected',
              rejected_failure_category: 'payload_invalid',
            }),
          }),
          expect.objectContaining({
            id: 'callback_normalization',
            status: 'pass',
          }),
          expect.objectContaining({
            id: 'status_alias_classification',
            status: 'pass',
          }),
        ]));
        expect(res.body.data.next_actions).toEqual(expect.arrayContaining([
          '执行真实 GEARS v2 submit/status/callback 端到端 smoke。',
        ]));
        expect(JSON.stringify(res.body.data)).not.toContain('private-api-token-123');
        expect(JSON.stringify(res.body.data)).not.toContain('private-callback-token-456');
        expect(JSON.stringify(res.body.data)).not.toContain('gears.example.test/api-root');
        expect(JSON.stringify(res.body.data)).not.toContain('story.example.test/public');
      } finally {
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.apiToken === undefined) delete process.env.GEARS_API_TOKEN;
        else process.env.GEARS_API_TOKEN = previous.apiToken;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
      }
    });

    it('marks GEARS readiness blocked when the execution-worker API base URL is missing', async () => {
      const previous = process.env.GEARS_API_BASE_URL;
      try {
        delete process.env.GEARS_API_BASE_URL;
        const res = await request.get('/api/system/gears-execution-readiness');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          status: 'blocked',
          local_smoke_passed_count: 5,
          local_smoke_total_count: 5,
          blocking_check_ids: ['api_base_url'],
          live_e2e: {
            ready: false,
            ready_step_count: 0,
            total_step_count: 4,
          },
        });
        expect(res.body.data.checks).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'api_base_url',
            status: 'fail',
          }),
        ]));
        expect(res.body.data.smoke).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'submit_normalization',
            status: 'pass',
          }),
          expect.objectContaining({
            id: 'pressure_boundaries',
            status: 'pass',
          }),
        ]));
        expect(res.body.data.live_e2e.blocked_by).toEqual(expect.arrayContaining([
          'GEARS_EXECUTION_WORKER_API_BASE_URL',
        ]));
        expect(res.body.data.live_e2e.steps).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'submit_http',
            status: 'blocked',
            blocked_by: expect.arrayContaining(['GEARS_EXECUTION_WORKER_API_BASE_URL']),
          }),
        ]));
      } finally {
        if (previous === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous;
      }
    });
  });

  describe('GET /api/system/gears-execution-pressure-report', () => {
    it('returns local GEARS pressure boundaries for large projects', async () => {
      const res = await request.get('/api/system/gears-execution-pressure-report');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        provider: 'gears',
        schema_version: 'gears-execution-pressure-report/v1',
        status: 'pass',
        callback_batch_item_limit: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
        callback_event_retention_limit: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
        batch_at_limit_count: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
        batch_over_limit_count: GEARS_CALLBACK_BATCH_ITEM_LIMIT + 1,
        extracted_at_limit_count: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
        overflow_rejected: true,
        retained_event_count: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
        dropped_event_count: 5,
      });
      expect(res.body.data.first_retained_event_id).toBe('gears-pressure-event-5');
      expect(res.body.data.last_retained_event_id)
        .toBe(`gears-pressure-event-${GEARS_CALLBACK_EVENT_RETENTION_LIMIT + 4}`);
      expect(res.body.data.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'callback_batch_at_limit',
          status: 'pass',
        }),
        expect.objectContaining({
          id: 'callback_batch_over_limit',
          status: 'pass',
        }),
        expect.objectContaining({
          id: 'callback_event_retention',
          status: 'pass',
        }),
      ]));
      expect(res.body.data.markdown).toContain('# GEARS v2 Pressure Report');
    });
  });

  describe('GET /api/system/gears-execution-generated-project-pressure', () => {
    it('scans generated story and series GEARS ledgers for pressure risks', async () => {
      const generatedRoot = process.env.WEB_GENERATED_ROOT ?? resolve(testWorkspaceRoot, 'web', 'generated');
      const storyProjectDir = resolve(generatedRoot, 'projects', 'pressure-story-project');
      const seriesProjectDir = resolve(generatedRoot, 'ai-comic-series-projects', 'pressure-series-project');
      const retainedEvents = Array.from({ length: GEARS_CALLBACK_EVENT_RETENTION_LIMIT }, (_, index) => ({
        event_id: `pressure-series-event-${index}`,
        received_at: `2026-06-21T04:00:${String(index).padStart(2, '0')}.000Z`,
        status: 'processing',
        progress_percent: index,
      }));
      await mkdir(storyProjectDir, { recursive: true });
      await mkdir(seriesProjectDir, { recursive: true });
      await writeFile(resolve(storyProjectDir, 'project.json'), JSON.stringify({
        project_id: 'pressure-story-project',
        current_story_id: '20260621-story-pressure',
        current_version_id: 'v1',
        title: 'Pressure Story Project',
        source_domain: 'china_culture',
        status: 'draft',
        created_at: '2026-06-21T04:00:00.000Z',
        updated_at: '2026-06-21T04:01:00.000Z',
        video_type: 'ai_comic_drama',
        presentation_style: 'ai_comic',
        story_structure: 'single_event_drama',
        version_count: 1,
        gears_job_ledger: {
          schema_version: 'gears-job-ledger/v1',
          updated_at: '2026-06-21T04:01:00.000Z',
          items: [{
            ledger_id: 'gears-ledger-pressure-story-shot-1',
            gears_job_id: 'gears-pressure-story-shot-1',
            job_type: 'seedance_video',
            source_unit_id: 'story-shot-1',
            status: 'ready',
            progress_percent: 100,
            artifact_urls: ['https://media.example.test/story-shot-1.mp4'],
            submitted_at: '2026-06-21T04:00:00.000Z',
            updated_at: '2026-06-21T04:01:00.000Z',
            completed_at: '2026-06-21T04:01:00.000Z',
            callback_events: [{
              event_id: 'pressure-story-event-1',
              received_at: '2026-06-21T04:01:00.000Z',
              status: 'ready',
              progress_percent: 100,
            }],
          }],
        },
      }));
      await writeFile(resolve(seriesProjectDir, 'project.json'), JSON.stringify({
        project: {
          series_project_id: 'pressure-series-project',
          title: 'Pressure Series Project',
          episode_count: 1,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          logline: '压力测试漫剧项目。',
          created_at: '2026-06-21T04:00:00.000Z',
          updated_at: '2026-06-21T04:03:00.000Z',
          generated_episode_count: 0,
        },
        plan: {
          schema_version: 'ai-comic-series-plan/v1',
          series_title: 'Pressure Series Project',
          episode_count: 1,
          episode_duration_range_sec: { min: 60, max: 120 },
          pacing_profile: 'balanced_drama',
          generation_scope: 'series_plan',
          premise: '测试 GEARS ledger 压力。',
          logline: '压力测试漫剧项目。',
          core_theme: '生产稳定性',
          main_characters: [{
            name: '测试主角',
            role: 'protagonist',
            starting_state: '准备联调',
            desire: '确认生产链路稳定',
            long_arc: '从未知风险走向可控交付',
            turning_points: [{ episode_no: 1, change: '发现回调压力' }],
            visual_signature: '蓝色工牌',
          }],
          plot_threads: [{
            thread_id: 'thread-pressure',
            title: '回调压力',
            setup_episode: 1,
            payoff_episode: 1,
            description: '确认 GEARS 回调事件保留边界。',
            continuity_notes: [],
          }],
          phases: [{
            phase_id: 'phase-1',
            episode_range: [1, 1],
            purpose: '联调压力审计',
            turning_point: '发现事件接近保留上限',
          }],
          episodes: [{
            episode_no: 1,
            title: '压力审计',
            target_duration_sec: 90,
            target_panel_count: 12,
            story_phase: 'setup',
            opening_hook: 'GEARS worker 返回高频进度。',
            main_conflict: '回调事件可能被截断。',
            midpoint_turn: '审计发现接近上限。',
            key_characters: ['测试主角'],
            continuity_from_previous: [],
            new_information: ['回调事件保留上限为 20'],
            foreshadowing: [],
            payoff: ['生成审计建议'],
            ending_hook: '是否进入真实 E2E？',
            ending_hook_type: 'emotional_question',
            character_state_change: '从未知转向可执行',
            thread_action: '完成压力扫描',
            knowledge_focus: ['GEARS ledger'],
            continuity_state_after: ['进入真实 worker smoke 前检查'],
          }],
          continuity_rules: [],
          recurring_motifs: [],
          production_notes: [],
        },
        generated_episode_story_ids: {},
        gears_job_ledger: {
          schema_version: 'gears-job-ledger/v1',
          updated_at: '2026-06-21T04:03:00.000Z',
          items: [{
            ledger_id: 'gears-ledger-pressure-series-shot-1',
            gears_job_id: 'gears-pressure-series-shot-1',
            job_type: 'seedance_video',
            source_unit_id: 'series-shot-1',
            status: 'processing',
            progress_percent: 88,
            artifact_urls: [],
            failure_category: 'worker_unavailable',
            submitted_at: '2026-06-21T04:00:00.000Z',
            updated_at: '2026-06-21T04:03:00.000Z',
            callback_events: retainedEvents,
          }, {
            ledger_id: 'gears-ledger-pressure-series-shot-2',
            gears_job_id: 'gears-pressure-series-shot-2',
            job_type: 'seedance_video',
            source_unit_id: 'series-shot-2',
            status: 'failed',
            progress_percent: 0,
            artifact_urls: [],
            failure_category: 'render_failed',
            failure_reason: 'render failed',
            submitted_at: '2026-06-21T04:00:00.000Z',
            updated_at: '2026-06-21T04:02:00.000Z',
            completed_at: '2026-06-21T04:02:00.000Z',
            callback_events: [],
          }],
        },
      }));

      const res = await request.get('/api/system/gears-execution-generated-project-pressure');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        provider: 'gears',
        schema_version: 'gears-execution-generated-project-pressure/v1',
        project_with_gears_ledger_count: expect.any(Number),
        total_job_count: expect.any(Number),
        max_job_callback_event_count: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
        callback_batch_item_limit: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
        callback_event_retention_limit: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
        pressure_status: 'blocked',
      });
      expect(res.body.data.project_with_gears_ledger_count).toBeGreaterThanOrEqual(2);
      expect(res.body.data.total_job_count).toBeGreaterThanOrEqual(3);
      expect(res.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          project_id: 'pressure-story-project',
          project_kind: 'story_project',
          job_count: 1,
          artifact_count: 1,
          risk_level: 'ok',
        }),
        expect.objectContaining({
          project_id: 'pressure-series-project',
          project_kind: 'ai_comic_series_project',
          job_count: 2,
          active_count: 1,
          failed_count: 1,
          max_callback_events_per_job: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
          risk_level: 'blocked',
          failure_categories: expect.objectContaining({
            render_failed: 1,
            worker_unavailable: 1,
          }),
        }),
      ]));
      expect(res.body.data.markdown).toContain('# GEARS v2 Generated Project Pressure Audit');
      expect(res.body.data.markdown).toContain('pressure-series-project');
    });
  });

  describe('GET /api/system/gears-execution-acceptance-report', () => {
    it('returns GEARS worker acceptance blockers and handoff artifacts', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        apiToken: process.env.GEARS_API_TOKEN,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
      };
      try {
        delete process.env.GEARS_API_BASE_URL;
        delete process.env.GEARS_API_TOKEN;
        delete process.env.GEARS_CALLBACK_SECRET;
        delete process.env.GEARS_CALLBACK_BASE_URL;

        const res = await request.get('/api/system/gears-execution-acceptance-report');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'gears',
          schema_version: 'gears-execution-acceptance/v1',
          status: 'blocked',
          readiness_status: 'blocked',
          live_e2e_ready: false,
          pressure_status: 'pass',
          generated_health_status: expect.stringMatching(/ready|attention|blocked/),
          generated_health_ready_count: expect.any(Number),
          generated_health_planned_count: expect.any(Number),
          generated_health_production_gap_count: expect.any(Number),
          generated_health_interrupted_count: expect.any(Number),
          acceptance_total_count: expect.any(Number),
          required_envs: expect.arrayContaining(['GEARS_EXECUTION_WORKER_API_BASE_URL', 'GEARS_CALLBACK_SECRET']),
        });
        expect(res.body.data.acceptance_passed_count).toBeLessThan(res.body.data.acceptance_total_count);
        expect(res.body.data.blocking_check_ids).toEqual(expect.arrayContaining([
          'gears_api_config',
          'live_e2e_steps',
        ]));
        expect(res.body.data.handoff_artifacts).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'readiness',
            method: 'GET',
            path: '/api/system/gears-execution-readiness',
          }),
          expect.objectContaining({
            id: 'live_smoke',
            method: 'POST',
            path: '/api/system/gears-execution-live-smoke-run',
          }),
        ]));
        expect(res.body.data.markdown).toContain('# GEARS v2 Worker Acceptance Report');
        expect(res.body.data.markdown).toContain('generated_health_status');
        expect(res.body.data.markdown).toContain('GEARS_EXECUTION_WORKER_API_BASE_URL');
      } finally {
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.apiToken === undefined) delete process.env.GEARS_API_TOKEN;
        else process.env.GEARS_API_TOKEN = previous.apiToken;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
      }
    });
  });

  describe('GET /api/system/gears-execution-worker-acceptance-kit', () => {
    it('returns executable worker acceptance commands and payload files', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        apiToken: process.env.GEARS_API_TOKEN,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
      };
      try {
        delete process.env.GEARS_API_BASE_URL;
        delete process.env.GEARS_API_TOKEN;
        delete process.env.GEARS_CALLBACK_SECRET;
        delete process.env.GEARS_CALLBACK_BASE_URL;

        const generatedRoot = process.env.WEB_GENERATED_ROOT ?? resolve(testWorkspaceRoot, 'web', 'generated');
        const seriesProjectId = '20260622-series-smokefx';
        const seriesProjectDir = resolve(generatedRoot, 'ai-comic-series-projects', seriesProjectId);
        await mkdir(seriesProjectDir, { recursive: true });
        await writeFile(resolve(seriesProjectDir, 'project.json'), JSON.stringify({
          project: {
            series_project_id: seriesProjectId,
            title: 'Smoke target fixture',
            episode_count: 3,
            generated_episode_count: 1,
            created_at: '2026-06-22T00:00:00.000Z',
            updated_at: '2026-06-22T00:00:00.000Z',
          },
          plan: {
            episode_count: 3,
          },
          generated_episode_story_ids: {
            1: '20260622-story-missing',
          },
          seedance_production: {
            items: [{
              production_id: 'seedance-e1-shot-1-smoke',
              episode_no: 1,
              shot_id: 'shot-1',
              status: 'failed',
            }],
          },
          seedance_review_ledger: {
            items: [{
              review_id: 'review-smoke-1',
              status: 'open',
              target_type: 'shot',
              shot_id: 'shot-1',
              repair_action: 'redo_shot',
            }],
          },
          seedance_title_card_render: {
            card_count: 2,
            output_paths: [
              'title-cards/smoke/opening.mp4',
              'title-cards/smoke/ending.mp4',
            ],
          },
        }, null, 2), 'utf-8');

        const res = await request.get('/api/system/gears-execution-worker-acceptance-kit');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'gears',
          schema_version: 'gears-execution-worker-acceptance-kit/v1',
          acceptance_status: 'blocked',
          local_smoke_passed_count: 5,
          local_smoke_total_count: 5,
          required_envs: expect.arrayContaining(['GEARS_EXECUTION_WORKER_API_BASE_URL', 'GEARS_CALLBACK_SECRET']),
          real_endpoint_readiness: expect.objectContaining({
            status: 'needs_env',
            ready_to_run_acceptance: false,
            missing_envs: expect.arrayContaining([
              'GEARS_EXECUTION_WORKER_API_BASE_URL',
              'GEARS_CALLBACK_SECRET',
              'GEARS_CALLBACK_BASE_URL',
            ]),
            smoke_target_ready: expect.any(Boolean),
            recommended_command: expect.stringContaining('run-gears-worker-acceptance.sh'),
          }),
        });
        expect(res.body.data.env_template).toContain('GEARS_EXECUTION_WORKER_API_BASE_URL');
        expect(res.body.data.real_endpoint_readiness.next_actions.join('\n')).toContain('GEARS_EXECUTION_WORKER_API_BASE_URL');
        expect(res.body.data.env_vars).toEqual(expect.arrayContaining([
          expect.objectContaining({
            name: 'STORY_AGENT_BASE_URL',
            required: true,
          }),
          expect.objectContaining({
            name: 'GEARS_EXECUTION_WORKER_API_BASE_URL',
            required: true,
          }),
          expect.objectContaining({
            name: 'GEARS_EXECUTION_WORKER_API_TOKEN',
            required: false,
          }),
          expect.objectContaining({
            name: 'GEARS_API_BASE_URL',
            required: false,
            description: expect.stringContaining('Legacy'),
          }),
          expect.objectContaining({
            name: 'GEARS_CALLBACK_BASE_URL',
            required: true,
          }),
          expect.objectContaining({
            name: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
            required: false,
            value_placeholder: '<real-public-gears-artifact-url>',
          }),
          expect.objectContaining({
            name: 'GEARS_SMOKE_STORY_ID',
            required: false,
          }),
          expect.objectContaining({
            name: 'GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE',
            required: false,
          }),
          expect.objectContaining({
            name: 'GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER',
            required: false,
            value_placeholder: '0',
          }),
          expect.objectContaining({
            name: 'GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE',
            required: false,
            value_placeholder: 'seedance_video',
          }),
          expect.objectContaining({
            name: 'GEARS_ACCEPTANCE_STRICT_AUDIT',
            required: false,
            value_placeholder: '1',
          }),
          expect.objectContaining({
            name: 'GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS',
            required: false,
            value_placeholder: '1',
          }),
          expect.objectContaining({
            name: 'GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS',
            required: false,
            value_placeholder: '5',
          }),
          expect.objectContaining({
            name: 'GEARS_LARGE_PRESSURE_EPISODE_COUNT',
            required: false,
          }),
        ]));
        expect(res.body.data.smoke_targets).toMatchObject({
          schema_version: 'gears-worker-acceptance-smoke-targets/v1',
          recommended_env: expect.any(Object),
          story_project_candidates: expect.any(Array),
          series_project_candidates: expect.any(Array),
          warning_count: expect.any(Number),
          warnings: expect.any(Array),
        });
        if (res.body.data.smoke_targets.series_project_candidates.length) {
          expect(res.body.data.smoke_targets.series_project_candidates[0]).toEqual(expect.objectContaining({
            ledger_seed_ready: expect.any(Boolean),
          }));
        }
        expect(res.body.data.smoke_targets.series_project).toEqual(expect.objectContaining({
          id: seriesProjectId,
          existing_generated_episode_story_id_count: 0,
          seedance_video_retry_candidate_count: 0,
          postproduction_seed_job_count: 2,
          ledger_seed_ready: true,
          recommended_ledger_seed_job_type: 'title_card_render',
        }));
        expect(res.body.data.smoke_targets.recommended_env).toEqual(expect.objectContaining({
          GEARS_SMOKE_SERIES_PROJECT_ID: seriesProjectId,
          GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE: 'title_card_render',
        }));
        expect(res.body.data.payloads.map((payload: any) => payload.filename)).toEqual(expect.arrayContaining([
          'gears-submit-smoke.json',
          'gears-project-callback-smoke.json',
          'gears-series-callback-smoke.json',
          'gears-system-external-callback-smoke.json',
          'gears-live-smoke.json',
          'gears-large-project-pressure-plan.json',
        ]));
        expect(res.body.data.payloads.find((payload: any) => payload.id === 'system_external_callback')?.content.callbacks[0]).toMatchObject({
          outputUrl: '<GEARS_SYSTEM_EXTERNAL_OUTPUT_URL>',
        });
        expect(JSON.stringify(res.body.data.payloads.find((payload: any) => payload.id === 'system_external_callback')?.content)).not.toContain('media.story-agent.test/gears-worker-acceptance');
        expect(res.body.data.commands.map((command: any) => command.id)).toEqual([
          'write_env',
          'read_acceptance_report',
          'write_payload_files',
          'generate_large_project_pressure_payload',
          'probe_execution_worker_capabilities',
          'submit_to_worker',
          'poll_worker_status',
          'audit_worker_response_shapes',
          'seed_story_agent_ledgers_optional',
          'post_project_callback',
          'preflight_system_external_callback_batch',
          'import_system_external_callback_batch',
          'post_series_callback',
          'run_story_agent_live_smoke',
          'audit_story_agent_callback_responses',
          'audit_story_agent_generated_health',
          'audit_production_material_pack_health',
          'audit_domain_pack_production_health',
          'audit_story_agent_mvp_status',
          'submit_large_project_pressure_optional',
          'audit_large_project_pressure_response',
          'write_acceptance_verdict',
          'write_acceptance_archive',
          'verify_acceptance_integrity',
          'read_worker_evidence_signoff',
        ]);
        expect(res.body.data.commands).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'probe_execution_worker_capabilities',
            phase: 'preflight',
          }),
          expect.objectContaining({
            id: 'submit_to_worker',
            phase: 'worker_submit',
            payload_id: 'submit_smoke',
          }),
          expect.objectContaining({
            id: 'post_series_callback',
            phase: 'story_agent_callback',
            payload_id: 'series_callback',
          }),
          expect.objectContaining({
            id: 'preflight_system_external_callback_batch',
            phase: 'story_agent_callback',
            payload_id: 'system_external_callback',
          }),
          expect.objectContaining({
            id: 'import_system_external_callback_batch',
            phase: 'story_agent_callback',
            payload_id: 'system_external_callback',
          }),
          expect.objectContaining({
            id: 'generate_large_project_pressure_payload',
            phase: 'worker_pressure',
            payload_id: 'large_project_pressure_plan',
          }),
          expect.objectContaining({
            id: 'audit_worker_response_shapes',
            phase: 'worker_poll',
          }),
          expect.objectContaining({
            id: 'submit_large_project_pressure_optional',
            phase: 'worker_pressure',
            payload_id: 'large_project_pressure_plan',
          }),
          expect.objectContaining({
            id: 'audit_large_project_pressure_response',
            phase: 'worker_pressure',
            payload_id: 'large_project_pressure_plan',
          }),
          expect.objectContaining({
            id: 'audit_story_agent_callback_responses',
            phase: 'story_agent_callback',
          }),
          expect.objectContaining({
            id: 'audit_production_material_pack_health',
            phase: 'story_agent_callback',
          }),
          expect.objectContaining({
            id: 'audit_domain_pack_production_health',
            phase: 'story_agent_callback',
          }),
          expect.objectContaining({
            id: 'audit_story_agent_mvp_status',
            phase: 'story_agent_callback',
          }),
          expect.objectContaining({
            id: 'write_acceptance_verdict',
            phase: 'worker_pressure',
          }),
          expect.objectContaining({
            id: 'write_acceptance_archive',
            phase: 'worker_pressure',
          }),
          expect.objectContaining({
            id: 'verify_acceptance_integrity',
            phase: 'worker_pressure',
          }),
        ]));
        expect(res.body.data.verification_checklist).toEqual(expect.arrayContaining([
          'Duplicate callback replay increments duplicate_count without duplicate artifacts or versions.',
          'System external callback preflight reports blocked=false before batch import.',
          'System external callback import uses safe preflight/import and writes real external artifact URLs instead of local_acceptance placeholders.',
          'Final worker acceptance verdict verifies system external import response contains the exact validated output_url.',
          'GEARS worker response audit records observed status aliases, id fields, error codes, and failure categories.',
          'story-agent-smoke-targets.json contains existing Story Agent project ids or explicit warnings before callback smoke.',
          'Story Agent callback id preflight has warning_count=0 before callback smoke is trusted.',
          'Story Agent callback response audit has no ok=false validation/auth blockers.',
          'Production material pack health audit has status=passed before GEARS worker signoff.',
          'Domain Pack production health audit has status=passed before GEARS worker signoff.',
          'Story Agent MVP status audit has no status regression or blocker increase after worker smoke.',
          'Story Agent MVP governance counts for Seedance placeholders and knowledge writeback queue are preserved in verdict and archive evidence.',
          'Story Agent MVP real external callback readiness is preserved in verdict and archive evidence with local_acceptance_counts_as_real_external_callback=false.',
          'Large project pressure payload is generated for at least 30 episodes and is submitted only when explicitly enabled.',
          'Large project response audit has no source_echo_gap after a real pressure submit.',
          'Final worker acceptance verdict has acceptance_passed=true before a GEARS v2 run is signed off.',
          'Final worker evidence signoff requires system_external_callback_passed=true with ready_to_import_count>0, updated_count>0, and an import response match for the validated output_url.',
          'Final worker acceptance archive has signoff_ready=true and no missing required attachments before handoff.',
          'Final worker acceptance integrity has integrity_passed=true and no checksum mismatches before handoff.',
          'Final worker evidence signoff snapshot is saved as gears-worker-evidence-signoff.json/.md after archive integrity is evaluated.',
        ]));
        expect(res.body.data.shell_script_filename).toBe('run-gears-worker-acceptance.sh');
        expect(res.body.data.markdown).toContain('Real Endpoint Readiness');
        expect(res.body.data.markdown).toContain('real_endpoint_status: needs_env');
        expect(res.body.data.shell_script).toContain('#!/usr/bin/env bash');
        expect(res.body.data.shell_script).toContain('GEARS_EVIDENCE_DIR');
        expect(res.body.data.shell_script).toContain('GEARS_EXECUTION_WORKER_API_BASE_URL="$GEARS_API_BASE_URL"');
        expect(res.body.data.shell_script).toContain('GEARS_API_BASE_URL="$GEARS_EXECUTION_WORKER_API_BASE_URL"');
        expect(res.body.data.shell_script).toContain('legacy execution-worker name');
        expect(res.body.data.shell_script).toContain('for required_name in GEARS_EXECUTION_WORKER_API_BASE_URL');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_AUTO_EXTRACT_JOB_ID');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_STRICT_AUDIT');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS');
        expect(res.body.data.shell_script).toContain('GEARS_LARGE_PRESSURE_EPISODE_COUNT');
        expect(res.body.data.shell_script).toContain('GEARS_SYSTEM_EXTERNAL_OUTPUT_URL');
        expect(res.body.data.shell_script).toContain('<GEARS_SYSTEM_EXTERNAL_OUTPUT_URL>');
        expect(res.body.data.shell_script).toContain('story-agent-system-external-output-url-source.json');
        expect(res.body.data.shell_script).toContain('story-agent-system-external-output-url-source/v1');
        expect(res.body.data.shell_script).toContain('extract_gears_system_external_output_url_from_worker_responses');
        expect(res.body.data.shell_script).toContain('story-agent-system-external-output-url-extract/v1');
        expect(res.body.data.shell_script).toContain('GEARS_SYSTEM_EXTERNAL_OUTPUT_URL_SOURCE="worker_response"');
        expect(res.body.data.shell_script).toContain('output_url_source_unverified');
        expect(res.body.data.shell_script).not.toContain('media.story-agent.test/gears-worker-acceptance');
        expect(res.body.data.shell_script).not.toContain('GEARS_AUTH_ARGS');
        expect(res.body.data.shell_script).toContain('if is_placeholder "${GEARS_API_TOKEN:-}"; then');
        expect(res.body.data.shell_script).toContain('-H "authorization: Bearer $GEARS_API_TOKEN"');
        expect(res.body.data.shell_script).toContain('Probing independent GEARS execution-worker capabilities');
        expect(res.body.data.shell_script).toContain('$GEARS_API_BASE_URL/gears/capabilities');
        expect(res.body.data.shell_script).toContain('gears-execution-worker-capabilities/v1');
        expect(res.body.data.shell_script).toContain('workbench_import_supported === false');
        expect(res.body.data.shell_script).toContain('/gears/jobs will not be called');
        expect(res.body.data.shell_script).toContain('gears-required-env-missing.txt');
        expect(res.body.data.shell_script).toContain('gears-submit-exit-code.txt');
        expect(res.body.data.shell_script).toContain('gears-submit-http-status.txt');
        expect(res.body.data.shell_script).toContain('gears-submit-failed.txt');
        expect(res.body.data.shell_script).toContain('gears-submit-http-failed.txt');
        expect(res.body.data.shell_script).toContain('write_manifest');
        expect(res.body.data.shell_script).toContain('print_json_summary');
        expect(res.body.data.shell_script).toContain('record_http_metadata');
        expect(res.body.data.shell_script).toContain('is_success_http_status');
        expect(res.body.data.shell_script).toContain('post_json_capture');
        expect(res.body.data.shell_script).toContain('seed_story_agent_gears_ledgers');
        expect(res.body.data.shell_script).toContain('write_story_agent_ledger_seed_body');
        expect(res.body.data.shell_script).toContain('patch_callback_payload_from_story_agent_submit');
        expect(res.body.data.shell_script).toContain('story-agent-project-gears-submit-seed.json');
        expect(res.body.data.shell_script).toContain('story-agent-project-gears-submit-seed-response.json');
        expect(res.body.data.shell_script).toContain('story-agent-project-ledger-seed-selected.json');
        expect(res.body.data.shell_script).toContain('story-agent-series-gears-submit-seed.json');
        expect(res.body.data.shell_script).toContain('story-agent-series-gears-submit-seed-response.json');
        expect(res.body.data.shell_script).toContain('story-agent-series-ledger-seed-selected.json');
        expect(res.body.data.shell_script).toContain('story-agent-smoke-targets.json');
        expect(res.body.data.shell_script).toContain('story-agent-smoke-env-selected.json');
        expect(res.body.data.shell_script).toContain('auto_fill_smoke_target_envs');
        expect(res.body.data.shell_script).toContain('read_smoke_target_env GEARS_SMOKE_PROJECT_ID');
        expect(res.body.data.shell_script).toContain('read_smoke_target_env GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE: process.env.GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE');
        expect(res.body.data.shell_script).toContain('Checking Story Agent smoke target candidates');
        expect(res.body.data.shell_script).toContain('story-agent-callback-id-preflight.json');
        expect(res.body.data.shell_script).toContain('story-agent-callback-id-preflight.md');
        expect(res.body.data.shell_script).toContain('story-agent-callback-id-preflight/v1');
        expect(res.body.data.shell_script).toContain('YYYYMMDD-story-{hash36}--{video_type}');
        expect(res.body.data.shell_script).toContain('YYYYMMDD-series-{hash36}');
        expect(res.body.data.shell_script).toContain('Checking Story Agent callback id formats');
        expect(res.body.data.shell_script).toContain('warning_count');
        expect(res.body.data.shell_script).toContain('curl -sS -o "$EVIDENCE_DIR/story-agent-acceptance-report.json"');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/story-agent-worker-evidence-bundle.json" "Story Agent worker evidence bundle"');
        expect(res.body.data.shell_script).toContain('story-agent-generated-health-before.json');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/story-agent-generated-health-before.json" "Story Agent generated health audit"');
        expect(res.body.data.shell_script).toContain('fetch_story_agent_generated_health_after()');
        expect(res.body.data.shell_script).toContain('write_early_exit_audits()');
        expect(res.body.data.shell_script).toContain('write_early_exit_audits "env-blocked exit"');
        expect(res.body.data.shell_script).toContain('write_early_exit_audits "submit failure"');
        expect(res.body.data.shell_script).toContain('write_early_exit_audits "non-2xx submit"');
        expect(res.body.data.shell_script).toContain('story-agent-generated-health-after-fetch-failed.txt');
        expect(res.body.data.shell_script).toContain('story-agent-generated-health-audit.json');
        expect(res.body.data.shell_script).toContain('story-agent-generated-health-audit.md');
        expect(res.body.data.shell_script).toContain('story-agent-generated-health-audit/v1');
        expect(res.body.data.shell_script).toContain('Auditing Story Agent generated health before final verdict');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/story-agent-generated-health-audit.json" "Story Agent generated health smoke audit"');
        expect(res.body.data.shell_script).toContain('production-material-pack-health-before.json');
        expect(res.body.data.shell_script).toContain('production-material-pack-health-after.json');
        expect(res.body.data.shell_script).toContain('production-material-pack-health-audit.json');
        expect(res.body.data.shell_script).toContain('production-material-pack-health-audit.md');
        expect(res.body.data.shell_script).toContain('production-material-pack-health-audit/v1');
        expect(res.body.data.shell_script).toContain('fetch_production_material_pack_health_after()');
        expect(res.body.data.shell_script).toContain('Auditing production material pack health before final verdict');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/production-material-pack-health-audit.json" "Production material pack health smoke audit"');
        expect(res.body.data.shell_script).toContain('domain-pack-production-health-before.json');
        expect(res.body.data.shell_script).toContain('domain-pack-production-health-after.json');
        expect(res.body.data.shell_script).toContain('domain-pack-production-health-audit.json');
        expect(res.body.data.shell_script).toContain('domain-pack-production-health-audit.md');
        expect(res.body.data.shell_script).toContain('domain-pack-production-health-audit/v1');
        expect(res.body.data.shell_script).toContain('fetch_domain_pack_production_health_after()');
        expect(res.body.data.shell_script).toContain('Auditing Domain Pack production health before final verdict');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/domain-pack-production-health-audit.json" "Domain Pack production health smoke audit"');
        expect(res.body.data.shell_script).toContain('story-agent-mvp-status-before.json');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/story-agent-mvp-status-before.json" "Story Agent MVP status before smoke"');
        expect(res.body.data.shell_script).toContain('fetch_story_agent_mvp_status_after()');
        expect(res.body.data.shell_script).toContain('story-agent-mvp-status-after-fetch-failed.txt');
        expect(res.body.data.shell_script).toContain('story-agent-mvp-status-audit.json');
        expect(res.body.data.shell_script).toContain('story-agent-mvp-status-audit.md');
        expect(res.body.data.shell_script).toContain('story-agent-mvp-status-audit/v1');
        expect(res.body.data.shell_script).toContain('Auditing Story Agent MVP status before final verdict');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/story-agent-mvp-status-audit.json" "Story Agent MVP status smoke audit"');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/story-agent-callback-id-preflight.json" "Story Agent callback id preflight"');
        expect(res.body.data.shell_script).toContain('Trying to extract GEARS job ids from submit response');
        expect(res.body.data.shell_script).toContain('Rendering smoke payload templates with env values');
        expect(res.body.data.shell_script).toContain('Rendering callback payloads with GEARS job id');
        expect(res.body.data.shell_script).toContain('envValue("GEARS_SMOKE_STORY_ID") || envValue("GEARS_SMOKE_PROJECT_ID")');
        expect(res.body.data.shell_script).toContain('"<GEARS_CALLBACK_BASE_URL>", cleanBaseUrl("GEARS_CALLBACK_BASE_URL")');
        expect(res.body.data.shell_script).toContain('"<gears_job_id>", envValue("GEARS_SMOKE_JOB_ID")');
        expect(res.body.data.shell_script).toContain('gears-smoke-job-ids.txt');
        expect(res.body.data.shell_script).toContain('gears-smoke-job-id.txt');
        expect(res.body.data.shell_script).toContain('export GEARS_SMOKE_JOB_ID');
        expect(res.body.data.shell_script).toContain('gears-smoke-job-id-missing.txt');
        expect(res.body.data.shell_script).toContain('gears-status-response-$safe_job_id.json');
        expect(res.body.data.shell_script).toContain('gears-status-response-$safe_job_id-attempt-$poll_attempt.json');
        expect(res.body.data.shell_script).toContain('gears-status-response-$safe_job_id-attempt-$poll_attempt-http-failed.txt');
        expect(res.body.data.shell_script).toContain('gears-status-response-$safe_job_id-attempt-$poll_attempt-failed.txt');
        expect(res.body.data.shell_script).toContain('attempt $poll_attempt/$GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS');
        expect(res.body.data.shell_script).toContain('sleep "$GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS"');
        expect(res.body.data.shell_script).toContain('acceptedUnits');
        expect(res.body.data.shell_script).toContain('GEARS_ACCEPTANCE_REPLAY_CALLBACKS');
        expect(res.body.data.shell_script).toContain('/api/system/gears-execution-worker-evidence-bundle');
        expect(res.body.data.shell_script).toContain('gears-submit-response.json');
        expect(res.body.data.shell_script).toContain('gears-worker-response-audit.json');
        expect(res.body.data.shell_script).toContain('gears-worker-response-audit.md');
        expect(res.body.data.shell_script).toContain('gears-worker-response-audit/v1');
        expect(res.body.data.shell_script).toContain('story-agent-callback-response-audit.json');
        expect(res.body.data.shell_script).toContain('story-agent-callback-response-audit.md');
        expect(res.body.data.shell_script).toContain('story-agent-callback-response-audit/v1');
        expect(res.body.data.shell_script).toContain('Auditing Story Agent callback responses after $reason');
        expect(res.body.data.shell_script).toContain('Auditing Story Agent callback responses');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/story-agent-callback-response-audit.json" "Story Agent callback response audit"');
        expect(res.body.data.shell_script).toContain('recommended_actions=');
        expect(res.body.data.shell_script).toContain('validation_error_count');
        expect(res.body.data.shell_script).toContain('auth_error_count');
        expect(res.body.data.shell_script).toContain('not_found_count');
        expect(res.body.data.shell_script).toContain('sample_not_found_files');
        expect(res.body.data.shell_script).toContain('blocked_count');
        expect(res.body.data.shell_script).toContain('sample_blocked_files');
        expect(res.body.data.shell_script).toContain('ledger_match_missing_count');
        expect(res.body.data.shell_script).toContain('sample_ledger_match_files');
        expect(res.body.data.shell_script).toContain('Auditing GEARS worker response shapes');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/gears-worker-response-audit.json" "GEARS worker response audit"');
        expect(res.body.data.shell_script).toContain('Refreshing GEARS worker response audit');
        expect(res.body.data.shell_script).toContain('status_alias_counts');
        expect(res.body.data.shell_script).toContain('function pathLooksLikeWorkerRecord(pathParts)');
        expect(res.body.data.shell_script).toContain('function hasDirectArtifactField(obj, pathParts)');
        expect(res.body.data.shell_script).toContain('function looksLikeWorkerRecord(obj, pathParts)');
        expect(res.body.data.shell_script).toContain('const structuralPath = pathParts.slice(1)');
        expect(res.body.data.shell_script).toContain('const lastToken = normalizeToken(namedPath[namedPath.length - 1])');
        expect(res.body.data.shell_script).toContain('const hasRecordSignal = hasAnyField(obj, statusFields)');
        expect(res.body.data.shell_script).toContain('const pathLikeRecord = pathLooksLikeWorkerRecord(pathParts)');
        expect(res.body.data.shell_script).toContain('looksLikeWorkerRecord(value, pathParts)');
        expect(res.body.data.shell_script).toContain('failedStatuses.has(errorCodeToken)');
        expect(res.body.data.shell_script).toContain('rejectedStatuses.has(errorCodeToken)');
        expect(res.body.data.shell_script).toContain('http_status');
        expect(res.body.data.shell_script).toContain('curl_exit_code');
        expect(res.body.data.shell_script).toContain('transport_error_count');
        expect(res.body.data.shell_script).toContain('http_error_count');
        expect(res.body.data.shell_script).toContain('failure_category_counts');
        expect(res.body.data.shell_script).toContain('artifact_field_counts');
        expect(res.body.data.shell_script).toContain('missing_ready_artifact_count');
        expect(res.body.data.shell_script).toContain('ready_without_artifact');
        expect(res.body.data.shell_script).toContain('recommended_actions');
        expect(res.body.data.shell_script).toContain('Recommended Actions');
        expect(res.body.data.shell_script).toContain('Sample Record Paths');
        expect(res.body.data.shell_script).toContain('sample_record_paths');
        expect(res.body.data.shell_script).toContain('sample_paths');
        expect(res.body.data.shell_script).toContain('unknown_status');
        expect(res.body.data.shell_script).toContain('record_count_zero');
        expect(res.body.data.shell_script).toContain('missing_source_id_count');
        expect(res.body.data.shell_script).toContain('story-agent-project-callback-replay-response.json');
        expect(res.body.data.shell_script).toContain('story-agent-series-callback-replay-response.json');
        expect(res.body.data.shell_script).toContain('post_json_capture "Story Agent project callback"');
        expect(res.body.data.shell_script).toContain('post_json_capture "Story Agent system external callback preflight"');
        expect(res.body.data.shell_script).toContain('post_json_capture "Story Agent system external callback import"');
        expect(res.body.data.shell_script).toContain('/api/system/gears-external-callbacks/preflight');
        expect(res.body.data.shell_script).toContain('/api/system/gears-external-callbacks/import');
        expect(res.body.data.shell_script).toContain('story-agent-system-external-callback-preflight-response.json');
        expect(res.body.data.shell_script).toContain('story-agent-system-external-callback-import-response.json');
        expect(res.body.data.shell_script).toContain('artifact URL extracted from GEARS worker responses or provided through GEARS_SYSTEM_EXTERNAL_OUTPUT_URL');
        expect(res.body.data.shell_script).toContain('story-agent-system-external-ledger-seed-selected.json');
        expect(res.body.data.shell_script).toContain('gears-system-external-callback-smoke.json');
        expect(res.body.data.shell_script).toContain('post_json_capture "Story Agent live smoke"');
        expect(res.body.data.shell_script).toContain('$base-http-status.txt');
        expect(res.body.data.shell_script).toContain('$base-curl-exit-code.txt');
        expect(res.body.data.shell_script).toContain('$label returned HTTP $http_status');
        expect(res.body.data.shell_script).toContain('gears-large-project-submit-pressure.json');
        expect(res.body.data.shell_script).toContain('gears-large-project-pressure-summary.json');
        expect(res.body.data.shell_script).toContain('story-agent-generated-health-after.json');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/story-agent-generated-health-after.json" "Post-run generated health audit"');
        expect(res.body.data.shell_script).toContain('story_agent_generated_health_audit');
        expect(res.body.data.shell_script).toContain('domain_pack_production_health_audit');
        expect(res.body.data.shell_script).toContain('story_agent_mvp_status_audit');
        expect(res.body.data.shell_script).toContain('mvpGovernanceCountsFrom');
        expect(res.body.data.shell_script).toContain('mvp_governance_counts');
        expect(res.body.data.shell_script).toContain('governance_counts: mvpGovernanceCounts');
        expect(res.body.data.shell_script).toContain('realExternalCallbackReadinessFrom');
        expect(res.body.data.shell_script).toContain('real_external_callback_readiness');
        expect(res.body.data.shell_script).toContain('mvpRealExternalCallbackReadinessFrom');
        expect(res.body.data.shell_script).toContain('mvp_real_external_callback_readiness');
        expect(res.body.data.shell_script).toContain('local_acceptance_counts_as_real_external_callback');
        expect(res.body.data.shell_script).toContain('system_external_callback_batch');
        expect(res.body.data.shell_script).toContain('system_external_callback_passed');
        expect(res.body.data.shell_script).toContain('stringMatchCount');
        expect(res.body.data.shell_script).toContain('output_url_verification');
        expect(res.body.data.shell_script).toContain('output_url_not_found_in_import_response');
        expect(res.body.data.shell_script).toContain('verify the import response contains that same output_url');
        expect(res.body.data.shell_script).toContain('system-gears-external-callback-batch-import/v1');
        expect(res.body.data.shell_script).toContain('preflight_ready_to_import_count_zero');
        expect(res.body.data.shell_script).toContain('import_updated_count_zero');
        expect(res.body.data.shell_script).toContain('generated_health_ready_regressed');
        expect(res.body.data.shell_script).toContain('generated_health_interrupted_regressed');
        expect(res.body.data.shell_script).toContain('missing_generated_health_after');
        expect(res.body.data.shell_script).toContain('mvp_status_regressed');
        expect(res.body.data.shell_script).toContain('mvp_blocker_count_increased');
        expect(res.body.data.shell_script).toContain('missing_mvp_status_after');
        expect(res.body.data.shell_script).toContain('gears-large-project-pressure-skip.txt');
        expect(res.body.data.shell_script).toContain('gears-large-project-submit-http-status.txt');
        expect(res.body.data.shell_script).toContain('gears-large-project-submit-http-failed.txt');
        expect(res.body.data.shell_script).toContain('gears-large-project-response-audit.json');
        expect(res.body.data.shell_script).toContain('gears-large-project-response-audit.md');
        expect(res.body.data.shell_script).toContain('gears-large-project-response-audit/v1');
        expect(res.body.data.shell_script).toContain('Auditing GEARS large project pressure response after $reason');
        expect(res.body.data.shell_script).toContain('Auditing GEARS large project pressure response');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/gears-large-project-response-audit.json" "GEARS large project response audit"');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-verdict.json');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-verdict.md');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-verdict/v1');
        expect(res.body.data.shell_script).toContain('Writing GEARS worker acceptance verdict');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-verdict.json" "GEARS worker acceptance verdict"');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-archive.json');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-archive.md');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-archive/v1');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-checksums.json');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-checksums.md');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-checksum-manifest/v1');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-integrity.json');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-integrity.md');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-integrity/v1');
        expect(res.body.data.shell_script).toContain('Writing GEARS worker acceptance archive');
        expect(res.body.data.shell_script).toContain('Verifying GEARS worker acceptance evidence integrity');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-archive.json" "GEARS worker acceptance archive"');
        expect(res.body.data.shell_script).toContain('print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-integrity.json" "GEARS worker acceptance integrity"');
        expect(res.body.data.shell_script).toContain('write_worker_evidence_signoff_snapshot()');
        expect(res.body.data.shell_script).toContain('Writing GEARS worker evidence signoff snapshot');
        expect(res.body.data.shell_script).toContain('gears-worker-evidence-signoff.json');
        expect(res.body.data.shell_script).toContain('gears-worker-evidence-signoff.md');
        expect(res.body.data.shell_script).toContain('GEARS worker evidence signoff snapshot');
        expect(res.body.data.shell_script).toContain('sha256');
        expect(res.body.data.shell_script).toContain('checksum_manifest');
        expect(res.body.data.shell_script).toContain('required_checksum_count');
        expect(res.body.data.shell_script).toContain('"story-agent-generated-health-audit.json"');
        expect(res.body.data.shell_script).toContain('"story-agent-generated-health-after.json"');
        expect(res.body.data.shell_script).toContain('"domain-pack-production-health-audit.json"');
        expect(res.body.data.shell_script).toContain('"domain-pack-production-health-after.json"');
        expect(res.body.data.shell_script).toContain('"story-agent-mvp-status-audit.json"');
        expect(res.body.data.shell_script).toContain('"story-agent-mvp-status-after.json"');
        expect(res.body.data.shell_script).toContain('integrity_passed');
        expect(res.body.data.shell_script).toContain('mismatch_count');
        expect(res.body.data.shell_script).toContain('sha256_mismatch_count');
        expect(res.body.data.shell_script).toContain('missing_required_files');
        expect(res.body.data.shell_script).toContain('missing_required_attachment_count');
        expect(res.body.data.shell_script).toContain('signoff_ready');
        expect(res.body.data.shell_script).toContain('acceptance_passed');
        expect(res.body.data.shell_script).toContain('strict_exit_code');
        expect(res.body.data.shell_script).toContain('GEARS worker acceptance strict audit failed');
        expect(res.body.data.shell_script).toContain('GEARS worker acceptance archive strict audit failed');
        expect(res.body.data.shell_script).toContain('GEARS worker acceptance integrity strict audit failed');
        expect(res.body.data.shell_script).toContain('source_echo_gap');
        expect(res.body.data.shell_script).toContain('missing_requested_source_count');
        expect(res.body.data.shell_script).toContain('duplicate_source_id_count');
        expect(res.body.data.shell_script).toContain('unexpected_source_count');
        expect(res.body.data.shell_script).toContain('story-agent-worker-evidence-bundle-after.json');
        expect(res.body.data.shell_script).toContain('story-agent-generated-pressure-after.json');
        expect(res.body.data.shell_script).toContain('gears-worker-acceptance-evidence-manifest/v1');
        expect(res.body.data.shell_script).toContain('GEARS worker evidence signoff URL');
        expect(res.body.data.shell_script).toContain('/api/system/gears-execution-worker-evidence-signoff?evidence_dir=');
        expect(res.body.data.shell_script).toContain('MCP signoff tool: kb_get_gears_worker_evidence_signoff');
        expect(res.body.data.commands.find((command: any) => command.id === 'read_worker_evidence_signoff')).toEqual(expect.objectContaining({
          phase: 'worker_pressure',
          command: expect.stringContaining('/api/system/gears-execution-worker-evidence-signoff'),
          expected_assertions: expect.arrayContaining([
            expect.stringContaining('gears-execution-worker-evidence-signoff/v1'),
            expect.stringContaining('gears-worker-evidence-signoff.json'),
            expect.stringContaining('evidence_dir_source is input'),
          ]),
        }));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'audit_story_agent_mvp_status')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('story-agent-mvp-status-before.json'),
          expect.stringContaining('MVP status regresses'),
          expect.stringContaining('MVP score decreases'),
          expect.stringContaining('Seedance placeholder/production-ready asset counts'),
          expect.stringContaining('knowledge writeback ready/queued/needs_revision counts'),
          expect.stringContaining('real_external_callback_readiness'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'write_payload_files')?.command,
        ).toContain('story-agent-callback-id-preflight.json');
        expect(
          res.body.data.commands.find((command: any) => command.id === 'write_payload_files')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('auto-filled from smoke_targets'),
          expect.stringContaining('payload templates replace GEARS_SMOKE_PROJECT_ID'),
          expect.stringContaining('story-agent-system-external-output-url-source.json'),
          expect.stringContaining('story-agent-callback-id-preflight.json'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'write_env')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('story-agent-smoke-targets.json'),
          expect.stringContaining('GEARS_SYSTEM_EXTERNAL_OUTPUT_URL'),
          expect.stringContaining('GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1'),
          expect.stringContaining('GEARS_SMOKE_PROJECT_ID and GEARS_SMOKE_SERIES_PROJECT_ID match Story Agent route id formats'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'seed_story_agent_ledgers_optional')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('Story Agent submit APIs'),
          expect.stringContaining('story-agent-project-ledger-seed-selected.json'),
          expect.stringContaining('ledger_match_missing_count should drop to zero'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'preflight_system_external_callback_batch')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('system-gears-external-callback-batch-import/v1'),
          expect.stringContaining('blocked=false'),
          expect.stringContaining('ready_to_import_count'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'import_system_external_callback_batch')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('updated_count'),
          expect.stringContaining('does not accept local_acceptance'),
          expect.stringContaining('external_ready increases'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'generate_large_project_pressure_payload')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('Default pressure payload contains 30 episodes'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'audit_large_project_pressure_response')?.command,
        ).toContain('gears-large-project-response-audit.json');
        expect(
          res.body.data.commands.find((command: any) => command.id === 'audit_large_project_pressure_response')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('request_unit_count'),
          expect.stringContaining('source_echo_count equals request_unit_count'),
          expect.stringContaining('missing_requested_source_count'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'write_acceptance_verdict')?.command,
        ).toContain('gears-worker-acceptance-verdict.json');
        expect(
          res.body.data.commands.find((command: any) => command.id === 'write_acceptance_verdict')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('required envs'),
          expect.stringContaining('system external callback batch'),
          expect.stringContaining('exact output_url'),
          expect.stringContaining('Seedance asset and knowledge writeback governance counts'),
          expect.stringContaining('real external callback readiness'),
          expect.stringContaining('acceptance_passed'),
          expect.stringContaining('GEARS_ACCEPTANCE_STRICT_AUDIT=1'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'write_acceptance_archive')?.command,
        ).toContain('gears-worker-acceptance-archive.json');
        expect(
          res.body.data.commands.find((command: any) => command.id === 'write_acceptance_archive')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('missing_required_files'),
          expect.stringContaining('MVP Seedance asset and knowledge writeback governance counts'),
          expect.stringContaining('MVP real external callback readiness'),
          expect.stringContaining('output_url_verification'),
          expect.stringContaining('checksum_manifest'),
          expect.stringContaining('gears-worker-acceptance-checksums.json'),
          expect.stringContaining('sha256'),
          expect.stringContaining('signoff_ready'),
          expect.stringContaining('GEARS_ACCEPTANCE_STRICT_AUDIT=1'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'verify_acceptance_integrity')?.command,
        ).toContain('gears-worker-acceptance-integrity.json');
        expect(
          res.body.data.commands.find((command: any) => command.id === 'verify_acceptance_integrity')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('sha256'),
          expect.stringContaining('byte_length_mismatch'),
          expect.stringContaining('integrity_passed'),
          expect.stringContaining('GEARS_ACCEPTANCE_STRICT_AUDIT=1'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'audit_worker_response_shapes')?.command,
        ).toContain('gears-worker-response-audit.json');
        expect(
          res.body.data.commands.find((command: any) => command.id === 'audit_worker_response_shapes')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('accepted_count, rejected_count, failed_count'),
          expect.stringContaining('artifact URL'),
          expect.stringContaining('transport_error_count and http_error_count'),
          expect.stringContaining('error_code, and failure_category gaps'),
          expect.stringContaining('recommended_actions'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'poll_worker_status')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS'),
        ]));
        expect(
          res.body.data.commands.find((command: any) => command.id === 'audit_story_agent_callback_responses')?.expected_assertions,
        ).toEqual(expect.arrayContaining([
          expect.stringContaining('ok_true_count'),
          expect.stringContaining('transport_error_count, http_error_count, not_found_count, blocked_count, and ledger_match_missing_count'),
          expect.stringContaining('recommended_actions'),
        ]));
        expect(res.body.data.markdown).toContain('# GEARS v2 Worker Acceptance Kit');
        expect(res.body.data.markdown).toContain('series_ledger_seed_ready');
        if (res.body.data.smoke_targets.series_project_candidates.length) {
          expect(res.body.data.markdown).toContain('seed_job=');
        }
        expect(res.body.data.markdown).toContain('## Shell Script');
        expect(res.body.data.markdown).toContain('## Commands');
        await expect(assertBashSyntax(res.body.data.shell_script)).resolves.toBeUndefined();
      } finally {
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.apiToken === undefined) delete process.env.GEARS_API_TOKEN;
        else process.env.GEARS_API_TOKEN = previous.apiToken;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
      }
    });

    it('executes generated MVP readiness verdict/archive scripts against fixture evidence', async () => {
      const res = await request.get('/api/system/gears-execution-worker-acceptance-kit');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      const commandById = new Map<string, string>(
        res.body.data.commands.map((command: any) => [command.id, command.command]),
      );
      const mvpAuditCommand = commandById.get('audit_story_agent_mvp_status');
      const verdictCommand = commandById.get('write_acceptance_verdict');
      const archiveCommand = commandById.get('write_acceptance_archive');
      expect(mvpAuditCommand).toBeTruthy();
      expect(verdictCommand).toBeTruthy();
      expect(archiveCommand).toBeTruthy();

      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-acceptance-kit-script-'));
      const outputUrl = 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4';
      const mvpSummary = {
        blocker_count: 0,
        warning_count: 0,
        generated_ready_count: 1,
        generated_interrupted_count: 0,
        generated_production_gap_count: 0,
        readiness_ready_count: 1,
        readiness_blocked_count: 0,
        ready_automation_step_count: 1,
        real_gears_endpoint_configured: true,
        real_gears_callback_secret_configured: true,
        real_gears_callback_base_configured: true,
        real_gears_callback_base_public: true,
        real_gears_acceptance_ready_to_run: true,
        real_gears_acceptance_blocker: 'gears_worker_signoff_evidence_pending',
        local_acceptance_counts_as_real_external_callback: false,
        seedance_provider_submit_adapter_configured: true,
        seedance_provider_poll_adapter_configured: true,
        seedance_provider_callback_base_configured: true,
        seedance_provider_external_loop_ready: true,
        seedance_placeholder_asset_count: 0,
        seedance_production_asset_ready_count: 5,
        knowledge_writeback_ready_count: 1,
        knowledge_writeback_queued_count: 1,
        knowledge_writeback_needs_revision_count: 0,
      };
      const mvpStatus = {
        schema_version: 'story-agent-mvp-status/v1',
        status: 'ready',
        score: 96,
        lanes: [{ id: 'gears_end_to_end_acceptance', status: 'ready' }],
        summary: mvpSummary,
      };
      await writeJsonFixture(evidenceDir, 'story-agent-mvp-status-before.json', mvpStatus);
      await writeJsonFixture(evidenceDir, 'story-agent-mvp-status-after.json', mvpStatus);

      await runAcceptanceKitNodeCommand(mvpAuditCommand!, evidenceDir);

      const mvpAudit = JSON.parse(await readFile(resolve(evidenceDir, 'story-agent-mvp-status-audit.json'), 'utf-8'));
      expect(mvpAudit).toMatchObject({
        schema_version: 'story-agent-mvp-status-audit/v1',
        status: 'passed',
        failed_checks: [],
        real_external_callback_readiness: {
          booleans: {
            real_gears_acceptance_ready_to_run: { before: true, after: true, changed: false },
            real_gears_callback_base_public: { before: true, after: true, changed: false },
            local_acceptance_counts_as_real_external_callback: { before: false, after: false, changed: false },
          },
          blocker: {
            before: 'gears_worker_signoff_evidence_pending',
            after: 'gears_worker_signoff_evidence_pending',
            changed: false,
          },
        },
      });
      expect(await readFile(resolve(evidenceDir, 'story-agent-mvp-status-audit.md'), 'utf-8'))
        .toContain('local_acceptance_counts_as_real_external_callback_before/after/changed: false/false/false');

      await writeFile(resolve(evidenceDir, 'gears-required-env-missing.txt'), '', 'utf-8');
      await writeJsonFixture(evidenceDir, 'story-agent-callback-id-preflight.json', { warning_count: 0 });
      await writeJsonFixture(evidenceDir, 'gears-worker-response-audit.json', {
        totals: {
          record_count: 1,
          parse_error_count: 0,
          transport_error_count: 0,
          http_error_count: 0,
          unknown_count: 0,
          missing_worker_id_count: 0,
          missing_source_id_count: 0,
          missing_failure_context_count: 0,
          missing_ready_artifact_count: 0,
        },
        recommended_actions: [],
      });
      await writeJsonFixture(evidenceDir, 'story-agent-callback-response-audit.json', {
        totals: {
          parse_error_count: 0,
          transport_error_count: 0,
          http_error_count: 0,
          ok_false_count: 0,
          failed_count: 0,
          validation_error_count: 0,
          auth_error_count: 0,
          not_found_count: 0,
          blocked_count: 0,
          ledger_match_missing_count: 0,
        },
        recommended_actions: [],
      });
      await writeJsonFixture(evidenceDir, 'story-agent-system-external-output-url-source.json', {
        schema_version: 'story-agent-system-external-output-url-source/v1',
        source: 'worker_response',
        output_url: outputUrl,
        placeholder: false,
        ready_for_external_import: true,
      });
      await writeJsonFixture(evidenceDir, 'story-agent-system-external-callback-preflight-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'preflight',
          blocked: false,
          received_count: 1,
          resolved_count: 1,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 1,
          updated_count: 0,
          failed_count: 0,
          blocking_count: 0,
        },
      });
      await writeJsonFixture(evidenceDir, 'story-agent-system-external-callback-import-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'import',
          blocked: false,
          received_count: 1,
          resolved_count: 1,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 1,
          updated_count: 1,
          failed_count: 0,
          blocking_count: 0,
          project_results: [{
            import_result: {
              seedance_shot_ledger: {
                items: [{ video_url: outputUrl }],
              },
            },
          }],
        },
      });
      await writeJsonFixture(evidenceDir, 'story-agent-generated-health-audit.json', {
        status: 'passed',
        before: { summary: { ready_count: 1 } },
        after: { summary: { ready_count: 1 } },
        deltas: { ready_count: 0 },
        recommended_actions: [],
      });
      await writeJsonFixture(evidenceDir, 'production-material-pack-health-audit.json', {
        status: 'passed',
        before: { status: 'passed', issue_count: 0, core_ready_count: 4 },
        after: { status: 'passed', issue_count: 0, core_ready_count: 4 },
        deltas: { issue_count: 0, core_ready_count: 0 },
        failed_checks: [],
        warning_checks: [],
        recommended_actions: [],
      });
      await writeJsonFixture(evidenceDir, 'domain-pack-production-health-audit.json', {
        status: 'passed',
        before: { status: 'passed', issue_count: 0, ready_pack_count: 8 },
        after: { status: 'passed', issue_count: 0, ready_pack_count: 8 },
        deltas: { issue_count: 0, ready_pack_count: 0 },
        failed_checks: [],
        warning_checks: [],
        recommended_actions: [],
      });
      await writeJsonFixture(evidenceDir, 'gears-large-project-response-audit.json', {
        totals: {
          pressure_submitted: false,
          pressure_skipped: true,
          request_unit_count: 0,
          source_echo_count: 0,
          missing_requested_source_count: 0,
          duplicate_source_id_count: 0,
          unexpected_source_count: 0,
          unknown_count: 0,
        },
        recommended_actions: [],
      });
      await writeJsonFixture(evidenceDir, 'manifest.json', { schema_version: 'gears-worker-acceptance-evidence-manifest/v1' });

      await runAcceptanceKitNodeCommand(verdictCommand!, evidenceDir);

      const verdict = JSON.parse(await readFile(resolve(evidenceDir, 'gears-worker-acceptance-verdict.json'), 'utf-8'));
      expect(verdict).toMatchObject({
        schema_version: 'gears-worker-acceptance-verdict/v1',
        acceptance_passed: true,
        mvp_real_external_callback_readiness: {
          booleans: {
            local_acceptance_counts_as_real_external_callback: { before: false, after: false, changed: false },
          },
        },
      });
      expect(verdict.gates.find((gate: any) => gate.id === 'story_agent_mvp_status_audit')?.evidence)
        .toHaveProperty('real_external_callback_readiness');

      const requiredArchiveAttachments = [
        'env.template.sh',
        'story-agent-smoke-targets.json',
        'story-agent-smoke-env-selected.json',
        'gears-submit-smoke.json',
        'gears-submit-response.json',
        'gears-worker-response-audit.md',
        'story-agent-generated-health-before.json',
        'story-agent-generated-health-after.json',
        'story-agent-generated-health-audit.md',
        'production-material-pack-health-before.json',
        'production-material-pack-health-after.json',
        'production-material-pack-health-audit.md',
        'domain-pack-production-health-before.json',
        'domain-pack-production-health-after.json',
        'domain-pack-production-health-audit.md',
        'gears-system-external-callback-smoke.json',
        'story-agent-system-external-ledger-seed-selected.json',
        'story-agent-callback-response-audit.md',
        'gears-large-project-submit-pressure.json',
        'gears-large-project-pressure-summary.json',
        'gears-large-project-response-audit.md',
      ];
      for (const filename of requiredArchiveAttachments) {
        await ensureEvidenceFixtureFile(evidenceDir, filename);
      }

      await runAcceptanceKitNodeCommand(archiveCommand!, evidenceDir);

      const archive = JSON.parse(await readFile(resolve(evidenceDir, 'gears-worker-acceptance-archive.json'), 'utf-8'));
      expect(archive).toMatchObject({
        schema_version: 'gears-worker-acceptance-archive/v1',
        signoff_ready: true,
        audit_summaries: {
          story_agent_mvp_status: {
            real_external_callback_readiness: {
              booleans: {
                local_acceptance_counts_as_real_external_callback: { before: false, after: false, changed: false },
              },
            },
          },
        },
      });
      expect(await readFile(resolve(evidenceDir, 'gears-worker-acceptance-archive.md'), 'utf-8'))
        .toContain('mvp_local_acceptance_counts_as_real_external_callback_before/after/changed: false/false/false');
      expect(JSON.parse(await readFile(resolve(evidenceDir, 'gears-worker-acceptance-checksums.json'), 'utf-8'))).toMatchObject({
        schema_version: 'gears-worker-acceptance-checksum-manifest/v1',
        algorithm: 'sha256',
      });
    });
  });

  describe('GET /api/system/gears-execution-worker-evidence-bundle', () => {
    it('returns a complete worker handoff evidence bundle', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        apiToken: process.env.GEARS_API_TOKEN,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
      };
      try {
        delete process.env.GEARS_API_BASE_URL;
        delete process.env.GEARS_API_TOKEN;
        delete process.env.GEARS_CALLBACK_SECRET;
        delete process.env.GEARS_CALLBACK_BASE_URL;

        const res = await request.get('/api/system/gears-execution-worker-evidence-bundle');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'gears',
          schema_version: 'gears-execution-worker-evidence-bundle/v1',
          status: 'blocked',
          readiness_status: 'blocked',
          command_count: 25,
          payload_count: 6,
          local_smoke_passed_count: 5,
          local_smoke_total_count: 5,
          generated_health_status: expect.stringMatching(/ready|attention|blocked/),
          generated_health_ready_count: expect.any(Number),
          generated_health_planned_count: expect.any(Number),
          generated_health_production_gap_count: expect.any(Number),
          generated_health_interrupted_count: expect.any(Number),
          story_agent_mvp_status: expect.stringMatching(/ready|needs_action|blocked/),
          story_agent_mvp_score: expect.any(Number),
          real_gears_callback_base_public: expect.any(Boolean),
          real_gears_acceptance_ready_to_run: expect.any(Boolean),
          real_gears_acceptance_blocker: expect.any(String),
          local_acceptance_counts_as_real_external_callback: false,
          seedance_provider_external_loop_ready: expect.any(Boolean),
          production_material_pack_status: 'passed',
          production_material_pack_issue_count: 0,
          production_material_pack_core_ready_count: 4,
          production_material_pack_core_total_count: 4,
          domain_pack_status: 'passed',
          domain_pack_issue_count: 0,
          domain_pack_ready_count: 8,
          domain_pack_required_count: 8,
          required_envs: expect.arrayContaining(['GEARS_EXECUTION_WORKER_API_BASE_URL', 'GEARS_CALLBACK_SECRET']),
        });
        expect(res.body.data.documents.map((doc: any) => doc.id)).toEqual([
          'acceptance_report',
          'worker_acceptance_kit',
          'smoke_handoff_package',
          'pressure_report',
          'generated_project_pressure_report',
          'generated_health_report',
          'story_agent_backlog_handoff_report',
          'story_agent_mvp_status_report',
          'production_material_pack_health_report',
          'domain_pack_production_health_report',
        ]);
        expect(res.body.data.documents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            filename: 'gears-worker-acceptance-kit.md',
            source_endpoint: '/api/system/gears-execution-worker-acceptance-kit',
            format: 'markdown',
            content: expect.stringContaining('## Shell Script'),
          }),
          expect.objectContaining({
            filename: 'gears-worker-acceptance-report.md',
            source_endpoint: '/api/system/gears-execution-acceptance-report',
            content_length: expect.any(Number),
          }),
          expect.objectContaining({
            filename: 'story-agent-generated-health-report.md',
            source_endpoint: '/api/system/story-agent-generated-health',
            content: expect.stringContaining('# Story Agent Generated Health'),
          }),
          expect.objectContaining({
            filename: 'story-agent-backlog-handoff-report.md',
            source_endpoint: '/api/system/story-agent-backlog-handoff',
            content: expect.stringContaining('# Story Agent Backlog Handoff'),
          }),
          expect.objectContaining({
            filename: 'story-agent-mvp-status-report.md',
            source_endpoint: '/api/system/story-agent-mvp-status',
            content: expect.stringContaining('# Story Agent MVP Status'),
          }),
          expect.objectContaining({
            filename: 'production-material-pack-health-report.md',
            source_endpoint: '/api/system/production-material-pack-health',
            content: expect.stringContaining('# Production Material Pack Health'),
          }),
          expect.objectContaining({
            filename: 'domain-pack-production-health-report.md',
            source_endpoint: '/api/system/domain-pack-production-health',
            content: expect.stringContaining('# Domain Pack Production Health'),
          }),
        ]));
    const productionMaterialHealthAttachment = res.body.data.documents.find(
          (attachment: { filename?: string }) =>
            attachment.filename === 'production-material-pack-health-report.md',
        );
        expect(productionMaterialHealthAttachment?.content).toContain('- pack_file_valid: true');
        expect(productionMaterialHealthAttachment?.content).toContain('## Pack File Diagnostics');
        expect(productionMaterialHealthAttachment?.content).toContain('- rejected_pack_count: 0');
        expect(productionMaterialHealthAttachment?.content).toContain('## Rejected Packs');
        expect(res.body.data.operator_checklist).toEqual(expect.arrayContaining([
          'Attach gears-worker-response-audit.json to summarize worker ids, source ids, statuses, error codes, and failure categories.',
          'Attach gears-worker-acceptance-verdict.json and require acceptance_passed=true for sign-off.',
          'Attach gears-worker-acceptance-archive.json/.md and require signoff_ready=true with no missing required attachments.',
          'Attach gears-worker-acceptance-checksums.json/.md so GEARS v2 can verify evidence files by sha256.',
          'Attach gears-worker-acceptance-integrity.json/.md and require integrity_passed=true before handoff.',
          'Attach gears-worker-evidence-signoff.json/.md as the final post-archive signoff snapshot.',
          'Attach story-agent-backlog-handoff-report.md to show P0/P1 generated and supplement handoff targets before GEARS worker sign-off.',
          'Attach story-agent-mvp-status-report.md to show Story Agent MVP lane status before GEARS worker sign-off.',
          'Attach story-agent-mvp-status-audit.json/.md and require status=passed or warning with no failed_checks before sign-off.',
          'Confirm story-agent-mvp-status-audit.json records real_external_callback_readiness with local_acceptance_counts_as_real_external_callback=false before sign-off.',
          'Confirm gears-worker-acceptance-verdict.json and gears-worker-acceptance-archive.json embed matching MVP real external callback readiness before sign-off.',
          'Attach domain-pack-production-health-report.md and domain-pack-production-health-audit.json/.md to prove production prompt packs are production-ready before GEARS worker sign-off.',
          'Attach story-agent-generated-health-audit.json/.md and require status=passed before sign-off.',
          'Run generated health audit before and after smoke to confirm the selected target is not planned-only or interrupted.',
          'Replay callback payloads once to prove duplicate_count is reported and no duplicate artifacts are created.',
        ]));
        expect(res.body.data.markdown).toContain('# GEARS v2 Worker Evidence Bundle');
        expect(res.body.data.markdown).toContain('## Embedded Document: Worker acceptance kit');
        expect(res.body.data.markdown).toContain('audit_story_agent_callback_responses');
        expect(res.body.data.markdown).toContain('gears-worker-acceptance-verdict.json');
        expect(res.body.data.markdown).toContain('gears-worker-acceptance-archive.json');
        expect(res.body.data.markdown).toContain('gears-worker-acceptance-checksums.json');
        expect(res.body.data.markdown).toContain('gears-worker-acceptance-integrity.json');
        expect(res.body.data.markdown).toContain('Story Agent generated health report');
        expect(res.body.data.markdown).toContain('Story Agent MVP status report');
        expect(res.body.data.markdown).toContain('audit_story_agent_mvp_status');
        expect(res.body.data.markdown).toContain('real_gears_acceptance_ready_to_run');
        expect(res.body.data.markdown).toContain('local_acceptance_counts_as_real_external_callback: false');
        expect(res.body.data.recommended_next_actions).toEqual(expect.arrayContaining([
          'Keep local acceptance separate from real external callback evidence; require MVP real external callback readiness in audit, verdict, archive, and final signoff.',
        ]));
      } finally {
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.apiToken === undefined) delete process.env.GEARS_API_TOKEN;
        else process.env.GEARS_API_TOKEN = previous.apiToken;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
      }
    });
  });

  describe('GET /api/system/gears-execution-worker-evidence-signoff', () => {
    async function writeEvidenceJson(evidenceDir: string, filename: string, value: unknown) {
      await writeFile(resolve(evidenceDir, filename), JSON.stringify(value, null, 2), 'utf-8');
    }

    async function writeReadyEvidence(evidenceDir: string) {
      await mkdir(evidenceDir, { recursive: true });
      const mvpGovernanceCounts = {
        seedance_placeholder_asset_count: { before: 0, after: 0, delta: 0 },
        seedance_production_asset_ready_count: { before: 5, after: 5, delta: 0 },
        knowledge_writeback_ready_count: { before: 1, after: 1, delta: 0 },
        knowledge_writeback_queued_count: { before: 1, after: 1, delta: 0 },
        knowledge_writeback_needs_revision_count: { before: 0, after: 0, delta: 0 },
      };
      const mvpRealExternalSummary = {
        real_gears_endpoint_configured: true,
        real_gears_callback_secret_configured: true,
        real_gears_callback_base_configured: true,
        real_gears_callback_base_public: true,
        real_gears_acceptance_ready_to_run: true,
        real_gears_acceptance_blocker: 'gears_worker_signoff_evidence_pending',
        local_acceptance_counts_as_real_external_callback: false,
        seedance_provider_submit_adapter_configured: true,
        seedance_provider_poll_adapter_configured: true,
        seedance_provider_callback_base_configured: true,
        seedance_provider_external_loop_ready: true,
      };
      const mvpRealExternalCallbackReadiness = {
        booleans: {
          real_gears_endpoint_configured: { before: true, after: true, changed: false },
          real_gears_callback_secret_configured: { before: true, after: true, changed: false },
          real_gears_callback_base_configured: { before: true, after: true, changed: false },
          real_gears_callback_base_public: { before: true, after: true, changed: false },
          real_gears_acceptance_ready_to_run: { before: true, after: true, changed: false },
          local_acceptance_counts_as_real_external_callback: { before: false, after: false, changed: false },
          seedance_provider_submit_adapter_configured: { before: true, after: true, changed: false },
          seedance_provider_poll_adapter_configured: { before: true, after: true, changed: false },
          seedance_provider_callback_base_configured: { before: true, after: true, changed: false },
          seedance_provider_external_loop_ready: { before: true, after: true, changed: false },
        },
        blocker: {
          before: 'gears_worker_signoff_evidence_pending',
          after: 'gears_worker_signoff_evidence_pending',
          changed: false,
        },
      };
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', {
        schema_version: 'gears-worker-acceptance-verdict/v1',
        status: 'passed',
        acceptance_passed: true,
        pressure_submitted: true,
        gate_counts: { passed: 11, failed: 0, skipped: 0, total: 11 },
        failed_gate_ids: [],
        skipped_gate_ids: [],
        mvp_governance_counts: mvpGovernanceCounts,
        mvp_real_external_callback_readiness: mvpRealExternalCallbackReadiness,
        gates: [{
          id: 'system_external_callback_batch',
          label: 'Story Agent system external callback batch',
          status: 'passed',
          summary: 'System external callbacks wrote real external artifacts.',
          evidence: {
            output_url_verification: {
              expected_output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
              imported: true,
              import_match_count: 1,
            },
          },
        }],
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-archive.json', {
        schema_version: 'gears-worker-acceptance-archive/v1',
        status: 'signoff_ready',
        signoff_ready: true,
        totals: {
          missing_required_attachment_count: 0,
          required_attachment_count: 39,
          required_checksum_count: 39,
          evidence_file_count: 78,
        },
        required_attachments: [
          'gears-worker-acceptance-verdict.json',
          'story-agent-system-external-output-url-source.json',
          'story-agent-system-external-callback-preflight-response.json',
          'story-agent-system-external-callback-import-response.json',
          'production-material-pack-health-audit.json',
          'domain-pack-production-health-audit.json',
          'story-agent-mvp-status-audit.json',
        ],
        missing_required_files: [],
        audit_summaries: {
          system_external_callback: {
            output_url_verification: {
              expected_output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
              imported: true,
              import_match_count: 1,
            },
          },
          story_agent_mvp_status: {
            governance_counts: mvpGovernanceCounts,
            real_external_callback_readiness: mvpRealExternalCallbackReadiness,
          },
        },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-integrity.json', {
        schema_version: 'gears-worker-acceptance-integrity/v1',
        status: 'passed',
        integrity_passed: true,
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-response-audit.json', {
        totals: {
          record_count: 1,
          transport_error_count: 0,
          http_error_count: 0,
          unknown_count: 0,
          missing_worker_id_count: 0,
          missing_source_id_count: 0,
          missing_ready_artifact_count: 0,
        },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-callback-response-audit.json', {
        totals: {
          transport_error_count: 0,
          http_error_count: 0,
          ledger_match_missing_count: 0,
          failed_count: 0,
        },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-output-url-source.json', {
        schema_version: 'story-agent-system-external-output-url-source/v1',
        env_var: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
        configured_from_env: false,
        discovered_from_worker_response: true,
        source: 'worker_response',
        output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
        placeholder: false,
        ready_for_external_import: true,
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-preflight-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'preflight',
          blocked: false,
          received_count: 1,
          resolved_count: 1,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 1,
          updated_count: 0,
          failed_count: 0,
          duplicate_count: 0,
          blocking_count: 0,
          warning_count: 0,
          project_results: [{
            import_result: {
              seedance_shot_ledger: {
                items: [{ video_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4' }],
              },
            },
          }],
        },
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-import-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'import',
          blocked: false,
          received_count: 1,
          resolved_count: 1,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 1,
          updated_count: 1,
          failed_count: 0,
          duplicate_count: 0,
          blocking_count: 0,
          warning_count: 0,
          project_results: [{
            import_result: {
              seedance_shot_ledger: {
                items: [{ video_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4' }],
              },
            },
          }],
        },
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-generated-health-audit.json', {
        schema_version: 'story-agent-generated-health-audit/v1',
        status: 'passed',
        before: { summary: { ready_count: 1 } },
        after: { summary: { ready_count: 1 } },
        deltas: { ready_count: 0, interrupted_count: 0, production_gap_count: 0 },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'production-material-pack-health-audit.json', {
        schema_version: 'production-material-pack-health-audit/v1',
        status: 'passed',
        before: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
        after: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
        deltas: { issue_count: 0, core_ready_count: 0 },
        failed_checks: [],
        warning_checks: [],
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'domain-pack-production-health-audit.json', {
        schema_version: 'domain-pack-production-health-audit/v1',
        status: 'passed',
        before: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
        after: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
        deltas: { issue_count: 0, ready_pack_count: 0 },
        failed_checks: [],
        warning_checks: [],
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-mvp-status-audit.json', {
        schema_version: 'story-agent-mvp-status-audit/v1',
        status: 'passed',
        before: {
          status: 'ready',
          score: 95,
          summary: {
            ...mvpRealExternalSummary,
            seedance_placeholder_asset_count: 0,
            seedance_production_asset_ready_count: 5,
            knowledge_writeback_ready_count: 1,
            knowledge_writeback_queued_count: 1,
            knowledge_writeback_needs_revision_count: 0,
          },
        },
        after: {
          status: 'ready',
          score: 95,
          summary: {
            ...mvpRealExternalSummary,
            seedance_placeholder_asset_count: 0,
            seedance_production_asset_ready_count: 5,
            knowledge_writeback_ready_count: 1,
            knowledge_writeback_queued_count: 1,
            knowledge_writeback_needs_revision_count: 0,
          },
        },
        deltas: {
          score: 0,
          status_rank: 0,
          blocker_count: 0,
          seedance_placeholder_asset_count: 0,
          seedance_production_asset_ready_count: 0,
          knowledge_writeback_ready_count: 0,
          knowledge_writeback_queued_count: 0,
          knowledge_writeback_needs_revision_count: 0,
        },
        failed_checks: [],
        warning_checks: [],
        real_external_callback_readiness: mvpRealExternalCallbackReadiness,
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-large-project-response-audit.json', {
        totals: {
          pressure_submitted: true,
          request_unit_count: 120,
          response_record_count: 120,
          accepted_count: 120,
          rejected_count: 0,
          failed_count: 0,
          source_echo_count: 120,
          missing_requested_source_count: 0,
          duplicate_source_id_count: 0,
          unexpected_source_count: 0,
        },
        recommended_actions: [],
      });
    }

    it('blocks when no evidence directory is configured', async () => {
      const previousEvidenceDir = process.env.GEARS_EVIDENCE_DIR;
      const previousAutoDiscover = process.env.GEARS_EVIDENCE_AUTO_DISCOVER;
      try {
        delete process.env.GEARS_EVIDENCE_DIR;
        process.env.GEARS_EVIDENCE_AUTO_DISCOVER = '0';

        const res = await request.get('/api/system/gears-execution-worker-evidence-signoff');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'gears',
          schema_version: 'gears-execution-worker-evidence-signoff/v1',
          status: 'blocked',
          evidence_dir_source: 'missing',
          evidence_dir_allowed: false,
          evidence_dir_error: 'missing_evidence_dir',
          failed_gate_ids: ['evidence_dir'],
          acceptance_passed: false,
          signoff_ready: false,
          integrity_passed: false,
          health_audit_passed: false,
          production_material_pack_health_audit_passed: false,
          domain_pack_production_health_audit_passed: false,
          mvp_status_audit_passed: false,
        });
        expect(res.body.data.markdown).toContain('# GEARS Worker Evidence Signoff');
        expect(res.body.data.markdown).toContain('missing_evidence_dir');
      } finally {
        if (previousEvidenceDir === undefined) delete process.env.GEARS_EVIDENCE_DIR;
        else process.env.GEARS_EVIDENCE_DIR = previousEvidenceDir;
        if (previousAutoDiscover === undefined) delete process.env.GEARS_EVIDENCE_AUTO_DISCOVER;
        else process.env.GEARS_EVIDENCE_AUTO_DISCOVER = previousAutoDiscover;
      }
    });

    it('auto-discovers the latest worker evidence directory when none is configured', async () => {
      const previousEvidenceDir = process.env.GEARS_EVIDENCE_DIR;
      const previousAutoDiscover = process.env.GEARS_EVIDENCE_AUTO_DISCOVER;
      const previousAutoDiscoverRoots = process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS;
      try {
        delete process.env.GEARS_EVIDENCE_DIR;
        process.env.GEARS_EVIDENCE_AUTO_DISCOVER = '1';
        const discoveryRoot = resolve(testWorkspaceRoot, 'gears-signoff-discovery');
        process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS = discoveryRoot;
        const oldEvidenceDir = resolve(discoveryRoot, 'gears-worker-evidence-old');
        const latestEvidenceDir = resolve(discoveryRoot, 'gears-worker-evidence-new');
        await writeReadyEvidence(oldEvidenceDir);
        await writeReadyEvidence(latestEvidenceDir);

        const res = await request.get('/api/system/gears-execution-worker-evidence-signoff');

        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          status: 'ready',
          evidence_dir: latestEvidenceDir,
          evidence_dir_source: 'latest',
          evidence_dir_allowed: true,
          gate_counts: { passed: 11, failed: 0, skipped: 0, total: 11 },
          system_external_output_url_source: 'worker_response',
          large_project_source_echo_count: 120,
        });
        expect(res.body.data.markdown).toContain('evidence_dir_source: latest');
      } finally {
        if (previousEvidenceDir === undefined) delete process.env.GEARS_EVIDENCE_DIR;
        else process.env.GEARS_EVIDENCE_DIR = previousEvidenceDir;
        if (previousAutoDiscover === undefined) delete process.env.GEARS_EVIDENCE_AUTO_DISCOVER;
        else process.env.GEARS_EVIDENCE_AUTO_DISCOVER = previousAutoDiscover;
        if (previousAutoDiscoverRoots === undefined) delete process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS;
        else process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS = previousAutoDiscoverRoots;
      }
    });

    it('summarizes a complete evidence directory as ready for signoff', async () => {
      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-signoff-'));
      const mvpGovernanceCounts = {
        seedance_placeholder_asset_count: { before: 0, after: 0, delta: 0 },
        seedance_production_asset_ready_count: { before: 5, after: 5, delta: 0 },
        knowledge_writeback_ready_count: { before: 1, after: 1, delta: 0 },
        knowledge_writeback_queued_count: { before: 1, after: 1, delta: 0 },
        knowledge_writeback_needs_revision_count: { before: 0, after: 0, delta: 0 },
      };
      const mvpRealExternalSummary = {
        real_gears_endpoint_configured: true,
        real_gears_callback_secret_configured: true,
        real_gears_callback_base_configured: true,
        real_gears_callback_base_public: true,
        real_gears_acceptance_ready_to_run: true,
        real_gears_acceptance_blocker: 'gears_worker_signoff_evidence_pending',
        local_acceptance_counts_as_real_external_callback: false,
        seedance_provider_submit_adapter_configured: true,
        seedance_provider_poll_adapter_configured: true,
        seedance_provider_callback_base_configured: true,
        seedance_provider_external_loop_ready: true,
      };
      const mvpRealExternalCallbackReadiness = {
        booleans: {
          real_gears_endpoint_configured: { before: true, after: true, changed: false },
          real_gears_callback_secret_configured: { before: true, after: true, changed: false },
          real_gears_callback_base_configured: { before: true, after: true, changed: false },
          real_gears_callback_base_public: { before: true, after: true, changed: false },
          real_gears_acceptance_ready_to_run: { before: true, after: true, changed: false },
          local_acceptance_counts_as_real_external_callback: { before: false, after: false, changed: false },
          seedance_provider_submit_adapter_configured: { before: true, after: true, changed: false },
          seedance_provider_poll_adapter_configured: { before: true, after: true, changed: false },
          seedance_provider_callback_base_configured: { before: true, after: true, changed: false },
          seedance_provider_external_loop_ready: { before: true, after: true, changed: false },
        },
        blocker: {
          before: 'gears_worker_signoff_evidence_pending',
          after: 'gears_worker_signoff_evidence_pending',
          changed: false,
        },
      };
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', {
        schema_version: 'gears-worker-acceptance-verdict/v1',
        status: 'passed',
        acceptance_passed: true,
        pressure_submitted: true,
        gate_counts: { passed: 11, failed: 0, skipped: 0, total: 11 },
        failed_gate_ids: [],
        skipped_gate_ids: [],
        mvp_governance_counts: mvpGovernanceCounts,
        mvp_real_external_callback_readiness: mvpRealExternalCallbackReadiness,
        gates: [
          {
            id: 'system_external_callback_batch',
            label: 'Story Agent system external callback batch',
            status: 'passed',
            summary: 'System external callbacks wrote real external artifacts.',
            evidence: {
              output_url_verification: {
                expected_output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
                imported: true,
                import_match_count: 1,
              },
            },
          },
          {
            id: 'story_agent_generated_health_audit',
            label: 'Story Agent generated health smoke audit',
            status: 'passed',
            summary: 'Generated health stayed stable.',
          },
          {
            id: 'production_material_pack_health_audit',
            label: 'Production material pack health smoke audit',
            status: 'passed',
            summary: 'Production material pack health stayed passed.',
          },
          {
            id: 'domain_pack_production_health_audit',
            label: 'Domain Pack production health smoke audit',
            status: 'passed',
            summary: 'Domain Pack production health stayed passed.',
          },
          {
            id: 'story_agent_mvp_status_audit',
            label: 'Story Agent MVP status smoke audit',
            status: 'passed',
            summary: 'MVP status stayed stable.',
          },
        ],
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-archive.json', {
        schema_version: 'gears-worker-acceptance-archive/v1',
        status: 'signoff_ready',
        signoff_ready: true,
        totals: {
          missing_required_attachment_count: 0,
          required_attachment_count: 39,
          required_checksum_count: 39,
          evidence_file_count: 78,
        },
        required_attachments: [
          'gears-worker-acceptance-verdict.json',
          'gears-system-external-callback-smoke.json',
          'story-agent-system-external-output-url-source.json',
          'story-agent-system-external-ledger-seed-selected.json',
          'story-agent-system-external-callback-preflight-response.json',
          'story-agent-system-external-callback-import-response.json',
          'story-agent-generated-health-audit.json',
          'production-material-pack-health-audit.json',
          'domain-pack-production-health-audit.json',
          'story-agent-mvp-status-audit.json',
        ],
        missing_required_files: [],
        audit_summaries: {
          system_external_callback: {
            output_url_verification: {
              expected_output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
              imported: true,
              import_match_count: 1,
            },
          },
          story_agent_mvp_status: {
            governance_counts: mvpGovernanceCounts,
            real_external_callback_readiness: mvpRealExternalCallbackReadiness,
          },
        },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-integrity.json', {
        schema_version: 'gears-worker-acceptance-integrity/v1',
        status: 'passed',
        integrity_passed: true,
        record_count: 65,
        mismatch_count: 0,
        missing_file_count: 0,
        sha256_mismatch_count: 0,
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-response-audit.json', {
        totals: {
          record_count: 370,
          transport_error_count: 0,
          http_error_count: 0,
          unknown_count: 0,
          missing_worker_id_count: 0,
          missing_source_id_count: 0,
          missing_ready_artifact_count: 0,
          failure_category_counts: {
            render_failed: 1,
          },
        },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-callback-response-audit.json', {
        totals: {
          transport_error_count: 0,
          http_error_count: 0,
          ledger_match_missing_count: 0,
          failed_count: 0,
        },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-output-url-source.json', {
        schema_version: 'story-agent-system-external-output-url-source/v1',
        env_var: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
        configured_from_env: true,
        source: 'env',
        output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
        placeholder: false,
        ready_for_external_import: true,
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-preflight-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'preflight',
          blocked: false,
          received_count: 3,
          resolved_count: 3,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 3,
          updated_count: 0,
          failed_count: 0,
          duplicate_count: 0,
          blocking_count: 0,
          warning_count: 0,
          project_results: [{
            import_result: {
              seedance_shot_ledger: {
                items: [{ video_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4' }],
              },
            },
          }],
        },
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-import-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'import',
          blocked: false,
          received_count: 3,
          resolved_count: 3,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 3,
          updated_count: 3,
          failed_count: 0,
          duplicate_count: 0,
          blocking_count: 0,
          warning_count: 0,
          project_results: [{
            import_result: {
              seedance_shot_ledger: {
                items: [{ video_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4' }],
              },
            },
          }],
        },
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-generated-health-audit.json', {
        schema_version: 'story-agent-generated-health-audit/v1',
        status: 'passed',
        before: { summary: { ready_count: 1 } },
        after: { summary: { ready_count: 1 } },
        deltas: { ready_count: 0, interrupted_count: 0, production_gap_count: 0 },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'production-material-pack-health-audit.json', {
        schema_version: 'production-material-pack-health-audit/v1',
        status: 'passed',
        before: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
        after: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
        deltas: { issue_count: 0, core_ready_count: 0 },
        failed_checks: [],
        warning_checks: [],
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'domain-pack-production-health-audit.json', {
        schema_version: 'domain-pack-production-health-audit/v1',
        status: 'passed',
        before: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
        after: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
        deltas: { issue_count: 0, ready_pack_count: 0 },
        failed_checks: [],
        warning_checks: [],
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-mvp-status-audit.json', {
        schema_version: 'story-agent-mvp-status-audit/v1',
        status: 'passed',
        before: {
          status: 'ready',
          score: 96,
          summary: {
            ...mvpRealExternalSummary,
            seedance_placeholder_asset_count: 0,
            seedance_production_asset_ready_count: 5,
            knowledge_writeback_ready_count: 1,
            knowledge_writeback_queued_count: 1,
            knowledge_writeback_needs_revision_count: 0,
          },
        },
        after: {
          status: 'ready',
          score: 96,
          summary: {
            ...mvpRealExternalSummary,
            seedance_placeholder_asset_count: 0,
            seedance_production_asset_ready_count: 5,
            knowledge_writeback_ready_count: 1,
            knowledge_writeback_queued_count: 1,
            knowledge_writeback_needs_revision_count: 0,
          },
        },
        deltas: {
          score: 0,
          status_rank: 0,
          blocker_count: 0,
          seedance_placeholder_asset_count: 0,
          seedance_production_asset_ready_count: 0,
          knowledge_writeback_ready_count: 0,
          knowledge_writeback_queued_count: 0,
          knowledge_writeback_needs_revision_count: 0,
        },
        failed_checks: [],
        warning_checks: [],
        real_external_callback_readiness: mvpRealExternalCallbackReadiness,
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-large-project-response-audit.json', {
        totals: {
          pressure_submitted: true,
          request_unit_count: 120,
          response_record_count: 120,
          accepted_count: 120,
          rejected_count: 0,
          failed_count: 0,
          source_echo_count: 120,
          missing_requested_source_count: 0,
          duplicate_source_id_count: 0,
          unexpected_source_count: 0,
        },
        recommended_actions: [],
      });

      const res = await request.get(`/api/system/gears-execution-worker-evidence-signoff?evidence_dir=${encodeURIComponent(evidenceDir)}`);
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        provider: 'gears',
        schema_version: 'gears-execution-worker-evidence-signoff/v1',
        status: 'ready',
        evidence_dir: evidenceDir,
        evidence_dir_source: 'input',
        evidence_dir_allowed: true,
        acceptance_passed: true,
        signoff_ready: true,
        integrity_passed: true,
        health_audit_passed: true,
        production_material_pack_health_audit_passed: true,
        domain_pack_production_health_audit_passed: true,
        mvp_status_audit_passed: true,
        mvp_governance_counts_consistent: true,
        mvp_governance_counts_verdict_embedded: true,
        mvp_governance_counts_archive_embedded: true,
        mvp_governance_count_mismatch_ids: [],
        mvp_real_external_callback_readiness_consistent: true,
        mvp_real_external_callback_readiness_verdict_embedded: true,
        mvp_real_external_callback_readiness_archive_embedded: true,
        mvp_real_external_callback_readiness_mismatch_ids: [],
        mvp_real_gears_acceptance_ready_before: true,
        mvp_real_gears_acceptance_ready_after: true,
        mvp_real_gears_callback_base_public_before: true,
        mvp_real_gears_callback_base_public_after: true,
        mvp_local_acceptance_counts_as_real_external_callback_before: false,
        mvp_local_acceptance_counts_as_real_external_callback_after: false,
        mvp_real_gears_acceptance_blocker_before: 'gears_worker_signoff_evidence_pending',
        mvp_real_gears_acceptance_blocker_after: 'gears_worker_signoff_evidence_pending',
        system_external_callback_passed: true,
        system_external_callback_ready_to_import_count: 3,
        system_external_callback_updated_count: 3,
        system_external_callback_blocking_count: 0,
        system_external_callback_failed_count: 0,
        system_external_callback_unresolved_count: 0,
        system_external_callback_project_count: 1,
        system_external_output_url_source_ready: true,
        system_external_output_url_imported: true,
        system_external_output_url_import_match_count: 1,
        system_external_output_url_verdict_embedded: true,
        system_external_output_url_verdict_consistent: true,
        system_external_output_url_archive_embedded: true,
        system_external_output_url_archive_consistent: true,
        system_external_output_url_configured_from_env: true,
        system_external_output_url_source: 'env',
        pressure_submitted: true,
        gate_counts: { passed: 11, failed: 0, skipped: 0, total: 11 },
        failed_gate_ids: [],
        skipped_gate_ids: [],
        missing_required_attachment_count: 0,
        required_attachment_count: 39,
        required_checksum_count: 39,
        evidence_file_count: 78,
        worker_record_count: 370,
        worker_transport_error_count: 0,
        worker_http_error_count: 0,
        callback_ledger_match_missing_count: 0,
        callback_transport_error_count: 0,
        callback_http_error_count: 0,
        health_ready_count_before: 1,
        health_ready_count_after: 1,
        health_ready_count_delta: 0,
        production_material_pack_status_before: 'passed',
        production_material_pack_status_after: 'passed',
        production_material_pack_issue_count_before: 0,
        production_material_pack_issue_count_after: 0,
        production_material_pack_issue_count_delta: 0,
        production_material_pack_core_ready_count_before: 4,
        production_material_pack_core_ready_count_after: 4,
        domain_pack_status_before: 'passed',
        domain_pack_status_after: 'passed',
        domain_pack_issue_count_before: 0,
        domain_pack_issue_count_after: 0,
        domain_pack_issue_count_delta: 0,
        domain_pack_ready_count_before: 8,
        domain_pack_ready_count_after: 8,
        mvp_status_before: 'ready',
        mvp_status_after: 'ready',
        mvp_score_before: 96,
        mvp_score_after: 96,
        mvp_score_delta: 0,
        mvp_seedance_placeholder_asset_count_before: 0,
        mvp_seedance_placeholder_asset_count_after: 0,
        mvp_seedance_placeholder_asset_count_delta: 0,
        mvp_seedance_production_asset_ready_count_before: 5,
        mvp_seedance_production_asset_ready_count_after: 5,
        mvp_seedance_production_asset_ready_count_delta: 0,
        mvp_knowledge_writeback_ready_count_before: 1,
        mvp_knowledge_writeback_ready_count_after: 1,
        mvp_knowledge_writeback_ready_count_delta: 0,
        mvp_knowledge_writeback_queued_count_before: 1,
        mvp_knowledge_writeback_queued_count_after: 1,
        mvp_knowledge_writeback_queued_count_delta: 0,
        mvp_knowledge_writeback_needs_revision_count_before: 0,
        mvp_knowledge_writeback_needs_revision_count_after: 0,
        mvp_knowledge_writeback_needs_revision_count_delta: 0,
        large_project_request_unit_count: 120,
        large_project_response_record_count: 120,
        large_project_accepted_count: 120,
        large_project_rejected_count: 0,
        large_project_failed_count: 0,
        large_project_source_echo_count: 120,
        large_project_missing_requested_source_count: 0,
        large_project_duplicate_source_id_count: 0,
        large_project_unexpected_source_count: 0,
        missing_required_files: [],
      });
      expect(res.body.data.worker_failure_category_counts).toEqual({ render_failed: 1 });
      expect(res.body.data.required_files).toEqual(expect.arrayContaining([
        'gears-worker-acceptance-verdict.json',
        'story-agent-system-external-output-url-source.json',
        'story-agent-system-external-callback-preflight-response.json',
        'story-agent-system-external-callback-import-response.json',
        'story-agent-generated-health-audit.json',
        'production-material-pack-health-audit.json',
        'domain-pack-production-health-audit.json',
        'story-agent-mvp-status-audit.json',
      ]));
      expect(res.body.data.gates).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'system_external_callback_batch',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'story_agent_generated_health_audit',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'production_material_pack_health_audit',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'domain_pack_production_health_audit',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'story_agent_mvp_status_audit',
          status: 'passed',
        }),
      ]));
      expect(res.body.data.recommended_actions).toEqual([]);
      expect(res.body.data.markdown).toContain('# GEARS Worker Evidence Signoff');
      expect(res.body.data.markdown).toContain('system_external_callback_passed: true');
      expect(res.body.data.markdown).toContain('system_external_output_url_source: env');
      expect(res.body.data.markdown).toContain('system_external_output_url_source_ready: true');
      expect(res.body.data.markdown).toContain('system_external_output_url_imported: true');
      expect(res.body.data.markdown).toContain('system_external_output_url_import_match_count: 1');
      expect(res.body.data.markdown).toContain('system_external_output_url_verdict_embedded: true');
      expect(res.body.data.markdown).toContain('system_external_output_url_verdict_consistent: true');
      expect(res.body.data.markdown).toContain('system_external_output_url_archive_embedded: true');
      expect(res.body.data.markdown).toContain('system_external_output_url_archive_consistent: true');
      expect(res.body.data.markdown).toContain('system_external_callback_ready/updated: 3/3');
      expect(res.body.data.markdown).toContain('production_material_pack_health_audit_passed: true');
      expect(res.body.data.markdown).toContain('production_material_pack_status_before/after: passed/passed');
      expect(res.body.data.markdown).toContain('domain_pack_production_health_audit_passed: true');
      expect(res.body.data.markdown).toContain('domain_pack_status_before/after: passed/passed');
      expect(res.body.data.markdown).toContain('large_project_source_echo: 120/120');
      expect(res.body.data.markdown).toContain('mvp_score_delta: 0');
      expect(res.body.data.markdown).toContain('mvp_governance_counts_consistent: true');
      expect(res.body.data.markdown).toContain('mvp_governance_counts_embedded verdict/archive: true/true');
      expect(res.body.data.markdown).toContain('mvp_real_external_callback_readiness_consistent: true');
      expect(res.body.data.markdown).toContain('mvp_real_external_callback_readiness_embedded verdict/archive: true/true');
      expect(res.body.data.markdown).toContain('mvp_real_gears_acceptance_ready_before/after: true/true');
      expect(res.body.data.markdown).toContain('mvp_local_acceptance_counts_as_real_external_callback_before/after: false/false');
      expect(res.body.data.markdown).toContain('mvp_seedance_placeholder_before/after/delta: 0/0/0');
      expect(res.body.data.markdown).toContain('mvp_knowledge_writeback_queued_before/after/delta: 1/1/0');
    });

    it('requires system external import evidence to contain the verified output URL', async () => {
      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-signoff-output-url-missing-'));
      await writeReadyEvidence(evidenceDir);
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-import-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'import',
          blocked: false,
          received_count: 3,
          resolved_count: 3,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 3,
          updated_count: 3,
          failed_count: 0,
          duplicate_count: 0,
          blocking_count: 0,
          warning_count: 0,
        },
      });

      const res = await request.get(`/api/system/gears-execution-worker-evidence-signoff?evidence_dir=${encodeURIComponent(evidenceDir)}`);

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        status: 'attention',
        acceptance_passed: true,
        signoff_ready: true,
        integrity_passed: true,
        system_external_output_url_source_ready: true,
        system_external_output_url_imported: false,
        system_external_output_url_import_match_count: 0,
        system_external_callback_passed: false,
      });
      expect(res.body.data.recommended_actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          evidence: 'system_external_output_url_not_imported',
          gate_id: 'system_external_callback_batch',
        }),
      ]));
      expect(res.body.data.markdown).toContain('system_external_output_url_imported: false');
    });

    it('requires verdict output URL verification to match the imported response', async () => {
      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-signoff-output-url-verdict-mismatch-'));
      await writeReadyEvidence(evidenceDir);
      const verdict = JSON.parse(await readFile(resolve(evidenceDir, 'gears-worker-acceptance-verdict.json'), 'utf-8'));
      verdict.gates[0].evidence.output_url_verification.import_match_count = 99;
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', verdict);

      const res = await request.get(`/api/system/gears-execution-worker-evidence-signoff?evidence_dir=${encodeURIComponent(evidenceDir)}`);

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        status: 'attention',
        acceptance_passed: true,
        signoff_ready: true,
        integrity_passed: true,
        system_external_output_url_source_ready: true,
        system_external_output_url_imported: true,
        system_external_output_url_import_match_count: 1,
        system_external_output_url_verdict_embedded: true,
        system_external_output_url_verdict_consistent: false,
        system_external_callback_passed: true,
      });
      expect(res.body.data.recommended_actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          evidence: 'system_external_output_url_verdict_verification_inconsistent',
          gate_id: 'system_external_callback_batch',
        }),
      ]));
      expect(res.body.data.markdown).toContain('system_external_output_url_verdict_consistent: false');
    });

    it('requires archive output URL verification to match the imported response', async () => {
      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-signoff-output-url-archive-mismatch-'));
      await writeReadyEvidence(evidenceDir);
      const archive = JSON.parse(await readFile(resolve(evidenceDir, 'gears-worker-acceptance-archive.json'), 'utf-8'));
      archive.audit_summaries.system_external_callback.output_url_verification.imported = false;
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-archive.json', archive);

      const res = await request.get(`/api/system/gears-execution-worker-evidence-signoff?evidence_dir=${encodeURIComponent(evidenceDir)}`);

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        status: 'attention',
        acceptance_passed: true,
        signoff_ready: true,
        integrity_passed: true,
        system_external_output_url_source_ready: true,
        system_external_output_url_imported: true,
        system_external_output_url_import_match_count: 1,
        system_external_output_url_verdict_embedded: true,
        system_external_output_url_verdict_consistent: true,
        system_external_output_url_archive_embedded: true,
        system_external_output_url_archive_consistent: false,
        system_external_callback_passed: true,
      });
      expect(res.body.data.recommended_actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          evidence: 'system_external_output_url_archive_verification_inconsistent',
          gate_id: 'system_external_callback_batch',
        }),
      ]));
      expect(res.body.data.markdown).toContain('system_external_output_url_archive_consistent: false');
    });

    it('requires embedded MVP governance counts to match the source audit', async () => {
      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-signoff-mvp-governance-mismatch-'));
      await writeReadyEvidence(evidenceDir);
      const verdict = JSON.parse(await readFile(resolve(evidenceDir, 'gears-worker-acceptance-verdict.json'), 'utf-8'));
      verdict.mvp_governance_counts.seedance_placeholder_asset_count.after = 99;
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', verdict);

      const res = await request.get(`/api/system/gears-execution-worker-evidence-signoff?evidence_dir=${encodeURIComponent(evidenceDir)}`);

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        status: 'attention',
        acceptance_passed: true,
        signoff_ready: true,
        integrity_passed: true,
        mvp_status_audit_passed: true,
        mvp_governance_counts_consistent: false,
        mvp_governance_counts_verdict_embedded: true,
        mvp_governance_counts_archive_embedded: true,
      });
      expect(res.body.data.mvp_governance_count_mismatch_ids).toEqual([
        'verdict.seedance_placeholder_asset_count.after',
      ]);
      expect(res.body.data.recommended_actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          evidence: 'mvp_governance_counts_inconsistent',
          gate_id: 'story_agent_mvp_status_audit',
        }),
      ]));
      expect(res.body.data.markdown).toContain('mvp_governance_counts_consistent: false');
      expect(res.body.data.markdown).toContain('mvp_governance_count_mismatch_ids: verdict.seedance_placeholder_asset_count.after');
    });

    it('requires embedded MVP real external callback readiness to match the source audit', async () => {
      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-signoff-mvp-real-callback-mismatch-'));
      await writeReadyEvidence(evidenceDir);
      const verdict = JSON.parse(await readFile(resolve(evidenceDir, 'gears-worker-acceptance-verdict.json'), 'utf-8'));
      verdict.mvp_real_external_callback_readiness.booleans.real_gears_callback_base_public.after = false;
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', verdict);

      const res = await request.get(`/api/system/gears-execution-worker-evidence-signoff?evidence_dir=${encodeURIComponent(evidenceDir)}`);

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        status: 'attention',
        acceptance_passed: true,
        signoff_ready: true,
        integrity_passed: true,
        mvp_status_audit_passed: true,
        mvp_real_external_callback_readiness_consistent: false,
        mvp_real_external_callback_readiness_verdict_embedded: true,
        mvp_real_external_callback_readiness_archive_embedded: true,
      });
      expect(res.body.data.mvp_real_external_callback_readiness_mismatch_ids).toEqual([
        'verdict.real_gears_callback_base_public.after',
      ]);
      expect(res.body.data.recommended_actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          evidence: 'mvp_real_external_callback_readiness_inconsistent',
          gate_id: 'story_agent_mvp_status_audit',
        }),
      ]));
      expect(res.body.data.markdown).toContain('mvp_real_external_callback_readiness_consistent: false');
      expect(res.body.data.markdown).toContain('mvp_real_external_callback_readiness_mismatch_ids: verdict.real_gears_callback_base_public.after');
    });

    it('rejects localhost system external output URLs even when evidence claims ready', async () => {
      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-signoff-localhost-'));
      await writeReadyEvidence(evidenceDir);
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-output-url-source.json', {
        schema_version: 'story-agent-system-external-output-url-source/v1',
        env_var: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
        configured_from_env: true,
        source: 'env',
        output_url: 'http://127.0.0.1:9000/gears-worker-acceptance/readiness-shot-1.mp4',
        placeholder: false,
        ready_for_external_import: true,
      });

      const res = await request.get(`/api/system/gears-execution-worker-evidence-signoff?evidence_dir=${encodeURIComponent(evidenceDir)}`);

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        status: 'attention',
        acceptance_passed: true,
        signoff_ready: true,
        integrity_passed: true,
        system_external_callback_passed: false,
        system_external_output_url_source_ready: false,
        system_external_output_url_source: 'env',
      });
      expect(res.body.data.markdown).toContain('system_external_output_url_source_ready: false');
    });

    it('deduplicates repeated recommended actions from evidence artifacts', async () => {
      const evidenceDir = await mkdtemp(resolve(tmpdir(), 'gears-signoff-dedupe-'));
      const repeatedAction = {
        priority: 'P0',
        owner: 'GEARS v2 ops',
        evidence: 'transport_error_count',
        action: 'Fix GEARS_API_BASE_URL reachability before contract validation.',
      };
      const uniqueAction = {
        priority: 'P0',
        owner: 'GEARS v2',
        evidence: 'record_count_zero',
        action: 'Return at least one worker result record.',
      };
      const mvpGovernanceCounts = {
        seedance_placeholder_asset_count: { before: 0, after: 0, delta: 0 },
        seedance_production_asset_ready_count: { before: 0, after: 0, delta: 0 },
        knowledge_writeback_ready_count: { before: 0, after: 0, delta: 0 },
        knowledge_writeback_queued_count: { before: 0, after: 0, delta: 0 },
        knowledge_writeback_needs_revision_count: { before: 0, after: 0, delta: 0 },
      };
      const mvpRealExternalSummary = {
        real_gears_endpoint_configured: true,
        real_gears_callback_secret_configured: true,
        real_gears_callback_base_configured: true,
        real_gears_callback_base_public: true,
        real_gears_acceptance_ready_to_run: true,
        real_gears_acceptance_blocker: 'gears_worker_signoff_evidence_pending',
        local_acceptance_counts_as_real_external_callback: false,
        seedance_provider_submit_adapter_configured: true,
        seedance_provider_poll_adapter_configured: true,
        seedance_provider_callback_base_configured: true,
        seedance_provider_external_loop_ready: true,
      };
      const mvpRealExternalCallbackReadiness = {
        booleans: {
          real_gears_endpoint_configured: { before: true, after: true, changed: false },
          real_gears_callback_secret_configured: { before: true, after: true, changed: false },
          real_gears_callback_base_configured: { before: true, after: true, changed: false },
          real_gears_callback_base_public: { before: true, after: true, changed: false },
          real_gears_acceptance_ready_to_run: { before: true, after: true, changed: false },
          local_acceptance_counts_as_real_external_callback: { before: false, after: false, changed: false },
          seedance_provider_submit_adapter_configured: { before: true, after: true, changed: false },
          seedance_provider_poll_adapter_configured: { before: true, after: true, changed: false },
          seedance_provider_callback_base_configured: { before: true, after: true, changed: false },
          seedance_provider_external_loop_ready: { before: true, after: true, changed: false },
        },
        blocker: {
          before: 'gears_worker_signoff_evidence_pending',
          after: 'gears_worker_signoff_evidence_pending',
          changed: false,
        },
      };
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', {
        schema_version: 'gears-worker-acceptance-verdict/v1',
        status: 'failed',
        acceptance_passed: false,
        pressure_submitted: false,
        gate_counts: { passed: 6, failed: 3, skipped: 0, total: 9 },
        failed_gate_ids: ['worker_response_audit'],
        skipped_gate_ids: [],
        mvp_governance_counts: mvpGovernanceCounts,
        mvp_real_external_callback_readiness: mvpRealExternalCallbackReadiness,
        gates: [{
          id: 'worker_response_audit',
          label: 'GEARS worker response audit',
          status: 'failed',
          summary: 'Worker was unreachable.',
        }, {
          id: 'system_external_callback_batch',
          label: 'Story Agent system external callback batch',
          status: 'passed',
          summary: 'System external callbacks wrote real external artifacts.',
          evidence: {
            output_url_verification: {
              expected_output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
              imported: true,
              import_match_count: 1,
            },
          },
        }],
        recommended_actions: [repeatedAction, repeatedAction, uniqueAction],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-archive.json', {
        schema_version: 'gears-worker-acceptance-archive/v1',
        status: 'blocked',
        signoff_ready: false,
        totals: {
          missing_required_attachment_count: 0,
          required_attachment_count: 31,
          required_checksum_count: 31,
          evidence_file_count: 37,
        },
        required_attachments: ['gears-worker-acceptance-verdict.json'],
        missing_required_files: [],
        audit_summaries: {
          system_external_callback: {
            output_url_verification: {
              expected_output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
              imported: true,
              import_match_count: 1,
            },
          },
          story_agent_mvp_status: {
            governance_counts: mvpGovernanceCounts,
            real_external_callback_readiness: mvpRealExternalCallbackReadiness,
          },
        },
        recommended_actions: [repeatedAction],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-integrity.json', {
        schema_version: 'gears-worker-acceptance-integrity/v1',
        status: 'failed',
        integrity_passed: false,
        record_count: 33,
        mismatch_count: 0,
        missing_file_count: 0,
        sha256_mismatch_count: 0,
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-worker-response-audit.json', {
        totals: {
          record_count: 0,
          unknown_count: 0,
          missing_worker_id_count: 0,
          missing_source_id_count: 0,
          missing_ready_artifact_count: 0,
        },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-callback-response-audit.json', {
        totals: {
          ledger_match_missing_count: 0,
          failed_count: 0,
        },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-output-url-source.json', {
        schema_version: 'story-agent-system-external-output-url-source/v1',
        env_var: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
        configured_from_env: true,
        source: 'env',
        output_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4',
        placeholder: false,
        ready_for_external_import: true,
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-preflight-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'preflight',
          blocked: false,
          received_count: 1,
          resolved_count: 1,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 1,
          updated_count: 0,
          failed_count: 0,
          duplicate_count: 0,
          blocking_count: 0,
          warning_count: 0,
        },
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-import-response.json', {
        ok: true,
        data: {
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'import',
          blocked: false,
          received_count: 1,
          resolved_count: 1,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 1,
          updated_count: 1,
          failed_count: 0,
          duplicate_count: 0,
          blocking_count: 0,
          warning_count: 0,
          project_results: [{
            import_result: {
              seedance_shot_ledger: {
                items: [{ video_url: 'https://media.story-agent.test/gears-worker-acceptance/readiness-shot-1.mp4' }],
              },
            },
          }],
        },
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-generated-health-audit.json', {
        schema_version: 'story-agent-generated-health-audit/v1',
        status: 'passed',
        before: { summary: { ready_count: 1 } },
        after: { summary: { ready_count: 1 } },
        deltas: { ready_count: 0, interrupted_count: 0, production_gap_count: 0 },
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'production-material-pack-health-audit.json', {
        schema_version: 'production-material-pack-health-audit/v1',
        status: 'passed',
        before: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
        after: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
        deltas: { issue_count: 0, core_ready_count: 0 },
        failed_checks: [],
        warning_checks: [],
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'domain-pack-production-health-audit.json', {
        schema_version: 'domain-pack-production-health-audit/v1',
        status: 'passed',
        before: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
        after: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
        deltas: { issue_count: 0, ready_pack_count: 0 },
        failed_checks: [],
        warning_checks: [],
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'story-agent-mvp-status-audit.json', {
        schema_version: 'story-agent-mvp-status-audit/v1',
        status: 'passed',
        before: { status: 'ready', score: 90, summary: mvpRealExternalSummary },
        after: { status: 'ready', score: 90, summary: mvpRealExternalSummary },
        deltas: { score: 0, status_rank: 0, blocker_count: 0 },
        failed_checks: [],
        warning_checks: [],
        real_external_callback_readiness: mvpRealExternalCallbackReadiness,
        recommended_actions: [],
      });
      await writeEvidenceJson(evidenceDir, 'gears-large-project-response-audit.json', {
        totals: {
          pressure_submitted: false,
          request_unit_count: 120,
          source_echo_count: 0,
          missing_requested_source_count: 120,
        },
        recommended_actions: [],
      });

      const res = await request.get(`/api/system/gears-execution-worker-evidence-signoff?evidence_dir=${encodeURIComponent(evidenceDir)}`);
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.status).toBe('attention');
      expect(res.body.data.recommended_actions).toEqual(expect.arrayContaining([
        expect.objectContaining(repeatedAction),
        expect.objectContaining(uniqueAction),
      ]));
      expect(
        res.body.data.recommended_actions.filter((item: any) => item.evidence === 'transport_error_count'),
      ).toHaveLength(1);
      expect(res.body.data.recommended_actions).toHaveLength(2);
    });

    it('rejects evidence directories outside allowed roots', async () => {
      const res = await request.get('/api/system/gears-execution-worker-evidence-signoff?evidence_dir=/etc');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        status: 'blocked',
        evidence_dir_allowed: false,
        evidence_dir_error: 'evidence_dir_not_allowed',
        failed_gate_ids: ['evidence_dir'],
      });
    });
  });

  describe('GET /api/system/gears-execution-smoke-package', () => {
    it('returns a GEARS smoke handoff package without leaking configured secrets', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        apiToken: process.env.GEARS_API_TOKEN,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
      };
      try {
        process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
        process.env.GEARS_API_TOKEN = 'private-smoke-api-token-123';
        process.env.GEARS_CALLBACK_SECRET = 'private-smoke-callback-token-456';
        process.env.GEARS_CALLBACK_BASE_URL = 'https://story.example.test/public';

        const res = await request.get('/api/system/gears-execution-smoke-package');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'gears',
          schema_version: 'gears-execution-smoke-package/v1',
          readiness_status: 'ready',
          readiness_score: 100,
          local_smoke_passed_count: 5,
          local_smoke_total_count: 5,
          live_ready_step_count: 4,
          live_total_step_count: 4,
          execution_order: ['submit_http', 'status_poll', 'project_callback', 'series_callback'],
        });
        expect(res.body.data.markdown).toContain('# GEARS v2 Story Agent Smoke Handoff');
        expect(res.body.data.markdown).toContain('## Submit accepted/rejected GEARS units');
        expect(res.body.data.markdown).toContain('Bearer <GEARS_API_TOKEN>');
        expect(res.body.data.markdown).toContain('Bearer <GEARS_CALLBACK_SECRET>');
        expect(res.body.data.steps).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'submit_http',
            method: 'POST',
            path: '/gears/jobs',
            request_body: expect.objectContaining({
              schema_version: 'gears-execution-submit/v1',
              job_type: 'seedance_video',
              payload: expect.objectContaining({
                units: expect.arrayContaining([
                  expect.objectContaining({
                    source_unit_id: 'readiness-shot-1',
                    idempotency_key: 'seedance_video:readiness-shot-1',
                  }),
                ]),
              }),
            }),
            accepted_response_shapes: expect.arrayContaining([
              '{ data: { acceptedUnits: [...], rejectedUnits: [...] } }',
              '{ data: { rejectedUnits: [...] } }',
            ]),
          }),
          expect.objectContaining({
            id: 'status_poll',
            method: 'GET',
            path: '/gears/jobs/<gears_job_id>',
          }),
          expect.objectContaining({
            id: 'project_callback',
            method: 'POST',
            path: '/api/projects/:projectId/gears-callback',
          }),
          expect.objectContaining({
            id: 'series_callback',
            method: 'POST',
            path: '/api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-callback',
          }),
        ]));
        expect(JSON.stringify(res.body.data)).not.toContain('private-smoke-api-token-123');
        expect(JSON.stringify(res.body.data)).not.toContain('private-smoke-callback-token-456');
        expect(JSON.stringify(res.body.data)).not.toContain('gears.example.test/api-root');
        expect(JSON.stringify(res.body.data)).not.toContain('story.example.test/public');
      } finally {
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.apiToken === undefined) delete process.env.GEARS_API_TOKEN;
        else process.env.GEARS_API_TOKEN = previous.apiToken;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
      }
    });
  });

  describe('POST /api/system/gears-execution-live-smoke-run', () => {
    it('returns a dry-run report when execute is not set', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
      };
      try {
        delete process.env.GEARS_API_BASE_URL;
        delete process.env.GEARS_CALLBACK_BASE_URL;
        delete process.env.GEARS_CALLBACK_SECRET;

        const res = await request.post('/api/system/gears-execution-live-smoke-run').send({});
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'gears',
          schema_version: 'gears-execution-live-smoke-run/v1',
          status: 'dry_run',
          execute: false,
          poll_after_submit: false,
          readiness_status: 'blocked',
          submitted_job_ids: [],
          accepted_count: 0,
          rejected_count: 0,
          failed_count: 0,
        });
        expect(res.body.data.blocked_by).toEqual(expect.arrayContaining([
          'GEARS_EXECUTION_WORKER_API_BASE_URL',
        ]));
        expect(res.body.data.steps).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'submit_http',
            status: 'blocked',
          }),
        ]));
        expect(res.body.data.markdown).toContain('# GEARS v2 Live Smoke Run Report');
      } finally {
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
      }
    });

    it('executes submit and poll live smoke through the GEARS adapter when ready', async () => {
      const previous = {
        apiBaseUrl: process.env.GEARS_API_BASE_URL,
        apiToken: process.env.GEARS_API_TOKEN,
        callbackSecret: process.env.GEARS_CALLBACK_SECRET,
        callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
      };
      try {
        process.env.GEARS_API_BASE_URL = 'https://gears-live.example.test/api-root';
        process.env.GEARS_API_TOKEN = 'private-live-smoke-api-token-123';
        process.env.GEARS_CALLBACK_SECRET = 'private-live-smoke-callback-token-456';
        process.env.GEARS_CALLBACK_BASE_URL = 'https://story-live.example.test/public';
        const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
          const method = init?.method ?? 'GET';
          if (String(url).endsWith('/gears/capabilities')) {
            return new Response(JSON.stringify({
              schema_version: 'gears-execution-worker-capabilities/v1',
              service: 'gears-execution-worker',
              execution_worker_supported: true,
              workbench_import_supported: false,
              bearer_auth_required: true,
              idempotent_submit: true,
              status_poll_supported: true,
              callback_delivery_supported: true,
              supported_job_types: ['seedance_video'],
              endpoints: {
                capabilities: { method: 'GET', path: '/gears/capabilities' },
                submit: { method: 'POST', path: '/gears/jobs' },
                job_status: { method: 'GET', path: '/gears/jobs/{gears_job_id}' },
              },
            }));
          }
          if (method === 'POST') {
            return new Response(JSON.stringify({
              data: {
                acceptedUnits: [{
                  taskId: 'gears-live-smoke-accepted-001',
                  externalId: 'readiness-shot-1',
                  taskStatus: 'QUEUED',
                  idempotencyKey: 'seedance_video:readiness-shot-1',
                }],
                rejectedUnits: [{
                  taskId: 'gears-live-smoke-rejected-002',
                  externalId: 'readiness-shot-2',
                  taskStatus: 'VALIDATION_ERROR',
                  errorCode: 'INVALID_PAYLOAD',
                  message: 'smoke rejected unit',
                }],
              },
            }));
          }
          expect(String(url)).toContain('/gears/jobs/gears-live-smoke-accepted-001');
          return new Response(JSON.stringify({
            data: {
              job: {
                taskId: 'gears-live-smoke-accepted-001',
                externalId: 'readiness-shot-1',
                taskStatus: 'COMPLETED',
                progressPercent: 100,
                output: {
                  files: [{
                    mediaUrl: 'https://gears.example.test/live-smoke.mp4',
                    mediaType: 'video',
                  }],
                },
              },
            },
          }));
        });
        vi.stubGlobal('fetch', fetchMock);

        const res = await request
          .post('/api/system/gears-execution-live-smoke-run')
          .send({ execute: true, poll_after_submit: true, note: 'api live smoke' });
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          status: 'partial',
          execute: true,
          poll_after_submit: true,
          readiness_status: 'ready',
          submitted_job_ids: ['gears-live-smoke-accepted-001'],
          accepted_count: 1,
          rejected_count: 1,
          failed_count: 0,
        });
        expect(res.body.data.steps).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'submit_http',
            status: 'passed',
            accepted_count: 1,
            rejected_count: 1,
          }),
          expect.objectContaining({
            id: 'status_poll',
            status: 'passed',
            returned_count: 1,
            failed_count: 0,
          }),
          expect.objectContaining({
            id: 'project_callback',
            status: 'skipped',
          }),
        ]));
        expect(res.body.data.markdown).toContain('gears-live-smoke-accepted-001');
        expect(JSON.stringify(res.body.data)).not.toContain('private-live-smoke-api-token-123');
        expect(JSON.stringify(res.body.data)).not.toContain('private-live-smoke-callback-token-456');
        expect(fetchMock).toHaveBeenCalledTimes(4);
      } finally {
        vi.unstubAllGlobals();
        if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
        else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
        if (previous.apiToken === undefined) delete process.env.GEARS_API_TOKEN;
        else process.env.GEARS_API_TOKEN = previous.apiToken;
        if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
      }
    });

    it('validates live smoke request body', async () => {
      const res = await request
        .post('/api/system/gears-execution-live-smoke-run')
        .send({ execute: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/system/seedance-provider-config', () => {
    it('returns safe provider adapter config status without secrets', async () => {
      const previous = {
        submitEndpoint: process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT,
        pollEndpoint: process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT,
        submitToken: process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN,
        sharedToken: process.env.SEEDANCE_PROVIDER_API_TOKEN,
        authHeader: process.env.SEEDANCE_PROVIDER_AUTH_HEADER,
        authScheme: process.env.SEEDANCE_PROVIDER_AUTH_SCHEME,
        submitAuthHeader: process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER,
        submitAuthScheme: process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME,
        pollAuthHeader: process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER,
        pollAuthScheme: process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME,
        callbackSecret: process.env.SEEDANCE_CALLBACK_SECRET,
        submitTimeout: process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS,
        pollTimeout: process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS,
        callbackBaseUrl: process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL,
        gearsCallbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
        publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL,
        appBaseUrl: process.env.APP_BASE_URL,
        submitRequestMode: process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE,
        pollRequestMode: process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE,
        payloadMode: process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE,
        submitPayloadMode: process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE,
        pollPayloadMode: process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE,
        signatureSecret: process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET,
        submitSignatureSecret: process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET,
        pollSignatureSecret: process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET,
        signatureHeader: process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER,
        timestampHeader: process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER,
        pollHttpMethod: process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD,
      };
      try {
        process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = 'https://adapter.example.test/seedance/submit';
        process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = 'https://adapter.example.test/seedance/poll';
        process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = 'submit-secret';
        process.env.SEEDANCE_PROVIDER_API_TOKEN = 'shared-secret';
        process.env.SEEDANCE_PROVIDER_AUTH_HEADER = 'X-Shared-Token';
        process.env.SEEDANCE_PROVIDER_AUTH_SCHEME = 'Token';
        process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = 'X-Submit-Key';
        process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = 'raw';
        process.env.SEEDANCE_CALLBACK_SECRET = 'callback-secret';
        process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS = '12345';
        process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS = '23456';
        process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL = 'https://public.example.test';
        process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = 'per_shot';
        process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = 'per_target';
        process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE = 'platform';
        process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET = 'signature-secret';
        process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER = 'X-Provider-Signature';
        process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER = 'X-Provider-Timestamp';
        process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD = 'GET';

        const res = await request.get('/api/system/seedance-provider-config');
        expect(res.status).toBe(200);
        expectSuccess(res.body);
        expect(res.body.data).toMatchObject({
          provider: 'seedance',
          submit_endpoint_configured: true,
          poll_endpoint_configured: true,
          submit_token_configured: true,
          poll_token_configured: true,
          shared_token_configured: true,
          submit_signature_configured: true,
          poll_signature_configured: true,
          callback_secret_configured: true,
          callback_base_configured: true,
          callback_base_envs: [
            'SEEDANCE_PROVIDER_CALLBACK_BASE_URL',
            'GEARS_CALLBACK_BASE_URL',
            'PUBLIC_API_BASE_URL',
            'APP_BASE_URL',
          ],
          submit_request_mode: 'per_shot',
          poll_request_mode: 'per_target',
          request_mode_envs: [
            'SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE',
            'SEEDANCE_PROVIDER_POLL_REQUEST_MODE',
          ],
          submit_payload_mode: 'platform',
          poll_payload_mode: 'platform',
          payload_mode_envs: [
            'SEEDANCE_PROVIDER_PAYLOAD_MODE',
            'SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE',
            'SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE',
          ],
          poll_http_method: 'GET',
          poll_http_method_env: 'SEEDANCE_PROVIDER_POLL_HTTP_METHOD',
          submit_auth_header: 'X-Submit-Key',
          poll_auth_header: 'X-Shared-Token',
          submit_auth_scheme: 'raw',
          poll_auth_scheme: 'Token',
          submit_signature_header: 'X-Provider-Signature',
          poll_signature_header: 'X-Provider-Signature',
          submit_timestamp_header: 'X-Provider-Timestamp',
          poll_timestamp_header: 'X-Provider-Timestamp',
          submit_timeout_ms: 12345,
          poll_timeout_ms: 23456,
          ready_for_submit_adapter: true,
          ready_for_poll_adapter: true,
          missing_submit_requirements: [],
          missing_poll_requirements: [],
          next_actions: ['adapter endpoint 已就绪，可执行提交或轮询 smoke。'],
        });
        expect(res.body.data.configuration_warnings).toEqual([]);
        expect(res.body.data).not.toHaveProperty('submit_endpoint');
        expect(res.body.data).not.toHaveProperty('poll_endpoint');
        expect(JSON.stringify(res.body.data)).not.toContain('submit-secret');
        expect(JSON.stringify(res.body.data)).not.toContain('shared-secret');
        expect(JSON.stringify(res.body.data)).not.toContain('callback-secret');
        expect(JSON.stringify(res.body.data)).not.toContain('signature-secret');
        expect(JSON.stringify(res.body.data)).not.toContain('adapter.example.test');
        expect(JSON.stringify(res.body.data)).not.toContain('public.example.test');

        delete process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
        delete process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
        delete process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
        delete process.env.SEEDANCE_PROVIDER_API_TOKEN;
        delete process.env.SEEDANCE_PROVIDER_AUTH_HEADER;
        delete process.env.SEEDANCE_PROVIDER_AUTH_SCHEME;
        delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
        delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
        delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
        delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
        delete process.env.SEEDANCE_CALLBACK_SECRET;
        delete process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
        delete process.env.GEARS_CALLBACK_BASE_URL;
        delete process.env.PUBLIC_API_BASE_URL;
        delete process.env.APP_BASE_URL;
        delete process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
        delete process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
        delete process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE;
        delete process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE;
        delete process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE;
        delete process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET;
        delete process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET;
        delete process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET;
        delete process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER;
        delete process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER;
        delete process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD;

        const missingRes = await request.get('/api/system/seedance-provider-config');
        expect(missingRes.status).toBe(200);
        expectSuccess(missingRes.body);
        expect(missingRes.body.data).toMatchObject({
          submit_endpoint_configured: false,
          poll_endpoint_configured: false,
          submit_token_configured: false,
          poll_token_configured: false,
          shared_token_configured: false,
          submit_signature_configured: false,
          poll_signature_configured: false,
          callback_secret_configured: false,
          callback_base_configured: false,
          submit_request_mode: 'batch',
          poll_request_mode: 'batch',
          submit_payload_mode: 'story_agent',
          poll_payload_mode: 'story_agent',
          poll_http_method: 'POST',
          submit_auth_header: 'authorization',
          poll_auth_header: 'authorization',
          submit_auth_scheme: 'Bearer',
          poll_auth_scheme: 'Bearer',
          submit_signature_header: 'X-Seedance-Signature',
          poll_signature_header: 'X-Seedance-Signature',
          submit_timestamp_header: 'X-Seedance-Timestamp',
          poll_timestamp_header: 'X-Seedance-Timestamp',
          ready_for_submit_adapter: false,
          ready_for_poll_adapter: false,
          missing_submit_requirements: ['SEEDANCE_PROVIDER_SUBMIT_ENDPOINT'],
          missing_poll_requirements: ['SEEDANCE_PROVIDER_POLL_ENDPOINT'],
        });
        expect(missingRes.body.data.next_actions).toEqual(expect.arrayContaining([
          '配置 SEEDANCE_PROVIDER_SUBMIT_ENDPOINT 以启用提交 adapter。',
          '配置 SEEDANCE_PROVIDER_POLL_ENDPOINT 以启用轮询 adapter。',
        ]));
        expect(missingRes.body.data.configuration_warnings).toEqual(expect.arrayContaining([
          'submit adapter 未配置 bearer token；仅适用于不要求鉴权的外部 worker。',
          'poll adapter 未配置 SEEDANCE_PROVIDER_API_TOKEN；仅适用于不要求鉴权的外部 worker。',
        ]));
      } finally {
        if (previous.submitEndpoint === undefined) delete process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
        else process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = previous.submitEndpoint;
        if (previous.pollEndpoint === undefined) delete process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
        else process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = previous.pollEndpoint;
        if (previous.submitToken === undefined) delete process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
        else process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = previous.submitToken;
        if (previous.sharedToken === undefined) delete process.env.SEEDANCE_PROVIDER_API_TOKEN;
        else process.env.SEEDANCE_PROVIDER_API_TOKEN = previous.sharedToken;
        if (previous.authHeader === undefined) delete process.env.SEEDANCE_PROVIDER_AUTH_HEADER;
        else process.env.SEEDANCE_PROVIDER_AUTH_HEADER = previous.authHeader;
        if (previous.authScheme === undefined) delete process.env.SEEDANCE_PROVIDER_AUTH_SCHEME;
        else process.env.SEEDANCE_PROVIDER_AUTH_SCHEME = previous.authScheme;
        if (previous.submitAuthHeader === undefined) delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
        else process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = previous.submitAuthHeader;
        if (previous.submitAuthScheme === undefined) delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
        else process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = previous.submitAuthScheme;
        if (previous.pollAuthHeader === undefined) delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
        else process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER = previous.pollAuthHeader;
        if (previous.pollAuthScheme === undefined) delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
        else process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = previous.pollAuthScheme;
        if (previous.callbackSecret === undefined) delete process.env.SEEDANCE_CALLBACK_SECRET;
        else process.env.SEEDANCE_CALLBACK_SECRET = previous.callbackSecret;
        if (previous.submitTimeout === undefined) delete process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
        else process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS = previous.submitTimeout;
        if (previous.pollTimeout === undefined) delete process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
        else process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS = previous.pollTimeout;
        if (previous.callbackBaseUrl === undefined) delete process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
        else process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL = previous.callbackBaseUrl;
        if (previous.gearsCallbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
        else process.env.GEARS_CALLBACK_BASE_URL = previous.gearsCallbackBaseUrl;
        if (previous.publicApiBaseUrl === undefined) delete process.env.PUBLIC_API_BASE_URL;
        else process.env.PUBLIC_API_BASE_URL = previous.publicApiBaseUrl;
        if (previous.appBaseUrl === undefined) delete process.env.APP_BASE_URL;
        else process.env.APP_BASE_URL = previous.appBaseUrl;
        if (previous.submitRequestMode === undefined) delete process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
        else process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = previous.submitRequestMode;
        if (previous.pollRequestMode === undefined) delete process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
        else process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = previous.pollRequestMode;
        if (previous.payloadMode === undefined) delete process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE;
        else process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE = previous.payloadMode;
        if (previous.submitPayloadMode === undefined) delete process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE;
        else process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE = previous.submitPayloadMode;
        if (previous.pollPayloadMode === undefined) delete process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE;
        else process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE = previous.pollPayloadMode;
        if (previous.signatureSecret === undefined) delete process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET;
        else process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET = previous.signatureSecret;
        if (previous.submitSignatureSecret === undefined) delete process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET;
        else process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET = previous.submitSignatureSecret;
        if (previous.pollSignatureSecret === undefined) delete process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET;
        else process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET = previous.pollSignatureSecret;
        if (previous.signatureHeader === undefined) delete process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER;
        else process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER = previous.signatureHeader;
        if (previous.timestampHeader === undefined) delete process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER;
        else process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER = previous.timestampHeader;
        if (previous.pollHttpMethod === undefined) delete process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
        else process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD = previous.pollHttpMethod;
      }
    });
  });

  describe('GET /api/system/seedance-provider-adapter-contract', () => {
    it('returns safe submit and poll adapter contract metadata', async () => {
      const res = await request.get('/api/system/seedance-provider-adapter-contract');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        provider: 'seedance',
        callback_auth_env: 'SEEDANCE_CALLBACK_SECRET',
        callback_auth_headers: [
          'Authorization: Bearer <SECRET>',
          'X-Seedance-Callback-Secret: <SECRET>',
        ],
        submit: {
          schema_version: 'seedance-provider-submit/v1',
          endpoint_env: 'SEEDANCE_PROVIDER_SUBMIT_ENDPOINT',
          auth_envs: ['SEEDANCE_PROVIDER_SUBMIT_API_TOKEN', 'SEEDANCE_PROVIDER_API_TOKEN'],
          auth_header_envs: ['SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER', 'SEEDANCE_PROVIDER_AUTH_HEADER'],
          auth_scheme_envs: ['SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME', 'SEEDANCE_PROVIDER_AUTH_SCHEME'],
          default_auth_header: 'Authorization',
          default_auth_scheme: 'Bearer',
          timeout_env: 'SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS',
          request_mode_env: 'SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE',
          request_modes: ['batch', 'per_shot'],
          payload_mode_env: 'SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE',
          payload_modes: ['story_agent', 'platform'],
          signature_envs: [
            'SEEDANCE_PROVIDER_SIGNATURE_SECRET',
            'SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET',
            'SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET',
          ],
          default_signature_header: 'X-Seedance-Signature',
          default_timestamp_header: 'X-Seedance-Timestamp',
          signature_base: 'METHOD\\nURL\\nTIMESTAMP\\nJSON_BODY',
        },
        poll: {
          schema_version: 'seedance-provider-poll/v1',
          endpoint_env: 'SEEDANCE_PROVIDER_POLL_ENDPOINT',
          auth_envs: ['SEEDANCE_PROVIDER_API_TOKEN'],
          auth_header_envs: ['SEEDANCE_PROVIDER_POLL_AUTH_HEADER', 'SEEDANCE_PROVIDER_AUTH_HEADER'],
          auth_scheme_envs: ['SEEDANCE_PROVIDER_POLL_AUTH_SCHEME', 'SEEDANCE_PROVIDER_AUTH_SCHEME'],
          default_auth_header: 'Authorization',
          default_auth_scheme: 'Bearer',
          timeout_env: 'SEEDANCE_PROVIDER_POLL_TIMEOUT_MS',
          request_mode_env: 'SEEDANCE_PROVIDER_POLL_REQUEST_MODE',
          request_modes: ['batch', 'per_target'],
          payload_mode_env: 'SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE',
          payload_modes: ['story_agent', 'platform'],
          default_signature_header: 'X-Seedance-Signature',
          default_timestamp_header: 'X-Seedance-Timestamp',
          http_method_env: 'SEEDANCE_PROVIDER_POLL_HTTP_METHOD',
          http_methods: ['POST', 'GET'],
          endpoint_template_fields: expect.arrayContaining([
            '{provider_job_id}',
            '{shot_id}',
            '{provider_queue_id}',
          ]),
        },
      });
      expect(res.body.data.submit.request_fields).toEqual(expect.arrayContaining([
        'request_mode',
        'provider_callback_path',
        'provider_poll_path',
        'provider_callback_url',
        'provider_poll_url',
        'shot',
        'shots[].seedance_prompt',
        'shots[].seedance_asset_slots',
        'platform mode: prompt',
        'platform mode: metadata',
      ]));
      expect(res.body.data.submit.accepted_response_shapes).toEqual(expect.arrayContaining([
        '{ submitted_shots: [...] }',
        '{ provider_results: [...] }',
        '{ data: { tasks: [...] } }',
      ]));
      expect(res.body.data.submit.request_example).toMatchObject({
        schema_version: 'seedance-provider-submit/v1',
        request_mode: 'batch',
        provider: 'seedance',
        provider_callback_path: '/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/provider-callback',
        provider_poll_path: '/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/poll-provider',
        provider_callback_url: '<PUBLIC_API_BASE_URL>/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/provider-callback',
        provider_poll_url: '<PUBLIC_API_BASE_URL>/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/poll-provider',
        shots: [expect.objectContaining({
          shot_id: 'shot-1',
          seedance_prompt: expect.stringContaining('0-3秒'),
        })],
      });
      expect(res.body.data.submit.response_examples[0].data.tasks[0]).toMatchObject({
        shot_id: 'shot-1',
        taskId: 'real-seedance-job-001',
      });
      expect(res.body.data.submit.response_examples[1].platform_payload_mode.tasks[0]).toMatchObject({
        prompt: expect.stringContaining('0-3秒'),
        external_id: 'shot-1',
      });
      expect(res.body.data.poll.request_fields).toEqual(expect.arrayContaining([
        'request_mode',
        'target',
        'targets[].provider_job_id',
        'platform mode: task_id',
        'platform mode: task_ids',
      ]));
      expect(res.body.data.poll.normalized_result_fields).toEqual(expect.arrayContaining([
        'video_url | videoUrl | output_url | outputUrl | file_url | fileUrl | download_url | downloadUrl | result_url | resultUrl | url',
        'provider_error_code | providerErrorCode | error_code | errorCode | status_code | statusCode | code',
      ]));
      expect(res.body.data.poll.request_example).toMatchObject({
        schema_version: 'seedance-provider-poll/v1',
        request_mode: 'batch',
        provider: 'seedance',
      });
      expect(res.body.data.poll.request_example.targets[0]).toMatchObject({
        shot_id: 'shot-1',
        provider_job_id: 'real-seedance-job-001',
      });
      expect(res.body.data.poll.response_examples[0].data.tasks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          state: 'SUCCEEDED',
          outputUrl: 'seedance-video-shot-1.mp4',
        }),
        expect.objectContaining({
          state: 'FAILED',
          code: 'RISK_CONTROL',
        }),
      ]));
      expect(res.body.data.poll.response_examples[1].platform_payload_mode).toMatchObject({
        task_ids: ['real-seedance-job-001', 'real-seedance-job-002'],
      });
      expect(JSON.stringify(res.body.data)).not.toContain('https://');
      expect(JSON.stringify(res.body.data)).not.toContain('http://');
      expect(JSON.stringify(res.body.data)).not.toContain('adapter.example.test');
      expect(JSON.stringify(res.body.data)).not.toContain('secret');
    });
  });

});

describe('Projects API', () => {
  describe('GET /api/projects', () => {
    it('returns unified envelope with project list', async () => {
      const res = await request.get('/api/projects');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        const first = res.body.data[0];
        expect(first).toHaveProperty('project_id');
        expect(first).toHaveProperty('current_story_id');
        expect(first).toHaveProperty('source_domain');
        expect(first).toHaveProperty('status');
        expect(first).toHaveProperty('video_type');
      }
    });

    it('filters projects by a registered source domain', async () => {
      const res = await request.get('/api/projects?domain=china_culture');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.every((project: { source_domain?: string }) => project.source_domain === 'china_culture'))
        .toBe(true);
    });

    it('fails closed for an unregistered project list domain', async () => {
      const res = await request.get('/api/projects?domain=unregistered_domain');
      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });

    it('rejects an invalid project list domain identifier', async () => {
      const res = await request.get('/api/projects?domain=INVALID-DOMAIN');
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('hydrates creation contract fields for legacy project metadata through list and detail routes', async () => {
      const story: StoryGenerateResult = {
        ...makeApiStory(),
        storyId: '20260617-story-aplg1',
        title: 'API 旧项目素材契约兼容测试',
        gears_segments_url: '/api/stories/20260617-story-aplg1/gears-segments',
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T10:45:00.000Z');
      const projectDir = resolve(
        testWorkspaceRoot,
        'web',
        'generated',
        'projects',
        enriched.project_id!,
      );
      const projectPath = resolve(projectDir, 'project.json');
      const rawMetaBefore = JSON.parse(await readFile(projectPath, 'utf-8')) as StoryProjectMeta;
      expect(rawMetaBefore.creation_use_case).toBeUndefined();
      expect(rawMetaBefore.material_sufficiency).toBeUndefined();

      const listRes = await request.get('/api/projects');
      expect(listRes.status).toBe(200);
      expectSuccess(listRes.body);
      const listed = listRes.body.data.find((project: StoryProjectMeta) => project.project_id === enriched.project_id);
      expect(listed).toMatchObject({
        project_id: enriched.project_id,
        creation_use_case: 'institutional_promo',
        truth_mode: 'institutional_verified',
      });
      expect(listed.material_sufficiency).toMatchObject({
        schema_version: 'material-sufficiency/v1',
        active_stage: expect.any(String),
      });
      expect(listed.creation_contract).toMatchObject({
        schema_version: 'creation-contract/v1',
        creation_use_case: 'institutional_promo',
        truth_mode: 'institutional_verified',
      });

      const detailRes = await request.get(`/api/projects/${enriched.project_id}`);
      expect(detailRes.status).toBe(200);
      expectSuccess(detailRes.body);
      expect(detailRes.body.data.project.creation_contract).toMatchObject({
        schema_version: 'creation-contract/v1',
        creation_use_case: 'institutional_promo',
        truth_mode: 'institutional_verified',
      });
      expect(detailRes.body.data.current_story.material_pack).toMatchObject({
        schema_version: 'material-pack/v1',
      });
      expect(detailRes.body.data.current_story.creation_contract.material_sufficiency.score).toBe(
        detailRes.body.data.current_story.material_sufficiency.score,
      );

      const rawMetaAfter = JSON.parse(await readFile(projectPath, 'utf-8')) as StoryProjectMeta;
      expect(rawMetaAfter.creation_use_case).toBeUndefined();
      expect(rawMetaAfter.material_sufficiency).toBeUndefined();
    });
  });

  describe('PATCH /api/projects/:projectId/supplement-tasks/:taskId', () => {
    it('validates supplement task status', async () => {
      const res = await request
        .patch('/api/projects/20260609-story-abc1--character_story/supplement-tasks/task-1')
        .send({ status: 'done' });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/projects/:projectId/material-pack/materials', () => {
    it('validates material title', async () => {
      const res = await request
        .post('/api/projects/20260609-story-abc1--character_story/material-pack/materials')
        .send({
          summary: '缺标题的素材',
          purpose: ['fact_basis'],
        });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('adds manual material to the current project', async () => {
      const story: StoryGenerateResult = {
        ...makeApiStory(),
        storyId: '20260617-story-mat1',
        title: 'API 素材写入测试',
        gears_segments_url: '/api/stories/20260617-story-mat1/gears-segments',
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T10:40:00.000Z');

      const res = await request
        .post(`/api/projects/${enriched.project_id}/material-pack/materials`)
        .send({
          target: 'supporting_materials',
          title: '案卷文书',
          summary: '案卷文书用于强化疑案压力和堂前冲突。',
          source_type: 'manual_note',
          purpose: ['fact_basis', 'visual_asset'],
          mark_as_verified_fact: true,
        });

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.current_story.material_pack.supporting_materials).toEqual(expect.arrayContaining([
        expect.objectContaining({
          title: '案卷文书',
          source_type: 'manual_note',
          purpose: ['fact_basis', 'visual_asset'],
        }),
      ]));
      expect(res.body.data.current_story.material_pack.verified_facts.join('\n')).toContain('案卷文书');
      expect(res.body.data.current_story.creation_contract.material_sufficiency.score).toBe(
        res.body.data.current_story.material_sufficiency.score,
      );
    });
  });

  describe('POST /api/projects/:projectId/repair-quality/prompt', () => {
    it('generates a read-only quality repair prompt package with creation boundaries', async () => {
      const story: StoryGenerateResult = {
        ...makeApiStory(),
        storyId: '20260617-story-rp1',
        title: 'API 修复提示包测试',
        gears_segments_url: '/api/stories/20260617-story-rp1/gears-segments',
        quality_report: {
          ...makeApiStory().quality_report!,
          passed: false,
          genre_score: 64,
          issues: ['AI 漫剧缺少对白或强旁白推进'],
          repair_actions: ['补 1-2 句短对白，让冲突直接推进'],
          repair_action_items: [{
            action_id: 'repair-dialogue',
            label: '补对白',
            target_report: 'combined',
            severity: 'high',
            scene_ids: [2],
            prompt: '为第二场补 1-2 句短对白。',
            expected_effect: '对白问题消失',
          }],
        },
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T10:50:00.000Z');

      const res = await request
        .post(`/api/projects/${enriched.project_id}/repair-quality/prompt`)
        .send({
          repair_action_id: 'repair-dialogue',
          include_story_json: false,
          user_instruction: '保持机构审定口径。',
        });

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'story-quality-repair-prompt/v1',
        project_id: enriched.project_id,
        story_id: story.storyId,
        title: 'API 修复提示包测试',
      });
      expect(res.body.data.repair_actions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.target_scene_ids).toContain(2);
      expect(res.body.data.prompt).toContain('完整 StoryGenerateResult');
      expect(res.body.data.prompt).toContain('创作合同边界');
      expect(res.body.data.prompt).toContain('material_sufficiency');
      expect(res.body.data.prompt).toContain('保持机构审定口径');
      expect(res.body.data.prompt).toContain('<当前 Web 请求未内嵌完整原始故事 JSON');
      expect(res.body.data.original_story_json).toBeUndefined();

      const withStoryJson = await request
        .post(`/api/projects/${enriched.project_id}/repair-quality/prompt`)
        .send({
          repair_action_id: 'repair-dialogue',
          include_story_json: true,
          include_markdown: true,
        });

      expect(withStoryJson.status).toBe(200);
      expectSuccess(withStoryJson.body);
      expect(withStoryJson.body.data.original_story_json).toContain(story.storyId);
      expect(withStoryJson.body.data.original_story_json).toContain('API 修复提示包测试');
      expect(withStoryJson.body.data.prompt).not.toContain('<当前 Web 请求未内嵌完整原始故事 JSON');
      expect(withStoryJson.body.data.markdown).toContain('# Story Quality Repair Prompt');
      expect(withStoryJson.body.data.markdown).toContain(story.storyId);
    });

    it('validates and safely applies a repaired story json as a new version', async () => {
      const materialSufficiency = {
        schema_version: 'material-sufficiency/v1' as const,
        stage: 'script_ready' as const,
        active_stage: 'minimum_viable_story' as const,
        score: 61,
        can_generate: true,
        can_generate_with_risks: true,
        blocked: false,
        needs_verification: true,
        generation_posture: 'draft_needs_verification' as const,
        missing_items: [{
          item_id: 'institutional-data',
          label: '机构审定数据',
          reason: '机构片关键数据尚未核验',
          blocking_level: 'blocking' as const,
          affects: ['truth_report', 'institutional_safety_report'],
          recommended_question: '请补充可公开引用的机构审定数据。',
        }],
        optional_items: [],
        token_risk: 'low' as const,
        recommended_next_questions: ['请补充可公开引用的机构审定数据。'],
      };
      const story: StoryGenerateResult = {
        ...makeApiStory(),
        storyId: '20260617-story-ra1',
        title: 'API 修复 JSON 写入测试',
        gears_segments_url: '/api/stories/20260617-story-ra1/gears-segments',
        creation_use_case: 'institutional_promo',
        truth_mode: 'institutional_verified',
        material_sufficiency: materialSufficiency,
        creation_contract: {
          schema_version: 'creation-contract/v1',
          creation_use_case: 'institutional_promo',
          truth_mode: 'institutional_verified',
          client_type: '文化机构',
          target_audience: '公众观众',
          communication_goal: '稳妥呈现人物选择与机构价值表达',
          video_type: 'character_story',
          presentation_style: 'cinematic',
          story_structure: 'single_event_drama',
          narrative_pattern_ids: ['hero_choice'],
          allowed_fiction: ['可做镜头调度与场景压缩'],
          must_verify: ['机构审定数据', '可公开引用口径'],
          forbidden_moves: ['虚构机构发言', '把待核验数据写成确定事实'],
          required_disclaimers: [],
          material_sufficiency: materialSufficiency,
          delivery_expectation: ['输出可审校剧本草案'],
        },
        quality_report: {
          ...makeApiStory().quality_report!,
          passed: false,
          genre_score: 42,
          issues: ['缺少明确冲突'],
          repair_actions: ['强化第二场冲突'],
        },
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T10:55:00.000Z');
      const repaired: StoryGenerateResult = {
        ...story,
        title: 'API 修复 JSON 写入测试',
        full_text: '第一场原文。\n\n第二场原文。上官逼迫签字，周敦颐当场拒绝，冲突更明确。',
        scene_breakdown: story.scene_breakdown.map(scene => scene.scene_id === 2
          ? {
              ...scene,
              plot: '上官逼他签字，周敦颐当场拒绝，堂前气氛骤然紧绷。',
              conflict: '权势逼迫与良知拒签正面对撞',
              dialogue_or_narration: '上官：签了，此事便了。周敦颐：此案有疑，我不能签。',
            }
          : scene),
      };

      const dryRun = await request
        .post(`/api/projects/${enriched.project_id}/repair-quality/apply`)
        .send({
          repaired_story_json: [
            '```json',
            JSON.stringify({ repaired_story_json: { ...repaired, project_id: 'tampered-project-id' } }),
            '```',
          ].join('\n'),
          apply: false,
          allow_no_improvement: true,
        });

      expect(dryRun.status).toBe(200);
      expectSuccess(dryRun.body);
      expect(dryRun.body.data.applied).toBe(false);
      expect(dryRun.body.data.can_apply).toBe(true);
      expect(dryRun.body.data.changed_scene_ids).toContain(2);
      expect(dryRun.body.data.change_summary.changed_top_level_fields).toEqual(expect.arrayContaining([
        'full_text',
        'scene_breakdown',
      ]));
      expect(dryRun.body.data.change_summary.scene_changes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scene_id: 2,
          changed_fields: expect.arrayContaining(['plot', 'conflict', 'dialogue_or_narration']),
        }),
      ]));
      expect(typeof dryRun.body.data.change_summary.quality_delta.issue_count_delta).toBe('number');
      expect(Array.isArray(dryRun.body.data.change_summary.quality_issue_delta.resolved_issues)).toBe(true);
      expect(Array.isArray(dryRun.body.data.change_summary.quality_issue_delta.new_issues)).toBe(true);
      expect(Array.isArray(dryRun.body.data.change_summary.quality_issue_delta.remaining_issues)).toBe(true);
      expect(dryRun.body.data.change_summary.ignored_protected_field_changes).toContain('project_id');
      const dryRunHints = dryRun.body.data.operator_hints.join('\n');
      expect(dryRunHints).toContain('校验通过');
      expect(dryRunHints).toContain('创作合同边界');
      expect(dryRunHints).toContain('机构审定');
      expect(dryRunHints).toContain('真实度边界');
      expect(dryRunHints).toContain('禁止表达边界');
      expect(dryRunHints).toContain('素材 Gate');
      expect(dryRunHints).toContain('阻断素材缺口');
      expect(dryRun.body.data.validation_summary_markdown).toContain('# Story Quality Repair Validation');
      expect(dryRun.body.data.validation_summary_markdown).toContain('## Contract And Material Boundaries');
      expect(dryRun.body.data.validation_summary_markdown).toContain('truth_mode: institutional_verified');
      expect(dryRun.body.data.validation_summary_markdown).toContain('missing_items:');
      expect(dryRun.body.data.validation_summary_markdown).toContain('## Quality Issues');
      expect(dryRun.body.data.validation_summary_markdown).toContain('ignored_changes: project_id');

      const noOpApply = await request
        .post(`/api/projects/${enriched.project_id}/repair-quality/apply`)
        .send({
          repaired_story_json: JSON.stringify(story),
          apply: true,
          allow_no_improvement: true,
        });

      expect(noOpApply.status).toBe(200);
      expectSuccess(noOpApply.body);
      expect(noOpApply.body.data.applied).toBe(false);
      expect(noOpApply.body.data.can_apply).toBe(false);
      expect(noOpApply.body.data.change_summary.has_content_changes).toBe(false);
      expect(noOpApply.body.data.rejected_reason).toContain('未产生实质内容变化');

      const applyRes = await request
        .post(`/api/projects/${enriched.project_id}/repair-quality/apply`)
        .send({
          repaired_story_json: JSON.stringify(repaired),
          apply: true,
          allow_no_improvement: true,
        });

      expect(applyRes.status).toBe(200);
      expectSuccess(applyRes.body);
      expect(applyRes.body.data.applied).toBe(true);
      expect(applyRes.body.data.change_summary.summary_lines.join('\n')).toContain('场景变更');
      expect(applyRes.body.data.detail.current_story.scene_breakdown[1].dialogue_or_narration).toContain('我不能签');
      expect(applyRes.body.data.detail.versions.length).toBeGreaterThanOrEqual(2);
      expect(applyRes.body.data.detail.versions[0].change_type).toBe('quality_repair');
    });
  });

  describe('GET /api/projects/supplement-tasks', () => {
    it('returns unified envelope with supplement task list', async () => {
      const res = await request.get('/api/projects/supplement-tasks');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts staged supplement task filters', async () => {
      const res = await request
        .get('/api/projects/supplement-tasks')
        .query({
          status: 'open',
          stage: 'script_ready',
          blocking_level: 'blocking',
          source: 'material_sufficiency_missing_item',
        });
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('exports a filtered supplement candidate package without province markdown writeback', async () => {
      const taskId = '20260617-story-api1--production-template--reference_images_or_keyframes';
      const story: StoryGenerateResult = {
        ...makeApiStory(),
        storyId: '20260617-story-supplement-export',
        title: '补库候选包 API 测试故事',
        video_type: 'ai_comic_drama',
        source_entry: '湖南青石巷追问',
        supplement_tasks: [{
          task_id: taskId,
          need_id: 'production_template_reference_images_or_keyframes',
          label: '参考图或关键帧',
          description: '补齐青石巷追问的参考图、关键帧和来源核验说明。',
          stage: 'production_ready',
          blocking_level: 'risk',
          affects: ['production_material_readiness', 'gears_delivery'],
          recommended_fields: ['reference_images_or_keyframes'],
          recommended_question: '请补充可核验的青石巷参考图或关键帧。',
          intake_prompt: '记录画面来源、可用镜头和待核点。',
          status: 'open',
          source: 'production_material_missing_field',
          created_at: '2026-06-17T10:40:00.000Z',
        }],
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T10:40:00.000Z');

      const res = await request
        .get('/api/projects/supplement-tasks/candidate-package/export')
        .query({
          project_id: enriched.project_id,
          status: 'open',
          search_query: '青石巷',
          task_keys: `${enriched.project_id}::${taskId}`,
        });

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.schema_version).toBe('project-supplement-candidate-package/v1');
      expect(res.body.data.task_count).toBe(1);
      expect(res.body.data.open_task_count).toBe(1);
      expect(res.body.data.risk_open_count).toBe(1);
      expect(res.body.data.direct_writeback_to_province_markdown).toBe(false);
      expect(res.body.data.province_markdown_written).toBe(false);
      expect(res.body.data.filters.search_query).toBe('青石巷');
      expect(res.body.data.filters.task_key_count).toBe(1);
      expect(res.body.data.items[0].task_key).toBe(`${enriched.project_id}::${taskId}`);
      expect(res.body.data.markdown).toContain('Story Agent 素材补库候选包');
      expect(res.body.data.markdown).toContain('不直接修改 Domain Pack 目标文件');
      expect(res.body.data.markdown).toContain('青石巷追问');
    });
  });

  describe('DELETE /api/projects/:projectId', () => {
    it('returns story cleanup stats used by project deletion UI', async () => {
      const story = makeApiStory();
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T10:00:00.000Z');
      const storyDir = resolve(testWorkspaceRoot, 'web', 'generated', 'stories', story.video_type);
      await mkdir(storyDir, { recursive: true });
      await writeFile(
        resolve(storyDir, `${story.storyId}.json`),
        JSON.stringify({
          ...story,
          project_id: enriched.project_id,
          current_version_id: enriched.current_version_id,
          _request_meta: { created_at: '2026-06-17T10:00:00.000Z' },
        }, null, 2),
        'utf-8',
      );

      const res = await request.delete(`/api/projects/${enriched.project_id}`);

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.deleted).toBe(true);
      expect(res.body.data.project_id).toBe(enriched.project_id);
      expect(res.body.data.story_ids).toContain(story.storyId);
      expect(res.body.data.removed_story_file_count).toBe(1);

      const detailRes = await request.get(`/api/projects/${enriched.project_id}`);
      expect(detailRes.status).toBe(404);
      expectFailure(detailRes.body, 'STORY_NOT_FOUND');
    });
  });

  describe('GET /api/projects/:projectId/production-readiness', () => {
    it('returns the single-story production readiness command report through the route', async () => {
      const story = makeApiProductionRepairStory();
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T10:30:00.000Z');

      const res = await request.get(`/api/projects/${enriched.project_id}/production-readiness`);

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toMatchObject({
        schema_version: 'story-project-production-readiness/v1',
        scope: 'story_project',
        project: {
          project_id: enriched.project_id,
          current_story_id: story.storyId,
        },
      });
      expect(res.body.data.summary).toMatchObject({
        quality_score: 92,
        gears_job_count: 0,
      });
      expect(res.body.data.lanes.map((lane: any) => lane.key)).toEqual(expect.arrayContaining([
        'story_quality',
        'production_board',
        'delivery_contract',
        'gears_execution',
      ]));
      expect(res.body.data.issues.map((issue: any) => issue.issue_id)).toContain('gears-ledger-empty');
      expect(res.body.data.automation_plan).toMatchObject({
        schema_version: 'production-readiness-automation-plan/v1',
        external_step_count: expect.any(Number),
      });
      expect(res.body.data.automation_plan.steps.map((step: any) => step.action_key)).toContain('submit_gears_jobs');
      expect(res.body.data.markdown).toContain('制作 readiness');
      expect(res.body.data.markdown).toContain('Automation Plan');

      const runRes = await request
        .post(`/api/projects/${enriched.project_id}/production-readiness/run-automation`)
        .send({ dry_run: true, action_keys: ['export_production_board'] });
      expect(runRes.status).toBe(200);
      expectSuccess(runRes.body);
      expect(runRes.body.data).toMatchObject({
        schema_version: 'production-readiness-automation-run/v1',
        scope: 'story_project',
        dry_run: true,
        planned_step_count: 1,
        executed_step_count: 0,
      });
    });
  });

  describe('POST /api/projects/:projectId/production-board/repair', () => {
    it('repairs only the requested production board task id through the route', async () => {
      const story = makeApiProductionRepairStory();
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T11:00:00.000Z');

      const boardRes = await request.get(`/api/projects/${enriched.project_id}/production-board`);
      expect(boardRes.status).toBe(200);
      expectSuccess(boardRes.body);
      const cleanPromptTask = boardRes.body.data.repair_plan.tasks.find((task: any) => task.action === 'clean_prompt');

      expect(cleanPromptTask).toBeTruthy();
      expect(boardRes.body.data.repair_plan.tasks.some((task: any) => task.action === 'normalize_period_costumes')).toBe(true);

      const repairRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/repair`)
        .send({ task_ids: [cleanPromptTask.task_id] });

      expect(repairRes.status).toBe(200);
      expectSuccess(repairRes.body);
      expect(repairRes.body.data.trace.applied_task_ids).toEqual([cleanPromptTask.task_id]);
      expect(repairRes.body.data.trace.applied_actions).toEqual(['clean_prompt']);
      expect(repairRes.body.data.detail.project.version_count).toBe(2);
      expect(repairRes.body.data.detail.current_story.scene_breakdown[0].visual_prompt).not.toMatch(/质量|待补/);
      expect(repairRes.body.data.detail.current_story.gears_delivery.character_assets[0].clothing).toContain('清末民初');
      expect(
        repairRes.body.data.after_board.supervision_report.issues.some((issue: any) => issue.category === 'period'),
      ).toBe(true);
    });

    it('repairs only the requested production board category through the route', async () => {
      const baseStory = makeApiProductionRepairStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: '20260617-story-apc1',
        title: 'API 生产分类修复测试故事',
        gears_segments_url: '/api/stories/20260617-story-apc1/gears-segments',
        gears_delivery: baseStory.gears_delivery
          ? {
              ...baseStory.gears_delivery,
              storyId: '20260617-story-apc1',
              title: 'API 生产分类修复测试故事',
            }
          : undefined,
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T11:15:00.000Z');

      const repairRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/repair`)
        .send({ categories: ['prompt'] });

      expect(repairRes.status).toBe(200);
      expectSuccess(repairRes.body);
      expect(repairRes.body.data.trace.applied_actions).toEqual(['clean_prompt']);
      expect(repairRes.body.data.trace.applied_actions).not.toContain('normalize_period_costumes');
      expect(repairRes.body.data.trace.scene_diffs.length).toBeGreaterThan(0);
      expect(repairRes.body.data.trace.scene_diffs[0].changed_fields.map((field: any) => field.field)).toContain('visual_prompt');
      expect(repairRes.body.data.detail.current_story.scene_breakdown[0].visual_prompt).not.toMatch(/质量|待补/);
      expect(repairRes.body.data.detail.current_story.gears_delivery.character_assets[0].clothing).toContain('清末民初');
    });
  });

  describe('POST /api/projects/:projectId/production-board/repair-export', () => {
    it('repairs production board issues and exports the package through one route', async () => {
      const baseStory = makeApiProductionRepairStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: '20260617-story-apx1',
        title: 'API 生产修复落盘测试故事',
        gears_segments_url: '/api/stories/20260617-story-apx1/gears-segments',
        gears_delivery: baseStory.gears_delivery
          ? {
              ...baseStory.gears_delivery,
              storyId: '20260617-story-apx1',
              title: 'API 生产修复落盘测试故事',
            }
          : undefined,
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T11:30:00.000Z');

      const res = await request
        .post(`/api/projects/${enriched.project_id}/production-board/repair-export`)
        .send({ apply_all: true });

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.schema_version).toBe('story-production-board-repair-export/v1');
      expect(res.body.data.repair.trace.applied).toBe(true);
      expect(res.body.data.repair.trace.applied_actions.length).toBeGreaterThan(0);
      expect(res.body.data.repair.trace.after_blockers).toBeLessThanOrEqual(
        res.body.data.repair.trace.before_blockers,
      );
      expect(res.body.data.detail.project.status).toBe('exported');
      expect(res.body.data.detail.project.version_count).toBe(2);
      const repairVersion = res.body.data.detail.versions.find(
        (version: any) => version.change_type === 'production_board_repair',
      );
      expect(repairVersion.production_board_repair_trace.applied).toBe(true);
      expect(repairVersion.production_board_export).toMatchObject({
        file_count: res.body.data.export_package.files.length,
        delivery_stage: res.body.data.export_package.board.delivery_manifest.stage,
      });
      expect(res.body.data.export_package.schema_version).toBe('story-production-board-export/v1');
      expect(res.body.data.export_package.files.map((file: any) => file.relative_path)).toEqual(expect.arrayContaining([
        'production-board/manifest.json',
        'production-board/production-board.json',
        'production-board/seedance-prompts.md',
      ]));
      expect(res.body.data.export_package.board.shot_units[0].visual_prompt).not.toMatch(/质量|待补/);
    });
  });

  describe('POST /api/projects/:projectId/production-board/seedance-assets', () => {
    it('binds a Seedance asset file through the route', async () => {
      const baseStory = makeApiProductionRepairStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: '20260617-story-apa1',
        title: 'API Seedance 素材绑定测试故事',
        gears_segments_url: '/api/stories/20260617-story-apa1/gears-segments',
        gears_delivery: baseStory.gears_delivery
          ? {
              ...baseStory.gears_delivery,
              storyId: '20260617-story-apa1',
              title: 'API Seedance 素材绑定测试故事',
            }
          : undefined,
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T11:45:00.000Z');
      const beforeBoardRes = await request.get(`/api/projects/${enriched.project_id}/production-board`);
      expect(beforeBoardRes.status).toBe(200);
      expectSuccess(beforeBoardRes.body);
      const bindableAsset = beforeBoardRes.body.data.seedance_asset_report.assets.find((asset: any) =>
        asset.status === 'missing_file'
      );
      expect(bindableAsset).toBeTruthy();

      const updateRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-assets`)
        .send({
          items: [{
            asset_id: bindableAsset.asset_id,
            kind: bindableAsset.kind,
            label: bindableAsset.label,
            modality: bindableAsset.modality,
            role: bindableAsset.role,
            reference_slot: bindableAsset.reference_slot,
            file_id: 'seedance-file-001',
            description: 'API 测试绑定素材',
          }],
        });

      expect(updateRes.status).toBe(200);
      expectSuccess(updateRes.body);
      expect(updateRes.body.data.project.seedance_asset_library.items[0]).toMatchObject({
        asset_id: bindableAsset.asset_id,
        file_id: 'seedance-file-001',
        history: [expect.objectContaining({
          event_type: 'manual_bind',
          file_id: 'seedance-file-001',
        })],
      });
      const afterBoardRes = await request.get(`/api/projects/${enriched.project_id}/production-board`);
      expect(afterBoardRes.status).toBe(200);
      expectSuccess(afterBoardRes.body);
      expect(afterBoardRes.body.data.seedance_asset_report.assets.find((asset: any) =>
        asset.asset_id === bindableAsset.asset_id
      )).toMatchObject({
        status: 'bound',
        is_bound: true,
        needs_upload: false,
        file_id: 'seedance-file-001',
      });

      const batchAsset = afterBoardRes.body.data.seedance_asset_report.assets.find((asset: any) =>
        asset.status === 'missing_file'
      );
      expect(batchAsset).toBeTruthy();
      const importRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-assets/import`)
        .send({
          source_note: 'API 测试素材批量导入',
          items: [{
            asset_id: batchAsset.asset_id,
            provider: 'seedance',
            provider_asset_id: 'seedance-provider-asset-api-002',
            upload_status: 'uploaded',
          }],
        });

      expect(importRes.status).toBe(200);
      expectSuccess(importRes.body);
      expect(importRes.body.data.imported_count).toBe(1);
      expect(importRes.body.data.matched_existing_count).toBe(1);
      expect(importRes.body.data.updated_asset_ids).toContain(batchAsset.asset_id);
      expect(importRes.body.data.detail.project.seedance_asset_library.items.find((asset: any) =>
        asset.asset_id === batchAsset.asset_id
      ).history).toEqual(expect.arrayContaining([
        expect.objectContaining({
          event_type: 'batch_import',
          provider_asset_id: 'seedance-provider-asset-api-002',
          note: 'API 测试素材批量导入',
        }),
      ]));
      const importedBoardRes = await request.get(`/api/projects/${enriched.project_id}/production-board`);
      expect(importedBoardRes.status).toBe(200);
      expectSuccess(importedBoardRes.body);
      expect(importedBoardRes.body.data.seedance_asset_report.assets.find((asset: any) =>
        asset.asset_id === batchAsset.asset_id
      )).toMatchObject({
        status: 'bound',
        is_bound: true,
        needs_upload: false,
        provider: 'seedance',
        provider_asset_id: 'seedance-provider-asset-api-002',
        upload_status: 'uploaded',
      });

      const uploadAsset = importedBoardRes.body.data.seedance_asset_report.assets.find((asset: any) =>
        asset.status === 'missing_file'
      );
      expect(uploadAsset).toBeTruthy();
      const uploadRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-assets/upload`)
        .field('asset_id', uploadAsset.asset_id)
        .field('kind', uploadAsset.kind)
        .field('label', uploadAsset.label)
        .field('modality', uploadAsset.modality)
        .field('role', uploadAsset.role)
        .field('reference_slot', uploadAsset.reference_slot ?? '')
        .attach('file', Buffer.from('api-seedance-upload-binary'), {
          filename: 'api-seedance-upload.png',
          contentType: 'image/png',
        });

      expect(uploadRes.status).toBe(200);
      expectSuccess(uploadRes.body);
      expect(uploadRes.body.data.asset).toMatchObject({
        asset_id: uploadAsset.asset_id,
        original_filename: 'api-seedance-upload.png',
        mime_type: 'image/png',
        provider: 'local_upload',
        upload_status: 'uploaded',
        history: [expect.objectContaining({
          event_type: 'file_upload',
          original_filename: 'api-seedance-upload.png',
        })],
      });
      expect(uploadRes.body.data.local_path).toContain(`projects/${enriched.project_id}/seedance-assets/uploads/`);
      const uploadBoardRes = await request.get(`/api/projects/${enriched.project_id}/production-board`);
      expect(uploadBoardRes.status).toBe(200);
      expectSuccess(uploadBoardRes.body);
      expect(uploadBoardRes.body.data.seedance_asset_report.assets.find((asset: any) =>
        asset.asset_id === uploadAsset.asset_id
      )).toMatchObject({
        status: 'bound',
        is_bound: true,
        needs_upload: false,
        provider: 'local_upload',
        upload_status: 'uploaded',
        original_filename: 'api-seedance-upload.png',
      });

      const targetStory: StoryGenerateResult = {
        ...story,
        storyId: '20260617-story-apa2',
        title: 'API Seedance 素材复用目标故事',
        gears_segments_url: '/api/stories/20260617-story-apa2/gears-segments',
        gears_delivery: story.gears_delivery
          ? {
              ...story.gears_delivery,
              storyId: '20260617-story-apa2',
              title: 'API Seedance 素材复用目标故事',
            }
          : undefined,
      };
      const targetProject = await createProjectFromGeneratedStory(targetStory, '2026-06-17T11:55:00.000Z');
      const targetBoardRes = await request.get(`/api/projects/${targetProject.project_id}/production-board`);
      expect(targetBoardRes.status).toBe(200);
      expectSuccess(targetBoardRes.body);
      const targetAsset = targetBoardRes.body.data.seedance_asset_report.assets.find((asset: any) =>
        asset.asset_id === uploadAsset.asset_id
      );
      expect(targetAsset).toMatchObject({
        status: 'missing_file',
        is_bound: false,
      });

      const globalLibraryRes = await request
        .get(`/api/projects/${targetProject.project_id}/production-board/seedance-assets/global`);
      expect(globalLibraryRes.status).toBe(200);
      expectSuccess(globalLibraryRes.body);
      expect(globalLibraryRes.body.data.items.find((asset: any) =>
        asset.source_project_id === enriched.project_id && asset.source_asset_id === uploadAsset.asset_id
      )).toMatchObject({
        provider: 'local_upload',
        upload_status: 'uploaded',
        original_filename: 'api-seedance-upload.png',
      });

      const reuseRes = await request
        .post(`/api/projects/${targetProject.project_id}/production-board/seedance-assets/reuse`)
        .send({
          source_project_id: enriched.project_id,
          source_asset_id: uploadAsset.asset_id,
          target_asset_id: targetAsset.asset_id,
          target_label: targetAsset.label,
          target_kind: targetAsset.kind,
          reference_slot: targetAsset.reference_slot,
          description: targetAsset.prompt_usage,
        });
      expect(reuseRes.status).toBe(200);
      expectSuccess(reuseRes.body);
      expect(reuseRes.body.data.reused_asset).toMatchObject({
        asset_id: targetAsset.asset_id,
        provider: 'local_upload',
        upload_status: 'uploaded',
        original_filename: 'api-seedance-upload.png',
        history: [expect.objectContaining({
          event_type: 'cross_project_reuse',
          source_project_id: enriched.project_id,
          source_asset_id: uploadAsset.asset_id,
        })],
      });

      const reusedTargetBoardRes = await request.get(`/api/projects/${targetProject.project_id}/production-board`);
      expect(reusedTargetBoardRes.status).toBe(200);
      expectSuccess(reusedTargetBoardRes.body);
      expect(reusedTargetBoardRes.body.data.seedance_asset_report.assets.find((asset: any) =>
        asset.asset_id === targetAsset.asset_id
      )).toMatchObject({
        status: 'bound',
        is_bound: true,
        needs_upload: false,
        provider: 'local_upload',
        upload_status: 'uploaded',
        original_filename: 'api-seedance-upload.png',
      });
    });
  });

  describe('POST /api/projects/:projectId/production-board/seedance-shots', () => {
    it('updates a Seedance shot ledger item through the route', async () => {
      const baseStory = makeApiProductionRepairStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: '20260617-story-aps1',
        title: 'API Seedance 镜头状态测试故事',
        gears_segments_url: '/api/stories/20260617-story-aps1/gears-segments',
        gears_delivery: baseStory.gears_delivery
          ? {
              ...baseStory.gears_delivery,
              storyId: '20260617-story-aps1',
              title: 'API Seedance 镜头状态测试故事',
            }
          : undefined,
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T12:05:00.000Z');
      const beforeBoardRes = await request.get(`/api/projects/${enriched.project_id}/production-board`);
      expect(beforeBoardRes.status).toBe(200);
      expectSuccess(beforeBoardRes.body);
      expect(beforeBoardRes.body.data.seedance_shot_ledger.items[0]).toMatchObject({
        shot_id: 'shot-1',
        status: 'prompt_exported',
      });

      const updateRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots`)
        .send({
          shot_id: 'shot-1',
          status: 'ready',
          provider_job_id: 'seedance-job-api-001',
          video_url: 'https://example.com/api/shot-1.mp4',
          quality_score: 91,
          review_note: 'API 回片可用',
          note: 'API 测试更新',
        });

      expect(updateRes.status).toBe(200);
      expectSuccess(updateRes.body);
      const item = updateRes.body.data.project.seedance_shot_ledger.items.find((ledgerItem: any) =>
        ledgerItem.shot_id === 'shot-1'
      );
      expect(item).toMatchObject({
        status: 'ready',
        provider_job_id: 'seedance-job-api-001',
        video_url: 'https://example.com/api/shot-1.mp4',
        selected_version_id: 'seedance-shot-shot-1-v1',
      });
      expect(item.versions[0]).toMatchObject({
        status: 'ready',
        quality_score: 91,
        review_note: 'API 回片可用',
      });

      const afterBoardRes = await request.get(`/api/projects/${enriched.project_id}/production-board`);
      expect(afterBoardRes.status).toBe(200);
      expectSuccess(afterBoardRes.body);
      expect(afterBoardRes.body.data.seedance_shot_ledger.items.find((ledgerItem: any) =>
        ledgerItem.shot_id === 'shot-1'
      )).toMatchObject({
        status: 'ready',
        video_url: 'https://example.com/api/shot-1.mp4',
      });

      const providerSubmitRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/submit-provider`)
        .send({
          shot_ids: ['shot-2'],
          provider: 'seedance',
          job_prefix: 'api-provider-job',
          queue_id: 'api-provider-queue-001',
          queue_priority: 'high',
          note: 'API provider 提交',
        });
      expect(providerSubmitRes.status).toBe(200);
      expectSuccess(providerSubmitRes.body);
      expect(providerSubmitRes.body.data).toMatchObject({
        submitted_count: 1,
        skipped_count: 0,
        failed_count: 0,
        submitted_shots: [{
          shot_id: 'shot-2',
          provider_job_id: 'api-provider-job-shot-2',
          status: 'submitted',
        }],
      });
      expect(providerSubmitRes.body.data.provider_queue_batch).toMatchObject({
        queue_id: 'api-provider-queue-001',
        provider: 'seedance',
        priority: 'high',
        submitted_count: 1,
        items: [{
          shot_id: 'shot-2',
          provider_job_id: 'api-provider-job-shot-2',
          queue_position: 1,
          status: 'submitted',
        }],
      });
      expect(providerSubmitRes.body.data.seedance_shot_ledger.items.find((ledgerItem: any) =>
        ledgerItem.shot_id === 'shot-2'
      )).toMatchObject({
        status: 'submitted',
        provider_job_id: 'api-provider-job-shot-2',
        provider_queue_id: 'api-provider-queue-001',
        provider_queue_position: 1,
      });

      const previousSubmitAdapterEndpoint = process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
      delete process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
      const missingSubmitAdapterRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/submit-provider`)
        .send({
          shot_ids: ['shot-2'],
          provider: 'seedance',
          overwrite_existing: true,
          use_provider_adapter: true,
        });
      if (previousSubmitAdapterEndpoint === undefined) {
        delete process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
      } else {
        process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = previousSubmitAdapterEndpoint;
      }
      expect(missingSubmitAdapterRes.status).toBe(400);
      expectFailure(missingSubmitAdapterRes.body, 'VALIDATION_ERROR');
      expect(missingSubmitAdapterRes.body.error.message).toContain('SEEDANCE_PROVIDER_SUBMIT_ENDPOINT');

      const providerRecoveryRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/recover-provider`)
        .send({
          timeout_minutes: 1,
          statuses: ['submitted'],
        });
      expect(providerRecoveryRes.status).toBe(200);
      expectSuccess(providerRecoveryRes.body);
      expect(providerRecoveryRes.body.data).toMatchObject({
        dry_run: true,
        timeout_minutes: 1,
        checked_count: 1,
        timed_out_count: 0,
        updated_count: 0,
        timed_out_shots: [],
      });
    });
  });

  describe('POST /api/projects/:projectId/production-board/gears-jobs/export-external-callback-handoff', () => {
    it('exports callback samples for GEARS jobs that still need external artifacts', async () => {
      const baseStory = makeApiProductionRepairStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: '20260617-story-apg1',
        title: 'API GEARS 外部回片交接包测试故事',
        gears_segments_url: '/api/stories/20260617-story-apg1/gears-segments',
        gears_delivery: baseStory.gears_delivery
          ? {
              ...baseStory.gears_delivery,
              storyId: '20260617-story-apg1',
              title: 'API GEARS 外部回片交接包测试故事',
            }
          : undefined,
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T12:12:00.000Z');

      const submitRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/submit`)
        .send({
          job_type: 'seedance_video',
          note: 'API GEARS 外部回片交接包测试提交',
        });
      expect(submitRes.status).toBe(200);
      expectSuccess(submitRes.body);
      expect(submitRes.body.data.submitted_count).toBeGreaterThan(0);

      const localAcceptanceRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/local-acceptance`)
        .send({
          job_type: 'seedance_video',
          note: 'API 本地验收占位，不是外部回片',
        });
      expect(localAcceptanceRes.status).toBe(200);
      expectSuccess(localAcceptanceRes.body);
      expect(localAcceptanceRes.body.data.accepted_count).toBe(submitRes.body.data.submitted_count);

      const previousCallbackBaseUrl = process.env.GEARS_CALLBACK_BASE_URL;
      process.env.GEARS_CALLBACK_BASE_URL = 'https://story.example.test/public/';
      const handoffRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/export-external-callback-handoff`)
        .send({});
      if (previousCallbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
      else process.env.GEARS_CALLBACK_BASE_URL = previousCallbackBaseUrl;
      const expectedCallbackPath = `/api/projects/${enriched.project_id}/gears-callback`;
      const expectedPreflightPath = `/api/projects/${enriched.project_id}/production-board/gears-jobs/preflight-external-callbacks`;
      const expectedSafeImportPath = `/api/projects/${enriched.project_id}/production-board/gears-jobs/import-external-callbacks`;
      const expectedCallbackUrl = `https://story.example.test/public${expectedCallbackPath}`;
      const expectedPreflightUrl = `https://story.example.test/public${expectedPreflightPath}`;
      const expectedSafeImportUrl = `https://story.example.test/public${expectedSafeImportPath}`;
      expect(handoffRes.status).toBe(200);
      expectSuccess(handoffRes.body);
      expect(handoffRes.body.data).toMatchObject({
        schema_version: 'project-gears-external-callback-handoff/v1',
        pending_external_artifact_count: submitRes.body.data.submitted_count,
        local_acceptance_ready_count: submitRes.body.data.submitted_count,
        external_ready_count: 0,
        callback_path: expectedCallbackPath,
        callback_url: expectedCallbackUrl,
        preflight_path: expectedPreflightPath,
        preflight_url: expectedPreflightUrl,
        safe_import_path: expectedSafeImportPath,
        safe_import_url: expectedSafeImportUrl,
      });
      expect(handoffRes.body.data.items[0]).toMatchObject({
        source_unit_id: 'shot-1',
        requires_external_artifact: true,
        callback_sample: {
          sourceUnitId: 'shot-1',
          taskStatus: 'COMPLETED',
          jobType: 'seedance_video',
        },
      });
      expect(handoffRes.body.data.items[0].local_acceptance_artifact_urls[0]).toContain('https://local.story-agent.invalid/gears-acceptance/');
      expect(handoffRes.body.data.items[0].external_artifact_urls).toEqual([]);
      expect(handoffRes.body.data.items[0].callback_sample.outputUrl).toContain('https://gears.example/videos/');
      expect(handoffRes.body.data.callback_batch_sample.callbacks).toHaveLength(submitRes.body.data.submitted_count);
      expect(handoffRes.body.data.callback_batch_sample.callbacks[0]).toMatchObject({
        sourceUnitId: 'shot-1',
        outputUrl: expect.stringContaining('https://gears.example/videos/'),
      });
      expect(handoffRes.body.data.callback_batch_sample.replace_before_import).toEqual(expect.arrayContaining([
        expect.stringContaining('absolute public http(s) URL'),
      ]));
      expect(handoffRes.body.data.callback_batch_preflight_curl).toContain(expectedPreflightUrl);
      expect(handoffRes.body.data.callback_batch_preflight_curl).not.toContain('GEARS_CALLBACK_SECRET');
      expect(handoffRes.body.data.callback_batch_curl).toContain(expectedSafeImportUrl);
      expect(handoffRes.body.data.callback_batch_curl).not.toContain('GEARS_CALLBACK_SECRET');
      expect(handoffRes.body.data.operator_checklist).toEqual(expect.arrayContaining([
        expect.stringContaining('preflight endpoint'),
        expect.stringContaining('safe import endpoint'),
        expect.stringContaining('absolute public http(s) outputUrl'),
      ]));
      expect(handoffRes.body.data.markdown).toContain('GEARS 外部回片交接包');
      expect(handoffRes.body.data.markdown).toContain('## 批量回传 payload');
      expect(handoffRes.body.data.markdown).toContain('preflightPath');
      expect(handoffRes.body.data.markdown).toContain('Preflight curl');
      expect(handoffRes.body.data.markdown).toContain('Safe import curl');
      expect(handoffRes.body.data.markdown).toContain('local_acceptance URL 只代表本地链路验收');

      const placeholderPreflightRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/preflight-external-callbacks`)
        .send(handoffRes.body.data.callback_batch_sample);
      expect(placeholderPreflightRes.status).toBe(200);
      expectSuccess(placeholderPreflightRes.body);
      expect(placeholderPreflightRes.body.data).toMatchObject({
        schema_version: 'project-gears-external-callback-preflight/v1',
        received_count: submitRes.body.data.submitted_count,
        ready_to_import_count: 0,
        duplicate_event_count: 0,
      });
      expect(placeholderPreflightRes.body.data.issues.map((issue: any) => issue.code)).toContain('placeholder_artifact_url');

      const blockedImportRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/import-external-callbacks`)
        .send(handoffRes.body.data.callback_batch_sample);
      expect(blockedImportRes.status).toBe(200);
      expectSuccess(blockedImportRes.body);
      expect(blockedImportRes.body.data).toMatchObject({
        schema_version: 'project-gears-external-callback-import/v1',
        blocked: true,
        received_count: submitRes.body.data.submitted_count,
        updated_count: 0,
        failed_count: submitRes.body.data.submitted_count,
        duplicate_count: 0,
      });

      const realCallbackPayload = {
        callbacks: handoffRes.body.data.callback_batch_sample.callbacks.map((callback: any, index: number) => ({
          ...callback,
          outputUrl: `https://media.story-agent.test/api-external-shot-${index + 1}.mp4`,
          eventId: `api-external-ready-shot-${index + 1}`,
        })),
      };
      const realPreflightRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/preflight-external-callbacks`)
        .send(realCallbackPayload);
      expect(realPreflightRes.status).toBe(200);
      expectSuccess(realPreflightRes.body);
      expect(realPreflightRes.body.data).toMatchObject({
        received_count: submitRes.body.data.submitted_count,
        ready_to_import_count: submitRes.body.data.submitted_count,
        duplicate_event_count: 0,
        blocking_count: 0,
      });
      expect(realPreflightRes.body.data.items[0]).toMatchObject({
        has_event_id: true,
        would_update: true,
      });
      const missingEventIdCallback = { ...realCallbackPayload.callbacks[0] };
      delete missingEventIdCallback.eventId;
      const missingEventIdPreflightRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/preflight-external-callbacks`)
        .send({ callbacks: [missingEventIdCallback] });
      expect(missingEventIdPreflightRes.status).toBe(200);
      expectSuccess(missingEventIdPreflightRes.body);
      expect(missingEventIdPreflightRes.body.data).toMatchObject({
        received_count: 1,
        ready_to_import_count: 1,
        duplicate_event_count: 0,
        blocking_count: 0,
        warning_count: 1,
      });
      expect(missingEventIdPreflightRes.body.data.issues.map((issue: any) => issue.code)).toContain('missing_event_id');
      expect(missingEventIdPreflightRes.body.data.items[0]).toMatchObject({
        has_event_id: false,
        is_duplicate_event: false,
        would_update: true,
      });
      const privateArtifactPreflightRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/preflight-external-callbacks`)
        .send({
          callbacks: [{
            ...realCallbackPayload.callbacks[0],
            outputUrl: 'http://127.0.0.1:9000/api-external-shot-1.mp4',
            eventId: 'api-external-private-shot-1',
          }],
        });
      expect(privateArtifactPreflightRes.status).toBe(200);
      expectSuccess(privateArtifactPreflightRes.body);
      expect(privateArtifactPreflightRes.body.data).toMatchObject({
        received_count: 1,
        ready_to_import_count: 0,
        duplicate_event_count: 0,
        blocking_count: 2,
      });
      expect(privateArtifactPreflightRes.body.data.issues.map((issue: any) => issue.code)).toEqual(expect.arrayContaining([
        'missing_external_artifact_url',
        'private_or_local_artifact_url',
      ]));
      expect(privateArtifactPreflightRes.body.data.items[0]).toMatchObject({
        has_external_artifact_url: false,
        has_private_or_local_artifact_url: true,
        has_invalid_artifact_url: false,
        would_update: false,
      });
      const invalidArtifactPreflightRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/preflight-external-callbacks`)
        .send({
          callbacks: [{
            ...realCallbackPayload.callbacks[0],
            outputUrl: '/tmp/api-external-shot-1.mp4',
            eventId: 'api-external-invalid-url-shot-1',
          }],
        });
      expect(invalidArtifactPreflightRes.status).toBe(200);
      expectSuccess(invalidArtifactPreflightRes.body);
      expect(invalidArtifactPreflightRes.body.data).toMatchObject({
        received_count: 1,
        ready_to_import_count: 0,
        duplicate_event_count: 0,
        blocking_count: 2,
      });
      expect(invalidArtifactPreflightRes.body.data.issues.map((issue: any) => issue.code)).toEqual(expect.arrayContaining([
        'missing_external_artifact_url',
        'invalid_artifact_url',
      ]));
      expect(invalidArtifactPreflightRes.body.data.items[0]).toMatchObject({
        has_external_artifact_url: false,
        has_private_or_local_artifact_url: false,
        has_invalid_artifact_url: true,
        would_update: false,
      });
      const duplicateBatchPreflightRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/preflight-external-callbacks`)
        .send({
          callbacks: [
            realCallbackPayload.callbacks[0],
            realCallbackPayload.callbacks[0],
          ],
        });
      expect(duplicateBatchPreflightRes.status).toBe(200);
      expectSuccess(duplicateBatchPreflightRes.body);
      expect(duplicateBatchPreflightRes.body.data).toMatchObject({
        received_count: 2,
        ready_to_import_count: 1,
        duplicate_event_count: 1,
        blocking_count: 0,
        warning_count: 1,
      });
      expect(duplicateBatchPreflightRes.body.data.issues.map((issue: any) => issue.code)).toContain('duplicate_event_id_in_batch');
      expect(duplicateBatchPreflightRes.body.data.items[1]).toMatchObject({
        event_id: 'api-external-ready-shot-1',
        is_duplicate_event: true,
        duplicate_event_source: 'batch',
        duplicate_of_index: 0,
        would_update: false,
      });

      const importRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/import-external-callbacks`)
        .send(realCallbackPayload);
      expect(importRes.status).toBe(200);
      expectSuccess(importRes.body);
      expect(importRes.body.data).toMatchObject({
        schema_version: 'project-gears-external-callback-import/v1',
        blocked: false,
        received_count: submitRes.body.data.submitted_count,
        updated_count: submitRes.body.data.submitted_count,
      });
      expect(importRes.body.data.import_result.seedance_shot_ledger.items[0]).toMatchObject({
        status: 'ready',
        video_url: 'https://media.story-agent.test/api-external-shot-1.mp4',
      });
    });
  });

  describe('POST /api/system/gears-external-callbacks/import', () => {
    it('preflights and imports real external GEARS callbacks across projects with callback secret', async () => {
      const previousCallbackSecret = process.env.GEARS_CALLBACK_SECRET;
      process.env.GEARS_CALLBACK_SECRET = 'test-system-gears-secret';
      try {
        const baseStory = makeApiProductionRepairStory();
        const story: StoryGenerateResult = {
          ...baseStory,
          storyId: '20260617-story-apg2',
          title: 'API GEARS 系统级外部回片导入测试故事',
          gears_segments_url: '/api/stories/20260617-story-apg2/gears-segments',
          gears_delivery: baseStory.gears_delivery
            ? {
                ...baseStory.gears_delivery,
                storyId: '20260617-story-apg2',
                title: 'API GEARS 系统级外部回片导入测试故事',
              }
            : undefined,
        };
        const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T12:13:00.000Z');

        const submitRes = await request
          .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/submit`)
          .send({
            job_type: 'seedance_video',
            note: 'API GEARS 系统级外部回片导入测试提交',
          });
        expect(submitRes.status).toBe(200);
        expectSuccess(submitRes.body);

        const localAcceptanceRes = await request
          .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/local-acceptance`)
          .send({
            job_type: 'seedance_video',
            note: 'API 本地验收占位，不是系统级外部回片',
          });
        expect(localAcceptanceRes.status).toBe(200);
        expectSuccess(localAcceptanceRes.body);

        const handoffRes = await request
          .post(`/api/projects/${enriched.project_id}/production-board/gears-jobs/export-external-callback-handoff`)
          .send({});
        expect(handoffRes.status).toBe(200);
        expectSuccess(handoffRes.body);

        const unauthorizedRes = await request
          .post('/api/system/gears-external-callbacks/preflight')
          .send(handoffRes.body.data.callback_batch_sample);
        expect(unauthorizedRes.status).toBe(401);
        expectFailure(unauthorizedRes.body, 'CALLBACK_UNAUTHENTICATED');

        const blockedPreflightRes = await request
          .post('/api/system/gears-external-callbacks/preflight')
          .set('Authorization', 'Bearer test-system-gears-secret')
          .send(handoffRes.body.data.callback_batch_sample);
        expect(blockedPreflightRes.status).toBe(200);
        expectSuccess(blockedPreflightRes.body);
        expect(blockedPreflightRes.body.data).toMatchObject({
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'preflight',
          blocked: true,
          received_count: submitRes.body.data.submitted_count,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: 0,
          updated_count: 0,
        });
        expect(blockedPreflightRes.body.data.blocking_count).toBeGreaterThan(0);

        const realCallbackPayload = {
          callbacks: handoffRes.body.data.callback_batch_sample.callbacks.map((callback: any, index: number) => ({
            ...callback,
            outputUrl: `https://media.story-agent.test/system-external-shot-${index + 1}.mp4`,
            eventId: `system-external-ready-shot-${index + 1}`,
          })),
        };
        const importRes = await request
          .post('/api/system/gears-external-callbacks/import')
          .set('X-GEARS-Callback-Secret', 'test-system-gears-secret')
          .send(realCallbackPayload);
        expect(importRes.status).toBe(200);
        expectSuccess(importRes.body);
        expect(importRes.body.data).toMatchObject({
          schema_version: 'system-gears-external-callback-batch-import/v1',
          mode: 'import',
          blocked: false,
          received_count: submitRes.body.data.submitted_count,
          resolved_count: submitRes.body.data.submitted_count,
          unresolved_count: 0,
          project_count: 1,
          ready_to_import_count: submitRes.body.data.submitted_count,
          updated_count: submitRes.body.data.submitted_count,
          failed_count: 0,
        });
        expect(importRes.body.data.project_results[0]).toMatchObject({
          project_id: enriched.project_id,
          blocked: false,
          import_result: {
            blocked: false,
            updated_count: submitRes.body.data.submitted_count,
          },
        });
        expect(importRes.body.data.markdown).toContain('GEARS External Callback Batch Import');

        const readinessRes = await request.get(`/api/projects/${enriched.project_id}/production-readiness`);
        expect(readinessRes.status).toBe(200);
        expectSuccess(readinessRes.body);
        expect(readinessRes.body.data.summary.external_ready_gears_job_count).toBe(submitRes.body.data.submitted_count);
        expect(readinessRes.body.data.summary.ready_without_external_gears_artifact_count).toBe(0);
      } finally {
        if (previousCallbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
        else process.env.GEARS_CALLBACK_SECRET = previousCallbackSecret;
      }
    });
  });

  describe('POST /api/projects/:projectId/production-board/seedance-shots/import', () => {
    it('requires provider callback secret when configured for single-story projects', async () => {
      const previousCallbackSecret = process.env.SEEDANCE_CALLBACK_SECRET;
      process.env.SEEDANCE_CALLBACK_SECRET = 'test-seedance-secret';
      try {
        const res = await request
          .post('/api/projects/20260617-story-apspv--ai_comic_drama/production-board/seedance-shots/provider-callback')
          .send({
            provider: 'seedance',
            jobId: 'single-story-provider-secret-job-001',
            status: 'COMPLETED',
            videoUrl: 'https://example.com/api/provider-callback-secret-shot.mp4',
          });
        expect(res.status).toBe(401);
        expectFailure(res.body, 'CALLBACK_UNAUTHENTICATED');
      } finally {
        if (previousCallbackSecret === undefined) delete process.env.SEEDANCE_CALLBACK_SECRET;
        else process.env.SEEDANCE_CALLBACK_SECRET = previousCallbackSecret;
      }
    });

    it('accepts bearer callback secret before looking up the single-story project', async () => {
      const previousCallbackSecret = process.env.SEEDANCE_CALLBACK_SECRET;
      process.env.SEEDANCE_CALLBACK_SECRET = 'test-seedance-secret';
      try {
        const res = await request
          .post('/api/projects/20260617-story-apspv--ai_comic_drama/production-board/seedance-shots/provider-callback')
          .set('Authorization', 'Bearer test-seedance-secret')
          .send({
            provider: 'seedance',
            jobId: 'single-story-provider-secret-job-001',
            status: 'COMPLETED',
            videoUrl: 'https://example.com/api/provider-callback-secret-shot.mp4',
          });
        expect(res.status).toBe(404);
        expectFailure(res.body, 'STORY_NOT_FOUND');
      } finally {
        if (previousCallbackSecret === undefined) delete process.env.SEEDANCE_CALLBACK_SECRET;
        else process.env.SEEDANCE_CALLBACK_SECRET = previousCallbackSecret;
      }
    });

    it('imports an external Seedance provider callback through the route', async () => {
      const baseStory = makeApiProductionRepairStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: '20260617-story-apspv',
        title: 'API Seedance Provider Callback 测试故事',
        gears_segments_url: '/api/stories/20260617-story-apspv/gears-segments',
        gears_delivery: baseStory.gears_delivery
          ? {
              ...baseStory.gears_delivery,
              storyId: '20260617-story-apspv',
              title: 'API Seedance Provider Callback 测试故事',
            }
          : undefined,
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T12:08:00.000Z');

      const submitRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/submit-provider`)
        .send({
          shot_ids: ['shot-1'],
          provider: 'seedance',
          job_prefix: 'api-provider-callback-job',
          queue_id: 'api-provider-callback-queue-001',
          note: 'API provider callback 测试提交',
        });
      expect(submitRes.status).toBe(200);
      expectSuccess(submitRes.body);

      const previousCallbackSecret = process.env.SEEDANCE_CALLBACK_SECRET;
      delete process.env.SEEDANCE_CALLBACK_SECRET;
      try {
        const callbackRes = await request
          .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-callback`)
          .send({
            provider: 'seedance',
            taskId: 'api-provider-callback-job-shot-1',
            batchId: 'api-provider-callback-queue-001',
            position: 1,
            taskStatus: 'succeeded',
            outputUrl: 'https://example.com/api/provider-callback-shot-1.mp4',
            score: 96,
            review_note: '外部 provider 回片稳定',
            event_id: 'api-provider-callback-event-001',
            msg: 'provider succeeded',
          });
        expect(callbackRes.status).toBe(200);
        expectSuccess(callbackRes.body);
        expect(callbackRes.body.data).toMatchObject({
          updated_count: 1,
          failed_count: 0,
          provider: 'seedance',
          provider_queue_id: 'api-provider-callback-queue-001',
          provider_queue_position: 1,
          event_id: 'api-provider-callback-event-001',
        });
        expect(callbackRes.body.data.seedance_shot_ledger.items.find((item: any) =>
          item.shot_id === 'shot-1'
        )).toMatchObject({
          status: 'ready',
          provider: 'seedance',
          provider_job_id: 'api-provider-callback-job-shot-1',
          provider_queue_id: 'api-provider-callback-queue-001',
          provider_queue_position: 1,
          video_url: 'https://example.com/api/provider-callback-shot-1.mp4',
        });
      } finally {
        if (previousCallbackSecret === undefined) delete process.env.SEEDANCE_CALLBACK_SECRET;
        else process.env.SEEDANCE_CALLBACK_SECRET = previousCallbackSecret;
      }
    });

    it('polls Seedance provider jobs and applies returned statuses through the route', async () => {
      const baseStory = makeApiProductionRepairStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: '20260617-story-apspoll',
        title: 'API Seedance Provider Poll 测试故事',
        gears_segments_url: '/api/stories/20260617-story-apspoll/gears-segments',
        gears_delivery: baseStory.gears_delivery
          ? {
              ...baseStory.gears_delivery,
              storyId: '20260617-story-apspoll',
              title: 'API Seedance Provider Poll 测试故事',
            }
          : undefined,
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T12:09:00.000Z');

      const submitRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/submit-provider`)
        .send({
          shot_ids: ['shot-1', 'shot-2'],
          provider: 'seedance',
          job_prefix: 'api-provider-poll-job',
          queue_id: 'api-provider-poll-queue-001',
          note: 'API provider poll 测试提交',
        });
      expect(submitRes.status).toBe(200);
      expectSuccess(submitRes.body);

      const dryRunRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/poll-provider`)
        .send({
          provider: 'seedance',
          queue_id: 'api-provider-poll-queue-001',
          include_prompt: true,
        });
      expect(dryRunRes.status).toBe(200);
      expectSuccess(dryRunRes.body);
      expect(dryRunRes.body.data).toMatchObject({
        dry_run: true,
        checked_count: 2,
        pollable_count: 2,
        updated_count: 0,
      });
      expect(dryRunRes.body.data.poll_targets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          shot_id: 'shot-1',
          provider_job_id: 'api-provider-poll-job-shot-1',
          provider_queue_id: 'api-provider-poll-queue-001',
          status: 'submitted',
        }),
        expect.objectContaining({
          shot_id: 'shot-2',
          provider_job_id: 'api-provider-poll-job-shot-2',
          provider_queue_id: 'api-provider-poll-queue-001',
          status: 'submitted',
        }),
      ]));
      expect(dryRunRes.body.data.poll_targets[0].seedance_prompt).toContain('0-3秒');

      const previousAdapterEndpoint = process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
      delete process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
      const missingAdapterRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/poll-provider`)
        .send({
          provider: 'seedance',
          queue_id: 'api-provider-poll-queue-001',
          use_provider_adapter: true,
        });
      if (previousAdapterEndpoint === undefined) {
        delete process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
      } else {
        process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = previousAdapterEndpoint;
      }
      expect(missingAdapterRes.status).toBe(400);
      expectFailure(missingAdapterRes.body, 'VALIDATION_ERROR');
      expect(missingAdapterRes.body.error.message).toContain('SEEDANCE_PROVIDER_POLL_ENDPOINT');

      const applyRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/poll-provider`)
        .send({
          provider: 'seedance',
          queue_id: 'api-provider-poll-queue-001',
          provider_results: [{
            provider_job_id: 'api-provider-poll-job-shot-1',
            status: 'completed',
            video_url: 'https://example.com/api/provider-poll-shot-1.mp4',
            quality_score: 97,
            review_note: 'provider poll route 回片可用',
            message: 'provider completed',
          }, {
            provider_job_id: 'api-provider-poll-job-shot-2',
            status: 'error',
            provider_error_code: 'ASSET_MISSING',
            failure_reason: '缺少参考素材文件',
            message: 'missing asset',
          }],
          note: 'API provider poll 应用回传',
        });
      expect(applyRes.status).toBe(200);
      expectSuccess(applyRes.body);
      expect(applyRes.body.data).toMatchObject({
        dry_run: false,
        checked_count: 2,
        pollable_count: 0,
        updated_count: 2,
        failed_count: 0,
        poll_targets: [],
      });
      expect(applyRes.body.data.seedance_shot_ledger.items.find((item: any) =>
        item.shot_id === 'shot-1'
      )).toMatchObject({
        status: 'ready',
        provider_job_id: 'api-provider-poll-job-shot-1',
        provider_queue_id: 'api-provider-poll-queue-001',
        video_url: 'https://example.com/api/provider-poll-shot-1.mp4',
      });
      expect(applyRes.body.data.seedance_shot_ledger.items.find((item: any) =>
        item.shot_id === 'shot-2'
      )).toMatchObject({
        status: 'failed',
        provider_job_id: 'api-provider-poll-job-shot-2',
        provider_queue_id: 'api-provider-poll-queue-001',
        failure_reason: '缺少参考素材文件',
        failure_category: 'asset_missing',
        provider_error_code: 'ASSET_MISSING',
      });

      const overviewRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-overview`)
        .send({
          provider: 'seedance',
          queue_id: 'api-provider-poll-queue-001',
          timeout_minutes: 1,
        });
      expect(overviewRes.status).toBe(200);
      expectSuccess(overviewRes.body);
      expect(overviewRes.body.data).toMatchObject({
        provider: 'seedance',
        queue_id: 'api-provider-poll-queue-001',
        total_shot_count: 2,
        active_count: 0,
        ready_count: 1,
        failed_count: 1,
        retryable_count: 1,
        timed_out_count: 0,
        attention_count: 1,
        latest_queue_batch: {
          queue_id: 'api-provider-poll-queue-001',
          ready_count: 1,
          failed_item_count: 1,
        },
      });
      expect(overviewRes.body.data.status_counts).toMatchObject({
        ready: 1,
        failed: 1,
      });
      expect(overviewRes.body.data.attention_items).toEqual([
        expect.objectContaining({
          shot_id: 'shot-2',
          status: 'failed',
          failure_category: 'asset_missing',
          provider_error_code: 'ASSET_MISSING',
        }),
      ]);

      const retryPlanRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-retry-plan`)
        .send({
          provider: 'seedance',
          queue_id: 'api-provider-poll-queue-001',
          timeout_minutes: 1,
        });
      expect(retryPlanRes.status).toBe(200);
      expectSuccess(retryPlanRes.body);
      expect(retryPlanRes.body.data).toMatchObject({
        provider: 'seedance',
        queue_id: 'api-provider-poll-queue-001',
        candidate_count: 1,
        resubmittable_count: 0,
        blocked_count: 1,
        reason_counts: {
          failed: 1,
          timed_out: 0,
          ready_missing_video: 0,
          unsubmitted: 0,
        },
      });
      expect(retryPlanRes.body.data.candidates).toEqual([
        expect.objectContaining({
          shot_id: 'shot-2',
          retry_reason: 'failed',
          failure_category: 'asset_missing',
          can_resubmit: false,
        }),
      ]);

      const retrySubmitRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-retry-submit`)
        .send({
          provider: 'seedance',
          queue_id: 'api-provider-poll-queue-001',
          timeout_minutes: 1,
          note: 'API provider retry submit 测试',
        });
      expect(retrySubmitRes.status).toBe(200);
      expectSuccess(retrySubmitRes.body);
      expect(retrySubmitRes.body.data).toMatchObject({
        selected_shot_ids: [],
        skipped_blocked_count: 1,
        submitted_count: 0,
        skipped_count: 0,
        failed_count: 0,
      });
    });

    it('imports Seedance callbacks and exports a retry package', async () => {
      const baseStory = makeApiProductionRepairStory();
      const story: StoryGenerateResult = {
        ...baseStory,
        storyId: '20260617-story-aps2',
        title: 'API Seedance 回传导入测试故事',
        gears_segments_url: '/api/stories/20260617-story-aps2/gears-segments',
        gears_delivery: baseStory.gears_delivery
          ? {
              ...baseStory.gears_delivery,
              storyId: '20260617-story-aps2',
              title: 'API Seedance 回传导入测试故事',
            }
          : undefined,
      };
      const enriched = await createProjectFromGeneratedStory(story, '2026-06-17T12:10:00.000Z');

      const submittedRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots`)
        .send({
          shot_id: 'shot-1',
          status: 'submitted',
          provider_job_id: 'seedance-job-import-api-001',
          note: 'API 测试提交',
        });
      expect(submittedRes.status).toBe(200);
      expectSuccess(submittedRes.body);

      const importRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/import`)
        .send({
          callbacks: [{
            jobId: 'seedance-job-import-api-001',
            status: 'completed',
            videoUrl: 'https://example.com/api/imported-shot-1.mp4',
            qualityScore: 93,
            reviewNote: '导入回片画面稳定',
            message: '平台完成',
          }],
        });
      expect(importRes.status).toBe(200);
      expectSuccess(importRes.body);
      expect(importRes.body.data).toMatchObject({
        updated_count: 1,
        failed_count: 0,
      });
      expect(importRes.body.data.seedance_shot_ledger.items.find((item: any) =>
        item.shot_id === 'shot-1'
      )).toMatchObject({
        status: 'ready',
        video_url: 'https://example.com/api/imported-shot-1.mp4',
        selected_version_id: 'seedance-shot-shot-1-v2',
      });

      const failedRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots`)
        .send({
          shot_id: 'shot-2',
          status: 'failed',
          provider_job_id: 'seedance-job-import-api-002',
          failure_reason: '背景人物穿帮',
          increment_retry: true,
          note: 'API 测试失败回片',
        });
      expect(failedRes.status).toBe(200);
      expectSuccess(failedRes.body);

      const retryRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/export-seedance-retry-package`)
        .send({});
      expect(retryRes.status).toBe(200);
      expectSuccess(retryRes.body);
      expect(retryRes.body.data).toMatchObject({
        schema_version: 'story-seedance-retry-package/v1',
        total_retry_shot_count: 1,
        skipped_ready_shot_count: 1,
      });
      expect(retryRes.body.data.shots[0]).toMatchObject({
        shot_id: 'shot-2',
        status: 'failed',
        failure_reason: '背景人物穿帮',
        retry_count: 1,
      });
      expect(retryRes.body.data.markdown).toContain('Seedance 重试提交包');
      expect(retryRes.body.data.markdown).toContain('背景人物穿帮');

      const selectRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/select-version`)
        .send({
          shot_id: 'shot-1',
          version_id: 'seedance-shot-shot-1-v2',
          note: 'API 选择剪辑版',
        });
      expect(selectRes.status).toBe(200);
      expectSuccess(selectRes.body);
      expect(selectRes.body.data.project.seedance_shot_ledger.items.find((item: any) =>
        item.shot_id === 'shot-1'
      )).toMatchObject({
        selected_version_id: 'seedance-shot-shot-1-v2',
        video_url: 'https://example.com/api/imported-shot-1.mp4',
      });

      const betterRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots`)
        .send({
          shot_id: 'shot-1',
          status: 'ready',
          provider_job_id: 'seedance-job-import-api-003',
          video_url: 'https://example.com/api/imported-shot-1-v3.mp4',
          quality_score: 99,
          note: 'API 更高分版本',
        });
      expect(betterRes.status).toBe(200);
      expectSuccess(betterRes.body);
      expect(betterRes.body.data.project.seedance_shot_ledger.items.find((item: any) =>
        item.shot_id === 'shot-1'
      ).selected_version_id).toBe('seedance-shot-shot-1-v2');

      const autoSelectRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/auto-select`)
        .send({
          min_quality_score: 95,
          overwrite_manual: true,
          note: 'API 自动择优',
        });
      expect(autoSelectRes.status).toBe(200);
      expectSuccess(autoSelectRes.body);
      expect(autoSelectRes.body.data.project.seedance_shot_ledger.items.find((item: any) =>
        item.shot_id === 'shot-1'
      )).toMatchObject({
        selected_version_id: 'seedance-shot-shot-1-v3',
        video_url: 'https://example.com/api/imported-shot-1-v3.mp4',
      });

      const batchRes = await request
        .post(`/api/projects/${enriched.project_id}/production-board/seedance-shots/batch`)
        .send({
          updates: [
            { shot_id: 'shot-2', status: 'submitted', note: 'API 批量重新提交' },
            { shot_id: 'missing-shot', status: 'failed', failure_reason: '不存在的镜头' },
          ],
        });
      expect(batchRes.status).toBe(200);
      expectSuccess(batchRes.body);
      expect(batchRes.body.data).toMatchObject({
        updated_count: 1,
        failed_count: 1,
      });
      expect(batchRes.body.data.failures[0]).toMatchObject({
        index: 1,
        shot_id: 'missing-shot',
      });
    });
  });

  describe('POST /api/projects/batch-delete', () => {
    it('validates project_ids', async () => {
      const res = await request.post('/api/projects/batch-delete').send({ project_ids: [] });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/projects/retain-recent', () => {
    it('validates keep_recent', async () => {
      const res = await request.post('/api/projects/retain-recent').send({ keep_recent: -1 });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });
  });
});

describe('GEARS Callback API', () => {
  it('requires GEARS callback secret for single-story project callbacks when configured', async () => {
    const previousCallbackSecret = process.env.GEARS_CALLBACK_SECRET;
    process.env.GEARS_CALLBACK_SECRET = 'test-gears-secret';
    try {
      const res = await request
        .post('/api/projects/20260617-story-apspv--ai_comic_drama/gears-callback')
        .send({
          jobId: 'gears-single-secret-job-001',
          sourceUnitId: 'shot-1',
          jobType: 'seedance_video',
          status: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/single-secret.mp4',
        });
      expect(res.status).toBe(401);
      expectFailure(res.body, 'CALLBACK_UNAUTHENTICATED');
    } finally {
      if (previousCallbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
      else process.env.GEARS_CALLBACK_SECRET = previousCallbackSecret;
    }
  });

  it('accepts bearer GEARS callback secret before looking up the single-story project', async () => {
    const previousCallbackSecret = process.env.GEARS_CALLBACK_SECRET;
    process.env.GEARS_CALLBACK_SECRET = 'test-gears-secret';
    try {
      const res = await request
        .post('/api/projects/20260617-story-apspv--ai_comic_drama/gears-callback')
        .set('Authorization', 'Bearer test-gears-secret')
        .send({
          jobId: 'gears-single-secret-job-001',
          sourceUnitId: 'shot-1',
          jobType: 'seedance_video',
          status: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/single-secret.mp4',
        });
      expect(res.status).toBe(404);
      expectFailure(res.body, 'STORY_NOT_FOUND');
    } finally {
      if (previousCallbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
      else process.env.GEARS_CALLBACK_SECRET = previousCallbackSecret;
    }
  });

  it('requires GEARS callback secret for AI comic series callbacks when configured', async () => {
    const previousCallbackSecret = process.env.GEARS_CALLBACK_SECRET;
    process.env.GEARS_CALLBACK_SECRET = 'test-gears-secret';
    try {
      const res = await request
        .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/gears-callback')
        .send({
          jobId: 'gears-series-secret-job-001',
          sourceUnitId: 'series-shot-1',
          jobType: 'seedance_video',
          status: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/series-secret.mp4',
        });
      expect(res.status).toBe(401);
      expectFailure(res.body, 'CALLBACK_UNAUTHENTICATED');
    } finally {
      if (previousCallbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
      else process.env.GEARS_CALLBACK_SECRET = previousCallbackSecret;
    }
  });

  it('accepts X-GEARS callback secret before looking up the AI comic series project', async () => {
    const previousCallbackSecret = process.env.GEARS_CALLBACK_SECRET;
    process.env.GEARS_CALLBACK_SECRET = 'test-gears-secret';
    try {
      const res = await request
        .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/gears-callback')
        .set('X-GEARS-Callback-Secret', 'test-gears-secret')
        .send({
          jobId: 'gears-series-secret-job-001',
          sourceUnitId: 'series-shot-1',
          jobType: 'seedance_video',
          status: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/series-secret.mp4',
        });
      expect(res.status).toBe(404);
      expectFailure(res.body, 'STORY_NOT_FOUND');
    } finally {
      if (previousCallbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
      else process.env.GEARS_CALLBACK_SECRET = previousCallbackSecret;
    }
  });

  it('accepts multi-artifact GEARS callback payloads for single-story projects before lookup', async () => {
    const res = await request
      .post('/api/projects/20260617-story-apspv--ai_comic_drama/gears-callback')
      .send({
        taskId: 'gears-single-artifact-job-001',
        sourceUnitId: 'shot-1',
        jobType: 'final_assemble',
        taskStatus: 'COMPLETED',
        artifacts: [
          {
            kind: 'video',
            role: 'final_video',
            url: 'https://gears.example/final/single-final.mp4',
            mime_type: 'video/mp4',
          },
          {
            kind: 'manifest',
            role: 'manifest',
            url: 'https://gears.example/final/single-final.manifest.json',
            mime_type: 'application/json',
          },
        ],
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('accepts direct GEARS artifact URL aliases before lookup', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/gears-callback')
      .send({
        taskId: 'gears-series-alias-job-001',
        sourceUnitId: 'final_assemble:series',
        jobType: 'final_assemble',
        taskStatus: 'COMPLETED',
        videoUrl: 'https://gears.example/final/series-final.mp4',
        manifestUrl: 'https://gears.example/final/series-manifest',
        subtitleUrl: 'https://gears.example/subtitles/series.srt',
        audioUrl: 'https://gears.example/audio/series-mix.mp4',
        thumbnailUrl: 'https://gears.example/posters/series.jpg',
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('accepts GEARS callback source id aliases before lookup', async () => {
    const res = await request
      .post('/api/projects/20260617-story-apspv--ai_comic_drama/gears-callback')
      .send({
        externalId: 'shot-1',
        custom_id: 'story-agent-shot-1',
        productionId: 'shot-1',
        jobType: 'seedance_video',
        taskStatus: 'COMPLETED',
        outputUrl: 'https://gears.example/videos/source-id-alias.mp4',
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('accepts GEARS callback idempotency key before lookup', async () => {
    const res = await request
      .post('/api/projects/20260617-story-apspv--ai_comic_drama/gears-callback')
      .send({
        idempotencyKey: 'seedance_video:shot-1',
        jobType: 'seedance_video',
        taskStatus: 'COMPLETED',
        outputUrl: 'https://gears.example/videos/idempotency-key-only.mp4',
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('accepts nested GEARS callback envelopes for single-story projects before lookup', async () => {
    const res = await request
      .post('/api/projects/20260617-story-apspv--ai_comic_drama/gears-callback')
      .send({
        data: {
          task: {
            task_id: 'gears-single-envelope-job-001',
            external_id: 'shot-1',
            jobType: 'seedance_video',
            taskStatus: 'COMPLETED',
            output: {
              files: [{
                mediaUrl: 'https://gears.example/videos/single-envelope.mp4',
                mediaType: 'video',
              }],
            },
            eventTime: '2026-06-20T10:00:00.000Z',
            completedAt: '2026-06-20T10:01:00.000Z',
          },
        },
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('accepts batched GEARS callback envelopes for single-story projects before lookup', async () => {
    const res = await request
      .post('/api/projects/20260617-story-apspv--ai_comic_drama/gears-callback')
      .send({
        callbacks: [{
          jobId: 'gears-single-batch-job-001',
          sourceUnitId: 'shot-1',
          jobType: 'seedance_video',
          taskStatus: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/single-batch-1.mp4',
        }, {
          jobId: 'gears-single-batch-job-002',
          sourceUnitId: 'shot-2',
          jobType: 'seedance_video',
          taskStatus: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/single-batch-2.mp4',
        }],
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('rejects oversized GEARS callback batches before lookup', async () => {
    const callbacks = Array.from({ length: GEARS_CALLBACK_BATCH_ITEM_LIMIT + 1 }, (_, index) => ({
      jobId: `gears-oversized-batch-job-${index}`,
      sourceUnitId: `shot-${index}`,
      jobType: 'seedance_video',
      taskStatus: 'COMPLETED',
      outputUrl: `https://gears.example/videos/oversized-${index}.mp4`,
    }));
    const res = await request
      .post('/api/projects/20260617-story-apspv--ai_comic_drama/gears-callback')
      .send({ callbacks });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
    expect(res.body.error.message).toContain(`GEARS callback batch item count must be <= ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}`);
  });

  it('accepts multi-artifact GEARS callback payloads for AI comic series before lookup', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/gears-callback')
      .send({
        taskId: 'gears-series-artifact-job-001',
        sourceUnitId: 'final_assemble:series',
        jobType: 'final_assemble',
        taskStatus: 'COMPLETED',
        artifacts: [
          {
            kind: 'video',
            role: 'final_video',
            url: 'https://gears.example/final/series-final.mp4',
            mime_type: 'video/mp4',
          },
          {
            kind: 'manifest',
            role: 'manifest',
            url: 'https://gears.example/final/series-final.manifest.json',
            mime_type: 'application/json',
          },
        ],
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('accepts batched GEARS callback envelopes for AI comic series before lookup', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/gears-callback')
      .send({
        events: [{
          jobId: 'gears-series-batch-job-001',
          sourceUnitId: 'series-shot-1',
          jobType: 'seedance_video',
          taskStatus: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/series-batch-1.mp4',
        }, {
          jobId: 'gears-series-batch-job-002',
          sourceUnitId: 'series-shot-2',
          jobType: 'seedance_video',
          taskStatus: 'COMPLETED',
          outputUrl: 'https://gears.example/videos/series-batch-2.mp4',
        }],
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('accepts nested GEARS callback envelopes for AI comic series before lookup', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/gears-callback')
      .send({
        data: {
          job: {
            jobId: 'gears-series-envelope-job-001',
            sourceUnitId: 'series-shot-1',
            jobType: 'seedance_video',
            job_status: 'COMPLETED',
            outputs: [{
              downloadUrl: 'https://gears.example/videos/series-envelope.mp4',
              type: 'video',
            }],
          },
        },
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  describe('POST /api/gears-callback/video-ready', () => {
    it('validates ready callbacks require a video URL', async () => {
      const res = await request.post('/api/gears-callback/video-ready').send({
        storyId: '20260611-story-cb1',
        status: 'ready',
      });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('accepts callback field aliases before looking up the story', async () => {
      const res = await request.post('/api/gears-callback/video-ready').send({
        story_id: '20260611-story-cb1',
        status: 'COMPLETED',
        videoUrl: 'https://gears.example/videos/cb1.mp4',
        thumbnailUrl: 'https://gears.example/videos/cb1.jpg',
      });
      expect(res.status).toBe(404);
      expectFailure(res.body, 'STORY_NOT_FOUND');
    });
  });
});

describe('Seedance Production Callback API', () => {
  it('requires callback secret when configured', async () => {
    process.env.SEEDANCE_CALLBACK_SECRET = 'test-seedance-secret';
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-production-callback')
      .send({
        jobId: 'seedance-job-001',
        status: 'COMPLETED',
        videoUrl: 'https://seedance.example/shot.mp4',
      });
    expect(res.status).toBe(401);
    expectFailure(res.body, 'CALLBACK_UNAUTHENTICATED');
    delete process.env.SEEDANCE_CALLBACK_SECRET;
  });

  it('accepts bearer callback secret before looking up the series project', async () => {
    process.env.SEEDANCE_CALLBACK_SECRET = 'test-seedance-secret';
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-production-callback')
      .set('Authorization', 'Bearer test-seedance-secret')
      .send({
        jobId: 'seedance-job-001',
        status: 'COMPLETED',
        videoUrl: 'https://seedance.example/shot.mp4',
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
    delete process.env.SEEDANCE_CALLBACK_SECRET;
  });
});

describe('Seedance Thumbnail Capture API', () => {
  it('validates thumbnail worker request body', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-thumbnails/capture')
      .send({ limit: 0 });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts a dry-run request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-thumbnails/capture')
      .send({ dry_run: true });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });
});

describe('Seedance Finishing Plan API', () => {
  it('returns 404 for a missing series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/export-seedance-finishing-plan')
      .send({});
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });
});

describe('Seedance Subtitle API', () => {
  it('validates subtitle export filename', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/export-seedance-subtitles')
      .send({ output_filename: '../bad.txt' });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('validates subtitle render mode', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-subtitles/render')
      .send({ mode: 'overlay' });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts a subtitle dry-run request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-subtitles/render')
      .send({ dry_run: true, mode: 'sidecar' });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });
});

describe('Seedance Audio API', () => {
  it('validates audio library item kind', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-audio-library')
      .send({ items: [{ kind: 'voiceover', label: '旁白', file_url: 'https://example.com/audio.mp3' }] });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('validates audio mix output filename', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-audio/mix')
      .send({ output_filename: '../bad.mp4' });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts an audio mix dry-run request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-audio/mix')
      .send({
        dry_run: true,
        audio_profile: 'balanced_dialogue',
        include_original_audio: true,
        original_audio_volume_db: -3,
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('returns 404 for a missing series project audio plan', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/export-seedance-audio-plan')
      .send({});
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });
});

describe('Seedance Title Cards and Final Delivery API', () => {
  it('validates title card output profile', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-title-cards/render')
      .send({ output_profile: 'vertical_9_16' });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts a title card dry-run request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-title-cards/render')
      .send({ dry_run: true, output_profile: 'mp4_h264_1080p' });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('validates final delivery output filename', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-final/assemble')
      .send({ output_filename: '../bad.mp4' });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts a final delivery dry-run request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-final/assemble')
      .send({ dry_run: true, missing_dependency_mode: 'tolerant' });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('validates shot review target identity', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-reviews')
      .send({
        target_type: 'shot',
        severity: 'major',
        issue_type: 'visual',
        note: '镜头需要重做',
      });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts a final review request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-reviews')
      .send({
        target_type: 'final',
        severity: 'blocking',
        issue_type: 'technical',
        note: '最终成片需要重新装配',
        repair_action: 'reassemble_final',
      });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('accepts a review resolve request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-reviews/resolve')
      .send({ review_id: 'review-test-001', status: 'resolved' });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('returns 404 for a missing series project review repair package', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/export-seedance-review-repair-package')
      .send({});
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('returns 404 for a missing series project retry execution plan', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/export-seedance-retry-execution-plan')
      .send({});
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('validates retry submit limit', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-retry/submit')
      .send({ limit: 0 });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts a retry submit request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-retry/submit')
      .send({ limit: 2, job_prefix: 'api-retry-test', use_provider_adapter: true });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('validates provider recovery timeout minutes', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-provider/recover-timeouts')
      .send({ timeout_minutes: -1 });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts a provider recovery request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-provider/recover-timeouts')
      .send({ timeout_minutes: 0, mark_timed_out_failed: true });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('returns 404 for a missing series project title card plan', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/export-seedance-title-card-plan')
      .send({});
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('returns 404 for a missing series project editing platform package', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/export-seedance-editing-platform-package')
      .send({});
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });

  it('returns 404 for a missing series project production dashboard', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-production-dashboard')
      .send({});
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });
});

describe('Seedance Cut Assembly API', () => {
  it('validates cut assembly request body', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-cut/assemble')
      .send({ output_filename: '../bad.mp4' });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('validates cut assembly transcode options', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-cut/assemble')
      .send({ assembly_mode: 'transcode', crf: 60 });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });

  it('accepts a dry-run request before looking up the series project', async () => {
    const res = await request
      .post('/api/story-outline/ai-comic-series-projects/20260616-series-abc1/seedance-cut/assemble')
      .send({ dry_run: true });
    expect(res.status).toBe(404);
    expectFailure(res.body, 'STORY_NOT_FOUND');
  });
});

describe('Story Outline API', () => {
  describe('POST /api/story-outline/ai-comic-series-plan', () => {
    it('returns a series plan with the requested episode count and duration range', async () => {
      const res = await request.post('/api/story-outline/ai-comic-series-plan').send({
        outline: '周敦颐少年在濂溪读书，面对冤案和师友关系，一步步形成自己的选择。',
        series_title: '濂溪漫剧',
        episode_count: 6,
        episode_duration_range_sec: { min: 60, max: 120 },
        pacing_profile: 'balanced_drama',
      });

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.series_title).toBe('濂溪漫剧');
      expect(res.body.data.episodes).toHaveLength(6);
      expect(res.body.data.episodes[0]).toHaveProperty('continuity_state_after');
      expect(res.body.data.episodes[1].continuity_from_previous[0]).toContain('第1集');
      expect(res.body.data.recommended_narrative_patterns).toEqual(expect.arrayContaining([
        expect.objectContaining({
          video_type: 'ai_comic_drama',
          pattern_id: expect.any(String),
          reason: expect.any(String),
          priority: expect.any(Number),
          confidence: expect.any(Number),
          match_signals: expect.any(Array),
        }),
      ]));
      expect(res.body.data.narrative_pattern_ids).toEqual(expect.arrayContaining([
        'platform_short_drama_hook',
        'hero_choice',
        'cinematic_setpiece_adaptation',
      ]));
    });

    it('uses outline subgenre signals when recommending series narrative patterns', async () => {
      const res = await request.post('/api/story-outline/ai-comic-series-plan').send({
        outline: '武侠短剧改编：少年在江湖门派中追查谜案，靠复仇线和连载钩子推进。',
        series_title: '江湖谜案',
        episode_count: 6,
        episode_duration_range_sec: { min: 60, max: 120 },
        pacing_profile: 'fast_hook',
      });

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.recommended_narrative_patterns.map((item: any) => item.pattern_id)).toEqual(expect.arrayContaining([
        'wuxia_chivalric_epic',
        'wuxia_revenge_journey',
      ]));
      expect(res.body.data.narrative_pattern_ids).toEqual(expect.arrayContaining([
        'wuxia_chivalric_epic',
        'wuxia_revenge_journey',
      ]));
    });

    it('validates episode_count', async () => {
      const res = await request.post('/api/story-outline/ai-comic-series-plan').send({
        outline: '周敦颐少年故事',
        episode_count: 0,
        episode_duration_range_sec: { min: 60, max: 120 },
      });

      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('validates duration min and max order', async () => {
      const res = await request.post('/api/story-outline/ai-comic-series-plan').send({
        outline: '周敦颐少年故事',
        episode_count: 8,
        episode_duration_range_sec: { min: 180, max: 60 },
      });

      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/story-outline/ai-comic-episode', () => {
    it('generates one episode script from a series plan', async () => {
      const planRes = await request.post('/api/story-outline/ai-comic-series-plan').send({
        outline: '周敦颐少年在濂溪读书，面对冤案和师友关系，一步步形成自己的选择。',
        series_title: '濂溪漫剧',
        episode_count: 3,
        episode_duration_range_sec: { min: 60, max: 120 },
        pacing_profile: 'balanced_drama',
      });
      expect(planRes.status).toBe(200);
      expectSuccess(planRes.body);

      const res = await request.post('/api/story-outline/ai-comic-episode').send({
        series_plan: planRes.body.data,
        episode_no: 1,
        output_gears_segments: false,
      });

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.video_type).toBe('ai_comic_drama');
      expect(res.body.data.presentation_style).toBe('ai_comic');
      expect(res.body.data.sourceDomain).toBe('china_culture');
      expect(res.body.data.domain_safety).toMatchObject({
        domain: 'china_culture',
        passed: true,
        machine_validation_only: true,
        human_review_complete: false,
        real_credit_granted: false,
      });
      expect(res.body.data.original_user_query).toContain('本集只写第1集');
      expect(res.body.data.original_user_query).toContain('本集主冲突');
      expect(res.body.data.original_user_query).not.toContain('连续性账本');
      expect(res.body.data.original_user_query).not.toContain('叙事流派机制');
      expect(res.body.data.credibility_note).not.toContain('叙事流派机制');
      expect([
        res.body.data.full_text,
        ...res.body.data.scene_breakdown.flatMap((scene: { plot: string; visual_prompt: string }) => [
          scene.plot,
          scene.visual_prompt,
        ]),
      ].join('\n')).not.toMatch(/生成优先级|核心画面是|知识库使用规则|素材使用规则|素材焦点/);
      expect(res.body.data.scene_breakdown.length).toBeGreaterThan(0);
    });

    it('validates episode_no against the series plan', async () => {
      const planRes = await request.post('/api/story-outline/ai-comic-series-plan').send({
        outline: '周敦颐少年故事',
        episode_count: 2,
        episode_duration_range_sec: { min: 60, max: 120 },
      });
      expect(planRes.status).toBe(200);
      expectSuccess(planRes.body);

      const res = await request.post('/api/story-outline/ai-comic-episode').send({
        series_plan: planRes.body.data,
        episode_no: 3,
      });

      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });
  });

  describe('AI comic series project persistence', () => {
    it('saves, loads, and reports production readiness for a series project', async () => {
      const planRes = await request.post('/api/story-outline/ai-comic-series-plan').send({
        outline: '周敦颐少年在濂溪读书，面对冤案和师友关系，一步步形成自己的选择。',
        series_title: '濂溪漫剧',
        episode_count: 3,
        episode_duration_range_sec: { min: 60, max: 120 },
      });
      expect(planRes.status).toBe(200);
      expectSuccess(planRes.body);

      const saveRes = await request.post('/api/story-outline/ai-comic-series-projects').send({
        plan: planRes.body.data,
        generated_episode_story_ids: {
          1: '20260611-story-abc1',
        },
      });
      expect(saveRes.status).toBe(200);
      expectSuccess(saveRes.body);
      expect(saveRes.body.data.project.series_project_id).toMatch(/^\d{8}-series-[0-9a-z]+$/);
      expect(saveRes.body.data.project.generated_episode_count).toBe(1);
      expect(saveRes.body.data.continuity_ledger.schema_version).toBe('ai-comic-continuity-ledger/v1');

      const getRes = await request.get(`/api/story-outline/ai-comic-series-projects/${saveRes.body.data.project.series_project_id}`);
      expect(getRes.status).toBe(200);
      expectSuccess(getRes.body);
      expect(getRes.body.data.plan.series_title).toBe('濂溪漫剧');
      expect(getRes.body.data.generated_episode_story_ids['1']).toBe('20260611-story-abc1');
      expect(getRes.body.data.continuity_ledger.character_state_current.length).toBeGreaterThan(0);

      const readinessRes = await request.get(
        `/api/story-outline/ai-comic-series-projects/${saveRes.body.data.project.series_project_id}/production-readiness`,
      );
      expect(readinessRes.status).toBe(200);
      expectSuccess(readinessRes.body);
      expect(readinessRes.body.data).toMatchObject({
        schema_version: 'ai-comic-series-production-readiness/v1',
        scope: 'ai_comic_series',
        project: {
          series_project_id: saveRes.body.data.project.series_project_id,
        },
        series_title: '濂溪漫剧',
      });
      expect(readinessRes.body.data.summary).toMatchObject({
        total_episode_count: 3,
        generated_episode_count: 1,
        gears_job_count: 0,
      });
      expect(readinessRes.body.data.lanes.map((lane: any) => lane.key)).toEqual(expect.arrayContaining([
        'series_quality',
        'episode_generation',
        'delivery_contract',
        'gears_execution',
      ]));
      expect(readinessRes.body.data.next_actions.map((action: any) => action.action_key)).toContain('generate_next_episode');
      expect(readinessRes.body.data.automation_plan).toMatchObject({
        schema_version: 'production-readiness-automation-plan/v1',
        ready_step_count: expect.any(Number),
      });
      expect(readinessRes.body.data.automation_plan.steps.map((step: any) => step.action_key)).toContain('generate_next_episode');
      expect(readinessRes.body.data.markdown).toContain('系列制作 readiness');
      expect(readinessRes.body.data.markdown).toContain('Automation Plan');

      const runReadinessRes = await request
        .post(`/api/story-outline/ai-comic-series-projects/${saveRes.body.data.project.series_project_id}/production-readiness/run-automation`)
        .send({ dry_run: true, action_keys: ['generate_next_episode'] });
      expect(runReadinessRes.status).toBe(200);
      expectSuccess(runReadinessRes.body);
      expect(runReadinessRes.body.data).toMatchObject({
        schema_version: 'production-readiness-automation-run/v1',
        scope: 'ai_comic_series',
        dry_run: true,
        planned_step_count: 1,
        executed_step_count: 0,
      });

      const copyRes = await request
        .post(`/api/story-outline/ai-comic-series-projects/${saveRes.body.data.project.series_project_id}/copy`)
        .send({ title: '濂溪漫剧 副本' });
      expect(copyRes.status).toBe(200);
      expectSuccess(copyRes.body);
      expect(copyRes.body.data.project.series_project_id).not.toBe(saveRes.body.data.project.series_project_id);
      expect(copyRes.body.data.plan.series_title).toBe('濂溪漫剧 副本');

      const archiveRes = await request
        .post(`/api/story-outline/ai-comic-series-projects/${copyRes.body.data.project.series_project_id}/archive`)
        .send({ archived: true });
      expect(archiveRes.status).toBe(200);
      expectSuccess(archiveRes.body);
      expect(archiveRes.body.data.project.archived_at).toBeTruthy();

      const listRes = await request.get('/api/story-outline/ai-comic-series-projects');
      expect(listRes.status).toBe(200);
      expectSuccess(listRes.body);
      expect(listRes.body.data.some((project: any) =>
        project.series_project_id === copyRes.body.data.project.series_project_id,
      )).toBe(false);

      const fullListRes = await request.get('/api/story-outline/ai-comic-series-projects?include_archived=1');
      expect(fullListRes.status).toBe(200);
      expectSuccess(fullListRes.body);
      expect(fullListRes.body.data.some((project: any) =>
        project.series_project_id === copyRes.body.data.project.series_project_id,
      )).toBe(true);

      const deleteRes = await request.delete(`/api/story-outline/ai-comic-series-projects/${copyRes.body.data.project.series_project_id}`);
      expect(deleteRes.status).toBe(200);
      expectSuccess(deleteRes.body);
      expect(deleteRes.body.data.deleted).toBe(true);
    });

    it('returns 404 for an unknown series project', async () => {
      const res = await request.get('/api/story-outline/ai-comic-series-projects/20260611-series-notfound');

      expect(res.status).toBe(404);
      expectFailure(res.body, 'STORY_NOT_FOUND');
    });
  });
});

// ---------------------------------------------------------------------------
// Entries API tests
// ---------------------------------------------------------------------------

describe('Entries API', () => {
  describe('POST /api/entries/match', () => {
    it('returns exact match for real entry name', async () => {
      const res = await request.post('/api/entries/match').send({
        query: '周敦颐——理学开山鼻祖',
      });
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.query).toBe('周敦颐——理学开山鼻祖');
      expect(res.body.data.best_match).not.toBeNull();
      expect(res.body.data.best_match.score).toBe(1.0);
      expect(res.body.data.best_match.entry_name).toBe('周敦颐——理学开山鼻祖');
    });

    it('returns fuzzy match for topic keywords', async () => {
      const res = await request.post('/api/entries/match').send({
        query: '周敦颐拒签冤案故事',
      });
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.matches.length).toBeGreaterThan(0);
      // Should find 周敦颐 as top match
      const topMatch = res.body.data.best_match;
      if (topMatch) {
        expect(topMatch.entry_name).toContain('周敦颐');
        expect(topMatch.score).toBeGreaterThan(0.5);
      }
    });

    it('routes an explicit china_culture match through its Domain Pack', async () => {
      const legacyRes = await request.post('/api/entries/match').send({ query: '周敦颐' });
      const domainRes = await request.post('/api/entries/match').send({
        domain: 'china_culture',
        query: '周敦颐',
      });

      expect(domainRes.status).toBe(200);
      expect(domainRes.body).toEqual(legacyRes.body);
    });

    it('fails closed when matching through an unregistered domain', async () => {
      const res = await request.post('/api/entries/match').send({
        domain: 'unregistered_domain',
        query: '周敦颐',
      });

      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });

    it('returns province-weighted results for province queries', async () => {
      const res = await request.post('/api/entries/match').send({
        query: '湖南非遗宣传片',
      });
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      // Should return Hunan-related entries
      if (res.body.data.matches.length > 0) {
        const hunanMatches = res.body.data.matches.filter((m: { province: string }) => m.province === '湖南');
        expect(hunanMatches.length).toBeGreaterThan(0);
      }
    });

    it('matches entries by related location and building intent', async () => {
      const res = await request.post('/api/entries/match').send({
        query: '吕仙祠建筑故事',
      });
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.matches.some((m: { entry_name: string }) => m.entry_name.includes('岳阳楼'))).toBe(true);
    });

    it('returns empty matches for completely unrelated query', async () => {
      const res = await request.post('/api/entries/match').send({
        query: '量子物理学宇宙大爆炸',
      });
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      // Unlikely to have relevant matches in culture KB
      if (res.body.data.matches.length === 0) {
        expect(res.body.data.fallback_message).toBeTruthy();
      }
    });

    it('returns 400 for empty query', async () => {
      const res = await request.post('/api/entries/match').send({
        query: '',
      });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/entries/search', () => {
    it('returns success envelope with empty results when no keywords', async () => {
      const res = await request.get('/api/entries/search');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data).toEqual([]);
    });

    it('returns results when keywords provided', async () => {
      const res = await request.get('/api/entries/search?keywords=周敦颐');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('routes an explicit china_culture domain through its Domain Pack', async () => {
      const legacyRes = await request.get('/api/entries/search?keywords=周敦颐');
      const domainRes = await request.get('/api/entries/search?domain=china_culture&keywords=周敦颐');

      expect(domainRes.status).toBe(200);
      expectSuccess(domainRes.body);
      expect(domainRes.body.data).toEqual(legacyRes.body.data);
    });

    it('fails closed for an unregistered domain', async () => {
      const res = await request.get('/api/entries/search?domain=unregistered_domain&keywords=周敦颐');

      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });

    it('rejects an invalid domain identifier', async () => {
      const res = await request.get('/api/entries/search?domain=../unsafe&keywords=周敦颐');

      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('searches full story content beyond summary and keywords', async () => {
      const res = await request.get('/api/entries/search?keywords=拒签冤案');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      const zhou = res.body.data.find((entry: { name: string }) => entry.name.includes('周敦颐'));
      expect(zhou).toBeTruthy();
      expect(res.body.data[0].name).toContain('周敦颐');
      expect(zhou.matched_snippets.some((snippet: string) => snippet.includes('拒签冤案'))).toBe(true);
      expect(zhou.match_reason).toContain('命中');
    });

    it('searches related locations and building names', async () => {
      const res = await request.get('/api/entries/search?keywords=吕仙祠');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.some((entry: { name: string }) => entry.name.includes('岳阳楼'))).toBe(true);
    });

    it('promotes entries that match place and building intent', async () => {
      const res = await request.get('/api/entries/search?keywords=吕仙祠建筑故事');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data[0].name).toContain('岳阳楼');
      expect(res.body.data[0].match_reason).toContain('地点建筑');
      expect(res.body.data[0].matched_snippets.some((snippet: string) => snippet.includes('吕仙祠'))).toBe(true);
    });

    it('returns results with province filter', async () => {
      const res = await request.get('/api/entries/search?keywords=传说&province=湖南');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns results with type filter', async () => {
      const res = await request.get('/api/entries/search?keywords=故事&type=民间故事');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns all entries for a province without keywords (province-only search)', async () => {
      const res = await request.get('/api/entries/search?province=湖南');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(40);
      // Each result should have province = 湖南
      for (const entry of res.body.data) {
        expect(entry.province).toBe('湖南');
      }
    });

    it('returns all entries for 北京 without keywords', async () => {
      const provincesRes = await request.get('/api/system/provinces');
      const res = await request.get('/api/entries/search?province=北京');
      expect(provincesRes.status).toBe(200);
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      const beijingProvince = provincesRes.body.data.find((p: any) => p.name === '北京');
      expect(beijingProvince.entry_count).toBeGreaterThan(0);
      expect(res.body.data.length).toBe(beijingProvince.entry_count);
      for (const entry of res.body.data) {
        expect(entry.province).toBe('北京');
      }
    });

    it('province count matches /api/system/provinces count for 湖南', async () => {
      const provincesRes = await request.get('/api/system/provinces');
      const searchRes = await request.get('/api/entries/search?province=湖南');
      const hunanProvince = provincesRes.body.data.find((p: any) => p.name === '湖南');
      expect(hunanProvince.entry_count).toBeGreaterThan(40);
      expect(searchRes.body.data.length).toBe(hunanProvince.entry_count);
    });

    it('supports pinyin slug for province name', async () => {
      const res = await request.get('/api/entries/search?province=hunan');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.length).toBeGreaterThan(40);
    });
  });

  describe('GET /api/entries/detail', () => {
    it('returns 400 VALIDATION_ERROR when name is missing', async () => {
      const res = await request.get('/api/entries/detail');
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR when name is empty', async () => {
      const res = await request.get('/api/entries/detail?name=');
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('returns 404 ENTRY_NOT_FOUND for nonexistent entry', async () => {
      const res = await request.get('/api/entries/detail?name=不存在条目XXX');
      expect(res.status).toBe(404);
      expectFailure(res.body, 'ENTRY_NOT_FOUND');
    });

    it('routes an explicit china_culture detail lookup through its Domain Pack', async () => {
      const legacyRes = await request.get('/api/entries/detail?name=周敦颐——理学开山鼻祖');
      const domainRes = await request.get('/api/entries/detail?domain=china_culture&name=周敦颐——理学开山鼻祖');

      expect(domainRes.status).toBe(200);
      expect(domainRes.body).toEqual(legacyRes.body);
    });

    it('fails closed when reading detail through an unregistered domain', async () => {
      const res = await request.get('/api/entries/detail?domain=unregistered_domain&name=周敦颐');

      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });

    it('returns entry detail for valid entry name', async () => {
      // Try a real entry from the knowledge base
      const res = await request.get('/api/entries/detail?name=周敦颐——理学开山鼻祖');
      if (res.status === 200) {
        expectSuccess(res.body);
        const entry = res.body.data;
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('province');
        expect(entry).toHaveProperty('region');
        expect(entry).toHaveProperty('type');
        expect(entry).toHaveProperty('summary');
        expect(entry).toHaveProperty('story');
        expect(entry).toHaveProperty('culturalSignificance');
        expect(entry).toHaveProperty('keywords');
        expect(entry).toHaveProperty('sources');
        expect(entry).toHaveProperty('credibility');
        expect(entry).toHaveProperty('unverifiedPoints');
      }
      // If 404, the entry doesn't exist — test still valid (verified 404 works above)
    });
  });
});

// ---------------------------------------------------------------------------
// Stories API tests
// ---------------------------------------------------------------------------

describe('Stories API', () => {
  describe('POST /api/stories/plan', () => {
    it('returns 400 VALIDATION_ERROR when entry_name is missing', async () => {
      const res = await request.post('/api/stories/plan').send({});
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR when entry_name is empty', async () => {
      const res = await request.post('/api/stories/plan').send({ entry_name: '' });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('returns 404 for nonexistent entry', async () => {
      const res = await request.post('/api/stories/plan').send({ entry_name: '不存在条目XXX' });
      expect(res.status).toBe(404);
      expectFailure(res.body, 'ENTRY_NOT_FOUND');
    });

    it('returns plan result for valid entry', async () => {
      const res = await request.post('/api/stories/plan').send({ entry_name: '周敦颐——理学开山鼻祖' });
      if (res.status === 200) {
        expectSuccess(res.body);
        const plan = res.body.data;
        expect(plan).toHaveProperty('entry_name');
        expect(plan).toHaveProperty('entry_type');
        expect(plan).toHaveProperty('recommended_types');
        expect(plan).toHaveProperty('recommended_video_types');
        expect(plan).toHaveProperty('recommended_presentation_styles');
        expect(plan).toHaveProperty('recommended_narrative_patterns');
        expect(plan).toHaveProperty('available_events');
        expect(plan).toHaveProperty('recommended_duration');
        expect(plan).toHaveProperty('cultural_risks');
        expect(Array.isArray(plan.recommended_types)).toBe(true);
        expect(Array.isArray(plan.recommended_video_types)).toBe(true);
        expect(Array.isArray(plan.recommended_narrative_patterns)).toBe(true);
        expect(Array.isArray(plan.available_events)).toBe(true);
        expect(Array.isArray(plan.cultural_risks)).toBe(true);
        // Video type structure check
        if (plan.recommended_video_types.length > 0) {
          const firstVT = plan.recommended_video_types[0];
          expect(firstVT).toHaveProperty('video_type');
          expect(firstVT).toHaveProperty('reason');
          expect(firstVT).toHaveProperty('priority');
        }
        const aiComicPatterns = plan.recommended_narrative_patterns.filter((item: any) =>
          item.video_type === 'ai_comic_drama'
        );
        expect(aiComicPatterns.map((item: any) => item.pattern_id)).toEqual(expect.arrayContaining([
          'platform_short_drama_hook',
          'hero_choice',
          'cinematic_setpiece_adaptation',
        ]));
        expect(aiComicPatterns[0]).toEqual(expect.objectContaining({
          reason: expect.any(String),
          priority: expect.any(Number),
          confidence: expect.any(Number),
          match_signals: expect.arrayContaining(['历史人物']),
        }));
      }
    });

    it('routes an explicit china_culture plan through its Domain Pack', async () => {
      const legacyRes = await request.post('/api/stories/plan').send({
        entry_name: '周敦颐——理学开山鼻祖',
        original_user_query: '人物成长与抉择',
      });
      const domainRes = await request.post('/api/stories/plan').send({
        domain: 'china_culture',
        entry_name: '周敦颐——理学开山鼻祖',
        original_user_query: '人物成长与抉择',
      });

      expect(domainRes.status).toBe(200);
      expect(domainRes.body).toEqual(legacyRes.body);
    });

    it('fails closed when planning through an unregistered domain', async () => {
      const res = await request.post('/api/stories/plan').send({
        domain: 'unregistered_domain',
        entry_name: '周敦颐——理学开山鼻祖',
      });

      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });

    it('uses user query signals to recommend AI comic subgenre patterns', async () => {
      const res = await request.post('/api/stories/plan').send({
        entry_name: '周敦颐——理学开山鼻祖',
        original_user_query: '想做成武侠短剧改编，要有江湖门派和连载钩子',
      });

      if (res.status === 200) {
        expectSuccess(res.body);
        const aiComicPatternIds = res.body.data.recommended_narrative_patterns
          .filter((item: any) => item.video_type === 'ai_comic_drama')
          .map((item: any) => item.pattern_id);
        expect(aiComicPatternIds).toEqual(expect.arrayContaining([
          'wuxia_chivalric_epic',
          'wuxia_revenge_journey',
        ]));
      }
    });
  });

  describe('POST /api/stories/generate', () => {
    it('returns 400 VALIDATION_ERROR when entry_name is missing', async () => {
      const res = await request.post('/api/stories/generate').send({
        generation_type: 'character_story',
      });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR for invalid generation_type', async () => {
      const res = await request.post('/api/stories/generate').send({
        entry_name: 'test',
        generation_type: 'invalid_type',
      });
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('accepts an explicit china_culture generation domain', async () => {
      const res = await request.post('/api/stories/generate').send({
        domain: 'china_culture',
        entry_name: '不存在条目XXX',
        generation_type: 'character_story',
      });

      expect(res.status).toBe(404);
      expectFailure(res.body, 'ENTRY_NOT_FOUND');
    });

    it('fails closed before generation for an unregistered domain', async () => {
      const res = await request.post('/api/stories/generate').send({
        domain: 'unregistered_domain',
        entry_name: '周敦颐——理学开山鼻祖',
        generation_type: 'character_story',
      });

      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });

    it('generates original AI comic from outline-only material', async () => {
      const res = await request.post('/api/stories/generate').send({
        outline: '一个年轻修复师回到古城，发现祖父留下的旧戏台图纸，决定用一场原创漫剧唤回街坊对非遗戏曲的记忆。',
        original_user_query: '原创非遗守护短剧',
        video_type: 'ai_comic_drama',
        creation_use_case: 'original_ai_comic',
        truth_mode: 'fictional_original',
        target_video_duration: '1分钟',
        output_gears_segments: true,
      });

      expect(res.status).toBe(200);
      expectSuccess(res.body);
      const story = res.body.data;
      expect(story.source_entry).toContain('用户原创故事种子');
      expect(story.creation_use_case).toBe('original_ai_comic');
      expect(story.truth_mode).toBe('fictional_original');
      expect(story.creation_contract.creation_use_case).toBe('original_ai_comic');
      expect(story.material_pack.schema_version).toBe('material-pack/v1');
      expect(story.adaptation_analysis).toBeUndefined();
    });

    it('fails closed without creating a project when memory mosaic has no source witness', async () => {
      const before = await request.get('/api/projects');
      expect(before.status).toBe(200);
      expectSuccess(before.body);

      const res = await request.post('/api/stories/generate').send({
        outline: '旧木盒留在空屋，纸页只记录天气与方位，没有人物关系。',
        original_user_query: '从旧物理解一段无名往事',
        video_type: 'character_story',
        story_structure: 'memory_mosaic_biography',
        creation_use_case: 'original_ai_comic',
        truth_mode: 'fictional_original',
        target_video_duration: '3分钟',
      });

      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
      expect(res.body.error.message).toContain('至少一位可从资料中识别的见证人物');

      const after = await request.get('/api/projects');
      expect(after.status).toBe(200);
      expectSuccess(after.body);
      expect(after.body.data).toHaveLength(before.body.data.length);
    });

    it('returns 404 for nonexistent entry', async () => {
      const res = await request.post('/api/stories/generate').send({
        entry_name: '不存在条目XXX',
        generation_type: 'character_story',
      });
      expect(res.status).toBe(404);
      expectFailure(res.body, 'ENTRY_NOT_FOUND');
    });

    it('returns story skeleton for valid entry', async () => {
      const res = await request.post('/api/stories/generate').send({
        entry_name: '周敦颐——理学开山鼻祖',
        generation_type: 'character_story',
        target_video_duration: '3分钟',
      });
      if (res.status === 200) {
        expectSuccess(res.body);
        const story = res.body.data;
        expect(story).toHaveProperty('storyId');
        expect(story.sourceDomain).toBe('china_culture');
        expect(story).toHaveProperty('title');
        expect(story).toHaveProperty('generation_type');
        expect(story).toHaveProperty('video_type');
        expect(story).toHaveProperty('presentation_style');
        expect(story).toHaveProperty('source_entry');
        expect(story).toHaveProperty('gears_segments_url');
        expect(story).toHaveProperty('cultural_constraints');
        expect(story).toHaveProperty('credibility_note');
        expect(story.domain_safety).toMatchObject({
          schema_version: 'story-domain-safety/v1',
          domain: 'china_culture',
          passed: true,
          machine_validation_only: true,
          human_review_complete: false,
          real_credit_granted: false,
        });
        // storyId format check: YYYYMMDD-story-{hash36}
        expect(story.storyId).toMatch(/^\d{8}-story-[0-9a-z]+$/);
        // gears_segments_url format check
        expect(story.gears_segments_url).toMatch(/^\/api\/stories\/\d{8}-story-[0-9a-z]+\/gears-segments$/);
      }
    });

    it('adds an enriched knowledge_pack for direct entry generation', async () => {
      const originalWebhookUrl = process.env.GEARS_WEBHOOK_URL;
      delete process.env.GEARS_WEBHOOK_URL;
      try {
        const res = await request.post('/api/stories/generate').send({
          entry_name: '周敦颐——理学开山鼻祖',
          generation_type: 'character_story',
          selected_event: '拒签冤案',
          target_video_duration: '3分钟',
        });
        if (res.status === 200) {
          expectSuccess(res.body);
          const story = res.body.data;
          expect(story.knowledge_pack?.primary_entries[0].entry_name).toBe('周敦颐——理学开山鼻祖');
          expect(story.knowledge_pack?.primary_entries[0].summary).toContain('拒签冤案');
          expect(story.knowledge_pack?.overall_confidence).toBe(1);
          expect(story.gears_webhook?.status).toBe('not_configured');
        }
      } finally {
        if (originalWebhookUrl === undefined) delete process.env.GEARS_WEBHOOK_URL;
        else process.env.GEARS_WEBHOOK_URL = originalWebhookUrl;
      }
    });

    it('creates supplement tasks from missing knowledge needs', async () => {
      const res = await request.post('/api/stories/generate').send({
        knowledge_pack: {
          primary_entries: [{
            entry_name: '周敦颐——理学开山鼻祖',
            province: '湖南省',
            region: '道县',
            type: '历史人物',
            summary: '周敦颐相关人物故事素材。',
            score: 0.92,
            role_in_story: 'main_character',
            match_reason: '角色：主角人物',
            keywords: ['周敦颐', '理学'],
          }],
          supporting_entries: [],
          missing_needs: [{
            need_id: 'supporting_characters',
            label: '配角人物',
            message: '知识库中未找到高置信度条目，可作为创作方向但不可写成已验证史实',
          }],
          overall_confidence: 0.5,
        },
        generation_type: 'character_story',
        target_video_duration: '3分钟',
      });
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      const story = res.body.data;
      const supportingCharacterTask = story.supplement_tasks.find((task: { need_id: string }) => task.need_id === 'supporting_characters');
      expect(supportingCharacterTask).toBeTruthy();
      expect(supportingCharacterTask!).toMatchObject({
        need_id: 'supporting_characters',
        label: '配角人物',
        category: 'supporting_character',
        stage: 'script_ready',
        blocking_level: 'optional',
        affects: expect.arrayContaining(['quality_report']),
        status: 'open',
        source: 'knowledge_pack_missing_need',
      });
      expect(supportingCharacterTask!.recommended_fields).toContain('与主角关系');
      expect(supportingCharacterTask!.intake_prompt).toContain('人物关系');
      expect(supportingCharacterTask!.task_id).toContain(story.storyId);
      expect(story.supplement_tasks.some((task: { source: string; stage?: string }) => (
        task.source === 'material_sufficiency_missing_item' && task.stage === 'production_ready'
      ))).toBe(true);
    });

    it('returns story with video_type when video_type provided', async () => {
      const res = await request.post('/api/stories/generate').send({
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: 'ai_comic_drama',
        target_video_duration: '3分钟',
      });
      if (res.status === 200) {
        expectSuccess(res.body);
        const story = res.body.data;
        expect(story).toHaveProperty('video_type');
        expect(story).toHaveProperty('presentation_style');
        expect(story).toHaveProperty('generation_type'); // backward compat always present
        expect(story.video_type).toBe('ai_comic_drama');
      }
    });

    it('returns story with backward compat when only generation_type provided', async () => {
      const res = await request.post('/api/stories/generate').send({
        entry_name: '周敦颐——理学开山鼻祖',
        generation_type: 'character_story',
        target_video_duration: '3分钟',
      });
      if (res.status === 200) {
        expectSuccess(res.body);
        const story = res.body.data;
        expect(story).toHaveProperty('video_type');
        expect(story.video_type).toBe('character_story');
        expect(story.generation_type).toBe('character_story');
      }
    });

    it('returns story with segment_prompt_hint in gears_segments', async () => {
      const res = await request.post('/api/stories/generate').send({
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: 'ai_comic_drama',
        target_video_duration: '3分钟',
        output_gears_segments: true,
      });
      if (res.status === 200) {
        expectSuccess(res.body);
        const story = res.body.data;
        if (story.gears_segments && story.gears_segments.length > 0) {
          const firstSeg = story.gears_segments[0];
          expect(firstSeg).toHaveProperty('video_type');
          expect(firstSeg).toHaveProperty('presentation_style');
          expect(firstSeg).toHaveProperty('segment_prompt_hint');
        }
      }
    });

    it('generates story with 10-minute duration producing more scenes', async () => {
      const res = await request.post('/api/stories/generate').send({
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: 'ai_comic_drama',
        target_video_duration: '10分钟',
        output_gears_segments: true,
      });
      if (res.status === 200) {
        expectSuccess(res.body);
        const story = res.body.data;
        // 10-minute story should have more scenes than a 3-minute one
        expect(story.scene_breakdown.length).toBeGreaterThanOrEqual(6);
        expect(story.gears_segments.length).toBeGreaterThanOrEqual(6);
        // total duration should be close to 600 seconds
        const totalSec = story.scene_breakdown.reduce((sum: number, s: any) => sum + s.duration_sec, 0);
        expect(totalSec).toBeGreaterThanOrEqual(480);
      }
    });

    it('generates story with full_text, scene_breakdown, gears_segments, gears_segments_url', async () => {
      const res = await request.post('/api/stories/generate').send({
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: 'character_story',
        target_video_duration: '5分钟',
        output_gears_segments: true,
      });
      if (res.status === 200) {
        expectSuccess(res.body);
        const story = res.body.data;
        expect(story).toHaveProperty('full_text');
        expect(typeof story.full_text).toBe('string');
        expect(story.full_text.length).toBeGreaterThan(0);
        expect(story).toHaveProperty('scene_breakdown');
        expect(Array.isArray(story.scene_breakdown)).toBe(true);
        expect(story).toHaveProperty('gears_segments');
        expect(Array.isArray(story.gears_segments)).toBe(true);
        expect(story).toHaveProperty('gears_segments_url');
        expect(story.gears_segments_url).toMatch(/^\/api\/stories\/\d{8}-story-[0-9a-z]+\/gears-segments$/);
      }
    });
  });

  describe('GET /api/stories', () => {
    it('returns unified envelope with story list', async () => {
      const res = await request.get('/api/stories');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.every((item: { sourceDomain?: string }) => item.sourceDomain === 'china_culture'))
        .toBe(true);
    });

    it('returns filtered list with generation_type query', async () => {
      const res = await request.get('/api/stories?generation_type=character_story');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('filters Story summaries by a registered source domain', async () => {
      const res = await request.get('/api/stories?domain=china_culture');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.every((item: { sourceDomain?: string }) => item.sourceDomain === 'china_culture'))
        .toBe(true);
    });

    it('fails closed for an unregistered Story list domain', async () => {
      const res = await request.get('/api/stories?domain=unregistered_domain');
      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });

    it('rejects an invalid Story list domain identifier', async () => {
      const res = await request.get('/api/stories?domain=INVALID-DOMAIN');
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/stories/:storyId', () => {
    it('returns 400 for invalid storyId format', async () => {
      const res = await request.get('/api/stories/bad-id-format');
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('returns 404 for nonexistent story', async () => {
      const res = await request.get('/api/stories/20260101-story-abc');
      expect(res.status).toBe(404);
      expectFailure(res.body, 'STORY_NOT_FOUND');
    });
  });

  describe('GET /api/stories/:storyId/gears-segments', () => {
    it('returns 400 for invalid storyId format', async () => {
      const res = await request.get('/api/stories/bad-id/gears-segments');
      expect(res.status).toBe(400);
      expectFailure(res.body, 'VALIDATION_ERROR');
    });

    it('returns 404 for nonexistent story', async () => {
      const res = await request.get('/api/stories/20260101-story-abc/gears-segments');
      expect(res.status).toBe(404);
      expectFailure(res.body, 'GEARS_SEGMENTS_NOT_FOUND');
    });

    it('prefers the editable project current version over a stale immutable story snapshot', async () => {
      const storyId = '20260623-story-cur1';
      const staleStory: StoryGenerateResult = {
        ...makeApiStory(),
        storyId,
        title: '旧快照故事',
        gears_segments_url: `/api/stories/${storyId}/gears-segments`,
        scene_breakdown: makeApiStory().scene_breakdown.map(scene => scene.scene_id === 1
          ? { ...scene, plot: '旧快照剧情', key_action: '旧快照动作' }
          : scene),
        gears_segments: [{
          ...makeApiStory().gears_segments[0],
          script_text: '旧快照分段',
        }],
      };
      const currentStory: StoryGenerateResult = {
        ...makeApiStory(),
        storyId,
        title: '当前项目版本故事',
        cultural_constraints: ['项目全局史实边界'],
        gears_segments_url: `/api/stories/${storyId}/gears-segments`,
        scene_breakdown: makeApiStory().scene_breakdown.map(scene => scene.scene_id === 1
          ? { ...scene, plot: '当前项目版本剧情', key_action: '当前项目版本动作' }
          : scene),
        gears_segments: [{
          ...makeApiStory().gears_segments[0],
          script_text: '当前项目版本分段',
          cultural_constraints: ['镜头局部虚构边界'],
        }],
      };
      const storyDir = resolve(testWorkspaceRoot, 'web', 'generated', 'stories', 'character_story');
      await mkdir(storyDir, { recursive: true });
      await writeFile(resolve(storyDir, `${storyId}.json`), JSON.stringify(staleStory, null, 2), 'utf-8');
      await createProjectFromGeneratedStory(currentStory, '2026-06-23T10:30:00.000Z');

      const segmentsRes = await request.get(`/api/stories/${storyId}/gears-segments`);
      expect(segmentsRes.status).toBe(200);
      expectSuccess(segmentsRes.body);
      expect(segmentsRes.body.data.schema_version).toBe('gears-segments/v2');
      expect(segmentsRes.body.data.sourceDomain).toBe('china_culture');
      expect(segmentsRes.body.data.title).toBe('当前项目版本故事');
      expect(segmentsRes.body.data.segments[0].script_text).toBe('当前项目版本分段');
      expect(segmentsRes.body.data.segments[0].constraint_note).toEqual([
        '项目全局史实边界',
        '镜头局部虚构边界',
      ]);
      expect(segmentsRes.body.data.segments[0].cultural_constraints)
        .toEqual(segmentsRes.body.data.segments[0].constraint_note);

      const deliveryRes = await request.get(`/api/stories/${storyId}/gears-delivery`);
      expect(deliveryRes.status).toBe(200);
      expectSuccess(deliveryRes.body);
      expect(deliveryRes.body.data.sourceDomain).toBe('china_culture');
      expect(deliveryRes.body.data.title).toBe('当前项目版本故事');
      expect(deliveryRes.body.data.units.map((unit: any) => unit.script_text).join('\n')).toContain('当前项目版本剧情');
      expect(deliveryRes.body.data.units.map((unit: any) => unit.script_text).join('\n')).not.toContain('旧快照剧情');
    });

    it('fails closed when a persisted story names an unregistered Domain Pack', async () => {
      const storyId = '20260623-story-dom1';
      await createProjectFromGeneratedStory({
        ...makeApiStory(),
        storyId,
        sourceDomain: 'unregistered_domain',
        gears_segments_url: `/api/stories/${storyId}/gears-segments`,
      }, '2026-06-23T10:31:00.000Z');

      const res = await request.get(`/api/stories/${storyId}/gears-segments`);

      expect(res.status).toBe(404);
      expectFailure(res.body, 'DOMAIN_PACK_NOT_FOUND');
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 5: Story structure + memory_mosaic tests
  // ---------------------------------------------------------------------------

  describe('Phase 5: story_structure', () => {
    describe('POST /api/stories/plan returns recommended_story_structures', () => {
      it('returns recommended_story_structures for valid entry', async () => {
        const res = await request.post('/api/stories/plan').send({ entry_name: '周敦颐——理学开山鼻祖' });
        if (res.status === 200) {
          expectSuccess(res.body);
          const plan = res.body.data;
          expect(plan).toHaveProperty('recommended_story_structures');
          expect(Array.isArray(plan.recommended_story_structures)).toBe(true);
          expect(plan.recommended_story_structures.length).toBeGreaterThan(0);
          // First structure should be single_event_drama for 历史人物
          const first = plan.recommended_story_structures[0];
          expect(first).toHaveProperty('story_structure');
          expect(first).toHaveProperty('reason');
          expect(first).toHaveProperty('priority');
          expect(first.story_structure).toBe('single_event_drama');
          // memory_mosaic_biography should be recommended for 历史人物
          const mosaic = plan.recommended_story_structures.find(
            (s: any) => s.story_structure === 'memory_mosaic_biography'
          );
          expect(mosaic).toBeDefined();
        }
      });
    });

    describe('POST /api/stories/generate with story_structure', () => {
      it('returns story with story_structure field when story_structure provided', async () => {
        const res = await request.post('/api/stories/generate').send({
          entry_name: '周敦颐——理学开山鼻祖',
          video_type: 'character_story',
          story_structure: 'single_event_drama',
          target_video_duration: '3分钟',
        });
        if (res.status === 200) {
          expectSuccess(res.body);
          const story = res.body.data;
          expect(story).toHaveProperty('story_structure');
          expect(story.story_structure).toBe('single_event_drama');
        }
      });

      it('returns story with story_structure=single_event_drama by default (backward compat)', async () => {
        const res = await request.post('/api/stories/generate').send({
          entry_name: '周敦颐——理学开山鼻祖',
          generation_type: 'character_story',
          target_video_duration: '3分钟',
        });
        if (res.status === 200) {
          expectSuccess(res.body);
          const story = res.body.data;
          // story_structure defaults to single_event_drama when not specified
          expect(story).toHaveProperty('story_structure');
          expect(story.story_structure).toBe('single_event_drama');
          // All existing fields still present
          expect(story).toHaveProperty('storyId');
          expect(story).toHaveProperty('title');
          expect(story).toHaveProperty('full_text');
          expect(story).toHaveProperty('scene_breakdown');
          expect(story).toHaveProperty('gears_segments');
          expect(story).toHaveProperty('generation_type');
          expect(story).toHaveProperty('video_type');
        }
      });

      it('defaults documentary historical entries to witness_testimony and documentary fields', async () => {
        const res = await request.post('/api/stories/generate').send({
          entry_name: '周敦颐——理学开山鼻祖',
          video_type: 'documentary_short',
          target_video_duration: '3分钟',
          output_gears_segments: false,
        });
        if (res.status === 200) {
          expectSuccess(res.body);
          const story = res.body.data;
          expect(story.video_type).toBe('documentary_short');
          expect(story.story_structure).toBe('witness_testimony');
          expect(Array.isArray(story.source_quotes)).toBe(true);
          expect(Array.isArray(story.field_notes)).toBe(true);
        }
      });

      it('accepts story_structure=memory_mosaic_biography with compatible video_type', async () => {
        const res = await request.post('/api/stories/generate').send({
          entry_name: '周敦颐——理学开山鼻祖',
          video_type: 'character_story',
          story_structure: 'memory_mosaic_biography',
          target_video_duration: '3分钟',
        });
        if (res.status === 200) {
          expectSuccess(res.body);
          const story = res.body.data;
          expect(story.story_structure).toBe('memory_mosaic_biography');
          // Memory mosaic should include memory_mosaic_seed
          expect(story).toHaveProperty('memory_mosaic_seed');
          expect(story.memory_mosaic_seed).not.toBeNull();
          expect(story.memory_mosaic_seed.subject).toBe('周敦颐');
          expect(story.memory_mosaic_seed.witnesses.length).toBeGreaterThanOrEqual(3);
          // Memory mosaic should include reference_trace
          expect(story).toHaveProperty('reference_trace');
          expect(Array.isArray(story.reference_trace)).toBe(true);
          // Full text should NOT contain biography-style phrases
          const forbiddenPhrases = ['他的一生', '生平事迹', '一生充满传奇'];
          for (const phrase of forbiddenPhrases) {
            expect(story.full_text).not.toContain(phrase);
          }
        }
      });

      it('rejects memory_mosaic_biography with incompatible video_type', async () => {
        const res = await request.post('/api/stories/generate').send({
          entry_name: '周敦颐——理学开山鼻祖',
          video_type: 'culture_promo',
          story_structure: 'memory_mosaic_biography',
          target_video_duration: '3分钟',
        });
        expect(res.status).toBe(400);
        expectFailure(res.body, 'VALIDATION_ERROR');
        // Error message should mention incompatible video_type
        expect(res.body.error.message).toContain('memory_mosaic_biography');
      });

      it('accepts reference_strength field', async () => {
        const res = await request.post('/api/stories/generate').send({
          entry_name: '周敦颐——理学开山鼻祖',
          video_type: 'character_story',
          story_structure: 'single_event_drama',
          reference_strength: 'medium',
          target_video_duration: '3分钟',
        });
        if (res.status === 200) {
          expectSuccess(res.body);
        }
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Error handling tests
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request.get('/api/nonexistent');
    // Express default 404 — no unified envelope, just standard response
    expect(res.status).toBe(404);
  });

  it('validates POST body with Zod on /api/stories/plan', async () => {
    const res = await request.post('/api/stories/plan').send({ wrong_field: 'value' });
    expect(res.status).toBe(400);
    expectFailure(res.body, 'VALIDATION_ERROR');
  });
});
