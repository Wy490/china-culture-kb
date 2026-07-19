import type {
  GearsJobLedger,
  GearsJobLedgerItem,
  GearsJobLocalAcceptanceRequest,
  GearsJobStatusSyncRequest,
} from '@shared/types.js';
import {
  gearsJobStatusIsTerminal,
  mergeGearsCallbackEvents,
  mergeGearsExecutionCostFromCallback,
  resolveGearsLedgerStatusAfterCallback,
  type NormalizedGearsJobCallback,
} from './gears-execution-service.js';
import { LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL } from './gears-external-artifact-policy-service.js';

export function projectGearsSyncItems(input: {
  ledger: GearsJobLedger;
  request: GearsJobStatusSyncRequest;
}): {
  items: GearsJobLedgerItem[];
  skippedCount: number;
} {
  const requestedIds = new Set([
    ...(input.request.source_unit_ids ?? []),
    ...(input.request.source_unit_id ? [input.request.source_unit_id] : []),
  ].filter(Boolean));
  const limit = input.request.limit ?? 50;
  const matched = input.ledger.items.filter(item => {
    if (input.request.job_type && item.job_type !== input.request.job_type) return false;
    if (requestedIds.size && !requestedIds.has(item.source_unit_id) && !requestedIds.has(item.gears_job_id)) {
      return false;
    }
    if (!input.request.include_completed && gearsJobStatusIsTerminal(item.status)) return false;
    return true;
  });
  return {
    items: matched.slice(0, limit),
    skippedCount: Math.max(0, matched.length - limit),
  };
}

export function updateGearsLedgerItemFromCallback(input: {
  item: GearsJobLedgerItem;
  callback: NormalizedGearsJobCallback;
  receivedAt: string;
}): GearsJobLedgerItem {
  const status = resolveGearsLedgerStatusAfterCallback({
    currentStatus: input.item.status,
    callbackStatus: input.callback.status,
  });
  const ignoredNonTerminalAfterTerminal = status !== input.callback.status;
  const terminalStatusChanged = gearsJobStatusIsTerminal(input.item.status)
    && gearsJobStatusIsTerminal(input.callback.status)
    && input.item.status !== input.callback.status
    && status === input.callback.status;
  const artifacts = ignoredNonTerminalAfterTerminal
    ? input.item.artifacts
    : input.callback.artifacts ?? input.item.artifacts;
  const artifactUrls = !ignoredNonTerminalAfterTerminal && input.callback.artifact_urls.length
    ? input.callback.artifact_urls
    : input.item.artifact_urls;
  const completed = gearsJobStatusIsTerminal(status);
  const progressPercent = ignoredNonTerminalAfterTerminal
    ? input.item.progress_percent
    : input.callback.progress_percent ?? (status === 'ready' ? 100 : input.item.progress_percent);
  const completedAt = completed
    ? (input.item.status === status && input.item.completed_at
      ? input.item.completed_at
      : input.callback.completed_at ?? input.callback.provider_event_at ?? input.receivedAt)
    : input.item.completed_at;
  return {
    ...input.item,
    gears_job_id: input.callback.gears_job_id ?? input.item.gears_job_id,
    job_type: input.callback.job_type ?? input.item.job_type,
    source_project_id: input.callback.source_project_id ?? input.item.source_project_id,
    source_story_id: input.callback.source_story_id ?? input.item.source_story_id,
    series_project_id: input.callback.series_project_id ?? input.item.series_project_id,
    status,
    progress_percent: progressPercent,
    artifact_urls: artifactUrls,
    artifacts,
    failure_category: ignoredNonTerminalAfterTerminal ? input.item.failure_category : input.callback.failure_category,
    error_code: ignoredNonTerminalAfterTerminal ? input.item.error_code : input.callback.error_code,
    failure_reason: ignoredNonTerminalAfterTerminal ? input.item.failure_reason : input.callback.failure_reason,
    last_poll_at: undefined,
    last_poll_error: undefined,
    last_poll_failure_category: undefined,
    last_poll_error_code: undefined,
    updated_at: input.receivedAt,
    completed_at: completedAt,
    execution_cost: mergeGearsExecutionCostFromCallback(input),
    callback_events: mergeGearsCallbackEvents({
      existing: input.item.callback_events,
      callback: input.callback,
      receivedAt: input.receivedAt,
      previousStatus: input.item.status,
      appliedStatus: status,
      statusRegressionIgnored: ignoredNonTerminalAfterTerminal,
      terminalStatusChanged,
    }),
  };
}

export function localGearsAcceptanceArtifactUrl(input: {
  projectId: string;
  item: GearsJobLedgerItem;
  request: GearsJobLocalAcceptanceRequest;
}): string {
  const mapped = input.request.artifact_url_map?.[input.item.source_unit_id]
    ?? input.request.artifact_url_map?.[input.item.gears_job_id];
  if (mapped) return mapped;
  const base = (input.request.artifact_base_url ?? LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL).replace(/\/+$/, '');
  return [
    base,
    encodeURIComponent(input.projectId),
    `${encodeURIComponent(input.item.source_unit_id)}.mp4`,
  ].join('/');
}

export function projectGearsLocalAcceptanceItems(input: {
  ledger: GearsJobLedger;
  request: GearsJobLocalAcceptanceRequest;
}): {
  items: GearsJobLedgerItem[];
  skippedCount: number;
} {
  const selection = projectGearsSyncItems({
    ledger: input.ledger,
    request: {
      job_type: input.request.job_type,
      source_unit_ids: input.request.source_unit_ids,
      source_unit_id: input.request.source_unit_id,
      include_completed: input.request.include_completed,
      limit: input.request.limit,
      note: input.request.note,
    },
  });
  if (input.request.include_external_jobs) return selection;
  const items = selection.items.filter(item => item.gears_job_id.startsWith('local-gears-'));
  return {
    items,
    skippedCount: selection.skippedCount + selection.items.length - items.length,
  };
}
