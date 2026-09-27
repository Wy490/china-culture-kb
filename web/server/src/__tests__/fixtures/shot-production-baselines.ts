import type { EntryDetail, StoryGenerateResult, StoryScene } from '@shared/types.js';

export const entry: EntryDetail = {
  name: '了凡四训制作测试', province: '测试', region: '测试', type: '测试素材',
  summary: '用于代码验收的改过与助人素材，不授予事实信用。',
  story: '袁了凡停笔看向纸上的过失记录。次日他向被责备的人致歉。路上他看见车轮陷在泥里。他走上前托起车轮，让车继续前行。',
  culturalSignificance: '观察与行动', relatedLocations: [], keywords: ['纸', '车轮'],
  sources: ['合成测试'], credibility: '待核实', unverifiedPoints: [],
};

export function fidelityStory(): StoryGenerateResult {
  return {
    storyId: 's03-liaofan-fixture', title: '扶车动作测试', generation_type: 'scene_short',
    video_type: 'social_short', presentation_style: 'social_media_fastcut', source_entry: entry.name,
    logline: '保留遇阻、上前、扶车的先后动作。', theme: '助人', full_text: entry.story,
    scene_breakdown: [{
      scene_id: 1, title: '扶车', duration_sec: 37, location: '乡间道路', time_of_day: '白天',
      dramatic_function: '关键行动',
      plot: '车轮陷在泥中，老人拉住车把却推不动车。袁了凡看见阻碍，放下书袋向车走近。袁了凡弯腰托住车轮，把车推出泥坑后放开双手。',
      key_action: '袁了凡托起车轮并推出泥坑', characters: ['袁了凡', '老人'],
      visual_prompt: '乡间泥路、木车、古装人物。', camera_suggestion: '中景跟拍，车轮近景', cultural_note: '',
      dialogue_or_narration: '旁白：善意从看见开始。旁白：走近，才有下一步。旁白：扶起车轮，事情才发生改变。',
    }],
    gears_segments: [{
      segment_id: 1, source_scene_id: 1, duration_sec: 37, panel_count: 6,
      script_text: '整场文本：老人遇阻，袁了凡上前并扶车。', purpose: '助人', visual_focus: ['车轮'],
      cultural_constraints: [], video_type: 'social_short', presentation_style: 'social_media_fastcut',
    }], gears_segments_url: '', cultural_constraints: [], credibility_note: '合成代码测试',
    characters: [{ name: '袁了凡', role: 'protagonist', description: '中年古装男子', arc: '助人' },
      { name: '老人', role: 'supporting', description: '推车的老年男子', arc: '获助' }],
  };
}

export function productionBaselines(): StoryGenerateResult {
  const story = fidelityStory();
  const template = story.scene_breakdown[0];
  const rows = [
    ['书桌开场', '手持笔，纸在桌上', '笔已放下，视线落在纸上', '袁了凡停下书写，把手中的笔放到砚台旁，再低头望向纸上的记录。', '先看见自己的过失。'],
    ['改过动作', '面对被责备的人', '致歉后低头等待回应', '袁了凡向被责备的人致歉，低头等待回应。', '改过落在下一次行动里。'],
    ['扶车动作', '车轮陷在泥中', '发现受阻的老人', '袁了凡看见老人推车受阻。', '看见，是行动的起点。'],
    ['扶车动作', '袁了凡在车旁数步外', '袁了凡站在车轮旁', '袁了凡放下书袋，走向车轮。', '走近，才有下一步。'],
    ['扶车动作', '手放在受困车轮下', '车轮离开泥坑，双手松开', '袁了凡托起车轮，把车推出泥坑后放手。', '扶起车轮，事情才改变。'],
  ];
  story.scene_breakdown = [0, 1, 2].map((index): StoryScene => {
    const selected = index < 2 ? [rows[index]] : rows.slice(2);
    return { ...template, scene_id: index + 1, title: rows[index][0],
      location: index === 0 ? '书桌' : index === 1 ? '门前' : '乡间道路',
      duration_sec: (index < 2 ? 121 : 363) / 24,
      plot: selected.map(row => row[3]).join(''), key_action: selected.map(row => row[3]).join(''),
      dialogue_or_narration: selected.map(row => row[4]).join(''),
      production_beats: selected.map((row, beat) => ({ beat_id: `beat-${index + 1}-${beat + 1}`,
        start_state: row[1], end_state: row[2], visible_action: row[3], speech_text: row[4], required_actions: [row[3]] })),
    };
  });
  story.gears_segments = [];
  return story;
}
