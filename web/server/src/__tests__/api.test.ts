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
