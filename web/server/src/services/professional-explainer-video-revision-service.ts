import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import {
  evaluateExplainerVideoProfessionalText,
  explainerVideoHardGateRepair,
  type ExplainerVideoEvidence,
} from './professional-explainer-video-quality-service.js';

const gateId = (failure: string) => failure.split(':', 1)[0] || 'unknown';

export function buildExplainerVideoRevisionPlan(professionalPackage: ProfessionalTextPackage) {
  if (professionalPackage.video_type !== 'explainer_video') throw new Error('explainer video revision requires type');
  const humanEvidenceGates = new Set([
    'concept_sequence_missing',
    'example_mapping_missing',
    'visual_metaphor_boundary_missing',
    'misconception_missing',
    'truth_boundary_missing',
  ]);
  const actions = professionalPackage.quality_report.hard_gate_failures.map((failure, index) => {
    const issueId = gateId(failure);
    const humanEvidenceRequired = humanEvidenceGates.has(issueId);
    return {
      action_id: `explainer-revision-${index + 1}`,
      issue_id: issueId,
      instruction: explainerVideoHardGateRepair(issueId) ?? '按Coverage修订。',
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
    video_type: 'explainer_video' as const,
    action_count: actions.length,
    deterministic_action_count: 0,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false as const,
  };
}

export function rebuildExplainerVideoDerivedText(input: {
  package: ProfessionalTextPackage;
  explainer_evidence: ExplainerVideoEvidence;
}) {
  const professionalPackage = structuredClone(input.package);
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (professionalPackage.sequence_beats.length !== input.explainer_evidence.concept_units.length) {
    professionalPackage.sequence_beats = input.explainer_evidence.concept_units.map(unit => ({
      beat_id: `explainer-rebuild-${unit.order}`,
      order: unit.order,
      title: unit.concept,
      purpose: unit.definition,
      visible_action: input.explainer_evidence.visual_explanations.find(visual => visual.mapped_concept_id === unit.concept_id)?.visual_mechanism ?? '',
      conflict_discovery_or_instruction: input.explainer_evidence.examples.find(example => example.mapped_concept_id === unit.concept_id)?.what_it_proves ?? unit.definition,
      emotional_or_information_turn: '从定义转向可视化理解',
      evidence_ids: unit.evidence_ids,
    }));
    rebuiltSections.push('sequence_beats');
  }
  const evaluation = evaluateExplainerVideoProfessionalText({
    package: professionalPackage,
    explainer_evidence: input.explainer_evidence,
  });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  return { package: professionalPackage, rebuilt_sections: rebuiltSections };
}
