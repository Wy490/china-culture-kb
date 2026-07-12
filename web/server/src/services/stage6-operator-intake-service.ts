import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type {
  Stage6OperatorIntakeValidationResult,
  Stage6OperatorIntakeWorkspace,
} from '@shared/types.js';
import {
  buildStage6RealInputOperatorTemplate,
  stage6CanonicalSha256,
  validateStage6RealInputIntake,
} from './professional-multi-round-revision-intake-service.js';
import type { MultiRoundRevisionSpecRegistry } from './professional-multi-round-revision-execution-service.js';

const REGISTRY_PATH = 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json';

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function loadRegistry(repoRoot: string): Promise<MultiRoundRevisionSpecRegistry> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, REGISTRY_PATH));
  if (!inside(realRoot, resolved)) throw new Error('stage6_operator_registry_outside_repository');
  const registry = JSON.parse(await readFile(resolved, 'utf8')) as MultiRoundRevisionSpecRegistry;
  if (registry.schema_version !== 'all-format-professional-multi-round-revision-specs/v1'
    || registry.projects.length !== 15
    || new Set(registry.projects.map(project => project.video_type)).size !== 15) {
    throw new Error('stage6_operator_registry_invalid');
  }
  return registry;
}

export async function validateStage6OperatorIntake(input: {
  repoRoot: string;
  intake: unknown;
  now?: string;
}): Promise<Stage6OperatorIntakeValidationResult> {
  const registry = await loadRegistry(input.repoRoot);
  const now = input.now ?? new Date().toISOString();
  const report = validateStage6RealInputIntake({
    intake: input.intake,
    registry,
    repoRoot: input.repoRoot,
    sourceIntakePath: 'operator-ui-dry-run',
    now,
  });
  return {
    schema_version: 'story-agent-stage6-operator-intake-validation/v1',
    generated_at: now,
    source_intake_canonical_sha256: stage6CanonicalSha256(input.intake),
    schema_valid: !report.global_errors.some(item => item.code === 'intake_schema_invalid'
      || item.code === 'intake_schema_version_invalid'),
    dry_run_only: true,
    input_persisted: false,
    execution_started: false,
    professional_passed: false,
    report,
  };
}

export async function getStage6OperatorIntakeWorkspace(input: {
  repoRoot: string;
  now?: string;
}): Promise<Stage6OperatorIntakeWorkspace> {
  const registry = await loadRegistry(input.repoRoot);
  const now = input.now ?? new Date().toISOString();
  const template = buildStage6RealInputOperatorTemplate(registry);
  return {
    schema_version: 'story-agent-stage6-operator-intake-workspace/v1',
    generated_at: now,
    policy: {
      dry_run_only: true,
      input_files_are_not_persisted: true,
      readiness_counts_as_completed_revision: false,
      fixture_simulation_fallback_counts_as_real_input: false,
      professional_pass_can_be_granted_by_intake: false,
    },
    template,
    template_validation: await validateStage6OperatorIntake({ repoRoot: input.repoRoot, intake: template, now }),
  };
}
