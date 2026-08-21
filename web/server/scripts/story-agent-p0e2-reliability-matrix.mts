import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type {
  ApiResponse,
  MaterialPack,
  StoryGenerateRequest,
  VideoType,
} from '@shared/types.js';
import { FileArtifactStore } from '../src/repositories/artifact-store.js';
import { storyGeneratedRoot } from '../src/platform/story-storage-root.js';
import { storyAgentDomainRegistry } from '../src/platform/domain-registry.js';
import type { StoryAssembly } from '../src/platform/story-model-output-merge.js';
import { getProject } from '../src/services/project-service.js';
import { generateChinaCultureLocalStoryAssembly } from '../src/domains/china-culture/story-local-generation-service.js';
import { prepareChinaCultureStoryGeneration } from '../src/domains/china-culture/story-generation-preparation-service.js';
import {
  buildStoryGenerationRecordReplayFixture,
} from '../src/services/story-generation-model.js';
import {
  buildStoryGenerationPromptPackage,
  type StoryGenerationModelOutput,
} from '../src/services/story-generation-prompt.js';
import {
  importStoryAgentCompositeBoardExecutions,
  prepareStoryAgentMatrixCase,
  storyAgentMatrixGenerationRequest,
  STORY_AGENT_15_TYPE_MATRIX_CASES,
  type StoryAgent15TypeMatrixCase,
  type StoryAgent15TypeMatrixItem,
  type StoryAgent15TypePreproductionMatrixReport,
} from '../src/services/story-agent-15-type-matrix-service.js';

const REPORT_DIRECTORY = 'story-agent-p0e2-reliability-matrix';
const REPORT_FILENAME = 'reliability-report.json';
const CANONICAL_REPORT_DIRECTORY = 'story-agent-15-type-preproduction-matrix';
const CANONICAL_MATRIX_FILENAME = 'matrix-report.json';
const OUTPUT_PATH = 'outputs/visual-board.png';

interface ReliabilityFailureCase {
  case_id: string;
  expected_gate:
    | 'story-material-readiness-gate/v1'
    | 'story-generation-fallback-gate/v1';
  blocked: boolean;
  error_code: string | null;
  error_message: string | null;
  gate_schema_version: string | null;
  gate_status: string | null;
  reason: string | null;
  unresolved_conflict_need_ids: string[];
}

interface StoryAgentP0E2ReliabilityReport {
  schema_version: 'story-agent-p0e2-reliability-matrix/v1';
  status: 'ready' | 'blocked';
  mode: 'external_record_replay_and_strict_gates';
  generated_at: string;
  boundary: {
    record_replay_fixture_used: true;
    record_replay_counts_as_real_external_success: false;
    real_external_provider_invoked: false;
    command_adapter_invocation_count: number;
    server_image_provider_invoked: false;
    video_generation_in_scope: false;
    human_test_required: false;
  };
  coverage: {
    video_type_count: number;
    record_replay_case_count: number;
    external_pipeline_acceptance_count: number;
    truthful_record_replay_provenance_count: number;
    story_ready_count: number;
    professional_script_ready_count: number;
    prompt_ready_count: number;
    image_ready_count: number;
    preproduction_ready_count: number;
    hidden_fallback_count: number;
    image_task_count: number;
    verified_image_task_count: number;
    initial_reused_project_count: number;
    repeated_reused_project_count: number;
  };
  strict_gates: {
    missing_material_blocked: boolean;
    conflicting_material_blocked: boolean;
    invalid_external_output_blocked: boolean;
    external_timeout_blocked: boolean;
    local_fallback_persisted_count: 0;
  };
  image_reuse: {
    strategy: 'reuse_verified_canonical_visual_board';
    canonical_board_count: number;
    copied_board_count: number;
    newly_generated_board_count: 0;
    first_import_processed_task_count: number;
    first_import_verified_task_count: number;
    repeated_import_processed_task_count: number;
    repeated_import_skipped_task_count: number;
    all_repeated_tasks_idempotent: boolean;
  };
  idempotency: {
    previous_report_comparable: boolean;
    baseline_migrated: boolean;
    stable_project_ids: boolean;
    stable_image_run_ids: boolean;
  };
  failed_invariants: string[];
  failure_cases: ReliabilityFailureCase[];
  record_replay_items: Array<{
    case_id: string;
    video_type: VideoType;
    matrix_item: StoryAgent15TypeMatrixItem;
  }>;
}

const originalEnv = {
  KB_ROOT: process.env.KB_ROOT,
  STORY_GEN_PROVIDER: process.env.STORY_GEN_PROVIDER,
  STORY_GEN_COMMAND: process.env.STORY_GEN_COMMAND,
  STORY_GEN_COMMAND_ARGS: process.env.STORY_GEN_COMMAND_ARGS,
  STORY_GEN_COMMAND_TIMEOUT_MS: process.env.STORY_GEN_COMMAND_TIMEOUT_MS,
  STORY_GEN_EXECUTION_EVIDENCE: process.env.STORY_GEN_EXECUTION_EVIDENCE,
  STORY_GEN_RECORD_REPLAY_FIXTURE_PATH:
    process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readOptionalReport(
  absolutePath: string,
): Promise<StoryAgentP0E2ReliabilityReport | undefined> {
  try {
    const report = JSON.parse(await readFile(absolutePath, 'utf8')) as
      StoryAgentP0E2ReliabilityReport;
    return report.schema_version === 'story-agent-p0e2-reliability-matrix/v1'
      ? report
      : undefined;
  } catch {
    return undefined;
  }
}

function recordReplayOutput(story: StoryAssembly) {
  return {
    title: `${story.title}（record replay）`,
    logline: story.logline,
    theme: story.theme,
    full_text: story.full_text,
    scene_breakdown: story.scene_breakdown.map(scene => ({
      scene_id: scene.scene_id,
      title: scene.title,
      plot: scene.plot,
      key_action: scene.key_action,
      conflict: scene.conflict,
      dialogue_or_narration: scene.dialogue_or_narration,
      visual_prompt: scene.visual_prompt,
      camera_suggestion: scene.camera_suggestion,
      characters: scene.characters,
      cultural_note: scene.cultural_note,
    })),
    cultural_constraints: story.cultural_constraints,
    credibility_note: story.credibility_note,
  };
}

type SuccessfulPreparation = Extract<
  Awaited<ReturnType<typeof prepareChinaCultureStoryGeneration>>,
  { ok: true }
>;

async function configureReplay(input: {
  fixturePath: string;
  request: StoryGenerateRequest;
  preparation: SuccessfulPreparation;
  output: StoryGenerationModelOutput;
  memoryMosaicSeed?: Extract<
    ReturnType<typeof generateChinaCultureLocalStoryAssembly>,
    { ok: true }
  >['memoryMosaicSeed'];
}): Promise<void> {
  const prompt = buildStoryGenerationPromptPackage({
    entry: input.preparation.entry,
    request: {
      ...input.request,
      narrative_pattern_ids: input.preparation.narrativePatternIds,
    },
    videoType: input.preparation.videoType,
    presentationStyle: input.preparation.presentationStyle,
    storyStructure: input.preparation.storyStructure,
    targetDuration: input.preparation.targetDuration,
    tone: input.preparation.toneWithPriority,
    selectedEvent: input.preparation.centralEvent,
    knowledgePack: input.preparation.knowledgePackToUse,
    materialPack: input.preparation.materialPackToUse,
    materialSufficiency: input.preparation.materialSufficiency,
    productionMaterialPack: input.preparation.productionMaterialPack,
    productionMaterialReadiness: input.preparation.productionMaterialReadiness,
    creationContract: input.preparation.creationContract,
    genreMatrix: input.preparation.genreMatrix,
    memoryMosaicSeed: input.memoryMosaicSeed,
    storyBlueprint: input.preparation.preliminaryStoryBlueprint,
    adaptationAnalysis: input.preparation.adaptationAnalysis,
    referenceGenerationRecipe: input.preparation.referenceGenerationRecipe,
    referenceGenerationContext: input.preparation.referenceGenerationContext,
  });
  const fixture = buildStoryGenerationRecordReplayFixture({
    pkg: prompt,
    modelProfileId: input.preparation.selectedModelProfile.id,
    output: input.output,
    recordedAt: new Date().toISOString(),
    provenance: {
      source: 'offline_fixture',
      external_model_call_recorded: false,
    },
  });
  await mkdir(dirname(input.fixturePath), { recursive: true });
  await writeFile(input.fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  process.env.STORY_GEN_PROVIDER = 'record_replay_json';
  process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH = input.fixturePath;
  delete process.env.STORY_GEN_COMMAND;
  delete process.env.STORY_GEN_COMMAND_ARGS;
  delete process.env.STORY_GEN_COMMAND_TIMEOUT_MS;
}

function strictExternalCase(
  base: StoryAgent15TypeMatrixCase,
): StoryAgent15TypeMatrixCase {
  return {
    ...base,
    case_id: `${base.video_type}--external_record_replay_v2`,
    request_overrides: {
      model_profile_id: 'claude_sonnet',
      generation_fallback_policy: 'forbid_local_fallback',
      auto_repair: false,
    },
  };
}

function strictMaterialPack(input: {
  missing?: boolean;
  conflict?: boolean;
}): MaterialPack {
  return {
    schema_version: 'material-pack/v1',
    primary_materials: input.missing ? [] : [{
      material_id: 'verified-primary',
      title: '周敦颐资料',
      summary: '周敦颐相关事实资料。',
      source_type: 'knowledge_entry',
      purpose: ['fact_basis'],
      linked_entry_name: '周敦颐——理学开山鼻祖',
    }],
    supporting_materials: [],
    reference_materials: [],
    brand_or_institution_profile: input.missing ? undefined : {
      name: '可靠性矩阵测试机构',
      verified_claims: ['只使用已核事实。'],
      forbidden_claims: ['不得虚构机构成果。'],
    },
    visual_assets: [],
    verified_facts: input.missing ? [] : ['周敦颐是北宋思想家。'],
    uncertain_claims: input.conflict
      ? ['出生年份存在两个互相冲突的版本。']
      : [],
    creative_space: input.missing ? [] : ['只允许组织镜头，不补写新事实。'],
    missing_needs: input.conflict ? [{
      need_id: 'birth-year-conflict',
      label: '出生年份冲突',
      message: '来源 A 与来源 B 的出生年份互相矛盾，尚未裁定。',
    }] : [],
    overall_confidence: input.missing ? 0.2 : 0.9,
  };
}

function failureCase(
  caseId: string,
  expectedGate: ReliabilityFailureCase['expected_gate'],
  result: ApiResponse<unknown>,
): ReliabilityFailureCase {
  const details = isRecord(result.error?.details) ? result.error.details : {};
  return {
    case_id: caseId,
    expected_gate: expectedGate,
    blocked: !result.ok && details.schema_version === expectedGate,
    error_code: result.error?.code ?? null,
    error_message: result.error?.message ?? null,
    gate_schema_version: typeof details.schema_version === 'string'
      ? details.schema_version
      : null,
    gate_status: typeof details.status === 'string'
      ? details.status
      : typeof details.generation_mode === 'string'
        ? details.generation_mode
        : null,
    reason: typeof details.reason === 'string' ? details.reason : null,
    unresolved_conflict_need_ids:
      Array.isArray(details.unresolved_conflict_need_ids)
        ? details.unresolved_conflict_need_ids.filter(
          (value): value is string => typeof value === 'string',
        )
        : [],
  };
}

async function strictFailureCases(): Promise<ReliabilityFailureCase[]> {
  const domain = storyAgentDomainRegistry.require('china_culture');
  delete process.env.STORY_GEN_COMMAND;
  delete process.env.STORY_GEN_COMMAND_ARGS;
  delete process.env.STORY_GEN_COMMAND_TIMEOUT_MS;
  delete process.env.STORY_GEN_EXECUTION_EVIDENCE;
  delete process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH;
  const missing = await domain.generateStory({
    entry_name: '周敦颐——理学开山鼻祖',
    video_type: 'culture_promo',
    creation_use_case: 'institutional_promo',
    truth_mode: 'institutional_verified',
    material_pack: strictMaterialPack({ missing: true }),
    material_readiness_policy: 'require_script_ready',
  });
  const conflict = await domain.generateStory({
    entry_name: '周敦颐——理学开山鼻祖',
    video_type: 'culture_promo',
    creation_use_case: 'institutional_promo',
    truth_mode: 'institutional_verified',
    material_pack: strictMaterialPack({ conflict: true }),
    material_readiness_policy: 'require_script_ready',
  });

  process.env.STORY_GEN_PROVIDER = 'command_json';
  process.env.STORY_GEN_COMMAND = process.execPath;
  process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
    '-e',
    "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('invalid json'));",
  ]);
  const invalid = await domain.generateStory({
    entry_name: '周敦颐——理学开山鼻祖',
    video_type: 'character_story',
    model_profile_id: 'claude_sonnet',
    generation_fallback_policy: 'forbid_local_fallback',
    auto_repair: false,
  });

  process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
    '-e',
    "process.stdin.resume();process.stdin.on('end',()=>setTimeout(()=>{},1000));",
  ]);
  process.env.STORY_GEN_COMMAND_TIMEOUT_MS = '20';
  const timeout = await domain.generateStory({
    entry_name: '周敦颐——理学开山鼻祖',
    video_type: 'character_story',
    model_profile_id: 'claude_sonnet',
    generation_fallback_policy: 'forbid_local_fallback',
    auto_repair: false,
  });

  return [
    failureCase(
      'missing_material--strict_script_ready',
      'story-material-readiness-gate/v1',
      missing,
    ),
    failureCase(
      'conflicting_material--strict_script_ready',
      'story-material-readiness-gate/v1',
      conflict,
    ),
    failureCase(
      'invalid_external_output--fallback_forbidden',
      'story-generation-fallback-gate/v1',
      invalid,
    ),
    failureCase(
      'external_timeout--fallback_forbidden',
      'story-generation-fallback-gate/v1',
      timeout,
    ),
  ];
}

const repositoryDataRoot = resolve(import.meta.dirname, '..', '..', '..', 'data');
process.env.KB_ROOT = repositoryDataRoot;
const generatedRoot = storyGeneratedRoot();
const reportDirectory = resolve(generatedRoot, REPORT_DIRECTORY);
const reportPath = resolve(reportDirectory, REPORT_FILENAME);
const canonicalPath = resolve(
  generatedRoot,
  CANONICAL_REPORT_DIRECTORY,
  CANONICAL_MATRIX_FILENAME,
);

let exitCode = 0;
try {
  const [canonical, previous] = await Promise.all([
    readFile(canonicalPath, 'utf8').then(
      raw => JSON.parse(raw) as StoryAgent15TypePreproductionMatrixReport,
    ),
    readOptionalReport(reportPath),
  ]);
  if (
    canonical.schema_version
    !== 'story-agent-15-type-preproduction-matrix/v1'
    || canonical.status !== 'ready'
  ) {
    throw new Error(`A ready canonical matrix is required at "${canonicalPath}"`);
  }
  const canonicalByType = new Map(
    canonical.items.map(item => [item.video_type, item]),
  );
  const previousByCaseId = new Map(
    (previous?.record_replay_items ?? []).map(
      item => [item.case_id, item.matrix_item],
    ),
  );
  const caseById = new Map<string, StoryAgent15TypeMatrixCase>();
  const initialItems: StoryAgentP0E2ReliabilityReport['record_replay_items'] = [];
  for (const base of STORY_AGENT_15_TYPE_MATRIX_CASES) {
    const matrixCase = strictExternalCase(base);
    const request = storyAgentMatrixGenerationRequest(matrixCase);
    const preparation = await prepareChinaCultureStoryGeneration(request);
    if (!preparation.ok) {
      throw new Error(
        `Record replay preparation failed for "${base.video_type}": ${preparation.message}`,
      );
    }
    const local = generateChinaCultureLocalStoryAssembly({
      entry: preparation.entry,
      centralEvent: preparation.centralEvent,
      videoType: preparation.videoType,
      presentationStyle: preparation.presentationStyle,
      storyStructure: preparation.storyStructure,
      targetDuration: preparation.targetDuration,
      tone: preparation.localTone,
      knowledgePack: preparation.knowledgePackToUse,
      originalUserQuery: request.original_user_query ?? request.outline,
      adaptationAnalysis: preparation.adaptationAnalysis,
      genreComposition: preparation.genreComposition,
    });
    if (!local.ok) {
      throw new Error(
        `Record replay local skeleton failed for "${base.video_type}": ${local.message}`,
      );
    }
    await configureReplay({
      fixturePath: resolve(
        reportDirectory,
        'record-replay-fixtures',
        `${matrixCase.case_id}.json`,
      ),
      request,
      preparation,
      output: recordReplayOutput(local.storyResult),
      memoryMosaicSeed: local.memoryMosaicSeed,
    });
    const prepared = await prepareStoryAgentMatrixCase({
      matrix_case: matrixCase,
      previous: previousByCaseId.get(matrixCase.case_id!),
    });
    if (!prepared.ok || !prepared.data) {
      throw new Error(
        prepared.error?.message
          ?? `Record replay failed for "${base.video_type}"`,
      );
    }
    caseById.set(matrixCase.case_id!, matrixCase);
    initialItems.push({
      case_id: matrixCase.case_id!,
      video_type: base.video_type,
      matrix_item: prepared.data,
    });
  }

  let copiedBoardCount = 0;
  for (const item of initialItems) {
    const canonicalItem = canonicalByType.get(item.video_type);
    if (!canonicalItem) {
      throw new Error(`Missing canonical board for "${item.video_type}"`);
    }
    const destinationDirectory = resolve(
      item.matrix_item.image_run_directory,
      'outputs',
    );
    await mkdir(destinationDirectory, { recursive: true });
    await copyFile(
      resolve(canonicalItem.image_run_directory, OUTPUT_PATH),
      resolve(item.matrix_item.image_run_directory, OUTPUT_PATH),
    );
    copiedBoardCount += 1;
  }
  const executions = initialItems.map(item => ({
    run_id: item.matrix_item.image_run_id,
    output_path: OUTPUT_PATH,
  }));
  const firstImport = await importStoryAgentCompositeBoardExecutions({
    items: initialItems.map(item => item.matrix_item),
    executions,
  });
  if (!firstImport.ok || !firstImport.data) {
    throw new Error(
      firstImport.error?.message ?? 'Record replay image import failed',
    );
  }

  const refreshedItems: StoryAgentP0E2ReliabilityReport['record_replay_items'] = [];
  for (const item of initialItems) {
    const matrixCase = caseById.get(item.case_id);
    if (!matrixCase) throw new Error(`Missing matrix case "${item.case_id}"`);
    const refreshed = await prepareStoryAgentMatrixCase({
      matrix_case: matrixCase,
      previous: item.matrix_item,
    });
    if (!refreshed.ok || !refreshed.data) {
      throw new Error(
        refreshed.error?.message
          ?? `Failed to refresh "${item.case_id}" after image import`,
      );
    }
    refreshedItems.push({ ...item, matrix_item: refreshed.data });
  }
  const repeatedImport = await importStoryAgentCompositeBoardExecutions({
    items: refreshedItems.map(item => item.matrix_item),
    executions,
  });
  if (!repeatedImport.ok || !repeatedImport.data) {
    throw new Error(
      repeatedImport.error?.message ?? 'Record replay idempotency check failed',
    );
  }

  const failures = await strictFailureCases();
  const failureById = new Map(failures.map(item => [item.case_id, item]));
  const recordReplayProvenance = await Promise.all(
    refreshedItems.map(async (item) => {
      const project = await getProject(item.matrix_item.project_id);
      return project.ok
        && project.data?.current_story.generation_mode === 'external_model'
        && project.data.current_story.model_execution_evidence
          === 'record_replay_fixture'
        && project.data.current_story.external_model_call_performed === false
        && project.data.current_story.generation_source?.startsWith(
          'Record replay fixture',
        ) === true;
    }),
  );
  const previousReportComparable = previous
    ? previous.record_replay_items.length === refreshedItems.length
      && previous.record_replay_items.every(
        (item, index) => item.case_id === refreshedItems[index]?.case_id,
      )
    : false;
  const refreshedProjectIds = refreshedItems.map(
    item => item.matrix_item.project_id,
  );
  const refreshedRunIds = refreshedItems.map(
    item => item.matrix_item.image_run_id,
  );
  const projectIdsStableWithinRun = JSON.stringify(
    initialItems.map(item => item.matrix_item.project_id),
  ) === JSON.stringify(refreshedProjectIds);
  const runIdsStableWithinRun = JSON.stringify(
    initialItems.map(item => item.matrix_item.image_run_id),
  ) === JSON.stringify(refreshedRunIds);
  const projectIdsStable = projectIdsStableWithinRun
    && (!previousReportComparable || !previous
      || JSON.stringify(
        previous.record_replay_items.map(item => item.matrix_item.project_id),
      ) === JSON.stringify(refreshedProjectIds));
  const runIdsStable = runIdsStableWithinRun
    && (!previousReportComparable || !previous
      || JSON.stringify(
        previous.record_replay_items.map(item => item.matrix_item.image_run_id),
      ) === JSON.stringify(refreshedRunIds));
  const invariants = {
    every_record_replay_external: refreshedItems.every(
      item => item.matrix_item.fallback_status === 'external_model',
    ),
    every_record_replay_truthfully_labeled:
      recordReplayProvenance.every(Boolean),
    every_story_ready: refreshedItems.every(
      item => item.matrix_item.story_status === 'ready',
    ),
    every_professional_script_ready: refreshedItems.every(
      item => item.matrix_item.professional_script_status === 'ready',
    ),
    every_prompt_ready: refreshedItems.every(
      item => item.matrix_item.prompt_status === 'ready',
    ),
    every_image_ready: refreshedItems.every(
      item => item.matrix_item.image_status === 'ready',
    ),
    every_preproduction_ready: refreshedItems.every(
      item => item.matrix_item.preproduction_status === 'ready',
    ),
    missing_material_blocked:
      failureById.get('missing_material--strict_script_ready')?.blocked === true,
    conflicting_material_blocked:
      failureById.get('conflicting_material--strict_script_ready')?.blocked === true,
    invalid_external_output_blocked:
      failureById.get('invalid_external_output--fallback_forbidden')?.blocked === true,
    external_timeout_blocked:
      failureById.get('external_timeout--fallback_forbidden')?.blocked === true,
    repeated_import_idempotent:
      repeatedImport.data.skipped_idempotent_task_count
      === repeatedImport.data.processed_task_count,
    stable_project_ids: projectIdsStable,
    stable_image_run_ids: runIdsStable,
  };
  const failedInvariants = Object.entries(invariants)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const imageTaskCount = refreshedItems.reduce(
    (sum, item) => sum + item.matrix_item.image_task_count,
    0,
  );
  const report: StoryAgentP0E2ReliabilityReport = {
    schema_version: 'story-agent-p0e2-reliability-matrix/v1',
    status: failedInvariants.length === 0 ? 'ready' : 'blocked',
    mode: 'external_record_replay_and_strict_gates',
    generated_at: new Date().toISOString(),
    boundary: {
      record_replay_fixture_used: true,
      record_replay_counts_as_real_external_success: false,
      real_external_provider_invoked: false,
      command_adapter_invocation_count: 2,
      server_image_provider_invoked: false,
      video_generation_in_scope: false,
      human_test_required: false,
    },
    coverage: {
      video_type_count: new Set(refreshedItems.map(item => item.video_type)).size,
      record_replay_case_count: refreshedItems.length,
      external_pipeline_acceptance_count: refreshedItems.filter(
        item => item.matrix_item.fallback_status === 'external_model',
      ).length,
      truthful_record_replay_provenance_count:
        recordReplayProvenance.filter(Boolean).length,
      story_ready_count: refreshedItems.filter(
        item => item.matrix_item.story_status === 'ready',
      ).length,
      professional_script_ready_count: refreshedItems.filter(
        item => item.matrix_item.professional_script_status === 'ready',
      ).length,
      prompt_ready_count: refreshedItems.filter(
        item => item.matrix_item.prompt_status === 'ready',
      ).length,
      image_ready_count: refreshedItems.filter(
        item => item.matrix_item.image_status === 'ready',
      ).length,
      preproduction_ready_count: refreshedItems.filter(
        item => item.matrix_item.preproduction_status === 'ready',
      ).length,
      hidden_fallback_count: refreshedItems.filter(
        item => item.matrix_item.fallback_status === 'hidden_fallback',
      ).length,
      image_task_count: imageTaskCount,
      verified_image_task_count: refreshedItems.reduce(
        (sum, item) => sum + item.matrix_item.delivered_image_count,
        0,
      ),
      initial_reused_project_count: initialItems.filter(
        item => item.matrix_item.project_reused,
      ).length,
      repeated_reused_project_count: refreshedItems.filter(
        item => item.matrix_item.project_reused,
      ).length,
    },
    strict_gates: {
      missing_material_blocked: invariants.missing_material_blocked,
      conflicting_material_blocked: invariants.conflicting_material_blocked,
      invalid_external_output_blocked: invariants.invalid_external_output_blocked,
      external_timeout_blocked: invariants.external_timeout_blocked,
      local_fallback_persisted_count: 0,
    },
    image_reuse: {
      strategy: 'reuse_verified_canonical_visual_board',
      canonical_board_count: canonical.items.length,
      copied_board_count: copiedBoardCount,
      newly_generated_board_count: 0,
      first_import_processed_task_count: firstImport.data.processed_task_count,
      first_import_verified_task_count: firstImport.data.verified_task_count,
      repeated_import_processed_task_count:
        repeatedImport.data.processed_task_count,
      repeated_import_skipped_task_count:
        repeatedImport.data.skipped_idempotent_task_count,
      all_repeated_tasks_idempotent: invariants.repeated_import_idempotent,
    },
    idempotency: {
      previous_report_comparable: previousReportComparable,
      baseline_migrated: Boolean(previous) && !previousReportComparable,
      stable_project_ids: projectIdsStable,
      stable_image_run_ids: runIdsStable,
    },
    failed_invariants: failedInvariants,
    failure_cases: failures,
    record_replay_items: refreshedItems,
  };
  const store = new FileArtifactStore(reportDirectory);
  await store.writeText(
    REPORT_FILENAME,
    `${JSON.stringify(report, null, 2)}\n`,
    { overwrite: 'replace' },
  );
  console.log(JSON.stringify({
    ...report,
    report_path: reportPath,
    canonical_report_path: canonicalPath,
  }, null, 2));
  if (report.status !== 'ready') exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    schema_version: 'story-agent-p0e2-reliability-matrix/v1',
    status: 'blocked',
    report_path: reportPath,
    reason: error instanceof Error ? error.message : String(error),
  }, null, 2));
  exitCode = 1;
} finally {
  restoreEnv();
}

process.exitCode = exitCode;
