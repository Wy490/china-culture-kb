import { describe, expect, it } from 'vitest';
import { generateDramaticContent, validateDramaticStory } from '../services/dramatic-story.js';
import type { EntryDetail, StoryScene } from '@shared/types.js';

function scene(partial: Partial<StoryScene> & Pick<StoryScene, 'scene_id' | 'title' | 'dramatic_function' | 'plot' | 'key_action'>): StoryScene {
  return {
    duration_sec: 30,
    location: '韶山',
    time_of_day: '白天',
    characters: ['毛泽东'],
    visual_prompt: '湖南乡土与青年求学画面',
    camera_suggestion: '中景',
    cultural_note: '',
    ...partial,
  };
}

describe('validateDramaticStory', () => {
  it('accepts revolutionary ideal words as an ending theme', () => {
    const report = validateDramaticStory({
      title: '少年毛泽东的求索',
      selectedEvent: '少年求学走向革命',
      full_text: [
        '少年毛泽东在乡土和课堂之间追问中国的出路。',
        '面对旧秩序与新思想的冲突，他选择继续求索。',
        '结尾处，他把个人志向放进人民与理想之中，革命道路由此展开。',
      ].join('\n\n'),
      scene_breakdown: [
        scene({
          scene_id: 1,
          title: '少年出场',
          dramatic_function: '开场',
          plot: '少年毛泽东在韶山读书劳动，看见乡土中国的困顿，也产生改变现实的追问。',
          key_action: '提出疑问',
          conflict: '旧秩序与少年追问发生冲突',
        }),
        scene({
          scene_id: 2,
          title: '选择求索',
          dramatic_function: '冲突',
          plot: '他面对保守观念和新思想的拉扯，选择走出乡土继续求学，寻找改变中国的答案。',
          key_action: '选择求学',
          conflict: '守旧与求新之间的选择',
        }),
        scene({
          scene_id: 3,
          title: '理想落点',
          dramatic_function: '高潮',
          plot: '他把个人志向放进人民与理想之中，明白真正的道路不是只为自己，而是为更多人寻找出路。',
          key_action: '确立理想',
          cultural_note: '革命觉醒',
        }),
      ],
    });

    expect(report.hasEndingTheme).toBe(true);
    expect(report.issues).not.toContain('缺少结尾主题——没有精神/道德落点');
  });

  it('keeps a 30-second landscape story sparse and accepts a poetic ending', () => {
    const entry: EntryDetail = {
      name: '张家界武陵源——峰林云海',
      province: '湖南',
      region: '张家界武陵源',
      type: '世界自然遗产',
      summary: '石英砂岩峰林在云雾、晨光和雨水中呈现持续变化的山水景观。',
      story: '清晨云雾沿峰林移动，雨水从石壁落入溪谷，暮色让远峰逐渐隐去。',
      culturalSignificance: '武陵源展现自然地貌与时间共同塑造的山水灵韵。',
      relatedLocations: [{ name: '武陵源观景台', description: '观察峰林云海的空间节点' }],
      keywords: ['山', '水', '云', '雾', '风'],
      sources: ['知识库测试条目'],
      credibility: '高',
      unverifiedPoints: [],
    };

    const story = generateDramaticContent({
      entry,
      centralEvent: '峰林云海从清晨流向暮色',
      videoType: 'landscape_mood',
      presentationStyle: 'ink_style',
      targetDuration: '30秒',
      tone: '空灵',
    });
    const duration = story.scene_breakdown.reduce((sum, item) => sum + item.duration_sec, 0);
    const contentChars = story.full_text.replace(/[\s\p{P}\p{S}]/gu, '').length;
    const report = validateDramaticStory({
      ...story,
      selectedEvent: '峰林云海从清晨流向暮色',
      videoType: 'landscape_mood',
    });

    expect(duration).toBe(30);
    expect(contentChars / duration).toBeLessThanOrEqual(2.5);
    expect(story.scene_breakdown.at(-1)?.plot).toMatch(/留白|余味|未说完/);
    expect(story.scene_breakdown.filter(item => item.dialogue_or_narration?.trim())).toHaveLength(2);
    expect(story.scene_breakdown.map(item => item.dialogue_or_narration).join('\n')).not.toContain('来源');
    expect(report.hasEndingTheme).toBe(true);
    expect(report.issues).not.toContain('缺少结尾主题——没有精神/道德落点');
  });

  it('generates a usable Zhou Dunyi refusal character story without polluted place or quote fields', () => {
    const entry: EntryDetail = {
      name: '周敦颐——理学开山鼻祖',
      province: '湖南',
      region: '永州→道县（籍贯/出生地）；衡阳（少年成长地）',
      type: '历史人物',
      summary: '周敦颐，北宋思想家，曾任南安军司理参军。',
      story: [
        '拒签死刑文书：周敦颐任南安军司理参军时，发现疑案证据不足，囚犯依法不该死。知军王逵催他签字，他拒绝草草画押。',
        '他对知军王逵说："杀人以媚人，吾不为也！"后来囚犯免死。',
        '另有后世学术争议讨论陈抟与理学思想来源，不属于拒签事件人物。',
        '父母爱之如子，为之命名，教之读书。',
      ].join('\n\n'),
      culturalSignificance: '周敦颐的选择体现公正、廉洁与良知。',
      relatedLocations: [{ name: '道县濂溪', description: '周敦颐相关地点' }],
      keywords: ['周敦颐', '通书', '慎动', '王逵', '陈抟', '南安军', '拒签', '案卷'],
      sources: ['知识库测试条目'],
      credibility: 'medium',
      unverifiedPoints: [],
      era: '北宋',
    };

    const story = generateDramaticContent({
      entry,
      centralEvent: '拒签死刑文书',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '',
    });

    expect(story.scene_breakdown).toHaveLength(6);
    expect(new Set(story.scene_breakdown.map(scene => scene.location))).toEqual(new Set(['南安军衙']));
    expect(story.full_text).toContain('雨夜，南安军衙');
    expect(story.full_text).toContain('囚犯因此免死');
    expect(story.full_text).not.toContain('永州→道县');
    expect(story.full_text).not.toContain('爱之如子');
    expect(story.logline).not.toMatch(/永州→道县|籍贯\/出生地|少年成长地/);
    expect(story.full_text).toContain('知军王逵');
    expect(story.full_text).not.toContain('通书');
    expect(story.full_text).toContain('"杀人以媚人，吾不为也！"');
    expect(story.full_text).not.toMatch(/为上官杀人|以媚于人/);
    expect(story.characters.map(character => character.name)).toEqual(['周敦颐', '王逵']);

    const validReport = validateDramaticStory({
      ...story,
      selectedEvent: '拒签死刑文书',
      videoType: 'character_story',
    });
    expect(validReport.passed).toBe(true);

    const pollutedReport = validateDramaticStory({
      ...story,
      full_text: story.full_text.replace('杀人以媚人，吾不为也！', '为上官杀人，以媚于人，吾不为也。'),
      scene_breakdown: story.scene_breakdown.map((scene, index) => index === 2
        ? { ...scene, plot: scene.plot.replaceAll('知军王逵', '通书'), characters: ['周敦颐', '通书', '慎动'] }
        : scene),
      selectedEvent: '拒签死刑文书',
      videoType: 'character_story',
    });
    expect(pollutedReport.passed).toBe(false);
    expect(pollutedReport.issues).toContain('拒签史实失真——著作或概念被误作人物，或可证原句遭改写');
  });

  it('does not split a protagonist into a duplicate shorter character asset', () => {
    const entry: EntryDetail = {
      name: '周敦颐拒绝签押——用户项目素材',
      province: '用户素材',
      region: '用户素材',
      type: '用户素材',
      summary: '周敦颐发现案卷疑点并拒绝签押。',
      story: '北宋南安的刑狱压力下，周敦颐发现案卷疑点，拒绝签押并承担后果。',
      culturalSignificance: '用户项目素材，需要核验。',
      relatedLocations: [],
      keywords: ['周敦颐', '周敦', '拒绝', '签押', '案卷'],
      sources: ['用户提供素材'],
      credibility: '用户提供',
      unverifiedPoints: [],
    };

    const story = generateDramaticContent({
      entry,
      centralEvent: '周敦颐拒绝签押',
      videoType: 'historical_drama',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '',
    });

    expect(story.characters.map(character => character.name)).toEqual(['周敦颐']);
    expect(story.scene_breakdown.flatMap(scene => scene.characters)).not.toContain('周敦');
    expect(new Set(story.scene_breakdown.map(scene => scene.location))).toEqual(new Set(['南安军衙']));
    expect(story.full_text).toContain('案卷');
    expect(story.full_text).not.toContain('用户素材，时代风云激荡');
  });

  it('does not duplicate the subject when documentary and lecture titles already equal the central event', () => {
    const entry: EntryDetail = {
      name: '岳阳楼的一天——用户项目素材',
      province: '用户素材',
      region: '岳阳',
      type: '用户素材',
      summary: '跟随讲解员观察岳阳楼的一天。',
      story: '清晨开门，白天讲解，黄昏闭馆。',
      culturalSignificance: '现场观察需要文献和实景互证。',
      relatedLocations: [],
      keywords: ['岳阳楼', '讲解员'],
      sources: ['用户提供素材'],
      credibility: '用户提供',
      unverifiedPoints: [],
    };

    for (const videoType of ['documentary_short', 'lecture_video'] as const) {
      const story = generateDramaticContent({
        entry,
        centralEvent: '岳阳楼的一天',
        videoType,
        presentationStyle: videoType === 'documentary_short' ? 'documentary' : 'host_narration',
        targetDuration: '3分钟',
        tone: '',
      });
      expect(story.title).toBe('岳阳楼的一天');
    }
  });

  it('keeps historical climaxes and explainer openings concrete enough for GEARS delivery', () => {
    const historicalEntry: EntryDetail = {
      name: '武昌起义——辛亥革命的第一声枪响',
      province: '湖北',
      region: '武汉武昌',
      type: '历史事件',
      summary: '武昌起义中新军行动并争夺楚望台军械库。',
      story: '起义士兵冲向楚望台军械库，守军封门，双方在库门前争夺武器。',
      culturalSignificance: '武昌起义成为辛亥革命的重要开端。',
      relatedLocations: [{ name: '楚望台军械库', description: '起义军争夺军械的现场' }],
      keywords: ['武昌起义', '新军', '楚望台军械库'],
      sources: ['测试史料'],
      credibility: '高',
      unverifiedPoints: [],
      era: '近代',
    };
    const historical = generateDramaticContent({
      entry: historicalEntry,
      centralEvent: '武昌起义提前发动并争夺楚望台军械库',
      videoType: 'historical_drama',
      presentationStyle: 'cinematic',
      targetDuration: '1分钟',
      tone: '',
    });
    const historicalClimax = historical.scene_breakdown.find(scene => scene.dramatic_function === '高潮');

    expect(historicalClimax?.plot.length).toBeGreaterThanOrEqual(35);
    expect(historicalClimax?.plot).toMatch(/楚望台军械库|库门/);
    expect(historicalClimax?.plot).toMatch(/冲|推|夺|开|举/);

    const explainerEntry: EntryDetail = {
      ...historicalEntry,
      name: '张家界武陵源——石英砂岩峰林',
      region: '张家界武陵源观景台',
      type: '世界自然遗产',
      summary: '石英砂岩在节理、流水侵蚀与重力作用下形成峰林。',
      story: '观景台可同时看到连片峰墙、被切开的峡谷和孤立峰柱。',
      culturalSignificance: '武陵源以独特峰林地貌展示漫长地质作用。',
      keywords: ['石英砂岩', '垂直节理', '流水侵蚀'],
    };
    const explainer = generateDramaticContent({
      entry: explainerEntry,
      centralEvent: '石英砂岩峰林如何形成',
      videoType: 'explainer_video',
      presentationStyle: 'host_narration',
      targetDuration: '1分钟',
      tone: '',
    });
    const question = explainer.scene_breakdown[0];

    expect(question.plot.length).toBeGreaterThanOrEqual(35);
    expect(question.plot).toMatch(/观景台|峰墙|峡谷|峰柱/);
    expect(question.plot).toMatch(/指|摆|对照|圈/);
  });

  it('turns a Wuchang uprising adaptation into six distinct causal scenes led by ordinary soldiers', () => {
    const entry: EntryDetail = {
      name: '武昌起义——辛亥革命的第一声枪响',
      province: '湖北',
      region: '武汉武昌',
      type: '地方掌故',
      summary: '1911年10月10日，新军在武昌发动起义并攻占湖广总督署。',
      story: [
        '10月9日，汉口俄租界炸弹意外爆炸，起义计划泄露，清军开始搜捕革命党人。',
        '10月10日晚，新军士兵响应起义，起义军攻占楚望台军械库获得弹药后攻入湖广总督署。',
        '武昌起义成功后，两个月内多省先后宣布独立。',
      ].join('\n\n'),
      culturalSignificance: '武昌起义由新军中的普通士兵率先发动，成为辛亥革命的重要开端。',
      relatedLocations: [
        { name: '楚望台军械库', description: '起义军获得弹药的转折空间' },
        { name: '湖广总督署', description: '起义军攻入的官署空间' },
      ],
      keywords: ['武昌起义', '辛亥革命', '新军起义', '金兆龙', '程定国', '楚望台军械库'],
      sources: ['辛亥革命武昌起义纪念馆官方资料'],
      credibility: '基本可靠',
      unverifiedPoints: ['率先开枪的具体经过在不同回忆中有细微差异'],
      era: '近代',
    };
    const source = [
      '武昌起义消息提前泄露，新军士兵连夜集结，决定抢在清军搜捕前发动。',
      '起义军冲向楚望台军械库，推开库门、搬出枪械，再向湖广总督署推进。',
      '普通士兵的行动引发连锁响应，武昌城的局势由此改变。',
    ].join('\n\n');
    const story = generateDramaticContent({
      entry,
      centralEvent: '武昌起义提前发动并争夺楚望台军械库',
      videoType: 'historical_drama',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '紧张克制',
      originalUserQuery: source,
      adaptationAnalysis: {
        source_mode: 'user_novel',
        source_length: source.length,
        source_summary: '普通新军士兵在计划泄露后提前发动起义并引发连锁响应。',
        core_characters: ['新军士兵', '起义军', '普通士兵'],
        plot_beats: source.split('\n\n'),
        must_keep: ['新军士兵', '起义军', '普通士兵', '提前发动', '楚望台军械库', '连锁响应'],
        compressible_parts: [],
        visual_setpieces: ['夜间搜捕', '军械库争夺', '湖广总督署推进'],
        adaptation_risks: ['不得虚构唯一的第一枪人物或把复杂历史结果归为单因'],
      },
    });

    expect(story.scene_breakdown).toHaveLength(6);
    expect(new Set(story.scene_breakdown.map(item => item.plot)).size).toBe(6);
    expect(story.scene_breakdown[0].plot).toMatch(/10月9日|计划泄露/);
    expect(story.scene_breakdown[0].plot).toMatch(/搜捕|处决|逼近/);
    expect(story.scene_breakdown[1].plot).toMatch(/新军士兵/);
    expect(story.scene_breakdown[1].plot).toMatch(/提前发动|决定|选择/);
    expect(story.scene_breakdown[2].plot).toMatch(/10月10日|枪声|营门/);
    expect(story.scene_breakdown[3].plot).toMatch(/楚望台军械库/);
    expect(story.scene_breakdown[3].plot).toMatch(/推开|搬出|弹药|枪械/);
    expect(story.scene_breakdown[4].plot).toMatch(/湖广总督署|连锁响应/);
    expect(story.scene_breakdown[5].plot).toMatch(/普通士兵/);
    expect(story.scene_breakdown[5].plot).toMatch(/多省|十四省|响应|改变/);
    expect(story.scene_breakdown.every(item => item.source_entries?.includes('用户提供改编素材'))).toBe(true);
    expect(story.characters.map(item => item.name)).toEqual(expect.arrayContaining(['新军士兵', '起义军', '普通士兵']));
    expect(story.characters.map(item => item.name)).not.toEqual(expect.arrayContaining(['武昌', '辛亥革命', '终结帝制']));
    expect(story.full_text).not.toContain('镜头沿人物移动、对峙与关键物件推进');
  });

  it('does not inject case-signing dialogue or unrelated locations into a Mao Zedong awakening story', () => {
    const entry: EntryDetail = {
      name: '毛泽东——从韶山冲走向天安门的农家革命者',
      province: '湖南',
      region: '湖南湘潭韶山',
      type: '历史人物',
      summary: '毛泽东从韶山农家少年成长为投身革命实践的青年。',
      story: [
        '**韶山少年（1893—1910）**：毛泽东在韶山读书务农，1910年决意离家求学，临行写下“孩儿立志出乡关”。',
        '**长沙求学与新民学会（1910—1918）**：毛泽东在湖南一师求学，1918年与蔡和森等创建新民学会，立旨“改造中国与世界”。',
        '**湘江评论与驱张运动（1919—1920）**：毛泽东在长沙创刊主编《湘江评论》，提出“民众联合的力量最强”，并投身驱张运动。',
        '**韶山农民实践与考察报告（1925—1927）**：毛泽东组织农民夜校和农民协会，随后考察湖南农民运动。',
      ].join('\n\n'),
      culturalSignificance: '湖南乡土、青年求学和农民实践共同推动了革命理想的形成。',
      relatedLocations: [
        { name: '韶山毛泽东故居', description: '少年成长地' },
        { name: '湖南第一师范', description: '长沙求学地' },
        { name: '《湘江评论》旧址', description: '长沙办刊和思想行动相关地点' },
      ],
      keywords: ['毛泽东', '韶山', '湖南一师', '新民学会', '湘江评论', '农民运动'],
      sources: ['测试史料'],
      credibility: '高',
      unverifiedPoints: [],
      era: '近代',
    };

    const story = generateDramaticContent({
      entry,
      centralEvent: '湘江评论与驱张运动（1919—1920）',
      videoType: 'historical_drama',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '庄重',
      originalUserQuery: '毛泽东少年时期到革命觉醒，重点表现湖南乡土、求学、新民学会、农民运动、理想形成。',
    });

    expect(story.title).toBe('毛泽东：从韶山少年到革命觉醒');
    expect(story.full_text).toContain('离开韶山求学');
    expect(story.full_text).toContain('湖南第一师范');
    expect(story.full_text).toContain('新民学会');
    expect(story.full_text).toContain('夜校');
    expect(story.full_text).toContain('湘潭、湘乡、衡山、醴陵、长沙');
    expect(story.full_text).not.toMatch(/此案有疑|不能签字|拒签\/断案|上官施压/);
    expect(story.scene_breakdown.map(scene => scene.location)).toEqual([
      '韶山冲农舍与田埂',
      '湖南第一师范与湘中乡路',
      '长沙岳麓山下新民学会成立旧址',
      '韶山农民夜校旧址',
      '湖南五县农民运动考察路线',
    ]);
    expect(story.scene_breakdown.every(scene => !/案卷|签笔|衙署/.test(scene.visual_prompt))).toBe(true);
    expect(story.characters.map(character => character.name)).toEqual(expect.arrayContaining(['毛泽东']));
    expect(story.characters.map(character => character.name)).not.toContain('少年');
  });

  it('turns the Liu Hai legend into a visible supernatural trial, human choice, and transmission ending', () => {
    const entry: EntryDetail = {
      name: '刘海砍樵——人仙之恋的湖南民间传说',
      province: '湖南',
      region: '常德→武陵（传说发源地）；长沙（花鼓戏经典改编地）',
      type: '民间故事',
      summary: '武陵樵夫刘海与狐仙胡大姐跨越人仙界限的爱情故事，后来经花鼓戏改编传播。',
      story: [
        '刘海是武陵的一名勤劳樵夫，以砍柴为生。狐仙胡大姐化身女子下凡，在砍柴途中与刘海相遇。',
        '两人相爱后，胡大姐的狐仙身份被揭露，经历一系列考验。最终两人战胜困难。',
        '该传说流传于常德武陵山区及长沙地区，长沙花鼓戏将其加工为舞台经典。',
      ].join('\n\n'),
      culturalSignificance: '传说表现勤劳善良与忠贞选择，并通过湖南花鼓戏经典对唱广泛传播。',
      relatedLocations: [
        { name: '常德武陵山林', description: '传说中的砍樵与相遇场景' },
        { name: '长沙花鼓戏舞台', description: '戏曲改编和传播场景' },
      ],
      keywords: ['刘海砍樵', '胡大姐', '狐仙', '花鼓戏', '武陵', '比翼鸟', '人仙之恋'],
      sources: ['湖南花鼓戏经典剧目《刘海砍樵》', '常德武陵民间口述传说'],
      credibility: '待核实',
      unverifiedPoints: ['民间口述版本与花鼓戏改编版本存在差异'],
    };

    const story = generateDramaticContent({
      entry,
      centralEvent: '刘海砍樵与人仙相恋的考验',
      videoType: 'legend_story',
      presentationStyle: 'ink_style',
      targetDuration: '1分钟',
      tone: '温暖传奇',
    });

    expect(story.scene_breakdown.map(item => item.dramatic_function)).toEqual([
      '远古传说',
      '神力显现',
      '凡人考验',
      '命运转折',
      '传说永恒',
    ]);
    expect(story.scene_breakdown[0].plot).toMatch(/相传|民间传说/);
    expect(story.scene_breakdown[0].plot).toMatch(/武陵|山路/);
    expect(story.scene_breakdown[0].plot).toMatch(/柴担|柴刀|斧头/);
    expect(story.scene_breakdown[1].plot).toMatch(/胡大姐/);
    expect(story.scene_breakdown[1].plot).toMatch(/狐影|狐仙|花篮|披帛/);
    expect(story.scene_breakdown[2].plot).toMatch(/乡邻|村人|旁人/);
    expect(story.scene_breakdown[2].plot).toMatch(/放下|退后|站到|选择/);
    expect(story.scene_breakdown[3].plot).toMatch(/回头|并肩|护住|留下/);
    expect(story.scene_breakdown[3].plot).toMatch(/因此|于是|从此|结果/);
    expect(story.scene_breakdown[4].plot).toMatch(/花鼓戏|戏台|对唱/);
    expect(story.scene_breakdown[4].plot).toMatch(/民间传说|戏曲改编|版本/);
    expect(story.scene_breakdown.every(item => /传说|改编|影视化|虚构/.test(
      `${item.cultural_note} ${item.factual_basis} ${item.fictionalized_elements?.join(' ') ?? ''}`,
    ))).toBe(true);
    expect(story.full_text).not.toMatch(/恐惧、犹豫、勇气、信念|传说不灭，精神永存/);
  });

  it('keeps a user-provided Liu Hai legend adaptation while making its motif, choice cost, and transmission visible', () => {
    const entry: EntryDetail = {
      name: '刘海砍樵——人仙之恋的湖南民间传说',
      province: '湖南',
      region: '常德武陵；长沙',
      type: '民间故事',
      summary: '武陵樵夫刘海与狐仙胡大姐的民间传说，后经长沙花鼓戏改编传播。',
      story: '刘海在砍柴途中遇见胡大姐。胡大姐的狐仙身份揭露后，两人经历考验并战胜困难。',
      culturalSignificance: '传说表现勤劳善良与忠贞选择，并通过湖南花鼓戏广泛传播。',
      relatedLocations: [{ name: '常德武陵山林', description: '传说场景' }, { name: '长沙花鼓戏舞台', description: '传播场景' }],
      keywords: ['刘海砍樵', '胡大姐', '狐仙', '花鼓戏', '武陵', '人仙之恋'],
      sources: ['民间口述传说', '花鼓戏改编'],
      credibility: '待核实',
      unverifiedPoints: ['版本差异待核'],
    };
    const source = [
      '刘海在山路砍樵时遇见胡大姐，她用神异力量替他挡开危机，却没有立刻说明身份。',
      '乡邻的怀疑迫使两人分开；刘海决定相信一路看见的行动，回头寻找胡大姐。',
      '两人共同通过考验，歌声留在山路上；这是民间传说中的讲法。',
    ].join('\n\n');
    const story = generateDramaticContent({
      entry,
      centralEvent: '刘海砍樵与人仙相恋的考验',
      videoType: 'legend_story',
      presentationStyle: 'ink_style',
      targetDuration: '3分钟',
      tone: '温暖传奇',
      originalUserQuery: source,
      adaptationAnalysis: {
        source_mode: 'user_novel',
        source_length: source.length,
        source_summary: '刘海与胡大姐在人群压力中共同通过传说考验。',
        core_characters: ['刘海', '胡大姐', '乡邻'],
        plot_beats: source.split('\n\n'),
        must_keep: ['刘海', '胡大姐', '乡邻', '回头寻找', '民间传说'],
        compressible_parts: [],
        visual_setpieces: ['山路神异危机', '乡邻逼迫', '回头寻找'],
        adaptation_risks: ['不得把民间传说写成可考史实'],
      },
    });

    expect(story.full_text).toContain('刘海决定相信一路看见的行动，回头寻找胡大姐');
    expect(story.full_text).toContain('两人共同通过考验，歌声留在山路上');
    expect(story.scene_breakdown[1].plot).toMatch(/花篮|披帛|狐影/);
    expect(story.scene_breakdown[2].plot).toMatch(/乡邻/);
    expect(story.scene_breakdown[2].plot).toMatch(/放下|回头|选择/);
    expect(story.scene_breakdown[2].plot).toMatch(/风险|代价|排斥|分开/);
    expect(story.scene_breakdown[4].plot).toMatch(/花鼓戏|戏台|对唱/);
    expect(story.scene_breakdown[4].plot).toMatch(/流传|重讲|一代代/);
    expect(story.scene_breakdown.every(item => item.source_entries?.includes('用户提供改编素材'))).toBe(true);
  });
});
