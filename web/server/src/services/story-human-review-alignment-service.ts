import type {
  ProfessionalQualityDimensionId,
  StoryGenerateResult,
  StoryHumanReviewAlignment,
  StoryHumanReviewCriterion,
  StoryHumanReviewerRole,
  StoryMachineReviewStatus,
  StoryQualityGateId,
  StoryQualityReport,
} from '@shared/types.js';
import { professionalBlindReviewWeightContract } from './professional-benchmark-review-service.js';
import { getStoryFamilyRepairGuidance, resolveStoryQualityFamily } from './story-family-quality-service.js';

interface MachineReviewSource {
  ref: string;
  dimension_id: ProfessionalQualityDimensionId;
  status: StoryMachineReviewStatus;
  evidence: string[];
  counter_evidence: string[];
  scene_ids: number[];
}

const DIMENSIONS: Array<{
  dimension_id: ProfessionalQualityDimensionId;
  dimension_label: string;
  role: StoryHumanReviewerRole;
}> = [
  { dimension_id: 'creative_brief_and_audience_promise', dimension_label: '创作任务与观众承诺', role: 'screenwriter_or_script_editor' },
  { dimension_id: 'premise_and_theme_unity', dimension_label: '前提、核心问题与主题统一', role: 'screenwriter_or_script_editor' },
  { dimension_id: 'structure_causality_and_pacing', dimension_label: '结构、因果与节奏', role: 'screenwriter_or_script_editor' },
  { dimension_id: 'character_agency_and_relationship_change', dimension_label: '人物能动性与关系变化', role: 'screenwriter_or_script_editor' },
  { dimension_id: 'dialogue_narration_and_subtext', dimension_label: '对白、旁白与潜台词', role: 'screenwriter_or_script_editor' },
  { dimension_id: 'emotional_curve_and_aftertaste', dimension_label: '情绪曲线与余味', role: 'screenwriter_or_script_editor' },
  { dimension_id: 'scene_function_visible_action_and_blocking', dimension_label: '场景功能、可见行动与调度', role: 'genre_or_director_reviewer' },
  { dimension_id: 'production_executability', dimension_label: '生产可执行性', role: 'genre_or_director_reviewer' },
  { dimension_id: 'originality_and_distinctiveness', dimension_label: '原创性与整体辨识度', role: 'genre_or_director_reviewer' },
  { dimension_id: 'cultural_fact_and_adaptation_boundary', dimension_label: '事实、文化与改编边界', role: 'fact_or_culture_reviewer' },
];

const ROLE_LABELS: Record<StoryHumanReviewerRole, string> = {
  screenwriter_or_script_editor: '编剧 / 剧本编辑',
  genre_or_director_reviewer: '类型 / 导演评审',
  fact_or_culture_reviewer: '事实 / 文化评审',
};

const GATE_DIMENSION: Record<StoryQualityGateId, ProfessionalQualityDimensionId> = {
  narrative_gate: 'structure_causality_and_pacing',
  factual_cultural_gate: 'cultural_fact_and_adaptation_boundary',
  outline_gate: 'creative_brief_and_audience_promise',
  audience_text_gate: 'dialogue_narration_and_subtext',
  production_material_gate: 'production_executability',
  gears_contract_gate: 'production_executability',
  asset_gate: 'production_executability',
  external_provider_gate: 'production_executability',
};

const GATE_IDS = Object.keys(GATE_DIMENSION) as StoryQualityGateId[];

export function buildStoryHumanReviewAlignment(input: {
  story: StoryGenerateResult;
  qualityReport: StoryQualityReport;
}): StoryHumanReviewAlignment {
  const family = input.qualityReport.family_quality_report?.family
    ?? resolveStoryQualityFamily(input.story.video_type);
  const familyLabel = input.qualityReport.family_quality_report?.family_label
    ?? getStoryFamilyRepairGuidance(input.story.video_type).family_label;
  const weightContract = professionalBlindReviewWeightContract(input.story.video_type);
  const weights = weightContract.dimension_weights;
  const sources = collectMachineReviewSources(input.qualityReport);
  const roles: StoryHumanReviewerRole[] = [
    'screenwriter_or_script_editor',
    'genre_or_director_reviewer',
    'fact_or_culture_reviewer',
  ];

  return {
    schema_version: 'story-human-review-alignment/v1',
    video_type: input.story.video_type,
    family,
    family_label: familyLabel,
    source_contracts: [
      'story-family-quality/v1',
      'pattern-quality/v2',
      'quality-gates/v2',
      'professional-blind-review-weight-contract/v1',
    ],
    weight_contract_sha256: weightContract.sha256,
    machine_prefill_only: true,
    review_status: 'awaiting_human_review',
    human_review_complete: false,
    human_blind_review_passed: false,
    professional_passed: false,
    credit_boundary: '机器报告仅提供待核证据和问题定位；评分、结论、签名与真人信用必须由三角色独立评审产生。',
    sections: roles.map(role => ({
      role,
      role_label: ROLE_LABELS[role],
      criteria: DIMENSIONS
        .filter(dimension => dimension.role === role)
        .map(dimension => buildCriterion(dimension, weights[dimension.dimension_id], sources)),
    })),
  };
}

function buildCriterion(
  dimension: (typeof DIMENSIONS)[number],
  weight: number,
  sources: MachineReviewSource[],
): StoryHumanReviewCriterion {
  const matched = sources.filter(source => source.dimension_id === dimension.dimension_id);
  const status: StoryMachineReviewStatus = matched.some(source => source.status === 'attention_required')
    ? 'attention_required'
    : matched.some(source => source.status === 'supporting_evidence')
      ? 'supporting_evidence'
      : 'not_evaluated';

  return {
    criterion_id: `human-review-${dimension.dimension_id}`,
    dimension_id: dimension.dimension_id,
    dimension_label: dimension.dimension_label,
    weight,
    machine_status: status,
    machine_evidence: unique(matched.flatMap(source => source.evidence)).slice(0, 12),
    machine_counter_evidence: unique(matched.flatMap(source => source.counter_evidence)).slice(0, 12),
    evidence_scene_ids: uniqueNumbers(matched.flatMap(source => source.scene_ids)),
    source_refs: unique(matched.map(source => source.ref)),
    human_verdict: 'not_reviewed',
    human_score: null,
    human_notes: '',
    counts_as_human_review_credit: false,
  };
}

function collectMachineReviewSources(report: StoryQualityReport): MachineReviewSource[] {
  const sources: MachineReviewSource[] = [];

  for (const check of report.family_quality_report?.checks ?? []) {
    sources.push({
      ref: `family:${check.check_id}`,
      dimension_id: familyCheckDimension(check.check_id),
      status: check.status === 'passed' ? 'supporting_evidence' : 'attention_required',
      evidence: check.status === 'passed' ? [check.summary] : [],
      counter_evidence: check.status === 'failed' ? [check.summary] : [],
      scene_ids: check.evidence_scene_ids,
    });
  }

  const patternSignals = [
    ...(report.pattern_quality_report?.satisfied_signals ?? []),
    ...(report.pattern_quality_report?.weak_signals ?? []),
  ];
  for (const signal of patternSignals) {
    sources.push({
      ref: `pattern:${signal.signal_id}`,
      dimension_id: patternSignalDimension(signal.repair_target.fields),
      status: signal.status === 'satisfied' ? 'supporting_evidence' : 'attention_required',
      evidence: signal.observable_evidence,
      counter_evidence: signal.counter_evidence.length > 0 ? signal.counter_evidence : signal.status === 'satisfied' ? [] : [signal.gap],
      scene_ids: signal.evidence_scene_ids,
    });
  }

  if (report.quality_gates) {
    for (const gateId of GATE_IDS) {
      const gate = report.quality_gates[gateId];
      sources.push({
        ref: `gate:${gateId}`,
        dimension_id: GATE_DIMENSION[gateId],
        status: gate.status === 'passed'
          ? 'supporting_evidence'
          : gate.status === 'failed'
            ? 'attention_required'
            : 'not_evaluated',
        evidence: gate.status === 'passed' ? [gate.summary] : [],
        counter_evidence: gate.status === 'failed' ? [gate.summary, ...gate.issues] : [],
        scene_ids: [],
      });
    }
  }

  return sources;
}

function familyCheckDimension(checkId: string): ProfessionalQualityDimensionId {
  if (/source|evidence|fact|boundary|local|site|object|cultural/i.test(checkId)) {
    return 'cultural_fact_and_adaptation_boundary';
  }
  if (/visual|route|spatial|sensory|vertical|light|sound|visible/i.test(checkId)) {
    return 'scene_function_visible_action_and_blocking';
  }
  if (/change|aftertaste|memory|ending|blank/i.test(checkId)) return 'emotional_curve_and_aftertaste';
  if (/dialogue|narration|caption|subtitle/i.test(checkId)) return 'dialogue_narration_and_subtext';
  if (/goal|resistance|choice|character|agency/i.test(checkId)) return 'character_agency_and_relationship_change';
  if (/value|question|hook|identity|proposition|objective/i.test(checkId)) return 'premise_and_theme_unity';
  return 'structure_causality_and_pacing';
}

function patternSignalDimension(fields: string[]): ProfessionalQualityDimensionId {
  const joined = fields.join(' ');
  if (/factual|fictional|source|cultural|credibility|truth/i.test(joined)) {
    return 'cultural_fact_and_adaptation_boundary';
  }
  if (/visual|camera|location|blocking|key_action/i.test(joined)) {
    return 'scene_function_visible_action_and_blocking';
  }
  if (/dialogue|narration|caption|subtitle/i.test(joined)) return 'dialogue_narration_and_subtext';
  if (/character|protagonist|relationship/i.test(joined)) return 'character_agency_and_relationship_change';
  if (/theme|core_message|slogan|logline/i.test(joined)) return 'premise_and_theme_unity';
  return 'structure_causality_and_pacing';
}

function unique(values: string[]): string[] {
  return values.filter((value, index, all) => value.trim().length > 0 && all.indexOf(value) === index);
}

function uniqueNumbers(values: number[]): number[] {
  return values.filter((value, index, all) => Number.isFinite(value) && all.indexOf(value) === index);
}
