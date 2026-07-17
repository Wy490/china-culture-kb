import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getProjectContext } from '../src/tools/get-project-context.js';
import { updateProjectVersion } from '../src/tools/update-project-version.js';

const tmpDir = path.join(os.tmpdir(), 'kb-update-project-version-test-' + Date.now());
const dataRoot = path.join(tmpDir, 'data');
const projectId = '20260618-story-version--ai_comic_drama';
const storyId = '20260618-story-version';

function baseScenes() {
  return [
    {
      scene_id: 1,
      title: '雨夜开场',
      location: '书院门前',
      dramatic_function: '钩子开场',
      plot: '雨夜里，主角站在紧闭的书院门前，手里攥着被退回的文书。',
      key_action: '主角选择留下来面对压力',
      visual_prompt: '雨夜，书院门前，灯笼摇晃，人物握紧文书，近景特写',
      dialogue_or_narration: '旁白：这一夜，他必须决定要不要退让。',
    },
    {
      scene_id: 2,
      title: '正厅拒签',
      location: '书院正厅',
      dramatic_function: '冲突爆发',
      plot: '众人围在正厅，要求主角立刻改口，他把文书重新摊开。',
      key_action: '主角拒绝草率签字',
      visual_prompt: '正厅，案几，文书，众人围立，压迫构图',
      dialogue_or_narration: '主角：我不能签。',
    },
  ];
}

function baseStory(overrides: Record<string, unknown> = {}) {
  return {
    storyId,
    project_id: projectId,
    current_version_id: `${projectId}-v1`,
    title: '雨夜书院',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    logline: '一个人在压力中坚持选择。',
    theme: '良知与担当',
    full_text: '雨夜里，主角被逼着改口。他看着文书上的疑点，选择留下来承担后果。',
    scene_breakdown: baseScenes(),
    gears_segments: [
      {
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 8,
        script_text: '雨夜里，主角被迫面对退让与坚持。',
      },
    ],
    quality_report: {
      passed: false,
      genre_score: 62,
      issues: ['AI 漫剧结尾缺少追看钩子。'],
      repair_actions: ['为结尾增加追看钩子'],
    },
    story_blueprint: {
      schema_version: 'story-blueprint/v1',
      central_event: '雨夜拒签',
      central_question: '主角如何守住良知？',
      genre_beats: [{ beat_id: 'beat-1', order: 1, function_label: '钩子开场', scene_id: 1 }],
    },
    ...overrides,
  };
}

function projectRoot() {
  return path.join(tmpDir, 'web', 'generated', 'projects', projectId);
}

function versionsDir() {
  return path.join(projectRoot(), 'versions');
}

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
  fs.mkdirSync(versionsDir(), { recursive: true });
  fs.writeFileSync(path.join(projectRoot(), 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: storyId,
    title: '雨夜书院',
    source_domain: 'second_domain',
    source_entry: '测试条目',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    story_structure: 'single_event_drama',
    status: 'draft',
    created_at: '2026-06-18T01:00:00.000Z',
    updated_at: '2026-06-18T01:00:00.000Z',
    current_version_id: `${projectId}-v1`,
    version_count: 1,
    scene_count: 2,
    has_gears_segments: true,
    quality_passed: false,
    genre_score: 62,
    quality_issue_count: 1,
  }, null, 2));
  fs.writeFileSync(path.join(versionsDir(), `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-18T01:00:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    quality_report: baseStory().quality_report,
    story: baseStory(),
  }, null, 2));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KB_ROOT;
});

describe('kb_update_project_version', () => {
  it('writes a new version and keeps the previous snapshot readable', async () => {
    const updatedStory = baseStory({
      full_text: '雨夜里，主角被逼着改口。他最终留下一个问题：天亮以后，谁还敢重新审看这份文书？',
      scene_breakdown: baseScenes().map(scene => scene.scene_id === 1
        ? {
          ...scene,
          plot: '雨夜里，主角站在紧闭的书院门前，手里的文书被雨水打湿，他抬头问：天亮后谁来承担这份沉默？',
        }
        : scene),
      quality_report: {
        passed: true,
        genre_score: 84,
        issues: [],
        repair_actions: [],
      },
    });

    const result = await updateProjectVersion({
      project_id: projectId,
      change_type: 'quality_repair',
      change_target: { scene_ids: [1] },
      snapshot_json: JSON.stringify(updatedStory),
      user_instruction: '增强第1场钩子',
    });

    expect(result).not.toBeNull();
    expect(result!.previous_version_id).toBe(`${projectId}-v1`);
    expect(result!.version_id).toBe(`${projectId}-v2`);
    expect(result!.version_count).toBe(2);
    expect(result!.scene_ids_changed).toEqual([1]);
    expect(result!.quality_summary).toMatchObject({ quality_passed: true, genre_score: 84, quality_issue_count: 0 });
    expect(fs.existsSync(path.join(versionsDir(), `${projectId}-v1.json`))).toBe(true);
    expect(fs.existsSync(path.join(versionsDir(), `${projectId}-v2.json`))).toBe(true);

    const meta = JSON.parse(fs.readFileSync(path.join(projectRoot(), 'project.json'), 'utf-8'));
    expect(meta.current_version_id).toBe(`${projectId}-v2`);
    expect(meta.version_count).toBe(2);
    expect(meta.created_at).toBe('2026-06-18T01:00:00.000Z');
    expect(meta.updated_at).not.toBe(meta.created_at);

    const context = await getProjectContext({ project_id: projectId, include_versions: true });
    expect(context!.current_story.current_version_id).toBe(`${projectId}-v2`);
    expect(context!.current_story.sourceDomain).toBe('second_domain');
    expect(context!.current_story.full_text).toContain('谁还敢重新审看');
    expect(context!.version_snapshots).toHaveLength(2);

    const original = JSON.parse(fs.readFileSync(path.join(versionsDir(), `${projectId}-v1.json`), 'utf-8'));
    expect(original.story.full_text).not.toContain('谁还敢重新审看');
  });

  it('preserves critical fields omitted from snapshot_json and infers changed scenes', async () => {
    const partialStory = {
      storyId,
      title: '雨夜书院新稿',
      full_text: '主角在雨夜作出新的选择。',
      scene_breakdown: baseScenes().map(scene => scene.scene_id === 2
        ? { ...scene, plot: '众人围在正厅，主角把文书推回去，明确说这份疑点不能被盖过去。' }
        : scene),
    };

    const result = await updateProjectVersion({
      project_id: projectId,
      change_type: 'scene_regeneration',
      snapshot_json: JSON.stringify(partialStory),
      user_instruction: '重写第2场',
    });

    expect(result!.scene_ids_changed).toEqual([2]);
    expect(result!.preserved_fields).toContain('story_blueprint');
    expect(result!.preserved_fields).toContain('quality_report');
    expect(result!.preserved_fields).toContain('gears_segments');

    const snapshot = JSON.parse(fs.readFileSync(path.join(versionsDir(), `${projectId}-v2.json`), 'utf-8'));
    expect(snapshot.story.story_blueprint.central_event).toBe('雨夜拒签');
    expect(snapshot.story.quality_report.genre_score).toBe(62);
    expect(snapshot.story.gears_segments).toHaveLength(1);
    expect(snapshot.story.project_id).toBe(projectId);
    expect(snapshot.story.current_version_id).toBe(`${projectId}-v2`);
    expect(snapshot.story.sourceDomain).toBe('second_domain');
  });

  it('uses the next free version id when metadata is stale', async () => {
    fs.writeFileSync(path.join(versionsDir(), `${projectId}-v2.json`), JSON.stringify({
      project_id: projectId,
      version_id: `${projectId}-v2`,
      created_at: '2026-06-18T01:05:00.000Z',
      change_type: 'quality_repair',
      scene_ids_changed: [1],
      story: baseStory({ current_version_id: `${projectId}-v2` }),
    }, null, 2));

    const result = await updateProjectVersion({
      project_id: projectId,
      change_type: 'quality_repair',
      snapshot_json: JSON.stringify(baseStory({ full_text: '第三个版本。' })),
    });

    expect(result!.version_id).toBe(`${projectId}-v3`);
    expect(result!.version_count).toBe(3);
    expect(fs.existsSync(path.join(versionsDir(), `${projectId}-v2.json`))).toBe(true);
    expect(fs.existsSync(path.join(versionsDir(), `${projectId}-v3.json`))).toBe(true);
  });

  it('returns null for missing projects and rejects unsafe or invalid input', async () => {
    await expect(updateProjectVersion({
      project_id: '../bad',
      change_type: 'quality_repair',
      snapshot_json: '{}',
    })).rejects.toThrow('非法项目 ID');

    await expect(updateProjectVersion({
      project_id: 'missing-project',
      change_type: 'quality_repair',
      snapshot_json: '{}',
    })).resolves.toBeNull();

    await expect(updateProjectVersion({
      project_id: projectId,
      change_type: 'quality_repair',
      snapshot_json: 'not-json',
    })).rejects.toThrow('snapshot_json 不是有效 JSON');

    await expect(updateProjectVersion({
      project_id: projectId,
      change_type: 'quality_repair',
      snapshot_json: JSON.stringify(baseStory({ sourceDomain: 'china_culture' })),
    })).rejects.toThrow('snapshot_json sourceDomain（china_culture）与项目 source_domain（second_domain）不一致');
    expect(fs.existsSync(path.join(versionsDir(), `${projectId}-v2.json`))).toBe(false);
  });
});
