import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileArtifactStore } from '../src/repositories/artifact-store.js';
import { storyGeneratedRoot } from '../src/platform/story-storage-root.js';
import {
  importStoryAgent15TypeCompositeBoards,
  type StoryAgent15TypePreproductionMatrixReport,
} from '../src/services/story-agent-15-type-matrix-service.js';

const REPORT_DIRECTORY = 'story-agent-15-type-preproduction-matrix';
const MATRIX_FILENAME = 'matrix-report.json';
const IMPORT_FILENAME = 'image-import-report.json';
const OUTPUT_PATH = 'outputs/visual-board.png';

const originalKbRoot = process.env.KB_ROOT;
const repositoryDataRoot = resolve(import.meta.dirname, '..', '..', '..', 'data');
process.env.KB_ROOT = repositoryDataRoot;
const generatedRoot = storyGeneratedRoot();
const reportDirectory = resolve(generatedRoot, REPORT_DIRECTORY);
const matrixPath = resolve(reportDirectory, MATRIX_FILENAME);

let exitCode = 0;
try {
  const matrix = JSON.parse(await readFile(matrixPath, 'utf8')) as
    StoryAgent15TypePreproductionMatrixReport;
  if (matrix.schema_version !== 'story-agent-15-type-preproduction-matrix/v1') {
    throw new Error(`Unsupported matrix report at "${matrixPath}"`);
  }
  const result = await importStoryAgent15TypeCompositeBoards({
    matrix,
    executions: matrix.items.map(item => ({
      run_id: item.image_run_id,
      output_path: OUTPUT_PATH,
    })),
  });
  if (!result.ok || !result.data) {
    throw new Error(
      result.error?.message
        ?? result.error?.code
        ?? '15-type composite board import failed',
    );
  }
  const store = new FileArtifactStore(reportDirectory);
  await Promise.all([
    store.writeText(
      MATRIX_FILENAME,
      `${JSON.stringify(result.data.matrix, null, 2)}\n`,
      { overwrite: 'replace' },
    ),
    store.writeText(
      IMPORT_FILENAME,
      `${JSON.stringify(result.data, null, 2)}\n`,
      { overwrite: 'replace' },
    ),
  ]);
  console.log(JSON.stringify({
    ...result.data,
    matrix_report_path: matrixPath,
    import_report_path: resolve(reportDirectory, IMPORT_FILENAME),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    schema_version: 'story-agent-15-type-composite-board-import/v1',
    status: 'blocked',
    matrix_report_path: matrixPath,
    reason: error instanceof Error ? error.message : String(error),
  }, null, 2));
  exitCode = 1;
} finally {
  if (originalKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = originalKbRoot;
}

process.exitCode = exitCode;
