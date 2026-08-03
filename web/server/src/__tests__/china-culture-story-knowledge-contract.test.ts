import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { StoryKnowledgeContractV1Schema } from '@shared/schemas.js';
import type {
  EntryDetail,
  StoryKnowledgeContractV1,
} from '@shared/types.js';
import {
  adaptLegacyChinaCultureEntryToStoryKnowledgeContract,
} from '../domains/china-culture/story-knowledge-contract-service.js';
import {
  auditLegacyChinaCultureStoryKnowledgeContracts,
} from '../domains/china-culture/story-knowledge-contract-audit-service.js';

function legacyEntry(overrides: Partial<EntryDetail> = {}): EntryDetail {
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
    localCreativeRelations: [{
      relation_type: 'do_not_write_as',
      target: '月岩悟道',
      description: '不得直接写成已有一手史料确认的精确事件。',
    }],
    keywords: ['周敦颐', '宋代', '月岩洞'],
    sources: ['地方志来源线索'],
    credibility: '基本可靠',
    verificationMethod: '需要与地方志和遗址资料交叉核验。',
    unverifiedPoints: ['月岩悟道的具体过程属于地方传说。'],
    knowledge_domain: 'core_china_culture',
    entry_role: 'core_entry',
    era: '宋',
    asset_usage: ['source_grounding', 'credibility_boundary'],
    asset_split: {
      characters: ['宋代士人'],
      scenes: ['月岩洞'],
      character_props: ['书卷'],
      scene_props: ['岩壁', '石阶'],
    },
    ...overrides,
  };
}

describe('story-knowledge-contract/v1', () => {
  it('fails closed when a critical fact lacks a human-verified A/B source', () => {
    const adapted = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(legacyEntry());
    const contract: StoryKnowledgeContractV1 = structuredClone(adapted.contract);
    contract.claims[0] = {
      ...contract.claims[0],
      claim_type: 'critical_fact',
      certainty: 'verified',
      usage: 'fact',
    };
    contract.boundary.critical_facts_can_be_asserted = true;

    const result = StoryKnowledgeContractV1Schema.safeParse(contract);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => (
        issue.message.includes('human-verified A/B source')
      ))).toBe(true);
    }
  });

  it('accepts a critical fact only when its claim-level source is human-verified A/B', () => {
    const adapted = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(legacyEntry());
    const contract: StoryKnowledgeContractV1 = structuredClone(adapted.contract);
    contract.sources[0] = {
      ...contract.sources[0],
      grade: 'A',
      verification_status: 'human_verified',
      verified_at: '2026-07-31T00:00:00+08:00',
    };
    contract.claims[0] = {
      ...contract.claims[0],
      claim_type: 'critical_fact',
      certainty: 'verified',
      usage: 'fact',
    };
    contract.boundary.critical_facts_can_be_asserted = true;

    expect(StoryKnowledgeContractV1Schema.safeParse(contract).success).toBe(true);
  });

  it('preserves the legacy entry and maps ungraded evidence, disputes and assets without invention', () => {
    const entry = legacyEntry();
    const adapted = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(entry);

    expect(adapted).toMatchObject({
      schema_version: 'legacy-entry-story-knowledge-contract-adapter/v1',
      contract: {
        schema_version: 'story-knowledge-contract/v1',
        source_entry: {
          name: entry.name,
          source_domain: 'china_culture',
        },
        sources: [{
          citation: '地方志来源线索',
          grade: 'ungraded',
          verification_status: 'legacy_unmapped',
        }],
        boundary: {
          legacy_adapter: true,
          consumed_by_generation: false,
          generated_content_writeback_allowed: false,
          critical_facts_can_be_asserted: false,
          machine_validation_only: true,
          human_review_complete: false,
        },
      },
      mapping_report: {
        source_count: 1,
        ungraded_source_count: 1,
        critical_fact_ready_count: 0,
      },
    });
    expect(adapted.legacy_entry_snapshot).toEqual(entry);
    expect(adapted.legacy_entry_snapshot).not.toBe(entry);
    expect(Object.isFrozen(adapted)).toBe(true);
    expect(Object.isFrozen(adapted.legacy_entry_snapshot.sources)).toBe(true);
    expect(adapted.contract.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        claim_type: 'supporting_fact',
        usage: 'bounded_context',
      }),
      expect.objectContaining({
        claim_type: 'disputed_or_unknown',
        certainty: 'unverified',
        usage: 'blocked',
      }),
    ]));
    expect(adapted.contract.creative_affordance.forbidden_dramatization)
      .toContain('不得直接写成已有一手史料确认的精确事件。');
    expect(adapted.contract.production_material).toMatchObject({
      characters: ['宋代士人'],
      spaces_and_routes: expect.arrayContaining([
        '月岩洞',
        '月岩洞：天然岩洞与地方传说场所。',
      ]),
      props: ['书卷', '岩壁', '石阶'],
    });
    expect(adapted.contract.missing_material.map(item => item.category)).toEqual(
      expect.arrayContaining([
        'claim_level_source_mapping',
        'authoritative_source',
        'creative_affordance',
        'rights_clearance',
      ]),
    );
    expect(StoryKnowledgeContractV1Schema.safeParse(adapted.contract).success).toBe(true);
  });

  it('does not mutate the source entry or enter the generation chain', async () => {
    const entry = legacyEntry();
    const before = structuredClone(entry);
    adaptLegacyChinaCultureEntryToStoryKnowledgeContract(entry);

    expect(entry).toEqual(before);

    const [contractSource, preparationSource, promptSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-knowledge-contract-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-generation-prompt.ts', import.meta.url), 'utf8'),
    ]);
    expect(contractSource).toContain('StoryKnowledgeContractV1Schema.parse');
    expect(preparationSource).not.toContain('story-knowledge-contract-service');
    expect(promptSource).not.toContain('StoryKnowledgeContractV1');
  });

  it('builds a bounded read-only migration audit without claiming human readiness', () => {
    const report = auditLegacyChinaCultureStoryKnowledgeContracts([
      legacyEntry(),
      legacyEntry({
        name: '柳毅传书',
        type: '民间故事',
        summary: '唐传奇中的龙女传说。',
        sources: [],
        unverifiedPoints: ['不同版本的叙事细节存在差异。'],
        asset_split: undefined,
      }),
    ], '2026-07-31T00:00:00+08:00');

    expect(report).toMatchObject({
      schema_version: 'story-knowledge-contract-migration-audit/v1',
      generated_at: '2026-07-31T00:00:00+08:00',
      status: 'ready_for_human_enrichment',
      totals: {
        entry_count: 2,
        valid_contract_count: 2,
        invalid_contract_count: 0,
        critical_fact_ready_count: 0,
      },
      invariants: {
        every_entry_preserved: true,
        every_contract_valid: true,
        no_critical_fact_auto_assertion: true,
      },
      boundary: {
        report_only: true,
        consumed_by_generation: false,
        source_markdown_writeback_allowed: false,
        human_review_complete: false,
      },
    });
    expect(report.missing_category_counts.claim_level_source_mapping).toBe(2);
    expect(report.missing_category_counts.authoritative_source).toBe(2);
    expect(report.invalid_entries).toEqual([]);
  });
});
