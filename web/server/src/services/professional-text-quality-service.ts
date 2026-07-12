import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface CharacterStoryProfessionalEvidence {
  protagonist: string;
  goal: string;
  resistance: string;
  choice: string;
  cost: string;
  starting_relationship_state: string;
  ending_relationship_state: string;
  internal_change: string;
  dialogue_voice_rules: string[];
  subtext_strategy: string;
  scene_turns: Record<string, string>;
}

export interface ProfessionalTextEvaluationResult {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

interface DimensionResult {
  score: number;
  evidence: string[];
  issues: string[];
}

const HARD_GATE_REPAIRS: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长和传播目标，重新确认观众承诺。',
  full_text_not_final: '把摘要或大纲重写成完整观众稿，并同步重建分场和交付文本。',
  character_goal_missing: '明确主角此刻想完成的具体目标，不使用生平评价替代。',
  resistance_missing: '加入可见的制度、人物、资源或时间阻力。',
  choice_missing: '设置至少两条有后果的路径，让主角作出明确选择。',
  cost_missing: '写清选择带来的失去、风险、关系破裂或现实代价。',
  relationship_change_missing: '让关键关系在事件前后发生可辨认变化。',
  scene_action_or_turn_missing: '逐场补齐可见行动、冲突/发现和情绪转折。',
  dialogue_voice_or_subtext_missing: '区分角色声线，并让关键台词同时具有表层目标与真实目的。',
  truth_boundary_missing: '补齐事实、合理戏剧化、虚构添加和未知项的分层证据。',
};

function ratioScore(completed: number, total: number): number {
  return Math.round((completed / Math.max(1, total)) * 100);
}

function nonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isFinalAudienceText(value: string): boolean {
  const text = value.trim();
  return text.length >= 120
    && !/^(?:大纲|摘要|分析|创作思路|第一幕[:：]|一[、.])/u.test(text)
    && !/(?:TODO|待补|文本待补|内部分析)/u.test(text);
}

function dimension(
  score: number,
  evidence: string[],
  issues: string[],
): DimensionResult {
  return { score: Math.max(0, Math.min(100, Math.round(score))), evidence, issues };
}

export function evaluateCharacterStoryProfessionalText(input: {
  package: ProfessionalTextPackage;
  character_evidence: CharacterStoryProfessionalEvidence;
}): ProfessionalTextEvaluationResult {
  const pkg = input.package;
  if (pkg.video_type !== 'character_story') {
    throw new Error('evaluateCharacterStoryProfessionalText only accepts character_story packages');
  }
  const character = input.character_evidence;
  const contract = getProfessionalTextTypeContract('character_story');
  const briefChecks = [
    pkg.creative_brief.target_audience,
    pkg.creative_brief.platform,
    pkg.creative_brief.target_duration,
    pkg.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const premiseChecks = [pkg.audience_promise, pkg.premise_or_core_question, pkg.theme_statement]
    .filter(nonEmpty).length;
  const characterChecks = [
    character.protagonist,
    character.goal,
    character.resistance,
    character.choice,
    character.cost,
    character.internal_change,
  ].filter(nonEmpty).length;
  const relationshipChanged = nonEmpty(character.starting_relationship_state)
    && nonEmpty(character.ending_relationship_state)
    && character.starting_relationship_state.trim() !== character.ending_relationship_state.trim();
  const sceneCount = pkg.scene_breakdown.length;
  const actionableSceneCount = pkg.scene_breakdown.filter(scene =>
    nonEmpty(scene.location)
    && nonEmpty(scene.key_action)
    && nonEmpty(scene.conflict ?? scene.plot)
    && nonEmpty(character.scene_turns[String(scene.scene_id)])
  ).length;
  const dialogueReady = character.dialogue_voice_rules.filter(nonEmpty).length >= 2
    && nonEmpty(character.subtext_strategy)
    && nonEmpty(pkg.dialogue_or_narration_pass.polished_text);
  const truthBoundaryCount = pkg.research_and_evidence_dossier.evidence_items.length
    + pkg.truth_and_adaptation_contract.unknown_or_forbidden_claims.length
    + pkg.truth_and_adaptation_contract.required_disclaimers.length;
  const productionUnitCount = pkg.delivery_text_package.scene_units.length;
  const hardGateIds = [
    briefChecks === 4 ? '' : 'brief_missing',
    isFinalAudienceText(pkg.full_text) ? '' : 'full_text_not_final',
    nonEmpty(character.goal) ? '' : 'character_goal_missing',
    nonEmpty(character.resistance) ? '' : 'resistance_missing',
    nonEmpty(character.choice) ? '' : 'choice_missing',
    nonEmpty(character.cost) ? '' : 'cost_missing',
    relationshipChanged ? '' : 'relationship_change_missing',
    sceneCount > 0 && actionableSceneCount === sceneCount ? '' : 'scene_action_or_turn_missing',
    dialogueReady ? '' : 'dialogue_voice_or_subtext_missing',
    truthBoundaryCount > 0 ? '' : 'truth_boundary_missing',
  ].filter(Boolean);

  const dimensions: Record<ProfessionalQualityDimensionId, DimensionResult> = {
    creative_brief_and_audience_promise: dimension(
      ratioScore(briefChecks + Number(nonEmpty(pkg.audience_promise)), 5),
      [`brief_fields=${briefChecks}/4`, `audience_promise=${nonEmpty(pkg.audience_promise)}`],
      briefChecks === 4 && nonEmpty(pkg.audience_promise) ? [] : ['创作简报或观众承诺不完整。'],
    ),
    premise_and_theme_unity: dimension(
      ratioScore(premiseChecks, 3),
      [`premise_fields=${premiseChecks}/3`],
      premiseChecks === 3 ? [] : ['命题、核心问题和主题尚未形成完整闭环。'],
    ),
    structure_causality_and_pacing: dimension(
      ratioScore(
        Number(pkg.sequence_beats.length >= 5)
          + Number(nonEmpty(pkg.structure_outline.opening))
          + Number(nonEmpty(pkg.structure_outline.climax_or_key_turn))
          + Number(nonEmpty(pkg.structure_outline.ending)),
        4,
      ),
      [`sequence_beats=${pkg.sequence_beats.length}`, `scenes=${sceneCount}`],
      pkg.sequence_beats.length >= 5 ? [] : ['人物故事节拍不足，因果链和高潮可能过薄。'],
    ),
    character_agency_and_relationship_change: dimension(
      ratioScore(characterChecks + Number(relationshipChanged), 7),
      [
        `character_engine=${characterChecks}/6`,
        `relationship_changed=${relationshipChanged}`,
      ],
      characterChecks === 6 && relationshipChanged ? [] : ['目标、阻力、选择、代价或关系变化不完整。'],
    ),
    scene_function_visible_action_and_blocking: dimension(
      ratioScore(actionableSceneCount, Math.max(sceneCount, 1)),
      [`actionable_scenes=${actionableSceneCount}/${sceneCount}`],
      actionableSceneCount === sceneCount && sceneCount > 0 ? [] : ['存在缺行动、冲突或转折的场景。'],
    ),
    dialogue_narration_and_subtext: dimension(
      dialogueReady ? 90 : ratioScore(character.dialogue_voice_rules.filter(nonEmpty).length, 3),
      [
        `voice_rules=${character.dialogue_voice_rules.filter(nonEmpty).length}`,
        `subtext_strategy=${nonEmpty(character.subtext_strategy)}`,
      ],
      dialogueReady ? [] : ['角色声线或潜台词策略不足。'],
    ),
    emotional_curve_and_aftertaste: dimension(
      ratioScore(
        Object.values(character.scene_turns).filter(nonEmpty).length
          + Number(nonEmpty(character.internal_change))
          + Number(nonEmpty(pkg.structure_outline.ending)),
        sceneCount + 2,
      ),
      [`scene_turns=${Object.values(character.scene_turns).filter(nonEmpty).length}/${sceneCount}`],
      nonEmpty(character.internal_change) ? [] : ['人物内在变化或结尾余味不明确。'],
    ),
    cultural_fact_and_adaptation_boundary: dimension(
      truthBoundaryCount > 0 ? Math.min(100, 70 + truthBoundaryCount * 5) : 0,
      [`truth_boundary_items=${truthBoundaryCount}`],
      truthBoundaryCount > 0 ? [] : ['缺少事实、戏剧化和虚构边界。'],
    ),
    production_executability: dimension(
      ratioScore(
        Number(pkg.director_text_plan.sequences.length === sceneCount && sceneCount > 0)
          + Number(productionUnitCount === sceneCount && sceneCount > 0)
          + Number(pkg.scene_breakdown.every(scene => nonEmpty(scene.camera_suggestion))),
        3,
      ),
      [`director_sequences=${pkg.director_text_plan.sequences.length}`, `delivery_units=${productionUnitCount}`],
      productionUnitCount === sceneCount && sceneCount > 0 ? [] : ['导演文本或交付单元未覆盖全部场景。'],
    ),
    originality_and_distinctiveness: dimension(
      50,
      ['machine_originality_verdict=not_allowed'],
      ['原创性和整体辨识度必须由固定基准与真人盲评确认。'],
    ),
  };

  const weightedScore = Math.round(Object.entries(contract.quality_dimension_weights).reduce(
    (sum, [dimensionId, weight]) => sum
      + dimensions[dimensionId as ProfessionalQualityDimensionId].score * (weight / 100),
    0,
  ));
  const status = hardGateIds.length > 0
    ? 'failed'
    : weightedScore >= 90
      ? 'high_quality_candidate'
      : weightedScore >= 85
        ? 'professional_candidate'
        : weightedScore >= 80
          ? 'production_candidate'
          : 'failed';
  const hardGateFailures = hardGateIds.map(gateId => `${gateId}: ${HARD_GATE_REPAIRS[gateId]}`);
  const qualityReport: ProfessionalTextQualityReport = {
    status,
    total_score: weightedScore,
    dimensions: Object.entries(contract.quality_dimension_weights).map(([dimensionId, weight]) => ({
      dimension_id: dimensionId as ProfessionalQualityDimensionId,
      weight,
      score: dimensions[dimensionId as ProfessionalQualityDimensionId].score,
      evidence: dimensions[dimensionId as ProfessionalQualityDimensionId].evidence,
      issues: dimensions[dimensionId as ProfessionalQualityDimensionId].issues,
    })),
    hard_gate_failures: hardGateFailures,
    professional_passed: false,
    evaluator_notes: [
      '机器评分只用于 Coverage 和修订路由，不构成专业通过。',
      '缺少固定真实模型项目、三角色真人盲评和授权基准，因此 professional_passed 固定为 false。',
    ],
  };
  const coverageReport: ProfessionalCoverageReport = {
    verdict: hardGateIds.some(id => [
      'full_text_not_final',
      'character_goal_missing',
      'choice_missing',
      'cost_missing',
    ].includes(id))
      ? 'rebuild'
      : hardGateIds.length > 0 || weightedScore < 80
        ? 'revise'
        : 'pass',
    strengths: Object.entries(dimensions)
      .filter(([, result]) => result.score >= 85)
      .map(([dimensionId]) => dimensionId),
    structure_notes: dimensions.structure_causality_and_pacing.issues,
    character_or_information_notes: dimensions.character_agency_and_relationship_change.issues,
    scene_notes: dimensions.scene_function_visible_action_and_blocking.issues,
    dialogue_or_narration_notes: dimensions.dialogue_narration_and_subtext.issues,
    pacing_notes: dimensions.emotional_curve_and_aftertaste.issues,
    fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
    production_notes: dimensions.production_executability.issues,
    action_items: hardGateIds.map(gateId => `${gateId}: ${HARD_GATE_REPAIRS[gateId]}`),
  };
  return { quality_report: qualityReport, coverage_report: coverageReport };
}

export function characterStoryHardGateRepair(gateId: string): string | undefined {
  return HARD_GATE_REPAIRS[gateId];
}
