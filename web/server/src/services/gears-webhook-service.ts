import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { StoryGenerateResult } from '@shared/types.js';
import { FileJobRepository } from '../repositories/job-repository.js';

export interface GearsStoryReadyWebhookPayload {
  event: 'story_ready';
  storyId: string;
  project_id?: string;
  title: string;
  generation_type: string;
  video_type: string;
  presentation_style: string;
  story_structure?: string;
  source_entry: string;
  gears_segments_url: string;
  gears_delivery_url: string;
  gears_video_callback_url: string;
  total_duration_sec: number;
  panel_count_total: number;
  scene_count: number;
  validation_notes_count: number;
  timestamp: string;
}

export type GearsWebhookResult =
  | { status: 'skipped'; reason: 'not_configured'; attemptedAt: string }
  | { status: 'sent'; attempts: number; webhookUrl: string; attemptedAt: string }
  | { status: 'failed'; attempts: number; webhookUrl: string; error: string; attemptedAt: string };

interface NotifyOptions {
  webhookUrl?: string;
  retryDelaysMs?: number[];
  timeoutMs?: number;
  now?: Date;
  generatedRoot?: string;
}

export interface GearsWebhookFailureJobEvent {
  schema_version: 'story-agent-gears-webhook-failure-job/v1';
  failure_id: string;
  timestamp: string;
  attempted_at: string;
  webhook_url: string;
  storyId: string;
  project_id?: string;
  event: 'story_ready';
  error: string;
  payload: GearsStoryReadyWebhookPayload;
}

const DEFAULT_RETRY_DELAYS_MS = [0, 5000, 15000];
const DEFAULT_TIMEOUT_MS = 8000;

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || resolve(kbRoot(), '..', 'web', 'generated');
}

function publicApiUrl(path: string): string {
  const baseUrl = process.env.GEARS_CALLBACK_BASE_URL
    ?? process.env.PUBLIC_API_BASE_URL
    ?? process.env.APP_BASE_URL;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

export function buildGearsStoryReadyPayload(
  story: StoryGenerateResult,
  now = new Date(),
): GearsStoryReadyWebhookPayload {
  const totalDurationSec = story.gears_segments.reduce((sum, segment) => sum + segment.duration_sec, 0);
  const panelCountTotal = story.gears_segments.reduce((sum, segment) => sum + segment.panel_count, 0);
  return {
    event: 'story_ready',
    storyId: story.storyId,
    project_id: story.project_id,
    title: story.title,
    generation_type: story.generation_type,
    video_type: story.video_type,
    presentation_style: story.presentation_style,
    story_structure: story.story_structure,
    source_entry: story.source_entry,
    gears_segments_url: story.gears_segments_url,
    gears_delivery_url: `/api/stories/${story.storyId}/gears-delivery`,
    gears_video_callback_url: publicApiUrl('/api/gears-callback/video-ready'),
    total_duration_sec: totalDurationSec,
    panel_count_total: panelCountTotal,
    scene_count: story.scene_breakdown.length,
    validation_notes_count: story.gears_delivery?.validation_notes.length ?? 0,
    timestamp: now.toISOString(),
  };
}

export async function notifyGearsStoryReady(
  story: StoryGenerateResult,
  options: NotifyOptions = {},
): Promise<GearsWebhookResult> {
  const webhookUrl = options.webhookUrl ?? process.env.GEARS_WEBHOOK_URL;
  const attemptedAt = (options.now ?? new Date()).toISOString();
  if (!webhookUrl) {
    return { status: 'skipped', reason: 'not_configured', attemptedAt };
  }

  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const payload = buildGearsStoryReadyPayload(story, options.now);
  let lastError = '';

  for (let attemptIndex = 0; attemptIndex < retryDelaysMs.length; attemptIndex += 1) {
    const delayMs = retryDelaysMs[attemptIndex];
    if (delayMs > 0) {
      await delay(delayMs);
    }

    try {
      await postWebhook(webhookUrl, payload, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      return { status: 'sent', attempts: attemptIndex + 1, webhookUrl, attemptedAt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const result: GearsWebhookResult = {
    status: 'failed',
    attempts: retryDelaysMs.length,
    webhookUrl,
    error: lastError || 'unknown webhook error',
    attemptedAt,
  };
  await appendWebhookFailure(webhookUrl, payload, result.error, attemptedAt, options.generatedRoot);
  return result;
}

async function postWebhook(
  webhookUrl: string,
  payload: GearsStoryReadyWebhookPayload,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`GEARS webhook returned HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function appendWebhookFailure(
  webhookUrl: string,
  payload: GearsStoryReadyWebhookPayload,
  error: string,
  attemptedAt: string,
  generatedRootOverride?: string,
) {
  const failureId = gearsWebhookFailureId(webhookUrl, payload, attemptedAt);
  await webhookFailureJobRepository(generatedRootOverride).append({
    schema_version: 'story-agent-gears-webhook-failure-job/v1',
    failure_id: failureId,
    timestamp: attemptedAt,
    attempted_at: attemptedAt,
    webhook_url: sanitizeWebhookUrl(webhookUrl),
    storyId: payload.storyId,
    project_id: payload.project_id,
    event: payload.event,
    error: error.slice(0, 2_000),
    payload,
  });
}

function webhookFailureJobRepository(
  generatedRootOverride?: string,
): FileJobRepository<GearsWebhookFailureJobEvent> {
  return new FileJobRepository(
    generatedRootOverride ?? generatedRoot(),
    'webhook_failures.log',
    {
      normalize_item: normalizeWebhookFailureJobEvent,
      item_id: item => item.failure_id,
    },
  );
}

function normalizeWebhookFailureJobEvent(value: unknown): GearsWebhookFailureJobEvent | undefined {
  if (!isRecord(value) || !isRecord(value.payload)) return undefined;
  const payload = value.payload as unknown as GearsStoryReadyWebhookPayload;
  if (
    payload.event !== 'story_ready'
    || typeof payload.storyId !== 'string'
    || typeof payload.timestamp !== 'string'
    || typeof value.webhook_url !== 'string'
    || typeof value.error !== 'string'
  ) return undefined;
  const normalizedPayload = JSON.parse(JSON.stringify(payload)) as GearsStoryReadyWebhookPayload;
  const attemptedAt = typeof value.attempted_at === 'string'
    ? value.attempted_at
    : normalizedPayload.timestamp;
  const failureId = typeof value.failure_id === 'string' && /^[a-f0-9]{64}$/.test(value.failure_id)
    ? value.failure_id
    : gearsWebhookFailureId(value.webhook_url, normalizedPayload, attemptedAt);
  return {
    schema_version: 'story-agent-gears-webhook-failure-job/v1',
    failure_id: failureId,
    timestamp: attemptedAt,
    attempted_at: attemptedAt,
    webhook_url: sanitizeWebhookUrl(value.webhook_url),
    storyId: normalizedPayload.storyId,
    project_id: typeof value.project_id === 'string' ? value.project_id : normalizedPayload.project_id,
    event: 'story_ready',
    error: value.error.slice(0, 2_000),
    payload: normalizedPayload,
  };
}

function gearsWebhookFailureId(
  webhookUrl: string,
  payload: GearsStoryReadyWebhookPayload,
  attemptedAt: string,
): string {
  return createHash('sha256').update(JSON.stringify([
    payload.event,
    payload.storyId,
    payload.project_id ?? null,
    attemptedAt,
    webhookUrl,
  ])).digest('hex');
}

function sanitizeWebhookUrl(webhookUrl: string): string {
  try {
    const parsed = new URL(webhookUrl);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '[invalid-webhook-url]';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function delay(ms: number) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}
