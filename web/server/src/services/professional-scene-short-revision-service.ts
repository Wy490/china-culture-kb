import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import {
  evaluateSceneShortProfessionalText,
  sceneShortHardGateRepair,
  type SceneShortEvidence,
} from './professional-scene-short-quality-service.js';

const gateId = (failure: string) => failure.split(':', 1)[0] || 'unknown';

export function buildSceneShortRevisionPlan(professionalPackage: ProfessionalTextPackage) {
  if (professionalPackage.video_type !== 'scene_short') throw new Error('scene short revision requires type');
  const humanEvidenceGates = new Set([
    'spatial_identity_missing',
    'route_missing',
    'geographic_boundary_missing',
    'truth_boundary_missing',
  ]);
  const actions = professionalPackage.quality_report.hard_gate_failures.map((failure, index) => {
    const issueId = gateId(failure);
    const humanEvidenceRequired = humanEvidenceGates.has(issueId);
    return {
      action_id: `scene-short-revision-${index + 1}`,
      issue_id: issueId,
      instruction: sceneShortHardGateRepair(issueId) ?? '按Coverage修订。',
      target_sections: (humanEvidenceRequired
        ? ['research_and_evidence_dossier', 'truth_and_adaptation_contract', 'continuity_ledger']
        : ['structure_outline', 'sequence_beats', 'full_text', 'director_text_plan']) as ProfessionalTextPackageField[],
      repair_mode: humanEvidenceRequired ? 'human_evidence_required' as const : 'model_rewrite_required' as const,
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'] as ProfessionalTextPackageField[],
    };
  });
  return {
    schema_version: 'professional-text-revision-plan/v1' as const,
    package_id: professionalPackage.package_id,
    video_type: 'scene_short' as const,
    action_count: actions.length,
    deterministic_action_count: 0,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false as const,
  };
}

export function rebuildSceneShortDerivedText(input: {
  package: ProfessionalTextPackage;
  scene_evidence: SceneShortEvidence;
}) {
  const professionalPackage = structuredClone(input.package);
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (professionalPackage.sequence_beats.length !== input.scene_evidence.route_nodes.length) {
    professionalPackage.sequence_beats = input.scene_evidence.route_nodes.map(node => ({
      beat_id: `scene-short-rebuild-${node.order}`,
      order: node.order,
      title: node.space,
      purpose: node.trigger,
      visible_action: node.shot_action,
      conflict_discovery_or_instruction: node.discovery_or_change,
      emotional_or_information_turn: node.time_layer,
      evidence_ids: node.evidence_ids,
    }));
    rebuiltSections.push('sequence_beats');
  }
  const evaluation = evaluateSceneShortProfessionalText({
    package: professionalPackage,
    scene_evidence: input.scene_evidence,
  });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  return { package: professionalPackage, rebuilt_sections: rebuiltSections };
}
