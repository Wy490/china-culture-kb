import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface TrainingLearningObjective {
  objective_id: string;
  observable_action: string;
  success_criteria: string;
  evidence_ids: string[];
}

export interface TrainingKnowledgeStep {
  step_id: string;
  order: number;
  title: string;
  instruction: string;
  demonstration_action: string;
  objective_ids: string[];
  evidence_ids: string[];
  safety_notes: string[];
}

export interface TrainingPracticeTask {
  task_id: string;
  instruction: string;
  objective_ids: string[];
  expected_output: string;
  hints: string[];
}

export interface TrainingAssessment {
  assessment_id: string;
  objective_ids: string[];
  prompt: string;
  rubric: string[];
  pass_condition: string;
}

export interface TrainingCaseStudy {
  title: string;
  scenario: string;
  evidence_ids: string[];
  debrief: string;
}

export interface EducationTrainingEvidence {
  learner_profile: string;
  learning_objectives: TrainingLearningObjective[];
  knowledge_steps: TrainingKnowledgeStep[];
  case_study: TrainingCaseStudy;
  practice_tasks: TrainingPracticeTask[];
  assessments: TrainingAssessment[];
  feedback_rules: string[];
  recap_checklist: string[];
  institutional_accuracy_notes: string[];
  scene_turns: Record<string, string>;
}

export interface EducationTrainingEvaluation {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

const repairs: Record<string, string> = {
  brief_missing: '补齐学习者、平台、时长和教学目标。',
  full_text_not_final: '把课程提纲或宣传材料改为可直接教学的完整培训文本。',
  learner_profile_missing: '明确学习者已有经验、岗位或使用场景。',
  learning_objective_missing: '把目标改为可观察动作和明确成功标准。',
  knowledge_step_missing: '建立至少三个顺序清楚、证据可核的教学步骤。',
  demonstration_missing: '每个关键步骤补完整、可见且可暂停的示范动作。',
  case_study_missing: '补一个有证据依据并能服务目标的案例。',
  practice_missing: '为每个学习目标安排可提交结果的练习。',
  assessment_missing: '为每个学习目标安排题目、评分规则和通过条件。',
  objective_practice_assessment_misaligned: '让目标、步骤、练习和评估使用同一组目标ID一一对应。',
  feedback_missing: '补针对常见错误、纠正方式和重试路径的反馈规则。',
  recap_missing: '用至少三个可复盘检查项收束课程。',
  institutional_or_safety_boundary_missing: '补制度口径、岗位边界、危险操作和授权要求。',
  scene_action_or_turn_missing: '逐场补学习动作和能力变化。',
  truth_boundary_missing: '区分已核知识、教学组织、制度口径和未知项。',
};

const nonEmpty = (value: string | undefined) => Boolean(value?.trim());
const ratio = (value: number, total: number) => Math.round(value / Math.max(1, total) * 100);
const isFinalText = (text: string) => text.trim().length >= 180 && !/^(?:大纲|摘要|资料|课程提纲)[:：]/u.test(text.trim());

export function evaluateEducationTrainingProfessionalText(input: {
  package: ProfessionalTextPackage;
  training_evidence: EducationTrainingEvidence;
}): EducationTrainingEvaluation {
  const professionalPackage = input.package;
  if (professionalPackage.video_type !== 'education_training') throw new Error('education_training only');
  const evidence = input.training_evidence;
  const contract = getProfessionalTextTypeContract('education_training');
  const evidenceIds = new Set(professionalPackage.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id));
  const idsAreKnown = (ids: string[]) => ids.length > 0 && ids.every(id => evidenceIds.has(id));
  const briefCount = [
    professionalPackage.creative_brief.target_audience,
    professionalPackage.creative_brief.platform,
    professionalPackage.creative_brief.target_duration,
    professionalPackage.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const objectiveIds = new Set(evidence.learning_objectives.map(item => item.objective_id));
  const objectivesReady = evidence.learning_objectives.length >= 2 && evidence.learning_objectives.every(item =>
    nonEmpty(item.observable_action) && nonEmpty(item.success_criteria) && idsAreKnown(item.evidence_ids)
  );
  const stepsReady = evidence.knowledge_steps.length >= 3 && evidence.knowledge_steps.every((step, index) =>
    step.order === index + 1 && nonEmpty(step.title) && nonEmpty(step.instruction)
    && step.objective_ids.length > 0 && step.objective_ids.every(id => objectiveIds.has(id)) && idsAreKnown(step.evidence_ids)
  );
  const demonstrationsReady = stepsReady && evidence.knowledge_steps.every(step => nonEmpty(step.demonstration_action));
  const caseReady = nonEmpty(evidence.case_study.title) && nonEmpty(evidence.case_study.scenario)
    && nonEmpty(evidence.case_study.debrief) && idsAreKnown(evidence.case_study.evidence_ids);
  const practicesReady = evidence.practice_tasks.length >= evidence.learning_objectives.length && evidence.practice_tasks.every(task =>
    nonEmpty(task.instruction) && nonEmpty(task.expected_output)
    && task.objective_ids.length > 0 && task.objective_ids.every(id => objectiveIds.has(id))
  );
  const assessmentsReady = evidence.assessments.length >= evidence.learning_objectives.length && evidence.assessments.every(assessment =>
    nonEmpty(assessment.prompt) && assessment.rubric.filter(nonEmpty).length > 0 && nonEmpty(assessment.pass_condition)
    && assessment.objective_ids.length > 0 && assessment.objective_ids.every(id => objectiveIds.has(id))
  );
  const aligned = objectivesReady && stepsReady && practicesReady && assessmentsReady
    && [...objectiveIds].every(objectiveId =>
      evidence.knowledge_steps.some(step => step.objective_ids.includes(objectiveId))
      && evidence.practice_tasks.some(task => task.objective_ids.includes(objectiveId))
      && evidence.assessments.some(assessment => assessment.objective_ids.includes(objectiveId))
    );
  const feedbackReady = evidence.feedback_rules.filter(nonEmpty).length >= 2;
  const recapReady = evidence.recap_checklist.filter(nonEmpty).length >= 3;
  const safetyReady = evidence.institutional_accuracy_notes.filter(nonEmpty).length >= 2
    && evidence.knowledge_steps.every(step => step.safety_notes.filter(nonEmpty).length > 0);
  const scenesReady = professionalPackage.scene_breakdown.length >= 5 && professionalPackage.scene_breakdown.every(scene =>
    nonEmpty(scene.key_action) && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  );
  const truthReady = professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status === 'verified_fact')
    && professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status !== 'verified_fact')
    && professionalPackage.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0;
  const gateIds = [
    briefCount === 4 ? '' : 'brief_missing',
    isFinalText(professionalPackage.full_text) ? '' : 'full_text_not_final',
    nonEmpty(evidence.learner_profile) ? '' : 'learner_profile_missing',
    objectivesReady ? '' : 'learning_objective_missing',
    stepsReady ? '' : 'knowledge_step_missing',
    demonstrationsReady ? '' : 'demonstration_missing',
    caseReady ? '' : 'case_study_missing',
    practicesReady ? '' : 'practice_missing',
    assessmentsReady ? '' : 'assessment_missing',
    aligned ? '' : 'objective_practice_assessment_misaligned',
    feedbackReady ? '' : 'feedback_missing',
    recapReady ? '' : 'recap_missing',
    safetyReady ? '' : 'institutional_or_safety_boundary_missing',
    scenesReady ? '' : 'scene_action_or_turn_missing',
    truthReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);
  const dimension = (score: number, issues: string[] = []) => ({ score, evidence: [] as string[], issues });
  const dimensions: Record<ProfessionalQualityDimensionId, ReturnType<typeof dimension>> = {
    creative_brief_and_audience_promise: dimension(ratio(briefCount + Number(nonEmpty(evidence.learner_profile)) + Number(objectivesReady), 6)),
    premise_and_theme_unity: dimension(ratio(Number(objectivesReady) + Number(nonEmpty(professionalPackage.theme_statement)), 2)),
    structure_causality_and_pacing: dimension(ratio(Number(stepsReady) + Number(demonstrationsReady) + Number(aligned), 3), aligned ? [] : ['目标、步骤、练习和评估未闭环。']),
    character_agency_and_relationship_change: dimension(ratio(Number(practicesReady) + Number(assessmentsReady) + Number(feedbackReady), 3)),
    scene_function_visible_action_and_blocking: dimension(ratio(Number(demonstrationsReady) + Number(scenesReady), 2)),
    dialogue_narration_and_subtext: dimension(ratio(Number(nonEmpty(evidence.learner_profile)) + Number(feedbackReady), 2)),
    emotional_curve_and_aftertaste: dimension(ratio(Number(practicesReady) + Number(recapReady), 2)),
    cultural_fact_and_adaptation_boundary: dimension(ratio(Number(caseReady) + Number(safetyReady) + Number(truthReady), 3), truthReady ? [] : ['知识、制度或安全边界不足。']),
    production_executability: dimension(ratio(Number(demonstrationsReady) + Number(practicesReady) + Number(assessmentsReady), 3)),
    originality_and_distinctiveness: dimension(50, ['需真人教学设计、学科和导演评审。']),
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
      evaluator_notes: ['机器评分不构成专业通过。', '缺真实模型、教学设计、学科、安全和导演人审。'],
    },
    coverage_report: {
      verdict: gateIds.length ? 'rebuild' : 'pass',
      strengths: Object.entries(dimensions).filter(([, value]) => value.score >= 85).map(([dimensionId]) => dimensionId),
      structure_notes: dimensions.structure_causality_and_pacing.issues,
      character_or_information_notes: aligned ? [] : ['目标与学习活动未对齐。'],
      scene_notes: demonstrationsReady ? [] : ['示范不可见或不完整。'],
      dialogue_or_narration_notes: [],
      pacing_notes: [],
      fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
      production_notes: safetyReady ? [] : ['制度或安全边界不足。'],
      action_items: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
    },
  };
}

export const educationTrainingHardGateRepair = (gateId: string) => repairs[gateId];
