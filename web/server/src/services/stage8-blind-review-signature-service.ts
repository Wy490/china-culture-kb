import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type {
  Stage8BlindReviewRole,
  Stage8BlindReviewSignatureInspectionResult,
  Stage8BlindReviewSignatureIssue,
  Stage8BlindReviewSignatureWorkspace,
  VideoType,
} from '@shared/types.js';
import {
  evaluateProfessionalBlindReviewBundle,
  type ProfessionalBlindReviewBundle,
} from './professional-benchmark-review-service.js';
import { getStage8BlindReviewWorkspace } from './stage8-blind-review-intake-service.js';

const TRUST_POLICY_PATH = 'data/professional-benchmarks/all-format-stage8-blind-review-trust-policy.json';
const ROLES = ['screenwriter_or_script_editor', 'genre_or_director_reviewer', 'fact_or_culture_reviewer'] as const satisfies readonly Stage8BlindReviewRole[];
const DIMENSIONS = [
  'creative_brief_and_audience_promise', 'premise_and_theme_unity', 'structure_causality_and_pacing',
  'character_agency_and_relationship_change', 'scene_function_visible_action_and_blocking', 'dialogue_narration_and_subtext',
  'emotional_curve_and_aftertaste', 'cultural_fact_and_adaptation_boundary', 'production_executability', 'originality_and_distinctiveness',
] as const;
const NonEmptyString = z.string().trim().min(1);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Timestamp = z.string().datetime({ offset: true });
const Role = z.enum(ROLES);
const SignatureBase64 = z.string().refine(value => {
  try { const decoded = Buffer.from(value, 'base64'); return decoded.length === 64 && decoded.toString('base64') === value; } catch { return false; }
}, 'expected canonical base64 Ed25519 signature');

export const Stage8BlindReviewTrustPolicySchema = z.object({
  schema_version: z.literal('story-agent-stage8-blind-review-trust-policy/v1'),
  policy_id: NonEmptyString,
  status: z.enum(['preparation_template', 'active']),
  trust_source: z.literal('external_configuration'),
  evidence_environment: z.literal('external'),
  established_at: z.string(),
  reviewers: z.array(z.object({
    reviewer_id: NonEmptyString,
    role: Role,
    key_id: NonEmptyString,
    algorithm: z.literal('Ed25519'),
    public_key_spki_pem: NonEmptyString,
    status: z.enum(['trusted', 'revoked']),
    authorization_reference: NonEmptyString,
    authorized_at: Timestamp,
  }).strict()),
  signature_verification_can_grant_human_blind_review_pass: z.literal(false),
  professional_pass_can_be_granted: z.literal(false),
}).strict().superRefine((policy, context) => {
  if (policy.status === 'active' && !Timestamp.safeParse(policy.established_at).success) context.addIssue({ code: 'custom', path: ['established_at'], message: 'active policy requires established_at' });
  const reviewerIds = policy.reviewers.map(item => item.reviewer_id);
  const keyIds = policy.reviewers.map(item => item.key_id);
  if (new Set(reviewerIds).size !== reviewerIds.length) context.addIssue({ code: 'custom', path: ['reviewers'], message: 'reviewer IDs must be unique' });
  if (new Set(keyIds).size !== keyIds.length) context.addIssue({ code: 'custom', path: ['reviewers'], message: 'key IDs must be unique' });
});

export const Stage8BlindReviewSignatureAttestationSchema = z.object({
  schema_version: z.literal('story-agent-stage8-blind-review-signature-attestation/v1'),
  attestation_id: NonEmptyString,
  benchmark_id: NonEmptyString,
  video_type: NonEmptyString,
  run_id: NonEmptyString,
  review_bundle_sha256: Hash,
  decision_sha256: Hash,
  weight_contract_sha256: Hash,
  score_threshold_passed: z.literal(true),
  review_completed_at: Timestamp,
  signatures: z.array(z.object({
    schema_version: z.literal('story-agent-stage8-blind-review-ed25519-signature/v1'),
    reviewer_id: NonEmptyString,
    role: Role,
    key_id: NonEmptyString,
    algorithm: z.literal('Ed25519'),
    signed_payload_sha256: Hash,
    signature_base64: SignatureBase64,
    signed_at: Timestamp,
  }).strict()),
  human_blind_review_passed: z.literal(false),
  professional_passed: z.literal(false),
}).strict();

export type Stage8BlindReviewTrustPolicy = z.infer<typeof Stage8BlindReviewTrustPolicySchema>;
export type Stage8BlindReviewSignatureAttestation = z.infer<typeof Stage8BlindReviewSignatureAttestationSchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
}

function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

export function createStage8BlindReviewSignaturePayload(attestation: unknown): Buffer {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) return Buffer.from('');
  const content = { ...(attestation as Record<string, unknown>) };
  delete content.signatures;
  return Buffer.from(JSON.stringify(canonicalize({
    signature_contract: 'story-agent-stage8-blind-review-ed25519-payload/v1',
    payload: content,
  })), 'utf8');
}

function parseJson(raw: string): { valid: boolean; value: unknown } {
  try { return { valid: true, value: JSON.parse(raw) as unknown }; } catch { return { valid: false, value: undefined }; }
}

function pushIssue(issues: Stage8BlindReviewSignatureIssue[], issue: Stage8BlindReviewSignatureIssue): void {
  if (!issues.some(item => item.code === issue.code && item.path === issue.path)) issues.push(issue);
}

export function evaluateStage8BlindReviewSignature(input: {
  reviewBundleRawJson: string;
  signatureRawJson: string;
  expected: { benchmark_id: string; video_type: VideoType };
  trustPolicy: unknown;
  now?: string;
}): Stage8BlindReviewSignatureInspectionResult {
  const now = input.now ?? new Date().toISOString();
  const rawBundle = parseJson(input.reviewBundleRawJson);
  const rawSignature = parseJson(input.signatureRawJson);
  const decision = evaluateProfessionalBlindReviewBundle(rawBundle.value as ProfessionalBlindReviewBundle);
  const attestationResult = Stage8BlindReviewSignatureAttestationSchema.safeParse(rawSignature.value);
  const trustResult = Stage8BlindReviewTrustPolicySchema.safeParse(input.trustPolicy);
  const attestation = attestationResult.success ? attestationResult.data : null;
  const trust = trustResult.success ? trustResult.data : null;
  const bundleValue = rawBundle.value && typeof rawBundle.value === 'object' && !Array.isArray(rawBundle.value) ? rawBundle.value as Record<string, unknown> : {};
  const reviews = Array.isArray(bundleValue.reviews) ? bundleValue.reviews.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>> : [];
  const reviewBundleSha256 = rawBundle.valid ? canonicalSha256(rawBundle.value) : '';
  const decisionSha256 = canonicalSha256(decision);
  const signatures = attestation?.signatures ?? [];
  const claimsCredit = rawSignature.value && typeof rawSignature.value === 'object' && !Array.isArray(rawSignature.value)
    ? (rawSignature.value as Record<string, unknown>).human_blind_review_passed === true || (rawSignature.value as Record<string, unknown>).professional_passed === true : false;
  const checks: Stage8BlindReviewSignatureInspectionResult['checks'] = {
    request_valid: Boolean(input.reviewBundleRawJson && input.signatureRawJson && input.expected.benchmark_id),
    review_bundle_json_valid: rawBundle.valid,
    review_bundle_schema_valid: !decision.blockers.includes('review_bundle_schema_invalid'),
    registry_binding_valid: bundleValue.benchmark_id === input.expected.benchmark_id && bundleValue.video_type === input.expected.video_type,
    score_threshold_passed: decision.score_threshold_passed,
    score_threshold_is_not_human_credit: decision.counts_as_human_blind_review_pass === false && decision.professional_passed === false,
    trust_policy_schema_valid: trustResult.success,
    trust_policy_active: trust?.status === 'active',
    signature_attestation_json_valid: rawSignature.valid,
    signature_attestation_schema_valid: attestationResult.success,
    benchmark_binding_valid: attestation?.benchmark_id === input.expected.benchmark_id && attestation.benchmark_id === decision.benchmark_id,
    video_type_binding_valid: attestation?.video_type === input.expected.video_type && attestation.video_type === decision.video_type,
    run_id_binding_valid: Boolean(attestation?.run_id && attestation.run_id === decision.run_id),
    review_bundle_digest_binding_valid: Boolean(attestation && reviewBundleSha256 && attestation.review_bundle_sha256 === reviewBundleSha256),
    decision_digest_binding_valid: attestation?.decision_sha256 === decisionSha256,
    weight_contract_digest_binding_valid: Boolean(attestation && decision.weight_contract_sha256 && attestation.weight_contract_sha256 === decision.weight_contract_sha256),
    score_threshold_binding_valid: attestation?.score_threshold_passed === decision.score_threshold_passed && decision.score_threshold_passed,
    required_roles_signed: signatures.length === 3 && ROLES.every(role => signatures.filter(item => item.role === role).length === 1),
    trusted_reviewer_bindings_valid: false,
    signed_payload_digests_valid: false,
    cryptographic_signatures_valid: false,
    signature_timestamps_valid: false,
    source_claimed_credit_rejected: !claimsCredit,
  };
  let trustedReviewerCount = 0;
  let digestMatchCount = 0;
  let cryptoCount = 0;
  if (attestation && trust) {
    const payload = createStage8BlindReviewSignaturePayload(attestation);
    const payloadDigest = createHash('sha256').update(payload).digest('hex');
    const reviewerIds = new Set<string>();
    const keyIds = new Set<string>();
    const nowAt = Date.parse(now);
    const policyEstablishedAt = Date.parse(trust.established_at);
    const completedAt = Date.parse(attestation.review_completed_at);
    const latestReviewAt = Math.max(...reviews.map(review => Date.parse(String(review.submitted_at ?? ''))).filter(Number.isFinite), 0);
    let bindingsValid = checks.required_roles_signed;
    let digestsValid = signatures.length === 3;
    let cryptoValid = signatures.length === 3;
    let timestampsValid = signatures.length === 3
      && Number.isFinite(nowAt)
      && Number.isFinite(policyEstablishedAt)
      && policyEstablishedAt <= completedAt
      && completedAt >= latestReviewAt
      && completedAt <= nowAt;
    for (const signature of signatures) {
      const bundleReviewer = reviews.find(review => review.reviewer_id === signature.reviewer_id && review.role === signature.role);
      const trusted = trust.reviewers.find(reviewer => reviewer.reviewer_id === signature.reviewer_id && reviewer.role === signature.role
        && reviewer.key_id === signature.key_id && reviewer.status === 'trusted');
      if (!bundleReviewer || !trusted || reviewerIds.has(signature.reviewer_id) || keyIds.has(signature.key_id)) bindingsValid = false;
      else { trustedReviewerCount += 1; reviewerIds.add(signature.reviewer_id); keyIds.add(signature.key_id); }
      if (signature.signed_payload_sha256 !== payloadDigest) digestsValid = false; else digestMatchCount += 1;
      const signedAt = Date.parse(signature.signed_at);
      const authorizedAt = trusted ? Date.parse(trusted.authorized_at) : Number.NaN;
      if (!Number.isFinite(signedAt) || !Number.isFinite(authorizedAt)
        || signedAt < completedAt || signedAt > nowAt || authorizedAt > signedAt) timestampsValid = false;
      let verified = false;
      if (trusted && signature.signed_payload_sha256 === payloadDigest) {
        try {
          const key = createPublicKey(trusted.public_key_spki_pem);
          verified = key.asymmetricKeyType === 'ed25519' && verifySignature(null, payload, key, Buffer.from(signature.signature_base64, 'base64'));
        } catch { verified = false; }
      }
      if (verified) cryptoCount += 1; else cryptoValid = false;
    }
    checks.trusted_reviewer_bindings_valid = bindingsValid && trustedReviewerCount === 3;
    checks.signed_payload_digests_valid = digestsValid && digestMatchCount === 3;
    checks.cryptographic_signatures_valid = cryptoValid && cryptoCount === 3;
    checks.signature_timestamps_valid = timestampsValid;
  }
  const issues: Stage8BlindReviewSignatureIssue[] = [];
  if (!attestationResult.success) for (const issue of attestationResult.error.issues.slice(0, 50)) pushIssue(issues, { code: 'stage8_signature_attestation_schema_invalid', path: issue.path.join('.'), gate: 'schema', blocking: true, message: issue.message });
  if (!trustResult.success) for (const issue of trustResult.error.issues.slice(0, 50)) pushIssue(issues, { code: 'stage8_signature_trust_policy_schema_invalid', path: issue.path.join('.'), gate: 'trust', blocking: true, message: issue.message });
  const gates: Array<[keyof typeof checks, string, Stage8BlindReviewSignatureIssue['gate'], string, string]> = [
    ['review_bundle_schema_valid', 'stage8_signature_review_bundle_invalid', 'review', 'review_bundle', 'Review bundle must satisfy v2 before signatures are checked.'],
    ['registry_binding_valid', 'stage8_signature_registry_binding_mismatch', 'registry', 'benchmark_id', 'Bundle identity must match the frozen benchmark registry.'],
    ['score_threshold_passed', 'stage8_signature_score_threshold_not_passed', 'decision', 'decision', 'Recomputed all-format score threshold must pass.'],
    ['score_threshold_is_not_human_credit', 'stage8_signature_score_threshold_credit_violation', 'credit', 'decision', 'Score threshold must never self-grant human or professional credit.'],
    ['trust_policy_active', 'stage8_signature_trust_policy_not_active', 'trust', 'trust_policy.status', 'An externally established active repository trust policy is required.'],
    ['signature_attestation_schema_valid', 'stage8_signature_attestation_invalid', 'schema', 'attestation', 'Signature attestation must satisfy the strict schema.'],
    ['benchmark_binding_valid', 'stage8_signature_benchmark_binding_mismatch', 'binding', 'benchmark_id', 'Attestation benchmark does not match.'],
    ['video_type_binding_valid', 'stage8_signature_video_type_binding_mismatch', 'binding', 'video_type', 'Attestation video type does not match.'],
    ['run_id_binding_valid', 'stage8_signature_run_binding_mismatch', 'binding', 'run_id', 'Attestation run ID does not match.'],
    ['review_bundle_digest_binding_valid', 'stage8_signature_bundle_digest_mismatch', 'binding', 'review_bundle_sha256', 'Attestation must bind the canonical review bundle.'],
    ['decision_digest_binding_valid', 'stage8_signature_decision_digest_mismatch', 'binding', 'decision_sha256', 'Attestation must bind the recomputed decision.'],
    ['weight_contract_digest_binding_valid', 'stage8_signature_weight_contract_digest_mismatch', 'binding', 'weight_contract_sha256', 'Attestation must bind the type weight contract.'],
    ['score_threshold_binding_valid', 'stage8_signature_score_threshold_binding_invalid', 'decision', 'score_threshold_passed', 'Attestation threshold state must match the recomputed decision.'],
    ['required_roles_signed', 'stage8_signature_required_roles_missing', 'signature', 'signatures', 'Exactly three required role signatures are required.'],
    ['trusted_reviewer_bindings_valid', 'stage8_signature_reviewer_not_trusted_or_duplicate', 'trust', 'signatures', 'Every reviewer and key must be unique, role-bound, and trusted.'],
    ['signed_payload_digests_valid', 'stage8_signature_payload_digest_mismatch', 'signature', 'signatures', 'Every signature must bind the canonical attestation payload.'],
    ['cryptographic_signatures_valid', 'stage8_signature_ed25519_invalid', 'signature', 'signatures', 'Every required Ed25519 signature must verify.'],
    ['signature_timestamps_valid', 'stage8_signature_timestamp_invalid', 'signature', 'signatures', 'Completion and signature timestamps must follow review submissions.'],
    ['source_claimed_credit_rejected', 'stage8_signature_self_reported_credit_rejected', 'credit', 'human_blind_review_passed', 'Attestation cannot self-grant human or professional credit.'],
  ];
  for (const [key, code, gate, issuePath, message] of gates) if (!checks[key]) pushIssue(issues, { code, path: issuePath, gate, blocking: true, message });
  return {
    schema_version: 'story-agent-stage8-blind-review-signature-inspection/v1', generated_at: now, dry_run_only: true,
    signature_created: false, signed_review_persisted: false, finalization_started: false, human_blind_review_passed: false,
    signed_release_created: false, professional_passed: false, signature_verification_ready: Object.values(checks).every(Boolean),
    canonical_review_bundle_sha256: reviewBundleSha256, canonical_decision_sha256: decisionSha256,
    canonical_signature_payload_sha256: attestation ? createHash('sha256').update(createStage8BlindReviewSignaturePayload(attestation)).digest('hex') : '',
    expected_binding: { benchmark_id: input.expected.benchmark_id, video_type: input.expected.video_type, required_roles: [...ROLES] },
    checks,
    signature_summary: { signature_count: signatures.length, required_role_count: 3, trusted_reviewer_count: trustedReviewerCount,
      payload_digest_match_count: digestMatchCount, cryptographically_verified_signature_count: cryptoCount, real_signature_credit_count: 0,
      human_blind_review_pass_credit_count: 0, professional_pass_count: 0 },
    decision_summary: { video_type: decision.video_type, average_score: decision.average_score, baseline_score_difference: decision.baseline_score_difference,
      production_advance_vote_count: decision.production_advance_vote_count, hard_gate_failure_count: decision.hard_gate_failure_count,
      score_threshold_passed: decision.score_threshold_passed, counts_as_human_blind_review_pass: false, professional_passed: false, blockers: decision.blockers },
    issues,
  };
}

async function readRepositoryJson(repoRoot: string, relativePath: string): Promise<unknown> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage8_signature_path_outside_repository');
  return JSON.parse(await readFile(resolved, 'utf8')) as unknown;
}

function bundleTemplate(project: { benchmark_id: string; video_type: VideoType }): ProfessionalBlindReviewBundle {
  return {
    schema_version: 'professional-benchmark-blind-review/v2', benchmark_id: project.benchmark_id, video_type: project.video_type,
    run_id: '', final_package_sha256: '', candidate_label: '', randomization_batch_id: '', evaluator_did_not_know_origin: true,
    baseline: { baseline_id: '', artifact_sha256: '', rights: 'licensed', average_score: 0 },
    reviews: ROLES.map(role => ({ review_id: '', reviewer_id: '', role, candidate_label: '', blind_review_declared: true,
      independent_review_declared: true, conflict_of_interest_declared: false,
      scores: DIMENSIONS.map(dimension_id => ({ dimension_id, score: 0, note: '' })), hard_gate_failures: [], fact_or_culture_issues: [],
      production_advance_vote: false, submitted_at: '' })),
  };
}

export async function getStage8BlindReviewSignatureWorkspace(input: { repoRoot: string; benchmarkId?: unknown; now?: string }): Promise<Stage8BlindReviewSignatureWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const [intake, rawTrust] = await Promise.all([getStage8BlindReviewWorkspace({ repoRoot: input.repoRoot, now }), readRepositoryJson(input.repoRoot, TRUST_POLICY_PATH)]);
  const trust = Stage8BlindReviewTrustPolicySchema.parse(rawTrust);
  const projects = intake.template.projects.map(project => ({ benchmark_id: project.benchmark_id, video_type: project.video_type, source_entry: project.source_entry,
    signature_status: 'blocked_missing_external_review_and_signatures' as const }));
  const requested = typeof input.benchmarkId === 'string' ? input.benchmarkId : '';
  const selected = projects.find(project => project.benchmark_id === requested) ?? projects[0];
  const bundle = bundleTemplate(selected);
  const bundleRaw = `${JSON.stringify(bundle, null, 2)}\n`;
  const decision = evaluateProfessionalBlindReviewBundle(bundle);
  const signatureTemplate: Stage8BlindReviewSignatureAttestation = {
    schema_version: 'story-agent-stage8-blind-review-signature-attestation/v1', attestation_id: '', benchmark_id: selected.benchmark_id,
    video_type: selected.video_type, run_id: '', review_bundle_sha256: canonicalSha256(bundle), decision_sha256: canonicalSha256(decision),
    weight_contract_sha256: decision.weight_contract_sha256 || '0'.repeat(64), score_threshold_passed: true, review_completed_at: now,
    signatures: [], human_blind_review_passed: false, professional_passed: false,
  };
  const signatureRaw = `${JSON.stringify(signatureTemplate, null, 2)}\n`;
  const templateInspection = evaluateStage8BlindReviewSignature({ reviewBundleRawJson: bundleRaw, signatureRawJson: signatureRaw,
    expected: { benchmark_id: selected.benchmark_id, video_type: selected.video_type }, trustPolicy: trust, now });
  return {
    schema_version: 'story-agent-stage8-blind-review-signature-workspace/v1', generated_at: now,
    policy: { dry_run_only: true, trust_policy_is_repository_controlled: true, signature_verification_is_signature_creation: false,
      signed_reviews_are_not_persisted: true, score_threshold_is_human_blind_review_pass: false,
      signature_ready_is_human_blind_review_pass: false, professional_pass_can_be_granted: false },
    summary: { project_count: 75, score_threshold_ready_project_count: 0, signature_verification_ready_project_count: 0,
      trusted_reviewer_count: trust.reviewers.filter(item => item.status === 'trusted').length, real_signature_count: 0,
      human_blind_review_pass_project_count: 0, professional_pass_count: 0 },
    trust_policy: { policy_id: trust.policy_id, status: trust.status, trusted_reviewer_count: trust.reviewers.filter(item => item.status === 'trusted').length },
    projects, selected_benchmark_id: selected.benchmark_id, review_bundle_template: bundle, review_bundle_template_raw_json: bundleRaw,
    signature_template: signatureTemplate, signature_template_raw_json: signatureRaw, template_inspection: templateInspection,
  };
}

export async function inspectStage8BlindReviewSignature(input: { repoRoot: string; request: unknown; now?: string }): Promise<Stage8BlindReviewSignatureInspectionResult> {
  const request = input.request && typeof input.request === 'object' && !Array.isArray(input.request) ? input.request as Record<string, unknown> : {};
  const workspace = await getStage8BlindReviewSignatureWorkspace({ repoRoot: input.repoRoot, benchmarkId: request.expected_benchmark_id, now: input.now });
  const selected = workspace.projects.find(project => project.benchmark_id === workspace.selected_benchmark_id)!;
  return evaluateStage8BlindReviewSignature({ reviewBundleRawJson: typeof request.review_bundle_raw_json === 'string' ? request.review_bundle_raw_json : '',
    signatureRawJson: typeof request.signature_raw_json === 'string' ? request.signature_raw_json : '',
    expected: { benchmark_id: selected.benchmark_id, video_type: selected.video_type },
    trustPolicy: await readRepositoryJson(input.repoRoot, TRUST_POLICY_PATH), now: input.now });
}
