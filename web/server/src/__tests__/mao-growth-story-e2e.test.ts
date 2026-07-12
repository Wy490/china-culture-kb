import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import express from 'express';
import supertest from 'supertest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { entriesRouter } from '../routes/entries.js';
import { outlineRouter } from '../routes/outline.js';
import { storiesRouter } from '../routes/stories.js';

let workspaceRoot = '';

const app = express();
app.use(createJsonBodyParser());
app.use('/api/entries', entriesRouter);
app.use('/api/story-outline', outlineRouter);
app.use('/api/stories', storiesRouter);
app.use(errorHandler);

const request = supertest(app);

beforeAll(async () => {
  workspaceRoot = await mkdtemp(resolve(tmpdir(), 'mao-growth-story-e2e-'));
  const realDataRoot = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  await symlink(realDataRoot, resolve(workspaceRoot, 'data'), 'dir');
  process.env.KB_ROOT = resolve(workspaceRoot, 'data');
  process.env.WEB_GENERATED_ROOT = resolve(workspaceRoot, 'web', 'generated');
  process.env.STORY_GEN_LOCAL_ONLY = '1';
});

afterAll(async () => {
  delete process.env.STORY_GEN_LOCAL_ONLY;
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe('Mao youth-to-awakening API generation flow', () => {
  it('keeps the requested people, historical phases, narrative arc, and production assets aligned', async () => {
    const outline = '毛泽东少年时期到革命觉醒的故事，重点表现湖南乡土、求学、新民学会、农民运动、理想形成。';

    const analysisResponse = await request.post('/api/story-outline/analyze').send({
      outline,
      preferred_video_types: ['historical_drama'],
      target_video_duration: '3分钟',
    });
    expect(analysisResponse.status).toBe(200);
    expect(analysisResponse.body.ok).toBe(true);
    const analysis = analysisResponse.body.data;
    expect(analysis.detected_characters.map((item: { name: string }) => item.name)).toContain('毛泽东');
    expect(analysis.detected_characters.map((item: { name: string }) => item.name)).not.toContain('少年');
    expect(analysis.story_intent.time_range).toBe('少年→求学→新民学会→农民运动→革命觉醒→理想形成');
    expect(JSON.stringify(analysis.knowledge_needs)).toContain('新民学会');
    expect(JSON.stringify(analysis.knowledge_needs)).toContain('农民运动');

    const matchResponse = await request.post('/api/entries/multi-match').send({
      outline,
      knowledge_needs: analysis.knowledge_needs,
      limit_per_need: 5,
      localization_mode: 'allow_related_influence',
    });
    expect(matchResponse.status).toBe(200);
    expect(matchResponse.body.ok).toBe(true);
    const pack = matchResponse.body.data.matched_knowledge_pack;
    expect(pack.primary_entries[0].entry_name).toContain('毛泽东');
    expect(pack.primary_entries[0].role_in_story).toBe('main_character');
    expect(pack.overall_confidence).toBe(1);
    expect(pack.supporting_entries.length).toBeLessThanOrEqual(20);

    const generateResponse = await request.post('/api/stories/generate').send({
      entry_name: pack.primary_entries[0].entry_name,
      generation_type: 'character_story',
      video_type: 'historical_drama',
      model_profile_id: 'claude_sonnet',
      target_video_duration: '3分钟',
      tone: '庄重',
      presentation_style: 'cinematic',
      output_gears_segments: true,
      outline,
      knowledge_pack: pack,
      character_hints: analysis.detected_characters,
      genre_strictness: 'balanced',
      story_priority: 'plot_first',
      auto_repair: true,
      source_material_mode: 'generate_from_knowledge',
      creation_use_case: 'institutional_promo',
      truth_mode: 'factual_reconstruction',
      localization_mode: 'allow_related_influence',
    });
    expect(generateResponse.status, JSON.stringify(generateResponse.body)).toBe(200);
    expect(generateResponse.body.ok).toBe(true);
    const story = generateResponse.body.data;
    const storyText = JSON.stringify({
      title: story.title,
      logline: story.logline,
      theme: story.theme,
      full_text: story.full_text,
      scene_breakdown: story.scene_breakdown,
      characters: story.characters,
      gears_segments: story.gears_segments,
    });

    expect(story.title).toBe('毛泽东：从韶山少年到革命觉醒');
    expect(story.source_entry).toContain('毛泽东');
    expect(story.generation_mode).toBe('local_only');
    expect(story.creation_use_case).toBe('institutional_promo');
    expect(story.truth_mode).toBe('factual_reconstruction');
    expect(story.scene_breakdown.map((scene: { title: string }) => scene.title)).toEqual([
      '田埂与书页',
      '把课堂走到乡间',
      '从砥砺品行到改造世界',
      '夜校里的答案',
      '把脚印写成道路',
    ]);
    expect(story.scene_breakdown.map((scene: { location: string }) => scene.location)).toEqual([
      '韶山冲农舍与田埂',
      '湖南第一师范与湘中乡路',
      '长沙岳麓山下新民学会成立旧址',
      '韶山农民夜校旧址',
      '湖南五县农民运动考察路线',
    ]);
    expect(story.characters.find((item: { name: string }) => item.name === '毛泽东')?.role).toBe('protagonist');
    expect(story.characters.find((item: { name: string }) => item.name === '毛贻昌')?.role).toBe('family_pressure');
    const assets = story.gears_delivery.character_assets;
    const asset = (name: string) => assets.find((item: { name: string }) => item.name === name);
    expect(asset('毛泽东')).toMatchObject({ gender: '男', age_range: '青年' });
    expect(asset('毛泽东').clothing).toContain('场次年龄推进');
    expect(asset('毛贻昌')).toMatchObject({ gender: '男', age_range: '中年' });
    expect(asset('毛贻昌').clothing).toContain('湖南中年农家');
    expect(asset('萧子升')).toMatchObject({ gender: '男', age_range: '青年' });
    expect(asset('杨昌济')).toMatchObject({ gender: '男', age_range: '中年' });
    expect(asset('蔡和森')).toMatchObject({ gender: '男', age_range: '青年' });
    expect(asset('杨开慧')).toMatchObject({ gender: '女', age_range: '青年' });
    expect(asset('农民夜校学员')).toMatchObject({ gender: '不适用', age_range: '不适用' });
    expect(asset('农民协会骨干')).toMatchObject({ gender: '不适用', age_range: '不适用' });
    expect(story.gears_delivery.character_gender_summary).toMatchObject({
      male: 5,
      female: 1,
      not_applicable: 2,
    });
    expect(story.quality_report.passed).toBe(true);
    expect(story.quality_report.outline_coverage_report.coverage_score).toBe(100);
    expect(story.quality_report.outline_coverage_report.missing_nodes).toBe(0);
    expect(story.quality_report.issues.join('\n')).not.toMatch(/因果链清楚|人物不是年表|制度压力可见|史实边界明确/);
    expect(storyText).toContain('新民学会');
    expect(storyText).toContain('农民运动');
    expect(storyText).toContain('革命理想形成');
    expect(storyText).not.toMatch(/周敦颐|宋代|案卷|拒签|画押|上官/);

    const deliveryResponse = await request.get(`/api/stories/${story.storyId}/gears-delivery`);
    expect(deliveryResponse.status).toBe(200);
    expect(deliveryResponse.body.ok).toBe(true);
    const deliveryText = JSON.stringify(deliveryResponse.body.data);
    expect(deliveryText).toContain('毛泽东');
    expect(deliveryText).toContain('韶山');
    expect(deliveryText).toContain('新民学会');
    expect(deliveryText).not.toMatch(/周敦颐|宋代|案卷|拒签|画押|上官/);
  });
});
