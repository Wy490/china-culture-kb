import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface LegendVersionBoundary {
  version_id: string;
  label: string;
  source: string;
  version_kind: 'literary_text' | 'folk_oral' | 'local_adaptation' | 'unknown';
  core_elements: string[];
  boundary_note: string;
}

export interface LegendStoryProfessionalEvidence {
  protagonist: string;
  human_goal: string;
  human_trial: string;
  choice: string;
  consequence: string;
  supernatural_element: string;
  supernatural_function: string;
  symbolic_motif: string;
  motif_scene_ids: number[];
  version_boundaries: LegendVersionBoundary[];
  oral_rhythm_rules: string[];
  transmission_reason: string;
  scene_turns: Record<string, string>;
}

export interface LegendStoryProfessionalEvaluationResult {
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
  full_text_not_final: '把传说资料摘要或创作说明改写成完整观众稿。',
  version_boundary_missing: '至少记录两个文学、口述或地方改编版本，并写明来源与差异边界。',
  supernatural_function_missing: '明确神异元素如何推动凡人考验，不能只堆奇观。',
  human_trial_missing: '补齐凡人当下目标、具体考验和受压处境。',
  choice_or_consequence_missing: '加入人物主动选择及其后果，不能由神力代替人物解决问题。',
  symbolic_motif_missing: '建立一个可见象征意象，并让它承担人物和主题意义。',
  motif_repetition_missing: '让核心意象在至少三个有效场景中重复并发生意义变化。',
  scene_action_or_turn_missing: '逐场补齐可见行动、冲突/发现和前后变化。',
  oral_rhythm_missing: '补充口述传说的重复、递进和回环规则，并落实到观众文本。',
  scene_legend_boundary_missing: '逐场标明版本来源、传说依据和影视化补足。',
  truth_boundary_missing: '区分可证的文本/流传事实、传说内容、合理改编、未知点和免责声明。',
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
    && !/^(?:大纲|摘要|资料|分析|创作思路|版本说明[:：])/u.test(text)
    && !/(?:TODO|待补|内部分析|仅供测试)/u.test(text);
}

function versionBoundariesReady(items: LegendVersionBoundary[]): boolean {
  return items.length >= 2
    && new Set(items.map(item => item.version_id)).size === items.length
    && new Set(items.map(item => item.version_kind)).size >= 2
    && items.every(item =>
      nonEmpty(item.version_id)
      && nonEmpty(item.label)
      && nonEmpty(item.source)
      && item.core_elements.some(nonEmpty)
      && nonEmpty(item.boundary_note)
    );
}

export function evaluateLegendStoryProfessionalText(input: {
  package: ProfessionalTextPackage;
  legend_evidence: LegendStoryProfessionalEvidence;
}): LegendStoryProfessionalEvaluationResult {
  const pkg = input.package;
  if (pkg.video_type !== 'legend_story') {
    throw new Error('evaluateLegendStoryProfessionalText only accepts legend_story packages');
  }
  const evidence = input.legend_evidence;
  const contract = getProfessionalTextTypeContract('legend_story');
  const briefChecks = [
    pkg.creative_brief.target_audience,
    pkg.creative_brief.platform,
    pkg.creative_brief.target_duration,
    pkg.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const premiseChecks = [pkg.audience_promise, pkg.premise_or_core_question, pkg.theme_statement]
    .filter(nonEmpty).length;
  const versionsReady = versionBoundariesReady(evidence.version_boundaries);
  const supernaturalReady = nonEmpty(evidence.supernatural_element)
    && nonEmpty(evidence.supernatural_function);
  const humanTrialReady = nonEmpty(evidence.protagonist)
    && nonEmpty(evidence.human_goal)
    && nonEmpty(evidence.human_trial);
  const choiceReady = nonEmpty(evidence.choice) && nonEmpty(evidence.consequence);
  const sceneCount = pkg.scene_breakdown.length;
  const validSceneIds = new Set(pkg.scene_breakdown.map(scene => Number(scene.scene_id)));
  const motifIds = [...new Set(evidence.motif_scene_ids)];
  const motifReady = nonEmpty(evidence.symbolic_motif);
  const motifRepeated = motifReady
    && motifIds.length >= 3
    && motifIds.every(sceneId => validSceneIds.has(sceneId));
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
  const oralRhythmReady = evidence.oral_rhythm_rules.filter(nonEmpty).length >= 2
    && nonEmpty(pkg.dialogue_or_narration_pass.polished_text)
    && nonEmpty(evidence.transmission_reason);
  const verifiedTraditionCount = pkg.research_and_evidence_dossier.evidence_items
    .filter(item => item.status === 'verified_fact').length;
  const dramatizationCount = pkg.research_and_evidence_dossier.evidence_items
    .filter(item => item.status === 'plausible_dramatization').length;
  const truthBoundaryReady = verifiedTraditionCount > 0
    && dramatizationCount > 0
    && pkg.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0
    && pkg.truth_and_adaptation_contract.required_disclaimers.length > 0;
  const productionUnitCount = pkg.delivery_text_package.scene_units.length;

  const hardGateIds = [
    briefChecks === 4 && nonEmpty(pkg.audience_promise) ? '' : 'brief_missing',
    isFinalAudienceText(pkg.full_text) ? '' : 'full_text_not_final',
    versionsReady ? '' : 'version_boundary_missing',
    supernaturalReady ? '' : 'supernatural_function_missing',
    humanTrialReady ? '' : 'human_trial_missing',
    choiceReady ? '' : 'choice_or_consequence_missing',
    motifReady ? '' : 'symbolic_motif_missing',
    motifRepeated ? '' : 'motif_repetition_missing',
    sceneCount > 0 && actionableSceneCount === sceneCount ? '' : 'scene_action_or_turn_missing',
    oralRhythmReady ? '' : 'oral_rhythm_missing',
    sceneCount > 0 && sceneBoundaryCount === sceneCount ? '' : 'scene_legend_boundary_missing',
    truthBoundaryReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);

  const dimensions: Record<ProfessionalQualityDimensionId, DimensionResult> = {
    creative_brief_and_audience_promise: dimension(
      ratioScore(briefChecks + Number(nonEmpty(pkg.audience_promise)), 5),
      [`brief_fields=${briefChecks}/4`, `audience_promise=${nonEmpty(pkg.audience_promise)}`],
      briefChecks === 4 && nonEmpty(pkg.audience_promise) ? [] : ['创作简报或观众承诺不完整。'],
    ),
    premise_and_theme_unity: dimension(
      ratioScore(premiseChecks + Number(nonEmpty(evidence.transmission_reason)), 4),
      [`premise_fields=${premiseChecks}/3`, `transmission_reason=${nonEmpty(evidence.transmission_reason)}`],
      premiseChecks === 3 ? [] : ['传说命题、人物问题和流传理由没有闭环。'],
    ),
    structure_causality_and_pacing: dimension(
      ratioScore(
        Number(pkg.sequence_beats.length === sceneCount && sceneCount >= 4)
          + Number(supernaturalReady)
          + Number(choiceReady)
          + Number(nonEmpty(pkg.structure_outline.ending)),
        4,
      ),
      [`scenes=${sceneCount}`, `supernatural_function=${supernaturalReady}`, `choice=${choiceReady}`],
      supernaturalReady && choiceReady ? [] : ['神异介入、人物选择和后果没有形成因果链。'],
    ),
    character_agency_and_relationship_change: dimension(
      ratioScore(
        Number(humanTrialReady) + Number(choiceReady) + Number(nonEmpty(evidence.consequence)),
        3,
      ),
      [`human_trial=${humanTrialReady}`, `choice_and_consequence=${choiceReady}`],
      humanTrialReady && choiceReady ? [] : ['凡人考验或主动选择不足。'],
    ),
    scene_function_visible_action_and_blocking: dimension(
      ratioScore(actionableSceneCount, Math.max(sceneCount, 1)),
      [`actionable_scenes=${actionableSceneCount}/${sceneCount}`],
      actionableSceneCount === sceneCount && sceneCount > 0 ? [] : ['存在没有行动、冲突或变化的场景。'],
    ),
    dialogue_narration_and_subtext: dimension(
      oralRhythmReady ? 90 : ratioScore(evidence.oral_rhythm_rules.filter(nonEmpty).length, 3),
      [`oral_rhythm_rules=${evidence.oral_rhythm_rules.filter(nonEmpty).length}`],
      oralRhythmReady ? [] : ['口述节奏、重复递进或流传理由不足。'],
    ),
    emotional_curve_and_aftertaste: dimension(
      ratioScore(
        Object.values(evidence.scene_turns).filter(nonEmpty).length
          + Number(nonEmpty(evidence.consequence))
          + Number(nonEmpty(evidence.transmission_reason)),
        sceneCount + 2,
      ),
      [`scene_turns=${Object.values(evidence.scene_turns).filter(nonEmpty).length}/${sceneCount}`],
      choiceReady ? [] : ['人物后果或传说余味不明确。'],
    ),
    cultural_fact_and_adaptation_boundary: dimension(
      ratioScore(Number(versionsReady) + Number(truthBoundaryReady) + sceneBoundaryCount, sceneCount + 2),
      [
        `version_boundaries=${evidence.version_boundaries.length}`,
        `verified_tradition_evidence=${verifiedTraditionCount}`,
        `scene_boundaries=${sceneBoundaryCount}/${sceneCount}`,
      ],
      versionsReady && truthBoundaryReady && sceneBoundaryCount === sceneCount
        ? []
        : ['版本、传说内容、戏剧化补足或逐场边界不完整。'],
    ),
    production_executability: dimension(
      ratioScore(
        Number(pkg.director_text_plan.sequences.length === sceneCount && sceneCount > 0)
          + Number(productionUnitCount === sceneCount && sceneCount > 0)
          + Number(motifRepeated),
        3,
      ),
      [`director_sequences=${pkg.director_text_plan.sequences.length}`, `motif_scenes=${motifIds.length}`],
      productionUnitCount === sceneCount && motifRepeated ? [] : ['导演文本、交付单元或意象重复没有覆盖要求。'],
    ),
    originality_and_distinctiveness: dimension(
      50,
      ['machine_originality_verdict=not_allowed'],
      ['原创性、口述质感和整体辨识度必须由固定基准与真人盲评确认。'],
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
      hard_gate_failures: hardGateFailures,
      professional_passed: false,
      evaluator_notes: [
        '机器评分只用于 Coverage 和修订路由，不构成专业通过。',
        '缺少 legend_story 固定真实模型成稿、授权版本基准和三角色真人盲评，professional_passed 固定为 false。',
      ],
    },
    coverage_report: {
      verdict: hardGateIds.some(id => [
        'full_text_not_final',
        'version_boundary_missing',
        'supernatural_function_missing',
        'human_trial_missing',
        'choice_or_consequence_missing',
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
    },
  };
}

export function legendStoryHardGateRepair(gateId: string): string | undefined {
  return HARD_GATE_REPAIRS[gateId];
}
