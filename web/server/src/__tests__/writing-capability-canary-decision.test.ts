import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
} from '../services/writing-capability-adapter-service.js';
import {
  WritingCapabilityCanaryDecisionPackageV1Schema,
  WritingCapabilityHumanReviewIntakeV1Schema,
  buildWritingCapabilityCanaryDecisionPackage,
  computeWritingCapabilityHumanReviewAttestationSha256,
  createWritingCapabilityHumanReviewBinding,
} from '../services/writing-capability-canary-decision-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  evaluateWritingCapabilityShadowDataset,
} from '../services/writing-capability-shadow-evaluation-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
} from '../services/writing-capability-rollout-service.js';

const EVALUATION_BASELINE_SHA256 = '11bb22166e2f652b2f311abb8bfc9ca05c15d86a66b570f85acca0f5c396365f';
const DECISION_AT = '2026-08-02T16:30:00+08:00';

async function loadDataset(): Promise<Record<string, any>> {
  return JSON.parse(await readFile(new URL(
    '../../../../data/fixtures/story-agent-writing-capability-m2-shadow-evaluation-fixtures.json',
    import.meta.url,
  ), 'utf8')) as Record<string, any>;
}

async function buildContext() {
  const dataset = await loadDataset();
  const evaluation = evaluateWritingCapabilityShadowDataset({
    dataset,
    evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
    adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  });
  const binding = createWritingCapabilityHumanReviewBinding({
    dataset,
    evaluation,
    evaluationBaselineSha256: EVALUATION_BASELINE_SHA256,
    evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
    adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  });
  const checklist = CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY
    .human_review_checklist;
  const intake: Record<string, any> = {
    schema_version: 'writing-capability-human-review-intake/v1',
    intake_id: 'short_drama_ai_comic_review_fixture_20260802',
    review_environment: 'verified_human',
    binding,
    reviewer: {
      reviewer_id: 'fixture_reviewer_001',
      display_name: '合同测试审核员',
      role: 'screenwriter_editor',
      identity_record_id: 'test-only-identity-record-001',
      actor_type: 'human',
      machine_generated: false,
      independent_from_machine_evaluator: true,
      reviewed_without_automated_approval: true,
    },
    sample_reviews: dataset.samples.map((sample: Record<string, any>) => ({
      sample_id: sample.sample_id,
      judgments: checklist.map(item => ({
        check_id: item.check_id,
        decision: 'pass',
        note: `合同测试：${sample.sample_id} 已覆盖 ${item.check_id}，不代表真实人工结论。`,
      })),
    })),
    overall_recommendation: 'eligible',
    signed_at: '2026-08-02T16:00:00+08:00',
    expires_at: '2026-08-16T16:00:00+08:00',
    attestation_sha256: '0'.repeat(64),
    boundary: {
      evidence_only: true,
      activates_capability: false,
      counts_as_production_authorization: false,
      persistence_allowed: false,
      public_api_exposed: false,
    },
  };
  intake.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(intake);
  return { dataset, evaluation, intake };
}

function decide(context: Awaited<ReturnType<typeof buildContext>>, intake = context.intake, decisionAt = DECISION_AT) {
  return buildWritingCapabilityCanaryDecisionPackage({
    dataset: context.dataset,
    evaluation: context.evaluation,
    evaluationBaselineSha256: EVALUATION_BASELINE_SHA256,
    evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
    adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    humanReviewIntake: intake,
    decisionAt,
  });
}

describe('writing capability human review intake and canary decision', () => {
  it('accepts a fully bound review contract fixture and emits read-only eligible', async () => {
    const context = await buildContext();
    expect(WritingCapabilityHumanReviewIntakeV1Schema.safeParse(context.intake).success).toBe(true);
    const decision = decide(context);

    expect(WritingCapabilityCanaryDecisionPackageV1Schema.safeParse(decision).success).toBe(true);
    expect(decision).toMatchObject({
      schema_version: 'writing-capability-canary-decision-package/v1',
      decision: 'eligible',
      blockers: [],
      summary: {
        reviewed_sample_count: 13,
        required_sample_count: 13,
        judgment_count: 78,
        passed_judgment_count: 78,
        failed_judgment_count: 0,
        reviewer_count: 1,
      },
      reviewer: {
        actor_type: 'human',
        machine_generated: false,
      },
      boundary: {
        read_only: true,
        canary_executed: false,
        capability_enabled: false,
        activation_allowed: false,
        counts_as_production_authorization: false,
        affects_generation: false,
        persistence_allowed: false,
        public_api_exposed: false,
      },
    });
    expect(decision.binding.evaluation_baseline_sha256).toBe(EVALUATION_BASELINE_SHA256);
    expect(decision.rollback_evidence).toMatchObject({
      rollback_id: 'disable-short-drama-ai-comic-shadow-v1',
      identity_verified: true,
      activation_performed: false,
      rollback_execution_required: false,
    });
    expect(Object.isFrozen(decision)).toBe(true);
  });

  it('blocks machine self-signing and contract-fixture environments', async () => {
    const context = await buildContext();
    const machine = structuredClone(context.intake);
    machine.reviewer.actor_type = 'machine';
    machine.reviewer.machine_generated = true;
    machine.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(machine);
    const contractFixture = structuredClone(context.intake);
    contractFixture.review_environment = 'contract_fixture';
    contractFixture.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(contractFixture);

    expect(decide(context, machine).blockers).toContain('machine_or_self_signed_review_forbidden');
    expect(decide(context, contractFixture).blockers).toContain('review_environment_not_verified_human');
    expect(decide(context, machine).decision).toBe('blocked');
    expect(decide(context, contractFixture).decision).toBe('blocked');
  });

  it('blocks missing sample/check coverage and any failed judgment', async () => {
    const context = await buildContext();
    const missingSample = structuredClone(context.intake);
    missingSample.sample_reviews.pop();
    missingSample.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(missingSample);
    const missingCheck = structuredClone(context.intake);
    missingCheck.sample_reviews[0].judgments.pop();
    missingCheck.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(missingCheck);
    const failed = structuredClone(context.intake);
    failed.sample_reviews[0].judgments[0].decision = 'fail';
    failed.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(failed);

    expect(decide(context, missingSample).blockers).toContain('sample_review_coverage_incomplete');
    expect(decide(context, missingCheck).blockers).toContain('checklist_coverage_incomplete');
    expect(decide(context, failed).blockers).toContain('human_judgment_failed');
  });

  it('blocks hash drift, invalid attestation, rollback drift, and expired evidence', async () => {
    const context = await buildContext();
    const hashDrift = structuredClone(context.intake);
    hashDrift.binding.dataset_sha256 = '0'.repeat(64);
    hashDrift.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(hashDrift);
    const badAttestation = structuredClone(context.intake);
    badAttestation.attestation_sha256 = 'f'.repeat(64);
    const rollbackDrift = structuredClone(context.intake);
    rollbackDrift.binding.rollback_id = 'different-rollback-v1';
    rollbackDrift.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(rollbackDrift);

    expect(decide(context, hashDrift).blockers).toContain('review_binding_mismatch');
    expect(decide(context, badAttestation).blockers).toContain('review_attestation_hash_mismatch');
    expect(decide(context, rollbackDrift).blockers).toContain('rollback_identity_mismatch');
    expect(decide(context, context.intake, '2026-08-17T00:00:00+08:00').blockers)
      .toContain('review_evidence_expired');
  });

  it('never lets recommendation override machine gate or evidence blockers', async () => {
    const context = await buildContext();
    const review = structuredClone(context.intake);
    review.sample_reviews.pop();
    review.overall_recommendation = 'eligible';
    review.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(review);
    const decision = decide(context, review);

    expect(decision.decision).toBe('blocked');
    expect(decision.boundary.activation_allowed).toBe(false);
    expect(decision.boundary.capability_enabled).toBe(false);
  });

  it('keeps decision code outside generation, prompt, fallback, quality, repair, and persistence', async () => {
    const sources = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-generation-prompt.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/dramatic-story.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/genre-quality-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/story-repair-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-document-service.ts', import.meta.url), 'utf8'),
    ]);
    for (const source of sources) {
      expect(source).not.toContain('WritingCapabilityCanaryDecision');
      expect(source).not.toContain('writing-capability-canary-decision-service');
    }
  });

  it('publishes a reproducible contract-only decision baseline', async () => {
    const report = JSON.parse(await readFile(new URL(
      '../../../../data/reports/story-agent-writing-capability-m2-canary-decision-baseline.json',
      import.meta.url,
    ), 'utf8')) as Record<string, unknown>;
    expect(report).toMatchObject({
      schema_version: 'writing-capability-canary-decision-baseline/v1',
      status: 'passed',
      synthetic_contract_probe_only: true,
      counts_as_real_human_review: false,
      sample_count: 13,
      judgment_count: 78,
      negative_probe_count: 4,
      blocked_negative_probe_count: 4,
      baseline_sha256: '3c2f03a8df3ac58bac69cce1331e0dbc86f1788f7b924a6124c223155272902a',
      eligible_contract_probe: {
        decision: 'eligible',
        boundary: {
          activation_allowed: false,
          capability_enabled: false,
          canary_executed: false,
        },
      },
    });
  });
});
