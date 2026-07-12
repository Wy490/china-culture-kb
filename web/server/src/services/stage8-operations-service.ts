import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type {
  Stage8OperationsNextActionCode,
  Stage8OperationsPhase,
  Stage8OperationsProject,
  Stage8OperationsReport,
} from '@shared/types.js';
import { stage8BlindReviewCanonicalSha256, getStage8BlindReviewWorkspace } from './stage8-blind-review-intake-service.js';
import { getStage8BlindReviewEvaluatorReadiness } from './stage8-blind-review-evaluator-service.js';
import { getStage8BlindReviewSignatureWorkspace } from './stage8-blind-review-signature-service.js';
import { getStage8FinalizationPreflightWorkspace } from './stage8-finalization-preflight-service.js';
import { getStage8DurableReleaseWorkspace } from './stage8-durable-release-service.js';

const SOURCE_PATHS = [
  'data/reports/story-agent-stage8-blind-review-readiness.json',
  'data/reports/story-agent-stage8-blind-review-evaluator-readiness.json',
  'data/reports/story-agent-stage8-blind-review-signature-readiness.json',
  'data/reports/story-agent-stage8-finalization-preflight-readiness.json',
  'data/reports/story-agent-stage8-durable-release-readiness.json',
] as const;

async function readRepositoryFile(repoRoot: string, relativePath: string): Promise<{ path: string; value: Record<string, unknown>; sha256: string }> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage8_operations_path_outside_repository');
  const raw = await readFile(resolved, 'utf8');
  return { path: relativePath, value: JSON.parse(raw) as Record<string, unknown>, sha256: createHash('sha256').update(raw, 'utf8').digest('hex') };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function count(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function resolveStage8OperationsPhase(checks: Stage8OperationsProject['checks']): Stage8OperationsPhase {
  if (!checks.blind_review_intake_ready) return 'awaiting_blind_review_intake';
  if (!checks.real_review_bundle_present) return 'awaiting_external_review_bundle';
  if (!checks.three_role_signature_verification_ready) return 'awaiting_three_role_signatures';
  if (!checks.finalization_candidate_ready) return 'awaiting_finalization_candidate';
  if (!checks.durable_release_verification_ready) return 'awaiting_durable_release_record';
  return 'awaiting_authorized_external_import';
}

export function resolveStage8OperationsNextAction(phase: Stage8OperationsPhase): Stage8OperationsProject['next_action'] {
  const definitions: Record<Stage8OperationsPhase, {
    code: Stage8OperationsNextActionCode;
    label: string;
    route: string;
    required_external_evidence: string[];
  }> = {
    awaiting_blind_review_intake: {
      code: 'complete_external_blind_review_intake',
      label: '补齐真实终稿、授权基准、匿名随机化、三角色实名评审与核验排期',
      route: '/story/stage8-blind-review-intake',
      required_external_evidence: ['verified_final_package', 'authorized_baseline', 'blind_randomization', 'three_independent_reviewers', 'verified_review_schedule'],
    },
    awaiting_external_review_bundle: {
      code: 'submit_external_human_review_bundle',
      label: '提交完整外部真人盲评bundle，运行片型权重与阈值评估',
      route: '/story/stage8-blind-review-intake',
      required_external_evidence: ['external_human_review_bundle', 'three_role_scores', 'baseline_comparison', 'production_advance_votes'],
    },
    awaiting_three_role_signatures: {
      code: 'complete_three_role_review_signatures',
      label: '由外部可信三角色分别签署当前review bundle与decision',
      route: '/story/stage8-blind-review-signature',
      required_external_evidence: ['active_reviewer_trust_policy', 'three_role_ed25519_attestations'],
    },
    awaiting_finalization_candidate: {
      code: 'assemble_finalization_candidate_evidence',
      label: '组装专业成品、真实修订增量、签名盲评和外部trust证据并运行finalization预检',
      route: '/story/stage8-finalization-preflight',
      required_external_evidence: ['professional_completion_artifacts', 'verified_revision_delta', 'signed_blind_review', 'external_verifier_trust'],
    },
    awaiting_durable_release_record: {
      code: 'obtain_independent_durable_signed_release',
      label: '由独立发布权限在外部创建并持久化durable signed-release record',
      route: '/story/stage8-durable-release-import',
      required_external_evidence: ['eligible_finalization_decision', 'immutable_artifact_manifest', 'external_release_authority', 'durable_signed_release_record'],
    },
    awaiting_authorized_external_import: {
      code: 'complete_authorized_external_release_import',
      label: '由授权外部系统导入已验证record并提供不可变导入回执',
      route: '/story/stage8-durable-release-import',
      required_external_evidence: ['verified_durable_release_record', 'authorized_external_import_receipt'],
    },
  };
  return { ...definitions[phase], external_input_required: true, counts_as_completion: false };
}

export async function getStage8Operations(input: { repoRoot: string; now?: string }): Promise<Stage8OperationsReport> {
  const now = input.now ?? new Date().toISOString();
  const [intake, evaluator, signature, finalization, durableRelease, sourceFiles] = await Promise.all([
    getStage8BlindReviewWorkspace({ repoRoot: input.repoRoot, now }),
    getStage8BlindReviewEvaluatorReadiness({ repoRoot: input.repoRoot, now }),
    getStage8BlindReviewSignatureWorkspace({ repoRoot: input.repoRoot, now }),
    getStage8FinalizationPreflightWorkspace({ repoRoot: input.repoRoot, now }),
    getStage8DurableReleaseWorkspace({ repoRoot: input.repoRoot, now }),
    Promise.all(SOURCE_PATHS.map(sourcePath => readRepositoryFile(input.repoRoot, sourcePath))),
  ]);
  const intakeReport = intake.template_validation.report;
  const projectCount = intakeReport.projects.length;
  if (projectCount !== 75
    || evaluator.video_types.length !== 15
    || signature.projects.length !== 75
    || finalization.projects.length !== 75
    || durableRelease.projects.length !== 75) {
    throw new Error('stage8_operations_project_or_video_type_count_drifted');
  }

  const sourceBindings = sourceFiles.map(file => ({ path: file.path, sha256: file.sha256 })).sort((left, right) => left.path.localeCompare(right.path));
  const sourceSummary = new Map(sourceFiles.map(file => [file.path, record(file.value.summary)]));
  if (count(sourceSummary.get(SOURCE_PATHS[0])?.project_count) !== intakeReport.summary.project_count
    || count(sourceSummary.get(SOURCE_PATHS[1])?.weight_contract_ready_count) !== evaluator.summary.weight_contract_ready_count
    || count(sourceSummary.get(SOURCE_PATHS[2])?.signature_verification_ready_project_count) !== signature.summary.signature_verification_ready_project_count
    || count(sourceSummary.get(SOURCE_PATHS[3])?.finalization_candidate_ready_project_count) !== finalization.summary.finalization_candidate_ready_project_count
    || count(sourceSummary.get(SOURCE_PATHS[4])?.durable_signed_release_imported_count) !== durableRelease.summary.durable_signed_release_imported_count) {
    throw new Error('stage8_operations_source_report_summary_drifted');
  }

  const signatureByBenchmark = new Map(signature.projects.map(project => [project.benchmark_id, project]));
  const finalizationByBenchmark = new Map(finalization.projects.map(project => [project.benchmark_id, project]));
  const durableByBenchmark = new Map(durableRelease.projects.map(project => [project.benchmark_id, project]));
  const evaluatorByVideoType = new Map(evaluator.video_types.map(item => [item.video_type, item]));
  const projects: Stage8OperationsProject[] = intakeReport.projects.map(intakeProject => {
    const signatureProject = signatureByBenchmark.get(intakeProject.benchmark_id);
    const finalizationProject = finalizationByBenchmark.get(intakeProject.benchmark_id);
    const durableProject = durableByBenchmark.get(intakeProject.benchmark_id);
    const evaluatorContract = evaluatorByVideoType.get(intakeProject.video_type);
    if (!signatureProject || !finalizationProject || !durableProject || !evaluatorContract) {
      throw new Error(`stage8_operations_project_binding_missing:${intakeProject.benchmark_id}`);
    }
    if (!evaluatorContract.evaluator_ready) {
      throw new Error(`stage8_operations_evaluator_contract_not_ready:${intakeProject.video_type}`);
    }
    const checks: Stage8OperationsProject['checks'] = {
      blind_review_intake_ready: intakeProject.status === 'ready_for_external_blind_review',
      evaluator_contract_ready: evaluatorContract.evaluator_ready,
      // Aggregate portfolio counts must never advance an individual benchmark. These stay
      // fail-closed until the upstream workspaces expose benchmark-bound verified evidence.
      real_review_bundle_present: false,
      three_role_signature_verification_ready: false,
      finalization_candidate_ready: finalizationProject.checks.finalization_candidate_ready,
      durable_release_verification_ready: false,
      durable_release_imported: durableProject.durable_signed_release_imported,
      human_blind_review_passed: false,
      professional_passed: false,
    };
    const phase = resolveStage8OperationsPhase(checks);
    return {
      benchmark_id: intakeProject.benchmark_id,
      video_type: intakeProject.video_type,
      source_entry: intakeProject.source_entry,
      phase,
      checks,
      blocker_codes: unique([
        ...intakeProject.blockers.map(item => item.code),
        ...(!checks.real_review_bundle_present ? ['real_external_review_bundle_missing'] : []),
        ...(!checks.three_role_signature_verification_ready ? ['three_role_signed_review_missing'] : []),
        ...(!checks.finalization_candidate_ready ? ['finalization_candidate_missing'] : []),
        ...(!checks.durable_release_verification_ready ? ['durable_release_record_verification_missing'] : []),
        ...(!checks.durable_release_imported ? ['authorized_external_release_import_missing'] : []),
      ]),
      next_action: resolveStage8OperationsNextAction(phase),
    };
  });
  if (new Set(projects.map(project => project.benchmark_id)).size !== 75) throw new Error('stage8_operations_project_identity_not_unique');
  if (projects.some(project => project.checks.human_blind_review_passed || project.checks.professional_passed || project.checks.durable_release_imported)) {
    throw new Error('stage8_operations_external_credit_baseline_changed_requires_review');
  }
  const tasks = projects.map(project => ({
    task_id: `stage8-${project.benchmark_id}-${project.next_action.code}`,
    benchmark_id: project.benchmark_id,
    video_type: project.video_type,
    source_entry: project.source_entry,
    phase: project.phase,
    next_action: project.next_action,
  }));
  if (new Set(tasks.map(task => task.task_id)).size !== 75) throw new Error('stage8_operations_task_identity_not_unique');
  const handoffCanonicalSha256 = stage8BlindReviewCanonicalSha256({ source_bindings: sourceBindings, tasks });
  const summary: Stage8OperationsReport['summary'] = {
    project_count: 75,
    external_handoff_project_count: 75,
    blind_review_intake_ready_project_count: projects.filter(project => project.checks.blind_review_intake_ready).length,
    evaluator_contract_ready_video_type_count: evaluator.summary.weight_contract_ready_count,
    real_review_bundle_count: 0,
    three_role_signature_ready_project_count: 0,
    finalization_candidate_ready_project_count: 0,
    durable_release_verification_ready_project_count: 0,
    durable_release_imported_count: 0,
    human_blind_review_pass_project_count: 0,
    professional_pass_count: 0,
  };
  return {
    schema_version: 'story-agent-stage8-operations/v1', generated_at: now, handoff_canonical_sha256: handoffCanonicalSha256,
    policy: { read_only: true, handoff_is_memory_only: true, handoff_is_external_completion: false,
      execute_or_import_endpoint_available: false, readiness_or_machine_threshold_can_skip_external_evidence: false,
      fixture_simulation_fallback_prepared_counts_as_real_review: false, signature_verification_is_real_signature_credit: false,
      finalization_candidate_is_signed_release: false, release_verification_is_durable_import: false,
      professional_pass_can_be_granted: false },
    summary,
    lanes: [
      { lane_id: 'blind_review_intake', label: '外部盲评接入', status: 'blocked_external_input', current_count: summary.blind_review_intake_ready_project_count,
        target_count: 75, blocker_count: 75 - summary.blind_review_intake_ready_project_count, route: '/story/stage8-blind-review-intake',
        next_action: '补齐终稿、授权基准、匿名随机化、三角色与排期', credit_granted: false },
      { lane_id: 'all_format_evaluator', label: '15片型评估器', status: 'contract_ready_waiting_external_input', current_count: summary.evaluator_contract_ready_video_type_count,
        target_count: 15, blocker_count: 75, route: '/story/stage8-blind-review-intake', next_action: '等待75项真实外部review bundle；合同ready不计真人通过', credit_granted: false },
      { lane_id: 'review_signatures', label: '三角色盲评签名', status: 'blocked_external_input', current_count: 0,
        target_count: 75, blocker_count: 75, route: '/story/stage8-blind-review-signature', next_action: '外部三角色使用可信key签署bundle与decision', credit_granted: false },
      { lane_id: 'finalization_candidate', label: 'Finalization Candidate', status: 'blocked_external_input', current_count: 0,
        target_count: 75, blocker_count: 75, route: '/story/stage8-finalization-preflight', next_action: '组装成品、修订增量、签名盲评与外部trust', credit_granted: false },
      { lane_id: 'durable_release', label: 'Durable Signed Release', status: 'blocked_external_input', current_count: 0,
        target_count: 75, blocker_count: 75, route: '/story/stage8-durable-release-import', next_action: '由独立发布权限创建持久化record后再做只读导入检查', credit_granted: false },
    ],
    projects,
    source_bindings: sourceBindings,
    handoff_package: {
      schema_version: 'story-agent-stage8-external-handoff/v1', generated_at: now, canonical_sha256: handoffCanonicalSha256,
      memory_only: true, persisted: false, execution_started: false, external_evidence_completed: false,
      human_blind_review_passed: false, durable_release_imported: false, professional_passed: false,
      source_bindings: sourceBindings, tasks,
    },
  };
}
