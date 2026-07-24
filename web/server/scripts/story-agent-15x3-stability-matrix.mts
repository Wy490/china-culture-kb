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
  console.log(JSON.stringify({
    ...report,
    report_path: matrixPath,
    canonical_report_path: canonicalMatrixPath,
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
