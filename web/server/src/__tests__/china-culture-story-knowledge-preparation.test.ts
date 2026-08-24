import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  StoryGenerateRequest,
  StoryKnowledgeEvidenceOverlayV1,
} from '@shared/types.js';
import {
  adaptLegacyChinaCultureEntryToStoryKnowledgeContract,
} from '../domains/china-culture/story-knowledge-contract-service.js';
import {
  prepareChinaCultureStoryGeneration,
} from '../domains/china-culture/story-generation-preparation-service.js';
import {
  executeChinaCultureStoryGeneration,
} from '../domains/china-culture/story-generation-execution-service.js';
import {
  buildStoryKnowledgeGenerationShadow,
} from '../domains/china-culture/story-knowledge-generation-shadow-service.js';

const REVIEWED_AT = '2026-07-31T13:00:00+08:00';
process.env.KB_ROOT ??= resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
const REQUEST: StoryGenerateRequest = {
  video_type: 'ai_comic_drama',
  presentation_style: 'ai_comic',
  creation_use_case: 'original_ai_comic',
  truth_mode: 'fictional_original',
  original_user_query: '标题：知识合同测试故事。少年发现古桥即将被洪水冲毁，决定召集伙伴守桥。',
};

const MULTI_SOURCE_REQUEST: StoryGenerateRequest = {
  ...REQUEST,
  entry_name: '岳阳楼——先忧后乐的精神地标',
  original_user_query: '以岳阳楼的建筑变迁与忧乐精神为依据，创作一则守护文化记忆的故事。',
};

async function preparationBase() {
  const preparation = await prepareChinaCultureStoryGeneration(REQUEST);
  expect(preparation.ok).toBe(true);
  if (!preparation.ok) throw new Error(preparation.message);
  const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(
    preparation.entry,
  ).contract;
  return { preparation, contract };
}

function overlay(
  contract: Awaited<ReturnType<typeof preparationBase>>['contract'],
  signoff: StoryKnowledgeEvidenceOverlayV1['signoff'],
  mode: 'human_fact' | 'machine_context',
): StoryKnowledgeEvidenceOverlayV1 {
  const humanFact = mode === 'human_fact';
  return {
    schema_version: 'story-knowledge-evidence-overlay/v1',
    overlay_id: `fixture-${mode}-20260731`,
    entry_name: contract.source_entry.name,
    source_reviews: [{
      source_ref_id: contract.sources[0]!.source_ref_id,
      grade: 'A',
      verification_status: humanFact ? 'human_verified' : 'machine_mapped',
      ...(humanFact ? { verified_at: REVIEWED_AT } : {}),
      note: humanFact
        ? '合成 fixture 的人工签收路径，仅用于合同测试，不授予真实审核信用。'
        : '机器候选映射，等待人工审核。',
    }],
    claim_mappings: [{
      claim_id: contract.claims[0]!.claim_id,
      source_ref_ids: [contract.sources[0]!.source_ref_id],
      claim_type: humanFact ? 'critical_fact' : 'supporting_fact',
      certainty: humanFact ? 'verified' : 'probable',
      usage: humanFact ? 'fact' : 'bounded_context',
      scope: humanFact
        ? '合成 fixture 只验证合同开闸，不代表真实文化事实。'
        : '人工签收前只能作为受限背景。',
    }],
    signoff,
    boundary: {
      read_only_overlay: true,
      source_markdown_writeback_allowed: false,
      generation_consumption_allowed: false,
      existing_supplement_tasks_mutable: false,
    },
  };
}

describe('story knowledge preparation read-only boundary', () => {
  it('keeps the default preparation result byte-shape compatible when the feature is not requested', async () => {
    const baseline = await prepareChinaCultureStoryGeneration(REQUEST);
    const explicitDefault = await prepareChinaCultureStoryGeneration(REQUEST, {});

    expect(explicitDefault).toEqual(baseline);
    expect(baseline).not.toHaveProperty('storyKnowledgePreparation');
  });

  it('returns a base-only contract when read-only preparation is enabled without an overlay', async () => {
    const { preparation: baseline } = await preparationBase();
    const result = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storyKnowledgePreparation).toMatchObject({
      schema_version: 'story-knowledge-preparation/v1',
      status: 'base_contract_only',
      issues: ['evidence overlay was not provided'],
      boundary: {
        consumed_by_blueprint: false,
        consumed_by_prompt: false,
        consumed_by_fallback: false,
        persistence_allowed: false,
        generation_output_changed: false,
      },
    });
    expect(result.storyKnowledgePreparation?.contract.boundary)
      .toMatchObject({ critical_facts_can_be_asserted: false });
    expect(result.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
  });

  it('keeps a pending machine overlay bounded and leaves the blueprint unchanged', async () => {
    const { preparation: baseline, contract } = await preparationBase();
    const result = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
        evidenceOverlay: overlay(contract, {
          status: 'pending',
          reason: '等待事实与文化审核。',
        }, 'machine_context'),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storyKnowledgePreparation).toMatchObject({
      status: 'overlay_pending',
      overlay_id: 'fixture-machine_context-20260731',
      contract: {
        sources: [expect.objectContaining({
          grade: 'A',
          verification_status: 'machine_mapped',
        })],
        boundary: {
          critical_facts_can_be_asserted: false,
        },
      },
    });
    expect(result.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
  });

  it('builds a generation-preparation shadow without changing active generation inputs', async () => {
    const { preparation: baseline, contract } = await preparationBase();
    const result = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
        generationShadow: true,
        evidenceOverlay: overlay(contract, {
          status: 'pending',
          reason: '等待事实与文化审核。',
        }, 'machine_context'),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storyKnowledgeGenerationShadow).toMatchObject({
      schema_version: 'story-knowledge-generation-shadow/v1',
      status: 'safe_no_fact_candidates',
      preparation_status: 'overlay_pending',
      contract_projection: {
        fact_candidate_claim_ids: [],
      },
      amplification_checks: {
        ungraded_source_promoted_to_fact_count: 0,
        machine_only_source_promoted_to_fact_count: 0,
        non_authoritative_source_promoted_to_fact_count: 0,
        non_verified_claim_promoted_to_fact_count: 0,
        blocked_claim_promoted_to_fact_count: 0,
        doubtful_entry_promoted_to_fact: false,
        structured_fact_count_not_above_ready_count: true,
      },
      boundary: {
        shadow_only: true,
        consumed_by_blueprint: false,
        consumed_by_prompt: false,
        consumed_by_fallback: false,
        persistence_allowed: false,
        generation_output_changed: false,
      },
    });
    expect(result.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
    expect(result.knowledgePackToUse).toEqual(baseline.knowledgePackToUse);
    expect(result.materialPackToUse).toEqual(baseline.materialPackToUse);
  });

  it('fails closed when an approved overlay tries to promote a machine-only supporting claim', async () => {
    const { preparation: baseline, contract } = await preparationBase();
    const machineFactOverlay: StoryKnowledgeEvidenceOverlayV1 = {
      ...overlay(contract, {
        status: 'approved',
        reviewed_by: 'fixture-reviewer-not-real',
        reviewer_role: 'fact_culture_reviewer',
        reviewed_at: REVIEWED_AT,
        confirmation: 'human_reviewed_story_knowledge_evidence_overlay',
      }, 'machine_context'),
      source_reviews: [{
        source_ref_id: contract.sources[0]!.source_ref_id,
        grade: 'A',
        verification_status: 'machine_mapped',
        note: '机器映射不能成为事实来源。',
      }],
      claim_mappings: [{
        claim_id: contract.claims[0]!.claim_id,
        source_ref_ids: [contract.sources[0]!.source_ref_id],
        claim_type: 'supporting_fact',
        certainty: 'verified',
        usage: 'fact',
        scope: '恶意 fixture：尝试用机器映射来源提升事实。',
      }],
    };
    const result = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
        generationShadow: true,
        evidenceOverlay: machineFactOverlay,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storyKnowledgeGenerationShadow).toMatchObject({
      status: 'blocked',
      contract_projection: {
        fact_candidate_claim_ids: [],
      },
      amplification_checks: {
        machine_only_source_promoted_to_fact_count: 1,
        non_authoritative_source_promoted_to_fact_count: 1,
        structured_fact_count_not_above_ready_count: true,
      },
      issues: expect.arrayContaining(['machine_only_source_promoted_to_fact']),
    });
    expect(result.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
    expect(result.materialPackToUse).toEqual(baseline.materialPackToUse);
  });

  it('exposes an approved fixture only as a read-only contract and still leaves the blueprint unchanged', async () => {
    const { preparation: baseline, contract } = await preparationBase();
    const result = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
        evidenceOverlay: overlay(contract, {
          status: 'approved',
          reviewed_by: 'fixture-reviewer-not-real',
          reviewer_role: 'fact_culture_reviewer',
          reviewed_at: REVIEWED_AT,
          confirmation: 'human_reviewed_story_knowledge_evidence_overlay',
        }, 'human_fact'),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storyKnowledgePreparation).toMatchObject({
      status: 'overlay_approved_read_only',
      overlay_id: 'fixture-human_fact-20260731',
      contract: {
        boundary: {
          critical_facts_can_be_asserted: true,
          consumed_by_generation: false,
        },
      },
      boundary: {
        real_human_review_credit_granted: false,
        generation_output_changed: false,
      },
    });
    expect(result.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
  });

  it('projects only human-verified critical facts and blocks a doubtful entry from promotion', async () => {
    const { preparation: baseline, contract } = await preparationBase();
    const result = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
        generationShadow: true,
        evidenceOverlay: overlay(contract, {
          status: 'approved',
          reviewed_by: 'fixture-reviewer-not-real',
          reviewer_role: 'fact_culture_reviewer',
          reviewed_at: REVIEWED_AT,
          confirmation: 'human_reviewed_story_knowledge_evidence_overlay',
        }, 'human_fact'),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storyKnowledgeGenerationShadow).toMatchObject({
      status: 'safe_fact_candidates',
      contract_projection: {
        fact_candidate_claim_ids: [contract.claims[0]!.claim_id],
      },
      amplification_checks: {
        ungraded_source_promoted_to_fact_count: 0,
        machine_only_source_promoted_to_fact_count: 0,
        structured_fact_count_not_above_ready_count: true,
      },
    });

    const doubtfulShadow = buildStoryKnowledgeGenerationShadow({
      preparation: result.storyKnowledgePreparation!,
      materialPack: result.materialPackToUse,
      entryCredibility: '存疑',
    });
    expect(doubtfulShadow).toMatchObject({
      status: 'blocked',
      contract_projection: { fact_candidate_claim_ids: [] },
      amplification_checks: { doubtful_entry_promoted_to_fact: true },
      issues: ['doubtful_entry_promoted_to_fact'],
    });
    expect(result.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
  });

  it('builds a multi-source prompt shadow receipt without executing or replacing the active prompt', async () => {
    const baseline = await prepareChinaCultureStoryGeneration(MULTI_SOURCE_REQUEST);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;
    const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(
      baseline.entry,
    ).contract;
    expect(contract.sources.length).toBeGreaterThanOrEqual(2);
    const approvedOverlay: StoryKnowledgeEvidenceOverlayV1 = {
      schema_version: 'story-knowledge-evidence-overlay/v1',
      overlay_id: 'fixture-multi-source-prompt-shadow-20260824',
      entry_name: contract.source_entry.name,
      source_reviews: contract.sources.slice(0, 2).map((source, index) => ({
        source_ref_id: source.source_ref_id,
        grade: index === 0 ? 'A' : 'B',
        verification_status: 'human_verified',
        verified_at: REVIEWED_AT,
        note: '合成多来源 fixture，仅验证 shadow 合同，不授予真实审核信用。',
      })),
      claim_mappings: [{
        claim_id: contract.claims[0]!.claim_id,
        source_ref_ids: contract.sources.slice(0, 2).map(source => source.source_ref_id),
        claim_type: 'critical_fact',
        certainty: 'verified',
        usage: 'fact',
        scope: '合成 fixture 事实候选，仅进入未执行 shadow prompt。',
      }],
      signoff: {
        status: 'approved',
        reviewed_by: 'fixture-reviewer-not-real',
        reviewer_role: 'fact_culture_reviewer',
        reviewed_at: REVIEWED_AT,
        confirmation: 'human_reviewed_story_knowledge_evidence_overlay',
      },
      boundary: {
        read_only_overlay: true,
        source_markdown_writeback_allowed: false,
        generation_consumption_allowed: false,
        existing_supplement_tasks_mutable: false,
      },
    };
    const shadowPreparation = await prepareChinaCultureStoryGeneration(
      MULTI_SOURCE_REQUEST,
      {
        storyKnowledge: {
          enabled: true,
          generationShadow: true,
          evidenceOverlay: approvedOverlay,
        },
      },
    );
    expect(shadowPreparation.ok).toBe(true);
    if (!shadowPreparation.ok) return;

    const baselineExecution = await executeChinaCultureStoryGeneration({
      request: MULTI_SOURCE_REQUEST,
      preparation: baseline,
    });
    const shadowExecution = await executeChinaCultureStoryGeneration({
      request: MULTI_SOURCE_REQUEST,
      preparation: shadowPreparation,
    });
    expect(baselineExecution.ok).toBe(true);
    expect(shadowExecution.ok).toBe(true);
    if (!baselineExecution.ok || !shadowExecution.ok) return;

    expect(shadowExecution.storyKnowledgePromptShadowComparison).toMatchObject({
      schema_version: 'story-knowledge-prompt-shadow-comparison/v1',
      status: 'candidate_ready',
      fact_candidate_claim_ids: [contract.claims[0]!.claim_id],
      changed_generation_input_paths: ['material_pack.verified_facts'],
      changed_prompt_package_paths: [
        'material_pack.verified_facts',
        'user_prompt',
      ],
      boundary: {
        active_prompt_preserved_for_execution: true,
        shadow_prompt_executed: false,
        shadow_prompt_persisted: false,
        generation_output_changed: false,
        real_human_review_credit_granted: false,
      },
    });
    expect(shadowExecution.storyKnowledgePromptShadowComparison?.active_prompt_package_sha256)
      .toBe(shadowExecution.storyKnowledgePromptShadowComparison?.execution_prompt_package_sha256);
    expect(shadowExecution.storyKnowledgePromptShadowComparison?.shadow_prompt_package_sha256)
      .not.toBe(shadowExecution.storyKnowledgePromptShadowComparison?.active_prompt_package_sha256);
    expect(shadowExecution.promptPackage).toEqual(baselineExecution.promptPackage);
    expect(shadowExecution.storyResult).toEqual(baselineExecution.storyResult);
  });

  it('degrades rejected and incompatible overlays to the untouched base contract', async () => {
    const { preparation: baseline, contract } = await preparationBase();
    const rejected = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
        evidenceOverlay: overlay(contract, {
          status: 'rejected',
          reviewed_by: 'fixture-reviewer-not-real',
          reviewer_role: 'fact_culture_reviewer',
          reviewed_at: REVIEWED_AT,
          reason: 'fixture rejection path',
        }, 'machine_context'),
      },
    });
    const incompatibleVersion = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
        evidenceOverlay: {
          schema_version: 'story-knowledge-evidence-overlay/v2',
          overlay_id: 'future-overlay',
        },
      },
    });
    const unknownReference = await prepareChinaCultureStoryGeneration(REQUEST, {
      storyKnowledge: {
        enabled: true,
        evidenceOverlay: {
          ...overlay(contract, {
            status: 'pending',
            reason: '等待事实与文化审核。',
          }, 'machine_context'),
          source_reviews: [{
            ...overlay(contract, {
              status: 'pending',
              reason: '等待事实与文化审核。',
            }, 'machine_context').source_reviews[0]!,
            source_ref_id: 'unknown-source',
          }],
          claim_mappings: [],
        },
      },
    });

    for (const result of [rejected, incompatibleVersion, unknownReference]) {
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.storyKnowledgePreparation?.contract).toEqual(contract);
      expect(result.preliminaryStoryBlueprint).toEqual(baseline.preliminaryStoryBlueprint);
    }
    if (rejected.ok) {
      expect(rejected.storyKnowledgePreparation).toMatchObject({
        status: 'overlay_rejected',
        issues: ['fixture rejection path'],
      });
    }
    if (incompatibleVersion.ok) {
      expect(incompatibleVersion.storyKnowledgePreparation).toMatchObject({
        status: 'overlay_incompatible',
      });
    }
    if (unknownReference.ok) {
      expect(unknownReference.storyKnowledgePreparation).toMatchObject({
        status: 'overlay_incompatible',
        issues: ['unknown source_ref_id: unknown-source'],
      });
    }
  });

  it('keeps knowledge preparation out of prompt, fallback, blueprint builder and persistence', async () => {
    const [
      prompt,
      fallback,
      blueprint,
      document,
      preparation,
      execution,
      generation,
    ] = await Promise.all([
      readFile(new URL('../services/story-generation-prompt.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/dramatic-story.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-blueprint-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-document-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-execution-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(preparation).toContain('resolveStoryKnowledgePreparation(');
    expect(preparation).toContain('buildStoryKnowledgeGenerationShadow(');
    expect(prompt).not.toContain('StoryKnowledgePreparationV1');
    expect(prompt).not.toContain('StoryKnowledgeGenerationShadowV1');
    expect(fallback).not.toContain('StoryKnowledgePreparationV1');
    expect(fallback).not.toContain('StoryKnowledgeGenerationShadowV1');
    expect(blueprint).not.toContain('StoryKnowledgePreparationV1');
    expect(blueprint).not.toContain('StoryKnowledgeGenerationShadowV1');
    expect(document).not.toContain('storyKnowledgePreparation');
    expect(document).not.toContain('storyKnowledgeGenerationShadow');
    expect(execution).toContain('pkg: promptPackage');
    expect(execution).not.toContain('pkg: shadowPromptPackage');
    expect(generation).not.toContain('storyKnowledgePromptShadowComparison');
    expect(document).not.toContain('storyKnowledgePromptShadowComparison');
  });

  it('keeps the reproducible fixture report synthetic and grants zero real review credit', async () => {
    const report = JSON.parse(await readFile(
      new URL('../../../../data/reports/story-agent-knowledge-overlay-m1-fixture-report.json', import.meta.url),
      'utf8',
    )) as Record<string, unknown>;

    expect(report).toMatchObject({
      schema_version: 'story-knowledge-overlay-fixture-audit/v1',
      status: 'passed',
      cases: {
        pending: {
          preparation_status: 'overlay_pending',
          critical_fact_ready_count: 0,
        },
        approved: {
          preparation_status: 'overlay_approved_read_only',
          critical_fact_ready_count: 1,
        },
      },
      invariants: {
        fixture_is_explicitly_synthetic: true,
        no_real_human_review_credit: true,
        pending_overlay_stays_bounded: true,
        approved_fixture_exercises_evidence_gate: true,
        preparation_never_changes_generation_output: true,
        preparation_never_persists: true,
      },
      boundary: {
        fixture_only: true,
        real_human_review_credit_granted: false,
        consumed_by_generation: false,
        persistence_allowed: false,
      },
    });
  });
});
