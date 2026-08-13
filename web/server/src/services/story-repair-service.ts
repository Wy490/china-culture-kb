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
import { getStoryFamilyRepairGuidance } from './story-family-quality-service.js';
import { isStoryQualityPassed } from './quality-workflow-service.js';

export function shouldAttemptStoryRepair(input: {
  autoRepair?: boolean;
  qualityReport?: StoryQualityReport;
  strictness?: GenreStrictness;
}): boolean {
  if (!input.autoRepair || !input.qualityReport) return false;
  const storyQualityPassed = isStoryQualityPassed(input.qualityReport);
  const score = input.qualityReport.genre_score ?? (storyQualityPassed ? 100 : 0);
  if (input.strictness === 'loose') return score < 55;
  if (input.strictness === 'strict') return !storyQualityPassed || score < 85;
  return !storyQualityPassed || score < 70;
}

function formatList(label: string, values: string[] | undefined, max = 6): string[] {
  const items = (values ?? []).map(item => item.trim()).filter(Boolean).slice(0, max);
  return items.length > 0 ? [`${label}：${items.join('；')}`] : [];
}

function buildRepairContractShouldRespect(story: StoryGenerateResult): string[] {
  const contract = story.creation_contract;
  const materialSufficiency = story.material_sufficiency ?? contract?.material_sufficiency;
  const lines: string[] = [];

  if (contract) {
    lines.push(`修复时保持创作场景 ${contract.creation_use_case} 与真实度模式 ${contract.truth_mode}，不得把修复补写改成未授权事实。`);
    lines.push(...formatList('修复仍需遵守禁止表达', contract.forbidden_moves, 4));
    lines.push(...formatList('修复仍需保留必要声明', contract.required_disclaimers, 3));
    lines.push(...formatList('修复新增内容必须优先核实', contract.must_verify, 4));
  }

  if (materialSufficiency) {
    lines.push(`修复必须尊重素材 Gate：目标阶段=${materialSufficiency.stage}，当前可推进=${materialSufficiency.active_stage ?? materialSufficiency.stage}，生成姿态=${materialSufficiency.generation_posture ?? '未标注'}。`);
    if (materialSufficiency.needs_verification) {
      lines.push('素材 Gate 要求待核验边界：修复文本不得把待核验内容写成确定事实。');
    }
  }

  return lines;
}

function buildRepairContractPromptLines(story: StoryGenerateResult): string[] {
  const contract = story.creation_contract;
  const materialSufficiency = story.material_sufficiency ?? contract?.material_sufficiency;
  if (!contract && !materialSufficiency) return [];

  const lines = ['=== 创作合同与素材边界 ==='];
  if (contract) {
    lines.push(`创作场景：${contract.creation_use_case}`);
    lines.push(`真实度模式：${contract.truth_mode}`);
    if (contract.client_type) lines.push(`客户/机构类型：${contract.client_type}`);
    if (contract.target_audience) lines.push(`目标受众：${contract.target_audience}`);
    if (contract.communication_goal) lines.push(`传播目标：${contract.communication_goal}`);
    lines.push(...formatList('允许虚构', contract.allowed_fiction));
    lines.push(...formatList('必须核实', contract.must_verify));
    lines.push(...formatList('禁止表达', contract.forbidden_moves));
    lines.push(...formatList('必要声明', contract.required_disclaimers));
    lines.push(...formatList('交付期待', contract.delivery_expectation));
  }
  if (materialSufficiency) {
    lines.push(`素材目标阶段：${materialSufficiency.stage}`);
    if (materialSufficiency.active_stage) lines.push(`当前可安全推进阶段：${materialSufficiency.active_stage}`);
    lines.push(`素材评分：${materialSufficiency.score}`);
    lines.push(`素材阻断：${materialSufficiency.blocked ? '是' : '否'}`);
    if (materialSufficiency.generation_posture) lines.push(`生成姿态：${materialSufficiency.generation_posture}`);
    if (materialSufficiency.needs_verification) lines.push('待核验边界：需要在修复文本中保留事实/创作分界。');
    for (const item of materialSufficiency.missing_items.slice(0, 6)) {
      lines.push(`缺口：${item.label}（${item.blocking_level}；影响 ${item.affects.join('、')}）`);
    }
    if (materialSufficiency.recommended_next_questions.length > 0) {
      lines.push(`建议追问：${materialSufficiency.recommended_next_questions.slice(0, 4).join('；')}`);
    }
  }
  return lines;
}

function buildDomainPackRepairLines(blueprint: StoryBlueprint | undefined): {
  shouldRespect: string[];
  promptLines: string[];
} {
  const context = blueprint?.domain_pack_context;
  if (!context) return { shouldRespect: [], promptLines: [] };

  const guidanceLines = context.selected_packs.flatMap(pack => [
    ...pack.production_prompts.map(prompt => `Domain Pack 生产提示（${pack.entry_name}）：${prompt}`),
    ...pack.review_boundaries.map(boundary => `Domain Pack 审稿边界（${pack.entry_name}）：${boundary}`),
  ]);
  return {
    shouldRespect: [
      'Domain Pack 仅作内部机器生成与校验约束，不得把提示标签或原文写进观众文本，也不得视为人工审校或真实生产 credit。',
      ...guidanceLines,
    ],
    promptLines: [
      '=== Domain Pack 修复边界 ===',
      '以下内容仅供内部机器修复使用；不得原样泄漏到标题、正文、场景、对白/旁白或视觉提示中。',
      ...guidanceLines,
    ],
  };
}

export function buildStoryRepairPromptPackage(input: {
  basePackage: StoryGenerationPromptPackage;
  story: StoryGenerateResult;
  qualityReport: StoryQualityReport;
  blueprint?: StoryBlueprint;
  strictness?: GenreStrictness;
}): StoryGenerationPromptPackage {
  const profile = getGenreStoryProfile(input.story.video_type);
  const familyGuidance = getStoryFamilyRepairGuidance(input.story.video_type);
  const failedFamilyChecks = input.qualityReport.family_quality_report?.checks
    .filter(check => check.status === 'failed') ?? [];
  const familyRepairActions = failedFamilyChecks.length > 0
    ? [
        `按「${familyGuidance.family_label}」家族修复，不套用其他片型家族义务。`,
        ...failedFamilyChecks.map(check => `补齐「${check.label}」：${check.summary}`),
        ...familyGuidance.instructions,
        `优先修改字段：${familyGuidance.focus_fields.join('、')}。`,
      ]
    : [];
  const repairActions = [
    ...familyRepairActions,
    ...(input.qualityReport.repair_actions ?? profile.repair_guidance),
  ].filter((action, index, all) => all.indexOf(action) === index);
  const repairContractShouldRespect = buildRepairContractShouldRespect(input.story);
  const repairContractPromptLines = buildRepairContractPromptLines(input.story);
  const domainPackRepair = buildDomainPackRepairLines(input.blueprint);
  const strictnessLine = input.strictness === 'strict'
    ? '严格模式：必须优先满足类型结构、类型必填字段和场景功能。'
    : input.strictness === 'loose'
      ? '宽松模式：保留原文主要表达，只修正明显类型缺口。'
      : '均衡模式：在保留原意的同时补强对应片型家族的信息、场景与交付推进。';

  return {
    ...input.basePackage,
    output_contract: {
      ...input.basePackage.output_contract,
      should_respect: [
        ...input.basePackage.output_contract.should_respect,
        strictnessLine,
        ...familyGuidance.instructions,
        `优先修改字段：${familyGuidance.focus_fields.join('、')}。`,
        ...repairActions,
        ...repairContractShouldRespect,
        ...domainPackRepair.shouldRespect,
      ],
      return_json_fields: getGenreReturnJsonFields(input.story.video_type),
    },
    system_prompt: [
      input.basePackage.system_prompt,
      '',
      `你是${familyGuidance.writer_role}。`,
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
      ...(input.qualityReport.writing_capability_quality
        && input.blueprint?.writing_capability_context
        ? [
            '=== 写作能力修复上下文 ===',
            `能力：${input.blueprint.writing_capability_context.capability_id}`,
            `激活：${input.blueprint.writing_capability_context.activation_id}`,
            ...(input.qualityReport.writing_capability_quality.evaluation_kind === 'machine_reader_simulation'
              ? ['评估性质：机器读者模拟，不是真人反馈；只使用下列可定位文本现象。']
              : []),
            ...input.qualityReport.writing_capability_quality.checks
              .filter(check => check.status === 'failed')
              .map(check => `- [${check.check_id}] scene_id=${check.scene_ids.join('、') || '全局'}：${check.message}；${check.repair_hint ?? '按原类型蓝图局部修复。'}`),
            '',
          ]
        : []),
      `=== ${familyGuidance.family_label}家族门禁 ===`,
      `家族：${familyGuidance.family_label}`,
      `修订角色：${familyGuidance.writer_role}`,
      ...failedFamilyChecks.map(check => `- [${check.check_id}] ${check.label}：${check.summary}`),
      ...familyGuidance.instructions.map(instruction => `- ${instruction}`),
      `优先字段：${familyGuidance.focus_fields.join('、')}`,
      '',
      ...(repairContractPromptLines.length > 0 ? [
        ...repairContractPromptLines,
        '',
      ] : []),
      ...(domainPackRepair.promptLines.length > 0 ? [
        ...domainPackRepair.promptLines,
        '',
      ] : []),
      ...(input.qualityReport.outline_coverage_report ? [
        '=== Outline Coverage Report ===',
        `覆盖分：${input.qualityReport.outline_coverage_report.coverage_score}`,
        `预览：${input.qualityReport.outline_coverage_report.preview}`,
        ...input.qualityReport.outline_coverage_report.nodes
          .filter(node => node.status !== 'covered')
          .map(node => `- ${node.order}. ${node.text}：${node.repair_hint}`),
        '',
      ] : []),
      ...(input.qualityReport.pattern_quality_report ? [
        '=== Pattern Quality Report ===',
        `模式分：${input.qualityReport.pattern_quality_report.pattern_score}`,
        `预览：${input.qualityReport.pattern_quality_report.preview}`,
        ...input.qualityReport.pattern_quality_report.weak_signals
          .slice(0, 8)
          .map(signal => [
            `- ${signal.label}：${signal.repair_hint}`,
            `  反证：${signal.counter_evidence[0] ?? '无'}`,
            `  目标：场景 ${signal.repair_target.scene_ids.join('、') || '全局'}；字段 ${signal.repair_target.fields.join('、')}`,
          ].join('\n')),
        '',
      ] : []),
      ...(input.qualityReport.gears_readiness_report ? [
        '=== GEARS Readiness Report ===',
        `交付分：${input.qualityReport.gears_readiness_report.readiness_score}`,
        `预览：${input.qualityReport.gears_readiness_report.preview}`,
        ...input.qualityReport.gears_readiness_report.issue_items
          .slice(0, 8)
          .map(item => `- ${item}`),
        '',
      ] : []),
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
