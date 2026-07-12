import type {
  ProfessionalTextPackage,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import {
  evaluateExplainerVideoProfessionalText,
  type ExplainerVideoEvidence,
} from './professional-explainer-video-quality-service.js';

export interface ExplainerVideoPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  audience_promise: string;
  research: ResearchAndEvidenceDossier;
  explainer_evidence: ExplainerVideoEvidence;
}

export function buildExplainerVideoProfessionalTextPackage(input: ExplainerVideoPipelineInput): ProfessionalTextPackage {
  if (input.story.video_type !== 'explainer_video') throw new Error('explainer_video pipeline requires explainer_video');
  const story = input.story;
  const evidence = input.explainer_evidence;
  const targetDuration = input.target_duration ?? '3分钟';
  const professionalPackage = createProfessionalTextPackageSkeleton({
    video_type: 'explainer_video',
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
    delivery_constraints: evidence.visual_explanations.map(visual => visual.limitation_or_non_equivalence),
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
    required_disclaimers: ['事实、解释、视觉比喻和观点必须分层；比喻不得冒充真实机制。'],
  };
  professionalPackage.relationship_or_information_architecture = {
    mode: 'information_architecture',
    nodes: evidence.concept_units.map(unit => ({ node_id: unit.concept_id, label: unit.concept, role: unit.definition })),
    links: evidence.concept_units.slice(1).map((unit, index) => ({
      from: evidence.concept_units[index].concept_id,
      to: unit.concept_id,
      relationship: '前一概念为下一概念提供理解基础',
    })),
  };
  professionalPackage.structure_outline = {
    structure_name: 'question-concept-example-visual-misconception-summary',
    opening: evidence.core_question,
    development: evidence.concept_units.map(unit => `${unit.concept}：${unit.definition}`),
    climax_or_key_turn: evidence.misconceptions.map(item => `${item.misconception} -> ${item.correction}`).join('；'),
    ending: `${evidence.summary_points.join('；')} ${evidence.transfer_check_question}`,
  };
  professionalPackage.sequence_beats = evidence.concept_units.map(unit => ({
    beat_id: `explainer-${unit.order}`,
    order: unit.order,
    title: unit.concept,
    purpose: unit.definition,
    visible_action: evidence.visual_explanations.find(visual => visual.mapped_concept_id === unit.concept_id)?.visual_mechanism ?? '',
    conflict_discovery_or_instruction: evidence.examples.find(example => example.mapped_concept_id === unit.concept_id)?.what_it_proves ?? unit.definition,
    emotional_or_information_turn: evidence.visual_explanations.find(visual => visual.mapped_concept_id === unit.concept_id)?.causal_mapping ?? '',
    evidence_ids: unit.evidence_ids,
  }));
  professionalPackage.scene_breakdown = story.scene_breakdown;
  professionalPackage.full_text = story.full_text;
  professionalPackage.dialogue_or_narration_pass = {
    mode: 'narration',
    voice_rules: ['每段只解释一个核心概念', '先给结论，再用例子和画面解释原因'],
    polished_text: story.scene_breakdown.map(scene => scene.dialogue_or_narration).filter(Boolean).join('\n'),
    unresolved_issues: [],
  };
  professionalPackage.director_text_plan = {
    visual_strategy: '每个图示都映射一个概念和因果关系，并同步显示比喻边界。',
    sound_strategy: '讲述负责概念，画面负责机制，关键词字幕负责复述。',
    rhythm_strategy: '提出问题->概念拆分->例子验证->误区纠正->可迁移总结。',
    sequences: story.scene_breakdown.map((scene, index) => ({
      sequence_id: `explainer-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration ?? '解释旁白',
      production_constraints: evidence.visual_explanations[index]
        ? [evidence.visual_explanations[index].limitation_or_non_equivalence]
        : [],
    })),
  };
  professionalPackage.continuity_ledger = {
    items: evidence.concept_units.map(unit => ({
      continuity_id: unit.concept_id,
      category: 'terminology' as const,
      rule: `${unit.concept}｜${unit.definition}`,
      applies_to_scene_ids: story.scene_breakdown.map(scene => scene.scene_id),
      evidence_ids: unit.evidence_ids,
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
      sound_intent: '概念讲述与图示动作同步',
      continuity_notes: evidence.summary_points,
      evidence_boundary_notes: evidence.visual_explanations.map(visual => visual.limitation_or_non_equivalence),
    })),
    gears_handoff_notes: ['保留概念、例子、视觉映射、误区纠正和比喻边界。'],
    seedance_handoff_notes: ['视觉比喻必须显示为解释性图示，不得伪装成历史事实或真实机制。'],
    validation_notes: [],
  };
  const evaluation = evaluateExplainerVideoProfessionalText({ package: professionalPackage, explainer_evidence: evidence });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  professionalPackage.status = professionalPackage.quality_report.hard_gate_failures.length ? 'revision_required' : 'in_review';
  return professionalPackage;
}
