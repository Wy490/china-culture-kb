import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  importStoryAgent15TypeCompositeBoards,
  prepareStoryAgent15TypePreproductionMatrix,
} from '../services/story-agent-15-type-matrix-service.js';

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
  workspaceRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-15-type-matrix-'));
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

describe('Story Agent 15-type preproduction matrix', () => {
  it('prepares every canonical type through a resumable image request without hidden fallback', async () => {
    const first = await prepareStoryAgent15TypePreproductionMatrix();

    expect(first.ok).toBe(true);
    expect(first.data).toMatchObject({
      schema_version: 'story-agent-15-type-preproduction-matrix/v1',
      status: 'awaiting_imagegen',
      mode: 'canonical_local_matrix',
      boundary: {
        server_image_provider_invoked: false,
        codex_imagegen_required: true,
        video_generation_in_scope: false,
        human_test_required: false,
      },
      coverage: {
        type_count: 15,
        story_ready_count: 15,
        professional_script_ready_count: 15,
        prompt_ready_count: 15,
        image_request_ready_count: 15,
        preproduction_ready_count: 0,
        hidden_fallback_count: 0,
      },
      invariants: {
        every_type_present: true,
        every_story_ready: true,
        every_professional_script_ready: true,
        every_prompt_ready: true,
        every_image_request_ready: true,
        no_hidden_fallback: true,
        unique_projects: true,
      },
    });
    expect(first.data?.items).toHaveLength(15);
    expect(new Set(first.data?.items.map(item => item.video_type)).size).toBe(15);
    expect(new Set(first.data?.items.map(item => item.project_id)).size).toBe(15);
    for (const item of first.data!.items) {
      expect(item).toMatchObject({
        story_status: 'ready',
        professional_script_status: 'ready',
        prompt_status: 'ready',
        image_status: 'awaiting_imagegen',
        preproduction_status: 'blocked',
        fallback_status: 'explicit_local_only',
      });
      expect(item.story_id).toMatch(/^\d{8}-story-/);
      expect(item.project_id).toContain(`${item.story_id}--`);
      expect(item.image_run_id).toMatch(/^image-run-[a-f0-9]{24}$/);
      expect(item.image_request_path).toContain(`${item.image_run_id}/request.json`);
      expect(item.image_result_path).toContain(`${item.image_run_id}/result.json`);
      expect(item.image_run_directory).toContain(item.image_run_id);
      expect(item.shot_count).toBeGreaterThan(0);
      expect(item.image_task_count).toBeGreaterThan(0);
      expect(item.pending_image_task_count).toBe(item.image_task_count);
      expect(item.image_request_provider_invoked).toBe(false);
      expect(item.blockers).toEqual([]);
    }

    const repeated = await prepareStoryAgent15TypePreproductionMatrix({
      previous_report: first.data!,
    });
    expect(repeated.ok).toBe(true);
    expect(repeated.data?.coverage.reused_project_count).toBe(15);
    expect(repeated.data?.items.map(item => item.project_id))
      .toEqual(first.data?.items.map(item => item.project_id));
    expect(repeated.data?.items.map(item => item.image_run_id))
      .toEqual(first.data?.items.map(item => item.image_run_id));

    const executions = [];
    for (const item of repeated.data!.items) {
      const outputPath = 'outputs/visual-board.png';
      await mkdir(resolve(item.image_run_directory, 'outputs'), { recursive: true });
      await writeFile(resolve(item.image_run_directory, outputPath), ONE_PIXEL_PNG);
      executions.push({
        run_id: item.image_run_id,
        output_path: outputPath,
      });
    }
    const firstExecution = executions[0];
    await writeFile(
      resolve(repeated.data!.items[0].image_run_directory, 'escaped-board.png'),
      ONE_PIXEL_PNG,
    );
    const escaped = await importStoryAgent15TypeCompositeBoards({
      matrix: repeated.data!,
      executions: executions.map(execution => execution.run_id === firstExecution.run_id
        ? { ...execution, output_path: 'escaped-board.png' }
        : execution),
    });
    expect(escaped).toMatchObject({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });

    const imported = await importStoryAgent15TypeCompositeBoards({
      matrix: repeated.data!,
      executions,
    });
    expect(imported.ok).toBe(true);
    expect(imported.data).toMatchObject({
      schema_version: 'story-agent-15-type-composite-board-import/v1',
      status: 'ready',
      board_count: 15,
      matrix: {
        status: 'ready',
        boundary: {
          server_image_provider_invoked: false,
          codex_imagegen_required: false,
        },
        coverage: {
          type_count: 15,
          image_ready_count: 15,
          preproduction_ready_count: 15,
          reused_project_count: 15,
        },
      },
    });
    expect(imported.data?.processed_task_count).toBeGreaterThanOrEqual(15);
    expect(imported.data?.verified_task_count).toBe(imported.data?.processed_task_count);
    expect(imported.data?.matrix.items.every(item => (
      item.image_status === 'ready'
      && item.preproduction_status === 'ready'
      && item.pending_image_task_count === 0
    ))).toBe(true);

    const idempotent = await importStoryAgent15TypeCompositeBoards({
      matrix: imported.data!.matrix,
      executions,
    });
    expect(idempotent.ok).toBe(true);
    expect(idempotent.data?.skipped_idempotent_task_count)
      .toBe(idempotent.data?.processed_task_count);
  });
});
