import type {
  ProfessionalTextPackage,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import {
  evaluateLectureVideoProfessionalText,
  type LectureVideoEvidence,
} from './professional-lecture-video-quality-service.js';

export interface LectureVideoPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  audience_promise: string;
  research: ResearchAndEvidenceDossier;
  lecture_evidence: LectureVideoEvidence;
}

export function buildLectureVideoProfessionalTextPackage(input: LectureVideoPipelineInput): ProfessionalTextPackage {
  if (input.story.video_type !== 'lecture_video') throw new Error('lecture_video pipeline requires lecture_video');
  const story = input.story;
  const evidence = input.lecture_evidence;
  const targetDuration = input.target_duration ?? '5分钟';
  const professionalPackage = createProfessionalTextPackageSkeleton({
    video_type: 'lecture_video',
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
    delivery_constraints: evidence.value_boundary_notes,
  };
  professionalPackage.research_and_evidence_dossier = input.research;
  professionalPackage.audience_promise = input.audience_promise;
  professionalPackage.premise_or_core_question = evidence.audience_tension;
  professionalPackage.theme_statement = evidence.thesis;
  professionalPackage.truth_and_adaptation_contract = {
    truth_mode: story.truth_mode ?? 'institutional_verified',
    verified_facts: claimsByStatus('verified_fact'),
    plausible_dramatizations: claimsByStatus('plausible_dramatization'),
    fictional_additions: claimsByStatus('fictional_addition'),
    unknown_or_forbidden_claims: input.research.unknowns,
    required_disclaimers: ['事实案例、论证、价值判断和机构行动口径必须分层。'],
  };
  professionalPackage.relationship_or_information_architecture = {
    mode: 'information_architecture',
    nodes: evidence.arguments.map(argument => ({
      node_id: argument.argument_id,
      label: argument.claim,
      role: argument.reasoning,
    })),
    links: evidence.arguments.slice(1).map((argument, index) => ({
      from: evidence.arguments[index].argument_id,
      to: argument.argument_id,
      relationship: evidence.rhetorical_transitions[index] ?? '递进论证',
    })),
  };
  professionalPackage.structure_outline = {
    structure_name: 'thesis-argument-case-counterargument-response-action',
    opening: evidence.thesis,
    development: evidence.arguments.map(argument => `${argument.claim}：${argument.reasoning}`),
    climax_or_key_turn: evidence.counterarguments.map(item => `${item.position} -> ${item.response}`).join('；'),
    ending: evidence.action_conclusion.audience_action,
  };
  professionalPackage.sequence_beats = evidence.arguments.map(argument => ({
    beat_id: `lecture-${argument.order}`,
    order: argument.order,
    title: argument.claim,
    purpose: argument.reasoning,
    visible_action: evidence.cases.find(item => argument.case_ids.includes(item.case_id))?.factual_summary ?? '',
    conflict_discovery_or_instruction: argument.reasoning,
    emotional_or_information_turn: evidence.rhetorical_transitions[argument.order - 1] ?? '',
    evidence_ids: argument.evidence_ids,
  }));
  professionalPackage.scene_breakdown = story.scene_breakdown;
  professionalPackage.full_text = story.full_text;
  professionalPackage.dialogue_or_narration_pass = {
    mode: 'narration',
    voice_rules: ['先立论再举证，不用口号替代推理', '准确复述合理反方，再以证据回应'],
    polished_text: story.scene_breakdown.map(scene => scene.dialogue_or_narration).filter(Boolean).join('\n'),
    unresolved_issues: [],
  };
  professionalPackage.director_text_plan = {
    visual_strategy: '讲述者、事实案例、来源标签、反方卡片和行动清单交替。',
    sound_strategy: '讲述语气坚定但不过度煽情，案例段保留必要现场声。',
    rhythm_strategy: '现实问题->立论->三段论证->反方回应->可执行结论。',
    sequences: story.scene_breakdown.map(scene => ({
      sequence_id: `lecture-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration ?? '宣讲原声',
      production_constraints: evidence.value_boundary_notes,
    })),
  };
  professionalPackage.continuity_ledger = {
    items: evidence.arguments.map(argument => ({
      continuity_id: argument.argument_id,
      category: 'fact' as const,
      rule: `${argument.claim}｜${argument.reasoning}`,
      applies_to_scene_ids: story.scene_breakdown.map(scene => scene.scene_id),
      evidence_ids: argument.evidence_ids,
    })),
    unresolved_conflicts: [],
  };
  professionalPackage.delivery_text_package = {
    script_text: story.full_text,
    scene_units: story.scene_breakdown.map(scene => ({
      scene_id: scene.scene_id,
      script_text: scene.dialogue_or_narration ?? scene.plot,
      visual_action: scene.key_action,
      camera_intent: scene.camera_suggestion,
      sound_intent: '宣讲原声、案例现场声和关键词停顿',
      continuity_notes: evidence.rhetorical_transitions,
      evidence_boundary_notes: evidence.value_boundary_notes,
    })),
    gears_handoff_notes: ['保留论点、证据、案例、反方、回应和机构口径状态。'],
    seedance_handoff_notes: ['不得用煽情再现替代事实案例或伪造群众反应。'],
    validation_notes: [],
  };
  const evaluation = evaluateLectureVideoProfessionalText({ package: professionalPackage, lecture_evidence: evidence });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  professionalPackage.status = professionalPackage.quality_report.hard_gate_failures.length ? 'revision_required' : 'in_review';
  return professionalPackage;
}
