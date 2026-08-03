import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  buildChinaCultureDomainPackEntries,
  getChinaCultureDomainPackProductionHealthReport,
  getChinaCultureDomainPackSeeds,
} from '../domains/china-culture/domain-pack-production-service.js';

beforeAll(() => {
  if (!process.env.KB_ROOT) {
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  }
});

describe('china_culture domain-pack production service', () => {
  it('loads editable china culture domain pack seeds from data/domain-packs', () => {
    const seeds = getChinaCultureDomainPackSeeds();

    expect(seeds.length).toBeGreaterThanOrEqual(6);
    expect(seeds.some(seed => seed.entry_name === '宋代士人设定包——服饰器物与称谓')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === 'GEARS场景资产包——洞穴、书院与衙署边界')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '纪录片来源包——现实现场、来源线索与再现边界')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === 'AI漫剧分镜包——关键帧、表情节拍与连续性验收')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '朝代服饰与器物包——时代称谓、服装道具和事实边界')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '仪式礼俗与禁忌包——流程角色、空间秩序和文化边界')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '建筑空间与陈设包——空间层级、动线道具和时代边界')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '语言语体与地域表达包——人物身份、语境层级和方言边界')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '自然环境与声景包——季节天气、地貌运动和环境声音')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '儿童改写规则包——年龄分层、善意张力与事实边界')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '短视频钩子包——三秒问题、对比反转与平台节奏')).toBe(true);
    expect(seeds.some(seed => seed.entry_name === '宣讲培训结构包——论点案例、练习复盘与行动转化')).toBe(true);
    expect(seeds.some(seed => seed.domain === 'narrative_pattern' && seed.role === 'pattern_pack')).toBe(true);
    expect(
      seeds.find(seed => seed.entry_name === '讲解知识结构包——核心问题、层级例子与图示字幕')?.production_prompts,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('观众问题'),
      expect.stringContaining('继续查证'),
    ]));
    expect(
      seeds.find(seed => seed.entry_name === '非遗流程生产包——材料工具、工序动作与授权边界')?.review_boundaries,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('不得把通用流程包写成具体项目已确认流程'),
      expect.stringContaining('操作教程'),
    ]));
    expect(
      seeds.find(seed => seed.entry_name === '儿童改写规则包——年龄分层、善意张力与事实边界')?.production_prompts,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('受众层级'),
    ]));
  });

  it('reports production Domain Pack health for prompt and review-boundary gates', () => {
    const report = getChinaCultureDomainPackProductionHealthReport({ generatedAt: '2026-07-06T00:00:00.000Z' });

    expect(report).toMatchObject({
      schema_version: 'domain-pack-production-health/v1',
      generated_at: '2026-07-06T00:00:00.000Z',
      domain_id: 'china_culture',
      status: 'passed',
      production_pack_count: 12,
      missing_required_pack_ids: [],
      issues: [],
    });
    expect(report.required_pack_ids).toEqual([
      'heritage_process_pack',
      'documentary_source_pack',
      'ai_comic_storyboard_pack',
      'era_and_costume_pack',
      'ritual_etiquette_taboo_pack',
      'architectural_space_furnishing_pack',
      'regional_language_register_pack',
      'natural_environment_soundscape_pack',
      'explainer_knowledge_structure_pack',
      'children_adaptation_safety_pack',
      'short_video_hook_pack',
      'education_training_structure_pack',
    ]);
    expect(report.production_ready_pack_ids).toEqual(report.required_pack_ids);
    expect(report.packs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'explainer_knowledge_structure_pack',
        production_prompt_count: 5,
        review_boundary_count: 5,
        status: 'passed',
      }),
      expect.objectContaining({
        pack_id: 'ai_comic_storyboard_pack',
        asset_usage: expect.arrayContaining(['visual_style', 'gears_delivery']),
      }),
    ]));
  });

  it('injects architecture, regional language, and natural environment production packs', () => {
    const entries = buildChinaCultureDomainPackEntries({
      query: '历史短片需要建筑空间层级和陈设动线、人物身份对应的地域语言语体，还要明确季节天气、地貌和环境声景',
      limit: 6,
    });

    const architecture = entries.find(entry => entry.entry_name === '建筑空间与陈设包——空间层级、动线道具和时代边界');
    const language = entries.find(entry => entry.entry_name === '语言语体与地域表达包——人物身份、语境层级和方言边界');
    const environment = entries.find(entry => entry.entry_name === '自然环境与声景包——季节天气、地貌运动和环境声音');

    expect(architecture).toMatchObject({
      knowledge_domain: 'gears_asset',
      entry_role: 'asset_pack',
      asset_usage: expect.arrayContaining(['scene_space', 'scene_props', 'gears_delivery']),
    });
    expect(architecture?.production_prompts).toEqual(expect.arrayContaining([
      expect.stringContaining('空间层级'),
      expect.stringContaining('人物动线'),
    ]));
    expect(language).toMatchObject({
      knowledge_domain: 'regional_culture',
      entry_role: 'regional_pack',
      asset_usage: expect.arrayContaining(['dialogue_tone', 'source_grounding']),
    });
    expect(language?.review_boundaries).toEqual(expect.arrayContaining([
      expect.stringContaining('方言'),
      expect.stringContaining('刻板印象'),
    ]));
    expect(environment).toMatchObject({
      knowledge_domain: 'visual_style_pack',
      entry_role: 'style_pack',
      asset_usage: expect.arrayContaining(['scene_space', 'visual_style', 'gears_delivery']),
    });
    expect(environment?.production_prompts).toEqual(expect.arrayContaining([
      expect.stringContaining('季节'),
      expect.stringContaining('环境声'),
    ]));
  });

  it('injects ritual etiquette guidance with production and review boundaries', () => {
    const entries = buildChinaCultureDomainPackEntries({
      query: '民俗仪式短片需要祭礼流程、参与角色、空间秩序、礼俗禁忌和授权边界',
      limit: 4,
    });

    const ritualPack = entries.find(entry => (
      entry.entry_name === '仪式礼俗与禁忌包——流程角色、空间秩序和文化边界'
    ));
    expect(ritualPack).toMatchObject({
      knowledge_domain: 'safety_rule',
      entry_role: 'rule_pack',
      asset_usage: expect.arrayContaining(['scene_space', 'dialogue_tone', 'safety_boundary']),
    });
    expect(ritualPack?.production_prompts).toEqual(expect.arrayContaining([
      expect.stringContaining('参与角色'),
      expect.stringContaining('空间秩序'),
    ]));
    expect(ritualPack?.review_boundaries).toEqual(expect.arrayContaining([
      expect.stringContaining('通用礼俗包'),
      expect.stringContaining('授权'),
    ]));
  });

  it('builds knowledge pack entries from editable domain pack data', () => {
    const entries = buildChinaCultureDomainPackEntries({
      query: '周敦颐在月岩洞读书悟道，需要宋代士人服饰和洞穴场景资产边界',
      limit: 4,
    });

    expect(entries.some(entry => entry.knowledge_domain === 'era_setting' && entry.era === '宋')).toBe(true);
    expect(entries.some(entry => entry.knowledge_domain === 'gears_asset')).toBe(true);
  });

  it('injects narrative pattern packs for local historical influence stories', () => {
    const entries = buildChinaCultureDomainPackEntries({
      query: '周敦颐人物故事要讲长沙岳麓书院的思想影响、后世影响和当代转化',
      limit: 5,
    });

    expect(entries.some(entry =>
      entry.knowledge_domain === 'narrative_pattern'
      && entry.entry_role === 'pattern_pack'
      && entry.asset_usage?.includes('plot_structure'),
    )).toBe(true);
  });

  it('injects production domain packs for explainer and storyboard gaps', () => {
    const entries = buildChinaCultureDomainPackEntries({
      query: 'explainer_video 需要讲解知识结构包、核心问题、图示字幕，同时 AI漫剧分镜包 要补关键帧和连续性验收',
      limit: 6,
    });

    expect(entries.some(entry => entry.entry_name === '讲解知识结构包——核心问题、层级例子与图示字幕')).toBe(true);
    expect(entries.some(entry => entry.entry_name === 'AI漫剧分镜包——关键帧、表情节拍与连续性验收')).toBe(true);
    expect(entries.some(entry => entry.asset_usage?.includes('credibility_boundary'))).toBe(true);
    expect(
      entries.find(entry => entry.entry_name === '讲解知识结构包——核心问题、层级例子与图示字幕')?.production_prompts,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('图示'),
    ]));
    expect(
      entries.find(entry => entry.entry_name === 'AI漫剧分镜包——关键帧、表情节拍与连续性验收')?.review_boundaries,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('文化条目事实'),
    ]));
  });

  it('injects high-frequency domain packs for children, social short, and training requests', () => {
    const entries = buildChinaCultureDomainPackEntries({
      query: 'children_story 儿童故事要做年龄分层和善意张力；social_short 竖屏短视频要前三秒钩子；education_training 培训片要学习目标、练习和板书复盘',
      limit: 8,
    });

    expect(entries.some(entry => entry.entry_name === '儿童改写规则包——年龄分层、善意张力与事实边界')).toBe(true);
    expect(entries.some(entry => entry.entry_name === '短视频钩子包——三秒问题、对比反转与平台节奏')).toBe(true);
    expect(entries.some(entry => entry.entry_name === '宣讲培训结构包——论点案例、练习复盘与行动转化')).toBe(true);
    expect(
      entries.find(entry => entry.entry_name === '短视频钩子包——三秒问题、对比反转与平台节奏')?.review_boundaries,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('标题党'),
    ]));
    expect(
      entries.find(entry => entry.entry_name === '宣讲培训结构包——论点案例、练习复盘与行动转化')?.production_prompts,
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('学习目标'),
    ]));
  });

  it('keeps the legacy path logic-free and production consumers on the domain service', async () => {
    const [legacySource, storySource, preparationSource, storyKnowledgeSource, outlineSource, statusSource, gearsSource, systemSource] = await Promise.all([
      readFile(new URL('../services/domain-pack-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-knowledge-pack-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/outline-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/story-agent-mvp-status-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/gears-execution-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../routes/system.ts', import.meta.url), 'utf-8'),
    ]);

    expect(legacySource).toContain('Compatibility facade');
    expect(legacySource).not.toContain('function ');
    expect(legacySource).not.toContain('FALLBACK_DOMAIN_PACK_SEEDS');
    expect(storySource).toContain('story-generation-preparation-service.js');
    expect(preparationSource).toContain('story-knowledge-pack-service.js');
    expect(storyKnowledgeSource).toContain('domain-pack-production-service.js');
    expect(storySource).not.toContain('domain-pack-service.js');
    for (const source of [outlineSource, statusSource, gearsSource, systemSource]) {
      expect(source).toContain('domain-pack-production-service.js');
      expect(source).not.toContain('domain-pack-service.js');
    }
  });
});
