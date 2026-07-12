import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface AiComicPanelBeat {
  panel_id: string;
  scene_id: number;
  order: number;
  framing: string;
  visible_action: string;
  expression: string;
  dialogue_bubble?: string;
  reaction_panel: boolean;
  asset_ids: string[];
}

export interface AiComicAssetDefinition {
  asset_id: string;
  asset_type: 'character' | 'prop' | 'location';
  label: string;
  continuity_rule: string;
}

export interface AiComicDramaProfessionalEvidence {
  protagonist: string;
  episode_hook: string;
  relationship_collision: string;
  reversal_or_choice: string;
  ending_hook: string;
  ending_visible_action: string;
  panel_beats: AiComicPanelBeat[];
  asset_bible: AiComicAssetDefinition[];
  max_bubble_characters: number;
  scene_turns: Record<string, string>;
}

export interface AiComicDramaProfessionalEvaluationResult {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

interface DimensionResult {
  score: number;
  evidence: string[];
  issues: string[];
}

const HARD_GATE_REPAIRS: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长、传播目标和观众承诺。',
  full_text_not_final: '把漫剧大纲或内部说明改成完整观众稿。',
  episode_hook_missing: '用第一场第一格的强画面和未决问题建立集钩子。',
  relationship_collision_missing: '明确两名以上角色的当下立场碰撞，不能只有单人旁白。',
  panelability_missing: '每场拆成 3 至 6 个有顺序的稳定漫画格。',
  visible_action_missing: '每格补齐构图、可画动作和登记资产，不能只写抽象情绪。',
  bubble_dialogue_missing: '压缩气泡对白，保持短句和角色来回，不用长旁白承担全部叙事。',
  expression_reaction_missing: '每场至少安排一个明确表情或反应格。',
  reversal_or_choice_missing: '加入可画的反转或主动选择，让关系和局面发生变化。',
  ending_hook_missing: '最后一格必须有可见动作和下一步未决问题。',
  asset_continuity_missing: '建立角色、道具、地点资产表，并确保每格引用有效资产 ID。',
  scene_action_or_turn_missing: '逐场补齐主要行动和情绪/关系变化。',
  truth_boundary_missing: '区分文化事实、影视化补足、虚构情节和未知项。',
};

function nonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function ratioScore(completed: number, total: number): number {
  return Math.round((completed / Math.max(1, total)) * 100);
}

function dimension(score: number, evidence: string[], issues: string[]): DimensionResult {
  return { score: Math.max(0, Math.min(100, Math.round(score))), evidence, issues };
}

function isFinalAudienceText(value: string): boolean {
  const text = value.trim();
  return text.length >= 120
    && !/^(?:大纲|摘要|资料|分析|创作思路|分镜规划[:：])/u.test(text)
    && !/(?:TODO|待补|内部分析|仅供测试)/u.test(text);
}

export function evaluateAiComicDramaProfessionalText(input: {
  package: ProfessionalTextPackage;
  comic_evidence: AiComicDramaProfessionalEvidence;
}): AiComicDramaProfessionalEvaluationResult {
  const pkg = input.package;
  if (pkg.video_type !== 'ai_comic_drama') {
    throw new Error('evaluateAiComicDramaProfessionalText only accepts ai_comic_drama packages');
  }
  const evidence = input.comic_evidence;
  const contract = getProfessionalTextTypeContract('ai_comic_drama');
  const briefChecks = [
    pkg.creative_brief.target_audience,
    pkg.creative_brief.platform,
    pkg.creative_brief.target_duration,
    pkg.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const premiseChecks = [pkg.audience_promise, pkg.premise_or_core_question, pkg.theme_statement]
    .filter(nonEmpty).length;
  const sceneCount = pkg.scene_breakdown.length;
  const sceneIds = pkg.scene_breakdown.map(scene => Number(scene.scene_id));
  const assetIds = new Set(evidence.asset_bible.map(asset => asset.asset_id));
  const assetBibleReady = evidence.asset_bible.length >= 3
    && assetIds.size === evidence.asset_bible.length
    && evidence.asset_bible.every(asset =>
      nonEmpty(asset.asset_id) && nonEmpty(asset.label) && nonEmpty(asset.continuity_rule)
    );
  const panelsByScene = new Map<number, AiComicPanelBeat[]>();
  for (const panel of evidence.panel_beats) {
    const list = panelsByScene.get(panel.scene_id) ?? [];
    list.push(panel);
    panelsByScene.set(panel.scene_id, list);
  }
  const panelabilityReady = sceneIds.every(sceneId => {
    const panels = panelsByScene.get(sceneId) ?? [];
    return panels.length >= 3
      && panels.length <= 6
      && panels.every((panel, index) => panel.order === index + 1);
  });
  const visibleActionReady = evidence.panel_beats.length > 0
    && evidence.panel_beats.every(panel =>
      nonEmpty(panel.panel_id)
      && nonEmpty(panel.framing)
      && nonEmpty(panel.visible_action)
      && nonEmpty(panel.expression)
      && panel.asset_ids.length > 0
      && panel.asset_ids.every(assetId => assetIds.has(assetId))
    );
  const bubbleReady = evidence.max_bubble_characters >= 6
    && evidence.max_bubble_characters <= 30
    && evidence.panel_beats.filter(panel => nonEmpty(panel.dialogue_bubble)).length >= sceneCount
    && evidence.panel_beats.every(panel =>
      !panel.dialogue_bubble || panel.dialogue_bubble.length <= evidence.max_bubble_characters
    );
  const reactionReady = sceneIds.every(sceneId =>
    (panelsByScene.get(sceneId) ?? []).some(panel => panel.reaction_panel && nonEmpty(panel.expression))
  );
  const sceneActionReady = pkg.scene_breakdown.filter(scene =>
    nonEmpty(scene.key_action)
    && nonEmpty(scene.conflict ?? scene.plot)
    && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  ).length === sceneCount;
  const hookReady = nonEmpty(evidence.episode_hook)
    && (panelsByScene.get(sceneIds[0] ?? -1)?.length ?? 0) >= 3;
  const endingReady = nonEmpty(evidence.ending_hook)
    && nonEmpty(evidence.ending_visible_action)
    && (panelsByScene.get(sceneIds.at(-1) ?? -1)?.length ?? 0) >= 3;
  const verifiedFactCount = pkg.research_and_evidence_dossier.evidence_items
    .filter(item => item.status === 'verified_fact').length;
  const adaptedCount = pkg.research_and_evidence_dossier.evidence_items
    .filter(item => item.status === 'plausible_dramatization' || item.status === 'fictional_addition').length;
  const truthBoundaryReady = verifiedFactCount > 0
    && adaptedCount > 0
    && pkg.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0
    && pkg.truth_and_adaptation_contract.required_disclaimers.length > 0;

  const hardGateIds = [
    briefChecks === 4 && nonEmpty(pkg.audience_promise) ? '' : 'brief_missing',
    isFinalAudienceText(pkg.full_text) ? '' : 'full_text_not_final',
    hookReady ? '' : 'episode_hook_missing',
    nonEmpty(evidence.relationship_collision) ? '' : 'relationship_collision_missing',
    panelabilityReady ? '' : 'panelability_missing',
    visibleActionReady ? '' : 'visible_action_missing',
    bubbleReady ? '' : 'bubble_dialogue_missing',
    reactionReady ? '' : 'expression_reaction_missing',
    nonEmpty(evidence.reversal_or_choice) ? '' : 'reversal_or_choice_missing',
    endingReady ? '' : 'ending_hook_missing',
    assetBibleReady ? '' : 'asset_continuity_missing',
    sceneActionReady ? '' : 'scene_action_or_turn_missing',
    truthBoundaryReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);

  const dimensions: Record<ProfessionalQualityDimensionId, DimensionResult> = {
    creative_brief_and_audience_promise: dimension(
      ratioScore(briefChecks + Number(nonEmpty(pkg.audience_promise)), 5),
      [`brief_fields=${briefChecks}/4`],
      briefChecks === 4 ? [] : ['创作简报不完整。'],
    ),
    premise_and_theme_unity: dimension(
      ratioScore(premiseChecks + Number(hookReady), 4),
      [`premise_fields=${premiseChecks}/3`, `hook=${hookReady}`],
      premiseChecks === 3 && hookReady ? [] : ['集钩子、核心问题和主题没有闭环。'],
    ),
    structure_causality_and_pacing: dimension(
      ratioScore(Number(panelabilityReady) + Number(hookReady) + Number(nonEmpty(evidence.reversal_or_choice)) + Number(endingReady), 4),
      [`panel_count=${evidence.panel_beats.length}`, `ending_hook=${endingReady}`],
      panelabilityReady && endingReady ? [] : ['分格节拍、反转或结尾钩子不足。'],
    ),
    character_agency_and_relationship_change: dimension(
      ratioScore(Number(nonEmpty(evidence.protagonist)) + Number(nonEmpty(evidence.relationship_collision)) + Number(nonEmpty(evidence.reversal_or_choice)), 3),
      [`relationship_collision=${nonEmpty(evidence.relationship_collision)}`],
      nonEmpty(evidence.relationship_collision) ? [] : ['人物关系没有发生可画的碰撞与变化。'],
    ),
    scene_function_visible_action_and_blocking: dimension(
      ratioScore(Number(panelabilityReady) + Number(visibleActionReady) + Number(sceneActionReady), 3),
      [`panelability=${panelabilityReady}`, `visible_action=${visibleActionReady}`],
      visibleActionReady ? [] : ['存在不可画或依赖抽象说明的漫画格。'],
    ),
    dialogue_narration_and_subtext: dimension(
      ratioScore(Number(bubbleReady) + Number(reactionReady) + Number(nonEmpty(evidence.relationship_collision)), 3),
      [`bubble_limit=${evidence.max_bubble_characters}`, `reaction_each_scene=${reactionReady}`],
      bubbleReady && reactionReady ? [] : ['气泡对白过长、来回不足或缺反应格。'],
    ),
    emotional_curve_and_aftertaste: dimension(
      ratioScore(Object.values(evidence.scene_turns).filter(nonEmpty).length + Number(endingReady), sceneCount + 1),
      [`scene_turns=${Object.values(evidence.scene_turns).filter(nonEmpty).length}/${sceneCount}`],
      endingReady ? [] : ['情绪节拍或结尾追看余味不足。'],
    ),
    cultural_fact_and_adaptation_boundary: dimension(
      truthBoundaryReady ? 90 : ratioScore(verifiedFactCount + adaptedCount, 3),
      [`verified_facts=${verifiedFactCount}`, `adapted_items=${adaptedCount}`],
      truthBoundaryReady ? [] : ['文化事实、戏剧化补足和虚构边界不完整。'],
    ),
    production_executability: dimension(
      ratioScore(Number(assetBibleReady) + Number(visibleActionReady) + Number(pkg.delivery_text_package.scene_units.length === sceneCount), 3),
      [`asset_count=${evidence.asset_bible.length}`, `delivery_units=${pkg.delivery_text_package.scene_units.length}`],
      assetBibleReady && visibleActionReady ? [] : ['资产表、格级引用或交付单元不足。'],
    ),
    originality_and_distinctiveness: dimension(50, ['machine_originality_verdict=not_allowed'], ['原创性和漫画追看力必须由固定基准与真人盲评确认。']),
  };
  const weightedScore = Math.round(Object.entries(contract.quality_dimension_weights).reduce(
    (sum, [dimensionId, weight]) => sum + dimensions[dimensionId as ProfessionalQualityDimensionId].score * (weight / 100),
    0,
  ));
  const status = hardGateIds.length > 0 ? 'failed' : weightedScore >= 90 ? 'high_quality_candidate' : weightedScore >= 85 ? 'professional_candidate' : weightedScore >= 80 ? 'production_candidate' : 'failed';
  return {
    quality_report: {
      status,
      total_score: weightedScore,
      dimensions: Object.entries(contract.quality_dimension_weights).map(([dimensionId, weight]) => ({
        dimension_id: dimensionId as ProfessionalQualityDimensionId,
        weight,
        score: dimensions[dimensionId as ProfessionalQualityDimensionId].score,
        evidence: dimensions[dimensionId as ProfessionalQualityDimensionId].evidence,
        issues: dimensions[dimensionId as ProfessionalQualityDimensionId].issues,
      })),
      hard_gate_failures: hardGateIds.map(gateId => `${gateId}: ${HARD_GATE_REPAIRS[gateId]}`),
      professional_passed: false,
      evaluator_notes: ['机器评分只用于 Coverage 和修订路由。', '缺少真实模型成稿、漫画导演/资产连续性评审和真人盲评，professional_passed 固定为 false。'],
    },
    coverage_report: {
      verdict: hardGateIds.some(id => ['full_text_not_final', 'panelability_missing', 'visible_action_missing', 'asset_continuity_missing'].includes(id)) ? 'rebuild' : hardGateIds.length > 0 || weightedScore < 80 ? 'revise' : 'pass',
      strengths: Object.entries(dimensions).filter(([, result]) => result.score >= 85).map(([dimensionId]) => dimensionId),
      structure_notes: dimensions.structure_causality_and_pacing.issues,
      character_or_information_notes: dimensions.character_agency_and_relationship_change.issues,
      scene_notes: dimensions.scene_function_visible_action_and_blocking.issues,
      dialogue_or_narration_notes: dimensions.dialogue_narration_and_subtext.issues,
      pacing_notes: dimensions.emotional_curve_and_aftertaste.issues,
      fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
      production_notes: dimensions.production_executability.issues,
      action_items: hardGateIds.map(gateId => `${gateId}: ${HARD_GATE_REPAIRS[gateId]}`),
    },
  };
}

export function aiComicDramaHardGateRepair(gateId: string): string | undefined {
  return HARD_GATE_REPAIRS[gateId];
}
