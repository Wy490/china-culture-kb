import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  EntryDetail,
  MemoryMosaicStorySeed,
  StoryGenerateRequest,
} from '@shared/types.js';
import {
  createBenchmarkCard,
  createFilmReferenceAnalysis,
  createReferenceSource,
  createReferenceSimilarityEvidence,
  createReferenceStylePack,
} from '../services/reference-library-service.js';
import {
  buildReferenceGenerationTrace,
  resolveReferenceGenerationContext,
} from '../services/reference-generation-bridge-service.js';
import {
  evaluateReferenceGenerationSafety,
} from '../services/reference-quality-service.js';
import { buildStoryGenerationPromptPackage } from '../services/story-generation-prompt.js';
import { prepareChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-preparation-service.js';
import { executeChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-execution-service.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';
import { generateAndStoreChinaCultureStory } from '../domains/china-culture/story-generation-service.js';
import {
  buildStoryGenerationRecordReplayFixture,
} from '../services/story-generation-model.js';
import type { StoryGenerationModelOutput } from '../services/story-generation-prompt.js';

const temporaryRoots: string[] = [];
const approvedAt = '2026-07-24T14:00:00.000Z';
const originalEnv = {
  KB_ROOT: process.env.KB_ROOT,
  REFERENCE_LIBRARY_REPO_ROOT: process.env.REFERENCE_LIBRARY_REPO_ROOT,
  STORY_GEN_PROVIDER: process.env.STORY_GEN_PROVIDER,
  STORY_GEN_COMMAND: process.env.STORY_GEN_COMMAND,
  STORY_GEN_COMMAND_ARGS: process.env.STORY_GEN_COMMAND_ARGS,
  STORY_GEN_EXECUTION_EVIDENCE: process.env.STORY_GEN_EXECUTION_EVIDENCE,
  STORY_GEN_RECORD_REPLAY_FIXTURE_PATH:
    process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH,
  WEB_GENERATED_ROOT: process.env.WEB_GENERATED_ROOT,
};

afterEach(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await Promise.all(
    temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  );
});

function entry(): EntryDetail {
  return {
    name: '周敦颐——理学开山鼻祖',
    province: '湖南',
    region: '永州→道县',
    type: '历史人物',
    summary: '周敦颐为北宋理学重要人物。',
    story: '周敦颐面对冤案拒绝署名，并以辞官相争。',
    culturalSignificance: '濂溪学脉影响后世。',
    relatedLocations: [],
    keywords: ['周敦颐', '廉洁'],
    sources: ['测试来源'],
    credibility: '已核实',
    verificationMethod: '测试核验',
    unverifiedPoints: [],
  };
}

type SuccessfulPreparation = Extract<
  Awaited<ReturnType<typeof prepareChinaCultureStoryGeneration>>,
  { ok: true }
>;

async function installRecordReplayFixture(input: {
  request: StoryGenerateRequest;
  preparation: SuccessfulPreparation;
  output: StoryGenerationModelOutput;
  memoryMosaicSeed?: MemoryMosaicStorySeed;
}): Promise<void> {
  const prompt = buildStoryGenerationPromptPackage({
    entry: input.preparation.entry,
    request: {
      ...input.request,
      narrative_pattern_ids: input.preparation.narrativePatternIds,
    },
    videoType: input.preparation.videoType,
    presentationStyle: input.preparation.presentationStyle,
    storyStructure: input.preparation.storyStructure,
    targetDuration: input.preparation.targetDuration,
    tone: input.preparation.toneWithPriority,
    selectedEvent: input.preparation.centralEvent,
    knowledgePack: input.preparation.knowledgePackToUse,
    materialPack: input.preparation.materialPackToUse,
    materialSufficiency: input.preparation.materialSufficiency,
    productionMaterialPack: input.preparation.productionMaterialPack,
    productionMaterialReadiness: input.preparation.productionMaterialReadiness,
    creationContract: input.preparation.creationContract,
    genreMatrix: input.preparation.genreMatrix,
    memoryMosaicSeed: input.memoryMosaicSeed,
    storyBlueprint: input.preparation.preliminaryStoryBlueprint,
    adaptationAnalysis: input.preparation.adaptationAnalysis,
    referenceGenerationRecipe: input.preparation.referenceGenerationRecipe,
    referenceGenerationContext: input.preparation.referenceGenerationContext,
  });
  const fixture = buildStoryGenerationRecordReplayFixture({
    pkg: prompt,
    modelProfileId: input.preparation.selectedModelProfile.id,
    output: input.output,
    recordedAt: '2026-08-21T00:00:00.000Z',
    provenance: {
      source: 'offline_fixture',
      external_model_call_recorded: false,
    },
  });
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-replay-'));
  temporaryRoots.push(fixtureRoot);
  const fixturePath = path.join(fixtureRoot, 'fixture.json');
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  process.env.STORY_GEN_PROVIDER = 'record_replay_json';
  process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH = fixturePath;
}

async function createApprovedStylePack(
  repoRoot: string,
  sourceMode: 'research_only' | 'user_owned' = 'research_only',
) {
  const analyses = [];
  for (const suffix of ['a', 'b']) {
    const source = await createReferenceSource({
      repoRoot,
      now: approvedAt,
      request: {
        title: `参考样本 ${suffix}`,
        media_type: 'film',
        source_url: `https://example.com/reference-${suffix}`,
        accessed_at: approvedAt,
        rights_status: sourceMode,
        access_scope: sourceMode === 'user_owned'
          ? 'full_user_supplied'
          : 'metadata_only',
        ...(sourceMode === 'user_owned'
          ? { content_fingerprint: suffix.repeat(64) }
          : {}),
        user_reason: '研究抽象结构原则',
      },
    });
    analyses.push(await createFilmReferenceAnalysis({
      repoRoot,
      referenceId: source.reference_id,
      now: approvedAt,
      request: {
        analyzed_by: `researcher-${suffix}`,
        analysis: {
          sequence_beats: [{
            start: '00:00:00',
            end: '00:00:10',
            function: `用可见行动建立承诺 ${suffix}`,
          }],
          shot_observations: [{
            timecode: '00:00:05',
            evidence_note: `先动作后解释 ${suffix}`,
          }],
          continuity_methods: [`连续性锚点 ${suffix}`],
          reusable_principles: [`抽象原则 ${suffix}`],
          avoid_copying: [`不得复制具体角色和镜头顺序 ${suffix}`],
        },
        approval: {
          approved_by: `editor-${suffix}`,
          approved_at: approvedAt,
        },
      },
    }));
  }
  const benchmark = await createBenchmarkCard({
    repoRoot,
    now: approvedAt,
    request: {
      analysis_ids: analyses.map(item => item.analysis_id),
      target_video_type: 'character_story',
      target_dimension: 'scene',
      principle: '用不可撤回的可见行动表现人物选择',
      evidence_refs: analyses.map(item => item.analysis_id),
      created_by: 'benchmark-editor',
      approval: {
        approved_by: 'chief-editor',
        approved_at: approvedAt,
      },
    },
  });
  return createReferenceStylePack({
    repoRoot,
    now: approvedAt,
    request: {
      name: '人物选择可见化',
      description: '只复用已批准参考的抽象场景原则。',
      benchmark_card_ids: [benchmark.benchmark_id],
      compatible_video_types: ['character_story'],
      compatible_presentation_styles: ['cinematic'],
      compatible_story_structures: ['single_event_drama'],
      created_by: 'style-editor',
      approval: {
        approved_by: 'chief-editor',
        approved_at: approvedAt,
      },
    },
  });
}

describe('Reference Generation Bridge', () => {
  it('injects only approved compatible abstract rules and emits complete provenance', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-'));
    temporaryRoots.push(repoRoot);
    const stylePack = await createApprovedStylePack(repoRoot);

    const resolution = await resolveReferenceGenerationContext({
      repoRoot,
      stylePackIds: [stylePack.id],
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    if (!resolution.context) throw new Error('Expected resolved reference context');
    expect(resolution.context).toMatchObject({
      schema_version: 'reference-generation-context/v1',
      style_pack_ids: [stylePack.id],
      reusable_principles: ['用不可撤回的可见行动表现人物选择'],
      source_references: [
        expect.objectContaining({
          reference_id: stylePack.source_reference_ids[0],
          rights_status: 'research_only',
          access_scope: 'metadata_only',
        }),
        expect.objectContaining({
          reference_id: stylePack.source_reference_ids[1],
          rights_status: 'research_only',
          access_scope: 'metadata_only',
        }),
      ],
    });
    expect(resolution.context.avoid_copying).toEqual(expect.arrayContaining([
      '不得复制具体角色和镜头顺序 a',
      '不得复制具体角色和镜头顺序 b',
    ]));

    const prompt = buildStoryGenerationPromptPackage({
      entry: entry(),
      request: {
        entry_name: entry().name,
        video_type: 'character_story',
        style_pack_ids: [stylePack.id],
      },
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '',
      selectedEvent: '拒签冤案',
      referenceGenerationContext: resolution.context,
    });

    expect(prompt.reference_style_context?.style_pack_ids).toEqual([stylePack.id]);
    expect(prompt.system_prompt).toContain('只应用已批准参考中的抽象原则');
    expect(prompt.user_prompt).toContain('=== 已批准参考风格包 ===');
    expect(prompt.user_prompt).toContain('用不可撤回的可见行动表现人物选择');
    expect(prompt.user_prompt).toContain('不得复制具体角色和镜头顺序 a');
    expect(prompt.user_prompt).not.toContain('https://example.com/reference-a');
    expect(prompt.output_contract.should_respect).toContain(
      '参考原则：用不可撤回的可见行动表现人物选择',
    );

    const trace = buildReferenceGenerationTrace({
      context: resolution.context,
      storyStructure: 'single_event_drama',
      applicationStatus: 'external_prompt_injected',
    });
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      style_pack_id: stylePack.id,
      application_status: 'external_prompt_injected',
      source_reference_ids: stylePack.source_reference_ids,
      source_analysis_ids: stylePack.source_analysis_ids,
      source_benchmark_ids: stylePack.source_benchmark_ids,
      applied_rules: ['用不可撤回的可见行动表现人物选择'],
    });
    expect(trace[0].source_references).toEqual(
      resolution.context.source_references,
    );

    const safety = evaluateReferenceGenerationSafety({
      generated_text: '周敦颐拒绝在疑案判词上署名，并承担辞官后果。',
      reference_trace: trace,
      reference_strength: 'medium',
    });
    expect(safety).toMatchObject({
      schema_version: 'story-reference-generation-safety/v1',
      status: 'passed_with_limits',
      passed: true,
      style_pack_ids: [stylePack.id],
      application: {
        applied_to_generation: true,
        statuses: ['external_prompt_injected'],
      },
      checks: {
        provenance_complete: true,
        avoid_copying_constraints_present: true,
        unauthorized_adaptation_claim_absent: true,
        forbidden_imitation_language_absent: true,
      },
      similarity: {
        status: 'not_run_no_authorized_source_material',
        exact_long_sentence: { status: 'not_run', match_count: null },
        near_character_overlap: { status: 'not_run', match_count: null },
        character_design: { status: 'not_run', match_count: null },
        plot_structure: { status: 'not_run', match_count: null },
        shot_sequence: { status: 'not_run', match_count: null },
        similarity_pass_credit_granted: false,
      },
      machine_validation_only: true,
      human_review_complete: false,
      real_similarity_check_completed: false,
      real_credit_granted: false,
    });

    const copied = evaluateReferenceGenerationSafety({
      generated_text: '风吹过空院，他终于摊开案卷，拒绝在未核清的判词上落笔。',
      reference_trace: trace,
      reference_strength: 'medium',
      reference_original_sentences: [
        '他终于摊开案卷，拒绝在未核清的判词上落笔。',
      ],
    });
    expect(copied).toMatchObject({
      status: 'blocked',
      passed: false,
      similarity: {
        status: 'partially_completed',
        exact_long_sentence: { status: 'completed', match_count: 1 },
        near_character_overlap: { status: 'completed', match_count: 0 },
        character_design: { status: 'not_run', match_count: null },
        plot_structure: { status: 'not_run', match_count: null },
        shot_sequence: { status: 'not_run', match_count: null },
        similarity_pass_credit_granted: false,
      },
      issues: [
        expect.objectContaining({
          issue_code: 'exact_long_sentence_match',
        }),
      ],
      real_similarity_check_completed: false,
    });

    const missingTrace = evaluateReferenceGenerationSafety({
      generated_text: '这是最终生成文本。',
      reference_trace: [],
      expected_style_pack_ids: [stylePack.id],
    });
    expect(missingTrace).toMatchObject({
      status: 'blocked',
      passed: false,
      style_pack_ids: [stylePack.id],
      checks: { provenance_complete: false },
      issues: [
        expect.objectContaining({
          issue_code: 'reference_provenance_incomplete',
        }),
      ],
    });
  });

  it('fails closed when an approved pack is incompatible with the requested story shape', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-'));
    temporaryRoots.push(repoRoot);
    const stylePack = await createApprovedStylePack(repoRoot);

    const resolution = await resolveReferenceGenerationContext({
      repoRoot,
      stylePackIds: [stylePack.id],
      videoType: 'documentary_short',
      presentationStyle: 'documentary',
      storyStructure: 'witness_testimony',
    });

    expect(resolution).toMatchObject({
      ok: false,
      details: {
        schema_version: 'story-reference-style-pack-gate/v1',
        status: 'blocked',
        issue_code: 'incompatible_style_pack',
        style_pack_id: stylePack.id,
      },
    });
  });

  it('binds authorized similarity evidence by hash without exposing observations to the model prompt', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-'));
    temporaryRoots.push(repoRoot);
    const stylePack = await createApprovedStylePack(repoRoot, 'user_owned');
    const evidence = await createReferenceSimilarityEvidence({
      repoRoot,
      referenceId: stylePack.source_reference_ids[0],
      now: approvedAt,
      request: {
        source_content_fingerprint: 'a'.repeat(64),
        input_provenance: 'fixture',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'fixture-authorization-not-real-credit',
          attested_by: 'fixture',
          attested_at: approvedAt,
          confirmation: 'authorized_similarity_analysis_only',
        },
        observations: {
          excerpts: [{
            observation_id: 'excerpt-a',
            source_locator: 'scene-1',
            text: '这是一段只允许进入安全检查而不能进入模型提示词的授权观察文本。',
          }],
          character_profiles: [],
          plot_beats: [],
          shot_sequence: [],
        },
      },
    });

    const resolution = await resolveReferenceGenerationContext({
      repoRoot,
      stylePackIds: [stylePack.id],
      similarityEvidenceIds: [evidence.evidence_id],
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok || !resolution.context) return;
    expect(resolution.similarityEvidence).toEqual([evidence]);
    expect(resolution.context.similarity_evidence_refs).toEqual([{
      evidence_id: evidence.evidence_id,
      reference_id: evidence.reference_id,
      payload_sha256: evidence.payload_sha256,
      input_provenance: 'fixture',
      dimensions: ['excerpt'],
    }]);

    const prompt = buildStoryGenerationPromptPackage({
      entry: entry(),
      request: {
        entry_name: entry().name,
        video_type: 'character_story',
        style_pack_ids: [stylePack.id],
        reference_similarity_evidence_ids: [evidence.evidence_id],
      },
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '1分钟',
      tone: '',
      selectedEvent: '拒签冤案',
      referenceGenerationContext: resolution.context,
    });
    const serializedPrompt = JSON.stringify(prompt);
    expect(serializedPrompt).toContain(evidence.evidence_id);
    expect(serializedPrompt).not.toContain(
      '这是一段只允许进入安全检查而不能进入模型提示词的授权观察文本',
    );

    const trace = buildReferenceGenerationTrace({
      context: resolution.context,
      storyStructure: 'single_event_drama',
      applicationStatus: 'external_prompt_injected',
    });
    expect(trace[0].similarity_evidence_refs).toEqual(
      resolution.context.similarity_evidence_refs,
    );
  });

  it('revalidates approved provenance at generation time and fails closed on drift', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-'));
    temporaryRoots.push(repoRoot);
    const stylePack = await createApprovedStylePack(repoRoot);
    await rm(path.join(
      repoRoot,
      'references',
      'creative',
      'library',
      'analyses',
      `${stylePack.source_analysis_ids[0]}.json`,
    ));

    const resolution = await resolveReferenceGenerationContext({
      repoRoot,
      stylePackIds: [stylePack.id],
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
    });

    expect(resolution).toMatchObject({
      ok: false,
      details: {
        schema_version: 'story-reference-style-pack-gate/v1',
        status: 'blocked',
        issue_code: 'style_pack_provenance_invalid',
        style_pack_id: stylePack.id,
      },
    });
  });

  it('threads approved context through canonical execution without claiming local application', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-'));
    temporaryRoots.push(repoRoot);
    const stylePack = await createApprovedStylePack(repoRoot);
    process.env.REFERENCE_LIBRARY_REPO_ROOT = repoRoot;
    process.env.KB_ROOT = path.resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'data',
    );

    const request = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story' as const,
      presentation_style: 'cinematic' as const,
      story_structure: 'single_event_drama' as const,
      style_pack_ids: [stylePack.id],
    };
    const preparation = await prepareChinaCultureStoryGeneration(request);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) return;
    expect(preparation.referenceGenerationContext?.style_pack_ids).toEqual([
      stylePack.id,
    ]);

    const execution = await executeChinaCultureStoryGeneration({
      request,
      preparation,
    });
    expect(execution.ok).toBe(true);
    if (!execution.ok) return;
    expect(execution.promptPackage.reference_style_context?.style_pack_ids).toEqual([
      stylePack.id,
    ]);
    expect(execution.referenceTrace).toEqual([
      expect.objectContaining({
        style_pack_id: stylePack.id,
        application_status: 'local_engine_not_applied',
        applied_rules: [],
        requested_rules: ['用不可撤回的可见行动表现人物选择'],
      }),
    ]);
  });

  it('returns a structured pre-generation gate for an unknown style pack', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-'));
    temporaryRoots.push(repoRoot);
    process.env.REFERENCE_LIBRARY_REPO_ROOT = repoRoot;
    process.env.KB_ROOT = path.resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'data',
    );

    const preparation = await prepareChinaCultureStoryGeneration({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      story_structure: 'single_event_drama',
      style_pack_ids: ['reference-style-pack-deadbeef'],
    });

    expect(preparation).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
      details: {
        schema_version: 'story-reference-style-pack-gate/v1',
        status: 'blocked',
        issue_code: 'style_pack_unavailable',
        style_pack_id: 'reference-style-pack-deadbeef',
      },
    });
  });

  it('marks approved rules as prompt-injected on the external adapter path', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-'));
    temporaryRoots.push(repoRoot);
    const stylePack = await createApprovedStylePack(repoRoot);
    process.env.REFERENCE_LIBRARY_REPO_ROOT = repoRoot;
    process.env.KB_ROOT = path.resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'data',
    );
    const request = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story' as const,
      presentation_style: 'cinematic' as const,
      story_structure: 'single_event_drama' as const,
      model_profile_id: 'claude_sonnet',
      generation_fallback_policy: 'forbid_local_fallback' as const,
      style_pack_ids: [stylePack.id],
      auto_repair: false,
    };
    const preparation = await prepareChinaCultureStoryGeneration(request);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) return;
    const local = generateChinaCultureLocalStoryAssembly({
      entry: preparation.entry,
      centralEvent: preparation.centralEvent,
      videoType: preparation.videoType,
      presentationStyle: preparation.presentationStyle,
      storyStructure: preparation.storyStructure,
      targetDuration: preparation.targetDuration,
      tone: preparation.localTone,
      knowledgePack: preparation.knowledgePackToUse,
    });
    expect(local.ok).toBe(true);
    if (!local.ok) return;

    await installRecordReplayFixture({
      request,
      preparation,
      memoryMosaicSeed: local.memoryMosaicSeed,
      output: {
        title: local.storyResult.title,
        logline: local.storyResult.logline,
        theme: local.storyResult.theme,
        full_text: local.storyResult.full_text,
        scene_breakdown: local.storyResult.scene_breakdown,
        cultural_constraints: local.storyResult.cultural_constraints,
        credibility_note: local.storyResult.credibility_note,
      },
    });

    const execution = await executeChinaCultureStoryGeneration({
      request,
      preparation,
    });
    expect(execution.ok).toBe(true);
    if (!execution.ok) return;
    expect(execution.generationMode).toBe('external_model');
    expect(execution.adapterResult.execution_evidence).toBe(
      'record_replay_fixture',
    );
    expect(execution.referenceTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        style_pack_id: stylePack.id,
        application_status: 'external_prompt_injected',
        applied_rules: ['用不可撤回的可见行动表现人物选择'],
        source_reference_ids: stylePack.source_reference_ids,
        source_analysis_ids: stylePack.source_analysis_ids,
        source_benchmark_ids: stylePack.source_benchmark_ids,
      }),
    ]));
  });

  it('blocks an unsafe consumer-finalized referenced story before persistence', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-'));
    const generatedRoot = await mkdtemp(path.join(os.tmpdir(), 'reference-generation-output-'));
    temporaryRoots.push(repoRoot, generatedRoot);
    const stylePack = await createApprovedStylePack(repoRoot);
    process.env.REFERENCE_LIBRARY_REPO_ROOT = repoRoot;
    process.env.WEB_GENERATED_ROOT = generatedRoot;
    process.env.KB_ROOT = path.resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'data',
    );
    const request = {
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story' as const,
      presentation_style: 'cinematic' as const,
      story_structure: 'single_event_drama' as const,
      model_profile_id: 'claude_sonnet',
      generation_fallback_policy: 'forbid_local_fallback' as const,
      style_pack_ids: [stylePack.id],
      auto_repair: false,
    };
    const preparation = await prepareChinaCultureStoryGeneration(request);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) return;
    const local = generateChinaCultureLocalStoryAssembly({
      entry: preparation.entry,
      centralEvent: preparation.centralEvent,
      videoType: preparation.videoType,
      presentationStyle: preparation.presentationStyle,
      storyStructure: preparation.storyStructure,
      targetDuration: preparation.targetDuration,
      tone: preparation.localTone,
      knowledgePack: preparation.knowledgePackToUse,
    });
    expect(local.ok).toBe(true);
    if (!local.ok) return;

    await installRecordReplayFixture({
      request,
      preparation,
      memoryMosaicSeed: local.memoryMosaicSeed,
      output: {
        title: local.storyResult.title,
        logline: local.storyResult.logline,
        theme: local.storyResult.theme,
        full_text: local.storyResult.full_text,
        scene_breakdown: local.storyResult.scene_breakdown,
        cultural_constraints: local.storyResult.cultural_constraints,
        credibility_note: local.storyResult.credibility_note,
      },
    });

    const result = await generateAndStoreChinaCultureStory(request, {
      transform_story_before_validation_and_persistence: story => ({
        ...story,
        full_text: `${story.full_text}\n本故事改编自某部著名电影。`,
        reference_trace: [],
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: 'REFERENCE_SAFETY_VALIDATION_FAILED',
      details: {
        schema_version: 'story-reference-generation-safety/v1',
        status: 'blocked',
        passed: false,
        issues: [
          expect.objectContaining({
            issue_code: 'unauthorized_adaptation_claim',
          }),
        ],
        machine_validation_only: true,
        human_review_complete: false,
        real_credit_granted: false,
      },
    });
    await expect(
      import('node:fs/promises').then(({ readdir }) =>
        readdir(path.join(generatedRoot, 'stories'))),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      import('node:fs/promises').then(({ readdir }) =>
        readdir(path.join(generatedRoot, 'projects'))),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
