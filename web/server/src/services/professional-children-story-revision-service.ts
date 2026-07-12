import type {
  ProfessionalTextPackage,
  ProfessionalTextPackageField,
} from '@shared/types.js';
import {
  childrenStoryHardGateRepair,
  evaluateChildrenStoryProfessionalText,
  type ChildrenStoryProfessionalEvidence,
} from './professional-children-story-quality-service.js';

export interface ChildrenStoryRevisionAction {
  action_id: string;
  issue_id: string;
  instruction: string;
  target_sections: ProfessionalTextPackageField[];
  repair_mode: 'deterministic_derived_rebuild' | 'model_rewrite_required' | 'human_evidence_required';
  rebuild_derived_sections: ProfessionalTextPackageField[];
}

export interface ChildrenStoryRevisionPlan {
  schema_version: 'professional-text-revision-plan/v1';
  package_id: string;
  video_type: 'children_story';
  action_count: number;
  deterministic_action_count: number;
  model_rewrite_action_count: number;
  human_evidence_action_count: number;
  actions: ChildrenStoryRevisionAction[];
  professional_passed: false;
}

function issueId(failure: string): string {
  return failure.split(':', 1)[0]?.trim() || 'unknown_issue';
}

function actionForIssue(issue: string, index: number): ChildrenStoryRevisionAction {
  const instruction = childrenStoryHardGateRepair(issue)
    ?? '根据 Children Story Coverage 定点修订，并重建受影响的派生文本。';
  const humanEvidenceIssues = new Set([
    'brief_missing',
    'age_and_language_missing',
    'child_safety_boundary_missing',
    'parent_or_teacher_prompt_missing',
    'cultural_truth_boundary_missing',
  ]);
  const targetByIssue: Record<string, ProfessionalTextPackageField[]> = {
    brief_missing: ['creative_brief', 'audience_promise'],
    full_text_not_final: ['full_text'],
    age_and_language_missing: ['creative_brief', 'dialogue_or_narration_pass', 'continuity_ledger'],
    child_goal_missing: ['premise_or_core_question', 'structure_outline', 'full_text'],
    gentle_conflict_missing: ['structure_outline', 'sequence_beats', 'scene_breakdown', 'full_text'],
    attempt_causality_missing: ['structure_outline', 'sequence_beats', 'scene_breakdown'],
    positive_choice_missing: ['structure_outline', 'scene_breakdown', 'full_text'],
    emotional_learning_missing: ['theme_statement', 'structure_outline', 'full_text'],
    repeated_motif_missing: ['sequence_beats', 'scene_breakdown', 'director_text_plan', 'continuity_ledger'],
    warm_resolution_missing: ['structure_outline', 'scene_breakdown', 'full_text'],
    scene_action_or_turn_missing: ['sequence_beats', 'scene_breakdown'],
    child_safety_boundary_missing: ['creative_brief', 'director_text_plan', 'delivery_text_package'],
    parent_or_teacher_prompt_missing: ['delivery_text_package'],
    cultural_truth_boundary_missing: ['truth_and_adaptation_contract', 'continuity_ledger'],
  };
  const rebuildByIssue: Record<string, ProfessionalTextPackageField[]> = {
    full_text_not_final: ['scene_breakdown', 'sequence_beats', 'director_text_plan', 'delivery_text_package'],
    child_goal_missing: ['scene_breakdown', 'director_text_plan', 'delivery_text_package'],
    gentle_conflict_missing: ['full_text', 'director_text_plan', 'delivery_text_package'],
    attempt_causality_missing: ['full_text', 'director_text_plan', 'delivery_text_package'],
    positive_choice_missing: ['sequence_beats', 'director_text_plan', 'delivery_text_package'],
    emotional_learning_missing: ['scene_breakdown', 'delivery_text_package'],
    repeated_motif_missing: ['delivery_text_package'],
    warm_resolution_missing: ['director_text_plan', 'delivery_text_package'],
    scene_action_or_turn_missing: ['director_text_plan', 'delivery_text_package'],
    cultural_truth_boundary_missing: ['director_text_plan', 'delivery_text_package'],
  };
  return {
    action_id: `children-revision-action-${index + 1}`,
    issue_id: issue,
    instruction,
    target_sections: targetByIssue[issue] ?? ['coverage_report'],
    repair_mode: humanEvidenceIssues.has(issue) ? 'human_evidence_required' : 'model_rewrite_required',
    rebuild_derived_sections: rebuildByIssue[issue] ?? [],
  };
}

export function buildChildrenStoryRevisionPlan(pkg: ProfessionalTextPackage): ChildrenStoryRevisionPlan {
  if (pkg.video_type !== 'children_story') {
    throw new Error('children_story revision plan requires a children_story package');
  }
  const actions = pkg.quality_report.hard_gate_failures.map((failure, index) =>
    actionForIssue(issueId(failure), index)
  );
  return {
    schema_version: 'professional-text-revision-plan/v1',
    package_id: pkg.package_id,
    video_type: 'children_story',
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

export function rebuildChildrenStoryDerivedText(input: {
  package: ProfessionalTextPackage;
  children_evidence: ChildrenStoryProfessionalEvidence;
  now?: string;
}): { package: ProfessionalTextPackage; rebuilt_sections: ProfessionalTextPackageField[] } {
  const pkg = structuredClone(input.package);
  if (pkg.video_type !== 'children_story') {
    throw new Error('children_story derived rebuild requires a children_story package');
  }
  const rebuiltSections: ProfessionalTextPackageField[] = [];
  if (pkg.sequence_beats.length !== pkg.scene_breakdown.length) {
    pkg.sequence_beats = pkg.scene_breakdown.map((scene, index) => ({
      beat_id: `children-rebuild-beat-${index + 1}`,
      order: index + 1,
      title: scene.title,
      purpose: scene.dramatic_function,
      visible_action: scene.key_action,
      conflict_discovery_or_instruction: scene.conflict ?? scene.plot,
      emotional_or_information_turn: input.children_evidence.scene_turns[String(scene.scene_id)] ?? '',
      evidence_ids: [],
    }));
    rebuiltSections.push('sequence_beats');
  }
  if (pkg.director_text_plan.sequences.length !== pkg.scene_breakdown.length) {
    pkg.director_text_plan.sequences = pkg.scene_breakdown.map(scene => ({
      sequence_id: `children-sequence-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration ?? '温和环境声和清楚动作声。',
      production_constraints: [
        scene.cultural_note,
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
        ...input.children_evidence.sensitive_content_boundaries,
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
      sound_intent: '温和环境声、短句对白和重复母题声音分层。',
      continuity_notes: [scene.location, scene.time_of_day, ...scene.characters].filter(Boolean),
      evidence_boundary_notes: [
        ...(scene.source_entries ?? []),
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter((item): item is string => Boolean(item)),
    }));
    rebuiltSections.push('delivery_text_package');
  }
  const evaluation = evaluateChildrenStoryProfessionalText({
    package: pkg,
    children_evidence: input.children_evidence,
  });
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = pkg.quality_report.hard_gate_failures.length > 0 ? 'revision_required' : 'in_review';
  pkg.updated_at = input.now ?? new Date().toISOString();
  if (rebuiltSections.length > 0) {
    pkg.revision_trace.push({
      revision_id: `children-derived-rebuild-${pkg.revision_trace.length + 1}`,
      created_at: pkg.updated_at,
      source: 'agent',
      reason: '重建与当前儿童分场不一致的派生专业文本。',
      changed_sections: rebuiltSections,
      resolved_issue_ids: [],
      remaining_issues: pkg.quality_report.hard_gate_failures.map(issueId),
    });
  }
  return { package: pkg, rebuilt_sections: rebuiltSections };
}
