import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type {
  AiComicSeriesVisualIdentityKind,
  ApiResponse,
  StoryAgentImageGenerationRequest,
  StoryAgentImageGenerationRequestTask,
  StoryAgentImageGenerationResult,
  StoryAgentImageGenerationResultItem,
  StoryAgentImageResultImportResponse,
  StoryAgentImageRun,
  StoryAgentImageRunExportRequest,
  StoryAgentImageRunTask,
  StoryAgentSeedancePreproductionPackage,
} from '@shared/types.js';
import { ErrorCodes, fail, success } from '@shared/types.js';
import { FileArtifactStore } from '../repositories/artifact-store.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import {
  getProject,
  getProjectProductionBoard,
  uploadProjectSeedanceAssetFile,
} from './project-service.js';
import {
  exportAiComicSeriesSeedanceAssetReportPackage,
  getAiComicSeriesProject,
  uploadAiComicSeriesSeedanceAssetFile,
} from './ai-comic-series-service.js';
import { exportStoryAgentSeedancePreproductionPackage } from './story-agent-preproduction-package-service.js';

const IMAGE_RUN_SCHEMA_VERSION = 'story-agent-image-run/v1' as const;
const IMAGE_REQUEST_SCHEMA_VERSION = 'image-generation-request/v1' as const;
const IMAGE_RESULT_IMPORT_SCHEMA_VERSION = 'story-agent-image-result-import/v1' as const;
const IMAGE_RUN_ROOT_DIRECTORY = 'story-agent-image-runs';

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeErrorCode(code?: string): typeof ErrorCodes[keyof typeof ErrorCodes] {
  return Object.values(ErrorCodes).includes(code as typeof ErrorCodes[keyof typeof ErrorCodes])
    ? code as typeof ErrorCodes[keyof typeof ErrorCodes]
    : ErrorCodes.INTERNAL_ERROR;
}

function runsRoot(): string {
  return resolve(storyGeneratedRoot(), IMAGE_RUN_ROOT_DIRECTORY);
}

function runDirectory(runId: string): string {
  return resolve(runsRoot(), runId);
}

function runFilePath(runId: string): string {
  return resolve(runDirectory(runId), 'run.json');
}

function requestFilePath(runId: string): string {
  return resolve(runDirectory(runId), 'request.json');
}

function resultFilePath(runId: string): string {
  return resolve(runDirectory(runId), 'result.json');
}

function taskId(input: {
  sourceKind: StoryAgentSeedancePreproductionPackage['source']['kind'];
  sourceId: string;
  assetIds: string[];
  identityIds: string[];
}): string {
  const fingerprint = sha256(JSON.stringify({
    source_kind: input.sourceKind,
    source_id: input.sourceId,
    asset_ids: [...input.assetIds].sort(),
    identity_ids: [...input.identityIds].sort(),
  }));
  return `image-task-${fingerprint.slice(0, 24)}`;
}

function promptSha256(prompt: string, negativeConstraints: string[]): string {
  return sha256(JSON.stringify({
    prompt,
    negative_constraints: negativeConstraints,
  }));
}

function summarizeTasks(tasks: StoryAgentImageRunTask[]): StoryAgentImageRun['summary'] {
  return {
    task_count: tasks.length,
    awaiting_imagegen_count: tasks.filter(task => task.status === 'awaiting_imagegen').length,
    generated_count: tasks.filter(task => task.status === 'generated').length,
    ingested_count: tasks.filter(task => task.status === 'ingested').length,
    bound_count: tasks.filter(task => task.status === 'bound').length,
    verified_count: tasks.filter(task => task.status === 'verified').length,
    failed_retryable_count: tasks.filter(task => task.status === 'failed_retryable').length,
    blocked_count: tasks.filter(task => task.status === 'blocked').length,
  };
}

function runStatus(
  tasks: StoryAgentImageRunTask[],
): StoryAgentImageRun['status'] {
  if (tasks.length > 0 && tasks.every(task => task.status === 'verified')) return 'complete';
  if (tasks.some(task => task.status === 'blocked')) return 'blocked';
  if (tasks.every(task => task.status === 'awaiting_imagegen' || task.status === 'verified')) {
    return 'awaiting_imagegen';
  }
  return 'in_progress';
}

function withRunState(
  run: StoryAgentImageRun,
  tasks: StoryAgentImageRunTask[],
  updatedAt: string,
  acceptance = run.preproduction_acceptance,
): StoryAgentImageRun {
  return {
    ...run,
    status: runStatus(tasks),
    updated_at: updatedAt,
    tasks,
    summary: summarizeTasks(tasks),
    preproduction_acceptance: acceptance,
  };
}

async function readRun(runId: string): Promise<StoryAgentImageRun | undefined> {
  try {
    const parsed = JSON.parse(await readFile(runFilePath(runId), 'utf8')) as StoryAgentImageRun;
    return parsed.schema_version === IMAGE_RUN_SCHEMA_VERSION && parsed.run_id === runId
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

async function persistRun(run: StoryAgentImageRun): Promise<void> {
  const store = new FileArtifactStore(runDirectory(run.run_id));
  await store.writeText('run.json', `${JSON.stringify(run, null, 2)}\n`, {
    overwrite: 'replace',
  });
}

async function buildOrdinaryRequestTasks(input: {
  projectId: string;
  preproduction: StoryAgentSeedancePreproductionPackage;
}): Promise<ApiResponse<StoryAgentImageGenerationRequestTask[]>> {
  const [detailResult, boardResult] = await Promise.all([
    getProject(input.projectId),
    getProjectProductionBoard(input.projectId),
  ]);
  if (!detailResult.ok || !detailResult.data || !boardResult.ok || !boardResult.data) {
    return fail(
      normalizeErrorCode(detailResult.error?.code ?? boardResult.error?.code),
      detailResult.error?.message
        ?? boardResult.error?.message
        ?? `Project "${input.projectId}" not found`,
    );
  }
  const deliveredAssetIds = new Set(input.preproduction.image_assets.map(asset => asset.asset_id));
  const storyId = detailResult.data.current_story.storyId;
  const tasks = boardResult.data.image_asset_job_plan.requirements
    .filter(requirement => requirement.source_shot_ids.length > 0)
    .map(requirement => {
      const promptHash = promptSha256(requirement.prompt, requirement.negative_constraints);
      const id = taskId({
        sourceKind: input.preproduction.source.kind,
        sourceId: input.projectId,
        assetIds: [requirement.asset_id],
        identityIds: [],
      });
      return {
        task_id: id,
        kind: requirement.asset_kind,
        label: requirement.label,
        target_asset_ids: [requirement.asset_id],
        series_identity_ids: [],
        reference_slot: requirement.reference_slot,
        source_story_ids: [storyId],
        source_scene_ids: requirement.source_scene_ids,
        source_shot_ids: requirement.source_shot_ids,
        prompt: requirement.prompt,
        negative_constraints: requirement.negative_constraints,
        prompt_sha256: promptHash,
        expected_output_path: `outputs/${id}.png`,
        action: deliveredAssetIds.has(requirement.asset_id)
          ? 'reuse_verified' as const
          : 'generate' as const,
      };
    });
  return success(tasks);
}

function seriesIdentityPrompt(input: {
  identity: {
    canonical_description: string;
    continuity_constraints: string[];
  };
  world: {
    period: string;
    region: string;
    architectural_language: string[];
    lighting_and_color_rules: string[];
    material_rules: string[];
  };
  label: string;
  kind: AiComicSeriesVisualIdentityKind;
}): string {
  return [
    `${input.label} ${input.kind} 视觉一致性参考图`,
    input.identity.canonical_description,
    ...input.identity.continuity_constraints,
    `时代与地域：${input.world.period}，${input.world.region}`,
    input.world.architectural_language.length
      ? `建筑语言：${input.world.architectural_language.join('；')}`
      : '',
    input.world.lighting_and_color_rules.length
      ? `光色规则：${input.world.lighting_and_color_rules.join('；')}`
      : '',
    input.world.material_rules.length
      ? `材质规则：${input.world.material_rules.join('；')}`
      : '',
    '单张清晰设定图，主体、轮廓、材质和关键识别特征稳定，供逐镜 Seedance 引用。',
  ].filter(Boolean).join('；');
}

async function buildSeriesRequestTasks(input: {
  seriesProjectId: string;
  preproduction: StoryAgentSeedancePreproductionPackage;
}): Promise<ApiResponse<StoryAgentImageGenerationRequestTask[]>> {
  const [detailResult, reportResult] = await Promise.all([
    getAiComicSeriesProject(input.seriesProjectId),
    exportAiComicSeriesSeedanceAssetReportPackage(input.seriesProjectId),
  ]);
  if (!detailResult.ok || !detailResult.data || !reportResult.ok || !reportResult.data) {
    return fail(
      normalizeErrorCode(detailResult.error?.code ?? reportResult.error?.code),
      detailResult.error?.message
        ?? reportResult.error?.message
        ?? `AI comic series project "${input.seriesProjectId}" not found`,
    );
  }
  const report = reportResult.data;
  const detail = detailResult.data;
  const deliveredAssetIds = new Set(input.preproduction.image_assets.map(asset => asset.asset_id));
  const identityById = new Map(report.visual_bible.identities.map(identity => [
    identity.identity_id,
    identity,
  ]));
  const tasks: StoryAgentImageGenerationRequestTask[] = [];
  for (const asset of report.assets.filter(item => item.required_by_shot_count > 0)) {
    const identity = asset.series_identity_id
      ? identityById.get(asset.series_identity_id)
      : undefined;
    if (!identity || asset.kind === 'unknown') continue;
    const prompt = seriesIdentityPrompt({
      identity,
      world: report.visual_bible.world,
      label: asset.label,
      kind: identity.kind,
    });
    const negativeConstraints = unique([
      ...identity.negative_constraints,
      ...report.visual_bible.cultural_boundaries.map(boundary => boundary.statement),
    ]);
    const identityIds = [identity.identity_id];
    const id = taskId({
      sourceKind: input.preproduction.source.kind,
      sourceId: input.seriesProjectId,
      assetIds: [asset.asset_id],
      identityIds,
    });
    const matchingShots = report.shots.filter(shot => shot.required_asset_ids.includes(asset.asset_id));
    tasks.push({
      task_id: id,
      kind: identity.kind,
      label: asset.label,
      target_asset_ids: [asset.asset_id],
      series_identity_ids: identityIds,
      reference_slot: asset.reference_slot,
      source_story_ids: unique(asset.source_episode_nos.flatMap(episodeNo => {
        const storyId = detail.generated_episode_story_ids?.[String(episodeNo)];
        return storyId ? [storyId] : [];
      })),
      source_scene_ids: unique(matchingShots.flatMap(shot => (
        shot.source_scene_id === undefined ? [] : [shot.source_scene_id]
      ))),
      source_shot_ids: asset.source_shot_ids,
      prompt,
      negative_constraints: negativeConstraints,
      prompt_sha256: promptSha256(prompt, negativeConstraints),
      expected_output_path: `outputs/${id}.png`,
      action: deliveredAssetIds.has(asset.asset_id)
        ? 'reuse_verified'
        : 'generate',
    });
  }
  return success(tasks);
}

export async function exportStoryAgentImageGenerationRequest(
  request: StoryAgentImageRunExportRequest,
): Promise<ApiResponse<StoryAgentImageRun>> {
  const sourceCount = [request.project_id, request.series_project_id].filter(Boolean).length;
  if (sourceCount !== 1) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Exactly one of project_id or series_project_id is required for image generation runs',
    );
  }

  const preproductionResult = await exportStoryAgentSeedancePreproductionPackage(request);
  if (!preproductionResult.ok || !preproductionResult.data) {
    return fail(
      normalizeErrorCode(preproductionResult.error?.code),
      preproductionResult.error?.message ?? 'Story Agent preproduction package export failed',
    );
  }
  const preproduction = preproductionResult.data;
  const tasksResult = request.project_id
    ? await buildOrdinaryRequestTasks({
        projectId: request.project_id,
        preproduction,
      })
    : await buildSeriesRequestTasks({
        seriesProjectId: request.series_project_id!,
        preproduction,
      });
  if (!tasksResult.ok || !tasksResult.data) {
    return fail(
      normalizeErrorCode(tasksResult.error?.code),
      tasksResult.error?.message ?? 'Image generation request task planning failed',
    );
  }
  if (!tasksResult.data.length) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'No shot-bound image requirements are available for this source',
    );
  }

  const taskContract = tasksResult.data.map(task => ({
    task_id: task.task_id,
    kind: task.kind,
    label: task.label,
    target_asset_ids: task.target_asset_ids,
    series_identity_ids: task.series_identity_ids,
    prompt_sha256: task.prompt_sha256,
  }));
  const runId = `image-run-${sha256(JSON.stringify({
    source: preproduction.source,
    tasks: taskContract,
  })).slice(0, 24)}`;
  const existing = await readRun(runId);
  if (existing) return success(existing);

  const createdAt = new Date().toISOString();
  const directory = runDirectory(runId);
  const outputDirectory = resolve(directory, 'outputs');
  const requestHash = sha256(JSON.stringify({
    schema_version: IMAGE_REQUEST_SCHEMA_VERSION,
    run_id: runId,
    source: preproduction.source,
    tasks: tasksResult.data,
  }));
  const generationRequest: StoryAgentImageGenerationRequest = {
    schema_version: IMAGE_REQUEST_SCHEMA_VERSION,
    run_id: runId,
    source: preproduction.source,
    created_at: createdAt,
    request_sha256: requestHash,
    run_directory: directory,
    output_directory: outputDirectory,
    provider_invoked: false,
    executor: 'codex_imagegen',
    task_count: tasksResult.data.length,
    pending_task_count: tasksResult.data.filter(task => task.action === 'generate').length,
    verified_task_count: tasksResult.data.filter(task => task.action === 'reuse_verified').length,
    tasks: tasksResult.data,
    instructions: [
      'Codex must invoke imagegen outside the Story Agent server; the server never calls an image provider.',
      'Write each generated file beneath output_directory and preserve the task prompt_sha256.',
      'Return image-generation-result/v1, then import it through the Story Agent image-run API or MCP tool.',
      'A retry may include only unfinished tasks; successful content hashes are imported idempotently.',
    ],
  };
  const runTasks: StoryAgentImageRunTask[] = generationRequest.tasks.map(task => ({
    task_id: task.task_id,
    status: task.action === 'reuse_verified' ? 'verified' : 'awaiting_imagegen',
    prompt_sha256: task.prompt_sha256,
    target_asset_ids: task.target_asset_ids,
    series_identity_ids: task.series_identity_ids,
    local_paths: [],
    attempts: [],
    updated_at: createdAt,
  }));
  const run: StoryAgentImageRun = {
    schema_version: IMAGE_RUN_SCHEMA_VERSION,
    run_id: runId,
    source: preproduction.source,
    status: runStatus(runTasks),
    created_at: createdAt,
    updated_at: createdAt,
    request_path: requestFilePath(runId),
    result_path: resultFilePath(runId),
    request: generationRequest,
    tasks: runTasks,
    summary: summarizeTasks(runTasks),
    preproduction_acceptance: preproduction.acceptance,
  };
  await mkdir(outputDirectory, { recursive: true });
  const store = new FileArtifactStore(directory);
  await store.writeBatch([
    {
      relative_path: 'request.json',
      content: `${JSON.stringify(generationRequest, null, 2)}\n`,
      overwrite: 'replace',
    },
    {
      relative_path: 'run.json',
      content: `${JSON.stringify(run, null, 2)}\n`,
      overwrite: 'replace',
    },
  ]);
  return success(run);
}

export async function getStoryAgentImageRun(
  runId: string,
): Promise<ApiResponse<StoryAgentImageRun>> {
  const run = await readRun(runId);
  return run
    ? success(run)
    : fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent image run "${runId}" not found`);
}

function resultTaskIds(item: StoryAgentImageGenerationResultItem): string[] {
  return unique([item.task_id, ...(item.covers_task_ids ?? [])]);
}

async function safeOutputFilePath(
  run: StoryAgentImageRun,
  outputPath: string,
): Promise<string | undefined> {
  const directory = runDirectory(run.run_id);
  const filePath = isAbsolute(outputPath)
    ? resolve(outputPath)
    : resolve(directory, outputPath);
  const outputRoot = resolve(directory, 'outputs');
  const lexicalRelation = relative(outputRoot, filePath);
  if (
    !lexicalRelation
    || lexicalRelation.startsWith('..')
    || isAbsolute(lexicalRelation)
  ) return undefined;
  try {
    const [realOutputRoot, realFilePath] = await Promise.all([
      realpath(outputRoot),
      realpath(filePath),
    ]);
    const realRelation = relative(realOutputRoot, realFilePath);
    return realRelation && !realRelation.startsWith('..') && !isAbsolute(realRelation)
      ? realFilePath
      : undefined;
  } catch {
    return undefined;
  }
}

function extensionForMimeType(mimeType: string): string | undefined {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return undefined;
}

function attemptFor(
  task: StoryAgentImageRunTask,
  item: StoryAgentImageGenerationResultItem,
  recordedAt: string,
): StoryAgentImageRunTask['attempts'][number] {
  return {
    attempt_no: task.attempts.length + 1,
    recorded_at: recordedAt,
    result_status: item.status,
    content_sha256: item.content_sha256,
    provider: item.provider,
    provider_asset_id: item.provider_asset_id,
    model: item.model,
    failure_reason: item.failure_reason,
  };
}

async function importGeneratedTask(input: {
  run: StoryAgentImageRun;
  requestTask: StoryAgentImageGenerationRequestTask;
  item: StoryAgentImageGenerationResultItem;
  bytes: Buffer;
  originalFilename: string;
}): Promise<ApiResponse<string[]>> {
  const providerAssetId = input.item.provider_asset_id
    ?? `imagegen-${input.item.content_sha256!.slice(0, 24)}`;
  if (input.item.provider !== 'openai_imagegen' || input.item.model !== 'gpt-image-2') {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Generated image results must use trusted provider openai_imagegen and model gpt-image-2',
    );
  }
  const localPaths: string[] = [];
  if (input.run.source.kind === 'story_project') {
    const detailResult = await getProject(input.run.source.source_id);
    if (!detailResult.ok || !detailResult.data) {
      return fail(
        normalizeErrorCode(detailResult.error?.code),
        detailResult.error?.message ?? 'Story project disappeared before image import',
      );
    }
    const currentAssets = new Map(
      (detailResult.data.project.seedance_asset_library?.items ?? [])
        .map(asset => [asset.asset_id, asset]),
    );
    for (const assetId of input.requestTask.target_asset_ids) {
      const currentAsset = currentAssets.get(assetId);
      if (
        currentAsset
        && input.item.content_sha256
        && currentAsset.content_sha256 === input.item.content_sha256
        && currentAsset.local_path
      ) {
        localPaths.push(currentAsset.local_path);
        continue;
      }
      const uploadResult = await uploadProjectSeedanceAssetFile(input.run.source.source_id, {
        asset_id: assetId,
        label: input.requestTask.label,
        kind: input.requestTask.kind as 'character' | 'location' | 'prop',
        modality: 'image',
        reference_slot: input.requestTask.reference_slot,
        description: input.requestTask.prompt,
        trusted_source: {
          provider: 'openai_imagegen',
          provider_asset_id: providerAssetId,
          prompt_sha256: input.item.prompt_sha256,
          model: input.item.model,
        },
        file: {
          original_filename: input.originalFilename,
          mime_type: input.item.mime_type!,
          buffer: input.bytes,
        },
      });
      if (!uploadResult.ok || !uploadResult.data) {
        return fail(
          normalizeErrorCode(uploadResult.error?.code),
          uploadResult.error?.message ?? `Failed to upload image asset "${assetId}"`,
        );
      }
      localPaths.push(uploadResult.data.local_path);
    }
  } else if (input.run.source.kind === 'ai_comic_series_project') {
    const detailResult = await getAiComicSeriesProject(input.run.source.source_id);
    if (!detailResult.ok || !detailResult.data) {
      return fail(
        normalizeErrorCode(detailResult.error?.code),
        detailResult.error?.message ?? 'AI comic series project disappeared before image import',
      );
    }
    const currentAssets = new Map(
      (detailResult.data.seedance_asset_library?.items ?? [])
        .map(asset => [asset.asset_id, asset]),
    );
    for (const [index, assetId] of input.requestTask.target_asset_ids.entries()) {
      const currentAsset = currentAssets.get(assetId);
      if (
        currentAsset
        && input.item.content_sha256
        && currentAsset.content_sha256 === input.item.content_sha256
        && currentAsset.local_path
      ) {
        localPaths.push(currentAsset.local_path);
        continue;
      }
      const uploadResult = await uploadAiComicSeriesSeedanceAssetFile(input.run.source.source_id, {
        asset_id: assetId,
        label: input.requestTask.label,
        kind: input.requestTask.kind,
        reference_slot: input.requestTask.reference_slot,
        description: input.requestTask.prompt,
        series_identity_id: input.requestTask.series_identity_ids[index]
          ?? input.requestTask.series_identity_ids[0],
        trusted_source: {
          provider: 'openai_imagegen',
          provider_asset_id: providerAssetId,
          prompt_sha256: input.item.prompt_sha256,
          model: 'gpt-image-2',
        },
        file: {
          original_filename: input.originalFilename,
          mime_type: input.item.mime_type!,
          buffer: input.bytes,
        },
      });
      if (!uploadResult.ok || !uploadResult.data) {
        return fail(
          normalizeErrorCode(uploadResult.error?.code),
          uploadResult.error?.message ?? `Failed to upload series image asset "${assetId}"`,
        );
      }
      localPaths.push(uploadResult.data.local_path);
    }
  } else {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Direct story image results cannot be imported without a durable project asset library',
    );
  }
  return success(unique(localPaths));
}

export async function importStoryAgentImageGenerationResult(
  runId: string,
  result: StoryAgentImageGenerationResult,
): Promise<ApiResponse<StoryAgentImageResultImportResponse>> {
  const run = await readRun(runId);
  if (!run) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent image run "${runId}" not found`);
  }
  if (result.run_id !== runId || result.request_sha256 !== run.request.request_sha256) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Image result run_id and request_sha256 must match the persisted request',
    );
  }
  const requestTaskById = new Map(run.request.tasks.map(task => [task.task_id, task]));
  const seenTaskIds = new Set<string>();
  for (const item of result.items) {
    for (const id of resultTaskIds(item)) {
      if (!requestTaskById.has(id)) {
        return fail(ErrorCodes.VALIDATION_ERROR, `Unknown image result task_id "${id}"`);
      }
      if (seenTaskIds.has(id)) {
        return fail(ErrorCodes.VALIDATION_ERROR, `Image result task_id "${id}" is covered more than once`);
      }
      seenTaskIds.add(id);
    }
  }

  const recordedAt = new Date().toISOString();
  const tasksById = new Map(run.tasks.map(task => [task.task_id, task]));
  let ingestedTaskCount = 0;
  let skippedIdempotentTaskCount = 0;
  let failedTaskCount = 0;

  for (const item of result.items) {
    const coveredTaskIds = resultTaskIds(item);
    const coveredRequestTasks = coveredTaskIds.map(id => requestTaskById.get(id)!);
    if (coveredRequestTasks.some(task => task.prompt_sha256 !== item.prompt_sha256)) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `Image result prompt_sha256 does not match every covered task for "${item.task_id}"`,
      );
    }

    if (item.status !== 'generated') {
      for (const id of coveredTaskIds) {
        const current = tasksById.get(id)!;
        if (
          current.status === item.status
          && current.last_error === item.failure_reason
        ) {
          skippedIdempotentTaskCount += 1;
          continue;
        }
        tasksById.set(id, {
          ...current,
          status: item.status,
          attempts: [...current.attempts, attemptFor(current, item, recordedAt)],
          last_error: item.failure_reason,
          updated_at: recordedAt,
        });
        failedTaskCount += 1;
      }
      continue;
    }

    const outputFilePath = await safeOutputFilePath(run, item.output_path!);
    const extension = extensionForMimeType(item.mime_type!);
    if (!outputFilePath || !extension) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `Generated output for "${item.task_id}" must be a PNG, JPEG, or WebP beneath the run outputs directory`,
      );
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(outputFilePath);
    } catch {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `Generated output file for "${item.task_id}" does not exist`,
      );
    }
    if (sha256(bytes) !== item.content_sha256) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `Generated output content_sha256 mismatch for "${item.task_id}"`,
      );
    }

    for (const id of coveredTaskIds) {
      const current = tasksById.get(id)!;
      if (
        current.content_sha256 === item.content_sha256
        && ['ingested', 'bound', 'verified'].includes(current.status)
      ) {
        skippedIdempotentTaskCount += 1;
        continue;
      }
      const requestTask = requestTaskById.get(id)!;
      const imported = await importGeneratedTask({
        run,
        requestTask,
        item,
        bytes,
        originalFilename: `${id}${extension}`,
      });
      if (!imported.ok || !imported.data) {
        tasksById.set(id, {
          ...current,
          status: 'failed_retryable',
          attempts: [...current.attempts, attemptFor(current, {
            ...item,
            status: 'failed_retryable',
            failure_reason: imported.error?.message ?? 'Image asset import failed',
          }, recordedAt)],
          last_error: imported.error?.message ?? 'Image asset import failed',
          updated_at: recordedAt,
        });
        failedTaskCount += 1;
        continue;
      }
      tasksById.set(id, {
        ...current,
        status: 'ingested',
        content_sha256: item.content_sha256,
        local_paths: imported.data,
        attempts: [...current.attempts, attemptFor(current, item, recordedAt)],
        last_error: undefined,
        updated_at: recordedAt,
      });
      ingestedTaskCount += 1;
    }
  }

  const preproductionResult = await exportStoryAgentSeedancePreproductionPackage(
    run.source.kind === 'story_project'
      ? { project_id: run.source.source_id }
      : { series_project_id: run.source.source_id },
  );
  if (!preproductionResult.ok || !preproductionResult.data) {
    return fail(
      normalizeErrorCode(preproductionResult.error?.code),
      preproductionResult.error?.message ?? 'Failed to refresh Story Agent preproduction acceptance',
    );
  }
  const preproduction = preproductionResult.data;
  const deliveredAssetIds = new Set(preproduction.image_assets.map(asset => asset.asset_id));
  const finalTasks = [...tasksById.values()].map(task => {
    if (task.status !== 'ingested' && task.status !== 'bound') return task;
    const verified = task.target_asset_ids.every(assetId => deliveredAssetIds.has(assetId));
    return {
      ...task,
      status: verified ? 'verified' as const : 'bound' as const,
      updated_at: recordedAt,
    };
  });
  const updatedRun = withRunState(
    run,
    finalTasks,
    recordedAt,
    preproduction.acceptance,
  );
  const store = new FileArtifactStore(runDirectory(runId));
  await store.writeText('result.json', `${JSON.stringify(result, null, 2)}\n`, {
    overwrite: 'replace',
  });
  await persistRun(updatedRun);
  return success({
    schema_version: IMAGE_RESULT_IMPORT_SCHEMA_VERSION,
    imported_at: recordedAt,
    processed_item_count: result.items.length,
    ingested_task_count: ingestedTaskCount,
    verified_task_count: coveredVerifiedTaskCount(result, updatedRun),
    skipped_idempotent_task_count: skippedIdempotentTaskCount,
    failed_task_count: failedTaskCount,
    run: updatedRun,
    preproduction_package: preproduction,
  });
}

function coveredVerifiedTaskCount(
  result: StoryAgentImageGenerationResult,
  run: StoryAgentImageRun,
): number {
  const covered = new Set(result.items.flatMap(resultTaskIds));
  return run.tasks.filter(task => covered.has(task.task_id) && task.status === 'verified').length;
}
