import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface LandscapeVisualPhase {
  phase_id: string;
  order: number;
  time_state: string;
  space_anchor: string;
  composition: string;
  natural_motion: string;
  light_or_weather: string;
  natural_sound: string;
  narration: string;
  shot_duration_sec: number;
  evidence_ids: string[];
  transition_to_next: string;
}

export interface LandscapeMoodEvidence {
  emotional_premise: string;
  visual_phases: LandscapeVisualPhase[];
  without_narration_readable: boolean;
  natural_sound_arc: string[];
  minimal_text_lines: string[];
  ending_silence_sec: number;
  human_trace_notes: string[];
  geographic_boundary_notes: string[];
  scene_turns: Record<string, string>;
}

export interface LandscapeMoodEvaluation {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

const repairs: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长和创作目标。',
  full_text_not_final: '把风景资料或口号列表改为完整视听结构文本。',
  emotional_premise_missing: '明确由视听状态承载的单一情绪命题。',
  visual_phase_missing: '建立至少三个顺序连续、证据可追溯的视听阶段。',
  time_change_missing: '让晨昏、天气、季节或光线发生至少三种状态变化。',
  space_anchor_missing: '每个阶段补具体空间锚点，不能只写抽象山水。',
  composition_rhythm_missing: '每个阶段补构图关系和足够停留时长。',
  natural_motion_missing: '每个阶段补风、雾、水、云、草木或光影的自然运动。',
  light_or_weather_missing: '每个阶段补可见光线或天气状态。',
  natural_sound_missing: '每个阶段补现场自然声，音乐不能替代。',
  transition_missing: '用光、风、水、云、声音或构图变化连接阶段。',
  without_narration_unreadable: '重建视听因果，使去掉旁白后仍能读出时间、空间和情绪。',
  narration_too_dense: '删除知识解释和宣传口号，把文案压到两句以内。',
  ending_silence_missing: '结尾保留至少三秒自然声或静默留白。',
  geographic_boundary_missing: '补真实地点、季节天气、拍摄范围和素材替代边界。',
  scene_action_or_turn_missing: '逐场补自然状态变化和情绪转折。',
  truth_boundary_missing: '区分地理事实、天气计划、视觉组织和未知项。',
};

const nonEmpty = (value: string | undefined) => Boolean(value?.trim());
const ratio = (value: number, total: number) => Math.round(value / Math.max(1, total) * 100);
const isFinalText = (text: string) => text.trim().length >= 120 && !/^(?:大纲|摘要|资料|景色列表|宣传口号)[:：]/u.test(text.trim());

export function evaluateLandscapeMoodProfessionalText(input: {
  package: ProfessionalTextPackage;
  landscape_evidence: LandscapeMoodEvidence;
}): LandscapeMoodEvaluation {
  const professionalPackage = input.package;
  if (professionalPackage.video_type !== 'landscape_mood') throw new Error('landscape_mood only');
  const evidence = input.landscape_evidence;
  const contract = getProfessionalTextTypeContract('landscape_mood');
  const evidenceIds = new Set(professionalPackage.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id));
  const idsAreKnown = (ids: string[]) => ids.length > 0 && ids.every(id => evidenceIds.has(id));
  const briefCount = [
    professionalPackage.creative_brief.target_audience,
    professionalPackage.creative_brief.platform,
    professionalPackage.creative_brief.target_duration,
    professionalPackage.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const phasesReady = evidence.visual_phases.length >= 3 && evidence.visual_phases.every((phase, index) =>
    phase.order === index + 1 && idsAreKnown(phase.evidence_ids)
  );
  const timeChangesReady = new Set(evidence.visual_phases.map(phase => `${phase.time_state.trim()}|${phase.light_or_weather.trim()}`).filter(Boolean)).size >= 3;
  const spacesReady = phasesReady && evidence.visual_phases.every(phase => nonEmpty(phase.space_anchor));
  const compositionsReady = phasesReady && evidence.visual_phases.every(phase => nonEmpty(phase.composition) && phase.shot_duration_sec >= 6);
  const motionsReady = phasesReady && evidence.visual_phases.every(phase => nonEmpty(phase.natural_motion));
  const lightWeatherReady = phasesReady && evidence.visual_phases.every(phase => nonEmpty(phase.light_or_weather));
  const soundsReady = phasesReady && evidence.visual_phases.every(phase => nonEmpty(phase.natural_sound))
    && evidence.natural_sound_arc.filter(nonEmpty).length >= 3;
  const transitionsReady = phasesReady && evidence.visual_phases.slice(0, -1).every(phase => nonEmpty(phase.transition_to_next));
  const narrationReady = evidence.minimal_text_lines.length >= 1 && evidence.minimal_text_lines.length <= 2
    && evidence.minimal_text_lines.every(line => nonEmpty(line) && line.trim().length <= 20)
    && evidence.visual_phases.filter(phase => nonEmpty(phase.narration)).length <= 2
    && evidence.visual_phases.every(phase => !nonEmpty(phase.narration) || phase.narration.trim().length <= 24);
  const geographyReady = evidence.geographic_boundary_notes.filter(nonEmpty).length >= 2;
  const scenesReady = professionalPackage.scene_breakdown.length >= 3 && professionalPackage.scene_breakdown.every(scene =>
    nonEmpty(scene.key_action) && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  );
  const truthReady = professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status === 'verified_fact')
    && professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status !== 'verified_fact')
    && professionalPackage.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0;
  const gateIds = [
    briefCount === 4 ? '' : 'brief_missing',
    isFinalText(professionalPackage.full_text) ? '' : 'full_text_not_final',
    nonEmpty(evidence.emotional_premise) ? '' : 'emotional_premise_missing',
    phasesReady ? '' : 'visual_phase_missing',
    timeChangesReady ? '' : 'time_change_missing',
    spacesReady ? '' : 'space_anchor_missing',
    compositionsReady ? '' : 'composition_rhythm_missing',
    motionsReady ? '' : 'natural_motion_missing',
    lightWeatherReady ? '' : 'light_or_weather_missing',
    soundsReady ? '' : 'natural_sound_missing',
    transitionsReady ? '' : 'transition_missing',
    evidence.without_narration_readable ? '' : 'without_narration_unreadable',
    narrationReady ? '' : 'narration_too_dense',
    evidence.ending_silence_sec >= 3 ? '' : 'ending_silence_missing',
    geographyReady ? '' : 'geographic_boundary_missing',
    scenesReady ? '' : 'scene_action_or_turn_missing',
    truthReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);
  const dimension = (score: number, issues: string[] = []) => ({ score, evidence: [] as string[], issues });
  const dimensions: Record<ProfessionalQualityDimensionId, ReturnType<typeof dimension>> = {
    creative_brief_and_audience_promise: dimension(ratio(briefCount + Number(nonEmpty(professionalPackage.audience_promise)), 5)),
    premise_and_theme_unity: dimension(ratio(Number(nonEmpty(evidence.emotional_premise)) + Number(evidence.without_narration_readable), 2)),
    structure_causality_and_pacing: dimension(ratio(Number(phasesReady) + Number(timeChangesReady) + Number(transitionsReady), 3), phasesReady ? [] : ['视听阶段不成立。']),
    character_agency_and_relationship_change: dimension(ratio(Number(evidence.human_trace_notes.length > 0) + Number(nonEmpty(evidence.emotional_premise)), 2)),
    scene_function_visible_action_and_blocking: dimension(ratio(Number(compositionsReady) + Number(motionsReady) + Number(scenesReady), 3)),
    dialogue_narration_and_subtext: dimension(ratio(Number(narrationReady) + Number(evidence.without_narration_readable), 2)),
    emotional_curve_and_aftertaste: dimension(ratio(Number(timeChangesReady) + Number(soundsReady) + Number(evidence.ending_silence_sec >= 3), 3)),
    cultural_fact_and_adaptation_boundary: dimension(ratio(Number(geographyReady) + Number(truthReady) + Number(spacesReady), 3), truthReady ? [] : ['地理事实和视觉组织边界不足。']),
    production_executability: dimension(ratio(Number(compositionsReady) + Number(soundsReady) + Number(transitionsReady), 3)),
    originality_and_distinctiveness: dimension(50, ['需真人摄影、声音、剪辑和事实评审。']),
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
      evaluator_notes: ['机器评分不构成专业通过。', '缺真实模型、摄影、声音、剪辑、地点和事实人审。'],
    },
    coverage_report: {
      verdict: gateIds.length ? 'rebuild' : 'pass',
      strengths: Object.entries(dimensions).filter(([, value]) => value.score >= 85).map(([dimensionId]) => dimensionId),
      structure_notes: dimensions.structure_causality_and_pacing.issues,
      character_or_information_notes: [],
      scene_notes: motionsReady ? [] : ['自然状态没有发生可见变化。'],
      dialogue_or_narration_notes: narrationReady ? [] : ['文案密度压过画面。'],
      pacing_notes: compositionsReady ? [] : ['构图停留和节奏不足。'],
      fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
      production_notes: soundsReady ? [] : ['自然声弧线不足。'],
      action_items: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
    },
  };
}

export const landscapeMoodHardGateRepair = (gateId: string) => repairs[gateId];
