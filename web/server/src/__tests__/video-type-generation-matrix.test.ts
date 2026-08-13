import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import express from 'express';
import supertest from 'supertest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { storiesRouter } from '../routes/stories.js';
import { buildStoryProductionBoard } from '../services/production-board-service.js';
import { getProject } from '../services/project-service.js';
import type { GenerationType, PresentationStyle, VideoType } from '@shared/types.js';

let workspaceRoot = '';

const app = express();
app.use(createJsonBodyParser());
app.use('/api/stories', storiesRouter);
app.use(errorHandler);

const request = supertest(app);

beforeAll(async () => {
  workspaceRoot = await mkdtemp(resolve(tmpdir(), 'video-type-generation-matrix-'));
  const realDataRoot = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  await symlink(realDataRoot, resolve(workspaceRoot, 'data'), 'dir');
  process.env.KB_ROOT = resolve(workspaceRoot, 'data');
  process.env.WEB_GENERATED_ROOT = resolve(workspaceRoot, 'web', 'generated');
  process.env.STORY_GEN_LOCAL_ONLY = '1';
});

afterAll(async () => {
  delete process.env.STORY_GEN_LOCAL_ONLY;
  await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

interface MatrixCase {
  videoType: VideoType;
  generationType: GenerationType;
  presentationStyle: PresentationStyle;
  entryName: string;
  selectedEvent: string;
  expectedFirst: string;
  expectedLast: string;
  expectedTitle?: string;
  requiredFields: string[];
}

const cases: MatrixCase[] = [
  {
    videoType: 'character_story', generationType: 'character_story', presentationStyle: 'cinematic',
    entryName: '周敦颐——理学开山鼻祖', selectedEvent: '周敦颐拒签冤案并以辞官相争',
    expectedFirst: '钩子开场', expectedLast: '结尾', requiredFields: ['characters', 'protagonist_arc'],
  },
  {
    videoType: 'historical_drama', generationType: 'scene_short', presentationStyle: 'cinematic',
    entryName: '武昌起义——辛亥革命的第一声枪响', selectedEvent: '武昌起义提前发动并争夺楚望台军械库',
    expectedFirst: '时代危机', expectedLast: '历史余响', requiredFields: ['characters', 'protagonist_arc'],
  },
  {
    videoType: 'legend_story', generationType: 'character_story', presentationStyle: 'ink_style',
    entryName: '刘海砍樵——人仙之恋的湖南民间传说', selectedEvent: '刘海砍樵与人仙相恋的考验',
    expectedFirst: '远古传说', expectedLast: '传说永恒', requiredFields: ['characters'],
  },
  {
    videoType: 'children_story', generationType: 'character_story', presentationStyle: 'children_animation',
    entryName: '刘海砍樵——人仙之恋的湖南民间传说', selectedEvent: '刘海砍樵',
    expectedFirst: '小主人公', expectedLast: '温暖结尾', requiredFields: ['characters', 'protagonist_arc'],
  },
  {
    videoType: 'ai_comic_drama', generationType: 'character_story', presentationStyle: 'ai_comic',
    entryName: '刘海砍樵——人仙之恋的湖南民间传说', selectedEvent: '刘海识破胡大姐神异身份',
    expectedFirst: '钩子开场', expectedLast: '高燃收束', requiredFields: ['dialogue'],
  },
  {
    videoType: 'culture_promo', generationType: 'culture_promo', presentationStyle: 'voiceover_montage',
    entryName: '岳麓书院——千年学府弦歌不绝', selectedEvent: '岳麓书院千年文脉',
    expectedFirst: '符号引入', expectedLast: '标语收束', requiredFields: ['visual_symbols', 'core_message', 'modern_connection', 'slogan_or_key_sentence'],
  },
  {
    videoType: 'heritage_promo', generationType: 'culture_promo', presentationStyle: 'documentary',
    entryName: '湘绣——中国四大名绣之一', selectedEvent: '湘绣制作技艺',
    expectedFirst: '技艺渊源', expectedLast: '传承之路', requiredFields: ['visual_symbols', 'craft_or_ritual_process', 'modern_connection'],
  },
  {
    videoType: 'city_brand_promo', generationType: 'culture_promo', presentationStyle: 'social_media_fastcut',
    entryName: '岳麓书院——千年学府弦歌不绝', selectedEvent: '长沙岳麓书院文脉与当代生活',
    expectedFirst: '地标引入', expectedLast: '品牌定格', requiredFields: ['visual_symbols', 'core_message', 'modern_connection', 'slogan_or_key_sentence'],
  },
  {
    videoType: 'social_short', generationType: 'culture_promo', presentationStyle: 'social_media_fastcut',
    entryName: '湘绣——中国四大名绣之一', selectedEvent: '一根湘绣丝线为什么要劈成多股',
    expectedFirst: '3秒钩子', expectedLast: '金句落点', expectedTitle: '一根湘绣丝线为什么要劈成多股', requiredFields: ['visual_symbols', 'core_message', 'slogan_or_key_sentence'],
  },
  {
    videoType: 'documentary_short', generationType: 'culture_promo', presentationStyle: 'documentary',
    entryName: '岳麓书院——千年学府弦歌不绝', selectedEvent: '朱张会讲',
    expectedFirst: '现实引入', expectedLast: '当代意义', requiredFields: ['source_quotes', 'field_notes'],
  },
  {
    videoType: 'explainer_video', generationType: 'culture_promo', presentationStyle: 'host_narration',
    entryName: '张家界武陵源——3.8亿年雕琢的世界自然遗产', selectedEvent: '石英砂岩峰林如何形成',
    expectedFirst: '提出问题', expectedLast: '总结归纳', expectedTitle: '石英砂岩峰林如何形成', requiredFields: ['argument_points', 'knowledge_outline'],
  },
  {
    videoType: 'lecture_video', generationType: 'culture_promo', presentationStyle: 'host_narration',
    entryName: '岳麓书院——千年学府弦歌不绝', selectedEvent: '朱张会讲如何体现开放治学精神',
    expectedFirst: '提出主题', expectedLast: '总结号召', requiredFields: ['argument_points', 'knowledge_outline'],
  },
  {
    videoType: 'education_training', generationType: 'culture_promo', presentationStyle: 'host_narration',
    entryName: '岳麓书院——千年学府弦歌不绝', selectedEvent: '认识岳麓书院的历史层次',
    expectedFirst: '学习目标', expectedLast: '总结拓展', expectedTitle: '认识岳麓书院的历史层次', requiredFields: ['argument_points', 'knowledge_outline'],
  },
  {
    videoType: 'scene_short', generationType: 'scene_short', presentationStyle: 'cinematic',
    entryName: '岳麓书院——千年学府弦歌不绝', selectedEvent: '岳麓书院空间导览',
    expectedFirst: '空间引入', expectedLast: '意境收束', requiredFields: ['spatial_identity', 'visual_route', 'time_layer', 'atmosphere'],
  },
  {
    videoType: 'landscape_mood', generationType: 'scene_short', presentationStyle: 'ink_style',
    entryName: '张家界武陵源——3.8亿年雕琢的世界自然遗产', selectedEvent: '武陵源峰林云海',
    expectedFirst: '山水开卷', expectedLast: '灵韵定格', requiredFields: ['spatial_identity', 'visual_route', 'time_layer', 'atmosphere'],
  },
];

function valueAtPath(value: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => (
    current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined
  ), value);
}

describe('all video type API generation matrix', () => {
  it('keeps every representative type aligned with its source, structure, fields, and delivery', async () => {
    const diagnostics: Array<Record<string, unknown>> = [];
    const templateLeakPattern = /3秒记住|5秒讲清|画面推情绪|结构化、分步骤|你是否达到了学习目标|要点归纳\+延伸方向|操作流程。|素材待补|模板待补/;

    for (const item of cases) {
      const response = await request.post('/api/stories/generate').send({
        entry_name: item.entryName,
        generation_type: item.generationType,
        video_type: item.videoType,
        selected_event: item.selectedEvent,
        target_video_duration: '1分钟',
        presentation_style: item.presentationStyle,
        output_gears_segments: true,
        auto_repair: true,
        source_material_mode: 'generate_from_knowledge',
      });
      expect(response.status, `${item.videoType}: ${JSON.stringify(response.body)}`).toBe(200);
      expect(response.body.ok).toBe(true);
      const story = response.body.data as Record<string, any>;
      const functions = story.scene_breakdown.map((scene: { dramatic_function: string }) => scene.dramatic_function);
      const audienceAndDeliveryText = JSON.stringify({
        title: story.title,
        logline: story.logline,
        theme: story.theme,
        full_text: story.full_text,
        scenes: story.scene_breakdown,
        gears_segments: story.gears_segments,
        gears_delivery: story.gears_delivery,
      });

      diagnostics.push({
        video_type: item.videoType,
        title: story.title,
        functions,
        plot_lengths: story.scene_breakdown.map((scene: { plot: string }) => scene.plot.length),
        genre_score: story.quality_report?.genre_score,
        quality_passed: story.quality_report?.passed,
        issues: story.quality_report?.issues,
        template_leak: audienceAndDeliveryText.match(templateLeakPattern)?.[0],
      });

      expect(story.video_type).toBe(item.videoType);
      if (item.expectedTitle) expect(story.title).toBe(item.expectedTitle);
      if (item.videoType === 'ai_comic_drama') {
        expect(story.creation_use_case).toBe('adapted_ai_comic');
        expect(story.truth_mode).toBe('source_adaptation');
      }
      expect(functions[0]).toBe(item.expectedFirst);
      expect(functions.at(-1)).toBe(item.expectedLast);
      expect(story.scene_breakdown.length).toBeGreaterThanOrEqual(3);
      expect(story.gears_segments.length).toBe(story.scene_breakdown.length);
      expect(story.gears_delivery.units.length).toBeGreaterThanOrEqual(story.scene_breakdown.length);
      expect(story.professional_text_package?.video_type).toBe(item.videoType);
      expect(story.professional_text_package?.story_id).toBe(story.storyId);
      expect(story.professional_text_package?.project_id).toBe(story.project_id);
      expect(story.professional_text_package?.scene_breakdown.map((scene: Record<string, unknown>) => ({
        scene_id: scene.scene_id,
        key_action: scene.key_action,
        plot: scene.plot,
      }))).toEqual(story.scene_breakdown.map((scene: Record<string, unknown>) => ({
        scene_id: scene.scene_id,
        key_action: scene.key_action,
        plot: scene.plot,
      })));
      expect(story.professional_text_package?.full_text).toBe(story.full_text);
      expect(story.professional_text_package?.delivery_text_package?.scene_units)
        .toHaveLength(story.scene_breakdown.length);
      const professionalHardGates = story.professional_text_package?.quality_report?.hard_gate_failures ?? [];
      const machineRepairableHardGates = professionalHardGates.filter((gate: string) =>
        !gate.startsWith('interview_consent_missing:')
      );
      expect(machineRepairableHardGates, `${item.videoType} unresolved professional hard gates`)
        .toEqual([]);
      const projectResult = await getProject(story.project_id);
      expect(projectResult.ok).toBe(true);
      expect(projectResult.data?.current_story.professional_text_package?.project_id)
        .toBe(story.project_id);
      expect(projectResult.data?.current_story.professional_text_package?.video_type)
        .toBe(item.videoType);
      if (!['character_story', 'historical_drama', 'legend_story', 'children_story', 'ai_comic_drama', 'scene_short'].includes(item.videoType)) {
        expect(story.gears_delivery.character_assets, `${item.videoType} should not turn a place/craft/event into a person`)
          .toEqual([]);
      }
      if (item.videoType === 'scene_short') {
        expect(story.gears_delivery.character_assets.map((asset: { name: string }) => asset.name))
          .toContain('岳麓书院讲解员/寻访者');
      }
      for (const field of item.requiredFields) {
        const value = valueAtPath(story, field);
        expect(value, `${item.videoType} missing ${field}`).toBeTruthy();
        if (Array.isArray(value)) expect(value.length, `${item.videoType} empty ${field}`).toBeGreaterThan(0);
      }
      if (item.videoType !== 'character_story') {
        expect(audienceAndDeliveryText, `${item.videoType} leaked unrelated case material`)
          .not.toMatch(/周敦颐|案卷|拒签|画押|上官催签|死刑文书|出淤泥而不染|不畏权势的公正/);
      }
    }

    const genreFailures = diagnostics.filter(item =>
      typeof item.genre_score !== 'number'
      || item.genre_score < 70
      || (Array.isArray(item.issues) && item.issues.some(issue =>
        /缺少高潮场景|缺少结尾主题|场景缺少具体行动描述|出现不适配表达/.test(String(issue))
      )),
    );
    const templateLeaks = diagnostics.filter(item => item.template_leak);
    expect(genreFailures, JSON.stringify(diagnostics, null, 2)).toEqual([]);
    expect(templateLeaks, JSON.stringify(diagnostics, null, 2)).toEqual([]);
  });

  it('uses shadow-puppetry craft actions and prop assets for a heritage promo', async () => {
    const response = await request.post('/api/stories/generate').send({
      entry_name: '衡山皮影戏——湘南光影的千年传奇',
      generation_type: 'culture_promo',
      video_type: 'heritage_promo',
      selected_event: '衡山皮影戏的影偶制作与灯幕后场',
      target_video_duration: '3分钟',
      presentation_style: 'documentary',
      output_gears_segments: true,
      source_material_mode: 'generate_from_knowledge',
    });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const story = response.body.data;
    const audienceText = JSON.stringify({
      full_text: story.full_text,
      scene_breakdown: story.scene_breakdown,
      gears_segments: story.gears_segments,
      gears_delivery: story.gears_delivery,
    });
    expect(audienceText).toMatch(/影偶|雕镂|灯幕|操纵杆/);
    expect(audienceText).not.toMatch(/绣架|劈丝|穿针|落针|针脚|绸面/);

    const board = buildStoryProductionBoard(story);
    expect(board.prop_assets.map(asset => asset.label)).toEqual(expect.arrayContaining([
      '影偶',
      '雕刀',
      '操纵杆',
    ]));
    expect(board.image_asset_job_plan.summary.prop_requirement_count).toBeGreaterThanOrEqual(3);
  });
});
