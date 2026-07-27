import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ReferenceAnalysisTaskCreateRequestSchema,
  ReferenceAnalysisTaskRecordSchema,
  ReferenceAnalysisTaskSubmissionSchema,
} from '@shared/schemas.js';
import type {
  ReferenceAnalysisTaskRecord,
  ReferenceAnalysisTaskSubmissionResult,
  ReferenceSimilarityDimension,
  ReferenceSimilarityEvidenceObservations,
} from '@shared/types.js';
import {
  createReferenceSimilarityEvidence,
  getReferenceSimilarityEvidence,
  getReferenceSource,
} from './reference-library-service.js';
import {
  getReferenceTextMaterialManifest,
} from './reference-text-material-service.js';

const TASK_ID_PATTERN = /^reference-analysis-task-[a-f0-9-]+$/;

class ReferenceAnalysisTaskError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReferenceAnalysisTaskError';
  }
}

function tasksDirectory(repoRoot: string): string {
  return path.resolve(
    repoRoot,
    'references/creative/library/analysis-tasks',
  );
}

function taskPath(repoRoot: string, taskId: string): string {
  return path.join(tasksDirectory(repoRoot), `${taskId}.json`);
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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function observationsSha256(
  observations: ReferenceSimilarityEvidenceObservations,
): string {
  return sha256(JSON.stringify(observations));
}

function validateTaskId(taskId: string): string {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new ReferenceAnalysisTaskError(
      'REFERENCE_ANALYSIS_TASK_NOT_FOUND',
      `Reference analysis task not found: ${taskId}`,
    );
  }
  return taskId;
}

export async function createReferenceAnalysisTask(input: {
  repoRoot: string;
  referenceId: string;
  request: unknown;
  now?: string;
}): Promise<ReferenceAnalysisTaskRecord> {
  const request = ReferenceAnalysisTaskCreateRequestSchema.parse(input.request);
  const source = await getReferenceSource({
    repoRoot: input.repoRoot,
    referenceId: input.referenceId,
  });
  if (
    !['user_owned', 'licensed', 'public_domain'].includes(source.rights_status)
    || !['excerpt', 'full_user_supplied'].includes(source.access_scope)
    || !source.content_fingerprint
  ) {
    throw new ReferenceAnalysisTaskError(
      'REFERENCE_ANALYSIS_TASK_SOURCE_INVALID',
      'Reference analysis tasks require user-owned, licensed, or public-domain material with an excerpt or full-user-supplied fingerprint',
    );
  }
  if (request.authorization.basis !== source.rights_status) {
    throw new ReferenceAnalysisTaskError(
      'REFERENCE_ANALYSIS_TASK_AUTHORIZATION_INVALID',
      'Task authorization basis must match the reference source rights status',
    );
  }
  let sourceMaterialManifest: Awaited<
    ReturnType<typeof getReferenceTextMaterialManifest>
  > | undefined;
  if (source.media_type === 'novel' || source.media_type === 'screenplay') {
    try {
      sourceMaterialManifest = await getReferenceTextMaterialManifest({
        repoRoot: input.repoRoot,
        referenceId: source.reference_id,
      });
    } catch (error) {
      if (
        (error as { code?: string }).code
        !== 'REFERENCE_TEXT_MATERIAL_NOT_FOUND'
      ) {
        throw error;
      }
    }
  }

  const taskId = `reference-analysis-task-${randomUUID()}`;
  const now = input.now ?? new Date().toISOString();
  const record = ReferenceAnalysisTaskRecordSchema.parse({
    schema_version: 'reference-analysis-task/v2',
    task_id: taskId,
    reference_id: source.reference_id,
    source_snapshot: {
      title: source.title,
      media_type: source.media_type,
      rights_status: source.rights_status,
      access_scope: source.access_scope,
      content_fingerprint: source.content_fingerprint,
    },
    requested_dimensions: request.requested_dimensions,
    authorization: {
      ...request.authorization,
      machine_verified: false,
    },
    status: 'pending',
    manifest: {
      executor: 'codex_or_operator',
      ...(sourceMaterialManifest
        ? {
            source_material_transport: 'stored_user_supplied' as const,
            source_material_id: sourceMaterialManifest.material_id,
            source_material_manifest_endpoint:
              `/api/reference-library/references/${source.reference_id}`
              + '/text-material/manifest',
          }
        : {
            source_material_transport:
              'out_of_band_user_authorized' as const,
          }),
      server_download_allowed: false,
      input_provenance: 'operator_submitted',
      output_schema: 'reference-similarity-evidence/v1',
      output_submission_endpoint:
        `/api/reference-library/analysis-tasks/${taskId}/submissions`,
      prompt_injection_allowed: false,
      knowledge_writeback_allowed: false,
    },
    submission_key_sha256: null,
    observations_sha256: null,
    evidence_id: null,
    evidence_payload_sha256: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    human_review_complete: false,
    real_credit_granted: false,
  }) as ReferenceAnalysisTaskRecord;
  await atomicWriteJson(taskPath(input.repoRoot, taskId), record);
  return record;
}

export async function getReferenceAnalysisTask(input: {
  repoRoot: string;
  taskId: string;
}): Promise<ReferenceAnalysisTaskRecord> {
  const taskId = validateTaskId(input.taskId);
  try {
    return ReferenceAnalysisTaskRecordSchema.parse(
      JSON.parse(await readFile(taskPath(input.repoRoot, taskId), 'utf8')),
    ) as ReferenceAnalysisTaskRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceAnalysisTaskError(
        'REFERENCE_ANALYSIS_TASK_NOT_FOUND',
        `Reference analysis task not found: ${taskId}`,
      );
    }
    throw error;
  }
}

export async function listReferenceAnalysisTasks(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceAnalysisTaskRecord[]> {
  const source = await getReferenceSource({
    repoRoot: input.repoRoot,
    referenceId: input.referenceId,
  });
  let names: string[];
  try {
    names = await readdir(tasksDirectory(input.repoRoot));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const tasks = await Promise.all(
    names
      .filter(name => /^reference-analysis-task-[a-f0-9-]+\.json$/.test(name))
      .map(name => getReferenceAnalysisTask({
        repoRoot: input.repoRoot,
        taskId: name.slice(0, -'.json'.length),
      })),
  );
  return tasks
    .filter(task => task.reference_id === source.reference_id)
    .sort((left, right) => (
      right.created_at.localeCompare(left.created_at)
      || left.task_id.localeCompare(right.task_id)
    ));
}

export async function submitReferenceAnalysisTask(input: {
  repoRoot: string;
  taskId: string;
  request: unknown;
  now?: string;
}): Promise<ReferenceAnalysisTaskSubmissionResult> {
  const request = ReferenceAnalysisTaskSubmissionSchema.parse(input.request);
  let task = await getReferenceAnalysisTask(input);
  const submissionKeySha256 = sha256(request.submission_key);
  const submittedObservationsSha256 = observationsSha256(request.observations);

  if (task.status === 'completed') {
    if (
      task.submission_key_sha256 !== submissionKeySha256
      || task.observations_sha256 !== submittedObservationsSha256
      || !task.evidence_id
    ) {
      throw new ReferenceAnalysisTaskError(
        'REFERENCE_ANALYSIS_TASK_CONFLICT',
        'Reference analysis task is already completed by a different submission',
      );
    }
    return {
      task,
      evidence: await getReferenceSimilarityEvidence({
        repoRoot: input.repoRoot,
        evidenceId: task.evidence_id,
      }),
      idempotent_replay: true,
    };
  }

  validateSubmittedDimensions(task.requested_dimensions, request.observations);
  if (task.status === 'processing') {
    if (
      task.submission_key_sha256 !== submissionKeySha256
      || task.observations_sha256 !== submittedObservationsSha256
    ) {
      throw new ReferenceAnalysisTaskError(
        'REFERENCE_ANALYSIS_TASK_CONFLICT',
        'Reference analysis task is processing a different submission',
      );
    }
  } else {
    const now = input.now ?? new Date().toISOString();
    task = ReferenceAnalysisTaskRecordSchema.parse({
      ...task,
      status: 'processing',
      submission_key_sha256: submissionKeySha256,
      observations_sha256: submittedObservationsSha256,
      updated_at: now,
    }) as ReferenceAnalysisTaskRecord;
    await atomicWriteJson(taskPath(input.repoRoot, task.task_id), task);
  }

  const { machine_verified: _machineVerified, ...authorization } = task.authorization;
  const evidenceId = `reference-similarity-evidence-${sha256(task.task_id).slice(0, 32)}`;
  const evidence = await createReferenceSimilarityEvidence({
    repoRoot: input.repoRoot,
    referenceId: task.reference_id,
    request: {
      source_content_fingerprint: task.source_snapshot.content_fingerprint,
      input_provenance: 'operator_submitted',
      authorization,
      observations: request.observations,
    },
    analysisTaskId: task.task_id,
    evidenceId,
    now: input.now,
  });
  const completedAt = input.now ?? new Date().toISOString();
  task = ReferenceAnalysisTaskRecordSchema.parse({
    ...task,
    status: 'completed',
    evidence_id: evidence.evidence_id,
    evidence_payload_sha256: evidence.payload_sha256,
    updated_at: completedAt,
    completed_at: completedAt,
  }) as ReferenceAnalysisTaskRecord;
  await atomicWriteJson(taskPath(input.repoRoot, task.task_id), task);
  return {
    task,
    evidence,
    idempotent_replay: false,
  };
}

function validateSubmittedDimensions(
  requested: ReferenceSimilarityDimension[],
  observations: ReferenceSimilarityEvidenceObservations,
): void {
  const submitted: ReferenceSimilarityDimension[] = [];
  if (observations.excerpts.length) submitted.push('excerpt');
  if (observations.character_profiles.length) submitted.push('character_design');
  if (observations.plot_beats.length) submitted.push('plot_structure');
  if (observations.shot_sequence.length) submitted.push('shot_sequence');
  const requestedSet = new Set(requested);
  const submittedSet = new Set(submitted);
  if (
    requestedSet.size !== submittedSet.size
    || requested.some(dimension => !submittedSet.has(dimension))
    || submitted.some(dimension => !requestedSet.has(dimension))
  ) {
    throw new ReferenceAnalysisTaskError(
      'REFERENCE_ANALYSIS_TASK_DIMENSIONS_INVALID',
      'Submitted observations must cover exactly the task requested_dimensions',
    );
  }
}
