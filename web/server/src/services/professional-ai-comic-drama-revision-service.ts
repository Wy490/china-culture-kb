import type { ProfessionalTextPackage, ProfessionalTextPackageField } from '@shared/types.js';
import { aiComicDramaHardGateRepair, evaluateAiComicDramaProfessionalText, type AiComicDramaProfessionalEvidence } from './professional-ai-comic-drama-quality-service.js';

export interface AiComicDramaRevisionAction {
  action_id: string; issue_id: string; instruction: string; target_sections: ProfessionalTextPackageField[];
  repair_mode: 'deterministic_derived_rebuild' | 'model_rewrite_required' | 'human_evidence_required';
  rebuild_derived_sections: ProfessionalTextPackageField[];
}
export interface AiComicDramaRevisionPlan {
  schema_version: 'professional-text-revision-plan/v1'; package_id: string; video_type: 'ai_comic_drama';
  action_count: number; deterministic_action_count: number; model_rewrite_action_count: number;
  human_evidence_action_count: number; actions: AiComicDramaRevisionAction[]; professional_passed: false;
}
function issueId(failure: string): string { return failure.split(':', 1)[0]?.trim() || 'unknown_issue'; }

export function buildAiComicDramaRevisionPlan(pkg: ProfessionalTextPackage): AiComicDramaRevisionPlan {
  if (pkg.video_type !== 'ai_comic_drama') throw new Error('ai_comic_drama revision plan requires an ai_comic_drama package');
  const humanIssues = new Set(['brief_missing', 'asset_continuity_missing', 'truth_boundary_missing']);
  const targetMap: Record<string, ProfessionalTextPackageField[]> = {
    brief_missing: ['creative_brief', 'audience_promise'], full_text_not_final: ['full_text'], episode_hook_missing: ['structure_outline', 'scene_breakdown'], relationship_collision_missing: ['structure_outline', 'full_text'], panelability_missing: ['scene_breakdown', 'director_text_plan', 'delivery_text_package'], visible_action_missing: ['scene_breakdown', 'director_text_plan'], bubble_dialogue_missing: ['dialogue_or_narration_pass', 'full_text'], expression_reaction_missing: ['scene_breakdown', 'director_text_plan'], reversal_or_choice_missing: ['structure_outline', 'scene_breakdown', 'full_text'], ending_hook_missing: ['structure_outline', 'scene_breakdown', 'full_text'], asset_continuity_missing: ['continuity_ledger', 'director_text_plan', 'delivery_text_package'], scene_action_or_turn_missing: ['sequence_beats', 'scene_breakdown'], truth_boundary_missing: ['truth_and_adaptation_contract', 'continuity_ledger'],
  };
  const actions = pkg.quality_report.hard_gate_failures.map((failure, index) => {
    const issue = issueId(failure);
    return { action_id: `comic-revision-action-${index + 1}`, issue_id: issue, instruction: aiComicDramaHardGateRepair(issue) ?? '按 Coverage 定点修订漫剧文本。', target_sections: targetMap[issue] ?? ['coverage_report'], repair_mode: humanIssues.has(issue) ? 'human_evidence_required' as const : 'model_rewrite_required' as const, rebuild_derived_sections: ['director_text_plan', 'delivery_text_package'] as ProfessionalTextPackageField[] };
  });
  return { schema_version: 'professional-text-revision-plan/v1', package_id: pkg.package_id, video_type: 'ai_comic_drama', action_count: actions.length, deterministic_action_count: 0, model_rewrite_action_count: actions.filter(action => action.repair_mode === 'model_rewrite_required').length, human_evidence_action_count: actions.filter(action => action.repair_mode === 'human_evidence_required').length, actions, professional_passed: false };
}

export function rebuildAiComicDramaDerivedText(input: { package: ProfessionalTextPackage; comic_evidence: AiComicDramaProfessionalEvidence; now?: string }): { package: ProfessionalTextPackage; rebuilt_sections: ProfessionalTextPackageField[] } {
  const pkg = structuredClone(input.package);
  if (pkg.video_type !== 'ai_comic_drama') throw new Error('ai_comic_drama derived rebuild requires an ai_comic_drama package');
  const rebuilt: ProfessionalTextPackageField[] = [];
  if (pkg.sequence_beats.length !== pkg.scene_breakdown.length) { pkg.sequence_beats = pkg.scene_breakdown.map((scene, index) => ({ beat_id: `comic-rebuild-${index + 1}`, order: index + 1, title: scene.title, purpose: scene.dramatic_function, visible_action: scene.key_action, conflict_discovery_or_instruction: scene.conflict ?? scene.plot, emotional_or_information_turn: input.comic_evidence.scene_turns[String(scene.scene_id)] ?? '', evidence_ids: [] })); rebuilt.push('sequence_beats'); }
  if (pkg.delivery_text_package.scene_units.length !== pkg.scene_breakdown.length) { pkg.delivery_text_package.scene_units = pkg.scene_breakdown.map(scene => ({ scene_id: scene.scene_id, script_text: input.comic_evidence.panel_beats.filter(panel => panel.scene_id === Number(scene.scene_id)).map(panel => `${panel.visible_action}${panel.dialogue_bubble ? `｜${panel.dialogue_bubble}` : ''}`).join('\n'), visual_action: scene.key_action, camera_intent: scene.camera_suggestion, sound_intent: '短气泡与动作音。', continuity_notes: input.comic_evidence.panel_beats.filter(panel => panel.scene_id === Number(scene.scene_id)).flatMap(panel => panel.asset_ids), evidence_boundary_notes: [scene.factual_basis ?? '', ...(scene.fictionalized_elements ?? [])].filter(Boolean) })); rebuilt.push('delivery_text_package'); }
  const evaluation = evaluateAiComicDramaProfessionalText({ package: pkg, comic_evidence: input.comic_evidence });
  pkg.quality_report = evaluation.quality_report; pkg.coverage_report = evaluation.coverage_report; pkg.status = pkg.quality_report.hard_gate_failures.length ? 'revision_required' : 'in_review'; pkg.updated_at = input.now ?? new Date().toISOString();
  if (rebuilt.length) pkg.revision_trace.push({ revision_id: `comic-derived-rebuild-${pkg.revision_trace.length + 1}`, created_at: pkg.updated_at, source: 'agent', reason: '重建与当前漫剧分场不一致的派生文本。', changed_sections: rebuilt, resolved_issue_ids: [], remaining_issues: pkg.quality_report.hard_gate_failures.map(issueId) });
  return { package: pkg, rebuilt_sections: rebuilt };
}
