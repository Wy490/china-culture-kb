import type {
  ProfessionalTextPackage,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import {
  evaluateSceneShortProfessionalText,
  type SceneShortEvidence,
} from './professional-scene-short-quality-service.js';

export interface SceneShortPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  audience_promise: string;
  research: ResearchAndEvidenceDossier;
  scene_evidence: SceneShortEvidence;
}

export function buildSceneShortProfessionalTextPackage(input: SceneShortPipelineInput): ProfessionalTextPackage {
  if (input.story.video_type !== 'scene_short') throw new Error('scene_short pipeline requires scene_short');
  const story = input.story;
  const evidence = input.scene_evidence;
  const targetDuration = input.target_duration ?? '3分钟';
  const professionalPackage = createProfessionalTextPackageSkeleton({
    video_type: 'scene_short',
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
  professionalPackage.premise_or_core_question = evidence.route_purpose;
  professionalPackage.theme_statement = evidence.spatial_identity;
  professionalPackage.truth_and_adaptation_contract = {
    truth_mode: story.truth_mode ?? 'inspired_by_material',
    verified_facts: claimsByStatus('verified_fact'),
    plausible_dramatizations: claimsByStatus('plausible_dramatization'),
    fictional_additions: claimsByStatus('fictional_addition'),
    unknown_or_forbidden_claims: input.research.unknowns,
    required_disclaimers: ['空间事实、时间叠印和人物路线必须分层；开放状态以现实核验为准。'],
  };
  professionalPackage.relationship_or_information_architecture = {
    mode: 'spatial_route',
    nodes: evidence.route_nodes.map(node => ({ node_id: node.node_id, label: node.space, role: node.discovery_or_change })),
    links: evidence.route_nodes.slice(1).map((node, index) => ({
      from: evidence.route_nodes[index].node_id,
      to: node.node_id,
      relationship: evidence.route_nodes[index].transition_to_next,
    })),
  };
  professionalPackage.structure_outline = {
    structure_name: 'space-entry-trigger-discovery-time-layer-atmosphere',
    opening: evidence.route_nodes[0]?.space ?? '',
    development: evidence.route_nodes.map(node => `${node.space}：${node.discovery_or_change}`),
    climax_or_key_turn: evidence.route_nodes.at(-1)?.discovery_or_change ?? '',
    ending: evidence.ending_atmosphere,
  };
  professionalPackage.sequence_beats = evidence.route_nodes.map(node => ({
    beat_id: node.node_id,
    order: node.order,
    title: node.space,
    purpose: node.trigger,
    visible_action: node.shot_action,
    conflict_discovery_or_instruction: node.discovery_or_change,
    emotional_or_information_turn: node.time_layer,
    evidence_ids: node.evidence_ids,
  }));
  professionalPackage.scene_breakdown = story.scene_breakdown;
  professionalPackage.full_text = story.full_text;
  professionalPackage.dialogue_or_narration_pass = {
    mode: 'minimal_text',
    voice_rules: ['旁白只提示空间身份和时间层', '不用人物生平或景点赞美替代路线发现'],
    polished_text: story.scene_breakdown.map(scene => scene.dialogue_or_narration).filter(Boolean).join('\n'),
    unresolved_issues: [],
  };
  professionalPackage.director_text_plan = {
    visual_strategy: '入口、路径、转角、局部纹理、时间痕迹和终点回望形成完整路线。',
    sound_strategy: '脚步、门轴、纸页、风、水和人群声承担空间转场。',
    rhythm_strategy: '进入空间->触发动作->逐点发现->时间层显影->氛围停驻。',
    sequences: story.scene_breakdown.map((scene, index) => ({
      sequence_id: `scene-short-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: evidence.route_nodes[index]?.shot_action ?? scene.camera_suggestion,
      sound_intent: evidence.route_nodes[index]?.sound_cue ?? '空间现场声',
      production_constraints: evidence.geographic_boundary_notes,
    })),
  };
  professionalPackage.continuity_ledger = {
    items: evidence.route_nodes.map(node => ({
      continuity_id: node.node_id,
      category: 'location' as const,
      rule: `${node.order}.${node.space}｜${node.time_layer}｜${node.sound_cue}`,
      applies_to_scene_ids: story.scene_breakdown[node.order - 1] ? [story.scene_breakdown[node.order - 1].scene_id] : [],
      evidence_ids: node.evidence_ids,
    })),
    unresolved_conflicts: [],
  };
  professionalPackage.delivery_text_package = {
    script_text: story.full_text,
    scene_units: story.scene_breakdown.map((scene, index) => ({
      scene_id: scene.scene_id,
      script_text: scene.dialogue_or_narration ?? scene.plot,
      visual_action: evidence.route_nodes[index]?.shot_action ?? scene.key_action,
      camera_intent: scene.camera_suggestion,
      sound_intent: evidence.route_nodes[index]?.sound_cue ?? '空间现场声',
      continuity_notes: [evidence.route_nodes[index]?.transition_to_next ?? ''],
      evidence_boundary_notes: evidence.geographic_boundary_notes,
    })),
    gears_handoff_notes: ['保留空间节点、路线顺序、镜头行动、声音、时间层和转场。'],
    seedance_handoff_notes: ['不得用异地素材、静态景点拼贴或人物传记替代真实空间路线。'],
    validation_notes: [],
  };
  const evaluation = evaluateSceneShortProfessionalText({ package: professionalPackage, scene_evidence: evidence });
  professionalPackage.quality_report = evaluation.quality_report;
  professionalPackage.coverage_report = evaluation.coverage_report;
  professionalPackage.status = professionalPackage.quality_report.hard_gate_failures.length ? 'revision_required' : 'in_review';
  return professionalPackage;
}
