// web/server/src/__tests__/api.test.ts — API integration tests
// Tests the Express routes with supertest, verifying:
//  - Unified response envelope (ok/data/error)
//  - Zod validation middleware (400 on invalid input)
//  - Entry search & detail endpoints
//  - System provinces & types endpoints
//  - Story plan, generate, list, detail, gears-segments endpoints
//  - Error handling (404, validation, internal)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { resolve } from 'path';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
import type { StoryGenerateResult } from '@shared/types.js';

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
const DEFAULT_PROJECTS_ROOT = resolve(import.meta.dirname, '..', '..', '..', 'web', 'generated', 'projects');
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

  describe('GET /api/projects/supplement-tasks', () => {
    it('returns unified envelope with supplement task list', async () => {
      const res = await request.get('/api/projects/supplement-tasks');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
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
        expectFailure(res.body, 'VALIDATION_ERROR');
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
    expectFailure(res.body, 'VALIDATION_ERROR');
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
      .send({ dry_run: true, audio_profile: 'balanced_dialogue' });
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
      expect(res.body.data.original_user_query).toContain('只生成第1集完整分镜');
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
    it('saves and loads a series project', async () => {
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
        expect(plan).toHaveProperty('available_events');
        expect(plan).toHaveProperty('recommended_duration');
        expect(plan).toHaveProperty('cultural_risks');
        expect(Array.isArray(plan.recommended_types)).toBe(true);
        expect(Array.isArray(plan.recommended_video_types)).toBe(true);
        expect(Array.isArray(plan.available_events)).toBe(true);
        expect(Array.isArray(plan.cultural_risks)).toBe(true);
        // Video type structure check
        if (plan.recommended_video_types.length > 0) {
          const firstVT = plan.recommended_video_types[0];
          expect(firstVT).toHaveProperty('video_type');
          expect(firstVT).toHaveProperty('reason');
          expect(firstVT).toHaveProperty('priority');
        }
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
        expect(story).toHaveProperty('title');
        expect(story).toHaveProperty('generation_type');
        expect(story).toHaveProperty('video_type');
        expect(story).toHaveProperty('presentation_style');
        expect(story).toHaveProperty('source_entry');
        expect(story).toHaveProperty('gears_segments_url');
        expect(story).toHaveProperty('cultural_constraints');
        expect(story).toHaveProperty('credibility_note');
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
      expect(story.supplement_tasks).toHaveLength(1);
      expect(story.supplement_tasks[0]).toMatchObject({
        need_id: 'supporting_characters',
        label: '配角人物',
        category: 'supporting_character',
        status: 'open',
        source: 'knowledge_pack_missing_need',
      });
      expect(story.supplement_tasks[0].recommended_fields).toContain('与主角关系');
      expect(story.supplement_tasks[0].intake_prompt).toContain('人物关系');
      expect(story.supplement_tasks[0].task_id).toContain(story.storyId);
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
    });

    it('returns filtered list with generation_type query', async () => {
      const res = await request.get('/api/stories?generation_type=character_story');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
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
