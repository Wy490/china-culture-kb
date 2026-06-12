// web/server/src/services/story-repair-service.ts
// Builds a focused full-story rewrite package from the genre quality report.

import type {
  GenreStrictness,
  StoryBlueprint,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import type { StoryGenerationPromptPackage } from './story-generation-prompt.js';
import {
  getGenreReturnJsonFields,
  getGenreStoryProfile,
} from './genre-story-profiles.js';

export function shouldAttemptStoryRepair(input: {
  autoRepair?: boolean;
  qualityReport?: StoryQualityReport;
  strictness?: GenreStrictness;
}): boolean {
  if (!input.autoRepair || !input.qualityReport) return false;
  const score = input.qualityReport.genre_score ?? (input.qualityReport.passed ? 100 : 0);
  if (input.strictness === 'loose') return score < 55;
  if (input.strictness === 'strict') return !input.qualityReport.passed || score < 85;
  return !input.qualityReport.passed || score < 70;
}

export function buildStoryRepairPromptPackage(input: {
  basePackage: StoryGenerationPromptPackage;
  story: StoryGenerateResult;
  qualityReport: StoryQualityReport;
  blueprint?: StoryBlueprint;
  strictness?: GenreStrictness;
}): StoryGenerationPromptPackage {
  const profile = getGenreStoryProfile(input.story.video_type);
  const repairActions = input.qualityReport.repair_actions ?? profile.repair_guidance;
  const strictnessLine = input.strictness === 'strict'
    ? '严格模式：必须优先满足类型结构、类型必填字段和场景功能。'
    : input.strictness === 'loose'
      ? '宽松模式：保留原文主要表达，只修正明显类型缺口。'
      : '均衡模式：在保留原意的同时补强类型结构和剧情推进。';

  return {
    ...input.basePackage,
    output_contract: {
      ...input.basePackage.output_contract,
      should_respect: [
        ...input.basePackage.output_contract.should_respect,
        strictnessLine,
        ...repairActions,
      ],
      return_json_fields: getGenreReturnJsonFields(input.story.video_type),
    },
    system_prompt: [
      input.basePackage.system_prompt,
      '',
      '现在执行一次完整故事重写。',
      strictnessLine,
      '必须修正质量报告指出的问题，保持 scene_id 数量和编号不变。',
      '只返回 JSON 对象，不输出解释文字。',
    ].join('\n'),
    user_prompt: [
      input.basePackage.user_prompt,
      '',
      '=== 待重写故事 ===',
      `标题：${input.story.title}`,
      `一句话：${input.story.logline}`,
      `主题：${input.story.theme}`,
      '正文：',
      input.story.full_text,
      '',
      '场景：',
      ...input.story.scene_breakdown.map(scene => [
        `- scene_id=${scene.scene_id}`,
        `功能=${scene.dramatic_function}`,
        `标题=${scene.title}`,
        `情节=${scene.plot}`,
        `关键动作=${scene.key_action}`,
        scene.dialogue_or_narration ? `对白/旁白=${scene.dialogue_or_narration}` : '',
      ].filter(Boolean).join('；')),
      '',
      '=== 类型质量问题 ===',
      `类型匹配度：${input.qualityReport.genre_score ?? '未计算'}`,
      ...input.qualityReport.issues.map(issue => `- ${issue}`),
      '',
      '=== 修复动作 ===',
      ...repairActions.map(action => `- ${action}`),
      '',
      ...(input.blueprint ? [
        '=== 必须保留的类型蓝图 ===',
        `中心问题：${input.blueprint.central_question}`,
        ...input.blueprint.genre_beats.map(beat => `- ${beat.order}. ${beat.function_label}：${beat.content_requirement}`),
      ] : []),
      '',
      '返回 JSON 字段：',
      getGenreReturnJsonFields(input.story.video_type).join(', '),
    ].join('\n'),
  };
}
