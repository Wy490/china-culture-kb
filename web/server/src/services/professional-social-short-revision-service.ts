import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import {
  evaluateSocialShortProfessionalText,
  socialShortHardGateRepair,
  type SocialShortEvidence,
} from './professional-social-short-quality-service.js';

const gateId = (failure: string) => failure.split(':', 1)[0] || 'unknown';

export function buildSocialShortRevisionPlan(professionalPackage: ProfessionalTextPackage) {
  if (professionalPackage.video_type !== 'social_short') throw new Error('social short revision requires type');
  const humanEvidenceGates = new Set([
    'hook_fact_boundary_missing',
    'platform_safety_missing',
    'truth_boundary_missing',
  ]);
  const actions = professionalPackage.quality_report.hard_gate_failures.map((failure, index) => {
    const issueId = gateId(failure);
    const humanEvidenceRequired = humanEvidenceGates.has(issueId);
    return {
      action_id: `social-revision-${index + 1}`,
      issue_id: issueId,
      instruction: socialShortHardGateRepair(issueId) ?? '按Coverage修订。',
      target_sections: (humanEvidenceRequired
        ? ['research_and_evidence_dossier', 'truth_and_adaptation_contract']
        : ['structure_outline', 'sequence_beats', 'full_text', 'dialogue_or_narration_pass']) as ProfessionalTextPackageField[],
      repair_mode: humanEvidenceRequired ? 'human_evidence_required' as const : 'model_rewrite_required' as const,
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'] as ProfessionalTextPackageField[],
    };
  });
  return {
    schema_version: 'professional-text-revision-plan/v1' as const,
    package_id: professionalPackage.package_id,
    video_type: 'social_short' as const,
    action_count: actions.length,
    deterministic_action_count: 0,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false as const,
  };
}

export function rebuildSocialShortDerivedText(input: {
  package: ProfessionalTextPackage;
  social_evidence: SocialShortEvidence;
}) {
  const professionalPackage = structuredClone(input.package);
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (professionalPackage.sequence_beats.length !== input.social_evidence.beat_plan.length) {
    professionalPackage.sequence_beats = input.social_evidence.beat_plan.map(beat => ({
      beat_id: beat.beat_id,
      order: beat.order,
      title: `${beat.start_sec}-${beat.end_sec}秒`,
      purpose: beat.order === 1 ? '三秒钩子' : '持续新信息',
      visible_action: beat.vertical_visual,
      conflict_discovery_or_instruction: beat.new_information,
      emotional_or_information_turn: beat.contrast_or_turn,
      evidence_ids: beat.evidence_ids,
    }));
    rebuiltSections.push('sequence_beats');
  }
  const evaluation = evaluateSocialShortProfessionalText({
    package: professionalPackage,
    social_evidence: input.social_evidence,
  });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  return { package: professionalPackage, rebuilt_sections: rebuiltSections };
}
