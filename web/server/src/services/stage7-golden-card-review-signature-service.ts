import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type {
  Stage7GoldenCardReviewerRole,
  Stage7GoldenCardReviewSignatureInspectionResult,
  Stage7GoldenCardReviewSignatureIssue,
  Stage7GoldenCardReviewSignatureWorkspace,
} from '@shared/types.js';
import {
  getStage7GoldenCardReviewWorkspace,
  inspectStage7GoldenCardReview,
} from './stage7-golden-card-review-service.js';
import { stage7GoldenCardCanonicalSha256 } from './stage7-golden-card-review-service.js';

const TRUST_POLICY_PATH = 'data/professional-benchmarks/all-format-stage7-golden-card-review-trust-policy.json';
const ROLES = ['source_reviewer', 'authorization_reviewer', 'type_director', 'fact_reviewer', 'ethics_reviewer', 'local_culture_reviewer'] as const;
const NonEmptyString = z.string().trim().min(1);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Timestamp = z.string().datetime({ offset: true });
const Role = z.enum(ROLES);
const SignatureBase64 = z.string().refine(value => {
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length === 64 && decoded.toString('base64') === value;
  } catch { return false; }
}, 'expected canonical base64 Ed25519 signature');

export const Stage7GoldenCardReviewTrustPolicySchema = z.object({
  schema_version: z.literal('story-agent-stage7-golden-card-review-trust-policy/v1'),
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
  human_approval_can_be_granted: z.literal(false),
  golden_card_promotion_can_be_granted: z.literal(false),
  professional_pass_can_be_granted: z.literal(false),
}).strict().superRefine((policy, context) => {
  if (policy.status === 'active' && !Timestamp.safeParse(policy.established_at).success) context.addIssue({ code: 'custom', path: ['established_at'], message: 'active trust policy requires established_at' });
});

export const Stage7GoldenCardReviewSignatureAttestationSchema = z.object({
  schema_version: z.literal('story-agent-stage7-golden-card-review-signature-attestation/v1'),
  attestation_id: z.string(),
  card_id: NonEmptyString,
  video_type: NonEmptyString,
  source_card_file_sha256: Hash,
  card_payload_sha256: Hash,
  review_payload_sha256: Hash,
  decision: z.enum(['approve_golden_card_review', 'request_changes', 'reject']),
  reviewed_at: Timestamp,
  review_note: z.string(),
  signatures: z.array(z.object({
    schema_version: z.literal('story-agent-stage7-golden-card-review-ed25519-signature/v1'),
    signer_id: NonEmptyString,
    role: Role,
    key_id: NonEmptyString,
    algorithm: z.literal('Ed25519'),
    signed_payload_sha256: Hash,
    signature_base64: SignatureBase64,
    signed_at: Timestamp,
  }).strict()),
  human_approved: z.literal(false),
  golden_card_promoted: z.literal(false),
  professional_passed: z.literal(false),
}).strict();

export type Stage7GoldenCardReviewTrustPolicy = z.infer<typeof Stage7GoldenCardReviewTrustPolicySchema>;
export type Stage7GoldenCardReviewSignatureAttestation = z.infer<typeof Stage7GoldenCardReviewSignatureAttestationSchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize(child)]));
  return value;
}

export function createStage7GoldenCardReviewSignaturePayload(attestation: unknown): Buffer {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) return Buffer.from('');
  const content = { ...(attestation as Record<string, unknown>) };
  delete content.signatures;
  return Buffer.from(JSON.stringify(canonicalize({
    signature_contract: 'story-agent-stage7-golden-card-review-ed25519-payload/v1',
    payload: content,
  })), 'utf8');
}

function pushIssue(issues: Stage7GoldenCardReviewSignatureIssue[], issue: Stage7GoldenCardReviewSignatureIssue): void {
  if (!issues.some(item => item.code === issue.code && item.path === issue.path)) issues.push(issue);
}

function sourceClaims(raw: unknown): { humanApproval: boolean; promotion: boolean; professionalPass: boolean } {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return { humanApproval: value.human_approved === true, promotion: value.golden_card_promoted === true, professionalPass: value.professional_passed === true };
}

export function evaluateStage7GoldenCardReviewSignature(input: {
  signatureRawJson: string;
  reviewRawJson: string;
  reviewInspection: Stage7GoldenCardReviewSignatureInspectionResult['review_inspection'];
  trustPolicy: unknown;
  now?: string;
}): Stage7GoldenCardReviewSignatureInspectionResult {
  const now = input.now ?? new Date().toISOString();
  let rawAttestation: unknown;
  let signatureJsonValid = false;
  try { rawAttestation = JSON.parse(input.signatureRawJson) as unknown; signatureJsonValid = true; } catch { rawAttestation = undefined; }
  let reviewPayloadSha256 = '';
  try { reviewPayloadSha256 = stage7GoldenCardCanonicalSha256(JSON.parse(input.reviewRawJson) as unknown); } catch { reviewPayloadSha256 = ''; }
  const claims = sourceClaims(rawAttestation);
  const attestationResult = Stage7GoldenCardReviewSignatureAttestationSchema.safeParse(rawAttestation);
  const trustResult = Stage7GoldenCardReviewTrustPolicySchema.safeParse(input.trustPolicy);
  const attestation = attestationResult.success ? attestationResult.data : null;
  const trust = trustResult.success ? trustResult.data : null;
  const requiredRoles = input.reviewInspection.expected_binding.required_roles;
  const signatures = attestation?.signatures ?? [];
  const checks: Stage7GoldenCardReviewSignatureInspectionResult['checks'] = {
    request_valid: Boolean(input.signatureRawJson && input.reviewRawJson && input.reviewInspection.expected_binding.card_id),
    signature_json_valid: signatureJsonValid,
    signature_attestation_schema_valid: Boolean(attestation),
    trust_policy_schema_valid: Boolean(trust),
    trust_policy_active: trust?.status === 'active',
    review_approval_preflight_reverified: input.reviewInspection.approval_preflight_ready,
    card_id_binding_valid: attestation?.card_id === input.reviewInspection.expected_binding.card_id,
    video_type_binding_valid: attestation?.video_type === input.reviewInspection.expected_binding.video_type,
    source_file_digest_binding_valid: attestation?.source_card_file_sha256 === input.reviewInspection.source_file_sha256,
    card_payload_digest_binding_valid: attestation?.card_payload_sha256 === input.reviewInspection.canonical_card_payload_sha256,
    review_payload_digest_binding_valid: Boolean(attestation && reviewPayloadSha256 && attestation.review_payload_sha256 === reviewPayloadSha256),
    approval_decision_valid: Boolean(attestation && attestation.attestation_id.trim() && attestation.review_note.trim() && attestation.decision === 'approve_golden_card_review'),
    required_roles_signed: requiredRoles.length > 0 && signatures.length === requiredRoles.length
      && requiredRoles.every(role => signatures.filter(signature => signature.role === role).length === 1),
    trusted_signer_bindings_valid: false,
    signed_payload_digests_valid: false,
    cryptographic_signatures_valid: false,
    signature_timestamps_valid: false,
    source_claimed_credit_rejected: !claims.humanApproval && !claims.promotion && !claims.professionalPass,
  };
  let trustedSignerCount = 0;
  let payloadDigestMatchCount = 0;
  let cryptographicallyVerifiedCount = 0;
  if (attestation && trust) {
    const payload = createStage7GoldenCardReviewSignaturePayload(attestation);
    const payloadDigest = createHash('sha256').update(payload).digest('hex');
    const signerIds = new Set<string>();
    const keyIds = new Set<string>();
    let signerBindingsValid = checks.required_roles_signed;
    let payloadDigestsValid = signatures.length === requiredRoles.length;
    let cryptoValid = signatures.length === requiredRoles.length;
    let timestampsValid = signatures.length === requiredRoles.length;
    const reviewedAt = Date.parse(attestation.reviewed_at);
    for (const signature of signatures) {
      const trusted = trust.signers.find(signer => signer.signer_id === signature.signer_id && signer.role === signature.role
        && signer.key_id === signature.key_id && signer.status === 'trusted');
      if (!trusted || signerIds.has(signature.signer_id) || keyIds.has(signature.key_id)) signerBindingsValid = false;
      else { trustedSignerCount += 1; signerIds.add(signature.signer_id); keyIds.add(signature.key_id); }
      if (signature.signed_payload_sha256 !== payloadDigest) payloadDigestsValid = false; else payloadDigestMatchCount += 1;
      if (!Number.isFinite(reviewedAt) || Date.parse(signature.signed_at) < reviewedAt) timestampsValid = false;
      let verified = false;
      if (trusted && signature.signed_payload_sha256 === payloadDigest) {
        try {
          const key = createPublicKey(trusted.public_key_spki_pem);
          verified = key.asymmetricKeyType === 'ed25519' && verifySignature(null, payload, key, Buffer.from(signature.signature_base64, 'base64'));
        } catch { verified = false; }
      }
      if (verified) cryptographicallyVerifiedCount += 1; else cryptoValid = false;
    }
    checks.trusted_signer_bindings_valid = signerBindingsValid && trustedSignerCount === requiredRoles.length;
    checks.signed_payload_digests_valid = payloadDigestsValid && payloadDigestMatchCount === requiredRoles.length;
    checks.cryptographic_signatures_valid = cryptoValid && cryptographicallyVerifiedCount === requiredRoles.length;
    checks.signature_timestamps_valid = timestampsValid;
  }
  const issues: Stage7GoldenCardReviewSignatureIssue[] = [];
  if (!attestationResult.success) for (const issue of attestationResult.error.issues.slice(0, 50)) pushIssue(issues, { code: 'golden_review_signature_schema_invalid', path: issue.path.join('.'), gate: 'schema', blocking: true, message: issue.message });
  if (!trustResult.success) for (const issue of trustResult.error.issues.slice(0, 50)) pushIssue(issues, { code: 'golden_review_trust_policy_schema_invalid', path: issue.path.join('.'), gate: 'trust', blocking: true, message: issue.message });
  const gates: Array<[keyof typeof checks, string, Stage7GoldenCardReviewSignatureIssue['gate'], string, string]> = [
    ['trust_policy_active', 'golden_review_trust_policy_not_active', 'trust', 'trust_policy.status', 'An externally established active trust policy is required.'],
    ['review_approval_preflight_reverified', 'golden_review_approval_preflight_required', 'review', 'review_raw_json', 'The underlying three-role review must independently pass approval preflight.'],
    ['card_id_binding_valid', 'golden_review_signature_card_binding_mismatch', 'binding', 'card_id', 'card_id does not match the reviewed card.'],
    ['video_type_binding_valid', 'golden_review_signature_video_type_mismatch', 'binding', 'video_type', 'video_type does not match the reviewed card.'],
    ['source_file_digest_binding_valid', 'golden_review_signature_source_digest_mismatch', 'binding', 'source_card_file_sha256', 'Source card file SHA-256 does not match the review inspection.'],
    ['card_payload_digest_binding_valid', 'golden_review_signature_card_digest_mismatch', 'binding', 'card_payload_sha256', 'Card payload SHA-256 does not match the review inspection.'],
    ['review_payload_digest_binding_valid', 'golden_review_signature_review_digest_mismatch', 'binding', 'review_payload_sha256', 'Review payload SHA-256 does not match the supplied review JSON.'],
    ['approval_decision_valid', 'golden_review_signature_approval_decision_required', 'decision', 'decision', 'A complete approve_golden_card_review attestation is required.'],
    ['required_roles_signed', 'golden_review_signature_required_roles_missing', 'signature', 'signatures', 'Exactly one signature is required for each risk-tier review role.'],
    ['trusted_signer_bindings_valid', 'golden_review_signature_signer_not_trusted_or_duplicate', 'trust', 'signatures', 'Every signer and key must be unique and trusted for the claimed role.'],
    ['signed_payload_digests_valid', 'golden_review_signature_payload_digest_mismatch', 'signature', 'signatures', 'Every signature must bind the canonical attestation payload digest.'],
    ['cryptographic_signatures_valid', 'golden_review_ed25519_signature_invalid', 'signature', 'signatures', 'Every required Ed25519 signature must verify.'],
    ['signature_timestamps_valid', 'golden_review_signature_timestamp_invalid', 'signature', 'signatures', 'Signatures must not predate the attestation review time.'],
    ['source_claimed_credit_rejected', 'golden_review_signature_self_reported_credit_rejected', 'credit', 'human_approved', 'Signature input cannot grant approval, promotion, or professional pass.'],
  ];
  for (const [key, code, gate, issuePath, message] of gates) if (!checks[key]) pushIssue(issues, { code, path: issuePath, gate, blocking: true, message });
  return {
    schema_version: 'story-agent-stage7-golden-card-review-signature-inspection/v1',
    generated_at: now,
    dry_run_only: true,
    signature_created: false,
    signed_review_persisted: false,
    source_card_modified: false,
    golden_index_modified: false,
    province_markdown_modified: false,
    human_approval_granted: false,
    golden_card_promoted: false,
    professional_passed: false,
    signature_verification_ready: Object.values(checks).every(Boolean),
    canonical_review_payload_sha256: reviewPayloadSha256,
    canonical_signature_payload_sha256: attestation ? createHash('sha256').update(createStage7GoldenCardReviewSignaturePayload(attestation)).digest('hex') : '',
    expected_binding: {
      card_id: input.reviewInspection.expected_binding.card_id,
      video_type: input.reviewInspection.expected_binding.video_type,
      source_card_file_sha256: input.reviewInspection.source_file_sha256,
      card_payload_sha256: input.reviewInspection.canonical_card_payload_sha256,
      required_roles: requiredRoles,
      review_approval_preflight_ready: input.reviewInspection.approval_preflight_ready,
    },
    checks,
    signature_summary: {
      signature_count: signatures.length,
      required_role_count: requiredRoles.length,
      trusted_signer_count: trustedSignerCount,
      payload_digest_match_count: payloadDigestMatchCount,
      cryptographically_verified_signature_count: cryptographicallyVerifiedCount,
      source_claimed_human_approval: claims.humanApproval,
      source_claimed_golden_card_promotion: claims.promotion,
      source_claimed_professional_pass: claims.professionalPass,
    },
    review_inspection: input.reviewInspection,
    issues,
  };
}

async function readRepositoryJson(repoRoot: string, relativePath: string): Promise<unknown> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage7_review_signature_path_outside_repository');
  return JSON.parse(await readFile(resolved, 'utf8')) as unknown;
}

export async function inspectStage7GoldenCardReviewSignature(input: { repoRoot: string; request: unknown; now?: string }): Promise<Stage7GoldenCardReviewSignatureInspectionResult> {
  const request = input.request && typeof input.request === 'object' && !Array.isArray(input.request) ? input.request as Record<string, unknown> : {};
  const expectedCardId = typeof request.expected_card_id === 'string' ? request.expected_card_id : '';
  const reviewRawJson = typeof request.review_raw_json === 'string' ? request.review_raw_json : '';
  const signatureRawJson = typeof request.signature_raw_json === 'string' ? request.signature_raw_json : '';
  const [reviewInspection, trustPolicy] = await Promise.all([
    inspectStage7GoldenCardReview({ repoRoot: input.repoRoot, request: { raw_json: reviewRawJson, expected_card_id: expectedCardId }, now: input.now }),
    readRepositoryJson(input.repoRoot, TRUST_POLICY_PATH),
  ]);
  return evaluateStage7GoldenCardReviewSignature({ signatureRawJson, reviewRawJson, reviewInspection, trustPolicy, now: input.now });
}

function signatureTemplate(input: {
  cardId: string;
  videoType: string;
  sourceFileSha256: string;
  cardPayloadSha256: string;
  reviewPayloadSha256: string;
  now: string;
}): Stage7GoldenCardReviewSignatureAttestation {
  return {
    schema_version: 'story-agent-stage7-golden-card-review-signature-attestation/v1',
    attestation_id: '',
    card_id: input.cardId,
    video_type: input.videoType,
    source_card_file_sha256: input.sourceFileSha256,
    card_payload_sha256: input.cardPayloadSha256,
    review_payload_sha256: input.reviewPayloadSha256,
    decision: 'approve_golden_card_review',
    reviewed_at: input.now,
    review_note: '',
    signatures: [],
    human_approved: false,
    golden_card_promoted: false,
    professional_passed: false,
  };
}

export async function getStage7GoldenCardReviewSignatureWorkspace(input: { repoRoot: string; cardId?: unknown; now?: string }): Promise<Stage7GoldenCardReviewSignatureWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const [reviewWorkspace, rawTrust] = await Promise.all([
    getStage7GoldenCardReviewWorkspace({ repoRoot: input.repoRoot, cardId: input.cardId, now }),
    readRepositoryJson(input.repoRoot, TRUST_POLICY_PATH),
  ]);
  const trust = Stage7GoldenCardReviewTrustPolicySchema.parse(rawTrust);
  const reviewRawJson = reviewWorkspace.template_raw_json;
  const reviewPayloadSha256 = stage7GoldenCardCanonicalSha256(JSON.parse(reviewRawJson) as unknown);
  const template = signatureTemplate({
    cardId: reviewWorkspace.selected_card_id,
    videoType: reviewWorkspace.template_inspection.expected_binding.video_type,
    sourceFileSha256: reviewWorkspace.template_inspection.source_file_sha256,
    cardPayloadSha256: reviewWorkspace.template_inspection.canonical_card_payload_sha256,
    reviewPayloadSha256,
    now,
  });
  const signatureRawJson = `${JSON.stringify(template, null, 2)}\n`;
  return {
    schema_version: 'story-agent-stage7-golden-card-review-signature-workspace/v1',
    generated_at: now,
    policy: {
      dry_run_only: true,
      trust_policy_is_external_to_attestation: true,
      signature_verification_is_signature_creation: false,
      signed_reviews_are_not_persisted: true,
      verification_ready_is_human_approval: false,
      golden_card_promotion_can_be_granted: false,
      professional_pass_can_be_granted: false,
    },
    trust_policy: { policy_id: trust.policy_id, status: trust.status, trusted_signer_count: trust.signers.filter(signer => signer.status === 'trusted').length },
    cards: reviewWorkspace.cards,
    selected_card_id: reviewWorkspace.selected_card_id,
    review_template_raw_json: reviewRawJson,
    signature_template: template,
    signature_template_raw_json: signatureRawJson,
    template_inspection: evaluateStage7GoldenCardReviewSignature({ signatureRawJson, reviewRawJson, reviewInspection: reviewWorkspace.template_inspection, trustPolicy: trust, now }),
  };
}
