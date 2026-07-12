import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Stage6RealInputReadinessReport } from '../web/shared/types.js';
import {
  executeStage6RevisionBatch,
  preflightStage6RevisionBatch,
  type Stage6RevisionBatchCommand,
} from '../web/server/src/services/professional-multi-round-revision-batch-service.js';
import type { MultiRoundRevisionSpecRegistry } from '../web/server/src/services/professional-multi-round-revision-execution-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json');
const readinessPath = path.join(repoRoot, 'data/reports/story-agent-stage6-p0-project-readiness.json');
const templatePath = path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-p1-revision-command-template.json');
const tableReadTemplatePath = path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-p1-table-read-feedback-template.json');
const costTemplatePath = path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-p1-revision-cost-template.json');
const statusPath = path.join(repoRoot, 'data/reports/story-agent-stage6-p1-revision-batch-status.json');

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function fileSha256(filePath: string): Promise<string> {
  return createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

async function buildCurrentStatus(now = new Date().toISOString()) {
  const readiness = await readJson<Stage6RealInputReadinessReport>(readinessPath);
  const readinessSha = await fileSha256(readinessPath);
  const projects = readiness.projects.map(project => ({
    benchmark_id: project.benchmark_id,
    video_type: project.video_type,
    real_project_id: project.real_project_id,
    p0_readiness: project.status,
    rounds: [
      {
        round_number: 1,
        status: project.status === 'ready' ? 'awaiting_opt_in_command' : 'blocked',
        blockers: project.status === 'ready' ? [] : ['p0_verified_readiness_required'],
      },
      {
        round_number: 2,
        status: 'blocked',
        blockers: ['round_1_verified_completion_required'],
      },
    ],
    completed_verified_round_count: 0,
    professional_passed: false,
  }));
  return {
    schema_version: 'story-agent-stage6-revision-batch-status/v1',
    generated_at: now,
    source_readiness_path: path.relative(repoRoot, readinessPath),
    source_readiness_sha256: readinessSha,
    source_intake_canonical_sha256: readiness.source_intake_canonical_sha256,
    policy: {
      explicit_execute_flag_required: true,
      p0_verified_readiness_required: true,
      immutable_artifacts_required: true,
      simulation_fixture_fallback_counts_as_real_revision: false,
      preparation_or_recovery_counts_as_completed_revision: false,
      professional_pass_can_be_granted_by_executor: false,
    },
    summary: {
      project_count: projects.length,
      planned_round_count: projects.length * 2,
      p0_ready_project_count: projects.filter(project => project.p0_readiness === 'ready').length,
      round_1_awaiting_command_count: projects.filter(project => project.rounds[0].status === 'awaiting_opt_in_command').length,
      blocked_project_count: projects.filter(project => project.p0_readiness === 'blocked').length,
      completed_verified_revision_round_count: 0,
      completed_two_round_verified_project_count: 0,
      professional_pass_count: 0,
    },
    projects,
  };
}

async function main(): Promise<void> {
  const registry = await readJson<MultiRoundRevisionSpecRegistry>(registryPath);
  const commandArgument = argumentValue('--command');
  const writeTemplate = process.argv.includes('--write-template');
  const writeStatus = process.argv.includes('--write-status');
  const check = process.argv.includes('--check');
  const execute = process.argv.includes('--execute');

  if (writeTemplate) {
    const first = registry.projects[0];
    const template = {
      schema_version: 'story-agent-stage6-revision-batch-command/v1',
      command_id: '',
      created_at: '',
      benchmark_id: first.benchmark_id,
      real_project_id: '',
      round_number: 1,
      opt_in_execution_confirmed: false,
      readiness_report: {
        path: path.relative(repoRoot, readinessPath),
        sha256: await fileSha256(readinessPath),
      },
      before_package: { path: '', sha256: '' },
      revision_submission: { path: '', sha256: '' },
      table_read_feedback: { path: '', sha256: '' },
      cost_record: { path: '', sha256: '' },
      declared_changed_sections: [],
      feedback_resolutions: [],
      provenance: {
        artifact_kind: 'human_authored',
        output_id: '',
        model_or_author: '',
        prompt_or_brief_version: '',
        provenance_verified: false,
        verification_reference: '',
        verified_by: '',
        verified_at: '',
      },
    };
    await writeJson(templatePath, template);
    await writeJson(tableReadTemplatePath, {
      schema_version: 'story-agent-stage6-table-read-feedback/v1',
      benchmark_id: first.benchmark_id,
      real_project_id: '',
      round_number: 1,
      session_reference: '',
      submitted_at: '',
      feedback: [
        { feedback_id: '', reviewer_id: '', source: 'writer_editor', category: 'structure', note: '', issue_id: '', target_sections: [], evidence_required: false },
        { feedback_id: '', reviewer_id: '', source: 'director', category: 'scene', note: '', issue_id: '', target_sections: [], evidence_required: false },
        { feedback_id: '', reviewer_id: '', source: 'fact_culture_reviewer', category: 'fact_and_culture', note: '', issue_id: '', target_sections: [], evidence_required: true },
      ],
    });
    await writeJson(costTemplatePath, {
      schema_version: 'story-agent-stage6-revision-cost/v1',
      benchmark_id: first.benchmark_id,
      real_project_id: '',
      round_number: 1,
      output_id: '',
      provider_or_author: '',
      amount: 0,
      currency: 'CNY',
      usage_reference: '',
      recorded_at: '',
    });
  }

  const currentStatus = await buildCurrentStatus();
  if (writeStatus) await writeJson(statusPath, currentStatus);

  if (check) {
    const stored = await readJson<Record<string, unknown>>(statusPath);
    const comparableStored = { ...stored, generated_at: '' };
    const comparableCurrent = { ...currentStatus, generated_at: '' };
    if (JSON.stringify(comparableStored) !== JSON.stringify(comparableCurrent)) {
      throw new Error('Stage 6 P1 batch status is stale for current P0 readiness');
    }
    const summary = stored.summary as Record<string, number>;
    if (summary.planned_round_count !== 30
      || summary.completed_verified_revision_round_count !== 0
      || summary.professional_pass_count !== 0) {
      throw new Error('Stage 6 P1 batch status violates zero-credit preparation policy');
    }
  }

  if (commandArgument) {
    const commandPath = path.resolve(repoRoot, commandArgument);
    const command = await readJson<Stage6RevisionBatchCommand>(commandPath);
    if (execute) {
      const result = await executeStage6RevisionBatch({ command, repoRoot, registry });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const preflight = await preflightStage6RevisionBatch({ command, repoRoot, registry });
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  console.log(JSON.stringify({
    template_written: writeTemplate,
    status_written: writeStatus,
    checked: check,
    summary: currentStatus.summary,
  }, null, 2));
}

void main();
