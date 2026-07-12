import type {
  ProfessionalTextPackage,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import {
  evaluateLandscapeMoodProfessionalText,
  type LandscapeMoodEvidence,
} from './professional-landscape-mood-quality-service.js';

export interface LandscapeMoodPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  audience_promise: string;
  research: ResearchAndEvidenceDossier;
  landscape_evidence: LandscapeMoodEvidence;
}

export function buildLandscapeMoodProfessionalTextPackage(input: LandscapeMoodPipelineInput): ProfessionalTextPackage {
  if (input.story.video_type !== 'landscape_mood') throw new Error('landscape_mood pipeline requires landscape_mood');
  const story = input.story;
  const evidence = input.landscape_evidence;
  const targetDuration = input.target_duration ?? '3分钟';
  const professionalPackage = createProfessionalTextPackageSkeleton({
    video_type: 'landscape_mood',
    package_id: `${story.storyId}--professional-text`,
    story_id: story.storyId,
    target_duration: targetDuration,
    target_audience: input.target_audience,
    platform: input.platform,
    communication_goal: input.communication_goal,
    truth_mode: story.truth_mode,
  });
  const claimsByStatus = (status: string) => input.research.evidence_items.filter(item => item.status === status).map(item => item.claim);
  professionalPackage.creative_brief = {
    target_audience: input.target_audience,
    platform: input.platform,
    target_duration: targetDuration,
    communication_goal: input.communication_goal,
    production_goal: input.production_goal,
    budget_assumptions: [],
    delivery_constraints: evidence.geographic_boundary_notes,
  };
  professionalPackage.research_and_evidence_dossier = input.research;
  professionalPackage.audience_promise = input.audience_promise;
  professionalPackage.premise_or_core_question = evidence.emotional_premise;
  professionalPackage.theme_statement = evidence.emotional_premise;
  professionalPackage.truth_and_adaptation_contract = {
    truth_mode: story.truth_mode ?? 'inspired_by_material',
    verified_facts: claimsByStatus('verified_fact'),
    plausible_dramatizations: claimsByStatus('plausible_dramatization'),
    fictional_additions: claimsByStatus('fictional_addition'),
    unknown_or_forbidden_claims: input.research.unknowns,
    required_disclaimers: ['真实地理与计划天气、光线、时间组织必须分层；不得用异地素材替代。'],
  };
  professionalPackage.relationship_or_information_architecture = {
    mode: 'visual_mood',
    nodes: evidence.visual_phases.map(phase => ({ node_id: phase.phase_id, label: phase.time_state, role: phase.light_or_weather })),
    links: evidence.visual_phases.slice(1).map((phase, index) => ({
      from: evidence.visual_phases[index].phase_id,
      to: phase.phase_id,
      relationship: evidence.visual_phases[index].transition_to_next,
    })),
  };
  professionalPackage.structure_outline = {
    structure_name: 'time-light-weather-sound-silence',
    opening: evidence.visual_phases[0]?.composition ?? '',
    development: evidence.visual_phases.map(phase => `${phase.time_state}：${phase.natural_motion}`),
    climax_or_key_turn: evidence.visual_phases.at(-1)?.light_or_weather ?? '',
    ending: `${evidence.ending_silence_sec}秒自然声或静默留白`,
  };
  professionalPackage.sequence_beats = evidence.visual_phases.map(phase => ({
    beat_id: phase.phase_id,
    order: phase.order,
    title: `${phase.time_state}｜${phase.space_anchor}`,
    purpose: phase.composition,
    visible_action: phase.natural_motion,
    conflict_discovery_or_instruction: phase.light_or_weather,
    emotional_or_information_turn: phase.natural_sound,
    evidence_ids: phase.evidence_ids,
  }));
  professionalPackage.scene_breakdown = story.scene_breakdown;
  professionalPackage.full_text = story.full_text;
  professionalPackage.dialogue_or_narration_pass = {
    mode: 'minimal_text',
    voice_rules: ['文案最多两句且不解释画面', '先让时间、构图和自然声建立情绪'],
    polished_text: evidence.minimal_text_lines.join('\n'),
    unresolved_issues: [],
  };
  professionalPackage.director_text_plan = {
    visual_strategy: '自然元素、空间锚点、光线天气和长停留构图形成情绪流变。',
    sound_strategy: '自然声主导，音乐退后，结尾保留自然声或静默。',
    rhythm_strategy: '晨雾苏醒->日光显形->暮色收拢->静默停驻。',
    sequences: story.scene_breakdown.map((scene, index) => ({
      sequence_id: `landscape-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: evidence.visual_phases[index]?.natural_motion ?? scene.key_action,
      camera_and_transition_intent: evidence.visual_phases[index]?.composition ?? scene.camera_suggestion,
      sound_intent: evidence.visual_phases[index]?.natural_sound ?? '自然现场声',
      production_constraints: evidence.geographic_boundary_notes,
    })),
  };
  professionalPackage.continuity_ledger = {
    items: evidence.visual_phases.map(phase => ({
      continuity_id: phase.phase_id,
      category: 'time' as const,
      rule: `${phase.time_state}｜${phase.light_or_weather}｜${phase.natural_sound}`,
      applies_to_scene_ids: story.scene_breakdown[phase.order - 1] ? [story.scene_breakdown[phase.order - 1].scene_id] : [],
      evidence_ids: phase.evidence_ids,
    })),
    unresolved_conflicts: [],
  };
  professionalPackage.delivery_text_package = {
    script_text: story.full_text,
    scene_units: story.scene_breakdown.map((scene, index) => ({
      scene_id: scene.scene_id,
      script_text: evidence.visual_phases[index]?.narration ?? '',
      visual_action: evidence.visual_phases[index]?.natural_motion ?? scene.key_action,
      camera_intent: evidence.visual_phases[index]?.composition ?? scene.camera_suggestion,
      sound_intent: evidence.visual_phases[index]?.natural_sound ?? '自然现场声',
      continuity_notes: [evidence.visual_phases[index]?.transition_to_next ?? ''],
      evidence_boundary_notes: evidence.geographic_boundary_notes,
    })),
    gears_handoff_notes: ['保留时间状态、构图、自然运动、光线天气、自然声和留白时长。'],
    seedance_handoff_notes: ['不得用密集旁白、宣传口号、纯配乐或异地素材替代自然视听结构。'],
    validation_notes: [],
  };
  const evaluation = evaluateLandscapeMoodProfessionalText({ package: professionalPackage, landscape_evidence: evidence });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  professionalPackage.status = professionalPackage.quality_report.hard_gate_failures.length ? 'revision_required' : 'in_review';
  return professionalPackage;
}
