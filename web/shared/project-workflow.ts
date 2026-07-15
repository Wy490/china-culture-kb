import type {
  ProductionReadinessIssue,
  ProductionReadinessNextAction,
  ProductionReadinessStatus,
  StoryProjectStatus,
  StoryProjectWorkflowNextAction,
  StoryProjectWorkflowSnapshot,
  StoryProjectWorkflowState,
} from './types.js';

export interface StoryProjectWorkflowInput {
  project_id: string;
  project_status: StoryProjectStatus;
  readiness_status: ProductionReadinessStatus;
  open_supplement_task_count: number;
  gears_job_count: number;
  external_ready_gears_job_count: number;
  ready_without_external_gears_artifact_count: number;
  next_actions: readonly ProductionReadinessNextAction[];
  issues: readonly ProductionReadinessIssue[];
}

interface WorkflowActionPresentation {
  state: StoryProjectWorkflowState;
  state_label: string;
  anchor: string;
  external_input_required?: boolean;
}

const ACTION_PRESENTATION: Record<string, WorkflowActionPresentation> = {
  draft_production_material_fields: {
    state: 'material_intake',
    state_label: '素材补齐',
    anchor: 'production-material',
  },
  repair_quality: {
    state: 'story_revision',
    state_label: '故事修订',
    anchor: 'story-quality',
  },
  repair_production_board: {
    state: 'production_preparation',
    state_label: '生产准备',
    anchor: 'production-board',
  },
  draft_seedance_asset_placeholders: {
    state: 'production_preparation',
    state_label: '生产准备',
    anchor: 'production-board',
  },
  export_production_board: {
    state: 'production_preparation',
    state_label: '生产准备',
    anchor: 'production-board',
  },
  export_retry_package: {
    state: 'shot_production',
    state_label: '镜头生产',
    anchor: 'production-board',
  },
  submit_gears_jobs: {
    state: 'shot_production',
    state_label: '镜头生产',
    anchor: 'production-board',
  },
  sync_gears_jobs: {
    state: 'shot_production',
    state_label: '镜头生产',
    anchor: 'production-board',
    external_input_required: true,
  },
  accept_local_gears_artifacts: {
    state: 'shot_production',
    state_label: '镜头生产',
    anchor: 'production-board',
  },
  export_gears_external_callback_handoff: {
    state: 'external_delivery',
    state_label: '外部回片',
    anchor: 'production-board',
    external_input_required: true,
  },
};

function nextAction(
  input: StoryProjectWorkflowInput,
  action: ProductionReadinessNextAction,
  presentation: WorkflowActionPresentation,
): StoryProjectWorkflowNextAction {
  return {
    action_key: action.action_key,
    label: action.label,
    detail: action.detail,
    route: `/projects/${encodeURIComponent(input.project_id)}#${presentation.anchor}`,
    anchor: presentation.anchor,
    external_input_required: presentation.external_input_required ?? false,
    counts_as_real_completion: false,
  };
}

function fallbackWorkflow(input: StoryProjectWorkflowInput): {
  state: StoryProjectWorkflowState;
  state_label: string;
  action: StoryProjectWorkflowNextAction;
} {
  if (input.open_supplement_task_count > 0) {
    return {
      state: 'material_intake',
      state_label: '素材补齐',
      action: {
        action_key: 'resolve_project_material_gaps',
        label: '处理素材补充任务',
        detail: `当前项目还有 ${input.open_supplement_task_count} 项素材任务需要处理。`,
        route: `/supplement-tasks?project_id=${encodeURIComponent(input.project_id)}`,
        external_input_required: true,
        counts_as_real_completion: false,
      },
    };
  }

  if (input.readiness_status === 'ready') {
    const externalDeliveryReady = input.gears_job_count > 0
      && input.external_ready_gears_job_count === input.gears_job_count
      && input.ready_without_external_gears_artifact_count === 0;
    return {
      state: input.project_status === 'finalized' && externalDeliveryReady ? 'release_governance' : 'human_review',
      state_label: input.project_status === 'finalized' && externalDeliveryReady ? '发布治理' : '真人评审',
      action: {
        action_key: input.project_status === 'finalized' && externalDeliveryReady
          ? 'open_release_acceptance'
          : 'open_human_review',
        label: input.project_status === 'finalized' && externalDeliveryReady ? '进入发布验收' : '进入真人评审',
        detail: input.project_status === 'finalized' && externalDeliveryReady
          ? '故事和真实外部回片已具备；仍需独立评审、签署与发布权限，不能自动视为 signed release。'
          : '制作 readiness 已就绪；下一步由真人评审，不以机器阈值代替人工结论。',
        route: '/workspace/review',
        external_input_required: true,
        counts_as_real_completion: false,
      },
    };
  }

  return {
    state: 'production_preparation',
    state_label: '生产准备',
    action: {
      action_key: 'inspect_project_readiness',
      label: '检查制作阻塞',
      detail: '当前没有可执行的自动动作；请先核对 readiness 阻塞原因和外部依赖。',
      route: `/projects/${encodeURIComponent(input.project_id)}#production-readiness`,
      anchor: 'production-readiness',
      external_input_required: false,
      counts_as_real_completion: false,
    },
  };
}

export function resolveStoryProjectWorkflow(input: StoryProjectWorkflowInput): StoryProjectWorkflowSnapshot {
  const orderedActions = [...input.next_actions].sort((a, b) => a.priority - b.priority);
  const primarySourceAction = orderedActions[0];
  const presentation = primarySourceAction
    ? ACTION_PRESENTATION[primarySourceAction.action_key] ?? {
      state: 'production_preparation' as const,
      state_label: '生产准备',
      anchor: 'production-readiness',
    }
    : undefined;
  const fallback = primarySourceAction && presentation
    ? undefined
    : fallbackWorkflow(input);
  const primaryNextAction = primarySourceAction && presentation
    ? nextAction(input, primarySourceAction, presentation)
    : fallback!.action;
  const blocker = input.issues.find(issue => issue.severity === 'blocking')
    ?? input.issues.find(issue => issue.severity === 'warning');

  return {
    schema_version: 'story-project-workflow/v1',
    state: presentation?.state ?? fallback!.state,
    state_label: presentation?.state_label ?? fallback!.state_label,
    readiness_status: input.readiness_status,
    blocker_reason: primarySourceAction?.disabled_reason ?? blocker?.detail,
    primary_next_action: primaryNextAction,
    source_next_action_count: orderedActions.length,
    secondary_action_count: Math.max(0, orderedActions.length - 1),
    primary_next_action_count: 1,
    credit_boundary: 'navigation_only_no_real_completion_credit',
  };
}
