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
        '拒签死刑文书：周敦颐任南安军司理参军时，发现疑案证据不足，囚犯依法不该死。知军催他签字，他拒绝草草画押。',
        '他对知军说："为上官杀人，以媚于人，吾不为也。"后来囚犯免死。',
        '父母爱之如子，为之命名，教之读书。',
      ].join('\n\n'),
      culturalSignificance: '周敦颐的选择体现公正、廉洁与良知。',
      relatedLocations: [{ name: '道县濂溪', description: '周敦颐相关地点' }],
      keywords: ['周敦颐', '南安军', '拒签', '案卷'],
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
    expect(story.characters.map(character => character.name)).toEqual(['周敦颐']);
  });
});
