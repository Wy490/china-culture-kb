import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER } from '../src/services/writing-capability-adapter-service.js';
import {
  buildWritingCapabilityCanaryDecisionPackage,
  computeWritingCapabilityHumanReviewAttestationSha256,
  createWritingCapabilityHumanReviewBinding,
} from '../src/services/writing-capability-canary-decision-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  evaluateWritingCapabilityShadowDataset,
} from '../src/services/writing-capability-shadow-evaluation-service.js';
import { CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY } from '../src/services/writing-capability-rollout-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const dataset = JSON.parse(await readFile(resolve(repositoryRoot, 'data', 'fixtures',
  'story-agent-writing-capability-m2-shadow-evaluation-fixtures.json'), 'utf8')) as Record<string, any>;
const reportPath = resolve(repositoryRoot, 'data', 'reports',
  'story-agent-writing-capability-m2-canary-decision-baseline.json');
const evaluationBaselineSha256 = '11bb22166e2f652b2f311abb8bfc9ca05c15d86a66b570f85acca0f5c396365f';
const evaluation = evaluateWritingCapabilityShadowDataset({
  dataset,
  evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
});
const binding = createWritingCapabilityHumanReviewBinding({
  dataset, evaluation, evaluationBaselineSha256,
  evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
  adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
});
const intake: Record<string, any> = {
  schema_version: 'writing-capability-human-review-intake/v1',
  intake_id: 'short_drama_ai_comic_review_contract_probe_20260802',
  review_environment: 'verified_human',
  binding,
  reviewer: {
    reviewer_id: 'contract_probe_reviewer_001',
    display_name: '合同探针审核员（非真实人工信用）',
    role: 'screenwriter_editor',
    identity_record_id: 'contract-probe-only-001',
    actor_type: 'human', machine_generated: false,
    independent_from_machine_evaluator: true,
    reviewed_without_automated_approval: true,
  },
  sample_reviews: dataset.samples.map((sample: Record<string, any>) => ({
    sample_id: sample.sample_id,
    judgments: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY.human_review_checklist
      .map(item => ({ check_id: item.check_id, decision: 'pass',
        note: `合同探针覆盖 ${sample.sample_id}/${item.check_id}，不代表真实人工结论。` })),
  })),
  overall_recommendation: 'eligible',
  signed_at: '2026-08-02T16:00:00+08:00',
  expires_at: '2026-08-16T16:00:00+08:00',
  attestation_sha256: '0'.repeat(64),
  boundary: { evidence_only: true, activates_capability: false,
    counts_as_production_authorization: false, persistence_allowed: false, public_api_exposed: false },
};
intake.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(intake);
const decide = (review: Record<string, any>, decisionAt = '2026-08-02T16:30:00+08:00') => (
  buildWritingCapabilityCanaryDecisionPackage({
    dataset, evaluation, evaluationBaselineSha256,
    evaluationPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_EVALUATION_POLICY,
    adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    humanReviewIntake: review, decisionAt,
  })
);
const eligibleContractProbe = decide(intake);
const machine = structuredClone(intake);
machine.reviewer.actor_type = 'machine'; machine.reviewer.machine_generated = true;
machine.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(machine);
const missing = structuredClone(intake); missing.sample_reviews.pop();
missing.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(missing);
const drift = structuredClone(intake); drift.binding.dataset_sha256 = '0'.repeat(64);
drift.attestation_sha256 = computeWritingCapabilityHumanReviewAttestationSha256(drift);
const negativeProbes = [
  { probe_id: 'machine_self_sign', decision: decide(machine) },
  { probe_id: 'missing_sample_coverage', decision: decide(missing) },
  { probe_id: 'binding_hash_drift', decision: decide(drift) },
  { probe_id: 'expired_evidence', decision: decide(intake, '2026-08-17T00:00:00+08:00') },
];
const fingerprint = { binding, eligible_contract_probe: eligibleContractProbe, negative_probes: negativeProbes };
const baselineSha256 = createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex');
const invariants = {
  contract_probe_is_structurally_eligible: eligibleContractProbe.decision === 'eligible',
  contract_probe_is_not_real_human_credit: true,
  all_78_judgments_are_bound: eligibleContractProbe.summary.judgment_count === 78,
  all_13_samples_are_bound: eligibleContractProbe.summary.reviewed_sample_count === 13,
  all_negative_probes_are_blocked: negativeProbes.every(probe => probe.decision.decision === 'blocked'),
  eligible_does_not_allow_activation: !eligibleContractProbe.boundary.activation_allowed,
  capability_remains_disabled: !eligibleContractProbe.boundary.capability_enabled,
  canary_not_executed: !eligibleContractProbe.boundary.canary_executed,
  no_generation_effect: !eligibleContractProbe.boundary.affects_generation,
  no_persistence: !eligibleContractProbe.boundary.persistence_allowed,
  no_public_api: !eligibleContractProbe.boundary.public_api_exposed,
  no_third_party_execution: !eligibleContractProbe.boundary.third_party_code_executed,
};
const status = Object.values(invariants).every(Boolean) ? 'passed' : 'failed';
const report = {
  schema_version: 'writing-capability-canary-decision-baseline/v1',
  generated_at: '2026-08-02T16:30:00+08:00', status,
  synthetic_contract_probe_only: true, counts_as_real_human_review: false,
  sample_count: 13, checklist_count: 6, judgment_count: 78,
  negative_probe_count: negativeProbes.length,
  blocked_negative_probe_count: negativeProbes.filter(probe => probe.decision.decision === 'blocked').length,
  baseline_sha256: baselineSha256, binding,
  eligible_contract_probe: eligibleContractProbe, negative_probes: negativeProbes, invariants,
  boundary: { report_only: true, read_only: true, canary_executed: false,
    capability_enabled: false, activation_allowed: false, counts_as_production_authorization: false,
    affects_generation: false, persistence_allowed: false, public_api_exposed: false,
    third_party_code_executed: false },
};
await mkdir(resolve(repositoryRoot, 'data', 'reports'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ schema_version: report.schema_version, status, report_path: reportPath,
  sample_count: 13, judgment_count: 78, negative_probe_count: negativeProbes.length,
  blocked_negative_probe_count: report.blocked_negative_probe_count,
  baseline_sha256: baselineSha256, decision: eligibleContractProbe.decision,
  synthetic_contract_probe_only: true, counts_as_real_human_review: false, invariants, boundary: report.boundary }, null, 2));
if (status === 'failed') process.exitCode = 1;
