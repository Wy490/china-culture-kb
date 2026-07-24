import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileArtifactStore } from '../src/repositories/artifact-store.js';
import { storyGeneratedRoot } from '../src/platform/story-storage-root.js';
import {
  importStoryAgent15x3CompositeBoards,
  type StoryAgent15x3CompositeBoardImportReport,
  type StoryAgent15x3StabilityMatrixReport,
} from '../src/services/story-agent-15x3-stability-service.js';
import type {
  StoryAgent15TypeCompositeBoardExecution,
  StoryAgent15TypePreproductionMatrixReport,
} from '../src/services/story-agent-15-type-matrix-service.js';

const REPORT_DIRECTORY = 'story-agent-15x3-stability-matrix';
const MATRIX_FILENAME = 'matrix-report.json';
const IMPORT_FILENAME = 'image-import-report.json';
const RECOVERY_FILENAME = 'image-recovery-report.json';
const IDEMPOTENCY_FILENAME = 'image-idempotency-report.json';
const CANONICAL_REPORT_DIRECTORY = 'story-agent-15-type-preproduction-matrix';
const OUTPUT_PATH = 'outputs/visual-board.png';

interface ImageRequestManifest {
  tasks: Array<{ task_id: string }>;
}

interface StoryAgent15x3ImageRecoveryReport {
  schema_version: 'story-agent-15x3-image-recovery/v1';
  status: 'ready' | 'blocked';
  generated_at: string;
  source: {
    strategy: 'reuse_verified_canonical_visual_board';
    canonical_case_count: number;
    unique_source_board_count: number;
    reused_variant_case_count: number;
    copied_board_count: number;
    newly_generated_board_count: 0;
    server_image_provider_invoked: false;
  };
  partial_recovery: {
    performed: boolean;
    run_id: string | null;
    task_id: string | null;
    status_after_partial: StoryAgent15x3StabilityMatrixReport['status'] | null;
    verified_task_count: number;
    pending_task_count_after_partial: number | null;
  };
  completion: {
    execution_count: number;
    processed_task_count: number;
    verified_task_count: number;
    skipped_idempotent_task_count: number;
    matrix_status: StoryAgent15x3StabilityMatrixReport['status'];
    preproduction_ready_count: number;
  };
  idempotency: {
    processed_task_count: number;
    skipped_idempotent_task_count: number;
    all_tasks_skipped: boolean;
    stable_project_ids: boolean;
    stable_image_run_ids: boolean;
  };
}

async function readJson<T>(absolutePath: string): Promise<T> {
  return JSON.parse(await readFile(absolutePath, 'utf8')) as T;
}

const originalKbRoot = process.env.KB_ROOT;
const repositoryDataRoot = resolve(import.meta.dirname, '..', '..', '..', 'data');
process.env.KB_ROOT = repositoryDataRoot;

const generatedRoot = storyGeneratedRoot();
const reportDirectory = resolve(generatedRoot, REPORT_DIRECTORY);
const matrixPath = resolve(reportDirectory, MATRIX_FILENAME);
const canonicalMatrixPath = resolve(
  generatedRoot,
  CANONICAL_REPORT_DIRECTORY,
  MATRIX_FILENAME,
);

let exitCode = 0;
try {
  const [matrix, canonicalMatrix] = await Promise.all([
    readJson<StoryAgent15x3StabilityMatrixReport>(matrixPath),
    readJson<StoryAgent15TypePreproductionMatrixReport>(canonicalMatrixPath),
  ]);
  if (matrix.schema_version !== 'story-agent-15x3-stability-matrix/v1') {
    throw new Error(`Unsupported 15x3 matrix report at "${matrixPath}"`);
  }
  if (
    canonicalMatrix.schema_version
    !== 'story-agent-15-type-preproduction-matrix/v1'
  ) {
    throw new Error(
      `Unsupported canonical matrix report at "${canonicalMatrixPath}"`,
    );
  }

  const canonicalByType = new Map(
    canonicalMatrix.items.map(item => [item.video_type, item]),
  );
  let copiedBoardCount = 0;
  const executions: StoryAgent15TypeCompositeBoardExecution[] = [];
  for (const item of matrix.items) {
    const canonical = canonicalByType.get(item.video_type);
    if (!canonical) {
      throw new Error(`Missing canonical board for "${item.video_type}"`);
    }
    const sourcePath = resolve(canonical.image_run_directory, OUTPUT_PATH);
    const destinationPath = resolve(
      item.matrix_item.image_run_directory,
      OUTPUT_PATH,
    );
    if (sourcePath !== destinationPath) {
      await mkdir(resolve(item.matrix_item.image_run_directory, 'outputs'), {
        recursive: true,
      });
      await copyFile(sourcePath, destinationPath);
      copiedBoardCount += 1;
    }
    executions.push({
      run_id: item.matrix_item.image_run_id,
      output_path: OUTPUT_PATH,
    });
  }

  let activeMatrix = matrix;
  const pendingItem = activeMatrix.items.find(
    item => item.matrix_item.pending_image_task_count > 0,
  );
  let partialReport: StoryAgent15x3CompositeBoardImportReport | undefined;
  let partialTaskId: string | null = null;
  if (pendingItem) {
    const manifest = await readJson<ImageRequestManifest>(
      pendingItem.matrix_item.image_request_path,
    );
    partialTaskId = manifest.tasks[0]?.task_id ?? null;
    if (!partialTaskId) {
      throw new Error(
        `Missing image task in "${pendingItem.matrix_item.image_request_path}"`,
      );
    }
    const partial = await importStoryAgent15x3CompositeBoards({
      matrix: activeMatrix,
      executions: [{
        run_id: pendingItem.matrix_item.image_run_id,
        output_path: OUTPUT_PATH,
        task_ids: [partialTaskId],
      }],
    });
    if (!partial.ok || !partial.data) {
      throw new Error(
        partial.error?.message
          ?? partial.error?.code
          ?? '15x3 partial image recovery failed',
      );
    }
    partialReport = partial.data;
    activeMatrix = partial.data.matrix;
  }

  const completed = await importStoryAgent15x3CompositeBoards({
    matrix: activeMatrix,
    executions,
  });
  if (!completed.ok || !completed.data) {
    throw new Error(
      completed.error?.message
        ?? completed.error?.code
        ?? '15x3 image completion failed',
    );
  }
  const repeated = await importStoryAgent15x3CompositeBoards({
    matrix: completed.data.matrix,
    executions,
  });
  if (!repeated.ok || !repeated.data) {
    throw new Error(
      repeated.error?.message
        ?? repeated.error?.code
        ?? '15x3 image idempotency check failed',
    );
  }

  const beforeProjectIds = matrix.items.map(item => item.matrix_item.project_id);
  const afterProjectIds = repeated.data.matrix.items.map(
    item => item.matrix_item.project_id,
  );
  const beforeRunIds = matrix.items.map(item => item.matrix_item.image_run_id);
  const afterRunIds = repeated.data.matrix.items.map(
    item => item.matrix_item.image_run_id,
  );
  const recoveryReport: StoryAgent15x3ImageRecoveryReport = {
    schema_version: 'story-agent-15x3-image-recovery/v1',
    status: completed.data.status === 'ready'
      && repeated.data.status === 'ready'
      && repeated.data.skipped_idempotent_task_count
        === repeated.data.processed_task_count
      ? 'ready'
      : 'blocked',
    generated_at: new Date().toISOString(),
    source: {
      strategy: 'reuse_verified_canonical_visual_board',
      canonical_case_count: canonicalMatrix.items.length,
      unique_source_board_count: new Set(
        canonicalMatrix.items.map(item => item.image_run_id),
      ).size,
      reused_variant_case_count: matrix.items.filter(
        item => item.variant_id !== 'canonical_1m',
      ).length,
      copied_board_count: copiedBoardCount,
      newly_generated_board_count: 0,
      server_image_provider_invoked: false,
    },
    partial_recovery: {
      performed: Boolean(partialReport),
      run_id: pendingItem?.matrix_item.image_run_id ?? null,
      task_id: partialTaskId,
      status_after_partial: partialReport?.status ?? null,
      verified_task_count: partialReport?.verified_task_count ?? 0,
      pending_task_count_after_partial: pendingItem && partialReport
        ? partialReport.matrix.items.find(
          item => item.case_id === pendingItem.case_id,
        )?.matrix_item.pending_image_task_count ?? null
        : null,
    },
    completion: {
      execution_count: completed.data.execution_count,
      processed_task_count: completed.data.processed_task_count,
      verified_task_count: completed.data.verified_task_count,
      skipped_idempotent_task_count:
        completed.data.skipped_idempotent_task_count,
      matrix_status: completed.data.status,
      preproduction_ready_count:
        completed.data.matrix.coverage.preproduction_ready_count,
    },
    idempotency: {
      processed_task_count: repeated.data.processed_task_count,
      skipped_idempotent_task_count:
        repeated.data.skipped_idempotent_task_count,
      all_tasks_skipped: repeated.data.skipped_idempotent_task_count
        === repeated.data.processed_task_count,
      stable_project_ids: JSON.stringify(beforeProjectIds)
        === JSON.stringify(afterProjectIds),
      stable_image_run_ids: JSON.stringify(beforeRunIds)
        === JSON.stringify(afterRunIds),
    },
  };

  const store = new FileArtifactStore(reportDirectory);
  await Promise.all([
    store.writeText(
      MATRIX_FILENAME,
      `${JSON.stringify(repeated.data.matrix, null, 2)}\n`,
      { overwrite: 'replace' },
    ),
    store.writeText(
      IMPORT_FILENAME,
      `${JSON.stringify(completed.data, null, 2)}\n`,
      { overwrite: 'replace' },
    ),
    store.writeText(
      IDEMPOTENCY_FILENAME,
      `${JSON.stringify(repeated.data, null, 2)}\n`,
      { overwrite: 'replace' },
    ),
    store.writeText(
      RECOVERY_FILENAME,
      `${JSON.stringify(recoveryReport, null, 2)}\n`,
      { overwrite: 'replace' },
    ),
  ]);
  console.log(JSON.stringify({
    ...recoveryReport,
    matrix_report_path: matrixPath,
    import_report_path: resolve(reportDirectory, IMPORT_FILENAME),
    recovery_report_path: resolve(reportDirectory, RECOVERY_FILENAME),
    idempotency_report_path: resolve(reportDirectory, IDEMPOTENCY_FILENAME),
  }, null, 2));
  if (recoveryReport.status !== 'ready') exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    schema_version: 'story-agent-15x3-image-recovery/v1',
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
