import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ReferenceTextAnalysisDraftSubmissionSchema,
  ReferenceTextAnalysisDraftTaskCreateRequestSchema,
  ReferenceTextAnalysisDraftTaskRecordSchema,
} from '@shared/schemas.js';
import type {
  ReferenceAnalysisTaskRecord,
  ReferenceSimilarityEvidenceRecord,
  ReferenceTextAnalysisDraftSubmissionResult,
  ReferenceTextAnalysisDraftTaskRecord,
  ReferenceTextAnalysisExecutionRecord,
  TextReferenceAnalysis,
} from '@shared/types.js';
import {
  getReferenceAnalysisTask,
} from './reference-analysis-task-service.js';
import {
  createEvidenceBoundTextReferenceAnalysis,
  getReferenceAnalysis,
  getReferenceSimilarityEvidence,
} from './reference-library-service.js';
import {
  getReferenceTextAnalysisExecution,
} from './reference-text-analysis-execution-service.js';

const TASK_ID_PATTERN = /^reference-analysis-task-[a-f0-9-]+$/;

class ReferenceTextAnalysisDraftTaskError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReferenceTextAnalysisDraftTaskError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function validateTaskId(taskId: string): string {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_ANALYSIS_TASK_NOT_FOUND',
      `Reference analysis task not found: ${taskId}`,
    );
  }
  return taskId;
}

function draftTasksDirectory(repoRoot: string): string {
  return path.resolve(
    repoRoot,
    'references/creative/library/analysis-draft-tasks',
  );
}

function draftTaskPath(repoRoot: string, draftTaskId: string): string {
  return path.join(draftTasksDirectory(repoRoot), `${draftTaskId}.json`);
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

function draftTaskId(
  analysisTaskId: string,
  textExecutionId: string,
  evidenceId: string,
): string {
  return `reference-text-analysis-draft-task-${
    sha256(`${analysisTaskId}:${textExecutionId}:${evidenceId}`).slice(0, 32)}`;
}

function analysisId(draftId: string): string {
  return `analysis-${sha256(draftId).slice(0, 32)}`;
}

async function loadCompletedSource(input: {
  repoRoot: string;
  taskId: string;
}): Promise<{
  analysisTask: ReferenceAnalysisTaskRecord;
  execution: ReferenceTextAnalysisExecutionRecord;
  evidence: ReferenceSimilarityEvidenceRecord;
  draftTaskId: string;
}> {
  const taskId = validateTaskId(input.taskId);
  const analysisTask = await getReferenceAnalysisTask({
    repoRoot: input.repoRoot,
    taskId,
  });
  let execution: ReferenceTextAnalysisExecutionRecord;
  try {
    execution = await getReferenceTextAnalysisExecution({
      repoRoot: input.repoRoot,
      taskId,
    });
  } catch (error) {
    if (
      (error as { code?: string }).code
        === 'REFERENCE_TEXT_ANALYSIS_EXECUTION_NOT_FOUND'
    ) {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_DRAFT_SOURCE_INVALID',
        'Text analysis draft requires a completed text execution and operator evidence',
      );
    }
    throw error;
  }
  if (
    analysisTask.status !== 'completed'
    || execution.status !== 'completed'
    || !analysisTask.evidence_id
    || !analysisTask.evidence_payload_sha256
    || !execution.evidence_id
    || !execution.evidence_payload_sha256
    || !execution.final_observations_sha256
    || analysisTask.evidence_id !== execution.evidence_id
    || analysisTask.evidence_payload_sha256
      !== execution.evidence_payload_sha256
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_SOURCE_INVALID',
      'Text analysis draft requires a completed text execution and operator evidence',
    );
  }
  const evidence = await getReferenceSimilarityEvidence({
    repoRoot: input.repoRoot,
    evidenceId: analysisTask.evidence_id,
  });
  if (
    evidence.analysis_task_id !== analysisTask.task_id
    || evidence.reference_id !== analysisTask.reference_id
    || evidence.source_content_fingerprint
      !== analysisTask.source_snapshot.content_fingerprint
    || evidence.payload_sha256 !== analysisTask.evidence_payload_sha256
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Operator evidence does not match the completed source task',
    );
  }
  return {
    analysisTask,
    execution,
    evidence,
    draftTaskId: draftTaskId(
      analysisTask.task_id,
      execution.execution_id,
      evidence.evidence_id,
    ),
  };
}

async function readDraftTask(input: {
  repoRoot: string;
  draftTaskId: string;
}): Promise<ReferenceTextAnalysisDraftTaskRecord> {
  try {
    return ReferenceTextAnalysisDraftTaskRecordSchema.parse(
      JSON.parse(await readFile(
        draftTaskPath(input.repoRoot, input.draftTaskId),
        'utf8',
      )),
    ) as ReferenceTextAnalysisDraftTaskRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_DRAFT_TASK_NOT_FOUND',
        `Reference text analysis draft task not found: ${input.draftTaskId}`,
      );
    }
    throw error;
  }
}

function verifyDraftTask(
  draftTask: ReferenceTextAnalysisDraftTaskRecord,
  source: Awaited<ReturnType<typeof loadCompletedSource>>,
): void {
  if (
    draftTask.draft_task_id !== source.draftTaskId
    || draftTask.analysis_task_id !== source.analysisTask.task_id
    || draftTask.text_execution_id !== source.execution.execution_id
    || draftTask.reference_id !== source.analysisTask.reference_id
    || draftTask.source_content_fingerprint
      !== source.analysisTask.source_snapshot.content_fingerprint
    || draftTask.similarity_evidence_id !== source.evidence.evidence_id
    || draftTask.similarity_evidence_payload_sha256
      !== source.evidence.payload_sha256
    || draftTask.final_observations_sha256
      !== source.execution.final_observations_sha256
    || JSON.stringify(draftTask.requested_dimensions)
      !== JSON.stringify(source.analysisTask.requested_dimensions)
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Draft task no longer matches its source execution and evidence',
    );
  }
  if (
    draftTask.status === 'pending'
    && (
      draftTask.submission_key_sha256 !== null
      || draftTask.analysis_payload_sha256 !== null
      || draftTask.submitted_at !== null
      || draftTask.analysis_id !== null
    )
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Pending draft task contains submission result fields',
    );
  }
  if (
    draftTask.status === 'completed'
    && (
      !draftTask.submission_key_sha256
      || !draftTask.analysis_payload_sha256
      || !draftTask.submitted_at
      || !draftTask.analysis_id
      || !draftTask.completed_at
    )
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Completed draft task is missing immutable result fields',
    );
  }
  if (
    draftTask.status === 'processing'
    && (
      !draftTask.submission_key_sha256
      || !draftTask.analysis_payload_sha256
      || !draftTask.submitted_at
      || draftTask.analysis_id !== null
      || draftTask.completed_at !== null
    )
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Processing draft task has inconsistent submission fields',
    );
  }
}

export async function createReferenceTextAnalysisDraftTask(input: {
  repoRoot: string;
  taskId: string;
  request: unknown;
  now?: string;
}): Promise<{
  draftTask: ReferenceTextAnalysisDraftTaskRecord;
  idempotent_replay: boolean;
}> {
  const request = ReferenceTextAnalysisDraftTaskCreateRequestSchema.parse(
    input.request,
  );
  const source = await loadCompletedSource(input);
  try {
    const existing = await readDraftTask({
      repoRoot: input.repoRoot,
      draftTaskId: source.draftTaskId,
    });
    verifyDraftTask(existing, source);
    if (
      existing.executor.kind !== request.executor.kind
      || existing.executor.executor_id !== request.executor.executor_id
    ) {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_DRAFT_TASK_CONFLICT',
        'Text analysis draft task is already assigned to a different executor',
      );
    }
    return { draftTask: existing, idempotent_replay: true };
  } catch (error) {
    if (
      !(error instanceof ReferenceTextAnalysisDraftTaskError)
      || error.code !== 'REFERENCE_TEXT_ANALYSIS_DRAFT_TASK_NOT_FOUND'
    ) {
      throw error;
    }
  }
  const now = input.now ?? new Date().toISOString();
  const record = ReferenceTextAnalysisDraftTaskRecordSchema.parse({
    schema_version: 'reference-text-analysis-draft-task/v1',
    draft_task_id: source.draftTaskId,
    analysis_task_id: source.analysisTask.task_id,
    text_execution_id: source.execution.execution_id,
    reference_id: source.analysisTask.reference_id,
    source_content_fingerprint:
      source.analysisTask.source_snapshot.content_fingerprint,
    similarity_evidence_id: source.evidence.evidence_id,
    similarity_evidence_payload_sha256: source.evidence.payload_sha256,
    final_observations_sha256:
      source.execution.final_observations_sha256,
    requested_dimensions: source.analysisTask.requested_dimensions,
    executor: request.executor,
    status: 'pending',
    manifest: {
      evidence_endpoint:
        `/api/reference-library/similarity-evidence/${source.evidence.evidence_id}`,
      output_submission_endpoint:
        `/api/reference-library/analysis-tasks/${source.analysisTask.task_id}`
        + '/text-analysis-draft-task/submissions',
      server_model_call_allowed: false,
      source_text_instruction_authority: 'none',
      output_schema: 'reference-analysis-record/v2',
      output_approval_status: 'pending',
      automatic_approval_allowed: false,
      prompt_injection_allowed: false,
      knowledge_writeback_allowed: false,
      production_credit_eligible: false,
    },
    submission_key_sha256: null,
    analysis_payload_sha256: null,
    submitted_at: null,
    analysis_id: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    human_review_complete: false,
    production_credit_granted: false,
  }) as ReferenceTextAnalysisDraftTaskRecord;
  await atomicWriteJson(draftTaskPath(input.repoRoot, record.draft_task_id), record);
  return { draftTask: record, idempotent_replay: false };
}

export async function getReferenceTextAnalysisDraftTask(input: {
  repoRoot: string;
  taskId: string;
}): Promise<ReferenceTextAnalysisDraftTaskRecord> {
  const source = await loadCompletedSource(input);
  const draftTask = await readDraftTask({
    repoRoot: input.repoRoot,
    draftTaskId: source.draftTaskId,
  });
  verifyDraftTask(draftTask, source);
  if (draftTask.status === 'completed') {
    await getVerifiedDraftAnalysis({
      repoRoot: input.repoRoot,
      draftTask,
      source,
    });
  }
  return draftTask;
}

function analysisPayloadSha256(analysis: TextReferenceAnalysis): string {
  return sha256(JSON.stringify(analysis));
}

async function getVerifiedDraftAnalysis(input: {
  repoRoot: string;
  draftTask: ReferenceTextAnalysisDraftTaskRecord;
  source: Awaited<ReturnType<typeof loadCompletedSource>>;
}): Promise<ReferenceTextAnalysisDraftSubmissionResult['analysis']> {
  const { draftTask, source } = input;
  if (
    draftTask.status !== 'completed'
    || !draftTask.analysis_id
    || !draftTask.analysis_payload_sha256
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Draft analysis can only be verified after task completion',
    );
  }
  const analysis = await getReferenceAnalysis({
    repoRoot: input.repoRoot,
    analysisId: draftTask.analysis_id,
  });
  const provenance = analysis.analysis_type === 'text'
    ? analysis.provenance
    : undefined;
  const governance = analysis.analysis_type === 'text'
    ? analysis.governance
    : undefined;
  if (
    analysis.analysis_type !== 'text'
    || analysis.schema_version !== 'reference-analysis-record/v2'
    || analysisPayloadSha256(analysis.analysis)
      !== draftTask.analysis_payload_sha256
    || analysis.reference_id !== draftTask.reference_id
    || analysis.analyzed_by !== draftTask.executor.executor_id
    || analysis.analyzed_at !== draftTask.submitted_at
    || provenance?.draft_task_id !== draftTask.draft_task_id
    || provenance?.analysis_task_id
      !== source.analysisTask.task_id
    || provenance?.text_execution_id
      !== source.execution.execution_id
    || provenance?.similarity_evidence_id
      !== source.evidence.evidence_id
    || provenance?.similarity_evidence_payload_sha256
      !== source.evidence.payload_sha256
    || provenance?.final_observations_sha256
      !== source.execution.final_observations_sha256
    || provenance?.source_content_fingerprint
      !== source.analysisTask.source_snapshot.content_fingerprint
    || provenance?.input_provenance !== 'operator_submitted'
    || provenance?.machine_verified !== false
    || governance?.prompt_injection_allowed !== false
    || governance?.knowledge_writeback_allowed !== false
    || governance?.production_credit_eligible !== false
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Completed draft analysis no longer matches its immutable provenance',
    );
  }
  return analysis;
}

export async function submitReferenceTextAnalysisDraft(input: {
  repoRoot: string;
  taskId: string;
  request: unknown;
  now?: string;
}): Promise<ReferenceTextAnalysisDraftSubmissionResult> {
  const request = ReferenceTextAnalysisDraftSubmissionSchema.parse(
    input.request,
  );
  const source = await loadCompletedSource(input);
  let draftTask = await readDraftTask({
    repoRoot: input.repoRoot,
    draftTaskId: source.draftTaskId,
  });
  verifyDraftTask(draftTask, source);
  if (request.submitted_by !== draftTask.executor.executor_id) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_EXECUTOR_INVALID',
      'Draft submitted_by must match the assigned draft executor',
    );
  }
  const submissionKeySha256 = sha256(request.submission_key);
  const payloadSha256 = analysisPayloadSha256(request.analysis);
  if (draftTask.status === 'completed') {
    if (
      draftTask.submission_key_sha256 !== submissionKeySha256
      || draftTask.analysis_payload_sha256 !== payloadSha256
      || !draftTask.analysis_id
    ) {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_DRAFT_TASK_CONFLICT',
        'Text analysis draft task is already completed by a different submission',
      );
    }
    const analysis = await getVerifiedDraftAnalysis({
      repoRoot: input.repoRoot,
      draftTask,
      source,
    });
    return {
      draft_task: draftTask,
      analysis,
      idempotent_replay: true,
    };
  }
  if (
    draftTask.status === 'processing'
    && (
      draftTask.submission_key_sha256 !== submissionKeySha256
      || draftTask.analysis_payload_sha256 !== payloadSha256
    )
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_TASK_CONFLICT',
      'Text analysis draft task is processing a different submission',
    );
  }
  if (draftTask.status === 'pending') {
    const now = input.now ?? new Date().toISOString();
    draftTask = ReferenceTextAnalysisDraftTaskRecordSchema.parse({
      ...draftTask,
      status: 'processing',
      submission_key_sha256: submissionKeySha256,
      analysis_payload_sha256: payloadSha256,
      submitted_at: now,
      updated_at: now,
    }) as ReferenceTextAnalysisDraftTaskRecord;
    await atomicWriteJson(
      draftTaskPath(input.repoRoot, draftTask.draft_task_id),
      draftTask,
    );
  }
  const created = await createEvidenceBoundTextReferenceAnalysis({
    repoRoot: input.repoRoot,
    referenceId: source.analysisTask.reference_id,
    analysisId: analysisId(draftTask.draft_task_id),
    analysis: request.analysis,
    analyzedBy: request.submitted_by,
    provenance: {
      draft_task_id: draftTask.draft_task_id,
      analysis_task_id: source.analysisTask.task_id,
      text_execution_id: source.execution.execution_id,
      similarity_evidence_id: source.evidence.evidence_id,
      similarity_evidence_payload_sha256: source.evidence.payload_sha256,
      final_observations_sha256:
        source.execution.final_observations_sha256!,
      source_content_fingerprint:
        source.analysisTask.source_snapshot.content_fingerprint,
      input_provenance: 'operator_submitted',
      machine_verified: false,
    },
    now: draftTask.submitted_at!,
  });
  const completedAt = input.now ?? new Date().toISOString();
  draftTask = ReferenceTextAnalysisDraftTaskRecordSchema.parse({
    ...draftTask,
    status: 'completed',
    analysis_id: created.analysis.analysis_id,
    updated_at: completedAt,
    completed_at: completedAt,
  }) as ReferenceTextAnalysisDraftTaskRecord;
  await atomicWriteJson(
    draftTaskPath(input.repoRoot, draftTask.draft_task_id),
    draftTask,
  );
  return {
    draft_task: draftTask,
    analysis: created.analysis,
    idempotent_replay: created.idempotent_replay,
  };
}
