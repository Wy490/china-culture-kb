import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type {
  Stage6ExitReviewSignatureInspectionResult,
  Stage6ExitReviewSignatureInspectorWorkspace,
  Stage6ExitReviewSignatureIssue,
} from '@shared/types.js';
import { stage6CanonicalSha256 } from './professional-multi-round-revision-intake-service.js';
import { buildStage6RealRevisionExitAudit } from './stage6-real-revision-exit-audit-service.js';

const TRUST_POLICY_PATH = 'data/professional-benchmarks/all-format-stage6-exit-review-trust-policy.json';
const REQUIRED_ROLES = ['writer_editor', 'director', 'fact_culture_reviewer'] as const;
const NonEmptyString = z.string().trim().min(1);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Timestamp = z.string().datetime({ offset: true });
const Role = z.enum(REQUIRED_ROLES);
const SignatureBase64 = z.string().refine(value => {
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length === 64 && decoded.toString('base64') === value;
  } catch {
    return false;
  }
}, 'expected canonical base64 Ed25519 signature');

export const Stage6ExitReviewTrustPolicySchema = z.object({
  schema_version: z.literal('story-agent-stage6-exit-review-trust-policy/v1'),
  policy_id: NonEmptyString,
  status: z.enum(['preparation_template', 'active']),
  trust_source: z.literal('external_configuration'),
  evidence_environment: z.literal('external'),
  established_at: z.string(),
  signers: z.array(z.object({
    signer_id: NonEmptyString,
    role: Role,
    key_id: NonEmptyString,
    algorithm: z.literal('Ed25519'),
    public_key_spki_pem: NonEmptyString,
    status: z.enum(['trusted', 'revoked']),
    authorization_reference: NonEmptyString,
    authorized_at: Timestamp,
  }).strict()),
  professional_pass_can_be_granted: z.literal(false),
}).strict().superRefine((policy, context) => {
  if (policy.status === 'active' && !Timestamp.safeParse(policy.established_at).success) {
    context.addIssue({ code: 'custom', path: ['established_at'], message: 'active trust policy requires established_at' });
  }
});

export const Stage6ExitReviewAttestationSchema = z.object({
  schema_version: z.literal('story-agent-stage6-exit-review-attestation/v1'),
  attestation_id: NonEmptyString,
  benchmark_id: NonEmptyString,
  real_project_id: NonEmptyString,
  exit_audit_binding_sha256: Hash,
  decision: z.enum(['approve_stage6_exit', 'request_changes', 'reject']),
  reviewed_at: Timestamp,
  review_note: NonEmptyString,
  signatures: z.array(z.object({
    schema_version: z.literal('story-agent-stage6-exit-review-ed25519-signature/v1'),
    signer_id: NonEmptyString,
    role: Role,
    key_id: NonEmptyString,
    algorithm: z.literal('Ed25519'),
    signed_payload_sha256: Hash,
    signature_base64: SignatureBase64,
    signed_at: Timestamp,
  }).strict()).min(3),
  professional_passed: z.literal(false),
}).strict();

export type Stage6ExitReviewTrustPolicy = z.infer<typeof Stage6ExitReviewTrustPolicySchema>;
export type Stage6ExitReviewAttestation = z.infer<typeof Stage6ExitReviewAttestationSchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize(child)]));
  return value;
}

export function createStage6ExitReviewSignaturePayload(attestation: unknown): Buffer {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) return Buffer.from('');
  const content = { ...(attestation as Record<string, unknown>) };
  delete content.signatures;
  return Buffer.from(JSON.stringify(canonicalize({
    signature_contract: 'story-agent-stage6-exit-review-ed25519-payload/v1',
    payload: content,
  })), 'utf8');
}

export function stage6ExitAuditBindingSha256(report: Awaited<ReturnType<typeof buildStage6RealRevisionExitAudit>>): string {
  return stage6CanonicalSha256({
    source_readiness_canonical_sha256: report.source_readiness_canonical_sha256,
    source_intake_canonical_sha256: report.source_intake_canonical_sha256,
    source_registry_canonical_sha256: report.source_registry_canonical_sha256,
    policy: report.policy,
    summary: report.summary,
    projects: report.projects,
  });
}

function pushIssue(issues: Stage6ExitReviewSignatureIssue[], value: Stage6ExitReviewSignatureIssue): void {
  if (!issues.some(item => item.code === value.code && item.path === value.path)) issues.push(value);
}

function claimedProfessionalPass(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).professional_passed === true);
}

export function evaluateStage6ExitReviewAttestation(input: {
  rawJson: string;
  expectedBenchmarkId: string;
  expectedRealProjectId: string;
  expectedExitAuditBindingSha256: string;
  stage6ExitCandidate: boolean;
  trustPolicy: unknown;
  now?: string;
}): Stage6ExitReviewSignatureInspectionResult {
  const now = input.now ?? new Date().toISOString();
  const checks: Stage6ExitReviewSignatureInspectionResult['checks'] = {
    request_valid: Boolean(input.rawJson && input.expectedBenchmarkId && input.expectedExitAuditBindingSha256),
    json_valid: false,
    attestation_schema_valid: false,
    trust_policy_schema_valid: false,
    trust_policy_active: false,
    stage6_exit_candidate_reverified: input.stage6ExitCandidate,
    benchmark_binding_valid: false,
    real_project_binding_valid: false,
    exit_audit_binding_valid: false,
    approval_decision_valid: false,
    required_roles_signed: false,
    trusted_signer_bindings_valid: false,
    signed_payload_digests_valid: false,
    cryptographic_signatures_valid: false,
    signature_timestamps_valid: false,
  };
  const issues: Stage6ExitReviewSignatureIssue[] = [];
  if (!checks.request_valid) pushIssue(issues, { code: 'signature_inspection_request_invalid', path: '', gate: 'request', blocking: true, message: 'raw_json, benchmark binding, and audit binding are required.' });
  let rawAttestation: unknown;
  try { rawAttestation = JSON.parse(input.rawJson) as unknown; checks.json_valid = true; }
  catch (error) { pushIssue(issues, { code: 'exit_review_attestation_json_invalid', path: 'raw_json', gate: 'schema', blocking: true, message: (error as Error).message }); }
  const sourceClaim = claimedProfessionalPass(rawAttestation);
  if (sourceClaim) pushIssue(issues, { code: 'self_reported_professional_pass_rejected', path: 'professional_passed', gate: 'credit', blocking: false, message: 'An exit-review attestation cannot grant professional pass.' });
  const attestationResult = Stage6ExitReviewAttestationSchema.safeParse(rawAttestation);
  if (!attestationResult.success) for (const item of attestationResult.error.issues.slice(0, 50)) pushIssue(issues, { code: 'exit_review_attestation_schema_invalid', path: item.path.join('.'), gate: 'schema', blocking: true, message: item.message });
  const trustResult = Stage6ExitReviewTrustPolicySchema.safeParse(input.trustPolicy);
  if (!trustResult.success) for (const item of trustResult.error.issues.slice(0, 50)) pushIssue(issues, { code: 'exit_review_trust_policy_schema_invalid', path: item.path.join('.'), gate: 'trust', blocking: true, message: item.message });
  const attestation = attestationResult.success ? attestationResult.data : null;
  const trustPolicy = trustResult.success ? trustResult.data : null;
  checks.attestation_schema_valid = Boolean(attestation);
  checks.trust_policy_schema_valid = Boolean(trustPolicy);
  checks.trust_policy_active = trustPolicy?.status === 'active';
  if (!checks.trust_policy_active) pushIssue(issues, { code: 'exit_review_trust_policy_not_active', path: 'trust_policy.status', gate: 'trust', blocking: true, message: 'An externally established active trust policy is required.' });
  if (!checks.stage6_exit_candidate_reverified) pushIssue(issues, { code: 'stage6_exit_candidate_required_before_attestation', path: 'benchmark_id', gate: 'binding', blocking: true, message: 'Current P3 audit must independently mark this project as an exit-review candidate.' });

  let trustedSignerCount = 0;
  let digestMatchCount = 0;
  let verifiedCount = 0;
  if (attestation && trustPolicy) {
    checks.benchmark_binding_valid = attestation.benchmark_id === input.expectedBenchmarkId;
    checks.real_project_binding_valid = Boolean(input.expectedRealProjectId && attestation.real_project_id === input.expectedRealProjectId);
    checks.exit_audit_binding_valid = attestation.exit_audit_binding_sha256 === input.expectedExitAuditBindingSha256;
    checks.approval_decision_valid = attestation.decision === 'approve_stage6_exit';
    checks.required_roles_signed = REQUIRED_ROLES.every(role => attestation.signatures.filter(signature => signature.role === role).length === 1);
    const signerIds = new Set<string>();
    const keyIds = new Set<string>();
    let signerBindingsValid = checks.required_roles_signed;
    let payloadDigestsValid = true;
    let cryptographicValid = true;
    let timestampsValid = true;
    const payload = createStage6ExitReviewSignaturePayload(attestation);
    const payloadDigest = createHash('sha256').update(payload).digest('hex');
    const reviewedAt = Date.parse(attestation.reviewed_at);
    for (const signature of attestation.signatures) {
      const trusted = trustPolicy.signers.find(signer => signer.signer_id === signature.signer_id
        && signer.role === signature.role && signer.key_id === signature.key_id && signer.status === 'trusted');
      if (!trusted || signerIds.has(signature.signer_id) || keyIds.has(signature.key_id)) signerBindingsValid = false;
      else { trustedSignerCount += 1; signerIds.add(signature.signer_id); keyIds.add(signature.key_id); }
      if (signature.signed_payload_sha256 !== payloadDigest) payloadDigestsValid = false; else digestMatchCount += 1;
      if (!Number.isFinite(reviewedAt) || Date.parse(signature.signed_at) < reviewedAt) timestampsValid = false;
      let verified = false;
      if (trusted && signature.signed_payload_sha256 === payloadDigest) {
        try {
          const publicKey = createPublicKey(trusted.public_key_spki_pem);
          verified = publicKey.asymmetricKeyType === 'ed25519' && verifySignature(null, payload, publicKey, Buffer.from(signature.signature_base64, 'base64'));
        } catch { verified = false; }
      }
      if (verified) verifiedCount += 1; else cryptographicValid = false;
    }
    checks.trusted_signer_bindings_valid = signerBindingsValid && trustedSignerCount === 3;
    checks.signed_payload_digests_valid = payloadDigestsValid && digestMatchCount === attestation.signatures.length;
    checks.cryptographic_signatures_valid = cryptographicValid && verifiedCount === 3 && attestation.signatures.length === 3;
    checks.signature_timestamps_valid = timestampsValid;
    const gates: Array<[keyof typeof checks, string, Stage6ExitReviewSignatureIssue['gate'], string]> = [
      ['benchmark_binding_valid', 'exit_review_benchmark_mismatch', 'binding', 'benchmark_id'],
      ['real_project_binding_valid', 'exit_review_real_project_mismatch', 'binding', 'real_project_id'],
      ['exit_audit_binding_valid', 'exit_review_audit_binding_mismatch', 'binding', 'exit_audit_binding_sha256'],
      ['approval_decision_valid', 'exit_review_approval_decision_required', 'decision', 'decision'],
      ['required_roles_signed', 'exit_review_required_role_signatures_missing', 'signature', 'signatures'],
      ['trusted_signer_bindings_valid', 'exit_review_signer_not_trusted_or_duplicate', 'trust', 'signatures'],
      ['signed_payload_digests_valid', 'exit_review_signed_payload_digest_mismatch', 'signature', 'signatures'],
      ['cryptographic_signatures_valid', 'exit_review_ed25519_signature_invalid', 'signature', 'signatures'],
      ['signature_timestamps_valid', 'exit_review_signature_timestamp_invalid', 'signature', 'signatures'],
    ];
    for (const [key, code, gate, pathValue] of gates) if (!checks[key]) pushIssue(issues, { code, path: pathValue, gate, blocking: true, message: `${pathValue} failed the signed exit-review gate.` });
  }
  const signatureList = attestation?.signatures ?? [];
  return {
    schema_version: 'story-agent-stage6-exit-review-signature-inspection/v1',
    generated_at: now,
    dry_run_only: true,
    attestation_persisted: false,
    stage6_exit_record_persisted: false,
    signature_created: false,
    execution_started: false,
    professional_passed: false,
    source_file_sha256: input.rawJson ? createHash('sha256').update(input.rawJson, 'utf8').digest('hex') : '',
    canonical_attestation_payload_sha256: attestation ? createHash('sha256').update(createStage6ExitReviewSignaturePayload(attestation)).digest('hex') : '',
    signature_verification_ready: Object.values(checks).every(Boolean),
    expected_binding: {
      benchmark_id: input.expectedBenchmarkId,
      real_project_id: input.expectedRealProjectId,
      exit_audit_binding_sha256: input.expectedExitAuditBindingSha256,
      stage6_exit_candidate: input.stage6ExitCandidate,
    },
    checks,
    signature_summary: {
      signature_count: signatureList.length,
      required_role_count: 3,
      trusted_signer_count: trustedSignerCount,
      payload_digest_match_count: digestMatchCount,
      cryptographically_verified_signature_count: verifiedCount,
      writer_editor_signature_count: signatureList.filter(item => item.role === 'writer_editor').length,
      director_signature_count: signatureList.filter(item => item.role === 'director').length,
      fact_culture_reviewer_signature_count: signatureList.filter(item => item.role === 'fact_culture_reviewer').length,
      source_claimed_professional_pass: sourceClaim,
    },
    issues,
  };
}

async function readJsonInside(repoRoot: string, relativePath: string): Promise<unknown> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new Error('stage6_exit_signature_path_outside_repository');
  return JSON.parse(await readFile(resolved, 'utf8')) as unknown;
}

export async function inspectStage6ExitReviewSignature(input: {
  repoRoot: string;
  request: unknown;
  now?: string;
}): Promise<Stage6ExitReviewSignatureInspectionResult> {
  const now = input.now ?? new Date().toISOString();
  const request = input.request && typeof input.request === 'object' ? input.request as Record<string, unknown> : {};
  const rawJson = typeof request.raw_json === 'string' ? request.raw_json : '';
  const benchmarkId = typeof request.expected_benchmark_id === 'string' ? request.expected_benchmark_id : '';
  const [audit, trustPolicy] = await Promise.all([
    buildStage6RealRevisionExitAudit({ repoRoot: input.repoRoot, now }),
    readJsonInside(input.repoRoot, TRUST_POLICY_PATH),
  ]);
  const project = audit.projects.find(item => item.benchmark_id === benchmarkId);
  return evaluateStage6ExitReviewAttestation({
    rawJson,
    expectedBenchmarkId: benchmarkId,
    expectedRealProjectId: project?.real_project_id ?? '',
    expectedExitAuditBindingSha256: stage6ExitAuditBindingSha256(audit),
    stage6ExitCandidate: project?.stage6_exit_candidate ?? false,
    trustPolicy,
    now,
  });
}

function template(input: { benchmarkId: string; realProjectId: string; auditBinding: string; now: string }): unknown {
  return {
    schema_version: 'story-agent-stage6-exit-review-attestation/v1',
    attestation_id: '',
    benchmark_id: input.benchmarkId,
    real_project_id: input.realProjectId,
    exit_audit_binding_sha256: input.auditBinding,
    decision: 'approve_stage6_exit',
    reviewed_at: input.now,
    review_note: '',
    signatures: [],
    professional_passed: false,
  };
}

export async function getStage6ExitReviewSignatureInspectorWorkspace(input: {
  repoRoot: string;
  benchmarkId?: unknown;
  now?: string;
}): Promise<Stage6ExitReviewSignatureInspectorWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const [audit, rawTrustPolicy] = await Promise.all([
    buildStage6RealRevisionExitAudit({ repoRoot: input.repoRoot, now }),
    readJsonInside(input.repoRoot, TRUST_POLICY_PATH),
  ]);
  const trust = Stage6ExitReviewTrustPolicySchema.parse(rawTrustPolicy);
  const requested = typeof input.benchmarkId === 'string' ? input.benchmarkId : '';
  const selected = audit.projects.find(project => project.benchmark_id === requested) ?? audit.projects[0];
  const auditBinding = stage6ExitAuditBindingSha256(audit);
  const value = template({ benchmarkId: selected.benchmark_id, realProjectId: selected.real_project_id, auditBinding, now });
  const rawJson = `${JSON.stringify(value, null, 2)}\n`;
  return {
    schema_version: 'story-agent-stage6-exit-review-signature-inspector-workspace/v1',
    generated_at: now,
    trust_policy: { policy_id: trust.policy_id, status: trust.status, trusted_signer_count: trust.signers.filter(item => item.status === 'trusted').length, required_role_count: 3 },
    policy: {
      dry_run_only: true,
      trust_policy_must_be_external_to_attestation: true,
      signature_verification_is_signature_creation: false,
      attestation_files_are_not_persisted: true,
      stage6_exit_record_can_be_persisted: false,
      exit_attestation_is_professional_pass: false,
    },
    selected_benchmark_id: selected.benchmark_id,
    projects: audit.projects.map(project => ({ benchmark_id: project.benchmark_id, video_type: project.video_type, source_entry: project.source_entry, real_project_id: project.real_project_id, stage6_exit_candidate: project.stage6_exit_candidate })),
    template: value,
    template_raw_json: rawJson,
    template_inspection: evaluateStage6ExitReviewAttestation({ rawJson, expectedBenchmarkId: selected.benchmark_id, expectedRealProjectId: selected.real_project_id, expectedExitAuditBindingSha256: auditBinding, stage6ExitCandidate: selected.stage6_exit_candidate, trustPolicy: trust, now }),
  };
}
