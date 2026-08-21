import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoryGenerateRequestSchema } from '@shared/schemas.js';
import type {
  MaterialPack,
  StoryGenerateRequest,
} from '@shared/types.js';
import { executeChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-execution-service.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';
import { prepareChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-preparation-service.js';
import { validateChinaCultureStoryAssemblyBaseQuality } from '../domains/china-culture/story-base-quality-service.js';
import { buildChinaCultureGeneratedStoryDocument } from '../domains/china-culture/story-document-service.js';
import {
  buildStoryGenerationRecordReplayFixture,
} from '../services/story-generation-model.js';
import { buildStoryGenerationPromptPackage } from '../services/story-generation-prompt.js';
import { attachBlueprintScenes } from '../services/story-blueprint-service.js';

const originalEnv = {
  STORY_GEN_COMMAND: process.env.STORY_GEN_COMMAND,
  STORY_GEN_COMMAND_ARGS: process.env.STORY_GEN_COMMAND_ARGS,
  STORY_GEN_COMMAND_TIMEOUT_MS: process.env.STORY_GEN_COMMAND_TIMEOUT_MS,
  STORY_GEN_PROVIDER: process.env.STORY_GEN_PROVIDER,
  STORY_GEN_EXECUTION_EVIDENCE: process.env.STORY_GEN_EXECUTION_EVIDENCE,
  STORY_GEN_RECORD_REPLAY_FIXTURE_PATH:
    process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH,
  KB_ROOT: process.env.KB_ROOT,
};

const tempDirectories: string[] = [];

type StrictStoryGenerateRequest = StoryGenerateRequest & {
  generation_fallback_policy?: 'allow_local_fallback' | 'forbid_local_fallback';
  material_readiness_policy?: 'allow_draft_with_risks' | 'require_script_ready';
};

beforeEach(() => {
  process.env.KB_ROOT = resolve(
    import.meta.dirname,
    '..',
    '..',
    '..',
    '..',
    'data',
  );
});

afterEach(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await Promise.all(tempDirectories.splice(0).map(path => (
    rm(path, { recursive: true, force: true })
  )));
});

function materialPack(input: {
  missing?: boolean;
  conflict?: boolean;
}): MaterialPack {
  return {
    schema_version: 'material-pack/v1',
    primary_materials: input.missing ? [] : [{
      material_id: 'verified-primary',
      title: '周敦颐资料',
      summary: '周敦颐相关事实资料。',
      source_type: 'knowledge_entry',
      purpose: ['fact_basis'],
      linked_entry_name: '周敦颐——理学开山鼻祖',
    }],
    supporting_materials: [],
    reference_materials: [],
    brand_or_institution_profile: input.missing ? undefined : {
      name: '测试机构',
      verified_claims: ['只使用已核事实。'],
      forbidden_claims: ['不得虚构机构成果。'],
    },
    visual_assets: [],
    verified_facts: input.missing ? [] : ['周敦颐是北宋思想家。'],
    uncertain_claims: input.conflict
      ? ['出生年份存在两个互相冲突的版本。']
      : [],
    creative_space: input.missing ? [] : ['只允许组织镜头，不补写新事实。'],
    missing_needs: input.conflict ? [{
      need_id: 'birth-year-conflict',
      label: '出生年份冲突',
      message: '来源 A 与来源 B 的出生年份互相矛盾，尚未裁定。',
    }] : [],
    overall_confidence: input.missing ? 0.2 : 0.9,
  };
}

function strictExternalRequest(): StrictStoryGenerateRequest {
  return {
    entry_name: '周敦颐——理学开山鼻祖',
    video_type: 'character_story',
    model_profile_id: 'claude_sonnet',
    target_video_duration: '1分钟',
    selected_event: '周敦颐拒签冤案并以辞官相争',
    output_gears_segments: true,
    auto_repair: false,
    generation_fallback_policy: 'forbid_local_fallback',
  };
}

async function prepareExternalRequest(request = strictExternalRequest()) {
  const preparation = await prepareChinaCultureStoryGeneration(request);
  expect(preparation.ok).toBe(true);
  if (!preparation.ok) throw new Error(preparation.message);
  return preparation;
}

function recordReplayOutput(
  preparation: Awaited<ReturnType<typeof prepareExternalRequest>>,
) {
  const local = generateChinaCultureLocalStoryAssembly({
    entry: preparation.entry,
    centralEvent: preparation.centralEvent,
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
    storyStructure: preparation.storyStructure,
    targetDuration: preparation.targetDuration,
    tone: preparation.localTone,
    knowledgePack: preparation.knowledgePackToUse,
    genreComposition: preparation.genreComposition,
  });
  if (!local.ok) throw new Error(local.message);
  return {
    title: `${local.storyResult.title}（record replay）`,
    logline: local.storyResult.logline,
    theme: local.storyResult.theme,
    full_text: local.storyResult.full_text,
    scene_breakdown: local.storyResult.scene_breakdown.map(scene => ({
      scene_id: scene.scene_id,
      title: scene.title,
      plot: scene.plot,
      key_action: scene.key_action,
      conflict: scene.conflict,
      dialogue_or_narration: scene.dialogue_or_narration,
      visual_prompt: scene.visual_prompt,
      camera_suggestion: scene.camera_suggestion,
      characters: scene.characters,
      cultural_note: scene.cultural_note,
    })),
    cultural_constraints: local.storyResult.cultural_constraints,
    credibility_note: local.storyResult.credibility_note,
  };
}

function recordReplayPromptPackage(
  request: StrictStoryGenerateRequest,
  preparation: Awaited<ReturnType<typeof prepareExternalRequest>>,
) {
  const local = generateChinaCultureLocalStoryAssembly({
    entry: preparation.entry,
    centralEvent: preparation.centralEvent,
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
    storyStructure: preparation.storyStructure,
    targetDuration: preparation.targetDuration,
    tone: preparation.localTone,
    knowledgePack: preparation.knowledgePackToUse,
    originalUserQuery: request.original_user_query ?? request.outline,
    adaptationAnalysis: preparation.adaptationAnalysis,
    genreComposition: preparation.genreComposition,
  });
  if (!local.ok) throw new Error(local.message);
  return buildStoryGenerationPromptPackage({
    entry: preparation.entry,
    request: {
      ...request,
      narrative_pattern_ids: preparation.narrativePatternIds,
    },
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
    storyStructure: preparation.storyStructure,
    targetDuration: preparation.targetDuration,
    tone: preparation.toneWithPriority,
    selectedEvent: preparation.centralEvent,
    knowledgePack: preparation.knowledgePackToUse,
    materialPack: preparation.materialPackToUse,
    materialSufficiency: preparation.materialSufficiency,
    productionMaterialPack: preparation.productionMaterialPack,
    productionMaterialReadiness: preparation.productionMaterialReadiness,
    creationContract: preparation.creationContract,
    genreMatrix: preparation.genreMatrix,
    memoryMosaicSeed: local.memoryMosaicSeed,
    storyBlueprint: preparation.preliminaryStoryBlueprint,
    adaptationAnalysis: preparation.adaptationAnalysis,
    referenceGenerationRecipe: preparation.referenceGenerationRecipe,
    referenceGenerationContext: preparation.referenceGenerationContext,
  });
}

async function installRecordReplayFixture(input: {
  request: StrictStoryGenerateRequest;
  preparation: Awaited<ReturnType<typeof prepareExternalRequest>>;
  mutate?: (fixture: Record<string, unknown>) => void;
}) {
  const fixture = buildStoryGenerationRecordReplayFixture({
    pkg: recordReplayPromptPackage(input.request, input.preparation),
    modelProfileId: input.preparation.selectedModelProfile.id,
    output: recordReplayOutput(input.preparation),
    recordedAt: '2026-08-21T00:00:00.000Z',
    provenance: {
      source: 'offline_fixture',
      external_model_call_recorded: false,
    },
  });
  input.mutate?.(fixture as unknown as Record<string, unknown>);
  const directory = await mkdtemp(join(tmpdir(), 'story-record-replay-'));
  tempDirectories.push(directory);
  const path = join(directory, 'fixture.json');
  await writeFile(path, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  process.env.STORY_GEN_PROVIDER = 'record_replay_json';
  process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH = path;
  return fixture;
}

describe('strict Story Agent generation policies', () => {
  it('accepts strict material and fallback policies in the authoritative request schema', () => {
    const parsed = StoryGenerateRequestSchema.safeParse({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'character_story',
      generation_fallback_policy: 'forbid_local_fallback',
      material_readiness_policy: 'require_script_ready',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      generation_fallback_policy: 'forbid_local_fallback',
      material_readiness_policy: 'require_script_ready',
    });
  });

  it('fails before generation when strict script readiness has blocking material gaps', async () => {
    const result = await prepareChinaCultureStoryGeneration({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'culture_promo',
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
      material_pack: materialPack({ missing: true }),
      material_readiness_policy: 'require_script_ready',
    } as StrictStoryGenerateRequest);

    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
      details: {
        schema_version: 'story-material-readiness-gate/v1',
        policy: 'require_script_ready',
        stage: 'script_ready',
        status: 'blocked',
      },
    });
    if (result.ok || !('details' in result)) return;
    if (result.details.schema_version !== 'story-material-readiness-gate/v1') return;
    expect(result.details.blocking_item_ids).toEqual(expect.arrayContaining([
      'primary_material',
      'institution_profile',
      'verified_facts',
    ]));
  });

  it('fails before generation when strict script readiness sees unresolved source conflicts', async () => {
    const result = await prepareChinaCultureStoryGeneration({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'culture_promo',
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
      material_pack: materialPack({ conflict: true }),
      material_readiness_policy: 'require_script_ready',
    } as StrictStoryGenerateRequest);

    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
      details: {
        schema_version: 'story-material-readiness-gate/v1',
        status: 'needs_input',
        unresolved_conflict_need_ids: ['birth-year-conflict'],
      },
    });
  });

  it('rejects invalid external output instead of silently using the local story', async () => {
    process.env.STORY_GEN_PROVIDER = 'command_json';
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e',
      "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('invalid json'));",
    ]);
    const request = strictExternalRequest();
    const result = await executeChinaCultureStoryGeneration({
      request,
      preparation: await prepareExternalRequest(request),
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
      details: {
        schema_version: 'story-generation-fallback-gate/v1',
        policy: 'forbid_local_fallback',
        requested_model_profile_id: 'claude_sonnet',
        adapter_provider: 'command_json',
        generation_mode: 'local_fallback',
      },
    });
    if (result.ok) return;
    expect(result.details.reason).toContain('invalid JSON');
  });

  it('rejects an external timeout instead of silently using the local story', async () => {
    process.env.STORY_GEN_PROVIDER = 'command_json';
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e',
      "process.stdin.resume();process.stdin.on('end',()=>setTimeout(()=>{},1000));",
    ]);
    process.env.STORY_GEN_COMMAND_TIMEOUT_MS = '10';
    const request = strictExternalRequest();
    const result = await executeChinaCultureStoryGeneration({
      request,
      preparation: await prepareExternalRequest(request),
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
      details: {
        schema_version: 'story-generation-fallback-gate/v1',
        generation_mode: 'local_fallback',
      },
    });
    if (result.ok) return;
    expect(result.details.reason).toContain('timed out');
  });

  it('accepts a compatible external record replay without granting real-provider credit', async () => {
    const request = strictExternalRequest();
    const preparation = await prepareExternalRequest(request);
    const fixture = await installRecordReplayFixture({ request, preparation });

    const result = await executeChinaCultureStoryGeneration({
      request,
      preparation,
    });

    expect(result).toMatchObject({
      ok: true,
      generationMode: 'external_model',
      generationUsedFallback: false,
      adapterResult: {
        provider: 'record_replay_json',
        used_fallback: false,
        execution_evidence: 'record_replay_fixture',
        record_replay_receipt: {
          schema_version: 'story-generation-record-replay-receipt/v1',
          fixture_id: fixture.fixture_id,
          prompt_sha256: fixture.prompt_sha256,
          output_sha256: fixture.output_sha256,
          fixture_sha256: fixture.fixture_sha256,
          replay_invokes_external_model: false,
          real_external_model_credit_granted: false,
        },
      },
    });
    if (!result.ok) return;
    expect(result.storyResult.title).toContain('record replay');
    const storyId = 'record-replay-persistence-test';
    const finalStoryBlueprint = attachBlueprintScenes(
      preparation.preliminaryStoryBlueprint,
      result.storyResult.scene_breakdown,
      storyId,
    );
    const quality = validateChinaCultureStoryAssemblyBaseQuality({
      storyResult: result.storyResult,
      storyStructure: preparation.storyStructure,
      memoryMosaicSeed: result.memoryMosaicSeed,
      selectedEvent: preparation.centralEvent,
      videoType: preparation.videoType,
      truthMode: preparation.truthMode,
      materialSufficiency: preparation.materialSufficiency,
    });
    const document = buildChinaCultureGeneratedStoryDocument({
      request,
      storyId,
      createdAt: '2026-08-21T00:00:00.000Z',
      preparation,
      storyResult: result.storyResult,
      finalStoryBlueprint,
      baseQualityReport: quality,
      adapterResult: result.adapterResult,
      generationMode: result.generationMode,
      generationUsedFallback: result.generationUsedFallback,
      referenceTrace: result.referenceTrace,
      memoryMosaicSeed: result.memoryMosaicSeed,
    });
    expect(document).toMatchObject({
      external_model_call_performed: false,
      model_execution_evidence: 'record_replay_fixture',
      model_record_replay_receipt: result.adapterResult.record_replay_receipt,
      _request_meta: {
        model_record_replay_receipt: result.adapterResult.record_replay_receipt,
      },
    });
  });

  it('does not let a command adapter self-assert record replay evidence', async () => {
    const request = strictExternalRequest();
    const preparation = await prepareExternalRequest(request);
    const replay = recordReplayOutput(preparation);
    process.env.STORY_GEN_PROVIDER = 'command_json';
    process.env.STORY_GEN_EXECUTION_EVIDENCE = 'record_replay_fixture';
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e',
      'const output=JSON.parse(process.argv[1]);process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(JSON.stringify(output)));',
      JSON.stringify(replay),
    ]);

    const result = await executeChinaCultureStoryGeneration({ request, preparation });

    expect(result).toMatchObject({
      ok: true,
      generationMode: 'external_model',
      adapterResult: {
        provider: 'command_json',
        execution_evidence: 'live_external_command',
      },
    });
  });

  it('fails closed when recorded output is changed without refreshing integrity hashes', async () => {
    const request = strictExternalRequest();
    const preparation = await prepareExternalRequest(request);
    await installRecordReplayFixture({
      request,
      preparation,
      mutate: fixture => {
        const output = fixture.output as { title: string };
        output.title = `${output.title}（tampered）`;
      },
    });

    const result = await executeChinaCultureStoryGeneration({ request, preparation });

    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
      details: {
        adapter_provider: 'record_replay_json',
        generation_mode: 'local_fallback',
      },
    });
    if (result.ok) return;
    expect(result.details.reason).toContain('output_sha256 mismatch');
  });

  it('fails closed when recording metadata is changed without refreshing the package hash', async () => {
    const request = strictExternalRequest();
    const preparation = await prepareExternalRequest(request);
    await installRecordReplayFixture({
      request,
      preparation,
      mutate: fixture => {
        fixture.recorded_at = '2026-08-22T00:00:00.000Z';
      },
    });

    const result = await executeChinaCultureStoryGeneration({ request, preparation });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.details.reason).toContain('fixture_sha256 mismatch');
  });

  it('fails closed when the current prompt drifts from the recorded prompt', async () => {
    const recordedRequest = strictExternalRequest();
    const recordedPreparation = await prepareExternalRequest(recordedRequest);
    await installRecordReplayFixture({
      request: recordedRequest,
      preparation: recordedPreparation,
    });
    const driftedRequest = {
      ...recordedRequest,
      tone: '冷峻压迫、克制留白',
    };
    const driftedPreparation = await prepareExternalRequest(driftedRequest);

    const result = await executeChinaCultureStoryGeneration({
      request: driftedRequest,
      preparation: driftedPreparation,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
      details: {
        adapter_provider: 'record_replay_json',
        generation_mode: 'local_fallback',
      },
    });
    if (result.ok) return;
    expect(result.details.reason).toContain('prompt_sha256 mismatch');
  });

  it('preserves primary and secondary genre mechanisms through verified replay merge', async () => {
    const request: StrictStoryGenerateRequest = {
      ...strictExternalRequest(),
      video_type: 'ai_comic_drama',
      target_video_duration: '3分钟',
      cultural_source_kinds: ['historical_figure', 'local_anecdote'],
      narrative_pattern_ids: [
        'archaeological_mystery_expedition',
        'fair_play_detective',
      ],
    };
    const preparation = await prepareExternalRequest(request);
    await installRecordReplayFixture({ request, preparation });

    const result = await executeChinaCultureStoryGeneration({ request, preparation });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(preparation.genreComposition.fusion_plan).toMatchObject({
      primary_pattern_id: 'archaeological_mystery_expedition',
      secondary_pattern_ids: ['fair_play_detective'],
    });
    expect(result.storyResult.scene_breakdown[0].dramatic_function).toBe('异常器物');
    expect(result.storyResult.scene_breakdown.at(-1)?.dramatic_function).toBe('带着代价返回');
    const secondaryScenes = result.storyResult.scene_breakdown.filter(scene => (
      /证词|物证|时间线|反证/u.test(`${scene.plot} ${scene.key_action}`)
    ));
    expect(secondaryScenes).toHaveLength(1);
    expect(result.storyResult.gears_segments.some(segment => (
      /证词|物证|时间线|反证/u.test(segment.script_text)
    ))).toBe(true);
  });
});
