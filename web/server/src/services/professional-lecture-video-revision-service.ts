import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import {
  evaluateLectureVideoProfessionalText,
  lectureVideoHardGateRepair,
  type LectureVideoEvidence,
} from './professional-lecture-video-quality-service.js';

const gateId = (failure: string) => failure.split(':', 1)[0] || 'unknown';

export function buildLectureVideoRevisionPlan(professionalPackage: ProfessionalTextPackage) {
  if (professionalPackage.video_type !== 'lecture_video') throw new Error('lecture video revision requires type');
  const humanEvidenceGates = new Set([
    'argument_evidence_missing',
    'case_missing',
    'counterargument_response_missing',
    'institutional_wording_unconfirmed',
    'value_boundary_missing',
    'truth_boundary_missing',
  ]);
  const actions = professionalPackage.quality_report.hard_gate_failures.map((failure, index) => {
    const issueId = gateId(failure);
    const humanEvidenceRequired = humanEvidenceGates.has(issueId);
    return {
      action_id: `lecture-revision-${index + 1}`,
      issue_id: issueId,
      instruction: lectureVideoHardGateRepair(issueId) ?? '按Coverage修订。',
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
    video_type: 'lecture_video' as const,
    action_count: actions.length,
    deterministic_action_count: 0,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false as const,
  };
}

export function rebuildLectureVideoDerivedText(input: {
  package: ProfessionalTextPackage;
  lecture_evidence: LectureVideoEvidence;
}) {
  const professionalPackage = structuredClone(input.package);
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (professionalPackage.sequence_beats.length !== input.lecture_evidence.arguments.length) {
    professionalPackage.sequence_beats = input.lecture_evidence.arguments.map(argument => ({
      beat_id: `lecture-rebuild-${argument.order}`,
      order: argument.order,
      title: argument.claim,
      purpose: argument.reasoning,
      visible_action: input.lecture_evidence.cases.find(item => argument.case_ids.includes(item.case_id))?.factual_summary ?? '',
      conflict_discovery_or_instruction: argument.reasoning,
      emotional_or_information_turn: input.lecture_evidence.rhetorical_transitions[argument.order - 1] ?? '',
      evidence_ids: argument.evidence_ids,
    }));
    rebuiltSections.push('sequence_beats');
  }
  const evaluation = evaluateLectureVideoProfessionalText({
    package: professionalPackage,
    lecture_evidence: input.lecture_evidence,
  });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  return { package: professionalPackage, rebuilt_sections: rebuiltSections };
}
