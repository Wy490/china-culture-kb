import type { KnowledgePackEntry } from '@shared/types.js';
import {
  buildMachineProductionFieldGuidance,
  type MachineProductionGuidanceInput,
} from '../../../../../mcp-server/src/lib/production-field-guidance.js';

const GUIDANCE_DISCLAIMER = '机器派生生产指导只组织已有素材，不新增文化事实，不授权改写省级 Markdown。';

export function attachMachineProductionGuidance(
  entry: KnowledgePackEntry,
  source: MachineProductionGuidanceInput,
): KnowledgePackEntry {
  const guidance = buildMachineProductionFieldGuidance(source);
  const productionPrompts = [
    promptLine('对白口吻', guidance.fields.dialogue_tone?.value),
    promptLine('可戏剧化空间', guidance.fields.dramatization_space?.value),
    promptLine('视觉符号', guidance.fields.visual_symbols?.value),
  ].filter((item): item is string => Boolean(item));
  const reviewBoundaries = [
    guidance.fields.forbidden_expressions?.value
      ? `[机器派生审稿边界] ${guidance.fields.forbidden_expressions.value}`
      : undefined,
    GUIDANCE_DISCLAIMER,
  ].filter((item): item is string => Boolean(item));

  return {
    ...entry,
    production_prompts: uniqueLines([...(entry.production_prompts ?? []), ...productionPrompts]),
    review_boundaries: uniqueLines([...(entry.review_boundaries ?? []), ...reviewBoundaries]),
  };
}

function promptLine(label: string, value: string | undefined): string | undefined {
  return value ? `[机器派生生产指导/不新增事实] ${label}：${value}` : undefined;
}

function uniqueLines(values: string[]): string[] {
  return [...new Set(values.map(item => item.trim()).filter(Boolean))];
}
