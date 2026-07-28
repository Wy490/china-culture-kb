export type ReferenceTextAnalysisExecutorKind = 'codex' | 'operator';

export interface ReferenceAnalysisTaskInput {
  task_id: string;
}

export interface StartReferenceTextAnalysisExecutionInput
  extends ReferenceAnalysisTaskInput {
  executor_kind: ReferenceTextAnalysisExecutorKind;
  executor_id: string;
}

export interface SubmitReferenceTextAnalysisChunkInput
  extends ReferenceAnalysisTaskInput {
  chunk_id: string;
  submission_key: string;
  submitted_by: string;
  chunk_content_sha256: string;
  observations: Record<string, unknown>;
}

export interface FinalizeReferenceTextAnalysisExecutionInput
  extends ReferenceAnalysisTaskInput {
  finalized_by: string;
}

export interface StartReferenceTextAnalysisDraftTaskInput
  extends ReferenceAnalysisTaskInput {
  executor_kind: ReferenceTextAnalysisExecutorKind;
  executor_id: string;
}

export interface RequestReferenceTextAnalysisSupplementInput
  extends ReferenceAnalysisTaskInput {
  submission_key: string;
  requested_by: string;
  needs: Array<Record<string, unknown>>;
}

export interface SubmitReferenceTextAnalysisSupplementInput
  extends ReferenceAnalysisTaskInput {
  submission_key: string;
  submitted_by: string;
  items: Array<Record<string, unknown>>;
}

export interface SubmitReferenceTextAnalysisDraftInput
  extends ReferenceAnalysisTaskInput {
  submission_key: string;
  submitted_by: string;
  analysis: Record<string, unknown>;
}

interface StoryAgentApiEnvelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}

export type ReferenceTextAnalysisCanonicalTool =
  | 'kb_get_reference_analysis_task'
  | 'kb_start_reference_text_analysis_execution'
  | 'kb_get_reference_text_analysis_execution'
  | 'kb_get_reference_text_analysis_next_chunk'
  | 'kb_submit_reference_text_analysis_chunk'
  | 'kb_finalize_reference_text_analysis_execution'
  | 'kb_start_reference_text_analysis_draft'
  | 'kb_get_reference_text_analysis_draft'
  | 'kb_request_reference_text_analysis_supplement'
  | 'kb_submit_reference_text_analysis_supplement'
  | 'kb_get_reference_text_analysis_supplement'
  | 'kb_submit_reference_text_analysis_draft';

export interface ReferenceTextAnalysisBridgeMetadata {
  schema_version: 'mcp-reference-text-analysis-bridge/v1';
  canonical_tool: ReferenceTextAnalysisCanonicalTool;
  canonical_service: true;
  application_endpoint: string;
  application_method: 'GET' | 'POST';
  authoritative_request_schema: string;
  output_schema: string;
  source_text_treated_as_untrusted_data: true;
  source_text_instruction_authority: 'none';
  server_model_call_performed: false;
  direct_repository_write_performed_by_mcp: false;
  automatic_approval_performed: false;
  knowledge_writeback_performed: false;
  production_credit_granted: false;
}

export type ReferenceTextAnalysisBridgeResult = StoryAgentApiEnvelope & {
  mcp_bridge: ReferenceTextAnalysisBridgeMetadata;
};

const TASK_ID_PATTERN = /^reference-analysis-task-[a-f0-9-]+$/;
const CHUNK_ID_PATTERN = /^chunk-\d{4}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；Reference text analysis MCP 工具必须调用 canonical Web application service。',
    );
  }
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('STORY_AGENT_BASE_URL 仅支持 http/https');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('STORY_AGENT_BASE_URL 不得包含凭据、query 或 hash');
  }
  return url.toString().replace(/\/$/, '');
}

function accessTokenHeader(): Record<string, string> {
  const token = process.env.STORY_AGENT_MCP_ACCESS_TOKEN?.trim();
  if (!token) return {};
  if (/\s/.test(token)) {
    throw new Error('STORY_AGENT_MCP_ACCESS_TOKEN 格式无效');
  }
  return { authorization: `Bearer ${token}` };
}

function validateTaskId(taskId: string): void {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error('task_id must be a canonical reference analysis task id');
  }
}

function validateChunkId(chunkId: string): void {
  if (!CHUNK_ID_PATTERN.test(chunkId)) {
    throw new Error('chunk_id must match chunk-NNNN');
  }
}

function validateSubmissionKey(submissionKey: string): void {
  if (!SUBMISSION_KEY_PATTERN.test(submissionKey)) {
    throw new Error('submission_key must be 8-128 stable URL-safe characters');
  }
}

function validateActor(actor: string, field: string): void {
  if (!actor.trim() || actor.length > 160) {
    throw new Error(`${field} must be a non-empty bounded actor id`);
  }
}

function validateSha256(value: string, field: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256 digest`);
  }
}

function validateObject(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be a JSON object`);
  }
}

function validateNonEmptyRecords(
  value: Array<Record<string, unknown>>,
  field: string,
): void {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) {
    throw new Error(`${field} must contain 1-64 items`);
  }
  for (const item of value) validateObject(item, `${field} item`);
}

function taskEndpoint(taskId: string): string {
  validateTaskId(taskId);
  return `${storyAgentBaseUrl()}/api/reference-library/analysis-tasks/${
    encodeURIComponent(taskId)}`;
}

async function requestApplication(input: {
  endpoint: string;
  method: 'GET' | 'POST';
  body?: unknown;
}): Promise<StoryAgentApiEnvelope> {
  const response = await fetch(input.endpoint, {
    method: input.method,
    headers: input.body === undefined
      ? accessTokenHeader()
      : {
          'content-type': 'application/json',
          ...accessTokenHeader(),
        },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: AbortSignal.timeout(120_000),
  });
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(
      `Story Agent application service 返回了非 JSON 响应（HTTP ${response.status}）`,
    );
  }
  if (
    typeof parsed !== 'object'
    || parsed === null
    || Array.isArray(parsed)
    || typeof (parsed as { ok?: unknown }).ok !== 'boolean'
  ) {
    throw new Error(
      `Story Agent application service 返回了无效 API envelope（HTTP ${response.status}）`,
    );
  }
  const envelope = parsed as StoryAgentApiEnvelope;
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim()
      || 'REFERENCE_TEXT_ANALYSIS_MCP_BRIDGE_FAILED';
    const message = envelope.error?.message?.trim()
      || `Reference text analysis 请求失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return envelope;
}

async function bridge(input: {
  canonicalTool: ReferenceTextAnalysisCanonicalTool;
  endpoint: string;
  method: 'GET' | 'POST';
  requestSchema: string;
  outputSchema: string;
  body?: unknown;
}): Promise<ReferenceTextAnalysisBridgeResult> {
  const envelope = await requestApplication({
    endpoint: input.endpoint,
    method: input.method,
    body: input.body,
  });
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-reference-text-analysis-bridge/v1',
      canonical_tool: input.canonicalTool,
      canonical_service: true,
      application_endpoint: input.endpoint,
      application_method: input.method,
      authoritative_request_schema: input.requestSchema,
      output_schema: input.outputSchema,
      source_text_treated_as_untrusted_data: true,
      source_text_instruction_authority: 'none',
      server_model_call_performed: false,
      direct_repository_write_performed_by_mcp: false,
      automatic_approval_performed: false,
      knowledge_writeback_performed: false,
      production_credit_granted: false,
    },
  };
}

export async function getReferenceAnalysisTask(
  input: ReferenceAnalysisTaskInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  const endpoint = taskEndpoint(input.task_id);
  return bridge({
    canonicalTool: 'kb_get_reference_analysis_task',
    endpoint,
    method: 'GET',
    requestSchema: 'ReferenceAnalysisTaskIdParamSchema',
    outputSchema: 'reference-analysis-task/v2',
  });
}

export async function startReferenceTextAnalysisExecution(
  input: StartReferenceTextAnalysisExecutionInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  validateActor(input.executor_id, 'executor_id');
  const endpoint = `${taskEndpoint(input.task_id)}/text-execution`;
  return bridge({
    canonicalTool: 'kb_start_reference_text_analysis_execution',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferenceTextAnalysisExecutionCreateRequestSchema',
    outputSchema: 'reference-text-analysis-execution/v1',
    body: {
      executor: {
        kind: input.executor_kind,
        executor_id: input.executor_id,
      },
      confirmation: 'source_text_treated_as_untrusted_data',
    },
  });
}

export async function getReferenceTextAnalysisExecution(
  input: ReferenceAnalysisTaskInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  const endpoint = `${taskEndpoint(input.task_id)}/text-execution`;
  return bridge({
    canonicalTool: 'kb_get_reference_text_analysis_execution',
    endpoint,
    method: 'GET',
    requestSchema: 'ReferenceAnalysisTaskIdParamSchema',
    outputSchema: 'reference-text-analysis-execution/v1',
  });
}

export async function getReferenceTextAnalysisNextChunk(
  input: ReferenceAnalysisTaskInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  const endpoint = `${taskEndpoint(input.task_id)}/text-execution/next-chunk`;
  return bridge({
    canonicalTool: 'kb_get_reference_text_analysis_next_chunk',
    endpoint,
    method: 'GET',
    requestSchema: 'ReferenceAnalysisTaskIdParamSchema',
    outputSchema: 'reference-text-analysis-next-chunk/v1',
  });
}

export async function submitReferenceTextAnalysisChunk(
  input: SubmitReferenceTextAnalysisChunkInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  validateChunkId(input.chunk_id);
  validateSubmissionKey(input.submission_key);
  validateActor(input.submitted_by, 'submitted_by');
  validateSha256(input.chunk_content_sha256, 'chunk_content_sha256');
  validateObject(input.observations, 'observations');
  const endpoint = `${taskEndpoint(input.task_id)}/text-execution/chunks/${
    encodeURIComponent(input.chunk_id)}/submissions`;
  return bridge({
    canonicalTool: 'kb_submit_reference_text_analysis_chunk',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferenceTextAnalysisChunkSubmissionSchema',
    outputSchema: 'reference-text-analysis-chunk-submission/v1',
    body: {
      submission_key: input.submission_key,
      submitted_by: input.submitted_by,
      chunk_content_sha256: input.chunk_content_sha256,
      observations: input.observations,
    },
  });
}

export async function finalizeReferenceTextAnalysisExecution(
  input: FinalizeReferenceTextAnalysisExecutionInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  validateActor(input.finalized_by, 'finalized_by');
  const endpoint = `${taskEndpoint(input.task_id)}/text-execution/finalize`;
  return bridge({
    canonicalTool: 'kb_finalize_reference_text_analysis_execution',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferenceTextAnalysisExecutionFinalizeRequestSchema',
    outputSchema: 'reference-text-analysis-finalization/v1',
    body: {
      finalized_by: input.finalized_by,
      confirmation: 'aggregate_completed_chunks_to_operator_evidence',
    },
  });
}

export async function startReferenceTextAnalysisDraftTask(
  input: StartReferenceTextAnalysisDraftTaskInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  validateActor(input.executor_id, 'executor_id');
  const endpoint = `${taskEndpoint(input.task_id)}/text-analysis-draft-task`;
  return bridge({
    canonicalTool: 'kb_start_reference_text_analysis_draft',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferenceTextAnalysisDraftTaskCreateRequestSchema',
    outputSchema: 'reference-text-analysis-draft-task/v2',
    body: {
      executor: {
        kind: input.executor_kind,
        executor_id: input.executor_id,
      },
      confirmation: 'draft_complete_text_analysis_from_verified_evidence',
    },
  });
}

export async function getReferenceTextAnalysisDraftTask(
  input: ReferenceAnalysisTaskInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  const endpoint = `${taskEndpoint(input.task_id)}/text-analysis-draft-task`;
  return bridge({
    canonicalTool: 'kb_get_reference_text_analysis_draft',
    endpoint,
    method: 'GET',
    requestSchema: 'ReferenceAnalysisTaskIdParamSchema',
    outputSchema: 'reference-text-analysis-draft-task/v2',
  });
}

export async function requestReferenceTextAnalysisSupplement(
  input: RequestReferenceTextAnalysisSupplementInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  validateSubmissionKey(input.submission_key);
  validateActor(input.requested_by, 'requested_by');
  validateNonEmptyRecords(input.needs, 'needs');
  const endpoint =
    `${taskEndpoint(input.task_id)}/text-analysis-draft-task/supplement-request`;
  return bridge({
    canonicalTool: 'kb_request_reference_text_analysis_supplement',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferenceTextAnalysisSupplementRequestSchema',
    outputSchema: 'reference-text-analysis-draft-task/v2',
    body: {
      submission_key: input.submission_key,
      requested_by: input.requested_by,
      confirmation: 'declare_text_analysis_evidence_insufficient',
      needs: input.needs,
    },
  });
}

export async function submitReferenceTextAnalysisSupplement(
  input: SubmitReferenceTextAnalysisSupplementInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  validateSubmissionKey(input.submission_key);
  validateActor(input.submitted_by, 'submitted_by');
  validateNonEmptyRecords(input.items, 'items');
  const endpoint =
    `${taskEndpoint(input.task_id)}/text-analysis-draft-task/supplement-submissions`;
  return bridge({
    canonicalTool: 'kb_submit_reference_text_analysis_supplement',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferenceTextAnalysisDraftSupplementSubmissionSchema',
    outputSchema: 'reference-text-analysis-draft-supplement/v1',
    body: {
      submission_key: input.submission_key,
      submitted_by: input.submitted_by,
      confirmation: 'submit_bounded_supplement_without_source_excerpts',
      items: input.items,
    },
  });
}

export async function getReferenceTextAnalysisSupplement(
  input: ReferenceAnalysisTaskInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  const endpoint =
    `${taskEndpoint(input.task_id)}/text-analysis-draft-task/supplement`;
  return bridge({
    canonicalTool: 'kb_get_reference_text_analysis_supplement',
    endpoint,
    method: 'GET',
    requestSchema: 'ReferenceAnalysisTaskIdParamSchema',
    outputSchema: 'reference-text-analysis-draft-supplement/v1',
  });
}

export async function submitReferenceTextAnalysisDraft(
  input: SubmitReferenceTextAnalysisDraftInput,
): Promise<ReferenceTextAnalysisBridgeResult> {
  validateSubmissionKey(input.submission_key);
  validateActor(input.submitted_by, 'submitted_by');
  validateObject(input.analysis, 'analysis');
  const endpoint =
    `${taskEndpoint(input.task_id)}/text-analysis-draft-task/submissions`;
  return bridge({
    canonicalTool: 'kb_submit_reference_text_analysis_draft',
    endpoint,
    method: 'POST',
    requestSchema: 'ReferenceTextAnalysisDraftSubmissionSchema',
    outputSchema: 'reference-analysis-record/v2',
    body: {
      submission_key: input.submission_key,
      submitted_by: input.submitted_by,
      confirmation: 'submit_pending_text_reference_analysis',
      analysis: input.analysis,
    },
  });
}
