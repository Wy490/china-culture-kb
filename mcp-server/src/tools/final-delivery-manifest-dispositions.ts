type FinalDeliveryManifestDisposition =
  | 'preserve_fixture_exclude_from_publishable_delivery'
  | 'reexport_after_authorized_dependencies';

interface StoryAgentApiError {
  code?: string;
  message?: string;
}

interface StoryAgentApiEnvelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: StoryAgentApiError | null;
}

export interface GetFinalDeliveryManifestDispositionsInput {
  series_project_id?: string;
  operator_id?: string;
  disposition?: FinalDeliveryManifestDisposition;
  limit?: number;
}

export interface SubmitFinalDeliveryManifestDispositionInput {
  series_project_id: string;
  disposition: FinalDeliveryManifestDisposition;
  authorized_media_inputs_attested?: boolean;
  operator: {
    operator_id: string;
    display_name: string;
    identity_reference: string;
  };
  decision: {
    rationale: string;
    evidence_references: string[];
  };
  attestation: {
    human_operator: true;
    reviewed_current_preflight: true;
    accepts_no_publishable_delivery_credit: true;
  };
  idempotency_key: string;
}

export type FinalDeliveryManifestDispositionLedgerToolResult =
  StoryAgentApiEnvelope & {
    mcp_bridge: {
      schema_version:
        'mcp-story-agent-final-delivery-manifest-disposition-ledger/v1';
      canonical_tool:
        'kb_get_story_agent_final_delivery_manifest_dispositions';
      canonical_service: true;
      application_endpoint: string;
      authoritative_query_schema:
        'StoryAgentFinalDeliveryManifestDispositionLedgerQuerySchema';
      operator_submitted_dispositions_only: true;
      machine_generated_disposition_allowed: false;
      project_files_modified: false;
      publishable_delivery_credit_granted: false;
    };
  };

export type FinalDeliveryManifestDispositionSubmitToolResult =
  StoryAgentApiEnvelope & {
    mcp_bridge: {
      schema_version:
        'mcp-story-agent-final-delivery-manifest-disposition-submit/v1';
      canonical_tool:
        'kb_submit_story_agent_final_delivery_manifest_disposition';
      canonical_service: true;
      application_endpoint: string;
      authoritative_request_schema:
        'StoryAgentFinalDeliveryManifestDispositionSubmitRequestSchema';
      explicit_human_operator_attestation_required: true;
      machine_generated_disposition_allowed: false;
      final_assemble_invoked: false;
      manifest_written: false;
      project_files_modified: false;
      publishable_delivery_credit_granted: false;
    };
  };

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；final-delivery manifest disposition '
      + 'MCP 工具必须调用 canonical Web application service。',
    );
  }
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('STORY_AGENT_BASE_URL 仅支持 http/https');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'STORY_AGENT_BASE_URL 不得包含凭据、query 或 hash',
    );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

async function readApiEnvelope(
  response: Response,
): Promise<StoryAgentApiEnvelope> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(
      `Story Agent application service 返回了非 JSON 响应（HTTP ${response.status}）`,
    );
  }
  if (!isRecord(parsed) || typeof parsed.ok !== 'boolean') {
    throw new Error(
      `Story Agent application service 返回了无效 API envelope（HTTP ${response.status}）`,
    );
  }
  return parsed as StoryAgentApiEnvelope;
}

function canonicalFailure(
  response: Response,
  envelope: StoryAgentApiEnvelope,
  fallbackCode: string,
  fallbackMessage: string,
): never {
  const code = envelope.error?.code?.trim() || fallbackCode;
  const message = envelope.error?.message?.trim()
    || `${fallbackMessage}（HTTP ${response.status}）`;
  throw new Error(`${code}: ${message}`);
}

export async function getFinalDeliveryManifestDispositions(
  input: GetFinalDeliveryManifestDispositionsInput = {},
): Promise<FinalDeliveryManifestDispositionLedgerToolResult> {
  const endpoint = new URL(
    `${storyAgentBaseUrl()}/api/system/`
    + 'story-agent-final-delivery-manifest-dispositions',
  );
  const query: Record<string, string | number | undefined> = {
    series_project_id: input.series_project_id,
    operator_id: input.operator_id,
    disposition: input.disposition,
    limit: input.limit,
  };
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      endpoint.searchParams.set(key, String(value));
    }
  }
  const applicationEndpoint = endpoint.toString();
  const response = await fetch(applicationEndpoint, {
    method: 'GET',
    headers: accessTokenHeader(),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    canonicalFailure(
      response,
      envelope,
      'STORY_AGENT_FINAL_DELIVERY_MANIFEST_DISPOSITION_LEDGER_FAILED',
      'Story Agent final-delivery manifest 人工处置账本查询失败',
    );
  }
  return {
    ...envelope,
    mcp_bridge: {
      schema_version:
        'mcp-story-agent-final-delivery-manifest-disposition-ledger/v1',
      canonical_tool:
        'kb_get_story_agent_final_delivery_manifest_dispositions',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_query_schema:
        'StoryAgentFinalDeliveryManifestDispositionLedgerQuerySchema',
      operator_submitted_dispositions_only: true,
      machine_generated_disposition_allowed: false,
      project_files_modified: false,
      publishable_delivery_credit_granted: false,
    },
  };
}

export async function submitFinalDeliveryManifestDisposition(
  input: SubmitFinalDeliveryManifestDispositionInput,
): Promise<FinalDeliveryManifestDispositionSubmitToolResult> {
  const applicationEndpoint =
    `${storyAgentBaseUrl()}/api/system/`
    + 'story-agent-final-delivery-manifest-dispositions';
  const response = await fetch(applicationEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...accessTokenHeader(),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    canonicalFailure(
      response,
      envelope,
      'STORY_AGENT_FINAL_DELIVERY_MANIFEST_DISPOSITION_SUBMIT_FAILED',
      'Story Agent final-delivery manifest 人工处置提交失败',
    );
  }
  return {
    ...envelope,
    mcp_bridge: {
      schema_version:
        'mcp-story-agent-final-delivery-manifest-disposition-submit/v1',
      canonical_tool:
        'kb_submit_story_agent_final_delivery_manifest_disposition',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_request_schema:
        'StoryAgentFinalDeliveryManifestDispositionSubmitRequestSchema',
      explicit_human_operator_attestation_required: true,
      machine_generated_disposition_allowed: false,
      final_assemble_invoked: false,
      manifest_written: false,
      project_files_modified: false,
      publishable_delivery_credit_granted: false,
    },
  };
}
