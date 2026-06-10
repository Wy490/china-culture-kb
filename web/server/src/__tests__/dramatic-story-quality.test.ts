import { describe, expect, it } from 'vitest';
import { validateDramaticStory } from '../services/dramatic-story.js';
import type { StoryScene } from '@shared/types.js';

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
});
