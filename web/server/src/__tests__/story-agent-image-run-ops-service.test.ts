import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getStoryAgentImageRunOpsReport,
} from '../services/story-agent-image-run-ops-service.js';

const roots: string[] = [];

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function imageRun(input: {
  runId: string;
  status?: 'awaiting_imagegen' | 'blocked' | 'complete';
  updatedAt: string;
  taskStatuses: string[];
  providerInvoked?: boolean;
}) {
  return {
    schema_version: 'story-agent-image-run/v1',
    run_id: input.runId,
    source: {
      kind: 'story_project',
      id: `project-${input.runId}`,
      story_ids: [`story-${input.runId}`],
    },
    status: input.status ?? 'awaiting_imagegen',
    created_at: input.updatedAt,
    updated_at: input.updatedAt,
    request_path: 'request.json',
    result_path: 'result.json',
    request: {
      schema_version: 'image-generation-request/v1',
      run_id: input.runId,
      source: {
        kind: 'story_project',
        id: `project-${input.runId}`,
        story_ids: [`story-${input.runId}`],
      },
      created_at: input.updatedAt,
      request_sha256: 'a'.repeat(64),
      run_directory: `story-agent-image-runs/${input.runId}`,
      output_directory: `story-agent-image-runs/${input.runId}/outputs`,
      provider_invoked: input.providerInvoked ?? false,
      executor: 'codex_imagegen',
      task_count: input.taskStatuses.length,
      pending_task_count: input.taskStatuses.length,
      verified_task_count: 0,
      tasks: [],
      instructions: [],
    },
    tasks: input.taskStatuses.map((status, index) => ({
      task_id: `task-${index + 1}`,
      status,
      prompt_sha256: 'b'.repeat(64),
      target_asset_ids: [],
      series_identity_ids: [],
      local_paths: [],
      attempts: [],
      updated_at: input.updatedAt,
    })),
    summary: {
      task_count: input.taskStatuses.length,
      awaiting_imagegen_count: input.taskStatuses
        .filter(status => status === 'awaiting_imagegen').length,
      generated_count: 0,
      ingested_count: 0,
      bound_count: 0,
      verified_count: input.taskStatuses
        .filter(status => status === 'verified').length,
      failed_retryable_count: 0,
      blocked_count: input.taskStatuses
        .filter(status => status === 'blocked').length,
    },
    preproduction_acceptance: {},
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, {
    recursive: true,
    force: true,
  })));
});

describe('story-agent image run ops report', () => {
  it('classifies stale linked and unlinked runs without mutating artifacts', async () => {
    const generatedRoot = resolve(
      tmpdir(),
      `story-agent-image-run-ops-${Date.now()}-${Math.random()}`,
    );
    roots.push(generatedRoot);
    const linkedRunId = 'image-run-linked';
    const unlinkedRunId = 'image-run-unlinked';
    await writeJson(
      resolve(generatedRoot, 'story-agent-image-runs', linkedRunId, 'run.json'),
      imageRun({
        runId: linkedRunId,
        updatedAt: '2026-07-25T00:00:00.000Z',
        taskStatuses: ['awaiting_imagegen', 'awaiting_imagegen', 'verified'],
      }),
    );
    await writeJson(
      resolve(generatedRoot, 'story-agent-image-runs', unlinkedRunId, 'run.json'),
      imageRun({
        runId: unlinkedRunId,
        updatedAt: '2026-07-24T00:00:00.000Z',
        taskStatuses: ['awaiting_imagegen'],
      }),
    );
    await writeJson(
      resolve(
        generatedRoot,
        'story-agent-runs',
        'story-run-linked',
        'run.json',
      ),
      {
        schema_version: 'story-agent-run/v2',
        run_id: 'story-run-linked',
        status: 'awaiting_external_action',
        current_stage: 'image_assets',
        image_request_manifest: {
          image_run_id: linkedRunId,
        },
      },
    );

    const report = await getStoryAgentImageRunOpsReport({
      generatedRoot,
      staleAfterMs: 24 * 60 * 60 * 1000,
      now: () => new Date('2026-07-31T00:00:00.000Z'),
    });

    expect(report.schema_version).toBe('story-agent-image-run-ops-report/v1');
    expect(report.summary).toMatchObject({
      scanned_run_count: 2,
      open_run_count: 2,
      stale_run_count: 2,
      awaiting_task_count: 3,
      linked_story_agent_run_count: 1,
      unlinked_open_run_count: 1,
      provider_invoked_run_count: 0,
      automatic_close_eligible_count: 0,
    });
    expect(report.items).toEqual([
      expect.objectContaining({
        run_id: unlinkedRunId,
        stale: true,
        linked_story_agent_run_ids: [],
        recommended_action: 'operator_review_resume_or_cancel',
      }),
      expect.objectContaining({
        run_id: linkedRunId,
        stale: true,
        linked_story_agent_run_ids: ['story-run-linked'],
        recommended_action:
          'resume_image_generation_after_operator_confirmation',
      }),
    ]);
    expect(report.boundary).toEqual({
      read_only: true,
      provider_invoked: false,
      image_run_files_modified: false,
      story_agent_run_files_modified: false,
      automatic_close_allowed: false,
      publishable_delivery_credit_granted: false,
    });
  });

  it('limits returned items while preserving whole-inventory counts', async () => {
    const generatedRoot = resolve(
      tmpdir(),
      `story-agent-image-run-ops-limit-${Date.now()}-${Math.random()}`,
    );
    roots.push(generatedRoot);
    for (const [runId, status] of [
      ['image-run-blocked', 'blocked'],
      ['image-run-complete', 'complete'],
    ] as const) {
      await writeJson(
        resolve(generatedRoot, 'story-agent-image-runs', runId, 'run.json'),
        imageRun({
          runId,
          status,
          updatedAt: '2026-07-30T12:00:00.000Z',
          taskStatuses: status === 'blocked' ? ['blocked'] : ['verified'],
        }),
      );
    }

    const report = await getStoryAgentImageRunOpsReport({
      generatedRoot,
      limit: 1,
      now: () => new Date('2026-07-31T00:00:00.000Z'),
    });

    expect(report.summary.scanned_run_count).toBe(2);
    expect(report.summary.blocked_run_count).toBe(1);
    expect(report.summary.complete_run_count).toBe(1);
    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({
      run_id: 'image-run-blocked',
      recommended_action: 'inspect_blocked_image_run',
    });
  });
});
