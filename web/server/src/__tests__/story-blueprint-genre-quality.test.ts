import { describe, expect, it } from 'vitest';
import type { EntryDetail, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { buildStoryBlueprint, attachBlueprintScenes } from '../services/story-blueprint-service.js';
import { validateGenreStoryQuality } from '../services/genre-quality-service.js';

function makeEntry(): EntryDetail {
  return {
    name: '周敦颐——理学开山鼻祖',
    province: '湖南',
    region: '永州→道县',
    type: '历史人物',
    summary: '周敦颐为北宋理学重要人物。',
    story: '周敦颐在月岩洞中思考学问与人生选择。',
    culturalSignificance: '濂溪学脉影响后世。',
    relatedLocations: [{ name: '月岩洞', description: '道县天然岩洞' }],
    keywords: ['周敦颐', '北宋', '月岩洞', '理学'],
    sources: ['测试来源'],
    credibility: '基本可靠',
    verificationMethod: '测试核验',
    unverifiedPoints: ['月岩悟道为民间传说'],
  };
}

function makeBaseReport(): StoryQualityReport {
  return {
    hasCentralEvent: true,
    hasConflict: true,
    hasProtagonistChoice: true,
    hasSceneAction: true,
    hasClimax: true,
    hasEndingTheme: true,
    isNotBiographySummary: true,
    passed: true,
    issues: [],
  };
}

function makeStory(): StoryGenerateResult {
  const scenes = [
    {
      scene_id: 1,
      title: '钩子开场',
      duration_sec: 30,
      location: '月岩洞',
      time_of_day: '清晨',
      dramatic_function: '钩子开场',
      plot: '周敦颐在洞口停步，面对世俗功名与内心追问，意识到真正的选择已经到来。',
      key_action: '提出追问',
      characters: ['周敦颐'],
      visual_prompt: '月岩洞晨光与书卷',
      camera_suggestion: '近景',
      cultural_note: '保留传说边界',
      conflict: '功名与学问追求之间的冲突',
    },
    {
      scene_id: 2,
      title: '主角处境',
      duration_sec: 30,
      location: '月岩洞',
      time_of_day: '白天',
      dramatic_function: '主角处境',
      plot: '他回望仕途与乡土，知道每一步选择都会留下代价。',
      key_action: '衡量代价',
      characters: ['周敦颐'],
      visual_prompt: '书卷与洞壁',
      camera_suggestion: '中景',
      cultural_note: '创作性场景调度',
    },
    {
      scene_id: 3,
      title: '高潮',
      duration_sec: 30,
      location: '月岩洞',
      time_of_day: '黄昏',
      dramatic_function: '高潮',
      plot: '周敦颐最终选择坚守学问与良知，让个人追问落到精神传承之中。',
      key_action: '做出选择',
      characters: ['周敦颐'],
      visual_prompt: '黄昏光线与洞口远景',
      camera_suggestion: '特写',
      cultural_note: '精神落点',
    },
  ];

  return {
    storyId: 'story-test',
    title: '月岩洞前的选择',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '周敦颐在月岩洞前面对学问与功名的选择。',
    theme: '人物选择与精神传承',
    full_text: scenes.map(scene => scene.plot).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '/api/stories/story-test/gears-segments',
    cultural_constraints: [],
    credibility_note: '基本可靠',
    story_structure: 'single_event_drama',
    characters: [{ name: '周敦颐', role: 'protagonist', description: '北宋士人' }],
    protagonist_arc: [{ starting_state: '追问', turning_point: '选择', resolution: '精神落点' }],
  };
}

describe('story blueprint and genre quality', () => {
  it('builds and attaches scene-aware genre beats', () => {
    const entry = makeEntry();
    const story = makeStory();
    const blueprint = buildStoryBlueprint({
      entry,
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      centralEvent: '月岩悟道',
    });
    const attached = attachBlueprintScenes(blueprint, story.scene_breakdown, story.storyId);

    expect(attached.schema_version).toBe('story-blueprint/v1');
    expect(attached.storyId).toBe('story-test');
    expect(attached.genre_beats[0].scene_id).toBe(1);
    expect(attached.genre_beats[0].function_label).toBe('钩子开场');
    expect(attached.evidence_boundaries.map(item => item.boundary_id)).toContain('unverified-points');
  });

  it('adds genre quality fields to the base quality report', () => {
    const entry = makeEntry();
    const story = makeStory();
    const blueprint = attachBlueprintScenes(
      buildStoryBlueprint({
        entry,
        videoType: 'character_story',
        presentationStyle: 'cinematic',
        storyStructure: 'single_event_drama',
        targetDuration: '1分钟',
        centralEvent: '月岩悟道',
      }),
      story.scene_breakdown,
      story.storyId,
    );

    const report = validateGenreStoryQuality({
      story,
      baseReport: makeBaseReport(),
      blueprint,
    });

    expect(report.video_type).toBe('character_story');
    expect(report.genre_score).toBeGreaterThanOrEqual(70);
    expect(report.missing_required_elements).toEqual([]);
    expect(report.repair_actions).toContain('补强主角当下目标');
  });
});
