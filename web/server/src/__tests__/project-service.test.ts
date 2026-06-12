import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { StoryGenerateResult } from '@shared/types.js';
import {
  buildProjectId,
  createProjectFromGeneratedStory,
  deleteProject,
  deleteProjects,
  getProject,
  listProjectSupplementTasks,
  regenerateProjectScene,
  retainRecentProjects,
  updateProjectCurrentGearsWebhookStatus,
  updateProjectSupplementTask,
} from '../services/project-service.js';

const TEMP_DIRS: string[] = [];
const ORIGINAL_KB_ROOT = process.env.KB_ROOT;

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

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
    expect(detail.data?.project.open_supplement_task_count).toBe(0);
    expect(detail.data?.project.quality_passed).toBe(true);
    expect(detail.data?.project.genre_score).toBe(92);
    expect(detail.data?.project.quality_issue_count).toBe(0);
    expect(detail.data?.current_story.title).toBe(story.title);
    expect(detail.data?.project.model_profile_id).toBe('claude_sonnet');
    expect(detail.data?.current_story.model_profile_id).toBe('claude_sonnet');
  });

  it('updates GEARS webhook status on the current project and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      gears_webhook: {
        status: 'pending',
        webhook_target: 'https://grears.example/api/webhook/story-ready',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    await updateProjectCurrentGearsWebhookStatus(enriched.project_id, story.storyId, {
      status: 'sent',
      webhook_target: 'https://grears.example/api/webhook/story-ready',
      attempts: 1,
      last_attempt_at: '2026-06-09T10:00:01.000Z',
      last_success_at: '2026-06-09T10:00:01.000Z',
    });

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.gears_webhook?.status).toBe('sent');
    expect(detail.data?.current_story.gears_webhook?.attempts).toBe(1);

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.gears_webhook?.status).toBe('sent');
    expect(rawSource.gears_webhook?.last_success_at).toBe('2026-06-09T10:00:01.000Z');
  });

  it('tracks open supplement task count on project metadata', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [{
        task_id: '20260609-story-abc1--supplement--supporting_characters',
        need_id: 'supporting_characters',
        label: '配角人物',
        description: '补充「配角人物」相关资料',
        status: 'open',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);

    expect(detail.ok).toBe(true);
    expect(detail.data?.project.open_supplement_task_count).toBe(1);
    expect(detail.data?.current_story.supplement_tasks?.[0].status).toBe('open');
  });

  it('lists supplement tasks across projects with status filtering', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [
        {
          task_id: '20260609-story-abc1--supplement--supporting_characters',
          need_id: 'supporting_characters',
          label: '配角人物',
          description: '补充「配角人物」相关资料',
          status: 'open',
          source: 'knowledge_pack_missing_need',
          created_at: '2026-06-09T10:00:00.000Z',
        },
        {
          task_id: '20260609-story-abc1--supplement--regional_context',
          need_id: 'regional_context',
          label: '地域背景',
          description: '补充「地域背景」相关资料',
          status: 'resolved',
          source: 'knowledge_pack_missing_need',
          created_at: '2026-06-09T10:00:00.000Z',
          resolved_at: '2026-06-09T11:00:00.000Z',
          supplement_note: '已补充地域背景。',
        },
      ],
    };
    await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const allTasks = await listProjectSupplementTasks();
    const openTasks = await listProjectSupplementTasks('open');

    expect(allTasks.ok).toBe(true);
    expect(allTasks.data).toHaveLength(2);
    expect(openTasks.ok).toBe(true);
    expect(openTasks.data).toHaveLength(1);
    expect(openTasks.data?.[0].project_title).toBe(story.title);
    expect(openTasks.data?.[0].task.status).toBe('open');
  });

  it('updates supplement task status on the current project and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const taskId = '20260609-story-abc1--supplement--supporting_characters';
    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [{
        task_id: taskId,
        need_id: 'supporting_characters',
        label: '配角人物',
        description: '补充「配角人物」相关资料',
        status: 'open',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    const updated = await updateProjectSupplementTask(enriched.project_id!, taskId, {
      status: 'resolved',
      supplement_note: '上官可设定为南安军衙主管，负责催促签署疑案文书。',
    });

    expect(updated.ok).toBe(true);
    expect(updated.data?.project.open_supplement_task_count).toBe(0);
    expect(updated.data?.current_story.supplement_tasks?.[0].status).toBe('resolved');
    expect(updated.data?.current_story.supplement_tasks?.[0].resolved_at).toBeTruthy();
    expect(updated.data?.current_story.supplement_tasks?.[0].supplement_note).toContain('南安军衙主管');

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.supplement_tasks?.[0].status).toBe('resolved');
    expect(rawSource.supplement_tasks?.[0].supplement_note).toContain('疑案文书');
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

  it('deletes the project snapshots and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const projectId = enriched.project_id!;
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    const projectPath = resolve(root, 'web', 'generated', 'projects', projectId);

    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: projectId,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    const deleted = await deleteProject(projectId);

    expect(deleted.ok).toBe(true);
    expect(deleted.data?.deleted).toBe(true);
    expect(await exists(storyPath)).toBe(false);
    expect(await exists(projectPath)).toBe(false);
    const detail = await getProject(projectId);
    expect(detail.ok).toBe(false);
  });

  it('batch deletes projects and reports missing ids', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const firstStory = makeStory();
    const secondStory: StoryGenerateResult = {
      ...makeStory(),
      storyId: '20260609-story-def2',
      title: '月岩悟道传说',
      gears_segments_url: '/api/stories/20260609-story-def2/gears-segments',
    };
    const first = await createProjectFromGeneratedStory(firstStory, '2026-06-09T10:00:00.000Z');
    const second = await createProjectFromGeneratedStory(secondStory, '2026-06-09T10:01:00.000Z');

    for (const story of [first, second]) {
      const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
      await mkdir(storyDir, { recursive: true });
      await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify({
        ...story,
        _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
      }, null, 2), 'utf-8');
    }

    const result = await deleteProjects([
      first.project_id!,
      second.project_id!,
      '20260609-story-none--character_story',
    ]);

    expect(result.ok).toBe(true);
    expect(result.data?.deleted.map(item => item.project_id).sort()).toEqual([
      first.project_id!,
      second.project_id!,
    ].sort());
    expect(result.data?.failed).toHaveLength(1);
    expect(result.data?.failed[0].project_id).toBe('20260609-story-none--character_story');
    expect(await exists(resolve(root, 'web', 'generated', 'projects', first.project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', second.project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', first.video_type, `${first.storyId}.json`))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', second.video_type, `${second.storyId}.json`))).toBe(false);
  });

  it('retains the newest projects and deletes older stories', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const stories: StoryGenerateResult[] = [
      { ...makeStory(), storyId: '20260609-story-old1', title: '最早故事', gears_segments_url: '/api/stories/20260609-story-old1/gears-segments' },
      { ...makeStory(), storyId: '20260609-story-mid2', title: '中间故事', gears_segments_url: '/api/stories/20260609-story-mid2/gears-segments' },
      { ...makeStory(), storyId: '20260609-story-new3', title: '最新故事', gears_segments_url: '/api/stories/20260609-story-new3/gears-segments' },
    ];
    const createdStories: StoryGenerateResult[] = [];
    for (const [index, story] of stories.entries()) {
      const createdAt = `2026-06-09T10:0${index}:00.000Z`;
      const created = await createProjectFromGeneratedStory(story, createdAt);
      createdStories.push(created);
      const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
      await mkdir(storyDir, { recursive: true });
      await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify({
        ...created,
        _request_meta: { created_at: createdAt },
      }, null, 2), 'utf-8');
    }
    const orphanProjectId = '20260609-story-orphan--character_story';
    await mkdir(resolve(root, 'web', 'generated', 'projects', orphanProjectId), { recursive: true });
    await writeFile(resolve(root, 'web', 'generated', 'projects', orphanProjectId, 'project.json'), JSON.stringify({
      project_id: orphanProjectId,
      current_story_id: '20260609-story-orphan',
      title: '孤立项目',
      source_domain: 'china_culture',
      source_entry: '缺失故事文件',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      status: 'draft',
      created_at: '2026-06-09T10:09:00.000Z',
      updated_at: '2026-06-09T10:09:00.000Z',
      current_version_id: `${orphanProjectId}-v1`,
      version_count: 1,
      scene_count: 0,
      has_gears_segments: false,
      credibility_note: '测试',
      logline: '测试',
    }, null, 2), 'utf-8');

    const result = await retainRecentProjects(2);

    expect(result.ok).toBe(true);
    expect(result.data?.kept.map(project => project.project_id)).toEqual([
      createdStories[2].project_id,
      createdStories[1].project_id,
    ]);
    expect(result.data?.deleted.map(item => item.project_id).sort()).toEqual([
      createdStories[0].project_id,
      orphanProjectId,
    ].sort());
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[0].project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', orphanProjectId))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', createdStories[0].video_type, `${createdStories[0].storyId}.json`))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[1].project_id!))).toBe(true);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[2].project_id!))).toBe(true);
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
