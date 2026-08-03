import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { StoryKnowledgeEvidenceOverlayV1Schema } from '@shared/schemas.js';
import type {
  EntryDetail,
  StoryKnowledgeEvidenceOverlayV1,
} from '@shared/types.js';
import {
  adaptLegacyChinaCultureEntryToStoryKnowledgeContract,
} from '../domains/china-culture/story-knowledge-contract-service.js';
import {
  assembleStoryKnowledgeContractWithEvidenceOverlay,
  projectStoryKnowledgeMissingMaterialToSupplementTasks,
} from '../domains/china-culture/story-knowledge-evidence-overlay-service.js';

const REVIEWED_AT = '2026-07-31T09:30:00+08:00';

function legacyEntry(): EntryDetail {
  return {
    name: '周敦颐——月岩悟道',
    province: '湖南',
    region: '湖南→永州→道县',
    type: '历史人物',
    summary: '宋代人物与月岩读书传说。',
    story: '地方叙事称周敦颐曾在月岩洞读书悟道。',
    culturalSignificance: '需要区分可核验人物史实与后世地方传说。',
    relatedLocations: [{
      name: '月岩洞',
      description: '天然岩洞与地方传说场所。',
    }],
    localCreativeRelations: [],
    keywords: ['周敦颐', '宋代', '月岩洞'],
    sources: ['《宋史》相关人物传记'],
    credibility: '基本可靠',
    verificationMethod: '需要与地方志和遗址资料交叉核验。',
    unverifiedPoints: ['月岩悟道的具体过程属于地方传说。'],
    knowledge_domain: 'core_china_culture',
    entry_role: 'core_entry',
    era: '宋',
    asset_usage: ['source_grounding', 'credibility_boundary'],
  };
}

function overlay(
  overrides: Partial<StoryKnowledgeEvidenceOverlayV1> = {},
): StoryKnowledgeEvidenceOverlayV1 {
  const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(legacyEntry()).contract;
  return {
    schema_version: 'story-knowledge-evidence-overlay/v1',
    overlay_id: 'zhou-yueyan-evidence-20260731',
    entry_name: contract.source_entry.name,
    source_reviews: [{
      source_ref_id: contract.sources[0]!.source_ref_id,
      grade: 'A',
      verification_status: 'human_verified',
      verified_at: REVIEWED_AT,
      note: '已由事实与文化审核角色核对来源。',
    }],
    claim_mappings: [{
      claim_id: contract.claims[0]!.claim_id,
      source_ref_ids: [contract.sources[0]!.source_ref_id],
      claim_type: 'critical_fact',
      certainty: 'verified',
      usage: 'fact',
      scope: '只确认人物时代与可核验生平，不确认月岩悟道细节。',
    }],
    signoff: {
      status: 'approved',
      reviewed_by: 'fact-reviewer-01',
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
    ...overrides,
  };
}

describe('story-knowledge-evidence-overlay/v1', () => {
  it('rejects duplicate stable references and a missing human signoff for fact promotion', () => {
    const approved = overlay();
    const duplicateSource = {
      ...approved,
      source_reviews: [approved.source_reviews[0], approved.source_reviews[0]],
    };
    const duplicateClaim = {
      ...approved,
      claim_mappings: [approved.claim_mappings[0], approved.claim_mappings[0]],
    };
    const unsignedPromotion = {
      ...approved,
      signoff: {
        status: 'pending',
        reason: '等待事实与文化审核。',
      },
    };

    expect(StoryKnowledgeEvidenceOverlayV1Schema.safeParse(duplicateSource).success).toBe(false);
    expect(StoryKnowledgeEvidenceOverlayV1Schema.safeParse(duplicateClaim).success).toBe(false);
    expect(StoryKnowledgeEvidenceOverlayV1Schema.safeParse(unsignedPromotion).success).toBe(false);
  });

  it('fails closed on entry, source and claim references that do not exist in the base contract', () => {
    const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(legacyEntry()).contract;

    expect(() => assembleStoryKnowledgeContractWithEvidenceOverlay(
      contract,
      overlay({ entry_name: '另一条目' }),
    )).toThrow(/entry_name/);
    expect(() => assembleStoryKnowledgeContractWithEvidenceOverlay(
      contract,
      overlay({
        source_reviews: [{
          ...overlay().source_reviews[0]!,
          source_ref_id: 'missing-source',
        }],
        claim_mappings: [],
      }),
    )).toThrow(/unknown source_ref_id: missing-source/);
    expect(() => assembleStoryKnowledgeContractWithEvidenceOverlay(
      contract,
      overlay({
        claim_mappings: [{
          ...overlay().claim_mappings[0]!,
          claim_id: 'missing-claim',
        }],
      }),
    )).toThrow(/unknown claim_id: missing-claim/);
  });

  it('keeps machine-proposed evidence bounded and cannot upgrade it into a critical fact', () => {
    const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(legacyEntry()).contract;
    const proposed: StoryKnowledgeEvidenceOverlayV1 = {
      ...overlay(),
      source_reviews: [{
        ...overlay().source_reviews[0]!,
        verification_status: 'machine_mapped',
        verified_at: undefined,
        note: '机器提出 A 级候选，等待人工确认。',
      }],
      claim_mappings: [{
        ...overlay().claim_mappings[0]!,
        claim_type: 'supporting_fact',
        certainty: 'probable',
        usage: 'bounded_context',
      }],
      signoff: {
        status: 'pending',
        reason: '等待事实与文化审核。',
      },
    };

    const assembled = assembleStoryKnowledgeContractWithEvidenceOverlay(contract, proposed);

    expect(assembled.contract.sources[0]).toMatchObject({
      grade: 'A',
      verification_status: 'machine_mapped',
    });
    expect(assembled.contract.claims[0]).toMatchObject({
      claim_type: 'supporting_fact',
      certainty: 'probable',
      usage: 'bounded_context',
    });
    expect(assembled.contract.boundary.critical_facts_can_be_asserted).toBe(false);
    expect(assembled.contract.missing_material.map(item => item.category))
      .toContain('authoritative_source');
  });

  it('assembles an approved human A/B mapping without mutating the base contract', () => {
    const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(legacyEntry()).contract;
    const before = structuredClone(contract);

    const assembled = assembleStoryKnowledgeContractWithEvidenceOverlay(contract, overlay());

    expect(contract).toEqual(before);
    expect(assembled).toMatchObject({
      schema_version: 'story-knowledge-evidence-overlay-assembly/v1',
      overlay_id: 'zhou-yueyan-evidence-20260731',
      entry_name: contract.source_entry.name,
      report: {
        source_review_count: 1,
        claim_mapping_count: 1,
        human_verified_source_count: 1,
        critical_fact_ready_count: 1,
      },
      boundary: {
        read_only_assembly: true,
        consumed_by_generation: false,
        source_markdown_writeback_allowed: false,
        existing_supplement_tasks_modified: false,
      },
    });
    expect(assembled.contract.claims[0]).toMatchObject({
      claim_type: 'critical_fact',
      certainty: 'verified',
      usage: 'fact',
      last_verified_at: REVIEWED_AT,
    });
    expect(assembled.contract.boundary).toMatchObject({
      critical_facts_can_be_asserted: true,
      human_review_complete: false,
    });
    expect(assembled.contract.missing_material.map(item => item.category))
      .not.toContain('authoritative_source');
    expect(Object.isFrozen(assembled)).toBe(true);
    expect(Object.isFrozen(assembled.contract.claims)).toBe(true);
  });

  it('projects remaining gaps to new read-only supplement tasks without persistence or old-task mutation', () => {
    const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(legacyEntry()).contract;
    const before = structuredClone(contract);

    const projection = projectStoryKnowledgeMissingMaterialToSupplementTasks(contract, {
      projectionId: 'zhou-yueyan-gap-projection',
      createdAt: REVIEWED_AT,
    });

    expect(contract).toEqual(before);
    expect(projection.task_count).toBe(contract.missing_material.length);
    expect(projection.tasks.every(task => (
      task.status === 'open'
      && task.source === 'story_knowledge_contract_missing_material'
      && task.created_at === REVIEWED_AT
    ))).toBe(true);
    expect(projection.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        need_id: 'story_knowledge_contract_legacy-authoritative-source',
        stage: 'minimum_viable_story',
        recommended_fields: expect.arrayContaining(['source_ref_id', 'source_grade']),
      }),
      expect.objectContaining({
        need_id: 'story_knowledge_contract_legacy-production-material',
        stage: 'production_ready',
      }),
    ]));
    expect(projection.boundary).toEqual({
      read_only_projection: true,
      persistence_allowed: false,
      existing_supplement_tasks_modified: false,
      generation_consumption_allowed: false,
    });
    expect(Object.isFrozen(projection.tasks)).toBe(true);
  });

  it('stays out of preparation, prompt, fallback and persistence paths', async () => {
    const [overlaySource, preparationSource, promptSource, documentSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-knowledge-evidence-overlay-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-generation-prompt.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-document-service.ts', import.meta.url), 'utf8'),
    ]);

    expect(overlaySource).toContain('persistence_allowed: false');
    expect(preparationSource).not.toContain('story-knowledge-evidence-overlay-service');
    expect(promptSource).not.toContain('StoryKnowledgeEvidenceOverlay');
    expect(documentSource).not.toContain('story-knowledge-evidence-overlay-service');
  });
});
