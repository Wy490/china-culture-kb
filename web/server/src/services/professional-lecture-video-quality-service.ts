import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface LectureArgument {
  argument_id: string;
  order: number;
  claim: string;
  reasoning: string;
  evidence_ids: string[];
  case_ids: string[];
}

export interface LectureCase {
  case_id: string;
  title: string;
  factual_summary: string;
  what_it_supports: string;
  evidence_ids: string[];
}

export interface LectureCounterargument {
  counterargument_id: string;
  position: string;
  why_reasonable: string;
  response: string;
  evidence_ids: string[];
}

export interface LectureActionConclusion {
  audience_action: string;
  feasibility_boundary: string;
  institutional_wording_status: 'confirmed' | 'pending' | 'not_applicable';
}

export interface LectureVideoEvidence {
  thesis: string;
  audience_tension: string;
  arguments: LectureArgument[];
  cases: LectureCase[];
  counterarguments: LectureCounterargument[];
  rhetorical_transitions: string[];
  action_conclusion: LectureActionConclusion;
  value_boundary_notes: string[];
  scene_turns: Record<string, string>;
}

export interface LectureVideoEvaluation {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

const repairs: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长和传播目标。',
  full_text_not_final: '把资料、提纲或口号列表改为完整宣讲文本。',
  thesis_missing: '形成单一、明确且可由证据支持的核心立论。',
  audience_tension_missing: '说明受众为什么需要面对这个现实问题。',
  argument_chain_missing: '建立至少三个顺序递进的论点，并写清推理。',
  argument_evidence_missing: '每个论点绑定可核验证据和支持案例。',
  case_missing: '补至少两个事实案例，并说明它们支持哪个论点。',
  counterargument_missing: '补一个真正合理、不是稻草人的反方。',
  counterargument_response_missing: '以证据和边界回应反方，而不是回避或贬低。',
  rhetorical_transition_missing: '用有目的的转场连接论点、案例、反方和结论。',
  action_conclusion_missing: '给受众一个具体、可执行且不夸大的行动结论。',
  institutional_wording_unconfirmed: '机构立场、政策口径或行动号召必须完成确认。',
  value_boundary_missing: '补价值提炼与历史事实、现实责任之间的边界。',
  scene_action_or_turn_missing: '逐场补可见案例动作和论证推进。',
  truth_boundary_missing: '区分事实、论证、价值判断和未知项。',
};

const nonEmpty = (value: string | undefined) => Boolean(value?.trim());
const ratio = (value: number, total: number) => Math.round(value / Math.max(1, total) * 100);
const isFinalText = (text: string) => text.trim().length >= 180 && !/^(?:大纲|摘要|资料|口号)[:：]/u.test(text.trim());

export function evaluateLectureVideoProfessionalText(input: {
  package: ProfessionalTextPackage;
  lecture_evidence: LectureVideoEvidence;
}): LectureVideoEvaluation {
  const professionalPackage = input.package;
  if (professionalPackage.video_type !== 'lecture_video') throw new Error('lecture_video only');
  const evidence = input.lecture_evidence;
  const contract = getProfessionalTextTypeContract('lecture_video');
  const evidenceIds = new Set(professionalPackage.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id));
  const idsAreKnown = (ids: string[]) => ids.length > 0 && ids.every(id => evidenceIds.has(id));
  const briefCount = [
    professionalPackage.creative_brief.target_audience,
    professionalPackage.creative_brief.platform,
    professionalPackage.creative_brief.target_duration,
    professionalPackage.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const caseIds = new Set(evidence.cases.map(item => item.case_id));
  const argumentsReady = evidence.arguments.length >= 3 && evidence.arguments.every((argument, index) =>
    argument.order === index + 1 && nonEmpty(argument.claim) && nonEmpty(argument.reasoning)
  );
  const argumentEvidenceReady = argumentsReady && evidence.arguments.every(argument =>
    idsAreKnown(argument.evidence_ids) && argument.case_ids.length > 0 && argument.case_ids.every(caseId => caseIds.has(caseId))
  );
  const casesReady = evidence.cases.length >= 2 && evidence.cases.every(item =>
    nonEmpty(item.title) && nonEmpty(item.factual_summary) && nonEmpty(item.what_it_supports) && idsAreKnown(item.evidence_ids)
  );
  const counterargumentsReady = evidence.counterarguments.length > 0 && evidence.counterarguments.every(item =>
    nonEmpty(item.position) && nonEmpty(item.why_reasonable) && idsAreKnown(item.evidence_ids)
  );
  const counterargumentResponsesReady = counterargumentsReady && evidence.counterarguments.every(item => nonEmpty(item.response));
  const transitionsReady = evidence.rhetorical_transitions.filter(nonEmpty).length >= 3;
  const actionReady = nonEmpty(evidence.action_conclusion.audience_action)
    && nonEmpty(evidence.action_conclusion.feasibility_boundary);
  const institutionalWordingReady = evidence.action_conclusion.institutional_wording_status !== 'pending';
  const valueBoundaryReady = evidence.value_boundary_notes.filter(nonEmpty).length >= 2;
  const scenesReady = professionalPackage.scene_breakdown.length >= 5 && professionalPackage.scene_breakdown.every(scene =>
    nonEmpty(scene.key_action) && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  );
  const truthReady = professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status === 'verified_fact')
    && professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status !== 'verified_fact')
    && professionalPackage.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0;
  const gateIds = [
    briefCount === 4 ? '' : 'brief_missing',
    isFinalText(professionalPackage.full_text) ? '' : 'full_text_not_final',
    nonEmpty(evidence.thesis) ? '' : 'thesis_missing',
    nonEmpty(evidence.audience_tension) ? '' : 'audience_tension_missing',
    argumentsReady ? '' : 'argument_chain_missing',
    argumentEvidenceReady ? '' : 'argument_evidence_missing',
    casesReady ? '' : 'case_missing',
    counterargumentsReady ? '' : 'counterargument_missing',
    counterargumentResponsesReady ? '' : 'counterargument_response_missing',
    transitionsReady ? '' : 'rhetorical_transition_missing',
    actionReady ? '' : 'action_conclusion_missing',
    institutionalWordingReady ? '' : 'institutional_wording_unconfirmed',
    valueBoundaryReady ? '' : 'value_boundary_missing',
    scenesReady ? '' : 'scene_action_or_turn_missing',
    truthReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);
  const dimension = (score: number, issues: string[] = []) => ({ score, evidence: [] as string[], issues });
  const dimensions: Record<ProfessionalQualityDimensionId, ReturnType<typeof dimension>> = {
    creative_brief_and_audience_promise: dimension(ratio(briefCount + Number(nonEmpty(professionalPackage.audience_promise)), 5)),
    premise_and_theme_unity: dimension(ratio(Number(nonEmpty(evidence.thesis)) + Number(nonEmpty(professionalPackage.theme_statement)), 2)),
    structure_causality_and_pacing: dimension(ratio(Number(argumentsReady) + Number(argumentEvidenceReady) + Number(transitionsReady), 3), argumentsReady ? [] : ['论证链不成立。']),
    character_agency_and_relationship_change: dimension(ratio(Number(nonEmpty(evidence.audience_tension)) + Number(actionReady), 2)),
    scene_function_visible_action_and_blocking: dimension(ratio(Number(casesReady) + Number(scenesReady), 2)),
    dialogue_narration_and_subtext: dimension(ratio(Number(counterargumentsReady) + Number(counterargumentResponsesReady) + Number(transitionsReady), 3)),
    emotional_curve_and_aftertaste: dimension(ratio(Number(nonEmpty(evidence.audience_tension)) + Number(actionReady) + Number(valueBoundaryReady), 3)),
    cultural_fact_and_adaptation_boundary: dimension(ratio(Number(argumentEvidenceReady) + Number(valueBoundaryReady) + Number(truthReady), 3), truthReady ? [] : ['事实与价值判断边界不足。']),
    production_executability: dimension(ratio(Number(casesReady) + Number(transitionsReady) + Number(scenesReady), 3)),
    originality_and_distinctiveness: dimension(50, ['需真人演讲编辑、导演和事实评审。']),
  };
  const totalScore = Math.round(Object.entries(contract.quality_dimension_weights).reduce(
    (sum, [dimensionId, weight]) => sum + dimensions[dimensionId as ProfessionalQualityDimensionId].score * weight / 100,
    0,
  ));
  const status = gateIds.length ? 'failed' : totalScore >= 85 ? 'professional_candidate' : totalScore >= 80 ? 'production_candidate' : 'failed';
  return {
    quality_report: {
      status,
      total_score: totalScore,
      dimensions: Object.entries(contract.quality_dimension_weights).map(([dimensionId, weight]) => ({
        dimension_id: dimensionId as ProfessionalQualityDimensionId,
        weight,
        score: dimensions[dimensionId as ProfessionalQualityDimensionId].score,
        evidence: [],
        issues: dimensions[dimensionId as ProfessionalQualityDimensionId].issues,
      })),
      hard_gate_failures: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
      professional_passed: false,
      evaluator_notes: ['机器评分不构成专业通过。', '缺真实模型、演讲编辑、事实文化和导演人审。'],
    },
    coverage_report: {
      verdict: gateIds.length ? 'rebuild' : 'pass',
      strengths: Object.entries(dimensions).filter(([, value]) => value.score >= 85).map(([dimensionId]) => dimensionId),
      structure_notes: dimensions.structure_causality_and_pacing.issues,
      character_or_information_notes: counterargumentsReady ? [] : ['缺合理反方。'],
      scene_notes: scenesReady ? [] : ['案例没有形成可见论证推进。'],
      dialogue_or_narration_notes: counterargumentResponsesReady ? [] : ['没有以证据回应反方。'],
      pacing_notes: transitionsReady ? [] : ['论点之间缺有目的的修辞转场。'],
      fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
      production_notes: [],
      action_items: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
    },
  };
}

export const lectureVideoHardGateRepair = (gateId: string) => repairs[gateId];
