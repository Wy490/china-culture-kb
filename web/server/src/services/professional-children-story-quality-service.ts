import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface ChildrenStoryAttempt {
  attempt_id: string;
  action: string;
  outcome: string;
  learning: string;
}

export interface ChildrenStoryProfessionalEvidence {
  target_age_band: '4-6' | '7-9' | '10-12';
  reading_level_note: string;
  vocabulary_rules: string[];
  max_sentence_characters: number;
  child_protagonist: string;
  child_goal: string;
  gentle_problem: string;
  safe_stakes: string;
  attempts: ChildrenStoryAttempt[];
  positive_choice: string;
  emotional_learning: string;
  repeated_motif: string;
  motif_scene_ids: number[];
  warm_resolution: string;
  sensitive_content_boundaries: string[];
  parent_or_teacher_prompt: string;
  scene_turns: Record<string, string>;
}

export interface ChildrenStoryProfessionalEvaluationResult {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

interface DimensionResult {
  score: number;
  evidence: string[];
  issues: string[];
}

const HARD_GATE_REPAIRS: Record<string, string> = {
  brief_missing: '补齐年龄受众、平台、时长、传播目标和观众承诺。',
  full_text_not_final: '把教学提纲或创作说明改写成儿童可直接观看的完整故事。',
  age_and_language_missing: '标明年龄段、阅读理解层级、词汇规则和句长上限。',
  child_goal_missing: '给儿童主人公一个具体、当下且能用行动完成的目标。',
  gentle_conflict_missing: '把成人化、恐怖或沉重冲突改成安全、可理解的小问题与温和风险。',
  attempt_causality_missing: '安排至少两次不同尝试，每次都有结果和新学习。',
  positive_choice_missing: '让主人公通过帮助、分享、求助、耐心或勇敢行动作出正向选择。',
  emotional_learning_missing: '写清孩子从哪种感受出发、如何识别感受并学会新的应对方式。',
  repeated_motif_missing: '用一个具体物件、声音或句式在至少三个场景重复并帮助儿童跟随因果。',
  warm_resolution_missing: '给问题一个安全、温暖且不依赖惩罚或说教的解决。',
  scene_action_or_turn_missing: '每场只承载一个儿童能理解的主要行动，并产生清楚变化。',
  child_safety_boundary_missing: '补齐危险、恐惧、羞辱、陌生人、工具或模仿风险的内容边界。',
  parent_or_teacher_prompt_missing: '增加简短、开放且不替孩子下结论的亲师共读提示。',
  cultural_truth_boundary_missing: '区分文化事实、虚构儿童角色、合理改编和待核信息。',
};

const UNSAFE_DETAIL_PATTERN = /(?:血淋淋|肢解|酷刑|砍死|杀死|自杀|虐待细节|报复杀人|恐怖尸体)/u;

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
    && !/^(?:大纲|摘要|资料|分析|创作思路|教学目标[:：])/u.test(text)
    && !/(?:TODO|待补|内部分析|仅供测试)/u.test(text);
}

function attemptsReady(attempts: ChildrenStoryAttempt[]): boolean {
  return attempts.length >= 2
    && new Set(attempts.map(item => item.attempt_id)).size === attempts.length
    && attempts.every(item =>
      nonEmpty(item.attempt_id)
      && nonEmpty(item.action)
      && nonEmpty(item.outcome)
      && nonEmpty(item.learning)
    );
}

export function evaluateChildrenStoryProfessionalText(input: {
  package: ProfessionalTextPackage;
  children_evidence: ChildrenStoryProfessionalEvidence;
}): ChildrenStoryProfessionalEvaluationResult {
  const pkg = input.package;
  if (pkg.video_type !== 'children_story') {
    throw new Error('evaluateChildrenStoryProfessionalText only accepts children_story packages');
  }
  const evidence = input.children_evidence;
  const contract = getProfessionalTextTypeContract('children_story');
  const briefChecks = [
    pkg.creative_brief.target_audience,
    pkg.creative_brief.platform,
    pkg.creative_brief.target_duration,
    pkg.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const premiseChecks = [pkg.audience_promise, pkg.premise_or_core_question, pkg.theme_statement]
    .filter(nonEmpty).length;
  const languageReady = nonEmpty(evidence.target_age_band)
    && nonEmpty(evidence.reading_level_note)
    && evidence.vocabulary_rules.filter(nonEmpty).length >= 2
    && evidence.max_sentence_characters >= 8
    && evidence.max_sentence_characters <= 40;
  const protagonistReady = nonEmpty(evidence.child_protagonist) && nonEmpty(evidence.child_goal);
  const gentleConflictReady = nonEmpty(evidence.gentle_problem)
    && nonEmpty(evidence.safe_stakes)
    && !UNSAFE_DETAIL_PATTERN.test(pkg.full_text);
  const attemptsAreReady = attemptsReady(evidence.attempts);
  const choiceReady = nonEmpty(evidence.positive_choice);
  const emotionalLearningReady = nonEmpty(evidence.emotional_learning);
  const warmResolutionReady = nonEmpty(evidence.warm_resolution)
    && !/(?:用惩罚|通过羞辱|赶走犯错|打败坏人)/u.test(evidence.warm_resolution);
  const sceneCount = pkg.scene_breakdown.length;
  const validSceneIds = new Set(pkg.scene_breakdown.map(scene => Number(scene.scene_id)));
  const motifSceneIds = [...new Set(evidence.motif_scene_ids)];
  const motifReady = nonEmpty(evidence.repeated_motif)
    && motifSceneIds.length >= 3
    && motifSceneIds.every(sceneId => validSceneIds.has(sceneId));
  const actionableSceneCount = pkg.scene_breakdown.filter(scene =>
    nonEmpty(scene.location)
    && nonEmpty(scene.key_action)
    && nonEmpty(scene.conflict ?? scene.plot)
    && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  ).length;
  const childSafetyReady = evidence.sensitive_content_boundaries.filter(nonEmpty).length >= 2
    && !UNSAFE_DETAIL_PATTERN.test(pkg.full_text);
  const parentPromptReady = nonEmpty(evidence.parent_or_teacher_prompt)
    && evidence.parent_or_teacher_prompt.length <= 120;
  const verifiedCultureCount = pkg.research_and_evidence_dossier.evidence_items
    .filter(item => item.status === 'verified_fact').length;
  const dramatizationCount = pkg.research_and_evidence_dossier.evidence_items
    .filter(item => item.status === 'plausible_dramatization' || item.status === 'fictional_addition').length;
  const sceneBoundaryCount = pkg.scene_breakdown.filter(scene =>
    (scene.source_entries?.length ?? 0) > 0
    && nonEmpty(scene.factual_basis)
    && (scene.fictionalized_elements?.length ?? 0) > 0
    && scene.fictionalized_elements!.every(nonEmpty)
  ).length;
  const truthBoundaryReady = verifiedCultureCount > 0
    && dramatizationCount > 0
    && pkg.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0
    && pkg.truth_and_adaptation_contract.required_disclaimers.length > 0
    && sceneBoundaryCount === sceneCount;
  const productionUnitCount = pkg.delivery_text_package.scene_units.length;

  const hardGateIds = [
    briefChecks === 4 && nonEmpty(pkg.audience_promise) ? '' : 'brief_missing',
    isFinalAudienceText(pkg.full_text) ? '' : 'full_text_not_final',
    languageReady ? '' : 'age_and_language_missing',
    protagonistReady ? '' : 'child_goal_missing',
    gentleConflictReady ? '' : 'gentle_conflict_missing',
    attemptsAreReady ? '' : 'attempt_causality_missing',
    choiceReady ? '' : 'positive_choice_missing',
    emotionalLearningReady ? '' : 'emotional_learning_missing',
    motifReady ? '' : 'repeated_motif_missing',
    warmResolutionReady ? '' : 'warm_resolution_missing',
    sceneCount > 0 && actionableSceneCount === sceneCount ? '' : 'scene_action_or_turn_missing',
    childSafetyReady ? '' : 'child_safety_boundary_missing',
    parentPromptReady ? '' : 'parent_or_teacher_prompt_missing',
    truthBoundaryReady ? '' : 'cultural_truth_boundary_missing',
  ].filter(Boolean);

  const dimensions: Record<ProfessionalQualityDimensionId, DimensionResult> = {
    creative_brief_and_audience_promise: dimension(
      ratioScore(briefChecks + Number(nonEmpty(pkg.audience_promise)) + Number(languageReady), 6),
      [`brief_fields=${briefChecks}/4`, `age_language_ready=${languageReady}`],
      briefChecks === 4 && languageReady ? [] : ['简报、年龄段或语言层级不完整。'],
    ),
    premise_and_theme_unity: dimension(
      ratioScore(premiseChecks + Number(emotionalLearningReady), 4),
      [`premise_fields=${premiseChecks}/3`, `emotional_learning=${emotionalLearningReady}`],
      premiseChecks === 3 ? [] : ['儿童目标、主题和情绪学习没有闭环。'],
    ),
    structure_causality_and_pacing: dimension(
      ratioScore(
        Number(attemptsAreReady)
          + Number(pkg.sequence_beats.length === sceneCount && sceneCount >= 5)
          + Number(choiceReady)
          + Number(warmResolutionReady),
        4,
      ),
      [`attempts=${evidence.attempts.length}`, `scenes=${sceneCount}`],
      attemptsAreReady && choiceReady ? [] : ['问题、尝试、结果和选择的因果不清楚。'],
    ),
    character_agency_and_relationship_change: dimension(
      ratioScore(Number(protagonistReady) + Number(choiceReady) + Number(emotionalLearningReady), 3),
      [`child_goal=${protagonistReady}`, `positive_choice=${choiceReady}`],
      protagonistReady && choiceReady ? [] : ['儿童主人公没有通过行动完成选择。'],
    ),
    scene_function_visible_action_and_blocking: dimension(
      ratioScore(actionableSceneCount, Math.max(sceneCount, 1)),
      [`actionable_scenes=${actionableSceneCount}/${sceneCount}`],
      actionableSceneCount === sceneCount && sceneCount > 0 ? [] : ['存在没有单一行动或清楚变化的场景。'],
    ),
    dialogue_narration_and_subtext: dimension(
      languageReady ? 90 : ratioScore(evidence.vocabulary_rules.filter(nonEmpty).length, 3),
      [`vocabulary_rules=${evidence.vocabulary_rules.filter(nonEmpty).length}`, `sentence_limit=${evidence.max_sentence_characters}`],
      languageReady ? [] : ['词汇、句长或理解层级不适龄。'],
    ),
    emotional_curve_and_aftertaste: dimension(
      ratioScore(
        Object.values(evidence.scene_turns).filter(nonEmpty).length
          + Number(emotionalLearningReady)
          + Number(warmResolutionReady),
        sceneCount + 2,
      ),
      [`scene_turns=${Object.values(evidence.scene_turns).filter(nonEmpty).length}/${sceneCount}`],
      emotionalLearningReady && warmResolutionReady ? [] : ['情绪学习或温暖结尾不足。'],
    ),
    cultural_fact_and_adaptation_boundary: dimension(
      ratioScore(Number(truthBoundaryReady) + sceneBoundaryCount, sceneCount + 1),
      [`verified_culture=${verifiedCultureCount}`, `scene_boundaries=${sceneBoundaryCount}/${sceneCount}`],
      truthBoundaryReady ? [] : ['文化事实、虚构儿童角色和改编边界不完整。'],
    ),
    production_executability: dimension(
      ratioScore(
        Number(pkg.director_text_plan.sequences.length === sceneCount && sceneCount > 0)
          + Number(productionUnitCount === sceneCount && sceneCount > 0)
          + Number(motifReady)
          + Number(childSafetyReady),
        4,
      ),
      [`delivery_units=${productionUnitCount}`, `motif_scenes=${motifSceneIds.length}`, `child_safety=${childSafetyReady}`],
      productionUnitCount === sceneCount && motifReady && childSafetyReady ? [] : ['交付单元、重复母题或儿童安全边界不足。'],
    ),
    originality_and_distinctiveness: dimension(
      50,
      ['machine_originality_verdict=not_allowed'],
      ['原创性、儿童吸引力和非说教感必须由固定基准与真人盲评确认。'],
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
        '机器评分只用于 Coverage 和修订路由，不构成儿童内容专业通过。',
        '缺少真实模型成稿、儿童发展/内容安全专业评审和三角色真人盲评，professional_passed 固定为 false。',
      ],
    },
    coverage_report: {
      verdict: hardGateIds.some(id => [
        'full_text_not_final',
        'age_and_language_missing',
        'gentle_conflict_missing',
        'attempt_causality_missing',
        'child_safety_boundary_missing',
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

export function childrenStoryHardGateRepair(gateId: string): string | undefined {
  return HARD_GATE_REPAIRS[gateId];
}
