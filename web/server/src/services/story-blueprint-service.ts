// web/server/src/services/story-blueprint-service.ts
// Builds the genre-aware intermediate plan used before and after story generation.

import type {
  CreationContract,
  EntryDetail,
  EvidenceBoundary,
  KnowledgePack,
  MaterialSufficiencyReport,
  PresentationStyle,
  StoryBlueprint,
  StoryCharacterArcPlan,
  StoryDomainPackContextV1,
  StoryGenreBeat,
  StoryGenreComposition,
  StoryScene,
  StoryStructureType,
  SupportedDuration,
  VideoType,
  NarrativePatternId,
  WritingCapabilityRuntimeContextV1,
} from '@shared/types.js';
import type { GenreStoryMatrixResolution } from './genre-story-profiles.js';
import { getGenreStoryProfile } from './genre-story-profiles.js';
import {
  getNarrativePatternQualitySignals,
  getNarrativePatternRequirementLines,
} from './narrative-pattern-library.js';
import { inferProtagonist } from './dramatic-story.js';
import {
  writingCapabilityGenerationRequirementLines,
} from './writing-capability-runtime-service.js';
import {
  buildStoryDomainPackContext,
  storyDomainPackRequirementLines,
} from './story-domain-pack-trace-service.js';

const DURATION_SEC_MAP: Record<string, number> = {
  '30秒': 30,
  '1分钟': 60,
  '3分钟': 180,
  '5分钟': 300,
  '8分钟': 480,
  '10分钟': 600,
  '15分钟': 900,
  '20分钟': 1200,
};

export function buildStoryBlueprint(input: {
  entry: EntryDetail;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  storyStructure: StoryStructureType;
  targetDuration: SupportedDuration;
  centralEvent?: string;
  knowledgePack?: KnowledgePack;
  scenes?: StoryScene[];
  narrativePatternIds?: NarrativePatternId[];
  creationContract?: CreationContract;
  materialSufficiency?: MaterialSufficiencyReport;
  genreMatrix?: GenreStoryMatrixResolution;
  writingCapabilityContext?: WritingCapabilityRuntimeContextV1;
  domainPackContext?: StoryDomainPackContextV1;
  genreComposition?: StoryGenreComposition;
}): StoryBlueprint {
  const profile = getGenreStoryProfile(input.videoType);
  const protagonist = inferProtagonist(input.entry, input.videoType);
  const evidenceBoundaries = buildEvidenceBoundaries(input.entry, input.knowledgePack, input.centralEvent);
  const domainPackContext = input.domainPackContext ?? buildStoryDomainPackContext(input.knowledgePack);
  const sceneCount = input.scenes?.length ?? estimateSceneCount(input.targetDuration, profile.dramatic_structure.min_scenes, profile.dramatic_structure.max_scenes);
  const templates = expandTemplates(profile.dramatic_structure.scene_templates, sceneCount);
  const genreBeats = templates.map<StoryGenreBeat>((template, index) => {
    const scene = input.scenes?.[index];
    return {
      beat_id: `beat-${index + 1}`,
      order: index + 1,
      function_label: scene?.dramatic_function ?? template.function_label,
      function_description: template.function_description,
      scene_id: scene?.scene_id,
      content_requirement: template.content_guide,
      emotional_turn: inferEmotionalTurn(template.function_label, index, sceneCount),
      evidence_boundary_ids: evidenceBoundaries.map(boundary => boundary.boundary_id),
    };
  });

  return {
    schema_version: 'story-blueprint/v1',
    entry_name: input.entry.name,
    source_entry: input.entry.name,
    video_type: input.videoType,
    presentation_style: input.presentationStyle,
    story_structure: input.storyStructure,
    target_duration: input.targetDuration,
    central_event: input.centralEvent,
    central_question: buildCentralQuestion(input.entry, input.centralEvent, profile.narrative_promise),
    protagonist,
    genre_beats: genreBeats,
    character_arcs: buildCharacterArcs(protagonist, input.centralEvent, profile.framework),
    evidence_boundaries: evidenceBoundaries,
    type_specific_requirements: [
      ...profile.must_include,
      ...profile.scene_rules,
      ...profile.gears_rules,
      ...(input.genreMatrix?.requirement_lines ?? []),
      ...(input.genreMatrix?.warnings ?? []).map(item => `类型矩阵警告：${item}`),
      ...getNarrativePatternRequirementLines(input.videoType, input.narrativePatternIds ?? []),
      ...getNarrativePatternQualitySignals(input.videoType, input.narrativePatternIds ?? []).map(signal => `流派质量信号：${signal}`),
      ...writingCapabilityGenerationRequirementLines(input.writingCapabilityContext),
      ...storyDomainPackRequirementLines(domainPackContext),
      ...(input.genreComposition
        ? [
            ...input.genreComposition.source_requirements,
            ...input.genreComposition.evidence_boundary_rules,
            ...input.genreComposition.creative_rules,
            ...input.genreComposition.compatibility_warnings.map(item => `组合兼容警告：${item}`),
          ]
        : []),
      ...(input.creationContract
        ? [
            `创作场景：${input.creationContract.creation_use_case}`,
            `真实度模式：${input.creationContract.truth_mode}`,
            ...input.creationContract.must_verify.map(item => `必须核实：${item}`),
            ...input.creationContract.forbidden_moves.map(item => `禁止表达：${item}`),
          ]
        : []),
    ],
    ...(input.writingCapabilityContext
      ? { writing_capability_context: input.writingCapabilityContext }
      : {}),
    ...(domainPackContext ? { domain_pack_context: domainPackContext } : {}),
    ...(input.genreComposition ? { genre_composition: input.genreComposition } : {}),
    creation_contract: input.creationContract,
    material_sufficiency: input.materialSufficiency,
  };
}

export function attachBlueprintScenes(blueprint: StoryBlueprint, scenes: StoryScene[], storyId?: string): StoryBlueprint {
  const profile = getGenreStoryProfile(blueprint.video_type);
  const templates = expandTemplates(profile.dramatic_structure.scene_templates, scenes.length);
  return {
    ...blueprint,
    storyId,
    genre_beats: scenes.map((scene, index) => {
      const previous = blueprint.genre_beats[index];
      const template = templates[index];
      return {
        beat_id: previous?.beat_id ?? `beat-${index + 1}`,
        order: index + 1,
        function_label: scene.dramatic_function || previous?.function_label || template.function_label,
        function_description: previous?.function_description || template.function_description,
        scene_id: scene.scene_id,
        content_requirement: previous?.content_requirement || template.content_guide,
        emotional_turn: previous?.emotional_turn ?? inferEmotionalTurn(scene.dramatic_function, index, scenes.length),
        evidence_boundary_ids: previous?.evidence_boundary_ids ?? blueprint.evidence_boundaries.map(boundary => boundary.boundary_id),
      };
    }),
  };
}

function estimateSceneCount(targetDuration: SupportedDuration, minScenes: number, maxScenes: number): number {
  const totalSeconds = DURATION_SEC_MAP[targetDuration] ?? 60;
  return Math.max(minScenes, Math.min(maxScenes, Math.max(3, Math.round(totalSeconds / 50))));
}

function expandTemplates<T>(templates: T[], targetCount: number): T[] {
  if (templates.length >= targetCount) return templates.slice(0, targetCount);
  const result = [...templates];
  while (result.length < targetCount) {
    const insertPos = Math.max(1, result.length - 1);
    result.splice(insertPos, 0, templates[Math.min(insertPos, templates.length - 1)]);
  }
  return result;
}

function buildEvidenceBoundaries(entry: EntryDetail, knowledgePack: KnowledgePack | undefined, centralEvent: string | undefined): EvidenceBoundary[] {
  const boundaries: EvidenceBoundary[] = [{
    boundary_id: 'source-entry',
    label: '主条目事实边界',
    type: entry.credibility === '已核实' ? 'verified' : 'uncertain',
    source: entry.name,
    note: centralEvent
      ? `中心事件「${centralEvent}」来自来源条目，场景细节需保留可信度说明。`
      : '未指定中心事件，生成时需避免把概述写成确定细节。',
  }];

  if (entry.unverifiedPoints.length > 0) {
    boundaries.push({
      boundary_id: 'unverified-points',
      label: '待核实信息',
      type: 'uncertain',
      source: entry.name,
      note: entry.unverifiedPoints.join('；'),
    });
  }

  if (knowledgePack?.supporting_entries.length) {
    boundaries.push({
      boundary_id: 'supporting-pack',
      label: '辅助素材包',
      type: 'creative_treatment',
      source: knowledgePack.supporting_entries.map(item => item.entry_name).join('、'),
      note: '辅助条目用于时代、地域、画面和表达边界，不改写主条目事实。',
    });
  }

  return boundaries;
}

function buildCentralQuestion(entry: EntryDetail, centralEvent: string | undefined, narrativePromise: string): string {
  const subject = entry.name.split('——')[0].trim();
  if (centralEvent && centralEvent !== '整体故事') {
    return `${subject}在「${centralEvent}」中如何完成${narrativePromise}`;
  }
  return `${subject}的故事如何体现${narrativePromise}`;
}

function buildCharacterArcs(protagonist: string, centralEvent: string | undefined, framework: string[]): StoryCharacterArcPlan[] {
  return [{
    character_name: protagonist,
    starting_state: framework[0] ?? '开场状态',
    pressure: centralEvent ? `中心事件「${centralEvent}」带来的外部压力` : '来源条目中的主要压力',
    turning_point: framework[Math.max(1, Math.floor(framework.length / 2))] ?? '关键转折',
    ending_state: framework[framework.length - 1] ?? '主题落点',
  }];
}

function inferEmotionalTurn(label: string, index: number, total: number): string {
  if (index === 0) return `${label}：建立吸引力和观看问题`;
  if (index === total - 1) return `${label}：完成主题回收`;
  if (index >= total - 2) return `${label}：推向高潮或核心表达`;
  return `${label}：推进信息、情绪或选择压力`;
}
