import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  ApiResponse,
  StoryAgentImageGenerationResult,
  StoryAgentImageRun,
  StoryAgentRun,
  StoryAgentRunExportResponse,
  StoryAgentRunImageImportResponse,
  StoryAgentRunStageResult,
  StoryAgentRunStartRequest,
  StoryAgentSeedancePreproductionPackage,
  VideoType,
} from '@shared/types.js';
import { ErrorCodes, fail, success } from '@shared/types.js';
import { FileArtifactStore } from '../repositories/artifact-store.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import {
  exportStoryAgentImageGenerationRequest,
  importStoryAgentImageGenerationResult,
} from './story-agent-image-run-service.js';
import { exportStoryAgentSeedancePreproductionPackage } from './story-agent-preproduction-package-service.js';

const STORY_AGENT_RUN_SCHEMA_VERSION = 'story-agent-run/v1' as const;
const STORY_AGENT_RUN_INPUT_SCHEMA_VERSION = 'story-agent-run-input/v1' as const;
const STORY_AGENT_RUN_ROOT_DIRECTORY = 'story-agent-runs';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeErrorCode(code?: string): typeof ErrorCodes[keyof typeof ErrorCodes] {
  return Object.values(ErrorCodes).includes(code as typeof ErrorCodes[keyof typeof ErrorCodes])
    ? code as typeof ErrorCodes[keyof typeof ErrorCodes]
    : ErrorCodes.INTERNAL_ERROR;
}

function sourceRequest(request: StoryAgentRunStartRequest): StoryAgentRunStartRequest {
  return request.project_id
    ? { project_id: request.project_id }
    : { series_project_id: request.series_project_id };
}

function sourceIdentity(request: StoryAgentRunStartRequest): {
  kind: 'story_project' | 'ai_comic_series_project';
  sourceId: string;
} {
  return request.project_id
    ? { kind: 'story_project', sourceId: request.project_id }
    : { kind: 'ai_comic_series_project', sourceId: request.series_project_id! };
}

function runIdFor(request: StoryAgentRunStartRequest): string {
  const identity = sourceIdentity(request);
  return `story-agent-run-${sha256(JSON.stringify({
    schema_version: STORY_AGENT_RUN_INPUT_SCHEMA_VERSION,
    source_kind: identity.kind,
    source_id: identity.sourceId,
  })).slice(0, 24)}`;
}

function runsRoot(): string {
  return resolve(storyGeneratedRoot(), STORY_AGENT_RUN_ROOT_DIRECTORY);
}

function runDirectory(runId: string): string {
  return resolve(runsRoot(), runId);
}

function runFilePath(runId: string): string {
  return resolve(runDirectory(runId), 'run.json');
}

async function readRun(runId: string): Promise<StoryAgentRun | undefined> {
  try {
    const parsed = JSON.parse(await readFile(runFilePath(runId), 'utf8')) as StoryAgentRun;
    return parsed.schema_version === STORY_AGENT_RUN_SCHEMA_VERSION
      && parsed.run_id === runId
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

async function persistRun(run: StoryAgentRun): Promise<void> {
  const store = new FileArtifactStore(runDirectory(run.run_id));
  await store.writeText('run.json', `${JSON.stringify(run, null, 2)}\n`, {
    overwrite: 'replace',
  });
}

function videoTypes(
  preproduction: StoryAgentSeedancePreproductionPackage,
): VideoType[] {
  return unique(preproduction.story_units.flatMap(unit => (
    unit.professional_text_package?.video_type
      ? [unit.professional_text_package.video_type]
      : []
  ))) as VideoType[];
}

function stageResults(input: {
  preproduction: StoryAgentSeedancePreproductionPackage;
  imageRun?: StoryAgentImageRun;
  imageFailure?: string;
}): StoryAgentRunStageResult[] {
  const acceptance = input.preproduction.acceptance;
  const professionalReady = acceptance.expected_story_unit_count > 0
    && acceptance.professional_script_count === acceptance.expected_story_unit_count;
  const seedanceReady = acceptance.script_shot_count > 0
    && acceptance.seedance_prompt_shot_count === acceptance.script_shot_count;
  const imageRetryableFailures = input.imageRun?.tasks
    .filter(task => task.status === 'failed_retryable')
    .map(task => task.last_error ?? `image_task_retryable:${task.task_id}`)
    ?? (input.imageFailure ? [input.imageFailure] : []);
  const imageBlockers = input.imageRun?.tasks
    .filter(task => task.status === 'blocked')
    .map(task => task.last_error ?? `image_task_blocked:${task.task_id}`)
    ?? [];
  let imageStatus: StoryAgentRunStageResult['status'];
  if (!input.imageRun) imageStatus = 'failed_retryable';
  else if (input.imageRun.status === 'complete') imageStatus = 'ready';
  else if (input.imageRun.status === 'blocked') imageStatus = 'blocked';
  else if (imageRetryableFailures.length) imageStatus = 'failed_retryable';
  else imageStatus = 'awaiting_external_action';

  return [
    {
      stage: 'source',
      status: 'ready',
      evidence_refs: [
        `${input.preproduction.source.kind}:${input.preproduction.source.source_id}`,
        ...input.preproduction.source.story_ids.map(storyId => `story:${storyId}`),
      ],
      blockers: [],
      retryable_failures: [],
    },
    {
      stage: 'professional_script',
      status: professionalReady ? 'ready' : 'blocked',
      evidence_refs: input.preproduction.story_units.flatMap(unit => (
        unit.professional_text_package
          ? [`professional_text_package:${unit.professional_text_package.package_id}`]
          : []
      )),
      blockers: professionalReady
        ? []
        : [`professional_script_count:${acceptance.professional_script_count}/${acceptance.expected_story_unit_count}`],
      retryable_failures: [],
    },
    {
      stage: 'seedance_prompt',
      status: seedanceReady ? 'ready' : 'blocked',
      evidence_refs: input.preproduction.story_units.map(
        unit => `seedance_prompt_package:${unit.seedance_prompt_package.storyId}`,
      ),
      blockers: seedanceReady
        ? []
        : [`seedance_prompt_shot_count:${acceptance.seedance_prompt_shot_count}/${acceptance.script_shot_count}`],
      retryable_failures: [],
    },
    {
      stage: 'image_assets',
      status: imageStatus,
      evidence_refs: input.imageRun
        ? [
            `story_agent_image_run:${input.imageRun.run_id}`,
            `image_generation_request:${input.imageRun.request.request_sha256}`,
          ]
        : [],
      blockers: imageBlockers,
      retryable_failures: imageRetryableFailures,
    },
    {
      stage: 'preproduction_package',
      status: acceptance.status === 'ready'
        ? 'ready'
        : professionalReady && seedanceReady && imageStatus !== 'blocked'
          ? 'pending'
          : 'blocked',
      evidence_refs: [
        `preproduction_package:${input.preproduction.source.kind}:${input.preproduction.source.source_id}`,
        `preproduction_exported_at:${input.preproduction.exported_at}`,
      ],
      blockers: acceptance.blockers,
      retryable_failures: [],
    },
  ];
}

function runStatus(
  stages: StoryAgentRunStageResult[],
): Pick<StoryAgentRun, 'status' | 'current_stage'> {
  const current = stages.find(stage => stage.status !== 'ready');
  if (!current) return { status: 'ready', current_stage: 'complete' };
  if (stages.some(stage => stage.status === 'blocked')) {
    return { status: 'blocked', current_stage: current.stage };
  }
  if (stages.some(stage => stage.status === 'failed_retryable')) {
    return { status: 'failed_retryable', current_stage: current.stage };
  }
  if (stages.some(stage => stage.status === 'awaiting_external_action')) {
    return { status: 'awaiting_external_action', current_stage: current.stage };
  }
  return { status: 'in_progress', current_stage: current.stage };
}

function buildRun(input: {
  request: StoryAgentRunStartRequest;
  preproduction: StoryAgentSeedancePreproductionPackage;
  imageRun?: StoryAgentImageRun;
  imageFailure?: string;
  existing?: StoryAgentRun;
  now: string;
}): StoryAgentRun {
  const request = sourceRequest(input.request);
  const runId = runIdFor(request);
  const stages = stageResults(input);
  const state = runStatus(stages);
  return {
    schema_version: STORY_AGENT_RUN_SCHEMA_VERSION,
    run_id: runId,
    input_contract: {
      schema_version: STORY_AGENT_RUN_INPUT_SCHEMA_VERSION,
      ...request,
    },
    input_sha256: sha256(JSON.stringify({
      schema_version: STORY_AGENT_RUN_INPUT_SCHEMA_VERSION,
      ...request,
    })),
    source: input.preproduction.source,
    video_types: videoTypes(input.preproduction),
    ...state,
    stage_results: stages,
    blockers: unique(stages.flatMap(stage => stage.blockers)),
    retryable_failures: unique(stages.flatMap(stage => stage.retryable_failures)),
    image_request_manifest: input.imageRun
      ? {
          image_run_id: input.imageRun.run_id,
          image_run_status: input.imageRun.status,
          request_sha256: input.imageRun.request.request_sha256,
          request_path: input.imageRun.request_path,
          request: input.imageRun.request,
          provider_invoked: false,
          executor: 'codex_imagegen',
          task_count: input.imageRun.summary.task_count,
          pending_task_count: input.imageRun.summary.awaiting_imagegen_count,
          verified_task_count: input.imageRun.summary.verified_count,
          failed_retryable_task_count: input.imageRun.summary.failed_retryable_count,
          blocked_task_count: input.imageRun.summary.blocked_count,
        }
      : undefined,
    preproduction_package: input.preproduction,
    boundary: {
      canonical_services_reused: true,
      image_provider_invoked_by_server: false,
      video_generation_performed: false,
      human_review_credit_granted: false,
    },
    resume_count: input.existing?.resume_count ?? 0,
    created_at: input.existing?.created_at ?? input.now,
    updated_at: input.now,
  };
}

async function refreshRun(input: {
  request: StoryAgentRunStartRequest;
  existing?: StoryAgentRun;
  incrementResume: boolean;
}): Promise<ApiResponse<StoryAgentRun>> {
  const preproductionResult = await exportStoryAgentSeedancePreproductionPackage(
    sourceRequest(input.request),
  );
  if (!preproductionResult.ok || !preproductionResult.data) {
    return fail(
      normalizeErrorCode(preproductionResult.error?.code),
      preproductionResult.error?.message ?? 'Story Agent preproduction package export failed',
    );
  }
  const imageResult = await exportStoryAgentImageGenerationRequest(sourceRequest(input.request));
  const now = new Date().toISOString();
  const run = buildRun({
    request: input.request,
    preproduction: preproductionResult.data,
    imageRun: imageResult.data ?? undefined,
    imageFailure: imageResult.ok
      ? undefined
      : imageResult.error?.message ?? 'Story Agent image request export failed',
    existing: input.existing,
    now,
  });
  if (input.incrementResume) run.resume_count += 1;
  await persistRun(run);
  return success(run);
}

export async function startStoryAgentRun(
  request: StoryAgentRunStartRequest,
): Promise<ApiResponse<StoryAgentRun>> {
  const existing = await readRun(runIdFor(request));
  if (existing) return success(existing);
  return refreshRun({ request, incrementResume: false });
}

export async function getStoryAgentRun(
  runId: string,
): Promise<ApiResponse<StoryAgentRun>> {
  const run = await readRun(runId);
  return run
    ? success(run)
    : fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
}

export async function resumeStoryAgentRun(
  runId: string,
): Promise<ApiResponse<StoryAgentRun>> {
  const existing = await readRun(runId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
  }
  return refreshRun({
    request: {
      project_id: existing.input_contract.project_id,
      series_project_id: existing.input_contract.series_project_id,
    },
    existing,
    incrementResume: true,
  });
}

export async function importStoryAgentRunImages(
  runId: string,
  result: StoryAgentImageGenerationResult,
): Promise<ApiResponse<StoryAgentRunImageImportResponse>> {
  const existing = await readRun(runId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
  }
  const imageRunId = existing.image_request_manifest?.image_run_id;
  if (!imageRunId) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Story Agent run has no persisted image request manifest',
    );
  }
  if (result.run_id !== imageRunId) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Image result run_id must match the Story Agent run image_request_manifest',
    );
  }
  const imported = await importStoryAgentImageGenerationResult(imageRunId, result);
  if (!imported.ok || !imported.data) {
    return fail(
      normalizeErrorCode(imported.error?.code),
      imported.error?.message ?? 'Story Agent image result import failed',
    );
  }
  const resumed = await resumeStoryAgentRun(runId);
  if (!resumed.ok || !resumed.data) {
    return fail(
      normalizeErrorCode(resumed.error?.code),
      resumed.error?.message ?? 'Story Agent run refresh failed after image import',
    );
  }
  return success({
    schema_version: 'story-agent-run-image-import/v1',
    imported_at: new Date().toISOString(),
    image_import: imported.data,
    run: resumed.data,
  });
}

export async function exportStoryAgentRun(
  runId: string,
): Promise<ApiResponse<StoryAgentRunExportResponse>> {
  const run = await readRun(runId);
  if (!run) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
  }
  return success({
    schema_version: 'story-agent-run-export/v1',
    run_id: run.run_id,
    run_status: run.status,
    exported_at: new Date().toISOString(),
    video_generation_performed: false,
    preproduction_package: run.preproduction_package,
  });
}
