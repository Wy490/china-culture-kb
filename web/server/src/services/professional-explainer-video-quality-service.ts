import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface ExplainerConceptUnit {
  concept_id: string;
  order: number;
  concept: string;
  definition: string;
  one_core_concept: boolean;
  evidence_ids: string[];
}

export interface ExplainerExample {
  example_id: string;
  mapped_concept_id: string;
  description: string;
  what_it_proves: string;
  evidence_ids: string[];
}

export interface ExplainerVisualExplanation {
  visual_id: string;
  mapped_concept_id: string;
  visual_mechanism: string;
  causal_mapping: string;
  limitation_or_non_equivalence: string;
}

export interface ExplainerMisconception {
  misconception: string;
  correction: string;
  evidence_ids: string[];
}

export interface ExplainerVideoEvidence {
  core_question: string;
  audience_prior_knowledge: string;
  concept_units: ExplainerConceptUnit[];
  examples: ExplainerExample[];
  visual_explanations: ExplainerVisualExplanation[];
  misconceptions: ExplainerMisconception[];
  summary_points: string[];
  transfer_check_question: string;
  scene_turns: Record<string, string>;
}

export interface ExplainerVideoEvaluation {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

const repairs: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长和传播目标。',
  full_text_not_final: '把知识提纲改为问题驱动、可直接讲述的完整解释文本。',
  core_question_missing: '补一个观众可以理解、文本能够回答的核心问题。',
  prior_knowledge_missing: '明确观众已知内容和需要补齐的认知缺口。',
  concept_sequence_missing: '建立至少三个顺序清楚、证据可追溯的概念单元。',
  one_concept_per_segment_missing: '拆分同时解释多个核心概念的段落。',
  example_mapping_missing: '给概念补具体例子，并说明例子究竟证明什么。',
  visual_explanation_missing: '让图示、动作或比喻展示因果关系，而不是只做装饰。',
  visual_metaphor_boundary_missing: '标出视觉比喻与真实对象不等价的部分。',
  misconception_missing: '补常见误区、证据支持的纠正和边界。',
  summary_missing: '用至少三个可复述要点总结答案。',
  transfer_check_missing: '补一个能检验观众是否会迁移理解的问题。',
  scene_action_or_turn_missing: '逐场补可见解释动作和认知变化。',
  truth_boundary_missing: '区分事实、解释、视觉比喻和未知项。',
};

const nonEmpty = (value: string | undefined) => Boolean(value?.trim());
const ratio = (value: number, total: number) => Math.round(value / Math.max(1, total) * 100);
const isFinalText = (text: string) => text.trim().length >= 150 && !/^(?:大纲|摘要|资料|知识点)[:：]/u.test(text.trim());

export function evaluateExplainerVideoProfessionalText(input: {
  package: ProfessionalTextPackage;
  explainer_evidence: ExplainerVideoEvidence;
}): ExplainerVideoEvaluation {
  const professionalPackage = input.package;
  if (professionalPackage.video_type !== 'explainer_video') throw new Error('explainer_video only');
  const evidence = input.explainer_evidence;
  const contract = getProfessionalTextTypeContract('explainer_video');
  const evidenceIds = new Set(professionalPackage.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id));
  const idsAreKnown = (ids: string[]) => ids.length > 0 && ids.every(id => evidenceIds.has(id));
  const briefCount = [
    professionalPackage.creative_brief.target_audience,
    professionalPackage.creative_brief.platform,
    professionalPackage.creative_brief.target_duration,
    professionalPackage.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const conceptIds = new Set(evidence.concept_units.map(unit => unit.concept_id));
  const conceptsReady = evidence.concept_units.length >= 3 && evidence.concept_units.every((unit, index) =>
    unit.order === index + 1 && nonEmpty(unit.concept) && nonEmpty(unit.definition) && idsAreKnown(unit.evidence_ids)
  );
  const oneConceptReady = conceptsReady && evidence.concept_units.every(unit => unit.one_core_concept);
  const examplesReady = evidence.examples.length >= 2 && evidence.examples.every(example =>
    conceptIds.has(example.mapped_concept_id)
    && nonEmpty(example.description)
    && nonEmpty(example.what_it_proves)
    && idsAreKnown(example.evidence_ids)
  );
  const visualsReady = evidence.visual_explanations.length >= evidence.concept_units.length
    && evidence.visual_explanations.every(visual =>
      conceptIds.has(visual.mapped_concept_id) && nonEmpty(visual.visual_mechanism) && nonEmpty(visual.causal_mapping)
    );
  const visualBoundaryReady = visualsReady && evidence.visual_explanations.every(visual =>
    nonEmpty(visual.limitation_or_non_equivalence)
  );
  const misconceptionsReady = evidence.misconceptions.length > 0 && evidence.misconceptions.every(item =>
    nonEmpty(item.misconception) && nonEmpty(item.correction) && idsAreKnown(item.evidence_ids)
  );
  const summaryReady = evidence.summary_points.filter(nonEmpty).length >= 3;
  const scenesReady = professionalPackage.scene_breakdown.length >= 4 && professionalPackage.scene_breakdown.every(scene =>
    nonEmpty(scene.key_action) && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  );
  const truthReady = professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status === 'verified_fact')
    && professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status !== 'verified_fact')
    && professionalPackage.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0;
  const gateIds = [
    briefCount === 4 ? '' : 'brief_missing',
    isFinalText(professionalPackage.full_text) ? '' : 'full_text_not_final',
    nonEmpty(evidence.core_question) ? '' : 'core_question_missing',
    nonEmpty(evidence.audience_prior_knowledge) ? '' : 'prior_knowledge_missing',
    conceptsReady ? '' : 'concept_sequence_missing',
    oneConceptReady ? '' : 'one_concept_per_segment_missing',
    examplesReady ? '' : 'example_mapping_missing',
    visualsReady ? '' : 'visual_explanation_missing',
    visualBoundaryReady ? '' : 'visual_metaphor_boundary_missing',
    misconceptionsReady ? '' : 'misconception_missing',
    summaryReady ? '' : 'summary_missing',
    nonEmpty(evidence.transfer_check_question) ? '' : 'transfer_check_missing',
    scenesReady ? '' : 'scene_action_or_turn_missing',
    truthReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);
  const dimension = (score: number, issues: string[] = []) => ({ score, evidence: [] as string[], issues });
  const dimensions: Record<ProfessionalQualityDimensionId, ReturnType<typeof dimension>> = {
    creative_brief_and_audience_promise: dimension(ratio(briefCount + Number(nonEmpty(professionalPackage.audience_promise)), 5)),
    premise_and_theme_unity: dimension(ratio(Number(nonEmpty(evidence.core_question)) + Number(nonEmpty(professionalPackage.theme_statement)), 2)),
    structure_causality_and_pacing: dimension(ratio(Number(conceptsReady) + Number(oneConceptReady) + Number(summaryReady), 3), conceptsReady ? [] : ['知识层级不成立。']),
    character_agency_and_relationship_change: dimension(ratio(Number(nonEmpty(evidence.audience_prior_knowledge)) + Number(nonEmpty(evidence.transfer_check_question)), 2)),
    scene_function_visible_action_and_blocking: dimension(ratio(Number(visualsReady) + Number(scenesReady), 2)),
    dialogue_narration_and_subtext: dimension(ratio(Number(oneConceptReady) + Number(summaryReady), 2)),
    emotional_curve_and_aftertaste: dimension(ratio(Number(misconceptionsReady) + Number(nonEmpty(evidence.transfer_check_question)), 2)),
    cultural_fact_and_adaptation_boundary: dimension(ratio(Number(examplesReady) + Number(visualBoundaryReady) + Number(truthReady), 3), truthReady ? [] : ['事实、解释和比喻边界不足。']),
    production_executability: dimension(ratio(Number(visualsReady) + Number(examplesReady) + Number(scenesReady), 3)),
    originality_and_distinctiveness: dimension(50, ['需真人知识编辑、导演和事实评审。']),
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
      evaluator_notes: ['机器评分不构成专业通过。', '缺真实模型、知识编辑、事实文化和导演人审。'],
    },
    coverage_report: {
      verdict: gateIds.length ? 'rebuild' : 'pass',
      strengths: Object.entries(dimensions).filter(([, value]) => value.score >= 85).map(([dimensionId]) => dimensionId),
      structure_notes: dimensions.structure_causality_and_pacing.issues,
      character_or_information_notes: oneConceptReady ? [] : ['单段概念过载。'],
      scene_notes: scenesReady ? [] : ['画面没有推动理解。'],
      dialogue_or_narration_notes: [],
      pacing_notes: [],
      fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
      production_notes: visualsReady ? [] : ['视觉解释不可执行或只做装饰。'],
      action_items: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
    },
  };
}

export const explainerVideoHardGateRepair = (gateId: string) => repairs[gateId];
