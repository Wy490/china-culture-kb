import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import type {
  ApiResponse,
  ErrorCode,
  GenerationType,
  PresentationStyle,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryAgentImageGenerationResult,
  VideoType,
} from '@shared/types.js';
import { ErrorCodes, fail, success } from '@shared/types.js';
import { storyAgentDomainRegistry } from '../platform/domain-registry.js';
import { getProject } from './project-service.js';
import { rebuildDerivedStoryState } from './derived-story-state-service.js';
import {
  exportStoryAgentImageGenerationRequest,
  getStoryAgentImageRun,
  importStoryAgentImageGenerationResult,
} from './story-agent-image-run-service.js';
import { exportStoryAgentSeedancePreproductionPackage } from './story-agent-preproduction-package-service.js';
import { isStoryQualityPassed } from './quality-workflow-service.js';

const STORY_AGENT_MATRIX_CONTRACT_VERSION = 'story-agent-matrix-contract/v29';

export interface StoryAgent15TypeMatrixCase {
  case_id?: string;
  video_type: VideoType;
  generation_type: GenerationType;
  presentation_style: PresentationStyle;
  entry_name: string;
  selected_event: string;
  request_overrides?: Omit<
    Partial<StoryGenerateRequest>,
    'entry_name' | 'generation_type' | 'video_type'
  >;
}

export type StoryAgent15TypeMatrixStageStatus = 'ready' | 'awaiting_imagegen' | 'blocked';
export type StoryAgent15TypeMatrixFallbackStatus =
  | 'explicit_local_only'
  | 'external_model'
  | 'hidden_fallback';

export interface StoryAgentMachineQualityEvidence {
  schema_version: 'story-agent-machine-quality-evidence/v1';
  machine_validation_only: true;
  human_review_complete: false;
  professional_credit_granted: false;
  evaluation_recomputed_from_canonical_story: true;
  quality_report_present: boolean;
  /** Backward-compatible aggregate from `quality_report.passed`. */
  quality_passed: boolean;
  /** Story publication gates plus narrative-pattern and GEARS text-contract thresholds. */
  story_quality_passed: boolean;
  story_publishable: boolean;
  /** Production-material gate only; excludes assets and external providers. */
  production_material_ready: boolean;
  production_ready: boolean;
  factual_cultural_gate_passed: boolean;
  genre_score?: number;
  outline_coverage_score?: number;
  pattern_quality_score?: number;
  gears_readiness_score?: number;
  professional_candidate_score?: number;
  quality_issue_count: number;
  open_repair_action_count: number;
  story_blocking_gate_ids: string[];
  production_blocking_gate_ids: string[];
  open_repair_targets: string[];
  weak_pattern_signal_labels: string[];
  gears_issues: string[];
  repair_attempt_count: number;
  repair_applied_count: number;
  scene_count: number;
  fact_boundary_scene_count: number;
  cultural_boundary_scene_count: number;
  shootable_scene_count: number;
}

export interface StoryAgent15TypeMatrixItem {
  case_id?: string;
  request_fingerprint?: string;
  video_type: VideoType;
  story_id: string;
  project_id: string;
  story_title: string;
  image_run_id: string;
  image_request_path: string;
  image_result_path: string;
  image_run_directory: string;
  generation_mode?: StoryGenerateResult['generation_mode'];
  effective_engine?: StoryGenerateResult['effective_engine'];
  story_status: Extract<StoryAgent15TypeMatrixStageStatus, 'ready' | 'blocked'>;
  professional_script_status: Extract<StoryAgent15TypeMatrixStageStatus, 'ready' | 'blocked'>;
  prompt_status: Extract<StoryAgent15TypeMatrixStageStatus, 'ready' | 'blocked'>;
  image_status: StoryAgent15TypeMatrixStageStatus;
  preproduction_status: Extract<StoryAgent15TypeMatrixStageStatus, 'ready' | 'blocked'>;
  fallback_status: StoryAgent15TypeMatrixFallbackStatus;
  shot_count: number;
  image_task_count: number;
  pending_image_task_count: number;
  delivered_image_count: number;
  expected_image_count: number;
  image_request_provider_invoked: false;
  project_reused: boolean;
  machine_evaluation: StoryAgentMachineQualityEvidence;
  blockers: string[];
  preproduction_blockers: string[];
}

export interface StoryAgent15TypePreproductionMatrixReport {
  schema_version: 'story-agent-15-type-preproduction-matrix/v1';
  status: 'ready' | 'awaiting_imagegen' | 'blocked';
  mode: 'canonical_local_matrix';
  generated_at: string;
  boundary: {
    server_image_provider_invoked: false;
    codex_imagegen_required: boolean;
    video_generation_in_scope: false;
    human_test_required: false;
  };
  coverage: {
    type_count: number;
    story_ready_count: number;
    professional_script_ready_count: number;
    prompt_ready_count: number;
    image_request_ready_count: number;
    image_ready_count: number;
    preproduction_ready_count: number;
    hidden_fallback_count: number;
    reused_project_count: number;
    shot_count: number;
    image_task_count: number;
    delivered_image_count: number;
  };
  invariants: {
    every_type_present: boolean;
    every_story_ready: boolean;
    every_professional_script_ready: boolean;
    every_prompt_ready: boolean;
    every_image_request_ready: boolean;
    no_hidden_fallback: boolean;
    unique_projects: boolean;
  };
  failed_invariants: string[];
  items: StoryAgent15TypeMatrixItem[];
}

export interface PrepareStoryAgent15TypePreproductionMatrixOptions {
  previous_report?: StoryAgent15TypePreproductionMatrixReport;
}

export interface StoryAgent15TypeCompositeBoardExecution {
  run_id: string;
  output_path: string;
  provider_asset_id?: string;
  task_ids?: string[];
}

export interface StoryAgentCompositeBoardImportSummary {
  execution_count: number;
  processed_task_count: number;
  verified_task_count: number;
  skipped_idempotent_task_count: number;
}

export interface StoryAgent15TypeCompositeBoardImportReport {
  schema_version: 'story-agent-15-type-composite-board-import/v1';
  status: 'ready';
  imported_at: string;
  board_count: number;
  processed_task_count: number;
  verified_task_count: number;
  skipped_idempotent_task_count: number;
  matrix: StoryAgent15TypePreproductionMatrixReport;
}

export const STORY_AGENT_15_TYPE_MATRIX_CASES: readonly StoryAgent15TypeMatrixCase[] = [
  {
    video_type: 'character_story',
    generation_type: 'character_story',
    presentation_style: 'cinematic',
    entry_name: '周敦颐——理学开山鼻祖',
    selected_event: '周敦颐拒签冤案并以辞官相争',
  },
  {
    video_type: 'historical_drama',
    generation_type: 'scene_short',
    presentation_style: 'cinematic',
    entry_name: '武昌起义——辛亥革命的第一声枪响',
    selected_event: '武昌起义提前发动并争夺楚望台军械库',
  },
  {
    video_type: 'legend_story',
    generation_type: 'character_story',
    presentation_style: 'ink_style',
    entry_name: '刘海砍樵——人仙之恋的湖南民间传说',
    selected_event: '刘海砍樵与人仙相恋的考验',
  },
  {
    video_type: 'children_story',
    generation_type: 'character_story',
    presentation_style: 'children_animation',
    entry_name: '刘海砍樵——人仙之恋的湖南民间传说',
    selected_event: '刘海砍樵',
  },
  {
    video_type: 'ai_comic_drama',
    generation_type: 'character_story',
    presentation_style: 'ai_comic',
    entry_name: '刘海砍樵——人仙之恋的湖南民间传说',
    selected_event: '刘海识破胡大姐神异身份',
  },
  {
    video_type: 'culture_promo',
    generation_type: 'culture_promo',
    presentation_style: 'voiceover_montage',
    entry_name: '岳麓书院——千年学府弦歌不绝',
    selected_event: '岳麓书院千年文脉',
  },
  {
    video_type: 'heritage_promo',
    generation_type: 'culture_promo',
    presentation_style: 'documentary',
    entry_name: '湘绣——中国四大名绣之一',
    selected_event: '湘绣制作技艺',
  },
  {
    video_type: 'city_brand_promo',
    generation_type: 'culture_promo',
    presentation_style: 'social_media_fastcut',
    entry_name: '岳麓书院——千年学府弦歌不绝',
    selected_event: '长沙岳麓书院文脉与当代生活',
  },
  {
    video_type: 'social_short',
    generation_type: 'culture_promo',
    presentation_style: 'social_media_fastcut',
    entry_name: '湘绣——中国四大名绣之一',
    selected_event: '一根湘绣丝线为什么要劈成多股',
  },
  {
    video_type: 'documentary_short',
    generation_type: 'culture_promo',
    presentation_style: 'documentary',
    entry_name: '岳麓书院——千年学府弦歌不绝',
    selected_event: '朱张会讲',
  },
  {
    video_type: 'explainer_video',
    generation_type: 'culture_promo',
    presentation_style: 'host_narration',
    entry_name: '张家界武陵源——3.8亿年雕琢的世界自然遗产',
    selected_event: '石英砂岩峰林如何形成',
  },
  {
    video_type: 'lecture_video',
    generation_type: 'culture_promo',
    presentation_style: 'host_narration',
    entry_name: '岳麓书院——千年学府弦歌不绝',
    selected_event: '朱张会讲如何体现开放治学精神',
  },
  {
    video_type: 'education_training',
    generation_type: 'culture_promo',
    presentation_style: 'host_narration',
    entry_name: '岳麓书院——千年学府弦歌不绝',
    selected_event: '认识岳麓书院的历史层次',
  },
  {
    video_type: 'scene_short',
    generation_type: 'scene_short',
    presentation_style: 'cinematic',
    entry_name: '岳麓书院——千年学府弦歌不绝',
    selected_event: '岳麓书院空间导览',
  },
  {
    video_type: 'landscape_mood',
    generation_type: 'scene_short',
    presentation_style: 'ink_style',
    entry_name: '张家界武陵源——3.8亿年雕琢的世界自然遗产',
    selected_event: '武陵源峰林云海',
  },
] as const;

function normalizeErrorCode(code?: string): ErrorCode {
  return Object.values(ErrorCodes).includes(code as ErrorCode)
    ? code as ErrorCode
    : ErrorCodes.INTERNAL_ERROR;
}

export function storyAgentMatrixGenerationRequest(
  item: StoryAgent15TypeMatrixCase,
): StoryGenerateRequest {
  return {
    entry_name: item.entry_name,
    generation_type: item.generation_type,
    video_type: item.video_type,
    selected_event: item.selected_event,
    target_video_duration: '1分钟',
    presentation_style: item.presentation_style,
    output_gears_segments: true,
    auto_repair: true,
    source_material_mode: 'generate_from_knowledge',
    ...item.request_overrides,
  };
}

function fallbackStatus(story: StoryGenerateResult): StoryAgent15TypeMatrixFallbackStatus {
  if (
    story.generation_used_fallback
    || story.generation_mode === 'local_fallback'
    || story.effective_engine === 'local_fallback'
  ) return 'hidden_fallback';
  return story.generation_mode === 'local_only'
    ? 'explicit_local_only'
    : 'external_model';
}

function storyReady(story: StoryGenerateResult): boolean {
  return Boolean(
    story.full_text.trim()
    && story.scene_breakdown.length > 0
    && story.gears_segments.length === story.scene_breakdown.length,
  );
}

function professionalScriptReady(story: StoryGenerateResult): boolean {
  const professional = story.professional_text_package;
  if (!professional || !professional.full_text.trim()) return false;
  const machineRepairableHardGates = professional.quality_report.hard_gate_failures
    .filter(gate => !gate.startsWith('interview_consent_missing:'));
  return machineRepairableHardGates.length === 0
    && professional.scene_breakdown.length === story.scene_breakdown.length;
}

function nonEmpty(value?: string): boolean {
  return Boolean(value?.trim());
}

export function evaluateStoryAgentMachineQuality(
  story: StoryGenerateResult,
): StoryAgentMachineQualityEvidence {
  const quality = story.quality_report;
  const gates = quality?.quality_gates;
  const professional = story.professional_text_package?.quality_report;
  const scenes = story.scene_breakdown;
  const storyPublishable = gates?.story_publishable === true;
  const storyQualityPassed = quality ? isStoryQualityPassed(quality) : false;
  return {
    schema_version: 'story-agent-machine-quality-evidence/v1',
    machine_validation_only: true,
    human_review_complete: false,
    professional_credit_granted: false,
    evaluation_recomputed_from_canonical_story: true,
    quality_report_present: Boolean(quality),
    quality_passed: quality?.passed === true,
    story_quality_passed: storyQualityPassed,
    story_publishable: storyPublishable,
    production_material_ready: gates?.production_material_gate.passed === true,
    production_ready: gates?.production_ready === true,
    factual_cultural_gate_passed: gates?.factual_cultural_gate.passed === true,
    genre_score: quality?.genre_score,
    outline_coverage_score: quality?.outline_coverage_report?.coverage_score,
    pattern_quality_score: quality?.pattern_quality_report?.pattern_score,
    gears_readiness_score: quality?.gears_readiness_report?.readiness_score,
    professional_candidate_score: professional?.total_score,
    quality_issue_count: quality?.issues.length ?? 0,
    open_repair_action_count: quality?.repair_action_items?.length ?? 0,
    story_blocking_gate_ids: gates?.story_blocking_gate_ids ?? [],
    production_blocking_gate_ids: gates?.production_blocking_gate_ids ?? [],
    open_repair_targets: quality?.repair_action_items?.map(item => item.target_report) ?? [],
    weak_pattern_signal_labels: quality?.pattern_quality_report?.weak_signals
      .map(item => item.label) ?? [],
    gears_issues: [
      ...(quality?.gears_readiness_report?.asset_gaps ?? []),
      ...(quality?.gears_readiness_report?.unit_gaps ?? []),
      ...(quality?.gears_readiness_report?.prompt_gaps ?? []),
    ],
    repair_attempt_count: story.repair_trace?.filter(trace => trace.attempted).length ?? 0,
    repair_applied_count: story.repair_trace?.filter(trace => trace.applied).length ?? 0,
    scene_count: scenes.length,
    fact_boundary_scene_count: scenes.filter(scene => (
      (scene.source_entries?.length ?? 0) > 0
      && nonEmpty(scene.factual_basis)
    )).length,
    cultural_boundary_scene_count: scenes.filter(scene => (
      nonEmpty(scene.cultural_note)
      && Array.isArray(scene.fictionalized_elements)
    )).length,
    shootable_scene_count: scenes.filter(scene => (
      scene.duration_sec > 0
      && nonEmpty(scene.location)
      && nonEmpty(scene.key_action)
      && nonEmpty(scene.visual_prompt)
      && nonEmpty(scene.camera_suggestion)
    )).length,
  };
}

async function resolveStory(input: {
  item: StoryAgent15TypeMatrixCase;
  previous?: StoryAgent15TypeMatrixItem;
  requestFingerprint: string;
}): Promise<ApiResponse<{ story: StoryGenerateResult; reused: boolean }>> {
  if (input.previous?.project_id) {
    const previousProject = await getProject(input.previous.project_id);
    if (
      previousProject.ok
      && previousProject.data
      && previousProject.data.current_story.video_type === input.item.video_type
      && previousProject.data.current_story.source_entry === input.item.entry_name
      && (
        !input.previous.request_fingerprint
        || input.previous.request_fingerprint === input.requestFingerprint
      )
    ) {
      return success({
        story: previousProject.data.current_story,
        reused: true,
      });
    }
  }
  const generated = await storyAgentDomainRegistry
    .require('china_culture')
    .generateStory(storyAgentMatrixGenerationRequest(input.item));
  if (!generated.ok || !generated.data) {
    return fail(
      normalizeErrorCode(generated.error?.code),
      generated.error?.message ?? `Failed to generate ${input.item.video_type}`,
      generated.error?.details,
    );
  }
  return success({ story: generated.data, reused: false });
}

export async function prepareStoryAgentMatrixCase(input: {
  matrix_case: StoryAgent15TypeMatrixCase;
  previous?: StoryAgent15TypeMatrixItem;
}): Promise<ApiResponse<StoryAgent15TypeMatrixItem>> {
  const generationRequest = storyAgentMatrixGenerationRequest(input.matrix_case);
  const requestFingerprint = createHash('sha256')
    .update(JSON.stringify({
      contract_version: STORY_AGENT_MATRIX_CONTRACT_VERSION,
      request: generationRequest,
    }))
    .digest('hex');
  const storyResult = await resolveStory({
    item: input.matrix_case,
    previous: input.previous,
    requestFingerprint,
  });
  if (!storyResult.ok || !storyResult.data) {
    return fail(
      normalizeErrorCode(storyResult.error?.code),
      storyResult.error?.message ?? `Failed to resolve ${input.matrix_case.video_type}`,
      storyResult.error?.details,
    );
  }
  const { story, reused } = storyResult.data;
  if (!story.project_id) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      `${input.matrix_case.video_type} generation did not persist a project_id`,
    );
  }
  let evaluationStory: StoryGenerateResult;
  try {
    evaluationStory = await rebuildDerivedStoryState(story, {
      revalidateDomainSafety: false,
      professionalTextNow: story.professional_text_package?.updated_at,
    });
  } catch (error) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      `${input.matrix_case.video_type} machine quality reevaluation failed`,
      error instanceof Error ? error.message : String(error),
    );
  }
  const imageRunResult = await exportStoryAgentImageGenerationRequest({
    project_id: story.project_id,
  });
  if (!imageRunResult.ok || !imageRunResult.data) {
    return fail(
      normalizeErrorCode(imageRunResult.error?.code),
      imageRunResult.error?.message
        ?? `${input.matrix_case.video_type} image request export failed`,
      imageRunResult.error?.details,
    );
  }
  const preproductionResult = await exportStoryAgentSeedancePreproductionPackage({
    project_id: story.project_id,
  });
  if (!preproductionResult.ok || !preproductionResult.data) {
    return fail(
      normalizeErrorCode(preproductionResult.error?.code),
      preproductionResult.error?.message
        ?? `${input.matrix_case.video_type} preproduction export failed`,
      preproductionResult.error?.details,
    );
  }
  const imageRun = imageRunResult.data;
  const preproduction = preproductionResult.data;
  const allShots = preproduction.story_units.flatMap(unit => unit.script.shots);
  const readyStory = storyReady(story);
  const readyProfessional = professionalScriptReady(story);
  const readyPrompts = allShots.length > 0 && allShots.every(shot => (
    shot.script_text.trim() && shot.seedance_prompt.trim()
  ));
  const blockers = [
    ...(readyStory ? [] : ['story_not_ready']),
    ...(readyProfessional ? [] : ['professional_script_not_ready']),
    ...(readyPrompts ? [] : ['seedance_prompt_not_ready']),
    ...(imageRun.request.task_count > 0 ? [] : ['image_request_empty']),
    ...(fallbackStatus(story) === 'hidden_fallback' ? ['hidden_generation_fallback'] : []),
  ];
  return success({
    case_id: input.matrix_case.case_id,
    request_fingerprint: requestFingerprint,
    video_type: input.matrix_case.video_type,
    story_id: story.storyId,
    project_id: story.project_id,
    story_title: story.title,
    image_run_id: imageRun.run_id,
    image_request_path: imageRun.request_path,
    image_result_path: imageRun.result_path,
    image_run_directory: imageRun.request.run_directory,
    generation_mode: story.generation_mode,
    effective_engine: story.effective_engine,
    story_status: readyStory ? 'ready' : 'blocked',
    professional_script_status: readyProfessional ? 'ready' : 'blocked',
    prompt_status: readyPrompts ? 'ready' : 'blocked',
    image_status: imageRun.status === 'complete'
      ? 'ready'
      : imageRun.status === 'blocked'
        ? 'blocked'
        : 'awaiting_imagegen',
    preproduction_status: preproduction.acceptance.status,
    fallback_status: fallbackStatus(story),
    shot_count: allShots.length,
    image_task_count: imageRun.request.task_count,
    pending_image_task_count: imageRun.summary.awaiting_imagegen_count
      + imageRun.summary.failed_retryable_count,
    delivered_image_count: preproduction.acceptance.image_asset_count,
    expected_image_count: preproduction.acceptance.expected_image_asset_count,
    image_request_provider_invoked: imageRun.request.provider_invoked,
    project_reused: reused,
    machine_evaluation: evaluateStoryAgentMachineQuality(evaluationStory),
    blockers,
    preproduction_blockers: preproduction.acceptance.blockers,
  });
}

function reportStatus(input: {
  failedInvariants: string[];
  preproductionReadyCount: number;
  typeCount: number;
}): StoryAgent15TypePreproductionMatrixReport['status'] {
  if (input.failedInvariants.length > 0) return 'blocked';
  return input.preproductionReadyCount === input.typeCount
    ? 'ready'
    : 'awaiting_imagegen';
}

export async function prepareStoryAgent15TypePreproductionMatrix(
  options: PrepareStoryAgent15TypePreproductionMatrixOptions = {},
): Promise<ApiResponse<StoryAgent15TypePreproductionMatrixReport>> {
  const generatedAt = new Date().toISOString();
  const previousByType = new Map(
    (options.previous_report?.items ?? []).map(item => [item.video_type, item]),
  );
  const items: StoryAgent15TypeMatrixItem[] = [];

  for (const matrixCase of STORY_AGENT_15_TYPE_MATRIX_CASES) {
    const itemResult = await prepareStoryAgentMatrixCase({
      matrix_case: matrixCase,
      previous: previousByType.get(matrixCase.video_type),
    });
    if (!itemResult.ok || !itemResult.data) {
      return fail(
        normalizeErrorCode(itemResult.error?.code),
        itemResult.error?.message ?? `Failed to prepare ${matrixCase.video_type}`,
        itemResult.error?.details,
      );
    }
    items.push(itemResult.data);
  }

  const videoTypes = new Set(items.map(item => item.video_type));
  const projectIds = new Set(items.map(item => item.project_id));
  const invariants: StoryAgent15TypePreproductionMatrixReport['invariants'] = {
    every_type_present: videoTypes.size === STORY_AGENT_15_TYPE_MATRIX_CASES.length,
    every_story_ready: items.every(item => item.story_status === 'ready'),
    every_professional_script_ready: items.every(
      item => item.professional_script_status === 'ready',
    ),
    every_prompt_ready: items.every(item => item.prompt_status === 'ready'),
    every_image_request_ready: items.every(item => item.image_task_count > 0),
    no_hidden_fallback: items.every(item => item.fallback_status !== 'hidden_fallback'),
    unique_projects: projectIds.size === items.length,
  };
  const failedInvariants = Object.entries(invariants)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const coverage: StoryAgent15TypePreproductionMatrixReport['coverage'] = {
    type_count: items.length,
    story_ready_count: items.filter(item => item.story_status === 'ready').length,
    professional_script_ready_count: items.filter(
      item => item.professional_script_status === 'ready',
    ).length,
    prompt_ready_count: items.filter(item => item.prompt_status === 'ready').length,
    image_request_ready_count: items.filter(item => item.image_task_count > 0).length,
    image_ready_count: items.filter(item => item.image_status === 'ready').length,
    preproduction_ready_count: items.filter(
      item => item.preproduction_status === 'ready',
    ).length,
    hidden_fallback_count: items.filter(
      item => item.fallback_status === 'hidden_fallback',
    ).length,
    reused_project_count: items.filter(item => item.project_reused).length,
    shot_count: items.reduce((sum, item) => sum + item.shot_count, 0),
    image_task_count: items.reduce((sum, item) => sum + item.image_task_count, 0),
    delivered_image_count: items.reduce(
      (sum, item) => sum + item.delivered_image_count,
      0,
    ),
  };
  return success({
    schema_version: 'story-agent-15-type-preproduction-matrix/v1',
    status: reportStatus({
      failedInvariants,
      preproductionReadyCount: coverage.preproduction_ready_count,
      typeCount: coverage.type_count,
    }),
    mode: 'canonical_local_matrix',
    generated_at: generatedAt,
    boundary: {
      server_image_provider_invoked: false,
      codex_imagegen_required: coverage.preproduction_ready_count !== coverage.type_count,
      video_generation_in_scope: false,
      human_test_required: false,
    },
    coverage,
    invariants,
    failed_invariants: failedInvariants,
    items,
  });
}

export async function importStoryAgentCompositeBoardExecutions(input: {
  items: StoryAgent15TypeMatrixItem[];
  executions: StoryAgent15TypeCompositeBoardExecution[];
}): Promise<ApiResponse<StoryAgentCompositeBoardImportSummary>> {
  const itemByRunId = new Map(input.items.map(item => [item.image_run_id, item]));
  const executionRunIds = new Set(input.executions.map(execution => execution.run_id));
  if (executionRunIds.size !== input.executions.length) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Composite board executions must contain unique run_id values',
    );
  }

  let processedTaskCount = 0;
  let verifiedTaskCount = 0;
  let skippedIdempotentTaskCount = 0;
  const importedAt = new Date().toISOString();
  for (const execution of input.executions) {
    const matrixItem = itemByRunId.get(execution.run_id);
    if (!matrixItem) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `Composite board execution references unknown run "${execution.run_id}"`,
      );
    }
    const runResult = await getStoryAgentImageRun(matrixItem.image_run_id);
    if (!runResult.ok || !runResult.data) {
      return fail(
        normalizeErrorCode(runResult.error?.code),
        runResult.error?.message ?? `Image run "${matrixItem.image_run_id}" not found`,
      );
    }
    const run = runResult.data;
    const outputFilePath = resolve(run.request.run_directory, execution.output_path);
    const outputRoot = resolve(run.request.run_directory, 'outputs');
    let bytes: Buffer;
    try {
      const [realOutputRoot, realOutputFilePath] = await Promise.all([
        realpath(outputRoot),
        realpath(outputFilePath),
      ]);
      const outputRelation = relative(realOutputRoot, realOutputFilePath);
      if (
        !outputRelation
        || outputRelation.startsWith('..')
        || isAbsolute(outputRelation)
      ) {
        return fail(
          ErrorCodes.VALIDATION_ERROR,
          `Composite board output must stay beneath the run outputs directory for "${matrixItem.image_run_id}"`,
        );
      }
      bytes = await readFile(realOutputFilePath);
    } catch {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `Composite board output does not exist for "${matrixItem.image_run_id}"`,
      );
    }
    const taskIds = execution.task_ids
      ? [...new Set(execution.task_ids)]
      : run.request.tasks.map(task => task.task_id);
    if (
      taskIds.length === 0
      || taskIds.length !== (execution.task_ids?.length ?? taskIds.length)
    ) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `Composite board execution must contain unique non-empty task_ids for "${run.run_id}"`,
      );
    }
    const requestTaskById = new Map(run.request.tasks.map(task => [task.task_id, task]));
    const requestTasks = taskIds.map(taskId => requestTaskById.get(taskId));
    if (requestTasks.some(task => !task)) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `Composite board execution references an unknown task for "${run.run_id}"`,
      );
    }
    const contentSha256 = createHash('sha256').update(bytes).digest('hex');
    const result: StoryAgentImageGenerationResult = {
      schema_version: 'image-generation-result/v1',
      run_id: run.run_id,
      request_sha256: run.request.request_sha256,
      completed_at: importedAt,
      items: requestTasks.map(task => ({
        task_id: task!.task_id,
        status: 'generated',
        output_path: execution.output_path,
        mime_type: 'image/png',
        content_sha256: contentSha256,
        prompt_sha256: task!.prompt_sha256,
        provider: 'openai_imagegen',
        provider_asset_id: execution.provider_asset_id,
        model: 'gpt-image-2',
      })),
    };
    const imported = await importStoryAgentImageGenerationResult(run.run_id, result);
    if (!imported.ok || !imported.data) {
      return fail(
        normalizeErrorCode(imported.error?.code),
        imported.error?.message ?? `Failed to import "${basename(outputFilePath)}"`,
        imported.error?.details,
      );
    }
    if (imported.data.failed_task_count > 0) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        `Composite board import left ${imported.data.failed_task_count} failed tasks for "${run.run_id}"`,
      );
    }
    if (imported.data.verified_task_count !== result.items.length) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        `Composite board import verified ${imported.data.verified_task_count}/${result.items.length} tasks for "${run.run_id}"`,
      );
    }
    processedTaskCount += imported.data.processed_item_count;
    verifiedTaskCount += imported.data.verified_task_count;
    skippedIdempotentTaskCount += imported.data.skipped_idempotent_task_count;
  }
  return success({
    execution_count: input.executions.length,
    processed_task_count: processedTaskCount,
    verified_task_count: verifiedTaskCount,
    skipped_idempotent_task_count: skippedIdempotentTaskCount,
  });
}

export async function importStoryAgent15TypeCompositeBoards(input: {
  matrix: StoryAgent15TypePreproductionMatrixReport;
  executions: StoryAgent15TypeCompositeBoardExecution[];
}): Promise<ApiResponse<StoryAgent15TypeCompositeBoardImportReport>> {
  const executionByRunId = new Map(
    input.executions.map(execution => [execution.run_id, execution]),
  );
  if (
    input.executions.length !== input.matrix.items.length
    || executionByRunId.size !== input.matrix.items.length
  ) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Exactly one composite board execution is required for every matrix image run',
    );
  }

  const importedAt = new Date().toISOString();
  const imported = await importStoryAgentCompositeBoardExecutions({
    items: input.matrix.items,
    executions: input.executions,
  });
  if (!imported.ok || !imported.data) {
    return fail(
      normalizeErrorCode(imported.error?.code),
      imported.error?.message ?? 'Failed to import 15-type composite boards',
      imported.error?.details,
    );
  }

  const refreshed = await prepareStoryAgent15TypePreproductionMatrix({
    previous_report: input.matrix,
  });
  if (!refreshed.ok || !refreshed.data) {
    return fail(
      normalizeErrorCode(refreshed.error?.code),
      refreshed.error?.message ?? 'Failed to refresh the 15-type matrix after image import',
      refreshed.error?.details,
    );
  }
  if (refreshed.data.status !== 'ready') {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      `15-type matrix remained "${refreshed.data.status}" after composite board import`,
      {
        failed_invariants: refreshed.data.failed_invariants,
        incomplete_types: refreshed.data.items
          .filter(item => item.preproduction_status !== 'ready')
          .map(item => ({
            video_type: item.video_type,
            blockers: item.preproduction_blockers,
          })),
      },
    );
  }
  return success({
    schema_version: 'story-agent-15-type-composite-board-import/v1',
    status: 'ready',
    imported_at: importedAt,
    board_count: input.executions.length,
    processed_task_count: imported.data.processed_task_count,
    verified_task_count: imported.data.verified_task_count,
    skipped_idempotent_task_count: imported.data.skipped_idempotent_task_count,
    matrix: refreshed.data,
  });
}
