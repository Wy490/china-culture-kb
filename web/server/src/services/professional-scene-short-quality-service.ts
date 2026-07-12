import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface SceneRouteNode {
  node_id: string;
  order: number;
  space: string;
  entry_action: string;
  trigger: string;
  discovery_or_change: string;
  time_layer: string;
  sound_cue: string;
  shot_action: string;
  evidence_ids: string[];
  transition_to_next: string;
}

export interface SceneShortEvidence {
  spatial_identity: string;
  route_purpose: string;
  space_is_protagonist: boolean;
  route_nodes: SceneRouteNode[];
  person_or_event_trigger: string;
  ending_atmosphere: string;
  geographic_boundary_notes: string[];
  scene_turns: Record<string, string>;
}

export interface SceneShortEvaluation {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

const repairs: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长和创作目标。',
  full_text_not_final: '把景点列表、空间资料或人物生平改为完整场景文本。',
  spatial_identity_missing: '明确空间是什么、承载什么时间和观看关系。',
  route_purpose_missing: '说明观众为什么沿这条路线移动。',
  space_not_protagonist: '删除人物传记式主导，让空间变化推动叙事。',
  route_missing: '建立至少三个顺序连续、证据可追溯的空间节点。',
  trigger_missing: '每个节点补人物动作、物件或事件触发。',
  discovery_or_change_missing: '每个节点必须发生发现、行动结果或时间变化。',
  time_layer_missing: '让路线至少显出两个不同时间层。',
  sound_route_missing: '为每个空间节点补可听见的现场声音。',
  shot_action_missing: '为每个节点补明确镜头行动，而不是静态景色形容。',
  transition_missing: '用移动、声音、光线、物件或动作连接空间节点。',
  ending_atmosphere_missing: '在路线终点形成由视听建立的氛围收束。',
  geographic_boundary_missing: '补地点功能、开放状态、拍摄范围和地理边界。',
  scene_action_or_turn_missing: '逐场补可见行动和空间认识变化。',
  truth_boundary_missing: '区分空间事实、时间叠印、创作组织和未知项。',
};

const nonEmpty = (value: string | undefined) => Boolean(value?.trim());
const ratio = (value: number, total: number) => Math.round(value / Math.max(1, total) * 100);
const isFinalText = (text: string) => text.trim().length >= 130 && !/^(?:大纲|摘要|资料|景点列表|人物生平)[:：]/u.test(text.trim());

export function evaluateSceneShortProfessionalText(input: {
  package: ProfessionalTextPackage;
  scene_evidence: SceneShortEvidence;
}): SceneShortEvaluation {
  const professionalPackage = input.package;
  if (professionalPackage.video_type !== 'scene_short') throw new Error('scene_short only');
  const evidence = input.scene_evidence;
  const contract = getProfessionalTextTypeContract('scene_short');
  const evidenceIds = new Set(professionalPackage.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id));
  const idsAreKnown = (ids: string[]) => ids.length > 0 && ids.every(id => evidenceIds.has(id));
  const briefCount = [
    professionalPackage.creative_brief.target_audience,
    professionalPackage.creative_brief.platform,
    professionalPackage.creative_brief.target_duration,
    professionalPackage.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const routeReady = evidence.route_nodes.length >= 3 && evidence.route_nodes.every((node, index) =>
    node.order === index + 1 && nonEmpty(node.space) && nonEmpty(node.entry_action) && idsAreKnown(node.evidence_ids)
  );
  const triggersReady = routeReady && evidence.route_nodes.every(node => nonEmpty(node.trigger));
  const discoveriesReady = routeReady && evidence.route_nodes.every(node => nonEmpty(node.discovery_or_change));
  const timeLayersReady = new Set(evidence.route_nodes.map(node => node.time_layer.trim()).filter(Boolean)).size >= 2;
  const soundsReady = routeReady && evidence.route_nodes.every(node => nonEmpty(node.sound_cue));
  const shotsReady = routeReady && evidence.route_nodes.every(node => nonEmpty(node.shot_action));
  const transitionsReady = routeReady && evidence.route_nodes.slice(0, -1).every(node => nonEmpty(node.transition_to_next));
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
    nonEmpty(evidence.spatial_identity) ? '' : 'spatial_identity_missing',
    nonEmpty(evidence.route_purpose) ? '' : 'route_purpose_missing',
    evidence.space_is_protagonist ? '' : 'space_not_protagonist',
    routeReady ? '' : 'route_missing',
    triggersReady ? '' : 'trigger_missing',
    discoveriesReady ? '' : 'discovery_or_change_missing',
    timeLayersReady ? '' : 'time_layer_missing',
    soundsReady ? '' : 'sound_route_missing',
    shotsReady ? '' : 'shot_action_missing',
    transitionsReady ? '' : 'transition_missing',
    nonEmpty(evidence.ending_atmosphere) ? '' : 'ending_atmosphere_missing',
    geographyReady ? '' : 'geographic_boundary_missing',
    scenesReady ? '' : 'scene_action_or_turn_missing',
    truthReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);
  const dimension = (score: number, issues: string[] = []) => ({ score, evidence: [] as string[], issues });
  const dimensions: Record<ProfessionalQualityDimensionId, ReturnType<typeof dimension>> = {
    creative_brief_and_audience_promise: dimension(ratio(briefCount + Number(nonEmpty(professionalPackage.audience_promise)), 5)),
    premise_and_theme_unity: dimension(ratio(Number(nonEmpty(evidence.spatial_identity)) + Number(nonEmpty(evidence.route_purpose)) + Number(evidence.space_is_protagonist), 3)),
    structure_causality_and_pacing: dimension(ratio(Number(routeReady) + Number(transitionsReady) + Number(discoveriesReady), 3), routeReady ? [] : ['空间路线不成立。']),
    character_agency_and_relationship_change: dimension(ratio(Number(triggersReady) + Number(nonEmpty(evidence.person_or_event_trigger)), 2)),
    scene_function_visible_action_and_blocking: dimension(ratio(Number(shotsReady) + Number(scenesReady), 2)),
    dialogue_narration_and_subtext: dimension(ratio(Number(soundsReady) + Number(nonEmpty(evidence.ending_atmosphere)), 2)),
    emotional_curve_and_aftertaste: dimension(ratio(Number(timeLayersReady) + Number(nonEmpty(evidence.ending_atmosphere)), 2)),
    cultural_fact_and_adaptation_boundary: dimension(ratio(Number(geographyReady) + Number(truthReady) + Number(discoveriesReady), 3), truthReady ? [] : ['空间事实和时间层边界不足。']),
    production_executability: dimension(ratio(Number(routeReady) + Number(shotsReady) + Number(soundsReady), 3)),
    originality_and_distinctiveness: dimension(50, ['需真人空间导演、声音和事实评审。']),
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
      evaluator_notes: ['机器评分不构成专业通过。', '缺真实模型、空间导演、声音、事实和拍摄人审。'],
    },
    coverage_report: {
      verdict: gateIds.length ? 'rebuild' : 'pass',
      strengths: Object.entries(dimensions).filter(([, value]) => value.score >= 85).map(([dimensionId]) => dimensionId),
      structure_notes: dimensions.structure_causality_and_pacing.issues,
      character_or_information_notes: triggersReady ? [] : ['空间缺人物或事件触发。'],
      scene_notes: discoveriesReady ? [] : ['空间节点没有发生变化或发现。'],
      dialogue_or_narration_notes: [],
      pacing_notes: transitionsReady ? [] : ['空间转场不连续。'],
      fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
      production_notes: shotsReady && soundsReady ? [] : ['镜头行动或声音路线不足。'],
      action_items: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
    },
  };
}

export const sceneShortHardGateRepair = (gateId: string) => repairs[gateId];
