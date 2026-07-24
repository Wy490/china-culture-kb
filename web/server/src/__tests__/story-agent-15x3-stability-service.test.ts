import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  importStoryAgent15x3CompositeBoards,
  prepareStoryAgent15x3StabilityMatrix,
} from '../services/story-agent-15x3-stability-service.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

let workspaceRoot = '';
const originalEnv = {
  KB_ROOT: process.env.KB_ROOT,
  WEB_GENERATED_ROOT: process.env.WEB_GENERATED_ROOT,
  STORY_GEN_LOCAL_ONLY: process.env.STORY_GEN_LOCAL_ONLY,
};

beforeAll(async () => {
  workspaceRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-15x3-stability-'));
  const realDataRoot = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  await symlink(realDataRoot, resolve(workspaceRoot, 'data'), 'dir');
  process.env.KB_ROOT = resolve(workspaceRoot, 'data');
  process.env.WEB_GENERATED_ROOT = resolve(workspaceRoot, 'web', 'generated');
  process.env.STORY_GEN_LOCAL_ONLY = '1';
});

afterAll(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('Story Agent 15x3 stability matrix', () => {
  it('covers three input profiles per type and resumes a partial image import', async () => {
    const first = await prepareStoryAgent15x3StabilityMatrix();

    expect(first.ok).toBe(true);
    expect(first.data).toMatchObject({
      schema_version: 'story-agent-15x3-stability-matrix/v1',
      status: 'awaiting_imagegen',
      mode: 'canonical_local_15x3',
      coverage: {
        type_count: 15,
        variant_count: 3,
        case_count: 45,
        story_ready_count: 45,
        professional_script_ready_count: 45,
        prompt_ready_count: 45,
        image_ready_count: 0,
        preproduction_ready_count: 0,
        hidden_fallback_count: 0,
      },
      invariants: {
        every_type_has_three_variants: true,
        every_story_ready: true,
        every_professional_script_ready: true,
        every_prompt_ready: true,
        every_image_request_ready: true,
        no_hidden_fallback: true,
        unique_projects: true,
        unique_image_runs: true,
      },
    });
    expect(first.data?.items).toHaveLength(45);
    expect(new Set(first.data?.items.map(item => item.case_id)).size).toBe(45);
    expect(new Set(first.data?.items.map(item => item.matrix_item.project_id)).size).toBe(45);
    expect(new Set(first.data?.items.map(item => item.matrix_item.image_run_id)).size).toBe(45);
    for (const videoType of new Set(first.data?.items.map(item => item.video_type))) {
      expect(first.data?.items.filter(item => item.video_type === videoType))
        .toHaveLength(3);
    }
    expect(first.data?.items.filter(item => (
      item.variant_id === 'adaptation_or_compact'
      && item.input_profile.source_material_mode === 'adapt_user_novel'
    ))).toHaveLength(5);
    expect(first.data?.items.filter(item => (
      item.variant_id === 'adaptation_or_compact'
      && item.input_profile.target_video_duration === '30秒'
    ))).toHaveLength(10);
    expect(first.data?.items.every(item => (
      item.matrix_item.story_status === 'ready'
      && item.matrix_item.professional_script_status === 'ready'
      && item.matrix_item.prompt_status === 'ready'
      && item.matrix_item.image_status === 'awaiting_imagegen'
      && item.matrix_item.pending_image_task_count > 0
    ))).toBe(true);

    const repeated = await prepareStoryAgent15x3StabilityMatrix({
      previous_report: first.data!,
    });
    expect(repeated.ok).toBe(true);
    expect(repeated.data?.coverage.reused_project_count).toBe(45);
    expect(repeated.data?.items.map(item => item.matrix_item.project_id))
      .toEqual(first.data?.items.map(item => item.matrix_item.project_id));
    expect(repeated.data?.items.map(item => item.matrix_item.image_run_id))
      .toEqual(first.data?.items.map(item => item.matrix_item.image_run_id));

    const executions = [];
    for (const item of repeated.data!.items) {
      const outputPath = 'outputs/visual-board.png';
      await mkdir(resolve(item.matrix_item.image_run_directory, 'outputs'), {
        recursive: true,
      });
      await writeFile(
        resolve(item.matrix_item.image_run_directory, outputPath),
        ONE_PIXEL_PNG,
      );
      executions.push({
        run_id: item.matrix_item.image_run_id,
        output_path: outputPath,
      });
    }

    const firstItem = repeated.data!.items[0];
    const firstTaskId = JSON.parse(
      await readFile(firstItem.matrix_item.image_request_path, 'utf8'),
    ).tasks[0].task_id as string;
    const partial = await importStoryAgent15x3CompositeBoards({
      matrix: repeated.data!,
      executions: [{
        ...executions[0],
        task_ids: [firstTaskId],
      }],
    });
    expect(partial.ok).toBe(true);
    expect(partial.data).toMatchObject({
      schema_version: 'story-agent-15x3-composite-board-import/v1',
      status: 'awaiting_imagegen',
      execution_count: 1,
      processed_task_count: 1,
      verified_task_count: 1,
      skipped_idempotent_task_count: 0,
      matrix: {
        status: 'awaiting_imagegen',
        coverage: {
          case_count: 45,
          image_ready_count: 0,
          preproduction_ready_count: 0,
          reused_project_count: 45,
        },
      },
    });
    expect(partial.data?.matrix.items[0].matrix_item.pending_image_task_count)
      .toBe(firstItem.matrix_item.pending_image_task_count - 1);

    const completed = await importStoryAgent15x3CompositeBoards({
      matrix: partial.data!.matrix,
      executions,
    });
    expect(completed.ok).toBe(true);
    expect(completed.data).toMatchObject({
      schema_version: 'story-agent-15x3-composite-board-import/v1',
      status: 'ready',
      execution_count: 45,
      skipped_idempotent_task_count: 1,
      matrix: {
        status: 'ready',
        coverage: {
          case_count: 45,
          image_ready_count: 45,
          preproduction_ready_count: 45,
          reused_project_count: 45,
        },
      },
    });
    expect(completed.data?.verified_task_count)
      .toBe(completed.data?.processed_task_count);
    expect(completed.data?.matrix.items.every(item => (
      item.matrix_item.image_status === 'ready'
      && item.matrix_item.preproduction_status === 'ready'
      && item.matrix_item.pending_image_task_count === 0
    ))).toBe(true);

    const idempotent = await importStoryAgent15x3CompositeBoards({
      matrix: completed.data!.matrix,
      executions,
    });
    expect(idempotent.ok).toBe(true);
    expect(idempotent.data?.skipped_idempotent_task_count)
      .toBe(idempotent.data?.processed_task_count);
  }, 120_000);
});
