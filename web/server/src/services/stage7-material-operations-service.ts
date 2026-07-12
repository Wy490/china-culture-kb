import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { Stage7MaterialOperationsReport } from '@shared/types.js';
import { getStage7GoldenCardCandidateWorkspace } from './stage7-golden-card-candidate-service.js';
import { getStage7GoldenCardReviewWorkspace } from './stage7-golden-card-review-service.js';
import { getStage7GoldenCardReviewSignatureWorkspace } from './stage7-golden-card-review-signature-service.js';

const SOURCE_PATHS = {
  goldenIndex: 'data/production-cards/golden-card-unified-index.json',
  candidateReadiness: 'data/reports/story-agent-stage7-golden-card-candidate-readiness.json',
  domainCandidates: 'data/domain-packs/phase2-candidate-rule-packs.json',
  domainLedger: 'data/production-cards/domain-pack-review-evidence-ledger.json',
  domainPreSignature: 'data/production-cards/domain-pack-real-reviewer-submission-validation-fixtures-and-pre-signature-preflight.json',
  goldenTrustPolicy: 'data/professional-benchmarks/all-format-stage7-golden-card-review-trust-policy.json',
} as const;

async function readRepositoryFile(repoRoot: string, relativePath: string): Promise<{ path: string; raw: string; value: Record<string, unknown>; sha256: string }> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage7_material_operations_path_outside_repository');
  const raw = await readFile(resolved, 'utf8');
  return { path: relativePath, raw, value: JSON.parse(raw) as Record<string, unknown>, sha256: createHash('sha256').update(raw, 'utf8').digest('hex') };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function count(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function domainPriority(candidateId: string): 'p0' | 'p1' | 'p2' {
  if (/sensitive|medical|privacy/.test(candidateId)) return 'p0';
  if (/ethnic|revolutionary|documentary|heritage/.test(candidateId)) return 'p1';
  return 'p2';
}

export async function getStage7MaterialOperations(input: { repoRoot: string; now?: string }): Promise<Stage7MaterialOperationsReport> {
  const now = input.now ?? new Date().toISOString();
  const [review, candidate, signature, ...files] = await Promise.all([
    getStage7GoldenCardReviewWorkspace({ repoRoot: input.repoRoot, now }),
    getStage7GoldenCardCandidateWorkspace({ repoRoot: input.repoRoot, now }),
    getStage7GoldenCardReviewSignatureWorkspace({ repoRoot: input.repoRoot, now }),
    ...Object.values(SOURCE_PATHS).map(sourcePath => readRepositoryFile(input.repoRoot, sourcePath)),
  ]);
  const fileByPath = new Map(files.map(file => [file.path, file]));
  const domainCandidatesFile = fileByPath.get(SOURCE_PATHS.domainCandidates)!;
  const domainLedgerFile = fileByPath.get(SOURCE_PATHS.domainLedger)!;
  const domainPreSignatureFile = fileByPath.get(SOURCE_PATHS.domainPreSignature)!;
  const domainCandidates = Array.isArray(domainCandidatesFile.value.candidates)
    ? domainCandidatesFile.value.candidates.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>> : [];
  const ledgerCounts = record(domainLedgerFile.value.counts);
  const preSignatureCounts = record(domainPreSignatureFile.value.counts);
  const decisionLedger = Array.isArray(domainLedgerFile.value.human_review_decision_ledger)
    ? domainLedgerFile.value.human_review_decision_ledger.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>> : [];
  if (domainCandidates.length !== 9 || decisionLedger.length !== 9) throw new Error('stage7_domain_pack_candidate_or_ledger_count_drifted');

  const missingVideoTypes = candidate.video_types.filter(item => item.current_candidate_count === 0);
  const typeTasks: Stage7MaterialOperationsReport['tasks'] = missingVideoTypes.map(item => ({
    task_id: `stage7-type-${item.video_type}-candidate-content`,
    scope: 'video_type',
    target_id: item.video_type,
    label: `${item.label}：完成5张候选卡内容与来源证据`,
    priority: 'p1',
    next_action: 'complete_candidate_content_and_source_evidence',
    evidence_status: 'missing_external_input',
    counts_as_completion: false,
  }));
  const cardTasks: Stage7MaterialOperationsReport['tasks'] = review.cards.map(card => ({
    task_id: `stage7-card-${card.card_id}-external-review`,
    scope: 'golden_card',
    target_id: card.card_id,
    label: `${card.entry_name}：完成${card.required_roles.length}角色实名审稿`,
    priority: card.risk_tier,
    next_action: 'complete_external_role_reviews',
    evidence_status: 'missing_external_input',
    counts_as_completion: false,
  }));
  const domainTasks: Stage7MaterialOperationsReport['tasks'] = domainCandidates.map(item => {
    const candidateId = String(item.candidate_id ?? '');
    return {
      task_id: `stage7-domain-pack-${candidateId}-real-review`,
      scope: 'domain_pack' as const,
      target_id: candidateId,
      label: `${String(item.entry_name ?? candidateId)}：补齐真实证据槽位与真人审稿签名`,
      priority: domainPriority(candidateId),
      next_action: 'complete_real_domain_pack_evidence_and_review' as const,
      evidence_status: 'missing_external_input' as const,
      counts_as_completion: false as const,
    };
  });
  const tasks = [...typeTasks, ...cardTasks, ...domainTasks];
  if (tasks.length !== 51 || new Set(tasks.map(task => task.task_id)).size !== 51) throw new Error('stage7_material_operations_task_count_or_identity_invalid');

  const domainEvidenceCompleteCount = decisionLedger.filter(item => item.evidence_slots_complete === true).length;
  const domainApprovedCount = decisionLedger.filter(item => item.decision_status === 'approved' && item.real_reviewer_signed === true).length;
  const domainFormalPatchCount = count(ledgerCounts.formal_patch_count);
  const domainPreSignatureReadyCount = count(preSignatureCounts.pre_signature_ready_count);
  const domainRealSubmissionCount = count(preSignatureCounts.real_reviewer_submission_count);
  const domainRealSignatureCount = count(preSignatureCounts.real_signature_count);
  if ([domainEvidenceCompleteCount, domainApprovedCount, domainFormalPatchCount, domainPreSignatureReadyCount, domainRealSubmissionCount, domainRealSignatureCount].some(value => value !== 0)) {
    throw new Error('stage7_domain_pack_external_credit_baseline_changed_requires_review');
  }
  if (signature.trust_policy.trusted_signer_count !== 0) throw new Error('stage7_golden_reviewer_trust_baseline_changed_requires_review');
  const sourceBindings = files.map(file => ({ path: file.path, sha256: file.sha256 })).sort((left, right) => left.path.localeCompare(right.path));
  const summary: Stage7MaterialOperationsReport['summary'] = {
    golden_card_target_count: 75,
    golden_card_indexed_candidate_count: review.summary.indexed_candidate_card_count,
    golden_card_pending_human_review_count: review.summary.pending_human_review_card_count,
    golden_card_human_approved_count: 0,
    covered_video_type_count: candidate.summary.already_covered_video_type_count,
    missing_video_type_count: candidate.summary.missing_video_type_count,
    planned_candidate_slot_count: candidate.summary.planned_slot_count,
    authored_candidate_count: 0,
    golden_review_preflight_ready_count: 0,
    golden_signature_verification_ready_count: 0,
    trusted_golden_reviewer_signer_count: 0,
    domain_pack_candidate_count: domainCandidates.length,
    domain_pack_evidence_complete_count: 0,
    domain_pack_human_approved_count: 0,
    domain_pack_pre_signature_ready_count: 0,
    domain_pack_real_reviewer_submission_count: 0,
    domain_pack_real_signature_count: 0,
    domain_pack_formal_patch_count: 0,
    promoted_domain_pack_count: 0,
    external_handoff_task_count: tasks.length,
    professional_pass_count: 0,
  };
  return {
    schema_version: 'story-agent-stage7-material-operations/v1',
    generated_at: now,
    policy: {
      read_only: true,
      handoff_is_memory_only: true,
      handoff_is_external_completion: false,
      template_or_slot_counts_as_candidate: false,
      review_preflight_or_signature_fixture_counts_as_human_approval: false,
      simulation_counts_as_real_domain_pack_review: false,
      professional_pass_can_be_granted: false,
    },
    summary,
    lanes: [
      { lane_id: 'candidate_coverage', label: '15片型候选覆盖', status: 'blocked_external_input', current_count: summary.covered_video_type_count, target_count: 15, blocker_count: summary.missing_video_type_count, next_action: '由外部operator完成12片型60槽位内容与来源证据' },
      { lane_id: 'golden_review', label: '黄金卡真人审稿', status: 'blocked_external_input', current_count: summary.golden_card_human_approved_count, target_count: 75, blocker_count: 75, next_action: '先完成30张现有候选的风险角色实名审稿，并补齐其余45张候选' },
      { lane_id: 'golden_signature', label: '黄金卡审稿签名', status: 'blocked_external_input', current_count: summary.golden_signature_verification_ready_count, target_count: 75, blocker_count: 75, next_action: '外部建立trust policy并对通过预检的审稿payload签名' },
      { lane_id: 'domain_pack_review', label: 'Domain Pack真人审稿', status: 'blocked_external_input', current_count: summary.domain_pack_human_approved_count, target_count: 9, blocker_count: 9, next_action: '补齐9个候选包真实证据槽位、实名decision与签名' },
      { lane_id: 'domain_pack_promotion', label: 'Domain Pack正式晋升', status: 'blocked_external_input', current_count: summary.promoted_domain_pack_count, target_count: 9, blocker_count: 9, next_action: '仅在真实审稿与签名前置通过后人工生成并复核formal patch' },
    ],
    tasks,
    source_bindings: sourceBindings,
    handoff_package: {
      schema_version: 'story-agent-stage7-material-external-handoff/v1',
      generated_at: now,
      memory_only: true,
      persisted: false,
      execution_started: false,
      human_approval_granted: false,
      golden_card_promoted: false,
      domain_pack_promoted: false,
      professional_passed: false,
      source_bindings: sourceBindings,
      tasks,
    },
  };
}
