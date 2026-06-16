import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateGenreStory } from '../src/tools/validate-genre-story.js';

const tmpDir = path.join(os.tmpdir(), 'kb-validate-genre-story-test-' + Date.now());
const dataRoot = path.join(tmpDir, 'data');
const projectId = '20260616-story-test--ai_comic_drama';

function baseScenes() {
  return [
    {
      scene_id: 1,
      title: '雨夜开场',
      location: '书院门前',
      dramatic_function: '钩子开场',
      plot: '雨夜里，主角站在紧闭的书院门前，手里攥着被退回的文书，外面的催促声越来越近。',
      key_action: '主角选择留下来面对压力',
      conflict: '他必须在退让和坚持之间做选择',
      visual_prompt: '雨夜，书院门前，灯笼摇晃，人物握紧文书，近景特写',
      camera_suggestion: '近景切入，随后推到人物表情',
      cultural_note: '体现士人坚持',
    },
    {
      scene_id: 2,
      title: '压力逼近',
      location: '书院正厅',
      dramatic_function: '人物登场',
      plot: '众人围在正厅，要求主角立刻改口，他看见案上证据和门外等候的人，沉默后把文书重新摊开。',
      key_action: '主角拒绝草率签字',
      conflict: '外部权威逼迫他让步',
      visual_prompt: '正厅，案几，文书，众人围立，压迫构图',
      camera_suggestion: '中近景交替',
      cultural_note: '体现良知和责任',
    },
    {
      scene_id: 3,
      title: '冲突爆发',
      location: '正厅中央',
      dramatic_function: '冲突爆发',
      plot: '上官拍案催逼，主角把证据推到众人面前，指出其中疑点，局面从沉默变成正面对峙。',
      key_action: '主角坚持提出疑点',
      conflict: '权威命令与事实疑点正面对抗',
      visual_prompt: '案几特写，纸页散开，人物对峙，强烈明暗',
      camera_suggestion: '特写快切',
      cultural_note: '体现正义',
    },
    {
      scene_id: 4,
      title: '关键选择',
      location: '廊下',
      dramatic_function: '反转/觉醒',
      plot: '主角走到廊下，听见被牵连者家人的哭声，回到厅内，当众宣布宁可担责也不能让疑案成为定案。',
      key_action: '主角选择承担后果',
      conflict: '个人前途与事实良知冲突',
      visual_prompt: '廊下雨声，家人哭泣，人物转身，眼神坚定',
      camera_suggestion: '跟拍转特写',
      cultural_note: '体现担当',
    },
    {
      scene_id: 5,
      title: '余味结尾',
      location: '书院外',
      dramatic_function: '高燃收束',
      plot: '天亮时，文书被重新审看，主角走出书院，身后的人群安静下来，这次坚持成为后来被记住的精神起点。',
      key_action: '主角守住选择',
      conflict: '坚持后的代价仍在',
      visual_prompt: '清晨，书院外，雨停，人物背影，远景留白',
      camera_suggestion: '远景拉远',
      cultural_note: '精神与良知落点',
    },
  ];
}

function baseStory(overrides: Record<string, unknown> = {}) {
  return {
    storyId: '20260616-story-test',
    title: '雨夜书院',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    logline: '一个人在压力中坚持选择。',
    theme: '良知与担当',
    full_text: '雨夜里，主角被逼着改口。他看着文书上的疑点，选择留下来承担后果。天亮时，这次坚持成为后来被记住的精神起点。',
    scene_breakdown: baseScenes(),
    gears_segments: [],
    gears_segments_url: '/api/stories/20260616-story-test/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试可信度说明',
    story_structure: 'single_event_drama',
    story_blueprint: {
      schema_version: 'story-blueprint/v1',
      central_event: '雨夜拒签',
      central_question: '主角如何在雨夜拒签中守住良知？',
      genre_beats: [
        { beat_id: 'beat-1', order: 1, function_label: '钩子开场', scene_id: 1 },
        { beat_id: 'beat-2', order: 2, function_label: '人物登场', scene_id: 2 },
        { beat_id: 'beat-3', order: 3, function_label: '冲突爆发', scene_id: 3 },
        { beat_id: 'beat-4', order: 4, function_label: '反转/觉醒', scene_id: 4 },
        { beat_id: 'beat-5', order: 5, function_label: '高燃收束', scene_id: 5 },
      ],
      evidence_boundaries: [{ label: '测试事实边界', note: '测试用边界', type: 'creative_treatment' }],
    },
    ...overrides,
  };
}

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
  const projectRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId);
  fs.mkdirSync(path.join(projectRoot, 'versions'), { recursive: true });

  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: '20260616-story-test',
    title: '雨夜书院',
    source_domain: 'china_culture',
    source_entry: '测试条目',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    story_structure: 'single_event_drama',
    status: 'draft',
    created_at: '2026-06-16T01:00:00.000Z',
    updated_at: '2026-06-16T01:00:00.000Z',
    current_version_id: `${projectId}-v1`,
    version_count: 1,
    scene_count: 5,
    has_gears_segments: false,
    credibility_note: '测试可信度说明',
    logline: '一个人在压力中坚持选择。',
  }, null, 2));

  fs.writeFileSync(path.join(projectRoot, 'versions', `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-16T01:00:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    story: baseStory(),
  }, null, 2));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KB_ROOT;
});

describe('kb_validate_genre_story', () => {
  it('reads a project and detects AI comic-drama missing dialogue', async () => {
    const result = await validateGenreStory({ project_id: projectId });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('project_id');
    expect(result!.video_type).toBe('ai_comic_drama');
    expect(result!.issues.some(issue => issue.includes('AI 漫剧缺少对白'))).toBe(true);
    expect(result!.repair_actions.some(action => action.includes('短对白'))).toBe(true);
  });

  it('accepts direct story_json and detects heritage craft gaps', async () => {
    const story = baseStory({
      video_type: 'heritage_promo',
      presentation_style: 'documentary',
      full_text: '镜头展示一件传统作品的美感，匠人站在光里，讲述传承的重要。',
      scene_breakdown: baseScenes().slice(0, 3),
    });

    const result = await validateGenreStory({ story_json: JSON.stringify(story) });

    expect(result!.source).toBe('story_json');
    expect(result!.issues.some(issue => issue.includes('工艺步骤'))).toBe(true);
  });

  it('detects historical drama without factual boundary', async () => {
    const story = baseStory({
      video_type: 'historical_drama',
      story_blueprint: {
        central_event: '关键争辩',
        central_question: '主角如何选择？',
        genre_beats: baseStory().story_blueprint.genre_beats,
        evidence_boundaries: [],
      },
      credibility_note: '',
      scene_breakdown: baseScenes().map(scene => ({
        ...scene,
        factual_basis: '',
        fictionalized_elements: [],
      })),
      full_text: '主角在关键争辩中站出来，坚持自己的判断，最终改变局面。',
    });

    const result = await validateGenreStory({ story_json: JSON.stringify(story) });

    expect(result!.issues.some(issue => issue.includes('史实锚点'))).toBe(true);
  });

  it('detects character stories that read like biography timelines', async () => {
    const story = baseStory({
      video_type: 'character_story',
      full_text: '1901年，主角出生。\n\n1915年，主角求学。\n\n1920年，主角任职。\n\n1930年，主角成就卓著。',
    });

    const result = await validateGenreStory({ story_json: JSON.stringify(story) });

    expect(result!.issues.some(issue => issue.includes('生平流水账'))).toBe(true);
    expect(result!.base_report.isNotBiographySummary).toBe(false);
  });

  it('detects explainer videos without a core question', async () => {
    const story = baseStory({
      video_type: 'explainer_video',
      story_blueprint: undefined,
      full_text: '这项文化有悠久历史，内容很多，值得了解。片中依次介绍背景、发展和价值。',
      scene_breakdown: baseScenes().slice(0, 3),
    });

    const result = await validateGenreStory({ story_json: JSON.stringify(story) });

    expect(result!.issues.some(issue => issue.includes('核心问题'))).toBe(true);
  });

  it('detects scene shorts without a spatial route', async () => {
    const story = baseStory({
      video_type: 'scene_short',
      full_text: '这个地方古朴安静，承载了许多记忆。镜头停留在建筑和灯影之间，氛围安静。',
      scene_breakdown: baseScenes().slice(0, 3).map(scene => ({
        ...scene,
        location: '同一院落',
      })),
    });

    const result = await validateGenreStory({ story_json: JSON.stringify(story) });

    expect(result!.issues.some(issue => issue.includes('空间路线'))).toBe(true);
  });

  it('can suppress repair actions for compact reports', async () => {
    const result = await validateGenreStory({
      project_id: projectId,
      include_repair_actions: false,
    });

    expect(result!.repair_actions).toEqual([]);
  });
});
