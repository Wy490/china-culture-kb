import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface DocumentarySiteEvidence {
  site_id: string;
  place: string;
  present_evidence: string;
  shootable_action: string;
  evidence_ids: string[];
}

export interface DocumentaryInterviewRole {
  role_id: string;
  role_description: string;
  confirmed: boolean;
  consent_status: 'confirmed' | 'pending' | 'not_applicable';
  allowed_topics: string[];
  evidence_ids: string[];
}

export interface DocumentarySourceClue {
  clue_id: string;
  source_label: string;
  claim: string;
  visual_handling: string;
  evidence_ids: string[];
}

export interface DocumentaryDiscoveryStep {
  order: number;
  question_or_discovery: string;
  evidence_ids: string[];
  leads_to: string;
}

export interface DocumentaryBrollShot {
  shot_id: string;
  visible_action: string;
  evidence_ids: string[];
}

export interface DocumentaryShortEvidence {
  core_question: string;
  present_day_observer: string;
  real_sites: DocumentarySiteEvidence[];
  interview_roles: DocumentaryInterviewRole[];
  source_clues: DocumentarySourceClue[];
  discovery_chain: DocumentaryDiscoveryStep[];
  b_roll_plan: DocumentaryBrollShot[];
  reenactment_boundaries: string[];
  restrained_narration_rules: string[];
  scene_turns: Record<string, string>;
}

export interface DocumentaryShortEvaluation {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

const repairs: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长和传播目标。',
  full_text_not_final: '把资料提要改为现实现场与证据推动的完整纪录文本。',
  core_question_missing: '从今天可见的痕迹提出单一、可调查的核心问题。',
  observer_missing: '补现实中的观察者身份和调查动作。',
  real_site_missing: '补至少一个可核验地点或实物及现场可拍动作。',
  interview_role_missing: '明确受访角色、可谈范围和证据关联。',
  interview_consent_missing: '未确认采访或授权时不得生成其发言。',
  source_trace_missing: '补至少两条可追溯史料线索、主张和画面处理。',
  discovery_chain_missing: '用至少四步问题与证据链推动发现。',
  b_roll_missing: '补至少四个有证据关联的现场、实物或查阅动作镜头。',
  reenactment_boundary_missing: '明确再现标识、禁止虚构对白和证据替代边界。',
  narration_restraint_missing: '限制旁白替观众下结论或替缺失证据补事实。',
  scene_action_or_turn_missing: '逐场补可见调查动作和认识变化。',
  truth_boundary_missing: '区分已核事实、计划采访、再现组织和未知项。',
};

const nonEmpty = (value: string | undefined) => Boolean(value?.trim());
const ratio = (value: number, total: number) => Math.round(value / Math.max(1, total) * 100);
const isFinalText = (text: string) => text.trim().length >= 160 && !/^(?:大纲|摘要|资料|采访提纲)[:：]/u.test(text.trim());

export function evaluateDocumentaryShortProfessionalText(input: {
  package: ProfessionalTextPackage;
  documentary_evidence: DocumentaryShortEvidence;
}): DocumentaryShortEvaluation {
  const professionalPackage = input.package;
  if (professionalPackage.video_type !== 'documentary_short') throw new Error('documentary_short only');
  const evidence = input.documentary_evidence;
  const contract = getProfessionalTextTypeContract('documentary_short');
  const evidenceIds = new Set(professionalPackage.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id));
  const idsAreKnown = (ids: string[]) => ids.length > 0 && ids.every(id => evidenceIds.has(id));
  const briefCount = [
    professionalPackage.creative_brief.target_audience,
    professionalPackage.creative_brief.platform,
    professionalPackage.creative_brief.target_duration,
    professionalPackage.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const sitesReady = evidence.real_sites.length > 0 && evidence.real_sites.every(site =>
    nonEmpty(site.place) && nonEmpty(site.present_evidence) && nonEmpty(site.shootable_action) && idsAreKnown(site.evidence_ids)
  );
  const interviewsReady = evidence.interview_roles.length > 0 && evidence.interview_roles.every(role =>
    nonEmpty(role.role_description) && role.allowed_topics.filter(nonEmpty).length > 0 && idsAreKnown(role.evidence_ids)
  );
  const interviewConsentReady = interviewsReady && evidence.interview_roles.every(role =>
    role.confirmed && role.consent_status === 'confirmed'
  );
  const sourcesReady = evidence.source_clues.length >= 2 && evidence.source_clues.every(clue =>
    nonEmpty(clue.source_label) && nonEmpty(clue.claim) && nonEmpty(clue.visual_handling) && idsAreKnown(clue.evidence_ids)
  );
  const discoveryReady = evidence.discovery_chain.length >= 4 && evidence.discovery_chain.every((step, index) =>
    step.order === index + 1 && nonEmpty(step.question_or_discovery) && nonEmpty(step.leads_to) && idsAreKnown(step.evidence_ids)
  );
  const brollReady = evidence.b_roll_plan.length >= 4 && evidence.b_roll_plan.every(shot =>
    nonEmpty(shot.visible_action) && idsAreKnown(shot.evidence_ids)
  );
  const reenactmentReady = evidence.reenactment_boundaries.filter(nonEmpty).length >= 2;
  const narrationReady = evidence.restrained_narration_rules.filter(nonEmpty).length >= 2;
  const scenesReady = professionalPackage.scene_breakdown.length >= 5 && professionalPackage.scene_breakdown.every(scene =>
    nonEmpty(scene.key_action) && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  );
  const truthReady = professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status === 'verified_fact')
    && professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status !== 'verified_fact')
    && professionalPackage.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0;
  const gateIds = [
    briefCount === 4 ? '' : 'brief_missing',
    isFinalText(professionalPackage.full_text) ? '' : 'full_text_not_final',
    nonEmpty(evidence.core_question) ? '' : 'core_question_missing',
    nonEmpty(evidence.present_day_observer) ? '' : 'observer_missing',
    sitesReady ? '' : 'real_site_missing',
    interviewsReady ? '' : 'interview_role_missing',
    interviewConsentReady ? '' : 'interview_consent_missing',
    sourcesReady ? '' : 'source_trace_missing',
    discoveryReady ? '' : 'discovery_chain_missing',
    brollReady ? '' : 'b_roll_missing',
    reenactmentReady ? '' : 'reenactment_boundary_missing',
    narrationReady ? '' : 'narration_restraint_missing',
    scenesReady ? '' : 'scene_action_or_turn_missing',
    truthReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);
  const dimension = (score: number, issues: string[] = []) => ({ score, evidence: [] as string[], issues });
  const dimensions: Record<ProfessionalQualityDimensionId, ReturnType<typeof dimension>> = {
    creative_brief_and_audience_promise: dimension(ratio(briefCount + Number(nonEmpty(professionalPackage.audience_promise)), 5)),
    premise_and_theme_unity: dimension(ratio(Number(nonEmpty(evidence.core_question)) + Number(nonEmpty(professionalPackage.theme_statement)), 2)),
    structure_causality_and_pacing: dimension(ratio(Number(discoveryReady) + Number(sourcesReady) + Number(scenesReady), 3), discoveryReady ? [] : ['发现链不成立。']),
    character_agency_and_relationship_change: dimension(ratio(Number(nonEmpty(evidence.present_day_observer)) + Number(interviewsReady) + Number(interviewConsentReady), 3)),
    scene_function_visible_action_and_blocking: dimension(ratio(Number(sitesReady) + Number(brollReady) + Number(scenesReady), 3)),
    dialogue_narration_and_subtext: dimension(ratio(Number(interviewConsentReady) + Number(narrationReady), 2)),
    emotional_curve_and_aftertaste: dimension(ratio(Number(discoveryReady) + Number(nonEmpty(professionalPackage.theme_statement)), 2)),
    cultural_fact_and_adaptation_boundary: dimension(ratio(Number(sourcesReady) + Number(reenactmentReady) + Number(truthReady), 3), truthReady ? [] : ['证据或再现边界不足。']),
    production_executability: dimension(ratio(Number(sitesReady) + Number(brollReady) + Number(interviewConsentReady), 3)),
    originality_and_distinctiveness: dimension(50, ['需真人纪录片编辑、导演和事实评审。']),
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
      evaluator_notes: ['机器评分不构成专业通过。', '缺真实模型、真实现场、受访者授权和纪录片三角色人审。'],
    },
    coverage_report: {
      verdict: gateIds.length ? 'rebuild' : 'pass',
      strengths: Object.entries(dimensions).filter(([, value]) => value.score >= 85).map(([dimensionId]) => dimensionId),
      structure_notes: dimensions.structure_causality_and_pacing.issues,
      character_or_information_notes: interviewConsentReady ? [] : ['采访未确认或未授权。'],
      scene_notes: scenesReady ? [] : ['现实现场与证据发现没有形成逐场变化。'],
      dialogue_or_narration_notes: narrationReady ? [] : ['旁白边界不足。'],
      pacing_notes: [],
      fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
      production_notes: brollReady ? [] : ['B-roll计划不足。'],
      action_items: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
    },
  };
}

export const documentaryShortHardGateRepair = (gateId: string) => repairs[gateId];
