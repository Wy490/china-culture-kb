import { createHash } from 'node:crypto';
import type { StoryKnowledgeGenerationShadowV1 } from '@shared/types.js';
import { materialPackFromKnowledgePack } from '../../services/creation-contract-service.js';
import { buildChinaCultureSingleEntryKnowledgePack } from './story-knowledge-pack-service.js';
import { buildStoryKnowledgeGenerationShadow } from './story-knowledge-generation-shadow-service.js';
import {
  convertChinaCultureFullEntryDetail,
  parseChinaCultureEntries,
  parseChinaCultureFullEntry,
  readAllChinaCultureProvinceFiles,
} from './knowledge-source-adapter.js';
import { resolveStoryKnowledgePreparation } from './story-knowledge-preparation-service.js';

export interface StoryKnowledgeGenerationShadowAuditReportV1 {
  schema_version: 'story-knowledge-generation-shadow-audit/v1';
  corpus_sha256: string;
  status: 'passed' | 'needs_action';
  summary: {
    entry_count: number;
    source_count: number;
    ungraded_source_count: number;
    legacy_verified_fact_count: number;
    legacy_uncertain_claim_count: number;
    structured_fact_candidate_count: number;
    safe_no_fact_candidate_count: number;
    safe_fact_candidate_count: number;
    blocked_count: number;
    ungraded_source_promoted_to_fact_count: number;
    machine_only_source_promoted_to_fact_count: number;
    non_authoritative_source_promoted_to_fact_count: number;
    non_verified_claim_promoted_to_fact_count: number;
    blocked_claim_promoted_to_fact_count: number;
    doubtful_entry_promoted_to_fact_count: number;
    structured_fact_count_above_ready_count: number;
  };
  gate_checks: {
    corpus_nonempty: boolean;
    all_current_sources_remain_ungraded: boolean;
    no_structured_fact_candidates_without_overlay: boolean;
    no_fact_amplification: boolean;
    no_blocked_shadow: boolean;
    generation_output_unchanged: boolean;
  };
  entries: Array<{
    entry_name: string;
    province: string;
    credibility: string;
    status: 'safe_no_fact_candidates' | 'safe_fact_candidates' | 'blocked';
    source_count: number;
    ungraded_source_count: number;
    legacy_verified_fact_count: number;
    legacy_uncertain_claim_count: number;
    structured_fact_candidate_count: number;
    amplification_checks: StoryKnowledgeGenerationShadowV1['amplification_checks'];
    issues: string[];
  }>;
  boundary: {
    machine_evaluation_only: true;
    overlays_supplied: false;
    consumed_by_generation: false;
    generation_output_changed: false;
    source_markdown_written: false;
    human_review_complete: false;
    real_human_review_credit_granted: false;
    production_credit_granted: false;
  };
}

export async function buildStoryKnowledgeGenerationShadowAuditReport(): Promise<StoryKnowledgeGenerationShadowAuditReportV1> {
  const provinceFiles = await readAllChinaCultureProvinceFiles();
  const entries = [] as StoryKnowledgeGenerationShadowAuditReportV1['entries'];
  const corpusRecords: Array<Record<string, unknown>> = [];

  for (const [province, content] of provinceFiles) {
    for (const summary of parseChinaCultureEntries(content, province)) {
      const parsedDetail = parseChinaCultureFullEntry(content, summary.name);
      if (!parsedDetail) {
        throw new Error(`Unable to parse full entry for shadow audit: ${province}/${summary.name}`);
      }
      const entry = convertChinaCultureFullEntryDetail(parsedDetail);
      const preparation = resolveStoryKnowledgePreparation(entry);
      const knowledgePack = buildChinaCultureSingleEntryKnowledgePack(entry, {});
      const materialPack = materialPackFromKnowledgePack(knowledgePack);
      const shadow = buildStoryKnowledgeGenerationShadow({
        preparation,
        materialPack,
        entryCredibility: entry.credibility,
      });
      entries.push({
        entry_name: entry.name,
        province: entry.province,
        credibility: entry.credibility,
        status: shadow.status,
        source_count: shadow.contract_projection.source_count,
        ungraded_source_count: shadow.contract_projection.ungraded_source_count,
        legacy_verified_fact_count: shadow.legacy_material_projection.verified_fact_count,
        legacy_uncertain_claim_count: shadow.legacy_material_projection.uncertain_claim_count,
        structured_fact_candidate_count: shadow.contract_projection.fact_candidate_claim_ids.length,
        amplification_checks: { ...shadow.amplification_checks },
        issues: [...shadow.issues],
      });
      corpusRecords.push({
        name: entry.name,
        province: entry.province,
        credibility: entry.credibility,
        sources: entry.sources,
        unverified_points: entry.unverifiedPoints,
        contract: preparation.contract,
      });
    }
  }

  entries.sort(compareAuditEntry);
  corpusRecords.sort((left, right) => compareText(
    `${String(left.province)}/${String(left.name)}`,
    `${String(right.province)}/${String(right.name)}`,
  ));
  const summary = entries.reduce<StoryKnowledgeGenerationShadowAuditReportV1['summary']>(
    (result, entry) => ({
      entry_count: result.entry_count + 1,
      source_count: result.source_count + entry.source_count,
      ungraded_source_count: result.ungraded_source_count + entry.ungraded_source_count,
      legacy_verified_fact_count: result.legacy_verified_fact_count + entry.legacy_verified_fact_count,
      legacy_uncertain_claim_count: result.legacy_uncertain_claim_count + entry.legacy_uncertain_claim_count,
      structured_fact_candidate_count: result.structured_fact_candidate_count + entry.structured_fact_candidate_count,
      safe_no_fact_candidate_count: result.safe_no_fact_candidate_count + Number(entry.status === 'safe_no_fact_candidates'),
      safe_fact_candidate_count: result.safe_fact_candidate_count + Number(entry.status === 'safe_fact_candidates'),
      blocked_count: result.blocked_count + Number(entry.status === 'blocked'),
      ungraded_source_promoted_to_fact_count: result.ungraded_source_promoted_to_fact_count
        + entry.amplification_checks.ungraded_source_promoted_to_fact_count,
      machine_only_source_promoted_to_fact_count: result.machine_only_source_promoted_to_fact_count
        + entry.amplification_checks.machine_only_source_promoted_to_fact_count,
      non_authoritative_source_promoted_to_fact_count: result.non_authoritative_source_promoted_to_fact_count
        + entry.amplification_checks.non_authoritative_source_promoted_to_fact_count,
      non_verified_claim_promoted_to_fact_count: result.non_verified_claim_promoted_to_fact_count
        + entry.amplification_checks.non_verified_claim_promoted_to_fact_count,
      blocked_claim_promoted_to_fact_count: result.blocked_claim_promoted_to_fact_count
        + entry.amplification_checks.blocked_claim_promoted_to_fact_count,
      doubtful_entry_promoted_to_fact_count: result.doubtful_entry_promoted_to_fact_count
        + Number(entry.amplification_checks.doubtful_entry_promoted_to_fact),
      structured_fact_count_above_ready_count: result.structured_fact_count_above_ready_count
        + Number(!entry.amplification_checks.structured_fact_count_not_above_ready_count),
    }),
    emptySummary(),
  );
  const gateChecks = {
    corpus_nonempty: summary.entry_count > 0,
    all_current_sources_remain_ungraded: summary.source_count === summary.ungraded_source_count,
    no_structured_fact_candidates_without_overlay: summary.structured_fact_candidate_count === 0,
    no_fact_amplification: summary.ungraded_source_promoted_to_fact_count === 0
      && summary.machine_only_source_promoted_to_fact_count === 0
      && summary.non_authoritative_source_promoted_to_fact_count === 0
      && summary.non_verified_claim_promoted_to_fact_count === 0
      && summary.blocked_claim_promoted_to_fact_count === 0
      && summary.doubtful_entry_promoted_to_fact_count === 0
      && summary.structured_fact_count_above_ready_count === 0,
    no_blocked_shadow: summary.blocked_count === 0,
    generation_output_unchanged: true,
  };

  return {
    schema_version: 'story-knowledge-generation-shadow-audit/v1',
    corpus_sha256: sha256(JSON.stringify(corpusRecords)),
    status: Object.values(gateChecks).every(Boolean) ? 'passed' : 'needs_action',
    summary,
    gate_checks: gateChecks,
    entries,
    boundary: {
      machine_evaluation_only: true,
      overlays_supplied: false,
      consumed_by_generation: false,
      generation_output_changed: false,
      source_markdown_written: false,
      human_review_complete: false,
      real_human_review_credit_granted: false,
      production_credit_granted: false,
    },
  };
}

function emptySummary(): StoryKnowledgeGenerationShadowAuditReportV1['summary'] {
  return {
    entry_count: 0,
    source_count: 0,
    ungraded_source_count: 0,
    legacy_verified_fact_count: 0,
    legacy_uncertain_claim_count: 0,
    structured_fact_candidate_count: 0,
    safe_no_fact_candidate_count: 0,
    safe_fact_candidate_count: 0,
    blocked_count: 0,
    ungraded_source_promoted_to_fact_count: 0,
    machine_only_source_promoted_to_fact_count: 0,
    non_authoritative_source_promoted_to_fact_count: 0,
    non_verified_claim_promoted_to_fact_count: 0,
    blocked_claim_promoted_to_fact_count: 0,
    doubtful_entry_promoted_to_fact_count: 0,
    structured_fact_count_above_ready_count: 0,
  };
}

function compareAuditEntry(
  left: StoryKnowledgeGenerationShadowAuditReportV1['entries'][number],
  right: StoryKnowledgeGenerationShadowAuditReportV1['entries'][number],
): number {
  return compareText(`${left.province}/${left.entry_name}`, `${right.province}/${right.entry_name}`);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
