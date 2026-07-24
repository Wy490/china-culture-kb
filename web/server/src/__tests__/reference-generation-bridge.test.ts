import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { EntryDetail } from '@shared/types.js';
import {
  createBenchmarkCard,
  createFilmReferenceAnalysis,
  createReferenceSource,
  createReferenceStylePack,
} from '../services/reference-library-service.js';
import {
  buildReferenceGenerationTrace,
  resolveReferenceGenerationContext,
} from '../services/reference-generation-bridge-service.js';
import { buildStoryGenerationPromptPackage } from '../services/story-generation-prompt.js';
import { prepareChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-preparation-service.js';
import { executeChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-execution-service.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';

const temporaryRoots: string[] = [];
const approvedAt = '2026-07-24T14:00:00.000Z';
const originalEnv = {
  KB_ROOT: process.env.KB_ROOT,
  REFERENCE_LIBRARY_REPO_ROOT: process.env.REFERENCE_LIBRARY_REPO_ROOT,
  STORY_GEN_PROVIDER: process.env.STORY_GEN_PROVIDER,
  STORY_GEN_COMMAND: process.env.STORY_GEN_COMMAND,
  STORY_GEN_COMMAND_ARGS: process.env.STORY_GEN_COMMAND_ARGS,
  STORY_GEN_EXECUTION_EVIDENCE: process.env.STORY_GEN_EXECUTION_EVIDENCE,
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

async function createApprovedStylePack(repoRoot: string) {
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
        rights_status: 'research_only',
        access_scope: 'metadata_only',
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

    process.env.STORY_GEN_PROVIDER = 'command_json';
    process.env.STORY_GEN_EXECUTION_EVIDENCE = 'record_replay_fixture';
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e',
      'const output=JSON.parse(process.argv[1]);process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(JSON.stringify(output)));',
      JSON.stringify({
        title: local.storyResult.title,
        logline: local.storyResult.logline,
        theme: local.storyResult.theme,
        full_text: local.storyResult.full_text,
        scene_breakdown: local.storyResult.scene_breakdown,
        cultural_constraints: local.storyResult.cultural_constraints,
        credibility_note: local.storyResult.credibility_note,
      }),
    ]);

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
});
