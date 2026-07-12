import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  VIDEO_TYPE_CONFIG,
  type Stage7GoldenCardReviewerRole,
  type Stage7GoldenCardReviewInspectionResult,
  type Stage7GoldenCardReviewIssue,
  type Stage7GoldenCardReviewWorkspace,
  type VideoType,
} from '@shared/types.js';

const INDEX_PATH = 'data/production-cards/golden-card-unified-index.json';
const REVIEWER_ROLES = [
  'source_reviewer',
  'authorization_reviewer',
  'type_director',
  'fact_reviewer',
  'ethics_reviewer',
  'local_culture_reviewer',
] as const;
const NonEmptyString = z.string().trim().min(1);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Timestamp = z.string().datetime({ offset: true });
const ReviewerRole = z.enum(REVIEWER_ROLES);
const Decision = z.enum(['pending_review', 'approve', 'request_changes', 'reject']);

export const Stage7GoldenCardReviewIntakeSchema = z.object({
  schema_version: z.literal('story-agent-stage7-golden-card-review-intake/v1'),
  review_id: z.string(),
  card_id: NonEmptyString,
  video_type: z.custom<VideoType>(value => typeof value === 'string' && value in VIDEO_TYPE_CONFIG),
  source_card_file: NonEmptyString,
  source_card_file_sha256: Hash,
  card_payload_sha256: Hash,
  overall_decision: Decision,
  reviews: z.array(z.object({
    reviewer_id: NonEmptyString,
    display_name: NonEmptyString,
    organization: NonEmptyString,
    identity_verified: z.literal(true),
    authorization_reference: NonEmptyString,
    role: ReviewerRole,
    decision: z.enum(['approve', 'request_changes', 'reject']),
    reviewed_at: Timestamp,
    evidence_refs: z.array(NonEmptyString).min(1),
    review_note: NonEmptyString,
  }).strict()),
  human_approved: z.literal(false),
  golden_card_promoted: z.literal(false),
  professional_passed: z.literal(false),
}).strict();

export type Stage7GoldenCardReviewIntake = z.infer<typeof Stage7GoldenCardReviewIntakeSchema>;

interface GoldenCardContext {
  cardId: string;
  videoType: VideoType;
  entryName: string;
  province: string;
  sourceCardFile: string;
  sourceCardFileSha256: string;
  cardPayloadSha256: string;
  riskTier: 'p0' | 'p1' | 'p2';
  reviewStatus: string;
  requiredRoles: Stage7GoldenCardReviewerRole[];
}

function requiredRoles(riskTier: GoldenCardContext['riskTier']): Stage7GoldenCardReviewerRole[] {
  if (riskTier === 'p0') return ['fact_reviewer', 'ethics_reviewer', 'type_director'];
  if (riskTier === 'p1') return ['fact_reviewer', 'local_culture_reviewer', 'type_director'];
  return ['source_reviewer', 'authorization_reviewer', 'type_director'];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

export function stage7GoldenCardCanonicalSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function pushIssue(issues: Stage7GoldenCardReviewIssue[], issue: Stage7GoldenCardReviewIssue): void {
  if (!issues.some(item => item.code === issue.code && item.path === issue.path)) issues.push(issue);
}

function sourceClaims(raw: unknown): { humanApproval: boolean; promotion: boolean; professionalPass: boolean } {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    humanApproval: value.human_approved === true,
    promotion: value.golden_card_promoted === true,
    professionalPass: value.professional_passed === true,
  };
}

export function evaluateStage7GoldenCardReview(input: {
  rawJson: string;
  card: GoldenCardContext;
  cardFound?: boolean;
  now?: string;
}): Stage7GoldenCardReviewInspectionResult {
  const now = input.now ?? new Date().toISOString();
  let raw: unknown;
  let jsonValid = false;
  try {
    raw = JSON.parse(input.rawJson) as unknown;
    jsonValid = true;
  } catch {
    raw = undefined;
  }
  const claims = sourceClaims(raw);
  const parsed = Stage7GoldenCardReviewIntakeSchema.safeParse(raw);
  const value = parsed.success ? parsed.data : null;
  const reviews = value?.reviews ?? [];
  const roleCounts = new Map<Stage7GoldenCardReviewerRole, number>();
  for (const review of reviews) roleCounts.set(review.role, (roleCounts.get(review.role) ?? 0) + 1);
  const matchedRoleCount = input.card.requiredRoles.filter(role => roleCounts.get(role) === 1).length;
  const checks: Stage7GoldenCardReviewInspectionResult['checks'] = {
    request_valid: Boolean(input.rawJson && input.card.cardId),
    json_valid: jsonValid,
    intake_schema_valid: parsed.success,
    card_found_in_index: input.cardFound ?? true,
    card_pending_human_review: input.card.reviewStatus === 'pending_human_review',
    card_id_binding_valid: value?.card_id === input.card.cardId,
    video_type_binding_valid: value?.video_type === input.card.videoType,
    source_file_binding_valid: value?.source_card_file === input.card.sourceCardFile,
    source_file_digest_valid: value?.source_card_file_sha256 === input.card.sourceCardFileSha256,
    card_payload_digest_valid: value?.card_payload_sha256 === input.card.cardPayloadSha256,
    review_decision_recorded: Boolean(value && value.review_id.trim() && value.overall_decision !== 'pending_review'),
    reviewer_roles_complete: reviews.length === input.card.requiredRoles.length
      && matchedRoleCount === input.card.requiredRoles.length,
    reviewer_identities_verified: reviews.length > 0 && reviews.every(review => review.identity_verified),
    review_timestamps_valid: reviews.length > 0 && reviews.every(review => Number.isFinite(Date.parse(review.reviewed_at))),
    evidence_refs_present: reviews.length > 0 && reviews.every(review => review.evidence_refs.length > 0),
    review_notes_present: reviews.length > 0 && reviews.every(review => review.review_note.trim().length > 0),
    unanimous_role_approval: Boolean(value && value.overall_decision === 'approve'
      && reviews.length === input.card.requiredRoles.length
      && reviews.every(review => review.decision === 'approve')),
    source_claimed_credit_rejected: !claims.humanApproval && !claims.promotion && !claims.professionalPass,
  };
  const issues: Stage7GoldenCardReviewIssue[] = [];
  if (!checks.json_valid) pushIssue(issues, { code: 'golden_card_review_json_invalid', path: 'raw_json', gate: 'schema', blocking: true, message: 'Review intake must be valid JSON.' });
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 50)) pushIssue(issues, { code: 'golden_card_review_schema_invalid', path: issue.path.join('.'), gate: 'schema', blocking: true, message: issue.message });
  }
  const gates: Array<[keyof typeof checks, string, Stage7GoldenCardReviewIssue['gate'], string, string]> = [
    ['card_found_in_index', 'golden_card_not_found_in_index', 'binding', 'card_id', 'Card must exist in the frozen unified index.'],
    ['card_pending_human_review', 'golden_card_not_pending_human_review', 'binding', 'card_id', 'Only pending human-review candidates can enter this intake.'],
    ['card_id_binding_valid', 'golden_card_id_binding_mismatch', 'binding', 'card_id', 'card_id does not match the selected indexed card.'],
    ['video_type_binding_valid', 'golden_card_video_type_binding_mismatch', 'binding', 'video_type', 'video_type does not match the indexed card.'],
    ['source_file_binding_valid', 'golden_card_source_file_binding_mismatch', 'binding', 'source_card_file', 'source_card_file does not match the index.'],
    ['source_file_digest_valid', 'golden_card_source_file_digest_mismatch', 'binding', 'source_card_file_sha256', 'Source card file SHA-256 does not match current repository content.'],
    ['card_payload_digest_valid', 'golden_card_payload_digest_mismatch', 'binding', 'card_payload_sha256', 'Canonical card payload SHA-256 does not match current card content.'],
    ['review_decision_recorded', 'golden_card_review_decision_missing', 'decision', 'overall_decision', 'A non-pending overall decision and review_id are required.'],
    ['reviewer_roles_complete', 'golden_card_required_review_roles_missing', 'reviewer', 'reviews', 'Exactly one verified review is required for every risk-tier role.'],
    ['reviewer_identities_verified', 'golden_card_reviewer_identity_unverified', 'reviewer', 'reviews', 'All reviewer identities must be externally verified.'],
    ['review_timestamps_valid', 'golden_card_review_timestamp_invalid', 'reviewer', 'reviews', 'All reviews require valid externally recorded timestamps.'],
    ['evidence_refs_present', 'golden_card_review_evidence_missing', 'evidence', 'reviews', 'Every reviewer must cite at least one evidence reference.'],
    ['review_notes_present', 'golden_card_review_note_missing', 'evidence', 'reviews', 'Every reviewer must provide a substantive review note.'],
    ['unanimous_role_approval', 'golden_card_unanimous_role_approval_required', 'decision', 'reviews', 'Approval preflight requires unanimous approval from the required roles.'],
    ['source_claimed_credit_rejected', 'golden_card_self_reported_credit_rejected', 'credit', 'human_approved', 'Input cannot grant human approval, promotion, or professional pass.'],
  ];
  for (const [key, code, gate, issuePath, message] of gates) {
    if (!checks[key]) pushIssue(issues, { code, path: issuePath, gate, blocking: true, message });
  }
  return {
    schema_version: 'story-agent-stage7-golden-card-review-inspection/v1',
    generated_at: now,
    dry_run_only: true,
    review_record_persisted: false,
    source_card_modified: false,
    province_markdown_modified: false,
    human_approval_granted: false,
    golden_card_promoted: false,
    professional_passed: false,
    approval_preflight_ready: Object.values(checks).every(Boolean),
    source_file_sha256: input.card.sourceCardFileSha256,
    canonical_card_payload_sha256: input.card.cardPayloadSha256,
    expected_binding: {
      card_id: input.card.cardId,
      video_type: input.card.videoType,
      source_card_file: input.card.sourceCardFile,
      risk_tier: input.card.riskTier,
      required_roles: input.card.requiredRoles,
    },
    checks,
    review_summary: {
      review_count: reviews.length,
      required_role_count: input.card.requiredRoles.length,
      matched_required_role_count: matchedRoleCount,
      verified_identity_count: reviews.filter(review => review.identity_verified).length,
      approving_role_count: reviews.filter(review => review.decision === 'approve').length,
      evidence_reference_count: reviews.reduce((sum, review) => sum + review.evidence_refs.length, 0),
      source_claimed_human_approval: claims.humanApproval,
      source_claimed_golden_card_promotion: claims.promotion,
      source_claimed_professional_pass: claims.professionalPass,
    },
    issues,
  };
}

async function readRepositoryFile(repoRoot: string, relativePath: string): Promise<{ raw: string; value: unknown }> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage7_golden_card_path_outside_repository');
  const raw = await readFile(resolved, 'utf8');
  return { raw, value: JSON.parse(raw) as unknown };
}

async function loadCatalog(repoRoot: string): Promise<GoldenCardContext[]> {
  const indexFile = await readRepositoryFile(repoRoot, INDEX_PATH);
  const index = indexFile.value as Record<string, unknown>;
  const reviewIndex = Array.isArray(index.review_index) ? index.review_index : [];
  const fileCache = new Map<string, Awaited<ReturnType<typeof readRepositoryFile>>>();
  const contexts: GoldenCardContext[] = [];
  for (const rawItem of reviewIndex) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue;
    const item = rawItem as Record<string, unknown>;
    const sourceCardFile = String(item.source_card_file ?? '');
    let source = fileCache.get(sourceCardFile);
    if (!source) {
      source = await readRepositoryFile(repoRoot, sourceCardFile);
      fileCache.set(sourceCardFile, source);
    }
    const sourceValue = source.value as Record<string, unknown>;
    const cards = Array.isArray(sourceValue.cards) ? sourceValue.cards : [];
    const card = cards.find(candidate => candidate && typeof candidate === 'object'
      && !Array.isArray(candidate) && (candidate as Record<string, unknown>).card_id === item.card_id);
    if (!card) throw new Error(`stage7_golden_card_source_payload_missing:${String(item.card_id ?? '')}`);
    const videoType = String(item.video_type ?? '') as VideoType;
    if (!(videoType in VIDEO_TYPE_CONFIG)) throw new Error(`stage7_golden_card_video_type_invalid:${videoType}`);
    const riskTier = String(item.risk_tier ?? '') as GoldenCardContext['riskTier'];
    if (!['p0', 'p1', 'p2'].includes(riskTier)) throw new Error(`stage7_golden_card_risk_tier_invalid:${riskTier}`);
    contexts.push({
      cardId: String(item.card_id ?? ''),
      videoType,
      entryName: String(item.entry_name ?? ''),
      province: String(item.province ?? ''),
      sourceCardFile,
      sourceCardFileSha256: createHash('sha256').update(source.raw, 'utf8').digest('hex'),
      cardPayloadSha256: stage7GoldenCardCanonicalSha256(card),
      riskTier,
      reviewStatus: String(item.review_status ?? ''),
      requiredRoles: requiredRoles(riskTier),
    });
  }
  return contexts;
}

function reviewTemplate(card: GoldenCardContext): Stage7GoldenCardReviewIntake {
  return {
    schema_version: 'story-agent-stage7-golden-card-review-intake/v1',
    review_id: '',
    card_id: card.cardId,
    video_type: card.videoType,
    source_card_file: card.sourceCardFile,
    source_card_file_sha256: card.sourceCardFileSha256,
    card_payload_sha256: card.cardPayloadSha256,
    overall_decision: 'pending_review',
    reviews: [],
    human_approved: false,
    golden_card_promoted: false,
    professional_passed: false,
  };
}

export async function inspectStage7GoldenCardReview(input: {
  repoRoot: string;
  request: unknown;
  now?: string;
}): Promise<Stage7GoldenCardReviewInspectionResult> {
  const request = input.request && typeof input.request === 'object' && !Array.isArray(input.request)
    ? input.request as Record<string, unknown> : {};
  const rawJson = typeof request.raw_json === 'string' ? request.raw_json : '';
  const expectedCardId = typeof request.expected_card_id === 'string' ? request.expected_card_id : '';
  const cards = await loadCatalog(input.repoRoot);
  const card = cards.find(item => item.cardId === expectedCardId) ?? cards[0];
  return evaluateStage7GoldenCardReview({ rawJson, card, cardFound: cards.some(item => item.cardId === expectedCardId), now: input.now });
}

export async function getStage7GoldenCardReviewWorkspace(input: {
  repoRoot: string;
  cardId?: unknown;
  now?: string;
}): Promise<Stage7GoldenCardReviewWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const cards = await loadCatalog(input.repoRoot);
  if (cards.length === 0) throw new Error('stage7_golden_card_index_empty');
  const selectedId = typeof input.cardId === 'string' ? input.cardId : '';
  const selected = cards.find(card => card.cardId === selectedId) ?? cards[0];
  const template = reviewTemplate(selected);
  const templateRawJson = `${JSON.stringify(template, null, 2)}\n`;
  const videoTypes = (Object.keys(VIDEO_TYPE_CONFIG) as VideoType[]).map(videoType => {
    const candidates = cards.filter(card => card.videoType === videoType);
    return {
      video_type: videoType,
      label: VIDEO_TYPE_CONFIG[videoType].label,
      target_card_count: 5 as const,
      indexed_candidate_card_count: candidates.length,
      pending_human_review_card_count: candidates.filter(card => card.reviewStatus === 'pending_human_review').length,
      human_approved_card_count: 0 as const,
      missing_target_card_count: Math.max(0, 5 - candidates.length),
      coverage_status: candidates.length > 0 ? 'candidate_coverage_present' as const : 'missing_candidates' as const,
    };
  });
  return {
    schema_version: 'story-agent-stage7-golden-card-review-workspace/v1',
    generated_at: now,
    policy: {
      dry_run_only: true,
      review_records_are_not_persisted: true,
      source_cards_are_not_modified: true,
      province_markdown_is_not_modified: true,
      approval_preflight_is_human_approval: false,
      pending_or_fixture_counts_as_approved: false,
      professional_pass_can_be_granted: false,
    },
    summary: {
      target_video_type_count: 15,
      target_human_approved_card_count: 75,
      indexed_candidate_card_count: cards.length,
      candidate_video_type_count: videoTypes.filter(item => item.indexed_candidate_card_count > 0).length,
      missing_video_type_count: videoTypes.filter(item => item.indexed_candidate_card_count === 0).length,
      missing_target_card_count: videoTypes.reduce((sum, item) => sum + item.missing_target_card_count, 0),
      pending_human_review_card_count: cards.filter(card => card.reviewStatus === 'pending_human_review').length,
      approval_preflight_ready_card_count: 0,
      human_approved_card_count: 0,
      promoted_golden_card_count: 0,
      professional_pass_count: 0,
    },
    video_types: videoTypes,
    cards: cards.map(card => ({
      card_id: card.cardId,
      video_type: card.videoType,
      entry_name: card.entryName,
      province: card.province,
      source_card_file: card.sourceCardFile,
      risk_tier: card.riskTier,
      review_status: card.reviewStatus,
      required_roles: card.requiredRoles,
      approval_preflight_ready: false,
      human_approved: false,
    })),
    selected_card_id: selected.cardId,
    template,
    template_raw_json: templateRawJson,
    template_inspection: evaluateStage7GoldenCardReview({ rawJson: templateRawJson, card: selected, now }),
  };
}
