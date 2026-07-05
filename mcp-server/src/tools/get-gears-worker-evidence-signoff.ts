import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';

type SignoffStatus = 'ready' | 'attention' | 'blocked';
type StoryAgentMvpStatus = 'ready' | 'needs_action' | 'blocked';
type JsonRecord = Record<string, unknown>;
type EvidenceDirSource = 'input' | 'env' | 'latest' | 'missing';

export interface GetGearsWorkerEvidenceSignoffInput {
  evidence_dir?: string;
  include_markdown?: boolean;
}

export interface GearsWorkerEvidenceSignoffAction {
  priority?: string;
  owner?: string;
  action: string;
  evidence?: string;
  gate_id?: string;
  sample_files?: string[];
  sample_paths?: string[];
}

export interface GearsWorkerEvidenceSignoffGate {
  id: string;
  label?: string;
  status: string;
  summary?: string;
}

export interface GearsWorkerEvidenceSignoffReport {
  schema_version: 'mcp-gears-worker-evidence-signoff/v1';
  provider: 'gears';
  status: SignoffStatus;
  evidence_dir?: string;
  evidence_dir_source?: EvidenceDirSource;
  evidence_dir_allowed: boolean;
  evidence_dir_error?: string;
  acceptance_passed: boolean;
  signoff_ready: boolean;
  integrity_passed: boolean;
  health_audit_passed: boolean;
  mvp_status_audit_passed: boolean;
  system_external_callback_passed: boolean;
  system_external_callback_ready_to_import_count: number;
  system_external_callback_updated_count: number;
  system_external_callback_blocking_count: number;
  system_external_callback_failed_count: number;
  system_external_callback_unresolved_count: number;
  system_external_callback_project_count: number;
  system_external_output_url_source_ready: boolean;
  system_external_output_url_configured_from_env: boolean;
  system_external_output_url_source: string;
  pressure_submitted: boolean;
  gate_counts: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  failed_gate_ids: string[];
  skipped_gate_ids: string[];
  missing_required_attachment_count: number;
  required_attachment_count: number;
  required_checksum_count: number;
  evidence_file_count: number;
  worker_record_count: number;
  worker_transport_error_count: number;
  worker_http_error_count: number;
  worker_unknown_count: number;
  worker_missing_worker_id_count: number;
  worker_missing_source_id_count: number;
  worker_missing_ready_artifact_count: number;
  worker_failure_category_counts: Record<string, number>;
  callback_transport_error_count: number;
  callback_http_error_count: number;
  callback_ledger_match_missing_count: number;
  callback_failed_count: number;
  health_ready_count_before: number;
  health_ready_count_after: number;
  health_ready_count_delta: number;
  health_interrupted_count_delta: number;
  health_production_gap_count_delta: number;
  mvp_status_before?: StoryAgentMvpStatus;
  mvp_status_after?: StoryAgentMvpStatus;
  mvp_score_before: number;
  mvp_score_after: number;
  mvp_score_delta: number;
  large_project_request_unit_count: number;
  large_project_response_record_count: number;
  large_project_accepted_count: number;
  large_project_rejected_count: number;
  large_project_failed_count: number;
  large_project_source_echo_count: number;
  large_project_missing_requested_source_count: number;
  large_project_duplicate_source_id_count: number;
  large_project_unexpected_source_count: number;
  required_files: string[];
  missing_required_files: string[];
  gates: GearsWorkerEvidenceSignoffGate[];
  recommended_actions: GearsWorkerEvidenceSignoffAction[];
  markdown?: string;
  generated_at: string;
}

interface EvidenceRead {
  filename: string;
  exists: boolean;
  parse_ok: boolean;
  data?: JsonRecord;
  parse_error?: string;
}

function repoRoot(): string {
  return path.resolve(getKbRoot(), '..');
}

function isPathInside(rootPath: string, targetPath: string): boolean {
  const rel = path.relative(rootPath, targetPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function allowedEvidenceRoots(): string[] {
  return [
    path.resolve('/private/tmp'),
    path.resolve('/tmp'),
    path.resolve(os.tmpdir()),
    repoRoot(),
  ];
}

function evidenceAutoDiscoverEnabled(): boolean {
  const raw = process.env.GEARS_EVIDENCE_AUTO_DISCOVER?.trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

function evidenceDiscoveryRoots(): string[] {
  const allowedRoots = allowedEvidenceRoots();
  const override = process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS?.trim();
  if (!override) return Array.from(new Set(allowedRoots));
  const roots = override
    .split(path.delimiter)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => path.resolve(path.isAbsolute(item) ? item : path.resolve(repoRoot(), item)))
    .filter(item => allowedRoots.some(root => isPathInside(root, item)));
  return roots.length ? Array.from(new Set(roots)) : Array.from(new Set(allowedRoots));
}

function isWorkerEvidenceDirName(name: string): boolean {
  return name.startsWith('gears-worker-evidence');
}

async function evidenceCandidateMtimeMs(evidenceDir: string): Promise<number | null> {
  const sentinels = [
    'gears-worker-acceptance-verdict.json',
    'gears-worker-acceptance-archive.json',
    'gears-worker-acceptance-integrity.json',
  ];
  let newest = 0;
  for (const filename of sentinels) {
    try {
      const fileStat = await fs.stat(path.resolve(evidenceDir, filename));
      newest = Math.max(newest, fileStat.mtimeMs);
    } catch {
      // Ignore missing sentinel files while discovering candidate directories.
    }
  }
  return newest > 0 ? newest : null;
}

async function findLatestEvidenceDir(): Promise<string | undefined> {
  const candidates: Array<{ evidenceDir: string; mtimeMs: number }> = [];
  for (const root of evidenceDiscoveryRoots()) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !isWorkerEvidenceDirName(entry.name)) continue;
      const evidenceDir = path.resolve(root, entry.name);
      if (!allowedEvidenceRoots().some(allowedRoot => isPathInside(allowedRoot, evidenceDir))) continue;
      const mtimeMs = await evidenceCandidateMtimeMs(evidenceDir);
      if (mtimeMs !== null) candidates.push({ evidenceDir, mtimeMs });
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || right.evidenceDir.localeCompare(left.evidenceDir));
  return candidates[0]?.evidenceDir;
}

function resolveExplicitEvidenceDir(
  raw: string,
  source: EvidenceDirSource,
): { evidenceDir?: string; source: EvidenceDirSource; allowed: boolean; error?: string } {
  if (raw.includes('\0')) return { source, allowed: false, error: 'invalid_evidence_dir' };
  const normalized = path.resolve(path.isAbsolute(raw) ? raw : path.resolve(repoRoot(), raw));
  const allowedRoots = allowedEvidenceRoots();
  if (!allowedRoots.some(root => isPathInside(root, normalized))) {
    return { evidenceDir: normalized, source, allowed: false, error: 'evidence_dir_not_allowed' };
  }
  return { evidenceDir: normalized, source, allowed: true };
}

async function resolveEvidenceDir(
  input?: string,
): Promise<{ evidenceDir?: string; source: EvidenceDirSource; allowed: boolean; error?: string }> {
  const inputRaw = input?.trim();
  if (inputRaw) return resolveExplicitEvidenceDir(inputRaw, 'input');
  const envRaw = process.env.GEARS_EVIDENCE_DIR?.trim();
  if (envRaw) return resolveExplicitEvidenceDir(envRaw, 'env');
  if (evidenceAutoDiscoverEnabled()) {
    const latest = await findLatestEvidenceDir();
    if (latest) return resolveExplicitEvidenceDir(latest, 'latest');
  }
  return { source: 'missing', allowed: false, error: 'missing_evidence_dir' };
}

async function readEvidenceJson(evidenceDir: string, filename: string): Promise<EvidenceRead> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.resolve(evidenceDir, filename), 'utf-8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { filename, exists: true, parse_ok: false, parse_error: 'json_root_not_object' };
    }
    return { filename, exists: true, parse_ok: true, data: parsed as JsonRecord };
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

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asApiData(value: unknown): JsonRecord {
  const root = asRecord(value);
  const data = asRecord(root.data);
  return Object.keys(data).length ? data : root;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string');
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function isPublicExternalArtifactUrl(value: unknown): boolean {
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

function asNumberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(asRecord(value))
      .map(([key, item]) => [key, asNumber(item)] as const)
      .filter(([, item]) => item !== 0),
  );
}

function evidenceActions(value: unknown): GearsWorkerEvidenceSignoffAction[] {
  return asArray(value)
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      priority: typeof item.priority === 'string' ? item.priority : undefined,
      owner: typeof item.owner === 'string' ? item.owner : undefined,
      action: typeof item.action === 'string' ? item.action : 'Inspect evidence record.',
      evidence: typeof item.evidence === 'string' ? item.evidence : undefined,
      gate_id: typeof item.gate_id === 'string' ? item.gate_id : undefined,
      sample_files: asStringArray(item.sample_files),
      sample_paths: asStringArray(item.sample_paths),
    }));
}

function dedupeActions(actions: GearsWorkerEvidenceSignoffAction[]): GearsWorkerEvidenceSignoffAction[] {
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

function renderMarkdown(report: Omit<GearsWorkerEvidenceSignoffReport, 'markdown'>): string {
  const categoryLine = Object.entries(report.worker_failure_category_counts)
    .map(([key, count]) => `${key}=${count}`)
    .join(', ') || 'none';
  const lines = [
    '# MCP GEARS Worker Evidence Signoff',
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
    `- mvp_status_audit_passed: ${report.mvp_status_audit_passed}`,
    `- system_external_callback_passed: ${report.system_external_callback_passed}`,
    `- system_external_output_url_source: ${report.system_external_output_url_source}`,
    `- system_external_output_url_source_ready: ${report.system_external_output_url_source_ready}`,
    `- system_external_output_url_configured_from_env: ${report.system_external_output_url_configured_from_env}`,
    `- system_external_callback_ready/updated: ${report.system_external_callback_ready_to_import_count}/${report.system_external_callback_updated_count}`,
    `- system_external_callback_blocking/failed/unresolved: ${report.system_external_callback_blocking_count}/${report.system_external_callback_failed_count}/${report.system_external_callback_unresolved_count}`,
    `- pressure_submitted: ${report.pressure_submitted}`,
    `- gates passed/failed/skipped/total: ${report.gate_counts.passed}/${report.gate_counts.failed}/${report.gate_counts.skipped}/${report.gate_counts.total}`,
    `- failed_gate_ids: ${report.failed_gate_ids.join(', ') || 'none'}`,
    `- missing_required_attachment_count: ${report.missing_required_attachment_count}/${report.required_attachment_count}`,
    `- worker_record_count: ${report.worker_record_count}`,
    `- worker_transport/http_errors: ${report.worker_transport_error_count}/${report.worker_http_error_count}`,
    `- worker_failure_categories: ${categoryLine}`,
    `- callback_transport/http_errors: ${report.callback_transport_error_count}/${report.callback_http_error_count}`,
    `- callback_ledger_match_missing_count: ${report.callback_ledger_match_missing_count}`,
    `- health_ready_delta: ${report.health_ready_count_delta}`,
    `- health_interrupted_delta: ${report.health_interrupted_count_delta}`,
    `- mvp_status_before/after: ${report.mvp_status_before ?? 'n/a'}/${report.mvp_status_after ?? 'n/a'}`,
    `- mvp_score_delta: ${report.mvp_score_delta}`,
    `- large_project_source_echo: ${report.large_project_source_echo_count}/${report.large_project_request_unit_count}`,
    `- large_project_records/accepted/rejected/failed: ${report.large_project_response_record_count}/${report.large_project_accepted_count}/${report.large_project_rejected_count}/${report.large_project_failed_count}`,
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
      ? report.recommended_actions.map(action => `- [${action.priority ?? 'P?'}] ${action.owner ?? 'unknown'}: ${action.action} (${action.evidence ?? 'evidence'})`)
      : ['- none']),
  ];
  return `${lines.join('\n').trim()}\n`;
}

export async function getGearsWorkerEvidenceSignoff(
  input: GetGearsWorkerEvidenceSignoffInput = {},
): Promise<GearsWorkerEvidenceSignoffReport> {
  const resolved = await resolveEvidenceDir(input.evidence_dir);
  const generatedAt = new Date().toISOString();
  if (!resolved.allowed || !resolved.evidenceDir) {
    const report: Omit<GearsWorkerEvidenceSignoffReport, 'markdown'> = {
      schema_version: 'mcp-gears-worker-evidence-signoff/v1',
      provider: 'gears',
      status: 'blocked',
      evidence_dir: resolved.evidenceDir,
      evidence_dir_source: resolved.source,
      evidence_dir_allowed: false,
      evidence_dir_error: resolved.error,
      acceptance_passed: false,
      signoff_ready: false,
      integrity_passed: false,
      health_audit_passed: false,
      mvp_status_audit_passed: false,
      system_external_callback_passed: false,
      system_external_callback_ready_to_import_count: 0,
      system_external_callback_updated_count: 0,
      system_external_callback_blocking_count: 0,
      system_external_callback_failed_count: 0,
      system_external_callback_unresolved_count: 0,
      system_external_callback_project_count: 0,
      system_external_output_url_source_ready: false,
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
      mvp_score_before: 0,
      mvp_score_after: 0,
      mvp_score_delta: 0,
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
        summary: resolved.error,
      }],
      recommended_actions: [{
        priority: 'P0',
        owner: 'Story Agent smoke env',
        action: 'Set GEARS_EVIDENCE_DIR or pass an allowed evidence_dir under /private/tmp, /tmp, TMPDIR, or the repository.',
        evidence: resolved.error,
      }],
      generated_at: generatedAt,
    };
    return input.include_markdown === false ? report : { ...report, markdown: renderMarkdown(report) };
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
    mvpRead,
    pressureRead,
  ] = await Promise.all([
    readEvidenceJson(resolved.evidenceDir, 'gears-worker-acceptance-verdict.json'),
    readEvidenceJson(resolved.evidenceDir, 'gears-worker-acceptance-archive.json'),
    readEvidenceJson(resolved.evidenceDir, 'gears-worker-acceptance-integrity.json'),
    readEvidenceJson(resolved.evidenceDir, 'gears-worker-response-audit.json'),
    readEvidenceJson(resolved.evidenceDir, 'story-agent-callback-response-audit.json'),
    readEvidenceJson(resolved.evidenceDir, 'story-agent-system-external-output-url-source.json'),
    readEvidenceJson(resolved.evidenceDir, 'story-agent-system-external-callback-preflight-response.json'),
    readEvidenceJson(resolved.evidenceDir, 'story-agent-system-external-callback-import-response.json'),
    readEvidenceJson(resolved.evidenceDir, 'story-agent-generated-health-audit.json'),
    readEvidenceJson(resolved.evidenceDir, 'story-agent-mvp-status-audit.json'),
    readEvidenceJson(resolved.evidenceDir, 'gears-large-project-response-audit.json'),
  ]);

  const verdict = verdictRead.data;
  const archive = archiveRead.data;
  const integrity = integrityRead.data;
  const workerTotals = asRecord(workerRead.data?.totals);
  const callbackTotals = asRecord(callbackRead.data?.totals);
  const systemExternalOutputSource = asRecord(systemExternalOutputSourceRead.data);
  const systemExternalPreflightRoot = asRecord(systemExternalPreflightRead.data);
  const systemExternalImportRoot = asRecord(systemExternalImportRead.data);
  const systemExternalPreflight = asApiData(systemExternalPreflightRead.data);
  const systemExternalImport = asApiData(systemExternalImportRead.data);
  const healthBeforeSummary = asRecord(asRecord(healthRead.data?.before).summary);
  const healthAfterSummary = asRecord(asRecord(healthRead.data?.after).summary);
  const healthDeltas = asRecord(healthRead.data?.deltas);
  const mvpBefore = asRecord(mvpRead.data?.before);
  const mvpAfter = asRecord(mvpRead.data?.after);
  const mvpDeltas = asRecord(mvpRead.data?.deltas);
  const pressureTotals = asRecord(pressureRead.data?.totals);
  const archiveTotals = asRecord(archive?.totals);
  const gateCounts = asRecord(verdict?.gate_counts);
  const requiredFiles = asStringArray(archive?.required_attachments);
  const missingRequiredFiles = asStringArray(archive?.missing_required_files);
  const acceptancePassed = asBool(verdict?.acceptance_passed);
  const signoffReady = asBool(archive?.signoff_ready);
  const integrityPassed = asBool(integrity?.integrity_passed);
  const healthAuditPassed = healthRead.data?.status === 'passed';
  const mvpStatusAuditPassed = mvpRead.data?.status === 'passed' || mvpRead.data?.status === 'warning';
  const systemExternalOutputUrlSourceReady = systemExternalOutputSourceRead.exists
    && systemExternalOutputSourceRead.parse_ok
    && asBool(systemExternalOutputSource.ready_for_external_import)
    && isPublicExternalArtifactUrl(systemExternalOutputSource.output_url)
    && (systemExternalOutputSource.source === 'env' || systemExternalOutputSource.source === 'worker_response')
    && systemExternalOutputSource.placeholder !== true;
  const systemExternalOutputUrlSource = typeof systemExternalOutputSource.source === 'string'
    ? systemExternalOutputSource.source
    : systemExternalOutputSourceRead.exists
      ? 'unknown'
      : 'missing';
  const systemExternalCallbackPassed = systemExternalPreflightRead.exists
    && systemExternalPreflightRead.parse_ok
    && systemExternalImportRead.exists
    && systemExternalImportRead.parse_ok
    && systemExternalOutputUrlSourceReady
    && (!('ok' in systemExternalPreflightRoot) || asBool(systemExternalPreflightRoot.ok))
    && (!('ok' in systemExternalImportRoot) || asBool(systemExternalImportRoot.ok))
    && systemExternalPreflight.schema_version === 'system-gears-external-callback-batch-import/v1'
    && systemExternalImport.schema_version === 'system-gears-external-callback-batch-import/v1'
    && systemExternalPreflight.mode === 'preflight'
    && systemExternalImport.mode === 'import'
    && systemExternalPreflight.blocked === false
    && systemExternalImport.blocked === false
    && asNumber(systemExternalPreflight.ready_to_import_count) > 0
    && asNumber(systemExternalImport.updated_count) > 0
    && asNumber(systemExternalPreflight.blocking_count) === 0
    && asNumber(systemExternalImport.blocking_count) === 0
    && asNumber(systemExternalImport.failed_count) === 0
    && asNumber(systemExternalPreflight.unresolved_count) === 0
    && asNumber(systemExternalImport.unresolved_count) === 0;
  const gates = asArray(verdict?.gates)
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      id: typeof item.id === 'string' ? item.id : 'unknown_gate',
      label: typeof item.label === 'string' ? item.label : undefined,
      status: typeof item.status === 'string' ? item.status : 'unknown',
      summary: typeof item.summary === 'string' ? item.summary : undefined,
    }));
  const recommendedActions = dedupeActions([
    ...evidenceActions(verdict?.recommended_actions),
    ...evidenceActions(archive?.recommended_actions),
    ...evidenceActions(integrity?.recommended_actions),
    ...[verdictRead, archiveRead, integrityRead, workerRead, callbackRead, systemExternalOutputSourceRead, systemExternalPreflightRead, systemExternalImportRead, healthRead, mvpRead, pressureRead]
      .filter(read => !read.exists || !read.parse_ok)
      .map(read => ({
        priority: 'P0',
        owner: 'Story Agent evidence signoff',
        action: `Attach or regenerate ${read.filename} before signing off GEARS worker evidence.`,
        evidence: read.parse_error ?? 'missing_or_invalid_json',
        sample_files: [read.filename],
      })),
  ]);
  const coreEvidenceAvailable = verdictRead.exists && archiveRead.exists && integrityRead.exists && healthRead.exists;
  const status: SignoffStatus = acceptancePassed && signoffReady && integrityPassed && healthAuditPassed && mvpStatusAuditPassed
    && systemExternalCallbackPassed
    ? 'ready'
    : coreEvidenceAvailable
      ? 'attention'
      : 'blocked';
  const report: Omit<GearsWorkerEvidenceSignoffReport, 'markdown'> = {
    schema_version: 'mcp-gears-worker-evidence-signoff/v1',
    provider: 'gears',
    status,
    evidence_dir: resolved.evidenceDir,
    evidence_dir_source: resolved.source,
    evidence_dir_allowed: true,
    acceptance_passed: acceptancePassed,
    signoff_ready: signoffReady,
    integrity_passed: integrityPassed,
    health_audit_passed: healthAuditPassed,
    mvp_status_audit_passed: mvpStatusAuditPassed,
    system_external_callback_passed: systemExternalCallbackPassed,
    system_external_callback_ready_to_import_count: asNumber(systemExternalPreflight.ready_to_import_count),
    system_external_callback_updated_count: asNumber(systemExternalImport.updated_count),
    system_external_callback_blocking_count: asNumber(systemExternalPreflight.blocking_count)
      + asNumber(systemExternalImport.blocking_count),
    system_external_callback_failed_count: asNumber(systemExternalImport.failed_count),
    system_external_callback_unresolved_count: asNumber(systemExternalPreflight.unresolved_count)
      + asNumber(systemExternalImport.unresolved_count),
    system_external_callback_project_count: Math.max(
      asNumber(systemExternalPreflight.project_count),
      asNumber(systemExternalImport.project_count),
    ),
    system_external_output_url_source_ready: systemExternalOutputUrlSourceReady,
    system_external_output_url_configured_from_env: asBool(systemExternalOutputSource.configured_from_env),
    system_external_output_url_source: systemExternalOutputUrlSource,
    pressure_submitted: asBool(verdict?.pressure_submitted) || asBool(pressureTotals.pressure_submitted),
    gate_counts: {
      passed: asNumber(gateCounts.passed),
      failed: asNumber(gateCounts.failed),
      skipped: asNumber(gateCounts.skipped),
      total: asNumber(gateCounts.total),
    },
    failed_gate_ids: asStringArray(verdict?.failed_gate_ids),
    skipped_gate_ids: asStringArray(verdict?.skipped_gate_ids),
    missing_required_attachment_count: asNumber(archiveTotals.missing_required_attachment_count),
    required_attachment_count: asNumber(archiveTotals.required_attachment_count),
    required_checksum_count: asNumber(archiveTotals.required_checksum_count),
    evidence_file_count: asNumber(archiveTotals.evidence_file_count),
    worker_record_count: asNumber(workerTotals.record_count),
    worker_transport_error_count: asNumber(workerTotals.transport_error_count),
    worker_http_error_count: asNumber(workerTotals.http_error_count),
    worker_unknown_count: asNumber(workerTotals.unknown_count),
    worker_missing_worker_id_count: asNumber(workerTotals.missing_worker_id_count),
    worker_missing_source_id_count: asNumber(workerTotals.missing_source_id_count),
    worker_missing_ready_artifact_count: asNumber(workerTotals.missing_ready_artifact_count),
    worker_failure_category_counts: asNumberRecord(workerTotals.failure_category_counts),
    callback_transport_error_count: asNumber(callbackTotals.transport_error_count),
    callback_http_error_count: asNumber(callbackTotals.http_error_count),
    callback_ledger_match_missing_count: asNumber(callbackTotals.ledger_match_missing_count),
    callback_failed_count: asNumber(callbackTotals.failed_count),
    health_ready_count_before: asNumber(healthBeforeSummary.ready_count),
    health_ready_count_after: asNumber(healthAfterSummary.ready_count),
    health_ready_count_delta: asNumber(healthDeltas.ready_count),
    health_interrupted_count_delta: asNumber(healthDeltas.interrupted_count),
    health_production_gap_count_delta: asNumber(healthDeltas.production_gap_count),
    mvp_status_before: typeof mvpBefore.status === 'string' ? mvpBefore.status as StoryAgentMvpStatus : undefined,
    mvp_status_after: typeof mvpAfter.status === 'string' ? mvpAfter.status as StoryAgentMvpStatus : undefined,
    mvp_score_before: asNumber(mvpBefore.score),
    mvp_score_after: asNumber(mvpAfter.score),
    mvp_score_delta: asNumber(mvpDeltas.score),
    large_project_request_unit_count: asNumber(pressureTotals.request_unit_count),
    large_project_response_record_count: asNumber(pressureTotals.response_record_count),
    large_project_accepted_count: asNumber(pressureTotals.accepted_count),
    large_project_rejected_count: asNumber(pressureTotals.rejected_count),
    large_project_failed_count: asNumber(pressureTotals.failed_count),
    large_project_source_echo_count: asNumber(pressureTotals.source_echo_count),
    large_project_missing_requested_source_count: asNumber(pressureTotals.missing_requested_source_count),
    large_project_duplicate_source_id_count: asNumber(pressureTotals.duplicate_source_id_count),
    large_project_unexpected_source_count: asNumber(pressureTotals.unexpected_source_count),
    required_files: requiredFiles,
    missing_required_files: missingRequiredFiles,
    gates,
    recommended_actions: recommendedActions,
    generated_at: generatedAt,
  };
  return input.include_markdown === false ? report : { ...report, markdown: renderMarkdown(report) };
}
