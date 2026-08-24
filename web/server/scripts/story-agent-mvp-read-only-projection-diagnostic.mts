import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  ProductionReadinessPortfolioPerformanceDiagnostics,
  StoryAgentMvpPerformanceDiagnostics,
  StoryAgentMvpStatusReport,
} from '../../shared/types.js';
import { storyGeneratedRoot, storyKbRoot } from '../src/platform/story-storage-root.js';
import { getStoryAgentMvpStatus } from '../src/services/story-agent-mvp-status-service.js';

const SERVER_ROOT = resolve(import.meta.dirname, '..');
const REPOSITORY_ROOT = resolve(SERVER_ROOT, '..', '..');
const REPORT_PATH = resolve(
  REPOSITORY_ROOT,
  'data/reports/story-agent-mvp-read-only-projection-diagnostic-v1.json',
);
const SOURCE_PATHS = [
  'web/shared/types.ts',
  'web/server/package.json',
  'web/server/src/services/generated-health-service.ts',
  'web/server/src/services/ai-comic-series-service.ts',
  'web/server/src/services/project-read-only-request-projection-service.ts',
  'web/server/src/services/project-service.ts',
  'web/server/src/services/project-external-evidence-sync-health-portfolio-service.ts',
  'web/server/src/services/production-readiness-portfolio-service.ts',
  'web/server/src/services/story-agent-mvp-status-service.ts',
  'web/server/scripts/story-agent-mvp-read-only-projection-diagnostic.mts',
] as const;

export interface StoryAgentMvpReadOnlyProjectionDiagnosticCheck {
  check_id: string;
  passed: boolean;
  observed: number | boolean | string;
  expected: number | boolean | string;
}

export interface StoryAgentMvpReadOnlyProjectionDiagnosticReport {
  schema_version: 'story-agent-mvp-read-only-projection-diagnostic/v1';
  captured_at: string;
  status: 'passed' | 'failed';
  wall_clock_ms: number;
  wall_clock_observation_not_sla: true;
  machine_read_only: boolean;
  project_store_modified: boolean;
  source_story_store_modified: boolean;
  province_markdown_modified: boolean;
  external_evidence_credit_granted: boolean;
  inventory: {
    story_project_count: number;
    series_project_count: number;
    sync_health_scanned_project_count: number;
  };
  projection: {
    list_repository_call_count: number;
    list_cache_hit_count: number;
    current_state_seeded_count: number;
    current_state_seed_rejected_count: number;
    current_state_repository_call_count: number;
    current_state_cache_hit_count: number;
    readable_project_count: number;
    failed_project_count: number;
  };
  component_observations_ms: StoryAgentMvpPerformanceDiagnostics;
  production_portfolio_observations: ProductionReadinessPortfolioPerformanceDiagnostics;
  store_fingerprint: {
    before_sha256: string;
    after_sha256: string;
    unchanged: boolean;
    roots: string[];
  };
  source_fingerprints: Record<string, string>;
  checks: StoryAgentMvpReadOnlyProjectionDiagnosticCheck[];
  boundaries: {
    request_scoped_projection: true;
    cross_request_cache_allowed: false;
    production_portfolio_projection_shared: false;
    production_portfolio_history_and_series_semantics_preserved: true;
    generated_health_full_version_scan_preserved: true;
    real_external_provider_invoked: false;
    human_review_credit_granted: false;
    production_credit_granted: false;
  };
  notes: string[];
  report_sha256: string;
}

export function buildStoryAgentMvpReadOnlyProjectionDiagnostic(input: {
  capturedAt: string;
  wallClockMs: number;
  mvpStatus: StoryAgentMvpStatusReport;
  storeFingerprintBefore: string;
  storeFingerprintAfter: string;
  sourceFingerprints: Record<string, string>;
  fingerprintRoots?: string[];
}): StoryAgentMvpReadOnlyProjectionDiagnosticReport {
  const performance = input.mvpStatus.performance;
  const projection = {
    list_repository_call_count: performance.project_projection_list_repository_call_count,
    list_cache_hit_count: performance.project_projection_list_cache_hit_count,
    current_state_seeded_count: performance.project_projection_current_state_seeded_count,
    current_state_seed_rejected_count: performance.project_projection_current_state_seed_rejected_count,
    current_state_repository_call_count: performance.project_projection_current_state_repository_call_count,
    current_state_cache_hit_count: performance.project_projection_current_state_cache_hit_count,
    readable_project_count: performance.project_projection_readable_project_count,
    failed_project_count: performance.project_projection_failed_project_count,
  };
  const resolvedProjectCount = projection.readable_project_count + projection.failed_project_count;
  const expectedResolvedProjectCount = projection.current_state_seeded_count
    + projection.current_state_repository_call_count;
  const expectedCacheHitCount = projection.current_state_seeded_count * 2
    + projection.current_state_repository_call_count;
  const syncHealth = input.mvpStatus.external_evidence_sync_health;
  const productionPortfolio = input.mvpStatus.production_portfolio;
  const portfolioPerformance = productionPortfolio.performance;
  const portfolioStoryErrorCount = productionPortfolio.errors.filter(
    item => item.scope === 'story_project',
  ).length;
  const portfolioSeriesErrorCount = productionPortfolio.errors.filter(
    item => item.scope === 'ai_comic_series',
  ).length;
  const storeUnchanged = input.storeFingerprintBefore === input.storeFingerprintAfter;
  const checks: StoryAgentMvpReadOnlyProjectionDiagnosticCheck[] = [
    check('project_store_fingerprint_unchanged', storeUnchanged, storeUnchanged, true),
    check(
      'list_repository_single_call',
      projection.list_repository_call_count === 1,
      projection.list_repository_call_count,
      1,
    ),
    check(
      'list_cache_reused_by_later_consumers',
      projection.list_cache_hit_count >= 2,
      projection.list_cache_hit_count,
      '>=2',
    ),
    check(
      'validated_current_state_seed_present',
      projection.current_state_seeded_count > 0,
      projection.current_state_seeded_count,
      '>0',
    ),
    check(
      'current_state_cache_reuse_equation',
      projection.current_state_cache_hit_count === expectedCacheHitCount,
      projection.current_state_cache_hit_count,
      expectedCacheHitCount,
    ),
    check(
      'current_state_resolution_equation',
      resolvedProjectCount === expectedResolvedProjectCount,
      resolvedProjectCount,
      expectedResolvedProjectCount,
    ),
    check(
      'sync_health_full_project_scan',
      syncHealth.summary.scanned_project_count === resolvedProjectCount,
      syncHealth.summary.scanned_project_count,
      resolvedProjectCount,
    ),
    check(
      'sync_health_machine_read_only',
      syncHealth.machine_read_only
        && !syncHealth.project_store_modified
        && !syncHealth.source_story_store_modified,
      syncHealth.machine_read_only
        && !syncHealth.project_store_modified
        && !syncHealth.source_story_store_modified,
      true,
    ),
    check(
      'external_evidence_credit_not_granted',
      !syncHealth.external_evidence_credit_granted,
      syncHealth.external_evidence_credit_granted,
      false,
    ),
    check(
      'production_portfolio_observed_independently',
      Number.isFinite(performance.production_portfolio_ms),
      performance.production_portfolio_ms,
      'finite milliseconds',
    ),
    check(
      'production_portfolio_story_target_accounting',
      portfolioPerformance.story_project_target_count
        === productionPortfolio.summary.story_project_count + portfolioStoryErrorCount,
      portfolioPerformance.story_project_target_count,
      productionPortfolio.summary.story_project_count + portfolioStoryErrorCount,
    ),
    check(
      'production_portfolio_series_target_accounting',
      portfolioPerformance.ai_comic_series_target_count
        === productionPortfolio.summary.ai_comic_series_count + portfolioSeriesErrorCount,
      portfolioPerformance.ai_comic_series_target_count,
      productionPortfolio.summary.ai_comic_series_count + portfolioSeriesErrorCount,
    ),
    check(
      'production_portfolio_bounded_concurrency_observed',
      portfolioPerformance.configured_read_concurrency === 8,
      portfolioPerformance.configured_read_concurrency,
      8,
    ),
    check(
      'production_portfolio_phase_observations_valid',
      portfolioPerformance.wall_clock_observation_not_sla
        && portfolioPerformance.target_discovery_ms >= 0
        && portfolioPerformance.readiness_scan_ms >= 0
        && portfolioPerformance.summary_assembly_ms >= 0
        && portfolioPerformance.markdown_render_ms >= 0
        && portfolioPerformance.total_ms >= portfolioPerformance.readiness_scan_ms
        && portfolioPerformance.story_project_cumulative_readiness_work_ms >= 0
        && portfolioPerformance.ai_comic_series_cumulative_readiness_work_ms >= 0,
      portfolioPerformance.wall_clock_observation_not_sla,
      true,
    ),
  ];
  const machineReadOnly = Boolean(syncHealth.machine_read_only && storeUnchanged);
  const base = {
    schema_version: 'story-agent-mvp-read-only-projection-diagnostic/v1' as const,
    captured_at: input.capturedAt,
    status: checks.every(item => item.passed) ? 'passed' as const : 'failed' as const,
    wall_clock_ms: input.wallClockMs,
    wall_clock_observation_not_sla: true as const,
    machine_read_only: machineReadOnly,
    project_store_modified: !storeUnchanged || syncHealth.project_store_modified,
    source_story_store_modified: !storeUnchanged || syncHealth.source_story_store_modified,
    province_markdown_modified: !storeUnchanged,
    external_evidence_credit_granted: syncHealth.external_evidence_credit_granted,
    inventory: {
      story_project_count: input.mvpStatus.generated_health.summary.scanned_story_project_count,
      series_project_count: input.mvpStatus.generated_health.summary.scanned_series_project_count,
      sync_health_scanned_project_count: syncHealth.summary.scanned_project_count,
    },
    projection,
    component_observations_ms: performance,
    production_portfolio_observations: portfolioPerformance,
    store_fingerprint: {
      before_sha256: input.storeFingerprintBefore,
      after_sha256: input.storeFingerprintAfter,
      unchanged: storeUnchanged,
      roots: input.fingerprintRoots ?? [],
    },
    source_fingerprints: sortRecord(input.sourceFingerprints),
    checks,
    boundaries: {
      request_scoped_projection: true as const,
      cross_request_cache_allowed: false as const,
      production_portfolio_projection_shared: false as const,
      production_portfolio_history_and_series_semantics_preserved: true as const,
      generated_health_full_version_scan_preserved: true as const,
      real_external_provider_invoked: false as const,
      human_review_credit_granted: false as const,
      production_credit_granted: false as const,
    },
    notes: [
      'Wall-clock values are one local observation and are not an SLA, regression verdict, or speedup claim.',
      'Deterministic completion is based on repository-call equations, full sync-health coverage, source hashes, and before/after store fingerprints.',
      'Production portfolio remains an independent historical/series scan and is not forced into the current-state projection.',
      'Portfolio scope work is cumulative across concurrent workers and can exceed readiness scan wall clock.',
      'No external provider, human review, production traffic, or province Markdown writeback is performed.',
    ],
  };
  return {
    ...base,
    report_sha256: sha256Json(base),
  };
}

export function validateStoryAgentMvpReadOnlyProjectionDiagnosticReport(
  report: StoryAgentMvpReadOnlyProjectionDiagnosticReport,
  current: {
    sourceFingerprints: Record<string, string>;
    storeFingerprint: string;
  },
): string[] {
  const { report_sha256: reportSha256, ...payload } = report;
  const projection = report.projection;
  const portfolioPerformance = report.production_portfolio_observations;
  const expectedCacheHitCount = projection.current_state_seeded_count * 2
    + projection.current_state_repository_call_count;
  const resolvedProjectCount = projection.readable_project_count + projection.failed_project_count;
  const expectedResolvedProjectCount = projection.current_state_seeded_count
    + projection.current_state_repository_call_count;
  const failures: string[] = [];
  if (report.schema_version !== 'story-agent-mvp-read-only-projection-diagnostic/v1') {
    failures.push('schema_version_mismatch');
  }
  if (reportSha256 !== sha256Json(payload)) failures.push('report_sha256_mismatch');
  if (report.status !== 'passed' || report.checks.some(item => !item.passed)) {
    failures.push('diagnostic_checks_not_passed');
  }
  if (projection.list_repository_call_count !== 1) failures.push('list_repository_call_count_mismatch');
  if (projection.list_cache_hit_count < 2) failures.push('list_cache_hit_count_too_low');
  if (projection.current_state_seeded_count <= 0) failures.push('current_state_seed_missing');
  if (projection.current_state_cache_hit_count !== expectedCacheHitCount) {
    failures.push('current_state_cache_reuse_equation_mismatch');
  }
  if (resolvedProjectCount !== expectedResolvedProjectCount) {
    failures.push('current_state_resolution_equation_mismatch');
  }
  if (report.inventory.sync_health_scanned_project_count !== resolvedProjectCount) {
    failures.push('sync_health_project_scan_mismatch');
  }
  if (
    !portfolioPerformance.wall_clock_observation_not_sla
    || portfolioPerformance.configured_read_concurrency !== 8
    || portfolioPerformance.target_discovery_ms < 0
    || portfolioPerformance.readiness_scan_ms < 0
    || portfolioPerformance.summary_assembly_ms < 0
    || portfolioPerformance.markdown_render_ms < 0
    || portfolioPerformance.total_ms < portfolioPerformance.readiness_scan_ms
    || portfolioPerformance.story_project_cumulative_readiness_work_ms < 0
    || portfolioPerformance.ai_comic_series_cumulative_readiness_work_ms < 0
  ) {
    failures.push('production_portfolio_observation_mismatch');
  }
  if (
    !report.store_fingerprint.unchanged
    || report.store_fingerprint.before_sha256 !== report.store_fingerprint.after_sha256
    || current.storeFingerprint !== report.store_fingerprint.after_sha256
  ) {
    failures.push('store_fingerprint_mismatch');
  }
  if (JSON.stringify(sortRecord(current.sourceFingerprints)) !== JSON.stringify(report.source_fingerprints)) {
    failures.push('source_fingerprint_mismatch');
  }
  if (
    !report.machine_read_only
    || report.project_store_modified
    || report.source_story_store_modified
    || report.province_markdown_modified
    || report.external_evidence_credit_granted
  ) {
    failures.push('read_only_boundary_mismatch');
  }
  if (
    !report.boundaries.request_scoped_projection
    || report.boundaries.cross_request_cache_allowed
    || report.boundaries.production_portfolio_projection_shared
    || !report.boundaries.production_portfolio_history_and_series_semantics_preserved
    || !report.boundaries.generated_health_full_version_scan_preserved
    || report.boundaries.real_external_provider_invoked
    || report.boundaries.human_review_credit_granted
    || report.boundaries.production_credit_granted
  ) {
    failures.push('architecture_boundary_mismatch');
  }
  return failures;
}

function check(
  checkId: string,
  passed: boolean,
  observed: number | boolean | string,
  expected: number | boolean | string,
): StoryAgentMvpReadOnlyProjectionDiagnosticCheck {
  return { check_id: checkId, passed, observed, expected };
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Json(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function sortRecord(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

async function sourceFingerprints(): Promise<Record<string, string>> {
  return sortRecord(Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async sourcePath => [
    sourcePath,
    sha256(await readFile(resolve(REPOSITORY_ROOT, sourcePath))),
  ]))));
}

async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const target = resolve(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(target);
      else if (entry.isFile() && !entry.isSymbolicLink()) files.push(target);
    }
  };
  await visit(root);
  return files;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

async function storeFingerprint(roots: string[]): Promise<string> {
  const records: string[] = [];
  for (const root of roots) {
    const files = await collectFiles(root);
    const digests = await mapWithConcurrency(files, 16, async filePath => (
      `${relative(REPOSITORY_ROOT, filePath)}\0${sha256(await readFile(filePath))}`
    ));
    records.push(`${relative(REPOSITORY_ROOT, root)}\0${files.length}`);
    records.push(...digests);
  }
  return sha256(records.join('\n'));
}

function fingerprintRoots(): string[] {
  const generatedRoot = storyGeneratedRoot();
  const kbRoot = storyKbRoot();
  return [
    resolve(generatedRoot, 'projects'),
    resolve(generatedRoot, 'ai-comic-series-projects'),
    resolve(generatedRoot, 'stories'),
    resolve(kbRoot, 'provinces'),
  ];
}

async function runDiagnostic(): Promise<StoryAgentMvpReadOnlyProjectionDiagnosticReport> {
  const roots = fingerprintRoots();
  const before = await storeFingerprint(roots);
  const startedAt = Date.now();
  const mvpStatus = await getStoryAgentMvpStatus({
    generatedLimit: 200,
    portfolioLimit: 100,
    syncHealthLimit: 100,
  });
  const wallClockMs = Date.now() - startedAt;
  const after = await storeFingerprint(roots);
  return buildStoryAgentMvpReadOnlyProjectionDiagnostic({
    capturedAt: new Date().toISOString(),
    wallClockMs,
    mvpStatus,
    storeFingerprintBefore: before,
    storeFingerprintAfter: after,
    sourceFingerprints: await sourceFingerprints(),
    fingerprintRoots: roots.map(root => relative(REPOSITORY_ROOT, root)),
  });
}

async function verifyStoredReport(): Promise<void> {
  const parsed = JSON.parse(await readFile(REPORT_PATH, 'utf8')) as StoryAgentMvpReadOnlyProjectionDiagnosticReport;
  const currentSources = await sourceFingerprints();
  const roots = fingerprintRoots();
  const currentStoreFingerprint = await storeFingerprint(roots);
  const failures = validateStoryAgentMvpReadOnlyProjectionDiagnosticReport(parsed, {
    sourceFingerprints: currentSources,
    storeFingerprint: currentStoreFingerprint,
  });
  if (failures.length) throw new Error(`Diagnostic verification failed: ${failures.join(', ')}`);
  process.stdout.write(JSON.stringify({
    status: 'passed',
    report_path: relative(REPOSITORY_ROOT, REPORT_PATH),
    report_sha256: parsed.report_sha256,
    store_fingerprint_sha256: currentStoreFingerprint,
  }, null, 2) + '\n');
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const checkOnly = process.argv.includes('--check');
  if (write === checkOnly) throw new Error('Pass exactly one of --write or --check');
  if (checkOnly) {
    await verifyStoredReport();
    return;
  }
  const report = await runDiagnostic();
  if (write) await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({
    status: report.status,
    report_path: write ? relative(REPOSITORY_ROOT, REPORT_PATH) : null,
    report_sha256: report.report_sha256,
    wall_clock_ms: report.wall_clock_ms,
    projection: report.projection,
    component_observations_ms: report.component_observations_ms,
    production_portfolio_observations: report.production_portfolio_observations,
  }, null, 2) + '\n');
  if (report.status !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
