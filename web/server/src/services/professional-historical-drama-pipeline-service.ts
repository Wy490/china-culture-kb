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
  evaluateHistoricalDramaProfessionalText,
  type HistoricalDramaProfessionalEvidence,
} from './professional-historical-drama-quality-service.js';

export interface HistoricalDramaProfessionalPipelineInput {
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
  historical_evidence: HistoricalDramaProfessionalEvidence;
  now?: string;
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

function claimsByStatus(
  research: ResearchAndEvidenceDossier,
  status: ProfessionalEvidenceItem['status'],
): string[] {
  return research.evidence_items.filter(item => item.status === status).map(item => item.claim);
}

export function buildHistoricalDramaProfessionalTextPackage(
  input: HistoricalDramaProfessionalPipelineInput,
): ProfessionalTextPackage {
  if (input.story.video_type !== 'historical_drama') {
    throw new Error('historical_drama professional pipeline requires a historical_drama source');
  }
  const story = input.story;
  const historical = input.historical_evidence;
  const now = input.now ?? new Date().toISOString();
  const targetDuration = input.target_duration ?? story.story_blueprint?.target_duration ?? '5分钟';
  const pkg = createProfessionalTextPackageSkeleton({
    video_type: 'historical_drama',
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
  const roleNames = new Set([
    ...Object.keys(historical.role_positions),
    ...(story.characters ?? []).map(character => character.name),
    ...story.scene_breakdown.flatMap(scene => scene.characters),
  ].filter(Boolean));
  const allSceneIds = story.scene_breakdown.map(scene => scene.scene_id);

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
    truth_mode: input.truth_mode ?? story.truth_mode ?? 'factual_reconstruction',
    verified_facts: claimsByStatus(input.research, 'verified_fact'),
    plausible_dramatizations: claimsByStatus(input.research, 'plausible_dramatization'),
    fictional_additions: claimsByStatus(input.research, 'fictional_addition'),
    unknown_or_forbidden_claims: [
      ...claimsByStatus(input.research, 'unknown'),
      ...input.research.unknowns,
    ],
    required_disclaimers: story.creation_contract?.required_disclaimers ?? [
      '历史对白、人物站位与场面调度为影视化创作，不作为史料原文。',
    ],
  };
  pkg.relationship_or_information_architecture = {
    mode: 'character_relationships',
    nodes: [...roleNames].map(name => ({
      node_id: `historical-role-${name}`,
      label: name,
      role: historical.role_positions[name]
        ?? (name === historical.protagonist ? 'historical_protagonist' : 'historical_participant'),
    })),
    links: Object.entries(historical.role_positions)
      .filter(([name]) => name !== historical.protagonist)
      .map(([name, position]) => ({
        from: `historical-role-${historical.protagonist}`,
        to: `historical-role-${name}`,
        relationship: `历史立场对照：${historical.role_positions[historical.protagonist] ?? '主角立场'} vs ${position}`,
      })),
  };
  pkg.structure_outline = {
    structure_name: story.story_structure ?? 'single_event_drama',
    opening: story.scene_breakdown[0]?.plot ?? '',
    development: story.scene_breakdown.slice(1, -2).map(scene => scene.plot),
    climax_or_key_turn: story.scene_breakdown.at(-2)?.plot ?? story.scene_breakdown.at(-1)?.plot ?? '',
    ending: story.scene_breakdown.at(-1)?.plot ?? '',
  };
  pkg.sequence_beats = story.scene_breakdown.map((scene, index) => ({
    beat_id: story.story_blueprint?.genre_beats[index]?.beat_id ?? `historical-beat-${index + 1}`,
    order: index + 1,
    title: scene.title,
    purpose: scene.dramatic_function,
    visible_action: scene.key_action,
    conflict_discovery_or_instruction: scene.conflict ?? scene.plot,
    emotional_or_information_turn: historical.scene_turns[String(scene.scene_id)] ?? '',
    evidence_ids: [
      ...evidenceIdsForScene(scene.source_entries, input.research.evidence_items),
      ...(historical.factual_event_chain[index]?.evidence_ids ?? []),
    ].filter((item, itemIndex, items) => items.indexOf(item) === itemIndex),
  }));
  pkg.scene_breakdown = story.scene_breakdown;
  pkg.full_text = story.full_text;
  pkg.dialogue_or_narration_pass = {
    mode: story.dialogue?.length ? 'dialogue' : 'mixed',
    voice_rules: historical.dialogue_voice_rules,
    polished_text: dialogueText(story),
    unresolved_issues: [],
  };
  pkg.director_text_plan = {
    visual_strategy: '用制度空间、文书、道路、队列、器物和人物站位呈现时代压力；史实信息不靠字幕堆砌。',
    sound_strategy: '对白体现立场差异，命令、钟声、脚步、群众声和环境静默承担历史现场压力。',
    rhythm_strategy: '从危机现场切入，因果逐场收紧，在不可撤回的行动处形成高潮，结尾回到可证历史后果。',
    sequences: story.scene_breakdown.map(scene => ({
      sequence_id: `historical-sequence-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration?.trim() || '环境声、命令声和动作声推动事件。',
      production_constraints: [
        scene.cultural_note,
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter((item): item is string => Boolean(item)),
    })),
  };
  pkg.continuity_ledger = {
    items: [
      ...Object.entries(historical.role_positions).map(([name, position], index) => ({
        continuity_id: `historical-role-${index + 1}`,
        category: 'character' as const,
        rule: `${name}的身份、职责和立场保持为“${position}”，不得为制造冲突而无依据改写。`,
        applies_to_scene_ids: story.scene_breakdown
          .filter(scene => scene.characters.includes(name))
          .map(scene => scene.scene_id),
        evidence_ids: input.research.evidence_items.map(item => item.evidence_id),
      })),
      ...historical.factual_event_chain.map(item => ({
        continuity_id: `historical-event-${item.order}`,
        category: 'time' as const,
        rule: `因果顺序 ${item.order}：${item.cause} -> ${item.event} -> ${item.consequence}`,
        applies_to_scene_ids: story.scene_breakdown[item.order - 1]
          ? [story.scene_breakdown[item.order - 1].scene_id]
          : allSceneIds,
        evidence_ids: item.evidence_ids,
      })),
      ...story.scene_breakdown.map(scene => ({
        continuity_id: `historical-boundary-${scene.scene_id}`,
        category: 'fact' as const,
        rule: `${scene.factual_basis ?? '事实依据待核'}；影视化补足：${(scene.fictionalized_elements ?? []).join('；')}`,
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
      sound_intent: scene.dialogue_or_narration?.trim()
        ? '对白与现场声分层，旁白不冒充史料引文。'
        : '环境声和动作声承担推进，不用解释性旁白填空。',
      continuity_notes: [scene.location, scene.time_of_day, ...scene.characters].filter(Boolean),
      evidence_boundary_notes: [
        ...(scene.source_entries ?? []),
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter((item): item is string => Boolean(item)),
    })),
    gears_handoff_notes: ['每个分段保留历史角色、时间、地点和事实/戏剧化边界，不把核验说明写入观众台词。'],
    seedance_handoff_notes: ['只有导演文本、时代资产和史实边界复核后，才生成视频分段提示。'],
    validation_notes: [],
  };

  const evaluation = evaluateHistoricalDramaProfessionalText({
    package: pkg,
    historical_evidence: historical,
  });
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = evaluation.quality_report.hard_gate_failures.length > 0
    ? 'revision_required'
    : 'in_review';
  return pkg;
}
