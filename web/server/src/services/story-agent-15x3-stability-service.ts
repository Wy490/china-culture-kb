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

export interface StoryAgent15x3MachineEvaluationSlice {
  slice_id: string;
  case_count: number;
  quality_passed_count: number;
  story_quality_passed_count: number;
  story_publishable_count: number;
  production_material_ready_count: number;
  production_ready_count: number;
  factual_cultural_gate_passed_count: number;
  fact_boundary_ready_count: number;
  cultural_boundary_ready_count: number;
  shootability_ready_count: number;
  repair_attempted_case_count: number;
  repair_applied_case_count: number;
  total_open_repair_action_count: number;
  average_genre_score: number;
  average_outline_coverage_score: number;
  average_pattern_quality_score: number;
  average_gears_readiness_score: number;
  average_professional_candidate_score: number;
}

export interface StoryAgent15x3MachineEvaluation {
  schema_version: 'story-agent-15x3-machine-evaluation/v1';
  status: 'passed' | 'attention_required';
  machine_validation_only: true;
  human_review_complete: false;
  professional_credit_granted: false;
  case_count: number;
  quality_report_count: number;
  quality_passed_count: number;
  story_quality_passed_count: number;
  story_publishable_count: number;
  production_material_ready_count: number;
  production_ready_count: number;
  factual_cultural_gate_passed_count: number;
  fact_boundary_ready_count: number;
  cultural_boundary_ready_count: number;
  shootability_ready_count: number;
  repair_attempted_case_count: number;
  repair_applied_case_count: number;
  total_repair_attempt_count: number;
  total_repair_applied_count: number;
  total_open_repair_action_count: number;
  average_genre_score: number;
  average_outline_coverage_score: number;
  average_pattern_quality_score: number;
  average_gears_readiness_score: number;
  average_professional_candidate_score: number;
  metric_contract: {
    quality_passed: 'legacy_quality_report_aggregate';
    story_quality_passed: 'story_publishable_and_pattern_and_gears';
    story_publishable: 'story_scope_quality_gates';
    production_material_ready: 'production_material_gate';
    production_ready: 'all_story_and_production_gates';
  };
  invariants: {
    every_case_evaluated: boolean;
    every_story_quality_passed: boolean;
    every_story_publishable: boolean;
    every_factual_cultural_gate_passed: boolean;
    every_scene_fact_bound: boolean;
    every_scene_cultural_bound: boolean;
    every_scene_shootable: boolean;
    repair_attempt_covers_story_quality_failures: boolean;
  };
  failed_invariants: string[];
  failure_clusters: {
    story_blocking_gate_counts: Record<string, number>;
    production_blocking_gate_counts: Record<string, number>;
    open_repair_target_counts: Record<string, number>;
    weak_pattern_signal_counts: Record<string, number>;
    gears_issue_counts: Record<string, number>;
  };
  by_variant: StoryAgent15x3MachineEvaluationSlice[];
  by_video_type: StoryAgent15x3MachineEvaluationSlice[];
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
  machine_evaluation: StoryAgent15x3MachineEvaluation;
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
  const sourceByType: Partial<Record<VideoType, string[]>> = {
    character_story: [
      '雨夜，周敦颐在南安军衙翻到案卷中互相矛盾的证词，签笔停在文书上方。',
      '知军王逵催他画押；周敦颐决定拒签，并交还任命文书，愿意承担失去官职的代价。',
      '案卷被重新打开，囚犯因此免死；周敦颐守住了人命面前不能含糊的良知。',
    ],
    historical_drama: [
      '武昌起义消息提前泄露，新军士兵连夜集结，决定抢在清军搜捕前发动。',
      '起义军冲向楚望台军械库，推开库门、搬出枪械，再向湖广总督署推进。',
      '普通士兵的行动引发连锁响应，武昌城的局势由此改变。',
    ],
    legend_story: [
      '刘海在山路砍樵时遇见胡大姐，她用神异力量替他挡开危机，却没有立刻说明身份。',
      '乡邻的怀疑迫使两人分开；刘海决定相信一路看见的行动，回头寻找胡大姐。',
      '两人共同通过考验，歌声留在山路上；这是民间传说中的讲法。',
    ],
    children_story: [
      '小刘海在山路上丢了柴绳，胡大姐停下来帮他把散落的木柴一根根捆好。',
      '别人劝他不要相信陌生人；小刘海决定先看行动，再用一个温和的办法核实误会。',
      '误会解开后，两人把柴担送到家门口，也记住了善良需要勇敢和判断。',
    ],
    ai_comic_drama: [
      '雨夜，刘海发现胡大姐的影子在雷光里短暂变成狐形，手中的柴刀停在半空。',
      '追来的村人逼他交人；胡大姐挡在受伤孩子前，刘海必须在怀疑与亲眼所见之间选择。',
      '刘海放下柴刀护住胡大姐，门外却响起新的脚步声，神异身份引出下一场危机。',
    ],
  };
  return (sourceByType[item.video_type] ?? [
    `${item.selected_event}发生前，主体在具体地点完成一次可见行动。`,
    '现实阻力迫使主体作出选择，关键物件和人物关系随行动发生变化。',
    '行动产生可见后果，主题由结尾画面收束。',
  ]).join('\n\n');
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

function average(values: Array<number | undefined>): number {
  const present = values.filter((value): value is number => value !== undefined);
  if (present.length === 0) return 0;
  return Math.round((present.reduce((sum, value) => sum + value, 0) / present.length) * 100) / 100;
}

function frequency(values: string[]): Record<string, number> {
  return Object.fromEntries(
    [...values.reduce((counts, value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()).entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  );
}

function machineEvaluationSlice(
  sliceId: string,
  items: StoryAgent15x3StabilityItem[],
): StoryAgent15x3MachineEvaluationSlice {
  const evidence = items.map(item => item.matrix_item.machine_evaluation);
  return {
    slice_id: sliceId,
    case_count: evidence.length,
    quality_passed_count: evidence.filter(item => item.quality_passed).length,
    story_quality_passed_count: evidence.filter(item => item.story_quality_passed).length,
    story_publishable_count: evidence.filter(item => item.story_publishable).length,
    production_material_ready_count: evidence.filter(
      item => item.production_material_ready,
    ).length,
    production_ready_count: evidence.filter(item => item.production_ready).length,
    factual_cultural_gate_passed_count: evidence.filter(
      item => item.factual_cultural_gate_passed,
    ).length,
    fact_boundary_ready_count: evidence.filter(
      item => item.scene_count > 0 && item.fact_boundary_scene_count === item.scene_count,
    ).length,
    cultural_boundary_ready_count: evidence.filter(
      item => item.scene_count > 0 && item.cultural_boundary_scene_count === item.scene_count,
    ).length,
    shootability_ready_count: evidence.filter(
      item => item.scene_count > 0 && item.shootable_scene_count === item.scene_count,
    ).length,
    repair_attempted_case_count: evidence.filter(item => item.repair_attempt_count > 0).length,
    repair_applied_case_count: evidence.filter(item => item.repair_applied_count > 0).length,
    total_open_repair_action_count: evidence.reduce(
      (sum, item) => sum + item.open_repair_action_count,
      0,
    ),
    average_genre_score: average(evidence.map(item => item.genre_score)),
    average_outline_coverage_score: average(
      evidence.map(item => item.outline_coverage_score),
    ),
    average_pattern_quality_score: average(evidence.map(item => item.pattern_quality_score)),
    average_gears_readiness_score: average(evidence.map(item => item.gears_readiness_score)),
    average_professional_candidate_score: average(
      evidence.map(item => item.professional_candidate_score),
    ),
  };
}

export function summarizeStoryAgent15x3MachineEvaluation(
  items: StoryAgent15x3StabilityItem[],
): StoryAgent15x3MachineEvaluation {
  const evidence = items.map(item => item.matrix_item.machine_evaluation);
  const caseCount = evidence.length;
  const qualityReportCount = evidence.filter(item => item.quality_report_present).length;
  const qualityPassedCount = evidence.filter(item => item.quality_passed).length;
  const storyQualityPassedCount = evidence.filter(item => item.story_quality_passed).length;
  const storyPublishableCount = evidence.filter(item => item.story_publishable).length;
  const factualCulturalGatePassedCount = evidence.filter(
    item => item.factual_cultural_gate_passed,
  ).length;
  const factBoundaryReadyCount = evidence.filter(
    item => item.scene_count > 0 && item.fact_boundary_scene_count === item.scene_count,
  ).length;
  const culturalBoundaryReadyCount = evidence.filter(
    item => item.scene_count > 0 && item.cultural_boundary_scene_count === item.scene_count,
  ).length;
  const shootabilityReadyCount = evidence.filter(
    item => item.scene_count > 0 && item.shootable_scene_count === item.scene_count,
  ).length;
  const invariants: StoryAgent15x3MachineEvaluation['invariants'] = {
    every_case_evaluated: qualityReportCount === caseCount,
    every_story_quality_passed: storyQualityPassedCount === caseCount,
    every_story_publishable: storyPublishableCount === caseCount,
    every_factual_cultural_gate_passed: factualCulturalGatePassedCount === caseCount,
    every_scene_fact_bound: factBoundaryReadyCount === caseCount,
    every_scene_cultural_bound: culturalBoundaryReadyCount === caseCount,
    every_scene_shootable: shootabilityReadyCount === caseCount,
    repair_attempt_covers_story_quality_failures: evidence.every(
      item => item.story_quality_passed || item.repair_attempt_count > 0,
    ),
  };
  const failedInvariants = Object.entries(invariants)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const variantIds: StoryAgent15x3VariantId[] = [
    'canonical_1m',
    'extended_3m',
    'adaptation_or_compact',
  ];
  return {
    schema_version: 'story-agent-15x3-machine-evaluation/v1',
    status: failedInvariants.length === 0 ? 'passed' : 'attention_required',
    machine_validation_only: true,
    human_review_complete: false,
    professional_credit_granted: false,
    case_count: caseCount,
    quality_report_count: qualityReportCount,
    quality_passed_count: qualityPassedCount,
    story_quality_passed_count: storyQualityPassedCount,
    story_publishable_count: storyPublishableCount,
    production_material_ready_count: evidence.filter(
      item => item.production_material_ready,
    ).length,
    production_ready_count: evidence.filter(item => item.production_ready).length,
    factual_cultural_gate_passed_count: factualCulturalGatePassedCount,
    fact_boundary_ready_count: factBoundaryReadyCount,
    cultural_boundary_ready_count: culturalBoundaryReadyCount,
    shootability_ready_count: shootabilityReadyCount,
    repair_attempted_case_count: evidence.filter(item => item.repair_attempt_count > 0).length,
    repair_applied_case_count: evidence.filter(item => item.repair_applied_count > 0).length,
    total_repair_attempt_count: evidence.reduce(
      (sum, item) => sum + item.repair_attempt_count,
      0,
    ),
    total_repair_applied_count: evidence.reduce(
      (sum, item) => sum + item.repair_applied_count,
      0,
    ),
    total_open_repair_action_count: evidence.reduce(
      (sum, item) => sum + item.open_repair_action_count,
      0,
    ),
    average_genre_score: average(evidence.map(item => item.genre_score)),
    average_outline_coverage_score: average(
      evidence.map(item => item.outline_coverage_score),
    ),
    average_pattern_quality_score: average(evidence.map(item => item.pattern_quality_score)),
    average_gears_readiness_score: average(evidence.map(item => item.gears_readiness_score)),
    average_professional_candidate_score: average(
      evidence.map(item => item.professional_candidate_score),
    ),
    metric_contract: {
      quality_passed: 'legacy_quality_report_aggregate',
      story_quality_passed: 'story_publishable_and_pattern_and_gears',
      story_publishable: 'story_scope_quality_gates',
      production_material_ready: 'production_material_gate',
      production_ready: 'all_story_and_production_gates',
    },
    invariants,
    failed_invariants: failedInvariants,
    failure_clusters: {
      story_blocking_gate_counts: frequency(
        evidence.flatMap(item => item.story_blocking_gate_ids),
      ),
      production_blocking_gate_counts: frequency(
        evidence.flatMap(item => item.production_blocking_gate_ids),
      ),
      open_repair_target_counts: frequency(
        evidence.flatMap(item => item.open_repair_targets),
      ),
      weak_pattern_signal_counts: frequency(
        evidence.flatMap(item => item.weak_pattern_signal_labels),
      ),
      gears_issue_counts: frequency(
        evidence.flatMap(item => item.gears_issues),
      ),
    },
    by_variant: variantIds.map(variantId => machineEvaluationSlice(
      variantId,
      items.filter(item => item.variant_id === variantId),
    )),
    by_video_type: STORY_AGENT_15_TYPE_MATRIX_CASES.map(item => item.video_type).map(
      videoType => machineEvaluationSlice(
        videoType,
        items.filter(item => item.video_type === videoType),
      ),
    ),
  };
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
        `Failed to prepare "${matrixCase.case_id}": ${prepared.error?.message ?? 'unknown error'}`,
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
  const machineEvaluation = summarizeStoryAgent15x3MachineEvaluation(items);
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
    machine_evaluation: machineEvaluation,
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
