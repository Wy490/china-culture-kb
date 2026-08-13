import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileArtifactStore } from '../src/repositories/artifact-store.js';
import { storyGeneratedRoot } from '../src/platform/story-storage-root.js';
import {
  prepareStoryAgent15x3StabilityMatrix,
  type StoryAgent15x3StabilityMatrixReport,
} from '../src/services/story-agent-15x3-stability-service.js';
import type {
  StoryAgent15TypePreproductionMatrixReport,
} from '../src/services/story-agent-15-type-matrix-service.js';

const REPORT_DIRECTORY = 'story-agent-15x3-stability-matrix';
const MATRIX_FILENAME = 'matrix-report.json';
const CANONICAL_REPORT_DIRECTORY = 'story-agent-15-type-preproduction-matrix';
const CANONICAL_MATRIX_FILENAME = 'matrix-report.json';
const M4_BASELINE_FILENAME = 'story-agent-writing-capability-m4-15x3-machine-evaluation.json';

async function readReport<T extends { schema_version: string }>(
  absolutePath: string,
  schemaVersion: T['schema_version'],
): Promise<T | undefined> {
  try {
    const parsed = JSON.parse(await readFile(absolutePath, 'utf8')) as T;
    return parsed.schema_version === schemaVersion ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const originalKbRoot = process.env.KB_ROOT;
const originalLocalOnly = process.env.STORY_GEN_LOCAL_ONLY;
const repositoryDataRoot = resolve(import.meta.dirname, '..', '..', '..', 'data');
const repositoryReportRoot = resolve(repositoryDataRoot, 'reports');
process.env.KB_ROOT = repositoryDataRoot;
process.env.STORY_GEN_LOCAL_ONLY = '1';

const generatedRoot = storyGeneratedRoot();
const reportDirectory = resolve(generatedRoot, REPORT_DIRECTORY);
const matrixPath = resolve(reportDirectory, MATRIX_FILENAME);
const canonicalMatrixPath = resolve(
  generatedRoot,
  CANONICAL_REPORT_DIRECTORY,
  CANONICAL_MATRIX_FILENAME,
);

let exitCode = 0;
try {
  const [previousReport, canonicalReport] = await Promise.all([
    readReport<StoryAgent15x3StabilityMatrixReport>(
      matrixPath,
      'story-agent-15x3-stability-matrix/v1',
    ),
    readReport<StoryAgent15TypePreproductionMatrixReport>(
      canonicalMatrixPath,
      'story-agent-15-type-preproduction-matrix/v1',
    ),
  ]);
  if (!canonicalReport) {
    throw new Error(
      `Run the 15-type canonical matrix first; missing valid report at "${canonicalMatrixPath}"`,
    );
  }
  const result = await prepareStoryAgent15x3StabilityMatrix({
    previous_report: previousReport,
    canonical_report: canonicalReport,
  });
  if (!result.ok || !result.data) {
    throw new Error(
      result.error?.message
        ?? result.error?.code
        ?? '15x3 stability matrix preparation failed',
    );
  }
  const report = result.data;
  const store = new FileArtifactStore(reportDirectory);
  await store.writeText(
    MATRIX_FILENAME,
    `${JSON.stringify(report, null, 2)}\n`,
    { overwrite: 'replace' },
  );
  const baselineStore = new FileArtifactStore(repositoryReportRoot);
  const baseline = {
    schema_version: 'story-agent-writing-capability-m4-machine-evaluation-baseline/v1',
    generated_at: report.generated_at,
    status: report.machine_evaluation.status,
    source: {
      schema_version: report.schema_version,
      mode: report.mode,
      artifact_path: `web/generated/${REPORT_DIRECTORY}/${MATRIX_FILENAME}`,
      canonical_artifact_path: `web/generated/${CANONICAL_REPORT_DIRECTORY}/${CANONICAL_MATRIX_FILENAME}`,
    },
    boundary: {
      machine_validation_only: true,
      human_review_complete: false,
      professional_credit_granted: false,
      external_model_path_covered: false,
      image_and_preproduction_status_is_not_story_quality_credit: true,
      legacy_quality_passed_includes_production_material: true,
      story_quality_passed_excludes_production_material_assets_and_external_providers: true,
      production_material_ready_excludes_assets_and_external_providers: true,
    },
    matrix_delivery_status: report.status,
    matrix_delivery_coverage: report.coverage,
    machine_evaluation: report.machine_evaluation,
    cases: report.items.map(item => ({
      case_id: item.case_id,
      video_type: item.video_type,
      variant_id: item.variant_id,
      input_profile: item.input_profile,
      evaluation: item.matrix_item.machine_evaluation,
    })),
  } as const;
  const baselinePath = resolve(repositoryReportRoot, M4_BASELINE_FILENAME);
  await baselineStore.writeText(
    M4_BASELINE_FILENAME,
    `${JSON.stringify(baseline, null, 2)}\n`,
    { overwrite: 'replace' },
  );
  console.log(JSON.stringify({
    ...report,
    report_path: matrixPath,
    canonical_report_path: canonicalMatrixPath,
    m4_baseline_path: baselinePath,
  }, null, 2));
  if (report.status === 'blocked') exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    schema_version: 'story-agent-15x3-stability-matrix/v1',
    status: 'blocked',
    mode: 'canonical_local_15x3',
    report_path: matrixPath,
    reason: error instanceof Error ? error.message : String(error),
  }, null, 2));
  exitCode = 1;
} finally {
  if (originalKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = originalKbRoot;
  if (originalLocalOnly === undefined) delete process.env.STORY_GEN_LOCAL_ONLY;
  else process.env.STORY_GEN_LOCAL_ONLY = originalLocalOnly;
}

process.exitCode = exitCode;
