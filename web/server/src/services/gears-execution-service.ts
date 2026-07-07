import {
  ErrorCodes,
  fail,
  success,
} from '@shared/types.js';
import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import {
  delimiter,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
import { GearsJobCallbackRequestSchema } from '@shared/schemas.js';
import type {
  ApiResponse,
  DomainPackProductionHealthReport,
  GearsExecutionArtifact,
  GearsExecutionAcceptanceArtifact,
  GearsExecutionAcceptanceCheck,
  GearsExecutionAcceptanceCheckStatus,
  GearsExecutionAcceptanceReport,
  GearsExecutionAcceptanceStatus,
  GearsExecutionConfigInfo,
  GearsExecutionContractInfo,
  GearsExecutionFailureCategory,
  GearsExecutionGeneratedProjectKind,
  GearsExecutionGeneratedProjectPressureItem,
  GearsExecutionGeneratedProjectPressureReport,
  GearsExecutionGeneratedProjectPressureRisk,
  GearsExecutionJobStatus,
  GearsExecutionJobType,
  GearsExecutionLiveE2EPlan,
  GearsExecutionLiveSmokeRunReport,
  GearsExecutionLiveSmokeRunRequest,
  GearsExecutionLiveSmokeRunStepResult,
  GearsExecutionPressureCheck,
  GearsExecutionPressureReport,
  GearsExecutionReadinessCheck,
  GearsExecutionReadinessReport,
  GearsExecutionReadinessSmoke,
  GearsExecutionSmokePackage,
  GearsExecutionWorkerAcceptanceCommand,
  GearsExecutionWorkerAcceptanceEnvVar,
  GearsExecutionWorkerAcceptanceKit,
  GearsExecutionWorkerAcceptancePayload,
  GearsExecutionWorkerRealEndpointReadiness,
  GearsExecutionWorkerAcceptanceSmokeTarget,
  GearsExecutionWorkerAcceptanceSmokeTargets,
  GearsExecutionWorkerEvidenceBundle,
  GearsExecutionWorkerEvidenceDocument,
  GearsExecutionWorkerEvidenceDocumentKind,
  GearsExecutionWorkerEvidenceSignoffAction,
  GearsExecutionWorkerEvidenceSignoffReport,
  GearsJobCallbackRequest,
  GearsJobLedgerEvent,
  GearsJobLedger,
  GearsJobLedgerItem,
  GearsJobSubmitAdapterSummary,
  GearsJobSubmitFailure,
  GearsJobStatusSyncAdapterSummary,
  ProductionMaterialPackHealthReport,
} from '@shared/types.js';
import {
  GEARS_CALLBACK_BATCH_ITEM_LIMIT,
  GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
} from '@shared/types.js';
import { getStoryAgentGeneratedHealth } from './generated-health-service.js';
import { getStoryAgentMvpStatus } from './story-agent-mvp-status-service.js';
import { getProductionMaterialPackHealthReport } from './production-material-pack-service.js';
import { getDomainPackProductionHealthReport } from './domain-pack-service.js';

export const GEARS_EXECUTION_JOB_TYPES: GearsExecutionJobType[] = [
  'storyboard_image',
  'character_image',
  'scene_image',
  'seedance_video',
  'subtitle_render',
  'audio_mix',
  'title_card_render',
  'final_assemble',
];

const GEARS_ACCEPTED_STATUS_FIELDS = [
  'status',
  'taskStatus',
  'state',
  'task_state',
  'job_status',
  'ready aliases: completed | complete | succeeded | success | done | finished',
  'failed aliases: failed | error | timed_out | timeout | expired | deadline_exceeded | quota_exceeded | no_credit | access_denied | token_expired | rate_limited | network_error | service_unavailable | provider_error | render_failed | artifact_upload_failed | callback_delivery_failed | output_missing | artifact_invalid | worker_unavailable',
  'rejected aliases: rejected | blocked | policy_blocked | moderation_failed | content_policy | safety_blocked | risk_control | invalid_prompt | invalid_payload | validation_failed | asset_missing | unsupported_media | invalid_asset',
  'canceled aliases: canceled | cancelled | aborted | user_canceled | manual_canceled',
];

const GEARS_WORKER_PRESSURE_DEFAULT_EPISODE_COUNT = 30;
const GEARS_WORKER_PRESSURE_DEFAULT_SHOTS_PER_EPISODE = 4;

const GEARS_FAILURE_CATEGORIES: GearsExecutionFailureCategory[] = [
  'asset_missing',
  'artifact_invalid',
  'artifact_upload_failed',
  'callback_delivery_failed',
  'output_missing',
  'payload_invalid',
  'content_policy',
  'provider_timeout',
  'provider_quota',
  'provider_auth',
  'provider_rate_limit',
  'provider_server_error',
  'render_failed',
  'worker_unavailable',
  'network_error',
  'unknown',
];

export interface GearsExecutionSubmitUnit {
  source_unit_id: string;
  source_unit_label?: string;
  source_scene_id?: number;
  payload: Record<string, unknown>;
  payload_summary?: string;
  local_gears_job_id: string;
}

export interface GearsExecutionAcceptedJob {
  source_unit_id: string;
  gears_job_id: string;
  status: GearsExecutionJobStatus;
  idempotency_key?: string;
  progress_percent?: number;
  artifacts?: GearsExecutionArtifact[];
}

export interface GearsExecutionSubmitAdapterResult {
  accepted: GearsExecutionAcceptedJob[];
  failures: GearsJobSubmitFailure[];
  summary: GearsJobSubmitAdapterSummary;
}

export interface GearsExecutionPolledJob {
  item: GearsJobLedgerItem;
  callback: GearsJobCallbackRequest;
}

export interface GearsExecutionPollAdapterResult {
  callbacks: GearsExecutionPolledJob[];
  failures: GearsJobSubmitFailure[];
  summary: GearsJobStatusSyncAdapterSummary;
}

export interface NormalizedGearsJobCallback {
  gears_job_id?: string;
  job_type?: GearsExecutionJobType;
  source_project_id?: string;
  source_story_id?: string;
  series_project_id?: string;
  idempotency_key?: string;
  source_unit_id?: string;
  status: GearsExecutionJobStatus;
  progress_percent?: number;
  artifact_urls: string[];
  artifacts?: GearsExecutionArtifact[];
  failure_category?: GearsExecutionFailureCategory;
  error_code?: string;
  failure_reason?: string;
  provider_event_at?: string;
  completed_at?: string;
  event_id?: string;
  event_id_source?: 'event' | 'callback' | 'idempotency_key';
  message?: string;
  note?: string;
  quality_score?: number;
  review_note?: string;
}

const GEARS_CALLBACK_BASE_ENVS = [
  'GEARS_CALLBACK_BASE_URL',
  'PUBLIC_API_BASE_URL',
  'APP_BASE_URL',
];

const LEGACY_SEEDANCE_PROVIDER_ENVS = [
  'SEEDANCE_PROVIDER_SUBMIT_ENDPOINT',
  'SEEDANCE_PROVIDER_POLL_ENDPOINT',
  'SEEDANCE_PROVIDER_API_TOKEN',
  'SEEDANCE_PROVIDER_SUBMIT_API_TOKEN',
  'SEEDANCE_CALLBACK_SECRET',
];

function envFlag(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function configuredGearsApiBaseUrl(): string | undefined {
  return process.env.GEARS_API_BASE_URL?.trim() || undefined;
}

function configuredGearsApiToken(): string | undefined {
  return process.env.GEARS_API_TOKEN?.trim() || undefined;
}

function configuredGearsCallbackBaseUrl(): string | undefined {
  for (const envName of GEARS_CALLBACK_BASE_ENVS) {
    const value = process.env[envName]?.trim();
    if (value) return value;
  }
  return undefined;
}

function joinPublicUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function gearsProjectCallbackPath(projectId: string): string {
  return `/api/projects/${projectId}/gears-callback`;
}

export function gearsSeriesCallbackPath(seriesProjectId: string): string {
  return `/api/story-outline/ai-comic-series-projects/${seriesProjectId}/gears-callback`;
}

export function gearsProjectCallbackUrl(projectId: string): string | undefined {
  const baseUrl = configuredGearsCallbackBaseUrl();
  return baseUrl ? joinPublicUrl(baseUrl, gearsProjectCallbackPath(projectId)) : undefined;
}

export function gearsSeriesCallbackUrl(seriesProjectId: string): string | undefined {
  const baseUrl = configuredGearsCallbackBaseUrl();
  return baseUrl ? joinPublicUrl(baseUrl, gearsSeriesCallbackPath(seriesProjectId)) : undefined;
}

export function getGearsExecutionConfigInfo(): GearsExecutionConfigInfo {
  const apiBaseConfigured = envFlag('GEARS_API_BASE_URL');
  const apiTokenConfigured = envFlag('GEARS_API_TOKEN');
  const callbackSecretConfigured = envFlag('GEARS_CALLBACK_SECRET');
  const callbackBaseConfigured = GEARS_CALLBACK_BASE_ENVS.some(envFlag);
  const missingSubmitRequirements = apiBaseConfigured ? [] : ['GEARS_API_BASE_URL'];
  const configurationWarnings = [
    ...(!apiTokenConfigured
      ? ['GEARS_API_TOKEN 未配置；仅适用于 GEARS 本地无鉴权或 mock 提交。']
      : []),
    ...(!callbackSecretConfigured
      ? ['GEARS_CALLBACK_SECRET 未配置；GEARS 回调不会启用共享密钥保护。']
      : []),
    ...(!callbackBaseConfigured
      ? ['GEARS_CALLBACK_BASE_URL 未配置；提交给 GEARS 的 payload 只会包含相对 callback path。']
      : []),
    ...(LEGACY_SEEDANCE_PROVIDER_ENVS.some(envFlag)
      ? ['检测到旧 SEEDANCE_PROVIDER_* 配置；保留兼容，但新开发应优先走 GEARS_*。']
      : []),
  ];
  return {
    provider: 'gears',
    api_base_url_configured: apiBaseConfigured,
    api_token_configured: apiTokenConfigured,
    callback_secret_configured: callbackSecretConfigured,
    callback_base_configured: callbackBaseConfigured,
    callback_base_envs: GEARS_CALLBACK_BASE_ENVS,
    submit_endpoint_path: '/gears/jobs',
    job_status_endpoint_path: '/gears/jobs/{gears_job_id}',
    project_callback_path_template: '/api/projects/:projectId/gears-callback',
    series_callback_path_template: '/api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-callback',
    supported_job_types: GEARS_EXECUTION_JOB_TYPES,
    callback_batch_item_limit: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
    callback_event_retention_limit: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
    legacy_seedance_provider_envs: LEGACY_SEEDANCE_PROVIDER_ENVS,
    ready_for_submit: apiBaseConfigured,
    missing_submit_requirements: missingSubmitRequirements,
    configuration_warnings: configurationWarnings,
    next_actions: [
      ...(apiBaseConfigured ? [] : ['配置 GEARS_API_BASE_URL 后可启用 use_gears_api=true 的真实 HTTP 提交。']),
      ...(callbackSecretConfigured ? [] : ['配置 GEARS_CALLBACK_SECRET 以保护 GEARS 回调入口。']),
      ...(apiBaseConfigured ? ['GEARS HTTP 合同已可 smoke；未设置 use_gears_api 时仍只写本地 ledger。'] : []),
    ],
    generated_at: new Date().toISOString(),
  };
}

function readinessCheck(input: GearsExecutionReadinessCheck): GearsExecutionReadinessCheck {
  return input;
}

function readinessSmoke(input: GearsExecutionReadinessSmoke): GearsExecutionReadinessSmoke {
  return input;
}

function readinessScore(items: Array<GearsExecutionReadinessCheck | GearsExecutionReadinessSmoke>): number {
  if (!items.length) return 0;
  const points = items.reduce((sum, item) => {
    if (item.status === 'pass') return sum + 1;
    if (item.status === 'warn') return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((points / items.length) * 100);
}

function liveE2EBlockedBy(input: {
  apiBase?: boolean;
  callbackBase?: boolean;
  callbackSecret?: boolean;
}): string[] {
  return [
    ...(input.apiBase === false ? ['GEARS_API_BASE_URL'] : []),
    ...(input.callbackBase === false ? ['GEARS_CALLBACK_BASE_URL | PUBLIC_API_BASE_URL | APP_BASE_URL'] : []),
    ...(input.callbackSecret === false ? ['GEARS_CALLBACK_SECRET'] : []),
  ];
}

function buildGearsExecutionLiveE2EPlan(config: GearsExecutionConfigInfo): GearsExecutionLiveE2EPlan {
  const submitBlocked = liveE2EBlockedBy({ apiBase: config.api_base_url_configured });
  const pollBlocked = liveE2EBlockedBy({ apiBase: config.api_base_url_configured });
  const callbackBlocked = liveE2EBlockedBy({
    callbackBase: config.callback_base_configured,
    callbackSecret: config.callback_secret_configured,
  });
  const steps: GearsExecutionLiveE2EPlan['steps'] = [
    {
      id: 'submit_http',
      label: 'Submit GEARS job',
      method: 'POST',
      path: config.submit_endpoint_path,
      status: submitBlocked.length ? 'blocked' : 'ready',
      blocked_by: submitBlocked,
      expected_result: 'GEARS returns acceptedUnits/rejectedUnits or jobs[] and Story Agent writes GEARS Job Ledger.',
    },
    {
      id: 'status_poll',
      label: 'Poll GEARS job status',
      method: 'GET',
      path: config.job_status_endpoint_path,
      status: pollBlocked.length ? 'blocked' : 'ready',
      blocked_by: pollBlocked,
      expected_result: 'GEARS status response updates ledger progress, artifacts, terminal state, or poll diagnostics.',
    },
    {
      id: 'project_callback',
      label: 'Project callback',
      method: 'POST',
      path: config.project_callback_path_template,
      status: callbackBlocked.length ? 'blocked' : 'ready',
      blocked_by: callbackBlocked,
      expected_result: 'GEARS webhook writes single-story GEARS Job Ledger and Seedance Shot Ledger.',
    },
    {
      id: 'series_callback',
      label: 'Series callback',
      method: 'POST',
      path: config.series_callback_path_template,
      status: callbackBlocked.length ? 'blocked' : 'ready',
      blocked_by: callbackBlocked,
      expected_result: 'GEARS webhook writes AI comic series GEARS ledger and production ledgers.',
    },
  ];
  const blockedBy = [...new Set(steps.flatMap(step => step.blocked_by))];
  const readyStepCount = steps.filter(step => step.status === 'ready').length;
  return {
    ready: readyStepCount === steps.length,
    ready_step_count: readyStepCount,
    total_step_count: steps.length,
    blocked_by: blockedBy,
    steps,
  };
}

function buildPressureCallbackEnvelope(count: number): GearsJobCallbackRequest {
  return {
    callbacks: Array.from({ length: count }, (_, index) => ({
      jobId: `gears-pressure-${index}`,
      externalId: `pressure-shot-${index}`,
      jobType: 'seedance_video',
      taskStatus: 'PROCESSING',
      progressPercent: index % 100,
      eventId: `gears-pressure-event-${index}`,
    })),
  } as GearsJobCallbackRequest;
}

function renderGearsExecutionPressureReportMarkdown(report: Omit<GearsExecutionPressureReport, 'markdown'>): string {
  const lines: string[] = [
    '# GEARS v2 Pressure Report',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- status: ${report.status}`,
    `- callback_batch_item_limit: ${report.callback_batch_item_limit}`,
    `- callback_event_retention_limit: ${report.callback_event_retention_limit}`,
    `- batch_at_limit_count: ${report.batch_at_limit_count}`,
    `- batch_over_limit_count: ${report.batch_over_limit_count}`,
    `- extracted_at_limit_count: ${report.extracted_at_limit_count}`,
    `- overflow_rejected: ${report.overflow_rejected}`,
    `- retained_event_count: ${report.retained_event_count}`,
    `- dropped_event_count: ${report.dropped_event_count}`,
    '',
    '## Checks',
    '',
    ...report.checks.map(check => `- ${check.status} · ${check.label}: ${check.message}`),
  ];
  return `${lines.join('\n').trim()}\n`;
}

function pressureCheck(input: GearsExecutionPressureCheck): GearsExecutionPressureCheck {
  return input;
}

export function getGearsExecutionPressureReport(): GearsExecutionPressureReport {
  const atLimitEnvelope = buildPressureCallbackEnvelope(GEARS_CALLBACK_BATCH_ITEM_LIMIT);
  const overLimitEnvelope = buildPressureCallbackEnvelope(GEARS_CALLBACK_BATCH_ITEM_LIMIT + 1);
  const atLimitParse = GearsJobCallbackRequestSchema.safeParse(atLimitEnvelope);
  const overLimitParse = GearsJobCallbackRequestSchema.safeParse(overLimitEnvelope);
  const extractedAtLimitCount = atLimitParse.success
    ? extractGearsJobCallbackRequests(atLimitParse.data).length
    : 0;

  let events: GearsJobLedgerEvent[] = [];
  const simulatedEventCount = GEARS_CALLBACK_EVENT_RETENTION_LIMIT + 5;
  for (let index = 0; index < simulatedEventCount; index += 1) {
    events = mergeGearsCallbackEvents({
      existing: events,
      receivedAt: `2026-06-21T00:00:${String(index).padStart(2, '0')}.000Z`,
      callback: normalizeGearsJobCallback({
        jobId: 'gears-pressure-events',
        sourceUnitId: 'pressure-shot-1',
        jobType: 'seedance_video',
        taskStatus: 'PROCESSING',
        progressPercent: index,
        eventId: `gears-pressure-event-${index}`,
        message: `pressure event ${index}`,
      }),
    });
  }

  const checks: GearsExecutionPressureCheck[] = [
    pressureCheck({
      id: 'callback_batch_at_limit',
      label: 'Callback batch at limit',
      status: atLimitParse.success && extractedAtLimitCount === GEARS_CALLBACK_BATCH_ITEM_LIMIT ? 'pass' : 'fail',
      message: `GEARS accepts and extracts ${GEARS_CALLBACK_BATCH_ITEM_LIMIT} callback items in one envelope.`,
      details: {
        parse_success: atLimitParse.success,
        extracted_count: extractedAtLimitCount,
      },
    }),
    pressureCheck({
      id: 'callback_batch_over_limit',
      label: 'Callback batch over limit',
      status: !overLimitParse.success ? 'pass' : 'fail',
      message: `GEARS rejects callback envelopes above ${GEARS_CALLBACK_BATCH_ITEM_LIMIT} items.`,
      details: {
        parse_success: overLimitParse.success,
        over_limit_count: GEARS_CALLBACK_BATCH_ITEM_LIMIT + 1,
      },
    }),
    pressureCheck({
      id: 'callback_event_retention',
      label: 'Callback event retention',
      status: events.length === GEARS_CALLBACK_EVENT_RETENTION_LIMIT
        && events[0]?.event_id === 'gears-pressure-event-5'
        && events.at(-1)?.event_id === `gears-pressure-event-${simulatedEventCount - 1}`
        ? 'pass'
        : 'fail',
      message: `GEARS keeps only the latest ${GEARS_CALLBACK_EVENT_RETENTION_LIMIT} callback events per job.`,
      details: {
        simulated_event_count: simulatedEventCount,
        retained_event_count: events.length,
        first_retained_event_id: events[0]?.event_id,
        last_retained_event_id: events.at(-1)?.event_id,
      },
    }),
  ];
  const status: GearsExecutionPressureReport['status'] = checks.every(check => check.status === 'pass')
    ? 'pass'
    : 'fail';
  const report: Omit<GearsExecutionPressureReport, 'markdown'> = {
    provider: 'gears',
    schema_version: 'gears-execution-pressure-report/v1',
    status,
    callback_batch_item_limit: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
    callback_event_retention_limit: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
    batch_at_limit_count: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
    batch_over_limit_count: GEARS_CALLBACK_BATCH_ITEM_LIMIT + 1,
    extracted_at_limit_count: extractedAtLimitCount,
    overflow_rejected: !overLimitParse.success,
    retained_event_count: events.length,
    dropped_event_count: simulatedEventCount - events.length,
    first_retained_event_id: events[0]?.event_id,
    last_retained_event_id: events.at(-1)?.event_id,
    checks,
    generated_at: new Date().toISOString(),
  };
  return {
    ...report,
    markdown: renderGearsExecutionPressureReportMarkdown(report),
  };
}

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || resolve(kbRoot(), '..', 'web', 'generated');
}

function repoWebGeneratedRoot(): string {
  return resolve(import.meta.dirname, '..', '..', '..', '..', 'web', 'generated');
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.filter(item => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function generatedRoots(): string[] {
  if (process.env.WEB_GENERATED_ROOT) return [generatedRoot()];
  return uniquePaths([
    generatedRoot(),
    repoWebGeneratedRoot(),
  ]);
}

function generatedStoryProjectsRoots(): string[] {
  return generatedRoots().map(root => resolve(root, 'projects'));
}

function generatedSeriesProjectsRoots(): string[] {
  return generatedRoots().map(root => resolve(root, 'ai-comic-series-projects'));
}

async function readJsonRecord(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf-8')) as unknown;
    return isObjectRecord(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

function rawGearsLedgerFromRecord(record: Record<string, unknown>): GearsJobLedger | undefined {
  const ledger = record.gears_job_ledger;
  if (!isObjectRecord(ledger) || !Array.isArray(ledger.items)) return undefined;
  return ledger as unknown as GearsJobLedger;
}

async function readGeneratedProjectRecords(
  rootPaths: string[],
  kind: GearsExecutionGeneratedProjectKind,
): Promise<{ kind: GearsExecutionGeneratedProjectKind; record: Record<string, unknown> }[]> {
  const records: { kind: GearsExecutionGeneratedProjectKind; record: Record<string, unknown> }[] = [];
  const seen = new Set<string>();
  for (const rootPath of rootPaths) {
    let entries: Dirent[];
    try {
      entries = await readdir(rootPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const record = await readJsonRecord(resolve(rootPath, entry.name, 'project.json'));
      if (!record) continue;
      const projectId = generatedProjectId(record, kind) ?? entry.name;
      const key = `${kind}:${projectId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({ kind, record });
    }
  }
  return records;
}

async function readGeneratedStoryIds(): Promise<Set<string>> {
  const storyIds = new Set<string>();
  for (const rootPath of generatedRoots().map(root => resolve(root, 'stories'))) {
    let typeEntries: Dirent[];
    try {
      typeEntries = await readdir(rootPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const typeEntry of typeEntries) {
      if (!typeEntry.isDirectory()) continue;
      let storyEntries: Dirent[];
      try {
        storyEntries = await readdir(resolve(rootPath, typeEntry.name), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const storyEntry of storyEntries) {
        if (!storyEntry.isFile() || !storyEntry.name.endsWith('.json')) continue;
        storyIds.add(storyEntry.name.replace(/\.json$/, ''));
      }
    }
  }
  return storyIds;
}

function generatedProjectId(record: Record<string, unknown>, kind: GearsExecutionGeneratedProjectKind): string | undefined {
  if (kind === 'ai_comic_series_project') {
    const nestedProject = isObjectRecord(record.project) ? record.project : {};
    return stringField(
      record.series_project_id
        ?? record.project_id
        ?? nestedProject.series_project_id
        ?? nestedProject.project_id
        ?? nestedProject.id,
    );
  }
  return stringField(record.project_id ?? record.story_project_id ?? record.id);
}

function generatedProjectTitle(record: Record<string, unknown>, kind: GearsExecutionGeneratedProjectKind): string | undefined {
  if (kind === 'ai_comic_series_project') {
    const nestedProject = isObjectRecord(record.project) ? record.project : {};
    return stringField(record.title ?? nestedProject.title ?? nestedProject.name);
  }
  return stringField(record.title ?? record.project_title ?? record.name);
}

function generatedProjectUpdatedAt(record: Record<string, unknown>, kind: GearsExecutionGeneratedProjectKind): string | undefined {
  if (kind === 'ai_comic_series_project') {
    const nestedProject = isObjectRecord(record.project) ? record.project : {};
    return stringField(record.updated_at ?? nestedProject.updated_at ?? record.generated_at);
  }
  return stringField(record.updated_at ?? record.generated_at ?? record.created_at);
}

function generatedStoryProjectSmokeTarget(
  record: Record<string, unknown>,
): GearsExecutionWorkerAcceptanceSmokeTarget | undefined {
  const projectId = generatedProjectId(record, 'story_project');
  if (!projectId) return undefined;
  const currentStoryId = stringField(record.current_story_id ?? record.story_id);
  return {
    id: projectId,
    kind: 'story_project',
    title: generatedProjectTitle(record, 'story_project'),
    updated_at: generatedProjectUpdatedAt(record, 'story_project'),
    current_story_id: currentStoryId,
    video_type: stringField(record.video_type) as GearsExecutionWorkerAcceptanceSmokeTarget['video_type'],
  };
}

function generatedSeriesProjectSmokeTarget(
  record: Record<string, unknown>,
  availableStoryIds: Set<string>,
): GearsExecutionWorkerAcceptanceSmokeTarget | undefined {
  const projectId = generatedProjectId(record, 'ai_comic_series_project');
  if (!projectId) return undefined;
  const nestedProject = isObjectRecord(record.project) ? record.project : {};
  const plan = isObjectRecord(record.plan) ? record.plan : {};
  const seedanceProduction = isObjectRecord(record.seedance_production) ? record.seedance_production : {};
  const seedanceProductionItems = Array.isArray(seedanceProduction.items) ? seedanceProduction.items : [];
  const seedanceReviewLedger = isObjectRecord(record.seedance_review_ledger) ? record.seedance_review_ledger : {};
  const openReviewItems = Array.isArray(seedanceReviewLedger.items)
    ? seedanceReviewLedger.items.filter(item => {
      if (!isObjectRecord(item)) return false;
      const status = stringField(item.status)?.toLowerCase();
      return status !== 'resolved' && status !== 'closed';
    })
    : [];
  const generatedEpisodeStoryIds = Array.isArray(record.generated_episode_story_ids)
    ? record.generated_episode_story_ids.filter(item => typeof item === 'string' && item.trim())
    : isObjectRecord(record.generated_episode_story_ids)
      ? Object.values(record.generated_episode_story_ids).filter(item => typeof item === 'string' && item.trim())
    : [];
  const existingGeneratedEpisodeStoryIds = generatedEpisodeStoryIds.filter(storyId => availableStoryIds.has(storyId));
  const seedanceVideoRetryCandidates = existingGeneratedEpisodeStoryIds.length
    ? seedanceProductionItems.filter(item => {
      if (!isObjectRecord(item)) return false;
      const status = stringField(item.status)?.toLowerCase();
      const videoUrl = stringField(item.video_url ?? item.videoUrl);
      return status !== 'skipped' && !(status === 'ready' && Boolean(videoUrl));
    })
    : [];
  const seedanceTitleCardRender = isObjectRecord(record.seedance_title_card_render)
    ? record.seedance_title_card_render
    : {};
  const titleCardRenderCount = Math.max(
    numberField(seedanceTitleCardRender.card_count) ?? 0,
    Array.isArray(seedanceTitleCardRender.output_paths) ? seedanceTitleCardRender.output_paths.length : 0,
    Array.isArray(seedanceTitleCardRender.ffmpeg_commands) ? seedanceTitleCardRender.ffmpeg_commands.length : 0,
  );
  const seedanceSubtitleRender = isObjectRecord(record.seedance_subtitle_render)
    ? record.seedance_subtitle_render
    : {};
  const hasSubtitleRenderUnit = Boolean(stringField(seedanceSubtitleRender.srt_path ?? seedanceSubtitleRender.output_path));
  const seedanceAudioMix = isObjectRecord(record.seedance_audio_mix) ? record.seedance_audio_mix : {};
  const hasAudioMixUnit = Boolean(stringField(seedanceAudioMix.output_path ?? seedanceAudioMix.ffmpeg_command));
  const seedanceFinalDelivery = isObjectRecord(record.seedance_final_delivery) ? record.seedance_final_delivery : {};
  const hasFinalAssembleUnit = Boolean(stringField(seedanceFinalDelivery.output_path ?? seedanceFinalDelivery.manifest_path));
  const postproductionSeedJobCount = titleCardRenderCount
    + (hasSubtitleRenderUnit ? 1 : 0)
    + (hasAudioMixUnit ? 1 : 0)
    + (hasFinalAssembleUnit ? 1 : 0);
  const seedanceVideoReady = seedanceVideoRetryCandidates.length > 0;
  const generatedEpisodeReady = existingGeneratedEpisodeStoryIds.length > 0;
  const recommendedLedgerSeedJobType: GearsExecutionJobType | undefined = seedanceVideoReady
    ? 'seedance_video'
    : titleCardRenderCount > 0
      ? 'title_card_render'
      : hasSubtitleRenderUnit
        ? 'subtitle_render'
        : hasAudioMixUnit
          ? 'audio_mix'
          : hasFinalAssembleUnit
            ? 'final_assemble'
            : generatedEpisodeReady
              ? 'storyboard_image'
              : undefined;
  const ledgerSeedScore = (seedanceVideoReady ? 120 : recommendedLedgerSeedJobType ? 90 : 0)
    + Math.min(seedanceProductionItems.length, 20)
    + Math.min(openReviewItems.length * 5, 30)
    + Math.min(existingGeneratedEpisodeStoryIds.length * 5, 20)
    + Math.min(postproductionSeedJobCount, 20);
  const ledgerSeedReason = seedanceVideoReady
    ? `seedance_retry_candidates=${seedanceVideoRetryCandidates.length}, existing_episode_stories=${existingGeneratedEpisodeStoryIds.length}`
    : titleCardRenderCount > 0
      ? `title_card_render_units=${titleCardRenderCount}; seedance_video blocked by missing retry candidates`
      : hasSubtitleRenderUnit
        ? 'subtitle_render package available; seedance_video blocked by missing retry candidates'
        : hasAudioMixUnit
          ? 'audio_mix package available; seedance_video blocked by missing retry candidates'
          : hasFinalAssembleUnit
            ? 'final_assemble package available; seedance_video blocked by missing retry candidates'
            : generatedEpisodeReady
              ? `existing_episode_stories=${existingGeneratedEpisodeStoryIds.length}`
      : 'No seedance production review candidates or generated episode story ids found.';
  return {
    id: projectId,
    kind: 'ai_comic_series_project',
    title: generatedProjectTitle(record, 'ai_comic_series_project'),
    updated_at: generatedProjectUpdatedAt(record, 'ai_comic_series_project'),
    episode_count: numberField(nestedProject.episode_count ?? plan.episode_count),
    generated_episode_count: numberField(nestedProject.generated_episode_count),
    generated_episode_story_id_count: generatedEpisodeStoryIds.length,
    existing_generated_episode_story_id_count: existingGeneratedEpisodeStoryIds.length,
    seedance_production_item_count: seedanceProductionItems.length,
    seedance_video_retry_candidate_count: seedanceVideoRetryCandidates.length,
    open_review_item_count: openReviewItems.length,
    postproduction_seed_job_count: postproductionSeedJobCount,
    ledger_seed_ready: Boolean(recommendedLedgerSeedJobType),
    ledger_seed_score: ledgerSeedScore,
    recommended_ledger_seed_job_type: recommendedLedgerSeedJobType,
    ledger_seed_reason: ledgerSeedReason,
  };
}

async function getGearsWorkerAcceptanceSmokeTargets(): Promise<GearsExecutionWorkerAcceptanceSmokeTargets> {
  const [storyRecords, seriesRecords, availableStoryIds] = await Promise.all([
    readGeneratedProjectRecords(generatedStoryProjectsRoots(), 'story_project'),
    readGeneratedProjectRecords(generatedSeriesProjectsRoots(), 'ai_comic_series_project'),
    readGeneratedStoryIds(),
  ]);
  const byUpdatedAtDesc = (
    a: GearsExecutionWorkerAcceptanceSmokeTarget,
    b: GearsExecutionWorkerAcceptanceSmokeTarget,
  ) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  const byLedgerSeedThenUpdatedAtDesc = (
    a: GearsExecutionWorkerAcceptanceSmokeTarget,
    b: GearsExecutionWorkerAcceptanceSmokeTarget,
  ) => {
    const scoreDiff = (b.ledger_seed_score ?? 0) - (a.ledger_seed_score ?? 0);
    if (scoreDiff) return scoreDiff;
    if (a.ledger_seed_ready !== b.ledger_seed_ready) return a.ledger_seed_ready ? -1 : 1;
    return byUpdatedAtDesc(a, b);
  };
  const storyProjectCandidates = storyRecords
    .map(({ record }) => generatedStoryProjectSmokeTarget(record))
    .filter((item): item is GearsExecutionWorkerAcceptanceSmokeTarget => Boolean(item))
    .sort(byUpdatedAtDesc)
    .slice(0, 5);
  const seriesProjectCandidates = seriesRecords
    .map(({ record }) => generatedSeriesProjectSmokeTarget(record, availableStoryIds))
    .filter((item): item is GearsExecutionWorkerAcceptanceSmokeTarget => Boolean(item))
    .sort(byLedgerSeedThenUpdatedAtDesc)
    .slice(0, 5);
  const storyProject = storyProjectCandidates[0];
  const seriesProject = seriesProjectCandidates[0];
  const recommendedEnv: Record<string, string> = {};
  if (storyProject) {
    recommendedEnv.GEARS_SMOKE_PROJECT_ID = storyProject.id;
    if (storyProject.current_story_id) recommendedEnv.GEARS_SMOKE_STORY_ID = storyProject.current_story_id;
  }
  if (seriesProject) {
    recommendedEnv.GEARS_SMOKE_SERIES_PROJECT_ID = seriesProject.id;
    if (seriesProject.recommended_ledger_seed_job_type) {
      recommendedEnv.GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE = seriesProject.recommended_ledger_seed_job_type;
    }
  }
  const warnings = [
    ...(!storyProject ? ['No generated Story Agent project found for GEARS_SMOKE_PROJECT_ID auto-fill.'] : []),
    ...(!seriesProject ? ['No generated AI comic series project found for GEARS_SMOKE_SERIES_PROJECT_ID auto-fill.'] : []),
    ...(seriesProject && !seriesProject.ledger_seed_ready
      ? [`Selected AI comic series project ${seriesProject.id} has no obvious ledger seed candidates.`]
      : []),
  ];
  return {
    schema_version: 'gears-worker-acceptance-smoke-targets/v1',
    story_project: storyProject,
    series_project: seriesProject,
    story_project_candidates: storyProjectCandidates,
    series_project_candidates: seriesProjectCandidates,
    recommended_env: recommendedEnv,
    warning_count: warnings.length,
    warnings,
  };
}

function gearsLedgerArtifactCount(item: GearsJobLedgerItem): number {
  const urls = new Set<string>();
  for (const url of item.artifact_urls ?? []) {
    if (url.trim()) urls.add(url.trim());
  }
  for (const artifact of item.artifacts ?? []) {
    if (artifact.url?.trim()) urls.add(artifact.url.trim());
  }
  return urls.size;
}

function maxIsoTimestamp(values: (string | undefined)[]): string | undefined {
  let selected: string | undefined;
  let selectedTime = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const time = value ? Date.parse(value) : Number.NaN;
    if (!Number.isFinite(time) || time <= selectedTime) continue;
    selected = value;
    selectedTime = time;
  }
  return selected;
}

function buildGeneratedProjectPressureItem(input: {
  kind: GearsExecutionGeneratedProjectKind;
  record: Record<string, unknown>;
}): GearsExecutionGeneratedProjectPressureItem | undefined {
  const rawLedger = rawGearsLedgerFromRecord(input.record);
  if (!rawLedger) return undefined;
  const ledger = normalizeGearsJobLedger(rawLedger);
  const projectId = generatedProjectId(input.record, input.kind);
  if (!projectId) return undefined;
  const failureCategories: Partial<Record<GearsExecutionFailureCategory, number>> = {};
  let activeCount = 0;
  let terminalCount = 0;
  let failedCount = 0;
  let callbackEventCount = 0;
  let maxCallbackEventsPerJob = 0;
  let nearEventRetentionLimitCount = 0;
  let artifactCount = 0;
  const nearRetentionThreshold = Math.max(1, GEARS_CALLBACK_EVENT_RETENTION_LIMIT - 2);
  const updatedAtCandidates = [ledger.updated_at];

  for (const item of ledger.items) {
    if (gearsJobStatusIsTerminal(item.status)) terminalCount += 1;
    else activeCount += 1;
    if (item.status === 'failed' || item.status === 'rejected') failedCount += 1;
    if (item.failure_category) {
      failureCategories[item.failure_category] = (failureCategories[item.failure_category] ?? 0) + 1;
    }
    const itemEventCount = item.callback_events?.length ?? 0;
    callbackEventCount += itemEventCount;
    maxCallbackEventsPerJob = Math.max(maxCallbackEventsPerJob, itemEventCount);
    if (itemEventCount >= nearRetentionThreshold) nearEventRetentionLimitCount += 1;
    artifactCount += gearsLedgerArtifactCount(item);
    updatedAtCandidates.push(item.updated_at, item.completed_at, item.last_poll_at);
  }

  const recommendations: string[] = [];
  if (ledger.items.length > GEARS_CALLBACK_BATCH_ITEM_LIMIT) {
    recommendations.push(`项目 job_count=${ledger.items.length} 超过 callback 批量上限，GEARS worker 回调必须拆批。`);
  }
  if (nearEventRetentionLimitCount > 0) {
    recommendations.push(`${nearEventRetentionLimitCount} 个 job 接近每 job 事件保留上限，建议外部归档完整 worker 日志。`);
  }
  if (failedCount > 0) {
    recommendations.push(`存在 ${failedCount} 个失败/拒绝 job，优先查看 failure_categories 与 retry 包。`);
  }
  if (ledger.items.length > 0 && artifactCount === 0 && terminalCount > 0) {
    recommendations.push('已有终态 job 但未记录 artifact URL，检查 GEARS 回调 artifact 字段映射。');
  }

  const riskLevel: GearsExecutionGeneratedProjectPressureRisk = nearEventRetentionLimitCount > 0 && activeCount > 0
    ? 'blocked'
    : recommendations.length
      ? 'watch'
      : 'ok';

  return {
    project_id: projectId,
    project_kind: input.kind,
    title: generatedProjectTitle(input.record, input.kind),
    job_count: ledger.items.length,
    active_count: activeCount,
    terminal_count: terminalCount,
    failed_count: failedCount,
    callback_event_count: callbackEventCount,
    max_callback_events_per_job: maxCallbackEventsPerJob,
    near_event_retention_limit_count: nearEventRetentionLimitCount,
    artifact_count: artifactCount,
    failure_categories: failureCategories,
    latest_updated_at: maxIsoTimestamp(updatedAtCandidates),
    risk_level: riskLevel,
    recommendations,
  };
}

function mergeGeneratedProjectPressureStatus(
  current: GearsExecutionGeneratedProjectPressureRisk,
  next: GearsExecutionGeneratedProjectPressureRisk,
): GearsExecutionGeneratedProjectPressureRisk {
  if (current === 'blocked' || next === 'blocked') return 'blocked';
  if (current === 'watch' || next === 'watch') return 'watch';
  return 'ok';
}

function buildGeneratedProjectPressureRecommendations(input: {
  items: GearsExecutionGeneratedProjectPressureItem[];
  totalFailedCount: number;
  maxProjectJobCount: number;
  maxJobCallbackEventCount: number;
}): string[] {
  const recommendations: string[] = [];
  if (!input.items.length) {
    recommendations.push('当前生成目录未发现 gears_job_ledger；先完成一次 GEARS submit/callback 后再进行真实项目压力审计。');
    return recommendations;
  }
  if (input.maxProjectJobCount > GEARS_CALLBACK_BATCH_ITEM_LIMIT) {
    recommendations.push('存在单项目 job 数超过 callback 批量上限的项目，worker 回调需要按批拆分并保持幂等键稳定。');
  }
  if (input.maxJobCallbackEventCount >= GEARS_CALLBACK_EVENT_RETENTION_LIMIT - 2) {
    recommendations.push('存在 job 回调事件接近保留上限，建议补充 worker 侧完整事件归档或调低高频进度回调。');
  }
  if (input.totalFailedCount > 0) {
    recommendations.push('存在失败/拒绝 job，下一步应结合 failure_categories 生成批量 retry 或修复清单。');
  }
  if (!recommendations.length) {
    recommendations.push('当前已生成项目 ledger 压力正常，可进入真实 GEARS worker E2E smoke。');
  }
  return recommendations;
}

function renderGeneratedProjectPressureMarkdown(report: Omit<GearsExecutionGeneratedProjectPressureReport, 'markdown'>): string {
  const lines: string[] = [
    '# GEARS v2 Generated Project Pressure Audit',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- pressure_status: ${report.pressure_status}`,
    `- scanned_story_project_count: ${report.scanned_story_project_count}`,
    `- scanned_series_project_count: ${report.scanned_series_project_count}`,
    `- project_with_gears_ledger_count: ${report.project_with_gears_ledger_count}`,
    `- total_job_count: ${report.total_job_count}`,
    `- total_active_count: ${report.total_active_count}`,
    `- total_terminal_count: ${report.total_terminal_count}`,
    `- total_failed_count: ${report.total_failed_count}`,
    `- total_callback_event_count: ${report.total_callback_event_count}`,
    `- max_project_job_count: ${report.max_project_job_count}`,
    `- max_job_callback_event_count: ${report.max_job_callback_event_count}`,
    '',
    '## Recommendations',
    '',
    ...report.recommendations.map(item => `- ${item}`),
    '',
    '## Projects',
    '',
    ...report.items.slice(0, 25).map(item => [
      `- ${item.risk_level} · ${item.project_kind} · ${item.project_id}`,
      `  - jobs: ${item.job_count}, active: ${item.active_count}, terminal: ${item.terminal_count}, failed: ${item.failed_count}`,
      `  - callback_events: ${item.callback_event_count}, max_per_job: ${item.max_callback_events_per_job}, artifacts: ${item.artifact_count}`,
      item.recommendations.length
        ? `  - next: ${item.recommendations.join(' / ')}`
        : '  - next: no immediate action',
    ].join('\n')),
  ];
  return `${lines.join('\n').trim()}\n`;
}

export async function getGearsExecutionGeneratedProjectPressureReport(): Promise<GearsExecutionGeneratedProjectPressureReport> {
  const [storyRecords, seriesRecords] = await Promise.all([
    readGeneratedProjectRecords(generatedStoryProjectsRoots(), 'story_project'),
    readGeneratedProjectRecords(generatedSeriesProjectsRoots(), 'ai_comic_series_project'),
  ]);
  const items = [...storyRecords, ...seriesRecords]
    .map(buildGeneratedProjectPressureItem)
    .filter((item): item is GearsExecutionGeneratedProjectPressureItem => Boolean(item))
    .sort((a, b) => {
      const riskRank: Record<GearsExecutionGeneratedProjectPressureRisk, number> = { blocked: 0, watch: 1, ok: 2 };
      const riskDiff = riskRank[a.risk_level] - riskRank[b.risk_level];
      if (riskDiff !== 0) return riskDiff;
      return b.job_count - a.job_count;
    });

  const totalJobCount = items.reduce((sum, item) => sum + item.job_count, 0);
  const totalActiveCount = items.reduce((sum, item) => sum + item.active_count, 0);
  const totalTerminalCount = items.reduce((sum, item) => sum + item.terminal_count, 0);
  const totalFailedCount = items.reduce((sum, item) => sum + item.failed_count, 0);
  const totalCallbackEventCount = items.reduce((sum, item) => sum + item.callback_event_count, 0);
  const maxProjectJobCount = Math.max(0, ...items.map(item => item.job_count));
  const maxJobCallbackEventCount = Math.max(0, ...items.map(item => item.max_callback_events_per_job));
  const pressureStatus = items.reduce(
    (status, item) => mergeGeneratedProjectPressureStatus(status, item.risk_level),
    'ok' as GearsExecutionGeneratedProjectPressureRisk,
  );
  const recommendations = buildGeneratedProjectPressureRecommendations({
    items,
    totalFailedCount,
    maxProjectJobCount,
    maxJobCallbackEventCount,
  });

  const report: Omit<GearsExecutionGeneratedProjectPressureReport, 'markdown'> = {
    provider: 'gears',
    schema_version: 'gears-execution-generated-project-pressure/v1',
    scanned_story_project_count: storyRecords.length,
    scanned_series_project_count: seriesRecords.length,
    project_with_gears_ledger_count: items.length,
    total_job_count: totalJobCount,
    total_active_count: totalActiveCount,
    total_terminal_count: totalTerminalCount,
    total_failed_count: totalFailedCount,
    total_callback_event_count: totalCallbackEventCount,
    max_project_job_count: maxProjectJobCount,
    max_job_callback_event_count: maxJobCallbackEventCount,
    callback_batch_item_limit: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
    callback_event_retention_limit: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
    pressure_status: pressureStatus,
    items,
    recommendations,
    generated_at: new Date().toISOString(),
  };
  return {
    ...report,
    markdown: renderGeneratedProjectPressureMarkdown(report),
  };
}

export function getGearsExecutionReadinessReport(): GearsExecutionReadinessReport {
  const config = getGearsExecutionConfigInfo();
  const contract = getGearsExecutionContractInfo();
  const checks: GearsExecutionReadinessCheck[] = [
    readinessCheck({
      id: 'api_base_url',
      label: 'GEARS API base',
      status: config.api_base_url_configured ? 'pass' : 'fail',
      message: config.api_base_url_configured
        ? 'GEARS_API_BASE_URL 已配置，可执行 use_gears_api=true 的真实 HTTP submit/status smoke。'
        : 'GEARS_API_BASE_URL 未配置，当前只能执行本地合同冒烟与 mock ledger 写回。',
      next_action: config.api_base_url_configured
        ? undefined
        : '配置 GEARS_API_BASE_URL。',
    }),
    readinessCheck({
      id: 'api_token',
      label: 'GEARS API token',
      status: config.api_token_configured ? 'pass' : 'warn',
      message: config.api_token_configured
        ? 'GEARS_API_TOKEN 已配置，请求会携带 Bearer token。'
        : 'GEARS_API_TOKEN 未配置，仅适用于本地无鉴权或 mock GEARS 服务。',
      next_action: config.api_token_configured
        ? undefined
        : '若真实 GEARS worker 需要鉴权，请配置 GEARS_API_TOKEN。',
    }),
    readinessCheck({
      id: 'callback_secret',
      label: 'GEARS callback secret',
      status: config.callback_secret_configured ? 'pass' : 'warn',
      message: config.callback_secret_configured
        ? 'GEARS_CALLBACK_SECRET 已配置，worker 回调可启用共享密钥保护。'
        : 'GEARS_CALLBACK_SECRET 未配置，回调入口不会强制共享密钥。',
      next_action: config.callback_secret_configured
        ? undefined
        : '配置 GEARS_CALLBACK_SECRET 后再做公网/跨进程 webhook smoke。',
    }),
    readinessCheck({
      id: 'callback_base',
      label: 'GEARS callback base',
      status: config.callback_base_configured ? 'pass' : 'warn',
      message: config.callback_base_configured
        ? 'GEARS callback 公开基址已配置，submit payload 可带绝对 callback_url。'
        : 'GEARS callback 公开基址未配置，submit payload 只会带相对 callback_path。',
      next_action: config.callback_base_configured
        ? undefined
        : '配置 GEARS_CALLBACK_BASE_URL、PUBLIC_API_BASE_URL 或 APP_BASE_URL。',
    }),
    readinessCheck({
      id: 'callback_limits',
      label: 'GEARS callback limits',
      status: 'pass',
      message: `批量 callback 单次上限 ${config.callback_batch_item_limit}，单 job 保留最新 ${config.callback_event_retention_limit} 条 callback_events。`,
    }),
    readinessCheck({
      id: 'status_contract_alignment',
      label: 'Status/callback alias alignment',
      status: contract.poll.accepted_status_fields.join('|') === contract.callback.accepted_status_fields.join('|')
        ? 'pass'
        : 'fail',
      message: 'poll 与 callback 使用同一套平台状态别名，便于 worker 统一实现。',
    }),
  ];

  const smoke: GearsExecutionReadinessSmoke[] = [];
  const smokeUnits: GearsExecutionSubmitUnit[] = [
    {
      source_unit_id: 'readiness-shot-1',
      source_unit_label: 'Readiness accepted unit',
      source_scene_id: 1,
      local_gears_job_id: 'local-gears-seedance_video-readiness-shot-1-1',
      payload: {
        script_text: '少年站在祠堂门口。',
        seedance_prompt: '0-3秒：少年站在祠堂门口。',
      },
      payload_summary: 'readiness accepted unit',
    },
    {
      source_unit_id: 'readiness-shot-2',
      source_unit_label: 'Readiness rejected unit',
      source_scene_id: 2,
      local_gears_job_id: 'local-gears-seedance_video-readiness-shot-2-1',
      payload: {
        script_text: '少年转身奔跑。',
        seedance_prompt: '0-3秒：少年转身奔跑。',
      },
      payload_summary: 'readiness rejected unit',
    },
  ];
  const submitSmoke = normalizeGearsSubmitAdapterResults({
    units: smokeUnits,
    payload: {
      data: {
        acceptedUnits: [{
          taskId: 'gears-readiness-accepted-001',
          externalId: 'readiness-shot-1',
          taskStatus: 'QUEUED',
          idempotencyKey: 'seedance_video:readiness-shot-1',
        }],
        rejectedUnits: [{
          taskId: 'gears-readiness-rejected-002',
          externalId: 'readiness-shot-2',
          taskStatus: 'VALIDATION_ERROR',
          idempotencyKey: 'seedance_video:readiness-shot-2',
          errorCode: 'INVALID_PAYLOAD',
          message: 'seedance_prompt is required',
        }],
      },
    },
  });
  if (typeof submitSmoke === 'string') {
    smoke.push(readinessSmoke({
      id: 'submit_normalization',
      label: 'Submit normalization smoke',
      status: 'fail',
      message: submitSmoke,
    }));
  } else {
    const acceptedOk = submitSmoke.accepted.length === 1
      && submitSmoke.accepted[0]?.source_unit_id === 'readiness-shot-1';
    const rejectedOk = submitSmoke.failures.length === 1
      && submitSmoke.failures[0]?.source_unit_id === 'readiness-shot-2'
      && submitSmoke.failures[0]?.failure_category === 'payload_invalid'
      && submitSmoke.failures[0]?.error_code === 'INVALID_PAYLOAD';
    smoke.push(readinessSmoke({
      id: 'submit_normalization',
      label: 'Submit normalization smoke',
      status: acceptedOk && rejectedOk ? 'pass' : 'fail',
      message: acceptedOk && rejectedOk
        ? 'acceptedUnits/rejectedUnits 混合响应可归一化为 accepted jobs 与结构化 failures。'
        : 'acceptedUnits/rejectedUnits 混合响应归一化结果不完整。',
      details: {
        accepted_count: submitSmoke.accepted.length,
        rejected_count: submitSmoke.failures.length,
        rejected_failure_category: submitSmoke.failures[0]?.failure_category,
        rejected_error_code: submitSmoke.failures[0]?.error_code,
      },
    }));

    const acceptedLedgerItem = buildGearsLedgerItem({
      jobType: 'seedance_video',
      unit: smokeUnits[0]!,
      accepted: submitSmoke.accepted[0]!,
      submittedAt: '2026-06-21T00:00:00.000Z',
      note: 'GEARS readiness smoke',
    });
    const rejectedLedgerItem = buildRejectedGearsLedgerItem({
      jobType: 'seedance_video',
      unit: smokeUnits[1]!,
      failure: submitSmoke.failures[0]!,
      submittedAt: '2026-06-21T00:00:00.000Z',
      note: 'GEARS readiness smoke',
    });
    smoke.push(readinessSmoke({
      id: 'ledger_writeback',
      label: 'Ledger writeback smoke',
      status: acceptedLedgerItem.status === 'submitted'
        && rejectedLedgerItem.status === 'rejected'
        && rejectedLedgerItem.failure_category === 'payload_invalid'
        ? 'pass'
        : 'fail',
      message: 'submit accepted/rejected 结果可生成 GEARS Job Ledger item，包含 rejected 终态和失败上下文。',
      details: {
        accepted_status: acceptedLedgerItem.status,
        rejected_status: rejectedLedgerItem.status,
        rejected_failure_category: rejectedLedgerItem.failure_category,
      },
    }));
  }

  const callbackBatch = extractGearsJobCallbackRequests({
    data: {
      tasks: [{
        taskId: 'gears-readiness-callback-001',
        externalId: 'readiness-shot-1',
        taskStatus: 'COMPLETED',
        output: {
          files: [{
            mediaUrl: 'https://gears.example.test/readiness.mp4',
            mediaType: 'video',
          }],
        },
      }],
    },
  } as GearsJobCallbackRequest);
  const callback = normalizeGearsJobCallback(callbackBatch[0]!);
  smoke.push(readinessSmoke({
    id: 'callback_normalization',
    label: 'Callback normalization smoke',
    status: callback.status === 'ready'
      && callback.source_unit_id === 'readiness-shot-1'
      && callback.artifact_urls.includes('https://gears.example.test/readiness.mp4')
      ? 'pass'
      : 'fail',
    message: '嵌套 data.tasks[].output.files[] callback 可归一化为 ready job 和 artifact URL。',
    details: {
      extracted_count: callbackBatch.length,
      status: callback.status,
      artifact_count: callback.artifact_urls.length,
    },
  }));

  const statusAliasCallback = normalizeGearsJobCallback({
    jobId: 'gears-readiness-status-alias',
    sourceUnitId: 'readiness-shot-2',
    jobType: 'seedance_video',
    taskStatus: 'ACCESS_DENIED',
  });
  smoke.push(readinessSmoke({
    id: 'status_alias_classification',
    label: 'Status alias smoke',
    status: statusAliasCallback.status === 'failed'
      && statusAliasCallback.failure_category === 'provider_auth'
      ? 'pass'
      : 'fail',
    message: '平台状态别名可直接映射到终态和失败分类。',
    details: {
      status: statusAliasCallback.status,
      failure_category: statusAliasCallback.failure_category,
    },
  }));

  const pressureReport = getGearsExecutionPressureReport();
  smoke.push(readinessSmoke({
    id: 'pressure_boundaries',
    label: 'Large project pressure smoke',
    status: pressureReport.status === 'pass' ? 'pass' : 'fail',
    message: pressureReport.status === 'pass'
      ? '批量 callback 上限与单 job callback_events 保留边界通过本地压力冒烟。'
      : '批量 callback 或 callback_events 保留边界压力冒烟失败。',
    details: {
      callback_batch_item_limit: pressureReport.callback_batch_item_limit,
      callback_event_retention_limit: pressureReport.callback_event_retention_limit,
      extracted_at_limit_count: pressureReport.extracted_at_limit_count,
      overflow_rejected: pressureReport.overflow_rejected,
      retained_event_count: pressureReport.retained_event_count,
      dropped_event_count: pressureReport.dropped_event_count,
    },
  }));

  const liveE2E = buildGearsExecutionLiveE2EPlan(config);
  const allItems = [...checks, ...smoke];
  const score = readinessScore(allItems);
  const status: GearsExecutionReadinessReport['status'] = checks.some(item => item.status === 'fail')
    ? 'blocked'
    : allItems.some(item => item.status === 'warn')
      ? 'attention'
      : 'ready';
  const blockingCheckIds = checks.filter(item => item.status === 'fail').map(item => item.id);
  const localSmokePassedCount = smoke.filter(item => item.status === 'pass').length;
  return {
    provider: 'gears',
    schema_version: 'gears-execution-readiness/v1',
    status,
    score,
    local_smoke_passed_count: localSmokePassedCount,
    local_smoke_total_count: smoke.length,
    blocking_check_ids: blockingCheckIds,
    live_e2e: liveE2E,
    checks,
    smoke,
    next_actions: [
      ...checks.flatMap(item => item.next_action ? [item.next_action] : []),
      ...(status === 'ready'
        ? ['执行真实 GEARS v2 submit/status/callback 端到端 smoke。']
        : ['先修复 fail 项，再进入真实 GEARS v2 端到端联调。']),
    ],
    generated_at: new Date().toISOString(),
  };
}

function renderGearsExecutionSmokePackageMarkdown(
  pkg: Omit<GearsExecutionSmokePackage, 'markdown'>,
): string {
  const lines: string[] = [
    '# GEARS v2 Story Agent Smoke Handoff',
    '',
    `> schema_version: ${pkg.schema_version}`,
    `> generated_at: ${pkg.generated_at}`,
    '',
    '## Readiness',
    '',
    `- status: ${pkg.readiness_status}`,
    `- score: ${pkg.readiness_score}`,
    `- local_smoke: ${pkg.local_smoke_passed_count}/${pkg.local_smoke_total_count}`,
    `- live_e2e: ${pkg.live_ready_step_count}/${pkg.live_total_step_count}`,
    '',
    '## Prerequisites',
    '',
    ...(pkg.prerequisites.length
      ? pkg.prerequisites.map(item => `- ${item}`)
      : ['- none']),
    '',
    '## Execution Order',
    '',
    ...pkg.execution_order.map((stepId, index) => `${index + 1}. ${stepId}`),
    '',
  ];

  for (const step of pkg.steps) {
    const acceptedResponseShapes = step.accepted_response_shapes?.length
      ? step.accepted_response_shapes
      : ['none'];
    lines.push(
      `## ${step.label}`,
      '',
      `- id: ${step.id}`,
      `- method: ${step.method}`,
      `- path: ${step.path}`,
      '',
      '### Headers',
      '',
      '```json',
      JSON.stringify(step.headers, null, 2),
      '```',
      '',
    );

    if (step.request_body) {
      lines.push(
        '### Request Body',
        '',
        '```json',
        JSON.stringify(step.request_body, null, 2),
        '```',
        '',
      );
    }

    lines.push(
      '### Accepted Response Shapes',
      '',
      ...acceptedResponseShapes.map(shape => `- ${shape}`),
      '',
      '### Expected Story Agent Result',
      '',
      ...step.expected_story_agent_result.map(item => `- ${item}`),
      '',
    );
  }

  return `${lines.join('\n').trim()}\n`;
}

export function getGearsExecutionSmokePackage(): GearsExecutionSmokePackage {
  const readiness = getGearsExecutionReadinessReport();
  const contract = getGearsExecutionContractInfo();
  const submitBody = {
    schema_version: 'gears-execution-submit/v1',
    series_project_id: 'GEARS_SMOKE_SERIES_PROJECT_ID',
    source_project_id: 'GEARS_SMOKE_PROJECT_ID',
    source_story_id: 'GEARS_SMOKE_STORY_ID',
    title: 'GEARS Story Agent smoke',
    job_type: 'seedance_video',
    callback_path: '/api/projects/GEARS_SMOKE_PROJECT_ID/gears-callback',
    callback_url: '<GEARS_CALLBACK_BASE_URL>/api/projects/GEARS_SMOKE_PROJECT_ID/gears-callback',
    callback_secret_hint: 'GEARS_CALLBACK_SECRET',
    payload: {
      units: [
        {
          schema_version: 'gears-series-seedance-video-retry-payload/v1',
          source_unit_id: 'readiness-shot-1',
          external_id: 'readiness-shot-1',
          custom_id: 'readiness-shot-1',
          idempotency_key: 'seedance_video:readiness-shot-1',
          callback_url: '<GEARS_CALLBACK_BASE_URL>/api/projects/GEARS_SMOKE_PROJECT_ID/gears-callback',
          script_text: '少年站在祠堂门口。',
          seedance_prompt: '0-3秒：少年站在祠堂门口。',
          metadata: {
            job_type: 'seedance_video',
            source_unit_id: 'readiness-shot-1',
            smoke: true,
          },
        },
        {
          schema_version: 'gears-series-seedance-video-retry-payload/v1',
          source_unit_id: 'readiness-shot-2',
          external_id: 'readiness-shot-2',
          custom_id: 'readiness-shot-2',
          idempotency_key: 'seedance_video:readiness-shot-2',
          callback_url: '<GEARS_CALLBACK_BASE_URL>/api/projects/GEARS_SMOKE_PROJECT_ID/gears-callback',
          script_text: '少年转身奔跑。',
          seedance_prompt: '0-3秒：少年转身奔跑。',
          metadata: {
            job_type: 'seedance_video',
            source_unit_id: 'readiness-shot-2',
            smoke: true,
          },
        },
      ],
    },
  };
  const callbackHeaders = {
    'content-type': 'application/json',
    authorization: 'Bearer <GEARS_CALLBACK_SECRET>',
    'x-gears-callback-secret': '<GEARS_CALLBACK_SECRET>',
  };
  const smokePackage: Omit<GearsExecutionSmokePackage, 'markdown'> = {
    provider: 'gears',
    schema_version: 'gears-execution-smoke-package/v1',
    readiness_status: readiness.status,
    readiness_score: readiness.score,
    local_smoke_passed_count: readiness.local_smoke_passed_count,
    local_smoke_total_count: readiness.local_smoke_total_count,
    live_ready_step_count: readiness.live_e2e.ready_step_count,
    live_total_step_count: readiness.live_e2e.total_step_count,
    prerequisites: [
      ...readiness.live_e2e.blocked_by,
      ...(readiness.live_e2e.ready ? ['GEARS v2 worker endpoint reachable from Story Agent runtime.'] : []),
    ],
    execution_order: [
      'submit_http',
      'status_poll',
      'project_callback',
      'series_callback',
    ],
    steps: [
      {
        id: 'submit_http',
        label: 'Submit accepted/rejected GEARS units',
        method: 'POST',
        path: contract.submit.path,
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer <GEARS_API_TOKEN>',
        },
        request_body: submitBody,
        accepted_response_shapes: contract.submit.accepted_response_shapes,
        expected_story_agent_result: [
          'acceptedUnits[] becomes submitted GEARS Job Ledger items.',
          'rejectedUnits[] becomes rejected GEARS Job Ledger items with failure_category and error_code.',
          'seedance_video submit mirrors rejected units into production ledgers as failed items.',
        ],
      },
      {
        id: 'status_poll',
        label: 'Poll submitted GEARS job',
        method: 'GET',
        path: '/gears/jobs/<gears_job_id>',
        headers: {
          authorization: 'Bearer <GEARS_API_TOKEN>',
        },
        accepted_response_shapes: contract.poll.accepted_response_shapes,
        expected_story_agent_result: [
          'completed/succeeded/done statuses become ready.',
          'output.files[]/outputs[]/artifact URLs are normalized into artifacts and artifact_urls.',
          'HTTP/network failures are written as last_poll_* diagnostics without corrupting terminal state.',
        ],
      },
      {
        id: 'project_callback',
        label: 'Post single-story callback',
        method: 'POST',
        path: contract.callback.project_path,
        headers: callbackHeaders,
        request_body: {
          data: {
            task: {
              taskId: '<gears_job_id>',
              externalId: 'readiness-shot-1',
              taskStatus: 'COMPLETED',
              progressPercent: 100,
              eventId: 'gears-smoke-event-001',
              output: {
                files: [{
                  mediaUrl: 'https://gears.example.test/readiness-shot-1.mp4',
                  mediaType: 'video',
                }],
              },
            },
          },
        },
        accepted_response_shapes: contract.callback.accepted_envelope_shapes,
        expected_story_agent_result: [
          'callback updates project GEARS Job Ledger to ready.',
          'seedance_video callback writes video URL and selected version into Seedance Shot Ledger.',
          'duplicate eventId/idempotencyKey callbacks increment duplicate_count without duplicate versions.',
        ],
      },
      {
        id: 'series_callback',
        label: 'Post AI comic series callback',
        method: 'POST',
        path: contract.callback.series_path,
        headers: callbackHeaders,
        request_body: {
          callbacks: [{
            jobId: '<gears_job_id>',
            externalId: 'episode:1:shot:001',
            jobType: 'seedance_video',
            taskStatus: 'COMPLETED',
            progressPercent: 100,
            eventId: 'gears-series-smoke-event-001',
            outputUrl: 'https://gears.example.test/episode-1-shot-001.mp4',
          }],
        },
        accepted_response_shapes: contract.callback.accepted_envelope_shapes,
        expected_story_agent_result: [
          'series callback updates AI comic GEARS Job Ledger.',
          'seedance_video callback writes back to Seedance production ledger.',
          'post-production artifacts update subtitle/audio/title/final ledgers when job_type matches.',
        ],
      },
    ],
    generated_at: new Date().toISOString(),
  };
  return {
    ...smokePackage,
    markdown: renderGearsExecutionSmokePackageMarkdown(smokePackage),
  };
}

function acceptanceCheck(input: GearsExecutionAcceptanceCheck): GearsExecutionAcceptanceCheck {
  return input;
}

function acceptanceStatusFromCheckStatus(status: GearsExecutionAcceptanceCheckStatus): GearsExecutionAcceptanceStatus {
  if (status === 'blocked') return 'blocked';
  if (status === 'warn') return 'attention';
  return 'ready';
}

function mergeAcceptanceStatus(
  current: GearsExecutionAcceptanceStatus,
  next: GearsExecutionAcceptanceStatus,
): GearsExecutionAcceptanceStatus {
  if (current === 'blocked' || next === 'blocked') return 'blocked';
  if (current === 'attention' || next === 'attention') return 'attention';
  return 'ready';
}

function generatedHealthAcceptanceStatus(input: {
  totalTargetCount: number;
  readyCount: number;
  productionGapCount: number;
  interruptedCount: number;
}): GearsExecutionAcceptanceStatus {
  if (input.totalTargetCount === 0 || input.readyCount === 0) return 'blocked';
  if (input.interruptedCount > 0 || input.productionGapCount > 0) return 'attention';
  return 'ready';
}

function renderGearsExecutionAcceptanceMarkdown(
  report: Omit<GearsExecutionAcceptanceReport, 'markdown'>,
): string {
  const lines: string[] = [
    '# GEARS v2 Worker Acceptance Report',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- status: ${report.status}`,
    `- readiness: ${report.readiness_status} · ${report.readiness_score}`,
    `- local_smoke: ${report.local_smoke_passed_count}/${report.local_smoke_total_count}`,
    `- live_e2e: ${report.live_ready_step_count}/${report.live_total_step_count}`,
    `- pressure_status: ${report.pressure_status}`,
    `- generated_project_pressure_status: ${report.generated_project_pressure_status}`,
    `- generated_project_with_ledger_count: ${report.generated_project_with_ledger_count}`,
    `- generated_project_total_job_count: ${report.generated_project_total_job_count}`,
    `- generated_health_status: ${report.generated_health_status}`,
    `- generated_health_ready_count: ${report.generated_health_ready_count}`,
    `- generated_health_planned_count: ${report.generated_health_planned_count}`,
    `- generated_health_production_gap_count: ${report.generated_health_production_gap_count}`,
    `- generated_health_interrupted_count: ${report.generated_health_interrupted_count}`,
    '',
    '## Required Envs',
    '',
    ...(report.required_envs.length ? report.required_envs.map(item => `- ${item}`) : ['- none']),
    '',
    '## Blocking Checks',
    '',
    ...(report.blocking_check_ids.length ? report.blocking_check_ids.map(item => `- ${item}`) : ['- none']),
    '',
    '## Checks',
    '',
    ...report.checks.map(check => [
      `- ${check.status} · ${check.label}: ${check.message}`,
      ...(check.next_action ? [`  - next: ${check.next_action}`] : []),
    ].join('\n')),
    '',
    '## Handoff Artifacts',
    '',
    ...report.handoff_artifacts.map(item => `- ${item.method} ${item.path} · ${item.label}: ${item.purpose}`),
    '',
    '## Recommended Next Actions',
    '',
    ...report.recommended_next_actions.map(item => `- ${item}`),
  ];
  return `${lines.join('\n').trim()}\n`;
}

export async function getGearsExecutionAcceptanceReport(): Promise<GearsExecutionAcceptanceReport> {
  const config = getGearsExecutionConfigInfo();
  const readiness = getGearsExecutionReadinessReport();
  const pressure = getGearsExecutionPressureReport();
  const [generatedPressure, generatedHealth, smokePackage] = await Promise.all([
    getGearsExecutionGeneratedProjectPressureReport(),
    getStoryAgentGeneratedHealth({ limit: 50 }),
    Promise.resolve(getGearsExecutionSmokePackage()),
  ]);

  const generatedPressureStatus: GearsExecutionAcceptanceCheckStatus =
    generatedPressure.pressure_status === 'blocked'
      ? 'blocked'
      : generatedPressure.pressure_status === 'watch'
        ? 'warn'
        : 'pass';
  const generatedHealthStatus = generatedHealthAcceptanceStatus({
    totalTargetCount: generatedHealth.summary.total_target_count,
    readyCount: generatedHealth.summary.ready_count,
    productionGapCount: generatedHealth.summary.production_gap_count,
    interruptedCount: generatedHealth.summary.interrupted_count,
  });
  const generatedHealthCheckStatus: GearsExecutionAcceptanceCheckStatus =
    generatedHealthStatus === 'blocked'
      ? 'blocked'
      : generatedHealthStatus === 'attention'
        ? 'warn'
        : 'pass';

  const checks: GearsExecutionAcceptanceCheck[] = [
    acceptanceCheck({
      id: 'gears_api_config',
      label: 'GEARS API config',
      status: config.ready_for_submit ? 'pass' : 'blocked',
      message: config.ready_for_submit
        ? 'GEARS_API_BASE_URL 已配置，可以执行真实 submit/status smoke。'
        : 'GEARS_API_BASE_URL 未配置，无法执行真实 GEARS worker E2E。',
      evidence: {
        ready_for_submit: config.ready_for_submit,
        missing_submit_requirements: config.missing_submit_requirements,
      },
      next_action: config.ready_for_submit ? undefined : '配置 GEARS_API_BASE_URL。',
    }),
    acceptanceCheck({
      id: 'gears_callback_security',
      label: 'GEARS callback security',
      status: config.callback_secret_configured ? 'pass' : 'warn',
      message: config.callback_secret_configured
        ? 'GEARS_CALLBACK_SECRET 已配置，回调验收可校验共享密钥。'
        : 'GEARS_CALLBACK_SECRET 未配置，真实 worker 回调验收缺少共享密钥保护。',
      evidence: {
        callback_secret_configured: config.callback_secret_configured,
        callback_base_configured: config.callback_base_configured,
      },
      next_action: config.callback_secret_configured ? undefined : '配置 GEARS_CALLBACK_SECRET。',
    }),
    acceptanceCheck({
      id: 'local_contract_smoke',
      label: 'Local contract smoke',
      status: readiness.local_smoke_passed_count === readiness.local_smoke_total_count ? 'pass' : 'blocked',
      message: `本地合同 smoke 通过 ${readiness.local_smoke_passed_count}/${readiness.local_smoke_total_count}。`,
      evidence: {
        readiness_status: readiness.status,
        readiness_score: readiness.score,
        smoke_ids: readiness.smoke.map(item => `${item.id}:${item.status}`),
      },
      next_action: readiness.local_smoke_passed_count === readiness.local_smoke_total_count
        ? undefined
        : '修复本地 smoke fail 项后再对接真实 worker。',
    }),
    acceptanceCheck({
      id: 'live_e2e_steps',
      label: 'Live E2E steps',
      status: readiness.live_e2e.ready ? 'pass' : 'blocked',
      message: `真实 E2E 步骤 ready ${readiness.live_e2e.ready_step_count}/${readiness.live_e2e.total_step_count}。`,
      evidence: {
        blocked_by: readiness.live_e2e.blocked_by,
        steps: readiness.live_e2e.steps.map(step => `${step.id}:${step.status}`),
      },
      next_action: readiness.live_e2e.ready
        ? '执行 POST /api/system/gears-execution-live-smoke-run，设置 execute=true。'
        : '补齐 live_e2e.blocked_by 中的环境变量和 worker 端点。',
    }),
    acceptanceCheck({
      id: 'pressure_boundaries',
      label: 'Callback pressure boundaries',
      status: pressure.status === 'pass' ? 'pass' : 'blocked',
      message: `callback 批量上限 ${pressure.callback_batch_item_limit}，事件保留上限 ${pressure.callback_event_retention_limit}。`,
      evidence: {
        pressure_status: pressure.status,
        extracted_at_limit_count: pressure.extracted_at_limit_count,
        overflow_rejected: pressure.overflow_rejected,
        retained_event_count: pressure.retained_event_count,
      },
      next_action: pressure.status === 'pass' ? undefined : '修复 callback batch / event retention 边界。',
    }),
    acceptanceCheck({
      id: 'generated_project_pressure',
      label: 'Generated project ledger pressure',
      status: generatedPressureStatus,
      message: `扫描 story=${generatedPressure.scanned_story_project_count}、series=${generatedPressure.scanned_series_project_count}，GEARS ledger 项目=${generatedPressure.project_with_gears_ledger_count}，job=${generatedPressure.total_job_count}。`,
      evidence: {
        pressure_status: generatedPressure.pressure_status,
        project_with_gears_ledger_count: generatedPressure.project_with_gears_ledger_count,
        total_job_count: generatedPressure.total_job_count,
        max_project_job_count: generatedPressure.max_project_job_count,
        max_job_callback_event_count: generatedPressure.max_job_callback_event_count,
      },
      next_action: generatedPressure.pressure_status === 'ok'
        ? undefined
        : '先处理 generated pressure report 中的 watch/blocked 项目。',
    }),
    acceptanceCheck({
      id: 'story_agent_generated_health',
      label: 'Story Agent generated health',
      status: generatedHealthCheckStatus,
      message: `生成项目体检 ready=${generatedHealth.summary.ready_count}、planned=${generatedHealth.summary.planned_count}、production_gap=${generatedHealth.summary.production_gap_count}、interrupted=${generatedHealth.summary.interrupted_count}。`,
      evidence: {
        total_target_count: generatedHealth.summary.total_target_count,
        ready_count: generatedHealth.summary.ready_count,
        planned_count: generatedHealth.summary.planned_count,
        production_gap_count: generatedHealth.summary.production_gap_count,
        interrupted_count: generatedHealth.summary.interrupted_count,
        missing_current_story_count: generatedHealth.summary.missing_current_story_count,
        missing_episode_story_id_count: generatedHealth.summary.missing_episode_story_id_count,
      },
      next_action: generatedHealthStatus === 'ready'
        ? undefined
        : generatedHealthStatus === 'blocked'
          ? '先生成或修复至少一个 ready 的 Story Agent 项目，再选择 GEARS smoke target。'
          : '优先选择 ready 项目作为 GEARS smoke target；对 interrupted / production_gap 项按 generated health 报告修复。',
    }),
    acceptanceCheck({
      id: 'handoff_package',
      label: 'Worker handoff package',
      status: smokePackage.steps.length >= 4 ? 'pass' : 'blocked',
      message: `GEARS smoke handoff package 包含 ${smokePackage.steps.length} 个步骤。`,
      evidence: {
        step_ids: smokePackage.steps.map(step => step.id),
        execution_order: smokePackage.execution_order,
      },
      next_action: smokePackage.steps.length >= 4 ? undefined : '补齐 GEARS submit/status/project callback/series callback 联调步骤。',
    }),
  ];

  const acceptanceStatus = checks
    .map(check => acceptanceStatusFromCheckStatus(check.status))
    .reduce(mergeAcceptanceStatus, 'ready' as GearsExecutionAcceptanceStatus);
  const blockingCheckIds = checks.filter(check => check.status === 'blocked').map(check => check.id);
  const warningCheckIds = checks.filter(check => check.status === 'warn').map(check => check.id);
  const recommendedNextActions = [
    ...checks.flatMap(check => check.next_action ? [check.next_action] : []),
    ...(acceptanceStatus === 'ready'
      ? ['执行 live smoke execute=true，并用真实 GEARS worker 回传 status/callback 验收。']
      : ['先处理 blocked 项，再进入真实 GEARS v2 worker 端到端验收。']),
  ];

  const report: Omit<GearsExecutionAcceptanceReport, 'markdown'> = {
    provider: 'gears',
    schema_version: 'gears-execution-acceptance/v1',
    status: acceptanceStatus,
    readiness_status: readiness.status,
    readiness_score: readiness.score,
    local_smoke_passed_count: readiness.local_smoke_passed_count,
    local_smoke_total_count: readiness.local_smoke_total_count,
    live_e2e_ready: readiness.live_e2e.ready,
    live_ready_step_count: readiness.live_e2e.ready_step_count,
    live_total_step_count: readiness.live_e2e.total_step_count,
    pressure_status: pressure.status,
    generated_project_pressure_status: generatedPressure.pressure_status,
    generated_project_with_ledger_count: generatedPressure.project_with_gears_ledger_count,
    generated_project_total_job_count: generatedPressure.total_job_count,
    generated_health_status: generatedHealthStatus,
    generated_health_ready_count: generatedHealth.summary.ready_count,
    generated_health_planned_count: generatedHealth.summary.planned_count,
    generated_health_production_gap_count: generatedHealth.summary.production_gap_count,
    generated_health_interrupted_count: generatedHealth.summary.interrupted_count,
    acceptance_passed_count: checks.filter(check => check.status === 'pass').length,
    acceptance_total_count: checks.length,
    blocking_check_ids: blockingCheckIds,
    warning_check_ids: warningCheckIds,
    required_envs: [...new Set([
      ...config.missing_submit_requirements,
      ...readiness.live_e2e.blocked_by,
      ...(!config.callback_secret_configured ? ['GEARS_CALLBACK_SECRET'] : []),
    ])],
    handoff_artifacts: [
      {
        id: 'readiness',
        label: 'Readiness report',
        method: 'GET',
        path: '/api/system/gears-execution-readiness',
        purpose: '确认配置、本地 smoke 和 live E2E 阻断项。',
      },
      {
        id: 'smoke_package',
        label: 'Smoke handoff package',
        method: 'GET',
        path: '/api/system/gears-execution-smoke-package',
        purpose: '提供给 GEARS worker 的 submit/status/callback 联调包。',
      },
      {
        id: 'live_smoke',
        label: 'Live smoke run',
        method: 'POST',
        path: '/api/system/gears-execution-live-smoke-run',
        purpose: '执行真实 GEARS submit 和可选 status poll。',
      },
      {
        id: 'generated_pressure',
        label: 'Generated project pressure audit',
        method: 'GET',
        path: '/api/system/gears-execution-generated-project-pressure',
        purpose: '检查已生成项目的 GEARS ledger 压力和风险。',
      },
    ],
    checks,
    recommended_next_actions: [...new Set(recommendedNextActions)],
    generated_at: new Date().toISOString(),
  };

  return {
    ...report,
    markdown: renderGearsExecutionAcceptanceMarkdown(report),
  };
}

function renderGearsExecutionWorkerAcceptanceKitMarkdown(
  kit: Omit<GearsExecutionWorkerAcceptanceKit, 'markdown'>,
): string {
  const lines: string[] = [
    '# GEARS v2 Worker Acceptance Kit',
    '',
    `> schema_version: ${kit.schema_version}`,
    `> generated_at: ${kit.generated_at}`,
    '',
    '## Summary',
    '',
    `- acceptance_status: ${kit.acceptance_status}`,
    `- readiness_score: ${kit.readiness_score}`,
    `- local_smoke: ${kit.local_smoke_passed_count}/${kit.local_smoke_total_count}`,
    `- real_endpoint_status: ${kit.real_endpoint_readiness.status}`,
    `- ready_to_run_acceptance: ${kit.real_endpoint_readiness.ready_to_run_acceptance ? 'yes' : 'no'}`,
    '',
    '## Smoke Targets',
    '',
    `- schema_version: ${kit.smoke_targets.schema_version}`,
    `- story_project: ${kit.smoke_targets.story_project?.id ?? 'none'}`,
    `- story_id: ${kit.smoke_targets.story_project?.current_story_id ?? 'none'}`,
    `- series_project: ${kit.smoke_targets.series_project?.id ?? 'none'}`,
    `- series_ledger_seed_ready: ${kit.smoke_targets.series_project?.ledger_seed_ready ? 'yes' : 'no'}`,
    `- series_ledger_seed_job_type: ${kit.smoke_targets.series_project?.recommended_ledger_seed_job_type ?? 'none'}`,
    `- series_ledger_seed_reason: ${kit.smoke_targets.series_project?.ledger_seed_reason ?? 'none'}`,
    `- warning_count: ${kit.smoke_targets.warning_count}`,
    ...(kit.smoke_targets.warnings.length ? kit.smoke_targets.warnings.map(item => `- warning: ${item}`) : []),
    '',
    '## Real Endpoint Readiness',
    '',
    `- status: ${kit.real_endpoint_readiness.status}`,
    `- ready_to_run_acceptance: ${kit.real_endpoint_readiness.ready_to_run_acceptance ? 'yes' : 'no'}`,
    `- missing_envs: ${kit.real_endpoint_readiness.missing_envs.join(', ') || 'none'}`,
    `- configured_envs: ${kit.real_endpoint_readiness.configured_envs.join(', ') || 'none'}`,
    `- smoke_target_ready: ${kit.real_endpoint_readiness.smoke_target_ready ? 'yes' : 'no'}`,
    `- story_project_id: ${kit.real_endpoint_readiness.story_project_id ?? 'none'}`,
    `- series_project_id: ${kit.real_endpoint_readiness.series_project_id ?? 'none'}`,
    `- recommended_command: ${kit.real_endpoint_readiness.recommended_command}`,
    '',
    '### Real Endpoint Next Actions',
    '',
    ...kit.real_endpoint_readiness.next_actions.map(item => `- ${item}`),
    '',
    '### Story Project Candidates',
    '',
    ...(kit.smoke_targets.story_project_candidates.length
      ? kit.smoke_targets.story_project_candidates.map(item => `- ${item.id} · ${item.title ?? 'untitled'} · ${item.updated_at ?? 'unknown'}`)
      : ['- none']),
    '',
    '### Series Project Candidates',
    '',
    ...(kit.smoke_targets.series_project_candidates.length
      ? kit.smoke_targets.series_project_candidates.map(item => [
        `- ${item.id} · ${item.title ?? 'untitled'} · ${item.updated_at ?? 'unknown'}`,
        `seed_ready=${item.ledger_seed_ready ? 'yes' : 'no'}`,
        `seed_job=${item.recommended_ledger_seed_job_type ?? 'none'}`,
        `seed_score=${item.ledger_seed_score ?? 0}`,
        `video_retry_candidates=${item.seedance_video_retry_candidate_count ?? 0}`,
        `existing_episode_stories=${item.existing_generated_episode_story_id_count ?? 0}`,
        `postproduction_seed_jobs=${item.postproduction_seed_job_count ?? 0}`,
        `reason=${item.ledger_seed_reason ?? 'n/a'}`,
      ].join(' · '))
      : ['- none']),
    '',
    '## Env Template',
    '',
    '```bash',
    kit.env_template.trim(),
    '```',
    '',
    '## Payload Files',
    '',
    ...kit.payloads.map(payload => `- ${payload.filename} · ${payload.label}`),
    '',
    '## Shell Script',
    '',
    `- ${kit.shell_script_filename}`,
    '',
    '```bash',
    kit.shell_script.trim(),
    '```',
    '',
    '## Commands',
    '',
  ];

  for (const command of kit.commands) {
    lines.push(
      `### ${command.label}`,
      '',
      `- id: ${command.id}`,
      `- phase: ${command.phase}`,
      ...(command.payload_id ? [`- payload: ${command.payload_id}`] : []),
      '',
      '```bash',
      command.command.trim(),
      '```',
      '',
      'Expected assertions:',
      '',
      ...command.expected_assertions.map(item => `- ${item}`),
      '',
    );
  }

  lines.push(
    '## Verification Checklist',
    '',
    ...kit.verification_checklist.map(item => `- ${item}`),
  );

  return `${lines.join('\n').trim()}\n`;
}

function getWorkerRealEndpointReadiness(
  smokeTargets: GearsExecutionWorkerAcceptanceSmokeTargets,
): GearsExecutionWorkerRealEndpointReadiness {
  const requiredEnvNames = [
    'GEARS_API_BASE_URL',
    'GEARS_CALLBACK_SECRET',
    'GEARS_CALLBACK_BASE_URL',
  ];
  const configuredEnvNames = requiredEnvNames.filter(envFlag);
  const missingEnvNames = requiredEnvNames.filter(name => !envFlag(name));
  const smokeTargetReady = Boolean(smokeTargets.story_project && smokeTargets.series_project);
  const status: GearsExecutionWorkerRealEndpointReadiness['status'] = missingEnvNames.length > 0
    ? 'needs_env'
    : smokeTargetReady
      ? 'ready'
      : 'needs_smoke_target';
  return {
    status,
    ready_to_run_acceptance: status === 'ready',
    missing_envs: missingEnvNames,
    configured_envs: configuredEnvNames,
    smoke_target_ready: smokeTargetReady,
    ...(smokeTargets.story_project ? { story_project_id: smokeTargets.story_project.id } : {}),
    ...(smokeTargets.series_project ? { series_project_id: smokeTargets.series_project.id } : {}),
    recommended_command: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL=https://<real-public-gears-artifact-url> GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1 GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1 bash run-gears-worker-acceptance.sh',
    next_actions: [
      ...missingEnvNames.map(name => `Configure ${name} before running real GEARS v2 worker acceptance.`),
      ...(!smokeTargets.story_project ? ['Prepare or select a Story Agent story project smoke target.'] : []),
      ...(!smokeTargets.series_project ? ['Prepare or select an AI comic series smoke target.'] : []),
      ...(status === 'ready'
        ? ['Export run-gears-worker-acceptance.sh and run it with ledger seed plus large pressure enabled; set GEARS_SYSTEM_EXTERNAL_OUTPUT_URL only when the worker status response cannot expose a public artifact URL.']
        : ['Do not treat the GEARS v2 end-to-end acceptance slice as signed off until a real evidence directory passes signoff.']),
    ],
  };
}

function acceptanceKitPayload(
  id: string,
  label: string,
  filename: string,
  content: Record<string, unknown>,
): GearsExecutionWorkerAcceptancePayload {
  return { id, label, filename, content };
}

function payloadFileCommand(payload: GearsExecutionWorkerAcceptancePayload): string {
  return [
    `cat > ${payload.filename} <<'JSON'`,
    JSON.stringify(payload.content, null, 2),
    'JSON',
  ].join('\n');
}

function renderPayloadTemplatesCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'function envValue(name) {',
    '  const value = process.env[name]',
    '  if (typeof value !== "string") return ""',
    '  const trimmed = value.trim()',
    '  if (!trimmed || (trimmed.startsWith("<") && trimmed.endsWith(">"))) return ""',
    '  if (trimmed === "https://gears.example.test" || trimmed === "https://story-agent.example.test") return ""',
    '  return trimmed',
    '}',
    'function cleanBaseUrl(name) {',
    '  return envValue(name).replace(/\\/+$/, "")',
    '}',
    'const replacements = [',
    '  ["GEARS_SMOKE_PROJECT_ID", envValue("GEARS_SMOKE_PROJECT_ID")],',
    '  ["GEARS_SMOKE_SERIES_PROJECT_ID", envValue("GEARS_SMOKE_SERIES_PROJECT_ID")],',
    '  ["GEARS_SMOKE_STORY_ID", envValue("GEARS_SMOKE_STORY_ID") || envValue("GEARS_SMOKE_PROJECT_ID")],',
    '  ["<GEARS_CALLBACK_BASE_URL>", cleanBaseUrl("GEARS_CALLBACK_BASE_URL")],',
    '  ["<gears_job_id>", envValue("GEARS_SMOKE_JOB_ID")],',
    '  ["<GEARS_SYSTEM_EXTERNAL_OUTPUT_URL>", envValue("GEARS_SYSTEM_EXTERNAL_OUTPUT_URL")],',
    ']',
    'const files = [',
    '  "gears-submit-smoke.json",',
    '  "gears-project-callback-smoke.json",',
    '  "gears-series-callback-smoke.json",',
    '  "gears-system-external-callback-smoke.json",',
    '  "gears-live-smoke.json",',
    ']',
    'for (const filename of files) {',
    '  const filePath = path.join(dir, filename)',
    '  if (!fs.existsSync(filePath)) continue',
    '  let text = fs.readFileSync(filePath, "utf8")',
    '  for (const [token, value] of replacements) {',
    '    if (!value) continue',
    '    text = text.split(token).join(value)',
    '  }',
    '  fs.writeFileSync(filePath, text)',
    '}',
    'const systemExternalFile = path.join(dir, "gears-system-external-callback-smoke.json")',
    'const sourceFile = path.join(dir, "story-agent-system-external-output-url-source.json")',
    'function extractOutputUrl(root) {',
    '  const callbacks = Array.isArray(root?.callbacks) ? root.callbacks : []',
    '  const first = callbacks.find(item => item && typeof item === "object")',
    '  const value = first?.outputUrl || first?.output_url || first?.videoUrl || first?.video_url',
    '  return typeof value === "string" ? value.trim() : ""',
    '}',
    'function isPlaceholderUrl(value) {',
    '  return !value || value.includes("<GEARS_SYSTEM_EXTERNAL_OUTPUT_URL>") || value.startsWith("<") || value.includes("gears.example") || value.includes("story-agent.example") || value.includes("local.story-agent.invalid")',
    '}',
    'let outputUrl = ""',
    'let parseError = undefined',
    'try { outputUrl = extractOutputUrl(JSON.parse(fs.readFileSync(systemExternalFile, "utf8"))) }',
    'catch (error) { parseError = error instanceof Error ? error.message : String(error) }',
    'const configuredFromEnv = Boolean(envValue("GEARS_SYSTEM_EXTERNAL_OUTPUT_URL"))',
    'const sourceName = envValue("GEARS_SYSTEM_EXTERNAL_OUTPUT_URL_SOURCE") || (configuredFromEnv ? "env" : "placeholder")',
    'const placeholder = isPlaceholderUrl(outputUrl)',
    'const source = {',
    '  schema_version: "story-agent-system-external-output-url-source/v1",',
    '  generated_at: new Date().toISOString(),',
    '  env_var: "GEARS_SYSTEM_EXTERNAL_OUTPUT_URL",',
    '  configured_from_env: sourceName === "env",',
    '  discovered_from_worker_response: sourceName === "worker_response",',
    '  source: sourceName,',
    '  output_url: outputUrl || undefined,',
    '  placeholder,',
    '  ready_for_external_import: !placeholder && /^https?:\\/\\//.test(outputUrl),',
    '  parse_error: parseError,',
    '  note: "Final worker evidence signoff requires this to be a real external GEARS/Seedance artifact URL, not local acceptance or a sample URL.",',
    '}',
    'fs.writeFileSync(sourceFile, `${JSON.stringify(source, null, 2)}\\n`)',
    'NODE',
  ].join('\n');
}

function renderLargeProjectPressurePayloadCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    `const defaultEpisodeCount = ${GEARS_WORKER_PRESSURE_DEFAULT_EPISODE_COUNT}`,
    `const defaultShotsPerEpisode = ${GEARS_WORKER_PRESSURE_DEFAULT_SHOTS_PER_EPISODE}`,
    `const maxUnits = ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}`,
    'function envValue(name) {',
    '  const value = process.env[name]',
    '  if (typeof value !== "string") return ""',
    '  const trimmed = value.trim()',
    '  if (!trimmed || (trimmed.startsWith("<") && trimmed.endsWith(">"))) return ""',
    '  if (trimmed === "https://gears.example.test" || trimmed === "https://story-agent.example.test") return ""',
    '  return trimmed',
    '}',
    'function intEnv(name, fallback) {',
    '  const parsed = Number.parseInt(envValue(name), 10)',
    '  if (!Number.isFinite(parsed) || parsed <= 0) return fallback',
    '  return Math.min(parsed, 200)',
    '}',
    'function cleanBaseUrl(name) {',
    '  return envValue(name).replace(/\\/+$/, "")',
    '}',
    'const episodeCount = intEnv("GEARS_LARGE_PRESSURE_EPISODE_COUNT", defaultEpisodeCount)',
    'const shotsPerEpisode = intEnv("GEARS_LARGE_PRESSURE_SHOTS_PER_EPISODE", defaultShotsPerEpisode)',
    'const projectId = envValue("GEARS_SMOKE_PROJECT_ID") || "GEARS_SMOKE_PROJECT_ID"',
    'const storyId = envValue("GEARS_SMOKE_STORY_ID") || projectId',
    'const seriesProjectId = envValue("GEARS_SMOKE_SERIES_PROJECT_ID") || "GEARS_SMOKE_SERIES_PROJECT_ID"',
    'const callbackBase = cleanBaseUrl("GEARS_CALLBACK_BASE_URL") || "<GEARS_CALLBACK_BASE_URL>"',
    'const callbackPath = `/api/story-outline/ai-comic-series-projects/${seriesProjectId}/gears-callback`',
    'const callbackUrl = `${callbackBase}${callbackPath}`',
    'const units = []',
    'for (let episode = 1; episode <= episodeCount && units.length < maxUnits; episode += 1) {',
    '  for (let shot = 1; shot <= shotsPerEpisode && units.length < maxUnits; shot += 1) {',
    '    const paddedShot = String(shot).padStart(3, "0")',
    '    const sourceUnitId = `episode:${episode}:shot:${paddedShot}`',
    '    units.push({',
    '      schema_version: "gears-series-seedance-video-retry-payload/v1",',
    '      source_unit_id: sourceUnitId,',
    '      external_id: sourceUnitId,',
    '      custom_id: sourceUnitId,',
    '      idempotency_key: `seedance_video:${sourceUnitId}`,',
    '      callback_url: callbackUrl,',
    '      script_text: `第${episode}集第${shot}镜：角色完成可视动作，等待 GEARS worker 压测回传。`,',
    '      seedance_prompt: `0-3秒：第${episode}集第${shot}镜，角色进入画面。3-7秒：动作推进。7-12秒：情绪收束。`,',
    '      metadata: {',
    '        job_type: "seedance_video",',
    '        source_project_id: projectId,',
    '        source_story_id: storyId,',
    '        series_project_id: seriesProjectId,',
    '        episode_no: episode,',
    '        shot_no: shot,',
    '        pressure_unit: true,',
    '      },',
    '    })',
    '  }',
    '}',
    'const payload = {',
    '  schema_version: "gears-execution-submit/v1",',
    '  series_project_id: seriesProjectId,',
    '  source_project_id: projectId,',
    '  source_story_id: storyId,',
    '  title: `GEARS Story Agent large project pressure ${episodeCount}x${shotsPerEpisode}`,',
    '  job_type: "seedance_video",',
    '  callback_path: callbackPath,',
    '  callback_url: callbackUrl,',
    '  callback_secret_hint: "GEARS_CALLBACK_SECRET",',
    '  payload: { units },',
    '}',
    'const summary = {',
    '  schema_version: "gears-worker-large-project-pressure-summary/v1",',
    '  episode_count: episodeCount,',
    '  shots_per_episode: shotsPerEpisode,',
    '  unit_count: units.length,',
    '  max_unit_count: maxUnits,',
    `  callback_batch_item_limit: ${GEARS_CALLBACK_BATCH_ITEM_LIMIT},`,
    `  callback_event_retention_limit: ${GEARS_CALLBACK_EVENT_RETENTION_LIMIT},`,
    '  submit_payload_filename: "gears-large-project-submit-pressure.json",',
    '  generated_at: new Date().toISOString(),',
    '}',
    'fs.writeFileSync(path.join(dir, "gears-large-project-submit-pressure.json"), `${JSON.stringify(payload, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, "gears-large-project-pressure-summary.json"), `${JSON.stringify(summary, null, 2)}\\n`)',
    'NODE',
  ].join('\n');
}

function renderLargeProjectPressureResponseAuditCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const outputFilename = "gears-large-project-response-audit.json"',
    'const markdownFilename = "gears-large-project-response-audit.md"',
    'const responseFilename = "gears-large-project-submit-response.json"',
    'const payloadFilename = "gears-large-project-submit-pressure.json"',
    'const summaryFilename = "gears-large-project-pressure-summary.json"',
    'const skipFilename = "gears-large-project-pressure-skip.txt"',
    'const idFields = ["gears_job_id", "gearsJobId", "job_id", "jobId", "task_id", "taskId", "provider_job_id", "providerJobId", "id"]',
    'const sourceFields = ["source_unit_id", "sourceUnitId", "external_id", "externalId", "custom_id", "customId", "production_id", "productionId", "idempotency_key", "idempotencyKey"]',
    'const statusFields = ["status", "state", "phase", "taskStatus", "task_status", "jobStatus", "job_status", "lifecycle", "result"]',
    'const acceptedStatuses = new Set(["accepted", "submitted", "queued", "pending", "processing", "running", "ready", "succeeded", "success", "completed", "complete", "done"])',
    'const rejectedStatuses = new Set(["rejected", "blocked", "policy_blocked", "moderation_failed", "content_policy", "safety_blocked", "risk_control", "invalid_prompt", "invalid_payload", "validation_failed", "validation_error", "schema_invalid", "malformed_payload", "asset_missing", "unsupported_media", "invalid_asset"])',
    'const failedStatuses = new Set(["failed", "error", "timed_out", "timeout", "expired", "deadline_exceeded", "quota_exceeded", "no_credit", "access_denied", "token_expired", "rate_limited", "network_error", "service_unavailable", "provider_error", "render_failed", "artifact_upload_failed", "callback_delivery_failed", "output_missing", "artifact_invalid", "worker_unavailable", "canceled", "cancelled"])',
    'function readJson(filename) {',
    '  const filePath = path.join(dir, filename)',
    '  if (!fs.existsSync(filePath)) return undefined',
    '  try { return JSON.parse(fs.readFileSync(filePath, "utf8")) } catch (error) { return { __parse_error: error instanceof Error ? error.message : String(error) } }',
    '}',
    'function readText(filename) {',
    '  const filePath = path.join(dir, filename)',
    '  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : undefined',
    '}',
    'function sidecar(filename, suffix) {',
    '  const base = filename.replace(/\\.json$/, "")',
    '  return readText(`${base}-${suffix}.txt`)',
    '}',
    'function normalizeToken(value) {',
    '  return String(value || "").trim().replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\\s.-]+/g, "_").toLowerCase()',
    '}',
    'function meaningful(value) {',
    '  if (typeof value === "string") return value.trim() && !value.includes("<")',
    '  if (typeof value === "number" || typeof value === "boolean") return true',
    '  return false',
    '}',
    'function firstField(obj, fields) {',
    '  for (const field of fields) {',
    '    if (meaningful(obj?.[field])) return String(obj[field]).trim()',
    '  }',
    '  return undefined',
    '}',
    'function statusFrom(obj) { return firstField(obj, statusFields) }',
    'function workerIdFrom(obj) { return firstField(obj, idFields) }',
    'function sourceIdFrom(obj) { return firstField(obj, sourceFields) }',
    'function pathLooksLikeResult(pathParts) {',
    '  const structuralPath = pathParts.slice(1)',
    '  if (structuralPath.length === 1 && /^[0-9]+$/.test(structuralPath[0])) return true',
    '  const namedPath = structuralPath.filter(part => !/^[0-9]+$/.test(part))',
    '  const lastToken = normalizeToken(namedPath[namedPath.length - 1])',
    '  return /^(accepted|accepted_unit|accepted_units|rejected|rejected_unit|rejected_units|failed|failed_unit|failed_units|failure|failures|error|errors|job|jobs|task|tasks|unit|units|record|records|result|results)$/.test(lastToken)',
    '}',
    'function looksLikeRecord(obj, pathParts) {',
    '  return Boolean(workerIdFrom(obj) || sourceIdFrom(obj) || (pathLooksLikeResult(pathParts) && statusFrom(obj)))',
    '}',
    'function collectRecords(value, pathParts, records, seen, depth) {',
    '  if (depth > 12 || value === null || typeof value !== "object") return',
    '  if (seen.has(value)) return',
    '  seen.add(value)',
    '  if (Array.isArray(value)) {',
    '    value.forEach((item, index) => collectRecords(item, [...pathParts, String(index)], records, seen, depth + 1))',
    '    return',
    '  }',
    '  if (looksLikeRecord(value, pathParts)) records.push({ path: pathParts.join("."), obj: value })',
    '  for (const [key, child] of Object.entries(value)) collectRecords(child, [...pathParts, key], records, seen, depth + 1)',
    '}',
    'function disposition(record) {',
    '  const status = normalizeToken(statusFrom(record.obj))',
    '  const pathToken = normalizeToken(record.path)',
    '  if (pathToken.includes("rejected") || rejectedStatuses.has(status) || record.obj.rejected === true || record.obj.accepted === false) return "rejected"',
    '  if (pathToken.includes("failure") || pathToken.includes("failed") || pathToken.includes("error") || failedStatuses.has(status) || record.obj.ok === false || record.obj.success === false) return "failed"',
    '  if (pathToken.includes("accepted") || acceptedStatuses.has(status) || record.obj.accepted === true || record.obj.ok === true || record.obj.success === true) return "accepted"',
    '  return "unknown"',
    '}',
    'function pushSample(list, value, limit = 10) {',
    '  if (!value || list.includes(value) || list.length >= limit) return',
    '  list.push(value)',
    '}',
    'function requestUnitsFrom(payload) {',
    '  const units = payload?.payload?.units || payload?.units || payload?.data?.units',
    '  return Array.isArray(units) ? units : []',
    '}',
    'const pressurePayload = readJson(payloadFilename)',
    'const pressureSummary = readJson(summaryFilename)',
    'const response = readJson(responseFilename)',
    'const requestUnits = requestUnitsFrom(pressurePayload)',
    'const requestedSources = requestUnits.map(unit => sourceIdFrom(unit)).filter(Boolean)',
    'const requestedSourceSet = new Set(requestedSources)',
    'const records = []',
    'if (response && !response.__parse_error) collectRecords(response, [responseFilename], records, new Set(), 0)',
    'const unique = []',
    'const uniqueKeys = new Set()',
    'for (const record of records) {',
    '  const workerId = workerIdFrom(record.obj) || ""',
    '  const sourceId = sourceIdFrom(record.obj) || ""',
    '  const key = `${workerId}::${sourceId}`',
    '  if (!workerId && !sourceId) continue',
    '  if (uniqueKeys.has(key)) continue',
    '  uniqueKeys.add(key)',
    '  unique.push(record)',
    '}',
    'const sourceCounts = {}',
    'for (const sourceId of unique.map(record => sourceIdFrom(record.obj)).filter(Boolean)) sourceCounts[sourceId] = (sourceCounts[sourceId] || 0) + 1',
    'const duplicateSourceIds = Object.entries(sourceCounts).filter(([, count]) => count > 1).map(([sourceId]) => sourceId)',
    'const respondedSources = new Set(unique.map(record => sourceIdFrom(record.obj)).filter(Boolean))',
    'const missingRequestedSources = requestedSources.filter(sourceId => !respondedSources.has(sourceId))',
    'const unexpectedSources = [...respondedSources].filter(sourceId => !requestedSourceSet.has(sourceId))',
    'const totals = {',
    '  pressure_submitted: Boolean(response),',
    '  pressure_skipped: !response && Boolean(readText(skipFilename)),',
    '  request_unit_count: requestUnits.length || pressureSummary?.unit_count || 0,',
    '  response_record_count: unique.length,',
    '  accepted_count: 0,',
    '  rejected_count: 0,',
    '  failed_count: 0,',
    '  unknown_count: 0,',
    '  source_echo_count: 0,',
    '  missing_worker_id_count: 0,',
    '  missing_source_id_count: 0,',
    '  missing_requested_source_count: missingRequestedSources.length,',
    '  unexpected_source_count: unexpectedSources.length,',
    '  duplicate_source_id_count: duplicateSourceIds.length,',
    '  http_status: sidecar(responseFilename, "http-status") || readText("gears-large-project-submit-http-status.txt"),',
    '  curl_exit_code: sidecar(responseFilename, "curl-exit-code") || readText("gears-large-project-submit-exit-code.txt"),',
    '}',
    'for (const record of unique) {',
    '  const result = disposition(record)',
    '  if (result === "accepted") totals.accepted_count += 1',
    '  else if (result === "rejected") totals.rejected_count += 1',
    '  else if (result === "failed") totals.failed_count += 1',
    '  else totals.unknown_count += 1',
    '  const sourceId = sourceIdFrom(record.obj)',
    '  if (sourceId && requestedSourceSet.has(sourceId)) totals.source_echo_count += 1',
    '  if (!workerIdFrom(record.obj)) totals.missing_worker_id_count += 1',
    '  if (!sourceId) totals.missing_source_id_count += 1',
    '}',
    'const httpOk = typeof totals.http_status === "string" && /^2[0-9][0-9]$/.test(totals.http_status)',
    'const transportOk = totals.curl_exit_code === undefined || totals.curl_exit_code === "0"',
    'const compatibility_notes = []',
    'if (totals.pressure_skipped) compatibility_notes.push("Large project pressure submit was skipped because GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE was not 1.")',
    'if (response?.__parse_error) compatibility_notes.push("Large project pressure response is not valid JSON.")',
    'if (response && !transportOk) compatibility_notes.push("Large project pressure submit failed before receiving a usable HTTP response.")',
    'if (response && !httpOk) compatibility_notes.push("Large project pressure submit returned non-2xx HTTP status.")',
    'if (response && !totals.response_record_count) compatibility_notes.push("Large project response has no result-like records.")',
    'if (totals.request_unit_count && totals.source_echo_count < totals.request_unit_count) compatibility_notes.push("Large project response did not echo every requested source_unit_id/external_id/custom_id.")',
    'if (totals.duplicate_source_id_count) compatibility_notes.push("Large project response contains duplicate source ids after de-duplication by worker/source id.")',
    'if (totals.unknown_count) compatibility_notes.push("Large project response contains statuses that are not mapped to accepted/rejected/failed.")',
    'const recommended_actions = []',
    'if (response?.__parse_error) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return valid JSON for large project pressure submit responses.", evidence: "parse_error", sample_sources: [] })',
    'if (response && !transportOk) recommended_actions.push({ priority: "P0", owner: "GEARS v2 ops", action: "Fix GEARS worker reachability before large-project pressure sign-off.", evidence: "transport_error", sample_sources: [] })',
    'if (response && !httpOk) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return 2xx for accepted large-project pressure requests or structured rejected records for declined batches.", evidence: "http_error", sample_sources: [] })',
    'if (response && !totals.response_record_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return accepted/rejected job records for every submitted pressure unit.", evidence: "response_record_count_zero", sample_sources: [] })',
    'if (totals.request_unit_count && totals.source_echo_count < totals.request_unit_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Echo every pressure unit source id so Story Agent can reconcile large batch submits.", evidence: "source_echo_gap", sample_sources: missingRequestedSources.slice(0, 10) })',
    'if (totals.missing_worker_id_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return stable worker ids for every pressure response record.", evidence: "missing_worker_id_count", sample_sources: [] })',
    'if (totals.missing_source_id_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return source_unit_id/external_id/custom_id/idempotency_key for every pressure response record.", evidence: "missing_source_id_count", sample_sources: [] })',
    'if (totals.unexpected_source_count) recommended_actions.push({ priority: "P1", owner: "GEARS v2", action: "Do not include source ids that were not in the pressure submit payload.", evidence: "unexpected_source_count", sample_sources: unexpectedSources.slice(0, 10) })',
    'if (totals.duplicate_source_id_count) recommended_actions.push({ priority: "P1", owner: "GEARS v2", action: "Avoid duplicate source ids in large-project submit responses unless they represent distinct worker ids intentionally.", evidence: "duplicate_source_id_count", sample_sources: duplicateSourceIds.slice(0, 10) })',
    'if (totals.unknown_count) recommended_actions.push({ priority: "P1", owner: "Story Agent + GEARS v2", action: "Map large-project response statuses into accepted, rejected, or failed aliases.", evidence: "unknown_count", sample_sources: [] })',
    'const audit = {',
    '  schema_version: "gears-large-project-response-audit/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  payload_filename: payloadFilename,',
    '  summary_filename: summaryFilename,',
    '  response_filename: responseFilename,',
    '  totals,',
    '  sample_missing_requested_sources: missingRequestedSources.slice(0, 10),',
    '  sample_unexpected_sources: unexpectedSources.slice(0, 10),',
    '  sample_duplicate_source_ids: duplicateSourceIds.slice(0, 10),',
    '  compatibility_notes,',
    '  recommended_actions,',
    '}',
    'function renderMarkdown(audit) {',
    '  const lines = [',
    '    "# GEARS Large Project Response Audit",',
    '    "",',
    '    `> schema_version: ${audit.schema_version}`,',
    '    `> generated_at: ${audit.generated_at}`,',
    '    `> scanned_dir: ${audit.scanned_dir}`,',
    '    "",',
    '    "## Summary",',
    '    "",',
    '    `- pressure_submitted: ${audit.totals.pressure_submitted}` ,',
    '    `- pressure_skipped: ${audit.totals.pressure_skipped}` ,',
    '    `- request_unit_count: ${audit.totals.request_unit_count}` ,',
    '    `- response_record_count: ${audit.totals.response_record_count}` ,',
    '    `- accepted/rejected/failed/unknown: ${audit.totals.accepted_count}/${audit.totals.rejected_count}/${audit.totals.failed_count}/${audit.totals.unknown_count}` ,',
    '    `- source_echo_count: ${audit.totals.source_echo_count}` ,',
    '    `- missing_requested_source_count: ${audit.totals.missing_requested_source_count}` ,',
    '    `- duplicate_source_id_count: ${audit.totals.duplicate_source_id_count}` ,',
    '    `- unexpected_source_count: ${audit.totals.unexpected_source_count}` ,',
    '    `- http_status: ${audit.totals.http_status || "n/a"}` ,',
    '    `- curl_exit_code: ${audit.totals.curl_exit_code || "n/a"}` ,',
    '    "",',
    '    "## Compatibility Notes",',
    '    "",',
    '    ...(audit.compatibility_notes.length ? audit.compatibility_notes.map(item => `- ${item}`) : ["- none"]),',
    '    "",',
    '    "## Recommended Actions",',
    '    "",',
    '    ...(audit.recommended_actions.length ? audit.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence}; samples=${(item.sample_sources || []).join(", ") || "none"})`) : ["- none"]),',
    '    "",',
    '    "## Samples",',
    '    "",',
    '    `- missing_requested_sources: ${audit.sample_missing_requested_sources.join(", ") || "none"}` ,',
    '    `- unexpected_sources: ${audit.sample_unexpected_sources.join(", ") || "none"}` ,',
    '    `- duplicate_source_ids: ${audit.sample_duplicate_source_ids.join(", ") || "none"}` ,',
    '  ]',
    '  return `${lines.join("\\n")}\\n`',
    '}',
    'fs.writeFileSync(path.join(dir, outputFilename), `${JSON.stringify(audit, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, markdownFilename), renderMarkdown(audit))',
    'NODE',
  ].join('\n');
}

function renderStoryAgentCallbackIdPreflightCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const outputFilename = "story-agent-callback-id-preflight.json"',
    'const markdownFilename = "story-agent-callback-id-preflight.md"',
    'function envValue(name) {',
    '  const value = process.env[name]',
    '  if (typeof value !== "string") return ""',
    '  return value.trim()',
    '}',
    'function isPlaceholder(value) {',
    '  return !value || (value.startsWith("<") && value.endsWith(">")) || value === "https://gears.example.test" || value === "https://story-agent.example.test"',
    '}',
    'function checkId(field, value, regex, expectedFormat, routePath) {',
    '  const valid = !isPlaceholder(value) && regex.test(value)',
    '  const warning = valid ? undefined : {',
    '    field,',
    '    observed_value: value || "(empty)",',
    '    expected_format: expectedFormat,',
    '    route_path: routePath,',
    '    message: `${field} should match ${expectedFormat} before posting Story Agent callbacks.`,',
    '  }',
    '  return { field, value: value || undefined, expected_format: expectedFormat, route_path: routePath, valid_format: valid, warning }',
    '}',
    'const projectId = envValue("GEARS_SMOKE_PROJECT_ID")',
    'const seriesProjectId = envValue("GEARS_SMOKE_SERIES_PROJECT_ID")',
    'const checks = [',
    '  checkId("GEARS_SMOKE_PROJECT_ID", projectId, /^\\d{8}-story-[0-9a-z]+--[a-z_]+$/, "YYYYMMDD-story-{hash36}--{video_type}", `/api/projects/${projectId || "GEARS_SMOKE_PROJECT_ID"}/gears-callback`),',
    '  checkId("GEARS_SMOKE_SERIES_PROJECT_ID", seriesProjectId, /^\\d{8}-series-[0-9a-z]+$/, "YYYYMMDD-series-{hash36}", `/api/story-outline/ai-comic-series-projects/${seriesProjectId || "GEARS_SMOKE_SERIES_PROJECT_ID"}/gears-callback`),',
    ']',
    'const warnings = checks.map(item => item.warning).filter(Boolean)',
    'const audit = {',
    '  schema_version: "story-agent-callback-id-preflight/v1",',
    '  generated_at: new Date().toISOString(),',
    '  checked_envs: checks.map(({ warning, ...rest }) => rest),',
    '  warning_count: warnings.length,',
    '  warnings,',
    '  recommended_actions: warnings.length ? [{',
    '    priority: "P0",',
    '    owner: "Story Agent smoke env",',
    '    action: "Set GEARS_SMOKE_PROJECT_ID and GEARS_SMOKE_SERIES_PROJECT_ID to existing Story Agent project ids before relying on callback smoke results.",',
    '    evidence: "callback_id_format_warning",',
    '    sample_files: [outputFilename],',
    '  }] : [],',
    '}',
    'const lines = [',
    '  "# Story Agent Callback ID Preflight",',
    '  "",',
    '  `> schema_version: ${audit.schema_version}`,',
    '  `> generated_at: ${audit.generated_at}`,',
    '  "",',
    '  "## Summary",',
    '  "",',
    '  `- warning_count: ${audit.warning_count}` ,',
    '  "",',
    '  "## Checked IDs",',
    '  "",',
    '  ...audit.checked_envs.map(item => `- ${item.field}: valid_format=${item.valid_format}; expected=${item.expected_format}; route=${item.route_path}`),',
    '  "",',
    '  "## Warnings",',
    '  "",',
    '  ...(audit.warnings.length ? audit.warnings.map(item => `- ${item.field}: ${item.message} observed=${item.observed_value}`) : ["- none"]),',
    '  "",',
    '  "## Recommended Actions",',
    '  "",',
    '  ...(audit.recommended_actions.length ? audit.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence})`) : ["- none"]),',
    ']',
    'fs.writeFileSync(path.join(dir, outputFilename), `${JSON.stringify(audit, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, markdownFilename), `${lines.join("\\n").trim()}\\n`)',
    'NODE',
  ].join('\n');
}

function renderWorkerResponseAuditCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const outputFilename = "gears-worker-response-audit.json"',
    'const markdownFilename = "gears-worker-response-audit.md"',
    'const idFields = ["gears_job_id", "gearsJobId", "job_id", "jobId", "task_id", "taskId", "provider_job_id", "providerJobId", "id"]',
    'const sourceFields = ["source_unit_id", "sourceUnitId", "external_id", "externalId", "custom_id", "customId", "production_id", "productionId", "idempotency_key", "idempotencyKey"]',
    'const statusFields = ["status", "state", "phase", "taskStatus", "task_status", "jobStatus", "job_status", "lifecycle", "result"]',
    'const errorFields = ["error_code", "errorCode", "code", "failure_code", "failureCode", "provider_error_code", "providerErrorCode"]',
    'const categoryFields = ["failure_category", "failureCategory", "category", "failure_type", "failureType", "reason_code", "reasonCode"]',
    'const messageFields = ["message", "error_message", "errorMessage", "failure_reason", "failureReason", "reason", "detail", "details"]',
    'const artifactUrlFields = ["artifact_url", "artifactUrl", "video_url", "videoUrl", "output_url", "outputUrl", "media_url", "mediaUrl", "file_url", "fileUrl", "download_url", "downloadUrl", "result_url", "resultUrl", "image_url", "imageUrl", "thumbnail_url", "thumbnailUrl", "poster_url", "posterUrl", "manifest_url", "manifestUrl", "subtitle_url", "subtitleUrl", "srt_url", "srtUrl", "vtt_url", "vttUrl", "audio_url", "audioUrl"]',
    'const acceptedStatuses = new Set(["accepted", "submitted", "queued", "pending", "processing", "running", "ready", "succeeded", "success", "completed", "complete", "done"])',
    'const readyStatuses = new Set(["ready", "succeeded", "success", "completed", "complete", "done"])',
    'const rejectedStatuses = new Set(["rejected", "blocked", "policy_blocked", "moderation_failed", "content_policy", "safety_blocked", "risk_control", "invalid_prompt", "invalid_payload", "validation_failed", "validation_error", "schema_invalid", "malformed_payload", "asset_missing", "unsupported_media", "invalid_asset"])',
    'const failedStatuses = new Set(["failed", "error", "timed_out", "timeout", "expired", "deadline_exceeded", "quota_exceeded", "no_credit", "access_denied", "token_expired", "rate_limited", "network_error", "service_unavailable", "provider_error", "render_failed", "artifact_upload_failed", "callback_delivery_failed", "output_missing", "artifact_invalid", "worker_unavailable", "canceled", "cancelled"])',
    'function normalizeToken(value) {',
    '  return String(value || "").trim().replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\\s.-]+/g, "_").toLowerCase()',
    '}',
    'function meaningful(value) {',
    '  if (typeof value === "string") return value.trim() && !value.includes("<")',
    '  if (typeof value === "number" || typeof value === "boolean") return true',
    '  return false',
    '}',
    'function stringValue(value) {',
    '  if (!meaningful(value)) return undefined',
    '  return String(value).trim()',
    '}',
    'function inc(map, key) {',
    '  if (!key) return',
    '  map[key] = (map[key] || 0) + 1',
    '}',
    'function pushSample(list, value, limit = 8) {',
    '  if (!value || list.includes(value) || list.length >= limit) return',
    '  list.push(value)',
    '}',
    'function firstField(obj, fields) {',
    '  for (const field of fields) {',
    '    const value = stringValue(obj[field])',
    '    if (value) return value',
    '  }',
    '  return undefined',
    '}',
    'function nestedErrorValue(obj, fields) {',
    '  const direct = firstField(obj, fields)',
    '  if (direct) return direct',
    '  if (obj.error && typeof obj.error === "object") return firstField(obj.error, fields)',
    '  if (obj.failure && typeof obj.failure === "object") return firstField(obj.failure, fields)',
    '  return undefined',
    '}',
    'function statusFrom(obj) {',
    '  return firstField(obj, statusFields)',
    '}',
    'function errorCodeFrom(obj) {',
    '  return nestedErrorValue(obj, errorFields)',
    '}',
    'function failureCategoryFrom(obj) {',
    '  return nestedErrorValue(obj, categoryFields)',
    '}',
    'function messageFrom(obj) {',
    '  return nestedErrorValue(obj, messageFields)',
    '}',
    'function hasAnyField(obj, fields) {',
    '  return fields.some(field => meaningful(obj[field]))',
    '}',
    'function hasDirectArtifactField(obj, pathParts) {',
    '  const pathToken = normalizeToken(pathParts.join("."))',
    '  const artifactContainer = /(artifact|artifacts|output|outputs|file|files|media|asset|assets|result|results)/.test(pathToken)',
    '  for (const [key, child] of Object.entries(obj)) {',
    '    const keyToken = normalizeToken(key)',
    '    if ((artifactUrlFields.includes(key) || (keyToken === "url" && artifactContainer)) && isUrlLike(child)) return true',
    '  }',
    '  return false',
    '}',
    'function hasFailureSignal(obj) {',
    '  return Boolean(errorCodeFrom(obj)) || Boolean(failureCategoryFrom(obj)) || Boolean(messageFrom(obj))',
    '}',
    'function pathLooksLikeWorkerRecord(pathParts) {',
    '  const structuralPath = pathParts.slice(1)',
    '  if (structuralPath.length === 1 && /^[0-9]+$/.test(structuralPath[0])) return true',
    '  const namedPath = structuralPath.filter(part => !/^[0-9]+$/.test(part))',
    '  const lastToken = normalizeToken(namedPath[namedPath.length - 1])',
    '  return /^(accepted|accepted_unit|accepted_units|rejected|rejected_unit|rejected_units|failed|failed_unit|failed_units|failure|failures|error|errors|job|jobs|task|tasks|unit|units|record|records|result|results)$/.test(lastToken)',
    '}',
    'function looksLikeWorkerRecord(obj, pathParts) {',
    '  const pathLikeRecord = pathLooksLikeWorkerRecord(pathParts)',
    '  const hasRecordSignal = hasAnyField(obj, statusFields) || hasFailureSignal(obj) || hasDirectArtifactField(obj, pathParts) || obj.accepted === true || obj.accepted === false || obj.ok === true || obj.ok === false || obj.success === true || obj.success === false',
    '  return hasAnyField(obj, idFields)',
    '    || hasAnyField(obj, sourceFields)',
    '    || (pathLikeRecord && hasRecordSignal)',
    '}',
    'function collectRecords(value, pathParts, records, seen, depth) {',
    '  if (depth > 14 || value === null || typeof value !== "object") return',
    '  if (seen.has(value)) return',
    '  seen.add(value)',
    '  if (Array.isArray(value)) {',
    '    value.forEach((item, index) => collectRecords(item, [...pathParts, String(index)], records, seen, depth + 1))',
    '    return',
    '  }',
    '  if (looksLikeWorkerRecord(value, pathParts)) records.push({ path: pathParts.join("."), obj: value })',
    '  for (const [key, child] of Object.entries(value)) {',
    '    collectRecords(child, [...pathParts, key], records, seen, depth + 1)',
    '  }',
    '}',
    'function disposition(record) {',
    '  const obj = record.obj',
    '  const pathToken = normalizeToken(record.path)',
    '  const statusToken = normalizeToken(statusFrom(obj))',
    '  const errorCodeToken = normalizeToken(errorCodeFrom(obj))',
    '  const failureCategoryToken = normalizeToken(failureCategoryFrom(obj))',
    '  if (pathToken.includes("rejected") || rejectedStatuses.has(statusToken) || rejectedStatuses.has(errorCodeToken) || rejectedStatuses.has(failureCategoryToken) || obj.rejected === true || obj.accepted === false) return "rejected"',
    '  if (pathToken.includes("failure") || pathToken.includes("failed") || pathToken.includes("error") || failedStatuses.has(statusToken) || failedStatuses.has(errorCodeToken) || failedStatuses.has(failureCategoryToken) || obj.ok === false || obj.success === false) return "failed"',
    '  if (pathToken.includes("accepted") || acceptedStatuses.has(statusToken) || obj.accepted === true || obj.ok === true || obj.success === true) return "accepted"',
    '  return "unknown"',
    '}',
    'function observedFields(obj, fields) {',
    '  return fields.filter(field => meaningful(obj[field]))',
    '}',
    'function isUrlLike(value) {',
    '  return typeof value === "string" && /^(https?:\\/\\/|\\/media\\/|media\\/|s3:\\/\\/|gs:\\/\\/|oss:\\/\\/)/i.test(value.trim())',
    '}',
    'function collectArtifactEvidence(value, pathParts, evidence, seen, depth) {',
    '  if (depth > 10 || value === null || typeof value !== "object") return',
    '  if (seen.has(value)) return',
    '  seen.add(value)',
    '  if (Array.isArray(value)) {',
    '    value.forEach((item, index) => collectArtifactEvidence(item, [...pathParts, String(index)], evidence, seen, depth + 1))',
    '    return',
    '  }',
    '  const pathToken = normalizeToken(pathParts.join("."))',
    '  for (const [key, child] of Object.entries(value)) {',
    '    const keyToken = normalizeToken(key)',
    '    const artifactContainer = /(artifact|artifacts|output|outputs|file|files|media|asset|assets|result)/.test(pathToken)',
    '    if ((artifactUrlFields.includes(key) || (keyToken === "url" && artifactContainer)) && isUrlLike(child)) {',
    '      inc(evidence.artifact_field_counts, key)',
    '      if (!evidence.artifact_urls.includes(child.trim())) evidence.artifact_urls.push(child.trim())',
    '    }',
    '    collectArtifactEvidence(child, [...pathParts, key], evidence, seen, depth + 1)',
    '  }',
    '}',
    'function artifactEvidenceFrom(obj) {',
    '  const evidence = { artifact_urls: [], artifact_field_counts: {} }',
    '  collectArtifactEvidence(obj, [], evidence, new Set(), 0)',
    '  return evidence',
    '}',
    'function readSidecar(filename, suffix) {',
    '  const base = filename.replace(/\\.json$/, "")',
    '  const sidecarPath = path.join(dir, `${base}-${suffix}.txt`)',
    '  if (!fs.existsSync(sidecarPath)) return undefined',
    '  const value = fs.readFileSync(sidecarPath, "utf8").trim()',
    '  return value || undefined',
    '}',
    'function httpStatusOk(value) {',
    '  return typeof value === "string" && /^2[0-9][0-9]$/.test(value)',
    '}',
    'function curlExitOk(value) {',
    '  return value === undefined || value === "0"',
    '}',
    'function summarizeFile(filename, kind) {',
    '  const filePath = path.join(dir, filename)',
    '  const text = fs.readFileSync(filePath, "utf8")',
    '  const httpStatus = readSidecar(filename, "http-status")',
    '  const curlExitCode = readSidecar(filename, "curl-exit-code")',
    '  const summary = {',
    '    filename,',
    '    kind,',
    '    byte_length: Buffer.byteLength(text),',
    '    http_status: httpStatus,',
    '    curl_exit_code: curlExitCode,',
    '    http_ok: httpStatus ? httpStatusOk(httpStatus) : undefined,',
    '    transport_ok: curlExitOk(curlExitCode),',
    '    parse_ok: true,',
    '    record_count: 0,',
    '    accepted_count: 0,',
    '    rejected_count: 0,',
    '    failed_count: 0,',
    '    unknown_count: 0,',
    '    missing_worker_id_count: 0,',
    '    missing_source_id_count: 0,',
    '    missing_failure_context_count: 0,',
    '    ready_count: 0,',
    '    missing_ready_artifact_count: 0,',
    '    artifact_url_count: 0,',
    '    status_alias_counts: {},',
    '    error_code_counts: {},',
    '    failure_category_counts: {},',
    '    worker_id_field_counts: {},',
    '    source_id_field_counts: {},',
    '    artifact_field_counts: {},',
    '    sample_worker_ids: [],',
    '    sample_source_ids: [],',
    '    sample_artifact_urls: [],',
    '    sample_record_paths: {',
    '      missing_worker_id: [],',
    '      missing_source_id: [],',
    '      missing_failure_context: [],',
    '      ready_without_artifact: [],',
    '      unknown_status: [],',
    '    },',
    '    contract_warnings: [],',
    '  }',
    '  if (summary.transport_ok === false) summary.contract_warnings.push(`curl transport failed with exit code ${curlExitCode}`)',
    '  if (summary.http_ok === false) summary.contract_warnings.push(`worker returned non-2xx HTTP status ${httpStatus}`)',
    '  let root',
    '  try {',
    '    root = text.trim() ? JSON.parse(text) : null',
    '  } catch (error) {',
    '    summary.parse_ok = false',
    '    summary.parse_error = error instanceof Error ? error.message : String(error)',
    '    summary.contract_warnings.push("response file is not valid JSON")',
    '    return summary',
    '  }',
    '  const records = []',
    '  collectRecords(root, [filename], records, new Set(), 0)',
    '  summary.record_count = records.length',
    '  for (const record of records) {',
    '    const obj = record.obj',
    '    const status = statusFrom(obj)',
    '    const statusToken = normalizeToken(status)',
    '    if (statusToken) inc(summary.status_alias_counts, statusToken)',
    '    const errorCode = normalizeToken(errorCodeFrom(obj))',
    '    if (errorCode) inc(summary.error_code_counts, errorCode)',
    '    const failureCategory = normalizeToken(failureCategoryFrom(obj))',
    '    if (failureCategory) inc(summary.failure_category_counts, failureCategory)',
    '    const workerIdFields = observedFields(obj, idFields)',
    '    const sourceIdFields = observedFields(obj, sourceFields)',
    '    workerIdFields.forEach(field => inc(summary.worker_id_field_counts, field))',
    '    sourceIdFields.forEach(field => inc(summary.source_id_field_counts, field))',
    '    const workerId = firstField(obj, idFields)',
    '    const sourceId = firstField(obj, sourceFields)',
    '    if (workerId) pushSample(summary.sample_worker_ids, workerId)',
    '    if (sourceId) pushSample(summary.sample_source_ids, sourceId)',
    '    if (!workerId) {',
    '      summary.missing_worker_id_count += 1',
    '      pushSample(summary.sample_record_paths.missing_worker_id, record.path)',
    '    }',
    '    if (!sourceId) {',
    '      summary.missing_source_id_count += 1',
    '      pushSample(summary.sample_record_paths.missing_source_id, record.path)',
    '    }',
    '    const result = disposition(record)',
    '    if (result === "accepted") summary.accepted_count += 1',
    '    else if (result === "rejected") summary.rejected_count += 1',
    '    else if (result === "failed") summary.failed_count += 1',
    '    else {',
    '      summary.unknown_count += 1',
    '      pushSample(summary.sample_record_paths.unknown_status, record.path)',
    '    }',
    '    const artifactEvidence = artifactEvidenceFrom(obj)',
    '    summary.artifact_url_count += artifactEvidence.artifact_urls.length',
    '    mergeCounts(summary.artifact_field_counts, artifactEvidence.artifact_field_counts)',
    '    for (const url of artifactEvidence.artifact_urls) {',
    '      pushSample(summary.sample_artifact_urls, url)',
    '    }',
    '    if (readyStatuses.has(statusToken)) {',
    '      summary.ready_count += 1',
    '      if (!artifactEvidence.artifact_urls.length) {',
    '        summary.missing_ready_artifact_count += 1',
    '        pushSample(summary.sample_record_paths.ready_without_artifact, record.path)',
    '      }',
    '    }',
    '    if ((result === "rejected" || result === "failed") && !errorCode && !failureCategory && !messageFrom(obj)) {',
    '      summary.missing_failure_context_count += 1',
    '      pushSample(summary.sample_record_paths.missing_failure_context, record.path)',
    '    }',
    '  }',
    '  if (!summary.record_count) summary.contract_warnings.push("no worker result-like records found")',
    '  if (summary.record_count && summary.missing_worker_id_count) summary.contract_warnings.push("some worker records have no gears_job_id/jobId/taskId/id")',
    '  if (summary.record_count && summary.missing_source_id_count) summary.contract_warnings.push("some worker records have no source_unit_id/external_id/custom_id/idempotency_key")',
    '  if (summary.missing_failure_context_count) summary.contract_warnings.push("some failed/rejected records lack error_code/failure_category/message")',
    '  if (summary.missing_ready_artifact_count) summary.contract_warnings.push("some ready/completed records have no artifact URL")',
    '  return summary',
    '}',
    'function mergeCounts(target, source) {',
    '  for (const [key, value] of Object.entries(source || {})) target[key] = (target[key] || 0) + value',
    '}',
    'function mergeSampleRecordPaths(target, source) {',
    '  for (const [key, values] of Object.entries(source || {})) {',
    '    if (!Array.isArray(values)) continue',
    '    if (!target[key]) target[key] = []',
    '    values.forEach(value => pushSample(target[key], value))',
    '  }',
    '}',
    'const candidates = [',
    '  { filename: "gears-submit-response.json", kind: "smoke_submit" },',
    '  { filename: "gears-large-project-submit-response.json", kind: "large_project_pressure_submit" },',
    ']',
    'const dirFilenames = fs.readdirSync(dir)',
    'const statusAttemptBases = new Set()',
    'for (const filename of dirFilenames) {',
    '  const match = /^gears-status-response-(.+)-attempt-[0-9]+\\.json$/.exec(filename)',
    '  if (match) statusAttemptBases.add(match[1])',
    '}',
    'for (const filename of dirFilenames) {',
    '  const statusMatch = /^gears-status-response-(.+)\\.json$/.exec(filename)',
    '  if (!statusMatch) continue',
    '  const base = statusMatch[1]',
    '  if (statusAttemptBases.has(base) && !/-attempt-[0-9]+$/.test(base)) continue',
    '  candidates.push({ filename, kind: "status_poll" })',
    '}',
    'const files = []',
    'for (const candidate of candidates) {',
    '  const filePath = path.join(dir, candidate.filename)',
    '  if (!fs.existsSync(filePath)) continue',
    '  files.push(summarizeFile(candidate.filename, candidate.kind))',
    '}',
    'const totals = {',
    '  file_count: files.length,',
    '  parse_error_count: files.filter(file => !file.parse_ok).length,',
    '  record_count: 0,',
    '  accepted_count: 0,',
    '  rejected_count: 0,',
    '  failed_count: 0,',
    '  unknown_count: 0,',
    '  missing_worker_id_count: 0,',
    '  missing_source_id_count: 0,',
    '  missing_failure_context_count: 0,',
    '  ready_count: 0,',
    '  missing_ready_artifact_count: 0,',
    '  artifact_url_count: 0,',
    '  http_error_count: 0,',
    '  transport_error_count: 0,',
    '  status_alias_counts: {},',
    '  error_code_counts: {},',
    '  failure_category_counts: {},',
    '  worker_id_field_counts: {},',
    '  source_id_field_counts: {},',
    '  artifact_field_counts: {},',
    '  sample_record_paths: {',
    '    missing_worker_id: [],',
    '    missing_source_id: [],',
    '    missing_failure_context: [],',
    '    ready_without_artifact: [],',
    '    unknown_status: [],',
    '  },',
    '  sample_transport_files: [],',
    '}',
    'for (const file of files) {',
    '  totals.record_count += file.record_count || 0',
    '  totals.accepted_count += file.accepted_count || 0',
    '  totals.rejected_count += file.rejected_count || 0',
    '  totals.failed_count += file.failed_count || 0',
    '  totals.unknown_count += file.unknown_count || 0',
    '  totals.missing_worker_id_count += file.missing_worker_id_count || 0',
    '  totals.missing_source_id_count += file.missing_source_id_count || 0',
    '  totals.missing_failure_context_count += file.missing_failure_context_count || 0',
    '  totals.ready_count += file.ready_count || 0',
    '  totals.missing_ready_artifact_count += file.missing_ready_artifact_count || 0',
    '  totals.artifact_url_count += file.artifact_url_count || 0',
    '  if (file.http_ok === false) {',
    '    totals.http_error_count += 1',
    '    pushSample(totals.sample_transport_files, `${file.filename}:http_${file.http_status || "unknown"}`)',
    '  }',
    '  if (file.transport_ok === false) {',
    '    totals.transport_error_count += 1',
    '    pushSample(totals.sample_transport_files, `${file.filename}:curl_${file.curl_exit_code || "unknown"}`)',
    '  }',
    '  mergeCounts(totals.status_alias_counts, file.status_alias_counts)',
    '  mergeCounts(totals.error_code_counts, file.error_code_counts)',
    '  mergeCounts(totals.failure_category_counts, file.failure_category_counts)',
    '  mergeCounts(totals.worker_id_field_counts, file.worker_id_field_counts)',
    '  mergeCounts(totals.source_id_field_counts, file.source_id_field_counts)',
    '  mergeCounts(totals.artifact_field_counts, file.artifact_field_counts)',
    '  mergeSampleRecordPaths(totals.sample_record_paths, file.sample_record_paths)',
    '}',
    'const compatibility_notes = []',
    'if (!files.length) compatibility_notes.push("No GEARS worker submit/status response files were found yet.")',
    'if (files.length && !totals.record_count) compatibility_notes.push("Response files exist but no worker result-like records were found.")',
    'if (totals.parse_error_count) compatibility_notes.push("At least one response file is not valid JSON.")',
    'if (totals.transport_error_count) compatibility_notes.push("At least one worker request failed before receiving a usable HTTP response.")',
    'if (totals.http_error_count) compatibility_notes.push("At least one worker request returned a non-2xx HTTP status.")',
    'if (totals.record_count && totals.missing_worker_id_count) compatibility_notes.push("Some worker records cannot be matched by worker job id.")',
    'if (totals.record_count && totals.missing_source_id_count) compatibility_notes.push("Some worker records cannot be matched by Story Agent source/idempotency id.")',
    'if (totals.missing_failure_context_count) compatibility_notes.push("Some failed or rejected worker records need error_code, failure_category, or message for diagnosis.")',
    'if (totals.missing_ready_artifact_count) compatibility_notes.push("Some ready/completed worker records need an artifact URL or artifacts[].url for Story Agent writeback.")',
    'const recommended_actions = []',
    'if (!files.length) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Run the worker smoke so gears-submit-response.json and status response files exist.", evidence: "no_worker_response_files", sample_paths: [] })',
    'if (files.length && !totals.record_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return at least one worker result record in submit/status responses, or attach the transport failure body separately for diagnosis.", evidence: "record_count_zero", sample_paths: files.slice(0, 8).map(file => file.filename) })',
    'if (totals.parse_error_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return valid JSON for submit/status responses or save the raw non-JSON body separately.", evidence: "parse_error_count", sample_paths: files.filter(file => !file.parse_ok).slice(0, 8).map(file => file.filename) })',
    'if (totals.transport_error_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2 ops", action: "Fix GEARS_API_BASE_URL reachability, TLS, DNS, or worker availability before contract validation.", evidence: "transport_error_count", sample_paths: totals.sample_transport_files })',
    'if (totals.http_error_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return 2xx for accepted smoke requests, or include structured rejectedUnits/failures in a JSON response for non-accepted requests.", evidence: "http_error_count", sample_paths: totals.sample_transport_files })',
    'if (totals.record_count && totals.missing_worker_id_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return a stable worker id field such as gears_job_id, jobId, taskId, provider_job_id, or id on every worker record.", evidence: "missing_worker_id_count", sample_paths: totals.sample_record_paths.missing_worker_id })',
    'if (totals.record_count && totals.missing_source_id_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Echo Story Agent source matching fields such as source_unit_id, external_id, custom_id, production_id, idempotency_key, or idempotencyKey.", evidence: "missing_source_id_count", sample_paths: totals.sample_record_paths.missing_source_id })',
    'if (totals.unknown_count) recommended_actions.push({ priority: "P1", owner: "Story Agent + GEARS v2", action: "Map observed unknown statuses into accepted, rejected, failed, or ready aliases before production smoke sign-off.", evidence: "unknown_count", sample_paths: totals.sample_record_paths.unknown_status })',
    'if (totals.missing_failure_context_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return error_code, failure_category, or a human-readable message for every failed/rejected worker record.", evidence: "missing_failure_context_count", sample_paths: totals.sample_record_paths.missing_failure_context })',
    'if (totals.missing_ready_artifact_count) recommended_actions.push({ priority: "P0", owner: "GEARS v2", action: "Return artifacts[].url or a recognized *_url field for every ready/completed worker record so Story Agent can write back production artifacts.", evidence: "missing_ready_artifact_count", sample_paths: totals.sample_record_paths.ready_without_artifact })',
    'const audit = {',
    '  schema_version: "gears-worker-response-audit/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  expected_response_files: ["gears-submit-response.json", "gears-status-response-<job>.json", "gears-status-response-<job>-attempt-<n>.json", "gears-large-project-submit-response.json"],',
    '  totals,',
    '  files,',
    '  compatibility_notes,',
    '  recommended_actions,',
    '}',
    'function countsLine(map) {',
    '  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1])',
    '  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(", ") : "none"',
    '}',
    'function renderMarkdown(audit) {',
    '  const lines = [',
    '    "# GEARS Worker Response Audit",',
    '    "",',
    '    `> schema_version: ${audit.schema_version}`,',
    '    `> generated_at: ${audit.generated_at}`,',
    '    `> scanned_dir: ${audit.scanned_dir}`,',
    '    "",',
    '    "## Summary",',
    '    "",',
    '    `- files: ${audit.totals.file_count}` ,',
    '    `- records: ${audit.totals.record_count}` ,',
    '    `- accepted/rejected/failed/unknown: ${audit.totals.accepted_count}/${audit.totals.rejected_count}/${audit.totals.failed_count}/${audit.totals.unknown_count}` ,',
    '    `- ready_without_artifact: ${audit.totals.missing_ready_artifact_count}/${audit.totals.ready_count}` ,',
    '    `- artifact_url_count: ${audit.totals.artifact_url_count}` ,',
    '    `- transport_error_count: ${audit.totals.transport_error_count}` ,',
    '    `- http_error_count: ${audit.totals.http_error_count}` ,',
    '    `- missing_worker_id_count: ${audit.totals.missing_worker_id_count}` ,',
    '    `- missing_source_id_count: ${audit.totals.missing_source_id_count}` ,',
    '    `- missing_failure_context_count: ${audit.totals.missing_failure_context_count}` ,',
    '    "",',
    '    "## Observed Fields",',
    '    "",',
    '    `- status_alias_counts: ${countsLine(audit.totals.status_alias_counts)}` ,',
    '    `- error_code_counts: ${countsLine(audit.totals.error_code_counts)}` ,',
    '    `- failure_category_counts: ${countsLine(audit.totals.failure_category_counts)}` ,',
    '    `- worker_id_field_counts: ${countsLine(audit.totals.worker_id_field_counts)}` ,',
    '    `- source_id_field_counts: ${countsLine(audit.totals.source_id_field_counts)}` ,',
    '    `- artifact_field_counts: ${countsLine(audit.totals.artifact_field_counts)}` ,',
    '    "",',
    '    "## Compatibility Notes",',
    '    "",',
    '    ...(audit.compatibility_notes.length ? audit.compatibility_notes.map(item => `- ${item}`) : ["- none"]),',
    '    "",',
    '    "## Sample Record Paths",',
    '    "",',
    '    `- missing_worker_id: ${(audit.totals.sample_record_paths.missing_worker_id || []).join(", ") || "none"}` ,',
    '    `- missing_source_id: ${(audit.totals.sample_record_paths.missing_source_id || []).join(", ") || "none"}` ,',
    '    `- missing_failure_context: ${(audit.totals.sample_record_paths.missing_failure_context || []).join(", ") || "none"}` ,',
    '    `- ready_without_artifact: ${(audit.totals.sample_record_paths.ready_without_artifact || []).join(", ") || "none"}` ,',
    '    `- unknown_status: ${(audit.totals.sample_record_paths.unknown_status || []).join(", ") || "none"}` ,',
    '    `- transport_files: ${(audit.totals.sample_transport_files || []).join(", ") || "none"}` ,',
    '    "",',
    '    "## Recommended Actions",',
    '    "",',
    '    ...(audit.recommended_actions.length ? audit.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence}; samples=${(item.sample_paths || []).join(", ") || "none"})`) : ["- none"]),',
    '    "",',
    '    "## Files",',
    '    "",',
    '    ...(audit.files.length ? audit.files.map(file => `- ${file.filename}: http=${file.http_status || "n/a"}, curl=${file.curl_exit_code || "n/a"}, records=${file.record_count}, ready_without_artifact=${file.missing_ready_artifact_count}/${file.ready_count}, warnings=${file.contract_warnings.length}`) : ["- none"]),',
    '  ]',
    '  return `${lines.join("\\n").trim()}\\n`',
    '}',
    'fs.writeFileSync(path.join(dir, outputFilename), `${JSON.stringify(audit, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, markdownFilename), renderMarkdown(audit))',
    'NODE',
  ].join('\n');
}

function renderStoryAgentCallbackResponseAuditCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const outputFilename = "story-agent-callback-response-audit.json"',
    'const markdownFilename = "story-agent-callback-response-audit.md"',
    'const responseFiles = [',
    '  { filename: "story-agent-project-callback-response.json", kind: "project_callback" },',
    '  { filename: "story-agent-project-callback-replay-response.json", kind: "project_callback_replay" },',
    '  { filename: "story-agent-system-external-callback-preflight-response.json", kind: "system_external_callback_preflight" },',
    '  { filename: "story-agent-system-external-callback-import-response.json", kind: "system_external_callback_import" },',
    '  { filename: "story-agent-series-callback-response.json", kind: "series_callback" },',
    '  { filename: "story-agent-series-callback-replay-response.json", kind: "series_callback_replay" },',
    '  { filename: "story-agent-live-smoke-response.json", kind: "live_smoke" },',
    ']',
    'function numberValue(value) {',
    '  return typeof value === "number" && Number.isFinite(value) ? value : 0',
    '}',
    'function firstString(...values) {',
    '  for (const value of values) {',
    '    if (typeof value === "string" && value.trim()) return value.trim()',
    '  }',
    '  return undefined',
    '}',
    'function samplePush(list, value, limit = 8) {',
    '  if (!value || list.includes(value) || list.length >= limit) return',
    '  list.push(value)',
    '}',
    'function responseBody(root) {',
    '  return root && typeof root === "object" && root.data && typeof root.data === "object" ? root.data : root',
    '}',
    'function readSidecar(filename, suffix) {',
    '  const base = filename.replace(/\\.json$/, "")',
    '  const sidecarPath = path.join(dir, `${base}-${suffix}.txt`)',
    '  if (!fs.existsSync(sidecarPath)) return undefined',
    '  const value = fs.readFileSync(sidecarPath, "utf8").trim()',
    '  return value || undefined',
    '}',
    'function httpStatusOk(value) {',
    '  return typeof value === "string" && /^2[0-9][0-9]$/.test(value)',
    '}',
    'function curlExitOk(value) {',
    '  return value === undefined || value === "0"',
    '}',
    'function summarize(filename, kind) {',
    '  const filePath = path.join(dir, filename)',
    '  const text = fs.readFileSync(filePath, "utf8")',
    '  const httpStatus = readSidecar(filename, "http-status")',
    '  const curlExitCode = readSidecar(filename, "curl-exit-code")',
    '  const summary = {',
    '    filename,',
    '    kind,',
    '    byte_length: Buffer.byteLength(text),',
    '    http_status: httpStatus,',
    '    curl_exit_code: curlExitCode,',
    '    http_ok: httpStatus ? httpStatusOk(httpStatus) : undefined,',
    '    transport_ok: curlExitOk(curlExitCode),',
    '    parse_ok: true,',
    '    ok: undefined,',
    '    status: undefined,',
    '    blocked: false,',
    '    received_count: 0,',
    '    updated_count: 0,',
    '    failed_count: 0,',
    '    duplicate_count: 0,',
    '    ledger_match_missing_count: 0,',
    '    error_code: undefined,',
    '    error_message: undefined,',
    '    sample_failure_paths: [],',
    '    contract_warnings: [],',
    '  }',
    '  if (summary.transport_ok === false) summary.contract_warnings.push(`curl transport failed with exit code ${curlExitCode}`)',
    '  if (summary.http_ok === false) summary.contract_warnings.push(`Story Agent returned non-2xx HTTP status ${httpStatus}`)',
    '  let root',
    '  try {',
    '    root = text.trim() ? JSON.parse(text) : null',
    '  } catch (error) {',
    '    summary.parse_ok = false',
    '    summary.parse_error = error instanceof Error ? error.message : String(error)',
    '    summary.contract_warnings.push("response file is not valid JSON")',
    '    return summary',
    '  }',
    '  if (root && typeof root === "object" && typeof root.ok === "boolean") summary.ok = root.ok',
    '  const body = responseBody(root)',
    '  summary.status = firstString(body?.status, root?.status)',
    '  summary.blocked = Boolean(body?.blocked ?? root?.blocked)',
    '  summary.received_count = numberValue(body?.received_count ?? body?.receivedCount ?? root?.received_count)',
    '  summary.updated_count = numberValue(body?.updated_count ?? body?.updatedCount ?? root?.updated_count)',
    '  summary.failed_count = numberValue(body?.failed_count ?? body?.failedCount ?? root?.failed_count)',
    '  summary.duplicate_count = numberValue(body?.duplicate_count ?? body?.duplicateCount ?? root?.duplicate_count)',
    '  summary.error_code = firstString(root?.error?.code, body?.error?.code, body?.code, root?.code)',
    '  summary.error_message = firstString(root?.error?.message, body?.error?.message, body?.message, root?.message)',
    '  const failureItems = Array.isArray(body?.failures) ? body.failures : []',
    '  failureItems.forEach((item, index) => {',
    '    const failurePath = firstString(item?.path, item?.source_unit_id, item?.gears_job_id) || `failures[${index}]`',
    '    samplePush(summary.sample_failure_paths, failurePath)',
    '    const failureMessage = String(item?.message || item?.error || "").toLowerCase()',
    '    if (failureMessage.includes("not found in project ledger") || failureMessage.includes("not found in series ledger") || failureMessage.includes("source_unit_id") && failureMessage.includes("not found")) summary.ledger_match_missing_count += 1',
    '  })',
    '  if (summary.ok === false) summary.contract_warnings.push("Story Agent response ok=false")',
    '  if (summary.blocked) summary.contract_warnings.push("Story Agent response reports blocked=true")',
    '  if (summary.failed_count > 0) summary.contract_warnings.push("Story Agent response reports failed callback items")',
    '  return summary',
    '}',
    'const files = []',
    'for (const candidate of responseFiles) {',
    '  if (!fs.existsSync(path.join(dir, candidate.filename))) continue',
    '  files.push(summarize(candidate.filename, candidate.kind))',
    '}',
    'const totals = {',
    '  file_count: files.length,',
    '  parse_error_count: files.filter(file => !file.parse_ok).length,',
    '  ok_true_count: files.filter(file => file.ok === true).length,',
    '  ok_false_count: files.filter(file => file.ok === false).length,',
    '  received_count: 0,',
    '  updated_count: 0,',
    '  failed_count: 0,',
    '  duplicate_count: 0,',
    '  ledger_match_missing_count: 0,',
    '  validation_error_count: 0,',
    '  auth_error_count: 0,',
    '  not_found_count: 0,',
    '  blocked_count: 0,',
    '  http_error_count: 0,',
    '  transport_error_count: 0,',
    '  sample_error_files: [],',
    '  sample_not_found_files: [],',
    '  sample_blocked_files: [],',
    '  sample_ledger_match_files: [],',
    '  sample_failure_paths: [],',
    '  sample_transport_files: [],',
    '}',
    'for (const file of files) {',
    '  totals.received_count += file.received_count || 0',
    '  totals.updated_count += file.updated_count || 0',
    '  totals.failed_count += file.failed_count || 0',
    '  totals.duplicate_count += file.duplicate_count || 0',
    '  totals.ledger_match_missing_count += file.ledger_match_missing_count || 0',
    '  if (file.http_ok === false) {',
    '    totals.http_error_count += 1',
    '    samplePush(totals.sample_transport_files, `${file.filename}:http_${file.http_status || "unknown"}`)',
    '  }',
    '  if (file.transport_ok === false) {',
    '    totals.transport_error_count += 1',
    '    samplePush(totals.sample_transport_files, `${file.filename}:curl_${file.curl_exit_code || "unknown"}`)',
    '  }',
    '  const errorCode = String(file.error_code || "").toLowerCase()',
    '  const errorMessage = String(file.error_message || "").toLowerCase()',
    '  const httpStatus = String(file.http_status || "")',
    '  const status = String(file.status || "").toLowerCase()',
    '  if (errorCode.includes("validation") || errorMessage.includes("validation") || errorMessage.includes("projectid must match") || errorMessage.includes("seriesprojectid must match") || httpStatus === "400" || httpStatus === "422") totals.validation_error_count += 1',
    '  if (errorCode.includes("auth") || errorCode.includes("unauthorized") || errorMessage.includes("unauthorized") || errorMessage.includes("forbidden") || errorMessage.includes("secret") || httpStatus === "401" || httpStatus === "403") totals.auth_error_count += 1',
    '  const isNotFound = errorCode.includes("not_found") || errorCode.includes("notfound") || errorMessage.includes("not found") || errorMessage.includes("project not found") || errorMessage.includes("不存在") || errorMessage.includes("未找到") || httpStatus === "404"',
    '  if (isNotFound) {',
    '    totals.not_found_count += 1',
    '    samplePush(totals.sample_not_found_files, file.filename)',
    '  }',
    '  if (status === "blocked" || file.blocked) {',
    '    totals.blocked_count += 1',
    '    samplePush(totals.sample_blocked_files, file.filename)',
    '  }',
    '  if (file.ok === false || file.error_code || file.error_message || file.failed_count > 0) samplePush(totals.sample_error_files, file.filename)',
    '  if (file.ledger_match_missing_count > 0) samplePush(totals.sample_ledger_match_files, file.filename)',
    '  ;(file.sample_failure_paths || []).forEach(item => samplePush(totals.sample_failure_paths, `${file.filename}:${item}`))',
    '}',
    'const compatibility_notes = []',
    'if (!files.length) compatibility_notes.push("No Story Agent callback/live-smoke response files were found yet.")',
    'if (totals.parse_error_count) compatibility_notes.push("At least one Story Agent response file is not valid JSON.")',
    'if (totals.transport_error_count) compatibility_notes.push("At least one Story Agent callback/live-smoke request failed before receiving a usable HTTP response.")',
    'if (totals.http_error_count) compatibility_notes.push("At least one Story Agent callback/live-smoke request returned a non-2xx HTTP status.")',
    'if (totals.ok_false_count) compatibility_notes.push("Some Story Agent callback responses returned ok=false.")',
    'if (totals.validation_error_count) compatibility_notes.push("Some Story Agent callback responses failed route or payload validation.")',
    'if (totals.auth_error_count) compatibility_notes.push("Some Story Agent callback responses failed callback auth.")',
    'if (totals.not_found_count) compatibility_notes.push("Some Story Agent callback responses could not find the target project or series.")',
    'if (totals.blocked_count) compatibility_notes.push("Some Story Agent live-smoke responses were blocked by missing runtime configuration.")',
    'if (totals.ledger_match_missing_count) compatibility_notes.push("Some Story Agent callbacks reached a project but could not match source_unit_id/gears_job_id to its GEARS Job Ledger.")',
    'if (totals.failed_count) compatibility_notes.push("Some Story Agent callback responses reported failed items.")',
    'const recommended_actions = []',
    'if (!files.length) recommended_actions.push({ priority: "P0", owner: "Story Agent", action: "Run project/series callback smoke after worker submit/status succeeds.", evidence: "no_story_agent_callback_files", sample_files: [] })',
    'if (totals.parse_error_count) recommended_actions.push({ priority: "P0", owner: "Story Agent", action: "Return valid JSON for callback/live-smoke responses.", evidence: "parse_error_count", sample_files: files.filter(file => !file.parse_ok).slice(0, 8).map(file => file.filename) })',
    'if (totals.transport_error_count) recommended_actions.push({ priority: "P0", owner: "Story Agent ops", action: "Fix STORY_AGENT_BASE_URL reachability before trusting callback smoke results.", evidence: "transport_error_count", sample_files: totals.sample_transport_files })',
    'const uncategorizedHttpErrorCount = Math.max(0, totals.http_error_count - totals.validation_error_count - totals.auth_error_count - totals.not_found_count)',
    'if (uncategorizedHttpErrorCount) recommended_actions.push({ priority: "P0", owner: "Story Agent", action: "Inspect non-2xx callback/live-smoke responses and repair route ids, auth, or callback payload shape.", evidence: "http_error_count", sample_files: totals.sample_transport_files })',
    'if (totals.validation_error_count) recommended_actions.push({ priority: "P0", owner: "Story Agent smoke env", action: "Use real GEARS_SMOKE_PROJECT_ID and GEARS_SMOKE_SERIES_PROJECT_ID values that match Story Agent route id formats.", evidence: "validation_error_count", sample_files: totals.sample_error_files })',
    'if (totals.auth_error_count) recommended_actions.push({ priority: "P0", owner: "Story Agent smoke env", action: "Align GEARS_CALLBACK_SECRET with Story Agent callback auth before replaying callbacks.", evidence: "auth_error_count", sample_files: totals.sample_error_files })',
    'if (totals.not_found_count) recommended_actions.push({ priority: "P0", owner: "Story Agent smoke env", action: "Use existing Story Agent project/series ids for GEARS_SMOKE_PROJECT_ID and GEARS_SMOKE_SERIES_PROJECT_ID before trusting callback smoke.", evidence: "not_found_count", sample_files: totals.sample_not_found_files })',
    'if (totals.blocked_count) recommended_actions.push({ priority: "P0", owner: "Story Agent smoke env", action: "Start Story Agent with GEARS_API_BASE_URL and GEARS_CALLBACK_BASE_URL or PUBLIC_API_BASE_URL when using the live-smoke endpoint with execute=true.", evidence: "blocked_count", sample_files: totals.sample_blocked_files })',
    'if (totals.ledger_match_missing_count) recommended_actions.push({ priority: "P0", owner: "Story Agent + GEARS v2", action: "Create the Story Agent GEARS Job Ledger through the Story Agent submit path before callback smoke, or make callback source_unit_id/gears_job_id match an existing ledger item.", evidence: "ledger_match_missing_count", sample_files: totals.sample_ledger_match_files, sample_paths: totals.sample_failure_paths })',
    'if (totals.ok_false_count && !totals.validation_error_count && !totals.auth_error_count && !totals.not_found_count) recommended_actions.push({ priority: "P0", owner: "Story Agent", action: "Inspect ok=false callback responses and repair the callback contract or smoke payload.", evidence: "ok_false_count", sample_files: totals.sample_error_files })',
    'if (totals.failed_count && totals.sample_failure_paths.length && !totals.ledger_match_missing_count) recommended_actions.push({ priority: "P0", owner: "Story Agent + GEARS v2", action: "Inspect callback failures[] paths and repair source/job matching or artifact payload shape.", evidence: "failed_count", sample_files: totals.sample_error_files, sample_paths: totals.sample_failure_paths })',
    'const audit = {',
    '  schema_version: "story-agent-callback-response-audit/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  expected_response_files: responseFiles.map(item => item.filename),',
    '  totals,',
    '  files,',
    '  compatibility_notes,',
    '  recommended_actions,',
    '}',
    'function renderMarkdown(audit) {',
    '  const lines = [',
    '    "# Story Agent Callback Response Audit",',
    '    "",',
    '    `> schema_version: ${audit.schema_version}`,',
    '    `> generated_at: ${audit.generated_at}`,',
    '    `> scanned_dir: ${audit.scanned_dir}`,',
    '    "",',
    '    "## Summary",',
    '    "",',
    '    `- files: ${audit.totals.file_count}` ,',
    '    `- ok_true/ok_false: ${audit.totals.ok_true_count}/${audit.totals.ok_false_count}` ,',
    '    `- received/updated/failed/duplicate: ${audit.totals.received_count}/${audit.totals.updated_count}/${audit.totals.failed_count}/${audit.totals.duplicate_count}` ,',
    '    `- ledger_match_missing_count: ${audit.totals.ledger_match_missing_count}` ,',
    '    `- transport_error_count: ${audit.totals.transport_error_count}` ,',
    '    `- http_error_count: ${audit.totals.http_error_count}` ,',
    '    `- validation_error_count: ${audit.totals.validation_error_count}` ,',
    '    `- auth_error_count: ${audit.totals.auth_error_count}` ,',
    '    `- not_found_count: ${audit.totals.not_found_count}` ,',
    '    `- blocked_count: ${audit.totals.blocked_count}` ,',
    '    `- sample_error_files: ${audit.totals.sample_error_files.join(", ") || "none"}` ,',
    '    `- sample_not_found_files: ${audit.totals.sample_not_found_files.join(", ") || "none"}` ,',
    '    `- sample_blocked_files: ${audit.totals.sample_blocked_files.join(", ") || "none"}` ,',
    '    `- sample_ledger_match_files: ${audit.totals.sample_ledger_match_files.join(", ") || "none"}` ,',
    '    `- sample_failure_paths: ${audit.totals.sample_failure_paths.join(", ") || "none"}` ,',
    '    `- sample_transport_files: ${audit.totals.sample_transport_files.join(", ") || "none"}` ,',
    '    "",',
    '    "## Compatibility Notes",',
    '    "",',
    '    ...(audit.compatibility_notes.length ? audit.compatibility_notes.map(item => `- ${item}`) : ["- none"]),',
    '    "",',
    '    "## Recommended Actions",',
    '    "",',
    '    ...(audit.recommended_actions.length ? audit.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence}; samples=${(item.sample_files || []).join(", ") || "none"})`) : ["- none"]),',
    '    "",',
    '    "## Files",',
    '    "",',
    '    ...(audit.files.length ? audit.files.map(file => `- ${file.filename}: http=${file.http_status || "n/a"}, curl=${file.curl_exit_code || "n/a"}, ok=${file.ok}, received=${file.received_count}, updated=${file.updated_count}, failed=${file.failed_count}, duplicate=${file.duplicate_count}, warnings=${file.contract_warnings.length}`) : ["- none"]),',
    '  ]',
    '  return `${lines.join("\\n").trim()}\\n`',
    '}',
    'fs.writeFileSync(path.join(dir, outputFilename), `${JSON.stringify(audit, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, markdownFilename), renderMarkdown(audit))',
    'NODE',
  ].join('\n');
}

function renderStoryAgentGeneratedHealthAuditCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const beforeFilename = "story-agent-generated-health-before.json"',
    'const afterFilename = "story-agent-generated-health-after.json"',
    'const outputFilename = "story-agent-generated-health-audit.json"',
    'const markdownFilename = "story-agent-generated-health-audit.md"',
    'function filePath(filename) { return path.join(dir, filename) }',
    'function exists(filename) { return fs.existsSync(filePath(filename)) }',
    'function readJson(filename) {',
    '  if (!exists(filename)) return undefined',
    '  try { return JSON.parse(fs.readFileSync(filePath(filename), "utf8")) }',
    '  catch (error) { return { __parse_error: error instanceof Error ? error.message : String(error) } }',
    '}',
    'function numberValue(value) {',
    '  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN',
    '  return Number.isFinite(parsed) ? parsed : 0',
    '}',
    'function reportOf(root) {',
    '  if (!root || root.__parse_error) return undefined',
    '  if (root.data && typeof root.data === "object" && root.data.schema_version) return root.data',
    '  return root',
    '}',
    'function summaryOf(report) {',
    '  const summary = report?.summary && typeof report.summary === "object" ? report.summary : {}',
    '  return {',
    '    scanned_story_project_count: numberValue(summary.scanned_story_project_count),',
    '    scanned_series_project_count: numberValue(summary.scanned_series_project_count),',
    '    total_target_count: numberValue(summary.total_target_count),',
    '    ready_count: numberValue(summary.ready_count),',
    '    planned_count: numberValue(summary.planned_count),',
    '    production_gap_count: numberValue(summary.production_gap_count),',
    '    interrupted_count: numberValue(summary.interrupted_count),',
    '    missing_current_story_count: numberValue(summary.missing_current_story_count),',
    '    missing_scene_breakdown_count: numberValue(summary.missing_scene_breakdown_count),',
    '    missing_gears_segments_count: numberValue(summary.missing_gears_segments_count),',
    '    missing_quality_count: numberValue(summary.missing_quality_count),',
    '    missing_episode_story_id_count: numberValue(summary.missing_episode_story_id_count),',
    '    series_missing_delivery_count: numberValue(summary.series_missing_delivery_count),',
    '    series_missing_postproduction_count: numberValue(summary.series_missing_postproduction_count),',
    '  }',
    '}',
    'function snapshot(filename) {',
    '  const root = readJson(filename)',
    '  if (!root) return { filename, exists: false, parse_ok: false }',
    '  if (root.__parse_error) return { filename, exists: true, parse_ok: false, parse_error: root.__parse_error }',
    '  const report = reportOf(root)',
    '  return {',
    '    filename,',
    '    exists: true,',
    '    parse_ok: true,',
    '    ok: root.ok,',
    '    schema_version: report?.schema_version || root.schema_version,',
    '    generated_at: report?.generated_at || root.generated_at,',
    '    item_count: Array.isArray(report?.items) ? report.items.length : 0,',
    '    summary: summaryOf(report),',
    '  }',
    '}',
    'function delta(after, before, key) { return numberValue(after?.summary?.[key]) - numberValue(before?.summary?.[key]) }',
    'function action(priority, owner, text, evidence, sampleFiles = []) {',
    '  return { priority, owner, action: text, evidence, sample_files: sampleFiles }',
    '}',
    'const before = snapshot(beforeFilename)',
    'const after = snapshot(afterFilename)',
    'const deltas = {',
    '  total_target_count: delta(after, before, "total_target_count"),',
    '  ready_count: delta(after, before, "ready_count"),',
    '  planned_count: delta(after, before, "planned_count"),',
    '  production_gap_count: delta(after, before, "production_gap_count"),',
    '  interrupted_count: delta(after, before, "interrupted_count"),',
    '  missing_current_story_count: delta(after, before, "missing_current_story_count"),',
    '  missing_episode_story_id_count: delta(after, before, "missing_episode_story_id_count"),',
    '  series_missing_delivery_count: delta(after, before, "series_missing_delivery_count"),',
    '}',
    'const compatibility_notes = []',
    'const recommended_actions = []',
    'if (!before.exists) recommended_actions.push(action("P0", "Story Agent smoke env", "Fetch Story Agent generated health before worker submit.", "missing_generated_health_before", [beforeFilename]))',
    'if (before.exists && !before.parse_ok) recommended_actions.push(action("P0", "Story Agent", "Regenerate valid JSON for pre-smoke generated health audit.", "generated_health_before_parse_error", [beforeFilename]))',
    'if (!after.exists) recommended_actions.push(action("P0", "Story Agent smoke env", "Fetch Story Agent generated health after worker smoke before signing off.", "missing_generated_health_after", [afterFilename]))',
    'if (after.exists && !after.parse_ok) recommended_actions.push(action("P0", "Story Agent", "Regenerate valid JSON for post-smoke generated health audit.", "generated_health_after_parse_error", [afterFilename]))',
    'if (before.parse_ok && before.summary.total_target_count < 1) recommended_actions.push(action("P0", "Story Agent", "Create or restore at least one generated Story Agent project before GEARS worker smoke.", "generated_health_no_targets", [beforeFilename]))',
    'if (before.parse_ok && before.summary.ready_count < 1) recommended_actions.push(action("P0", "Story Agent", "Repair or regenerate a ready Story Agent project before selecting GEARS smoke targets.", "generated_health_no_ready_target", [beforeFilename]))',
    'if (after.parse_ok && after.summary.ready_count < 1) recommended_actions.push(action("P0", "Story Agent", "Post-smoke generated health has no ready target; repair Story Agent project state before handoff.", "post_smoke_no_ready_target", [afterFilename]))',
    'if (before.parse_ok && after.parse_ok && deltas.ready_count < 0) recommended_actions.push(action("P0", "Story Agent", "Generated health ready_count decreased during smoke; inspect project writes before signing off.", "generated_health_ready_regressed", [beforeFilename, afterFilename]))',
    'if (before.parse_ok && after.parse_ok && deltas.interrupted_count > 0) recommended_actions.push(action("P0", "Story Agent", "Generated health interrupted_count increased during smoke; inspect project/version references before signing off.", "generated_health_interrupted_regressed", [beforeFilename, afterFilename]))',
    'if (before.parse_ok && after.parse_ok && deltas.production_gap_count > 0) recommended_actions.push(action("P1", "Story Agent", "Generated health production_gap_count increased during smoke; inspect delivery contracts before larger rollout.", "generated_health_production_gap_regressed", [beforeFilename, afterFilename]))',
    'if (before.parse_ok && after.parse_ok && deltas.total_target_count < 0) recommended_actions.push(action("P1", "Story Agent", "Generated health target count decreased during smoke; confirm no generated project was deleted unexpectedly.", "generated_health_target_count_decreased", [beforeFilename, afterFilename]))',
    'if (before.parse_ok && before.summary.interrupted_count > 0) compatibility_notes.push("Historical generated directories still contain interrupted targets; this is acceptable only when smoke target selection uses a ready project.")',
    'if (before.parse_ok && before.summary.ready_count > 0) compatibility_notes.push("At least one ready generated project exists for GEARS smoke target selection.")',
    'if (before.parse_ok && after.parse_ok && !recommended_actions.length) compatibility_notes.push("Generated health did not regress across the worker smoke run.")',
    'const status = recommended_actions.length ? "failed" : "passed"',
    'const audit = {',
    '  schema_version: "story-agent-generated-health-audit/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  status,',
    '  before,',
    '  after,',
    '  deltas,',
    '  compatibility_notes,',
    '  recommended_actions,',
    '}',
    'const lines = [',
    '  "# Story Agent Generated Health Smoke Audit",',
    '  "",',
    '  `> schema_version: ${audit.schema_version}`,',
    '  `> generated_at: ${audit.generated_at}`,',
    '  `> scanned_dir: ${audit.scanned_dir}`,',
    '  "",',
    '  "## Summary",',
    '  "",',
    '  `- status: ${audit.status}` ,',
    '  `- before_ready/interrupted/production_gap: ${audit.before.summary?.ready_count ?? "n/a"}/${audit.before.summary?.interrupted_count ?? "n/a"}/${audit.before.summary?.production_gap_count ?? "n/a"}` ,',
    '  `- after_ready/interrupted/production_gap: ${audit.after.summary?.ready_count ?? "n/a"}/${audit.after.summary?.interrupted_count ?? "n/a"}/${audit.after.summary?.production_gap_count ?? "n/a"}` ,',
    '  `- ready_count_delta: ${audit.deltas.ready_count}` ,',
    '  `- interrupted_count_delta: ${audit.deltas.interrupted_count}` ,',
    '  `- production_gap_count_delta: ${audit.deltas.production_gap_count}` ,',
    '  "",',
    '  "## Compatibility Notes",',
    '  "",',
    '  ...(audit.compatibility_notes.length ? audit.compatibility_notes.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Recommended Actions",',
    '  "",',
    '  ...(audit.recommended_actions.length ? audit.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence}; samples=${(item.sample_files || []).join(", ") || "none"})`) : ["- none"]),',
    ']',
    'fs.writeFileSync(path.join(dir, outputFilename), `${JSON.stringify(audit, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, markdownFilename), `${lines.join("\\n").trim()}\\n`)',
    'NODE',
  ].join('\n');
}

function renderProductionMaterialPackHealthAuditCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const beforeFilename = "production-material-pack-health-before.json"',
    'const afterFilename = "production-material-pack-health-after.json"',
    'const outputFilename = "production-material-pack-health-audit.json"',
    'const markdownFilename = "production-material-pack-health-audit.md"',
    'const statusRank = { failed: 0, warning: 1, passed: 2 }',
    'function filePath(filename) { return path.join(dir, filename) }',
    'function exists(filename) { return fs.existsSync(filePath(filename)) }',
    'function readJson(filename) {',
    '  if (!exists(filename)) return undefined',
    '  try { return JSON.parse(fs.readFileSync(filePath(filename), "utf8")) }',
    '  catch (error) { return { __parse_error: error instanceof Error ? error.message : String(error) } }',
    '}',
    'function numberValue(value) {',
    '  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN',
    '  return Number.isFinite(parsed) ? parsed : 0',
    '}',
    'function reportOf(root) {',
    '  if (!root || root.__parse_error) return undefined',
    '  if (root.data && typeof root.data === "object" && root.data.schema_version) return root.data',
    '  return root',
    '}',
    'function action(priority, owner, text, evidence, sampleFiles = []) {',
    '  return { priority, owner, action: text, evidence, sample_files: sampleFiles }',
    '}',
    'function snapshot(filename) {',
    '  const root = readJson(filename)',
    '  if (!root) return { filename, exists: false, parse_ok: false }',
    '  if (root.__parse_error) return { filename, exists: true, parse_ok: false, parse_error: root.__parse_error }',
    '  const report = reportOf(root)',
    '  const coreTypes = Array.isArray(report?.core_video_types) ? report.core_video_types : []',
    '  const coreReady = Array.isArray(report?.production_ready_core_video_types) ? report.production_ready_core_video_types : []',
    '  const issues = Array.isArray(report?.issues) ? report.issues : []',
    '  return {',
    '    filename,',
    '    exists: true,',
    '    parse_ok: true,',
    '    ok: root.ok,',
    '    schema_version: report?.schema_version || root.schema_version,',
    '    generated_at: report?.generated_at || root.generated_at,',
    '    status: typeof report?.status === "string" ? report.status : "failed",',
    '    pack_count: numberValue(report?.pack_count),',
    '    required_video_type_count: Array.isArray(report?.required_video_types) ? report.required_video_types.length : 0,',
    '    covered_required_video_type_count: Array.isArray(report?.covered_required_video_types) ? report.covered_required_video_types.length : 0,',
    '    missing_required_video_type_count: Array.isArray(report?.missing_required_video_types) ? report.missing_required_video_types.length : 0,',
    '    core_ready_count: coreReady.length,',
    '    core_total_count: coreTypes.length,',
    '    issue_count: issues.length,',
    '    error_count: issues.filter(issue => issue?.severity === "error").length,',
    '    warning_count: issues.filter(issue => issue?.severity === "warning").length,',
    '  }',
    '}',
    'const before = snapshot(beforeFilename)',
    'const after = snapshot(afterFilename)',
    'const deltas = {',
    '  status_rank: (statusRank[after.status] ?? 0) - (statusRank[before.status] ?? 0),',
    '  issue_count: numberValue(after.issue_count) - numberValue(before.issue_count),',
    '  error_count: numberValue(after.error_count) - numberValue(before.error_count),',
    '  warning_count: numberValue(after.warning_count) - numberValue(before.warning_count),',
    '  core_ready_count: numberValue(after.core_ready_count) - numberValue(before.core_ready_count),',
    '}',
    'const failed_checks = []',
    'const warning_checks = []',
    'const compatibility_notes = []',
    'const recommended_actions = []',
    'function failCheck(check, priority, owner, text, samples) {',
    '  failed_checks.push(check)',
    '  recommended_actions.push(action(priority, owner, text, check, samples))',
    '}',
    'function warnCheck(check, priority, owner, text, samples) {',
    '  warning_checks.push(check)',
    '  recommended_actions.push(action(priority, owner, text, check, samples))',
    '}',
    'if (!before.exists) failCheck("missing_pack_health_before", "P0", "Story Agent smoke env", "Fetch production material pack health before worker submit.", [beforeFilename])',
    'if (before.exists && !before.parse_ok) failCheck("pack_health_before_parse_error", "P0", "Story Agent", "Regenerate valid JSON for pre-smoke production material pack health.", [beforeFilename])',
    'if (!after.exists) failCheck("missing_pack_health_after", "P0", "Story Agent smoke env", "Fetch production material pack health after worker smoke before signing off.", [afterFilename])',
    'if (after.exists && !after.parse_ok) failCheck("pack_health_after_parse_error", "P0", "Story Agent", "Regenerate valid JSON for post-smoke production material pack health.", [afterFilename])',
    'if (before.parse_ok && before.schema_version !== "production-material-pack-health/v1") warnCheck("pack_health_before_schema_unexpected", "P1", "Story Agent", "Confirm the pre-smoke production pack health schema remains compatible.", [beforeFilename])',
    'if (after.parse_ok && after.schema_version !== "production-material-pack-health/v1") warnCheck("pack_health_after_schema_unexpected", "P1", "Story Agent", "Confirm the post-smoke production pack health schema remains compatible.", [afterFilename])',
    'if (before.parse_ok && before.status !== "passed") failCheck("pack_health_not_passed_before", "P0", "Story Agent production templates", "ProductionMaterialPack health must be passed before GEARS worker signoff.", [beforeFilename])',
    'if (after.parse_ok && after.status !== "passed") failCheck("pack_health_not_passed_after", "P0", "Story Agent production templates", "ProductionMaterialPack health regressed or is not passed after GEARS worker smoke.", [afterFilename])',
    'if (before.parse_ok && before.issue_count > 0) failCheck("pack_health_issues_before", "P0", "Story Agent production templates", "Resolve ProductionMaterialPack health issues before worker signoff.", [beforeFilename])',
    'if (after.parse_ok && after.issue_count > 0) failCheck("pack_health_issues_after", "P0", "Story Agent production templates", "Resolve post-smoke ProductionMaterialPack health issues before worker signoff.", [afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.status_rank < 0) failCheck("pack_health_status_regressed", "P0", "Story Agent production templates", "ProductionMaterialPack health status regressed during worker smoke.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.core_ready_count < 0) failCheck("pack_health_core_ready_regressed", "P0", "Story Agent production templates", "Core production video type template readiness regressed during worker smoke.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.issue_count > 0) warnCheck("pack_health_issue_count_increased", "P1", "Story Agent production templates", "ProductionMaterialPack health issue count increased during worker smoke.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && before.status === "passed" && before.issue_count === 0) compatibility_notes.push("Production material pack health was passed before worker smoke.")',
    'if (before.parse_ok && after.parse_ok && !failed_checks.length && !warning_checks.length) compatibility_notes.push("Production material pack health stayed passed across the worker smoke run.")',
    'const status = failed_checks.length ? "failed" : warning_checks.length ? "warning" : "passed"',
    'const audit = {',
    '  schema_version: "production-material-pack-health-audit/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  status,',
    '  before,',
    '  after,',
    '  deltas,',
    '  failed_checks,',
    '  warning_checks,',
    '  compatibility_notes,',
    '  recommended_actions,',
    '}',
    'const lines = [',
    '  "# Production Material Pack Health Smoke Audit",',
    '  "",',
    '  `> schema_version: ${audit.schema_version}`,',
    '  `> generated_at: ${audit.generated_at}`,',
    '  `> scanned_dir: ${audit.scanned_dir}`,',
    '  "",',
    '  "## Summary",',
    '  "",',
    '  `- status: ${audit.status}` ,',
    '  `- before_status/issues/core_ready: ${audit.before.status || "n/a"}/${audit.before.issue_count ?? "n/a"}/${audit.before.core_ready_count ?? "n/a"}/${audit.before.core_total_count ?? "n/a"}` ,',
    '  `- after_status/issues/core_ready: ${audit.after.status || "n/a"}/${audit.after.issue_count ?? "n/a"}/${audit.after.core_ready_count ?? "n/a"}/${audit.after.core_total_count ?? "n/a"}` ,',
    '  `- issue_count_delta: ${audit.deltas.issue_count}` ,',
    '  `- core_ready_count_delta: ${audit.deltas.core_ready_count}` ,',
    '  "",',
    '  "## Failed Checks",',
    '  "",',
    '  ...(audit.failed_checks.length ? audit.failed_checks.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Warning Checks",',
    '  "",',
    '  ...(audit.warning_checks.length ? audit.warning_checks.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Compatibility Notes",',
    '  "",',
    '  ...(audit.compatibility_notes.length ? audit.compatibility_notes.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Recommended Actions",',
    '  "",',
    '  ...(audit.recommended_actions.length ? audit.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence}; samples=${(item.sample_files || []).join(", ") || "none"})`) : ["- none"]),',
    ']',
    'fs.writeFileSync(path.join(dir, outputFilename), `${JSON.stringify(audit, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, markdownFilename), `${lines.join("\\n").trim()}\\n`)',
    'NODE',
  ].join('\n');
}

function renderDomainPackProductionHealthAuditCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const beforeFilename = "domain-pack-production-health-before.json"',
    'const afterFilename = "domain-pack-production-health-after.json"',
    'const outputFilename = "domain-pack-production-health-audit.json"',
    'const markdownFilename = "domain-pack-production-health-audit.md"',
    'const statusRank = { failed: 0, warning: 1, passed: 2 }',
    'function filePath(filename) { return path.join(dir, filename) }',
    'function exists(filename) { return fs.existsSync(filePath(filename)) }',
    'function readJson(filename) {',
    '  if (!exists(filename)) return undefined',
    '  try { return JSON.parse(fs.readFileSync(filePath(filename), "utf8")) }',
    '  catch (error) { return { __parse_error: error instanceof Error ? error.message : String(error) } }',
    '}',
    'function numberValue(value) {',
    '  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN',
    '  return Number.isFinite(parsed) ? parsed : 0',
    '}',
    'function reportOf(root) {',
    '  if (!root || root.__parse_error) return undefined',
    '  if (root.data && typeof root.data === "object" && root.data.schema_version) return root.data',
    '  return root',
    '}',
    'function action(priority, owner, text, evidence, sampleFiles = []) {',
    '  return { priority, owner, action: text, evidence, sample_files: sampleFiles }',
    '}',
    'function snapshot(filename) {',
    '  const root = readJson(filename)',
    '  if (!root) return { filename, exists: false, parse_ok: false }',
    '  if (root.__parse_error) return { filename, exists: true, parse_ok: false, parse_error: root.__parse_error }',
    '  const report = reportOf(root)',
    '  const issues = Array.isArray(report?.issues) ? report.issues : []',
    '  return {',
    '    filename,',
    '    exists: true,',
    '    parse_ok: true,',
    '    ok: root.ok,',
    '    schema_version: report?.schema_version || root.schema_version,',
    '    generated_at: report?.generated_at || root.generated_at,',
    '    status: typeof report?.status === "string" ? report.status : "failed",',
    '    pack_count: numberValue(report?.pack_count),',
    '    production_pack_count: numberValue(report?.production_pack_count),',
    '    required_pack_count: Array.isArray(report?.required_pack_ids) ? report.required_pack_ids.length : 0,',
    '    covered_required_pack_count: Array.isArray(report?.covered_required_pack_ids) ? report.covered_required_pack_ids.length : 0,',
    '    missing_required_pack_count: Array.isArray(report?.missing_required_pack_ids) ? report.missing_required_pack_ids.length : 0,',
    '    ready_pack_count: Array.isArray(report?.production_ready_pack_ids) ? report.production_ready_pack_ids.length : 0,',
    '    issue_count: issues.length,',
    '    error_count: issues.filter(issue => issue?.severity === "error").length,',
    '    warning_count: issues.filter(issue => issue?.severity === "warning").length,',
    '  }',
    '}',
    'const before = snapshot(beforeFilename)',
    'const after = snapshot(afterFilename)',
    'const deltas = {',
    '  status_rank: (statusRank[after.status] ?? 0) - (statusRank[before.status] ?? 0),',
    '  issue_count: numberValue(after.issue_count) - numberValue(before.issue_count),',
    '  error_count: numberValue(after.error_count) - numberValue(before.error_count),',
    '  warning_count: numberValue(after.warning_count) - numberValue(before.warning_count),',
    '  ready_pack_count: numberValue(after.ready_pack_count) - numberValue(before.ready_pack_count),',
    '}',
    'const failed_checks = []',
    'const warning_checks = []',
    'const compatibility_notes = []',
    'const recommended_actions = []',
    'function failCheck(check, priority, owner, text, samples) {',
    '  failed_checks.push(check)',
    '  recommended_actions.push(action(priority, owner, text, check, samples))',
    '}',
    'function warnCheck(check, priority, owner, text, samples) {',
    '  warning_checks.push(check)',
    '  recommended_actions.push(action(priority, owner, text, check, samples))',
    '}',
    'if (!before.exists) failCheck("missing_domain_pack_health_before", "P0", "Story Agent smoke env", "Fetch Domain Pack production health before worker submit.", [beforeFilename])',
    'if (before.exists && !before.parse_ok) failCheck("domain_pack_health_before_parse_error", "P0", "Story Agent", "Regenerate valid JSON for pre-smoke Domain Pack production health.", [beforeFilename])',
    'if (!after.exists) failCheck("missing_domain_pack_health_after", "P0", "Story Agent smoke env", "Fetch Domain Pack production health after worker smoke before signing off.", [afterFilename])',
    'if (after.exists && !after.parse_ok) failCheck("domain_pack_health_after_parse_error", "P0", "Story Agent", "Regenerate valid JSON for post-smoke Domain Pack production health.", [afterFilename])',
    'if (before.parse_ok && before.schema_version !== "domain-pack-production-health/v1") warnCheck("domain_pack_health_before_schema_unexpected", "P1", "Story Agent", "Confirm the pre-smoke Domain Pack production health schema remains compatible.", [beforeFilename])',
    'if (after.parse_ok && after.schema_version !== "domain-pack-production-health/v1") warnCheck("domain_pack_health_after_schema_unexpected", "P1", "Story Agent", "Confirm the post-smoke Domain Pack production health schema remains compatible.", [afterFilename])',
    'if (before.parse_ok && before.status !== "passed") failCheck("domain_pack_health_not_passed_before", "P0", "Story Agent Domain Packs", "Domain Pack production health must be passed before GEARS worker signoff.", [beforeFilename])',
    'if (after.parse_ok && after.status !== "passed") failCheck("domain_pack_health_not_passed_after", "P0", "Story Agent Domain Packs", "Domain Pack production health regressed or is not passed after GEARS worker smoke.", [afterFilename])',
    'if (before.parse_ok && before.issue_count > 0) failCheck("domain_pack_health_issues_before", "P0", "Story Agent Domain Packs", "Resolve Domain Pack production health issues before worker signoff.", [beforeFilename])',
    'if (after.parse_ok && after.issue_count > 0) failCheck("domain_pack_health_issues_after", "P0", "Story Agent Domain Packs", "Resolve post-smoke Domain Pack production health issues before worker signoff.", [afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.status_rank < 0) failCheck("domain_pack_health_status_regressed", "P0", "Story Agent Domain Packs", "Domain Pack production health status regressed during worker smoke.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.ready_pack_count < 0) failCheck("domain_pack_health_ready_count_regressed", "P0", "Story Agent Domain Packs", "Production Domain Pack readiness regressed during worker smoke.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.issue_count > 0) warnCheck("domain_pack_health_issue_count_increased", "P1", "Story Agent Domain Packs", "Domain Pack production health issue count increased during worker smoke.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && before.status === "passed" && before.issue_count === 0) compatibility_notes.push("Domain Pack production health was passed before worker smoke.")',
    'if (before.parse_ok && after.parse_ok && !failed_checks.length && !warning_checks.length) compatibility_notes.push("Domain Pack production health stayed passed across the worker smoke run.")',
    'const status = failed_checks.length ? "failed" : warning_checks.length ? "warning" : "passed"',
    'const audit = {',
    '  schema_version: "domain-pack-production-health-audit/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  status,',
    '  before,',
    '  after,',
    '  deltas,',
    '  failed_checks,',
    '  warning_checks,',
    '  compatibility_notes,',
    '  recommended_actions,',
    '}',
    'const lines = [',
    '  "# Domain Pack Production Health Smoke Audit",',
    '  "",',
    '  `> schema_version: ${audit.schema_version}`,',
    '  `> generated_at: ${audit.generated_at}`,',
    '  `> scanned_dir: ${audit.scanned_dir}`,',
    '  "",',
    '  "## Summary",',
    '  "",',
    '  `- status: ${audit.status}` ,',
    '  `- before_status/issues/ready: ${audit.before.status || "n/a"}/${audit.before.issue_count ?? "n/a"}/${audit.before.ready_pack_count ?? "n/a"}/${audit.before.required_pack_count ?? "n/a"}` ,',
    '  `- after_status/issues/ready: ${audit.after.status || "n/a"}/${audit.after.issue_count ?? "n/a"}/${audit.after.ready_pack_count ?? "n/a"}/${audit.after.required_pack_count ?? "n/a"}` ,',
    '  `- issue_count_delta: ${audit.deltas.issue_count}` ,',
    '  `- ready_pack_count_delta: ${audit.deltas.ready_pack_count}` ,',
    '  "",',
    '  "## Failed Checks",',
    '  "",',
    '  ...(audit.failed_checks.length ? audit.failed_checks.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Warning Checks",',
    '  "",',
    '  ...(audit.warning_checks.length ? audit.warning_checks.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Compatibility Notes",',
    '  "",',
    '  ...(audit.compatibility_notes.length ? audit.compatibility_notes.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Recommended Actions",',
    '  "",',
    '  ...(audit.recommended_actions.length ? audit.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence}; samples=${(item.sample_files || []).join(", ") || "none"})`) : ["- none"]),',
    ']',
    'fs.writeFileSync(path.join(dir, outputFilename), `${JSON.stringify(audit, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, markdownFilename), `${lines.join("\\n").trim()}\\n`)',
    'NODE',
  ].join('\n');
}

function renderStoryAgentMvpStatusAuditCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const beforeFilename = "story-agent-mvp-status-before.json"',
    'const afterFilename = "story-agent-mvp-status-after.json"',
    'const outputFilename = "story-agent-mvp-status-audit.json"',
    'const markdownFilename = "story-agent-mvp-status-audit.md"',
    'const statusRank = { blocked: 0, needs_action: 1, ready: 2 }',
    'function filePath(filename) { return path.join(dir, filename) }',
    'function exists(filename) { return fs.existsSync(filePath(filename)) }',
    'function readJson(filename) {',
    '  if (!exists(filename)) return undefined',
    '  try { return JSON.parse(fs.readFileSync(filePath(filename), "utf8")) }',
    '  catch (error) { return { __parse_error: error instanceof Error ? error.message : String(error) } }',
    '}',
    'function numberValue(value) {',
    '  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN',
    '  return Number.isFinite(parsed) ? parsed : 0',
    '}',
    'function reportOf(root) {',
    '  if (!root || root.__parse_error) return undefined',
    '  if (root.data && typeof root.data === "object" && root.data.schema_version) return root.data',
    '  return root',
    '}',
    'function action(priority, owner, text, evidence, sampleFiles = []) {',
    '  return { priority, owner, action: text, evidence, sample_files: sampleFiles }',
    '}',
    'function snapshot(filename) {',
    '  const root = readJson(filename)',
    '  if (!root) return { filename, exists: false, parse_ok: false }',
    '  if (root.__parse_error) return { filename, exists: true, parse_ok: false, parse_error: root.__parse_error }',
    '  const report = reportOf(root)',
    '  const lanes = Array.isArray(report?.lanes) ? report.lanes : []',
    '  const summary = report?.summary && typeof report.summary === "object" ? report.summary : {}',
    '  return {',
    '    filename,',
    '    exists: true,',
    '    parse_ok: true,',
    '    ok: root.ok,',
    '    schema_version: report?.schema_version || root.schema_version,',
    '    generated_at: report?.generated_at || root.generated_at,',
    '    status: typeof report?.status === "string" ? report.status : "blocked",',
    '    score: numberValue(report?.score),',
    '    lane_count: lanes.length,',
    '    ready_lane_count: lanes.filter(lane => lane?.status === "ready").length,',
    '    blocked_lane_count: lanes.filter(lane => lane?.status === "blocked").length,',
    '    priority_target_count: Array.isArray(report?.priority_targets) ? report.priority_targets.length : 0,',
    '    next_action_count: Array.isArray(report?.next_actions) ? report.next_actions.length : 0,',
    '    summary: {',
    '      blocker_count: numberValue(summary.blocker_count),',
    '      warning_count: numberValue(summary.warning_count),',
    '      generated_ready_count: numberValue(summary.generated_ready_count),',
    '      generated_interrupted_count: numberValue(summary.generated_interrupted_count),',
    '      generated_production_gap_count: numberValue(summary.generated_production_gap_count),',
    '      readiness_ready_count: numberValue(summary.readiness_ready_count),',
    '      readiness_blocked_count: numberValue(summary.readiness_blocked_count),',
    '      ready_automation_step_count: numberValue(summary.ready_automation_step_count),',
    '      seedance_placeholder_asset_count: numberValue(summary.seedance_placeholder_asset_count),',
    '      seedance_production_asset_ready_count: numberValue(summary.seedance_production_asset_ready_count),',
    '      knowledge_writeback_ready_count: numberValue(summary.knowledge_writeback_ready_count),',
    '      knowledge_writeback_queued_count: numberValue(summary.knowledge_writeback_queued_count),',
    '      knowledge_writeback_needs_revision_count: numberValue(summary.knowledge_writeback_needs_revision_count),',
    '    },',
    '  }',
    '}',
    'function delta(after, before, key) { return numberValue(after?.[key]) - numberValue(before?.[key]) }',
    'const before = snapshot(beforeFilename)',
    'const after = snapshot(afterFilename)',
    'const deltas = {',
    '  score: delta(after, before, "score"),',
    '  status_rank: (statusRank[after.status] ?? 0) - (statusRank[before.status] ?? 0),',
    '  ready_lane_count: delta(after, before, "ready_lane_count"),',
    '  blocked_lane_count: delta(after, before, "blocked_lane_count"),',
    '  blocker_count: numberValue(after.summary?.blocker_count) - numberValue(before.summary?.blocker_count),',
    '  warning_count: numberValue(after.summary?.warning_count) - numberValue(before.summary?.warning_count),',
    '  generated_interrupted_count: numberValue(after.summary?.generated_interrupted_count) - numberValue(before.summary?.generated_interrupted_count),',
    '  readiness_blocked_count: numberValue(after.summary?.readiness_blocked_count) - numberValue(before.summary?.readiness_blocked_count),',
    '  seedance_placeholder_asset_count: numberValue(after.summary?.seedance_placeholder_asset_count) - numberValue(before.summary?.seedance_placeholder_asset_count),',
    '  seedance_production_asset_ready_count: numberValue(after.summary?.seedance_production_asset_ready_count) - numberValue(before.summary?.seedance_production_asset_ready_count),',
    '  knowledge_writeback_ready_count: numberValue(after.summary?.knowledge_writeback_ready_count) - numberValue(before.summary?.knowledge_writeback_ready_count),',
    '  knowledge_writeback_queued_count: numberValue(after.summary?.knowledge_writeback_queued_count) - numberValue(before.summary?.knowledge_writeback_queued_count),',
    '  knowledge_writeback_needs_revision_count: numberValue(after.summary?.knowledge_writeback_needs_revision_count) - numberValue(before.summary?.knowledge_writeback_needs_revision_count),',
    '}',
    'const failed_checks = []',
    'const warning_checks = []',
    'const compatibility_notes = []',
    'const recommended_actions = []',
    'function failCheck(check, priority, owner, text, samples) {',
    '  failed_checks.push(check)',
    '  recommended_actions.push(action(priority, owner, text, check, samples))',
    '}',
    'function warnCheck(check, priority, owner, text, samples) {',
    '  warning_checks.push(check)',
    '  recommended_actions.push(action(priority, owner, text, check, samples))',
    '}',
    'if (!before.exists) failCheck("missing_mvp_status_before", "P0", "Story Agent smoke env", "Fetch Story Agent MVP status before worker submit.", [beforeFilename])',
    'if (before.exists && !before.parse_ok) failCheck("mvp_status_before_parse_error", "P0", "Story Agent", "Regenerate valid JSON for pre-smoke Story Agent MVP status.", [beforeFilename])',
    'if (!after.exists) failCheck("missing_mvp_status_after", "P0", "Story Agent smoke env", "Fetch Story Agent MVP status after worker smoke before signing off.", [afterFilename])',
    'if (after.exists && !after.parse_ok) failCheck("mvp_status_after_parse_error", "P0", "Story Agent", "Regenerate valid JSON for post-smoke Story Agent MVP status.", [afterFilename])',
    'if (before.parse_ok && before.schema_version !== "story-agent-mvp-status/v1") warnCheck("mvp_status_before_schema_unexpected", "P1", "Story Agent", "Confirm the pre-smoke MVP status schema remains compatible.", [beforeFilename])',
    'if (after.parse_ok && after.schema_version !== "story-agent-mvp-status/v1") warnCheck("mvp_status_after_schema_unexpected", "P1", "Story Agent", "Confirm the post-smoke MVP status schema remains compatible.", [afterFilename])',
    'if (before.parse_ok && before.lane_count < 1) failCheck("mvp_status_no_lanes_before", "P0", "Story Agent", "MVP status has no lanes before smoke; restore the Story Agent MVP status report.", [beforeFilename])',
    'if (after.parse_ok && after.lane_count < 1) failCheck("mvp_status_no_lanes_after", "P0", "Story Agent", "MVP status has no lanes after smoke; restore the Story Agent MVP status report.", [afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.status_rank < 0) failCheck("mvp_status_regressed", "P0", "Story Agent", "Story Agent MVP status regressed during worker smoke; inspect generated health and production readiness writes.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.blocker_count > 0) failCheck("mvp_blocker_count_increased", "P0", "Story Agent", "Story Agent MVP blocker count increased during worker smoke; inspect callback or readiness side effects.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.score < 0) warnCheck("mvp_score_decreased", "P1", "Story Agent", "Story Agent MVP score decreased during worker smoke; compare before/after lane details before rollout.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && after.parse_ok && deltas.generated_interrupted_count > 0) warnCheck("mvp_generated_interrupted_increased", "P1", "Story Agent", "MVP generated interrupted count increased during smoke; inspect generated project references.", [beforeFilename, afterFilename])',
    'if (before.parse_ok && after.parse_ok && !failed_checks.length && !warning_checks.length) compatibility_notes.push("Story Agent MVP status and score stayed stable across the worker smoke run.")',
    'if (before.parse_ok && before.status === "ready") compatibility_notes.push("Story Agent MVP was ready before the worker smoke run.")',
    'const status = failed_checks.length ? "failed" : warning_checks.length ? "warning" : "passed"',
    'const audit = {',
    '  schema_version: "story-agent-mvp-status-audit/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  status,',
    '  before,',
    '  after,',
    '  deltas,',
    '  failed_checks,',
    '  warning_checks,',
    '  compatibility_notes,',
    '  recommended_actions,',
    '}',
    'const lines = [',
    '  "# Story Agent MVP Status Smoke Audit",',
    '  "",',
    '  `> schema_version: ${audit.schema_version}`,',
    '  `> generated_at: ${audit.generated_at}`,',
    '  `> scanned_dir: ${audit.scanned_dir}`,',
    '  "",',
    '  "## Summary",',
    '  "",',
    '  `- status: ${audit.status}` ,',
    '  `- before_status/score: ${audit.before.status || "n/a"}/${audit.before.score ?? "n/a"}` ,',
    '  `- after_status/score: ${audit.after.status || "n/a"}/${audit.after.score ?? "n/a"}` ,',
    '  `- score_delta: ${audit.deltas.score}` ,',
    '  `- status_rank_delta: ${audit.deltas.status_rank}` ,',
    '  `- ready_lane_delta: ${audit.deltas.ready_lane_count}` ,',
    '  `- blocker_count_delta: ${audit.deltas.blocker_count}` ,',
    '  `- seedance_placeholder_before/after/delta: ${audit.before.summary?.seedance_placeholder_asset_count ?? 0}/${audit.after.summary?.seedance_placeholder_asset_count ?? 0}/${audit.deltas.seedance_placeholder_asset_count}` ,',
    '  `- seedance_production_ready_before/after/delta: ${audit.before.summary?.seedance_production_asset_ready_count ?? 0}/${audit.after.summary?.seedance_production_asset_ready_count ?? 0}/${audit.deltas.seedance_production_asset_ready_count}` ,',
    '  `- knowledge_writeback_ready_before/after/delta: ${audit.before.summary?.knowledge_writeback_ready_count ?? 0}/${audit.after.summary?.knowledge_writeback_ready_count ?? 0}/${audit.deltas.knowledge_writeback_ready_count}` ,',
    '  `- knowledge_writeback_queued_before/after/delta: ${audit.before.summary?.knowledge_writeback_queued_count ?? 0}/${audit.after.summary?.knowledge_writeback_queued_count ?? 0}/${audit.deltas.knowledge_writeback_queued_count}` ,',
    '  `- knowledge_writeback_needs_revision_before/after/delta: ${audit.before.summary?.knowledge_writeback_needs_revision_count ?? 0}/${audit.after.summary?.knowledge_writeback_needs_revision_count ?? 0}/${audit.deltas.knowledge_writeback_needs_revision_count}` ,',
    '  "",',
    '  "## Failed Checks",',
    '  "",',
    '  ...(audit.failed_checks.length ? audit.failed_checks.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Warning Checks",',
    '  "",',
    '  ...(audit.warning_checks.length ? audit.warning_checks.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Compatibility Notes",',
    '  "",',
    '  ...(audit.compatibility_notes.length ? audit.compatibility_notes.map(item => `- ${item}`) : ["- none"]),',
    '  "",',
    '  "## Recommended Actions",',
    '  "",',
    '  ...(audit.recommended_actions.length ? audit.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence}; samples=${(item.sample_files || []).join(", ") || "none"})`) : ["- none"]),',
    ']',
    'fs.writeFileSync(path.join(dir, outputFilename), `${JSON.stringify(audit, null, 2)}\\n`)',
    'fs.writeFileSync(path.join(dir, markdownFilename), `${lines.join("\\n").trim()}\\n`)',
    'NODE',
  ].join('\n');
}

function renderWorkerAcceptanceVerdictCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2] || "."',
    'const outputFilename = "gears-worker-acceptance-verdict.json"',
    'const markdownFilename = "gears-worker-acceptance-verdict.md"',
    'const pressureRequired = process.env.GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE === "1"',
    'function filePath(filename) { return path.join(dir, filename) }',
    'function exists(filename) { return fs.existsSync(filePath(filename)) }',
    'function readJson(filename) {',
    '  if (!exists(filename)) return undefined',
    '  try { return JSON.parse(fs.readFileSync(filePath(filename), "utf8")) }',
    '  catch (error) { return { __parse_error: error instanceof Error ? error.message : String(error) } }',
    '}',
    'function readLines(filename) {',
    '  if (!exists(filename)) return []',
    '  return fs.readFileSync(filePath(filename), "utf8").split(/\\r?\\n/).map(line => line.trim()).filter(Boolean)',
    '}',
    'function numberValue(value) { return typeof value === "number" && Number.isFinite(value) ? value : 0 }',
    'function actionsFrom(audit) { return Array.isArray(audit?.recommended_actions) ? audit.recommended_actions : [] }',
    'function responseBody(root) { return root && typeof root === "object" && root.data && typeof root.data === "object" ? root.data : root }',
    'function stringMatchCount(value, expected, seen = new Set()) {',
    '  if (!expected) return 0',
    '  if (typeof value === "string") return value === expected ? 1 : 0',
    '  if (!value || typeof value !== "object") return 0',
    '  if (seen.has(value)) return 0',
    '  seen.add(value)',
    '  let count = 0',
    '  const values = Array.isArray(value) ? value : Object.values(value)',
    '  for (const item of values) count += stringMatchCount(item, expected, seen)',
    '  return count',
    '}',
    'function action(priority, owner, text, evidence, sampleFiles = []) {',
    '  return { priority, owner, action: text, evidence, sample_files: sampleFiles }',
    '}',
    'function mvpGovernanceCountsFrom(audit) {',
    '  const beforeSummary = audit?.before?.summary || {}',
    '  const afterSummary = audit?.after?.summary || {}',
    '  const deltas = audit?.deltas || {}',
    '  function record(key) {',
    '    return {',
    '      before: numberValue(beforeSummary[key]),',
    '      after: numberValue(afterSummary[key]),',
    '      delta: numberValue(deltas[key]),',
    '    }',
    '  }',
    '  return {',
    '    seedance_placeholder_asset_count: record("seedance_placeholder_asset_count"),',
    '    seedance_production_asset_ready_count: record("seedance_production_asset_ready_count"),',
    '    knowledge_writeback_ready_count: record("knowledge_writeback_ready_count"),',
    '    knowledge_writeback_queued_count: record("knowledge_writeback_queued_count"),',
    '    knowledge_writeback_needs_revision_count: record("knowledge_writeback_needs_revision_count"),',
    '  }',
    '}',
    'const gates = []',
    'function addGate(id, label, status, summary, evidence, recommendedActions = []) {',
    '  gates.push({ id, label, status, summary, evidence, recommended_actions: recommendedActions })',
    '}',
    'const missingEnvs = readLines("gears-required-env-missing.txt")',
    'addGate(',
    '  "required_envs",',
    '  "Required GEARS env values",',
    '  missingEnvs.length ? "failed" : "passed",',
    '  missingEnvs.length ? `Missing envs: ${missingEnvs.join(", ")}` : "All required smoke env values were present when submit/callback smoke ran.",',
    '  { missing_envs: missingEnvs },',
    '  missingEnvs.length ? [action("P0", "Story Agent smoke env", "Set every required GEARS_* smoke environment variable before trusting worker acceptance results.", "missing_required_envs", ["gears-required-env-missing.txt"])] : [],',
    ')',
    'const idPreflight = readJson("story-agent-callback-id-preflight.json")',
    'if (!idPreflight) {',
    '  addGate("callback_id_preflight", "Story Agent callback id preflight", "failed", "Callback id preflight audit did not run.", { filename: "story-agent-callback-id-preflight.json" }, [action("P0", "Story Agent smoke env", "Run callback id preflight before posting Story Agent callbacks.", "missing_callback_id_preflight", [])])',
    '} else if (idPreflight.__parse_error) {',
    '  addGate("callback_id_preflight", "Story Agent callback id preflight", "failed", "Callback id preflight audit is not valid JSON.", { parse_error: idPreflight.__parse_error }, [action("P0", "Story Agent", "Regenerate a valid callback id preflight audit.", "callback_id_preflight_parse_error", ["story-agent-callback-id-preflight.json"])])',
    '} else {',
    '  const warningCount = numberValue(idPreflight.warning_count)',
    '  addGate("callback_id_preflight", "Story Agent callback id preflight", warningCount ? "failed" : "passed", warningCount ? `${warningCount} callback id warning(s).` : "Story Agent callback route ids are valid.", { warning_count: warningCount }, actionsFrom(idPreflight))',
    '}',
    'const workerAudit = readJson("gears-worker-response-audit.json")',
    'if (!workerAudit) {',
    '  addGate("worker_response_audit", "GEARS worker response audit", "failed", "Worker response audit did not run.", { filename: "gears-worker-response-audit.json" }, [action("P0", "GEARS v2", "Run submit/status smoke and generate gears-worker-response-audit.json.", "missing_worker_response_audit", [])])',
    '} else if (workerAudit.__parse_error) {',
    '  addGate("worker_response_audit", "GEARS worker response audit", "failed", "Worker response audit is not valid JSON.", { parse_error: workerAudit.__parse_error }, [action("P0", "Story Agent", "Regenerate a valid worker response audit.", "worker_audit_parse_error", ["gears-worker-response-audit.json"])])',
    '} else {',
    '  const totals = workerAudit.totals || {}',
    '  const workerBlockingCount = actionsFrom(workerAudit).length',
    '    + numberValue(totals.parse_error_count)',
    '    + numberValue(totals.transport_error_count)',
    '    + numberValue(totals.http_error_count)',
    '    + (numberValue(totals.record_count) ? 0 : 1)',
    '    + numberValue(totals.unknown_count)',
    '    + numberValue(totals.missing_worker_id_count)',
    '    + numberValue(totals.missing_source_id_count)',
    '    + numberValue(totals.missing_failure_context_count)',
    '    + numberValue(totals.missing_ready_artifact_count)',
    '  addGate("worker_response_audit", "GEARS worker response audit", workerBlockingCount ? "failed" : "passed", workerBlockingCount ? "Worker response audit still has contract blockers." : "Worker response ids, statuses, failure context, and artifacts pass the audit.", { totals }, actionsFrom(workerAudit))',
    '}',
    'const callbackAudit = readJson("story-agent-callback-response-audit.json")',
    'if (!callbackAudit) {',
    '  addGate("story_agent_callback_audit", "Story Agent callback response audit", "failed", "Story Agent callback response audit did not run.", { filename: "story-agent-callback-response-audit.json" }, [action("P0", "Story Agent + GEARS v2", "Run project and series callback smoke and generate story-agent-callback-response-audit.json.", "missing_story_agent_callback_audit", [])])',
    '} else if (callbackAudit.__parse_error) {',
    '  addGate("story_agent_callback_audit", "Story Agent callback response audit", "failed", "Story Agent callback response audit is not valid JSON.", { parse_error: callbackAudit.__parse_error }, [action("P0", "Story Agent", "Regenerate a valid Story Agent callback response audit.", "callback_audit_parse_error", ["story-agent-callback-response-audit.json"])])',
    '} else {',
    '  const totals = callbackAudit.totals || {}',
    '  const callbackBlockingCount = actionsFrom(callbackAudit).length',
    '    + numberValue(totals.parse_error_count)',
    '    + numberValue(totals.transport_error_count)',
    '    + numberValue(totals.http_error_count)',
    '    + numberValue(totals.ok_false_count)',
    '    + numberValue(totals.failed_count)',
    '    + numberValue(totals.validation_error_count)',
    '    + numberValue(totals.auth_error_count)',
    '    + numberValue(totals.not_found_count)',
    '    + numberValue(totals.blocked_count)',
    '    + numberValue(totals.ledger_match_missing_count)',
    '  addGate("story_agent_callback_audit", "Story Agent callback response audit", callbackBlockingCount ? "failed" : "passed", callbackBlockingCount ? "Story Agent callback audit still has writeback blockers." : "Story Agent project/series callback writeback and replay pass the audit.", { totals }, actionsFrom(callbackAudit))',
    '}',
    'const systemExternalIssues = []',
    'function inspectSystemExternalCallbackResponse(label, filename, root, expectedMode) {',
    '  const summary = { filename }',
    '  if (!root) {',
    '    systemExternalIssues.push(`${label}_missing`)',
    '    summary.missing = true',
    '    return summary',
    '  }',
    '  if (root.__parse_error) {',
    '    systemExternalIssues.push(`${label}_parse_error`)',
    '    summary.parse_error = root.__parse_error',
    '    return summary',
    '  }',
    '  const data = responseBody(root)',
    '  summary.ok = Object.prototype.hasOwnProperty.call(root, "ok") ? root.ok === true : true',
    '  summary.schema_version = data?.schema_version',
    '  summary.mode = data?.mode',
    '  summary.blocked = data?.blocked',
    '  summary.received_count = numberValue(data?.received_count)',
    '  summary.resolved_count = numberValue(data?.resolved_count)',
    '  summary.unresolved_count = numberValue(data?.unresolved_count)',
    '  summary.project_count = numberValue(data?.project_count)',
    '  summary.ready_to_import_count = numberValue(data?.ready_to_import_count)',
    '  summary.updated_count = numberValue(data?.updated_count)',
    '  summary.failed_count = numberValue(data?.failed_count)',
    '  summary.blocking_count = numberValue(data?.blocking_count)',
    '  if (!summary.ok) systemExternalIssues.push(`${label}_ok_false`)',
    '  if (summary.schema_version !== "system-gears-external-callback-batch-import/v1") systemExternalIssues.push(`${label}_schema_version_invalid`)',
    '  if (summary.mode !== expectedMode) systemExternalIssues.push(`${label}_mode_invalid`)',
    '  if (summary.blocked !== false) systemExternalIssues.push(`${label}_blocked`)',
    '  if (summary.unresolved_count > 0) systemExternalIssues.push(`${label}_unresolved_callbacks`)',
    '  if (summary.blocking_count > 0) systemExternalIssues.push(`${label}_blocking_count`)',
    '  if (expectedMode === "preflight" && summary.ready_to_import_count < 1) systemExternalIssues.push("preflight_ready_to_import_count_zero")',
    '  if (expectedMode === "import" && summary.updated_count < 1) systemExternalIssues.push("import_updated_count_zero")',
    '  if (expectedMode === "import" && summary.failed_count > 0) systemExternalIssues.push("import_failed_count")',
    '  return summary',
    '}',
    'const systemExternalPreflightRoot = readJson("story-agent-system-external-callback-preflight-response.json")',
    'const systemExternalImportRoot = readJson("story-agent-system-external-callback-import-response.json")',
    'const systemExternalPreflight = inspectSystemExternalCallbackResponse(',
    '  "system_external_preflight",',
    '  "story-agent-system-external-callback-preflight-response.json",',
    '  systemExternalPreflightRoot,',
    '  "preflight",',
    ')',
    'const systemExternalImport = inspectSystemExternalCallbackResponse(',
    '  "system_external_import",',
    '  "story-agent-system-external-callback-import-response.json",',
    '  systemExternalImportRoot,',
    '  "import",',
    ')',
    'const systemExternalOutputSource = readJson("story-agent-system-external-output-url-source.json")',
    'let systemExternalOutputUrl = ""',
    'if (!systemExternalOutputSource) {',
    '  systemExternalIssues.push("output_url_source_missing")',
    '} else if (systemExternalOutputSource.__parse_error) {',
    '  systemExternalIssues.push("output_url_source_parse_error")',
    '} else {',
    '  if (!["env", "worker_response"].includes(systemExternalOutputSource.source)) systemExternalIssues.push("output_url_source_unverified")',
    '  if (systemExternalOutputSource.ready_for_external_import !== true) systemExternalIssues.push("output_url_not_ready_for_external_import")',
    '  if (systemExternalOutputSource.placeholder === true) systemExternalIssues.push("output_url_placeholder")',
    '  systemExternalOutputUrl = typeof systemExternalOutputSource.output_url === "string" ? systemExternalOutputSource.output_url.trim() : ""',
    '  if (!systemExternalOutputUrl) systemExternalIssues.push("output_url_missing")',
    '}',
    'const systemExternalOutputUrlImportMatchCount = systemExternalOutputUrl',
    '  ? stringMatchCount(responseBody(systemExternalImportRoot), systemExternalOutputUrl)',
    '  : 0',
    'const systemExternalOutputUrlImported = systemExternalOutputUrlImportMatchCount > 0',
    'if (systemExternalOutputUrl && !systemExternalOutputUrlImported) systemExternalIssues.push("output_url_not_found_in_import_response")',
    'addGate(',
    '  "system_external_callback_batch",',
    '  "Story Agent system external callback batch",',
    '  systemExternalIssues.length ? "failed" : "passed",',
    '  systemExternalIssues.length',
    '    ? "System-level external callback preflight/import has unresolved, blocked, non-imported, or URL-mismatched callbacks."',
    '    : "System-level external callback preflight/import wrote real external artifacts through safe import.",',
    '  { preflight: systemExternalPreflight, import: systemExternalImport, output_source: systemExternalOutputSource, output_url_verification: { expected_output_url: systemExternalOutputUrl, imported: systemExternalOutputUrlImported, import_match_count: systemExternalOutputUrlImportMatchCount }, issues: systemExternalIssues },',
    '  systemExternalIssues.length ? [action("P0", "Story Agent + GEARS v2", "Run system GEARS external callback preflight/import with a real public artifact URL extracted from GEARS worker responses or provided through GEARS_SYSTEM_EXTERNAL_OUTPUT_URL after Story Agent ledger seed succeeds; verify the import response contains that same output_url and do not sign off local_acceptance placeholders.", "system_external_callback_batch_blocked", ["story-agent-system-external-output-url-source.json", "story-agent-system-external-callback-preflight-response.json", "story-agent-system-external-callback-import-response.json", "gears-system-external-callback-smoke.json"])] : [],',
    ')',
    'const generatedHealthAudit = readJson("story-agent-generated-health-audit.json")',
    'if (!generatedHealthAudit) {',
    '  addGate("story_agent_generated_health_audit", "Story Agent generated health smoke audit", "failed", "Generated health smoke audit did not run.", { filename: "story-agent-generated-health-audit.json" }, [action("P0", "Story Agent smoke env", "Run generated health before/after audit before signing off GEARS worker acceptance.", "missing_generated_health_audit", [])])',
    '} else if (generatedHealthAudit.__parse_error) {',
    '  addGate("story_agent_generated_health_audit", "Story Agent generated health smoke audit", "failed", "Generated health smoke audit is not valid JSON.", { parse_error: generatedHealthAudit.__parse_error }, [action("P0", "Story Agent", "Regenerate a valid Story Agent generated health smoke audit.", "generated_health_audit_parse_error", ["story-agent-generated-health-audit.json"])])',
    '} else {',
    '  const healthBlockingCount = actionsFrom(generatedHealthAudit).length + (generatedHealthAudit.status === "passed" ? 0 : 1)',
    '  addGate(',
    '    "story_agent_generated_health_audit",',
    '    "Story Agent generated health smoke audit",',
    '    healthBlockingCount ? "failed" : "passed",',
    '    healthBlockingCount ? "Generated health audit still has target or regression blockers." : "Generated health before/after audit passed without target regression.",',
    '    {',
    '      status: generatedHealthAudit.status,',
    '      before_summary: generatedHealthAudit.before?.summary,',
    '      after_summary: generatedHealthAudit.after?.summary,',
    '      deltas: generatedHealthAudit.deltas,',
    '    },',
    '    actionsFrom(generatedHealthAudit),',
    '  )',
    '}',
    'const productionMaterialPackHealthAudit = readJson("production-material-pack-health-audit.json")',
    'if (!productionMaterialPackHealthAudit) {',
    '  addGate("production_material_pack_health_audit", "Production material pack health smoke audit", "failed", "Production material pack health audit did not run.", { filename: "production-material-pack-health-audit.json" }, [action("P0", "Story Agent production templates", "Run production material pack health before/after audit before signing off GEARS worker acceptance.", "missing_production_material_pack_health_audit", [])])',
    '} else if (productionMaterialPackHealthAudit.__parse_error) {',
    '  addGate("production_material_pack_health_audit", "Production material pack health smoke audit", "failed", "Production material pack health audit is not valid JSON.", { parse_error: productionMaterialPackHealthAudit.__parse_error }, [action("P0", "Story Agent production templates", "Regenerate a valid production material pack health audit.", "production_pack_health_audit_parse_error", ["production-material-pack-health-audit.json"])])',
    '} else {',
    '  const packHealthBlockingCount = (productionMaterialPackHealthAudit.status === "passed" ? 0 : 1) + (Array.isArray(productionMaterialPackHealthAudit.failed_checks) ? productionMaterialPackHealthAudit.failed_checks.length : 0)',
    '  addGate(',
    '    "production_material_pack_health_audit",',
    '    "Production material pack health smoke audit",',
    '    packHealthBlockingCount ? "failed" : "passed",',
    '    packHealthBlockingCount ? "Production material pack health is not passed or regressed during smoke." : "Production material pack health stayed passed across worker smoke.",',
    '    {',
    '      status: productionMaterialPackHealthAudit.status,',
    '      before: { status: productionMaterialPackHealthAudit.before?.status, issue_count: productionMaterialPackHealthAudit.before?.issue_count, core_ready_count: productionMaterialPackHealthAudit.before?.core_ready_count },',
    '      after: { status: productionMaterialPackHealthAudit.after?.status, issue_count: productionMaterialPackHealthAudit.after?.issue_count, core_ready_count: productionMaterialPackHealthAudit.after?.core_ready_count },',
    '      deltas: productionMaterialPackHealthAudit.deltas,',
    '      warning_checks: productionMaterialPackHealthAudit.warning_checks || [],',
    '    },',
    '    actionsFrom(productionMaterialPackHealthAudit),',
    '  )',
    '}',
    'const domainPackProductionHealthAudit = readJson("domain-pack-production-health-audit.json")',
    'if (!domainPackProductionHealthAudit) {',
    '  addGate("domain_pack_production_health_audit", "Domain Pack production health smoke audit", "failed", "Domain Pack production health audit did not run.", { filename: "domain-pack-production-health-audit.json" }, [action("P0", "Story Agent Domain Packs", "Run Domain Pack production health before/after audit before signing off GEARS worker acceptance.", "missing_domain_pack_production_health_audit", [])])',
    '} else if (domainPackProductionHealthAudit.__parse_error) {',
    '  addGate("domain_pack_production_health_audit", "Domain Pack production health smoke audit", "failed", "Domain Pack production health audit is not valid JSON.", { parse_error: domainPackProductionHealthAudit.__parse_error }, [action("P0", "Story Agent Domain Packs", "Regenerate a valid Domain Pack production health audit.", "domain_pack_health_audit_parse_error", ["domain-pack-production-health-audit.json"])])',
    '} else {',
    '  const domainPackHealthBlockingCount = (domainPackProductionHealthAudit.status === "passed" ? 0 : 1) + (Array.isArray(domainPackProductionHealthAudit.failed_checks) ? domainPackProductionHealthAudit.failed_checks.length : 0)',
    '  addGate(',
    '    "domain_pack_production_health_audit",',
    '    "Domain Pack production health smoke audit",',
    '    domainPackHealthBlockingCount ? "failed" : "passed",',
    '    domainPackHealthBlockingCount ? "Domain Pack production health is not passed or regressed during smoke." : "Domain Pack production health stayed passed across worker smoke.",',
    '    {',
    '      status: domainPackProductionHealthAudit.status,',
    '      before: { status: domainPackProductionHealthAudit.before?.status, issue_count: domainPackProductionHealthAudit.before?.issue_count, ready_pack_count: domainPackProductionHealthAudit.before?.ready_pack_count },',
    '      after: { status: domainPackProductionHealthAudit.after?.status, issue_count: domainPackProductionHealthAudit.after?.issue_count, ready_pack_count: domainPackProductionHealthAudit.after?.ready_pack_count },',
    '      deltas: domainPackProductionHealthAudit.deltas,',
    '      warning_checks: domainPackProductionHealthAudit.warning_checks || [],',
    '    },',
    '    actionsFrom(domainPackProductionHealthAudit),',
    '  )',
    '}',
    'const mvpStatusAudit = readJson("story-agent-mvp-status-audit.json")',
    'if (!mvpStatusAudit) {',
    '  addGate("story_agent_mvp_status_audit", "Story Agent MVP status smoke audit", "failed", "MVP status smoke audit did not run.", { filename: "story-agent-mvp-status-audit.json" }, [action("P0", "Story Agent smoke env", "Run MVP status before/after audit before signing off GEARS worker acceptance.", "missing_mvp_status_audit", [])])',
    '} else if (mvpStatusAudit.__parse_error) {',
    '  addGate("story_agent_mvp_status_audit", "Story Agent MVP status smoke audit", "failed", "MVP status smoke audit is not valid JSON.", { parse_error: mvpStatusAudit.__parse_error }, [action("P0", "Story Agent", "Regenerate a valid Story Agent MVP status smoke audit.", "mvp_status_audit_parse_error", ["story-agent-mvp-status-audit.json"])])',
    '} else {',
    '  const mvpBlockingCount = (mvpStatusAudit.status === "failed" ? 1 : 0) + (Array.isArray(mvpStatusAudit.failed_checks) ? mvpStatusAudit.failed_checks.length : 0)',
    '  const mvpGovernanceCounts = mvpGovernanceCountsFrom(mvpStatusAudit)',
    '  addGate(',
    '    "story_agent_mvp_status_audit",',
    '    "Story Agent MVP status smoke audit",',
    '    mvpBlockingCount ? "failed" : "passed",',
    '    mvpBlockingCount ? "Story Agent MVP status regressed during smoke." : "Story Agent MVP status did not regress across the worker smoke run.",',
    '    {',
    '      status: mvpStatusAudit.status,',
    '      before: { status: mvpStatusAudit.before?.status, score: mvpStatusAudit.before?.score, summary: mvpStatusAudit.before?.summary },',
    '      after: { status: mvpStatusAudit.after?.status, score: mvpStatusAudit.after?.score, summary: mvpStatusAudit.after?.summary },',
    '      deltas: mvpStatusAudit.deltas,',
    '      governance_counts: mvpGovernanceCounts,',
    '      warning_checks: mvpStatusAudit.warning_checks || [],',
    '    },',
    '    actionsFrom(mvpStatusAudit),',
    '  )',
    '}',
    'const pressureAudit = readJson("gears-large-project-response-audit.json")',
    'if (!pressureAudit) {',
    '  addGate("large_project_pressure_audit", "GEARS large project pressure audit", pressureRequired ? "failed" : "skipped", pressureRequired ? "Large project pressure audit did not run." : "Large project pressure submit was not required for this basic smoke run.", { pressure_required: pressureRequired }, pressureRequired ? [action("P0", "GEARS v2", "Run large project pressure audit after enabling GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1.", "missing_large_project_pressure_audit", [])] : [])',
    '} else if (pressureAudit.__parse_error) {',
    '  addGate("large_project_pressure_audit", "GEARS large project pressure audit", "failed", "Large project pressure audit is not valid JSON.", { parse_error: pressureAudit.__parse_error }, [action("P0", "Story Agent", "Regenerate a valid large project pressure response audit.", "large_pressure_audit_parse_error", ["gears-large-project-response-audit.json"])])',
    '} else {',
    '  const totals = pressureAudit.totals || {}',
    '  const pressureSubmitted = Boolean(totals.pressure_submitted)',
    '  const pressureSkipped = Boolean(totals.pressure_skipped)',
    '  const pressureBlockingCount = actionsFrom(pressureAudit).length',
    '    + (pressureRequired && !pressureSubmitted ? 1 : 0)',
    '    + (pressureSubmitted && numberValue(totals.request_unit_count) && numberValue(totals.source_echo_count) < numberValue(totals.request_unit_count) ? 1 : 0)',
    '    + numberValue(totals.missing_requested_source_count)',
    '    + numberValue(totals.duplicate_source_id_count)',
    '    + numberValue(totals.unexpected_source_count)',
    '    + numberValue(totals.unknown_count)',
    '  const status = pressureBlockingCount ? "failed" : pressureSubmitted ? "passed" : pressureSkipped && !pressureRequired ? "skipped" : pressureRequired ? "failed" : "skipped"',
    '  const summary = status === "passed"',
    '    ? "Large project pressure response reconciles every submitted source id."',
    '    : status === "skipped"',
    '      ? "Large project pressure submit was skipped for this basic smoke run."',
    '      : "Large project pressure response still has batch reconciliation blockers."',
    '  const recommendedActions = [...actionsFrom(pressureAudit)]',
    '  if (pressureRequired && !pressureSubmitted) recommendedActions.push(action("P0", "GEARS v2", "Submit the generated large project pressure payload when GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1.", "pressure_required_not_submitted", ["gears-large-project-submit-pressure.json"]))',
    '  addGate("large_project_pressure_audit", "GEARS large project pressure audit", status, summary, { totals, pressure_required: pressureRequired }, recommendedActions)',
    '}',
    'addGate(',
    '  "manifest",',
    '  "Evidence manifest",',
    '  exists("manifest.json") ? "passed" : "failed",',
    '  exists("manifest.json") ? "Evidence manifest exists." : "Evidence manifest is missing.",',
    '  { filename: "manifest.json" },',
    '  exists("manifest.json") ? [] : [action("P1", "Story Agent", "Write manifest.json before archiving worker acceptance evidence.", "missing_manifest", [])],',
    ')',
    'const failedGates = gates.filter(gate => gate.status === "failed")',
    'const skippedGates = gates.filter(gate => gate.status === "skipped")',
    'const pressureGate = gates.find(gate => gate.id === "large_project_pressure_audit")',
    'const mvpStatusGate = gates.find(gate => gate.id === "story_agent_mvp_status_audit")',
    'const mvpGovernanceEvidence = mvpStatusGate?.evidence?.governance_counts',
    'const acceptancePassed = failedGates.length === 0',
    'const status = acceptancePassed',
    '  ? pressureGate?.status === "passed" ? "passed" : "passed_basic"',
    '  : "failed"',
    'const recommendedActions = gates.flatMap(gate => (gate.recommended_actions || []).map(item => ({ ...item, gate_id: gate.id })))',
    'const verdict = {',
    '  schema_version: "gears-worker-acceptance-verdict/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  status,',
    '  acceptance_passed: acceptancePassed,',
    '  strict_exit_code: acceptancePassed ? 0 : 1,',
    '  pressure_required: pressureRequired,',
    '  pressure_submitted: pressureGate?.evidence?.totals?.pressure_submitted === true,',
    '  gate_counts: {',
    '    passed: gates.filter(gate => gate.status === "passed").length,',
    '    failed: failedGates.length,',
    '    skipped: skippedGates.length,',
    '    total: gates.length,',
    '  },',
    '  failed_gate_ids: failedGates.map(gate => gate.id),',
    '  skipped_gate_ids: skippedGates.map(gate => gate.id),',
    '  mvp_governance_counts: mvpGovernanceEvidence,',
    '  gates,',
    '  recommended_actions: recommendedActions,',
    '}',
    'const lines = [',
    '  "# GEARS Worker Acceptance Verdict",',
    '  "",',
    '  `> schema_version: ${verdict.schema_version}`,',
    '  `> generated_at: ${verdict.generated_at}`,',
    '  `> scanned_dir: ${verdict.scanned_dir}`,',
    '  "",',
    '  "## Summary",',
    '  "",',
    '  `- status: ${verdict.status}` ,',
    '  `- acceptance_passed: ${verdict.acceptance_passed}` ,',
    '  `- strict_exit_code: ${verdict.strict_exit_code}` ,',
    '  `- pressure_required: ${verdict.pressure_required}` ,',
    '  `- pressure_submitted: ${verdict.pressure_submitted}` ,',
    '  `- gates passed/failed/skipped/total: ${verdict.gate_counts.passed}/${verdict.gate_counts.failed}/${verdict.gate_counts.skipped}/${verdict.gate_counts.total}` ,',
    '  `- failed_gate_ids: ${verdict.failed_gate_ids.join(", ") || "none"}` ,',
    '  `- skipped_gate_ids: ${verdict.skipped_gate_ids.join(", ") || "none"}` ,',
    '  ...(verdict.mvp_governance_counts ? [',
    '    `- mvp_seedance_placeholder_before/after/delta: ${verdict.mvp_governance_counts.seedance_placeholder_asset_count.before}/${verdict.mvp_governance_counts.seedance_placeholder_asset_count.after}/${verdict.mvp_governance_counts.seedance_placeholder_asset_count.delta}` ,',
    '    `- mvp_seedance_production_ready_before/after/delta: ${verdict.mvp_governance_counts.seedance_production_asset_ready_count.before}/${verdict.mvp_governance_counts.seedance_production_asset_ready_count.after}/${verdict.mvp_governance_counts.seedance_production_asset_ready_count.delta}` ,',
    '    `- mvp_knowledge_writeback_ready_before/after/delta: ${verdict.mvp_governance_counts.knowledge_writeback_ready_count.before}/${verdict.mvp_governance_counts.knowledge_writeback_ready_count.after}/${verdict.mvp_governance_counts.knowledge_writeback_ready_count.delta}` ,',
    '    `- mvp_knowledge_writeback_queued_before/after/delta: ${verdict.mvp_governance_counts.knowledge_writeback_queued_count.before}/${verdict.mvp_governance_counts.knowledge_writeback_queued_count.after}/${verdict.mvp_governance_counts.knowledge_writeback_queued_count.delta}` ,',
    '    `- mvp_knowledge_writeback_needs_revision_before/after/delta: ${verdict.mvp_governance_counts.knowledge_writeback_needs_revision_count.before}/${verdict.mvp_governance_counts.knowledge_writeback_needs_revision_count.after}/${verdict.mvp_governance_counts.knowledge_writeback_needs_revision_count.delta}` ,',
    '  ] : []),',
    '  "",',
    '  "## Gates",',
    '  "",',
    '  ...verdict.gates.map(gate => `- ${gate.id}: ${gate.status} - ${gate.summary}`),',
    '  "",',
    '  "## Recommended Actions",',
    '  "",',
    '  ...(verdict.recommended_actions.length ? verdict.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence}; gate=${item.gate_id})`) : ["- none"]),',
    ']',
    'fs.writeFileSync(filePath(outputFilename), `${JSON.stringify(verdict, null, 2)}\\n`)',
    'fs.writeFileSync(filePath(markdownFilename), `${lines.join("\\n").trim()}\\n`)',
    'NODE',
  ].join('\n');
}

function renderWorkerAcceptanceArchiveCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const crypto = require("crypto")',
    'const dir = process.argv[2] || "."',
    'const outputFilename = "gears-worker-acceptance-archive.json"',
    'const markdownFilename = "gears-worker-acceptance-archive.md"',
    'const checksumJsonFilename = "gears-worker-acceptance-checksums.json"',
    'const checksumMarkdownFilename = "gears-worker-acceptance-checksums.md"',
    'function filePath(filename) { return path.join(dir, filename) }',
    'function exists(filename) { return fs.existsSync(filePath(filename)) }',
    'for (const generatedFilename of [outputFilename, markdownFilename, checksumJsonFilename, checksumMarkdownFilename]) {',
    '  try { if (exists(generatedFilename)) fs.unlinkSync(filePath(generatedFilename)) } catch {}',
    '}',
    'function readJson(filename) {',
    '  if (!exists(filename)) return undefined',
    '  try { return JSON.parse(fs.readFileSync(filePath(filename), "utf8")) }',
    '  catch (error) { return { __parse_error: error instanceof Error ? error.message : String(error) } }',
    '}',
    'function sha256(filename) {',
    '  return crypto.createHash("sha256").update(fs.readFileSync(filePath(filename))).digest("hex")',
    '}',
    'function fileRole(filename) {',
    '  if (filename === "manifest.json") return "manifest"',
    '  if (filename.includes("checksums")) return "checksum_manifest"',
    '  if (filename.includes("verdict")) return "verdict"',
    '  if (filename.includes("archive")) return "archive"',
    '  if (filename.includes("response-audit")) return "audit"',
    '  if (filename.includes("production-material-pack-health")) return "production_material_pack_health"',
    '  if (filename.includes("domain-pack-production-health")) return "domain_pack_production_health"',
    '  if (filename.includes("output-url-source")) return "artifact_source"',
    '  if (filename.includes("preflight")) return "preflight"',
    '  if (filename.includes("generated-health")) return "generated_health"',
    '  if (filename.includes("mvp-status")) return "mvp_status"',
    '  if (filename.includes("pressure")) return "pressure"',
    '  if (filename.includes("callback")) return "callback"',
    '  if (filename.includes("status-response")) return "status_poll"',
    '  if (filename.includes("submit-response") || filename.includes("submit-smoke")) return "submit"',
    '  if (filename.endsWith(".txt")) return "sidecar"',
    '  if (filename.endsWith(".md")) return "markdown"',
    '  return "evidence"',
    '}',
    'function actionsFrom(verdict) { return Array.isArray(verdict?.recommended_actions) ? verdict.recommended_actions : [] }',
    'function action(priority, owner, text, evidence, sampleFiles = []) {',
    '  return { priority, owner, action: text, evidence, sample_files: sampleFiles }',
    '}',
    'function numberValue(value) { return typeof value === "number" && Number.isFinite(value) ? value : 0 }',
    'function mvpGovernanceCountsFrom(audit) {',
    '  const beforeSummary = audit?.before?.summary || {}',
    '  const afterSummary = audit?.after?.summary || {}',
    '  const deltas = audit?.deltas || {}',
    '  function record(key) {',
    '    return {',
    '      before: numberValue(beforeSummary[key]),',
    '      after: numberValue(afterSummary[key]),',
    '      delta: numberValue(deltas[key]),',
    '    }',
    '  }',
    '  return {',
    '    seedance_placeholder_asset_count: record("seedance_placeholder_asset_count"),',
    '    seedance_production_asset_ready_count: record("seedance_production_asset_ready_count"),',
    '    knowledge_writeback_ready_count: record("knowledge_writeback_ready_count"),',
    '    knowledge_writeback_queued_count: record("knowledge_writeback_queued_count"),',
    '    knowledge_writeback_needs_revision_count: record("knowledge_writeback_needs_revision_count"),',
    '  }',
    '}',
    'const verdict = readJson("gears-worker-acceptance-verdict.json")',
    'const workerAudit = readJson("gears-worker-response-audit.json")',
    'const callbackAudit = readJson("story-agent-callback-response-audit.json")',
    'const systemExternalPreflight = readJson("story-agent-system-external-callback-preflight-response.json")',
    'const systemExternalImport = readJson("story-agent-system-external-callback-import-response.json")',
    'const generatedHealthAudit = readJson("story-agent-generated-health-audit.json")',
    'const mvpStatusAudit = readJson("story-agent-mvp-status-audit.json")',
    'const mvpGovernanceCounts = mvpStatusAudit && !mvpStatusAudit.__parse_error ? mvpGovernanceCountsFrom(mvpStatusAudit) : undefined',
    'const pressureAudit = readJson("gears-large-project-response-audit.json")',
    'const pressureSubmitted = Boolean(verdict?.pressure_submitted || pressureAudit?.totals?.pressure_submitted)',
    'const requiredAttachments = [',
    '  "manifest.json",',
    '  "env.template.sh",',
    '  "story-agent-smoke-targets.json",',
    '  "story-agent-smoke-env-selected.json",',
    '  "gears-submit-smoke.json",',
    '  "gears-submit-response.json",',
    '  "gears-worker-response-audit.json",',
    '  "gears-worker-response-audit.md",',
    '  "story-agent-generated-health-before.json",',
    '  "story-agent-generated-health-after.json",',
    '  "story-agent-generated-health-audit.json",',
    '  "story-agent-generated-health-audit.md",',
    '  "production-material-pack-health-before.json",',
    '  "production-material-pack-health-after.json",',
    '  "production-material-pack-health-audit.json",',
    '  "production-material-pack-health-audit.md",',
    '  "domain-pack-production-health-before.json",',
    '  "domain-pack-production-health-after.json",',
    '  "domain-pack-production-health-audit.json",',
    '  "domain-pack-production-health-audit.md",',
    '  "story-agent-mvp-status-before.json",',
    '  "story-agent-mvp-status-after.json",',
    '  "story-agent-mvp-status-audit.json",',
    '  "story-agent-mvp-status-audit.md",',
    '  "story-agent-callback-id-preflight.json",',
    '  "gears-system-external-callback-smoke.json",',
    '  "story-agent-system-external-output-url-source.json",',
    '  "story-agent-system-external-ledger-seed-selected.json",',
    '  "story-agent-system-external-callback-preflight-response.json",',
    '  "story-agent-system-external-callback-import-response.json",',
    '  "story-agent-callback-response-audit.json",',
    '  "story-agent-callback-response-audit.md",',
    '  "gears-large-project-submit-pressure.json",',
    '  "gears-large-project-pressure-summary.json",',
    '  "gears-large-project-response-audit.json",',
    '  "gears-large-project-response-audit.md",',
    '  "gears-worker-acceptance-verdict.json",',
    '  "gears-worker-acceptance-verdict.md",',
    ']',
    'if (pressureSubmitted) requiredAttachments.push("gears-large-project-submit-response.json")',
    'const missingRequiredFiles = requiredAttachments.filter(filename => !exists(filename))',
    'const files = fs.readdirSync(dir)',
    '  .filter(filename => {',
    '    try { return fs.statSync(filePath(filename)).isFile() } catch { return false }',
    '  })',
    '  .sort((a, b) => a.localeCompare(b))',
    '  .map(filename => {',
    '    const stat = fs.statSync(filePath(filename))',
    '    return {',
    '      filename,',
    '      role: fileRole(filename),',
    '      required: requiredAttachments.includes(filename),',
    '      byte_length: stat.size,',
    '      sha256: sha256(filename),',
    '    }',
    '  })',
    'const totals = {',
    '  evidence_file_count: files.length,',
    '  required_attachment_count: requiredAttachments.length,',
    '  missing_required_attachment_count: missingRequiredFiles.length,',
    '  total_bytes: files.reduce((sum, file) => sum + file.byte_length, 0),',
    '  json_file_count: files.filter(file => file.filename.endsWith(".json")).length,',
    '  markdown_file_count: files.filter(file => file.filename.endsWith(".md")).length,',
    '  sidecar_file_count: files.filter(file => file.role === "sidecar").length,',
    '  required_checksum_count: files.filter(file => file.required && file.sha256).length,',
    '}',
    'const verdictParseFailed = Boolean(verdict?.__parse_error)',
    'const acceptancePassed = Boolean(verdict?.acceptance_passed)',
    'const signoffReady = acceptancePassed && !missingRequiredFiles.length && !verdictParseFailed',
    'const recommendedActions = [',
    '  ...actionsFrom(verdict),',
    '  ...missingRequiredFiles.map(filename => action("P0", "Story Agent smoke archive", `Attach missing required evidence file ${filename}.`, "missing_required_attachment", [filename])),',
    ']',
    'if (!verdict) recommendedActions.push(action("P0", "Story Agent smoke archive", "Generate gears-worker-acceptance-verdict.json before archiving evidence.", "missing_verdict", ["gears-worker-acceptance-verdict.json"]))',
    'if (verdictParseFailed) recommendedActions.push(action("P0", "Story Agent smoke archive", "Regenerate valid JSON for gears-worker-acceptance-verdict.json.", "verdict_parse_error", ["gears-worker-acceptance-verdict.json"]))',
    'const generatedAt = new Date().toISOString()',
    'const checksumManifest = {',
    '  schema_version: "gears-worker-acceptance-checksum-manifest/v1",',
    '  generated_at: generatedAt,',
    '  scanned_dir: dir,',
    '  algorithm: "sha256",',
    '  file_count: files.length,',
    '  required_file_count: files.filter(file => file.required).length,',
    '  records: files.map(file => ({',
    '    filename: file.filename,',
    '    role: file.role,',
    '    required: file.required,',
    '    byte_length: file.byte_length,',
    '    sha256: file.sha256,',
    '  })),',
    '}',
    'const archive = {',
    '  schema_version: "gears-worker-acceptance-archive/v1",',
    '  generated_at: generatedAt,',
    '  scanned_dir: dir,',
    '  status: signoffReady ? "signoff_ready" : acceptancePassed ? "incomplete_archive" : "blocked",',
    '  signoff_ready: signoffReady,',
    '  pressure_submitted: pressureSubmitted,',
    '  verdict_summary: verdict && !verdict.__parse_error ? {',
    '    status: verdict.status,',
    '    acceptance_passed: verdict.acceptance_passed,',
    '    failed_gate_ids: verdict.failed_gate_ids || [],',
    '    skipped_gate_ids: verdict.skipped_gate_ids || [],',
    '    gate_counts: verdict.gate_counts,',
    '    recommended_action_count: actionsFrom(verdict).length,',
    '  } : undefined,',
    '  audit_summaries: {',
    '    worker: workerAudit?.totals,',
    '    story_agent_callback: callbackAudit?.totals,',
    '    system_external_callback: {',
    '      preflight: systemExternalPreflight && !systemExternalPreflight.__parse_error ? {',
    '        ok: Object.prototype.hasOwnProperty.call(systemExternalPreflight, "ok") ? systemExternalPreflight.ok : undefined,',
    '        blocked: (systemExternalPreflight.data || systemExternalPreflight)?.blocked,',
    '        ready_to_import_count: (systemExternalPreflight.data || systemExternalPreflight)?.ready_to_import_count,',
    '        blocking_count: (systemExternalPreflight.data || systemExternalPreflight)?.blocking_count,',
    '        unresolved_count: (systemExternalPreflight.data || systemExternalPreflight)?.unresolved_count,',
    '      } : undefined,',
    '      import: systemExternalImport && !systemExternalImport.__parse_error ? {',
    '        ok: Object.prototype.hasOwnProperty.call(systemExternalImport, "ok") ? systemExternalImport.ok : undefined,',
    '        blocked: (systemExternalImport.data || systemExternalImport)?.blocked,',
    '        updated_count: (systemExternalImport.data || systemExternalImport)?.updated_count,',
    '        failed_count: (systemExternalImport.data || systemExternalImport)?.failed_count,',
    '        blocking_count: (systemExternalImport.data || systemExternalImport)?.blocking_count,',
    '        unresolved_count: (systemExternalImport.data || systemExternalImport)?.unresolved_count,',
    '      } : undefined,',
    '    },',
    '    story_agent_generated_health: generatedHealthAudit && !generatedHealthAudit.__parse_error ? {',
    '      status: generatedHealthAudit.status,',
    '      before_summary: generatedHealthAudit.before?.summary,',
    '      after_summary: generatedHealthAudit.after?.summary,',
    '      deltas: generatedHealthAudit.deltas,',
    '    } : undefined,',
    '    story_agent_mvp_status: mvpStatusAudit && !mvpStatusAudit.__parse_error ? {',
    '      status: mvpStatusAudit.status,',
    '      before: { status: mvpStatusAudit.before?.status, score: mvpStatusAudit.before?.score, summary: mvpStatusAudit.before?.summary },',
    '      after: { status: mvpStatusAudit.after?.status, score: mvpStatusAudit.after?.score, summary: mvpStatusAudit.after?.summary },',
    '      deltas: mvpStatusAudit.deltas,',
    '      governance_counts: mvpGovernanceCounts,',
    '      failed_checks: mvpStatusAudit.failed_checks || [],',
    '      warning_checks: mvpStatusAudit.warning_checks || [],',
    '    } : undefined,',
    '    large_project_pressure: pressureAudit?.totals,',
    '  },',
    '  totals,',
    '  checksum_manifest: {',
    '    json_filename: checksumJsonFilename,',
    '    markdown_filename: checksumMarkdownFilename,',
    '    schema_version: checksumManifest.schema_version,',
    '    algorithm: checksumManifest.algorithm,',
    '    file_count: checksumManifest.file_count,',
    '    required_file_count: checksumManifest.required_file_count,',
    '  },',
    '  required_attachments: requiredAttachments,',
    '  missing_required_files: missingRequiredFiles,',
    '  files,',
    '  recommended_actions: recommendedActions,',
    '}',
    'function renderMarkdown(archive) {',
    '  const requiredFiles = archive.files.filter(file => file.required)',
    '  const mvpCounts = archive.audit_summaries?.story_agent_mvp_status?.governance_counts',
    '  const lines = [',
    '    "# GEARS Worker Acceptance Archive",',
    '    "",',
    '    `> schema_version: ${archive.schema_version}`,',
    '    `> generated_at: ${archive.generated_at}`,',
    '    `> scanned_dir: ${archive.scanned_dir}`,',
    '    "",',
    '    "## Summary",',
    '    "",',
    '    `- status: ${archive.status}` ,',
    '    `- signoff_ready: ${archive.signoff_ready}` ,',
    '    `- pressure_submitted: ${archive.pressure_submitted}` ,',
    '    `- verdict_status: ${archive.verdict_summary?.status || "missing"}` ,',
    '    `- acceptance_passed: ${archive.verdict_summary?.acceptance_passed ?? false}` ,',
    '    `- failed_gate_ids: ${(archive.verdict_summary?.failed_gate_ids || []).join(", ") || "none"}` ,',
    '    `- evidence files: ${archive.totals.evidence_file_count}` ,',
    '    `- required attachments missing: ${archive.totals.missing_required_attachment_count}/${archive.totals.required_attachment_count}` ,',
    '    `- required checksum count: ${archive.totals.required_checksum_count}` ,',
    '    `- checksum_manifest: ${archive.checksum_manifest.json_filename}` ,',
    '    `- total_bytes: ${archive.totals.total_bytes}` ,',
    '    ...(mvpCounts ? [',
    '      `- mvp_seedance_placeholder_before/after/delta: ${mvpCounts.seedance_placeholder_asset_count.before}/${mvpCounts.seedance_placeholder_asset_count.after}/${mvpCounts.seedance_placeholder_asset_count.delta}` ,',
    '      `- mvp_seedance_production_ready_before/after/delta: ${mvpCounts.seedance_production_asset_ready_count.before}/${mvpCounts.seedance_production_asset_ready_count.after}/${mvpCounts.seedance_production_asset_ready_count.delta}` ,',
    '      `- mvp_knowledge_writeback_ready_before/after/delta: ${mvpCounts.knowledge_writeback_ready_count.before}/${mvpCounts.knowledge_writeback_ready_count.after}/${mvpCounts.knowledge_writeback_ready_count.delta}` ,',
    '      `- mvp_knowledge_writeback_queued_before/after/delta: ${mvpCounts.knowledge_writeback_queued_count.before}/${mvpCounts.knowledge_writeback_queued_count.after}/${mvpCounts.knowledge_writeback_queued_count.delta}` ,',
    '      `- mvp_knowledge_writeback_needs_revision_before/after/delta: ${mvpCounts.knowledge_writeback_needs_revision_count.before}/${mvpCounts.knowledge_writeback_needs_revision_count.after}/${mvpCounts.knowledge_writeback_needs_revision_count.delta}` ,',
    '    ] : []),',
    '    "",',
    '    "## Missing Required Files",',
    '    "",',
    '    ...(archive.missing_required_files.length ? archive.missing_required_files.map(filename => `- ${filename}`) : ["- none"]),',
    '    "",',
    '    "## Required Attachment Checksums",',
    '    "",',
    '    ...(requiredFiles.length ? requiredFiles.map(file => `- ${file.filename} · ${file.byte_length} bytes · sha256=${file.sha256}`) : ["- none"]),',
    '    "",',
    '    "## Checksum Manifest",',
    '    "",',
    '    `- json: ${archive.checksum_manifest.json_filename}` ,',
    '    `- markdown: ${archive.checksum_manifest.markdown_filename}` ,',
    '    `- algorithm: ${archive.checksum_manifest.algorithm}` ,',
    '    `- file_count: ${archive.checksum_manifest.file_count}` ,',
    '    "",',
    '    "## Recommended Actions",',
    '    "",',
    '    ...(archive.recommended_actions.length ? archive.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence})`) : ["- none"]),',
    '    "",',
    '    "## File Inventory",',
    '    "",',
    '    ...archive.files.map(file => `- ${file.filename} · ${file.role} · ${file.byte_length} bytes · required=${file.required}`),',
    '  ]',
    '  return `${lines.join("\\n").trim()}\\n`',
    '}',
    'function renderChecksumMarkdown(manifest) {',
    '  const lines = [',
    '    "# GEARS Worker Acceptance Checksums",',
    '    "",',
    '    `> schema_version: ${manifest.schema_version}`,',
    '    `> generated_at: ${manifest.generated_at}`,',
    '    `> scanned_dir: ${manifest.scanned_dir}`,',
    '    "",',
    '    "## Summary",',
    '    "",',
    '    `- algorithm: ${manifest.algorithm}` ,',
    '    `- file_count: ${manifest.file_count}` ,',
    '    `- required_file_count: ${manifest.required_file_count}` ,',
    '    "",',
    '    "## Records",',
    '    "",',
    '    ...(manifest.records.length ? manifest.records.map(record => `- ${record.sha256}  ${record.filename} (${record.byte_length} bytes, required=${record.required}, role=${record.role})`) : ["- none"]),',
    '  ]',
    '  return `${lines.join("\\n").trim()}\\n`',
    '}',
    'fs.writeFileSync(filePath(checksumJsonFilename), `${JSON.stringify(checksumManifest, null, 2)}\\n`)',
    'fs.writeFileSync(filePath(checksumMarkdownFilename), renderChecksumMarkdown(checksumManifest))',
    'fs.writeFileSync(filePath(outputFilename), `${JSON.stringify(archive, null, 2)}\\n`)',
    'fs.writeFileSync(filePath(markdownFilename), renderMarkdown(archive))',
    'NODE',
  ].join('\n');
}

function renderWorkerAcceptanceIntegrityCommand(targetDirExpression: string): string {
  return [
    `node - ${targetDirExpression} <<'NODE'`,
    'const fs = require("fs")',
    'const path = require("path")',
    'const crypto = require("crypto")',
    'const dir = process.argv[2] || "."',
    'const outputFilename = "gears-worker-acceptance-integrity.json"',
    'const markdownFilename = "gears-worker-acceptance-integrity.md"',
    'function filePath(filename) { return path.join(dir, filename) }',
    'function exists(filename) { return fs.existsSync(filePath(filename)) }',
    'for (const generatedFilename of [outputFilename, markdownFilename]) {',
    '  try { if (exists(generatedFilename)) fs.unlinkSync(filePath(generatedFilename)) } catch {}',
    '}',
    'function readJson(filename) {',
    '  if (!exists(filename)) return undefined',
    '  try { return JSON.parse(fs.readFileSync(filePath(filename), "utf8")) }',
    '  catch (error) { return { __parse_error: error instanceof Error ? error.message : String(error) } }',
    '}',
    'function sha256(filename) {',
    '  return crypto.createHash("sha256").update(fs.readFileSync(filePath(filename))).digest("hex")',
    '}',
    'function action(priority, owner, text, evidence, sampleFiles = []) {',
    '  return { priority, owner, action: text, evidence, sample_files: sampleFiles }',
    '}',
    'const archiveFilename = "gears-worker-acceptance-archive.json"',
    'const archiveMarkdownFilename = "gears-worker-acceptance-archive.md"',
    'const checksumFilename = "gears-worker-acceptance-checksums.json"',
    'const checksumMarkdownFilename = "gears-worker-acceptance-checksums.md"',
    'const archive = readJson(archiveFilename)',
    'const checksums = readJson(checksumFilename)',
    'const mismatches = []',
    'const recommendedActions = []',
    'function addMismatch(filename, problem, expected, actual) {',
    '  mismatches.push({ filename, problem, expected, actual })',
    '}',
    'if (!archive) recommendedActions.push(action("P0", "Story Agent smoke integrity", "Generate gears-worker-acceptance-archive.json before integrity verification.", "missing_archive", [archiveFilename]))',
    'if (archive?.__parse_error) recommendedActions.push(action("P0", "Story Agent smoke integrity", "Regenerate valid JSON for gears-worker-acceptance-archive.json.", "archive_parse_error", [archiveFilename]))',
    'if (!checksums) recommendedActions.push(action("P0", "Story Agent smoke integrity", "Generate gears-worker-acceptance-checksums.json before integrity verification.", "missing_checksum_manifest", [checksumFilename]))',
    'if (checksums?.__parse_error) recommendedActions.push(action("P0", "Story Agent smoke integrity", "Regenerate valid JSON for gears-worker-acceptance-checksums.json.", "checksum_manifest_parse_error", [checksumFilename]))',
    'for (const filename of [archiveFilename, archiveMarkdownFilename, checksumFilename, checksumMarkdownFilename]) {',
    '  if (!exists(filename)) addMismatch(filename, "missing_generated_handoff_file", "exists", "missing")',
    '}',
    'const records = Array.isArray(checksums?.records) ? checksums.records : []',
    'const requiredAttachments = Array.isArray(archive?.required_attachments) ? archive.required_attachments : []',
    'const recordByFilename = new Map(records.map(record => [record.filename, record]))',
    'for (const filename of requiredAttachments) {',
    '  if (!recordByFilename.has(filename)) addMismatch(filename, "required_attachment_missing_checksum_record", "checksum record", "missing")',
    '}',
    'for (const record of records) {',
    '  const filename = record?.filename',
    '  if (typeof filename !== "string" || !filename.trim()) {',
    '    addMismatch("", "invalid_checksum_record_filename", "non-empty filename", filename)',
    '    continue',
    '  }',
    '  if (!exists(filename)) {',
    '    addMismatch(filename, "missing_file", "exists", "missing")',
    '    continue',
    '  }',
    '  const stat = fs.statSync(filePath(filename))',
    '  if (record.byte_length !== stat.size) addMismatch(filename, "byte_length_mismatch", record.byte_length, stat.size)',
    '  const actualSha = sha256(filename)',
    '  if (record.sha256 !== actualSha) addMismatch(filename, "sha256_mismatch", record.sha256, actualSha)',
    '}',
    'const archiveSignoffReady = Boolean(archive?.signoff_ready)',
    'if (archive && !archive.__parse_error && !archiveSignoffReady) {',
    '  recommendedActions.push(action("P0", "Story Agent smoke integrity", "Fix archive blockers until signoff_ready=true before handoff.", "archive_not_signoff_ready", [archiveFilename]))',
    '}',
    'if (mismatches.length) {',
    '  recommendedActions.push(action("P0", "Story Agent smoke integrity", "Regenerate or reattach evidence files until checksum integrity has zero mismatches.", "checksum_integrity_mismatch", mismatches.slice(0, 10).map(item => item.filename).filter(Boolean)))',
    '}',
    'const parseBlocked = Boolean(archive?.__parse_error || checksums?.__parse_error || !archive || !checksums)',
    'const integrityPassed = !parseBlocked && archiveSignoffReady && mismatches.length === 0',
    'const integrity = {',
    '  schema_version: "gears-worker-acceptance-integrity/v1",',
    '  generated_at: new Date().toISOString(),',
    '  scanned_dir: dir,',
    '  status: integrityPassed ? "passed" : "failed",',
    '  integrity_passed: integrityPassed,',
    '  archive_signoff_ready: archiveSignoffReady,',
    '  checksum_manifest: checksums && !checksums.__parse_error ? {',
    '    schema_version: checksums.schema_version,',
    '    algorithm: checksums.algorithm,',
    '    file_count: checksums.file_count,',
    '    required_file_count: checksums.required_file_count,',
    '    record_count: records.length,',
    '  } : undefined,',
    '  totals: {',
    '    record_count: records.length,',
    '    required_attachment_count: requiredAttachments.length,',
    '    required_checksum_record_count: requiredAttachments.filter(filename => recordByFilename.has(filename)).length,',
    '    mismatch_count: mismatches.length,',
    '    missing_file_count: mismatches.filter(item => item.problem === "missing_file" || item.problem === "missing_generated_handoff_file").length,',
    '    byte_length_mismatch_count: mismatches.filter(item => item.problem === "byte_length_mismatch").length,',
    '    sha256_mismatch_count: mismatches.filter(item => item.problem === "sha256_mismatch").length,',
    '    required_attachment_missing_checksum_record_count: mismatches.filter(item => item.problem === "required_attachment_missing_checksum_record").length,',
    '  },',
    '  mismatches,',
    '  recommended_actions: recommendedActions,',
    '}',
    'const lines = [',
    '  "# GEARS Worker Acceptance Integrity",',
    '  "",',
    '  `> schema_version: ${integrity.schema_version}`,',
    '  `> generated_at: ${integrity.generated_at}`,',
    '  `> scanned_dir: ${integrity.scanned_dir}`,',
    '  "",',
    '  "## Summary",',
    '  "",',
    '  `- status: ${integrity.status}` ,',
    '  `- integrity_passed: ${integrity.integrity_passed}` ,',
    '  `- archive_signoff_ready: ${integrity.archive_signoff_ready}` ,',
    '  `- checksum_algorithm: ${integrity.checksum_manifest?.algorithm || "missing"}` ,',
    '  `- records: ${integrity.totals.record_count}` ,',
    '  `- required checksum records: ${integrity.totals.required_checksum_record_count}/${integrity.totals.required_attachment_count}` ,',
    '  `- mismatches: ${integrity.totals.mismatch_count}` ,',
    '  `- missing files: ${integrity.totals.missing_file_count}` ,',
    '  `- sha256 mismatches: ${integrity.totals.sha256_mismatch_count}` ,',
    '  "",',
    '  "## Mismatches",',
    '  "",',
    '  ...(integrity.mismatches.length ? integrity.mismatches.map(item => `- ${item.filename || "(invalid record)"}: ${item.problem} expected=${item.expected ?? "n/a"} actual=${item.actual ?? "n/a"}`) : ["- none"]),',
    '  "",',
    '  "## Recommended Actions",',
    '  "",',
    '  ...(integrity.recommended_actions.length ? integrity.recommended_actions.map(item => `- [${item.priority}] ${item.owner}: ${item.action} (${item.evidence})`) : ["- none"]),',
    ']',
    'fs.writeFileSync(filePath(outputFilename), `${JSON.stringify(integrity, null, 2)}\\n`)',
    'fs.writeFileSync(filePath(markdownFilename), `${lines.join("\\n").trim()}\\n`)',
    'NODE',
  ].join('\n');
}

function renderGearsExecutionWorkerAcceptanceShellScript(
  kit: Omit<GearsExecutionWorkerAcceptanceKit, 'markdown' | 'shell_script'>,
): string {
  const payloadFiles = kit.payloads.flatMap(payload => [
    `cat > "$EVIDENCE_DIR/${payload.filename}" <<'JSON'`,
    JSON.stringify(payload.content, null, 2),
    'JSON',
    '',
  ]);
  const lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    '# GEARS v2 worker acceptance smoke script generated by china-culture-kb.',
    '# Fill required env vars before running. All responses are saved under $EVIDENCE_DIR.',
    '',
    ': "${STORY_AGENT_BASE_URL:=http://localhost:3000}"',
    ': "${GEARS_EVIDENCE_DIR:=gears-worker-evidence-$(date -u +%Y%m%dT%H%M%SZ)}"',
    ': "${GEARS_ACCEPTANCE_AUTO_EXTRACT_JOB_ID:=1}"',
    ': "${GEARS_ACCEPTANCE_REPLAY_CALLBACKS:=1}"',
    ': "${GEARS_ACCEPTANCE_RUN_LIVE_SMOKE:=1}"',
    ': "${GEARS_ACCEPTANCE_FETCH_POST_AUDIT:=1}"',
    ': "${GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE:=0}"',
    ': "${GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER:=0}"',
    ': "${GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE:=}"',
    ': "${GEARS_ACCEPTANCE_STRICT_AUDIT:=1}"',
    ': "${GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS:=1}"',
    ': "${GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS:=5}"',
    `: "\${GEARS_LARGE_PRESSURE_EPISODE_COUNT:=${GEARS_WORKER_PRESSURE_DEFAULT_EPISODE_COUNT}}"`,
    `: "\${GEARS_LARGE_PRESSURE_SHOTS_PER_EPISODE:=${GEARS_WORKER_PRESSURE_DEFAULT_SHOTS_PER_EPISODE}}"`,
    'EVIDENCE_DIR="$GEARS_EVIDENCE_DIR"',
    'mkdir -p "$EVIDENCE_DIR"',
    'case "$GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS" in ""|*[!0-9]*) GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS=1 ;; esac',
    'case "$GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS" in ""|*[!0-9]*) GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS=5 ;; esac',
    'if [ "$GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS" -lt 1 ]; then GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS=1; fi',
    '',
    'write_manifest() {',
    `  cat > "$EVIDENCE_DIR/manifest.json" <<'JSON'`,
    '{',
    '  "schema_version": "gears-worker-acceptance-evidence-manifest/v1",',
    '  "notes": [',
    '    "Responses in this directory are raw smoke evidence from GEARS worker acceptance.",',
    '    "story-agent-callback-id-preflight.json and story-agent-callback-id-preflight.md warn when smoke callback project ids will fail Story Agent route validation.",',
    '    "gears-worker-response-audit.json and gears-worker-response-audit.md summarize observed worker response fields, statuses, ids, artifacts, and failure context.",',
    '    "gears-large-project-response-audit.json and gears-large-project-response-audit.md reconcile large pressure request units with worker response records.",',
    '    "story-agent-callback-response-audit.json and story-agent-callback-response-audit.md summarize Story Agent callback/live-smoke writeback responses.",',
    '    "gears-worker-acceptance-verdict.json and gears-worker-acceptance-verdict.md combine all audits into a machine-readable pass/fail gate.",',
    '    "gears-worker-acceptance-archive.json and gears-worker-acceptance-archive.md inventory required evidence files and sha256 checksums for handoff.",',
    '    "gears-worker-acceptance-checksums.json and gears-worker-acceptance-checksums.md provide a standalone sha256 manifest for every archived evidence file.",',
    '    "gears-worker-acceptance-integrity.json and gears-worker-acceptance-integrity.md recompute sha256 values and verify archive handoff integrity.",',
    '    "story-agent-mvp-status-before.json, story-agent-mvp-status-after.json, and story-agent-mvp-status-audit.json prove Story Agent MVP status did not regress during worker smoke.",',
    '    "gears-worker-evidence-signoff.json and gears-worker-evidence-signoff.md are post-archive signoff snapshots generated from the Story Agent signoff API.",',
    '    "gears-worker-response-audit recommended_actions lists machine-readable follow-up items for GEARS/Story Agent contract alignment.",',
    '    "Replay response files should report duplicate_count when Story Agent receives duplicate callbacks.",',
    '    "Post-run audits should be attached to the GEARS v2 worker handoff record."',
    '  ]',
    '}',
    'JSON',
    '}',
    '',
    'is_placeholder() {',
    '  case "${1:-}" in',
    '    ""|"<"*">"|"https://gears.example.test"|"https://story-agent.example.test") return 0 ;;',
    '    *) return 1 ;;',
    '  esac',
    '}',
    '',
    'require_env() {',
    '  local name="$1"',
    '  local value="${!name:-}"',
    '  if is_placeholder "$value"; then',
    '    echo "Missing required env: $name" >&2',
    '    exit 2',
    '  fi',
    '}',
    '',
    'print_json_summary() {',
    '  local file="$1"',
    '  local label="$2"',
    '  if command -v node >/dev/null 2>&1; then',
    '    node - "$file" "$label" <<\'NODE\'',
    'const fs = require("fs")',
    'const file = process.argv[2]',
    'const label = process.argv[3]',
    'try {',
    '  const root = JSON.parse(fs.readFileSync(file, "utf8"))',
    '  const data = root && typeof root === "object" && root.data && typeof root.data === "object" ? root.data : root',
    '  const parts = []',
    '  if (Object.prototype.hasOwnProperty.call(root, "ok")) parts.push(`ok=${root.ok}`)',
    '  for (const key of ["status", "readiness_status", "schema_version", "command_count", "payload_count", "acceptance_passed", "strict_exit_code", "signoff_ready", "integrity_passed", "system_external_callback_passed", "system_external_callback_ready_to_import_count", "system_external_callback_updated_count"]) {',
    '    if (data && data[key] !== undefined) parts.push(`${key}=${data[key]}`)',
    '  }',
    '  const totals = data?.totals || root?.totals',
    '  if (totals && typeof totals === "object") {',
    '    for (const key of ["file_count", "record_count", "accepted_count", "rejected_count", "failed_count", "unknown_count", "transport_error_count", "http_error_count", "ok_false_count", "validation_error_count", "auth_error_count", "not_found_count", "blocked_count", "ledger_match_missing_count", "warning_count", "missing_required_attachment_count", "mismatch_count", "sha256_mismatch_count"]) {',
    '      if (totals[key] !== undefined) parts.push(`${key}=${totals[key]}`)',
    '    }',
    '  }',
    '  if (root && root.warning_count !== undefined) parts.push(`warning_count=${root.warning_count}`)',
    '  const actions = Array.isArray(data?.recommended_actions) ? data.recommended_actions : Array.isArray(root?.recommended_actions) ? root.recommended_actions : []',
    '  if (actions.length) parts.push(`recommended_actions=${actions.length}`)',
    '  if (Array.isArray(data?.documents)) parts.push(`documents=${data.documents.length}`)',
    '  if (Array.isArray(data?.blocking_check_ids)) parts.push(`blocking=${data.blocking_check_ids.length}`)',
    '  console.log(`${label}: ${parts.length ? parts.join(" ") : "saved"}`)',
    '} catch (error) {',
    '  console.log(`${label}: saved to ${file}`)',
    '}',
    'NODE',
    '  else',
    '    echo "$label: saved to $file"',
    '  fi',
    '}',
    '',
    'print_signoff_next_steps() {',
    '  echo "GEARS worker acceptance evidence saved to: $EVIDENCE_DIR"',
    '  local encoded_evidence_dir="$EVIDENCE_DIR"',
    '  if command -v node >/dev/null 2>&1; then',
    '    encoded_evidence_dir="$(node - "$EVIDENCE_DIR" <<\'NODE\'',
    'const value = process.argv[2] || ""',
    'process.stdout.write(encodeURIComponent(value))',
    'NODE',
    ')"',
    '  fi',
    '  echo "GEARS worker evidence signoff URL: $STORY_AGENT_BASE_URL/api/system/gears-execution-worker-evidence-signoff?evidence_dir=$encoded_evidence_dir"',
    '  echo "GEARS worker evidence latest signoff URL: $STORY_AGENT_BASE_URL/api/system/gears-execution-worker-evidence-signoff"',
    '  echo "MCP signoff tool: kb_get_gears_worker_evidence_signoff evidence_dir=$EVIDENCE_DIR"',
    '}',
    '',
    'write_worker_evidence_signoff_snapshot() {',
    '  echo "Writing GEARS worker evidence signoff snapshot..."',
    '  local encoded_evidence_dir="$EVIDENCE_DIR"',
    '  if command -v node >/dev/null 2>&1; then',
    '    encoded_evidence_dir="$(node - "$EVIDENCE_DIR" <<\'NODE\'',
    'const value = process.argv[2] || ""',
    'process.stdout.write(encodeURIComponent(value))',
    'NODE',
    ')"',
    '  fi',
    '  local signoff_http_status',
    '  local signoff_exit_code',
    '  set +e',
    '  signoff_http_status="$(curl -sS -w "%{http_code}" -o "$EVIDENCE_DIR/gears-worker-evidence-signoff.json" "$STORY_AGENT_BASE_URL/api/system/gears-execution-worker-evidence-signoff?evidence_dir=$encoded_evidence_dir")"',
    '  signoff_exit_code=$?',
    '  set -e',
    '  record_http_metadata "$EVIDENCE_DIR/gears-worker-evidence-signoff.json" "$signoff_http_status" "$signoff_exit_code"',
    '  if [ "$signoff_exit_code" -ne 0 ]; then',
    '    echo "GEARS worker evidence signoff snapshot fetch failed with curl exit $signoff_exit_code." | tee "$EVIDENCE_DIR/gears-worker-evidence-signoff-failed.txt"',
    '    return 0',
    '  fi',
    '  if ! is_success_http_status "$signoff_http_status"; then',
    '    echo "GEARS worker evidence signoff snapshot returned HTTP $signoff_http_status." | tee "$EVIDENCE_DIR/gears-worker-evidence-signoff-http-failed.txt"',
    '    return 0',
    '  fi',
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-evidence-signoff.json" "GEARS worker evidence signoff snapshot"',
    '  if command -v node >/dev/null 2>&1; then',
    '    node - "$EVIDENCE_DIR/gears-worker-evidence-signoff.json" "$EVIDENCE_DIR/gears-worker-evidence-signoff.md" <<\'NODE\'',
    'const fs = require("fs")',
    'const inputFile = process.argv[2]',
    'const outputFile = process.argv[3]',
    'let markdown = ""',
    'try {',
    '  const root = JSON.parse(fs.readFileSync(inputFile, "utf8"))',
    '  const data = root && typeof root === "object" && root.data && typeof root.data === "object" ? root.data : root',
    '  if (typeof data?.markdown === "string" && data.markdown.trim()) markdown = data.markdown',
    '} catch {}',
    'if (!markdown) markdown = "# GEARS Worker Evidence Signoff\\n\\nSignoff response did not include markdown. Inspect gears-worker-evidence-signoff.json.\\n"',
    'fs.writeFileSync(outputFile, markdown.endsWith("\\n") ? markdown : `${markdown}\\n`)',
    'NODE',
    '  else',
    '    echo "# GEARS Worker Evidence Signoff" > "$EVIDENCE_DIR/gears-worker-evidence-signoff.md"',
    '    echo "" >> "$EVIDENCE_DIR/gears-worker-evidence-signoff.md"',
    '    echo "Node is unavailable; inspect gears-worker-evidence-signoff.json." >> "$EVIDENCE_DIR/gears-worker-evidence-signoff.md"',
    '  fi',
    '}',
    '',
    'record_http_metadata() {',
    '  local body_file="$1"',
    '  local http_status="${2:-}"',
    '  local curl_exit_code="${3:-}"',
    '  local base="${body_file%.json}"',
    '  [ -f "$body_file" ] || : > "$body_file"',
    '  printf "%s\\n" "${http_status:-000}" > "$base-http-status.txt"',
    '  printf "%s\\n" "${curl_exit_code:-1}" > "$base-curl-exit-code.txt"',
    '}',
    '',
    'is_success_http_status() {',
    '  case "${1:-}" in',
    '    2??) return 0 ;;',
    '    *) return 1 ;;',
    '  esac',
    '}',
    '',
    'post_json_capture() {',
    '  local label="$1"',
    '  local url="$2"',
    '  local body_file="$3"',
    '  local output_file="$4"',
    '  local bearer_token="${5:-}"',
    '  local http_status',
    '  local curl_exit_code',
    '  set +e',
    '  if [ -n "$bearer_token" ]; then',
    '    http_status="$(curl -sS -w "%{http_code}" -o "$output_file" -X POST "$url" \\',
    '      -H "content-type: application/json" \\',
    '      -H "authorization: Bearer $bearer_token" \\',
    '      --data-binary @"$body_file")"',
    '    curl_exit_code=$?',
    '  else',
    '    http_status="$(curl -sS -w "%{http_code}" -o "$output_file" -X POST "$url" \\',
    '      -H "content-type: application/json" \\',
    '      --data-binary @"$body_file")"',
    '    curl_exit_code=$?',
    '  fi',
    '  set -e',
    '  record_http_metadata "$output_file" "$http_status" "$curl_exit_code"',
    '  cat "$output_file"',
    '  if [ "$curl_exit_code" -ne 0 ]; then',
    '    echo "$label transport failed with curl exit $curl_exit_code." | tee "${output_file%.json}-failed.txt"',
    '  elif ! is_success_http_status "$http_status"; then',
    '    echo "$label returned HTTP $http_status." | tee "${output_file%.json}-http-failed.txt"',
    '  fi',
    '}',
    '',
    'read_smoke_target_env() {',
    '  local name="$1"',
    '  local targets_file="$EVIDENCE_DIR/story-agent-smoke-targets.json"',
    '  if ! command -v node >/dev/null 2>&1 || [ ! -f "$targets_file" ]; then',
    '    return 0',
    '  fi',
    '  node - "$targets_file" "$name" <<\'NODE\'',
    'const fs = require("fs")',
    'const file = process.argv[2]',
    'const name = process.argv[3]',
    'try {',
    '  const root = JSON.parse(fs.readFileSync(file, "utf8"))',
    '  const value = root?.recommended_env?.[name]',
    '  if (typeof value === "string" && value.trim()) process.stdout.write(value.trim())',
    '} catch {}',
    'NODE',
    '}',
    '',
    'auto_fill_smoke_target_envs() {',
    '  local value',
    '  if is_placeholder "${GEARS_SMOKE_PROJECT_ID:-}"; then',
    '    value="$(read_smoke_target_env GEARS_SMOKE_PROJECT_ID || true)"',
    '    if [ -n "$value" ]; then export GEARS_SMOKE_PROJECT_ID="$value"; fi',
    '  fi',
    '  if is_placeholder "${GEARS_SMOKE_STORY_ID:-}"; then',
    '    value="$(read_smoke_target_env GEARS_SMOKE_STORY_ID || true)"',
    '    if [ -n "$value" ]; then export GEARS_SMOKE_STORY_ID="$value"; fi',
    '  fi',
    '  if is_placeholder "${GEARS_SMOKE_SERIES_PROJECT_ID:-}"; then',
    '    value="$(read_smoke_target_env GEARS_SMOKE_SERIES_PROJECT_ID || true)"',
    '    if [ -n "$value" ]; then export GEARS_SMOKE_SERIES_PROJECT_ID="$value"; fi',
    '  fi',
    '  if is_placeholder "${GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE:-}"; then',
    '    value="$(read_smoke_target_env GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE || true)"',
    '    if [ -n "$value" ]; then export GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE="$value"; fi',
    '  fi',
    '  if is_placeholder "${GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE:-}"; then',
    '    export GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE="seedance_video"',
    '  fi',
    '  if command -v node >/dev/null 2>&1; then',
    '    node - "$EVIDENCE_DIR/story-agent-smoke-env-selected.json" <<\'NODE\'',
    'const fs = require("fs")',
    'const output = process.argv[2]',
    'const selected = {',
    '  schema_version: "story-agent-smoke-env-selected/v1",',
    '  GEARS_SMOKE_PROJECT_ID: process.env.GEARS_SMOKE_PROJECT_ID || "",',
    '  GEARS_SMOKE_STORY_ID: process.env.GEARS_SMOKE_STORY_ID || "",',
    '  GEARS_SMOKE_SERIES_PROJECT_ID: process.env.GEARS_SMOKE_SERIES_PROJECT_ID || "",',
    '  GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE: process.env.GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE || "",',
    '}',
    'fs.writeFileSync(output, `${JSON.stringify(selected, null, 2)}\\n`)',
    'NODE',
    '  fi',
    '}',
    '',
    'write_story_agent_ledger_seed_body() {',
    '  local output_file="$1"',
    '  local callback_url="$2"',
    '  if command -v node >/dev/null 2>&1; then',
    '    node - "$output_file" "$callback_url" <<\'NODE\'',
    'const fs = require("fs")',
    'const output = process.argv[2]',
    'const callbackUrl = process.argv[3]',
    'const jobType = process.env.GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE || "seedance_video"',
    'const body = {',
    '  job_type: jobType,',
    '  use_gears_api: true,',
    '  overwrite_existing: true,',
    '  callback_url: callbackUrl,',
    '  note: "GEARS worker acceptance ledger seed",',
    '}',
    'fs.writeFileSync(output, `${JSON.stringify(body, null, 2)}\\n`)',
    'NODE',
    '  else',
    '    printf "%s\\n" "{\\"job_type\\":\\"$GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE\\",\\"use_gears_api\\":true,\\"overwrite_existing\\":true,\\"callback_url\\":\\"$callback_url\\",\\"note\\":\\"GEARS worker acceptance ledger seed\\"}" > "$output_file"',
    '  fi',
    '}',
    '',
    'patch_callback_payload_from_story_agent_submit() {',
    '  local submit_response_file="$1"',
    '  local callback_payload_file="$2"',
    '  local selected_output_file="$3"',
    '  local scope="$4"',
    '  if ! command -v node >/dev/null 2>&1 || [ ! -f "$submit_response_file" ] || [ ! -f "$callback_payload_file" ]; then',
    '    return 0',
    '  fi',
    '  node - "$submit_response_file" "$callback_payload_file" "$selected_output_file" "$scope" <<\'NODE\'',
    'const fs = require("fs")',
    'const submitFile = process.argv[2]',
    'const callbackFile = process.argv[3]',
    'const selectedFile = process.argv[4]',
    'const scope = process.argv[5]',
    'function readJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch { return undefined } }',
    'const root = readJson(submitFile)',
    'const callback = readJson(callbackFile)',
    'const data = root?.data && typeof root.data === "object" ? root.data : root',
    'const jobs = Array.isArray(data?.submitted_jobs) ? data.submitted_jobs : Array.isArray(data?.submittedJobs) ? data.submittedJobs : []',
    'const selected = jobs.find(job => typeof job?.source_unit_id === "string" && typeof job?.gears_job_id === "string")',
    'if (!selected || !callback) {',
    '  fs.writeFileSync(selectedFile, `${JSON.stringify({ schema_version: "story-agent-ledger-seed-selected/v1", scope, patched: false, reason: "no_submitted_job" }, null, 2)}\\n`)',
    '  process.exit(0)',
    '}',
    'const sourceId = selected.source_unit_id',
    'const jobId = selected.gears_job_id',
    'const jobType = selected.job_type || data?.job_type || process.env.GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE || "seedance_video"',
    'const sourceFields = new Set(["source_unit_id", "sourceUnitId", "external_id", "externalId", "custom_id", "customId", "production_id", "productionId"])',
    'const jobFields = new Set(["gears_job_id", "gearsJobId", "job_id", "jobId", "task_id", "taskId"])',
    'const jobTypeFields = new Set(["job_type", "jobType"])',
    'const eventFields = new Set(["event_id", "eventId", "callback_id", "callbackId"])',
    'function walk(value) {',
    '  if (!value || typeof value !== "object") return',
    '  if (Array.isArray(value)) { for (const item of value) walk(item); return }',
    '  for (const [key, child] of Object.entries(value)) {',
    '    if (jobFields.has(key)) value[key] = jobId',
    '    else if (sourceFields.has(key)) value[key] = sourceId',
    '    else if (jobTypeFields.has(key)) value[key] = jobType',
    '    else if (eventFields.has(key)) value[key] = `gears-smoke-${scope}-ledger-seed-${jobId}`',
    '    else walk(child)',
    '  }',
    '}',
    'walk(callback)',
    'fs.writeFileSync(callbackFile, `${JSON.stringify(callback, null, 2)}\\n`)',
    'fs.writeFileSync(selectedFile, `${JSON.stringify({',
    '  schema_version: "story-agent-ledger-seed-selected/v1",',
    '  scope,',
    '  patched: true,',
    '  source_unit_id: sourceId,',
    '  gears_job_id: jobId,',
    '  job_type: jobType,',
    '}, null, 2)}\\n`)',
    'NODE',
    '}',
    '',
    'seed_story_agent_gears_ledgers() {',
    '  if [ "$GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER" != "1" ]; then',
    '    echo "Skipping Story Agent ledger seed: GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=$GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER" | tee "$EVIDENCE_DIR/story-agent-ledger-seed-skip.txt"',
    '    return 0',
    '  fi',
    '  echo "Seeding Story Agent GEARS Job Ledgers through Story Agent submit APIs..."',
    '  project_seed_body="$EVIDENCE_DIR/story-agent-project-gears-submit-seed.json"',
    '  project_seed_response="$EVIDENCE_DIR/story-agent-project-gears-submit-seed-response.json"',
    '  project_callback_url="${GEARS_CALLBACK_BASE_URL%/}/api/projects/$GEARS_SMOKE_PROJECT_ID/gears-callback"',
    '  write_story_agent_ledger_seed_body "$project_seed_body" "$project_callback_url"',
    '  post_json_capture "Story Agent project GEARS submit seed" \\',
    '    "$STORY_AGENT_BASE_URL/api/projects/$GEARS_SMOKE_PROJECT_ID/production-board/gears-jobs/submit" \\',
    '    "$project_seed_body" \\',
    '    "$project_seed_response"',
    '  patch_callback_payload_from_story_agent_submit \\',
    '    "$project_seed_response" \\',
    '    "$EVIDENCE_DIR/gears-project-callback-smoke.json" \\',
    '    "$EVIDENCE_DIR/story-agent-project-ledger-seed-selected.json" \\',
    '    "project"',
    '  print_json_summary "$EVIDENCE_DIR/story-agent-project-ledger-seed-selected.json" "Story Agent project ledger seed selected"',
    '  patch_callback_payload_from_story_agent_submit \\',
    '    "$project_seed_response" \\',
    '    "$EVIDENCE_DIR/gears-system-external-callback-smoke.json" \\',
    '    "$EVIDENCE_DIR/story-agent-system-external-ledger-seed-selected.json" \\',
    '    "system_external"',
    '  print_json_summary "$EVIDENCE_DIR/story-agent-system-external-ledger-seed-selected.json" "Story Agent system external ledger seed selected"',
    '',
    '  series_seed_body="$EVIDENCE_DIR/story-agent-series-gears-submit-seed.json"',
    '  series_seed_response="$EVIDENCE_DIR/story-agent-series-gears-submit-seed-response.json"',
    '  series_callback_url="${GEARS_CALLBACK_BASE_URL%/}/api/story-outline/ai-comic-series-projects/$GEARS_SMOKE_SERIES_PROJECT_ID/gears-callback"',
    '  write_story_agent_ledger_seed_body "$series_seed_body" "$series_callback_url"',
    '  post_json_capture "Story Agent series GEARS submit seed" \\',
    '    "$STORY_AGENT_BASE_URL/api/story-outline/ai-comic-series-projects/$GEARS_SMOKE_SERIES_PROJECT_ID/gears-jobs/submit" \\',
    '    "$series_seed_body" \\',
    '    "$series_seed_response"',
    '  patch_callback_payload_from_story_agent_submit \\',
    '    "$series_seed_response" \\',
    '    "$EVIDENCE_DIR/gears-series-callback-smoke.json" \\',
    '    "$EVIDENCE_DIR/story-agent-series-ledger-seed-selected.json" \\',
    '    "series"',
    '  print_json_summary "$EVIDENCE_DIR/story-agent-series-ledger-seed-selected.json" "Story Agent series ledger seed selected"',
    '}',
    '',
    `cat > "$EVIDENCE_DIR/env.template.sh" <<'ENV'`,
    kit.env_template,
    'ENV',
    '',
    `cat > "$EVIDENCE_DIR/story-agent-smoke-targets.json" <<'JSON'`,
    JSON.stringify(kit.smoke_targets, null, 2),
    'JSON',
    '',
    'echo "Checking Story Agent smoke target candidates..."',
    'print_json_summary "$EVIDENCE_DIR/story-agent-smoke-targets.json" "Story Agent smoke targets"',
    'auto_fill_smoke_target_envs',
    '',
    ...payloadFiles,
    'echo "Rendering smoke payload templates with env values..."',
    ...renderPayloadTemplatesCommand('"$EVIDENCE_DIR"').split('\n'),
    '',
    'echo "Generating large project pressure payload..."',
    ...renderLargeProjectPressurePayloadCommand('"$EVIDENCE_DIR"').split('\n'),
    '',
    'echo "Reading Story Agent acceptance report..."',
    'curl -sS -o "$EVIDENCE_DIR/story-agent-acceptance-report.json" "$STORY_AGENT_BASE_URL/api/system/gears-execution-acceptance-report"',
    'print_json_summary "$EVIDENCE_DIR/story-agent-acceptance-report.json" "Story Agent acceptance report"',
    '',
    'echo "Reading Story Agent worker evidence bundle..."',
    'curl -sS -o "$EVIDENCE_DIR/story-agent-worker-evidence-bundle.json" "$STORY_AGENT_BASE_URL/api/system/gears-execution-worker-evidence-bundle"',
    'print_json_summary "$EVIDENCE_DIR/story-agent-worker-evidence-bundle.json" "Story Agent worker evidence bundle"',
    '',
    'echo "Reading Story Agent generated health audit..."',
    'curl -sS -o "$EVIDENCE_DIR/story-agent-generated-health-before.json" "$STORY_AGENT_BASE_URL/api/system/story-agent-generated-health?limit=50"',
    'print_json_summary "$EVIDENCE_DIR/story-agent-generated-health-before.json" "Story Agent generated health audit"',
    '',
    'echo "Reading production material pack health before worker smoke..."',
    'curl -sS -o "$EVIDENCE_DIR/production-material-pack-health-before.json" "$STORY_AGENT_BASE_URL/api/system/production-material-pack-health"',
    'print_json_summary "$EVIDENCE_DIR/production-material-pack-health-before.json" "Production material pack health before smoke"',
    '',
    'echo "Reading Domain Pack production health before worker smoke..."',
    'curl -sS -o "$EVIDENCE_DIR/domain-pack-production-health-before.json" "$STORY_AGENT_BASE_URL/api/system/domain-pack-production-health"',
    'print_json_summary "$EVIDENCE_DIR/domain-pack-production-health-before.json" "Domain Pack production health before smoke"',
    '',
    'echo "Reading Story Agent MVP status before worker smoke..."',
    'curl -sS -o "$EVIDENCE_DIR/story-agent-mvp-status-before.json" "$STORY_AGENT_BASE_URL/api/system/story-agent-mvp-status?generatedLimit=50&portfolioLimit=50"',
    'print_json_summary "$EVIDENCE_DIR/story-agent-mvp-status-before.json" "Story Agent MVP status before smoke"',
    '',
    'fetch_story_agent_generated_health_after() {',
    '  echo "Reading post-run generated health audit..."',
    '  local health_after_exit_code',
    '  set +e',
    '  curl -sS -o "$EVIDENCE_DIR/story-agent-generated-health-after.json" "$STORY_AGENT_BASE_URL/api/system/story-agent-generated-health?limit=50"',
    '  health_after_exit_code=$?',
    '  set -e',
    '  if [ "$health_after_exit_code" -ne 0 ] && [ -f "$EVIDENCE_DIR/story-agent-generated-health-before.json" ]; then',
    '    cp "$EVIDENCE_DIR/story-agent-generated-health-before.json" "$EVIDENCE_DIR/story-agent-generated-health-after.json"',
    '    echo "Generated health after fetch failed; copied before snapshot for audit continuity." | tee "$EVIDENCE_DIR/story-agent-generated-health-after-fetch-failed.txt"',
    '  fi',
    '  print_json_summary "$EVIDENCE_DIR/story-agent-generated-health-after.json" "Post-run generated health audit"',
    '}',
    '',
    'fetch_production_material_pack_health_after() {',
    '  echo "Reading post-run production material pack health..."',
    '  local pack_after_exit_code',
    '  set +e',
    '  curl -sS -o "$EVIDENCE_DIR/production-material-pack-health-after.json" "$STORY_AGENT_BASE_URL/api/system/production-material-pack-health"',
    '  pack_after_exit_code=$?',
    '  set -e',
    '  if [ "$pack_after_exit_code" -ne 0 ] && [ -f "$EVIDENCE_DIR/production-material-pack-health-before.json" ]; then',
    '    cp "$EVIDENCE_DIR/production-material-pack-health-before.json" "$EVIDENCE_DIR/production-material-pack-health-after.json"',
    '    echo "Production material pack health after fetch failed; copied before snapshot for audit continuity." | tee "$EVIDENCE_DIR/production-material-pack-health-after-fetch-failed.txt"',
    '  fi',
    '  print_json_summary "$EVIDENCE_DIR/production-material-pack-health-after.json" "Post-run production material pack health"',
    '}',
    '',
    'fetch_domain_pack_production_health_after() {',
    '  echo "Reading post-run Domain Pack production health..."',
    '  local domain_pack_after_exit_code',
    '  set +e',
    '  curl -sS -o "$EVIDENCE_DIR/domain-pack-production-health-after.json" "$STORY_AGENT_BASE_URL/api/system/domain-pack-production-health"',
    '  domain_pack_after_exit_code=$?',
    '  set -e',
    '  if [ "$domain_pack_after_exit_code" -ne 0 ] && [ -f "$EVIDENCE_DIR/domain-pack-production-health-before.json" ]; then',
    '    cp "$EVIDENCE_DIR/domain-pack-production-health-before.json" "$EVIDENCE_DIR/domain-pack-production-health-after.json"',
    '    echo "Domain Pack production health after fetch failed; copied before snapshot for audit continuity." | tee "$EVIDENCE_DIR/domain-pack-production-health-after-fetch-failed.txt"',
    '  fi',
    '  print_json_summary "$EVIDENCE_DIR/domain-pack-production-health-after.json" "Post-run Domain Pack production health"',
    '}',
    '',
    'fetch_story_agent_mvp_status_after() {',
    '  echo "Reading post-run Story Agent MVP status..."',
    '  local mvp_after_exit_code',
    '  set +e',
    '  curl -sS -o "$EVIDENCE_DIR/story-agent-mvp-status-after.json" "$STORY_AGENT_BASE_URL/api/system/story-agent-mvp-status?generatedLimit=50&portfolioLimit=50"',
    '  mvp_after_exit_code=$?',
    '  set -e',
    '  if [ "$mvp_after_exit_code" -ne 0 ] && [ -f "$EVIDENCE_DIR/story-agent-mvp-status-before.json" ]; then',
    '    cp "$EVIDENCE_DIR/story-agent-mvp-status-before.json" "$EVIDENCE_DIR/story-agent-mvp-status-after.json"',
    '    echo "MVP status after fetch failed; copied before snapshot for audit continuity." | tee "$EVIDENCE_DIR/story-agent-mvp-status-after-fetch-failed.txt"',
    '  fi',
    '  print_json_summary "$EVIDENCE_DIR/story-agent-mvp-status-after.json" "Post-run Story Agent MVP status"',
    '}',
    '',
    'extract_gears_system_external_output_url_from_worker_responses() {',
    '  if ! is_placeholder "${GEARS_SYSTEM_EXTERNAL_OUTPUT_URL:-}"; then',
    '    export GEARS_SYSTEM_EXTERNAL_OUTPUT_URL_SOURCE="${GEARS_SYSTEM_EXTERNAL_OUTPUT_URL_SOURCE:-env}"',
    '    printf "%s\\n" "$GEARS_SYSTEM_EXTERNAL_OUTPUT_URL" > "$EVIDENCE_DIR/story-agent-system-external-output-url.txt"',
    '    return 0',
    '  fi',
    '  if ! command -v node >/dev/null 2>&1; then',
    '    echo "Skipping system external output URL auto-extract: node is not installed." | tee "$EVIDENCE_DIR/story-agent-system-external-output-url-node-missing.txt"',
    '    return 0',
    '  fi',
    '  node - "$EVIDENCE_DIR" <<\'NODE\'',
    'const fs = require("fs")',
    'const path = require("path")',
    'const dir = process.argv[2]',
    'const outputFile = path.join(dir, "story-agent-system-external-output-url.txt")',
    'const summaryFile = path.join(dir, "story-agent-system-external-output-url-extract.json")',
    'const urlFields = new Set(["outputurl", "output_url", "videourl", "video_url", "artifacturl", "artifact_url", "mediaurl", "media_url", "fileurl", "file_url", "downloadurl", "download_url", "resulturl", "result_url", "url"])',
    'const artifactTokens = /(artifact|artifacts|output|outputs|file|files|media|asset|assets|result|results|video|videos)/i',
    'function isObject(value) { return value && typeof value === "object" && !Array.isArray(value) }',
    'function normalizeKey(key) { return String(key || "").replace(/[-_]/g, "").toLowerCase() }',
    'function isPublicArtifactUrl(value) {',
    '  if (typeof value !== "string") return false',
    '  const trimmed = value.trim()',
    '  if (!/^https?:\\/\\//i.test(trimmed)) return false',
    '  if (trimmed.includes("<") || trimmed.includes(">")) return false',
    '  try {',
    '    const url = new URL(trimmed)',
    '    const host = url.hostname.toLowerCase()',
    '    if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") return false',
    '    if (/^(10|127)\\./.test(host) || /^192\\.168\\./.test(host) || /^172\\.(1[6-9]|2\\d|3[0-1])\\./.test(host)) return false',
    '    if (host.includes("gears.example") || host.includes("story-agent.example") || host.includes("local.story-agent.invalid")) return false',
    '    return true',
    '  } catch {',
    '    return false',
    '  }',
    '}',
    'function fileCandidates() {',
    '  const files = []',
    '  for (const filename of fs.readdirSync(dir)) {',
    '    if (!filename.endsWith(".json")) continue',
    '    if (filename === "gears-submit-response.json" || /^gears-status-response-.*\\.json$/.test(filename)) files.push(filename)',
    '  }',
    '  return files.sort((left, right) => {',
    '    const leftStatus = left.startsWith("gears-status-response-") ? 0 : 1',
    '    const rightStatus = right.startsWith("gears-status-response-") ? 0 : 1',
    '    return leftStatus - rightStatus || left.localeCompare(right)',
    '  })',
    '}',
    'function collectUrls(root, filename) {',
    '  const urls = []',
    '  const queue = [{ value: root, pathParts: [] }]',
    '  const seen = new Set()',
    '  while (queue.length) {',
    '    const current = queue.shift()',
    '    const value = current.value',
    '    if (!value || typeof value !== "object") continue',
    '    if (seen.has(value)) continue',
    '    seen.add(value)',
    '    if (Array.isArray(value)) {',
    '      value.forEach((item, index) => queue.push({ value: item, pathParts: [...current.pathParts, String(index)] }))',
    '      continue',
    '    }',
    '    for (const [key, child] of Object.entries(value)) {',
    '      const nextPath = [...current.pathParts, key]',
    '      const normalized = normalizeKey(key)',
    '      const pathText = nextPath.join(".")',
    '      const pathLooksArtifact = artifactTokens.test(pathText)',
    '      if (typeof child === "string" && isPublicArtifactUrl(child) && (urlFields.has(normalized) || (normalized === "url" && pathLooksArtifact))) {',
    '        urls.push({ url: child.trim(), filename, path: pathText, score: pathLooksArtifact ? 2 : 1 })',
    '      }',
    '      if (child && typeof child === "object") queue.push({ value: child, pathParts: nextPath })',
    '    }',
    '  }',
    '  return urls',
    '}',
    'const candidates = []',
    'for (const filename of fileCandidates()) {',
    '  try { candidates.push(...collectUrls(JSON.parse(fs.readFileSync(path.join(dir, filename), "utf8")), filename)) }',
    '  catch (error) { candidates.push({ filename, parse_error: error instanceof Error ? error.message : String(error), score: 0 }) }',
    '}',
    'const urlCandidates = candidates.filter(item => item.url)',
    'const selected = urlCandidates.sort((left, right) => right.score - left.score || left.filename.localeCompare(right.filename))[0]',
    'const summary = {',
    '  schema_version: "story-agent-system-external-output-url-extract/v1",',
    '  generated_at: new Date().toISOString(),',
    '  selected_url: selected?.url,',
    '  selected_source_file: selected?.filename,',
    '  selected_path: selected?.path,',
    '  candidate_count: urlCandidates.length,',
    '  candidates: urlCandidates.slice(0, 10),',
    '}',
    'fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\\n`)',
    'if (selected?.url) fs.writeFileSync(outputFile, `${selected.url}\\n`)',
    'NODE',
    '  if [ -s "$EVIDENCE_DIR/story-agent-system-external-output-url.txt" ]; then',
    '    GEARS_SYSTEM_EXTERNAL_OUTPUT_URL="$(head -n 1 "$EVIDENCE_DIR/story-agent-system-external-output-url.txt")"',
    '    export GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
    '    export GEARS_SYSTEM_EXTERNAL_OUTPUT_URL_SOURCE="worker_response"',
    '    echo "Extracted system external output URL from GEARS worker response."',
    '  else',
    '    echo "Could not auto-extract a public system external artifact URL from GEARS worker responses. Set GEARS_SYSTEM_EXTERNAL_OUTPUT_URL before importing system callback." | tee "$EVIDENCE_DIR/story-agent-system-external-output-url-missing.txt"',
    '  fi',
    '}',
    '',
    'write_early_exit_audits() {',
    '  local reason="${1:-early exit}"',
    '  echo "Auditing Story Agent callback responses after $reason..."',
    ...renderStoryAgentCallbackResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/story-agent-callback-response-audit.json" "Story Agent callback response audit"',
    '  echo "Auditing GEARS large project pressure response after $reason..."',
    ...renderLargeProjectPressureResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-large-project-response-audit.json" "GEARS large project response audit"',
    '  fetch_story_agent_generated_health_after',
    '  echo "Auditing Story Agent generated health after $reason..."',
    ...renderStoryAgentGeneratedHealthAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/story-agent-generated-health-audit.json" "Story Agent generated health smoke audit"',
    '  fetch_production_material_pack_health_after',
    '  echo "Auditing production material pack health after $reason..."',
    ...renderProductionMaterialPackHealthAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/production-material-pack-health-audit.json" "Production material pack health smoke audit"',
    '  fetch_domain_pack_production_health_after',
    '  echo "Auditing Domain Pack production health after $reason..."',
    ...renderDomainPackProductionHealthAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/domain-pack-production-health-audit.json" "Domain Pack production health smoke audit"',
    '  fetch_story_agent_mvp_status_after',
    '  echo "Auditing Story Agent MVP status after $reason..."',
    ...renderStoryAgentMvpStatusAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/story-agent-mvp-status-audit.json" "Story Agent MVP status smoke audit"',
    '}',
    '',
    'echo "Checking required GEARS env values..."',
    'missing_envs=()',
    'for required_name in GEARS_API_BASE_URL GEARS_CALLBACK_SECRET GEARS_CALLBACK_BASE_URL GEARS_SMOKE_PROJECT_ID GEARS_SMOKE_SERIES_PROJECT_ID; do',
    '  required_value="${!required_name:-}"',
    '  if is_placeholder "$required_value"; then',
    '    missing_envs+=("$required_name")',
    '  fi',
    'done',
    'if [ "${#missing_envs[@]}" -gt 0 ]; then',
    '  printf "%s\\n" "${missing_envs[@]}" | tee "$EVIDENCE_DIR/gears-required-env-missing.txt"',
    '  echo "Missing required GEARS env values; submit/status/callback smoke skipped." | tee "$EVIDENCE_DIR/gears-required-env-blocked.txt"',
    '  echo "Checking Story Agent callback id formats before env-blocked exit..."',
    ...renderStoryAgentCallbackIdPreflightCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/story-agent-callback-id-preflight.json" "Story Agent callback id preflight"',
    '  echo "Writing empty GEARS worker response audit before env-blocked exit..."',
    ...renderWorkerResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-response-audit.json" "GEARS worker response audit"',
    '  write_early_exit_audits "env-blocked exit"',
    '  write_manifest',
    '  echo "Writing GEARS worker acceptance verdict before env-blocked exit..."',
    ...renderWorkerAcceptanceVerdictCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-verdict.json" "GEARS worker acceptance verdict"',
    '  echo "Writing GEARS worker acceptance archive before env-blocked exit..."',
    ...renderWorkerAcceptanceArchiveCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-archive.json" "GEARS worker acceptance archive"',
    '  echo "Verifying GEARS worker acceptance evidence integrity before env-blocked exit..."',
    ...renderWorkerAcceptanceIntegrityCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-integrity.json" "GEARS worker acceptance integrity"',
    '  write_worker_evidence_signoff_snapshot',
    '  print_signoff_next_steps',
    '  exit 2',
    'fi',
    '',
    'echo "Checking Story Agent callback id formats..."',
    ...renderStoryAgentCallbackIdPreflightCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/story-agent-callback-id-preflight.json" "Story Agent callback id preflight"',
    '',
    'echo "Submitting smoke units to GEARS worker..."',
    'set +e',
    'if is_placeholder "${GEARS_API_TOKEN:-}"; then',
    '  submit_http_status="$(curl -sS -w "%{http_code}" -o "$EVIDENCE_DIR/gears-submit-response.json" -X POST "$GEARS_API_BASE_URL/gears/jobs" \\',
    '    -H "content-type: application/json" \\',
    '    --data-binary @"$EVIDENCE_DIR/gears-submit-smoke.json")"',
    '  submit_exit_code=$?',
    'else',
    '  submit_http_status="$(curl -sS -w "%{http_code}" -o "$EVIDENCE_DIR/gears-submit-response.json" -X POST "$GEARS_API_BASE_URL/gears/jobs" \\',
    '    -H "content-type: application/json" \\',
    '    -H "authorization: Bearer $GEARS_API_TOKEN" \\',
    '    --data-binary @"$EVIDENCE_DIR/gears-submit-smoke.json")"',
    '  submit_exit_code=$?',
    'fi',
    'set -e',
    'record_http_metadata "$EVIDENCE_DIR/gears-submit-response.json" "$submit_http_status" "$submit_exit_code"',
    'printf "%s\\n" "$submit_exit_code" | tee "$EVIDENCE_DIR/gears-submit-exit-code.txt"',
    'printf "%s\\n" "$submit_http_status" | tee "$EVIDENCE_DIR/gears-submit-http-status.txt"',
    'cat "$EVIDENCE_DIR/gears-submit-response.json"',
    'if [ "$submit_exit_code" -ne 0 ]; then',
    '  echo "GEARS submit failed; skipping status/callback/live smoke. Check GEARS_API_BASE_URL, GEARS_API_TOKEN, and worker logs." | tee "$EVIDENCE_DIR/gears-submit-failed.txt"',
    '  echo "Auditing GEARS worker response shapes after submit failure..."',
    ...renderWorkerResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-response-audit.json" "GEARS worker response audit"',
    '  write_early_exit_audits "submit failure"',
    '  write_manifest',
    '  echo "Writing GEARS worker acceptance verdict after submit failure..."',
    ...renderWorkerAcceptanceVerdictCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-verdict.json" "GEARS worker acceptance verdict"',
    '  echo "Writing GEARS worker acceptance archive after submit failure..."',
    ...renderWorkerAcceptanceArchiveCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-archive.json" "GEARS worker acceptance archive"',
    '  echo "Verifying GEARS worker acceptance evidence integrity after submit failure..."',
    ...renderWorkerAcceptanceIntegrityCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-integrity.json" "GEARS worker acceptance integrity"',
    '  write_worker_evidence_signoff_snapshot',
    '  print_signoff_next_steps',
    '  exit "$submit_exit_code"',
    'fi',
    'if ! is_success_http_status "$submit_http_status"; then',
    '  echo "GEARS submit returned HTTP $submit_http_status; skipping status/callback/live smoke." | tee "$EVIDENCE_DIR/gears-submit-http-failed.txt"',
    '  echo "Auditing GEARS worker response shapes after non-2xx submit..."',
    ...renderWorkerResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-response-audit.json" "GEARS worker response audit"',
    '  write_early_exit_audits "non-2xx submit"',
    '  write_manifest',
    '  echo "Writing GEARS worker acceptance verdict after non-2xx submit..."',
    ...renderWorkerAcceptanceVerdictCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-verdict.json" "GEARS worker acceptance verdict"',
    '  echo "Writing GEARS worker acceptance archive after non-2xx submit..."',
    ...renderWorkerAcceptanceArchiveCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-archive.json" "GEARS worker acceptance archive"',
    '  echo "Verifying GEARS worker acceptance evidence integrity after non-2xx submit..."',
    ...renderWorkerAcceptanceIntegrityCommand('"$EVIDENCE_DIR"').split('\n'),
    '  print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-integrity.json" "GEARS worker acceptance integrity"',
    '  write_worker_evidence_signoff_snapshot',
    '  print_signoff_next_steps',
    '  exit 1',
    'fi',
    '',
    'if [ "$GEARS_ACCEPTANCE_AUTO_EXTRACT_JOB_ID" = "1" ] && is_placeholder "${GEARS_SMOKE_JOB_ID:-}"; then',
    '  if command -v node >/dev/null 2>&1; then',
    '    echo "Trying to extract GEARS job ids from submit response..."',
    '    node - "$EVIDENCE_DIR/gears-submit-response.json" <<\'NODE\' > "$EVIDENCE_DIR/gears-smoke-job-ids.txt"',
    'const fs = require("fs")',
    'const file = process.argv[2]',
    'let root',
    'try { root = JSON.parse(fs.readFileSync(file, "utf8")) } catch { process.exit(0) }',
    'const seen = new Set()',
    'const queue = [root]',
    'const idFields = ["gears_job_id", "gearsJobId", "job_id", "jobId", "task_id", "taskId", "id"]',
    'const sourceFields = ["source_unit_id", "sourceUnitId", "external_id", "externalId", "custom_id", "customId"]',
    'function meaningful(value) {',
    '  return typeof value === "string" && value.trim() && !value.includes("<")',
    '}',
    'function candidateScore(obj, field) {',
    '  let score = field === "id" ? 1 : 3',
    '  if (sourceFields.some(name => meaningful(obj?.[name]))) score += 2',
    '  if (["acceptedUnits", "accepted_units", "jobs", "tasks", "task", "job"].some(name => obj?.[name])) score += 1',
    '  return score',
    '}',
    'const candidates = []',
    'while (queue.length) {',
    '  const value = queue.shift()',
    '  if (!value || typeof value !== "object" || seen.has(value)) continue',
    '  seen.add(value)',
    '  if (Array.isArray(value)) {',
    '    for (const item of value) queue.push(item)',
    '    continue',
    '  }',
    '  for (const field of idFields) {',
    '    if (!meaningful(value[field])) continue',
    '    candidates.push({ id: value[field].trim(), score: candidateScore(value, field) })',
    '  }',
    '  for (const item of Object.values(value)) queue.push(item)',
    '}',
    'const ordered = [...new Map(',
    '  candidates',
    '    .sort((a, b) => b.score - a.score)',
    '    .map(item => [item.id, item.id]),',
    ').values()]',
    'for (const id of ordered) console.log(id)',
    'NODE',
    '    if [ -s "$EVIDENCE_DIR/gears-smoke-job-ids.txt" ]; then',
    '      GEARS_SMOKE_JOB_ID="$(head -n 1 "$EVIDENCE_DIR/gears-smoke-job-ids.txt")"',
    '      export GEARS_SMOKE_JOB_ID',
    '      printf "%s\\n" "$GEARS_SMOKE_JOB_ID" | tee "$EVIDENCE_DIR/gears-smoke-job-id.txt"',
    '      echo "Extracted $(wc -l < "$EVIDENCE_DIR/gears-smoke-job-ids.txt" | tr -d " ") GEARS job id(s)."',
    '    else',
    '      rm -f "$EVIDENCE_DIR/gears-smoke-job-ids.txt"',
    '      echo "Could not auto-extract GEARS job id. Set GEARS_SMOKE_JOB_ID manually for status polling." | tee "$EVIDENCE_DIR/gears-smoke-job-id-missing.txt"',
    '    fi',
    '  else',
    '    echo "Skipping GEARS job id auto-extract: node is not installed." | tee "$EVIDENCE_DIR/gears-smoke-job-id-node-missing.txt"',
    '  fi',
    'fi',
    '',
    'if ! is_placeholder "${GEARS_SMOKE_JOB_ID:-}"; then',
    '  echo "Rendering callback payloads with GEARS job id..."',
    ...renderPayloadTemplatesCommand('"$EVIDENCE_DIR"').split('\n'),
    'fi',
    '',
    'if ! is_placeholder "${GEARS_SMOKE_JOB_ID:-}"; then',
      '  if [ ! -s "$EVIDENCE_DIR/gears-smoke-job-ids.txt" ]; then',
      '    printf "%s\\n" "$GEARS_SMOKE_JOB_ID" > "$EVIDENCE_DIR/gears-smoke-job-ids.txt"',
    '  fi',
    '  while IFS= read -r job_id; do',
    '    [ -n "$job_id" ] || continue',
    '    safe_job_id="$(printf "%s" "$job_id" | tr -c "A-Za-z0-9._-" "_")"',
    '    poll_attempt=1',
    '    while [ "$poll_attempt" -le "$GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS" ]; do',
    '      status_response_file="$EVIDENCE_DIR/gears-status-response-$safe_job_id.json"',
    '      attempt_response_file="$status_response_file"',
    '      if [ "$GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS" -gt 1 ]; then',
    '        attempt_response_file="$EVIDENCE_DIR/gears-status-response-$safe_job_id-attempt-$poll_attempt.json"',
    '      fi',
    '      echo "Polling GEARS worker status for $job_id (attempt $poll_attempt/$GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS)..."',
    '      set +e',
    '      if is_placeholder "${GEARS_API_TOKEN:-}"; then',
    '        poll_http_status="$(curl -sS -w "%{http_code}" -o "$attempt_response_file" "$GEARS_API_BASE_URL/gears/jobs/$job_id")"',
    '        poll_exit_code=$?',
    '      else',
    '        poll_http_status="$(curl -sS -w "%{http_code}" -o "$attempt_response_file" "$GEARS_API_BASE_URL/gears/jobs/$job_id" \\',
    '          -H "authorization: Bearer $GEARS_API_TOKEN")"',
    '        poll_exit_code=$?',
    '      fi',
    '      set -e',
    '      record_http_metadata "$attempt_response_file" "$poll_http_status" "$poll_exit_code"',
    '      if [ "$attempt_response_file" != "$status_response_file" ]; then',
    '        cp "$attempt_response_file" "$status_response_file"',
    '        record_http_metadata "$status_response_file" "$poll_http_status" "$poll_exit_code"',
    '      fi',
    '      cat "$attempt_response_file"',
    '      if [ "$poll_exit_code" -ne 0 ]; then',
    '        echo "GEARS status poll transport failed for $job_id with curl exit $poll_exit_code." | tee "$EVIDENCE_DIR/gears-status-response-$safe_job_id-attempt-$poll_attempt-failed.txt"',
    '      elif ! is_success_http_status "$poll_http_status"; then',
    '        echo "GEARS status poll for $job_id returned HTTP $poll_http_status." | tee "$EVIDENCE_DIR/gears-status-response-$safe_job_id-attempt-$poll_attempt-http-failed.txt"',
    '      fi',
    '      if [ "$poll_attempt" -lt "$GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS" ]; then',
    '        sleep "$GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS"',
    '      fi',
    '      poll_attempt=$((poll_attempt + 1))',
    '    done',
    '  done < "$EVIDENCE_DIR/gears-smoke-job-ids.txt"',
    'else',
    '  echo "Skipping status poll: set GEARS_SMOKE_JOB_ID to the job id returned by submit." | tee "$EVIDENCE_DIR/gears-status-skip.txt"',
    'fi',
    '',
    'echo "Auditing GEARS worker response shapes..."',
    ...renderWorkerResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/gears-worker-response-audit.json" "GEARS worker response audit"',
    '',
    'echo "Resolving system external output URL from GEARS worker responses..."',
    'extract_gears_system_external_output_url_from_worker_responses',
    'echo "Rendering system external callback payload with resolved artifact URL..."',
    ...renderPayloadTemplatesCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/story-agent-system-external-output-url-source.json" "Story Agent system external output URL source"',
    '',
    'seed_story_agent_gears_ledgers',
    '',
    'echo "Posting single-story callback to Story Agent..."',
    'post_json_capture "Story Agent project callback" \\',
    '  "$STORY_AGENT_BASE_URL/api/projects/$GEARS_SMOKE_PROJECT_ID/gears-callback" \\',
    '  "$EVIDENCE_DIR/gears-project-callback-smoke.json" \\',
    '  "$EVIDENCE_DIR/story-agent-project-callback-response.json" \\',
    '  "$GEARS_CALLBACK_SECRET"',
    '',
    'if [ "$GEARS_ACCEPTANCE_REPLAY_CALLBACKS" = "1" ]; then',
    '  echo "Replaying single-story callback to prove idempotency..."',
    '  post_json_capture "Story Agent project callback replay" \\',
    '    "$STORY_AGENT_BASE_URL/api/projects/$GEARS_SMOKE_PROJECT_ID/gears-callback" \\',
    '    "$EVIDENCE_DIR/gears-project-callback-smoke.json" \\',
    '    "$EVIDENCE_DIR/story-agent-project-callback-replay-response.json" \\',
    '    "$GEARS_CALLBACK_SECRET"',
    'else',
    '  echo "Skipping single-story callback replay: GEARS_ACCEPTANCE_REPLAY_CALLBACKS=$GEARS_ACCEPTANCE_REPLAY_CALLBACKS" | tee "$EVIDENCE_DIR/story-agent-project-callback-replay-skip.txt"',
    'fi',
    '',
    'echo "Preflighting system-level external callback batch..."',
    'post_json_capture "Story Agent system external callback preflight" \\',
    '  "$STORY_AGENT_BASE_URL/api/system/gears-external-callbacks/preflight" \\',
    '  "$EVIDENCE_DIR/gears-system-external-callback-smoke.json" \\',
    '  "$EVIDENCE_DIR/story-agent-system-external-callback-preflight-response.json" \\',
    '  "$GEARS_CALLBACK_SECRET"',
    '',
    'echo "Importing system-level external callback batch..."',
    'post_json_capture "Story Agent system external callback import" \\',
    '  "$STORY_AGENT_BASE_URL/api/system/gears-external-callbacks/import" \\',
    '  "$EVIDENCE_DIR/gears-system-external-callback-smoke.json" \\',
    '  "$EVIDENCE_DIR/story-agent-system-external-callback-import-response.json" \\',
    '  "$GEARS_CALLBACK_SECRET"',
    '',
    'echo "Posting AI comic series callback to Story Agent..."',
    'post_json_capture "Story Agent series callback" \\',
    '  "$STORY_AGENT_BASE_URL/api/story-outline/ai-comic-series-projects/$GEARS_SMOKE_SERIES_PROJECT_ID/gears-callback" \\',
    '  "$EVIDENCE_DIR/gears-series-callback-smoke.json" \\',
    '  "$EVIDENCE_DIR/story-agent-series-callback-response.json" \\',
    '  "$GEARS_CALLBACK_SECRET"',
    '',
    'if [ "$GEARS_ACCEPTANCE_REPLAY_CALLBACKS" = "1" ]; then',
    '  echo "Replaying AI comic series callback to prove idempotency..."',
    '  post_json_capture "Story Agent series callback replay" \\',
    '    "$STORY_AGENT_BASE_URL/api/story-outline/ai-comic-series-projects/$GEARS_SMOKE_SERIES_PROJECT_ID/gears-callback" \\',
    '    "$EVIDENCE_DIR/gears-series-callback-smoke.json" \\',
    '    "$EVIDENCE_DIR/story-agent-series-callback-replay-response.json" \\',
    '    "$GEARS_CALLBACK_SECRET"',
    'else',
    '  echo "Skipping AI comic series callback replay: GEARS_ACCEPTANCE_REPLAY_CALLBACKS=$GEARS_ACCEPTANCE_REPLAY_CALLBACKS" | tee "$EVIDENCE_DIR/story-agent-series-callback-replay-skip.txt"',
    'fi',
    '',
    'if [ "$GEARS_ACCEPTANCE_RUN_LIVE_SMOKE" = "1" ]; then',
    '  echo "Running Story Agent live smoke endpoint..."',
    '  post_json_capture "Story Agent live smoke" \\',
    '    "$STORY_AGENT_BASE_URL/api/system/gears-execution-live-smoke-run" \\',
    '    "$EVIDENCE_DIR/gears-live-smoke.json" \\',
    '    "$EVIDENCE_DIR/story-agent-live-smoke-response.json"',
    'else',
    '  echo "Skipping live smoke: GEARS_ACCEPTANCE_RUN_LIVE_SMOKE=$GEARS_ACCEPTANCE_RUN_LIVE_SMOKE" | tee "$EVIDENCE_DIR/story-agent-live-smoke-skip.txt"',
    'fi',
    '',
    'echo "Auditing Story Agent callback responses..."',
    ...renderStoryAgentCallbackResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/story-agent-callback-response-audit.json" "Story Agent callback response audit"',
    '',
    'if [ "$GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE" = "1" ]; then',
    '  echo "Submitting large project pressure payload to GEARS worker..."',
    '  set +e',
    '  if is_placeholder "${GEARS_API_TOKEN:-}"; then',
    '    large_pressure_http_status="$(curl -sS -w "%{http_code}" -o "$EVIDENCE_DIR/gears-large-project-submit-response.json" -X POST "$GEARS_API_BASE_URL/gears/jobs" \\',
    '      -H "content-type: application/json" \\',
    '      --data-binary @"$EVIDENCE_DIR/gears-large-project-submit-pressure.json")"',
    '    large_pressure_exit_code=$?',
    '  else',
    '    large_pressure_http_status="$(curl -sS -w "%{http_code}" -o "$EVIDENCE_DIR/gears-large-project-submit-response.json" -X POST "$GEARS_API_BASE_URL/gears/jobs" \\',
    '      -H "content-type: application/json" \\',
    '      -H "authorization: Bearer $GEARS_API_TOKEN" \\',
    '      --data-binary @"$EVIDENCE_DIR/gears-large-project-submit-pressure.json")"',
    '    large_pressure_exit_code=$?',
    '  fi',
    '  set -e',
    '  record_http_metadata "$EVIDENCE_DIR/gears-large-project-submit-response.json" "$large_pressure_http_status" "$large_pressure_exit_code"',
    '  printf "%s\\n" "$large_pressure_exit_code" | tee "$EVIDENCE_DIR/gears-large-project-submit-exit-code.txt"',
    '  printf "%s\\n" "$large_pressure_http_status" | tee "$EVIDENCE_DIR/gears-large-project-submit-http-status.txt"',
    '  cat "$EVIDENCE_DIR/gears-large-project-submit-response.json"',
    '  if [ "$large_pressure_exit_code" -ne 0 ]; then',
    '    echo "Large project pressure submit failed; inspect GEARS worker capacity, rate limits, and batch contract." | tee "$EVIDENCE_DIR/gears-large-project-submit-failed.txt"',
    '  elif ! is_success_http_status "$large_pressure_http_status"; then',
    '    echo "Large project pressure submit returned HTTP $large_pressure_http_status; inspect worker batch limits and response contract." | tee "$EVIDENCE_DIR/gears-large-project-submit-http-failed.txt"',
    '  fi',
    'else',
    '  echo "Skipping large project pressure submit: GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=$GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE" | tee "$EVIDENCE_DIR/gears-large-project-pressure-skip.txt"',
    'fi',
    '',
    'echo "Auditing GEARS large project pressure response..."',
    ...renderLargeProjectPressureResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/gears-large-project-response-audit.json" "GEARS large project response audit"',
    '',
    'echo "Refreshing GEARS worker response audit..."',
    ...renderWorkerResponseAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/gears-worker-response-audit.json" "GEARS worker response audit"',
    '',
    'if [ "$GEARS_ACCEPTANCE_FETCH_POST_AUDIT" = "1" ]; then',
    '  echo "Reading post-run Story Agent worker evidence bundle..."',
    '  curl -sS -o "$EVIDENCE_DIR/story-agent-worker-evidence-bundle-after.json" "$STORY_AGENT_BASE_URL/api/system/gears-execution-worker-evidence-bundle"',
    '  print_json_summary "$EVIDENCE_DIR/story-agent-worker-evidence-bundle-after.json" "Post-run Story Agent worker evidence bundle"',
    '',
    '  echo "Reading post-run generated project pressure audit..."',
    '  curl -sS -o "$EVIDENCE_DIR/story-agent-generated-pressure-after.json" "$STORY_AGENT_BASE_URL/api/system/gears-execution-generated-project-pressure"',
    '  print_json_summary "$EVIDENCE_DIR/story-agent-generated-pressure-after.json" "Post-run generated project pressure audit"',
    '',
    '  echo "Reading post-run generated health audit..."',
    '  fetch_story_agent_generated_health_after',
    '',
    '  echo "Reading post-run production material pack health..."',
    '  fetch_production_material_pack_health_after',
    '',
    '  echo "Reading post-run Domain Pack production health..."',
    '  fetch_domain_pack_production_health_after',
    '',
    '  echo "Reading post-run Story Agent MVP status..."',
    '  fetch_story_agent_mvp_status_after',
    'else',
    '  echo "Skipping post-run audit: GEARS_ACCEPTANCE_FETCH_POST_AUDIT=$GEARS_ACCEPTANCE_FETCH_POST_AUDIT" | tee "$EVIDENCE_DIR/story-agent-post-audit-skip.txt"',
    'fi',
    '',
    'echo "Auditing Story Agent generated health before final verdict..."',
    ...renderStoryAgentGeneratedHealthAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/story-agent-generated-health-audit.json" "Story Agent generated health smoke audit"',
    '',
    'echo "Auditing production material pack health before final verdict..."',
    ...renderProductionMaterialPackHealthAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/production-material-pack-health-audit.json" "Production material pack health smoke audit"',
    '',
    'echo "Auditing Domain Pack production health before final verdict..."',
    ...renderDomainPackProductionHealthAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/domain-pack-production-health-audit.json" "Domain Pack production health smoke audit"',
    '',
    'echo "Auditing Story Agent MVP status before final verdict..."',
    ...renderStoryAgentMvpStatusAuditCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/story-agent-mvp-status-audit.json" "Story Agent MVP status smoke audit"',
    '',
    'write_manifest',
    '',
    'echo "Writing GEARS worker acceptance verdict..."',
    ...renderWorkerAcceptanceVerdictCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-verdict.json" "GEARS worker acceptance verdict"',
    '',
    'echo "Writing GEARS worker acceptance archive..."',
    ...renderWorkerAcceptanceArchiveCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-archive.json" "GEARS worker acceptance archive"',
    '',
    'echo "Verifying GEARS worker acceptance evidence integrity..."',
    ...renderWorkerAcceptanceIntegrityCommand('"$EVIDENCE_DIR"').split('\n'),
    'print_json_summary "$EVIDENCE_DIR/gears-worker-acceptance-integrity.json" "GEARS worker acceptance integrity"',
    'write_worker_evidence_signoff_snapshot',
    'if [ "$GEARS_ACCEPTANCE_STRICT_AUDIT" = "1" ]; then',
    '  acceptance_passed="$(node - "$EVIDENCE_DIR/gears-worker-acceptance-verdict.json" <<\'NODE\'',
    'const fs = require("fs")',
    'const file = process.argv[2]',
    'try {',
    '  const root = JSON.parse(fs.readFileSync(file, "utf8"))',
    '  process.stdout.write(root.acceptance_passed ? "true" : "false")',
    '} catch {',
    '  process.stdout.write("false")',
    '}',
    'NODE',
    ')"',
    '  if [ "$acceptance_passed" != "true" ]; then',
    '    echo "GEARS worker acceptance strict audit failed; see $EVIDENCE_DIR/gears-worker-acceptance-verdict.json" >&2',
    '    print_signoff_next_steps',
    '    exit 1',
    '  fi',
    '  archive_signoff_ready="$(node - "$EVIDENCE_DIR/gears-worker-acceptance-archive.json" <<\'NODE\'',
    'const fs = require("fs")',
    'const file = process.argv[2]',
    'try {',
    '  const root = JSON.parse(fs.readFileSync(file, "utf8"))',
    '  process.stdout.write(root.signoff_ready ? "true" : "false")',
    '} catch {',
    '  process.stdout.write("false")',
    '}',
    'NODE',
    ')"',
    '  if [ "$archive_signoff_ready" != "true" ]; then',
    '    echo "GEARS worker acceptance archive strict audit failed; see $EVIDENCE_DIR/gears-worker-acceptance-archive.json" >&2',
    '    print_signoff_next_steps',
    '    exit 1',
    '  fi',
    '  integrity_passed="$(node - "$EVIDENCE_DIR/gears-worker-acceptance-integrity.json" <<\'NODE\'',
    'const fs = require("fs")',
    'const file = process.argv[2]',
    'try {',
    '  const root = JSON.parse(fs.readFileSync(file, "utf8"))',
    '  process.stdout.write(root.integrity_passed ? "true" : "false")',
    '} catch {',
    '  process.stdout.write("false")',
    '}',
    'NODE',
    ')"',
    '  if [ "$integrity_passed" != "true" ]; then',
    '    echo "GEARS worker acceptance integrity strict audit failed; see $EVIDENCE_DIR/gears-worker-acceptance-integrity.json" >&2',
    '    print_signoff_next_steps',
    '    exit 1',
    '  fi',
    'else',
    '  echo "Skipping strict acceptance verdict exit: GEARS_ACCEPTANCE_STRICT_AUDIT=$GEARS_ACCEPTANCE_STRICT_AUDIT"',
    'fi',
    '',
    'print_signoff_next_steps',
  ];

  return `${lines.join('\n').trim()}\n`;
}

export async function getGearsExecutionWorkerAcceptanceKit(): Promise<GearsExecutionWorkerAcceptanceKit> {
  const acceptance = await getGearsExecutionAcceptanceReport();
  const smokeTargets = await getGearsWorkerAcceptanceSmokeTargets();
  const smokePackage = getGearsExecutionSmokePackage();
  const submitStep = smokePackage.steps.find(step => step.id === 'submit_http');
  const projectCallbackStep = smokePackage.steps.find(step => step.id === 'project_callback');
  const seriesCallbackStep = smokePackage.steps.find(step => step.id === 'series_callback');
  const liveSmokeBody = {
    execute: true,
    poll_after_submit: true,
    note: 'GEARS worker acceptance kit live smoke',
  };
  const largeProjectPressurePlan = {
    schema_version: 'gears-worker-large-project-pressure-plan/v1',
    job_type: 'seedance_video',
    submit_payload_filename: 'gears-large-project-submit-pressure.json',
    summary_filename: 'gears-large-project-pressure-summary.json',
    default_episode_count: GEARS_WORKER_PRESSURE_DEFAULT_EPISODE_COUNT,
    default_shots_per_episode: GEARS_WORKER_PRESSURE_DEFAULT_SHOTS_PER_EPISODE,
    default_unit_count: GEARS_WORKER_PRESSURE_DEFAULT_EPISODE_COUNT * GEARS_WORKER_PRESSURE_DEFAULT_SHOTS_PER_EPISODE,
    max_unit_count: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
    callback_batch_item_limit: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
    callback_event_retention_limit: GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
    execution_guard: 'The generated shell script writes this payload by default, but submits it only when GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1.',
  };
  const systemExternalCallbackPayload = {
    schema_version: 'gears-system-external-callback-smoke/v1',
    callbacks: [{
      jobId: '<gears_job_id>',
      sourceUnitId: 'readiness-shot-1',
      sourceProjectId: 'GEARS_SMOKE_PROJECT_ID',
      sourceStoryId: 'GEARS_SMOKE_STORY_ID',
      jobType: 'seedance_video',
      taskStatus: 'COMPLETED',
      progressPercent: 100,
      eventId: 'gears-system-external-callback-smoke-001',
      outputUrl: '<GEARS_SYSTEM_EXTERNAL_OUTPUT_URL>',
      note: 'System-level external callback smoke; set GEARS_SYSTEM_EXTERNAL_OUTPUT_URL to a real public provider artifact URL before live acceptance.',
    }],
  };
  const payloads = [
    ...(submitStep?.request_body
      ? [acceptanceKitPayload('submit_smoke', 'GEARS submit smoke request', 'gears-submit-smoke.json', submitStep.request_body)]
      : []),
    ...(projectCallbackStep?.request_body
      ? [acceptanceKitPayload('project_callback', 'Story Agent project callback smoke', 'gears-project-callback-smoke.json', projectCallbackStep.request_body)]
      : []),
    ...(seriesCallbackStep?.request_body
      ? [acceptanceKitPayload('series_callback', 'Story Agent series callback smoke', 'gears-series-callback-smoke.json', seriesCallbackStep.request_body)]
      : []),
    acceptanceKitPayload('system_external_callback', 'Story Agent system external callback smoke', 'gears-system-external-callback-smoke.json', systemExternalCallbackPayload),
    acceptanceKitPayload('live_smoke', 'Story Agent live smoke request', 'gears-live-smoke.json', liveSmokeBody),
    acceptanceKitPayload('large_project_pressure_plan', 'GEARS large project pressure plan', 'gears-large-project-pressure-plan.json', largeProjectPressurePlan),
  ];
  const envVars: GearsExecutionWorkerAcceptanceEnvVar[] = [
    {
      name: 'STORY_AGENT_BASE_URL',
      required: true,
      value_placeholder: 'http://localhost:3000',
      description: 'Story Agent API base URL.',
    },
    {
      name: 'GEARS_API_BASE_URL',
      required: true,
      value_placeholder: 'https://gears.example.test',
      description: 'GEARS v2 worker API base URL.',
    },
    {
      name: 'GEARS_API_TOKEN',
      required: false,
      value_placeholder: '<gears-api-token>',
      description: 'Bearer token for GEARS submit/status endpoints when required.',
    },
    {
      name: 'GEARS_CALLBACK_SECRET',
      required: true,
      value_placeholder: '<shared-callback-secret>',
      description: 'Shared secret accepted by Story Agent project/series GEARS callback routes.',
    },
    {
      name: 'GEARS_CALLBACK_BASE_URL',
      required: true,
      value_placeholder: 'https://story-agent.example.test',
      description: 'Public base URL GEARS worker can call back into.',
    },
    {
      name: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
      required: false,
      value_placeholder: '<real-public-gears-artifact-url>',
      description: 'Optional manual override for the real public GEARS/Seedance artifact URL; otherwise the script extracts one from worker submit/status responses.',
    },
    {
      name: 'GEARS_SMOKE_PROJECT_ID',
      required: true,
      value_placeholder: smokeTargets.story_project?.id ?? '<story-project-id>',
      description: 'A Story Agent project id prepared for single-story callback smoke.',
    },
    {
      name: 'GEARS_SMOKE_STORY_ID',
      required: false,
      value_placeholder: smokeTargets.story_project?.current_story_id ?? '<story-id-optional>',
      description: 'Optional source story id for GEARS submit smoke; defaults to GEARS_SMOKE_PROJECT_ID when omitted.',
    },
    {
      name: 'GEARS_SMOKE_SERIES_PROJECT_ID',
      required: true,
      value_placeholder: smokeTargets.series_project?.id ?? '<ai-comic-series-project-id>',
      description: 'An AI comic series project id prepared for series callback smoke.',
    },
    {
      name: 'GEARS_SMOKE_JOB_ID',
      required: false,
      value_placeholder: '<gears-job-id-returned-by-submit>',
      description: 'GEARS job id returned by submit; used by status poll and callback smoke.',
    },
    {
      name: 'GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE',
      required: false,
      value_placeholder: '0',
      description: 'Set to 1 to submit the generated large-project pressure payload to GEARS.',
    },
    {
      name: 'GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER',
      required: false,
      value_placeholder: '0',
      description: 'Set to 1 to seed Story Agent GEARS Job Ledgers via Story Agent submit APIs before callback smoke.',
    },
    {
      name: 'GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE',
      required: false,
      value_placeholder: 'seedance_video',
      description: 'GEARS job type used when GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1.',
    },
    {
      name: 'GEARS_ACCEPTANCE_STRICT_AUDIT',
      required: false,
      value_placeholder: '1',
      description: 'When 1, the generated script exits non-zero if the final acceptance verdict fails.',
    },
    {
      name: 'GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS',
      required: false,
      value_placeholder: '1',
      description: 'Number of times the worker acceptance script polls each GEARS job status after submit.',
    },
    {
      name: 'GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS',
      required: false,
      value_placeholder: '5',
      description: 'Seconds to wait between status poll attempts when GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS is greater than 1.',
    },
    {
      name: 'GEARS_LARGE_PRESSURE_EPISODE_COUNT',
      required: false,
      value_placeholder: String(GEARS_WORKER_PRESSURE_DEFAULT_EPISODE_COUNT),
      description: 'Episode count for large-project worker pressure payload generation.',
    },
    {
      name: 'GEARS_LARGE_PRESSURE_SHOTS_PER_EPISODE',
      required: false,
      value_placeholder: String(GEARS_WORKER_PRESSURE_DEFAULT_SHOTS_PER_EPISODE),
      description: 'Shot count per episode for large-project worker pressure payload generation.',
    },
  ];
  const envTemplate = envVars
    .map(item => `export ${item.name}="${item.value_placeholder}"${item.required ? '' : ' # optional'}`)
    .join('\n');
  const realEndpointReadiness = getWorkerRealEndpointReadiness(smokeTargets);
  const submitPayload = payloads.find(payload => payload.id === 'submit_smoke');
  const projectPayload = payloads.find(payload => payload.id === 'project_callback');
  const seriesPayload = payloads.find(payload => payload.id === 'series_callback');
  const systemExternalCallbackPayloadFile = payloads.find(payload => payload.id === 'system_external_callback');
  const liveSmokePayload = payloads.find(payload => payload.id === 'live_smoke');
  const pressurePlanPayload = payloads.find(payload => payload.id === 'large_project_pressure_plan');
  const commands: GearsExecutionWorkerAcceptanceCommand[] = [
    {
      id: 'write_env',
      label: 'Prepare environment',
      phase: 'preflight',
      command: envTemplate,
      expected_assertions: [
        'STORY_AGENT_BASE_URL points to a running china-culture-kb server.',
        'GEARS_API_BASE_URL points to a reachable GEARS v2 worker.',
        'GEARS_CALLBACK_BASE_URL is reachable by the GEARS worker.',
        'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL is optional; when omitted, the script extracts a real public artifact URL from GEARS worker submit/status responses before system external import.',
        'story-agent-smoke-targets.json contains recommended existing project ids when generated projects are available.',
        'GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1 uses Story Agent submit APIs to create matching GEARS Job Ledger items before callback smoke.',
        'GEARS_SMOKE_PROJECT_ID and GEARS_SMOKE_SERIES_PROJECT_ID match Story Agent route id formats.',
      ],
    },
    {
      id: 'read_acceptance_report',
      label: 'Read Story Agent acceptance report',
      phase: 'preflight',
      command: 'curl -sS "$STORY_AGENT_BASE_URL/api/system/gears-execution-acceptance-report"',
      expected_assertions: [
        'Response ok=true.',
        'local_smoke_passed_count equals local_smoke_total_count.',
        'blocking_check_ids is empty before executing live worker smoke.',
      ],
    },
    {
      id: 'write_payload_files',
      label: 'Write smoke payload files',
      phase: 'preflight',
      command: [
        payloads.map(payloadFileCommand).join('\n\n'),
        renderPayloadTemplatesCommand('"."'),
        renderStoryAgentCallbackIdPreflightCommand('"."'),
      ].join('\n\n'),
      expected_assertions: [
        'gears-submit-smoke.json exists when submit smoke is available.',
        'callback payload files contain source ids and idempotency keys.',
        'GEARS_SMOKE_PROJECT_ID, GEARS_SMOKE_STORY_ID, and GEARS_SMOKE_SERIES_PROJECT_ID are auto-filled from smoke_targets when env values are blank or placeholders.',
        'payload templates replace GEARS_SMOKE_PROJECT_ID, GEARS_SMOKE_STORY_ID, GEARS_SMOKE_SERIES_PROJECT_ID, <GEARS_CALLBACK_BASE_URL>, <GEARS_SYSTEM_EXTERNAL_OUTPUT_URL>, and <gears_job_id> from env before posting.',
        'story-agent-system-external-output-url-source.json records whether the system external callback artifact URL came from GEARS_SYSTEM_EXTERNAL_OUTPUT_URL or a GEARS worker response.',
        'story-agent-callback-id-preflight.json warns if callback route ids will fail Story Agent validation.',
      ],
    },
    ...(pressurePlanPayload ? [{
      id: 'generate_large_project_pressure_payload',
      label: 'Generate large project pressure payload',
      phase: 'worker_pressure' as const,
      payload_id: pressurePlanPayload.id,
      command: renderLargeProjectPressurePayloadCommand('"."'),
      expected_assertions: [
        'gears-large-project-submit-pressure.json exists.',
        `Default pressure payload contains ${GEARS_WORKER_PRESSURE_DEFAULT_EPISODE_COUNT} episodes and ${GEARS_WORKER_PRESSURE_DEFAULT_EPISODE_COUNT * GEARS_WORKER_PRESSURE_DEFAULT_SHOTS_PER_EPISODE} units.`,
        'Every unit includes source_unit_id, external_id, custom_id, idempotency_key, callback_url, and metadata.',
      ],
    }] : []),
    ...(submitPayload ? [{
      id: 'submit_to_worker',
      label: 'Submit smoke units to GEARS worker',
      phase: 'worker_submit' as const,
      payload_id: submitPayload.id,
      command: 'curl -sS -X POST "$GEARS_API_BASE_URL/gears/jobs" -H "content-type: application/json" -H "authorization: Bearer $GEARS_API_TOKEN" --data-binary @gears-submit-smoke.json',
      expected_assertions: [
        'Response includes acceptedUnits[]/jobs[]/tasks[] or data.task.',
        'Each accepted item includes gears_job_id/jobId/taskId and source_unit_id/externalId.',
        'Rejected items, if any, include error_code and failure_category/message.',
      ],
    }] : []),
    {
      id: 'poll_worker_status',
      label: 'Poll GEARS worker status',
      phase: 'worker_poll',
      command: 'curl -sS "$GEARS_API_BASE_URL/gears/jobs/$GEARS_SMOKE_JOB_ID" -H "authorization: Bearer $GEARS_API_TOKEN"',
      expected_assertions: [
        'Response status aliases are one of accepted GEARS status fields.',
        'Ready responses include artifact URL fields or artifacts[].url.',
        'Failed responses include error_code/failure_reason/failure_category.',
        'When GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS is greater than 1, every attempt is saved as gears-status-response-<job>-attempt-<n>.json and the latest response remains gears-status-response-<job>.json.',
      ],
    },
    {
      id: 'audit_worker_response_shapes',
      label: 'Audit GEARS worker response shapes',
      phase: 'worker_poll',
      command: renderWorkerResponseAuditCommand('"."'),
      expected_assertions: [
        'gears-worker-response-audit.json and gears-worker-response-audit.md exist.',
        'Audit totals include accepted_count, rejected_count, failed_count, and status_alias_counts.',
        'Audit totals include transport_error_count and http_error_count from curl/http sidecar files.',
        'Audit records ready/completed responses that have no artifact URL or artifacts[].url.',
        'Audit records missing worker ids, source/idempotency ids, error_code, and failure_category gaps for contract follow-up.',
        'Audit recommended_actions list P0/P1 follow-up items for GEARS/Story Agent contract alignment.',
        'Audit sample_record_paths identify representative JSON paths for each contract gap.',
      ],
    },
    {
      id: 'seed_story_agent_ledgers_optional',
      label: 'Seed Story Agent GEARS ledgers when explicitly enabled',
      phase: 'story_agent_callback',
      command: 'GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1 bash run-gears-worker-acceptance.sh',
      expected_assertions: [
        'Run when callback smoke should prove Story Agent submit APIs create ledger writeback instead of only direct worker submit/status compatibility.',
        'story-agent-project-gears-submit-seed-response.json and story-agent-series-gears-submit-seed-response.json are saved.',
        'story-agent-project-ledger-seed-selected.json and story-agent-series-ledger-seed-selected.json identify the source_unit_id/gears_job_id used to patch callback smoke payloads.',
        'Callback audit ledger_match_missing_count should drop to zero when Story Agent submit accepted at least one matching job.',
      ],
    },
    ...(projectPayload ? [{
      id: 'post_project_callback',
      label: 'Post single-story callback to Story Agent',
      phase: 'story_agent_callback' as const,
      payload_id: projectPayload.id,
      command: 'curl -sS -X POST "$STORY_AGENT_BASE_URL/api/projects/$GEARS_SMOKE_PROJECT_ID/gears-callback" -H "content-type: application/json" -H "authorization: Bearer $GEARS_CALLBACK_SECRET" --data-binary @gears-project-callback-smoke.json',
      expected_assertions: [
        'Response ok=true.',
        'received_count is greater than 0.',
        'GEARS Job Ledger item becomes ready and Seedance Shot Ledger receives video/artifact data.',
      ],
    }] : []),
    ...(systemExternalCallbackPayloadFile ? [{
      id: 'preflight_system_external_callback_batch',
      label: 'Preflight system external callback batch',
      phase: 'story_agent_callback' as const,
      payload_id: systemExternalCallbackPayloadFile.id,
      command: 'curl -sS -X POST "$STORY_AGENT_BASE_URL/api/system/gears-external-callbacks/preflight" -H "content-type: application/json" -H "authorization: Bearer $GEARS_CALLBACK_SECRET" --data-binary @gears-system-external-callback-smoke.json',
      expected_assertions: [
        'Response ok=true.',
        'schema_version is system-gears-external-callback-batch-import/v1.',
        'blocked=false before importing real external artifact callbacks.',
        'ready_to_import_count is greater than 0 when Story Agent project ledger seed succeeded.',
      ],
    }, {
      id: 'import_system_external_callback_batch',
      label: 'Import system external callback batch',
      phase: 'story_agent_callback' as const,
      payload_id: systemExternalCallbackPayloadFile.id,
      command: 'curl -sS -X POST "$STORY_AGENT_BASE_URL/api/system/gears-external-callbacks/import" -H "content-type: application/json" -H "authorization: Bearer $GEARS_CALLBACK_SECRET" --data-binary @gears-system-external-callback-smoke.json',
      expected_assertions: [
        'Response ok=true.',
        'blocked=false and updated_count is greater than 0.',
        'System import uses project safe preflight/import logic and does not accept local_acceptance or gears.example placeholder URLs.',
        'Project readiness external_ready increases and ready_without_external decreases after import.',
      ],
    }] : []),
    ...(seriesPayload ? [{
      id: 'post_series_callback',
      label: 'Post AI comic series callback to Story Agent',
      phase: 'story_agent_callback' as const,
      payload_id: seriesPayload.id,
      command: 'curl -sS -X POST "$STORY_AGENT_BASE_URL/api/story-outline/ai-comic-series-projects/$GEARS_SMOKE_SERIES_PROJECT_ID/gears-callback" -H "content-type: application/json" -H "authorization: Bearer $GEARS_CALLBACK_SECRET" --data-binary @gears-series-callback-smoke.json',
      expected_assertions: [
        'Response ok=true.',
        'received_count is greater than 0.',
        'Series GEARS Job Ledger and production ledger update without duplicate versions on replay.',
      ],
    }] : []),
    ...(liveSmokePayload ? [{
      id: 'run_story_agent_live_smoke',
      label: 'Run Story Agent live smoke',
      phase: 'story_agent_live_smoke' as const,
      payload_id: liveSmokePayload.id,
      command: 'curl -sS -X POST "$STORY_AGENT_BASE_URL/api/system/gears-execution-live-smoke-run" -H "content-type: application/json" --data-binary @gears-live-smoke.json',
      expected_assertions: [
        'Response status is passed or partial, depending on intentionally rejected worker units.',
        'accepted_count plus rejected_count matches requested smoke units.',
        'markdown records submit and optional poll evidence.',
      ],
    }] : []),
    {
      id: 'audit_story_agent_callback_responses',
      label: 'Audit Story Agent callback responses',
      phase: 'story_agent_callback',
      command: renderStoryAgentCallbackResponseAuditCommand('"."'),
      expected_assertions: [
        'story-agent-callback-response-audit.json and story-agent-callback-response-audit.md exist after callback/live-smoke responses are saved.',
        'Audit totals include ok_true_count, ok_false_count, received_count, failed_count, and duplicate_count.',
        'Audit totals include transport_error_count, http_error_count, not_found_count, blocked_count, and ledger_match_missing_count from Story Agent callback/live-smoke sidecar files.',
        'Validation, auth, not-found, live-smoke blocked, or ledger match failures produce recommended_actions with sample response files.',
      ],
    },
    {
      id: 'audit_story_agent_generated_health',
      label: 'Audit Story Agent generated health before/after smoke',
      phase: 'story_agent_callback',
      command: renderStoryAgentGeneratedHealthAuditCommand('"."'),
      expected_assertions: [
        'story-agent-generated-health-before.json and story-agent-generated-health-after.json exist for sign-off runs.',
        'story-agent-generated-health-audit.json and story-agent-generated-health-audit.md exist before the final verdict.',
        'Audit fails if no ready Story Agent target exists before smoke.',
        'Audit fails if ready_count decreases, interrupted_count increases, or production_gap_count increases after smoke.',
      ],
    },
    {
      id: 'audit_production_material_pack_health',
      label: 'Audit production material pack health before/after smoke',
      phase: 'story_agent_callback',
      command: renderProductionMaterialPackHealthAuditCommand('"."'),
      expected_assertions: [
        'production-material-pack-health-before.json and production-material-pack-health-after.json exist for sign-off runs.',
        'production-material-pack-health-audit.json and production-material-pack-health-audit.md exist before the final verdict.',
        'Audit fails if ProductionMaterialPack health is not passed, issue_count is greater than 0, or core video type readiness regresses.',
        'Audit warns if production template issue_count increases during smoke.',
      ],
    },
    {
      id: 'audit_domain_pack_production_health',
      label: 'Audit Domain Pack production health before/after smoke',
      phase: 'story_agent_callback',
      command: renderDomainPackProductionHealthAuditCommand('"."'),
      expected_assertions: [
        'domain-pack-production-health-before.json and domain-pack-production-health-after.json exist for sign-off runs.',
        'domain-pack-production-health-audit.json and domain-pack-production-health-audit.md exist before the final verdict.',
        'Audit fails if Domain Pack production health is not passed, issue_count is greater than 0, or production ready pack count regresses.',
        'Audit warns if Domain Pack production health issue_count increases during smoke.',
      ],
    },
    {
      id: 'audit_story_agent_mvp_status',
      label: 'Audit Story Agent MVP status before/after smoke',
      phase: 'story_agent_callback',
      command: renderStoryAgentMvpStatusAuditCommand('"."'),
      expected_assertions: [
        'story-agent-mvp-status-before.json and story-agent-mvp-status-after.json exist for sign-off runs.',
        'story-agent-mvp-status-audit.json and story-agent-mvp-status-audit.md exist before the final verdict.',
        'Audit fails if MVP status regresses or blocker_count increases after smoke.',
        'Audit warns if MVP score decreases without a status regression.',
        'Audit records Seedance placeholder/production-ready asset counts before and after smoke.',
        'Audit records knowledge writeback ready/queued/needs_revision counts before and after smoke.',
      ],
    },
    ...(pressurePlanPayload ? [{
      id: 'submit_large_project_pressure_optional',
      label: 'Submit large project pressure payload when explicitly enabled',
      phase: 'worker_pressure' as const,
      payload_id: pressurePlanPayload.id,
      command: 'GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1 bash run-gears-worker-acceptance.sh',
      expected_assertions: [
        'Run only after the basic submit/status/callback smoke passes.',
        'GEARS worker either accepts all generated units or returns structured rejected records with source ids and failure categories.',
        'Attach gears-large-project-submit-response.json and gears-large-project-pressure-summary.json to the worker evidence bundle.',
      ],
    }, {
      id: 'audit_large_project_pressure_response',
      label: 'Audit large project pressure response',
      phase: 'worker_pressure' as const,
      payload_id: pressurePlanPayload.id,
      command: renderLargeProjectPressureResponseAuditCommand('"."'),
      expected_assertions: [
        'gears-large-project-response-audit.json and gears-large-project-response-audit.md exist.',
        'Audit reconciles request_unit_count with accepted/rejected/failed response records.',
        'Audit source_echo_count equals request_unit_count when GEARS echoed every pressure unit source id.',
        'Audit reports missing_requested_source_count, duplicate_source_id_count, unexpected_source_count, HTTP status, and curl exit code.',
      ],
    }] : []),
    {
      id: 'write_acceptance_verdict',
      label: 'Write final worker acceptance verdict',
      phase: 'worker_pressure',
      command: renderWorkerAcceptanceVerdictCommand('"."'),
      expected_assertions: [
        'gears-worker-acceptance-verdict.json and gears-worker-acceptance-verdict.md exist.',
        'Verdict gates cover required envs, callback id preflight, worker response audit, system external callback batch, generated health audit, production material pack health audit, MVP status audit, Story Agent callback audit, large project pressure audit, and manifest.',
        'System external callback gate verifies the import response contains the exact output_url from story-agent-system-external-output-url-source.json.',
        'Verdict story_agent_mvp_status_audit gate evidence includes Seedance asset and knowledge writeback governance counts.',
        'acceptance_passed is true only when all non-skipped gates pass.',
        'When GEARS_ACCEPTANCE_STRICT_AUDIT=1, the generated shell exits non-zero if verdict acceptance_passed=false.',
      ],
    },
    {
      id: 'write_acceptance_archive',
      label: 'Write final worker acceptance archive',
      phase: 'worker_pressure',
      command: renderWorkerAcceptanceArchiveCommand('"."'),
      expected_assertions: [
        'gears-worker-acceptance-archive.json and gears-worker-acceptance-archive.md exist.',
        'Archive lists required evidence attachments, missing_required_files, byte lengths, checksum_manifest, and sha256 checksums.',
        'Archive audit_summaries include MVP Seedance asset and knowledge writeback governance counts.',
        'gears-worker-acceptance-checksums.json and gears-worker-acceptance-checksums.md exist with every archived evidence file checksum.',
        'signoff_ready is true only when acceptance_passed=true and all required handoff attachments exist.',
        'When GEARS_ACCEPTANCE_STRICT_AUDIT=1, the generated shell exits non-zero if archive signoff_ready=false.',
      ],
    },
    {
      id: 'verify_acceptance_integrity',
      label: 'Verify final worker acceptance evidence integrity',
      phase: 'worker_pressure',
      command: renderWorkerAcceptanceIntegrityCommand('"."'),
      expected_assertions: [
        'gears-worker-acceptance-integrity.json and gears-worker-acceptance-integrity.md exist.',
        'Integrity recomputes sha256 for every checksum manifest record and reports byte_length_mismatch, sha256_mismatch, missing_file, and missing required checksum records.',
        'integrity_passed is true only when archive signoff_ready=true and checksum mismatches are zero.',
        'When GEARS_ACCEPTANCE_STRICT_AUDIT=1, the generated shell exits non-zero if integrity_passed=false.',
      ],
    },
    {
      id: 'read_worker_evidence_signoff',
      label: 'Read worker evidence signoff',
      phase: 'worker_pressure',
      command: 'curl -sS "$STORY_AGENT_BASE_URL/api/system/gears-execution-worker-evidence-signoff?evidence_dir=$(node -e \\"process.stdout.write(encodeURIComponent(process.env.GEARS_EVIDENCE_DIR || \'\'))\\")"',
      expected_assertions: [
        'Response schema_version is gears-execution-worker-evidence-signoff/v1.',
        'run-gears-worker-acceptance.sh saves gears-worker-evidence-signoff.json and gears-worker-evidence-signoff.md after archive/integrity generation.',
        'evidence_dir_source is input when an explicit evidence_dir query is used.',
        'status is ready only when verdict acceptance_passed, archive signoff_ready, integrity_passed, system external callback batch, generated health audit, and MVP status audit all pass.',
        'recommended_actions lists remaining GEARS/Story Agent contract fixes when status is attention or blocked.',
      ],
    },
  ];
  const kitWithoutScript: Omit<GearsExecutionWorkerAcceptanceKit, 'markdown' | 'shell_script'> = {
    provider: 'gears',
    schema_version: 'gears-execution-worker-acceptance-kit/v1',
    acceptance_status: acceptance.status,
    readiness_score: acceptance.readiness_score,
    local_smoke_passed_count: acceptance.local_smoke_passed_count,
    local_smoke_total_count: acceptance.local_smoke_total_count,
    required_envs: acceptance.required_envs,
    env_vars: envVars,
    env_template: envTemplate,
    smoke_targets: smokeTargets,
    real_endpoint_readiness: realEndpointReadiness,
    payloads,
    commands,
    shell_script_filename: 'run-gears-worker-acceptance.sh',
    verification_checklist: [
      'Story Agent acceptance report has no blocking_check_ids.',
      'GEARS submit returns accepted unit ids that can be polled.',
      'GEARS status poll returns ready/failed/rejected/canceled/processing aliases accepted by Story Agent.',
      'GEARS worker response audit records observed status aliases, id fields, error codes, and failure categories.',
      'story-agent-smoke-targets.json contains existing Story Agent project ids or explicit warnings before callback smoke.',
      'Project callback writes GEARS Job Ledger and single-story production ledger.',
      'Series callback writes GEARS Job Ledger and AI comic production/post-production ledgers.',
      'Duplicate callback replay increments duplicate_count without duplicate artifacts or versions.',
      'System external callback preflight reports blocked=false before batch import.',
      'System external callback import uses safe preflight/import and writes real external artifact URLs instead of local_acceptance placeholders.',
      'Final worker acceptance verdict verifies system external import response contains the exact validated output_url.',
      'Story Agent callback id preflight has warning_count=0 before callback smoke is trusted.',
      'Story Agent callback response audit has no ok=false validation/auth blockers.',
      'Story Agent generated health audit has no missing ready target or post-smoke regression.',
      'Production material pack health audit has status=passed before GEARS worker signoff.',
      'Domain Pack production health audit has status=passed before GEARS worker signoff.',
      'Story Agent MVP status audit has no status regression or blocker increase after worker smoke.',
      'Story Agent MVP governance counts for Seedance placeholders and knowledge writeback queue are preserved in verdict and archive evidence.',
      'Generated project pressure audit remains ok/watch with no blocked project before large batch rollout.',
      'Large project pressure payload is generated for at least 30 episodes and is submitted only when explicitly enabled.',
      'Large project response audit has no source_echo_gap after a real pressure submit.',
      'Final worker acceptance verdict has acceptance_passed=true before a GEARS v2 run is signed off.',
      'Final worker evidence signoff requires system_external_callback_passed=true with ready_to_import_count>0, updated_count>0, and an import response match for the validated output_url.',
      'Final worker acceptance archive has signoff_ready=true and no missing required attachments before handoff.',
      'Final worker acceptance integrity has integrity_passed=true and no checksum mismatches before handoff.',
      'Final worker evidence signoff snapshot is saved as gears-worker-evidence-signoff.json/.md after archive integrity is evaluated.',
    ],
    generated_at: new Date().toISOString(),
  };
  const kit: Omit<GearsExecutionWorkerAcceptanceKit, 'markdown'> = {
    ...kitWithoutScript,
    shell_script: renderGearsExecutionWorkerAcceptanceShellScript(kitWithoutScript),
  };
  return {
    ...kit,
    markdown: renderGearsExecutionWorkerAcceptanceKitMarkdown(kit),
  };
}

function workerEvidenceDocument(
  id: GearsExecutionWorkerEvidenceDocumentKind,
  label: string,
  filename: string,
  sourceEndpoint: string,
  content: string,
  summary: string,
): GearsExecutionWorkerEvidenceDocument {
  return {
    id,
    label,
    filename,
    source_endpoint: sourceEndpoint,
    format: 'markdown',
    content,
    content_length: content.length,
    summary,
  };
}

function renderProductionMaterialPackHealthMarkdown(report: ProductionMaterialPackHealthReport): string {
  return [
    '# Production Material Pack Health',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- status: ${report.status}`,
    `- pack_count: ${report.pack_count}`,
    `- required_video_types: ${report.required_video_types.length}`,
    `- covered_required_video_types: ${report.covered_required_video_types.length}`,
    `- missing_required_video_types: ${report.missing_required_video_types.join(', ') || 'none'}`,
    `- core_ready: ${report.production_ready_core_video_types.length}/${report.core_video_types.length}`,
    `- issue_count: ${report.issues.length}`,
    '',
    '## Core Video Types',
    '',
    ...report.core_video_types.map(videoType => `- ${videoType}: ${report.production_ready_core_video_types.includes(videoType) ? 'passed' : 'needs_attention'}`),
    '',
    '## Pack Summaries',
    '',
    ...report.packs.map(pack =>
      `- ${pack.video_type}: ${pack.status}; fields=${pack.required_field_count}; samples=${pack.sample_entry_count}; layers=${pack.prompt_layer_count}; issues=${pack.unknown_required_fields.length + pack.duplicate_required_fields.length}`,
    ),
    '',
    '## Issues',
    '',
    ...(report.issues.length
      ? report.issues.map(issue => `- [${issue.severity}] ${issue.video_type ?? 'portfolio'} · ${issue.issue_type}: ${issue.message}`)
      : ['- none']),
  ].join('\n').trim() + '\n';
}

function renderDomainPackProductionHealthMarkdown(report: DomainPackProductionHealthReport): string {
  return [
    '# Domain Pack Production Health',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> domain_id: ${report.domain_id}`,
    `> version: ${report.version}`,
    '',
    '## Summary',
    '',
    `- status: ${report.status}`,
    `- pack_count: ${report.pack_count}`,
    `- production_pack_count: ${report.production_pack_count}`,
    `- required_pack_count: ${report.required_pack_ids.length}`,
    `- covered_required_pack_count: ${report.covered_required_pack_ids.length}`,
    `- missing_required_pack_ids: ${report.missing_required_pack_ids.join(', ') || 'none'}`,
    `- production_ready_pack_count: ${report.production_ready_pack_ids.length}/${report.required_pack_ids.length}`,
    `- issue_count: ${report.issues.length}`,
    '',
    '## Required Production Packs',
    '',
    ...report.packs.map(pack =>
      `- ${pack.pack_id}: ${pack.status}; triggers=${pack.trigger_word_count}; prompts=${pack.production_prompt_count}; boundaries=${pack.review_boundary_count}`,
    ),
    '',
    '## Issues',
    '',
    ...(report.issues.length
      ? report.issues.map(issue => `- [${issue.severity}] ${issue.pack_id ?? issue.entry_name ?? 'portfolio'} · ${issue.issue_type}: ${issue.message}`)
      : ['- none']),
  ].join('\n').trim() + '\n';
}

function renderGearsExecutionWorkerEvidenceBundleMarkdown(
  bundle: Omit<GearsExecutionWorkerEvidenceBundle, 'markdown'>,
): string {
  const lines: string[] = [
    '# GEARS v2 Worker Evidence Bundle',
    '',
    `> schema_version: ${bundle.schema_version}`,
    `> generated_at: ${bundle.generated_at}`,
    '',
    '## Summary',
    '',
    `- status: ${bundle.status}`,
    `- readiness_status: ${bundle.readiness_status}`,
    `- readiness_score: ${bundle.readiness_score}`,
    `- local_smoke: ${bundle.local_smoke_passed_count}/${bundle.local_smoke_total_count}`,
    `- live_e2e: ${bundle.live_ready_step_count}/${bundle.live_total_step_count} (${bundle.live_e2e_ready ? 'ready' : 'blocked'})`,
    `- pressure_status: ${bundle.pressure_status}`,
    `- generated_project_pressure_status: ${bundle.generated_project_pressure_status}`,
    `- generated_project_ledgers: ${bundle.generated_project_with_ledger_count}`,
    `- generated_project_jobs: ${bundle.generated_project_total_job_count}`,
    `- generated_health_status: ${bundle.generated_health_status}`,
    `- generated_health_ready_count: ${bundle.generated_health_ready_count}`,
    `- generated_health_planned_count: ${bundle.generated_health_planned_count}`,
    `- generated_health_production_gap_count: ${bundle.generated_health_production_gap_count}`,
    `- generated_health_interrupted_count: ${bundle.generated_health_interrupted_count}`,
    `- story_agent_mvp_status: ${bundle.story_agent_mvp_status}`,
    `- story_agent_mvp_score: ${bundle.story_agent_mvp_score}`,
    `- production_material_pack_status: ${bundle.production_material_pack_status}`,
    `- production_material_pack_issues: ${bundle.production_material_pack_issue_count}`,
    `- production_material_core_ready: ${bundle.production_material_pack_core_ready_count}/${bundle.production_material_pack_core_total_count}`,
    `- domain_pack_status: ${bundle.domain_pack_status}`,
    `- domain_pack_issues: ${bundle.domain_pack_issue_count}`,
    `- domain_pack_ready: ${bundle.domain_pack_ready_count}/${bundle.domain_pack_required_count}`,
    `- acceptance: ${bundle.acceptance_passed_count}/${bundle.acceptance_total_count}`,
    `- worker_kit_commands: ${bundle.command_count}`,
    `- worker_kit_payloads: ${bundle.payload_count}`,
    '',
    '## Required Envs',
    '',
    ...(bundle.required_envs.length ? bundle.required_envs.map(item => `- ${item}`) : ['- none']),
    '',
    '## Blocking Checks',
    '',
    ...(bundle.blocking_check_ids.length ? bundle.blocking_check_ids.map(item => `- ${item}`) : ['- none']),
    '',
    '## Warning Checks',
    '',
    ...(bundle.warning_check_ids.length ? bundle.warning_check_ids.map(item => `- ${item}`) : ['- none']),
    '',
    '## Evidence Documents',
    '',
    ...bundle.documents.map(doc => `- ${doc.filename} · ${doc.label} · ${doc.source_endpoint} · ${doc.content_length} chars`),
    '',
    '## Operator Checklist',
    '',
    ...bundle.operator_checklist.map(item => `- ${item}`),
    '',
    '## Recommended Next Actions',
    '',
    ...bundle.recommended_next_actions.map(item => `- ${item}`),
  ];

  for (const document of bundle.documents) {
    lines.push(
      '',
      '---',
      '',
      `## Embedded Document: ${document.label}`,
      '',
      `> source: ${document.source_endpoint}`,
      `> filename: ${document.filename}`,
      '',
      document.content.trim(),
    );
  }

  return `${lines.join('\n').trim()}\n`;
}

export async function getGearsExecutionWorkerEvidenceBundle(): Promise<GearsExecutionWorkerEvidenceBundle> {
  const acceptance = await getGearsExecutionAcceptanceReport();
  const kit = await getGearsExecutionWorkerAcceptanceKit();
  const smokePackage = getGearsExecutionSmokePackage();
  const pressure = getGearsExecutionPressureReport();
  const generatedPressure = await getGearsExecutionGeneratedProjectPressureReport();
  const generatedHealth = await getStoryAgentGeneratedHealth({ limit: 50 });
  const mvpStatus = await getStoryAgentMvpStatus({ generatedLimit: 50, portfolioLimit: 50 });
  const productionMaterialPackHealth = getProductionMaterialPackHealthReport();
  const domainPackHealth = getDomainPackProductionHealthReport();
  const documents = [
    workerEvidenceDocument(
      'acceptance_report',
      'Worker acceptance report',
      'gears-worker-acceptance-report.md',
      '/api/system/gears-execution-acceptance-report',
      acceptance.markdown,
      'Aggregated readiness, live E2E blockers, pressure, generated project risks, and handoff artifacts.',
    ),
    workerEvidenceDocument(
      'worker_acceptance_kit',
      'Worker acceptance kit',
      'gears-worker-acceptance-kit.md',
      '/api/system/gears-execution-worker-acceptance-kit',
      kit.markdown,
      'Executable env template, payload file writers, curl commands, and expected assertions for GEARS v2 smoke.',
    ),
    workerEvidenceDocument(
      'smoke_handoff_package',
      'Smoke handoff package',
      'gears-smoke-handoff-package.md',
      '/api/system/gears-execution-smoke-package',
      smokePackage.markdown,
      'Submit/status/project callback/series callback request and response examples for GEARS worker implementation.',
    ),
    workerEvidenceDocument(
      'pressure_report',
      'Local pressure report',
      'gears-pressure-report.md',
      '/api/system/gears-execution-pressure-report',
      pressure.markdown,
      'Local callback batch and callback event retention boundary proof.',
    ),
    workerEvidenceDocument(
      'generated_project_pressure_report',
      'Generated project pressure report',
      'gears-generated-project-pressure-report.md',
      '/api/system/gears-execution-generated-project-pressure',
      generatedPressure.markdown,
      'Scan of generated story and AI comic series GEARS ledgers for real project pressure risks.',
    ),
    workerEvidenceDocument(
      'generated_health_report',
      'Story Agent generated health report',
      'story-agent-generated-health-report.md',
      '/api/system/story-agent-generated-health',
      generatedHealth.markdown,
      'Read-only health scan of generated Story Agent projects before selecting GEARS worker smoke targets.',
    ),
    workerEvidenceDocument(
      'story_agent_mvp_status_report',
      'Story Agent MVP status report',
      'story-agent-mvp-status-report.md',
      '/api/system/story-agent-mvp-status',
      mvpStatus.markdown,
      'Read-only Story Agent MVP lane summary combining generated health and production readiness before GEARS sign-off.',
    ),
    workerEvidenceDocument(
      'production_material_pack_health_report',
      'Production material pack health report',
      'production-material-pack-health-report.md',
      '/api/system/production-material-pack-health',
      renderProductionMaterialPackHealthMarkdown(productionMaterialPackHealth),
      'Read-only template portfolio gate proving core and high-frequency video type production packs are mapped and sufficiently filled before GEARS worker sign-off.',
    ),
    workerEvidenceDocument(
      'domain_pack_production_health_report',
      'Domain Pack production health report',
      'domain-pack-production-health-report.md',
      '/api/system/domain-pack-production-health',
      renderDomainPackProductionHealthMarkdown(domainPackHealth),
      'Read-only production prompt pack gate proving Domain Packs have trigger words, production prompts, review boundaries, and asset usage coverage before GEARS worker sign-off.',
    ),
  ];
  const recommendedNextActions = [...new Set([
    ...acceptance.recommended_next_actions,
    'Export this evidence bundle before GEARS v2 worker handoff.',
    'Run the worker acceptance kit commands in order and attach submit/status/callback responses to the evidence record.',
    'Attach gears-worker-response-audit.json after every real worker run to record response shape compatibility and failure taxonomy gaps.',
    'Attach gears-worker-acceptance-verdict.json as the final machine-readable sign-off gate for the worker run.',
    'Attach gears-worker-acceptance-archive.json/.md and gears-worker-acceptance-checksums.json/.md to prove the handoff evidence inventory and sha256 checksums.',
    'Attach gears-worker-acceptance-integrity.json/.md to prove the checksum manifest was verified after archive generation.',
    'Attach gears-worker-evidence-signoff.json/.md as the final post-archive Web signoff snapshot.',
    'Read GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=... or MCP kb_get_gears_worker_evidence_signoff after the run to produce the final signoff summary.',
    'Attach story-agent-mvp-status-before.json, story-agent-mvp-status-after.json, and story-agent-mvp-status-audit.json/.md to prove MVP status did not regress during worker smoke.',
    'Attach production-material-pack-health-before.json, production-material-pack-health-after.json, and production-material-pack-health-audit.json/.md to prove production template health stayed passed during worker smoke.',
    'Attach domain-pack-production-health-before.json, domain-pack-production-health-after.json, and domain-pack-production-health-audit.json/.md to prove production prompt pack health stayed passed during worker smoke.',
    'Replay project and series callbacks once to confirm duplicate_count and ledger idempotency.',
    'After basic smoke passes, enable GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1 once and attach the large-project pressure response.',
  ])];
  const bundle: Omit<GearsExecutionWorkerEvidenceBundle, 'markdown'> = {
    provider: 'gears',
    schema_version: 'gears-execution-worker-evidence-bundle/v1',
    status: acceptance.status,
    readiness_status: acceptance.readiness_status,
    readiness_score: acceptance.readiness_score,
    local_smoke_passed_count: acceptance.local_smoke_passed_count,
    local_smoke_total_count: acceptance.local_smoke_total_count,
    live_e2e_ready: acceptance.live_e2e_ready,
    live_ready_step_count: acceptance.live_ready_step_count,
    live_total_step_count: acceptance.live_total_step_count,
    pressure_status: acceptance.pressure_status,
    generated_project_pressure_status: acceptance.generated_project_pressure_status,
    generated_project_with_ledger_count: acceptance.generated_project_with_ledger_count,
    generated_project_total_job_count: acceptance.generated_project_total_job_count,
    generated_health_status: acceptance.generated_health_status,
    generated_health_ready_count: acceptance.generated_health_ready_count,
    generated_health_planned_count: acceptance.generated_health_planned_count,
    generated_health_production_gap_count: acceptance.generated_health_production_gap_count,
    generated_health_interrupted_count: acceptance.generated_health_interrupted_count,
    story_agent_mvp_status: mvpStatus.status,
    story_agent_mvp_score: mvpStatus.score,
    production_material_pack_status: productionMaterialPackHealth.status,
    production_material_pack_issue_count: productionMaterialPackHealth.issues.length,
    production_material_pack_core_ready_count: productionMaterialPackHealth.production_ready_core_video_types.length,
    production_material_pack_core_total_count: productionMaterialPackHealth.core_video_types.length,
    domain_pack_status: domainPackHealth.status,
    domain_pack_issue_count: domainPackHealth.issues.length,
    domain_pack_ready_count: domainPackHealth.production_ready_pack_ids.length,
    domain_pack_required_count: domainPackHealth.required_pack_ids.length,
    acceptance_passed_count: acceptance.acceptance_passed_count,
    acceptance_total_count: acceptance.acceptance_total_count,
    command_count: kit.commands.length,
    payload_count: kit.payloads.length,
    required_envs: acceptance.required_envs,
    blocking_check_ids: acceptance.blocking_check_ids,
    warning_check_ids: acceptance.warning_check_ids,
    documents,
    operator_checklist: [
      'Confirm Story Agent backend and frontend are running.',
      'Export worker acceptance kit Markdown/JSON from the project or series workspace.',
      'Set every required GEARS_* environment variable listed in the kit.',
      'Write payload files from the kit and run submit/status/callback commands in order.',
      'Save GEARS worker responses and Story Agent callback responses next to this evidence bundle.',
      'Attach gears-worker-response-audit.json to summarize worker ids, source ids, statuses, error codes, and failure categories.',
      'Attach gears-worker-acceptance-verdict.json and require acceptance_passed=true for sign-off.',
      'Attach gears-worker-acceptance-archive.json/.md and require signoff_ready=true with no missing required attachments.',
      'Attach gears-worker-acceptance-checksums.json/.md so GEARS v2 can verify evidence files by sha256.',
      'Attach gears-worker-acceptance-integrity.json/.md and require integrity_passed=true before handoff.',
      'Attach gears-worker-evidence-signoff.json/.md as the final post-archive signoff snapshot.',
      'Read worker evidence signoff through Web API or MCP and attach the signoff Markdown / JSON summary.',
      'Attach story-agent-mvp-status-report.md to show Story Agent MVP lane status before GEARS worker sign-off.',
      'Attach story-agent-mvp-status-audit.json/.md and require status=passed or warning with no failed_checks before sign-off.',
      'Attach production-material-pack-health-report.md and production-material-pack-health-audit.json/.md to prove video type templates are production-ready before GEARS worker sign-off.',
      'Attach domain-pack-production-health-report.md and domain-pack-production-health-audit.json/.md to prove production prompt packs are production-ready before GEARS worker sign-off.',
      'Attach story-agent-generated-health-audit.json/.md and require status=passed before sign-off.',
      'Replay callback payloads once to prove duplicate_count is reported and no duplicate artifacts are created.',
      'Generate the 30-episode pressure payload and submit it only after basic smoke is green.',
      'Run generated project pressure audit after the worker smoke to confirm no blocked ledger risk appeared.',
      'Run generated health audit before and after smoke to confirm the selected target is not planned-only or interrupted.',
    ],
    recommended_next_actions: recommendedNextActions,
    generated_at: new Date().toISOString(),
  };

  return {
    ...bundle,
    markdown: renderGearsExecutionWorkerEvidenceBundleMarkdown(bundle),
  };
}

interface EvidenceJsonRead {
  filename: string;
  exists: boolean;
  parse_ok: boolean;
  data?: Record<string, unknown>;
  parse_error?: string;
}

function repoRoot(): string {
  return resolve(kbRoot(), '..');
}

function isPathInside(rootPath: string, targetPath: string): boolean {
  const rel = relative(rootPath, targetPath);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

type WorkerEvidenceDirSource = 'input' | 'env' | 'latest' | 'missing';

function allowedWorkerEvidenceRoots(): string[] {
  return [
    resolve('/private/tmp'),
    resolve('/tmp'),
    process.env.TMPDIR ? resolve(process.env.TMPDIR) : undefined,
    repoRoot(),
  ].filter((value): value is string => Boolean(value));
}

function evidenceAutoDiscoverEnabled(): boolean {
  const raw = process.env.GEARS_EVIDENCE_AUTO_DISCOVER?.trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

function workerEvidenceDiscoveryRoots(): string[] {
  const allowedRoots = allowedWorkerEvidenceRoots();
  const override = process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS?.trim();
  if (!override) return Array.from(new Set(allowedRoots));
  const roots = override
    .split(delimiter)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => resolve(isAbsolute(item) ? item : resolve(repoRoot(), item)))
    .filter(item => allowedRoots.some(root => isPathInside(root, item)));
  return roots.length ? Array.from(new Set(roots)) : Array.from(new Set(allowedRoots));
}

function isWorkerEvidenceDirectoryName(name: string): boolean {
  return name.startsWith('gears-worker-evidence');
}

async function evidenceCandidateMtimeMs(evidenceDir: string): Promise<number | null> {
  const required = [
    'gears-worker-acceptance-verdict.json',
    'gears-worker-acceptance-archive.json',
    'gears-worker-acceptance-integrity.json',
  ];
  let newest = 0;
  for (const filename of required) {
    try {
      const fileStat = await stat(resolve(evidenceDir, filename));
      newest = Math.max(newest, fileStat.mtimeMs);
    } catch {
      // Missing one sentinel is acceptable while scanning; a directory is a candidate
      // when at least one final signoff artifact exists.
    }
  }
  if (newest > 0) return newest;
  return null;
}

async function findLatestWorkerEvidenceDir(): Promise<string | undefined> {
  const candidates: Array<{ evidenceDir: string; mtimeMs: number }> = [];
  for (const root of workerEvidenceDiscoveryRoots()) {
    let entries: Dirent[];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !isWorkerEvidenceDirectoryName(entry.name)) continue;
      const evidenceDir = resolve(root, entry.name);
      if (!allowedWorkerEvidenceRoots().some(allowedRoot => isPathInside(allowedRoot, evidenceDir))) continue;
      const mtimeMs = await evidenceCandidateMtimeMs(evidenceDir);
      if (mtimeMs !== null) {
        candidates.push({ evidenceDir, mtimeMs });
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || right.evidenceDir.localeCompare(left.evidenceDir));
  return candidates[0]?.evidenceDir;
}

function resolveExplicitWorkerEvidenceDir(raw: string, source: WorkerEvidenceDirSource): {
  evidenceDir?: string;
  source: WorkerEvidenceDirSource;
  allowed: boolean;
  error?: string;
} {
  if (raw.includes('\0')) {
    return {
      source,
      allowed: false,
      error: 'invalid_evidence_dir',
    };
  }
  const normalized = resolve(isAbsolute(raw) ? raw : resolve(repoRoot(), raw));
  const allowedRoots = [
    resolve('/private/tmp'),
    resolve('/tmp'),
    process.env.TMPDIR ? resolve(process.env.TMPDIR) : undefined,
    repoRoot(),
  ].filter((value): value is string => Boolean(value));
  if (!allowedRoots.some(root => isPathInside(root, normalized))) {
    return {
      evidenceDir: normalized,
      source,
      allowed: false,
      error: 'evidence_dir_not_allowed',
    };
  }
  return {
    evidenceDir: normalized,
    source,
    allowed: true,
  };
}

async function resolveWorkerEvidenceDir(input?: string): Promise<{
  evidenceDir?: string;
  source: WorkerEvidenceDirSource;
  allowed: boolean;
  error?: string;
}> {
  const inputRaw = input?.trim();
  if (inputRaw) return resolveExplicitWorkerEvidenceDir(inputRaw, 'input');
  const envRaw = process.env.GEARS_EVIDENCE_DIR?.trim();
  if (envRaw) return resolveExplicitWorkerEvidenceDir(envRaw, 'env');
  if (evidenceAutoDiscoverEnabled()) {
    const latest = await findLatestWorkerEvidenceDir();
    if (latest) return resolveExplicitWorkerEvidenceDir(latest, 'latest');
  }
  return {
    source: 'missing',
    allowed: false,
    error: 'missing_evidence_dir',
  };
}

async function readEvidenceJson(evidenceDir: string, filename: string): Promise<EvidenceJsonRead> {
  try {
    const parsed = JSON.parse(await readFile(resolve(evidenceDir, filename), 'utf-8')) as unknown;
    return {
      filename,
      exists: true,
      parse_ok: Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed),
      data: Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : undefined,
      parse_error: Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed)
        ? undefined
        : 'json_root_not_object',
    };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    return {
      filename,
      exists: false,
      parse_ok: false,
      parse_error: code === 'ENOENT' ? 'missing_file' : error instanceof Error ? error.message : String(error),
    };
  }
}

function evidenceNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

type MvpGovernanceCountMetric = 'before' | 'after' | 'delta';
type MvpGovernanceCounts = Record<string, Record<MvpGovernanceCountMetric, number>>;

const MVP_GOVERNANCE_COUNT_KEYS = [
  'seedance_placeholder_asset_count',
  'seedance_production_asset_ready_count',
  'knowledge_writeback_ready_count',
  'knowledge_writeback_queued_count',
  'knowledge_writeback_needs_revision_count',
] as const;

const MVP_GOVERNANCE_COUNT_METRICS = ['before', 'after', 'delta'] as const satisfies readonly MvpGovernanceCountMetric[];

function evidenceMvpGovernanceCountsFromAudit(
  beforeSummary: Record<string, unknown>,
  afterSummary: Record<string, unknown>,
  deltas: Record<string, unknown>,
): MvpGovernanceCounts {
  return Object.fromEntries(MVP_GOVERNANCE_COUNT_KEYS.map(key => [
    key,
    {
      before: evidenceNumber(beforeSummary[key]),
      after: evidenceNumber(afterSummary[key]),
      delta: evidenceNumber(deltas[key]),
    },
  ])) as MvpGovernanceCounts;
}

function evidenceMvpGovernanceCounts(value: unknown): MvpGovernanceCounts | undefined {
  const root = evidenceObject(value);
  const entries = MVP_GOVERNANCE_COUNT_KEYS.map(key => {
    const record = evidenceObject(root[key]);
    const hasAllMetrics = MVP_GOVERNANCE_COUNT_METRICS.every(metric => Object.prototype.hasOwnProperty.call(record, metric));
    if (!hasAllMetrics) return undefined;
    return [
      key,
      {
        before: evidenceNumber(record.before),
        after: evidenceNumber(record.after),
        delta: evidenceNumber(record.delta),
      },
    ] as const;
  });
  if (entries.some(item => item === undefined)) return undefined;
  return Object.fromEntries(entries as Array<readonly [string, Record<MvpGovernanceCountMetric, number>]>) as MvpGovernanceCounts;
}

function compareMvpGovernanceCounts(
  source: 'verdict' | 'archive',
  actual: MvpGovernanceCounts | undefined,
  expected: MvpGovernanceCounts,
): string[] {
  if (!actual) return [`${source}.missing`];
  const mismatches: string[] = [];
  for (const key of MVP_GOVERNANCE_COUNT_KEYS) {
    for (const metric of MVP_GOVERNANCE_COUNT_METRICS) {
      if (actual[key]?.[metric] !== expected[key][metric]) {
        mismatches.push(`${source}.${key}.${metric}`);
      }
    }
  }
  return mismatches;
}

function evidenceBool(value: unknown): boolean {
  return value === true;
}

function evidencePublicExternalArtifactUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host === '0.0.0.0' || host === '::1') return false;
  if (host.endsWith('.local')) return false;
  if (
    host.includes('gears.example')
    || host.includes('story-agent.example')
    || host.includes('local.story-agent.invalid')
  ) {
    return false;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
  const private172 = host.match(/^172\.(\d{1,3})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return false;
  }
  return true;
}

function evidenceObject(value: unknown): Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function evidenceApiData(value: unknown): Record<string, unknown> {
  const root = evidenceObject(value);
  const data = evidenceObject(root.data);
  return Object.keys(data).length ? data : root;
}

function evidenceArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function evidenceStringArray(value: unknown): string[] {
  return evidenceArray(value).filter((item): item is string => typeof item === 'string');
}

function evidenceStringMatchCount(value: unknown, expected: string, seen = new Set<unknown>()): number {
  if (!expected) return 0;
  if (typeof value === 'string') return value === expected ? 1 : 0;
  if (!value || typeof value !== 'object') return 0;
  if (seen.has(value)) return 0;
  seen.add(value);
  let matchCount = 0;
  if (Array.isArray(value)) {
    for (const item of value) {
      matchCount += evidenceStringMatchCount(item, expected, seen);
    }
    return matchCount;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    matchCount += evidenceStringMatchCount(item, expected, seen);
  }
  return matchCount;
}

function evidenceNumberRecord(value: unknown): Record<string, number> {
  const record = evidenceObject(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, item]) => [key, evidenceNumber(item)] as const)
      .filter(([, item]) => item !== 0),
  );
}

function evidenceActions(value: unknown): GearsExecutionWorkerEvidenceSignoffAction[] {
  return evidenceArray(value)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      priority: typeof item.priority === 'string' ? item.priority : undefined,
      owner: typeof item.owner === 'string' ? item.owner : undefined,
      action: typeof item.action === 'string' ? item.action : 'Inspect evidence record.',
      evidence: typeof item.evidence === 'string' ? item.evidence : undefined,
      gate_id: typeof item.gate_id === 'string' ? item.gate_id : undefined,
      sample_files: evidenceStringArray(item.sample_files),
      sample_paths: evidenceStringArray(item.sample_paths),
    }));
}

function dedupeEvidenceActions(
  actions: GearsExecutionWorkerEvidenceSignoffAction[],
): GearsExecutionWorkerEvidenceSignoffAction[] {
  const seen = new Set<string>();
  return actions.filter(action => {
    const key = [
      action.priority ?? '',
      action.owner ?? '',
      action.evidence ?? '',
      action.gate_id ?? '',
      action.action,
      action.sample_files?.join('|') ?? '',
      action.sample_paths?.join('|') ?? '',
    ].join('\u001f');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderGearsExecutionWorkerEvidenceSignoffMarkdown(
  report: Omit<GearsExecutionWorkerEvidenceSignoffReport, 'markdown'>,
): string {
  const lines = [
    '# GEARS Worker Evidence Signoff',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> evidence_dir: ${report.evidence_dir ?? 'unset'}`,
    `> evidence_dir_source: ${report.evidence_dir_source ?? 'missing'}`,
    '',
    '## Summary',
    '',
    `- status: ${report.status}`,
    `- acceptance_passed: ${report.acceptance_passed}`,
    `- signoff_ready: ${report.signoff_ready}`,
    `- integrity_passed: ${report.integrity_passed}`,
    `- health_audit_passed: ${report.health_audit_passed}`,
    `- production_material_pack_health_audit_passed: ${report.production_material_pack_health_audit_passed}`,
    `- domain_pack_production_health_audit_passed: ${report.domain_pack_production_health_audit_passed}`,
    `- mvp_status_audit_passed: ${report.mvp_status_audit_passed}`,
    `- mvp_governance_counts_consistent: ${report.mvp_governance_counts_consistent}`,
    `- mvp_governance_counts_embedded verdict/archive: ${report.mvp_governance_counts_verdict_embedded}/${report.mvp_governance_counts_archive_embedded}`,
    `- mvp_governance_count_mismatch_ids: ${report.mvp_governance_count_mismatch_ids.join(', ') || 'none'}`,
    `- system_external_callback_passed: ${report.system_external_callback_passed}`,
    `- system_external_output_url_source: ${report.system_external_output_url_source}`,
    `- system_external_output_url_source_ready: ${report.system_external_output_url_source_ready}`,
    `- system_external_output_url_imported: ${report.system_external_output_url_imported}`,
    `- system_external_output_url_import_match_count: ${report.system_external_output_url_import_match_count}`,
    `- system_external_output_url_configured_from_env: ${report.system_external_output_url_configured_from_env}`,
    `- system_external_callback_ready/updated: ${report.system_external_callback_ready_to_import_count}/${report.system_external_callback_updated_count}`,
    `- system_external_callback_blocking/failed/unresolved: ${report.system_external_callback_blocking_count}/${report.system_external_callback_failed_count}/${report.system_external_callback_unresolved_count}`,
    `- pressure_submitted: ${report.pressure_submitted}`,
    `- gates passed/failed/skipped/total: ${report.gate_counts.passed}/${report.gate_counts.failed}/${report.gate_counts.skipped}/${report.gate_counts.total}`,
    `- failed_gate_ids: ${report.failed_gate_ids.join(', ') || 'none'}`,
    `- missing_required_attachment_count: ${report.missing_required_attachment_count}/${report.required_attachment_count}`,
    `- worker_record_count: ${report.worker_record_count}`,
    `- worker_transport/http_errors: ${report.worker_transport_error_count}/${report.worker_http_error_count}`,
    `- worker_failure_categories: ${Object.entries(report.worker_failure_category_counts).map(([key, count]) => `${key}=${count}`).join(', ') || 'none'}`,
    `- callback_transport/http_errors: ${report.callback_transport_error_count}/${report.callback_http_error_count}`,
    `- callback_ledger_match_missing_count: ${report.callback_ledger_match_missing_count}`,
    `- health_ready_delta: ${report.health_ready_count_delta}`,
    `- health_interrupted_delta: ${report.health_interrupted_count_delta}`,
    `- production_material_pack_status_before/after: ${report.production_material_pack_status_before ?? 'n/a'}/${report.production_material_pack_status_after ?? 'n/a'}`,
    `- production_material_pack_issue_delta: ${report.production_material_pack_issue_count_delta}`,
    `- production_material_pack_core_ready_before/after: ${report.production_material_pack_core_ready_count_before}/${report.production_material_pack_core_ready_count_after}`,
    `- domain_pack_status_before/after: ${report.domain_pack_status_before ?? 'n/a'}/${report.domain_pack_status_after ?? 'n/a'}`,
    `- domain_pack_issue_delta: ${report.domain_pack_issue_count_delta}`,
    `- domain_pack_ready_before/after: ${report.domain_pack_ready_count_before}/${report.domain_pack_ready_count_after}`,
    `- mvp_status_before/after: ${report.mvp_status_before ?? 'n/a'}/${report.mvp_status_after ?? 'n/a'}`,
    `- mvp_score_delta: ${report.mvp_score_delta}`,
    `- mvp_seedance_placeholder_before/after/delta: ${report.mvp_seedance_placeholder_asset_count_before}/${report.mvp_seedance_placeholder_asset_count_after}/${report.mvp_seedance_placeholder_asset_count_delta}`,
    `- mvp_seedance_production_ready_before/after/delta: ${report.mvp_seedance_production_asset_ready_count_before}/${report.mvp_seedance_production_asset_ready_count_after}/${report.mvp_seedance_production_asset_ready_count_delta}`,
    `- mvp_knowledge_writeback_ready_before/after/delta: ${report.mvp_knowledge_writeback_ready_count_before}/${report.mvp_knowledge_writeback_ready_count_after}/${report.mvp_knowledge_writeback_ready_count_delta}`,
    `- mvp_knowledge_writeback_queued_before/after/delta: ${report.mvp_knowledge_writeback_queued_count_before}/${report.mvp_knowledge_writeback_queued_count_after}/${report.mvp_knowledge_writeback_queued_count_delta}`,
    `- mvp_knowledge_writeback_needs_revision_before/after/delta: ${report.mvp_knowledge_writeback_needs_revision_count_before}/${report.mvp_knowledge_writeback_needs_revision_count_after}/${report.mvp_knowledge_writeback_needs_revision_count_delta}`,
    `- large_project_source_echo: ${report.large_project_source_echo_count}/${report.large_project_request_unit_count}`,
    `- large_project_records/accepted/rejected/failed: ${report.large_project_response_record_count}/${report.large_project_accepted_count}/${report.large_project_rejected_count}/${report.large_project_failed_count}`,
    `- large_project_duplicate/unexpected_sources: ${report.large_project_duplicate_source_id_count}/${report.large_project_unexpected_source_count}`,
    '',
    '## Gates',
    '',
    ...(report.gates.length
      ? report.gates.map(gate => `- ${gate.id}: ${gate.status}${gate.summary ? ` - ${gate.summary}` : ''}`)
      : ['- none']),
    '',
    '## Missing Required Files',
    '',
    ...(report.missing_required_files.length ? report.missing_required_files.map(file => `- ${file}`) : ['- none']),
    '',
    '## Recommended Actions',
    '',
    ...(report.recommended_actions.length
      ? report.recommended_actions.map(item =>
        `- [${item.priority ?? 'P?'}] ${item.owner ?? 'unknown'}: ${item.action} (${item.evidence ?? 'evidence'}; gate=${item.gate_id ?? 'n/a'})`,
      )
      : ['- none']),
  ];
  return `${lines.join('\n').trim()}\n`;
}

export async function getGearsExecutionWorkerEvidenceSignoffReport(
  options: { evidence_dir?: string } = {},
): Promise<GearsExecutionWorkerEvidenceSignoffReport> {
  const resolvedDir = await resolveWorkerEvidenceDir(options.evidence_dir);
  const generatedAt = new Date().toISOString();
  if (!resolvedDir.allowed || !resolvedDir.evidenceDir) {
    const report: Omit<GearsExecutionWorkerEvidenceSignoffReport, 'markdown'> = {
      provider: 'gears',
      schema_version: 'gears-execution-worker-evidence-signoff/v1',
      status: 'blocked',
      evidence_dir: resolvedDir.evidenceDir,
      evidence_dir_source: resolvedDir.source,
      evidence_dir_allowed: false,
      evidence_dir_error: resolvedDir.error,
      acceptance_passed: false,
      signoff_ready: false,
      integrity_passed: false,
      health_audit_passed: false,
      production_material_pack_health_audit_passed: false,
      domain_pack_production_health_audit_passed: false,
      mvp_status_audit_passed: false,
      mvp_governance_counts_consistent: false,
      mvp_governance_counts_verdict_embedded: false,
      mvp_governance_counts_archive_embedded: false,
      mvp_governance_count_mismatch_ids: [],
      system_external_callback_passed: false,
      system_external_callback_ready_to_import_count: 0,
      system_external_callback_updated_count: 0,
      system_external_callback_blocking_count: 0,
      system_external_callback_failed_count: 0,
      system_external_callback_unresolved_count: 0,
      system_external_callback_project_count: 0,
      system_external_output_url_source_ready: false,
      system_external_output_url_imported: false,
      system_external_output_url_import_match_count: 0,
      system_external_output_url_configured_from_env: false,
      system_external_output_url_source: 'missing',
      pressure_submitted: false,
      gate_counts: { passed: 0, failed: 1, skipped: 0, total: 1 },
      failed_gate_ids: ['evidence_dir'],
      skipped_gate_ids: [],
      missing_required_attachment_count: 0,
      required_attachment_count: 0,
      required_checksum_count: 0,
      evidence_file_count: 0,
      worker_record_count: 0,
      worker_transport_error_count: 0,
      worker_http_error_count: 0,
      worker_unknown_count: 0,
      worker_missing_worker_id_count: 0,
      worker_missing_source_id_count: 0,
      worker_missing_ready_artifact_count: 0,
      worker_failure_category_counts: {},
      callback_transport_error_count: 0,
      callback_http_error_count: 0,
      callback_ledger_match_missing_count: 0,
      callback_failed_count: 0,
      health_ready_count_before: 0,
      health_ready_count_after: 0,
      health_ready_count_delta: 0,
      health_interrupted_count_delta: 0,
      health_production_gap_count_delta: 0,
      production_material_pack_issue_count_before: 0,
      production_material_pack_issue_count_after: 0,
      production_material_pack_issue_count_delta: 0,
      production_material_pack_core_ready_count_before: 0,
      production_material_pack_core_ready_count_after: 0,
      domain_pack_issue_count_before: 0,
      domain_pack_issue_count_after: 0,
      domain_pack_issue_count_delta: 0,
      domain_pack_ready_count_before: 0,
      domain_pack_ready_count_after: 0,
      mvp_score_before: 0,
      mvp_score_after: 0,
      mvp_score_delta: 0,
      mvp_seedance_placeholder_asset_count_before: 0,
      mvp_seedance_placeholder_asset_count_after: 0,
      mvp_seedance_placeholder_asset_count_delta: 0,
      mvp_seedance_production_asset_ready_count_before: 0,
      mvp_seedance_production_asset_ready_count_after: 0,
      mvp_seedance_production_asset_ready_count_delta: 0,
      mvp_knowledge_writeback_ready_count_before: 0,
      mvp_knowledge_writeback_ready_count_after: 0,
      mvp_knowledge_writeback_ready_count_delta: 0,
      mvp_knowledge_writeback_queued_count_before: 0,
      mvp_knowledge_writeback_queued_count_after: 0,
      mvp_knowledge_writeback_queued_count_delta: 0,
      mvp_knowledge_writeback_needs_revision_count_before: 0,
      mvp_knowledge_writeback_needs_revision_count_after: 0,
      mvp_knowledge_writeback_needs_revision_count_delta: 0,
      large_project_request_unit_count: 0,
      large_project_response_record_count: 0,
      large_project_accepted_count: 0,
      large_project_rejected_count: 0,
      large_project_failed_count: 0,
      large_project_source_echo_count: 0,
      large_project_missing_requested_source_count: 0,
      large_project_duplicate_source_id_count: 0,
      large_project_unexpected_source_count: 0,
      required_files: [],
      missing_required_files: [],
      gates: [{
        id: 'evidence_dir',
        label: 'Evidence directory',
        status: 'failed',
        summary: resolvedDir.error,
      }],
      recommended_actions: [{
        priority: 'P0',
        owner: 'Story Agent smoke env',
        action: 'Set GEARS_EVIDENCE_DIR or pass an allowed evidence_dir query path under /private/tmp, /tmp, TMPDIR, or the repository.',
        evidence: resolvedDir.error,
      }],
      generated_at: generatedAt,
    };
    return {
      ...report,
      markdown: renderGearsExecutionWorkerEvidenceSignoffMarkdown(report),
    };
  }

  const [
    verdictRead,
    archiveRead,
    integrityRead,
    workerRead,
    callbackRead,
    systemExternalOutputSourceRead,
    systemExternalPreflightRead,
    systemExternalImportRead,
    healthRead,
    productionMaterialPackHealthRead,
    domainPackProductionHealthRead,
    mvpRead,
    pressureRead,
  ] = await Promise.all([
    readEvidenceJson(resolvedDir.evidenceDir, 'gears-worker-acceptance-verdict.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'gears-worker-acceptance-archive.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'gears-worker-acceptance-integrity.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'gears-worker-response-audit.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'story-agent-callback-response-audit.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'story-agent-system-external-output-url-source.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'story-agent-system-external-callback-preflight-response.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'story-agent-system-external-callback-import-response.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'story-agent-generated-health-audit.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'production-material-pack-health-audit.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'domain-pack-production-health-audit.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'story-agent-mvp-status-audit.json'),
    readEvidenceJson(resolvedDir.evidenceDir, 'gears-large-project-response-audit.json'),
  ]);
  const verdict = verdictRead.data;
  const archive = archiveRead.data;
  const integrity = integrityRead.data;
  const workerTotals = evidenceObject(workerRead.data?.totals);
  const callbackTotals = evidenceObject(callbackRead.data?.totals);
  const systemExternalOutputSource = evidenceObject(systemExternalOutputSourceRead.data);
  const systemExternalPreflightRoot = evidenceObject(systemExternalPreflightRead.data);
  const systemExternalImportRoot = evidenceObject(systemExternalImportRead.data);
  const systemExternalPreflight = evidenceApiData(systemExternalPreflightRead.data);
  const systemExternalImport = evidenceApiData(systemExternalImportRead.data);
  const healthBeforeSummary = evidenceObject(evidenceObject(healthRead.data?.before).summary);
  const healthAfterSummary = evidenceObject(evidenceObject(healthRead.data?.after).summary);
  const healthDeltas = evidenceObject(healthRead.data?.deltas);
  const productionPackBefore = evidenceObject(productionMaterialPackHealthRead.data?.before);
  const productionPackAfter = evidenceObject(productionMaterialPackHealthRead.data?.after);
  const productionPackDeltas = evidenceObject(productionMaterialPackHealthRead.data?.deltas);
  const domainPackBefore = evidenceObject(domainPackProductionHealthRead.data?.before);
  const domainPackAfter = evidenceObject(domainPackProductionHealthRead.data?.after);
  const domainPackDeltas = evidenceObject(domainPackProductionHealthRead.data?.deltas);
  const mvpBefore = evidenceObject(mvpRead.data?.before);
  const mvpAfter = evidenceObject(mvpRead.data?.after);
  const mvpBeforeSummary = evidenceObject(mvpBefore.summary);
  const mvpAfterSummary = evidenceObject(mvpAfter.summary);
  const mvpDeltas = evidenceObject(mvpRead.data?.deltas);
  const verdictMvpGate = evidenceArray(verdict?.gates)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .find(item => item.id === 'story_agent_mvp_status_audit');
  const expectedMvpGovernanceCounts = mvpRead.exists && mvpRead.parse_ok
    ? evidenceMvpGovernanceCountsFromAudit(mvpBeforeSummary, mvpAfterSummary, mvpDeltas)
    : undefined;
  const verdictMvpGovernanceCounts = evidenceMvpGovernanceCounts(verdict?.mvp_governance_counts)
    ?? evidenceMvpGovernanceCounts(evidenceObject(verdictMvpGate?.evidence).governance_counts);
  const archiveMvpGovernanceCounts = evidenceMvpGovernanceCounts(
    evidenceObject(evidenceObject(evidenceObject(archive?.audit_summaries).story_agent_mvp_status).governance_counts),
  );
  const mvpGovernanceCountMismatchIds = expectedMvpGovernanceCounts
    ? [
      ...compareMvpGovernanceCounts('verdict', verdictMvpGovernanceCounts, expectedMvpGovernanceCounts),
      ...compareMvpGovernanceCounts('archive', archiveMvpGovernanceCounts, expectedMvpGovernanceCounts),
    ]
    : ['mvp_status_audit.missing_or_invalid'];
  const mvpGovernanceCountsConsistent = Boolean(expectedMvpGovernanceCounts)
    && mvpGovernanceCountMismatchIds.length === 0;
  const pressureTotals = evidenceObject(pressureRead.data?.totals);
  const archiveTotals = evidenceObject(archive?.totals);
  const gates = evidenceArray(verdict?.gates)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      id: typeof item.id === 'string' ? item.id : 'unknown_gate',
      label: typeof item.label === 'string' ? item.label : undefined,
      status: typeof item.status === 'string' ? item.status : 'unknown',
      summary: typeof item.summary === 'string' ? item.summary : undefined,
    }));
  const requiredFiles = evidenceStringArray(archive?.required_attachments);
  const missingRequiredFiles = evidenceStringArray(archive?.missing_required_files);
  const acceptancePassed = evidenceBool(verdict?.acceptance_passed);
  const signoffReady = evidenceBool(archive?.signoff_ready);
  const integrityPassed = evidenceBool(integrity?.integrity_passed);
  const healthAuditPassed = healthRead.data?.status === 'passed';
  const productionMaterialPackHealthAuditPassed = productionMaterialPackHealthRead.data?.status === 'passed';
  const domainPackProductionHealthAuditPassed = domainPackProductionHealthRead.data?.status === 'passed';
  const mvpStatusAuditPassed = mvpRead.data?.status === 'passed' || mvpRead.data?.status === 'warning';
  const systemExternalOutputUrlSourceReady = systemExternalOutputSourceRead.exists
    && systemExternalOutputSourceRead.parse_ok
    && evidenceBool(systemExternalOutputSource.ready_for_external_import)
    && evidencePublicExternalArtifactUrl(systemExternalOutputSource.output_url)
    && (systemExternalOutputSource.source === 'env' || systemExternalOutputSource.source === 'worker_response')
    && systemExternalOutputSource.placeholder !== true;
  const systemExternalOutputUrlSource = typeof systemExternalOutputSource.source === 'string'
    ? systemExternalOutputSource.source
    : systemExternalOutputSourceRead.exists
      ? 'unknown'
      : 'missing';
  const systemExternalOutputUrl = typeof systemExternalOutputSource.output_url === 'string'
    ? systemExternalOutputSource.output_url.trim()
    : '';
  const systemExternalOutputUrlImportMatchCount = systemExternalOutputUrlSourceReady
    ? evidenceStringMatchCount(systemExternalImportRead.data, systemExternalOutputUrl)
    : 0;
  const systemExternalOutputUrlImported = systemExternalOutputUrlImportMatchCount > 0;
  const systemExternalCallbackPassed = systemExternalPreflightRead.exists
    && systemExternalPreflightRead.parse_ok
    && systemExternalImportRead.exists
    && systemExternalImportRead.parse_ok
    && systemExternalOutputUrlSourceReady
    && systemExternalOutputUrlImported
    && (!('ok' in systemExternalPreflightRoot) || evidenceBool(systemExternalPreflightRoot.ok))
    && (!('ok' in systemExternalImportRoot) || evidenceBool(systemExternalImportRoot.ok))
    && systemExternalPreflight.schema_version === 'system-gears-external-callback-batch-import/v1'
    && systemExternalImport.schema_version === 'system-gears-external-callback-batch-import/v1'
    && systemExternalPreflight.mode === 'preflight'
    && systemExternalImport.mode === 'import'
    && systemExternalPreflight.blocked === false
    && systemExternalImport.blocked === false
    && evidenceNumber(systemExternalPreflight.ready_to_import_count) > 0
    && evidenceNumber(systemExternalImport.updated_count) > 0
    && evidenceNumber(systemExternalPreflight.blocking_count) === 0
    && evidenceNumber(systemExternalImport.blocking_count) === 0
    && evidenceNumber(systemExternalImport.failed_count) === 0
    && evidenceNumber(systemExternalPreflight.unresolved_count) === 0
    && evidenceNumber(systemExternalImport.unresolved_count) === 0;
  const gateCounts = evidenceObject(verdict?.gate_counts);
  const recommendedActions: GearsExecutionWorkerEvidenceSignoffAction[] = [
    ...evidenceActions(verdict?.recommended_actions),
    ...evidenceActions(archive?.recommended_actions),
    ...evidenceActions(integrity?.recommended_actions),
    ...[verdictRead, archiveRead, integrityRead, workerRead, callbackRead, systemExternalOutputSourceRead, systemExternalPreflightRead, systemExternalImportRead, healthRead, productionMaterialPackHealthRead, domainPackProductionHealthRead, mvpRead, pressureRead]
      .filter(read => !read.exists || !read.parse_ok)
      .map(read => ({
        priority: 'P0',
        owner: 'Story Agent evidence signoff',
        action: `Attach or regenerate ${read.filename} before signing off GEARS worker evidence.`,
        evidence: read.parse_error ?? 'missing_or_invalid_json',
        sample_files: [read.filename],
      })),
    ...(!mvpGovernanceCountsConsistent ? [{
      priority: 'P0',
      owner: 'Story Agent evidence signoff',
      action: 'Regenerate worker acceptance verdict/archive from the same story-agent-mvp-status-audit.json so embedded MVP governance counts match before GEARS worker signoff.',
      evidence: 'mvp_governance_counts_inconsistent',
      gate_id: 'story_agent_mvp_status_audit',
      sample_files: [
        'story-agent-mvp-status-audit.json',
        'gears-worker-acceptance-verdict.json',
        'gears-worker-acceptance-archive.json',
      ],
    }] : []),
    ...(systemExternalOutputUrlSourceReady && !systemExternalOutputUrlImported ? [{
      priority: 'P0',
      owner: 'Story Agent + GEARS v2',
      action: 'Regenerate system external callback import evidence so the imported response contains the verified GEARS/Seedance output_url from story-agent-system-external-output-url-source.json.',
      evidence: 'system_external_output_url_not_imported',
      gate_id: 'system_external_callback_batch',
      sample_files: [
        'story-agent-system-external-output-url-source.json',
        'story-agent-system-external-callback-import-response.json',
      ],
    }] : []),
  ];
  const coreEvidenceAvailable = verdictRead.exists
    && archiveRead.exists
    && integrityRead.exists
    && healthRead.exists;
  const status: GearsExecutionAcceptanceStatus = acceptancePassed && signoffReady && integrityPassed && healthAuditPassed
    && productionMaterialPackHealthAuditPassed
    && domainPackProductionHealthAuditPassed
    && mvpStatusAuditPassed
    && mvpGovernanceCountsConsistent
    && systemExternalCallbackPassed
    ? 'ready'
    : coreEvidenceAvailable
      ? 'attention'
      : 'blocked';
  const report: Omit<GearsExecutionWorkerEvidenceSignoffReport, 'markdown'> = {
    provider: 'gears',
    schema_version: 'gears-execution-worker-evidence-signoff/v1',
    status,
    evidence_dir: resolvedDir.evidenceDir,
    evidence_dir_source: resolvedDir.source,
    evidence_dir_allowed: true,
    acceptance_passed: acceptancePassed,
    signoff_ready: signoffReady,
    integrity_passed: integrityPassed,
    health_audit_passed: healthAuditPassed,
    production_material_pack_health_audit_passed: productionMaterialPackHealthAuditPassed,
    domain_pack_production_health_audit_passed: domainPackProductionHealthAuditPassed,
    mvp_status_audit_passed: mvpStatusAuditPassed,
    mvp_governance_counts_consistent: mvpGovernanceCountsConsistent,
    mvp_governance_counts_verdict_embedded: Boolean(verdictMvpGovernanceCounts),
    mvp_governance_counts_archive_embedded: Boolean(archiveMvpGovernanceCounts),
    mvp_governance_count_mismatch_ids: mvpGovernanceCountMismatchIds,
    system_external_callback_passed: systemExternalCallbackPassed,
    system_external_callback_ready_to_import_count: evidenceNumber(systemExternalPreflight.ready_to_import_count),
    system_external_callback_updated_count: evidenceNumber(systemExternalImport.updated_count),
    system_external_callback_blocking_count: evidenceNumber(systemExternalPreflight.blocking_count)
      + evidenceNumber(systemExternalImport.blocking_count),
    system_external_callback_failed_count: evidenceNumber(systemExternalImport.failed_count),
    system_external_callback_unresolved_count: evidenceNumber(systemExternalPreflight.unresolved_count)
      + evidenceNumber(systemExternalImport.unresolved_count),
    system_external_callback_project_count: Math.max(
      evidenceNumber(systemExternalPreflight.project_count),
      evidenceNumber(systemExternalImport.project_count),
    ),
    system_external_output_url_source_ready: systemExternalOutputUrlSourceReady,
    system_external_output_url_imported: systemExternalOutputUrlImported,
    system_external_output_url_import_match_count: systemExternalOutputUrlImportMatchCount,
    system_external_output_url_configured_from_env: evidenceBool(systemExternalOutputSource.configured_from_env),
    system_external_output_url_source: systemExternalOutputUrlSource,
    pressure_submitted: evidenceBool(verdict?.pressure_submitted) || evidenceBool(pressureTotals.pressure_submitted),
    gate_counts: {
      passed: evidenceNumber(gateCounts.passed),
      failed: evidenceNumber(gateCounts.failed),
      skipped: evidenceNumber(gateCounts.skipped),
      total: evidenceNumber(gateCounts.total),
    },
    failed_gate_ids: evidenceStringArray(verdict?.failed_gate_ids),
    skipped_gate_ids: evidenceStringArray(verdict?.skipped_gate_ids),
    missing_required_attachment_count: evidenceNumber(archiveTotals.missing_required_attachment_count),
    required_attachment_count: evidenceNumber(archiveTotals.required_attachment_count),
    required_checksum_count: evidenceNumber(archiveTotals.required_checksum_count),
    evidence_file_count: evidenceNumber(archiveTotals.evidence_file_count),
    worker_record_count: evidenceNumber(workerTotals.record_count),
    worker_transport_error_count: evidenceNumber(workerTotals.transport_error_count),
    worker_http_error_count: evidenceNumber(workerTotals.http_error_count),
    worker_unknown_count: evidenceNumber(workerTotals.unknown_count),
    worker_missing_worker_id_count: evidenceNumber(workerTotals.missing_worker_id_count),
    worker_missing_source_id_count: evidenceNumber(workerTotals.missing_source_id_count),
    worker_missing_ready_artifact_count: evidenceNumber(workerTotals.missing_ready_artifact_count),
    worker_failure_category_counts: evidenceNumberRecord(workerTotals.failure_category_counts),
    callback_transport_error_count: evidenceNumber(callbackTotals.transport_error_count),
    callback_http_error_count: evidenceNumber(callbackTotals.http_error_count),
    callback_ledger_match_missing_count: evidenceNumber(callbackTotals.ledger_match_missing_count),
    callback_failed_count: evidenceNumber(callbackTotals.failed_count),
    health_ready_count_before: evidenceNumber(healthBeforeSummary.ready_count),
    health_ready_count_after: evidenceNumber(healthAfterSummary.ready_count),
    health_ready_count_delta: evidenceNumber(healthDeltas.ready_count),
    health_interrupted_count_delta: evidenceNumber(healthDeltas.interrupted_count),
    health_production_gap_count_delta: evidenceNumber(healthDeltas.production_gap_count),
    production_material_pack_status_before: typeof productionPackBefore.status === 'string'
      ? productionPackBefore.status as GearsExecutionWorkerEvidenceSignoffReport['production_material_pack_status_before']
      : undefined,
    production_material_pack_status_after: typeof productionPackAfter.status === 'string'
      ? productionPackAfter.status as GearsExecutionWorkerEvidenceSignoffReport['production_material_pack_status_after']
      : undefined,
    production_material_pack_issue_count_before: evidenceNumber(productionPackBefore.issue_count),
    production_material_pack_issue_count_after: evidenceNumber(productionPackAfter.issue_count),
    production_material_pack_issue_count_delta: evidenceNumber(productionPackDeltas.issue_count),
    production_material_pack_core_ready_count_before: evidenceNumber(productionPackBefore.core_ready_count),
    production_material_pack_core_ready_count_after: evidenceNumber(productionPackAfter.core_ready_count),
    domain_pack_status_before: typeof domainPackBefore.status === 'string'
      ? domainPackBefore.status as GearsExecutionWorkerEvidenceSignoffReport['domain_pack_status_before']
      : undefined,
    domain_pack_status_after: typeof domainPackAfter.status === 'string'
      ? domainPackAfter.status as GearsExecutionWorkerEvidenceSignoffReport['domain_pack_status_after']
      : undefined,
    domain_pack_issue_count_before: evidenceNumber(domainPackBefore.issue_count),
    domain_pack_issue_count_after: evidenceNumber(domainPackAfter.issue_count),
    domain_pack_issue_count_delta: evidenceNumber(domainPackDeltas.issue_count),
    domain_pack_ready_count_before: evidenceNumber(domainPackBefore.ready_pack_count),
    domain_pack_ready_count_after: evidenceNumber(domainPackAfter.ready_pack_count),
    mvp_status_before: typeof mvpBefore.status === 'string'
      ? mvpBefore.status as GearsExecutionWorkerEvidenceSignoffReport['mvp_status_before']
      : undefined,
    mvp_status_after: typeof mvpAfter.status === 'string'
      ? mvpAfter.status as GearsExecutionWorkerEvidenceSignoffReport['mvp_status_after']
      : undefined,
    mvp_score_before: evidenceNumber(mvpBefore.score),
    mvp_score_after: evidenceNumber(mvpAfter.score),
    mvp_score_delta: evidenceNumber(mvpDeltas.score),
    mvp_seedance_placeholder_asset_count_before: evidenceNumber(mvpBeforeSummary.seedance_placeholder_asset_count),
    mvp_seedance_placeholder_asset_count_after: evidenceNumber(mvpAfterSummary.seedance_placeholder_asset_count),
    mvp_seedance_placeholder_asset_count_delta: evidenceNumber(mvpDeltas.seedance_placeholder_asset_count),
    mvp_seedance_production_asset_ready_count_before: evidenceNumber(mvpBeforeSummary.seedance_production_asset_ready_count),
    mvp_seedance_production_asset_ready_count_after: evidenceNumber(mvpAfterSummary.seedance_production_asset_ready_count),
    mvp_seedance_production_asset_ready_count_delta: evidenceNumber(mvpDeltas.seedance_production_asset_ready_count),
    mvp_knowledge_writeback_ready_count_before: evidenceNumber(mvpBeforeSummary.knowledge_writeback_ready_count),
    mvp_knowledge_writeback_ready_count_after: evidenceNumber(mvpAfterSummary.knowledge_writeback_ready_count),
    mvp_knowledge_writeback_ready_count_delta: evidenceNumber(mvpDeltas.knowledge_writeback_ready_count),
    mvp_knowledge_writeback_queued_count_before: evidenceNumber(mvpBeforeSummary.knowledge_writeback_queued_count),
    mvp_knowledge_writeback_queued_count_after: evidenceNumber(mvpAfterSummary.knowledge_writeback_queued_count),
    mvp_knowledge_writeback_queued_count_delta: evidenceNumber(mvpDeltas.knowledge_writeback_queued_count),
    mvp_knowledge_writeback_needs_revision_count_before: evidenceNumber(mvpBeforeSummary.knowledge_writeback_needs_revision_count),
    mvp_knowledge_writeback_needs_revision_count_after: evidenceNumber(mvpAfterSummary.knowledge_writeback_needs_revision_count),
    mvp_knowledge_writeback_needs_revision_count_delta: evidenceNumber(mvpDeltas.knowledge_writeback_needs_revision_count),
    large_project_request_unit_count: evidenceNumber(pressureTotals.request_unit_count),
    large_project_response_record_count: evidenceNumber(pressureTotals.response_record_count),
    large_project_accepted_count: evidenceNumber(pressureTotals.accepted_count),
    large_project_rejected_count: evidenceNumber(pressureTotals.rejected_count),
    large_project_failed_count: evidenceNumber(pressureTotals.failed_count),
    large_project_source_echo_count: evidenceNumber(pressureTotals.source_echo_count),
    large_project_missing_requested_source_count: evidenceNumber(pressureTotals.missing_requested_source_count),
    large_project_duplicate_source_id_count: evidenceNumber(pressureTotals.duplicate_source_id_count),
    large_project_unexpected_source_count: evidenceNumber(pressureTotals.unexpected_source_count),
    required_files: requiredFiles,
    missing_required_files: missingRequiredFiles,
    gates,
    recommended_actions: dedupeEvidenceActions(recommendedActions),
    generated_at: generatedAt,
  };
  return {
    ...report,
    markdown: renderGearsExecutionWorkerEvidenceSignoffMarkdown(report),
  };
}

function buildLiveSmokeSubmitUnits(): GearsExecutionSubmitUnit[] {
  return [
    {
      source_unit_id: 'readiness-shot-1',
      source_unit_label: 'Live smoke accepted unit',
      source_scene_id: 1,
      local_gears_job_id: 'local-gears-seedance_video-readiness-shot-1-1',
      payload: {
        schema_version: 'gears-series-seedance-video-retry-payload/v1',
        script_text: '少年站在祠堂门口。',
        seedance_prompt: '0-3秒：少年站在祠堂门口。',
        metadata: {
          smoke: true,
          smoke_unit_role: 'accepted',
        },
      },
      payload_summary: 'GEARS live smoke accepted unit',
    },
    {
      source_unit_id: 'readiness-shot-2',
      source_unit_label: 'Live smoke rejected unit',
      source_scene_id: 2,
      local_gears_job_id: 'local-gears-seedance_video-readiness-shot-2-1',
      payload: {
        schema_version: 'gears-series-seedance-video-retry-payload/v1',
        script_text: '少年转身奔跑。',
        seedance_prompt: '0-3秒：少年转身奔跑。',
        metadata: {
          smoke: true,
          smoke_unit_role: 'rejected_or_accepted',
        },
      },
      payload_summary: 'GEARS live smoke second unit',
    },
  ];
}

function renderGearsExecutionLiveSmokeRunMarkdown(report: Omit<GearsExecutionLiveSmokeRunReport, 'markdown'>): string {
  const lines: string[] = [
    '# GEARS v2 Live Smoke Run Report',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- status: ${report.status}`,
    `- execute: ${report.execute}`,
    `- poll_after_submit: ${report.poll_after_submit}`,
    `- readiness: ${report.readiness_status} · ${report.readiness_score}`,
    `- accepted_count: ${report.accepted_count}`,
    `- rejected_count: ${report.rejected_count}`,
    `- failed_count: ${report.failed_count}`,
    '',
    '## Blocked By',
    '',
    ...(report.blocked_by.length ? report.blocked_by.map(item => `- ${item}`) : ['- none']),
    '',
    '## Submitted Job IDs',
    '',
    ...(report.submitted_job_ids.length ? report.submitted_job_ids.map(item => `- ${item}`) : ['- none']),
    '',
  ];

  for (const step of report.steps) {
    lines.push(
      `## ${step.label}`,
      '',
      `- id: ${step.id}`,
      `- method: ${step.method}`,
      `- path: ${step.path}`,
      `- status: ${step.status}`,
      `- message: ${step.message}`,
      ...(step.duration_ms !== undefined ? [`- duration_ms: ${step.duration_ms}`] : []),
      ...(step.blocked_by?.length ? [`- blocked_by: ${step.blocked_by.join(', ')}`] : []),
      ...(step.requested_count !== undefined ? [`- requested_count: ${step.requested_count}`] : []),
      ...(step.accepted_count !== undefined ? [`- accepted_count: ${step.accepted_count}`] : []),
      ...(step.rejected_count !== undefined ? [`- rejected_count: ${step.rejected_count}`] : []),
      ...(step.returned_count !== undefined ? [`- returned_count: ${step.returned_count}`] : []),
      ...(step.failed_count !== undefined ? [`- failed_count: ${step.failed_count}`] : []),
      '',
    );

    if (step.failures?.length) {
      lines.push(
        '### Failures',
        '',
        '```json',
        JSON.stringify(step.failures, null, 2),
        '```',
        '',
      );
    }
  }

  return `${lines.join('\n').trim()}\n`;
}

function liveSmokeStepFromPlan(
  step: GearsExecutionLiveE2EPlan['steps'][number],
  status: GearsExecutionLiveSmokeRunStepResult['status'],
  message: string,
): GearsExecutionLiveSmokeRunStepResult {
  return {
    id: step.id,
    label: step.label,
    method: step.method,
    path: step.path,
    status,
    blocked_by: step.blocked_by,
    message,
  };
}

export async function runGearsExecutionLiveSmoke(
  input: GearsExecutionLiveSmokeRunRequest = {},
): Promise<GearsExecutionLiveSmokeRunReport> {
  const readiness = getGearsExecutionReadinessReport();
  const smokePackage = getGearsExecutionSmokePackage();
  const execute = input.execute === true;
  const pollAfterSubmit = input.poll_after_submit === true;
  const generatedAt = new Date().toISOString();
  const note = input.note ?? 'GEARS Story Agent live smoke';
  const liveSteps = readiness.live_e2e.steps;

  if (!execute) {
    const baseReport: Omit<GearsExecutionLiveSmokeRunReport, 'markdown'> = {
      provider: 'gears',
      schema_version: 'gears-execution-live-smoke-run/v1',
      status: 'dry_run',
      execute,
      poll_after_submit: pollAfterSubmit,
      readiness_status: readiness.status,
      readiness_score: readiness.score,
      blocked_by: readiness.live_e2e.blocked_by,
      submitted_job_ids: [],
      accepted_count: 0,
      rejected_count: 0,
      failed_count: 0,
      steps: liveSteps.map(step => liveSmokeStepFromPlan(
        step,
        step.status === 'ready' ? 'skipped' : 'blocked',
        step.status === 'ready'
          ? 'Dry run only; pass execute=true to submit this smoke step to GEARS.'
          : `Blocked by ${step.blocked_by.join(', ')}`,
      )),
      generated_at: generatedAt,
    };
    return {
      ...baseReport,
      markdown: renderGearsExecutionLiveSmokeRunMarkdown(baseReport),
    };
  }

  if (!readiness.live_e2e.ready) {
    const baseReport: Omit<GearsExecutionLiveSmokeRunReport, 'markdown'> = {
      provider: 'gears',
      schema_version: 'gears-execution-live-smoke-run/v1',
      status: 'blocked',
      execute,
      poll_after_submit: pollAfterSubmit,
      readiness_status: readiness.status,
      readiness_score: readiness.score,
      blocked_by: readiness.live_e2e.blocked_by,
      submitted_job_ids: [],
      accepted_count: 0,
      rejected_count: 0,
      failed_count: readiness.live_e2e.steps.filter(step => step.status === 'blocked').length,
      steps: liveSteps.map(step => liveSmokeStepFromPlan(
        step,
        step.status === 'ready' ? 'skipped' : 'blocked',
        step.status === 'ready'
          ? 'Skipped because another live E2E prerequisite is blocked.'
          : `Blocked by ${step.blocked_by.join(', ')}`,
      )),
      generated_at: generatedAt,
    };
    return {
      ...baseReport,
      markdown: renderGearsExecutionLiveSmokeRunMarkdown(baseReport),
    };
  }

  const steps: GearsExecutionLiveSmokeRunStepResult[] = [];
  const units = buildLiveSmokeSubmitUnits();
  const submittedAt = new Date().toISOString();
  const submitStarted = Date.now();
  const submitStartedAt = new Date(submitStarted).toISOString();
  const submitRes = await submitGearsExecutionJobs({
    sourceProjectId: 'GEARS_SMOKE_PROJECT_ID',
    sourceStoryId: 'GEARS_SMOKE_STORY_ID',
    seriesProjectId: 'GEARS_SMOKE_SERIES_PROJECT_ID',
    title: 'GEARS Story Agent live smoke',
    jobType: 'seedance_video',
    callbackPath: gearsProjectCallbackPath('GEARS_SMOKE_PROJECT_ID'),
    callbackUrl: gearsProjectCallbackUrl('GEARS_SMOKE_PROJECT_ID'),
    note,
    useGearsApi: true,
    units,
  });
  const submitDuration = Date.now() - submitStarted;
  if (!submitRes.ok || !submitRes.data) {
    const baseReport: Omit<GearsExecutionLiveSmokeRunReport, 'markdown'> = {
      provider: 'gears',
      schema_version: 'gears-execution-live-smoke-run/v1',
      status: 'failed',
      execute,
      poll_after_submit: pollAfterSubmit,
      readiness_status: readiness.status,
      readiness_score: readiness.score,
      blocked_by: [],
      submitted_job_ids: [],
      accepted_count: 0,
      rejected_count: 0,
      failed_count: 1,
      steps: [
        {
          id: 'submit_http',
          label: 'Submit GEARS job',
          method: 'POST',
          path: smokePackage.steps.find(step => step.id === 'submit_http')?.path ?? '/gears/jobs',
          status: 'failed',
          started_at: submitStartedAt,
          completed_at: new Date().toISOString(),
          duration_ms: submitDuration,
          message: submitRes.error?.message ?? 'GEARS submit failed.',
        },
        ...liveSteps
          .filter(step => step.id !== 'submit_http')
          .map(step => liveSmokeStepFromPlan(step, 'skipped', 'Skipped because submit failed.')),
      ],
      generated_at: generatedAt,
    };
    return {
      ...baseReport,
      markdown: renderGearsExecutionLiveSmokeRunMarkdown(baseReport),
    };
  }

  const accepted = submitRes.data.accepted;
  const failures = submitRes.data.failures;
  const submittedJobIds = accepted.map(item => item.gears_job_id);
  steps.push({
    id: 'submit_http',
    label: 'Submit GEARS job',
    method: 'POST',
    path: smokePackage.steps.find(step => step.id === 'submit_http')?.path ?? '/gears/jobs',
    status: failures.length && !accepted.length ? 'failed' : 'passed',
    started_at: submitStartedAt,
    completed_at: new Date().toISOString(),
    duration_ms: submitDuration,
    message: failures.length
      ? 'GEARS returned a mixed accepted/rejected submit response.'
      : 'GEARS accepted all live smoke units.',
    requested_count: submitRes.data.summary.requested_count,
    accepted_count: submitRes.data.summary.accepted_count,
    rejected_count: submitRes.data.summary.rejected_count,
    submitted_job_ids: submittedJobIds,
    failures,
  });

  let pollFailedCount = 0;
  let pollReturnedCount = 0;
  if (pollAfterSubmit && accepted.length) {
    const acceptedBySourceUnitId = new Map(accepted.map(item => [item.source_unit_id, item]));
    const pollItems = units
      .flatMap((unit, index) => {
        const acceptedJob = acceptedBySourceUnitId.get(unit.source_unit_id);
        return acceptedJob
          ? [buildGearsLedgerItem({
            sourceProjectId: 'GEARS_SMOKE_PROJECT_ID',
            sourceStoryId: 'GEARS_SMOKE_STORY_ID',
            seriesProjectId: 'GEARS_SMOKE_SERIES_PROJECT_ID',
            jobType: 'seedance_video',
            unit,
            accepted: acceptedJob,
            submittedAt,
            note: `${note} poll target ${index + 1}`,
          })]
          : [];
      });
    const pollStarted = Date.now();
    const pollStartedAt = new Date(pollStarted).toISOString();
    const pollRes = await pollGearsExecutionJobStatuses({
      items: pollItems,
      note,
    });
    pollReturnedCount = pollRes.data?.summary.returned_count ?? 0;
    pollFailedCount = pollRes.data?.summary.failed_count ?? (pollRes.ok ? 0 : pollItems.length);
    steps.push({
      id: 'status_poll',
      label: 'Poll GEARS job status',
      method: 'GET',
      path: smokePackage.steps.find(step => step.id === 'status_poll')?.path ?? '/gears/jobs/<gears_job_id>',
      status: pollRes.ok && pollFailedCount === 0 ? 'passed' : 'failed',
      started_at: pollStartedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - pollStarted,
      message: pollRes.ok
        ? 'GEARS status poll returned normalized callback payloads.'
        : pollRes.error?.message ?? 'GEARS status poll failed.',
      requested_count: pollRes.data?.summary.requested_count ?? pollItems.length,
      returned_count: pollReturnedCount,
      failed_count: pollFailedCount,
      failures: pollRes.data?.failures,
    });
  } else {
    steps.push(liveSmokeStepFromPlan(
      liveSteps.find(step => step.id === 'status_poll') ?? {
        id: 'status_poll',
        label: 'Poll GEARS job status',
        method: 'GET',
        path: '/gears/jobs/<gears_job_id>',
        status: 'ready',
        blocked_by: [],
        expected_result: '',
      },
      'skipped',
      accepted.length
        ? 'Submit completed; pass poll_after_submit=true to poll accepted live smoke jobs.'
        : 'Skipped because submit returned no accepted jobs.',
    ));
  }

  for (const callbackStepId of ['project_callback', 'series_callback']) {
    const liveStep = liveSteps.find(step => step.id === callbackStepId);
    if (!liveStep) continue;
    steps.push(liveSmokeStepFromPlan(
      liveStep,
      'skipped',
      'Callback samples are included in the smoke handoff package; posting them requires a real project or series id.',
    ));
  }

  const hardFailures = steps.filter(step => step.status === 'failed').length;
  const status: GearsExecutionLiveSmokeRunReport['status'] = hardFailures
    ? 'failed'
    : steps.some(step => step.status === 'skipped')
      ? 'partial'
      : 'passed';
  const baseReport: Omit<GearsExecutionLiveSmokeRunReport, 'markdown'> = {
    provider: 'gears',
    schema_version: 'gears-execution-live-smoke-run/v1',
    status,
    execute,
    poll_after_submit: pollAfterSubmit,
    readiness_status: readiness.status,
    readiness_score: readiness.score,
    blocked_by: [],
    submitted_job_ids: submittedJobIds,
    accepted_count: accepted.length,
    rejected_count: failures.length,
    failed_count: hardFailures + pollFailedCount,
    steps,
    generated_at: generatedAt,
  };
  return {
    ...baseReport,
    markdown: renderGearsExecutionLiveSmokeRunMarkdown(baseReport),
  };
}

export function getGearsExecutionContractInfo(): GearsExecutionContractInfo {
  return {
    provider: 'gears',
    schema_version: 'gears-execution-contract/v1',
    env: {
      api_base_url: 'GEARS_API_BASE_URL',
      api_token: 'GEARS_API_TOKEN',
      callback_secret: 'GEARS_CALLBACK_SECRET',
      callback_base_url: 'GEARS_CALLBACK_BASE_URL',
    },
    supported_job_types: GEARS_EXECUTION_JOB_TYPES,
    submit: {
      method: 'POST',
      path: '/gears/jobs',
      request_fields: [
        'schema_version',
        'source_project_id',
        'source_story_id',
        'series_project_id',
        'job_type',
        'payload',
        'payload.units[]',
        'payload.units[].schema_version',
        'payload.units[].source_unit_id',
        'payload.units[].external_id',
        'payload.units[].custom_id',
        'payload.units[].idempotency_key',
        'payload.units[].callback_url',
        'payload.units[].metadata',
        'payload.units[].retry_count',
        'payload.units[].retry_reason',
        'payload.units[].previous_provider_job_id',
        'payload.units[].last_video_url',
        'payload.units[].review_issues',
        'callback_url',
        'callback_secret_hint',
      ],
      accepted_response_shapes: [
        '{ gears_job_id, status, accepted_units, rejected_units, artifact_placeholders }',
        '{ jobs: [...] }',
        '{ data: { jobs: [...] } }',
        '{ data: { acceptedUnits: [...], rejectedUnits: [...] } }',
        '{ data: { rejectedUnits: [...] } }',
        '{ data: { task: { taskId, externalId, taskStatus } } }',
        'top-level array of jobs',
      ],
      request_example: {
        schema_version: 'gears-execution-submit/v1',
        series_project_id: '20260618-ai-comic-series-demo',
        job_type: 'seedance_video',
        callback_url: '<GEARS_CALLBACK_BASE_URL>/api/story-outline/ai-comic-series-projects/20260618-ai-comic-series-demo/gears-callback',
        callback_secret_hint: 'GEARS_CALLBACK_SECRET',
        payload: {
          units: [{
            schema_version: 'gears-series-seedance-video-retry-payload/v1',
            source_unit_id: 'episode:1:shot:001',
            external_id: 'episode:1:shot:001',
            custom_id: 'episode:1:shot:001',
            idempotency_key: 'seedance_video:episode:1:shot:001',
            retry_count: 1,
            retry_reason: 'review_required',
            previous_provider_job_id: 'old-gears-job-001',
            last_video_url: 'https://media.example.test/old-shot-001.mp4',
            review_issues: [{
              severity: 'major',
              note: '人物动作需要重做',
            }],
            script_text: '少年站在祠堂门口。',
            seedance_prompt: '0-3秒：少年站在祠堂门口。',
            asset_slots: [],
            metadata: {
              job_type: 'seedance_video',
              source_unit_id: 'episode:1:shot:001',
            },
          }],
        },
      },
      response_example: {
        gears_job_id: 'gears-job-001',
        status: 'queued',
        accepted_units: [{ source_unit_id: 'shot-1' }],
        rejected_units: [{
          source_unit_id: 'shot-2',
          error_code: 'CONTENT_POLICY',
          failure_category: 'content_policy',
          message: 'GEARS rejected shot-2',
        }],
        artifact_placeholders: [{ source_unit_id: 'shot-1', kind: 'video' }],
      },
    },
    poll: {
      method: 'GET',
      path: '/gears/jobs/{gears_job_id}',
      response_fields: [
        'status',
        'taskStatus',
        'job_status',
        'progress',
        'progress_percent',
        'progressPercent',
        'percent',
        'artifacts',
        'outputs',
        'failures',
        'failure_category',
        'error_code',
      ],
      accepted_status_fields: GEARS_ACCEPTED_STATUS_FIELDS,
      accepted_response_shapes: [
        '{ status, artifacts[] }',
        '{ data: { job: { job_status, output: { files[] } } } }',
        '{ data: { task: { task_state, outputs[] } } }',
        '{ result: { jobs/tasks/items/results: [...] } }',
      ],
      accepted_artifact_fields: [
        'artifacts[].url',
        'artifact_urls[]',
        'manifest_url | manifestUrl',
        'subtitle_url | subtitleUrl | srt_url | srtUrl | vtt_url | vttUrl',
        'audio_url | audioUrl',
        'image_url | imageUrl | thumbnail_url | thumbnailUrl | poster_url | posterUrl',
        'output.files[].mediaUrl',
        'outputs[].downloadUrl',
        'files[].fileUrl',
        'media[].publicUrl',
        'assets[].url',
      ],
      accepted_progress_fields: [
        'progress',
        'progress_percent',
        'progressPercent',
        'percent',
        'percentage',
        'progress_ratio',
        'progressRatio',
      ],
    },
    callback: {
      project_path: '/api/projects/:projectId/gears-callback',
      series_path: '/api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-callback',
      auth_env: 'GEARS_CALLBACK_SECRET',
      auth_headers: [
        'Authorization: Bearer <GEARS_CALLBACK_SECRET>',
        'X-GEARS-Callback-Secret: <GEARS_CALLBACK_SECRET>',
      ],
      auth_optional_when_unset: true,
      accepted_envelope_shapes: [
        '{ ...flat callback fields }',
        '{ callbacks: [{ ...callback fields }] }',
        '{ events: [{ ...callback fields }] }',
        '{ data: { task: { task_id, taskStatus, output: { files[] } } } }',
        '{ data: { tasks: [{ task_id, taskStatus, outputs[] }] } }',
        '{ data: { job: { jobId, job_status, outputs[] } } }',
        '{ result: { jobs/tasks/items/results: [...] } }',
      ],
      request_fields: [
        'gears_job_id',
        'source_project_id',
        'series_project_id',
        'source_unit_id',
        'external_id | externalId',
        'custom_id | customId',
        'production_id | productionId',
        'job_type',
        'status',
        'progress',
        'event_time',
        'completed_at',
        'artifacts',
        'artifact_urls',
        'video_url | videoUrl',
        'manifest_url | manifestUrl',
        'subtitle_url | subtitleUrl | srt_url | srtUrl | vtt_url | vttUrl',
        'audio_url | audioUrl',
        'image_url | imageUrl | thumbnail_url | thumbnailUrl | poster_url | posterUrl',
        'failure_category',
        'error_code',
        'message',
        'idempotency_key | idempotencyKey',
      ],
      accepted_status_fields: GEARS_ACCEPTED_STATUS_FIELDS,
      accepted_artifact_fields: [
        'artifacts[].url',
        'artifact_urls[]',
        'artifact_url',
        'video_url',
        'output_url',
        'file_url',
        'manifest_url | manifestUrl',
        'subtitle_url | subtitleUrl | srt_url | srtUrl | vtt_url | vttUrl',
        'audio_url | audioUrl',
        'image_url | imageUrl | thumbnail_url | thumbnailUrl | poster_url | posterUrl',
        'url',
        'output.files[].mediaUrl',
        'outputs[].downloadUrl',
        'media[].publicUrl',
        'assets[].url',
      ],
      accepted_progress_fields: [
        'progress',
        'progress_percent',
        'progressPercent',
        'percent',
        'percentage',
        'progress_ratio',
        'progressRatio',
      ],
      accepted_time_fields: [
        'provider_event_at',
        'providerEventAt',
        'event_time',
        'eventTime',
        'event_at',
        'eventAt',
        'timestamp',
        'created_at',
        'createdAt',
        'updated_at',
        'updatedAt',
        'completed_at',
        'completedAt',
        'finished_at',
        'finishedAt',
      ],
      idempotency_fields: [
        'event_id | eventId | callback_id | callbackId',
        'idempotency_key | idempotencyKey (job match key; lifecycle callbacks with changed status/progress/message are preserved)',
        'fallback: status + message + progress_percent when event id is absent',
      ],
      max_batch_items: GEARS_CALLBACK_BATCH_ITEM_LIMIT,
      response_fields: [
        'received_count',
        'updated_count',
        'failed_count',
        'duplicate_count',
        'failures[]',
        'failures[].path',
        'failures[].source_unit_id',
        'failures[].gears_job_id',
        'gears_job_ledger',
        'gears_job_ledger.items[].idempotency_key',
        'gears_job_ledger.items[].last_poll_at',
        'gears_job_ledger.items[].last_poll_error',
        'gears_job_ledger.items[].last_poll_failure_category',
        'gears_job_ledger.items[].last_poll_error_code',
        'gears_job_ledger.items[].completed_at',
        'gears_job_ledger.items[].callback_events[].event_id_source',
        'gears_job_ledger.items[].callback_events[].provider_event_at',
        'gears_job_ledger.items[].callback_events[].previous_status',
        'gears_job_ledger.items[].callback_events[].applied_status',
        'gears_job_ledger.items[].callback_events[].status_regression_ignored',
        'gears_job_ledger.items[].callback_events[].terminal_status_changed',
      ],
      request_examples: [
        {
          jobId: 'gears-job-001',
          taskStatus: 'COMPLETED',
          jobType: 'seedance_video',
          externalId: 'shot-1',
          idempotencyKey: 'seedance_video:shot-1',
          outputUrl: 'https://gears.example/media/shot-1.mp4',
          progressPercent: 100,
          eventTime: '2026-06-20T10:00:00.000Z',
          completedAt: '2026-06-20T10:01:00.000Z',
          qualityScore: 0.92,
        },
        {
          jobId: 'gears-final-assemble-001',
          taskStatus: 'COMPLETED',
          jobType: 'final_assemble',
          sourceUnitId: 'final-delivery',
          artifacts: [
            {
              kind: 'video',
              url: 'https://gears.example/media/final.mp4',
              mime_type: 'video/mp4',
            },
            {
              kind: 'manifest',
              url: 'https://gears.example/media/final-manifest.json',
              mime_type: 'application/json',
            },
          ],
        },
        {
          jobId: 'gears-final-assemble-002',
          taskStatus: 'COMPLETED',
          jobType: 'final_assemble',
          sourceUnitId: 'final-delivery',
          videoUrl: 'https://gears.example/media/final.mp4',
          manifestUrl: 'https://gears.example/media/final-manifest',
        },
      ],
    },
    notes: [
      'china-culture-kb stores production intent, ledgers, dashboard state, review notes, and callbacks.',
      'GEARS v2 owns image/video/post-production execution and media artifacts.',
      'last_poll_* ledger fields are transient status-sync diagnostics and do not mean the GEARS job itself failed.',
      'Out-of-order non-terminal callbacks do not downgrade a terminal ledger status; callback_events keep applied_status and status_regression_ignored for audit.',
      'Terminal-to-terminal callback changes are applied but marked with previous_status and terminal_status_changed for replay/audit.',
      'Canceled GEARS callbacks preserve failure_reason, error_code, and failure_category as terminal execution context.',
      'Provider event timestamps are normalized to ISO strings when event_time/eventTime/timestamp/completedAt fields are supplied.',
      'When idempotencyKey is used as the callback event id fallback, repeated identical lifecycle payloads are deduplicated but changed status/progress/message callbacks remain in callback_events.',
      `Each GEARS job ledger item keeps only the latest ${GEARS_CALLBACK_EVENT_RETENTION_LIMIT} callback_events to keep large series ledgers bounded.`,
      `GEARS callback envelopes accept at most ${GEARS_CALLBACK_BATCH_ITEM_LIMIT} callback items per request; split larger worker batches before posting.`,
      'Legacy SEEDANCE_PROVIDER_* endpoints remain compatibility-only.',
    ],
  };
}

function stringField(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function dateTimeField(...values: unknown[]): string | undefined {
  for (const value of values) {
    let timestamp: number | undefined;
    if (value instanceof Date) {
      timestamp = value.getTime();
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      timestamp = Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
    } else if (typeof value === 'string' && value.trim()) {
      const text = value.trim();
      const numeric = Number(text);
      timestamp = Number.isFinite(numeric)
        ? (Math.abs(numeric) < 100_000_000_000 ? numeric * 1000 : numeric)
        : Date.parse(text);
    }
    if (timestamp !== undefined && Number.isFinite(timestamp)) {
      const date = new Date(timestamp);
      if (Number.isFinite(date.getTime())) return date.toISOString();
    }
  }
  return undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function progressPercentField(...values: unknown[]): number | undefined {
  for (const value of values) {
    const hasPercentSign = typeof value === 'string' && value.includes('%');
    const raw = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value.trim().replace(/%$/, ''))
        : Number.NaN;
    if (!Number.isFinite(raw)) continue;
    const percent = raw >= 0 && raw <= 1 && !hasPercentSign ? raw * 100 : raw;
    const clamped = Math.max(0, Math.min(100, percent));
    return Math.round(clamped * 100) / 100;
  }
  return undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeJobType(value: unknown): GearsExecutionJobType | undefined {
  if (typeof value !== 'string') return undefined;
  return GEARS_EXECUTION_JOB_TYPES.includes(value as GearsExecutionJobType)
    ? value as GearsExecutionJobType
    : undefined;
}

export function normalizeGearsExecutionStatus(
  value: unknown,
  hasArtifact = false,
  hasFailure = false,
): GearsExecutionJobStatus {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, '_')
    : '';
  if (['ready', 'completed', 'complete', 'succeeded', 'success', 'done', 'finished'].includes(normalized)) {
    return 'ready';
  }
  if ([
    'failed',
    'failure',
    'error',
    'errored',
    'timed_out',
    'timed-out',
    'timeout',
    'expired',
    'deadline_exceeded',
    'deadline-exceeded',
    'quota_exceeded',
    'quota-exceeded',
    'no_credit',
    'no-credit',
    'insufficient_balance',
    'insufficient-balance',
    'insufficient_quota',
    'insufficient-quota',
    'credit_exhausted',
    'credit-exhausted',
    'account_arrears',
    'account-arrears',
    'billing_required',
    'billing-required',
    'payment_required',
    'payment-required',
    'auth_failed',
    'auth-failed',
    'authentication_failed',
    'authentication-failed',
    'unauthorized',
    'forbidden',
    'access_denied',
    'access-denied',
    'permission_denied',
    'permission-denied',
    'token_expired',
    'token-expired',
    'invalid_signature',
    'invalid-signature',
    'signature_invalid',
    'signature-invalid',
    'rate_limited',
    'rate-limited',
    'too_many_requests',
    'too-many-requests',
    'throttled',
    'qps_limit',
    'qps-limit',
    'tps_limit',
    'tps-limit',
    'concurrency_limit',
    'concurrency-limit',
    'network_error',
    'network-error',
    'connection_error',
    'connection-error',
    'dns_error',
    'dns-error',
    'provider_error',
    'provider-error',
    'server_error',
    'server-error',
    'service_unavailable',
    'service-unavailable',
    'gateway_timeout',
    'gateway-timeout',
    'internal_error',
    'internal-error',
    'model_error',
    'model-error',
    'model_overloaded',
    'model-overloaded',
    'system_error',
    'system-error',
    'render_failed',
    'render-failed',
    'render_error',
    'render-error',
    'generation_failed',
    'generation-failed',
    'generation_error',
    'generation-error',
    'generate_failed',
    'generate-failed',
    'postprocess_failed',
    'postprocess-failed',
    'post_processing_failed',
    'post-processing-failed',
    'transcode_failed',
    'transcode-failed',
    'ffmpeg_error',
    'ffmpeg-error',
    'encode_failed',
    'encode-failed',
    'artifact_upload_failed',
    'artifact-upload-failed',
    'storage_upload_failed',
    'storage-upload-failed',
    'upload_failed',
    'upload-failed',
    'callback_failed',
    'callback-failed',
    'callback_delivery_failed',
    'callback-delivery-failed',
    'webhook_failed',
    'webhook-failed',
    'output_missing',
    'output-missing',
    'missing_output',
    'missing-output',
    'artifact_invalid',
    'artifact-invalid',
    'invalid_artifact',
    'invalid-artifact',
    'artifact_expired',
    'artifact-expired',
    'worker_unavailable',
    'worker-unavailable',
    'worker_crashed',
    'worker-crashed',
    'worker_restarted',
    'worker-restarted',
  ].includes(normalized)) return 'failed';
  if ([
    'rejected',
    'blocked',
    'policy_blocked',
    'policy-blocked',
    'moderation_failed',
    'moderation-failed',
    'content_policy',
    'content-policy',
    'safety_blocked',
    'safety-blocked',
    'blocked_by_policy',
    'blocked-by-policy',
    'risk_control',
    'risk-control',
    'invalid_prompt',
    'invalid-prompt',
    'invalid_payload',
    'invalid-payload',
    'invalid_parameter',
    'invalid-parameter',
    'invalid_params',
    'invalid-params',
    'validation_error',
    'validation-error',
    'validation_failed',
    'validation-failed',
    'schema_invalid',
    'schema-invalid',
    'malformed_payload',
    'malformed-payload',
    'prompt_too_long',
    'prompt-too-long',
    'duration_too_long',
    'duration-too-long',
    'unsupported_format',
    'unsupported-format',
    'asset_missing',
    'asset-missing',
    'material_missing',
    'material-missing',
    'file_missing',
    'file-missing',
    'file_not_found',
    'file-not-found',
    'reference_missing',
    'reference-missing',
    'invalid_asset',
    'invalid-asset',
    'unsupported_media',
    'unsupported-media',
    'bad_request',
    'bad-request',
  ].includes(normalized)) return 'rejected';
  if ([
    'canceled',
    'cancelled',
    'cancel',
    'canceling',
    'cancelling',
    'aborted',
    'aborted_by_user',
    'aborted-by-user',
    'user_canceled',
    'user-canceled',
    'user_cancelled',
    'user-cancelled',
    'manual_canceled',
    'manual-canceled',
    'manual_cancelled',
    'manual-cancelled',
  ].includes(normalized)) return 'canceled';
  if (['processing', 'running', 'generating', 'in_progress', 'in-progress'].includes(normalized)) {
    return 'processing';
  }
  if (['queued', 'queueing', 'pending', 'waiting', 'accepted'].includes(normalized)) return 'queued';
  if (['submitted', 'created', 'started'].includes(normalized)) return 'submitted';
  if (hasFailure) return 'failed';
  if (hasArtifact) return 'ready';
  return 'processing';
}

function normalizeFailureCategory(value: unknown): GearsExecutionFailureCategory | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliasMap: Partial<Record<string, GearsExecutionFailureCategory>> = {
    render_error: 'render_failed',
    generation_failed: 'render_failed',
    generation_error: 'render_failed',
    generate_failed: 'render_failed',
    postprocess_failed: 'render_failed',
    post_processing_failed: 'render_failed',
    transcode_failed: 'render_failed',
    encode_failed: 'render_failed',
    ffmpeg_error: 'render_failed',
    storage_upload_failed: 'artifact_upload_failed',
    upload_failed: 'artifact_upload_failed',
    asset_upload_failed: 'artifact_upload_failed',
    callback_failed: 'callback_delivery_failed',
    webhook_failed: 'callback_delivery_failed',
    missing_output: 'output_missing',
    no_output: 'output_missing',
    empty_output: 'output_missing',
    invalid_artifact: 'artifact_invalid',
    artifact_expired: 'artifact_invalid',
    worker_crashed: 'worker_unavailable',
    worker_restarted: 'worker_unavailable',
    service_unavailable: 'provider_server_error',
    provider_error: 'provider_server_error',
    server_error: 'provider_server_error',
    timed_out: 'provider_timeout',
    timeout: 'provider_timeout',
    deadline_exceeded: 'provider_timeout',
    quota_exceeded: 'provider_quota',
    no_credit: 'provider_quota',
    rate_limited: 'provider_rate_limit',
    access_denied: 'provider_auth',
    token_expired: 'provider_auth',
    auth_failed: 'provider_auth',
    invalid_payload: 'payload_invalid',
    invalid_parameter: 'payload_invalid',
    invalid_params: 'payload_invalid',
    validation_failed: 'payload_invalid',
    validation_error: 'payload_invalid',
    invalid_prompt: 'payload_invalid',
    prompt_too_long: 'payload_invalid',
    duration_too_long: 'payload_invalid',
    schema_invalid: 'payload_invalid',
    malformed_payload: 'payload_invalid',
    unsupported_format: 'payload_invalid',
    moderation_failed: 'content_policy',
    safety_blocked: 'content_policy',
    policy_blocked: 'content_policy',
    content_policy_violation: 'content_policy',
    unsupported_media: 'asset_missing',
    invalid_asset: 'asset_missing',
  };
  const category = aliasMap[normalized] ?? normalized;
  return GEARS_FAILURE_CATEGORIES.includes(category as GearsExecutionFailureCategory)
    ? category as GearsExecutionFailureCategory
    : undefined;
}

function classifyFailure(input: {
  explicitCategory?: unknown;
  errorCode?: string;
  failureReason?: string;
  message?: string;
  statusText?: string;
}): GearsExecutionFailureCategory | undefined {
  const explicit = normalizeFailureCategory(input.explicitCategory);
  if (explicit) return explicit;
  const text = [input.errorCode, input.failureReason, input.message, input.statusText]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!text.trim()) return undefined;
  if (/(manual_cancel|manual-cancel|user_cancel|user-cancel|canceled|cancelled|cancel|aborted|operator canceled|人工取消|用户取消|取消)/.test(text)) {
    return 'unknown';
  }
  if (/(policy|safety|moderation|copyright|sensitive|violation|blocked|risk_control|risk control|违规|审核|安全|敏感|版权)/.test(text)) {
    return 'content_policy';
  }
  if (/(auth|unauthorized|forbidden|access_denied|permission_denied|401|403|token|signature|permission|鉴权|认证|权限|令牌|签名)/.test(text)) {
    return 'provider_auth';
  }
  if (/(timeout|timed out|timed_out|deadline|deadline_exceeded|expired|超时|等待过久)/.test(text)) return 'provider_timeout';
  if (/(quota|credit|no_credit|insufficient|balance|billing|payment|account_arrears|余额|额度|配额|欠费)/.test(text)) return 'provider_quota';
  if (/(rate|too_many|429|throttle|qps|tps|concurrency|限流|频率|过多请求)/.test(text)) return 'provider_rate_limit';
  if (/(network|socket|dns|connection|econn|网络|连接)/.test(text)) return 'network_error';
  if (/(payload|prompt|parameter|params|invalid_payload|invalid_prompt|bad_request|validation_error|schema|malformed|unsupported_format|prompt_too_long|duration_too_long|too_long|400|提示词|参数|格式|无效|过长|超长)/.test(text)) {
    return 'payload_invalid';
  }
  if (/(worker|executor|runner|crash|restarted|unavailable_worker|worker_unavailable|工人|执行器|崩溃|重启)/.test(text)) {
    return 'worker_unavailable';
  }
  if (/(5\d\d|server|internal|unavailable|gateway|overloaded|model_error|system_error|平台异常|服务异常|服务器|不可用)/.test(text)) {
    return 'provider_server_error';
  }
  if (/(artifact_upload|asset_upload|storage_upload|upload_failed|upload failed|storage|s3|oss|cos|cdn|putobject|put object|产物上传|上传失败|存储|对象存储)/.test(text)) {
    return 'artifact_upload_failed';
  }
  if (/(callback_delivery|callback_failed|callback failed|webhook_failed|webhook failed|webhook|delivery failed|回调投递|回调失败|通知失败)/.test(text)) {
    return 'callback_delivery_failed';
  }
  if (/(output_missing|missing_output|no_output|empty_output|no output|output missing|产物缺失|输出缺失|空产物|无输出)/.test(text)) {
    return 'output_missing';
  }
  if (/(artifact_invalid|invalid_artifact|artifact_expired|expired artifact|invalid output|broken artifact|corrupt|checksum|产物无效|产物过期|输出无效|校验失败)/.test(text)) {
    return 'artifact_invalid';
  }
  if (/(render|generation_failed|generation failed|generate_failed|generate failed|postprocess|post_process|transcode|ffmpeg|encode|decode|compose|assemble|渲染|生成失败|转码|编码|解码|合成失败)/.test(text)) {
    return 'render_failed';
  }
  if (/(asset|material|file|reference|missing|not_found|not found|unsupported_media|invalid_asset|素材|文件|缺失|缺少)/.test(text)) {
    return 'asset_missing';
  }
  return 'unknown';
}

function sourceUnitIdFromRecord(record: Record<string, unknown>): string | undefined {
  return stringField(
    record.source_unit_id
      ?? record.sourceUnitId
      ?? record.external_id
      ?? record.externalId
      ?? record.custom_id
      ?? record.customId
      ?? record.shot_id
      ?? record.shotId
      ?? record.production_id
      ?? record.productionId,
  );
}

function gearsIdempotencyKey(jobType: GearsExecutionJobType, sourceUnitId: string): string {
  return `${jobType}:${sourceUnitId}`;
}

function idempotencyKeyFromRecord(record: Record<string, unknown>): string | undefined {
  return stringField(record.idempotency_key ?? record.idempotencyKey);
}

function gearsJobIdFromRecord(record: Record<string, unknown>): string | undefined {
  return stringField(
    record.gears_job_id
      ?? record.gearsJobId
      ?? record.job_id
      ?? record.jobId
      ?? record.task_id
      ?? record.taskId
      ?? record.request_id
      ?? record.requestId
      ?? record.id,
  );
}

function statusFromRecord(record: Record<string, unknown>): string | undefined {
  return stringField(
    record.status
      ?? record.task_status
      ?? record.taskStatus
      ?? record.task_state
      ?? record.taskState
      ?? record.job_status
      ?? record.jobStatus
      ?? record.state
      ?? record.phase,
  );
}

function progressPercentFromRecord(record: Record<string, unknown>): number | undefined {
  return progressPercentField(
    record.progress_percent,
    record.progressPercent,
    record.progress,
    record.percent,
    record.percentage,
    record.progress_ratio,
    record.progressRatio,
  );
}

function providerEventAtFromRecord(record: Record<string, unknown>): string | undefined {
  return dateTimeField(
    record.provider_event_at,
    record.providerEventAt,
    record.event_time,
    record.eventTime,
    record.event_at,
    record.eventAt,
    record.timestamp,
    record.created_at,
    record.createdAt,
    record.updated_at,
    record.updatedAt,
  );
}

function completedAtFromRecord(record: Record<string, unknown>): string | undefined {
  return dateTimeField(
    record.completed_at,
    record.completedAt,
    record.finished_at,
    record.finishedAt,
  );
}

function errorCodeFromRecord(record: Record<string, unknown>): string | undefined {
  return stringField(
    record.error_code
      ?? record.errorCode
      ?? record.provider_error_code
      ?? record.providerErrorCode
      ?? record.status_code
      ?? record.statusCode
      ?? record.code,
  );
}

function messageFromRecord(record: Record<string, unknown>): string | undefined {
  const error = record.error;
  return stringField(
    record.failure_reason
      ?? record.failureReason
      ?? record.error_message
      ?? record.errorMessage
      ?? record.reason
      ?? record.message
      ?? record.msg
      ?? (typeof error === 'string' ? error : undefined)
      ?? (isObjectRecord(error) ? error.message ?? error.msg ?? error.reason ?? error.detail : undefined),
  );
}

function explicitFailureReasonFromRecord(record: Record<string, unknown>): string | undefined {
  const error = record.error;
  return stringField(
    record.failure_reason
      ?? record.failureReason
      ?? record.error_message
      ?? record.errorMessage
      ?? record.reason
      ?? (typeof error === 'string' ? error : undefined)
      ?? (isObjectRecord(error) ? error.message ?? error.msg ?? error.reason ?? error.detail : undefined),
  );
}

function normalizeArtifacts(input: {
  artifacts?: unknown;
  urls?: unknown[];
  sourceUnitId?: string;
  defaultKind?: string;
}): GearsExecutionArtifact[] | undefined {
  const artifacts: GearsExecutionArtifact[] = [];
  if (Array.isArray(input.artifacts)) {
    for (const item of input.artifacts) {
      if (typeof item === 'string') {
        artifacts.push({
          url: item,
          source_unit_id: input.sourceUnitId,
          kind: input.defaultKind,
        });
      } else if (isObjectRecord(item)) {
        const url = stringField(
          item.url
            ?? item.artifact_url
            ?? item.artifactUrl
            ?? item.file_url
            ?? item.fileUrl
            ?? item.manifest_url
            ?? item.manifestUrl
            ?? item.subtitle_url
            ?? item.subtitleUrl
            ?? item.srt_url
            ?? item.srtUrl
            ?? item.vtt_url
            ?? item.vttUrl
            ?? item.audio_url
            ?? item.audioUrl
            ?? item.image_url
            ?? item.imageUrl
            ?? item.thumbnail_url
            ?? item.thumbnailUrl
            ?? item.poster_url
            ?? item.posterUrl
            ?? item.media_url
            ?? item.mediaUrl
            ?? item.download_url
            ?? item.downloadUrl
            ?? item.public_url
            ?? item.publicUrl
            ?? item.uri
            ?? item.href,
        );
        if (!url) continue;
        artifacts.push({
          artifact_id: stringField(item.artifact_id ?? item.artifactId ?? item.id),
          kind: stringField(item.kind ?? item.type ?? item.media_type ?? item.mediaType ?? item.asset_type ?? item.assetType)
            ?? input.defaultKind,
          url,
          role: stringField(item.role),
          mime_type: stringField(item.mime_type ?? item.mimeType ?? item.content_type ?? item.contentType),
          source_unit_id: stringField(item.source_unit_id ?? item.sourceUnitId) ?? input.sourceUnitId,
          metadata: isObjectRecord(item.metadata) ? item.metadata : undefined,
        });
      }
    }
  }
  for (const url of input.urls ?? []) {
    const normalizedUrl = stringField(url);
    if (!normalizedUrl) continue;
    artifacts.push({
      kind: input.defaultKind,
      url: normalizedUrl,
      source_unit_id: input.sourceUnitId,
    });
  }
  const seen = new Set<string>();
  const uniqueArtifacts = artifacts.filter(artifact => {
    const key = `${artifact.url}:${artifact.kind ?? ''}:${artifact.source_unit_id ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return uniqueArtifacts.length ? uniqueArtifacts : undefined;
}

type ArtifactUrlFieldSpec = {
  keys: string[];
  kind?: string;
  role?: string;
};

const ARTIFACT_URL_FIELD_SPECS: ArtifactUrlFieldSpec[] = [
  { keys: ['artifact_url', 'artifactUrl'] },
  { keys: ['video_url', 'videoUrl'], kind: 'video', role: 'video' },
  { keys: ['output_url', 'outputUrl'], kind: 'output', role: 'output' },
  { keys: ['file_url', 'fileUrl'], kind: 'file', role: 'file' },
  { keys: ['manifest_url', 'manifestUrl'], kind: 'manifest', role: 'manifest' },
  { keys: ['subtitle_url', 'subtitleUrl'], kind: 'subtitle', role: 'subtitle' },
  { keys: ['srt_url', 'srtUrl'], kind: 'subtitle', role: 'srt' },
  { keys: ['vtt_url', 'vttUrl'], kind: 'subtitle', role: 'vtt' },
  { keys: ['audio_url', 'audioUrl'], kind: 'audio', role: 'audio' },
  { keys: ['image_url', 'imageUrl'], kind: 'image', role: 'image' },
  { keys: ['thumbnail_url', 'thumbnailUrl'], kind: 'thumbnail', role: 'thumbnail' },
  { keys: ['poster_url', 'posterUrl'], kind: 'poster', role: 'poster' },
  { keys: ['media_url', 'mediaUrl'], kind: 'media', role: 'media' },
  { keys: ['download_url', 'downloadUrl'], kind: 'download', role: 'download' },
  { keys: ['public_url', 'publicUrl'], kind: 'public', role: 'public' },
  { keys: ['url', 'uri', 'href'] },
];

const ARTIFACT_URL_KEYS = [...new Set(ARTIFACT_URL_FIELD_SPECS.flatMap(spec => spec.keys))];

const ARTIFACT_CONTAINER_KEYS = [
  'data',
  'result',
  'response',
  'payload',
  'job',
  'task',
  'item',
  'record',
  'artifact',
  'artifacts',
  'artifact_urls',
  'artifactUrls',
  'urls',
  'output',
  'outputs',
  'file',
  'files',
  'media',
  'assets',
  'asset',
  'output_files',
  'outputFiles',
  'result_files',
  'resultFiles',
  'result',
];

function looksLikeArtifactRecord(record: Record<string, unknown>): boolean {
  return ARTIFACT_URL_KEYS.some(key => record[key] !== undefined);
}

function artifactAliasRecordsFromRecord(record: Record<string, unknown>): Record<string, unknown>[] {
  const explicitKind = stringField(record.kind ?? record.type ?? record.media_type ?? record.mediaType ?? record.asset_type ?? record.assetType);
  const explicitRole = stringField(record.role);
  const explicitSourceUnitId = sourceUnitIdFromRecord(record);
  const base = {
    artifact_id: stringField(record.artifact_id ?? record.artifactId ?? record.id),
    mime_type: stringField(record.mime_type ?? record.mimeType ?? record.content_type ?? record.contentType),
    source_unit_id: explicitSourceUnitId,
    metadata: isObjectRecord(record.metadata) ? record.metadata : undefined,
  };
  const artifacts: Record<string, unknown>[] = [];
  for (const spec of ARTIFACT_URL_FIELD_SPECS) {
    for (const key of spec.keys) {
      const value = record[key];
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        const url = stringField(item);
        if (!url) continue;
        artifacts.push({
          ...base,
          kind: explicitKind ?? spec.kind,
          role: explicitRole ?? spec.role,
          url,
        });
      }
    }
  }
  return artifacts;
}

function collectArtifactSources(
  value: unknown,
  acc: { artifacts: unknown[]; urls: unknown[] },
  depth = 0,
): void {
  if (depth > 6) return;
  if (typeof value === 'string') {
    acc.urls.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectArtifactSources(item, acc, depth + 1);
    return;
  }
  if (!isObjectRecord(value)) return;

  const aliasArtifacts = artifactAliasRecordsFromRecord(value);
  if (aliasArtifacts.length) {
    acc.artifacts.push(...aliasArtifacts);
  } else if (looksLikeArtifactRecord(value)) {
    acc.artifacts.push(value);
  }
  for (const key of ARTIFACT_CONTAINER_KEYS) {
    if (value[key] !== undefined) collectArtifactSources(value[key], acc, depth + 1);
  }
}

function artifactSourcesFromRecord(record: Record<string, unknown>): { artifacts: unknown[]; urls: unknown[] } {
  const acc = { artifacts: [] as unknown[], urls: [] as unknown[] };
  collectArtifactSources(record, acc);
  return acc;
}

function resultArrayField(record: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return undefined;
}

function looksLikeResultRecord(record: Record<string, unknown>): boolean {
  return [
    'gears_job_id',
    'gearsJobId',
    'job_id',
    'jobId',
    'task_id',
    'taskId',
    'id',
    'source_unit_id',
    'sourceUnitId',
    'external_id',
    'externalId',
    'custom_id',
    'customId',
    'production_id',
    'productionId',
    'idempotency_key',
    'idempotencyKey',
    'shot_id',
    'shotId',
    'status',
    'state',
    'phase',
    'job_status',
    'jobStatus',
    'task_state',
    'taskState',
    'progress',
    'progress_percent',
    'progressPercent',
    'percent',
    'percentage',
    'progress_ratio',
    'progressRatio',
    'artifact_url',
    'artifactUrl',
    'artifact_urls',
    'artifactUrls',
    'video_url',
    'videoUrl',
    'output_url',
    'outputUrl',
    'file_url',
    'fileUrl',
    'manifest_url',
    'manifestUrl',
    'subtitle_url',
    'subtitleUrl',
    'srt_url',
    'srtUrl',
    'vtt_url',
    'vttUrl',
    'audio_url',
    'audioUrl',
    'image_url',
    'imageUrl',
    'thumbnail_url',
    'thumbnailUrl',
    'poster_url',
    'posterUrl',
    'url',
    'artifacts',
    'output',
    'outputs',
    'files',
    'media',
    'assets',
    'error_code',
    'errorCode',
    'code',
  ].some(key => record[key] !== undefined);
}

const STATUS_RECORD_CONTAINER_KEYS = [
  'data',
  'result',
  'response',
  'payload',
  'job',
  'task',
  'item',
  'record',
  'callbacks',
  'events',
  'jobs',
  'tasks',
  'items',
  'results',
];

const SUBMIT_RESULT_ARRAY_KEYS = [
  'jobs',
  'submitted_jobs',
  'submittedJobs',
  'accepted_jobs',
  'acceptedJobs',
  'accepted_units',
  'acceptedUnits',
  'results',
  'items',
  'tasks',
];

const SUBMIT_RESULT_SINGLE_KEYS = [
  'job',
  'task',
  'item',
  'record',
];

const SUBMIT_RESULT_CONTAINER_KEYS = [
  'data',
  'result',
  'response',
  'payload',
  'body',
];

const SUBMIT_REJECTED_RESULT_ARRAY_KEYS = [
  'rejected_units',
  'rejectedUnits',
  'rejected_jobs',
  'rejectedJobs',
  'failures',
  'errors',
];

function collectStatusRecords(
  payload: unknown,
  records: Record<string, unknown>[],
  seen: Set<Record<string, unknown>>,
  depth = 0,
): void {
  if (depth > 5) return;
  if (Array.isArray(payload)) {
    for (const item of payload) collectStatusRecords(item, records, seen, depth + 1);
    return;
  }
  if (!isObjectRecord(payload) || seen.has(payload)) return;
  seen.add(payload);

  if (looksLikeResultRecord(payload)) records.push(payload);
  for (const key of STATUS_RECORD_CONTAINER_KEYS) {
    if (payload[key] !== undefined) collectStatusRecords(payload[key], records, seen, depth + 1);
  }
}

function statusRecords(payload: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  collectStatusRecords(payload, records, new Set());
  if (!records.length && isObjectRecord(payload)) records.push(payload);
  return records;
}

function collectSubmitResultRecords(
  payload: unknown,
  records: Record<string, unknown>[],
  seen: Set<Record<string, unknown>>,
  depth = 0,
): void {
  if (depth > 5) return;
  if (Array.isArray(payload)) {
    for (const item of payload) collectSubmitResultRecords(item, records, seen, depth + 1);
    return;
  }
  if (!isObjectRecord(payload) || seen.has(payload)) return;
  seen.add(payload);

  const direct = resultArrayField(payload, SUBMIT_RESULT_ARRAY_KEYS);
  if (direct) {
    for (const item of direct) collectSubmitResultRecords(item, records, seen, depth + 1);
  }
  for (const singleKey of SUBMIT_RESULT_SINGLE_KEYS) {
    const single = payload[singleKey];
    if (single !== undefined) collectSubmitResultRecords(single, records, seen, depth + 1);
  }
  if (looksLikeSubmitResultRecord(payload)) records.push(payload);
  for (const key of SUBMIT_RESULT_CONTAINER_KEYS) {
    const nested = payload[key];
    if (nested !== undefined) collectSubmitResultRecords(nested, records, seen, depth + 1);
  }
}

function looksLikeSubmitResultRecord(record: Record<string, unknown>): boolean {
  return Boolean(
    gearsJobIdFromRecord(record)
      || sourceUnitIdFromRecord(record)
      || idempotencyKeyFromRecord(record)
      || stringField(record.error_code ?? record.errorCode ?? record.code)
      || stringField(record.failure_category ?? record.failureCategory),
  );
}

function resultArray(payload: unknown): unknown[] | undefined {
  const records: Record<string, unknown>[] = [];
  collectSubmitResultRecords(payload, records, new Set());
  return records.length ? records : undefined;
}

function collectRejectedResultRecords(
  payload: unknown,
  records: Record<string, unknown>[],
  seen: Set<Record<string, unknown>>,
  depth = 0,
): void {
  if (depth > 5) return;
  if (Array.isArray(payload)) {
    for (const item of payload) collectRejectedResultRecords(item, records, seen, depth + 1);
    return;
  }
  if (!isObjectRecord(payload) || seen.has(payload)) return;
  seen.add(payload);

  const direct = resultArrayField(payload, SUBMIT_REJECTED_RESULT_ARRAY_KEYS);
  if (direct) {
    for (const item of direct) {
      if (isObjectRecord(item)) records.push(item);
    }
  }
  for (const key of SUBMIT_RESULT_CONTAINER_KEYS) {
    const nested = payload[key];
    if (nested !== undefined) collectRejectedResultRecords(nested, records, seen, depth + 1);
  }
}

function rejectedArray(payload: unknown): unknown[] {
  const records: Record<string, unknown>[] = [];
  collectRejectedResultRecords(payload, records, new Set());
  return records;
}

function normalizeSubmitStatus(value: unknown): GearsExecutionJobStatus {
  const status = normalizeGearsExecutionStatus(value);
  if (status === 'ready' || status === 'failed' || status === 'rejected' || status === 'canceled') return status;
  return status === 'processing' ? 'processing' : 'submitted';
}

function submitFailureFromRecord(input: {
  record: Record<string, unknown>;
  index: number;
  sourceUnitId?: string;
  defaultMessage: string;
}): GearsJobSubmitFailure {
  const message = messageFromRecord(input.record) ?? input.defaultMessage;
  const errorCode = errorCodeFromRecord(input.record);
  return {
    index: input.index,
    source_unit_id: input.sourceUnitId,
    gears_job_id: gearsJobIdFromRecord(input.record),
    idempotency_key: idempotencyKeyFromRecord(input.record),
    failure_category: classifyFailure({
      explicitCategory: input.record.failure_category ?? input.record.failureCategory,
      errorCode,
      failureReason: explicitFailureReasonFromRecord(input.record),
      message,
      statusText: statusFromRecord(input.record),
    }),
    error_code: errorCode,
    message,
  };
}

function normalizeGearsSubmitAdapterResults(input: {
  payload: unknown;
  units: GearsExecutionSubmitUnit[];
}): GearsExecutionSubmitAdapterResult | string {
  if (isObjectRecord(input.payload) && input.payload.ok === false) {
    const error = isObjectRecord(input.payload.error) ? input.payload.error.message : undefined;
    return typeof error === 'string' && error.trim()
      ? `GEARS submit failed: ${error.trim()}`
      : 'GEARS submit returned ok=false';
  }
  const rawResults = resultArray(input.payload) ?? [];
  const rawRejectedResults = rejectedArray(input.payload);
  if (!rawResults.length && !rawRejectedResults.length) {
    return 'GEARS submit response must include jobs/accepted_units/results/items/tasks or a job object';
  }

  const topLevelJobId = isObjectRecord(input.payload) ? gearsJobIdFromRecord(input.payload) : undefined;
  const topLevelStatus = isObjectRecord(input.payload) ? statusFromRecord(input.payload) : undefined;
  const unitsById = new Map(input.units.map(unit => [unit.source_unit_id, unit]));
  const accepted: GearsExecutionAcceptedJob[] = [];
  const failures: GearsJobSubmitFailure[] = [];
  const seenUnitIds = new Set<string>();

  for (const [index, item] of rawResults.entries()) {
    if (!isObjectRecord(item)) return `GEARS submit result #${index + 1} must be an object`;
    const sourceUnitId = sourceUnitIdFromRecord(item)
      ?? (rawResults.length === 1 && input.units.length === 1 ? input.units[0].source_unit_id : undefined);
    if (!sourceUnitId) {
      const looksLikeEnvelope = Boolean(gearsJobIdFromRecord(item))
        && rawResults.some(other => other !== item && isObjectRecord(other) && sourceUnitIdFromRecord(other));
      if (looksLikeEnvelope) continue;
      return `GEARS submit result #${index + 1} requires source_unit_id`;
    }
    const unit = unitsById.get(sourceUnitId);
    if (!unit) {
      failures.push({
        index,
        source_unit_id: sourceUnitId,
        message: `GEARS returned unknown source_unit_id "${sourceUnitId}"`,
      });
      continue;
    }
    seenUnitIds.add(sourceUnitId);
    const status = normalizeSubmitStatus(statusFromRecord(item) ?? topLevelStatus);
    if (status === 'failed' || status === 'rejected' || status === 'canceled') {
      failures.push(submitFailureFromRecord({
        record: item,
        index,
        sourceUnitId,
        defaultMessage: `GEARS rejected ${sourceUnitId}`,
      }));
      continue;
    }
    const gearsJobId = gearsJobIdFromRecord(item) ?? topLevelJobId;
    if (!gearsJobId) {
      failures.push({
        index,
        source_unit_id: sourceUnitId,
        message: 'GEARS accepted unit without gears_job_id/job_id',
      });
      continue;
    }
    const artifactSources = artifactSourcesFromRecord(item);
    const artifacts = normalizeArtifacts({
      artifacts: artifactSources.artifacts,
      urls: artifactSources.urls,
      sourceUnitId,
    });
    accepted.push({
      source_unit_id: sourceUnitId,
      gears_job_id: gearsJobId,
      status,
      idempotency_key: idempotencyKeyFromRecord(item),
      progress_percent: progressPercentFromRecord(item),
      artifacts,
    });
  }

  for (const [index, item] of rawRejectedResults.entries()) {
    if (!isObjectRecord(item)) continue;
    const sourceUnitId = sourceUnitIdFromRecord(item);
    if (sourceUnitId) seenUnitIds.add(sourceUnitId);
    failures.push(submitFailureFromRecord({
      record: item,
      index,
      sourceUnitId,
      defaultMessage: `GEARS rejected ${sourceUnitId ?? `item #${index + 1}`}`,
    }));
  }

  input.units.forEach((unit, index) => {
    if (seenUnitIds.has(unit.source_unit_id)) return;
    failures.push({
      index,
      source_unit_id: unit.source_unit_id,
      message: 'GEARS submit response did not return this unit',
    });
  });

  return {
    accepted,
    failures,
    summary: {
      endpoint_configured: true,
      requested_count: input.units.length,
      accepted_count: accepted.length,
      rejected_count: failures.length,
      status: 'submitted',
    },
  };
}

export function normalizeGearsJobLedger(ledger?: GearsJobLedger): GearsJobLedger {
  return {
    schema_version: 'gears-job-ledger/v1',
    updated_at: ledger?.updated_at,
    items: (ledger?.items ?? [])
      .filter(item => item.gears_job_id?.trim() && item.source_unit_id?.trim())
      .map(item => ({
        ...item,
        idempotency_key: stringField(item.idempotency_key) ?? gearsIdempotencyKey(item.job_type, item.source_unit_id),
        progress_percent: progressPercentField(item.progress_percent),
        artifact_urls: [...new Set(item.artifact_urls ?? [])],
        artifacts: item.artifacts?.filter(artifact => artifact.url?.trim()),
        callback_events: item.callback_events?.slice(-GEARS_CALLBACK_EVENT_RETENTION_LIMIT),
      })),
  };
}

export function gearsJobStatusIsTerminal(status: GearsExecutionJobStatus): boolean {
  return ['ready', 'failed', 'rejected', 'canceled'].includes(status);
}

function gearsJobStatusCarriesFailureContext(status: GearsExecutionJobStatus): boolean {
  return status === 'failed' || status === 'rejected' || status === 'canceled';
}

export function resolveGearsLedgerStatusAfterCallback(input: {
  currentStatus: GearsExecutionJobStatus;
  callbackStatus: GearsExecutionJobStatus;
}): GearsExecutionJobStatus {
  if (gearsJobStatusIsTerminal(input.currentStatus) && !gearsJobStatusIsTerminal(input.callbackStatus)) {
    return input.currentStatus;
  }
  return input.callbackStatus;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unit';
}

export function buildLocalGearsJobId(jobType: GearsExecutionJobType, sourceUnitId: string, index: number): string {
  return `local-gears-${jobType}-${slugify(sourceUnitId)}-${index + 1}`;
}

export async function submitGearsExecutionJobs(input: {
  sourceProjectId?: string;
  sourceStoryId?: string;
  seriesProjectId?: string;
  title: string;
  jobType: GearsExecutionJobType;
  callbackPath: string;
  callbackUrl?: string;
  note?: string;
  useGearsApi?: boolean;
  payload?: Record<string, unknown>;
  units: GearsExecutionSubmitUnit[];
}): Promise<ApiResponse<GearsExecutionSubmitAdapterResult>> {
  if (!input.units.length) {
    return success({
      accepted: [],
      failures: [],
      summary: {
        endpoint_configured: Boolean(configuredGearsApiBaseUrl()),
        requested_count: 0,
        accepted_count: 0,
        rejected_count: 0,
        status: input.useGearsApi ? 'submitted' : 'mocked',
      },
    });
  }

  if (!input.useGearsApi) {
    return success({
      accepted: input.units.map(unit => ({
        source_unit_id: unit.source_unit_id,
        gears_job_id: unit.local_gears_job_id,
        status: 'submitted',
        idempotency_key: gearsIdempotencyKey(input.jobType, unit.source_unit_id),
      })),
      failures: [],
      summary: {
        endpoint_configured: Boolean(configuredGearsApiBaseUrl()),
        requested_count: input.units.length,
        accepted_count: input.units.length,
        rejected_count: 0,
        status: 'mocked',
      },
    });
  }

  const baseUrl = configuredGearsApiBaseUrl();
  if (!baseUrl) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'GEARS_API_BASE_URL is required when use_gears_api=true');
  }

  const endpoint = joinPublicUrl(baseUrl, '/gears/jobs');
  const body = {
    schema_version: 'gears-execution-submit/v1',
    source_project_id: input.sourceProjectId,
    source_story_id: input.sourceStoryId,
    series_project_id: input.seriesProjectId,
    title: input.title,
    job_type: input.jobType,
    callback_path: input.callbackPath,
    callback_url: input.callbackUrl,
    callback_secret_hint: 'GEARS_CALLBACK_SECRET',
    note: input.note,
    payload: {
      ...(input.payload ?? {}),
      units: input.units.map(unit => {
        const payloadMetadata = isObjectRecord(unit.payload.metadata) ? unit.payload.metadata : undefined;
        return {
          ...unit.payload,
          source_unit_id: unit.source_unit_id,
          external_id: unit.source_unit_id,
          externalId: unit.source_unit_id,
          custom_id: unit.source_unit_id,
          customId: unit.source_unit_id,
          idempotency_key: gearsIdempotencyKey(input.jobType, unit.source_unit_id),
          callback_url: input.callbackUrl,
          source_unit_label: unit.source_unit_label,
          source_scene_id: unit.source_scene_id,
          local_gears_job_id: unit.local_gears_job_id,
          payload_summary: unit.payload_summary,
          metadata: {
            ...payloadMetadata,
            source_project_id: input.sourceProjectId,
            source_story_id: input.sourceStoryId,
            series_project_id: input.seriesProjectId,
            job_type: input.jobType,
            source_unit_id: unit.source_unit_id,
            source_unit_label: unit.source_unit_label,
            source_scene_id: unit.source_scene_id,
            local_gears_job_id: unit.local_gears_job_id,
          },
        };
      }),
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = configuredGearsApiToken();
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return fail(
        ErrorCodes.INTERNAL_ERROR,
        `GEARS submit returned HTTP ${response.status}`,
        { status: response.status, body: text.slice(0, 500) },
      );
    }
    const payload = text.trim() ? JSON.parse(text) as unknown : [];
    const normalized = normalizeGearsSubmitAdapterResults({ payload, units: input.units });
    if (typeof normalized === 'string') return fail(ErrorCodes.VALIDATION_ERROR, normalized);
    return success(normalized);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return fail(ErrorCodes.INTERNAL_ERROR, `GEARS submit request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

function extractGearsStatusRecord(payload: unknown, item: GearsJobLedgerItem): Record<string, unknown> | string {
  const records = statusRecords(payload);
  if (!records.length) return 'GEARS status response must include a job/task object';
  const match = records.find(record =>
    gearsJobIdFromRecord(record) === item.gears_job_id
    || sourceUnitIdFromRecord(record) === item.source_unit_id
    || (!!item.idempotency_key && idempotencyKeyFromRecord(record) === item.idempotency_key)
  );
  return match
    ?? records.find(record => gearsJobIdFromRecord(record) || sourceUnitIdFromRecord(record) || idempotencyKeyFromRecord(record))
    ?? records[0];
}

function callbackRecordFromRequest(request: GearsJobCallbackRequest): Record<string, unknown> {
  const envelope = request as Record<string, unknown>;
  const records = statusRecords(envelope);
  return records.find(record => gearsJobIdFromRecord(record) || sourceUnitIdFromRecord(record) || idempotencyKeyFromRecord(record))
    ?? records[0]
    ?? envelope;
}

function callbackEnvelopeDefaults(envelope: Record<string, unknown>): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const key of [
    'job_type',
    'jobType',
    'source_project_id',
    'sourceProjectId',
    'source_story_id',
    'sourceStoryId',
    'series_project_id',
    'seriesProjectId',
    'note',
    'event_id',
    'eventId',
    'callback_id',
    'callbackId',
    'idempotency_key',
    'idempotencyKey',
    'provider_event_at',
    'providerEventAt',
    'event_time',
    'eventTime',
    'event_at',
    'eventAt',
    'timestamp',
    'created_at',
    'createdAt',
    'updated_at',
    'updatedAt',
    'completed_at',
    'completedAt',
    'finished_at',
    'finishedAt',
  ]) {
    if (envelope[key] !== undefined) defaults[key] = envelope[key];
  }
  return defaults;
}

const CALLBACK_BATCH_ARRAY_KEYS = [
  'callbacks',
  'events',
  'jobs',
  'tasks',
  'items',
  'results',
];

const CALLBACK_BATCH_CONTAINER_KEYS = [
  'data',
  'result',
  'response',
  'payload',
];

const GEARS_CALLBACK_BATCH_PATH_KEY = '__gears_callback_batch_path';

type GearsJobCallbackRequestWithBatchPath = GearsJobCallbackRequest & {
  [GEARS_CALLBACK_BATCH_PATH_KEY]?: string;
};

function callbackPathSegment(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function withGearsCallbackBatchPath(
  item: GearsJobCallbackRequest,
  path: string,
): GearsJobCallbackRequestWithBatchPath {
  return {
    ...item,
    [GEARS_CALLBACK_BATCH_PATH_KEY]: path,
  };
}

export function gearsCallbackBatchPath(request: GearsJobCallbackRequest): string | undefined {
  return (request as GearsJobCallbackRequestWithBatchPath)[GEARS_CALLBACK_BATCH_PATH_KEY];
}

function collectCallbackBatchItems(
  value: unknown,
  items: GearsJobCallbackRequestWithBatchPath[],
  depth = 0,
  path = '',
): void {
  if (depth > 4 || !isObjectRecord(value)) return;
  for (const key of CALLBACK_BATCH_ARRAY_KEYS) {
    const arrayValue = value[key];
    if (!Array.isArray(arrayValue)) continue;
    for (const [index, item] of arrayValue.entries()) {
      const itemPath = `${callbackPathSegment(path, key)}[${index}]`;
      items.push(withGearsCallbackBatchPath(
        isObjectRecord(item) ? item as GearsJobCallbackRequest : { payload: item },
        itemPath,
      ));
    }
  }
  for (const key of CALLBACK_BATCH_CONTAINER_KEYS) {
    collectCallbackBatchItems(value[key], items, depth + 1, callbackPathSegment(path, key));
  }
}

function callbackBatchItemsFromEnvelope(envelope: Record<string, unknown>): GearsJobCallbackRequestWithBatchPath[] {
  const items: GearsJobCallbackRequestWithBatchPath[] = [];
  collectCallbackBatchItems(envelope, items);
  return items;
}

export function extractGearsJobCallbackRequests(request: GearsJobCallbackRequest): GearsJobCallbackRequest[] {
  const envelope = request as Record<string, unknown>;
  const defaults = callbackEnvelopeDefaults(envelope);
  const batchItems = callbackBatchItemsFromEnvelope(envelope);
  if (batchItems.length) {
    return batchItems.map(item => ({
      ...defaults,
      ...item,
    }));
  }
  const records = statusRecords(envelope).filter(record =>
    gearsJobIdFromRecord(record) || sourceUnitIdFromRecord(record) || idempotencyKeyFromRecord(record)
  );
  if (!records.length) return [request];
  if (records.length === 1 && records[0] === envelope) return [request];
  return records.map(record => ({
    ...defaults,
    ...record,
  }) as GearsJobCallbackRequest);
}

function gearsStatusRecordToCallback(input: {
  record: Record<string, unknown>;
  item: GearsJobLedgerItem;
  note?: string;
}): GearsJobCallbackRequest {
  const sourceUnitId = sourceUnitIdFromRecord(input.record) ?? input.item.source_unit_id;
  const progressPercent = progressPercentFromRecord(input.record);
  const artifactSources = artifactSourcesFromRecord(input.record);
  const artifacts = normalizeArtifacts({
    artifacts: artifactSources.artifacts,
    urls: artifactSources.urls,
    sourceUnitId,
  });
  return {
    ...input.record,
    gears_job_id: gearsJobIdFromRecord(input.record) ?? input.item.gears_job_id,
    job_type: normalizeJobType(input.record.job_type ?? input.record.jobType) ?? input.item.job_type,
    status: statusFromRecord(input.record),
    ...(progressPercent !== undefined ? { progress_percent: progressPercent } : {}),
    source_project_id: stringField(input.record.source_project_id ?? input.record.sourceProjectId)
      ?? input.item.source_project_id,
    source_story_id: stringField(input.record.source_story_id ?? input.record.sourceStoryId)
      ?? input.item.source_story_id,
    series_project_id: stringField(input.record.series_project_id ?? input.record.seriesProjectId)
      ?? input.item.series_project_id,
    source_unit_id: sourceUnitId,
    artifact_urls: artifacts?.map(artifact => artifact.url),
    artifacts,
    error_code: errorCodeFromRecord(input.record),
    failure_reason: explicitFailureReasonFromRecord(input.record),
    note: stringField(input.record.note) ?? input.note,
  };
}

export async function pollGearsExecutionJobStatuses(input: {
  items: GearsJobLedgerItem[];
  note?: string;
}): Promise<ApiResponse<GearsExecutionPollAdapterResult>> {
  if (!input.items.length) {
    return success({
      callbacks: [],
      failures: [],
      summary: {
        endpoint_configured: Boolean(configuredGearsApiBaseUrl()),
        requested_count: 0,
        returned_count: 0,
        failed_count: 0,
        status: 'submitted',
      },
    });
  }

  const baseUrl = configuredGearsApiBaseUrl();
  if (!baseUrl) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'GEARS_API_BASE_URL is required to sync GEARS job status');
  }

  const callbacks: GearsExecutionPolledJob[] = [];
  const failures: GearsJobSubmitFailure[] = [];
  const token = configuredGearsApiToken();
  for (const [index, item] of input.items.entries()) {
    const endpoint = joinPublicUrl(baseUrl, `/gears/jobs/${encodeURIComponent(item.gears_job_id)}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.authorization = `Bearer ${token}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        failures.push({
          index,
          source_unit_id: item.source_unit_id,
          gears_job_id: item.gears_job_id,
          message: `GEARS status returned HTTP ${response.status}: ${text.slice(0, 180)}`,
        });
        continue;
      }
      const payload = text.trim() ? JSON.parse(text) as unknown : {};
      const record = extractGearsStatusRecord(payload, item);
      if (typeof record === 'string') {
        failures.push({
          index,
          source_unit_id: item.source_unit_id,
          gears_job_id: item.gears_job_id,
          message: record,
        });
        continue;
      }
      callbacks.push({
        item,
        callback: gearsStatusRecordToCallback({ record, item, note: input.note }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      failures.push({
        index,
        source_unit_id: item.source_unit_id,
        gears_job_id: item.gears_job_id,
        message: `GEARS status request failed: ${message}`,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return success({
    callbacks,
    failures,
    summary: {
      endpoint_configured: true,
      requested_count: input.items.length,
      returned_count: callbacks.length,
      failed_count: failures.length,
      status: 'submitted',
    },
  });
}

export function normalizeGearsJobCallback(request: GearsJobCallbackRequest): NormalizedGearsJobCallback {
  const envelope = request as Record<string, unknown>;
  const record = callbackRecordFromRequest(request);
  const merged = {
    ...envelope,
    ...record,
  };
  const sourceUnitId = sourceUnitIdFromRecord(merged);
  const artifactSources = artifactSourcesFromRecord(envelope);
  const artifacts = normalizeArtifacts({
    artifacts: artifactSources.artifacts,
    urls: artifactSources.urls,
    sourceUnitId,
  });
  const artifactUrls = [...new Set((artifacts ?? []).map(artifact => artifact.url))];
  const explicitFailureReason = explicitFailureReasonFromRecord(merged);
  const errorCode = errorCodeFromRecord(merged);
  const message = stringField(merged.message);
  const progressPercent = progressPercentFromRecord(merged);
  const rawStatus = statusFromRecord(merged);
  const status = normalizeGearsExecutionStatus(
    rawStatus,
    artifactUrls.length > 0,
    Boolean(explicitFailureReason),
  );
  const idempotencyKey = idempotencyKeyFromRecord(merged);
  const explicitEventId = stringField(merged.event_id ?? merged.eventId);
  const explicitCallbackId = stringField(merged.callback_id ?? merged.callbackId);
  const eventId = explicitEventId ?? explicitCallbackId ?? idempotencyKey;
  const failureContext = gearsJobStatusCarriesFailureContext(status);
  return {
    gears_job_id: gearsJobIdFromRecord(merged),
    job_type: normalizeJobType(merged.job_type ?? merged.jobType),
    source_project_id: stringField(merged.source_project_id ?? merged.sourceProjectId),
    source_story_id: stringField(merged.source_story_id ?? merged.sourceStoryId),
    series_project_id: stringField(merged.series_project_id ?? merged.seriesProjectId),
    idempotency_key: idempotencyKey,
    source_unit_id: sourceUnitId,
    status,
    progress_percent: progressPercent,
    artifact_urls: artifactUrls,
    artifacts,
    failure_category: failureContext
      ? classifyFailure({
          explicitCategory: merged.failure_category ?? merged.failureCategory,
          errorCode,
          failureReason: explicitFailureReason,
          message,
          statusText: rawStatus,
        })
      : undefined,
    error_code: failureContext ? errorCode : undefined,
    failure_reason: failureContext ? explicitFailureReason ?? message ?? rawStatus : undefined,
    provider_event_at: providerEventAtFromRecord(merged),
    completed_at: completedAtFromRecord(merged),
    event_id: eventId,
    event_id_source: explicitEventId
      ? 'event'
      : explicitCallbackId
        ? 'callback'
        : idempotencyKey
          ? 'idempotency_key'
          : undefined,
    message,
    note: stringField(merged.note),
    quality_score: numberField(merged.quality_score ?? merged.qualityScore),
    review_note: stringField(merged.review_note ?? merged.reviewNote),
  };
}

export function mergeGearsCallbackEvents(input: {
  existing?: GearsJobLedgerEvent[];
  callback: NormalizedGearsJobCallback;
  receivedAt: string;
  previousStatus?: GearsExecutionJobStatus;
  appliedStatus?: GearsExecutionJobStatus;
  statusRegressionIgnored?: boolean;
  terminalStatusChanged?: boolean;
}): GearsJobLedgerEvent[] {
  const event: GearsJobLedgerEvent = {
    event_id: input.callback.event_id,
    event_id_source: input.callback.event_id_source,
    received_at: input.receivedAt,
    provider_event_at: input.callback.provider_event_at,
    previous_status: input.previousStatus,
    status: input.callback.status,
    applied_status: input.appliedStatus,
    status_regression_ignored: input.statusRegressionIgnored || undefined,
    terminal_status_changed: input.terminalStatusChanged || undefined,
    progress_percent: input.callback.progress_percent,
    message: input.callback.message ?? input.callback.note,
  };
  const existing = input.existing ?? [];
  const duplicate = gearsCallbackEventIsDuplicate({
    existing,
    callback: input.callback,
  });
  if (duplicate) return existing.slice(-GEARS_CALLBACK_EVENT_RETENTION_LIMIT);
  return [...existing, event].slice(-GEARS_CALLBACK_EVENT_RETENTION_LIMIT);
}

export function gearsCallbackEventIsDuplicate(input: {
  existing?: GearsJobLedgerEvent[];
  callback: NormalizedGearsJobCallback;
}): boolean {
  const eventId = input.callback.event_id;
  const message = input.callback.message ?? input.callback.note;
  return (input.existing ?? []).some(item => {
    if (eventId?.trim()) {
      if (item.event_id !== eventId) return false;
      if (input.callback.event_id_source !== 'idempotency_key') return true;
      return item.status === input.callback.status
        && item.progress_percent === input.callback.progress_percent
        && item.message === message;
    }
    return !item.event_id
      && item.status === input.callback.status
      && item.progress_percent === input.callback.progress_percent
      && item.message === message;
  });
}

export function buildGearsLedgerItem(input: {
  sourceProjectId?: string;
  sourceStoryId?: string;
  seriesProjectId?: string;
  jobType: GearsExecutionJobType;
  unit: GearsExecutionSubmitUnit;
  accepted: GearsExecutionAcceptedJob;
  submittedAt: string;
  note?: string;
}): GearsJobLedgerItem {
  const artifactUrls = [...new Set((input.accepted.artifacts ?? []).map(artifact => artifact.url))];
  const initialProgress = input.accepted.progress_percent
    ?? (input.accepted.status === 'ready' ? 100 : 0);
  return {
    ledger_id: `gears-ledger-${input.jobType}-${slugify(input.unit.source_unit_id)}`,
    gears_job_id: input.accepted.gears_job_id,
    job_type: input.jobType,
    source_unit_id: input.unit.source_unit_id,
    source_unit_label: input.unit.source_unit_label,
    source_scene_id: input.unit.source_scene_id,
    source_project_id: input.sourceProjectId,
    source_story_id: input.sourceStoryId,
    series_project_id: input.seriesProjectId,
    idempotency_key: input.accepted.idempotency_key ?? gearsIdempotencyKey(input.jobType, input.unit.source_unit_id),
    status: input.accepted.status,
    progress_percent: initialProgress,
    artifact_urls: artifactUrls,
    artifacts: input.accepted.artifacts,
    submitted_at: input.submittedAt,
    updated_at: input.submittedAt,
    payload_summary: input.unit.payload_summary ?? input.note,
  };
}

export function buildRejectedGearsLedgerItem(input: {
  sourceProjectId?: string;
  sourceStoryId?: string;
  seriesProjectId?: string;
  jobType: GearsExecutionJobType;
  unit: GearsExecutionSubmitUnit;
  failure: GearsJobSubmitFailure;
  submittedAt: string;
  note?: string;
}): GearsJobLedgerItem {
  const idempotencyKey = input.failure.idempotency_key ?? gearsIdempotencyKey(input.jobType, input.unit.source_unit_id);
  return {
    ledger_id: `gears-ledger-${input.jobType}-${slugify(input.unit.source_unit_id)}`,
    gears_job_id: input.failure.gears_job_id ?? input.unit.local_gears_job_id,
    job_type: input.jobType,
    source_unit_id: input.unit.source_unit_id,
    source_unit_label: input.unit.source_unit_label,
    source_scene_id: input.unit.source_scene_id,
    source_project_id: input.sourceProjectId,
    source_story_id: input.sourceStoryId,
    series_project_id: input.seriesProjectId,
    idempotency_key: idempotencyKey,
    status: 'rejected',
    progress_percent: 0,
    artifact_urls: [],
    failure_category: input.failure.failure_category ?? classifyFailure({
      errorCode: input.failure.error_code,
      message: input.failure.message,
    }) ?? 'unknown',
    error_code: input.failure.error_code,
    failure_reason: input.failure.message,
    submitted_at: input.submittedAt,
    updated_at: input.submittedAt,
    completed_at: input.submittedAt,
    payload_summary: input.unit.payload_summary ?? input.note,
  };
}

function gearsPollFailureErrorCode(message: string): string {
  const httpStatus = /HTTP\s+(\d{3})/i.exec(message)?.[1];
  if (httpStatus) return `HTTP_${httpStatus}`;
  if (/(abort|timeout|timed out|deadline)/i.test(message)) return 'GEARS_POLL_TIMEOUT';
  if (/(network|socket|dns|connection|econn|fetch failed)/i.test(message)) return 'GEARS_POLL_NETWORK';
  return 'GEARS_POLL_ERROR';
}

export function markGearsLedgerPollFailures(input: {
  ledger: GearsJobLedger;
  failures: GearsJobSubmitFailure[];
  updatedAt: string;
}): GearsJobLedger {
  if (!input.failures.length) return input.ledger;
  const failuresByKey = new Map<string, GearsJobSubmitFailure>();
  for (const failure of input.failures) {
    if (failure.gears_job_id) failuresByKey.set(`job:${failure.gears_job_id}`, failure);
    if (failure.source_unit_id) failuresByKey.set(`unit:${failure.source_unit_id}`, failure);
  }
  return {
    schema_version: 'gears-job-ledger/v1',
    updated_at: input.updatedAt,
    items: input.ledger.items.map(item => {
      const failure = failuresByKey.get(`job:${item.gears_job_id}`)
        ?? failuresByKey.get(`unit:${item.source_unit_id}`);
      if (!failure) return item;
      const errorCode = gearsPollFailureErrorCode(failure.message);
      return {
        ...item,
        updated_at: input.updatedAt,
        last_poll_at: input.updatedAt,
        last_poll_error: failure.message,
        last_poll_failure_category: classifyFailure({
          errorCode,
          message: failure.message,
        }) ?? 'unknown',
        last_poll_error_code: errorCode,
      };
    }),
  };
}

export function mergeGearsLedgerItems(input: {
  existing?: GearsJobLedger;
  items: GearsJobLedgerItem[];
  updatedAt: string;
}): GearsJobLedger {
  const byKey = new Map<string, GearsJobLedgerItem>();
  for (const item of normalizeGearsJobLedger(input.existing).items) {
    byKey.set(`${item.job_type}:${item.source_unit_id}`, item);
  }
  for (const item of input.items) {
    byKey.set(`${item.job_type}:${item.source_unit_id}`, item);
  }
  return {
    schema_version: 'gears-job-ledger/v1',
    updated_at: input.updatedAt,
    items: [...byKey.values()].sort((a, b) =>
      a.job_type.localeCompare(b.job_type)
      || (a.source_scene_id ?? 0) - (b.source_scene_id ?? 0)
      || a.source_unit_id.localeCompare(b.source_unit_id, 'zh-Hans-CN')
    ),
  };
}
