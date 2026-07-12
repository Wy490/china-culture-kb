import type {
  ProfessionalTextPackage,
  ProfessionalTextPackageField,
} from '@shared/types.js';
import {
  characterStoryHardGateRepair,
  evaluateCharacterStoryProfessionalText,
  type CharacterStoryProfessionalEvidence,
} from './professional-text-quality-service.js';

export interface ProfessionalTextRevisionAction {
  action_id: string;
  issue_id: string;
  instruction: string;
  target_sections: ProfessionalTextPackageField[];
  repair_mode: 'deterministic_derived_rebuild' | 'model_rewrite_required' | 'human_evidence_required';
  rebuild_derived_sections: ProfessionalTextPackageField[];
}

export interface ProfessionalTextRevisionPlan {
  schema_version: 'professional-text-revision-plan/v1';
  package_id: string;
  video_type: 'character_story';
  action_count: number;
  deterministic_action_count: number;
  model_rewrite_action_count: number;
  human_evidence_action_count: number;
  actions: ProfessionalTextRevisionAction[];
  professional_passed: false;
}

function issueId(failure: string): string {
  return failure.split(':', 1)[0]?.trim() || 'unknown_issue';
}

function actionForIssue(issue: string, index: number): ProfessionalTextRevisionAction {
  const instruction = characterStoryHardGateRepair(issue) ?? '根据 Coverage 定点修订，并重建受影响的派生文本。';
  const config: Record<string, Pick<ProfessionalTextRevisionAction,
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
    character_goal_missing: {
      target_sections: ['structure_outline', 'sequence_beats', 'full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['scene_breakdown', 'director_text_plan', 'delivery_text_package'],
    },
    resistance_missing: {
      target_sections: ['structure_outline', 'sequence_beats', 'scene_breakdown'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['full_text', 'director_text_plan', 'delivery_text_package'],
    },
    choice_missing: {
      target_sections: ['structure_outline', 'sequence_beats', 'full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['scene_breakdown', 'director_text_plan', 'delivery_text_package'],
    },
    cost_missing: {
      target_sections: ['sequence_beats', 'scene_breakdown', 'full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'],
    },
    relationship_change_missing: {
      target_sections: ['structure_outline', 'continuity_ledger', 'scene_breakdown'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['full_text', 'director_text_plan', 'delivery_text_package'],
    },
    scene_action_or_turn_missing: {
      target_sections: ['sequence_beats', 'scene_breakdown'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'],
    },
    dialogue_voice_or_subtext_missing: {
      target_sections: ['dialogue_or_narration_pass', 'full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['scene_breakdown', 'delivery_text_package'],
    },
    truth_boundary_missing: {
      target_sections: ['truth_and_adaptation_contract', 'continuity_ledger'],
      repair_mode: 'human_evidence_required',
      rebuild_derived_sections: ['scene_breakdown', 'director_text_plan', 'delivery_text_package'],
    },
  };
  const selected = config[issue] ?? {
    target_sections: ['coverage_report'] as ProfessionalTextPackageField[],
    repair_mode: 'model_rewrite_required' as const,
    rebuild_derived_sections: [],
  };
  return {
    action_id: `revision-action-${index + 1}`,
    issue_id: issue,
    instruction,
    ...selected,
  };
}

export function buildCharacterStoryRevisionPlan(
  pkg: ProfessionalTextPackage,
): ProfessionalTextRevisionPlan {
  if (pkg.video_type !== 'character_story') {
    throw new Error('character_story revision plan requires a character_story package');
  }
  const actions = pkg.quality_report.hard_gate_failures.map((failure, index) =>
    actionForIssue(issueId(failure), index)
  );
  return {
    schema_version: 'professional-text-revision-plan/v1',
    package_id: pkg.package_id,
    video_type: 'character_story',
    action_count: actions.length,
    deterministic_action_count: actions.filter(action => action.repair_mode === 'deterministic_derived_rebuild').length,
    model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length,
    human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length,
    actions,
    professional_passed: false,
  };
}

export function rebuildCharacterStoryDerivedText(input: {
  package: ProfessionalTextPackage;
  character_evidence: CharacterStoryProfessionalEvidence;
  now?: string;
}): { package: ProfessionalTextPackage; rebuilt_sections: ProfessionalTextPackageField[] } {
  const pkg = structuredClone(input.package);
  if (pkg.video_type !== 'character_story') {
    throw new Error('character_story derived rebuild requires a character_story package');
  }
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (pkg.sequence_beats.length !== pkg.scene_breakdown.length) {
    pkg.sequence_beats = pkg.scene_breakdown.map((scene, index) => ({
      beat_id: `rebuild-beat-${index + 1}`,
      order: index + 1,
      title: scene.title,
      purpose: scene.dramatic_function,
      visible_action: scene.key_action,
      conflict_discovery_or_instruction: scene.conflict ?? scene.plot,
      emotional_or_information_turn: input.character_evidence.scene_turns[String(scene.scene_id)] ?? '',
      evidence_ids: [],
    }));
    rebuiltSections.push('sequence_beats');
  }
  if (pkg.director_text_plan.sequences.length !== pkg.scene_breakdown.length) {
    pkg.director_text_plan.sequences = pkg.scene_breakdown.map(scene => ({
      sequence_id: `sequence-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration ?? '环境声和动作声承担推进。',
      production_constraints: [scene.cultural_note].filter(Boolean),
    }));
    rebuiltSections.push('director_text_plan');
  }
  if (pkg.delivery_text_package.scene_units.length !== pkg.scene_breakdown.length) {
    pkg.delivery_text_package.scene_units = pkg.scene_breakdown.map(scene => ({
      scene_id: scene.scene_id,
      script_text: scene.dialogue_or_narration ?? scene.plot,
      visual_action: scene.key_action,
      camera_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration ?? '环境声和动作声承担推进。',
      continuity_notes: [scene.location, ...scene.characters].filter(Boolean),
      evidence_boundary_notes: [scene.factual_basis, ...(scene.fictionalized_elements ?? [])].filter(
        (item): item is string => Boolean(item),
      ),
    }));
    rebuiltSections.push('delivery_text_package');
  }
  const evaluation = evaluateCharacterStoryProfessionalText({
    package: pkg,
    character_evidence: input.character_evidence,
  });
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = pkg.quality_report.hard_gate_failures.length > 0 ? 'revision_required' : 'in_review';
  pkg.updated_at = input.now ?? new Date().toISOString();
  if (rebuiltSections.length > 0) {
    pkg.revision_trace.push({
      revision_id: `derived-rebuild-${pkg.revision_trace.length + 1}`,
      created_at: pkg.updated_at,
      source: 'agent',
      reason: '重建与当前分场不一致的派生专业文本。',
      changed_sections: rebuiltSections,
      resolved_issue_ids: [],
      remaining_issues: pkg.quality_report.hard_gate_failures.map(issueId),
    });
  }
  return { package: pkg, rebuilt_sections: rebuiltSections };
}
