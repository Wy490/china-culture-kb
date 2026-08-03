import { describe, expect, it } from 'vitest';
import type { StoryGenerateRequest, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { prepareChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-preparation-service.js';
import {
  CANONICAL_CONTINUITY_AI_COMIC_ADAPTER,
  CANONICAL_READER_SIMULATION_AI_COMIC_ADAPTER,
  preflightWritingCapabilityAdapter,
} from '../services/writing-capability-adapter-service.js';
import {
  CANONICAL_CONTINUITY_AI_COMIC_SHADOW_POLICY,
  CANONICAL_READER_SIMULATION_AI_COMIC_SHADOW_POLICY,
} from '../services/writing-capability-rollout-service.js';
import {
  CANONICAL_CONTINUITY_AI_COMIC_RUNTIME_ACTIVATION,
  CANONICAL_READER_SIMULATION_AI_COMIC_RUNTIME_ACTIVATION,
  buildWritingCapabilityRuntimeResolution,
} from '../services/writing-capability-runtime-service.js';
import { validateGenreStoryQuality } from '../services/genre-quality-service.js';
import { buildStoryRepairPromptPackage } from '../services/story-repair-service.js';
import type { StoryGenerationPromptPackage } from '../services/story-generation-prompt.js';

const REQUEST: StoryGenerateRequest = {
  video_type: 'ai_comic_drama', presentation_style: 'ai_comic',
  creation_use_case: 'original_ai_comic', truth_mode: 'fictional_original',
  original_user_query: '少年答应把钥匙交给守桥人，却在洪水中失去了钥匙。',
};

function baseQuality(): StoryQualityReport {
  return {
    hasCentralEvent: true, hasConflict: true, hasProtagonistChoice: true,
    hasSceneAction: true, hasClimax: true, hasEndingTheme: true,
    isNotBiographySummary: true, passed: true, issues: [],
  };
}

function makeStory(mode: 'continuity' | 'reader'): StoryGenerateResult {
  const continuityPlots = [
    '少年答应守桥人：天亮前一定把铜钥匙交到你手里。他把铜钥匙放进口袋。',
    '洪水冲来，铜钥匙落入江中，被急流冲走，已经彻底丢失。',
    '少年沿着桥面奔跑，四处寻找能够关闭水闸的办法。',
    '少年没有找回钥匙，却直接拿出同一把铜钥匙打开铁门。',
    '众人站在桥头望着天亮，没有人再提那句承诺。',
  ];
  const readerPlots = Array.from({ length: 5 }, (_, index) => (
    `在这个时代，这不仅是一座桥，更是一种精神。让我们看见文化的力量。第${index + 1}段。`
  ));
  const plots = mode === 'continuity' ? continuityPlots : readerPlots;
  const functions = ['钩子开场', '人物登场', '冲突爆发', '反转/觉醒', '高燃收束'];
  const scenes = plots.map((plot, index) => ({
    scene_id: index + 1,
    title: `第${index + 1}场`,
    duration_sec: 20,
    location: '古桥',
    time_of_day: '雨夜',
    dramatic_function: functions[index],
    plot,
    key_action: mode === 'continuity'
      ? ['把钥匙放进口袋', '钥匙落入江中', '沿桥寻找办法', '拿钥匙打开铁门', '站在桥头'][index]
      : '',
    characters: ['少年'],
    visual_prompt: '雨夜古桥，少年近景',
    camera_suggestion: '近景',
    cultural_note: '虚构故事',
  }));
  return {
    storyId: `${mode}-story`, title: '古桥钥匙', generation_type: 'character_story',
    video_type: 'ai_comic_drama', presentation_style: 'ai_comic', source_entry: '测试条目',
    logline: mode === 'continuity' ? '少年必须守住承诺。' : '一座桥的精神。',
    theme: '担当', full_text: plots.join('\n'), scene_breakdown: scenes,
    gears_segments: [], gears_segments_url: `/api/stories/${mode}-story/gears-segments`,
    cultural_constraints: [], credibility_note: '虚构故事', story_structure: 'single_event_drama',
  };
}

function basePrompt(): StoryGenerationPromptPackage {
  return {
    prompt_version: 'story-generation/v1',
    context: {
      entry_name: '测试条目', entry_type: '测试', entry_region: '测试', entry_keywords: [],
      video_type: 'ai_comic_drama', presentation_style: 'ai_comic',
      story_structure: 'single_event_drama', target_duration: '1分钟', tone: '',
    },
    entry_summary: '测试', entry_story: '测试', entry_cultural_significance: '测试',
    output_contract: { must_provide: [], should_respect: [], return_json_fields: [] },
    system_prompt: 'system', user_prompt: 'user',
  };
}

describe('continuity and machine reader writing capabilities', () => {
  it('preflights and activates both exact default-off candidates', () => {
    const candidates = [
      {
        capabilityId: 'continuity_state_tracking', adapter: CANONICAL_CONTINUITY_AI_COMIC_ADAPTER,
        policy: CANONICAL_CONTINUITY_AI_COMIC_SHADOW_POLICY,
        activation: CANONICAL_CONTINUITY_AI_COMIC_RUNTIME_ACTIVATION, ruleCount: 8,
      },
      {
        capabilityId: 'reader_simulation_review', adapter: CANONICAL_READER_SIMULATION_AI_COMIC_ADAPTER,
        policy: CANONICAL_READER_SIMULATION_AI_COMIC_SHADOW_POLICY,
        activation: CANONICAL_READER_SIMULATION_AI_COMIC_RUNTIME_ACTIVATION, ruleCount: 6,
      },
    ];
    for (const candidate of candidates) {
      expect(preflightWritingCapabilityAdapter({
        adapter: candidate.adapter, rolloutPolicy: candidate.policy,
      }).status).toBe('passed');
      const resolution = buildWritingCapabilityRuntimeResolution({
        videoType: 'ai_comic_drama', requestedCapabilityIds: [candidate.capabilityId],
        activation: candidate.activation, adapter: candidate.adapter,
        rolloutPolicy: candidate.policy,
      });
      expect(resolution.status).toBe('active');
      expect(resolution.context?.capability_id).toBe(candidate.capabilityId);
      expect(Object.values(resolution.context?.rules ?? {})
        .reduce((count, rules) => count + rules.length, 0)).toBe(candidate.ruleCount);
      expect(buildWritingCapabilityRuntimeResolution({
        videoType: 'character_story', requestedCapabilityIds: [candidate.capabilityId],
        activation: candidate.activation, adapter: candidate.adapter,
        rolloutPolicy: candidate.policy,
      }).status).toBe('fallback');
    }
  });

  it('builds a localized continuity ledger and detects open promises and impossible object state', async () => {
    const preparation = await prepareChinaCultureStoryGeneration(REQUEST, {
      writingCapability: {
        enabled: true, requestedCapabilityIds: ['continuity_state_tracking'],
        rolloutPolicy: CANONICAL_CONTINUITY_AI_COMIC_SHADOW_POLICY,
        adapter: CANONICAL_CONTINUITY_AI_COMIC_ADAPTER,
        runtimeActivation: CANONICAL_CONTINUITY_AI_COMIC_RUNTIME_ACTIVATION,
      },
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) return;
    const story = makeStory('continuity');
    story.story_blueprint = preparation.preliminaryStoryBlueprint;
    const quality = validateGenreStoryQuality({
      story, baseReport: baseQuality(), blueprint: preparation.preliminaryStoryBlueprint,
    });
    const capability = quality.writing_capability_quality;

    expect(capability?.evaluation_kind).toBe('continuity_state_tracking');
    expect(capability?.continuity_ledger?.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '铜钥匙', conflict_scene_ids: [2, 4] }),
    ]));
    expect(capability?.continuity_ledger?.promises).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'open', setup_scene_id: 1 }),
    ]));
    expect(capability?.failed_check_ids).toEqual(expect.arrayContaining([
      'ct-runtime-object-state', 'ct-runtime-open-promise',
    ]));
    expect(quality.repair_actions.join('\n')).toContain('scene_id=2、4');
  });

  it('reports machine reader experience without claiming human feedback and routes it into repair', async () => {
    const preparation = await prepareChinaCultureStoryGeneration(REQUEST, {
      writingCapability: {
        enabled: true, requestedCapabilityIds: ['reader_simulation_review'],
        rolloutPolicy: CANONICAL_READER_SIMULATION_AI_COMIC_SHADOW_POLICY,
        adapter: CANONICAL_READER_SIMULATION_AI_COMIC_ADAPTER,
        runtimeActivation: CANONICAL_READER_SIMULATION_AI_COMIC_RUNTIME_ACTIVATION,
      },
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) return;
    const story = makeStory('reader');
    story.story_blueprint = preparation.preliminaryStoryBlueprint;
    const quality = validateGenreStoryQuality({
      story, baseReport: baseQuality(), blueprint: preparation.preliminaryStoryBlueprint,
    });
    const capability = quality.writing_capability_quality;

    expect(capability).toMatchObject({
      evaluation_kind: 'machine_reader_simulation',
      passed: false,
      boundary: { human_feedback_claimed: false },
    });
    expect(capability?.failed_check_ids).toEqual(expect.arrayContaining([
      'rs-runtime-template-language', 'rs-runtime-emotional-progression',
    ]));
    expect(capability?.checks.filter(check => check.status === 'failed')
      .every(check => check.scene_ids.length > 0)).toBe(true);

    const repair = buildStoryRepairPromptPackage({
      basePackage: basePrompt(), story, qualityReport: quality,
      blueprint: preparation.preliminaryStoryBlueprint, strictness: 'balanced',
    });
    expect(repair.user_prompt).toContain('机器读者模拟，不是真人反馈');
    expect(repair.output_contract.should_respect.join('\n')).toContain('写作能力局部修复');
  });
});
