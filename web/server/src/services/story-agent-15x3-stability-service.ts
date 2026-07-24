import type {
  ApiResponse,
  SourceMaterialMode,
  SupportedDuration,
  VideoType,
} from '@shared/types.js';
import { ErrorCodes, fail, success } from '@shared/types.js';
import {
  importStoryAgentCompositeBoardExecutions,
  prepareStoryAgentMatrixCase,
  STORY_AGENT_15_TYPE_MATRIX_CASES,
  type StoryAgent15TypeCompositeBoardExecution,
  type StoryAgent15TypeMatrixCase,
  type StoryAgent15TypeMatrixItem,
  type StoryAgent15TypePreproductionMatrixReport,
} from './story-agent-15-type-matrix-service.js';

export type StoryAgent15x3VariantId =
  | 'canonical_1m'
  | 'extended_3m'
  | 'adaptation_or_compact';

export interface StoryAgent15x3StabilityItem {
  case_id: string;
  variant_id: StoryAgent15x3VariantId;
  video_type: VideoType;
  input_profile: {
    target_video_duration: SupportedDuration;
    source_material_mode: SourceMaterialMode;
    brief_length: number;
    adaptation_input: boolean;
  };
  matrix_item: StoryAgent15TypeMatrixItem;
}

export interface StoryAgent15x3StabilityMatrixReport {
  schema_version: 'story-agent-15x3-stability-matrix/v1';
  status: 'ready' | 'awaiting_imagegen' | 'blocked';
  mode: 'canonical_local_15x3';
  generated_at: string;
  boundary: {
    server_image_provider_invoked: false;
    codex_imagegen_required: boolean;
    video_generation_in_scope: false;
    human_test_required: false;
    external_model_path_covered: false;
  };
  coverage: {
    type_count: number;
    variant_count: number;
    case_count: number;
    story_ready_count: number;
    professional_script_ready_count: number;
    prompt_ready_count: number;
    image_request_ready_count: number;
    image_ready_count: number;
    preproduction_ready_count: number;
    hidden_fallback_count: number;
    reused_project_count: number;
    adaptation_case_count: number;
    compact_case_count: number;
    shot_count: number;
    image_task_count: number;
    delivered_image_count: number;
  };
  invariants: {
    every_type_has_three_variants: boolean;
    every_story_ready: boolean;
    every_professional_script_ready: boolean;
    every_prompt_ready: boolean;
    every_image_request_ready: boolean;
    no_hidden_fallback: boolean;
    unique_projects: boolean;
    unique_image_runs: boolean;
  };
  failed_invariants: string[];
  items: StoryAgent15x3StabilityItem[];
}

export interface PrepareStoryAgent15x3StabilityMatrixOptions {
  previous_report?: StoryAgent15x3StabilityMatrixReport;
  canonical_report?: StoryAgent15TypePreproductionMatrixReport;
}

export interface StoryAgent15x3CompositeBoardImportReport {
  schema_version: 'story-agent-15x3-composite-board-import/v1';
  status: StoryAgent15x3StabilityMatrixReport['status'];
  imported_at: string;
  execution_count: number;
  processed_task_count: number;
  verified_task_count: number;
  skipped_idempotent_task_count: number;
  matrix: StoryAgent15x3StabilityMatrixReport;
}

const ADAPTATION_VIDEO_TYPES = new Set<VideoType>([
  'character_story',
  'historical_drama',
  'legend_story',
  'children_story',
  'ai_comic_drama',
]);

function extendedBrief(item: StoryAgent15TypeMatrixCase): string {
  return [
    `围绕“${item.selected_event}”制作三分钟版本。`,
    '开场必须尽快建立可见问题，中段至少包含一次选择或证据推进，结尾回到当代观众能够理解的具体意义。',
    '所有历史、人物、技艺、机构和地貌表达都服从知识条目边界；无法确认的细节使用克制画面，不写成确定事实。',
    '镜头需要有稳定人物或空间锚点、可见动作、连续道具和清楚光线，避免抽象口号、模板化解说与无关现代物件。',
  ].join('');
}

function adaptationBrief(item: StoryAgent15TypeMatrixCase): string {
  return [
    `标题：${item.selected_event}改编稿。`,
    `原作第一段以“${item.selected_event}”发生前的一次具体行动开场，人物先面对现实阻力，再作出不可轻易撤回的选择。`,
    '原作第二段保留人物关系、核心因果和文化语境，通过可见动作、道具与场景变化推进，不另写无关支线。',
    '原作结尾不改变主题，只把文字叙述压缩成可拍摄场景；涉及史实或传说边界时使用来源允许的表达，不冒充已核实新事实。',
  ].join('');
}

function compactBrief(item: StoryAgent15TypeMatrixCase): string {
  return [
    `把“${item.selected_event}”压缩为三十秒版本。`,
    '前三秒给出一个可见钩子，只保留一个核心知识点或品牌承诺；每个镜头只承担一个动作或信息。',
    '结尾用具体画面收束，不使用空泛口号；保持文化事实、工艺步骤、机构表达与地貌类型准确。',
  ].join('');
}

function stabilityCases(): Array<{
  case_id: string;
  variant_id: StoryAgent15x3VariantId;
  matrix_case: StoryAgent15TypeMatrixCase;
  input_profile: StoryAgent15x3StabilityItem['input_profile'];
}> {
  return STORY_AGENT_15_TYPE_MATRIX_CASES.flatMap(base => {
    const extended = extendedBrief(base);
    const adapted = ADAPTATION_VIDEO_TYPES.has(base.video_type);
    const stressBrief = adapted ? adaptationBrief(base) : compactBrief(base);
    const stressDuration: SupportedDuration = adapted ? '3分钟' : '30秒';
    const stressSourceMode: SourceMaterialMode = adapted
      ? 'adapt_user_novel'
      : 'generate_from_knowledge';
    return [
      {
        case_id: `${base.video_type}--canonical_1m`,
        variant_id: 'canonical_1m' as const,
        matrix_case: {
          ...base,
          case_id: `${base.video_type}--canonical_1m`,
        },
        input_profile: {
          target_video_duration: '1分钟' as const,
          source_material_mode: 'generate_from_knowledge' as const,
          brief_length: 0,
          adaptation_input: false,
        },
      },
      {
        case_id: `${base.video_type}--extended_3m`,
        variant_id: 'extended_3m' as const,
        matrix_case: {
          ...base,
          case_id: `${base.video_type}--extended_3m`,
          request_overrides: {
            target_video_duration: '3分钟',
            original_user_query: extended,
            target_audience: '对中国文化感兴趣的普通成年观众',
            communication_goal: '用完整起承转合建立理解、情绪与可复述记忆点',
            story_priority: 'balanced',
          },
        },
        input_profile: {
          target_video_duration: '3分钟' as const,
          source_material_mode: 'generate_from_knowledge' as const,
          brief_length: extended.length,
          adaptation_input: false,
        },
      },
      {
        case_id: `${base.video_type}--adaptation_or_compact`,
        variant_id: 'adaptation_or_compact' as const,
        matrix_case: {
          ...base,
          case_id: `${base.video_type}--adaptation_or_compact`,
          request_overrides: {
            target_video_duration: stressDuration,
            original_user_query: stressBrief,
            outline: stressBrief,
            source_material_mode: stressSourceMode,
            story_priority: adapted ? 'plot_first' : 'knowledge_first',
          },
        },
        input_profile: {
          target_video_duration: stressDuration,
          source_material_mode: stressSourceMode,
          brief_length: stressBrief.length,
          adaptation_input: adapted,
        },
      },
    ];
  });
}

function reportStatus(input: {
  failedInvariants: string[];
  readyCount: number;
  caseCount: number;
}): StoryAgent15x3StabilityMatrixReport['status'] {
  if (input.failedInvariants.length > 0) return 'blocked';
  return input.readyCount === input.caseCount ? 'ready' : 'awaiting_imagegen';
}

export async function prepareStoryAgent15x3StabilityMatrix(
  options: PrepareStoryAgent15x3StabilityMatrixOptions = {},
): Promise<ApiResponse<StoryAgent15x3StabilityMatrixReport>> {
  const previousByCaseId = new Map(
    (options.previous_report?.items ?? []).map(item => [item.case_id, item.matrix_item]),
  );
  const canonicalByType = new Map(
    (options.canonical_report?.items ?? []).map(item => [item.video_type, item]),
  );
  const items: StoryAgent15x3StabilityItem[] = [];
  for (const matrixCase of stabilityCases()) {
    const previous = previousByCaseId.get(matrixCase.case_id)
      ?? (matrixCase.variant_id === 'canonical_1m'
        ? canonicalByType.get(matrixCase.matrix_case.video_type)
        : undefined);
    const prepared = await prepareStoryAgentMatrixCase({
      matrix_case: matrixCase.matrix_case,
      previous,
    });
    if (!prepared.ok || !prepared.data) {
      return fail(
        (prepared.error?.code as typeof ErrorCodes[keyof typeof ErrorCodes])
          ?? ErrorCodes.INTERNAL_ERROR,
        prepared.error?.message ?? `Failed to prepare "${matrixCase.case_id}"`,
        prepared.error?.details,
      );
    }
    items.push({
      case_id: matrixCase.case_id,
      variant_id: matrixCase.variant_id,
      video_type: matrixCase.matrix_case.video_type,
      input_profile: matrixCase.input_profile,
      matrix_item: prepared.data,
    });
  }

  const typeCounts = new Map<VideoType, number>();
  for (const item of items) {
    typeCounts.set(item.video_type, (typeCounts.get(item.video_type) ?? 0) + 1);
  }
  const projectIds = new Set(items.map(item => item.matrix_item.project_id));
  const imageRunIds = new Set(items.map(item => item.matrix_item.image_run_id));
  const invariants: StoryAgent15x3StabilityMatrixReport['invariants'] = {
    every_type_has_three_variants: STORY_AGENT_15_TYPE_MATRIX_CASES.every(
      item => typeCounts.get(item.video_type) === 3,
    ),
    every_story_ready: items.every(item => item.matrix_item.story_status === 'ready'),
    every_professional_script_ready: items.every(
      item => item.matrix_item.professional_script_status === 'ready',
    ),
    every_prompt_ready: items.every(item => item.matrix_item.prompt_status === 'ready'),
    every_image_request_ready: items.every(item => item.matrix_item.image_task_count > 0),
    no_hidden_fallback: items.every(
      item => item.matrix_item.fallback_status !== 'hidden_fallback',
    ),
    unique_projects: projectIds.size === items.length,
    unique_image_runs: imageRunIds.size === items.length,
  };
  const failedInvariants = Object.entries(invariants)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const coverage: StoryAgent15x3StabilityMatrixReport['coverage'] = {
    type_count: typeCounts.size,
    variant_count: new Set(items.map(item => item.variant_id)).size,
    case_count: items.length,
    story_ready_count: items.filter(
      item => item.matrix_item.story_status === 'ready',
    ).length,
    professional_script_ready_count: items.filter(
      item => item.matrix_item.professional_script_status === 'ready',
    ).length,
    prompt_ready_count: items.filter(
      item => item.matrix_item.prompt_status === 'ready',
    ).length,
    image_request_ready_count: items.filter(
      item => item.matrix_item.image_task_count > 0,
    ).length,
    image_ready_count: items.filter(
      item => item.matrix_item.image_status === 'ready',
    ).length,
    preproduction_ready_count: items.filter(
      item => item.matrix_item.preproduction_status === 'ready',
    ).length,
    hidden_fallback_count: items.filter(
      item => item.matrix_item.fallback_status === 'hidden_fallback',
    ).length,
    reused_project_count: items.filter(item => item.matrix_item.project_reused).length,
    adaptation_case_count: items.filter(item => item.input_profile.adaptation_input).length,
    compact_case_count: items.filter(
      item => item.input_profile.target_video_duration === '30秒',
    ).length,
    shot_count: items.reduce((sum, item) => sum + item.matrix_item.shot_count, 0),
    image_task_count: items.reduce(
      (sum, item) => sum + item.matrix_item.image_task_count,
      0,
    ),
    delivered_image_count: items.reduce(
      (sum, item) => sum + item.matrix_item.delivered_image_count,
      0,
    ),
  };
  return success({
    schema_version: 'story-agent-15x3-stability-matrix/v1',
    status: reportStatus({
      failedInvariants,
      readyCount: coverage.preproduction_ready_count,
      caseCount: coverage.case_count,
    }),
    mode: 'canonical_local_15x3',
    generated_at: new Date().toISOString(),
    boundary: {
      server_image_provider_invoked: false,
      codex_imagegen_required: coverage.preproduction_ready_count !== coverage.case_count,
      video_generation_in_scope: false,
      human_test_required: false,
      external_model_path_covered: false,
    },
    coverage,
    invariants,
    failed_invariants: failedInvariants,
    items,
  });
}

export async function importStoryAgent15x3CompositeBoards(input: {
  matrix: StoryAgent15x3StabilityMatrixReport;
  executions: StoryAgent15TypeCompositeBoardExecution[];
}): Promise<ApiResponse<StoryAgent15x3CompositeBoardImportReport>> {
  const importedAt = new Date().toISOString();
  const imported = await importStoryAgentCompositeBoardExecutions({
    items: input.matrix.items.map(item => item.matrix_item),
    executions: input.executions,
  });
  if (!imported.ok || !imported.data) {
    return fail(
      (imported.error?.code as typeof ErrorCodes[keyof typeof ErrorCodes])
        ?? ErrorCodes.INTERNAL_ERROR,
      imported.error?.message ?? 'Failed to import 15x3 composite boards',
      imported.error?.details,
    );
  }
  const refreshed = await prepareStoryAgent15x3StabilityMatrix({
    previous_report: input.matrix,
  });
  if (!refreshed.ok || !refreshed.data) {
    return fail(
      (refreshed.error?.code as typeof ErrorCodes[keyof typeof ErrorCodes])
        ?? ErrorCodes.INTERNAL_ERROR,
      refreshed.error?.message ?? 'Failed to refresh the 15x3 stability matrix',
      refreshed.error?.details,
    );
  }
  return success({
    schema_version: 'story-agent-15x3-composite-board-import/v1',
    status: refreshed.data.status,
    imported_at: importedAt,
    execution_count: imported.data.execution_count,
    processed_task_count: imported.data.processed_task_count,
    verified_task_count: imported.data.verified_task_count,
    skipped_idempotent_task_count: imported.data.skipped_idempotent_task_count,
    matrix: refreshed.data,
  });
}
