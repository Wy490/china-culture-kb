import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileArtifactStore } from '../src/repositories/artifact-store.js';
import { storyGeneratedRoot } from '../src/platform/story-storage-root.js';
import {
  prepareStoryAgent15TypePreproductionMatrix,
  type StoryAgent15TypePreproductionMatrixReport,
} from '../src/services/story-agent-15-type-matrix-service.js';

const REPORT_DIRECTORY = 'story-agent-15-type-preproduction-matrix';
const REPORT_FILENAME = 'matrix-report.json';

async function readPreviousReport(
  absolutePath: string,
): Promise<StoryAgent15TypePreproductionMatrixReport | undefined> {
  try {
    const parsed = JSON.parse(await readFile(absolutePath, 'utf8')) as
      StoryAgent15TypePreproductionMatrixReport;
    return parsed.schema_version === 'story-agent-15-type-preproduction-matrix/v1'
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

const originalKbRoot = process.env.KB_ROOT;
const repositoryDataRoot = resolve(import.meta.dirname, '..', '..', '..', 'data');
process.env.KB_ROOT = repositoryDataRoot;
const generatedRoot = storyGeneratedRoot();
const reportDirectory = resolve(generatedRoot, REPORT_DIRECTORY);
const reportPath = resolve(reportDirectory, REPORT_FILENAME);
const originalLocalOnly = process.env.STORY_GEN_LOCAL_ONLY;
process.env.STORY_GEN_LOCAL_ONLY = '1';

let exitCode = 0;
try {
  const previousReport = await readPreviousReport(reportPath);
  const result = await prepareStoryAgent15TypePreproductionMatrix({
    previous_report: previousReport,
  });
  if (!result.ok || !result.data) {
    throw new Error(
      result.error?.message
        ?? result.error?.code
        ?? '15-type preproduction matrix preparation failed',
    );
  }
  const report = result.data;
  const store = new FileArtifactStore(reportDirectory);
  await store.writeText(REPORT_FILENAME, `${JSON.stringify(report, null, 2)}\n`, {
    overwrite: 'replace',
  });
  console.log(JSON.stringify({
    ...report,
    report_path: reportPath,
  }, null, 2));
  if (report.status === 'blocked') exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    schema_version: 'story-agent-15-type-preproduction-matrix/v1',
    status: 'blocked',
    mode: 'canonical_local_matrix',
    report_path: reportPath,
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
