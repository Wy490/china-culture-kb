// web/server/src/services/genre-quality-service.ts
// Adds video-type quality checks on top of the existing structural story report.

import type {
  GenreQualityReport,
  NarrativePatternId,
  StoryBlueprint,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { getGenreSampleGuidance, getGenreStoryProfile } from './genre-story-profiles.js';
import { getNarrativePatternQualitySignals, getNarrativePatternRepairActions } from './narrative-pattern-library.js';

type StoryFieldValue = string | string[] | Array<unknown> | undefined;

export function validateGenreStoryQuality(input: {
  story: StoryGenerateResult;
  baseReport: StoryQualityReport;
  blueprint?: StoryBlueprint;
  narrativePatternIds?: NarrativePatternId[];
}): GenreQualityReport {
  const profile = getGenreStoryProfile(input.story.video_type);
  const sampleGuidance = getGenreSampleGuidance(input.story.video_type);
  const narrativePatternSignals = getNarrativePatternQualitySignals(input.story.video_type, input.narrativePatternIds ?? []);
  const missingRequiredElements = findMissingRequiredElements(input.story);
  const weakBeats = findWeakBeats(input.story, input.blueprint);
  const missingNarrativePatternSignals = findMissingNarrativePatternSignals(input.story, narrativePatternSignals);
  const forbiddenPatternsFound = profile.avoid.filter(pattern => storyText(input.story).includes(pattern));
  const repairActions = [
    ...missingRequiredElements.map(item => `补齐类型字段：${item}`),
    ...weakBeats.map(item => `强化节拍：${item}`),
    ...missingNarrativePatternSignals.map(item => `补强流派质量信号：${item}`),
    ...forbiddenPatternsFound.map(item => `改写不适配表达：${item}`),
    ...sampleGuidance.quality_signals.map(item => `对齐样片信号：${item}`),
    ...getNarrativePatternRepairActions(input.story.video_type, input.narrativePatternIds ?? []),
    ...profile.repair_guidance,
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  const genreScore = Math.max(
    0,
    100
      - missingRequiredElements.length * 14
      - weakBeats.length * 8
      - Math.min(missingNarrativePatternSignals.length, 4) * 3
      - forbiddenPatternsFound.length * 10
      - input.baseReport.issues.length * 5,
  );

  const genreIssues = [
    ...missingRequiredElements.map(item => `类型字段缺失：${item}`),
    ...weakBeats.map(item => `类型节拍偏弱：${item}`),
    ...missingNarrativePatternSignals.slice(0, 4).map(item => `流派质量信号偏弱：${item}`),
    ...forbiddenPatternsFound.map(item => `出现不适配表达：${item}`),
  ];

  return {
    ...input.baseReport,
    video_type: input.story.video_type,
    story_structure: input.story.story_structure,
    genre_score: genreScore,
    missing_required_elements: missingRequiredElements,
    weak_beats: weakBeats,
    forbidden_patterns_found: forbiddenPatternsFound,
    repair_actions: repairActions,
    passed: input.baseReport.passed && genreScore >= 70 && missingRequiredElements.length === 0,
    issues: [...input.baseReport.issues, ...genreIssues],
  };
}

function findMissingNarrativePatternSignals(story: StoryGenerateResult, signals: string[]): string[] {
  const text = storyText(story);
  return signals.filter(signal => !hasSignalText(text, signal));
}

function hasSignalText(text: string, signal: string): boolean {
  const normalizedSignal = signal.replace(/[，。；、\s]/g, '');
  if (!normalizedSignal) return true;
  const chunks = normalizedSignal
    .split(/明确|清楚|可见|成立|充足|具体|自然|存在|强|高|低|有/)
    .map(item => item.trim())
    .filter(item => item.length >= 2);
  if (chunks.length === 0) return text.includes(signal);
  return chunks.some(chunk => text.includes(chunk));
}

function findMissingRequiredElements(story: StoryGenerateResult): string[] {
  const profile = getGenreStoryProfile(story.video_type);
  const missing: string[] = [];
  for (const field of profile.required_fields) {
    if (!hasFieldValue((story as unknown as Record<string, StoryFieldValue>)[field])) {
      missing.push(field);
    }
  }
  return missing;
}

function findWeakBeats(story: StoryGenerateResult, blueprint: StoryBlueprint | undefined): string[] {
  const beats = blueprint?.genre_beats ?? [];
  if (beats.length === 0) return ['缺少类型节拍蓝图'];

  const weak: string[] = [];
  for (const beat of beats) {
    const scene = beat.scene_id
      ? story.scene_breakdown.find(item => item.scene_id === beat.scene_id)
      : story.scene_breakdown[beat.order - 1];
    if (!scene) {
      weak.push(`${beat.order}. ${beat.function_label}缺少对应场景`);
      continue;
    }
    const sceneText = [scene.title, scene.dramatic_function, scene.plot, scene.key_action, scene.dialogue_or_narration].filter(Boolean).join(' ');
    const hasFunction = scene.dramatic_function.includes(beat.function_label)
      || beat.function_label.includes(scene.dramatic_function)
      || sceneText.includes(beat.function_label);
    if (!hasFunction && sceneText.length < 60) {
      weak.push(`${beat.order}. ${beat.function_label}功能不清`);
    }
  }
  return weak;
}

function hasFieldValue(value: StoryFieldValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined;
}

function storyText(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    ...story.scene_breakdown.flatMap(scene => [
      scene.title,
      scene.dramatic_function,
      scene.plot,
      scene.key_action,
      scene.dialogue_or_narration ?? '',
    ]),
  ].join('\n');
}
