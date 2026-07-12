import type {
  ProfessionalEvidenceItem,
  ProfessionalTextPackage,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  SupportedDuration,
  TruthMode,
} from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import {
  evaluateLegendStoryProfessionalText,
  type LegendStoryProfessionalEvidence,
} from './professional-legend-story-quality-service.js';

export interface LegendStoryProfessionalPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  budget_assumptions?: string[];
  delivery_constraints?: string[];
  audience_promise: string;
  truth_mode?: TruthMode;
  research: ResearchAndEvidenceDossier;
  legend_evidence: LegendStoryProfessionalEvidence;
  now?: string;
}

function claimsByStatus(
  research: ResearchAndEvidenceDossier,
  status: ProfessionalEvidenceItem['status'],
): string[] {
  return research.evidence_items.filter(item => item.status === status).map(item => item.claim);
}

function evidenceIdsForScene(
  sceneSourceEntries: string[] | undefined,
  evidenceItems: ProfessionalEvidenceItem[],
): string[] {
  if (!sceneSourceEntries?.length) return [];
  return evidenceItems.filter(item => sceneSourceEntries.some(source =>
    item.source.includes(source) || source.includes(item.source)
  )).map(item => item.evidence_id);
}

function dialogueText(story: StoryGenerateResult): string {
  if (story.dialogue?.length) {
    return story.dialogue.flatMap(scene => scene.lines.map(line =>
      `${line.character}（${line.emotion}）：${line.text}`
    )).join('\n');
  }
  return story.scene_breakdown
    .map(scene => scene.dialogue_or_narration?.trim())
    .filter((item): item is string => Boolean(item))
    .join('\n');
}

export function buildLegendStoryProfessionalTextPackage(
  input: LegendStoryProfessionalPipelineInput,
): ProfessionalTextPackage {
  if (input.story.video_type !== 'legend_story') {
    throw new Error('legend_story professional pipeline requires a legend_story source');
  }
  const story = input.story;
  const legend = input.legend_evidence;
  const now = input.now ?? new Date().toISOString();
  const targetDuration = input.target_duration ?? story.story_blueprint?.target_duration ?? '5分钟';
  const pkg = createProfessionalTextPackageSkeleton({
    video_type: 'legend_story',
    package_id: `${story.storyId}--professional-text`,
    story_id: story.storyId,
    project_id: story.project_id,
    target_duration: targetDuration,
    target_audience: input.target_audience,
    platform: input.platform,
    communication_goal: input.communication_goal,
    truth_mode: input.truth_mode ?? story.truth_mode,
    now,
  });
  const characterNames = new Set([
    legend.protagonist,
    ...(story.characters ?? []).map(character => character.name),
    ...story.scene_breakdown.flatMap(scene => scene.characters),
  ].filter(Boolean));
  const motifSceneIds = new Set(legend.motif_scene_ids);

  pkg.status = 'draft';
  pkg.creative_brief = {
    target_audience: input.target_audience,
    platform: input.platform,
    target_duration: targetDuration,
    communication_goal: input.communication_goal,
    production_goal: input.production_goal,
    budget_assumptions: input.budget_assumptions ?? [],
    delivery_constraints: input.delivery_constraints ?? [],
  };
  pkg.research_and_evidence_dossier = input.research;
  pkg.audience_promise = input.audience_promise;
  pkg.premise_or_core_question = story.logline;
  pkg.theme_statement = story.theme;
  pkg.truth_and_adaptation_contract = {
    truth_mode: input.truth_mode ?? story.truth_mode ?? 'inspired_by_material',
    verified_facts: claimsByStatus(input.research, 'verified_fact'),
    plausible_dramatizations: claimsByStatus(input.research, 'plausible_dramatization'),
    fictional_additions: claimsByStatus(input.research, 'fictional_addition'),
    unknown_or_forbidden_claims: [
      ...claimsByStatus(input.research, 'unknown'),
      ...input.research.unknowns,
      ...legend.version_boundaries.map(version => `${version.label}：${version.boundary_note}`),
    ],
    required_disclaimers: story.creation_contract?.required_disclaimers ?? [
      '本片依据文学、民间口述或地方改编版本创作，神异情节不作为确证史实。',
    ],
  };
  pkg.relationship_or_information_architecture = {
    mode: 'character_relationships',
    nodes: [...characterNames].map(name => ({
      node_id: `legend-character-${name}`,
      label: name,
      role: name === legend.protagonist ? 'human_protagonist' : 'legend_participant',
    })),
    links: [...characterNames]
      .filter(name => name !== legend.protagonist)
      .map(name => ({
        from: `legend-character-${legend.protagonist}`,
        to: `legend-character-${name}`,
        relationship: `通过“${legend.human_trial}”检验信任、承诺或选择。`,
      })),
  };
  pkg.structure_outline = {
    structure_name: story.story_structure ?? 'folk_legend_trial',
    opening: story.scene_breakdown[0]?.plot ?? '',
    development: story.scene_breakdown.slice(1, -2).map(scene => scene.plot),
    climax_or_key_turn: story.scene_breakdown.at(-2)?.plot ?? story.scene_breakdown.at(-1)?.plot ?? '',
    ending: `${story.scene_breakdown.at(-1)?.plot ?? ''} 流传理由：${legend.transmission_reason}`,
  };
  pkg.sequence_beats = story.scene_breakdown.map((scene, index) => ({
    beat_id: story.story_blueprint?.genre_beats[index]?.beat_id ?? `legend-beat-${index + 1}`,
    order: index + 1,
    title: scene.title,
    purpose: scene.dramatic_function,
    visible_action: scene.key_action,
    conflict_discovery_or_instruction: scene.conflict ?? scene.plot,
    emotional_or_information_turn: legend.scene_turns[String(scene.scene_id)] ?? '',
    evidence_ids: evidenceIdsForScene(scene.source_entries, input.research.evidence_items),
  }));
  pkg.scene_breakdown = story.scene_breakdown;
  pkg.full_text = story.full_text;
  pkg.dialogue_or_narration_pass = {
    mode: story.dialogue?.length ? 'dialogue' : 'mixed',
    voice_rules: legend.oral_rhythm_rules,
    polished_text: dialogueText(story),
    unresolved_issues: [],
  };
  pkg.director_text_plan = {
    visual_strategy: `以“${legend.symbolic_motif}”贯穿现实与异境，在重复中改变意义；神异画面始终服务凡人选择。`,
    sound_strategy: '用重复句式、环境声回环、停顿和讲述者节奏保留口述质感，避免现代知识解说压过故事。',
    rhythm_strategy: '异象开场，考验递进，在人物主动选择处转折，最后以物件、地名或习俗承接流传。',
    sequences: story.scene_breakdown.map(scene => ({
      sequence_id: `legend-sequence-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration?.trim() || '风、水、脚步或器物声形成口述故事的节拍。',
      production_constraints: [
        scene.cultural_note,
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
        motifSceneIds.has(Number(scene.scene_id)) ? `本场必须出现核心意象：${legend.symbolic_motif}` : '',
      ].filter((item): item is string => Boolean(item)),
    })),
  };
  pkg.continuity_ledger = {
    items: [
      ...legend.version_boundaries.map((version, index) => ({
        continuity_id: `legend-version-${index + 1}`,
        category: 'fact' as const,
        rule: `${version.label}（${version.version_kind}）：${version.boundary_note}`,
        applies_to_scene_ids: story.scene_breakdown.map(scene => scene.scene_id),
        evidence_ids: input.research.evidence_items
          .filter(item => item.source.includes(version.source) || version.source.includes(item.source))
          .map(item => item.evidence_id),
      })),
      {
        continuity_id: 'legend-symbolic-motif',
        category: 'prop' as const,
        rule: `核心意象“${legend.symbolic_motif}”只在登记场景中重复，并随人物选择改变意义。`,
        applies_to_scene_ids: legend.motif_scene_ids,
        evidence_ids: [],
      },
      ...story.scene_breakdown.map(scene => ({
        continuity_id: `legend-boundary-${scene.scene_id}`,
        category: 'fact' as const,
        rule: `${scene.factual_basis ?? '传说依据待核'}；影视化补足：${(scene.fictionalized_elements ?? []).join('；')}`,
        applies_to_scene_ids: [scene.scene_id],
        evidence_ids: evidenceIdsForScene(scene.source_entries, input.research.evidence_items),
      })),
    ],
    unresolved_conflicts: [],
  };
  pkg.delivery_text_package = {
    script_text: story.full_text,
    scene_units: story.scene_breakdown.map(scene => ({
      scene_id: scene.scene_id,
      script_text: scene.dialogue_or_narration?.trim() || scene.plot,
      visual_action: scene.key_action,
      camera_intent: scene.camera_suggestion,
      sound_intent: '口述节奏、人物对白和环境声分层；不使用知识说明替代场景。',
      continuity_notes: [
        scene.location,
        scene.time_of_day,
        ...scene.characters,
        motifSceneIds.has(Number(scene.scene_id)) ? legend.symbolic_motif : '',
      ].filter(Boolean),
      evidence_boundary_notes: [
        ...(scene.source_entries ?? []),
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter((item): item is string => Boolean(item)),
    })),
    gears_handoff_notes: ['传说视觉可神异化，但每个神异动作都要对应人物考验，并保留版本和改编边界。'],
    seedance_handoff_notes: ['只在意象连续性、人物选择和版本声明复核后生成视频分段提示。'],
    validation_notes: [],
  };

  const evaluation = evaluateLegendStoryProfessionalText({
    package: pkg,
    legend_evidence: legend,
  });
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = evaluation.quality_report.hard_gate_failures.length > 0
    ? 'revision_required'
    : 'in_review';
  return pkg;
}
