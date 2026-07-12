import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type {
  Stage6OperatorRevisionPreflightResult,
  Stage6OperatorRevisionPreflightWorkspace,
} from '@shared/types.js';
import {
  preflightStage6RevisionBatch,
  type Stage6RevisionBatchCommand,
} from './professional-multi-round-revision-batch-service.js';
import type { MultiRoundRevisionSpecRegistry } from './professional-multi-round-revision-execution-service.js';

const REGISTRY_PATH = 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json';
const TEMPLATE_PATH = 'data/professional-benchmarks/all-format-stage6-p1-revision-command-template.json';
const STATUS_PATH = 'data/reports/story-agent-stage6-p1-revision-batch-status.json';
const READINESS_PATH = 'data/reports/story-agent-stage6-p0-project-readiness.json';

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function readInside(repoRoot: string, relativePath: string): Promise<Buffer> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  if (!inside(realRoot, resolved)) throw new Error('stage6_operator_preflight_source_outside_repository');
  return readFile(resolved);
}

async function readJsonInside<T>(repoRoot: string, relativePath: string): Promise<T> {
  return JSON.parse((await readInside(repoRoot, relativePath)).toString('utf8')) as T;
}

async function loadRegistry(repoRoot: string): Promise<MultiRoundRevisionSpecRegistry> {
  const registry = await readJsonInside<MultiRoundRevisionSpecRegistry>(repoRoot, REGISTRY_PATH);
  if (registry.schema_version !== 'all-format-professional-multi-round-revision-specs/v1'
    || registry.projects.length !== 15
    || new Set(registry.projects.map(project => project.video_type)).size !== 15) {
    throw new Error('stage6_operator_preflight_registry_invalid');
  }
  return registry;
}

export async function preflightStage6OperatorRevision(input: {
  repoRoot: string;
  command: unknown;
  now?: string;
}): Promise<Stage6OperatorRevisionPreflightResult> {
  const registry = await loadRegistry(input.repoRoot);
  const preflight = await preflightStage6RevisionBatch({
    command: input.command,
    repoRoot: input.repoRoot,
    registry,
  });
  return {
    schema_version: 'story-agent-stage6-operator-revision-preflight/v1',
    generated_at: input.now ?? new Date().toISOString(),
    dry_run_only: true,
    execute_endpoint_available: false,
    artifacts_written: false,
    execution_started: false,
    verified_real_revision_credit: false,
    professional_passed: false,
    preflight,
  };
}

export async function getStage6OperatorRevisionPreflightWorkspace(input: {
  repoRoot: string;
  now?: string;
}): Promise<Stage6OperatorRevisionPreflightWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const [template, status, readinessBytes] = await Promise.all([
    readJsonInside<Stage6RevisionBatchCommand>(input.repoRoot, TEMPLATE_PATH),
    readJsonInside<{ summary: Stage6OperatorRevisionPreflightWorkspace['current_batch_summary'] }>(input.repoRoot, STATUS_PATH),
    readInside(input.repoRoot, READINESS_PATH),
  ]);
  const commandTemplate = structuredClone(template);
  commandTemplate.readiness_report = {
    path: READINESS_PATH,
    sha256: createHash('sha256').update(readinessBytes).digest('hex'),
  };
  return {
    schema_version: 'story-agent-stage6-operator-revision-preflight-workspace/v1',
    generated_at: now,
    policy: {
      dry_run_only: true,
      execute_endpoint_available: false,
      explicit_cli_execute_required: true,
      artifacts_written_by_preflight: false,
      fixture_simulation_fallback_counts_as_real_revision: false,
      readiness_counts_as_completed_revision: false,
      professional_pass_can_be_granted_by_preflight: false,
    },
    command_template: commandTemplate,
    current_batch_summary: status.summary,
    template_preflight: await preflightStage6OperatorRevision({
      repoRoot: input.repoRoot,
      command: commandTemplate,
      now,
    }),
  };
}
