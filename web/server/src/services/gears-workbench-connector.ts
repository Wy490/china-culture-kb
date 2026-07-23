import {
  ErrorCodes,
  fail,
  success,
} from '@shared/types.js';
import { createHash } from 'node:crypto';
import type {
  ApiResponse,
  GearsCharacterAssetBootstrapRequest,
  GearsCharacterAssetBootstrapResult,
  GearsWorkbenchCapabilities,
  GearsWorkbenchConfigInfo,
  GearsWorkbenchCreditBoundary,
  GearsWorkbenchImportEnvelope,
  GearsWorkbenchImportResult,
  GearsWorkbenchProjectImportRequest,
} from '@shared/types.js';
import { ensureGearsDeliveryPackage } from './gears-delivery-service.js';
import { getProject } from './project-service.js';
import { appendGearsWorkbenchImportAudit } from './gears-workbench-audit-service.js';

const CAPABILITY_PATH = '/integrations/story-agent/capabilities';
const DRY_RUN_PATH = '/integrations/story-agent/imports/dry-run';
const EXECUTE_PATH = '/integrations/story-agent/imports';
const CHARACTER_ASSET_BOOTSTRAP_PATH = '/integrations/story-agent/character-assets/bootstrap';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

const ZERO_CREDIT_BOUNDARY: GearsWorkbenchCreditBoundary = {
  workbench_data_only: true,
  provider_invoked: false,
  media_generated: false,
  public_artifact_url_count: 0,
  counts_as_real_gears_seedance_delivery: false,
};

function configuredBaseUrl(): string | undefined {
  return process.env.GEARS_WORKBENCH_API_BASE_URL?.trim() || undefined;
}

function configuredToken(): string | undefined {
  return process.env.GEARS_WORKBENCH_API_TOKEN?.trim() || undefined;
}

function requestTimeoutMs(): number {
  const configured = Number(process.env.GEARS_WORKBENCH_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.max(1_000, Math.min(60_000, Math.round(configured)));
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasZeroCreditBoundary(value: unknown): value is GearsWorkbenchCreditBoundary {
  return isRecord(value)
    && value.workbench_data_only === true
    && value.provider_invoked === false
    && value.media_generated === false
    && value.public_artifact_url_count === 0
    && value.counts_as_real_gears_seedance_delivery === false;
}

function isCapabilities(value: unknown): value is GearsWorkbenchCapabilities {
  return isRecord(value)
    && value.schema_version === 'gears-workbench-capabilities/v1'
    && value.service === 'gears-workbench'
    && value.workbench_import_supported === true
    && value.character_asset_bootstrap_supported === true
    && Array.isArray(value.character_asset_generation_modes)
    && value.character_asset_generation_modes.includes('local_test')
    && value.execution_worker_supported === false
    && value.bearer_auth_required === true
    && value.atomic_execute === true
    && value.idempotent_execute === true
    && value.operator_recipe_promotion_supported === true
    && value.promotion_requires_real_asset_versions === true
    && value.promotion_invokes_provider === false
    && Array.isArray(value.supported_delivery_schemas)
    && value.supported_delivery_schemas.includes('gears-delivery/v1')
    && hasZeroCreditBoundary(value.credit_boundary);
}

function isImportResult(value: unknown): value is GearsWorkbenchImportResult {
  if (!isRecord(value)
    || value.schema_version !== 'gears-workbench-import-result/v1'
    || (value.mode !== 'dry_run' && value.mode !== 'execute')
    || (value.status !== 'planned' && value.status !== 'blocked' && value.status !== 'applied')
    || typeof value.idempotency_key !== 'string'
    || typeof value.replayed !== 'boolean'
    || typeof value.payload_sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.payload_sha256)
    || !isRecord(value.source)
    || value.source.source_system !== 'story-agent'
    || typeof value.source.project_id !== 'string'
    || typeof value.source.story_id !== 'string'
    || typeof value.source.version_id !== 'string'
    || typeof value.source.source_domain !== 'string'
    || value.atomic !== true
    || !Array.isArray(value.entities)
    || !Array.isArray(value.blockers)
    || !isRecord(value.summary)
    || !hasZeroCreditBoundary(value.credit_boundary)) return false;
  if (value.import_id !== undefined && value.import_id !== null && typeof value.import_id !== 'string') {
    return false;
  }
  return value.summary.provider_call_count === 0
    && value.summary.media_artifact_count === 0
    && value.summary.real_delivery_credit_count === 0;
}

function isCharacterAssetBootstrapResult(
  value: unknown,
): value is GearsCharacterAssetBootstrapResult {
  if (!isRecord(value)
    || value.schema_version !== 'story-agent-character-asset-bootstrap-result/v1'
    || (value.status !== 'applied' && value.status !== 'replayed')
    || value.generation_mode !== 'local_test'
    || typeof value.idempotency_key !== 'string'
    || value.external_provider_call_count !== 0
    || value.real_delivery_credit_count !== 0
    || !Array.isArray(value.characters)
    || !isRecord(value.source)
    || value.source.source_system !== 'story-agent'
    || !isRecord(value.credit_boundary)
    || value.credit_boundary.local_test_only !== true
    || value.credit_boundary.external_provider_invoked !== false
    || value.credit_boundary.counts_as_real_image_asset !== false
    || value.credit_boundary.counts_as_production_credit !== false) return false;
  return value.characters.every(item => (
    isRecord(item)
    && typeof item.identity_id === 'string'
    && typeof item.definition_fingerprint === 'string'
    && typeof item.name === 'string'
    && item.provider === 'gears_local_test'
    && item.model === 'gears-local-test-card'
    && typeof item.media_url === 'string'
    && item.media_url.startsWith('/media/')
    && typeof item.content_sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(item.content_sha256)
    && typeof item.prompt_sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(item.prompt_sha256)
  ));
}

type WorkbenchHttpResult = {
  ok: boolean;
  status: number;
  payload?: unknown;
  text: string;
};

function forwardFailure<T>(response: ApiResponse<unknown>): ApiResponse<T> {
  return {
    ok: false,
    data: null,
    error: response.error ?? {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'GEARS workbench connector returned an empty failure',
    },
  };
}

async function requestWorkbench(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<ApiResponse<WorkbenchHttpResult>> {
  const baseUrl = configuredBaseUrl();
  const token = configuredToken();
  if (!baseUrl || !token) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'GEARS workbench requires GEARS_WORKBENCH_API_BASE_URL and GEARS_WORKBENCH_API_TOKEN',
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs());
  try {
    const response = await fetch(joinUrl(baseUrl, path), {
      method: init.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown;
    if (text.trim()) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        return fail(
          ErrorCodes.VALIDATION_ERROR,
          `GEARS workbench returned non-JSON HTTP ${response.status}`,
          { status: response.status, body: text.slice(0, 500) },
        );
      }
    }
    return success({ ok: response.ok, status: response.status, payload, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return fail(ErrorCodes.INTERNAL_ERROR, `GEARS workbench request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

export function getGearsWorkbenchConfigInfo(): GearsWorkbenchConfigInfo {
  const apiBaseConfigured = Boolean(configuredBaseUrl());
  const apiTokenConfigured = Boolean(configuredToken());
  return {
    service: 'gears-workbench',
    api_base_url_env: 'GEARS_WORKBENCH_API_BASE_URL',
    api_token_env: 'GEARS_WORKBENCH_API_TOKEN',
    api_base_url_configured: apiBaseConfigured,
    api_token_configured: apiTokenConfigured,
    capability_endpoint_path: CAPABILITY_PATH,
    dry_run_endpoint_path: DRY_RUN_PATH,
    execute_endpoint_path: EXECUTE_PATH,
    ready_for_capability_probe: apiBaseConfigured && apiTokenConfigured,
    missing_requirements: [
      ...(apiBaseConfigured ? [] : ['GEARS_WORKBENCH_API_BASE_URL']),
      ...(apiTokenConfigured ? [] : ['GEARS_WORKBENCH_API_TOKEN']),
    ],
    configuration_warnings: [
      ...(!apiBaseConfigured && Boolean(
        process.env.GEARS_EXECUTION_WORKER_API_BASE_URL?.trim()
        || process.env.GEARS_API_BASE_URL?.trim(),
      )
        ? ['检测到 execution worker 的 GEARS_EXECUTION_WORKER_API_BASE_URL/legacy GEARS_API_BASE_URL；workbench 不会复用该配置。']
        : []),
      ...(!apiTokenConfigured && Boolean(
        process.env.GEARS_EXECUTION_WORKER_API_TOKEN?.trim()
        || process.env.GEARS_API_TOKEN?.trim(),
      )
        ? ['检测到 execution worker 的 GEARS_EXECUTION_WORKER_API_TOKEN/legacy GEARS_API_TOKEN；workbench 不会复用该凭证。']
        : []),
    ],
    execution_worker_envs_used: false,
    credit_boundary: ZERO_CREDIT_BOUNDARY,
    generated_at: new Date().toISOString(),
  };
}

export async function getGearsWorkbenchCapabilities(): Promise<
  ApiResponse<GearsWorkbenchCapabilities>
> {
  const response = await requestWorkbench(CAPABILITY_PATH, { method: 'GET' });
  if (!response.ok || !response.data) return forwardFailure(response);
  if (!response.data.ok) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      `GEARS workbench capability probe returned HTTP ${response.data.status}`,
      response.data.payload ?? response.data.text.slice(0, 500),
    );
  }
  if (!isCapabilities(response.data.payload)) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'GEARS endpoint does not satisfy the gears-workbench capability contract',
      response.data.payload,
    );
  }
  return success(response.data.payload);
}

export async function requestGearsCharacterAssetBootstrap(
  envelope: GearsCharacterAssetBootstrapRequest,
): Promise<ApiResponse<GearsCharacterAssetBootstrapResult>> {
  const response = await requestWorkbench(CHARACTER_ASSET_BOOTSTRAP_PATH, {
    method: 'POST',
    body: envelope,
  });
  if (!response.ok || !response.data) return forwardFailure(response);
  if (!response.data.ok) {
    return fail(
      response.data.status === 409 || response.data.status === 422
        ? ErrorCodes.VALIDATION_ERROR
        : ErrorCodes.INTERNAL_ERROR,
      `GEARS character asset bootstrap returned HTTP ${response.data.status}`,
      response.data.payload ?? response.data.text.slice(0, 500),
    );
  }
  if (!isCharacterAssetBootstrapResult(response.data.payload)) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'GEARS character asset bootstrap violated the local-test zero-credit contract',
      response.data.payload,
    );
  }
  const actual = response.data.payload;
  if (
    actual.idempotency_key !== envelope.idempotency_key
    || actual.source.project_id !== envelope.source.project_id
    || actual.source.version_id !== envelope.source.version_id
    || actual.source.source_fingerprint !== envelope.source.source_fingerprint
    || actual.characters.length !== envelope.characters.length
  ) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'GEARS character asset bootstrap identity does not match the submitted envelope',
    );
  }
  return success(actual);
}

export async function downloadGearsWorkbenchMedia(
  mediaUrl: string,
  expectedSha256: string,
): Promise<ApiResponse<{ buffer: Buffer; mime_type: string; content_sha256: string }>> {
  const baseUrl = configuredBaseUrl();
  const token = configuredToken();
  if (!baseUrl || !token) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'GEARS workbench requires GEARS_WORKBENCH_API_BASE_URL and GEARS_WORKBENCH_API_TOKEN',
    );
  }
  if (!/^\/media\/[a-zA-Z0-9._-]+$/.test(mediaUrl)) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'GEARS media URL must be a local /media artifact path');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs());
  try {
    const response = await fetch(joinUrl(baseUrl, mediaUrl), {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        `GEARS media download returned HTTP ${response.status}`,
      );
    }
    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_MEDIA_BYTES) {
      return fail(ErrorCodes.VALIDATION_ERROR, 'GEARS media exceeds the 20 MiB ingest limit');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_MEDIA_BYTES) {
      return fail(ErrorCodes.VALIDATION_ERROR, 'GEARS media is empty or exceeds the ingest limit');
    }
    const contentSha256 = createHash('sha256').update(buffer).digest('hex');
    if (contentSha256 !== expectedSha256.toLowerCase()) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        'GEARS media SHA-256 does not match the bootstrap receipt',
      );
    }
    return success({
      buffer,
      mime_type: response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream',
      content_sha256: contentSha256,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return fail(ErrorCodes.INTERNAL_ERROR, `GEARS media download failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function buildGearsWorkbenchImportEnvelope(
  projectId: string,
  request: GearsWorkbenchProjectImportRequest,
): Promise<ApiResponse<GearsWorkbenchImportEnvelope>> {
  const project = await getProject(projectId);
  if (!project.ok || !project.data) {
    return {
      ok: false,
      data: null,
      error: project.error,
    };
  }
  const delivery = ensureGearsDeliveryPackage(project.data.current_story);
  const versionId = project.data.project.current_version_id;
  return success({
    schema_version: 'gears-workbench-import/v1',
    idempotency_key: request.idempotency_key
      ?? `story-agent:${projectId}:${delivery.storyId}:${versionId}`,
    source: {
      source_system: 'story-agent',
      project_id: projectId,
      story_id: delivery.storyId,
      version_id: versionId,
      source_domain: delivery.sourceDomain,
    },
    delivery,
    mapping: request.mapping,
  });
}

async function requestWorkbenchImport(
  envelope: GearsWorkbenchImportEnvelope,
  mode: 'dry_run' | 'execute',
): Promise<ApiResponse<GearsWorkbenchImportResult>> {
  const response = await requestWorkbench(mode === 'dry_run' ? DRY_RUN_PATH : EXECUTE_PATH, {
    method: 'POST',
    body: envelope,
  });
  if (!response.ok || !response.data) return forwardFailure(response);
  if (!response.data.ok) {
    return fail(
      response.data.status === 409 || response.data.status === 422
        ? ErrorCodes.VALIDATION_ERROR
        : ErrorCodes.INTERNAL_ERROR,
      `GEARS workbench import returned HTTP ${response.data.status}`,
      response.data.payload ?? response.data.text.slice(0, 500),
    );
  }
  if (!isImportResult(response.data.payload)) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'GEARS workbench response violated the zero-credit import result contract',
      response.data.payload,
    );
  }
  if (response.data.payload.mode !== mode) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      `GEARS workbench returned mode=${response.data.payload.mode}; expected ${mode}`,
    );
  }
  const actual = response.data.payload;
  if (
    actual.idempotency_key !== envelope.idempotency_key
    || actual.source.source_system !== envelope.source.source_system
    || actual.source.project_id !== envelope.source.project_id
    || actual.source.story_id !== envelope.source.story_id
    || actual.source.version_id !== envelope.source.version_id
    || actual.source.source_domain !== envelope.source.source_domain
  ) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'GEARS workbench response identity does not match the submitted import envelope',
      {
        expected: {
          idempotency_key: envelope.idempotency_key,
          source: envelope.source,
        },
        actual: {
          idempotency_key: actual.idempotency_key,
          source: actual.source,
        },
        counts_as_real_gears_seedance_delivery: false,
      },
    );
  }
  return success(actual);
}

async function appendWorkbenchAudit(
  result: GearsWorkbenchImportResult,
  importMayHaveApplied: boolean,
): Promise<ApiResponse<GearsWorkbenchImportResult>> {
  try {
    const localAudit = await appendGearsWorkbenchImportAudit(result);
    return success({ ...result, local_audit: localAudit });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown audit error';
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      `GEARS workbench response was valid but local import audit failed: ${message}`,
      {
        import_may_have_applied: importMayHaveApplied,
        idempotency_key: result.idempotency_key,
        retry_is_idempotent: true,
        counts_as_real_gears_seedance_delivery: false,
      },
    );
  }
}

export async function importProjectToGearsWorkbench(
  projectId: string,
  request: GearsWorkbenchProjectImportRequest,
  mode: 'dry_run' | 'execute',
): Promise<ApiResponse<GearsWorkbenchImportResult>> {
  const envelope = await buildGearsWorkbenchImportEnvelope(projectId, request);
  if (!envelope.ok || !envelope.data) return forwardFailure(envelope);
  if (mode === 'execute') {
    if (!request.expected_source_version_id || !request.expected_payload_sha256) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        'GEARS workbench execute requires expected_source_version_id and expected_payload_sha256 from a successful dry-run',
      );
    }
    if (envelope.data.source.version_id !== request.expected_source_version_id) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        'GEARS workbench dry-run proof is stale because the Story project version changed',
        {
          expected_source_version_id: request.expected_source_version_id,
          current_source_version_id: envelope.data.source.version_id,
          execute_sent: false,
          counts_as_real_gears_seedance_delivery: false,
        },
      );
    }
  }

  const capabilities = await getGearsWorkbenchCapabilities();
  if (!capabilities.ok) return forwardFailure(capabilities);

  if (mode === 'execute') {
    const preflight = await requestWorkbenchImport(envelope.data, 'dry_run');
    if (!preflight.ok || !preflight.data) return forwardFailure(preflight);
    const auditedPreflight = await appendWorkbenchAudit(preflight.data, false);
    if (!auditedPreflight.ok) return auditedPreflight;
    if (preflight.data.payload_sha256 !== request.expected_payload_sha256) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        'GEARS workbench dry-run proof is stale because the import payload changed',
        {
          expected_payload_sha256: request.expected_payload_sha256,
          current_payload_sha256: preflight.data.payload_sha256,
          execute_sent: false,
          counts_as_real_gears_seedance_delivery: false,
        },
      );
    }
    if (preflight.data.status !== 'planned' || preflight.data.blockers.length > 0) {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        'GEARS workbench execute preflight is blocked',
        {
          status: preflight.data.status,
          blockers: preflight.data.blockers,
          execute_sent: false,
          counts_as_real_gears_seedance_delivery: false,
        },
      );
    }
  }

  const response = await requestWorkbenchImport(envelope.data, mode);
  if (!response.ok || !response.data) return forwardFailure(response);
  if (mode === 'execute' && response.data.payload_sha256 !== request.expected_payload_sha256) {
    const audited = await appendWorkbenchAudit(response.data, true);
    if (!audited.ok) return audited;
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'GEARS workbench execute response payload hash does not match the validated dry-run proof',
      {
        expected_payload_sha256: request.expected_payload_sha256,
        actual_payload_sha256: response.data.payload_sha256,
        import_may_have_applied: true,
        retry_is_idempotent: true,
        counts_as_real_gears_seedance_delivery: false,
      },
    );
  }
  return appendWorkbenchAudit(response.data, mode === 'execute');
}
