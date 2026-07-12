import type {
  ProfessionalTextPackage,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import {
  evaluateDocumentaryShortProfessionalText,
  type DocumentaryShortEvidence,
} from './professional-documentary-short-quality-service.js';

export interface DocumentaryShortPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  audience_promise: string;
  research: ResearchAndEvidenceDossier;
  documentary_evidence: DocumentaryShortEvidence;
}

export function buildDocumentaryShortProfessionalTextPackage(input: DocumentaryShortPipelineInput): ProfessionalTextPackage {
  if (input.story.video_type !== 'documentary_short') throw new Error('documentary_short pipeline requires documentary_short');
  const story = input.story;
  const evidence = input.documentary_evidence;
  const targetDuration = input.target_duration ?? '3分钟';
  const professionalPackage = createProfessionalTextPackageSkeleton({
    video_type: 'documentary_short',
    package_id: `${story.storyId}--professional-text`,
    story_id: story.storyId,
    target_duration: targetDuration,
    target_audience: input.target_audience,
    platform: input.platform,
    communication_goal: input.communication_goal,
    truth_mode: story.truth_mode,
  });
  const claimsByStatus = (status: string) => input.research.evidence_items
    .filter(item => item.status === status)
    .map(item => item.claim);
  professionalPackage.creative_brief = {
    target_audience: input.target_audience,
    platform: input.platform,
    target_duration: targetDuration,
    communication_goal: input.communication_goal,
    production_goal: input.production_goal,
    budget_assumptions: [],
    delivery_constraints: evidence.reenactment_boundaries,
  };
  professionalPackage.research_and_evidence_dossier = input.research;
  professionalPackage.audience_promise = input.audience_promise;
  professionalPackage.premise_or_core_question = evidence.core_question;
  professionalPackage.theme_statement = story.theme;
  professionalPackage.truth_and_adaptation_contract = {
    truth_mode: story.truth_mode ?? 'factual_reconstruction',
    verified_facts: claimsByStatus('verified_fact'),
    plausible_dramatizations: claimsByStatus('plausible_dramatization'),
    fictional_additions: claimsByStatus('fictional_addition'),
    unknown_or_forbidden_claims: input.research.unknowns,
    required_disclaimers: ['采访、现实现场和史料来源必须可核验；历史再现不得冒充原始影像。'],
  };
  professionalPackage.relationship_or_information_architecture = {
    mode: 'information_architecture',
    nodes: evidence.discovery_chain.map(step => ({
      node_id: `discovery-${step.order}`,
      label: `发现${step.order}`,
      role: step.question_or_discovery,
    })),
    links: evidence.discovery_chain.slice(1).map((step, index) => ({
      from: `discovery-${evidence.discovery_chain[index].order}`,
      to: `discovery-${step.order}`,
      relationship: evidence.discovery_chain[index].leads_to,
    })),
  };
  professionalPackage.structure_outline = {
    structure_name: 'present-site-evidence-discovery-return',
    opening: evidence.core_question,
    development: evidence.discovery_chain.map(step => step.question_or_discovery),
    climax_or_key_turn: evidence.discovery_chain.at(-1)?.leads_to ?? '',
    ending: `回到今天的${evidence.real_sites[0]?.place ?? '现实现场'}`,
  };
  professionalPackage.sequence_beats = evidence.discovery_chain.map(step => ({
    beat_id: `documentary-${step.order}`,
    order: step.order,
    title: `证据发现${step.order}`,
    purpose: step.question_or_discovery,
    visible_action: evidence.b_roll_plan[step.order - 1]?.visible_action ?? evidence.real_sites[0]?.shootable_action ?? '',
    conflict_discovery_or_instruction: step.question_or_discovery,
    emotional_or_information_turn: step.leads_to,
    evidence_ids: step.evidence_ids,
  }));
  professionalPackage.scene_breakdown = story.scene_breakdown;
  professionalPackage.full_text = story.full_text;
  professionalPackage.dialogue_or_narration_pass = {
    mode: 'mixed',
    voice_rules: evidence.restrained_narration_rules,
    polished_text: story.scene_breakdown.map(scene => scene.dialogue_or_narration).filter(Boolean).join('\n'),
    unresolved_issues: [],
  };
  professionalPackage.director_text_plan = {
    visual_strategy: '现实地点、实物、史料查阅和受访动作交替；再现画面显式标识。',
    sound_strategy: '优先环境声与已授权采访原声，旁白只连接证据。',
    rhythm_strategy: '现实提问->现场痕迹->史料线索->采访核验->回到当下。',
    sequences: story.scene_breakdown.map((scene, index) => ({
      sequence_id: `documentary-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration ?? '现实环境声',
      production_constraints: index === 0 ? evidence.reenactment_boundaries : evidence.restrained_narration_rules,
    })),
  };
  professionalPackage.continuity_ledger = {
    items: evidence.source_clues.map(clue => ({
      continuity_id: clue.clue_id,
      category: 'fact' as const,
      rule: `${clue.source_label}｜${clue.claim}｜${clue.visual_handling}`,
      applies_to_scene_ids: story.scene_breakdown.map(scene => scene.scene_id),
      evidence_ids: clue.evidence_ids,
    })),
    unresolved_conflicts: [],
  };
  professionalPackage.delivery_text_package = {
    script_text: story.full_text,
    scene_units: story.scene_breakdown.map((scene, index) => ({
      scene_id: scene.scene_id,
      script_text: scene.dialogue_or_narration ?? scene.plot,
      visual_action: scene.key_action,
      camera_intent: scene.camera_suggestion,
      sound_intent: index === 0 ? '现实环境声' : '已授权采访原声或克制旁白',
      continuity_notes: evidence.source_clues.map(clue => clue.source_label),
      evidence_boundary_notes: evidence.reenactment_boundaries,
    })),
    gears_handoff_notes: ['保留现实地点、史料来源、采访授权和再现标签。'],
    seedance_handoff_notes: ['生成式再现必须标识，不得伪装为原始影像、真实采访或现实现场。'],
    validation_notes: [],
  };
  const evaluation = evaluateDocumentaryShortProfessionalText({ package: professionalPackage, documentary_evidence: evidence });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  professionalPackage.status = professionalPackage.quality_report.hard_gate_failures.length ? 'revision_required' : 'in_review';
  return professionalPackage;
}
