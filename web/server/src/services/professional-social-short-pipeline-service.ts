import type {
  ProfessionalTextPackage,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import {
  evaluateSocialShortProfessionalText,
  type SocialShortEvidence,
} from './professional-social-short-quality-service.js';

export interface SocialShortPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  audience_promise: string;
  research: ResearchAndEvidenceDossier;
  social_evidence: SocialShortEvidence;
}

export function buildSocialShortProfessionalTextPackage(input: SocialShortPipelineInput): ProfessionalTextPackage {
  if (input.story.video_type !== 'social_short') throw new Error('social_short pipeline requires social_short');
  const story = input.story;
  const evidence = input.social_evidence;
  const targetDuration = input.target_duration ?? '1分钟';
  const professionalPackage = createProfessionalTextPackageSkeleton({
    video_type: 'social_short',
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
    delivery_constraints: evidence.platform_safety_notes,
  };
  professionalPackage.research_and_evidence_dossier = input.research;
  professionalPackage.audience_promise = input.audience_promise;
  professionalPackage.premise_or_core_question = evidence.hook_0_3s;
  professionalPackage.theme_statement = evidence.core_message;
  professionalPackage.truth_and_adaptation_contract = {
    truth_mode: story.truth_mode ?? 'inspired_by_material',
    verified_facts: claimsByStatus('verified_fact'),
    plausible_dramatizations: claimsByStatus('plausible_dramatization'),
    fictional_additions: claimsByStatus('fictional_addition'),
    unknown_or_forbidden_claims: input.research.unknowns,
    required_disclaimers: ['前三秒钩子不得扭曲事实、身份、地域或机构口径。'],
  };
  professionalPackage.relationship_or_information_architecture = {
    mode: 'information_architecture',
    nodes: evidence.beat_plan.map(beat => ({
      node_id: beat.beat_id,
      label: `${beat.start_sec}-${beat.end_sec}秒`,
      role: beat.new_information,
    })),
    links: evidence.beat_plan.slice(1).map((beat, index) => ({
      from: evidence.beat_plan[index].beat_id,
      to: beat.beat_id,
      relationship: beat.contrast_or_turn || '追加新信息',
    })),
  };
  professionalPackage.structure_outline = {
    structure_name: 'social-hook-information-turn-interaction',
    opening: evidence.hook_0_3s,
    development: evidence.beat_plan.slice(1, -1).map(beat => beat.new_information),
    climax_or_key_turn: evidence.central_contrast,
    ending: `${evidence.shareable_line} ${evidence.interaction_question}`,
  };
  professionalPackage.sequence_beats = evidence.beat_plan.map(beat => ({
    beat_id: beat.beat_id,
    order: beat.order,
    title: `${beat.start_sec}-${beat.end_sec}秒`,
    purpose: beat.order === 1 ? '三秒钩子' : beat.order === evidence.beat_plan.length ? '互动收束' : '持续新信息',
    visible_action: beat.vertical_visual,
    conflict_discovery_or_instruction: beat.new_information,
    emotional_or_information_turn: beat.contrast_or_turn,
    evidence_ids: beat.evidence_ids,
  }));
  professionalPackage.scene_breakdown = story.scene_breakdown;
  professionalPackage.full_text = story.full_text;
  professionalPackage.dialogue_or_narration_pass = {
    mode: 'mixed',
    voice_rules: ['短句先结论后解释', '字幕、画面和声音不得逐字重复'],
    polished_text: evidence.beat_plan.map(beat => beat.voiceover_or_dialogue).join('\n'),
    unresolved_issues: [],
  };
  professionalPackage.director_text_plan = {
    visual_strategy: '9:16竖屏构图；每个节拍只保留一个视觉重点。',
    sound_strategy: '人声负责因果，现场声负责质感，字幕负责关键词。',
    rhythm_strategy: '0至3秒钩子后持续追加新信息，以反差转折和互动问题收束。',
    sequences: story.scene_breakdown.map((scene, index) => ({
      sequence_id: `social-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: evidence.beat_plan[index]?.voiceover_or_dialogue ?? scene.dialogue_or_narration ?? '现场声',
      production_constraints: evidence.platform_safety_notes,
    })),
  };
  professionalPackage.continuity_ledger = {
    items: evidence.beat_plan.map((beat, index) => ({
      continuity_id: beat.beat_id,
      category: 'prop' as const,
      rule: `${beat.start_sec}-${beat.end_sec}秒｜${beat.caption}｜${beat.vertical_visual}`,
      applies_to_scene_ids: story.scene_breakdown[index] ? [story.scene_breakdown[index].scene_id] : [],
      evidence_ids: beat.evidence_ids,
    })),
    unresolved_conflicts: [],
  };
  professionalPackage.delivery_text_package = {
    script_text: story.full_text,
    scene_units: story.scene_breakdown.map((scene, index) => ({
      scene_id: scene.scene_id,
      script_text: evidence.beat_plan[index]?.voiceover_or_dialogue ?? scene.dialogue_or_narration ?? scene.plot,
      visual_action: evidence.beat_plan[index]?.vertical_visual ?? scene.key_action,
      camera_intent: scene.camera_suggestion,
      sound_intent: '口播、现场声和节拍音效分层',
      continuity_notes: [evidence.beat_plan[index]?.caption ?? ''],
      evidence_boundary_notes: evidence.platform_safety_notes,
    })),
    gears_handoff_notes: ['保留时间码、字幕占位、竖屏单一视觉重点和声画分工。'],
    seedance_handoff_notes: ['不得用强钩子制造知识库未支持的事实、身份或机构成果。'],
    validation_notes: [],
  };
  const evaluation = evaluateSocialShortProfessionalText({ package: professionalPackage, social_evidence: evidence });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  professionalPackage.status = professionalPackage.quality_report.hard_gate_failures.length ? 'revision_required' : 'in_review';
  return professionalPackage;
}
