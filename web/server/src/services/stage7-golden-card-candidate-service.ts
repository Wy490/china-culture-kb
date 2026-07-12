import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  VIDEO_TYPE_CONFIG,
  type Stage7GoldenCardCandidateInspectionResult,
  type Stage7GoldenCardCandidateIssue,
  type Stage7GoldenCardCandidateWorkspace,
  type VideoType,
} from '@shared/types.js';
import { getGenreStoryProfile } from './genre-story-profiles.js';
import { stage7GoldenCardCanonicalSha256 } from './stage7-golden-card-review-service.js';

const INDEX_PATH = 'data/production-cards/golden-card-unified-index.json';
const BENCHMARK_FILES: Partial<Record<VideoType, string>> = {
  character_story: 'data/professional-benchmarks/character-story-iteration3-benchmark-specs.json',
  historical_drama: 'data/professional-benchmarks/historical-drama-iteration4-benchmark-specs.json',
  legend_story: 'data/professional-benchmarks/legend-story-iteration5-benchmark-specs.json',
  children_story: 'data/professional-benchmarks/children-story-iteration6-benchmark-specs.json',
  culture_promo: 'data/professional-benchmarks/culture-promo-stage3-iteration1-benchmark-specs.json',
  city_brand_promo: 'data/professional-benchmarks/city-brand-promo-stage3-iteration3-benchmark-specs.json',
  social_short: 'data/professional-benchmarks/social-short-stage3-iteration4-benchmark-specs.json',
  explainer_video: 'data/professional-benchmarks/explainer-video-stage4-iteration2-benchmark-specs.json',
  lecture_video: 'data/professional-benchmarks/lecture-video-stage4-iteration3-benchmark-specs.json',
  education_training: 'data/professional-benchmarks/education-training-stage4-iteration4-benchmark-specs.json',
  scene_short: 'data/professional-benchmarks/scene-short-stage5-iteration1-benchmark-specs.json',
  landscape_mood: 'data/professional-benchmarks/landscape-mood-stage5-iteration2-benchmark-specs.json',
};
const NonEmptyString = z.string().trim().min(1);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);

export const Stage7GoldenCardCandidateSchema = z.object({
  schema_version: z.literal('story-agent-stage7-golden-card-candidate/v1'),
  slot_id: NonEmptyString,
  candidate_id: NonEmptyString,
  video_type: z.custom<VideoType>(value => typeof value === 'string' && value in VIDEO_TYPE_CONFIG),
  benchmark_id: NonEmptyString,
  source_entry: NonEmptyString,
  benchmark_file: NonEmptyString,
  benchmark_file_sha256: Hash,
  benchmark_project_sha256: Hash,
  profile_contract_sha256: Hash,
  source_entry_confirmed: z.boolean(),
  source_authorization_status: z.enum(['pending_evidence', 'evidence_attached', 'public_domain', 'user_authorized']),
  source_refs: z.array(NonEmptyString),
  material_fields: z.record(z.string(), z.string()),
  visible_actions: z.array(NonEmptyString),
  evidence_boundaries: z.object({
    verified_facts: z.array(NonEmptyString),
    plausible_dramatization: z.array(NonEmptyString),
    fictional_additions: z.array(NonEmptyString),
    unknowns: z.array(NonEmptyString),
    forbidden_claims: z.array(NonEmptyString),
  }).strict(),
  candidate_status: z.literal('draft_pending_human_review'),
  created_by: z.enum(['human_operator', 'external_contributor']),
  generated_by_model: z.literal(false),
  human_approved: z.literal(false),
  golden_card_promoted: z.literal(false),
  professional_passed: z.literal(false),
}).strict();

export type Stage7GoldenCardCandidate = z.infer<typeof Stage7GoldenCardCandidateSchema>;

interface CandidateSlotContext {
  slotId: string;
  candidateId: string;
  videoType: VideoType;
  benchmarkId: string;
  sourceEntry: string;
  benchmarkFile: string;
  benchmarkFileSha256: string;
  benchmarkProjectSha256: string;
  profileContractSha256: string;
  requiredMaterialFields: string[];
  currentCandidateCount: number;
}

async function readRepositoryFile(repoRoot: string, relativePath: string): Promise<{ raw: string; value: unknown }> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage7_candidate_path_outside_repository');
  const raw = await readFile(resolved, 'utf8');
  return { raw, value: JSON.parse(raw) as unknown };
}

function profileBinding(videoType: VideoType): { sha256: string; requiredMaterialFields: string[] } {
  const profile = getGenreStoryProfile(videoType);
  const requiredMaterialFields = [...new Set([
    ...profile.required_fields,
    'visual_anchor',
    'source_boundary',
    'forbidden_claims',
  ])];
  return {
    requiredMaterialFields,
    sha256: stage7GoldenCardCanonicalSha256({
      video_type: profile.video_type,
      narrative_promise: profile.narrative_promise,
      material_requirements: profile.material_requirements,
      truth_rules: profile.truth_rules,
      required_fields: profile.required_fields,
      must_include: profile.must_include,
      avoid: profile.avoid,
      quality_rules: profile.quality_rules,
    }),
  };
}

async function loadSlots(repoRoot: string): Promise<{ slots: CandidateSlotContext[]; counts: Map<VideoType, number> }> {
  const indexFile = await readRepositoryFile(repoRoot, INDEX_PATH);
  const index = indexFile.value as Record<string, unknown>;
  const countsValue = index.counts && typeof index.counts === 'object' && !Array.isArray(index.counts)
    ? index.counts as Record<string, unknown> : {};
  const byType = countsValue.by_video_type && typeof countsValue.by_video_type === 'object' && !Array.isArray(countsValue.by_video_type)
    ? countsValue.by_video_type as Record<string, unknown> : {};
  const counts = new Map<VideoType, number>((Object.keys(VIDEO_TYPE_CONFIG) as VideoType[])
    .map(videoType => [videoType, Number(byType[videoType] ?? 0)]));
  const slots: CandidateSlotContext[] = [];
  for (const [videoType, benchmarkFile] of Object.entries(BENCHMARK_FILES) as Array<[VideoType, string]>) {
    const file = await readRepositoryFile(repoRoot, benchmarkFile);
    const registry = file.value as Record<string, unknown>;
    if (registry.video_type !== videoType) throw new Error(`stage7_candidate_benchmark_video_type_mismatch:${videoType}`);
    const projects = Array.isArray(registry.projects) ? registry.projects : [];
    if (projects.length !== 5) throw new Error(`stage7_candidate_benchmark_project_count_invalid:${videoType}`);
    const profile = profileBinding(videoType);
    for (const rawProject of projects) {
      if (!rawProject || typeof rawProject !== 'object' || Array.isArray(rawProject)) throw new Error(`stage7_candidate_benchmark_project_invalid:${videoType}`);
      const project = rawProject as Record<string, unknown>;
      const benchmarkId = String(project.benchmark_id ?? '');
      const sourceEntry = String(project.source_entry ?? '');
      if (!benchmarkId || !sourceEntry) throw new Error(`stage7_candidate_benchmark_binding_missing:${videoType}`);
      slots.push({
        slotId: `stage7-slot-${benchmarkId}`,
        candidateId: `stage7-golden-candidate-${benchmarkId}`,
        videoType,
        benchmarkId,
        sourceEntry,
        benchmarkFile,
        benchmarkFileSha256: createHash('sha256').update(file.raw, 'utf8').digest('hex'),
        benchmarkProjectSha256: stage7GoldenCardCanonicalSha256(project),
        profileContractSha256: profile.sha256,
        requiredMaterialFields: profile.requiredMaterialFields,
        currentCandidateCount: counts.get(videoType) ?? 0,
      });
    }
  }
  return { slots, counts };
}

function sourceClaims(raw: unknown): { humanApproval: boolean; promotion: boolean; professionalPass: boolean } {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    humanApproval: value.human_approved === true,
    promotion: value.golden_card_promoted === true,
    professionalPass: value.professional_passed === true,
  };
}

function pushIssue(issues: Stage7GoldenCardCandidateIssue[], issue: Stage7GoldenCardCandidateIssue): void {
  if (!issues.some(item => item.code === issue.code && item.path === issue.path)) issues.push(issue);
}

export function evaluateStage7GoldenCardCandidate(input: {
  rawJson: string;
  slot: CandidateSlotContext;
  slotFound?: boolean;
  now?: string;
}): Stage7GoldenCardCandidateInspectionResult {
  const now = input.now ?? new Date().toISOString();
  let raw: unknown;
  let jsonValid = false;
  try { raw = JSON.parse(input.rawJson) as unknown; jsonValid = true; } catch { raw = undefined; }
  const claims = sourceClaims(raw);
  const parsed = Stage7GoldenCardCandidateSchema.safeParse(raw);
  const value = parsed.success ? parsed.data : null;
  const materialFields = value?.material_fields ?? {};
  const requiredPresentCount = input.slot.requiredMaterialFields.filter(field => Object.hasOwn(materialFields, field)).length;
  const requiredFilledCount = input.slot.requiredMaterialFields.filter(field => materialFields[field]?.trim()).length;
  const checks: Stage7GoldenCardCandidateInspectionResult['checks'] = {
    request_valid: Boolean(input.rawJson && input.slot.slotId),
    json_valid: jsonValid,
    candidate_schema_valid: parsed.success,
    slot_found: input.slotFound ?? true,
    target_video_type_still_missing_candidates: input.slot.currentCandidateCount === 0,
    slot_id_binding_valid: value?.slot_id === input.slot.slotId,
    candidate_id_binding_valid: value?.candidate_id === input.slot.candidateId,
    video_type_binding_valid: value?.video_type === input.slot.videoType,
    benchmark_binding_valid: value?.benchmark_id === input.slot.benchmarkId,
    source_entry_binding_valid: value?.source_entry === input.slot.sourceEntry,
    benchmark_file_binding_valid: value?.benchmark_file === input.slot.benchmarkFile,
    benchmark_file_digest_valid: value?.benchmark_file_sha256 === input.slot.benchmarkFileSha256,
    benchmark_project_digest_valid: value?.benchmark_project_sha256 === input.slot.benchmarkProjectSha256,
    profile_contract_digest_valid: value?.profile_contract_sha256 === input.slot.profileContractSha256,
    required_material_fields_present: requiredPresentCount === input.slot.requiredMaterialFields.length,
    required_material_fields_filled: requiredFilledCount === input.slot.requiredMaterialFields.length,
    visible_actions_present: Boolean(value?.visible_actions.length),
    verified_facts_present: Boolean(value?.evidence_boundaries.verified_facts.length),
    source_refs_present: Boolean(value?.source_refs.length),
    forbidden_claims_present: Boolean(value?.evidence_boundaries.forbidden_claims.length),
    source_entry_confirmed: value?.source_entry_confirmed === true,
    source_authorization_resolved: Boolean(value && value.source_authorization_status !== 'pending_evidence'),
    candidate_status_valid: value?.candidate_status === 'draft_pending_human_review' && value.generated_by_model === false,
    source_claimed_credit_rejected: !claims.humanApproval && !claims.promotion && !claims.professionalPass,
  };
  const issues: Stage7GoldenCardCandidateIssue[] = [];
  if (!checks.json_valid) pushIssue(issues, { code: 'golden_candidate_json_invalid', path: 'raw_json', gate: 'schema', blocking: true, message: 'Candidate intake must be valid JSON.' });
  if (!parsed.success) for (const issue of parsed.error.issues.slice(0, 50)) pushIssue(issues, { code: 'golden_candidate_schema_invalid', path: issue.path.join('.'), gate: 'schema', blocking: true, message: issue.message });
  const gates: Array<[keyof typeof checks, string, Stage7GoldenCardCandidateIssue['gate'], string, string]> = [
    ['slot_found', 'golden_candidate_slot_not_found', 'slot', 'slot_id', 'Candidate slot must exist in the frozen 60-slot plan.'],
    ['target_video_type_still_missing_candidates', 'golden_candidate_target_type_already_covered', 'slot', 'video_type', 'This plan only fills video types with no indexed candidates.'],
    ['slot_id_binding_valid', 'golden_candidate_slot_binding_mismatch', 'binding', 'slot_id', 'slot_id does not match the selected plan slot.'],
    ['candidate_id_binding_valid', 'golden_candidate_id_binding_mismatch', 'binding', 'candidate_id', 'candidate_id does not match the deterministic slot candidate ID.'],
    ['video_type_binding_valid', 'golden_candidate_video_type_binding_mismatch', 'binding', 'video_type', 'video_type does not match the selected slot.'],
    ['benchmark_binding_valid', 'golden_candidate_benchmark_binding_mismatch', 'binding', 'benchmark_id', 'benchmark_id does not match the selected fixed project.'],
    ['source_entry_binding_valid', 'golden_candidate_source_entry_binding_mismatch', 'binding', 'source_entry', 'source_entry does not match the benchmark project.'],
    ['benchmark_file_binding_valid', 'golden_candidate_benchmark_file_binding_mismatch', 'binding', 'benchmark_file', 'benchmark_file does not match the slot.'],
    ['benchmark_file_digest_valid', 'golden_candidate_benchmark_file_digest_mismatch', 'binding', 'benchmark_file_sha256', 'Benchmark file SHA-256 has drifted.'],
    ['benchmark_project_digest_valid', 'golden_candidate_benchmark_project_digest_mismatch', 'binding', 'benchmark_project_sha256', 'Benchmark project payload SHA-256 has drifted.'],
    ['profile_contract_digest_valid', 'golden_candidate_profile_contract_digest_mismatch', 'binding', 'profile_contract_sha256', 'GenreStoryProfile contract SHA-256 has drifted.'],
    ['required_material_fields_present', 'golden_candidate_required_material_fields_missing', 'content', 'material_fields', 'Every required profile material field must be present.'],
    ['required_material_fields_filled', 'golden_candidate_required_material_fields_empty', 'content', 'material_fields', 'Every required profile material field must contain operator-authored content.'],
    ['visible_actions_present', 'golden_candidate_visible_actions_missing', 'content', 'visible_actions', 'At least one camera-visible action is required.'],
    ['verified_facts_present', 'golden_candidate_verified_facts_missing', 'evidence', 'evidence_boundaries.verified_facts', 'At least one verified fact is required.'],
    ['source_refs_present', 'golden_candidate_source_refs_missing', 'evidence', 'source_refs', 'At least one source reference is required.'],
    ['forbidden_claims_present', 'golden_candidate_forbidden_claims_missing', 'evidence', 'evidence_boundaries.forbidden_claims', 'At least one explicit forbidden claim is required.'],
    ['source_entry_confirmed', 'golden_candidate_source_entry_unconfirmed', 'authorization', 'source_entry_confirmed', 'The source entry must be independently confirmed.'],
    ['source_authorization_resolved', 'golden_candidate_source_authorization_pending', 'authorization', 'source_authorization_status', 'Source or authorization evidence must be resolved before human review.'],
    ['candidate_status_valid', 'golden_candidate_status_or_origin_invalid', 'credit', 'candidate_status', 'Candidate must remain a non-model draft pending human review.'],
    ['source_claimed_credit_rejected', 'golden_candidate_self_reported_credit_rejected', 'credit', 'human_approved', 'Candidate input cannot grant approval, promotion, or professional pass.'],
  ];
  for (const [key, code, gate, issuePath, message] of gates) if (!checks[key]) pushIssue(issues, { code, path: issuePath, gate, blocking: true, message });
  const boundary = value?.evidence_boundaries;
  return {
    schema_version: 'story-agent-stage7-golden-card-candidate-inspection/v1',
    generated_at: now,
    dry_run_only: true,
    candidate_persisted: false,
    golden_index_modified: false,
    source_card_file_created: false,
    province_markdown_modified: false,
    human_approval_granted: false,
    golden_card_promoted: false,
    professional_passed: false,
    candidate_ready_for_external_human_review: Object.values(checks).every(Boolean),
    source_file_sha256: input.slot.benchmarkFileSha256,
    benchmark_project_sha256: input.slot.benchmarkProjectSha256,
    profile_contract_sha256: input.slot.profileContractSha256,
    expected_binding: {
      slot_id: input.slot.slotId,
      candidate_id: input.slot.candidateId,
      video_type: input.slot.videoType,
      benchmark_id: input.slot.benchmarkId,
      source_entry: input.slot.sourceEntry,
      benchmark_file: input.slot.benchmarkFile,
      required_material_fields: input.slot.requiredMaterialFields,
    },
    checks,
    content_summary: {
      required_material_field_count: input.slot.requiredMaterialFields.length,
      present_material_field_count: requiredPresentCount,
      filled_material_field_count: requiredFilledCount,
      visible_action_count: value?.visible_actions.length ?? 0,
      verified_fact_count: boundary?.verified_facts.length ?? 0,
      plausible_dramatization_count: boundary?.plausible_dramatization.length ?? 0,
      fictional_addition_count: boundary?.fictional_additions.length ?? 0,
      unknown_count: boundary?.unknowns.length ?? 0,
      forbidden_claim_count: boundary?.forbidden_claims.length ?? 0,
      source_reference_count: value?.source_refs.length ?? 0,
      source_claimed_human_approval: claims.humanApproval,
      source_claimed_golden_card_promotion: claims.promotion,
      source_claimed_professional_pass: claims.professionalPass,
    },
    issues,
  };
}

function candidateTemplate(slot: CandidateSlotContext): Stage7GoldenCardCandidate {
  return {
    schema_version: 'story-agent-stage7-golden-card-candidate/v1',
    slot_id: slot.slotId,
    candidate_id: slot.candidateId,
    video_type: slot.videoType,
    benchmark_id: slot.benchmarkId,
    source_entry: slot.sourceEntry,
    benchmark_file: slot.benchmarkFile,
    benchmark_file_sha256: slot.benchmarkFileSha256,
    benchmark_project_sha256: slot.benchmarkProjectSha256,
    profile_contract_sha256: slot.profileContractSha256,
    source_entry_confirmed: false,
    source_authorization_status: 'pending_evidence',
    source_refs: [],
    material_fields: Object.fromEntries(slot.requiredMaterialFields.map(field => [field, ''])),
    visible_actions: [],
    evidence_boundaries: {
      verified_facts: [],
      plausible_dramatization: [],
      fictional_additions: [],
      unknowns: [],
      forbidden_claims: [],
    },
    candidate_status: 'draft_pending_human_review',
    created_by: 'human_operator',
    generated_by_model: false,
    human_approved: false,
    golden_card_promoted: false,
    professional_passed: false,
  };
}

export async function inspectStage7GoldenCardCandidate(input: { repoRoot: string; request: unknown; now?: string }): Promise<Stage7GoldenCardCandidateInspectionResult> {
  const request = input.request && typeof input.request === 'object' && !Array.isArray(input.request) ? input.request as Record<string, unknown> : {};
  const rawJson = typeof request.raw_json === 'string' ? request.raw_json : '';
  const expectedSlotId = typeof request.expected_slot_id === 'string' ? request.expected_slot_id : '';
  const { slots } = await loadSlots(input.repoRoot);
  const slot = slots.find(item => item.slotId === expectedSlotId) ?? slots[0];
  return evaluateStage7GoldenCardCandidate({ rawJson, slot, slotFound: slots.some(item => item.slotId === expectedSlotId), now: input.now });
}

export async function getStage7GoldenCardCandidateWorkspace(input: { repoRoot: string; slotId?: unknown; now?: string }): Promise<Stage7GoldenCardCandidateWorkspace> {
  const now = input.now ?? new Date().toISOString();
  const { slots, counts } = await loadSlots(input.repoRoot);
  if (slots.length !== 60) throw new Error('stage7_golden_candidate_slot_count_invalid');
  const requested = typeof input.slotId === 'string' ? input.slotId : '';
  const selected = slots.find(slot => slot.slotId === requested) ?? slots[0];
  const template = candidateTemplate(selected);
  const templateRawJson = `${JSON.stringify(template, null, 2)}\n`;
  const videoTypes = (Object.keys(VIDEO_TYPE_CONFIG) as VideoType[]).map(videoType => {
    const currentCount = counts.get(videoType) ?? 0;
    const plannedCount = slots.filter(slot => slot.videoType === videoType).length;
    return {
      video_type: videoType,
      label: VIDEO_TYPE_CONFIG[videoType].label,
      current_candidate_count: currentCount,
      planned_slot_count: plannedCount,
      missing_target_card_count: Math.max(0, 5 - currentCount),
      status: currentCount > 0 ? 'already_has_candidate_coverage' as const : 'slots_prepared_missing_candidate_content' as const,
    };
  });
  const coveredVideoTypeCount = videoTypes.filter(item => item.current_candidate_count > 0).length;
  const missingVideoTypeCount = videoTypes.filter(item => item.current_candidate_count === 0).length;
  if (coveredVideoTypeCount !== 3 || missingVideoTypeCount !== 12) throw new Error('stage7_golden_candidate_coverage_baseline_drifted');
  return {
    schema_version: 'story-agent-stage7-golden-card-candidate-workspace/v1',
    generated_at: now,
    policy: {
      dry_run_only: true,
      slots_are_not_golden_cards: true,
      validated_candidates_are_not_persisted: true,
      candidate_ready_is_human_approval: false,
      benchmark_specs_are_not_real_model_outputs: true,
      fixture_or_template_counts_as_candidate: false,
      professional_pass_can_be_granted: false,
    },
    summary: {
      target_video_type_count: 15,
      already_covered_video_type_count: 3,
      missing_video_type_count: 12,
      planned_slot_count: slots.length,
      candidate_import_ready_slot_count: 0,
      authored_candidate_count: 0,
      persisted_candidate_count: 0,
      human_approved_card_count: 0,
      professional_pass_count: 0,
    },
    video_types: videoTypes,
    slots: slots.map(slot => ({
      slot_id: slot.slotId,
      candidate_id: slot.candidateId,
      video_type: slot.videoType,
      video_type_label: VIDEO_TYPE_CONFIG[slot.videoType].label,
      benchmark_id: slot.benchmarkId,
      source_entry: slot.sourceEntry,
      benchmark_file: slot.benchmarkFile,
      required_material_fields: slot.requiredMaterialFields,
      status: 'template_slot_only',
      candidate_ready_for_external_human_review: false,
      human_approved: false,
    })),
    selected_slot_id: selected.slotId,
    template,
    template_raw_json: templateRawJson,
    template_inspection: evaluateStage7GoldenCardCandidate({ rawJson: templateRawJson, slot: selected, now }),
  };
}
