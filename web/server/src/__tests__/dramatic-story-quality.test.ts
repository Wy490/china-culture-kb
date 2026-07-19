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
});
