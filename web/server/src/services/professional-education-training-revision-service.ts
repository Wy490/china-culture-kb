import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import {
  educationTrainingHardGateRepair,
  evaluateEducationTrainingProfessionalText,
  type EducationTrainingEvidence,
} from './professional-education-training-quality-service.js';

const gateId = (failure: string) => failure.split(':', 1)[0] || 'unknown';

export function buildEducationTrainingRevisionPlan(professionalPackage: ProfessionalTextPackage) {
  if (professionalPackage.video_type !== 'education_training') throw new Error('education training revision requires type');
  const humanEvidenceGates = new Set([
    'learning_objective_missing',
    'knowledge_step_missing',
    'case_study_missing',
    'assessment_missing',
    'institutional_or_safety_boundary_missing',
    'truth_boundary_missing',
  ]);
  const actions = professionalPackage.quality_report.hard_gate_failures.map((failure, index) => {
    const issueId = gateId(failure);
    const humanEvidenceRequired = humanEvidenceGates.has(issueId);
    return {
      action_id: `training-revision-${index + 1}`,
      issue_id: issueId,
      instruction: educationTrainingHardGateRepair(issueId) ?? '按Coverage修订。',
      target_sections: (humanEvidenceRequired
        ? ['research_and_evidence_dossier', 'truth_and_adaptation_contract', 'continuity_ledger']
        : ['structure_outline', 'sequence_beats', 'full_text', 'dialogue_or_narration_pass']) as ProfessionalTextPackageField[],
      repair_mode: humanEvidenceRequired ? 'human_evidence_required' as const : 'model_rewrite_required' as const,
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'] as ProfessionalTextPackageField[],
    };
  });
  return {
    schema_version: 'professional-text-revision-plan/v1' as const,
    package_id: professionalPackage.package_id,
    video_type: 'education_training' as const,
    action_count: actions.length,
    deterministic_action_count: 0,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false as const,
  };
}

export function rebuildEducationTrainingDerivedText(input: {
  package: ProfessionalTextPackage;
  training_evidence: EducationTrainingEvidence;
}) {
  const professionalPackage = structuredClone(input.package);
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (professionalPackage.sequence_beats.length !== input.training_evidence.knowledge_steps.length) {
    professionalPackage.sequence_beats = input.training_evidence.knowledge_steps.map(step => ({
      beat_id: `training-rebuild-${step.order}`,
      order: step.order,
      title: step.title,
      purpose: step.instruction,
      visible_action: step.demonstration_action,
      conflict_discovery_or_instruction: input.training_evidence.practice_tasks.find(task => task.objective_ids.some(id => step.objective_ids.includes(id)))?.instruction ?? step.instruction,
      emotional_or_information_turn: input.training_evidence.assessments.find(assessment => assessment.objective_ids.some(id => step.objective_ids.includes(id)))?.pass_condition ?? '',
      evidence_ids: step.evidence_ids,
    }));
    rebuiltSections.push('sequence_beats');
  }
  const evaluation = evaluateEducationTrainingProfessionalText({
    package: professionalPackage,
    training_evidence: input.training_evidence,
  });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  return { package: professionalPackage, rebuilt_sections: rebuiltSections };
}
