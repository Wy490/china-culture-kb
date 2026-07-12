import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface HistoricalDramaEventChainItem {
  event_id: string;
  order: number;
  cause: string;
  event: string;
  consequence: string;
  evidence_ids: string[];
}

export interface HistoricalDramaProfessionalEvidence {
  central_event: string;
  protagonist: string;
  era_pressure: string;
  institutional_pressure: string;
  role_positions: Record<string, string>;
  decision_or_irreversible_action: string;
  consequence: string;
  factual_event_chain: HistoricalDramaEventChainItem[];
  dialogue_voice_rules: string[];
  subtext_strategy: string;
  scene_turns: Record<string, string>;
}

export interface HistoricalDramaProfessionalEvaluationResult {
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
  full_text_not_final: '把历史摘要或资料罗列改写成完整观众稿，并同步重建分场。',
  historical_event_pressure_missing: '锁定单一可核历史事件，写清人物为何被卷入现场压力。',
  era_or_institutional_pressure_missing: '补足时代、制度、组织或社会规则对人物行动的具体限制。',
  event_causality_missing: '用至少三个有来源锚点的因果节点重建事件链，不用结论代替过程。',
  role_position_conflict_missing: '补齐至少两个真实角色立场，让冲突来自职责和时代处境。',
  decision_or_consequence_missing: '加入不可撤回的行动及其历史后果，避免人物只充当背景板。',
  scene_action_or_turn_missing: '逐场补齐可见行动、冲突/发现和前后变化。',
  scene_truth_boundary_missing: '逐场补齐来源、事实依据和戏剧化添加，不得由后处理猜测。',
  dialogue_voice_or_subtext_missing: '区分角色立场与声线，并声明对白为影视化创作而非史料原话。',
  truth_boundary_missing: '同时记录已核事实、合理戏剧化、未知/禁止主张和必要免责声明。',
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
    && !/^(?:大纲|摘要|资料|分析|创作思路|历史背景[:：])/u.test(text)
    && !/(?:TODO|待补|内部分析|仅供测试)/u.test(text);
}

function eventChainIsValid(
  chain: HistoricalDramaEventChainItem[],
  availableEvidenceIds: Set<string>,
): boolean {
  return chain.length >= 3 && chain.every((item, index) =>
    item.order === index + 1
    && nonEmpty(item.event_id)
    && nonEmpty(item.cause)
    && nonEmpty(item.event)
    && nonEmpty(item.consequence)
    && item.evidence_ids.length > 0
    && item.evidence_ids.every(evidenceId => availableEvidenceIds.has(evidenceId))
  );
}

export function evaluateHistoricalDramaProfessionalText(input: {
  package: ProfessionalTextPackage;
  historical_evidence: HistoricalDramaProfessionalEvidence;
}): HistoricalDramaProfessionalEvaluationResult {
  const pkg = input.package;
  if (pkg.video_type !== 'historical_drama') {
    throw new Error('evaluateHistoricalDramaProfessionalText only accepts historical_drama packages');
  }
  const evidence = input.historical_evidence;
  const contract = getProfessionalTextTypeContract('historical_drama');
  const briefChecks = [
    pkg.creative_brief.target_audience,
    pkg.creative_brief.platform,
    pkg.creative_brief.target_duration,
    pkg.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const premiseChecks = [pkg.audience_promise, pkg.premise_or_core_question, pkg.theme_statement]
    .filter(nonEmpty).length;
  const availableEvidenceIds = new Set(
    pkg.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id),
  );
  const causalChainReady = eventChainIsValid(evidence.factual_event_chain, availableEvidenceIds);
  const roleEntries = Object.entries(evidence.role_positions).filter(([name, position]) =>
    nonEmpty(name) && nonEmpty(position)
  );
  const roleConflictReady = roleEntries.length >= 2
    && new Set(roleEntries.map(([, position]) => position.trim())).size >= 2;
  const pressureReady = nonEmpty(evidence.era_pressure) && nonEmpty(evidence.institutional_pressure);
  const decisionReady = nonEmpty(evidence.decision_or_irreversible_action) && nonEmpty(evidence.consequence);
  const sceneCount = pkg.scene_breakdown.length;
  const actionableSceneCount = pkg.scene_breakdown.filter(scene =>
    nonEmpty(scene.location)
    && nonEmpty(scene.key_action)
    && nonEmpty(scene.conflict ?? scene.plot)
    && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  ).length;
  const sceneBoundaryCount = pkg.scene_breakdown.filter(scene =>
    (scene.source_entries?.length ?? 0) > 0
    && nonEmpty(scene.factual_basis)
    && (scene.fictionalized_elements?.length ?? 0) > 0
    && scene.fictionalized_elements!.every(nonEmpty)
  ).length;
  const dialogueReady = evidence.dialogue_voice_rules.filter(nonEmpty).length >= 2
    && nonEmpty(evidence.subtext_strategy)
    && nonEmpty(pkg.dialogue_or_narration_pass.polished_text)
    && pkg.truth_and_adaptation_contract.required_disclaimers.length > 0;
  const verifiedFactCount = pkg.research_and_evidence_dossier.evidence_items
    .filter(item => item.status === 'verified_fact').length;
  const dramatizationCount = pkg.research_and_evidence_dossier.evidence_items
    .filter(item => item.status === 'plausible_dramatization').length;
  const unknownBoundaryCount = pkg.truth_and_adaptation_contract.unknown_or_forbidden_claims.length;
  const disclaimerCount = pkg.truth_and_adaptation_contract.required_disclaimers.length;
  const truthBoundaryReady = verifiedFactCount > 0
    && dramatizationCount > 0
    && unknownBoundaryCount > 0
    && disclaimerCount > 0;
  const productionUnitCount = pkg.delivery_text_package.scene_units.length;

  const hardGateIds = [
    briefChecks === 4 && nonEmpty(pkg.audience_promise) ? '' : 'brief_missing',
    isFinalAudienceText(pkg.full_text) ? '' : 'full_text_not_final',
    nonEmpty(evidence.central_event) && nonEmpty(evidence.protagonist)
      ? ''
      : 'historical_event_pressure_missing',
    pressureReady ? '' : 'era_or_institutional_pressure_missing',
    causalChainReady ? '' : 'event_causality_missing',
    roleConflictReady ? '' : 'role_position_conflict_missing',
    decisionReady ? '' : 'decision_or_consequence_missing',
    sceneCount > 0 && actionableSceneCount === sceneCount ? '' : 'scene_action_or_turn_missing',
    sceneCount > 0 && sceneBoundaryCount === sceneCount ? '' : 'scene_truth_boundary_missing',
    dialogueReady ? '' : 'dialogue_voice_or_subtext_missing',
    truthBoundaryReady ? '' : 'truth_boundary_missing',
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
      premiseChecks === 3 ? [] : ['历史命题、戏剧问题和主题没有形成闭环。'],
    ),
    structure_causality_and_pacing: dimension(
      ratioScore(
        Number(causalChainReady)
          + Number(pkg.sequence_beats.length === sceneCount && sceneCount >= 5)
          + Number(nonEmpty(pkg.structure_outline.climax_or_key_turn))
          + Number(nonEmpty(pkg.structure_outline.ending)),
        4,
      ),
      [`causal_chain_nodes=${evidence.factual_event_chain.length}`, `scenes=${sceneCount}`],
      causalChainReady ? [] : ['历史事件因果链缺失、顺序错误或没有来源锚点。'],
    ),
    character_agency_and_relationship_change: dimension(
      ratioScore(
        Number(nonEmpty(evidence.protagonist))
          + Number(roleConflictReady)
          + Number(pressureReady)
          + Number(decisionReady),
        4,
      ),
      [`role_positions=${roleEntries.length}`, `decision_and_consequence=${decisionReady}`],
      roleConflictReady && decisionReady ? [] : ['角色立场、关键行动或历史后果不完整。'],
    ),
    scene_function_visible_action_and_blocking: dimension(
      ratioScore(actionableSceneCount, Math.max(sceneCount, 1)),
      [`actionable_scenes=${actionableSceneCount}/${sceneCount}`],
      actionableSceneCount === sceneCount && sceneCount > 0 ? [] : ['存在没有行动、冲突或变化的场景。'],
    ),
    dialogue_narration_and_subtext: dimension(
      dialogueReady ? 90 : ratioScore(evidence.dialogue_voice_rules.filter(nonEmpty).length, 3),
      [
        `voice_rules=${evidence.dialogue_voice_rules.filter(nonEmpty).length}`,
        `subtext_strategy=${nonEmpty(evidence.subtext_strategy)}`,
      ],
      dialogueReady ? [] : ['角色声线、立场潜台词或影视化对白声明不足。'],
    ),
    emotional_curve_and_aftertaste: dimension(
      ratioScore(
        Object.values(evidence.scene_turns).filter(nonEmpty).length
          + Number(nonEmpty(evidence.consequence))
          + Number(nonEmpty(pkg.structure_outline.ending)),
        sceneCount + 2,
      ),
      [`scene_turns=${Object.values(evidence.scene_turns).filter(nonEmpty).length}/${sceneCount}`],
      decisionReady ? [] : ['历史行动后果或结尾余响不明确。'],
    ),
    cultural_fact_and_adaptation_boundary: dimension(
      ratioScore(
        Number(truthBoundaryReady) + sceneBoundaryCount,
        sceneCount + 1,
      ),
      [
        `verified_facts=${verifiedFactCount}`,
        `plausible_dramatizations=${dramatizationCount}`,
        `scene_boundaries=${sceneBoundaryCount}/${sceneCount}`,
      ],
      truthBoundaryReady && sceneBoundaryCount === sceneCount
        ? []
        : ['事实、合理戏剧化、未知项或逐场改编边界不完整。'],
    ),
    production_executability: dimension(
      ratioScore(
        Number(pkg.director_text_plan.sequences.length === sceneCount && sceneCount > 0)
          + Number(productionUnitCount === sceneCount && sceneCount > 0)
          + Number(pkg.scene_breakdown.every(scene => nonEmpty(scene.camera_suggestion))),
        3,
      ),
      [`director_sequences=${pkg.director_text_plan.sequences.length}`, `delivery_units=${productionUnitCount}`],
      productionUnitCount === sceneCount && sceneCount > 0 ? [] : ['导演文本或交付单元没有覆盖全部场景。'],
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
      '缺少 historical_drama 固定真实模型成稿、授权专业基准和三角色真人盲评，professional_passed 固定为 false。',
    ],
  };
  const rebuildGateIds = new Set([
    'full_text_not_final',
    'historical_event_pressure_missing',
    'event_causality_missing',
    'role_position_conflict_missing',
    'decision_or_consequence_missing',
  ]);
  const coverageReport: ProfessionalCoverageReport = {
    verdict: hardGateIds.some(id => rebuildGateIds.has(id))
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

export function historicalDramaHardGateRepair(gateId: string): string | undefined {
  return HARD_GATE_REPAIRS[gateId];
}
