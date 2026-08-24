import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildStoryKnowledgePromptShadowCanaryDecisionAuditReport,
} from '../domains/china-culture/story-knowledge-prompt-shadow-canary-decision-audit-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..', '..');

describe('story knowledge prompt shadow canary decision audit', () => {
  it('binds seven read-only canary cases and keeps formal consumption closed', async () => {
    const originalKbRoot = process.env.KB_ROOT;
    process.env.KB_ROOT = resolve(repositoryRoot, 'data');
    try {
      const report = await buildStoryKnowledgePromptShadowCanaryDecisionAuditReport();

      expect(report).toMatchObject({
        schema_version: 'story-knowledge-prompt-shadow-canary-decision-audit/v1',
        status: 'passed',
        summary: {
          case_count: 7,
          eligible_for_operator_review_count: 1,
          remain_shadow_count: 6,
          candidate_ready_count: 1,
          blocked_count: 1,
          safe_no_candidate_count: 5,
          valid_binding_count: 7,
          formal_consumption_allowed_count: 0,
          adapter_invoked_count: 0,
          persistence_performed_count: 0,
        },
        gate_checks: {
          expected_case_count: true,
          only_approved_authoritative_multi_source_is_operator_review_eligible: true,
          every_receipt_binding_is_valid: true,
          every_case_keeps_formal_consumption_closed: true,
          no_adapter_or_persistence_performed: true,
        },
        boundary: {
          synthetic_fixture_audit: true,
          read_only_canary_only: true,
          prompt_text_returned: false,
          story_result_returned: false,
          source_markdown_written: false,
          external_model_called: false,
          human_review_complete: false,
          real_human_review_credit_granted: false,
          production_canary_executed: false,
          production_credit_granted: false,
        },
      });
      expect(report.cases.find(item => item.case_id === 'approved_multi_source'))
        .toMatchObject({
          decision: 'eligible_for_operator_review',
          prompt_shadow_status: 'candidate_ready',
          binding_valid: true,
        });
      expect(report.cases.find(item => item.case_id === 'base_contract_only'))
        .toMatchObject({
          decision: 'remain_shadow',
          prompt_shadow_status: 'safe_no_candidate',
          binding_valid: true,
        });
      expect(report.cases.every(item => item.formal_consumption_allowed === false))
        .toBe(true);
    } finally {
      if (originalKbRoot === undefined) delete process.env.KB_ROOT;
      else process.env.KB_ROOT = originalKbRoot;
    }
  });
});
