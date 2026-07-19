import type {
  GearsExternalCallbackPreflightIssue,
  GearsExternalCallbackPreflightResult,
  GearsJobLedger,
  GearsJobLedgerItem,
} from '@shared/types.js';
import type { NormalizedGearsJobCallback } from './gears-execution-service.js';

export function findGearsLedgerMatch(input: {
  ledger: GearsJobLedger;
  callback: NormalizedGearsJobCallback;
}): GearsJobLedgerItem | string {
  const byJobId = input.callback.gears_job_id
    ? input.ledger.items.find(item => item.gears_job_id === input.callback.gears_job_id)
    : undefined;
  if (byJobId) return byJobId;
  const idempotencyKey = input.callback.idempotency_key;
  if (idempotencyKey) {
    const matches = input.ledger.items.filter(item =>
      item.idempotency_key === idempotencyKey
      && (!input.callback.job_type || item.job_type === input.callback.job_type)
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      return `GEARS callback idempotency_key "${idempotencyKey}" matched multiple jobs; include job_type or gears_job_id`;
    }
  }
  const sourceUnitId = input.callback.source_unit_id;
  if (!sourceUnitId) {
    return input.callback.gears_job_id
      ? `GEARS job "${input.callback.gears_job_id}" was not found in project ledger`
      : idempotencyKey
        ? `GEARS idempotency_key "${idempotencyKey}" was not found in project ledger`
        : 'GEARS callback requires a known gears_job_id, source_unit_id, or idempotency_key';
  }
  const matches = input.ledger.items.filter(item =>
    item.source_unit_id === sourceUnitId
    && (!input.callback.job_type || item.job_type === input.callback.job_type)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return `GEARS callback source_unit_id "${sourceUnitId}" matched multiple jobs; include job_type or gears_job_id`;
  }
  return `GEARS source_unit_id "${sourceUnitId}" was not found in project ledger`;
}

export function preflightIssue(input: {
  index: number;
  severity: GearsExternalCallbackPreflightIssue['severity'];
  code: string;
  message: string;
  path?: string;
  sourceUnitId?: string;
  gearsJobId?: string;
}): GearsExternalCallbackPreflightIssue {
  return {
    index: input.index,
    severity: input.severity,
    code: input.code,
    message: input.message,
    path: input.path,
    source_unit_id: input.sourceUnitId,
    gears_job_id: input.gearsJobId,
  };
}

export function buildGearsExternalCallbackPreflightMarkdown(
  report: Omit<GearsExternalCallbackPreflightResult, 'markdown'>,
): string {
  return [
    `# ${report.project.title} — GEARS 外部回片 preflight`,
    '',
    `> schema: ${report.schema_version}`,
    `> projectId: ${report.project.project_id}`,
    `> received: ${report.received_count}`,
    `> readyToImport: ${report.ready_to_import_count}`,
    `> duplicateEvents: ${report.duplicate_event_count}`,
    `> blocking: ${report.blocking_count}`,
    `> warnings: ${report.warning_count}`,
    '',
    '## Issues',
    '',
    ...(report.issues.length
      ? report.issues.map(issue =>
        `- ${issue.severity} · #${issue.index + 1} · ${issue.code}: ${issue.message}`
      )
      : ['- 未发现阻断问题。']),
    '',
    '## Items',
    '',
    ...(report.items.length
      ? report.items.map(item =>
        `- #${item.index + 1} ${item.source_unit_id ?? item.gears_job_id ?? 'unknown'} · matched=${item.matched_ledger} · eventId=${item.has_event_id} · external=${item.has_external_artifact_url} · placeholder=${item.has_placeholder_artifact_url} · local=${item.has_local_acceptance_artifact_url} · private=${item.has_private_or_local_artifact_url} · invalid=${item.has_invalid_artifact_url} · duplicate=${item.is_duplicate_event} · wouldUpdate=${item.would_update}`
      )
      : ['- 没有可检查的 callback。']),
  ].join('\n');
}
