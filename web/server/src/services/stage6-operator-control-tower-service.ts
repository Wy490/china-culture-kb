import type {
  Stage6ExitAuditProjectResult,
  Stage6OperatorControlTowerProject,
  Stage6OperatorControlTowerReport,
  Stage6OperatorRequirementCategory,
  Stage6RevisionWorkspaceProjectSummary,
} from '@shared/types.js';
import { stage6CanonicalSha256 } from './professional-multi-round-revision-intake-service.js';
import { buildStage6RealRevisionExitAudit } from './stage6-real-revision-exit-audit-service.js';
import { getStage6RevisionWorkspacePortfolio } from './stage6-revision-workspace-service.js';

function requirementCategory(code: string): Stage6OperatorRequirementCategory {
  if (code.includes('operator_')) return 'operator_identity';
  if (code.includes('initial_package') || code.includes('package_')) return 'initial_package';
  if (code.includes('authorization') || code.includes('authorized')) return 'authorization';
  if (code.includes('budget') || code.includes('cost_')) return 'budget';
  if (code.includes('reviewer')) return 'reviewers';
  if (code.includes('table_read') || code.includes('feedback')) return 'table_read';
  if (code.includes('real_project') || code.includes('provenance')) return 'real_project';
  if (code.includes('execution') || code.includes('round')) return 'revision_execution';
  return 'exit_evidence';
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function phaseFor(
  workspace: Stage6RevisionWorkspaceProjectSummary,
  audit: Stage6ExitAuditProjectResult,
): Stage6OperatorControlTowerProject['phase'] {
  if (workspace.readiness_status === 'blocked') return 'awaiting_real_input';
  if (workspace.execution_status === 'awaiting_round_1') return 'awaiting_round_1';
  if (workspace.execution_status === 'round_1_completed') return 'awaiting_round_2';
  if (audit.effective_open_feedback_count > 0) return 'awaiting_table_read_closure';
  if (!audit.stage6_exit_candidate) return 'awaiting_exit_evidence';
  return 'eligible_for_stage6_exit_review';
}

function nextAction(input: {
  phase: Stage6OperatorControlTowerProject['phase'];
  requirements: Stage6OperatorRequirementCategory[];
}): Stage6OperatorControlTowerProject['next_action'] {
  if (input.phase === 'awaiting_real_input') {
    if (input.requirements.includes('initial_package')) {
      return {
        code: 'prepare_and_inspect_initial_package',
        label: '准备可修订初始包，核对原文件 SHA-256 后再填写 intake',
        route: '/story/stage6-package-inspector',
        external_input_required: true,
      };
    }
    return {
      code: 'complete_operator_intake',
      label: '补齐真实项目、授权、预算、实名评审和桌读排期',
      route: '/story/stage6-intake',
      external_input_required: true,
    };
  }
  if (input.phase === 'awaiting_round_1' || input.phase === 'awaiting_round_2') {
    return {
      code: input.phase === 'awaiting_round_1' ? 'preflight_round_1' : 'preflight_round_2',
      label: input.phase === 'awaiting_round_1' ? '准备 Round 1 命令并运行只读预检' : '绑定 Round 1 包哈希并准备 Round 2 预检',
      route: '/story/stage6-preflight',
      external_input_required: true,
    };
  }
  if (input.phase === 'awaiting_table_read_closure') {
    return {
      code: 'close_verified_table_read_feedback',
      label: '由已核验评审者逐条处理并关闭桌读意见',
      route: '/story/stage6-revisions',
      external_input_required: true,
    };
  }
  if (input.phase === 'awaiting_exit_evidence') {
    return {
      code: 'repair_exit_evidence_chain',
      label: '按退出审计 blocker 修复证据链后重新审计',
      route: '/story/stage6-exit-audit',
      external_input_required: true,
    };
  }
  return {
    code: 'request_human_stage6_exit_review',
    label: '提交人工 Stage 6 退出复核；候选仍不等于专业通过',
    route: '/story/stage6-exit-audit',
    external_input_required: true,
  };
}

export async function getStage6OperatorControlTower(input: {
  repoRoot: string;
  now?: string;
}): Promise<Stage6OperatorControlTowerReport> {
  const now = input.now ?? new Date().toISOString();
  const [workspace, audit] = await Promise.all([
    getStage6RevisionWorkspacePortfolio({ repoRoot: input.repoRoot, now }),
    buildStage6RealRevisionExitAudit({ repoRoot: input.repoRoot, now }),
  ]);
  if (workspace.projects.length !== audit.projects.length) throw new Error('stage6_control_tower_project_count_mismatch');
  const projects = workspace.projects.map(workspaceProject => {
    const auditProject = audit.projects.find(item => item.benchmark_id === workspaceProject.benchmark_id);
    if (!auditProject) throw new Error(`stage6_control_tower_project_binding_missing:${workspaceProject.benchmark_id}`);
    const blockerCodes = unique(auditProject.blockers.map(item => item.code));
    const requirements = unique(blockerCodes.map(requirementCategory));
    const phase = phaseFor(workspaceProject, auditProject);
    return {
      benchmark_id: workspaceProject.benchmark_id,
      video_type: workspaceProject.video_type,
      source_entry: workspaceProject.source_entry,
      real_project_id: workspaceProject.real_project_id,
      phase,
      readiness_status: workspaceProject.readiness_status,
      execution_status: workspaceProject.execution_status,
      exit_audit_status: auditProject.status,
      recorded_round_count: auditProject.recorded_round_count,
      verified_real_revision_round_count: auditProject.verified_real_revision_round_count,
      effective_open_feedback_count: auditProject.effective_open_feedback_count,
      stage6_exit_candidate: auditProject.stage6_exit_candidate,
      professional_passed: false,
      requirement_categories: requirements,
      blocker_codes: blockerCodes,
      blocking_evidence_paths: unique(auditProject.blockers.map(item => item.detail)),
      next_action: nextAction({ phase, requirements }),
    } satisfies Stage6OperatorControlTowerProject;
  });
  const source = {
    source_readiness_canonical_sha256: audit.source_readiness_canonical_sha256,
    source_intake_canonical_sha256: audit.source_intake_canonical_sha256,
    source_registry_canonical_sha256: audit.source_registry_canonical_sha256,
    projects,
  };
  const p0ReadyCount = projects.filter(project => project.readiness_status === 'ready').length;
  const twoRoundCount = projects.filter(project => project.recorded_round_count === 2).length;
  const exitCandidateCount = projects.filter(project => project.stage6_exit_candidate).length;
  return {
    schema_version: 'story-agent-stage6-operator-control-tower/v1',
    generated_at: now,
    handoff_canonical_sha256: stage6CanonicalSha256(source),
    ...source,
    policy: {
      read_only: true,
      handoff_package_persisted: false,
      handoff_generation_is_external_input_completion: false,
      execute_endpoint_available: false,
      fixture_simulation_fallback_prepared_counts_as_real_revision: false,
      exit_candidate_counts_as_professional_pass: false,
    },
    summary: {
      project_count: projects.length,
      external_handoff_project_count: projects.filter(project => project.next_action.external_input_required).length,
      p0_ready_project_count: p0ReadyCount,
      blocked_project_count: projects.filter(project => project.readiness_status === 'blocked').length,
      planned_revision_round_count: 30,
      recorded_revision_round_count: projects.reduce((sum, project) => sum + project.recorded_round_count, 0),
      verified_real_revision_round_count: projects.reduce((sum, project) => sum + project.verified_real_revision_round_count, 0),
      effective_open_feedback_count: projects.reduce((sum, project) => sum + project.effective_open_feedback_count, 0),
      exit_review_candidate_project_count: exitCandidateCount,
      professional_pass_count: 0,
    },
    lanes: [
      { lane_id: 'package_inspection', label: '初始包检查', status: p0ReadyCount > 0 ? 'ready_for_operator' : 'blocked', completed_count: p0ReadyCount, target_count: 15, route: '/story/stage6-package-inspector', credit_granted: false },
      { lane_id: 'operator_intake', label: 'P0 真实输入', status: p0ReadyCount === 15 ? 'complete' : 'blocked', completed_count: p0ReadyCount, target_count: 15, route: '/story/stage6-intake', credit_granted: false },
      { lane_id: 'revision_execution', label: 'P1 真实修订', status: workspace.summary.verified_real_revision_round_count === 30 ? 'complete' : 'blocked', completed_count: workspace.summary.verified_real_revision_round_count, target_count: 30, route: '/story/stage6-preflight', credit_granted: false },
      { lane_id: 'table_read_and_versions', label: '桌读与版本', status: twoRoundCount === 15 ? 'ready_for_operator' : 'blocked', completed_count: twoRoundCount, target_count: 15, route: '/story/stage6-revisions', credit_granted: false },
      { lane_id: 'exit_audit', label: 'P3 退出审计', status: exitCandidateCount === 15 ? 'ready_for_operator' : 'blocked', completed_count: exitCandidateCount, target_count: 15, route: '/story/stage6-exit-audit', credit_granted: false },
    ],
    projects,
  };
}
