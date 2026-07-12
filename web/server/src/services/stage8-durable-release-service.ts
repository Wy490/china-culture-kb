import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type {
  Stage8DurableReleaseInspectionResult,
  Stage8DurableReleaseIssue,
  Stage8DurableReleaseWorkspace,
  Stage8FinalizationDecision,
  VideoType,
} from '@shared/types.js';
import { VideoTypeSchema } from '@shared/schemas.js';
import { z } from 'zod';
import { getStage8FinalizationPreflightWorkspace } from './stage8-finalization-preflight-service.js';

const AUTHORITY_REGISTRY_PATH = 'data/professional-benchmarks/all-format-stage8-release-authority-registry.json';
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmptyStringSchema = z.string().trim().min(1);
const TimestampSchema = z.string().datetime({ offset: true });
const Ed25519SignatureSchema = z.string().refine(value => {
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length === 64 && decoded.toString('base64') === value;
  } catch {
    return false;
  }
}, 'expected canonical base64 Ed25519 signature');

const FinalizationDecisionSchema = z.object({
  schema_version: z.literal('professional-benchmark-finalization-decision/v2'),
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  video_type: VideoTypeSchema,
  eligible_for_signed_release: z.boolean(),
  professional_passed: z.literal(false),
  initial_quality_score: z.number().finite().min(0).max(100),
  final_quality_score: z.number().finite().min(0).max(100),
  verified_quality_improvement: z.number().finite(),
  blockers: z.array(NonEmptyStringSchema),
}).strict();

const ArtifactManifestSchema = z.object({
  schema_version: z.literal('professional-benchmark-release-artifact-manifest/v1'),
  manifest_id: NonEmptyStringSchema,
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  video_type: VideoTypeSchema,
  created_at: TimestampSchema,
  evidence_environment: z.literal('external'),
  immutable: z.literal(true),
  artifact_count: z.number().int().min(12),
  final_package_sha256: HashSchema,
  artifact_validation_record_sha256: HashSchema,
  human_verification_record_sha256: HashSchema,
  artifacts: z.array(z.object({
    artifact_id: NonEmptyStringSchema,
    artifact_type: NonEmptyStringSchema,
    path: NonEmptyStringSchema,
    sha256: HashSchema,
    size_bytes: z.number().int().positive(),
  }).strict()).min(12),
}).strict();

const ReleaseRecordSchema = z.object({
  schema_version: z.literal('professional-benchmark-durable-signed-release/v1'),
  release_id: NonEmptyStringSchema,
  benchmark_id: NonEmptyStringSchema,
  run_id: NonEmptyStringSchema,
  video_type: VideoTypeSchema,
  finalization_decision_sha256: HashSchema,
  artifact_manifest_sha256: HashSchema,
  immutable_artifact_manifest: ArtifactManifestSchema,
  release_authority_id: NonEmptyStringSchema,
  authority_key_id: NonEmptyStringSchema,
  issued_at: TimestampSchema,
  expires_at: TimestampSchema,
  evidence_environment: z.literal('external'),
  is_fixture: z.literal(false),
  is_simulation: z.literal(false),
  professional_passed: z.literal(false),
  release_record_sha256: HashSchema,
  record_signature: z.object({
    schema_version: z.literal('professional-benchmark-durable-release-ed25519-signature/v1'),
    algorithm: z.literal('Ed25519'),
    key_id: NonEmptyStringSchema,
    signed_payload_sha256: HashSchema,
    signature_base64: Ed25519SignatureSchema,
  }).strict(),
}).strict();

const AuthorityRegistrySchema = z.object({
  schema_version: z.literal('professional-benchmark-release-authority-registry/v1'),
  registry_id: NonEmptyStringSchema,
  trust_source: z.literal('external_configuration'),
  evidence_environment: z.literal('external'),
  established_at: TimestampSchema,
  authorities: z.array(z.object({
    authority_id: NonEmptyStringSchema,
    key_id: NonEmptyStringSchema,
    algorithm: z.literal('Ed25519'),
    public_key_spki_pem: NonEmptyStringSchema,
    status: z.enum(['active', 'revoked']),
    allowed_scope: z.literal('durable_professional_benchmark_release'),
    allowed_video_types: z.array(VideoTypeSchema).min(1),
    valid_from: TimestampSchema,
    valid_until: TimestampSchema,
  }).strict()).min(1),
  known_release_ids: z.array(NonEmptyStringSchema),
}).strict();

type AuthorityRegistry = z.infer<typeof AuthorityRegistrySchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

export function computeStage8DurableReleaseSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function releaseRecordContent(record: unknown): Record<string, unknown> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  const content = { ...(record as Record<string, unknown>) };
  delete content.release_record_sha256;
  delete content.record_signature;
  return content;
}

export function createStage8DurableReleaseSignaturePayload(record: unknown): Buffer {
  return Buffer.from(JSON.stringify(canonicalize({
    signature_contract: 'professional-benchmark-durable-signed-release-payload/v1',
    scope: 'durable_professional_benchmark_release',
    payload: releaseRecordContent(record),
  })), 'utf8');
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseJson(raw: unknown): { ok: boolean; value?: unknown } {
  if (typeof raw !== 'string') return { ok: false };
  try { return { ok: true, value: JSON.parse(raw) as unknown }; } catch { return { ok: false }; }
}

function issue(code: string, gate: Stage8DurableReleaseIssue['gate'], pathValue: string, message: string): Stage8DurableReleaseIssue {
  return { code, gate, path: pathValue, message, blocking: true };
}

function uniqueIssues(issues: Stage8DurableReleaseIssue[]): Stage8DurableReleaseIssue[] {
  const seen = new Set<string>();
  return issues.filter(item => {
    const key = `${item.code}:${item.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function timestamp(value: unknown): number {
  return typeof value === 'string' ? Date.parse(value) : Number.NaN;
}

export function evaluateStage8DurableRelease(input: {
  expected: { benchmark_id: string; video_type: VideoType };
  finalizationDecisionRawJson: unknown;
  releaseRecordRawJson: unknown;
  authorityRegistry: unknown;
  now?: string;
}): Stage8DurableReleaseInspectionResult {
  const now = input.now ?? new Date().toISOString();
  const nowMs = timestamp(now);
  const decisionJson = parseJson(input.finalizationDecisionRawJson);
  const releaseJson = parseJson(input.releaseRecordRawJson);
  const decisionParsed = FinalizationDecisionSchema.safeParse(decisionJson.value);
  const releaseParsed = ReleaseRecordSchema.safeParse(releaseJson.value);
  const registryParsed = AuthorityRegistrySchema.safeParse(input.authorityRegistry);
  const decisionRaw = objectValue(decisionJson.value);
  const releaseRaw = objectValue(releaseJson.value);
  const manifestRaw = objectValue(releaseRaw.immutable_artifact_manifest);
  const signatureRaw = objectValue(releaseRaw.record_signature);
  const issues: Stage8DurableReleaseIssue[] = [];
  const requestValid = typeof input.finalizationDecisionRawJson === 'string' && typeof input.releaseRecordRawJson === 'string';

  if (!requestValid) issues.push(issue('request_invalid', 'json', '$', '请求必须包含finalization decision与release record两个JSON字符串'));
  if (!decisionJson.ok) issues.push(issue('finalization_decision_json_invalid', 'json', '$.finalization_decision_raw_json', 'finalization decision不是有效JSON'));
  if (!releaseJson.ok) issues.push(issue('release_record_json_invalid', 'json', '$.release_record_raw_json', 'durable release record不是有效JSON'));
  if (!decisionParsed.success) {
    issues.push(issue('finalization_decision_schema_invalid', 'schema', '$.finalization_decision', 'finalization decision v2 schema未通过'));
    for (const item of decisionParsed.error.issues) issues.push(issue(`decision_schema:${item.path.join('.')}:${item.code}`, 'schema', `$.finalization_decision.${item.path.join('.')}`, item.message));
  }
  if (!releaseParsed.success) {
    issues.push(issue('release_record_schema_invalid', 'schema', '$.release_record', 'durable signed-release record schema未通过'));
    for (const item of releaseParsed.error.issues) issues.push(issue(`release_schema:${item.path.join('.')}:${item.code}`, 'schema', `$.release_record.${item.path.join('.')}`, item.message));
  }
  if (!registryParsed.success) issues.push(issue('release_authority_registry_invalid_or_empty', 'authority', '$.authority_registry', '仓库侧外部authority registry无有效发布权限'));

  const decision = decisionParsed.success ? decisionParsed.data : undefined;
  const release = releaseParsed.success ? releaseParsed.data : undefined;
  const registry = registryParsed.success ? registryParsed.data : undefined;
  const canonicalDecisionSha256 = decisionJson.ok ? computeStage8DurableReleaseSha256(decisionJson.value) : '';
  const canonicalManifestSha256 = releaseJson.ok && Object.keys(manifestRaw).length > 0 ? computeStage8DurableReleaseSha256(manifestRaw) : '';
  const canonicalReleaseSha256 = releaseJson.ok ? computeStage8DurableReleaseSha256(releaseRecordContent(releaseJson.value)) : '';
  const signaturePayload = createStage8DurableReleaseSignaturePayload(releaseJson.value);
  const canonicalSignaturePayloadSha256 = createHash('sha256').update(signaturePayload).digest('hex');

  const decisionQualityGateValid = Boolean(decision
    && decision.final_quality_score >= 85
    && decision.verified_quality_improvement > 0
    && Math.abs((decision.final_quality_score - decision.initial_quality_score) - decision.verified_quality_improvement) <= 0.001);
  if (!decisionQualityGateValid) issues.push(issue('finalization_decision_quality_gate_invalid', 'decision', '$.finalization_decision', 'decision分数、正向增量或增量算术不一致'));
  const candidateEligible = Boolean(decisionQualityGateValid
    && decision?.eligible_for_signed_release
    && decision.blockers.length === 1
    && decision.blockers[0] === 'signed_release_record_missing');
  if (!candidateEligible) issues.push(issue('finalization_candidate_not_eligible', 'decision', '$.finalization_decision', 'decision尚未形成仅缺durable release的candidate'));

  const benchmarkBindingValid = Boolean(decision && release
    && decision.benchmark_id === input.expected.benchmark_id
    && release.benchmark_id === input.expected.benchmark_id);
  const runIdBindingValid = Boolean(decision && release && decision.run_id === release.run_id);
  const videoTypeBindingValid = Boolean(decision && release
    && decision.video_type === input.expected.video_type
    && release.video_type === input.expected.video_type);
  if (!benchmarkBindingValid) issues.push(issue('benchmark_identity_drift', 'identity', '$.release_record.benchmark_id', 'benchmark绑定漂移'));
  if (!runIdBindingValid) issues.push(issue('run_id_identity_drift', 'identity', '$.release_record.run_id', 'run ID绑定漂移'));
  if (!videoTypeBindingValid) issues.push(issue('video_type_identity_drift', 'identity', '$.release_record.video_type', 'video type绑定漂移'));

  const decisionDigestBindingValid = Boolean(release && release.finalization_decision_sha256 === canonicalDecisionSha256);
  const manifestDigestValid = Boolean(release && release.artifact_manifest_sha256 === canonicalManifestSha256);
  const manifestIdentityValid = Boolean(release
    && release.immutable_artifact_manifest.benchmark_id === release.benchmark_id
    && release.immutable_artifact_manifest.run_id === release.run_id
    && release.immutable_artifact_manifest.video_type === release.video_type);
  const manifestIds = release?.immutable_artifact_manifest.artifacts.map(item => item.artifact_id) ?? [];
  const manifestPaths = release?.immutable_artifact_manifest.artifacts.map(item => item.path) ?? [];
  const manifestHashes = release?.immutable_artifact_manifest.artifacts.map(item => item.sha256) ?? [];
  const manifestImmutableShapeValid = Boolean(release
    && release.immutable_artifact_manifest.immutable
    && release.immutable_artifact_manifest.artifact_count === release.immutable_artifact_manifest.artifacts.length
    && release.immutable_artifact_manifest.artifacts.length >= 12
    && new Set(manifestIds).size === manifestIds.length
    && new Set(manifestPaths).size === manifestPaths.length
    && release.release_record_sha256 === canonicalReleaseSha256);
  const requiredManifestHashes = release ? [
    release.immutable_artifact_manifest.final_package_sha256,
    release.immutable_artifact_manifest.artifact_validation_record_sha256,
    release.immutable_artifact_manifest.human_verification_record_sha256,
  ] : [];
  const manifestRequiredRecordsBound = Boolean(release
    && new Set(requiredManifestHashes).size === 3
    && requiredManifestHashes.every(sha256 => manifestHashes.includes(sha256)));
  if (!decisionDigestBindingValid) issues.push(issue('finalization_decision_digest_mismatch', 'decision', '$.release_record.finalization_decision_sha256', 'release未绑定当前candidate decision SHA-256'));
  if (!manifestDigestValid) issues.push(issue('artifact_manifest_digest_mismatch', 'manifest', '$.release_record.artifact_manifest_sha256', '不可变artifact manifest SHA-256不一致'));
  if (!manifestIdentityValid) issues.push(issue('artifact_manifest_identity_drift', 'manifest', '$.release_record.immutable_artifact_manifest', 'artifact manifest身份绑定漂移'));
  if (!manifestImmutableShapeValid) issues.push(issue('artifact_manifest_not_immutable_or_complete', 'manifest', '$.release_record.immutable_artifact_manifest', 'artifact manifest数量、唯一ID或record digest未通过'));
  if (!manifestRequiredRecordsBound) issues.push(issue('artifact_manifest_required_records_unbound', 'manifest', '$.release_record.immutable_artifact_manifest.artifacts', '终稿、artifact validation与人审verification摘要必须分别绑定清单内文件'));

  const registryExternal = Boolean(registry
    && registry.trust_source === 'external_configuration'
    && registry.evidence_environment === 'external');
  const authorityIds = registry?.authorities.map(item => item.authority_id) ?? [];
  const authorityKeyIds = registry?.authorities.map(item => item.key_id) ?? [];
  const registryUnique = new Set(authorityIds).size === authorityIds.length && new Set(authorityKeyIds).size === authorityKeyIds.length;
  if (!registryUnique) issues.push(issue('release_authority_registry_identity_duplicate', 'authority', '$.authority_registry.authorities', 'authority ID或key ID重复'));
  const authority = registry && release
    ? registry.authorities.find(item => item.authority_id === release.release_authority_id && item.key_id === release.authority_key_id)
    : undefined;
  const authorityBindingValid = Boolean(authority && release
    && release.record_signature.key_id === release.authority_key_id
    && authority.algorithm === 'Ed25519'
    && authority.allowed_scope === 'durable_professional_benchmark_release'
    && authority.allowed_video_types.includes(release.video_type));
  const authorityKeyTrusted = Boolean(authorityBindingValid && authority?.status === 'active');
  if (!registryExternal) issues.push(issue('release_authority_registry_not_external', 'authority', '$.authority_registry', 'authority registry必须来自外部配置'));
  if (!authorityBindingValid) issues.push(issue('release_authority_binding_invalid', 'authority', '$.release_record.release_authority_id', '发布权限、key、scope或video type绑定无效'));
  if (!authorityKeyTrusted) issues.push(issue(authority?.status === 'revoked' ? 'release_authority_key_revoked' : 'release_authority_key_not_trusted', 'authority', '$.release_record.authority_key_id', '发布key未处于可信active状态'));

  const releaseIdUnique = Boolean(release && registry && registryUnique
    && !registry.known_release_ids.includes(release.release_id));
  if (!releaseIdUnique) issues.push(issue('duplicate_release_id_rejected', 'duplicate', '$.release_record.release_id', 'release ID已存在或无法由外部registry证明唯一'));

  const issuedAtMs = release ? timestamp(release.issued_at) : Number.NaN;
  const expiresAtMs = release ? timestamp(release.expires_at) : Number.NaN;
  const authorityFromMs = authority ? timestamp(authority.valid_from) : Number.NaN;
  const authorityUntilMs = authority ? timestamp(authority.valid_until) : Number.NaN;
  const issuedAtValid = Boolean(release && authority
    && Number.isFinite(nowMs) && Number.isFinite(issuedAtMs)
    && issuedAtMs <= nowMs
    && issuedAtMs >= authorityFromMs
    && issuedAtMs <= authorityUntilMs);
  const expiresAtValid = Boolean(release && authority
    && Number.isFinite(nowMs) && Number.isFinite(expiresAtMs)
    && expiresAtMs > issuedAtMs
    && expiresAtMs > nowMs
    && expiresAtMs <= authorityUntilMs);
  if (!issuedAtValid) issues.push(issue('release_issued_at_invalid_or_future', 'time', '$.release_record.issued_at', '签发时间在未来或超出authority有效期'));
  if (!expiresAtValid) issues.push(issue('release_expired_or_invalid_expiry', 'time', '$.release_record.expires_at', 'release已过期或到期时间无效'));

  const signaturePayloadDigestValid = Boolean(release
    && release.record_signature.signed_payload_sha256 === canonicalSignaturePayloadSha256);
  if (!signaturePayloadDigestValid) issues.push(issue('release_signature_payload_digest_mismatch', 'signature', '$.release_record.record_signature.signed_payload_sha256', '签名payload SHA-256不一致'));
  let cryptographicSignatureValid = false;
  if (release && authorityKeyTrusted && signaturePayloadDigestValid) {
    try {
      const publicKey = createPublicKey(authority!.public_key_spki_pem);
      cryptographicSignatureValid = publicKey.asymmetricKeyType === 'ed25519'
        && verifySignature(null, signaturePayload, publicKey, Buffer.from(release.record_signature.signature_base64, 'base64'));
    } catch {
      cryptographicSignatureValid = false;
    }
  }
  if (!cryptographicSignatureValid) issues.push(issue('release_signature_verification_failed', 'signature', '$.release_record.record_signature.signature_base64', 'Ed25519签名未通过'));

  const sourceClaimedCreditRejected = decisionRaw.professional_passed !== true && releaseRaw.professional_passed !== true;
  if (!sourceClaimedCreditRejected) issues.push(issue('source_claimed_professional_credit_rejected', 'credit', '$.professional_passed', '请求自报professional pass被拒绝'));

  const checks = {
    request_valid: requestValid,
    finalization_decision_json_valid: decisionJson.ok,
    finalization_decision_schema_valid: decisionParsed.success,
    finalization_decision_quality_gate_valid: decisionQualityGateValid,
    finalization_candidate_eligible: candidateEligible,
    release_record_json_valid: releaseJson.ok,
    release_record_schema_valid: releaseParsed.success,
    benchmark_binding_valid: benchmarkBindingValid,
    run_id_binding_valid: runIdBindingValid,
    video_type_binding_valid: videoTypeBindingValid,
    finalization_decision_digest_binding_valid: decisionDigestBindingValid,
    artifact_manifest_digest_valid: manifestDigestValid,
    artifact_manifest_identity_valid: manifestIdentityValid,
    artifact_manifest_immutable_shape_valid: manifestImmutableShapeValid,
    artifact_manifest_required_records_bound: manifestRequiredRecordsBound,
    authority_registry_schema_valid: registryParsed.success && registryUnique,
    authority_registry_is_external: registryExternal,
    authority_binding_valid: authorityBindingValid,
    authority_key_trusted: authorityKeyTrusted,
    release_id_unique: releaseIdUnique,
    issued_at_valid: issuedAtValid,
    expires_at_valid: expiresAtValid,
    signature_payload_digest_valid: signaturePayloadDigestValid,
    cryptographic_signature_valid: cryptographicSignatureValid,
    source_claimed_credit_rejected: sourceClaimedCreditRejected,
  };
  return {
    schema_version: 'story-agent-stage8-durable-release-inspection/v1', generated_at: now, dry_run_only: true,
    release_record_created: false, release_record_imported: false, release_record_persisted: false, professional_passed: false,
    verification_ready: Object.values(checks).every(Boolean), expected_binding: input.expected,
    canonical_finalization_decision_sha256: canonicalDecisionSha256,
    canonical_artifact_manifest_sha256: canonicalManifestSha256,
    canonical_release_record_sha256: canonicalReleaseSha256,
    canonical_signature_payload_sha256: canonicalSignaturePayloadSha256,
    checks,
    summary: {
      artifact_count: release?.immutable_artifact_manifest.artifacts.length ?? 0,
      trusted_authority_count: registry?.authorities.filter(item => item.status === 'active').length ?? 0,
      known_release_id_count: registry?.known_release_ids.length ?? 0,
      duplicate_release_id: !releaseIdUnique,
      cryptographically_verified_signature_count: cryptographicSignatureValid ? 1 : 0,
      durable_signed_release_credit_count: 0,
      professional_pass_count: 0,
    },
    issues: uniqueIssues(issues),
  };
}

async function readRepositoryJson(repoRoot: string, relativePath: string): Promise<unknown> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage8_durable_release_path_outside_repository');
  return JSON.parse(await readFile(resolved, 'utf8')) as unknown;
}

function preparationRecord(benchmarkId: string, videoType: VideoType, decision: Stage8FinalizationDecision): unknown {
  return {
    schema_version: 'professional-benchmark-durable-signed-release/v1', release_id: '', benchmark_id: benchmarkId,
    run_id: decision.run_id, video_type: videoType, finalization_decision_sha256: computeStage8DurableReleaseSha256(decision), artifact_manifest_sha256: '',
    immutable_artifact_manifest: { schema_version: 'professional-benchmark-release-artifact-manifest/v1', manifest_id: '', benchmark_id: benchmarkId,
      run_id: decision.run_id, video_type: videoType, created_at: '', evidence_environment: 'local', immutable: true, artifact_count: 0,
      final_package_sha256: '', artifact_validation_record_sha256: '', human_verification_record_sha256: '', artifacts: [] },
    release_authority_id: '', authority_key_id: '', issued_at: '', expires_at: '', evidence_environment: 'local', is_fixture: true,
    is_simulation: false, professional_passed: false, release_record_sha256: '', record_signature: {
      schema_version: 'professional-benchmark-durable-release-ed25519-signature/v1', algorithm: 'Ed25519', key_id: '', signed_payload_sha256: '', signature_base64: '',
    },
  };
}

export async function getStage8DurableReleaseWorkspace(input: { repoRoot: string; benchmarkId?: unknown; now?: string }): Promise<Stage8DurableReleaseWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const [finalizationWorkspace, registryValue] = await Promise.all([
    getStage8FinalizationPreflightWorkspace({ repoRoot: input.repoRoot, benchmarkId: input.benchmarkId, now }),
    readRepositoryJson(input.repoRoot, AUTHORITY_REGISTRY_PATH),
  ]);
  const registry = objectValue(registryValue);
  const authorities = Array.isArray(registry.authorities) ? registry.authorities.map(objectValue) : [];
  const knownReleaseIds = Array.isArray(registry.known_release_ids) ? registry.known_release_ids : [];
  const projects = finalizationWorkspace.projects.map(project => ({
    benchmark_id: project.benchmark_id, video_type: project.video_type, source_entry: project.source_entry,
    status: 'blocked_missing_finalization_candidate_and_external_release' as const,
    durable_signed_release_imported: false as const, professional_passed: false as const,
  }));
  const requested = typeof input.benchmarkId === 'string' ? input.benchmarkId : '';
  const selected = projects.find(project => project.benchmark_id === requested) ?? projects[0];
  const selectedFinalization = await getStage8FinalizationPreflightWorkspace({ repoRoot: input.repoRoot, benchmarkId: selected.benchmark_id, now });
  const decision = selectedFinalization.template_preflight.decision;
  const releaseRecord = preparationRecord(selected.benchmark_id, selected.video_type, decision);
  const decisionRaw = `${JSON.stringify(decision, null, 2)}\n`;
  const releaseRaw = `${JSON.stringify(releaseRecord, null, 2)}\n`;
  const activeAuthorityCount = authorities.filter(item => item.status === 'active').length;
  return {
    schema_version: 'story-agent-stage8-durable-release-workspace/v1', generated_at: now,
    policy: { read_only: true, authority_registry_is_repository_controlled: true, request_supplied_authority_is_trusted: false,
      verification_is_release_creation: false, verification_is_durable_import: false,
      fixture_simulation_prepared_counts_as_signed_release: false, professional_pass_can_be_granted: false },
    summary: { project_count: 75, finalization_candidate_ready_project_count: 0, active_release_authority_count: activeAuthorityCount,
      release_record_verification_ready_project_count: 0, durable_signed_release_imported_count: 0, professional_pass_count: 0 },
    authority_registry: { registry_id: typeof registry.registry_id === 'string' ? registry.registry_id : '',
      status: activeAuthorityCount > 0 ? 'active' : 'preparation_template', active_authority_count: activeAuthorityCount,
      known_release_id_count: knownReleaseIds.length },
    projects, selected_benchmark_id: selected.benchmark_id, finalization_decision_template: decision,
    finalization_decision_template_raw_json: decisionRaw, release_record_template: releaseRecord, release_record_template_raw_json: releaseRaw,
    template_inspection: evaluateStage8DurableRelease({ expected: { benchmark_id: selected.benchmark_id, video_type: selected.video_type },
      finalizationDecisionRawJson: decisionRaw, releaseRecordRawJson: releaseRaw, authorityRegistry: registryValue, now }),
  };
}

export async function inspectStage8DurableRelease(input: { repoRoot: string; request: unknown; now?: string }): Promise<Stage8DurableReleaseInspectionResult> {
  const request = objectValue(input.request);
  const [workspace, registry] = await Promise.all([
    getStage8DurableReleaseWorkspace({ repoRoot: input.repoRoot, benchmarkId: request.expected_benchmark_id, now: input.now }),
    readRepositoryJson(input.repoRoot, AUTHORITY_REGISTRY_PATH),
  ]);
  const selected = workspace.projects.find(project => project.benchmark_id === workspace.selected_benchmark_id)!;
  return evaluateStage8DurableRelease({ expected: { benchmark_id: selected.benchmark_id, video_type: selected.video_type },
    finalizationDecisionRawJson: request.finalization_decision_raw_json, releaseRecordRawJson: request.release_record_raw_json,
    authorityRegistry: registry, now: input.now });
}

export type Stage8ReleaseAuthorityRegistry = AuthorityRegistry;
