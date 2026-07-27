import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ReferenceTextAnalysisDraftSupplementRecordSchema,
  ReferenceTextAnalysisDraftSupplementSubmissionSchema,
  ReferenceTextAnalysisDraftSubmissionSchema,
  ReferenceTextAnalysisDraftTaskCreateRequestSchema,
  ReferenceTextAnalysisDraftTaskRecordSchema,
  ReferenceTextAnalysisSupplementRequestSchema,
} from '@shared/schemas.js';
import type {
  ReferenceAnalysisTaskRecord,
  ReferenceSimilarityEvidenceRecord,
  ReferenceTextAnalysisDraftSupplementRecord,
  ReferenceTextAnalysisDraftSupplementSubmissionResult,
  ReferenceTextAnalysisDraftSubmissionResult,
  ReferenceTextAnalysisDraftTaskRecord,
  ReferenceTextAnalysisExecutionRecord,
  ReferenceSupplementProvenanceTrace,
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

function supplementPath(repoRoot: string, supplementId: string): string {
  return path.join(draftTasksDirectory(repoRoot), `${supplementId}.json`);
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

async function immutableWriteJson(
  filePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
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

function supplementId(
  draftId: string,
  supplementRequestSha256: string,
): string {
  return `reference-text-analysis-draft-supplement-${
    sha256(`${draftId}:${supplementRequestSha256}`).slice(0, 32)}`;
}

function supplementEndpoints(taskId: string) {
  const base =
    `/api/reference-library/analysis-tasks/${taskId}`
    + '/text-analysis-draft-task';
  return {
    supplement_request_endpoint: `${base}/supplement-request`,
    supplement_submission_endpoint: `${base}/supplement-submissions`,
    supplement_endpoint: `${base}/supplement`,
  };
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

function supplementRequestPayload(input: {
  requested_by: string;
  needs: unknown;
}): string {
  return JSON.stringify({
    requested_by: input.requested_by,
    needs: input.needs,
  });
}

function evidenceObservationIds(
  evidence: ReferenceSimilarityEvidenceRecord,
): Set<string> {
  return new Set([
    ...evidence.observations.excerpts,
    ...evidence.observations.character_profiles,
    ...evidence.observations.plot_beats,
    ...evidence.observations.shot_sequence,
  ].map(observation => observation.observation_id));
}

function supplementPayload(
  record: Omit<
    ReferenceTextAnalysisDraftSupplementRecord,
    'payload_sha256'
  >,
): string {
  return JSON.stringify(record);
}

async function readSupplement(input: {
  repoRoot: string;
  supplementId: string;
}): Promise<ReferenceTextAnalysisDraftSupplementRecord> {
  try {
    const record = ReferenceTextAnalysisDraftSupplementRecordSchema.parse(
      JSON.parse(await readFile(
        supplementPath(input.repoRoot, input.supplementId),
        'utf8',
      )),
    ) as ReferenceTextAnalysisDraftSupplementRecord;
    const {
      payload_sha256: payloadSha256,
      ...payload
    } = record;
    if (sha256(supplementPayload(payload)) !== payloadSha256) {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_INTEGRITY_INVALID',
        'Text analysis supplement payload hash does not match its content',
      );
    }
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_NOT_FOUND',
        `Text analysis supplement not found: ${input.supplementId}`,
      );
    }
    throw error;
  }
}

function verifySupplement(
  supplement: ReferenceTextAnalysisDraftSupplementRecord,
  draftTask: ReferenceTextAnalysisDraftTaskRecord,
): void {
  if (
    !draftTask.supplement_request
    || supplement.supplement_id !== draftTask.supplement_id
    || supplement.draft_task_id !== draftTask.draft_task_id
    || supplement.reference_id !== draftTask.reference_id
    || supplement.source_content_fingerprint
      !== draftTask.source_content_fingerprint
    || supplement.supplement_request_sha256
      !== draftTask.supplement_request.request_payload_sha256
    || supplement.payload_sha256 !== draftTask.supplement_payload_sha256
    || supplement.created_at !== draftTask.supplement_responded_at
    || supplement.submitted_by !== draftTask.executor.executor_id
    || supplement.input_provenance !== 'operator_submitted'
    || supplement.machine_verified !== false
    || supplement.governance.prompt_injection_allowed !== false
    || supplement.governance.knowledge_writeback_allowed !== false
    || supplement.governance.production_credit_eligible !== false
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_INTEGRITY_INVALID',
      'Text analysis supplement no longer matches its draft task',
    );
  }
}

async function getVerifiedSupplement(input: {
  repoRoot: string;
  draftTask: ReferenceTextAnalysisDraftTaskRecord;
}): Promise<ReferenceTextAnalysisDraftSupplementRecord> {
  if (
    !input.draftTask.supplement_id
    || !input.draftTask.supplement_payload_sha256
    || !input.draftTask.supplement_responded_at
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_NOT_FOUND',
      'Text analysis draft task has no completed supplement',
    );
  }
  const supplement = await readSupplement({
    repoRoot: input.repoRoot,
    supplementId: input.draftTask.supplement_id,
  });
  verifySupplement(supplement, input.draftTask);
  return supplement;
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
    schema_version: 'reference-text-analysis-draft-task/v2',
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
      ...supplementEndpoints(source.analysisTask.task_id),
      server_model_call_allowed: false,
      source_text_instruction_authority: 'none',
      output_schema: 'reference-analysis-record/v2',
      output_approval_status: 'pending',
      automatic_approval_allowed: false,
      prompt_injection_allowed: false,
      knowledge_writeback_allowed: false,
      production_credit_eligible: false,
    },
    supplement_request: null,
    supplement_id: null,
    supplement_payload_sha256: null,
    supplement_responded_at: null,
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

function upgradeDraftTaskToV2(
  draftTask: ReferenceTextAnalysisDraftTaskRecord,
): ReferenceTextAnalysisDraftTaskRecord {
  if (
    draftTask.schema_version === 'reference-text-analysis-draft-task/v2'
  ) {
    return draftTask;
  }
  return ReferenceTextAnalysisDraftTaskRecordSchema.parse({
    ...draftTask,
    schema_version: 'reference-text-analysis-draft-task/v2',
    manifest: {
      ...draftTask.manifest,
      ...supplementEndpoints(draftTask.analysis_task_id),
    },
    supplement_request: null,
    supplement_id: null,
    supplement_payload_sha256: null,
    supplement_responded_at: null,
  }) as ReferenceTextAnalysisDraftTaskRecord;
}

export async function requestReferenceTextAnalysisSupplement(input: {
  repoRoot: string;
  taskId: string;
  request: unknown;
  now?: string;
}): Promise<{
  draftTask: ReferenceTextAnalysisDraftTaskRecord;
  idempotent_replay: boolean;
}> {
  const request = ReferenceTextAnalysisSupplementRequestSchema.parse(
    input.request,
  );
  const source = await loadCompletedSource(input);
  let draftTask = await readDraftTask({
    repoRoot: input.repoRoot,
    draftTaskId: source.draftTaskId,
  });
  verifyDraftTask(draftTask, source);
  if (request.requested_by !== draftTask.executor.executor_id) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_EXECUTOR_INVALID',
      'Supplement requested_by must match the assigned draft executor',
    );
  }
  const observationIds = evidenceObservationIds(source.evidence);
  if (request.needs.some(need => (
    need.evidence_id !== source.evidence.evidence_id
    || need.evidence_observation_ids.some(id => !observationIds.has(id))
  ))) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_INVALID',
      'Supplement needs must reference the bound evidence and known observation IDs',
    );
  }
  const requestSubmissionKeySha256 = sha256(request.submission_key);
  const requestPayloadSha256 = sha256(supplementRequestPayload(request));
  if (draftTask.supplement_request) {
    if (
      draftTask.supplement_request.request_submission_key_sha256
        !== requestSubmissionKeySha256
      || draftTask.supplement_request.request_payload_sha256
        !== requestPayloadSha256
    ) {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_CONFLICT',
        'Draft task already has a different supplement request',
      );
    }
    return { draftTask, idempotent_replay: true };
  }
  if (draftTask.status !== 'pending') {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_CONFLICT',
      'Supplement can only be requested while the draft task is pending',
    );
  }
  const now = input.now ?? new Date().toISOString();
  draftTask = upgradeDraftTaskToV2(draftTask);
  draftTask = ReferenceTextAnalysisDraftTaskRecordSchema.parse({
    ...draftTask,
    status: 'needs_supplement',
    supplement_request: {
      request_submission_key_sha256: requestSubmissionKeySha256,
      request_payload_sha256: requestPayloadSha256,
      requested_by: request.requested_by,
      requested_at: now,
      needs: request.needs,
    },
    updated_at: now,
  }) as ReferenceTextAnalysisDraftTaskRecord;
  await atomicWriteJson(
    draftTaskPath(input.repoRoot, draftTask.draft_task_id),
    draftTask,
  );
  return { draftTask, idempotent_replay: false };
}

function validateSupplementItems(
  draftTask: ReferenceTextAnalysisDraftTaskRecord,
  items: Array<{ field: string }>,
): void {
  const expected = draftTask.supplement_request?.needs
    .map(need => need.field)
    .sort() ?? [];
  const actual = items.map(item => item.field).sort();
  if (
    expected.length !== actual.length
    || expected.some((field, index) => field !== actual[index])
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_INVALID',
      'Supplement items must cover every requested field exactly once',
    );
  }
}

function rejectCopiedEvidenceExcerpts(
  evidence: ReferenceSimilarityEvidenceRecord,
  items: unknown,
): void {
  const serialized = JSON.stringify(items);
  if (
    evidence.observations.excerpts.some(
      excerpt => excerpt.text.length >= 8 && serialized.includes(excerpt.text),
    )
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_INVALID',
      'Supplement must summarize observations without copying evidence excerpts',
    );
  }
}

export async function submitReferenceTextAnalysisSupplement(input: {
  repoRoot: string;
  taskId: string;
  request: unknown;
  now?: string;
}): Promise<ReferenceTextAnalysisDraftSupplementSubmissionResult> {
  const request = ReferenceTextAnalysisDraftSupplementSubmissionSchema.parse(
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
      'Supplement submitted_by must match the assigned draft executor',
    );
  }
  if (!draftTask.supplement_request) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_REQUIRED',
      'Draft task has no supplement request to resolve',
    );
  }
  validateSupplementItems(draftTask, request.items);
  rejectCopiedEvidenceExcerpts(source.evidence, request.items);
  const submissionKeySha256 = sha256(request.submission_key);
  if (draftTask.supplement_id) {
    const supplement = await getVerifiedSupplement({
      repoRoot: input.repoRoot,
      draftTask,
    });
    if (
      supplement.submission_key_sha256 !== submissionKeySha256
      || JSON.stringify(supplement.items) !== JSON.stringify(request.items)
    ) {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_CONFLICT',
        'Draft task already has a different supplement response',
      );
    }
    return {
      draft_task: draftTask,
      supplement,
      idempotent_replay: true,
    };
  }
  if (draftTask.status !== 'needs_supplement') {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_CONFLICT',
      'Supplement response requires a needs_supplement draft task',
    );
  }
  const supplementIdValue = supplementId(
    draftTask.draft_task_id,
    draftTask.supplement_request.request_payload_sha256,
  );
  let supplement: ReferenceTextAnalysisDraftSupplementRecord;
  let idempotentReplay = false;
  try {
    supplement = await readSupplement({
      repoRoot: input.repoRoot,
      supplementId: supplementIdValue,
    });
    idempotentReplay = true;
    if (
      supplement.draft_task_id !== draftTask.draft_task_id
      || supplement.supplement_request_sha256
        !== draftTask.supplement_request.request_payload_sha256
      || supplement.submission_key_sha256 !== submissionKeySha256
      || supplement.submitted_by !== request.submitted_by
      || JSON.stringify(supplement.items) !== JSON.stringify(request.items)
    ) {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_CONFLICT',
        'Persisted supplement differs from this submission',
      );
    }
  } catch (error) {
    if (
      !(error instanceof ReferenceTextAnalysisDraftTaskError)
      || error.code !== 'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_NOT_FOUND'
    ) {
      throw error;
    }
    const now = input.now ?? new Date().toISOString();
    const payload = {
      schema_version:
        'reference-text-analysis-draft-supplement/v1' as const,
      supplement_id: supplementIdValue,
      draft_task_id: draftTask.draft_task_id,
      reference_id: draftTask.reference_id,
      source_content_fingerprint: draftTask.source_content_fingerprint,
      supplement_request_sha256:
        draftTask.supplement_request.request_payload_sha256,
      submission_key_sha256: submissionKeySha256,
      submitted_by: request.submitted_by,
      items: request.items,
      input_provenance: 'operator_submitted' as const,
      machine_verified: false as const,
      created_at: now,
      governance: {
        prompt_injection_allowed: false as const,
        knowledge_writeback_allowed: false as const,
        production_credit_eligible: false as const,
      },
    };
    supplement = ReferenceTextAnalysisDraftSupplementRecordSchema.parse({
      ...payload,
      payload_sha256: sha256(supplementPayload(payload)),
    }) as ReferenceTextAnalysisDraftSupplementRecord;
    await immutableWriteJson(
      supplementPath(input.repoRoot, supplement.supplement_id),
      supplement,
    );
  }
  draftTask = ReferenceTextAnalysisDraftTaskRecordSchema.parse({
    ...draftTask,
    status: 'pending',
    supplement_id: supplement.supplement_id,
    supplement_payload_sha256: supplement.payload_sha256,
    supplement_responded_at: supplement.created_at,
    updated_at: supplement.created_at,
  }) as ReferenceTextAnalysisDraftTaskRecord;
  await atomicWriteJson(
    draftTaskPath(input.repoRoot, draftTask.draft_task_id),
    draftTask,
  );
  return {
    draft_task: draftTask,
    supplement,
    idempotent_replay: idempotentReplay,
  };
}

export async function getReferenceTextAnalysisSupplement(input: {
  repoRoot: string;
  taskId: string;
}): Promise<ReferenceTextAnalysisDraftSupplementRecord> {
  const source = await loadCompletedSource(input);
  const draftTask = await readDraftTask({
    repoRoot: input.repoRoot,
    draftTaskId: source.draftTaskId,
  });
  verifyDraftTask(draftTask, source);
  return await getVerifiedSupplement({
    repoRoot: input.repoRoot,
    draftTask,
  });
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
  if (draftTask.supplement_id) {
    await getVerifiedSupplement({
      repoRoot: input.repoRoot,
      draftTask,
    });
  }
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
    || (
      draftTask.supplement_request
      && (
        provenance?.supplement_request_sha256
          !== draftTask.supplement_request.request_payload_sha256
        || provenance?.supplement_id !== draftTask.supplement_id
        || provenance?.supplement_payload_sha256
          !== draftTask.supplement_payload_sha256
      )
    )
    || (
      !draftTask.supplement_request
      && (
        provenance?.supplement_request_sha256 !== undefined
        || provenance?.supplement_id !== undefined
        || provenance?.supplement_payload_sha256 !== undefined
      )
    )
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

export async function verifyReferenceTextAnalysisCompositionProvenance(input: {
  repoRoot: string;
  analysisId: string;
}): Promise<{
  analysis_id: string;
  supplement_provenance: ReferenceSupplementProvenanceTrace | null;
}> {
  const analysis = await getReferenceAnalysis({
    repoRoot: input.repoRoot,
    analysisId: input.analysisId,
  });
  if (
    analysis.analysis_type !== 'text'
    || analysis.schema_version !== 'reference-analysis-record/v2'
  ) {
    return {
      analysis_id: analysis.analysis_id,
      supplement_provenance: null,
    };
  }
  if (!analysis.provenance) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Evidence-bound text analysis is missing immutable provenance',
    );
  }
  const source = await loadCompletedSource({
    repoRoot: input.repoRoot,
    taskId: analysis.provenance.analysis_task_id,
  });
  const draftTask = await readDraftTask({
    repoRoot: input.repoRoot,
    draftTaskId: source.draftTaskId,
  });
  verifyDraftTask(draftTask, source);
  if (
    draftTask.status !== 'completed'
    || draftTask.analysis_id !== analysis.analysis_id
  ) {
    throw new ReferenceTextAnalysisDraftTaskError(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
      'Evidence-bound text analysis does not match a completed draft task',
    );
  }
  await getVerifiedDraftAnalysis({
    repoRoot: input.repoRoot,
    draftTask,
    source,
  });
  if (!draftTask.supplement_request) {
    return {
      analysis_id: analysis.analysis_id,
      supplement_provenance: null,
    };
  }
  const supplement = await getVerifiedSupplement({
    repoRoot: input.repoRoot,
    draftTask,
  });
  return {
    analysis_id: analysis.analysis_id,
    supplement_provenance: {
      analysis_id: analysis.analysis_id,
      supplement_request_sha256:
        draftTask.supplement_request.request_payload_sha256,
      supplement_id: supplement.supplement_id,
      supplement_payload_sha256: supplement.payload_sha256,
      status: 'verified',
    },
  };
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
  let supplement: ReferenceTextAnalysisDraftSupplementRecord | null = null;
  if (draftTask.supplement_request) {
    if (!draftTask.supplement_id || draftTask.status === 'needs_supplement') {
      throw new ReferenceTextAnalysisDraftTaskError(
        'REFERENCE_TEXT_ANALYSIS_SUPPLEMENT_REQUIRED',
        'Draft task must resolve its supplement request before analysis submission',
      );
    }
    supplement = await getVerifiedSupplement({
      repoRoot: input.repoRoot,
      draftTask,
    });
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
      ...(supplement && draftTask.supplement_request
        ? {
            supplement_request_sha256:
              draftTask.supplement_request.request_payload_sha256,
            supplement_id: supplement.supplement_id,
            supplement_payload_sha256: supplement.payload_sha256,
          }
        : {}),
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
