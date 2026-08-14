import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { EntryDetail } from '@shared/types.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';
import { buildAdaptationAnalysis } from '../services/adaptation-analysis-service.js';

const entry: EntryDetail = {
  name: '沈括——梦溪求真',
  province: '江苏',
  region: '镇江',
  type: '历史人物',
  summary: '沈括观察自然并记录发现。',
  story: '沈括少年时随母亲迁居多地，常观察山川。\n\n同窗张君见他在梦溪园记录磁针、天文与地貌现象。\n\n门生李生见证他反复验证，不轻下结论。',
  culturalSignificance: '求真精神连接古代知识与现代科学。',
  relatedLocations: [{ name: '梦溪园', description: '晚年著述地' }],
  keywords: ['沈括', '梦溪笔谈', '科学'],
  sources: ['测试来源'],
  credibility: '待核验',
  unverifiedPoints: ['具体对话为戏剧化表达'],
};

describe('china_culture local story generation dispatch', () => {
  it('runs the dramatic engine without claiming unresolved style-pack influence', () => {
    const result = generateChinaCultureLocalStoryAssembly({
      entry,
      centralEvent: '梦溪园反复验证磁针',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '克制',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.storyResult.scene_breakdown.length).toBeGreaterThanOrEqual(3);
    expect(result.memoryMosaicSeed).toBeUndefined();
    expect(result.referenceTrace).toBeUndefined();
  });

  it('builds a scene-short route with an entering observer, spatial reveals, and a stable return axis', () => {
    const result = generateChinaCultureLocalStoryAssembly({
      entry: {
        ...entry,
        name: '岳麓书院——千年学府弦歌不绝',
        region: '长沙→岳麓区',
        type: '名胜古迹',
        relatedLocations: [
          { name: '岳麓书院', description: '长沙市岳麓山脚下' },
          { name: '爱晚亭', description: '书院附近' },
        ],
        asset_split: {
          characters: [
            '岳麓书院讲解员/寻访者：连接书院建筑、湖湘文脉和观众视角的当代叙事入口',
            '湖南大学学生：千年学府延续到现代大学的当代人物',
          ],
          scenes: [
            '岳麓书院主轴空间：讲堂、门庭、书院院落和湖湘文脉主场景',
            '“惟楚有材，于斯为盛”门联位置：湖湘文化自信视觉锚点',
            '朱张会讲相关空间/讲堂：学术对话和听众聚集再现场景',
            '爱晚亭与岳麓山：书院周边文教山水场景',
          ],
          character_props: ['导览册', '学生笔记本'],
          scene_props: ['门联', '石阶', '讲堂匾额'],
        },
      },
      centralEvent: '岳麓书院空间导览',
      videoType: 'scene_short',
      presentationStyle: 'cinematic',
      storyStructure: 'object_clue_journey',
      targetDuration: '1分钟',
      tone: '克制',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const scenes = result.storyResult.scene_breakdown;
    expect(scenes).toHaveLength(4);
    expect(scenes.every(scene => scene.characters.includes('岳麓书院讲解员/寻访者'))).toBe(true);
    expect(result.storyResult.characters.map(character => character.name))
      .toContain('岳麓书院讲解员/寻访者');
    expect(scenes.map(scene => scene.location)).toEqual([
      '岳麓书院门庭',
      '书院院落',
      '朱张会讲相关讲堂',
      '岳麓书院门庭',
    ]);
    expect(scenes[0].key_action).toContain('从岳麓书院门庭进入书院院落');
    expect(scenes[1].key_action).toContain('门联');
    expect(scenes[2].key_action).toContain('推开讲堂木门');
    expect(scenes[3].key_action).toContain('沿原路线返回岳麓书院门庭');
    expect(scenes[2].visual_prompt).toContain('由书院院落向朱张会讲相关讲堂方向');
    expect(scenes.map(scene => scene.location)).toEqual(expect.arrayContaining([
      '岳麓书院门庭',
      '书院院落',
      '朱张会讲相关讲堂',
    ]));
  });

  it('runs memory mosaic with a seed and a default trace when no style pack is selected', () => {
    const result = generateChinaCultureLocalStoryAssembly({
      entry,
      centralEvent: '梦溪园留下求真记录',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'memory_mosaic_biography',
      targetDuration: '3分钟',
      tone: '追忆',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.storyResult.scene_breakdown).toHaveLength(6);
    expect(result.memoryMosaicSeed).toBeDefined();
    expect(result.referenceTrace).toHaveLength(1);
    expect(result.referenceTrace?.[0]).toMatchObject({
      source_story_structure: 'memory_mosaic_biography',
      applied_rules: expect.arrayContaining(['用物件开场', '结尾呼应物件']),
    });
  });

  it('fails closed instead of inventing a witness or crashing when source material has none', () => {
    const result = generateChinaCultureLocalStoryAssembly({
      entry: {
        ...entry,
        story: '资料只记录梦溪园中的器物与自然观察，没有可识别的人物关系。',
      },
      centralEvent: '梦溪园留下求真记录',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'memory_mosaic_biography',
      targetDuration: '3分钟',
      tone: '追忆',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'memory_mosaic_witnesses_missing',
      message: '回忆拼图结构需要至少一位可从资料中识别的见证人物，请补充人物关系或改用其他故事结构',
    });
  });

  it.each(['1分钟', '3分钟'] as const)(
    'builds a dated and sourced Wuchang causal chain for the %s knowledge-only variant',
    (targetDuration) => {
      const result = generateChinaCultureLocalStoryAssembly({
        entry: {
          name: '武昌起义——辛亥革命的第一声枪响',
          province: '湖北',
          region: '武汉→武昌区',
          type: '地方掌故',
          summary: '1911年10月10日，新军在武昌发动起义并攻占湖广总督署。',
          story: [
            '1911年10月9日，汉口俄租界炸弹意外爆炸，起义计划泄露，清军开始搜捕革命党人。',
            '10月10日晚，新军工程营士兵率先行动，全营响应起义。',
            '起义军攻占楚望台军械库获得弹药后攻入湖广总督署，武昌城局势由此改变。',
          ].join('\n\n'),
          culturalSignificance: '普通新军士兵的行动成为辛亥革命的重要开端。',
          relatedLocations: [
            { name: '楚望台军械库', description: '起义军获得弹药的转折空间' },
            { name: '湖广总督署', description: '起义军后续推进的官署空间' },
          ],
          keywords: ['武昌起义', '辛亥革命', '新军起义', '楚望台军械库'],
          sources: ['辛亥革命武昌起义纪念馆官方资料'],
          credibility: '基本可靠',
          unverifiedPoints: ['率先开枪的具体经过在不同回忆中有细微差异'],
          era: '近代',
        },
        centralEvent: '武昌起义提前发动并争夺楚望台军械库',
        videoType: 'historical_drama',
        presentationStyle: 'cinematic',
        storyStructure: 'single_event_drama',
        targetDuration,
        tone: '紧张克制',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      const scenes = result.storyResult.scene_breakdown;
      expect(scenes).toHaveLength(6);
      expect(scenes.filter(scene => /1911年|10月(?:9|10|11)日/.test(`${scene.time_of_day}${scene.plot}`)).length)
        .toBeGreaterThanOrEqual(2);
      expect(scenes.filter(scene => /(?:依据|条目记载)/.test(scene.factual_basis ?? '')).length)
        .toBeGreaterThanOrEqual(2);
      expect(scenes.filter(scene => scene.fictionalized_elements?.some(item => /再现|影视化|合成/.test(item))).length)
        .toBeGreaterThanOrEqual(2);
      expect(new Set(scenes.map(scene => scene.location)).size).toBeGreaterThanOrEqual(4);
      expect(scenes.map(scene => `${scene.plot}${scene.key_action}`).join('\n'))
        .toMatch(/因为|导致|迫使|获得.{0,20}后|才有/);
      expect([...new Set(scenes.flatMap(scene => scene.characters))])
        .toEqual(expect.arrayContaining(['新军士兵', '起义军', '普通士兵']));
    },
  );

  it.each(['1分钟', '3分钟'] as const)(
    'builds an evidence-led Yuelu documentary without fabricating interview audio for the %s variant',
    (targetDuration) => {
      const result = generateChinaCultureLocalStoryAssembly({
        entry: {
          name: '岳麓书院——千年学府弦歌不绝',
          province: '湖南',
          region: '长沙→岳麓区',
          type: '名胜古迹',
          summary: '岳麓书院以讲学、会讲和今日校园延续湖湘文脉。',
          story: [
            '岳麓书院始建于北宋开宝九年（976年），由潭州太守朱洞创立。',
            '南宋时朱熹与张栻在此会讲，形成开放论辩的学术传统。',
            '书院延续至今，与湖南大学校园和当代学习生活相连。',
          ].join('\n\n'),
          culturalSignificance: '岳麓书院是湖湘文化的重要精神地标，讲学与论辩传统延续到当代教育。',
          relatedLocations: [
            { name: '岳麓书院门庭', description: '门联与空间入口' },
            { name: '岳麓书院讲堂', description: '讲学与会讲空间' },
          ],
          keywords: ['岳麓书院', '朱张会讲', '惟楚有材', '湖湘文脉'],
          sources: ['岳麓书院官方资料'],
          credibility: '基本可靠',
          unverifiedPoints: ['具体会讲对白不可写成历史原话'],
        },
        centralEvent: '朱张会讲',
        videoType: 'documentary_short',
        presentationStyle: 'documentary',
        storyStructure: 'object_clue_journey',
        targetDuration,
        tone: '克制求证',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      const scenes = result.storyResult.scene_breakdown;
      const text = scenes.map(scene => [
        scene.plot,
        scene.key_action,
        scene.dialogue_or_narration,
        scene.camera_suggestion,
        scene.cultural_note,
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter(Boolean).join('\n')).join('\n');

      expect(scenes).toHaveLength(5);
      expect(scenes.map(scene => scene.dramatic_function)).toEqual([
        '现实引入',
        '历史回望',
        '关键节点',
        '史料/专家解读',
        '当代意义',
      ]);
      expect(new Set(scenes.map(scene => scene.location)).size).toBeGreaterThanOrEqual(4);
      expect(text).toContain('976年');
      expect(text).toContain('朱张会讲');
      expect(text).toContain('采访规划（非现成同期声）');
      expect(text).toContain('待真实采访录音后选择');
      expect(text).toMatch(/鸟鸣|脚步声/);
      expect(text).toMatch(/翻页声|纸页声/);
      expect(text).toMatch(/讨论声|提问声/);
      expect(text).not.toMatch(/采访原话[：:“”]|馆员说[：：“”]|研究者说[：：“”]/);
      expect(scenes.filter(scene => scene.factual_basis?.trim())).toHaveLength(5);
      expect(scenes.filter(scene => (scene.fictionalized_elements?.length ?? 0) > 0).length)
        .toBeGreaterThanOrEqual(3);
      expect(scenes.at(-1)?.key_action).toMatch(/翻回|回答|写下/);
    },
  );

  it.each(['30秒', '1分钟', '3分钟'] as const)(
    'builds a layered Wulingyuan landscape sequence with explicit claim boundaries for the %s variant',
    (targetDuration) => {
      const result = generateChinaCultureLocalStoryAssembly({
        entry: {
          name: '张家界武陵源——3.8亿年雕琢的世界自然遗产',
          province: '湖南',
          region: '张家界→武陵源',
          type: '自然景观',
          summary: '武陵源以石英砂岩峰林地貌、峡谷、溪流和云雾景观闻名。',
          story: '武陵源的石英砂岩峰林在流水侵蚀、风化与崩塌等长期作用下形成。\n\n云雾、溪流和峰柱构成层次丰富的山水景观。',
          culturalSignificance: '武陵源自然景观需要在准确地名与季节边界下呈现。',
          relatedLocations: [{ name: '武陵源风景名胜区', description: '石英砂岩峰林集中分布区域' }],
          keywords: ['武陵源', '峰林', '云雾', '溪流'],
          sources: ['武陵源官方地质科普资料'],
          credibility: '基本可靠',
          unverifiedPoints: ['具体云海、光线和可见度受季节与天气影响'],
        },
        centralEvent: '武陵源峰林云雾的一日变化',
        videoType: 'landscape_mood',
        presentationStyle: 'ink_style',
        storyStructure: 'object_clue_journey',
        targetDuration,
        tone: '空灵克制',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      const scenes = result.storyResult.scene_breakdown;
      const text = scenes.map(scene => [
        scene.plot,
        scene.key_action,
        scene.visual_prompt,
        scene.camera_suggestion,
        scene.cultural_note,
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter(Boolean).join('\n')).join('\n');

      expect(scenes).toHaveLength(targetDuration === '30秒' ? 3 : 4);
      expect(scenes.every(scene => scene.characters.length === 0)).toBe(true);
      expect(text).toMatch(/前景.+中景.+后景/);
      expect(text).toContain('色彩方案');
      expect(text).toContain('人物尺度参照');
      expect(text).toContain('镜头节奏');
      expect(text).toContain('景观边界');
      expect(text).toContain('季节事实');
      expect(text).toMatch(/清晨.+日光.+暮色/);
      expect(text).not.toContain('全球唯一');
      expect(text).not.toMatch(/天子山.+天门山|天门山.+天子山/);
      expect(scenes.at(-1)?.camera_suggestion).toMatch(/固定|停留五秒|留白/);
    },
  );

  it.each(['30秒', '1分钟', '3分钟'] as const)(
    'builds a Changsha city-brand route with audience, soundscape, visitor action, and rain fallback for the %s variant',
    (targetDuration) => {
      const result = generateChinaCultureLocalStoryAssembly({
        entry: {
          name: '岳麓书院——千年学府弦歌不绝',
          province: '湖南',
          region: '长沙→岳麓区',
          type: '名胜古迹',
          summary: '岳麓书院以讲学、会讲和今日校园延续湖湘文脉。',
          story: '岳麓书院始建于北宋开宝九年（976年）。\n\n南宋时朱熹与张栻在此会讲。\n\n书院延续至今。',
          culturalSignificance: '讲学与论辩传统延续到当代教育。',
          relatedLocations: [
            { name: '岳麓书院', description: '书院空间与门联' },
            { name: '爱晚亭', description: '岳麓山文教山水节点' },
          ],
          keywords: ['岳麓书院', '朱张会讲', '惟楚有材', '湖湘文脉'],
          sources: ['岳麓书院官方资料'],
          credibility: '基本可靠',
          unverifiedPoints: ['具体活动、游客和场地开放状态须另行核验'],
        },
        centralEvent: '长沙岳麓书院文脉与当代生活',
        videoType: 'city_brand_promo',
        presentationStyle: 'voiceover_montage',
        storyStructure: 'object_clue_journey',
        targetDuration,
        tone: '明亮克制',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      const scenes = result.storyResult.scene_breakdown;
      const text = scenes.map(scene => [
        scene.plot,
        scene.key_action,
        scene.dialogue_or_narration,
        scene.camera_suggestion,
        scene.cultural_note,
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter(Boolean).join('\n')).join('\n');

      expect(scenes).toHaveLength(5);
      expect(new Set(scenes.map(scene => scene.location)).size).toBeGreaterThanOrEqual(4);
      expect(text).toContain('城市身份');
      expect(text).toContain('目标客群');
      expect(text).toContain('空间路线');
      expect(text).toContain('城市声音');
      expect(text).toContain('游客行动');
      expect(text).toContain('天气备选');
      expect(text).toContain('场地拍摄许可待真实确认');
      expect(text).toMatch(/门庭.+讲堂.+校园.+街巷/);
      expect(text).not.toMatch(/(?:本片采用|官方审定|政府审定)的?官方城市口号|已经取得拍摄许可|许可已取得/);
    },
  );

  it.each([
    {
      videoType: 'character_story' as const,
      source: '雨夜，周敦颐在南安军衙翻到矛盾证词。\n\n知军王逵催他画押；周敦颐决定拒签并交还任命文书。\n\n案卷重开，囚犯免死，他愿承担失去官职的代价。',
      expected: ['周敦颐', '王逵', '拒签', '失去官职'],
      expectedEnding: '良知',
    },
    {
      videoType: 'historical_drama' as const,
      source: '武昌起义消息提前泄露，新军士兵连夜集结。\n\n起义军冲向楚望台军械库，推开库门并搬出枪械。\n\n普通士兵的行动引发连锁响应，武昌城局势改变。',
      expected: ['新军士兵', '起义军', '楚望台军械库', '普通士兵'],
      expectedEnding: '担当',
    },
    {
      videoType: 'legend_story' as const,
      source: '刘海在山路遇见胡大姐，她以神异力量挡开危机。\n\n乡邻怀疑迫使两人分开；刘海回头寻找胡大姐。\n\n两人共同通过考验，这是民间传说中的讲法。',
      expected: ['刘海', '胡大姐', '乡邻', '民间传说'],
      expectedEnding: '真心',
    },
    {
      videoType: 'children_story' as const,
      source: '小刘海在山路丢了柴绳，胡大姐帮他捆好木柴。\n\n别人劝他不要相信陌生人；小刘海决定先看行动。\n\n误会解开，两人把柴担送到家门口。',
      expected: ['小刘海', '胡大姐', '先看行动', '柴担'],
      expectedEnding: '成长',
    },
    {
      videoType: 'ai_comic_drama' as const,
      source: '雨夜，刘海发现胡大姐的影子在雷光里变成狐形。\n\n村人逼他交人；胡大姐挡在受伤孩子前。\n\n刘海放下柴刀护住胡大姐，门外响起新的脚步声。',
      expected: ['刘海', '胡大姐', '狐形', '放下柴刀'],
      expectedEnding: '勇敢',
    },
  ])('uses the user source as the local $videoType adaptation spine', ({ videoType, source, expected, expectedEnding }) => {
    const adaptationAnalysis = buildAdaptationAnalysis(source);
    const result = generateChinaCultureLocalStoryAssembly({
      entry,
      centralEvent: '用户原作核心事件',
      videoType,
      presentationStyle: videoType === 'ai_comic_drama' ? 'ai_comic' : 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '3分钟',
      tone: '克制',
      originalUserQuery: source,
      adaptationAnalysis,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    for (const phrase of expected) expect(result.storyResult.full_text).toContain(phrase);
    expect(result.storyResult.scene_breakdown.at(-1)?.plot).toContain(expectedEnding);
    expect(result.storyResult.scene_breakdown.every(scene => scene.plot.length >= 20)).toBe(true);
    if (videoType === 'character_story') {
      expect(new Set(result.storyResult.scene_breakdown.map(scene => scene.location)))
        .toEqual(new Set(['南安军衙']));
    }
  });

  it('keeps the top-level orchestrator free of direct local engine dispatch', async () => {
    const [source, executionSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-execution-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(source).toContain("from './story-generation-execution-service.js'");
    expect(source).not.toContain("from './story-local-generation-service.js'");
    expect(source).not.toContain('generateDramaticContent({');
    expect(source).not.toContain('generateMemoryMosaicContent({');
    expect(source).not.toContain('buildMemoryMosaicSeed(');
    expect(source).not.toContain('function slugify(');
    expect(executionSource).toContain("from './story-local-generation-service.js'");
    expect(executionSource).toContain('generateChinaCultureLocalStoryAssembly({');
  });
});
