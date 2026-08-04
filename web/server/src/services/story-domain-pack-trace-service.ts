import type {
  KnowledgePack,
  StoryDomainPackContextEntry,
  StoryDomainPackContextV1,
  StoryDomainPackQualityReportV1,
  StoryGenerateResult,
} from '@shared/types.js';

const MAX_SELECTED_PACKS = 12;
const MAX_GUIDANCE_ITEMS_PER_PACK = 12;

function uniqueTrimmed(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))]
    .slice(0, MAX_GUIDANCE_ITEMS_PER_PACK);
}

export function buildStoryDomainPackContext(
  knowledgePack: KnowledgePack | undefined,
): StoryDomainPackContextV1 | undefined {
  const selectedPacks = (knowledgePack?.supporting_entries ?? [])
    .map<StoryDomainPackContextEntry | undefined>(entry => {
      const productionPrompts = uniqueTrimmed(entry.production_prompts);
      const reviewBoundaries = uniqueTrimmed(entry.review_boundaries);
      if (productionPrompts.length === 0 && reviewBoundaries.length === 0) return undefined;
      return {
        entry_name: entry.entry_name,
        ...(entry.knowledge_domain ? { knowledge_domain: entry.knowledge_domain } : {}),
        ...(entry.entry_role ? { entry_role: entry.entry_role } : {}),
        production_prompts: productionPrompts,
        review_boundaries: reviewBoundaries,
      };
    })
    .filter((entry): entry is StoryDomainPackContextEntry => Boolean(entry))
    .slice(0, MAX_SELECTED_PACKS);

  if (selectedPacks.length === 0) return undefined;

  return {
    schema_version: 'story-domain-pack-context/v1',
    selected_packs: selectedPacks,
    production_prompt_count: selectedPacks.reduce((sum, pack) => sum + pack.production_prompts.length, 0),
    review_boundary_count: selectedPacks.reduce((sum, pack) => sum + pack.review_boundaries.length, 0),
    machine_validation_only: true,
    human_review_complete: false,
    real_credit_granted: false,
  };
}

export function storyDomainPackRequirementLines(
  context: StoryDomainPackContextV1 | undefined,
): string[] {
  if (!context) return [];
  return context.selected_packs.flatMap(pack => [
    ...pack.production_prompts.map(prompt => `Domain Pack 生产提示（${pack.entry_name}）：${prompt}`),
    ...pack.review_boundaries.map(boundary => `Domain Pack 审稿边界（${pack.entry_name}）：${boundary}`),
  ]);
}

function audienceFacingStoryText(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    ...story.scene_breakdown.flatMap(scene => [
      scene.title,
      scene.plot,
      scene.key_action,
      scene.conflict ?? '',
      scene.dialogue_or_narration ?? '',
      scene.cultural_note,
      scene.visual_prompt,
    ]),
    ...story.gears_segments.flatMap(segment => [
      segment.script_text,
      segment.segment_prompt_hint,
    ]),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n');
}

export function evaluateStoryDomainPackQuality(input: {
  story: StoryGenerateResult;
  context?: StoryDomainPackContextV1;
}): StoryDomainPackQualityReportV1 | undefined {
  const { context } = input;
  if (!context) return undefined;

  const audienceText = audienceFacingStoryText(input.story);
  const leaks = new Set<string>();
  const markerMatches = audienceText.match(/(?:Domain Pack|生产提示\s*[：:]|审稿边界\s*[：:])/gi) ?? [];
  markerMatches.forEach(marker => leaks.add(`内部标签：${marker}`));
  for (const pack of context.selected_packs) {
    for (const prompt of pack.production_prompts) {
      if (prompt.length >= 6 && audienceText.includes(prompt)) leaks.add(`生产提示原文：${prompt}`);
    }
    for (const boundary of pack.review_boundaries) {
      if (boundary.length >= 6 && audienceText.includes(boundary)) leaks.add(`审稿边界原文：${boundary}`);
    }
  }
  const internalInstructionLeaks = [...leaks];
  const passed = internalInstructionLeaks.length === 0;

  return {
    schema_version: 'story-domain-pack-quality/v1',
    status: passed ? 'trace_ready' : 'instruction_leak',
    passed,
    selected_pack_count: context.selected_packs.length,
    production_prompt_count: context.production_prompt_count,
    review_boundary_count: context.review_boundary_count,
    internal_instruction_leaks: internalInstructionLeaks,
    boundary_review_status: 'not_human_reviewed',
    machine_validation_only: true,
    human_review_complete: false,
    real_credit_granted: false,
  };
}

export function storyDomainPackRepairActions(
  report: StoryDomainPackQualityReportV1 | undefined,
): string[] {
  if (!report || report.passed) return [];
  return ['移除观众文本中的 Domain Pack 内部指令，只保留由指令转化出的具体动作、画面与事实边界。'];
}
