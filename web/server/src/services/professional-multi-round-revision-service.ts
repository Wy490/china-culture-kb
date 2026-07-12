import { createHash } from 'node:crypto';
import type {
  ProfessionalTextPackage,
  ProfessionalTextPackageField,
  ProfessionalRevisionTraceItem,
  VideoType,
} from '@shared/types.js';

export type ProfessionalCoverageCategory =
  | 'structure'
  | 'character_or_information'
  | 'scene'
  | 'dialogue_or_narration'
  | 'pacing'
  | 'fact_and_culture';

export type ProfessionalTableReadSource =
  | 'writer_editor'
  | 'director'
  | 'fact_culture_reviewer'
  | 'user';

export type ProfessionalRevisionArtifactKind =
  | 'real_model'
  | 'human_authored'
  | 'simulation'
  | 'fixture';

export interface ProfessionalCoverageCategoryResult {
  category: ProfessionalCoverageCategory;
  notes: string[];
  hard_gate_issue_ids: string[];
  action_items: string[];
}

export interface ProfessionalCoverageActionSet {
  schema_version: 'professional-coverage-action-set/v1';
  package_id: string;
  video_type: VideoType;
  generated_at: string;
  verdict: ProfessionalTextPackage['coverage_report']['verdict'];
  categories: ProfessionalCoverageCategoryResult[];
  hard_gate_issue_count: number;
  professional_passed: false;
}

export interface ProfessionalTableReadFeedback {
  feedback_id: string;
  source: ProfessionalTableReadSource;
  category: ProfessionalCoverageCategory;
  note: string;
  issue_id: string;
  target_sections: ProfessionalTextPackageField[];
  evidence_required: boolean;
  status: 'open' | 'closed';
  resolution_note: string;
}

export interface ProfessionalRevisionProvenance {
  artifact_kind: ProfessionalRevisionArtifactKind;
  output_id: string;
  model_or_author: string;
  prompt_or_brief_version: string;
  provenance_verified: boolean;
  cost_recorded: boolean;
}

export interface ProfessionalRevisionRound {
  round_id: string;
  round_number: number;
  created_at: string;
  before_package_sha256: string;
  after_package_sha256: string;
  before_quality_score: number;
  after_quality_score: number;
  quality_delta: number;
  changed_sections: ProfessionalTextPackageField[];
  required_derived_rebuild_sections: ProfessionalTextPackageField[];
  rebuilt_derived_sections: ProfessionalTextPackageField[];
  resolved_issue_ids: string[];
  new_issue_ids: string[];
  remaining_issue_ids: string[];
  table_read_feedback: ProfessionalTableReadFeedback[];
  provenance: ProfessionalRevisionProvenance;
  quality_improvement_traceable: boolean;
  verified_real_revision_credit: boolean;
  professional_passed: false;
}

export interface ProfessionalMultiRoundRevisionLedger {
  schema_version: 'professional-multi-round-revision-ledger/v1';
  ledger_id: string;
  package_id: string;
  project_id: string;
  video_type: VideoType;
  required_round_count: 2;
  rounds: ProfessionalRevisionRound[];
  summary: {
    recorded_round_count: number;
    completed_verified_round_count: number;
    traceable_quality_improvement_round_count: number;
    total_quality_delta: number;
    open_table_read_feedback_count: number;
    closed_table_read_feedback_count: number;
    fixture_or_simulation_round_count: number;
    stage6_exit_candidate: boolean;
    professional_passed: false;
  };
}

const CATEGORY_NOTES: Record<ProfessionalCoverageCategory, keyof ProfessionalTextPackage['coverage_report']> = {
  structure: 'structure_notes',
  character_or_information: 'character_or_information_notes',
  scene: 'scene_notes',
  dialogue_or_narration: 'dialogue_or_narration_notes',
  pacing: 'pacing_notes',
  fact_and_culture: 'fact_and_culture_notes',
};

const CATEGORY_KEYWORDS: Record<ProfessionalCoverageCategory, RegExp> = {
  structure: /结构|因果|开场|结尾|钩子|路线|阶段|步骤|论证|命题/u,
  character_or_information: /人物|角色|关系|目标|选择|信息|概念|学习|受众/u,
  scene: /场景|分场|动作|镜头|构图|空间|自然运动|示范|格/u,
  dialogue_or_narration: /对白|旁白|台词|字幕|文案|气泡|讲解/u,
  pacing: /节奏|时长|转场|停留|情绪|留白|密度/u,
  fact_and_culture: /事实|文化|史实|传说|证据|来源|授权|安全|地理|边界/u,
};

const DERIVED_FIELDS = new Set<ProfessionalTextPackageField>([
  'sequence_beats',
  'scene_breakdown',
  'director_text_plan',
  'delivery_text_package',
]);

function issueId(value: string): string {
  return value.split(':', 1)[0]?.trim() || 'unknown_issue';
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]));
  }
  return value;
}

export function professionalPackageSha256(pkg: ProfessionalTextPackage): string {
  return createHash('sha256').update(JSON.stringify(stableValue(pkg))).digest('hex');
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function actionsForCategory(actionItems: string[], category: ProfessionalCoverageCategory): string[] {
  return actionItems.filter(item => CATEGORY_KEYWORDS[category].test(item));
}

export function buildProfessionalCoverageActionSet(input: {
  package: ProfessionalTextPackage;
  now?: string;
}): ProfessionalCoverageActionSet {
  const pkg = input.package;
  const hardGateIssueIds = pkg.quality_report.hard_gate_failures.map(issueId);
  const categories = (Object.keys(CATEGORY_NOTES) as ProfessionalCoverageCategory[]).map(category => {
    const notes = pkg.coverage_report[CATEGORY_NOTES[category]] as string[];
    const actionItems = actionsForCategory(pkg.coverage_report.action_items, category);
    return {
      category,
      notes: [...notes],
      hard_gate_issue_ids: unique(hardGateIssueIds.filter(id => CATEGORY_KEYWORDS[category].test(id))),
      action_items: actionItems,
    };
  });
  const assigned = new Set(categories.flatMap(category => category.action_items));
  const unassigned = pkg.coverage_report.action_items.filter(item => !assigned.has(item));
  if (unassigned.length > 0) categories[0].action_items.push(...unassigned);
  return {
    schema_version: 'professional-coverage-action-set/v1',
    package_id: pkg.package_id,
    video_type: pkg.video_type,
    generated_at: input.now ?? new Date().toISOString(),
    verdict: pkg.coverage_report.verdict,
    categories,
    hard_gate_issue_count: hardGateIssueIds.length,
    professional_passed: false,
  };
}

export function importProfessionalTableReadFeedback(input: {
  package: ProfessionalTextPackage;
  feedback: Array<Omit<ProfessionalTableReadFeedback, 'status' | 'resolution_note'>>;
}): ProfessionalTableReadFeedback[] {
  const ids = new Set<string>();
  return input.feedback.map(item => {
    if (!item.feedback_id.trim() || ids.has(item.feedback_id)) throw new Error('table_read_feedback_id_invalid_or_duplicate');
    if (!item.note.trim() || !item.issue_id.trim()) throw new Error('table_read_feedback_note_or_issue_missing');
    if (item.target_sections.length === 0) throw new Error('table_read_feedback_target_section_missing');
    ids.add(item.feedback_id);
    return { ...structuredClone(item), status: 'open', resolution_note: '' };
  });
}

function requiredDerivedRebuilds(changedSections: ProfessionalTextPackageField[]): ProfessionalTextPackageField[] {
  const changed = new Set(changedSections);
  const required: ProfessionalTextPackageField[] = [];
  if (changed.has('full_text')) required.push('scene_breakdown', 'sequence_beats');
  if (changed.has('scene_breakdown')) required.push('sequence_beats');
  if ([
    'structure_outline',
    'sequence_beats',
    'scene_breakdown',
    'full_text',
    'dialogue_or_narration_pass',
    'continuity_ledger',
  ].some(field => changed.has(field as ProfessionalTextPackageField))) {
    required.push('director_text_plan', 'delivery_text_package');
  }
  return unique(required.filter(field => !changed.has(field)));
}

function closeFeedback(
  feedback: ProfessionalTableReadFeedback[],
  resolutions: Array<{ feedback_id: string; resolution_note: string }>,
): ProfessionalTableReadFeedback[] {
  const byId = new Map(resolutions.map(item => [item.feedback_id, item.resolution_note.trim()]));
  return feedback.map(item => {
    const resolution = byId.get(item.feedback_id);
    if (resolution === undefined) return structuredClone(item);
    if (!resolution) throw new Error(`table_read_feedback_resolution_missing:${item.feedback_id}`);
    return { ...structuredClone(item), status: 'closed', resolution_note: resolution };
  });
}

function score(pkg: ProfessionalTextPackage): number {
  if (pkg.quality_report.total_score === undefined) throw new Error('quality_score_required_for_revision_round');
  return pkg.quality_report.total_score;
}

function summarizeLedger(ledger: ProfessionalMultiRoundRevisionLedger): void {
  const feedback = ledger.rounds.flatMap(round => round.table_read_feedback);
  ledger.summary = {
    recorded_round_count: ledger.rounds.length,
    completed_verified_round_count: ledger.rounds.filter(round => round.verified_real_revision_credit).length,
    traceable_quality_improvement_round_count: ledger.rounds.filter(round => round.quality_improvement_traceable && round.quality_delta > 0).length,
    total_quality_delta: ledger.rounds.reduce((sum, round) => sum + round.quality_delta, 0),
    open_table_read_feedback_count: feedback.filter(item => item.status === 'open').length,
    closed_table_read_feedback_count: feedback.filter(item => item.status === 'closed').length,
    fixture_or_simulation_round_count: ledger.rounds.filter(round => ['fixture', 'simulation'].includes(round.provenance.artifact_kind)).length,
    stage6_exit_candidate: false,
    professional_passed: false,
  };
  ledger.summary.stage6_exit_candidate = ledger.summary.completed_verified_round_count >= ledger.required_round_count
    && ledger.summary.traceable_quality_improvement_round_count >= 1
    && ledger.summary.open_table_read_feedback_count === 0
    && ledger.rounds.every(round => round.quality_improvement_traceable);
}

export function recordProfessionalRevisionRound(input: {
  ledger?: ProfessionalMultiRoundRevisionLedger;
  before_package: ProfessionalTextPackage;
  after_package: ProfessionalTextPackage;
  changed_sections: ProfessionalTextPackageField[];
  rebuilt_derived_sections: ProfessionalTextPackageField[];
  table_read_feedback: ProfessionalTableReadFeedback[];
  feedback_resolutions?: Array<{ feedback_id: string; resolution_note: string }>;
  provenance: ProfessionalRevisionProvenance;
  now?: string;
}): { ledger: ProfessionalMultiRoundRevisionLedger; revision_trace_item: ProfessionalRevisionTraceItem } {
  const before = input.before_package;
  const after = input.after_package;
  if (before.package_id !== after.package_id || before.video_type !== after.video_type) throw new Error('revision_package_identity_mismatch');
  if (!after.project_id?.trim() || before.project_id !== after.project_id) throw new Error('real_project_id_required_for_revision_ledger');
  if (input.changed_sections.length === 0) throw new Error('revision_changed_sections_required');
  const requiredRebuilds = requiredDerivedRebuilds(input.changed_sections);
  const rebuilt = unique(input.rebuilt_derived_sections.filter(section => DERIVED_FIELDS.has(section)));
  const missingRebuilds = requiredRebuilds.filter(section => !rebuilt.includes(section));
  if (missingRebuilds.length > 0) throw new Error(`stale_derived_sections:${missingRebuilds.join(',')}`);
  const beforeHash = professionalPackageSha256(before);
  const afterHash = professionalPackageSha256(after);
  if (beforeHash === afterHash) throw new Error('revision_package_unchanged');
  const beforeIssues = before.quality_report.hard_gate_failures.map(issueId);
  const afterIssues = after.quality_report.hard_gate_failures.map(issueId);
  const resolved = beforeIssues.filter(id => !afterIssues.includes(id));
  const created = afterIssues.filter(id => !beforeIssues.includes(id));
  const feedback = closeFeedback(input.table_read_feedback, input.feedback_resolutions ?? []);
  const beforeScore = score(before);
  const afterScore = score(after);
  const realArtifact = ['real_model', 'human_authored'].includes(input.provenance.artifact_kind);
  const verifiedRealRevisionCredit = realArtifact
    && input.provenance.provenance_verified
    && Boolean(input.provenance.output_id.trim())
    && Boolean(input.provenance.model_or_author.trim())
    && Boolean(input.provenance.prompt_or_brief_version.trim());
  const now = input.now ?? new Date().toISOString();
  const ledger = input.ledger ? structuredClone(input.ledger) : {
    schema_version: 'professional-multi-round-revision-ledger/v1' as const,
    ledger_id: `${after.project_id}--${after.video_type}--revision-ledger`,
    package_id: after.package_id,
    project_id: after.project_id,
    video_type: after.video_type,
    required_round_count: 2 as const,
    rounds: [],
    summary: {
      recorded_round_count: 0,
      completed_verified_round_count: 0,
      traceable_quality_improvement_round_count: 0,
      total_quality_delta: 0,
      open_table_read_feedback_count: 0,
      closed_table_read_feedback_count: 0,
      fixture_or_simulation_round_count: 0,
      stage6_exit_candidate: false,
      professional_passed: false as const,
    },
  };
  if (ledger.package_id !== after.package_id || ledger.video_type !== after.video_type || ledger.project_id !== after.project_id) {
    throw new Error('revision_ledger_identity_mismatch');
  }
  const roundNumber = ledger.rounds.length + 1;
  const round: ProfessionalRevisionRound = {
    round_id: `revision-round-${roundNumber}`,
    round_number: roundNumber,
    created_at: now,
    before_package_sha256: beforeHash,
    after_package_sha256: afterHash,
    before_quality_score: beforeScore,
    after_quality_score: afterScore,
    quality_delta: afterScore - beforeScore,
    changed_sections: unique(input.changed_sections),
    required_derived_rebuild_sections: requiredRebuilds,
    rebuilt_derived_sections: rebuilt,
    resolved_issue_ids: resolved,
    new_issue_ids: created,
    remaining_issue_ids: afterIssues,
    table_read_feedback: feedback,
    provenance: structuredClone(input.provenance),
    quality_improvement_traceable: true,
    verified_real_revision_credit: verifiedRealRevisionCredit,
    professional_passed: false,
  };
  ledger.rounds.push(round);
  summarizeLedger(ledger);
  const revisionTraceItem: ProfessionalRevisionTraceItem = {
    revision_id: round.round_id,
    created_at: now,
    source: input.provenance.artifact_kind === 'human_authored' ? 'writer_editor' : 'agent',
    reason: `Stage 6 multi-round revision; artifact_kind=${input.provenance.artifact_kind}`,
    changed_sections: round.changed_sections,
    resolved_issue_ids: resolved,
    remaining_issues: afterIssues,
    quality_delta: round.quality_delta,
  };
  return { ledger, revision_trace_item: revisionTraceItem };
}

export function validateProfessionalMultiRoundRevisionLedger(
  ledger: ProfessionalMultiRoundRevisionLedger,
): string[] {
  const errors: string[] = [];
  if (ledger.schema_version !== 'professional-multi-round-revision-ledger/v1') errors.push('schema_version_invalid');
  if (ledger.rounds.some((round, index) => round.round_number !== index + 1)) errors.push('round_sequence_invalid');
  if (ledger.rounds.some(round => round.professional_passed !== false)) errors.push('round_professional_pass_must_be_false');
  if (ledger.summary.professional_passed !== false) errors.push('ledger_professional_pass_must_be_false');
  const fixtureCredit = ledger.rounds.some(round => ['fixture', 'simulation'].includes(round.provenance.artifact_kind)
    && round.verified_real_revision_credit);
  if (fixtureCredit) errors.push('fixture_or_simulation_credit_forbidden');
  const cloned = structuredClone(ledger);
  summarizeLedger(cloned);
  if (JSON.stringify(cloned.summary) !== JSON.stringify(ledger.summary)) errors.push('summary_mismatch');
  return errors;
}
