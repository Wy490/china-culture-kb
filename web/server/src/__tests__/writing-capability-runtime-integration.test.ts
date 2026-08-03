import { describe, expect, it } from 'vitest';
import {
  WritingCapabilityRuntimeActivationV1Schema,
  WritingCapabilityRuntimeContextV1Schema,
  WritingCapabilityRuntimeResolutionV1Schema,
} from '@shared/schemas.js';
import type {
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import {
  prepareChinaCultureStoryGeneration,
} from '../domains/china-culture/story-generation-preparation-service.js';
import { buildChinaCultureGeneratedStoryDocument } from '../domains/china-culture/story-document-service.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';
import {
  CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
} from '../services/writing-capability-adapter-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
} from '../services/writing-capability-rollout-service.js';
import {
  CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
  buildWritingCapabilityRuntimeResolution,
} from '../services/writing-capability-runtime-service.js';
import { validateGenreStoryQuality } from '../services/genre-quality-service.js';
import { buildStoryRepairPromptPackage } from '../services/story-repair-service.js';
import { attachBlueprintScenes } from '../services/story-blueprint-service.js';
import type { StoryGenerationPromptPackage } from '../services/story-generation-prompt.js';

const CAPABILITY_ID = 'short_drama_develop_write_review';
const REQUEST: StoryGenerateRequest = {
  video_type: 'ai_comic_drama',
  presentation_style: 'ai_comic',
  creation_use_case: 'original_ai_comic',
  truth_mode: 'fictional_original',
  original_user_query: '少年发现古桥将被洪水冲毁，决定召集伙伴守桥。',
};

function runtimeOptions() {
  return {
    enabled: true as const,
    requestedCapabilityIds: [CAPABILITY_ID],
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
    runtimeActivation: CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
  };
}

function baseQuality(): StoryQualityReport {
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

function weakAiComicStory(): StoryGenerateResult {
  const scenes = [1, 2, 3, 4, 5].map(sceneId => ({
    scene_id: sceneId,
    title: `场景${sceneId}`,
    duration_sec: 20,
    location: '古桥',
    time_of_day: '雨夜',
    dramatic_function: ['钩子开场', '人物登场', '冲突爆发', '反转/觉醒', '高燃收束'][sceneId - 1],
    plot: '少年站在桥边想了想，众人看着他。',
    key_action: sceneId === 3 ? '走向桥头' : '',
    characters: ['少年'],
    visual_prompt: '雨夜古桥，少年近景表情',
    camera_suggestion: '近景',
    cultural_note: '虚构故事',
  }));
  return {
    storyId: 'runtime-story',
    title: '守桥',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    logline: '少年守桥。',
    theme: '担当',
    full_text: scenes.map(scene => scene.plot).join('\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '/api/stories/runtime-story/gears-segments',
    cultural_constraints: [],
    credibility_note: '虚构故事',
    story_structure: 'single_event_drama',
  };
}

function basePromptPackage(): StoryGenerationPromptPackage {
  return {
    prompt_version: 'story-generation/v1',
    system_prompt: 'system',
    user_prompt: 'user',
    context: {
      entry_name: '测试条目',
      entry_type: '测试类型',
      entry_region: '测试地区',
      entry_keywords: [],
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      story_structure: 'single_event_drama',
      target_duration: '1分钟',
      selected_event: '守桥',
      tone: '',
    },
    entry_summary: '测试摘要',
    entry_story: '测试故事',
    entry_cultural_significance: '测试意义',
    output_contract: {
      must_provide: [],
      should_respect: [],
      return_json_fields: [],
    },
  };
}

describe('writing capability runtime integration', () => {
  it('activates one exact internal candidate and maps profile rules without third-party execution', () => {
    const resolution = buildWritingCapabilityRuntimeResolution({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: [CAPABILITY_ID],
      activation: CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });

    expect(WritingCapabilityRuntimeActivationV1Schema.safeParse(
      CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
    ).success).toBe(true);
    expect(WritingCapabilityRuntimeResolutionV1Schema.safeParse(resolution).success).toBe(true);
    expect(resolution.status).toBe('active');
    expect(resolution.context && WritingCapabilityRuntimeContextV1Schema.safeParse(
      resolution.context,
    ).success).toBe(true);
    expect(resolution.context?.rules.blueprint_requirements[0].text)
      .toContain('本集目标、压力来源、角色策略、局部结果');
    expect(resolution.context?.rules.scene_rules).toHaveLength(2);
    expect(resolution.context?.rules.quality_rules).toHaveLength(2);
    expect(resolution.context?.rules.repair_guidance).toHaveLength(2);
    expect(resolution.context?.boundary).toMatchObject({
      affects_generation: true,
      affects_quality: true,
      affects_repair: true,
      third_party_code_executed: false,
    });
  });

  it('fails closed on candidate or identity drift and preserves the baseline path', () => {
    const drifted = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION);
    drifted.candidate.adapter_revision = 2;
    for (const sample of [
      { videoType: 'children_story' as const, activation: CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION },
      { videoType: 'ai_comic_drama' as const, activation: drifted },
    ]) {
      const resolution = buildWritingCapabilityRuntimeResolution({
        videoType: sample.videoType,
        requestedCapabilityIds: [CAPABILITY_ID],
        activation: sample.activation,
        adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
        rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
      });
      expect(resolution).toMatchObject({
        status: 'fallback',
        boundary: { baseline_preserved_on_fallback: true },
      });
      expect(resolution).not.toHaveProperty('context');
      expect(resolution.issues.length).toBeGreaterThan(0);
    }
  });

  it('accepts a schema-equivalent activation regardless of object property order', () => {
    const canonical = CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION;
    const reordered = {
      boundary: { ...canonical.boundary },
      candidate: Object.fromEntries(Object.entries(canonical.candidate).reverse()),
      status: canonical.status,
      activation_revision: canonical.activation_revision,
      activation_id: canonical.activation_id,
      schema_version: canonical.schema_version,
    };
    const resolution = buildWritingCapabilityRuntimeResolution({
      videoType: 'ai_comic_drama',
      requestedCapabilityIds: [CAPABILITY_ID],
      activation: reordered,
      adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
      rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    });

    expect(resolution.status).toBe('active');
  });

  it('keeps default preparation unchanged and injects active rules only on explicit opt-in', async () => {
    const baseline = await prepareChinaCultureStoryGeneration(REQUEST);
    const active = await prepareChinaCultureStoryGeneration(REQUEST, {
      writingCapability: runtimeOptions(),
    });
    expect(baseline.ok).toBe(true);
    expect(active.ok).toBe(true);
    if (!baseline.ok || !active.ok) return;

    expect(baseline).not.toHaveProperty('writingCapabilityRuntimeResolution');
    expect(baseline.preliminaryStoryBlueprint).not.toHaveProperty('writing_capability_context');
    expect(active.writingCapabilityRuntimeResolution).toBeDefined();
    if (!active.writingCapabilityRuntimeResolution) return;
    expect(active.writingCapabilityRuntimeResolution.status).toBe('active');
    expect(active.preliminaryStoryBlueprint.writing_capability_context?.status).toBe('active');
    expect(active.preliminaryStoryBlueprint.type_specific_requirements.join('\n'))
      .toContain('sd-blueprint-causal-spine');
    expect(active.preliminaryStoryBlueprint.type_specific_requirements.join('\n'))
      .toContain('每个节拍必须通过行动');
  });

  it('adds localized deterministic diagnostics and feeds failed checks into repair', async () => {
    const active = await prepareChinaCultureStoryGeneration(REQUEST, {
      writingCapability: runtimeOptions(),
    });
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    const story = weakAiComicStory();
    story.story_blueprint = active.preliminaryStoryBlueprint;
    const quality = validateGenreStoryQuality({
      story,
      baseReport: baseQuality(),
      blueprint: active.preliminaryStoryBlueprint,
    });

    expect(quality.writing_capability_quality).toMatchObject({
      schema_version: 'writing-capability-quality-report/v1',
      capability_id: CAPABILITY_ID,
      passed: false,
      boundary: {
        deterministic_machine_evaluation: true,
        evidence_localized: true,
        third_party_code_executed: false,
      },
    });
    expect(quality.writing_capability_quality?.checks.some(
      check => check.status === 'failed' && check.scene_ids.length > 0,
    )).toBe(true);
    expect(quality.repair_actions.join('\n')).toContain('写作能力局部修复');

    const repair = buildStoryRepairPromptPackage({
      basePackage: basePromptPackage(),
      story,
      qualityReport: quality,
      blueprint: active.preliminaryStoryBlueprint,
      strictness: 'balanced',
    });
    expect(repair.user_prompt).toContain('写作能力修复上下文');
    expect(repair.user_prompt).toContain(CAPABILITY_ID);
    expect(repair.user_prompt).toContain('scene_id=');
    expect(repair.output_contract.should_respect.join('\n'))
      .toContain('写作能力局部修复');
  });

  it('persists runtime provenance in the story, blueprint, and request metadata round trip', async () => {
    const active = await prepareChinaCultureStoryGeneration(REQUEST, {
      writingCapability: runtimeOptions(),
    });
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    const local = generateChinaCultureLocalStoryAssembly({
      entry: active.entry,
      centralEvent: active.centralEvent,
      videoType: active.videoType,
      presentationStyle: active.presentationStyle,
      storyStructure: active.storyStructure,
      targetDuration: active.targetDuration,
      tone: active.localTone,
      knowledgePack: active.knowledgePackToUse,
      originalUserQuery: REQUEST.original_user_query,
    });
    expect(local.ok).toBe(true);
    if (!local.ok) return;
    const finalBlueprint = attachBlueprintScenes(
      active.preliminaryStoryBlueprint,
      local.storyResult.scene_breakdown,
      'runtime-persisted-story',
    );
    const document = buildChinaCultureGeneratedStoryDocument({
      request: REQUEST,
      storyId: 'runtime-persisted-story',
      createdAt: '2026-08-02T18:30:00+08:00',
      preparation: active,
      storyResult: local.storyResult,
      finalStoryBlueprint: finalBlueprint,
      baseQualityReport: baseQuality(),
      adapterResult: {
        provider: 'local_only',
        output: null,
        used_fallback: false,
        execution_evidence: 'local_only',
      },
      generationMode: 'local_only',
      generationUsedFallback: false,
      referenceTrace: [],
      memoryMosaicSeed: undefined,
    });
    const roundTrip = JSON.parse(JSON.stringify(document)) as StoryGenerateResult & {
      _request_meta?: Record<string, unknown>;
    };

    expect(roundTrip.writing_capability_runtime).toEqual(
      roundTrip.story_blueprint?.writing_capability_context,
    );
    expect(roundTrip.writing_capability_runtime).toMatchObject({
      capability_id: CAPABILITY_ID,
      activation_revision: 1,
      profile_schema_version: 'writing-capability-profile/v1',
      source_commit: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.source_commit,
      adapter_revision: 1,
    });
    expect(roundTrip._request_meta?.writing_capability_runtime).toMatchObject({
      capability_id: CAPABILITY_ID,
      activation_revision: 1,
      adapter_revision: 1,
    });
  });
});
