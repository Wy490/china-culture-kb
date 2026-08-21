import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CreationUseCase,
  CulturalStorySourceKind,
  PresentationStyle,
  NarrativePatternId,
  StoryGenerateRequest,
  SupportedDuration,
  TruthMode,
  VideoType,
} from '@shared/types.js';
import { attachBlueprintScenes } from './story-blueprint-service.js';
import {
  buildStoryGenerationRecordReplayFixture,
  type StoryGenerationRecordReplayFixture,
} from './story-generation-model.js';
import {
  buildStoryGenerationPromptPackage,
  type StoryGenerationModelOutput,
} from './story-generation-prompt.js';
import { NARRATIVE_PATTERN_LIBRARY } from './narrative-pattern-library.js';
import { validateChinaCultureStoryAssemblyBaseQuality } from '../domains/china-culture/story-base-quality-service.js';
import { buildChinaCultureGeneratedStoryDocument } from '../domains/china-culture/story-document-service.js';
import { executeChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-execution-service.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';
import {
  prepareChinaCultureStoryGeneration,
  type PreparedChinaCultureStoryGeneration,
} from '../domains/china-culture/story-generation-preparation-service.js';

const GENERATED_AT = '2026-08-21T00:00:00.000+08:00';
const MATRIX_DURATIONS = ['30秒', '1分钟', '3分钟'] as const satisfies readonly SupportedDuration[];

interface ReplayMatrixProfile {
  video_type: VideoType;
  presentation_style: PresentationStyle;
  entry_name: string;
  selected_event: string;
  source_kinds: CulturalStorySourceKind[];
  creation_use_case: CreationUseCase;
  truth_mode: TruthMode;
  primary_pattern_id: NarrativePatternId;
  secondary_pattern_id: NarrativePatternId;
}

const MATRIX_PROFILES: ReplayMatrixProfile[] = [
  {
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    entry_name: '刘海砍樵——人仙之恋的湖南民间传说',
    selected_event: '刘海识破胡大姐神异身份并保护文化线索',
    source_kinds: ['user_original'],
    creation_use_case: 'original_ai_comic',
    truth_mode: 'inspired_by_material',
    primary_pattern_id: 'archaeological_mystery_expedition',
    secondary_pattern_id: 'team_heist_operation',
  },
  {
    video_type: 'character_story',
    presentation_style: 'cinematic',
    entry_name: '周敦颐——理学开山鼻祖',
    selected_event: '周敦颐拒签冤案并以辞官相争',
    source_kinds: ['historical_figure'],
    creation_use_case: 'institutional_promo',
    truth_mode: 'inspired_by_material',
    primary_pattern_id: 'tragic_romance_choice',
    secondary_pattern_id: 'folk_satirical_comedy',
  },
  {
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    entry_name: '武昌起义——辛亥革命的第一声枪响',
    selected_event: '武昌起义提前发动并争夺楚望台军械库',
    source_kinds: ['historical_event', 'historical_figure'],
    creation_use_case: 'documentary_short',
    truth_mode: 'inspired_by_material',
    primary_pattern_id: 'historical_faction_epic',
    secondary_pattern_id: 'war_strategy_campaign',
  },
  {
    video_type: 'legend_story',
    presentation_style: 'ink_style',
    entry_name: '刘海砍樵——人仙之恋的湖南民间传说',
    selected_event: '刘海砍樵与人仙相恋的考验',
    source_kinds: ['myth', 'folk_legend'],
    creation_use_case: 'original_ai_comic',
    truth_mode: 'inspired_by_material',
    primary_pattern_id: 'mythic_voyage_homecoming',
    secondary_pattern_id: 'road_companion_quest',
  },
];

interface ReplayMatrixCaseSpec extends ReplayMatrixProfile {
  case_id: string;
  target_duration: typeof MATRIX_DURATIONS[number];
}

export interface StoryGenerationRecordReplayMatrixPositiveCase {
  case_id: string;
  video_type: VideoType;
  target_duration: SupportedDuration;
  primary_pattern_id: string;
  secondary_pattern_id: string;
  status: 'passed' | 'failed';
  fixture_id: string | null;
  prompt_sha256: string | null;
  output_sha256: string | null;
  fixture_sha256: string | null;
  scene_count: number;
  secondary_scene_ids: number[];
  checks: {
    replay_accepted: boolean;
    replay_evidence_verified: boolean;
    no_live_external_call_credit: boolean;
    receipt_hashes_match_fixture: boolean;
    receipt_persisted: boolean;
    primary_opening_realized: boolean;
    primary_ending_realized: boolean;
    secondary_realized_once: boolean;
    full_text_synchronized: boolean;
    gears_synchronized: boolean;
  };
  issues: string[];
}

export interface StoryGenerationRecordReplayMatrixNegativeGate {
  gate_id:
    | 'output_tamper_rejected'
    | 'metadata_tamper_rejected'
    | 'prompt_drift_rejected'
    | 'model_profile_drift_rejected'
    | 'command_self_assertion_denied';
  status: 'passed' | 'failed';
  observed_reason: string;
}

export interface StoryGenerationRecordReplayMatrixReport {
  schema_version: 'story-generation-record-replay-matrix/v1';
  generated_at: string;
  status: 'passed' | 'failed';
  summary: {
    positive_case_count: number;
    positive_case_passed_count: number;
    video_type_coverage: string;
    duration_coverage: string;
    video_type_duration_cell_coverage: string;
    unique_prompt_hash_coverage: string;
    unique_fixture_hash_coverage: string;
    negative_gate_count: number;
    negative_gate_passed_count: number;
  };
  positive_cases: StoryGenerationRecordReplayMatrixPositiveCase[];
  negative_gates: StoryGenerationRecordReplayMatrixNegativeGate[];
  boundaries: {
    fixture_source: 'offline_fixture';
    record_replay_fixture_used: true;
    replay_invokes_external_model: false;
    command_adapter_invocation_count: 1;
    real_external_provider_invoked: false;
    paid_call_performed: false;
    external_data_transfer_performed: false;
    human_review_complete: false;
    professional_credit_granted: false;
    real_production_credit_granted: false;
    province_markdown_written: false;
  };
}

interface ReplayArtifacts {
  preparation: PreparedChinaCultureStoryGeneration;
  promptPackage: ReturnType<typeof buildStoryGenerationPromptPackage>;
  output: StoryGenerationModelOutput;
}

const STORY_ENV_KEYS = [
  'KB_ROOT',
  'STORY_GEN_PROVIDER',
  'STORY_GEN_COMMAND',
  'STORY_GEN_COMMAND_ARGS',
  'STORY_GEN_COMMAND_TIMEOUT_MS',
  'STORY_GEN_EXECUTION_EVIDENCE',
  'STORY_GEN_RECORD_REPLAY_FIXTURE_PATH',
] as const;

function matrixCaseSpecs(): ReplayMatrixCaseSpec[] {
  return MATRIX_PROFILES.flatMap(profile => MATRIX_DURATIONS.map((duration, index) => ({
    ...profile,
    case_id: `record-replay-${profile.video_type}-${index + 1}-${duration}`,
    target_duration: duration,
  })));
}

function requestForCase(
  spec: ReplayMatrixCaseSpec,
  overrides: Partial<StoryGenerateRequest> = {},
): StoryGenerateRequest {
  return {
    entry_name: spec.entry_name,
    selected_event: spec.selected_event,
    video_type: spec.video_type,
    presentation_style: spec.presentation_style,
    target_video_duration: spec.target_duration,
    creation_use_case: spec.creation_use_case,
    truth_mode: spec.truth_mode,
    cultural_source_kinds: spec.source_kinds,
    narrative_pattern_ids: [spec.primary_pattern_id, spec.secondary_pattern_id],
    model_profile_id: 'claude_sonnet',
    generation_fallback_policy: 'forbid_local_fallback',
    output_gears_segments: true,
    auto_repair: false,
    ...overrides,
  };
}

async function buildReplayArtifacts(
  request: StoryGenerateRequest,
): Promise<ReplayArtifacts> {
  const prepared = await prepareChinaCultureStoryGeneration(request);
  if (!prepared.ok) throw new Error(prepared.message);
  const preparation = prepared;
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
  if (!local.ok) throw new Error(local.message);
  const promptPackage = buildStoryGenerationPromptPackage({
    entry: preparation.entry,
    request: {
      ...request,
      narrative_pattern_ids: preparation.narrativePatternIds,
    },
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
    storyStructure: preparation.storyStructure,
    targetDuration: preparation.targetDuration,
    tone: preparation.toneWithPriority,
    selectedEvent: preparation.centralEvent,
    knowledgePack: preparation.knowledgePackToUse,
    materialPack: preparation.materialPackToUse,
    materialSufficiency: preparation.materialSufficiency,
    productionMaterialPack: preparation.productionMaterialPack,
    productionMaterialReadiness: preparation.productionMaterialReadiness,
    creationContract: preparation.creationContract,
    genreMatrix: preparation.genreMatrix,
    memoryMosaicSeed: local.memoryMosaicSeed,
    storyBlueprint: preparation.preliminaryStoryBlueprint,
    adaptationAnalysis: preparation.adaptationAnalysis,
    referenceGenerationRecipe: preparation.referenceGenerationRecipe,
    referenceGenerationContext: preparation.referenceGenerationContext,
  });
  return {
    preparation,
    promptPackage,
    output: {
      title: `${local.storyResult.title}（record replay matrix）`,
      logline: local.storyResult.logline,
      theme: local.storyResult.theme,
      full_text: local.storyResult.full_text,
      scene_breakdown: local.storyResult.scene_breakdown.map(scene => ({
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
      cultural_constraints: local.storyResult.cultural_constraints,
      credibility_note: local.storyResult.credibility_note,
    },
  };
}

function buildFixture(artifacts: ReplayArtifacts): StoryGenerationRecordReplayFixture {
  return buildStoryGenerationRecordReplayFixture({
    pkg: artifacts.promptPackage,
    modelProfileId: artifacts.preparation.selectedModelProfile.id,
    output: artifacts.output,
    recordedAt: GENERATED_AT,
    provenance: {
      source: 'offline_fixture',
      external_model_call_recorded: false,
    },
  });
}

async function installFixture(
  fixtureRoot: string,
  fileName: string,
  fixture: StoryGenerationRecordReplayFixture,
): Promise<void> {
  await mkdir(fixtureRoot, { recursive: true });
  const fixturePath = join(fixtureRoot, fileName);
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  process.env.STORY_GEN_PROVIDER = 'record_replay_json';
  process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH = fixturePath;
  delete process.env.STORY_GEN_COMMAND;
  delete process.env.STORY_GEN_COMMAND_ARGS;
  delete process.env.STORY_GEN_COMMAND_TIMEOUT_MS;
  delete process.env.STORY_GEN_EXECUTION_EVIDENCE;
}

function failedChecks(): StoryGenerationRecordReplayMatrixPositiveCase['checks'] {
  return {
    replay_accepted: false,
    replay_evidence_verified: false,
    no_live_external_call_credit: false,
    receipt_hashes_match_fixture: false,
    receipt_persisted: false,
    primary_opening_realized: false,
    primary_ending_realized: false,
    secondary_realized_once: false,
    full_text_synchronized: false,
    gears_synchronized: false,
  };
}

async function evaluatePositiveCase(
  spec: ReplayMatrixCaseSpec,
  fixtureRoot: string,
): Promise<StoryGenerationRecordReplayMatrixPositiveCase> {
  try {
    const request = requestForCase(spec);
    const artifacts = await buildReplayArtifacts(request);
    const fixture = buildFixture(artifacts);
    await installFixture(fixtureRoot, `${spec.case_id}.json`, fixture);
    const execution = await executeChinaCultureStoryGeneration({
      request,
      preparation: artifacts.preparation,
    });
    if (!execution.ok) {
      return {
        case_id: spec.case_id,
        video_type: spec.video_type,
        target_duration: spec.target_duration,
        primary_pattern_id: spec.primary_pattern_id,
        secondary_pattern_id: spec.secondary_pattern_id,
        status: 'failed',
        fixture_id: fixture.fixture_id,
        prompt_sha256: fixture.prompt_sha256,
        output_sha256: fixture.output_sha256,
        fixture_sha256: fixture.fixture_sha256,
        scene_count: 0,
        secondary_scene_ids: [],
        checks: failedChecks(),
        issues: [execution.message],
      };
    }
    const story = execution.storyResult;
    const secondaryLabel = NARRATIVE_PATTERN_LIBRARY[spec.secondary_pattern_id].label;
    const secondaryScenes = story.scene_breakdown.filter(scene => (
      scene.fictionalized_elements?.some(item => item.includes(`“${secondaryLabel}”副机制`))
    ));
    const receipt = execution.adapterResult.record_replay_receipt;
    const storyId = `record-replay-matrix-${spec.video_type}-${spec.target_duration}`;
    const finalStoryBlueprint = attachBlueprintScenes(
      artifacts.preparation.preliminaryStoryBlueprint,
      story.scene_breakdown,
      storyId,
    );
    const quality = validateChinaCultureStoryAssemblyBaseQuality({
      storyResult: story,
      storyStructure: artifacts.preparation.storyStructure,
      memoryMosaicSeed: execution.memoryMosaicSeed,
      selectedEvent: artifacts.preparation.centralEvent,
      videoType: artifacts.preparation.videoType,
      truthMode: artifacts.preparation.truthMode,
      materialSufficiency: artifacts.preparation.materialSufficiency,
    });
    const document = buildChinaCultureGeneratedStoryDocument({
      request,
      storyId,
      createdAt: GENERATED_AT,
      preparation: artifacts.preparation,
      storyResult: story,
      finalStoryBlueprint,
      baseQualityReport: quality,
      adapterResult: execution.adapterResult,
      generationMode: execution.generationMode,
      generationUsedFallback: execution.generationUsedFallback,
      referenceTrace: execution.referenceTrace,
      memoryMosaicSeed: execution.memoryMosaicSeed,
    });
    const primaryPattern = NARRATIVE_PATTERN_LIBRARY[spec.primary_pattern_id];
    const checks = {
      replay_accepted: execution.generationMode === 'external_model'
        && execution.generationUsedFallback === false,
      replay_evidence_verified: execution.adapterResult.provider === 'record_replay_json'
        && execution.adapterResult.execution_evidence === 'record_replay_fixture',
      no_live_external_call_credit: document.external_model_call_performed === false
        && receipt?.replay_invokes_external_model === false
        && receipt.real_external_model_credit_granted === false,
      receipt_hashes_match_fixture: receipt?.fixture_id === fixture.fixture_id
        && receipt.prompt_sha256 === fixture.prompt_sha256
        && receipt.output_sha256 === fixture.output_sha256
        && receipt.fixture_sha256 === fixture.fixture_sha256
        && receipt.recording_source === 'offline_fixture'
        && receipt.source_recording_external_call_claimed === false,
      receipt_persisted: JSON.stringify(document.model_record_replay_receipt)
          === JSON.stringify(receipt)
        && JSON.stringify(document._request_meta.model_record_replay_receipt)
          === JSON.stringify(receipt),
      primary_opening_realized:
        story.scene_breakdown[0]?.dramatic_function === primaryPattern.pacing_pattern[0],
      primary_ending_realized:
        story.scene_breakdown.at(-1)?.dramatic_function === primaryPattern.pacing_pattern.at(-1),
      secondary_realized_once: secondaryScenes.length === 1,
      full_text_synchronized: secondaryScenes.length === 1
        && story.full_text.includes(secondaryScenes[0].plot),
      gears_synchronized: story.gears_segments.length === story.scene_breakdown.length
        && story.gears_segments.every((segment, index) => (
          segment.purpose === story.scene_breakdown[index].dramatic_function
          && segment.script_text.includes(story.scene_breakdown[index].plot)
        )),
    };
    const issues = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([checkId]) => checkId);
    return {
      case_id: spec.case_id,
      video_type: spec.video_type,
      target_duration: spec.target_duration,
      primary_pattern_id: spec.primary_pattern_id,
      secondary_pattern_id: spec.secondary_pattern_id,
      status: issues.length === 0 ? 'passed' : 'failed',
      fixture_id: fixture.fixture_id,
      prompt_sha256: fixture.prompt_sha256,
      output_sha256: fixture.output_sha256,
      fixture_sha256: fixture.fixture_sha256,
      scene_count: story.scene_breakdown.length,
      secondary_scene_ids: secondaryScenes.map(scene => scene.scene_id),
      checks,
      issues,
    };
  } catch (error) {
    return {
      case_id: spec.case_id,
      video_type: spec.video_type,
      target_duration: spec.target_duration,
      primary_pattern_id: spec.primary_pattern_id,
      secondary_pattern_id: spec.secondary_pattern_id,
      status: 'failed',
      fixture_id: null,
      prompt_sha256: null,
      output_sha256: null,
      fixture_sha256: null,
      scene_count: 0,
      secondary_scene_ids: [],
      checks: failedChecks(),
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function strictFailureReason(result: Awaited<ReturnType<typeof executeChinaCultureStoryGeneration>>): string {
  if (result.ok) return '';
  const details = result.details as { reason?: unknown };
  return typeof details.reason === 'string' ? details.reason : result.message;
}

async function evaluateNegativeGates(
  fixtureRoot: string,
): Promise<StoryGenerationRecordReplayMatrixNegativeGate[]> {
  const spec = matrixCaseSpecs().find(item => (
    item.video_type === 'ai_comic_drama' && item.target_duration === '1分钟'
  ));
  if (!spec) throw new Error('Missing replay matrix negative-gate baseline');
  const request = requestForCase(spec);
  const artifacts = await buildReplayArtifacts(request);
  const fixture = buildFixture(artifacts);
  const outputTampered = structuredClone(fixture);
  outputTampered.output.title = `${outputTampered.output.title}（tampered）`;
  await installFixture(fixtureRoot, 'negative-output-tamper.json', outputTampered);
  const outputResult = await executeChinaCultureStoryGeneration({
    request,
    preparation: artifacts.preparation,
  });

  const metadataTampered = structuredClone(fixture);
  metadataTampered.recorded_at = '2026-08-22T00:00:00.000+08:00';
  await installFixture(fixtureRoot, 'negative-metadata-tamper.json', metadataTampered);
  const metadataResult = await executeChinaCultureStoryGeneration({
    request,
    preparation: artifacts.preparation,
  });

  await installFixture(fixtureRoot, 'negative-prompt-drift.json', fixture);
  const promptDriftRequest = requestForCase(spec, { tone: '冷峻压迫、克制留白' });
  const promptDriftPrepared = await prepareChinaCultureStoryGeneration(promptDriftRequest);
  if (!promptDriftPrepared.ok) throw new Error(promptDriftPrepared.message);
  const promptDriftResult = await executeChinaCultureStoryGeneration({
    request: promptDriftRequest,
    preparation: promptDriftPrepared,
  });

  await installFixture(fixtureRoot, 'negative-profile-drift.json', fixture);
  const profileDriftRequest = requestForCase(spec, { model_profile_id: 'claude_opus' });
  const profileDriftPrepared = await prepareChinaCultureStoryGeneration(profileDriftRequest);
  if (!profileDriftPrepared.ok) throw new Error(profileDriftPrepared.message);
  const profileDriftResult = await executeChinaCultureStoryGeneration({
    request: profileDriftRequest,
    preparation: profileDriftPrepared,
  });

  process.env.STORY_GEN_PROVIDER = 'command_json';
  process.env.STORY_GEN_EXECUTION_EVIDENCE = 'record_replay_fixture';
  process.env.STORY_GEN_COMMAND = process.execPath;
  process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
    '-e',
    'const output=JSON.parse(process.argv[1]);process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(JSON.stringify(output)));',
    JSON.stringify(artifacts.output),
  ]);
  delete process.env.STORY_GEN_COMMAND_TIMEOUT_MS;
  delete process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH;
  const selfAssertionResult = await executeChinaCultureStoryGeneration({
    request,
    preparation: artifacts.preparation,
  });

  const outputReason = strictFailureReason(outputResult);
  const metadataReason = strictFailureReason(metadataResult);
  const promptReason = strictFailureReason(promptDriftResult);
  const profileReason = strictFailureReason(profileDriftResult);
  return [
    {
      gate_id: 'output_tamper_rejected',
      status: !outputResult.ok && outputReason.includes('output_sha256 mismatch')
        ? 'passed'
        : 'failed',
      observed_reason: outputReason,
    },
    {
      gate_id: 'metadata_tamper_rejected',
      status: !metadataResult.ok && metadataReason.includes('fixture_sha256 mismatch')
        ? 'passed'
        : 'failed',
      observed_reason: metadataReason,
    },
    {
      gate_id: 'prompt_drift_rejected',
      status: !promptDriftResult.ok && promptReason.includes('prompt_sha256 mismatch')
        ? 'passed'
        : 'failed',
      observed_reason: promptReason,
    },
    {
      gate_id: 'model_profile_drift_rejected',
      status: !profileDriftResult.ok && profileReason.includes('model_profile mismatch')
        ? 'passed'
        : 'failed',
      observed_reason: profileReason,
    },
    {
      gate_id: 'command_self_assertion_denied',
      status: selfAssertionResult.ok
        && selfAssertionResult.adapterResult.execution_evidence === 'live_external_command'
        && selfAssertionResult.adapterResult.record_replay_receipt === undefined
        ? 'passed'
        : 'failed',
      observed_reason: selfAssertionResult.ok
        ? `execution_evidence=${selfAssertionResult.adapterResult.execution_evidence}`
        : selfAssertionResult.message,
    },
  ];
}

export async function buildStoryGenerationRecordReplayMatrixReport(input: {
  fixtureRoot: string;
  knowledgeRoot: string;
}): Promise<StoryGenerationRecordReplayMatrixReport> {
  const originalEnv = Object.fromEntries(
    STORY_ENV_KEYS.map(key => [key, process.env[key]]),
  ) as Record<typeof STORY_ENV_KEYS[number], string | undefined>;
  try {
    process.env.KB_ROOT = input.knowledgeRoot;
    const positiveCases: StoryGenerationRecordReplayMatrixPositiveCase[] = [];
    for (const spec of matrixCaseSpecs()) {
      positiveCases.push(await evaluatePositiveCase(spec, input.fixtureRoot));
    }
    const negativeGates = await evaluateNegativeGates(input.fixtureRoot);
    const positivePassed = positiveCases.filter(item => item.status === 'passed').length;
    const negativePassed = negativeGates.filter(item => item.status === 'passed').length;
    const coveredVideoTypes = new Set(positiveCases.map(item => item.video_type));
    const coveredDurations = new Set(positiveCases.map(item => item.target_duration));
    const coveredCells = new Set(positiveCases.map(
      item => `${item.video_type}:${item.target_duration}`,
    ));
    const promptHashes = new Set(positiveCases.map(item => item.prompt_sha256).filter(Boolean));
    const fixtureHashes = new Set(positiveCases.map(item => item.fixture_sha256).filter(Boolean));
    const passed = positivePassed === positiveCases.length
      && negativePassed === negativeGates.length
      && coveredVideoTypes.size === MATRIX_PROFILES.length
      && coveredDurations.size === MATRIX_DURATIONS.length
      && coveredCells.size === MATRIX_PROFILES.length * MATRIX_DURATIONS.length
      && promptHashes.size === positiveCases.length
      && fixtureHashes.size === positiveCases.length;

    return {
      schema_version: 'story-generation-record-replay-matrix/v1',
      generated_at: GENERATED_AT,
      status: passed ? 'passed' : 'failed',
      summary: {
        positive_case_count: positiveCases.length,
        positive_case_passed_count: positivePassed,
        video_type_coverage: `${coveredVideoTypes.size}/${MATRIX_PROFILES.length}`,
        duration_coverage: `${coveredDurations.size}/${MATRIX_DURATIONS.length}`,
        video_type_duration_cell_coverage: `${coveredCells.size}/${MATRIX_PROFILES.length * MATRIX_DURATIONS.length}`,
        unique_prompt_hash_coverage: `${promptHashes.size}/${positiveCases.length}`,
        unique_fixture_hash_coverage: `${fixtureHashes.size}/${positiveCases.length}`,
        negative_gate_count: negativeGates.length,
        negative_gate_passed_count: negativePassed,
      },
      positive_cases: positiveCases,
      negative_gates: negativeGates,
      boundaries: {
        fixture_source: 'offline_fixture',
        record_replay_fixture_used: true,
        replay_invokes_external_model: false,
        command_adapter_invocation_count: 1,
        real_external_provider_invoked: false,
        paid_call_performed: false,
        external_data_transfer_performed: false,
        human_review_complete: false,
        professional_credit_granted: false,
        real_production_credit_granted: false,
        province_markdown_written: false,
      },
    };
  } finally {
    for (const key of STORY_ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
