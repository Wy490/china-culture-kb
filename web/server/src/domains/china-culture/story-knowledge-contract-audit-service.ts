import type {
  EntryDetail,
  StoryKnowledgeMissingMaterialCategoryV1,
} from '@shared/types.js';
import { adaptLegacyChinaCultureEntryToStoryKnowledgeContract } from './story-knowledge-contract-service.js';
import {
  convertChinaCultureFullEntryDetail,
  parseChinaCultureEntries,
  parseChinaCultureFullEntry,
  readAllChinaCultureProvinceFiles,
} from './knowledge-source-adapter.js';

const MISSING_CATEGORIES: StoryKnowledgeMissingMaterialCategoryV1[] = [
  'claim_level_source_mapping',
  'authoritative_source',
  'creative_affordance',
  'production_material',
  'rights_clearance',
];

export interface StoryKnowledgeContractMigrationAuditV1 {
  schema_version: 'story-knowledge-contract-migration-audit/v1';
  generated_at: string;
  status: 'ready_for_human_enrichment' | 'blocked';
  totals: {
    entry_count: number;
    valid_contract_count: number;
    invalid_contract_count: number;
    source_count: number;
    ungraded_source_count: number;
    claim_count: number;
    blocked_claim_count: number;
    critical_fact_ready_count: number;
    missing_material_count: number;
  };
  missing_category_counts: Record<StoryKnowledgeMissingMaterialCategoryV1, number>;
  invariants: {
    every_entry_preserved: boolean;
    every_contract_valid: boolean;
    no_critical_fact_auto_assertion: boolean;
  };
  invalid_entries: Array<{
    entry_name: string;
    reason: string;
  }>;
  boundary: {
    report_only: true;
    consumed_by_generation: false;
    source_markdown_writeback_allowed: false;
    human_review_complete: false;
  };
}

export function auditLegacyChinaCultureStoryKnowledgeContracts(
  entries: readonly EntryDetail[],
  generatedAt = new Date().toISOString(),
): StoryKnowledgeContractMigrationAuditV1 {
  const missingCategoryCounts = Object.fromEntries(
    MISSING_CATEGORIES.map(category => [category, 0]),
  ) as Record<StoryKnowledgeMissingMaterialCategoryV1, number>;
  const invalidEntries: StoryKnowledgeContractMigrationAuditV1['invalid_entries'] = [];
  let sourceCount = 0;
  let ungradedSourceCount = 0;
  let claimCount = 0;
  let blockedClaimCount = 0;
  let criticalFactReadyCount = 0;
  let missingMaterialCount = 0;
  let preservedEntryCount = 0;

  for (const entry of entries) {
    try {
      const adapted = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(entry);
      if (JSON.stringify(adapted.legacy_entry_snapshot) === JSON.stringify(entry)) {
        preservedEntryCount += 1;
      }
      sourceCount += adapted.mapping_report.source_count;
      ungradedSourceCount += adapted.mapping_report.ungraded_source_count;
      claimCount += adapted.mapping_report.claim_count;
      criticalFactReadyCount += adapted.mapping_report.critical_fact_ready_count;
      blockedClaimCount += adapted.contract.claims.filter(claim => claim.usage === 'blocked').length;
      missingMaterialCount += adapted.mapping_report.missing_material_count;
      for (const item of adapted.contract.missing_material) {
        missingCategoryCounts[item.category] += 1;
      }
    } catch (error) {
      invalidEntries.push({
        entry_name: entry.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const validContractCount = entries.length - invalidEntries.length;
  const invariants = {
    every_entry_preserved: preservedEntryCount === entries.length,
    every_contract_valid: invalidEntries.length === 0,
    no_critical_fact_auto_assertion: criticalFactReadyCount === 0,
  };
  return {
    schema_version: 'story-knowledge-contract-migration-audit/v1',
    generated_at: generatedAt,
    status: Object.values(invariants).every(Boolean)
      ? 'ready_for_human_enrichment'
      : 'blocked',
    totals: {
      entry_count: entries.length,
      valid_contract_count: validContractCount,
      invalid_contract_count: invalidEntries.length,
      source_count: sourceCount,
      ungraded_source_count: ungradedSourceCount,
      claim_count: claimCount,
      blocked_claim_count: blockedClaimCount,
      critical_fact_ready_count: criticalFactReadyCount,
      missing_material_count: missingMaterialCount,
    },
    missing_category_counts: missingCategoryCounts,
    invariants,
    invalid_entries: invalidEntries,
    boundary: {
      report_only: true,
      consumed_by_generation: false,
      source_markdown_writeback_allowed: false,
      human_review_complete: false,
    },
  };
}

export async function buildChinaCultureStoryKnowledgeContractMigrationAudit(
  generatedAt = new Date().toISOString(),
): Promise<StoryKnowledgeContractMigrationAuditV1> {
  const provinceFiles = await readAllChinaCultureProvinceFiles();
  const entries: EntryDetail[] = [];
  for (const [provinceName, content] of provinceFiles) {
    for (const summary of parseChinaCultureEntries(content, provinceName)) {
      const detail = parseChinaCultureFullEntry(content, summary.name);
      if (!detail) continue;
      entries.push(convertChinaCultureFullEntryDetail(detail));
    }
  }
  return auditLegacyChinaCultureStoryKnowledgeContracts(entries, generatedAt);
}
