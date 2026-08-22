import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildStoryKnowledgeGenerationShadowAuditReport,
} from '../domains/china-culture/story-knowledge-generation-shadow-audit-service.js';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');

describe('story knowledge generation shadow audit', () => {
  it('keeps the current corpus out of structured fact consumption', async () => {
    const originalKbRoot = process.env.KB_ROOT;
    process.env.KB_ROOT = resolve(repositoryRoot, 'data');
    try {
      const report = await buildStoryKnowledgeGenerationShadowAuditReport();

      expect(report.schema_version).toBe('story-knowledge-generation-shadow-audit/v1');
      expect(report.corpus_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.status).toBe('passed');
      expect(report.summary).toMatchObject({
        entry_count: 289,
        source_count: 1043,
        ungraded_source_count: 1043,
        structured_fact_candidate_count: 0,
        safe_no_fact_candidate_count: 289,
        safe_fact_candidate_count: 0,
        blocked_count: 0,
        ungraded_source_promoted_to_fact_count: 0,
        machine_only_source_promoted_to_fact_count: 0,
        non_authoritative_source_promoted_to_fact_count: 0,
        non_verified_claim_promoted_to_fact_count: 0,
        blocked_claim_promoted_to_fact_count: 0,
        doubtful_entry_promoted_to_fact_count: 0,
        structured_fact_count_above_ready_count: 0,
      });
      expect(report.gate_checks).toEqual({
        corpus_nonempty: true,
        all_current_sources_remain_ungraded: true,
        no_structured_fact_candidates_without_overlay: true,
        no_fact_amplification: true,
        no_blocked_shadow: true,
        generation_output_unchanged: true,
      });
      expect(report.entries).toHaveLength(289);
      expect(report.entries.every(entry => (
        entry.status === 'safe_no_fact_candidates'
        && entry.structured_fact_candidate_count === 0
        && entry.issues.length === 0
      ))).toBe(true);
      expect(report.boundary).toEqual({
        machine_evaluation_only: true,
        overlays_supplied: false,
        consumed_by_generation: false,
        generation_output_changed: false,
        source_markdown_written: false,
        human_review_complete: false,
        real_human_review_credit_granted: false,
        production_credit_granted: false,
      });
    } finally {
      if (originalKbRoot === undefined) delete process.env.KB_ROOT;
      else process.env.KB_ROOT = originalKbRoot;
    }
  });
});
