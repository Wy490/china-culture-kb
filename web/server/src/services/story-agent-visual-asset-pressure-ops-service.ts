import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { StoryAgentVisualAssetPressureOpsStatus } from '@shared/types.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';

const REPORT_RELATIVE_PATH = 'system/story-agent-visual-asset-pressure/report.json' as const;
const CANONICAL_MINIMUM_CASE_COUNT = 12;
const CANONICAL_MINIMUM_BATCH_COUNT = 3;
const CANONICAL_MINIMUM_COMPOSITION_FILE_COUNT = 16;
const CANONICAL_MINIMUM_SEALED_BATCH_COUNT = 1;
const REQUIRED_SCENARIOS = [
  'missing_file_rejected',
  'invalid_image_rejected',
  'content_sha256_mismatch_rejected',
  'partial_import_preserved',
  'failed_task_retry_recovered',
  'identity_replacement_staled',
] as const;

const CoverageSchema = z.object({
  case_count: z.number().int().nonnegative(),
  unique_source_id_count: z.number().int().nonnegative(),
  unique_style_family_count: z.number().int().nonnegative(),
  unique_character_label_count: z.number().int().nonnegative(),
  unique_location_label_count: z.number().int().nonnegative(),
  unique_content_sha256_count: z.number().int().nonnegative(),
  cross_case_content_reuse_count: z.number().int().nonnegative(),
  semantic_gate_passed_case_count: z.number().int().nonnegative(),
  source_content_sha256_verified_asset_count: z.number().int().nonnegative(),
  media_signature_verified_asset_count: z.number().int().nonnegative(),
  immutable_preview_verified_asset_count: z.number().int().nonnegative(),
  identity_mapping_current_asset_count: z.number().int().nonnegative(),
});

const ScenarioSummarySchema = z.object({
  required_count: z.number().int().nonnegative(),
  passed_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  not_run_count: z.number().int().nonnegative(),
});

const CompositionProvenanceSchema = z.object({
  status: z.enum(['verified', 'blocked', 'not_run']),
  report_relative_path: z.string().min(1).optional(),
  registry_content_sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  batch_count: z.number().int().nonnegative(),
  sealed_batch_count: z.number().int().nonnegative(),
  legacy_unsealed_batch_count: z.number().int().nonnegative(),
  file_count: z.number().int().nonnegative(),
  verified_file_count: z.number().int().nonnegative(),
  blockers: z.array(z.string()),
});

const DetailedReportSchema = z.object({
  schema_version: z.literal('story-agent-visual-asset-pressure-report/v1'),
  status: z.enum(['ready', 'blocked']),
  generated_at: z.string().datetime(),
  coverage: CoverageSchema,
  scenario_summary: ScenarioSummarySchema,
  composition_provenance: CompositionProvenanceSchema,
  scenario_results: z.array(z.object({
    scenario: z.enum(REQUIRED_SCENARIOS),
    status: z.enum(['passed', 'failed', 'not_run']),
    evidence_refs: z.array(z.string()),
  })),
  cases: z.array(z.object({
    case_id: z.string().min(1),
    asset_count: z.number().int().nonnegative(),
    semantic_gate_passed: z.boolean(),
    blockers: z.array(z.string()),
  })),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  machine_validation_only: z.literal(true),
  image_provider_invoked_by_server: z.literal(false),
  video_generation_performed: z.literal(false),
  production_credit_granted: z.literal(false),
});

const EMPTY_COVERAGE: StoryAgentVisualAssetPressureOpsStatus['coverage'] = {
  case_count: 0,
  unique_source_id_count: 0,
  unique_style_family_count: 0,
  unique_character_label_count: 0,
  unique_location_label_count: 0,
  unique_content_sha256_count: 0,
  cross_case_content_reuse_count: 0,
  semantic_gate_passed_case_count: 0,
  source_content_sha256_verified_asset_count: 0,
  media_signature_verified_asset_count: 0,
  immutable_preview_verified_asset_count: 0,
  identity_mapping_current_asset_count: 0,
};

const EMPTY_SCENARIOS: StoryAgentVisualAssetPressureOpsStatus['scenario_summary'] = {
  required_count: 6,
  passed_count: 0,
  failed_count: 0,
  not_run_count: 6,
};

function baseStatus(
  status: StoryAgentVisualAssetPressureOpsStatus['status'],
  fileExists: boolean,
  schemaValid: boolean,
  blockers: string[],
): StoryAgentVisualAssetPressureOpsStatus {
  return {
    schema_version: 'story-agent-visual-asset-pressure-ops-status/v1',
    inspected_at: new Date().toISOString(),
    status,
    report: {
      relative_path: REPORT_RELATIVE_PATH,
      file_exists: fileExists,
      schema_valid: schemaValid,
    },
    coverage: { ...EMPTY_COVERAGE },
    scenario_summary: { ...EMPTY_SCENARIOS },
    composition_provenance: {
      status: status === 'not_run' ? 'not_run' : 'blocked',
      batch_count: 0,
      sealed_batch_count: 0,
      legacy_unsealed_batch_count: 0,
      file_count: 0,
      verified_file_count: 0,
    },
    blockers,
    warnings: [],
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}

function reportIsInternallyReady(
  report: z.infer<typeof DetailedReportSchema>,
): boolean {
  const totalAssetCount = report.cases.reduce(
    (total, item) => total + item.asset_count,
    0,
  );
  const passedScenarios = new Set(
    report.scenario_results
      .filter(item => item.status === 'passed' && item.evidence_refs.length > 0)
      .map(item => item.scenario),
  );
  return report.status === 'ready'
    && report.blockers.length === 0
    && report.cases.length === report.coverage.case_count
    && report.cases.every(item => item.semantic_gate_passed && item.blockers.length === 0)
    && report.coverage.case_count >= CANONICAL_MINIMUM_CASE_COUNT
    && report.coverage.unique_source_id_count >= CANONICAL_MINIMUM_CASE_COUNT
    && report.coverage.unique_style_family_count >= CANONICAL_MINIMUM_CASE_COUNT
    && report.coverage.cross_case_content_reuse_count === 0
    && report.coverage.semantic_gate_passed_case_count === report.coverage.case_count
    && report.coverage.source_content_sha256_verified_asset_count === totalAssetCount
    && report.coverage.media_signature_verified_asset_count === totalAssetCount
    && report.coverage.immutable_preview_verified_asset_count === totalAssetCount
    && report.coverage.identity_mapping_current_asset_count === totalAssetCount
    && report.scenario_summary.required_count === REQUIRED_SCENARIOS.length
    && report.scenario_summary.passed_count === report.scenario_summary.required_count
    && report.scenario_summary.failed_count === 0
    && report.scenario_summary.not_run_count === 0
    && REQUIRED_SCENARIOS.every(scenario => passedScenarios.has(scenario))
    && report.composition_provenance.status === 'verified'
    && report.composition_provenance.batch_count >= CANONICAL_MINIMUM_BATCH_COUNT
    && report.composition_provenance.sealed_batch_count
      >= CANONICAL_MINIMUM_SEALED_BATCH_COUNT
    && report.composition_provenance.sealed_batch_count
      + report.composition_provenance.legacy_unsealed_batch_count
      === report.composition_provenance.batch_count
    && report.composition_provenance.file_count
      >= CANONICAL_MINIMUM_COMPOSITION_FILE_COUNT
    && report.composition_provenance.verified_file_count
      === report.composition_provenance.file_count
    && report.composition_provenance.blockers.length === 0;
}

export function storyAgentVisualAssetPressureReportPath(
  generatedRoot = storyGeneratedRoot(),
): string {
  return resolve(generatedRoot, REPORT_RELATIVE_PATH);
}

export async function getStoryAgentVisualAssetPressureOpsStatus(
  options: { generatedRoot?: string } = {},
): Promise<StoryAgentVisualAssetPressureOpsStatus> {
  const reportPath = storyAgentVisualAssetPressureReportPath(options.generatedRoot);
  let raw: string;
  try {
    raw = await readFile(reportPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return baseStatus(
      code === 'ENOENT' ? 'not_run' : 'blocked',
      code !== 'ENOENT',
      false,
      [code === 'ENOENT'
        ? 'visual_asset_pressure_report_missing'
        : 'visual_asset_pressure_report_unreadable'],
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return baseStatus('blocked', true, false, ['visual_asset_pressure_report_invalid']);
  }
  const validated = DetailedReportSchema.safeParse(parsed);
  if (!validated.success) {
    return baseStatus('blocked', true, false, ['visual_asset_pressure_report_invalid']);
  }

  const report = validated.data;
  const internallyReady = reportIsInternallyReady(report);
  return {
    schema_version: 'story-agent-visual-asset-pressure-ops-status/v1',
    inspected_at: new Date().toISOString(),
    status: internallyReady ? 'ready' : 'blocked',
    report: {
      relative_path: REPORT_RELATIVE_PATH,
      file_exists: true,
      schema_valid: true,
      generated_at: report.generated_at,
    },
    coverage: report.coverage,
    scenario_summary: report.scenario_summary,
    composition_provenance: {
      status: report.composition_provenance.status,
      batch_count: report.composition_provenance.batch_count,
      sealed_batch_count: report.composition_provenance.sealed_batch_count,
      legacy_unsealed_batch_count:
        report.composition_provenance.legacy_unsealed_batch_count,
      file_count: report.composition_provenance.file_count,
      verified_file_count: report.composition_provenance.verified_file_count,
    },
    blockers: [
      ...report.blockers,
      ...(!internallyReady && report.blockers.length === 0
        ? ['visual_asset_pressure_report_inconsistent']
        : []),
    ],
    warnings: report.warnings,
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}
