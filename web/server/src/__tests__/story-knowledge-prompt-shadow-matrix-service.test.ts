import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildStoryKnowledgePromptShadowMatrixReport,
} from '../domains/china-culture/story-knowledge-prompt-shadow-matrix-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..', '..');

describe('story knowledge prompt shadow matrix', () => {
  it('keeps unsafe overlays out and proves the active prompt and story stay unchanged', async () => {
    const originalKbRoot = process.env.KB_ROOT;
    process.env.KB_ROOT = resolve(repositoryRoot, 'data');
    try {
      const report = await buildStoryKnowledgePromptShadowMatrixReport();

      expect(report).toMatchObject({
        schema_version: 'story-knowledge-prompt-shadow-matrix/v1',
        status: 'passed',
        summary: {
          case_count: 7,
          candidate_ready_count: 1,
          blocked_count: 2,
          safe_no_candidate_count: 4,
          active_prompt_match_count: 7,
          generation_story_match_count: 7,
          shadow_prompt_created_count: 1,
          shadow_prompt_executed_count: 0,
        },
        gate_checks: {
          expected_case_count: true,
          only_approved_authoritative_multi_source_case_ready: true,
          machine_only_and_doubtful_cases_blocked: true,
          mixed_certainty_pending_rejected_and_incompatible_have_no_candidate: true,
          active_prompt_unchanged_for_every_case: true,
          generation_story_unchanged_for_every_case: true,
          no_shadow_prompt_executed_or_persisted: true,
        },
        boundary: {
          synthetic_overlay_matrix: true,
          active_prompt_sent_to_adapter_only: true,
          shadow_prompt_execution_allowed: false,
          shadow_prompt_persistence_allowed: false,
          source_markdown_written: false,
          external_model_called: false,
          human_review_complete: false,
          real_human_review_credit_granted: false,
          production_credit_granted: false,
        },
      });
      expect(report.cases.find(item => item.case_id === 'approved_multi_source'))
        .toMatchObject({
          comparison_status: 'candidate_ready',
          fact_candidate_count: 1,
          changed_generation_input_paths: ['material_pack.verified_facts'],
          changed_prompt_package_paths: [
            'material_pack.verified_facts',
            'user_prompt',
          ],
          issues: [],
        });
      expect(report.cases.find(item => item.case_id === 'approved_machine_only'))
        .toMatchObject({
          comparison_status: 'blocked',
          issues: expect.arrayContaining([
            'machine_only_source_promoted_to_fact',
            'non_authoritative_source_promoted_to_fact',
          ]),
        });
      expect(report.cases.find(item => item.case_id === 'approved_mixed_certainty'))
        .toMatchObject({
          preparation_status: 'overlay_incompatible',
          comparison_status: 'safe_no_candidate',
          preparation_issues: expect.arrayContaining([
            expect.stringContaining('fact usage requires verified certainty'),
          ]),
          issues: [],
        });
      expect(report.cases.find(item => item.case_id === 'approved_doubtful_entry'))
        .toMatchObject({
          comparison_status: 'blocked',
          issues: ['doubtful_entry_promoted_to_fact'],
        });
    } finally {
      if (originalKbRoot === undefined) delete process.env.KB_ROOT;
      else process.env.KB_ROOT = originalKbRoot;
    }
  });
});
