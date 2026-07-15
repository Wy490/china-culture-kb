#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = realpathSync(resolve(dirname(SCRIPT_PATH), '..'));
const TSX_PATH = resolve(REPO_ROOT, 'web/node_modules/.bin/tsx');

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const mode = argumentValue('--mode') ?? 'local';
const listOnly = process.argv.includes('--list');

if (!['local', 'ci'].includes(mode)) {
  console.error('Usage: node scripts/story-agent-ci.mjs [--mode local|ci] [--list]');
  process.exit(2);
}

const commandEnvironment = { ...process.env };
delete commandEnvironment.STORY_GEN_COMMAND;
delete commandEnvironment.STORY_GEN_COMMAND_ARGS;
delete commandEnvironment.STORY_GEN_PROVIDER;
commandEnvironment.STORY_GEN_LOCAL_ONLY = '1';
commandEnvironment.STORY_AGENT_CI = '1';
commandEnvironment.STORY_AGENT_E2E_CLIENT_PORT ??= '15173';
commandEnvironment.STORY_AGENT_E2E_SERVER_PORT ??= '13000';

const steps = [
  { id: 'web_contract_check', command: 'npm', args: ['run', 'check'], cwd: 'web' },
  { id: 'web_server_tests', command: 'npm', args: ['test'], cwd: 'web/server' },
  { id: 'web_build', command: 'npm', args: ['run', 'build'], cwd: 'web' },
  { id: 'track_a_browser_e2e', command: 'npm', args: ['run', 'e2e:track-a'], cwd: 'web' },
  { id: 'mcp_tests', command: 'npm', args: ['test'], cwd: 'mcp-server' },
  { id: 'mcp_build', command: 'npm', args: ['run', 'build'], cwd: 'mcp-server' },
  { id: 'knowledge_base_lint', command: 'npm', args: ['run', 'kb:lint'], cwd: 'mcp-server' },
  {
    id: 'stage6_p0_readiness', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage6-real-input-intake.mts', '--check'],
  },
  {
    id: 'stage6_p1_batch_status', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage6-revision-batch.mts', '--check'],
  },
  {
    id: 'stage6_p3_exit_audit', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage6-real-revision-exit-audit.mts', '--check'],
  },
  {
    id: 'stage8_blind_review_intake', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage8-blind-review-intake.mts', '--check'],
  },
  {
    id: 'stage8_blind_review_evaluator', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage8-blind-review-evaluator.mts', '--check'],
  },
  {
    id: 'stage8_blind_review_signature', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage8-blind-review-signature.mts', '--check'],
  },
  {
    id: 'stage8_finalization_preflight', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage8-finalization-preflight.mts', '--check'],
  },
  {
    id: 'stage8_durable_release', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage8-durable-release.mts', '--check'],
  },
  {
    id: 'stage8_operations', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-stage8-operations.mts', '--check'],
  },
  {
    id: 'professional_text_audit', command: TSX_PATH,
    args: ['--tsconfig', 'web/server/tsconfig.json', 'scripts/story-agent-professional-text-stage0-audit.ts', '--check'],
  },
  { id: 'governance_audit', command: 'node', args: ['scripts/story-agent-governance-dry-run.mjs', '--check'] },
  { id: 'diff_whitespace_check', command: 'git', args: ['diff', '--check'] },
  ...(mode === 'local'
    ? [
        { id: 'p4_inventory_stale_check', command: 'node', args: ['scripts/story-agent-p4-change-review-plan.mjs', '--check'] },
        { id: 'no_staged_changes', command: 'git', args: ['diff', '--cached', '--quiet'] },
      ]
    : [
        { id: 'ci_no_tracked_mutation', command: 'git', args: ['diff', '--exit-code'] },
        { id: 'ci_no_staged_mutation', command: 'git', args: ['diff', '--cached', '--quiet'] },
      ]),
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, relativePath), 'utf8'));
}

function validateFailClosedCreditPolicy() {
  const p0 = readJson('data/reports/story-agent-stage6-p0-project-readiness.json');
  const p3 = readJson('data/reports/story-agent-stage6-p3-real-revision-exit-audit.json');
  const stage8 = readJson('data/reports/story-agent-stage8-blind-review-readiness.json');
  const stage8Evaluator = readJson('data/reports/story-agent-stage8-blind-review-evaluator-readiness.json');
  const stage8Signature = readJson('data/reports/story-agent-stage8-blind-review-signature-readiness.json');
  const stage8Finalization = readJson('data/reports/story-agent-stage8-finalization-preflight-readiness.json');
  const stage8DurableRelease = readJson('data/reports/story-agent-stage8-durable-release-readiness.json');
  const stage8Operations = readJson('data/reports/story-agent-stage8-operations-readiness.json');
  const progress = readJson('data/reports/story-agent-professional-text-creation-progress.json');
  const errors = [];
  const expectedStage8OperationSources = [
    'data/reports/story-agent-stage8-blind-review-evaluator-readiness.json',
    'data/reports/story-agent-stage8-blind-review-readiness.json',
    'data/reports/story-agent-stage8-blind-review-signature-readiness.json',
    'data/reports/story-agent-stage8-durable-release-readiness.json',
    'data/reports/story-agent-stage8-finalization-preflight-readiness.json',
  ];
  const stage8OperationSourceBindings = Array.isArray(stage8Operations.source_bindings) ? stage8Operations.source_bindings : [];
  const stage8OperationSourceBindingsValid = stage8OperationSourceBindings.length === expectedStage8OperationSources.length
    && stage8OperationSourceBindings.every((binding, index) => {
      const expectedPath = expectedStage8OperationSources[index];
      if (binding?.path !== expectedPath || !/^[a-f0-9]{64}$/.test(binding?.sha256 ?? '')) return false;
      const actualSha256 = createHash('sha256').update(readFileSync(resolve(REPO_ROOT, expectedPath))).digest('hex');
      return binding.sha256 === actualSha256;
    });

  if (p0.policy?.fixture_simulation_fallback_counts_as_real_input !== false
    || p0.policy?.professional_pass_can_be_granted_by_intake !== false) {
    errors.push('p0_false_credit_policy_invalid');
  }
  if (p3.policy?.simulation_fixture_fallback_counts_as_real_revision !== false
    || p3.policy?.prepared_or_recovered_counts_as_real_revision !== false
    || p3.policy?.stage6_exit_candidate_counts_as_professional_pass !== false) {
    errors.push('p3_false_credit_policy_invalid');
  }
  if (p0.summary?.professional_pass_count !== 0
    || p3.summary?.professional_pass_count !== 0
    || p0.projects?.some(project => project.professional_passed !== false)
    || p3.projects?.some(project => project.professional_passed !== false)) {
    errors.push('stage6_professional_credit_must_remain_external');
  }
  if (stage8.policy?.readiness_is_human_blind_review_pass !== false
    || stage8.policy?.fixture_simulation_fallback_counts_as_real_review !== false
    || stage8.policy?.threshold_evaluation_without_verified_human_artifacts_counts_as_pass !== false
    || stage8.summary?.ready_for_external_blind_review_count !== 0
    || stage8.summary?.human_blind_review_pass_project_count !== 0
    || stage8.summary?.professional_pass_count !== 0) {
    errors.push('stage8_blind_review_zero_credit_policy_invalid');
  }
  if (stage8Evaluator.policy?.score_threshold_is_human_blind_review_pass !== false
    || stage8Evaluator.policy?.fixture_simulation_fallback_counts_as_real_review !== false
    || stage8Evaluator.policy?.evaluator_can_grant_professional_pass !== false
    || stage8Evaluator.summary?.weight_contract_ready_count !== 15
    || stage8Evaluator.summary?.real_review_bundle_count !== 0
    || stage8Evaluator.summary?.human_blind_review_pass_project_count !== 0
    || stage8Evaluator.summary?.professional_pass_count !== 0) {
    errors.push('stage8_blind_review_evaluator_zero_credit_policy_invalid');
  }
  if (stage8Signature.policy?.signature_verification_is_signature_creation !== false
    || stage8Signature.policy?.signature_ready_is_human_blind_review_pass !== false
    || stage8Signature.policy?.professional_pass_can_be_granted !== false
    || stage8Signature.summary?.trusted_reviewer_count !== 0
    || stage8Signature.summary?.real_signature_count !== 0
    || stage8Signature.summary?.human_blind_review_pass_project_count !== 0
    || stage8Signature.summary?.professional_pass_count !== 0) {
    errors.push('stage8_blind_review_signature_zero_credit_policy_invalid');
  }
  if (stage8Finalization.policy?.finalization_candidate_is_signed_release !== false
    || stage8Finalization.policy?.finalization_candidate_is_professional_pass !== false
    || stage8Finalization.policy?.readiness_or_preparation_counts_as_real_evidence !== false
    || stage8Finalization.policy?.fixture_simulation_fallback_counts_as_real_evidence !== false
    || stage8Finalization.policy?.signed_release_can_be_created !== false
    || stage8Finalization.policy?.professional_pass_can_be_granted !== false
    || stage8Finalization.summary?.artifact_completion_ready_project_count !== 0
    || stage8Finalization.summary?.verified_revision_delta_ready_project_count !== 0
    || stage8Finalization.summary?.signed_blind_review_ready_project_count !== 0
    || stage8Finalization.summary?.external_trust_ready_project_count !== 0
    || stage8Finalization.summary?.finalization_candidate_ready_project_count !== 0
    || stage8Finalization.summary?.signed_release_project_count !== 0
    || stage8Finalization.summary?.professional_pass_count !== 0
    || stage8Finalization.projects?.some(project => project.professional_passed !== false)) {
    errors.push('stage8_finalization_preflight_zero_credit_policy_invalid');
  }
  if (stage8DurableRelease.policy?.read_only !== true
    || stage8DurableRelease.policy?.authority_registry_is_repository_controlled !== true
    || stage8DurableRelease.policy?.request_supplied_authority_is_trusted !== false
    || stage8DurableRelease.policy?.verification_is_release_creation !== false
    || stage8DurableRelease.policy?.verification_is_durable_import !== false
    || stage8DurableRelease.policy?.fixture_simulation_prepared_counts_as_signed_release !== false
    || stage8DurableRelease.policy?.professional_pass_can_be_granted !== false
    || stage8DurableRelease.summary?.finalization_candidate_ready_project_count !== 0
    || stage8DurableRelease.summary?.active_release_authority_count !== 0
    || stage8DurableRelease.summary?.release_record_verification_ready_project_count !== 0
    || stage8DurableRelease.summary?.durable_signed_release_imported_count !== 0
    || stage8DurableRelease.summary?.professional_pass_count !== 0
    || stage8DurableRelease.projects?.some(project => project.durable_signed_release_imported !== false || project.professional_passed !== false)) {
    errors.push('stage8_durable_release_zero_credit_policy_invalid');
  }
  if (stage8Operations.policy?.read_only !== true
    || stage8Operations.policy?.handoff_is_memory_only !== true
    || stage8Operations.policy?.handoff_is_external_completion !== false
    || stage8Operations.policy?.execute_or_import_endpoint_available !== false
    || stage8Operations.policy?.readiness_or_machine_threshold_can_skip_external_evidence !== false
    || stage8Operations.policy?.fixture_simulation_fallback_prepared_counts_as_real_review !== false
    || stage8Operations.policy?.signature_verification_is_real_signature_credit !== false
    || stage8Operations.policy?.finalization_candidate_is_signed_release !== false
    || stage8Operations.policy?.release_verification_is_durable_import !== false
    || stage8Operations.policy?.professional_pass_can_be_granted !== false
    || stage8Operations.summary?.project_count !== 75
    || stage8Operations.summary?.external_handoff_project_count !== 75
    || stage8Operations.summary?.blind_review_intake_ready_project_count !== 0
    || stage8Operations.summary?.evaluator_contract_ready_video_type_count !== 15
    || stage8Operations.summary?.real_review_bundle_count !== 0
    || stage8Operations.summary?.three_role_signature_ready_project_count !== 0
    || stage8Operations.summary?.finalization_candidate_ready_project_count !== 0
    || stage8Operations.summary?.durable_release_verification_ready_project_count !== 0
    || stage8Operations.summary?.durable_release_imported_count !== 0
    || stage8Operations.summary?.human_blind_review_pass_project_count !== 0
    || stage8Operations.summary?.professional_pass_count !== 0
    || !stage8OperationSourceBindingsValid
    || !/^[a-f0-9]{64}$/.test(stage8Operations.handoff_canonical_sha256 ?? '')
    || stage8Operations.projects?.length !== 75
    || new Set(stage8Operations.projects?.map(project => project.benchmark_id)).size !== 75
    || stage8Operations.projects?.some(project => project.phase !== 'awaiting_blind_review_intake'
      || project.next_action?.code !== 'complete_external_blind_review_intake'
      || project.next_action?.external_input_required !== true
      || project.next_action?.counts_as_completion !== false
      || project.checks?.evaluator_contract_ready !== true
      || project.checks?.real_review_bundle_present !== false
      || project.checks?.three_role_signature_verification_ready !== false
      || project.checks?.finalization_candidate_ready !== false
      || project.checks?.durable_release_verification_ready !== false
      || project.checks?.durable_release_imported !== false
      || project.checks?.human_blind_review_passed !== false
      || project.checks?.professional_passed !== false)) {
    errors.push('stage8_operations_zero_credit_policy_invalid');
  }
  if (progress.metrics?.model_invocation_count !== 0
    || progress.metrics?.stage6_revision_batch_real_execution_count !== 0
    || progress.metrics?.stage6_exit_audit_professional_pass_count !== 0) {
    errors.push('current_no_paid_model_zero_credit_checkpoint_invalid');
  }
  if (errors.length > 0) throw new Error(errors.join(','));
}

if (listOnly) {
  console.log(JSON.stringify({
    schema_version: 'story-agent-unified-ci-plan/v1',
    mode,
    paid_model_invocation_allowed: false,
    external_story_command_inherited: false,
    preparation_counts_as_real_revision: false,
    preparation_counts_as_professional_pass: false,
    steps: steps.map(step => ({ id: step.id, cwd: step.cwd ?? '.', command: step.command, args: step.args })),
  }, null, 2));
  process.exit(0);
}

const startedAt = Date.now();
console.log(`[story-agent-ci] mode=${mode}; paid model invocation disabled; ${steps.length} command steps.`);

try {
  validateFailClosedCreditPolicy();
  console.log('[story-agent-ci] PASS fail_closed_credit_policy');
} catch (error) {
  console.error(`[story-agent-ci] FAIL fail_closed_credit_policy: ${error.message}`);
  process.exit(1);
}

for (const [index, step] of steps.entries()) {
  const stepStartedAt = Date.now();
  console.log(`[story-agent-ci] START ${index + 1}/${steps.length} ${step.id}`);
  const result = spawnSync(step.command, step.args, {
    cwd: resolve(REPO_ROOT, step.cwd ?? '.'),
    env: commandEnvironment,
    stdio: 'inherit',
  });
  const durationMs = Date.now() - stepStartedAt;
  if (result.error || result.status !== 0) {
    console.error(`[story-agent-ci] FAIL ${step.id} (${durationMs}ms)${result.error ? `: ${result.error.message}` : ''}`);
    process.exit(result.status || 1);
  }
  console.log(`[story-agent-ci] PASS ${step.id} (${durationMs}ms)`);
}

console.log(`[story-agent-ci] PASS all checks (${Date.now() - startedAt}ms); no real-revision or professional-pass credit granted.`);
