import type {
  ProductionReadinessAutomationMode,
  ProductionReadinessAutomationPlan,
  ProductionReadinessAutomationRunner,
  ProductionReadinessAutomationStepStatus,
  ProductionReadinessIssue,
  ProductionReadinessNextAction,
  ProductionReadinessScope,
} from '@shared/types.js';

type AutomationPlanInput = {
  scope: ProductionReadinessScope;
  projectId: string;
  actions: ProductionReadinessNextAction[];
  issues: ProductionReadinessIssue[];
};

function actionApi(
  scope: ProductionReadinessScope,
  projectId: string,
  actionKey: string,
): { method: 'GET' | 'POST'; path: string } | undefined {
  if (scope === 'story_project') {
    const paths: Record<string, string> = {
      repair_quality: `/api/projects/${projectId}/repair-quality`,
      draft_production_material_fields: `/api/projects/${projectId}/supplement-tasks/draft-production-material`,
      repair_production_board: `/api/projects/${projectId}/production-board/repair-export`,
      draft_seedance_asset_placeholders: `/api/projects/${projectId}/production-board/seedance-assets/draft-placeholders`,
      export_production_board: `/api/projects/${projectId}/production-board/export`,
      export_retry_package: `/api/projects/${projectId}/production-board/export-seedance-retry-package`,
      submit_gears_jobs: `/api/projects/${projectId}/production-board/gears-jobs/submit`,
      sync_gears_jobs: `/api/projects/${projectId}/production-board/gears-jobs/sync`,
      accept_local_gears_artifacts: `/api/projects/${projectId}/production-board/gears-jobs/local-acceptance`,
      export_gears_external_callback_handoff: `/api/projects/${projectId}/production-board/gears-jobs/export-external-callback-handoff`,
    };
    return paths[actionKey] ? { method: 'POST', path: paths[actionKey] } : undefined;
  }

  const paths: Record<string, string> = {
    rebuild_ledger: `/api/story-outline/ai-comic-series-projects/${projectId}/rebuild-ledger`,
    generate_next_episode: '/api/story-outline/ai-comic-episode',
    export_retry_package: `/api/story-outline/ai-comic-series-projects/${projectId}/export-seedance-retry-package`,
    export_review_repair_package: `/api/story-outline/ai-comic-series-projects/${projectId}/export-seedance-review-repair-package`,
    import_seedance_returns: `/api/story-outline/ai-comic-series-projects/${projectId}/seedance-production-callback`,
    assemble_final_delivery: `/api/story-outline/ai-comic-series-projects/${projectId}/seedance-final/assemble`,
    export_editing_platform_package: `/api/story-outline/ai-comic-series-projects/${projectId}/export-seedance-editing-platform-package`,
    submit_gears_jobs: `/api/story-outline/ai-comic-series-projects/${projectId}/gears-jobs/submit`,
    sync_gears_jobs: `/api/story-outline/ai-comic-series-projects/${projectId}/gears-jobs/sync`,
  };
  return paths[actionKey] ? { method: 'POST', path: paths[actionKey] } : undefined;
}

function actionRunner(actionKey: string): ProductionReadinessAutomationRunner {
  if (actionKey === 'submit_gears_jobs' || actionKey === 'sync_gears_jobs') return 'gears_worker';
  if (actionKey === 'accept_local_gears_artifacts' || actionKey === 'export_gears_external_callback_handoff') return 'operator_review';
  if (actionKey === 'import_seedance_returns' || actionKey === 'export_review_repair_package') return 'operator_review';
  return 'story_agent_api';
}

function actionMode(actionKey: string): ProductionReadinessAutomationMode {
  if (actionKey === 'submit_gears_jobs' || actionKey === 'sync_gears_jobs') return 'external_execution';
  if (actionKey === 'accept_local_gears_artifacts' || actionKey === 'export_gears_external_callback_handoff') return 'manual';
  if (actionKey === 'import_seedance_returns' || actionKey === 'export_review_repair_package') return 'manual';
  return 'writes_project';
}

function actionPayloadHint(
  scope: ProductionReadinessScope,
  projectId: string,
  actionKey: string,
): Record<string, unknown> {
  if (actionKey === 'repair_quality') return { auto_apply: true };
  if (actionKey === 'draft_production_material_fields') return { source: 'scene_breakdown_and_gears_segments' };
  if (actionKey === 'draft_seedance_asset_placeholders') return { source: 'seedance_asset_report', output: 'local_svg_reference_cards' };
  if (actionKey === 'repair_production_board') return { apply_all: true };
  if (actionKey === 'submit_gears_jobs') {
    const externalCallAuthorization = {
      authorized: '<operator_confirmation_required>',
      authorization_reference: '<approval_or_ticket_reference>',
      max_cost_amount: '<non_negative_cost_limit>',
      cost_currency: '<ISO_4217_currency>',
      data_transfer_acknowledged: '<operator_confirmation_required>',
    };
    return scope === 'story_project'
      ? { job_type: 'seedance_video', use_gears_api: true, external_call_authorization: externalCallAuthorization }
      : {
          job_type: 'seedance_video',
          use_gears_api: true,
          submit_intent: 'retry_or_review_repair',
          external_call_authorization: externalCallAuthorization,
        };
  }
  if (actionKey === 'sync_gears_jobs') return { use_gears_api: true };
  if (actionKey === 'accept_local_gears_artifacts') return { job_type: 'seedance_video', output: 'local_acceptance_artifacts' };
  if (actionKey === 'export_gears_external_callback_handoff') return { output: 'markdown_and_json_callback_handoff', replace_sample_outputUrl_before_import: true };
  if (actionKey === 'generate_next_episode') return { series_project_id: projectId, episode_no: '<next_episode_no>' };
  if (actionKey === 'assemble_final_delivery') return { dry_run: true };
  if (actionKey === 'import_seedance_returns') return { callbacks: ['<provider_callback_payload>'] };
  return {};
}

function actionPrerequisites(actionKey: string): string[] {
  if (actionKey === 'submit_gears_jobs') {
    return [
      'GEARS_EXECUTION_WORKER_API_BASE_URL configured (legacy GEARS_API_BASE_URL accepted)',
      'GEARS_CALLBACK_BASE_URL configured',
      'GEARS_CALLBACK_SECRET configured',
      'operator explicitly confirms external data transfer and a maximum cost boundary',
      'authorization/ticket reference recorded in external_call_authorization',
      'every required visual asset has verified immutable bytes, rights approval, human review, and a public HTTPS URL or provider asset ID',
    ];
  }
  if (actionKey === 'sync_gears_jobs') return ['existing GEARS Job Ledger', 'GEARS_EXECUTION_WORKER_API_BASE_URL configured (legacy accepted)'];
  if (actionKey === 'accept_local_gears_artifacts') return ['existing local GEARS Job Ledger', 'operator confirms mocked acceptance boundary'];
  if (actionKey === 'export_gears_external_callback_handoff') return ['ready GEARS jobs without external artifact', 'operator confirms local_acceptance is not final media'];
  if (actionKey === 'generate_next_episode') return ['series plan loaded', 'previous episode context reviewed'];
  if (actionKey === 'import_seedance_returns') return ['external callback payload reviewed', 'matching source_unit_id or production_id'];
  if (actionKey === 'export_review_repair_package') return ['open review ledger items reviewed'];
  if (actionKey === 'assemble_final_delivery') return ['cut package ready', 'subtitle/audio/title-card ledgers ready or intentionally skipped'];
  return [];
}

function actionExpectedResult(actionKey: string): string {
  const map: Record<string, string> = {
    repair_quality: '新增质量修复版本，并刷新故事质量报告。',
    draft_production_material_fields: '从当前分镜与 GEARS segments 草拟生产素材字段，并刷新素材 readiness。',
    draft_seedance_asset_placeholders: '为缺文件的 Seedance @ 槽位生成本地参考卡，写入资产库并刷新交付包。',
    repair_production_board: '新增 production_board_repair 版本并导出最新交付包。',
    export_production_board: '生成 Production Board 交付包并记录当前版本 export 信息。',
    export_retry_package: '生成失败镜头或返修镜头的重试包。',
    rebuild_ledger: '重建系列连续性账本并刷新系列质量审计。',
    generate_next_episode: '生成下一集故事并更新系列项目进度。',
    import_seedance_returns: '把外部回传写入系列生产账本。',
    export_review_repair_package: '导出审片返修包，供人工确认或 GEARS 重试。',
    assemble_final_delivery: '刷新最终交付 ledger/manifest；真实装配仍由 GEARS v2 执行。',
    export_editing_platform_package: '生成外部剪辑平台交付包。',
    submit_gears_jobs: '提交 GEARS job 并写入 GEARS Job Ledger。',
    sync_gears_jobs: '轮询 GEARS status 并写回项目/系列生产账本。',
    accept_local_gears_artifacts: '把本地 mocked GEARS job 写入 local acceptance artifact，刷新项目账本。',
    export_gears_external_callback_handoff: '导出真实外部回片交接包，供 GEARS/Seedance worker 回传 artifact。',
  };
  return map[actionKey] ?? '执行对应生产指挥动作并刷新 readiness。';
}

function actionSafetyNote(actionKey: string): string {
  if (actionKey === 'submit_gears_jobs') return '会调用外部 GEARS v2 worker；当前仓库只提交 job、建账本和接回调。';
  if (actionKey === 'sync_gears_jobs') return '只同步 GEARS 状态，不应把临时 poll 失败误写成终态 failed。';
  if (actionKey === 'accept_local_gears_artifacts') return '只用于本地 mocked GEARS 验收；不代表外部 GEARS/Seedance 已真实回片。';
  if (actionKey === 'export_gears_external_callback_handoff') return '交接包中的 sample outputUrl 必须替换成真实外部 artifact URL 后才能导入回调。';
  if (actionKey === 'draft_seedance_asset_placeholders') return '只生成本地占位参考卡；正式投产前仍可替换为定稿视觉素材。';
  if (actionKey === 'assemble_final_delivery') return '当前仓库只维护最终交付合同/manifest，真实 final assemble 仍归 GEARS v2。';
  if (actionKey === 'import_seedance_returns' || actionKey === 'export_review_repair_package') return '涉及外部回传或审片意见取舍，建议保留人工复核。';
  if (actionKey === 'generate_next_episode') return '会产生新故事/系列状态；需要确保承接上一集连续性。';
  return '会写入项目状态或导出目录；执行前确认 project id 与当前版本。';
}

function blockedIssueIdsForAction(actionKey: string, issues: ProductionReadinessIssue[]): string[] {
  if (actionKey === 'submit_gears_jobs') {
    return issues
      .filter(issue => issue.severity === 'blocking' && issue.lane_key !== 'gears_execution')
      .map(issue => issue.issue_id);
  }
  if (actionKey === 'assemble_final_delivery') {
    return issues
      .filter(issue => issue.severity === 'blocking' && issue.lane_key !== 'delivery_contract')
      .map(issue => issue.issue_id);
  }
  return [];
}

export function buildProductionReadinessAutomationPlan({
  scope,
  projectId,
  actions,
  issues,
}: AutomationPlanInput): ProductionReadinessAutomationPlan {
  const orderedActions = [...actions].sort((left, right) => left.priority - right.priority);
  const steps = orderedActions.map((action, index) => {
    const runner = actionRunner(action.action_key);
    const mode = actionMode(action.action_key);
    const blockedBy = blockedIssueIdsForAction(action.action_key, issues);
    const status: ProductionReadinessAutomationStepStatus = blockedBy.length > 0
      ? 'blocked'
      : mode === 'manual'
        ? 'manual'
        : 'ready';
    return {
      step_id: `step-${String(index + 1).padStart(2, '0')}-${action.action_key}`,
      order: index + 1,
      action_key: action.action_key,
      label: action.label,
      detail: action.detail,
      runner,
      mode,
      status,
      can_auto_execute: status === 'ready' && mode === 'writes_project',
      api: actionApi(scope, projectId, action.action_key),
      payload_hint: actionPayloadHint(scope, projectId, action.action_key),
      prerequisites: actionPrerequisites(action.action_key),
      blocked_by_issue_ids: blockedBy,
      expected_result: actionExpectedResult(action.action_key),
      safety_note: actionSafetyNote(action.action_key),
    };
  });
  const readyStepCount = steps.filter(step => step.status === 'ready').length;
  const blockedStepCount = steps.filter(step => step.status === 'blocked').length;
  const manualStepCount = steps.filter(step => step.status === 'manual').length;
  const externalStepCount = steps.filter(step => step.mode === 'external_execution').length;
  return {
    schema_version: 'production-readiness-automation-plan/v1',
    status: blockedStepCount > 0 ? 'blocked' : manualStepCount > 0 ? 'needs_operator' : 'ready',
    ready_step_count: readyStepCount,
    blocked_step_count: blockedStepCount,
    manual_step_count: manualStepCount,
    external_step_count: externalStepCount,
    steps,
    notes: [
      'Story Agent API steps may write project state or export files.',
      'GEARS worker steps require real GEARS v2 endpoint env; media execution remains outside china-culture-kb.',
      'Manual steps keep operator review in the loop for external callbacks and review decisions.',
    ],
  };
}
