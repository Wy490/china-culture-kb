import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildGearsStoryReadyPayload, notifyGearsStoryReady } from '../services/gears-webhook-service.js';
import type { StoryGenerateResult } from '@shared/types.js';

const ORIGINAL_KB_ROOT = process.env.KB_ROOT;
const ORIGINAL_WEBHOOK_URL = process.env.GEARS_WEBHOOK_URL;
const TEMP_DIRS: string[] = [];

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260611-story-webhook',
    project_id: '20260611-story-webhook--character_story',
    title: 'Webhook 测试故事',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '测试 webhook 推送。',
    theme: '测试',
    full_text: '第一段。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '开场',
        duration_sec: 30,
        location: '濂溪',
        time_of_day: '清晨',
        dramatic_function: '开场',
        plot: '开场',
        key_action: '开场',
        characters: ['周敦颐'],
        visual_prompt: '清晨溪畔',
        camera_suggestion: '中景',
        cultural_note: '测试',
      },
    ],
    gears_segments: [
      {
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 30,
        panel_count: 6,
        script_text: '脚本',
        purpose: '开场',
        visual_focus: ['濂溪'],
        cultural_constraints: ['测试'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
    ],
    gears_segments_url: '/api/stories/20260611-story-webhook/gears-segments',
    cultural_constraints: ['测试'],
    credibility_note: '测试',
    gears_delivery: {
      schema_version: 'gears-delivery/v1',
      storyId: '20260611-story-webhook',
      title: 'Webhook 测试故事',
      markdown: 'markdown',
      character_assets: [],
      scene_assets: [],
      units: [],
      validation_notes: ['请补录人物经历'],
    },
  };
}

afterEach(async () => {
  if (ORIGINAL_KB_ROOT === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = ORIGINAL_KB_ROOT;
  if (ORIGINAL_WEBHOOK_URL === undefined) delete process.env.GEARS_WEBHOOK_URL;
  else process.env.GEARS_WEBHOOK_URL = ORIGINAL_WEBHOOK_URL;
  vi.unstubAllGlobals();
  for (const dir of TEMP_DIRS.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('gears-webhook-service', () => {
  it('builds a webhook payload from story data', () => {
    const payload = buildGearsStoryReadyPayload(makeStory(), new Date('2026-06-11T10:00:00.000Z'));
    expect(payload.event).toBe('story_ready');
    expect(payload.storyId).toBe('20260611-story-webhook');
    expect(payload.total_duration_sec).toBe(30);
    expect(payload.panel_count_total).toBe(6);
    expect(payload.validation_notes_count).toBe(1);
    expect(payload.gears_delivery_url).toContain('/api/stories/20260611-story-webhook/gears-delivery');
  });

  it('skips when webhook is not configured', async () => {
    delete process.env.GEARS_WEBHOOK_URL;
    const result = await notifyGearsStoryReady(makeStory(), { retryDelaysMs: [0] });
    expect(result).toEqual({ status: 'skipped', reason: 'not_configured' });
  });

  it('sends the webhook when configured', async () => {
    process.env.GEARS_WEBHOOK_URL = 'https://grears.example/api/webhook/story-ready';
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(_url).toBe('https://grears.example/api/webhook/story-ready');
      const body = JSON.parse(String(init?.body ?? '{}')) as { storyId: string; event: string };
      expect(body.storyId).toBe('20260611-story-webhook');
      expect(body.event).toBe('story_ready');
      return { ok: true, status: 204 } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await notifyGearsStoryReady(makeStory(), { retryDelaysMs: [0], timeoutMs: 10 });
    expect(result).toEqual({ status: 'sent', attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('logs a failure after retries are exhausted', async () => {
    const tempRoot = await mkdtemp(resolve(tmpdir(), 'gears-webhook-'));
    TEMP_DIRS.push(tempRoot);
    process.env.KB_ROOT = resolve(tempRoot, 'data');
    process.env.GEARS_WEBHOOK_URL = 'https://grears.example/api/webhook/story-ready';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch);

    const result = await notifyGearsStoryReady(makeStory(), { retryDelaysMs: [0, 0, 0], timeoutMs: 10 });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.attempts).toBe(3);
    }

    const logPath = resolve(tempRoot, 'web/generated/webhook_failures.log');
    const log = await readFile(logPath, 'utf-8');
    expect(log).toContain('20260611-story-webhook');
    expect(log).toContain('https://grears.example/api/webhook/story-ready');
  });
});
