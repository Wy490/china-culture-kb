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

    expect(first.ok, JSON.stringify(first.error)).toBe(true);
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
      machine_evaluation: {
        schema_version: 'story-agent-15x3-machine-evaluation/v1',
        machine_validation_only: true,
        human_review_complete: false,
        professional_credit_granted: false,
        case_count: 45,
        quality_report_count: 45,
        story_quality_passed_count: expect.any(Number),
        production_material_ready_count: expect.any(Number),
        factual_cultural_gate_passed_count: 45,
        fact_boundary_ready_count: 45,
        cultural_boundary_ready_count: 45,
        shootability_ready_count: 45,
        metric_contract: {
          quality_passed: 'legacy_quality_report_aggregate',
          story_quality_passed: 'story_publishable_and_pattern_and_gears',
          story_publishable: 'story_scope_quality_gates',
          production_material_ready: 'production_material_gate',
          production_ready: 'all_story_and_production_gates',
        },
        invariants: {
          every_case_evaluated: true,
          every_factual_cultural_gate_passed: true,
          every_scene_fact_bound: true,
          every_scene_cultural_bound: true,
          every_scene_shootable: true,
          repair_attempt_covers_story_quality_failures: true,
        },
        failure_clusters: {
          story_blocking_gate_counts: expect.any(Object),
          production_blocking_gate_counts: expect.any(Object),
          open_repair_target_counts: expect.any(Object),
          weak_pattern_signal_counts: expect.any(Object),
          gears_issue_counts: expect.any(Object),
        },
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
    expect(first.data?.items.every(item => (
      item.matrix_item.machine_evaluation?.schema_version
        === 'story-agent-machine-quality-evidence/v1'
      && item.matrix_item.machine_evaluation.evaluation_recomputed_from_canonical_story
      && item.matrix_item.machine_evaluation.machine_validation_only
      && !item.matrix_item.machine_evaluation.human_review_complete
      && !item.matrix_item.machine_evaluation.professional_credit_granted
      && item.matrix_item.machine_evaluation.story_quality_passed
        === (
          item.matrix_item.machine_evaluation.story_publishable
          && (item.matrix_item.machine_evaluation.pattern_quality_score ?? 0) >= 70
          && (item.matrix_item.machine_evaluation.gears_readiness_score ?? 0) >= 70
        )
      && typeof item.matrix_item.machine_evaluation.production_material_ready === 'boolean'
      && item.matrix_item.machine_evaluation.scene_count > 0
      && item.matrix_item.machine_evaluation.fact_boundary_scene_count
        === item.matrix_item.machine_evaluation.scene_count
      && item.matrix_item.machine_evaluation.cultural_boundary_scene_count
        === item.matrix_item.machine_evaluation.scene_count
      && item.matrix_item.machine_evaluation.shootable_scene_count
        === item.matrix_item.machine_evaluation.scene_count
    ))).toBe(true);
    expect(first.data?.machine_evaluation.by_variant).toHaveLength(3);
    expect(first.data?.machine_evaluation.repair_attempted_case_count).toBe(
      first.data?.items.filter(item => (
        (item.matrix_item.machine_evaluation.repair_attempt_count ?? 0) > 0
      )).length,
    );
    expect(first.data?.machine_evaluation.repair_attempted_case_count).toBeGreaterThanOrEqual(
      (first.data?.machine_evaluation.case_count ?? 0)
        - (first.data?.machine_evaluation.story_quality_passed_count ?? 0),
    );
    expect(first.data?.items.filter(item => (
      !item.matrix_item.machine_evaluation.story_quality_passed
      && item.matrix_item.machine_evaluation.repair_attempt_count === 0
    ))).toHaveLength(0);
    expect(first.data?.machine_evaluation.repair_applied_case_count).toBe(0);
    expect(first.data?.machine_evaluation.total_open_repair_action_count)
      .toBeGreaterThanOrEqual(0);
    expect(first.data?.machine_evaluation.quality_passed_count)
      .toBeLessThan(first.data?.machine_evaluation.case_count ?? 0);
    expect(first.data?.machine_evaluation.story_quality_passed_count).toBe(
      first.data?.items.filter(
        item => item.matrix_item.machine_evaluation.story_quality_passed,
      ).length,
    );
    expect(first.data?.machine_evaluation.production_material_ready_count).toBe(
      first.data?.items.filter(
        item => item.matrix_item.machine_evaluation.production_material_ready,
      ).length,
    );
    expect(first.data?.machine_evaluation.story_quality_passed_count)
      .toBeGreaterThan(first.data?.machine_evaluation.quality_passed_count ?? 0);
    expect(first.data?.machine_evaluation.production_material_ready_count)
      .toBeGreaterThan(first.data?.machine_evaluation.production_ready_count ?? 0);
    expect(first.data?.machine_evaluation.by_variant.every(slice => (
      slice.story_quality_passed_count
        >= slice.quality_passed_count
      && slice.production_material_ready_count
        >= slice.production_ready_count
    ))).toBe(true);
    expect(first.data?.machine_evaluation.status).toBe('passed');
    expect(first.data?.machine_evaluation.story_quality_passed_count).toBe(45);
    expect(first.data?.machine_evaluation.invariants.every_story_quality_passed).toBe(true);
    expect(first.data?.machine_evaluation.failed_invariants).toEqual([]);
    expect(first.data?.machine_evaluation.failure_clusters.story_blocking_gate_counts)
      .toEqual({});
    expect(first.data?.machine_evaluation.invariants.every_story_publishable).toBe(true);
    const expectedOpenRepairTargetCounts = first.data?.items.reduce<Record<string, number>>(
      (counts, item) => {
        for (const target of item.matrix_item.machine_evaluation.open_repair_targets) {
          counts[target] = (counts[target] ?? 0) + 1;
        }
        return counts;
      },
      {},
    );
    expect(first.data?.machine_evaluation.failure_clusters.open_repair_target_counts)
      .toEqual(expectedOpenRepairTargetCounts);
    expect(Object.keys(
      first.data?.machine_evaluation.failure_clusters.weak_pattern_signal_counts ?? {},
    ).length).toBeGreaterThan(0);
    const adaptationItems = first.data?.items.filter(item => (
      item.variant_id === 'adaptation_or_compact'
      && item.input_profile.adaptation_input
    )) ?? [];
    expect(adaptationItems).toHaveLength(5);
    expect(adaptationItems.map(item => ({
      case_id: item.case_id,
      weak: item.matrix_item.machine_evaluation.weak_pattern_signal_labels,
    })).filter(item => item.weak.length > 0)).toEqual([]);
    expect(first.data?.machine_evaluation.failure_clusters.open_repair_target_counts.pattern ?? 0)
      .toBeLessThanOrEqual(6);
    expect(first.data?.machine_evaluation.failure_clusters.gears_issue_counts)
      .toEqual(expect.any(Object));
    expect(first.data?.items.every(item => (
      Array.isArray(item.matrix_item.machine_evaluation.weak_pattern_signal_labels)
      && Array.isArray(item.matrix_item.machine_evaluation.gears_issues)
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
    expect(repeated.data?.items.map(item => item.matrix_item.machine_evaluation))
      .toEqual(first.data?.items.map(item => item.matrix_item.machine_evaluation));
    expect(repeated.data?.machine_evaluation)
      .toEqual(first.data?.machine_evaluation);

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
    expect(completed.data?.matrix.items.filter(item => (
      item.matrix_item.preproduction_status !== 'ready'
    ))).toEqual([]);
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
