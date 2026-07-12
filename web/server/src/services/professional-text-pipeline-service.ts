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
  evaluateCharacterStoryProfessionalText,
  type CharacterStoryProfessionalEvidence,
} from './professional-text-quality-service.js';

export interface CharacterStoryRelationshipInput {
  from: string;
  to: string;
  starting_relationship: string;
  ending_relationship: string;
}

export interface CharacterStoryProfessionalPipelineInput {
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
  character_evidence: CharacterStoryProfessionalEvidence;
  relationships?: CharacterStoryRelationshipInput[];
  now?: string;
}

function evidenceIdsForScene(
  sceneSourceEntries: string[] | undefined,
  evidenceItems: ProfessionalEvidenceItem[],
): string[] {
  if (!sceneSourceEntries?.length) return evidenceItems.map(item => item.evidence_id);
  const matched = evidenceItems.filter(item => sceneSourceEntries.some(source =>
    item.source.includes(source) || source.includes(item.source)
  ));
  return (matched.length > 0 ? matched : evidenceItems).map(item => item.evidence_id);
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

export function buildCharacterStoryProfessionalTextPackage(
  input: CharacterStoryProfessionalPipelineInput,
): ProfessionalTextPackage {
  if (input.story.video_type !== 'character_story') {
    throw new Error('character_story professional pipeline requires a character_story source');
  }
  const story = input.story;
  const now = input.now ?? new Date().toISOString();
  const pkg = createProfessionalTextPackageSkeleton({
    video_type: 'character_story',
    package_id: `${story.storyId}--professional-text`,
    story_id: story.storyId,
    project_id: story.project_id,
    target_duration: input.target_duration ?? story.story_blueprint?.target_duration ?? '3分钟',
    target_audience: input.target_audience,
    platform: input.platform,
    communication_goal: input.communication_goal,
    truth_mode: input.truth_mode ?? story.truth_mode,
    now,
  });
  const relationships = input.relationships ?? [];
  const characterNames = new Set([
    input.character_evidence.protagonist,
    ...(story.characters ?? []).map(character => character.name),
    ...story.scene_breakdown.flatMap(scene => scene.characters),
  ].filter(Boolean));
  const sequenceBeats = story.scene_breakdown.map((scene, index) => ({
    beat_id: story.story_blueprint?.genre_beats[index]?.beat_id ?? `character-beat-${index + 1}`,
    order: index + 1,
    title: scene.title,
    purpose: scene.dramatic_function,
    visible_action: scene.key_action,
    conflict_discovery_or_instruction: scene.conflict ?? scene.plot,
    emotional_or_information_turn: input.character_evidence.scene_turns[String(scene.scene_id)] ?? '',
    evidence_ids: evidenceIdsForScene(scene.source_entries, input.research.evidence_items),
  }));
  const deliverySceneUnits = story.scene_breakdown.map(scene => ({
    scene_id: scene.scene_id,
    script_text: scene.dialogue_or_narration?.trim() || scene.plot,
    visual_action: scene.key_action,
    camera_intent: scene.camera_suggestion,
    sound_intent: scene.dialogue_or_narration?.trim()
      ? '以人物对白/旁白为前景，环境声服从场景压力。'
      : '以环境声和动作声推动场景，不用解释性旁白填空。',
    continuity_notes: [scene.location, ...scene.characters].filter(Boolean),
    evidence_boundary_notes: [scene.factual_basis, ...(scene.fictionalized_elements ?? [])].filter(
      (item): item is string => Boolean(item),
    ),
  }));
  const evidenceByStatus = (status: ProfessionalEvidenceItem['status']) => input.research.evidence_items
    .filter(item => item.status === status)
    .map(item => item.claim);

  pkg.status = 'draft';
  pkg.creative_brief = {
    target_audience: input.target_audience,
    platform: input.platform,
    target_duration: input.target_duration ?? story.story_blueprint?.target_duration ?? '3分钟',
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
    verified_facts: evidenceByStatus('verified_fact'),
    plausible_dramatizations: evidenceByStatus('plausible_dramatization'),
    fictional_additions: evidenceByStatus('fictional_addition'),
    unknown_or_forbidden_claims: [
      ...evidenceByStatus('unknown'),
      ...input.research.unknowns,
    ],
    required_disclaimers: story.creation_contract?.required_disclaimers ?? [],
  };
  pkg.relationship_or_information_architecture = {
    mode: 'character_relationships',
    nodes: [...characterNames].map(name => ({
      node_id: `character-${name}`,
      label: name,
      role: name === input.character_evidence.protagonist ? 'protagonist' : 'relationship_character',
    })),
    links: relationships.map(relationship => ({
      from: `character-${relationship.from}`,
      to: `character-${relationship.to}`,
      relationship: `${relationship.starting_relationship} -> ${relationship.ending_relationship}`,
    })),
  };
  pkg.structure_outline = {
    structure_name: story.story_structure ?? 'single_event_drama',
    opening: story.scene_breakdown[0]?.plot ?? '',
    development: story.scene_breakdown.slice(1, -2).map(scene => scene.plot),
    climax_or_key_turn: story.scene_breakdown.at(-2)?.plot ?? story.scene_breakdown.at(-1)?.plot ?? '',
    ending: story.scene_breakdown.at(-1)?.plot ?? '',
  };
  pkg.sequence_beats = sequenceBeats;
  pkg.scene_breakdown = story.scene_breakdown;
  pkg.full_text = story.full_text;
  pkg.dialogue_or_narration_pass = {
    mode: story.dialogue?.length ? 'dialogue' : 'mixed',
    voice_rules: input.character_evidence.dialogue_voice_rules,
    polished_text: dialogueText(story),
    unresolved_issues: [],
  };
  pkg.director_text_plan = {
    visual_strategy: '用人物站位、动作和道具变化呈现选择压力，不用赞美性蒙太奇代替人物行动。',
    sound_strategy: '对白、停顿、环境声和关键动作声分层，旁白只补不可见信息。',
    rhythm_strategy: '危机切入，阻力逐场加码，在关键选择处放慢并给动作后果留出余味。',
    sequences: story.scene_breakdown.map(scene => ({
      sequence_id: `sequence-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration?.trim() || '环境声与动作声承担推进。',
      production_constraints: [scene.cultural_note].filter(Boolean),
    })),
  };
  pkg.continuity_ledger = {
    items: [
      ...[...characterNames].map((name, index) => ({
        continuity_id: `character-${index + 1}`,
        category: 'character' as const,
        rule: `${name}的身份、目标和声线在全片保持一致。`,
        applies_to_scene_ids: story.scene_breakdown
          .filter(scene => scene.characters.includes(name))
          .map(scene => scene.scene_id),
        evidence_ids: input.research.evidence_items.map(item => item.evidence_id),
      })),
      ...relationships.map((relationship, index) => ({
        continuity_id: `relationship-${index + 1}`,
        category: 'relationship' as const,
        rule: `${relationship.from}与${relationship.to}从“${relationship.starting_relationship}”变化为“${relationship.ending_relationship}”。`,
        applies_to_scene_ids: story.scene_breakdown
          .filter(scene => scene.characters.includes(relationship.from) || scene.characters.includes(relationship.to))
          .map(scene => scene.scene_id),
        evidence_ids: input.research.evidence_items.map(item => item.evidence_id),
      })),
    ],
    unresolved_conflicts: [],
  };
  pkg.delivery_text_package = {
    script_text: story.full_text,
    scene_units: deliverySceneUnits,
    gears_handoff_notes: ['保持 script_text、visual action、camera intent 和 validation notes 分离。'],
    seedance_handoff_notes: ['只有导演文本和资产连续性通过后，才进一步生成 Seedance 分段提示。'],
    validation_notes: [],
  };

  const evaluation = evaluateCharacterStoryProfessionalText({
    package: pkg,
    character_evidence: input.character_evidence,
  });
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = evaluation.quality_report.hard_gate_failures.length > 0
    ? 'revision_required'
    : 'in_review';
  return pkg;
}
