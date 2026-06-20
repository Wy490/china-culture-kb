import {
  ErrorCodes,
  fail,
  success,
} from '@shared/types.js';
import type {
  ApiResponse,
  GearsExecutionArtifact,
  GearsExecutionConfigInfo,
  GearsExecutionContractInfo,
  GearsExecutionFailureCategory,
  GearsExecutionJobStatus,
  GearsExecutionJobType,
  GearsJobCallbackRequest,
  GearsJobLedgerEvent,
  GearsJobLedger,
  GearsJobLedgerItem,
  GearsJobSubmitAdapterSummary,
  GearsJobSubmitFailure,
  GearsJobStatusSyncAdapterSummary,
} from '@shared/types.js';

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
        rejected_units: [],
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
      accepted_status_fields: [
        'status',
        'taskStatus',
        'state',
        'task_state',
        'job_status',
        'ready aliases: completed | complete | succeeded | success | done | finished',
        'failed aliases: failed | error | timed_out | timeout | expired | deadline_exceeded | quota_exceeded | no_credit | provider_error',
        'rejected aliases: rejected | blocked | policy_blocked | moderation_failed | content_policy | safety_blocked | risk_control | invalid_prompt | invalid_payload | validation_failed',
        'canceled aliases: canceled | cancelled | aborted | user_canceled | manual_canceled',
      ],
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
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
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
    'provider_error',
    'provider-error',
    'server_error',
    'server-error',
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
    'validation_failed',
    'validation-failed',
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
  const normalized = value.trim();
  const categories: GearsExecutionFailureCategory[] = [
    'asset_missing',
    'payload_invalid',
    'content_policy',
    'provider_timeout',
    'provider_quota',
    'provider_auth',
    'provider_rate_limit',
    'provider_server_error',
    'network_error',
    'unknown',
  ];
  return categories.includes(normalized as GearsExecutionFailureCategory)
    ? normalized as GearsExecutionFailureCategory
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
  if (/(asset|material|file|upload|reference|missing|not_found|not found|素材|文件|上传|缺失|缺少)/.test(text)) {
    return 'asset_missing';
  }
  if (/(payload|prompt|parameter|invalid|bad_request|400|提示词|参数|格式|无效|过长|超长)/.test(text)) {
    return 'payload_invalid';
  }
  if (/(policy|safety|moderation|copyright|sensitive|violation|risk_control|risk control|违规|审核|安全|敏感|版权)/.test(text)) {
    return 'content_policy';
  }
  if (/(timeout|timed out|timed_out|deadline|deadline_exceeded|expired|超时|等待过久)/.test(text)) return 'provider_timeout';
  if (/(quota|credit|no_credit|insufficient|balance|billing|payment|余额|额度|配额|欠费)/.test(text)) return 'provider_quota';
  if (/(auth|unauthorized|forbidden|401|403|token|signature|permission|鉴权|认证|权限|令牌|签名)/.test(text)) {
    return 'provider_auth';
  }
  if (/(rate|too_many|429|throttle|限流|频率|过多请求)/.test(text)) return 'provider_rate_limit';
  if (/(5\d\d|server|internal|unavailable|gateway|平台异常|服务异常|服务器|不可用)/.test(text)) {
    return 'provider_server_error';
  }
  if (/(network|socket|dns|connection|econn|网络|连接)/.test(text)) return 'network_error';
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

function resultArray(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  if (!isObjectRecord(payload)) return undefined;
  const direct = resultArrayField(payload, [
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
  ]);
  if (direct) return direct;
  for (const key of ['data', 'result', 'response', 'payload']) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested;
    if (isObjectRecord(nested)) {
      const nestedArray = resultArrayField(nested, [
        'jobs',
        'submitted_jobs',
        'accepted_units',
        'results',
        'items',
        'tasks',
      ]);
      if (nestedArray) return nestedArray;
      if (looksLikeResultRecord(nested)) return [nested];
    }
  }
  if (looksLikeResultRecord(payload)) return [payload];
  return undefined;
}

function rejectedArray(payload: unknown): unknown[] {
  if (!isObjectRecord(payload)) return [];
  const direct = resultArrayField(payload, ['rejected_units', 'rejectedUnits', 'rejected_jobs', 'failures', 'errors']);
  if (direct) return direct;
  for (const key of ['data', 'result', 'response', 'payload']) {
    const nested = payload[key];
    if (!isObjectRecord(nested)) continue;
    const nestedArray = resultArrayField(nested, ['rejected_units', 'rejectedUnits', 'rejected_jobs', 'failures', 'errors']);
    if (nestedArray) return nestedArray;
  }
  return [];
}

function normalizeSubmitStatus(value: unknown): GearsExecutionJobStatus {
  const status = normalizeGearsExecutionStatus(value);
  if (status === 'ready' || status === 'failed' || status === 'rejected' || status === 'canceled') return status;
  return status === 'processing' ? 'processing' : 'submitted';
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
  const rawResults = resultArray(input.payload);
  if (!rawResults) {
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
    if (!sourceUnitId) return `GEARS submit result #${index + 1} requires source_unit_id`;
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
    const message = messageFromRecord(item);
    if (status === 'failed' || status === 'rejected' || status === 'canceled') {
      failures.push({
        index,
        source_unit_id: sourceUnitId,
        message: message ?? `GEARS rejected ${sourceUnitId}`,
      });
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

  input.units.forEach((unit, index) => {
    if (seenUnitIds.has(unit.source_unit_id)) return;
    failures.push({
      index,
      source_unit_id: unit.source_unit_id,
      message: 'GEARS submit response did not return this unit',
    });
  });

  for (const [index, item] of rejectedArray(input.payload).entries()) {
    if (!isObjectRecord(item)) continue;
    const sourceUnitId = sourceUnitIdFromRecord(item);
    failures.push({
      index,
      source_unit_id: sourceUnitId,
      message: messageFromRecord(item) ?? `GEARS rejected ${sourceUnitId ?? `item #${index + 1}`}`,
    });
  }

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
        callback_events: item.callback_events?.slice(-20),
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
  if (duplicate) return existing.slice(-20);
  return [...existing, event].slice(-20);
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
