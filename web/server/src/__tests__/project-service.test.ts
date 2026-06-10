import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { StoryGenerateResult } from '@shared/types.js';
import {
  buildProjectId,
  createProjectFromGeneratedStory,
  getProject,
  regenerateProjectScene,
} from '../services/project-service.js';

const TEMP_DIRS: string[] = [];
const ORIGINAL_KB_ROOT = process.env.KB_ROOT;

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260609-story-abc1',
    title: '拒签冤案',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '在一纸判词前，他选择了良知。',
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
        plot: '雨夜里，周敦颐看着案卷迟迟没有落笔。',
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
        plot: '上官逼他签字，周敦颐却坚持重审。',
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
    gears_segments_url: '/api/stories/20260609-story-abc1/gears-segments',
    cultural_constraints: ['基于知识库条目'],
    credibility_note: '基本可靠',
    story_structure: 'single_event_drama',
    model_profile_id: 'claude_sonnet',
  };
}

afterEach(async () => {
  if (ORIGINAL_KB_ROOT === undefined) {
    delete process.env.KB_ROOT;
  } else {
    process.env.KB_ROOT = ORIGINAL_KB_ROOT;
  }
  for (const dir of TEMP_DIRS.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('project-service', () => {
  it('creates a real project and reads it back', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    expect(enriched.project_id).toBe(buildProjectId(story.storyId, story.video_type));
    expect(enriched.current_version_id).toContain('-v1');

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.project.version_count).toBe(1);
    expect(detail.data?.current_story.title).toBe(story.title);
    expect(detail.data?.project.model_profile_id).toBe('claude_sonnet');
    expect(detail.data?.current_story.model_profile_id).toBe('claude_sonnet');
  });

  it('builds a GEARS delivery package when reading old project snapshots', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const detail = await getProject(enriched.project_id!);

    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.schema_version).toBe('gears-delivery/v1');
    expect(detail.data?.current_story.gears_delivery?.character_assets.some(character => character.name === '周敦颐')).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.units.every(unit => unit.suggested_duration_sec <= 15)).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.markdown).toContain('GEARS 供稿包');
  });

  it('regenerates a single scene into a new version', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const projectId = buildProjectId(story.storyId, story.video_type);
    const currentVersionId = `${projectId}-v1`;
    const storyWithProject = {
      ...story,
      project_id: projectId,
      current_version_id: currentVersionId,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    };

    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    await mkdir(storyDir, { recursive: true });
    await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify(storyWithProject, null, 2), 'utf-8');

    const result = await regenerateProjectScene(projectId, {
      scene_id: 1,
      intent: 'tighten_conflict',
      user_note: '突出他拒签后可能丢官的代价',
      model_profile_id: 'codex_gpt55',
    });

    expect(result.ok).toBe(true);
    expect(result.data?.project.version_count).toBe(2);
    expect(result.data?.project.current_version_id).toContain('-v2');
    expect(result.data?.current_story.scene_breakdown[0].plot).toContain('突出他拒签后可能丢官的代价');
    expect(result.data?.versions[0].change_type).toBe('scene_regeneration');
    expect(result.data?.project.model_profile_id).toBe('claude_sonnet');
    expect(result.data?.current_story.model_profile_id).toBe('claude_sonnet');
  });

  // ---------------------------------------------------------------------------
  // 旧故事兼容性测试：generation_mode/generation_used_fallback 缺失或为 false
  // ---------------------------------------------------------------------------

  it('fills generation_mode=local_only and generation_used_fallback=false for old stories missing these fields', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    // makeStory() 不含 generation_mode/generation_used_fallback → 模拟旧故事
    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    // 旧故事缺失字段 → 填充为 local_only / false
    expect(detail.data?.current_story.generation_mode).toBe('local_only');
    expect(detail.data?.current_story.generation_used_fallback).toBe(false);
    expect(detail.data?.project.generation_mode).toBe('local_only');
    expect(detail.data?.project.generation_used_fallback).toBe(false);
  });

  it('preserves generation_used_fallback=false (does not coerce to undefined)', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    // 故事显式设置 generation_used_fallback=false（非旧故事缺失）
    const story = makeStory() as StoryGenerateResult & { generation_mode?: string; generation_used_fallback?: boolean };
    story.generation_mode = 'local_only';
    story.generation_used_fallback = false;

    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    // false 不应被 || 操作符吞掉变为 undefined
    expect(detail.data?.current_story.generation_used_fallback).toBe(false);
    expect(detail.data?.current_story.generation_mode).toBe('local_only');
  });

  it('preserves generation_mode=external_model and generation_used_fallback=true for adapter stories', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory() as StoryGenerateResult & { generation_mode?: string; generation_used_fallback?: boolean; generation_source?: string };
    story.generation_mode = 'external_model';
    story.generation_used_fallback = true;
    story.generation_source = 'Claude Sonnet (fallback)';

    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.generation_mode).toBe('external_model');
    expect(detail.data?.current_story.generation_used_fallback).toBe(true);
    expect(detail.data?.current_story.generation_source).toBe('Claude Sonnet (fallback)');
  });
});
