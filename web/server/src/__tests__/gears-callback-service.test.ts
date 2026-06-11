import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { updateGearsVideoReady } from '../services/story-service.js';
import type { StoryGenerateResult, StoryProjectMeta, StoryProjectVersionSnapshot } from '@shared/types.js';

let tempRoot = '';
let previousKbRoot: string | undefined;

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260611-story-cb1',
    project_id: '20260611-story-cb1--character_story',
    current_version_id: '20260611-story-cb1--character_story-v1',
    title: '成片回调测试',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '测试条目',
    logline: '测试 logline',
    theme: '测试 theme',
    full_text: '测试正文',
    scene_breakdown: [],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260611-story-cb1/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试可信度',
  };
}

beforeEach(async () => {
  previousKbRoot = process.env.KB_ROOT;
  tempRoot = await mkdtemp(resolve(tmpdir(), 'gears-callback-'));
  process.env.KB_ROOT = resolve(tempRoot, 'data');
});

afterEach(async () => {
  if (previousKbRoot === undefined) {
    delete process.env.KB_ROOT;
  } else {
    process.env.KB_ROOT = previousKbRoot;
  }
  await rm(tempRoot, { recursive: true, force: true });
});

describe('updateGearsVideoReady', () => {
  it('persists video result to story file and current project version', async () => {
    const story = makeStory();
    const storyPath = resolve(tempRoot, 'web', 'generated', 'stories', story.video_type, `${story.storyId}.json`);
    await mkdir(resolve(storyPath, '..'), { recursive: true });
    await writeFile(storyPath, JSON.stringify(story, null, 2), 'utf-8');

    const projectId = story.project_id!;
    const versionId = story.current_version_id!;
    const projectDir = resolve(tempRoot, 'web', 'generated', 'projects', projectId);
    const versionPath = resolve(projectDir, 'versions', `${versionId}.json`);
    const metaPath = resolve(projectDir, 'project.json');
    const meta: StoryProjectMeta = {
      project_id: projectId,
      current_story_id: story.storyId,
      title: story.title,
      source_domain: 'china_culture',
      source_entry: story.source_entry,
      video_type: story.video_type,
      presentation_style: story.presentation_style,
      status: 'draft',
      created_at: '2026-06-11T00:00:00.000Z',
      updated_at: '2026-06-11T00:00:00.000Z',
      current_version_id: versionId,
      version_count: 1,
      scene_count: 0,
      has_gears_segments: false,
      credibility_note: story.credibility_note,
      logline: story.logline,
    };
    const snapshot: StoryProjectVersionSnapshot = {
      project_id: projectId,
      version_id: versionId,
      created_at: meta.created_at,
      change_type: 'initial_generation',
      scene_ids_changed: [],
      story,
    };
    await mkdir(resolve(versionPath, '..'), { recursive: true });
    await writeFile(versionPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    const res = await updateGearsVideoReady({
      storyId: story.storyId,
      status: 'ready',
      video_url: 'https://gears.example/videos/cb1.mp4',
      thumbnail_url: 'https://gears.example/videos/cb1.jpg',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.gears_video.status).toBe('ready');
    expect(res.data?.gears_video.video_url).toBe('https://gears.example/videos/cb1.mp4');

    const storedStory = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(storedStory.gears_video?.thumbnail_url).toBe('https://gears.example/videos/cb1.jpg');

    const storedSnapshot = JSON.parse(await readFile(versionPath, 'utf-8')) as StoryProjectVersionSnapshot;
    expect(storedSnapshot.story.gears_video?.video_url).toBe('https://gears.example/videos/cb1.mp4');

    const storedMeta = JSON.parse(await readFile(metaPath, 'utf-8')) as StoryProjectMeta;
    expect(storedMeta.updated_at).not.toBe(meta.updated_at);
    expect(storedMeta.gears_video_status).toBe('ready');
    expect(storedMeta.gears_video_url).toBe('https://gears.example/videos/cb1.mp4');
    expect(storedMeta.gears_video_thumbnail_url).toBe('https://gears.example/videos/cb1.jpg');
  });
});
