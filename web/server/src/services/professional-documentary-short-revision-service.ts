import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import {
  documentaryShortHardGateRepair,
  evaluateDocumentaryShortProfessionalText,
  type DocumentaryShortEvidence,
} from './professional-documentary-short-quality-service.js';

const gateId = (failure: string) => failure.split(':', 1)[0] || 'unknown';

export function buildDocumentaryShortRevisionPlan(professionalPackage: ProfessionalTextPackage) {
  if (professionalPackage.video_type !== 'documentary_short') throw new Error('documentary short revision requires type');
  const humanEvidenceGates = new Set([
    'real_site_missing',
    'interview_role_missing',
    'interview_consent_missing',
    'source_trace_missing',
    'reenactment_boundary_missing',
    'truth_boundary_missing',
  ]);
  const actions = professionalPackage.quality_report.hard_gate_failures.map((failure, index) => {
    const issueId = gateId(failure);
    const humanEvidenceRequired = humanEvidenceGates.has(issueId);
    return {
      action_id: `documentary-revision-${index + 1}`,
      issue_id: issueId,
      instruction: documentaryShortHardGateRepair(issueId) ?? '按Coverage修订。',
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
    video_type: 'documentary_short' as const,
    action_count: actions.length,
    deterministic_action_count: 0,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false as const,
  };
}

export function rebuildDocumentaryShortDerivedText(input: {
  package: ProfessionalTextPackage;
  documentary_evidence: DocumentaryShortEvidence;
}) {
  const professionalPackage = structuredClone(input.package);
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (professionalPackage.sequence_beats.length !== input.documentary_evidence.discovery_chain.length) {
    professionalPackage.sequence_beats = input.documentary_evidence.discovery_chain.map(step => ({
      beat_id: `documentary-rebuild-${step.order}`,
      order: step.order,
      title: `证据发现${step.order}`,
      purpose: step.question_or_discovery,
      visible_action: input.documentary_evidence.b_roll_plan[step.order - 1]?.visible_action ?? '',
      conflict_discovery_or_instruction: step.question_or_discovery,
      emotional_or_information_turn: step.leads_to,
      evidence_ids: step.evidence_ids,
    }));
    rebuiltSections.push('sequence_beats');
  }
  const evaluation = evaluateDocumentaryShortProfessionalText({
    package: professionalPackage,
    documentary_evidence: input.documentary_evidence,
  });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  return { package: professionalPackage, rebuilt_sections: rebuiltSections };
}
