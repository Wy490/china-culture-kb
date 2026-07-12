import type {
  ProfessionalTextPackage,
  ProfessionalTextPackageField,
} from '@shared/types.js';
import {
  evaluateLegendStoryProfessionalText,
  legendStoryHardGateRepair,
  type LegendStoryProfessionalEvidence,
} from './professional-legend-story-quality-service.js';

export interface LegendStoryRevisionAction {
  action_id: string;
  issue_id: string;
  instruction: string;
  target_sections: ProfessionalTextPackageField[];
  repair_mode: 'deterministic_derived_rebuild' | 'model_rewrite_required' | 'human_evidence_required';
  rebuild_derived_sections: ProfessionalTextPackageField[];
}

export interface LegendStoryRevisionPlan {
  schema_version: 'professional-text-revision-plan/v1';
  package_id: string;
  video_type: 'legend_story';
  action_count: number;
  deterministic_action_count: number;
  model_rewrite_action_count: number;
  human_evidence_action_count: number;
  actions: LegendStoryRevisionAction[];
  professional_passed: false;
}

function issueId(failure: string): string {
  return failure.split(':', 1)[0]?.trim() || 'unknown_issue';
}

function actionForIssue(issue: string, index: number): LegendStoryRevisionAction {
  const instruction = legendStoryHardGateRepair(issue)
    ?? '根据 Legend Story Coverage 定点修订，并重建受影响的派生文本。';
  const config: Record<string, Pick<LegendStoryRevisionAction,
    'target_sections' | 'repair_mode' | 'rebuild_derived_sections'
  >> = {
    brief_missing: {
      target_sections: ['creative_brief', 'audience_promise'],
      repair_mode: 'human_evidence_required',
      rebuild_derived_sections: [],
    },
    full_text_not_final: {
      target_sections: ['full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['scene_breakdown', 'sequence_beats', 'director_text_plan', 'delivery_text_package'],
    },
    version_boundary_missing: {
      target_sections: ['truth_and_adaptation_contract', 'continuity_ledger'],
      repair_mode: 'human_evidence_required',
      rebuild_derived_sections: ['sequence_beats', 'scene_breakdown', 'director_text_plan', 'delivery_text_package'],
    },
    supernatural_function_missing: {
      target_sections: ['premise_or_core_question', 'structure_outline', 'sequence_beats'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['scene_breakdown', 'full_text', 'director_text_plan', 'delivery_text_package'],
    },
    human_trial_missing: {
      target_sections: ['structure_outline', 'sequence_beats', 'scene_breakdown', 'full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'],
    },
    choice_or_consequence_missing: {
      target_sections: ['structure_outline', 'sequence_beats', 'scene_breakdown', 'full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'],
    },
    symbolic_motif_missing: {
      target_sections: ['theme_statement', 'director_text_plan', 'continuity_ledger'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['scene_breakdown', 'delivery_text_package'],
    },
    motif_repetition_missing: {
      target_sections: ['sequence_beats', 'scene_breakdown', 'director_text_plan', 'continuity_ledger'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['delivery_text_package'],
    },
    scene_action_or_turn_missing: {
      target_sections: ['sequence_beats', 'scene_breakdown'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'],
    },
    oral_rhythm_missing: {
      target_sections: ['dialogue_or_narration_pass', 'full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['scene_breakdown', 'delivery_text_package'],
    },
    scene_legend_boundary_missing: {
      target_sections: ['truth_and_adaptation_contract', 'continuity_ledger', 'scene_breakdown'],
      repair_mode: 'human_evidence_required',
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'],
    },
    truth_boundary_missing: {
      target_sections: ['truth_and_adaptation_contract', 'continuity_ledger'],
      repair_mode: 'human_evidence_required',
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'],
    },
  };
  const selected = config[issue] ?? {
    target_sections: ['coverage_report'] as ProfessionalTextPackageField[],
    repair_mode: 'model_rewrite_required' as const,
    rebuild_derived_sections: [],
  };
  return {
    action_id: `legend-revision-action-${index + 1}`,
    issue_id: issue,
    instruction,
    ...selected,
  };
}

export function buildLegendStoryRevisionPlan(pkg: ProfessionalTextPackage): LegendStoryRevisionPlan {
  if (pkg.video_type !== 'legend_story') {
    throw new Error('legend_story revision plan requires a legend_story package');
  }
  const actions = pkg.quality_report.hard_gate_failures.map((failure, index) =>
    actionForIssue(issueId(failure), index)
  );
  return {
    schema_version: 'professional-text-revision-plan/v1',
    package_id: pkg.package_id,
    video_type: 'legend_story',
    action_count: actions.length,
    deterministic_action_count: actions.filter(action =>
      action.repair_mode === 'deterministic_derived_rebuild'
    ).length,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false,
  };
}

export function rebuildLegendStoryDerivedText(input: {
  package: ProfessionalTextPackage;
  legend_evidence: LegendStoryProfessionalEvidence;
  now?: string;
}): { package: ProfessionalTextPackage; rebuilt_sections: ProfessionalTextPackageField[] } {
  const pkg = structuredClone(input.package);
  if (pkg.video_type !== 'legend_story') {
    throw new Error('legend_story derived rebuild requires a legend_story package');
  }
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (pkg.sequence_beats.length !== pkg.scene_breakdown.length) {
    pkg.sequence_beats = pkg.scene_breakdown.map((scene, index) => ({
      beat_id: `legend-rebuild-beat-${index + 1}`,
      order: index + 1,
      title: scene.title,
      purpose: scene.dramatic_function,
      visible_action: scene.key_action,
      conflict_discovery_or_instruction: scene.conflict ?? scene.plot,
      emotional_or_information_turn: input.legend_evidence.scene_turns[String(scene.scene_id)] ?? '',
      evidence_ids: [],
    }));
    rebuiltSections.push('sequence_beats');
  }
  if (pkg.director_text_plan.sequences.length !== pkg.scene_breakdown.length) {
    pkg.director_text_plan.sequences = pkg.scene_breakdown.map(scene => ({
      sequence_id: `legend-sequence-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration ?? '风、水、脚步和器物声形成口述节拍。',
      production_constraints: [
        scene.cultural_note,
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter((item): item is string => Boolean(item)),
    }));
    rebuiltSections.push('director_text_plan');
  }
  if (pkg.delivery_text_package.scene_units.length !== pkg.scene_breakdown.length) {
    pkg.delivery_text_package.scene_units = pkg.scene_breakdown.map(scene => ({
      scene_id: scene.scene_id,
      script_text: scene.dialogue_or_narration ?? scene.plot,
      visual_action: scene.key_action,
      camera_intent: scene.camera_suggestion,
      sound_intent: '保持人物对白、口述节奏和环境声分层。',
      continuity_notes: [scene.location, scene.time_of_day, ...scene.characters].filter(Boolean),
      evidence_boundary_notes: [
        ...(scene.source_entries ?? []),
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter((item): item is string => Boolean(item)),
    }));
    rebuiltSections.push('delivery_text_package');
  }
  const evaluation = evaluateLegendStoryProfessionalText({
    package: pkg,
    legend_evidence: input.legend_evidence,
  });
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = pkg.quality_report.hard_gate_failures.length > 0 ? 'revision_required' : 'in_review';
  pkg.updated_at = input.now ?? new Date().toISOString();
  if (rebuiltSections.length > 0) {
    pkg.revision_trace.push({
      revision_id: `legend-derived-rebuild-${pkg.revision_trace.length + 1}`,
      created_at: pkg.updated_at,
      source: 'agent',
      reason: '重建与当前传说分场不一致的派生专业文本。',
      changed_sections: rebuiltSections,
      resolved_issue_ids: [],
      remaining_issues: pkg.quality_report.hard_gate_failures.map(issueId),
    });
  }
  return { package: pkg, rebuilt_sections: rebuiltSections };
}
