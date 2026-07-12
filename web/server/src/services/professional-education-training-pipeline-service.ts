import type {
  ProfessionalTextPackage,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import {
  evaluateEducationTrainingProfessionalText,
  type EducationTrainingEvidence,
} from './professional-education-training-quality-service.js';

export interface EducationTrainingPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  audience_promise: string;
  research: ResearchAndEvidenceDossier;
  training_evidence: EducationTrainingEvidence;
}

export function buildEducationTrainingProfessionalTextPackage(input: EducationTrainingPipelineInput): ProfessionalTextPackage {
  if (input.story.video_type !== 'education_training') throw new Error('education_training pipeline requires education_training');
  const story = input.story;
  const evidence = input.training_evidence;
  const targetDuration = input.target_duration ?? '8分钟';
  const professionalPackage = createProfessionalTextPackageSkeleton({
    video_type: 'education_training',
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
    delivery_constraints: evidence.institutional_accuracy_notes,
  };
  professionalPackage.research_and_evidence_dossier = input.research;
  professionalPackage.audience_promise = input.audience_promise;
  professionalPackage.premise_or_core_question = `学习者完成后能够：${evidence.learning_objectives.map(item => item.observable_action).join('；')}`;
  professionalPackage.theme_statement = story.theme;
  professionalPackage.truth_and_adaptation_contract = {
    truth_mode: story.truth_mode ?? 'institutional_verified',
    verified_facts: claimsByStatus('verified_fact'),
    plausible_dramatizations: claimsByStatus('plausible_dramatization'),
    fictional_additions: claimsByStatus('fictional_addition'),
    unknown_or_forbidden_claims: input.research.unknowns,
    required_disclaimers: ['知识步骤、制度口径、安全要求和授权边界必须使用确认材料。'],
  };
  professionalPackage.relationship_or_information_architecture = {
    mode: 'information_architecture',
    nodes: evidence.knowledge_steps.map(step => ({ node_id: step.step_id, label: step.title, role: step.instruction })),
    links: evidence.knowledge_steps.slice(1).map((step, index) => ({
      from: evidence.knowledge_steps[index].step_id,
      to: step.step_id,
      relationship: '完成前一步后进入下一学习动作',
    })),
  };
  professionalPackage.structure_outline = {
    structure_name: 'objective-instruction-demonstration-practice-assessment-recap',
    opening: evidence.learning_objectives.map(item => `${item.observable_action}（${item.success_criteria}）`).join('；'),
    development: evidence.knowledge_steps.map(step => `${step.title}：${step.instruction}`),
    climax_or_key_turn: evidence.practice_tasks.map(task => task.instruction).join('；'),
    ending: evidence.recap_checklist.join('；'),
  };
  professionalPackage.sequence_beats = evidence.knowledge_steps.map(step => ({
    beat_id: `training-${step.order}`,
    order: step.order,
    title: step.title,
    purpose: step.instruction,
    visible_action: step.demonstration_action,
    conflict_discovery_or_instruction: evidence.practice_tasks.find(task => task.objective_ids.some(id => step.objective_ids.includes(id)))?.instruction ?? step.instruction,
    emotional_or_information_turn: evidence.assessments.find(assessment => assessment.objective_ids.some(id => step.objective_ids.includes(id)))?.pass_condition ?? '',
    evidence_ids: step.evidence_ids,
  }));
  professionalPackage.scene_breakdown = story.scene_breakdown;
  professionalPackage.full_text = story.full_text;
  professionalPackage.dialogue_or_narration_pass = {
    mode: 'narration',
    voice_rules: ['每段对应一个学习动作', '先示范再练习，评估前明确成功标准'],
    polished_text: story.scene_breakdown.map(scene => scene.dialogue_or_narration).filter(Boolean).join('\n'),
    unresolved_issues: [],
  };
  professionalPackage.director_text_plan = {
    visual_strategy: '标题卡、步骤编号、手部示范、练习暂停卡、评分表和复盘清单交替。',
    sound_strategy: '教学讲述清楚直接，关键步骤留停顿供学习者操作。',
    rhythm_strategy: '目标->知识步骤->完整示范->练习->评估反馈->复盘。',
    sequences: story.scene_breakdown.map(scene => ({
      sequence_id: `training-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration ?? '教学讲述',
      production_constraints: evidence.institutional_accuracy_notes,
    })),
  };
  professionalPackage.continuity_ledger = {
    items: evidence.learning_objectives.map(objective => ({
      continuity_id: objective.objective_id,
      category: 'terminology' as const,
      rule: `${objective.observable_action}｜${objective.success_criteria}`,
      applies_to_scene_ids: story.scene_breakdown.map(scene => scene.scene_id),
      evidence_ids: objective.evidence_ids,
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
      sound_intent: '教学讲述、示范现场声和练习停顿',
      continuity_notes: evidence.recap_checklist,
      evidence_boundary_notes: evidence.institutional_accuracy_notes,
    })),
    gears_handoff_notes: ['保留目标ID、步骤、示范、练习、评估、反馈和安全边界。'],
    seedance_handoff_notes: ['不得省略危险操作警示、岗位边界或制度确认状态。'],
    validation_notes: [],
  };
  const evaluation = evaluateEducationTrainingProfessionalText({ package: professionalPackage, training_evidence: evidence });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  professionalPackage.status = professionalPackage.quality_report.hard_gate_failures.length ? 'revision_required' : 'in_review';
  return professionalPackage;
}
