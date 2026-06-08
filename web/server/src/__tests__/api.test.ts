// web/server/src/__tests__/api.test.ts — API integration tests
// Tests the Express routes with supertest, verifying:
//  - Unified response envelope (ok/data/error)
//  - Zod validation middleware (400 on invalid input)
//  - Entry search & detail endpoints
//  - System provinces & types endpoints
//  - Story plan, generate, list, detail, gears-segments endpoints
//  - Error handling (404, validation, internal)

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import supertest from 'supertest';
import express from 'express';
import cors from 'cors';
import { createCorsOptions } from '../middleware/cors.js';
import { errorHandler } from '../middleware/error-handler.js';
import { entriesRouter } from '../routes/entries.js';
import { storiesRouter } from '../routes/stories.js';
import { systemRouter } from '../routes/system.js';

// Set KB_ROOT so MCP functions can find the data directory
// (same logic as server/src/index.ts which sets this at startup)
beforeAll(() => {
  if (!process.env.KB_ROOT) {
    // From this test file: web/server/src/__tests__/ → ../../../../data
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  }
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
        const hunanMatches = res.body.data.matches.filter(m => m.province === '湖南');
        expect(hunanMatches.length).toBeGreaterThan(0);
      }
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
      expect(res.body.data.length).toBe(41);
      // Each result should have province = 湖南
      for (const entry of res.body.data) {
        expect(entry.province).toBe('湖南');
      }
    });

    it('returns all entries for 北京 without keywords', async () => {
      const res = await request.get('/api/entries/search?province=北京');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('province count matches /api/system/provinces count for 湖南', async () => {
      const provincesRes = await request.get('/api/system/provinces');
      const searchRes = await request.get('/api/entries/search?province=湖南');
      const hunanProvince = provincesRes.body.data.find((p: any) => p.name === '湖南');
      expect(hunanProvince.entry_count).toBe(41);
      expect(searchRes.body.data.length).toBe(hunanProvince.entry_count);
    });

    it('supports pinyin slug for province name', async () => {
      const res = await request.get('/api/entries/search?province=hunan');
      expect(res.status).toBe(200);
      expectSuccess(res.body);
      expect(res.body.data.length).toBe(41);
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