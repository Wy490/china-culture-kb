import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateSeedancePrompt } from '../src/tools/generate-seedance-prompt.js';

const tmpDir = path.join(os.tmpdir(), 'kb-seedance-prompt-test-' + Date.now());
const dataRoot = path.join(tmpDir, 'data');
const projectId = '20260617-story-seedance--ai_comic_drama';
const storyId = '20260617-story-seedance';

function baseStory() {
  return {
    storyId,
    project_id: projectId,
    title: '雨夜拒签',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    logline: '少年在雨夜守住一份文书。',
    theme: '良知与选择',
    full_text: '雨夜里，少年被迫在退让和坚持之间做选择。',
    characters: [
      { name: '少年', role: 'protagonist', description: '背着书箱的求学少年', arc: '从犹豫到坚持' },
      { name: '师兄', role: 'supporting', description: '守门的书院师兄' },
    ],
    scene_breakdown: [
      {
        scene_id: 1,
        title: '门外拦阻',
        duration_sec: 12,
        location: '书院门外',
        time_of_day: '夜晚',
        dramatic_function: '钩子开场',
        plot: '雨夜里，少年抱着书箱站在门外，师兄挡住门，要求他天亮前交出证据。',
        key_action: '少年握紧文书，抬头追问规则。',
        characters: ['少年', '师兄'],
        visual_prompt: '质量信号：书院门外，雨水，灯笼，人物对峙',
        camera_suggestion: '运镜参考：参考视频素材的横移节奏，建立镜头后慢推到少年近景',
        cultural_note: '体现士人良知边界。',
        dialogue_or_narration: '师兄：天亮前，拿证据来。音乐参考：雨声下压，低鼓点推进紧张感。',
        factual_basis: '测试事实边界。',
      },
      {
        scene_id: 2,
        title: '厅内拒签',
        duration_sec: 14,
        location: '书院正厅',
        time_of_day: '夜晚',
        dramatic_function: '冲突爆发',
        plot: '众人围在案前催促少年签字，少年把文书推回去，指出疑点。',
        key_action: '少年拒绝草率签字。',
        characters: ['少年'],
        visual_prompt: '正厅，案几，文书，灯影压低',
        camera_suggestion: '中近景交替，最后切文书特写',
        cultural_note: '体现责任。',
        dialogue_or_narration: '少年：我不能签。',
      },
    ],
    gears_segments: [
      {
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 12,
        panel_count: 6,
        script_text: '少年在雨夜被拦住，必须天亮前交出证据。',
      },
      {
        segment_id: 2,
        source_scene_id: 2,
        duration_sec: 14,
        panel_count: 8,
        script_text: '众人催促签字，少年把文书推回去，说自己不能签。',
      },
    ],
  };
}

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });

  const projectRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId);
  fs.mkdirSync(path.join(projectRoot, 'versions'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: storyId,
    title: '雨夜拒签',
    source_domain: 'china_culture',
    source_entry: '测试条目',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    status: 'draft',
    created_at: '2026-06-17T01:00:00.000Z',
    updated_at: '2026-06-17T01:00:00.000Z',
    current_version_id: `${projectId}-v1`,
    version_count: 1,
    scene_count: 2,
    has_gears_segments: true,
  }, null, 2));
  fs.writeFileSync(path.join(projectRoot, 'versions', `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-17T01:00:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    story: baseStory(),
  }, null, 2));

  const storyRoot = path.join(tmpDir, 'web', 'generated', 'stories', 'ai_comic_drama');
  fs.mkdirSync(storyRoot, { recursive: true });
  fs.writeFileSync(path.join(storyRoot, `${storyId}.json`), JSON.stringify(baseStory(), null, 2));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KB_ROOT;
});

describe('kb_generate_seedance_prompt', () => {
  it('generates a read-only Seedance prompt package from project_id', async () => {
    const result = await generateSeedancePrompt({ project_id: projectId, include_markdown: false });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('project_id');
    expect(result!.package.schema_version).toBe('seedance-prompt-package/v1');
    expect(result!.package.shot_units).toHaveLength(2);
    expect(result!.package.asset_references.some(item => item.reference_slot === '@图片1')).toBe(true);
    expect(result!.package.asset_references.some(item => item.reference_slot === '@视频1' && item.kind === 'camera')).toBe(true);
    expect(result!.package.asset_references.some(item => item.reference_slot === '@音频1' && item.kind === 'audio')).toBe(true);
    expect(result!.package.material_validation.video_count).toBe(1);
    expect(result!.package.material_validation.audio_count).toBe(1);
    expect(result!.package.shot_units[0].seedance_prompt).toContain('@视频1 作为运镜和节奏参考');
    expect(result!.package.shot_units[0].seedance_prompt).toContain('@音频1 作为音乐或音效参考');
    expect(result!.package.shot_units[0].visual_prompt).not.toContain('质量信号');
    expect(result!.package.markdown).toBeUndefined();
  });

  it('accepts direct story_json and includes markdown by default', async () => {
    const result = await generateSeedancePrompt({ story_json: JSON.stringify(baseStory()) });

    expect(result!.source).toBe('story_json');
    expect(result!.package.markdown).toContain('Seedance 2.0 镜头提示词包');
    expect(result!.validation_summary.shot_count).toBe(2);
    expect(result!.package.shot_units[0].seedance_prompt).toContain('0-3秒');
    expect(result!.package.shot_units[0].seedance_prompt).toContain('音效/音乐：');
  });

  it('can resolve a story by story_id', async () => {
    const result = await generateSeedancePrompt({ story_id: storyId, include_markdown: false });

    expect(result!.source).toBe('story_id');
    expect(result!.story_id).toBe(storyId);
    expect(result!.validation_summary.asset_reference_count).toBeGreaterThan(0);
  });

  it('returns null for missing projects and rejects unsafe ids', async () => {
    await expect(generateSeedancePrompt({ project_id: '../bad' })).rejects.toThrow('非法项目 ID');
    await expect(generateSeedancePrompt({ project_id: 'missing-project' })).resolves.toBeNull();
  });
});
