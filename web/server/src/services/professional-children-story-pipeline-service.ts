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
  evaluateChildrenStoryProfessionalText,
  type ChildrenStoryProfessionalEvidence,
} from './professional-children-story-quality-service.js';

export interface ChildrenStoryProfessionalPipelineInput {
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
  children_evidence: ChildrenStoryProfessionalEvidence;
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

export function buildChildrenStoryProfessionalTextPackage(
  input: ChildrenStoryProfessionalPipelineInput,
): ProfessionalTextPackage {
  if (input.story.video_type !== 'children_story') {
    throw new Error('children_story professional pipeline requires a children_story source');
  }
  const story = input.story;
  const children = input.children_evidence;
  const now = input.now ?? new Date().toISOString();
  const targetDuration = input.target_duration ?? story.story_blueprint?.target_duration ?? '5分钟';
  const pkg = createProfessionalTextPackageSkeleton({
    video_type: 'children_story',
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
    children.child_protagonist,
    ...(story.characters ?? []).map(character => character.name),
    ...story.scene_breakdown.flatMap(scene => scene.characters),
  ].filter(Boolean));
  const motifSceneIds = new Set(children.motif_scene_ids);

  pkg.status = 'draft';
  pkg.creative_brief = {
    target_audience: `${input.target_audience}（${children.target_age_band}岁段）`,
    platform: input.platform,
    target_duration: targetDuration,
    communication_goal: input.communication_goal,
    production_goal: input.production_goal,
    budget_assumptions: input.budget_assumptions ?? [],
    delivery_constraints: [
      ...(input.delivery_constraints ?? []),
      ...children.sensitive_content_boundaries,
    ],
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
    ],
    required_disclaimers: story.creation_contract?.required_disclaimers ?? [
      '儿童主人公、事件和对白为教育性虚构改编；文化工艺事实以知识库来源为准。',
    ],
  };
  pkg.relationship_or_information_architecture = {
    mode: 'character_relationships',
    nodes: [...characterNames].map(name => ({
      node_id: `children-character-${name}`,
      label: name,
      role: name === children.child_protagonist ? 'child_protagonist' : 'helper_or_peer',
    })),
    links: [...characterNames]
      .filter(name => name !== children.child_protagonist)
      .map(name => ({
        from: `children-character-${children.child_protagonist}`,
        to: `children-character-${name}`,
        relationship: `围绕“${children.gentle_problem}”形成询问、帮助或共同尝试。`,
      })),
  };
  pkg.structure_outline = {
    structure_name: story.story_structure ?? 'children_fable',
    opening: story.scene_breakdown[0]?.plot ?? '',
    development: story.scene_breakdown.slice(1, -2).map(scene => scene.plot),
    climax_or_key_turn: `${children.positive_choice}；${story.scene_breakdown.at(-2)?.plot ?? ''}`,
    ending: `${story.scene_breakdown.at(-1)?.plot ?? ''} 情绪学习：${children.emotional_learning}`,
  };
  pkg.sequence_beats = story.scene_breakdown.map((scene, index) => ({
    beat_id: story.story_blueprint?.genre_beats[index]?.beat_id ?? `children-beat-${index + 1}`,
    order: index + 1,
    title: scene.title,
    purpose: scene.dramatic_function,
    visible_action: scene.key_action,
    conflict_discovery_or_instruction: scene.conflict ?? scene.plot,
    emotional_or_information_turn: children.scene_turns[String(scene.scene_id)] ?? '',
    evidence_ids: evidenceIdsForScene(scene.source_entries, input.research.evidence_items),
  }));
  pkg.scene_breakdown = story.scene_breakdown;
  pkg.full_text = story.full_text;
  pkg.dialogue_or_narration_pass = {
    mode: story.dialogue?.length ? 'dialogue' : 'mixed',
    voice_rules: [
      ...children.vocabulary_rules,
      `单句建议不超过 ${children.max_sentence_characters} 个汉字。`,
      children.reading_level_note,
    ],
    polished_text: story.scene_breakdown
      .map(scene => scene.dialogue_or_narration?.trim())
      .filter((item): item is string => Boolean(item))
      .join('\n'),
    unresolved_issues: [],
  };
  pkg.director_text_plan = {
    visual_strategy: `画面明亮、角色少、动作清楚；用“${children.repeated_motif}”帮助儿童记住问题和变化。`,
    sound_strategy: '对白使用短句，重复母题配固定声音提示；紧张段落不使用惊吓音效。',
    rhythm_strategy: '一个场景一个主要行动：发现问题、第一次尝试、第二次尝试、作出选择、温暖反馈。',
    sequences: story.scene_breakdown.map(scene => ({
      sequence_id: `children-sequence-${scene.scene_id}`,
      scene_ids: [scene.scene_id],
      blocking_and_visible_action: scene.key_action,
      camera_and_transition_intent: scene.camera_suggestion,
      sound_intent: scene.dialogue_or_narration?.trim() || '清楚的动作声和温和环境声。',
      production_constraints: [
        scene.cultural_note,
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
        motifSceneIds.has(Number(scene.scene_id)) ? `重复母题：${children.repeated_motif}` : '',
        ...children.sensitive_content_boundaries,
      ].filter((item): item is string => Boolean(item)),
    })),
  };
  pkg.continuity_ledger = {
    items: [
      {
        continuity_id: 'children-age-language',
        category: 'character' as const,
        rule: `${children.target_age_band} 岁段；${children.reading_level_note}；单句上限 ${children.max_sentence_characters} 字。`,
        applies_to_scene_ids: story.scene_breakdown.map(scene => scene.scene_id),
        evidence_ids: [],
      },
      {
        continuity_id: 'children-repeated-motif',
        category: 'prop' as const,
        rule: `母题“${children.repeated_motif}”在登记场景重复并随尝试改变意义。`,
        applies_to_scene_ids: children.motif_scene_ids,
        evidence_ids: [],
      },
      ...story.scene_breakdown.map(scene => ({
        continuity_id: `children-boundary-${scene.scene_id}`,
        category: 'fact' as const,
        rule: `${scene.factual_basis ?? '文化依据待核'}；虚构改编：${(scene.fictionalized_elements ?? []).join('；')}`,
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
      sound_intent: '温和环境声、短句对白和重复母题声音分层。',
      continuity_notes: [
        scene.location,
        scene.time_of_day,
        ...scene.characters,
        motifSceneIds.has(Number(scene.scene_id)) ? children.repeated_motif : '',
      ].filter(Boolean),
      evidence_boundary_notes: [
        ...(scene.source_entries ?? []),
        scene.factual_basis,
        ...(scene.fictionalized_elements ?? []),
      ].filter((item): item is string => Boolean(item)),
    })),
    gears_handoff_notes: ['儿童画面保持明亮、低惊吓、可模仿安全；危险工具只由成人操作并保留距离。'],
    seedance_handoff_notes: ['只在年龄、动作模仿风险、文化边界和情绪安全复核后生成视频分段提示。'],
    validation_notes: [`亲师共读提示：${children.parent_or_teacher_prompt}`],
  };

  const evaluation = evaluateChildrenStoryProfessionalText({
    package: pkg,
    children_evidence: children,
  });
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = evaluation.quality_report.hard_gate_failures.length > 0
    ? 'revision_required'
    : 'in_review';
  return pkg;
}
