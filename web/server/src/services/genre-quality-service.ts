// web/server/src/services/genre-quality-service.ts
// Adds video-type quality checks on top of the existing structural story report.

import type {
  GenreQualityReport,
  StoryBlueprint,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { getGenreStoryProfile } from './genre-story-profiles.js';

type StoryFieldValue = string | string[] | Array<unknown> | undefined;

export function validateGenreStoryQuality(input: {
  story: StoryGenerateResult;
  baseReport: StoryQualityReport;
  blueprint?: StoryBlueprint;
}): GenreQualityReport {
  const profile = getGenreStoryProfile(input.story.video_type);
  const missingRequiredElements = findMissingRequiredElements(input.story);
  const weakBeats = findWeakBeats(input.story, input.blueprint);
  const forbiddenPatternsFound = profile.avoid.filter(pattern => storyText(input.story).includes(pattern));
  const repairActions = [
    ...missingRequiredElements.map(item => `补齐类型字段：${item}`),
    ...weakBeats.map(item => `强化节拍：${item}`),
    ...forbiddenPatternsFound.map(item => `改写不适配表达：${item}`),
    ...profile.repair_guidance,
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  const genreScore = Math.max(
    0,
    100
      - missingRequiredElements.length * 14
      - weakBeats.length * 8
      - forbiddenPatternsFound.length * 10
      - input.baseReport.issues.length * 5,
  );

  const genreIssues = [
    ...missingRequiredElements.map(item => `类型字段缺失：${item}`),
    ...weakBeats.map(item => `类型节拍偏弱：${item}`),
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
