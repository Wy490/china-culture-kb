import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildRejectedGearsLedgerItem,
  getGearsExecutionConfigInfo,
  getGearsExecutionContractInfo,
  getGearsExecutionWorkerCapabilities,
  mergeGearsCallbackEvents,
  normalizeGearsJobCallback,
  submitGearsExecutionJobs,
} from '../services/gears-execution-service.js';
import {
  GEARS_CALLBACK_EVENT_RETENTION_LIMIT,
  type GearsJobLedgerEvent,
} from '@shared/types.js';

function executionWorkerCapabilities() {
  return {
    schema_version: 'gears-execution-worker-capabilities/v1',
    service: 'gears-execution-worker',
    execution_worker_supported: true,
    workbench_import_supported: false,
    bearer_auth_required: false,
    idempotent_submit: true,
    status_poll_supported: true,
    callback_delivery_supported: true,
    supported_job_types: [
      'storyboard_image',
      'character_image',
      'scene_image',
      'seedance_video',
      'subtitle_render',
      'audio_mix',
      'title_card_render',
      'final_assemble',
    ],
    endpoints: {
      capabilities: { method: 'GET', path: '/gears/capabilities' },
      submit: { method: 'POST', path: '/gears/jobs' },
      job_status: { method: 'GET', path: '/gears/jobs/{gears_job_id}' },
    },
  };
}

function stubExecutionWorkerFetch(submitPayload: unknown) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const payload = url.endsWith('/gears/capabilities')
      ? executionWorkerCapabilities()
      : submitPayload;
    return new Response(JSON.stringify(payload));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  delete process.env.GEARS_EXECUTION_WORKER_API_BASE_URL;
  delete process.env.GEARS_EXECUTION_WORKER_API_TOKEN;
  delete process.env.GEARS_API_BASE_URL;
  delete process.env.GEARS_API_TOKEN;
  vi.unstubAllGlobals();
});

describe('gears-execution-service', () => {
  it('prefers explicit execution-worker envs and reports legacy fallback without exposing values', () => {
    process.env.GEARS_EXECUTION_WORKER_API_BASE_URL = 'https://worker.example.test/new';
    process.env.GEARS_EXECUTION_WORKER_API_TOKEN = 'preferred-secret';
    process.env.GEARS_API_BASE_URL = 'https://worker.example.test/legacy';
    process.env.GEARS_API_TOKEN = 'legacy-secret';

    const preferred = getGearsExecutionConfigInfo();

    expect(preferred).toMatchObject({
      api_base_url_env: 'GEARS_EXECUTION_WORKER_API_BASE_URL',
      api_token_env: 'GEARS_EXECUTION_WORKER_API_TOKEN',
      api_base_url_source: 'preferred',
      api_token_source: 'preferred',
      legacy_execution_worker_envs_used: [],
      ready_for_submit: true,
    });
    expect(JSON.stringify(preferred)).not.toContain('preferred-secret');
    expect(JSON.stringify(preferred)).not.toContain('worker.example.test');

    delete process.env.GEARS_EXECUTION_WORKER_API_BASE_URL;
    delete process.env.GEARS_EXECUTION_WORKER_API_TOKEN;
    const legacy = getGearsExecutionConfigInfo();

    expect(legacy).toMatchObject({
      api_base_url_source: 'legacy',
      api_token_source: 'legacy',
      legacy_execution_worker_envs_used: ['GEARS_API_BASE_URL', 'GEARS_API_TOKEN'],
      ready_for_submit: true,
    });
    expect(legacy.configuration_warnings.join('\n')).toContain('legacy');
  });

  it('probes the independent execution-worker capability contract with worker auth', async () => {
    process.env.GEARS_EXECUTION_WORKER_API_BASE_URL = 'https://worker.example.test/root';
    process.env.GEARS_EXECUTION_WORKER_API_TOKEN = 'worker-secret';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(executionWorkerCapabilities())));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getGearsExecutionWorkerCapabilities();

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      schema_version: 'gears-execution-worker-capabilities/v1',
      service: 'gears-execution-worker',
      execution_worker_supported: true,
      workbench_import_supported: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://worker.example.test/root/gears/capabilities',
      expect.objectContaining({
        method: 'GET',
        headers: { authorization: 'Bearer worker-secret' },
      }),
    );
  });

  it('fails closed before submit when the configured endpoint is a workbench', async () => {
    process.env.GEARS_EXECUTION_WORKER_API_BASE_URL = 'https://workbench.example.test';
    const fetchMock = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify({
      schema_version: 'gears-workbench-capabilities/v1',
      service: 'gears-workbench',
      workbench_import_supported: true,
      execution_worker_supported: false,
    })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitGearsExecutionJobs({
      title: 'must not reach submit',
      jobType: 'seedance_video',
      callbackPath: '/api/projects/demo/gears-callback',
      useGearsApi: true,
      units: [{
        source_unit_id: 'shot-1',
        payload: { seedance_prompt: '少年站在门口。' },
        local_gears_job_id: 'local-gears-shot-1',
      }],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('gears-execution-worker capability contract'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://workbench.example.test/gears/capabilities');
  });

  it.each([
    ['ACCESS_DENIED', 'failed', 'provider_auth'],
    ['TOKEN_EXPIRED', 'failed', 'provider_auth'],
    ['RATE_LIMITED', 'failed', 'provider_rate_limit'],
    ['NETWORK_ERROR', 'failed', 'network_error'],
    ['SERVICE_UNAVAILABLE', 'failed', 'provider_server_error'],
    ['RENDER_FAILED', 'failed', 'render_failed'],
    ['ARTIFACT_UPLOAD_FAILED', 'failed', 'artifact_upload_failed'],
    ['CALLBACK_DELIVERY_FAILED', 'failed', 'callback_delivery_failed'],
    ['OUTPUT_MISSING', 'failed', 'output_missing'],
    ['ARTIFACT_INVALID', 'failed', 'artifact_invalid'],
    ['WORKER_UNAVAILABLE', 'failed', 'worker_unavailable'],
    ['ASSET_MISSING', 'rejected', 'asset_missing'],
    ['UNSUPPORTED_MEDIA', 'rejected', 'asset_missing'],
    ['VALIDATION_ERROR', 'rejected', 'payload_invalid'],
  ] as const)(
    'classifies GEARS status alias %s as %s/%s',
    (taskStatus, expectedStatus, expectedCategory) => {
      const callback = normalizeGearsJobCallback({
        jobId: `gears-${taskStatus.toLowerCase()}`,
        sourceUnitId: 'shot-1',
        jobType: 'seedance_video',
        taskStatus,
      });

      expect(callback).toMatchObject({
        status: expectedStatus,
        failure_category: expectedCategory,
        failure_reason: taskStatus,
      });
    },
  );

  it('publishes expanded GEARS status aliases in the worker contract', () => {
    const contract = getGearsExecutionContractInfo();

    expect(contract.capability).toMatchObject({
      method: 'GET',
      path: '/gears/capabilities',
      schema_version: 'gears-execution-worker-capabilities/v1',
      required_before_submit_and_poll: true,
    });
    expect(contract.callback.accepted_status_fields).toEqual(expect.arrayContaining([
      'failed aliases: failed | error | timed_out | timeout | expired | deadline_exceeded | quota_exceeded | no_credit | access_denied | token_expired | rate_limited | network_error | service_unavailable | provider_error | render_failed | artifact_upload_failed | callback_delivery_failed | output_missing | artifact_invalid | worker_unavailable',
      'rejected aliases: rejected | blocked | policy_blocked | moderation_failed | content_policy | safety_blocked | risk_control | invalid_prompt | invalid_payload | validation_failed | asset_missing | unsupported_media | invalid_asset',
    ]));
    expect(contract.poll.accepted_status_fields).toEqual(contract.callback.accepted_status_fields);
    expect(contract.submit.accepted_response_shapes).toEqual(expect.arrayContaining([
      '{ data: { acceptedUnits: [...], rejectedUnits: [...] } }',
      '{ data: { task: { taskId, externalId, taskStatus } } }',
    ]));
    expect(contract.notes).toContain(
      `Each GEARS job ledger item keeps only the latest ${GEARS_CALLBACK_EVENT_RETENTION_LIMIT} callback_events to keep large series ledgers bounded.`,
    );
  });

  it('accepts nested GEARS submit acceptedUnits responses', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    stubExecutionWorkerFetch({
      status: 'ACCEPTED',
      data: {
        acceptedUnits: [{
          taskId: 'gears-submit-accepted-unit-001',
          externalId: 'shot-1',
          taskStatus: 'QUEUED',
          idempotencyKey: 'seedance_video:shot-1',
        }],
      },
    });

    const res = await submitGearsExecutionJobs({
      title: 'GEARS nested submit smoke',
      jobType: 'seedance_video',
      callbackPath: '/api/projects/demo/gears-callback',
      useGearsApi: true,
      units: [{
        source_unit_id: 'shot-1',
        payload: { seedance_prompt: '0-3秒：少年站在门口。' },
        local_gears_job_id: 'local-gears-shot-1',
      }],
    });

    expect(res.ok).toBe(true);
    expect(res.data?.accepted).toEqual([expect.objectContaining({
      source_unit_id: 'shot-1',
      gears_job_id: 'gears-submit-accepted-unit-001',
      status: 'submitted',
      idempotency_key: 'seedance_video:shot-1',
    })]);
    expect(res.data?.summary).toMatchObject({
      requested_count: 1,
      accepted_count: 1,
      rejected_count: 0,
    });
  });

  it('preserves nested GEARS submit rejectedUnits failure context', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    stubExecutionWorkerFetch({
      status: 'ACCEPTED',
      data: {
        acceptedUnits: [{
          taskId: 'gears-submit-accepted-unit-001',
          externalId: 'shot-1',
          taskStatus: 'QUEUED',
          idempotencyKey: 'seedance_video:shot-1',
        }],
        rejectedUnits: [{
          taskId: 'gears-submit-rejected-unit-002',
          externalId: 'shot-2',
          taskStatus: 'CONTENT_POLICY',
          idempotencyKey: 'seedance_video:shot-2',
          errorCode: 'CONTENT_POLICY',
          failureCategory: 'content_policy',
          message: 'prompt contains blocked material',
        }],
      },
    });

    const res = await submitGearsExecutionJobs({
      title: 'GEARS mixed submit smoke',
      jobType: 'seedance_video',
      callbackPath: '/api/projects/demo/gears-callback',
      useGearsApi: true,
      units: [
        {
          source_unit_id: 'shot-1',
          payload: { seedance_prompt: '0-3秒：少年站在门口。' },
          local_gears_job_id: 'local-gears-shot-1',
        },
        {
          source_unit_id: 'shot-2',
          payload: { seedance_prompt: '0-3秒：少年转身奔跑。' },
          local_gears_job_id: 'local-gears-shot-2',
        },
      ],
    });

    expect(res.ok).toBe(true);
    expect(res.data?.summary).toMatchObject({
      requested_count: 2,
      accepted_count: 1,
      rejected_count: 1,
    });
    expect(res.data?.failures).toEqual([expect.objectContaining({
      source_unit_id: 'shot-2',
      gears_job_id: 'gears-submit-rejected-unit-002',
      idempotency_key: 'seedance_video:shot-2',
      failure_category: 'content_policy',
      error_code: 'CONTENT_POLICY',
      message: 'prompt contains blocked material',
    })]);
    expect(res.data?.failures.map(failure => failure.message)).not.toContain(
      'GEARS submit response did not return this unit',
    );
  });

  it('accepts deep GEARS submit envelopes with mixed accepted and rejected records', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    stubExecutionWorkerFetch({
      response: {
        payload: {
          result: {
            tasks: [{
              id: 'gears-deep-task-001',
              externalId: 'shot-1',
              state: 'queued',
              idempotencyKey: 'seedance_video:shot-1',
            }],
            rejectedJobs: [{
              jobId: 'gears-deep-rejected-002',
              externalId: 'shot-2',
              status: 'INVALID_PAYLOAD',
              code: 'PROMPT_TOO_LONG',
              error: {
                message: 'prompt too long for worker',
              },
            }],
          },
        },
      },
    });

    const res = await submitGearsExecutionJobs({
      title: 'GEARS deep envelope submit smoke',
      jobType: 'seedance_video',
      callbackPath: '/api/projects/demo/gears-callback',
      useGearsApi: true,
      units: [
        {
          source_unit_id: 'shot-1',
          payload: { seedance_prompt: '0-3秒：少年站在门口。' },
          local_gears_job_id: 'local-gears-shot-1',
        },
        {
          source_unit_id: 'shot-2',
          payload: { seedance_prompt: '0-3秒：少年转身奔跑。'.repeat(80) },
          local_gears_job_id: 'local-gears-shot-2',
        },
      ],
    });

    expect(res.ok).toBe(true);
    expect(res.data?.summary).toMatchObject({
      requested_count: 2,
      accepted_count: 1,
      rejected_count: 1,
    });
    expect(res.data?.accepted).toEqual([expect.objectContaining({
      source_unit_id: 'shot-1',
      gears_job_id: 'gears-deep-task-001',
      status: 'submitted',
      idempotency_key: 'seedance_video:shot-1',
    })]);
    expect(res.data?.failures).toEqual([expect.objectContaining({
      source_unit_id: 'shot-2',
      gears_job_id: 'gears-deep-rejected-002',
      failure_category: 'payload_invalid',
      error_code: 'PROMPT_TOO_LONG',
      message: 'prompt too long for worker',
    })]);
  });

  it('accepts rejected-only GEARS submit responses as structured failures', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    stubExecutionWorkerFetch({
      data: {
        rejectedUnits: [{
          externalId: 'shot-1',
          taskStatus: 'VALIDATION_ERROR',
          errorCode: 'INVALID_PAYLOAD',
          message: 'seedance_prompt is required',
        }],
      },
    });

    const res = await submitGearsExecutionJobs({
      title: 'GEARS rejected-only submit smoke',
      jobType: 'seedance_video',
      callbackPath: '/api/projects/demo/gears-callback',
      useGearsApi: true,
      units: [{
        source_unit_id: 'shot-1',
        payload: { seedance_prompt: '' },
        local_gears_job_id: 'local-gears-shot-1',
      }],
    });

    expect(res.ok).toBe(true);
    expect(res.data?.accepted).toEqual([]);
    expect(res.data?.summary).toMatchObject({
      requested_count: 1,
      accepted_count: 0,
      rejected_count: 1,
    });
    expect(res.data?.failures[0]).toMatchObject({
      source_unit_id: 'shot-1',
      failure_category: 'payload_invalid',
      error_code: 'INVALID_PAYLOAD',
      message: 'seedance_prompt is required',
    });
  });

  it('builds rejected submit failures into terminal GEARS ledger items', () => {
    const item = buildRejectedGearsLedgerItem({
      sourceProjectId: 'project-001',
      sourceStoryId: 'story-001',
      jobType: 'seedance_video',
      submittedAt: '2026-06-21T03:30:00.000Z',
      unit: {
        source_unit_id: 'shot-2',
        source_unit_label: '第二镜',
        source_scene_id: 2,
        local_gears_job_id: 'local-gears-seedance_video-shot-2-1',
        payload: { seedance_prompt: '0-3秒：少年转身奔跑。' },
        payload_summary: '少年转身奔跑',
      },
      failure: {
        index: 1,
        source_unit_id: 'shot-2',
        gears_job_id: 'gears-submit-rejected-unit-002',
        idempotency_key: 'seedance_video:shot-2',
        failure_category: 'content_policy',
        error_code: 'CONTENT_POLICY',
        message: 'prompt contains blocked material',
      },
    });

    expect(item).toMatchObject({
      ledger_id: 'gears-ledger-seedance_video-shot-2',
      gears_job_id: 'gears-submit-rejected-unit-002',
      source_unit_id: 'shot-2',
      idempotency_key: 'seedance_video:shot-2',
      status: 'rejected',
      progress_percent: 0,
      failure_category: 'content_policy',
      error_code: 'CONTENT_POLICY',
      failure_reason: 'prompt contains blocked material',
      completed_at: '2026-06-21T03:30:00.000Z',
      payload_summary: '少年转身奔跑',
    });
  });

  it('accepts nested GEARS submit single task responses', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    stubExecutionWorkerFetch({
      data: {
        task: {
          taskId: 'gears-submit-task-001',
          externalId: 'shot-1',
          taskStatus: 'PROCESSING',
        },
      },
    });

    const res = await submitGearsExecutionJobs({
      title: 'GEARS nested single task smoke',
      jobType: 'seedance_video',
      callbackPath: '/api/projects/demo/gears-callback',
      useGearsApi: true,
      units: [{
        source_unit_id: 'shot-1',
        payload: { seedance_prompt: '0-3秒：少年站在门口。' },
        local_gears_job_id: 'local-gears-shot-1',
      }],
    });

    expect(res.ok).toBe(true);
    expect(res.data?.accepted[0]).toMatchObject({
      source_unit_id: 'shot-1',
      gears_job_id: 'gears-submit-task-001',
      status: 'processing',
    });
  });

  it('caps callback event history to the latest events', () => {
    let events: GearsJobLedgerEvent[] = [];
    for (let index = 0; index < GEARS_CALLBACK_EVENT_RETENTION_LIMIT + 5; index += 1) {
      events = mergeGearsCallbackEvents({
        existing: events,
        receivedAt: `2026-06-21T00:00:${String(index).padStart(2, '0')}.000Z`,
        callback: normalizeGearsJobCallback({
          jobId: 'gears-bounded-events',
          sourceUnitId: 'shot-1',
          jobType: 'seedance_video',
          taskStatus: 'PROCESSING',
          progressPercent: index,
          eventId: `gears-event-${index}`,
          message: `progress ${index}`,
        }),
      });
    }

    expect(events).toHaveLength(GEARS_CALLBACK_EVENT_RETENTION_LIMIT);
    expect(events[0]).toMatchObject({
      event_id: 'gears-event-5',
      progress_percent: 5,
    });
    expect(events.at(-1)).toMatchObject({
      event_id: `gears-event-${GEARS_CALLBACK_EVENT_RETENTION_LIMIT + 4}`,
      progress_percent: GEARS_CALLBACK_EVENT_RETENTION_LIMIT + 4,
    });
  });
});
