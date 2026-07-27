import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ReferenceSimilarityEvidenceObservationsSchema,
  ReferenceTextAnalysisChunkSubmissionSchema,
  ReferenceTextAnalysisExecutionCreateRequestSchema,
  ReferenceTextAnalysisExecutionFinalizeRequestSchema,
  ReferenceTextAnalysisExecutionRecordSchema,
  ReferenceTextAnalysisPartialRecordSchema,
} from '@shared/schemas.js';
import type {
  ReferenceSimilarityDimension,
  ReferenceSimilarityEvidenceObservations,
  ReferenceTextAnalysisChunkSubmissionResult,
  ReferenceTextAnalysisExecutionCheckpoint,
  ReferenceTextAnalysisExecutionRecord,
  ReferenceTextAnalysisFinalizationResult,
  ReferenceTextAnalysisNextChunkResult,
  ReferenceTextAnalysisPartialObservations,
  ReferenceTextAnalysisPartialRecord,
  ReferenceTextMaterialManifest,
} from '@shared/types.js';
import {
  getReferenceAnalysisTask,
  submitReferenceAnalysisTask,
} from './reference-analysis-task-service.js';
import {
  getReferenceTextMaterialChunk,
  getReferenceTextMaterialManifest,
} from './reference-text-material-service.js';

const TASK_ID_PATTERN = /^reference-analysis-task-[a-f0-9-]+$/;
const CHUNK_ID_PATTERN = /^chunk-\d{4}$/;

class ReferenceTextAnalysisExecutionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReferenceTextAnalysisExecutionError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function executionDirectory(repoRoot: string, taskId: string): string {
  return path.resolve(
    repoRoot,
    'references/creative/library/text-analysis-executions',
    taskId,
  );
}

function executionPath(repoRoot: string, taskId: string): string {
  return path.join(executionDirectory(repoRoot, taskId), 'record.json');
}

function partialPath(
  repoRoot: string,
  taskId: string,
  chunkId: string,
): string {
  return path.join(
    executionDirectory(repoRoot, taskId),
    'partials',
    `${chunkId}.json`,
  );
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporaryPath, filePath);
}

async function writeJsonExclusive(
  filePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

function validateTaskId(taskId: string): string {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_NOT_FOUND',
      `Reference text analysis execution not found: ${taskId}`,
    );
  }
  return taskId;
}

function validateChunkId(chunkId: string): string {
  if (!CHUNK_ID_PATTERN.test(chunkId)) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_CHUNK_NOT_FOUND',
      `Reference text analysis chunk not found: ${chunkId}`,
    );
  }
  return chunkId;
}

function manifestSha256(manifest: ReferenceTextMaterialManifest): string {
  return sha256(JSON.stringify(manifest));
}

function deriveCursor(
  checkpoints: ReferenceTextAnalysisExecutionCheckpoint[],
): ReferenceTextAnalysisExecutionRecord['cursor'] {
  const next = checkpoints.find(checkpoint => checkpoint.status === 'pending');
  return {
    completed_chunk_count: checkpoints.filter(
      checkpoint => checkpoint.status === 'completed',
    ).length,
    next_chunk_id: next?.chunk_id ?? null,
  };
}

function checkpointFromManifest(
  manifest: ReferenceTextMaterialManifest,
): ReferenceTextAnalysisExecutionCheckpoint[] {
  return manifest.chunks.map(chunk => ({
    chunk_id: chunk.chunk_id,
    index: chunk.index,
    locator: chunk.locator,
    content_sha256: chunk.content_sha256,
    status: 'pending',
    partial_observations_sha256: null,
    submission_key_sha256: null,
    completed_at: null,
  }));
}

function executionId(taskId: string, materialId: string): string {
  return `reference-text-analysis-execution-${
    sha256(`${taskId}:${materialId}`).slice(0, 32)}`;
}

async function readExecution(input: {
  repoRoot: string;
  taskId: string;
}): Promise<ReferenceTextAnalysisExecutionRecord> {
  const taskId = validateTaskId(input.taskId);
  try {
    return ReferenceTextAnalysisExecutionRecordSchema.parse(
      JSON.parse(await readFile(
        executionPath(input.repoRoot, taskId),
        'utf8',
      )),
    ) as ReferenceTextAnalysisExecutionRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceTextAnalysisExecutionError(
        'REFERENCE_TEXT_ANALYSIS_EXECUTION_NOT_FOUND',
        `Reference text analysis execution not found: ${taskId}`,
      );
    }
    throw error;
  }
}

async function loadCanonicalState(input: {
  repoRoot: string;
  taskId: string;
}): Promise<{
  execution: ReferenceTextAnalysisExecutionRecord;
  manifest: ReferenceTextMaterialManifest;
}> {
  const execution = await readExecution(input);
  const task = await getReferenceAnalysisTask(input);
  if (
    task.reference_id !== execution.reference_id
    || task.manifest.source_material_transport !== 'stored_user_supplied'
    || task.manifest.source_material_id !== execution.material_id
  ) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_INTEGRITY_INVALID',
      'Reference analysis task no longer matches the sealed text execution',
    );
  }
  const manifest = await getReferenceTextMaterialManifest({
    repoRoot: input.repoRoot,
    referenceId: execution.reference_id,
  });
  const canonicalCheckpoints = checkpointFromManifest(manifest);
  if (
    execution.material_id !== manifest.material_id
    || execution.material_manifest_sha256 !== manifestSha256(manifest)
    || execution.checkpoints.length !== canonicalCheckpoints.length
    || execution.checkpoints.some((checkpoint, index) => {
      const canonical = canonicalCheckpoints[index];
      return checkpoint.chunk_id !== canonical.chunk_id
        || checkpoint.index !== canonical.index
        || checkpoint.locator !== canonical.locator
        || checkpoint.content_sha256 !== canonical.content_sha256;
    })
  ) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_INTEGRITY_INVALID',
      'Sealed text material manifest does not match the execution checkpoint ledger',
    );
  }
  const canonicalCursor = deriveCursor(execution.checkpoints);
  const expectedStatus = execution.status === 'completed'
    ? 'completed'
    : canonicalCursor.completed_chunk_count === 0
      ? 'pending'
      : canonicalCursor.next_chunk_id
        ? 'in_progress'
        : 'ready_to_finalize';
  if (
    execution.cursor.completed_chunk_count
      !== canonicalCursor.completed_chunk_count
    || execution.cursor.next_chunk_id !== canonicalCursor.next_chunk_id
    || execution.status !== expectedStatus
  ) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_INTEGRITY_INVALID',
      'Execution cursor or status does not match the checkpoint ledger',
    );
  }
  for (const checkpoint of execution.checkpoints) {
    if (checkpoint.status === 'pending') {
      if (
        checkpoint.partial_observations_sha256 !== null
        || checkpoint.submission_key_sha256 !== null
        || checkpoint.completed_at !== null
      ) {
        throw new ReferenceTextAnalysisExecutionError(
          'REFERENCE_TEXT_ANALYSIS_EXECUTION_INTEGRITY_INVALID',
          `Pending checkpoint contains completion fields: ${checkpoint.chunk_id}`,
        );
      }
      continue;
    }
    const partial = await readPartial({
      repoRoot: input.repoRoot,
      taskId: execution.task_id,
      chunkId: checkpoint.chunk_id,
    });
    if (!partial || !partialMatchesCheckpoint(partial, execution, checkpoint)) {
      throw new ReferenceTextAnalysisExecutionError(
        'REFERENCE_TEXT_ANALYSIS_EXECUTION_INTEGRITY_INVALID',
        `Completed checkpoint partial integrity mismatch: ${checkpoint.chunk_id}`,
      );
    }
  }
  return { execution, manifest };
}

export async function createReferenceTextAnalysisExecution(input: {
  repoRoot: string;
  taskId: string;
  request: unknown;
  now?: string;
}): Promise<{
  execution: ReferenceTextAnalysisExecutionRecord;
  idempotent_replay: boolean;
}> {
  const request = ReferenceTextAnalysisExecutionCreateRequestSchema.parse(
    input.request,
  );
  const task = await getReferenceAnalysisTask(input);
  try {
    const existing = await loadCanonicalState(input);
    if (
      existing.execution.executor.kind !== request.executor.kind
      || existing.execution.executor.executor_id
        !== request.executor.executor_id
    ) {
      throw new ReferenceTextAnalysisExecutionError(
        'REFERENCE_TEXT_ANALYSIS_EXECUTION_CONFLICT',
        'Text execution is already assigned to a different executor',
      );
    }
    return { execution: existing.execution, idempotent_replay: true };
  } catch (error) {
    if (
      !(error instanceof ReferenceTextAnalysisExecutionError)
      || error.code !== 'REFERENCE_TEXT_ANALYSIS_EXECUTION_NOT_FOUND'
    ) {
      throw error;
    }
  }
  if (
    task.status !== 'pending'
    || task.manifest.source_material_transport !== 'stored_user_supplied'
    || !task.manifest.source_material_id
    || !['novel', 'screenplay'].includes(task.source_snapshot.media_type)
  ) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_SOURCE_INVALID',
      'Text execution requires a pending novel or screenplay task bound to sealed user-supplied material',
    );
  }
  const manifest = await getReferenceTextMaterialManifest({
    repoRoot: input.repoRoot,
    referenceId: task.reference_id,
  });
  if (
    manifest.material_id !== task.manifest.source_material_id
    || manifest.source_content_fingerprint
      !== task.source_snapshot.content_fingerprint
  ) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_INTEGRITY_INVALID',
      'Task source snapshot does not match the sealed text manifest',
    );
  }

  const now = input.now ?? new Date().toISOString();
  const checkpoints = checkpointFromManifest(manifest);
  const execution = ReferenceTextAnalysisExecutionRecordSchema.parse({
    schema_version: 'reference-text-analysis-execution/v1',
    execution_id: executionId(task.task_id, manifest.material_id),
    task_id: task.task_id,
    reference_id: task.reference_id,
    material_id: manifest.material_id,
    material_manifest_sha256: manifestSha256(manifest),
    requested_dimensions: task.requested_dimensions,
    executor: request.executor,
    status: 'pending',
    cursor: deriveCursor(checkpoints),
    checkpoints,
    manifest: {
      server_model_call_allowed: false,
      source_text_instruction_authority: 'none',
      prompt_injection_allowed: false,
      knowledge_writeback_allowed: false,
      automatic_approval_allowed: false,
      production_credit_eligible: false,
    },
    evidence_id: null,
    evidence_payload_sha256: null,
    final_observations_sha256: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    human_review_complete: false,
    production_credit_granted: false,
  }) as ReferenceTextAnalysisExecutionRecord;
  await atomicWriteJson(executionPath(input.repoRoot, task.task_id), execution);
  return { execution, idempotent_replay: false };
}

export async function getReferenceTextAnalysisExecution(input: {
  repoRoot: string;
  taskId: string;
}): Promise<ReferenceTextAnalysisExecutionRecord> {
  return (await loadCanonicalState(input)).execution;
}

export async function getReferenceTextAnalysisNextChunk(input: {
  repoRoot: string;
  taskId: string;
}): Promise<ReferenceTextAnalysisNextChunkResult> {
  const { execution } = await loadCanonicalState(input);
  const next = execution.checkpoints.find(
    checkpoint => checkpoint.status === 'pending',
  );
  return {
    complete: !next,
    execution_id: execution.execution_id,
    requested_dimensions: execution.requested_dimensions,
    source_text_instruction_authority: 'none',
    chunk: next
      ? await getReferenceTextMaterialChunk({
          repoRoot: input.repoRoot,
          referenceId: execution.reference_id,
          chunkId: next.chunk_id,
        })
      : null,
  };
}

function validatePartialDimensions(
  requested: ReferenceSimilarityDimension[],
  observations: ReferenceTextAnalysisPartialObservations,
): void {
  const allowed = new Set(requested);
  const invalid =
    (!allowed.has('excerpt') && observations.excerpts.length > 0)
    || (
      !allowed.has('character_design')
      && observations.character_profiles.length > 0
    )
    || (!allowed.has('plot_structure') && observations.plot_beats.length > 0)
    || (!allowed.has('shot_sequence') && observations.shot_sequence.length > 0);
  if (invalid) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_DIMENSIONS_INVALID',
      'Chunk observations may only contain the task requested_dimensions',
    );
  }
}

async function readPartial(input: {
  repoRoot: string;
  taskId: string;
  chunkId: string;
}): Promise<ReferenceTextAnalysisPartialRecord | null> {
  try {
    return ReferenceTextAnalysisPartialRecordSchema.parse(
      JSON.parse(await readFile(
        partialPath(input.repoRoot, input.taskId, input.chunkId),
        'utf8',
      )),
    ) as ReferenceTextAnalysisPartialRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function partialMatchesCheckpoint(
  partial: ReferenceTextAnalysisPartialRecord,
  execution: ReferenceTextAnalysisExecutionRecord,
  checkpoint: ReferenceTextAnalysisExecutionCheckpoint,
): boolean {
  return partial.execution_id === execution.execution_id
    && partial.task_id === execution.task_id
    && partial.material_id === execution.material_id
    && partial.chunk_id === checkpoint.chunk_id
    && partial.chunk_content_sha256 === checkpoint.content_sha256
    && partial.observations_sha256
      === sha256(JSON.stringify(partial.observations))
    && partial.observations_sha256
      === checkpoint.partial_observations_sha256
    && partial.submission_key_sha256 === checkpoint.submission_key_sha256
    && partial.created_at === checkpoint.completed_at;
}

function samePartialSubmission(
  partial: ReferenceTextAnalysisPartialRecord,
  input: {
    submittedBy: string;
    submissionKeySha256: string;
    chunkContentSha256: string;
    observationsSha256: string;
  },
): boolean {
  return partial.submitted_by === input.submittedBy
    && partial.submission_key_sha256 === input.submissionKeySha256
    && partial.chunk_content_sha256 === input.chunkContentSha256
    && partial.observations_sha256 === input.observationsSha256;
}

export async function submitReferenceTextAnalysisChunk(input: {
  repoRoot: string;
  taskId: string;
  chunkId: string;
  request: unknown;
  now?: string;
}): Promise<ReferenceTextAnalysisChunkSubmissionResult> {
  const chunkId = validateChunkId(input.chunkId);
  const request = ReferenceTextAnalysisChunkSubmissionSchema.parse(
    input.request,
  );
  const state = await loadCanonicalState(input);
  let execution = state.execution;
  if (execution.status === 'completed') {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_CONFLICT',
      'Completed text execution cannot accept more chunk observations',
    );
  }
  if (request.submitted_by !== execution.executor.executor_id) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTOR_INVALID',
      'Chunk submitted_by must match the text execution executor',
    );
  }
  const checkpointIndex = execution.checkpoints.findIndex(
    checkpoint => checkpoint.chunk_id === chunkId,
  );
  if (checkpointIndex < 0) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_CHUNK_NOT_FOUND',
      `Reference text analysis chunk not found: ${chunkId}`,
    );
  }
  const canonicalChunk = await getReferenceTextMaterialChunk({
    repoRoot: input.repoRoot,
    referenceId: execution.reference_id,
    chunkId,
  });
  if (
    request.chunk_content_sha256 !== canonicalChunk.content_sha256
    || execution.checkpoints[checkpointIndex].content_sha256
      !== canonicalChunk.content_sha256
  ) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_CHUNK_INTEGRITY_INVALID',
      'Chunk submission hash does not match the sealed source chunk',
    );
  }
  validatePartialDimensions(
    execution.requested_dimensions,
    request.observations,
  );
  const submissionKeySha256 = sha256(request.submission_key);
  const observationsSha256 = sha256(JSON.stringify(request.observations));
  const existing = await readPartial({ ...input, chunkId });
  if (existing && !samePartialSubmission(existing, {
    submittedBy: request.submitted_by,
    submissionKeySha256,
    chunkContentSha256: request.chunk_content_sha256,
    observationsSha256,
  })) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_CONFLICT',
      `Chunk ${chunkId} is already completed by a different submission`,
    );
  }
  const now = input.now ?? new Date().toISOString();
  const partial = existing ?? ReferenceTextAnalysisPartialRecordSchema.parse({
    schema_version: 'reference-text-analysis-partial/v1',
    execution_id: execution.execution_id,
    task_id: execution.task_id,
    material_id: execution.material_id,
    chunk_id: chunkId,
    chunk_content_sha256: request.chunk_content_sha256,
    submitted_by: request.submitted_by,
    submission_key_sha256: submissionKeySha256,
    observations_sha256: observationsSha256,
    observations: request.observations,
    created_at: now,
    prompt_injection_allowed: false,
    knowledge_writeback_allowed: false,
    human_review_complete: false,
    production_credit_granted: false,
  }) as ReferenceTextAnalysisPartialRecord;
  if (!existing) {
    try {
      await writeJsonExclusive(
        partialPath(input.repoRoot, input.taskId, chunkId),
        partial,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const raced = await readPartial({ ...input, chunkId });
      if (!raced || !samePartialSubmission(raced, {
        submittedBy: request.submitted_by,
        submissionKeySha256,
        chunkContentSha256: request.chunk_content_sha256,
        observationsSha256,
      })) {
        throw new ReferenceTextAnalysisExecutionError(
          'REFERENCE_TEXT_ANALYSIS_EXECUTION_CONFLICT',
          `Chunk ${chunkId} was concurrently completed by another submission`,
        );
      }
    }
  }
  const checkpoint = {
    ...execution.checkpoints[checkpointIndex],
    status: 'completed' as const,
    partial_observations_sha256: observationsSha256,
    submission_key_sha256: submissionKeySha256,
    completed_at: existing?.created_at ?? now,
  };
  const checkpoints = execution.checkpoints.map((item, index) => (
    index === checkpointIndex ? checkpoint : item
  ));
  const cursor = deriveCursor(checkpoints);
  execution = ReferenceTextAnalysisExecutionRecordSchema.parse({
    ...execution,
    status: cursor.next_chunk_id ? 'in_progress' : 'ready_to_finalize',
    cursor,
    checkpoints,
    updated_at: now,
  }) as ReferenceTextAnalysisExecutionRecord;
  await atomicWriteJson(
    executionPath(input.repoRoot, execution.task_id),
    execution,
  );
  return {
    execution,
    checkpoint,
    idempotent_replay: Boolean(existing),
  };
}

function aggregatePartials(
  checkpoints: ReferenceTextAnalysisExecutionCheckpoint[],
  partials: ReferenceTextAnalysisPartialRecord[],
): ReferenceSimilarityEvidenceObservations {
  const byChunk = new Map(partials.map(partial => [
    partial.chunk_id,
    partial,
  ]));
  const excerpts: ReferenceSimilarityEvidenceObservations['excerpts'] = [];
  const characterProfiles:
    ReferenceSimilarityEvidenceObservations['character_profiles'] = [];
  const plotBeats: ReferenceSimilarityEvidenceObservations['plot_beats'] = [];
  const shotSequence:
    ReferenceSimilarityEvidenceObservations['shot_sequence'] = [];
  for (const checkpoint of checkpoints) {
    const partial = byChunk.get(checkpoint.chunk_id);
    if (!partial) {
      throw new ReferenceTextAnalysisExecutionError(
        'REFERENCE_TEXT_ANALYSIS_EXECUTION_INTEGRITY_INVALID',
        `Completed checkpoint is missing partial observations: ${checkpoint.chunk_id}`,
      );
    }
    excerpts.push(...partial.observations.excerpts.map(observation => ({
      ...observation,
      observation_id: `${checkpoint.chunk_id}:${observation.observation_id}`,
      source_locator: `${checkpoint.locator}; ${observation.source_locator}`,
    })));
    characterProfiles.push(
      ...partial.observations.character_profiles.map(observation => ({
        ...observation,
        observation_id: `${checkpoint.chunk_id}:${observation.observation_id}`,
      })),
    );
    plotBeats.push(
      ...[...partial.observations.plot_beats]
        .sort((left, right) => left.order - right.order)
        .map(observation => ({
          ...observation,
          observation_id: `${checkpoint.chunk_id}:${observation.observation_id}`,
        })),
    );
    shotSequence.push(
      ...[...partial.observations.shot_sequence]
        .sort((left, right) => left.order - right.order)
        .map(observation => ({
          ...observation,
          observation_id: `${checkpoint.chunk_id}:${observation.observation_id}`,
        })),
    );
  }
  return ReferenceSimilarityEvidenceObservationsSchema.parse({
    excerpts: excerpts.slice(0, 20),
    character_profiles: characterProfiles.slice(0, 50),
    plot_beats: plotBeats.slice(0, 100).map((observation, index) => ({
      ...observation,
      order: index + 1,
    })),
    shot_sequence: shotSequence.slice(0, 500).map((observation, index) => ({
      ...observation,
      order: index + 1,
    })),
  }) as ReferenceSimilarityEvidenceObservations;
}

async function loadVerifiedPartials(input: {
  repoRoot: string;
  execution: ReferenceTextAnalysisExecutionRecord;
}): Promise<ReferenceTextAnalysisPartialRecord[]> {
  const partials: ReferenceTextAnalysisPartialRecord[] = [];
  for (const checkpoint of input.execution.checkpoints) {
    if (checkpoint.status !== 'completed') {
      throw new ReferenceTextAnalysisExecutionError(
        'REFERENCE_TEXT_ANALYSIS_EXECUTION_NOT_READY',
        'Every sealed source chunk must be completed before finalization',
      );
    }
    const partial = await readPartial({
      repoRoot: input.repoRoot,
      taskId: input.execution.task_id,
      chunkId: checkpoint.chunk_id,
    });
    if (
      !partial
      || !partialMatchesCheckpoint(
        partial,
        input.execution,
        checkpoint,
      )
    ) {
      throw new ReferenceTextAnalysisExecutionError(
        'REFERENCE_TEXT_ANALYSIS_EXECUTION_INTEGRITY_INVALID',
        `Partial observation integrity mismatch: ${checkpoint.chunk_id}`,
      );
    }
    partials.push(partial);
  }
  return partials;
}

export async function finalizeReferenceTextAnalysisExecution(input: {
  repoRoot: string;
  taskId: string;
  request: unknown;
  now?: string;
}): Promise<ReferenceTextAnalysisFinalizationResult> {
  const request = ReferenceTextAnalysisExecutionFinalizeRequestSchema.parse(
    input.request,
  );
  const state = await loadCanonicalState(input);
  let execution = state.execution;
  if (request.finalized_by !== execution.executor.executor_id) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTOR_INVALID',
      'finalized_by must match the text execution executor',
    );
  }
  if (!['ready_to_finalize', 'completed'].includes(execution.status)) {
    throw new ReferenceTextAnalysisExecutionError(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_NOT_READY',
      'Text execution is not ready to finalize',
    );
  }
  const partials = await loadVerifiedPartials({
    repoRoot: input.repoRoot,
    execution,
  });
  const observations = aggregatePartials(execution.checkpoints, partials);
  const submission = await submitReferenceAnalysisTask({
    repoRoot: input.repoRoot,
    taskId: execution.task_id,
    request: {
      submission_key: `text-execution:${execution.execution_id}`,
      observations,
    },
    now: input.now,
  });
  const completedAt = input.now ?? new Date().toISOString();
  execution = ReferenceTextAnalysisExecutionRecordSchema.parse({
    ...execution,
    status: 'completed',
    evidence_id: submission.evidence.evidence_id,
    evidence_payload_sha256: submission.evidence.payload_sha256,
    final_observations_sha256: sha256(JSON.stringify(observations)),
    updated_at: completedAt,
    completed_at: completedAt,
  }) as ReferenceTextAnalysisExecutionRecord;
  await atomicWriteJson(
    executionPath(input.repoRoot, execution.task_id),
    execution,
  );
  return {
    execution,
    task: submission.task,
    evidence: submission.evidence,
    idempotent_replay: submission.idempotent_replay,
  };
}
