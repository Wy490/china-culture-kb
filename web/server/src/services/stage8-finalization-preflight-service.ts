import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type {
  Stage8FinalizationPreflightIssue,
  Stage8FinalizationPreflightResult,
  Stage8FinalizationPreflightWorkspace,
  VideoType,
} from '@shared/types.js';
import { evaluateProfessionalBenchmarkFinalization } from './professional-benchmark-finalization-service.js';
import { getStage8BlindReviewWorkspace } from './stage8-blind-review-intake-service.js';

const TRUST_POLICY_PATH = 'data/professional-benchmarks/all-format-stage8-finalization-trust-policy.json';

function parseJson(raw: unknown): { ok: boolean; value?: unknown } {
  if (typeof raw !== 'string') return { ok: false };
  try { return { ok: true, value: JSON.parse(raw) as unknown }; } catch { return { ok: false }; }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function issue(code: string, gate: Stage8FinalizationPreflightIssue['gate'], pathValue: string, message: string): Stage8FinalizationPreflightIssue {
  return { code, gate, path: pathValue, message, blocking: true };
}

function blockerIssue(code: string): Stage8FinalizationPreflightIssue {
  if (code === 'signed_release_record_missing') return issue(code, 'release', '$.signed_release', '缺少由独立发布权限创建并持久化的 signed release record');
  if (code.includes('schema')) return issue(code, 'schema', '$.finalization_input', 'finalization input v2 schema 未通过');
  if (code.includes('trust') || code.includes('key')) return issue(code, 'trust', '$.trust_policy', '外部 verifier trust policy 或 key 绑定未通过');
  if (code.includes('signature')) return issue(code, 'signature', '$.human_attestation_context', '外部 Ed25519 签名链未通过');
  if (code.includes('revision') || code.includes('quality')) return issue(code, 'revision', '$.revision_trace', '真实修订增量或质量证据未通过');
  if (code.includes('review') || code.includes('baseline') || code.includes('randomization')) return issue(code, 'review', '$.human_attestation_context', '外部盲评、基准或随机化证据未通过');
  return issue(code, 'artifact', '$.finalization_input', '专业成品与证据链门禁未通过');
}

function preparationInput(benchmarkId: string, videoType: VideoType): unknown {
  return {
    schema_version: 'professional-benchmark-finalization-input/v2',
    benchmark_id: benchmarkId,
    run_id: '',
    video_type: videoType,
    provenance: {
      schema_version: 'professional-benchmark-finalization-provenance/v1', execution_kind: 'fixture', generation_mode: 'fixture',
      revision_mode: 'fixture', review_mode: 'fixture', evidence_environment: 'local', used_fallback: false,
      is_fixture: true, is_simulation: false, provider_receipt_verified: false,
    },
    artifact_validation: {}, initial_package: {}, final_package: {}, revision_trace: {}, blind_review_decision: {}, human_attestation_context: {},
  };
}

async function readRepositoryJson(repoRoot: string, relativePath: string): Promise<unknown> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage8_finalization_path_outside_repository');
  return JSON.parse(await readFile(resolved, 'utf8')) as unknown;
}

export function evaluateStage8FinalizationPreflight(input: {
  expected: { benchmark_id: string; video_type: VideoType };
  finalizationInputRawJson: unknown;
  trustPolicyRawJson: unknown;
  now?: string;
}): Stage8FinalizationPreflightResult {
  const finalizationJson = parseJson(input.finalizationInputRawJson);
  const trustJson = parseJson(input.trustPolicyRawJson);
  const finalization = objectValue(finalizationJson.value);
  const trustPolicy = objectValue(trustJson.value);
  const requestValid = typeof input.finalizationInputRawJson === 'string' && typeof input.trustPolicyRawJson === 'string';
  const decision = evaluateProfessionalBenchmarkFinalization(finalizationJson.value, trustJson.value);
  const benchmarkBindingValid = finalizationJson.ok && finalization.benchmark_id === input.expected.benchmark_id;
  const videoTypeBindingValid = finalizationJson.ok && finalization.video_type === input.expected.video_type;
  const schemaValid = !decision.blockers.some(item => item === 'finalization_input_schema_invalid' || item.startsWith('finalization_schema:'));
  const trustValid = trustJson.ok
    && trustPolicy.schema_version === 'professional-benchmark-trusted-verifier-policy/v1'
    && trustPolicy.trust_source === 'external_configuration'
    && trustPolicy.evidence_environment === 'external'
    && Array.isArray(trustPolicy.keys)
    && trustPolicy.keys.length > 0
    && !decision.blockers.some(item => item.includes('trusted_verifier') || item.includes('signature_key'));
  const artifactReady = schemaValid && !decision.blockers.some(item => item.includes('artifact') || item.includes('package') || item.includes('completion'));
  const revisionReady = schemaValid && !decision.blockers.some(item => item.includes('revision') || item.includes('quality'));
  const reviewReady = schemaValid && !decision.blockers.some(item => item.includes('review') || item.includes('baseline') || item.includes('randomization') || item.includes('signature'));
  const issues: Stage8FinalizationPreflightIssue[] = [];
  if (!requestValid) issues.push(issue('request_invalid', 'json', '$', '请求必须包含两个 JSON 字符串'));
  if (!finalizationJson.ok) issues.push(issue('finalization_input_json_invalid', 'json', '$.finalization_input_raw_json', 'finalization input 不是有效 JSON'));
  if (!trustJson.ok) issues.push(issue('trust_policy_json_invalid', 'json', '$.trust_policy_raw_json', 'trust policy 不是有效 JSON'));
  if (!benchmarkBindingValid) issues.push(issue('benchmark_binding_invalid', 'identity', '$.benchmark_id', 'benchmark_id 与固定项目不一致'));
  if (!videoTypeBindingValid) issues.push(issue('video_type_binding_invalid', 'identity', '$.video_type', 'video_type 与固定项目不一致'));
  for (const blocker of decision.blockers) issues.push(blockerIssue(blocker));
  return {
    schema_version: 'story-agent-stage8-finalization-preflight-result/v1', generated_at: input.now ?? new Date().toISOString(), dry_run_only: true,
    input_persisted: false, finalization_started: false, signed_release_created: false, professional_passed: false, expected_binding: input.expected,
    checks: { request_valid: requestValid, finalization_input_json_valid: finalizationJson.ok, trust_policy_json_valid: trustJson.ok,
      benchmark_binding_valid: benchmarkBindingValid, video_type_binding_valid: videoTypeBindingValid,
      finalization_input_schema_valid: schemaValid, external_trust_policy_valid: trustValid,
      professional_artifact_completion_ready: artifactReady, verified_real_revision_delta_ready: revisionReady,
      signed_external_blind_review_ready: reviewReady, eligible_for_signed_release: decision.eligible_for_signed_release && benchmarkBindingValid && videoTypeBindingValid,
      durable_signed_release_present: false, source_claimed_credit_rejected: true },
    decision: { ...decision, professional_passed: false }, issues,
  };
}

export async function getStage8FinalizationPreflightWorkspace(input: { repoRoot: string; benchmarkId?: unknown; now?: string }): Promise<Stage8FinalizationPreflightWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const [intake, trustPolicy] = await Promise.all([
    getStage8BlindReviewWorkspace({ repoRoot: input.repoRoot, now }),
    readRepositoryJson(input.repoRoot, TRUST_POLICY_PATH),
  ]);
  const trust = objectValue(trustPolicy);
  const keys = Array.isArray(trust.keys) ? trust.keys : [];
  const projects = intake.template.projects.map(project => ({
    benchmark_id: project.benchmark_id, video_type: project.video_type, source_entry: project.source_entry, status: 'blocked' as const,
    checks: { professional_artifact_completion_ready: false as const, verified_real_revision_delta_ready: false as const,
      signed_external_blind_review_ready: false as const, external_trust_policy_ready: false as const,
      finalization_candidate_ready: false as const, durable_signed_release_present: false as const },
    blockers: [
      issue('professional_artifact_completion_missing', 'artifact', '$.artifact_validation', '缺少经验证的12件专业成品证据'),
      issue('verified_real_revision_delta_missing', 'revision', '$.revision_trace', '缺少可绑定的真实修订前后质量增量'),
      issue('signed_external_blind_review_missing', 'review', '$.human_attestation_context', '缺少外部三角色签名盲评证据'),
      issue('external_trusted_verifier_policy_missing', 'trust', '$.trust_policy.keys', '缺少外部可信 Ed25519 verifier key'),
      issue('finalization_candidate_not_ready', 'release', '$.decision', '尚未通过 finalization candidate gate'),
      issue('signed_release_record_missing', 'release', '$.signed_release', '缺少独立发布权限持久化的 signed release record'),
    ], professional_passed: false as const,
  }));
  const requested = typeof input.benchmarkId === 'string' ? input.benchmarkId : '';
  const selected = projects.find(project => project.benchmark_id === requested) ?? projects[0];
  const finalizationTemplate = preparationInput(selected.benchmark_id, selected.video_type);
  const finalizationRaw = `${JSON.stringify(finalizationTemplate, null, 2)}\n`;
  const trustRaw = `${JSON.stringify(trustPolicy, null, 2)}\n`;
  return {
    schema_version: 'story-agent-stage8-finalization-preflight-workspace/v1', generated_at: now,
    policy: { dry_run_only: true, finalization_candidate_is_signed_release: false, finalization_candidate_is_professional_pass: false,
      readiness_or_preparation_counts_as_real_evidence: false, fixture_simulation_fallback_counts_as_real_evidence: false,
      signed_release_can_be_created: false, professional_pass_can_be_granted: false },
    summary: { project_count: 75, artifact_completion_ready_project_count: 0, verified_revision_delta_ready_project_count: 0,
      signed_blind_review_ready_project_count: 0, external_trust_ready_project_count: 0,
      finalization_candidate_ready_project_count: 0, signed_release_project_count: 0, professional_pass_count: 0 },
    trust_policy: { policy_id: typeof trust.policy_id === 'string' ? trust.policy_id : '', status: 'preparation_template', trusted_key_count: keys.length },
    projects, selected_benchmark_id: selected.benchmark_id, finalization_input_template: finalizationTemplate,
    finalization_input_template_raw_json: finalizationRaw, trust_policy_template: trustPolicy, trust_policy_template_raw_json: trustRaw,
    template_preflight: evaluateStage8FinalizationPreflight({ expected: { benchmark_id: selected.benchmark_id, video_type: selected.video_type },
      finalizationInputRawJson: finalizationRaw, trustPolicyRawJson: trustRaw, now }),
  };
}

export async function inspectStage8FinalizationPreflight(input: { repoRoot: string; request: unknown; now?: string }): Promise<Stage8FinalizationPreflightResult> {
  const request = objectValue(input.request);
  const workspace = await getStage8FinalizationPreflightWorkspace({ repoRoot: input.repoRoot, benchmarkId: request.expected_benchmark_id, now: input.now });
  const selected = workspace.projects.find(project => project.benchmark_id === workspace.selected_benchmark_id)!;
  return evaluateStage8FinalizationPreflight({ expected: { benchmark_id: selected.benchmark_id, video_type: selected.video_type },
    finalizationInputRawJson: request.finalization_input_raw_json, trustPolicyRawJson: request.trust_policy_raw_json, now: input.now });
}
