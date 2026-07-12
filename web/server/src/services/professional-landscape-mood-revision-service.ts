import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import {
  evaluateLandscapeMoodProfessionalText,
  landscapeMoodHardGateRepair,
  type LandscapeMoodEvidence,
} from './professional-landscape-mood-quality-service.js';

const gateId = (failure: string) => failure.split(':', 1)[0] || 'unknown';

export function buildLandscapeMoodRevisionPlan(professionalPackage: ProfessionalTextPackage) {
  if (professionalPackage.video_type !== 'landscape_mood') throw new Error('landscape mood revision requires type');
  const humanEvidenceGates = new Set([
    'visual_phase_missing',
    'space_anchor_missing',
    'geographic_boundary_missing',
    'truth_boundary_missing',
  ]);
  const actions = professionalPackage.quality_report.hard_gate_failures.map((failure, index) => {
    const issueId = gateId(failure);
    const humanEvidenceRequired = humanEvidenceGates.has(issueId);
    return {
      action_id: `landscape-revision-${index + 1}`,
      issue_id: issueId,
      instruction: landscapeMoodHardGateRepair(issueId) ?? '按Coverage修订。',
      target_sections: (humanEvidenceRequired
        ? ['research_and_evidence_dossier', 'truth_and_adaptation_contract', 'continuity_ledger']
        : ['structure_outline', 'sequence_beats', 'dialogue_or_narration_pass', 'director_text_plan']) as ProfessionalTextPackageField[],
      repair_mode: humanEvidenceRequired ? 'human_evidence_required' as const : 'model_rewrite_required' as const,
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'] as ProfessionalTextPackageField[],
    };
  });
  return {
    schema_version: 'professional-text-revision-plan/v1' as const,
    package_id: professionalPackage.package_id,
    video_type: 'landscape_mood' as const,
    action_count: actions.length,
    deterministic_action_count: 0,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false as const,
  };
}

export function rebuildLandscapeMoodDerivedText(input: {
  package: ProfessionalTextPackage;
  landscape_evidence: LandscapeMoodEvidence;
}) {
  const professionalPackage = structuredClone(input.package);
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (professionalPackage.sequence_beats.length !== input.landscape_evidence.visual_phases.length) {
    professionalPackage.sequence_beats = input.landscape_evidence.visual_phases.map(phase => ({
      beat_id: `landscape-rebuild-${phase.order}`,
      order: phase.order,
      title: `${phase.time_state}｜${phase.space_anchor}`,
      purpose: phase.composition,
      visible_action: phase.natural_motion,
      conflict_discovery_or_instruction: phase.light_or_weather,
      emotional_or_information_turn: phase.natural_sound,
      evidence_ids: phase.evidence_ids,
    }));
    rebuiltSections.push('sequence_beats');
  }
  const evaluation = evaluateLandscapeMoodProfessionalText({
    package: professionalPackage,
    landscape_evidence: input.landscape_evidence,
  });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  return { package: professionalPackage, rebuilt_sections: rebuiltSections };
}
